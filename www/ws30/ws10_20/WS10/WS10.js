/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : WS10.js
 * - file Desc : WS10 (애플리케이션 검색 / 홈) 화면 — HTML5 컨버전
 * ----------------------------------------------------------------------
 * doc 03 §5 / §11(B) / §12, doc 12 테마 전략 기반 SAP UI5 → 순수 HTML5.
 *   · 셸 크롬(타이틀바·윈도우 메뉴·공통 헤더·서브헤더·검색·푸터)을 HTML5 로 재현.
 *   · Electron/Node 자원(REMOTE/CURRWIN/setBusy/sendAjax/WSUTIL 등, doc 03 §11 A)은
 *     호출부를 그대로 유지한다. 셸 통합 시 parent.* 가 제공된다.
 *   · 독립 미리보기(브라우저 단독)에서는 parent 부재 → 폴백 렌더 + 안내 푸터.
 *   · 색/모양은 theme/tokens.css 의미 토큰만 소비, 전환은 U4ATheme.
 *
 * ⚠ 메뉴 key / itemSelected → fnHmwsXX_XX_XX 위임 계약(doc 03 §4·§12.5)과
 *   트랜잭션 이벤트명(ev_AppCreate 등)을 그대로 보존한다. 셸 통합 시
 *   _invoke() 가 parent.oAPP.events / oAPP.fn 의 실제 핸들러로 연결된다.
 ************************************************************************/
(function () {
    "use strict";

    /********************************************************************
     * Electron / Node 자원 (셸 통합 시 유지 — doc 03 §11 A)
     *   독립 미리보기에서는 parent.require 가 없으므로 가드한다.
     ********************************************************************/
    const _hasShell = !!(typeof parent !== "undefined" && parent && parent.require);
    const REMOTE = _hasShell ? (parent.REMOTE || null) : null;
    const CURRWIN = (REMOTE && REMOTE.getCurrentWindow) ? REMOTE.getCurrentWindow() : null;

    const oAPP = { fn: {}, attr: {}, events: {}, msg: {} };
    window.oAPP = window.oAPP || oAPP;

    /********************************************************************
     * 상태 저장소 (UI5 Core JSONModel /WS10·/WMENU·/FMSG·/UAI 대체)
     ********************************************************************/
    const WS_STATE = {
        WS10: { APPID: "", APPSUGG: [] },
        UAI: { state: false },          // AI 연결 상태
        USERINFO: { IS_DEV: "D" },      // 개발모드(D)면 Create/Change/Delete/Copy 노출
        IS_STAFF: true                  // R&D Staff 면 Test 메뉴 노출
    };

    /********************************************************************
     * 메시지 텍스트 (셸: fnGetMsgClsText / WSUTIL.getWsMsgClsTxt,
     *   독립: 아래 영문 사전 — doc 03 의 원본 라벨과 일치)
     *   셸 통합 시 _txt() 가 parent 의 메시지 클래스 조회로 위임된다.
     ********************************************************************/
    const MSG = {
        // 윈도우 메뉴 카테고리 (B34~B39, B69)
        Extras: "Extras", Utilities: "Utilities", System: "System", Help: "Help", Test: "Test",
        // Extras
        B40: "App. Package Change", B41: "App. Import/Export", B42: "App. Importing",
        B43: "App. Exporting", B45: "Shortcut Manager", B46: "U4A Shortcut Create", B48: "About U4A WS IDE",
        // Utilities
        B49: "Select Browser Type", REC: "Screen Recording", M059: "Source Pattern",
        M068: "Icon Viewer", M047: "Icon List", M067: "Image Icons",
        // System
        A09: "New Window", B51: "Close Window", B52: "Options", B53: "Logoff",
        B55: "Administrator", M252: "DevTool", B54: "Release Note", B70: "Error Log", C42: "Server Information",
        // Help
        B44: "U4A Help Document", M253: "Keyboard Shortcut List",
        // 서브헤더 트랜잭션 (A01~A09, A33)
        A01: "Create", A02: "Change", A03: "Delete", A04: "Copy", A05: "Display",
        A06: "Application Execution", A07: "Example Open", A08: "App Multi Preview", A33: "Application name",
        // 공통 헤더
        M432: "AI Disconnected", M431: "AI Connected"
    };

    function _txt(sKey, sFallback) {
        // 셸 통합 시: parent.WSUTIL.getWsMsgClsTxt / oAPP.common.fnGetMsgClsText 로 교체 지점.
        return MSG[sKey] || sFallback || sKey;
    }

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid — currentColor 상속, doc 12 §6.6 G)
     ********************************************************************/
    const _fa = (s) => `<i class="fa-solid fa-${s}"></i>`;
    const ICON = {
        min: _fa("window-minimize"), max: _fa("window-maximize"), restore: _fa("window-restore"), close: _fa("xmark"),
        disconnected: _fa("plug-circle-xmark"), connected: _fa("plug-circle-check"),
        eye: _fa("eye"), eyeSlash: _fa("eye-slash"), pin: _fa("thumbtack"),
        zoom: _fa("magnifying-glass-plus"), search: _fa("magnifying-glass"), power: _fa("power-off"),
        caret: _fa("chevron-down"), clear: _fa("xmark")
    };

    /********************************************************************
     * 윈도우 메뉴 데이터 (doc 03 §4 / ws_fn_01.fnGetWindowMenuListWS10)
     *   key 문자열 분기 계약(fnHmwsXX_XX_XX) 그대로 보존.
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

    /********************************************************************
     * 서브헤더 트랜잭션 버튼 (doc 03 §5 Sub Header)
     *   devOnly: IS_DEV=="D" 일 때만 노출 (Create/Change/Delete/Copy + 첫 구분선)
     ********************************************************************/
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

    // 앱 실행 분할버튼 드롭다운 — 설치 브라우저 (셸: /DEFBR 모델)
    const APP_EXEC_BROWSERS = [
        { key: "CHROME", text: "Chrome", icon: "chrome", brand: true },
        { key: "MSEDGE", text: "Edge", icon: "edge", brand: true }
    ];

    // 테마 선택 (doc 12 §3 — 5종)
    const THEMES = [
        { key: "horizon_white", text: "Horizon White" },
        { key: "horizon_dark", text: "Horizon Dark" },
        { key: "horizon_purple", text: "Horizon Purple" },
        { key: "horizon_red", text: "Horizon Red" },
        { key: "horizon_green", text: "Horizon Green" }
    ];

    /********************************************************************
     * 액션 라우터 — 셸 통합 시 실제 핸들러로 위임, 독립 시 안내 푸터.
     *   doc 03 §12.5 계약: 이벤트명/메뉴 key 분기를 그대로 보존한다.
     ********************************************************************/
    function _invoke(sName, sLabel) {
        try {
            const oShellApp = _hasShell ? parent.oAPP : null;
            const fn = oShellApp && (
                (oShellApp.events && oShellApp.events[sName]) ||
                (oShellApp.fn && oShellApp.fn[sName])
            );
            if (typeof fn === "function") {
                fn();
                return;
            }
        } catch (e) { /* fallthrough → 안내 */ }
        _showFooter("I", `${sLabel || sName} — 셸 통합 시 동작합니다.`);
    }

    // 윈도우 메뉴 항목 선택 → key 분기 (셸: ev_pressWmenuItemWS10 → fnHmws*)
    function _invokeMenu(sKey, sLabel) {
        try {
            const oShellApp = _hasShell ? parent.oAPP : null;
            const ev = oShellApp && oShellApp.events && oShellApp.events.ev_pressWmenuItemWS10;
            if (typeof ev === "function") {
                ev({ getParameter: () => ({ getProperty: () => sKey }) });
                return;
            }
        } catch (e) { /* fallthrough */ }
        _showFooter("I", `${sLabel} (${sKey}) — 셸 통합 시 동작합니다.`);
    }

    /********************************************************************
     * 공통 드롭다운/메뉴 (sap.m.Menu 대체 — shell.css .u4a-menu)
     ********************************************************************/
    let _openMenuRoot = null;     // 현재 열린 최상위 메뉴 엘리먼트
    let _openMenuAnchorBtn = null;

    function _closeMenus() {
        document.querySelectorAll(".u4a-menu").forEach((m) => m.remove());
        if (_openMenuAnchorBtn) { _openMenuAnchorBtn.setAttribute("aria-expanded", "false"); }
        _openMenuRoot = null;
        _openMenuAnchorBtn = null;
        document.removeEventListener("mousedown", _onMenuOutside, true);
        document.removeEventListener("keydown", _onMenuEsc, true);
    }

    function _onMenuOutside(ev) {
        if (!ev.target.closest(".u4a-menu") && !ev.target.closest("[data-menu-anchor]")) {
            _closeMenus();
        }
    }
    function _onMenuEsc(ev) {
        if (ev.key === "Escape") { _closeMenus(); }
    }

    // aItems: [{key,text,icon,items?,disabled?}] / fnSelect(item)
    function _buildMenuEl(aItems, fnSelect) {
        const oMenu = document.createElement("div");
        oMenu.className = "u4a-menu";
        oMenu.setAttribute("role", "menu");

        aItems.forEach((it) => {
            if (it.visible === false) { return; }
            const oItem = document.createElement("div");
            oItem.className = "u4a-menu__item";
            oItem.setAttribute("role", "menuitem");
            if (it.disabled) { oItem.setAttribute("aria-disabled", "true"); }

            const sIcon = it.icon
                ? (it.brand ? `<i class="fa-brands fa-${it.icon}"></i>` : _fa(it.icon))
                : `<i></i>`;
            oItem.innerHTML = `${sIcon}<span class="u4a-menu__item-text">${it.text}</span>`;

            const bHasSub = Array.isArray(it.items) && it.items.length > 0;
            if (bHasSub) { oItem.classList.add("u4a-menu__item--has-sub"); }

            if (!it.disabled) {
                if (bHasSub) {
                    // 서브메뉴 — hover/click 로 옆에 펼침
                    oItem.addEventListener("mouseenter", () => _openSubMenu(oItem, it.items, fnSelect));
                    oItem.addEventListener("click", (e) => { e.stopPropagation(); _openSubMenu(oItem, it.items, fnSelect); });
                } else {
                    oItem.addEventListener("mouseenter", () => _closeSiblingSub(oMenu));
                    oItem.addEventListener("click", (e) => {
                        e.stopPropagation();
                        _closeMenus();
                        fnSelect(it);
                    });
                }
            }
            oMenu.appendChild(oItem);
        });
        return oMenu;
    }

    function _closeSiblingSub(oMenu) {
        // 현재 메뉴보다 깊은(나중에 추가된) 서브메뉴 닫기
        const all = Array.from(document.querySelectorAll(".u4a-menu"));
        const idx = all.indexOf(oMenu);
        all.slice(idx + 1).forEach((m) => m.remove());
    }

    function _openSubMenu(oAnchorItem, aItems, fnSelect) {
        // 형제 서브 닫고 새로 연다
        const oParentMenu = oAnchorItem.closest(".u4a-menu");
        _closeSiblingSub(oParentMenu);
        const oSub = _buildMenuEl(aItems, fnSelect);
        document.body.appendChild(oSub);
        const r = oAnchorItem.getBoundingClientRect();
        let left = r.right - 2;
        if (left + oSub.offsetWidth > window.innerWidth) { left = r.left - oSub.offsetWidth + 2; }
        let top = r.top;
        if (top + oSub.offsetHeight > window.innerHeight) { top = Math.max(4, window.innerHeight - oSub.offsetHeight - 4); }
        oSub.style.left = left + "px";
        oSub.style.top = top + "px";
    }

    function _openMenuAt(oAnchor, aItems, fnSelect, sAlign) {
        const bSame = _openMenuAnchorBtn === oAnchor;
        _closeMenus();
        if (bSame) { return; }   // 토글: 같은 버튼 다시 누르면 닫기만

        const oMenu = _buildMenuEl(aItems, fnSelect);
        document.body.appendChild(oMenu);
        const r = oAnchor.getBoundingClientRect();
        let left = (sAlign === "right") ? (r.right - oMenu.offsetWidth) : r.left;
        if (left + oMenu.offsetWidth > window.innerWidth - 4) { left = window.innerWidth - oMenu.offsetWidth - 4; }
        if (left < 4) { left = 4; }
        oMenu.style.left = left + "px";
        oMenu.style.top = (r.bottom + 2) + "px";

        oAnchor.setAttribute("aria-expanded", "true");
        _openMenuRoot = oMenu;
        _openMenuAnchorBtn = oAnchor;
        setTimeout(() => {
            document.addEventListener("mousedown", _onMenuOutside, true);
            document.addEventListener("keydown", _onMenuEsc, true);
        }, 0);
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

    /********************************************************************
     * 렌더링 (UI5 → HTML5)  — doc 03 §11 B 매핑
     ********************************************************************/
    oAPP.fn.fnOnInitRendering = function () {
        const oContent = document.getElementById("content");
        oContent.innerHTML = "";

        oContent.appendChild(_renderTitlebar());
        oContent.appendChild(_renderMenubar());
        oContent.appendChild(_renderSubHeader());
        oContent.appendChild(_renderSearchbar());
        oContent.appendChild(_renderContent());

        _wireShortcuts();

        oContent.style.display = "flex";
        requestAnimationFrame(() => oContent.classList.add("u4a-fade--in"));
    };

    // ── Row 1 : 타이틀바 (oRootPage.customHeader Bar, draggable) ──
    function _renderTitlebar() {
        const o = document.createElement("header");
        o.className = "u4a-titlebar u4a-ws10__titlebar";
        o.innerHTML =
            `<img class="u4a-titlebar__logo" src="../../../img/logo.png" alt="U4A">` +
            `<span class="u4a-titlebar__title">U4A Workspace - Main</span>` +
            `<span class="u4a-titlebar__spacer"></span>` +
            `<button class="u4a-winbtn" data-action="min" title="Minimize">${ICON.min}</button>` +
            `<button class="u4a-winbtn" id="maxWinBtn" data-action="max" title="Maximize">${ICON.max}</button>` +
            `<button class="u4a-winbtn u4a-winbtn--close" data-action="close" title="Close">${ICON.close}</button>`;

        o.querySelector('[data-action="min"]').addEventListener("click", () => CURRWIN ? CURRWIN.minimize() : _showFooter("I", "Minimize"));
        o.querySelector('[data-action="max"]').addEventListener("click", () => {
            if (!CURRWIN) { return _showFooter("I", "Maximize / Restore"); }
            if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); }
        });
        o.querySelector('[data-action="close"]').addEventListener("click", () => CURRWIN ? CURRWIN.close() : _showFooter("I", "Close Window"));
        return o;
    }

    // ── Row 2 : 윈도우 메뉴 툴바 + 공통 헤더 (customHeader OverflowToolbar) ──
    function _renderMenubar() {
        const o = document.createElement("div");
        o.className = "u4a-ws10__menubar";

        // 좌측 : 메뉴 카테고리 버튼
        _getWindowMenu().forEach((cat) => {
            if (cat.staffOnly && !WS_STATE.IS_STAFF) { return; }
            const b = document.createElement("button");
            b.className = "u4a-wmenu-btn";
            b.type = "button";
            b.textContent = cat.text;
            b.setAttribute("data-menu-anchor", cat.key);
            b.setAttribute("aria-haspopup", "true");
            b.setAttribute("aria-expanded", "false");
            b.addEventListener("click", () => {
                _openMenuAt(b, cat.items, (it) => _invokeMenu(it.key, it.text), "left");
            });
            // 이미 다른 메뉴가 열린 상태면 hover 로 전환 (메뉴바 UX)
            b.addEventListener("mouseenter", () => {
                if (_openMenuAnchorBtn && _openMenuAnchorBtn !== b) {
                    _openMenuAt(b, cat.items, (it) => _invokeMenu(it.key, it.text), "left");
                }
            });
            o.appendChild(b);
        });

        // 우측 : 공통 헤더 영역
        o.appendChild(_renderCommonHeader());
        return o;
    }

    // 테마 스와치 버튼 (5종 테마 선택 트리거). 공통 헤더(AI 우측, SAP 로고 좌측)에 둔다.
    function _buildThemeSwatch() {
        const oSwatch = document.createElement("button");
        oSwatch.className = "u4a-theme-swatch";
        oSwatch.type = "button";
        oSwatch.title = "Theme";
        oSwatch.setAttribute("data-menu-anchor", "theme");
        oSwatch.addEventListener("click", () => {
            const sCur = (window.U4ATheme && window.U4ATheme.current()) || "horizon_white";
            const aItems = THEMES.map((t) => Object.assign({}, t, { icon: "circle-half-stroke", disabled: t.key === sCur }));
            _openMenuAt(oSwatch, aItems, (it) => _applyTheme(it.key), "right");
        });
        return oSwatch;
    }

    function _renderCommonHeader() {
        const o = document.createElement("div");
        o.className = "u4a-ws10__common";

        // AI 연결/해제 버튼 (BUTTON6)
        const oAi = document.createElement("button");
        oAi.className = "u4a-ai-btn";
        oAi.id = "aiConnBtn";
        oAi.type = "button";
        _renderAiBtn(oAi);
        oAi.addEventListener("click", () => {
            WS_STATE.UAI.state = !WS_STATE.UAI.state;
            _renderAiBtn(oAi);
            // 셸 통합 시: oAPP.fn.setConnectionAI(!!state) (ws_fn_05.js)
            _invoke("setConnectionAI", WS_STATE.UAI.state ? _txt("M431") : _txt("M432"));
        });
        o.appendChild(oAi);

        // 테마 변경 버튼(스와치) — 눈(Light/Dark) 토글을 제거하고 이 자리로 이동.
        o.appendChild(_buildThemeSwatch());

        // SAP 로고 (svg) — T-CODE 좌측. 클릭 시 T-CODE 실행 로직으로 SMEN(SAP 메인메뉴) 실행.
        const oSapLogo = document.createElement("img");
        oSapLogo.className = "u4a-sap-logo";
        oSapLogo.src = "../../../svg/logos--sap.svg"; // www/svg/logos--sap.svg (logo.png 와 동일 기준)
        oSapLogo.alt = "SAP";
        oSapLogo.title = "SMEN";
        oSapLogo.addEventListener("error", () => { oSapLogo.style.visibility = "hidden"; });
        oSapLogo.addEventListener("click", () => { _invoke("ev_TcodeRun", "SAP T-CODE: SMEN"); });
        o.appendChild(oSapLogo);

        // SAP T-CODE 입력
        const oTcode = document.createElement("input");
        oTcode.className = "u4a-tcode";
        oTcode.id = "sapTcode";
        oTcode.type = "text";
        oTcode.placeholder = "SAP T-CODE";
        oTcode.autocomplete = "off";
        oTcode.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { _invoke("ev_TcodeRun", "SAP T-CODE: " + (oTcode.value || "")); }
        });
        o.appendChild(oTcode);

        // Pin / Zoom / Search / Power
        o.appendChild(_iconBtn(ICON.pin, "Pin", () => _invoke("ev_Pin", "Pin")));
        o.appendChild(_iconBtn(ICON.zoom, "Zoom In", () => _invoke("ev_ZoomIn", "Zoom In")));
        o.appendChild(_iconBtn(ICON.search, "Search", () => _invoke("ev_GlobalSearch", "Search")));

        const oPower = _iconBtn(ICON.power, _txt("B53"), () => _invoke("ev_Logout", _txt("B53")));
        oPower.classList.add("u4a-btn-power");
        o.appendChild(oPower);

        return o;
    }

    function _renderAiBtn(oBtn) {
        const bOn = WS_STATE.UAI.state === true;
        oBtn.dataset.state = bOn ? "on" : "off";
        oBtn.innerHTML = (bOn ? ICON.connected : ICON.disconnected) +
            `<span>${bOn ? _txt("M431") : _txt("M432")}</span>`;
    }

    function _iconBtn(sIconHtml, sTitle, fnClick) {
        const b = document.createElement("button");
        b.className = "u4a-btn-icon";
        b.type = "button";
        b.title = sTitle;
        b.innerHTML = sIconHtml;
        b.addEventListener("click", fnClick);
        return b;
    }

    // ── Row 3 : 서브헤더 트랜잭션 툴바 (subHeader OverflowToolbar) ──
    function _renderSubHeader() {
        const o = document.createElement("div");
        o.className = "u4a-ws10__subheader";
        const bDev = WS_STATE.USERINFO.IS_DEV === "D";

        _getSubHeaderButtons().forEach((cfg) => {
            if (cfg.devOnly && !bDev) { return; }

            if (cfg.sep) {
                const s = document.createElement("div");
                s.className = "u4a-tx-sep";
                o.appendChild(s);
                return;
            }

            if (cfg.split) {
                o.appendChild(_renderSplitButton(cfg));
                return;
            }

            const b = document.createElement("button");
            b.className = "u4a-tx-btn" + (cfg.reject ? " u4a-tx-btn--reject" : "");
            b.type = "button";
            b.id = cfg.id;
            b.title = `${cfg.text} (${cfg.sc})`;
            b.innerHTML = _fa(cfg.icon) + `<span>${cfg.text}</span>`;
            b.addEventListener("click", () => _invoke(cfg.ev, cfg.text));
            o.appendChild(b);
        });
        return o;
    }

    // 앱 실행 분할 메뉴 버튼 (sap.m.MenuButton buttonMode:Split 대체)
    function _renderSplitButton(cfg) {
        const wrap = document.createElement("div");
        wrap.className = "u4a-split";
        wrap.id = cfg.id;

        const main = document.createElement("button");
        main.className = "u4a-split__main";
        main.type = "button";
        main.title = `${cfg.text} (${cfg.sc})`;
        main.innerHTML = _fa(cfg.icon) + `<span>${cfg.text}</span>`;
        main.addEventListener("click", () => _invoke(cfg.ev, cfg.text));   // defaultAction

        const arrow = document.createElement("button");
        arrow.className = "u4a-split__arrow";
        arrow.type = "button";
        arrow.title = cfg.text;
        arrow.setAttribute("data-menu-anchor", "appexec");
        arrow.innerHTML = ICON.caret;
        arrow.addEventListener("click", () => {
            const aItems = APP_EXEC_BROWSERS.map((b) => ({
                key: b.key, text: b.text, icon: b.icon, brand: b.brand
            }));
            _openMenuAt(arrow, aItems, (it) => _invoke("ev_AppExec", `${cfg.text} → ${it.text}`), "left");
        });

        wrap.append(main, arrow);
        return wrap;
    }

    // ── Row 4 : Application name 검색 폼 (Form + SearchField 대체) ──
    function _renderSearchbar() {
        const o = document.createElement("div");
        o.className = "u4a-ws10__searchbar";

        const oLabel = document.createElement("label");
        oLabel.className = "u4a-ws10__searchlabel";
        oLabel.setAttribute("for", "AppNmInput");
        oLabel.textContent = _txt("A33");   // Application name

        // 공통 입력 컴포넌트(.u4a-field) 소비 — clear(X)는 값 있을 때만, 맨 우측은 Search 헬프.
        // (doc 15 공통 입력 UX 가이드)  trail=2 : [X][검색]
        const oField = document.createElement("div");
        oField.className = "u4a-ws10__searchfield u4a-field";
        oField.dataset.trail = "2";

        const oInput = document.createElement("input");
        oInput.className = "u4a-input u4a-field__input";
        oInput.id = "AppNmInput";
        oInput.type = "text";
        oInput.autocomplete = "off";
        oInput.setAttribute("role", "combobox");
        oInput.setAttribute("aria-autocomplete", "list");
        oInput.placeholder = "Search";

        // change : 대문자 변환 (ev_AppInputChange)
        oInput.addEventListener("change", () => { oInput.value = (oInput.value || "").toUpperCase(); WS_STATE.WS10.APPID = oInput.value; });
        // keydown : F4=헬프, Enter=조회(Display) (fnWs10AppInputKeyDownEvent)
        oInput.addEventListener("keydown", (e) => {
            if (e.key === "F4") { e.preventDefault(); _invoke("ev_AppValueHelp", "App Search Help (F4)"); }
            else if (e.key === "Enter") { _invoke("ev_AppDisplay", _txt("A05")); }
        });
        // dblclick : 전체 선택 (fnWs10AppInputdblclickEvent)
        oInput.addEventListener("dblclick", () => oInput.select());

        // 값 있을 때만 보이는 clear(X) — 공통 컴포넌트 (U4AUI.attachClear 가 노출/비우기 처리)
        const oClearBtn = document.createElement("button");
        oClearBtn.className = "u4a-field__clear";
        oClearBtn.type = "button";
        oClearBtn.title = "Clear";
        oClearBtn.setAttribute("aria-label", "Clear");
        oClearBtn.tabIndex = -1;
        oClearBtn.innerHTML = ICON.clear;

        // 맨 우측 : Search Help (F4) — 공통 트레일링 슬롯(.u4a-field__vh)
        const oSearchBtn = document.createElement("button");
        oSearchBtn.className = "u4a-field__vh";
        oSearchBtn.type = "button";
        oSearchBtn.title = "Search Help (F4)";
        oSearchBtn.innerHTML = ICON.search;
        oSearchBtn.addEventListener("click", () => _invoke("ev_AppValueHelp", "App Search Help (F4)"));

        oField.append(oInput, oClearBtn, oSearchBtn);
        o.append(oLabel, oField);

        // clear(X) 동작 연결 — 비운 뒤 모델(APPID)도 동기화
        if (window.U4AUI && window.U4AUI.attachClear) {
            window.U4AUI.attachClear(oInput, oClearBtn, () => { WS_STATE.WS10.APPID = ""; });
        }

        // 자동완성 (enableSuggestions / suggestionItems → U4AUI.attachSuggest)
        //   셸 통합 시 후보는 /WS10/APPSUGG (개인화 이력)에서 온다.
        if (window.U4AUI && window.U4AUI.attachSuggest) {
            window.U4AUI.attachSuggest(
                oInput,
                () => (WS_STATE.WS10.APPSUGG || []),
                (v) => { WS_STATE.WS10.APPID = v; }
            );
        }
        return o;
    }

    // ── Row 5 : 콘텐츠(히어로 배경) + 플로팅 푸터 ──
    function _renderContent() {
        const o = document.createElement("div");
        o.className = "u4a-ws10__content";
        o.innerHTML = _getWs10ContentHtml() + _getFooterHtml();
        //  푸터 닫기(X)는 공통 전역 위임(U4AUI)이 처리 — 화면별 배선 없음.
        return o;
    }

    // 배경 마크업 (doc 03 §5 _getWs10ContentHtml — 이미지 경로만 WS10/ 기준으로)
    function _getWs10ContentHtml() {
        return `
            <div class="u4a-ws-root">
                <div class="u4a-ws-bg-image">
                    <img src="../../../img/UFOA.png" alt="">
                </div>
                <div class="u4a-ws-anim-glow"></div>
                <div class="u4a-ws-bg-fade"></div>
                <div class="u4a-ws-brand-wrap">
                    <div class="u4a-ws-brand-text">
                        <div class="u4a-ws-brand-u4a">U4A</div>
                        <div class="u4a-ws-brand-desc">Workspace</div>
                    </div>
                </div>
                <div class="u4a-ws-cert-layer">
                    <img src="../../../img/licence/hana/hana_w.png">
                    <img src="../../../img/licence/hana/hana_cloud_w.png">
                    <img src="../../../img/licence/hana/hana_rise_cloud_w.png">
                </div>
            </div>`;
    }

    function _getFooterHtml() {
        //  공통 푸터 마크업(U4AUI) — WS10/WS20/WS30 단일 소스. 닫기(X)는 공통 전역 위임.
        return window.U4AUI ? window.U4AUI.footerMarkup("ws10Footer") : "";
    }

    /********************************************************************
     * 테마 전환 (U4ATheme.apply — doc 12 §5.1)
     ********************************************************************/
    function _applyTheme(sKey) {
        if (window.U4ATheme) { window.U4ATheme.apply(sKey); }
        // 셸 통합 시: 서버 THEMEINFO 저장 + IPC 전파 (parent.setThemeInfo 등) — 여기선 가드
    }

    /********************************************************************
     * 전역 단축키 (doc 03 §5 Sub Header 단축키 — setShortCut 대체)
     ********************************************************************/
    function _wireShortcuts() {
        const aMap = [
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
        document.addEventListener("keydown", (e) => {
            const parts = [];
            if (e.ctrlKey) { parts.push("ctrl"); }
            if (e.shiftKey) { parts.push("shift"); }
            if (e.altKey) { parts.push("alt"); }
            parts.push(e.key);
            const sCombo = parts.join("+");
            const hit = aMap.find((m) => m.sc.toLowerCase() === sCombo.toLowerCase());
            if (hit) {
                if (hit.dev && WS_STATE.USERINFO.IS_DEV !== "D") { return; }
                e.preventDefault();
                _invoke(hit.ev, hit.t);
            }
        });
    }

    /********************************************************************
     * 진입점 (UI5 attachInit → window load)
     ********************************************************************/
    function _init() {
        try {
            oAPP.fn.fnOnInitRendering();
            // 테마 변경 구독 (attachThemeChanged → U4ATheme.onChange, doc 12 §5.2)
            if (window.U4ATheme && window.U4ATheme.onChange) {
                window.U4ATheme.onChange(() => { /* 셸 토큰 색은 CSS var 로 자동 반영 */ });
            }
        } catch (e) {
            if (typeof console !== "undefined") { console.error("[WS10] init error", e); }
        }
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", _init);
    } else {
        _init();
    }

})();
