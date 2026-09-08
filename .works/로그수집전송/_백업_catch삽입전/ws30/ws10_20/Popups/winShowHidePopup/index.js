/****************************************************************************
 * Window Hide(투명도) Slider — 팝업(별도 BrowserWindow) iframe 콘텐츠 (HTML5 변환)
 * --------------------------------------------------------------------------
 *  원본 UI5 뷰(winShowHidePopup/index.js 의 sap.m.Slider + 프리셋 sap.m.Button)를 대체.
 *  기능은 원본 그대로: 부모(메인 WS) 창을 반투명 + 클릭통과(setIgnoreMouseEvents)로 만들어
 *  뒤에 깔린 화면(예: SAP GUI) 위에 겹쳐 보며 따라 쓰는 "오버레이/트레이싱" 용도.
 *  - 창 제어는 Electron(parent.oAPP.PARWIN / REMOTE) — UI5 무관이라 변환 없이 그대로 사용.
 *  - parent = 외곽 frame.html(REMOTE/oAPP/PARWIN/USERINFO/IPCMAIN 셋업, frame.js).
 *  - 테마: parent.oAPP.fn.getThemeInfo() → U4ATheme.apply + if-p13n-themeChange 구독.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = parent.oAPP;
    var REMOTE = oAPP.REMOTE;
    var PARWIN = oAPP.PARWIN;                         // 부모(메인 WS) 창 = 투명도/클릭통과 대상(원본 PARWIN)
    var CURRWIN = REMOTE.getCurrentWindow();          // 이 팝업 창(닫기용)
    var zconsole = parent.WSERR ? parent.WSERR(window, document, console) : console;

    // 초기 투명도(원본 DEFAULT_OPACITY=0.3) — frame.js 가 if_showHidePopup IPC 로 attr 에 실어둠.
    var DEFAULT_PCT = Math.round(((oAPP.attr && oAPP.attr.DEFAULT_OPACITY) || 0.3) * 100);
    var _slider = null;

    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    // 부모 창 투명도 적용(원본 liveChange/_pressOpacityButton 동일).
    //   반투명이면 클릭통과 ON(뒤 화면 조작), 100%면 OFF(정상 조작 복원).
    function _applyOpacity(iPct) {
        var opa = iPct / 100;
        try {
            PARWIN.setIgnoreMouseEvents(true);
            PARWIN.setOpacity(opa);
            if (opa >= 1) { PARWIN.setIgnoreMouseEvents(false); }
        } catch (e) { zconsole.error("[WINHIDE] setOpacity", e); }
    }

    // 닫기(원본 close 버튼 → currWin.close()) — 부모창 복원(투명도/클릭통과/항상위)은
    //   opener(ws_fn_04.js) 의 'closed' 핸들러가 수행(원본 동일, 여기서 중복 처리 안 함).
    function _close() {
        try { if (!CURRWIN.isDestroyed()) { CURRWIN.close(); } } catch (e) { }
    }

    function _build() {
        var root = document.getElementById("u4aWinHide");
        root.className = "u4aWinHide";

        // ── 타이틀바(공통 .u4a-titlebar — 프레임리스 네이티브 드래그) ──
        var bar = document.createElement("div");
        bar.className = "u4a-titlebar";

        var icon = document.createElement("i");
        icon.className = "fa-solid fa-eye-slash u4aWinHide__icon";   // 원본 sap-icon://hide

        var title = document.createElement("span");
        title.className = "u4a-titlebar__title";
        title.textContent = "window Hide Slider";   // ⚠️ 원본 하드코딩 문구 — 메시지 키 수집 대상

        var spacer = document.createElement("span");
        spacer.className = "u4a-titlebar__spacer";

        var btnClose = document.createElement("button");
        btnClose.type = "button";
        btnClose.className = "u4a-winbtn u4a-winbtn--close";   // 공통 닫기 X(빨강 hover)
        btnClose.title = "Close";
        btnClose.innerHTML = _fa("xmark");
        btnClose.addEventListener("click", _close);

        bar.append(icon, title, spacer, btnClose);

        // ── 본문(슬라이더 + 프리셋 20/40/60/80/100) ──
        var body = document.createElement("div");
        body.className = "u4aWinHide__body";

        _slider = document.createElement("input");
        _slider.type = "range";
        _slider.className = "u4aWinHide__slider";
        _slider.min = "0"; _slider.max = "100"; _slider.step = "1";   // 원본 sap.m.Slider(0~100)
        _slider.value = String(DEFAULT_PCT);
        // 원본 liveChange — 드래그 내내 실시간 반영(input).
        _slider.addEventListener("input", function () { _applyOpacity(parseInt(_slider.value, 10)); });

        var presets = document.createElement("div");
        presets.className = "u4aWinHide__presets";
        [20, 40, 60, 80, 100].forEach(function (n) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "u4a-btn";
            b.textContent = String(n);
            // 원본 _pressOpacityButton — 슬라이더 동기화 + 부모창 투명도 적용.
            b.addEventListener("click", function () { _slider.value = String(n); _applyOpacity(n); });
            presets.appendChild(b);
        });

        body.append(_slider, presets);
        root.append(bar, body);

        // ESC = 닫기(공통 별도창 UX).
        document.addEventListener("keydown", function (e) {
            if (e.keyCode === 27) { e.preventDefault(); _close(); }
        });
    }

    // 테마 적용(공통) — 창 배경(--boot-bg) + U4ATheme.
    //   ★ getThemeInfo().THEME 은 UI5 테마명(sap_horizon_dark 등) → U4ATheme.normalize 로 키 변환 후 apply.
    function _applyTheme() {
        try {
            var t = oAPP.fn && oAPP.fn.getThemeInfo && oAPP.fn.getThemeInfo();
            if (!t) { return; }
            if (t.BGCOL) { document.documentElement.style.setProperty("--boot-bg", t.BGCOL); }
            if (t.THEME && window.U4ATheme) { window.U4ATheme.apply(window.U4ATheme.normalize(t.THEME)); }
        } catch (e) { }
    }

    // 전 창 테마 실시간 동기화([[browser-window-common-ux]]) — 구독 + 해제.
    var _sysid = (oAPP.USERINFO || {}).SYSID;
    function _onThemeChange() { _applyTheme(); }   // 변경 시 getThemeInfo 가 JSON 새로 읽어 새 테마 반영
    if (_sysid && oAPP.IPCMAIN) {
        try { oAPP.IPCMAIN.on("if-p13n-themeChange-" + _sysid, _onThemeChange); } catch (e) { }
        window.addEventListener("beforeunload", function () {
            try { oAPP.IPCMAIN.off("if-p13n-themeChange-" + _sysid, _onThemeChange); } catch (e) { }
        });
    }

    function _start() {
        _applyTheme();
        _build();
        // 원본 onInitRendering 끝: 렌더 직후 부모창에 즉시 0.3 적용 + 슬라이더 동기.
        _applyOpacity(DEFAULT_PCT);
    }

    if (window.U4AUI) { _start(); }
    else { window.addEventListener("load", _start); }

})();
