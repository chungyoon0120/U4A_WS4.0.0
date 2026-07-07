/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : illustMsgPopup/index.js
 *
 * 원본: illustMsgPopup(Image Icons) index.html 인라인 <script> 로직을 분리.
 *   · 바깥 셸(창 크롬)만 [공통 .u4a-titlebar] 로 외부화(frameless).
 *   · 본문(IllustratedMessage 뷰어)은 frame.html(로컬 UI5)+JS/frame.js = KEEP-UI5(그대로).
 *   · child frame(frame.html/frame.js)이 parent.gfn_parent() 와 oAPP 속성, parent.setBusy 에 의존하므로
 *     원본 oAPP 셋업(require, remote, convert, ICON_MSG, UI5 관련, attr, fn 등)을 1:1 보존한다.
 *   창 크롬·테마 매핑 패턴은 iconPrevPopup/index.js 와 동일. (browser-window-common-ux)
 ************************************************************************/

/************************************************************************
 * Global.. (원본 index.html 인라인 스크립트 1:1)
 ************************************************************************/
let oAPP = {};
oAPP.fn = {};
oAPP.attr = {};
oAPP.ICON_MSG = {};
oAPP.require = require;
oAPP.remote = require('@electron/remote');
oAPP.path = oAPP.remote.require('path');
oAPP.__dirname = __dirname;
oAPP.fs = oAPP.remote.require('fs');
oAPP.convert = require('xml-js');

window.oAPP = oAPP;

const
    REMOTE = oAPP.remote,
    APP = oAPP.remote.app,
    PATH = oAPP.remote.require('path'),
    APPPATH = APP.getAppPath(),
    PATHINFOURL = PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"),
    PATHINFO = require(PATHINFOURL),
    WSERR = require(PATHINFO.WSTRYCATCH),
    zconsole = WSERR(window, document, console),
    WSUTIL = require(PATHINFO.WSUTIL),
    CURRWIN = REMOTE.getCurrentWindow(),
    PARWIN = CURRWIN.getParentWindow(),
    IPCRENDERER = require('electron').ipcRenderer;

oAPP.REMOTE = require('@electron/remote');
oAPP.IPCRENDERER = require('electron').ipcRenderer;
oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
oAPP.PATH = oAPP.REMOTE.require('path');
oAPP.FS = oAPP.REMOTE.require('fs');
oAPP.APP = oAPP.REMOTE.app;
oAPP.USERDATA = oAPP.APP.getPath("userData");


/************************************************************************
 * 공통 셸 크롬(.u4a-titlebar) / Busy — 원본 UI5 customHeader 의 창 크롬을 외부화.
 *   · 콘텐츠(IllustratedMessage 뷰어)는 iframe 안 로컬 UI5(frame.js)=KEEP-UI5.
 *   · 창 버튼(min/max/close) 의미는 원본 frame.js customHeader 1:1:
 *       min   = CURRWIN.minimize()
 *       max   = maximize ↔ unmaximize 토글(+아이콘 스왑)
 *       close = CURRWIN.hide()  ※ 이미지 아이콘은 SYSID당 1개 상주 뷰어(콜백 없음) → 닫기=숨김(재사용 대상)
 ************************************************************************/

// 공통 .u4a-busy 토글 — child frame(frame.js) 이 로드 완료 시 parent.setBusy("") 로 호출(원본 시그니처 유지).
function setBusy(bIsBusy) {
    var oBusy = document.getElementById("illustpBusy");
    if (!oBusy) { return; }
    // 공통 .u4a-busy 표시 트리거 = data-busy="true" (shell.css). 빈값/removeAttribute 는 안 뜸(전 소비처 규약).
    if (bIsBusy) { oBusy.setAttribute("data-busy", "true"); }
    else { oBusy.setAttribute("data-busy", "false"); }
} // end of setBusy

// 셸 busy 별칭(다른 소비처 대비, 동일 대상).
oAPP.fn.setShellBusy = function (bBusy) { setBusy(bBusy); };

/************************************************************************
 * HTML5 WS4 테마 키(theme_ws4/{SYSID}.json THEME, 예: "horizon_white") → iframe UI5 테마명.
 *   ★ frame.html 부트스트랩(data-sap-ui-theme) 과 frame.js sap.ui.getCore().applyTheme() 은
 *     UI5 테마명(sap_horizon…)을 기대한다. 워크스페이스 테마는 HTML5 키라 그대로 넘기면 UI5 가
 *     못 찾고 기본 테마로 폴백 → 셸 타이틀바와 색 불일치.
 *   판정 = theme-api 의 mode(light/dark). U4ATheme 이 SKIN_MAP.mode 를 `data-sl-theme` 로 노출하므로 그걸 SSOT 로 읽는다.
 *   커스텀 HTML5 테마(mac/suse/xp/95…)는 UI5 등가가 없어 mode 로만 → sap_horizon / sap_horizon_dark.
 *   ※ 셸 타이틀바(.u4a-titlebar)는 HTML5 키(U4ATheme) 그대로 — 이 매핑은 iframe UI5 전용. (iconPrevPopup 동일)
 ************************************************************************/
oAPP.fn.toUI5Theme = function (sKey) {
    var bDark = false;
    try {
        var bIsCurrent = (!sKey) || (window.U4ATheme && U4ATheme.current() === U4ATheme.normalize(sKey));
        if (bIsCurrent) {
            bDark = (document.documentElement.getAttribute("data-sl-theme") === "dark");
        } else {
            bDark = (String(sKey).indexOf("dark") !== -1);
        }
    } catch (e) {
        bDark = (String(sKey || "").indexOf("dark") !== -1);
    }
    return bDark ? "sap_horizon_dark" : "sap_horizon";
}; // end of oAPP.fn.toUI5Theme

/************************************************************************
 * 서버 UI5 로드 실패 예외 처리 (UI5 부트 소스를 서버(UI5LIB_SSRC)로 전환하면서 추가).
 *   ★ 감지는 오직 frame.html 부트 <script src=SSRC> 의 onerror(실제 로드 실패 이벤트)로만.
 *     타임아웃 워치독은 UI5 가 정상 로드돼도 성공신호 타이밍에 따라 오탐 → 제거([[no-timeout-busy-fallback]]).
 *   실패 시 = 셸(HTML5, 항상 동작)에서 공통 오류 다이얼로그(U4AUI.confirm E) → 확인 시 창 닫기(파괴=재시도 가능).
 *   ★ 메시지는 기존 키만: 본문 ZMSG_WS_COMMON_001/391, 제목 CL_WS_COMMON/B93, 확인 A40 (iconPrevPopup 동일).
 ************************************************************************/

// CL_WS_COMMON 코드 텍스트(제목/버튼).
oAPP.fn._msgCls = function (sCode) {
    try {
        var sSysID = (process.USERINFO && process.USERINFO.SYSID) || "";
        var sLangu = (process.USERINFO && process.USERINFO.LANGU) || oAPP.attr.WS_LANGU || "";
        if (!sSysID || !sLangu) { return ""; }
        return new WSUTIL.MessageClassText(sSysID, sLangu).fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, "", "", "", "");
    } catch (e) { return ""; }
}; // end of oAPP.fn._msgCls

// ZMSG_WS_COMMON_001 번호 텍스트(본문).
oAPP.fn._msgCommon = function (sNo) {
    try {
        var sLangu = (process.USERINFO && process.USERINFO.LANGU) || oAPP.attr.WS_LANGU || "";
        return WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sNo);
    } catch (e) { return ""; }
}; // end of oAPP.fn._msgCommon

// 로드 실패 공통 처리 — 오류 다이얼로그 + 확인 시 창 닫기. (frame.html script.onerror 에서만 호출)
oAPP.fn._onUi5LoadFail = function (sReason) {
    if (oAPP.attr.bLoadFailed) { return; }
    oAPP.attr.bLoadFailed = true;
    setBusy(false);

    console.error("[illustMsgPopup] 서버 UI5 로드 실패 → 오류 안내 후 창 닫기: " + sReason);

    var sTitle = oAPP.fn._msgCls("B93");         // 오류 제목
    var sMsg = oAPP.fn._msgCommon("391");        // 통신 오류... 네트워크 확인... 문의
    var sOk = oAPP.fn._msgCls("A40") || "OK";    // 확인

    if (window.U4AUI && U4AUI.confirm) {
        U4AUI.confirm({
            type: "E",
            title: sTitle,
            message: sMsg,
            buttons: [{ act: "OK", label: sOk, emphasized: true }],
            onClose: oAPP.fn._closeOnError
        });
        return;
    }

    // U4AUI 부재 폴백 — 바로 닫기.
    oAPP.fn._closeOnError();
}; // end of oAPP.fn._onUi5LoadFail

// 오류 확인 시 창 닫기(파괴) — 뷰어(콜백 없음)라 부모 통지 없음. 파괴 = 다음 실행 시 새 창으로 재시도.
oAPP.fn._closeOnError = function () {
    try {
        if (CURRWIN && !CURRWIN.isDestroyed()) {
            CURRWIN.setParentWindow(null);
            CURRWIN.close();
        }
    } catch (e) { }
}; // end of oAPP.fn._closeOnError

// 최대화 상태에 따라 max 버튼 아이콘 스왑(원본 _attachCurrentWindowEvents maxWinBtn 대체).
oAPP.fn._syncMaxBtnIcon = function () {
    var oMax = document.getElementById("illustpWinMax");
    if (!oMax) { return; }
    var oIcon = oMax.querySelector("i");
    if (!oIcon) { return; }
    var bMax = false;
    try { bMax = CURRWIN.isMaximized(); } catch (e) { bMax = false; }
    oIcon.className = bMax ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize";
}; // end of oAPP.fn._syncMaxBtnIcon

// 닫기 버튼 — 원본 frame.js customHeader close(decline) press 1:1 = CURRWIN.hide().
//   이미지 아이콘은 콜백 없는 SYSID당 1개 상주 뷰어(opener getCheckAlreadyOpenWindow2 재사용) → 파괴가 아니라 숨김.
oAPP.fn._onCloseBtn = function () {
    if (!CURRWIN || CURRWIN.isDestroyed()) { return; }
    CURRWIN.hide();
}; // end of oAPP.fn._onCloseBtn

// 창 크롬 초기화(로고/제목/버튼 배선) — iconPrevPopup _initChrome 동일 패턴.
oAPP.fn._initChrome = function () {

    // 로고
    var oLogo = document.getElementById("illustpLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    // 제목 = opener 가 넘긴 창 제목(Image Icons [ - SYSID]) — 부트 스크립트가 document.title 에 세팅.
    var oTitle = document.getElementById("illustpTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }

    // 최소화
    var oMin = document.getElementById("illustpWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }

    // 최대화/복원 토글
    var oMax = document.getElementById("illustpWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }

    // 닫기 — 원본 close 버튼 1:1(숨김)
    var oClose = document.getElementById("illustpWinClose");
    if (oClose) { oClose.addEventListener("click", oAPP.fn._onCloseBtn); }

    // 최대화 상태 변화 시 아이콘 스왑
    try {
        CURRWIN.on("maximize", oAPP.fn._syncMaxBtnIcon);
        CURRWIN.on("unmaximize", oAPP.fn._syncMaxBtnIcon);
    } catch (e) { }
    oAPP.fn._syncMaxBtnIcon();

}; // end of oAPP.fn._initChrome

// DOM 준비되면 크롬 배선(타이틀바는 IPC 와 무관하게 즉시 존재).
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", oAPP.fn._initChrome);
} else {
    oAPP.fn._initChrome();
}

/************************************************************************
 * 라이브 테마 변경 추종(셸 타이틀바/배경) — iconPrevPopup _onShellThemeChange 동일 패턴.
 *   iframe UI5 콘텐츠는 frame.js _onIpcMain_if_p13n_themeChange 가 자체 갱신하므로,
 *   여기서는 공통 타이틀바·창 배경(--boot-bg)만 새 테마로 재적용한다.
 ************************************************************************/
oAPP.fn._onShellThemeChange = function () {
    let oThemeInfo = oAPP.fn.getThemeInfo();
    if (!oThemeInfo) { return; }
    try {
        let sWebConBodyCss = "html, body { margin: 0px; height: 100%; background-color: " + oThemeInfo.BGCOL + "; }";
        oAPP.REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);
    } catch (e) { }
    try { document.documentElement.style.setProperty("--boot-bg", oThemeInfo.BGCOL); } catch (e) { }
    try {
        if (window.U4ATheme) {
            U4ATheme.apply(U4ATheme.normalize ? U4ATheme.normalize(oThemeInfo.THEME) : oThemeInfo.THEME);
        }
    } catch (e) { }
}; // end of oAPP.fn._onShellThemeChange

try {
    let _sSysID = process.USERINFO.SYSID;
    oAPP.IPCMAIN.on("if-p13n-themeChange-" + _sSysID, oAPP.fn._onShellThemeChange);
    window.addEventListener("beforeunload", function () {
        try { oAPP.IPCMAIN.removeListener("if-p13n-themeChange-" + _sSysID, oAPP.fn._onShellThemeChange); } catch (e) { }
    });
} catch (e) { }


/************************************************************************
 * IPCRENDERER Events.. (원본 if-illust-prev 1:1)
 ************************************************************************/
IPCRENDERER.on("if-illust-prev", async function (events, oInfo) {

    // 테마 정보를 구한다.
    let oThemeInfo = oAPP.fn.getThemeInfo();

    oAPP.attr.sServerPath = oInfo.sServerPath;  // 서버 경로
    oAPP.attr.sServerHost = oInfo.sServerHost;  // 서버 호스트 경로
    oAPP.attr.sDefTheme = oThemeInfo.THEME;     // 기본 테마 정보(HTML5 WS4 키 — frame.js 도 raw 키로 읽음)
    oAPP.attr.sServerLibPath = oInfo.sServerLibPath; // 서버 라이브러리 경로
    oAPP.attr.USERINFO = process.USERINFO; // 접속 사용자 정보

    // ws 언어 설정정보
    oAPP.attr.WS_LANGU = oAPP.attr.USERINFO.LANGU;

    CURRWIN.setParentWindow(null);

    fnInitLoad();

});

/************************************************************************
 * 부모 윈도우 관련 이벤트 --- start
 ************************************************************************/

oAPP.fn.getUserInfo = function () {
    return process.USERINFO;
};

/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function () {

    let oUserInfo = parent.process.USERINFO;
    let sSysID = oUserInfo.SYSID;

    // 해당 SYSID별 테마 정보 JSON을 읽는다.
    let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
    if (oAPP.FS.existsSync(sThemeJsonPath) === false) {
        return;
    }

    let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");

    try {

        var oThemeJsonData = JSON.parse(sThemeJson);

    } catch (error) {
        return;
    }

    return oThemeJsonData;

}; // end of oAPP.fn.getThemeInfo

// 부모창 닫기 이벤트
oAPP.fn.fnOnParentWindowClosedEvent = () => {

    if (!CURRWIN || CURRWIN.isDestroyed()) {
        return;
    }

    oAPP.attr.isPressWindowClose = "X";

    try {

        CURRWIN.close();

    } catch (error) {

    }

}; // end of oAPP.fn.fnOnParentWindowClosedEvent

/************************************************************************
 * 부모 윈도우 관련 이벤트 --- End
 ************************************************************************/

if (PARWIN && !PARWIN.isDestroyed()) {
    PARWIN.on("closed", oAPP.fn.fnOnParentWindowClosedEvent);
}

/************************************************************************
 * frame Load 수행 (원본 fnInitLoad 1:1 + UI5 테마명 매핑)
 ************************************************************************/
function fnInitLoad() {

    let sGlobalLangu = oAPP.attr.WS_LANGU;

    oAPP.ICON_MSG.M072 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "072"); // Icon

    oAPP.ICON_MSG.M001 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "031"); // Clipboard Copy Success!
    oAPP.ICON_MSG.M002 = "SAP " + oAPP.ICON_MSG.M072; // SAP ICONS
    oAPP.ICON_MSG.M003 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "069"); // Grid
    oAPP.ICON_MSG.M004 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "070"); // List
    oAPP.ICON_MSG.M006 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "076"); // Dark Mode
    oAPP.ICON_MSG.M007 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "077"); // Light Mode
    oAPP.ICON_MSG.M008 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "075"); // Copy

    oAPP.ICON_MSG.M018 = WSUTIL.getWsMsgClsTxt(sGlobalLangu, "ZMSG_WS_COMMON_001", "067"); // Image Icons

    /*********************************************************
     * 번역 대상 아님 --- start
     *********************************************************/
    oAPP.ICON_MSG.M011 = "title"
    oAPP.ICON_MSG.M009 = "IllustratedMessage";
    oAPP.ICON_MSG.M010 = "illustrationType";
    oAPP.ICON_MSG.M012 = "illustrationSize";
    /*********************************************************
    * 번역 대상 아님 --- end
    *********************************************************/

    let oSettings = WSUTIL.getWsSettingsInfo(),
        oSetting_UI5 = oSettings.UI5;

    oAPP.UI5LIB_WSSRC = oSetting_UI5.resourceUrl;
    oAPP.UI5LIB_SSRC = oAPP.attr.sServerHost + oAPP.attr.sServerLibPath;

    // 임시로직!!!
    // 서버 라이브러리 경로가 시작이 '/zu4a_imp/' 가 아닐 경우에는
    // 경로 앞에 접속 서버 호스트를 붙이지 말고 서버 경로 전체를 바라본다.
    if (oAPP.attr.sServerLibPath.substring(0, 10) !== "/zu4a_imp/") {
        oAPP.UI5LIB_SSRC = oAPP.attr.sServerLibPath;
    }

    oAPP.UI5_LANGU = oAPP.attr.WS_LANGU;
    // ★ 부트스트랩 data-sap-ui-theme 는 UI5 테마명이어야 함(HTML5 키 → UI5명 매핑).
    oAPP.UI5_THEME = oAPP.fn.toUI5Theme(oAPP.attr.sDefTheme);

    let oFrame = document.getElementById("floatFrame");
    oFrame.src = "frame.html";

} // end of fnInitLoad

function gfn_parent() {

    return oAPP;

} // end of gfn_parent

window.onbeforeunload = () => {
    /*
        // 브라우저의 닫기 버튼을 누른게 아니라면 종료 하지 않음
        if (oAPP.attr.isPressWindowClose !== "X") {
            return false;
        }
    */
}; // end of window.onbeforeunload
