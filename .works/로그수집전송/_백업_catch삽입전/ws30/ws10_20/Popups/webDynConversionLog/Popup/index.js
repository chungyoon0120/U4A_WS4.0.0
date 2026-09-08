
/****************************************************************************
 * 🔥 Global Variables
 ****************************************************************************/

    var REMOTE = require('@electron/remote');
    var IPCMAIN = REMOTE.require('electron').ipcMain;
    var IPCRENDERER = require('electron').ipcRenderer;
    var PATH = REMOTE.require('path');
    var APP = REMOTE.app;
    var APPPATH = APP.getAppPath();
    var PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));  
    var WSUTIL = require(PATHINFO.WSUTIL);
    var CURRWIN = REMOTE.getCurrentWindow();
    var USERDATA = APP.getPath("userData");	
    var FS = REMOTE.require('fs');

    // 브라우저의 쿼리 스트링 정보
    const oQueryParams = WSUTIL.QueryString.parse(location.href);
    
    var BROWSKEY = oQueryParams.browserkey;
    var USERINFO = oQueryParams.USERINFO;

    var WSMSG = new WSUTIL.MessageClassText(USERINFO.SYSID, USERINFO.LANGU);

    // 오류 감지 객체
    var WSERR = require(PATHINFO.WSTRYCATCH);

    // 오류 감지 및 zconsole
    var zconsole = WSERR(window, document, console);

    var oAPP = {};
        oAPP.attr = {};
        oAPP.msg = {};
        oAPP.common = {};
        oAPP.fn = {};
        oAPP.views = {};
        oAPP.ui = {};


    oAPP.PATH = PATH;
    oAPP.FS = FS;

    oAPP.APPPATH = APPPATH;
    oAPP.CURRWIN = CURRWIN;

    oAPP.WSUTIL = WSUTIL;

    // 메시지 텍스트 관련 공통 function
    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

    // 현재 비지 상태 
    oAPP.attr.isBusy = "";

    //호출처로 부터 전달받은 파라메터 광역 정보.
    oAPP.attr.oOptionData = undefined;


/****************************************************************************
 * 🔥 Public functions
 ****************************************************************************/


    /*************************************************************
     * @function - 테마 정보를 구한다.
     *************************************************************/
    oAPP.fn.getThemeInfo = function (){

        let oUserInfo = USERINFO;
        let sSysID = oUserInfo.SYSID;
        
        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
        if(FS.existsSync(sThemeJsonPath) === false){
            return;
        }

        let sThemeJson = FS.readFileSync(sThemeJsonPath, "utf-8");

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

    }; // end of oAPP.fn.getBusy


    /************************************************************************
     * IPCRENDERER Events..
     ************************************************************************/
    IPCRENDERER.on('if_webDynConversionLog', (events, oOptionData) => {

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        //호출처로 부터 전달받은 파라메터 정보 광역화.
        oAPP.attr.oOptionData = oOptionData;

        oWs_frame.src = "frame.html";

    });
