/****************************************************************************
 * 데이터 모델 바인딩 편집 팝업(Binding Popup) 창 부트/셸 (frame.js) — HTML5
 * --------------------------------------------------------------------------
 *  ★ 소형 callBindPopup(js/fnBindPopupOpen.js = 속성아이콘 인앱 다이얼로그)과 다른 기능 —
 *    이것은 WS20 헤더 "바인딩 팝업"(fnBindWindowPopupOpener)이 여는 대형 별창이다.
 *
 *  원본: frame.html(로더 iframe) + index.html/index.js(UI5 sap.m.App/Page/Splitter + 3영역 모듈)
 *        의 2단 iframe. HTML5: docPopup/runtimeClassNav 과 동일한 1단 frameless 창으로 재작성 —
 *        최상위 문서에 [공통 .u4a-titlebar + 3영역 스플리터 셸]을 직접 둔다.
 *
 *  레이아웃(원본 callBindPopup 1059~ 대응, 기본 BULK 3분할):
 *   · 좌   = 모델 필드 트리(sap.ui.table.TreeTable → 공통 createTree 3열)      [Stage2]
 *   · 중상 = 디자인 트리(앱 전체 UI 계층)                                       [Stage3]
 *   · 중하 = 추가속성 적용 테이블                                               [Stage4]
 *   · 우   = 추가속성(MPROP) 정보 테이블                                        [Stage4]
 *
 *  ★ 불변 계약(07 §13.2 — UI 렌더만 교체, 아래는 그대로 보존):
 *   · IPC `if_modelBindingPopup`(초기 데이터), `if-p13n-themeChange-${SYSID}`(테마추종), `if-dragEnd`.
 *   · BroadcastChannel 주채널 `${browserkey}_ws20_bindpop`(channelKey), 공용 busy `broadcast-to-child-window_${browserkey}`.
 *   · PRCCD 철자 비대칭(UPDATE_DESIGN_DATA 언더바 / UPDATE-DESIGN-DATA 하이픈) 절대 통일 금지.
 *   · dataTransfer prc001/prc002 + DnDRandKey(=SSID). 데이터 키 T_0014/T_0015/oPrev/T_CEVT/T_MPROP.
 *
 *  ★ 이 파일(Stage1) 책임 = 창 셸/부트/타이틀바/테마/busy/공용 busy 브로드캐스트/생명주기.
 *    데이터 로드·주채널(WS20 동기화)·영역 렌더러는 후속 단계 모듈이 담당(아래 _bootApp 훅).
 ****************************************************************************/

var REMOTE = require('@electron/remote'),
    IPCMAIN = REMOTE.require('electron').ipcMain,
    IPCRENDERER = require('electron').ipcRenderer,
    PATH = REMOTE.require('path'),
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = require(PATHINFO.WSUTIL),
    WSERR = require(PATHINFO.WSTRYCATCH),
    FS = REMOTE.require('fs'),
    USERDATA = APP.getPath('userData'),
    CURRWIN = REMOTE.getCurrentWindow();

var oQueryParams = WSUTIL.QueryString.parse(location.href);

var USERINFO = oQueryParams.USERINFO,
    SESSKEY = oQueryParams.sessionKey,
    BROWSKEY = oQueryParams.browserkey,
    BGCOL = oQueryParams.BGCOL,
    SYSID = USERINFO.SYSID,
    LANGU = USERINFO.LANGU,
    WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

var zconsole = WSERR(window, document, console);

/* ==========================================================================
 * 앱 객체 — 원본 index.js 의 oAPP 계약을 유지(영역 모듈이 window.oAPP 로 접근).
 *   attr = 세션/데이터, fn = 함수, ui = 컨트롤 참조, common = 공통.
 * ======================================================================== */
var oAPP = {};
oAPP.fn = {};
oAPP.ui = {};
oAPP.attr = {};
oAPP.common = {};

oAPP.REMOTE = REMOTE;
oAPP.IPCRENDERER = IPCRENDERER;
oAPP.IPCMAIN = IPCMAIN;
oAPP.PATH = PATH;
oAPP.FS = FS;
oAPP.APP = APP;
oAPP.APPPATH = APPPATH;
oAPP.WSUTIL = WSUTIL;
oAPP.USERDATA = USERDATA;

// 접속(워크스페이스) 언어 — 메시지 SSOT.
oAPP.attr.GLANGU = WSUTIL.getWsSettingsInfo().globalLanguage;

// 셸 상태(부트 1회성).
var bBusy = false, oToastTimer = null, iBusyWatch = null, bOpenDone = false,
    bBooted = false, oBroad = null;

/* ── 로컬 헬퍼 ──────────────────────────────────────────────────────────── */

// /U4A/CL_WS_COMMON · /U4A/MSG_WS 등 메시지 클래스 텍스트.
function _msg(sCls, sCode, p1, p2, p3, p4) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
    catch (e) { return ""; }
}
// ZMSG_WS_COMMON_001 (Workspace 다국어 — 원본 bindPopup 은 이 클래스로 전 문구를 냄).
function _zmsg(sNo, p1) {
    try { return WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU || LANGU, "ZMSG_WS_COMMON_001", sNo, p1 || "") || ""; }
    catch (e) { return ""; }
}
oAPP.common.msg = _msg;
oAPP.common.zmsg = _zmsg;

// SYSID 별 테마 JSON(theme_ws4) — 라이브 테마 변경 추종용.
function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// busy(로딩 오버레이 + 닫기 차단 + 공용 자식창 브로드캐스트). runtimeClassNav/docPopup 규약.
//   oOpt.ISBROAD=true → 브로드캐스트 재전송 안 함(수신으로 인한 busy).
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("bwpBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}
oAPP.fn.setBusy = function (bIsShow, oOpt) {
    // 원본 setBusy(bBusy, {ISBROAD}) 계약 — 'X'/true 켜기, ''/false 끄기.
    _setBusy(bIsShow === true || bIsShow === "X", oOpt);
};

// 로드 완료 — 메인 busy lock 해제 + 공용 BUSY_OFF + 본문 표시(1회만).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    var oShell = document.getElementById("bwpShell");
    if (oShell) { oShell.classList.add("u4aBwpShown"); }
}

// 공통 .u4a-toast(화면 정중앙) — 싱글톤 div + data-show + 3초.
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aBwpToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aBwpToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}
oAPP.fn.toast = _toast;

/* ── 타이틀바/닫기 ──────────────────────────────────────────────────────── */
function _initChrome() {
    var oLogo = document.getElementById("bwpLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    var oTitle = document.getElementById("bwpTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        if (!s) { s = _msg("/U4A/CL_WS_COMMON", "A15"); } // Binding Popup
        oTitle.textContent = s;
    }

    var oClose = document.querySelector('#bwpTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }
}

// 라이브 테마 변경(원본 _onIpcMain_if_p13n_themeChange). 개인화 없음 → 워크스페이스 테마 추종.
function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
            BGCOL = oTheme.BGCOL;
            document.documentElement.style.setProperty("--boot-bg", oTheme.BGCOL);
        }
    } catch (e) { }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    oAPP.attr.oThemeInfo = oTheme;
}

/* ── 스플리터(3개: 좌|중, 중|우, 디자인|추가속성) ─────────────────────────
 *   원본 sap.ui.layout.Splitter 대응. 폭/높이는 셸 CSS 변수로 관리, 드래그로 clamp.
 *   더블클릭 = 기본값 복귀. (16 §4.3: 최대화→축소 시 재클램프는 window resize 에서.)
 * ------------------------------------------------------------------------ */
var C_LEFT_MIN = 240, C_RIGHT_MIN = 240, C_CENTER_MIN = 300, C_DESIGN_MIN = 200, C_ADDIT_MIN = 160;

function _shellVar(sName, sVal) {
    var oShell = document.getElementById("bwpShell");
    if (oShell) { oShell.style.setProperty(sName, sVal); }
}

function _wireSplitters() {
    var oShell = document.getElementById("bwpShell");
    var oCenter = document.getElementById("bwpCenterPane");
    if (!oShell) { return; }

    // 세로 바(가로 폭 조절) — 좌측 폭 / 우측 폭.
    function _wireV(sBarId, sVar, sSide) {
        var oBar = document.getElementById(sBarId);
        if (!oBar) { return; }
        var bDrag = false;
        oBar.addEventListener("mousedown", function (ev) {
            bDrag = true;
            document.body.classList.add("u4a-dragging");
            oShell.classList.add("u4aBwpResizingV");
            ev.preventDefault();
        });
        document.addEventListener("mousemove", function (ev) {
            if (!bDrag) { return; }
            var r = oShell.getBoundingClientRect();
            var px = (sSide === "left") ? (ev.clientX - r.left) : (r.right - ev.clientX);
            var iMin = (sSide === "left") ? C_LEFT_MIN : C_RIGHT_MIN;
            // 반대편·중앙 최소폭 확보(전체 - 이쪽 - 반대편 - 바들 ≥ 중앙 최소).
            var iMax = r.width - C_CENTER_MIN - ((sSide === "left") ? C_RIGHT_MIN : C_LEFT_MIN) - 16;
            px = Math.max(iMin, Math.min(px, Math.max(iMin, iMax)));
            _shellVar(sVar, px + "px");
        });
        document.addEventListener("mouseup", function () {
            if (!bDrag) { return; }
            bDrag = false;
            document.body.classList.remove("u4a-dragging");
            oShell.classList.remove("u4aBwpResizingV");
        });
        oBar.addEventListener("dblclick", function () { _shellVar(sVar, ""); });
    }

    _wireV("bwpSplit1", "--bwp-left-w", "left");
    _wireV("bwpSplit3", "--bwp-right-w", "right");

    // 가로 바(중앙 세로 높이 조절) — 디자인 트리 높이.
    (function () {
        var oBar = document.getElementById("bwpSplit2");
        if (!oBar || !oCenter) { return; }
        var bDrag = false;
        oBar.addEventListener("mousedown", function (ev) {
            bDrag = true;
            document.body.classList.add("u4a-dragging");
            oShell.classList.add("u4aBwpResizingH");
            ev.preventDefault();
        });
        document.addEventListener("mousemove", function (ev) {
            if (!bDrag) { return; }
            var r = oCenter.getBoundingClientRect();
            var px = ev.clientY - r.top;
            var iMax = r.height - C_ADDIT_MIN - 8;
            px = Math.max(C_DESIGN_MIN, Math.min(px, Math.max(C_DESIGN_MIN, iMax)));
            oCenter.style.setProperty("--bwp-design-h", px + "px");
        });
        document.addEventListener("mouseup", function () {
            if (!bDrag) { return; }
            bDrag = false;
            document.body.classList.remove("u4a-dragging");
            oShell.classList.remove("u4aBwpResizingH");
        });
        oBar.addEventListener("dblclick", function () { oCenter.style.removeProperty("--bwp-design-h"); });
    })();
}

/* ── 공용 busy 브로드캐스트(형제 자식창) ──────────────────────────────────
 *   `broadcast-to-child-window_${browserkey}` — 원본 oMain.broadToChild. WS20 동기화 주채널
 *   (`${browserkey}_ws20_bindpop`)은 데이터/선택 동기화라 통신 단계(Stage6)에서 배선한다.
 * ------------------------------------------------------------------------ */
function _initBroadcast() {
    try {
        oBroad = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
        oBroad.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (sPrc === "BUSY_ON") { _setBusy(true, { ISBROAD: true }); }
            else if (sPrc === "BUSY_OFF") { _setBusy(false, { ISBROAD: true }); }
        };
        oAPP.attr.oMainBroad = oBroad;
    } catch (e) { }
}

/* ── 부트: if_modelBindingPopup 수신 → 데이터 저장 → 앱 기동 ──────────────── */
function _onModelBindingPopup(events, oInfo) {
    if (bBooted) { return; }
    if (!oInfo) { return; }
    bBooted = true;

    // 원본 frame.js if_modelBindingPopup 1:1 — oAPP.attr 에 저장.
    oAPP.attr.oUserInfo = oInfo.oUserInfo;
    oAPP.attr.oThemeInfo = oInfo.oThemeInfo;
    oAPP.attr.T_9011 = oInfo.T_9011 || [];
    oAPP.attr.T_0022 = oInfo.T_0022 || [];
    oAPP.attr.T_0023 = oInfo.T_0023 || [];
    oAPP.attr.T_0014 = oInfo.T_0014 || [];
    oAPP.attr.T_0015 = oInfo.T_0015 || [];
    oAPP.attr.T_CEVT = oInfo.T_CEVT || [];
    oAPP.attr.oAppInfo = oInfo.oAppInfo || {};
    oAPP.attr.servNm = oInfo.servNm || "";
    oAPP.attr.DnDRandKey = oInfo.SSID;
    oAPP.attr.SSID = oInfo.SSID;
    oAPP.attr.channelKey = oInfo.channelKey;
    oAPP.attr.browserkey = BROWSKEY;

    _bootApp();
}

// 앱 기동 — 영역 모듈 초기화(있으면) → 창 표시 → busy 해제.
//   Stage2~ 에서 oAPP.fn.initModelArea / initDesignArea / initAdditArea / loadBindData 등을 채운다.
function _bootApp() {
    try {
        // [Stage2+] 각 영역 렌더러(정의된 것만 호출 — 미구현 단계에선 skip).
        if (typeof oAPP.fn.initModelArea === "function") { oAPP.fn.initModelArea(); }
        if (typeof oAPP.fn.initDesignArea === "function") { oAPP.fn.initDesignArea(); }
        if (typeof oAPP.fn.initAdditArea === "function") { oAPP.fn.initAdditArea(); }
        // [Stage6] WS20 동기화 주채널 생성 + 초기 데이터 로드.
        if (typeof oAPP.fn.createBindChannel === "function") { oAPP.fn.createBindChannel(); }
        if (typeof oAPP.fn.loadBindData === "function") { oAPP.fn.loadBindData(); }
    } catch (e) {
        console.error("[HTML5][bindWindow] 앱 기동 오류:", e && e.message);
    }
    _finishOpen();
}

function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

// 디자인영역 드래그 종료 IPC(원본 if-dragEnd 대응) — 드롭 강조 해제.
function _onDialogDragEnd() {
    try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } } catch (x) { }
    try { if (typeof oAPP.fn.onDesignDragEnd === "function") { oAPP.fn.onDesignDragEnd(); } } catch (e) { }
}

/* ── 부트 진입 ──────────────────────────────────────────────────────────── */
window.addEventListener("load", function () {

    try { CURRWIN.setMenu(null); } catch (e) { }

    _setBusy(true);

    _initChrome();
    _initBroadcast();
    _wireSplitters();

    // 초기 데이터 IPC — opener did-finish-load 가 send.
    IPCRENDERER.on("if_modelBindingPopup", _onModelBindingPopup);
    // 디자인영역 드래그 종료 / 라이브 테마 변경.
    IPCMAIN.on("if-Dialog-dragEnd", _onDialogDragEnd);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // frameless — 위치 확정 후 표시(흰 번쩍 방지). opener show:false.
    try { CURRWIN.show(); } catch (e) { }

    // 안전판 — if_modelBindingPopup 이 안 오면 busy 강제 해제(방어).
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][bindWindow] 초기 데이터(if_modelBindingPopup) 수신 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);
});

// busy 중 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    try { window.removeEventListener("click", _keepSession); } catch (e) { }
    try { window.removeEventListener("keyup", _keepSession); } catch (e) { }
    try { IPCRENDERER.removeListener("if_modelBindingPopup", _onModelBindingPopup); } catch (e) { }
    try { IPCMAIN.removeListener("if-Dialog-dragEnd", _onDialogDragEnd); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { if (typeof oAPP.fn.onWindowClose === "function") { oAPP.fn.onWindowClose(); } } catch (e) { }
    try { if (oBroad) { oBroad.close(); } } catch (e) { }
};

// 영역 모듈이 접근할 수 있도록 전역 노출(원본 window.oAPP 계약).
window.oAPP = oAPP;
