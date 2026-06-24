/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : fnEditorPopupOpen.js
 * - file Desc : CSS, JAVASCRIPT, HTML Editor
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        IPCMAIN = parent.IPCMAIN,
        WSUTIL = parent.WSUTIL,
        PATH = parent.PATH,
        APP = parent.APP,
        APPPATH = parent.APPPATH,
        CURRWIN = REMOTE.getCurrentWindow(),
        APPCOMMON = oAPP.common;

    /************************************************************************
     * 에디터 오픈 (html, css, javascript Editor)
     * **********************************************************************
     * @param {Object} oEditInfo
     * - 오픈 하려는 에디터의 타입 정보
     ************************************************************************/
    oAPP.fn.fnEditorPopupOpen = function (oEditInfo, sSearchValue) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_ON" });

        let oCurrWin = REMOTE.getCurrentWindow(),
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oAppInfo = parent.getAppInfo(),
            // sBrowserTitle = oAppInfo.APPID + " - " + oEditInfo.OBJNM + " Editor";
            sBrowserTitle = oAppInfo.APPID + " - " + oEditInfo.OBJNM;

        sBrowserTitle += " " + oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D23"); // Editor

        // 기존에 Editor 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(oEditInfo.OBJTY);
        if (oResult.ISOPEN) {

            if (oEditInfo.OBJTY === "CS") {
                lf_webContentSend(oResult.WINDOW, sSearchValue);
            }

            // 부모 위치 가운데 배치한다.            
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_OFF" });

            return;

        }

        let oThemeInfo = parent.getThemeInfo(), // theme 정보  
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = sBrowserTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.parent = oCurrWin;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        
        // [HTML5] 네이티브 창 opacity 페이드 미사용 — OS 레벨 리컴포짓이라 무겁다. 창은 즉시
        //   불투명하게 띄우고(show=false 로 위치 잡힌 뒤 표시), 등장 효과는 창 안 컨텐츠를
        //   CSS opacity transition 으로 처리(editorFrame.js/editor.css). (opacity=0.0 제거)
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = oEditInfo.OBJTY;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        const sUrlPath = parent.getPath("EDITPOP");

        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: oEditInfo.OBJTY,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창의 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: sBrowserTitle,
        };

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
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow, oBrowserOptions);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            lf_webContentSend(oBrowserWindow, sSearchValue);

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow, oBrowserOptions);

        });

        // EDITOR의 저장을 위한 IPC 이벤트
        IPCMAIN.on("if-editor-save", oAPP.fn.fnIpcMain_EditorSave);

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            // IPCMAIN 이벤트 해제
            IPCMAIN.removeListener("if-editor-save", oAPP.fn.fnIpcMain_EditorSave);

            oBrowserWindow = null;

            CURRWIN.focus();

        });

        function lf_webContentSend(oBrowserWindow, sSearchValue) {

            // 에디터 타입에 해당하는 데이터를 구한다.
            var oGetEditorData = oAPP.fn.fnGetEditorData(oEditInfo.OBJTY);

            // 에디터 타입에 맞는 데이터를 저장한다.
            oEditInfo.DATA = oGetEditorData && oGetEditorData.DATA ? oGetEditorData.DATA : "";

            var oEditorInfo = {
                APPINFO: oAppInfo,
                EDITORINFO: oEditInfo,
                SRCHVAL: sSearchValue // 선택한 style class의 검색용 데이터
            };

            oBrowserWindow.webContents.send('if-editor-info', oEditorInfo);

        }

    }; // end of oAPP.fn.fnEditorPopupOpen

    /************************************************************************
     * Editor 팝업의 저장 버튼 이벤트를 수행하기 위한 IPCMAIN 이벤트
     * **********************************************************************/
    oAPP.fn.fnIpcMain_EditorSave = function (event, res) {

        var BROWSKEY = parent.getBrowserKey();

        if (BROWSKEY != res.BROWSKEY) {
            return;
        }

        // 저장할 데이터
        var oSaveData = res.SAVEDATA;

        // CSS & JAVASCRIPT && HTML 각 에디터 타입별 해당 데이터 저장
        oAPP.fn.fnSetEditorData(oSaveData);

        // 어플리케이션 정보에 변경 플래그
        try { parent.setAppChange(res.IS_CHAG); } catch (e) { console.error("[HTML5][editor] setAppChange 오류:", e && e.message); }

        // 저장으로 변경분 발생 → WS20 헤더 Active→Inactive 반영(클라이언트 에디터 lf_cb 와 동일 처리).
        //   setAppInfo 가 글로벌 oAppInfo 에 ACTST="I"/IS_CHAG="X" 를 세팅했으므로 헤더만 다시 그린다.
        try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

    }; // end of oAPP.fn.fnIpcMain_EditorSave

    /************************************************************************
     * CSS & JAVASCRIPT && HTML 각 에디터 타입별 해당 데이터 구하기
     ************************************************************************
     * @param {String}  OBJTY
     * - 에디터 타입
     * 
     * @return {Object || undefined} 
     * - 에디터 타입에 따른 에디터 정보 리턴
     * - 에디터 타입에 따른 에디터 정보가 없으면 undefined
     ************************************************************************/
    oAPP.fn.fnGetEditorData = function (OBJTY) {

        // 세개의 오브젝트 중에 하나라도 없으면 빠져나감.
        if (!OBJTY || !oAPP.DATA || !oAPP.DATA.APPDATA || !oAPP.DATA.APPDATA.T_EDIT) {
            return;
        }

        // 에디터 데이터가 Array 가 아니면 빠져나감.
        var aEditorData = oAPP.DATA.APPDATA.T_EDIT;
        if (!Array.isArray(aEditorData)) {
            return;
        }

        return aEditorData.find(oEditorData => oEditorData.OBJTY == OBJTY);

    }; // end of oAPP.fn.fnGetEditorDvata

    /************************************************************************
     * CSS & JAVASCRIPT && HTML 각 에디터 타입별 해당 데이터 저장
     ************************************************************************
     * @param {Object}  oSaveData
     * - 저장할 에디터 정보와 데이터     
     ************************************************************************/
    oAPP.fn.fnSetEditorData = function (oSaveData) {

        // 세개의 오브젝트 중에 하나라도 없으면 빠져나감.
        if (!oAPP.DATA || !oAPP.DATA.APPDATA || !oAPP.DATA.APPDATA.T_EDIT) {
            return;
        }

        // 에디터 데이터가 Array 가 아니면 빠져나감.
        var aEditorData = oAPP.DATA.APPDATA.T_EDIT;
        if (!Array.isArray(aEditorData)) {
            return;
        }

        var oBeforeData = oAPP.fn.fnGetEditorData(oSaveData.OBJTY);

        if (typeof oBeforeData === "undefined") {

            oBeforeData = {};
            oBeforeData.OBJID = oSaveData.OBJID;
            oBeforeData.OBJTY = oSaveData.OBJTY;
            oBeforeData.DATA = oSaveData.DATA;

            oAPP.DATA.APPDATA.T_EDIT.push(oBeforeData);
        }

        oBeforeData.DATA = oSaveData.DATA;

        switch (oSaveData.OBJTY) {
            case "CS":
                // CS 라이브 프리뷰 — 디자인 미리보기 프레임에 즉시 CSS 적용.
                //   [HTML5] 미리보기 프레임(oAPP.attr.ui.frame)이 아직 미배선이면 null 일 수 있어 방어
                //   (없어도 저장 자체는 성공 — 라이브 반영만 skip. W2 미리보기 연동 시 동작).
                try {
                    var oPrevWin = oAPP.attr.ui && oAPP.attr.ui.frame && oAPP.attr.ui.frame.contentWindow;
                    if (oPrevWin && typeof oPrevWin.setCSSSource === "function") {
                        oPrevWin.setCSSSource(oSaveData.DATA);
                    }
                } catch (e) { console.error("[HTML5][editor] CS 라이브 프리뷰 오류:", e && e.message); }
                break;
        }

    }; // end of oAPP.fn.fnSetEditorData

})(window, $, oAPP);