/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : OTRF4HelpPopup/frame.js
 * - file Desc : OTR Manager Popup (UI5 → HTML5 변환) 외부 셸.
 *               창 크롬(공통 .u4a-titlebar: 로고/제목/min·max·close + 드래그) +
 *               IPC/Busy/테마/Broadcast 유지. 검색폼/결과 테이블 본문은 index.html(iframe).
 *               Electron/Node·IPC 채널 계약(if_OTRF4HelpPopup / if-otr-callback /
 *               if-send-action-<BROWSKEY>)은 그대로 유지(06.팝업 7.5).
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

    // 현재 비지 상태
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
    oAPP.BROWSKEY = oQueryParams.browserkey;
    oAPP.USERDATA = oAPP.APP.getPath("userData");
    oAPP.attr.LANGU = LANGU;   // Workspace 언어(라벨 현지화) — index.js 가 no-data 등에서 사용

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
     *             부모 창과 동일 테마 일관성(06.팝업 7.5). outer + iframe 양쪽 반영.
     *************************************************************/
    oAPP.fn.applyTheme = function (sUI5Theme) {

        if (!window.U4ATheme) {
            return;
        }

        let sKey = window.U4ATheme.apply(sUI5Theme);

        // 테마 <link> 로드 후 첫 페인트 플래시용 --boot-bg 는 해제(안 그러면 테마 미리보기 시 배경 고정).
        try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }

        // iframe(본문) 도 동일 테마로 맞춘다.
        try {
            let oFrame = document.getElementById("ws_frame");
            let oWin = oFrame && oFrame.contentWindow;
            if (oWin && oWin.U4ATheme) {
                oWin.U4ATheme.apply(sKey);
                try { oWin.document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }
            }
        } catch (e) { /* iframe 미로드 시 무시 — 로드 시점에 부모 테마를 따라간다 */ }

        return sKey;

    }; // end of oAPP.fn.applyTheme

    /*************************************************************
     * @function - SYSID에 해당하는 테마 변경 IPC 이벤트(전 창 실시간 동기화)
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange() {

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if (!oThemeInfo) {
            return;
        }

        // OS 창 배경색도 테마색으로 갱신(흰 플래시 방지)
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oAPP.REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);

        oAPP.fn.applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange


    /*************************************************************
     * @function - IPC Event 등록 / 해제
     *************************************************************/
    oAPP.fn.attachIpcEvents = function () {
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);
    };

    oAPP.fn.detachIpcEvents = function () {
        oAPP.IPCMAIN.off(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);
    };


    /***********************************************************
     * 로딩 인디케이터 표시/숨김
     ***********************************************************/
    oAPP.setBusyLoading = function (bIsShow) {

        var oLoadPg = document.getElementById("u4a_main_load");
        if (!oLoadPg) {
            return;
        }

        if (bIsShow === 'X') {
            oLoadPg.classList.remove("u4a_loadersInactive");
        } else {
            oLoadPg.classList.add("u4a_loadersInactive");
        }

    };

    oAPP.fn.getBusy = function () {
        return oAPP.attr.isBusy;
    };

    /*******************************************************
     * @function - Busy indicator (UI5 core lock → 창 잠금/로더로 대체)
     *******************************************************/
    oAPP.fn.setBusy = function (bIsBusy, sOption) {

        oAPP.attr.isBusy = bIsBusy;

        var _ISBROAD = sOption?.ISBROAD || undefined;

        if (bIsBusy === true || bIsBusy === "X") {

            oAPP.CURRWIN.closable = false;
            oAPP.setBusyLoading('X');

            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_ON" });
            }

        } else {

            oAPP.CURRWIN.closable = true;
            oAPP.setBusyLoading('');

            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
            }

        }

    }; // end of oAPP.fn.setBusy


    /************************************************************************
     * 공통 .u4a-titlebar 초기화 — 로고/제목/창 제어(min/max/close).
     * 창 이동 드래그는 shell.css(-webkit-app-region:drag)가 자동 처리.
     ************************************************************************/
    oAPP.fn.fnInitHeader = function () {

        // 로고(file:/// URL) — CSS Editor(editorFrame.js _initChrome) 동일.
        try {
            var oLogo = document.getElementById("otrLogo");
            if (oLogo) {
                var sLogoPath = String(oAPP.PATHINFO.WS_LOGO).replace(/\\/g, "/");
                oLogo.src = encodeURI("file:///" + sLogoPath);
            }
        } catch (e) { }

        // 제목 = "OTR Manager" (메시지 키 B59, 하드코딩 금지). 쿼리 TITLE 도 동일.
        var oTitle = document.getElementById("otrTitle");
        if (oTitle) {
            oTitle.textContent = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B59");
        }

        // 창 제어 — 공통 .u4a-winbtn (frameless)
        var oMin = document.getElementById("otrWinMin");
        if (oMin) {
            oMin.addEventListener("click", function () { try { oAPP.CURRWIN.minimize(); } catch (e) { } });
        }

        var oMax = document.getElementById("otrWinMax");
        if (oMax) {
            oMax.addEventListener("click", function () {
                try { if (oAPP.CURRWIN.isMaximized()) { oAPP.CURRWIN.unmaximize(); } else { oAPP.CURRWIN.maximize(); } } catch (e) { }
            });
        }

        var oClose = document.getElementById("otrWinClose");
        if (oClose) {
            oClose.addEventListener("click", function () { oAPP.fn.fnClose(); });
        }

    }; // end of oAPP.fn.fnInitHeader

    /************************************************************************
     * 창 닫기 — Busy 중이면 무시(원본 onbeforeunload 동일). closable:false 로 열렸으니 풀고 닫는다.
     ************************************************************************/
    oAPP.fn.fnClose = function () {

        if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) {
            return;
        }

        try {
            var oCurrWin = oAPP.REMOTE.getCurrentWindow();
            if (!oCurrWin.isDestroyed()) {
                oCurrWin.setClosable(true);
                oCurrWin.close();
            }
        } catch (e) { /* 이미 파괴된 창 무시 */ }

    }; // end of oAPP.fn.fnClose

    /************************************************************************
     * 본문(iframe) 등장 — 네이티브 창 opacity 페이드 대신 CSS opacity transition.
     *   index.js 가 F4 로딩 완료 시 호출(editorPopup _fadeInContent 동일, 16.공통UX 2.6).
     ************************************************************************/
    oAPP.fn.fnShowContent = function () {
        var el = document.getElementById("otrContent");
        if (el) { el.classList.add("u4aOtrShown"); }
    }; // end of oAPP.fn.fnShowContent


    /************************************************************************
     * IPCRENDERER Events.. (opener 의 did-finish-load → 초기 데이터)
     ************************************************************************/
    oAPP.IPCRENDERER.on('if_OTRF4HelpPopup', async (events, oInfo) => {

        oAPP.attr.oUserInfo = oInfo.oUserInfo; // User 정보(필수)
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo; // 테마 개인화 정보
        oAPP.attr.T_9011 = oInfo.T_9011;     // OTR 데이터(원본 전달 항목 유지)
        oAPP.attr.oAppInfo = oInfo.oAppInfo;
        oAPP.attr.servNm = oInfo.servNm;     // 백엔드 호출 베이스 URL(/f4serverData)

        // 전달받은 테마를 셸 토큰으로 적용(부모와 동일 테마 일관성)
        if (oInfo.oThemeInfo && oInfo.oThemeInfo.THEME) {
            oAPP.fn.applyTheme(oInfo.oThemeInfo.THEME);
        }

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        // iframe 본문도 첫 페인트 전 테마 적용(흰 플래시 방지) — BGCOL/THEME 쿼리 전달(16.공통UX 2.6).
        var sBg = (oInfo.oThemeInfo && oInfo.oThemeInfo.BGCOL) ? oInfo.oThemeInfo.BGCOL : "";
        var sTheme = (oInfo.oThemeInfo && oInfo.oThemeInfo.THEME) ? oInfo.oThemeInfo.THEME : "";
        oWs_frame.src = "index.html?BGCOL=" + encodeURIComponent(sBg) + "&THEME=" + encodeURIComponent(sTheme);

    });

    window.oAPP = oAPP;

    return oAPP;

})(window);


/************************************************************************
 * -- Start of Program
 ************************************************************************/
window.onload = function () {

    // 다른 자식 창과의 Busy 동기화 채널
    oAPP.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${oAPP.BROWSKEY}`);

    oAPP.broadToChild.onmessage = function (oEvent) {

        var _PRCCD = oEvent?.data?.PRCCD || undefined;
        if (typeof _PRCCD === "undefined") {
            return;
        }

        switch (_PRCCD) {
            case "BUSY_ON":
                oAPP.fn.setBusy(true, { ISBROAD: true });
                break;
            case "BUSY_OFF":
                oAPP.fn.setBusy(false, { ISBROAD: true });
                break;
            default:
                break;
        }

    };

    // 첫 페인트 직후 테마 적용(IPC 도착 전 흰 플래시 방지). IPC 도착 시 재적용.
    try {
        var oTheme = oAPP.fn.getThemeInfo();
        if (oTheme && oTheme.THEME) {
            oAPP.fn.applyTheme(oTheme.THEME);
        }
    } catch (e) { /* 기본 라이트 토큰 */ }

    // 네이티브 메뉴 제거 + 헤더 초기화 + 테마 변경 IPC 등록
    oAPP.CURRWIN.setMenu(null);
    oAPP.fn.fnInitHeader();
    oAPP.fn.attachIpcEvents();

    // Esc = 닫기(공통 UX). 키 꾹 누름(auto-repeat) 가드.
    document.addEventListener("keydown", function (ev) {
        if (ev.repeat) { return; }
        if (ev.key === "Escape") { oAPP.fn.fnClose(); }
    });

    // 데이터 도착 전까지 로딩 표시
    oAPP.setBusyLoading('X');

    // 창 즉시 표시(네이티브 opacity 페이드 미사용 — 흰 플래시 방지). 위치는 opener ready-to-show 에서 잡힘.
    //   backgroundColor=BGCOL 로 이미 불투명·테마 배경이라 흰 번쩍 없음(16.공통UX 2.6).
    try { oAPP.CURRWIN.show(); } catch (e) { }

};

/************************************************************************
 * 창 닫을때 호출 되는 이벤트 — Busy 중이면 닫지 않는다(원본 동일).
 ************************************************************************/
window.onbeforeunload = function () {

    if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) {
        return false;
    }

};

/************************************************************************
 * 페이지가 실제로 숨겨지거나 종료 처리될 때 — IPC 리스너 해제(죽은 콜백 방지)
 ************************************************************************/
window.addEventListener('pagehide', function () {

    oAPP.fn.detachIpcEvents();

}, { once: true });
