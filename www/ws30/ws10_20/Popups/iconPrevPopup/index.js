/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : iconPrevPopup/index.js
 ************************************************************************/

/************************************************************************
 * Global..
 ************************************************************************/

var oAPP = {};
    oAPP.fn = {};
    oAPP.msg = {};
    oAPP.attr = {};
    oAPP.data = {};

window.oAPP = oAPP;

var
    REMOTE = require('@electron/remote'),
    CLIPBOARD = REMOTE.clipboard,
    PATH = REMOTE.require('path'),
    FS = REMOTE.require("fs"),
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    PATHINFOURL = PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"),
    PATHINFO = require(PATHINFOURL),
    WSERR = require(PATHINFO.WSTRYCATCH),
    zconsole = WSERR(window, document, console),
    WSUTIL = require(PATHINFO.WSUTIL),
    CURRWIN = REMOTE.getCurrentWindow(),
    PARWIN = CURRWIN.getParentWindow(),
    IPCRENDERER = require('electron').ipcRenderer;


    oAPP.REMOTE = REMOTE;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.USERDATA = oAPP.APP.getPath("userData");
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;

/************************************************************************
 * 공통 셸 크롬(.u4a-titlebar) / Busy — 원본 UI5 customHeader 의 창 크롬을 외부화.
 *   · 콘텐츠(아이콘 리스트)는 iframe 안 서버 UI5(runtime.js)=KEEP-UI5.
 *   · 창 버튼(min/max/close) 의미는 원본 runtime.js fnInitRendering customHeader 1:1:
 *       min   = CURRWIN.minimize() (콜백 모드에선 숨김 — 원본 MINI_INVISI 바인딩)
 *       max   = maximize ↔ unmaximize 토글(+아이콘 스왑)
 *       close = 비콜백(뷰어)→CURRWIN.hide()(SYSID당 1개 재사용) / 콜백(F4)→부모에 취소 통지(RETCD:C)+setParentWindow(null)+CURRWIN.close()(파괴, 누수방지 B안)
 ************************************************************************/

// 공통 .u4a-busy 토글 — runtime.js(iframe) 가 부팅 완료 시 parent.oAPP.fn.setShellBusy(false) 로 호출.
oAPP.fn.setShellBusy = function (bBusy) {
    var oDom = document.getElementById("iconpBusy");
    if (!oDom) { return; }
    if (bBusy) { oDom.setAttribute("data-busy", ""); }
    else { oDom.removeAttribute("data-busy"); }
}; // end of oAPP.fn.setShellBusy

/************************************************************************
 * HTML5 WS4 테마 키(theme_ws4/{SYSID}.json THEME, 예: "horizon_white") → iframe UI5 테마명.
 *   ★ getP13nPreviewHTML(서버 부트) 와 sap.ui.getCore().applyTheme() 은 UI5 테마명(sap_horizon…)을
 *     기대한다(다른 KEEP-UI5 미리보기 fnP13nDesignPopupOpen/callP13nDesignDataPopup 도 서버 T_THEME=UI5명 전달).
 *     반면 워크스페이스 테마는 HTML5 키라 그대로 넘기면 UI5 가 못 찾고 기본 테마로 폴백 → 셸 타이틀바와 색 불일치.
 *   판정 = theme-api 의 mode(light/dark). U4ATheme 이 SKIN_MAP.mode 를 `data-sl-theme` 로 노출하므로 그걸 SSOT 로
 *     읽는다. 아직 적용 전인 키(라이브 테마변경 레이스)면 이름 규칙(*dark)으로 폴백 — 어느 쪽이든 mode 정확.
 *   커스텀 HTML5 테마(mac/suse/xp/95/purple…)는 UI5 등가가 없어 mode 로만 → sap_horizon / sap_horizon_dark.
 *   ※ 셸 타이틀바(.u4a-titlebar)는 HTML5 키(U4ATheme) 그대로 — 이 매핑은 iframe UI5 전용.
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
 * 서버 UI5(sap) 로드 실패 예외 처리.
 *   본문(아이콘 리스트)은 서버 getP13nPreviewHTML 가 부트스트랩하는 UI5(iframe). 통신/경로/서버 문제로 로드
 *   실패하면 iframe 에 sap 객체가 안 생기고 성공 콜백(onFrameLoadSuccess)도 안 온다 → 셸 busy 무한, 안내 0.
 *   감지 2중:
 *     ① 실제 실패 이벤트 — iframe(서브프레임) POST 실패 = webContents 'did-fail-load'(네트워크/서버 오류 즉시).
 *     ② 백스톱 워치독 — getP13nPreviewHTML 는 떴으나 UI5 초기화/성공콜백이 시간 내 안 오면 실패 판정.
 *   실패 시 = 셸(HTML5, 항상 동작)에서 공통 오류 다이얼로그(U4AUI.confirm E) → 확인 시 창을 닫는다(파괴=재시도 가능).
 *   ★ 메시지는 기존 키만: 본문 ZMSG_WS_COMMON_001/391(통신오류·네트워크확인·U4A팀 문의), 제목 CL_WS_COMMON/B93, 확인 A40.
 ************************************************************************/
var C_LOAD_WATCH_MS = 20000;   // UI5 부트 완료 백스톱(성공 콜백 미도래 시 실패)

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

// 로드 감시 시작(fnFrameLoad 직후) — did-fail-load 리스너 + 백스톱 워치독.
oAPP.fn._startLoadGuards = function () {
    oAPP.attr.bBootOk = false;
    oAPP.attr.bLoadFailed = false;
    try { CURRWIN.webContents.on("did-fail-load", oAPP.fn._onFrameFailLoad); } catch (e) { }
    oAPP.attr._loadWatchTimer = setTimeout(function () {
        if (oAPP.attr.bBootOk) { return; }
        oAPP.fn._onUi5LoadFail("watchdog-timeout");
    }, C_LOAD_WATCH_MS);
}; // end of oAPP.fn._startLoadGuards

oAPP.fn._clearLoadGuards = function () {
    if (oAPP.attr._loadWatchTimer) { clearTimeout(oAPP.attr._loadWatchTimer); oAPP.attr._loadWatchTimer = null; }
    try { CURRWIN.webContents.removeListener("did-fail-load", oAPP.fn._onFrameFailLoad); } catch (e) { }
}; // end of oAPP.fn._clearLoadGuards

// iframe(서버 미리보기) 로드 실패 이벤트 — 네트워크/서버 오류 즉시 감지.
oAPP.fn._onFrameFailLoad = function (event, errorCode, errorDesc, validatedURL, isMainFrame) {
    if (oAPP.attr.bBootOk || oAPP.attr.bLoadFailed) { return; }
    if (errorCode === -3) { return; }  // ERR_ABORTED(정상 취소/치환) 제외
    // 아이콘 리스트 서버 미리보기 프레임 실패만(UI5 라이브러리 등 서브리소스 실패는 워치독이 커버).
    if (validatedURL && validatedURL.indexOf("getP13nPreviewHTML") === -1) { return; }
    oAPP.fn._onUi5LoadFail("did-fail-load(" + errorCode + ") " + (errorDesc || ""));
}; // end of oAPP.fn._onFrameFailLoad

// 로드 실패 공통 처리 — 오류 다이얼로그 + 확인 시 창 닫기.
oAPP.fn._onUi5LoadFail = function (sReason) {
    if (oAPP.attr.bLoadFailed || oAPP.attr.bBootOk) { return; }
    oAPP.attr.bLoadFailed = true;
    oAPP.fn._clearLoadGuards();
    oAPP.fn.setShellBusy(false);

    console.error("[iconPrevPopup] 서버 UI5 로드 실패 → 오류 안내 후 창 닫기: " + sReason);

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

// 오류 확인 시 창 닫기(파괴) — 콜백 호출이면 부모에 취소 통지 후 종속 해제.
oAPP.fn._closeOnError = function () {
    try {
        if (oAPP.attr.isCallback === "X" && PARWIN && !PARWIN.isDestroyed()) {
            PARWIN.webContents.send("if-icon-url-callback", { RETCD: "C", RTDATA: "" });
        }
    } catch (e) { }
    try {
        if (CURRWIN && !CURRWIN.isDestroyed()) {
            CURRWIN.setParentWindow(null);
            CURRWIN.close();   // 로드 실패창은 파괴 → 다음 실행 시 새 창으로 재시도.
        }
    } catch (e) { }
}; // end of oAPP.fn._closeOnError

// 최대화 상태에 따라 max 버튼 아이콘 스왑(원본 _attachCurrentWindowEvents maxWinBtn 대체).
oAPP.fn._syncMaxBtnIcon = function () {
    var oMax = document.getElementById("iconpWinMax");
    if (!oMax) { return; }
    var oIcon = oMax.querySelector("i");
    if (!oIcon) { return; }
    var bMax = false;
    try { bMax = CURRWIN.isMaximized(); } catch (e) { bMax = false; }
    oIcon.className = bMax ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize";
}; // end of oAPP.fn._syncMaxBtnIcon

// 콜백 모드 반영 — min 버튼 노출 여부(원본: 콜백이면 최소화 숨김).
oAPP.fn._applyCallbackMode = function (isCallback) {
    var oMin = document.getElementById("iconpWinMin");
    if (oMin) { oMin.style.display = (isCallback === "X") ? "none" : ""; }
}; // end of oAPP.fn._applyCallbackMode

// 창 크롬 초기화(로고/제목/버튼 배선) — versionMng _initChrome 동일 패턴.
oAPP.fn._initChrome = function () {

    // 로고
    var oLogo = document.getElementById("iconpLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    // 제목 = opener 가 넘긴 창 제목(Icon List [ - SYSID]) — 부트 스크립트가 document.title 에 세팅.
    var oTitle = document.getElementById("iconpTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }

    // 최소화
    var oMin = document.getElementById("iconpWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }

    // 최대화/복원 토글
    var oMax = document.getElementById("iconpWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }

    // 닫기 — 원본 close 버튼 1:1(숨김 + 콜백이면 취소 통지)
    var oClose = document.getElementById("iconpWinClose");
    if (oClose) { oClose.addEventListener("click", oAPP.fn._onCloseBtn); }

    // 최대화 상태 변화 시 아이콘 스왑
    try {
        CURRWIN.on("maximize", oAPP.fn._syncMaxBtnIcon);
        CURRWIN.on("unmaximize", oAPP.fn._syncMaxBtnIcon);
    } catch (e) { }
    oAPP.fn._syncMaxBtnIcon();

}; // end of oAPP.fn._initChrome

// 닫기 버튼 — 원본 runtime.js customHeader close 버튼 press 기반.
//   ※ 원본은 콜백 모드에서도 hide 만 해 숨은 창이 누적(재사용도 안 하면서 파괴도 안 함)됐음.
//     콜백(F4 값도움) 창은 매번 새로 뜨므로, 닫을 때 close(파괴)로 바꿔 누수 제거(B안).
oAPP.fn._onCloseBtn = function () {

    if (!CURRWIN || CURRWIN.isDestroyed()) { return; }

    // 비콜백(아이콘 뷰어) = SYSID당 1개 상주 창 → 닫기 = 파괴가 아니라 숨김(재사용 대상).
    if (oAPP.attr.isCallback !== "X") {
        CURRWIN.hide();
        return;
    }

    // 콜백 모드 = 부모에 "취소" 통지 → 부모 종속 해제 → 창 파괴.
    if (PARWIN && !PARWIN.isDestroyed()) {
        PARWIN.webContents.send("if-icon-url-callback", {
            RETCD: "C",
            RTDATA: ""
        });
    }

    CURRWIN.setParentWindow(null);
    CURRWIN.close();

}; // end of oAPP.fn._onCloseBtn

// DOM 준비되면 크롬 배선(타이틀바는 IPC 와 무관하게 즉시 존재).
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", oAPP.fn._initChrome);
} else {
    oAPP.fn._initChrome();
}

/************************************************************************
 * 라이브 테마 변경 추종(셸 타이틀바/배경) — versionMng _onThemeChange 동일 패턴.
 *   iframe UI5 콘텐츠는 runtime.js _onIpcMain_if_p13n_themeChange 가 자체 갱신하므로,
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
 * IPCRENDERER Events..
 ************************************************************************/
IPCRENDERER.on('if-icon-prev', async (events, oInfo) => {

    oAPP.attr.sServerPath = oInfo.sServerPath; // 서버 경로
    oAPP.attr.sServerHost = oInfo.sServerHost; // 서버 호스트 경로
    
    oAPP.attr.oThemeInfo = oInfo.oThemeInfo;   // 테마 정보(HTML5 WS4 키 + BGCOL)
    // 기본 테마 = iframe UI5(서버 부트/applyTheme)용 UI5 테마명으로 매핑(HTML5 키 그대로 넘기면 UI5 폴백).
    oAPP.attr.sDefTheme = oAPP.fn.toUI5Theme(oAPP.attr.oThemeInfo.THEME);
    
    oAPP.attr.USERINFO = process.USERINFO;     // 접속 사용자 정보
    oAPP.attr.isCallback = oInfo.isCallback;

    oAPP.attr.oMetadata = oInfo.oMetadata;

    let oSettingInfo = WSUTIL.getWsSettingsInfo();

    // ws 글로벌 언어 설정정보
    oAPP.attr.WS_LANGU = oSettingInfo.globalLanguage;

    // 콜백 모드 반영(min 버튼 노출) — 원본 customHeader MINI_INVISI 바인딩 대체.
    oAPP.fn._applyCallbackMode(oAPP.attr.isCallback);

    oAPP.fn.fnFrameLoad();

    if (oAPP.attr.isCallback === "X") {
        CURRWIN.setParentWindow(PARWIN);
        return;
    }

    CURRWIN.setParentWindow(null);

});

/************************************************************************
 * 부모 윈도우 관련 이벤트 --- start 
 ************************************************************************/

/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function (){

    let oUserInfo = parent.process.USERINFO;
    let sSysID = oUserInfo.SYSID;
    
    // 해당 SYSID별 테마 정보 JSON을 읽는다.
    let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
    if(oAPP.FS.existsSync(sThemeJsonPath) === false){
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
 * frame Load 수행 
 ************************************************************************/
oAPP.fn.fnFrameLoad = () => {

    let sServerPath = oAPP.attr.sServerPath;
    let sServerHtmlUrl = sServerPath + "/getP13nPreviewHTML";

    let oForm = document.getElementById("u4asendform");
    let aParam = [
            { NAME: "LIBPATH", VALUE: oAPP.attr.oMetadata.LIBPATH },
            { NAME: "LIBRARY", VALUE: "sap.m, sap.f, sap.ui.table" },
            { NAME: "LANGU", VALUE: oAPP.attr.WS_LANGU },
            { NAME: "THEME", VALUE: oAPP.attr.sDefTheme },
            { NAME: "CALLBACKFUNC", VALUE: "parent.oAPP.fn.onFrameLoadSuccess();" },
            { NAME: "ws-platform", VALUE: "3.0" },
        ]

    for (var i = 0; i < aParam.length; i++) {

        let oParam = aParam[i],
            oInput = document.createElement("input");

        oInput.setAttribute("type", "hidden");
        oInput.setAttribute("name", oParam.NAME);
        oInput.setAttribute("value", oParam.VALUE);
        oForm.appendChild(oInput);

    }

    oForm.setAttribute("action", sServerHtmlUrl);

    oForm.submit();

    // 서버 UI5 로드 실패 감시 시작(did-fail-load + 백스톱 워치독).
    oAPP.fn._startLoadGuards();

}; // end of oAPP.fn.fnFrameLoad

/************************************************************************
 * 서버 부트스트랩 로드 성공 시
 ************************************************************************/
oAPP.fn.onFrameLoadSuccess = () => {

    let oWs_frame = document.getElementById("ws_frame"),
        oContWindow = oWs_frame.contentWindow,
        oContentDocu = oWs_frame.contentDocument;

    // 방어: 성공 콜백은 왔으나 UI5(sap) 가 없으면 로드 실패로 처리(runtime.js 는 sap 에 의존).
    if (!oContWindow || !oContWindow.sap) {
        oAPP.fn._onUi5LoadFail("no-sap-on-callback");
        return;
    }

    // 성공 확정 — 로드 감시 해제.
    oAPP.attr.bBootOk = true;
    oAPP.fn._clearLoadGuards();

    // content div 생성
    let oContentDiv = oContentDocu.createElement("div");

    oContentDiv.id = "content";
    oContentDiv.style.display = "none";

    oContentDocu.body.appendChild(oContentDiv);

    // css 파일 넣기
    let sCssLinkPath = PATH.join(PATHINFO.POPUP_ROOT, "iconPrevPopup", "index.css"),
        sCssData = FS.readFileSync(sCssLinkPath, "utf-8");

    let oStyle = oContentDocu.createElement("style");
    oStyle.innerHTML = sCssData;

    oContentDocu.head.appendChild(oStyle);

    // frame 영역에서 동작할 js를 읽어서 eval 처리 한다.
    let sRuntimeJsPath = PATH.join(PATHINFO.POPUP_ROOT, "iconPrevPopup", "runtime.js"),
        sJsData = FS.readFileSync(sRuntimeJsPath, "utf-8");

    oContWindow["___u4a_ws_eval___"](sJsData);

}; // end of oAPP.fn.onFrameLoadSuccess

window.onbeforeunload = () => {

    // if(oAPP.attr.isCallback !== "X") {


    // }



    // // 브라우저의 닫기 버튼을 누른게 아니라면 종료 하지 않음
    // if (oAPP.attr.isPressWindowClose !== "X") {
    //     return false;
    // }

}; // end of window.onbeforeunload
