/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : errMsgPopup/frame.js
 * - file Desc : Error Message Popup (UI5 → HTML5 변환) 외부 셸.
 *               창 크롬(에러 헤더/닫기/드래그) + IPC/Busy/테마/Broadcast 유지,
 *               본문 테이블은 index.html(iframe)에서 렌더.
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

    oAPP.REMOTE = require('@electron/remote');
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain,
        oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.CURRWIN = oAPP.REMOTE.getCurrentWindow();
    oAPP.BROWSKEY = oQueryParams.browserkey;
    oAPP.USERDATA = oAPP.APP.getPath("userData");

    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);


    /*************************************************************
     * @function - 테마 정보를 구한다.
     *************************************************************/
    oAPP.fn.getThemeInfo = function () {

        let sSysID = SYSID;

        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme", `${sSysID}.json`);
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

    } // end of oAPP.fn.getThemeInfo


    /*************************************************************
     * @function - 전달받은 테마(UI5 테마명)를 셸 테마 토큰으로 적용.
     *             부모 창과 동일 테마 일관성 유지(06.팝업 7.5).
     *             outer(이 문서) + inner(iframe) 양쪽에 반영.
     *************************************************************/
    oAPP.fn.applyTheme = function (sUI5Theme) {

        if (!window.U4ATheme) {
            return;
        }

        let sKey = window.U4ATheme.apply(sUI5Theme);

        // iframe(본문 테이블)도 동일 테마로 맞춘다.
        try {
            let oFrame = document.getElementById("ws_frame");
            let oWin = oFrame && oFrame.contentWindow;
            if (oWin && oWin.U4ATheme) {
                oWin.U4ATheme.apply(sKey);
            }
        } catch (e) { /* iframe 미로드 시 무시 — 로드 시점에 부모 테마를 따라간다 */ }

        return sKey;

    }; // end of oAPP.fn.applyTheme

    /*************************************************************
     * @function - SYSID에 해당하는 테마 변경 IPC 이벤트
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange() {

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if (!oThemeInfo) {
            return;
        }

        // OS 창 배경색도 테마색으로 갱신(흰 플래시 방지) — 기존 동작 유지.
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        let oBrowserWindow = oAPP.REMOTE.getCurrentWindow();
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        oAPP.fn.applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange


    /*************************************************************
     * @function - IPC Event 등록
     *************************************************************/
    oAPP.fn.attachIpcEvents = function () {

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);

    }; // end of oAPP.fn.attachIpcEvents

    /*************************************************************
     * @function - IPC Event 해제
     *************************************************************/
    oAPP.fn.detachIpcEvents = function () {

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 해제한다.
        oAPP.IPCMAIN.off(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);

    }; // end of oAPP.fn.detachIpcEvents


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

    /***********************************************************
     * Busy 실행 여부 정보 리턴
     ***********************************************************/
    oAPP.fn.getBusy = function () {

        return oAPP.attr.isBusy;

    };

    /*******************************************************
     * @function - Busy indicator 실행 (UI5 core lock → 창 잠금/로더로 대체)
     *******************************************************/
    oAPP.fn.setBusy = function (bIsBusy, sOption) {

        // 현재 Busy 실행 여부 플래그
        oAPP.attr.isBusy = bIsBusy;

        // 브로드 캐스트 객체
        var _ISBROAD = sOption?.ISBROAD || undefined;

        if (bIsBusy === true) {

            // 브라우저 닫기 버튼 비활성
            oAPP.CURRWIN.closable = false;

            oAPP.setBusyLoading('X');

            //다른 팝업의 BUSY ON 요청 처리.
            //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_ON" });
            }

        } else {

            // 브라우저 닫기 버튼 활성
            oAPP.CURRWIN.closable = true;

            oAPP.setBusyLoading('');

            //다른 팝업의 BUSY OFF 요청 처리.
            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
            }

        }

    }; // end of oAPP.fn.setBusy


    /************************************************************************
     * 에러 헤더(드래그 핸들) 초기화 — 제목/닫기 버튼.
     ************************************************************************/
    oAPP.fn.fnInitHeader = function () {

        // 제목 = "Error Message" (메시지 키 D25, 하드코딩 금지)
        var oTitle = document.getElementById("u4aErrHdrTitle");
        if (oTitle) {
            oTitle.textContent = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D25");
        }

        // 닫기 — 기존 UI5 decline 버튼과 동일하게 현재 창 close()
        var oClose = document.getElementById("u4aErrCloseBtn");
        if (oClose) {
            oClose.addEventListener("click", function () {
                try {
                    var oCurrWin = oAPP.REMOTE.getCurrentWindow();
                    if (!oCurrWin.isDestroyed()) {
                        oCurrWin.close();
                    }
                } catch (e) { /* 이미 파괴된 창 무시 */ }
            });
        }

    }; // end of oAPP.fn.fnInitHeader


    /************************************************************************
     * IPCRENDERER Events.. (opener 의 did-finish-load → 초기 데이터)
     ************************************************************************/
    oAPP.IPCRENDERER.on('if-errmsg-info', (events, oInfo) => {

        oAPP.attr.oUserInfo = oInfo.oUserInfo; // User 정보(필수)
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo; // 테마 개인화 정보
        oAPP.attr.aMsg = oInfo.aMsg;

        // 전달받은 테마를 셸 토큰으로 적용(부모와 동일 테마 일관성)
        if (oInfo.oThemeInfo && oInfo.oThemeInfo.THEME) {
            oAPP.fn.applyTheme(oInfo.oThemeInfo.THEME);
        }

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        oWs_frame.src = "index.html";

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

    // 메뉴 라인 삭제 + 헤더 초기화 + 테마 변경 IPC 등록
    oAPP.CURRWIN.setMenu(null);
    oAPP.fn.fnInitHeader();
    oAPP.fn.attachIpcEvents();

    // 데이터 도착 전까지 로딩 표시
    oAPP.setBusyLoading('X');

};

/************************************************************************
 * 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 이벤트
 ************************************************************************/
window.addEventListener('pagehide', function () {

    oAPP.fn.detachIpcEvents();

}, { once: true });
