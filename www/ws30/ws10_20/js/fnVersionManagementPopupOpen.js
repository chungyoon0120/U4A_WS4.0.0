/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnVersionManagementPopupOpen.js
 * - file Desc : [WS20] Version Management (버전 관리) — HTML5 별도창 opener
 * ----------------------------------------------------------------------
 *  원본: Popups/versionManagement/index.js (UI5 별도 BrowserWindow opener).
 *  HTML5: frameless 별도창(공통 .u4a-titlebar) — errPageEditor/MIME 와 동일 컨벤션.
 *   · 창 본문 = Popups/versionMng/versionMngFrame.html (목록 .u4a-table + Monaco diff 호스트).
 *   · IF 데이터(서버경로/앱정보/테마)는 did-finish-load 후 IPC 'if-vermng-info' 로 1회 전달.
 *   · 과거 버전 "새창으로 보기" = 프레임이 ${BROWSKEY}-if-version-management-new-window 를 보내면
 *     여기서 parent.onNewWindow({ACTCD:"MOVE20", APPID:TAPPID}) 로 WS20 새창 이동(원본 계약 1:1).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        IPCMAIN = parent.IPCMAIN,
        PATH = parent.PATH,
        APP = parent.APP,
        CURRWIN = REMOTE.getCurrentWindow(),
        WSUTIL = parent.require(parent.PATHINFO.WSUTIL);

    oAPP.fn.fnVersionManagementPopupOpen = function () {

        // busy 키고 Lock 걸기 + 전체 자식 윈도우 Busy
        oAPP.common.fnSetBusyLock("X");
        try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" }); } catch (e) { }

        const sPopupName = "VERMNG";

        // 기존에 버전 관리 창이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);
            oAPP.common.fnSetBusyLock("");
            try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e) { }
            return;
        }

        const
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oAppInfo = parent.getAppInfo(),
            oUserInfo = parent.getUserInfo(),
            oThemeInfo = parent.getThemeInfo();

        // 창 제목(원본 oBrowserOptions.title = ZMSG_WS_COMMON_001/403 "Version Management").
        let sTitle = "";
        try { sTitle = WSUTIL.getWsMsgClsTxt(oUserInfo.LANGU, "ZMSG_WS_COMMON_001", "403") || "Version Management"; }
        catch (e) { sTitle = "Version Management"; }

        const
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = sTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;   // 테마별 배경(첫 페인트 플래시 방지)
        oBrowserOptions.parent = CURRWIN;
        // [HTML5] 네이티브 opacity 페이드 미사용 — backgroundColor 로 즉시 불투명, show=false 로 위치 잡고 표시.
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        oBrowserOptions.width = 1200;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        try { REMOTEMAIN.enable(oBrowserWindow.webContents); } catch (e) { }

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: sTitle
        };

        const sUrlPath = parent.getPath(sPopupName);
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) { oBrowserWindow.webContents.openDevTools(); }

        oBrowserWindow.once('ready-to-show', () => {
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
            oAPP.common.fnSetBusyLock("");
            try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e) { }
        });

        // 브라우저가 오픈이 다 되면 IF 데이터 전달(원본 if-version-management 대응 → if-vermng-info).
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oSendData = {
                sServerPath: parent.getServerPath(),   // 서버 Url(원본 oAPP.IF_DATA.sServerPath)
                oAppInfo: oAppInfo,                     // 앱 정보(원본 oAppInfo)
                oUserInfo: oUserInfo,
                oThemeInfo: oThemeInfo
            };

            oBrowserWindow.webContents.send('if-vermng-info', oSendData);
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        });

        // 과거 버전 "새창으로 보기" → WS20 새창 이동(원본 _fnNewWindow + onNewWindow MOVE20).
        function _fnNewWindow(event, res) {
            const TAPPID = (res && res.TAPPID) || "";
            parent.onNewWindow({ ACTCD: "MOVE20", APPID: TAPPID });
        }
        IPCMAIN.on(`${BROWSKEY}-if-version-management-new-window`, _fnNewWindow);

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            try { IPCMAIN.removeListener(`${BROWSKEY}-if-version-management-new-window`, _fnNewWindow); } catch (e) { }
            oBrowserWindow = null;
            CURRWIN.focus();
        });

    }; // end of oAPP.fn.fnVersionManagementPopupOpen

})(window, $, oAPP);
