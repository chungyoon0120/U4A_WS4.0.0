/****************************************************************************
 * 버전 관리(Version Management) 창 로직 (versionMngFrame.js)
 * --------------------------------------------------------------------------
 *  원본: Popups/versionManagement (UI5 별도 BrowserWindow).
 *    index.html→index.js(IPC if-version-management)→frame.html→frame.js(UI5 부트)→
 *    views/vw_main(view.js: App+Page+Vertical Splitter+sap.ui.table.Table+Monaco diff iframe / control.js: 로직).
 *  HTML5: 드래그 가능한 공통 .u4a-titlebar 는 최상위 문서에 있어야 하므로(MIME/오류페이지 에디터와 동일),
 *    **최상위 창**에 [공통 타이틀바 + 세로 스플리터(버전 .u4a-table / Monaco diff 호스트)]를 두고,
 *    diff 영역만 전용 Monaco diff 호스트(versionMng/host)를 iframe 으로 임베드한다(2단 iframe → 1단).
 *
 *  ★ 원본 보존(1:1):
 *   · 서버 계약: /get_app_ver_list(APPID) → T_APP_VER_LIST.
 *               /compare_app_ctrl_abap(APPID,VPOSN_A,VPOSN_B) → RDATA{ABAP_A,ABAP_B,...}.
 *               /create_temp_ver_app(APPID,VPOSN) → RDATA{TAPPID}. (응답헤더 u4a_status=UA0001 미지원)
 *   · 목록 컬럼: 상태 / App ID(+새창보기) / App Version / Compare(기준·대상 라디오) / Request No /
 *               Request Desc / Package / Create Date·Time·User. (원본 sap.ui.table.Column 순서/폭 대응)
 *   · 비교: 기준+대상 라디오 선택 → "비교하기" → diff 패널 표시 + 두 ABAP 소스 좌우 비교(읽기전용).
 *           ▲/▼ = 변경 위치 이동(diffNavigator), 범례 = 추가/삭제 색 안내, X = 비교 패널 닫기.
 *   · 새창보기: TAPPID/TCLSID 있는(=과거) 버전만 → 확인 → /create_temp_ver_app → IPC
 *               ${BROWSKEY}-if-version-management-new-window { TAPPID } → opener 가 WS20 새창(MOVE20).
 *   · 메시지: 전부 ZMSG_WS_COMMON_001 키(원본 control.js getWsMsgClsTxt 동일 번호) — 임의 생성 없음.
 *  ★ UI5 의존부 치환: sap.ui.table.Table→공통 .u4a-table(박스형 그리드, App Search 2탭 톤),
 *     Vertical Splitter→공통 .u4a-splitter(세로), ObjectStatus 아이콘→FA(현재=녹색 사각형/과거=주황 삼각형),
 *     MessageBox→공통 U4AUI.confirm, MessageToast→공통 .u4a-toast,
 *     ResponsivePopover(legend)→경량 팝오버, sap.applyTheme→U4ATheme.apply(라이브 추종).
 *
 *  ※ var 선언이어야 호스트 iframe 에서 parent.PATH/APPPATH 접근 가능(에디터 호스트 시리즈와 동일).
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

// 전용 Monaco diff 호스트(versionMng/host) 채널 태그 = __u4avmh, HOSTID = 화면별 식별자.
var C_HOSTID = "U4AVMH";

// 현재 상태.
var oState = {
    sServerPath: "",   // 서버 Url (원본 oAPP.IF_DATA.sServerPath)
    oAppInfo: null,    // 편집 중 앱 정보 { APPID, ... }
    aVerList: [],      // 버전 목록(T_APP_VER_LIST 정규화)
    hostReady: false,  // diff 호스트 로드 완료 여부
    diffOpen: false,   // 비교 패널 표시 여부
    diffFull: false    // 비교 패널 전체창 여부
};

var oFrame = null, bBusy = false, oToastTimer = null, bOpenDone = false;
var oBroad = null, fnHostReadyWait = null, iOpenWatch = null;

/* ── 메시지 헬퍼 ──────────────────────────────────────────────────────── */
// ZMSG_WS_COMMON_001 — 원본 control.js 와 동일 번호(getWsMsgClsTxt). UI 텍스트는 키만(임의 생성 금지).
function _z(sNo) {
    try { return WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo) || ""; } catch (e) { return ""; }
}
// /U4A/CL_WS_COMMON — 확인창 제목 등.
function _c(sCode) {
    try { return WSMSG.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, "", "", "", "") || ""; } catch (e) { return ""; }
}

/* ── 테마 헬퍼(에디터 호스트 시리즈와 동일 판정) ─────────────────────────── */
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

function _getThemeInfo() {
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) { return null; }
}

/* ── 호스트 통신 ──────────────────────────────────────────────────────── */
function _toHost(oMsg) {
    try {
        oMsg = oMsg || {};
        oMsg.__u4avmh = true;
        oMsg.hostId = C_HOSTID;
        if (oFrame && oFrame.contentWindow) { oFrame.contentWindow.postMessage(oMsg, "*"); }
    } catch (e) { }
}

/* ── Busy(★공통 .u4a-busy★ + 닫기 차단 + 자식창 브로드캐스트) ─────────────
   ServerList setBusyIndicator 와 동일: data-busy 토글 + 안내문구는 .u4a-busy__label
   (없으면 생성, 비면 :empty 로 자동 숨김 — 구 BusyDialog DESC). */
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oDom = document.getElementById("vmBusy");
    if (oDom) {
        oDom.dataset.busy = bBusy ? "true" : "false";
        var oCard = oDom.querySelector(".u4a-busy__card");
        if (oCard) {
            var oLabel = oCard.querySelector(".u4a-busy__label");
            if (!oLabel) {
                oLabel = document.createElement("div");
                oLabel.className = "u4a-busy__label";
                oCard.appendChild(oLabel);
            }
            oLabel.textContent = (bBusy && oOpt && oOpt.DESC) ? oOpt.DESC : "";
        }
    }
    // busy 동안 입력 차단(공통 패턴) — 오버레이가 data-busy 시 pointer-events:auto 라 카드는 살아있음.
    document.body.style.pointerEvents = bBusy ? "none" : "";
    // ★ 창은 항상 closable:false 유지(Alt+F4·OS X 차단) — 닫기는 _closeWindow 가 setClosable(true) 후에만.
    //   (MIME/다른 별도창과 동일 패턴. busy 중엔 _onCloseBtn 의 busy 체크가, 평상시엔 OS closable=false 가 막는다.)
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 오픈 busy 는 "한 번 켜서 끝까지 유지 → 목록 렌더(또는 오류) 시 1회만 해제"(에디터 시리즈 정책).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { clearTimeout(iOpenWatch); } catch (e) { } iOpenWatch = null;
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    var oC = document.getElementById("vmContent");
    if (oC) { oC.classList.add("u4aVmShown"); }
}

/* ── 창 닫기 — 항상 closable:false 로 열렸으니 풀고 닫는다. 공통 SSOT U4AUI.closeWindow 위임. ── */
function _closeWindow() {
    if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); return; }
    try {
        if (!CURRWIN.isDestroyed()) {
            CURRWIN.setClosable(true);
            CURRWIN.close();
        }
    } catch (e) { /* 이미 파괴된 창 무시 */ }
}

/* X 버튼 클릭 — busy 중이면 무시(닫기 차단), 아니면 닫는다. */
function _onCloseBtn() {
    if (bBusy) { return; }
    _closeWindow();
}

/* ── 토스트(공통 .u4a-toast — 화면 정중앙. shell.css 단일 출처) ──────────── */
function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("u4aVmToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "u4aVmToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

/* ── 치명적 서버/통신 오류 → 메시지(OK) 후 창 닫기(원본 _sendAjax onClose=CURRWIN.close) ── */
function _fatal(sType, sMsg) {
    _setBusy(false);
    var sTitle = (sType === "W") ? _c("B89") : _c("B93");   // Warning / Error
    var sOk = "OK";
    if (window.U4AUI && U4AUI.confirm) {
        U4AUI.confirm({
            type: sType || "E", title: sTitle, message: sMsg || "",
            buttons: [{ act: "OK", label: sOk, emphasized: true }],
            onClose: function () { _closeWindow(); }
        });
    } else {
        try { window.alert(sMsg || ""); } catch (e) { }
        _closeWindow();
    }
}

/* ── 공통 POST(FormData) — 원본 _sendAjax 의 u4a_status / 통신오류 처리 보존 ─────────── */
function _post(sPath, oForm) {
    return new Promise(function (resolve) {
        var resp = null;
        fetch(sPath, { method: "POST", body: oForm, cache: "no-store" })
            .then(function (r) {
                resp = r;
                var sStatus = "";
                try { sStatus = r.headers.get("u4a_status") || ""; } catch (e) { sStatus = ""; }
                if (sStatus) {
                    if (sStatus === "UA0001") {
                        // 현재 서버는 이 기능을 지원하지 않음(M016=390).
                        _fatal("W", _z("390"));
                    } else {
                        // 알 수 없는 오류(M017=314) + 안내(290).
                        console.error("[HTML5][versionMng] u4a_status=" + sStatus + " / REQ=" + sPath);
                        _fatal("E", _z("314") + "\n\n" + _z("290"));
                    }
                    return resolve(null);
                }
                return r.json().then(function (data) { resolve(data); });
            })
            .catch(function (e) {
                console.error("[HTML5][versionMng] _post 실패 REQ=" + sPath + " / " + (e && e.message));
                // 통신 오류(M018=391).
                _fatal("E", _z("391"));
                resolve(null);
            });
    });
}

/* ── 날짜/시간 no-zero 포맷(원본 formatterNoZeroDate/Time) ───────────────── */
function _fmtDate(s) {
    if (!s || s === "00000000" || s.length < 8) { return ""; }
    return s.substr(0, 4) + "-" + s.substr(4, 2) + "-" + s.substr(6, 2);
}
function _fmtTime(s) {
    if (!s || s === "000000" || s.length < 6) { return ""; }
    return s.substr(0, 2) + ":" + s.substr(2, 2) + ":" + s.substr(4, 2);
}

/* ── 버전 목록 서버 조회 + 정규화(원본 _setVersionList) ──────────────────── */
function _loadVersionList() {
    return new Promise(function (resolve) {
        var oForm = new FormData();
        oForm.append("APPID", (oState.oAppInfo && oState.oAppInfo.APPID) || "");

        _post(oState.sServerPath + "/get_app_ver_list", oForm).then(function (oRes) {
            if (!oRes) { return resolve(false); }     // _post 가 이미 치명오류 처리.

            if (oRes.RETCD === "E") {
                // [STCOD]: <MSGNR 본문> + 안내(290). (원본 동일 — 창 닫기)
                var sMsg = "[" + (oRes.STCOD || "") + "]: " + _z(oRes.MSGNR) + "\n\n" + _z("290");
                _fatal("E", sMsg);
                return resolve(false);
            }

            var aSrc = oRes.T_APP_VER_LIST || [];
            var aOut = [];
            for (var i = 0; i < aSrc.length; i++) {
                var o = aSrc[i];
                aOut.push({
                    // 현재(Current=VPOSN 0)=Success, 그외=Warning(원본 _STATUS/_STATUS_ICON 대응).
                    isCurrent: (o.VPOSN === 0 || o.VPOSN === "0"),
                    APPID: o.APPID || "",
                    CLSID: o.CLSID || "",
                    CTSNO: o.CTSNO || "",
                    CTSTX: o.CTSTX || "",
                    ERDAT: o.ERDAT || "",
                    ERTIM: o.ERTIM || "",
                    ERUSR: o.ERUSR || "",
                    PACKG: o.PACKG || "",
                    TAPPID: o.TAPPID || "",
                    TCLSID: o.TCLSID || "",
                    VPOSN: o.VPOSN
                });
            }
            oState.aVerList = aOut;
            resolve(true);
        });
    });
}

/* ════════════════════════════════════════════════════════════════════════
   버전 목록 테이블 — sap.ui.table.Table 고정컬럼 재현(2-pane).
   · 넓을 때(고정모드): [고정 테이블(상태·App ID·App Ver·Compare) | 스크롤 테이블(나머지)]
     → 가로 스크롤바가 **스크롤 영역에만**, 세로 스크롤/휠/hover/필러/라디오선택 동기화.
   · 창이 고정폭보다 좁을 때(평면모드): 고정 풀고 전체 컬럼을 한 컨테이너에서 가로 스크롤.
   공통 .u4a-table(헤더/zebra/no-data) 소비 + 화면 전용 .u4aVm* 골격만 덧댐(공통 미수정).
   ════════════════════════════════════════════════════════════════════════ */

var C_FROZEN_REM = 41;     // 고정 컬럼 폭 합(상태5+App ID16+App Ver6+Compare14)
var C_MIN_SCROLL = 120;    // 고정 유지에 필요한 최소 스크롤 영역(px)

function _ce(sTag, sCls) { var o = document.createElement(sTag); if (sCls) { o.className = sCls; } return o; }
function _remPx() { try { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; } catch (e) { return 16; } }
function _frozenPx() { return C_FROZEN_REM * _remPx(); }

// 컬럼 정의(헤더 라벨=메시지 키). frozen=true 4개가 고정 테이블, 나머지가 스크롤 테이블.
function _colDefs() {
    return [
        { key: "status", cls: "u4a-c-vmstatus", label: _z("380"), frozen: true },   // 상태
        { key: "appid", cls: "u4a-c-vmappid", label: _z("381"), frozen: true },     // 어플리케이션 ID
        { key: "ver", cls: "u4a-c-vmver", label: _z("383"), frozen: true },         // App Version
        { key: "cmp", cls: "u4a-c-vmcmp", label: _z("382"), frozen: true },         // Compare(Base/Target)
        { key: "reqno", cls: "u4a-c-vmreqno", label: _z("384"), frozen: false },    // Request No.
        { key: "reqtx", cls: "u4a-c-vmreqtx", label: _z("385"), frozen: false },    // Request Desc.
        { key: "pkg", cls: "u4a-c-vmpkg", label: _z("386"), frozen: false },        // Package
        { key: "date", cls: "u4a-c-vmdate", label: _z("387"), frozen: false },      // Create Date
        { key: "time", cls: "u4a-c-vmtime", label: _z("388"), frozen: false },      // Create Time
        { key: "usr", cls: "u4a-c-vmusr", label: _z("389"), frozen: false }         // Create User
    ];
}

// 셀 1개 생성(컬럼 key 별) — 원본 동작 1:1.
function _buildCell(oCol, oRow) {
    var oTd = _ce("td", oCol.cls);
    switch (oCol.key) {
        case "status": {
            // 현재(VPOSN 0)=녹색 사각형(color-fill), 과거=주황 삼각형(triangle).
            var oIc = _ce("i", oRow.isCurrent
                ? "fa-solid fa-square u4aVmStatusIcon u4aVmStatusIcon--ok"
                : "fa-solid fa-triangle-exclamation u4aVmStatusIcon u4aVmStatusIcon--old");
            oIc.setAttribute("aria-hidden", "true");
            oTd.appendChild(oIc);
            break;
        }
        case "appid": {
            var oBox = _ce("span", "u4aVmAppId");
            var oTxt = _ce("span", "u4aVmAppIdTxt");
            oTxt.textContent = oRow.APPID; oTxt.title = oRow.APPID;
            var oOpen = _ce("button", "u4a-btn u4aVmOpenBtn");
            oOpen.type = "button";
            oOpen.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i>';
            oOpen.title = _z("407");   // 새창으로 보기
            // 활성 규칙(원본 formatter): TAPPID/TCLSID/VPOSN 모두 비어있으면 비활성.
            oOpen.disabled = (oRow.TAPPID === "" && oRow.TCLSID === "" && (oRow.VPOSN === 0 || oRow.VPOSN === "0"));
            oOpen.addEventListener("click", function () { _onOpenNewWindow(oRow); });
            oBox.appendChild(oTxt); oBox.appendChild(oOpen);
            oTd.appendChild(oBox);
            break;
        }
        case "ver":
            oTd.textContent = oRow.VPOSN;
            break;
        case "cmp": {
            // 기준/대상 라디오 — name 공유로 전 행 중 1개만(원본 groupName g1/g2).
            var oC = _ce("span", "u4aVmCmpCell");
            var oLb = _ce("label", "u4aVmRadio");
            var oRb = _ce("input"); oRb.type = "radio"; oRb.name = "vmBase"; oRb.value = String(oRow._idx);
            var oSb = _ce("span"); oSb.textContent = _z("394");   // 비교 기준
            oLb.appendChild(oRb); oLb.appendChild(oSb);
            var oLt = _ce("label", "u4aVmRadio");
            var oRt = _ce("input"); oRt.type = "radio"; oRt.name = "vmTarget"; oRt.value = String(oRow._idx);
            var oSt = _ce("span"); oSt.textContent = _z("395");   // 비교 대상
            oLt.appendChild(oRt); oLt.appendChild(oSt);
            oC.appendChild(oLb); oC.appendChild(oLt);
            oTd.appendChild(oC);
            break;
        }
        case "reqno": oTd.textContent = oRow.CTSNO || ""; if (oRow.CTSNO) { oTd.title = oRow.CTSNO; } break;
        case "reqtx": oTd.textContent = oRow.CTSTX || ""; if (oRow.CTSTX) { oTd.title = oRow.CTSTX; } break;
        case "pkg": oTd.textContent = oRow.PACKG || ""; break;
        case "date": oTd.textContent = _fmtDate(oRow.ERDAT); if (oRow.ERDAT) { oTd.title = oRow.ERDAT; } break;
        case "time": oTd.textContent = _fmtTime(oRow.ERTIM); if (oRow.ERTIM) { oTd.title = oRow.ERTIM; } break;
        case "usr": oTd.textContent = oRow.ERUSR || ""; break;
        default: break;
    }
    return oTd;
}

// 테이블 1개(헤더 + 데이터 행) 생성. 반환 {table, thead, tbody}.
function _buildOneTable(aCols, sModCls) {
    var oTable = _ce("table", "u4a-table u4aVmTbl " + sModCls);
    var oThead = _ce("thead");
    var oTrH = _ce("tr");
    aCols.forEach(function (c) {
        var oTh = _ce("th", c.cls);
        oTh.textContent = c.label;
        oTrH.appendChild(oTh);
    });
    oThead.appendChild(oTrH); oTable.appendChild(oThead);

    var oTbody = _ce("tbody");
    oState.aVerList.forEach(function (oRow, idx) {
        oRow._idx = idx;
        var oTr = _ce("tr");
        oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";
        oTr.dataset.rowIdx = String(idx);
        aCols.forEach(function (c) { oTr.appendChild(_buildCell(c, oRow)); });
        oTbody.appendChild(oTr);
    });
    oTable.appendChild(oTbody);
    return { table: oTable, thead: oThead, tbody: oTbody };
}

// 라디오 선택 상태 캡처/복원(모드 전환 재빌드 시 유지).
function _captureSel() {
    var b = document.querySelector('input[name="vmBase"]:checked');
    var t = document.querySelector('input[name="vmTarget"]:checked');
    return { base: b ? b.value : null, target: t ? t.value : null };
}
function _restoreSel(oSel) {
    if (!oSel) { return; }
    if (oSel.base != null) { var b = document.querySelector('input[name="vmBase"][value="' + oSel.base + '"]'); if (b) { b.checked = true; } }
    if (oSel.target != null) { var t = document.querySelector('input[name="vmTarget"][value="' + oSel.target + '"]'); if (t) { t.checked = true; } }
}

// 행 hover 동기화(고정/스크롤 같은 행 동시 강조).
function _wireHoverSync(oFb, oSb) {
    function set(sIdx, bOn) {
        [oFb, oSb].forEach(function (tb) {
            if (!tb) { return; }
            var tr = tb.querySelector('tr[data-row-idx="' + sIdx + '"]');
            if (tr) { tr.classList.toggle("is-hover", bOn); }
        });
    }
    [oFb, oSb].forEach(function (tb) {
        if (!tb) { return; }
        tb.addEventListener("mouseover", function (e) { var tr = e.target.closest && e.target.closest("tr[data-row-idx]"); if (tr) { set(tr.dataset.rowIdx, true); } });
        tb.addEventListener("mouseout", function (e) { var tr = e.target.closest && e.target.closest("tr[data-row-idx]"); if (tr) { set(tr.dataset.rowIdx, false); } });
    });
}

// 고정 유지 여부(히스테리시스 — 경계 깜빡임 방지).
function _wantFrozen(iW) {
    var fp = _frozenPx();
    if (oState.tableMode === "frozen") { return iW >= fp + 60; }   // 고정 중엔 조금 좁아져도 유지
    return iW >= fp + C_MIN_SCROLL;                                 // 평면 중엔 충분히 넓어야 고정
}

/* ── 테이블 렌더(진입) — 박스 영역(persistent) 확보 후 빌드. ── */
function _renderTable() {
    var oHost = document.getElementById("vmTableWrap");
    if (!oHost) { return; }
    var oArea = oHost.querySelector(".u4aVmArea");
    if (!oArea) {
        oHost.innerHTML = "";
        oArea = _ce("div", "u4aVmArea");
        oHost.appendChild(oArea);
    }
    oState.tableMode = null;   // 강제 빌드
    _buildTable(oArea);
}

/* ── 모드 판정 + DOM 빌드(고정 2-pane / 평면 단일). ── */
function _buildTable(oArea) {
    var iW = oArea.clientWidth;
    var bFrozen = oState.aVerList.length ? _wantFrozen(iW) : false;

    var oSel = _captureSel();     // 재빌드 전 선택 유지
    oArea.innerHTML = "";
    oState._panes = null;

    // 데이터 없음 — 평면 단일 테이블 + 공통 no-data 행.
    if (!oState.aVerList.length) {
        oState.tableMode = "flat";
        var oGridE = _ce("div", "u4aVmGrid"); oGridE.dataset.mode = "flat";
        var oSPE = _ce("div", "u4aVmGrid__scroll");
        var aAllE = _colDefs();
        var oTblE = _ce("table", "u4a-table u4aVmTbl u4aVmTbl--flat");
        var oThE = _ce("thead"); var oTrHE = _ce("tr");
        aAllE.forEach(function (c) { var th = _ce("th", c.cls); th.textContent = c.label; oTrHE.appendChild(th); });
        oThE.appendChild(oTrHE); oTblE.appendChild(oThE);
        var oTbE = _ce("tbody"); var oTrE = _ce("tr");
        var oTdE = _ce("td", "u4a-table__nodata"); oTdE.colSpan = aAllE.length; oTdE.textContent = _z("946");
        oTrE.appendChild(oTdE); oTbE.appendChild(oTrE); oTblE.appendChild(oTbE);
        oSPE.appendChild(oTblE); oGridE.appendChild(oSPE); oArea.appendChild(oGridE);
        oState._panes = { scroll: oSPE, frozen: null, sbody: oTbE, fbody: null, shead: oThE, fhead: null };
        return;
    }

    oState.tableMode = bFrozen ? "frozen" : "flat";
    var aCols = _colDefs();
    var oGrid = _ce("div", "u4aVmGrid"); oGrid.dataset.mode = oState.tableMode;

    if (bFrozen) {
        var oFP = _ce("div", "u4aVmGrid__frozen");
        var oSP = _ce("div", "u4aVmGrid__scroll");
        var oFt = _buildOneTable(aCols.filter(function (c) { return c.frozen; }), "u4aVmTbl--frozen");
        var oSt = _buildOneTable(aCols.filter(function (c) { return !c.frozen; }), "u4aVmTbl--scroll");
        oFP.appendChild(oFt.table); oSP.appendChild(oSt.table);
        oGrid.appendChild(oFP); oGrid.appendChild(oSP);
        oArea.appendChild(oGrid);

        // 세로 스크롤 동기화: 스크롤 페인(세로바 보유) → 고정 페인(overflow:hidden, scrollTop 추종).
        oSP.addEventListener("scroll", function () { oFP.scrollTop = oSP.scrollTop; });
        // 고정 페인 위 휠 → 스크롤 페인으로 전달(고정 페인엔 세로바가 없으므로).
        oFP.addEventListener("wheel", function (e) {
            oSP.scrollTop += e.deltaY; oSP.scrollLeft += e.deltaX; e.preventDefault();
        }, { passive: false });

        _wireHoverSync(oFt.tbody, oSt.tbody);
        oState._panes = { frozen: oFP, scroll: oSP, fbody: oFt.tbody, sbody: oSt.tbody, fhead: oFt.thead, shead: oSt.thead };
    } else {
        // 평면 — 전체 컬럼 한 테이블, 컨테이너 가로 스크롤(고정 해제).
        var oSP2 = _ce("div", "u4aVmGrid__scroll");
        var oAt = _buildOneTable(aCols, "u4aVmTbl--flat");
        oSP2.appendChild(oAt.table);
        oGrid.appendChild(oSP2);
        oArea.appendChild(oGrid);
        oState._panes = { frozen: null, scroll: oSP2, fbody: null, sbody: oAt.tbody, fhead: null, shead: oAt.thead };
    }

    _restoreSel(oSel);
    _renderFillers();
}

/* ── 빈 행 채우기 — 데이터 아래 남는 공간을 빈 행(그리드 라인)으로(sap.ui.table 느낌).
   양쪽 페인에 동일 개수. 스크롤 페인 clientHeight(가로바 제외) 기준 → 가로바 위까지만 채워 정렬. ── */
function _renderFillers() {
    var p = oState._panes;
    if (!p || !p.scroll || !p.sbody) { return; }

    // ★ 고정 페인 하단을 스크롤 페인의 가로 스크롤바 높이만큼 비운다 — 고정 페인엔 가로바가 없어
    //   스크롤 페인보다 그만큼 더 길어, 같은 행이 스크롤 쪽에선 스크롤바에 가려(침범) 좌우가 어긋난다.
    //   marginBottom 으로 고정 페인 가시영역=스크롤 페인 콘텐츠영역(가로바 위)으로 맞춘다.
    if (p.frozen) {
        var hsb = p.scroll.offsetHeight - p.scroll.clientHeight;   // 가로 스크롤바 높이(없으면 0, 페인 보더 없음)
        p.frozen.style.marginBottom = (hsb > 0 ? hsb : 0) + "px";
    }

    if (!oState.aVerList.length) { return; }

    var oFirst = p.sbody.querySelector("tr:not(.u4aVmFiller)");
    var rowH = oFirst ? Math.round(oFirst.getBoundingClientRect().height) : 0;
    if (!rowH) { rowH = 40; }

    var headH = p.shead ? p.shead.getBoundingClientRect().height : 0;
    var avail = p.scroll.clientHeight - headH;   // 가로 스크롤바 제외 높이
    var dataH = oState.aVerList.length * rowH;
    var n = Math.floor((avail - dataH) / rowH);
    if (n > 200) { n = 200; }

    _fillBody(p.sbody, n);
    if (p.fbody) { _fillBody(p.fbody, n); }
}

function _fillBody(oTbody, n) {
    var aOld = oTbody.querySelectorAll("tr.u4aVmFiller");
    for (var i = 0; i < aOld.length; i++) { aOld[i].remove(); }
    if (n <= 0) { return; }
    var oThead = oTbody.parentNode.querySelector("thead");
    var aTh = oThead ? oThead.querySelectorAll("th") : [];
    var oFrag = document.createDocumentFragment();
    for (var r = 0; r < n; r++) {
        var oTr = _ce("tr", "u4aVmFiller");
        oTr.setAttribute("aria-hidden", "true");
        for (var ci = 0; ci < aTh.length; ci++) {
            var oTd = _ce("td", aTh[ci].className);   // 동일 컬럼 클래스(폭)
            oTr.appendChild(oTd);
        }
        oFrag.appendChild(oTr);
    }
    oTbody.appendChild(oFrag);
}

/* ── 테이블 영역 리사이즈 — 모드(고정/평면) 재평가. 바뀌면 재빌드, 아니면 필러만. ── */
function _onAreaResize() {
    var oArea = document.querySelector("#vmTableWrap .u4aVmArea");
    if (!oArea) { return; }
    if (!oState.aVerList.length) { return; }
    var bWantFrozen = _wantFrozen(oArea.clientWidth);
    if (bWantFrozen !== (oState.tableMode === "frozen")) {
        _buildTable(oArea);   // 모드 전환 → 재빌드(선택/스크롤 유지)
    } else {
        _renderFillers();     // 높이 변화 → 필러만
    }
}

/* ── 비교하기(원본 compareSelectedApp) ──────────────────────────────────── */
function _onCompare() {
    if (bBusy) { return; }

    var aList = oState.aVerList;
    if (!aList || !aList.length) {
        _toast(_z("397"));   // 비교할 데이터가 없습니다.
        return;
    }

    var oBaseRd = document.querySelector('input[name="vmBase"]:checked');
    if (!oBaseRd) { _toast(_z("398")); return; }    // 비교 기준을 선택하세요.
    var oTgtRd = document.querySelector('input[name="vmTarget"]:checked');
    if (!oTgtRd) { _toast(_z("399")); return; }     // 비교 대상을 선택하세요.

    var oBase = aList[parseInt(oBaseRd.value, 10)];
    var oTgt = aList[parseInt(oTgtRd.value, 10)];
    if (!oBase || !oTgt) { return; }

    // 기준=대상(동일 APPID+VPOSN) → 안내(M027 + M028).
    if (oBase.APPID === oTgt.APPID && oBase.VPOSN === oTgt.VPOSN) {
        _toast(_z("400") + "\n\n" + _z("401"));
        return;
    }

    _setBusy(true);

    // 새 비교 시작 → 이전 diff 잔상 숨김(반투명 busy 너머로 옛 결과가 비치는 것 방지).
    //   호스트(Monaco) 자체는 setCompareData 응답 시 갱신되며, 여기서는 표시 class 만 내린다.
    var oPrevHW = document.getElementById("vmDiffHostWrap");
    if (oPrevHW) { oPrevHW.classList.remove("u4aVmHostShown"); }

    // 비교 패널/바 표시(최초 1회 호스트 로드).
    _showDiffPane();

    _waitHostReady().then(function (bOk) {
        if (!bOk) { _setBusy(false); return; }   // 호스트 로드 실패(치명).

        var oForm = new FormData();
        oForm.append("APPID", oBase.APPID);
        oForm.append("VPOSN_A", oBase.VPOSN);
        oForm.append("VPOSN_B", oTgt.VPOSN);

        _post(oState.sServerPath + "/compare_app_ctrl_abap", oForm).then(function (oRes) {
            if (!oRes) { return; }   // _post 가 이미 치명오류 처리(창 닫힘).

            if (oRes.RETCD === "E") {
                var sMsg = "[" + (oRes.STCOD || "") + "]: " + _z(oRes.MSGNR) + "\n\n" + _z("290");
                _fatal("E", sMsg);
                return;
            }

            var oR = oRes.RDATA || {};
            _toHost({ cmd: "setCompareData", sourceA: oR.ABAP_A || "", sourceB: oR.ABAP_B || "" });

            // 헤더 타이틀/버전 뱃지(원본 S_COMPARE_PAGE_HANDLE).
            document.getElementById("vmBaseTitle").textContent = _z("394") + " " + _z("383") + ": ";   // 비교 기준 App Version:
            document.getElementById("vmTargetTitle").textContent = _z("395") + " " + _z("383") + ": "; // 비교 대상 App Version:
            document.getElementById("vmBaseVer").textContent = oBase.VPOSN;
            document.getElementById("vmTargetVer").textContent = oTgt.VPOSN;

            // 타이틀/뱃지 폭이 바뀌었으니 오버플로 재계산(ResizeObserver 는 콘텐츠 변경엔 안 탐).
            try { if (oState._diffOvf) { oState._diffOvf.reflow(); } } catch (e) { }

            // 호스트 페이드인 + 레이아웃.
            var oHW = document.getElementById("vmDiffHostWrap");
            if (oHW) { oHW.classList.add("u4aVmHostShown"); }
            _toHost({ cmd: "layout" });

            _setBusy(false);
        });
    });
}

/* ── 비교 패널 표시 / 숨김 ───────────────────────────────────────────────── */
function _showDiffPane() {
    var oBar = document.getElementById("vmSplitBar");
    var oPane = document.getElementById("vmDiffPane");
    var oList = document.getElementById("vmListPane");
    if (oBar) { oBar.hidden = false; }
    if (oPane) { oPane.hidden = false; }
    // 최초 표시 시 상/하 5:5(원본 SplitterLayoutData size 50%).
    if (!oState.diffOpen) {
        if (oList) { oList.style.flex = "1 1 50%"; }
        if (oPane) { oPane.style.flex = "1 1 50%"; }
    }
    oState.diffOpen = true;
    _loadHost();
}

function _hideDiffPane() {
    // 전체창 상태였다면 먼저 해제(목록 다시 표시) — 안 그러면 닫은 뒤 목록이 숨은 채 빈 창.
    if (oState.diffFull) { _setDiffFull(false); }
    var oBar = document.getElementById("vmSplitBar");
    var oPane = document.getElementById("vmDiffPane");
    var oList = document.getElementById("vmListPane");
    if (oBar) { oBar.hidden = true; }
    if (oPane) { oPane.hidden = true; }
    if (oList) { oList.hidden = false; oList.style.flex = "1 1 auto"; }    // 목록이 전체 차지(원본 removeContentArea + resetContentAreasSizes)
    oState.diffOpen = false;
    _closeLegend();
}

/* ── 전체창 토글 — 목록(테이블)+스플리터 바 숨겨 diff 가 창 전체 차지(USP 에디터 전체화면 패턴).
   아이콘 expand↔compress, 툴팁 ZMSG_WS_COMMON_001 369/370(USP 동일 키), aria-pressed 동기. ── */
function _setDiffFull(bFull) {
    oState.diffFull = !!bFull;
    var oList = document.getElementById("vmListPane");
    var oBar = document.getElementById("vmSplitBar");
    if (oList) { oList.hidden = bFull; }
    if (oBar) { oBar.hidden = bFull; }   // 전체창=숨김 / 해제=다시 표시(diff 가 열려 있을 때만 호출됨)
    var oBtn = document.getElementById("vmDiffFull");
    if (oBtn) {
        oBtn.setAttribute("aria-pressed", bFull ? "true" : "false");
        oBtn.innerHTML = '<i class="fa-solid fa-' + (bFull ? "compress" : "expand") + '"></i>';
        try { oBtn.title = bFull ? _z("370") : _z("369"); } catch (e) { }
    }
    _toHost({ cmd: "layout" });
}

function _toggleDiffFull() {
    _setDiffFull(!oState.diffFull);
}

/* ── diff 툴바 오버플로 메뉴 항목 빌더(공통 attachOverflow menuItem) ──
   정보 텍스트(span)=메뉴 제외(null), 줌 그룹=축소/배율/확대 3항목, 그 외 버튼=아이콘+라벨(btnLabel). */
function _diffOvfMenuItem(el) {
    // 줌 그룹(div) — 메뉴에선 축소/현재배율(원복)/확대 3항목으로 펼친다.
    if (el.classList && el.classList.contains("u4aVmZoom")) {
        return [
            { iconHtml: '<i class="fa-solid fa-minus"></i>', text: "", onClick: function () { _toHost({ cmd: "zoomOut" }); } },
            { iconHtml: '<i class="fa-solid fa-magnifying-glass"></i>', text: (oState.zoomPct || 100) + "%", onClick: function () { _toHost({ cmd: "zoomReset" }); } },
            { iconHtml: '<i class="fa-solid fa-plus"></i>', text: "", onClick: function () { _toHost({ cmd: "zoomIn" }); } }
        ];
    }
    // 버튼만 메뉴 항목으로(정보 텍스트/뱃지 span 은 제외).
    if (el.tagName !== "BUTTON") { return null; }
    var oI = el.querySelector("i");
    var bDis = el.disabled === true;
    return {
        iconHtml: oI ? oI.outerHTML : "",
        text: (window.U4AUI && U4AUI.btnLabel) ? U4AUI.btnLabel(el, true) : (el.title || ""),
        disabled: bDis,
        onClick: function () { if (!bDis) { el.click(); } }
    };
}

/* ── diff 호스트 로드 / ready 대기 ──────────────────────────────────────── */
function _loadHost() {
    if (!oFrame || oFrame.getAttribute("src")) { return; }
    var oPARAMS = { HOSTID: C_HOSTID, THEME: _monacoThemeFromBg(BGCOL), LANG: "abap" };
    oFrame.src = "host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oPARAMS));
}

function _waitHostReady() {
    return new Promise(function (resolve) {
        if (oState.hostReady) { return resolve(true); }
        var bDone = false;
        var iWatch = setTimeout(function () {
            if (bDone) { return; }
            bDone = true; fnHostReadyWait = null;
            console.error("[HTML5][versionMng] diff 호스트 로드 지연/실패");
            _fatal("E", _z("314") + "\n\n" + _z("290"));   // 알 수 없는 오류
            resolve(false);
        }, 15000);
        fnHostReadyWait = function () {
            if (bDone) { return; }
            bDone = true; fnHostReadyWait = null;
            try { clearTimeout(iWatch); } catch (e) { }
            resolve(true);
        };
    });
}

/* ── 호스트 → 창 메시지(ready) ──────────────────────────────────────────── */
function _onHostMessage(oEvent) {
    var d = oEvent && oEvent.data;
    if (!d || d.__u4avmh !== true || d.hostId !== C_HOSTID) { return; }
    if (d.evt === "ready") {
        oState.hostReady = true;
        if (typeof fnHostReadyWait === "function") { fnHostReadyWait(); }
        return;
    }
    if (d.evt === "zoom") {
        // 에디터 폰트 배율(%) → 툴바 표시 갱신(Ctrl+휠/줌버튼 공통) + 오버플로 메뉴용 상태 저장.
        var n = (typeof d.pct === "number" && isFinite(d.pct)) ? d.pct : 100;
        oState.zoomPct = n;
        var oZ = document.getElementById("vmZoomTxt");
        if (oZ) { oZ.textContent = n + "%"; }
        var oZBtn = document.getElementById("vmZoomBtn");
        if (oZBtn) { oZBtn.title = n + "% (Ctrl+0)"; }   // editorPopup 공통 패턴(% 클릭/Ctrl+0=원복)
        return;
    }
}

/* ── 새창으로 보기(원본 openAppNewBrowser) ──────────────────────────────── */
function _onOpenNewWindow(oRow) {
    if (bBusy || !oRow) { return; }

    // TAPPID/TCLSID 없으면(=최신 버전) 새창 실행 불가 → 안내(M004=378).
    if (oRow.TAPPID === "" || oRow.TCLSID === "" || oRow.VPOSN === 0 || oRow.VPOSN === "0") {
        _toast(_z("378"));   // 선택한 버전은 최신 버전입니다. 다른버전을 선택하세요.
        return;
    }

    // 이동 확인(M023=396).
    if (window.U4AUI && U4AUI.confirm) {
        U4AUI.confirm({
            type: "C", title: _c("B86"), message: _z("396"),   // Information / 선택한 어플리케이션으로 이동?
            buttons: [{ act: "YES", label: "Yes", emphasized: true }, { act: "NO", label: "No" }],
            onClose: function (sAct) { if (sAct === "YES") { _doCreateTempApp(oRow); } }
        });
    } else {
        if (window.confirm(_z("396"))) { _doCreateTempApp(oRow); }
    }
}

function _doCreateTempApp(oRow) {
    _setBusy(true, { DESC: _z("404") });   // 선택한 버전의 어플리케이션을 생성 중입니다.

    var oForm = new FormData();
    oForm.append("APPID", oRow.APPID);
    oForm.append("VPOSN", oRow.VPOSN);

    _post(oState.sServerPath + "/create_temp_ver_app", oForm).then(function (oRes) {
        if (!oRes) { return; }   // _post 치명오류 처리.

        if (oRes.RETCD === "E") {
            var sMsg = "[" + (oRes.STCOD || "") + "]: " + _z(oRes.MSGNR) + "\n\n" + _z("290");
            _fatal("E", sMsg);
            return;
        }

        _setBusy(true, { DESC: _z("405") });   // 선택한 버전의 어플리케이션을 실행 중입니다.

        var sTAPPID = (oRes.RDATA && oRes.RDATA.TAPPID) || "";

        // opener 에게 새창(WS20 MOVE20) 요청 — 원본 IPC 계약 1:1.
        try { IPCRENDERER.send(BROWSKEY + "-if-version-management-new-window", { TAPPID: sTAPPID }); } catch (e) { }

        // busy 해제는 opener 의 "if-vermng-newwin-done"(새창 did-finish-load) 신호가 1차.
        //   신호 누락(새창 생성 실패 등) 대비 5초 안전망(원본 연타방지 타이머 = fallback).
        setTimeout(function () { _setBusy(false); }, 5000);
    });
}

/* ── 범례 팝오버(원본 ResponsivePopover legend) ─────────────────────────── */
function _buildLegend() {
    var oEl = document.getElementById("vmLegend");
    if (!oEl || oEl.dataset.built === "X") { return; }
    oEl.dataset.built = "X";

    var oHead = document.createElement("div");
    oHead.className = "u4aVmLegendHead";
    oHead.innerHTML = '<i class="fa-solid fa-list"></i>';
    var oHt = document.createElement("span");
    oHt.textContent = _z("408");   // 범례
    oHead.appendChild(oHt);
    oEl.appendChild(oHead);

    // 삭제된 영역(red) / 추가된 영역(green) — diff 색 키.
    [
        { chip: "u4aVmLegendChip--del", desc: _z("409") },   // 삭제된 영역
        { chip: "u4aVmLegendChip--add", desc: _z("410") }    // 추가된 영역
    ].forEach(function (r) {
        var oRow = document.createElement("div");
        oRow.className = "u4aVmLegendRow";
        var oChip = document.createElement("span");
        oChip.className = "u4aVmLegendChip " + r.chip;
        var oDesc = document.createElement("span");
        oDesc.className = "u4aVmLegendDesc";
        oDesc.textContent = r.desc;
        oRow.appendChild(oChip);
        oRow.appendChild(oDesc);
        oEl.appendChild(oRow);
    });
}

function _positionLegend() {
    var oEl = document.getElementById("vmLegend");
    var oBtn = document.getElementById("vmLegendBtn");
    if (!oEl || !oBtn || oEl.hidden) { return; }
    var r = oBtn.getBoundingClientRect();
    var w = oEl.offsetWidth || 224;
    var left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    var top = r.bottom + 4;
    oEl.style.left = left + "px";
    oEl.style.top = top + "px";
}

function _toggleLegend() {
    var oEl = document.getElementById("vmLegend");
    if (!oEl) { return; }
    if (oEl.hidden) {
        _buildLegend();
        oEl.hidden = false;
        _positionLegend();
    } else {
        _closeLegend();
    }
}

function _closeLegend() {
    var oEl = document.getElementById("vmLegend");
    if (oEl) { oEl.hidden = true; }
}

/* ── 세로 스플리터 드래그(상=목록 / 하=비교) — MIME _bindSplit 의 세로판 ───── */
function _paneMinH(el) { return 80; }
function _bindSplitV(oBar) {
    var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0;
    function lf_move(e) {
        if (!bDrag) { return; }
        var oSplit = oBar.parentNode;
        var a = iAStart + (e.clientY - iStart);
        var am = _paneMinH(oA);
        var maxA = oSplit.clientHeight - oBar.getBoundingClientRect().height - _paneMinH(oB);
        if (a < am) { a = am; }
        if (a > maxA) { a = maxA; }
        oA.style.flex = "0 0 " + a + "px";
        _toHost({ cmd: "layout" });
    }
    function lf_up() {
        bDrag = false;
        // ★ 드래그 종료 — iframe 마우스 차단 해제(아래 mousedown 참조).
        document.body.classList.remove("u4aVmResizing");
        document.removeEventListener("mousemove", lf_move);
        document.removeEventListener("mouseup", lf_up);
        _toHost({ cmd: "layout" });
    }
    oBar.addEventListener("mousedown", function (e) {
        oA = oBar.previousElementSibling; oB = oBar.nextElementSibling;
        if (!oA || !oB) { return; }
        bDrag = true;
        iStart = e.clientY;
        iAStart = oA.getBoundingClientRect().height;
        // ★ 드래그 중 Monaco diff 호스트 iframe 의 pointer-events 를 끈다(.u4aVmResizing) —
        //   안 끄면 커서가 iframe 위로 가는 순간 mousemove/mouseup 이 iframe 문서로 가로채여
        //   드래그가 끊긴다(MIME .u4aMimeResizing 동일 패턴, [[iframe-click-closes-overlays]] 류).
        document.body.classList.add("u4aVmResizing");
        document.addEventListener("mousemove", lf_move);
        document.addEventListener("mouseup", lf_up);
        e.preventDefault();
    });
}

/* ── 라이브 테마 변경(워크스페이스 추종 — 에디터 시리즈 동일 정책) ───────── */
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
    _toHost({ cmd: "setTheme", theme: _monacoThemeFromBg(BGCOL) });
}

/* ── 창 크롬(타이틀바/버튼/라벨) 초기화 ─────────────────────────────────── */
function _initChrome() {
    var oLogo = document.getElementById("vmLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
    }

    // 제목 = opener 가 넘긴 창 제목(Version Management).
    var oTitle = document.getElementById("vmTitle");
    if (oTitle) {
        var s = "";
        try { s = document.title || CURRWIN.getTitle() || ""; } catch (e) { s = document.title || ""; }
        oTitle.textContent = s;
    }

    // 창 버튼(최소화/최대화/닫기) — MIME 동일.
    var oMin = document.getElementById("vmWinMin");
    if (oMin) { oMin.addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } }); }
    var oMax = document.getElementById("vmWinMax");
    if (oMax) {
        oMax.addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
    }
    var oClose = document.getElementById("vmWinClose");
    if (oClose) { oClose.addEventListener("click", _onCloseBtn); }

    // 목록 헤더 — Compare 라벨/버튼.
    var oCmpTxt = document.getElementById("vmCompareTxt");
    if (oCmpTxt) { oCmpTxt.textContent = _z("406"); }   // 비교하기
    var oCmpBtn = document.getElementById("vmCompareBtn");
    if (oCmpBtn) { oCmpBtn.title = _z("406"); oCmpBtn.addEventListener("click", _onCompare); }

    // diff 툴바 — 버튼/라벨.
    var oNext = document.getElementById("vmDiffNext");
    if (oNext) { oNext.addEventListener("click", function () { _toHost({ cmd: "next" }); }); }
    var oPrev = document.getElementById("vmDiffPrev");
    if (oPrev) { oPrev.addEventListener("click", function () { _toHost({ cmd: "prev" }); }); }
    var oLegTxt = document.getElementById("vmLegendTxt");
    if (oLegTxt) { oLegTxt.textContent = _z("408"); }   // 범례
    var oLegBtn = document.getElementById("vmLegendBtn");
    if (oLegBtn) { oLegBtn.title = _z("408"); oLegBtn.addEventListener("click", function (e) { e.stopPropagation(); _toggleLegend(); }); }
    var oFullBtn = document.getElementById("vmDiffFull");
    if (oFullBtn) { oFullBtn.title = _z("369"); oFullBtn.addEventListener("click", _toggleDiffFull); }   // 전체창 토글
    // 확대/축소(에디터 줌) — 호스트로 위임(폰트 크기 조절 + % 통지). % 클릭=원복.
    var oZoomOut = document.getElementById("vmZoomOut");
    if (oZoomOut) { oZoomOut.addEventListener("click", function () { _toHost({ cmd: "zoomOut" }); }); }
    var oZoomIn = document.getElementById("vmZoomIn");
    if (oZoomIn) { oZoomIn.addEventListener("click", function () { _toHost({ cmd: "zoomIn" }); }); }
    var oZoomBtn = document.getElementById("vmZoomBtn");
    if (oZoomBtn) { oZoomBtn.addEventListener("click", function () { _toHost({ cmd: "zoomReset" }); }); }
    var oDClose = document.getElementById("vmDiffClose");
    if (oDClose) { oDClose.addEventListener("click", _hideDiffPane); }

    // diff 툴바 오버플로 — 좁아지면 버튼이 ⋯ 메뉴로(공통 U4AUI.attachOverflow). 닫기 X 는 대상 밖(항상 표시).
    var oTools = document.getElementById("vmDiffTools");
    if (oTools && window.U4AUI && U4AUI.attachOverflow) {
        try {
            oState._diffOvf = U4AUI.attachOverflow(oTools, {
                btnClass: "u4a-btn u4aVmIconBtn",
                noOvfAutoMargin: true,                                 // 스페이서가 우측정렬 담당
                isSkip: function (el) { return el.classList.contains("u4aVmDiffSpacer"); },   // flex-grow 스페이서만 측정 제외
                isSep: function (el) { return el.classList.contains("u4aVmDiffSep"); },
                menuItem: _diffOvfMenuItem
            });
        } catch (e) { console.error("[HTML5][versionMng] diff 툴바 overflow 부착 오류:", e && e.message); }
    }

    // 세로 스플리터 바 드래그.
    var oBar = document.getElementById("vmSplitBar");
    if (oBar) { _bindSplitV(oBar); }

    // 테이블 영역 크기 변화(창/스플리터/diff 패널 개폐) → 모드 재평가 + 빈 행 재계산(rAF 디바운스).
    var oTW = document.getElementById("vmTableWrap");
    if (oTW && typeof ResizeObserver !== "undefined") {
        var iFillRaf = null;
        try {
            new ResizeObserver(function () {
                if (iFillRaf) { return; }
                iFillRaf = requestAnimationFrame(function () { iFillRaf = null; _onAreaResize(); });
            }).observe(oTW);
        } catch (e) { }
    }

    // 범례 = 바깥 클릭/리사이즈 시 닫기·재배치(anchored-overlay 표준).
    document.addEventListener("mousedown", function (e) {
        var oEl = document.getElementById("vmLegend");
        if (!oEl || oEl.hidden) { return; }
        if (e.target.closest && (e.target.closest("#vmLegend") || e.target.closest("#vmLegendBtn"))) { return; }
        _closeLegend();
    }, true);
    window.addEventListener("resize", function () {
        _positionLegend();
        _toHost({ cmd: "layout" });
    });
}

/* ── 세션 유지(원본 fnKeepClientSession) ───────────────────────────────── */
function _keepSession() { try { IPCRENDERER.send("if-session-time", SESSKEY); } catch (e) { } }

/* ── opener → 창: "새창으로 보기" 새 WS20 창 로드 완료 통지 → busy 해제 ───────
 *  opener(fnVersionManagementPopupOpen) 가 onNewWindow 의 did-finish-load 콜백에서 전송.
 *  성공 흐름의 5초 blind 타이머보다 이 신호가 먼저 와서 즉시 해제(실패 시엔 5초 fallback). */
function _onNewWinDone() {
    if (bBusy) { _setBusy(false); }
}

/* ── 자식창 busy 동기화 채널 ────────────────────────────────────────────── */
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

/* ── 메인 → 창: 버전 관리 IF 데이터 수신(원본 if-version-management) ──────── */
function _onVmInfo(event, res) {
    res = res || {};
    oState.sServerPath = res.sServerPath || "";
    oState.oAppInfo = res.oAppInfo || {};

    // 목록 타이틀 = 버전 히스토리 [ APPID ] (원본 M005=379).
    var oLT = document.getElementById("vmListTitle");
    if (oLT) { oLT.textContent = _z("379") + " [ " + (oState.oAppInfo.APPID || "") + " ]"; }

    // 목록 조회 동안 이 창의 스피너 표시(에디터 시리즈 정책 — 완전 로드 시 _finishOpen 으로 1회 해제).
    _setBusy(true);

    // 버전 목록 조회 → 렌더 → 오픈 busy 1회 해제.
    _loadVersionList().then(function (bOk) {
        if (!bOk) { return; }   // 치명오류 시 창 닫힘(별도 처리).
        _renderTable();
        _finishOpen();
    });
}

/* ── 부트 ──────────────────────────────────────────────────────────────── */
window.addEventListener("load", function () {

    oFrame = document.getElementById("vmDiffHost");

    try { CURRWIN.setMenu(null); } catch (e) { }

    _initChrome();
    _initBroadcast();

    // 호스트 메시지 + IF 데이터 + 라이브 테마 변경 구독.
    window.addEventListener("message", _onHostMessage);
    IPCRENDERER.on("if-vermng-info", _onVmInfo);
    IPCRENDERER.on("if-vermng-newwin-done", _onNewWinDone);
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    // 세션 유지.
    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 창 즉시 불투명 표시(네이티브 opacity 페이드 미사용). 등장 효과는 #vmContent CSS opacity.
    try { CURRWIN.show(); } catch (e) { }

    // ★ busy 는 여기서 끄지 않는다 ★ — opener 가 켠 WS20 busy 를 목록 렌더까지 유지(_finishOpen 1회).
    // 단, if-vermng-info 가 끝내 도착하지 않으면(opener did-finish-load 누락 등) 본문이 영원히
    // opacity 0 + busy 로 고착되므로 20초 안전장치(docPopup 동일 정책). 정상 수신 시 _finishOpen 이 해제.
    iOpenWatch = setTimeout(function () {
        if (bOpenDone) { return; }
        console.error("[HTML5][versionMng] if-vermng-info 미수신 — 오픈 fallback 발동");
        _fatal("E", _z("314") + "\n\n" + _z("290"));   // 알 수 없는 오류 + 안내 → OK 시 창 닫기
    }, 20000);
});

/* ── 종료 정리(누수 방지) ───────────────────────────────────────────────── */
window.onbeforeunload = function () {
    if (bBusy) { return false; }   // busy 중에는 언로드 취소 — 아래 정리는 실제 종료 확정 후에만 수행.
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("message", _onHostMessage);
    try { IPCRENDERER.removeListener("if-vermng-info", _onVmInfo); } catch (e) { }
    try { IPCRENDERER.removeListener("if-vermng-newwin-done", _onNewWinDone); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
    try { clearTimeout(iOpenWatch); } catch (e) { } iOpenWatch = null;
    // 자식창 busy 동기화 채널 명시적 close(누수 방지).
    if (oBroad) { try { oBroad.onmessage = null; oBroad.close(); } catch (e) { } oBroad = null; }
};
