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
    // /U4A/MSG_WS 메시지(검색 안내 등 — 174 not found / 270 match count / 294 placeholder). p1=치환.
    function _msgWs2(sNum, p1) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum, p1 == null ? "" : String(p1));
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    // HTML escape (innerHTML 안전).
    function _esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // 언어 = 서버 메시지 클래스 단일 출처(원본 동일). 내부 영문 폴백 보관 금지(2026-06-16 지시).
    function _msg(sNum) {
        // 메시지 번호 없으면 조회 생략 — fnGetMsgClsText 가 "못 찾음" 으로 "클래스경로|번호"
        //   (예: /U4A/CL_WS_COMMON|) 를 반환해 라벨에 노출되는 버그 방지.
        if (sNum == null || sNum === "") { return ""; }
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    // ZMSG_WS_COMMON_001 메시지(312 = No data Found 등) — 속성 패널 _wsMsg 와 동일 소스.
    //   빈 트리/빈 속성 모두 같은 "데이터 없음" 텍스트를 같은 클래스에서 가져와 UX 통일.
    function _wsMsg(sNr) {
        try {
            var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
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
     * sap-icon URI → aggregation cardinality 아이콘(FontAwesome 7).
     *   원본 sap.ui.core.Icon(color-fill=0:1 / dimension=0:N) 대응 FA 아이콘.
     *   (구 ◇/◆ 유니코드 글리프 → FA 로 교체: 렌더 일관성/가독성)
     ************************************************************************/
    var _AGGR_ICON = {
        "sap-icon://color-fill": "fa-regular fa-square",   // 0:1 (단일) — 사각형 1개
        "sap-icon://dimension": "fa-regular fa-clone"      // 0:N (다중) — 겹친 사각형(원본과 동일)
    };
    function _aggrIconClass(sIcon) {
        if (!sIcon) { return ""; }
        return _AGGR_ICON[sIcon] || "fa-regular fa-clone";
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
        if (oCfg.disabled) { BTN.disabled = true; BTN.classList.add("is-disabled"); }
        if (oCfg.icon) { BTN.setAttribute("data-sap-icon", oCfg.icon); }
        if (oCfg.editOnly) { BTN.setAttribute("data-edit-only", "X"); }
        if (oCfg.uract) { BTN.setAttribute("data-uract", oCfg.uract); } // undo/redo 활성토글 마커

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

        function _wsMsg(sNr) {
            try {
                var s = parent.WSUTIL.getWsMsgClsTxt(_LANGU, "ZMSG_WS_COMMON_001", sNr);
                if (s && s.indexOf("|") === -1) { return s; }
            } catch (e) { }
            return sNr;
        }

        // 웹딘→U4A 변환 플러그인(U4A_CVT_WDR) 설치 서버 여부 (원본 uiDesignArea.js 888행).
        function _hasWdrPlugin() {
            try {
                var oUser = parent.getUserInfo && parent.getUserInfo();
                var aP = oUser && oUser.META && oUser.META.T_PLIST;
                return !!(aP && typeof aP.find === "function" && aP.find(function (x) { return x === "U4A_CVT_WDR"; }));
            } catch (e) { return false; }
        }

        var aBtns = [
            // B21 Expand — 선택 라인 하위 모두 펼침 (원본 expandTreeItem)
            //   아이콘=원본 sap-icon://expand-group(이중 쉐브론 ↓) 모양으로 복원(fa-angles-down).
            {
                icon: "sap-icon://expand-group", fa: "angles-down",
                tooltip: _msg("B21", "Expand"),
                press: function () { oAPP.fn.fnWs20TreeExpandSelected(); }
            },
            // B22 Collapse — 선택 라인 접힘 (원본 oLTree1.collapse(selectedIndex))
            //   아이콘=원본 sap-icon://collapse-group(이중 쉐브론 ↑) 모양으로 복원(fa-angles-up).
            {
                icon: "sap-icon://collapse-group", fa: "angles-up",
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
            //   아이콘=원본 sap-icon://responsive(모니터/디바이스) 모양으로 복원(fa-display).
            //   변환 때 wand-magic-sparkles(🪄)로 바뀌었던 것을 원복 — 마법사 wand 는 Activate 버튼으로 이동.
            {
                icon: "sap-icon://responsive", fa: "display", accept: true, editOnly: true,
                tooltip: _msg("B24", "UI Template Wizard"),
                // [임시] UI Template Wizard 미완 — 안내 토스트만(사용자 지시). TODO(i18n) + 재개 시 원본 복원.
                press: function () { try { parent.showMessage(null, 10, "I", "아직 작업중입니다"); } catch (e) { } /* _safeCall("designCallWizardPopup", []); */ }
            },
            // E28 UI Personalization List — HTML5 인앱 팝업(fnP13nDesignPopupOpen "R" 리스트) 지연 로드.
            {
                icon: "sap-icon://user-settings", fa: "user-gear",
                tooltip: _msg("E28"),
                press: function () {
                    var run = function () {
                        try { oAPP.fn.fnP13nDesignPopupOpen("R"); }
                        catch (e) { console.error("[HTML5][WS20] UI Personalization List:", e && e.message ? e.message : e); }
                    };
                    try { parent.setBusy && parent.setBusy("X"); } catch (e) { }
                    if (typeof oAPP.fn.fnP13nDesignPopupOpen === "function") { run(); }
                    else { try { oAPP.loadJs("fnP13nDesignPopupOpen", run); } catch (e) { console.error("[HTML5][WS20] p13n load:", e && e.message ? e.message : e); } }
                }
            },
            { sep: true },
            // 247 Undo (원본 undoRedo.executeHistory("UNDO")) [가드]
            {
                icon: "sap-icon://undo", gly: "↶", editOnly: true, uract: "UNDO",
                tooltip: _wsMsg("247"),
                press: function () { _execHistory("UNDO"); }
            },
            // 248 Redo (원본 undoRedo.executeHistory("REDO")) [가드]
            {
                icon: "sap-icon://redo", gly: "↷", editOnly: true, uract: "REDO",
                tooltip: _wsMsg("248"),
                press: function () { _execHistory("REDO"); }
            },
            { sep: true },
            // 469 Web Dynpro Conversion Log (원본 oLTBar1 detail-view 버튼 — 누락분 복원).
            //   U4A_CVT_WDR(웹딘→U4A 변환) 플러그인 설치 서버에서만 활성. 별도 Electron 팝업.
            {
                icon: "sap-icon://detail-view", fa: "rectangle-list",
                tooltip: _wsMsg("469"),
                disabled: !_hasWdrPlugin(),
                press: function () {
                    // [임시] Web Dynpro 변환 로그 미완 — 안내 토스트만(사용자 지시). TODO(i18n) + 재개 시 원본 복원.
                    try { parent.showMessage(null, 10, "I", "아직 작업중입니다"); } catch (e) { }
                    return;

                    // try {
                    //     var oSet = parent.getSettingsInfo();
                    //     var sPath = parent.PATH.join(oSet.path.POPUP_ROOT, "webDynConversionLog", "index.js");
                    //     parent.require(sPath)(parent.REMOTE, oAPP);
                    // } catch (e) {
                    //     console.error("[HTML5][WS20][tree] Web Dynpro Conversion Log 오픈 실패:", e);
                    // }
                }
            },
            { sep: true },
            // B39 Help (원본 도움말 팝업) [가드]
            {
                icon: "sap-icon://question-mark", gly: "?",
                tooltip: _msg("B39"),
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

        // 오버플로(⋯) — 폭이 모자라면 넘치는 트리 버튼을 드롭다운으로 접는다(구 OverflowToolbar).
        //   트리 툴바는 아이콘 버튼(u4a-btn-icon)이라 ⋯ 도 동일 모양으로, 구분선은 TreeTbSep 으로 판별.
        try {
            if (window.U4AUI && window.U4AUI.attachOverflow) {
                _treeTbOvf = window.U4AUI.attachOverflow(BAR, {
                    btnClass: "u4a-btn-icon",
                    btnHtml: '<span class="u4aWs20TreeTbIcon"><i class="fa-solid fa-ellipsis"></i></span>',
                    isSep: function (el) { return el.classList.contains("u4aWs20TreeTbSep"); },
                    // ⋯ 메뉴 항목 라벨은 공용 btnLabel 로 추출(아이콘 버튼이라 span 은 비어 title 폴백).
                    //   ★ title 만 보면 hover 후 _promote 가 title→data-tip 으로 옮겨 라벨이 비던 버그가
                    //     있어, btnLabel 이 title→data-tip→aria-label 순으로 폴백한다.
                    //   비활성(disabled) 버튼은 메뉴에서도 흐리게 + 클릭 무시.
                    menuItem: function (el) {
                        var oI = el.querySelector("i");
                        var sText = window.U4AUI.btnLabel(el, true);
                        var bDis = el.disabled === true || el.classList.contains("is-disabled");
                        return {
                            iconHtml: oI ? oI.outerHTML : "",
                            text: sText,
                            disabled: bDis,
                            onClick: function () { if (!bDis) { el.click(); } }
                        };
                    }
                });
            }
        } catch (e) { console.warn("[HTML5][WS20][tree] toolbar overflow attach 실패:", e && e.message); }

        return BAR;
    }

    // 트리 툴바 오버플로 컨트롤러 (fnRenderDesignTree 가 편집모드 토글 후 reflow 호출)
    var _treeTbOvf = null;

    // undo/redo 진입점 — HTML5 스냅샷 undo/redo(ws_html5_ws20_edit.js) 우선, 없으면 원본 require.
    function _execHistory(sMode) {
        try {
            if (oAPP.fn && typeof oAPP.fn.fnWs20ExecHistory === "function") {
                oAPP.fn.fnWs20ExecHistory(sMode);
                return;
            }
            var oUndoRedo = parent.require(oAPP.oDesign.pathInfo.undoRedo);
            if (oUndoRedo && typeof oUndoRedo.executeHistory === "function") {
                oUndoRedo.executeHistory(sMode);
                return;
            }
            console.warn("[HTML5][WS20][tree] undoRedo not available:", sMode);
        } catch (e) {
            console.warn("[HTML5][WS20][tree] executeHistory error:", sMode, e && e.message);
        }
    }

    /* ====================================================================
     * (B) 트리 렌더 — 공통 베이스 트리(U4AUI.createTree) 소비.
     *   ★ UX 통일: ServerList/USP 와 동일 코어 렌더러(재귀 마크업/토글/들여쓰기/hover/선택).
     *     WS20 부가기능(체크박스·아이콘·aggregation·+/삭제 액션·컨텍스트메뉴·상태 하이라이트)만
     *     createTree 훅(slotLead/slotTrailing/icon/onSelect/rowHook)으로 주입.
     *   ★ 펼침상태는 화면 소유 사이드맵(_expandedMap)이 단일 출처 → isExpanded/onToggle 로 위임
     *     (툴바 expand/collapse-selected 등 기존 펼침 로직 그대로 동작).
     * ==================================================================== */

    function _objKey(oNode) { return (oNode && oNode.OBJID != null) ? String(oNode.OBJID) : ""; }
    function _attrEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

    var _ws20tree = null;
    function _ensureWs20Tree() {
        if (_ws20tree) { return _ws20tree; }
        if (!(window.U4AUI && U4AUI.createTree)) { return null; }

        _ws20tree = U4AUI.createTree({
            // 대용량(수만 노드) 디자인 트리 대비 — flat+windowed 렌더(보이는 행만 DOM). 펼침맵은 화면 소유(isExpanded/onToggle).
            virtual: true,
            roots: _getTreeRoot,
            children: function (n) { return _hasChild(n) ? n.zTREE : []; },
            key: _objKey,
            hasChildren: _hasChild,
            label: function (n) { return _objKey(n); },
            tip: function (n) { return _objKey(n); },   // 행 data-tip(이름 .u4a-tree__label 말줄임 시)

            // UI 아이콘(UICON: raw OS 경로 .gif → file:// URL). icon_visible 일 때만.
            icon: function (n) {
                if (!(n && n.icon_visible === true && n.UICON)) { return ""; }
                var p = n.UICON;
                var src = /^(file:|https?:|data:|\/)/i.test(p) ? p : ("file:///" + String(p).replace(/\\/g, "/"));
                return '<img class="u4aWs20TreeIcon" src="' + _attrEsc(src) + '" alt="" onerror="this.style.display=\'none\'">';
            },

            // 펼침상태 위임 — 화면 사이드맵(_expandedMap)이 단일 출처.
            isExpanded: _isExpanded,
            onToggle: function (node, bOpen) {
                var oMap = _expandedMap();
                if (bOpen) { oMap[node.OBJID] = true; }
                else { _collapseSubtree(node, oMap); }   // 접기=자손까지(원본 동작)
            },

            // 체크박스(chk_visible/chk) — 토글↔아이콘 사이(lead 슬롯)
            slotLead: function (n) {
                if (n.chk_visible !== true) { return null; }
                var CHK = document.createElement("input");
                CHK.type = "checkbox";
                CHK.className = "u4aWs20TreeChk";
                CHK.checked = (n.chk === true);
                CHK.addEventListener("click", function (e) { e.stopPropagation(); });
                CHK.addEventListener("change", function (e) {
                    e.stopPropagation();
                    n.chk = CHK.checked;
                    _safeCall("designTreeSelChkbox", [n]);   // parent/child 연동(원본)
                    oAPP.fn.fnRenderDesignTree();
                });
                return CHK;
            },

            // 우측(aggregation 라벨 + 행 액션 +추가/삭제) — 항상 반환(액션 2슬롯 정렬 유지).
            slotTrailing: function (n) {
                var RIGHT = document.createElement("span");
                RIGHT.className = "u4aWs20TreeRowRight";

                if (n.UIATT) {
                    var AGGR = document.createElement("span");
                    AGGR.className = "u4aWs20TreeAggr";
                    var sAgiCls = _aggrIconClass(n.UIATT_ICON);
                    if (sAgiCls) {
                        var AGI = document.createElement("i");
                        AGI.className = "u4aWs20TreeAggrIcon " + sAgiCls;
                        AGGR.appendChild(AGI);
                    }
                    var AGT = document.createElement("span");
                    AGT.textContent = n.UIATT;
                    AGGR.appendChild(AGT);
                    RIGHT.appendChild(AGGR);
                }

                var ACT = document.createElement("span");
                ACT.className = "u4aWs20TreeActions";
                // 슬롯1: +(add)
                if (n.visible_add === true) {
                    var ADD = document.createElement("button");
                    ADD.type = "button"; ADD.className = "u4aWs20TreeActBtn add";
                    ADD.title = _msg("A54", "Insert Element");
                    ADD.innerHTML = '<i class="fa-solid fa-plus"></i>';
                    ADD.addEventListener("click", function (e) { e.stopPropagation(); _safeCall("designUIAdd", [n]); });
                    ACT.appendChild(ADD);
                } else {
                    var ADD0 = document.createElement("span"); ADD0.className = "u4aWs20TreeActSlot"; ACT.appendChild(ADD0);
                }
                // 슬롯2: 삭제
                if (n.visible_delete === true) {
                    var DEL = document.createElement("button");
                    DEL.type = "button"; DEL.className = "u4aWs20TreeActBtn del";
                    DEL.title = _msg("A03", "Delete");
                    DEL.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    DEL.addEventListener("click", function (e) { e.stopPropagation(); _safeCall("designUIDelete", [n]); });
                    ACT.appendChild(DEL);
                } else {
                    var DEL0 = document.createElement("span"); DEL0.className = "u4aWs20TreeActSlot"; ACT.appendChild(DEL0);
                }
                RIGHT.appendChild(ACT);
                return RIGHT;
            },

            // 행 클릭 → 선택 (원본 cellClick)
            onSelect: function (n) { oAPP.fn.fnWs20TreeSelectRow(n); },

            // WS20 확장 표식/동작 — 컨텍스트메뉴·선택강조·상태 하이라이트·식별자
            rowHook: function (oRow, n) {
                oRow.classList.add("u4aWs20TreeRow");
                var sObjid = _objKey(n);
                oRow.setAttribute("data-objid", sObjid);
                // 우클릭 컨텍스트 메뉴 (구 callDesignContextMenu)
                oRow.addEventListener("contextmenu", function (e) {
                    e.preventDefault(); e.stopPropagation();
                    _safeCall("setSelectTreeItem", [sObjid]);
                    if (oAPP.fn.fnWs20ShowTreeContextMenu) { oAPP.fn.fnWs20ShowTreeContextMenu(n, e.clientX, e.clientY); }
                });
                // 선택 하이라이트(공통 aria-selected) — WS20 선택표시는 _getSelectedObjid
                if (_getSelectedObjid() === sObjid) { oRow.setAttribute("aria-selected", "true"); }
                // 상태 highlight 컬러바(None/Indication02/04/08 + find 03/07)
                var sHi = n.highlight || "None";
                if (sHi && sHi !== "None") { oRow.classList.add("hl-" + sHi); }
                // 드래그&드롭 데코(draggable + 드롭가능/불가 표시) — ws_html5_ws20_dnd.js.
                try { if (typeof oAPP.fn.fnWs20DndDecorateRow === "function") { oAPP.fn.fnWs20DndDecorateRow(oRow, n); } } catch (e) { }
            }
        });
        _ws20tree.el.classList.add("u4aWs20Tree");
        return _ws20tree;
    }


    /************************************************************************
     * 펼침/접힘 토글 (UI 전용 사이드맵만 변경 → 재렌더).
     *   비-UI 로직(모델 노드/펼침 계산)은 변경하지 않음.
     ************************************************************************/
    // 노드 + 모든 자손의 펼침 상태를 접힘(false)으로 세팅 — 원본 UI5 collapse(자손 포함) 동작.
    //   (노드를 접으면 그 아래에서 펼쳐뒀던 자식들도 같이 접혀, 재펼침 시 접힌 채로 보이게)
    function _collapseSubtree(oNode, oMap) {
        if (!oNode) { return; }
        if (oNode.OBJID != null) { oMap[oNode.OBJID] = false; }
        if (Array.isArray(oNode.zTREE)) {
            for (var i = 0; i < oNode.zTREE.length; i++) { _collapseSubtree(oNode.zTREE[i], oMap); }
        }
    }


    /************************************************************************
     * 트리 툴바 오버플로(⋯) 폭 제약 — JS 주입으로 강제 적용.
     * ----------------------------------------------------------------------
     *  ★ 원인: 툴바(.u4aWs20TreeToolbar)는 flex-wrap:nowrap + 비축소 아이콘이라
     *    자기 콘텐츠 자연폭으로 늘어나 패널(overflow:hidden)을 넘어 "클리핑"만 되고,
     *    attachOverflow 는 툴바 clientWidth(=자연폭)로 측정해 "다 들어감"으로 오판→⋯ 미생성.
     *    해결은 툴바/랩에 min-width:0(교과서적 flexbox) 이지만, ws20.css 는 index.html 에서
     *    쿼리 없는 <link> 로 로드돼 Electron 캐시로 갱신이 늦다(외부 CSS). 그래서 이 규칙을
     *    #id 고특이도로 "JS 주입"(tree.js 는 매 로드 최신) 해 캐시와 무관하게 즉시 적용한다.
     ************************************************************************/
    function _ensureTreeToolbarWidthFix() {
        if (document.getElementById("ws20TreeToolbarWidthFix")) { return; }
        var oSt = document.createElement("style");
        oSt.id = "ws20TreeToolbarWidthFix";
        oSt.textContent =
            "#ws20DesignTree .u4aWs20TreeWrap{min-width:0;}" +
            "#ws20DesignTree .u4aWs20TreeToolbar{min-width:0;}";
        (document.head || document.documentElement).appendChild(oSt);
    }

    /************************************************************************
     * [PUBLIC] 수동 렌더 — 원본 TreeTable rows 바인딩(/zTREE) 대체.
     *   /zTREE 가 갱신되면(designAddTreeData/undoRedo 등 → 모델 set) 이 함수를
     *   호출하여 다시 그린다. 데이터가 비어있어도 안전하게 빈 트리 렌더.
     ************************************************************************/
    oAPP.fn.fnRenderDesignTree = function () {

        // 툴바 오버플로 폭 제약(캐시 무관 JS 주입) — 1회.
        _ensureTreeToolbarWidthFix();

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

        // 편집 전용 버튼 표시/숨김이 바뀌었으니 툴바 오버플로(⋯) 재계산
        try { if (_treeTbOvf) { _treeTbOvf.reflow(); } } catch (e) { }

        var oScrollArea = oWrap.querySelector(".u4aWs20TreeScroll");

        var aRoot = _getTreeRoot();

        // 데이터 없음 → 빈 트리(안내 라벨). 실제 데이터는 로그인 후 앱 오픈 시 채워짐.
        if (!aRoot || aRoot.length === 0) {
            oScrollArea.innerHTML = "";
            var EMPTY = document.createElement("div");
            EMPTY.className = "u4aWs20TreeEmpty";
            // 속성 패널과 동일한 "데이터 없음"(312) 안내 — 로그인/앱오픈 전 빈 패널이 텅 비어 보이지 않게.
            EMPTY.textContent = _wsMsg("312");
            oScrollArea.appendChild(EMPTY);
            try { if (oAPP.fn.fnWs20UpdateUndoBtns) { oAPP.fn.fnWs20UpdateUndoBtns(); } } catch (e) { }
            return;
        }

        // 공통 베이스 트리(U4AUI.createTree) 컨트롤러 — 1회 마운트 후 .render() 재사용.
        var oTree = _ensureWs20Tree();
        if (!oTree) { return; }
        if (oTree.el.parentNode !== oScrollArea) {
            oScrollArea.innerHTML = "";
            oScrollArea.appendChild(oTree.el);
        }
        oTree.render();

        // undo/redo 버튼 활성상태 동기화 (버튼이 매 렌더 재생성되므로)
        try { if (oAPP.fn.fnWs20UpdateUndoBtns) { oAPP.fn.fnWs20UpdateUndoBtns(); } } catch (e) { }

        // 툴바 폭 제약(주입 CSS)이 적용된 뒤 오버플로 재측정 강제 — 레이아웃 확정 후 rAF 로 reflow.
        //   (min-width:0 로 툴바가 패널폭으로 줄어든 상태에서 attachOverflow 가 다시 판정 → ⋯ 생성)
        try {
            if (_treeTbOvf && typeof _treeTbOvf.reflow === "function") {
                if (typeof requestAnimationFrame === "function") { requestAnimationFrame(function () { try { _treeTbOvf.reflow(); } catch (e) { } }); }
                else { _treeTbOvf.reflow(); }
            }
        } catch (e) { }

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
            // 선택 노드 + 그 자손까지 모두 접음(원본 동작 — 재펼침 시 자식들 접힌 채).
            var oSel = _findNode(_getTreeRoot(), sSel);
            if (oSel) { _collapseSubtree(oSel, oMap); }
            else { oMap[sSel] = false; }
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
     * [PUBLIC] Find UI — 디자인 트리 OBJID 검색 (구 callDesignTreeFindPopup)
     * ----------------------------------------------------------------------
     *  원본(design/js/callDesignTreeFindPopup.js): ResponsivePopover + 입력/검색(✓)/
     *  equal 체크/Direction Up 체크/↑↓ 버튼. zTREE 재귀로 OBJID 매치 수집 →
     *  매치 전체 highlight=Indication03, 현재=Indication07 + 해당 라인 스크롤 + 전체 펼침.
     *  position 순환(±1), 키워드/equal 변경 시 재수집. 비-UI 로직 1:1 이식.
     ************************************************************************/
    var _findState = { T_TREE: [], position: 0, keyword: "", equal: false };

    // 트리 전체 highlight 초기화(구 lf_designRemoveFilterUI).
    function _findClearHighlights() {
        function rec(oN) {
            if (!oN) { return; }
            oN.highlight = "None";
            if (Array.isArray(oN.zTREE)) { for (var i = 0; i < oN.zTREE.length; i++) { rec(oN.zTREE[i]); } }
        }
        var aRoot = _getTreeRoot();
        if (aRoot && aRoot[0]) { rec(aRoot[0]); }
    }

    // 검색조건 매치 수집(구 lf_designCollectFindOBJID) — 수집 중 모든 노드 highlight 초기화.
    function _findCollect() {
        _findState.T_TREE = [];
        var sKey = (_findState.keyword || "").toUpperCase();
        function rec(oN) {
            if (!oN) { return; }
            oN.highlight = "None";
            var sId = oN.OBJID || "";
            var bHit = _findState.equal ? (sId === sKey) : (sId.indexOf(sKey) !== -1);
            if (bHit) { _findState.T_TREE.push(oN); }
            if (Array.isArray(oN.zTREE)) { for (var i = 0; i < oN.zTREE.length; i++) { rec(oN.zTREE[i]); } }
        }
        var aRoot = _getTreeRoot();
        if (aRoot && aRoot[0]) { rec(aRoot[0]); }
    }

    // 전체 펼침(구 expandToLevel(huge)).
    function _findExpandAll() {
        var oMap = _expandedMap();
        function rec(aNodes) {
            if (!Array.isArray(aNodes)) { return; }
            for (var i = 0; i < aNodes.length; i++) { var n = aNodes[i]; if (n && _hasChild(n)) { oMap[n.OBJID] = true; rec(n.zTREE); } }
        }
        rec(_getTreeRoot());
    }

    function _findScrollTo(sObjid) {
        try {
            // 가상 트리: off-screen 행은 DOM 에 없으므로 평탄 인덱스로 스크롤+윈도우 렌더(공통 scrollToKey).
            if (_ws20tree && typeof _ws20tree.scrollToKey === "function") { _ws20tree.scrollToKey(sObjid); return; }
            var oRow = document.querySelector('#ws20DesignTree [data-objid="' + (sObjid || "").replace(/"/g, '\\"') + '"]');
            if (oRow && oRow.scrollIntoView) { oRow.scrollIntoView({ block: "center" }); }
        } catch (e) { }
    }

    // 검색 실행(구 lf_designFindOBJID). POS:+1/-1, bRefresh:키워드/equal 변경 시 재수집.
    function _findExec(POS, bRefresh, oMsgEl) {
        if (oMsgEl) { oMsgEl.textContent = ""; oMsgEl.className = "u4aWs20FindMsg"; }

        // 키워드 없으면 마킹 초기화 후 종료.
        if (_findState.keyword === "") { _findClearHighlights(); oAPP.fn.fnRenderDesignTree(); return; }

        if (bRefresh) { _findCollect(); }

        // 매치 없음 → 경고(174 Target object can not be found).
        if (_findState.T_TREE.length === 0) {
            if (oMsgEl) { oMsgEl.textContent = _msgWs2("174"); oMsgEl.className = "u4aWs20FindMsg is-warn"; }
            oAPP.fn.fnRenderDesignTree();
            return;
        }

        // position 이동(순환). 신규검색(refresh)이면 position 유지(0부터).
        if (!bRefresh) {
            _findState.position += POS;
            if (_findState.position >= _findState.T_TREE.length) { _findState.position = 0; }
            else if (_findState.position < 0) { _findState.position = _findState.T_TREE.length - 1; }
        }

        // 매치 전체 = Indication03, 현재 = Indication07.
        for (var i = 0; i < _findState.T_TREE.length; i++) { _findState.T_TREE[i].highlight = "Indication03"; }
        _findState.T_TREE[_findState.position].highlight = "Indication07";

        // 신규검색이면 전체 펼침.
        if (bRefresh) { _findExpandAll(); }

        // 결과 메시지는 매 Enter(신규검색·이동) 마다 표시한다 + 현재위치(현재/전체) 로 순환 피드백.
        //   (구: bRefresh 일 때만 표시 → 같은 키워드로 2번째 Enter 부터 메시지가 비워진 채 사라지던 문제)
        if (oMsgEl) {
            // 270 Match results : &1
            oMsgEl.textContent = _msgWs2("270", _findState.T_TREE.length) +
                " (" + (_findState.position + 1) + "/" + _findState.T_TREE.length + ")";
            oMsgEl.className = "u4aWs20FindMsg is-ok";
        }

        oAPP.fn.fnRenderDesignTree();
        _findScrollTo(_findState.T_TREE[_findState.position].OBJID);
    }

    // 검색조건 변경 여부(구 lf_isRefresh) — 키워드/equal 바뀌면 재수집 대상.
    function _findIsRefresh(sVal, bEqual) {
        if (_findState.keyword !== sVal || _findState.equal !== bEqual) {
            _findState.keyword = sVal;
            _findState.equal = bEqual;
            _findState.T_TREE = [];
            _findState.position = 0;
            return true;
        }
        return false;
    }

    // Find UI — 트리 패널 상단 "도킹 find-bar"(구: body 부유 popover → 트리에 소속).
    //   트리거(🔍)·검색대상(트리)과 같은 패널에 바가 붙어 연결이 분명하고, 트리/하이라이트를
    //   가리지 않는다(툴바와 스크롤영역 사이에 끼워 트리 내용은 그만큼 아래로 밀림).
    oAPP.fn.callDesignTreeFindPopup = function () {

        // 토글: 이미 열려 있으면 닫는다(하이라이트 정리 + esc 리스너 해제).
        var oOld = document.getElementById("ws20FindPop");
        if (oOld) {
            try { document.removeEventListener("keydown", oOld.__onEsc, true); } catch (e) { }
            _findClearHighlights();
            try { oAPP.fn.fnRenderDesignTree(); } catch (e) { }
            try { oOld.remove(); } catch (e) { }
            return;
        }

        // 도킹 대상: 트리 wrap(툴바+스크롤) 의 스크롤영역 "앞"에 바를 끼운다.
        var oTreePane = document.getElementById("ws20DesignTree");
        var oWrap = oTreePane && oTreePane.querySelector(".u4aWs20TreeWrap");
        var oScroll = oWrap && oWrap.querySelector(".u4aWs20TreeScroll");
        if (!oWrap || !oScroll) { return; } // 트리 미렌더 시 무시

        _findState = { T_TREE: [], position: 0, keyword: "", equal: false };

        var POP = document.createElement("div");
        POP.id = "ws20FindPop";
        POP.className = "u4aWs20FindPop u4aWs20FindBar";
        POP.innerHTML =
            '<div class="u4aWs20FindHd"><i class="fa-solid fa-magnifying-glass"></i><span>' + _esc(_msg("A70")) + '</span>' +
            '<button type="button" class="u4a-btn-icon u4aWs20FindX" title="' + _esc(_msg("A39")) + '"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="u4aWs20FindBody">' +
            '  <div class="u4aWs20FindRow1">' +
            // 입력 — 전 화면 공통 컴포넌트(.u4a-field + .u4a-field__clear). clear(X)는 값 있을 때만 노출.
            '    <div class="u4a-field u4aWs20FindField" data-trail="1">' +
            '      <input type="text" class="u4a-input u4a-field__input u4aWs20FindInp" placeholder="' + _esc(_msgWs2("294")) + '">' +
            '      <button type="button" class="u4a-field__clear" title="Clear" aria-label="Clear" tabindex="-1"><i class="fa-solid fa-xmark"></i></button>' +
            '    </div>' +
            '    <button type="button" class="u4a-btn u4a-btn--emphasized u4aWs20FindGo" title="' + _esc(_msg("A68")) + '"><i class="fa-solid fa-check"></i></button>' +
            '  </div>' +
            '  <div class="u4aWs20FindRow2">' +
            '    <label class="u4aWs20FindChk"><input type="checkbox" class="u4aWs20FindEqual"> ' + _esc(_msg("A71")) + '</label>' +
            '    <label class="u4aWs20FindChk"><input type="checkbox" class="u4aWs20FindDir"> ' + _esc(_msg("A72")) + '</label>' +
            '    <span class="u4aWs20FindSpacer"></span>' +
            '    <button type="button" class="u4a-btn-icon u4aWs20FindUp" title="' + _esc(_msg("A55")) + '"><i class="fa-solid fa-arrow-up"></i></button>' +
            '    <button type="button" class="u4a-btn-icon u4aWs20FindDown" title="' + _esc(_msg("A56")) + '"><i class="fa-solid fa-arrow-down"></i></button>' +
            '  </div>' +
            '  <div class="u4aWs20FindMsg"></div>' +
            '</div>';

        var oInp = POP.querySelector(".u4aWs20FindInp");
        var oEqual = POP.querySelector(".u4aWs20FindEqual");
        var oDir = POP.querySelector(".u4aWs20FindDir");
        var oMsgEl = POP.querySelector(".u4aWs20FindMsg");
        function _dirPos() { return oDir.checked ? -1 : 1; }
        function _refresh() { return _findIsRefresh(oInp.value, oEqual.checked); }

        // 닫기 — 도킹 바라서 외부 클릭으로는 안 닫는다(find-bar UX). X 버튼·Esc·🔍 토글로만 닫힘.
        function _close() {
            try { document.removeEventListener("keydown", _onEsc, true); } catch (e) { }
            _findClearHighlights();
            try { oAPP.fn.fnRenderDesignTree(); } catch (e) { }
            try { POP.remove(); } catch (e) { }
        }
        function _onEsc(ev) { if (ev.key === "Escape") { ev.stopPropagation(); _close(); } }
        POP.__onEsc = _onEsc; // 토글 닫기에서 리스너 해제용

        POP.querySelector(".u4aWs20FindX").addEventListener("click", _close);
        POP.querySelector(".u4aWs20FindGo").addEventListener("click", function () { _findExec(_dirPos(), _refresh(), oMsgEl); oInp.focus(); });
        POP.querySelector(".u4aWs20FindUp").addEventListener("click", function () { _findExec(-1, _refresh(), oMsgEl); oInp.focus(); });
        POP.querySelector(".u4aWs20FindDown").addEventListener("click", function () { _findExec(1, _refresh(), oMsgEl); oInp.focus(); });
        oEqual.addEventListener("change", function () { oInp.focus(); });
        oDir.addEventListener("change", function () { oInp.focus(); });
        oInp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); _findExec(_dirPos(), _refresh(), oMsgEl); }
            else if (e.key === "ArrowUp") { e.preventDefault(); if (oInp.value !== "") { _findExec(-1, _refresh(), oMsgEl); } }
            else if (e.key === "ArrowDown") { e.preventDefault(); if (oInp.value !== "") { _findExec(1, _refresh(), oMsgEl); } }
        });

        // clear(X) — 전 화면 공통 컴포넌트(U4AUI.attachClear). 비우면 검색 하이라이트도 해제(키워드 "").
        var oFindClr = POP.querySelector(".u4aWs20FindField .u4a-field__clear");
        if (window.U4AUI && typeof window.U4AUI.attachClear === "function") {
            window.U4AUI.attachClear(oInp, oFindClr, function () { _findExec(_dirPos(), _refresh(), oMsgEl); });
        }

        // 트리 툴바와 스크롤영역 "사이"에 끼운다(도킹). 트리 재렌더(_findExec)는 스크롤영역만
        //   비우므로(.u4aWs20TreeScroll), 그 앞에 둔 이 바는 검색 중에도 그대로 유지된다.
        oWrap.insertBefore(POP, oScroll);

        document.addEventListener("keydown", _onEsc, true);
        try { oInp.focus(); } catch (e) { }

    }; // end of callDesignTreeFindPopup

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
