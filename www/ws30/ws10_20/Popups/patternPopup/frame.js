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

// ABAP 클래스 텍스트(/U4A/CL_WS_COMMON) — Save(A64)/Close(A39) 버튼 툴팁용(errorPage 동일 방식).
var WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

var zconsole = WSERR(window, document, console);

// 공통 Monaco 호스트(editorPopup/host) 채널 태그=__u4aedh, HOSTID 는 화면별 식별자.
var C_HOSTID = "U4APATT";          // 우측 읽기전용 뷰어 호스트
var C_EDIT_HOSTID = "U4APATTEDIT"; // 생성/수정 다이얼로그 편집 호스트

// 커스텀 패턴 컨텐츠 유형(원본 _getWsCustomPatternContentTypes). value=Monaco 언어와 (abap 제외) 동일.
var A_CONT_TYPES = ["text", "abap", "html", "javascript", "css", "json", "xml"];

var oDlgUI = null;   // 생성/수정 다이얼로그 UI refs(지연 생성 싱글톤). {dlg,host,title,icon,titleField,typeSel,save,ready,pending,PRCCD,CKEY}

// 현재 상태.
var oState = {
    aDefRoots: [],      // 기본 패턴 트리(루트 배열, 각 노드 _ch=자식)
    aCustRoots: [],     // 커스텀 패턴 트리
    cur: null,          // 우측에 표시 중인 노드
    pending: null,      // 호스트 준비 전 선택된 노드(준비 후 반영)
    ready: false,       // Monaco 호스트 ready
    selCustKey: ""      // 현재 선택된 커스텀 노드 CKEY(watch 재로드 시 선택 보존)
};
var oDefTree = null, oCustTree = null;
var oFrame = null, bBusy = false, oToastTimer = null, iBusyWatch = null, bOpenDone = false, oBroad = null;
var bSelfWrite = false, oCustWatcher = null, iWatchTimer = null;   // 커스텀 파일 watch(라이브 반영) + 자기저장 가드

/* ── 로컬 헬퍼 ──────────────────────────────────────────────────────────── */

// 메시지(ZMSG_WS_COMMON_001) — 원본 getWsMessageList 와 동일 키. 임의 문구 생성 없음.
function _m(sCode, p1) {
    try { return WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sCode, p1 || "") || ""; }
    catch (e) { return ""; }
}

// ABAP 클래스 메시지(/U4A/CL_WS_COMMON 등) — A64 Save / A39 Close.
function _mc(sCls, sCode) {
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, "", "", "", "") || ""; }
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

// CONT_TYPE/확장자 문자열 → Monaco 언어(USP monaco getMonacoLanguage 매핑 참조).
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

// ROOT 직계 카테고리(HTML/JS/CSS/UI5…)의 DESC — 기본 패턴 언어 유추용(리프에서 부모 체인 상승).
function _catDesc(oNode) {
    var n = oNode;
    while (n && n._parent && n._parent._parent) { n = n._parent; }   // 부모의 부모가 없으면 n = ROOT 직계(카테고리)
    return (n && n.DESC) || "";
}

// 노드 → Monaco 언어. 커스텀=CONT_TYPE / 기본=카테고리 DESC(우선) + ACTCD(01=HTML,02=JS 폴백).
//   (원본 뷰어는 하이라이트 없었음 — 언어별 강조는 개선. UI5=HTML 계열, CSS 카테고리는 css.)
function _langOf(oNode) {
    if (!oNode) { return "plaintext"; }
    if (oNode.CONT_TYPE) { return _lang(oNode.CONT_TYPE); }   // 커스텀 패턴
    var cat = _catDesc(oNode).toLowerCase();
    if (cat.indexOf("html") >= 0 || cat.indexOf("ui5") >= 0) { return "html"; }
    if (cat === "js" || cat.indexOf("javascript") >= 0) { return "javascript"; }
    if (cat.indexOf("css") >= 0) { return "css"; }
    if (cat.indexOf("json") >= 0) { return "json"; }
    if (cat.indexOf("xml") >= 0) { return "xml"; }
    if (oNode.ACTCD === "01") { return "html"; }         // ACTCD 폴백(01=HTML 계열)
    if (oNode.ACTCD === "02") { return "javascript"; }   // 02=JS 계열
    return "plaintext";
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
    (aFlat || []).forEach(function (o) { if (o && o.CKEY) { o._ch = []; o._parent = null; oByKey[o.CKEY] = o; } });
    (aFlat || []).forEach(function (o) {
        if (!o || !o.CKEY) { return; }
        var sPk = o.PKEY || "";
        if (sPk && oByKey[sPk]) { oByKey[sPk]._ch.push(o); o._parent = oByKey[sPk]; }   // 언어 유추용 부모 링크
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

// 뷰어 헤더 줌 % 갱신(뷰어 호스트 evt:zoom). 숫자라 i18n 키 불필요.
function _setViewZoom(pct) {
    var oBtn = document.getElementById("pattViewZoomBtn");
    if (!oBtn) { return; }
    var n = (typeof pct === "number" && isFinite(pct)) ? pct : 100;
    var oSpan = oBtn.querySelector("span");
    if (oSpan) { oSpan.textContent = n + "%"; }
    oBtn.title = n + "% (Ctrl+0)";
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

/* ── 뷰어 서브페이지 전환(빈상태 ↔ 코드) — §9 슬라이드+페이드(0.26s±32px). 실제 페이지 바뀔 때만 애니메이션. ── */
var _A_NAV = ["u4aPattNavInFwd", "u4aPattNavInBack", "u4aPattNavOutFwd", "u4aPattNavOutBack"];
function _navPages(oShow, oHide, bForward) {
    if (!oShow) { return; }
    oShow.classList.remove.apply(oShow.classList, _A_NAV);
    oShow.classList.remove("u4aPattPageHidden");
    if (!oHide) { return; }   // 최초 표시 = 애니메이션 없이 노출
    oShow.classList.add(bForward ? "u4aPattNavInFwd" : "u4aPattNavInBack");

    oHide.classList.remove.apply(oHide.classList, _A_NAV);
    var sOut = bForward ? "u4aPattNavOutFwd" : "u4aPattNavOutBack";
    oHide.classList.add(sOut);
    var bDone = false;
    var _done = function () {                       // 완료 후 정리(§9.3) — animationend + 400ms 폴백.
        if (bDone) { return; }
        bDone = true;
        oHide.classList.remove(sOut);
        oHide.classList.add("u4aPattPageHidden");
        oHide.removeEventListener("animationend", _done);
    };
    oHide.addEventListener("animationend", _done);
    setTimeout(_done, 400);
}

/* ── 우측 뷰어 표시/빈 상태 ───────────────────────────────────────────────── */
function _showEmpty() {
    oState.cur = null;
    var oHead = document.getElementById("pattViewHead");
    if (oHead) { oHead.hidden = true; }
    var oEmpty = document.getElementById("pattEmpty");
    var oWrap = document.getElementById("pattHostWrap");
    // 코드가 보이던 상태에서만 전환(빈상태가 이미 보이면 no-op = 최초 포함).
    if (oEmpty && oEmpty.classList.contains("u4aPattPageHidden")) {
        _navPages(oEmpty, oWrap, false);   // 코드→빈 = back
    }
}

function _showCode(oNode) {
    oState.cur = oNode;
    var oHead = document.getElementById("pattViewHead");
    if (oHead) { oHead.hidden = false; }
    var oTitle = document.getElementById("pattViewTitle");
    if (oTitle) { oTitle.textContent = oNode.DESC || ""; }
    var oEmpty = document.getElementById("pattEmpty");
    var oWrap = document.getElementById("pattHostWrap");
    // 빈상태에서 올 때만 전환(코드→코드는 애니메이션 없이 setValue 만 — Monaco 1회 로드 원칙).
    if (oWrap && oWrap.classList.contains("u4aPattPageHidden")) {
        _navPages(oWrap, oEmpty, true);   // 빈→코드 = forward
    }

    if (oState.ready) {
        _toHost({ cmd: "setReadOnly", readOnly: true });
        _toHost({ cmd: "setLanguage", language: _langOf(oNode) });
        _toHost({ cmd: "setValue", value: (typeof oNode.DATA === "string") ? oNode.DATA : "" });   // 텍스트만 set(재로드 X)
    } else {
        oState.pending = oNode;   // 호스트 준비되면 반영
    }
}

// makeColumnTree 래퍼면 내부 createTree(.tree)를, createTree 면 자신을 반환(선택 API 공용화).
function _tof(t) { return (t && t.tree) ? t.tree : t; }

// 트리 노드 선택(원본 ev_DefPattRowSelectionChange / ev_CustPattRowSelectionChange — 상호배타 + ROOT/무DATA 처리).
function _selectPattern(oOwnTree, oOtherTree, oNode) {
    var own = _tof(oOwnTree), other = _tof(oOtherTree);
    if (other) { other.selectByKey(""); }   // 다른 트리 선택 해제
    // ROOT / DATA 없음 → 원본은 clearSelection(선택 표시 없이 빈 상태). 하이라이트 남기지 않는다.
    if (!oNode || oNode.TYPE === "ROOT" || !oNode.DATA) {
        if (own) { own.selectByKey(""); }
        _showEmpty();
        return;
    }
    if (own) { own.setSelected(oNode); }
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
        rowHook: cfg.rowHook || function (oRow) { oRow.classList.add("u4aPattRow"); },   // 행 스코프(정렬 CSS)
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
        onSelect: function (n) { oState.selCustKey = ""; _selectPattern(oDefTree, oCustTree, n); }
    });
    // 커스텀 패턴 트리는 아래 oCustBody 에서 공통 makeColumnTree(3열 리사이즈 트리테이블)로 생성한다.

    var oDefBody = document.getElementById("pattDefBody");
    if (oDefBody) {
        oDefBody.appendChild(_colHead([{ cls: "u4aPattColName", text: _m("021") }]));   // Default Pattern
        oDefTree.el.classList.add("u4aPattTree");
        var oDefWrap = _treeWrap(null);   // 단일 컬럼 → 세로선 없음(가로 행선만)
        oDefWrap.appendChild(oDefTree.el);
        oDefBody.appendChild(oDefWrap);
    }
    var oCustBody = document.getElementById("pattCustBody");
    if (oCustBody && window.U4AUI && U4AUI.makeColumnTree) {
        // makeColumnTree 는 host 를 .u4aColTree(height:100%/overflow:auto)로 채운다 → 내 .u4aPattTreeBody 와
        //   겹치지 않게 깨끗한 자식 host 를 넘긴다(스크롤/높이 충돌 방지).
        oCustBody.innerHTML = "";
        var oColHost = document.createElement("div");
        oCustBody.appendChild(oColHost);
        // 커스텀 = 공통 3열 리사이즈 트리테이블(이름 | Content Type | 액션). 모든 컬럼 그립·가이드·그리드선·가로스크롤 내장.
        oCustTree = U4AUI.makeColumnTree(oColHost, {
            columns: [
                { label: _m("022"), width: "10rem" },   // 개인화 패턴(이름)
                { label: _m("023"), width: "7rem" },     // 콘텐츠 유형
                { label: "", width: "4rem" }              // 액션(수정/삭제)
            ],
            roots: function () { return oState.aCustRoots; },
            children: function (n) { return n._ch || []; },
            hasChildren: function (n) { return (n._ch || []).length > 0; },
            key: function (n) { return n.CKEY || ""; },
            label: function (n) { return (n.TYPE === "ROOT") ? ((n.DESC || "") + " Root") : (n.DESC || ""); },
            tip: function (n) { return (n.TYPE === "ROOT") ? ((n.DESC || "") + " Root") : (n.DESC || ""); },
            icon: function (n) { return _iconHtml(n.ICON); },
            cell: function (n) { return { c2: _custCellType(n), c3: _custCellActs(n) }; },
            onSelect: function (n) {
                oState.selCustKey = (n && n.TYPE !== "ROOT" && n.DATA) ? n.CKEY : "";
                _selectPattern(oCustTree, oDefTree, n);
            },
            emptyText: ""
        });
        oCustTree.rerender(false);   // 첫행 자동선택 안 함
    }
}

// 커스텀 c2 셀 = Content Type 텍스트(말줄임 툴팁).
function _custCellType(n) {
    var sVal = (n && n.TYPE !== "ROOT" && n.CONT_TYPE) ? n.CONT_TYPE : "";
    var oTxt = document.createElement("span");
    oTxt.className = "u4aPattContText";
    oTxt.textContent = sVal;
    if (sVal) { oTxt.setAttribute("data-tip", sVal); oTxt.setAttribute("data-tip-trunc", ""); }
    return oTxt;
}

// 커스텀 c3 셀 = 액션(수정/삭제 "항상 표시" — 원본 rowActionCount:2). ROOT 는 버튼 없음.
function _custCellActs(n) {
    var oActs = document.createElement("span");
    oActs.className = "u4aPattActs";
    if (!n || n.TYPE === "ROOT") { return oActs; }
    var oEdit = document.createElement("button");
    oEdit.type = "button";
    oEdit.className = "u4aPattActBtn u4aPattActBtn--edit";
    oEdit.title = _m("030");   // Change
    oEdit.innerHTML = '<i class="fa-solid fa-pen"></i>';
    oEdit.addEventListener("click", function (ev) {
        ev.stopPropagation();
        _openCreateDlg({ PRCCD: "U", CKEY: n.CKEY, DESC: n.DESC, DATA: n.DATA, CONT_TYPE: n.CONT_TYPE });
    });
    var oDel = document.createElement("button");
    oDel.type = "button";
    oDel.className = "u4aPattActBtn u4aPattActBtn--del";
    oDel.title = _m("029");   // Delete
    oDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    oDel.addEventListener("click", function (ev) {
        ev.stopPropagation();
        _deleteCust(n);
    });
    oActs.appendChild(oEdit);
    oActs.appendChild(oDel);
    return oActs;
}

// 패턴 데이터 로드 + 트리 렌더(원본 fnInitModelBinding).
function _loadData() {
    oState.aDefRoots = _buildTree(_readPatternJson(PATHINFO.DEF_PATT));
    oState.aCustRoots = _buildTree(_readPatternJson(PATHINFO.CUST_PATT));
    if (oDefTree) { oDefTree.render(); }
    if (oCustTree) { oCustTree.rerender(false); }   // makeColumnTree
}

/* ── 커스텀 패턴 CRUD (원본 ev_pressCustomPatternCreateUpdate / ev_CustCreateDlgSave / ev_pressCustomPatternDelete) ── */

// 트리에서 CKEY 로 노드 찾기(재귀).
function _findNode(aRoots, sKey) {
    var oFound = null;
    (function rec(aNodes) {
        if (oFound || !aNodes) { return; }
        for (var i = 0; i < aNodes.length; i++) {
            var n = aNodes[i];
            if (!n) { continue; }
            if (n.CKEY === sKey) { oFound = n; return; }
            if (n._ch && n._ch.length) { rec(n._ch); if (oFound) { return; } }
        }
    })(aRoots || []);
    return oFound;
}

// 커스텀 트리 재로드(파일 fresh) + 렌더 + (선택키 있으면) 재선택·스크롤. selCustKey 동기(watch 정합).
function _reloadCust(sSelKey) {
    oState.aCustRoots = _buildTree(_readPatternJson(PATHINFO.CUST_PATT));
    if (oCustTree) { oCustTree.rerender(false); }   // makeColumnTree 재렌더(첫행 자동선택 안 함)
    var oNode = sSelKey ? _findNode(oState.aCustRoots, sSelKey) : null;
    if (oNode) {
        oState.selCustKey = sSelKey;
        _selectPattern(oCustTree, oDefTree, oNode);
        try { oCustTree.selectKey(sSelKey, true); } catch (e) { }   // 스크롤 reveal
    } else {
        oState.selCustKey = "";   // 선택 대상 없음 → 보존 키 해제
    }
}

// 커스텀 파일 저장 — 자기저장 가드(watch 자기이벤트 무시). 성공 여부 반환.
function _writeCust(aFlat) {
    bSelfWrite = true;
    var bOk = true;
    try { FS.writeFileSync(PATHINFO.CUST_PATT, JSON.stringify(aFlat), "utf-8"); }
    catch (e) { bOk = false; console.error("[HTML5][WS30][patternPopup] 커스텀 패턴 저장 오류:", e && e.message); }
    setTimeout(function () { bSelfWrite = false; }, 300);   // watch 이벤트(rename+change) 소진 후 해제
    return bOk;
}

// 커스텀 파일 외부 변경 감시(원본 fnSetPatternFileWatch/fnPatternFileWatchEvent) — 선택 보존하며 재로드.
function _initCustWatch() {
    try {
        oCustWatcher = FS.watch(PATHINFO.CUST_PATT, function () {
            if (bSelfWrite) { return; }   // 내 저장은 직접 반영하므로 무시
            try { clearTimeout(iWatchTimer); } catch (e) { }
            iWatchTimer = setTimeout(function () {
                _reloadCust(oState.selCustKey || "");   // 외부 변경 → 선택 보존 재로드
            }, 120);   // 짧은 디바운스(rename+change 다중 이벤트 합침)
        });
    } catch (e) {
        console.error("[HTML5][WS30][patternPopup] 커스텀 패턴 watch 설정 오류:", e && e.message);
    }
}

// 편집 호스트 통신.
function _toEditHost(oMsg) {
    try {
        if (!oDlgUI || !oDlgUI.host || !oDlgUI.host.contentWindow) { return; }
        oMsg = oMsg || {};
        oMsg.__u4aedh = true;
        oMsg.hostId = C_EDIT_HOSTID;
        oDlgUI.host.contentWindow.postMessage(oMsg, "*");
    } catch (e) { }
}
function _readEditHost() {
    try { return oDlgUI.host.contentWindow.editor.getValue(); } catch (e) { return null; }
}
function _applyEditor(oParam) {
    _toEditHost({ cmd: "setReadOnly", readOnly: false });
    _toEditHost({ cmd: "setLanguage", language: _lang(oParam.CONT_TYPE || "text") });
    _toEditHost({ cmd: "setValue", value: (typeof oParam.DATA === "string") ? oParam.DATA : "" });
}

// 푸터 줌 % 갱신(호스트 evt:zoom). 숫자라 i18n 키 불필요.
function _setDlgZoom(pct) {
    if (!oDlgUI || !oDlgUI.zoomBtn) { return; }
    var n = (typeof pct === "number" && isFinite(pct)) ? pct : 100;
    var oSpan = oDlgUI.zoomBtn.querySelector("span");
    if (oSpan) { oSpan.textContent = n + "%"; }
    oDlgUI.zoomBtn.title = n + "% (Ctrl+0)";
}

// 다이얼로그 삭제(수정 모드) — 확인 후 현재 커스텀 패턴 제거 + 닫기(원본 ev_pressCustomPatternDelete 흐름).
function _deleteFromDlg() {
    if (!oDlgUI || oDlgUI.PRCCD !== "U" || !oDlgUI.CKEY) { return; }
    var sKey = oDlgUI.CKEY;
    var sDesc = (oDlgUI.titleField.getValue() || "");
    U4AUI.confirm({
        type: "W",
        title: _m("022") + " " + _m("029"),                          // Custom Pattern Delete
        message: "[" + sDesc + "]\n\n" + _m("028"),                  // Do you really want to delete the object?
        yesLabel: _m("038"),   // YES
        noLabel: _m("039"),    // NO
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            var aFlat = _readPatternJson(PATHINFO.CUST_PATT);
            var iF = aFlat.findIndex(function (e) { return e && e.CKEY === sKey; });
            if (iF < 0) { _closeCreateDlg(); return; }
            aFlat.splice(iF, 1);
            if (!_writeCust(aFlat)) { return; }
            _closeCreateDlg();
            _reloadCust("");
            if (oCustTree) { _tof(oCustTree).selectByKey(""); }
            _showEmpty();
            _toast(_m("008"));   // Delete success
        }
    });
}

// 다이얼로그 폼 행(라벨 + 컨트롤).
function _dlgRow(sLabel, oControl) {
    var r = document.createElement("div");
    r.className = "u4aPattDlgRow";
    var l = document.createElement("label");
    l.className = "u4aPattDlgLbl";
    l.textContent = sLabel;
    var c = document.createElement("div");
    c.className = "u4aPattDlgCtl";
    c.appendChild(oControl);
    r.appendChild(l);
    r.appendChild(c);
    return r;
}

// 생성/수정 다이얼로그 1회 생성(싱글톤, data-u4a-keep 로 유지 → Monaco 재로드 방지).
function _ensureCreateDlg() {
    if (oDlgUI) { return; }

    var oDlg = document.createElement("dialog");
    oDlg.className = "u4a-dialog u4aPattDlg";
    oDlg.setAttribute("data-u4a-keep", "");   // 전역 자동 닫기(_installGlobalDialogClose) 제외 → 호스트 유지

    // 헤더(48px) — 아이콘 + 제목.
    var oHead = document.createElement("div");
    oHead.className = "u4a-dialog__header";
    var oIcon = document.createElement("i");
    oIcon.className = "fa-solid fa-square-plus";
    var oTitle = document.createElement("span");
    oTitle.className = "u4a-dialog__title";
    oHead.appendChild(oIcon);
    oHead.appendChild(oTitle);
    oDlg.appendChild(oHead);

    // 본체 — 폼(Title, Content Type) + Pretty Print 툴바 + 편집 호스트.
    var oBody = document.createElement("div");
    oBody.className = "u4a-dialog__body u4aPattDlgBody";

    var oForm = document.createElement("div");
    oForm.className = "u4aPattDlgForm";
    var oTitleField = U4AUI.createField({ type: "text", value: "", clear: true, className: "u4aPattDlgTitle" });   // X(clear)=값 있을 때만(§15 §2)
    var oTypeSel = U4AUI.createSelect(
        A_CONT_TYPES.map(function (t) { return { value: t, text: t }; }),
        "text",
        function (sVal) { _toEditHost({ cmd: "setLanguage", language: _lang(sVal) }); }
    );
    oForm.appendChild(_dlgRow(_m("024"), oTitleField.el));   // Title
    oForm.appendChild(_dlgRow(_m("023"), oTypeSel));         // Content Type
    oBody.appendChild(oForm);

    var oEdWrap = document.createElement("div");
    oEdWrap.className = "u4aPattDlgEditor";
    var oHost = document.createElement("iframe");
    oHost.id = "pattEditHost";
    oHost.setAttribute("frameborder", "0");
    var oEPARAMS = { HOSTID: C_EDIT_HOSTID, LANG: "plaintext", THEME: _monacoThemeFromBg(BGCOL), READONLY: false };
    oHost.src = "../editorPopup/host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oEPARAMS));
    oEdWrap.appendChild(oHost);
    oBody.appendChild(oEdWrap);

    oDlg.appendChild(oBody);

    // 푸터 = [줌 −/%/+ (왼쪽)] ···· [꾸밈정렬 · 복사 · Save · Delete(수정) · Close (오른쪽)].
    //   공통 JS 에디터(ws_html5_client_editor) 크롬 미러. 줌은 공통 호스트 fontZoom* 명령·evt:zoom.
    var oFoot = document.createElement("div");
    oFoot.className = "u4a-dialog__footer u4aPattDlgFoot";

    // 줌 컨트롤 [−][🔍 NNN%][+] — 상시표시(Ctrl+휠 몰라도 발견 가능). %클릭=원복(Ctrl+0).
    var oZoom = document.createElement("div");
    oZoom.className = "u4aPattDlgZoom";
    var oZoomOut = document.createElement("button");
    oZoomOut.type = "button";
    oZoomOut.className = "u4a-btn u4aPattDlgFlat u4aPattDlgZoomStep";
    oZoomOut.innerHTML = '<i class="fa-solid fa-minus"></i>';
    oZoomOut.title = "Ctrl + Wheel ↓";
    oZoomOut.addEventListener("click", function () { _toEditHost({ cmd: "fontZoomOut" }); });
    var oZoomBtn = document.createElement("button");
    oZoomBtn.type = "button";
    oZoomBtn.className = "u4a-btn u4aPattDlgFlat u4aPattDlgZoomPct";
    oZoomBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span>100%</span>';
    oZoomBtn.addEventListener("click", function () { _toEditHost({ cmd: "fontZoomReset" }); });
    var oZoomIn = document.createElement("button");
    oZoomIn.type = "button";
    oZoomIn.className = "u4a-btn u4aPattDlgFlat u4aPattDlgZoomStep";
    oZoomIn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    oZoomIn.title = "Ctrl + Wheel ↑";
    oZoomIn.addEventListener("click", function () { _toEditHost({ cmd: "fontZoomIn" }); });
    oZoom.appendChild(oZoomOut); oZoom.appendChild(oZoomBtn); oZoom.appendChild(oZoomIn);
    oFoot.appendChild(oZoom);

    var oFootSpacer = document.createElement("span");
    oFootSpacer.className = "u4aPattDlgFootSpacer";
    oFoot.appendChild(oFootSpacer);

    // 꾸밈정렬(Pretty Print) — 텍스트 버튼(투명 중립), 결정 그룹 앞.
    var oPretty = document.createElement("button");
    oPretty.type = "button";
    oPretty.className = "u4a-btn u4aPattDlgFlat u4aPattPrettyBtn";
    oPretty.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span></span>';
    oPretty.querySelector("span").textContent = _mc("/U4A/CL_WS_COMMON", "C25");   // 꾸밈정렬(Pretty Print)
    oPretty.title = _mc("/U4A/CL_WS_COMMON", "C25") + " (Shift+F1)";
    oPretty.addEventListener("click", function () { _toEditHost({ cmd: "format" }); });
    oFoot.appendChild(oPretty);

    // Save(✓, 파랑 emphasized)
    var oSave = document.createElement("button");
    oSave.type = "button";
    oSave.className = "u4a-btn u4a-btn--emphasized u4aPattDlgIcoBtn";
    oSave.innerHTML = '<i class="fa-solid fa-check"></i>';
    oSave.title = _mc("/U4A/CL_WS_COMMON", "A64");   // Save
    oSave.addEventListener("click", function () { _saveCreateDlg(); });
    oFoot.appendChild(oSave);

    // Delete(🗑, 빨강 solid) — 수정 모드에서만 표시(생성 모드 hidden). 현재 커스텀 패턴 삭제 후 닫기.
    var oDel = document.createElement("button");
    oDel.type = "button";
    oDel.className = "u4a-btn u4aPattDlgIcoBtn u4aPattDlgDel";
    oDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    oDel.title = _m("029");   // Delete
    oDel.hidden = true;
    oDel.addEventListener("click", function () { _deleteFromDlg(); });
    oFoot.appendChild(oDel);

    // Close(✗, negative)
    var oCancel = document.createElement("button");
    oCancel.type = "button";
    oCancel.className = "u4a-btn u4a-btn--negative u4aPattDlgIcoBtn";
    oCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    oCancel.title = _mc("/U4A/CL_WS_COMMON", "A39");   // Close
    oCancel.addEventListener("click", function () { _closeCreateDlg(); });
    oFoot.appendChild(oCancel);

    oDlg.appendChild(oFoot);

    // ESC 무시(원본 escapeHandler:{} — 편집 중 실수로 닫혀 입력 손실되는 것 방지. 닫기는 취소 버튼으로만).
    oDlg.addEventListener("cancel", function (e) { e.preventDefault(); });

    try { if (U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHead); } } catch (e) { }
    try { if (U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 480, minH: 360 }); } } catch (e) { }

    document.body.appendChild(oDlg);

    oDlgUI = {
        dlg: oDlg, host: oHost, icon: oIcon, title: oTitle,
        titleField: oTitleField, typeSel: oTypeSel, prettyBtn: oPretty,
        zoomBtn: oZoomBtn, delBtn: oDel,
        ready: false, pending: null, PRCCD: "C", CKEY: ""
    };
}

// 생성/수정 다이얼로그 열기.
function _openCreateDlg(oParam) {
    _ensureCreateDlg();
    oParam = oParam || { PRCCD: "C" };
    oDlgUI.PRCCD = oParam.PRCCD || "C";
    oDlgUI.CKEY = oParam.CKEY || "";

    var bU = (oDlgUI.PRCCD === "U");
    oDlgUI.icon.className = "fa-solid " + (bU ? "fa-pen-to-square" : "fa-square-plus");
    oDlgUI.title.textContent = _m("022") + " " + (bU ? _m("030") : _m("026"));   // Custom Pattern Change / Create
    if (oDlgUI.delBtn) { oDlgUI.delBtn.hidden = !bU; }   // 삭제 = 수정 모드만(생성 모드엔 삭제 대상 없음)

    oDlgUI.titleField.setValue(oParam.DESC || "");
    oDlgUI.titleField.setValueState("none");
    var sType = oParam.CONT_TYPE || "text";
    oDlgUI.typeSel.value = sType;

    var oApply = { CONT_TYPE: sType, DATA: oParam.DATA };
    if (oDlgUI.ready) { _applyEditor(oApply); }
    else { oDlgUI.pending = oApply; }

    if (!oDlgUI.dlg.open) { try { oDlgUI.dlg.showModal(); } catch (e) { } }
    setTimeout(function () {
        try { oDlgUI.titleField.focus(); } catch (e) { }
        _toEditHost({ cmd: "layout" });   // 다이얼로그 표시 후 에디터 레이아웃 재계산
    }, 0);
}

function _closeCreateDlg() {
    if (oDlgUI && oDlgUI.dlg && oDlgUI.dlg.open) { try { oDlgUI.dlg.close(); } catch (e) { } }
}

// 저장(원본 ev_CustCreateDlgSave) — 검증 먼저(validate-first) → CUST_PATT fresh 갱신 → 재로드·재선택.
function _saveCreateDlg() {
    if (!oDlgUI) { return; }

    var sDesc = (oDlgUI.titleField.getValue() || "").trim();
    if (!sDesc) {
        oDlgUI.titleField.setValueState("error", _m("027", _m("024")));   // title is required entry value(&1=Title)
        try { oDlgUI.titleField.focus(); } catch (e) { }
        return;
    }
    oDlgUI.titleField.setValueState("none");

    var sData = _readEditHost();
    if (sData === null) { sData = ""; }
    var sType = oDlgUI.typeSel.value || "text";

    // 원본과 동일 — 파일 fresh 읽기(트리 노드의 _ch/_parent 오염 회피).
    var aFlat = _readPatternJson(PATHINFO.CUST_PATT);
    var sSelKey = "";
    if (oDlgUI.PRCCD === "C") {
        var sKey = WSUTIL.getRandomKey();
        sSelKey = sKey;
        aFlat.push({ PKEY: "PATT002", CKEY: sKey, DESC: sDesc, DATA: sData, CONT_TYPE: sType });   // 커스텀 루트 하위
    } else {
        sSelKey = oDlgUI.CKEY;
        var iF = aFlat.findIndex(function (e) { return e && e.CKEY === oDlgUI.CKEY; });
        if (iF >= 0) { aFlat[iF] = Object.assign({}, aFlat[iF], { DESC: sDesc, DATA: sData, CONT_TYPE: sType }); }
    }

    if (!_writeCust(aFlat)) { return; }

    _closeCreateDlg();
    _reloadCust(sSelKey);
    _toast(_m("007"));   // Saved success
}

// 삭제(원본 ev_pressCustomPatternDelete) — 확인 후 splice.
function _deleteCust(oNode) {
    if (!oNode || !oNode.CKEY) { return; }
    _selectPattern(oCustTree, oDefTree, oNode);   // 삭제 전 해당 행 선택 표시(원본)
    U4AUI.confirm({
        type: "W",
        title: _m("022") + " " + _m("029"),                          // Custom Pattern Delete
        message: "[" + (oNode.DESC || "") + "]\n\n" + _m("028"),      // Do you really want to delete the object?
        yesLabel: _m("038"),   // YES
        noLabel: _m("039"),    // NO
        onClose: function (sAct) {
            if (sAct !== "YES") { return; }
            var aFlat = _readPatternJson(PATHINFO.CUST_PATT);
            var iF = aFlat.findIndex(function (e) { return e && e.CKEY === oNode.CKEY; });
            if (iF < 0) { return; }
            aFlat.splice(iF, 1);
            if (!_writeCust(aFlat)) { return; }
            _reloadCust("");
            if (oCustTree) { _tof(oCustTree).selectByKey(""); }
            _showEmpty();
            _toast(_m("008"));   // Delete success
        }
    });
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
    var sMon = _monacoThemeFromBg(oTheme.BGCOL);
    _toHost({ cmd: "setTheme", theme: sMon });
    _toEditHost({ cmd: "setTheme", theme: sMon });   // 생성 다이얼로그 편집기도 동기(있을 때)
}

// 원본 opener 가 did-finish-load 에 보내는 테마정보(IPC 계약 유지) — 받으면 테마 재적용.
function _onPatternInfo(event, oInfo) {
    var oTheme = (oInfo && oInfo.oThemeInfo) || null;
    if (!oTheme || !oTheme.THEME) { return; }
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } } catch (e) { }
    if (oTheme.BGCOL) { BGCOL = oTheme.BGCOL; }
    _toHost({ cmd: "setTheme", theme: _monacoThemeFromBg(BGCOL) });
}

/* ── 호스트 → 창 메시지(뷰어 U4APATT / 편집기 U4APATTEDIT) ─────────────────── */
function _onHostMessage(oEvent) {
    var d = oEvent && oEvent.data;
    if (!d || d.__u4aedh !== true) { return; }

    // 우측 읽기전용 뷰어 호스트.
    if (d.hostId === C_HOSTID) {
        if (d.evt === "ready") {
            oState.ready = true;
            if (oState.pending) { var n = oState.pending; oState.pending = null; _showCode(n); }
            _finishOpen();
        } else if (d.evt === "zoom") {
            _setViewZoom(d.pct);   // 뷰어 헤더 줌 % 실시간 갱신(Ctrl+휠/버튼)
        }
        return;
    }

    // 생성/수정 다이얼로그 편집 호스트.
    if (d.hostId === C_EDIT_HOSTID && oDlgUI) {
        if (d.evt === "ready") {
            oDlgUI.ready = true;
            if (oDlgUI.pending) { var p = oDlgUI.pending; oDlgUI.pending = null; _applyEditor(p); }
        } else if (d.evt === "save") {
            if (oDlgUI.dlg && oDlgUI.dlg.open) { _saveCreateDlg(); }   // 에디터 Ctrl+S
        } else if (d.evt === "zoom") {
            _setDlgZoom(d.pct);   // 푸터 줌 % 실시간 갱신(Ctrl+휠/버튼)
        }
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

    // 코드 뷰어 줌 [−][🔍%][+] — 뷰어 호스트 폰트 줌 명령(공통 fontZoom*), evt:zoom 으로 % 실시간 갱신(Ctrl+휠/버튼).
    var oVZOut = document.getElementById("pattViewZoomOut");
    var oVZBtn = document.getElementById("pattViewZoomBtn");
    var oVZIn = document.getElementById("pattViewZoomIn");
    if (oVZOut) { oVZOut.addEventListener("click", function () { _toHost({ cmd: "fontZoomOut" }); }); }
    if (oVZBtn) { oVZBtn.title = "100% (Ctrl+0)"; oVZBtn.addEventListener("click", function () { _toHost({ cmd: "fontZoomReset" }); }); }
    if (oVZIn) { oVZIn.addEventListener("click", function () { _toHost({ cmd: "fontZoomIn" }); }); }

    // 복사 버튼(원본 우측 헤더 copy — clipboard.writeText + 031 토스트).
    var oCopy = document.getElementById("pattCopyBtn");
    if (oCopy) {
        oCopy.title = _mc("/U4A/CL_WS_COMMON", "A04");   // Copy (동작 라벨 — 성공 토스트 031 "복사 완료!"를 툴팁에 쓰면 안 됨)
        oCopy.addEventListener("click", function () {
            if (!oState.cur || typeof oState.cur.DATA !== "string") { return; }
            try { REMOTE.clipboard.writeText(oState.cur.DATA); }
            catch (e) {
                try { REMOTE.require('electron').clipboard.writeText(oState.cur.DATA); } catch (e2) { }
            }
            _toast(_m("031"));   // Clipboard Copy Success!
        });
    }

    // 커스텀 패턴 Create 버튼(원본 커스텀 트리 footer Create).
    var oCreateBtn = document.getElementById("pattCustCreateBtn");
    if (oCreateBtn) {
        var oCBS = oCreateBtn.querySelector("span");
        if (oCBS) { oCBS.textContent = _m("026"); }   // Create
        oCreateBtn.title = _m("026");
        oCreateBtn.addEventListener("click", function () { _openCreateDlg({ PRCCD: "C", CONT_TYPE: "text" }); });
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
    _initCustWatch();   // 커스텀 패턴 파일 외부 변경 라이브 반영(원본 fnSetPatternFileWatch)

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
    try { if (oCustWatcher) { oCustWatcher.close(); oCustWatcher = null; } } catch (e) { }   // watch 정리(누수 방지)
};
