/**************************************************************************
 * optionMain.js  (HTML5 / Bootstrap)
 * ------------------------------------------------------------------------
 * 시스템 > 옵션 창(BrowserWindow). 원본 optionS.html(UI5 sap.tnt.ToolPage) 걷어내고
 * ServerList 와 동일한 Bootstrap 스택(bootstrap + tokens/shell + bootstrap-bridge/skin)
 * 으로 마스터-디테일 옵션 UI 를 그린다.
 *   · 구조: 헤더(옵션) + 좌측 섹션 list-group(SECTIONS=확장 지점) + 우측 콘텐츠 + 푸터(Apply/Close)
 *   · 테마 섹션: Bootstrap card 그리드(원본 ThemeSetting). 언어/CDN 은 원본도 미완성 → 골격만.
 *   · 적용: ${USERDATA}/p13n/theme/${SYSID}.json 기록 + IPC if-p13n-themeChange-${SYSID}
 *           (메인 창이 받아 적용·영속). 창 미리보기: U4ATheme.apply (취소 시 원복).
 **************************************************************************/
(function () {
    "use strict";

    var REMOTE = require('@electron/remote');
    var IPC = require('electron').ipcRenderer;
    var FS = REMOTE.require('fs');
    var PATH = REMOTE.require('path');
    var APP = REMOTE.app;
    var USERDATA = APP.getPath("userData");
    var APPPATH = APP.getAppPath();
    var CURRWIN = REMOTE.getCurrentWindow();

    var PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));
    var WSUTIL = require(PATHINFO.WSUTIL);

    var oQuery = {};
    try { oQuery = WSUTIL.QueryString.parse(location.href) || {}; } catch (e) { }
    var USERINFO = oQuery.USERINFO || {};
    var LANGU = USERINFO.LANGU || "";
    var SYSID = USERINFO.SYSID || "";
    var BROWSKEY = oQuery.browserkey || "";   // 메인에 busy 해제 신호 보낼 키

    // 창 준비 완료 — opener 가 opacity:0/show:false 로 만들었으니 보이게 하고, 메인 busy 해제.
    //   (원본 optionS.html: CURRWIN.show() + if-send-action-<BROWSKEY> SETBUSYLOCK ISBUSY:"")
    var _bReadySent = false;
    function _ready() {
        if (_bReadySent) { return; }
        _bReadySent = true;
        try { CURRWIN.setOpacity(1.0); } catch (e) { }
        try { CURRWIN.show(); } catch (e) { }
        try { if (BROWSKEY) { IPC.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } } catch (e) { }
    }

    var WSMSG = null;
    try { WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU); } catch (e) { }
    function _txt(sCls, sCode) {
        try { return (WSMSG && WSMSG.fnGetMsgClsText(sCls, sCode, "", "", "", "")) || ""; } catch (e) { return ""; }
    }
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    var IF_DATA = null;
    var sCurTheme = "horizon_white";
    var sOrigTheme = "horizon_white";

    var THEMES = [
        { key: "horizon_white",  text: "Horizon White",  accent: "#1c93f2", bg: "#ffffff" },
        { key: "horizon_dark",   text: "Horizon Dark",   accent: "#1c93f2", bg: "#1c2228" },
        { key: "horizon_purple", text: "Horizon Purple", accent: "#7f77dd", bg: "#faf8ff" },
        { key: "horizon_red",    text: "Horizon Red",    accent: "#e24b4a", bg: "#fff7f7" },
        { key: "horizon_green",  text: "Horizon Green",  accent: "#639922", bg: "#f4fcf4" }
    ];

    // 확장 지점 — 한 줄 추가하면 좌측 list-group + 우측 render 자동.
    var SECTIONS = [
        { code: "theme", icon: "palette", labelKey: "B01", render: _renderTheme }
        // { code: "langu", icon: "language", labelKey: "...", render: _renderLangu },
        // { code: "cdn",   icon: "server",   labelKey: "...", render: _renderCdn }
    ];

    function _norm(s) {
        try { return (window.U4ATheme && window.U4ATheme.normalize) ? window.U4ATheme.normalize(s) : s; }
        catch (e) { return s; }
    }
    function _applyTheme(sKey) {
        try { if (window.U4ATheme) { window.U4ATheme.apply(sKey); } } catch (e) { }
        sCurTheme = sKey;
    }

    // 테마 스와치 프리뷰 등 Bootstrap 으로 표현 안 되는 소량 스타일만 주입(색은 카드별 대표색).
    function _ensureStyle() {
        if (document.getElementById("u4aOptStyle")) { return; }
        var s = document.createElement("style");
        s.id = "u4aOptStyle";
        s.textContent = `
        .u4aOptCard { cursor: pointer; }
        .u4aOptCard.selected { border-color: var(--bs-primary, var(--accent)) !important;
            box-shadow: inset 0 0 0 0.0625rem var(--bs-primary, var(--accent)); }
        .u4aOptPrev { position: relative; height: 3rem; border-bottom: 0.0625rem solid var(--bs-border-color, var(--line)); }
        .u4aOptPrev .bar { position: absolute; left: 0; right: 0; top: 0; height: 0.875rem; }
        .u4aOptPrev .dot { position: absolute; right: 0.5rem; bottom: 0.5rem; width: 0.875rem; height: 0.875rem; border-radius: 50%; }
        `;
        document.head.appendChild(s);
    }

    /* ── 섹션: 테마 (Bootstrap card 그리드) ── */
    function _renderTheme(el) {
        var html =
            '<div class="d-flex align-items-center gap-2 mb-3 fw-semibold">' + _fa("palette") +
            '<span>' + (_txt("/U4A/CL_WS_COMMON", "B01") || "Theme") + '</span></div>' +
            '<div class="row g-3">';
        for (var i = 0; i < THEMES.length; i++) {
            var t = THEMES[i];
            html +=
                '<div class="col-6 col-md-4 col-lg-3">' +
                  '<div class="card h-100 u4aOptCard" data-key="' + t.key + '" title="' + t.text + '">' +
                    '<div class="u4aOptPrev" style="background:' + t.bg + ';">' +
                      '<div class="bar" style="background:' + t.accent + ';"></div>' +
                      '<div class="dot" style="background:' + t.accent + ';"></div>' +
                    '</div>' +
                    '<div class="card-body p-2 d-flex justify-content-between align-items-center">' +
                      '<span class="small">' + t.text + '</span><span class="chk text-primary"></span>' +
                    '</div>' +
                  '</div>' +
                '</div>';
        }
        html += '</div>';
        el.innerHTML = html;
        el.querySelectorAll(".u4aOptCard").forEach(function (c) {
            c.addEventListener("click", function () { _applyTheme(c.getAttribute("data-key")); _markSel(c.getAttribute("data-key")); });
        });
        _markSel(sCurTheme);
    }
    function _markSel(sKey) {
        document.querySelectorAll(".u4aOptCard").forEach(function (c) {
            var b = c.getAttribute("data-key") === sKey;
            c.classList.toggle("selected", b);
            var ck = c.querySelector(".chk");
            if (ck) { ck.innerHTML = b ? _fa("check") : ""; }
        });
    }

    function _selectSection(sCode) {
        var oCont = document.getElementById("optCont");
        var sec = null;
        for (var i = 0; i < SECTIONS.length; i++) { if (SECTIONS[i].code === sCode) { sec = SECTIONS[i]; break; } }
        if (!sec || !oCont) { return; }
        document.querySelectorAll("[data-code]").forEach(function (n) {
            n.classList.toggle("active", n.getAttribute("data-code") === sCode);
        });
        try { sec.render(oCont); } catch (e) { oCont.innerHTML = ""; }
    }

    function _close(bRevert) {
        if (bRevert) { _applyTheme(sOrigTheme); }
        try { CURRWIN.setClosable && CURRWIN.setClosable(true); } catch (e) { }
        try { CURRWIN.close(); } catch (e) { try { CURRWIN.destroy(); } catch (e2) { } }
    }

    function _apply() {
        var sKey = sCurTheme;
        var sBg = "";
        try { sBg = WSUTIL.getThemeBackgroundColor ? WSUTIL.getThemeBackgroundColor(sKey) : ""; } catch (e) { }
        if (!sBg) { try { sBg = getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim(); } catch (e) { } }
        var sData = { THEME: sKey, BGCOL: sBg || "" };
        try {
            var sDir = PATH.join(USERDATA, "p13n", "theme");
            try { FS.mkdirSync(sDir, { recursive: true }); } catch (e2) { }
            FS.writeFileSync(PATH.join(sDir, SYSID + ".json"), JSON.stringify(sData), "utf-8");
        } catch (e) { }
        try { IPC.send("if-p13n-themeChange-" + SYSID, sData); } catch (e) { }
        sOrigTheme = sKey;
        _close(false);
    }

    function _build() {
        _ensureStyle();
        var root = document.getElementById("optRoot") || document.body;

        var sNav = "";
        SECTIONS.forEach(function (sec) {
            sNav +=
                '<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" data-code="' + sec.code + '">' +
                _fa(sec.icon) + '<span>' + (_txt("/U4A/CL_WS_COMMON", sec.labelKey) || sec.code) + '</span></button>';
        });

        root.innerHTML =
            '<div class="d-flex flex-column" style="height:100vh">' +
              // 헤더
              '<div class="d-flex align-items-center gap-2 px-3 border-bottom fw-semibold" style="height:2.75rem">' +
                '<i class="fa-solid fa-gear text-primary"></i><span>' + (_txt("/U4A/CL_WS_COMMON", "B52") || "Options") + '</span>' +
              '</div>' +
              // 마스터-디테일
              '<div class="d-flex flex-grow-1" style="min-height:0">' +
                '<div class="list-group list-group-flush border-end overflow-auto" style="flex:0 0 13rem">' + sNav + '</div>' +
                '<div class="flex-grow-1 overflow-auto p-3" id="optCont"></div>' +
              '</div>' +
              // 푸터
              '<div class="d-flex justify-content-end gap-2 px-3 py-2 border-top">' +
                '<button type="button" class="btn btn-primary btn-sm" id="optApply">' + _fa("check") + ' ' + (_txt("/U4A/CL_WS_COMMON", "C63") || "Apply") + '</button>' +
                '<button type="button" class="btn btn-outline-secondary btn-sm" id="optClose">' + _fa("xmark") + ' ' + (_txt("/U4A/CL_WS_COMMON", "A39") || "Close") + '</button>' +
              '</div>' +
            '</div>';

        root.querySelectorAll("[data-code]").forEach(function (n) {
            n.addEventListener("click", function () { _selectSection(n.getAttribute("data-code")); });
        });
        document.getElementById("optApply").addEventListener("click", _apply);
        document.getElementById("optClose").addEventListener("click", function () { _close(true); });

        _selectSection(SECTIONS[0] && SECTIONS[0].code);

        // UI 준비 완료 → 창 표시 + 메인 busy 해제 (안 하면 메인이 계속 busy 스피너)
        _ready();
    }

    IPC.on('if-ws-options-info', function (event, data) {
        IF_DATA = data || {};
        var sTheme = _norm((IF_DATA.THEME_INFO && IF_DATA.THEME_INFO.THEME) ||
            (window.U4ATheme && window.U4ATheme.current && window.U4ATheme.current()) || "horizon_white");
        if (THEMES.map(function (t) { return t.key; }).indexOf(sTheme) === -1) { sTheme = "horizon_white"; }
        sOrigTheme = sTheme;
        _applyTheme(sTheme);
        _build();
    });

    document.addEventListener("DOMContentLoaded", function () {
        if (!document.getElementById("optCont")) {
            sOrigTheme = _norm((window.U4ATheme && window.U4ATheme.current && window.U4ATheme.current()) || "horizon_white");
            sCurTheme = sOrigTheme;
            _build();
        }
    });

})();
