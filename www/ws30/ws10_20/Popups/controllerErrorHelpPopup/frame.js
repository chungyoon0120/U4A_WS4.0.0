// 오류코드 접두: CEHP / 다음 번호: 001
/****************************************************************************
 * 컨트롤러 실행 오류 점검사항 창 로직 (frame.js)
 * --------------------------------------------------------------------------
 *  종전(원본과 동일): 설명서 HTML(www/help/controllerClass/<언어>/index.html)을
 *  창에 그대로 띄워 OS 기본 창틀이 나왔다. 공통 제목줄도, 테마도 따라가지 않았다.
 *
 *  2026-10-14 장군님 지시(TODO 47) — 공통 헤더로 전환:
 *   · 창틀을 떼고(titleBarStyle:'hidden') 창 안에 공통 .u4a-titlebar
 *     [로고 · 제목 · 최소화 · 최대화 · 닫기] 를 둔다(.analy/16 §2.2).
 *   · 설명서는 언어별로 여러 벌이고 자기 CSS·이미지를 상대 경로로 참조하므로
 *     **설명서 파일은 손대지 않고** 본문 iframe 으로 내렸다(오류 페이지 미리보기 창과 같은 식).
 *   · 닫기는 closable:false 를 유지한 채 공통 U4AUI.closeWindow 로만 한다(§2.6.1).
 *   · 라이브 테마 변경 추종(§2.6.2) — 창틀에만 입힌다. 설명서 본문은 원본 그대로 둔다.
 ****************************************************************************/

var REMOTE = require('@electron/remote'),
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
    TITLE = oQueryParams.TITLE,
    HELPURL = oQueryParams.HELPURL;   // opener 가 고른 언어별 설명서 파일 주소

// ★ closable 은 창 수명 내내 false 유지(Alt+F4 / OS 닫기 차단). 닫기는 아래 X 버튼으로만.
try { CURRWIN.closable = false; }
catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

/************************************************************************
 * 라이브 테마 변경 추종 (.analy/16 §2.6.2 — 별창 필수 규약)
 *  안 넣으면 사용자가 테마를 바꿔도 이 창만 옛 색으로 남는다.
 *  ※ 본문 iframe(설명서)은 자기 CSS 를 쓰므로 테마를 입히지 않는다.
 ************************************************************************/
function _getThemeInfo() {
    try {
        if (!SYSID) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
                U4ALOG.warn("GUARD_EXIT", "SYSID", "live theme change cannot be followed in the controller error help window");
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
 * 화면 구성 — 헤더(로고·제목·창 버튼) + 본문 iframe(설명서)
 ************************************************************************/
document.addEventListener("DOMContentLoaded", function () {

    // 로고 — 공통 헤더 규약(.analy/16 §2.2).
    var oLogo = document.getElementById("cehLogo");
    if (oLogo) {
        try { oLogo.src = REMOTE.getGlobal("u4aToAppUrl")(PATH.join(APPPATH, "img", "logo.png")); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }

    // 제목 — opener 가 쿼리로 넘긴 창 제목(없으면 창 자체 제목).
    var oTitle = document.getElementById("cehTitle");
    if (oTitle) {
        var sTitle = TITLE || "";
        if (!sTitle) {
            try { sTitle = CURRWIN.getTitle() || ""; }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        }
        oTitle.textContent = sTitle;
    }

    // 본문 iframe — 설명서 파일을 그대로 띄운다(상대 경로 CSS·이미지가 살아 있어야 하므로 파일 주소 그대로).
    var oFrame = document.getElementById("cehFrame"),
        oBody = document.getElementById("cehBody");

    if (!oFrame || !HELPURL) {
        if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
            U4ALOG.warn("GUARD_EXIT", (!oFrame ? "cehFrame" : "HELPURL"), "controller error help document is not shown");
        }
    } else {

        oFrame.addEventListener("load", function () {
            // 본문 등장(CSS opacity transition) — 네이티브 창 페이드 미사용(.analy/16 §2.6).
            try { if (oBody) { oBody.classList.add("u4aCehShown"); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });

        oFrame.src = HELPURL;
    }

    // 최소화
    var oWinMin = document.getElementById("cehWinMin");
    if (oWinMin) {
        oWinMin.addEventListener("click", function () {
            try { CURRWIN.minimize(); }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });
    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "cehWinMin", "minimize button not wired");
    }

    // 최대화 / 복원 — 최대화 상태에 따라 아이콘·tooltip 을 Maximize / Restore 로 바꾼다.
    var oWinMax = document.getElementById("cehWinMax");
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

        try {
            CURRWIN.on("maximize", _syncMaxBtn);
            CURRWIN.on("unmaximize", _syncMaxBtn);
        } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

        _syncMaxBtn();

    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "cehWinMax", "maximize button not wired");
    }

    // 닫기 — 창이 closable:false 라 직접 close() 는 안 먹는다. 공통 closeWindow 경유(.analy/16 §2.6.1).
    var oClose = document.getElementById("cehWinClose");
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); return; }
            try { if (!CURRWIN.isDestroyed()) { CURRWIN.setClosable(true); CURRWIN.close(); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
        });
    } else if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
        U4ALOG.warn("GUARD_EXIT", "cehWinClose", "close button not wired - the window cannot be closed");
    }

    // 창 상단 메뉴 제거(opener 에서도 하지만 창 쪽에서도 보장).
    try { CURRWIN.setMenu(null); }
    catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

    // 라이브 테마 변경 구독(SYSID 별) — 별창 필수 규약(.analy/16 §2.6.2).
    if (SYSID) {
        try { IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }

});

// 창이 닫힐 때 구독 해제(누수 방지).
window.onbeforeunload = function () {
    if (SYSID) {
        try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    }
};
