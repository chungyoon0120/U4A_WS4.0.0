/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : findPopup/frame.js
 ************************************************************************/
let oAPP = (function(window) {
    "use strict";

    let oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.events = {};
    oAPP.common = {};

    // 현재 비지 상태 
    oAPP.attr.isBusy = "";
    debugger;
    var REMOTE = require('@electron/remote'),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATH = REMOTE.require('path'),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        CURRWIN = REMOTE.getCurrentWindow();

    var oQueryParams = WSUTIL.QueryString.parse(location.href);

    var WEBCON = CURRWIN.webContents,
        USERINFO = oQueryParams.USERINFO,        
        LANGU = USERINFO.LANGU,
        SYSID = USERINFO.SYSID;

    oAPP.REMOTE = require('@electron/remote');
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.CURRWIN = oAPP.REMOTE.getCurrentWindow();
    oAPP.BROWSKEY = oQueryParams.browserkey;
    oAPP.USERDATA = oAPP.APP.getPath("userData");    
    oAPP.WSMSGPATH = PATH.join(APPPATH, "ws30", "ws10_20", "js", "ws_util.js"),
    oAPP.WSUTIL = require(oAPP.WSMSGPATH),
    oAPP.WSMSG = new oAPP.WSUTIL.MessageClassText(SYSID, LANGU);

    oAPP.common.fnGetMsgClsText = oAPP.WSMSG.fnGetMsgClsText.bind(oAPP.WSMSG);


    /*******************************************************
     * 메시지클래스 텍스트 작업 관련 Object -- end
     *******************************************************/

    /*************************************************************
     * @function - 테마 정보를 구한다.
     *************************************************************/
    oAPP.fn.getThemeInfo = function (){
debugger;
        let oUserInfo = parent.process.USERINFO;
        let sSysID = oUserInfo.SYSID;
        
        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
        if(oAPP.FS.existsSync(sThemeJsonPath) === false){
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

    /***********************************************************
     * Busy 실행 여부 정보 리턴
     ***********************************************************/
    oAPP.fn.getBusy = function(){

        return oAPP.attr.isBusy;

    };


    /***********************************************************
     * 브라우저 처음 실행 시 보여지는 Busy Indicator
     ***********************************************************/
    oAPP.setBusyLoading = function(bIsShow) {

        var oLoadPg = document.getElementById("u4a_main_load");

        if (!oLoadPg) {
            return;
        }

        if (bIsShow == 'X') {
            oLoadPg.classList.remove("u4a_loadersInactive");
        } else {
            oLoadPg.classList.add("u4a_loadersInactive");
        }

    };
    

    /***********************************************************
     * Busy 켜기 끄기
     ***********************************************************/
    oAPP.fn.setBusyIndicator = function(bIsBusy, sOption) {

        oAPP.attr.isBusy = bIsBusy;

        var _ISBROAD = sOption?.ISBROAD || undefined;

        var oBusy = document.getElementById("u4aWsBusyIndicator");

        if (!oBusy) {
            return;
        }

        if (bIsBusy === "X") {

            oBusy.style.visibility = "visible";

            // 브라우저 창 닫기 버튼 비활성
            oAPP.CURRWIN.closable = false;

            //다른 팝업의 BUSY ON 요청 처리.
            if(typeof _ISBROAD === "undefined"){
                oAPP.broadToChild.postMessage({PRCCD:"BUSY_ON"});
            }      

        } else {
            oBusy.style.visibility = "hidden";

            // 브라우저 창 닫기 버튼 활성
            oAPP.CURRWIN.closable = true;

            //다른 팝업의 BUSY OFF 요청 처리.            
            if(typeof _ISBROAD === "undefined"){
                oAPP.broadToChild.postMessage({PRCCD:"BUSY_OFF"});
            }

        }

    };


    

    /************************************************************************
     * IPCRENDERER Events..
     ************************************************************************/
    oAPP.IPCRENDERER.on('if-find-info', (events, oInfo) => {        

        oAPP.attr.oUserInfo = oInfo.oUserInfo;
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo;
        oAPP.attr.aAttrData = oInfo.aAttrData;
        oAPP.attr.aServEvtData = oInfo.aServEvtData;
        oAPP.attr.aT_0022 = oInfo.aT_0022;

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {

            oAPP.fn.setBusyIndicator("");

            return;
        }

        oWs_frame.src = "index.html";

    });

    oAPP.fn.fnIpcMainFindSuccess = () => {

        oAPP.fn.setBusyIndicator('');

    };

    oAPP.IPCMAIN.on(`${oAPP.BROWSKEY}--find--success`, oAPP.fn.fnIpcMainFindSuccess);

    window.oAPP = oAPP;

    return oAPP;

})(window);