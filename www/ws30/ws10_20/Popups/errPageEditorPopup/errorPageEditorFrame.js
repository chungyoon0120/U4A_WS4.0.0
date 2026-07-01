/****************************************************************************
 * 오류 페이지 에디터 창 로직 (errorPageEditorFrame.js)
 * --------------------------------------------------------------------------
 *  원본: errorPageEditorFrame.js(로더) + errorPageEditor.js(UI5 SplitApp + ACE) 2단 iframe.
 *  HTML5: 드래그 가능한 공통 .u4a-titlebar 는 최상위 문서에 있어야 하므로, 에디터 시리즈
 *  (editorFrame.js)와 동일하게 **최상위 창**에 [공통 타이틀바 + 툴바 + Monaco 호스트 + 푸터]를
 *  두고, 내부 iframe 은 **공통 Monaco 호스트(editorPopup/host)만** 임베드한다(2단 → 1단).
 *
 *  ★ 원본 보존(1:1):
 *   · 데이터 = S_ERHTML { HTML, IS_USE } (EDITDATA), APPINFO.IS_EDIT 로 편집/표시.
 *   · Master = [Preview(아바타 media-play, A67) + How-to-Use 패널(D33, 안내문 원본 하드코딩)].
 *     Detail customHeader = [⬅ Read me(278)] … [Pretty Print(C25)] [Enable Error Page(D35)] [Save(A64)].
 *   · Save → IPC if-ErrorPageEditor-Save { BROWSKEY, SAVEDATA:{HTML,IS_USE} } + 저장토스트(002).
 *   · Preview → IPC if-ErrorPage-Preview(현재 에디터 값) → 미리보기 창. busy 는 미리보기 로드 시
 *     opener 가 보내는 if-errorPageEditor-setBusy-${BROWSKEY} 로 해제(원본 동일).
 *   · Pretty/Enable/Save 는 편집모드에서만 활성(원본 enabled=/APPINFO/IS_EDIT).
 *  ★ UI5 의존부 치환: SplitApp→DOM(드로어), sap.ui.codeeditor(ACE)→공통 Monaco 호스트,
 *     CheckBox→.u4a-check, Panel→U4AUI.createPanel, sap.applyTheme→U4ATheme.apply(라이브 추종).
 *
 *  ※ var 선언이어야 호스트 iframe 에서 parent.PATH/APPPATH 접근 가능(editorFrame 과 동일).
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
    BGCOL = oQueryParams.BGCOL,          // 현재 테마 배경(라이브 테마 변경 시 갱신) — Monaco 다크/라이트 판정용.
    SYSID = USERINFO.SYSID,
    LANGU = USERINFO.LANGU,
    WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

var zconsole = WSERR(window, document, console);

// 공통 Monaco 호스트(editorPopup/host) 채널 태그=__u4aedh, HOSTID 는 화면별 식별자.
var C_HOSTID = "U4AERP";

// 현재 상태(원본 모델 /EDITDATA, /APPINFO 대응).
var oState = { EDITDATA: null, APPINFO: null, ready: false };
var oFrame = null, bBusy = false, oToastTimer = null, iBusyWatch = null, iPrevWatch = null, bOpenDone = false;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────
function _msg(sCls, sCode, p1) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
}

// "Read me" = ZMSG_WS_COMMON_001/278(원본 getWsMsgClsTxt). CL_WS_COMMON D34 폴백.
function _readmeText() {
    try {
        var s = WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "278");
        if (s) { return s; }
    } catch (e) { }
    return _msg("/U4A/CL_WS_COMMON", "D34");
}

function _isEdit() {
    return !!(oState.APPINFO && oState.APPINFO.IS_EDIT === "X");
}

// 테마 배경색(BGCOL) 휘도 → Monaco 빌트인 테마(어두우면 vs-dark, 밝으면 vs). editorFrame 동일 판정.
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
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
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

// 현재 화면(에디터 + 체크박스) 기준 저장/미리보기 데이터. 에디터 값은 라이브로 읽는다(원본 양방향 바인딩 대응).
function _curSaveData() {
    var sHtml = _readHost();
    if (sHtml === null) { sHtml = (oState.EDITDATA && typeof oState.EDITDATA.HTML === "string") ? oState.EDITDATA.HTML : ""; }
    var oChk = document.getElementById("errEnableChk");
    var sUse = (oChk && oChk.checked) ? "X" : "";
    return { HTML: sHtml, IS_USE: sUse };
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트). editorFrame 동일.
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("errBusy");
    if (oEl) { oEl.classList.toggle("show", bBusy); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    //   (idle 시 closable=true 주면 Alt+F4 가 먹는 버그. 공통 표준 browser-window-common-ux)
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 오픈 busy 는 "한 번 켜서 끝까지 유지 → 완전 로드(또는 오류) 시 1회만 해제"(editorFrame 와 동일 정책).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    _fadeInContent();
}

// 컨텐츠 페이드인(네이티브 창 opacity 미사용 — DOM CSS opacity transition).
function _fadeInContent() {
    var oEl = document.getElementById("errContent");
    if (oEl) { oEl.classList.add("u4aErrShown"); }
}

// 저장 토스트 — ★공통 .u4a-toast★(shell.css 단일 출처: 화면 정중앙 = 전 화면 공통 UX).
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aErrToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aErrToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

// 푸터 줌 표시/원복 버튼 갱신 — "NNN%" 상시 표시(에디터 시리즈와 동일).
function _setZoom(pct) {
    var oBtn = document.getElementById("errZoomBtn");
    if (!oBtn) { return; }
    var n = (typeof pct === "number" && isFinite(pct)) ? pct : 100;
    var oSpan = oBtn.querySelector("span");
    if (oSpan) { oSpan.textContent = n + "%"; }
    oBtn.title = n + "% (Ctrl+0)";
}

// 편집/표시 모드에 따른 컨트롤 활성화(원본 enabled=/APPINFO/IS_EDIT) + 체크박스 상태 반영.
function _applyControls() {
    var bEdit = _isEdit();
    var oPretty = document.getElementById("errPrettyBtn");
    var oSave = document.getElementById("errSaveBtn");
    var oSaveFoot = document.getElementById("errSaveBtnFoot");
    var oChk = document.getElementById("errEnableChk");
    if (oPretty) { oPretty.disabled = !bEdit; }
    if (oSave) { oSave.disabled = !bEdit; }
    if (oSaveFoot) { oSaveFoot.disabled = !bEdit; }
    if (oChk) {
        oChk.disabled = !bEdit;
        oChk.checked = !!(oState.EDITDATA && oState.EDITDATA.IS_USE === "X");
    }
}

// ── 현재 상태를 호스트에 반영 ───────────────────────────────────────────
function _applyToHost() {
    var info = oState.EDITDATA || {};
    var bEdit = _isEdit();
    _toHost({ cmd: "setLanguage", language: "html" });   // 오류 페이지 = 항상 HTML.
    _toHost({ cmd: "setReadOnly", readOnly: !bEdit });
    _toHost({ cmd: "setValue", value: (typeof info.HTML === "string") ? info.HTML : "" });
    _applyControls();
    if (bEdit) { _toHost({ cmd: "focus" }); }
}

// 호스트 최초 1회 로드(공통 Monaco 호스트 editorPopup/host 재사용).
function _loadHost() {
    if (!oFrame || oFrame.getAttribute("src")) { return; }
    var oPARAMS = {
        HOSTID: C_HOSTID,
        LANG: "html",
        THEME: _monacoThemeFromBg(BGCOL),
        READONLY: !_isEdit()
    };
    oFrame.src = "../editorPopup/host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oPARAMS));
}

// ── 저장(원본 ev_setErrorPageSave + fnIpcMain_ErrorPageEditorSave 흐름) ────
function _save() {
    if (!_isEdit()) { return; }                 // 표시모드 저장 불가.
    var d = _curSaveData();
    if (d.HTML === null) { return; }            // 에디터 미준비.

    IPCRENDERER.send("if-ErrorPageEditor-Save", {
        BROWSKEY: BROWSKEY,
        SAVEDATA: d
    });

    // 로컬 상태도 동기화(이후 미리보기/재저장 기준).
    oState.EDITDATA = oState.EDITDATA || {};
    oState.EDITDATA.HTML = d.HTML;
    oState.EDITDATA.IS_USE = d.IS_USE;

    _toast(_msg("/U4A/MSG_WS", "002"));          // Saved success.
}

// ── 미리보기(원본 ev_errorPageEditorMasterAvatarPress) ────────────────────
//   현재 에디터 값으로 미리보기 창을 띄운다. busy 는 미리보기 로드 시 opener 가 IPC 로 해제.
function _preview() {
    if (!oState.ready) { return; }
    var d = _curSaveData();
    if (d.HTML === null) { return; }
    _setBusy(true);
    try { clearTimeout(iPrevWatch); } catch (e) { }
    iPrevWatch = setTimeout(function () {
        console.error("[HTML5][errPageEditor] 미리보기 로드 지연/실패 — busy 강제 해제");
        _setBusy(false);
    }, 15000);
    try { IPCRENDERER.send("if-ErrorPage-Preview", { BROWSKEY: BROWSKEY, SAVEDATA: d }); }
    catch (e) { try { clearTimeout(iPrevWatch); } catch (e2) { } _setBusy(false); }
}

// 미리보기 로드 완료 → opener 가 busy 해제 신호(원본 if-errorPageEditor-setBusy).
function _onPrevBusy(event, res) {
    if (res === "X") { _setBusy(true); return; }
    try { clearTimeout(iPrevWatch); } catch (e) { }
    _setBusy(false);
}

// ── 라이브 테마 변경(워크스페이스 테마 추종 — 개인화 없음, editorFrame 와 동일 정책. 근거 .analy/12 §5.3) ──
function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
        }
    } catch (e) { }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    if (oTheme.BGCOL) { BGCOL = oTheme.BGCOL; }
    _toHost({ cmd: "setTheme", theme: _monacoThemeFromBg(oTheme.BGCOL) });
}

// ── 호스트 → 창 메시지(ready / save / zoom) ──────────────────────────────
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
    if (d.evt === "zoom") { _setZoom(d.pct); return; }
}

// ── 메인 → 창: 에디터 정보 수신(원본 if-editor-info) ─────────────────────
function _onEditorInfo(event, res) {
    oState.EDITDATA = res && res.EDITDATA;
    oState.APPINFO = res && res.APPINFO;

    if (oFrame && !oFrame.getAttribute("src")) {
        // 최초 로드 — busy 는 오프너가 켠 상태 그대로 유지(여기서 끄지 않음). 완전 로드/오류 시 _finishOpen.
        _setBusy(true);
        try { clearTimeout(iBusyWatch); } catch (e) { }
        iBusyWatch = setTimeout(function () {
            console.error("[HTML5][errPageEditor] 호스트 로드 지연/실패 — busy 강제 해제");
            _finishOpen();
        }, 15000);
        _loadHost();
    } else if (oState.ready) {
        // 재수신(방어) — 즉시 반영.
        _setBusy(true);
        _applyToHost();
        _setBusy(false);
    }
}

// 타이틀바 제목(opener 가 넘긴 창 제목 = "Editor - Customizing the Error Page").
function _setTitle() {
    var oTitle = document.getElementById("errTitle");
    if (!oTitle) { return; }
    var s = "";
    try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
    oTitle.textContent = s;
}

// ── Master 네비(드로어) 구성 — Preview + How-to-Use(원본 안내문 하드코딩 1:1) ──────────
function _buildNav() {
    var oNav = document.getElementById("errNav");
    if (!oNav) { return; }
    oNav.innerHTML = "";

    // Preview — 원본 Avatar(media-play) + Title(A67). 클릭 = 미리보기 창.
    var oPrev = document.createElement("button");
    oPrev.type = "button";
    oPrev.className = "u4a-btn u4aErrPreview";
    oPrev.innerHTML = '<i class="fa-solid fa-circle-play"></i><span></span>';
    oPrev.querySelector("span").textContent = _msg("/U4A/CL_WS_COMMON", "A67");   // Preview
    oPrev.addEventListener("click", function () { _preview(); });
    oNav.appendChild(oPrev);

    // How-to-Use 패널(D33) — 안내문은 원본(errorPageEditor.js)에 하드코딩된 문구를 그대로 보존.
    //   (메시지 클래스 키가 없는 원본 고정 텍스트 — 임의 생성이 아니라 1:1 이관.)
    var oPanel = U4AUI.createPanel({ title: "[ " + _msg("/U4A/CL_WS_COMMON", "D33") + " ]" });   // How to Use
    var aGuide = [
        "1. APP 실행 중 발생되는 오류(시스템 오류 포함)페이지 재구성 필요시 우측 HTML 에디터를 사용한다.",
        "2. 만약 오류 본문 내 시스템 메시지를 출력 필요시 해당 위치에 매개변수 \"<%=MSG=%>\"를 입력한다.",
        "3. 만약 에디터 HTML 코딩에 대한 미리보기를 원할 시 \"Preview\" 아이콘을 클릭한다.",
        "4. 완성된 HTML 코딩을 시스템에 적용 시 \"Enable Error Page\" 체크박스 체크 후 \"SAVE\" 버튼을 클릭한다.",
        "",
        "1. If you need to reorganize the page errors (including system errors) that occur while running the APP, use the HTML editor on the right.",
        "2. If you need to output the system message in the error body, enter the parameter \"<%=MSG=%>\" in the corresponding location",
        "3. If you want to preview the HTML coding, click the \"Preview\" icon.",
        "4. When applying the completed HTML coding to the system, check the \"Enable Error Page\" checkbox and click the \"SAVE\" button."
    ];
    for (var i = 0; i < aGuide.length; i++) {
        var oP = document.createElement("p");
        oP.className = "u4aErrGuide";
        oP.textContent = aGuide[i];
        oPanel.body.appendChild(oP);
    }
    oNav.appendChild(oPanel.el);
}

// 네비 드로어 토글(원본 SplitApp Navigation 버튼).
function _toggleNav(bForce) {
    var oNav = document.getElementById("errNav");
    var oBtn = document.getElementById("errNavToggle");
    if (!oNav) { return; }
    var bOpen = (typeof bForce === "boolean") ? bForce : (oNav.getAttribute("data-open") !== "true");
    oNav.setAttribute("data-open", bOpen ? "true" : "false");
    if (oBtn) { oBtn.setAttribute("aria-pressed", bOpen ? "true" : "false"); }
    // 에디터 레이아웃 재계산(드로어가 콘텐츠 폭을 바꾸므로).
    _toHost({ cmd: "layout" });
}

// ── 타이틀바/툴바/푸터 초기화 ───────────────────────────────────────────
function _initChrome() {
    // 로고(메인 창과 동일 APPPATH/img/logo.png).
    var oLogo = document.getElementById("errLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }
    _setTitle();

    // 닫기(타이틀바 X) — busy 중 차단 + 공통 closeWindow(창이 closable:false 라 직접 close() 불가).
    var oClose = document.querySelector('#errTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

    // 툴바 라벨 — Read me / Pretty Print / Enable Error Page / Save.
    var oReadme = document.getElementById("errReadme");
    if (oReadme) { oReadme.textContent = _readmeText(); }

    var oPretty = document.getElementById("errPrettyBtn");
    if (oPretty) {
        var oPS = oPretty.querySelector("span");
        if (oPS) { oPS.textContent = _msg("/U4A/CL_WS_COMMON", "C25"); }   // Pretty Print
        oPretty.title = _msg("/U4A/CL_WS_COMMON", "C25") + " (Shift+F1)";
        oPretty.disabled = true;   // 편집모드 확인 전까지 비활성.
        oPretty.addEventListener("click", function () { _toHost({ cmd: "format" }); });
    }

    var oEnableTxt = document.getElementById("errEnableTxt");
    if (oEnableTxt) { oEnableTxt.textContent = _msg("/U4A/CL_WS_COMMON", "D35"); }   // Enable Error Page
    var oChk = document.getElementById("errEnableChk");
    if (oChk) { oChk.disabled = true; }

    // 상단 툴바 Save + 하단 푸터 Save(사용자 편의) — 동일 라벨/동작/활성조건.
    var sSave = _msg("/U4A/CL_WS_COMMON", "A64");   // Save
    [document.getElementById("errSaveBtn"), document.getElementById("errSaveBtnFoot")].forEach(function (oSave) {
        if (!oSave) { return; }
        var oSS = oSave.querySelector("span");
        if (oSS) { oSS.textContent = sSave; }
        oSave.title = sSave + " (Ctrl+S)";
        oSave.disabled = true;          // 편집모드 확인 전까지 비활성.
        oSave.addEventListener("click", function () { _save(); });
    });

    // 네비 토글.
    var oNavToggle = document.getElementById("errNavToggle");
    if (oNavToggle) { oNavToggle.addEventListener("click", function () { _toggleNav(); }); }

    // 푸터 줌 컨트롤 [−][%][+].
    var oZoom = document.getElementById("errZoomBtn");
    if (oZoom) { oZoom.addEventListener("click", function () { _toHost({ cmd: "fontZoomReset" }); }); }
    var oZoomOut = document.getElementById("errZoomOut");
    if (oZoomOut) { oZoomOut.addEventListener("click", function () { _toHost({ cmd: "fontZoomOut" }); }); }
    var oZoomIn = document.getElementById("errZoomIn");
    if (oZoomIn) { oZoomIn.addEventListener("click", function () { _toHost({ cmd: "fontZoomIn" }); }); }

    // Master 네비 내용 구성(Preview + How-to-Use).
    _buildNav();
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

    oFrame = document.getElementById("errHost");

    try { CURRWIN.setMenu(null); } catch (e) { }

    _initChrome();
    _initBroadcast();

    // 호스트 메시지 + 에디터 정보 + 미리보기 busy 해제 IPC 구독.
    window.addEventListener("message", _onHostMessage);
    IPCRENDERER.on("if-editor-info", _onEditorInfo);
    IPCMAIN.on("if-errorPageEditor-setBusy-" + BROWSKEY, _onPrevBusy);

    // 라이브 테마 변경 구독(SYSID 별).
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    // 세션 유지(클릭/키 입력마다 세션 타임 갱신).
    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 창은 즉시 불투명 표시(네이티브 opacity 페이드 미사용). 등장 효과는 #errContent CSS opacity(_fadeInContent).
    try { CURRWIN.show(); } catch (e) { }

    // ★ busy 는 여기서 끄지 않는다 ★ — 오프너가 켠 WS20 busy 를 에디터 완전 로드까지 유지.
    //   해제는 host ready(_onHostMessage) 또는 오류 워치독(_onEditorInfo)에서 _finishOpen 으로 1회만.
});

// busy 중에는 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제(누수 방지).
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("message", _onHostMessage);
    try { IPCRENDERER.removeListener("if-editor-info", _onEditorInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-errorPageEditor-setBusy-" + BROWSKEY, _onPrevBusy); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
