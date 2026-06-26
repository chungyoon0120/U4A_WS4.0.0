/************************************************************************
 * ws_html5_ws20.js  (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모 — W1 단계: WS20 "셸"만]
 *  WS20 비주얼 편집화면의 "셸"(상단 트랜잭션 툴바 + 3분할 레이아웃 골격)을
 *  SAP UI5(sap.tnt.ToolHeader / sap.m.OverflowToolbar / sap.ui.layout.Splitter)
 *  → 순수 HTML5(DOM + flex + CSS + 바닐라 JS) 로 재구현한다.
 *
 *  - 본 파일은 library-preload.js 의 로드 목록에서 ws_html5_shell.js "보다 뒤"
 *    (가장 마지막) 에 위치하여, shell 의 fnOnMoveToPage("WS20") placeholder 분기를
 *    override 로 교체한다. (원본 UI5 파일은 수정하지 않음)
 *
 *  - 이번 단계(W1)는 "골격"만 만든다:
 *      · 상단 트랜잭션 툴바: Display/Change, SyntaxCheck, Activate, Save, MIME,
 *        Controller, App Exec, Multi Preview, Icon List, Add Event,
 *        Runtime, Binding Popup 등 (원본 fnGetSubHeaderToolbarContentWs20 순서/툴팁 충실 재현)
 *      · 3분할: 좌(UI 트리 25%) / 중(미리보기) / 우(속성 30%) — flex 기반, 드래그 리사이즈 가능
 *      · 각 패널 내부는 빈 컨테이너 + 라벨("UI 트리 — W3 예정" 등). 실제 내용은 다음 단계.
 *
 *  - 데이터 바인딩(visible/enabled/text)은 모두 "정적"으로 처리한다.
 *    원본은 /WS20/APP/IS_EDIT, S_APP_VMS, /USERINFO/... 모델 바인딩에 의존하지만,
 *    실제 서버 로그인 없이도 셸이 보이도록 모든 버튼을 일단 노출시키고 [정적] 주석으로 표기.
 *
 *  - 트랜잭션 버튼 핸들러는 원본 ev_press*(UI5 의존, 다음 단계 변환)에 연결하되,
 *    호출은 try/catch 가드로 감싼다. (현재 클릭 시 크래시 방지)
 *
 *  - 비-UI 로직(Node/IPC/파일IO/서버 진입 흐름 fnOnEnterDispChangeMode→fnOnMoveToPage)은
 *    추측으로 변경하지 않는다. 본 파일은 오직 "WS20 컨테이너에 셸을 그리는 렌더"만 담당.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    // FontAwesome 7.2.0 solid/brands (다른 화면과 동일 — ws10_html.js ICON 규칙)
    function _fa(sName, bBrand) {
        return '<i class="' + (bBrand ? "fa-brands" : "fa-solid") + ' fa-' + sName + '"></i>';
    }

    // HTML escape (innerHTML 에 메시지 텍스트 삽입 시 안전) — 모듈 공용.
    function _esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /************************************************************************
     * WS20 윈도우 메뉴 데이터 (구 fnGetWindowMenuListWS20 / fnGetWindowMenuWS20 미러)
     *   sap-icon → FontAwesome 매핑. ws10_html.js 의 공유 buildMenubar 가 소비.
     ************************************************************************/
    function _getWindowMenuWS20() {
        return [
            { key: "WMENU10", text: _msg("B37"), items: [
                { key: "WMENU10_01", icon: "palette", text: _msg("B56"), disabled: true },
                { key: "WMENU10_02", icon: "bold", text: _msg("B57") },
                { key: "WMENU10_03", icon: "pen-ruler", text: _msg("B58") }
            ] },
            { key: "WMENU20", text: _msg("B35"), items: [
                { key: "WMENU20_01", icon: "globe", text: _msg("B49") },
                { key: "WMENU20_02", icon: "language", text: _msg("B59") },
                { key: "WMENU20_03", icon: "video", text: _wsMsg("808") },
                { key: "WMENU20_05", icon: "code", text: _wsMsg("059") },
                { key: "WMENU20_04", icon: "icons", text: _wsMsg("068"), items: [
                    { key: "WMENU20_04_01", icon: "icons", text: _wsMsg("047") },
                    { key: "WMENU20_04_02", icon: "image", text: _wsMsg("067") }
                ] },
                { key: "WMENU20_06", icon: "code-branch", text: _wsMsg("403") }
            ] },
            { key: "WMENU30", text: _msg("B38"), items: [
                { key: "WMENU30_01", icon: "css3-alt", brand: true, text: _msg("B60") },
                { key: "WMENU30_02", icon: "js", brand: true, text: _msg("B61") },
                { key: "WMENU30_03", icon: "html5", brand: true, text: _msg("B62") },
                { key: "WMENU30_04", icon: "file-lines", text: _msg("B63") },
                { key: "WMENU30_05", icon: "sliders", text: _msg("B64") }
            ] },
            { key: "WMENU40", text: _msg("B36"), items: [
                { key: "WMENU40_01", icon: "plus", text: _msg("A09") },
                { key: "WMENU40_02", icon: "xmark", text: _msg("B51") },
                { key: "WMENU40_03", icon: "gear", text: _msg("B52") },
                { key: "WMENU40_04", icon: "right-from-bracket", text: _msg("B53") },
                { key: "WMENU40_06", icon: "user-gear", text: _msg("B55"), items: [
                    { key: "WMENU40_06_01", icon: "bug", text: _wsMsg("252") },
                    { key: "WMENU40_06_02", icon: "note-sticky", text: _msg("B54") },
                    { key: "WMENU40_06_03", icon: "triangle-exclamation", text: _msg("B70") }
                ] },
                { key: "WMENU40_07", icon: "server", text: _msg("C42") }
            ] },
            { key: "WMENU50", text: _msg("B39"), items: [
                { key: "WMENU50_01", icon: "book-open-reader", text: _msg("B44") },
                { key: "WMENU50_03", icon: "book", text: _msg("B65") },
                { key: "WMENU50_04", icon: "keyboard", text: _wsMsg("253") }
            ] },
            { key: "Test20", text: _msg("B69"), staffOnly: true, items: [
                { key: "Test90", text: "Busy 강제실행" },
                { key: "Test99", text: "Busy 강제종료" },
                { key: "Test98", text: "세션 끊기" },
                { key: "Test97", text: "개발툴" },
                { key: "Test95", text: "CTS Popup" },
                { key: "Test91", text: "Prop Help" },
                { key: "Test96", text: "스크립트 오류" },
                { key: "Test94", text: "sample script download" },
                { key: "Test87", text: "AI 연결 테스트" }
            ] }
        ];
    }

    // WS20 메뉴 항목 선택 → 실제 핸들러 oAPP.fn.fnWS20{key} (fnHmws.js) 위임
    function _ws20MenuSelect(it) {
        var fn = oAPP.fn["fnWS20" + it.key];
        if (typeof fn === "function") {
            try { fn(); } catch (e) { console.warn("[HTML5][WS20] menu " + it.key + " error:", e && e.message); }
            return;
        }
        console.warn("[HTML5][WS20] menu not implemented:", it.key);
    }

    /************************************************************************
     * 라벨 메시지 — 언어는 "서버 메시지 클래스 단일 출처"에서만 가져온다.
     *   (★ 사용자 지시 2026-06-16: 언어작업을 내부 영문 사전/폴백으로 따로 관리 금지.
     *    원본과 동일하게 메시지 시스템만 사용)
     *   · _msg(코드)   : /U4A/CL_WS_COMMON (A05/B57/C42 …). 원본 fnGetMsgClsText 동일.
     *   · _wsMsg(번호) : ZMSG_WS_COMMON_001 (808/059/068 …). 원본 oAPP.msg.M0xx / getWsMsgClsTxt 동일.
     *   미조회 시 코드/번호 자체 반환(영문 번역 미보관 — 정상 로그인 흐름에선 항상 조회됨).
     ************************************************************************/
    function _msg(sNum) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    // ZMSG_WS_COMMON_001 메시지(Workspace 언어) — /U4A/CL_WS_COMMON 에 없는 항목용(예: Screen Recording=808).
    function _wsMsg(sNr) {
        try {
            var lg = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(lg, "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }

    /************************************************************************
     * 트랜잭션 버튼 1개 생성 (구 sap.m.Button)
     *   oCfg: { id, icon, text, tooltip, ev, gly }
     *     - icon  : 참고용(원본 sap-icon URI). DOM 에는 gly(유니코드 글리프)로 표기.
     *     - ev    : oAPP.events 에 연결할 핸들러명(없으면 미연결). 호출은 try/catch 가드.
     *     - reject: 위험(거부) 스타일 여부
     ************************************************************************/
    function _txBtn(oCfg) {

        // [공통 UX] WS10 서브헤더와 동일한 공통 컴포넌트(shell/ws10.css .u4a-tx-btn) 사용.
        var BTN = document.createElement("button");
        BTN.type = "button";
        BTN.id = oCfg.id;
        BTN.className = "u4a-tx-btn" + (oCfg.reject ? " u4a-tx-btn--reject" : "");
        BTN.title = oCfg.tooltip || oCfg.text || "";

        // 아이콘(FA) + 텍스트(있을 때만) — WS10 _renderSubHeader 와 동일 마크업
        BTN.innerHTML = (oCfg.fa ? _fa(oCfg.fa, oCfg.brand) : "")
            + (oCfg.text ? "<span>" + oCfg.text + "</span>" : "");

        // 핸들러 연결 (원본 ev_press* — UI5 의존, 다음 단계 변환 → try/catch 가드)
        if (oCfg.ev) {
            BTN.setAttribute("data-ev", oCfg.ev);
            BTN.addEventListener("click", function () {
                var fn = oAPP.events && oAPP.events[oCfg.ev];
                if (typeof fn !== "function") {
                    console.warn("[HTML5][WS20] transaction action not implemented:", oCfg.ev);
                    return;
                }
                try {
                    // 원본은 oEvent 인자를 받는 핸들러도 있으나, 셸 단계에선 인자 없이 호출(가드)
                    fn();
                } catch (e) {
                    console.error("[HTML5][WS20] transaction action error:", oCfg.ev, e);
                }
            });
        }

        return BTN;

    } // end of _txBtn

    function _sep(sId) {
        var S = document.createElement("span");
        S.className = "u4a-tx-sep"; // 공통 구분선
        if (sId) { S.id = sId; }
        return S;
    }

    /************************************************************************
     * Application Execution Split 버튼 (구 sap.m.MenuButton buttonMode:"Split")
     * ----------------------------------------------------------------------
     * 원본(ws_fn_01.js ws20_appExecMenuBtn):
     *   · defaultAction        → ev_pressAppExecBtn (선택/기본 브라우저로 실행)
     *   · beforeMenuOpen       → fnBrowserStateModelRefresh (설치 상태 갱신)
     *   · 메뉴 항목(/DEFBR)     → 브라우저별(Chrome/Edge/U4A Developer) 직접 실행
     *   · DEV_BROWSER          → 패키징(운영) 환경이면 비활성
     * 공통 컴포넌트: shell/ws10.css 의 .u4a-split + ws10_html.js 의 .u4a-menu 재사용.
     ************************************************************************/

    // NAME → FontAwesome 아이콘 매핑 (원본 sap-icon://u4a-fw-brands/* 대체)
    var APP_EXEC_BROWSER_ICON = {
        CHROME:      { icon: "chrome", brand: true },
        MSEDGE:      { icon: "edge",   brand: true },
        DEV_BROWSER: { icon: "flask",  brand: false }  // U4A Developer Browser
    };

    // /DEFBR 모델 → 드롭다운 메뉴 항목 (원본 MENUITEM1 enabled/icon formatter 이식)
    function _buildAppExecMenuItems() {
        var aDefBr = [];
        try { aDefBr = APPCOMMON.fnGetModelProperty("/DEFBR") || []; } catch (e) { }
        if (!Array.isArray(aDefBr)) { aDefBr = []; }

        // 패키징(운영) 환경 여부 — DEV_BROWSER 차단 판정용
        var bPackaged = false;
        try { bPackaged = !!(parent.APP && parent.APP.isPackaged); } catch (e) { }

        return aDefBr.map(function (oBr) {
            var sName = oBr.NAME;

            // 원본 enabled formatter: 이름 없거나 명시적 비활성이면 비활성
            var bEnabled = !(!sName || oBr.ENABLED === false);
            // 개발 브라우저는 패키징(운영) 환경에서 차단
            if (sName === "DEV_BROWSER" && bPackaged) { bEnabled = false; }

            var oIco = APP_EXEC_BROWSER_ICON[sName] || {};
            return {
                key: sName,
                text: oBr.DESC || sName,    // "Google Chrome Browser" 등
                icon: oIco.icon,
                brand: oIco.brand,
                disabled: !bEnabled
            };
        });
    }

    // (구 _openAppExecMenu 제거 — 공통 buildSplitButton 에 흡수)

    // Split 버튼 — 공통 빌더(oAPP.ws10html.buildSplitButton)에 위임.
    //   정렬(버튼 좌측)·열때만 busy·토글닫기·data-menu-anchor 는 빌더가 강제(WS10/WS20 단일 소스).
    function _txSplitBtn(oCfg) {
        if (!(oAPP.ws10html && typeof oAPP.ws10html.buildSplitButton === "function")) {
            console.error("[HTML5][WS20] buildSplitButton 미연결 — ws10_html 로드 순서 확인");
            return document.createElement("span");
        }
        return oAPP.ws10html.buildSplitButton({
            id: oCfg.id, icon: oCfg.fa, brand: oCfg.brand, text: oCfg.text, tooltip: oCfg.tooltip,
            onMain: function () {                                       // 본체 = 기본 실행(ev_pressAppExecBtn)
                var fn = oAPP.events && oAPP.events[oCfg.ev];
                if (typeof fn !== "function") { console.warn("[HTML5][WS20] transaction action not implemented:", oCfg.ev); return; }
                try { fn(); } catch (e) { console.error("[HTML5][WS20] transaction action error:", oCfg.ev, e); }
            },
            getItems: _buildAppExecMenuItems,                           // 동적 /DEFBR 목록
            onPick: function (it) {                                     // 선택 브라우저로 실행
                var fn = oAPP.events && oAPP.events.ev_pressAppExecBtnByBrowser;
                if (typeof fn === "function") { try { fn(it.key); } catch (e) { console.error("[HTML5][WS20] App 실행(브라우저) 오류:", it.key, e); } }
            },
            prepare: (typeof oAPP.fn.fnBrowserStateModelRefresh === "function") ? oAPP.fn.fnBrowserStateModelRefresh : null
        });
    } // end of _txSplitBtn

    /************************************************************************
     * Icon Viewer / Icon List 툴바 엔트리 (원본 ws_fn_01 fnGetSubHeaderToolbarContentWs20
     *   의 oIconList 분기 그대로 이식):
     *     checkWLOList("C","UHAK900630") 참 → "Icon Viewer" 드롭다운 메뉴버튼
     *        · Icon List (047)  → fnWS20WMENU20_04_01 (fnIconPreviewPopupOpener)
     *        · Image Icons(067) → fnWS20WMENU20_04_02 (fnIllustedMsgPrevPopupOpener)
     *     거짓 → 평평한 "Icon List" 버튼(A12) → ev_pressIconListBtn (fnIconListPopupOpener)
     ************************************************************************/
    function _iconToolEntry() {
        var bIconViewer = false;
        try { bIconViewer = APPCOMMON.checkWLOList("C", "UHAK900630"); } catch (e) { }
        if (!bIconViewer) {
            return { id: "iconListBtn", fa: "icons", text: _msg("A12"), tooltip: _msg("A12") + " (Ctrl+Shift+F10)", ev: "ev_pressIconListBtn" };
        }
        return {
            id: "iconViewerBtn", menuBtn: true, fa: "icons",
            text: _wsMsg("068"), tooltip: _wsMsg("068"),                       // Icon Viewer
            items: [
                { key: "WMENU20_04_01", icon: "icons", text: _wsMsg("047"), tooltip: _wsMsg("047") + " (Ctrl+Shift+F10)" },  // Icon List
                { key: "WMENU20_04_02", icon: "image", text: _wsMsg("067"), tooltip: _wsMsg("067") }                          // Image Icons
            ],
            onPick: function (it) {
                var fn = oAPP.fn["fnWS20" + it.key];
                if (typeof fn === "function") { try { fn(); } catch (e) { console.error("[HTML5][WS20] icon menu " + it.key + " error:", e); } }
                else { console.warn("[HTML5][WS20] icon menu not implemented:", it.key); }
            }
        };
    }

    // 드롭다운 메뉴버튼 — 공통 빌더(oAPP.ws10html.buildMenuButton)에 위임(_txSplitBtn 와 동형).
    function _txMenuBtn(oCfg) {
        if (!(oAPP.ws10html && typeof oAPP.ws10html.buildMenuButton === "function")) {
            console.error("[HTML5][WS20] buildMenuButton 미연결 — ws10_html 로드 순서 확인");
            return _txBtn(oCfg);   // 폴백: 평범한 버튼(드롭다운 없음)
        }
        return oAPP.ws10html.buildMenuButton({
            id: oCfg.id, icon: oCfg.fa, brand: oCfg.brand, text: oCfg.text, tooltip: oCfg.tooltip,
            getItems: function () { return oCfg.items || []; },
            onPick: oCfg.onPick
        });
    } // end of _txMenuBtn

    /************************************************************************
     * WS20 플로팅 푸터 메시지 (구 sap.m.OverflowToolbar floatingFooter /FMSG/WS20)
     *   공통 푸터 컴포넌트(U4AUI.footer*, shell.css .u4a-footer) 소비. Change 모드 lock/저장/
     *   활성화 등 WS20 메시지를 페이지 하단에 표시. (기존 소스의 푸터 메시지 로직)
     ************************************************************************/
    //  공통 푸터 컴포넌트(U4AUI.footer*, shell.css .u4a-footer) 소비 — 닫기(X)/자동숨김 내장, 화면별 복제 없음.
    function _buildWs20Footer() {
        var T = document.createElement("div");
        T.innerHTML = window.U4AUI.footerMarkup("ws20Footer");
        return T.firstChild;
    }

    oAPP.ws20html = oAPP.ws20html || {};
    oAPP.ws20html.showFooter = function (sType, sMsg) {
        if (window.U4AUI) { window.U4AUI.footerShow("ws20Footer", sType || "I", sMsg || ""); }
    };
    oAPP.ws20html.hideFooter = function () {
        if (window.U4AUI) { window.U4AUI.footerHide("ws20Footer"); }
    };

    /************************************************************************
     * (A) WS20 상단 트랜잭션 툴바
     *   구: oAPP.fn.fnGetSubHeaderToolbarContentWs20() (sap.m.OverflowToolbar content)
     *   원본 버튼 순서/아이콘/텍스트/툴팁을 최대한 충실히 재현.
     *   버튼은 모두 생성하되, 모드별 표시/숨김은 fnUpdateWs20Toolbar 가
     *   원본 visible 바인딩 규칙대로 갱신한다(IS_EDIT/S_APP_VMS/IS_DEV 등).
     ************************************************************************/
    function _buildWs20Toolbar() {

        // [공통 UX] WS10 서브헤더와 동일한 컨테이너(.u4a-ws10__subheader) 그대로 사용.
        var BAR = document.createElement("div");
        BAR.id = "ws20TxToolbar";
        BAR.className = "u4a-ws10__subheader";

        // 툴팁 보조 문자열 (원본 sDispChgTxt)
        var sDispChgTxt = _msg("A05") + " <--> " + _msg("A02") + " (Ctrl+F1)";

        /* 원본 fnGetSubHeaderToolbarContentWs20 return 배열 순서 그대로:
         *   oDisplayModeBtn, oChangeModeBtn, [Separator],
         *   oSyntaxCheckBtn, oActivateBtn, oSaveBtn, oMimeBtn, oControllerBtn,
         *   oAppExecBtn(원본 visible:false), oAppExecMenuBtn, oMobileBtn,
         *   oIconList, oAddEventBtn, oRuntimeBtn, oBindPopupBtn
         *
         * 원본은 IS_EDIT(표시/변경 모드)에 따라 displayModeBtn/changeModeBtn 중
         * 하나만 보인다 → fnUpdateWs20Toolbar 가 동일하게 토글한다.
         */
        var aBtns = [
            // Display 모드 버튼 (원본 displayModeBtn: icon display)
            { id: "displayModeBtn", fa: "display", text: "", tooltip: sDispChgTxt, ev: "ev_pressDisplayModeBtn" },
            // Change 모드 버튼 (원본 changeModeBtn: icon edit)
            { id: "changeModeBtn", fa: "pen-to-square", text: "", tooltip: sDispChgTxt, ev: "ev_pressDisplayModeBtn" },
            // dev/admin 구분선 (원본 ToolbarSeparator: IS_DEV=="D" && !admin-block 일 때만 노출)
            { sep: true, sepId: "ws20DevSep" },
            // Syntax Check (원본 syntaxCheckBtn: icon validate, B72 + Ctrl+F2)
            { id: "syntaxCheckBtn", fa: "check-double", text: "", tooltip: _msg("B72") + " (Ctrl+F2)", ev: "ev_pressSyntaxCheckBtn" },
            // Activate (원본 activateBtn: icon activate, B73 + Ctrl+F3)
            //   아이콘=마법사(wand-magic-sparkles) — 사용자 요청(액티브 버튼을 마법사 아이콘으로).
            { id: "activateBtn", fa: "wand-magic-sparkles", text: "", tooltip: _msg("B73") + " (Ctrl+F3)", ev: "ev_pressActivateBtn" },
            // Save (원본 saveBtn: icon save, A64 + Ctrl+S)
            { id: "saveBtn", fa: "floppy-disk", text: "", tooltip: _msg("A64") + " (Ctrl+S)", ev: "ev_pressSaveBtn" },
            { sep: true, sepId: "ws20ActionSep" },
            // MIME Repository (원본 mimeBtn: icon picture, text A10)
            { id: "mimeBtn", fa: "image", text: _msg("A10"), tooltip: _msg("A10") + " (Ctrl+Shift+F12)", ev: "ev_pressMimeBtn" },
            // Controller (Class Builder) (원본 controllerBtn: icon developer-settings, text A11)
            { id: "controllerBtn", fa: "screwdriver-wrench", text: _msg("A11"), tooltip: _msg("C38") + " (Ctrl+F12)", ev: "ev_pressControllerBtn" },
            // Application Execution 메뉴 버튼 (원본 ws20_appExecMenuBtn: split MenuButton, text A06)
            //   split:true → 본체=기본 실행(ev_pressAppExecBtn) + 화살표=브라우저 선택 메뉴(/DEFBR)
            { id: "ws20_appExecMenuBtn", split: true, fa: "globe", text: _msg("A06"), tooltip: _msg("A06") + " (F8)", ev: "ev_pressAppExecBtn" },
            // App Multi Preview (원본 ws20_multiPrevBtn: icon desktop-mobile, text A08)
            { id: "ws20_multiPrevBtn", fa: "table-cells-large", text: _msg("A08"), tooltip: _msg("A08") + " (Ctrl+F5)", ev: "ev_pressMultiPrevBtn" },
            // Icon Viewer / Icon List — checkWLOList 조건으로 드롭다운(Icon Viewer) ↔ 평평버튼(Icon List)
            //   분기(_iconToolEntry, 원본 oIconList 로직). 원본 모습=Icon Viewer 메뉴.
            _iconToolEntry(),
            // Add Event Method (원본 addEventBtn: icon touch, text A13)
            { id: "addEventBtn", fa: "hand-pointer", text: _msg("A13"), tooltip: _msg("A13") + " (Shift+F1)", ev: "ev_pressAddEventBtn" },
            // Runtime Class Navigator (원본 runtimeBtn: icon functional-location, text A14)
            { id: "runtimeBtn", fa: "diagram-project", text: _msg("A14"), tooltip: _msg("A14"), ev: "ev_pressRuntimeBtn" },
            // Binding Popup (원본 bindPopupBtn: icon connected, text A15)
            { id: "bindPopupBtn", fa: "link", text: _msg("A15"), tooltip: _msg("A15"), ev: "ev_pressBindPopupBtn" }
        ];

        aBtns.forEach(function (oCfg) {
            if (oCfg.sep) { BAR.appendChild(_sep(oCfg.sepId)); return; }
            if (oCfg.split) { BAR.appendChild(_txSplitBtn(oCfg)); return; }
            if (oCfg.menuBtn) { BAR.appendChild(_txMenuBtn(oCfg)); return; }
            BAR.appendChild(_txBtn(oCfg));
        });

        // 오버플로(⋯) — 폭이 모자라면 넘치는 트랜잭션 버튼을 드롭다운으로 접는다(구 OverflowToolbar).
        try {
            if (window.U4AUI && window.U4AUI.attachOverflow) {
                _ws20TbOvf = window.U4AUI.attachOverflow(BAR, {
                    // split 버튼(App 실행)이 오버플로로 접힐 때: 본체(기본 동작)를 실행하도록 위임.
                    menuItem: function (el) {
                        var oI = el.querySelector("i");
                        // 라벨: span 텍스트 우선, 없으면 title→data-tip→aria-label 폴백(hover 후 title
                        //   이 _promote 로 제거돼 라벨이 비던 버그 방지 — 공용 btnLabel).
                        var sText = window.U4AUI.btnLabel(el, true);
                        var bSplit = el.classList.contains("u4a-split");
                        return {
                            iconHtml: oI ? oI.outerHTML : "",
                            text: sText,
                            onClick: function () {
                                if (bSplit) {
                                    var oMain = el.querySelector(".u4a-split__main");
                                    if (oMain) { oMain.click(); return; }
                                }
                                el.click();
                            }
                        };
                    }
                });
            }
        } catch (e) { console.warn("[HTML5][WS20] toolbar overflow attach 실패:", e && e.message); }

        return BAR;

    } // end of _buildWs20Toolbar

    // 상단 트랜잭션 툴바 오버플로 컨트롤러 (fnUpdateWs20Toolbar 가 모드 변경 후 reflow 호출)
    var _ws20TbOvf = null;

    /************************************************************************
     * [PUBLIC] 모드별 트랜잭션 버튼 활성/비활성(표시/숨김) 갱신
     *   원본 fnGetSubHeaderToolbarContentWs20 의 각 버튼 visible 바인딩을
     *   그대로 이식(UI5 모델 → HTML5 모델 shim/getAppInfo 직접 평가).
     *   기준 모델:
     *     /WS20/APP/IS_EDIT   "X"=Change(편집) 모드, 그 외=Display(표시)
     *     /WS20/APP/S_APP_VMS 정의돼 있으면(버전관리 View) 대부분 버튼 숨김
     *     /WS20/APP/ADMIN_APP "X"=Admin App
     *     /USERINFO/USER_AUTH/IS_DEV "D"=개발자 권한
     *     /USERINFO/ISADM     "X"=Admin
     *   원본 규칙(lf_bindPropForVisible 등):
     *     - displayModeBtn : Change 모드일 때만        (default → bIsEdit)
     *     - changeModeBtn  : Display 모드 + dev + !adminBlock
     *     - syntaxCheck/activate/addEvent : Change 모드일 때만
     *     - save           : dev + Change 모드
     *     - mime/controller: 항상
     *     - appExecMenu/multiPrev/iconList/runtime/bindPopup : VMS 아닐 때
     *   재진입/모드전환마다 fnUpdateWs20AppHeader 끝에서 호출됨.
     ************************************************************************/
    oAPP.fn.fnUpdateWs20Toolbar = function () {

        // 툴바가 아직 안 그려졌으면(스킵) — 렌더 전 호출 가드
        if (!document.getElementById("ws20TxToolbar")) { return; }

        // app 정보 (미로그인/미오픈 시 안전 폴백)
        var oInfo = null;
        try { oInfo = parent.getAppInfo && parent.getAppInfo(); } catch (e) { }

        function lf_model(sPath) {
            try {
                var v = APPCOMMON.fnGetModelProperty(sPath);
                if (v != null) { return v; }
            } catch (e) { }
            return undefined;
        }
        // appInfo 우선, 없으면 모델
        function lf_val(sInfoKey, sPath) {
            if (oInfo && oInfo[sInfoKey] != null) { return oInfo[sInfoKey]; }
            return lf_model(sPath);
        }

        var IS_EDIT   = lf_val("IS_EDIT", "/WS20/APP/IS_EDIT");
        var S_APP_VMS = lf_val("S_APP_VMS", "/WS20/APP/S_APP_VMS");
        var ADMIN_APP = lf_val("ADMIN_APP", "/WS20/APP/ADMIN_APP");
        var IS_DEV    = lf_model("/USERINFO/USER_AUTH/IS_DEV");
        var ISADM     = lf_model("/USERINFO/ISADM");

        // 원본과 동일한 파생 플래그
        var bVms        = (typeof S_APP_VMS !== "undefined" && S_APP_VMS !== null); // 버전관리 View → 숨김
        var bChange     = (IS_EDIT === "X");                  // 편집(Change) 모드
        var bDev        = (IS_DEV === "D");                   // 개발자 권한
        var bAdminBlock = (ISADM !== "X" && ADMIN_APP === "X"); // Admin 아닌데 Admin App

        // id → 표시여부
        var oVis = {
            displayModeBtn:       !bVms && bChange,
            changeModeBtn:        !bVms && bDev && !bAdminBlock && !bChange,
            ws20DevSep:           bDev && !bAdminBlock,
            ws20ActionSep:        true,   // 구조적 구분선 — 실제 노출은 _collapseToolbarSeparators 가 결정
            syntaxCheckBtn:       !bVms && bChange,
            activateBtn:          !bVms && bChange,
            saveBtn:              !bVms && bDev && bChange,
            mimeBtn:              true,
            controllerBtn:        true,
            ws20_appExecMenuBtn:  !bVms,
            ws20_multiPrevBtn:    !bVms,
            iconListBtn:          !bVms,
            addEventBtn:          !bVms && bChange,
            runtimeBtn:           !bVms,
            bindPopupBtn:         !bVms
        };

        Object.keys(oVis).forEach(function (sId) {
            var el = document.getElementById(sId);
            if (el) { el.style.display = oVis[sId] ? "" : "none"; }
        });

        // 버튼 가시성 확정 후 구분선 정리 — 모드별 버튼 숨김으로 생기는
        // 선행/후행/중복(연속) 구분선을 접어 "구분선만 두 개" 같은 잔재를 없앤다.
        _collapseToolbarSeparators();

        // 모드별 버튼 가시성 변경 후 오버플로(⋯) 재계산
        try { if (_ws20TbOvf) { _ws20TbOvf.reflow(); } } catch (e) { }

    }; // end of oAPP.fn.fnUpdateWs20Toolbar

    /************************************************************************
     * 툴바 구분선 정리 — 현재 버튼 가시성을 기준으로 구조적 구분선을 접는다.
     *   규칙(보이는 요소 기준):
     *     · 선행 구분선(앞에 보이는 버튼이 없음) → 숨김
     *     · 연속 구분선(직전 보이는 요소도 구분선) → 숨김
     *     · 후행 구분선(뒤에 보이는 버튼이 없음) → 숨김
     *   oVis 가 이미 숨긴 구분선(예: 비개발자 ws20DevSep)은 "없는 것"으로 취급한다.
     *   fnUpdateWs20Toolbar 가 매번 oVis 로 구분선 기본 가시성을 리셋하므로 idempotent.
     ************************************************************************/
    function _collapseToolbarSeparators() {
        var BAR = document.getElementById("ws20TxToolbar");
        if (!BAR) { return; }
        var aKids = Array.prototype.slice.call(BAR.children);
        var bPrevVisibleIsSep = true; // 시작을 구분선으로 간주 → 선행 구분선 제거

        aKids.forEach(function (el) {
            var bSep = el.classList.contains("u4a-tx-sep");
            if (el.style.display === "none") { return; } // 숨겨진 요소는 없는 셈
            if (bSep) {
                if (bPrevVisibleIsSep) { el.style.display = "none"; } // 선행/연속 → 제거
                else { bPrevVisibleIsSep = true; }
                return;
            }
            bPrevVisibleIsSep = false; // 보이는 버튼
        });

        // 후행 구분선 제거 — 뒤에서부터 첫 보이는 요소가 구분선이면 숨김(반복)
        for (var i = aKids.length - 1; i >= 0; i--) {
            var el2 = aKids[i];
            if (el2.style.display === "none") { continue; }
            if (el2.classList.contains("u4a-tx-sep")) { el2.style.display = "none"; continue; }
            break;
        }
    }

    /************************************************************************
     * [HTML5] WS20 단축키 — Back(F3) 를 HTML5 핸들러로 교체.
     * ---------------------------------------------------------------------
     *  구 getShortCutList("WS20") 의 F3 fn 은 sap.ui.getCore().byId("backBtn").firePress()
     *  (UI5 결합) → HTML5 에선 backBtn 이 UI5 컨트롤이 아니라 동작 안 함. USP(ws_html5_usp.js)
     *  와 동일하게 getShortCutList 를 super-wrap 해서 "WS20" 의 F3 fn 만 HTML5 핸들러로 바꾼다.
     *    · 등록: WS20 진입 시 ws_fn_02.js 가 setShortCut("WS20") → oShortcut.add(KEY, fn)(document keydown).
     *    · 미리보기 iframe 포커스: ws_html5_ws20_prev.js _attachPreviewShortcutForward 가 합성 keydown 재발송.
     *  공통 가드(_ws20ScGuard): e.repeat(꾹 누름)·현재 페이지 WS20·busy.
     ************************************************************************/
    function _ws20ScGuard(e, fn) {
        // 공통 가드(ws_common.js fnRunShortCut)에 위임 — 꾹누름·화면일치(WS20)·종합체크
        //   (busy/메뉴열림/다이얼로그열림/isShortcutLock/페이지이동 in-flight) 단일 방어 통로.
        if (oAPP.common && typeof oAPP.common.fnRunShortCut === "function") {
            oAPP.common.fnRunShortCut(e, "WS20", fn);
            return;
        }
        // 폴백(공통 미로드 시) — 최소 가드
        try { if (e && e.stopImmediatePropagation) { e.stopImmediatePropagation(); } } catch (x) { }
        try { if (e && e.preventDefault) { e.preventDefault(); } } catch (x) { }
        if (e && e.repeat === true) { return; }
        try { if (parent.getCurrPage && parent.getCurrPage() !== "WS20") { return; } } catch (x) { }
        try { if (parent.getBusy && parent.getBusy() === "X") { return; } } catch (x) { }
        try { fn(e); } catch (err) { console.error("[HTML5][WS20] shortcut:", err); }
    }

    //F3 — 뒤로가기(원본 ws_common.js 1281 [WS20] Back Button). ← 버튼과 동일한 ev_pageBack 수행.
    function _ws20Back() {
        //메뉴 팝오버 닫기(원본 fnCloseMenuPopover).
        try { if (oAPP.common && typeof oAPP.common.fnCloseMenuPopover === "function") { oAPP.common.fnCloseMenuPopover(); } } catch (x) { }
        //단축키 실행 가능 여부(원본 fnShortCutExeAvaliableCheck) — "X" 면 중단.
        try {
            if (oAPP.common && typeof oAPP.common.fnShortCutExeAvaliableCheck === "function" &&
                oAPP.common.fnShortCutExeAvaliableCheck() === "X") { return; }
        } catch (x) { }
        //입력 중 포커스 날리기(편집값 반영 — 원본 동일).
        try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } } catch (x) { }
        //뒤로가기 — ← 버튼과 동일.
        if (oAPP.events && typeof oAPP.events.ev_pageBack === "function") { oAPP.events.ev_pageBack(); }
        else { console.warn("[HTML5][WS20] ev_pageBack not available (F3)"); }
    }

    //getShortCutList(ws_common.js)가 먼저 로드된 경우에만 super-wrap(미정의면 전 페이지 단축키가
    //  []로 깨지므로 가드). 정상 로드 순서(ws_common → ws_html5_ws20)에선 항상 통과.
    if (typeof oAPP.common.getShortCutList === "function") {
        var _ws20GetShortCutList_super = oAPP.common.getShortCutList;
        oAPP.common.getShortCutList = function (sPgNo) {
            var aList = (typeof _ws20GetShortCutList_super === "function") ? _ws20GetShortCutList_super(sPgNo) : [];
            if (sPgNo !== "WS20" || !Array.isArray(aList)) { return aList; }
            var oFnMap = {
                "F3": function (e) { _ws20ScGuard(e, _ws20Back); }   // 뒤로가기
            };
            aList.forEach(function (o) { if (o && oFnMap[o.KEY]) { o.fn = oFnMap[o.KEY]; } });
            return aList;
        };
    }

    /************************************************************************
     * (A0) WS20 앱 헤더 줄 — 원본 화면 상단의 [← APPID Change Active ... 🔍 ⤓]
     *   구성(좌→우): 뒤로가기(←) / APPID(굵게) / 모드(Change|Display) /
     *               상태(Active|Inactive) / 스페이서 / 우측 아이콘 2개(자리만)
     *   - 뒤로가기: 원본 oAPP.events.ev_pageBack (ws_events.js:1035) 호출 [가드]
     *   - 우측 아이콘 2개: 자리만(정적) — 클릭 시 console.warn 가드
     *   - 텍스트 값은 fnUpdateWs20AppHeader 가 채움 (재진입 시마다 갱신)
     ************************************************************************/
    function _appHdrIconBtn(sId, sGly, sTooltip, fnClick) {
        var BTN = document.createElement("button");
        BTN.type = "button";
        BTN.id = sId;
        BTN.className = "u4aWs20AppHdrBtn";
        BTN.title = sTooltip || "";
        BTN.innerHTML = sGly; // FontAwesome 아이콘 HTML
        BTN.addEventListener("click", function () {
            try {
                // 핸들러가 연결돼 있으면 실행, 아니면 미구현 가드(W2 예정).
                if (typeof fnClick === "function") { fnClick(); return; }
                console.warn("[HTML5][WS20] app header action not implemented (W2 예정):", sId);
            } catch (e) {
                console.warn("[HTML5][WS20] app header action error:", sId, e && e.message);
            }
        });
        return BTN;
    }

    function _buildWs20AppHeader() {

        var HDR = document.createElement("div");
        HDR.id = "ws20AppHeader";
        HDR.className = "u4aWs20AppHeader";

        // 뒤로가기 (←) — 원본 ev_pageBack (ws_events.js:1035) [가드]
        var BACK = document.createElement("button");
        BACK.type = "button";
        BACK.id = "ws20AppHeaderBackBtn";
        BACK.className = "u4aWs20AppHdrBtn back";
        BACK.title = "Back";
        BACK.innerHTML = _fa("arrow-left");
        BACK.addEventListener("click", function () {
            try {
                if (oAPP.events && typeof oAPP.events.ev_pageBack === "function") {
                    oAPP.events.ev_pageBack();
                    return;
                }
                console.warn("[HTML5][WS20] ev_pageBack not available");
            } catch (e) {
                console.warn("[HTML5][WS20] ev_pageBack error:", e && e.message);
            }
        });
        HDR.appendChild(BACK);

        // APPID (굵게)
        var APPID = document.createElement("span");
        APPID.id = "ws20AppHeaderAppId";
        APPID.className = "u4aWs20AppHdrAppId";
        HDR.appendChild(APPID);

        // 모드 (Change / Display)
        var MODE = document.createElement("span");
        MODE.id = "ws20AppHeaderMode";
        MODE.className = "u4aWs20AppHdrMode";
        HDR.appendChild(MODE);

        // 상태 (Active / Inactive — ACTST 없으면 빈값)
        var STAT = document.createElement("span");
        STAT.id = "ws20AppHeaderStatus";
        STAT.className = "u4aWs20AppHdrStat";
        HDR.appendChild(STAT);

        // 아이콘 버튼 2개 (구 ws20_findBtn / ws20_newWinBtn) — 원본처럼 상태 텍스트 "바로 뒤"에 배치.
        //   · Find UI : 원본 sap-icon://sys-find(쌍안경) → binoculars. 타이틀바 전역검색(magnifying-glass)과
        //               구분되도록 의미 맞는 아이콘 사용. (A70 "Find UI")
        //   · New Window : WS10 새창 버튼과 동일하게 통일 — 아이콘 window-restore(WS10 newWindowBtn 과
        //               동일) + oAPP.events.ev_NewWindow(→ parent.onNewWindow(), Electron 메인프레임
        //               새 창, sap 무관). 라벨도 WS10 과 같은 A09("새 창/New Window") 사용.
        HDR.appendChild(_appHdrIconBtn("ws20AppHeaderFindBtn", _fa("binoculars"), _msg("A70") + " (Ctrl+F)"));
        HDR.appendChild(_appHdrIconBtn("ws20AppHeaderExportBtn", _fa("window-restore"), _msg("A09") + " (Ctrl+N)", function () {
            // WS10 ev_NewWindow 와 동일 경로 호출 (ws_events.js:966 → parent.onNewWindow())
            if (oAPP.events && typeof oAPP.events.ev_NewWindow === "function") {
                oAPP.events.ev_NewWindow();
                return;
            }
            console.warn("[HTML5][WS20] ev_NewWindow not available");
        }));

        // 스페이서 — 아이콘 클러스터 뒤(우측 남는 공간 흡수). 원본은 [상태][Find][New] 가 좌측에 모임.
        var SPC = document.createElement("span");
        SPC.className = "u4aWs20AppHdrSpacer";
        HDR.appendChild(SPC);

        return HDR;

    } // end of _buildWs20AppHeader

    /************************************************************************
     * [PUBLIC] 앱 헤더 텍스트 갱신 (APPID / 모드 / 상태)
     *   - APPID : parent.getAppInfo().APPID → 폴백 모델 /WS20/APP/APPID → ""
     *   - 모드  : IS_EDIT === "X" ? "Change" : "Display"
     *   - 상태  : ACTST === "A" ? "Active" : "Inactive" (필드 없으면 빈값)
     *   WS20 재진입 시마다 호출되어 최신 값으로 갱신. (값 추측 없이 그대로 표기)
     ************************************************************************/
    oAPP.fn.fnUpdateWs20AppHeader = function () {

        var elAppId = document.getElementById("ws20AppHeaderAppId");
        var elMode = document.getElementById("ws20AppHeaderMode");
        var elStat = document.getElementById("ws20AppHeaderStatus");
        if (!elAppId && !elMode && !elStat) { return; }

        // app 정보 (미로그인/미오픈 시 안전 폴백)
        var oInfo = null;
        try { oInfo = parent.getAppInfo && parent.getAppInfo(); } catch (e) { }

        function lf_model(sPath) {
            try {
                var v = APPCOMMON.fnGetModelProperty(sPath);
                if (v != null) { return v; }
            } catch (e) { }
            return null;
        }

        // APPID
        var sAppId = (oInfo && oInfo.APPID) || lf_model("/WS20/APP/APPID") || "";
        if (elAppId) { elAppId.textContent = sAppId; }

        // 모드 (IS_EDIT === "X" → Change(A02), 그 외 Display(A05)) — 원본 fnGetHeaderToolbarContentWs20 동일 코드.
        var sIsEdit = (oInfo && oInfo.IS_EDIT != null) ? oInfo.IS_EDIT : lf_model("/WS20/APP/IS_EDIT");
        var sModeTxt = (sIsEdit === "X") ? _msg("A02") : _msg("A05");
        if (elMode) { elMode.textContent = sModeTxt; }

        // 상태 (ACTST: "A" → Active(B66), 그 외 → Inactive(B67), 필드 없으면 빈값)
        //   단, 변경분이 있으면(IS_CHAG === "X") 아직 액티브 전이라 Inactive 로 표시
        //   (원본 UX: 속성 하나라도 바꾸면 inactive → Save/Activate 후 갱신).
        //   라벨 코드는 원본 fnGetHeaderToolbarContentWs20: Active=B66(Activate), Inactive=B67(Inactivate).
        var sActst = (oInfo && oInfo.ACTST != null) ? oInfo.ACTST : lf_model("/WS20/APP/ACTST");
        var sIsChag = (oInfo && oInfo.IS_CHAG != null) ? oInfo.IS_CHAG : lf_model("/WS20/APP/IS_CHAG");
        var sStatTxt = "";
        if (sIsChag === "X") {
            sStatTxt = _msg("B67");
        } else if (sActst != null && sActst !== "") {
            sStatTxt = (sActst === "A") ? _msg("B66") : _msg("B67");
        }
        if (elStat) { elStat.textContent = sStatTxt; }

        // 윈도우 타이틀/헤더 타이틀 갱신 (원본 동일: "U4A Workspace - {APPID} {모드} {상태}")
        //   "U4A Workspace - " 접두는 원본도 리터럴(영문 고정) — 미러.
        try {
            if (sAppId) {
                var sTitle = "U4A Workspace - " + sAppId + " " + sModeTxt + (sStatTxt ? (" " + sStatTxt) : "");
                if (APPCOMMON.setWSHeadText) { APPCOMMON.setWSHeadText(sTitle); }
                var oWin = (parent.CURRWIN) || (parent.REMOTE && parent.REMOTE.getCurrentWindow && parent.REMOTE.getCurrentWindow());
                if (oWin && oWin.setTitle) { oWin.setTitle(sTitle); }
            }
        } catch (e) { }

        // 모드별 트랜잭션 버튼 표시/숨김도 함께 갱신 (헤더와 동일 타이밍 = 모든 재진입/모드전환)
        try { oAPP.fn.fnUpdateWs20Toolbar(); } catch (e) { }

    }; // end of oAPP.fn.fnUpdateWs20AppHeader

    /************************************************************************
     * (B) WS20 3분할 레이아웃 (구 sap.ui.layout.Splitter "designSplit")
     *   원본: 좌 oDesignTree(25%, minSize300, u4aWsDesignTree)
     *         중 oDesignPreview(u4aWsDesignPreview)
     *         우 oDesignAttr(30%, minSize300, u4aWsDesignAttr)
     *   → flex 기반 3컬럼 + 드래그 리사이즈 가능한 스플리터 바 2개.
     *   각 패널 내부는 빈 컨테이너 + 라벨(다음 단계 예정). uiDesignArea 등 getScript 호출 안 함.
     ************************************************************************/
    function _buildWs20Split() {

        var SPLIT = document.createElement("div");
        SPLIT.id = "ws20DesignSplit";
        SPLIT.className = "u4aWs20Split";

        // 스플릿바 표준(doc 16 §4): 초기 basis 는 %(고정 px 금지), 최소폭은 **단일 min-width** 하나로
        //   초기(%가 min-width 로 floor)·드래그 클램프·리사이즈 재클램프가 모두 같은 값을 쓴다
        //   → "진입 minwidth ≠ 드래그 minwidth" 이원화(구 dragMin 300 vs CSS 96) 버그 제거.
        //   (WS 창 최소폭은 1000px 이상이라 좌300+가200+우300+바22 < 1000 로 안전)

        // 좌: UI 트리 (구 designTree)
        var LEFT = _buildPanel("ws20DesignTree", "u4aWsDesignTree", "UI 트리 — W3 예정");
        LEFT.style.flex = "0 1 25%";     // 초기 basis=%(반응형). 드래그하면 _bindResizerSimple 가 0 0 <px> 로 고정.
        LEFT.style.minWidth = "300px";   // 단일 최소폭(트리 내용). 초기 25%<300 이면 min-width 가 300 으로 floor.

        // 중: 미리보기 (구 designPreview) — 유연(잔여 흡수) 패널.
        var CENTER = _buildPanel("ws20DesignPreview", "u4aWsDesignPreview", "미리보기 — W2 예정");
        CENTER.style.flex = "1 1 auto";  // 유연: 좌/우 드래그 시 슬랙을 흡수. 항상 px 로 고정하지 않는다.
        CENTER.style.minWidth = "200px"; // 미리보기 최소폭 — 드래그 max-clamp 가 이 값 이하로 안 줄게 보호.

        // 미리보기 패널 헤더 줄 (Preview / ⟳ / 줌 슬라이더 / OFF / ?) — 정적, W2 예정
        CENTER.insertBefore(_buildPrevHeader(), CENTER.firstChild);

        // 우: 속성 (구 designAttr)
        var RIGHT = _buildPanel("ws20DesignAttr", "u4aWsDesignAttr", "속성 — W4 예정");
        RIGHT.style.flex = "0 1 30%";    // 초기 basis=%
        RIGHT.style.minWidth = "300px";  // 단일 최소폭(속성 드롭다운+링크아이콘 안 잘리게) — 좌측 트리와 동일.

        // 패널 맵 보관(레이아웃 변경 시 재배치용) + 저장된 순서대로 배치/리사이저 바인딩.
        //   (구 setDesignLayout / sap.ui.layout.Splitter content 순서 = P13N "designLayout")
        SPLIT.__ws20Panels = { designTree: LEFT, designPreview: CENTER, designAttr: RIGHT };
        _ws20ArrangeSplit(SPLIT, _ws20SavedLayoutOrder());

        // 창 리사이즈 재클램프(doc 16 §4.3) 1회 바인딩 — 드래그로 px 고정된 패널이 줄어든 창을 넘쳐
        //   overflow:hidden 에 잘리는 것 방지.
        _bindWs20SplitResizeClamp();

        return SPLIT;

    } // end of _buildWs20Split

    /************************************************************************
     * WS20 3분할 레이아웃 — 패널 정의 / 저장 순서 / 배치 (구 callDesignLayoutChangePopup + setDesignLayout)
     ************************************************************************/
    //  T_LAYOUT 동등 정의(원본 callDesignLayoutChangePopup.js default). icon=FA(원본 sap-icon 대응).
    var WS20_LAYOUT_DEF = [
        { SID: "designTree",    cls: "u4aWsDesignTree",    msg: "A65", fa: "list-ul" },   // Design Tree (text-align-right)
        { SID: "designPreview", cls: "u4aWsDesignPreview", msg: "A67", fa: "image" },     // Preview (header)
        { SID: "designAttr",    cls: "u4aWsDesignAttr",    msg: "A66", fa: "sliders" }    // Attribute (customize)
    ];

    function _ws20DefaultOrder() { return WS20_LAYOUT_DEF.map(function (d) { return d.SID; }); }

    // 저장된 레이아웃 순서(SID 배열). P13N "designLayout"(POSIT 정렬). 유효하지 않으면 default.
    function _ws20SavedLayoutOrder() {
        try {
            var aL = parent.getP13nData && parent.getP13nData("designLayout");
            if (Array.isArray(aL) && aL.length === WS20_LAYOUT_DEF.length) {
                var aSorted = aL.slice().sort(function (x, y) { return (x.POSIT || 0) - (y.POSIT || 0); });
                var aSid = aSorted.map(function (o) { return o.SID; });
                // 3개 SID 가 정확히 일치할 때만 채택(데이터 오염 방어)
                if (WS20_LAYOUT_DEF.every(function (d) { return aSid.indexOf(d.SID) !== -1; })) { return aSid; }
            }
        } catch (e) { }
        return _ws20DefaultOrder();
    }

    // SPLIT 컨테이너에 패널을 aOrder(SID 배열) 순서대로 재배치 + 리사이저 새로 바인딩.
    //   리사이저는 항상 "패널 사이"에 위치하며, 인접한 '고정' 패널(트리/속성)의 폭을 조절한다
    //   (미리보기=flex:1 가변 이라 슬랙을 흡수). 패널 순서가 어떻든 동작.
    function _ws20ArrangeSplit(SPLIT, aOrder) {
        var oPanels = SPLIT.__ws20Panels;
        if (!oPanels) { return; }

        // 현재 DOM 패널 순서가 이미 aOrder 와 같으면 재배치 생략 — 불필요한 미리보기 iframe
        //   re-parent(=재로드) 방지. (setDesignLayout 가 setUIAreaEditable 마다 호출되므로 중요)
        var aCur = [];
        Array.prototype.forEach.call(SPLIT.children, function (el) {
            if (el.classList && el.classList.contains("u4aWsDesignTree")) { aCur.push("designTree"); }
            else if (el.classList && el.classList.contains("u4aWsDesignPreview")) { aCur.push("designPreview"); }
            else if (el.classList && el.classList.contains("u4aWsDesignAttr")) { aCur.push("designAttr"); }
        });
        if (aCur.length === aOrder.length && aCur.every(function (s, i) { return s === aOrder[i]; })) { return; }

        // 컨테이너 비우기(패널 노드는 oPanels 가 참조 보유 → 유실 없음) — 기존 리사이저는 폐기(리스너째).
        while (SPLIT.firstChild) { SPLIT.removeChild(SPLIT.firstChild); }

        var aBars = [];
        aOrder.forEach(function (sSid, i) {
            var oP = oPanels[sSid];
            if (!oP) { return; }
            if (i > 0) {
                var oBar = _buildResizer(i === 1 ? "left" : "right");
                SPLIT.appendChild(oBar);
                aBars.push(oBar);
            }
            SPLIT.appendChild(oP);
        });

        // 리사이저 바인딩.
        //   · 기본 순서[tree,preview,attr]: give-way(_bindResizer) — 슬랙을 가운데(preview)가 먼저
        //       흡수하고, 닿으면 반대편 패널이 **자기 min-width 까지** 양보(사용자 선호 거동).
        //       (구버전의 "min 밑으로 빨려들어가던" 버그는 _bindResizer 안에서 0 0+단일 min 으로 교정.)
        //   · 그 외(재정렬) 순서: 인접-쌍(_bindResizerSimple) — give-way 는 preview=가운데 전제라 깨짐.
        var bDefault = aOrder.length === 3 &&
            aOrder[0] === "designTree" && aOrder[1] === "designPreview" && aOrder[2] === "designAttr";
        aBars.forEach(function (oBar) {
            if (bDefault) {
                var oLeft = oBar.previousElementSibling;
                if (oLeft && oLeft.classList.contains("u4aWsDesignTree")) { _bindResizer(oBar, oLeft, SPLIT, "left"); }
                else { _bindResizer(oBar, oBar.nextElementSibling, SPLIT, "right"); } // preview|attr → attr
            } else {
                _bindResizerSimple(oBar, SPLIT);
            }
        });
    }

    /************************************************************************
     * 표준 인접-쌍 리사이저 (doc 16 §4.3 / 레퍼런스 ServerList _attachSplitterDrag).
     *   바 양옆 두 패널만 폭을 주고받는다(나머지 패널 불변):
     *    · 한쪽이 미리보기(flex:1 유연)면 → 반대쪽 '고정' 패널만 px 로 조절, 미리보기가 슬랙 흡수.
     *      이때 미리보기가 자기 min-width 밑으로 짜부되지 않도록 **max-clamp**(컨테이너 − 바 −
     *      미리보기 min − 나머지 패널 현재폭) 로 상한을 둔다.
     *    · 둘 다 고정이면 → 인접쌍(좌 +delta / 우 −delta, 합 보존).
     *   최소폭은 **CSS min-width 단일 출처**(dataset.dragMin 제거). 드래그 결과는 0 0 <px> 로 고정.
     ************************************************************************/
    // 패널 최소폭 — CSS min-width 단일 출처(폴백 120, doc 16 §4.3).
    function _ws20PaneMin(el) {
        var v = parseFloat(getComputedStyle(el).minWidth);
        return (v && v > 0) ? v : 120;
    }
    // 스플릿 안 바 폭 합.
    function _ws20BarsW(oSplit) {
        var w = 0;
        oSplit.querySelectorAll(".u4aWs20Resizer").forEach(function (b) { w += b.offsetWidth || 11; });
        return w;
    }
    // oSplit 의 패널들(트리/미리보기/속성).
    function _ws20Panes(oSplit) {
        return oSplit.querySelectorAll(".u4aWsDesignTree, .u4aWsDesignPreview, .u4aWsDesignAttr");
    }
    // oExclude·oPreview 를 뺀 나머지 패널들의 현재폭 합(고정 px 단일 조절 시 상한 계산용).
    function _ws20OtherPanesW(oSplit, oExclude, oPreview) {
        var s = 0;
        _ws20Panes(oSplit).forEach(function (p) {
            if (p !== oExclude && p !== oPreview) { s += p.getBoundingClientRect().width; }
        });
        return s;
    }

    function _bindResizerSimple(oBar, oSplit) {
        var bDrag = false, iStartX = 0, oA = null, oB = null, iAStart = 0, iBStart = 0;
        function _isPrev(el) { return el && el.classList.contains("u4aWsDesignPreview"); }

        function lf_move(e) {
            if (!bDrag) { return; }
            var d = e.clientX - iStartX;
            var iAvail = oSplit.clientWidth - _ws20BarsW(oSplit);

            if (_isPrev(oA)) {                       // 좌가 미리보기 → 우 고정 패널(oB)만 조절(미리보기 흡수)
                var mb = _ws20PaneMin(oB);
                var maxB = iAvail - _ws20PaneMin(oA) - _ws20OtherPanesW(oSplit, oB, oA); // 미리보기 min 보호
                var ib = iBStart - d;                // 드래그 우 → oB 축소(미리보기 확대)
                if (ib > maxB) { ib = maxB; }
                if (ib < mb) { ib = mb; }
                oB.style.flex = "0 0 " + ib + "px";
            } else if (_isPrev(oB)) {                // 우가 미리보기 → 좌 고정 패널(oA)만 조절(미리보기 흡수)
                var ma = _ws20PaneMin(oA);
                var maxA = iAvail - _ws20PaneMin(oB) - _ws20OtherPanesW(oSplit, oA, oB); // 미리보기 min 보호
                var ia = iAStart + d;                // 드래그 우 → oA 확대(미리보기 축소)
                if (ia > maxA) { ia = maxA; }
                if (ia < ma) { ia = ma; }
                oA.style.flex = "0 0 " + ia + "px";
            } else {                                  // 둘 다 고정 → 인접쌍(합 보존)
                var a = iAStart + d, b = iBStart - d, am = _ws20PaneMin(oA), bm = _ws20PaneMin(oB);
                if (a < am) { b -= (am - a); a = am; }
                if (b < bm) { a -= (bm - b); b = bm; }
                if (a < am) { a = am; }
                oA.style.flex = "0 0 " + a + "px";
                oB.style.flex = "0 0 " + b + "px";
            }
        }
        function lf_up() {
            bDrag = false;
            document.body.classList.remove("u4aWs20ResizingCursor");
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", function (e) {
            oA = oBar.previousElementSibling;
            oB = oBar.nextElementSibling;
            if (!oA || !oB) { return; }
            bDrag = true;
            iStartX = e.clientX;
            iAStart = oA.getBoundingClientRect().width;
            iBStart = oB.getBoundingClientRect().width;
            document.body.classList.add("u4aWs20ResizingCursor");
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault();
        });
    }

    /************************************************************************
     * 창 리사이즈 재클램프 (doc 16 §4.3 / 레퍼런스 ServerList _bindSplitterResizeClamp).
     *   드래그로 px 고정(0 0 <px>)된 패널 합 + 바 + 유연패널(미리보기) 최소폭이 줄어든 창을 넘으면,
     *   **큰 고정 패널부터 자기 min-width 까지 자동 축소**해 overflow:hidden 에 잘려 패널/바가 숨는 것 방지.
     *   리스너는 1회만 바인딩(뷰 전환으로 스플릿이 새로 그려져도 querySelector 로 현재 것을 처리).
     ************************************************************************/
    var _ws20SplitResizeBound = false;
    function _bindWs20SplitResizeClamp() {
        if (_ws20SplitResizeBound) { return; }
        _ws20SplitResizeBound = true;
        window.addEventListener("resize", function () {
            var oSplit = document.getElementById("ws20DesignSplit");
            if (!oSplit) { return; }
            var iAvail = oSplit.getBoundingClientRect().width;
            if (!iAvail) { return; }
            var aPanes = Array.prototype.slice.call(_ws20Panes(oSplit));
            if (!aPanes.length) { return; }
            var iBars = _ws20BarsW(oSplit);
            function _px(p) { var m = (p.style.flex || "").match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : null; }
            // px 고정 패널 vs 유연(%/auto) 패널 분리. 유연패널은 CSS flex+min-width 가 알아서 줄어든다.
            var aFixed = [], iFlexMin = 0;
            aPanes.forEach(function (p) { if (_px(p) != null) { aFixed.push(p); } else { iFlexMin += _ws20PaneMin(p); } });
            var iFixedW = 0; aFixed.forEach(function (p) { iFixedW += _px(p); });
            var iNeed = (iFixedW + iBars + iFlexMin) - iAvail;
            if (iNeed <= 0) { return; }
            aFixed.slice().sort(function (a, b) { return _px(b) - _px(a); }).forEach(function (p) {
                if (iNeed <= 0) { return; }
                var iCur = _px(p), iMin = _ws20PaneMin(p);
                var iCut = Math.min(Math.max(0, iCur - iMin), iNeed);
                if (iCut > 0) { p.style.flex = "0 0 " + (iCur - iCut) + "px"; iNeed -= iCut; }
            });
        });
    }

    // [PUBLIC] 구 setDesignLayout — 저장된 순서로 현재 SPLIT 재배치(셸 렌더/모드전환 시 호출).
    oAPP.fn.setDesignLayout = function () {
        try {
            var oSplit = document.getElementById("ws20DesignSplit");
            if (oSplit && oSplit.__ws20Panels) { _ws20ArrangeSplit(oSplit, _ws20SavedLayoutOrder()); }
        } catch (e) { console.warn("[HTML5][WS20] setDesignLayout error:", e && e.message); }
    };

    /************************************************************************
     * [PUBLIC] 레이아웃 변경 팝업 (구 callDesignLayoutChangePopup — Split Position Change)
     *   원본: sap.m.Dialog + GenericTile D&D 재정렬 + Default/Save/Close.
     *   3카드(Design Tree/Preview/Attribute)를 드래그로 재정렬 → 저장 시 P13N "designLayout"
     *   저장 + 패널 순서 적용 + 미리보기 재로드.  (native <dialog class="u4a-dialog">)
     ************************************************************************/
    oAPP.fn.fnWs20OpenLayoutPopup = function () {

        // 기존 열림 제거
        var oOld = document.getElementById("ws20LayoutDlg");
        if (oOld) { try { oOld.close(); } catch (e) { } oOld.remove(); }

        var aWork = _ws20SavedLayoutOrder();   // 작업용 순서(SID 배열) — 저장 전까지 임시
        function _def(sid) { return WS20_LAYOUT_DEF.filter(function (d) { return d.SID === sid; })[0]; }

        var DLG = document.createElement("dialog");
        DLG.id = "ws20LayoutDlg";
        DLG.className = "u4a-dialog u4aWs20LayoutDlg";

        DLG.innerHTML =
            '<div class="u4a-dialog__header">' +
            '  <i class="fa-solid fa-table-columns"></i><span>' + _esc(_msg("A62")) + '</span>' +   // Change Layout
            '  <button type="button" class="u4a-btn-icon u4aWs20LayoutX" data-act="close" title="' + _esc(_msg("A39")) + '"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
            '<div class="u4a-dialog__body"><div class="u4aWs20LayoutCards"></div></div>' +
            '<div class="u4a-dialog__footer">' +
            '  <button type="button" class="u4a-btn" data-act="default" title="' + _esc(_msg("A63")) + '"><i class="fa-solid fa-rotate-left"></i></button>' +   // Default (아이콘만)
            '  <button type="button" class="u4a-btn u4a-btn--emphasized" data-act="save" title="' + _esc(_msg("A64")) + '"><i class="fa-solid fa-floppy-disk"></i></button>' +   // Save (아이콘만)
            '  <button type="button" class="u4a-btn u4a-btn--negative" data-act="close" title="' + _esc(_msg("A39")) + '"><i class="fa-solid fa-xmark"></i></button>' +   // Close (X 아이콘만 · Reject 느낌)
            '</div>';

        var CARDS = DLG.querySelector(".u4aWs20LayoutCards");
        var _dragSid = null;

        function _renderCards() {
            CARDS.innerHTML = "";
            aWork.forEach(function (sid) {
                var d = _def(sid);
                if (!d) { return; }
                var C = document.createElement("div");
                C.className = "u4aWs20LayoutCard";
                C.setAttribute("draggable", "true");
                C.setAttribute("data-sid", sid);
                C.innerHTML = '<i class="fa-solid fa-grip-vertical u4aWs20LayoutGrip"></i>' +
                    '<i class="fa-solid fa-' + d.fa + ' u4aWs20LayoutIco"></i>' +
                    '<span class="u4aWs20LayoutTxt">' + _esc(_msg(d.msg)) + '</span>';
                C.addEventListener("dragstart", function (e) { _dragSid = sid; C.classList.add("is-dragging"); try { e.dataTransfer.effectAllowed = "move"; } catch (x) { } });
                C.addEventListener("dragend", function () { _dragSid = null; C.classList.remove("is-dragging"); });
                C.addEventListener("dragover", function (e) { e.preventDefault(); C.classList.add("is-over"); });
                C.addEventListener("dragleave", function () { C.classList.remove("is-over"); });
                C.addEventListener("drop", function (e) {
                    e.preventDefault(); C.classList.remove("is-over");
                    if (!_dragSid || _dragSid === sid) { return; }
                    // _dragSid 를 sid 위치로 이동(순서 재배열)
                    var iFrom = aWork.indexOf(_dragSid), iTo = aWork.indexOf(sid);
                    if (iFrom === -1 || iTo === -1) { return; }
                    aWork.splice(iFrom, 1);
                    aWork.splice(iTo, 0, _dragSid);
                    _renderCards();
                });
                CARDS.appendChild(C);
            });
        }
        _renderCards();

        function _close() { try { DLG.close(); } catch (e) { } DLG.remove(); }

        function _save() {
            // 저장 확인 (구 010 "Do you want to save it?") — 중앙 showMessage(HTML5) 사용.
            var sMsg = "";
            try { sMsg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "010"); } catch (e) { }
            function _doSave() {
                // P13N 저장 (구 setP13nData("designLayout", T_LAYOUT)) — POSIT/SID/UIID 포함.
                var aT_LAYOUT = aWork.map(function (sid, i) {
                    var d = _def(sid) || {};
                    return { SID: sid, POSIT: i, NAME: _msg(d.msg || ""), UIID: "o" + sid.charAt(0).toUpperCase() + sid.slice(1) };
                });
                try { if (parent.setP13nData) { parent.setP13nData("designLayout", aT_LAYOUT); } }
                catch (e) { console.error("[HTML5][WS20] designLayout 저장 실패:", e); }
                // 실제 패널 순서 적용 + 미리보기 재로드(구 loadPreviewFrame(true)).
                try { oAPP.fn.setDesignLayout(); } catch (e) { console.error("[HTML5][WS20] 레이아웃 적용 실패:", e); }
                try { if (typeof oAPP.fn.fnWs20LoadPreview === "function") { oAPP.fn.fnWs20LoadPreview(); } } catch (e) { }
                _close();
            }
            try {
                if (parent.showMessage) {
                    parent.showMessage(null, 30, "I", sMsg, function (sAct) { if (sAct === "YES") { _doSave(); } });
                    return;
                }
            } catch (e) { }
            _doSave(); // showMessage 미가용 시 바로 저장
        }

        DLG.addEventListener("click", function (e) {
            var oBtn = e.target.closest("[data-act]");
            if (!oBtn) { return; }
            var sAct = oBtn.getAttribute("data-act");
            if (sAct === "close") { _close(); }
            else if (sAct === "default") { aWork = _ws20DefaultOrder(); _renderCards(); }
            else if (sAct === "save") { _save(); }
        });
        DLG.addEventListener("cancel", function (e) { e.preventDefault(); _close(); }); // ESC

        document.body.appendChild(DLG);
        if (typeof DLG.showModal === "function") { try { DLG.showModal(); } catch (e) { DLG.setAttribute("open", ""); } }
        else { DLG.setAttribute("open", ""); }

    }; // end of fnWs20OpenLayoutPopup

    /************************************************************************
     * 좌측 사이드 레일 (구 sap.tnt.ToolPage sideContent = sap.tnt.SideNavigation)
     * ---------------------------------------------------------------------
     *  원본(ws_fn_01.js 2499 + ws_main.js 240/255 + ws_fn_03.js 685/694):
     *   · 상단 item  : MENUITEM_10 (screen-split-three, B31 "Split Position Change")
     *                  → fnWs20SideMENUITEM_10 → callDesignLayoutChangePopupOpener(디자인영역 UI5)
     *   · 하단 fixed : FIXITM_10 (it-system, B32 "System Information")
     *                  → fnWs20SideFIXITM_10 → 접속 서버 정보 Popover
     *   · 펼침 토글(구 ToolPage sideExpanded:false → 아이콘만, 펼치면 텍스트)
     ************************************************************************/
    function _ws20SideItem(sIcon, sText, fn) {
        var B = document.createElement("button");
        B.type = "button";
        B.className = "u4aWs20SideBtn";
        B.title = sText || "";
        B.innerHTML = '<i class="fa-solid fa-' + sIcon + '"></i><span class="u4aWs20SideTxt"></span>';
        B.querySelector(".u4aWs20SideTxt").textContent = sText || "";
        B.addEventListener("click", function (ev) {
            try { fn(ev); } catch (e) { console.warn("[HTML5][WS20] side action error:", e && e.message); }
        });
        return B;
    }

    function _buildWs20Side() {
        var SIDE = document.createElement("div");
        SIDE.className = "u4aWs20Side";

        // 펼침/접힘 토글 (구 ToolPage sideExpanded)
        var TOG = document.createElement("button");
        TOG.type = "button";
        TOG.className = "u4aWs20SideBtn u4aWs20SideToggle";
        TOG.innerHTML = '<i class="fa-solid fa-bars"></i>';
        TOG.addEventListener("click", function () { SIDE.classList.toggle("is-expanded"); });
        SIDE.appendChild(TOG);

        // 상단 메뉴 (Split Position Change)
        var TOP = document.createElement("div");
        TOP.className = "u4aWs20SideTop";
        TOP.appendChild(_ws20SideItem("table-columns", _msg("B31"), function () {
            // 구 fnWs20SideMENUITEM_10 → callDesignLayoutChangePopupOpener.
            //   HTML5 레이아웃 변경 팝업(3분할 순서 재정렬) 직접 호출.
            try { oAPP.fn.fnWs20OpenLayoutPopup(); }
            catch (e) { console.error("[HTML5][WS20] Split Position Change(레이아웃 변경 팝업) 오류:", e); }
        }));
        SIDE.appendChild(TOP);

        // 하단 고정 (System Information — 접속 서버 정보)
        var FIX = document.createElement("div");
        FIX.className = "u4aWs20SideFix";
        FIX.appendChild(_ws20SideItem("server", _msg("B32"), function (ev) {
            _ws20ShowServerInfo(ev.currentTarget);
        }));
        SIDE.appendChild(FIX);

        return SIDE;
    }

    // 접속 서버 정보 Popover (구 fnWs20SideFIXITM_10 → sap.m.ResponsivePopover 를 HTML5 로)
    function _ws20ShowServerInfo(oAnchor) {
        var old = document.querySelector(".u4aWs20SrvPop");
        if (old) { try { old.remove(); } catch (e) { } if (old.__anchor === oAnchor) { return; } }

        var S = {}, U = {}, M = {};
        try { S = parent.getServerInfo() || {}; } catch (e) { }
        try { U = parent.getUserInfo() || {}; } catch (e) { }
        try { M = (oAPP.attr && oAPP.attr.metadata && oAPP.attr.metadata.METADATA) || {}; } catch (e) { }
        function _wz(n) { try { return parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", n) || n; } catch (e) { return n; } }

        var sSvrVer = "";
        try { if (M.S_WSVER && M.S_WSVER.SVRVER) { sSvrVer = M.S_WSVER.SVRVER + " ( " + (M.S_WSVER.WSSVER || "") + " )"; } } catch (e) { }
        var sHost = ""; try { sHost = (S.SERVER_INFO && S.SERVER_INFO.host) || ""; } catch (e) { }

        // 원본 ws_fn_03.js 768~966 필드 순서 (값 없으면 행 생략)
        var aRows = [
            [_msg("C43"), S.WSVER],                              // WS Version
            [_msg("E26"), S.WSPATCH_LEVEL],                      // Patch Level
            [_wz("285"), sSvrVer],                               // Server Version
            [_wz("063"), S.CLIENT],                              // Client
            [_msg("C45"), S.SYSID],                              // System ID
            [_msg("C46"), (U.ID == null ? "" : String(U.ID)).toUpperCase()], // USER
            [_msg("C47"), S.LANGU],                              // Language
            [_msg("C48"), sHost]                                 // Host
        ];

        var POP = document.createElement("div");
        POP.className = "u4a-menu u4aWs20SrvPop";
        POP.__anchor = oAnchor;

        var HD = document.createElement("div");
        HD.className = "u4aWs20SrvHd";
        HD.innerHTML = '<i class="fa-solid fa-server"></i><span></span>';
        HD.querySelector("span").textContent = _msg("C42"); // Server Information
        POP.appendChild(HD);

        var BODY = document.createElement("div");
        BODY.className = "u4aWs20SrvBody";
        aRows.forEach(function (r) {
            if (r[1] == null || r[1] === "") { return; }
            var ROW = document.createElement("div");
            ROW.className = "u4aWs20SrvRow";
            var L = document.createElement("label"); L.textContent = r[0];
            var V = document.createElement("span"); V.textContent = String(r[1]);
            ROW.appendChild(L); ROW.appendChild(V); BODY.appendChild(ROW);
        });
        POP.appendChild(BODY);

        document.body.appendChild(POP);

        // 위치: 앵커 우측(공간 부족 시 좌측), 화면 경계 보정
        var r = oAnchor.getBoundingClientRect();
        var pr = POP.getBoundingClientRect();
        var x = r.right + 6, y = r.top;
        if (x + pr.width > window.innerWidth) { x = Math.max(4, r.left - pr.width - 6); }
        if (y + pr.height > window.innerHeight) { y = Math.max(4, window.innerHeight - pr.height - 4); }
        POP.style.position = "fixed";
        POP.style.left = x + "px";
        POP.style.top = y + "px";
        POP.style.zIndex = "4000";

        function _close() {
            try { POP.remove(); } catch (e) { }
            document.removeEventListener("mousedown", _out, true);
            document.removeEventListener("keydown", _esc, true);
            window.removeEventListener("resize", _close);
            window.removeEventListener("scroll", _close, true);
        }
        function _out(e) { if (!POP.contains(e.target) && e.target !== oAnchor && !oAnchor.contains(e.target)) { _close(); } }
        function _esc(e) { if (e.key === "Escape") { _close(); } }
        // 창 리사이즈/스크롤 시 닫기 — 앵커(서버정보 버튼) 이동으로 위치 어긋남 방지(전체창 전환 등).
        window.addEventListener("resize", _close);
        window.addEventListener("scroll", _close, true);
        // 미리보기(iframe) 클릭 닫기는 전역(u4a-ui.js _installIframeBlurClose)이 합성 mousedown 으로 처리.
        setTimeout(function () {
            document.addEventListener("mousedown", _out, true);
            document.addEventListener("keydown", _esc, true);
        }, 0);
    }

    /************************************************************************
     * 미리보기 패널 헤더 줄 (id: ws20PrevHeader)
     *   좌: "Preview" 텍스트 / 우: ⟳ 새로고침 + 줌 슬라이더(비활성) + OFF 토글 + ?
     *   전부 정적/가드 — 실제 동작은 W2 단계에서 연결. (클릭 시 console.warn)
     ************************************************************************/
    function _buildPrevHeader() {

        var HDR = document.createElement("div");
        HDR.id = "ws20PrevHeader";
        HDR.className = "u4aWs20PanelHdr u4aWs20PrevHeader";

        // 좌측 타이틀
        var TIT = document.createElement("span");
        TIT.className = "u4aWs20PanelHdrTitle";
        TIT.textContent = "Preview";
        HDR.appendChild(TIT);

        // 스페이서
        var SPC = document.createElement("span");
        SPC.className = "u4aWs20PanelHdrSpacer";
        HDR.appendChild(SPC);

        // 헤더 아이콘 버튼 1개 생성 (정적/가드)
        function lf_hdrBtn(sId, sGly, sTooltip) {
            var BTN = document.createElement("button");
            BTN.type = "button";
            BTN.id = sId;
            BTN.className = "u4aWs20PanelHdrBtn";
            BTN.title = sTooltip || "";
            BTN.innerHTML = sGly; // FontAwesome 아이콘 HTML
            BTN.addEventListener("click", function () {
                try {
                    console.warn("[HTML5][WS20] preview action not implemented (W2 예정):", sId);
                } catch (e) { }
            });
            return BTN;
        }

        // 새로고침 (자리만)
        HDR.appendChild(lf_hdrBtn("ws20PrevRefreshBtn", _fa("rotate-right"), "Refresh"));

        // 줌 슬라이더 (비활성 — 자리만)
        var ZOOM = document.createElement("input");
        ZOOM.type = "range";
        ZOOM.id = "ws20PrevZoomSlider";
        ZOOM.className = "u4aWs20PrevZoom";
        ZOOM.disabled = true;
        HDR.appendChild(ZOOM);

        // Full Screen 토글(C23) — 공통 스위치(.u4a-switch = sap.m.Switch 대체, shell.css). ServerList
        //   사운드 설정 팝업과 동일 컴포넌트. 실제 동작(prevFullScreen) 배선은 ws_html5_ws20_prev.js.
        var TGL = document.createElement("label");
        TGL.id = "ws20PrevOffToggle";
        TGL.className = "u4a-switch";   // 공통 컴포넌트 그대로(체크리스트 F)
        TGL.title = "Full Screen";
        var TGLIN = document.createElement("input");
        TGLIN.type = "checkbox";
        TGLIN.id = "ws20PrevOffInput";
        var TGLSL = document.createElement("span");
        TGLSL.className = "u4a-switch__slider";
        TGL.appendChild(TGLIN);
        TGL.appendChild(TGLSL);
        HDR.appendChild(TGL);

        // 도움말 (자리만)
        HDR.appendChild(lf_hdrBtn("ws20PrevHelpBtn", _fa("circle-question"), "Help"));

        // 패널 좁아지면 우측 컨트롤(⟳/줌/OFF/?)이 잘려 사라지지 않도록 ⋯ 오버플로 메뉴로 접는다
        //   (트리 툴바와 동일 — U4AUI.attachOverflow). 스페이서만 isSkip, 우측정렬이라 noOvfAutoMargin.
        try {
            if (window.U4AUI && U4AUI.attachOverflow) {
                var oOvfCtl = U4AUI.attachOverflow(HDR, {
                    noOvfAutoMargin: true,
                    isSkip: function (el) { return el.classList.contains("u4aWs20PanelHdrSpacer"); },
                    isSep: function () { return false; },
                    btnClass: "u4aWs20PanelHdrBtn",
                    btnHtml: '<i class="fa-solid fa-ellipsis"></i>',
                    menuItem: function (el) {
                        var oI = el.querySelector("i");
                        var bDis = el.disabled === true || el.classList.contains("is-disabled");
                        // 줌 슬라이더(range)는 메뉴 항목 안에 슬라이더를 그대로 그린다(원본 OverflowToolbar
                        //   동일). 메뉴용 슬라이더는 원본 값으로 초기화하고, input 시 원본 el 에 값을 반영 +
                        //   change 발화해 기존 핸들러(prev.js)의 setPreviewZoom 을 그대로 탄다.
                        if (el.id === "ws20PrevZoomSlider") {
                            var oRow = document.createElement("div");
                            oRow.className = "u4aWs20PrevZoomMenuRow";
                            oRow.innerHTML = _fa("magnifying-glass");
                            var oS = document.createElement("input");
                            oS.type = "range";
                            oS.className = "u4aWs20PrevZoom";
                            oS.min = el.min || "0.1"; oS.max = el.max || "2";
                            oS.step = el.step || "0.1"; oS.value = el.value || "1";
                            oS.disabled = bDis;
                            oS.title = "Zoom";
                            oS.addEventListener("input", function () {
                                el.value = oS.value;
                                el.dispatchEvent(new Event("change", { bubbles: true }));
                            });
                            oRow.appendChild(oS);
                            return { node: oRow };
                        }
                        var sIcon, sText;
                        if (el.id === "ws20PrevOffToggle") { sIcon = _fa("toggle-off"); sText = el.title || "Full Screen"; }
                        else { sIcon = oI ? oI.outerHTML : ""; sText = el.title || (window.U4AUI && U4AUI.btnLabel ? U4AUI.btnLabel(el, true) : "") || ""; }
                        return { iconHtml: sIcon, text: sText, disabled: bDis, onClick: function () { if (!bDis) { el.click(); } } };
                    }
                });
                // ★ 초기 reflow 명시 호출 — 헤더 폭이 "확정된 뒤" 측정한다.
                //   (ResizeObserver 초기 콜백이 배치 전 0/좁은 폭에서 한 번 돌고 안 다시 돌면, 공간이
                //    충분해도 ⋯ 가 떠버린다. 트리 툴바가 fnRenderDesignTree 에서 reflow 부르는 것과 동일 보강.)
                //   폭이 0 이면(아직 미배치/숨김) 프레임마다 최대 N회 재시도 후 폭이 잡히면 reflow.
                if (oOvfCtl && typeof oOvfCtl.reflow === "function" && typeof requestAnimationFrame === "function") {
                    (function _tryReflow(n) {
                        if (HDR.clientWidth > 0) { try { oOvfCtl.reflow(); } catch (e) { } return; }
                        if (n > 0) { requestAnimationFrame(function () { _tryReflow(n - 1); }); }
                    })(30);
                }
            }
        } catch (e) { console.warn("[HTML5][WS20] preview header overflow attach 실패:", e && e.message); }

        return HDR;

    } // end of _buildPrevHeader

    // 패널 1개(빈 컨테이너 + 라벨)
    function _buildPanel(sId, sCls, sLabel) {

        var P = document.createElement("div");
        P.id = sId;
        P.className = "u4aWs20Panel " + sCls;

        // 빈 콘텐츠 컨테이너 (다음 단계에서 실제 트리/미리보기/속성이 들어갈 자리)
        var BODY = document.createElement("div");
        BODY.className = "u4aWs20PanelBody";

        var LBL = document.createElement("div");
        LBL.className = "u4aWs20PanelLabel";
        LBL.textContent = sLabel;
        BODY.appendChild(LBL);

        P.appendChild(BODY);
        return P;

    } // end of _buildPanel

    // 드래그 리사이저 바 (구 Splitter 의 바)
    function _buildResizer(sSide) {
        var R = document.createElement("div");
        // 공통 스플릿바 스킨(.u4a-splitter__bar = 서버리스트 기준 그립) 소비. 드래그/바폭합산은
        // 자체 클래스(.u4aWs20Resizer)로 JS 훅 유지. 카드 레이아웃이라 바 배경/경계는 CSS 에서 중립화.
        R.className = "u4aWs20Resizer u4aWs20Resizer-" + sSide + " u4a-splitter__bar";
        return R;
    }

    /************************************************************************
     * give-way 리사이저 (기본 레이아웃[tree·preview·attr] 전용) — 사용자 선호 거동.
     *   바를 끌면 대상(self) 패널이 커지고, 슬랙은 ① 가운데(preview)가 먼저 흡수(min 까지),
     *   ② 가운데가 min 에 닿으면 그 다음 "반대편 패널"이 **자기 min-width 까지** 양보한다.
     *   셋 다 min 이 되면 hard stop → 합이 항상 컨테이너 이내라 가로 스크롤/overflow 없음.
     *
     *   ★ 버그 수정: 구버전은 self/opp 를 `0 1`(shrink=1)+CSS min 96 으로 둬서, 브라우저 flex
     *     축소가 JS 가 정한 폭을 덮어 **반대편 패널이 min(300) 밑(=96)까지 빨려들어갔다**.
     *     → `0 0`(shrink=0, JS 가 단일 출처) + **단일 min-width(CSS) 클램프**로 교정.
     *   (preview 가 가운데가 아닌 재정렬 레이아웃은 give-way 전제가 깨지므로 _bindResizerSimple 사용.)
     ************************************************************************/
    function _bindResizer(oBar, oPanel, oSplit, sSide) {
        var bDragging = false, iStartX = 0, iStartW = 0;

        function lf_opp() {   // 반대편 '고정' 패널(트리/속성 중 oPanel 아닌 쪽) — 패널 순서 무관
            return oSplit.querySelector(oPanel.classList.contains("u4aWsDesignTree") ? ".u4aWsDesignAttr" : ".u4aWsDesignTree");
        }
        function lf_center() { return oSplit.querySelector(".u4aWsDesignPreview"); }

        function lf_onMove(e) {
            if (!bDragging) { return; }
            var oOpp = lf_opp(), oCenter = lf_center();
            if (!oOpp) { return; }

            var iCenterMin = oCenter ? _ws20PaneMin(oCenter) : 200;
            var iSelfMin = _ws20PaneMin(oPanel), iOppMin = _ws20PaneMin(oOpp);
            var iTotal = oSplit.clientWidth - _ws20BarsW(oSplit);

            var iDelta = e.clientX - iStartX;
            // 좌측 바는 +delta(우로 끌면 self 확대), 우측 바는 -delta(좌로 끌면 self 확대)
            var iSelf = (sSide === "left") ? (iStartW + iDelta) : (iStartW - iDelta);

            // self 상한 = 가운데·반대편이 모두 min 일 때 (그 이상은 hard stop)
            var iSelfMax = iTotal - iCenterMin - iOppMin;
            if (iSelf > iSelfMax) { iSelf = iSelfMax; }
            if (iSelf < iSelfMin) { iSelf = iSelfMin; }

            // 반대편 폭: 가운데가 min 보다 더 줄어야 할 때만 양보(자기 min 까지), 아니면 현재폭 유지
            var iOpp = oOpp.getBoundingClientRect().width;
            if (iTotal - iSelf - iOpp < iCenterMin) {
                iOpp = iTotal - iSelf - iCenterMin;
                if (iOpp < iOppMin) { iOpp = iOppMin; }
            }

            // self·opp 는 0 0(JS 단일 출처), 가운데(preview)는 1 1 auto 라 나머지를 자동 흡수
            oPanel.style.flex = "0 0 " + iSelf + "px";
            oOpp.style.flex = "0 0 " + iOpp + "px";
        }
        function lf_onUp() {
            if (!bDragging) { return; }
            bDragging = false;
            document.body.classList.remove("u4aWs20ResizingCursor");
            document.removeEventListener("mousemove", lf_onMove);
            document.removeEventListener("mouseup", lf_onUp);
        }
        oBar.addEventListener("mousedown", function (e) {
            bDragging = true;
            iStartX = e.clientX;
            iStartW = oPanel.getBoundingClientRect().width;
            document.body.classList.add("u4aWs20ResizingCursor");
            document.addEventListener("mousemove", lf_onMove);
            document.addEventListener("mouseup", lf_onUp);
            e.preventDefault();
        });
    } // end of _bindResizer

    /************************************************************************
     * WS20 셸 렌더 (1회) — #WS20 컨테이너에 [툴바 + 3분할] 을 그린다.
     *   - 앱 데이터(로그인/모델)에 의존하지 않는 빈 골격.
     *   - 이미 렌더되었으면 재실행하지 않음(data-ws20-shell 플래그).
     *   - shell 의 placeholder("변환 예정") 가 먼저 들어가 있으면 제거.
     ************************************************************************/
    oAPP.fn.fnRenderWs20Shell = function () {

        var oUi = oAPP.attr.ui || {};
        var oPages = oUi.pages || {};
        var oWS20 = (oPages && oPages.WS20) || document.getElementById("WS20");

        if (!oWS20) {
            console.warn("[HTML5][WS20] #WS20 container not found — shell 미초기화");
            return;
        }

        // 이미 셸이 렌더되어 있으면 스킵 (앱 헤더 텍스트만 최신값으로 갱신)
        if (oWS20.getAttribute("data-ws20-shell") === "X") {
            try { oAPP.fn.fnUpdateWs20AppHeader(); } catch (e) { }
            return;
        }

        // shell 의 placeholder("변환 예정") 안내 DOM 제거 후 셸로 교체
        oWS20.innerHTML = "";
        oWS20.removeAttribute("data-placeholder-shown");

        // 페이지 내부 래퍼 (구 sap.m.Page("WS20_MAIN") customHeader + content)
        var MAIN = document.createElement("div");
        MAIN.id = "WS20_MAIN";
        MAIN.className = "u4aWs20MainPage";

        // (공통) 윈도우 메뉴바 + 공통 헤더 (Style Class/Utilities/Edit/System/Help/Test
        //   + AI/eye/테마/T-CODE/power). WS10 과 동일 컴포넌트(ws10_html.js buildMenubar) 공유.
        try {
            if (oAPP.ws10html && typeof oAPP.ws10html.buildMenubar === "function") {
                MAIN.appendChild(oAPP.ws10html.buildMenubar(_getWindowMenuWS20(), _ws20MenuSelect));
            }
        } catch (e) { console.warn("[HTML5][WS20] menubar build error:", e && e.message); }

        // (A0) 앱 헤더 줄 (← APPID Change Active ... 🔍 ⤓) — 툴바 위
        MAIN.appendChild(_buildWs20AppHeader());

        // (A) 상단 트랜잭션 툴바 (구 customHeader: OverflowToolbar)
        MAIN.appendChild(_buildWs20Toolbar());

        // (B) 좌측 사이드 레일(구 ToolPage sideContent=SideNavigation) + 3분할 (구 designSplit)
        var SPLITROW = document.createElement("div");
        SPLITROW.className = "u4aWs20SplitRow";
        SPLITROW.appendChild(_buildWs20Side());
        SPLITROW.appendChild(_buildWs20Split());
        MAIN.appendChild(SPLITROW);

        // (C) 플로팅 푸터 메시지 (구 floatingFooter /FMSG/WS20)
        MAIN.appendChild(_buildWs20Footer());

        oWS20.appendChild(MAIN);
        oWS20.setAttribute("data-ws20-shell", "X");

        // 앱 헤더 텍스트 채움 (APPID / 모드 / 상태)
        try { oAPP.fn.fnUpdateWs20AppHeader(); } catch (e) { }

        // 렌더 "전"에 설정된 /FMSG/WS20 메시지 리플레이 — Change 모드 lock 메시지는
        // fnOnEnterDispChangeMode 가 fnOnMoveToPage(→렌더) 보다 먼저 호출하므로,
        // 푸터 DOM 생성 직후 모델에 남은 메시지를 표시한다.
        try {
            var oFMsg = APPCOMMON.fnGetModelProperty("/FMSG/WS20");
            if (oFMsg && oFMsg.ISSHOW) { oAPP.ws20html.showFooter(oFMsg.TYPE || "I", oFMsg.TXT || ""); }
        } catch (e) { }

        // 내부 참조 보관(추후 단계에서 패널 접근용)
        oAPP.attr.ui = oAPP.attr.ui || {};
        oAPP.attr.ui.ws20 = {
            main: MAIN,
            tree: document.getElementById("ws20DesignTree"),
            preview: document.getElementById("ws20DesignPreview"),
            attr: document.getElementById("ws20DesignAttr")
        };

    }; // end of oAPP.fn.fnRenderWs20Shell

    /************************************************************************
     * [OVERRIDE] WS20 진입 (구 oAPP.fn.fnMoveToWs20 [ws_fn_02.js])
     * ---------------------------------------------------------------------
     *  원본은 sap.ui.getCore().byId("WS20_MAIN") 조회 → oAPP.fn.main()(디자인 영역) 호출.
     *  W1 단계에선 디자인 영역(트리/미리보기/속성)을 만들지 않으므로,
     *  여기서는 WS20 셸(툴바+3분할)을 렌더하기만 한다.
     *  (실제 편집 영역 구성은 W2~W4 단계에서 본 override 를 확장/교체)
     ************************************************************************/
    oAPP.fn.fnMoveToWs20 = function () {
        try {
            // 셸(툴바+3분할) 렌더. (W3 override 가 좌측 트리 컨테이너에 빈 HTML5 트리까지 렌더)
            oAPP.fn.fnRenderWs20Shell();
        } catch (e) {
            console.warn("[HTML5][WS20] fnMoveToWs20 render error:", e && e.message);
        }

        // [문서 4장] WS20 진입 시작점 = setUIAreaEditable. (원본 fnMoveToWs20 633/647행)
        //  (4.1) 변경 없는 Display 전환 → 재조회 없음 / (4.2) LIB 有 → getAppData /
        //  (4.3) LIB 無 → LIB 6테이블 → S_CODE → getAppData → … → loadPreviewFrame.
        //  서버 미연결/비로그인이면 내부에서 안전하게 빈 트리 유지(크래시 없음).
        try {
            if (typeof oAPP.fn.setUIAreaEditable === "function") {
                oAPP.fn.setUIAreaEditable();
            } else if (typeof oAPP.fn.fnLoadWs20TreeData === "function") {
                // (폴백 — W3.5 데이터 파일 미로드 시)
                oAPP.fn.fnLoadWs20TreeData();
            }
        } catch (e) {
            console.warn("[HTML5][WS20] setUIAreaEditable error:", e && e.message);
        }
    }; // end of oAPP.fn.fnMoveToWs20

    /************************************************************************
     * [OVERRIDE] 페이지 이동 (구 oAPP.fn.fnOnMoveToPage)
     * ---------------------------------------------------------------------
     *  shell(ws_html5_shell.js) 의 fnOnMoveToPage 는 WS20 이동 시 "변환 예정"
     *  placeholder 를 띄운다. 이를 감싸서(super 호출 후) WS20 일 때 placeholder 대신
     *  WS20 셸을 렌더한다.
     *
     *  - WS30 등 다른 페이지 흐름/부수효과는 원본(shell) 그대로 위임.
     *  - parent.setCurrPage / busy 해제 등은 super 가 수행하므로 중복 처리하지 않음.
     ************************************************************************/
    var _fnOnMoveToPage_super = oAPP.fn.fnOnMoveToPage;

    oAPP.fn.fnOnMoveToPage = function (sPgNm) {

        // 원본(shell) 흐름 그대로 수행 (페이지 전환 + parent.setCurrPage + busy 해제 등)
        if (typeof _fnOnMoveToPage_super === "function") {
            _fnOnMoveToPage_super(sPgNm);
        }

        // WS20 이동 시: placeholder 대신 셸 렌더
        if (sPgNm === "WS20") {
            try {
                oAPP.fn.fnRenderWs20Shell();
            } catch (e) {
                console.warn("[HTML5][WS20] fnOnMoveToPage(WS20) render error:", e && e.message);
            }

            // [문서 4장] WS20 진입 시작점 = setUIAreaEditable.
            //  실제 WS20 진입(fnOnEnterDispChangeMode→fnOnMoveToPage("WS20"))은 이 경로를 탄다.
            //  (4.1) 변경 없는 Display 전환 → 재조회 없음 / (4.2) LIB 有 → getAppData /
            //  (4.3) LIB 無 → LIB 6테이블 → S_CODE → getAppData → … → loadPreviewFrame.
            //  서버 미연결/비로그인이면 내부에서 안전하게 빈 트리 유지(크래시 없음).
            try {
                if (typeof oAPP.fn.setUIAreaEditable === "function") {
                    oAPP.fn.setUIAreaEditable();
                } else if (typeof oAPP.fn.fnLoadWs20TreeData === "function") {
                    // (폴백 — W3.5 데이터 파일 미로드 시)
                    oAPP.fn.fnLoadWs20TreeData();
                }
            } catch (e) {
                console.warn("[HTML5][WS20] setUIAreaEditable error:", e && e.message);
            }
        }

    }; // end of oAPP.fn.fnOnMoveToPage

    /************************************************************************
     * [OVERRIDE] WS20 Change 모드 전환 (구 oAPP.fn.fnSetAppChangeMode [ws_fn_02.js 976행])
     * ---------------------------------------------------------------------
     *  ev_pressDisplayModeBtn(Display→Change) 가 호출. 원본 1:1 이식이며
     *  UI5 의존부만 대체한다(서버 호출 ajax_init_prc / setAppInfo / IPC 는 보존):
     *   · sap.ui.getCore().lock()/unlock() → oAPP.common.fnSetBusyLock
     *     (※ 원본 ws_fn_02.js 는 호스트에 UI5 가 없어 bare `sap` ReferenceError
     *        → Critical 다이얼로그의 직접 원인이었음)
     *   · setUIAreaEditable() → HTML5 구현(ws_html5_ws20_data.js, 문서 4장)
     ************************************************************************/
    oAPP.fn.fnSetAppChangeMode = function () {

        // 화면 Lock 걸기 (구 sap.ui.getCore().lock())
        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage();

        var oFormData = new FormData();
        oFormData.append("APPID", oAppInfo.APPID);
        oFormData.append("ISEDIT", "X");

        // 서버에서 App 정보를 구한다. (원본 1:1)
        ajax_init_prc(oFormData, lf_success);

        function lf_success(oAppInfo) {

            if (oAppInfo.IS_EDIT != "X") {

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, oAppInfo.MESSAGE);

                // 화면 Lock 해제 (구 sap.ui.getCore().unlock())
                oAPP.common.fnSetBusyLock("");

                parent.setBusy("");

                return;

            }

            // App 정보 갱신
            parent.setAppInfo(oAppInfo);

            APPCOMMON.fnSetModelProperty("/WS20/APP", oAppInfo);

            // 현재 떠있는 Electron Browser들 전체 닫는 function (원본 1:1 — 가드)
            try { oAPP.fn.fnChildWindowClose(); } catch (e) { }

            // Change Mode 모드로 변환 (문서 4장 — setUIAreaEditable 시작점.
            //  busy 는 이후 getAppData(fnLoadWs20TreeData) 완료 시점에 해제됨)
            oAPP.fn.setUIAreaEditable();

            // [HTML5] 앱 헤더(모드 표기) 갱신
            try { oAPP.fn.fnUpdateWs20AppHeader(); } catch (e) { }

            // 푸터 메시지 처리
            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "020"); // Switch to edit mode.

            APPCOMMON.fnShowFloatingFooterMsg("S", sCurrPage, sMsg);

            // 앱 모드 전환 시 ipc의 command 이벤트 전송 (원본 1:1 — 가드)
            try {
                var oIpcHandler = new parent.CLIpcHandler();
                oIpcHandler.command("appModeChange", {
                    fromPage: parent.getCurrPage(),
                    browserKey: parent.getBrowserKey(),
                    IS_EDIT: "X"
                });
            } catch (e) { }

        }

    }; // end of oAPP.fn.fnSetAppChangeMode

    /************************************************************************
     * [OVERRIDE] WS20 Display 모드 전환 (구 oAPP.fn.fnSetAppDisplayMode [ws_fn_02.js 1052행])
     * ---------------------------------------------------------------------
     *  ev_pressDisplayModeBtn(Change→Display, 변경 없음) 가 호출. 원본 1:1 이식,
     *  UI5 의존부만 대체(서버 호출 ajax_unlock_app / setAppInfo / IPC / UAI 보존):
     *   · showMessage(sap, 20, …) → showMessage(null, 99, …) (Electron 네이티브)
     *   · sap.ui.getCore().unlock() → oAPP.common.fnSetBusyLock("")
     *   · setUIAreaEditable(IS_CHAG) → HTML5 구현(문서 4.1 — 변경 없으면
     *     서버 재조회 없이 Display 전환)
     ************************************************************************/
    oAPP.fn.fnSetAppDisplayMode = function () {

        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage();

        var oParams = {
            APPID: oAppInfo.APPID
        };

        // Lock을 해제한다. (원본 1:1)
        ajax_unlock_app(oParams, lf_success);

        async function lf_success(RETURN) {

            if (RETURN.RTCOD === "E") {

                try { parent.setSoundMsg("02"); } catch (e) { } // error sound

                // 작업표시줄 깜빡임 (구 CURRWIN.flashFrame)
                try { parent.REMOTE.getCurrentWindow().flashFrame(true); } catch (e) { }

                // 크리티컬 오류 처리 (구 showMessage(sap, 20, …, fnCriticalError)
                //  → Electron 네이티브 KIND 99. ※ KIND 99 는 콜백 미지원 — 기존
                //  변환 전례(ws_common.js sendAjax _onError)와 동일하게 전달만 함)
                try {
                    parent.showMessage(null, 99, "E", RETURN.RTMSG,
                        (typeof fnCriticalError === "function") ? fnCriticalError : undefined);
                } catch (e) { }

                // 화면 Lock 해제 (구 sap.ui.getCore().unlock())
                oAPP.common.fnSetBusyLock("");

                parent.setBusy("");

                return;
            }

            RETURN.IS_EDIT = ""; // Display Mode FLAG
            RETURN.IS_CHAG = "";

            parent.setAppInfo(RETURN); // Application 정보 갱신

            APPCOMMON.fnSetModelProperty("/WS20/APP", RETURN); // 모델 정보 갱신

            // 현재 떠있는 Electron Browser들 전체 닫는 function (원본 1:1 — 가드)
            try { oAPP.fn.fnChildWindowClose(); } catch (e) { }

            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "029"); // Switch to display mode.

            // 푸터 메시지 처리
            APPCOMMON.fnShowFloatingFooterMsg("S", sCurrPage, sMsg);

            // Display 모드로 변환 (문서 4.1 — 변경 없으면 서버 재조회 없이 전환)
            oAPP.fn.setUIAreaEditable(oAppInfo.IS_CHAG);

            // [HTML5] 앱 헤더(모드 표기) 갱신
            try { oAPP.fn.fnUpdateWs20AppHeader(); } catch (e) { }

            // AI 서버 연결되어있을 경우 연결 해제 하기 (원본 1:1 — 가드)
            try {
                await parent.UAI.disconnect({ CONID: parent.getBrowserKey() });
            } catch (e) { }

            // 앱 모드 전환 시 ipc의 command 이벤트 전송 (원본 1:1 — 가드)
            try {
                var oIpcHandler = new parent.CLIpcHandler();
                oIpcHandler.command("appModeChange", {
                    fromPage: parent.getCurrPage(),
                    browserKey: parent.getBrowserKey(),
                    IS_EDIT: ""
                });
            } catch (e) { }

            // busy/Lock 정리 (4.1 경로는 setUIAreaEditable 이 setBusy("")까지 수행)
            oAPP.common.fnSetBusyLock("");

        }

    }; // end of oAPP.fn.fnSetAppDisplayMode

})(window, (window.jQuery || window.$), oAPP);
