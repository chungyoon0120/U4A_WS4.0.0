/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ws10_html.js
 * - file Desc : WS10 (애플리케이션 검색 / 홈) — HTML5 렌더러 (UI5 제거 1단계)
 * ----------------------------------------------------------------------
 * doc 03 §5 / §11(B) / §12 기반. ws_fn_01.js 의 UI5 WS10 렌더(fnOnInitRenderingWS10
 *   + 헤더/서브헤더/컨텐츠 빌더)를 대체한다.
 *
 *   · 1단계(현재): "UI5 로직 빼고 HTML 화면부터" — 셸 부팅(attachInit)은 유지하되
 *     fnOnInitRendering 이 이 파일의 oAPP.fn.fnRenderWs10Html() 을 호출해
 *     #content 에 순수 HTML5 WS10 화면을 그린다.
 *   · 메뉴/트랜잭션/검색의 실제 로직 연결(ev_AppCreate, fnHmws, F4, suggestion 등)은
 *     2단계에서 백업(_backup_ui5_*)을 참조해 순차적으로 붙인다. 현재는 안내 푸터로 가드.
 *   · 색/모양은 theme/tokens.css 의미 토큰만 소비, 전환은 U4ATheme.
 *
 * 셸 전역(메인 프레임): CURRWIN, parent.PATHINFO, parent.getThemeInfo 사용.
 ************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP = window.oAPP || {};
    oAPP.fn = oAPP.fn || {};
    oAPP.ws10html = oAPP.ws10html || {};

    /********************************************************************
     * 셸 자원 가드 (메인 프레임 전역 / 독립 미리보기 모두 대응)
     ********************************************************************/
    function _currWin() {
        try { if (typeof CURRWIN !== "undefined" && CURRWIN) { return CURRWIN; } } catch (e) { }
        try { if (parent && parent.CURRWIN) { return parent.CURRWIN; } } catch (e) { }
        try { if (parent && parent.REMOTE) { return parent.REMOTE.getCurrentWindow(); } } catch (e) { }
        return null;
    }

    function _logoUrl() {
        try {
            var p = (parent && parent.PATHINFO && parent.PATHINFO.WS_LOGO) || null;
            if (p) {
                var s = String(p).replaceAll("\\", "/");
                return encodeURI("file:///" + s);
            }
        } catch (e) { }
        return "../../img/logo.png";
    }

    function _savedTheme() {
        try {
            if (parent && parent.getThemeInfo) {
                var o = parent.getThemeInfo();
                if (o && o.THEME && window.U4ATheme) {
                    return window.U4ATheme.normalize(o.THEME);
                }
            }
        } catch (e) { }
        return null;
    }

    /********************************************************************
     * 상태 (UI5 /WS10·/UAI·/USERINFO 대체 — 1단계 경량)
     ********************************************************************/
    var WS_STATE = {
        WS10: { APPID: "", APPSUGG: [] },
        UAI: { state: false },
        USERINFO: { IS_DEV: "D" },
        IS_STAFF: true
    };
    oAPP.ws10html.state = WS_STATE;

    /********************************************************************
     * 라벨 메시지 — 언어는 "서버 메시지 클래스 단일 출처"에서만 가져온다.
     *   (★ 사용자 지시 2026-06-16: 언어작업을 내부 영문 사전으로 따로 관리 금지.
     *    원본과 동일하게 메시지 시스템만 사용 → 영문 하드코딩 사전 제거)
     *   · _txt(코드): A0x/B3x/C42 등 → /U4A/CL_WS_COMMON, M### → ZMSG_WS_COMMON_001 "번호".
     *   · _wsTxt(번호): ZMSG_WS_COMMON_001 직접 조회(예: Screen Recording=808).
     *   미조회 시 코드 자체를 반환(영문 번역을 내부 보관하지 않음 — 정상 로그인 흐름에선 항상 조회됨).
     ********************************************************************/
    function _txt(k) {
        // M### 키는 /U4A/CL_WS_COMMON 코드가 아니라 ZMSG_WS_COMMON_001 메시지 "번호"다
        //   (원본 ws_main.js: oAPP.msg.M068 = getWsMsgClsTxt(.., "ZMSG_WS_COMMON_001", "068")).
        //   예: M059=Source Pattern/M068=Icon Viewer/M047=Icon List/M067=Image Icons.
        if (/^M\d{3}$/.test(k)) {
            return _wsTxt(k.slice(1)) || k;
        }

        // 그 외 코드형 키(A0x/B3x/C42…) → /U4A/CL_WS_COMMON (= getUserInfo().LANGU = Workspace 언어)
        try {
            var oC = window.oAPP && window.oAPP.common;
            if (oC && oC.fnGetMsgClsText) {
                var s = oC.fnGetMsgClsText("/U4A/CL_WS_COMMON", k);
                if (s && s.indexOf("|") === -1) { return s; }
            }
        } catch (e) { }
        return k;
    }

    // ZMSG_WS_COMMON_001 메시지(Workspace 언어) — /U4A/CL_WS_COMMON 에 없는 항목용(예: Screen Recording=808).
    //   미조회 시 "" 반환(영문 폴백 보관 안 함). 호출부가 코드/빈값 처리.
    function _wsTxt(nr) {
        try {
            var lg = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(lg, "ZMSG_WS_COMMON_001", nr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return "";
    }

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid)
     ********************************************************************/
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };
    var ICON = {
        min: _fa("window-minimize"), max: _fa("window-maximize"), close: _fa("xmark"),
        disconnected: _fa("plug-circle-xmark"), connected: _fa("plug-circle-check"),
        eye: _fa("eye"), eyeSlash: _fa("eye-slash"), pin: _fa("thumbtack"),
        zoom: _fa("magnifying-glass-plus"), search: _fa("magnifying-glass"), power: _fa("power-off"),
        caret: _fa("chevron-down"), clear: _fa("xmark"), overflow: _fa("ellipsis")
    };

    /********************************************************************
     * 윈도우 메뉴 데이터 (doc 03 §4 / fnGetWindowMenuListWS10 미러)
     ********************************************************************/
    function _getWindowMenu() {
        return [
            {
                key: "WMENU10", text: _txt("B34"), items: [
                    { key: "WMENU10_01", icon: "arrows-rotate", text: _txt("B40") },
                    {
                        key: "WMENU10_02", icon: "right-left", text: _txt("B41"), items: [
                            { key: "WMENU10_02_01", icon: "file-import", text: _txt("B42") },
                            { key: "WMENU10_02_02", icon: "file-export", text: _txt("B43") }
                        ]
                    },
                    {
                        key: "WMENU10_04", icon: "share-from-square", text: _txt("B45"), items: [
                            { key: "WMENU10_04_01", icon: "bolt", text: _txt("B46") }
                        ]
                    },
                    { key: "WMENU10_05", icon: "circle-info", text: _txt("B48") }
                ]
            },
            {
                key: "WMENU20", text: _txt("B35"), items: [
                    { key: "WMENU20_01", icon: "globe", text: _txt("B49") },
                    { key: "WMENU20_03", icon: "video", text: _wsTxt("808") },
                    { key: "WMENU20_05", icon: "code", text: _txt("M059") },
                    {
                        key: "WMENU20_04", icon: "icons", text: _txt("M068"), items: [
                            { key: "WMENU20_04_01", icon: "icons", text: _txt("M047") },
                            { key: "WMENU20_04_02", icon: "image", text: _txt("M067") }
                        ]
                    }
                ]
            },
            {
                key: "WMENU30", text: _txt("B36"), items: [
                    { key: "WMENU30_01", icon: "plus", text: _txt("A09") },
                    { key: "WMENU30_02", icon: "xmark", text: _txt("B51") },
                    { key: "WMENU30_03", icon: "gear", text: _txt("B52") },
                    { key: "WMENU30_04", icon: "right-from-bracket", text: _txt("B53") },
                    {
                        key: "WMENU30_06", icon: "user-gear", text: _txt("B55"), items: [
                            { key: "WMENU30_06_01", icon: "bug", text: _txt("M252") },
                            { key: "WMENU30_06_02", icon: "note-sticky", text: _txt("B54") },
                            { key: "WMENU30_06_03", icon: "triangle-exclamation", text: _txt("B70") }
                        ]
                    },
                    { key: "WMENU30_07", icon: "server", text: _txt("C42") }
                ]
            },
            {
                key: "WMENU50", text: _txt("B39"), items: [
                    { key: "WMENU50_01", icon: "book-open-reader", text: _txt("B44") },
                    { key: "WMENU50_04", icon: "keyboard", text: _txt("M253") }
                ]
            },
            {
                key: "Test10", text: _txt("B69"), staffOnly: true, items: [
                    { key: "Test96", text: "USP 페이지 생성" },
                    { key: "Test90", text: "Busy 강제실행" },
                    { key: "Test99", text: "Busy 강제종료" },
                    { key: "Test98", text: "세션 끊기" },
                    { key: "Test97", text: "개발툴" },
                    { key: "Test94", text: "잘못된 서버 호출" },
                    { key: "Test86", text: "모나코 에디터 테마 디자이너" },
                    { key: "Test85", text: "모나코 에디터 스니펫 생성기" }
                ]
            }
        ];
    }

    function _getSubHeaderButtons() {
        return [
            { id: "appCreateBtn", icon: "file", text: _txt("A01"), sc: "Ctrl+F12", ev: "ev_AppCreate", devOnly: true },
            { id: "appChangeBtn", icon: "pen-to-square", text: _txt("A02"), sc: "F6", ev: "ev_AppChange", devOnly: true },
            { id: "appDelBtn", icon: "trash", text: _txt("A03"), sc: "Ctrl+F10", ev: "ev_AppDelete", devOnly: true, reject: true },
            { id: "appCopyBtn", icon: "copy", text: _txt("A04"), sc: "Shift+F11", ev: "ev_AppCopy", devOnly: true },
            { sep: true, devOnly: true },
            { id: "displayBtn", icon: "display", text: _txt("A05"), sc: "F7", ev: "ev_AppDisplay" },
            { id: "appExecMenuBtn", icon: "globe", text: _txt("A06"), sc: "F8", ev: "ev_AppExec", split: true },
            { sep: true },
            { id: "examBtn", icon: "graduation-cap", text: _txt("A07"), sc: "Ctrl+F1", ev: "ev_AppExam" },
            { id: "multiPrevBtn", icon: "table-cells-large", text: _txt("A08"), sc: "Ctrl+F3", ev: "ev_MultiPrev" },
            { sep: true },
            { id: "newWindowBtn", icon: "window-restore", text: _txt("A09"), sc: "Ctrl+N", ev: "ev_NewWindow" }
        ];
    }

    var APP_EXEC_BROWSERS = [
        { key: "CHROME", text: "Chrome", icon: "chrome", brand: true },
        { key: "MSEDGE", text: "Edge", icon: "edge", brand: true }
    ];

    // [WS20 와 동작 통일] App 실행 분할버튼 — 정적 Chrome/Edge 대신 실제 설치 브라우저(/DEFBR)를
    //   동적 표시하고, 선택 브라우저로 실제 실행(구 ws_html5_ws20.js _buildAppExecMenuItems 대응).
    var APPEXEC_BR_ICON = { CHROME: { icon: "chrome", brand: true }, MSEDGE: { icon: "edge", brand: true }, DEV_BROWSER: { icon: "flask", brand: false } };
    function _getAppExecBrowsers() {
        var aDef = [];
        try { aDef = oAPP.common.fnGetModelProperty("/DEFBR") || []; } catch (e) { }
        if (!Array.isArray(aDef) || !aDef.length) { return APP_EXEC_BROWSERS.slice(); } // /DEFBR 미로드 시 폴백
        var bPackaged = false; try { bPackaged = !!(parent.APP && parent.APP.isPackaged); } catch (e) { }
        return aDef.map(function (o) {
            var ic = APPEXEC_BR_ICON[o.NAME] || {};
            var en = !(!o.NAME || o.ENABLED === false);
            if (o.NAME === "DEV_BROWSER" && bPackaged) { en = false; }
            return { key: o.NAME, text: o.DESC || o.NAME, icon: ic.icon, brand: ic.brand, disabled: !en };
        });
    }
    // 선택 브라우저로 실행 (WS10 = AppNmInput 의 앱).
    //   ★ 메인 ev_AppExec(SELECTED 브라우저 + 저장된 APP_MODE)이 아니라, 원본 WS20
    //     ev_pressAppExecBtnByBrowser 와 동일하게 "선택 브라우저 + APP_MODE:false" 로 실행하는
    //     ev_AppExecByBrowser(ws_events.js)를 호출한다. (SELECTED 만 바꿔 ev_AppExec 를 타면
    //      fnLaunchBrowser 가 fnOnP13nExeDefaultBrowser 로 /DEFBR 을 재적재해 선택이 무시되고
    //      저장된 APP_MODE 로 앱모드 실행되던 회귀 수정.)
    function _execAppInBrowser(sName) {
        if (window.oAPP && oAPP.events && typeof oAPP.events.ev_AppExecByBrowser === "function") {
            try { oAPP.events.ev_AppExecByBrowser(sName); }
            catch (e) {
                if (typeof console !== "undefined") { console.warn("[WS10] ev_AppExecByBrowser error", e); }
                _showFooter("E", "Application Execution 오류: " + (e && e.message));
            }
            return;
        }
        // 핸들러 미로드 폴백 — 안내만(구 SELECTED+ev_AppExec 우회는 앱모드 회귀라 사용 안 함).
        _showFooter("I", "Application Execution — 로직 연결 진행 중");
    }
    // (구 _openAppExecBrowserMenu 제거 — 공통 buildSplitButton 에 흡수)

    var THEMES = [
        { key: "horizon_white", text: "Horizon White" },
        { key: "horizon_dark", text: "Horizon Dark" },
        { key: "horizon_purple", text: "Horizon Purple" },
        { key: "horizon_red", text: "Horizon Red" },
        { key: "horizon_green", text: "Horizon Green" }
    ];

    /********************************************************************
     * 액션 라우터
     *   · _callReal: 셸의 실제 핸들러(oAPP.fn[name])를 호출. 없으면 false.
     *   · 윈도우 메뉴(fnWS10WMENU*) / 전원(로그오프)은 실제 연결(S1).
     *   · 트랜잭션(ev_App*: AppNmInput/WS20 의존)은 아직 안내 푸터(다음 슬라이스).
     ********************************************************************/
    function _callReal(sFnName, sLabel) {
        try {
            var fn = window.oAPP && oAPP.fn && oAPP.fn[sFnName];
            if (typeof fn === "function") { fn(); return true; }
        } catch (e) {
            if (typeof console !== "undefined") { console.warn("[WS10] " + sFnName + " error", e); }
            _showFooter("E", (sLabel || sFnName) + " 오류: " + (e && e.message));
            return true;
        }
        return false;
    }
    // WS20 진입을 위해 실제 핸들러에 연결된 트랜잭션 이벤트(ws_html5_shell.js override).
    //   Display(F7/Enter/버튼) / Change(F6/버튼) → ev_AppDisplay/ev_AppChange →
    //   fnOnEnterDispChangeMode(서버조회) → fnOnMoveToPage("WS20") → WS20 렌더.
    //   ev_NewWindow(New Window/Ctrl+N) → parent.onNewWindow()(메인프레임 새 창 — Electron,
    //   sap 무관). ws_events.js 의 원본 핸들러 그대로 호출.
    //   Create(Ctrl+F12/버튼) → ev_AppCreate → 이름검증·존재확인 후 HTML5 생성 팝업
    //   (design/js/createApplicationPopup.js). ws_html5_shell.js override 참조.
    //   App Multi Preview(Ctrl+F3/버튼) → ev_MultiPrev → 이름검증·존재확인(fnCheckAppExists) 후
    //   fnOnExecApp(appid, true)(멀티프리뷰 URL /zu4a_imp/ui5multipreview 브라우저 실행 — Electron, sap 무관).
    //   ev_MultiPrev 핸들러는 이미 fnGetWs10AppInputDom(DOM) 사용 = HTML5-aware.
    //   Example Open(Ctrl+F1/버튼) → ev_AppExam → busy/lock(fnSetBusyLock 셸 오버라이드=parent.setBusy)
    //   + 자식창 BUSY_ON 브로드캐스트 후 fnExternalOpen 으로 샘플 URL(/zu4a_imp/u4a_samples) 모달 브라우저 실행.
    //   입력값 검증 없이 항상 동작(원본과 동일), sap 참조 없음.
    var WIRED_EVENTS = { ev_AppCreate: 1, ev_AppChange: 1, ev_AppDelete: 1, ev_AppDisplay: 1, ev_NewWindow: 1, ev_AppExec: 1, ev_AppCopy: 1, ev_MultiPrev: 1, ev_AppExam: 1, ev_AppValueHelp: 1 };
    function _invoke(sName, sLabel) {
        if (WIRED_EVENTS[sName] && window.oAPP && oAPP.events && typeof oAPP.events[sName] === "function") {
            try { oAPP.events[sName](); }
            catch (e) {
                if (typeof console !== "undefined") { console.warn("[WS10] " + sName + " error", e); }
                _showFooter("E", (sLabel || sName) + " 오류: " + (e && e.message));
            }
            return;
        }
        // 그 외 트랜잭션 핸들러는 다음 슬라이스(AppNmInput override) — 현재는 안내.
        _showFooter("I", (sLabel || sName) + " — 로직 연결 진행 중");
    }
    function _invokeMenu(sKey, sLabel) {
        // 윈도우 메뉴: 실제 핸들러 oAPP.fn.fnWS10{key} 호출 (fnHmws.js)
        if (_callReal("fnWS10" + sKey, sLabel)) { return; }
        _showFooter("I", sLabel + " (" + sKey + ") — 미구현 항목");
    }

    /********************************************************************
     * [공통] SAP T-CODE 실행 — 원본 ev_pressTcodeInputSubmit(ws_events_01.js 326)
     *   + oAPP.common.execControllerClass(ws_common.js 2549) 이식.
     *   공통 헤더(WS10/WS20)의 T-CODE 입력(.u4a-tcode #sapTcode) Enter 시 호출.
     *   대문자화 → 정규식 검증(062) → 이력저장(fnSaveTCodeSuggestion)/SUGG갱신 → 실행.
     ********************************************************************/
    //   bSilent=true 면 입력칸(#sapTcode)에 값을 쓰지 않는다(예: SAP 로고 클릭 SMEN 실행).
    function _runTcode(sValue, bSilent) {
        sValue = (sValue == null ? "" : String(sValue)).trim();
        if (sValue === "") { return; }

        var sTcode = sValue.toUpperCase();

        // 원본 정규식: 영숫자 / _ 만 허용. 위반 시 062 & invalid transaction ID.
        if (!/^[a-zA-Z0-9/_]*$/.test(sTcode)) {
            try {
                var sMsg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "062", sTcode);
                oAPP.common.fnShowFloatingFooterMsg("E", parent.getCurrPage(), sMsg);
            } catch (e) { }
            var oClr = document.getElementById("sapTcode");
            if (oClr && !bSilent) { oClr.value = ""; oClr.dispatchEvent(new Event("input", { bubbles: true })); } // 클리어 X 노출 동기화
            return;
        }

        // 대문자 반영 (원본 oSrchField.setValue(sTcode))
        var oInp = document.getElementById("sapTcode");
        if (oInp && !bSilent) { oInp.value = sTcode; oInp.dispatchEvent(new Event("input", { bubbles: true })); } // 클리어 X 노출 동기화

        // 이력 저장 + /SUGG/TCODE 모델 갱신 (원본 동일)
        try { oAPP.fn.fnSaveTCodeSuggestion(sTcode); } catch (e) { }
        try { oAPP.common.fnSetModelProperty("/SUGG/TCODE", oAPP.fn.fnReadTCodeSuggestion()); } catch (e) { }

        // 실행 (원본 execControllerClass(null, null, sTcode, oAppInfo))
        var oAppInfo = {}; try { oAppInfo = parent.getAppInfo() || {}; } catch (e) { }
        try { oAPP.common.execControllerClass(null, null, sTcode, oAppInfo); }
        catch (e) { console.error("[HTML5] T-CODE 실행 오류:", e && e.message ? e.message : e); }
    }

    /********************************************************************
     * 공통 드롭다운/메뉴 (shell.css .u4a-menu)
     ********************************************************************/
    var _openAnchor = null;

    // 서브헤더(트랜잭션 툴바) 오버플로 상태 — 좁아지면 넘치는 버튼을 ⋯ 메뉴로 접는다.
    var _oSubHeaderEl = null;   // 툴바 컨테이너
    var _aBarItems = [];        // [{ el, cfg }] (오버플로 ⋯ 버튼 제외)
    var _oOverflowBtn = null;   // ⋯ 버튼
    var _oReflowObs = null;     // ResizeObserver

    function _closeMenus() {
        var aMenus = document.querySelectorAll(".u4a-menu");
        for (var i = 0; i < aMenus.length; i++) { aMenus[i].remove(); }
        if (_openAnchor) { _openAnchor.setAttribute("aria-expanded", "false"); }
        _openAnchor = null;
        document.removeEventListener("mousedown", _onOutside, true);
        document.removeEventListener("keydown", _onEsc, true);
        window.removeEventListener("resize", _closeMenus);
    }
    function _onOutside(ev) {
        if (ev.target && ev.target.closest && !ev.target.closest(".u4a-menu") && !ev.target.closest("[data-menu-anchor]")) {
            _closeMenus();
        }
    }
    function _onEsc(ev) { if (ev.key === "Escape") { _closeMenus(); } }

    function _buildMenuEl(aItems, fnSelect) {
        var oMenu = document.createElement("div");
        oMenu.className = "u4a-menu";
        oMenu.setAttribute("role", "menu");
        aItems.forEach(function (it) {
            if (it.visible === false) { return; }
            var oItem = document.createElement("div");
            oItem.className = "u4a-menu__item";
            oItem.setAttribute("role", "menuitem");
            if (it.disabled) { oItem.setAttribute("aria-disabled", "true"); }
            var sIcon = it.icon ? (it.brand ? '<i class="fa-brands fa-' + it.icon + '"></i>' : _fa(it.icon)) : "<i></i>";
            oItem.innerHTML = sIcon + '<span class="u4a-menu__item-text">' + it.text + "</span>";
            var bSub = Array.isArray(it.items) && it.items.length > 0;
            if (bSub) { oItem.classList.add("u4a-menu__item--has-sub"); }
            if (!it.disabled) {
                if (bSub) {
                    oItem.addEventListener("mouseenter", function () { _openSub(oItem, it.items, fnSelect); });
                    oItem.addEventListener("click", function (e) { e.stopPropagation(); _openSub(oItem, it.items, fnSelect); });
                } else {
                    oItem.addEventListener("mouseenter", function () { _closeDeeper(oMenu); });
                    oItem.addEventListener("click", function (e) { e.stopPropagation(); _closeMenus(); fnSelect(it); });
                }
            }
            oMenu.appendChild(oItem);
        });
        return oMenu;
    }
    function _closeDeeper(oMenu) {
        var all = Array.prototype.slice.call(document.querySelectorAll(".u4a-menu"));
        var idx = all.indexOf(oMenu);
        all.slice(idx + 1).forEach(function (m) { m.remove(); });
    }
    function _openSub(oAnchorItem, aItems, fnSelect) {
        var oParent = oAnchorItem.closest(".u4a-menu");
        _closeDeeper(oParent);
        var oSub = _buildMenuEl(aItems, fnSelect);
        document.body.appendChild(oSub);
        var r = oAnchorItem.getBoundingClientRect();
        var left = r.right - 2;
        if (left + oSub.offsetWidth > window.innerWidth) { left = r.left - oSub.offsetWidth + 2; }
        var top = r.top;
        if (top + oSub.offsetHeight > window.innerHeight) { top = Math.max(4, window.innerHeight - oSub.offsetHeight - 4); }
        oSub.style.left = left + "px";
        oSub.style.top = top + "px";
    }
    function _openMenuAt(oAnchor, aItems, fnSelect, sAlign) {
        var bSame = _openAnchor === oAnchor;
        _closeMenus();
        if (bSame) { return; }
        var oMenu = _buildMenuEl(aItems, fnSelect);
        document.body.appendChild(oMenu);
        var r = oAnchor.getBoundingClientRect();
        var left = (sAlign === "right") ? (r.right - oMenu.offsetWidth) : r.left;
        if (left + oMenu.offsetWidth > window.innerWidth - 4) { left = window.innerWidth - oMenu.offsetWidth - 4; }
        if (left < 4) { left = 4; }
        oMenu.style.left = left + "px";
        oMenu.style.top = (r.bottom + 2) + "px";
        oAnchor.setAttribute("aria-expanded", "true");
        _openAnchor = oAnchor;
        //창 리사이즈/전체창 전환 시 메뉴는 닫는다(표준 메뉴 UX — 따라가지 않음).
        //  앵커가 옮겨가 어긋나는 것(특히 우측정렬 오버플로 ⋯ 메뉴) 방지.
        window.addEventListener("resize", _closeMenus);
        setTimeout(function () {
            document.addEventListener("mousedown", _onOutside, true);
            document.addEventListener("keydown", _onEsc, true);
        }, 0);
    }

    /********************************************************************
     * 브라우저 줌 슬라이더 팝오버 (헤더 zoom 버튼)
     *   원본: sap.m.Button("zoom-in").press = ev_pressZoomBtn → setWinZoomPopup(btn)
     *         = sap.m.Popover{ showHeader:false, contentWidth:200px,
     *             sap.m.Slider(min:-5, max:5, step:0.1) }
     *         (ws_common.js BUTTON3 / ws_events_01.js / ws_fn_01.js).
     *   · 슬라이더 change → WEBFRAME.setZoomLevel(value) 라이브(Electron zoomLevel, 0=100%).
     *   · afterOpen=슬라이더 값을 현재 getZoomLevel() 로, beforeClose=setPersonWinZoom("S")(zoom.json 저장).
     *   sap.m.Popover/Slider → 네이티브 팝오버 + <input type=range>. setPersonWinZoom 은 FS 기반이라
     *   HTML5 그대로 재사용. 닫기 인프라는 메뉴와 동일 사상(외부클릭/Esc/창 리사이즈 → 닫기+저장).
     ********************************************************************/
    var _zoomPop = null;
    function _webFrame() {
        try { if (parent && parent.WEBFRAME) { return parent.WEBFRAME; } } catch (e) { }
        try { if (window.WEBFRAME) { return window.WEBFRAME; } } catch (e) { }
        return null;
    }
    function _zoomPct(nLevel) {
        // Electron zoomLevel → 배율(1.2^level) → 퍼센트
        return Math.round(Math.pow(1.2, Number(nLevel) || 0) * 100);
    }
    function _closeZoomPop() {
        if (!_zoomPop) { return; }
        var oCtx = _zoomPop;
        _zoomPop = null;
        document.removeEventListener("mousedown", oCtx.onOutside, true);
        document.removeEventListener("keydown", oCtx.onEsc, true);
        window.removeEventListener("resize", oCtx.onWinChange);
        try { oCtx.el.remove(); } catch (e) { }
        if (oCtx.anchor) { oCtx.anchor.setAttribute("aria-expanded", "false"); }
        // 원본 beforeClose — 현재 줌을 zoom.json 에 저장(FS 기반 setPersonWinZoom 은 sap 무관 → HTML5 가용).
        try { if (window.oAPP && oAPP.fn && typeof oAPP.fn.setPersonWinZoom === "function") { oAPP.fn.setPersonWinZoom("S"); } } catch (e) { }
    }
    function _openZoomPop(oAnchor) {
        if (_zoomPop) { _closeZoomPop(); return; }   // 이미 열림 → 토글 닫기(저장)
        var oWf = _webFrame();

        var oPop = document.createElement("div");
        oPop.className = "u4a-zoom-pop";

        var oRng = document.createElement("input");
        oRng.type = "range";
        oRng.className = "u4a-zoom-pop__slider";
        oRng.min = "-5"; oRng.max = "5"; oRng.step = "0.1";   // 원본 Slider 동일
        var nCur = 0;
        try { if (oWf && oWf.getZoomLevel) { nCur = oWf.getZoomLevel(); } } catch (e) { }
        oRng.value = String(nCur);

        // − [🔍 %] + — 모나코 에디터 푸터(.u4aEdZoom)와 동일 패턴: 셋 다 공통 .u4a-btn 톤,
        //   % 알약 안에 돋보기+숫자가 한 버튼(클릭=100% 원복). 별도 떠 있는 아이콘 X.
        function _zBtn(sExtra, sInner) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "u4a-btn u4a-zoom-pop__btn " + sExtra;
            b.innerHTML = sInner;
            return b;
        }

        // % 알약(클릭 시 100%/레벨 0 원복) — 돋보기 아이콘 + 숫자 span 한 묶음.
        var oValEl = _zBtn("u4a-zoom-pop__pct", '<i class="fa-solid fa-magnifying-glass"></i><span>' + _zoomPct(nCur) + '%</span>');
        oValEl.title = "Reset (100%)";
        var oValSpan = oValEl.querySelector("span");
        oValEl.addEventListener("click", function () { _applyZoom(0); });

        // 줌 적용 공통(슬라이더 change + −/+ 버튼 공용) — [-5,5] 클램프 후 setZoomLevel + 슬라이더/% 동기.
        function _applyZoom(v) {
            v = Math.max(-5, Math.min(5, Math.round(v * 10) / 10));
            oRng.value = String(v);
            try { if (oWf && oWf.setZoomLevel) { oWf.setZoomLevel(v); } } catch (e) { }
            oValSpan.textContent = _zoomPct(v) + "%";
        }

        // − / + 스텝 버튼 — 한 번에 0.5 레벨(≈10%)씩, 즉시 적용(드래그 아님 → 지연 우려 없음).
        var ZOOM_STEP = 0.5;
        var oMinus = _zBtn("u4a-zoom-pop__step", _fa("minus"));
        oMinus.title = "Ctrl + Wheel ↓";   // 에디터와 동일 툴팁
        oMinus.addEventListener("click", function () { _applyZoom(parseFloat(oRng.value) - ZOOM_STEP); });
        var oPlus = _zBtn("u4a-zoom-pop__step", _fa("plus"));
        oPlus.title = "Ctrl + Wheel ↑";
        oPlus.addEventListener("click", function () { _applyZoom(parseFloat(oRng.value) + ZOOM_STEP); });

        // % 라벨은 드래그 중 실시간 미리보기(input), 실제 확대/축소는 손 놓을 때(change) 수행.
        //   ★ 원본 sap.m.Slider 도 change(=release) 에서 setZoomLevel — 드래그 내내 창 전체를
        //     재줌하면 끊기므로 커밋 시점에만 적용한다.
        oRng.addEventListener("input", function () {
            oValSpan.textContent = _zoomPct(parseFloat(oRng.value)) + "%";
        });
        oRng.addEventListener("change", function () { _applyZoom(parseFloat(oRng.value)); });

        oPop.appendChild(oMinus);
        oPop.appendChild(oRng);
        oPop.appendChild(oValEl);
        oPop.appendChild(oPlus);
        document.body.appendChild(oPop);

        // 앵커(zoom 버튼) 기준 우측정렬·아래 배치(메뉴 _openMenuAt 와 동일).
        function _position() {
            var r = oAnchor.getBoundingClientRect();
            var left = r.right - oPop.offsetWidth;
            if (left + oPop.offsetWidth > window.innerWidth - 4) { left = window.innerWidth - oPop.offsetWidth - 4; }
            if (left < 4) { left = 4; }
            oPop.style.left = left + "px";
            oPop.style.top = (r.bottom + 2) + "px";
        }
        _position();
        oAnchor.setAttribute("aria-expanded", "true");

        // 현재 WEBFRAME 줌 → 슬라이더/% 재동기(팝오버 열린 채 Ctrl+휠 등 외부 줌 반영).
        function _syncFromZoom() {
            var v = 0;
            try { if (oWf && oWf.getZoomLevel) { v = oWf.getZoomLevel(); } } catch (e) { }
            oRng.value = String(v);   // 프로그램 set 은 input/change 미발화 → 피드백 루프 없음
            oValSpan.textContent = _zoomPct(v) + "%";
        }

        var fnOutside = function (ev) {
            if (ev.target && ev.target.closest && !ev.target.closest(".u4a-zoom-pop") && !ev.target.closest("[data-zoom-anchor]")) { _closeZoomPop(); }
        };
        var fnEsc = function (ev) { if (ev.key === "Escape") { _closeZoomPop(); } };
        // 창 리사이즈 → 닫지 말고 "재배치 + 값 동기". −/+/슬라이더/Ctrl+휠이 setZoomLevel 로 배율을 바꾸면
        //   resize 가 발생하는데, 닫기로 두면 자기 줌에 팝오버가 스스로 닫혔다([[anchored-overlay-resize-reposition]]).
        //   Ctrl+휠 줌(ws_fn_04)도 같은 resize 를 타므로 여기서 슬라이더/% 를 실시간 동기화한다.
        var fnWin = function () { _position(); _syncFromZoom(); };
        _zoomPop = { el: oPop, anchor: oAnchor, onOutside: fnOutside, onEsc: fnEsc, onWinChange: fnWin };
        setTimeout(function () {
            document.addEventListener("mousedown", fnOutside, true);
            document.addEventListener("keydown", fnEsc, true);
            window.addEventListener("resize", fnWin);
        }, 0);
        try { oRng.focus(); } catch (e) { }
    }
    function _buildZoomBtn() {
        var b = _iconBtn(ICON.zoom, "Zoom", function () { _openZoomPop(b); });
        b.setAttribute("data-zoom-anchor", "zoom");
        b.setAttribute("aria-haspopup", "true");
        return b;
    }

    /********************************************************************
     * 플로팅 푸터 메시지 (doc 03 §3 /FMSG/WS10 — 10초 자동 제거)
     ********************************************************************/
    //  공통 푸터 컴포넌트(U4AUI.footer*, shell.css .u4a-footer) 소비 — 닫기(X)/자동숨김 내장, 화면별 복제 없음.
    function _showFooter(sType, sMsg) {
        if (window.U4AUI) { window.U4AUI.footerShow("ws10Footer", sType || "I", sMsg || ""); }
    }
    function _hideFooter() {
        if (window.U4AUI) { window.U4AUI.footerHide("ws10Footer"); }
    }

    // ws_html5_shell.js 의 fnShowFloatingFooterMsg/fnHideFloatingFooterMsg 가 호출하는 훅
    oAPP.ws10html.showFooter = _showFooter;
    oAPP.ws10html.hideFooter = _hideFooter;

    // 공통 드롭다운 메뉴 헬퍼 노출 — WS20(ws_html5_ws20.js)의 App 실행 split 버튼 등이
    // 동일한 .u4a-menu 컴포넌트를 재사용한다(UX 통일, 단일 소스).
    //   openMenuAt(oAnchor, aItems, fnSelect, sAlign)  — aItems: {key,text,icon,brand,disabled,items,visible}
    oAPP.ws10html.openMenuAt = _openMenuAt;
    oAPP.ws10html.closeMenus = _closeMenus;

    /********************************************************************
     * [공통] split(본체+화살표) 메뉴 버튼 빌더 — WS10/WS20 단일 소스.
     *   ★ 드롭다운 UX 규칙을 "구조적으로" 강제(메모리 menu-dropdown-left-align):
     *     · 메뉴는 화살표가 아니라 버튼 전체(wrap) 좌측에 정렬(_openMenuAt(wrap,…,"left"))
     *     · 열 때만 busy(prepare 비동기 동안), 이미 열려있으면 busy 없이 즉시 닫기(토글)
     *     · 화살표에 data-menu-anchor → 외부클릭 닫힘이 화살표 클릭을 "바깥"으로 오인 방지
     *   cfg = {
     *     id, icon, brand, text, tooltip, sc,
     *     onMain : fn()            본체 클릭(기본 동작)
     *     getItems : fn()->[item]  드롭다운 항목(열 때마다 동적 호출; {key,text,icon,brand,disabled})
     *     onPick : fn(item)        항목 선택
     *     prepare : fn()->Promise  (옵션) 열기 전 비동기 준비 — 이 동안만 busy
     *   }
     ********************************************************************/
    function _buildSplitButton(cfg) {
        cfg = cfg || {};
        var wrap = document.createElement("div");
        wrap.className = "u4a-split";
        if (cfg.id) { wrap.id = cfg.id; }

        var main = document.createElement("button");
        main.className = "u4a-split__main";
        main.type = "button";
        main.title = cfg.tooltip || (cfg.text ? (cfg.text + (cfg.sc ? " (" + cfg.sc + ")" : "")) : "");
        main.innerHTML = (cfg.icon ? (cfg.brand ? '<i class="fa-brands fa-' + cfg.icon + '"></i>' : _fa(cfg.icon)) : "")
            + (cfg.text ? "<span>" + cfg.text + "</span>" : "");
        main.addEventListener("click", function () {
            if (typeof cfg.onMain === "function") { try { cfg.onMain(); } catch (e) { console.error("[split] onMain", e); } }
        });

        var arrow = document.createElement("button");
        arrow.className = "u4a-split__arrow";
        arrow.type = "button";
        arrow.title = cfg.text || "";
        arrow.setAttribute("aria-haspopup", "true");
        arrow.setAttribute("data-menu-anchor", "split");
        arrow.innerHTML = (ICON && ICON.caret) ? ICON.caret : _fa("angle-down");
        arrow.addEventListener("click", function () {
            // 이미 열림 → busy/prepare 없이 즉시 닫기(토글)
            if (wrap.getAttribute("aria-expanded") === "true") { _closeMenus(); return; }
            function open() {
                try { parent.setBusy(""); } catch (e) { }
                var aItems = (typeof cfg.getItems === "function") ? (cfg.getItems() || []) : [];
                // 앵커=wrap → 메뉴 좌측이 본체 시작에 정렬(치우침 방지)
                _openMenuAt(wrap, aItems, function (it) {
                    if (typeof cfg.onPick === "function") { try { cfg.onPick(it); } catch (e) { console.error("[split] onPick", e); } }
                }, "left");
            }
            if (typeof cfg.prepare === "function") {
                try { parent.setBusy("X"); } catch (e) { }   // 준비(느린 체크) 동안만 busy
                Promise.resolve().then(function () { return cfg.prepare(); })
                    .catch(function (e) { console.error("[split] prepare", e); })
                    .then(open);
            } else { open(); }
        });

        wrap.appendChild(main);
        wrap.appendChild(arrow);
        return wrap;
    }
    oAPP.ws10html.buildSplitButton = _buildSplitButton;

    /********************************************************************
     * 드롭다운 메뉴 버튼 (구 sap.m.MenuButton, buttonMode 기본=Regular — split 아님)
     * ------------------------------------------------------------------
     * 버튼 전체 클릭 → 드롭다운 메뉴(좌측정렬). 공통 _openMenuAt(토글·서브메뉴·
     * 외부닫기·resize닫기 내장) 를 그대로 소비 → 별도 토글/닫기 배선 불필요.
     * 트랜잭션 툴바 버튼(.u4a-tx-btn)과 동일 스킨 + 트레일링 caret.
     * 소비처: WS20 Icon Viewer(Icon List/Image Icons) 등.
     *   cfg: { id, icon, brand, text, tooltip,
     *          getItems()→[{key,icon,brand,text,disabled,items,...}], items(정적 폴백),
     *          onPick(it) }
     ********************************************************************/
    function _buildMenuButton(cfg) {
        cfg = cfg || {};
        var btn = document.createElement("button");
        btn.type = "button";
        if (cfg.id) { btn.id = cfg.id; }
        btn.className = "u4a-tx-btn u4a-tx-btn--menu";
        btn.title = cfg.tooltip || cfg.text || "";
        btn.setAttribute("aria-haspopup", "true");
        btn.setAttribute("data-menu-anchor", "menu");
        btn.innerHTML =
            (cfg.icon ? (cfg.brand ? '<i class="fa-brands fa-' + cfg.icon + '"></i>' : _fa(cfg.icon)) : "")
            + (cfg.text ? "<span>" + cfg.text + "</span>" : "")
            + '<i class="fa-solid fa-chevron-down u4a-tx-btn__caret"></i>';
        btn.addEventListener("click", function () {
            var aItems = (typeof cfg.getItems === "function") ? (cfg.getItems() || []) : (cfg.items || []);
            // _openMenuAt 는 같은 앵커 재클릭 시 토글로 닫는다(별도 처리 불필요).
            _openMenuAt(btn, aItems, function (it) {
                if (typeof cfg.onPick === "function") { try { cfg.onPick(it); } catch (e) { console.error("[menuBtn] onPick", e); } }
            }, "left");
        });
        return btn;
    }
    oAPP.ws10html.buildMenuButton = _buildMenuButton;

    /********************************************************************
     * 렌더 진입점 — fnOnInitRendering 이 호출
     ********************************************************************/
    oAPP.fn.fnRenderWs10Html = function () {

        // 활성 테마 적용 (서버 THEMEINFO → 없으면 기본)
        try {
            if (window.U4ATheme) { window.U4ATheme.apply(_savedTheme() || window.U4ATheme.current() || "horizon_white"); }
        } catch (e) { }

        var oContent = document.getElementById("content");
        if (!oContent) { return; }
        oContent.innerHTML = "";
        oContent.classList.add("u4aWsShell");

        // ── 공유 윈도우 타이틀바 (구 sap.m.Page customHeader Bar) ─────────
        //   로고 + 타이틀 + min/max/close. WS10/WS20/WS30 가 공통으로 쓰는 창 크롬이라
        //   페이지(#WSAPP) "위"에 1개만 둔다(중복 헤더 제거). 페이지 전환 시에도 유지 →
        //   WS20/WS30 에서도 창 버튼(min/max/close)이 보인다.
        oContent.appendChild(_renderTitlebar());

        // ── 페이지 컨테이너 (구 sap.m.NavContainer "WSAPP") ──────────────
        //   WS10 화면을 #content 에 직접 그리지 않고 #WSAPP > #WS10 페이지에 담는다.
        //   WS20/WS30 빈 페이지를 함께 만들어, Display/Change 시 div display 토글로
        //   페이지를 전환한다(ws_html5_shell.js fnOnMoveToPage / ws_html5_ws20.js).
        var WSAPP = document.createElement("div");
        WSAPP.id = "WSAPP";
        WSAPP.className = "u4aWsApp";

        // WS10 페이지 — WS10 크롬(메뉴바·서브헤더·검색·히어로). 타이틀바는 셸 공유로 이동.
        var WS10 = document.createElement("div");
        WS10.id = "WS10";
        WS10.className = "u4aWsPage u4a-ws10";
        WS10.appendChild(_renderMenubar());
        WS10.appendChild(_renderSubHeader());
        WS10.appendChild(_renderSearchbar());
        WS10.appendChild(_renderContent());
        WS10.appendChild(_renderStatusBar());
        WSAPP.appendChild(WS10);

        // WS20 / WS30 빈 페이지 (display 토글 대비 — 내용은 WS20 진입 시 렌더)
        var WS20 = document.createElement("div");
        WS20.id = "WS20";
        WS20.className = "u4aWsPage u4aWsHidden";
        WSAPP.appendChild(WS20);

        var WS30 = document.createElement("div");
        WS30.id = "WS30";
        WS30.className = "u4aWsPage u4aWsHidden";
        WSAPP.appendChild(WS30);

        oContent.appendChild(WSAPP);

        // 히어로 배경 테마 클래스(.u4a-ws-light-theme) 적용 + 테마 변경 감시 (원본 _applyWs10ContPageThemeClass)
        _applyHeroThemeClass();
        _ensureHeroThemeObserver();

        // 하단 접속정보 상태바 값 채우기 (메타데이터 늦게 오는 경우 대비 짧은 재시도 1회)
        _updateStatusBar();
        setTimeout(_updateStatusBar, 600);

        // 셸 페이지 참조 + 네비게이션 헬퍼 (구 NavContainer.to → div 토글)
        //   ws_html5_shell.js fnOnMoveToPage / ws_html5_ws20.js 가 이 계약을 소비.
        oAPP.attr = oAPP.attr || {};
        oAPP.attr.ui = oAPP.attr.ui || {};
        oAPP.attr.ui.WSAPP = WSAPP;
        oAPP.attr.ui.pages = { WS10: WS10, WS20: WS20, WS30: WS30 };
        oAPP.attr.ui._navGen = 0;   // generation counter: stale _done 차단용
        oAPP.fn.fnNavTo = oAPP.fn.fnNavTo || function (sToId) {
            var oPages = (oAPP.attr.ui && oAPP.attr.ui.pages) || {};
            var oTo = oPages[sToId];
            if (!oTo) { return; }
            try { parent.setCurrPage(sToId); } catch (e) { }

            // 현재 보이는 페이지(나갈 페이지) 탐색
            var oFrom = null, sFromId = null;
            Object.keys(oPages).forEach(function (k) {
                if (oPages[k] && k !== sToId && !oPages[k].classList.contains("u4aWsHidden")) {
                    oFrom = oPages[k]; sFromId = k;
                }
            });

            // 나갈 페이지가 없으면(초기) 애니메이션 없이 표시
            if (!oFrom || oFrom === oTo) {
                Object.keys(oPages).forEach(function (k) {
                    if (oPages[k]) { oPages[k].classList.toggle("u4aWsHidden", k !== sToId); }
                });
                return;
            }

            // 방향 결정 (WS10:0 < WS20:1 < WS30:2 → 큰 쪽으로 가면 forward)
            var ORDER = { WS10: 0, WS20: 1, WS30: 2 };
            var bFwd = (ORDER[sToId] || 0) >= (ORDER[sFromId] || 0);
            var sIn = bFwd ? "u4aWsNavInFwd" : "u4aWsNavInBack";
            var sOut = bFwd ? "u4aWsNavOutFwd" : "u4aWsNavOutBack";

            // 들어올 페이지 표시 + 인/아웃 애니메이션 시작
            // 이전 애니메이션의 stale _done 이 400ms 뒤에 오는 페이지를 다시 숨기는 것을 방지하기 위해
            // generation 카운터를 증가시키고 _done 진입 시 검사한다.
            var gen = ++(oAPP.attr.ui._navGen);
            oTo.classList.remove("u4aWsHidden");
            oTo.classList.add(sIn);
            oFrom.classList.add(sOut);

            var _done = function () {
                oFrom.removeEventListener("animationend", _done);
                if (oAPP.attr.ui._navGen !== gen) {
                    // stale: 새 fnNavTo가 이미 시작됨 → u4aWsHidden 추가는 건너뛰되
                    // animation-fill-mode:both 로 인해 opacity:0/transform 이 남는
                    // zombie 클래스는 반드시 제거해야 화면이 보임
                    oFrom.classList.remove(sOut);
                    oTo.classList.remove(sIn);
                    return;
                }
                oFrom.classList.add("u4aWsHidden");
                oFrom.classList.remove(sOut);
                oTo.classList.remove(sIn);
            };
            oFrom.addEventListener("animationend", _done);
            setTimeout(_done, 400); // 폴백(animationend 미발생 대비)
        };

        // 공개 메뉴 닫기 (fnOnMoveToPage 가 페이지 전환 시 열린 윈도우 메뉴 닫음)
        oAPP.ws10html = oAPP.ws10html || {};
        oAPP.ws10html.closeMenus = _closeMenus;

        _wireShortcuts();

        // #content 표시 (셸 기본 display:none → fadeIn)
        //   타이틀바(고정) + #WSAPP(가변)를 세로로 쌓기 위해 컬럼 플렉스.
        oContent.style.display = "flex";
        oContent.style.flexDirection = "column";
        try {
            if (window.jQuery) {
                window.jQuery(oContent).hide().fadeIn(300, "linear");
            }
        } catch (e) { }
        try { if (parent && parent.setBusy) { parent.setBusy(""); } } catch (e) { }
        try { if (parent && parent.setDomBusy) { parent.setDomBusy(""); } } catch (e) { }
    };

    function _renderTitlebar() {
        var o = document.createElement("header");
        o.className = "u4a-titlebar u4a-ws10__titlebar";
        o.innerHTML =
            '<img class="u4a-titlebar__logo" src="' + _logoUrl() + '" alt="U4A">' +
            '<span class="u4a-titlebar__title" id="u4aWsHeaderTitle">U4A Workspace - Main</span>' +
            '<span class="u4a-titlebar__spacer"></span>' +
            '<button class="u4a-winbtn" data-action="min" title="Minimize">' + ICON.min + "</button>" +
            '<button class="u4a-winbtn" id="maxWinBtn" data-action="max" title="Maximize">' + ICON.max + "</button>" +
            '<button class="u4a-winbtn u4a-winbtn--close" id="mainWinClose" data-action="close" title="Close">' + ICON.close + "</button>";
        o.querySelector('[data-action="min"]').addEventListener("click", function () { var w = _currWin(); if (w) { w.minimize(); } });
        o.querySelector('[data-action="max"]').addEventListener("click", function () {
            var w = _currWin(); if (!w) { return; }
            if (w.isMaximized()) { w.unmaximize(); } else { w.maximize(); }
        });
        // 최대화 상태에 따라 아이콘/툴팁 토글(window-maximize ↔ window-restore). 원본은 sap byId 로
        //   동기화했으나 HTML5 에선 DOM 버튼이라 maximize/unmaximize 네이티브 이벤트로 직접 갱신.
        var oMaxBtn = o.querySelector('#maxWinBtn');
        function _syncMaxIcon() {
            if (!oMaxBtn) { return; }
            var w = _currWin(); var bMax = false;
            try { bMax = !!(w && w.isMaximized()); } catch (e) { }
            oMaxBtn.innerHTML = bMax ? '<i class="fa-solid fa-window-restore"></i>' : '<i class="fa-solid fa-window-maximize"></i>';
            oMaxBtn.title = bMax ? "Restore" : "Maximize";
        }
        try {
            var wMax = _currWin();
            if (wMax && wMax.on) { wMax.on("maximize", _syncMaxIcon); wMax.on("unmaximize", _syncMaxIcon); }
        } catch (e) { }
        _syncMaxIcon();
        o.querySelector('[data-action="close"]').addEventListener("click", function () {
            try { oAPP.attr = oAPP.attr || {}; oAPP.attr.isPressWindowClose = "X"; } catch (e) { }
            var w = _currWin(); if (w) { w.close(); }
        });
        return o;
    }

    function _renderMenubar() {
        // WS10 메뉴바 = 공유 빌더(buildMenubar) + WS10 카테고리/디스패치(fnWS10*).
        return oAPP.ws10html.buildMenubar(_getWindowMenu(), function (it) { _invokeMenu(it.key, it.text); });
    }

    /********************************************************************
     * [공유] 윈도우 메뉴바 + 공통 헤더 빌더 (WS10/WS20 공통 — doc 03 §4)
     *   aCats     : 메뉴 카테고리 배열({key,text,items,staffOnly})
     *   fnSelect  : 메뉴 항목 선택 콜백 (it 인자)
     *   공통 헤더(AI/SAP로고/T-CODE/pin/zoom/search/power)는 동일하게 부착.
     *   (테마 변경은 옵션 팝업으로 이관 → 헤더 테마 스와치 버튼 제거. 2026-06-24)
     ********************************************************************/
    oAPP.ws10html.buildMenubar = function (aCats, fnSelect) {
        var o = document.createElement("div");
        o.className = "u4a-ws10__menubar";
        var aCatBtns = [];   // 카테고리 버튼들(폭 부족 시 숨기고 햄버거로 접음)
        var aVisCats = [];   // staffOnly 필터 통과한 카테고리(햄버거 서브메뉴용)
        (aCats || []).forEach(function (cat) {
            if (cat.staffOnly && !WS_STATE.IS_STAFF) { return; }
            aVisCats.push(cat);
            var b = document.createElement("button");
            b.className = "u4a-wmenu-btn";
            b.type = "button";
            b.textContent = cat.text;
            b.setAttribute("data-menu-anchor", cat.key);
            b.setAttribute("aria-haspopup", "true");
            b.setAttribute("aria-expanded", "false");
            b.addEventListener("click", function () {
                _openMenuAt(b, cat.items, function (it) { fnSelect(it); }, "left");
            });
            b.addEventListener("mouseenter", function () {
                if (_openAnchor && _openAnchor !== b) {
                    _openMenuAt(b, cat.items, function (it) { fnSelect(it); }, "left");
                }
            });
            o.appendChild(b);
            aCatBtns.push(b);
        });

        // 메뉴 오버플로 햄버거(☰) — 폭이 모자라면 카테고리 버튼을 통째로 여기로 접는다
        //   (원본 sap.m.OverflowToolbar 동작 대응). 각 카테고리는 서브메뉴로 펼친다.
        var oHam = document.createElement("button");
        oHam.className = "u4a-wmenu-btn u4a-wmenu-overflow";
        oHam.type = "button";
        oHam.hidden = true;
        oHam.title = "Menu";
        oHam.setAttribute("data-menu-anchor", "wmenu-ovf");
        oHam.setAttribute("aria-haspopup", "true");
        oHam.setAttribute("aria-expanded", "false");
        oHam.innerHTML = _fa("bars");
        oHam.addEventListener("click", function () {
            var aItems = aVisCats.map(function (cat) { return { key: cat.key, text: cat.text, items: cat.items }; });
            _openMenuAt(oHam, aItems, function (it) { fnSelect(it); }, "left");
        });
        o.appendChild(oHam);

        o.appendChild(_renderCommonHeader());

        // 폭 반응 재배치(구 OverflowToolbar) — 3단계:
        //   ① 다 들어가면 카테고리 펼침 ② 넘치면 카테고리→햄버거 ③ 그래도 넘치면 클러스터 축소(is-tight)
        function _reflowMenubar() {
            oHam.hidden = true;
            for (var i = 0; i < aCatBtns.length; i++) { aCatBtns[i].hidden = false; }
            o.classList.remove("is-tight");
            if (aCatBtns.length && o.scrollWidth > o.clientWidth + 1) {
                for (var j = 0; j < aCatBtns.length; j++) { aCatBtns[j].hidden = true; }
                oHam.hidden = false;
            }
            if (o.scrollWidth > o.clientWidth + 1) { o.classList.add("is-tight"); }
        }
        // ResizeObserver 는 관찰 시작 시 1회 호출되어 초기 레이아웃에도 반영. 줌(webFrame) 변경도
        //   CSS px 폭이 바뀌므로 발화 → 자동 재배치.
        if (window.ResizeObserver) {
            new ResizeObserver(function () { _reflowMenubar(); }).observe(o);
        } else {
            setTimeout(_reflowMenubar, 0);
        }
        return o;
    };

    function _renderCommonHeader() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__common";

        var oAi = document.createElement("button");
        oAi.className = "u4a-ai-btn";
        oAi.id = "aiConnBtn";
        oAi.type = "button";
        _renderAiBtn(oAi);
        oAi.addEventListener("click", function () {
            WS_STATE.UAI.state = !WS_STATE.UAI.state;
            _renderAiBtn(oAi);
            _invoke("setConnectionAI", WS_STATE.UAI.state ? _txt("M431") : _txt("M432"));
        });
        o.appendChild(oAi);

        // (테마 변경은 옵션 팝업으로 이관됨 → 헤더 테마 스와치 버튼 제거. 2026-06-24)

        // 브라우저 투명도(숨김) 슬라이더 팝업 버튼 — 원본 ws_common.js:3432 BUTTON1(icon:sap-icon://hide
        //   → fnSetHideWindow, ws_fn_04.js:757). 부모 창을 반투명+클릭통과로 만드는 별도 BrowserWindow(WINSHOWHIDE).
        //   opener(fnSetHideWindow)·로더(frame.html/frame.js)는 원본 재사용, iframe 콘텐츠(index.html/js)만 HTML5화.
        o.appendChild(_iconBtn(ICON.eyeSlash, "", function () {
            try { oAPP.fn.fnSetHideWindow(); } catch (e) { console.error("[WS10] window hide popup open", e); }
        }));

        // SAP 로고 (svg) — T-CODE 좌측. 클릭 시 T-CODE 실행 로직으로 SMEN(SAP 메인메뉴) 실행.
        var oSapLogo = document.createElement("img");
        oSapLogo.className = "u4a-sap-logo";
        oSapLogo.src = "../../svg/logos--sap.svg"; // www/svg/logos--sap.svg (logo.png 와 동일 기준)
        oSapLogo.alt = "SAP";
        oSapLogo.title = "SMEN";
        oSapLogo.addEventListener("error", function () { oSapLogo.style.visibility = "hidden"; });
        oSapLogo.addEventListener("click", function () { _runTcode("SMEN", true); });
        o.appendChild(oSapLogo);

        // SAP T-CODE 입력 — 공통 팩토리(U4AUI.createField). 자동완성/클리어/Enter 단일화.
        //   inputClassName 으로 헤더 전용 스타일(.u4a-tcode) 유지, className 으로 폭(.u4a-tcode-field).
        var oTcodeFld = window.U4AUI.createField({
            type: "text", id: "sapTcode", placeholder: "SAP T-CODE",
            className: "u4a-tcode-field", inputClassName: "u4a-tcode",
            clear: true,
            // SAP T-CODE 이력 자동완성 (원본 ev_suggestSapTcode — fnReadTCodeSuggestion 의 {TCODE} 목록)
            suggest: function () {
                try { return (oAPP.fn.fnReadTCodeSuggestion() || []).map(function (o) { return o && o.TCODE; }).filter(Boolean); }
                catch (e) { return []; }
            },
            onEnter: function (v) { _runTcode(v); }   // 선택은 채움만, 실행은 Enter(원본 동일)
        });
        oTcodeFld.input.autocomplete = "off";
        o.appendChild(oTcodeFld.el);

        o.appendChild(_buildPinBtn());
        o.appendChild(_buildZoomBtn());
        // Window Text Search(원본 ev_winTxtSrchWS10) — 별도 창 찾기 팝업(원본 의도=같은 프레임 간섭 회피). 아이콘만.
        o.appendChild(_iconBtn(ICON.search, "", function () {
            try { oAPP.fn.fnTextSearchPopupOpener(); } catch (e) { console.error("[WS10] text search open", e); }
        }));

        var oPower = _iconBtn(ICON.power, _txt("B53"), function () {
            // 실제 로그오프 (fnWS10WMENU30_04 → ev_Logout). 셸 부재(독립) 시 안내.
            if (!_callReal("fnWS10WMENU30_04", _txt("B53"))) { _showFooter("I", _txt("B53") + " — 셸 필요"); }
        });
        oPower.classList.add("u4a-btn-power");
        o.appendChild(oPower);
        return o;
    }

    function _renderAiBtn(oBtn) {
        var bOn = WS_STATE.UAI.state === true;
        oBtn.dataset.state = bOn ? "on" : "off";
        var sTxt = bOn ? _txt("M431") : _txt("M432");
        oBtn.title = sTxt;   // tight 모드에서 텍스트 숨겨 아이콘만일 때도 툴팁 유지
        oBtn.innerHTML = (bOn ? ICON.connected : ICON.disconnected) + "<span>" + sTxt + "</span>";
    }

    function _iconBtn(sIconHtml, sTitle, fnClick) {
        var b = document.createElement("button");
        b.className = "u4a-btn-icon";
        b.type = "button";
        b.title = sTitle;
        b.innerHTML = sIconHtml;
        b.addEventListener("click", fnClick);
        return b;
    }

    /********************************************************************
     * 브라우저 핀(항상 위 고정) — 토글 버튼.
     *   원본: sap.m.OverflowToolbarToggleButton({ icon:"pushpin-off",
     *         pressed:"{/SETTING/ISPIN}", press:ev_windowPinBtn }) (ws_common.js)
     *   · 눌림 상태 = 모델 /SETTING/ISPIN 양방향(원본 pressed 바인딩 대응).
     *     이 값은 브라우저 실행부(ws_fn_04 / uai / dev_browser)가 읽어 "핀이면 실행 후에도
     *     창 항상위를 원복하지 않는다"는 판단에 쓴다 → 반드시 모델에 반영.
     *   · 누르면 현재 창 setAlwaysOnTop(pressed) (원본 ev_windowPinBtn, ws_events_01.js).
     *   · 단순 버튼이 아니라 토글이므로 aria-pressed 로 눌림 시각상태(bootstrap-skin.css)를 표시.
     ********************************************************************/
    function _readPin() {
        try { return !!(window.oAPP && oAPP.common && oAPP.common.fnGetModelProperty && oAPP.common.fnGetModelProperty("/SETTING/ISPIN")); }
        catch (e) { return false; }
    }
    function _buildPinBtn() {
        var b = document.createElement("button");
        b.className = "u4a-btn-icon u4a-pin-btn";
        b.type = "button";
        b.title = "Browser Pin";   // 원본 tooltip 동일(고정 문자열)
        b.innerHTML = ICON.pin;
        b.setAttribute("aria-pressed", _readPin() ? "true" : "false");
        b.addEventListener("click", function () {
            var bOn = !_readPin();
            // 모델 갱신(원본 pressed:{/SETTING/ISPIN} 양방향 바인딩 대응)
            try { if (window.oAPP && oAPP.common && oAPP.common.fnSetModelProperty) { oAPP.common.fnSetModelProperty("/SETTING/ISPIN", bOn); } } catch (e) { }
            // 현재 창 항상위 처리(원본 ev_windowPinBtn 대응).
            //   ★ [Electron 버그] 켤 때는 레벨("screen-saver")을 줘야 풀스크린/다른 always-on-top
            //     창 위로 확실히 뜬다 → 코드베이스 브라우저 실행부(ws_fn_04/uai/dev_browser)와 동일하게
            //     ON=(true,"screen-saver") / OFF=(false). (원본 핀 핸들러는 단일 인자였으나 실행부 관례에 통일.)
            try {
                var w = _currWin();
                if (w && w.setAlwaysOnTop) {
                    if (bOn) { w.setAlwaysOnTop(true, "screen-saver"); }
                    else { w.setAlwaysOnTop(false); }
                }
            } catch (e) { }
            b.setAttribute("aria-pressed", bOn ? "true" : "false");
        });
        return b;
    }

    function _renderSubHeader() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__subheader";
        var bDev = WS_STATE.USERINFO.IS_DEV === "D";
        _aBarItems = [];
        _getSubHeaderButtons().forEach(function (cfg) {
            if (cfg.devOnly && !bDev) { return; }
            var el;
            if (cfg.sep) {
                el = document.createElement("div");
                el.className = "u4a-tx-sep";
            } else if (cfg.split) {
                el = _renderSplitButton(cfg);
            } else {
                el = document.createElement("button");
                el.className = "u4a-tx-btn" + (cfg.reject ? " u4a-tx-btn--reject" : "");
                el.type = "button";
                el.id = cfg.id;
                el.title = cfg.text + " (" + cfg.sc + ")";
                el.innerHTML = _fa(cfg.icon) + "<span>" + cfg.text + "</span>";
                el.addEventListener("click", function () { _invoke(cfg.ev, cfg.text); });
            }
            o.appendChild(el);
            _aBarItems.push({ el: el, cfg: cfg });
        });

        // 오버플로(⋯) 버튼 — 폭이 모자라 넘치는 항목을 드롭다운으로 접는다(구 OverflowToolbar 동작).
        var ovf = document.createElement("button");
        ovf.className = "u4a-tx-btn u4a-tx-overflow";
        ovf.type = "button";
        ovf.id = "ws10OverflowBtn";
        ovf.title = "More";
        ovf.setAttribute("data-menu-anchor", "overflow");
        ovf.innerHTML = ICON.overflow;
        ovf.hidden = true;
        ovf.addEventListener("click", function () { _showOverflowMenu(ovf); });
        o.appendChild(ovf);

        _oSubHeaderEl = o;
        _oOverflowBtn = ovf;

        // 폭 변화 감지 → 재배치. (ResizeObserver 는 초기 1회도 호출되어 첫 레이아웃에서 반영)
        if (window.ResizeObserver) {
            if (_oReflowObs) { _oReflowObs.disconnect(); }
            _oReflowObs = new ResizeObserver(function () { _reflowSubHeader(); });
            _oReflowObs.observe(o);
        } else {
            setTimeout(_reflowSubHeader, 0);
        }
        return o;
    }

    /********************************************************************
     * 서브헤더 오버플로 재배치 — 넘치는 항목을 숨기고 ⋯ 버튼/메뉴로 노출.
     ********************************************************************/
    function _reflowSubHeader() {
        var bar = _oSubHeaderEl, ovf = _oOverflowBtn;
        if (!bar || !ovf || !bar.isConnected) { return; }
        var aEls = _aBarItems.map(function (bi) { return bi.el; });

        // 1) 전부 펼친 상태로 폭 측정
        aEls.forEach(function (el) { el.hidden = false; });
        ovf.hidden = false;
        var cs = getComputedStyle(bar);
        var gap = parseFloat(cs.columnGap || cs.gap) || 0;
        var avail = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var ovfW = ovf.offsetWidth;
        var aW = aEls.map(function (el) { return el.offsetWidth; });
        var total = aW.reduce(function (a, b) { return a + b; }, 0) + gap * Math.max(0, aEls.length - 1);

        // 2) 다 들어가면 ⋯ 숨기고 종료
        if (total <= avail) { ovf.hidden = true; return; }

        // 3) 넘침 — ⋯ 버튼 자리를 남기고 왼쪽부터 채운다
        var used = 0, iCut = aEls.length;
        for (var i = 0; i < aEls.length; i++) {
            var w = aW[i] + (i > 0 ? gap : 0);
            if (used + w + gap + ovfW > avail) { iCut = i; break; }
            used += w;
        }
        for (var j = iCut; j < aEls.length; j++) { aEls[j].hidden = true; }

        // 4) 보이는 영역 끝에 매달린 구분선 제거(조잡함 방지)
        for (var k = iCut - 1; k >= 0; k--) {
            if (_aBarItems[k].cfg.sep) { aEls[k].hidden = true; } else { break; }
        }
    }

    /********************************************************************
     * 오버플로(⋯) 메뉴 — 숨겨진 트랜잭션 항목을 드롭다운으로 제공.
     ********************************************************************/
    function _showOverflowMenu(oAnchor) {
        var aItems = _aBarItems
            .filter(function (bi) { return bi.el.hidden && !bi.cfg.sep; })
            .map(function (bi) {
                var cfg = bi.cfg;
                if (cfg.split) {
                    // App 실행 분할버튼 → 동적 /DEFBR 브라우저 서브메뉴(화살표 메뉴와 동일, WS20 통일)
                    return {
                        icon: cfg.icon, text: cfg.text,
                        items: _getAppExecBrowsers().map(function (b) {
                            return {
                                icon: b.icon, brand: b.brand, text: b.text, disabled: b.disabled,
                                action: function () { _execAppInBrowser(b.key); }
                            };
                        })
                    };
                }
                return { icon: cfg.icon, text: cfg.text, action: function () { _invoke(cfg.ev, cfg.text); } };
            });
        _openMenuAt(oAnchor, aItems, function (it) { if (typeof it.action === "function") { it.action(); } }, "right");
    }

    // App 실행 split 버튼 — 공통 빌더(buildSplitButton)에 위임(정렬/busy/토글은 빌더가 강제).
    function _renderSplitButton(cfg) {
        return _buildSplitButton({
            id: cfg.id, icon: cfg.icon, text: cfg.text, sc: cfg.sc,
            onMain: function () { _invoke(cfg.ev, cfg.text); },                 // 본체 = 기본 브라우저로 실행
            getItems: _getAppExecBrowsers,                                       // 동적 /DEFBR 목록
            onPick: function (it) { _execAppInBrowser(it.key); },                // 선택 브라우저로 실행
            prepare: (typeof oAPP.fn.fnBrowserStateModelRefresh === "function") ? oAPP.fn.fnBrowserStateModelRefresh : null
        });
    }

    /********************************************************************
     * 앱 검색 Suggestion — 저장된 APPID 목록 로드 (P13N 파일)
     *   change/display 진입 시 fnOnSaveAppSuggestion(ws_fn_02) 이 P13N 의
     *   [SYSID].APPSUGG 에 APPID 를 저장 → 여기서 다시 읽어 자동완성으로 제공.
     *   (매번 입력 안 하도록 — 최근 연 앱이 검색창 펼침목록에 뜸)
     ********************************************************************/
    function _loadAppSugg() {
        try {
            var FS = parent.FS;
            var oServerInfo = parent.getServerInfo();
            var sSysID = oServerInfo && oServerInfo.SYSID;
            var sP13nPath = parent.getPath("P13N");
            var oP13n = JSON.parse(FS.readFileSync(sP13nPath, "utf-8"));
            var a = (sSysID && oP13n[sSysID] && oP13n[sSysID].APPSUGG) || [];
            var aIds = a.map(function (o) { return o && o.APPID; }).filter(Boolean);
            WS_STATE.WS10.APPSUGG = aIds;
            return aIds;
        } catch (e) {
            return WS_STATE.WS10.APPSUGG || [];
        }
    }

    function _renderSearchbar() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__searchbar";

        var oLabel = document.createElement("label");
        oLabel.className = "u4a-ws10__searchlabel";
        oLabel.setAttribute("for", "AppNmInput");
        oLabel.textContent = _txt("A33");

        // 앱 검색 입력 — 공통 팩토리(U4AUI.createField). clear(X)/자동완성/F4(value help) 단일화.
        //   trail=2([X][검색])·role=combobox·대문자·특수키(F4/Enter)·dblclick 은 아래에서 보강.
        var oSearchFld = window.U4AUI.createField({
            type: "text", id: "AppNmInput", placeholder: "Search",
            className: "u4a-ws10__searchfield",
            clear: true,
            onClear: function () { WS_STATE.WS10.APPID = ""; },
            suggest: _loadAppSugg,
            onPick: function (v) {
                oSearchFld.input.value = (v || "").toUpperCase();
                WS_STATE.WS10.APPID = oSearchFld.input.value;
            },
            f4: function () { _invoke("ev_AppValueHelp", "App Search Help (F4)"); },  // 맨 우측 Search Help(F4)
            onChange: function (v) {
                var up = (v || "").toUpperCase();
                oSearchFld.input.value = up; WS_STATE.WS10.APPID = up;
            }
        });
        var oInput = oSearchFld.input;
        oInput.autocomplete = "off";
        oInput.setAttribute("role", "combobox");
        oInput.title = "";
        try { oSearchFld.el.querySelector(".u4a-field__vh").title = "Search Help (F4)"; } catch (e) { }
        // F4 키 → 값도움(버튼 클릭과 동일), Enter → no-op(원본 SearchField 동일), 더블클릭 → 전체선택.
        oInput.addEventListener("keydown", function (e) {
            if (e.key === "F4") { e.preventDefault(); _invoke("ev_AppValueHelp", "App Search Help (F4)"); }
            else if (e.key === "Enter") { e.preventDefault(); }
        });
        oInput.addEventListener("dblclick", function () { oInput.select(); });

        o.appendChild(oLabel);
        o.appendChild(oSearchFld.el);
        return o;
    }

    function _renderContent() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__content";
        o.innerHTML = _heroHtml() + _footerHtml();
        //  푸터 닫기(X)는 공통 전역 위임(U4AUI)이 처리 — 화면별 배선 없음.
        return o;
    }

    // 하단 접속정보 상태바 (SAP GUI 상태바 스타일) — 시스템/클라이언트/사용자/언어/서버/WS버전.
    //   라벨은 메시지키 임의생성 금지라 아이콘으로 표시(값만 데이터). 색은 테마 토큰.
    function _renderStatusBar() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__statusbar";
        o.id = "ws10StatusBar";
        var aF = [
            { id: "sys", icon: "server" },          // 시스템(SYSID)
            { id: "client", icon: "hashtag" },      // 클라이언트(CLIENT)
            { id: "user", icon: "user" },           // 사용자(UNAME)
            { id: "langu", icon: "language" },      // 언어(LANGU)
            { id: "server", icon: "network-wired" } // 서버(SERVER_INFO)
        ];
        var s = "";
        for (var i = 0; i < aF.length; i++) {
            s += '<span class="u4a-ws10__stat" data-stat="' + aF[i].id + '">' +
                 _fa(aF[i].icon) + '<span class="u4a-ws10__stat-val">-</span></span>';
        }
        // WS 버전은 우측 끝(SAP GUI 시스템정보 우측 배치)
        s += '<span class="u4a-ws10__stat u4a-ws10__stat--right" data-stat="ws">' +
             _fa("code-branch") + '<span class="u4a-ws10__stat-val">-</span></span>';
        o.innerHTML = s;
        return o;
    }

    // 상태바 값 채우기 — getServerInfo()/getUserInfo() (없으면 "-").
    function _updateStatusBar() {
        var oBar = document.getElementById("ws10StatusBar");
        if (!oBar) { return; }
        var si = {}, ui = {};
        try { si = (parent.getServerInfo && parent.getServerInfo()) || {}; } catch (e) { }
        try { ui = (parent.getUserInfo && parent.getUserInfo()) || {}; } catch (e) { }
        function set(id, v) {
            var el = oBar.querySelector('[data-stat="' + id + '"] .u4a-ws10__stat-val');
            if (el) { el.textContent = (v == null || v === "") ? "-" : String(v); }
        }
        set("sys", si.SYSID || ui.SYSID);
        set("client", si.CLIENT || ui.CLIENT);
        set("user", ui.UNAME);
        set("langu", si.LANGU || ui.LANGU);       // 백엔드 로그온 언어(serverInfo.LANGU 우선)
        // SERVER_INFO 는 {protocol,host,port} 객체 → host:port 문자열로(없으면 SYSTEMID/SERVERIP)
        var sv = si.SERVER_INFO;
        var sServer = (sv && sv.host) ? (sv.host + (sv.port ? ":" + sv.port : "")) : (si.SYSTEMID || si.SERVERIP);
        set("server", sServer);
        set("ws", si.WSVER ? (si.WSVER + (si.WSPATCH_LEVEL ? " (" + si.WSPATCH_LEVEL + ")" : "")) : "");
    }

    // WS10 히어로 배경을 테마별 CSS(.u4a-ws-light-theme — css/ws10_20.css 에 흰배경/페이드/글자/인증마크
    //   규칙 이미 존재)로 전환. (원본 ws_main.js _applyWs10ContPageThemeClass 의 oPage.addStyleClass 이식)
    //   다크/hcb = 클래스 제거(기본 다크 히어로) / 그 외(라이트 계열) = 클래스 추가(흰 히어로).
    function _applyHeroThemeClass() {
        var oPage = document.getElementById("WS10");
        if (!oPage) { return; }
        var sTheme;
        try { sTheme = (window.U4ATheme && window.U4ATheme.current()) || document.documentElement.dataset.theme || ""; }
        catch (e) { sTheme = document.documentElement.dataset.theme || ""; }
        var bDark = sTheme.indexOf("dark") > -1 || sTheme.indexOf("hcb") > -1;
        oPage.classList.toggle("u4a-ws-light-theme", !bDark);
    }

    // 테마 변경(data-theme) 1회 감시 → 히어로 라이트/다크 클래스 자동 토글.
    function _ensureHeroThemeObserver() {
        if (window.__u4aHeroThemeObs) { return; }
        try {
            window.__u4aHeroThemeObs = new MutationObserver(_applyHeroThemeClass);
            window.__u4aHeroThemeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        } catch (e) { }
    }

    // 배경 마크업 (doc 03 §5 _getWs10ContentHtml — ws10_20/index.html 기준 ../../img)
    function _heroHtml() {
        return '' +
            '<div class="u4a-ws-root">' +
            '  <div class="u4a-ws-bg-image"><img src="../../img/UFOA.png" alt=""></div>' +
            '  <div class="u4a-ws-anim-glow"></div>' +
            '  <div class="u4a-ws-bg-fade"></div>' +
            '  <div class="u4a-ws-brand-wrap"><div class="u4a-ws-brand-text">' +
            '    <div class="u4a-ws-brand-u4a">U4A</div><div class="u4a-ws-brand-desc">Workspace</div>' +
            '  </div></div>' +
            '  <div class="u4a-ws-cert-layer">' +
            '    <img src="../../img/licence/hana/hana_w.png">' +
            '    <img src="../../img/licence/hana/hana_cloud_w.png">' +
            '    <img src="../../img/licence/hana/hana_rise_cloud_w.png">' +
            '  </div>' +
            '</div>';
    }

    function _footerHtml() {
        //  공통 푸터 마크업(U4AUI) — WS10/WS20/WS30 단일 소스.
        return window.U4AUI ? window.U4AUI.footerMarkup("ws10Footer") : "";
    }

    function _wireShortcuts() {
        var aMap = [
            { sc: "ctrl+F12", ev: "ev_AppCreate", t: _txt("A01"), dev: true },
            { sc: "F6", ev: "ev_AppChange", t: _txt("A02"), dev: true },
            { sc: "ctrl+F10", ev: "ev_AppDelete", t: _txt("A03"), dev: true },
            { sc: "shift+F11", ev: "ev_AppCopy", t: _txt("A04"), dev: true },
            { sc: "F7", ev: "ev_AppDisplay", t: _txt("A05") },
            { sc: "F8", ev: "ev_AppExec", t: _txt("A06") },
            { sc: "ctrl+F1", ev: "ev_AppExam", t: _txt("A07") },
            { sc: "ctrl+F3", ev: "ev_MultiPrev", t: _txt("A08") }
            // ※ Ctrl+N(새 창)은 여기서 등록하지 않는다 — 앱 글로벌 단축키(ws_common.js
            //   fnSetCommonShortcut → shortcut.js, ws_main 부팅 시 등록)가 원본 owner 다.
            //   여기 또 넣으면 두 핸들러가 같이 발화해 새 창이 2개 뜬다(원본 getShortCutList
            //   에도 Ctrl+N 은 없음 = 페이지 단축키가 아니라 글로벌). 새 창 버튼 클릭은
            //   ev_NewWindow(WIRED_EVENTS)로 정상 동작, 툴바의 "Ctrl+N" 힌트는 글로벌이 충족.
        ];
        // 중복 등록 방지
        if (oAPP.ws10html._scWired) { return; }
        oAPP.ws10html._scWired = true;
        document.addEventListener("keydown", function (e) {
            // 자동 반복(키 꾹 누름) 중복 발화 방지.
            if (e.repeat) { return; }
            // ★ WS10 단축키는 WS10 화면에서만 동작한다.
            //   WS10·WS20 는 같은 문서(#content 교체)라 이 document 리스너가 페이지 이동 후에도
            //   살아있다 → WS20 에서 같은 키를 눌러도 WS10 액션이 발화되던 버그. 현재 페이지가
            //   WS10 이 아니면 무시(WS20 undo/redo 핸들러의 getCurrPage 가드와 동일 패턴).
            try { if (parent.getCurrPage && parent.getCurrPage() !== "WS10") { return; } } catch (e2) { }
            // 모달 팝업이 떠 있으면 메인 단축키 무시(팝업 위에서 뒤 화면 액션 실행 방지).
            if (document.querySelector("dialog[open]")) { return; }
            var parts = [];
            if (e.ctrlKey) { parts.push("ctrl"); }
            if (e.shiftKey) { parts.push("shift"); }
            if (e.altKey) { parts.push("alt"); }
            parts.push(e.key);
            var sCombo = parts.join("+").toLowerCase();
            var hit = null;
            for (var i = 0; i < aMap.length; i++) { if (aMap[i].sc.toLowerCase() === sCombo) { hit = aMap[i]; break; } }
            if (!hit) { return; }
            if (hit.dev && WS_STATE.USERINFO.IS_DEV !== "D") { return; }
            e.preventDefault();
            _invoke(hit.ev, hit.t);
        });
    }

})();
