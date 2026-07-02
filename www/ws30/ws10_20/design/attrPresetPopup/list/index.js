/****************************************************************************
 * UI Attribute 개인화 항목 팝업 — 창 로직 (index.js)
 * --------------------------------------------------------------------------
 *  원본: list/index.html(UI5 bootstrap) + views/vw_main/view.js(sap.m.App/Page +
 *        sap.ui.layout.Splitter + sap.ui.table.Table + sap.m.Table) + control.js(로직).
 *  HTML5: docPopup/runtimeClassNav/versionMng 과 동일한 1단 frameless 창으로 재작성 —
 *  최상위 문서에 [공통 .u4a-titlebar + 상단 툴바 + 가로 스플리터(좌 UI 목록 / 우 속성 목록)] 를 직접 둔다.
 *
 *  ★ 원본 보존(1:1, control.js 기준):
 *   · 데이터 = SQLite {P13N_ROOT}/UI_ATTR/UI_ATTR_PRESET.db (UI_ATTR_PRESET, PK[LIBVER,SYSID,UNAME,UIATK]).
 *     좌측 = 저장된 UIOBK distinct → T_0022 조인(아이콘/UI명/라이브러리명).
 *     우측 = 선택 UI 의 preset → T_0023 조인(속성명/타입/카디널리티). UIATY→UIATK 정렬+그룹핑.
 *   · 삭제 = 체크 행 DELETE(… UIATK IN(…)) + 확인(632)/상세목록(≤10 + 653) + 완료토스트(633).
 *   · 다운로드 = 폴더선택 → XOR 난독화 hex(.dat), 업로드 = .dat → 복호화 → upsert.
 *   · 레이아웃 초기화(655) = 스플리터 홈 복귀. 도움말 = opener 로 U4A Help Document(000278).
 *   · busy 브로드캐스트 짝(BUSY_ON/OFF), 로드완료 load-finish(메인 lock 해제), 라이브 테마 변경.
 *   · ATTR_CHANGE(메인에서 속성 개인화 발생) 수신 시 목록 새로고침.
 *  ★ UI5 의존부 치환: sap.ui.table/sap.m.Table→공통 .u4a-table, sap.m.Input→U4AUI.createField,
 *     MessageToast→공통 .u4a-toast, MessageBox.confirm→U4AUI.confirm, applyTheme→U4ATheme.apply.
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
    LANGU = USERINFO.LANGU;

var zconsole = WSERR(window, document, console);

// 카드(타일) 뷰 전환 폭(px) — 이보다 좁으면 우측 속성 테이블을 카드로(공통 data-view). 원본 demandPopin 대응.
var CARD_VIEW_MAX = 620;

// 난독화 KEY(원본 control.js C_OBF_KEY 1:1).
var C_OBF_KEY = "U4A_ATTR_PRESET_KEY";

// UI ATTR 유형(UIATY) → 아이콘(원본 sap-icon → FA 매핑) / 그룹 설명.
//   1:PROP(customize) 2:EVNT(border) 3:AGGR(0:1 color-fill / 0:N dimension) 4:ASSO 6:EMBED AGGR
var UIATY_DESC = { "1": "Properties", "2": "Events", "3": "Aggregations", "4": "Associations", "6": "Embedded Aggregations" };
var UIATY_ORDER = { "1": 1, "2": 2, "3": 3, "4": 4, "6": 6 };

// DB 스키마(원본 control.js createTable 1:1).
var DB_COLS = ["LIBVER TEXT NOT NULL", "SYSID TEXT NOT NULL", "UNAME TEXT NOT NULL",
    "UIATK TEXT NOT NULL", "UIOBK TEXT NOT NULL", "UIATV TEXT", "UIATY TEXT"];
var DB_PK = ["LIBVER", "SYSID", "UNAME", "UIATK"];

// opener HANDLE_ON_INIT 로 받는 라이브러리 데이터.
var LIB = { LIBVER: "", T_0022: [], T_0023: [], T_0024: [], T_9011: [] };
var oThemeInfo = null;

// 현재 상태.
var oState = {
    head: [],        // 좌측 UI 목록 [{UIOBK, UIOBJ, LIBNM, UICON, ICON_PATH}]
    items: [],       // 우측 속성 목록(선택 UI) [{UIATK, UIOBK, UIATT, UIATV, UIATY, UIADT, ISMLB}]
    selHead: null,   // 선택된 UI(head 라인)
    headFilter: "",  // 좌측 검색어
    itemFilter: "",  // 우측 검색어
    booted: false,   // window load 완료 여부
    gotInit: false   // HANDLE_ON_INIT 수신 여부
};

var oHeadField = null, oItemField = null,
    bBusy = false, oToastTimer = null, oBroad = null,
    bOpenDone = false, iBusyWatch = false, bViewObserved = false;


/* ══════════════════════ 로컬 헬퍼 ══════════════════════ */

// ZMSG_WS_COMMON_001 메시지(원본이 쓰는 유일 클래스). 임의 생성 없음.
function _zmsg(sNo, p1) {
    try { return WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo, (p1 == null ? "" : p1)) || ""; }
    catch (e) { return ""; }
}

function _fileUrl(sPath) {
    try { return encodeURI("file:///" + String(sPath).replace(/\\/g, "/")); }
    catch (e) { return ""; }
}

// 테마 정보(theme_ws4). runtimeClassNav 동일 규약.
function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

// busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트). runtimeClassNav/docPopup 동일 규약.
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("apBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 로드 완료 — 메인 busy lock 해제(opener 의 webContents 'load-finish' 리스너) + 본문 표시(1회만).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { if (iBusyWatch) { clearTimeout(iBusyWatch); } } catch (e) { }
    // opener(index.js) 가 webContents.on('load-finish') 에서 oMainBroad BUSY_OFF + fnSetBusyLock("") 처리.
    try { CURRWIN.webContents.emit("load-finish"); } catch (e) { }
    _setBusy(false);
    var oBody = document.getElementById("apBody");
    if (oBody) { oBody.classList.add("u4aApShown"); }
    try { CURRWIN.show(); } catch (e) { }
}

// 공통 .u4a-toast(화면 정중앙) — 싱글톤 div + data-show + 3초.
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aApToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aApToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}


/* ══════════════════════ SQLite ══════════════════════ */

// SQLite manager 생성(원본 _createSQLiteManager 1:1). 폴더 없으면 읽기 경로는 null(=개인화 없음).
async function _createSqlite(bCreate) {
    var _folder = PATH.join(PATHINFO.P13N_ROOT, "UI_ATTR");

    if (!FS.existsSync(_folder)) {
        if (!bCreate) { return null; }
        try { FS.mkdirSync(_folder, { recursive: true }); } catch (e) { return null; }
    }

    // design/util/sqliteManager.js (ESM default export) — 코드베이스 표준 raw-path dynamic import.
    var _mgrPath = PATH.join(PATHINFO.WS10_20_ROOT, "design", "util", "sqliteManager.js");
    var _mod = await import(_mgrPath);
    var Mgr = _mod.default;

    var _dbPath = PATH.join(_folder, "UI_ATTR_PRESET.db");
    var _db = new Mgr(_dbPath);

    _db.createTable({ tableName: "UI_ATTR_PRESET", columns: DB_COLS, primaryKey: DB_PK });

    return _db;
}

// 개인화 항목 검색(원본 _getUiPresetList 1:1).
async function _getPresetList(oWhere) {
    var _sqlite = await _createSqlite(false);
    if (!_sqlite) { return []; }
    try { return _sqlite.selectData({ tableName: "UI_ATTR_PRESET", where: oWhere }) || []; }
    catch (e) { console.error("[UI_ATTR] selectData 오류:", e); return []; }
}


/* ══════════════════════ 데이터 가공(원본 control.js 1:1) ══════════════════════ */

// 저장된 preset → 좌측 UI 목록(distinct UIOBK → T_0022 조인). (원본 _setHeaderList)
function _buildHead(aPreset) {
    var aHead = [], aSeen = [];
    for (var i = 0; i < aPreset.length; i++) {
        var sUIOBK = aPreset[i].UIOBK;
        if (aSeen.indexOf(sUIOBK) !== -1) { continue; }
        aSeen.push(sUIOBK);

        var s0022 = LIB.T_0022.find(function (o) { return o.UIOBK === sUIOBK; });
        if (!s0022) { continue; }

        aHead.push({
            UIOBK: s0022.UIOBK,
            UIOBJ: s0022.UIOBJ,
            LIBNM: s0022.LIBNM,
            UICON: s0022.UICON,
            ICON_PATH: PATH.join(APPPATH, "icons", (s0022.UICON || "") + ".gif")
        });
    }
    return aHead;
}

// 선택 UI 의 preset → 우측 속성 목록(T_0023 조인). (원본 setItemData)
async function _buildItems(sHead) {
    if (!sHead) { return []; }

    var aPreset = await _getPresetList({
        LIBVER: LIB.LIBVER, SYSID: SYSID, UNAME: USERINFO.ID, UIOBK: sHead.UIOBK
    });
    if (aPreset.length === 0) { return []; }

    var aItems = [];
    for (var i = 0; i < aPreset.length; i++) {
        var sP = aPreset[i];

        // 직접 입력 가능한 AGGR 여부(_1 접미) → T_0023 조회용 원 키로 복원.
        var sLookup = sP.UIATK;
        if (sLookup.endsWith("_1")) { sLookup = sLookup.replace("_1", ""); }

        var s0023 = LIB.T_0023.find(function (o) { return o.UIATK === sLookup; });
        if (!s0023) { continue; }

        aItems.push({
            UIOBK: s0023.UIOBK,
            UIATK: sP.UIATK,
            UIATT: s0023.UIATT,
            UIATV: sP.UIATV,
            UIATY: sP.UIATY,
            UIADT: s0023.UIADT,
            ISMLB: s0023.ISMLB
        });
    }

    // 그룹(UIATY) → UIATK 정렬(원본 _setAttrListSort).
    aItems.sort(function (a, b) {
        var oa = UIATY_ORDER[a.UIATY] || 99, ob = UIATY_ORDER[b.UIATY] || 99;
        if (oa !== ob) { return oa - ob; }
        return (a.UIATK < b.UIATK) ? -1 : (a.UIATK > b.UIATK) ? 1 : 0;
    });

    return aItems;
}

// UIATY → 속성 아이콘(FA). 3(AGGR)은 카디널리티(ISMLB) 분기.
function _attrIcon(sItem) {
    switch (sItem.UIATY) {
        case "1": return "sliders";                                  // property(customize)
        case "2": return "bolt";                                     // event(border)
        case "3": return sItem.ISMLB === "X" ? "cubes" : "fill-drip"; // aggr 0:N / 0:1
        case "4": return "link";                                     // association
        case "6": return "diagram-project";                          // embedded aggregation
        default: return "circle";
    }
}


/* ══════════════════════ 렌더 ══════════════════════ */

function _makeTh(sText, sCls) {
    var oTh = document.createElement("th");
    if (sCls) { oTh.className = sCls; }
    if (sText != null) { oTh.textContent = sText; }
    return oTh;
}

// 좌측 검색 필터(UIOBJ/LIBNM contains).
function _filterHead(aAll) {
    var sQ = (oState.headFilter || "").toLowerCase();
    if (!sQ) { return aAll.slice(); }
    return aAll.filter(function (o) {
        return (o.UIOBJ || "").toLowerCase().indexOf(sQ) !== -1
            || (o.LIBNM || "").toLowerCase().indexOf(sQ) !== -1;
    });
}

// 우측 검색 필터(UIATT/UIADT/UIATV contains).
function _filterItems(aAll) {
    var sQ = (oState.itemFilter || "").toLowerCase();
    if (!sQ) { return aAll.slice(); }
    return aAll.filter(function (o) {
        return (o.UIATT || "").toLowerCase().indexOf(sQ) !== -1
            || (o.UIADT || "").toLowerCase().indexOf(sQ) !== -1
            || (o.UIATV || "").toLowerCase().indexOf(sQ) !== -1;
    });
}

// 좌측 UI 목록 렌더(공통 .u4a-table, 단일 컬럼).
function _renderHead() {
    var oWrap = document.getElementById("apHeadWrap");
    if (!oWrap) { return; }

    var aRows = _filterHead(oState.head);

    var oTable = document.createElement("table");
    oTable.className = "u4a-table u4aApUiTbl";

    var oThead = document.createElement("thead");
    var oTrHead = document.createElement("tr");
    oTrHead.appendChild(_makeTh(_zmsg("190"))); // UI Object
    oThead.appendChild(oTrHead);
    oTable.appendChild(oThead);

    var oTbody = document.createElement("tbody");

    if (aRows.length === 0) {
        var oTrNo = document.createElement("tr");
        oTrNo.className = "u4a-table__nodata";
        var oTdNo = document.createElement("td");
        oTdNo.textContent = _zmsg("946"); // No data
        oTrNo.appendChild(oTdNo);
        oTbody.appendChild(oTrNo);
    } else {
        aRows.forEach(function (oRow, idx) {
            var oTr = document.createElement("tr");
            oTr.setAttribute("data-ap-row", "X");
            oTr.dataset.uiobk = oRow.UIOBK;
            oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";
            oTr.setAttribute("aria-selected", (oState.selHead && oState.selHead.UIOBK === oRow.UIOBK) ? "true" : "false");

            var oTd = document.createElement("td");

            var oCell = document.createElement("div");
            oCell.className = "u4aApUiCell";

            var oImg = document.createElement("img");
            oImg.className = "u4aApUiCell__icon";
            oImg.src = _fileUrl(oRow.ICON_PATH);
            oImg.alt = "";
            oImg.addEventListener("error", function () { this.style.visibility = "hidden"; });

            var oTxt = document.createElement("div");
            oTxt.className = "u4aApUiCell__txt";
            var oName = document.createElement("span");
            oName.className = "u4aApUiCell__name";
            oName.textContent = oRow.UIOBJ || "";
            oName.title = oRow.UIOBJ || "";
            var oLib = document.createElement("span");
            oLib.className = "u4aApUiCell__lib";
            oLib.textContent = oRow.LIBNM || "";
            oLib.title = oRow.LIBNM || "";
            oTxt.appendChild(oName);
            oTxt.appendChild(oLib);

            oCell.appendChild(oImg);
            oCell.appendChild(oTxt);
            oTd.appendChild(oCell);
            oTr.appendChild(oTd);
            oTbody.appendChild(oTr);
        });
    }

    oTable.appendChild(oTbody);
    oWrap.innerHTML = "";
    oWrap.appendChild(oTable);

    // 행 클릭 = 선택 + 우측 속성 로드(원본은 더블클릭이나 HTML5 는 단일클릭 선택-로드가 자연스러움).
    oTbody.addEventListener("click", function (oEvent) {
        var oTr = oEvent.target.closest ? oEvent.target.closest("tr[data-ap-row]") : null;
        if (!oTr) { return; }
        _selectHead(oTr.dataset.uiobk);
    });
}

// 우측: 선택한 UI 헤더 정보 렌더.
function _renderSelHead() {
    var oIcon = document.getElementById("apSelHeadIcon");
    var oName = document.getElementById("apSelHeadName");
    var oLib = document.getElementById("apSelHeadLib");
    var s = oState.selHead;

    if (!s) {
        if (oIcon) { oIcon.hidden = true; }
        if (oName) { oName.textContent = ""; }
        if (oLib) { oLib.textContent = ""; }
        return;
    }
    if (oIcon) { oIcon.hidden = false; oIcon.src = _fileUrl(s.ICON_PATH); }
    if (oName) { oName.textContent = s.UIOBJ || ""; oName.title = s.UIOBJ || ""; }
    if (oLib) { oLib.textContent = s.LIBNM || ""; oLib.title = s.LIBNM || ""; }
}

// 우측 속성 목록 렌더(공통 .u4a-table, 체크박스 + 속성명 + 값. 그룹 헤더 행).
function _renderItems() {
    var oWrap = document.getElementById("apItemWrap");
    if (!oWrap) { return; }

    var aRows = _filterItems(oState.items);

    var oTable = document.createElement("table");
    oTable.className = "u4a-table u4aApTbl";

    // thead — [전체선택 체크] [Attribute 명] [Attribute 값]
    var oThead = document.createElement("thead");
    var oTrHead = document.createElement("tr");

    var oThChk = _makeTh(null, "u4aApChkCol");
    var oChkAll = document.createElement("input");
    oChkAll.type = "checkbox";
    oChkAll.className = "u4aApChk";
    oChkAll.id = "apChkAll";
    oChkAll.title = "";
    oThChk.appendChild(oChkAll);
    oTrHead.appendChild(oThChk);

    oTrHead.appendChild(_makeTh(_zmsg("649"), "u4aApAttrCol")); // Attribute 명
    oTrHead.appendChild(_makeTh(_zmsg("650")));                 // Attribute 값
    oThead.appendChild(oTrHead);
    oTable.appendChild(oThead);

    // tbody
    var oTbody = document.createElement("tbody");

    if (aRows.length === 0) {
        var oTrNo = document.createElement("tr");
        oTrNo.className = "u4a-table__nodata";
        var oTdNo = document.createElement("td");
        oTdNo.colSpan = 3;
        oTdNo.textContent = _zmsg("946");
        oTrNo.appendChild(oTdNo);
        oTbody.appendChild(oTrNo);
    } else {
        var sPrevGrp = null, iData = 0;
        aRows.forEach(function (oRow) {
            // 그룹 헤더 행(UIATY 바뀔 때).
            if (oRow.UIATY !== sPrevGrp) {
                sPrevGrp = oRow.UIATY;
                var oTrG = document.createElement("tr");
                oTrG.className = "u4aApGroup";
                var oTdG = document.createElement("td");
                oTdG.colSpan = 3;
                oTdG.textContent = UIATY_DESC[oRow.UIATY] || "";
                oTrG.appendChild(oTdG);
                oTbody.appendChild(oTrG);
            }

            var oTr = document.createElement("tr");
            oTr.dataset.uiatk = oRow.UIATK;
            oTr.dataset.odd = (iData % 2 === 1) ? "true" : "false";
            iData++;

            // 체크박스 셀
            var oTdChk = document.createElement("td");
            oTdChk.className = "u4aApChkCell";
            var oChk = document.createElement("input");
            oChk.type = "checkbox";
            oChk.className = "u4aApChk u4aApRowChk";
            oChk.dataset.uiatk = oRow.UIATK;
            oTdChk.appendChild(oChk);
            oTr.appendChild(oTdChk);

            // 속성명 셀(아이콘 + UIATT + UIADT)
            var oTdAttr = document.createElement("td");
            oTdAttr.className = "u4aApAttrCol";
            oTdAttr.dataset.label = _zmsg("649");
            var oCell = document.createElement("div");
            oCell.className = "u4aApAttrCell";
            var oIco = document.createElement("i");
            oIco.className = "fa-solid fa-" + _attrIcon(oRow) + " u4aApAttrCell__icon";
            var oTxt = document.createElement("div");
            oTxt.className = "u4aApAttrCell__txt";
            var oNm = document.createElement("span");
            oNm.className = "u4aApAttrCell__name";
            oNm.textContent = oRow.UIATT || "";
            oNm.title = oRow.UIATT || "";
            var oTy = document.createElement("span");
            oTy.className = "u4aApAttrCell__type";
            oTy.textContent = oRow.UIADT || "";
            oTy.title = oRow.UIADT || "";
            oTxt.appendChild(oNm);
            oTxt.appendChild(oTy);
            oCell.appendChild(oIco);
            oCell.appendChild(oTxt);
            oTdAttr.appendChild(oCell);
            oTr.appendChild(oTdAttr);

            // 값 셀(공통 createField readonly)
            var oTdVal = document.createElement("td");
            oTdVal.className = "u4aApValCell";
            oTdVal.dataset.label = _zmsg("650");
            if (window.U4AUI && U4AUI.createField) {
                var oField = U4AUI.createField({ value: oRow.UIATV || "", readOnly: true });
                try { oField.input.title = oRow.UIATV || ""; } catch (e) { }
                oTdVal.appendChild(oField.el);
            } else {
                oTdVal.textContent = oRow.UIATV || "";
            }
            oTr.appendChild(oTdVal);

            oTbody.appendChild(oTr);
        });
    }

    oTable.appendChild(oTbody);
    oWrap.innerHTML = "";
    oWrap.appendChild(oTable);

    // 전체선택 토글.
    oChkAll.addEventListener("change", function () {
        var b = oChkAll.checked;
        var aChk = oTbody.querySelectorAll(".u4aApRowChk");
        for (var i = 0; i < aChk.length; i++) { aChk[i].checked = b; }
    });
    // 개별 체크 변경 → 전체선택 상태 동기화.
    oTbody.addEventListener("change", function (oEvent) {
        if (!oEvent.target.classList || !oEvent.target.classList.contains("u4aApRowChk")) { return; }
        var aChk = oTbody.querySelectorAll(".u4aApRowChk");
        var bAll = aChk.length > 0;
        for (var i = 0; i < aChk.length; i++) { if (!aChk[i].checked) { bAll = false; break; } }
        oChkAll.checked = bAll;
    });

    _applyView();
}

// 좌측 UI 선택 → 우측 속성 로드.
async function _selectHead(sUIOBK) {
    var sHead = oState.head.find(function (o) { return o.UIOBK === sUIOBK; });
    if (!sHead) { return; }

    _setBusy(true);
    try {
        oState.selHead = sHead;
        oState.itemFilter = "";
        if (oItemField) { oItemField.setValue(""); }
        oState.items = await _buildItems(sHead);

        _renderHead();      // 선택 하이라이트 갱신
        _renderSelHead();
        _renderItems();
    } catch (e) {
        console.error("[UI_ATTR] UI 선택 처리 오류:", e);
    } finally {
        _setBusy(false);
    }
}


/* ══════════════════════ 이벤트 ══════════════════════ */

// 레이아웃 초기화(원본 onPressResetLayout) — 스플리터 홈 복귀.
function _onResetLayout() {
    var oLeft = document.getElementById("apLeftPane");
    if (oLeft) {
        oLeft.style.flex = "";                 // CSS 홈(38%) 복귀
        delete oLeft.dataset.u4aSplitHome;     // 더블클릭 복귀 기록 초기화
    }
    var oRight = document.getElementById("apRightPane");
    if (oRight) { oRight.style.flex = ""; delete oRight.dataset.u4aSplitHome; }
}

// 도움말(원본 onPressHelp) — opener 로 U4A Help Document(000278) 요청.
function _onHelp() {
    _setBusy(true);
    try { IPCRENDERER.send("if-attrPresetPopup-" + SYSID, { PRCCD: "U4A_HELP_DOCUMENT", DATA: { startMenuId: "000278" } }); }
    catch (e) { console.error("[UI_ATTR] 도움말 요청 오류:", e); _setBusy(false); }
}

// 삭제(원본 onDeletePresetData/_deletePresetData) — 체크 행 삭제.
async function _onDelete() {
    var oTbody = document.querySelector("#apItemWrap .u4aApTbl tbody");

    // attr 개인화 항목이 존재하지 않는 경우.
    if (!oState.items || oState.items.length === 0) {
        _toast(_zmsg("630"));
        return;
    }

    var aChecked = oTbody ? oTbody.querySelectorAll(".u4aApRowChk:checked") : [];
    if (!aChecked || aChecked.length === 0) {
        _toast(_zmsg("631"));
        return;
    }

    var aUIATK = [], aNames = [];
    for (var i = 0; i < aChecked.length; i++) {
        var sKey = aChecked[i].dataset.uiatk;
        aUIATK.push(sKey);
        var sItem = oState.items.find(function (o) { return o.UIATK === sKey; });
        aNames.push(sItem ? sItem.UIATT : sKey);
    }

    // 상세 목록(최대 10 + 외 N건).
    var aDetail = aNames.slice(0, 10);
    if (aNames.length > 10) { aDetail.push(_zmsg("653", aNames.length - 10)); }

    var sMsg = _zmsg("632", aUIATK.length) + "\n\n" + aDetail.join("\n");

    U4AUI.confirm({
        type: "C",
        title: _zmsg("029"), // Delete
        message: sMsg,
        buttons: [
            { act: "YES", label: _zmsg("029"), emphasized: true },
            { act: "NO", label: "" }
        ],
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            _doDelete(aUIATK);
        }
    });
}

async function _doDelete(aUIATK) {
    _setBusy(true);
    try {
        var _sqlite = await _createSqlite(true);
        if (!_sqlite) { _setBusy(false); return; }

        var sPlaceholders = aUIATK.map(function () { return "?"; }).join(", ");
        _sqlite.execute(
            "DELETE FROM UI_ATTR_PRESET WHERE LIBVER = ? AND SYSID = ? AND UNAME = ? AND UIATK IN (" + sPlaceholders + ")",
            [LIB.LIBVER, SYSID, USERINFO.ID].concat(aUIATK)
        );

        // 메모리 갱신 — 삭제 대상 제외.
        oState.items = oState.items.filter(function (o) { return aUIATK.indexOf(o.UIATK) === -1; });

        var sSelUIOBK = oState.selHead ? oState.selHead.UIOBK : null;

        // 선택 UI 의 항목이 모두 삭제된 경우 → 좌측에서 제거 후 인접 선택.
        if (oState.items.length === 0 && sSelUIOBK) {
            var iPos = oState.head.findIndex(function (o) { return o.UIOBK === sSelUIOBK; });
            if (iPos !== -1) { oState.head.splice(iPos, 1); }
            iPos = Math.max(iPos - 1, 0);
            oState.selHead = oState.head[iPos] || null;
        }

        _renderHead();
        _renderSelHead();

        // 새 선택 UI 가 있으면 그 항목 다시 로드, 없으면 우측 비움.
        if (oState.selHead) {
            oState.items = await _buildItems(oState.selHead);
        } else {
            oState.items = [];
        }
        _renderItems();

        _toast(_zmsg("633")); // 삭제 완료
    } catch (e) {
        console.error("[UI_ATTR] 삭제 처리 오류:", e);
    } finally {
        _setBusy(false);
    }
}

// ── XOR 난독화(원본 control.js 1:1) ──
function _bufferFrom(value, encoding) {
    return Buffer.from ? Buffer.from(value, encoding) : new Buffer(value, encoding);
}
function _bufferToHex(buffer) { return buffer.toString("hex").toUpperCase(); }
function _xorBuffer(buffer, key) {
    var keyBuffer = _bufferFrom(key, "utf8");
    var result = Buffer.alloc ? Buffer.alloc(buffer.length) : new Buffer(buffer.length);
    for (var i = 0; i < buffer.length; i++) { result[i] = buffer[i] ^ keyBuffer[i % keyBuffer.length]; }
    return result;
}

// 다운로드(원본 onDownloadPresetData).
async function _onDownload() {
    _setBusy(true);
    try {
        var aPreset = await _getPresetList({ LIBVER: LIB.LIBVER, SYSID: SYSID, UNAME: USERINFO.ID });

        if (aPreset.length === 0) {
            _toast(_zmsg("634")); // 다운로드할 개인화 정보 없음
            _setBusy(false);
            return;
        }

        var oRes = await REMOTE.dialog.showOpenDialog(CURRWIN, {
            title: _zmsg("635"),                 // 다운로드 경로를 지정하십시오
            properties: ["openDirectory"]
        });

        if (oRes.canceled || !oRes.filePaths || !oRes.filePaths[0]) {
            _toast(_zmsg("636"));                // 다운로드 취소
            _setBusy(false);
            return;
        }

        var sDownloadPath = PATH.join(oRes.filePaths[0], "UI_ATTR_PRESET.dat");

        var sJson = JSON.stringify(aPreset);
        var oJsonBuf = _bufferFrom(sJson, "utf8");
        var oEnc = _xorBuffer(oJsonBuf, C_OBF_KEY);
        var sHex = _bufferToHex(oEnc);

        try { FS.writeFileSync(sDownloadPath, sHex, "utf8"); }
        catch (e) {
            console.error("[UI_ATTR] 다운로드 저장 오류:", e);
            U4AUI.confirm({ type: "E", title: _zmsg("652"), message: _zmsg("637"), buttons: [{ act: "YES", label: "" }] });
            _setBusy(false);
            return;
        }

        _toast(_zmsg("638")); // 다운로드 완료
        _setBusy(false);

        try { require("electron").shell.showItemInFolder(sDownloadPath); } catch (e) { }
    } catch (e) {
        console.error("[UI_ATTR] 다운로드 오류:", e);
        _setBusy(false);
    }
}

// 업로드(원본 onUploadPresetData).
async function _onUpload() {
    _setBusy(true);
    try {
        var oRes = await REMOTE.dialog.showOpenDialog(CURRWIN, {
            title: _zmsg("639"),                 // 업로드할 파일 선택
            filters: [{ name: "Data Files", extensions: ["dat"] }],
            properties: ["openFile"]
        });

        if (oRes.canceled || !oRes.filePaths || !oRes.filePaths[0]) {
            _toast(_zmsg("640"));                // 업로드 취소
            _setBusy(false);
            return;
        }

        var sHex;
        try { sHex = FS.readFileSync(oRes.filePaths[0], "utf8"); }
        catch (e) { _toast(_zmsg("641")); _setBusy(false); return; }

        var oEnc = _bufferFrom(sHex, "hex");
        var oJsonBuf = _xorBuffer(oEnc, C_OBF_KEY);
        var sJson = oJsonBuf.toString("utf8");

        var aPreset;
        try { aPreset = JSON.parse(sJson); }
        catch (e) { _toast(_zmsg("642")); _setBusy(false); return; } // 형식 오류

        var _sqlite = await _createSqlite(true);
        if (!_sqlite) { _setBusy(false); return; }

        _sqlite.upsertData({ tableName: "UI_ATTR_PRESET", data: aPreset });

        _toast(_zmsg("643")); // 업로드 완료

        await _loadData();
        _setBusy(false);
    } catch (e) {
        console.error("[UI_ATTR] 업로드 오류:", e);
        _setBusy(false);
    }
}


/* ══════════════════════ 데이터 로드 ══════════════════════ */

// 전체 목록 구성(원본 setTableData + 첫 라인 선택).
async function _loadData() {
    oState.head = [];
    oState.items = [];
    oState.selHead = null;

    var aPreset = await _getPresetList({ LIBVER: LIB.LIBVER, SYSID: SYSID, UNAME: USERINFO.ID });
    oState.head = _buildHead(aPreset);

    _renderHead();

    // 첫 UI 자동 선택.
    if (oState.head.length > 0) {
        await _selectHead(oState.head[0].UIOBK);
    } else {
        _renderSelHead();
        _renderItems();
    }
}


/* ══════════════════════ 반응형(우측 테이블 table↔card) ══════════════════════ */

function _applyView() {
    var oWrap = document.getElementById("apItemWrap");
    if (!oWrap || !oWrap.isConnected) { return; }
    var iW = oWrap.getBoundingClientRect().width;
    if (!iW) { return; }
    // 카드뷰 CSS 는 공통 `.u4a-table-wrap[data-view]` 를 대상으로 하므로 wrap 에 세팅.
    var sView = (iW < CARD_VIEW_MAX) ? "card" : "table";
    if (oWrap.dataset.view !== sView) { oWrap.dataset.view = sView; }
}
function _observeView() {
    var oWrap = document.getElementById("apItemWrap");
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


/* ══════════════════════ 가로 스플리터 드래그 ══════════════════════ */

function _bindSplitH(oBar) {
    var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0;
    function lf_move(e) {
        if (!bDrag) { return; }
        var oSplit = oBar.parentNode;
        var a = iAStart + (e.clientX - iStart);
        var am = 200; // 원본 minSize 200
        var maxA = oSplit.clientWidth - oBar.getBoundingClientRect().width - 200;
        if (a < am) { a = am; }
        if (a > maxA) { a = maxA; }
        oA.style.flex = "0 0 " + a + "px";
    }
    function lf_up() {
        bDrag = false;
        document.body.classList.remove("u4aApResizing");
        document.removeEventListener("mousemove", lf_move);
        document.removeEventListener("mouseup", lf_up);
    }
    oBar.addEventListener("mousedown", function (e) {
        oA = oBar.previousElementSibling; oB = oBar.nextElementSibling;
        if (!oA || !oB) { return; }
        bDrag = true;
        iStart = e.clientX;
        iAStart = oA.getBoundingClientRect().width;
        document.body.classList.add("u4aApResizing");
        document.addEventListener("mousemove", lf_move);
        document.addEventListener("mouseup", lf_up);
        e.preventDefault();
    });
}


/* ══════════════════════ 크롬(타이틀바/툴바/검색) 초기화 ══════════════════════ */

function _initChrome() {
    // 로고.
    var oLogo = document.getElementById("apLogo");
    if (oLogo) { oLogo.src = _fileUrl(PATH.join(APPPATH, "img", "logo.png")); }

    // 제목(652).
    var oTitle = document.getElementById("apTitle");
    var sTitle = "";
    try { sTitle = document.title || CURRWIN.getTitle() || ""; } catch (e) { sTitle = document.title || ""; }
    if (!sTitle) { sTitle = _zmsg("652"); }
    if (oTitle) { oTitle.textContent = sTitle; }

    // 창 버튼(min/max/close).
    var oMin = document.getElementById("apWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }
    var oMax = document.getElementById("apWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }
    var oClose = document.querySelector('#apTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

    // 상단 툴바 버튼/라벨.
    var oReset = document.getElementById("apResetBtn");
    if (oReset) {
        oReset.title = _zmsg("655");
        var oRT = document.getElementById("apResetTxt"); if (oRT) { oRT.textContent = _zmsg("655"); }
        oReset.addEventListener("click", _onResetLayout);
    }
    var oDown = document.getElementById("apDownloadBtn");
    if (oDown) {
        oDown.title = _zmsg("644");
        var oDT = document.getElementById("apDownloadTxt"); if (oDT) { oDT.textContent = _zmsg("644"); }
        oDown.addEventListener("click", _onDownload);
    }
    var oUp = document.getElementById("apUploadBtn");
    if (oUp) {
        oUp.title = _zmsg("645");
        var oUT = document.getElementById("apUploadTxt"); if (oUT) { oUT.textContent = _zmsg("645"); }
        oUp.addEventListener("click", _onUpload);
    }
    var oHelp = document.getElementById("apHelpBtn");
    if (oHelp) { oHelp.addEventListener("click", _onHelp); }

    // 삭제 버튼.
    var oDel = document.getElementById("apDeleteBtn");
    if (oDel) {
        oDel.title = _zmsg("029");
        var oDelT = document.getElementById("apDeleteTxt"); if (oDelT) { oDelT.textContent = _zmsg("029"); }
        oDel.addEventListener("click", _onDelete);
    }

    // 좌측 검색 라벨/입력칸(원본 646/647).
    var oHeadLabel = document.getElementById("apHeadSrchLabel");
    if (oHeadLabel) { oHeadLabel.textContent = _zmsg("646"); }
    var oHeadHost = document.getElementById("apHeadSrchField");
    if (oHeadHost && window.U4AUI) {
        oHeadField = U4AUI.createField({
            placeholder: _zmsg("647"),
            clear: true,
            onInput: function (v) { oState.headFilter = v; _renderHead(); },
            onClear: function () { oState.headFilter = ""; _renderHead(); }
        });
        oHeadHost.appendChild(oHeadField.el);
    }

    // 우측 검색 입력칸(원본 648).
    var oItemHost = document.getElementById("apItemSrchField");
    if (oItemHost && window.U4AUI) {
        oItemField = U4AUI.createField({
            placeholder: _zmsg("648"),
            clear: true,
            onInput: function (v) { oState.itemFilter = v; _renderItems(); },
            onClear: function () { oState.itemFilter = ""; _renderItems(); }
        });
        oItemHost.appendChild(oItemField.el);
    }

    // 스플리터 드래그.
    var oBar = document.getElementById("apSplitBar");
    if (oBar) { _bindSplitH(oBar); }
}


/* ══════════════════════ 브로드캐스트 / IPC ══════════════════════ */

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

// 라이브 테마 변경(원본 _onIpcMain_if_p13n_themeChange). runtimeClassNav 동일.
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

// 메인(opener) → 팝업 통신(원본 _onIpcRender_if_attrPresetPopup).
async function _onIpcRender(events, data) {
    switch (data && data.PRCCD) {
        case "ATTR_CHANGE":
            // 메인에서 속성 개인화 발생 → 목록 새로고침.
            _setBusy(true);
            try { await _loadData(); } catch (e) { console.error("[UI_ATTR] ATTR_CHANGE 갱신 오류:", e); }
            _setBusy(false);
            try { CURRWIN.show(); } catch (e) { }
            break;

        case "U4A_HELP_DOCUMENT_OPEN":
            _setBusy(false);
            break;

        default:
            break;
    }
}

function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}


/* ══════════════════════ 부트 ══════════════════════ */

async function _onload() {
    try { CURRWIN.setMenu(null); } catch (e) { }

    _setBusy(true);

    _initChrome();
    _initBroadcast();

    // 데이터 도착 전 빈 테이블 1회 렌더(헤더 노출).
    _renderHead();
    _renderItems();
    _observeView();

    IPCRENDERER.on("if-attrPresetPopup-" + SYSID, _onIpcRender);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 데이터 로드 → 렌더 → 로드 완료.
    try {
        await _loadData();
    } catch (e) {
        console.error("[UI_ATTR] 초기 데이터 로드 오류:", e);
    }

    _observeView();
    _finishOpen();
}

// opener did-finish-load → HANDLE_ON_INIT(oLibData + oThemeInfo) 수신.
function _ipcHandleOnInit(events, oInfo) {
    if (oState.gotInit) { return; }
    oState.gotInit = true;

    LIB = oInfo && oInfo.oLibData ? oInfo.oLibData : LIB;
    oThemeInfo = oInfo && oInfo.oThemeInfo ? oInfo.oThemeInfo : null;

    // 테마 재적용(첫 페인트 sync 보정).
    try { if (oThemeInfo && oThemeInfo.THEME && window.U4ATheme) { U4ATheme.apply(oThemeInfo.THEME); } } catch (e) { }

    if (document.readyState === "loading") {
        window.addEventListener("load", _onload);
    } else {
        _onload();
    }
}

IPCRENDERER.once("HANDLE_ON_INIT", _ipcHandleOnInit);

// 안전판 — HANDLE_ON_INIT 가 안 오면 busy 강제 해제(원본 동작엔 없던 방어).
iBusyWatch = setTimeout(function () {
    if (oState.gotInit) { return; }
    console.error("[HTML5][attrPresetPopup] 초기화 정보 수신 지연 — busy 강제 해제");
    try { CURRWIN.show(); } catch (e) { }
    _finishOpen();
}, 20000);


/* ══════════════════════ 종료 ══════════════════════ */

// busy 중 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("resize", _applyView);
    try { IPCRENDERER.removeListener("if-attrPresetPopup-" + SYSID, _onIpcRender); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
