/****************************************************************************
 * Find(찾기) 창 로직 (findFrame.js)
 * --------------------------------------------------------------------------
 *  원본: Popups/findPopup (UI5 별도창 2단 iframe: frame.html→frame.js→index.html→index.js,
 *        sap.tnt.ToolPage = 좌 SideNavigation(M001~M005) + 우 NavContainer(메뉴별 테이블)).
 *  HTML5: runtimeClassNavigator 와 동일한 1단 frameless 창 — 최상위 문서에
 *  [공통 .u4a-titlebar + 좌 네비 + 우 모드 콘텐츠(공통 .u4a-table)] 를 직접 둔다.
 *
 *  ★ 원본 보존(1:1, index.js / shortcutWhereUsed 기준):
 *   · 모수 = if-find-info 로 받은 aAttrData(변경 속성) + aServEvtData(서버 이벤트) + aT_0022.
 *   · 모드/데이터 파생:
 *       M001 UI Where to Use the Event   : UIATY=="2" && UIATV!="" (EVTXT=서버이벤트 DESC)
 *       M002 Model Binding Usage For UI  : 좌 UIATY=="1"&&ISBND=="X" / 우 UIATY=="3"
 *       M003 CSS Style Class Where to Use: UIATT=="styleClass"
 *       M004 Event JS Where to Use       : ADDSC=="JS"&&UIATY=="2" (LIBNM=T_0022 매핑)
 *       M005 단축키 등록 이벤트 사용처    : UIATY=="2"&&SHCUT!="" (HOTKEY=SHCUT.SCKEY) — 패치 3.5.7-4+ 만.
 *   · 각 테이블 검색(contains, 원본 SearchField 필터 필드 동일), 링크 클릭 → IPC:
 *       ${BROWSKEY}--find            (row) : 트리 선택(→ --find--success 로 busy 해제)
 *       ${BROWSKEY}--find--controller(row) : 컨트롤러(클래스빌더) 실행(원본 3초 후 busy 해제)
 *   · 새로고침(원본 App header refresh) → ${BROWSKEY}--find--data--refresh → callback 재수집.
 *   · M005 도움말 = shortcutWhereUsed/helpDoc/<LANGU>/index.html 을 모달(iframe)로 표시.
 *  ★ UI5 의존부 치환: sap.tnt.ToolPage→좌네비+메인카드, sap.m.Table→공통 .u4a-table,
 *     sap.m.SearchField→U4AUI.createField, ResponsiveSplitter→공통 .u4a-splitter,
 *     sap.m.Dialog(도움말)→공통 .u4a-dialog, applyTheme→U4ATheme.apply(라이브 추종).
 *
 *  ※ var 선언(에디터 호스트/타 프레임 시리즈와 동일 컨벤션).
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

// 반응형 카드 전환 폭(px) — 이보다 좁으면 행을 카드로(공통 .u4a-table-wrap[data-view]). Chromium93 컨테이너쿼리 미지원.
var CARD_VIEW_MAX = 560;

// ── 상태 ─────────────────────────────────────────────────────────────────
var oData = { attr: [], serv: [], t0022: [], user: null, theme: null };
var oSearch = {};      // paneId → 검색어(모드 전환/새로고침에도 보존)
var aModes = [];       // 현재 메뉴(모드) 정의 배열
var oState = { mode: "M001", gotInfo: false };
var oCurrent = null;   // { mode, ctx:[{def,wrapEl,field}] }

var bBusy = false, bOpenDone = false, iBusyWatch = null, oBroad = null;

// ── 로컬 헬퍼 ──────────────────────────────────────────────────────────────
function _el(sTag, sCls, sText) {
    var o = document.createElement(sTag);
    if (sCls) { o.className = sCls; }
    if (sText != null) { o.textContent = sText; }
    return o;
}
function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
function _iEl(s) { var i = document.createElement("i"); i.className = "fa-solid fa-" + s; return i; }

// /U4A/CL_WS_COMMON (C49/D03 등).
function _c(sCode) {
    try { return WSMSG.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, "", "", "", ""); }
    catch (e) { return ""; }
}
// ZMSG_WS_COMMON_001 (479/478/946 등 — M005 라벨·no-data). versionMng/runtimeClassNav 선례.
function _z(sNo) {
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

// busy(로딩 오버레이 + 닫기 차단 + 자식창/메인 브로드캐스트). runtimeClassNavigator 동일 규약.
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("findBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    try { CURRWIN.closable = false; } catch (e) { }   // 닫기는 닫기버튼(공통 closeWindow)으로만
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 로드 완료 — 메인 busy lock 해제 + 자식창 BUSY_OFF + 본문 표시(1회만). runtimeClassNav 동일.
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    var oBody = document.getElementById("findBody");
    if (oBody) { oBody.classList.add("u4aFindShown"); }
}

// ── 데이터 접근 ─────────────────────────────────────────────────────────────
function _attr() { return oData.attr || []; }
function _serv() { return oData.serv || []; }
function _t0022() { return oData.t0022 || []; }

// M005(단축키 사용처) 활성 여부 — WS Patch 3.5.7-4(UHAK901289) 존재 서버만(원본 fnGetFindMenuList).
function _allowM5() {
    try {
        var oMeta = oData.user && oData.user.META;
        var aWlo = oMeta && oMeta.T_REG_WLO;
        if (!Array.isArray(aWlo)) { return false; }
        return aWlo.findIndex(function (it) { return it.REGTYP === "C" && it.CHGOBJ === "UHAK901289"; }) !== -1;
    } catch (e) { return false; }
}

// M002 좌측 Binding Field — UIATV 를 '-' 로 나눈 마지막 조각(원본 formatter 1:1).
function _bindingField(row) {
    var v = row.UIATV;
    if (v == null) { return ""; }
    v = String(v);
    if (v.indexOf("-") < 0) { return ""; }
    var a = v.split("-");
    return a[a.length - 1];
}

// ── 데이터 파생(원본 index.js fnGetFindData1~4 / shortcutWhereUsed _setShortcutList 1:1) ──
function _deriveM1() {
    var a = _attr(); if (!a.length) { return []; }
    var ev = _serv();
    return a.filter(function (e) { return e.UIATY == "2" && e.UIATV != ""; }).map(function (o) {
        var r = Object.assign({}, o);
        var m = ev.find(function (x) { return x.KEY == r.UIATV; });
        if (m) { r.EVTXT = m.DESC; }
        return r;
    });
}
function _deriveM2L() {
    var a = _attr(); if (!a.length) { return []; }
    return a.filter(function (e) { return e.UIATY == "1" && e.ISBND == "X"; });
}
function _deriveM2R() {
    var a = _attr(); if (!a.length) { return []; }
    return a.filter(function (e) { return e.UIATY == "3"; });
}
function _deriveM3() {
    var a = _attr(); if (!a.length) { return []; }
    return a.filter(function (e) { return e.UIATT == "styleClass"; });
}
function _deriveM4() {
    var a = _attr(); if (!a.length) { return []; }
    var t = _t0022();
    return a.filter(function (e) { return e.ADDSC == "JS" && e.UIATY == "2"; }).map(function (o) {
        var r = Object.assign({}, o);
        var u = t.find(function (x) { return x.UIOBK == r.UIOBK; });
        if (u) { r.LIBNM = u.LIBNM; }
        return r;
    });
}
function _deriveM5() {
    var a = _attr(); if (!a.length) { return []; }
    var ev = _serv();
    var aList = a.filter(function (e) { return e.UIATY == "2" && e.SHCUT != null && e.SHCUT !== ""; });
    var aOut = [];
    aList.forEach(function (o) {
        var r = { HOTKEY: "", UIATV: o.UIATV || "", UIATT: o.UIATT || "", OBJID: o.OBJID || "", EVTXT: "" };
        try { var sc = JSON.parse(o.SHCUT); r.HOTKEY = sc.SCKEY || ""; } catch (e) { r.HOTKEY = ""; }
        var m = ev.find(function (x) { return x.KEY == r.UIATV; });
        r.EVTXT = (m && m.DESC) || "";
        aOut.push(r);
    });
    return aOut;
}

// ── 모드(메뉴) 정의 — 원본 컬럼/라벨/검색필드/링크 대상 1:1 ────────────────────
function _buildModes() {
    var M = [];

    // M001 — UI Where to Use the Event
    M.push({
        key: "M001", title: _c("D03"),
        panes: [{
            id: "M001", deriveFn: _deriveM1, search: ["UIATV", "EVTXT", "UIATT", "OBJID"],
            cols: [
                { label: _c("C49"), field: "UIATV", link: "controller" }, // Event ID
                { label: _c("C52"), field: "EVTXT" },                       // Event Text
                { label: _c("C50"), field: "UIATT", link: "find" },        // Event Target Properties
                { label: _c("C51"), field: "OBJID" }                        // UI OBJ ID
            ]
        }]
    });

    // M002 — Model Binding Usage For UI (좌우 분할)
    M.push({
        key: "M002", title: _c("D04"), split: true,
        panes: [
            {
                id: "M002L", head: _c("D07"), headIcon: "list", deriveFn: _deriveM2L,
                search: ["OBJID", "UIATT", "UIATV", "UIADT"],
                cols: [
                    { label: _c("C53"), field: "OBJID", link: "find" }, // UI ID
                    { label: _c("C54"), field: "UIATT" },               // UI Attribute ID
                    { label: _c("C57"), field: "UIATV" },               // Model full Path
                    { label: _c("C55"), field: _bindingField },         // Binding Field
                    { label: _c("C56"), field: "UIADT" }                // Data Type
                ]
            },
            {
                id: "M002R", head: _c("D08"), headIcon: "list", deriveFn: _deriveM2R,
                search: ["OBJID", "UIATT", "UIATV"],
                cols: [
                    { label: _c("C53"), field: "OBJID", link: "find" }, // UI ID
                    { label: _c("C58"), field: "UIATT" },               // Aggregations ID
                    { label: _c("C59"), field: "UIATV" }                // Binding Model
                ]
            }
        ]
    });

    // M003 — CSS Style Class Where to Use
    M.push({
        key: "M003", title: _c("D05"),
        panes: [{
            id: "M003", deriveFn: _deriveM3, search: ["OBJID", "UIATV"],
            cols: [
                { label: _c("C51"), field: "OBJID", link: "find" }, // UI OBJ ID
                { label: _c("C60"), field: "UIATV" }                // Style Class Name
            ]
        }]
    });

    // M004 — Event JS Where to Use
    M.push({
        key: "M004", title: _c("D06"),
        panes: [{
            id: "M004", deriveFn: _deriveM4, search: ["OBJID", "UIATT", "LIBNM"],
            cols: [
                { label: _c("C51"), field: "OBJID", link: "find" }, // UI OBJ ID
                { label: _c("C61"), field: "UIATT" },               // UI Event Name
                { label: _c("C62"), field: "LIBNM" }                // UI Class
            ]
        }]
    });

    // M005 — 단축키 등록 이벤트 사용처(조건부)
    if (_allowM5()) {
        M.push({
            key: "M005", title: _z("478"),
            panes: [{
                id: "M005", help: true, deriveFn: _deriveM5, search: ["HOTKEY", "UIATV", "EVTXT", "UIATT", "OBJID"],
                cols: [
                    { label: _z("479"), field: "HOTKEY" },              // 단축키
                    { label: _z("480"), field: "UIATT", link: "find" }, // 대상 이벤트 속성
                    { label: _z("481"), field: "UIATV", link: "controller" }, // 이벤트 ID
                    { label: _z("482"), field: "EVTXT" },               // 이벤트 텍스트
                    { label: _z("190"), field: "OBJID" }                // UI 오브젝트 ID
                ]
            }]
        });
    }

    return M;
}

function _findMode(sKey) {
    for (var i = 0; i < aModes.length; i++) { if (aModes[i].key === sKey) { return aModes[i]; } }
    return null;
}

// ── 좌측 네비 렌더(원본 SideNavigation) ─────────────────────────────────────
function _renderNav() {
    var oNav = document.getElementById("findNav");
    if (!oNav) { return; }
    oNav.innerHTML = "";
    aModes.forEach(function (m) {
        var oBtn = _el("button", "u4aFindNav__item");
        oBtn.type = "button";
        oBtn.setAttribute("data-mode", m.key);
        oBtn.setAttribute("aria-selected", (m.key === oState.mode) ? "true" : "false");
        oBtn.appendChild(_el("span", null, m.title));
        oBtn.addEventListener("click", function () {
            if (bBusy || m.key === oState.mode) { return; }
            _renderMode(m);
        });
        oNav.appendChild(oBtn);
    });
}
function _updateNavSelection() {
    var oNav = document.getElementById("findNav");
    if (!oNav) { return; }
    Array.prototype.forEach.call(oNav.querySelectorAll(".u4aFindNav__item"), function (b) {
        b.setAttribute("aria-selected", (b.getAttribute("data-mode") === oState.mode) ? "true" : "false");
    });
}

// ── 모드 렌더(원본 NavContainer 페이지 전환) ────────────────────────────────
function _renderMode(oMode) {
    oState.mode = oMode.key;
    _updateNavSelection();

    var oMain = document.getElementById("findMain");
    if (!oMain) { return; }
    oMain.innerHTML = "";

    // 본문(단일/좌우 분할). 제목은 좌 네비 하이라이트로 표시(중복 밴드 제거).
    //   새로고침(전역)은 마지막(=단일 팬 또는 M002 우측 팬) 툴바 우측에 1회 배치.
    var aCtx = [];
    var oBody = _el("div", "u4aFindMode");
    if (oMode.split) {
        oBody.classList.add("u4a-splitter");
        var oPaneL = _buildPane(oMode.panes[0], aCtx, false);
        oPaneL.classList.add("u4a-splitter__pane");
        var oBar = _el("div", "u4a-splitter__bar");
        var oPaneR = _buildPane(oMode.panes[1], aCtx, true);
        oPaneR.classList.add("u4a-splitter__pane");
        oBody.appendChild(oPaneL);
        oBody.appendChild(oBar);
        oBody.appendChild(oPaneR);
    } else {
        oBody.appendChild(_buildPane(oMode.panes[0], aCtx, true));
    }
    oMain.appendChild(oBody);

    oCurrent = { mode: oMode, ctx: aCtx };

    if (oMode.split) { _wireSplit(oBody); }

    aCtx.forEach(function (c) { _renderTableInto(c); _observeWrap(c.wrapEl); });
}

// 팬(검색툴바 + 테이블) 1개 생성 — aCtx 에 컨텍스트 push.
//   툴바 = [M002 라벨] [검색(폭 채움)] [도움말(M005)] [새로고침(bRefresh)]. 우측 액션 아이콘.
function _buildPane(oPaneDef, aCtx, bRefresh) {
    var oPane = _el("div", "u4aFindPane");

    var oTb = _el("div", "u4aFindPane__toolbar");

    // M002 좌/우 라벨(원본 아이콘+텍스트: Properties/Aggregations).
    if (oPaneDef.head) {
        var oLbl = _el("span", "u4aFindPane__headlabel");
        if (oPaneDef.headIcon) { oLbl.appendChild(_iEl(oPaneDef.headIcon)); }
        oLbl.appendChild(_el("span", null, oPaneDef.head));
        oTb.appendChild(oLbl);
    }

    var oSrchHost = _el("div", "u4aFindSearch");
    oTb.appendChild(oSrchHost);

    // 도움말(M005) — 우측(원본 shortcutWhereUsed 테이블 툴바 Help 버튼).
    if (oPaneDef.help) {
        var oHelpBtn = _el("button", "u4a-btn-icon");
        oHelpBtn.type = "button";
        oHelpBtn.innerHTML = _fa("circle-question");
        oHelpBtn.title = _z("198"); // 도움말
        oHelpBtn.addEventListener("click", _openHelp);
        oTb.appendChild(oHelpBtn);
    }

    // 새로고침(전역, 원본 App header refresh) — 마지막 팬 툴바 최우측.
    if (bRefresh) {
        var oRefreshBtn = _el("button", "u4a-btn-icon");
        oRefreshBtn.type = "button";
        oRefreshBtn.innerHTML = _fa("rotate-right");
        oRefreshBtn.addEventListener("click", _doRefresh);
        oTb.appendChild(oRefreshBtn);
    }

    // 테이블 래퍼(공통 .u4a-table-wrap — 프레임은 카드가 담당, 반응형 data-view).
    var oWrap = _el("div", "u4aFindWrap u4a-table-wrap");

    var oCtx = { def: oPaneDef, wrapEl: oWrap, field: null };

    if (window.U4AUI) {
        oCtx.field = U4AUI.createField({
            type: "text",
            clear: true,
            placeholder: _c("A75"), // Search
            value: oSearch[oPaneDef.id] || "",
            onInput: function (v) { oSearch[oPaneDef.id] = v; _renderTableInto(oCtx); },
            onEnter: function (v) { oSearch[oPaneDef.id] = v; _renderTableInto(oCtx); },
            onClear: function () { oSearch[oPaneDef.id] = ""; _renderTableInto(oCtx); }
        });
        oSrchHost.appendChild(oCtx.field.el);
    }

    oPane.appendChild(oTb);
    oPane.appendChild(oWrap);

    aCtx.push(oCtx);
    return oPane;
}

// ── 테이블 렌더(공통 .u4a-table 소비) ──────────────────────────────────────
function _renderTableInto(oCtx) {
    var oDef = oCtx.def;
    var aRows = [];
    try { aRows = oDef.deriveFn() || []; } catch (e) { aRows = []; }

    // 검색 필터(contains, 대소문자 무시 — 원본 SearchField 필터 필드 동일).
    var sQ = (oSearch[oDef.id] || "").toLowerCase();
    if (sQ) {
        aRows = aRows.filter(function (r) {
            for (var i = 0; i < oDef.search.length; i++) {
                var v = r[oDef.search[i]];
                if (v != null && String(v).toLowerCase().indexOf(sQ) !== -1) { return true; }
            }
            return false;
        });
    }

    var oTable = _renderTable(oDef.cols, aRows);
    oCtx.wrapEl.innerHTML = "";
    oCtx.wrapEl.appendChild(oTable);
}

function _renderTable(aCols, aRows) {
    var oTable = _el("table", "u4a-table u4aFindTbl");

    var oThead = _el("thead");
    var oTrHead = _el("tr");
    aCols.forEach(function (c) { oTrHead.appendChild(_el("th", null, c.label)); });
    oThead.appendChild(oTrHead);
    oTable.appendChild(oThead);

    var oTbody = _el("tbody");
    if (!aRows.length) {
        var oTrNo = _el("tr", "u4a-table__nodata");
        var oTdNo = _el("td", null, _z("946")); // No data(공통 no-data 키)
        oTdNo.colSpan = aCols.length;
        oTrNo.appendChild(oTdNo);
        oTbody.appendChild(oTrNo);
    } else {
        aRows.forEach(function (oRow, idx) {
            var oTr = _el("tr");
            oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";
            aCols.forEach(function (c) {
                var oTd = _el("td");
                oTd.dataset.label = c.label; // 카드뷰 라벨
                var val = (typeof c.field === "function") ? c.field(oRow) : oRow[c.field];
                val = (val == null) ? "" : String(val);
                if (c.link) {
                    var oLink = _el("span", "u4aFindLink", val);
                    oLink.setAttribute("role", "link");
                    oLink.tabIndex = 0;
                    oLink.addEventListener("click", function () { _onLink(c.link, oRow); });
                    oLink.addEventListener("keydown", function (e) {
                        if (e.repeat) { return; }
                        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                            e.preventDefault(); _onLink(c.link, oRow);
                        }
                    });
                    oTd.appendChild(oLink);
                } else {
                    oTd.textContent = val;
                }
                oTr.appendChild(oTd);
            });
            oTbody.appendChild(oTr);
        });
    }
    oTable.appendChild(oTbody);
    return oTable;
}

// ── 링크 클릭 → 메인으로 IPC(원본 ev_press_Link_Find / _Controller 1:1) ──────
function _onLink(sType, oRow) {
    if (bBusy) { return; }
    if (sType === "controller") {
        // 컨트롤러(클래스빌더) 실행 — 완료 이벤트가 없어 원본대로 3초 후 busy 해제.
        _setBusy(true);
        try { IPCRENDERER.send(BROWSKEY + "--find--controller", oRow); } catch (e) { }
        setTimeout(function () { _setBusy(false); }, 3000);
    } else {
        // 트리 선택 — 메인이 완료 시 --find--success 로 busy 해제(가짜 타이머 금지).
        _setBusy(true);
        try { IPCRENDERER.send(BROWSKEY + "--find", oRow); } catch (e) { }
    }
}

// 메인 → 창: 트리 선택 완료(원본 --find--success).
function _onFindSuccess() {
    _setBusy(false);
}

// ── 스플리터 드래그 리사이즈 — 공통 .u4a-splitter__bar 소비(외곽 네비|메인 + M002 좌|우) ──
//   바의 직계 형제(previousElementSibling)를 좌측 팬으로 리사이즈. :scope> 로 자기 바만 잡아
//   중첩 스플리터(메인 안 M002)와 섞이지 않게 한다. 더블클릭 최초폭 복귀는 공통 전역 자동.
function _wireSplit(oSplit) {
    var oBar = oSplit.querySelector(":scope > .u4a-splitter__bar");
    if (!oBar) { return; }
    var oLeft = oBar.previousElementSibling;
    if (!oLeft) { return; }

    oBar.addEventListener("mousedown", function (e) {
        if (e.button !== 0) { return; }
        e.preventDefault();
        var iStartX = e.clientX;
        var iStartW = oLeft.getBoundingClientRect().width;
        var iTotal = oSplit.getBoundingClientRect().width;
        var iMin = 120;

        function onMove(ev) {
            var w = iStartW + (ev.clientX - iStartX);
            if (w < iMin) { w = iMin; }
            if (w > iTotal - iMin - 11) { w = iTotal - iMin - 11; }
            oLeft.style.flex = "0 0 " + w + "px";
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}

// ── 반응형 table↔card(ResizeObserver→data-view) ────────────────────────────
function _applyWrapView(oWrap) {
    if (!oWrap || !oWrap.isConnected) { return; }
    var iW = oWrap.getBoundingClientRect().width;
    if (!iW) { return; }
    var sView = (iW < CARD_VIEW_MAX) ? "card" : "table";
    if (oWrap.dataset.view !== sView) { oWrap.dataset.view = sView; }
}
function _observeWrap(oWrap) {
    _applyWrapView(oWrap);
    if (typeof ResizeObserver === "undefined") { return; }
    var bSched = false;
    var oRO = new ResizeObserver(function () {
        if (bSched) { return; }
        bSched = true;
        var fnRAF = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : function (cb) { return setTimeout(cb, 16); };
        fnRAF(function () { bSched = false; _applyWrapView(oWrap); });
    });
    oRO.observe(oWrap);
}

// ── 새로고침(원본 App header refresh → --find--data--refresh) ────────────────
function _doRefresh() {
    if (bBusy) { return; }
    _setBusy(true);
    try { IPCRENDERER.removeListener(BROWSKEY + "--find--data--refresh--callback", _onRefreshCallback); } catch (e) { }
    IPCRENDERER.on(BROWSKEY + "--find--data--refresh--callback", _onRefreshCallback);
    try { IPCRENDERER.send(BROWSKEY + "--find--data--refresh"); } catch (e) { }
}
function _onRefreshCallback(event, oInfo) {
    try { IPCRENDERER.removeListener(BROWSKEY + "--find--data--refresh--callback", _onRefreshCallback); } catch (e) { }
    if (oInfo) {
        oData.user = oInfo.oUserInfo || oData.user;
        oData.theme = oInfo.oThemeInfo || oData.theme;
        oData.attr = oInfo.aAttrData || [];
        oData.serv = oInfo.aServEvtData || [];
        oData.t0022 = oInfo.aT_0022 || [];
    }
    // 메뉴/현재 모드 재구성(검색어는 oSearch 로 보존).
    aModes = _buildModes();
    _renderNav();
    var oCur = _findMode(oState.mode) || aModes[0];
    if (oCur) { _renderMode(oCur); }
    _setBusy(false);
}

// ── M005 도움말 모달(원본 popoverViewer → 공통 .u4a-dialog + iframe) ──────────
function _openHelp() {
    if (bBusy) { return; }
    var sLangu = (oData.user && oData.user.LANGU) || LANGU || "EN";
    var sBase = PATH.join(APPPATH, "ws30", "ws10_20", "Popups", "findPopup", "shortcutWhereUsed", "helpDoc");

    var sContent = "";
    try { sContent = FS.readFileSync(PATH.join(sBase, sLangu, "index.html"), "utf-8").toString(); }
    catch (e) {
        try { sContent = FS.readFileSync(PATH.join(sBase, "EN", "index.html"), "utf-8").toString(); }
        catch (e2) { sContent = ""; }
    }

    var oDlg = _el("dialog", "u4a-dialog u4aFindHelpDlg");

    var oHeader = _el("div", "u4a-dialog__header");
    oHeader.innerHTML = _fa("circle-question") + "<span></span>";
    oHeader.querySelector("span").textContent = _z("477"); // 단축키 등록 항목
    var oX = _el("button", "u4a-btn-icon");
    oX.type = "button";
    oX.innerHTML = _fa("xmark");
    oX.title = _c("A39"); // Close
    oX.addEventListener("click", function () { try { oDlg.close(); } catch (e) { } });
    oHeader.appendChild(oX);
    oDlg.appendChild(oHeader);

    var oBody = _el("div", "u4aFindHelpBody");
    var oFrame = document.createElement("iframe");
    oFrame.className = "u4aFindHelpFrame";
    oFrame.setAttribute("sandbox", "allow-same-origin");
    oFrame.srcdoc = sContent;
    oBody.appendChild(oFrame);
    oDlg.appendChild(oBody);

    document.body.appendChild(oDlg);
    oDlg.addEventListener("close", function () { try { oDlg.remove(); } catch (e) { } });
    try { oDlg.showModal(); } catch (e) { }
}

// ── 메인(opener) → 창: 초기 데이터 수신(원본 if-find-info) ──────────────────
function _onFindInfo(event, oInfo) {
    if (oState.gotInfo) { return; }
    oState.gotInfo = true;

    if (oInfo) {
        oData.user = oInfo.oUserInfo || null;
        oData.theme = oInfo.oThemeInfo || null;
        oData.attr = oInfo.aAttrData || [];
        oData.serv = oInfo.aServEvtData || [];
        oData.t0022 = oInfo.aT_0022 || [];
    }

    aModes = _buildModes();
    _renderNav();
    var oFirst = _findMode(oState.mode) || aModes[0];
    if (oFirst) { _renderMode(oFirst); }

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

// ── 타이틀바/새로고침/닫기 초기화 ───────────────────────────────────────────
function _initChrome() {
    var oLogo = document.getElementById("findLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    var oTitle = document.getElementById("findTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        if (!s) { s = _c("D02"); } // Find
        oTitle.textContent = s;
    }

    // 창 버튼(축소/확대/닫기) — 공통 3버튼 고정(versionMng/MIME 동일).
    var oMin = document.getElementById("findWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }
    var oMax = document.getElementById("findWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }
    var oClose = document.getElementById("findWinClose");
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
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
    _initBroadcast();

    // 외곽 스플리터(네비|메인) 드래그 리사이즈 — 정적 마크업이라 1회 배선.
    var oSplit = document.getElementById("findSplit");
    if (oSplit) { _wireSplit(oSplit); }

    IPCRENDERER.on("if-find-info", _onFindInfo);
    IPCMAIN.on(BROWSKEY + "--find--success", _onFindSuccess);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    try { CURRWIN.show(); } catch (e) { }

    // 안전판 — if-find-info 가 안 오면 busy 강제 해제(원본 동작엔 없던 방어).
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][findPopup] Find 정보 수신 지연 — busy 강제 해제");
        _finishOpen();
    }, 20000);
});

// busy 중 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제.
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    try { IPCRENDERER.removeListener("if-find-info", _onFindInfo); } catch (e) { }
    try { IPCRENDERER.removeListener(BROWSKEY + "--find--data--refresh--callback", _onRefreshCallback); } catch (e) { }
    try { IPCMAIN.removeListener(BROWSKEY + "--find--success", _onFindSuccess); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
