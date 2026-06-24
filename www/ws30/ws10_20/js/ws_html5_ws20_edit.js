/************************************************************************
 * ws_html5_ws20_edit.js  (HTML5)
 * ----------------------------------------------------------------------
 * WS20 좌측 디자인 트리의 "UI 편집" 기능 — 우클릭 컨텍스트 메뉴 + 행 액션(+/삭제)
 *   핸들러를 HTML5 로 이식한다. (구 design/js/uiDesignArea.js / callDesignContextMenu.js
 *   는 UI5 파일이라 메인 렌더러에 미로드 → 여기서 sap-free 로 재구현.)
 *
 *   · 트리 데이터(oAPP.attr.oModel.oData.zTREE) 직접 조작 + 모델 refresh(→fnRenderDesignTree)
 *   · 미리보기(Preview iframe = UI5 KEEP)의 createUIInstance/moveUIObjPreView/destroyUIPreView
 *     호출은 try/catch 가드(iframe 미로드/함수 부재 시 트리만 갱신).
 *   · 변경 시 setChangeFlag + 앱헤더(Active→Inactive) 갱신.
 *   · 모든 oAPP.fn.* 는 가드 정의(원본 UI5 가 로드된 환경이면 그쪽 우선).
 *
 *   [Phase 1] 컨텍스트 메뉴 + 삭제/이동(Up/Down)/복사/붙여넣기.
 *   [Phase 2 예정] UI 삽입 팝업(insert-UI: aggregation 선택 + UI 카탈로그) — 현재 안내.
 ************************************************************************/
(function (window, oAPP) {
    "use strict";

    oAPP.fn = oAPP.fn || {};
    oAPP.attr = oAPP.attr || {};
    var APPCOMMON = oAPP.common || (oAPP.common = {});

    var COPY_AREA = "U4AWSuiDesignArea"; // setCopyData/getCopyData 키 (원본 동일)

    // 언어 = 서버 메시지 클래스 단일 출처(원본 동일). 내부 영문 폴백 보관 금지(2026-06-16 지시).
    function _msg(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _msgWs(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _footer(sType, sMsg) {
        try { APPCOMMON.fnShowFloatingFooterMsg(sType, "WS20", sMsg); } catch (e) { }
    }
    function _isEdit() {
        try { return oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { return false; }
    }
    function _tree() {
        try { return oAPP.attr.oModel.oData.zTREE || []; } catch (e) { return []; }
    }
    // 노드 찾기 (HTML5 getTreeData 우선, 없으면 자체 재귀)
    function _node(sObjid) {
        try { if (typeof oAPP.fn.getTreeData === "function") { return oAPP.fn.getTreeData(sObjid); } } catch (e) { }
        var found = null;
        (function walk(arr) {
            if (!arr || found) { return; }
            for (var i = 0; i < arr.length; i++) {
                if (arr[i].OBJID === sObjid) { found = arr[i]; return; }
                walk(arr[i].zTREE);
            }
        })(_tree());
        return found;
    }
    function _refreshTree() {
        try { oAPP.attr.oModel.refresh(); } catch (e) { }       // → fnRenderDesignTree 훅
        try { if (oAPP.fn.fnRenderDesignTree) { oAPP.fn.fnRenderDesignTree(); } } catch (e) { }
    }
    function _markChanged() {
        try { if (typeof oAPP.fn.setChangeFlag === "function") { oAPP.fn.setChangeFlag(); } } catch (e) { }
        try { APPCOMMON.fnSetModelProperty && APPCOMMON.fnSetModelProperty("/WS20/APP/IS_CHAG", "X"); } catch (e) { }
        try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }
    }
    function _selectNode(sObjid) {
        try { if (typeof oAPP.fn.setSelectTreeItem === "function") { oAPP.fn.setSelectTreeItem(sObjid); } } catch (e) { }
    }
    // 미리보기 iframe 함수 안전 호출 (UI5 preview KEEP — 부재 시 무시)
    function _prev(fnName, aArgs) {
        try {
            var w = oAPP.attr.ui && oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow;
            if (w && typeof w[fnName] === "function") { w[fnName].apply(w, aArgs || []); return true; }
        } catch (e) { }
        return false;
    }

    // 행 액션 아이콘(+추가/삭제) 표시 플래그 계산 (구 uiDesignArea.js designSetActionIcon 1860 1:1)
    //   setUIAreaEditable 이 _safeDecorate("designSetActionIcon", root) 로 호출 → visible_add/delete 세팅.
    //   규칙: Change 모드(IS_EDIT)만 노출, ROOT=둘다 없음, APP=추가만, 그외=추가+삭제. (재귀)
    if (typeof oAPP.fn.designSetActionIcon !== "function") {
        oAPP.fn.designSetActionIcon = function (is_tree) {
            if (!is_tree) { return; }
            var bEdit = false;
            try { bEdit = oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { }
            is_tree.visible_add = bEdit;
            is_tree.visible_delete = bEdit;
            if (is_tree.OBJID === "ROOT") { is_tree.visible_add = false; is_tree.visible_delete = false; }
            else if (is_tree.OBJID === "APP") { is_tree.visible_delete = false; }
            if (!is_tree.zTREE || !is_tree.zTREE.length) { return; }
            for (var i = 0; i < is_tree.zTREE.length; i++) { oAPP.fn.designSetActionIcon(is_tree.zTREE[i]); }
        };
    }

    /********************************************************************
     * Undo / Redo (스냅샷 기반) — 원본 undoRedo 모듈(action별 클래스, design 모듈 의존)을
     *   대체. 편집 직전 zTREE + prev._T_0015 + IS_CHAG 스냅샷을 쌓고, undo 시 복원 + 트리
     *   재렌더 + 프리뷰 drawPreview(가드). 삽입/삭제/이동/복사붙여넣기에 균일 적용.
     ********************************************************************/
    var _undoStack = [], _redoStack = [], _UNDO_MAX = 50;

    function _snapshot() {
        var z = [];
        try { z = JSON.parse(JSON.stringify(_tree())); } catch (e) { }
        var t15 = {};
        try {
            var p = oAPP.attr.prev || {};
            for (var k in p) { if (p[k] && p[k]._T_0015) { try { t15[k] = JSON.parse(JSON.stringify(p[k]._T_0015)); } catch (e2) { } } }
        } catch (e) { }
        var chag = ""; try { chag = (parent.getAppInfo() || {}).IS_CHAG || ""; } catch (e) { }
        var sel = ""; try { sel = (oAPP.attr.oModel.oData.uiinfo && oAPP.attr.oModel.oData.uiinfo.OBJID) || ""; } catch (e) { }
        return { z: z, t15: t15, chag: chag, sel: sel };
    }
    function _restoreSnap(s) {
        if (!s) { return; }
        try { oAPP.attr.oModel.oData.zTREE = JSON.parse(JSON.stringify(s.z)); } catch (e) { }
        try {
            oAPP.attr.prev = oAPP.attr.prev || {};
            for (var k in s.t15) { oAPP.attr.prev[k] = oAPP.attr.prev[k] || {}; oAPP.attr.prev[k]._T_0015 = JSON.parse(JSON.stringify(s.t15[k])); }
        } catch (e) { }
        _refreshTree();
        // 프리뷰 전체 재구성(UI5 iframe 가드 — 부재 시 트리만)
        _prev("drawPreview", []);
        // IS_CHAG/상태 복원
        try { var oi = parent.getAppInfo(); if (oi) { oi.IS_CHAG = s.chag; parent.setAppInfo(oi); } } catch (e) { }
        try { oAPP.common.fnSetModelProperty("/WS20/APP/IS_CHAG", s.chag); } catch (e) { }
        try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }
        if (s.sel) { _selectNode(s.sel); }
        _updateUndoBtns();
    }
    // 편집 직전 호출 — 현재 상태를 undo 스택에 적재(+redo 비움).
    oAPP.fn.fnWs20PushUndo = function () {
        _undoStack.push(_snapshot());
        if (_undoStack.length > _UNDO_MAX) { _undoStack.shift(); }
        _redoStack = [];
        _updateUndoBtns();
    };
    // 트리 툴바/단축키 진입점 (구 undoRedo.executeHistory("UNDO"/"REDO"))
    oAPP.fn.fnWs20ExecHistory = function (sMode) {
        if (sMode === "UNDO") {
            if (!_undoStack.length) { return; }
            _redoStack.push(_snapshot());
            _restoreSnap(_undoStack.pop());
        } else {
            if (!_redoStack.length) { return; }
            _undoStack.push(_snapshot());
            _restoreSnap(_redoStack.pop());
        }
    };
    oAPP.fn.fnWs20ClearHistory = function () { _undoStack = []; _redoStack = []; _updateUndoBtns(); };
    oAPP.fn.fnWs20CanUndo = function () { return _undoStack.length > 0; };
    oAPP.fn.fnWs20CanRedo = function () { return _redoStack.length > 0; };
    // undo/redo 버튼 활성/비활성 갱신 (tree.js 가 data-uract 마커 부여)
    function _updateUndoBtns() {
        try {
            var u = document.querySelector('[data-uract="UNDO"]'), r = document.querySelector('[data-uract="REDO"]');
            if (u) { u.disabled = !_undoStack.length; }
            if (r) { r.disabled = !_redoStack.length; }
        } catch (e) { }
    }
    oAPP.fn.fnWs20UpdateUndoBtns = _updateUndoBtns;

    // OBJID 채번 (구 uiDesignArea.js setOBJID 1:1 — 붙여넣기/삽입용)
    if (typeof oAPP.fn.setOBJID !== "function") {
        oAPP.fn.setOBJID = function (objid) {
            var l_cnt = 1;
            var l_upper = String(objid || "UI").toUpperCase();
            var l_objid = l_upper + l_cnt;
            var lt_0014 = (typeof oAPP.fn.parseTree2Tab === "function")
                ? oAPP.fn.parseTree2Tab(oAPP.attr.oModel.oData.zTREE) : [];
            while (true) {
                if (lt_0014.findIndex(function (a) { return a.OBJID === l_objid; }) === -1) { return l_objid; }
                l_cnt += 1; l_objid = l_upper + l_cnt;
            }
        };
    }

    // 파라메터(&1) 치환 메시지 (구 fnGetMsgClsText 3rd arg)
    function _msgWsP(sNum, p1, sFallback) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum, p1);
            if (s != null && s !== "") { return s; }
        } catch (e) { }
        return sFallback;
    }

    /********************************************************************
     * 노드 미리보기 정리 (구 lf_delSelLine 의 preview 정리부 — 시그니처 1:1)
     *   setChildUiException(부모 필수자식 보강) → delUIObjPreView → destroyUIPreView
     *   → oAPP.attr.prev 제거. (단건/멀티 삭제 공용)
     ********************************************************************/
    function _removeNodePreview(n) {
        if (!n) { return; }
        // 삭제 노드의 부모가 "자식 필수" UI(UA050)인데 자식이 사라지면 기본 자식 강제 셋업(구 4385, bIgnore=true)
        _prev("setChildUiException", [n.PUIOK, n.POBID, undefined, undefined, true]);
        // 미리보기에서 제거 (구 delUIObjPreView(OBJID,POBID,PUIOK,UIATT,ISMLB,UIOBK))
        _prev("delUIObjPreView", [n.OBJID, n.POBID, n.PUIOK, n.UIATT, n.ISMLB, n.UIOBK]);
        // 미리보기 인스턴스 destroy (구 destroyUIPreView(OBJID,POBID,UIOBK,PUIOK) — 자식 재귀 정리)
        _prev("destroyUIPreView", [n.OBJID, n.POBID, n.UIOBK, n.PUIOK]);
        try { if (oAPP.attr.prev) { delete oAPP.attr.prev[n.OBJID]; } } catch (e) { }
    }

    /********************************************************************
     * 삭제 (구 designUIDelete) — 확인 후 부모 zTREE 에서 노드 제거.
     ********************************************************************/
    function _deleteUI(oNode) {
        if (!oNode || !_isEdit()) { return; }
        if (oNode.OBJID === "ROOT" || oNode.OBJID === "APP") { return; }

        var sMsg = _msgWs("003", "Do you really want to delete?");
        var fnConfirm = APPCOMMON.fnConfirmBox;
        function lf_do(act) {
            if (act !== "YES") { return; }
            var oParent = _node(oNode.POBID);
            if (!oParent || !oParent.zTREE) { return; }
            oAPP.fn.fnWs20PushUndo();
            // 미리보기 제거(가드, 시그니처 1:1)
            _removeNodePreview(oNode);
            // 부모 배열에서 제거
            var idx = oParent.zTREE.findIndex(function (a) { return a.OBJID === oNode.OBJID; });
            if (idx !== -1) { oParent.zTREE.splice(idx, 1); }
            _refreshTree();
            _selectNode(oParent.OBJID);
            _markChanged();
        }
        if (typeof fnConfirm === "function") { fnConfirm("I", sMsg, lf_do); }
        else { lf_do(window.confirm(sMsg) ? "YES" : "NO"); }
    }

    /********************************************************************
     * 체크박스 (Change 모드 멀티선택 삭제) — 구 uiDesignArea.js 1:1 이식.
     *   데이터 로더/ setUIAreaEditable 이 _safeDecorate("setTreeChkBoxEnable") 로 호출.
     *   트리(ws_html5_ws20_tree.js)가 chk_visible/chk 로 체크박스 렌더 + designTreeSelChkbox 호출.
     ********************************************************************/
    // UI 아이콘 데코레이터 (구 setTreeUiIcon 1645) — T_0022 에서 UIOBK 로 UICON 조회 →
    //   fnGetSapIconPath(...icons/x.gif) → icon_visible 토글, 재귀. ROOT/APP 등 T_0022 미존재 노드는
    //   UICON 없으면 icon_visible=false. 로더(_safeDecorate)·designAddUIObject(insert) 공용 단일 소스.
    if (typeof oAPP.fn.setTreeUiIcon !== "function") {
        oAPP.fn.setTreeUiIcon = function (is_tree) {
            if (!is_tree) { return; }
            // aggregation 아이콘(가드 — HTML5 미구현 시 skip)
            try { if (typeof oAPP.fn.setTreeAggrIcon === "function") { oAPP.fn.setTreeAggrIcon(is_tree); } } catch (e) { }
            // UI 아이콘 — T_0022.UICON → 경로 변환(구 1654, 항상 재계산)
            try {
                var T22 = _LIB().T_0022 || [];
                var ls = T22.find(function (a) { return a.UIOBK === is_tree.UIOBK; });
                if (ls && ls.UICON && ls.UICON !== "" && typeof oAPP.fn.fnGetSapIconPath === "function") {
                    is_tree.UICON = oAPP.fn.fnGetSapIconPath(ls.UICON) || is_tree.UICON;
                }
            } catch (e) { }
            is_tree.icon_visible = !!(is_tree.UICON && is_tree.UICON !== "");
            if (is_tree.zTREE) {
                for (var i = 0; i < is_tree.zTREE.length; i++) { oAPP.fn.setTreeUiIcon(is_tree.zTREE[i]); }
            }
        };
    }
    // 체크박스 활성여부 (구 setTreeChkBoxEnable 1759) — IS_EDIT && ROOT/APP 제외, chk 초기화. 재귀.
    if (typeof oAPP.fn.setTreeChkBoxEnable !== "function") {
        oAPP.fn.setTreeChkBoxEnable = function (is_tree) {
            if (!is_tree) { return; }
            var bEdit = _isEdit();
            is_tree.chk = false;
            is_tree.chk_visible = bEdit && is_tree.OBJID !== "ROOT" && is_tree.OBJID !== "APP";
            if (is_tree.zTREE) {
                for (var i = 0; i < is_tree.zTREE.length; i++) { oAPP.fn.setTreeChkBoxEnable(is_tree.zTREE[i]); }
            }
        };
    }
    // 체크박스 토글 전파 (구 designTreeSelChkbox 3613) — 하위 전체 동기화 + 해제 시 조상 해제.
    if (typeof oAPP.fn.designTreeSelChkbox !== "function") {
        oAPP.fn.designTreeSelChkbox = function (is_tree) {
            if (!is_tree) { return; }
            var bChk = is_tree.chk === true;
            (function setAll(n) {
                n.chk = bChk;
                if (n.zTREE) { for (var i = 0; i < n.zTREE.length; i++) { setAll(n.zTREE[i]); } }
            })(is_tree);
            // 체크 해제 시: 부분선택이 된 조상들의 전체체크 상태 해제
            if (!bChk) {
                var p = _node(is_tree.POBID);
                while (p) { p.chk = false; p = _node(p.POBID); }
            }
            _refreshTree();
        };
    }
    // 체크박스 전체 해제 (구 designClearCheckAll 1793)
    if (typeof oAPP.fn.designClearCheckAll !== "function") {
        oAPP.fn.designClearCheckAll = function () {
            (function clr(arr) {
                if (!arr) { return; }
                for (var i = 0; i < arr.length; i++) { arr[i].chk = false; clr(arr[i].zTREE); }
            })(_tree());
            _refreshTree();
        };
    }
    // 멀티 삭제 (구 designTreeMultiDeleteItem 4353) — 체크된 UI 일괄 삭제.
    if (typeof oAPP.fn.designTreeMultiDeleteItem !== "function") {
        oAPP.fn.designTreeMultiDeleteItem = function () {
            if (!_isEdit()) { return; }

            // 체크된 노드 수집 (ROOT/APP 제외)
            var aChecked = [];
            (function collect(arr) {
                if (!arr) { return; }
                for (var i = 0; i < arr.length; i++) {
                    var n = arr[i];
                    if (n.chk === true && n.OBJID !== "ROOT" && n.OBJID !== "APP") { aChecked.push(n); }
                    collect(n.zTREE);
                }
            })(_tree());

            // 체크건 없음 → 안내 (구 286 Check box not selected.)
            if (aChecked.length === 0) {
                try { parent.showMessage(null, 10, "I", _msgWs("286", "Check box not selected.")); } catch (e) { }
                return;
            }

            // 삭제 후 선택할 라인(첫 체크 노드의 부모 — 삭제되면 ROOT)
            var sSelAfter = (aChecked[0] && aChecked[0].POBID) || "ROOT";

            // 확인: 378 &1 rows has been selected. + 003 Do you really want to delete?
            var sMsg = _msgWsP("378", aChecked.length, aChecked.length + " rows has been selected.") +
                "\n" + _msgWs("003", "Do you really want to delete?");
            var fnConfirm = APPCOMMON.fnConfirmBox;

            function lf_do(act) {
                if (act !== "YES") { return; }
                oAPP.fn.fnWs20PushUndo();
                // bottom-up(자식 먼저) 재귀 삭제 — 구 lf_delSelLine: chk===true 노드만 제거.
                (function del(arr) {
                    if (!arr) { return; }
                    for (var i = arr.length - 1; i >= 0; i--) {
                        var n = arr[i];
                        del(n.zTREE);                 // 자식 먼저
                        if (n.chk !== true) { continue; }
                        _removeNodePreview(n);
                        arr.splice(i, 1);
                    }
                })(_tree());
                if (!_node(sSelAfter)) { sSelAfter = "ROOT"; }
                _refreshTree();
                _selectNode(sSelAfter);
                _markChanged();
                // 원본 designTreeMultiDeleteItem 4541행: 005 "Job finished." (구 showMessage 팝업 → HTML5 footer)
                _footer("S", _msgWs("005", "Job finished."));
            }
            if (typeof fnConfirm === "function") { fnConfirm("I", sMsg, lf_do); }
            else { lf_do(window.confirm(sMsg) ? "YES" : "NO"); }
        };
    }

    /********************************************************************
     * 위/아래 이동 (구 contextMenuUiMove) — 형제 배열 내 순서 변경.
     *   sDir: "-" 위로 / "+" 아래로
     ********************************************************************/
    function _moveUI(oNode, sDir) {
        if (!oNode || !_isEdit()) { return; }
        var oParent = _node(oNode.POBID);
        if (!oParent || !oParent.zTREE) { return; }
        var aSib = oParent.zTREE;
        var idx = aSib.findIndex(function (a) { return a.OBJID === oNode.OBJID; });
        if (idx === -1) { return; }
        var newIdx = (sDir === "-") ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= aSib.length) { return; } // 경계
        oAPP.fn.fnWs20PushUndo();
        aSib.splice(idx, 1);
        aSib.splice(newIdx, 0, oNode);
        _refreshTree();
        // 미리보기 순서 반영(가드) — 시그니처: (OBJID, UILIB, POBID, PUIOK, UIATT, POSIT, ISMLB, UIOBK)
        _prev("moveUIObjPreView", [oNode.OBJID, oNode.UILIB, oNode.POBID, oNode.PUIOK, oNode.UIATT, newIdx, oNode.ISMLB, oNode.UIOBK]);
        _selectNode(oNode.OBJID);
        _markChanged();
    }

    /********************************************************************
     * 복사 (구 contextMenuUiCopy) — 노드+속성 깊은복사 → copy 버퍼.
     ********************************************************************/
    function _copyUI(oNode) {
        if (!oNode) { return; }
        if (oNode.OBJID === "ROOT" || oNode.OBJID === "APP") { return; }
        var clone;
        try { clone = JSON.parse(JSON.stringify(oNode)); } catch (e) { return; }
        // 각 노드의 속성(_T_0015) 동봉 (prev 에서 수집)
        (function attach(n) {
            try {
                var p = oAPP.attr.prev && oAPP.attr.prev[n.OBJID];
                n._T_0015 = (p && p._T_0015) ? JSON.parse(JSON.stringify(p._T_0015)) : [];
            } catch (e) { n._T_0015 = []; }
            if (n.zTREE) { for (var i = 0; i < n.zTREE.length; i++) { attach(n.zTREE[i]); } }
        })(clone);
        try {
            if (typeof oAPP.fn.setCopyData === "function") { oAPP.fn.setCopyData(COPY_AREA, [COPY_AREA], clone); }
            else { oAPP.attr.__ws20Copy = clone; }
            // (원본 contextMenuUiCopy 는 완료 토스트 없음)
        } catch (e) { }
    }
    function _getCopy() {
        try {
            if (typeof oAPP.fn.getCopyData === "function") {
                var r = oAPP.fn.getCopyData(COPY_AREA);
                return (r && r[0] && r[0].DATA) ? r[0].DATA : null;
            }
        } catch (e) { }
        return oAPP.attr.__ws20Copy || null;
    }

    /********************************************************************
     * 붙여넣기 (구 contextMenuUiPaste, 간소화) — 복사본을 대상 노드 자식으로 삽입.
     *   OBJID 는 setOBJID 로 전부 재채번. 미리보기 생성은 가드(부재 시 트리만).
     ********************************************************************/
    function _pasteUI(oTarget) {
        if (!oTarget || !_isEdit()) { return; }
        var src = _getCopy();
        if (!src) { return; } // 복사본 없으면 무동작(원본은 메뉴 enab07 로 Paste 비활성)
        var clone;
        try { clone = JSON.parse(JSON.stringify(src)); } catch (e) { return; }

        // OBJID 재채번(재귀) + 부모관계 재설정
        (function regen(n, sPobid, sPuiok) {
            n.OBJID = oAPP.fn.setOBJID(n.UIOBJ || n.OBJID || "UI");
            n.POBID = sPobid;
            if (sPuiok != null) { n.PUIOK = sPuiok; }
            if (n.zTREE) { for (var i = 0; i < n.zTREE.length; i++) { regen(n.zTREE[i], n.OBJID, n.UIOBK); } }
        })(clone, oTarget.OBJID, oTarget.UIOBK);

        oAPP.fn.fnWs20PushUndo();
        if (!oTarget.zTREE) { oTarget.zTREE = []; }
        oTarget.zTREE.push(clone);

        // 복사해온 속성을 prev 에 반영(가드)
        (function restore(n) {
            try {
                if (oAPP.attr.prev && n._T_0015) {
                    oAPP.attr.prev[n.OBJID] = oAPP.attr.prev[n.OBJID] || {};
                    oAPP.attr.prev[n.OBJID]._T_0015 = n._T_0015;
                }
            } catch (e) { }
            delete n._T_0015;
            if (n.zTREE) { for (var i = 0; i < n.zTREE.length; i++) { restore(n.zTREE[i]); } }
        })(clone);

        _refreshTree();
        // 미리보기 생성(가드)
        _prev("createUIInstance", [clone, (oAPP.attr.prev && oAPP.attr.prev[clone.OBJID] && oAPP.attr.prev[clone.OBJID]._T_0015) || []]);
        _selectNode(clone.OBJID);
        _markChanged();
        // (원본 contextMenuUiPaste 는 완료 토스트 없음)
    }

    /********************************************************************
     * [PUBLIC] 행 액션/메뉴 핸들러 — 트리 +/삭제 버튼이 호출(designUIAdd/Delete).
     *   원본 UI5 가 미로드일 때만 정의(가드).
     ********************************************************************/
    if (typeof oAPP.fn.designUIDelete !== "function") {
        oAPP.fn.designUIDelete = function (oNode) { _deleteUI(oNode); };
    }
    /********************************************************************
     * [Phase 2] UI 삽입 — 카탈로그(추가가능 aggregation/UI) + 팝업 + designAddUIObject.
     *   가이드(.analy WS20 §10/§17): 추가가능 판정은 공통코드(T_0023/T_0022/T_0027/
     *   UW10/UW03/UW08) 기준, 검증(checkDeny/Allow/cardinality) 우회 금지, 텍스트 미하드코딩,
     *   Tree↔Preview 동기화(createUIInstance/moveUIObjPreView 가드).
     ********************************************************************/
    function _LIB() { return (oAPP.DATA && oAPP.DATA.LIB) || {}; }
    function _SCODE() { return (oAPP.attr && oAPP.attr.S_CODE) || {}; }

    // 추가 불가 child aggregation (구 exceptionUI.checkDenyChildAggr — UW08, 1:1 이식)
    if (typeof oAPP.fn.checkDenyChildAggr !== "function") {
        oAPP.fn.checkDenyChildAggr = function (oParam) {
            var UW08 = _SCODE().UW08;
            if (!UW08) { return false; }
            if (!oParam || !oParam.UIOBK || !oParam.UIATT || !oParam.CHILD_UIOBK) { return false; }
            var f = UW08.findIndex(function (i) {
                return i.FLD01 === oParam.UIOBK && i.FLD03 === oParam.UIATT && i.FLD04 === oParam.CHILD_UIOBK && i.FLD06 !== "X";
            });
            return f !== -1;
        };
    }
    // 허용 child aggregation (구 exceptionUI.checkAllowChildAggr — UW10 + T_0027 파생, 1:1 이식)
    if (typeof oAPP.fn.checkAllowChildAggr !== "function") {
        oAPP.fn.checkAllowChildAggr = function (oParam) {
            var UW10 = _SCODE().UW10;
            if (!UW10) { return true; }
            if (!oParam || !oParam.PUIOK || !oParam.UIOBK || !oParam.UIATT) { return true; }
            var aUW10 = UW10.filter(function (i) { return i.FLD01 === oParam.PUIOK && i.FLD03 === oParam.UIATT && i.FLD06 !== "X"; });
            if (aUW10.length === 0) { return true; }
            var T_0022 = _LIB().T_0022 || [], T_0027 = _LIB().T_0027 || [];
            for (var i = 0; i < aUW10.length; i++) {
                var u = aUW10[i];
                if (u.FLD04 === oParam.UIOBK) { return true; }
                if (u.FLD07 !== "X") { continue; }
                var s22 = T_0022.find(function (a) { return a.UIOBK === u.FLD04; });
                if (!s22) { continue; }
                var TOBTY = (s22.OBJTY === "3") ? "4" : "3";
                if (T_0027.some(function (a) { return a.SGOBJ === u.FLD04 && a.TGOBJ === oParam.UIOBK && a.TOBTY === TOBTY; })) { return true; }
            }
            return false;
        };
    }
    // UW03: 특정 부모/aggregation 에만 추가 가능 (designChkFixedParentUI 와 동일 기준)
    function _checkUW03(childUIOBK, parentUIOBK, aggName) {
        var UW03 = _SCODE().UW03;
        if (!UW03) { return true; }
        var a = UW03.filter(function (i) { return i.FLD01 === childUIOBK && i.FLD06 !== "X"; });
        if (a.length === 0) { return true; }
        return a.some(function (i) { return i.FLD03 === parentUIOBK && i.FLD05 === aggName; });
    }
    // cardinality (구 callDesignContextMenu.chkUiCardinality — 0:1 aggr 중복 방지, 1:1 이식)
    if (typeof oAPP.fn.chkUiCardinality !== "function") {
        oAPP.fn.chkUiCardinality = function (is_parent, UIATK, ISMLB) {
            if (!is_parent || !is_parent.zTREE || is_parent.zTREE.length === 0) { return; }
            var idx = is_parent.zTREE.findIndex(function (a) { return a.UIATK === UIATK; });
            if (ISMLB === "" && idx !== -1) {
                try { parent.showMessage(null, 10, "W", _msgWs("022", "Can not specify more than one object in the corresponding Aggregation.")); } catch (e) { }
                return true;
            }
            if (ISMLB === "X") {
                var s15 = null;
                try { s15 = oAPP.attr.prev[is_parent.OBJID]._T_0015.find(function (a) { return a.UIATK === UIATK && a.UIATY === "3"; }); } catch (e) { }
                if (s15 && s15.UIATV !== "" && s15.ISBND === "X" && idx !== -1) {
                    try { parent.showMessage(null, 10, "W", _msgWs("021", "The object is already specified in Aggregation.")); } catch (e) { }
                    return true;
                }
            }
        };
    }

    // 카탈로그: 부모 UIOBK 의 추가가능 aggregation 목록
    function _getAggregations(parentUIOBK) {
        var T_0023 = _LIB().T_0023 || [];
        return T_0023.filter(function (r) { return r.UIOBK === parentUIOBK && r.UIATY === "3" && r.ISDEP !== "X"; });
    }
    // 카탈로그: 선택 aggregation 에 추가가능한 UI 목록 (T_0022/T_0027 + UW10/UW03/UW08)
    function _getUIs(aggRow, parentUIOBK) {
        var T_0022 = _LIB().T_0022 || [], T_0027 = _LIB().T_0027 || [], T_0020 = _LIB().T_0020 || [];
        if (!aggRow) { return []; }
        var base = T_0022.find(function (r) { return r.UIFND === String(aggRow.UIADT || "").toUpperCase(); });
        if (!base) { return []; }
        var rels = T_0027.filter(function (r) { return r.SGOBJ === base.UIOBK && (r.TOBTY === "3" || r.TOBTY === "4" || r.TOBTY === "5"); });
        var bAbstract = false;
        try { bAbstract = oAPP.common.checkWLOList && oAPP.common.checkWLOList("C", "UHAK900877") === true; } catch (e) { }
        var aObjTy = bAbstract ? ["1", "2", "4"] : ["1", "4"];
        var out = [], seen = {};
        for (var i = 0; i < rels.length; i++) {
            var ui = T_0022.find(function (r) { return r.UIOBK === rels[i].TGOBJ; });
            if (!ui || seen[ui.UIOBK]) { continue; }
            if (ui.ISDEP === "X" || ui.ISSTP === "X" || aObjTy.indexOf(ui.OBJTY) === -1) { continue; }
            var lib = T_0020.find(function (r) { return r.UILIK === ui.UILIK; });
            if (lib && lib.NUSED === "X") { continue; }
            if (oAPP.fn.checkDenyChildAggr({ UIOBK: parentUIOBK, UIATT: aggRow.UIATT, CHILD_UIOBK: ui.UIOBK })) { continue; }
            if (!oAPP.fn.checkAllowChildAggr({ PUIOK: parentUIOBK, UIATT: aggRow.UIATT, UIOBK: ui.UIOBK })) { continue; }
            if (!_checkUW03(ui.UIOBK, parentUIOBK, aggRow.UIATT)) { continue; }
            seen[ui.UIOBK] = 1;
            out.push(ui);
        }
        out.sort(function (a, b) { return String(a.UIOBJ).localeCompare(String(b.UIOBJ)); });
        return out;
    }

    // UI 추가 본 처리 (구 designAddUIObject 의 데이터 부분 + 가드된 프리뷰)
    if (typeof oAPP.fn.designAddUIObject !== "function") {
        oAPP.fn.designAddUIObject = function (is_tree, is_0022, is_0023, i_cnt) {
            if (!is_tree || !is_0022 || !is_0023) { return; }
            var cnt = parseInt(i_cnt, 10); if (!(cnt > 0)) { cnt = 1; }
            // 선행 검증 (cardinality — 0:1 aggregation 중복 방지)
            if (oAPP.fn.chkUiCardinality(is_tree, is_0023.UIATK, is_0023.ISMLB) === true) { return; }

            oAPP.fn.fnWs20PushUndo();

            var oInfo = {};
            try { oInfo = parent.getAppInfo() || {}; } catch (e) { }
            if (!is_tree.zTREE) { is_tree.zTREE = []; }
            var bEdit = false; try { bEdit = oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { }
            var lastObjid = "";

            for (var c = 0; c < cnt; c++) {
                var l14 = oAPP.fn.crtStru0014();
                l14.APPID = oInfo.APPID || ""; l14.GUINR = oInfo.GUINR || "";
                l14.OBJID = oAPP.fn.setOBJID(is_0022.UIOBJ || "UI");
                l14.POBID = is_tree.OBJID;
                l14.UIOBK = is_0022.UIOBK; l14.PUIOK = is_tree.UIOBK;
                l14.UIATK = is_0023.UIATK; l14.UIATT = is_0023.UIATT;
                l14.UIASN = is_0023.UIASN; l14.UIATY = is_0023.UIATY; l14.UIADT = is_0023.UIADT; l14.UIADS = is_0023.UIADS;
                l14.ISMLB = is_0023.ISMLB; l14.UIFND = is_0022.UIFND; l14.PUIATK = is_0023.UIATK;
                l14.UILIB = is_0022.LIBNM; l14.ISEXT = is_0022.ISEXT; l14.TGLIB = is_0022.TGLIB; l14.ISECP = is_0022.ISECP;
                l14.zTREE = [];
                // tree bind field (구 crtTreeBindField)
                l14.drag_enable = true; l14.drop_enable = bEdit; l14.chk_visible = bEdit; l14.chk = false;
                l14.highlight = "None"; l14.visible_add = bEdit; l14.visible_delete = bEdit;
                // UI 아이콘 + aggregation 아이콘 — 트리 로더와 동일한 공통 데코레이터 재사용.
                //   l14.UIOBK 로 T_0022 에서 UICON 조회 → fnGetSapIconPath → icon_visible 세팅.
                //   (인라인 중복 제거: insert/로드 모두 setTreeUiIcon 단일 소스 → 아이콘 일관.)
                if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(l14); }

                // embedded aggregation _T_0015 (UIATY="6", ISEMB="X")
                var s15 = oAPP.fn.crtStru0015();
                s15.APPID = l14.APPID; s15.GUINR = l14.GUINR; s15.OBJID = l14.OBJID;
                s15.UIOBK = is_0022.UIOBK; s15.UILIK = is_0022.UILIK;
                s15.UIATK = is_0023.UIATK; s15.UIATT = is_0023.UIATT; s15.UIASN = is_0023.UIASN; s15.UIADT = is_0023.UIADT;
                s15.UIATY = "6"; s15.ISMLB = is_0023.ISMLB; s15.ISEMB = "X";
                try {
                    oAPP.attr.prev = oAPP.attr.prev || {};
                    oAPP.attr.prev[l14.OBJID] = oAPP.attr.prev[l14.OBJID] || {};
                    oAPP.attr.prev[l14.OBJID]._T_0015 = [s15];
                } catch (e) { }

                // 같은 aggregation 내 위치(_posit) = 기존 동일 UIATK 형제 수
                var posit = is_tree.zTREE.filter(function (a) { return a.UIATK === is_0023.UIATK; }).length;
                is_tree.zTREE.push(l14);

                // 미리보기 동기화(UI5 preview iframe, 가드 — 부재 시 트리만). 구 designAddUIObject 순서 1:1.
                _prev("createUIInstance", [l14, [s15]]);
                _prev("setRichTextEditorException", [l14.UIOBK, l14.OBJID]);
                // ★ [필수] 자식이 강제로 필요한 UI(UA050)에 기본 자식/내부 셋업(구 5383).
                //   누락 시 컨트롤이 필수 내부(예: 내부 Image)를 못 갖춘 채 저장되고,
                //   Active 후 재진입(재로드) 때 미리보기가 그 null 을 렌더하다 _getNativeImage 오류.
                _prev("setChildUiException", [l14.UIOBK, l14.OBJID, l14.zTREE, (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA050)]);
                _prev("moveUIObjPreView", [l14.OBJID, l14.UILIB, l14.POBID, l14.PUIOK, l14.UIATT, posit, l14.ISMLB, l14.UIOBK, true]);
                // 미리보기 예외 draw(차트/IFrame 등 — uiPreviewArea 로드 시에만, 가드)
                try { if (typeof oAPP.fn.prevDrawExceptionUi === "function") { oAPP.fn.prevDrawExceptionUi(l14.UIOBK, l14.OBJID); } } catch (e) { }
                lastObjid = l14.OBJID;
            }

            _refreshTree();
            if (lastObjid) { _selectNode(lastObjid); }
            _markChanged();
            // (원본 designAddUIObject 는 완료 토스트 없음)
        };
    }

    // 트리 +버튼/컨텍스트메뉴 Insert → 삽입 팝업
    if (typeof oAPP.fn.designUIAdd !== "function") {
        oAPP.fn.designUIAdd = function (oNode) { _showInsertPopup(oNode); };
    }
    // 구 UI5 디자인 영역(uiDesignArea.js)이 designUIAdd 를 UI5 버전으로 덮어쓰더라도
    // 부트스트랩 삽입 팝업(.u4a-dialog)을 호출할 수 있도록 안정적 핸들로 항상 노출.
    // (WS20 디자인 다이얼로그 UX 통일 — UI5 sap.m.Dialog 대신 .u4a-dialog 사용)
    oAPP.fn.designInsertPopupHtml5 = _showInsertPopup;

    /********************************************************************
     * UI 삽입 팝업 (구 callUIInsertPopup, sap.m.Dialog → HTML5 .u4a-dialog)
     *   aggregation 선택 + UI 카탈로그 검색/선택 + 개수 → designAddUIObject.
     ********************************************************************/
    // UI 생성 최대 갯수(구 insertUIPopop CV_MAX_CNT).
    var CV_INS_MAX = 100;

    // 개인화 속성 적용 체크박스 텍스트(구 ZMSG_WS_COMMON_001/812). 영문 폴백 보관 금지 → 미조회 시 "".
    function _p13nText() {
        try { var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "812"); if (s) { return s; } } catch (e) { }
        return "";
    }
    // 개인화 속성 적용 체크값 localStorage I/O (구 lf_get/saveAttrPreset — 키 동일).
    function _getP13n() {
        try { var v = JSON.parse(localStorage.getItem("U4A_APPLY_P13N_ATTR")); return !!(v && v.VALUE); } catch (e) { return false; }
    }
    function _saveP13n(b) {
        try { localStorage.setItem("U4A_APPLY_P13N_ATTR", JSON.stringify({ VALUE: !!b })); } catch (e) { }
    }
    // SAP 아이콘 키 → <img src> (구 fnGetSapIconPath + 트리와 동일한 file:// 변환).
    function _iconSrc(sKey) {
        if (!sKey) { return ""; }
        var p = "";
        try { p = oAPP.fn.fnGetSapIconPath(sKey) || ""; } catch (e) { }
        if (!p) { return ""; }
        if (/^(file:|https?:|data:|\/)/i.test(p)) { return p; }
        return "file:///" + String(p).replace(/\\/g, "/");
    }
    function _esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
        });
    }

    // 헤더를 잡고 드래그해서 팝업 이동(구 sap.m.Dialog draggable:true 대체).
    // 헤더 드래그는 공통 U4AUI.makeDialogDraggable 사용(화면 밖/상단 공통헤더 클램프).
    function _enableDrag(oDlg, oHandle) {
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHandle); }
    }

    function _showInsertPopup(is_tree) {
        if (!is_tree) { return; }
        var aAgg = _getAggregations(is_tree.UIOBK);
        if (!aAgg.length) {
            // 280 입력 가능한 Aggregation이 존재하지 않습니다.
            try { parent.showMessage(null, 10, "W", _msgWs("280", "No aggregation available to add.")); } catch (e) { }
            return;
        }

        // 타이틀: "UI Object Select - <부모 UI명>"(구 D97 + UIOBJ).
        var T_0022 = _LIB().T_0022 || [], T_0023 = _LIB().T_0023 || [];
        var sParent = T_0022.find(function (a) { return a.UIOBK === is_tree.UIOBK; });
        var sTitle = _msg("D97", "UI Object Select") + (sParent && sParent.UIOBJ ? " - " + sParent.UIOBJ : "");
        // aggregation DDLB 맨 앞 빈 라인(구 동일 — 미선택 시작).
        var aAggSel = [{ UIATK: "", UIATT: "", ISMLB: "" }].concat(aAgg);

        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aWs20InsertDlg";
        oDlg.innerHTML =
            '<div class="u4a-dialog__header u4aWs20InsHead">' +
            '  <i class="fa-solid fa-layer-group"></i>' +
            '  <span class="u4aWs20InsTitle"></span>' +
            '  <button type="button" class="u4a-btn-icon u4aWs20InsX" data-act="cancel" title="' + _esc(_msg("A39", "Close")) + '"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="u4a-dialog__body">' +
            '  <div class="u4aWs20InsForm">' +
            '    <div class="u4aWs20InsRow"><label>' + _esc(_msg("D98", "Aggregation Name")) + '</label><span class="u4aWs20InsAgg"></span></div>' +
            '    <div class="u4aWs20InsRow u4aWs20InsCntRow" hidden><label>' + _esc(_msg("D99", "Generated Cnt")) + '</label>' +
            '      <div class="u4aWs20InsStep">' +
            '        <button type="button" class="u4a-btn-icon" data-step="-1"><i class="fa-solid fa-minus"></i></button>' +
            '        <input type="text" inputmode="numeric" class="u4a-input u4aWs20InsCnt" value="1">' +
            '        <button type="button" class="u4a-btn-icon" data-step="1"><i class="fa-solid fa-plus"></i></button>' +
            '        <span class="u4aWs20InsMax">' + _esc(_msg("B25", "Max")) + ' : ' + CV_INS_MAX + '</span>' +
            '      </div>' +
            '    </div>' +
            '    <div class="u4aWs20InsRow"><label>' + _esc(_msg("E01", "UI Object")) + '</label>' +
            //공통 입력 clear(X) — .u4a-field[data-trail] 래퍼 + .u4a-field__clear(값 있을 때만 노출, attachClear).
            '      <div class="u4a-field u4aWs20InsSearchWrap" data-trail="1">' +
            '        <input type="text" class="u4a-input u4a-field__input u4aWs20InsSearch" autocomplete="off">' +
            '        <button type="button" class="u4a-field__clear" tabindex="-1" title="Clear"><i class="fa-solid fa-xmark"></i></button>' +
            '      </div></div>' +
            '    <label class="u4aWs20InsChkRow"><input type="checkbox" class="u4aWs20InsP13n"><span>' + _esc(_p13nText()) + '</span></label>' +
            '  </div>' +
            '  <div class="u4aWs20InsTableWrap u4a-table-wrap">' +
            //행높이=공통 .u4a-table 기본(레퍼런스 F4 탭1·Login 동일). --compact 안 씀(혼자 좁아지지 않게).
            '    <table class="u4aWs20InsTable u4a-table">' +
            //헤더는 _renderHead 가 동적 구성(공통 .u4a-th--menu 클릭→U4AUI.openColumnMenu, 정렬/필터 표시자 갱신).
            '      <thead></thead>' +
            '      <tbody></tbody>' +
            '    </table>' +
            '    <div class="u4aWs20InsEmpty" hidden></div>' +
            '  </div>' +
            '</div>' +
            '<div class="u4a-dialog__footer">' +
            '  <button type="button" class="u4a-btn u4aWs20InsConfirm" data-act="ok" disabled><i class="fa-solid fa-check"></i> ' + _esc(_msg("A40", "Confirm")) + '</button>' +
            '  <button type="button" class="u4a-btn u4aWs20InsCancel" data-act="cancel"><i class="fa-solid fa-xmark"></i> ' + _esc(_msg("A41", "Cancel")) + '</button>' +
            '</div>';

        oDlg.querySelector(".u4aWs20InsTitle").textContent = sTitle;
        oDlg.querySelector(".u4aWs20InsTitle").title = sTitle;

        var oBody = oDlg.querySelector(".u4a-dialog__body");
        var oTbody = oDlg.querySelector(".u4aWs20InsTable tbody");
        var oEmpty = oDlg.querySelector(".u4aWs20InsEmpty");
        var oSearch = oDlg.querySelector(".u4aWs20InsSearch");
        var oOk = oDlg.querySelector('[data-act="ok"]');
        var oCntRow = oDlg.querySelector(".u4aWs20InsCntRow");
        var oCntInp = oDlg.querySelector(".u4aWs20InsCnt");
        var oAggSlot = oDlg.querySelector(".u4aWs20InsAgg");
        var oP13n = oDlg.querySelector(".u4aWs20InsP13n");

        oP13n.checked = _getP13n();

        var oSelAgg = aAggSel[0];   // 현재 선택 aggregation row(빈 라인부터)
        var oSelUI = null;          // 현재 선택 UI(T_0022 row)
        var sSortKey = "", sSortDir = "asc";
        var oColFilters = {};       // 컬럼별 필터(AND·contains) — 공통 컬럼메뉴(U4AUI.openColumnMenu)가 갱신

        // 정렬/필터 메뉴 문구(메시지 키 SSOT — 화면이 해석해 공통 헬퍼에 전달). 810/811=ZMSG_WS_COMMON_001.
        function _wsMsgRaw(n) { try { var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", n); if (s) { return s; } } catch (e) { } return n; }
        var INS_MENU_LABELS = { filter: _msg("A68"), asc: _wsMsgRaw("810"), desc: _wsMsgRaw("811"), clear: _msg("A69") };
        // 정렬/필터 대상 데이터 컬럼(Symbol 은 아이콘 전용 — 비정렬). 라벨은 메시지 키.
        var INS_COLS = [
            { key: "UIOBJ", label: _msg("E01"), cls: "" },
            { key: "LIBNM", label: _msg("E03"), cls: "" },
            { key: "UIOBK", label: _msg("E04"), cls: "u4aWs20InsThKey" }
        ];
        // 공통 컬럼메뉴(U4AUI.openColumnMenu) 소비 컨트롤러 — 상태=sSortKey/sSortDir/oColFilters(ServerList/F4 동일 패턴).
        var _insColCtl = {
            getFilter: function (k) { return oColFilters[k] || ""; },
            setFilter: function (k, v) { if (v) { oColFilters[k] = v; } else { delete oColFilters[k]; } },
            getSort: function () { return sSortKey ? { key: sSortKey, dir: sSortDir } : null; },
            setSort: function (k, d) { sSortKey = k || ""; sSortDir = d || "asc"; },
            rerender: function () { _renderHead(); lf_renderTable(); }
        };

        // 헤더 셀(데이터 컬럼) — 공통 .u4a-th--menu, 클릭→공통 컬럼메뉴. 정렬/필터 표시자는 활성 컬럼에만.
        function _buildInsTh(c) {
            var th = document.createElement("th");
            th.className = "u4a-th--menu" + (c.cls ? " " + c.cls : "");
            var inner = document.createElement("div"); inner.className = "u4a-th__inner";
            var lbl = document.createElement("span"); lbl.className = "u4a-th__label"; lbl.textContent = c.label;
            inner.appendChild(lbl);
            var bSorted = sSortKey === c.key, bFiltered = !!oColFilters[c.key];
            if (bSorted || bFiltered) {
                var ind = document.createElement("span"); ind.className = "u4a-th__ind";
                if (bSorted) { ind.innerHTML += '<i class="fa-solid fa-arrow-' + (sSortDir === "desc" ? "down" : "up") + '"></i>'; }
                if (bFiltered) { ind.innerHTML += '<i class="fa-solid fa-filter"></i>'; }
                inner.appendChild(ind);
            }
            th.appendChild(inner);
            th.addEventListener("click", function (e) {
                e.stopPropagation();
                if (window.U4AUI && U4AUI.openColumnMenu) {
                    U4AUI.openColumnMenu(c, th, _insColCtl, { container: oDlg, labels: INS_MENU_LABELS });
                }
            });
            return th;
        }
        // 헤더 전체 재구성(정렬/필터 표시자 갱신 위해 rerender 마다 호출 — ServerList _renderHead 패턴).
        function _renderHead() {
            var thead = oDlg.querySelector(".u4aWs20InsTable thead");
            if (!thead) { return; }
            thead.textContent = "";
            var tr = document.createElement("tr");
            // Symbol(아이콘 전용 — 비정렬, 메뉴 없음)
            var thSym = document.createElement("th"); thSym.className = "u4aWs20InsThSym";
            var inS = document.createElement("div"); inS.className = "u4a-th__inner u4a-th__inner--center";
            var lbS = document.createElement("span"); lbS.className = "u4a-th__label"; lbS.textContent = _msg("E31");
            inS.appendChild(lbS); thSym.appendChild(inS); tr.appendChild(thSym);
            INS_COLS.forEach(function (c) { tr.appendChild(_buildInsTh(c)); });
            thead.appendChild(tr);
        }
        // 표시 행 파생 — 상단 검색박스 + 컬럼필터(AND·contains) + 정렬(공통 컬럼메뉴 상태).
        function _cellText(k, ui) { return String(ui && ui[k] != null ? ui[k] : ""); }
        function _deriveRows(aUIs) {
            var sQ = (oSearch.value || "").toLowerCase();
            var aKeys = Object.keys(oColFilters).filter(function (k) { return oColFilters[k]; });
            var arr = aUIs.filter(function (ui) {
                if (sQ && String(ui.UIOBJ).toLowerCase().indexOf(sQ) === -1 && String(ui.LIBNM).toLowerCase().indexOf(sQ) === -1) { return false; }
                return aKeys.every(function (k) { return _cellText(k, ui).toLowerCase().indexOf(oColFilters[k]) !== -1; });
            });
            if (sSortKey) {
                var d = sSortDir === "desc" ? -1 : 1;
                arr.sort(function (a, b) { return _cellText(sSortKey, a).localeCompare(_cellText(sSortKey, b), undefined, { numeric: true }) * d; });
            }
            return arr;
        }

        function lf_close() { try { U4AUI && U4AUI.closeColumnMenu && U4AUI.closeColumnMenu(); } catch (e) { } try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } }

        function lf_clampCnt() {
            var v = parseInt(oCntInp.value, 10);
            if (!(v > 0)) { v = 1; }
            if (v > CV_INS_MAX) { v = CV_INS_MAX; }
            oCntInp.value = v;
            return v;
        }

        function lf_renderTable() {
            oSelUI = null; oOk.disabled = true;
            oTbody.innerHTML = "";
            // 빈(미선택) aggregation 이면 비움.
            var aUIs = oSelAgg.UIATK ? _getUIs(oSelAgg, is_tree.UIOBK) : [];
            var aRows = _deriveRows(aUIs);   // 검색박스 + 컬럼필터(AND) + 정렬(공통 컬럼메뉴 상태)
            aRows.forEach(function (ui, idx) {
                var tr = document.createElement("tr");
                tr.dataset.odd = (idx % 2 === 1) ? "true" : "false";   // 공통 zebra
                var sImg = _iconSrc(ui.UICON);
                tr.innerHTML =
                    '<td class="u4aWs20InsTdSym">' + (sImg ? '<img src="' + _esc(sImg) + '" alt="" onerror="this.style.display=\'none\'">' : "") + '</td>' +
                    '<td class="u4aWs20InsTdName">' + _esc(ui.UIOBJ) + '</td>' +
                    '<td class="u4aWs20InsTdFull">' + _esc(ui.LIBNM) + '</td>' +
                    '<td class="u4aWs20InsTdKey">' + _esc(ui.UIOBK) + '</td>';
                tr.addEventListener("click", function () {
                    oSelUI = ui; oOk.disabled = false;
                    // 공통 선택 표시 = aria-selected(좌측 액센트바+강조배경, .u4a-table 가 담당).
                    var s = oTbody.querySelector('tr[aria-selected="true"]'); if (s) { s.removeAttribute("aria-selected"); }
                    tr.setAttribute("aria-selected", "true");
                });
                tr.addEventListener("dblclick", function () { oSelUI = ui; lf_confirm(); });
                oTbody.appendChild(tr);
            });
            // 결과 0건 = 공통 .u4a-table__nodata 행("데이터 없음" = 946, ServerList/F4 동일). 빈 테이블로 두지 않음.
            if (aRows.length === 0) {
                var trN = document.createElement("tr");
                trN.className = "u4a-table__nodata";
                var tdN = document.createElement("td");
                tdN.setAttribute("colspan", "4");
                tdN.textContent = _wsMsgRaw("946");
                trN.appendChild(tdN);
                oTbody.appendChild(trN);
            }
            oEmpty.hidden = true;
        }

        function lf_confirm() {
            if (!oSelUI) { return; }
            var cnt = oSelAgg.ISMLB === "X" ? lf_clampCnt() : 1;
            var ls_0022 = T_0022.find(function (a) { return a.UIOBK === oSelUI.UIOBK; }) || oSelUI;
            var ls_0023 = T_0023.find(function (a) { return a.UIATK === oSelAgg.UIATK; }) || oSelAgg;
            _saveP13n(oP13n.checked);
            // UI명 suggestion 이력 저장 (구 insertUIPopop saveUiSuggest("insertUiName", UIOBJ, 10))
            try { if (typeof oAPP.fn.saveUiSuggest === "function") { oAPP.fn.saveUiSuggest("insertUiName", ls_0022.UIOBJ, 10); } } catch (e) { }
            lf_close();
            try { oAPP.fn.designAddUIObject(is_tree, ls_0022, ls_0023, cnt, oP13n.checked); }
            catch (e) { console.error("[HTML5][WS20] designAddUIObject:", e && e.message ? e.message : e); }
        }

        // aggregation 셀렉트(공통 U4AUI.createSelect — 빈 라인 포함). 원본 Item text:"{UIATT}" 그대로.
        var aAggItems = aAggSel.map(function (r) { return { value: r.UIATK, text: r.UIATK ? r.UIATT : "" }; });
        function lf_onAgg(v) {
            oSelAgg = aAggSel.find(function (a) { return a.UIATK === v; }) || aAggSel[0];
            oCntRow.hidden = oSelAgg.ISMLB !== "X";   // 다건 허용일 때만 Generated Cnt 노출
            if (oCntRow.hidden) { oCntInp.value = 1; }
            lf_renderTable();
        }
        if (window.U4AUI && U4AUI.createSelect) {
            var oSel = U4AUI.createSelect(aAggItems, oSelAgg.UIATK, lf_onAgg);
            oSel.style.flex = "1 1 auto";
            oAggSlot.appendChild(oSel);
        } else {
            var oNative = document.createElement("select");
            oNative.className = "u4a-input";
            aAggItems.forEach(function (it) { var o = document.createElement("option"); o.value = it.value; o.textContent = it.text; oNative.appendChild(o); });
            oNative.addEventListener("change", function () { lf_onAgg(oNative.value); });
            oAggSlot.appendChild(oNative);
        }

        // 헤더 최초 구성(클릭→공통 컬럼메뉴, 정렬/필터 표시자는 활성 컬럼에만). 이후 갱신은 컨트롤러 rerender.
        _renderHead();

        // Generated Cnt 스텝퍼 +/-
        Array.prototype.forEach.call(oDlg.querySelectorAll(".u4aWs20InsStep [data-step]"), function (b) {
            b.addEventListener("click", function () {
                oCntInp.value = lf_clampCnt() + parseInt(b.getAttribute("data-step"), 10);
                lf_clampCnt();
            });
        });
        oCntInp.addEventListener("change", lf_clampCnt);
        oCntInp.addEventListener("blur", lf_clampCnt);

        oSearch.addEventListener("input", lf_renderTable);
        oSearch.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); lf_confirm(); } });

        //공통 입력 clear(X) — 값 있을 때만 노출, 클릭 시 비우고 input 이벤트로 표 재필터(lf_renderTable).
        if (window.U4AUI && U4AUI.attachClear) {
            U4AUI.attachClear(oSearch, oDlg.querySelector(".u4aWs20InsSearchWrap .u4a-field__clear"));
        }
        // UI 오브젝트 input 자동완성 (구 setUiSuggest(oInp2,"insertUiName") — 이력 기반 suggestion).
        //   이전에 추가한 UI명(insertUiName 이력)을 부분일치로 제안 → 선택 시 검색 필터 적용.
        if (window.U4AUI && U4AUI.attachSuggest && typeof oAPP.fn.fnSuggestionRead === "function") {
            U4AUI.attachSuggest(oSearch,
                function () {
                    try { return (oAPP.fn.fnSuggestionRead("insertUiName") || []).map(function (o) { return o && o.NAME; }).filter(Boolean); }
                    catch (e) { return []; }
                },
                function (v) { oSearch.value = v; lf_renderTable(); });
        }
        oOk.addEventListener("click", lf_confirm);
        Array.prototype.forEach.call(oDlg.querySelectorAll('[data-act="cancel"]'), function (b) {
            b.addEventListener("click", lf_close);
        });
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); }); // ESC

        _enableDrag(oDlg, oDlg.querySelector(".u4aWs20InsHead"));
        // 헤더 더블클릭 → 화면 중앙 복귀 / 우하단 grip → 크기조절 (공통 U4AUI, SAPUI5 동일 UX)
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oDlg.querySelector(".u4aWs20InsHead")); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 320 }); }

        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }
        lf_renderTable();
        setTimeout(function () { try { (oSel || oSearch).focus(); } catch (e) { } }, 0);
        if (oBody) { /* 헤더 드래그·body 스크롤 분리 보장 */ }
    }

    /********************************************************************
     * [PUBLIC] 우클릭 컨텍스트 메뉴 (구 callDesignContextMenu / enableDesignContextMenu)
     ********************************************************************/
    var _openMenu = null;
    function _closeMenu() {
        if (_openMenu) { try { _openMenu.remove(); } catch (e) { } _openMenu = null; }
        document.removeEventListener("mousedown", _onOutside, true);
        document.removeEventListener("keydown", _onEsc, true);
        window.removeEventListener("resize", _closeMenu);
    }
    function _onOutside(ev) { if (_openMenu && !_openMenu.contains(ev.target)) { _closeMenu(); } }
    function _onEsc(ev) { if (ev.key === "Escape") { _closeMenu(); } }

    /********************************************************************
     * Move Position (구 contextMenuUiMovePosition/uiMovePosition) — 형제 내
     *   임의 위치로 이동. 작은 위치선택 다이얼로그로 HTML5 재현.
     ********************************************************************/
    function _moveUIPosition(oNode) {
        if (!oNode || !_isEdit()) { return; }
        var oParent = _node(oNode.POBID);
        if (!oParent || !oParent.zTREE || oParent.zTREE.length <= 1) { return; }
        var aSib = oParent.zTREE;
        var iCur = aSib.findIndex(function (a) { return a.OBJID === oNode.OBJID; });
        var nTot = aSib.length;

        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aWs20MoveDlg";
        oDlg.innerHTML =
            '<div class="u4a-dialog__header"><i class="fa-solid fa-outdent"></i><span>' + _esc(_msg("A57", "Move Position")) + '</span></div>' +
            '<div class="u4a-dialog__body">' +
            '  <div class="u4aWs20MoveRow"><label>' + _esc(oNode.OBJID) + '</label>' +
            '    <input type="number" class="u4a-input u4aWs20MovePos" min="1" max="' + nTot + '" value="' + (iCur + 1) + '">' +
            '    <span class="u4aWs20MoveMax">/ ' + nTot + '</span></div>' +
            '</div>' +
            '<div class="u4a-dialog__footer">' +
            '  <button type="button" class="u4a-btn u4aWs20InsConfirm" data-act="ok"><i class="fa-solid fa-check"></i> ' + _esc(_msg("A40", "Confirm")) + '</button>' +
            '  <button type="button" class="u4a-btn u4aWs20InsCancel" data-act="cancel"><i class="fa-solid fa-xmark"></i> ' + _esc(_msg("A41", "Cancel")) + '</button>' +
            '</div>';
        var oInp = oDlg.querySelector(".u4aWs20MovePos");
        function lf_close() { try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } }
        function lf_ok() {
            var v = parseInt(oInp.value, 10); if (!(v >= 1)) { v = 1; } if (v > nTot) { v = nTot; }
            var iTarget = v - 1;
            lf_close();
            if (iTarget === iCur) { return; }
            oAPP.fn.fnWs20PushUndo();
            aSib.splice(iCur, 1);
            aSib.splice(iTarget, 0, oNode);
            _refreshTree();
            _prev("moveUIObjPreView", [oNode.OBJID, oNode.UILIB, oNode.POBID, oNode.PUIOK, oNode.UIATT, iTarget, oNode.ISMLB, oNode.UIOBK]);
            _selectNode(oNode.OBJID);
            _markChanged();
        }
        oDlg.querySelector('[data-act="ok"]').addEventListener("click", lf_ok);
        oDlg.querySelector('[data-act="cancel"]').addEventListener("click", lf_close);
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });
        oInp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); lf_ok(); } });
        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }
        setTimeout(function () { try { oInp.focus(); oInp.select(); } catch (e) { } }, 0);
    }

    // UI Where use / My Pattern — 디자인영역(UI5) 실함수가 로드돼 있으면 위임,
    //   디자인영역(UI5) 실함수가 로드된 환경이면 위임, 아니면 무동작(개발자 콘솔만).
    function _ctxDelegate(sFn) {
        if (typeof oAPP.fn[sFn] === "function") {
            try { oAPP.fn[sFn](); return; } catch (e) { }
        }
        console.warn("[HTML5][WS20] context action not available in this context:", sFn);
    }

    // 노드/모드별 메뉴 항목 enable 규칙 (구 enableDesignContextMenu — 1:1 이식)
    //   원본과 동일하게 "모든 항목을 항상 노출하고, 불가 항목은 disable" 한다.
    function _buildItems(oNode) {
        var bEdit = _isEdit();
        var bHasCopy = !!_getCopy();
        var sId = oNode.OBJID;
        var oParent = _node(oNode.POBID);
        var aSib = (oParent && oParent.zTREE) || [];
        var iIdx = aSib.findIndex(function (a) { return a.OBJID === sId; });

        // enab01~08/11 (구 enableDesignContextMenu)
        var en = { add: false, del: false, up: false, down: false, movepos: false, copy: false, paste: false, whereuse: false, pattern: false };
        if (sId === "ROOT") {
            // ROOT(DOCUMENT): 전부 비활성
        } else {
            // ROOT 가 아니면 편집여부 무관하게 UI Where use / My Pattern 가능
            en.whereuse = true;
            en.pattern = true;
            // 편집 상태면 UI추가 + (복사본 존재 시)붙여넣기
            if (bEdit) { en.add = true; en.paste = bHasCopy; }
            if (sId === "APP") {
                // APP: 위 설정만(추가/붙여넣기·where use·pattern)
            } else if (!bEdit) {
                // Display(편집 불가)·일반 노드: copy 만 추가 허용
                en.copy = true;
            } else {
                // 편집 가능한 일반 노드: 삭제/이동/복사 가능
                en.del = true; en.up = true; en.down = true; en.movepos = true; en.copy = true;
                // 형제 1건 → up/down/movepos 불가, 첫째 → up 불가, 막내 → down 불가
                if (aSib.length === 1) { en.up = false; en.down = false; en.movepos = false; }
                else if (iIdx === 0) { en.up = false; }
                else if (iIdx + 1 === aSib.length) { en.down = false; }
            }
        }

        // 원본 메뉴 순서/아이콘/구분선(startsSection) 그대로 — 전부 반환(필터 안 함)
        return [
            { key: "M01", icon: "plus", text: _msg("A54", "Insert Element"), on: en.add, sep: true, fn: function () { oAPP.fn.designUIAdd(oNode); } },
            { key: "M02", icon: "trash", text: _msg("A03", "Delete"), on: en.del, fn: function () { _deleteUI(oNode); } },
            { key: "M03", icon: "chevron-up", text: _msg("A55", "Up"), on: en.up, sep: true, fn: function () { _moveUI(oNode, "-"); } },
            { key: "M04", icon: "chevron-down", text: _msg("A56", "Down"), on: en.down, fn: function () { _moveUI(oNode, "+"); } },
            { key: "M05", icon: "outdent", text: _msg("A57", "Move Position"), on: en.movepos, fn: function () { _moveUIPosition(oNode); } },
            { key: "M06", icon: "copy", text: _msg("A04", "Copy"), on: en.copy, sep: true, fn: function () { _copyUI(oNode); } },
            { key: "M07", icon: "paste", text: _msg("A58", "Paste"), on: en.paste, fn: function () { _pasteUI(oNode); } },
            { key: "M08", icon: "magnifying-glass", text: _msg("A59", "UI Where use"), on: en.whereuse, sep: true, fn: function () { _ctxDelegate("contextMenuUiWhereUse"); } },
            { key: "M11", icon: "floppy-disk", text: _msg("E19", "My Pattern"), on: en.pattern, sep: true, fn: function () { _ctxDelegate("contextMenuP13nDesignPopup"); } }
        ];
    }

    oAPP.fn.fnWs20ShowTreeContextMenu = function (oNode, iX, iY) {
        _closeMenu();
        if (!oNode) { return; }
        var aItems = _buildItems(oNode);

        var oMenu = document.createElement("div");
        oMenu.className = "u4a-menu u4aWs20TreeCtxMenu";
        oMenu.setAttribute("role", "menu");

        // 상단 타이틀(구 M00 — 노드명, 항상 비활성 헤더)
        var oTitle = document.createElement("div");
        oTitle.className = "u4a-menu__item u4aWs20CtxTitle";
        oTitle.setAttribute("role", "presentation");
        oTitle.setAttribute("aria-disabled", "true");
        oTitle.innerHTML = '<i class="fa-solid fa-bars"></i><span class="u4a-menu__item-text">' + _esc(oNode.OBJID) + '</span>';
        oMenu.appendChild(oTitle);

        aItems.forEach(function (it) {
            // [공통 UX] ws10_html 메뉴와 동일 마크업(.u4a-menu__item + __item-text + FA <i>).
            //   원본처럼 "모든 항목 노출 + 불가 항목 disable"(숨기지 않음).
            var oItem = document.createElement("div");
            oItem.className = "u4a-menu__item";
            oItem.setAttribute("role", "menuitem");
            if (it.sep) { oItem.style.borderTop = "1px solid var(--line)"; } // 그룹 구분(startsSection)
            if (!it.on) { oItem.setAttribute("aria-disabled", "true"); } // 불가 항목 disable
            oItem.innerHTML = '<i class="fa-solid fa-' + it.icon + '"></i><span class="u4a-menu__item-text">' + _esc(it.text) + '</span>';
            if (it.on) {
                oItem.addEventListener("click", function (e) {
                    e.stopPropagation();
                    _closeMenu();
                    try { it.fn(); } catch (err) { console.warn("[HTML5][WS20] ctx menu " + it.key + " error:", err && err.message); }
                });
            }
            oMenu.appendChild(oItem);
        });

        document.body.appendChild(oMenu);
        // 위치(화면 경계 보정)
        var r = oMenu.getBoundingClientRect();
        var x = iX, y = iY;
        if (x + r.width > window.innerWidth) { x = Math.max(4, window.innerWidth - r.width - 4); }
        if (y + r.height > window.innerHeight) { y = Math.max(4, window.innerHeight - r.height - 4); }
        oMenu.style.position = "fixed";
        oMenu.style.left = x + "px";
        oMenu.style.top = y + "px";
        oMenu.style.zIndex = "4000";
        _openMenu = oMenu;
        // 창 리사이즈 시 컨텍스트 메뉴 닫기(표준 메뉴 UX).
        window.addEventListener("resize", _closeMenu);
        // 미리보기(iframe) 클릭 닫기는 전역(u4a-ui.js _installIframeBlurClose)이 합성 mousedown 으로 처리.
        setTimeout(function () {
            document.addEventListener("mousedown", _onOutside, true);
            document.addEventListener("keydown", _onEsc, true);
        }, 0);
    };

    /********************************************************************
     * Undo/Redo 단축키 (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) — WS20 편집모드 한정.
     *   입력 필드 포커스/모달 다이얼로그 열림 시에는 가로채지 않음.
     ********************************************************************/
    document.addEventListener("keydown", function (e) {
        if (!(e.ctrlKey || e.metaKey)) { return; }
        var k = (e.key || "").toLowerCase();
        if (k !== "z" && k !== "y") { return; }
        // WS20 편집모드만
        var bEdit = false;
        try { bEdit = oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e2) { }
        if (!bEdit) { return; }
        try { if (parent.getCurrPage && parent.getCurrPage() !== "WS20") { return; } } catch (e2) { }
        // 입력 중/모달 열림이면 무시
        var t = e.target;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { return; }
        if (document.querySelector("dialog[open]")) { return; }
        var bRedo = (k === "y") || (k === "z" && e.shiftKey);
        e.preventDefault();
        if (oAPP.fn.fnWs20ExecHistory) { oAPP.fn.fnWs20ExecHistory(bRedo ? "REDO" : "UNDO"); }
    }, true);

})(window, (window.oAPP = window.oAPP || {}));
