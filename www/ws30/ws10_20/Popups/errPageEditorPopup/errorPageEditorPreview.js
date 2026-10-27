// 오류코드 접두: EPEV / 다음 번호: 002
/****************************************************************************
 * 오류 페이지 미리보기 창 로직 (errorPageEditorPreview.js)
 * --------------------------------------------------------------------------
 *  원본(errorPageEditorPreview.html): 창 문서에 `document.write(oInfo.HTML)` 한 줄로
 *  사용자가 작성한 오류 페이지 HTML 을 통째로 그렸다. 창틀은 OS 기본이었다.
 *
 *  2026-10-14 장군님 지시 — 「공통 UX 지침대로 공통 헤더로 바꿔줘」:
 *   · 창틀을 떼고(`titleBarStyle:'hidden'`) 창 안에 공통 `.u4a-titlebar`
 *     [로고 · 제목 · 최소화 · 최대화 · 닫기] 를 둔다(.analy/16 §2.2 — 에디터류는 로고).
 *   · 공통 헤더를 두면 `document.write` 가 헤더까지 지우므로, 사용자 HTML 은
 *     **본문 iframe(errorPageEditorPreviewBody.html)** 안에 그린다. 에디터 창
 *     (errorPageEditorFrame)과 같은 [헤더 + iframe] 2단 구조다.
 *   · 닫기는 `closable:false` 를 유지한 채 공통 `U4AUI.closeWindow` 로만 한다(§2.6.1).
 *   · 첫 페인트 흰 플래시 방지 — 창 배경·iframe 배경 모두 opener 가 넘긴 테마색(§2.6),
 *     등장은 본문 CSS opacity transition.
 ****************************************************************************/

var REMOTE = require('@electron/remote'),
    IPCRENDERER = require('electron').ipcRenderer,
    IPCMAIN = REMOTE.require('electron').ipcMain,
    PATH = REMOTE.require('path'),
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    FS = REMOTE.require('fs'),
    USERDATA = APP.getPath('userData'),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = require(PATHINFO.WSUTIL),
    CURRWIN = REMOTE.getCurrentWindow();

var oQueryParams = WSUTIL.QueryString.parse(location.href);

var USERINFO = oQueryParams.USERINFO,
    SYSID = (USERINFO && USERINFO.SYSID) || "",
    BGCOL = oQueryParams.BGCOL,
    TITLE = oQueryParams.TITLE;

// 사용자 HTML 과 iframe 준비 상태 — 어느 쪽이 늦게 와도 그린다(느린 PC 에서 순서가 바뀐다).
var sPendingHtml = null,
    bFrameReady = false;

// ★ closable 은 창 수명 내내 false 유지(Alt+F4 / OS 닫기 차단). 닫기는 아래 X 버튼으로만.
try { CURRWIN.closable = false; }
catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

/************************************************************************
 * 사용자가 작성한 오류 페이지 HTML 을 본문 iframe 에 그린다.
 *   원본의 document.write 와 같은 동작 — 다만 대상이 창 문서에서 iframe 문서로 바뀌었다.
 ************************************************************************/
function _renderHtml() {

    if (sPendingHtml === null || bFrameReady === false) {
        return;
    }

    var oFrame = document.getElementById("prevFrame");
    if (!oFrame) {
        if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
            U4ALOG.warn("GUARD_EXIT", "prevFrame", "error page preview body iframe not found - user HTML is not rendered");
        }
        return;
    }

    try {

        var oDoc = oFrame.contentDocument;
        if (!oDoc) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
                U4ALOG.warn("GUARD_EXIT", "prevFrame.contentDocument", "error page preview body document not reachable - user HTML is not rendered");
            }
            return;
        }

        oDoc.open();
        oDoc.write(sPendingHtml);
        oDoc.close();

        sPendingHtml = null;

        // 본문 등장(CSS opacity transition) — 네이티브 창 페이드 미사용(.analy/16 §2.6).
        var oBody = document.getElementById("prevBody");
        if (oBody) { oBody.classList.add("u4aPrevShown"); }

    } catch (error) {
        console.error("[EPEV-001] writing user HTML into the preview body failed:", error && error.message, error);
    }

}

/************************************************************************
 * 라이브 테마 변경 추종 (★별창 공통 필수 — .analy/16 §2.6.2)
 * --------------------------------------------------------------------------
 *  장군님 지시 2026-10-14 — 「테마 변경될 때 같이 바뀌는 로직이 빠졌어 이거 필수야」.
 *  공통 헤더(.u4a-titlebar)를 쓰는 창은 워크스페이스 테마를 **켜져 있는 동안에도** 따라가야 한다.
 *  안 넣으면 사용자가 테마를 바꿔도 그 창만 옛 색으로 남는다.
 *  ※ 본문 iframe 은 사용자가 작성한 오류 페이지라 테마를 입히지 않는다(원본 그대로 보여 준다).
 ************************************************************************/
function _getThemeInfo() {
    try {
        if (!SYSID) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
                U4ALOG.warn("GUARD_EXIT", "SYSID", "live theme change cannot be followed in the error page preview window");
            }
            return null;
        }
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } return null; }
}

function _onThemeChange() {

    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }

    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
            BGCOL = oTheme.BGCOL;
        }
    } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } }
    catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

}

/************************************************************************
 * IPCRENDERER Events..
 ************************************************************************/
IPCRENDERER.on("if-Error-Page-prev", function (events, oInfo) {

    if (!oInfo || !oInfo.HTML) {
        if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
            U4ALOG.warn("GUARD_EXIT", "if-Error-Page-prev HTML", "nothing to preview - body stays empty");
        }
        return;
    }

    sPendingHtml = oInfo.HTML;

    _renderHtml();

});

/************************************************************************
 * 화면 구성 — 헤더(로고·제목·창 버튼) + 본문 iframe 띄우기
 ************************************************************************/
document.addEventListener("DOMContentLoaded", function () {

    // 로고 — 에디터·매니저류 창은 U4A 로고(.analy/16 §2.2).
    var oLogo = document.getElementById("prevLogo");
    if (oLogo) {
        try { oLogo.src = REMOTE.getGlobal("u4aToAppUrl")(PATH.join(APPPATH, "img", "logo.png")); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }

    // 제목 — opener 가 쿼리로 넘긴 창 제목(없으면 창 자체 제목).
    var oTitle = document.getElementById("prevTitle");
    if (oTitle) {
        var sTitle = TITLE || "";
        if (!sTitle) {
            try { sTitle = CURRWIN.getTitle() || ""; }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        }
        oTitle.textContent = sTitle;
    }

    // 본문 iframe — 테마 배경을 쿼리로 넘겨 iframe 만 흰 번쩍하는 것을 막는다(.analy/16 §2.6).
    var oFrame = document.getElementById("prevFrame");
    if (oFrame) {

        oFrame.addEventListener("load", function () {
            bFrameReady = true;
            _renderHtml();
        });

        var sSrc = "errorPageEditorPreviewBody.html";
        if (BGCOL) { sSrc += "?BGCOL=" + encodeURIComponent(BGCOL); }
        // 2026-10-27 Electron 45: 화면이 u4a-ws:// 라 OS 경로를 그대로 넣으면 안 된다.
        oFrame.src = REMOTE.getGlobal("u4aToAppUrl")(sSrc);

    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "prevFrame", "error page preview body iframe not found - nothing can be shown");
    }

    // 최소화
    var oWinMin = document.getElementById("prevWinMin");
    if (oWinMin) {
        oWinMin.addEventListener("click", function () {
            try { CURRWIN.minimize(); }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });
    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "prevWinMin", "minimize button not wired");
    }

    // 최대화 / 복원 — 최대화 상태에 따라 아이콘·tooltip 을 Maximize / Restore 로 바꾼다.
    var oWinMax = document.getElementById("prevWinMax");
    if (oWinMax) {

        var _syncMaxBtn = function () {
            try {
                var bMax = CURRWIN.isMaximized(),
                    oIcon = oWinMax.querySelector("i");
                oWinMax.title = bMax ? "Restore" : "Maximize";
                if (oIcon) { oIcon.className = bMax ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
            } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        };

        oWinMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });

        // 더블클릭 등 창 쪽에서 바뀌는 경우도 아이콘을 맞춘다.
        try {
            CURRWIN.on("maximize", _syncMaxBtn);
            CURRWIN.on("unmaximize", _syncMaxBtn);
        } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

        _syncMaxBtn();

    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "prevWinMax", "maximize button not wired");
    }

    // 닫기 — 창이 closable:false 라 직접 close() 는 안 먹는다. 공통 closeWindow 경유(.analy/16 §2.6.1).
    var oClose = document.getElementById("prevWinClose");
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); return; }
            try { if (!CURRWIN.isDestroyed()) { CURRWIN.setClosable(true); CURRWIN.close(); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });
    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "prevWinClose", "close button not wired - the window cannot be closed");
    }

    // 창 상단 메뉴 제거(opener 에서도 하지만 창 쪽에서도 보장).
    try { CURRWIN.setMenu(null); }
    catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

    // 라이브 테마 변경 구독(SYSID 별) — 17번 에디터 창과 같은 짝.
    if (SYSID) {
        try { IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }

});

// 창이 닫힐 때 구독 해제(누수 방지) — 17번 에디터 창과 같은 짝.
window.onbeforeunload = function () {
    if (SYSID) {
        try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }
};
