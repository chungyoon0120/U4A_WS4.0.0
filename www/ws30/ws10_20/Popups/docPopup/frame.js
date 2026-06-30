/****************************************************************************
 * 현재 앱 기술 문서(Current App Technical Document) 에디터 창 로직 (frame.js)
 * --------------------------------------------------------------------------
 *  원본: frame.html(로더 iframe) + doc.html/doc.js(UI5 SplitApp + TinyMCE RichTextEditor) 2단 iframe.
 *  HTML5: 최상위 창에 [공통 타이틀바 + 본체] 를 두고, 본문 편집기는 **TinyMCE 6(MIT, 자체호스팅)**
 *  WYSIWYG 으로 교체. (원본이 UI5 RichTextEditor=TinyMCE4 였어서 충실도 최고. www/lib/tinymce 벤더링.)
 *
 *  ★ 원본 보존(1:1, doc.js 기준):
 *   · 데이터 = T_DOCLIST [{ DOCKY, TITLE, LDATA, AEUSR, AEDAT, AETIM }] (문서 본문 LDATA = HTML).
 *   · 서버 직접 XHR : POST {SERVPATH}/u4a_app_doc  (ACTCD=GET / SAVE, APPID, DATA=JSON).
 *   · 좌측 = 문서 목록(드로어), 우측 = 툴바(생성/삭제/저장 + 변경이력) + 제목 입력 + WYSIWYG.
 *   · 생성/삭제/저장/변경추적/Ctrl+휠 줌 동작 보존.
 *  ★ UI5 의존부 치환: SplitApp→DOM, RichTextEditor→TinyMCE, sap.m.Input→U4AUI.createField,
 *     MessageBox→U4AUI.confirm, MessageToast→공통 .u4a-toast.
 *
 *  ※ TinyMCE 테마: oxide 스킨은 색이 하드코딩(--변수 매핑 불가)이라, light=oxide / dark=oxide-dark
 *     스킨 스왑 + 편집영역(iframe) content_style 를 공통 토큰값으로 주입. 테마 변경 시 재init.
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

// 현재 상태(원본 oPrc / oModel 대응).
var oState = {
    list: [],            // T_DOCLIST
    curKey: null,        // 선택 DOCKY(원본 oPrc.DOCKY)
    isEdit: true,        // 편집 모드(원본 oPrc.isEdit = true 고정)
    isChang: false,      // 변경 표시(원본 oPrc.isChang)
    editorReady: false,  // TinyMCE 준비 완료
    gotInfo: false,      // opener if-appdocu-info 수신
    loadStarted: false,  // 서버 GET 시작
    silent: false,       // 프로그램적 setContent 중(변경 이벤트 무시)
    zoom: 100,
    filter: "",          // 사이드바 검색 필터(제목)
    _reselectKey: undefined,  // 재init 후 다시 선택할 DOCKY(테마 변경)
    APPID: "",
    URL: "",
    USRNM: ""
};

var oTiny = null, oTitleField = null, bBusy = false, oToastTimer = null,
    iBusyWatch = null, bOpenDone = false, oBroad = null;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────
function _msg(sCls, sCode, p1) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
}

function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// 배경색(BGCOL) 휘도로 다크 판정 → oxide / oxide-dark 스킨 선택.
function _isDarkBg(sBg) {
    try {
        var s = String(sBg || "").trim(), r, g, b;
        var m = s.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (m) { r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16); }
        else {
            var m2 = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!m2) { return true; }
            r = +m2[1]; g = +m2[2]; b = +m2[3];
        }
        return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
    } catch (e) { return true; }
}

// 공통 토큰 실제 계산값(편집영역 iframe 에 주입할 색 — iframe 은 부모 CSS 변수 캐스케이드 안 됨).
function _tok(sName, sFallback) {
    try {
        var v = getComputedStyle(document.documentElement).getPropertyValue(sName).trim();
        return v || sFallback;
    } catch (e) { return sFallback; }
}
function _contentStyle() {
    var bg = _tok("--surface", "#ffffff"),
        fg = _tok("--text", "#222f3e"),
        ac = _tok("--accent", "#0a6ed1"),
        ln = _tok("--divider", "#dddddd"),
        // 스크롤바 토큰(편집영역 iframe 은 부모 CSS 변수 캐스케이드 안 되므로 계산값을 직접 주입 — shell.css 전역과 동일 톤).
        sbTh = _tok("--scrollbar-thumb", "rgba(128,128,128,0.4)"),
        sbThH = _tok("--scrollbar-thumb-hover", sbTh),
        sbSz = _tok("--scrollbar-size", "10px"),
        sbRd = _tok("--radius", "6px");
    return (
        // ★html 도 같이 깔아야 함: body 만 깔면 다크모드에서 스크롤바 거터(투명 트랙) 뒤로
        //   iframe 기본 흰색 html 이 비쳐 우측에 흰 세로줄이 생긴다.
        "html{background:" + bg + ";}" +
        "body{background:" + bg + ";color:" + fg + ";" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;}") +
        "a{color:" + ac + ";}" +
        "table td,table th{border:1px solid " + ln + ";}" +
        // 스크롤바 — 우리 테마 톤. ★트랙은 transparent 대신 본문 배경(bg) 솔리드로 박는다:
        //   iframe 의 투명 트랙 뒤는 다크 캔버스가 아니라 iframe element 기본 흰색이 비쳐(다크모드 흰 줄)
        //   → 솔리드 다크로 박아야 확실히 사라진다(shell.css 메인문서는 캔버스가 테마라 transparent 가능).
        "html{scrollbar-color:" + sbTh + " " + bg + ";scrollbar-width:thin;}" +
        "::-webkit-scrollbar{width:" + sbSz + ";height:" + sbSz + ";}" +
        "::-webkit-scrollbar-track{background:" + bg + ";}" +
        "::-webkit-scrollbar-corner{background:" + bg + ";}" +
        // ★thumb 은 투명 보더 3px + padding-box 로 인셋해야 다른 화면처럼 가늘어 보임(shell.css 와 1:1).
        "::-webkit-scrollbar-thumb{background:" + sbTh + ";border-radius:" + sbRd + ";border:0.1875rem solid transparent;background-clip:padding-box;}" +
        "::-webkit-scrollbar-thumb:hover{background:" + sbThH + ";background-clip:padding-box;}";
}

// ── TinyMCE 래퍼(에디터 종류 의존 최소화) ────────────────────────────────
function _getEditorValue() {
    try { return oTiny ? oTiny.getContent() : null; } catch (e) { return null; }
}
function _setEditorValue(sHtml) {
    if (!oTiny) { return; }
    oState.silent = true;   // 프로그램적 주입 = 변경표시 금지
    try {
        oTiny.setContent((typeof sHtml === "string") ? sHtml : "");
        oTiny.setDirty(false);   // clean 으로 리셋 → 다음 "실제 편집" 때만 dirty 발화
    } catch (e) { }
    setTimeout(function () { oState.silent = false; }, 50);
}
function _setEditorReadOnly(bRead) {
    try { if (oTiny && oTiny.mode) { oTiny.mode.set(bRead ? "readonly" : "design"); } } catch (e) { }
}

// 툴바 더보기(⋯) 드로어 닫기 — floating 드로어(.tox-toolbar__overflow)는 자동으로 안 닫혀서,
//   다른 곳 클릭/타이핑 시 직접 닫는다. oEvTarget 가 드로어/툴바 안이면 무시(그건 정상 조작).
//   닫기 = 더보기 토글(primary 툴바 마지막 버튼) 을 다시 클릭. 드로어는 .tox-tinymce-aux(body) 에 뜨므로 document 기준 탐색.
function _closeToolbarOverflow(oEvTarget) {
    try {
        if (!oTiny) { return; }
        var oDrawer = document.querySelector(".tox-toolbar__overflow");
        if (!oDrawer || oDrawer.offsetParent === null) { return; }   // 더보기 안 열림
        if (oEvTarget && oDrawer.contains(oEvTarget)) { return; }      // 드로어 내부 클릭은 정상 조작
        var oCont = oTiny.getContainer();
        var oHeader = oCont ? oCont.querySelector(".tox-editor-header") : null;
        if (oEvTarget && oHeader && oHeader.contains(oEvTarget)) { return; } // 툴바(더보기 토글 포함) 클릭은 정상 조작
        var aGrp = oCont ? oCont.querySelectorAll(".tox-toolbar__primary .tox-toolbar__group") : [];
        var oMore = aGrp.length ? aGrp[aGrp.length - 1].querySelector(".tox-tbtn:last-child") : null;
        if (oMore) { oMore.click(); }   // 더보기 토글 → 닫힘
    } catch (e) { }
}
// 바깥(제목/문서목록/타이틀바 등 메인문서) 클릭 시 닫기. 본문 iframe 클릭은 setup 의 ed.on("click") 이 담당.
function _onDocMouseDownCloseOverflow(ev) {
    _closeToolbarOverflow(ev && ev.target);
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트).
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("docBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); } // 공통 .u4a-busy 토글
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    //   (idle 시 closable=true 주면 Alt+F4 가 먹는 버그. 공통 표준 browser-window-common-ux)
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

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

// 줌(원본 fn_setZoomEvt — Ctrl+휠로 본문 확대/축소). 별도 UI 없음.
function _zoomStep(iDelta) {
    var n = oState.zoom + iDelta;
    if (n < 50) { n = 50; }
    if (n > 200) { n = 200; }
    oState.zoom = n;
    try { if (oTiny && oTiny.getBody) { oTiny.getBody().style.zoom = (n / 100); } } catch (e) { }
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
// 수정일시 "YYYY-MM-DD HH:MM" (목록·헤더 공용). AEDAT 없으면 "".
function _modText(oLine) {
    if (!oLine || !oLine.AEDAT) { return ""; }
    return _convDate(oLine.AEDAT) + " " + _convTime(oLine.AETIM).slice(0, 5);
}
function _findLine(sKey) {
    for (var i = 0; i < oState.list.length; i++) { if (oState.list[i].DOCKY === sKey) { return oState.list[i]; } }
    return null;
}
// 문서가 미저장(변경됨)인가 — 신규(_new) 또는 편집후 미저장(_dirty).
function _isDirty(oLine) { return !!(oLine && (oLine._new || oLine._dirty)); }

// 문서 헤더 메타(수정일/작성자) + 상태칩 갱신. oLine=null 이면 비움.
function _renderHead(oLine) {
    var oDate = document.getElementById("docMetaDate");
    if (oDate) {
        var sMod = _modText(oLine);
        oDate.hidden = !sMod;
        oDate.querySelector("span").textContent = sMod;   // 숨김이어도 항상 갱신(잔상 제거)
    }
    var oUser = document.getElementById("docMetaUser");
    if (oUser) {
        var sUsr = (oLine && oLine.AEUSR) ? oLine.AEUSR : "";
        oUser.hidden = !sUsr;
        oUser.querySelector("span").textContent = sUsr;
    }
    _updateStatus();
}

// 상태칩 — 현재 문서가 변경됨이면 "Change"(A02) 표시, 아니면 숨김(저장됨=칩 없음).
function _updateStatus() {
    var oEl = document.getElementById("docStatus");
    if (!oEl) { return; }
    var oLine = (oState.curKey != null) ? _findLine(oState.curKey) : null;
    var bDirty = !!(oLine && (oLine._new || oLine._dirty || oState.isChang));
    oEl.hidden = !(bDirty && oState.curKey != null);
    if (!oEl.hidden) { oEl.querySelector("span").textContent = _msg("/U4A/CL_WS_COMMON", "A02"); } // Change(변경됨)
}

// 편집 발생 표시 — isChang + 현재 라인 _dirty + 상태칩 갱신(본문/제목 변경 시 호출).
function _markDirty() {
    oState.isChang = true;
    var oLine = (oState.curKey != null) ? _findLine(oState.curKey) : null;
    if (oLine) { oLine._dirty = true; }
    _updateStatus();
}

// ── 문서 목록 렌더(원본 NavigationList 바인딩) ───────────────────────────
function _renderList() {
    var oList = document.getElementById("docList");
    if (!oList) { return; }
    oList.innerHTML = "";

    if (oState.list.length === 0) {
        var oEmpty = document.createElement("div");
        oEmpty.className = "u4aDocListEmpty";
        oEmpty.textContent = _msg("/U4A/MSG_WS", "073", _msg("/U4A/CL_WS_COMMON", "B65"));
        oList.appendChild(oEmpty);
        return;
    }

    var sFilter = (oState.filter || "").toLowerCase();

    oState.list.forEach(function (oLine) {
        // 검색 필터(제목 + 작성자 ID 부분일치).
        if (sFilter) {
            var sHay = ((oLine.TITLE || "") + " " + (oLine.AEUSR || "")).toLowerCase();
            if (sHay.indexOf(sFilter) === -1) { return; }
        }

        var oItem = document.createElement("button");
        oItem.type = "button";
        oItem.className = "u4aDocItem";
        oItem.setAttribute("data-key", oLine.DOCKY);
        if (oLine.DOCKY === oState.curKey) { oItem.setAttribute("aria-selected", "true"); }

        var oIco = document.createElement("span");
        oIco.className = "u4aDocItem__icon";
        oIco.innerHTML = '<i class="fa-solid fa-' + (oLine._new ? "file-pen" : "file-lines") + '"></i>';
        oItem.appendChild(oIco);

        var oMain = document.createElement("span");
        oMain.className = "u4aDocItem__main";

        var oTtl = document.createElement("span");
        oTtl.className = "u4aDocItem__title";
        var sTitle = oLine.TITLE || "";
        if (sTitle) { oTtl.textContent = sTitle; oTtl.title = sTitle; }  // 길면 잘리므로 전체는 툴팁으로
        else { oTtl.textContent = "—"; oTtl.classList.add("is-empty"); }
        oMain.appendChild(oTtl);

        // 메타 = 수정일시 · 작성자(데이터만, 라벨 없음). 신규/미저장은 빈칸(변경점으로 표시).
        var oMeta = document.createElement("span");
        oMeta.className = "u4aDocItem__meta";
        var sMod = _modText(oLine);
        oMeta.textContent = sMod ? (sMod + (oLine.AEUSR ? " · " + oLine.AEUSR : "")) : "";
        oMain.appendChild(oMeta);

        oItem.appendChild(oMain);

        if (_isDirty(oLine)) {
            var oDot = document.createElement("span");
            oDot.className = "u4aDocItem__dot";
            oItem.appendChild(oDot);
        }

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
        oLine._dirty = true;   // 편집됨 = 저장 전까지 변경됨
        var oStmp = _now();
        oLine.AEDAT = oStmp.DATE;
        oLine.AETIM = oStmp.TIME;
        oLine.AEUSR = oState.USRNM;
        _renderHead(oLine);
    }
    // 값 캡처 후 에디터 dirty 리셋 → 같은 문서 계속 편집 시 다음 변경에 dirty 재발화(isChang 재설정).
    try { if (oTiny) { oTiny.setDirty(false); } } catch (e) { }
}

function _applyEditorState() {
    var bEditable = oState.isEdit && oState.curKey != null;
    _setEditorReadOnly(!bEditable);
    if (oTitleField) { oTitleField.setReadOnly(!bEditable); }
}

// 문서 선택 → 디테일에 반영(원본 fn_setDOCLineData).
function _selectDoc(sKey) {
    _commitCurrent();

    var oLine = (sKey == null) ? null : _findLine(sKey);

    if (!oLine) {
        oState.curKey = null;
        if (oTitleField) { oTitleField.setValue(""); if (oTitleField.input) { oTitleField.input.title = ""; } }
        _setEditorValue("");
        _renderHead(null);
        _applyEditorState();
        _renderList();
        return;
    }

    oState.curKey = oLine.DOCKY;
    oState.isChang = false;

    if (oTitleField) { oTitleField.setValue(oLine.TITLE || ""); if (oTitleField.input) { oTitleField.input.title = oLine.TITLE || ""; } }
    _setEditorValue((typeof oLine.LDATA === "string") ? oLine.LDATA : "");
    _renderHead(oLine);
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
        _toast(_msg("/U4A/MSG_WS", "326")); // Select the delete line
        return;
    }

    U4AUI.confirm({
        type: "C",
        title: _msg("/U4A/CL_WS_COMMON", "B65"),
        message: _msg("/U4A/MSG_WS", "003"),
        buttons: [
            { act: "YES", label: _msg("/U4A/CL_WS_COMMON", "A03"), emphasized: true }, // ✓ 확인=파랑(체크에 빨강은 어색)
            { act: "NO", label: _msg("/U4A/CL_WS_COMMON", "A39") }
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
    oState.curKey = null;
    _selectDoc(oState.list[iNext].DOCKY);
}

// ── 저장(원본 oBTsave → fn_Save) ─────────────────────────────────────────
function _save() {
    if (!oState.isEdit) { return; }
    _commitCurrent();

    if (oState.list.length === 0) {
        _toast(_msg("/U4A/MSG_WS", "328")); // Saved data does not exist
        return;
    }

    U4AUI.confirm({
        type: "C",
        title: _msg("/U4A/CL_WS_COMMON", "B65"),
        message: _msg("/U4A/MSG_WS", "010"),
        buttons: [
            { act: "YES", label: _msg("/U4A/CL_WS_COMMON", "A64"), emphasized: true },
            { act: "NO", label: _msg("/U4A/CL_WS_COMMON", "A39") }
        ],
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            _xhrSave();
        }
    });
}

// ── 치명 오류(원본 fn_setMsgMove / MessagePage) ──────────────────────────
function _fatal(sText) {
    var oDetail = document.getElementById("docDetail");
    if (!oDetail) { return; }
    var oOv = document.createElement("div");
    oOv.className = "u4aDocFatal";
    var sTitle = _msg("/U4A/CL_WS_COMMON", "B93") + " " + _msg("/U4A/CL_WS_COMMON", "B86");
    oOv.innerHTML =
        '<i class="fa-solid fa-circle-exclamation"></i>' +
        '<div class="u4aDocFatal__title"></div>' +
        '<div class="u4aDocFatal__desc"></div>' +
        '<div class="u4aDocFatal__text"></div>';
    oOv.querySelector(".u4aDocFatal__title").textContent = sTitle;
    oOv.querySelector(".u4aDocFatal__desc").textContent = _msg("/U4A/MSG_WS", "192");
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

    var sWrong = _msg("/U4A/MSG_WS", "324");

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
                // 저장 성공 = 로컬 현지화 메시지(서버 RTMSG 는 영문 고정이라 KO 접속 시 영어로 떠 사용자 지적).
                _toast(_msg("/U4A/MSG_WS", "002")); // Saved success.(접속 언어로)
                oState.list.forEach(function (o) { delete o._new; delete o._dirty; }); // 저장됨 → 변경표시 해제
                oState.isChang = false;
                _renderList();
                _updateStatus();   // 상태칩 숨김(저장됨)
                break;
            case "E":
                // 오류는 서버가 주는 사유(RTMSG)를 그대로 — 없으면 로컬 폴백.
                _toast(oData.RTMSG || _msg("/U4A/MSG_WS", "324"));
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

// ── TinyMCE 생성/재생성 ──────────────────────────────────────────────────
function _initEditor() {
    if (!window.tinymce || typeof window.tinymce.init !== "function") {
        console.error("[HTML5][docPopup] TinyMCE 미로드 — 스크립트 경로/전역 확인 필요");
        _finishOpen();
        return;
    }

    var bDark = _isDarkBg(BGCOL);

    window.tinymce.init({
        selector: "#docEditor",
        menubar: false,
        statusbar: false,
        branding: false,
        promotion: false,
        resize: false,
        height: "100%",
        skin: bDark ? "oxide-dark" : "oxide",
        content_css: bDark ? "dark" : "default",
        content_style: _contentStyle(),
        readonly: true,                 // 문서 선택 후 활성(_applyEditorState)
        // ※ help 플러그인 제외 — 런타임에 plugins/help/js/i18n/keynav/<lang>.js(비-min)를 지연 로드하는데
        //   벤더 트림에서 비-min 리소스를 지워 ERR_FILE_NOT_FOUND→unhandledrejection→Critical Error 발생.
        //   기술문서 편집에 Help 다이얼로그 불필요하므로 미사용.
        plugins: "advlist autolink lists link image table code charmap searchreplace visualblocks",
        // 더보기(⋯) = floating 드로어(인라인으로 안 밀고 떠서, 다른 곳 클릭 시 닫기 처리 가능).
        toolbar_mode: "floating",
        toolbar: "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | "
            + "alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | removeformat code",
        setup: function (ed) {
            // 본문 "실제 내용 변경"일 때만 변경표시 — TinyMCE dirty 이벤트(클릭/포커스/선택은 안 침).
            //   프로그램적 setContent 는 _setEditorValue 가 setDirty(false)+silent 로 흡수.
            ed.on("dirty", function () {
                if (oState.silent) { return; }
                _markDirty();   // isChang + 현재라인 _dirty + 상태칩
            });
            // 본문 클릭/타이핑 시 더보기 드로어 닫기(다른 곳 클릭=본문). null=무조건 닫기.
            ed.on("click keyup", function () { _closeToolbarOverflow(null); });
            // Ctrl+휠 줌(원본 fn_setZoomEvt) — 편집영역 iframe 문서.
            ed.on("init", function () {
                try {
                    ed.getDoc().addEventListener("wheel", function (evt) {
                        if (!evt.ctrlKey) { return; }
                        evt.preventDefault();
                        _zoomStep(evt.deltaY < 0 ? 10 : -10);
                    }, { passive: false });
                } catch (e) { }
            });
        }
    }).then(function (aEds) {
        oTiny = aEds && aEds[0];
        oState.editorReady = true;

        // 재init(테마 변경) 후 이전 선택 복원, 아니면 최초 로드 시작.
        if (oState._reselectKey !== undefined) {
            var k = oState._reselectKey;
            oState._reselectKey = undefined;
            oState.curKey = null;
            _selectDoc(k);          // k=null 이면 빈 상태로
        } else {
            _maybeLoad();
        }
    }).catch(function (e) {
        console.error("[HTML5][docPopup] tinymce.init 실패:", e && e.message);
        _finishOpen();
    });
}

// 테마 변경 시 스킨/본문색 갱신을 위해 에디터 재생성(내용/선택 보존).
function _reinitEditor() {
    if (!oTiny) { return; }
    _commitCurrent();
    oState._reselectKey = oState.curKey;   // null 가능(빈 상태)
    try { oTiny.remove(); } catch (e) { }   // remove() 가 textarea#docEditor 복원 → 같은 selector 재init 가능
    oTiny = null;
    oState.editorReady = false;
    _initEditor();
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
        oState.URL = ((oInfo && oInfo.SERVPATH) || "") + "/u4a_app_doc";
    } catch (e) { }
    oState.gotInfo = true;
    _maybeLoad();
}

// ── 라이브 테마 변경 — TinyMCE 는 스킨 색 하드코딩이라 스킨 스왑/본문색 위해 재init 필요.
//   토큰 CSS(<link>)가 비동기 로드라, 적용 후 약간 지연 뒤 재init(계산된 토큰값 확정 후).
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
    setTimeout(function () { _reinitEditor(); }, 200);
}

// ── 타이틀바/툴바/제목 초기화 ───────────────────────────────────────────
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
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }   // busy 중 닫기 차단
            // 창은 closable:false 라 직접 close() 불가 → 공통 closeWindow(setClosable→close).
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

    var oNavHead = document.getElementById("docNavHead");
    if (oNavHead) { oNavHead.textContent = _msg("/U4A/CL_WS_COMMON", "D14"); } // Document List

    // 새 문서(+) — 사이드바 헤더(목록 관리 맥락).
    var oNew = document.getElementById("docNewBtn");
    if (oNew) {
        oNew.title = _msg("/U4A/CL_WS_COMMON", "A01"); // Create
        oNew.addEventListener("click", function () { _create(); });
    }

    // 검색 — 제목 필터(A75 Search).
    var oSearch = document.getElementById("docSearch");
    if (oSearch) {
        oSearch.placeholder = _msg("/U4A/CL_WS_COMMON", "A75"); // Search
        oSearch.addEventListener("input", function () { oState.filter = oSearch.value || ""; _renderList(); });
    }

    // 삭제/저장 — 문서 헤더 우측(라벨 + 아이콘).
    var oDelete = document.getElementById("docDeleteBtn");
    if (oDelete) {
        var sDel = _msg("/U4A/CL_WS_COMMON", "A03"); // Delete
        var oDS = oDelete.querySelector("span"); if (oDS) { oDS.textContent = sDel; }
        oDelete.title = sDel;
        oDelete.addEventListener("click", function () { _delete(); });
    }
    var oSave = document.getElementById("docSaveBtn");
    if (oSave) {
        var sSav = _msg("/U4A/CL_WS_COMMON", "A64"); // Save
        var oSS = oSave.querySelector("span"); if (oSS) { oSS.textContent = sSav; }
        oSave.title = sSav + " (Ctrl+S)";
        oSave.addEventListener("click", function () { _save(); });
    }

    // 제목 입력(문서 헤더, 큰 무테두리 — frame.css 스코프). placeholder=Title(D16). 변경=_markDirty.
    var oTitleRow = document.getElementById("docTitleRow");
    if (oTitleRow && window.U4AUI) {
        oTitleField = U4AUI.createField({
            placeholder: _msg("/U4A/CL_WS_COMMON", "D16"),
            clear: true,
            maxLength: 255,
            readOnly: true,
            onInput: function (v) { _markDirty(); if (oTitleField && oTitleField.input) { oTitleField.input.title = v || ""; } },
            onChange: function () { _markDirty(); _commitCurrent(); _renderList(); }
        });
        oTitleRow.appendChild(oTitleField.el);
    }
}

function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

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

    // 메인문서 클릭(제목/문서목록/타이틀바 등) 시 더보기 드로어 닫기(capture — 다른 핸들러보다 먼저).
    document.addEventListener("mousedown", _onDocMouseDownCloseOverflow, true);

    try { CURRWIN.show(); } catch (e) { }

    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][docPopup] 에디터/서버 로드 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);
});

// busy 중에는 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC/에디터 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    try { document.removeEventListener("mousedown", _onDocMouseDownCloseOverflow, true); } catch (e) { }
    try { IPCRENDERER.removeListener("if-appdocu-info", _onAppDocuInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { if (oTiny) { oTiny.remove(); } } catch (e) { }
};
