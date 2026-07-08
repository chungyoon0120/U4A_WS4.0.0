/************************************************************************
 * ui5CssPopup_v2/main/frame.js — 최상위 창(호스트) 스크립트.
 * --------------------------------------------------------------------------
 *  창 크롬만 [공통 .u4a-titlebar] 로 외부화(frameless). 본문(UI5 Predefined CSS Helper)은
 *  iframe(index.html) 안 서버 UI5 = KEEP-UI5(index.js/views 그대로).
 *   · 로고/제목/min·max·close 배선 = iconPrevPopup·illustMsgPopup 동일 패턴.
 *   · busy = 공통 .u4a-busy(오버레이). 오프너가 켠 메인 busy lock 은 UI5 렌더 완료(index.js
 *     onAfterRendering → parent.fnFinishOpen) 시 1회 해제(broadcast-busy-pair).
 *   · index.js(iframe) 가 parent.fnGetApp / fnGetBusy / fnFinishOpen / CURRWIN / WSUTIL / PATH /
 *     __dirname 에 의존하므로 전역으로 노출한다(var/함수선언).
 ************************************************************************/

/************************************************************************
 * Global Variable
 ************************************************************************/
var REMOTE = require('@electron/remote');
var CURRWIN = REMOTE.getCurrentWindow();
var PATH = REMOTE.require('path');
var APP = REMOTE.app;
var APPPATH = APP.getAppPath();
var IPCRENDERER = require('electron').ipcRenderer;
var PATHINFOURL = PATH.join(APPPATH, "ws30", "resources", "pathInfo.js");
var PATHINFO = require(PATHINFOURL);
var WSUTIL = require(PATHINFO.WSUTIL);
var WSERR = require(PATHINFO.WSTRYCATCH);




// 브라우저의 쿼리 스트링 정보
const oQueryParams = WSUTIL.QueryString.parse(location.href);

var zconsole = WSERR(window, document, console);

var oAPP = {};
oAPP.fn = {};
oAPP.attr = {};

// 현재 비지 상태
oAPP.attr.isBusy = false;

oAPP.REMOTE = require('@electron/remote');
oAPP.IPCRENDERER = require('electron').ipcRenderer;
oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
oAPP.PATH = oAPP.REMOTE.require('path');
oAPP.FS = oAPP.REMOTE.require('fs');
oAPP.APP = oAPP.REMOTE.app;
oAPP.USERDATA = oAPP.APP.getPath("userData");
oAPP.BROWSKEY = oQueryParams.browserkey;

// 오픈 busy 1회 해제 가드 + 형제창 busy 브로드캐스트 채널 + 로드 실패 가드.
var bOpenDone = false;
var bLoadFailed = false;
var oBroad = null;

/************************************************************************
 * IPC 통신 — 오프너(control.js) 가 did-finish-load 에 보내는 IF_DATA 수신.
 *   iframe(index.html) 에 UI5 본문 로드 + 위치 확정된 창을 표시(frameless 흰 번쩍 방지).
 ************************************************************************/
IPCRENDERER.on("if-ui5css-info", function (events, oInfo) {

    let oWs_frame = document.getElementById("ws_frame");
    if (!oWs_frame) {
        return;
    }

    oAPP.attr.IF_DATA = oInfo;

    // 로컬스토리지에 저장할때의 키값에 들어갈 prefix
    oAPP.attr.IF_DATA.STORAGE_KEY_PREFIX = "PRE_CSS";

    oWs_frame.src = "index.html";

    // 위치는 오프너가 setParentCenterBounds 로 확정 → 여기서 표시(타이틀바+busy 먼저, UI5 는 iframe 로드).
    try { CURRWIN.show(); } catch (e) { }

});

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

} // end of oAPP.fn.getThemeInfo

/************************************************************************
 * 공통 .u4a-busy 오버레이 토글 (shell.css 단일 출처). data-busy="true" 만 표시.
 ************************************************************************/
function _setShellBusy(bOn) {
    var oEl = document.getElementById("ui5cssBusy");
    if (!oEl) { return; }
    oEl.setAttribute("data-busy", bOn ? "true" : "false");
}

/************************************************************************
 * 자식창 busy 동기화 채널 (broadcast-to-child-window_{BROWSKEY}).
 *   메인/형제창의 BUSY_ON/OFF 브로드캐스트에 맞춰 이 창 오버레이도 토글.
 ************************************************************************/
function _initBroadcast() {
    try {
        oBroad = new BroadcastChannel("broadcast-to-child-window_" + oAPP.BROWSKEY);
        oBroad.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (sPrc === "BUSY_ON") { _setShellBusy(true); }
            else if (sPrc === "BUSY_OFF") { _setShellBusy(false); }
        };
    } catch (e) { }
}

/************************************************************************
 * UI5 본문 렌더 완료 시 index.js(iframe) 가 호출 — 오프너가 켠 메인 busy lock 해제 +
 *   형제창 busy off + 오버레이 해제(1회). (broadcast-busy-pair)
 ************************************************************************/
function fnFinishOpen() {
    if (bOpenDone || bLoadFailed) { return; }
    bOpenDone = true;
    // 메인(WS) 창 busy lock 해제.
    try { IPCRENDERER.send("if-send-action-" + oAPP.BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    // 형제 자식창 busy off.
    try { if (oBroad) { oBroad.postMessage({ PRCCD: "BUSY_OFF" }); } } catch (e) { }
    // 이 창 오버레이 해제.
    _setShellBusy(false);
    // 혹시 아직 표시 전이면 표시(안전망).
    try { CURRWIN.show(); } catch (e) { }
}

/************************************************************************
 * 서버 UI5 로드 실패 예외 처리 (illustMsgPopup/iconPrevPopup _onUi5LoadFail 동일 취지).
 *   ★ 감지는 오직 index.js(iframe) 의 부트 <script src=WS30_BOOT_PATH> onerror + window.load 의
 *     sap 미정의 체크(실제 이벤트)로만. 타임아웃 워치독은 정상 로드도 오탐 → 미사용(no-timeout-busy-fallback).
 *   ★ sap 미생성 시 index.js 가 sap.ui... 접근하면 ReferenceError → ws_trycatch 크리티컬(앱 종료) → 선제 차단.
 *   실패 시 = 셸(HTML5, 항상 동작)에서 공통 오류 다이얼로그(U4AUI.confirm E) → 확인 시 창 닫기(재실행=재시도).
 *   ★ 메시지는 기존 키만: 제목 CL_WS_COMMON/B93, 본문 ZMSG_WS_COMMON_001/391, 확인 A40. (no-invented-messages)
 ************************************************************************/

// CL_WS_COMMON 코드 텍스트(제목/버튼).
function _msgCls(sCode) {
    try {
        var sSysID = (process.USERINFO && process.USERINFO.SYSID) || "";
        var sLangu = (process.USERINFO && process.USERINFO.LANGU) || "";
        if (!sSysID || !sLangu) { return ""; }
        return new WSUTIL.MessageClassText(sSysID, sLangu).fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, "", "", "", "");
    } catch (e) { return ""; }
}

// ZMSG_WS_COMMON_001 번호 텍스트(본문).
function _msgCommon(sNo) {
    try {
        var sLangu = (process.USERINFO && process.USERINFO.LANGU) || "";
        return WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sNo);
    } catch (e) { return ""; }
}

// 오류 확인 시 창 닫기(파괴) — 뷰어(콜백은 CSS 적용 IPC 로 별개)라 닫기=파괴, 재실행 시 새 창으로 재시도.
function fnCloseOnError() {
    try {
        if (CURRWIN && !CURRWIN.isDestroyed()) {
            CURRWIN.setClosable(true);
            CURRWIN.setParentWindow(null);
            CURRWIN.close();
        }
    } catch (e) { }
}

// 서버 UI5 로드 실패 공통 처리 — index.js(iframe) onerror / sap 미정의 체크에서만 호출.
function fnOnUi5LoadFail(sReason) {
    if (bLoadFailed || bOpenDone) { return; }
    bLoadFailed = true;

    console.error("[ui5CssPopup_v2] 서버 UI5 로드 실패 → 오류 안내 후 창 닫기: " + sReason);

    // 오프너가 켠 메인 busy lock 해제 + 형제창 busy off + 오버레이 해제 + 창 표시(다이얼로그 보이게).
    try { IPCRENDERER.send("if-send-action-" + oAPP.BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    try { if (oBroad) { oBroad.postMessage({ PRCCD: "BUSY_OFF" }); } } catch (e) { }
    _setShellBusy(false);
    try { CURRWIN.show(); } catch (e) { }

    var sTitle = _msgCls("B93");         // 오류 제목
    var sMsg = _msgCommon("391");        // 통신 오류... 네트워크 확인... 문의
    var sOk = _msgCls("A40") || "OK";    // 확인

    if (window.U4AUI && U4AUI.confirm) {
        U4AUI.confirm({
            type: "E",
            title: sTitle,
            message: sMsg,
            buttons: [{ act: "OK", label: sOk, emphasized: true }],
            onClose: fnCloseOnError
        });
        return;
    }

    // U4AUI 부재 폴백 — 바로 닫기.
    fnCloseOnError();
}

/************************************************************************
 * 창 크롬(로고/제목/min·max·close) 배선 — iconPrevPopup _initChrome 동일 패턴.
 *   닫기: 창이 closable:false 라 직접 close 불가 → 공통 U4AUI.closeWindow(내부 unload 로 콜백 IFC 전송).
 ************************************************************************/
function _initChrome() {

    // 로고(메인 창과 동일 APPPATH/img/logo.png).
    var oLogo = document.getElementById("ui5cssLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replace(/\\/g, "/")); } catch (e) { }
    }

    // 제목(opener 가 넘긴 TITLE — 부트 스크립트가 document.title 에 세팅).
    var oTitle = document.getElementById("ui5cssTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }

    // 최소화
    var oMin = document.getElementById("ui5cssWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }

    // 최대화/복원 토글
    var oMax = document.getElementById("ui5cssWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }

    // 최대화 상태 변화 시 아이콘 스왑
    try {
        CURRWIN.on("maximize", _syncMaxBtnIcon);
        CURRWIN.on("unmaximize", _syncMaxBtnIcon);
    } catch (e) { }
    _syncMaxBtnIcon();

    // 닫기 — busy 중 차단 + 공통 closeWindow(closable:false 라 직접 close 불가).
    var oClose = document.getElementById("ui5cssWinClose");
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (oAPP.attr.isBusy === true) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

} // end of _initChrome

// 최대화 상태에 따라 max 버튼 아이콘 스왑.
function _syncMaxBtnIcon() {
    var oMax = document.getElementById("ui5cssWinMax");
    if (!oMax) { return; }
    var oIcon = oMax.querySelector("i");
    if (!oIcon) { return; }
    var bMax = false;
    try { bMax = CURRWIN.isMaximized(); } catch (e) { bMax = false; }
    oIcon.className = bMax ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize";
}

/************************************************************************
 * 셸(타이틀바/창 배경) 라이브 테마 변경 추종 — illustMsgPopup _onShellThemeChange 동일.
 *   iframe UI5 콘텐츠는 index.js 가 자체 갱신(if-p13n-themeChange). 여기선 타이틀바·--boot-bg 만.
 ************************************************************************/
function _onShellThemeChange() {
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
}

/************************************************************************
 * 부트 — 창 크롬/브로드캐스트/포커스 blur 초기화, 테마 IPC 구독.
 ************************************************************************/
window.addEventListener("load", function () {

    try { CURRWIN.setMenu(null); } catch (e) { }

    // 창 포커스 blur 흐림(공통).
    try { if (window.U4AUI && U4AUI.initWindowFocusState) { U4AUI.initWindowFocusState(); } } catch (e) { }

    _initChrome();
    _initBroadcast();

    // 셸 테마 변경 IPC 구독(SYSID 별).
    try {
        var sSysID = process.USERINFO.SYSID;
        oAPP.IPCMAIN.on("if-p13n-themeChange-" + sSysID, _onShellThemeChange);
        window.addEventListener("beforeunload", function () {
            try { oAPP.IPCMAIN.removeListener("if-p13n-themeChange-" + sSysID, _onShellThemeChange); } catch (e) { }
        });
    } catch (e) { }

});

/************************************************************************
 * 부모의 APP Object 전달
 ************************************************************************/
function fnGetApp() {

    return oAPP;

}

// 현재 Busy 실행 여부
function fnGetBusy() {

    return oAPP.attr.isBusy;

}
