
/****************************************************************************
 * 🔥 Global Variables
 ****************************************************************************/
  
    var REMOTE = require('@electron/remote');
    var IPCMAIN = REMOTE.require('electron').ipcMain;
    var IPCRENDERER = require('electron').ipcRenderer;
    var PATH = REMOTE.require('path');
    var APP = REMOTE.app;
    var APPPATH = APP.getAppPath();
    var CURRWIN = REMOTE.getCurrentWindow();
    var USERDATA = APP.getPath("userData");	
    var FS = REMOTE.require('fs');
    var PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));    
    var WSUTIL = require(PATHINFO.WSUTIL);

    // 브라우저의 쿼리 스트링 정보
    const oQueryParams = WSUTIL.QueryString.parse(location.href);

    var BROWSKEY = oQueryParams.browserkey;
    var USERINFO = oQueryParams.USERINFO;
    var SYSID = USERINFO.SYSID;
    var LANGU = USERINFO.LANGU;
    var WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

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

    // 메시지 텍스트 관련 공통 function
    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

    // 현재 비지 상태 
    oAPP.attr.isBusy = "";


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
    IPCRENDERER.on('if-version-management', (events, IF_DATA) => {

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        oAPP.IF_DATA = IF_DATA;

        // // 어플리케이션 정보
        // oAPP.attr.oAppInfo = IF_DATA.oAppInfo;

        oWs_frame.src = "frame.html";

    });
