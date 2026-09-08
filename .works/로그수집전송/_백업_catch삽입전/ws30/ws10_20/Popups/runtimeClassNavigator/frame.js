/****************************************************************************
 * 런타임 클래스 탐색기(Runtime Class Navigator) 창 로직 (frame.js)
 * --------------------------------------------------------------------------
 *  원본: frame.html(로더 iframe) + index.html/index.js(UI5 sap.m.App/Page/Table) 2단 iframe.
 *  HTML5: docPopup 과 동일한 1단 frameless 창으로 재작성 — 최상위 문서에
 *  [공통 .u4a-titlebar + 검색패널 + 공통 .u4a-table] 를 직접 둔다.
 *
 *  ★ 원본 보존(1:1, index.js 기준):
 *   · 데이터 = T_0022(소스 전달 단계에서 OBJTY∈{1,2,4}+ISDEP≠X+T_0020.NUSED≠X 필터, opener 담당).
 *     CLASS = 네임스페이스 접두(ZCL_U4A_ / /U4A/CL_) + UIOBK. 접두 분기 = oMetadata.IS_NAME_SPACE === "X".
 *   · 검색 = UIOBJ/LIBNM/CLASS contains(라이브 + Enter + 버튼). 드롭 검색 = LIBNM 정확일치.
 *   · UX 디자인영역에서 UI 드래그(dataTransfer "rtmcls"=LIBNM) → 드롭존에 놓으면 LIBNM 필터.
 *   · 행 더블클릭 → ABAP 클래스 선언문(DATA LO_xxx TYPE REF TO <CLASS>...) 클립보드 복사 + 토스트.
 *   · busy 브로드캐스트 짝(BUSY_ON/OFF), 로드완료 SETBUSYLOCK off, 테마 라이브 변경.
 *  ★ UI5 의존부 치환: sap.m.Table→공통 .u4a-table, sap.m.Input→U4AUI.createField,
 *     MessageToast→공통 .u4a-toast, sap.ui.getCore().applyTheme→U4ATheme.apply.
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

// 카드(타일) 뷰 전환 폭(px) — 이보다 좁으면 행을 카드로(공통 .u4a-table-wrap[data-view]). 원본 demandPopin 대응.
var CARD_VIEW_MAX = 560;

// 현재 상태.
var oState = {
    all: [],          // 가공된 전체 행 [{ UIOBJ, LIBNM, CLASS }]
    metadata: null,   // oMetadata(IS_NAME_SPACE 분기용)
    filter: "",       // 현재 검색어
    gotInfo: false    // if-runtime-info 수신 여부
};

var oSrchField = null, bBusy = false, oToastTimer = null,
    iBusyWatch = null, bOpenDone = false, oBroad = null;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────
function _msg(sCls, sCode, p1) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); }
    catch (e) { return ""; }
}

// ZMSG_WS_COMMON_001 클래스 전용(no-data 946 등 — /U4A/MSG_WS 에는 없는 키).
//   versionMng/OTRF4 와 동일 호출(WSUTIL.getWsMsgClsTxt). 임의 생성 없음.
function _zmsg(sNo) {
    try { return WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo) || ""; }
    catch (e) { return ""; }
}

function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트). docPopup 과 동일 규약.
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("rtmBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 로드 완료 — 메인 busy lock 해제 + 자식창 BUSY_OFF + 본문 표시(1회만).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    var oBody = document.getElementById("rtmBody");
    if (oBody) { oBody.classList.add("u4aRtmShown"); }
}

// 공통 .u4a-toast(화면 정중앙) — 싱글톤 div + data-show + 3초.
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aRtmToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aRtmToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

// ── 데이터 가공(원본 frame.js if-runtime-info 핸들러 1:1) ────────────────
function _processRuntime(aRuntimeData, oMetadata) {
    oState.metadata = oMetadata || null;

    var aOut = [];
    if (!Array.isArray(aRuntimeData)) { oState.all = aOut; return; }

    // 네임스페이스 대상이면 /U4A/CL_, 아니면 ZCL_U4A_.
    var sPrefix = "ZCL_U4A_";
    if (oMetadata && oMetadata.IS_NAME_SPACE === "X") { sPrefix = "/U4A/CL_"; }

    for (var i = 0; i < aRuntimeData.length; i++) {
        var oRuntime = aRuntimeData[i];
        if (!oRuntime) { continue; }
        // ★ OBJTY(1/2/4)·ISDEP(폐기)·T_0020.NUSED(미사용 라이브러리) 필터는 소스 전달 단계
        //   (fnDialogPopupOpener.js did-finish-load, WS3 원본 d1a02d65 동일)에서 이미 처리됨 → 여기선 안 함.
        aOut.push({
            UIOBJ: oRuntime.UIOBJ || "",       // UI 명
            LIBNM: oRuntime.LIBNM || "",       // UI5 Library 명
            CLASS: sPrefix + (oRuntime.UIOBK || "") // 런타임 클래스명
        });
    }

    oState.all = aOut;
}

// ── 테이블 렌더(공통 .u4a-table 소비) ────────────────────────────────────
function _makeTh(sText, sCls) {
    var oTh = document.createElement("th");
    if (sCls) { oTh.className = sCls; }
    oTh.textContent = sText;
    return oTh;
}

// 현재 검색 조건(oState.filter)으로 행을 거른다.
//   bExact=true → LIBNM 정확일치(드롭 검색). 아니면 UIOBJ/LIBNM/CLASS contains(대소문자 무시).
function _filterRows() {
    var aAll = oState.all || [];
    var sQ = oState.filter || "";

    if (oState._exact) {
        return aAll.filter(function (o) { return o.LIBNM === sQ; });
    }
    if (!sQ) { return aAll.slice(); }

    var sLow = sQ.toLowerCase();
    return aAll.filter(function (o) {
        return (o.UIOBJ || "").toLowerCase().indexOf(sLow) !== -1
            || (o.LIBNM || "").toLowerCase().indexOf(sLow) !== -1
            || (o.CLASS || "").toLowerCase().indexOf(sLow) !== -1;
    });
}

function _renderTable() {
    var oWrap = document.getElementById("rtmWrap");
    if (!oWrap) { return; }

    var sColObj = _msg("/U4A/CL_WS_COMMON", "A84"), // UI Object ID
        sColLib = _msg("/U4A/CL_WS_COMMON", "A85"), // UI Object Module
        sColCls = _msg("/U4A/CL_WS_COMMON", "B00"); // Object Runtime Class

    var aRows = _filterRows();

    var oTable = document.createElement("table");
    oTable.className = "u4a-table u4aRtmTbl";

    // colgroup — fixed 레이아웃 컬럼 폭(테이블뷰).
    var oColgroup = document.createElement("colgroup");
    ["u4aRtmCol--obj", "u4aRtmCol--lib", "u4aRtmCol--cls"].forEach(function (sCls) {
        var oCol = document.createElement("col");
        oCol.className = sCls;
        oColgroup.appendChild(oCol);
    });
    oTable.appendChild(oColgroup);

    // thead
    var oThead = document.createElement("thead");
    var oTrHead = document.createElement("tr");
    oTrHead.appendChild(_makeTh(sColObj, "u4a-c-robj"));
    oTrHead.appendChild(_makeTh(sColLib, "u4a-c-rlib"));
    oTrHead.appendChild(_makeTh(sColCls, "u4a-c-rcls"));
    oThead.appendChild(oTrHead);
    oTable.appendChild(oThead);

    // tbody
    var oTbody = document.createElement("tbody");

    if (aRows.length === 0) {
        var oTrNo = document.createElement("tr");
        oTrNo.className = "u4a-table__nodata";
        var oTdNo = document.createElement("td");
        oTdNo.colSpan = 3;
        oTdNo.textContent = _zmsg("946"); // No data(공통 no-data 키 ZMSG_WS_COMMON_001 — versionMng/OTRF4 선례)
        oTrNo.appendChild(oTdNo);
        oTbody.appendChild(oTrNo);
    } else {
        aRows.forEach(function (oRowData, idx) {
            var oTr = document.createElement("tr");
            oTr.setAttribute("data-rtm-row", "X");
            oTr.setAttribute("aria-selected", "false");
            oTr.setAttribute("tabindex", "0");
            oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";
            oTr._rowData = oRowData;

            var oTdObj = document.createElement("td");
            oTdObj.className = "u4a-c-robj";
            oTdObj.dataset.label = sColObj;
            oTdObj.textContent = oRowData.UIOBJ || "";

            var oTdLib = document.createElement("td");
            oTdLib.className = "u4a-c-rlib";
            oTdLib.dataset.label = sColLib;
            oTdLib.textContent = oRowData.LIBNM || "";

            var oTdCls = document.createElement("td");
            oTdCls.className = "u4a-c-rcls";
            oTdCls.dataset.label = sColCls;
            oTdCls.textContent = oRowData.CLASS || "";

            oTr.appendChild(oTdObj);
            oTr.appendChild(oTdLib);
            oTr.appendChild(oTdCls);
            oTbody.appendChild(oTr);
        });
    }

    oTable.appendChild(oTbody);

    oWrap.innerHTML = "";
    oWrap.appendChild(oTable);

    // 결과 건수 배지 갱신(표시 행 수 / 전체).
    var oCount = document.getElementById("rtmCount");
    if (oCount) {
        var iAll = (oState.all || []).length;
        oCount.textContent = (aRows.length === iAll) ? String(iAll) : (aRows.length + " / " + iAll);
    }

    // 행 이벤트 — 단일클릭=선택, 더블클릭/Enter=클립보드 복사.
    oTbody.addEventListener("click", _onRowClick);
    oTbody.addEventListener("dblclick", _onRowDblclick);
    oTbody.addEventListener("keydown", _onRowKeydown);
}

// ── 행 선택/실행 ─────────────────────────────────────────────────────────
function _getRow(oEvent) {
    return oEvent.target ? oEvent.target.closest("tr[data-rtm-row]") : null;
}
function _selectRow(oRow) {
    if (!oRow) { return; }
    var oTbody = oRow.parentNode;
    if (oTbody) {
        var oPrev = oTbody.querySelector('tr[aria-selected="true"]');
        if (oPrev && oPrev !== oRow) { oPrev.setAttribute("aria-selected", "false"); }
    }
    oRow.setAttribute("aria-selected", "true");
}
function _onRowClick(oEvent) { _selectRow(_getRow(oEvent)); }
function _onRowDblclick(oEvent) {
    var oRow = _getRow(oEvent);
    _selectRow(oRow);
    if (oRow && oRow._rowData) { _copyRow(oRow._rowData); }
}
function _onRowKeydown(oEvent) {
    if (oEvent.repeat) { return; }
    if (oEvent.key !== "Enter" && oEvent.key !== " " && oEvent.key !== "Spacebar") { return; }
    var oRow = _getRow(oEvent);
    if (!oRow) { return; }
    oEvent.preventDefault();
    _selectRow(oRow);
    if (oRow._rowData) { _copyRow(oRow._rowData); }
}

// 선택 행 → ABAP 클래스 선언문 클립보드 복사(원본 fnSetClipBoardCopyRowData 1:1).
function _copyRow(oRowData) {
    var sClsNm = oRowData.CLASS,                 // 런타임 클래스명
        sObjNm = (oRowData.UIOBJ || "").toUpperCase(), // UI 명(대문자)
        sInstNm = "LO_" + sObjNm,                // 인스턴스 명
        sCopyText = "DATA " + sInstNm + " TYPE REF TO " + sClsNm + ". \n"; // 선언문

    var oMetadata = oState.metadata;
    if (oMetadata && oMetadata.IS_NAME_SPACE === "X") {
        sCopyText += sInstNm + " ?= ME->/U4A/IF_SERVER~AR_VIEW->GET_UI_INSTANCE( I_ID = '' ).";
    } else {
        sCopyText += sInstNm + " ?= ME->ZIF_U4A_SERVER~AR_VIEW->GET_UI_INSTANCE( I_ID = '' ).";
    }

    var bOk = false;
    try {
        var oTextArea = document.createElement("textarea");
        oTextArea.value = sCopyText;
        document.body.appendChild(oTextArea);
        oTextArea.select();
        bOk = document.execCommand('copy');
        document.body.removeChild(oTextArea);
    } catch (e) { bOk = false; }

    // navigator.clipboard 폴백.
    if (!bOk) {
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(sCopyText); bOk = true; } }
        catch (e2) { }
    }

    // Clipboard transfer complete. Perform [CTRL + V] on the target area.
    if (bOk) { _toast(_msg("/U4A/MSG_WS", "316")); }
}

// ── 검색 실행 ────────────────────────────────────────────────────────────
function _applyFilter(sText, bExact) {
    oState.filter = (sText == null) ? "" : String(sText);
    oState._exact = !!bExact;
    _renderTable();
}

// ── 드롭존(디자인영역 UI 드래그 → LIBNM 필터) ────────────────────────────
function _initDropZone() {
    var oDrop = document.getElementById("rtmDrop");
    if (!oDrop) { return; }

    oDrop.addEventListener("dragover", function (e) {
        e.preventDefault();
        try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } } catch (x) { }
        oDrop.classList.add("is-dragover");
    });
    oDrop.addEventListener("dragleave", function () {
        oDrop.classList.remove("is-dragover");
    });
    oDrop.addEventListener("drop", function (e) {
        e.preventDefault();
        oDrop.classList.remove("is-dragover");

        var sLib = "";
        try { sLib = e.dataTransfer.getData("rtmcls"); } catch (x) { sLib = ""; }
        if (!sLib) { return; }

        // 드롭 = LIBNM 정확일치 필터 + 검색칸에 값 표시(원본 setValue + fireSubmit(ISDROP)).
        if (oSrchField) { oSrchField.setValue(sLib); }
        _applyFilter(sLib, true);
    });
}

// 디자인영역 드래그 종료 IPC(원본 if-Dialog-dragEnd) — 드롭존 강조 해제.
function _onDialogDragEnd() {
    var oDrop = document.getElementById("rtmDrop");
    if (oDrop) { oDrop.classList.remove("is-dragover"); }
    try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } } catch (x) { }
}

// ── 메인(opener) → 창: 런타임 정보 수신(원본 if-runtime-info) ──────────────
function _onRuntimeInfo(event, oInfo) {
    if (oState.gotInfo) { return; }
    oState.gotInfo = true;

    try { _processRuntime(oInfo && oInfo.aRuntimeData, oInfo && oInfo.oMetadata); } catch (e) { oState.all = []; }

    _renderTable();
    _observeView();
    _finishOpen();
}

// ── 라이브 테마 변경(원본 _onIpcMain_if_p13n_themeChange) ──────────────────
function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
            BGCOL = oTheme.BGCOL;
        }
    } catch (e) { }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
}

// ── 반응형 table↔card(공통 방식: ResizeObserver→data-view). Chromium93 컨테이너쿼리 미지원. ──
function _applyView() {
    var oWrap = document.getElementById("rtmWrap");
    if (!oWrap || !oWrap.isConnected) { return; }
    var iWidth = oWrap.getBoundingClientRect().width;
    if (!iWidth) { return; }
    var sView = (iWidth < CARD_VIEW_MAX) ? "card" : "table";
    if (oWrap.dataset.view !== sView) { oWrap.dataset.view = sView; }
}
var bViewObserved = false;
function _observeView() {
    var oWrap = document.getElementById("rtmWrap");
    if (!oWrap) { return; }
    _applyView();
    if (bViewObserved) { return; }
    bViewObserved = true;
    if (typeof ResizeObserver !== "undefined") {
        var bScheduled = false;
        var oRO = new ResizeObserver(function () {
            if (bScheduled) { return; }
            bScheduled = true;
            var fnRAF = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : function (cb) { return setTimeout(cb, 16); };
            fnRAF(function () { bScheduled = false; _applyView(); });
        });
        oRO.observe(oWrap);
    }
    window.addEventListener("resize", _applyView);
}

// ── 타이틀바/검색 초기화 ────────────────────────────────────────────────
function _initChrome() {
    var oLogo = document.getElementById("rtmLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    var oTitle = document.getElementById("rtmTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        if (!s) { s = _msg("/U4A/CL_WS_COMMON", "A14"); } // Runtime Class Navigator
        oTitle.textContent = s;
    }

    var oClose = document.querySelector('#rtmTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

    // 드롭존/안내 문구.
    var oDropText = document.getElementById("rtmDropText");
    if (oDropText) { oDropText.textContent = _msg("/U4A/MSG_WS", "314"); } // Drag the UI from the UX Design Area.
    var oHint = document.getElementById("rtmHintText");
    if (oHint) { oHint.textContent = _msg("/U4A/MSG_WS", "315"); } // Double-click in the search list to copy to clipboard.

    // 검색 버튼.
    var oSrchBtn = document.getElementById("rtmSrchBtn");
    if (oSrchBtn) {
        var sSearch = _msg("/U4A/CL_WS_COMMON", "A75"); // Search
        var oBS = oSrchBtn.querySelector("span"); if (oBS) { oBS.textContent = sSearch; }
        oSrchBtn.title = sSearch;
        oSrchBtn.addEventListener("click", function () { _applyFilter(oSrchField ? oSrchField.getValue() : "", false); });
    }

    // 검색 입력칸(공통 createField) — 라이브검색 + Enter 검색 + clear(X).
    var oFieldHost = document.getElementById("rtmSrchField");
    if (oFieldHost && window.U4AUI) {
        oSrchField = U4AUI.createField({
            placeholder: _msg("/U4A/CL_WS_COMMON", "A75"), // Search
            clear: true,
            onInput: function (v) { _applyFilter(v, false); },     // 라이브 검색
            onEnter: function (v) { _applyFilter(v, false); },     // submit
            onClear: function () { _applyFilter("", false); }
        });
        oFieldHost.appendChild(oSrchField.el);
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

    _setBusy(true);

    _initChrome();
    _initDropZone();
    _initBroadcast();

    // 데이터 도착 전 빈 테이블 1회 렌더(헤더 노출).
    _renderTable();
    _observeView();

    IPCRENDERER.on("if-runtime-info", _onRuntimeInfo);
    IPCMAIN.on("if-Dialog-dragEnd", _onDialogDragEnd);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    try { CURRWIN.show(); } catch (e) { }

    // 안전판 — if-runtime-info 가 안 오면 busy 강제 해제(원본 동작엔 없던 방어).
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][runtimeClassNavigator] 런타임 정보 수신 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);
});

// busy 중 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("resize", _applyView);
    try { IPCRENDERER.removeListener("if-runtime-info", _onRuntimeInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-Dialog-dragEnd", _onDialogDragEnd); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
