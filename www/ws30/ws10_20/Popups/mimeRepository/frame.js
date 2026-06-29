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

        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme", `${SYSID}.json`);
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

    oAPP.fn.setBusy = function (bIsBusy) {

        var bOn = (bIsBusy === true || bIsBusy === "X");
        oAPP.attr.isBusy = bOn ? "X" : "";

        var oB = document.getElementById("mimeBusy");
        if (oB) { oB.hidden = !bOn; }

        try { oAPP.CURRWIN.closable = !bOn; } catch (e) { }

    }; // end of oAPP.fn.setBusy

    // 본문(mime.js)이 부르는 별칭 — 원본 oAPP.common.fnSetBusyLock / parent.setBusy / parent.getBusy 대응.
    oAPP.common.fnSetBusyLock = function (s) { oAPP.fn.setBusy(s === "X" ? "X" : ""); };
    oAPP.fn.setBusyState = function (s) { oAPP.fn.setBusy(s === "X" ? "X" : ""); };


    /***********************************************************
     * 공통 토스트(원본 parent.showMessage 대체) — 화면 정중앙 .u4a-toast 싱글톤.
     *   type S/I → 3초, E/W → 6초(오류는 좀 더 오래). 멀티라인 지원.
     ***********************************************************/
    var _iToastTimer = null;
    oAPP.fn.showMessage = function (a, b, sType, sMsg) {

        // 원본 호출형: showMessage(null, 10/20, "S|I|E|W", msg)
        if (sMsg == null || sMsg === "") { return; }

        var oToast = document.getElementById("u4aMimeToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aMimeToast";
            oToast.className = "u4a-toast";
            document.body.appendChild(oToast);
        }

        var bErr = (sType === "E" || sType === "W");
        oToast.setAttribute("data-type", bErr ? "error" : "info");
        oToast.textContent = sMsg;
        void oToast.offsetWidth;
        oToast.setAttribute("data-show", "true");

        if (_iToastTimer) { clearTimeout(_iToastTimer); }
        _iToastTimer = setTimeout(function () { oToast.setAttribute("data-show", "false"); }, bErr ? 6000 : 3000);

    }; // end of oAPP.fn.showMessage

    // 사운드/로그인 체크/푸터메시지 — 별도창에선 경량 처리(원본 부작용 없음).
    oAPP.fn.setSoundMsg = function () { /* 별도창 — 사운드 생략(원본 sap sound 비결합) */ };
    oAPP.fn.sendAjaxLoginChk = function (cb) { try { cb({ RETCD: "S" }); } catch (e) { } };
    oAPP.fn.fnHideFloatingFooterMsg = function () { };
    oAPP.fn.getUserInfo = function () { return oAPP.attr.oUserInfo || { LANGU: oAPP.attr.LANGU }; };
    oAPP.fn.getServerPath = function () { return oAPP.attr.servNm || ""; };
    oAPP.fn.checkWLOList = function () { return oAPP.attr.wloLazy === true; };


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

        var oTitle = document.getElementById("mimeTitle");
        if (oTitle) {
            oTitle.textContent = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C26"); // U4A MIME Repository
        }

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

        // 본문(mime.js) 시작 — 트리/속성/미리보기 빌드 + 데이터 로드.
        try { if (typeof window.fnMimeStart === "function") { window.fnMimeStart(); } } catch (e) { console.error("[HTML5][MIME] start 오류:", e); }

        // 본문 페이드인 + 메인 Busy Lock 해제(원본 별도창 동일).
        oAPP.fn.fnShowContent();
        try { oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } catch (e) { }

    });

    window.oAPP = oAPP;

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

    // Esc = 닫기(공통 UX). 키 꾹 누름(auto-repeat) 가드.
    document.addEventListener("keydown", function (ev) {
        if (ev.repeat) { return; }
        if (ev.key === "Escape") { oAPP.fn.fnClose(); }
    });

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
