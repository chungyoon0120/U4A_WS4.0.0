/****************************************************************************
 * 소스 패턴(Source Pattern) 창 로직 (patternPopup/frame.js)
 * --------------------------------------------------------------------------
 *  원본: frame.js(로더) + index.js(UI5 App/Page + Splitter + sap.ui.table.TreeTable ×2
 *        + NavContainer + sap.ui.codeeditor.CodeEditor(ACE)) 2단 iframe.
 *  HTML5: 드래그 가능한 공통 .u4a-titlebar 는 최상위 문서에 있어야 하므로, 에디터 시리즈
 *  (errorPageEditorFrame)와 동일하게 **최상위 창**에 [공통 타이틀바 + 트리 스플릿 | Monaco 호스트]를
 *  두고, 내부 iframe 은 **공통 Monaco 호스트(editorPopup/host)만** 임베드한다(2단 → 1단, ACE→Monaco).
 *
 *  ★ 원본 보존(1:1):
 *   · 데이터 = DEF_PATT(기본, 읽기전용) / CUST_PATT(커스텀) JSON. 평면배열 CKEY/PKEY → 트리.
 *   · 좌: 기본 패턴 트리 + 커스텀 패턴 트리(세로 스플릿). 두 트리 상호배타 선택.
 *   · 우: 선택 시 코드(읽기전용 Monaco) + 제목 + 복사. ROOT/무DATA/미선택 = 빈 상태(276/277).
 *   · 기본 패턴 행 아이콘(ICON: 파일경로<img> / sap-icon→fa), init level1 펼침.
 *   · 커스텀 생성/수정/삭제(CRUD) 및 FS.watch 라이브 반영 = 다음 단계(Step 4/5).
 *  ★ 공통 자산 소비: createTree(트리), .u4a-splitter(스플릿), Monaco 호스트(뷰어), .u4a-busy/.u4a-toast.
 *   IPC/broadcast 계약(if-usp-pattern-info · if-p13n-themeChange-{SYSID} · if-send-action-{BROWSKEY}
 *   · broadcast-to-child-window_{BROWSKEY}) 그대로 유지.
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
    LANGU = USERINFO.LANGU;

var zconsole = WSERR(window, document, console);

// 공통 Monaco 호스트(editorPopup/host) 채널 태그=__u4aedh, HOSTID 는 화면별 식별자.
var C_HOSTID = "U4APATT";

// 현재 상태.
var oState = {
    aDefRoots: [],      // 기본 패턴 트리(루트 배열, 각 노드 _ch=자식)
    aCustRoots: [],     // 커스텀 패턴 트리
    cur: null,          // 우측에 표시 중인 노드
    pending: null,      // 호스트 준비 전 선택된 노드(준비 후 반영)
    ready: false        // Monaco 호스트 ready
};
var oDefTree = null, oCustTree = null;
var oFrame = null, bBusy = false, oToastTimer = null, iBusyWatch = null, bOpenDone = false, oBroad = null;

/* ── 로컬 헬퍼 ──────────────────────────────────────────────────────────── */

// 메시지(ZMSG_WS_COMMON_001) — 원본 getWsMessageList 와 동일 키. 임의 문구 생성 없음.
function _m(sCode, p1) {
    try { return WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sCode, p1 || "") || ""; }
    catch (e) { return ""; }
}

// 테마 배경색(BGCOL) 휘도 → Monaco 빌트인 테마(어두우면 vs-dark, 밝으면 vs). editorFrame 동일 판정.
function _monacoThemeFromBg(sBg) {
    try {
        var s = String(sBg || "").trim(), r, g, b;
        var mm = s.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (mm) { r = parseInt(mm[1], 16); g = parseInt(mm[2], 16); b = parseInt(mm[3], 16); }
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

// 커스텀 패턴 CONT_TYPE → Monaco 언어(USP monaco getMonacoLanguage 매핑 참조). 기본패턴은 CONT_TYPE 없음→plaintext.
function _lang(sCont) {
    var s = String(sCont || "").toLowerCase();
    switch (s) {
        case "javascript": case "js": case "mjs": case "cjs": return "javascript";
        case "css": return "css";
        case "html": case "htm": return "html";
        case "json": return "json";
        case "xml": return "xml";
        case "svg": return "xml";
        default: return "plaintext";   // text, abap(모나코 미지원) 등 → 평문(안전 폴백)
    }
}

/* ── 아이콘 — 원본 ICON: sap-icon:// 또는 svg 파일 경로(ws_html5_usp_editor_ctxmenu 의 _iconHtml 차용) ── */
var _SAP_FA = { "source-code": "file-code", "palette": "palette" };
function _iconHtml(sIcon) {
    if (!sIcon) { return ""; }
    var s = String(sIcon);
    if (s.indexOf("sap-icon://") === 0) {
        var sKey = s.slice("sap-icon://".length).toLowerCase();
        var sFa = _SAP_FA[sKey];
        return sFa ? '<i class="fa-solid fa-' + sFa + '"></i>' : '';
    }
    // 파일 경로(svg 등) → img. 백슬래시 경로 보정 + file:// 스킴.
    var sSrc = s;
    try {
        if (/^[a-z]:[\\/]/i.test(s) || s.indexOf("\\") >= 0) {
            sSrc = "file:///" + s.replace(/\\/g, "/");
        }
    } catch (e) { }
    return '<img src="' + encodeURI(sSrc) + '" alt="" style="width:1rem;height:1rem;object-fit:contain">';
}

/* ── 평면 배열(CKEY/PKEY) → 트리(순서 보존) — 원본 parseArrayToTree 대체(UI5 모델 비의존) ── */
function _buildTree(aFlat) {
    var oByKey = {}, aRoots = [];
    (aFlat || []).forEach(function (o) { if (o && o.CKEY) { o._ch = []; oByKey[o.CKEY] = o; } });
    (aFlat || []).forEach(function (o) {
        if (!o || !o.CKEY) { return; }
        var sPk = o.PKEY || "";
        if (sPk && oByKey[sPk]) { oByKey[sPk]._ch.push(o); }
        else { aRoots.push(o); }
    });
    return aRoots;
}

function _readPatternJson(sPath) {
    try {
        var a = JSON.parse(FS.readFileSync(sPath, "utf-8"));
        return Array.isArray(a) ? a : [];
    } catch (e) {
        console.error("[HTML5][WS30][patternPopup] 패턴 JSON 로드 오류:", sPath, e && e.message);
        return [];
    }
}

/* ── busy(로딩 오버레이 + 닫기 차단 + 자식창 브로드캐스트). errorPageEditorFrame 동일 정책 ── */
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("pattBusy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 닫기버튼(공통 closeWindow)으로만.
    try { CURRWIN.closable = false; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 오픈 busy 는 "한 번 켜서 끝까지 유지 → 완전 로드(또는 오류) 시 1회만 해제"(editorFrame 정책).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iBusyWatch); } catch (e) { }
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    document.body.classList.add("u4aPattShown");   // 본체 페이드인
}

// 저장/복사 토스트 — 공통 .u4a-toast(shell.css 단일 출처: 화면 정중앙).
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aPattToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aPattToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

/* ── 호스트(Monaco) 통신 ─────────────────────────────────────────────────── */
function _toHost(oMsg) {
    try {
        oMsg = oMsg || {};
        oMsg.__u4aedh = true;
        oMsg.hostId = C_HOSTID;
        if (oFrame && oFrame.contentWindow) { oFrame.contentWindow.postMessage(oMsg, "*"); }
    } catch (e) { }
}

// 호스트 최초 1회 로드(공통 Monaco 호스트 editorPopup/host 재사용 — 읽기전용 뷰어).
function _loadHost() {
    if (!oFrame || oFrame.getAttribute("src")) { return; }
    var oPARAMS = {
        HOSTID: C_HOSTID,
        LANG: "plaintext",
        THEME: _monacoThemeFromBg(BGCOL),
        READONLY: true
    };
    oFrame.src = "../editorPopup/host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oPARAMS));
}

/* ── 우측 뷰어 표시/빈 상태 ───────────────────────────────────────────────── */
function _showEmpty() {
    oState.cur = null;
    var oHead = document.getElementById("pattViewHead");
    if (oHead) { oHead.hidden = true; }
    var oWrap = document.getElementById("pattHostWrap");
    if (oWrap) { oWrap.hidden = true; oWrap.classList.remove("u4aPattHostShown"); }
    var oEmpty = document.getElementById("pattEmpty");
    if (oEmpty) { oEmpty.hidden = false; }
}

function _showCode(oNode) {
    oState.cur = oNode;
    var oEmpty = document.getElementById("pattEmpty");
    if (oEmpty) { oEmpty.hidden = true; }
    var oHead = document.getElementById("pattViewHead");
    if (oHead) { oHead.hidden = false; }
    var oTitle = document.getElementById("pattViewTitle");
    if (oTitle) { oTitle.textContent = oNode.DESC || ""; }
    var oWrap = document.getElementById("pattHostWrap");
    if (oWrap) { oWrap.hidden = false; }

    if (oState.ready) {
        _toHost({ cmd: "setReadOnly", readOnly: true });
        _toHost({ cmd: "setLanguage", language: _lang(oNode.CONT_TYPE) });
        _toHost({ cmd: "setValue", value: (typeof oNode.DATA === "string") ? oNode.DATA : "" });
        if (oWrap) { oWrap.classList.add("u4aPattHostShown"); }
    } else {
        oState.pending = oNode;   // 준비되면 반영
    }
}

// 트리 노드 선택(원본 ev_DefPattRowSelectionChange / ev_CustPattRowSelectionChange — 상호배타 + ROOT/무DATA 처리).
function _selectPattern(oOwnTree, oOtherTree, oNode) {
    if (oOwnTree) { oOwnTree.setSelected(oNode); }
    if (oOtherTree) { oOtherTree.selectByKey(""); }   // 다른 트리 선택 해제(빈 키 → 전체 해제)
    if (!oNode || oNode.TYPE === "ROOT" || !oNode.DATA) { _showEmpty(); return; }
    _showCode(oNode);
}

/* ── 트리테이블 생성(공통 createTree + 컬럼헤더 — 다열 정렬 표준 §3.4.1) ───────── */
function _mkTree(cfg) {
    return U4AUI.createTree({
        roots: cfg.roots,
        children: function (n) { return n._ch || []; },
        key: function (n) { return n.CKEY || ""; },
        hasChildren: function (n) { return (n._ch || []).length > 0; },
        label: function (n) { return (n.TYPE === "ROOT") ? ((n.DESC || "") + " Root") : (n.DESC || ""); },
        icon: function (n) { return _iconHtml(n.ICON); },
        tip: function (n) { return (n.TYPE === "ROOT") ? ((n.DESC || "") + " Root") : (n.DESC || ""); },
        slotTrailing: cfg.slotTrailing || null,
        rowHook: function (oRow) { oRow.classList.add("u4aPattRow"); },   // 행 스코프(정렬 CSS)
        onSelect: cfg.onSelect,
        initialExpanded: function (n, lvl) { return lvl < 1; }   // 원본 expandToLevel(1)
    });
}

// 컬럼 헤더(스크롤 컨테이너 안 sticky — 세로 스크롤바 떠도 행과 함께 줄어 정렬 유지). aCells=[{cls,text}].
function _colHead(aCells) {
    var h = document.createElement("div");
    h.className = "u4aPattTreeColHead";
    aCells.forEach(function (c) {
        var s = document.createElement("span");
        s.className = c.cls;
        s.textContent = c.text;
        h.appendChild(s);
    });
    return h;
}

// 세로선 레이어(gridLines) — 헤더와 동일 컬럼 flex 로 border-left 를 treeWrap 풀하이트에 깐다(빈 영역 포함).
//   aCls = GL 셀 클래스 배열(없으면 세로선 없음=단일 컬럼). rule 7 심화(bindPopup 이식).
function _gridLines(aCls) {
    if (!aCls || !aCls.length) { return null; }
    var g = document.createElement("div");
    g.className = "u4aPattGridLines";
    g.setAttribute("aria-hidden", "true");
    aCls.forEach(function (cls) {
        var s = document.createElement("span");
        s.className = cls;
        g.appendChild(s);
    });
    return g;
}

// 트리 래퍼(position:relative, 가로 행선 배경) — gridLines(z:0) + tree(z:1)를 담아 경계선을 바닥까지 연장.
function _treeWrap(oGrid) {
    var w = document.createElement("div");
    w.className = "u4aPattTreeWrap";
    if (oGrid) { w.appendChild(oGrid); }
    return w;
}

function _buildTrees() {
    // 기본 패턴 트리(단일 컬럼[기본 패턴], 읽기전용).
    oDefTree = _mkTree({
        roots: function () { return oState.aDefRoots; },
        onSelect: function (n) { _selectPattern(oDefTree, oCustTree, n); }
    });
    // 커스텀 패턴 트리(이름 | Content Type). Content Type 셀은 모든 행에 반환(세로구분선 연속 — MIME 방식 단일 셀).
    oCustTree = _mkTree({
        roots: function () { return oState.aCustRoots; },
        slotTrailing: function (n) {
            var cell = document.createElement("span");
            cell.className = "u4aPattCont";
            var txt = document.createElement("span");
            txt.className = "u4aPattContText";
            var sVal = (n && n.TYPE !== "ROOT" && n.CONT_TYPE) ? n.CONT_TYPE : "";
            txt.textContent = sVal;
            if (sVal) { txt.setAttribute("data-tip", sVal); txt.setAttribute("data-tip-trunc", ""); }
            cell.appendChild(txt);
            return cell;
        },
        onSelect: function (n) { _selectPattern(oCustTree, oDefTree, n); }
    });

    var oDefBody = document.getElementById("pattDefBody");
    if (oDefBody) {
        oDefBody.appendChild(_colHead([{ cls: "u4aPattColName", text: _m("021") }]));   // Default Pattern
        oDefTree.el.classList.add("u4aPattTree");
        var oDefWrap = _treeWrap(null);   // 단일 컬럼 → 세로선 없음(가로 행선만)
        oDefWrap.appendChild(oDefTree.el);
        oDefBody.appendChild(oDefWrap);
    }
    var oCustBody = document.getElementById("pattCustBody");
    if (oCustBody) {
        oCustBody.appendChild(_colHead([
            { cls: "u4aPattColName", text: _m("022") },   // Custom Pattern
            { cls: "u4aPattColCont", text: _m("023") }    // Content Type
        ]));
        oCustTree.el.classList.add("u4aPattTree");
        var oCustWrap = _treeWrap(_gridLines(["u4aPattGL u4aPattGL--name", "u4aPattGL u4aPattGL--cont"]));
        oCustWrap.appendChild(oCustTree.el);
        oCustBody.appendChild(oCustWrap);
    }
}

// 패턴 데이터 로드 + 트리 렌더(원본 fnInitModelBinding).
function _loadData() {
    oState.aDefRoots = _buildTree(_readPatternJson(PATHINFO.DEF_PATT));
    oState.aCustRoots = _buildTree(_readPatternJson(PATHINFO.CUST_PATT));
    if (oDefTree) { oDefTree.render(); }
    if (oCustTree) { oCustTree.render(); }
}

/* ── 스플리터 드래그(가로/세로) — 공통 CSS(.u4a-splitter*) 소비, 폭 계산만 화면별(§4.3, MIME 미러).
 *   전역 핸들러가 mousedown 시 body.u4a-dragging(iframe 가드) + 더블클릭 홈복귀를 자동 처리한다.
 *   여기선 인접 A 패널의 basis(px)만 조정(B 는 grow 로 잔여 자동 충전 — 마지막 유연 패널 보호). ── */
function _paneMin(el, bVert) {
    var v = parseFloat((bVert ? el.style.minHeight : el.style.minWidth) || "");
    return (isFinite(v) && v > 0) ? v : (bVert ? 60 : 120);
}
function _barsSize(oSplit, bVert) {
    var n = 0;
    Array.prototype.slice.call(oSplit.children).forEach(function (c) {
        if (c.classList && c.classList.contains("u4a-splitter__bar")) {
            var r = c.getBoundingClientRect();
            n += bVert ? r.height : r.width;
        }
    });
    return n;
}
function _bindSplit(oBar, bVert) {
    if (!oBar) { return; }
    var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0;
    function lf_move(e) {
        if (!bDrag) { return; }
        var oSplit = oBar.parentNode;
        var pos = bVert ? e.clientY : e.clientX;
        var a = iAStart + (pos - iStart);
        var am = _paneMin(oA, bVert);
        var avail = (bVert ? oSplit.clientHeight : oSplit.clientWidth) - _barsSize(oSplit, bVert) - _paneMin(oB, bVert);
        if (a < am) { a = am; }
        if (a > avail) { a = avail; }
        oA.style.flex = "0 0 " + a + "px";
    }
    function lf_up() {
        bDrag = false;
        document.removeEventListener("mousemove", lf_move);
        document.removeEventListener("mouseup", lf_up);
    }
    oBar.addEventListener("mousedown", function (e) {
        oA = oBar.previousElementSibling; oB = oBar.nextElementSibling;
        if (!oA || !oB) { return; }
        bDrag = true;
        iStart = bVert ? e.clientY : e.clientX;
        var r = oA.getBoundingClientRect();
        iAStart = bVert ? r.height : r.width;
        document.addEventListener("mousemove", lf_move);
        document.addEventListener("mouseup", lf_up);
        e.preventDefault();
    });
}

// 창 리사이즈 재클램프(px 고정 A 패널이 줄어든 컨테이너를 넘지 않게). 가로/세로 각 스플릿.
function _clampSplit(oSplit, bVert) {
    if (!oSplit) { return; }
    var avail = bVert ? oSplit.clientHeight : oSplit.clientWidth;
    if (!avail) { return; }
    var aPanes = Array.prototype.slice.call(oSplit.children).filter(function (c) {
        return c.classList && c.classList.contains("u4a-splitter__pane");
    });
    function _px(p) { var m = (p.style.flex || "").match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : null; }
    var iFixed = 0, iFlexMin = 0, aFixed = [];
    aPanes.forEach(function (p) {
        var v = _px(p);
        if (v != null) { aFixed.push(p); iFixed += v; }
        else { iFlexMin += _paneMin(p, bVert); }
    });
    var iNeed = (iFixed + _barsSize(oSplit, bVert) + iFlexMin) - avail;
    if (iNeed <= 0) { return; }
    aFixed.sort(function (a, b) { return _px(b) - _px(a); }).forEach(function (p) {
        if (iNeed <= 0) { return; }
        var cur = _px(p), min = _paneMin(p, bVert);
        var cut = Math.min(Math.max(0, cur - min), iNeed);
        if (cut > 0) { p.style.flex = "0 0 " + (cur - cut) + "px"; iNeed -= cut; }
    });
}

/* ── 라이브 테마 변경(워크스페이스 테마 추종 — 개인화 없음. errorPageEditorFrame 동일, 근거 .analy/12 §5.3) ── */
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

// 원본 opener 가 did-finish-load 에 보내는 테마정보(IPC 계약 유지) — 받으면 테마 재적용.
function _onPatternInfo(event, oInfo) {
    var oTheme = (oInfo && oInfo.oThemeInfo) || null;
    if (!oTheme || !oTheme.THEME) { return; }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    if (oTheme.BGCOL) { BGCOL = oTheme.BGCOL; }
    _toHost({ cmd: "setTheme", theme: _monacoThemeFromBg(BGCOL) });
}

/* ── 호스트 → 창 메시지(ready / zoom) ───────────────────────────────────── */
function _onHostMessage(oEvent) {
    var d = oEvent && oEvent.data;
    if (!d || d.__u4aedh !== true || d.hostId !== C_HOSTID) { return; }
    if (d.evt === "ready") {
        oState.ready = true;
        if (oState.pending) { var n = oState.pending; oState.pending = null; _showCode(n); }
        _finishOpen();
        return;
    }
}

/* ── 타이틀바/뷰어 헤더 초기화 ───────────────────────────────────────────── */
function _initChrome() {
    // 로고(메인 창과 동일 APPPATH/img/logo.png).
    var oLogo = document.getElementById("pattLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replace(/\\/g, "/")); } catch (e) { }
    }
    // 제목(opener 가 넘긴 TITLE).
    var oTitle = document.getElementById("pattTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }
    // (트리 컬럼헤더 라벨 021/022/023 은 _buildTrees 가 스크롤 컨테이너 안 sticky 헤더로 그린다.)
    // 빈 상태 문구(276/277).
    var oEmptyTitle = document.getElementById("pattEmptyTitle");
    if (oEmptyTitle) { oEmptyTitle.textContent = _m("276"); }
    var oEmptyDesc = document.getElementById("pattEmptyDesc");
    if (oEmptyDesc) { oEmptyDesc.textContent = _m("277"); }

    // 닫기(타이틀바 X) — busy 중 차단 + 공통 closeWindow(창이 closable:false 라 직접 close() 불가).
    var oClose = document.querySelector('#pattTitlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else { try { CURRWIN.setClosable(true); CURRWIN.close(); } catch (e) { } }
        });
    }

    // 복사 버튼(원본 우측 헤더 copy — clipboard.writeText + 031 토스트).
    var oCopy = document.getElementById("pattCopyBtn");
    if (oCopy) {
        oCopy.title = _m("031");
        oCopy.addEventListener("click", function () {
            if (!oState.cur || typeof oState.cur.DATA !== "string") { return; }
            try { REMOTE.clipboard.writeText(oState.cur.DATA); }
            catch (e) {
                try { REMOTE.require('electron').clipboard.writeText(oState.cur.DATA); } catch (e2) { }
            }
            _toast(_m("031"));   // Clipboard Copy Success!
        });
    }
}

/* ── 자식창 busy 동기화 채널 ─────────────────────────────────────────────── */
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

/* ── 세션 유지(원본 fnKeepClientSession) ─────────────────────────────────── */
function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { }
}

/* ── 부트 ────────────────────────────────────────────────────────────────── */
window.addEventListener("load", function () {

    oFrame = document.getElementById("pattHost");

    try { CURRWIN.setMenu(null); } catch (e) { }

    // 창 포커스 blur 흐림(공통).
    try { if (window.U4AUI && U4AUI.initWindowFocusState) { U4AUI.initWindowFocusState(); } } catch (e) { }

    _initChrome();
    _initBroadcast();
    _buildTrees();

    // 스플리터 드래그 바인딩(가로 1 + 세로 1) + 창 리사이즈 재클램프.
    var oOuter = document.getElementById("pattOuterSplit");
    var oVert = document.getElementById("pattVertSplit");
    if (oOuter) { _bindSplit(oOuter.querySelector(":scope > .u4a-splitter__bar"), false); }
    if (oVert) { _bindSplit(oVert.querySelector(":scope > .u4a-splitter__bar"), true); }
    window.addEventListener("resize", function () { _clampSplit(oOuter, false); _clampSplit(oVert, true); });

    // 호스트 메시지 + 테마 IPC 구독.
    window.addEventListener("message", _onHostMessage);
    IPCRENDERER.on("if-usp-pattern-info", _onPatternInfo);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    // 세션 유지.
    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 데이터 로드 + 트리 렌더(FS 직접 — 호스트 준비와 무관).
    _loadData();
    _showEmpty();

    // busy 는 오프너가 켠 상태 유지 → 호스트 완전 로드 시 1회 해제(중간 깜빡임 없음).
    _setBusy(true);
    try { clearTimeout(iBusyWatch); } catch (e) { }
    iBusyWatch = setTimeout(function () {
        console.error("[HTML5][WS30][patternPopup] Monaco 호스트 로드 지연/실패 — busy 강제 해제");
        _finishOpen();
    }, 15000);
    _loadHost();

    // 창은 즉시 불투명 표시(네이티브 opacity 페이드 미사용). 등장 효과는 본체 CSS opacity.
    try { CURRWIN.show(); } catch (e) { }
});

// busy 중에는 창 닫기 차단(원본 onbeforeunload). 정상 종료 시 리스너/IPC 해제(누수 방지).
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    // 브라우저 닫는 시점에 busy 켜져있으면 형제창 busy 해제(broadcast-busy-pair).
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("message", _onHostMessage);
    try { IPCRENDERER.removeListener("if-usp-pattern-info", _onPatternInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
