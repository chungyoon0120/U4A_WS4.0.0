/****************************************************************************
 * 에디터 시리즈(CSS/JS/HTML) 창 로직 (editorFrame.js)
 * --------------------------------------------------------------------------
 *  frameless BrowserWindow(공통 .u4a-titlebar) 안에서:
 *   · Monaco 호스트(host/index.html, 별도 분리) iframe 을 임베드,
 *   · 메인↔창 IPC(if-editor-info / if-editor-save) 계약은 원본 그대로 유지,
 *   · 저장 버튼은 푸터, Ctrl+S(에디터 한정) 위임,
 *   · 워크스페이스 테마 변경(if-p13n-themeChange) 시 창+에디터 실시간 추종.
 *  원본: editorFrame.js(창 부트) + editor.js(ACE 로직)를 한 파일로 합치고 ACE→Monaco 치환.
 ****************************************************************************/

// var 로 선언해야 호스트 iframe 에서 parent.PATH/APPPATH 접근 가능.
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
    BGCOL = oQueryParams.BGCOL,          // 현재 테마 배경(라이브 테마 변경 시 갱신) — Monaco 다크/라이트 판정용.
    SYSID = USERINFO.SYSID,
    LANGU = USERINFO.LANGU,
    WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

var zconsole = WSERR(window, document, console);

// 호스트(iframe) 통신 채널 식별자.
var C_HOSTID = "U4AEDH";

// 현재 에디터 상태.
var oState = { EDITORINFO: null, APPINFO: null, SRCHVAL: null, ready: false };
var oFrame = null, bBusy = false, oToastTimer = null, iBusyWatch = null, bOpenDone = false;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────
function _msg(sCls, sCode, p1) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
}

function _isEdit() {
    return !!(oState.APPINFO && oState.APPINFO.IS_EDIT === "X");
}

// OBJTY → Monaco 언어.
function _langOf(OBJTY) {
    switch (OBJTY) {
        case "JS": return "javascript";
        case "HM": return "html";
        case "CS": return "css";
        default: return "plaintext";
    }
}

// 테마 배경색(BGCOL) 휘도 → Monaco 빌트인 테마(어두우면 vs-dark, 밝으면 vs).
//   이름(dark 접미사)보다 배경 휘도가 견고(새 다크 테마 추가에도 자동 대응).
function _monacoThemeFromBg(sBg) {
    try {
        var s = String(sBg || "").trim(), r, g, b;
        var m = s.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (m) { r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16); }
        else {
            var m2 = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!m2) { return "vs-dark"; }
            r = +m2[1]; g = +m2[2]; b = +m2[3];
        }
        return (0.299 * r + 0.587 * g + 0.114 * b) < 128 ? "vs-dark" : "vs";
    } catch (e) { return "vs-dark"; }
}

// SYSID 별 테마 정보 JSON 읽기(라이브 테마용).
function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// 호스트로 명령 전송.
function _toHost(oMsg) {
    try {
        oMsg = oMsg || {};
        oMsg.__u4aedh = true;
        oMsg.hostId = C_HOSTID;
        if (oFrame && oFrame.contentWindow) { oFrame.contentWindow.postMessage(oMsg, "*"); }
    } catch (e) { }
}

function _readHost() {
    try { return oFrame.contentWindow.editor.getValue(); } catch (e) { return null; }
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트).
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("editorBusy");
    if (oEl) { oEl.classList.toggle("show", bBusy); }
    try { CURRWIN.closable = !bBusy; } catch (e) { }
    // 자식창 busy 동기화(원본 broadToChild). ISBROAD 면 내가 수신측이라 재발송 안 함.
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// ── 오픈 시 busy 는 "한 번 켜서 끝까지 유지 → 완전 로드(또는 오류) 시 1회만 해제" ──────
//   오프너가 WS20 를 fnSetBusyLock("X") 로 잠근 상태로 창이 뜬다. 창은 그 busy 를 중간에
//   끄지 않고(깜빡임 방지), 에디터가 완전히 준비(host ready)되면 _finishOpen 으로 한 번만 해제한다.
//   host 로드 실패/지연(오류 상황)에 대비한 워치독도 같은 _finishOpen 으로 모인다.
function _finishOpen() {
    if (bOpenDone) { return; }              // 중복 해제 방지(ready/워치독 경합).
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    // WS20 메인 busy 잠금 해제(원본 SETBUSYLOCK) — 에디터가 다 뜬 시점에 한 번만.
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    // 창 자체 오버레이 끄기 + 자식창 BUSY_OFF 방송.
    _setBusy(false);
}

// 저장 토스트.
function _toast(sText) {
    var oEl = document.getElementById("editorToast");
    if (!oEl) { return; }
    oEl.textContent = sText || "";
    oEl.classList.add("show");
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.classList.remove("show"); }, 3000);
}

// 푸터 Save 노출(편집모드에서만 — 원본 LF_SaveBtnVisible).
function _setSaveVisible(bVisi) {
    var oBtn = document.getElementById("editorSaveBtn");
    if (oBtn) { oBtn.hidden = !bVisi; }
}

// ── 현재 상태를 호스트에 반영 ───────────────────────────────────────────
function _applyToHost() {
    var info = oState.EDITORINFO || {};
    var bEdit = _isEdit();
    _toHost({ cmd: "setLanguage", language: _langOf(info.OBJTY) });
    _toHost({ cmd: "setReadOnly", readOnly: !bEdit });
    _toHost({ cmd: "setValue", value: (typeof info.DATA === "string") ? info.DATA : "" });
    // CS 검색 하이라이트(원본 fnFindText 대체).
    if (oState.SRCHVAL != null && String(oState.SRCHVAL) !== "") {
        _toHost({ cmd: "find", value: String(oState.SRCHVAL) });
    }
    _setSaveVisible(bEdit);
    if (bEdit) { _toHost({ cmd: "focus" }); }
}

// 호스트 최초 1회 로드(PARAMS 로 초기 LANG/THEME/READONLY 전달).
function _loadHost() {
    if (!oFrame || oFrame.getAttribute("src")) { return; }
    var info = oState.EDITORINFO || {};
    var oPARAMS = {
        HOSTID: C_HOSTID,
        LANG: _langOf(info.OBJTY),
        THEME: _monacoThemeFromBg(BGCOL),
        READONLY: !_isEdit()
    };
    oFrame.src = "host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oPARAMS));
}

// ── 저장(원본 fnEditorValueSave + fnIpcMain_EditorSave 흐름) ──────────────
function _save() {
    if (!_isEdit()) { return; }                 // 표시모드 저장 불가.
    var sVal = _readHost();
    if (sVal === null) { return; }              // 에디터 미준비.

    var oSave = JSON.parse(JSON.stringify(oState.EDITORINFO || {}));
    oSave.DATA = sVal;

    // 메인으로 저장 위임(원본 IPC 계약 그대로).
    IPCRENDERER.send("if-editor-save", {
        BROWSKEY: BROWSKEY,
        IS_CHAG: "X",
        SAVEDATA: oSave
    });

    // 저장 토스트: MSG_WS 330 "&1 has been saved" (&1 = D23 Editor).
    var sWord = _msg("/U4A/CL_WS_COMMON", "D23");
    _toast(_msg("/U4A/MSG_WS", "330", sWord));
}

// ── 라이브 테마 변경(워크스페이스 테마 추종) ─────────────────────────────
//   이 에디터는 개인화 설정이 없어 추종한다(USP 와 반대). 근거: .analy/12 §5.3.
function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    // 창 네이티브 배경(이동/리로드 중 플래시 방지).
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
        }
    } catch (e) { }
    // 창 토큰 테마 재적용(타이틀바/푸터/토스트 등 토큰 소비부 전부 갱신).
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    // 새 배경 기억(다음 호스트 로드/판정용) + Monaco 테마(호스트 iframe 은 별 window 라 명시 전달).
    if (oTheme.BGCOL) { BGCOL = oTheme.BGCOL; }
    _toHost({ cmd: "setTheme", theme: _monacoThemeFromBg(oTheme.BGCOL) });
}

// ── 호스트 → 창 메시지(ready / change / save) ────────────────────────────
function _onHostMessage(oEvent) {
    var d = oEvent && oEvent.data;
    if (!d || d.__u4aedh !== true || d.hostId !== C_HOSTID) { return; }
    if (d.evt === "ready") {
        oState.ready = true;
        _applyToHost();
        _finishOpen();           // 에디터 완전 로드 → busy 1회 해제(중간 깜빡임 없음).
        return;
    }
    if (d.evt === "save") { _save(); return; }   // 에디터 한정 Ctrl+S 위임.
}

// ── 메인 → 창: 에디터 정보 수신(원본 if-editor-info) ─────────────────────
function _onEditorInfo(event, res) {
    oState.EDITORINFO = res && res.EDITORINFO;
    oState.APPINFO = res && res.APPINFO;
    oState.SRCHVAL = (res && typeof res.SRCHVAL !== "undefined") ? res.SRCHVAL : null;

    _setTitle();

    if (oFrame && !oFrame.getAttribute("src")) {
        // 최초 로드 — busy 는 오프너가 켠 상태 그대로 유지(여기서 끄지 않음).
        //   창 자체 오버레이만 켜고, 완전 로드(host ready)나 오류(워치독) 시 _finishOpen 으로 1회 해제.
        _setBusy(true);
        try { clearTimeout(iBusyWatch); } catch (e) { }
        iBusyWatch = setTimeout(function () {
            // 오류/지연 상황 — 영구 busy 방지(원본엔 없던 HTML5 안전장치).
            console.error("[HTML5][editor] 호스트 로드 지연/실패 — busy 강제 해제");
            _finishOpen();
        }, 15000);
        _loadHost();
    } else if (oState.ready) {
        // 재수신(예: CS 재오픈) — 즉시 반영. WS20 잠금은 오프너 dedup 분기가 처리하므로
        //   여기선 창 오버레이만 잠깐 켰다 끈다.
        _setBusy(true);
        _applyToHost();
        _setBusy(false);
    }
}

// 타이틀바 제목(opener 가 넘긴 창 제목 = "APPID - OBJNM Editor").
function _setTitle() {
    var oTitle = document.getElementById("editorTitle");
    if (!oTitle) { return; }
    var s = "";
    try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
    oTitle.textContent = s;
}

// ── 타이틀바/푸터 초기화 ────────────────────────────────────────────────
function _initChrome() {
    // 로고(메인 창과 동일 APPPATH/img/logo.png).
    var oLogo = document.getElementById("editorLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }
    _setTitle();

    // 닫기(타이틀바 X) — frameless 창 닫기.
    var oClose = document.querySelector('#editorTitlebar [data-action="close"]');
    if (oClose) { oClose.addEventListener("click", function () { try { CURRWIN.close(); } catch (e) { } }); }

    // 푸터 Save.
    var oSave = document.getElementById("editorSaveBtn");
    if (oSave) {
        var oSpan = oSave.querySelector("span");
        if (oSpan) { oSpan.textContent = _msg("/U4A/CL_WS_COMMON", "A64"); }   // Save
        oSave.title = _msg("/U4A/CL_WS_COMMON", "A64") + " (Ctrl+S)";
        oSave.hidden = true;          // 편집모드 확인 전까지 숨김.
        oSave.addEventListener("click", function () { _save(); });
    }
}

// ── 세션 유지(원본 fnKeepClientSession) ─────────────────────────────────
function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

// ── 자식창 busy 동기화 채널 ──────────────────────────────────────────────
var oBroad = null;
function _initBroadcast() {
    try {
        oBroad = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
        oBroad.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (sPrc === "BUSY_ON") { _setBusy(true, { ISBROAD: true }); }
            else if (sPrc === "BUSY_OFF") { _setBusy(false, { ISBROAD: true }); }
        };
    } catch (e) { }
}

// ── 부트 ────────────────────────────────────────────────────────────────
window.addEventListener("load", function () {

    oFrame = document.getElementById("editorHost");

    try { CURRWIN.setMenu(null); } catch (e) { }

    _initChrome();
    _initBroadcast();

    // 호스트 메시지 + 에디터 정보 IPC 구독.
    window.addEventListener("message", _onHostMessage);
    IPCRENDERER.on("if-editor-info", _onEditorInfo);

    // 라이브 테마 변경 구독(SYSID 별).
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    // 세션 유지(클릭/키 입력마다 세션 타임 갱신).
    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 창 표시 + 페이드인.
    try { CURRWIN.show(); } catch (e) { }
    try { WSUTIL.setBrowserOpacity(CURRWIN); } catch (e) { }

    // ★ busy 는 여기서 끄지 않는다 ★ — 오프너가 켠 WS20 busy 를 에디터가 완전히 로드될 때까지 유지.
    //   (구버전은 load 시점에 SETBUSYLOCK 해제 → if-editor-info 에서 재점등 = ON→OFF→ON 깜빡임이었음.)
    //   해제는 host ready(_onHostMessage) 또는 오류 워치독(_onEditorInfo)에서 _finishOpen 으로 1회만.
});

// busy 중에는 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제(누수 방지).
//   렌더러 생존 시점이라 remote 'closed'(파괴 후 호출) 위험 없이 안전하게 해제한다.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("message", _onHostMessage);
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { IPCRENDERER.removeListener("if-editor-info", _onEditorInfo); } catch (e) { }
};
