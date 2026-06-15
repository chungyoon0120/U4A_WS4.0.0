/************************************************************************
 * ws_html5_ws20_tree.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — W3 단계: WS20 좌측 "UI 트리"]
 *  WS20 비주얼 편집화면의 좌측 "UI 트리"를
 *  SAP UI5(sap.ui.table.TreeTable) → 순수 HTML5(DOM 재귀 트리 <ul>/<li> + CSS + 바닐라 JS)
 *  로 재구현한다.
 *
 *  - 본 파일은 library-preload.js 의 로드 목록에서 ws_html5_ws20.js "보다 뒤"
 *    (가장 마지막) 에 위치하여, 원본 oAPP.fn.uiDesignArea (design/js/uiDesignArea.js,
 *    sap.ui.table.TreeTable 생성)를 같은 이름으로 재정의(override)한다.
 *    (원본 UI5 파일은 수정하지 않음)
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [원본 /zTREE 노드 필드 구조 — 실측 (design/js/uiDesignArea.js)]
 *  ────────────────────────────────────────────────────────────────────
 *   · 데이터 위치 : oAPP.attr.oModel.oData.zTREE  (배열, ROOT 는 [0])
 *   · 자식 배열 키 : zTREE                          (재귀)
 *   · 모델 바인딩 (원본 1082행):
 *        bindAggregation("rows", {path:"/zTREE", parameters:{arrayNames:["zTREE"]}})
 *   · 노드 필드 (crtTreeBindField 1731행, setTree* / designSetActionIcon):
 *        OBJID        : UI 이름/식별자 (예: ROOT / APP / PAGE / BUTTON1) → 라벨 + tooltip
 *        UIATT        : 부모 aggregation 명 (예: "pages") → 우측 ObjectStatus text
 *        UIATT_ICON   : aggregation cardinality 아이콘 (sap-icon://color-fill[0:1]
 *                       / sap-icon://dimension[0:N])  (setTreeAggrIcon 1535행)
 *        UICON        : UI 아이콘 (fnGetSapIconPath 로 변환된 .gif 절대경로)
 *        icon_visible : UI 아이콘 표시 여부
 *        chk          : 체크박스 선택 상태
 *        chk_visible  : 체크박스 표시 여부 (IS_EDIT && ROOT/APP 제외)
 *        highlight    : 행 하이라이트 ("None" / "Indication02" / "Indication04"
 *                       / "Indication08")  (RowSettings highlight 바인딩, 1086행)
 *        visible_add    : + 추가 버튼 표시 여부 (IS_EDIT && ROOT 제외)
 *        visible_delete : 삭제 버튼 표시 여부 (IS_EDIT && ROOT/APP 제외)
 *        drag_enable / drop_enable : D&D 가능 여부 (W3 범위 밖)
 *   · 모델 레벨 : oAPP.attr.oModel.oData.IS_EDIT (편집/표시 모드)
 *   · 펼침/접힘 : 원본은 TreeTable 런타임이 node.nodeState.expanded / node.isLeaf 로 관리.
 *        HTML5 에서는 "비-UI 로직 보존" 원칙상 모델 노드를 변형하지 않기 위해,
 *        펼침 상태를 UI 전용 사이드맵 oAPP.attr.ws20TreeExpanded[OBJID] 로만 관리한다.
 *        (모델/선택/펼침계산 등 원본 데이터는 일절 변경하지 않음)
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [보존되는 비-UI 로직 — 원본 함수를 그대로 호출만 함]
 *  ────────────────────────────────────────────────────────────────────
 *   · oAPP.fn.setSelectTreeItem(OBJID)      : 선택 노드 식별/경로계산 (uiDesignArea 2172행)
 *   · oAPP.fn.selectBindingPopupOBJID(tree) : 바인딩팝업 라인 선택 (원본 cellClick 64행)
 *   · oAPP.fn.designTreeSelChkbox(tree)     : 체크박스 parent/child 연동 (3613행)
 *   · oAPP.fn.designClearCheckAll()         : 체크박스 전체 해제 (1793행)
 *   · oAPP.fn.expandTreeItem()              : 선택 라인 하위 모두 펼침 (1965행)
 *   · oAPP.fn.designUIAdd / designUIDelete  : UI 추가/삭제 (원본 Column action)
 *   · oAPP.fn.getTreeData(OBJID)            : OBJID 로 노드 검색 (1897행)
 *  이 함수들은 추측으로 변경하지 않으며, 미변환(UI5 의존) 시 try/catch + console.warn 가드.
 *
 *  ────────────────────────────────────────────────────────────────────
 *  [W3 범위 밖 — 가드만 처리하는 다운스트림]
 *  ────────────────────────────────────────────────────────────────────
 *   · 속성 패널 갱신 (W4)      : 행 클릭 → setSelectTreeItem 내부 속성영역 렌더
 *   · 미리보기 갱신 (W2)       : selectBindingPopupOBJID / designTreeItemPress
 *   · 드래그&드롭 UI 이동/삽입  : DragInfo/DropInfo (다음 단계)
 *   · 컨텍스트 메뉴            : callDesignContextMenu (다음 단계)
 *   · 검색/위자드/개인화/도움말 : 팝업 호출 버튼 (원본 핸들러 연결 + 가드)
 *   · undo/redo               : undoRedo.executeHistory (원본 핸들러 연결 + 가드)
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    /************************************************************************
     * 메시지 텍스트 안전 조회 (모델 미초기화/미로그인 상황에서도 폴백)
     ************************************************************************/
    function _msg(sNum, sFallback) {
        // 메시지 번호 없으면 조회 생략 — fnGetMsgClsText 가 "못 찾음" 으로 "클래스경로|번호"
        //   (예: /U4A/CL_WS_COMMON|) 를 반환해 라벨에 노출되는 버그 방지.
        if (sNum == null || sNum === "") { return sFallback != null ? sFallback : ""; }
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "") { return s; }
        } catch (e) { }
        return sFallback;
    }

    /************************************************************************
     * 원본 미변환 함수 안전 호출 (UI5 의존 → 다음 단계 변환).
     *   존재하지 않으면 console.warn, 호출 중 오류는 try/catch 가드.
     ************************************************************************/
    function _safeCall(sFnName, aArgs, oThis) {
        var fn = oAPP.fn && oAPP.fn[sFnName];
        if (typeof fn !== "function") {
            console.warn("[HTML5][WS20][tree] not implemented (다음 단계 변환):", sFnName);
            return;
        }
        try {
            return fn.apply(oThis || oAPP.fn, aArgs || []);
        } catch (e) {
            console.warn("[HTML5][WS20][tree] call error (다음 단계 변환):", sFnName, e && e.message);
        }
    }

    /************************************************************************
     * /zTREE 루트 배열 조회 (원본: oAPP.attr.oModel.oData.zTREE)
     *   데이터가 비어있어도(로그인/앱오픈 전) 안전하게 [] 반환.
     ************************************************************************/
    function _getTreeRoot() {
        try {
            var oModel = oAPP.attr && oAPP.attr.oModel;
            if (oModel) {
                // 변환된 셸 모델은 .oData 가 없고 getProperty 로 접근(구 UI5 JSONModel 은 .oData)
                var aTree = (typeof oModel.getProperty === "function")
                    ? oModel.getProperty("/zTREE")
                    : (oModel.oData && oModel.oData.zTREE);
                if (Array.isArray(aTree)) return aTree;
            }
        } catch (e) { }
        return [];
    }

    /************************************************************************
     * IS_EDIT (편집 모드) 조회 — 원본 oData.IS_EDIT
     ************************************************************************/
    function _isEdit() {
        try {
            var oModel = oAPP.attr && oAPP.attr.oModel;
            if (oModel) {
                var v = (typeof oModel.getProperty === "function")
                    ? oModel.getProperty("/IS_EDIT")
                    : (oModel.oData && oModel.oData.IS_EDIT);
                return v === true || v === "X";
            }
        } catch (e) { }
        return false;
    }

    /************************************************************************
     * 펼침 상태 사이드맵 (UI 전용 — 모델 노드를 변형하지 않기 위함)
     *   key: OBJID, value: true(펼침)/false(접힘)
     *   기본값: 자식이 있으면 펼침(원본 TreeTable 최초 노출과 유사하게).
     ************************************************************************/
    function _expandedMap() {
        if (!oAPP.attr.ws20TreeExpanded) {
            oAPP.attr.ws20TreeExpanded = {};
        }
        return oAPP.attr.ws20TreeExpanded;
    }

    function _isExpanded(oNode) {
        var sKey = oNode && oNode.OBJID;
        if (sKey == null) { return true; }
        var oMap = _expandedMap();
        // 미설정 노드는 기본 펼침 (false 로 명시 저장된 경우만 접힘)
        if (Object.prototype.hasOwnProperty.call(oMap, sKey)) {
            return oMap[sKey] === true;
        }
        return true;
    }

    function _hasChild(oNode) {
        return !!(oNode && Array.isArray(oNode.zTREE) && oNode.zTREE.length > 0);
    }

    /************************************************************************
     * sap-icon URI → 표시용 글리프 매핑 (UIATT_ICON 등).
     *   원본은 sap.ui.core.Icon(아이콘 폰트). HTML5 단계에선 대체 글리프 사용.
     ************************************************************************/
    var _GLYPH = {
        "sap-icon://color-fill": "◇",  // 0:1 aggregation
        "sap-icon://dimension": "◆"    // 0:N aggregation
    };
    function _aggrGlyph(sIcon) {
        if (!sIcon) { return ""; }
        return _GLYPH[sIcon] || "◆";
    }

    /************************************************************************
     * 현재 선택된 OBJID (UI 전용 하이라이트 표시용).
     *   원본 선택 상태는 setSelectTreeItem 가 모델/속성영역까지 처리하므로
     *   여기서는 "표시"만 담당하고, 선택 로직 자체는 원본 함수에 위임.
     ************************************************************************/
    function _getSelectedObjid() {
        return oAPP.attr.ws20SelectedObjid || null;
    }
    function _setSelectedObjid(sObjid) {
        oAPP.attr.ws20SelectedObjid = sObjid || null;
    }

    /* ====================================================================
     * (A) 트리 툴바
     *   원본 oLTBar1(OverflowToolbar) 의 버튼 순서/툴팁/핸들러를 충실히 재현.
     * ==================================================================== */

    function _tbBtn(oCfg) {
        var BTN = document.createElement("button");
        BTN.type = "button";
        // [공통 UX] 공통 아이콘 버튼(shell.css .u4a-btn-icon) 사용. 위험/승인은 색만 지정.
        BTN.className = "u4a-btn-icon";
        if (oCfg.reject) { BTN.style.color = "var(--error)"; }
        else if (oCfg.accept) { BTN.style.color = "var(--success)"; }
        BTN.title = oCfg.tooltip || "";
        if (oCfg.icon) { BTN.setAttribute("data-sap-icon", oCfg.icon); }
        if (oCfg.editOnly) { BTN.setAttribute("data-edit-only", "X"); }

        var GLY = document.createElement("span");
        GLY.className = "u4aWs20TreeTbIcon";
        // 아이콘 = FontAwesome (다른 화면과 동일). 기존 글리프(gly)는 FA 이름으로 매핑.
        var _G2FA = {
            "⊞": "square-plus", "⊟": "square-minus", "🔍": "magnifying-glass",
            "≣": "list-check", "🗑": "trash", "🪄": "wand-magic-sparkles",
            "⧉": "table-list", "↶": "rotate-left", "↷": "rotate-right", "?": "circle-question"
        };
        var _faName = oCfg.fa || _G2FA[oCfg.gly];
        if (_faName) { GLY.innerHTML = '<i class="fa-solid fa-' + _faName + '"></i>'; }
        else { GLY.textContent = oCfg.gly || ""; }
        BTN.appendChild(GLY);

        if (typeof oCfg.press === "function") {
            BTN.addEventListener("click", function () {
                try {
                    oCfg.press();
                } catch (e) {
                    console.warn("[HTML5][WS20][tree] toolbar press error:", oCfg.icon, e && e.message);
                }
            });
        }
        return BTN;
    }

    function _tbSep() {
        var S = document.createElement("span");
        S.className = "u4aWs20TreeTbSep";
        return S;
    }

    function _buildTreeToolbar() {

        var BAR = document.createElement("div");
        BAR.className = "u4aWs20TreeToolbar";

        // 언어 (undo/redo 텍스트용) — 원본 임시로직과 동일하게 EN/KO 처리
        var _LANGU = "EN";
        try {
            var _sInfo = parent.getUserInfo && parent.getUserInfo();
            _LANGU = (_sInfo && _sInfo.LANGU) || "EN";
            if ("EN|KO".indexOf(_LANGU) === -1) { _LANGU = "EN"; }
        } catch (e) { _LANGU = "EN"; }

        function _wsMsg(sNr, sFallback) {
            try {
                var s = parent.WSUTIL.getWsMsgClsTxt(_LANGU, "ZMSG_WS_COMMON_001", sNr);
                if (s) { return s; }
            } catch (e) { }
            return sFallback;
        }

        var aBtns = [
            // B21 Expand — 선택 라인 하위 모두 펼침 (원본 expandTreeItem)
            {
                icon: "sap-icon://expand-group", gly: "⊞",
                tooltip: _msg("B21", "Expand"),
                press: function () { oAPP.fn.fnWs20TreeExpandSelected(); }
            },
            // B22 Collapse — 선택 라인 접힘 (원본 oLTree1.collapse(selectedIndex))
            {
                icon: "sap-icon://collapse-group", gly: "⊟",
                tooltip: _msg("B22", "Collapse"),
                press: function () { oAPP.fn.fnWs20TreeCollapseSelected(); }
            },
            { sep: true },
            // A70 Find UI — 검색 팝업 (원본 callDesignTreeFindPopup) [가드]
            {
                icon: "sap-icon://search", gly: "🔍",
                tooltip: _msg("A70", "Find UI"),
                press: function () { _safeCall("callDesignTreeFindPopup", []); }
            },
            // B23 Clear selection — 체크박스 전체 해제 (원본 designClearCheckAll)
            {
                icon: "sap-icon://multiselect-none", gly: "≣", editOnly: true,
                tooltip: _msg("B23", "Clear selection"),
                press: function () { _safeCall("designClearCheckAll", []); }
            },
            // A03 Delete — 멀티 삭제 (원본 designTreeMultiDeleteItem) [가드]
            {
                icon: "sap-icon://delete", gly: "🗑", reject: true, editOnly: true,
                tooltip: _msg("A03", "Delete"),
                press: function () { _safeCall("designTreeMultiDeleteItem", []); }
            },
            // B24 UI Template Wizard (원본 designCallWizardPopup) [가드]
            {
                icon: "sap-icon://responsive", gly: "🪄", accept: true, editOnly: true,
                tooltip: _msg("B24", "UI Template Wizard"),
                press: function () { _safeCall("designCallWizardPopup", []); }
            },
            // E28 UI Personalization List (원본 callP13nDesignDataPopup) [가드]
            {
                icon: "sap-icon://user-settings", gly: "⧉",
                tooltip: _msg("E28", "UI Personalization List"),
                press: function () { _safeCall("callP13nDesignDataPopup", ["R"]); }
            },
            { sep: true },
            // 247 Undo (원본 undoRedo.executeHistory("UNDO")) [가드]
            {
                icon: "sap-icon://undo", gly: "↶", editOnly: true,
                tooltip: _wsMsg("247", "Undo (Ctrl+Z)"),
                press: function () { _execHistory("UNDO"); }
            },
            // 248 Redo (원본 undoRedo.executeHistory("REDO")) [가드]
            {
                icon: "sap-icon://redo", gly: "↷", editOnly: true,
                tooltip: _wsMsg("248", "Redo (Ctrl+Y)"),
                press: function () { _execHistory("REDO"); }
            },
            { sep: true },
            // B39 Help (원본 도움말 팝업) [가드]
            {
                icon: "sap-icon://question-mark", gly: "?",
                tooltip: _msg("B39", "Help"),
                press: function () {
                    try {
                        if (oAPP.common && oAPP.common.checkWLOList &&
                            oAPP.common.checkWLOList("C", "UHAK901369") === true &&
                            typeof oAPP.fn.fnU4AHelpDocuPopupOpener === "function") {
                            oAPP.fn.fnU4AHelpDocuPopupOpener({ startMenuId: "000272" });
                            return;
                        }
                    } catch (e) { }
                    _safeCall("callTooltipsPopup", [null, "designTooltip", "E21"]);
                }
            }
        ];

        aBtns.forEach(function (oCfg) {
            if (oCfg.sep) { BAR.appendChild(_tbSep()); return; }
            BAR.appendChild(_tbBtn(oCfg));
        });

        return BAR;
    }

    // undo/redo 원본 진입점 (parent.require(oAPP.oDesign.pathInfo.undoRedo)) [가드]
    function _execHistory(sMode) {
        try {
            var oUndoRedo = parent.require(oAPP.oDesign.pathInfo.undoRedo);
            if (oUndoRedo && typeof oUndoRedo.executeHistory === "function") {
                oUndoRedo.executeHistory(sMode);
                return;
            }
            console.warn("[HTML5][WS20][tree] undoRedo not available:", sMode);
        } catch (e) {
            console.warn("[HTML5][WS20][tree] executeHistory error (다음 단계 변환):", sMode, e && e.message);
        }
    }

    /* ====================================================================
     * (B) 재귀 트리 렌더
     *   원본 sap.ui.table.TreeTable rows 바인딩(/zTREE) 을 <ul>/<li> 재귀로 대체.
     * ==================================================================== */

    /************************************************************************
     * 트리 1개 노드(<li>) 렌더 — 행(row) + (펼침 시)자식 <ul>
     ************************************************************************/
    function _renderNode(oNode, oParentUl, iDepth) {

        if (!oNode || typeof oNode !== "object") { return; }

        var sObjid = oNode.OBJID != null ? oNode.OBJID : "";
        var bHasChild = _hasChild(oNode);
        var bExpanded = _isExpanded(oNode);

        var LI = document.createElement("li");
        LI.className = "u4aWs20TreeNode";

        // ── 행(row) ── 공통 트리 컴포넌트(shell.css .u4a-tree__row) 소비.
        //   u4aWs20TreeRow 는 WS20 부가(높이/highlight/조회셀렉터)용으로 병기.
        var ROW = document.createElement("div");
        ROW.className = "u4a-tree__row u4aWs20TreeRow";
        ROW.setAttribute("data-objid", sObjid);
        ROW.title = sObjid; // 원본 HBox tooltip="{OBJID}"
        ROW.style.paddingLeft = (6 + iDepth * 16) + "px";
        if (bHasChild) {
            ROW.setAttribute("aria-expanded", bExpanded ? "true" : "false"); // 셰브론 회전(공통 CSS)
        }

        // 선택 하이라이트 — 공통 컴포넌트 규칙(aria-selected). (WS20 highlight 는 hl-* 별도)
        if (_getSelectedObjid() === sObjid) {
            ROW.setAttribute("aria-selected", "true");
        }
        // highlight 필드 (None / Indication02 / 04 / 08) → 좌측 컬러바
        var sHi = oNode.highlight || "None";
        if (sHi && sHi !== "None") {
            ROW.classList.add("hl-" + sHi);
        }

        // 좌측 그룹 (토글 + 체크박스 + 아이콘 + 이름)
        var LEFT = document.createElement("div");
        LEFT.className = "u4aWs20TreeRowLeft";

        // 펼침/접기 토글 (자식 있을 때만 ▼/▶, isLeaf면 자리만)
        // 토글 — 공통 트리 컴포넌트(shell.css .u4a-tree__toggle). 회전은 행의 aria-expanded 가 제어.
        var TOG = document.createElement("span");
        TOG.className = "u4a-tree__toggle";
        TOG.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        if (bHasChild) {
            TOG.addEventListener("click", function (e) {
                e.stopPropagation();
                _toggleNode(oNode, ROW);
            });
        } else {
            TOG.classList.add("u4a-tree__toggle--leaf");
        }
        LEFT.appendChild(TOG);

        // 체크박스 (chk_visible / chk)
        if (oNode.chk_visible === true) {
            var CHK = document.createElement("input");
            CHK.type = "checkbox";
            CHK.className = "u4aWs20TreeChk";
            CHK.checked = (oNode.chk === true);
            CHK.addEventListener("click", function (e) {
                e.stopPropagation();
            });
            CHK.addEventListener("change", function (e) {
                e.stopPropagation();
                // 원본 체크박스 select 이벤트와 동일: 모델 노드의 chk 갱신 후
                // parent/child 연동 처리 위임 (designTreeSelChkbox).
                oNode.chk = CHK.checked;
                _safeCall("designTreeSelChkbox", [oNode]);
                // 모델 chk 연동 결과를 화면에 반영.
                oAPP.fn.fnRenderDesignTree();
            });
            LEFT.appendChild(CHK);
        }

        // UI 아이콘 (UICON: fnGetSapIconPath 로 만든 .gif 경로, icon_visible)
        if (oNode.icon_visible === true && oNode.UICON) {
            var IMG = document.createElement("img");
            IMG.className = "u4a-tree__icon u4aWs20TreeIcon";
            // UICON 은 raw OS 경로(...\icons\x.gif) → <img> 로드되도록 file:// URL 변환.
            IMG.src = (function (p) {
                if (!p) { return p; }
                if (/^(file:|https?:|data:|\/)/i.test(p)) { return p; }
                return "file:///" + String(p).replace(/\\/g, "/");
            })(oNode.UICON);
            IMG.alt = "";
            IMG.onerror = function () { this.style.display = "none"; };
            LEFT.appendChild(IMG);
        }

        // UI 이름 (OBJID)
        var NAME = document.createElement("span");
        NAME.className = "u4a-tree__label u4aWs20TreeName";
        NAME.textContent = sObjid;
        LEFT.appendChild(NAME);

        ROW.appendChild(LEFT);

        // 우측 그룹 (aggregation 라벨 + hover 시 +추가/삭제)
        var RIGHT = document.createElement("div");
        RIGHT.className = "u4aWs20TreeRowRight";

        // aggregation 라벨 (UIATT + UIATT_ICON) — 원본 ObjectStatus
        if (oNode.UIATT) {
            var AGGR = document.createElement("span");
            AGGR.className = "u4aWs20TreeAggr";
            if (oNode.UIATT_ICON) {
                var AGI = document.createElement("span");
                AGI.className = "u4aWs20TreeAggrIcon";
                AGI.textContent = _aggrGlyph(oNode.UIATT_ICON);
                AGGR.appendChild(AGI);
            }
            var AGT = document.createElement("span");
            AGT.textContent = oNode.UIATT;
            AGGR.appendChild(AGT);
            RIGHT.appendChild(AGGR);
        }

        // 행 액션 (+추가 / 삭제) — hover 시 노출 (visible_add / visible_delete)
        var ACT = document.createElement("span");
        ACT.className = "u4aWs20TreeActions";

        if (oNode.visible_add === true) {
            var ADD = document.createElement("button");
            ADD.type = "button";
            ADD.className = "u4aWs20TreeActBtn add";
            ADD.title = _msg("A54", "Insert Element");
            ADD.innerHTML = '<i class="fa-solid fa-plus"></i>';
            ADD.addEventListener("click", function (e) {
                e.stopPropagation();
                // 원본 add Icon press: designUIAdd(노드) [가드]
                _safeCall("designUIAdd", [oNode]);
            });
            ACT.appendChild(ADD);
        }

        if (oNode.visible_delete === true) {
            var DEL = document.createElement("button");
            DEL.type = "button";
            DEL.className = "u4aWs20TreeActBtn del";
            DEL.title = _msg("A03", "Delete");
            DEL.innerHTML = '<i class="fa-solid fa-trash"></i>';
            DEL.addEventListener("click", function (e) {
                e.stopPropagation();
                // 원본 delete Icon press: designUIDelete(노드) [가드]
                _safeCall("designUIDelete", [oNode]);
            });
            ACT.appendChild(DEL);
        }

        RIGHT.appendChild(ACT);
        ROW.appendChild(RIGHT);

        // 행 클릭 → 선택 (원본 cellClick 핸들러 로직)
        ROW.addEventListener("click", function () {
            oAPP.fn.fnWs20TreeSelectRow(oNode);
        });

        LI.appendChild(ROW);

        // 자식 — 항상 렌더 후 펼침상태로 표시/숨김. (ServerList 컨셉: 토글=aria-expanded+ul.hidden
        //   → 셰브론 회전 애니메이션 유지. 펼칠 때만 렌더하면 전체 재렌더라 애니메이션이 안 됨)
        if (bHasChild) {
            var UL = document.createElement("ul");
            UL.className = "u4aWs20TreeChildren";
            UL.hidden = !bExpanded;
            for (var i = 0, l = oNode.zTREE.length; i < l; i++) {
                _renderNode(oNode.zTREE[i], UL, iDepth + 1);
            }
            LI.appendChild(UL);
        }

        oParentUl.appendChild(LI);
    }

    /************************************************************************
     * 펼침/접힘 토글 (UI 전용 사이드맵만 변경 → 재렌더).
     *   비-UI 로직(모델 노드/펼침 계산)은 변경하지 않음.
     ************************************************************************/
    function _toggleNode(oNode, oRow) {
        var sKey = oNode && oNode.OBJID;
        if (sKey == null) { return; }
        var bExpand = !_isExpanded(oNode);
        _expandedMap()[sKey] = bExpand;
        // in-place 토글 — 전체 재렌더 대신 행 aria-expanded + 자식 ul 표시/숨김.
        //   (공통 CSS 가 aria-expanded 로 셰브론을 부드럽게 회전 → ServerList 와 동일)
        if (oRow && oRow.parentNode) {
            oRow.setAttribute("aria-expanded", bExpand ? "true" : "false");
            var oChildUl = oRow.parentNode.querySelector(":scope > ul.u4aWs20TreeChildren");
            if (oChildUl) { oChildUl.hidden = !bExpand; return; }
        }
        oAPP.fn.fnRenderDesignTree(); // 폴백(행/자식 ul 못 찾으면 전체 재렌더)
    }

    /************************************************************************
     * [PUBLIC] 수동 렌더 — 원본 TreeTable rows 바인딩(/zTREE) 대체.
     *   /zTREE 가 갱신되면(designAddTreeData/undoRedo 등 → 모델 set) 이 함수를
     *   호출하여 다시 그린다. 데이터가 비어있어도 안전하게 빈 트리 렌더.
     ************************************************************************/
    oAPP.fn.fnRenderDesignTree = function () {

        var oTreePane = document.getElementById("ws20DesignTree");
        if (!oTreePane) {
            // WS20 셸이 아직 안 그려졌으면 무시 (이후 진입 시 재호출됨)
            return;
        }

        // 트리 패널 본문 컨테이너 (툴바 + 스크롤영역) 1회 구성
        var oWrap = oTreePane.querySelector(".u4aWs20TreeWrap");
        if (!oWrap) {
            oTreePane.innerHTML = "";
            oWrap = document.createElement("div");
            oWrap.className = "u4aWs20TreeWrap";

            // 트리 툴바
            oWrap.appendChild(_buildTreeToolbar());

            // 트리 스크롤 영역
            var oScroll = document.createElement("div");
            oScroll.className = "u4aWs20TreeScroll";
            oWrap.appendChild(oScroll);

            oTreePane.appendChild(oWrap);
        }

        // 편집모드(IS_EDIT) 에 따라 편집 전용 버튼 표시/숨김 (원본 visible:"{/IS_EDIT}")
        var bEdit = _isEdit();
        var aEditOnly = oWrap.querySelectorAll('[data-edit-only="X"]');
        for (var k = 0; k < aEditOnly.length; k++) {
            aEditOnly[k].style.display = bEdit ? "" : "none";
        }

        var oScrollArea = oWrap.querySelector(".u4aWs20TreeScroll");
        oScrollArea.innerHTML = "";

        var aRoot = _getTreeRoot();

        // 데이터 없음 → 빈 트리(안내 라벨). 실제 데이터는 로그인 후 앱 오픈 시 채워짐.
        if (!aRoot || aRoot.length === 0) {
            var EMPTY = document.createElement("div");
            EMPTY.className = "u4aWs20TreeEmpty";
            EMPTY.textContent = _msg("", "") || "";
            oScrollArea.appendChild(EMPTY);
            return;
        }

        var UL = document.createElement("ul");
        UL.className = "u4aWs20Tree u4a-tree"; // 공통 트리 컨테이너(shell.css) 병기
        for (var i = 0, l = aRoot.length; i < l; i++) {
            _renderNode(aRoot[i], UL, 0);
        }
        oScrollArea.appendChild(UL);

    }; // end of oAPP.fn.fnRenderDesignTree

    /************************************************************************
     * [PUBLIC] 행 클릭 선택 — 원본 cellClick 핸들러 로직 재현.
     *   원본(uiDesignArea.js 26~75행):
     *     · setShortcutLock(true) / 자식윈도우 BUSY_ON
     *     · setSelectTreeItem(ls_tree.OBJID)   ← 선택 노드 식별/펼침/속성영역
     *     · selectBindingPopupOBJID(ls_tree)   ← 바인딩팝업 라인 선택(미리보기 연계)
     *     · BUSY_OFF / setShortcutLock(false)
     *   속성패널(W4)/미리보기(W2) 미변환 → setSelectTreeItem/selectBindingPopupOBJID
     *   내부 UI5 의존 부분은 try/catch + console.warn 으로 가드.
     ************************************************************************/
    oAPP.fn.fnWs20TreeSelectRow = async function (oNode) {

        if (!oNode) { return; }

        // UI 전용 선택 표시 갱신 (즉시 하이라이트)
        _setSelectedObjid(oNode.OBJID);
        oAPP.fn.fnRenderDesignTree();

        // 단축키 잠금 + 자식 윈도우 BUSY (원본과 동일, 존재 시에만)
        try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(true); } catch (e) { }
        try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
        try {
            oAPP.attr.oMainBroad && oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });
        } catch (e) { }

        try {
            // [W4] HTML5 속성 패널 선택 흐름 — ws_html5_ws20_attr.js 의 fnWs20SelectUI.
            //  (원본 setSelectTreeItem 의 비-UI 부속(busy/잠금/BUSY_ON)은 본 핸들러가
            //   이미 수행 중이므로 bSkipBusy 로 중복 회피. UI5 TreeTable 의존부 제외)
            if (typeof oAPP.fn.fnWs20SelectUI === "function") {
                try {
                    await oAPP.fn.fnWs20SelectUI(oNode.OBJID, { bSkipBusy: true });
                } catch (e) {
                    console.warn("[HTML5][WS20][tree] fnWs20SelectUI error:", e && e.message);
                }
            } else if (typeof oAPP.fn.setSelectTreeItem === "function") {
                try {
                    await oAPP.fn.setSelectTreeItem(oNode.OBJID);
                } catch (e) {
                    console.warn("[HTML5][WS20][tree] setSelectTreeItem error (속성패널 W4 / 미변환):", e && e.message);
                }
            } else {
                console.warn("[HTML5][WS20][tree] setSelectTreeItem not implemented (W4 예정)");
            }

            // 바인딩 팝업 라인 선택 (미리보기 W2 연계) — 가드
            if (typeof oAPP.fn.selectBindingPopupOBJID === "function") {
                try {
                    oAPP.fn.selectBindingPopupOBJID(oNode);
                } catch (e) {
                    console.warn("[HTML5][WS20][tree] selectBindingPopupOBJID error (미리보기 W2 / 미변환):", e && e.message);
                }
            }
        } finally {
            try {
                oAPP.attr.oMainBroad && oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });
            } catch (e) { }
            try { oAPP.fn.setShortcutLock && oAPP.fn.setShortcutLock(false); } catch (e) { }
            try { parent.setBusy && parent.setBusy(""); } catch (e) { }
        }

    }; // end of oAPP.fn.fnWs20TreeSelectRow

    /************************************************************************
     * [PUBLIC] 모두펼치기 — 선택 라인 하위 전체 펼침.
     *   원본 expandTreeItem 은 TreeTable 인스턴스(getSelectedIndex/expand)에
     *   의존하므로, HTML5 단계에선 선택 노드 하위 전체를 사이드맵에 펼침으로
     *   세팅하여 동일 효과를 낸다. (선택 노드 없으면 전체 펼침)
     ************************************************************************/
    oAPP.fn.fnWs20TreeExpandSelected = function () {
        var oMap = _expandedMap();
        var sSel = _getSelectedObjid();

        function lf_expandAll(aNodes) {
            if (!Array.isArray(aNodes)) { return; }
            for (var i = 0; i < aNodes.length; i++) {
                var oN = aNodes[i];
                if (!oN) { continue; }
                if (_hasChild(oN)) {
                    oMap[oN.OBJID] = true;
                    lf_expandAll(oN.zTREE);
                }
            }
        }

        var aRoot = _getTreeRoot();
        if (sSel) {
            var oSel = _findNode(aRoot, sSel);
            if (oSel) {
                oMap[oSel.OBJID] = true;
                lf_expandAll(oSel.zTREE);
            } else {
                lf_expandAll(aRoot);
            }
        } else {
            lf_expandAll(aRoot);
        }
        oAPP.fn.fnRenderDesignTree();
    }; // end of fnWs20TreeExpandSelected

    /************************************************************************
     * [PUBLIC] 모두접기 — 선택 라인 접힘 (원본 collapse(selectedIndex)).
     *   선택 노드가 없으면 전체 접힘.
     ************************************************************************/
    oAPP.fn.fnWs20TreeCollapseSelected = function () {
        var oMap = _expandedMap();
        var sSel = _getSelectedObjid();

        if (sSel) {
            oMap[sSel] = false;
        } else {
            // 전체 접힘
            function lf_collapseAll(aNodes) {
                if (!Array.isArray(aNodes)) { return; }
                for (var i = 0; i < aNodes.length; i++) {
                    var oN = aNodes[i];
                    if (!oN) { continue; }
                    if (_hasChild(oN)) {
                        oMap[oN.OBJID] = false;
                        lf_collapseAll(oN.zTREE);
                    }
                }
            }
            lf_collapseAll(_getTreeRoot());
        }
        oAPP.fn.fnRenderDesignTree();
    }; // end of fnWs20TreeCollapseSelected

    /************************************************************************
     * [PUBLIC] 전체 접기 후 iLevel 레벨까지 펼침.
     *   원본(getAppData 566~570행): oLTree1.collapseAll() → expandToLevel(2).
     *   "접은뒤 펼쳐야 2레벨만 펼쳐짐" — HTML5 사이드맵을 전부 재구성:
     *   depth < iLevel 인 노드만 펼침(true), 그 외 접힘(false).
     *   (expandToLevel(2) = 0/1레벨 노드 펼침 → 2레벨 라인까지 노출)
     ************************************************************************/
    oAPP.fn.fnWs20TreeExpandToLevel = function (iLevel) {

        // 사이드맵 전체 재구성 (collapseAll 의미 포함)
        var oMap = oAPP.attr.ws20TreeExpanded = {};

        function lf_walk(aNodes, iDepth) {
            if (!Array.isArray(aNodes)) { return; }
            for (var i = 0; i < aNodes.length; i++) {
                var oN = aNodes[i];
                if (!oN) { continue; }
                if (_hasChild(oN)) {
                    oMap[oN.OBJID] = (iDepth < iLevel);
                    lf_walk(oN.zTREE, iDepth + 1);
                }
            }
        }

        lf_walk(_getTreeRoot(), 0);

        oAPP.fn.fnRenderDesignTree();

    }; // end of fnWs20TreeExpandToLevel

    /************************************************************************
     * /zTREE 에서 OBJID 로 노드 검색 (UI 전용 헬퍼).
     *   원본 getTreeData 와 동일 동작이나, 모델 미초기화 상황에서도 안전하도록
     *   별도 재귀 구현(원본 getTreeData 가 있으면 그걸 우선 사용).
     ************************************************************************/
    function _findNode(aNodes, sObjid) {
        if (typeof oAPP.fn.getTreeData === "function") {
            try {
                var oFound = oAPP.fn.getTreeData(sObjid);
                if (oFound) { return oFound; }
            } catch (e) { }
        }
        if (!Array.isArray(aNodes)) { return null; }
        for (var i = 0; i < aNodes.length; i++) {
            var oN = aNodes[i];
            if (!oN) { continue; }
            if (oN.OBJID === sObjid) { return oN; }
            if (Array.isArray(oN.zTREE)) {
                var oC = _findNode(oN.zTREE, sObjid);
                if (oC) { return oC; }
            }
        }
        return null;
    }

    /* ====================================================================
     * (C) [OVERRIDE] oAPP.fn.uiDesignArea
     *   원본(design/js/uiDesignArea.js 3행~): sap.ui.table.TreeTable 생성 후
     *   oLPage(좌측 페이지)에 addContent. → HTML5 에선 #ws20DesignTree 컨테이너에
     *   트리 툴바 + 재귀 트리를 렌더한다.
     *
     *   - 원본은 oLPage(sap.m.Page) 인자를 받지만, HTML5 셸에선 좌측 트리 컨테이너
     *     (#ws20DesignTree) 가 이미 ws_html5_ws20.js 셸에 존재하므로 인자 무시.
     *   - 트리 인스턴스 참조(oAPP.attr.ui.oLTree1)에 의존하는 원본 함수들이 많으므로,
     *     호환 더미 객체를 세팅하여 미변환 호출 시 크래시를 막는다.
     * ==================================================================== */
    oAPP.fn.uiDesignArea = function (oLPage) {

        // 트리 인스턴스 호환 더미 (원본 oAPP.attr.ui.oLTree1 사용처 크래시 방지).
        //  원본은 sap.ui.table.TreeTable. 여기선 HTML5 트리이므로, 자주 쓰이는
        //  메서드를 no-op/안전값으로 제공한다. (W3 범위: 실제 동작은 HTML5 함수가 담당)
        oAPP.attr.ui = oAPP.attr.ui || {};
        oAPP.attr.ui.oLTree1 = oAPP.attr.ui.oLTree1 || {
            __html5: true,
            getSelectedIndex: function () { return -1; },
            setSelectedIndex: function () { },
            getBinding: function () { return null; },
            getRows: function () { return []; },
            collapse: function () {
                try { oAPP.fn.fnWs20TreeCollapseSelected(); } catch (e) { }
            },
            expand: function () { },
            // 자주 호출되는 갱신 계열은 HTML5 재렌더로 연결
            getModel: function () { return oAPP.attr.oModel; }
        };

        // 모델 refresh 훅킹 — /zTREE 갱신 진입점 연계.
        //  원본 디자인 코드(designAddTreeData 결과 set / undoRedo / 체크박스 등)는 트리를
        //  갱신할 때마다 oAPP.attr.oModel.refresh() 를 호출(uiDesignArea.js·main.js 합산 16+회).
        //  원본 TreeTable 은 이 refresh 로 rows 바인딩이 재렌더됐다.
        //  HTML5 에선 refresh 를 래핑하여 매 호출마다 fnRenderDesignTree 가 함께 실행되게 한다.
        //  (비-UI 로직/데이터는 일절 변경하지 않고, "갱신 시 재렌더" 만 연계)
        oAPP.fn.fnHookWs20TreeModelRefresh();

        // 좌측 트리 컨테이너에 HTML5 트리 렌더
        try {
            oAPP.fn.fnRenderDesignTree();
        } catch (e) {
            console.warn("[HTML5][WS20][tree] uiDesignArea render error:", e && e.message);
        }

    }; // end of [OVERRIDE] oAPP.fn.uiDesignArea

    /************************************************************************
     * 디자인 모델 refresh 훅킹 (/zTREE 갱신 → HTML5 트리 재렌더 연계).
     *   원본 oAPP.attr.oModel(sap.ui.model.json.JSONModel).refresh() 호출부 전부를
     *   감싸서, 데이터 갱신 직후 fnRenderDesignTree 가 자동 실행되도록 한다.
     *   - 모델이 아직 생성되지 않았으면 no-op(이후 uiDesignArea 재진입 시 재시도).
     *   - 중복 훅킹 방지 플래그(__ws20TreeHooked).
     ************************************************************************/
    oAPP.fn.fnHookWs20TreeModelRefresh = function () {
        try {
            var oModel = oAPP.attr && oAPP.attr.oModel;
            if (!oModel || typeof oModel.refresh !== "function") { return; }
            if (oModel.__ws20TreeHooked === true) { return; }

            var fnOrigRefresh = oModel.refresh.bind(oModel);
            oModel.refresh = function () {
                var r = fnOrigRefresh.apply(oModel, arguments); // 원본 동작 보존
                try {
                    oAPP.fn.fnRenderDesignTree();
                } catch (e) {
                    console.warn("[HTML5][WS20][tree] refresh→render error:", e && e.message);
                }
                return r;
            };
            oModel.__ws20TreeHooked = true;
        } catch (e) {
            console.warn("[HTML5][WS20][tree] model refresh hook error:", e && e.message);
        }
    }; // end of fnHookWs20TreeModelRefresh

    /************************************************************************
     * [OVERRIDE] WS20 셸 렌더 (구 ws_html5_ws20.js fnRenderWs20Shell)
     * ---------------------------------------------------------------------
     *  W1 셸은 좌측 트리 패널(#ws20DesignTree)에 "UI 트리 — W3 예정" 라벨만 그렸다.
     *  W3 에선 셸 렌더(super) 직후, 좌측 트리 컨테이너에 HTML5 트리(툴바+재귀트리)를
     *  렌더하기 위해 oAPP.fn.uiDesignArea 를 호출하여 placeholder 를 대체한다.
     *
     *  - 셸 골격(툴바/3분할/리사이저) 생성은 super(W1) 그대로 위임.
     *  - 트리 데이터(/zTREE)는 로그인/앱 오픈 전엔 비어있으므로 빈 트리로 안전 렌더.
     ************************************************************************/
    var _fnRenderWs20Shell_super = oAPP.fn.fnRenderWs20Shell;

    oAPP.fn.fnRenderWs20Shell = function () {

        // W1 셸 골격 렌더 (툴바 + 3분할 + 좌측 트리 컨테이너 #ws20DesignTree)
        if (typeof _fnRenderWs20Shell_super === "function") {
            _fnRenderWs20Shell_super();
        }

        // 좌측 트리 컨테이너에 HTML5 UI 트리 렌더 (구 placeholder 대체)
        try {
            oAPP.fn.uiDesignArea(oAPP.attr.ui && oAPP.attr.ui.ws20 && oAPP.attr.ui.ws20.tree);
        } catch (e) {
            console.warn("[HTML5][WS20][tree] fnRenderWs20Shell→uiDesignArea error:", e && e.message);
        }

    }; // end of [OVERRIDE] oAPP.fn.fnRenderWs20Shell

})(window, (window.jQuery || window.$), oAPP);
