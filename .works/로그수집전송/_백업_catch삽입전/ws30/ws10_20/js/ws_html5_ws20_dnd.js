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
        dropPos: "",       // "On"/"Before"/"After"
        seq: 0             // 드래그 회차(안전망이 자기 드래그만 종료 처리하도록 식별)
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

    /* ── 바인딩 팝업(별창) prc002 드래그 데이터(원본 design/bindPopupHandler/setDragBindPopupData.js 1:1) ──
       WS20 디자인 트리 → 바인딩 팝업 가운데(디자인 트리) drop 시 소비하는 native dataTransfer.
       별창은 별도 BrowserWindow — 원본과 동일하게 dataTransfer("prc002") 로 전송한다. */
    var _BP_K14 = ["APPID", "GUINR", "OBJID", "POSIT", "POBID", "UIOBK", "PUIOK", "ISAGR", "AGRID", "ISDFT",
        "OBDEC", "AGTYP", "UIATK", "UIATT", "UIASN", "UIATY", "UIADT", "UIADS", "VALKY", "ISLST", "ISMLB",
        "TOOLB", "UIFND", "PUIATK", "UILIB", "ISEXT", "TGLIB", "DEL_UOK", "DEL_POK", "ISECP"];
    var _BP_K15 = ["APPID", "GUINR", "OBJID", "UIATK", "UIATV", "ISBND", "UILIK", "UIOBK", "UIATT", "UIASN",
        "UIADT", "RVALU", "BPATH", "ADDSC", "UIATY", "ISMLB", "ISEMB", "DEL_LIB", "DEL_UOK", "DEL_ATT",
        "ISWIT", "ISSPACE", "FTYPE", "REFFD", "CONVR", "MPROP", "SHCUT"];

    // 전송 전 drag 라인 점검(원본 checkBindPopupDragAppData). 부모 N건 바인딩이면 UI 구성 불가.
    function _chkBindPopupDragAppData(is_drag) {
        var _sRes = { RETCD: "", RTMSG: "" };
        if (typeof is_drag === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = _wsc("099"); return _sRes; }   // 099 Drag 정보 없음.
        if (is_drag.OBJID === "ROOT") { return _sRes; }
        var _UIATT, _OBJID = is_drag.OBJID;
        // sap.ui.table.Column 이며 CHILD 에 template 이 있으면 부모(Table/TreeTable)의 rows 로 점검.
        if (is_drag.UILIB === "sap.ui.table.Column" && (is_drag.zTREE || []).findIndex(function (i) { return i.UIATT === "template"; }) !== -1) {
            _OBJID = is_drag.POBID; _UIATT = "rows";
        }
        var l_path = oAPP.fn.getParentAggrBind(oAPP.attr.prev[_OBJID], _UIATT);
        if (typeof l_path !== "undefined" && l_path !== "") { _sRes.RETCD = "E"; _sRes.RTMSG = _wsc("163"); return _sRes; }   // 163 부모 MODEL BINDING → UI 구성 불가.
        return _sRes;
    }

    // 바인딩 팝업 UI 구성용 design tree 데이터 구성(원본 setBindPopupDragAppData).
    function _setBindPopupDragAppData(is_drag) {
        var _aTree = JSON.parse(JSON.stringify([is_drag]));
        oAPP.attr.POSIT = 0;
        oAPP.fn.setUIPOSIT(_aTree);
        oAPP.attr.POSIT = 0;
        _aTree = oAPP.fn.parseTree2Tab(_aTree);
        _aTree.sort(function (a, b) { return a.POSIT - b.POSIT; });

        var _sRes = { T_0014: [], T_0015: [], T_CEVT: [] };
        for (var i = 0, l = _aTree.length; i < l; i++) {
            var _sTree = _aTree[i];
            var _s0014 = oAPP.fn.crtStru0014();
            for (var k = 0; k < _BP_K14.length; k++) { _s0014[_BP_K14[k]] = _sTree[_BP_K14[k]]; }
            _sRes.T_0014.push(_s0014);

            var _aT0015 = (oAPP.attr.prev[_s0014.OBJID] && oAPP.attr.prev[_s0014.OBJID]._T_0015) || [];
            for (var j = 0, jl = _aT0015.length; j < jl; j++) {
                var _s0015 = oAPP.fn.crtStru0015();
                for (var k2 = 0; k2 < _BP_K15.length; k2++) { _s0015[_BP_K15[k2]] = _aT0015[j][_BP_K15[k2]]; }
                _sRes.T_0015.push(_s0015);
            }
        }
        _sRes.T_CEVT = JSON.parse(JSON.stringify((oAPP.DATA && oAPP.DATA.APPDATA && oAPP.DATA.APPDATA.T_CEVT) || []));
        return _sRes;
    }

    // dragstart 에서 prc002 세팅(원본 setDragAppData → setDragBindPopupData). 별창 미오픈이어도 무해(팝업이 소비).
    function _setDragBindPopupData(is_drag, ev) {
        var _sParam = { RETCD: "", RTMSG: "", DnDRandKey: oAPP.attr.DnDRandKey, T_0014: [], T_0015: [], T_CEVT: [] };
        var _sRes = _chkBindPopupDragAppData(is_drag);
        if (_sRes.RETCD === "E") {
            _sParam.RETCD = _sRes.RETCD; _sParam.RTMSG = _sRes.RTMSG;
            try { ev.dataTransfer.setData("prc002", JSON.stringify(_sParam)); } catch (e) { }
            return;
        }
        var _sData = _setBindPopupDragAppData(is_drag);
        _sParam.T_0014 = _sData.T_0014; _sParam.T_0015 = _sData.T_0015; _sParam.T_CEVT = _sData.T_CEVT;
        try { ev.dataTransfer.setData("prc002", JSON.stringify(_sParam)); } catch (e) { }
    }

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

    // ★ BR15: 드래그 종료 안전망. 트리를 아래로 끌면 브라우저 자동 스크롤 → 가상 스크롤(보이는 행만 DOM)이
    //   재렌더하며 드래그 소스 행을 제거 → 네이티브 dragend 가 전달되지 않음. 그러면 _dnd.active 가 안 꺼지고
    //   행 데코 훅(fnWs20DndDecorateRow)이 이후 렌더마다 놓기불가 행을 계속 흐리게(u4aWs20TreeDropNo) 칠해 잔류.
    //   (재현: 스크롤 이동 후 ①놓기 가능 라인 드롭→Aggregation 팝업 ②트리 밖 드롭. 정리를 dragend 한 경로에만
    //    의존한 탓.) → 드래그 시작 시 document 에 "끝나면 한 번만" 도는 안전망을 건다. 이 앱은 단일 엔진
    //   (Chromium)이라 네이티브 드래그 중엔 mousemove 가 억제되고 종료 후 재개되므로, 종료 후 첫 mousemove 로
    //   확실히 감지 → 정상 경로(dragend/drop_cb)가 이미 정리했으면 _dnd.active 가 false 라 no-op.
    function _armDragEndSafetyNet(iSeq) {
        function _onEnd() {
            // 자기 회차의 드래그가 아직 살아있을 때만 정리(다음 드래그를 조기 종료시키지 않도록 회차 대조).
            if (_dnd.active && _dnd.seq === iSeq) { oAPP.fn.designDragEnd(); }
        }
        document.addEventListener("mousemove", _onEnd, { capture: true, once: true });
    }

    // design tree item drag 시작. (원본 3905행 1:1)
    oAPP.fn.designTreeDragStart = function (is_tree) {
        _dnd.active = true;
        _dnd.seq = _dnd.seq + 1;   // 이 드래그의 회차(안전망 대조용)
        _dnd.effect = "";   // 이 드래그의 Copy/Move 는 이후 dragover/drop 에서 결정(새 드래그마다 초기화)
        if (is_tree && is_tree.OBJID) { _dnd.dragObjid = is_tree.OBJID; }
        oAPP.fn.setTreeDnDEnable(_root());          // 기본 가능여부
        if (is_tree) { oAPP.fn.setDropEnable(is_tree); }  // drag 기준 drop 가능 라인 판정
        oAPP.fn.designSetDropStyle();               // drop 불가 행 표시
        _armDragEndSafetyNet(_dnd.seq);             // ★ BR15: 네이티브 dragend 유실 대비 종료 안전망.
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

    // 앱당 1개만 허용되는 UI(UA039) 중복 점검. (원본 designChkUnique 1555행 1:1)
    if (typeof oAPP.fn.designChkUnique !== "function") {
        oAPP.fn.designChkUnique = function (UIOBK, iCnt) {
            var ls_UA039 = oAPP.DATA.LIB.T_9011.find(function (a) { return a.CATCD === "UA039" && a.FLD02 === UIOBK && a.FLD04 === "X"; });
            if (!ls_UA039) { return; }                                    // 중복관리 대상 아님.
            if (typeof iCnt !== "undefined" && iCnt >= 2) {
                // 130 Target API and UI &1 does not allow one or more assign.
                _toast("E", _msg("/U4A/MSG_WS", "130", ls_UA039.FLD01)); return true;
            }
            var lt_tree = (typeof oAPP.fn.parseTree2Tab === "function") ? oAPP.fn.parseTree2Tab(oAPP.attr.oModel.oData.zTREE) : null;
            if (!lt_tree) { return; }
            if (lt_tree.findIndex(function (a) { return a.UIOBK === UIOBK; }) !== -1) {
                _toast("E", _msg("/U4A/MSG_WS", "130", ls_UA039.FLD01)); return true;   // 이미 존재.
            }
        };
    }

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
        // ★ 행 액션(+추가/삭제) 플래그도 공통 초기화에서 함께 세팅 — 원본/구 HTML5 는 이 둘을 빠뜨려,
        //   crtTreeBindField 로 만든 노드를 각 생성 경로(위자드 createUiLine 등)가 designSetActionIcon
        //   또는 인라인으로 따로 세팅해야 했고, 누락 시 +/삭제 버튼이 안 나오는 회귀가 반복됐다.
        //   신규 노드는 항상 non-ROOT/APP leaf 라 _isEdit() 이 정답(designSetActionIcon 규칙과 동일).
        is_0014.visible_add = _isEdit();
        is_0014.visible_delete = _isEdit();
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

    // 입력 UI 가 target UI 에 추가 가능한 aggregation 목록.
    //   ★ 원본이 배열 반환판(옛)에서 **구조체 {RETCD,RTMSG,T_SEL} 반환판**으로 재작성(원본 uiDesignArea.js:1596,
    //     옛 배열판은 원본에서 주석 처리). 바인딩+자식 있는 자리만 남으면 T_SEL 비우고 RTMSG=002(바인딩 안내),
    //     자리 자체가 없으면 003, aggregation 정의 자체 없으면 001 을 실어 호출측(aggrSelectPopup/wizard 사전점검)이
    //     조용히 제외 대신 안내를 띄우게 한다. HTML5 이식본은 옛 배열판이라 끌어놓기 시 바인딩 자리가 조용히 제외돼
    //     안내가 안 떴다(장군님 특별지시 T01). 반환 구조 변경 → 호출부(aggrSelectPopup·wizard) 함께 갱신.
    //   ★ T01 검수(코덱스 P1) 반영 — 옛 배열 계약 소비자 호환: 작업폴더 UAI(design/UAI/parseAiLibraryData.js,
    //     옛 판)가 이 함수 반환값의 `.length === 0` 만 검사한다(408·411, 원소 접근 없음 — 원본 최신 UAI 는 구조체
    //     소비로 이미 교체됨: WS_DESIGN parseAiLibraryData.js:434). 원본 파일은 못 고치므로 반환 구조체에
    //     `length`(= T_SEL 개수)를 함께 실어, 원작자가 UAI 를 최신판으로 덮어쓰기 전까지 옛 사전거부도 살린다.
    //     (신판 소비자는 RETCD/T_SEL 만 보므로 length 는 무해.)
    oAPP.fn.chkAggrRelation = function (tUIOBK, tOBJID, sUIOBK) {
        var _sRes = { RETCD: "", RTMSG: "", T_SEL: [] };
        // 반환 마무리 — 옛 소비자(.length) 호환 속성 동기화(모든 return 경로 공통).
        function _fin() { _sRes.length = _sRes.T_SEL.length; return _sRes; }
        // ★ T01 검수(안티 P2) 반영 — 라이브러리/미리보기 미로드 방어(정상 경로 무변화, 크래시만 차단).
        var _LIB = (oAPP.DATA && oAPP.DATA.LIB) ? oAPP.DATA.LIB : {};
        var _sTarget = oAPP.fn.getTreeData(tOBJID);
        var lt_0023 = (_LIB.T_0023 || []).filter(function (a) { return a.UIOBK === tUIOBK && a.UIATY === "3" && a.ISDEP !== "X"; });
        // aggregation 정의 자체가 없는 경우(원본 1613 → 001).
        if (lt_0023.length === 0) {
            _sRes.RETCD = "E";
            // ★ BR61: 문구 조회가 실패하면 안내가 통째로 사라진다 → 삼키지 말고 표면화(code.md 규칙).
            try { _sRes.RTMSG = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_002", "001", tOBJID); }
            catch (e) { console.error("[HTML5][WS20][chkAggrRelation] 안내 문구 조회 실패(001):", e && e.message ? e.message : e); }
            return _fin();
        }
        var lt_0027 = (_LIB.T_0027 || []).filter(function (a) { return a.TGOBJ === sUIOBK && a.TOBTY !== "1"; });
        var _sPrev = (oAPP.attr && oAPP.attr.prev) ? oAPP.attr.prev[tOBJID] : undefined;
        var _sModel = (_sPrev && _sPrev._MODEL) ? _sPrev._MODEL : {};
        var _isModelBind = false;   // 바인딩 때문에 제외된 aggregation 존재 여부(원본 1629).
        for (var i = 0, l = lt_0023.length; i < l; i++) {
            var _s0023 = lt_0023[i];
            var _sUpper = (_s0023.UIADT || "").toUpperCase();
            var _s0022 = (_LIB.T_0022 || []).find(function (a) { return a.UIFND === _sUpper; });
            if (!_s0022) { continue; }
            // drag UI 가 aggregation type 과 같거나 상속관계에 있을 때만 후보(원본 1642).
            if (sUIOBK !== _s0022.UIOBK && !lt_0027.some(function (b) { return b.SGOBJ === _s0022.UIOBK; })) { continue; }
            // 자식 존재 여부는 트리(zTREE) 기준(원본 1646).
            var _isChildExist = (_sTarget && _sTarget.zTREE) ? _sTarget.zTREE.some(function (a) { return a.UIATK === _s0023.UIATK; }) : false;
            // 바인딩(_MODEL) 걸린 aggregation 에 자식이 이미 있으면 제외 + 바인딩제외 플래그(원본 1650, template 1건만 허용).
            if (_sModel[_s0023.UIATT] && _isChildExist === true) { _isModelBind = true; continue; }
            _sRes.T_SEL.push(_s0023);
        }
        // 추가 가능한 aggregation 이 없는 경우: 바인딩 제외 때문인지(002) 원천 부재인지(003) 구분(원본 1660).
        if (_sRes.T_SEL.length === 0) {
            _sRes.RETCD = "E";
            try {
                _sRes.RTMSG = _isModelBind
                    ? parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_002", "002")
                    : parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_002", "003");
            } catch (e) {
                // ★ BR61: 위와 같은 이유로 표면화(문구가 비면 붙여넣기 실패 사유가 화면에 안 뜬다).
                console.error("[HTML5][WS20][chkAggrRelation] 안내 문구 조회 실패(002/003):", e && e.message ? e.message : e);
            }
            return _fin();
        }
        _sRes.RETCD = "S";
        return _fin();
    };

    // AGGREGATION 선택 — 후보 0/1 자동, 2+ 는 HTML5 .u4a-dialog. (원본 aggrSelectPopup.js 1:1 동작)
    oAPP.fn.aggrSelectPopup = function (i_drag, i_drop, retfunc, i_x, i_y, cancelFunc) {

        // ★ chkAggrRelation 이 구조체 {RETCD,RTMSG,T_SEL} 반환판으로 재작성됨(원본 aggrSelectPopup.js 32~34).
        //   후보는 .T_SEL, 후보 0 일 때 옛 하드코딩 262 대신 chkAggrRelation 이 실어준 .RTMSG(바인딩=002/부재=003)를 띄운다.
        var _sAggrRes = oAPP.fn.chkAggrRelation(i_drop.UIOBK, i_drop.OBJID, i_drag.UIOBK);
        var lt_sel = (_sAggrRes && _sAggrRes.T_SEL) ? _sAggrRes.T_SEL : [];

        // 후보 0 + 같은 부모/aggregation → 순서변경(param undefined).
        if (lt_sel.length === 0 && i_drag.POBID === i_drop.POBID && i_drag.UIATK === i_drop.UIATK) {
            retfunc(undefined, i_drag, i_drop);
            return;
        }
        // 후보 0 → 이동 불가. 안내는 chkAggrRelation 의 RTMSG(원본 aggrSelectPopup.js 66·79) — 미조회 시 262 폴백.
        if (lt_sel.length === 0) {
            if (i_drop) { delete i_drop.dropLineInfo; }
            _dnd.effect = "";
            var _sMsg = (_sAggrRes && _sAggrRes.RTMSG) ? _sAggrRes.RTMSG : _msg("/U4A/MSG_WS", "262");
            if (typeof cancelFunc === "function") {
                cancelFunc({ RETCD: "E", RCODE: "02", RTMSG: _sMsg });
                return;
            }
            _toast("I", _sMsg);
            _bindBusy("BUSY_OFF");
            oAPP.fn.setShortcutLock(false);
            try { parent.setBusy(""); } catch (e) { }
            return;
        }
        // 후보 1 → 자동 선택.
        if (lt_sel.length === 1) { retfunc(lt_sel[0], i_drag, i_drop); return; }

        // 후보 2+ → 선택 팝업(.u4a-dialog). 드롭 좌표(i_x,i_y)를 넘겨 드롭 위치에 띄운다(원본 편의성).
        _aggrSelectDialog(i_drag, i_drop, lt_sel, retfunc, cancelFunc, i_x, i_y);
    };

    // aggregation 선택 다이얼로그(HTML5). 원본 sap.m.Dialog+Select 대응. i_x,i_y=드롭 위치(있으면 그곳에 표시).
    function _aggrSelectDialog(i_drag, i_drop, lt_sel, retfunc, cancelFunc, i_x, i_y) {

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
        // 드롭 위치에 팝업 표시(원본 편의성 — 드롭한 자리에서 aggregation 선택). 좌표 없으면 중앙 유지.
        //   showModal 기본 중앙정렬(margin:auto)을 인라인 fixed+left/top 으로 덮음. 화면 밖으로 안 나가게 클램프.
        _safe(function () {
            if (typeof i_x !== "number" || typeof i_y !== "number") { return; }
            var w = DLG.offsetWidth, h = DLG.offsetHeight, M = 8;
            var left = Math.max(M, Math.min(i_x, window.innerWidth - w - M));
            var top = Math.max(M, Math.min(i_y, window.innerHeight - h - M));
            DLG.style.position = "fixed"; DLG.style.margin = "0";
            DLG.style.left = Math.round(left) + "px";
            DLG.style.top = Math.round(top) + "px";
        });
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

    // 바인딩 팝업 디자인데이터 갱신 — 원본 uiDesignArea.js:1263~1266 1:1(bindPopup 변환 완료로 스텁→실제 연결).
    //   WS20 변경(추가/이동/삭제/속성)을 별창 바인딩 팝업 트리에 반영: 방송모듈("UPDATE-DESIGN-DATA") →
    //   WS20 방송모듈이 DESIGN_ROOT_OBJID 기준 T_0014/0015/CEVT 구성해 팝업에 UPDATE_DESIGN_DATA 전송 → 팝업 재빌드.
    //   ★DESIGN_ROOT_OBJID 는 팝업이 열릴 때/트리 재구성 시 보내는 ROOT_OBJID(R3)로 채워진다.
    //   팝업 미오픈이면 방송모듈 isCreateChannel 가드로 no-op(안전).
    if (typeof oAPP.fn.updateBindPopupDesignData !== "function") {
        oAPP.fn.updateBindPopupDesignData = function () {
            try {
                var sPath = oAPP.oDesign && oAPP.oDesign.pathInfo && oAPP.oDesign.pathInfo.bindPopupBroadCast;
                if (sPath) { parent.require(sPath)("UPDATE-DESIGN-DATA"); }
            } catch (e) { console.error("[HTML5][WS20] updateBindPopupDesignData:", e && e.message); }
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
        if (!lt_dragInfo) { _bindBusy("BUSY_OFF"); return; }

        // UI 삽입 팝업(카탈로그)에서 드래그 → 신규 UI 추가(원본 designUIDropInsertPopup). 5-파트 포맷이라 length 검사 앞.
        if (lt_dragInfo[0] === "callUIInsertPopup") { return oAPP.fn.designUIDropInsertPopup(oEvent, i_OBJID); }

        if (lt_dragInfo.length !== 3) { _bindBusy("BUSY_OFF"); return; }

        // 내 패턴(UI 개인화) 리스트에서 드래그한 경우 — 저장 패턴을 대상 UI 에 적용(원본 uiDesignArea.js 5658).
        //   drop 위치(On/Before/After)를 넘겨 getDropTargetLine 이 실제 대상/삽입위치를 재해석하도록 함.
        if (lt_dragInfo[0] === "P13nUIData") { return oAPP.fn.applyP13nPatternDrop(lt_dragInfo, i_OBJID, _dropPosition); }

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
     * 5-a) UI 삽입 팝업(카탈로그)에서 드래그한 신규 UI drop 처리.
     *      (원본 uiDesignArea.js designUIDropInsertPopup 5510 1:1)
     *      dataTransfer = "callUIInsertPopup|UIOBK|개수|DnDRandKey|개인화여부".
     *      대상 노드의 aggregation 을 aggrSelectPopup 으로 선택(후보1 자동/2+ 팝업) → designAddUIObject.
     * ==================================================================== */
    oAPP.fn.designUIDropInsertPopup = function (oEvent, i_OBJID) {
        var _dropPosition = oEvent && oEvent.mParameters ? oEvent.mParameters.dropPosition : undefined;

        _bindBusy("BUSY_ON", _busyOption("215"));

        var lt_dragInfo = oAPP.fn.getDragParam(oEvent);
        if (!lt_dragInfo || lt_dragInfo.length !== 5 || lt_dragInfo[0] !== "callUIInsertPopup") {
            _bindBusy("BUSY_OFF"); oAPP.fn.designDragEnd(); return;
        }
        // 다른 세션 drag 정보 차단.
        if (lt_dragInfo[3] !== oAPP.attr.DnDRandKey) {
            _toast("E", _wsc("102")); _bindBusy("BUSY_OFF"); oAPP.fn.designDragEnd(); return;   // 102 다른 영역 drag
        }

        var _isPresetAttr = lt_dragInfo[4] === "true";
        var l_UIOBK = lt_dragInfo[1];
        var l_cnt = parseInt(lt_dragInfo[2], 10); if (!(l_cnt > 0)) { l_cnt = 1; }

        var ls_drop = oAPP.fn.getTreeData(i_OBJID);
        if (!ls_drop) { _bindBusy("BUSY_OFF"); oAPP.fn.designDragEnd(); return; }

        // drop 대상/삽입위치 재해석(dropPosition 기준 dropIndex 매핑).
        var _sDNDInfo = { sDrag: undefined, sDrop: ls_drop, sDropLineInfo: { dropPosition: _dropPosition, dropIndex: ls_drop.zTREE.length } };
        ls_drop = oAPP.oDesign.fn.getDropTargetLine(_sDNDInfo);
        if (typeof ls_drop === "undefined") {
            _toast("E", _wsc("245")); _bindBusy("BUSY_OFF"); oAPP.fn.designDragEnd(); return;   // 245 DROP 대상 없음
        }

        // aggregation 선택 후 UI 추가(구 lf_setChild). aggrSelectPopup 콜백 = (is_0023, i_drag, i_drop).
        //   ★화면잠금 해제 3종 세트로 종료(장군님 발견 2026-08-18, FlexItemData 꽉 찬 layoutData 에 드롭 시 스피너 잔존).
        //   트리 drop 핸들러(약 1671)가 parent.setBusy("X")+setShortcutLock(true) 를 직접 걸고, UIDrop 처리됨(bHandled)
        //   이면 그 자리서 정리 없이 downstream(=이 콜백)에 위임한다(1678, "aggrSelectPopup→drop_cb 가 정리").
        //   그런데 후보 aggregation 이 1개라 자동선택돼 이 콜백을 타는 경우(예: 이미 꽉 찬 0:1 자리에 드롭 → 내부
        //   chkUiCardinality 조기취소), 기존엔 방송잠금(_bindBusy BUSY_OFF)만 풀고 화면잠금·단축키잠금을 안 풀어
        //   스피너가 남았다. 원본 designAddUIObject 는 모든 조기취소 분기에서 방송+화면+단축키 3종을 다 풀었으므로
        //   그 계약대로 여기(성공/취소 공통 종료)에서도 3종을 함께 해제한다(형제 종료분기 466·566·913·1219·1682 와 동일).
        function lf_setChildDone() {
            _bindBusy("BUSY_OFF");
            _safe(function () { oAPP.fn.setShortcutLock(false); });
            try { parent.setBusy(""); } catch (e) { }
            oAPP.fn.designDragEnd();
        }
        async function lf_setChild(is_0023) {
            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIOBK === l_UIOBK && a.ISDEP !== "X" && a.ISSTP !== "X"; });
            if (!ls_0022 || !is_0023) { lf_setChildDone(); return; }
            try { await oAPP.fn.designAddUIObject(ls_drop, ls_0022, is_0023, l_cnt, _isPresetAttr); }
            catch (e) { console.error("[HTML5][WS20] insert drop add:", e && e.message ? e.message : e); }
            lf_setChildDone();
        }

        var l_pos = oAPP.fn.getMousePosition();
        // 후보 0 → aggrSelectPopup 이 262 토스트+BUSY_OFF, 취소 → 기본 처리(BUSY_OFF).
        oAPP.fn.aggrSelectPopup({ UIOBK: l_UIOBK }, ls_drop, lf_setChild, l_pos.x, l_pos.y);
        return true;
    };


    /* ====================================================================
     * 5-b) 내 패턴(UI 개인화) drop 적용 (원본 uiDesignArea.js designP13nUIData 5658 + designAddTreeData).
     *   개인화 리스트에서 드래그한 저장 패턴(파일)을 읽어 대상 UI 의 aggregation 에 붙여넣는다.
     *   재구성은 검증된 붙여넣기 경로(_pasteUI)와 동일 방식 재사용 — OBJID 재채번 + 속성/이벤트/설명
     *   복원 + 미리보기 createUIInstance. aggregation 선택은 공통 aggrSelectPopup.
     * ==================================================================== */
    oAPP.fn.applyP13nPatternDrop = function (lt_dragInfo, i_OBJID, i_dropPosition) {

        function _exit() { _bindBusy("BUSY_OFF"); _safe(function () { oAPP.fn.setShortcutLock(false); }); try { parent.setBusy(""); } catch (e) { } }

        // 편집 불가면 무시(디자인 추가 불가).
        if (!_isEdit()) { _exit(); return; }

        // 단축키 잠금(원본 designAddTreeData 6479). 트리 native drop 경로는 이미 잠갔지만(멱등),
        //   미리보기 iframe drop 경로엔 없어 aggr 팝업 async 구간 보호 위해 진입부에서 확정.
        _safe(function () { oAPP.fn.setShortcutLock(true); });

        // 다른 세션 drag 차단(원본 102).
        if (lt_dragInfo[2] !== oAPP.attr.DnDRandKey) { _toast("E", _wsc("102")); _exit(); return; }

        var l_itemKey = lt_dragInfo[1];
        var l_sysid = _safe(function () { return parent.getUserInfo().SYSID; });
        if (!l_itemKey || !l_sysid) { _exit(); return; }

        // 개인화 파일 경로(원본 5686) = P13N_ROOT/U4A_UI_PATTERN/{SYSID}/{fileName}.
        var l_path = _safe(function () { return parent.PATH.join(parent.getPath("P13N_ROOT"), "U4A_UI_PATTERN", l_sysid, l_itemKey); });
        if (!l_path || parent.FS.existsSync(l_path) !== true) { _toast("E", _wsc("017")); _exit(); return; }  // 017 저장 파일 없음.

        var ls_item;
        try { ls_item = JSON.parse(parent.FS.readFileSync(l_path, "utf-8")); } catch (e) { _toast("E", e && e.message ? e.message : e); _exit(); return; }
        if (!ls_item || !ls_item.is_tree) { _exit(); return; }

        // drop 대상 UI.
        var l_drop = oAPP.fn.getTreeData(i_OBJID);
        if (!l_drop) { _exit(); return; }

        // 드롭 위치(On/Before/After) 기준 실제 대상 라인/삽입위치 재해석(원본 designUIDropP13nList 5727~5762).
        //   sDrag=undefined(신규 추가). getDropTargetLine 이 대상 노드에 dropLineInfo(dropIndex) 를 심는다.
        var _sDNDInfo = { sDrag: undefined, sDrop: l_drop, sDropLineInfo: { dropPosition: i_dropPosition, dropIndex: (l_drop.zTREE ? l_drop.zTREE.length : 0) } };
        var l_target = _safe(function () { return oAPP.oDesign.fn.getDropTargetLine(_sDNDInfo); });
        if (!l_target) { _toast("E", _wsc("245")); _exit(); return; }   // 245 DROP 처리 UI 를 찾을 수 없습니다.
        l_drop = l_target;

        var l_data = ls_item.is_tree;   // 붙여넣을 패턴 최상위(원본 is_data).

        // ── 공통 코어로 위임(원본 designAddTreeData 상당) ──
        //   검증 사슬(UA039/UA040/카디널리티/특정부모/예외aggr) + aggregation 선택 + $OTR 보강 +
        //   재구성(_applyP13nPattern) + 후처리를 모두 포함. 트리 컨텍스트 메뉴 M07 붙여넣기와 완전 동일 경로.
        //   (패턴 drop 은 위 preamble 에서 파일→l_data/l_drop 준비만 다르다.)
        oAPP.fn.fnWs20AddTreeData(l_data, l_drop, oAPP.fn.getMousePosition(), _exit);

        return true;
    };

    /* ====================================================================
     * 5-c) 공통 UI 추가/붙여넣기 코어 (원본 uiDesignArea.js designAddTreeData 5808~ 상당).
     *   패턴 drop(5-b) 과 트리 컨텍스트 메뉴 M07 붙여넣기(ws_html5_ws20_edit.js _pasteUI)가 공유한다.
     *
     *   ★이름 주의 — 원본 oAPP.fn.designAddTreeData(is_data, is_tree, sAggr) 와 이름이 겹치지 않도록
     *     HTML5 전용 명(fnWs20*)을 쓴다. 원본은 3번째 인자가 "이미 선택된 aggregation" 이고 이 함수는
     *     "팝업 위치" 라 시그니처가 다르다. 현재 메인 렌더러엔 uiDesignArea.js(UI5)가 미로드라 충돌은
     *     없지만, 동명·이(異)시그니처는 향후 로드 시 무성 파손이 되므로 이름을 분리한다.
     *
     *     is_data   = 붙여넣을 트리 최상위(_T_0015/_DESC/_CEVT 박제).
     *     is_drop   = 대상(부모) 노드. is_data 는 is_drop 의 선택 aggregation 자식으로 삽입된다.
     *     i_pos     = aggregation 선택 팝업 위치({x,y}), 미지정 시 마우스 위치.
     *     i_doneCb  = 완료/취소/가드 실패 시 정리 콜백(busy/shortcut lock 해제 등, 호출측 책임).
     *   검증 사슬 → aggregation 선택 → $OTR 보강 → 재구성/미리보기/후처리를 원본 순서대로 수행.
     * ==================================================================== */
    oAPP.fn.fnWs20AddTreeData = function (is_data, is_drop, i_pos, i_doneCb) {

        var _done = (typeof i_doneCb === "function") ? i_doneCb : function () { };

        // ── 전반부 가드(원본 6501~6544) ──
        // ① UA039 앱당 1개만 허용 UI 중복(designChkUnique) → skip.
        if (oAPP.fn.designChkUnique(is_data.UIOBK) === true) { _done(); return; }
        // ② UA040 HIDDEN_AREA 전용 UI 위치 점검(designChkHiddenAreaUi).
        if (oAPP.fn.designChkHiddenAreaUi(is_data.UIOBK, is_drop.UIOBK) === true) { _done(); return; }

        // 트리 아이콘 구성(가드).
        _safe(function () { if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(is_data); } });

        // aggregation 선택 팝업 → 선택된 aggregation 으로 적용(후보 0/1 자동, 2+ 팝업).
        var l_pos = i_pos || oAPP.fn.getMousePosition();
        oAPP.fn.aggrSelectPopup(is_data, is_drop, async function (param) {

            // ── lf_aggrPopup_cb 가드(원본 6236~6352) ──
            // ③ 이동 가능한 aggregation 없음(원본 269).
            // ★ BR61: 메시지 클래스 오지정 수정. 원본 lf_aggrPopup_cb(uiDesignArea.js 6469)는
            //   oAPP.common.fnGetMsgClsText("/U4A/MSG_WS","269") = "붙여넣을 수 있는 aggregation이 없습니다."
            //   를 띄우는데, 이식본이 _wsc(=ZMSG_WS_COMMON_001) 269 를 써서 전혀 무관한 파일 끌어놓기 안내가
            //   떴다(같은 번호, 다른 클래스). 클래스를 원본과 동일하게 되돌린다.
            if (typeof param === "undefined") { _toast("I", _msg("/U4A/MSG_WS", "269")); _done(); return; }
            // ④ 카디널리티(0:1 aggr 중복 방지).
            if (oAPP.fn.chkUiCardinality(is_drop, param.UIATK, param.ISMLB) === true) { _done(); return; }
            // ⑤ 특정 부모 전용 UI.
            if (oAPP.fn.designChkFixedParentUI(is_data.UIOBK, is_drop.UIOBK, param.UIATT) === true) { _done(); return; }
            // ⑥ 예외 aggregation 추가 불가/허용(exceptionUI.js).
            var _exMod = null;
            _safe(function () { _exMod = parent.require(parent.PATH.join(oAPP.oDesign.pathInfo.designRootPath, "js", "exception", "exceptionUI.js")); });
            if (_exMod) {
                var _deny = false; _safe(function () { _deny = _exMod.checkDenyChildAggr({ UIOBK: is_drop.UIOBK, UIATT: param.UIATT, CHILD_UIOBK: is_data.UIOBK }); });
                if (_deny === true) { _toast("E", _wsc("214", is_data.OBJID, is_drop.OBJID, param.UIATT)); _done(); return; }
                var _allow = true; _safe(function () { _allow = _exMod.checkAllowChildAggr({ PUIOK: is_drop.UIOBK, UIATT: param.UIATT, UIOBK: is_data.UIOBK }); });
                if (_allow !== true) { _toast("E", _wsc("214", is_data.OBJID, is_drop.OBJID, param.UIATT)); _done(); return; }
            }

            // ⑦ $OTR: alias 서버조회로 T_OTR 보강(원본 lf_getOTRtext 6149).
            //    미리보기(uiPreviewArea.js 1118)가 T_OTR 로 $OTR 텍스트를 해석하므로 삽입 전 필요.
            try { await _fetchP13nOtr(is_data); }
            catch (e) { console.error("[HTML5][WS20][designAddTreeData] getOTRTextsAlias", e); }

            // ⑧ 재구성(OBJID 재채번=삽입후재귀 → 형제중복 없음) + 미리보기 + 후처리
            //    (원본 lf_setPasteCopiedData + lf_paste_cb 1:1, 바인딩/서버이벤트 값 제외 필터 포함).
            try { await _applyP13nPattern(is_data, is_drop, param); }
            catch (e) { console.error("[HTML5][WS20][designAddTreeData] applyPaste", e); }
            _done();
        }, l_pos.x, l_pos.y, function (sRes) {
            // ★ BR61: 취소/후보없음 사유를 원본과 동일하게 안내한다.
            //   원본은 이 자리(aggrSelectPopup 의 cancelFunc)에서 받은 결과를 호출측이 직접 띄운다
            //   — contextMenuUiPaste(callDesignContextMenu.js 1407~1427), designP13nUIData(uiDesignArea.js 5997~6017).
            //   RETCD "E" 이면 RCODE 02(붙여넣을 aggregation 자체가 없음)=확인창(KIND 20),
            //   RCODE 01(선택 팝업에서 취소)=토스트(KIND 10). RTMSG 는 chkAggrRelation 이 실어준 문구
            //   (ZMSG_WS_COMMON_002 001/002/003) 또는 취소(/U4A/MSG_WS 001).
            //   이식본은 이 콜백이 결과를 버리고 정리만 해서, 붙여넣기가 막힌 이유가 화면에 전혀 안 떴다.
            if (sRes && sRes.RETCD === "E") {
                var _KIND = (sRes.RCODE === "02") ? 20 : 10;
                try { parent.showMessage(null, _KIND, "I", sRes.RTMSG); }
                catch (e) { console.error("[HTML5][WS20][designAddTreeData] 붙여넣기 불가 안내:", e && e.message ? e.message : e); }
            }
            _done();
        });

        return true;
    };

    // 패턴 트리의 $OTR: alias(프로퍼티·미바인딩) 재귀 수집 → 서버조회로 T_OTR 갱신(원본 lf_getOTRtext).
    function _fetchP13nOtr(is_data) {
        var aAlias = [];
        (function _walk(n) {
            if (!n) { return; }
            if (n.zTREE && n.zTREE.length) { for (var i = 0; i < n.zTREE.length; i++) { _walk(n.zTREE[i]); } }
            var a15 = n._T_0015 || [];
            for (var j = 0; j < a15.length; j++) {
                var s = a15[j];
                if (s.UIATY === "1" && s.ISBND !== "X" && String(s.UIATV || "").substr(0, 5) === "$OTR:") { aAlias.push(s.UIATV.substr(5)); }
            }
        })(is_data);

        if (aAlias.length === 0) { return Promise.resolve(); }   // 수집 alias 없으면 서버조회 생략.

        return new Promise(function (resolve) {
            var fd; try { fd = new FormData(); fd.append("ALIAS", JSON.stringify(aAlias)); } catch (e) { resolve(); return; }
            sendAjax(oAPP.attr.servNm + "/getOTRTextsAlias", fd, function (oRet) {
                if (oRet && oRet.RETCD === "E") { _toast("W", oRet.RTMSG); }
                if (oRet && typeof oRet.T_OTR !== "undefined") { oAPP.DATA.APPDATA.T_OTR = oRet.T_OTR; }   // 원본 6213 동일(대체).
                resolve();
            }, "X", true, "POST", function () { resolve(); });
        });
    }

    /* 패턴(파일에 저장된 트리)을 대상 UI 자식으로 붙여넣기.
     *   원본 designAddTreeData → lf_setPasteCopiedData + lf_paste_cb(uiDesignArea.js 5808~) 1:1 포트.
     *   ★검증된 designCopyUI(위 7절) 구조를 그대로 따르되, 속성/이벤트/설명의 출처만 다르다:
     *     copy = 라이브 저장소(oAPP.attr.prev/getDesc/T_CEVT) / 패턴 = 파일 노드에 **박제된**
     *     _T_0015·_DESC·_CEVT 를 읽는다(원본 lf_copyAttrData/lf_copyClientEvent + setDesc 가 그 필드 사용).
     *   미리보기 반영(addUIObjPreView/createUIInstance/moveUIObjPreView/prevDrawExceptionUi) + 클라이언트
     *   이벤트 배선(_CEVT→T_CEVT) 이 한 쌍으로 수행되고, 부모 rerender → 모델갱신 → 선택까지 원본대로 처리. */
    async function _applyP13nPattern(is_pattern, is_target, aggrParam) {

        var w = _frameWin();

        var _oUndoSnap = _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { return oAPP.fn.fnWs20PushUndo(); } });

        if (!is_target.zTREE) { is_target.zTREE = []; }

        // 공통코드(원본 lf_setPasteCopiedData 인자 · designCopyUI 와 동일 필터).
        var lt_ua018 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA018"; });
        var lt_ua026 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA026" && a.FLD02 !== "X"; });
        var lt_ua030 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA030" && a.FLD06 !== "X"; });
        var lt_ua032 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA032" && a.FLD06 !== "X"; });
        var lt_ua050 = oAPP.DATA.LIB.T_9011.filter(function (a) { return a.CATCD === "UA050" && a.FLD08 !== "X"; });

        // top 노드 drop index — getDropTargetLine 이 심은 dropLineInfo.dropIndex 우선(원본 6483~6494),
        //   없으면 대상 zTREE 끝. 사용 후 원본처럼 제거.
        var _dropIndex = (is_target.dropLineInfo && typeof is_target.dropLineInfo.dropIndex === "number")
            ? is_target.dropLineInfo.dropIndex : is_target.zTREE.length;
        try { delete is_target.dropLineInfo; } catch (e) { }

        // 속성 복사 — 파일 박제 _T_0015 사용(원본 lf_copyAttrData, bKeep=false: 바인딩/서버이벤트값 제외).
        function _copyAttr(is_14, is_copied, i_aggr) {
            if (!is_copied._T_0015 || is_copied._T_0015.length === 0) { return []; }
            var lt = [];
            for (var i = 0, l = is_copied._T_0015.length; i < l; i++) {
                var s = is_copied._T_0015[i];
                if (s.ISBND === "X" && s.UIATV !== "") { continue; }   // 바인딩값 제외.
                if (s.UIATY === "2" && s.UIATV !== "") { continue; }   // 서버이벤트값 제외.
                var ls_15 = oAPP.fn.crtStru0015();
                oAPP.fn.moveCorresponding(s, ls_15);
                ls_15.APPID = oAPP.attr.appInfo.APPID;
                ls_15.GUINR = oAPP.attr.appInfo.GUINR;
                ls_15.OBJID = is_14.OBJID;
                if (i_aggr && ls_15.UIATY === "6") {
                    ls_15.UIATK = i_aggr.UIATK; ls_15.UIATT = i_aggr.UIATT; ls_15.UIASN = i_aggr.UIASN;
                    ls_15.UIADT = i_aggr.UIADT; ls_15.UIADS = i_aggr.UIADS; ls_15.ISMLB = i_aggr.ISMLB;
                }
                lt.push(ls_15);
            }
            return lt;
        }

        // 클라이언트 이벤트 복사(원본 lf_copyClientEvent) — 파일 박제 _CEVT 의 OBJID 접두를 신규로 치환 후 T_CEVT 수집.
        //   ★이게 "UI 선택표시 + 클릭이벤트" 한 쌍의 후자 — 미리보기의 press 등 이벤트가 살아서 붙는다.
        function _copyClientEvent(OBJID, is_copied) {
            if (typeof is_copied._CEVT === "undefined") { return; }
            var _A = oAPP.DATA.APPDATA;
            if (!_A || !Array.isArray(_A.T_CEVT)) { return; }
            var arr = JSON.parse(JSON.stringify(is_copied._CEVT));
            for (var i = 0, l = arr.length; i < l; i++) {
                if (arr[i].OBJID && is_copied.OBJID) { arr[i].OBJID = arr[i].OBJID.replace(is_copied.OBJID, OBJID); }
            }
            _A.T_CEVT = _A.T_CEVT.concat(arr);
        }

        // 노드 재구성 재귀(원본 lf_setPasteCopiedData) — designCopyUI.lf_copy0014 와 동일 골격.
        function _rebuild(is_copied, is_parent, i_aggr) {
            var ls_14 = oAPP.fn.crtStru0014();
            oAPP.fn.crtTreeBindField(ls_14);
            oAPP.fn.moveCorresponding(is_copied, ls_14);
            ls_14.zTREE = [];

            ls_14.APPID = oAPP.attr.appInfo.APPID;
            ls_14.GUINR = oAPP.attr.appInfo.GUINR;

            if (i_aggr) {
                ls_14.UIATK = i_aggr.UIATK; ls_14.UIATT = i_aggr.UIATT; ls_14.UIASN = i_aggr.UIASN;
                ls_14.UIATY = i_aggr.UIATY; ls_14.UIADT = i_aggr.UIADT; ls_14.UIADS = i_aggr.UIADS;
                ls_14.ISMLB = i_aggr.ISMLB; ls_14.PUIATK = i_aggr.UIATK;
            }

            // OBJID 재채번 — 부모/이미 push된 형제가 트리에 있으므로 유일번호(원본 replace \d → setOBJID).
            ls_14.OBJID = ls_14.OBJID.replace(/\d/g, "");
            ls_14.OBJID = oAPP.fn.setOBJID(ls_14.OBJID);
            ls_14.POBID = is_parent.OBJID;
            ls_14.PUIOK = is_parent.UIOBK;

            ls_14.chk = false; ls_14.chk_visible = true;   // 원본 5907~5908. 트리 데코(DnD/체크박스/아이콘/액션)는
            //   원본 5932~5941처럼 세팅하되, HTML5 데코는 재귀형이라 서브트리 완성 후 top 노드에 1회 호출(아래) — 여기선 생략.

            var lt_0015 = _copyAttr(ls_14, is_copied, i_aggr);

            // 설명(원본 setDesc(ls_14.OBJID, is_copied._DESC)) + 클라이언트 이벤트.
            _safe(function () { if (typeof is_copied._DESC !== "undefined" && typeof oAPP.fn.setDesc === "function") { oAPP.fn.setDesc(ls_14.OBJID, is_copied._DESC); } });
            _safe(function () { _copyClientEvent(ls_14.OBJID, is_copied); });

            // 부모 zTREE 반영 — top 은 drop index splice, 자식은 push(원본).
            if (typeof i_aggr === "undefined") { is_parent.zTREE.push(ls_14); }
            else { is_parent.zTREE.splice(_dropIndex, 0, ls_14); }

            var l_UILIB = ls_14.UILIB;
            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UOBK === ls_14.UIOBK; });
            if (ls_0022) { l_UILIB = ls_0022.LIBNM; }

            // 미리보기 반영(원본 5983~6027) — top(aggr) 은 create+move+예외, 자식은 add.
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
                _safe(function () { if (typeof oAPP.fn.prevDrawExceptionUi === "function") { oAPP.fn.prevDrawExceptionUi(ls_14.UIOBK, ls_14.OBJID); } });
            }

            // file uploader UI 의 uploaderUrl 프로퍼티 예외처리(원본 6032).
            _safe(function () { if (typeof oAPP.fn.attrUploadUrlException === "function") { oAPP.fn.attrUploadUrlException(ls_14.OBJID, ls_14.UIOBK); } });

            // 자식 재귀(각 자식 push 후 다음 자식 채번 — 형제 충돌 방지).
            if (is_copied.zTREE && is_copied.zTREE.length !== 0) {
                for (var ci = 0, cl = is_copied.zTREE.length; ci < cl; ci++) { _rebuild(is_copied.zTREE[ci], ls_14); }
            }
            if (i_aggr) { return ls_14; }
        }

        // 파일 원본 보호 위해 1회 클론(치환이 _CEVT 등 in-place 발생).
        var oPattern; try { oPattern = JSON.parse(JSON.stringify(is_pattern)); } catch (e) { oPattern = is_pattern; }

        var ls_top = _rebuild(oPattern, is_target, aggrParam);

        // 트리 행 데코 — 원본 designAddTreeData 5932~5941: setTreeDnDEnable(drag/drop_enable) /
        //   setTreeChkBoxEnable(chk_visible, ROOT·APP·비편집 제외) / setTreeUiIcon(UICON+aggr아이콘 내부호출) /
        //   designSetActionIcon(visible_add·delete). HTML5 데코는 재귀형이라 top 노드 1회 호출로 서브트리 전체 적용.
        //   (직접 visible_add=true 세팅은 leaf/ROOT 규칙을 무시하므로 금지 — 반드시 공통 데코 경유.)
        if (ls_top) {
            _safe(function () { if (typeof oAPP.fn.setTreeDnDEnable === "function") { oAPP.fn.setTreeDnDEnable(ls_top); } });
            _safe(function () { if (typeof oAPP.fn.setTreeChkBoxEnable === "function") { oAPP.fn.setTreeChkBoxEnable(ls_top); } });
            _safe(function () { if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(ls_top); } });
            _safe(function () { if (typeof oAPP.fn.designSetActionIcon === "function") { oAPP.fn.designSetActionIcon(ls_top); } });
        }

        // 부모 미리보기 rerender 대기 → 모델/트리/속성 갱신 → 선택 → 변경플래그(원본 lf_paste_cb 후반 1:1, designCopyUI 동일).
        await _rerenderParent(is_target);
        await oAPP.fn.designRefershModel();
        _safe(function () { if (typeof oAPP.fn.setChangeFlag === "function") { oAPP.fn.setChangeFlag(); } });
        _safe(function () { if (typeof oAPP.fn.updateBindPopupDesignData === "function") { oAPP.fn.updateBindPopupDesignData(); } });
        // [BR59-4] 되돌리기 대상 = 이번에 붙여 넣은 최상위 UI(원본 CL_INSERT_UI 543 기준).
        _safe(function () { if (ls_top && typeof oAPP.fn.fnWs20SetUndoTarget === "function") { oAPP.fn.fnWs20SetUndoTarget({ OBJID: ls_top.OBJID }, _oUndoSnap); } });
        if (ls_top) { _safe(function () { if (typeof oAPP.fn.setSelectTreeItem === "function") { return oAPP.fn.setSelectTreeItem(ls_top.OBJID); } }); }
    }


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
            // [BR59-4] 되돌리기 대상 = 끌어온 UI(원본 CL_DRAG_DROP 1758·1924 `setSelectTreeItem(S_DRAG.OBJID)` 기준).
            _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo({ OBJID: i_drag.OBJID }); } });

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
            // [BR59-4] 되돌리기 대상 = 끌어온 UI(원본 CL_DRAG_DROP 1758·1924 `setSelectTreeItem(S_DRAG.OBJID)` 기준).

        // [BR59-4] 되돌리기 대상 = 끌어온 UI(원본 CL_DRAG_DROP 1758·1924 기준).
        _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { oAPP.fn.fnWs20PushUndo({ OBJID: i_drag.OBJID }); } });

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

        /* [D04] sap.ui.table.Table / sap.ui.table.TreeTable 의 columns aggregation 에 Drop 되는 UI 는
         *   N건 바인딩 판단을 template aggregation 기준으로 한다.
         *   원본 근거 = U4A_WS_DESIGN\design\js\uiDesignArea.js 3438행(drop_cb, 2026-08-16 갱신분).
         *   ★순서 제약: 반드시 위 l_path(끌어온 쪽 경로) 계산 "뒤".
         *     _UIATT 는 끌어온 쪽 판정에도 쓰이므로, 이 블록이 위로 가면 끌어온 쪽 경로까지
         *     template 로 잘못 계산돼 살아 있어야 할 바인딩이 해제된다. */
        if (["UO01139", "UO01142"].indexOf(i_drop.UIOBK) !== -1 && param.UIATT === "columns") {
            _UIATT = "template";
        }

        var l_path2 = oAPP.fn.getParentAggrBind(oAPP.attr.prev[i_drop.OBJID], _UIATT);
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

        /* [D03] Ctrl 누른 채 끌어다 놓아 복사할 때, 새 자리에서 쓸 수 없는 여러 건 바인딩 경로를 푼다.
         *   원본 근거 = U4A_WS_DESIGN\design\js\uiDesignArea.js 2873~2907 (designCopyUI, 2026-08-16 갱신분).
         *   ★순서 제약: 복사본이 만들어진 "뒤" · 되돌리기 저장 "앞". 되돌리기 뒤에 넣으면 되돌리기 기록에
         *     "바인딩이 안 풀린 상태"가 찍혀, 한 번 되돌렸다 다시 하면 상태가 어긋난다(원본도 이 자리).
         *   ★판정 기준이 둘로 갈린다 — 표 열 여부는 "복사본(ls_copy)", 경로 조회는 "끌어온 원래 줄(is_t)". */
        var _UIATT_CP = undefined;

        //끌어온 UI가 표의 열이면서 본보기 자리에 UI가 있으면, 여러 건 바인딩 판단을 본보기 자리 기준으로.
        if (ls_copy && ls_copy.UIOBK === "UO01127" &&
            (ls_copy.zTREE || []).findIndex(function (item) { return item.UIATT === "template"; }) !== -1) {
            _UIATT_CP = "template";
        }

        //끌어온 UI가 여러 건 바인딩돼 있는지 확인.
        var _pathCp = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_t.OBJID], _UIATT_CP);

        //놓는 자리의 여러 건 바인딩 경로 확인.
        var _pathCp2 = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_p.OBJID], aggrParam.UIATT);

        //경로가 서로 다르면 복사본의 바인딩을 하위까지 푼다(원본 l_unbind).
        var _unbindCp = false;
        if (_pathCp && _pathCp !== "" && _pathCp !== _pathCp2) { _unbindCp = true; }

        oAPP.fn.designUnbindUi(ls_copy, _pathCp, _unbindCp);

        // UNDO (HTML5 단일스택 — 원본 undoRedo COPY 대체).
        var _oUndoSnap = _safe(function () { if (typeof oAPP.fn.fnWs20PushUndo === "function") { return oAPP.fn.fnWs20PushUndo(); } });

        await _rerenderParent(is_p);

        await oAPP.fn.designRefershModel();
        oAPP.fn.designDragEnd();
        oAPP.fn.setChangeFlag();
        oAPP.fn.updateBindPopupDesignData();
        // [BR59-4] 되돌리기 대상 = 이번에 붙여 넣은 UI(원본 CL_INSERT_UI 543 기준).
        _safe(function () { if (ls_copy && typeof oAPP.fn.fnWs20SetUndoTarget === "function") { oAPP.fn.fnWs20SetUndoTarget({ OBJID: ls_copy.OBJID }, _oUndoSnap); } });
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

            // 바인딩 팝업(별창) 가운데 디자인 트리로 drop 시 소비할 prc002 데이터(원본 setDragAppData 1:1).
            _safe(function () { _setDragBindPopupData(oNode, ev); });

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
