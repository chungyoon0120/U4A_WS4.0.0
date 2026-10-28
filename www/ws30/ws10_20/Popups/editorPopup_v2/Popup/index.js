
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
    var WSUTIL_PATH = PATH.join(APPPATH, "ws30", "ws10_20", "js", "ws_util.js");
    var WSUTIL = require(WSUTIL_PATH);

    // 브라우저의 쿼리 스트링 정보
    //   [2026-10-28 장군님 지시] Electron 45 에서 webContents.getWebPreferences() 가 없어져
    //   browserkey · USERINFO 를 그 쪽에서 못 받는다. 창을 여는 editorPopup_v2/index.js 가
    //   같은 값을 주소 쿼리로 넘겨 주므로, 다른 별창과 같은 방식으로 여기서 읽는다.
    const oQueryParams = WSUTIL.QueryString.parse(location.href);

    var BROWSKEY = oQueryParams.browserkey;
    var USERINFO = oQueryParams.USERINFO;
    // SYSID 는 쿼리 문자열 우선(객체 직렬화 깨짐 방어) — 테마 JSON 경로에 쓴다.
    var SYSID = oQueryParams.SYSID || (USERINFO && USERINFO.SYSID) || "";

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

        // [2026-10-28] SYSID 는 위에서 쿼리 문자열로 따로 받은 것을 쓴다.
        //   USERINFO(객체)만 믿으면 쿼리 직렬화가 깨졌을 때 테마 JSON 경로가 어긋난다.
        let sSysID = SYSID;
        
        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
        if(FS.existsSync(sThemeJsonPath) === false){
            return;
        }

        let sThemeJson = FS.readFileSync(sThemeJsonPath, "utf-8");

        try {
        
            var oThemeJsonData = JSON.parse(sThemeJson);    

        } catch (error) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
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
    IPCRENDERER.on('if-version-management', (events, oInfo) => {

        var oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        oWs_frame.src = "frame.html";

    });
