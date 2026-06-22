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
        setTimeout(function () {
            document.addEventListener("mousedown", _onOutside, true);
            document.addEventListener("keydown", _onEsc, true);
        }, 0);
    }

    /********************************************************************
     * 플로팅 푸터 메시지 (doc 03 §3 /FMSG/WS10 — 10초 자동 제거)
     ********************************************************************/
    var _footerTimer = null;
    function _showFooter(sType, sMsg) {
        var oFooter = document.getElementById("ws10Footer");
        if (!oFooter) { return; }
        oFooter.dataset.type = sType;
        oFooter.dataset.show = "true";
        var map = { E: "circle-exclamation", S: "circle-check", W: "triangle-exclamation", I: "circle-info" };
        oFooter.querySelector(".u4a-ws10__footer-icon").innerHTML = _fa(map[sType] || "circle-info");
        oFooter.querySelector(".u4a-ws10__footer-text").textContent = sMsg;
        if (_footerTimer) { clearTimeout(_footerTimer); }
        _footerTimer = setTimeout(_hideFooter, 10000);
    }
    function _hideFooter() {
        var oFooter = document.getElementById("ws10Footer");
        if (oFooter) { oFooter.dataset.show = "false"; }
        if (_footerTimer) { clearTimeout(_footerTimer); _footerTimer = null; }
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
            oTo.classList.remove("u4aWsHidden");
            oTo.classList.add(sIn);
            oFrom.classList.add(sOut);

            var _done = function () {
                oFrom.classList.add("u4aWsHidden");
                oFrom.classList.remove(sOut);
                oTo.classList.remove(sIn);
                oFrom.removeEventListener("animationend", _done);
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
     *   공통 헤더(AI/eye/테마스와치/T-CODE/pin/zoom/search/power)는 동일하게 부착.
     ********************************************************************/
    oAPP.ws10html.buildMenubar = function (aCats, fnSelect) {
        var o = document.createElement("div");
        o.className = "u4a-ws10__menubar";
        (aCats || []).forEach(function (cat) {
            if (cat.staffOnly && !WS_STATE.IS_STAFF) { return; }
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
        });
        o.appendChild(_renderCommonHeader());
        return o;
    };

    // 테마 스와치 버튼 (5종 테마 선택 트리거). 공통 헤더(AI 우측, SAP 로고 좌측)에 둔다.
    function _buildThemeSwatch() {
        var oSwatch = document.createElement("button");
        oSwatch.className = "u4a-theme-swatch";
        oSwatch.type = "button";
        oSwatch.title = "Theme";
        oSwatch.setAttribute("data-menu-anchor", "theme");
        oSwatch.addEventListener("click", function () {
            var sCur = (window.U4ATheme && window.U4ATheme.current()) || "horizon_white";
            var aItems = THEMES.map(function (t) { return { key: t.key, text: t.text, icon: "circle-half-stroke", disabled: t.key === sCur }; });
            _openMenuAt(oSwatch, aItems, function (it) {
                if (window.U4ATheme) { window.U4ATheme.apply(it.key); }
                // 네이티브 창 배경색도 새 테마 배경으로 갱신 — 안 하면 화면 이동(페이지/iframe 로드) 중
                //   창 생성 시 고정된 옛 배경(예: white)이 새서 흰색 플래시가 보인다.
                try {
                    var oWin = _currWin();
                    var sBg = (parent.WSUTIL && parent.WSUTIL.getThemeBackgroundColor) ? parent.WSUTIL.getThemeBackgroundColor(it.key) : "";
                    if (oWin && sBg && oWin.setBackgroundColor) { oWin.setBackgroundColor(sBg); }
                } catch (e) { }
            }, "right");
        });
        return oSwatch;
    }

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

        // 테마 변경 버튼(스와치) — 눈(Light/Dark) 토글을 제거하고 이 자리로 이동.
        o.appendChild(_buildThemeSwatch());

        // SAP 로고 (svg) — T-CODE 좌측. 클릭 시 T-CODE 실행 로직으로 SMEN(SAP 메인메뉴) 실행.
        var oSapLogo = document.createElement("img");
        oSapLogo.className = "u4a-sap-logo";
        oSapLogo.src = "../../svg/logos--sap.svg"; // www/svg/logos--sap.svg (logo.png 와 동일 기준)
        oSapLogo.alt = "SAP";
        oSapLogo.title = "SMEN";
        oSapLogo.addEventListener("error", function () { oSapLogo.style.visibility = "hidden"; });
        oSapLogo.addEventListener("click", function () { _runTcode("SMEN", true); });
        o.appendChild(oSapLogo);

        var oTcode = document.createElement("input");
        oTcode.className = "u4a-tcode u4a-field__input";
        oTcode.id = "sapTcode";
        oTcode.type = "text";
        oTcode.placeholder = "SAP T-CODE";
        oTcode.autocomplete = "off";
        oTcode.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); _runTcode(oTcode.value); }
        });
        // SAP T-CODE 이력 자동완성 (원본 ev_suggestSapTcode — fnReadTCodeSuggestion 의 {TCODE} 목록)
        if (window.U4AUI && U4AUI.attachSuggest && typeof oAPP.fn.fnReadTCodeSuggestion === "function") {
            U4AUI.attachSuggest(oTcode,
                function () {
                    try { return (oAPP.fn.fnReadTCodeSuggestion() || []).map(function (o) { return o && o.TCODE; }).filter(Boolean); }
                    catch (e) { return []; }
                },
                function (v) { oTcode.value = v; });   // 선택 시 채움(원본처럼 실행은 Enter)
        }

        // [공통] 클리어(X) — 값 있을 때만 노출. 다른 입력(Login/WS20/ServerList)과 동일한
        //   shell.css .u4a-field + U4AUI.attachClear 컴포넌트 사용(data-filled 토글).
        var oTcodeField = document.createElement("div");
        oTcodeField.className = "u4a-field u4a-tcode-field";
        oTcodeField.setAttribute("data-trail", "1");
        oTcodeField.appendChild(oTcode);

        var oTcodeClr = document.createElement("button");
        oTcodeClr.type = "button";
        oTcodeClr.className = "u4a-field__clear";
        oTcodeClr.title = "Clear";
        oTcodeClr.textContent = "×"; // ×
        oTcodeField.appendChild(oTcodeClr);

        if (window.U4AUI && U4AUI.attachClear) {
            U4AUI.attachClear(oTcode, oTcodeClr);
        }
        o.appendChild(oTcodeField);

        o.appendChild(_iconBtn(ICON.pin, "Pin", function () { _invoke("ev_Pin", "Pin"); }));
        o.appendChild(_iconBtn(ICON.zoom, "Zoom In", function () { _invoke("ev_ZoomIn", "Zoom In"); }));
        o.appendChild(_iconBtn(ICON.search, "Search", function () { _invoke("ev_GlobalSearch", "Search"); }));

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
        oBtn.innerHTML = (bOn ? ICON.connected : ICON.disconnected) + "<span>" + (bOn ? _txt("M431") : _txt("M432")) + "</span>";
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

        // 공통 입력 컴포넌트(.u4a-field) 소비 — clear(X)는 값 있을 때만, 맨 우측은 Search 헬프.
        // (doc 15 공통 입력 UX 가이드)  trail=2 : [X][검색]
        var oField = document.createElement("div");
        oField.className = "u4a-ws10__searchfield u4a-field";
        oField.dataset.trail = "2";

        var oInput = document.createElement("input");
        oInput.className = "u4a-input u4a-field__input";
        oInput.id = "AppNmInput";
        oInput.type = "text";
        oInput.autocomplete = "off";
        oInput.setAttribute("role", "combobox");
        oInput.placeholder = "Search";
        oInput.addEventListener("change", function () { oInput.value = (oInput.value || "").toUpperCase(); WS_STATE.WS10.APPID = oInput.value; });
        oInput.addEventListener("keydown", function (e) {
            // F4 → 앱 검색 도움(value help). 검색 아이콘 클릭과 동일.
            if (e.key === "F4") { e.preventDefault(); _invoke("ev_AppValueHelp", "App Search Help (F4)"); }
            // Enter → 원본(sap.m.SearchField search → ev_AppValueHelp)은 keyCode 13 이면
            //   즉시 return = 아무 동작 안 함(Display/팝업 X). 동일하게 no-op(기본 동작만 방지).
            else if (e.key === "Enter") { e.preventDefault(); }
        });
        oInput.addEventListener("dblclick", function () { oInput.select(); });

        // 값 있을 때만 보이는 clear(X) — 공통 컴포넌트 (U4AUI.attachClear 가 노출/비우기 처리)
        var oClearBtn = document.createElement("button");
        oClearBtn.className = "u4a-field__clear";
        oClearBtn.type = "button";
        oClearBtn.title = "Clear";
        oClearBtn.setAttribute("aria-label", "Clear");
        oClearBtn.tabIndex = -1;
        oClearBtn.innerHTML = ICON.clear;

        // 맨 우측 : Search Help (F4) — 공통 트레일링 슬롯(.u4a-field__vh)
        var oSearchBtn = document.createElement("button");
        oSearchBtn.className = "u4a-field__vh";
        oSearchBtn.type = "button";
        oSearchBtn.title = "Search Help (F4)";
        oSearchBtn.innerHTML = ICON.search;
        oSearchBtn.addEventListener("click", function () { _invoke("ev_AppValueHelp", "App Search Help (F4)"); });

        oField.appendChild(oInput);
        oField.appendChild(oClearBtn);
        oField.appendChild(oSearchBtn);
        o.appendChild(oLabel);
        o.appendChild(oField);

        // clear(X) 동작 연결 — 비운 뒤 모델(APPID)도 동기화.
        //   반환된 _syncClear 는 "프로그램적 value set 후" 노출상태를 재계산하는 함수.
        var _syncClear = function () {};
        if (window.U4AUI && window.U4AUI.attachClear) {
            _syncClear = window.U4AUI.attachClear(oInput, oClearBtn, function () { WS_STATE.WS10.APPID = ""; });
        }

        if (window.U4AUI && window.U4AUI.attachSuggest) {
            // fnItems = 저장된 APPID 목록(매 포커스마다 P13N 에서 최신 로드 → 방금 연 앱도 노출)
            window.U4AUI.attachSuggest(oInput, _loadAppSugg, function (v) {
                oInput.value = (v || "").toUpperCase();
                WS_STATE.WS10.APPID = oInput.value;
                // suggestion 선택은 input 이벤트를 발화하지 않으므로(자동완성 재오픈 방지),
                // clear(X) 노출 상태를 직접 재계산해 준다.
                _syncClear();
            });
        }
        return o;
    }

    function _renderContent() {
        var o = document.createElement("div");
        o.className = "u4a-ws10__content";
        o.innerHTML = _heroHtml() + _footerHtml();
        o.querySelector(".u4a-ws10__footer-close").addEventListener("click", _hideFooter);
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
        return '' +
            '<div class="u4a-ws10__footer" id="ws10Footer" data-show="false" data-type="I">' +
            '  <span class="u4a-ws10__footer-icon">' + _fa("circle-info") + '</span>' +
            '  <span class="u4a-ws10__footer-text"></span>' +
            '  <button class="u4a-btn-icon u4a-ws10__footer-close" type="button" title="Close">' + ICON.close + '</button>' +
            '</div>';
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
