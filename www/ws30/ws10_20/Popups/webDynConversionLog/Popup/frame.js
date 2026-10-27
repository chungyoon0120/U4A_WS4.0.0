
/****************************************************************************
 * 🔥 Global Variables
 ****************************************************************************/

    // 부모의 oAPP 상속
    var oAPP = parent.oAPP;

    // 오류 감지 객체
    var WSERR = parent.require(parent.PATHINFO.WSTRYCATCH);

    // 오류 감지 및 zconsole
    var zconsole = WSERR(window, document, console);


/****************************************************************************
 * 🔥 BootStrap Load
 ****************************************************************************/

    let oSettings = parent.WSUTIL.getWsSettingsInfo(),
        oSetting_UI5 = oSettings.UI5,
        oBootStrap = oSetting_UI5.bootstrap,
        oThemeInfo = oAPP.fn.getThemeInfo();
        
    let oUserInfo = parent.USERINFO;
    let sLangu = oUserInfo.LANGU;

    let oScript = document.createElement("script");
        oScript.id = "sap-ui-bootstrap";
    
    for (const key in oBootStrap) {
        oScript.setAttribute(key, oBootStrap[key]);
    }
    
    oScript.setAttribute('data-sap-ui-theme', oThemeInfo.THEME);
    oScript.setAttribute("data-sap-ui-language", sLangu);
    oScript.setAttribute("data-sap-ui-libs", "sap.m, sap.ui.layout, sap.ui.table");
    oScript.setAttribute("src", oSetting_UI5.resourceUrl);

    document.head.appendChild(oScript);


/****************************************************************************
 * 🔥 Private functions
 ****************************************************************************/


    /********************************************************************
     * @function - 랜덤 문자열 구성.
     ********************************************************************/
    function _getRandomValue(length = 8) {

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let str = '';

        for (let i = 0; i < length; i++) {
            str += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return str;

    } // end of _getRandomValue


    /***********************************************************************
     * @function - 브라우저 창을 닫을 때 Broadcast로 busy 끄라는 지시를 한다.
     ***********************************************************************/
    function _setBroadCastBusy(){

        // 브라우저 닫는 시점에 busy가 켜있을 경우
        if(oAPP.fn.getBusy() === "X"){

            // 브로드 캐스트로 다른 팝업의 BUSY 요청 처리.
            oAPP.broadToChild.postMessage({ PRCCD:"BUSY_OFF" });

            return;

        }

        if(typeof window?.sap?.m?.InstanceManager?.getOpenDialogs !== "function"){
            return;
        }

        // 현재 호출된 dialog 정보 얻기.
        var _aDialog = sap.m.InstanceManager.getOpenDialogs();

        //호출된 dialog가 없다면 exit.
        if(typeof _aDialog === "undefined" || _aDialog?.length === 0){
            return;
        }

        // 내가 띄운 MessageBox 가 있을 경우 Busy OFF
        if(_aDialog.findIndex( item => typeof item.getType === "function" && 
            item.getType() === "Message") !== -1){
            
            // 브로드 캐스트로 다른 팝업의 BUSY 요청 처리.
            oAPP.broadToChild.postMessage({PRCCD:"BUSY_OFF"});

            // 화면이 다 그려지고 난 후 메인 영역 Busy 끄기
            parent.IPCRENDERER.send(`if-send-action-${parent.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); 

        }

    } // end of _setBroadCastBusy



    /*************************************************************
     * @function - 공통 ajax
     *************************************************************/
    function _sendAjax(sUrl, oFormData, oOptions) {

        return new Promise(function (resolve, reject) {

            let iTimeout = 10 * 60 * 1000; // 600_000 ms

            if (oOptions && typeof oOptions.iTimeout === "number") {
                iTimeout = oOptions.iTimeout; // ✅ 옵션 반영
            }

            // ajax 결과
            var oResult = undefined;

            jQuery.ajax({
                async: true,
                method: "POST",
                url: sUrl,
                data: oFormData,
                cache: false,
                timeout: iTimeout,
                contentType: false,
                processData: false,
                success: function (data, textStatus, xhr) {

                    oResult = { success: true, data: data, status: textStatus, statusCode: xhr && xhr.status, xhr: xhr };

                    // status 값이 있다면 서버에서 오류 발생
                    var u4a_status = oResult.xhr.getResponseHeader("u4a_status");

                    if (u4a_status) {

                        switch (u4a_status) {
                            case "UA0001": // 지원하지 않는 서비스

                                // 현재 서버는 이 기능을 지원하지 않으므로 U4A 팀에 문의하세요.
                                var sErrMsg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "390");

                                return reject({RETCD:"Z", RTMSG:sErrMsg });

                            default:

                                // 콘솔용 오류 메시지
                                var aConsoleMsg = [
                                    `[PATH]: www/ws10_20/Popups/webDynConversionLog/Popup/frame.js`,
                                    `=> _sendAjax`,
                                    `=> success callback`,
                                    `=> response header에 'u4a_status' 값이 ${u4a_status} 값으로 날라옴.`,
                                    `=> REQ_URL : ${sUrl}`,
                                ];

                                console.error(aConsoleMsg.join("\r\n"));
                                console.trace();

                                // 알 수 없는 오류가 발생하였습니다. 문제가 지속될 경우 U4A 팀에 문의하세요.
                                var sErrMsg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391");

                                return reject({RETCD:"Z", RTMSG:sErrMsg });
                        }

                    }

                    return resolve(oResult.data);

                },
                error: function (xhr, textStatus, error) {

                    oResult = { success: false, data: undefined, status: textStatus, error: error, statusCode: xhr.status, errorResponse: xhr.responseText, xhr: xhr };

                    // 콘솔용 오류 메시지
                    var aConsoleMsg = [
                        `[PATH]: www/ws10_20/Popups/webDynConversionLog/Popup/frame.js`,
                        `=> _sendAjax`,
                        `=> error callback`,
                        `=> REQ_URL : ${sUrl}`,
                    ];

                    console.error(aConsoleMsg.join("\r\n"));
                    console.trace();

                    // 알 수 없는 오류가 발생하였습니다.
                    // 다시시도하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                    var sErrMsg = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") + "\n\n" +
                        parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "290");

                    // 연결 실패일 경우
                    if (oResult.success === false) {

                        // 통신 오류가 발생하였습니다. 네트워크 상태를 확인하시고 문제가 지속 될 경우 U4A 팀에 문의하세요.
                        
                        return reject({RETCD:"Z", sErrMsg });


                    }

                    // 통신 오류가 발생하였습니다. 네트워크 상태를 확인하시고 문제가 지속 될 경우 U4A 솔루션 팀에 문의하세요.
                    return reject({RETCD:"Z", RTMSG:parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "391") });

                }
            });

        });

    } // end of _sendAjax


    /*************************************************************
     * @function - SYSID에 해당하는 테마 변경 IPC 이벤트
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange(){

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if(!oThemeInfo){
            return;
        }

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        let oBrowserWindow = parent.REMOTE.getCurrentWindow();
            // 2026-10-27 Electron 45: 창을 만들자마자 넣으면 화면이 없어 깨진다 — 화면이 들어간 뒤에 넣는다.
            parent.REMOTE.getGlobal("u4aSetWindowCss")(oBrowserWindow, sWebConBodyCss);

        sap.ui.getCore().applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange


    /*************************************************************
     * @function - IPC Event 등록
     *************************************************************/
    function _attachIpcEvents(){

        let oUserInfo = parent.USERINFO;
        let sSysID = oUserInfo.SYSID;

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
        parent.IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange); 

    } // end of _attachIpcEvents


    /*************************************************************
     * @function - IPC Event 해제
     *************************************************************/
    function _detachIpcEvents(){

        let oUserInfo = parent.USERINFO;
        let sSysID = oUserInfo.SYSID;

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
        parent.IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange); 

    } // end of _detachIpcEvents    


    /***********************************************************************
     * @function - BroadCast Event 걸기
     ***********************************************************************/
    function _attachBroadCastEvent(){

        oAPP.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${parent.BROWSKEY}`);        

        oAPP.broadToChild.onmessage = function(oEvent){

            var _PRCCD = oEvent?.data?.PRCCD || undefined;

            if(typeof _PRCCD === "undefined"){
                return;
            }

            //프로세스에 따른 로직분기.
            switch (_PRCCD) {
                case "BUSY_ON":

                    //BUSY ON을 요청받은경우.
                    oAPP.fn.setBusy("X", { ISBROAD:true });
                    break;

                case "BUSY_OFF":
                    //BUSY OFF를 요청 받은 경우.
                    oAPP.fn.setBusy("",  { ISBROAD:true });
                    break;

                default:
                    break;
            }

        };

    } // end of _attachBroadCastEvent


/****************************************************************************
 * 🔥 Public functions
 ****************************************************************************/

    /********************************************************************
     * @function - Busy 켜기 끄기
     ********************************************************************
     * sOption
     * - 옵션에 ISBROAD 값이 있으면, 
     *   내 브라우저의 BroadCast onMessage 이벤트에서 Busy를 킨 것으로,
     *   그럴때는 나만 Busy 키고 다시 BrodCast의 PostMessage를 하지 않는다.
     *********************************************************************/
    oAPP.fn.setBusy = (isBusy, sOption) => {

        oAPP.attr.isBusy = isBusy;

        if (isBusy === "X") {

            // 화면 Lock 걸기
            sap.ui.getCore().lock();

            // 브라우저 창 닫기 버튼 비활성
            parent.CURRWIN.closable = false;

            sap.ui.core.BusyIndicator.show(0);      

        } else {

            // 브라우저 창 닫기 버튼 활성
            parent.CURRWIN.closable = true;

            sap.ui.core.BusyIndicator.hide();

            // 화면 Lock 해제
            sap.ui.getCore().unlock();

        }

        // var _ISBROAD = sOption?.ISBROAD || undefined;
        // if(typeof _ISBROAD !== "undefined"){
        //     return;
        // }

        // if(isBusy === "X"){

        //     oAPP.broadToChild.postMessage({PRCCD:"BUSY_ON"});

        // } else {

        //     oAPP.broadToChild.postMessage({PRCCD:"BUSY_OFF"});

        // }
  
    }; // end of oAPP.fn.setBusy



/****************************************************************************
 * ⚡ window Events
 ****************************************************************************/
window.addEventListener("load", function(){

    // BroadCast Event 걸기
    _attachBroadCastEvent();

    // Events after UI5 CORE libraries have been loaded.
    sap.ui.getCore().attachInit(async () => {

        oAPP.fn.setBusy("X");

        // IPC Event 등록
        _attachIpcEvents();

        parent.CURRWIN.show();

        parent.CURRWIN.setOpacity(1);

        // parent.WSUTIL.setBrowserOpacity(parent.CURRWIN); 

        let sViewPath = parent.PATH.join(parent.__dirname, "views", "vw_main", "view.js");

        const oRes = await import(sViewPath);
        const oView = await oRes.getView();

        oAPP.views.VW_MAIN = {};
        oAPP.views.VW_MAIN = oView;

        let oMainAPP = oAPP.views.VW_MAIN.ui.APP;

        let oDelegate = {
            onAfterRendering: async function(){

                oMainAPP.removeEventDelegate(oDelegate);
                
                let oContentDom = document.getElementById("content");

                jQuery(oContentDom).fadeIn({ duration: 1500 });                

                await oAPP.views.VW_MAIN.onViewReady();

            }
        };


        oMainAPP.addEventDelegate(oDelegate);

        oMainAPP.placeAt("content");

    });

});


/************************************************************************
 * window 창 닫을때 호출 되는 이벤트
 ************************************************************************/
window.onbeforeunload = function() {

    // Busy가 실행 중이면 창을 닫지 않는다.
    if(oAPP.fn.getBusy() === "X"){
        return false;
    }

    // 브라우저 창을 닫을 때 Broadcast로 busy 끄라는 지시를 한다.
    _setBroadCastBusy();

};

/************************************************************************
 * 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 이벤트
 ************************************************************************/
parent.window.addEventListener('pagehide', function(){

	// IPC Event 해제
	_detachIpcEvents();

},{ once: true });