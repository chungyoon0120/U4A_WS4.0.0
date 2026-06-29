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
 *  ★ UI5 의존부 치환: sap.ui.table.Table→공통 .u4a-table, Vertical Splitter→공통 .u4a-splitter(세로),
 *     ObjectStatus→.u4a-status, MessageBox→공통 U4AUI.confirm, MessageToast→공통 .u4a-toast,
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
    diffOpen: false    // 비교 패널 표시 여부
};

var oFrame = null, bBusy = false, oToastTimer = null, bOpenDone = false;
var oBroad = null, fnHostReadyWait = null;

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

/* ── Busy(오버레이 + 닫기 차단 + 자식창 브로드캐스트) ───────────────────── */
function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("vmBusy");
    var oTxt = document.getElementById("vmBusyText");
    if (oTxt) { oTxt.textContent = (bOn && oOpt && oOpt.DESC) ? oOpt.DESC : ""; }
    if (oEl) { oEl.hidden = !bBusy; }
    try { CURRWIN.closable = !bBusy; } catch (e) { }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); } catch (e) { }
    }
}

// 오픈 busy 는 "한 번 켜서 끝까지 유지 → 목록 렌더(또는 오류) 시 1회만 해제"(에디터 시리즈 정책).
function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
    _setBusy(false);
    var oC = document.getElementById("vmContent");
    if (oC) { oC.classList.add("u4aVmShown"); }
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
            onClose: function () { try { CURRWIN.close(); } catch (e) { } }
        });
    } else {
        try { window.alert(sMsg || ""); } catch (e) { }
        try { CURRWIN.close(); } catch (e) { }
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

/* ── 버전 목록 테이블 렌더(공통 .u4a-table) ──────────────────────────────── */
function _renderTable() {
    var oWrapHost = document.getElementById("vmTableWrap");
    if (!oWrapHost) { return; }
    oWrapHost.innerHTML = "";

    // 컬럼 헤더(원본 Label — 메시지 키).
    var aCol = [
        { cls: "u4a-c-vmstatus", txt: _z("380") }, // 상태
        { cls: "u4a-c-vmappid", txt: _z("381") },  // 어플리케이션 ID
        { cls: "u4a-c-vmver", txt: _z("383") },    // App Version
        { cls: "u4a-c-vmcmp", txt: _z("382") },    // Compare (Base/Target)
        { cls: "u4a-c-vmreqno", txt: _z("384") },  // Request No.
        { cls: "u4a-c-vmreqtx", txt: _z("385") },  // Request Desc.
        { cls: "u4a-c-vmpkg", txt: _z("386") },    // Package
        { cls: "u4a-c-vmdate", txt: _z("387") },   // Create Date
        { cls: "u4a-c-vmtime", txt: _z("388") },   // Create Time
        { cls: "u4a-c-vmusr", txt: _z("389") }     // Create User
    ];

    var oWrap = document.createElement("div");
    oWrap.className = "u4a-table-wrap";

    var oTable = document.createElement("table");
    oTable.className = "u4a-table u4aVmTbl";

    var oThead = document.createElement("thead");
    var oTrH = document.createElement("tr");
    aCol.forEach(function (c) {
        var oTh = document.createElement("th");
        oTh.className = c.cls;
        oTh.textContent = c.txt;
        oTrH.appendChild(oTh);
    });
    oThead.appendChild(oTrH);
    oTable.appendChild(oThead);

    var oTbody = document.createElement("tbody");

    if (!oState.aVerList.length) {
        var oTrE = document.createElement("tr");
        var oTdE = document.createElement("td");
        oTdE.className = "u4a-table__nodata";
        oTdE.colSpan = aCol.length;
        oTdE.textContent = _z("946");   // 데이터 없음(공통 .u4a-table__nodata — ServerList noData=946 동일)
        oTrE.appendChild(oTdE);
        oTbody.appendChild(oTrE);
    }

    oState.aVerList.forEach(function (oRow, idx) {

        var oTr = document.createElement("tr");
        oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";

        // 1) 상태 — 공통 .u4a-status 색 점(현재=success, 그외=warning).
        var oTdSt = document.createElement("td");
        oTdSt.className = "u4a-c-vmstatus";
        var oSt = document.createElement("span");
        oSt.className = "u4a-status u4aVmStatus" + (oRow.isCurrent ? " u4a-status--success" : " u4aVmStatus--warning");
        oTdSt.appendChild(oSt);
        oTr.appendChild(oTdSt);

        // 2) App ID + 새창으로 보기 버튼(원본 HBox: Title + action).
        var oTdId = document.createElement("td");
        oTdId.className = "u4a-c-vmappid";
        var oIdBox = document.createElement("span");
        oIdBox.className = "u4aVmAppId";
        var oIdTxt = document.createElement("span");
        oIdTxt.className = "u4aVmAppIdTxt";
        oIdTxt.textContent = oRow.APPID;
        oIdTxt.title = oRow.APPID;
        var oOpen = document.createElement("button");
        oOpen.type = "button";
        oOpen.className = "u4a-btn u4aVmOpenBtn";
        oOpen.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i>';
        oOpen.title = _z("407");   // 새창으로 보기
        // 활성 규칙(원본 formatter): TAPPID/TCLSID/VPOSN 모두 비어있으면 비활성.
        var bEnable = !(oRow.TAPPID === "" && oRow.TCLSID === "" && (oRow.VPOSN === 0 || oRow.VPOSN === "0"));
        oOpen.disabled = !bEnable;
        oOpen.addEventListener("click", function () { _onOpenNewWindow(oRow); });
        oIdBox.appendChild(oIdTxt);
        oIdBox.appendChild(oOpen);
        oTdId.appendChild(oIdBox);
        oTr.appendChild(oTdId);

        // 3) App Version
        var oTdVer = document.createElement("td");
        oTdVer.className = "u4a-c-vmver";
        oTdVer.textContent = oRow.VPOSN;
        oTr.appendChild(oTdVer);

        // 4) Compare(기준/대상 라디오) — name 공유로 전 행 중 1개만 선택(원본 groupName g1/g2).
        var oTdCmp = document.createElement("td");
        oTdCmp.className = "u4a-c-vmcmp";
        var oCmpBox = document.createElement("span");
        oCmpBox.className = "u4aVmCmpCell";

        var oLblB = document.createElement("label");
        oLblB.className = "u4aVmRadio";
        var oRdB = document.createElement("input");
        oRdB.type = "radio"; oRdB.name = "vmBase"; oRdB.value = String(idx);
        var oSpB = document.createElement("span"); oSpB.textContent = _z("394");   // 비교 기준
        oLblB.appendChild(oRdB); oLblB.appendChild(oSpB);

        var oLblT = document.createElement("label");
        oLblT.className = "u4aVmRadio";
        var oRdT = document.createElement("input");
        oRdT.type = "radio"; oRdT.name = "vmTarget"; oRdT.value = String(idx);
        var oSpT = document.createElement("span"); oSpT.textContent = _z("395");   // 비교 대상
        oLblT.appendChild(oRdT); oLblT.appendChild(oSpT);

        oCmpBox.appendChild(oLblB);
        oCmpBox.appendChild(oLblT);
        oTdCmp.appendChild(oCmpBox);
        oTr.appendChild(oTdCmp);

        // 5~10) Request No / Request Desc / Package / Date / Time / User
        var aCells = [
            { cls: "u4a-c-vmreqno", txt: oRow.CTSNO, tip: oRow.CTSNO },
            { cls: "u4a-c-vmreqtx", txt: oRow.CTSTX, tip: oRow.CTSTX },
            { cls: "u4a-c-vmpkg", txt: oRow.PACKG },
            { cls: "u4a-c-vmdate", txt: _fmtDate(oRow.ERDAT), tip: oRow.ERDAT },
            { cls: "u4a-c-vmtime", txt: _fmtTime(oRow.ERTIM), tip: oRow.ERTIM },
            { cls: "u4a-c-vmusr", txt: oRow.ERUSR }
        ];
        aCells.forEach(function (c) {
            var oTd = document.createElement("td");
            oTd.className = c.cls;
            oTd.textContent = (c.txt == null) ? "" : c.txt;
            if (c.tip) { oTd.title = c.tip; }
            oTr.appendChild(oTd);
        });

        oTbody.appendChild(oTr);
    });

    oTable.appendChild(oTbody);
    oWrap.appendChild(oTable);
    oWrapHost.appendChild(oWrap);
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
    var oBar = document.getElementById("vmSplitBar");
    var oPane = document.getElementById("vmDiffPane");
    var oList = document.getElementById("vmListPane");
    if (oBar) { oBar.hidden = true; }
    if (oPane) { oPane.hidden = true; }
    if (oList) { oList.style.flex = "1 1 auto"; }    // 목록이 전체 차지(원본 removeContentArea + resetContentAreasSizes)
    oState.diffOpen = false;
    _closeLegend();
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

        // 연속 클릭 방지(원본 5초 후 busy 해제).
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
    if (oClose) { oClose.addEventListener("click", function () { try { CURRWIN.close(); } catch (e) { } }); }

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
    var oDClose = document.getElementById("vmDiffClose");
    if (oDClose) { oDClose.addEventListener("click", _hideDiffPane); }

    // 세로 스플리터 바 드래그.
    var oBar = document.getElementById("vmSplitBar");
    if (oBar) { _bindSplitV(oBar); }

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
    IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange);

    // 세션 유지.
    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    // 창 즉시 불투명 표시(네이티브 opacity 페이드 미사용). 등장 효과는 #vmContent CSS opacity.
    try { CURRWIN.show(); } catch (e) { }

    // ★ busy 는 여기서 끄지 않는다 ★ — opener 가 켠 WS20 busy 를 목록 렌더까지 유지(_finishOpen 1회).
});

/* ── 종료 정리(누수 방지) ───────────────────────────────────────────────── */
window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    window.removeEventListener("message", _onHostMessage);
    try { IPCRENDERER.removeListener("if-vermng-info", _onVmInfo); } catch (e) { }
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); } catch (e) { }
};
