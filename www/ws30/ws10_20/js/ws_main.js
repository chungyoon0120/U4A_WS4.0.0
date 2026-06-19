/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : ws_main.js
 * - file Desc : ws 메인 
 ************************************************************************/

(function (window, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common,
        WSUTIL = parent.WSUTIL;

    /**************************************************************************
     * 공통 인스턴스 정의
     **************************************************************************/
    oAPP.main.fnPredefineGlobalObject = function () {

        let oMetaData = parent.getMetadata();

        // 단축키 락 여부 플래그
        oAPP.attr.isShortcutLock = false;

        oAPP.attr.oShortcut = jQuery.extend(true, {}, shortcut);
        oAPP.attr.oServerInfo = parent.getServerInfo(); // 접속 서버 정보
        oAPP.attr.iAppSuggMaxCnt = 20; // WS10 의 APPID Suggestion Max 갯수
        oAPP.attr.iAppNameMaxLength = 15; // WS10 의 어플리케이션명 이름의 Max 길이  
        // oAPP.attr.iSessionTimeout = 0.5; // 세션타임아웃 시간 (1: 1분)
        oAPP.attr.iSessionTimeout = oMetaData?.STIME || 30; // 세션타임아웃 시간 (1: 1분)

        oAPP.attr.bIsNwActive = true; // 네트워크 연결 상태 Flag        

    }; // end of fnPredefineGlobalObject

    /**************************************************************************
     * [WS10] 모델 데이터 기본세팅
     **************************************************************************/
    oAPP.main.fnGetWs10InitData = () => {

        return {
            APPID: "",
            SRCHTXT: {
                INPUT_VISI: false,
                INPUT_VALUE: "",
                COUNT: ""
            }
        };

    }; // end of oAPP.main.fnGetWs10InitData

    /**************************************************************************
     * [WS20] 모델 데이터 기본세팅
     **************************************************************************/
    oAPP.main.fnGetWs20InitData = () => {

        return {
            SRCHTXT: {
                INPUT_VISI: false,
                INPUT_VALUE: "",
                COUNT: ""
            },
            SIDEMENU: {
                SELKEY: "",
                ITEMS: oAPP.main.fnGetWs20SideMenuItemList(),
                FIXITM: oAPP.main.fnGetWs20SideMenuFixItemList()
            }
        };

    }; // end of oAPP.main.fnGetWs20InitData

    /**
     * [원본]     
     */
    // /**************************************************************************
    //  * WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구한다.
    //  **************************************************************************/
    // oAPP.main.fnGetWsMsgModelData = function () {

    //     return new Promise(async (resolve) => {

    //         // WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구한다.
    //         let oLanguTextResult = await WSUTIL.getWsMsgModelData();
    //         if (oLanguTextResult.RETCD == "E") {
    //             resolve();
    //             return;
    //         }

    //         let oLanguJsonData = oLanguTextResult.RTDATA,
    //             oCoreModel = sap.ui.getCore().getModel();

    //         oCoreModel.setProperty("/WSLANGU", oLanguJsonData);

    //         resolve();

    //     });

    // }; // end of oAPP.main.fnGetWsMsgModelData

    /**
     * 모델 바인딩 대상 메시지 텍스트 정보
     * 화면에서 바인딩으로 메시지 출력하고 싶을때 여기다 추가해야함!!     
     */
    function _getModelBindMsgTxtList() {

        const aMsg = [
            { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "047" },
            { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "067" },
            { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "068" },
            { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "247" },
            { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "248" }
        ];

        return aMsg;

    } // end of _getModelBindTxtList

    /**************************************************************************
     * WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구한다.
     **************************************************************************/
    oAPP.main.fnGetWsMsgModelData = function () {

        return new Promise(async (resolve) => {

            // WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구한다.

            let aMsgTxtList = _getModelBindMsgTxtList();

            // WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구한다.
            let oLanguTextResult = WSUTIL.getWsMsgClsModelData(aMsgTxtList);
            if (oLanguTextResult.RETCD == "E") {
                resolve();
                return;
            }

            let oLanguJsonData = oLanguTextResult.RTDATA,
                oCoreModel = sap.ui.getCore().getModel();

            oCoreModel.setProperty("/WSLANGU", oLanguJsonData);

            resolve();

        });

    }; // end of oAPP.main.fnGetWsMsgModelData



    /************************************************************************
     * WS Global 메시지 글로벌 변수 설정
     ************************************************************************/
    oAPP.fn.fnWsGlobalMsgList = () => {

        return new Promise(async (resolve) => {

            if (!oAPP.msg) {
                oAPP.msg = {};
            }

            let oSettingInfo = WSUTIL.getWsSettingsInfo(),
                sWsLangu = oSettingInfo.globalLanguage;

            oAPP.msg.M047 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "047"); // Icon List
            oAPP.msg.M059 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "059"); // Source Pattern
            oAPP.msg.M068 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "068"); // Icon Viewer
            oAPP.msg.M067 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "067"); // Image Icons
            oAPP.msg.M252 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "252"); // DevTool
            oAPP.msg.M253 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "253"); // Keyboard Shortcut List
            oAPP.msg.M228 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "228"); // 문제가 지속될 경우, U4A 솔루션 팀에 문의하세요.
            oAPP.msg.M311 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "311"); // Default Font size
            oAPP.msg.M344 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "344"); // Code Editor
            oAPP.msg.M345 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "345"); // Theme Designer
            oAPP.msg.M346 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "346"); // Snippet Designer
            oAPP.msg.M347 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "347"); // 선택한 테마 정보를 개인화 저장 하는 과정에 문제가 발생하였습니다.
            oAPP.msg.M348 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "348"); // USP 데이터를 Parsing 하는 도중에 문제가 발생하였습니다.
            oAPP.msg.M403 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "403"); // Version Management

            oAPP.msg.M431 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "431"); // AI 연결됨
            oAPP.msg.M432 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "432"); // AI 연결해제됨
            oAPP.msg.M433 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "433"); // U4A 디자인 영역에서만 가능합니다

            resolve();

        });

    }; // end of oAPP.fn.fnWsGlobalMsgList

    /**************************************************************************
     * U4A WS 메타 정보 구하기
     **************************************************************************/
    oAPP.main.fnOnInitModelBinding = function () {

        // ModelData
        var oMetaData = {
            METADATA: parent.getMetadata(),
            USERINFO: parent.getUserInfo(),
            SERVERINFO: parent.getServerInfo(),
            SUGG: {
                TCODE: []
            },
            WMENU: {
                WS10: {},
                WS20: {}
            },
            SETTING: {
                ISPIN: false
            },
            WS10: oAPP.main.fnGetWs10InitData(),
            WS20: oAPP.main.fnGetWs20InitData(),
            WS30: {},
            UAI: {},    // AI 관련 구조
            FMSG: {
                WS10: {
                    ISSHOW: false,
                    ICONCOLOR: "",
                    TXT: ""
                },
                WS20: {
                    ISSHOW: false,
                    ICONCOLOR: "",
                    TXT: ""
                }
            }

        };

        oAPP.attr.metadata = oMetaData;

        var oModelData = jQuery.extend(true, {}, oMetaData),
            oModel = new sap.ui.model.json.JSONModel();

        oModel.setData(oModelData);

        sap.ui.getCore().setModel(oModel);

    }; // end of oAPP.main.fnOnInitModelBinding    

    /**************************************************************************
     * [WS20] Side Menu List
     **************************************************************************/
    oAPP.main.fnGetWs20SideMenuItemList = () => {

        let sText = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B31", "", "", "", "");

        return [{
            key: "MENUITEM_10",
            icon: "sap-icon://screen-split-three",
            text: sText, // "Split Position Change",
            visible: true
        }];
    };

    /**************************************************************************
     * [WS20] Side Fixed Menu List
     **************************************************************************/
    oAPP.main.fnGetWs20SideMenuFixItemList = () => {

        let sText = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B32", "", "", "", "");

        return [{
            key: "FIXITM_10",
            icon: "sap-icon://it-system",
            text: sText, //"System Infomation",
            visible: true
        }];

    };

    /************************************************************************
     * window Event Handle ..
     ************************************************************************/
    // oAPP.main.fnBeforeunload = function (isClearStorage) {

    //     // 화면 Lock 걸기
    //     sap.ui.getCore().lock();

    //     // Busy를 킨다.
    //     parent.setBusy("X");

    //     // 설정된 Global Shortcut 단축키 삭제
    //     oAPP.common.fnRemoveGlobalShortcut();

    //     var oPowerMonitor = parent.POWERMONITOR;

    //     // 대기모드로 전환 감지 이벤트 해제
    //     oPowerMonitor.removeListener('lock-screen', oAPP.fn.fnAttachPowerMonitorLockScreen);

    //     oPowerMonitor.removeListener('unlock-screen', oAPP.fn.fnAttachPowerMonitorUnLockScreen);

    //     // IPCMAIN 이벤트 해제
    //     oAPP.fn.fnIpcMain_Detach_Event_Handler();

    //     // Application 정보를 구한다.
    //     var oAppInfo = parent.getAppInfo() || APPCOMMON.fnGetModelProperty("/WS30/APP"),
    //         SSID = parent.getSSID();

    //     // 20번 페이지 일 경우
    //     var sPath = parent.getServerPath() + '/kill_session',
    //         oFormData = new FormData();

    //     // Edit 모드 였을 경우 Lock 해제 하고 세션 죽인다.
    //     if (oAppInfo && oAppInfo.IS_EDIT == "X") {

    //         oFormData.append("APPID", oAppInfo.APPID);
    //         oFormData.append("SSID", SSID);

    //         var oOptions = {
    //             URL: sPath,
    //             FORMDATA: oFormData
    //         };

    //         sendServerExit(oOptions, () => {

    //             if (isClearStorage == "X") {

    //                 oAPP.fn.fnClearSessionStorageData(); // #[ws_fn_04.js]

    //                 // 서버리스트 포커스 주기
    //                 oAPP.fn.fnSetFocusServerList(); // #[ws_fn_04.js]

    //             }

    //             window.onbeforeunload = () => { };

    //             top.window.close();

    //         });

    //         // 화면 Lock 해제
    //         sap.ui.getCore().unlock();

    //         // Busy를 끈다.
    //         parent.setBusy("");

    //         return;

    //     }

    //     // 20번, 30번일 경우에만 APPID를 던진다
    //     if(oAppInfo && oAppInfo.APPID){
    //         oFormData.append("APPID", oAppInfo.APPID);
    //     }        

    //     oFormData.append("SSID", SSID);

    //     var oOptions = {
    //         URL: sPath,
    //         FORMDATA: oFormData
    //     };

    //     sendServerExit(oOptions, () => {

    //         // 브라우저에 내장된 세션 정보를 클리어 한다.
    //         if (isClearStorage == "X") {

    //             oAPP.fn.fnClearSessionStorageData(); // #[ws_fn_04.js]

    //             // 서버리스트 포커스 주기
    //             oAPP.fn.fnSetFocusServerList(); // #[ws_fn_04.js]

    //         }

    //         window.onbeforeunload = () => { };

    //         top.window.close();

    //         // 화면 Lock 해제
    //         sap.ui.getCore().unlock();

    //         // Busy를 끈다.
    //         parent.setBusy("");


    //     });

    // }; // end of oAPP.main.fnBeforeunload

    /**
     * @since   2025-12-30 19:16:37
     * @version v3.5.7-4
     * @author  soccerhs
     * @description
     *  - 공통 beforeunload 메소드 리펙토링 작업
     * 
     */
    oAPP.main.fnBeforeunload = function (isClearStorage) {

        // 1. UI 잠금 및 초기화 작업
        // [UI5 제거] 구: sap.ui.getCore().lock() → HTML5 busy/lock 헬퍼.
        //  (호스트에 UI5 없음 → bare `sap` ReferenceError 가 종료 시 Critical 다이얼로그 원인이었음)
        oAPP.common.fnSetBusyLock("X");
        oAPP.common.fnRemoveGlobalShortcut();

        // 2. 이벤트 리스너 해제
        const oPowerMonitor = parent.POWERMONITOR;
        oPowerMonitor.removeListener('lock-screen', oAPP.fn.fnAttachPowerMonitorLockScreen);
        oPowerMonitor.removeListener('unlock-screen', oAPP.fn.fnAttachPowerMonitorUnLockScreen);
        oAPP.fn.fnIpcMain_Detach_Event_Handler();

        // 3. 데이터 준비
        const oAppInfo = parent.getAppInfo() || APPCOMMON.fnGetModelProperty("/WS30/APP");
        const SSID = parent.getSSID();
        const sPath = parent.getServerPath() + '/kill_session';

        const oFormData = new FormData();
        oFormData.append("SSID", SSID);

        // APPID가 존재하면 추가 (Edit 모드이거나, 단순히 APPID가 있는 경우 모두 포함)
        if (oAppInfo && oAppInfo.APPID) {
            oFormData.append("APPID", oAppInfo.APPID);
        }

        // 4. 서버 전송 옵션 설정
        const oOptions = {
            URL: sPath,
            FORMDATA: oFormData
        };

        // 5. 서버 세션 종료 요청 및 후처리
        sendServerExit(oOptions, () => {

            // 스토리지 클리어 요청이 있는 경우
            if (isClearStorage === "X") {
                oAPP.fn.fnClearSessionStorageData(); // #[ws_fn_04.js]
                oAPP.fn.fnSetFocusServerList();      // #[ws_fn_04.js]
            }

            // beforeunload 이벤트 무력화 (창 닫기 시 확인창 방지)
            window.onbeforeunload = () => { };

            // 창 닫기
            top.window.close();

            // UI 잠금 해제 및 Busy 끄기
            // (창이 즉시 닫히지 않는 환경을 대비해 안전하게 수행)
            // [UI5 제거] 구: sap.ui.getCore().unlock() → HTML5 busy/lock 헬퍼.
            oAPP.common.fnSetBusyLock("");

        });

    }; // end of oAPP.main.fnBeforeunload    

    oAPP.main.fnDetachBeforeunloadEvent = () => {

        window.onbeforeunload = () => { };

    };

    oAPP.main.fnSetLanguage = function () {

        var oUserInfo = parent.getUserInfo(),
            oMetaScript = document.getElementById("sap-ui-bootstrap");

        if (!oMetaScript) {
            return;
        }

        var sMetaLangu = oMetaScript.getAttribute("data-sap-ui-language");
        // if (oUserInfo.LANGU == sMetaLangu) {
        if (oUserInfo.WSLANGU == sMetaLangu) {
            return;
        }

        oMetaScript.setAttribute("data-sap-ui-language", oUserInfo.LANGU);

    };

    // Drag End Event
    oAPP.main.onDragend = () => {

        // 20번 페이지 Design영역, Attribute 영역 잔상 제거
        if (oAPP.fn.ClearDropEffect) {
            oAPP.fn.ClearDropEffect();
        }

        // 미리보기쪽 잔상 제거
        if (oAPP.attr.ui &&
            oAPP.attr.ui.frame &&
            oAPP.attr.ui.frame.contentWindow &&
            oAPP.attr.ui.frame.contentWindow.prevClearDropEffect) {

            oAPP.attr.ui.frame.contentWindow.prevClearDropEffect();

        }

        parent.IPCRENDERER.send("if-Dialog-dragEnd");

    }; // end of oAPP.main.onDragend


    /************************************************************************
     * 현재 브라우저의 child window 전체를 
     * 부모가 위치한 모니터 기준 바둑판 정렬
     ************************************************************************/
    oAPP.main.adjustWindowGrid = function () {


        let mainWindow = parent.CURRWIN;
        let screen = parent.SCREEN;
        let childWindows = mainWindow.getChildWindows();


        // 원본------- Start

        // // 부모 창의 위치와 크기 가져오기
        // const [parentX, parentY] = mainWindow.getPosition();
        // const [parentWidth, parentHeight] = mainWindow.getSize();

        // // 부모 창의 중앙 위치
        // const parentCenterX = parentX + parentWidth / 2;
        // const parentCenterY = parentY + parentHeight / 2;

        // // 부모 창이 위치한 디스플레이를 찾기
        // const displays = screen.getAllDisplays();
        // let targetDisplay;
        // for (const display of displays) {
        //     const { x, y, width, height } = display.workArea;
        //     if (parentCenterX >= x && parentCenterX < x + width && parentCenterY >= y && parentCenterY < y + height) {
        //         targetDisplay = display;
        //         break;
        //     }
        // }

        // if (!targetDisplay) return;

        // // 디스플레이 작업 영역 정보
        // const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = targetDisplay.workArea;

        // // 자식 창들을 30px 간격으로 겹쳐서 배치
        // const spacing = 30;
        // let currentX = displayX;
        // let currentY = displayY;

        // childWindows.forEach((childWindow, index) => {

        //     // 자식 창의 위치 설정
        //     childWindow.setPosition(Math.round(currentX), Math.round(currentY));

        //     // 다음 자식 창의 위치로 이동 (30px 간격)
        //     currentX += spacing;
        //     currentY += spacing;

        // });

        // // 모든 자식 창을 보이게 설정
        // childWindows.forEach(childWindow => {
        //     childWindow.show();
        // });

        // 원본------- End


        // 부모 창이 위치한 디스플레이를 찾기
        const displays = screen.getAllDisplays();
        let targetDisplay;

        let winBounds = mainWindow.getBounds();
        let maxArea = 0;

        for (let display of displays) {

            const displayBounds = display.bounds;

            // 윈도우의 영역이 어떤 모니터에 더 많이 포함되어 있는지 계산
            const overlapArea = _getOverlapArea(winBounds, displayBounds);

            if (overlapArea > maxArea) {
                maxArea = overlapArea;
                targetDisplay = display;
            }

        }

        if (!targetDisplay) return;

        // 디스플레이 작업 영역 정보
        const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = targetDisplay.workArea;

        // 자식 창들을 30px 간격으로 겹쳐서 배치
        const spacing = 30;
        let currentX = displayX;
        let currentY = displayY;

        let aChildXY = [];

        childWindows.forEach((childWindow, index) => {

            aChildXY.push({ X: currentX, Y: currentY, WIN: childWindow });

            // 자식 창의 위치 설정
            // childWindow.setPosition(Math.round(currentX), Math.round(currentY));

            // 다음 자식 창의 위치로 이동 (30px 간격)
            currentX += spacing;
            currentY += spacing;

        });

        aChildXY.forEach((oPos) => {

            oPos.WIN.setPosition(Math.round(oPos.X), Math.round(oPos.Y));

        });

        aChildXY.forEach((oPos) => {

            oPos.WIN.setBounds({ x: Math.round(oPos.X), y: Math.round(oPos.Y) });

        });

        // 모든 자식 창을 보이게 설정
        childWindows.forEach(childWindow => {

            if (childWindow.isVisible() === false) {
                return;
            }

            childWindow.show();

        });

    }; // end of oAPP.main.adjustWindowGrid


    /************************************************************************
     * 윈도우의 영역이 어떤 모니터에 더 많이 포함되어 있는지 계산
     ************************************************************************/
    function _getOverlapArea(rect1, rect2) {
        const x_overlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x));
        const y_overlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y));

        return x_overlap * y_overlap;
    }

    /************************************************************************
     * 현재 브라우저의 child window 전체를 
     * 부모가 위치한 모니터 기준 중앙 정렬
     ************************************************************************/
    oAPP.main.adjustCenterChildWindow = function () {

        let mainWindow = parent.CURRWIN;
        let screen = parent.SCREEN;
        let childWindows = mainWindow.getChildWindows();

        // 부모 창이 위치한 디스플레이를 찾기
        const displays = screen.getAllDisplays();
        let targetDisplay;

        let winBounds = mainWindow.getBounds();
        let maxArea = 0;

        for (let display of displays) {

            const displayBounds = display.bounds;

            // 윈도우의 영역이 어떤 모니터에 더 많이 포함되어 있는지 계산      
            const overlapArea = _getOverlapArea(winBounds, displayBounds);

            if (overlapArea > maxArea) {
                maxArea = overlapArea;
                targetDisplay = display;
            }

        }

        if (!targetDisplay) return;

        // 디스플레이의 중앙 좌표 계산
        const displayCenterX = targetDisplay.workArea.x + targetDisplay.workArea.width / 2;
        const displayCenterY = targetDisplay.workArea.y + targetDisplay.workArea.height / 2;

        childWindows.forEach(childWindow => {

            const { width: childWidth, height: childHeight } = childWindow.getBounds();

            // 자식 창을 디스플레이의 중앙에 위치 설정
            const childX = Math.round(displayCenterX - childWidth / 2);
            const childY = Math.round(displayCenterY - childHeight / 2);
            childWindow.setPosition(childX, childY);

        });

        childWindows.forEach(childWindow => {

            const { width: childWidth, height: childHeight } = childWindow.getBounds();

            // 자식 창을 디스플레이의 중앙에 위치 설정
            const childX = Math.round(displayCenterX - childWidth / 2);
            const childY = Math.round(displayCenterY - childHeight / 2);
            childWindow.setPosition(childX, childY);

        });

        // 모든 자식 창을 보이게 설정
        childWindows.forEach(childWindow => {

            if (childWindow.isVisible() === false) {
                return;
            }

            childWindow.show();
        });

    }; // end of oAPP.main.adjustCenterChildWindow

    /************************************************************************
     * 현재 브라우저의 이벤트 핸들러
     ************************************************************************/
    function _attachCurrentWindowEvents() {

        let CURRWIN = parent.CURRWIN;

        CURRWIN.on("maximize", () => {

            if (typeof sap === "undefined") {
                return;
            }

            let oMaxBtn = sap.ui.getCore().byId("maxWinBtn");
            if (!oMaxBtn) {
                return;
            }

            oMaxBtn.setIcon("sap-icon://value-help");

        });

        CURRWIN.on("unmaximize", () => {

            if (typeof sap === "undefined") {
                return;
            }

            let oMaxBtn = sap.ui.getCore().byId("maxWinBtn");
            if (!oMaxBtn) {
                return;
            }

            oMaxBtn.setIcon("sap-icon://header");

        });

    } // end of _attachCurrentWindowEvents


    /************************************************************************
     * 작업표시줄 메뉴 생성하기
     ************************************************************************/
    function _createTaskBarMenu() {

        parent.CURRWIN.setThumbarButtons([
            {
                // tooltip: 'alignLeftTop',
                tooltip: 'Child Window Align Left Top',
                icon: parent.PATH.join(parent.APPPATH, "img", "newwin_1.png"),
                click() {

                    // 현재 떠있는 윈도우를 부모에 위치한 모니터 기준으로
                    // 좌측 상단 부터 바둑판 형태로 정렬
                    oAPP.main.adjustWindowGrid();

                }
            },
            {
                // tooltip: 'alignCenter',
                tooltip: 'Child Window Align Center',
                icon: parent.PATH.join(parent.APPPATH, "img", "winCenter.png"),
                click() {

                    // 현재 떠있는 윈도우를 부모에 위치한 모니터 기준으로
                    // 좌측 상단 부터 가운데 정렬
                    oAPP.main.adjustCenterChildWindow();

                }
            },

        ]);

    } // end of _createTaskBarMenu


    // /************************************************************************
    //  * UAI 쪽에서 파라미터를 전달받기 위한 이벤트 생성
    //  ************************************************************************/
    // function _attach_AI_Events_WS10(){

    //     let _oAI_IF_DOM = parent.document.getElementById("ai_if_dom");
    //     if(!_oAI_IF_DOM){
    //         return;
    //     }

    //     let oWsSettingInfo = WSUTIL.getWsSettingsInfo();
    //     let oWsPaths = oWsSettingInfo.path;

    //     // 커스텀 이벤트 명
    //     // let _sEventName = `ai-message`;
    //     let _sEventName = `ai-WS30_10`;

    //     _oAI_IF_DOM.addEventListener(_sEventName, function(oEvent){

    //         let oIF_DATA = oEvent?.detail || undefined;
    //         if(!oIF_DATA){

    //             // 콘솔용 오류 메시지
    //             var aConsoleMsg = [
    //                 `######################################`,
    //                 `## AI에서 전송 데이터 누락!!!!`,
    //                 `######################################`,
    //                 `[PATH]: www/ws10_20/js/ws_main.js`,  
    //                 `=> _attach_AI_Events`,
    //                 `######################################\n`,
    //             ];
    //             console.error(aConsoleMsg.join("\r\n"));

    //             return;
    //         }

    //         // 액션코드 기준으로 분기
    //         if(!oIF_DATA.ACTCD){

    //             // 콘솔용 오류 메시지
    //             var aConsoleMsg = [
    //                 `######################################`,
    //                 `## AI에서 ACTCD 데이터 누락!!!!`,
    //                 `######################################`,
    //                 `[PATH]: www/ws10_20/js/ws_main.js`,  
    //                 `=> _attach_AI_Events`,
    //                 `######################################\n`,
    //             ];
    //             console.error(aConsoleMsg.join("\r\n"));

    //             return;
    //         }

    //         try {

    //             let sModulePath = parent.PATH.join(oWsPaths.JS_ROOT, "uai", "ACTCD_MODULES", oIF_DATA.ACTCD, "index.js");
    //             if(parent.FS.existsSync(sModulePath) === false){

    //                 // 콘솔용 오류 메시지
    //                 var aConsoleMsg = [
    //                     `######################################`,
    //                     `## AI에서 전달한 ACTCD 별 분기 Modules 없음!!`,
    //                     `######################################`,
    //                     `[PATH]: www/ws10_20/js/ws_main.js`,  
    //                     `=> _attach_AI_Events`,
    //                     `######################################\n`,
    //                 ];

    //                 console.error(aConsoleMsg.join("\r\n"));

    //                 return;
    //             }

    //             parent.require(sModulePath)(oAPP, oIF_DATA);

    //         } catch (error) {

    //             // 콘솔용 오류 메시지
    //             var aConsoleMsg = [
    //                 `######################################`,
    //                 `## AI에서 전달한 ACTCD 별 분기 Modules 오류!!`,
    //                 `######################################`,
    //                 `[PATH]: www/ws10_20/js/ws_main.js`,  
    //                 `=> _attach_AI_Events`,
    //                 `######################################\n`,
    //             ];

    //             console.error(aConsoleMsg.join("\r\n"));
    //             console.error(error);

    //             return;

    //         }

    //     });

    // } // end of _attach_AI_Events



    // UI5 BusyDialog가 거지 같아서 내가 그냥 직접 만든 BusyDialog
    class BusyDialog {

        constructor() {

            this.dialog = new sap.m.Dialog({
                showHeader: false
            }).addStyleClass("sapMBusyDialog sapUiSizeCompact");

            this.dialog.data("MUTATION_EXCEP", "X");

            this.busyIndicator = new sap.m.BusyIndicator();

            this.text = new sap.m.Label().addStyleClass("sapMBusyDialogLabel");

            this.dialog.addContent(this.text);
            this.dialog.addContent(this.busyIndicator);

        }

        setText(sText = "") {

            let bIsTextVisi = false;

            if (sText) {
                bIsTextVisi = true;
            }

            this.text.setVisible(bIsTextVisi);

            this.text.setText(sText);

        }

        setTitle(sTitle = "") {

            this.dialog.setTitle(sTitle);

            if (sTitle === "") {

                this.dialog.setShowHeader(false);

                return;

            }

            this.dialog.setShowHeader(true);

        }

        isOpen() {
            return this.dialog.isOpen();
        }

        open() {

            this.dialog.open();

        }

        close() {

            this.dialog.close();

        }

    }


    /************************************************************************
     * WS10번의 배경 이미지 페이지 영역에 테마별 css 적용
     ************************************************************************/
    function _applyWs10ContPageThemeClass() {

        let sTheme = sap.ui.getCore().getConfiguration().getTheme();
        let oPage = sap.ui.getCore().byId("ws10_contPage");

        if (sTheme.indexOf("dark") > -1 || sTheme.indexOf("hcb") > -1) {
            oPage.removeStyleClass("u4a-ws-light-theme");
        } else {
            oPage.addStyleClass("u4a-ws-light-theme");
        }

    } // end of _applyWs10ContPageThemeClass

    function runScriptInIframe(jsPath) {
        var sIframeId = "oAppSideExecutionIframe";
        var oIframe = document.getElementById(sIframeId);

        // 1. iframe이 없으면 새로 생성해서 body에 붙임
        if (!oIframe) {
            oIframe = document.createElement('iframe');
            oIframe.id = sIframeId;
            oIframe.style.display = 'none'; // 숨김 처리
            document.body.appendChild(oIframe);
        } else {
            // 2. 기존에 있으면 src를 비워서 초기화 (메모리나 실행 컨텍스트 정리)
            oIframe.src = "about:blank";
        }

        // 3. 약간의 딜레이를 주거나 즉시 새 JS 경로 주입
        // (브라우저가 about:blank를 처리할 시간을 아주 미세하게 주는 게 안전함)
        oIframe.src = jsPath;

        console.log("🚀 Iframe 실행 경로 변경됨:", jsPath);

    };

    // --- 실행 예시 ---
    // oAPP.runScriptInIframe("./js/worker_logic.js");

    function _setContextMenu() {

        // 2. 환경 변수 체크
        const sLocalRoot = process?.env?.U4A_WS_LOCAL_ROOT;
        if (!sLocalRoot) {
            console.warn("[js 실행 경로 추출] - 환경 변수 'U4A_WS_LOCAL_ROOT'가 지정되지 않았습니다.");
            return;
        }

        window.addEventListener('contextmenu', function (e) {
            // 1. 제어 조건 확인
            if (!e.ctrlKey) return;

            // 2. 기본 동작 방지
            e.preventDefault();
            e.stopImmediatePropagation();

            const oTarget = e.target;
            if (!oTarget) return;

            let oControl = null;

            /** * [STEP 3] UI5 컨트롤 획득 (우선순위 전략)
             */
            // 3-1. Target에 ID가 있으면 즉시 byId로 시도 (가장 빠름)
            if (oTarget.id && window.sap?.ui?.getCore) {
                oControl = sap.ui.getCore().byId(oTarget.id);
            }

            // 3-2. ID로 못 찾았거나 ID가 없는 경우, 최신 표준 방식인 closestTo 시도
            if (!oControl && window.sap?.ui?.core?.Element?.closestTo) {
                oControl = sap.ui.core.Element.closestTo(oTarget);
            }

            // 3-3. 여전히 없으면 구버전/jQuery 방식 시도 (Fallback)
            if (!oControl && window.sap?.ui?.getCore) {
                const sId = $(oTarget).closest("[data-sap-ui]").attr("id");
                oControl = sap.ui.getCore().byId(sId);
            }

            // 컨트롤을 아예 못 찾았으면 종료
            if (!oControl) return;

            let aJsPaths = [];

            // 4. 부모 계층을 탐색하며 데이터(ws-runJsPath) 찾기
            while (oControl) {
                const aFoundPaths = (typeof oControl.data === "function") ? oControl.data("ws-runJsPath") : null;

                if (Array.isArray(aFoundPaths) && aFoundPaths.length > 0) {
                    aJsPaths = aFoundPaths;
                    break;
                }

                // 부모 컨트롤로 이동 (조상 탐색)
                oControl = oControl.getParent?.() || null;
            }

            // 5. 최종 데이터 검증 및 실행
            const sJsPath = aJsPaths[0];
            if (sJsPath) {
                console.log("🚀 실행 경로 발췌 완료:", sJsPath);
                runScriptInIframe(sJsPath);
            }

        }, true);

    }

    /************************************************************************
     *--------------------------[ U4A WS Start ] ----------------------------
     ************************************************************************/
    oAPP.main.fnWsStart = function () {

        // [UI5 제거] 구: sap.ui.getCore().attachInit(async ...) 래퍼 → 즉시 실행 async IIFE.
        (async function () {

            // [UI5 제거] jQuery.sap.require(...) 제거 (UI5 없음).

            // 마우스 휠 이벤트 적용하기 (줌 기능)
            try { oAPP.fn.fnAttachMouseWheelEvent(); } catch (e) { console.warn("[HTML5] fnAttachMouseWheelEvent skip:", e && e.message); }

            // 화면 보호기 감지 이벤트
            try { oAPP.fn.fnAttachPowerMonitorEvent(); } catch (e) { console.warn("[HTML5] fnAttachPowerMonitorEvent skip:", e && e.message); }

            /**
             * [RND Tool] 현재 영역(Window/Iframe)에 소스 탐색 이벤트 주입
             * * @param {Window} window - 이벤트를 바인딩할 현재의 실행 영역(Context).
             * * ※ 사유: 
             * 1. 이벤트 타겟팅: 호출한 이 영역(Iframe 등) 내에서 발생하는 우클릭만 감시하기 위함.
             * 2. 객체 참조: 이 영역에 로드된 UI5 객체(sap)와 DOM을 정확히 뒤지기 위해 현재 스코프를 주입함.
             */
            if (parent.DEV_SOURCE_FINDER && parent.DEV_SOURCE_FINDER.init) {
                parent.DEV_SOURCE_FINDER.init(window);
            }

            // 공통 인스턴스 정의
            try { oAPP.main.fnPredefineGlobalObject(); } catch (e) { console.warn("[HTML5] fnPredefineGlobalObject skip:", e && e.message); }

            // 초기 모델 바인딩
            try { oAPP.main.fnOnInitModelBinding(); } catch (e) { console.warn("[HTML5] fnOnInitModelBinding skip:", e && e.message); }

            // 초기 현재 화면 위치 정보 저장
            try { parent.setCurrPage("WS10"); } catch (e) { }

            // [UI5 제거] parent.oWS.utill.attr.sap = sap; 제거 (sap 없음).

            // [UI5 제거] UI5 BusyDialog → 호환 더미 객체 (setBusy/setDomBusy 위임)
            parent.oWS.utill.attr.oBusy = (oAPP.fn.fnCreateDummyBusy && oAPP.fn.fnCreateDummyBusy());

            // AI 연결 관련 커스텀 이벤트 초기 설정
            if (parent.UAI && parent.UAI.init) { parent.UAI.init(); }

            // // UAI 쪽에서 파라미터를 전달받기 위한 이벤트 생성
            // _attach_AI_Events();

            // 작업표시줄 메뉴 생성하기
            try { _createTaskBarMenu(); } catch (e) { console.warn("[HTML5] _createTaskBarMenu skip:", e && e.message); }

            // 현재 브라우저의 이벤트 핸들러
            try { _attachCurrentWindowEvents(); } catch (e) { console.warn("[HTML5] _attachCurrentWindowEvents skip:", e && e.message); }

            // [UI5 무력화] illustration/SAP/U4A 아이콘 등록은 UI5 전용 → sap 참조 시 크래시. 가드.
            try { if (oAPP.fn.fnRegisterIllustrationPool) oAPP.fn.fnRegisterIllustrationPool(); } catch (e) { }
            try { if (oAPP.fn.fnRegisterSAPIcons) oAPP.fn.fnRegisterSAPIcons(); } catch (e) { }
            try { if (oAPP.fn.fnRegisterU4AIcons) oAPP.fn.fnRegisterU4AIcons(); } catch (e) { }

            // // 초기 현재 화면 위치 정보 저장
            // parent.setCurrPage("WS10");

            // // 공통 인스턴스 정의
            // oAPP.main.fnPredefineGlobalObject();

            // // UI5 bootstrap tag의 Language 값 설정 테스트)
            // oAPP.main.fnSetLanguage();

            // 브라우저 상단 메뉴를 없앤다.
            parent.setBrowserMenu(null);

            // oAPP.common.fnSetGlobalShortcut();

            // APP 전체 대상 공통 Shortcut 지정하기
            try { oAPP.common.fnSetCommonShortcut(); } catch (e) { console.warn("[HTML5] fnSetCommonShortcut skip:", e && e.message); }

            // // 초기 모델 바인딩
            // oAPP.main.fnOnInitModelBinding();

            //WS Global Setting Lauguage에 맞는 메시지 텍스트 정보를 구해서 모델에 저장한다.
            await oAPP.main.fnGetWsMsgModelData();

            // WS Global 메시지 글로벌 변수 설정
            try { await oAPP.fn.fnWsGlobalMsgList(); } catch (e) { console.warn("[HTML5] fnWsGlobalMsgList skip:", e && e.message); }

            // 초기 화면 그리기 (HTML5: ws_fn_01.fnOnInitRendering → ws10_html.fnRenderWs10Html)
            //   렌더가 실패해도 빈 화면이 되지 않도록 폴백으로 WS10 직접 렌더를 재시도한다.
            try {
                oAPP.fn.fnOnInitRendering();
            } catch (e) {
                console.error("[HTML5] fnOnInitRendering error:", e);
                try { oAPP.fn.fnRenderWs10Html && oAPP.fn.fnRenderWs10Html(); } catch (e2) { console.error("[HTML5] fnRenderWs10Html error:", e2); }
            }

            // 개인화 정보 설정 (HTML5: ws_html5_shell 스텁)
            try { oAPP.fn.fnOnInitP13nSettings(); } catch (e) { console.warn("[HTML5] fnOnInitP13nSettings skip:", e && e.message); }

            // 서버 세션 타임아웃 체크
            try { oAPP.fn.fnServerSession(); } catch (e) { console.warn("[HTML5] fnServerSession skip:", e && e.message); }

            // DOM 감지
            try { oAPP.fn.fnSetMutationObserver(); } catch (e) { console.warn("[HTML5] fnSetMutationObserver skip:", e && e.message); }

            // 공통 IPCMAIN 이벤트 걸기
            try { oAPP.fn.fnIpcMain_Attach_Event_Handler(); } catch (e) { console.warn("[HTML5] fnIpcMain_Attach skip:", e && e.message); }

            // 공통 BroadCast 이벤트 걸기
            try { oAPP.fn.fnBroadCast_Attach_Event_Handler(); } catch (e) { console.warn("[HTML5] fnBroadCast_Attach skip:", e && e.message); }

            // [UI5 제거] 구: sap.ui.getCore().attachEvent(UIUpdated, ...) → 렌더 직후 1회 직접 실행.
            await (async function _afterRender() {

                if (parent.oWS.utill.attr.UIUpdated) { return; }

                // [UI5 제거] _applyWs10ContPageThemeClass / attachThemeChanged 는 UI5 테마 의존
                //            → ws10_html.js 가 U4ATheme 로 처리. 여기선 생략.

                parent.oWS.utill.attr.UIUpdated = "X";

                // WS 10번 화면 관련 AI 커스텀 이벤트 등록
                try { if (parent.UAI && parent.UAI.setCustomEvent_WS_10) parent.UAI.setCustomEvent_WS_10(); } catch (e) { }

                // 시스템 공지사항이 있을 경우 화면에 출력
                try {
                    if (oAPP.common.checkWLOList("C", "UHAK901215") === true) {
                        /* ────────────────────────────────────────────────────────────────
                         * [UI5 제거] showSystemNotiMsg() — HTML5 방식으로 재구현 완료.
                         * ----------------------------------------------------------------
                         *  과거 : 백엔드가 "공지 다이얼로그를 그리는 UI5 스크립트(sap.m.Dialog/
                         *         MessageView/MessageItem)"를 내려주고 프론트가 eval → UI5 제거로 불가.
                         *  현재 : showSystemNotiMsg 가 그 스크립트를 eval 하지 않고, 제목/부제/본문만
                         *         파싱해 동일 모양의 네이티브 다이얼로그로 렌더(ws_common.js).
                         * ──────────────────────────────────────────────────────────────── */
                        await oAPP.common.showSystemNotiMsg();
                    }
                } catch (e) { }

                // 새창 띄우면서 IF_DATA에 파라미터가 존재할 경우
                let oNewWin_IF_DATA = parent.getNewBrowserIF_DATA && parent.getNewBrowserIF_DATA();
                if (oNewWin_IF_DATA) {

                    let ACTCD = oNewWin_IF_DATA.ACTCD;

                    switch (ACTCD) {
                        case "MOVE20":  // 버전관리 화면에서 요청한 액션이 20번으로 이동인 경우.

                            let APPID = oNewWin_IF_DATA.APPID;
                            if (!APPID) {
                                break;
                            }

                            // [HTML5] AppNmInput = DOM input. displayBtn(WS20 진입)은 WS20 셸(S3) 전까지 보류.
                            try {
                                let oInp = oAPP.fn.fnGetWs10AppInputDom && oAPP.fn.fnGetWs10AppInputDom();
                                if (oInp) { oInp.value = APPID; }
                            } catch (e) { }

                            break;

                        default:
                            break;
                    }
                }

                window.requestAnimationFrame(function () {

                    // activate 이벤트 전파
                    try {
                        let IPC_HANDLER = new parent.CLIpcHandler();
                        IPC_HANDLER.command("WS_MAIN_UI_UPDATED", {
                            fromPage: parent.getCurrPage(),
                            sessionKey: parent.getSessionKey(),
                            browserKey: parent.getBrowserKey()
                        });
                        zconsole.log("IPC_HANDLER.command - WS_MAIN_UI_UPDATED!");
                    } catch (e) { }

                    jQuery('#content').fadeIn({
                        duration: 300,
                        complete: function () {
                            parent.setBusy("");
                            parent.setDomBusy("");
                        }
                    });

                });

            })();

        })().catch(function (e) {
            console.error("[HTML5] fnWsStart error:", e);
            parent.setBusy && parent.setBusy("");
            parent.setDomBusy && parent.setDomBusy("");
        }); // end of fnWsStart async

        /************************************************************************
         * 네트워크 연결 및 해제 시 발생되는 이벤트
         ************************************************************************/
        window.addEventListener("online", oAPP.fn.fnNetworkCheckerOnline, false);
        window.addEventListener("offline", oAPP.fn.fnNetworkCheckerOffline, false);

    }; // end of oAPP.main.fnWsStart    

    window.ondragend = (e) => {

        // console.log('ondragend!!!');

        oAPP.main.onDragend();

    };

    /**
     * 테스트
     * @returns 
     */
    // window.ondragstart = () => {
    window.addEventListener("dragstart", () => {

        // console.log('ondragstart!!!');

        oAPP.main.onDragend();

        //focus된 dom focus 해제 처리.
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }

        var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
        if (l_dom === null || l_dom.length === 0) {
            return;
        }

        let oDom = l_dom[0];

        oDom.classList.remove("u4aWsDisplayNone");

    });

    // 브라우저 닫기, window.close() 실행시 타는 이벤트
    // return "";           // 안닫힘
    // return true;         // 안닫힘
    // return false;        // 안닫힘
    // return;              // 닫힘
    // return null;         // 닫힘
    // return undefined;    // 닫힘

    // e.returnValue = true;    // 안닫힘
    // e.returnValue = false;   // 안닫힘
    // e.returnValue = "";      // 안닫힘
    // e.returnValue = null;    // 안닫힘
    // e.returnValue = "X";     // 안닫힘

    window.onbeforeunload = (e) => {

        // Logout 메시지가 이미 떠 있다면 창을 못닫게 한다.
        if (oAPP.attr.isBrowserCloseLogoutMsgOpen == 'X') {

            // 네트워크가 차단됐을 경우는 그냥 끈다.            
            if (!oAPP.attr.bIsNwActive) {
                oAPP.main.fnBeforeunload("");
                return;
            }

            return false;
        }

        // 브라우저의 닫기 버튼을 누른게 아니라면 종료 하지 않음
        if (oAPP.attr.isPressWindowClose !== "X") {
            return false;
        }

        // 같은 세션의 브라우저 갯수 체크
        var aSameBrowser = oAPP.fn.fnGetSameBrowsers(); // #[ws_fn_02.js]        

        // 같은 세션의 브라우저가 나밖에 없다면
        if (aSameBrowser.length == 0) {

            // 네트워크가 차단됐을 경우는 그냥 끈다.
            if (!oAPP.attr.bIsNwActive) {
                oAPP.main.fnBeforeunload("");
                return;
            }

            // // Logout 메시지 Open 여부 Flag
            // oAPP.attr.isBrowserCloseLogoutMsgOpen = 'X';

            // // Unsaved data will be lost.
            // // Do you want to log off?
            // var sMsg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "301", "", "", "", "");
            // sMsg += " \n " + oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "302", "", "", "", "");

            // // 질문 팝업?
            // parent.showMessage(sap, 30, 'I', sMsg, lf_MsgCallback);

            /**
             * @since   2025-04-22
             * @version 3.5.3-sp2
             * @author  soccerhs
             * 
             * @description
             * - 같은 세션의 브라우저가 나밖에 없을 경우에는 Logoff 처리 한다.
             * 
             * - 기존에는 브라우저 창닫기 시, 백엔드에서 세션만 죽이는 로직을 수행했더니,
             *   SM05의 Http Security Session이 죽지 않은 현상이 발견되어
             *   창닫기 시, 같은 세션의 브라우저가 나밖에 없을 경우에는 Logoff 서비스를 호출함.
             */
            oAPP.events.ev_Logout();

            return "";

        }

        // 현재 브라우저에 걸려있는 shortcut, IPCMAIN 이벤트 등 각종 이벤트 핸들러를 제거 하고, 
        // 현재 브라우저의 화면이 20번 페이지일 경우는 서버 세션 죽이고 Lock도 해제한다.
        oAPP.main.fnBeforeunload("");

        return "";

    }; // end of window.onbeforeunload

    // function lf_MsgCallback(sAction) {

    //     delete oAPP.attr.isBrowserCloseLogoutMsgOpen; // Logout 메시지 Open 여부 Flag
    //     delete oAPP.attr.isPressWindowClose; // 브라우저의 닫기 버튼을 눌렀는지 여부 Flag

    //     if (sAction != "YES") {
    //         return;
    //     }

    //     // 현재 브라우저에 종속된 팝업 종류들을 닫는다.
    //     oAPP.fn.closeAllCurrWinDependentPopups(); // => [ws_fn_04.js]

    //     // 서버리스트 팝업에 포커스를 준다.
    //     oAPP.fn.fnSetFocusServerList(); // [ws_fn_04.js]

    //     // 현재 브라우저에 걸려있는 shortcut, IPCMAIN 이벤트 등 각종 이벤트 핸들러를 제거 하고, 
    //     // 현재 브라우저의 화면이 20번 페이지일 경우는 서버 세션 죽이고 Lock도 해제한다.
    //     oAPP.main.fnBeforeunload('X');

    // }

})(window, oAPP);