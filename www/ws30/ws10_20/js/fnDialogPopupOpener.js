/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : fnDialogPopupOpener.js
 * - file Desc : 각종 Dialog Popup Opener
 ************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    const
        PATH = parent.PATH,
        APP = parent.APP,
        APPPATH = parent.APPPATH,
        REMOTE = parent.REMOTE,
        SCREEN = parent.SCREEN,
        USERDATA = parent.USERDATA,
        REMOTEMAIN = parent.REMOTEMAIN,
        CURRWIN = REMOTE.getCurrentWindow(),
        IPCMAIN = parent.IPCMAIN,
        IPCRENDERER = parent.IPCRENDERER,
        SESSKEY = parent.getSessionKey(),
        BROWSKEY = parent.getBrowserKey(),
        WSUTIL = parent.require(parent.PATHINFO.WSUTIL),
        PATHINFO = parent.PATHINFO,
        APPCOMMON = oAPP.common;

    /************************************************************************
     * APP 검색 Popup 
     ************************************************************************
     * @param {Object} oOptions
     * - 검색 팝업 실행 시, 기본 옵션
     * @param {Boolean} [oOptions.autoSearch] 팝업 실행하자마자 자동검색
     * @param {Object}  [oOptions.initCond] 
     * - 초기 조회 조건 설정
     * @param {String}  [oOptions.initCond.PACKG] Package
     * @param {String}  [oOptions.initCond.APPID] Application ID
     * @param {String}  [oOptions.initCond.APPNM] Application Desc
     * @param {String}  [oOptions.initCond.APPTY] Application Type
     * @param {String}  [oOptions.initCond.EXPAGE] 
     * - 팝업을 실행하려는 Page 명
     * - 예) WS10, WS20, WS30
     * @param {String}  [oOptions.initCond.ERUSR] Create User
     * @param {Int}     [oOptions.initCond.HITS]  Max Count
     ************************************************************************/
    oAPP.fn.fnAppF4PopupOpener = function (oOptions, fnAppF4DataCallback) {

        if (oAPP.fn.fnAppF4PopupOpen) {
            oAPP.fn.fnAppF4PopupOpen(oOptions, fnAppF4DataCallback);
            return;
        }

        oAPP.loadJs("fnAppF4PopupOpen", function () {
            oAPP.fn.fnAppF4PopupOpen(oOptions, fnAppF4DataCallback);
        });

    }; // end of oAPP.fn.fnAppF4PopupOpener

    /************************************************************************
     * WS20의 찾기 버튼 팝업 실행시켜 주는 메소드
     ************************************************************************/
    oAPP.fn.fnFindPopupOpener = function () {

        if (oAPP.fn.fnFindPopupOpen) {
            oAPP.fn.fnFindPopupOpen();
            return;
        }

        oAPP.loadJs("fnFindPopupOpen", function () {
            oAPP.fn.fnFindPopupOpen();
        });

    }; // end of oAPP.fn.fnFindPopupOpener

    /************************************************************************
     * WS20의 MIME Dialog Opener (★기존 인앱 .u4a-dialog 판 — 롤백용으로 보존)
     *   현재 활성 경로는 fnMimeWindowOpener(별도 BrowserWindow). 되돌리려면 호출부를
     *   다시 이 메소드로 바꾸면 된다. (ws_events / ws_html5_usp / fnCssJsLinkAddPopupOpen)
     ************************************************************************/
    oAPP.fn.fnMimeDialogOpener = function () {

        if (oAPP.fn.fnMimePopupOpen) {
            oAPP.fn.fnMimePopupOpen();
            return;
        }

        oAPP.loadJs("fnMimePopupOpen", function () {
            oAPP.fn.fnMimePopupOpen();
        });

    }; // end of fnMimeDialogOpener

    /************************************************************************
     * WS20의 MIME Repository Opener — 별도 모달 BrowserWindow 판(★현재 활성).
     *   본문(트리/속성/미리보기)은 Popups/mimeRepository(frame.html+frame.js+mime.js)가 자기완결로 렌더.
     *   MIME 팝업은 WS20 로 되쓰기(상태 변경)가 없고 "현재 앱 정보"만 받아 좌측 트리를 표시 → IPC 단방향.
     *   계약: if-mime-info { oUserInfo, oThemeInfo, oAppInfo, servNm, wloLazy }. (browser-window-common-ux)
     *   ★ 인앱 판(fnMimeDialogOpener)은 롤백용으로 보존 — 둘은 독립.
     ************************************************************************/
    oAPP.fn.fnMimeWindowOpener = function () {

        // busy 키고 Lock 걸기 + 전체 자식 윈도우 Busy
        oAPP.common.fnSetBusyLock("X");
        try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" }); } catch (e) { }

        let sPopupName = "MIMEPOP";

        // 이미 열린 MIME 창이 있으면 새로 띄우지 말고 포커스만.
        //   ★ 부모(parent) 미지정이라 getChildWindows 기반 getCheckAlreadyOpenWindow 로는 못 찾음
        //     → 전체 창(getAllWindows)에서 URL OBJTY=MIMEPOP 로 검색(부모 무관).
        try {
            let aAll = REMOTE.BrowserWindow.getAllWindows();
            for (let wi = 0; wi < aAll.length; wi++) {
                let oW = aAll[wi];
                if (!oW || oW.isDestroyed()) { continue; }
                let sT = "";
                try { sT = WSUTIL.QueryString.parse(oW.getURL()).OBJTY; } catch (e) { sT = ""; }
                if (sT !== sPopupName) { continue; }
                try { if (oW.isMinimized()) { oW.restore(); } } catch (e) { }
                try { oW.focus(); } catch (e) { }
                oAPP.common.fnSetBusyLock("");
                try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e) { }
                return;
            }
        } catch (e) { }

        let SESSKEY2 = parent.getSessionKey(),
            BROWSKEY2 = parent.getBrowserKey(),
            oUserInfo = parent.getUserInfo(),
            oThemeInfo = parent.getThemeInfo();

        // WLO(UHAK901016) 지연로드 플래그 — WS20 에서 판정해 전달(별도창은 모델 비결합).
        let bWloLazy = false;
        try { bWloLazy = (oAPP.common.checkWLOList("C", "UHAK901016") === true); } catch (e) { bWloLazy = false; }

        // 현재 편집 중인 APP 정보 — 원본 fnMimePopupOpen _appInfo() 와 동일하게 모델에서 읽어 전달.
        //   (getAppInfo()=워크스페이스 레벨이라 WS20 편집 대상과 다를 수 있어 트리 스코프가 어긋남)
        let oMimeAppInfo = {};
        try { oMimeAppInfo = oAPP.common.fnGetModelProperty("/WS20/APP") || {}; } catch (e) { oMimeAppInfo = {}; }
        try { var _w3 = oAPP.common.fnGetModelProperty("/WS30/APP"); if (_w3 && _w3.APPID) { oMimeAppInfo = _w3; } } catch (e) { }

        // 브라우저 옵션
        let sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        let sMimeTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C26"); // U4A MIME Repository
        if (oMimeAppInfo && oMimeAppInfo.APPID) { sMimeTitle += " - " + oMimeAppInfo.APPID; } // 현재 앱 표시

        oBrowserOptions.title = sMimeTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // ★ 비모달 + 부모 미지정(사용자 결정) — 메인 창을 막지 않는 독립 창.
        //   (modal/parent 설정 제거. 되돌리려면 parent=CURRWIN; modal=true; 추가)
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        // [HTML5] frameless — 네이티브 OS 헤더 제거(공통 .u4a-titlebar 사용).
        oBrowserOptions.titleBarStyle = "hidden";
        // [HTML5] 네이티브 opacity 페이드 미사용 — backgroundColor 로 즉시 불투명, show=false 로 위치 잡고 표시.
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY2;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY2;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        REMOTEMAIN.enable(oBrowserWindow.webContents);

        // ★ 부모(parent) 미지정이라 getChildWindows 로 안 잡힘 → 메인의 자식창 맵에 등록해
        //   뒤로가기/모드전환(fnCloseAllWs20Dialogs → fnChildWindowClose → _closeAllChildWindowMap)에
        //   같은 브라우저키 팝업으로 자동 닫히게 한다. (닫힐 때 맵에서 제거)
        let oChildMap = null;
        try { oChildMap = parent.CURRWIN && parent.CURRWIN._aChildWinMap; } catch (e) { oChildMap = null; }
        try { if (oChildMap) { oChildMap.set(oBrowserWindow.id, oBrowserWindow); } } catch (e) { }

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: sMimeTitle,
            // 메인(WS) 창 id — 부모 미지정이라 메인이 상단 X/앱종료로 닫힐 때 따라죽도록
            //   MIME 창이 이 창의 'closed' 를 직접 구독(frame.js)해 self-close.
            OPENERID: CURRWIN.id
        };

        const sUrlPath = parent.getPath(sPopupName);
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        oBrowserWindow.once('ready-to-show', () => {
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        });

        oBrowserWindow.webContents.on('did-finish-load', function () {

            let oSendData = {
                oUserInfo: oUserInfo,
                oThemeInfo: oThemeInfo,
                oAppInfo: oMimeAppInfo,
                servNm: parent.getServerPath(),
                wloLazy: bWloLazy
            };

            oBrowserWindow.webContents.send('if-mime-info', oSendData);

            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        });

        let iMimeWinId = oBrowserWindow.id;
        oBrowserWindow.on('closed', () => {
            try { if (oChildMap) { oChildMap.delete(iMimeWinId); } } catch (e) { }
            oBrowserWindow = null;
            CURRWIN.focus();
        });

    }; // end of fnMimeWindowOpener

    /************************************************************************
     * WS20의 CSS & JS Link Add 팝업 실행시켜 주는 메소드
     ************************************************************************/
    oAPP.fn.fnCssJsLinkAddPopupOpener = function (TYPE) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        if (oAPP.fn.fnCssJsLinkAddPopupOpen) {
            oAPP.fn.fnCssJsLinkAddPopupOpen(TYPE);
            return;
        }

        oAPP.loadJs("fnCssJsLinkAddPopupOpen", function () {
            oAPP.fn.fnCssJsLinkAddPopupOpen(TYPE);
        });

    }; // end of oAPP.fn.fnCssJsLinkAddPopupOpen

    /************************************************************************
     * WS20의 Web Security 팝업 실행시켜 주는 메소드
     ************************************************************************/
    oAPP.fn.fnWebSecurityPopupOpener = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        if (oAPP.fn.fnWebSecurityPopupOpen) {
            oAPP.fn.fnWebSecurityPopupOpen();
            return;
        }

        oAPP.loadJs("fnWebSecurityPopupOpen", function () {
            oAPP.fn.fnWebSecurityPopupOpen();
        });

    }; // end of oAPP.fn.fnWebSecurityPopupOpener

    /************************************************************************
     * WS20 ROOT 속성 "Enable Dump Write"(DH001091) 팝업 실행시켜 주는 메소드
     *   @param {object} sAttr - 대상 속성 행(is_attr). 팝업이 UIATV/edit 를 읽어 반영한다.
     ************************************************************************/
    oAPP.fn.fnDumpWritePopupOpener = function (sAttr) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        if (oAPP.fn.fnDumpWritePopupOpen) {
            oAPP.fn.fnDumpWritePopupOpen(sAttr);
            return;
        }

        oAPP.loadJs("fnDumpWritePopupOpen", function () {
            oAPP.fn.fnDumpWritePopupOpen(sAttr);
        });

    }; // end of oAPP.fn.fnDumpWritePopupOpener

    /************************************************************************
     * WS20 ROOT 속성 "Use init pre-screen event"(DH001106) 팝업 실행시켜 주는 메소드
     *   @param {object} sAttr - 대상 속성 행(is_attr). 팝업이 UIATV/edit 를 읽어 반영한다.
     ************************************************************************/
    oAPP.fn.fnInitPreScreenPopupOpener = function (sAttr) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        if (oAPP.fn.fnInitPreScreenPopupOpen) {
            oAPP.fn.fnInitPreScreenPopupOpen(sAttr);
            return;
        }

        oAPP.loadJs("fnInitPreScreenPopupOpen", function () {
            oAPP.fn.fnInitPreScreenPopupOpen(sAttr);
        });

    }; // end of oAPP.fn.fnInitPreScreenPopupOpener

    /************************************************************************
     * WS20의 Client Event 팝업 실행시켜 주는 메소드
     ************************************************************************/
    oAPP.fn.fnClientEditorPopupOpener = function (TYPE, PARAM, fnCallback) {

        if (oAPP.fn.fnClientEditorPopupOpen) {
            oAPP.fn.fnClientEditorPopupOpen(TYPE, PARAM, fnCallback);
            return;
        }

        oAPP.loadJs("fnClientEditorPopupOpen", function () {
            oAPP.fn.fnClientEditorPopupOpen(TYPE, PARAM, fnCallback);
        });

    }; // end of oAPP.fn.fnClientEditorPopupOpener

    /************************************************************************
     * WS20의 Error Page Editor 팝업 실행시켜 주는 메소드
     ************************************************************************/
    oAPP.fn.fnErrorPageEditorPopupOpener = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Error Page Editor Popup Open
        if (oAPP.fn.fnErrorPageEditorPopupOpen) {
            oAPP.fn.fnErrorPageEditorPopupOpen();
            return;
        }

        oAPP.loadJs("fnErrorPageEditorPopupOpen", function () {
            oAPP.fn.fnErrorPageEditorPopupOpen();
        });

    }; // end of oAPP.fn.fnErrorPageEditorPopupOpener

    /************************************************************************
     * WS20의 Version Management(버전 관리) 별도창 실행시켜 주는 메소드 (HTML5)
     *   원본: parent.require(versionManagement/index.js)(REMOTE, oAPP) (UI5 별도창).
     *   HTML5: 다른 별도창 opener 와 동일 컨벤션(loadJs → opener). 본문=Popups/versionMng.
     ************************************************************************/
    oAPP.fn.fnVersionManagementPopupOpener = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        if (oAPP.fn.fnVersionManagementPopupOpen) {
            oAPP.fn.fnVersionManagementPopupOpen();
            return;
        }

        oAPP.loadJs("fnVersionManagementPopupOpen", function () {
            oAPP.fn.fnVersionManagementPopupOpen();
        });

    }; // end of oAPP.fn.fnVersionManagementPopupOpener

    /************************************************************************
     * WS10의 Application Copy 팝업 실행시켜 주는 메소드
     * **********************************************************************
     * @param {String} sAppId  
     * - 복사할 APPID
     * **********************************************************************/
    oAPP.fn.fnAppCopyPopupOpener = function (sAppId) {

        // Application Copy Popup Open
        if (oAPP.fn.fnAppCopyPopupOpen) {
            oAPP.fn.fnAppCopyPopupOpen(sAppId);
            return;
        }

        oAPP.loadJs("fnAppCopyPopupOpen", function () {
            oAPP.fn.fnAppCopyPopupOpen(sAppId);
        });

    }; // end of oAPP.fn.fnAppCopyPopupOpener

    /************************************************************************
     * Package 정보 Search Help Popup 호출
     * **********************************************************************
     * @param {function} fnCallback  
     * - Package 정보 Search Help Popup 호출후 선택한 Package 값 리턴 콜백 메소드
     * **********************************************************************/
    oAPP.fn.fnPackgSchpPopupOpener = function (fnCallback) {

        // Busy Indicator가 실행중이면 하위 로직 수행 하지 않는다.
        if (parent.getBusy() == 'X') {
            return;
        }

        if (oAPP.fn.callF4HelpPopup) {
            //f4 help 팝업 function load 이후 팝업 호출.
            oAPP.fn.callF4HelpPopup("DEVCLASS", "DEVCLASS", [], [], fnCallback);
            return;
        }

        $.getScript("design/js/callF4HelpPopup.js", function () {
            //f4 help 팝업 function load 이후 팝업 호출.
            oAPP.fn.callF4HelpPopup("DEVCLASS", "DEVCLASS", [], [], fnCallback);
        });

    }; // end of oAPP.fn.fnPackgSchpPopupOpener

    /************************************************************************
     * UI Template Wizard Popup
     * **********************************************************************
     * @param {Object} oTempData  
     * - Ui Template 관련 정보
     * **********************************************************************/
    oAPP.fn.fnUiTempWizardPopupOpener = function (oTempData) {

        if (oAPP.fn.fnUiTempWizardPopupOpen) {
            oAPP.fn.fnUiTempWizardPopupOpen(oTempData);
            return;
        }

        oAPP.loadJs("fnUiTempWizardPopupOpen", function () {
            oAPP.fn.fnUiTempWizardPopupOpen(oTempData);
        });

    }; // end of oAPP.fn.fnUiTempWizardPopupOpener

    /************************************************************************
     * CTS popup 실행 시켜주는 메소드
     * **********************************************************************
     * @param {function} lf_success  
     * - CTS popup 실행 후 선택한 CTS 값 리턴 콜백 메소드
     * **********************************************************************/
    oAPP.fn.fnCtsPopupOpener = function (lf_success) {

        if (oAPP.fn.fnCtsPopupOpen) {
            oAPP.fn.fnCtsPopupOpen(lf_success);
            return;
        }

        oAPP.loadJs("fnCtsPopupOpen", function () {
            oAPP.fn.fnCtsPopupOpen(lf_success);
        });

    }; // end of oAPP.fn.fnCtsPopupOpener

    /************************************************************************
     * Bind Popup Opener
     * **********************************************************************
     * @param {String} sTitle  
     * - 바인딩 팝업의 헤더 타이틀
     * 
     * @param {String} sKind  
     * - "T": Table
     * - "S": Structure
     * 
     * @param {function} fnCallback
     * - Callback function
     * **********************************************************************/
    oAPP.fn.fnBindPopupOpener = function (sTitle, sKind, fnCallback) {

        //대상 function이 존재하는경우 호출 처리.
        if (typeof oAPP.fn.callBindPopup !== "undefined") {
            oAPP.fn.callBindPopup(sTitle, sKind, fnCallback);
            return;
        }

        //대상 function이 존재하지 않는경우 script 호출.
        oAPP.fn.getScript("design/js/callBindPopup", function () {
            oAPP.fn.callBindPopup(sTitle, sKind, fnCallback);
        });

    }; // end of oAPP.fn.fnBindPopupOpener

    oAPP.fn.fnBindPopupIpcCallBack = () => {

        // busy 끄고 Lock 끄기
        oAPP.common.fnSetBusyLock("");


    }; // end of oAPP.fn.fnBindPopupIpcCallBack

    // /************************************************************************
    //  * [WS20] Binding Popup 버튼 이벤트
    //  ************************************************************************/
    // oAPP.fn.fnBindWindowPopupOpener = () => {

    //     // busy 키고 Lock 켜기
    //     oAPP.common.fnSetBusyLock("X");

    //     var sPopupName = "BINDPOPUP";

    //     // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
    //     var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
    //     if (oResult.ISOPEN) {
    //         // busy OFF Lock OFF
    //         oAPP.common.fnSetBusyLock("");
    //         return;
    //     }

    //     // Binding Popup 에서 콜백 받을 준비를 한다.
    //     IPCRENDERER.on("if-bindPopup-callback", oAPP.fn.fnBindPopupIpcCallBack);

    //     let oThemeInfo = parent.getThemeInfo(); // theme 정보

    //     var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
    //         oDefaultOption = parent.require(sSettingsJsonPath),
    //         oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

    //     oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A15"); // Binding Popup
    //     // oBrowserOptions.width = 1000;
    //     oBrowserOptions.width = 1280;
    //     oBrowserOptions.minWidth = 900;
    //     oBrowserOptions.minHeight = 650;
    //     oBrowserOptions.autoHideMenuBar = true;
    //     oBrowserOptions.parent = CURRWIN;
    //     oBrowserOptions.opacity = 0;
    //     oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
    //     oBrowserOptions.webPreferences.partition = SESSKEY;
    //     oBrowserOptions.webPreferences.browserkey = BROWSKEY;
    //     oBrowserOptions.webPreferences.OBJTY = sPopupName;
    //     oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

    //     // 브라우저 오픈
    //     var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
    //     REMOTEMAIN.enable(oBrowserWindow.webContents);

    //     // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
    //     let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
    //     oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

    //     // 브라우저 상단 메뉴 없애기
    //     oBrowserWindow.setMenu(null);

    //     // 실행할 URL 적용
    //     var sUrlPath = parent.getPath(sPopupName);
    //     oBrowserWindow.loadURL(sUrlPath);


    //     //broadcase 통신 API 모듈 js path 정보.
    //     //(design/bindPopupHandler/broadcastChannelBindPopup.js)
    //     var _channelPath = "";


    //     // // no build 일 경우에는 개발자 툴을 실행한다.
    //     // if (!APP.isPackaged) {
    //     //     oBrowserWindow.webContents.openDevTools();
    //     // }

    //     // 브라우저가 활성화 될 준비가 될때 타는 이벤트
    //     oBrowserWindow.once('ready-to-show', () => {

    //         // 부모 위치 가운데 배치한다.
    //         oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

    //     });

    //     // 브라우저가 오픈이 다 되면 타는 이벤트
    //     oBrowserWindow.webContents.on('did-finish-load', function () {


    //         // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
    //         WSUTIL.setBrowserOpacity(oBrowserWindow);

    //         // 부모 위치 가운데 배치한다.
    //         oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);



    //         var lt_0014 = [];
    //         var lt_0015 = [];
    //         var lt_9011 = [];
    //         var lt_0022 = [];
    //         var lt_0023 = [];
    //         var lt_CEVT = [];

    //         lt_9011 = oAPP.DATA.LIB.T_9011;
    //         lt_0022 = oAPP.DATA.LIB.T_0022;
    //         lt_0023 = oAPP.DATA.LIB.T_0023;


    //         //디자인상세화면(20화면) <-> BINDPOPUP 통신 모듈 PATH 구성.
    //         _channelPath = oAPP.fn.getBindingPopupBroadcastModulePath();


    //         //디자인상세화면(20화면) <-> BINDPOPUP 통신 채널 키 얻기.
    //         var _channelKey = parent.require(_channelPath)("GET-CHANNEL-ID");

    //         var oBindPopupData = {
    //             oUserInfo: parent.getUserInfo(), // 로그인 사용자 정보 (필수)
    //             oThemeInfo: oThemeInfo, // 테마 개인화 정보
    //             T_9011: lt_9011,
    //             T_0022: lt_0022,
    //             T_0023: lt_0023,
    //             T_0014: lt_0014,
    //             T_0015: lt_0015,
    //             T_CEVT: lt_CEVT,
    //             oAppInfo: parent.getAppInfo(),
    //             servNm: parent.getServerPath(),
    //             SSID: parent.getSSID(),
    //             channelKey : _channelKey
    //         };

    //         oBrowserWindow.webContents.send('if_modelBindingPopup', oBindPopupData);


    //         //디자인상세화면(20화면) <-> BINDPOPUP 통신을 위한 채널 생성.
    //         parent.require(_channelPath)("CHANNEL-CREATE");


    //         // no build 일 경우에는 개발자 툴을 실행한다.
    //         if (!APP.isPackaged) {
    //             oBrowserWindow.webContents.openDevTools();
    //         }



    //     });

    //     // 브라우저를 닫을때 타는 이벤트
    //     oBrowserWindow.on('closed', () => {

    //         // busy & Lock 끄기
    //         oAPP.common.fnSetBusyLock("");

    //         oBrowserWindow = null;

    //         //디자인상세화면(20화면) <-> BINDPOPUP 통신 채널 종료.
    //         parent.require(_channelPath)("CHANNEL-CLOSE");

    //         // Binding Popup 에서 콜백 이벤트 해제
    //         IPCRENDERER.off("if-bindPopup-callback", oAPP.fn.fnBindPopupIpcCallBack);

    //         CURRWIN.focus();

    //     });

    // }; // end of oAPP.fn.fnBindWindowPopupOpener

    /************************************************************************
     * [WS20] Binding Popup 버튼 이벤트
     ************************************************************************/
    oAPP.fn.fnBindWindowPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });


        var sPopupName = "BINDPOPUP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            parent.setBusy("", {});

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        // Binding Popup 에서 콜백 받을 준비를 한다.
        IPCRENDERER.on("if-bindPopup-callback", oAPP.fn.fnBindPopupIpcCallBack);

        let oThemeInfo = parent.getThemeInfo(); // theme 정보

        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A15"); // Binding Popup
        // oBrowserOptions.width = 1000;
        oBrowserOptions.width = 1280;
        oBrowserOptions.height = 700;
        oBrowserOptions.minWidth = 900;
        oBrowserOptions.minHeight = 650;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.opacity = 0;
        oBrowserOptions.closable = false;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        REMOTEMAIN.enable(oBrowserWindow.webContents);

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO
        };

        // 실행할 URL 적용
        const sUrlPath = parent.getPath(sPopupName);

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);


        //broadcase 통신 API 모듈 js path 정보.
        //(design/bindPopupHandler/broadcastChannelBindPopup.js)
        var _channelPath = "";


        // // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // // 부모 위치 가운데 배치한다.
            // oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow);


            var lt_0014 = [];
            var lt_0015 = [];
            var lt_9011 = [];
            var lt_0022 = [];
            var lt_0023 = [];
            var lt_CEVT = [];

            lt_9011 = oAPP.DATA.LIB.T_9011;
            lt_0022 = oAPP.DATA.LIB.T_0022;
            lt_0023 = oAPP.DATA.LIB.T_0023;


            //디자인상세화면(20화면) <-> BINDPOPUP 통신 모듈 PATH 구성.
            _channelPath = oAPP.fn.getBindingPopupBroadcastModulePath();
            //디자인상세화면(20화면) <-> BINDPOPUP 통신 채널 키 얻기.
            var _channelKey = parent.require(_channelPath)("GET-CHANNEL-ID");

            var oBindPopupData = {
                oUserInfo: parent.getUserInfo(), // 로그인 사용자 정보 (필수)
                oThemeInfo: oThemeInfo, // 테마 개인화 정보
                T_9011: lt_9011,
                T_0022: lt_0022,
                T_0023: lt_0023,
                T_0014: lt_0014,
                T_0015: lt_0015,
                T_CEVT: lt_CEVT,
                oAppInfo: parent.getAppInfo(),
                servNm: parent.getServerPath(),
                SSID: parent.getSSID(),
                channelKey: _channelKey
            };

            oBrowserWindow.webContents.send('if_modelBindingPopup', oBindPopupData);


            //디자인상세화면(20화면) <-> BINDPOPUP 통신을 위한 채널 생성.
            parent.require(_channelPath)("CHANNEL-CREATE");


            // no build 일 경우에는 개발자 툴을 실행한다.
            // if (!APP.isPackaged) {
            //     oBrowserWindow.webContents.openDevTools();
            // }



        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            parent.setBusy("", {});

            oBrowserWindow = null;

            //디자인상세화면(20화면) <-> BINDPOPUP 통신 채널 종료.
            parent.require(_channelPath)("CHANNEL-CLOSE");

            // Binding Popup 에서 콜백 이벤트 해제
            IPCRENDERER.off("if-bindPopup-callback", oAPP.fn.fnBindPopupIpcCallBack);

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnBindWindowPopupOpener



    /************************************************************************
     * 부모 윈도우 위치의 가운데 배치한다.
     ************************************************************************/
    oAPP.fn.setParentCenterBounds = (oChildWinow, oBrowserOptions) => {


        parent.WSUTIL.setParentCenterBounds(REMOTE, oChildWinow);

        return;


        var oMainWindow = REMOTE.getCurrentWindow();

        // 부모 창의 위치와 크기 가져오기
        const [parentX, parentY] = oMainWindow.getPosition();
        const [parentWidth, parentHeight] = oMainWindow.getSize();

        // 부모 창의 중앙 위치
        const parentCenterX = parentX + parentWidth / 2;
        const parentCenterY = parentY + parentHeight / 2;

        // const parentCenterX = parentX;
        // const parentCenterY = parentY;

        // 부모 창이 위치한 디스플레이들을 찾기
        const displays = SCREEN.getAllDisplays();
        let displayA, displayB;
        for (const display of displays) {
            const { x, y, width, height } = display.workArea;
            if (parentCenterX >= x && parentCenterX < x + width && parentCenterY >= y && parentCenterY < y + height) {
                if (!displayA) {
                    displayA = display;
                } else {
                    displayB = display;
                    break;
                }
            }
        }

        // 자식 창의 크기 설정
        const childWidth = oBrowserOptions.width;
        const childHeight = oBrowserOptions.height;

        // 자식 창의 위치를 부모 창의 가운데로 설정, 배율을 고려하여 계산
        let childX = Math.round(parentX + (parentWidth - childWidth) / 2);
        let childY = Math.round(parentY + (parentHeight - childHeight) / 2);

        // 자식 창의 위치를 디스플레이 작업 영역 안에 있도록 조정
        if (displayA) {
            const { x: displayAX, y: displayAY, width: displayAWidth, height: displayAHeight } = displayA.workArea;
            if (childX < displayAX) childX = displayAX;
            if (childY < displayAY) childY = displayAY;
            if (childX + childWidth > displayAX + displayAWidth) childX = displayAX + displayAWidth - childWidth;
            if (childY + childHeight > displayAY + displayAHeight) childY = displayAY + displayAHeight - childHeight;
        }

        if (displayB) {
            const { x: displayBX, y: displayBY, width: displayBWidth, height: displayBHeight } = displayB.workArea;
            if (childX < displayBX) childX = displayBX;
            if (childY < displayBY) childY = displayBY;
            if (childX + childWidth > displayBX + displayBWidth) childX = displayBX + displayBWidth - childWidth;
            if (childY + childHeight > displayBY + displayBHeight) childY = displayBY + displayBHeight - childHeight;
        }

        let oBounds = {
            width: childWidth,
            height: childHeight,
            x: childX,
            y: childY,
        }

        oChildWinow.setBounds(oBounds);

    }; // end of oAPP.fn.setParentCenterBounds


    /************************************************************************
     * Text 검색 팝업 (electron 기능)
     ************************************************************************/
    oAPP.fn.fnTextSearchPopupOpener = async function () {


        // TEST ---- Start

        var oSettingsInfo = parent.getSettingsInfo();

        var sIndexPath = parent.PATH.join(oSettingsInfo.path.POPUP_ROOT, "textSearchPopup", "index.js");

        parent.require(sIndexPath)(parent.REMOTE, oAPP);

        return;

        // TEST ---- End


        var sPopupName = "TXTSRCH";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

            return;
        }

        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        // oBrowserOptions.titleBarStyle = "hidden";
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.width = 380;
        oBrowserOptions.minWidth = 380;
        oBrowserOptions.height = 60;
        oBrowserOptions.minHeight = 60;
        oBrowserOptions.frame = false;
        oBrowserOptions.thickFrame = false;
        // oBrowserOptions.show = false;
        // oBrowserOptions.opacity = 0.0;
        oBrowserOptions.transparent = true;
        oBrowserOptions.center = false;
        oBrowserOptions.resizable = false;
        oBrowserOptions.parent = CURRWIN;


        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        REMOTEMAIN.enable(oBrowserWindow.webContents);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        // 실행할 URL 적용
        var sUrlPath = parent.getPath(sPopupName);
        oBrowserWindow.loadURL(sUrlPath);

        oBrowserWindow.hide();

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        oBrowserWindow.once('ready-to-show', () => {
            lf_move();
        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            lf_move();

            setTimeout(() => {
                oBrowserWindow.show();
            }, 10);

            // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

        });

        oBrowserWindow.webContents.on("dom-ready", function () {

            lf_move();

        });

        function lf_move() {

            let oCurrWin = REMOTE.getCurrentWindow();

            // // 팝업 위치를 부모 위치에 배치시킨다.
            var oParentBounds = oCurrWin.getBounds(),
                oBrowserBounds = oBrowserWindow.getBounds();

            let xPos = (oParentBounds.x + oParentBounds.width) - 390,
                yPos = Math.round((oParentBounds.y) + 30)

            if (oParentBounds.y > oBrowserBounds.y) {
                yPos = oParentBounds.y + 10;
            }

            oBrowserWindow.setBounds({
                x: xPos,
                y: yPos
            });

        }

        // 부모 창이 움직일려고 할때 타는 이벤트
        function lf_will_move() {

            lf_move();

            oBrowserWindow.hide();

        }

        // 부모 창이 움직임 완료 되었을 때 타는 이벤트
        function lf_moved() {

            lf_move();

            oBrowserWindow.show();

        }

        function lf_off() {

            CURRWIN.off("maximize", lf_move);
            CURRWIN.off("unmaximize", lf_move);

            CURRWIN.off('will-move', lf_will_move);
            CURRWIN.off("move", lf_move);
            CURRWIN.off('moved', lf_moved);

            // CURRWIN.off("moved", lf_move);
            // CURRWIN.off("will-move", lf_move);

            CURRWIN.off('will-resize', lf_will_move);
            CURRWIN.off('resize', lf_move);
            CURRWIN.off('resized', lf_moved);

            // CURRWIN.off("will-resize", lf_move);
            // CURRWIN.off("resize", lf_move);
            // CURRWIN.off("resized", lf_move);

            CURRWIN.off("restore", lf_move);

            CURRWIN.off("enter-full-screen", lf_move);
            CURRWIN.off("leave-full-screen", lf_move);

            REMOTE.screen.off('display-metrics-changed', lf_screenChange);

        }

        lf_off();


        CURRWIN.on('maximize', lf_move);
        CURRWIN.on('unmaximize', lf_move);

        // CURRWIN.on('moved', lf_move);
        // CURRWIN.on('will-move', lf_move);  

        CURRWIN.on('will-move', lf_will_move);
        CURRWIN.on('move', lf_move);
        CURRWIN.on('moved', lf_moved);

        CURRWIN.on('will-resize', lf_will_move);
        CURRWIN.on('resize', lf_move);
        CURRWIN.on('resized', lf_moved);

        // CURRWIN.on('will-resize', lf_move);
        // CURRWIN.on('resize', lf_move);
        // CURRWIN.on('resized', lf_move);        

        CURRWIN.on('restore', lf_move);
        CURRWIN.on('enter-full-screen', lf_move);
        CURRWIN.on('leave-full-screen', lf_move);


        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            lf_off();

            oBrowserWindow = null;

            CURRWIN.focus();

        });

        function lf_screenChange() {
            lf_move();
        }

        REMOTE.screen.on('display-metrics-changed', lf_screenChange);

    }; // end of oAPP.fn.fnTextSearchPopupOpener

    /************************************************************************
     * Design Tree의 UI 검색 팝업
     ************************************************************************/
    // oAPP.fn.fnDesignTreeFindUiPopupOpen = (fnSearch, fnCancel) => {

    //     // Busy Indicator가 실행중이면 하위 로직 수행 하지 않는다.
    //     if (parent.getBusy() == 'X') {
    //         return;
    //     }

    //     var sPopupName = "DESIGNTREEUISRCH";

    //     // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
    //     var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
    //     if (oResult.ISOPEN) {
    //         return;
    //     }

    //     var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
    //         oDefaultOption = parent.require(sSettingsJsonPath),
    //         oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

    //     // oBrowserOptions.titleBarStyle = "hidden";
    //     oBrowserOptions.autoHideMenuBar = true;
    //     oBrowserOptions.width = 380;
    //     oBrowserOptions.minWidth = 380;
    //     oBrowserOptions.height = 60;
    //     oBrowserOptions.minHeight = 60;

    //     oBrowserOptions.frame = false;
    //     oBrowserOptions.transparent = true;
    //     oBrowserOptions.center = false;
    //     oBrowserOptions.resizable = false;
    //     oBrowserOptions.parent = CURRWIN;
    //     oBrowserOptions.webPreferences.partition = SESSKEY;
    //     oBrowserOptions.webPreferences.browserkey = BROWSKEY;
    //     oBrowserOptions.webPreferences.OBJTY = sPopupName;
    //     oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

    //     // 브라우저 오픈
    //     var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
    //     REMOTEMAIN.enable(oBrowserWindow.webContents);

    //     // 브라우저 상단 메뉴 없애기
    //     oBrowserWindow.setMenu(null);

    //     var sUrlPath = parent.getPath(sPopupName);
    //     oBrowserWindow.loadURL(sUrlPath);

    //     // oBrowserWindow.webContents.openDevTools();

    //     function lf_move() {

    //         // 팝업 위치를 부모 위치에 배치시킨다.          
    //         var oParentBounds = CURRWIN.getBounds();
    //         oBrowserWindow.setBounds({
    //             x: Math.round(oParentBounds.x + 170),
    //             y: Math.round(oParentBounds.y + 190),

    //             // x: Math.round((oParentBounds.x + oParentBounds.width / 2) - (oBrowserOptions.width / 2)),
    //             // y: Math.round(((oParentBounds.height / 2) + oParentBounds.y) - (oBrowserOptions.height / 2))
    //         });

    //     }

    //     // 브라우저가 오픈이 다 되면 타는 이벤트
    //     oBrowserWindow.webContents.on('did-finish-load', function () {
    //         lf_move();
    //     });

    //     oBrowserWindow.webContents.on("dom-ready", function () {
    //         lf_move();
    //     });

    //     // 브라우저를 닫을때 타는 이벤트
    //     oBrowserWindow.on('closed', () => {

    //         if (typeof fnCancel == "function") {
    //             fnCancel();
    //         }

    //         oBrowserWindow = null;

    //         // 각종 이벤트 끄기
    //         lf_off();

    //         CURRWIN.focus();

    //     });

    //     // 각종 이벤트 끄기
    //     function lf_off() {

    //         CURRWIN.off("move", lf_move);
    //         CURRWIN.off("resize", lf_move);
    //         CURRWIN.off("maximize", lf_move);
    //         CURRWIN.off("unmaximize", lf_move);

    //         CURRWIN.off("moved", lf_move);
    //         CURRWIN.off("will-move", lf_move);
    //         CURRWIN.off("restore", lf_move);
    //         CURRWIN.off("resized", lf_move);
    //         CURRWIN.off("will-resize", lf_move);
    //         CURRWIN.off("enter-full-screen", lf_move);
    //         CURRWIN.off("leave-full-screen", lf_move);

    //         REMOTE.screen.off('display-metrics-changed', lf_screenChange);

    //     }

    //     lf_off();

    //     /**
    //      * 브라우저 사이즈 변경, 이동 이벤트 걸기
    //      * 팝업이 부모 창 특정 위치에 따라다니는 효과
    //      */
    //     CURRWIN.on('move', lf_move);
    //     CURRWIN.on('resize', lf_move);
    //     CURRWIN.on('maximize', lf_move);
    //     CURRWIN.on('unmaximize', lf_move);

    //     CURRWIN.on('moved', lf_move);
    //     CURRWIN.on('will-move', lf_move);
    //     CURRWIN.on('restore', lf_move);
    //     CURRWIN.on('resized', lf_move);
    //     CURRWIN.on('will-resize', lf_move);
    //     CURRWIN.on('enter-full-screen', lf_move);
    //     CURRWIN.on('leave-full-screen', lf_move);

    //     function lf_screenChange() {
    //         lf_move();
    //     }

    //     // Display 해상도가 변경 되었을때 발생하는 이벤트
    //     REMOTE.screen.on('display-metrics-changed', lf_screenChange);

    //     // IPCMAIN 이벤트 (팝업과 Interface 용)
    //     IPCMAIN.on(`${BROWSKEY}--designTextSearch`, lf_DesignTextSearch);

    //     function lf_DesignTextSearch(event, res) {

    //         if (typeof fnSearch == "function") {
    //             fnSearch(res);
    //         }

    //     }

    // }; // end of oAPP.fn.fnDesignTreeFindUiPopupOpen

    /************************************************************************
     * Current App Technical Document Popup Open
     ************************************************************************/
    oAPP.fn.fnDocuPopupOpener = function () {
  
        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        const sPopupName = "APPDOCU";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);

        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        const oThemeInfo = parent.getThemeInfo(); // theme 정보  

        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B65"); // Document
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;

        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';

        // [HTML5] 네이티브 창 opacity 페이드 미사용(OS 리컴포짓이라 무겁고 흰 번쩍) — 위치 잡힌 뒤 표시
        //   (show=false), 등장 효과는 창 안 #docContent CSS opacity transition(frame.js) 으로 처리.
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

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창의 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: oBrowserOptions.title,
        };

        // 실행할 URL 적용
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
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oDocuData = {
                USERINFO: parent.getUserInfo(),
                oThemeInfo: oThemeInfo, // 테마 개인화 정보
                APPINFO: parent.getAppInfo(),
                SERVPATH: parent.getServerPath()
            };

            oBrowserWindow.webContents.send('if-appdocu-info', oDocuData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnDocuPopupOpener

    /************************************************************************
     * WS Options Popup Opener
     ************************************************************************/
    oAPP.fn.fnWsOptionsPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        const sPopupName = "WSOPTS";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        const 
            oServerInfo = parent.getServerInfo(), // 서버 정보
            sSysID = oServerInfo.SYSID, // System ID
            oThemeInfo = parent.getThemeInfo(); // 테마 개인화 정보

        // Browswer Options
        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B52"); // Options
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;

        // 네이티브 OS 프레임 제거 — 앱 전 창(메인/ServerList/floatingMenu/help)과 동일하게
        // frameless + 공통 .u4a-titlebar(optionMain.js) 로 창 크롬을 그린다. (16번 §1 공통화)
        oBrowserOptions.frame = false;

        oBrowserOptions.opacity = 0.0;
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

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // 흰색 플래시 방지(ServerList 동일): 창이 첫 페인트 전에 테마 배경(--boot-bg)을
            // 동기로 깔고 활성 테마 CSS 로드를 미리 시작하도록 BGCOL/THEME 를 함께 넘긴다.
            BGCOL: oThemeInfo.BGCOL || "",
            THEME: oThemeInfo.THEME || "",
        };

        // 실행할 URL 적용
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
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oOptionData = {
                BROWSKEY: BROWSKEY, // 브라우저 고유키
                oUserInfo: parent.getUserInfo(), // 로그인 사용자 정보
                oServerInfo: parent.getServerInfo(), // 서버 정보
                SYSID: sSysID, // System ID
                THEME_INFO: oThemeInfo, // 테마 정보
                ISCDN: parent.getIsCDN() // CDN 여부
            };

            oBrowserWindow.webContents.send('if-ws-options-info', oOptionData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);


        });


        let lf_IpcMainCdnSave = oAPP.fn.fnIpcMain_cdn_save;

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            IPCMAIN.off(`${BROWSKEY}-cdn-save`, lf_IpcMainCdnSave);

            oBrowserWindow = null;

            try {
                CURRWIN.focus();
            } catch (error) {

            }

        });

        // IPCMAIN 이벤트        
        IPCMAIN.on(`${BROWSKEY}-cdn-save`, lf_IpcMainCdnSave);

    }; // end of oAPP.fn.fnWsOptionsPopupOpener

    /************************************************************************
     * USP PATTERN POPUP
     ************************************************************************/
    oAPP.fn.fnSourcePatternPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        const sPopupName = "PATTPOPUP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        const oThemeInfo = parent.getThemeInfo(); // theme 정보      

        // Browswer Options
        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = oAPP.msg.M059; // Source Pattern
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL; //테마별 색상 처리

        oBrowserOptions.opacity = 0.0;
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

        // 브라우저 실행 경로에 붙일 QueryString 정보
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

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oOptionData = {
                // BROWSKEY: BROWSKEY, // 브라우저 고유키 
                // oUserInfo: oUserInfo, // 로그인 사용자 정보
                // oServerInfo: oServerInfo, // 서버 정보                
                oThemeInfo: oThemeInfo, // 테마 정보                
            };

            oBrowserWindow.webContents.send('if-usp-pattern-info', oOptionData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            // console.log("cccccc");


            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnSourcePatternPopupOpener

    oAPP.fn.fnIconUrlCallback = function (events, res) {

        this(res);

        // UI attribute에서 아이콘 미리보기를 실행 했을 때 다른 child window들을 숨긴것을
        // 다시 활성화 한다.
        oAPP.fn.fnChildWindowShow(true);

    }; // end of oAPP.fn.fnIconUrlCallback

    /************************************************************************
     * Icon Preview Popup Opener
     ************************************************************************
     * - 🤚 ※ 아래 로직 중 콜백 펑션이 있을 경우는 UI의 icon 관련 Property의 
     *   SearchHelp에서 실행된 경우이다.
     * 
     ************************************************************************/
    oAPP.fn.fnIconPreviewPopupOpener = (fnCallback) => {

        // 콜백 유무 플래그
        let isCallback = ((typeof fnCallback === "function") ? "X" : "");

        // 이전에 콜백 바인딩된 펑션이 있을 경우 이벤트 해제
        if (oAPP.attr.fnBindCallback) {
            IPCRENDERER.off("if-icon-url-callback", oAPP.attr.fnBindCallback);
            delete oAPP.attr.fnBindCallback;
        }

        // 파라미터에 콜백 펑션이 있을 경우에만 IPCRENDER 이벤트를 건다.
        if (isCallback === "X") {

            // UI attribute에서 아이콘 미리보기를 실행 했을 때 다른 child window들을 숨긴다.
            // 아이콘 선택 작업을 먼저 끝내고 다른 행위를 하라는 의미.
            oAPP.fn.fnChildWindowShow(false);

            oAPP.attr.fnBindCallback = oAPP.fn.fnIconUrlCallback.bind(fnCallback);

            IPCRENDERER.on("if-icon-url-callback", oAPP.attr.fnBindCallback);

        }


        let oMetadata = parent.getMetadata();

        // 사용자 로그인 정보
        let oUserInfo = parent.getUserInfo(),
            oMeta = oUserInfo.META;

        // 접속 SYSID
        let sSysID = oUserInfo.SYSID;

        // 팝업 고유명
        let sPopupName = "ICONPREV";

        // 콜백이 없을 경우의 아이콘 팝업 이름을 SYSID와 조합
        if (isCallback !== "X") {

            // 팝업 고유 이름 지정 시, SYSID도 같이 붙인다. (아이콘 뷰어는 SYSID당 1개의 팝업이라고 생각하면됨.)
            sPopupName += "_" + sSysID;

            // [!! 전체 떠있는 브라우저 기준 !!] 
            // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
            let oResult = APPCOMMON.getCheckAlreadyOpenWindow2(sPopupName);
            if (oResult.ISOPEN) {

                // 부모 위치 가운데 배치한다.            
                WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

                let oIconWindow = oResult.WINDOW;

                oIconWindow.show();

                // 부모 위치 가운데 배치한다.
                WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

                return;

            }

        }

        // 로그인 정보에서 서버의 기본 테마 정보를 구한다.        
        // let aTheme = oMeta.T_REG_THEME,
        //     oDefThemeInfo = aTheme.find(elem => elem.ISDEF === "X");

        // let sDefTheme = "sap_horizon";
        // if (oDefThemeInfo) {
        //     sDefTheme = oDefThemeInfo.THEME;
        // }

        // let oSettings = WSUTIL.getWsSettingsInfo(),
        //     sGlobalLangu = oSettings.globalLanguage,
        //     sWsThemeColor = WSUTIL.getThemeBackgroundColor(sDefTheme);

        // let oUserInfo = parent.getUserInfo();
        const sLangu = oUserInfo.LANGU;
        const oThemeInfo = parent.getThemeInfo(); // theme 정보  

        // Browswer Options
        const 
            sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);


        // 콜백이 있을 경우에만 부모의 윈도우를 지정해주는 옵션을 추가한다.
        // 콜백이 없으면 부모의 종속성 없이 별도 단독창으로 동작해야 하기 때문.
        if (isCallback === "X") {
            oBrowserOptions.parent = CURRWIN;
        }

        oBrowserOptions.title = WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "047"); // Icon List
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.resizable = true;
        oBrowserOptions.movable = true;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL; //테마별 색상 처리
        oBrowserOptions.webPreferences.nodeIntegrationInWorker = true;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;

        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // // 브라우저 상단 메뉴 없애기.    
        oBrowserWindow.setMenu(null);

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
        };
        
        const sUrlPath = parent.getPath("ICONPREV");

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        if (!APP.isPackaged) {
            oBrowserWindow.webContents.openDevTools();
        }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            // oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oOptionData = {
                // BROWSKEY: BROWSKEY, // 브라우저 고유키
                // oUserInfo: oUserInfo, // 로그인 사용자 정보
                sServerHost: parent.getHost(), //  서버 호스트 정보
                sServerPath: parent.getServerPath(), // 서버 Url
                // sDefTheme: sDefTheme, // 테마 정보
                oThemeInfo: oThemeInfo, // 테마 정보
                isCallback: isCallback, // 아이콘 팝업 호출 시 콜백 펑션이 있는지 여부 플래그 
                oMetadata: oMetadata
            };

            oBrowserWindow.webContents.send('if-icon-prev', oOptionData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnIconPreviewPopupOpener

    /************************************************************************
     * 성원이가 만든 일러스트 메시지 팝업
     ************************************************************************/
    oAPP.fn.fnIllustedMsgPrevPopupOpener = () => {

        // 로그인 정보에서 서버의 기본 테마 정보를 구한다.
        let oUserInfo = parent.getUserInfo(),
            oMeta = oUserInfo.META;

        // 접속 SYSID
        let sSysID = oUserInfo.SYSID;

        let sPopupName = "ILLUST_MSG_PREV";
        sPopupName += "_" + sSysID;

        // [!! 전체 떠있는 브라우저 기준 !!] 
        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        let oResult = APPCOMMON.getCheckAlreadyOpenWindow2(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            let oIconWindow = oResult.WINDOW;
            oIconWindow.show();
            return;
        }

        // // 로그인 정보에서 서버의 기본 테마 정보를 구한다.        
        let sServerLibPath = oMeta.LIBPATH;
        //     aTheme = oMeta.T_REG_THEME,
        //     oDefThemeInfo = aTheme.find(elem => elem.ISDEF === "X");

        // let sDefTheme = "sap_horizon";
        // if (oDefThemeInfo) {
        //     sDefTheme = oDefThemeInfo.THEME;
        // }

        // let oSettings = WSUTIL.getWsSettingsInfo(),
        //     sGlobalLangu = oSettings.globalLanguage,
        //     sWsThemeColor = WSUTIL.getThemeBackgroundColor(sDefTheme);

        let sLangu = oUserInfo.LANGU;
        let oThemeInfo = parent.getThemeInfo(); // theme 정보

        // Browswer Options
        let sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "067"); // Image Icons
        // oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.titleBarStyle = 'hidden';
        // oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.resizable = true;
        oBrowserOptions.movable = true;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.webPreferences.nodeIntegrationInWorker = true;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        /**
         * @since   2026-03-08 22:09:11
         * @version v3.6.0-3
         * @author  soccerhs
         * @description
         *  - 다크 테마에서 배경이 흰색으로 뜨는 현상 수정
         *    body에 잘못 매핑된 배경색 변수를 테마 시스템에 맞는 변수로 수정함.
         * 
         */
        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        // let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.THEME}; }`;
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        oBrowserWindow.setMenu(null);

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
        };

        let sUrlPath = parent.getPath("ILLUST_MSG_PREV");

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
            oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            let oOptionData = {
                // BROWSKEY: BROWSKEY, // 브라우저 고유키
                // oUserInfo: oUserInfo, // 로그인 사용자 정보
                sServerHost: parent.getHost(), //  서버 호스트 정보
                sServerPath: parent.getServerPath(), // 서버 Url                
                // sDefTheme: sDefTheme, // 테마 정보 
                sServerLibPath: sServerLibPath // 서버 라이브러리 경로
            };

            oBrowserWindow.webContents.send('if-illust-prev', oOptionData);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow);

            // 부모 위치 가운데 배치한다.
            oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnIllustedMsgPrevPopupOpener

    /************************************************************************
     * U4A Help Document Popup Opener
     ************************************************************************/
    oAPP.fn.fnU4AHelpDocuPopupOpener = async (oOptions) => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        let sP13n_root = parent.getPath("P13N_ROOT"),
            sUrlPath = parent.getPath("U4AHELP"),
            oHelpDoc = parent.require(sUrlPath);

        var oRetdata = await oHelpDoc.Excute(REMOTE, sP13n_root, oOptions);
        if (oRetdata.RETCD === "E") {

            // 메시지 처리 
            parent.showMessage(sap, 20, "E", oRetdata.RTMSG);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return oRetdata;

        }

        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");

        return oRetdata;

    }; // end of oAPP.fn.fnU4ADocuPopupOpener


    function _checkAppExistsPromise(APPID) {

        return new Promise(function (resolve) {

            oAPP.fn.fnCheckAppExists(APPID, function (RESULT) {

                resolve(RESULT);

            });

        });

    } // end of _checkAppExistsPromise

    /************************************************************************
     * WS APP Import/Export Popup Opener
     * **********************************************************************
     * @param {String} sFlag  
     * - IMPORT : Application Import
     * - EXPORT : Application Export
     * **********************************************************************/
    oAPP.fn.fnWsImportExportPopupOpener = async (sFlag) => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        let sPopupName = "IMPEXPPOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        let oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        if (sFlag == "EXPORT") {

            // [HTML5] AppNmInput 은 WS10 의 DOM <input> — sap.ui.getCore().byId 는 스텁에서 null
            //   을 반환해(크래시 없이) 여기서 조용히 return → "내보내기 무반응" 의 원인이었다.
            //   DOM 헬퍼로 읽고 getValue()→.value 호환.
            var oAppNmInput = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
                ? oAPP.fn.fnGetWs10AppInputDom()
                : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null);
            if (!oAppNmInput) {
                oAPP.common.fnSetBusyLock("");
                oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });
                return;
            }

            var sValue = (typeof oAppNmInput.getValue === "function" ? oAppNmInput.getValue() : (oAppNmInput.value || "")),
                sCurrPage = parent.getCurrPage();

            let oUserInfo = parent.process.USERINFO;
            let sLangu = oUserInfo.LANGU;

            // 입력값 유무 확인
            if (typeof sValue !== "string" || sValue == "") {

                // Application name is required.            
                let sErrMsg = WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273");

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // 입력값 공백 여부 체크
            var reg = /\s/;
            if (reg.test(sValue)) {

                // The application name must not contain any spaces.
                let sErrMsg = WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "274");

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // 특수문자 존재 여부 체크
            var reg = /[^\w]/;
            if (reg.test(sValue)) {

                //Special characters are not allowed.
                let sErrMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278");

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // 앱 존재 유무 확인
            let oResult = await _checkAppExistsPromise(sValue);

            var oAppInfo = oResult.RETURN,
                oCurrWin = parent.REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (oResult.RETCD == 'E') {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;

            }

            // // application명 정합성 체크
            // let bCheckAppNm = oAPP.fn.fnCheckAppName();
            // if (!bCheckAppNm) {

            //     // busy 끄고 Lock 풀기
            //     oAPP.common.fnSetBusyLock("");

            //     // 전체 자식 윈도우에 Busy 끈다.
            //     oAPP.attr.oMainBroad.postMessage({PRCCD:"BUSY_OFF"});

            //     return;
            // }

        }

        let sAppId = APPCOMMON.fnGetModelProperty("/WS10/APPID"),
            sServerPath = parent.getServerPath(),
            oBrowserOptions = {
                "height": 400,
                "width": 400,
                "transparent": true,
                "frame": false,
                "resizable": false,
                "maximizable": false,
                "minimizable": false,
                "icon": "www/img/logo.png",
                "webPreferences": {
                    "devTools": true,
                    "nodeIntegration": true,
                    "enableRemoteModule": true,
                    "contextIsolation": false,
                    "nativeWindowOpen": true,
                    "webSecurity": false
                }

            };

        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.title = sFlag;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.modal = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        var oSendData = {
            USERINFO: parent.getUserInfo(),
            BROWSKEY: BROWSKEY,
            SERVPATH: sServerPath,
            PRCCD: sFlag,
            APPID: ""
        };

        if (sFlag === "EXPORT") {
            // [HTML5] /WS10/APPID 모델이 비어있을 수 있어, 검증 통과한 입력값(sValue)을 우선 사용.
            oSendData.APPID = sValue || sAppId;
        }

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
        };

        var sUrlPath = parent.getPath(sPopupName);

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
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            oBrowserWindow.webContents.send("export_import-INITDATA", oSendData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            oBrowserWindow.show();

            // [HTML5] 팝업 창이 떠 표시되면 부모 busy/Lock 해제(성공 경로에서 해제 누락 →
            //   Import/Export 둘 다 busy 잔류하던 문제 방지. 창은 modal 이라 부모 상호작용은 계속 차단됨).
            oAPP.common.fnSetBusyLock("");
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            IPCMAIN.off(`${BROWSKEY}--export_import-IMPORT`, oAPP.fn.fnIpcMain_export_import_IMPORT);
            IPCMAIN.off(`${BROWSKEY}--export_import-EXPORT`, oAPP.fn.fnIpcMain_export_import_EXPORT);

            oBrowserWindow = null;

            CURRWIN.focus();

        });

        // IPCMAIN 이벤트
        IPCMAIN.on(`${BROWSKEY}--export_import-IMPORT`, oAPP.fn.fnIpcMain_export_import_IMPORT);
        IPCMAIN.on(`${BROWSKEY}--export_import-EXPORT`, oAPP.fn.fnIpcMain_export_import_EXPORT);

    }; // end of oAPP.fn.fnWsImportExportPopupOpener

    /************************************************************************
     * About U4A Popup Opener
     ************************************************************************/
    oAPP.fn.fnAboutU4APopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        const sPopupName = "ABOUTU4APOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        const oBrowserOptions = {
            "height": 640,
            "width": 500,
            // ★ 둥근 모서리: 프레임리스(titleBarStyle:hidden) 창은 resizable:true 라야 Windows DWM 이
            //   둥근 모서리를 입힌다(다른 공통헤더 창과 동일). About 은 고정크기이므로 min=max 로 잠가
            //   실제 리사이즈는 막으면서 둥근 모서리만 얻는다.
            "resizable": true,
            "minWidth": 500,
            "maxWidth": 500,
            "minHeight": 640,
            "maxHeight": 640,
            "fullscreenable": true,
            "maximizable": false,
            "minimizable": false,
            "icon": "www/img/logo.png",
            "webPreferences": {
                "devTools": true,
                "nodeIntegration": true,
                "enableRemoteModule": true,
                "contextIsolation": false,
                "nativeWindowOpen": true,
                "webSecurity": false
            }

        };

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.autoHideMenuBar = true;
        // [공통 헤더] 네이티브 타이틀바 제거 → index.html 공통 .u4a-titlebar(메인창과 동일)로 대체.
        oBrowserOptions.titleBarStyle = "hidden";
        // 로드 전 배경 깜빡임 방지 + 둥근 모서리 밖 배경을 테마색으로(다른 공통헤더 창과 동일).
        try { oBrowserOptions.backgroundColor = (parent.getThemeInfo && parent.getThemeInfo().BGCOL) || undefined; } catch (e) { }
        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B48"); // About U4A WS IDE
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.modal = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.closable = false;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        // 공통 헤더가 첫 페인트부터 테마/제목 반영하도록 전달(index.html head 조기 적용 스크립트가 소비).
        let oAboutTheme = {};
        try { oAboutTheme = (parent.getThemeInfo && parent.getThemeInfo()) || {}; } catch (e) { oAboutTheme = {}; }

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            TITLE: oBrowserOptions.title || "",
            THEME: oAboutTheme.THEME || "",
            BGCOL: oAboutTheme.BGCOL || "",
        };

        const sUrlPath = parent.getPath(sPopupName);

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oServerInfo = parent.getServerInfo();
            const sServerPath = parent.getServerPath();

            const oSendData = {
                SERVPATH: sServerPath,
                WSVER: oServerInfo.WSVER,
                WSPATCH_LEVEL: oServerInfo.WSPATCH_LEVEL
            };

            oBrowserWindow.webContents.send("if-about-u4a", oSendData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow, () => {

                if (oBrowserWindow.isDestroyed()) {
                    return;
                }

                try {
                    oBrowserWindow.closable = true;
                } catch (error) {

                }

            });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnAboutU4APopupOpener

    function _sendIpcBusy(isBusy) {

        // 메인 영역 Busy 끄기
        parent.IPCRENDERER.send(`if-send-action-${BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: isBusy });

    }

    /************************************************************************
     * Runtime Class Navigator Popup Opener
     ************************************************************************/
    oAPP.fn.fnRuntimeClassNaviPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        let sPopupName = "RTMCLS";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        let oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        let SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oUserInfo = parent.getUserInfo();

        let oThemeInfo = parent.getThemeInfo(); // theme 정보      

        // 브라우저 옵션 설정
        let sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A14"); // Runtime Class Navigator
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;

        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';

        // [HTML5] 네이티브 창 opacity 페이드 미사용(OS 리컴포짓이라 무겁고 흰 번쩍) — 위치 잡힌 뒤 표시
        //   (show=false), 등장 효과는 창 안 .u4aRtmBody CSS opacity transition(frame.js _finishOpen) 으로 처리.
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);
      
        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창의 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: oBrowserOptions.title,
        };

        let sUrlPath = parent.getPath(sPopupName);

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
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            var oRuntimeInfo = {
                oUserInfo: oUserInfo,
                oThemeInfo: oThemeInfo,
                aRuntimeData: oAPP.DATA.LIB.T_0022,
                oMetadata: parent.getMetadata()
            };

            // 오픈할 URL 파라미터 전송
            oBrowserWindow.webContents.send('if-runtime-info', oRuntimeInfo);

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnRuntimeClassNaviPopupOpener

    /************************************************************************
     * Font Style Wizard
     ************************************************************************/
    oAPP.fn.fnFontStyleWizardPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        let sPopupName = "FONTSTYLE";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        var SESSKEY = parent.getSessionKey(),
            oMeta = APPCOMMON.fnGetModelProperty("/METADATA"),
            oServerInfo = parent.getServerInfo(),
            oServerHost = parent.getServerHost(),
            oUserInfo = parent.getUserInfo();

        // 실행시킬 호스트명 + U4A URL 만들기

        var sHost = oServerHost,
            // sUrl = encodeURI(`${sHost}/zu4a_imp/cssfontstylewizrd?sap-user=${oUserInfo.ID}&sap-password=${oUserInfo.PW}`);
            sUrl = encodeURI(`${sHost}/zu4a_imp/cssfontstylewizrd?ws-platform=3.0`);

        // 브라우저 옵션 설정
        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B57"); // Font Style Wizard
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.nodeIntegration = false;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        REMOTEMAIN.enable(oBrowserWindow.webContents);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        oBrowserWindow.loadURL(sUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            oBrowserWindow.show();

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow, () => {

                if (oBrowserWindow.isDestroyed()) {
                    return;
                }

                try {
                    oBrowserWindow.closable = true;
                } catch (error) {

                }

                // 전체 자식 윈도우에 Busy 끈다.
                oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

            });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnFontStyleWizardPopupOpener

    /************************************************************************
     * Icon List Popup Opener
     ************************************************************************/
    oAPP.fn.fnIconListPopupOpener = () => {

        var sWinObjType = "ICONLIST",
            sHost = parent.getServerHost(),
            oUserInfo = parent.getUserInfo(),
            sServerPath = parent.getServerPath(),
            sIconListUrl = sHost + "/zu4a_acs/icon_exp?ws-platform=3.0&sap-user=" + oUserInfo.ID + "&sap-password=" + oUserInfo.PW + "&sap-language=" + oUserInfo.LANGU + "&WS=X#/overview/SAP-icons",
            sUrl = encodeURI(sIconListUrl),
            // sUrl = encodeURI("/zu4a_acs/icon_exp?WS=X#/overview/SAP-icons"),
            sPath = sServerPath + "/external_open?ws-platform=3.0&URL=" + encodeURIComponent(sUrl);

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sWinObjType);
        if (oResult.ISOPEN) {

            oResult.WINDOW.webContents.send('if-extopen-url', sPath);
            return;

        }

        var oCurrWin = REMOTE.getCurrentWindow(),
            SESSKEY = parent.getSessionKey(),
            BROWSERKEY = parent.getBrowserKey();

        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A12"); // Icon List
        oBrowserOptions.url = sPath;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.parent = oCurrWin;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSERKEY;
        oBrowserOptions.webPreferences.OBJTY = sWinObjType;

        oAPP.fn.fnExternalOpen(oBrowserOptions);

    }; // end of oAPP.fn.fnIconListPopupOpener

    /************************************************************************
     * WS20의 하단 멀티 푸터 메시지 처리
     * **********************************************************************/
    oAPP.fn.fnMultiFooterMsg = function (aMsg) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        const sPopupName = "ERRMSGPOP";

        // 기존에 멀티 푸터 메시지 팝업이 열렸을 경우 닫는다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN === true && oResult.WINDOW.isDestroyed() === false) {

            try {
                oResult.WINDOW.close();
            } catch (error) {

            }

        }

        const oThemeInfo = parent.getThemeInfo(); // theme 정보 

        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        let sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B93"); // Error
        sTitle += " " + APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D24"); // Message Popup

        oBrowserOptions.title = sTitle;
        oBrowserOptions.center = true;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.titleBarStyle = "hidden";
        oBrowserOptions.autoHideMenuBar = true;

        // 부모 창보다 작게(비율) 띄워 "부모 위의 다이얼로그"로 또렷이 구분되게 한다.
        //  너비 ≈ 부모 52%, 높이 ≈ 부모 62% (최소/최대 클램프). setParentCenterBounds 가
        //  이 크기 그대로 부모 중앙에 배치 → 부모가 주변에 보여 겹쳐보이지 않음.
        const aParentSize = CURRWIN.getSize();
        const iParentW = aParentSize[0] || 1000,
            iParentH = aParentSize[1] || 700;

        oBrowserOptions.width = Math.min(Math.max(Math.round(iParentW * 0.52), 460), 860);
        oBrowserOptions.height = Math.min(Math.max(Math.round(iParentH * 0.62), 320), 720);
        oBrowserOptions.minWidth = 360;
        oBrowserOptions.minHeight = 240;
        oBrowserOptions.parent = CURRWIN;
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

        // 브라우저 실행 경로에 붙일 QueryString 정보
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

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oSendData = {
                oUserInfo: parent.getUserInfo(), // 로그인 사용자 정보
                oThemeInfo: oThemeInfo, // 테마 개인화 정보
                aMsg: aMsg
            };

            oBrowserWindow.webContents.send('if-errmsg-info', oSendData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            IPCMAIN.off(`${BROWSKEY}--errormsg--click`, oAPP.fn.fnIpcMain_errmsg_click);

            oBrowserWindow = null;

            CURRWIN.focus();

        });

        IPCMAIN.on(`${BROWSKEY}--errormsg--click`, oAPP.fn.fnIpcMain_errmsg_click);

    }; // end of oAPP.fn.fnMultiFooterMsg

    /************************************************************************
     * WS20의 UI Property 도움말
     * **********************************************************************/
    oAPP.fn.fnPropertyHelpPopup = function (sUrl) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var sWinObjType = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D28"), // Property Help
            sPath = parent.getServerPath() + "/external_open?ws-platform=3.0&URL=" + encodeURIComponent(sUrl + "&WS=X");

        // // 테스트 목적임.
        // if (typeof sUrl !== "string") {
        //     var testUrl = "/ZU4A_ACS/U4A_API_DOCUMENT?VER=1.77.2&CLSNM=sap.m.Page&GUBUN=1&PROPID=showFooter&UIOBK=UO00389";
        //     sPath = parent.getServerPath() + "/external_open?URL=" + encodeURIComponent(testUrl + "&WS=X");
        // }

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        var oResult = APPCOMMON.getCheckAlreadyOpenWindow(sWinObjType);
        if (oResult.ISOPEN) {

            oResult.WINDOW.webContents.send('if-extopen-url', sPath);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;

        }

        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D28"); // Property Help
        oBrowserOptions.url = sPath;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sWinObjType;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        oAPP.fn.fnExternalOpen(oBrowserOptions);

    }; // end of oAPP.fn.fnPropertyHelpPopup   

    /************************************************************************
     * Editor Popup Opener
     * **********************************************************************/
    oAPP.fn.fnEditorPopupOpener = (oEditorInfo, sSearchValue) => {

        // // no build 일 경우에만 수행!!
        // if (parent.process.env.COMPUTERNAME.includes("YOON") === true) {

        //     var sIndexPath = parent.PATH.join(PATHINFO.POPUP_ROOT, "editorPopup_v2", "index.js");

        //     let oParams = {
        //         oEditorInfo: oEditorInfo,
        //         sSearchValue: sSearchValue
        //     };

        //     parent.require(sIndexPath)(parent.REMOTE, oAPP, oParams);

        //     return;
        // }

        // Editor Popup Open
        if (oAPP.fn.fnEditorPopupOpen) {
            oAPP.fn.fnEditorPopupOpen(oEditorInfo, sSearchValue);
            return;
        }

        oAPP.loadJs("fnEditorPopupOpen", function () {
            oAPP.fn.fnEditorPopupOpen(oEditorInfo, sSearchValue);
        });

    }; // end of oAPP.fn.fnEditorPopupOpener


    /************************************************************************
     * Release Note Popup Opener V2
     * **********************************************************************/
    oAPP.fn.fnReleaseNotePopupOpenerV2 = async function () {

        const ReleseNote = parent.require(parent.PATH.join(parent.PATHINFO.POPUP_ROOT, 'relese_notes'));

        // 릴리즈 노트 영역에 리턴 해주는 공통 함수.
        function _senderSend(sender, channel, message) {
            sender.send(channel, message);
        }

        //신규 기능 상세 보기 요청
        ReleseNote.on('openNewFeature', async (sender, data) => {

            let sPath = data.path;
            let sVersion = data.version;
            let sReplyChannel = data.replyChannel;

            if (!sPath) {
                let message = { RETCD: 'E', RTMSG: '신규기능 이동에 대한 도움말 문서 번호가 누락되었습니다.' };
                return _senderSend(sender, sReplyChannel, message);
            }

            let oHelpDocOptions = {
                startMenuId: sPath
            };

            // 도움말 문서 열기 실행
            let oHelpDocOpenResult = await oAPP.fn.fnU4AHelpDocuPopupOpener(oHelpDocOptions);
            if (oHelpDocOpenResult.RETCD === "E") {
                return _senderSend(sender, sReplyChannel, { RETCD: 'E', RTMSG: oHelpDocOpenResult.RTMSG });
            }

            return _senderSend(sender, sReplyChannel, {});

        });

        // 로그인 유저 정보
        let oUserInfo = parent.getUserInfo();

        // UI5 테마 정보
        let sUi5Theme = sap.ui.getCore().getConfiguration().getTheme();

        // 릴리즈노트 테마
        let sRelTheme = sUi5Theme.endsWith('dark') ? 'dark' : 'light';
        
        //릴리즈 노트 실행
        await ReleseNote.open(
            {
                theme: sRelTheme, //light, dark
                language: oUserInfo.LANGU,
                sysid: oUserInfo.SYSID,
                sessionkey: parent.getSessionKey(),
                service: {
                    host: parent.getServerHost(),
                    // params:{
                    //     "sap-user": "shhong",
                    //     "sap-password": "2wsxzaq1!",  
                    // },

                }

            }
        );

        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");

    }; // end of oAPP.fn.fnReleaseNotePopupOpenerV2

    /************************************************************************
     * Release Note Popup Opener
     * **********************************************************************/
    oAPP.fn.fnReleaseNotePopupOpener = async () => {
        
        /**
         * @since   2026-04-06 15:41:25
         * @version v3.6.0-4
         * @author  soccerhs
         * @description
         * 
         * 릴리즈 노트 개선
         * 메이저 & 패치 전체 릴리즈 노트 내용 출력
         * 신규 기능 추가 시, Help Document와 연동됨.
         */
        if (oAPP.common.checkWLOList("C", "UHAK901369")) {
            oAPP.fn.fnReleaseNotePopupOpenerV2();
            return;
        }

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        const sPopupName = "RELNOTEPOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        let oThemeInfo = parent.getThemeInfo(); // theme 정보  

        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.height = 700;
        oBrowserOptions.width = 700;
        oBrowserOptions.minWidth = 700;
        oBrowserOptions.minHeight = 600;
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

        // 브라우저 실행 경로에 붙일 QueryString 정보
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

            let oData = {
                USERINFO: parent.getUserInfo(), // User 정보
                oThemeInfo: oThemeInfo, // 테마 개인화 정보                
                ISCDN: parent.getIsCDN(), // CDN 허용 여부,
                SERVPATH: parent.getServerPath() // ws service path
            };

            oBrowserWindow.webContents.send('if-relnote-info', oData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow, () => {

                if (oBrowserWindow.isDestroyed()) {
                    return;
                }

                try {
                    oBrowserWindow.closable = true;
                } catch (error) {

                }

            });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnReleaseNotePopupOpener

    /************************************************************************
     * [WS20] 디자인영역 Layout 변경 기능 팝업
     * **********************************************************************/
    oAPP.fn.callDesignLayoutChangePopupOpener = () => {

        if (oAPP.fn.callDesignLayoutChangePopup) {
            oAPP.fn.callDesignLayoutChangePopup();
            return;
        }

        $.getScript("design/js/callDesignLayoutChangePopup.js", function () {
            oAPP.fn.callDesignLayoutChangePopup();
        });

    }; // end of oAPP.fn.callDesignLayoutChangePopupOpener


    oAPP.fn.fnOtrIpcCallBack = function (events, res) {

        // busy 끄고 Lock 끄기
        oAPP.common.fnSetBusyLock("");

    }; // end of oAPP.fn.fnOtrIpcCallBack

    /************************************************************************
     * OTR Manager Popup Opener
     ************************************************************************/
    oAPP.fn.fnOtrManagerPopupOpener = () => {

        // busy 키고 Lock 켜기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        let sPopupName = "U4AOTRPOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        let oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 끄기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        // otr 팝업에서 콜백 받을 준비를 한다.
        IPCRENDERER.on("if-otr-callback", oAPP.fn.fnOtrIpcCallBack);

        let SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oUserInfo = parent.getUserInfo();

        let oThemeInfo = parent.getThemeInfo(); // theme 정보      

        // 브라우저 옵션 설정
        let sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        let sOtrTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B59"); // OTR Manager

        oBrowserOptions.title = sOtrTitle;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        // [HTML5] frameless — 네이티브 OS 헤더 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = "hidden";

        // [HTML5] 네이티브 창 opacity 페이드 미사용(OS 리컴포짓이라 무겁고, 다크 테마서 흰 플래시) —
        //   backgroundColor=테마 BGCOL 로 즉시 불투명하게 띄우고(show=false 로 위치 잡힌 뒤 표시),
        //   등장 효과는 본문 CSS opacity transition 으로(editorPopup 동일, 16.공통UX 2.6). opacity=0.0 제거.
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        REMOTEMAIN.enable(oBrowserWindow.webContents);

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // // 브라우저 상단 메뉴 없애기        
        // oBrowserWindow.setMenu(null);

        // let sUrlPath = parent.getPath(sPopupName);
        // oBrowserWindow.loadURL(sUrlPath);

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: sOtrTitle
        };

        // 실행할 URL 적용
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
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            let oSendData = {
                oUserInfo: oUserInfo,
                oThemeInfo: oThemeInfo,
                T_9011: oAPP.DATA.LIB.T_9011,
                oAppInfo: parent.getAppInfo(),
                servNm: oAPP.attr.servNm
            };

            // 오픈할 URL 파라미터 전송
            oBrowserWindow.webContents.send('if_OTRF4HelpPopup', oSendData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            IPCRENDERER.off("if-otr-callback", oAPP.fn.fnOtrIpcCallBack);

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnOtrManagerPopupOpener


    /************************************************************************
     * [WS20] UI5 Predefined Css Popup Opener
     * - u4a workspace 3.4.2 - sp2 이상
     ************************************************************************/
    oAPP.fn.fnUI5PreCssPopupOpener = async function () {

        // busy 키고 Lock 켜기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        let sPopupName = "UI5CSSPOP_V2";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        let oResult = APPCOMMON.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            return;
        }

        let sUrlPath = parent.getPath("UI5CSSPOP_V2_CONTROL");

        let oCSS = await import(sUrlPath);

        // app 정보를 구한다.
        var oAppInfo = parent.getAppInfo();
        var IS_EDIT = (oAppInfo && oAppInfo?.IS_EDIT === "X" ? "X" : "");

        // 던질 파라미터
        let IF_DATA = {
            SESSKEY: parent.getSessionKey(),
            BROWSKEY: parent.getBrowserKey(),
            IS_EDIT: IS_EDIT
        };

        oCSS.start(parent.require, IF_DATA, function (oRes) {

            // CSS를 미리보기에 적용
            oAPP.fn.prevStyleClassApply(oRes.DATA, oRes.PRCCD);


        });

    }; // end of oAPP.fn.fnUI5PreCssPopupOpener

    /************************************************************************
     * [WS20] UI5 Predefined Css Popup Opener
     ************************************************************************/
    oAPP.fn.fnUI5PredefinedCssPopupOpener = () => {

        const sPopupName = "UI5CSSPOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {
            return;
        }

        const 
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oUserInfo = parent.getUserInfo(),
            oThemeInfo = parent.getThemeInfo(); // theme 정보      

        // 브라우저 옵션 설정
        const 
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B58"); // UI5 Predefined CSS
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.width = 1200;

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
       
        // 브라우저 실행 경로에 붙일 QueryString 정보
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

        // sap icon 종류
        const oIconUrl = {
            ICON_LED_RED: oAPP.fn.fnGetSapIconPath("ICON_LED_RED"),
            ICON_LED_GREEN: oAPP.fn.fnGetSapIconPath("ICON_LED_GREEN")
        };

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oSendData = {
                BROWSKEY: BROWSKEY,
                oUserInfo: oUserInfo,
                oThemeInfo: oThemeInfo,
                oIconUrl: oIconUrl,
                sServerPath: parent.getServerPath(),
                sServerBootStrapUrl: oAPP.fn.getBootStrapUrl()
            };

            // 오픈할 URL 파라미터 전송
            oBrowserWindow.webContents.send('if-ui5css-info', oSendData);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            WSUTIL.setBrowserOpacity(oBrowserWindow);

            // 부모 위치 가운데 배치한다.
            oAPP.fn.setParentCenterBounds(oBrowserWindow, oBrowserOptions);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            IPCMAIN.off(`${BROWSKEY}--if-ui5css`, lf_ui5css_getData);

            CURRWIN.focus();

        });

        IPCMAIN.on(`${BROWSKEY}--if-ui5css`, lf_ui5css_getData);

        function lf_ui5css_getData(event, res) {

            const 
                sType = res.TYPE,
                bIsSave = (sType == "S" ? true : false),
                aCSSList = res.DATA;

            oAPP.fn.prevStyleClassApply(aCSSList, bIsSave);

        }

    }; // end of oAPP.fn.fnUI5PredefinedCssPopupOpener

    /************************************************************************
     * [WS20] Application ShortCut Download
     ************************************************************************/
    oAPP.fn.fnAppShortCutDownPopupOpener = () => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });

        // 실행할 브라우저가 없다면 오류 후 빠져나감.    
        let aDefBr = APPCOMMON.fnGetModelProperty("/DEFBR"),
            sMsg = "";

        // 뭔가 크게 잘못된 경우
        if (Array.isArray(aDefBr) == false) {

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            //"설치된 브라우저 정보를 찾을 수 없습니다.";
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "333"); // Installed browser information not found.

            parent.showMessage(sap, 20, 'E', sMsg);

            return;
        }

        // Chrome 브라우저 설치 유무 확인
        let oChrome = aDefBr.find(elem => elem.NAME === "CHROME") || {};
        if (!oChrome || !oChrome.ENABLED) {

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            //sMsg = "Chrome Browser가 설치 되어 있는지 확인하세요!";
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C75"); // Chrome Browser
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "334", sMsg); // &1 is not installed.            

            parent.showMessage(sap, 20, 'E', sMsg);

            return;
        }

        let oMsEdge = aDefBr.find(elem => elem.NAME === "MSEDGE") || {};
        if (!oMsEdge || !oMsEdge.ENABLED) {

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            //sMsg = "MS Edge Browser가 설치 되어 있는지 확인하세요!";
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C76"); // IE edge Browser
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "334", sMsg); // &1 is not installed.

            parent.showMessage(sap, 20, 'E', sMsg);

            return;
        }

        const sPopupName = "SHORTCUTPOP";

        // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {

            // 부모 위치 가운데 배치한다.            
            WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

            // 전체 자식 윈도우에 Busy 끈다.
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        const
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oUserInfo = parent.getUserInfo();

        const oThemeInfo = parent.getThemeInfo(); // theme 정보      

        // 브라우저 옵션 설정
        const 
            sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D31"); // ShortCut Creator    
        oBrowserOptions.skipTaskbar = false;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.modal = true;
        oBrowserOptions.minimizable = false;
        oBrowserOptions.maximizable = false;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL; //테마별 색상 처리               
        oBrowserOptions.height = 900;
        oBrowserOptions.width = 800;

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        let oSettings = oAPP.fn.getSettingsInfo(),
            oSetting_UI5 = oSettings.UI5;

        //==* 기본 config 정보 
        var S_config = {};

        //기능 처리 클라이언트 <-> 서버 통신 서비스 HOST        
        S_config.SHOST = parent.getServerPath();

        //서버 HOST        
        S_config.BASE_SHOST = parent.getHost();

        //UI5 기본 정보
        S_config.UI5_INFO = {};

        S_config.UI5_INFO.src = oSetting_UI5.resourceUrl;

        //Lib 접속 언어        
        S_config.UI5_INFO.language = oUserInfo.LANGU;

        //Lib 테마        
        S_config.UI5_INFO.theme = oThemeInfo.THEME;

        //==*브라우져 설처 경로 
        let T_info = [];

        var S_info = {};
        S_info.TYPE = "CR";
        S_info.PATH = oChrome.INSPATH;
        T_info.push(S_info);


        var S_info = {};
        S_info.TYPE = "MS_EDGE";
        S_info.PATH = oMsEdge.INSPATH;
        T_info.push(S_info);

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기        
        oBrowserWindow.setMenu(null);        

        // 브라우저 실행 경로에 붙일 QueryString 정보
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

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            const oSendData = {
                browserInfo: T_info,
                config: S_config,
                oMetadata: parent.getMetadata()
            };

            // 오픈할 URL 파라미터 전송
            oBrowserWindow.webContents.send('if_APP_shortcutCreator', oSendData);

            // 부모 위치 가운데 배치한다.
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            CURRWIN.focus();

        });

    }; // end of oAPP.fn.fnAppShortCutDownPopupOpener

    /************************************************************************
     * [Header Menu] 비디오 녹화 팝업
     ************************************************************************/
    oAPP.fn.fnOpenVideoRecord = async () => {

        function _setBusy(bIsBusy){

            if(bIsBusy === true){
                oAPP.common.fnSetBusyLock("X");                
                oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" });
                return;
            }

            oAPP.common.fnSetBusyLock("");            
            oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" });
        }

        _setBusy(true);

        /**
         * @since   2026-05-15 17:07:05
         * @version v3.6.0-4
         * @author  soccerhs
         * @description
         * 
         * ## 화면 녹화 기능 리뉴얼
         * 
         * 1. 화면 녹화
         * - 녹화 중 일시정지 / 재개 지원
         * - 실시간 경과 시간 타이머 표시
         * - 화면 모서리 상태 인디케이터 (녹화 중에도 다른 작업 가능)
         * - 녹화 종료 시 자동 파일 저장 (WebM)
         *
         * 2. 드로잉 도구
         * - 기존 펜 기능에서 아래 도구가 추가되었습니다.
         * - 직선 / 사각형 / 원 도형 도구
         * - 텍스트 입력 도구
         * - 지우개
         * - 실행 취소 (Ctrl+Z) / 전체 지우기
         * - 선 굵기 및 투명도 조절
         * - 커스텀 색상 선택
         * 
         * 3 녹화 히스토리
         * - 저장된 녹화 파일 목록 조회
         * - 파일별 수정일 / 파일 크기 / 녹화 길이 표시
         * - 클릭 시 바로 재생
         * - 파일 위치 열기 (탐색기 연동)
         * - 파일 삭제 (녹화 중인 파일 삭제 방지 처리 포함)
         * - 자동 새로고침 (파일 변경 감지)
         * 
         */ 

        /**
         * @since   2026-05-20 19:21:56
         * @version v3.6.3-0
         * @author  soccerhs
         * @description
         * 
         * ## 변경이력
         * 1. 녹화 및 일시정지 상태에서 모니터 전체 테두리 표시 제거 (recording 빨간 펄스, paused 노란 테두리 모두 제거)
         * 2. 녹화 인디케이터 창에 `setContentProtection(true)` 적용 — OS 레벨 캡처 보호로 영상에서 자동 제외
         * 3. 멀티모니터 선택 팝업 렌더링 기준을 `getAllDisplays()` 로 전환 — Chromium 미인식 모니터도 카드로 표시하되 녹화 불가 오버레이로 안내
         */
        const USERINFO = parent.getUserInfo();
        const LANGU = USERINFO.LANGU;

        const videoRec = parent.require(PATH.join(parent.PATHINFO.POPUP_ROOT, 'screen_record', 'index.js'));

        let sVideoDownFolder = PATH.join(APP.getPath("userData"), "screen_record", "video");
        if (parent.FS.existsSync(sVideoDownFolder) === false) {
            parent.FS.mkdirSync(sVideoDownFolder, { recursive: true });
        }
        
        // 이미 실행 중인지 체크
        if(videoRec.isOpen() === true){
            
            let sMsg = parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "806");  // "이미 실행 중입니다.";

            parent.showMessage(sap, 10, "W", sMsg);

            _setBusy(false);

            return;

        }

        let oThemeInfo = parent.getThemeInfo();
        let sThemeName = oThemeInfo?.THEME || "sap_horizon_dark";

        let sApplyThemeName = sThemeName.endsWith("dark") ? "dark" : "light";

        let oUSERINFO = parent.process.USERINFO;
        let sBrowserKey = parent.getBrowserKey();

        const result = await videoRec.open({
            parentWin : parent.REMOTE.getCurrentWindow(),
            outputDir : sVideoDownFolder,
            theme     : sApplyThemeName,       // 'dark' | 'light',
            USERINFO  : oUSERINFO,
            browserKey: sBrowserKey
        });

        if(!result){
    
            let sMsg = parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "807"); //"사용자에 의해 취소되었습니다.";

            parent.showMessage(sap, 10, "W", sMsg);

            _setBusy(false);

            return;

        }
                

    }; // end of oAPP.fn.fnOpenVideoRecord

    /************************************************************************
     * 모나코 에디터 스니펫 생성 팝업 실행
     ************************************************************************/
    oAPP.fn.openMonacoSnippetDesigner = function (oPARAM) {

        var oSettingsInfo = parent.getSettingsInfo();

        var sIndexPath = parent.PATH.join(oSettingsInfo.path.POPUP_ROOT, "monacoSnippetDesigner", "index.js");

        parent.require(sIndexPath)(parent.REMOTE, oAPP, oPARAM);

    }; // end of oAPP.fn.openMonacoSnippetDesigner

    /************************************************************************
     * 모나코 에디터 테마 디자이너 팝업 실행
     ************************************************************************/
    oAPP.fn.openMonacoThemeDesigner = function (oPARAM) {

        let oSettingsInfo = parent.getSettingsInfo();

        var sIndexPath = parent.PATH.join(oSettingsInfo.path.POPUP_ROOT, "monacoThemeDesign", "index.js");

        parent.require(sIndexPath)(parent.REMOTE, oAPP, oPARAM);

    }; // end of oAPP.fn.openMonacoThemeDesigner


})(window, $, oAPP);