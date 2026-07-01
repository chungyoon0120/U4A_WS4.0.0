/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : mimeRepository/frame.js
 * - file Desc : U4A MIME Repository Popup(별도 BrowserWindow) 외부 셸.
 *               창 크롬(공통 .u4a-titlebar: 로고/제목/min·max·close + 드래그) +
 *               IPC/Busy/테마 + 본문(mime.js)이 의존하는 런타임 shim(메시지/백엔드/앱정보)을 제공.
 *               본문 트리/속성/미리보기 로직은 mime.js(같은 창, window.fnMimeStart 로 진입).
 *               opener 계약: if-mime-info { oUserInfo, oThemeInfo, oAppInfo, servNm, wloLazy }.
 ************************************************************************/

let oAPP = (function (window) {
    "use strict";

    const
        REMOTE = require('@electron/remote'),
        PATH = REMOTE.require('path'),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        CURRWIN = REMOTE.getCurrentWindow();

    // 브라우저의 쿼리 스트링 정보
    const oQueryParams = WSUTIL.QueryString.parse(location.href);

    const
        USERINFO = oQueryParams.USERINFO,
        LANGU = USERINFO.LANGU,
        SYSID = USERINFO.SYSID,
        WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

    let oAPP = {};
    oAPP.fn = {};
    oAPP.ui = {};
    oAPP.attr = {};
    oAPP.events = {};
    oAPP.common = {};

    oAPP.attr.isBusy = false;

    oAPP.REMOTE = REMOTE;
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.CURRWIN = CURRWIN;
    oAPP.WSUTIL = WSUTIL;
    oAPP.PATHINFO = PATHINFO;
    oAPP.APPPATH = APPPATH;
    oAPP.BROWSKEY = oQueryParams.browserkey;
    oAPP.USERDATA = oAPP.APP.getPath("userData");
    oAPP.attr.LANGU = LANGU;        // Workspace 언어(라벨 현지화)
    oAPP.attr.oUserInfo = USERINFO; // 쿼리 USERINFO(이후 IPC 로 갱신)

    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);


    /*************************************************************
     * @function - 테마 정보를 구한다(SYSID별 개인화 JSON).
     *************************************************************/
    oAPP.fn.getThemeInfo = function () {

        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${SYSID}.json`);
        if (oAPP.FS.existsSync(sThemeJsonPath) === false) {
            return;
        }

        let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");

        try {
            var oThemeJsonData = JSON.parse(sThemeJson);
        } catch (error) {
            return;
        }

        return oThemeJsonData;

    }; // end of oAPP.fn.getThemeInfo


    /*************************************************************
     * @function - 전달받은 테마(UI5 테마명)를 셸 토큰으로 적용.
     *************************************************************/
    oAPP.fn.applyTheme = function (sUI5Theme) {

        if (!window.U4ATheme) {
            return;
        }

        let sKey = window.U4ATheme.apply(sUI5Theme);

        // 테마 <link> 로드 후 첫 페인트 플래시용 --boot-bg 는 해제(안 그러면 테마 미리보기 시 배경 고정).
        try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }

        return sKey;

    }; // end of oAPP.fn.applyTheme

    /*************************************************************
     * @function - SYSID 테마 변경 IPC(전 창 실시간 동기화)
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange() {

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if (!oThemeInfo) {
            return;
        }

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oAPP.REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);

        oAPP.fn.applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange

    oAPP.fn.attachIpcEvents = function () {
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);
    };
    oAPP.fn.detachIpcEvents = function () {
        oAPP.IPCMAIN.off(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);
    };


    /*************************************************************
     * @function - 메인(WS) 창이 닫히면(상단 X/앱 종료) 이 팝업도 따라 닫는다.
     *   ★ 부모(parent) 미지정이라 네이티브 자동 종료가 안 됨 → 메인 창의 'closed' 를
     *     이 팝업 렌더러(독립 프로세스, 메인이 죽어도 살아있음)에서 직접 구독해 self-destroy.
     *   (뒤로가기/로그오프/모드전환은 메인이 fnChildWindowClose→맵 닫기로 별도 처리)
     *************************************************************/
    var _oOpenerWin = null;
    function _onOpenerClosed() {
        try {
            var oW = oAPP.REMOTE.getCurrentWindow();
            if (oW && !oW.isDestroyed()) { oW.setClosable(true); oW.destroy(); }
        } catch (e) { }
    }
    oAPP.fn.attachOpenerCloseWatch = function () {
        var iOpenerId = parseInt(oQueryParams.OPENERID, 10);
        if (!iOpenerId) { return; }
        try {
            _oOpenerWin = oAPP.REMOTE.BrowserWindow.fromId(iOpenerId);
            if (_oOpenerWin && !_oOpenerWin.isDestroyed()) {
                _oOpenerWin.once('closed', _onOpenerClosed);
            }
        } catch (e) { _oOpenerWin = null; }
    };
    oAPP.fn.detachOpenerCloseWatch = function () {
        try { if (_oOpenerWin && !_oOpenerWin.isDestroyed()) { _oOpenerWin.removeListener('closed', _onOpenerClosed); } } catch (e) { }
        _oOpenerWin = null;
    };


    /***********************************************************
     * Busy 오버레이 표시/숨김 + 창 잠금(원본 fnSetBusyLock/setBusy 대체).
     ***********************************************************/
    oAPP.fn.getBusy = function () { return oAPP.attr.isBusy; };

    var _iBusyDelay = null;     // 0.3s 지연 표시 타이머(공통 .u4a-busy 와 동일 — 짧은 busy 깜빡임 방지)
    oAPP.fn.setBusy = function (bIsBusy) {

        var bOn = (bIsBusy === true || bIsBusy === "X");
        oAPP.attr.isBusy = bOn ? "X" : "";

        // 공통 카드/스피너를 top-layer <dialog> 로 — 생성/가져오기 showModal 모달 위에도 보임.
        var oB = document.getElementById("mimeBusy");
        if (oB) {
            if (bOn) {
                if (!oB.__cancelBound) { oB.addEventListener("cancel", function (e) { e.preventDefault(); }); oB.__cancelBound = true; } // ESC 닫힘 차단
                if (_iBusyDelay) { clearTimeout(_iBusyDelay); }
                _iBusyDelay = setTimeout(function () { try { if (!oB.open) { oB.showModal(); } } catch (e) { } }, 300); // 0.3s 지연(짧은 작업은 안 뜸)
            } else {
                if (_iBusyDelay) { clearTimeout(_iBusyDelay); _iBusyDelay = null; }
                try { if (oB.open) { oB.close(); } } catch (e) { }
            }
        }

        // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 fnClose(setClosable→close)로만.
        //   (idle 시 closable=true 주면 Alt+F4 가 먹는 버그. 공통 표준 browser-window-common-ux)
        try { oAPP.CURRWIN.closable = false; } catch (e) { }

    }; // end of oAPP.fn.setBusy

    // 본문(mime.js)이 부르는 별칭 — 원본 oAPP.common.fnSetBusyLock / parent.setBusy / parent.getBusy 대응.
    oAPP.common.fnSetBusyLock = function (s) { oAPP.fn.setBusy(s === "X" ? "X" : ""); };
    oAPP.fn.setBusyState = function (s) { oAPP.fn.setBusy(s === "X" ? "X" : ""); };


    /***********************************************************
     * 메시지 출력(원본 parent.showMessage 대체) — 호출형: showMessage(oUI5, KIND, "S|I|E|W", msg, fnCb).
     *   · 콜백(fnCb) 有 → 예/아니오 확인(공통 U4AUI.confirm).
     *   · 오류/경고(E/W) → 메시지 박스(OK, 공통 U4AUI.confirm) — 토스트보다 확실(놓치지 않게).
     *   · 그 외(성공/정보) → 화면 정중앙 토스트(.u4a-toast 싱글톤).
     ***********************************************************/
    function _msgTitle(sType) {
        var m = { S: "D86", E: "B93", W: "B89", I: "B86", C: "B86" }, k = m[sType] || "B86";
        try { return oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", k) || ""; } catch (e) { return ""; }
    }
    var _iToastTimer = null;
    oAPP.fn.showMessage = function (a, b, sType, sMsg, fnCb) {

        // 확인질문(예/아니오)
        if (typeof fnCb === "function") {
            if (window.U4AUI && U4AUI.confirm) {
                U4AUI.confirm({ type: sType || "I", title: _msgTitle(sType), message: sMsg || "", onClose: fnCb });
            } else { try { fnCb(window.confirm(sMsg || "") ? "YES" : "NO"); } catch (e) { } }
            return;
        }

        if (sMsg == null || sMsg === "") { return; }

        // 오류/경고 → 메시지 박스(OK). (놓치기 쉬운 토스트 대신 모달로 확실히 노출)
        if ((sType === "E" || sType === "W") && window.U4AUI && U4AUI.confirm) {
            var sOk = "OK";
            try { sOk = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A40") || "OK"; } catch (e) { } // Confirm
            U4AUI.confirm({ type: sType, title: _msgTitle(sType), message: sMsg, buttons: [{ act: "OK", label: sOk, emphasized: true }] });
            return;
        }

        // 정보/성공 → 토스트.
        var oToast = document.getElementById("u4aMimeToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aMimeToast";
            oToast.className = "u4a-toast";
            document.body.appendChild(oToast);
        }
        oToast.setAttribute("data-type", (sType === "E" || sType === "W") ? "error" : "info");
        oToast.textContent = sMsg;
        void oToast.offsetWidth;
        oToast.setAttribute("data-show", "true");
        if (_iToastTimer) { clearTimeout(_iToastTimer); }
        _iToastTimer = setTimeout(function () { oToast.setAttribute("data-show", "false"); }, 3000);

    }; // end of oAPP.fn.showMessage

    /***********************************************************
     * 서버 예외 응답 → 클라 언어 메시지 출력(단일 헬퍼). 표준: .analy/17 (★서버 수정 불가 전제).
     *   서버는 "서버 언어로 구운 텍스트"(RETMSG / SCRIPT 임베드)만 준다. 클라가:
     *     ① 텍스트 + 후속동작(needCts) 추출(SCRIPT 는 eval 말고 정규식 파싱)
     *     ② 역조회: 메인프로세스 WsMsgCls.findKeyByText(완전일치) / getParamTemplates(파라미터 템플릿)
     *        로 (클래스,번호) 키 확보 → fnGetMsgClsText 로 **클라 언어 재렌더**
     *     ③ DB 키 아님(SAP 프레임워크 메시지)이면 소형 패턴사전 → 키, 그래도 없으면 서버 원문
     *     ④ needCts → CTS 팝업(opts.onCts)
     ***********************************************************/
    function _genericErrTxt() {
        try { return oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.LANGU || "", "ZMSG_WS_COMMON_001", "314", ""); } catch (e) { return "Error"; }
    }
    // SAP 프레임워크 메시지(메시지클래스 키 아님) 패턴사전 — 대표 케이스만 최소.
    var _FW_PATTERNS = [
        { re: /already exist/i, cls: "/U4A/MSG_WS", no: "004" },     // 중복(폴더/파일) → "중복된 파일 이름이 있습니다."
        { re: /이미 (존재|등록)/, cls: "/U4A/MSG_WS", no: "004" }
    ];

    // SCRIPT 파싱(eval 금지) — showMessage(sap,20,'타입','텍스트') 추출 + lf_createMimeCts 토큰 감지.
    //   원본은 eval(SCRIPT) 로 이 showMessage 를 그대로 실행하므로(표시 권위=SCRIPT),
    //   3번째 인자(타입 E/W/S/I)와 4번째 인자(텍스트)를 함께 뽑아 타입까지 보존한다.
    function _parseScript(sScript) {
        var r = { text: "", type: "", needCts: false };
        if (!sScript) { return r; }
        if (/lf_createMimeCts\s*\(/.test(sScript)) { r.needCts = true; }
        var m = sScript.match(/showMessage\s*\([^,]*,[^,]*,\s*(['"])([EWSI])\1\s*,\s*(['"])([\s\S]*?)\3\s*\)/);
        if (m) { r.type = m[2]; r.text = m[4]; return r; }
        // 타입 인자가 빈 문자열("")인 변형(원본 일부 경로) 폴백 — 텍스트만.
        var m2 = sScript.match(/showMessage\s*\([^,]*,[^,]*,[^,]*,\s*(['"])([\s\S]*?)\1\s*\)/);
        if (m2) { r.text = m2[2]; }
        return r;
    }

    // 서버 텍스트 → (클라언어 텍스트) 역현지화 — 공통 WsMsgCls.relocalize(SSOT) 위임. 못 찾으면 null.
    //   MIME 별도창은 백엔드 로그온 언어를 몰라 beLangu=null(공통이 EN/KO 후보로 시도).
    function _reverseLocalize(sServerText) {
        try {
            var WC = oAPP.REMOTE.getGlobal("WsMsgCls");
            if (!WC || !WC.relocalize) { return null; }
            var sRaw = String(sServerText || "");
            var sLoc = WC.relocalize(sRaw, null, oAPP.attr.LANGU || "");
            return (sLoc && sLoc !== sRaw) ? sLoc : null;   // 원문 그대로면 못 찾은 것 → null(프레임워크 패턴/원문 폴백)
        } catch (e) { return null; }
    }

    // SAP 프레임워크 메시지(키 없음) 패턴사전.
    function _frameworkLocalize(sText) {
        for (var i = 0; i < _FW_PATTERNS.length; i++) {
            if (_FW_PATTERNS[i].re.test(sText)) {
                try { return oAPP.common.fnGetMsgClsText(_FW_PATTERNS[i].cls, _FW_PATTERNS[i].no); } catch (e) { }
            }
        }
        return null;
    }

    oAPP.fn.fnRenderServerError = function (oResult, opts) {
        opts = opts || {};
        if (!oResult) { oAPP.fn.showMessage(null, 20, "E", _genericErrTxt()); return; }

        // ① 표시 텍스트 + 타입 + 후속동작 추출.
        //   원본은 eval(SCRIPT) 이므로 SCRIPT 안의 showMessage 가 표시 권위(타입 W/E 포함).
        //   SCRIPT 가 표시 텍스트를 주면 그걸(타입까지) 우선 — RTMSG/RETMSG 는 SCRIPT 없는 응답
        //   (삭제 E017/E015·폴더생성 INSERT_MIME 오류 등)에서만 사용.
        var sText = "", sType = "E", bNeedCts = false;
        if (oResult.SCRIPT) {
            var ps = _parseScript(oResult.SCRIPT);
            if (ps.text) { sText = ps.text; if (ps.type) { sType = ps.type; } }
            if (ps.needCts) { bNeedCts = true; }
        }
        if (!sText) { sText = oResult.RTMSG || oResult.RETMSG || oResult.MESSAGE || oResult.MSGTX || oResult.RETMSGTX || ""; }

        // ★ CTS(전송요청) 필요 + 처리기 있음 → 오류 메시지는 띄우지 않고 CTS 선택 팝업만 연다.
        //   서버는 "CTS 선택하세요/수정불가/미존재"(E205/E162/E073/E305) 오류와 lf_createMimeCts() 를
        //   함께 내리는데, CTS 팝업이 곧 그 해결 수단이므로 오류 박스는 잡음이다. 특히 사용자가 CTS 팝업을
        //   "취소" 하면 아래 깔린 오류만 남아 "취소인데 오류" 로 보였다(원본 eval 이 둘 다 실행한 잘못된 UX).
        //   → 취소=조용히 종료, 선택=재시도. (CTS 처리기 없을 때만 아래에서 오류 메시지 표시)
        if (bNeedCts && typeof opts.onCts === "function") {
            try { opts.onCts(); } catch (e) { }
            return;
        }

        // ② 역현지화(완전일치/템플릿) → ③ 프레임워크 패턴 → 원문 폴백.
        if (sText) {
            var sLoc = null;
            try { sLoc = _reverseLocalize(sText) || _frameworkLocalize(sText); } catch (e) { sLoc = null; }
            oAPP.fn.showMessage(null, 20, sType, sLoc || sText);
        } else {
            // 표시할 것도 후속동작도 없으면 일반 오류.
            oAPP.fn.showMessage(null, 20, "E", _genericErrTxt());
        }
    };

    // 사운드/로그인 체크/푸터메시지 — 별도창에선 경량 처리(원본 부작용 없음).
    oAPP.fn.setSoundMsg = function () { /* 별도창 — 사운드 생략(원본 sap sound 비결합) */ };
    oAPP.fn.sendAjaxLoginChk = function (cb) { try { cb({ RETCD: "S" }); } catch (e) { } };
    oAPP.fn.fnHideFloatingFooterMsg = function () { };
    oAPP.fn.getUserInfo = function () { return oAPP.attr.oUserInfo || { LANGU: oAPP.attr.LANGU }; };
    oAPP.fn.getServerPath = function () { return oAPP.attr.servNm || ""; };
    oAPP.fn.checkWLOList = function () { return oAPP.attr.wloLazy === true; };


    /************************************************************************
     * 창 제목 = "U4A MIME 리포지토리(C26)" + (현재 앱 APPID 있으면 " - APPID").
     *   앱정보는 if-mime-info IPC 로 늦게 도착하므로, 초기(fnInitHeader)+도착 시 둘 다 호출.
     ************************************************************************/
    oAPP.fn.fnSetTitle = function () {
        function T(k) { try { return oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", k); } catch (e) { return ""; } }
        var s = T("C26") || "U4A MIME Repository";
        var oApp = oAPP.attr.oAppInfo || {};
        if (oApp.APPID) {
            s += " - " + oApp.APPID;
            // 모드(편집 A02 / 조회 A05) + 상태(활성 B66 / 비활성 B67; 변경분 IS_CHAG="X"면 비활성) — WS20 헤더와 동일.
            var sMode = (oApp.IS_EDIT === "X") ? T("A02") : T("A05");
            var sStat = "";
            if (oApp.IS_CHAG === "X") { sStat = T("B67"); }
            else if (oApp.ACTST != null && oApp.ACTST !== "") { sStat = (oApp.ACTST === "A") ? T("B66") : T("B67"); }
            if (sMode) { s += " " + sMode; }
            if (sStat) { s += " " + sStat; }
        }
        var oT = document.getElementById("mimeTitle");
        if (oT) { oT.textContent = s; }
        try { document.title = s; } catch (e) { }
    };

    /************************************************************************
     * 공통 .u4a-titlebar 초기화 — 로고/제목(C26)/창 제어(min/max/close).
     ************************************************************************/
    oAPP.fn.fnInitHeader = function () {

        try {
            var oLogo = document.getElementById("mimeLogo");
            if (oLogo) {
                var sLogoPath = String(oAPP.PATHINFO.WS_LOGO).replace(/\\/g, "/");
                oLogo.src = encodeURI("file:///" + sLogoPath);
            }
        } catch (e) { }

        oAPP.fn.fnSetTitle();   // 제목(+현재 앱 APPID). 앱정보는 IPC 도착 시 재호출로 갱신.

        var oMin = document.getElementById("mimeWinMin");
        if (oMin) { oMin.addEventListener("click", function () { try { oAPP.CURRWIN.minimize(); } catch (e) { } }); }

        var oMax = document.getElementById("mimeWinMax");
        if (oMax) {
            oMax.addEventListener("click", function () {
                try { if (oAPP.CURRWIN.isMaximized()) { oAPP.CURRWIN.unmaximize(); } else { oAPP.CURRWIN.maximize(); } } catch (e) { }
            });
        }

        var oClose = document.getElementById("mimeWinClose");
        if (oClose) { oClose.addEventListener("click", function () { oAPP.fn.fnClose(); }); }

    }; // end of oAPP.fn.fnInitHeader

    /************************************************************************
     * 창 닫기 — Busy 중이면 무시. closable:false 로 열렸으니 풀고 닫는다.
     ************************************************************************/
    oAPP.fn.fnClose = function () {

        if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) { return; }

        try {
            var oCurrWin = oAPP.REMOTE.getCurrentWindow();
            if (!oCurrWin.isDestroyed()) {
                oCurrWin.setClosable(true);
                oCurrWin.close();
            }
        } catch (e) { /* 이미 파괴된 창 무시 */ }

    }; // end of oAPP.fn.fnClose

    /************************************************************************
     * 본문 등장 — 네이티브 opacity 페이드 대신 CSS opacity transition.
     ************************************************************************/
    oAPP.fn.fnShowContent = function () {
        var el = document.getElementById("mimeContent");
        if (el) { el.classList.add("u4aMimeShown"); }
    }; // end of oAPP.fn.fnShowContent


    /************************************************************************
     * opener(did-finish-load) → 초기 데이터 수신 → 본문 시작.
     ************************************************************************/
    oAPP.IPCRENDERER.on('if-mime-info', function (events, oInfo) {

        oAPP.attr.oUserInfo = oInfo.oUserInfo || oAPP.attr.oUserInfo;
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo;
        oAPP.attr.oAppInfo = oInfo.oAppInfo || {};
        oAPP.attr.servNm = oInfo.servNm || "";
        oAPP.attr.wloLazy = (oInfo.wloLazy === true);

        if (oInfo.oThemeInfo && oInfo.oThemeInfo.THEME) {
            oAPP.fn.applyTheme(oInfo.oThemeInfo.THEME);
        }

        oAPP.fn.fnSetTitle();   // 앱정보 도착 → 제목에 APPID 반영

        // 본문(mime.js) 시작 — 트리/속성/미리보기 빌드 + 데이터 로드.
        try { if (typeof window.fnMimeStart === "function") { window.fnMimeStart(); } } catch (e) { console.error("[HTML5][MIME] start 오류:", e); }

        // 본문 페이드인 + 메인 Busy Lock 해제(원본 별도창 동일).
        oAPP.fn.fnShowContent();
        try { oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }
        // ★형제 창 BUSY_OFF broadcast(opener fnMimeWindowOpener 가 oMainBroad BUSY_ON 으로 형제창 잠금 → 짝맞춤).
        //   SETBUSYLOCK 은 "메인" busy 만 풀어 형제창(docPopup 등)은 안 풀린다 → 영구 busy+닫기차단 방지.
        try { oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "BROAD_BUSY", PRCCD: "BUSY_OFF" }); } catch (e) { }

    });

    window.oAPP = oAPP;

    // ─ 서버 SCRIPT(eval) 안전 전역 스텁 ──────────────────────────────────
    //   set_mime_crud 등은 RETCD=E 와 함께 SCRIPT(예: parent.showMessage(sap,10,"",msg) / lf_createMimeCts())
    //   를 내려주며, WS 런타임 전역(showMessage/sap/setSoundMsg…)을 참조한다. 별도창엔 그게 없어
    //   eval 이 조용히 실패 → 중복 폴더명 등 오류가 "무반응" 이었다. 동일 이름 안전 스텁을 전역에 깔아
    //   eval 된 SCRIPT 가 그대로 동작하게 한다(최상위 창이라 parent === window). [guard-server-script-eval]
    try {
        window.showMessage = function () { return oAPP.fn.showMessage.apply(oAPP.fn, arguments); };
        window.setSoundMsg = function () { try { return oAPP.fn.setSoundMsg.apply(oAPP.fn, arguments); } catch (e) { } };
        window.setBusy = function (s) { try { return oAPP.fn.setBusy(s); } catch (e) { } };
        window.getServerPath = function () { return oAPP.fn.getServerPath(); };
        window.getUserInfo = function () { return oAPP.fn.getUserInfo(); };
        if (!window.sap) { window.sap = { ui: { getCore: function () { return { byId: function () { return null; } }; } } }; }
    } catch (e) { }

    return oAPP;

})(window);


/************************************************************************
 * -- Start of Program
 ************************************************************************/
window.onload = function () {

    // 첫 페인트 직후 테마 적용(IPC 도착 전 흰 플래시 방지). IPC 도착 시 재적용.
    try {
        var oTheme = oAPP.fn.getThemeInfo();
        if (oTheme && oTheme.THEME) { oAPP.fn.applyTheme(oTheme.THEME); }
    } catch (e) { /* 기본 라이트 토큰 */ }

    oAPP.CURRWIN.setMenu(null);
    oAPP.fn.fnInitHeader();
    oAPP.fn.attachIpcEvents();
    oAPP.fn.attachOpenerCloseWatch();   // 메인창 닫히면 함께 종료

    // ★ ESC 로 창 전체를 닫지 않는다 — 조회 창(docPopup/versionMng 동일). ESC 는 열린 하위
    //   다이얼로그(생성/가져오기/확인)가 각자 cancel 로 자기만 닫는다. 창 닫기는 타이틀바 X/Alt+F4만.

    // 창 즉시 표시(네이티브 opacity 페이드 미사용 — 흰 플래시 방지). 위치는 opener ready-to-show 에서.
    try { oAPP.CURRWIN.show(); } catch (e) { }

};

/************************************************************************
 * 창 닫을때 — Busy 중이면 닫지 않는다(원본 동일).
 ************************************************************************/
window.onbeforeunload = function () {
    if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) { return false; }
};

/************************************************************************
 * 페이지 숨김/종료 — IPC 리스너 해제(죽은 콜백 방지)
 ************************************************************************/
window.addEventListener('pagehide', function () {
    oAPP.fn.detachIpcEvents();
    oAPP.fn.detachOpenerCloseWatch();
}, { once: true });
