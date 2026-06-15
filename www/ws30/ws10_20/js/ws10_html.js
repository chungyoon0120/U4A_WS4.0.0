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
     * 메시지 (1단계: 영문 사전 — doc 03 원본 라벨. 2단계에서 fnGetMsgClsText 로 교체)
     ********************************************************************/
    var MSG = {
        Extras: "Extras", Utilities: "Utilities", System: "System", Help: "Help", Test: "Test",
        B40: "App. Package Change", B41: "App. Import/Export", B42: "App. Importing",
        B43: "App. Exporting", B45: "Shortcut Manager", B46: "U4A Shortcut Create", B48: "About U4A WS IDE",
        B49: "Select Browser Type", REC: "Screen Recording", M059: "Source Pattern",
        M068: "Icon Viewer", M047: "Icon List", M067: "Image Icons",
        A09: "New Window", B51: "Close Window", B52: "Options", B53: "Logoff",
        B55: "Administrator", M252: "DevTool", B54: "Release Note", B70: "Error Log", C42: "Server Information",
        B44: "U4A Help Document", M253: "Keyboard Shortcut List",
        A01: "Create", A02: "Change", A03: "Delete", A04: "Copy", A05: "Display",
        A06: "Application Execution", A07: "Example Open", A08: "App Multi Preview", A33: "Application name",
        M432: "AI Disconnected", M431: "AI Connected"
    };
    function _txt(k, f) { return MSG[k] || f || k; }

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid)
     ********************************************************************/
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };
    var ICON = {
        min: _fa("window-minimize"), max: _fa("window-maximize"), close: _fa("xmark"),
        disconnected: _fa("plug-circle-xmark"), connected: _fa("plug-circle-check"),
        eye: _fa("eye"), eyeSlash: _fa("eye-slash"), pin: _fa("thumbtack"),
        zoom: _fa("magnifying-glass-plus"), search: _fa("magnifying-glass"), power: _fa("power-off"),
        caret: _fa("chevron-down")
    };

    /********************************************************************
     * 윈도우 메뉴 데이터 (doc 03 §4 / fnGetWindowMenuListWS10 미러)
     ********************************************************************/
    function _getWindowMenu() {
        return [
            {
                key: "WMENU10", text: _txt("Extras"), items: [
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
                key: "WMENU20", text: _txt("Utilities"), items: [
                    { key: "WMENU20_01", icon: "globe", text: _txt("B49") },
                    { key: "WMENU20_03", icon: "video", text: _txt("REC") },
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
                key: "WMENU30", text: _txt("System"), items: [
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
                key: "WMENU50", text: _txt("Help"), items: [
                    { key: "WMENU50_01", icon: "book-open-reader", text: _txt("B44") },
                    { key: "WMENU50_04", icon: "keyboard", text: _txt("M253") }
                ]
            },
            {
                key: "Test10", text: _txt("Test"), staffOnly: true, items: [
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
    var WIRED_EVENTS = { ev_AppDisplay: 1, ev_AppChange: 1, ev_NewWindow: 1 };
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
     * 공통 드롭다운/메뉴 (shell.css .u4a-menu)
     ********************************************************************/
    var _openAnchor = null;

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

        var oEye = document.createElement("button");
        oEye.className = "u4a-btn-icon";
        oEye.type = "button";
        oEye.title = "Light / Dark";
        oEye.innerHTML = ICON.eyeSlash;
        oEye.addEventListener("click", function () {
            var sCur = (window.U4ATheme && window.U4ATheme.current()) || "horizon_white";
            var sNext = (sCur === "horizon_dark") ? "horizon_white" : "horizon_dark";
            if (window.U4ATheme) { window.U4ATheme.apply(sNext); }
            oEye.innerHTML = (sNext === "horizon_dark") ? ICON.eyeSlash : ICON.eye;
        });
        o.appendChild(oEye);

        var oSwatch = document.createElement("button");
        oSwatch.className = "u4a-theme-swatch";
        oSwatch.type = "button";
        oSwatch.title = "Theme";
        oSwatch.setAttribute("data-menu-anchor", "theme");
        oSwatch.addEventListener("click", function () {
            var sCur = (window.U4ATheme && window.U4ATheme.current()) || "horizon_white";
            var aItems = THEMES.map(function (t) { return { key: t.key, text: t.text, icon: "circle-half-stroke", disabled: t.key === sCur }; });
            _openMenuAt(oSwatch, aItems, function (it) { if (window.U4ATheme) { window.U4ATheme.apply(it.key); } }, "right");
        });
        o.appendChild(oSwatch);

        var oTcode = document.createElement("input");
        oTcode.className = "u4a-tcode";
        oTcode.id = "sapTcode";
        oTcode.type = "text";
        oTcode.placeholder = "SAP T-CODE";
        oTcode.autocomplete = "off";
        oTcode.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { _invoke("ev_TcodeRun", "SAP T-CODE: " + (oTcode.value || "")); }
        });
        o.appendChild(oTcode);

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
        _getSubHeaderButtons().forEach(function (cfg) {
            if (cfg.devOnly && !bDev) { return; }
            if (cfg.sep) {
                var s = document.createElement("div");
                s.className = "u4a-tx-sep";
                o.appendChild(s);
                return;
            }
            if (cfg.split) { o.appendChild(_renderSplitButton(cfg)); return; }
            var b = document.createElement("button");
            b.className = "u4a-tx-btn" + (cfg.reject ? " u4a-tx-btn--reject" : "");
            b.type = "button";
            b.id = cfg.id;
            b.title = cfg.text + " (" + cfg.sc + ")";
            b.innerHTML = _fa(cfg.icon) + "<span>" + cfg.text + "</span>";
            b.addEventListener("click", function () { _invoke(cfg.ev, cfg.text); });
            o.appendChild(b);
        });
        return o;
    }

    function _renderSplitButton(cfg) {
        var wrap = document.createElement("div");
        wrap.className = "u4a-split";
        wrap.id = cfg.id;
        var main = document.createElement("button");
        main.className = "u4a-split__main";
        main.type = "button";
        main.title = cfg.text + " (" + cfg.sc + ")";
        main.innerHTML = _fa(cfg.icon) + "<span>" + cfg.text + "</span>";
        main.addEventListener("click", function () { _invoke(cfg.ev, cfg.text); });
        var arrow = document.createElement("button");
        arrow.className = "u4a-split__arrow";
        arrow.type = "button";
        arrow.title = cfg.text;
        arrow.setAttribute("data-menu-anchor", "appexec");
        arrow.innerHTML = ICON.caret;
        arrow.addEventListener("click", function () {
            var aItems = APP_EXEC_BROWSERS.map(function (b) { return { key: b.key, text: b.text, icon: b.icon, brand: b.brand }; });
            _openMenuAt(arrow, aItems, function (it) { _invoke("ev_AppExec", cfg.text + " → " + it.text); }, "left");
        });
        wrap.appendChild(main);
        wrap.appendChild(arrow);
        return wrap;
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

        var oField = document.createElement("div");
        oField.className = "u4a-ws10__searchfield";

        var oInput = document.createElement("input");
        oInput.className = "u4a-input";
        oInput.id = "AppNmInput";
        oInput.type = "search";
        oInput.autocomplete = "off";
        oInput.setAttribute("role", "combobox");
        oInput.placeholder = "Search";
        oInput.addEventListener("change", function () { oInput.value = (oInput.value || "").toUpperCase(); WS_STATE.WS10.APPID = oInput.value; });
        oInput.addEventListener("keydown", function (e) {
            if (e.key === "F4") { e.preventDefault(); _invoke("ev_AppValueHelp", "App Search Help (F4)"); }
            else if (e.key === "Enter") { _invoke("ev_AppDisplay", _txt("A05")); }
        });
        oInput.addEventListener("dblclick", function () { oInput.select(); });

        var oSearchBtn = document.createElement("button");
        oSearchBtn.className = "u4a-ws10__searchbtn";
        oSearchBtn.type = "button";
        oSearchBtn.title = "Search Help (F4)";
        oSearchBtn.innerHTML = ICON.search;
        oSearchBtn.addEventListener("click", function () { _invoke("ev_AppValueHelp", "App Search Help (F4)"); });

        oField.appendChild(oInput);
        oField.appendChild(oSearchBtn);
        o.appendChild(oLabel);
        o.appendChild(oField);

        if (window.U4AUI && window.U4AUI.attachSuggest) {
            // fnItems = 저장된 APPID 목록(매 포커스마다 P13N 에서 최신 로드 → 방금 연 앱도 노출)
            window.U4AUI.attachSuggest(oInput, _loadAppSugg, function (v) {
                oInput.value = (v || "").toUpperCase();
                WS_STATE.WS10.APPID = oInput.value;
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
            { sc: "ctrl+F3", ev: "ev_MultiPrev", t: _txt("A08") },
            { sc: "ctrl+N", ev: "ev_NewWindow", t: _txt("A09") }
        ];
        // 중복 등록 방지
        if (oAPP.ws10html._scWired) { return; }
        oAPP.ws10html._scWired = true;
        document.addEventListener("keydown", function (e) {
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
