/****************************************************************************
 * Window Text Search — 팝업(별도 BrowserWindow) iframe 콘텐츠 (HTML5 변환)
 * --------------------------------------------------------------------------
 *  원본 UI5 뷰(views/vw_main/view.js + control.js)를 대체. 찾기 로직은 원본 그대로:
 *  부모 창(PARWIN=메인 WS)의 webContents 기준 findInPage. 같은 문서가 아니라 별도 창이라
 *  "찾기 UI"가 검색 대상에 안 섞인다(원본 의도 = 같은 프레임 간섭 회피).
 *  - parent = 외곽 index.html(REMOTE/oAPP/PATH/USERINFO 셋업, index.js).
 *  - 테마: parent.oAPP.fn.getThemeInfo() → U4ATheme.apply + 창마다 if-p13n-themeChange 구독.
 ****************************************************************************/
(function () {
    "use strict";

    var REMOTE = parent.REMOTE;
    var CURRWIN = REMOTE.getCurrentWindow();                    // 이 팝업 창
    var PARCON = CURRWIN.getParentWindow().webContents;        // 부모(메인 WS) 본문 = 검색 대상(원본 PARCON)
    var oAPP = parent.oAPP;

    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    var _input = null, _countEl = null, _onFound = null;
    var _prev = "";   // 직전 검색어(원본 gBeforeSearchText) — 새 검색어면 findNext=true(처음부터)

    function _btn(sIcon, fn) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "u4a-btn-icon"; b.innerHTML = _fa(sIcon);
        b.addEventListener("click", fn);
        return b;
    }

    function _setCount(s) { if (_countEl) { _countEl.textContent = s; } }

    // 라이브 검색(원본 onTextSearch)
    function _onInput() {
        var v = _input.value;
        if (v === "") {
            _prev = ""; _setCount("");
            try { PARCON.stopFindInPage("clearSelection"); } catch (e) { }
            return;
        }
        var bFindNext = (_prev !== v);   // 새 검색어 → 처음부터, 같으면 다음 매치로
        try { PARCON.findInPage(v, { forward: true, findNext: bFindNext }); } catch (e) { }
        _prev = v;
    }

    // ▲/▼ 및 Enter (원본 textSearchUp/textSearchDown)
    function _step(bForward) {
        var v = _input.value;
        if (v === "") { try { PARCON.stopFindInPage("clearSelection"); } catch (e) { } _setCount(""); return; }
        try { PARCON.findInPage(v, { forward: bForward, findNext: false }); } catch (e) { }
    }

    function _onKeyDown(e) {
        if (e.keyCode === 27) { e.preventDefault(); _close(); return; }        // ESC 닫기(원본 동일)
        if (e.keyCode === 13) { e.preventDefault(); _step(!e.shiftKey); }     // Enter=다음, Shift+Enter=이전
    }

    // 닫기(원본 fnTextSearchClose) — 하이라이트 제거 + 리스너 해제 + 부모 포커스 + 창 닫기.
    function _close() {
        try { PARCON.stopFindInPage("clearSelection"); } catch (e) { }
        if (_onFound) { try { PARCON.off("found-in-page", _onFound); } catch (e) { } }
        try { PARCON.focus(); } catch (e) { }
        if (!CURRWIN.isDestroyed()) { try { CURRWIN.close(); } catch (e) { } }
    }

    function _build() {
        var root = document.getElementById("u4aTxtSrch");
        root.className = "u4aTxtSrchWin";

        var field = window.U4AUI.createField({ type: "text", clear: true, className: "u4aTxtSrchField" });
        _input = field.input;
        _input.autocomplete = "off";
        _input.addEventListener("input", _onInput);
        _input.addEventListener("keydown", _onKeyDown);

        _countEl = document.createElement("span"); _countEl.className = "u4aTxtSrchWin__count";
        var sep = document.createElement("span"); sep.className = "u4aTxtSrchWin__sep";

        var bUp = _btn("chevron-up", function () { _step(false); });   // 원본 ▲ navigation-up-arrow
        var bDn = _btn("chevron-down", function () { _step(true); });  // 원본 ▼ navigation-down-arrow
        var bCl = _btn("xmark", _close);                              // 원본 ✕ decline
        bCl.setAttribute("data-act", "close");                       // 공통 닫기 의미색(빨강 hover)

        root.append(field.el, _countEl, sep, bUp, bDn, bCl);

        // 매치 결과 → "활성 / 전체"(원본 fnFoundInPage)
        _onFound = function (ev, res) {
            _setCount(res && res.matches ? (res.activeMatchOrdinal + " / " + res.matches) : "0 / 0");
        };
        try { PARCON.on("found-in-page", _onFound); } catch (e) { }
    }

    // 테마 적용(공통) — 창 배경 + U4ATheme.
    //   ★ getThemeInfo().THEME 은 UI5 테마명(sap_horizon_dark 등) → U4ATheme.normalize 로 키 변환 후 apply.
    //     (메인 ws10_html._savedTheme 와 동일. normalize 빼면 키 불일치로 테마 CSS 미로드 → 다크에서 바만 라이트.)
    function _applyTheme() {
        try {
            var t = oAPP.fn.getThemeInfo && oAPP.fn.getThemeInfo();
            if (!t) { return; }
            if (t.BGCOL) { document.documentElement.style.setProperty("--boot-bg", t.BGCOL); }
            if (t.THEME && window.U4ATheme) {
                window.U4ATheme.apply(window.U4ATheme.normalize(t.THEME));
            }
        } catch (e) { }
    }

    // 전 창 테마 실시간 동기화([[browser-window-common-ux]] 5) — 구독 + 해제.
    var _sysid = parent.SYSID || (parent.USERINFO || {}).SYSID;
    function _onThemeChange() { _applyTheme(); }   // 변경 시 getThemeInfo 가 JSON 새로 읽어 새 테마 반영
    if (_sysid && parent.IPCMAIN) {
        try { parent.IPCMAIN.on("if-p13n-themeChange-" + _sysid, _onThemeChange); } catch (e) { }
        window.addEventListener("beforeunload", function () {
            try { parent.IPCMAIN.off("if-p13n-themeChange-" + _sysid, _onThemeChange); } catch (e) { }
        });
    }

    function _start() {
        _applyTheme();
        _build();
        try { CURRWIN.show(); CURRWIN.focus(); } catch (e) { }   // 원본 onViewReady: 준비되면 창 표시
        setTimeout(function () { try { _input.focus(); } catch (e) { } }, 0);
    }

    if (window.U4AUI && window.U4AUI.createField) { _start(); }
    else { window.addEventListener("load", _start); }

})();
