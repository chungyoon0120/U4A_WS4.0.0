/****************************************************************************
 * 현재 앱 기술 문서(Current App Technical Document) 에디터 창 로직 (frame.js)
 * --------------------------------------------------------------------------
 *  원본: frame.html(로더 iframe) + doc.html/doc.js(UI5 SplitApp + TinyMCE RichTextEditor)
 *        2단 iframe 구조.
 *  HTML5: 드래그 가능한 공통 .u4a-titlebar 는 최상위 문서에 있어야 하므로, 최상위 창에
 *  [공통 타이틀바 + 본체 + 푸터]를 두고 본문 편집기는 **Jodit(MIT) WYSIWYG** 으로 교체.
 *  (Monaco=소스편집이라 문서 WYSIWYG 성격에 안 맞아 사용자 결정으로 Jodit 채택. www/lib/jodit 벤더링.)
 *
 *  ★ 원본 보존(1:1, doc.js 기준):
 *   · 데이터 = T_DOCLIST [{ DOCKY, TITLE, LDATA, AEUSR, AEDAT, AETIM }] (문서 본문 LDATA = HTML).
 *   · 서버 직접 XHR : POST {SERVPATH}/u4a_app_doc  (ACTCD=GET / SAVE, APPID, DATA=JSON).
 *     - GET  : RETCD S → T_DATA 로 목록, E → (편집모드면) 빈 문서 1건 생성.
 *     - SAVE : RETCD S/E → 응답 RTMSG 토스트. JSON 파싱 실패 = 치명(잘못된 경로) 처리.
 *   · 좌측 = 문서 목록(드로어), 우측 = 툴바(생성/삭제/저장 + 변경이력) + 제목 입력 + WYSIWYG.
 *   · 생성/삭제/저장/변경추적/Ctrl+휠 줌 동작 보존.
 *  ★ UI5 의존부 치환: SplitApp→DOM(드로어+디테일), RichTextEditor(TinyMCE)→Jodit WYSIWYG,
 *     sap.m.Input→U4AUI.createField, MessageBox→U4AUI.confirm, MessageToast→공통 .u4a-toast.
 *
 *  ※ Jodit 테마 = `.jodit_theme_u4a`(frame.css 에서 --jd-* → 공통 토큰 매핑) → data-theme 캐스케이드로
 *     테마 5종/라이트·다크가 CSS 변수만으로 자동 추종(JS 재init 불필요).
 *  ※ 원본 `${SERVPATH}\u4a_app_doc`(백슬래시 오타) → 형제 엔드포인트와 동일하게 슬래시 정합수정.
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

// Jodit(MIT, es2018) — nodeIntegration 의 webpack UMD 는 module.exports 로 등록되므로 require 가 결정적.
//   (CSS 는 frame.html head 의 <link>. document 가 준비된 시점=body 끝 스크립트라 require 시 DOM 안전.)
var Jodit = null;
try { Jodit = require(PATH.join(APPPATH, "lib", "jodit", "jodit.min.js")).Jodit; }
catch (e) { console.error("[HTML5][docPopup] Jodit 로드 실패:", e && e.message); }

// 현재 상태(원본 oPrc / oModel 대응).
var oState = {
    list: [],            // T_DOCLIST
    curKey: null,        // 선택 DOCKY(원본 oPrc.DOCKY)
    isEdit: true,        // 편집 모드(원본 oPrc.isEdit = true 고정)
    isChang: false,      // 변경 표시(원본 oPrc.isChang)
    editorReady: false,  // Jodit 준비 완료
    gotInfo: false,      // opener if-appdocu-info 수신
    loadStarted: false,  // 서버 GET 시작
    silent: false,       // 프로그램적 setValue 중(변경 이벤트 무시)
    zoom: 100,
    APPID: "",
    URL: "",
    USRNM: ""
};

var oJodit = null, oTitleField = null, bBusy = false, oToastTimer = null,
    iBusyWatch = null, bOpenDone = false, oBroad = null;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────
function _msg(sCls, sCode, p1) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
}

// SYSID 별 테마 정보 JSON 읽기(라이브 테마용).
function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// ── Jodit 래퍼(에디터 종류 의존 최소화) ─────────────────────────────────
function _getEditorValue() {
    try { return oJodit ? oJodit.value : null; } catch (e) { return null; }
}
function _setEditorValue(sHtml) {
    if (!oJodit) { return; }
    // 프로그램적 주입 = 변경표시 금지(원본 양방향 바인딩과 구분). Jodit change 는 defaultTimeout(100ms) 디바운스.
    oState.silent = true;
    try { oJodit.value = (typeof sHtml === "string") ? sHtml : ""; } catch (e) { }
    setTimeout(function () { oState.silent = false; }, 200);
}
function _setEditorReadOnly(bRead) {
    try { if (oJodit) { oJodit.setReadOnly(!!bRead); } } catch (e) { }
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트).
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("docBusy");
    if (oEl) { oEl.classList.toggle("show", bBusy); }
    try { CURRWIN.closable = !bBusy; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 오픈 busy 는 "한 번 켜서 끝까지 유지 → 완전 로드(또는 오류) 시 1회만 해제".
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    _fadeInContent();
}

function _fadeInContent() {
    var oEl = document.getElementById("docContent");
    if (oEl) { oEl.classList.add("u4aDocShown"); }
}

// 토스트 — ★공통 .u4a-toast★(shell.css 단일 출처: 화면 정중앙).
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aDocToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aDocToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

// ── 줌(원본 fn_setZoomEvt — Ctrl+휠로 본문 확대/축소) ─────────────────────
function _applyZoom() {
    var n = oState.zoom;
    try { if (oJodit && oJodit.editor) { oJodit.editor.style.zoom = (n / 100); } } catch (e) { }
    var oBtn = document.getElementById("docZoomBtn");
    if (oBtn) {
        var oSpan = oBtn.querySelector("span");
        if (oSpan) { oSpan.textContent = n + "%"; }
        oBtn.title = n + "%";
    }
}
function _zoomStep(iDelta) {
    var n = oState.zoom + iDelta;
    if (n < 50) { n = 50; }
    if (n > 200) { n = 200; }
    oState.zoom = n;
    _applyZoom();
}

// ── 저장 키/일시 헬퍼(원본 fn_makeDOCKY / fn_getDateTime / convEXIT) ─────────
function _makeDocky() {
    var sOut = "", sPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 60; i++) { sOut += sPool.charAt(Math.floor(Math.random() * sPool.length)); }
    return sOut;
}
function _now() {
    var o = new Date();
    var y = o.getFullYear(),
        m = String(o.getMonth() + 1).padStart(2, "0"),
        d = String(o.getDate()).padStart(2, "0"),
        hh = String(o.getHours()).padStart(2, "0"),
        mm = String(o.getMinutes()).padStart(2, "0"),
        ss = String(o.getSeconds()).padStart(2, "0");
    return { DATE: "" + y + m + d, TIME: "" + hh + mm + ss };
}
function _convDate(s) { return String(s || "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"); }
function _convTime(s) { return String(s || "").replace(/(\d{2})(\d{2})(\d{2})/, "$1:$2:$3"); }

function _stampText(oLine) {
    if (!oLine || !oLine.AEDAT) { return ""; }
    return _convDate(oLine.AEDAT) + " / " + _convTime(oLine.AETIM) + " / " + (oLine.AEUSR || "");
}
function _setStampOut(oLine) {
    var oEl = document.getElementById("docStamp");
    if (oEl) { oEl.textContent = _stampText(oLine); }
}
function _findLine(sKey) {
    for (var i = 0; i < oState.list.length; i++) { if (oState.list[i].DOCKY === sKey) { return oState.list[i]; } }
    return null;
}

// ── 문서 목록 렌더(원본 NavigationList 바인딩) ───────────────────────────
function _renderList() {
    var oList = document.getElementById("docList");
    if (!oList) { return; }
    oList.innerHTML = "";

    if (oState.list.length === 0) {
        var oEmpty = document.createElement("div");
        oEmpty.className = "u4aDocListEmpty";
        oEmpty.textContent = _msg("/U4A/MSG_WS", "073", _msg("/U4A/CL_WS_COMMON", "B65")); // &1 does not exist.(Document)
        oList.appendChild(oEmpty);
        return;
    }

    oState.list.forEach(function (oLine) {
        var oItem = document.createElement("button");
        oItem.type = "button";
        oItem.className = "u4aDocItem";
        oItem.setAttribute("data-key", oLine.DOCKY);
        if (oLine.DOCKY === oState.curKey) { oItem.setAttribute("aria-selected", "true"); }

        var oIco = document.createElement("span");
        oIco.className = "u4aDocItem__icon";
        oIco.innerHTML = '<i class="fa-solid fa-' + (oLine._new ? "file-pen" : "file-lines") + '"></i>';
        oItem.appendChild(oIco);

        var oTxt = document.createElement("span");
        oTxt.className = "u4aDocItem__text";
        var sTitle = oLine.TITLE || "";
        if (sTitle) { oTxt.textContent = sTitle; }
        else { oTxt.textContent = "—"; oTxt.classList.add("is-empty"); }
        oItem.appendChild(oTxt);

        oItem.addEventListener("click", function () { _selectDoc(oLine.DOCKY); });
        oList.appendChild(oItem);
    });
}

// 현재 선택 라인에 에디터/제목 값을 커밋(원본 fn_UpdateDOCLineData).
function _commitCurrent() {
    if (oState.curKey == null) { return; }
    var oLine = _findLine(oState.curKey);
    if (!oLine) { return; }

    if (oTitleField) { oLine.TITLE = oTitleField.getValue(); }
    var sVal = _getEditorValue();
    if (sVal !== null) { oLine.LDATA = sVal; }

    if (oState.isChang) {
        oState.isChang = false;
        var oStmp = _now();
        oLine.AEDAT = oStmp.DATE;
        oLine.AETIM = oStmp.TIME;
        oLine.AEUSR = oState.USRNM;
        _setStampOut(oLine);
    }
}

// 에디터 활성 상태 반영(원본 scrEditble) — 선택 문서가 있고 편집모드일 때만.
function _applyEditorState() {
    var bEditable = oState.isEdit && oState.curKey != null;
    _setEditorReadOnly(!bEditable);
    if (oTitleField) { oTitleField.setReadOnly(!bEditable); }
}

// 문서 선택 → 디테일에 반영(원본 fn_setDOCLineData).
function _selectDoc(sKey) {
    _commitCurrent();   // 이전 선택 커밋

    var oLine = (sKey == null) ? null : _findLine(sKey);

    if (!oLine) {
        oState.curKey = null;
        if (oTitleField) { oTitleField.setValue(""); }
        _setEditorValue("");
        _setStampOut(null);
        _applyEditorState();
        _renderList();
        return;
    }

    oState.curKey = oLine.DOCKY;
    oState.isChang = false;

    if (oTitleField) { oTitleField.setValue(oLine.TITLE || ""); }
    _setEditorValue((typeof oLine.LDATA === "string") ? oLine.LDATA : "");
    _setStampOut(oLine);
    _applyEditorState();
    _renderList();
}

// ── 생성(원본 oBTcrt) ────────────────────────────────────────────────────
function _create() {
    if (!oState.isEdit) { return; }
    _commitCurrent();

    var oLine = { DOCKY: _makeDocky(), TITLE: "", LDATA: "", AEUSR: "", AEDAT: "", AETIM: "", _new: true };
    oState.list.push(oLine);
    _selectDoc(oLine.DOCKY);

    setTimeout(function () { if (oTitleField) { oTitleField.focus(); } }, 150);

    _toast(_msg("/U4A/MSG_WS", "325")); // document has been created
}

// ── 삭제(원본 oBTdel) ────────────────────────────────────────────────────
function _delete() {
    if (!oState.isEdit) { return; }

    if (oState.list.length === 0) {
        _toggleNav(true);
        _toast(_msg("/U4A/MSG_WS", "326")); // Select the delete line
        return;
    }

    U4AUI.confirm({
        type: "C",
        title: _msg("/U4A/CL_WS_COMMON", "B65"), // Document
        message: _msg("/U4A/MSG_WS", "003"),     // Do you really want to delete the object?
        buttons: [
            { act: "YES", label: _msg("/U4A/CL_WS_COMMON", "A03"), negative: true }, // Delete
            { act: "NO", label: _msg("/U4A/CL_WS_COMMON", "A39") }                    // Close
        ],
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            oState.isChang = false;
            _delLine(oState.curKey);
            _toast(_msg("/U4A/MSG_WS", "327")); // Deletion processing complete
        }
    });
}

function _delLine(sKey) {
    var iIdx = -1;
    for (var i = 0; i < oState.list.length; i++) { if (oState.list[i].DOCKY === sKey) { iIdx = i; break; } }
    if (iIdx === -1) { return; }

    oState.list.splice(iIdx, 1);

    if (oState.list.length === 0) {
        oState.curKey = null;
        _selectDoc(null);
        return;
    }

    var iNext = iIdx - 1;
    if (iNext < 0) { iNext = 0; }
    oState.curKey = null;                 // 강제 재선택(커밋 스킵)
    _selectDoc(oState.list[iNext].DOCKY);
}

// ── 저장(원본 oBTsave → fn_Save) ─────────────────────────────────────────
function _save() {
    if (!oState.isEdit) { return; }
    _commitCurrent();

    if (oState.list.length === 0) {
        _toggleNav(true);
        _toast(_msg("/U4A/MSG_WS", "328")); // Saved data does not exist
        return;
    }

    U4AUI.confirm({
        type: "C",
        title: _msg("/U4A/CL_WS_COMMON", "B65"), // Document
        message: _msg("/U4A/MSG_WS", "010"),     // Do you want to save it?
        buttons: [
            { act: "YES", label: _msg("/U4A/CL_WS_COMMON", "A64"), emphasized: true }, // Save
            { act: "NO", label: _msg("/U4A/CL_WS_COMMON", "A39") }                      // Close
        ],
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            _xhrSave();
        }
    });
}

// ── 치명 오류(원본 fn_setMsgMove / MessagePage) — 화면 대체 ──────────────────
function _fatal(sText) {
    var oDetail = document.getElementById("docDetail");
    if (!oDetail) { return; }
    var oOv = document.createElement("div");
    oOv.className = "u4aDocFatal";
    var sTitle = _msg("/U4A/CL_WS_COMMON", "B93") + " " + _msg("/U4A/CL_WS_COMMON", "B86"); // Error Information
    oOv.innerHTML =
        '<i class="fa-solid fa-circle-exclamation"></i>' +
        '<div class="u4aDocFatal__title"></div>' +
        '<div class="u4aDocFatal__desc"></div>' +
        '<div class="u4aDocFatal__text"></div>';
    oOv.querySelector(".u4aDocFatal__title").textContent = sTitle;
    oOv.querySelector(".u4aDocFatal__desc").textContent = _msg("/U4A/MSG_WS", "192"); // Fatal Error! contact admin.
    oOv.querySelector(".u4aDocFatal__text").textContent = sText || "";
    oDetail.appendChild(oOv);
}

// ── 서버 직접 XHR (원본 fn_getSaveData / fn_Save) ─────────────────────────
function _xhrGet() {
    _setBusy(true);

    var xhr = new XMLHttpRequest();
    var oForm = new FormData();
    oForm.append("APPID", oState.APPID);
    oForm.append("ACTCD", "GET");

    var sWrong = _msg("/U4A/MSG_WS", "324"); // The wrong approach

    xhr.open("POST", oState.URL);
    xhr.onload = function () {
        _setBusy(false);

        var oData = null;
        try { oData = JSON.parse(this.response); }
        catch (e) { _finishOpen(); _fatal(sWrong); return; }

        switch (oData.RETCD) {
            case "S":
                oState.list = Array.isArray(oData.T_DATA) ? oData.T_DATA : [];
                break;
            case "E":
                oState.list = [];
                if (oState.isEdit) {
                    oState.list.push({ DOCKY: _makeDocky(), TITLE: "", LDATA: "", AEUSR: "", AEDAT: "", AETIM: "", _new: true });
                }
                break;
            default:
                _finishOpen(); _fatal(sWrong); return;
        }

        _renderList();
        if (oState.list.length !== 0) {
            oState.curKey = null;
            _selectDoc(oState.list[0].DOCKY);
        } else {
            _selectDoc(null);
        }

        _finishOpen();
    };
    xhr.onerror = function () {
        _setBusy(false);
        _finishOpen();
        _fatal(sWrong);
    };
    xhr.send(oForm);
}

function _xhrSave() {
    _setBusy(true);

    var aPayload = oState.list.map(function (o) {
        return { DOCKY: o.DOCKY, TITLE: o.TITLE || "", LDATA: o.LDATA || "", AEUSR: o.AEUSR || "", AEDAT: o.AEDAT || "", AETIM: o.AETIM || "" };
    });

    var xhr = new XMLHttpRequest();
    var oForm = new FormData();
    oForm.append("APPID", oState.APPID);
    oForm.append("ACTCD", "SAVE");
    oForm.append("DATA", JSON.stringify(aPayload));

    var sWrong = _msg("/U4A/MSG_WS", "324");

    xhr.open("POST", oState.URL);
    xhr.onload = function () {
        _setBusy(false);

        var oData = null;
        try { oData = JSON.parse(this.response); }
        catch (e) { _fatal(sWrong); return; }

        switch (oData.RETCD) {
            case "S":
            case "E":
                _toast(oData.RTMSG);
                if (oData.RETCD === "S") {
                    oState.list.forEach(function (o) { delete o._new; });
                    _renderList();
                }
                break;
            default:
                _fatal(sWrong);
                return;
        }
    };
    xhr.onerror = function () {
        _setBusy(false);
        _fatal(sWrong);
    };
    xhr.send(oForm);
}

// ── Jodit 생성 ───────────────────────────────────────────────────────────
function _joditLang() {
    return (String(LANGU || "").toLowerCase().indexOf("ko") === 0) ? "ko" : "en";
}

function _initEditor() {
    if (!Jodit || typeof Jodit.make !== "function") {
        console.error("[HTML5][docPopup] Jodit 미로드 — require 경로/번들 확인 필요");
        _finishOpen();   // 에디터 없이도 창은 떠야 함(busy 영구방지)
        return;
    }
    oJodit = Jodit.make("#docEditor", {
        theme: "u4a",                 // .jodit_theme_u4a (frame.css 토큰 매핑)
        language: _joditLang(),
        readonly: true,               // 문서 선택 후 활성(_applyEditorState)
        height: "100%",
        width: "100%",
        toolbarAdaptive: true,
        toolbarSticky: false,
        statusbar: false,             // 원본에 상태바 없음 + 'Powered by' 제거
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        askBeforePasteHTML: false,
        askBeforePasteFromWord: false,
        buttons: ["bold", "italic", "underline", "strikethrough", "|",
            "ul", "ol", "|", "paragraph", "font", "fontsize", "brush", "|",
            "align", "|", "link", "image", "table", "|", "undo", "redo", "|", "source"],
        buttonsMD: ["bold", "italic", "underline", "|", "ul", "ol", "|", "paragraph", "|", "align", "|", "link", "table", "|", "undo", "redo", "|", "dots"],
        buttonsSM: ["bold", "italic", "|", "ul", "ol", "|", "link", "|", "undo", "redo", "|", "dots"],
        buttonsXS: ["bold", "|", "ul", "ol", "|", "dots"]
    });

    // 본문 변경 표시(원본 attachChange) — 프로그램적 setValue(silent)는 제외. Jodit 4 이벤트버스 = .e
    try {
        var oEv = oJodit.e || oJodit.events;
        if (oEv) {
            oEv.on("change", function () {
                if (oState.silent) { return; }
                oState.isChang = true;
            });
        }
    } catch (e) { }

    // Ctrl+휠 줌(원본 fn_setZoomEvt) — 본문 영역 한정.
    try {
        oJodit.editor.addEventListener("wheel", function (ev) {
            if (!ev.ctrlKey) { return; }
            ev.preventDefault();
            _zoomStep(ev.deltaY < 0 ? 10 : -10);
        }, { passive: false });
    } catch (e) { }

    // 준비 완료 → (정보도 왔으면) 서버 로드.
    var _onReady = function () { oState.editorReady = true; _maybeLoad(); };
    try {
        if (oJodit.waitForReady) { oJodit.waitForReady().then(_onReady); }
        else { _onReady(); }
    } catch (e) { _onReady(); }
}

// 에디터 준비 + 정보 수신 둘 다 되면 1회 서버 GET.
function _maybeLoad() {
    if (oState.loadStarted) { return; }
    if (!oState.editorReady || !oState.gotInfo) { return; }
    oState.loadStarted = true;
    _xhrGet();
}

// ── 메인(opener) → 창: 문서 정보 수신(원본 if-appdocu-info) ────────────────
function _onAppDocuInfo(event, oInfo) {
    try {
        var oAppInfo = oInfo && oInfo.APPINFO;
        var oUser = oInfo && oInfo.USERINFO;
        oState.APPID = (oAppInfo && oAppInfo.APPID) || "";
        oState.USRNM = (oUser && oUser.ID) || "";
        // 원본 `${sServerPath}\u4a_app_doc`(오타) → 형제 엔드포인트와 동일하게 슬래시.
        oState.URL = ((oInfo && oInfo.SERVPATH) || "") + "/u4a_app_doc";
    } catch (e) { }
    oState.gotInfo = true;
    _maybeLoad();
}

// ── 라이브 테마 변경 — Jodit 은 .jodit_theme_u4a(CSS 변수)라 data-theme 캐스케이드로 자동 추종.
//   여기선 워크스페이스 테마 적용 + 창 배경만 갱신(개인화 없음. editorFrame 동일 정책).
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
}

// 네비 드로어 토글(원본 SplitApp Navigation 버튼).
function _toggleNav(bForce) {
    var oNav = document.getElementById("docNav");
    var oBtn = document.getElementById("docNavToggle");
    if (!oNav) { return; }
    var bOpen = (typeof bForce === "boolean") ? bForce : (oNav.getAttribute("data-open") !== "true");
    oNav.setAttribute("data-open", bOpen ? "true" : "false");
    if (oBtn) { oBtn.setAttribute("aria-pressed", bOpen ? "true" : "false"); }
}

// ── 타이틀바/툴바/제목/푸터 초기화 ───────────────────────────────────────
function _initChrome() {
    var oLogo = document.getElementById("docLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    var oTitle = document.getElementById("docTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }

    var oClose = document.querySelector('#docTitlebar [data-action="close"]');
    if (oClose) { oClose.addEventListener("click", function () { try { CURRWIN.close(); } catch (e) { } }); }

    var oNavHead = document.getElementById("docNavHead");
    if (oNavHead) { oNavHead.textContent = _msg("/U4A/CL_WS_COMMON", "D14"); } // Document List

    var oNavToggle = document.getElementById("docNavToggle");
    if (oNavToggle) { oNavToggle.addEventListener("click", function () { _toggleNav(); }); }

    var oCreate = document.getElementById("docCreateBtn");
    if (oCreate) {
        oCreate.title = _msg("/U4A/CL_WS_COMMON", "A01"); // Create
        oCreate.addEventListener("click", function () { _create(); });
    }
    var oDelete = document.getElementById("docDeleteBtn");
    if (oDelete) {
        oDelete.title = _msg("/U4A/CL_WS_COMMON", "A03"); // Delete
        oDelete.addEventListener("click", function () { _delete(); });
    }
    var oSave = document.getElementById("docSaveBtn");
    if (oSave) {
        oSave.title = _msg("/U4A/CL_WS_COMMON", "A64"); // Save
        oSave.addEventListener("click", function () { _save(); });
    }

    // 제목 입력(원본 sap.m.Input — placeholder=Title(D16), value-state hint=Document Subject(D17)).
    var oTitleRow = document.getElementById("docTitleRow");
    if (oTitleRow && window.U4AUI) {
        oTitleField = U4AUI.createField({
            placeholder: _msg("/U4A/CL_WS_COMMON", "D16"),
            clear: true,
            maxLength: 255,
            readOnly: true,
            onInput: function () { oState.isChang = true; },
            onChange: function () { oState.isChang = true; _commitCurrent(); _renderList(); }
        });
        oTitleRow.appendChild(oTitleField.el);
        try { oTitleField.setValueState("information", _msg("/U4A/CL_WS_COMMON", "D17")); } catch (e) { }
    }

    // 푸터 줌 [−][%][+].
    var oZoom = document.getElementById("docZoomBtn");
    if (oZoom) { oZoom.addEventListener("click", function () { oState.zoom = 100; _applyZoom(); }); }
    var oZoomOut = document.getElementById("docZoomOut");
    if (oZoomOut) { oZoomOut.addEventListener("click", function () { _zoomStep(-10); }); }
    var oZoomIn = document.getElementById("docZoomIn");
    if (oZoomIn) { oZoomIn.addEventListener("click", function () { _zoomStep(10); }); }
}

// ── 세션 유지(원본 fnKeepClientSession) ─────────────────────────────────
function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

// ── 자식창 busy 동기화 채널(원본 broadcast-to-child-window) ─────────────────
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

    try { CURRWIN.setMenu(null); } catch (e) { }

    _initChrome();
    _initBroadcast();
    _initEditor();

    IPCRENDERER.on("if-appdocu-info", _onAppDocuInfo);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 창은 즉시 불투명 표시(네이티브 opacity 페이드 미사용). 등장 효과는 #docContent CSS opacity.
    try { CURRWIN.show(); } catch (e) { }

    // 워치독 — 에디터/서버 로드 지연 시 busy 강제 해제(20s).
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][docPopup] 에디터/서버 로드 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);

    // ★ busy 는 여기서 끄지 않는다 ★ — 오프너가 켠 WS20 busy 를 완전 로드(_finishOpen)까지 유지.
});

// busy 중에는 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC/에디터 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    try { IPCRENDERER.removeListener("if-appdocu-info", _onAppDocuInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { if (oJodit) { oJodit.destruct(); } } catch (e) { }
};
