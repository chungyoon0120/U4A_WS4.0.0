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
                // ERROR-ADDIT-DATA / DESIGN-TREE-SELECT-OBJID = P6 잔여.
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
