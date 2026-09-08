/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : fnErrorPageEditorPopupOpen.js
 * - file Desc : Error Page Editor
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
        APPCOMMON = oAPP.common;


    oAPP.fn.fnErrorPageEditorPopupOpen = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_ON" });

        const sPopupName = "ERRPAGE";

        // 기존에 Editor 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_OFF" });

            return;
        }

        let oCurrWin = REMOTE.getCurrentWindow(),
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oAppInfo = parent.getAppInfo(),
            oEditData = oAPP.DATA.APPDATA.S_ERHTML,
            oUserInfo = parent.getUserInfo(),
            oThemeInfo = parent.getThemeInfo(), // theme 정보   
            // sBrowserTitle = "Editor - Customizing the Error Page";

            sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D23"); // Editor
            sTitle += " - " + APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D32"); // Customizing the Error Page

        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = sTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.parent = oCurrWin;

        // [HTML5] 네이티브 창 opacity 페이드 미사용(OS 리컴포짓이라 무겁다) — 창은 즉시 띄우고(show=false 로
        //   위치 잡힌 뒤 표시), 등장 효과는 창 안 컨텐츠를 CSS opacity transition 으로 처리(errorPageEditorFrame).
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

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
            // [HTML5] frameless 창의 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: sTitle,
        };

        const sUrlPath = parent.getPath(sPopupName);

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });        

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oEditorInfo = {
                APPINFO: oAppInfo,
                oThemeInfo: oThemeInfo, // 테마 개인화 정보
                EDITDATA: oEditData,
                USERINFO: oUserInfo
            };

            oBrowserWindow.webContents.send('if-editor-info', oEditorInfo);

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // EDITOR의 저장을 위한 IPC 이벤트
        IPCMAIN.on("if-ErrorPageEditor-Save", oAPP.fn.fnIpcMain_ErrorPageEditorSave);

        // ErrPageEditor 미리보기에 반영할 html을 받을 목적인 IPC 이벤트
        IPCMAIN.on("if-ErrorPage-Preview", oAPP.fn.fnIpcMain_ErrorPagePreview);

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            // IPCMAIN 이벤트 해제
            IPCMAIN.removeListener("if-ErrorPageEditor-Save", oAPP.fn.fnIpcMain_ErrorPageEditorSave);
            IPCMAIN.removeListener("if-ErrorPage-Preview", oAPP.fn.fnIpcMain_ErrorPagePreview);

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnErrorPageEditorPopupOpen

    /************************************************************************
     * Error Page Editor 팝업의 저장 버튼 이벤트를 수행하기 위한 IPCMAIN 이벤트
     * **********************************************************************/
    oAPP.fn.fnIpcMain_ErrorPageEditorSave = function (event, res) {

        var BROWSKEY = parent.getBrowserKey();

        if (BROWSKEY != res.BROWSKEY) {
            return;
        }

        // 저장할 데이터
        var oSaveData = res.SAVEDATA;

        // 세개의 오브젝트 중에 하나라도 없으면 빠져나감.
        if (!oAPP.DATA || !oAPP.DATA.APPDATA || !oAPP.DATA.APPDATA.S_ERHTML) {
            return;
        }

        oAPP.DATA.APPDATA.S_ERHTML.HTML = oSaveData.HTML;
        oAPP.DATA.APPDATA.S_ERHTML.IS_USE = oSaveData.IS_USE;

        // 어플리케이션 정보에 변경 플래그
        try { parent.setAppChange('X'); } catch (e) { console.error("[HTML5][errPageEditor] setAppChange 오류:", e && e.message); }

        // 저장으로 변경분 발생 → WS20 헤더 Active→Inactive 반영(에디터 시리즈 fnIpcMain_EditorSave 와 동일 처리).
        try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

    }; // end of oAPP.fn.fnIpcMain_ErrorPageEditorSave

    /************************************************************************
     * Error Page Editor 팝업의 미리보기 IPCMAIN 이벤트
     * **********************************************************************/
    oAPP.fn.fnIpcMain_ErrorPagePreview = function (event, res) {        

        const BROWSKEY = parent.getBrowserKey();
        if (BROWSKEY != res.BROWSKEY) {
            return;
        }

        const sPopupName = "ERRPAGEPREV";

        // 기존에 Error Page Editor 미리보기 팝업이 열렸을 경우 창을 닫고 다시 띄운다.
        const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {
            oResult.WINDOW.close();
            // return;
        }

        const 
            oCurrWin = REMOTE.getCurrentWindow(),
            oSaveData = res.SAVEDATA,
            oParWin = res.PARWIN,
            SESSKEY = parent.getSessionKey();

        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        let sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B63"); // Error Page Editor
        sTitle += " " + APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A67"); // Preview

        // oBrowserOptions.title = "Error Page Preview";
        oBrowserOptions.title = sTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // [HTML5] 네이티브 창 opacity 페이드 미사용(무겁다) — 미리보기는 사용자 HTML 렌더라 즉시 표시.
        oBrowserOptions.devTools = false;
        oBrowserOptions.parent = oCurrWin;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        // oBrowserOptions.webPreferences.nodeIntegration = false;
        // oBrowserOptions.webPreferences.enableRemoteModule = false;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);       

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);       
     
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
        };

        const sUrlPath = parent.getPath(sPopupName);

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);            

        });

        oBrowserWindow.webContents.on('did-finish-load', () => {            

            oBrowserWindow.webContents.send('if-Error-Page-prev', oSaveData);

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);            

            // [HTML5] 네이티브 opacity 페이드 제거 — 로드 완료 시 닫기 버튼만 즉시 활성화.
            try {
                if (!oBrowserWindow.isDestroyed()) { oBrowserWindow.closable = true; }
            } catch (error) { }

            // 오류 페이지 미리보기가 로드가 되면 오류 페이지 에디터에 실행중인 Busy를 끄라고 알린다.
            parent.IPCRENDERER.send(`if-errorPageEditor-setBusy-${parent.getBrowserKey()}`, "");

        });  

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    };

})(window, $, oAPP);