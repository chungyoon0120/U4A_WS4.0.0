/****************************************************************************
 * Binding Popup(대형 별창) — 부모창(WS20) 방송 수신부 (bindBroadcast.js) — HTML5
 * --------------------------------------------------------------------------
 *  원본: wsDesignHandler/broadcastChannelBindPopup.js (UI5) 1:1 이식(핵심만).
 *
 *  ★ 가운데 "디자인 트리"의 실제 데이터 유입 경로 = BroadcastChannel(channelKey).
 *    별창은 별도 BrowserWindow 라 native 드래그(prc002)가 창을 못 넘는다 → WS20 이
 *    onModelDataChanged 시 UPDATE_DESIGN_DATA(T_0014/0015/CEVT) 를 방송하고, 팝업이
 *    받아 setDesignTreeData 로 트리를 재구성한다. 이 파일이 그 수신부다.
 *
 *  ★ 불변 계약(§3.11/§8):
 *    - PRCCD 철자 비대칭: 수신=UPDATE_DESIGN_DATA(언더바) / 송신=UPDATE-DESIGN-DATA(하이픈).
 *    - busy 왕복: WS20 은 방송 전 자기 busy("X") 를 켠다 → 팝업이 처리 후 BUSY_OFF 를
 *      같은 채널로 되돌려야 WS20 잠금이 풀린다(안 보내면 WS20 영구 busy). [[broadcast-busy-pair]]
 *
 *  ★ 후속(P6 잔여): BUSY_ON/OFF 자식창 브로드캐스트, ERROR-ADDIT-DATA, DESIGN-TREE-SELECT-OBJID,
 *    messageChange detach→refresh→attach(무한에코 방지), moveDesignPage/추가속성 갱신은 가드/스킵.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    var oChannel = null;

    // 팝업 → WS20 방송 송신(원본 sendPostMessage). 채널 없으면 오류 로깅(삼킴 아님).
    function _sendPostMessage(oData) {
        if (!oChannel) {
            console.error("[HTML5][bindWindow] 방송채널 없음 — 송신 불가:", oData && oData.PRCCD);
            return;
        }
        try { oChannel.postMessage(oData); }
        catch (e) { console.error("[HTML5][bindWindow] 방송 송신 오류:", oData && oData.PRCCD, e && e.message); }
    }

    // WS20 디자인 영역 busy off 요청(원본 sendDesignAreaBusyOff) — WS20 잠금 해제.
    function _sendDesignAreaBusyOff() { _sendPostMessage({ PRCCD: "BUSY_OFF" }); }

    /************************************************************************
     * [P6 송신] N건 바인딩 정보 수집 — 원본 setBindAggrData 1:1.
     *   oUi._BIND_AGGR[key] = [UI객체…] → key 별 _OBJID 배열만 추려 전송본 구성.
     ************************************************************************/
    function _setBindAggrData(sParam, oUi) {
        if (!oUi._BIND_AGGR || Object.keys(oUi._BIND_AGGR).length === 0) { return; }
        for (var key in oUi._BIND_AGGR) {
            var aAggr = oUi._BIND_AGGR[key] || [];
            sParam[key] = [];
            for (var i = 0; i < aAggr.length; i++) { sParam[key].push(aAggr[i]._OBJID); }
        }
    }

    /************************************************************************
     * [P6 송신] attribute data(oPrev) 구성 — 원본 setPrevdata 1:1.
     *   prev[OBJID] 중 _T_0015 가 있는 것만 → {_T_0015, _MODEL, _BIND_AGGR(OBJID 배열)}.
     ************************************************************************/
    function _setPrevData() {
        var oPrev = {};
        var oSrc = oAPP.attr.prev || {};
        for (var key in oSrc) {
            var oUi = oSrc[key];
            if (!oUi || typeof oUi._T_0015 === "undefined") { continue; }
            var sParam = { _T_0015: oUi._T_0015, _MODEL: oUi._MODEL, _BIND_AGGR: {} };
            _setBindAggrData(sParam._BIND_AGGR, oUi);
            oPrev[key] = sParam;
        }
        return oPrev;
    }

    /************************************************************************
     * [P6 송신 · SPEC §8/§3.11] 팝업 → WS20 디자인 데이터 반영
     *   — 원본 broadcastChannelBindPopup.js updateBindPopupDesignData 1:1.
     *   ★ PRCCD = "UPDATE-DESIGN-DATA"(하이픈, 송신). 수신 코드(UPDATE_DESIGN_DATA, 밑줄)와 별개 — 통일 금지.
     *   ★ busy 왕복(§3.11): 여기서 busy ON 만 하고 스스로 끄지 않는다. WS20 이 반영 후 UPDATE_DESIGN_DATA 를
     *     되돌려주면 _updateDesignData 가 트리 재빌드 → BUSY_OFF 송신 → 로컬 setBusy(false) 로 끝난다.
     *     (이 왕복 전에 busy 를 풀면 사용자가 stale 데이터에 재조작 가능 → 원본이 금지.)
     ************************************************************************/
    oAPP.fn.updateBindPopupDesignData = function () {
        if (!oChannel) {
            console.error("[HTML5][bindWindow] 방송채널 없음 — WS20 반영 불가(UPDATE-DESIGN-DATA)");
            return;
        }
        oAPP.fn.setBusy(true);
        _sendPostMessage({
            PRCCD: "UPDATE-DESIGN-DATA",
            T_0014: (typeof oAPP.fn.getDesignT0014 === "function") ? oAPP.fn.getDesignT0014() : [],
            oPrev: _setPrevData(),
            T_CEVT: oAPP.attr.T_CEVT || []
        });
    };

    // WS20 → 팝업 디자인 데이터 갱신(원본 updateDesignData 핵심 1:1).
    function _updateDesignData(oEvent) {
        var d = (oEvent && oEvent.data) || {};
        if (d.PRCCD !== "UPDATE_DESIGN_DATA") { return; }

        oAPP.fn.setBusy(true);

        // 광역변수 갱신(원본).
        oAPP.attr.T_0014 = JSON.parse(JSON.stringify(d.T_0014 || []));
        oAPP.attr.T_0015 = JSON.parse(JSON.stringify(d.T_0015 || []));
        oAPP.attr.T_CEVT = JSON.parse(JSON.stringify(d.T_CEVT || []));

        // 추가속성 화면 비활성(P3 도착 전 가드) — 원본 setAdditLayout("", {KEEP_SPLITTER_SIZE:true}).
        if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout("", { KEEP_SPLITTER_SIZE: true }); } catch (e) { } }

        // 디자인 트리 재구성(재렌더 + 컬럼맞춤 포함).
        if (typeof oAPP.fn.setDesignTreeData === "function") { oAPP.fn.setDesignTreeData(); }

        // 추가속성 리스트 재구성(P3 가드).
        if (oAPP.attr.oAddit && oAPP.attr.oAddit.fn && typeof oAPP.attr.oAddit.fn.setAdditialListData === "function") {
            try { oAPP.attr.oAddit.fn.setAdditialListData(); } catch (e) { }
        }

        // ★ WS20 잠금 해제(불변 계약) — 처리 완료를 알린다.
        _sendDesignAreaBusyOff();

        oAPP.fn.setBusy(false);
    }

    /************************************************************************
     * [P6 수신 · SPEC §6] WS20 반송 추가속성 오류 → 오류 팝오버.
     *   원본 broadcastChannelBindPopup.js:330 responseAdditError 1:1.
     *   흐름: 팝업 필드+추가속성을 WS20 캔버스에 드롭 → WS20 attrCheckDropMPROP 검사 →
     *         오류면 WS20 이 { PRCCD:"ERROR-ADDIT-DATA", T_ERMSG:[{ITMCD,ERMSG}] } 반송
     *         (원본 send측 sendAdditError:773). HTML5 수신부가 없어 그동안 조용히 무시됨(P6 잔여).
     *   표시: T_ERMSG → TY_BIND_ERROR(ACT05=우측 추가속성 라인, LINE_KEY=ITMCD) → 우측 패널 앵커 팝오버.
     *   ★ 원본과 동일하게 로컬 busy(표시 전후) + showMessagePopoverOppener(자체 오류 게이트와 같은 계약).
     ************************************************************************/
    function _responseAdditError(oEvent) {
        var d = (oEvent && oEvent.data) || {};
        if (d.PRCCD !== "ERROR-ADDIT-DATA") { return; }
        var aErm = d.T_ERMSG;
        if (typeof aErm === "undefined" || !aErm.length) { return; }   // 원본: undefined/0 이면 무시.

        oAPP.fn.setBusy(true);

        var A = oAPP.attr.CS_MSG_ACTCD || {};
        var aErr = [];
        for (var i = 0; i < aErm.length; i++) {
            var e = aErm[i] || {};
            aErr.push(oAPP.fn.newBindError({
                ACTCD: A.ACT05,          // 우측 추가속성 테이블 "라인"(ITMCD 매칭 강조 + 링크이동)
                LINE_KEY: e.ITMCD,
                TYPE: "Error",
                TITLE: e.ERMSG,
                DESC: e.ERMSG
            }));
        }

        // 앵커 = 우측 "추가 속성 바인딩" 패널 호스트(#bwpAdditInfo). 원본 oAddit.ui.ROOT 대응.
        var oAnchor = document.getElementById("bwpAdditInfo");
        if (oAnchor && aErr.length && typeof oAPP.fn.showMessagePopoverOppener === "function") {
            Promise.resolve(oAPP.fn.showMessagePopoverOppener(oAnchor, aErr))
                .then(function () { oAPP.fn.setBusy(false); }, function () { oAPP.fn.setBusy(false); });
        } else {
            oAPP.fn.setBusy(false);
        }
    }

    /************************************************************************
     * [P6 송신 · SPEC §8 패스스루] 도움말 문서 열기 요청 — 원본 broadcastChannelBindPopup.js:757 1:1.
     *   별창은 U4A HELP DOCUMENT 팝업을 직접 못 여니 WS20(디자인 영역)에 호출을 위임한다.
     *   ★ sParam 키 "opstion"(원본 오타) 그대로 유지 — 수신측이 그 문자열로 읽는다. 고치면 계약 파손.
     ************************************************************************/
    oAPP.fn.sendHelpDocOpen = function (oData) {
        _sendPostMessage({ PRCCD: "U4A_HELP_DOC_OPEN", sParam: oData });
    };

    /************************************************************************
     * [P6] 디자인 변경 후속 방송(합침) — 원본 onModelDataChanged(모델 messageChange) 대응.
     *   원본은 쓰기 후 refresh(true) 1회 → messageChange 1회 → UPDATE-DESIGN-DATA 1회다.
     *   HTML5 는 attrChange 가 행마다 불리므로(멀티 N행) rAF 로 묶어 1회만 보낸다(원본과 동등).
     *   호출처: bindWrite attrChange(바인딩/해제) + MPROP stamp 경로(추가속성 적용).
     ************************************************************************/
    var iBroadRaf = 0;
    oAPP.fn.designBroadcastUpdate = function () {
        if (iBroadRaf) { return; }
        iBroadRaf = requestAnimationFrame(function () {
            iBroadRaf = 0;
            try { oAPP.fn.updateBindPopupDesignData(); }
            catch (e) { console.error("[HTML5][bindWindow] designBroadcastUpdate:", e && e.message); }
        });
    };

    // [PUBLIC] 방송 채널 생성(원본 createChannel) — frame.js Stage6 에서 호출.
    oAPP.fn.createBindChannel = function () {
        if (!oAPP.attr.channelKey) {
            console.error("[HTML5][bindWindow] channelKey 없음 — 방송채널 미생성(WS20 동기화 불가)");
            return;
        }
        if (oChannel) { return; }   // 중복 생성 방지.

        oChannel = new BroadcastChannel(oAPP.attr.channelKey);
        oAPP.attr.oBindChannel = oChannel;

        oChannel.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (typeof sPrc === "undefined") { return; }
            switch (sPrc) {
                case "UPDATE_DESIGN_DATA":
                    _updateDesignData(oEvent);   // WS20 → 디자인 트리 재구성.
                    break;
                case "BUSY_ON":
                    oAPP.fn.setBusy(true, { ISBROAD: true });
                    break;
                case "BUSY_OFF":
                    oAPP.fn.setBusy(false, { ISBROAD: true });
                    break;
                case "ERROR-ADDIT-DATA":
                    _responseAdditError(oEvent);   // WS20 반송 추가속성 오류 → 우측 패널 팝오버(SPEC §6).
                    break;
                // DESIGN-TREE-SELECT-OBJID = P6 잔여(R3).
                default:
                    break;
            }
        };
    };

    // [PUBLIC] 방송 채널 종료(원본 closeChannel) — 창 종료 시.
    oAPP.fn.closeBindChannel = function () {
        if (!oChannel) { return; }
        try { oChannel.close(); } catch (e) { }
        oChannel = null;
        oAPP.attr.oBindChannel = null;
    };

    // [PUBLIC] 채널 생성 여부(원본 isCreateChannel).
    oAPP.fn.isBindChannelCreated = function () { return !!oChannel; };

})();
