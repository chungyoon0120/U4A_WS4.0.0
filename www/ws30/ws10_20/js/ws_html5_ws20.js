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

    /************************************************************************
     * WS20 윈도우 메뉴 데이터 (구 fnGetWindowMenuListWS20 / fnGetWindowMenuWS20 미러)
     *   sap-icon → FontAwesome 매핑. ws10_html.js 의 공유 buildMenubar 가 소비.
     ************************************************************************/
    function _getWindowMenuWS20() {
        return [
            { key: "WMENU10", text: "Style Class", items: [
                { key: "WMENU10_01", icon: "palette", text: "Theme Designer", disabled: true },
                { key: "WMENU10_02", icon: "bold", text: "Font Style Wizard" },
                { key: "WMENU10_03", icon: "pen-ruler", text: "UI5 Predefined CSS" }
            ] },
            { key: "WMENU20", text: "Utilities", items: [
                { key: "WMENU20_01", icon: "globe", text: "Select Browser Type" },
                { key: "WMENU20_02", icon: "language", text: "OTR Manager" },
                { key: "WMENU20_03", icon: "video", text: "Screen Recording" },
                { key: "WMENU20_05", icon: "code", text: "Source Pattern" },
                { key: "WMENU20_04", icon: "icons", text: "Icon Viewer", items: [
                    { key: "WMENU20_04_01", icon: "icons", text: "Icon List" },
                    { key: "WMENU20_04_02", icon: "image", text: "Image Icons" }
                ] },
                { key: "WMENU20_06", icon: "code-branch", text: "Version Management" }
            ] },
            { key: "WMENU30", text: "Edit", items: [
                { key: "WMENU30_01", icon: "css3-alt", brand: true, text: "CSS Editor" },
                { key: "WMENU30_02", icon: "js", brand: true, text: "Javascript Editor" },
                { key: "WMENU30_03", icon: "html5", brand: true, text: "HTML Editor" },
                { key: "WMENU30_04", icon: "file-lines", text: "Error Page Editor" },
                { key: "WMENU30_05", icon: "sliders", text: "Skeleton Scr Setting" }
            ] },
            { key: "WMENU40", text: "System", items: [
                { key: "WMENU40_01", icon: "plus", text: "New Window" },
                { key: "WMENU40_02", icon: "xmark", text: "Close Window" },
                { key: "WMENU40_03", icon: "gear", text: "Options" },
                { key: "WMENU40_04", icon: "right-from-bracket", text: "Logoff" },
                { key: "WMENU40_06", icon: "user-gear", text: "Administrator", items: [
                    { key: "WMENU40_06_01", icon: "bug", text: "DevTool" },
                    { key: "WMENU40_06_02", icon: "note-sticky", text: "Release Note" },
                    { key: "WMENU40_06_03", icon: "triangle-exclamation", text: "Error Log" }
                ] },
                { key: "WMENU40_07", icon: "server", text: "Server Information" }
            ] },
            { key: "WMENU50", text: "Help", items: [
                { key: "WMENU50_01", icon: "book-open-reader", text: "U4A Help Document" },
                { key: "WMENU50_03", icon: "book", text: "Document" },
                { key: "WMENU50_04", icon: "keyboard", text: "Keyboard Shortcut List" }
            ] },
            { key: "Test20", text: "Test", staffOnly: true, items: [
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
     * 메시지 텍스트 안전 조회 (모델 미초기화/미로그인 상황에서도 폴백)
     *   원본은 APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A05") 형태.
     *   조회 실패 시 sFallback 사용.
     ************************************************************************/
    function _msg(sNum, sFallback) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "") { return s; }
        } catch (e) { }
        return sFallback;
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
                    console.warn("[HTML5][WS20] transaction action error (다음 단계 변환):", oCfg.ev, e && e.message);
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
     * WS20 플로팅 푸터 메시지 (구 sap.m.OverflowToolbar floatingFooter /FMSG/WS20)
     *   WS10 과 동일 컴포넌트(.u4a-ws10__footer) 재사용. Change 모드 lock/저장/
     *   활성화 등 WS20 메시지를 페이지 하단에 표시. (기존 소스의 푸터 메시지 로직)
     ************************************************************************/
    var _ws20FooterTimer = null;
    function _buildWs20Footer() {
        var F = document.createElement("div");
        F.className = "u4a-ws10__footer";
        F.id = "ws20Footer";
        F.setAttribute("data-show", "false");
        F.setAttribute("data-type", "I");
        F.innerHTML =
            '<span class="u4a-ws10__footer-icon">' + _fa("circle-info") + '</span>' +
            '<span class="u4a-ws10__footer-text"></span>' +
            '<button class="u4a-btn-icon u4a-ws10__footer-close" type="button" title="Close">' + _fa("xmark") + '</button>';
        F.querySelector(".u4a-ws10__footer-close").addEventListener("click", function () {
            oAPP.ws20html.hideFooter();
        });
        return F;
    }

    oAPP.ws20html = oAPP.ws20html || {};
    oAPP.ws20html.showFooter = function (sType, sMsg) {
        var oF = document.getElementById("ws20Footer");
        if (!oF) { return; }
        var map = { E: "circle-exclamation", S: "circle-check", W: "triangle-exclamation", I: "circle-info" };
        oF.setAttribute("data-type", sType || "I");
        oF.setAttribute("data-show", "true");
        oF.querySelector(".u4a-ws10__footer-icon").innerHTML = _fa(map[sType] || "circle-info");
        oF.querySelector(".u4a-ws10__footer-text").textContent = sMsg || "";
        if (_ws20FooterTimer) { clearTimeout(_ws20FooterTimer); }
        _ws20FooterTimer = setTimeout(oAPP.ws20html.hideFooter, 10000);
    };
    oAPP.ws20html.hideFooter = function () {
        var oF = document.getElementById("ws20Footer");
        if (oF) { oF.setAttribute("data-show", "false"); }
        if (_ws20FooterTimer) { clearTimeout(_ws20FooterTimer); _ws20FooterTimer = null; }
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
        var sDispChgTxt = _msg("A05", "Display") + " <--> " + _msg("A02", "Change") + " (Ctrl+F1)";

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
            { id: "syntaxCheckBtn", fa: "check-double", text: "", tooltip: _msg("B72", "Syntax Check") + " (Ctrl+F2)", ev: "ev_pressSyntaxCheckBtn" },
            // Activate (원본 activateBtn: icon activate, B73 + Ctrl+F3)
            { id: "activateBtn", fa: "bolt", text: "", tooltip: _msg("B73", "Activate") + " (Ctrl+F3)", ev: "ev_pressActivateBtn" },
            // Save (원본 saveBtn: icon save, A64 + Ctrl+S)
            { id: "saveBtn", fa: "floppy-disk", text: "", tooltip: _msg("A64", "Save") + " (Ctrl+S)", ev: "ev_pressSaveBtn" },
            { sep: true },
            // MIME Repository (원본 mimeBtn: icon picture, text A10)
            { id: "mimeBtn", fa: "image", text: _msg("A10", "MIME Repository"), tooltip: _msg("A10", "MIME Repository") + " (Ctrl+Shift+F12)", ev: "ev_pressMimeBtn" },
            // Controller (Class Builder) (원본 controllerBtn: icon developer-settings, text A11)
            { id: "controllerBtn", fa: "screwdriver-wrench", text: _msg("A11", "Controller (Class Builder)"), tooltip: _msg("C38", "Controller") + " (Ctrl+F12)", ev: "ev_pressControllerBtn" },
            // Application Execution 메뉴 버튼 (원본 ws20_appExecMenuBtn: split MenuButton, text A06)
            { id: "ws20_appExecMenuBtn", fa: "globe", text: _msg("A06", "Application Execution"), tooltip: _msg("A06", "Application Execution") + " (F8)", ev: "ev_pressAppExecBtn" },
            // App Multi Preview (원본 ws20_multiPrevBtn: icon desktop-mobile, text A08)
            { id: "ws20_multiPrevBtn", fa: "table-cells-large", text: _msg("A08", "App Multi Preview"), tooltip: _msg("A08", "App Multi Preview") + " (Ctrl+F5)", ev: "ev_pressMultiPrevBtn" },
            // Icon List (원본 iconListBtn: icon activity-items, text A12)
            { id: "iconListBtn", fa: "icons", text: _msg("A12", "Icon List"), tooltip: _msg("A12", "Icon List") + " (Ctrl+Shift+F10)", ev: "ev_pressIconListBtn" },
            // Add Event Method (원본 addEventBtn: icon touch, text A13)
            { id: "addEventBtn", fa: "hand-pointer", text: _msg("A13", "Add Event Method"), tooltip: _msg("A13", "Add Event Method") + " (Shift+F1)", ev: "ev_pressAddEventBtn" },
            // Runtime Class Navigator (원본 runtimeBtn: icon functional-location, text A14)
            { id: "runtimeBtn", fa: "diagram-project", text: _msg("A14", "Runtime Class Navigator"), tooltip: _msg("A14", "Runtime Class Navigator"), ev: "ev_pressRuntimeBtn" },
            // Binding Popup (원본 bindPopupBtn: icon connected, text A15)
            { id: "bindPopupBtn", fa: "link", text: _msg("A15", "Binding Popup"), tooltip: _msg("A15", "Binding Popup"), ev: "ev_pressBindPopupBtn" }
        ];

        aBtns.forEach(function (oCfg) {
            if (oCfg.sep) { BAR.appendChild(_sep(oCfg.sepId)); return; }
            BAR.appendChild(_txBtn(oCfg));
        });

        return BAR;

    } // end of _buildWs20Toolbar

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

    }; // end of oAPP.fn.fnUpdateWs20Toolbar

    /************************************************************************
     * (A0) WS20 앱 헤더 줄 — 원본 화면 상단의 [← APPID Change Active ... 🔍 ⤓]
     *   구성(좌→우): 뒤로가기(←) / APPID(굵게) / 모드(Change|Display) /
     *               상태(Active|Inactive) / 스페이서 / 우측 아이콘 2개(자리만)
     *   - 뒤로가기: 원본 oAPP.events.ev_pageBack (ws_events.js:1035) 호출 [가드]
     *   - 우측 아이콘 2개: 자리만(정적) — 클릭 시 console.warn 가드
     *   - 텍스트 값은 fnUpdateWs20AppHeader 가 채움 (재진입 시마다 갱신)
     ************************************************************************/
    function _appHdrIconBtn(sId, sGly, sTooltip) {
        var BTN = document.createElement("button");
        BTN.type = "button";
        BTN.id = sId;
        BTN.className = "u4aWs20AppHdrBtn";
        BTN.title = sTooltip || "";
        BTN.innerHTML = sGly; // FontAwesome 아이콘 HTML
        BTN.addEventListener("click", function () {
            try {
                console.warn("[HTML5][WS20] app header action not implemented (W2 예정):", sId);
            } catch (e) { }
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

        // 스페이서
        var SPC = document.createElement("span");
        SPC.className = "u4aWs20AppHdrSpacer";
        HDR.appendChild(SPC);

        // 우측 아이콘 버튼 2개 (구 ws20_findBtn / ws20_newWinBtn) — 자리만(정적), 클릭 가드
        HDR.appendChild(_appHdrIconBtn("ws20AppHeaderFindBtn", _fa("magnifying-glass"), "Find (Ctrl+F)"));
        HDR.appendChild(_appHdrIconBtn("ws20AppHeaderExportBtn", _fa("window-restore"), "New Window (Ctrl+N)"));

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

        // 모드 (IS_EDIT === "X" → Change, 그 외 Display)
        var sIsEdit = (oInfo && oInfo.IS_EDIT != null) ? oInfo.IS_EDIT : lf_model("/WS20/APP/IS_EDIT");
        if (elMode) { elMode.textContent = (sIsEdit === "X") ? "Change" : "Display"; }

        // 상태 (ACTST: "A" → Active, 그 외 값 → Inactive, 필드 없으면 빈값)
        var sActst = (oInfo && oInfo.ACTST != null) ? oInfo.ACTST : lf_model("/WS20/APP/ACTST");
        if (elStat) {
            elStat.textContent = (sActst == null || sActst === "")
                ? ""
                : (sActst === "A" ? "Active" : "Inactive");
        }

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

        // 좌: UI 트리 (구 designTree, 25%)
        var LEFT = _buildPanel("ws20DesignTree", "u4aWsDesignTree", "UI 트리 — W3 예정");
        LEFT.style.flex = "0 0 25%";   // 원본 size 25%
        LEFT.style.minWidth = "200px"; // 드래그 최소폭(give-way 시 반대편이 여기까지 양보)

        var BAR1 = _buildResizer("left");

        // 중: 미리보기 (구 designPreview, 나머지)
        var CENTER = _buildPanel("ws20DesignPreview", "u4aWsDesignPreview", "미리보기 — W2 예정");
        CENTER.style.flex = "1 1 auto"; // 가변
        CENTER.style.minWidth = "200px";

        // 미리보기 패널 헤더 줄 (Preview / ⟳ / 줌 슬라이더 / OFF / ?) — 정적, W2 예정
        CENTER.insertBefore(_buildPrevHeader(), CENTER.firstChild);

        var BAR2 = _buildResizer("right");

        // 우: 속성 (구 designAttr, 30%)
        var RIGHT = _buildPanel("ws20DesignAttr", "u4aWsDesignAttr", "속성 — W4 예정");
        RIGHT.style.flex = "0 0 30%";  // 원본 size 30%
        RIGHT.style.minWidth = "200px";// 드래그 최소폭(give-way 시 반대편이 여기까지 양보)

        // 속성 패널 본문 상단 "Properties" 섹션 바 (모양만 — W4 예정)
        var RBODY = RIGHT.querySelector(".u4aWs20PanelBody");
        if (RBODY) {
            var SEC = document.createElement("div");
            SEC.id = "ws20AttrSectionBar";
            SEC.className = "u4aWs20AttrSectionBar";
            SEC.textContent = "Properties";
            RBODY.insertBefore(SEC, RBODY.firstChild);
        }

        SPLIT.appendChild(LEFT);
        SPLIT.appendChild(BAR1);
        SPLIT.appendChild(CENTER);
        SPLIT.appendChild(BAR2);
        SPLIT.appendChild(RIGHT);

        // 드래그 리사이즈 연결
        _bindResizer(BAR1, LEFT, SPLIT, "left");
        _bindResizer(BAR2, RIGHT, SPLIT, "right");

        return SPLIT;

    } // end of _buildWs20Split

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

        // OFF 토글 모양 (정적/가드)
        var TGL = document.createElement("span");
        TGL.id = "ws20PrevOffToggle";
        TGL.className = "u4aWs20PrevToggle";
        TGL.textContent = "OFF";
        TGL.addEventListener("click", function () {
            try {
                console.warn("[HTML5][WS20] preview action not implemented (W2 예정): ws20PrevOffToggle");
            } catch (e) { }
        });
        HDR.appendChild(TGL);

        // 도움말 (자리만)
        HDR.appendChild(lf_hdrBtn("ws20PrevHelpBtn", _fa("circle-question"), "Help"));

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
        R.className = "u4aWs20Resizer u4aWs20Resizer-" + sSide;
        return R;
    }

    /************************************************************************
     * 드래그 리사이즈 바인딩
     *   sSide:
     *     "left"  → BAR1: 좌측(LEFT) 패널 폭을 조절
     *     "right" → BAR2: 우측(RIGHT) 패널 폭을 조절
     *   중앙(CENTER)은 flex:1 1 auto 로 자동 가변. minWidth 는 CSS/스타일이 보장.
     ************************************************************************/
    function _bindResizer(oBar, oPanel, oSplit, sSide) {

        var bDragging = false;
        var iStartX = 0;
        var iStartW = 0;

        // 각 영역 최소폭 (패널/가운데 미리보기 인라인 minWidth 와 일치)
        var iPanelMin = 200;  // 좌/우 패널 최소
        var iCenterMin = 200; // 가운데(가변) 미리보기 최소

        // 형제 요소 조회 헬퍼
        //   oCenter = 가변 가운데 패널, oOpp = 드래그 대상의 반대편 패널
        function lf_center() { return oSplit.querySelector(".u4aWsDesignPreview"); }
        function lf_opp() {
            // sSide "left" → oPanel=좌(트리), 반대=우(속성) / "right" → 반대=좌(트리)
            return oSplit.querySelector(sSide === "left" ? ".u4aWsDesignAttr" : ".u4aWsDesignTree");
        }
        // 리사이저 바 2개의 폭 합 (콘텐츠 가용폭 계산용)
        function lf_barsW() {
            var iW = 0;
            var aBars = oSplit.querySelectorAll(".u4aWs20Resizer");
            for (var i = 0; i < aBars.length; i++) { iW += aBars[i].getBoundingClientRect().width; }
            return iW;
        }

        // 드래그 이동:
        //   1) 커서를 따라 oPanel 폭(iSelf)을 잡는다.
        //   2) 슬랙(여유폭)은 먼저 "가운데"가 흡수(최소 iCenterMin 까지 줄어듦).
        //   3) 가운데가 최소에 닿으면 그 다음 "반대편 패널"이 양보(밀려남, 최소 iPanelMin 까지).
        //   4) 셋 다 최소가 됐을 때만 더 못 늘어남(hard stop) → 그 전까진 드래그가 계속 따라옴.
        //   합이 항상 컨테이너 이내라 가로 스크롤도 생기지 않는다.
        function lf_onMove(e) {
            if (!bDragging) { return; }

            var oOpp = lf_opp();
            if (!oOpp) { return; }

            var iDelta = e.clientX - iStartX;
            // 좌측 바는 +delta 로 넓어지고, 우측 바는 -delta 로 넓어진다.
            var iSelf = (sSide === "left") ? (iStartW + iDelta) : (iStartW - iDelta);

            // 콘텐츠 가용폭(= 전체폭 − 바 폭) 내에서 self/center/opp 가 나눠 가진다.
            var iTotal = oSplit.clientWidth - lf_barsW();
            var iSelfMax = iTotal - iCenterMin - iPanelMin; // 나머지 둘이 최소일 때의 self 한계
            if (iSelf < iPanelMin) { iSelf = iPanelMin; }
            if (iSelf > iSelfMax) { iSelf = iSelfMax; }

            // 반대편 폭: 가운데가 최소보다 더 줄어야 할 때만 양보(밀려남)
            var iOpp = oOpp.getBoundingClientRect().width;
            var iCenter = iTotal - iSelf - iOpp;
            if (iCenter < iCenterMin) {
                iOpp = iTotal - iSelf - iCenterMin;
                if (iOpp < iPanelMin) { iOpp = iPanelMin; }
            }

            // self 와 opp 만 명시(가운데는 flex:1 1 auto 라 나머지를 자동 흡수)
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

        // (B) 3분할 레이아웃 (구 designSplit)
        MAIN.appendChild(_buildWs20Split());

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
