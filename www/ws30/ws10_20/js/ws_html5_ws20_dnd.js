/* ============================================================================
 * ws_html5_ws20_dnd.js  (HTML5)
 * ----------------------------------------------------------------------------
 *  WS20 디자인 트리 드래그&드롭(이동/복사) — UI5(uiDesignArea.js) 1:1 컨버전.
 *
 *  ▣ 원본 구조
 *    UI5 TreeTable + sap.ui.core.dnd.DragInfo/DropInfo 로 트리 행을 드래그하여
 *    다른 행(컨테이너/형제)에 드롭 → UI 이동/복사. 검증→aggregation 선택→실제 변경.
 *
 *  ▣ HTML5 컨버전 방침 (.analy/13·16, 공통 미수정)
 *    · 공통 트리(U4AUI.createTree, virtual)의 행(.u4aWs20TreeRow[data-objid])에
 *      네이티브 HTML5 D&D(draggable + dragstart/over/enter/leave/drop/end)를
 *      "화면 스코프"로 부착(rowHook 데코 + 컨테이너 위임). shell.css/u4a-ui.js 무수정.
 *    · UI5 TreeTable 의존부만 치환:
 *        oLTree1.__dropEffect / __isdragStarted → 모듈 _dnd 상태
 *        getRows()/getBinding()._buildTree()/oModel.refresh()/rowsUpdated 대기
 *                                              → oAPP.fn.fnRenderDesignTree()
 *        sap.ui.core.dnd.RelativeDropPosition.On/Before/After → "On"/"Before"/"After"
 *        sap.m.MessageToast.show / showMessage(sap,...) → parent.showMessage(null,...)
 *    · 그 외(모델 zTREE 조작, 미리보기 iframe 함수, require 모듈, 기존 HTML5 헬퍼)는
 *      원본 그대로 재사용.
 *
 *  ▣ 재사용 (이미 HTML5에 존재 — 재정의 안 함)
 *    getTreeData·getUIAttrFuncName·crtStru0014·crtStru0015·setModelBind·
 *    getParentAggrBind·setOBJID·chkUiCardinality·moveCorresponding·setChangeFlag·
 *    setShortcutLock·parseTree2Tab·ClearDropEffect·checkWLOList·getMousePosition·
 *    fnWs20PushUndo·setTreeUiIcon·fnGetSapIconPath·fnRenderDesignTree·setSelectTreeItem
 *
 *  ▣ require 모듈 (prev.js 가 oAPP.oDesign.pathInfo 부트스트랩) — parent.require 로 로드
 *    setOnAfterRender(미리보기 onAfterRendering 대기)·bindPopupBroadCast(BUSY)·
 *    exception/exceptionUI(checkDeny/AllowChildAggr).  undo 는 원본 undoRedo 모듈이
 *    아니라 HTML5 단일스택 fnWs20PushUndo 사용(메모리 규약).
 *
 *  ▣ 미리보기 iframe(UI5 design/preview/index.js) 함수 — oAPP.attr.ui.frame.contentWindow
 *    moveUIObjPreView·addUIObjPreView·createUIInstance·setChildUiException·
 *    setRichTextEditorException·destroyUIPreView·redrawUIScript·delUIObjPreView·
 *    prevClearDropEffect
 *
 *  로드 순서: library-preload.js 에서 ws_html5_ws20_edit.js "뒤"(stub override).
 * ========================================================================== */
(function () {
    "use strict";

    if (typeof window === "undefined" || typeof window.oAPP === "undefined") { return; }
    var oAPP = window.oAPP;
    oAPP.fn = oAPP.fn || {};
    oAPP.oDesign = oAPP.oDesign || {};
    oAPP.oDesign.fn = oAPP.oDesign.fn || {};

    /* ====================================================================
     * 0) 모듈 상태 / 공용 헬퍼
     *    원본 oAPP.attr.ui.oLTree1.__dropEffect / __isdragStarted 를 대체.
     * ==================================================================== */
    var _dnd = {
        active: false,     // 원본 __isdragStarted
        effect: "",        // 원본 __dropEffect ("Move"/"Copy")
        dragObjid: "",     // 드래그 시작 OBJID
        dropObjid: "",     // 현재 드래그가 올라간 행 OBJID
        dropPos: ""        // "On"/"Before"/"After"
    };

    // GLANGU (prev.js 부트스트랩).
    function _gl() { try { return oAPP.oDesign.settings.GLANGU; } catch (e) { return ""; } }

    // ZMSG_WS_COMMON_001 메시지(WSUTIL) — 원본 parent.WSUTIL.getWsMsgClsTxt 대응.
    function _wsc(code, a1, a2, a3, a4) {
        try { return parent.WSUTIL.getWsMsgClsTxt(_gl(), "ZMSG_WS_COMMON_001", code, a1 || "", a2 || "", a3 || "", a4 || ""); }
        catch (e) { return ""; }
    }
    // /U4A/MSG_WS·CL_WS_COMMON 등 메시지(공통).
    function _msg(cls, code, a1, a2, a3, a4) {
        try { return oAPP.common.fnGetMsgClsText(cls, code, a1 || "", a2 || "", a3 || "", a4 || ""); }
        catch (e) { return ""; }
    }
    // 토스트(원본 showMessage(sap,10,...) / MessageToast → KIND 10).
    function _toast(type, text) { try { parent.showMessage(null, 10, type, text); } catch (e) { } }

    function _frameWin() {
        try {
            var f = oAPP.attr.ui && oAPP.attr.ui.frame;
            return (f && f.contentWindow) || null;
        } catch (e) { return null; }
    }
    function _root() {
        try { return oAPP.attr.oModel.oData.zTREE[0]; } catch (e) { return null; }
    }
    function _isEdit() {
        try {
            var m = oAPP.attr.oModel;
            var v = (m && typeof m.getProperty === "function") ? m.getProperty("/IS_EDIT")
                : (m && m.oData ? m.oData.IS_EDIT : undefined);
            return v === true || v === "X";
        } catch (e) { return false; }
    }
    // 펼침 사이드맵(tree.js 와 단일출처 공유) — 기본 펼침(false 명시건만 접힘).
    function _isExpandedNode(oNode) {
        if (!oNode || oNode.OBJID == null) { return true; }
        var oMap = oAPP.attr.ws20TreeExpanded || {};
        if (Object.prototype.hasOwnProperty.call(oMap, oNode.OBJID)) { return oMap[oNode.OBJID] === true; }
        return true;
    }
    // 화면 표시 순서(펼침 반영) 평탄 노드 리스트 — 원본 oLTree1.getRows() 대체.
    function _visibleFlat() {
        var aOut = [];
        var oRoot = _root();
        (function rec(oNode) {
            if (!oNode) { return; }
            aOut.push(oNode);
            if (Array.isArray(oNode.zTREE) && oNode.zTREE.length > 0 && _isExpandedNode(oNode)) {
                for (var i = 0; i < oNode.zTREE.length; i++) { rec(oNode.zTREE[i]); }
            }
        })(oRoot);
        return aOut;
    }
    // require 모듈 로더(가드).
    function _req(sPathKey) {
        try { return parent.require(oAPP.oDesign.pathInfo[sPathKey]); } catch (e) { return null; }
    }
    function _bindBusy(sAct, oOpt) {
        try { var f = _req("bindPopupBroadCast"); if (f) { f(sAct, oOpt); } } catch (e) { }
    }
    function _busyOption(code) {
        var o; try { o = JSON.parse(JSON.stringify(oAPP.oDesign.types.TY_BUSY_OPTION)); } catch (e) { o = { TITLE: "", DESC: "" }; }
        o.DESC = _wsc(code); return o;
    }
    function _safe(fn) { try { return fn(); } catch (e) { console.error("[HTML5][WS20][dnd]", e); } }
    // 부모에 추가되지 않는 UI(UA026) 여부 — 미리보기 index 카운트(_cnt) 계산용. (S_CODE 미로드 가드)
    function _isUa026(uilib) {
        try { var a = oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA026; return !!(a && a.findIndex(function (item) { return item.FLD01 === uilib; }) !== -1); }
        catch (e) { return false; }
    }


    /* ====================================================================
     * 1) D&D 활성/드롭가능 판정 + 스타일 (원본 uiDesignArea.js)
     * ==================================================================== */

    // tree drag & drop 가능여부 처리. (원본 1831행 1:1)
    oAPP.fn.setTreeDnDEnable = function (is_tree) {
        if (!is_tree) { return; }
        is_tree.drag_enable = true;                       // drag 는 display 에서도 가능(런타임클래스 네비)
        is_tree.drop_enable = _isEdit();                  // drop 은 편집모드만
        if (is_tree.OBJID === "ROOT") { is_tree.drag_enable = false; is_tree.drop_enable = false; }
        if (!is_tree.zTREE || is_tree.zTREE.length === 0) { return; }
        for (var i = 0, l = is_tree.zTREE.length; i < l; i++) { oAPP.fn.setTreeDnDEnable(is_tree.zTREE[i]); }
    };

    // DnD 가능여부 확인(자기 자손에 drop 금지). (원본 3926행 1:1)
    oAPP.fn.chkDnDPossible = function (it_tree, OBJID) {
        if (!it_tree || it_tree.length === 0) { return; }
        var l_indx = it_tree.findIndex(function (a) { return a.OBJID === OBJID; });
        if (l_indx !== -1) { return true; }
        for (var i = 0, l = it_tree.length; i < l; i++) {
            if (oAPP.fn.chkDnDPossible(it_tree[i].zTREE, OBJID)) { return true; }
        }
    };

    // drop 가능여부 처리. (원본 3704행 1:1 — T_0022/0023/0027 호환표)
    oAPP.fn.setDropEnable = function (is_tree) {

        function lf_setDropEnable(is_child, it_0027, bChild) {
            is_child.drop_enable = false;

            if (bChild === true) {
                if (is_child.zTREE.length === 0) { return; }
                for (var i = 0, l = is_child.zTREE.length; i < l; i++) { lf_setDropEnable(is_child.zTREE[i], it_0027, bChild); }
                return;
            }
            if (is_child.OBJID === is_tree.OBJID) {
                if (is_child.zTREE.length === 0) { return; }
                for (var i2 = 0, l2 = is_child.zTREE.length; i2 < l2; i2++) { lf_setDropEnable(is_child.zTREE[i2], it_0027, true); }
                return;
            }

            var lt_0023 = oAPP.DATA.LIB.T_0023.filter(function (a) { return a.UIOBK === is_child.UIOBK && a.UIATY === "3" && a.ISDEP !== "X"; });
            if (lt_0023.length !== 0) {
                for (var i3 = 0, l3 = lt_0023.length; i3 < l3; i3++) {
                    var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.LIBNM === lt_0023[i3].UIADT; });
                    if (!ls_0022) { continue; }
                    var ls_0027 = it_0027.find(function (a) { return a.SGOBJ === ls_0022.UIOBK; });
                    if (!ls_0027) { continue; }
                    // 0:1 aggregation 에 이미 child 가 있으면 drop 불가.
                    if (lt_0023[i3].ISMLB === "" && is_child.zTREE.length > 0) {
                        if (is_child.zTREE.findIndex(function (item) { return item.UIATT === lt_0023[i3].UIATT; }) !== -1) { continue; }
                    }
                    is_child.drop_enable = true;
                    break;
                }
            }
            if (is_child.zTREE.length === 0) { return; }
            for (var i4 = 0, l4 = is_child.zTREE.length; i4 < l4; i4++) { lf_setDropEnable(is_child.zTREE[i4], it_0027, bChild); }
        }

        if (_isEdit() !== true) { return; }
        var lt_0027 = oAPP.DATA.LIB.T_0027.filter(function (a) { return a.TGOBJ === is_tree.UIOBK; });
        lf_setDropEnable(_root(), lt_0027);
    };

    // drop 가능여부 style 처리(HTML5 DOM 버전). 원본 3806행: oLTree1.getRows() 순회 →
    //   여기선 현재 화면에 그려진 행(.u4aWs20TreeRow[data-objid])에 직접 클래스 토글(재렌더 X — 드래그 소스 보존).
    oAPP.fn.designSetDropStyle = function (bClear) {
        if (!_dnd.active) { return; }
        var oPane = document.getElementById("ws20DesignTree");
        if (!oPane) { return; }
        var aRows = oPane.querySelectorAll(".u4aWs20TreeRow");
        for (var i = 0, l = aRows.length; i < l; i++) {
            var oRow = aRows[i];
            oRow.classList.remove("u4aWs20TreeDropNo");
            oRow.classList.remove("u4aWs20DropOn", "u4aWs20DropBefore", "u4aWs20DropAfter");
            if (bClear) { oRow.classList.remove("u4aWs20TreeDragging"); continue; }
            var sObjid = oRow.getAttribute("data-objid");
            var oNode = oAPP.fn.getTreeData(sObjid);
            if (!oNode) { continue; }
            if (oNode.drop_enable !== true) { oRow.classList.add("u4aWs20TreeDropNo"); }
        }
    };

    // design tree item drag 시작. (원본 3905행 1:1)
    oAPP.fn.designTreeDragStart = function (is_tree) {
        _dnd.active = true;
        _dnd.effect = "";   // 이 드래그의 Copy/Move 는 이후 dragover/drop 에서 결정(새 드래그마다 초기화)
        if (is_tree && is_tree.OBJID) { _dnd.dragObjid = is_tree.OBJID; }
        oAPP.fn.setTreeDnDEnable(_root());          // 기본 가능여부
        if (is_tree) { oAPP.fn.setDropEnable(is_tree); }  // drag 기준 drop 가능 라인 판정
        oAPP.fn.designSetDropStyle();               // drop 불가 행 표시
    };

    // drag 종료. (원본 1679행 — UI5 InstanceManager/insert popup 잔상부는 HTML5 무관 제거)
    //   ★ _dnd.effect 는 절대 여기서 비우지 않는다(원본 designDragEnd 도 __dropEffect 미초기화).
    //     네이티브 dragend 는 drop 직후 발생하는데, aggregation 선택 팝업(비동기)이 뜬 사이
    //     effect 를 지우면 사용자가 팝업 확정 후 drop_cb 가 Copy 를 Move 로 오판한다.
    //     effect 는 drop_cb 가 읽으면서 스스로 비운다(초기화는 designTreeDragStart).
    oAPP.fn.designDragEnd = function () {
        oAPP.fn.setTreeDnDEnable(_root());
        oAPP.fn.designSetDropStyle(true);           // 잔상 css 제거
        _dnd.active = false;
        _dnd.dragObjid = "";
        _dnd.dropObjid = "";
        _dnd.dropPos = "";
        // 미리보기 영역 drop 잔상 제거(미리보기 iframe).
        _safe(function () { var w = _frameWin(); if (w && typeof w.prevClearDropEffect === "function") { w.prevClearDropEffect(); } });
        // 트리 재렌더 — 잔상/스타일 정리(원본 oModel.refresh 대체).
        _safe(function () { if (typeof oAPP.fn.fnRenderDesignTree === "function") { oAPP.fn.fnRenderDesignTree(); } });
    };

    // U4A_HIDDEN_AREA DIV 영역 추가대상 점검. (원본 1591행 1:1)
    oAPP.fn.designChkHiddenAreaUi = function (UIOBK, PUIOK, UIATT) {
        var ls_UA040 = oAPP.DATA.LIB.T_9011.find(function (a) { return a.CATCD === "UA040" && a.FLD01 === UIOBK && a.FLD07 !== "X"; });
        if (!ls_UA040) { return; }
        if (ls_UA040.FLD04 !== PUIOK) {
            // 131 Target API and UI &1 can only target Location &2.
            _toast("E", _msg("/U4A/MSG_WS", "131", ls_UA040.FLD03, ls_UA040.FLD06));
            return true;
        }
    };

    // 특정 부모에만 허용되는 UI 점검. (원본 1614행 1:1)
    oAPP.fn.designChkFixedParentUI = function (UIOBK, PUIOK, UIATT) {
        var _uw03 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UW03) ? oAPP.attr.S_CODE.UW03 : [];
        var lt_UW03 = _uw03.filter(function (a) { return a.FLD01 === UIOBK && a.FLD06 !== "X"; });
        if (lt_UW03.length === 0) { return; }
        if (lt_UW03.findIndex(function (a) { return a.FLD03 === PUIOK && a.FLD05 === UIATT; }) === -1) {
            var lt_msg = [];
            for (var i = 0, l = lt_UW03.length; i < l; i++) { lt_msg.push(lt_UW03[i].FLD04 + "-" + lt_UW03[i].FLD05); }
            // 306 &1 UI is only allowed for &2 parent.
            _toast("E", _msg("/U4A/MSG_WS", "306", lt_UW03[0].FLD02, lt_msg.join(", ")));
            return true;
        }
    };

    // tree embeded aggregation 아이콘. (원본 1535행 1:1)
    oAPP.fn.setTreeAggrIcon = function (is_tree) {
        if (is_tree.UIATK === "") { return; }
        is_tree.UIATT_ICON = "sap-icon://color-fill";
        if (is_tree.ISMLB === "X") { is_tree.UIATT_ICON = "sap-icon://dimension"; }
    };

    // tree 처리 전용 바인딩 필드 생성. (원본 1731행 1:1 — 복사 노드 렌더용)
    oAPP.fn.crtTreeBindField = function (is_0014) {
        is_0014.drag_enable = true;
        is_0014.drop_enable = _isEdit();
        is_0014.chk_visible = _isEdit();
        is_0014.chk = false;
        is_0014.UICON = "";
        is_0014.UIATT_ICON = "";
        is_0014.icon_visible = false;
        is_0014.highlight = "None";
        if (typeof is_0014.zTREE === "undefined") { is_0014.zTREE = []; }
    };

    // drag 정보 얻기. (원본 3951행 1:1)
    oAPP.fn.getDragParam = function (oEvent) {
        if (!oEvent || !oEvent.mParameters || !oEvent.mParameters.browserEvent ||
            !oEvent.mParameters.browserEvent.dataTransfer || !oEvent.mParameters.browserEvent.dataTransfer.getData) { return; }
        var l_dnd = oEvent.mParameters.browserEvent.dataTransfer.getData("text/plain");
        if (!l_dnd) { return; }
        var lt_split = l_dnd.split("|");
        if (lt_split.length < 2) { return; }
        return lt_split;
    };


    /* ====================================================================
     * 2) aggregation 호환/선택 (원본 chkAggrRelation / aggrSelectPopup)
     * ==================================================================== */

    // 입력 UI 가 target UI 에 추가 가능한 aggregation 목록. (원본 1459행 1:1)
    oAPP.fn.chkAggrRelation = function (tUIOBK, tOBJID, sUIOBK) {
        var lt_sel = [];
        var lt_0023 = oAPP.DATA.LIB.T_0023.filter(function (a) { return a.UIOBK === tUIOBK && a.UIATY === "3" && a.ISDEP !== "X"; });
        if (lt_0023.length === 0) { return lt_sel; }
        var lt_0027 = oAPP.DATA.LIB.T_0027.filter(function (a) { return a.TGOBJ === sUIOBK && a.TOBTY !== "1"; });
        if (lt_0027.length === 0) { return lt_sel; }

        for (var i = 0, l = lt_0023.length; i < l; i++) {
            var l_agrnm = oAPP.fn.getUIAttrFuncName(oAPP.attr.prev[tOBJID], "3", lt_0023[i].UIATT, "_sGetter");
            if (!l_agrnm || !oAPP.attr.prev[tOBJID] || !oAPP.attr.prev[tOBJID][l_agrnm]) { continue; }
            var l_child = oAPP.attr.prev[tOBJID][l_agrnm]();

            if (oAPP.attr.prev[tOBJID]._MODEL && oAPP.attr.prev[tOBJID]._MODEL[lt_0023[i].UIATT] &&
                (l_child !== null && l_child.length !== 0)) { continue; }

            if (lt_0023[i].ISMLB === "" && l_child && typeof l_child._OBJID !== "undefined") { continue; }

            var l_upper = lt_0023[i].UIADT.toUpperCase();
            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIFND === l_upper; });
            if (!ls_0022) { continue; }

            if (sUIOBK === ls_0022.UIOBK) { lt_sel.push(lt_0023[i]); continue; }

            var ls_0027b = lt_0027.find(function (b) { return b.SGOBJ === ls_0022.UIOBK; });
            if (!ls_0027b) { continue; }
            lt_sel.push(lt_0023[i]);
        }
        return lt_sel;
    };

    // AGGREGATION 선택 — 후보 0/1 자동, 2+ 는 HTML5 .u4a-dialog. (원본 aggrSelectPopup.js 1:1 동작)
    oAPP.fn.aggrSelectPopup = function (i_drag, i_drop, retfunc, i_x, i_y, cancelFunc) {

        var lt_sel = oAPP.fn.chkAggrRelation(i_drop.UIOBK, i_drop.OBJID, i_drag.UIOBK);

        // 후보 0 + 같은 부모/aggregation → 순서변경(param undefined).
        if (lt_sel.length === 0 && i_drag.POBID === i_drop.POBID && i_drag.UIATK === i_drop.UIATK) {
            retfunc(undefined, i_drag, i_drop);
            return;
        }
        // 후보 0 → 이동 불가.
        if (lt_sel.length === 0) {
            if (i_drop) { delete i_drop.dropLineInfo; }
            _dnd.effect = "";
            if (typeof cancelFunc === "function") {
                cancelFunc({ RETCD: "E", RCODE: "02", RTMSG: _msg("/U4A/MSG_WS", "262") });
                return;
            }
            // 262 이동 가능한 aggregation 이 존재하지 않습니다.
            _toast("I", _msg("/U4A/MSG_WS", "262"));
            _bindBusy("BUSY_OFF");
            oAPP.fn.setShortcutLock(false);
            try { parent.setBusy(""); } catch (e) { }
            return;
        }
        // 후보 1 → 자동 선택.
        if (lt_sel.length === 1) { retfunc(lt_sel[0], i_drag, i_drop); return; }

        // 후보 2+ → 선택 팝업(.u4a-dialog).
        _aggrSelectDialog(i_drag, i_drop, lt_sel, retfunc, cancelFunc);
    };

    // aggregation 선택 다이얼로그(HTML5). 원본 sap.m.Dialog+Select 대응.
    function _aggrSelectDialog(i_drag, i_drop, lt_sel, retfunc, cancelFunc) {

        // 기존 잔존 제거.
        var oOld = document.getElementById("ws20AggrSelDlg");
        if (oOld) { try { oOld.remove(); } catch (e) { } }

        // 공통 .u4a-dialog 규격(DumpWrite 등과 동일 구조: __header/__body/__footer + 드래그리센터).
        var DLG = document.createElement("dialog");
        DLG.id = "ws20AggrSelDlg";
        DLG.className = "u4a-dialog u4aWs20AggrDlg";

        // A38 Aggregation List - {OBJID}
        var sTitle = _msg("/U4A/CL_WS_COMMON", "A38") + " - " + i_drop.OBJID;
        var sConfirm = _msg("/U4A/CL_WS_COMMON", "A40");   // Confirm
        var sClose = _msg("/U4A/CL_WS_COMMON", "A39");     // Close

        // ── 헤더(아이콘 + 제목 + 닫기 X, 직계) ──
        var oHeader = document.createElement("div");
        oHeader.className = "u4a-dialog__header";
        oHeader.innerHTML = '<i class="fa-solid fa-sitemap"></i><span></span>';
        oHeader.querySelector("span").textContent = sTitle;
        var oX = document.createElement("button");
        oX.type = "button"; oX.className = "u4a-btn-icon";
        oX.title = sClose;
        oX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oHeader.appendChild(oX);
        DLG.appendChild(oHeader);

        // ── 본문(공통 콤보 U4AUI.createSelect — 원본 Select item key=UIATK/text=UIATT) ──
        var oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body u4aWs20AggrBody";

        var sSelKey = String(lt_sel[0].UIATK == null ? "" : lt_sel[0].UIATK);
        var aItems = lt_sel.map(function (r) {
            return { value: String(r.UIATK == null ? "" : r.UIATK), text: String(r.UIATT == null ? "" : r.UIATT) };
        });
        function _onPick(v) { sSelKey = v; }
        if (window.U4AUI && U4AUI.createSelect) {
            var oSel = U4AUI.createSelect(aItems, sSelKey, _onPick);
            oSel.classList.add("u4aWs20AggrSel");
            oBody.appendChild(oSel);
        } else {
            var oNative = document.createElement("select");
            oNative.className = "u4a-input u4aWs20AggrSel";
            aItems.forEach(function (it) { var o = document.createElement("option"); o.value = it.value; o.textContent = it.text; oNative.appendChild(o); });
            oNative.value = sSelKey;
            oNative.addEventListener("change", function () { sSelKey = oNative.value; });
            oBody.appendChild(oNative);
        }
        DLG.appendChild(oBody);

        // ── 푸터(spacer + 확인 파랑 / 닫기 Reject, 아이콘) ──
        var oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer u4aWs20AggrFoot";
        var oSpacer = document.createElement("span");
        oSpacer.className = "u4aWs20AggrFootSpacer";
        oFoot.appendChild(oSpacer);
        var oOk = document.createElement("button");
        oOk.type = "button"; oOk.className = "u4a-btn u4a-btn--emphasized";
        oOk.title = sConfirm;
        oOk.innerHTML = '<i class="fa-solid fa-check"></i>';
        var oCancel = document.createElement("button");
        oCancel.type = "button"; oCancel.className = "u4a-btn u4a-btn--negative";
        oCancel.title = sClose;
        oCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oFoot.appendChild(oOk);
        oFoot.appendChild(oCancel);
        DLG.appendChild(oFoot);

        document.body.appendChild(DLG);

        var bDone = false;
        function _cleanup() {
            try { document.removeEventListener("keydown", _onKey, true); } catch (e) { }
            try { if (DLG.open) { DLG.close(); } } catch (e) { }
            try { DLG.remove(); } catch (e) { }
        }
        // 취소/닫기 — 원본: __dropEffect 초기화 + (cancelFunc 있으면 호출, 없으면 BUSY_OFF+001 토스트).
        function _cancel() {
            if (bDone) { return; }
            bDone = true;
            _dnd.effect = "";
            if (i_drop) { delete i_drop.dropLineInfo; }
            _cleanup();
            if (typeof cancelFunc === "function") {
                cancelFunc({ RETCD: "E", RCODE: "01", RTMSG: _msg("/U4A/MSG_WS", "001") });
            } else {
                _bindBusy("BUSY_OFF");
                oAPP.fn.setShortcutLock(false);
                try { parent.setBusy(""); } catch (e) { }
                // 001 Cancel operation
                _toast("I", _msg("/U4A/MSG_WS", "001"));
            }
        }
        function _confirm() {
            if (bDone) { return; }
            bDone = true;
            var ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) { return a.UIATK === sSelKey; });
            _cleanup();
            retfunc(ls_0023, i_drag, i_drop);
        }
        function _onKey(ev) { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); _cancel(); } }

        oX.addEventListener("click", _cancel);
        oCancel.addEventListener("click", _cancel);
        oOk.addEventListener("click", _confirm);
        // ESC = 취소(공통 dialog cancel 이벤트).
        DLG.addEventListener("cancel", function (e) { e.preventDefault(); _cancel(); });
        document.addEventListener("keydown", _onKey, true);

        try { DLG.showModal(); } catch (e) { try { DLG.show(); } catch (e2) { } }
        // 공통 다이얼로그 드래그/리센터(헤더 핸들).
        _safe(function () { if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(DLG, oHeader); } });
        // 팝업 떴으니 busy 해제(원본 afterOpen: parent.setBusy("")).
        try { parent.setBusy(""); } catch (e) { }
        oAPP.fn.setShortcutLock(false);
    }


    /* ====================================================================
     * 3) drop 대상 라인 계산 (원본 getDropTargetLine, HTML5 버전)
     *    UI5 getRows()/isExpanded() → _visibleFlat()/_isExpandedNode().
     * ==================================================================== */
    oAPP.oDesign.fn.getDropTargetLine = function (sDNDInfo) {
        if (!sDNDInfo || typeof sDNDInfo.sDrop === "undefined") { return; }
        if (typeof sDNDInfo.sDropLineInfo === "undefined") { return; }

        var _sTarget = sDNDInfo.sDrop;
        var _info = sDNDInfo.sDropLineInfo;

        // On → 대상 노드 자체에(마지막 자식으로) 추가.
        if (_info.dropPosition === "On") {
            _sTarget.dropLineInfo = _info;
            return _sTarget;
        }

        var aFlat = _visibleFlat();
        var _targetPos = aFlat.findIndex(function (n) { return n.OBJID === _sTarget.OBJID; });
        if (_targetPos === -1) { return; }

        // Before → 직전(위) 행을 기준으로.
        if (_info.dropPosition === "Before") {
            var _prev = aFlat[_targetPos - 1];
            if (typeof _prev === "undefined") { return; }
            _sTarget = _prev;
        }

        // 기준 행이 펼침 상태면 그 첫 자식(0) 위치.
        if (_isExpandedNode(_sTarget) && _sTarget.zTREE && _sTarget.zTREE.length > 0) {
            _info.dropIndex = 0;
            _sTarget.dropLineInfo = _info;
            return _sTarget;
        }

        // 접힘(또는 자식없음) → 부모를 drop 대상으로, 부모 내 위치 계산.
        var _sParent = oAPP.fn.getTreeData(_sTarget.POBID);
        if (typeof _sParent === "undefined" || _sParent === null) { return; }

        _info.dropIndex = _sParent.zTREE.findIndex(function (item) { return item.OBJID === _sTarget.OBJID; });

        if (typeof sDNDInfo.sDrag === "undefined") {
            _info.dropIndex++;
            _sParent.dropLineInfo = _info;
            return _sParent;
        }

        var _beforeDragPos = _sParent.zTREE.findIndex(function (item) { return item.OBJID === sDNDInfo.sDrag.OBJID; });
        if (_beforeDragPos === -1) { _info.dropIndex++; }
        else if (_beforeDragPos > _info.dropIndex) { _info.dropIndex++; }
        else if (_beforeDragPos <= _info.dropIndex && _dnd.effect === "Copy") { _info.dropIndex++; }

        _sParent.dropLineInfo = _info;
        return _sParent;
    };


    /* ====================================================================
     * 4) 미리보기/모델 보조 (원본 1:1 — iframe 함수 재사용)
     * ==================================================================== */

    // 미리보기 UI 제거(이전 부모에서). (원본 uiPreviewArea.js 1571행 1:1)
    oAPP.oDesign.fn.prevRemoveUiObject = function (is_tree) {
        return new Promise(function (resolve) {
            _safe(function () {
                var w = _frameWin();
                if (w && typeof w.delUIObjPreView === "function") {
                    w.delUIObjPreView(is_tree.OBJID, is_tree.POBID, is_tree.PUIOK, is_tree.UIATT, is_tree.ISMLB, is_tree.UIOBK);
                }
            });
            return resolve();
        });
    };

    // 미리보기 UI 다시 생성. (원본 3408행 1:1 — destroy+redraw+예외처리)
    oAPP.fn.reCreateUIObjInstance = function (is_tree) {
        if (oAPP.common.checkWLOList("C", "UHAK900681") !== true) { return; }

        if (oAPP.attr.UA015UI && oAPP.attr.UA015UI._OBJID === is_tree.OBJID) { oAPP.attr.UA015UI = null; }

        var oPrev = oAPP.attr.prev[is_tree.OBJID];
        var _indx = (oPrev && oPrev._T_0015) ? oPrev._T_0015.findIndex(function (item) { return item.UIATY === "6"; }) : -1;
        var ls_embed;
        if (_indx !== -1) { ls_embed = oPrev._T_0015[_indx]; oPrev._T_0015.splice(_indx, 1); }

        var w = _frameWin();
        _safe(function () { if (w && typeof w.destroyUIPreView === "function") { w.destroyUIPreView(is_tree.OBJID); } });
        _safe(function () { if (w && typeof w.redrawUIScript === "function") { w.redrawUIScript([is_tree]); } });
        _safe(function () { if (w && typeof w.setChildUiException === "function") { w.setChildUiException(is_tree.UIOBK, is_tree.OBJID, is_tree.zTREE, oAPP.attr.S_CODE.UA050); } });
        oAPP.fn.prevDrawExceptionUi(is_tree.UIOBK, is_tree.OBJID);

        if (_indx !== -1 && oAPP.attr.prev[is_tree.OBJID] && oAPP.attr.prev[is_tree.OBJID]._T_0015) {
            oAPP.attr.prev[is_tree.OBJID]._T_0015.push(ls_embed);
        }
        if (oAPP.attr.prev[is_tree.OBJID]) { oAPP.attr.prev[is_tree.OBJID].__PARENT = oAPP.attr.prev[is_tree.POBID]; }
    };

    // N건 바인딩 해제. (원본 3466행 1:1 — attrUnbindProp 가드)
    oAPP.fn.designUnbindUi = function (is_tree, i_path, bUnbind) {
        if (!i_path) { return; }
        var oPrev = oAPP.attr.prev[is_tree.OBJID];
        if (!oPrev || !oPrev._T_0015 || oPrev._T_0015.length === 0) { return; }

        if (is_tree.zTREE.length !== 0) {
            for (var i = 0, l = is_tree.zTREE.length; i < l; i++) { oAPP.fn.designUnbindUi(is_tree.zTREE[i], i_path, bUnbind); }
        }
        for (var j = oPrev._T_0015.length - 1; j >= 0; j--) {
            if (oPrev._T_0015[j].ISBND !== "X") { continue; }
            if (oPrev._T_0015[j].UIATV.substr(0, i_path.length) === i_path) {
                if (typeof oAPP.fn.attrUnbindProp === "function") { _safe(function () { oAPP.fn.attrUnbindProp(oPrev._T_0015[j]); }); }
                if (!bUnbind) { continue; }
                oPrev._T_0015.splice(j, 1);
            }
        }
    };

    // 직접입력 가능한 aggregation 의 이전 직접입력건 반영. (원본 uiPreviewArea.js 675행 1:1 — previewUIsetProp 가드)
    oAPP.fn.previewSetStrAggr = function (is_tree) {
        if (is_tree.PUIATK === "") { return; }
        if (is_tree.POBID === "") { return; }
        if (!oAPP.attr.prev[is_tree.POBID]) { return; }
        if (!oAPP.attr.prev[is_tree.POBID]._T_0015) { return; }
        if (oAPP.attr.prev[is_tree.POBID]._T_0015.length === 0) { return; }
        var ls_0015 = oAPP.attr.prev[is_tree.POBID]._T_0015.find(function (a) { return a.UIATK === is_tree.PUIATK + "_1"; });
        if (!ls_0015) { return; }
        if (typeof oAPP.fn.previewUIsetProp === "function") { _safe(function () { oAPP.fn.previewUIsetProp(ls_0015); }); }
    };

    // 미리보기 예외처리 UI draw. (원본 uiPreviewArea.js 806행 — 차트/AppContain 미변환 → 서브펑션 가드)
    oAPP.fn.prevDrawExceptionUi = function (UIOBK, OBJID) {
        var aFns = ["prevSetUiExcepMark", "prevAmRadarChartsDraw", "prevAmSerialChartStackDraw",
            "prevAmSerialChartCompositeDraw", "prevAmSerialChartDraw", "prevAmPieChartDraw"];
        for (var i = 0; i < aFns.length; i++) {
            if (typeof oAPP.fn[aFns[i]] === "function") {
                var bStop; try { bStop = oAPP.fn[aFns[i]](UIOBK, OBJID); } catch (e) { console.error("[HTML5][WS20][dnd] prevDrawExceptionUi", e); }
                if (bStop) { return; }
            }
        }
    };

    // 디자인 영역 모델 갱신. (원본 5472행: UI5 트리/attr rowsUpdated 대기 → HTML5: 트리 재렌더)
    oAPP.fn.designRefershModel = function () {
        return new Promise(function (resolve) {
            _safe(function () { if (typeof oAPP.fn.fnRenderDesignTree === "function") { oAPP.fn.fnRenderDesignTree(); } });
            return resolve();
        });
    };

    // 바인딩 팝업 디자인데이터 갱신. (원본 1263행 — bindPopup 미변환 → 존재 시 위임, 없으면 skip)
    if (typeof oAPP.fn.updateBindPopupDesignData !== "function") {
        oAPP.fn.updateBindPopupDesignData = function () {
            // bindPopup(별창)은 미변환. 변환 시 broadcastChannelBindPopup 로 디자인데이터 동기화 연결.
            return Promise.resolve();
        };
    }

    // onAfterRendering 모듈(미리보기 UI5 컨트롤 대상) 로드.
    function _renderMod() { return _req("setOnAfterRender"); }


    /* ====================================================================
     * 5) drop 처리 (원본 UIDrop 3976행 1:1)
     *    호출: (a) 트리 네이티브 drop(_onTreeDrop 가 synth oEvent),
     *          (b) 미리보기 iframe UI5 DropInfo(parent.oAPP.fn.UIDrop(oEvent, objid)).
     * ==================================================================== */
    oAPP.fn.UIDrop = function (oEvent, i_OBJID) {
        if (!i_OBJID) { return; }

        var _dropPosition = oEvent && oEvent.mParameters ? oEvent.mParameters.dropPosition : undefined;

        _bindBusy("BUSY_ON", _busyOption("215"));

        var lt_dragInfo = oAPP.fn.getDragParam(oEvent);
        if (!lt_dragInfo || lt_dragInfo.length !== 3) { _bindBusy("BUSY_OFF"); return; }

        if (lt_dragInfo[0] !== "designTree" && lt_dragInfo[0] !== "previewArea") { _bindBusy("BUSY_OFF"); return; }

        // 다른 세션 drag 정보 차단.
        if (lt_dragInfo[2] !== oAPP.attr.DnDRandKey) {
            // 102 다른 영역에서의 Drag 정보는 처리할 수 없습니다.
            _toast("E", _wsc("102"));
            _bindBusy("BUSY_OFF"); return;
        }

        var l_objid = lt_dragInfo[1];
        if (!l_objid) {
            // 103 Drag 한 UI 정보가 존재하지 않습니다.
            _toast("E", _wsc("103"));
            _bindBusy("BUSY_OFF"); return;
        }

        var l_drag = oAPP.fn.getTreeData(l_objid);
        if (!l_drag) { _toast("E", _wsc("103")); _bindBusy("BUSY_OFF"); return; }

        var l_drop = oAPP.fn.getTreeData(i_OBJID);
        if (!l_drop) { _bindBusy("BUSY_OFF"); return; }

        var _sDNDInfo = { sDrag: l_drag, sDrop: l_drop, sDropLineInfo: { dropPosition: _dropPosition, dropIndex: l_drop.zTREE.length } };

        l_drop = oAPP.oDesign.fn.getDropTargetLine(_sDNDInfo);
        if (typeof l_drop === "undefined") {
            // 245 DROP 처리 UI 를 찾을 수 없습니다.
            _toast("E", _wsc("245"));
            _bindBusy("BUSY_OFF"); return;
        }

        if (l_drag.OBJID === l_drop.OBJID) {
            delete l_drop.dropLineInfo;
            // 246 해당 영역에 UI 를 DROP 할 수 없습니다.
            _toast("E", _wsc("246"));
            _bindBusy("BUSY_OFF"); return;
        }

        if (oAPP.fn.designChkHiddenAreaUi(l_drag.UIOBK, l_drop.UIOBK) === true) {
            delete l_drop.dropLineInfo; _bindBusy("BUSY_OFF"); return;
        }

        if (oAPP.fn.chkDnDPossible(l_drag.zTREE, l_drop.OBJID)) {
            delete l_drop.dropLineInfo; _toast("E", _wsc("246")); _bindBusy("BUSY_OFF"); return;
        }

        if (l_drop.drop_enable === false) {
            delete l_drop.dropLineInfo; _toast("E", _wsc("246")); _bindBusy("BUSY_OFF"); return;
        }

        var l_pos = oAPP.fn.getMousePosition();
        oAPP.fn.aggrSelectPopup(l_drag, l_drop, oAPP.fn.drop_cb, l_pos.x, l_pos.y);
        return true;
    };


    /* ====================================================================
     * 6) drop callback — 실제 이동/복사 (원본 drop_cb 2795행 1:1)
     * ==================================================================== */
    oAPP.fn.drop_cb = async function (param, i_drag, i_drop) {

        var _sDropLineInfo = (i_drop && i_drop.dropLineInfo) || undefined;
        if (i_drop) { delete i_drop.dropLineInfo; }
        if (typeof _sDropLineInfo === "undefined") {
            _sDropLineInfo = { dropPosition: undefined, dropIndex: i_drop.zTREE.length };
        }

        var l_effect = _dnd.effect;
        _dnd.effect = "";

        function _exit() { _bindBusy("BUSY_OFF"); oAPP.fn.setShortcutLock(false); try { parent.setBusy(""); } catch (e) { } }

        // ── CASE A : 같은 부모/같은 aggregation 순서변경 (param undefined) ──
        if (typeof param === "undefined" && i_drag.POBID === i_drop.POBID && i_drag.UIATK === i_drop.UIATK) {

            var l_parent = oAPP.fn.getTreeData(i_drop.POBID);
            if (typeof l_parent === "undefined") {
                // 106 &1 UI 정보를 찾을 수 없습니다.
                _toast("E", _wsc("106", i_drop.POBID)); _exit(); return;
            }

            // UNDO (HTML5 단일스택).
            _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); } });

            var w = _frameWin();
            var l_funcnm = oAPP.fn.getUIAttrFuncName(oAPP.attr.prev[i_drag.POBID], "3", i_drag.UIATT, "_sIndexGetter");
            var _dragPos = _safe(function () { return oAPP.attr.prev[i_drag.POBID][l_funcnm](oAPP.attr.prev[i_drag.OBJID]); });
            var _dropPos = _safe(function () { return oAPP.attr.prev[i_drop.POBID][l_funcnm](oAPP.attr.prev[i_drop.OBJID]); });

            await oAPP.oDesign.fn.prevRemoveUiObject(i_drag);
            await oAPP.oDesign.fn.prevRemoveUiObject(i_drop);
            oAPP.fn.reCreateUIObjInstance(i_drag);
            oAPP.fn.reCreateUIObjInstance(i_drop);

            var l_dragIndex = l_parent.zTREE.findIndex(function (a) { return a.OBJID === i_drag.OBJID; });
            var l_dropIndex = l_parent.zTREE.findIndex(function (a) { return a.OBJID === i_drop.OBJID; });

            if (l_dragIndex > l_dropIndex) {
                l_parent.zTREE.splice(l_dragIndex, 1);
                l_parent.zTREE.splice(l_dropIndex, 1);
                l_parent.zTREE.splice(l_dropIndex, 0, i_drag);
                l_parent.zTREE.splice(l_dragIndex, 0, i_drop);
                _safe(function () { w.moveUIObjPreView(i_drag.OBJID, i_drag.UILIB, i_drag.POBID, i_drag.PUIOK, i_drag.UIATT, _dropPos, i_drag.ISMLB, i_drag.UIOBK); });
                _safe(function () { w.moveUIObjPreView(i_drop.OBJID, i_drop.UILIB, i_drop.POBID, i_drop.PUIOK, i_drop.UIATT, _dragPos, i_drop.ISMLB, i_drop.UIOBK); });
            } else {
                l_parent.zTREE.splice(l_dropIndex, 1);
                l_parent.zTREE.splice(l_dragIndex, 1);
                l_parent.zTREE.splice(l_dragIndex, 0, i_drop);
                l_parent.zTREE.splice(l_dropIndex, 0, i_drag);
                _safe(function () { w.moveUIObjPreView(i_drop.OBJID, i_drop.UILIB, i_drop.POBID, i_drop.PUIOK, i_drop.UIATT, _dragPos, i_drop.ISMLB, i_drop.UIOBK); });
                _safe(function () { w.moveUIObjPreView(i_drag.OBJID, i_drag.UILIB, i_drag.POBID, i_drag.PUIOK, i_drag.UIATT, _dropPos, i_drag.ISMLB, i_drag.UIOBK); });
            }

            await _rerenderParent(l_parent);

            await oAPP.fn.designRefershModel();
            oAPP.fn.designDragEnd();
            oAPP.fn.setChangeFlag();
            oAPP.fn.updateBindPopupDesignData();
            await oAPP.fn.setSelectTreeItem(i_drag.OBJID);
            // 005 Job finished.
            _toast("I", _msg("/U4A/MSG_WS", "005"));
            return;
        }

        // ── 이동/복사 공통 검증 ──
        if (oAPP.fn.chkUiCardinality(i_drop, param.UIATK, param.ISMLB) === true) { _exit(); return; }
        if (oAPP.fn.designChkFixedParentUI(i_drag.UIOBK, i_drop.UIOBK, param.UIATT) === true) { _exit(); return; }

        var _denyParam = { UIOBK: i_drop.UIOBK, UIATT: param.UIATT, CHILD_UIOBK: i_drag.UIOBK };
        var _exMod = null;
        _safe(function () { _exMod = parent.require(parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "js", "exception", "exceptionUI.js")); });
        if (_exMod) {
            var _deny = false; _safe(function () { _deny = _exMod.checkDenyChildAggr(_denyParam); });
            if (_deny === true) {
                // 214 &1 UI 는 &2 의 &3 Aggregation 에 추가 할 수 없습니다.
                _toast("E", _wsc("214", i_drag.OBJID, i_drop.OBJID, param.UIATT)); _exit(); return;
            }
            var _allow = true; _safe(function () { _allow = _exMod.checkAllowChildAggr({ PUIOK: i_drop.UIOBK, UIATT: param.UIATT, UIOBK: i_drag.UIOBK }); });
            if (_allow !== true) {
                _toast("E", _wsc("214", i_drag.OBJID, i_drop.OBJID, param.UIATT)); _exit(); return;
            }
        }

        // ── CASE B : 복사(Ctrl) ──
        if (l_effect === "Copy") {
            i_drop.dropLineInfo = _sDropLineInfo;
            await oAPP.fn.designCopyUI(i_drag, i_drop, param);
            return;
        }

        // ── CASE C : 다른 부모/aggregation 이동 ──
        var l_parentC = oAPP.fn.getTreeData(i_drag.POBID);
        if (typeof l_parentC === "undefined") { _exit(); return; }
        var l_indx = l_parentC.zTREE.findIndex(function (a) { return a.OBJID === i_drag.OBJID; });
        if (l_indx === -1) { _exit(); return; }

        _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); } });

        var wC = _frameWin();

        // 기존 부모에서 제거.
        l_parentC.zTREE.splice(l_indx, 1);

        var lt_ua050 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA050" && a.FLD08 !== "X"; });
        _safe(function () { if (wC && typeof wC.setChildUiException === "function") { wC.setChildUiException(l_parentC.UIOBK, l_parentC.OBJID, l_parentC.zTREE, lt_ua050); } });

        oAPP.fn.previewSetStrAggr(i_drag);

        if (typeof i_drop.zTREE === "undefined") { i_drop.zTREE = []; }
        await oAPP.oDesign.fn.prevRemoveUiObject(i_drag);

        // 새 부모에 추가.
        i_drop.zTREE.splice(_sDropLineInfo.dropIndex, 0, i_drag);

        var _beforePOBID = i_drag.POBID;
        var _beforeUIATT = i_drag.UIATT;

        // 부모/aggregation 정보 변경.
        i_drag.POBID = i_drop.OBJID;
        i_drag.PUIOK = i_drop.UIOBK;
        i_drag.UIATK = param.UIATK;
        i_drag.UIATT = param.UIATT;
        i_drag.UIASN = param.UIASN;
        i_drag.UIATY = param.UIATY;
        i_drag.UIADT = param.UIADT;
        i_drag.UIADS = param.UIADS;
        i_drag.ISMLB = param.ISMLB;
        i_drag.PUIATK = param.UIATK;

        oAPP.fn.setTreeAggrIcon(i_drag);

        // EMBEDDED aggregation 정보 갱신.
        var oPrevDrag = oAPP.attr.prev[i_drag.OBJID];
        var ls_embed = (oPrevDrag && oPrevDrag._T_0015) ? oPrevDrag._T_0015.find(function (a) { return a.UIATY === "6"; }) : null;
        if (ls_embed) { oAPP.fn.moveCorresponding(param, ls_embed); ls_embed.UIATY = "6"; }

        var _UIATT;
        if (i_drag.UIOBK === "UO01127" && i_drag.zTREE.findIndex(function (item) { return item.UIATT === "template"; }) !== -1) { _UIATT = "template"; }
        if (_beforePOBID === i_drop.OBJID && _beforeUIATT === param.UIATT) { _UIATT = undefined; }

        var l_path = oAPP.fn.getParentAggrBind(oAPP.attr.prev[i_drag.OBJID], _UIATT);
        var l_path2 = oAPP.fn.getParentAggrBind(oAPP.attr.prev[i_drop.OBJID], param.UIATT);
        var l_unbind = false;
        if (l_path && l_path !== "" && l_path !== l_path2) { l_unbind = true; }
        oAPP.fn.designUnbindUi(i_drag, l_path, l_unbind);

        // 트리 재렌더(원본 _buildTree 대체).
        _safe(function () { if (typeof oAPP.fn.fnRenderDesignTree === "function") { oAPP.fn.fnRenderDesignTree(); } });

        // 이전 부모 rerender + drag 인스턴스 재생성.
        await _rerenderParentWithRecreate(l_parentC, i_drag);

        // 새 부모 내 위치(_cnt: UA026 제외 UI 카운트).
        var _aIndex = i_drop.zTREE.filter(function (a) { return a.UIATT === i_drag.UIATT; });
        var _dragPosC = _aIndex.findIndex(function (item) { return item.OBJID === i_drag.OBJID; });
        var _cnt = 0;
        for (var ci = 0; ci < _dragPosC; ci++) {
            var _sTreeC = i_drop.zTREE[ci];
            if (_isUa026(_sTreeC.UILIB)) { continue; }
            _cnt++;
        }

        // 새 부모 미리보기 추가 + rerender.
        await _rerenderParentMove(i_drop, function () {
            _safe(function () {
                if (wC && typeof wC.moveUIObjPreView === "function") {
                    wC.moveUIObjPreView(i_drag.OBJID, i_drag.UILIB, i_drag.POBID, i_drag.PUIOK, i_drag.UIATT, _cnt, i_drag.ISMLB, i_drag.UIOBK, true);
                }
            });
        });

        oAPP.fn.setModelBind(oAPP.attr.prev[i_drag.OBJID]);

        await oAPP.fn.designRefershModel();
        await oAPP.fn.setSelectTreeItem(i_drag.OBJID);
        oAPP.fn.designDragEnd();
        oAPP.fn.setChangeFlag();
        // 005 Job finished.
        _toast("I", _msg("/U4A/MSG_WS", "005"));
        oAPP.fn.updateBindPopupDesignData();
    };


    // 클라이언트 이벤트(HTML/CSS/JS) 복사. (원본 uiDesignArea.js 2130행 대응 —
    //   원본 _T_0015(ADDSC≠"") 기준 → T_CEVT(키=OBJID+UIASN) 에서 이벤트를 찾아 새 UI OBJID 로
    //   재키잉해 push. 원본은 find(1건)이나 HM/CS/JS 다건 보존 위해 filter 로 전건 복사.)
    if (typeof oAPP.fn.copyUiClientEvent !== "function") {
        oAPP.fn.copyUiClientEvent = function (OBJID, is_tree) {
            var A = oAPP.DATA.APPDATA;
            if (!A || !Array.isArray(A.T_CEVT) || A.T_CEVT.length === 0) { return; }
            var oPrev = oAPP.attr.prev[OBJID];
            if (!oPrev || !Array.isArray(oPrev._T_0015)) { return; }
            var lt_event = oPrev._T_0015.filter(function (a) { return a.ADDSC !== ""; });
            for (var i = 0; i < lt_event.length; i++) {
                var sKey = lt_event[i].OBJID + lt_event[i].UIASN;
                var aCe = A.T_CEVT.filter(function (a) { return a.OBJID === sKey; });
                for (var j = 0; j < aCe.length; j++) {
                    A.T_CEVT.push({ OBJID: is_tree.OBJID + lt_event[i].UIASN, OBJTY: aCe[j].OBJTY, DATA: aCe[j].DATA });
                }
            }
        };
    }

    // Description 복사. (원본 uiAttributeArea.js 7814행 1:1 — getDesc/setDesc 는 HTML5 존재)
    if (typeof oAPP.fn.copyDesc !== "function") {
        oAPP.fn.copyDesc = function (ORG_OBJID, OBJID) {
            if (typeof oAPP.fn.getDesc !== "function" || typeof oAPP.fn.setDesc !== "function") { return; }
            var l_desc = oAPP.fn.getDesc(ORG_OBJID);
            if (l_desc === "" || l_desc == null) { return; }
            oAPP.fn.setDesc(OBJID, l_desc);
        };
    }

    /* ====================================================================
     * 7) 복사 (원본 designCopyUI 2453행 1:1)
     * ==================================================================== */
    oAPP.fn.designCopyUI = async function (is_t, is_p, aggrParam) {

        var w = _frameWin();
        var _sDropLineInfo = (is_p && is_p.dropLineInfo) || undefined;
        if (is_p) { delete is_p.dropLineInfo; }
        if (typeof _sDropLineInfo === "undefined") {
            _sDropLineInfo = { dropPosition: undefined, dropIndex: is_p.zTREE.length };
        }

        var lt_ua018 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA018"; });
        var lt_ua026 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA026" && a.FLD02 !== "X"; });
        var lt_ua030 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA030" && a.FLD06 !== "X"; });
        var lt_ua032 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA032" && a.FLD06 !== "X"; });
        var lt_ua050 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA050" && a.FLD08 !== "X"; });

        function lf_copy0015(is_14, is_tree, i_aggr) {
            var oPrev = oAPP.attr.prev[is_tree.OBJID];
            if (!oPrev || !oPrev._T_0015 || oPrev._T_0015.length === 0) { return; }
            var lt_0015 = [];
            for (var i = 0, l = oPrev._T_0015.length; i < l; i++) {
                var ls_15 = oAPP.fn.crtStru0015();
                oAPP.fn.moveCorresponding(oPrev._T_0015[i], ls_15);
                ls_15.APPID = oAPP.attr.appInfo.APPID;
                ls_15.GUINR = oAPP.attr.appInfo.GUINR;
                ls_15.OBJID = is_14.OBJID;
                if (i_aggr && ls_15.UIATY === "6") {
                    ls_15.UIATK = i_aggr.UIATK; ls_15.UIATT = i_aggr.UIATT; ls_15.UIASN = i_aggr.UIASN;
                    ls_15.UIADT = i_aggr.UIADT; ls_15.UIADS = i_aggr.UIADS; ls_15.ISMLB = i_aggr.ISMLB;
                }
                lt_0015.push(ls_15);
            }
            return lt_0015;
        }

        function lf_copy0014(is_tree, is_parent, i_aggr) {
            var ls_14 = oAPP.fn.crtStru0014();
            oAPP.fn.moveCorresponding(is_tree, ls_14);
            oAPP.fn.crtTreeBindField(ls_14);

            ls_14.APPID = oAPP.attr.appInfo.APPID;
            ls_14.GUINR = oAPP.attr.appInfo.GUINR;
            ls_14.OBJID = ls_14.OBJID.replace(/\d/g, "");
            ls_14.OBJID = oAPP.fn.setOBJID(ls_14.OBJID);
            ls_14.POBID = is_parent.OBJID;
            ls_14.PUIOK = is_parent.UIOBK;

            if (typeof oAPP.fn.setTreeUiIcon === "function") { _safe(function () { oAPP.fn.setTreeUiIcon(ls_14); }); }

            ls_14.chk = false; ls_14.chk_visible = true; ls_14.visible_add = true; ls_14.visible_delete = true;

            if (i_aggr) {
                ls_14.UIATK = i_aggr.UIATK; ls_14.UIATT = i_aggr.UIATT; ls_14.UIASN = i_aggr.UIASN;
                ls_14.UIATY = i_aggr.UIATY; ls_14.UIADT = i_aggr.UIADT; ls_14.UIADS = i_aggr.UIADS;
                ls_14.ISMLB = i_aggr.ISMLB; ls_14.PUIATK = i_aggr.UIATK;
            }

            var lt_0015 = lf_copy0015(ls_14, is_tree, i_aggr);
            oAPP.fn.setTreeAggrIcon(ls_14);

            if (typeof oAPP.fn.copyDesc === "function") { _safe(function () { oAPP.fn.copyDesc(is_tree.OBJID, ls_14.OBJID); }); }
            if (typeof oAPP.fn.copyUiClientEvent === "function") { _safe(function () { oAPP.fn.copyUiClientEvent(is_tree.OBJID, ls_14); }); }

            if (typeof i_aggr === "undefined") { is_parent.zTREE.push(ls_14); }
            else { is_parent.zTREE.splice(_sDropLineInfo.dropIndex, 0, ls_14); }

            var l_UILIB = ls_14.UILIB;
            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UOBK === ls_14.UIOBK; });
            if (ls_0022) { l_UILIB = ls_0022.LIBNM; }

            if (typeof i_aggr === "undefined") {
                _safe(function () { if (w && w.addUIObjPreView) { w.addUIObjPreView(ls_14.OBJID, ls_14.UIOBK, l_UILIB, ls_14.UIFND, ls_14.POBID, ls_14.PUIOK, ls_14.UIATT, lt_0015, lt_ua018, lt_ua032, lt_ua030, lt_ua026, lt_ua050); } });
            } else {
                _safe(function () { if (w && w.createUIInstance) { w.createUIInstance(ls_14, lt_0015); } });
                _safe(function () { if (w && w.setRichTextEditorException) { w.setRichTextEditorException(ls_14.UIOBK, ls_14.OBJID); } });
                _safe(function () { if (w && w.setChildUiException) { w.setChildUiException(ls_14.UIOBK, ls_14.OBJID, ls_14.zTREE, oAPP.attr.S_CODE.UA050); } });

                var _aIndex = is_parent.zTREE.filter(function (a) { return a.UIATT === ls_14.UIATT; });
                var _dragPos = _aIndex.findIndex(function (item) { return item.OBJID === ls_14.OBJID; });
                var _cnt = 0;
                for (var i = 0; i < _dragPos; i++) {
                    var _sTree = is_parent.zTREE[i];
                    if (_isUa026(_sTree.UILIB)) { continue; }
                    _cnt++;
                }
                _safe(function () { if (w && w.moveUIObjPreView) { w.moveUIObjPreView(ls_14.OBJID, ls_14.UILIB, ls_14.POBID, ls_14.PUIOK, ls_14.UIATT, _cnt, ls_14.ISMLB, ls_14.UIOBK, true); } });
                oAPP.fn.prevDrawExceptionUi(ls_14.UIOBK, ls_14.OBJID);
            }

            if (is_tree.zTREE && is_tree.zTREE.length !== 0) {
                for (var ci = 0, cl = is_tree.zTREE.length; ci < cl; ci++) { lf_copy0014(is_tree.zTREE[ci], ls_14); }
            }
            if (i_aggr) { return ls_14; }
        }

        var ls_copy = lf_copy0014(is_t, is_p, aggrParam);

        // UNDO (HTML5 단일스택 — 원본 undoRedo COPY 대체).
        _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo(); } });

        await _rerenderParent(is_p);

        await oAPP.fn.designRefershModel();
        oAPP.fn.designDragEnd();
        oAPP.fn.setChangeFlag();
        oAPP.fn.updateBindPopupDesignData();
        if (ls_copy) { await oAPP.fn.setSelectTreeItem(ls_copy.OBJID); }
        // 272 &1 has been copied.
        _toast("I", _msg("/U4A/MSG_WS", "272", "UI"));
    };


    /* ====================================================================
     * 8) onAfterRendering 대기 헬퍼 (원본 setOnAfterRender 모듈 패턴 캡슐화)
     * ==================================================================== */
    // 부모 미리보기 rerender 대기.
    async function _rerenderParent(parentNode) {
        var R = _renderMod(); if (!R) { return; }
        await _rerenderCore(R, parentNode, parentNode, null);
    }
    // CASE C: 이전 부모 rerender + 그 사이 drag 인스턴스 재생성(원본 순서 유지).
    async function _rerenderParentWithRecreate(parentNode, dragNode) {
        var R = _renderMod(); if (!R) { oAPP.fn.reCreateUIObjInstance(dragNode); return; }
        await _rerenderCore(R, parentNode, parentNode, function () { oAPP.fn.reCreateUIObjInstance(dragNode); });
    }
    // CASE C: 새 부모 rerender + 그 사이 moveUIObjPreView 실행.
    async function _rerenderParentMove(parentNode, midFn) {
        var R = _renderMod(); if (!R) { if (midFn) { midFn(); } return; }
        await _rerenderCore(R, parentNode, parentNode, midFn);
    }
    // 공통: setAfterRendering 등록 → mid 작업 → rerender → await + RichTextEditor 대기.
    async function _rerenderCore(R, prevKeyNode, rteNode, midFn) {
        var oTarget = null, oDom = null, oPromise = null, aRte = [];
        _safe(function () { oTarget = R.getTargetAfterRenderingUI(oAPP.attr.prev[prevKeyNode.OBJID]); });
        _safe(function () { oDom = (oTarget && typeof oTarget.getDomRef === "function") ? oTarget.getDomRef() : null; });
        _safe(function () { if (oDom) { oPromise = R.setAfterRendering(oTarget); } });
        if (typeof midFn === "function") { _safe(midFn); }
        _safe(function () { aRte = R.renderingRichTextEditor(rteNode) || []; });
        if (oPromise) {
            try { oTarget.rerender(); await oPromise; } catch (e) { console.error("[HTML5][WS20][dnd] rerender", e); }
        }
        try { await Promise.all(aRte); } catch (e) { }
    }


    /* ====================================================================
     * 9) 트리 행 네이티브 D&D 배선
     *    rowHook 데코(draggable + 드롭불가표시) + 컨테이너 위임 이벤트.
     * ==================================================================== */

    // tree.js rowHook 에서 호출 — 행에 draggable/표시 부여.
    oAPP.fn.fnWs20DndDecorateRow = function (oRow, n) {
        if (!oRow || !n) { return; }
        // ROOT 제외 모든 행 draggable(원본 drag_enable: display 에서도 드래그 허용).
        oRow.draggable = (n.OBJID !== "ROOT");
        // 활성 드래그 중 → drop 가능/불가 표시.
        if (_dnd.active) {
            if (n.OBJID === _dnd.dragObjid) { oRow.classList.add("u4aWs20TreeDragging"); }
            if (n.drop_enable !== true) { oRow.classList.add("u4aWs20TreeDropNo"); }
        }
    };

    // 행 rect 기준 포인터 Y → "On"/"Before"/"After" (원본 OnOrBetween).
    function _calcDropPos(oRow, clientY) {
        var r = oRow.getBoundingClientRect();
        var rel = clientY - r.top;
        var h = r.height || 1;
        if (rel < h * 0.25) { return "Before"; }
        if (rel > h * 0.75) { return "After"; }
        return "On";
    }

    function _clearDropMark(oPane) {
        var a = oPane.querySelectorAll(".u4aWs20DropOn,.u4aWs20DropBefore,.u4aWs20DropAfter");
        for (var i = 0; i < a.length; i++) { a[i].classList.remove("u4aWs20DropOn", "u4aWs20DropBefore", "u4aWs20DropAfter"); }
    }

    function _installDnd() {
        var oPane = document.getElementById("ws20DesignTree");
        if (!oPane || oPane.__u4aDndWired) { return; }
        oPane.__u4aDndWired = true;

        // dragstart — 행에서 시작.
        oPane.addEventListener("dragstart", function (ev) {
            var oRow = ev.target && ev.target.closest ? ev.target.closest(".u4aWs20TreeRow[data-objid]") : null;
            if (!oRow) { return; }
            var sObjid = oRow.getAttribute("data-objid");
            if (sObjid === "ROOT") { ev.preventDefault(); return; }
            var oNode = oAPP.fn.getTreeData(sObjid);
            if (!oNode) { ev.preventDefault(); return; }

            try { ev.dataTransfer.effectAllowed = "copyMove"; } catch (e) { }
            // rtmcls(런타임 클래스 네비) — 라이브러리명.
            _safe(function () {
                var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIOBK === oNode.UIOBK; });
                if (ls_0022) { ev.dataTransfer.setData("rtmcls", ls_0022.LIBNM); }
            });
            try { ev.dataTransfer.setData("text/plain", "designTree|" + oNode.OBJID + "|" + oAPP.attr.DnDRandKey); } catch (e) { }

            oAPP.fn.designTreeDragStart(oNode);
        }, false);

        // dragover — 위치 계산 + dropEffect.
        oPane.addEventListener("dragover", function (ev) {
            if (!_dnd.active) { return; }
            var oRow = ev.target && ev.target.closest ? ev.target.closest(".u4aWs20TreeRow[data-objid]") : null;
            if (!oRow) { return; }
            ev.preventDefault();           // drop 허용.
            _dnd.effect = ev.ctrlKey ? "Copy" : "Move";
            try { ev.dataTransfer.dropEffect = ev.ctrlKey ? "copy" : "move"; } catch (e) { }

            var sObjid = oRow.getAttribute("data-objid");
            var sPos = _calcDropPos(oRow, ev.clientY);
            _dnd.dropObjid = sObjid;
            _dnd.dropPos = sPos;

            _clearDropMark(oPane);
            oRow.classList.add(sPos === "On" ? "u4aWs20DropOn" : (sPos === "Before" ? "u4aWs20DropBefore" : "u4aWs20DropAfter"));
        }, false);

        oPane.addEventListener("dragleave", function (ev) {
            var oRow = ev.target && ev.target.closest ? ev.target.closest(".u4aWs20TreeRow[data-objid]") : null;
            if (oRow) { oRow.classList.remove("u4aWs20DropOn", "u4aWs20DropBefore", "u4aWs20DropAfter"); }
        }, false);

        // drop — UIDrop 파이프라인.
        oPane.addEventListener("drop", function (ev) {
            if (!_dnd.active) { return; }
            var oRow = ev.target && ev.target.closest ? ev.target.closest(".u4aWs20TreeRow[data-objid]") : null;
            ev.preventDefault();
            _clearDropMark(oPane);
            if (!oRow) { oAPP.fn.designDragEnd(); return; }

            var sObjid = oRow.getAttribute("data-objid");
            var sPos = _dnd.dropPos || _calcDropPos(oRow, ev.clientY);

            // 드롭 순간 Ctrl 상태로 복사/이동 확정(마지막 dragover 이후 변경 대비).
            _dnd.effect = ev.ctrlKey ? "Copy" : "Move";

            // 편집모드 아니면 무시(drop 불가).
            if (!_isEdit()) { oAPP.fn.designDragEnd(); return; }

            // 드롭 처리(원본 attachDrop 흐름).
            try { parent.setBusy("X"); } catch (e) { }
            oAPP.fn.setShortcutLock(true);

            var oSynth = { mParameters: { dropPosition: sPos, browserEvent: { dataTransfer: ev.dataTransfer } } };

            var bHandled = false;
            _safe(function () { bHandled = oAPP.fn.UIDrop(oSynth, sObjid); });
            if (bHandled === true) { return; }   // aggrSelectPopup→drop_cb 가 정리.

            // 미처리 → 정리.
            _bindBusy("BUSY_OFF");
            oAPP.fn.setShortcutLock(false);
            try { parent.setBusy(""); } catch (e) { }
            oAPP.fn.designDragEnd();
        }, false);

        // dragend — 잔상 정리.
        oPane.addEventListener("dragend", function () {
            _clearDropMark(oPane);
            if (_dnd.active) { oAPP.fn.designDragEnd(); }
        }, false);
    }

    // 트리 렌더 후/진입 시 배선 보장. fnRenderDesignTree 를 한 번 감싸 설치 트리거.
    var _origRender = oAPP.fn.fnRenderDesignTree;
    if (typeof _origRender === "function") {
        oAPP.fn.fnRenderDesignTree = function () {
            var r = _origRender.apply(this, arguments);
            _safe(_installDnd);
            return r;
        };
    }
    // 초기 1회(이미 트리가 그려진 경우 대비).
    _safe(_installDnd);

})();
