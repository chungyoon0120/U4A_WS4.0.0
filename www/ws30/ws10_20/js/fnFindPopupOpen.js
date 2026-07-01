/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnFindPopupOpen.js
 * - file Desc : [WS20] Find (찾기) — HTML5 별도창 opener
 * ----------------------------------------------------------------------
 *  원본: Popups/findPopup (UI5 별도 BrowserWindow: frame.html→frame.js→iframe index.html→index.js,
 *        sap.tnt.ToolPage = 좌 SideNavigation(5메뉴) + 우 NavContainer(메뉴별 테이블)).
 *  HTML5: frameless 별도창 1단(공통 .u4a-titlebar) — versionMng/runtimeClassNav 와 동일 컨벤션.
 *   · 창 본문 = Popups/findPopup/findFrame.html (좌 네비 + 메뉴별 공통 .u4a-table + 검색).
 *   · IF 데이터(사용자/테마/변경속성/서버이벤트/T_0022)는 did-finish-load 후 IPC 'if-find-info' 로 전달.
 *   · 링크 클릭 → 원본 계약 1:1:
 *       ${BROWSKEY}--find            (row) → fnIpcMain_Find            : 트리 선택 → --find--success
 *       ${BROWSKEY}--find--controller(row) → fnIpcMain_Find_Controller : 컨트롤러(클래스빌더) 실행
 *       ${BROWSKEY}--find--data--refresh   → fnIpcMain_Find_Data_Refresh: 최신 데이터 재수집 → callback
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        IPCMAIN = parent.IPCMAIN,
        IPCRENDERER = parent.IPCRENDERER,
        APP = parent.APP,
        CURRWIN = REMOTE.getCurrentWindow(),
        APPCOMMON = oAPP.common;

    /**************************************************************************
     * WS20 Find 별도창 Open
     **************************************************************************/
    oAPP.fn.fnFindPopupOpen = function () {

        // busy 키고 Lock 걸기 + 전체 자식 윈도우 Busy
        oAPP.common.fnSetBusyLock("X");
        try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" }); } catch (e) { }

        const sPopupName = "UIFIND";

        // 기존에 Find 창이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
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
            oThemeInfo = parent.getThemeInfo();

        // 창 제목(원본 oBrowserOptions.title = /U4A/CL_WS_COMMON D02 "Find").
        let sTitle = "";
        try { sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D02") || "Find"; }
        catch (e) { sTitle = "Find"; }

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
        oBrowserOptions.width = 1100;
        oBrowserOptions.height = 720;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // find 대상 모수(변경 속성 정보)는 창 생성 전 스냅샷.
        const aAttrData = oAPP.fn.getAttrChangedData();

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
            // 부모 위치 가운데 배치(busy 해제는 프레임이 렌더 완료 후 SETBUSYLOCK/BUSY_OFF 로 — runtimeClassNav 동일).
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        });

        // 브라우저가 오픈이 다 되면 IF 데이터 전달(원본 if-find-info 1:1).
        oBrowserWindow.webContents.on('did-finish-load', function () {

            // 서버이벤트 리스트를 구한다(원본 동일 — 비동기 콜백).
            oAPP.fn.getServerEventList(function (aServerEventList) {

                const oFindData = {
                    oUserInfo: parent.getUserInfo(),   // 로그인 사용자 정보
                    oThemeInfo: oThemeInfo,            // 테마 개인화 정보
                    aAttrData: aAttrData,              // 변경 속성 정보(find 모수)
                    aServEvtData: aServerEventList,    // 서버 이벤트 리스트
                    aT_0022: oAPP.DATA.LIB.T_0022      // UI 클래스 매핑용
                };

                oBrowserWindow.webContents.send('if-find-info', oFindData);
                parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            try { IPCMAIN.off(`${BROWSKEY}--find`, oAPP.fn.fnIpcMain_Find); } catch (e) { }
            try { IPCMAIN.off(`${BROWSKEY}--find--controller`, oAPP.fn.fnIpcMain_Find_Controller); } catch (e) { }
            try { IPCMAIN.off(`${BROWSKEY}--find--data--refresh`, oAPP.fn.fnIpcMain_Find_Data_Refresh); } catch (e) { }
            oBrowserWindow = null;
            CURRWIN.focus();
        });

        // 선택한 UI 정보를 WS20 트리에 표시
        IPCMAIN.on(`${BROWSKEY}--find`, oAPP.fn.fnIpcMain_Find);

        // 선택한 UI 정보를 가지고 controller(class builder) 실행
        IPCMAIN.on(`${BROWSKEY}--find--controller`, oAPP.fn.fnIpcMain_Find_Controller);

        // Find Data Refresh
        IPCMAIN.on(`${BROWSKEY}--find--data--refresh`, oAPP.fn.fnIpcMain_Find_Data_Refresh);

    }; // end of oAPP.fn.fnFindPopupOpen

    /**************************************************************************
     * Find 창에서 전달 받은 UI 정보를 가지고 WS20 트리에 선택 표시.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find = async function (events, res) {

        await oAPP.fn.setSelectTreeItem(res.OBJID, res.UIATK, null);

        const BROWSKEY = parent.getBrowserKey();
        IPCRENDERER.send(`${BROWSKEY}--find--success`, "X");

    }; // end of oAPP.fn.fnIpcMain_Find

    /**************************************************************************
     * Find 창에서 전달 받은 UI 정보를 가지고 controller(class builder) 실행.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find_Controller = function (events, res) {

        APPCOMMON.execControllerClass(res.UIATV);

    }; // end of oAPP.fn.fnIpcMain_Find_Controller

    /**************************************************************************
     * Find Data 갱신 — 최신 변경속성/서버이벤트 재수집 후 창으로 콜백.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find_Data_Refresh = function (events, res) {

        oAPP.fn.getServerEventList(function (aServerEventList) {

            const oSender = events.sender,
                oWebPref = oSender.getWebPreferences(),
                sBrowserKey = oWebPref.browserkey;

            const oFindData = {
                oUserInfo: parent.getUserInfo(),
                oThemeInfo: parent.getThemeInfo(),
                aAttrData: oAPP.fn.getAttrChangedData(),
                aServEvtData: aServerEventList,
                aT_0022: oAPP.DATA.LIB.T_0022
            };

            oSender.send(`${sBrowserKey}--find--data--refresh--callback`, oFindData);

        });

    }; // end of oAPP.fn.fnIpcMain_Find_Data_Refresh

})(window, $, oAPP);
