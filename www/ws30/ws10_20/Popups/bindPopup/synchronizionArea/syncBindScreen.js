/****************************************************************************
 * Binding Popup(대형 별창) 동일속성 바인딩 화면 — HTML5 (SPEC §5, 원본 uiModule/synchronizionBind.js)
 * --------------------------------------------------------------------------
 *  원본은 oDesign.ui.ROOT(NavContainer) 안에서 트리 페이지 ↔ 동일속성 Page 를 to()/moveDesignPage 로
 *  스왑한다. HTML5 는 NavContainer 가 없어, 가운데 디자인트리 영역(#bwpDesignArea)을
 *  designSwapToPage/moveDesignPage(designArea.js) 로 슬라이드 스왑(.analy 16 §9.2)한다.
 *
 *  ★ S1b 범위 = 화면 껍데기(툴바 3버튼) + 진입/뒤로 슬라이드 + 진입/복귀 부수효과 배선.
 *    - 상단 패널(선택 속성 4줄 + MPROP) = S2 / 하단 후보 테이블 = S3 / 일괄적용 = S4 / 비모달 = S5.
 *    - 140 "동일속성 적용 팝업 호출" 버튼은 S5 까지 비활성(자리만).
 *  ★ CJS(module.exports) 아님 — 별창 require 미지원이라 oAPP.fn 전역 노출로 이식.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    var H = oAPP.H;   // 공유 UI 헬퍼(bindShared.js) — el/fa/iconBtn/z.

    // 동일속성 화면 상태(원본 oContr 대응) — S2/S3/S4 가 소비.
    var oSync = { page: null, body: null, S_ATTR: null, aList: null };
    oAPP.attr.oSync = oSync;

    // 텍스트+아이콘 툴바 버튼(공통 .u4a-btn) — 원본 sap.m.Button.
    function _btn(sFa, sText, sTip, sVariant, fn) {
        var b = H.el("button", "u4a-btn" + (sVariant ? " " + sVariant : ""));
        b.type = "button";
        if (sFa) { b.innerHTML = H.fa(sFa); }
        if (sText) { b.appendChild(document.createTextNode(sText)); }
        if (sTip) { b.title = sTip; b.setAttribute("aria-label", sTip); }
        if (typeof fn === "function") { b.addEventListener("click", fn); }
        return b;
    }

    // 라벨:값 한 줄(잘리면 공통 툴팁 — 16 §2.9a data-tip-trunc).
    function _infoRow(oParent, sLabel, sVal) {
        var oRow = H.el("div", "u4aBwpSyncInfoRow");
        var oLb = H.el("span", "u4aBwpSyncInfoLbl");
        oLb.textContent = sLabel || "";
        oLb.setAttribute("data-tip", sLabel || ""); oLb.setAttribute("data-tip-trunc", "");
        var oVal = H.el("span", "u4aBwpSyncInfoVal");
        var sTxt = (sVal === null || typeof sVal === "undefined") ? "" : String(sVal);
        oVal.textContent = sTxt;
        oVal.setAttribute("data-tip", sTxt); oVal.setAttribute("data-tip-trunc", "");
        oRow.appendChild(oLb); oRow.appendChild(oVal);
        oParent.appendChild(oRow);
    }

    // 추가속성(T_MPROP) 구성 — 원본 _setAdditBindData(synchronizionBind.js:118) 1:1.
    //   MPROP split("|") | UA028(FLD02≠"X" 제외 → ITMCD 정렬) 을 ★같은 인덱스로 짝(prop=FLD01, val=split[i]).
    function _buildTMprop(sMprop) {
        var a = [];
        if (typeof sMprop === "undefined" || sMprop === "") { return a; }
        var aSplit = sMprop.split("|");
        if (aSplit.length === 0) { return a; }
        var aUa = (oAPP.attr.T_9011 || []).filter(function (x) { return x.CATCD === "UA028"; });
        if (aUa.length === 0) { return a; }
        aUa = aUa.filter(function (x) { return x.FLD02 !== "X"; });                       // 조회속성 제외.
        aUa.sort(function (x, y) { return x.ITMCD.localeCompare(y.ITMCD); });             // ITMCD 오름차순.
        for (var i = 0; i < aUa.length; i++) {
            a.push({ ITMCD: aUa[i].ITMCD, prop: aUa[i].FLD01, val: aSplit[i] });          // ★인덱스 짝(순서 틀리면 값 밀림).
        }
        return a;
    }

    // [S2] 상단 패널 — 선택 속성 4줄 + 추가속성 값. 원본 setModelData(87)/designView 패널부(967~1099).
    function _renderSyncPanel(oBody) {
        var s = oSync.S_ATTR || {};
        var oPanel = U4AUI.createPanel({ title: H.z("060") });   // 060 Selected UI Object Info(트위스티=원본 ▶ 대체).
        oBody.appendChild(oPanel.el);

        // 4줄: 190 UI Object ID / 191 Attribute ID / 192 Attribute Type / 193 Binding Field.
        var oInfo = H.el("div", "u4aBwpSyncInfo");
        _infoRow(oInfo, H.z("190"), s.OBJID);
        _infoRow(oInfo, H.z("191"), s.UIATT);
        _infoRow(oInfo, H.z("192"), s.UIADT);
        _infoRow(oInfo, H.z("193"), s.UIATV);
        oPanel.body.appendChild(oInfo);

        // 추가속성 값 목록(읽기전용) — 없으면 미표시(원본 _setAdditBindData exit).
        var aMprop = _buildTMprop(s.MPROP);
        if (aMprop.length > 0) {
            var oMp = H.el("div", "u4aBwpSyncInfo u4aBwpSyncMprop");
            aMprop.forEach(function (m) { _infoRow(oMp, m.prop, m.val); });
            oPanel.body.appendChild(oMp);
        }
    }

    // [S3] 하단 후보 테이블 — 7컬럼 멀티선택 + 컬럼최적화. 원본 designView 테이블부(1106~1228).
    //   데이터 = oSync.aList(getSameAttrList). 멀티선택 = 체크박스 열(공통 makeDataTable 은 단일선택뿐).
    function _renderSyncList(oBody) {
        var oWrap = H.el("div", "u4aBwpSyncList");

        // 제목 061 Target Replace Properties.
        var oTitle = H.el("div", "u4aBwpSyncListTitle");
        oTitle.textContent = H.z("061");
        oWrap.appendChild(oTitle);

        // 툴바: [일괄적용 141 — S4까지 비활성] · Spacer · [컬럼최적화 161].
        var oBar = H.el("div", "u4aBwpTool u4aBwpSyncListTool");
        var oApply = _btn("check", H.z("141"), H.z("141"), "u4a-btn--emphasized", null);   // 141 일괄적용.
        oApply.disabled = true;   // S4 까지 비활성(원본 onSetSyncAttr 자리).
        oApply.setAttribute("data-bwp-sync-apply", "1");
        oBar.appendChild(oApply);
        oBar.appendChild(H.el("span", "u4aBwpToolSpacer"));
        oBar.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () {   // 161 컬럼최적화(auto layout 재계산).
            if (oSync.tbl) { oSync.tbl.refresh(); }
        }));
        oWrap.appendChild(oBar);

        // 테이블 호스트 + 공통 makeDataTable(비가상 — 후보 소수).
        var oHost = H.el("div", "u4aBwpSyncListHost");
        oWrap.appendChild(oHost);
        oBody.appendChild(oWrap);

        oSync.tbl = U4AUI.makeDataTable(oHost, {
            virtual: false, zebra: true,
            rowKey: function (r, i) { return r.OBJID + "|" + r.UIATK + "|" + i; },
            emptyText: H.z("312"),   // 312 No data Found.
            columns: [
                {
                    label: "", className: "u4aBwpSyncChkCol", align: "center",
                    cell: function (r) {
                        var cb = H.el("input", "u4aBwpSyncChk"); cb.type = "checkbox"; cb.checked = !!r._chk;
                        cb.addEventListener("click", function (e) { e.stopPropagation(); });     // 행 클릭 선택과 분리.
                        cb.addEventListener("change", function () { r._chk = cb.checked; });
                        return cb;
                    }
                },
                { label: H.z("190"), key: "OBJID" },   // UI Object ID.
                { label: H.z("191"), key: "UIATT" },   // Attribute ID.
                { label: H.z("178"), key: "UIATV" },   // Value(=바인딩 필드).
                { label: H.z("194"), key: "UILIB" },   // UI Object Module.
                { label: H.z("195"), key: "UIOBK" },   // UI Object Key.
                { label: H.z("196"), key: "POBID" },   // Parent UI Object ID.
                { label: H.z("197"), key: "PUIOK" }    // Parent Object Module.
            ]
        });
        oSync.tbl.setRows(oSync.aList || []);
    }

    // 선택(체크)된 후보 수집 — 원본 _getSelectedData(synchronizionBind.js:184) 대응. S4 일괄적용이 소비.
    oAPP.fn.getSyncSelectedRows = function () {
        return (oSync.aList || []).filter(function (r) { return r._chk === true; });
    };

    /************************************************************************
     * [S1b §5.2] 동일속성 화면 진입 — 원본 start(4)+designView 툴바부(892) + onSynchronizionBind 부수효과.
     *   sTree = 선택한 바인딩 속성행(원본 is_attr = S_ATTR), aList = 동일속성 후보(getSameAttrList).
     ************************************************************************/
    oAPP.fn.openSyncBindScreen = function (sTree, aList) {
        oSync.S_ATTR = sTree;
        oSync.aList = aList;

        // ── 페이지 골격 ──
        var page = H.el("div", "u4aBwpSyncRoot");

        // 상단 툴바: [뒤로 189] · [동일속성 적용 팝업 호출 140 — S5까지 비활성] · Spacer · [도움말 198].
        var tool = H.el("div", "u4aBwpTool u4aBwpSyncTool");
        tool.appendChild(_btn("arrow-left", H.z("189"), H.z("189"), "u4a-btn--emphasized", function () {   // 189 Back
            oAPP.fn.onSyncMoveDesignPage();
        }));
        var oPopBtn = _btn("up-right-from-square", H.z("140"), H.z("140"), "u4a-btn--emphasized", null);    // 140 팝업 호출
        oPopBtn.disabled = true;   // S5 까지 비활성(원본 onCallSyncBindPopup 자리).
        oPopBtn.setAttribute("data-bwp-sync-popup", "1");
        tool.appendChild(oPopBtn);
        tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
        tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            // [B4] 동일속성 화면 도움말 문서 "000277"(원본 synchronizionBind.js:796). 영역별 라우팅.
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp("000277"); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));
        page.appendChild(tool);

        // 본문(상단 패널 = S2 / 하단 후보 테이블 = S3 이 이 컨테이너에 렌더).
        var body = H.el("div", "u4aBwpSyncBody");
        oSync.body = body;
        page.appendChild(body);

        // 상단 패널(선택 속성 4줄 + 추가속성 값) — S2 / 하단 후보 테이블(7컬럼 멀티선택) — S3.
        _renderSyncPanel(body);
        _renderSyncList(body);

        oSync.page = page;

        // ── 가운데 영역 슬라이드 진입(forward) ──
        oAPP.fn.designSwapToPage(page, false);

        // ── 진입 부수효과(원본 designTree.js onSynchronizionBind:2656~2670 순서) ──
        oAPP.fn.setAdditBindButtonEnable(false);       // 2656 우측 바인딩 버튼 비활성.
        oAPP.fn.setLayoutCustomizingEditable(false);   // 2657 우측 기어 비활성.
        oAPP.attr.bSyncEqualityScreenActive = true;    // 2658 화면 활성 플래그.
        if (typeof oAPP.fn.clearSelectAdditBind === "function") { oAPP.fn.clearSelectAdditBind(); }   // 2662 추가속성 선택 초기화.
        if (typeof oAPP.fn.setAdditLayout === "function") { oAPP.fn.setAdditLayout(""); }             // 2666 중앙하단 addit 패널 비움.
        oAPP.fn.setViewEditable(false);                // 2670 메인(중앙하단 적용/좌측 갱신/좌측 기어) 비활성.

        // ── 진입 busy off(원본 onViewReady:430) — 렌더/슬라이드 안정 후(rAF 2틱, busy 페이드 조기해제 방지) ──
        //   ★별창 로컬 busy 만 끄고 WS20 busy 는 유지(화면 동안 WS20 잠금 — 뒤로/적용완료 시 해제).
        //   원본 setBusyWS20Interaction(false)[sOption 없음] = WS20 방송 안 함(index.js:3550 sOption 조건).
        //   HTML5 setBusyWS20Interaction(false) 는 방송돼버리므로, 설계 관례(designArea.js:312)대로
        //   setBusy(false,{ISBROAD:true})로 로컬만 끈다(WS20 BUSY_OFF 미방송).
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                oAPP.fn.setBusy(false, { ISBROAD: true });
            });
        });
    };

    /************************************************************************
     * [S1b] 뒤로 — 원본 onMoveDesignPage(synchronizionBind.js:623).
     *   busy 채널 비대칭 그대로: ON = setBusy(true)(627) / OFF = setBusyWS20Interaction(false,{})(651).
     ************************************************************************/
    oAPP.fn.onSyncMoveDesignPage = async function () {
        if (typeof oAPP.fn.closeMessagePopover === "function") { oAPP.fn.closeMessagePopover(); }
        oAPP.fn.setBusy(true);
        if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }

        // 디자인 트리로 슬라이드 복귀(원본 moveDesignPage) — teardown 포함.
        await oAPP.fn.moveDesignPage();

        // 복원 4종(§5.6 — 진입의 정확한 역).
        oAPP.fn.setAdditBindButtonEnable(true);
        oAPP.fn.setLayoutCustomizingEditable(true);
        oAPP.attr.bSyncEqualityScreenActive = false;
        oAPP.fn.setViewEditable(true);

        // busy off(원본 651 — WS20 채널).
        oAPP.fn.setBusyWS20Interaction(false, {});
    };

})();
