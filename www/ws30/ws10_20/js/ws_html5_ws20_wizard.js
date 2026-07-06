/************************************************************************
 * ws_html5_ws20_wizard.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — UI Template Wizard 디자인 통합]
 *  원본 design/js/designCallWizardPopup.js 는 위자드 트리거(designCallWizardPopup)
 *  + 생성 통합(designWizardCallback / designWizardFinish) + 생성 헬퍼
 *  (createUiLine / setUiAttr / designWizardMTable / UiTable / UiTreeTable /
 *   UiLayotForm01 / UiLayotSimpleForm / 검색·결과 panel) 를 담는다.
 *
 *  생성 헬퍼(createUiLine 등)는 순수 데이터 구성 + 미리보기 iframe
 *  (oAPP.attr.ui.frame.contentWindow.addUIObjPreView) 라 HTML5 에서 그대로 재사용.
 *  UI5 의존부만 override:
 *    · designCallWizardPopup : oLTree1(TreeTable) 선택 → HTML5 선택 노드
 *      (oAPP.attr.ws20SelectedObjid → oAPP.fn.getTreeData).
 *    · designWizardCallback  : undo=saveActionHistoryData(별도 스택) →
 *      HTML5 단일스택 fnWs20PushUndo. 후속=designWizardFinish(HTML5).
 *    · designWizardFinish    : oLTree1.getBinding()._buildTree → fnRenderDesignTree.
 *
 *  ★ 생성 헬퍼는 design/js/designCallWizardPopup.js 를 getScript 로 지연 로드해 얻는다.
 *    그 파일을 로드하면 UI5 버전 designCallWizardPopup/designWizardCallback/
 *    designWizardFinish 가 다시 정의(덮어씀) → 로드 후 _installOverrides() 로 재설치.
 *
 *  로드: library-preload.js 에서 ws_html5_ws20_dnd.js "뒤".
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var C_DESIGN_JS = "design/js/designCallWizardPopup"; // 생성 헬퍼 원본(getScript 경로)

    /* ==================================================================
     * [OVERRIDE 설치] — 파일 로드 시 + 헬퍼 지연 로드 후 재설치.
     * ================================================================== */
    function _installOverrides() {
        oAPP.fn.designCallWizardPopup = _trigger;      // 트리거(선택노드→WZD_CHKER→opener)
        oAPP.fn.designWizardCallback = _wizEntry;      // 생성 통합(HTML5)
        oAPP.fn.designWizardFinish = _wizFinish;       // 후속 갱신(HTML5)
    }

    /* ==================================================================
     * 트리거 — 위자드 팝업 호출 (원본 designCallWizardPopup, oLTree1→HTML5 선택노드)
     * ================================================================== */
    function _trigger() {

        var ls_tree = _selNode();
        if (!ls_tree) {
            _msg("E", _mw("268")); // Selected line does not exists.
            _unlock();
            return;
        }
        if (ls_tree.OBJID === "ROOT") {
            // A36 ROOT / 056 & is not the target location.
            _msg("E", _mw("056", _cl("A36")));
            _unlock();
            return;
        }

        var oFormData = new FormData();
        oFormData.append("ACTCD", "WZD_CHKER");
        oFormData.append("UIOBK", ls_tree.UIOBK);
        oFormData.append("UIOBJ", ls_tree.OBJID);
        oFormData.append("CLSID", (oAPP.attr.appInfo && oAPP.attr.appInfo.CLSID) || "");

        try {
            sendAjax(oAPP.attr.servNm + "/ui_temp_wzd", oFormData, function (param) {
                if (!param || param.RETCD !== "S") {
                    _msg("E", (param && param.RTMSG) || "");
                    _unlock();
                    return;
                }
                try { oAPP.fn.fnUiTempWizardPopupOpener(param); }
                catch (e) { console.error("[HTML5][WS20][tplwiz] open:", e && e.message ? e.message : e); _unlock(); return; }
                try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
            });
        } catch (e) {
            console.error("[HTML5][WS20][tplwiz] WZD_CHKER:", e && e.message ? e.message : e);
            _unlock();
        }
    }

    /* ==================================================================
     * 생성 통합 진입 — 헬퍼(원본 design 파일) 지연 로드 후 실행.
     *   @param {object} oReturn   위자드 결과 (uName/mName/selTab/uiDDLB 또는
     *                             {uName:"ReportTemplate", oSearch, oList})
     *   @param {function} fnCallback  결과 콜백 {SUBRC, MSG}
     * ================================================================== */
    function _wizEntry(oReturn, fnCallback) {
        if (typeof oAPP.fn.createUiLine !== "function" || typeof oAPP.fn.designWizardMTable !== "function") {
            // 생성 헬퍼 지연 로드 → UI5 버전이 designWizardCallback 등을 덮으므로 재설치.
            try {
                oAPP.fn.getScript(C_DESIGN_JS, function () {
                    _installOverrides();
                    _wizCallback(oReturn, fnCallback);
                });
            } catch (e) {
                console.error("[HTML5][WS20][tplwiz] getScript:", e && e.message ? e.message : e);
                _fail(fnCallback, "");
            }
            return;
        }
        _wizCallback(oReturn, fnCallback);
    }

    /* ==================================================================
     * 생성 통합 본체 (원본 designWizardCallback — undo/finish/선택노드 HTML5)
     * ================================================================== */
    function _wizCallback(oReturn, fnCallback) {

        // 바인딩 팝업 형제창 BUSY_ON (원본 broadcast) — 가드.
        _bindBusy("BUSY_ON");

        var ls_tree = _selNode();
        if (!ls_tree) { _bindBusy("BUSY_OFF"); _fail(fnCallback, _mw("268")); return; }

        // crtStru0014 + uName → UI OBJECT KEY 매핑 (원본 297~333).
        var ls_0014 = oAPP.fn.crtStru0014();
        var UIOBK = _uiobkOf(oReturn.uName);
        if (UIOBK) { ls_0014.UIOBK = UIOBK; }

        // aggregation 선택 팝업(공통 HTML5) → 콜백에서 생성. 취소 시 busy 해제.
        try {
            oAPP.fn.aggrSelectPopup(ls_0014, ls_tree, function (aggr) {
                _aggrCb(oReturn, ls_tree, aggr, fnCallback);
            }, undefined, undefined, function () {
                _bindBusy("BUSY_OFF");
                try { parent.setBusy && parent.setBusy(""); } catch (e) { }
            });
        } catch (e) {
            console.error("[HTML5][WS20][tplwiz] aggrSelectPopup:", e && e.message ? e.message : e);
            _bindBusy("BUSY_OFF");
            _fail(fnCallback, "");
        }
    }

    /* ---- aggregation 선택 콜백 → 실제 UI 생성 (원본 lf_aggrCallback) ---- */
    function _aggrCb(oReturn, ls_parent, aggr, fnCallback) {

        // 편집 직전 undo 스냅샷 (원본 saveActionHistoryData("WIZARD_INSERT") 대체 — HTML5 단일스택).
        try { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); } } catch (e) { }

        var l_OBJID;
        try {
            if (oReturn.uName === "ReportTemplate") {
                // MODEL 바인딩된 aggregation 에는 추가 불가 (원본 177~189).
                var oPrevP = oAPP.attr.prev && oAPP.attr.prev[ls_parent.OBJID];
                if (oPrevP && oPrevP._MODEL && typeof oPrevP._MODEL[aggr.UIATT] !== "undefined") {
                    _bindBusy("BUSY_OFF");
                    _fail(fnCallback, _mw("279")); // model binding 처리된 aggregation 에는 추가 불가
                    return;
                }
                l_OBJID = _createUI(oReturn.oSearch, aggr, ls_parent, "ReportTemplate"); // 검색조건(Form)
                _createUI(oReturn.oList, aggr, ls_parent, "ReportTemplate");             // 결과리스트(Table)
            } else {
                l_OBJID = _createUI(oReturn, aggr, ls_parent);
            }
        } catch (e) {
            console.error("[HTML5][WS20][tplwiz] createUI:", e && e.message ? e.message : e);
            _bindBusy("BUSY_OFF");
            _fail(fnCallback, "");
            return;
        }

        // 트리 행 데코 — 공통 재귀 데코레이터 4종으로 새 노드에 DnD/체크박스/아이콘/
        //   +추가·삭제(visible_add/delete) 플래그 세팅. (초기 빌드 setUIAreaEditable /
        //   P13n 드롭 ws_html5_ws20_dnd.js 1061~1070 과 동일 — 재귀형이라 부모 1회로 서브트리 전체 적용)
        //   ★직접 visible_add=true 금지 → 반드시 공통 데코 경유(ROOT/leaf 규칙 반영).
        _decorate(ls_parent);

        // 후속 처리(트리/미리보기 갱신) → 성공 콜백.
        _wizFinish(l_OBJID).then(function () {
            _bindBusy("BUSY_OFF");
            fnCallback({ SUBRC: "S", MSG: _mw("005") }); // Job finished.
        }, function (e) {
            console.error("[HTML5][WS20][tplwiz] finish:", e && e.message ? e.message : e);
            _bindBusy("BUSY_OFF");
            fnCallback({ SUBRC: "S", MSG: _mw("005") }); // 생성은 완료 — 갱신 오류도 성공 처리
        });
    }

    /* ---- uName → 생성 헬퍼 분기 (원본 lf_createUI) ---- */
    function _createUI(oPram, aggr, is_parent, sParent) {
        switch (oPram.uName) {
            case "sap.m.Table": return oAPP.fn.designWizardMTable(oPram, aggr, is_parent, sParent);
            case "sap.ui.table.Table": return oAPP.fn.designWizardUiTable(oPram, aggr, is_parent, sParent);
            case "sap.ui.table.TreeTable": return oAPP.fn.designWizardUiTreeTable(oPram, aggr, is_parent, sParent);
            case "LayoForm_01": return oAPP.fn.designWizardUiLayotForm01(oPram, aggr, is_parent, sParent);
            case "SimpleForm": return oAPP.fn.designWizardUiLayotSimpleForm(oPram, aggr, is_parent, sParent);
            default: return undefined;
        }
    }

    /* ---- uName → UI OBJECT KEY (원본 299~333) ---- */
    function _uiobkOf(sUName) {
        switch (sUName) {
            case "sap.m.Table": return "UO00447";
            case "sap.ui.table.Table": return "UO01139";
            case "sap.ui.table.TreeTable": return "UO01142";
            case "LayoForm_01": return "UO01001";
            case "SimpleForm": return "UO01010";
            case "ReportTemplate": return "UO00863";
            default: return "";
        }
    }

    /* ==================================================================
     * 후속 갱신 (원본 designWizardFinish — oLTree1._buildTree → HTML5 재렌더)
     * ================================================================== */
    function _wizFinish(OBJID) {
        return Promise.resolve()
            .then(function () {
                // 디자인 영역 모델 갱신 대기 (원본 designRefershModel).
                if (typeof oAPP.fn.designRefershModel === "function") { return oAPP.fn.designRefershModel(); }
            })
            .then(function () {
                // HTML5 트리 재렌더 (원본 oLTree1 tree binding _buildTree 대체).
                try { if (typeof oAPP.fn.fnRenderDesignTree === "function") { oAPP.fn.fnRenderDesignTree(); } } catch (e) { }
                // 추가된 UI 선택/펼침.
                if (OBJID && typeof oAPP.fn.setSelectTreeItem === "function") {
                    try { return oAPP.fn.setSelectTreeItem(OBJID); } catch (e) { }
                }
            })
            .then(function () {
                try { if (typeof oAPP.fn.setChangeFlag === "function") { oAPP.fn.setChangeFlag(); } } catch (e) { }
                // 바인딩 팝업 디자인 영역 갱신 (원본 updateBindPopupDesignData).
                try { if (typeof oAPP.fn.updateBindPopupDesignData === "function") { oAPP.fn.updateBindPopupDesignData(); } } catch (e) { }
            });
    }

    /* ==================================================================
     * 로컬 헬퍼
     * ================================================================== */
    function _selNode() {
        var sSel = oAPP.attr && oAPP.attr.ws20SelectedObjid;
        return sSel ? oAPP.fn.getTreeData(sSel) : null;
    }
    function _safe(fn) { try { fn(); } catch (e) { } }
    // 공통 트리 행 데코레이터 4종(재귀) — DnD/체크박스/아이콘/액션아이콘(+추가·삭제).
    function _decorate(oNode) {
        if (!oNode) { return; }
        _safe(function () { if (typeof oAPP.fn.setTreeDnDEnable === "function") { oAPP.fn.setTreeDnDEnable(oNode); } });
        _safe(function () { if (typeof oAPP.fn.setTreeChkBoxEnable === "function") { oAPP.fn.setTreeChkBoxEnable(oNode); } });
        _safe(function () { if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(oNode); } });
        _safe(function () { if (typeof oAPP.fn.designSetActionIcon === "function") { oAPP.fn.designSetActionIcon(oNode); } });
    }
    function _fail(fnCallback, sMsg) {
        try { if (typeof fnCallback === "function") { fnCallback({ SUBRC: "E", MSG: sMsg }); } } catch (e) { }
    }
    function _bindBusy(sPrccd) {
        try {
            var sPath = oAPP.oDesign && oAPP.oDesign.pathInfo && oAPP.oDesign.pathInfo.bindPopupBroadCast;
            if (sPath && typeof parent.require === "function") { parent.require(sPath)(sPrccd); }
        } catch (e) { }
    }
    function _cl(sCode, p1) {
        try { return oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, p1 || "", "", "", ""); }
        catch (e) { return sCode; }
    }
    function _mw(sCode, p1) {
        try { return oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", sCode, p1 || "", "", "", ""); }
        catch (e) { return sCode; }
    }
    function _msg(sType, sMsg) {
        try { parent.showMessage(window.sap || null, 10, sType, sMsg); } catch (e) { }
    }
    function _unlock() {
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
        try { parent.setBusy && parent.setBusy(""); } catch (e) { }
    }

    // 파일 로드 시 override 설치.
    _installOverrides();

})(window, window.jQuery, window.oAPP);
