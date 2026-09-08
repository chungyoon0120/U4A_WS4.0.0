const oAPP = {
    fn: {},
    attr: {},
    common: {},
    onStart: function () {        

        const
            REMOTE = require('@electron/remote'),
            PATH = REMOTE.require('path'),
            CURRWIN = REMOTE.getCurrentWindow(),
            APP = REMOTE.app,
            APPPATH = APP.getAppPath(),
            PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
            WSUTIL = require(PATHINFO.WSUTIL);

        // 브라우저의 쿼리 스트링 정보
        const oQueryParams = WSUTIL.QueryString.parse(location.href);

        this.remote = REMOTE;
        this.IPCRENDERER = require('electron').ipcRenderer;
        this.PATH = this.remote.require('path');
        this.APP = this.remote.app;
        this.APPPATH = this.APP.getAppPath();
        this.PATHINFO = require(this.PATH.join(this.APPPATH, "ws30", "resources", "pathInfo.js"));
        this.CURRWIN = this.remote.getCurrentWindow();
        this.BROWSKEY = oQueryParams.browserkey;        
   
        const 
            USERINFO = oQueryParams.USERINFO,
            LANGU = USERINFO.LANGU,
            SYSID = USERINFO.SYSID,
            WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);


        oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

        // 브라우저 타이틀 적용
        let sTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B54"); // Release Note

        CURRWIN.setTitle(sTitle);

    },
    // CDN 여부 플래그
    fnGetIsCDN: () => {

        return oAPP.attr.ISCDN || "";

    }, // end of oAPP.fn.fnGetIsCDN

    // 서버 Path
    fnGetServerPath: () => {

        return oAPP.attr.sServerPath;

    },
    // end of oAPP.fn.fnGetServerPath

    /************************************************************************
     * WS의 설정 정보를 구한다.
     ************************************************************************/
    fnGetSettingsInfo: () => {

        // Browser Window option
        var oSettingsPath = oAPP.PATHINFO.WSSETTINGS,

            // JSON 파일 형식의 Setting 정보를 읽는다..
            oSettings = require(oSettingsPath);
        if (!oSettings) {
            return;
        }

        return oSettings;

    } // end of fnGetSettingsInfo

};

oAPP.REMOTE = REMOTE;
oAPP.PATH = oAPP.REMOTE.require('path');
oAPP.APP = oAPP.REMOTE.app;
oAPP.FS = oAPP.REMOTE.require('fs');
oAPP.USERDATA = oAPP.APP.getPath("userData");
oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;	



/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function (){

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


oAPP.attachIpcRender = () => {

    /************************************************************************
     * IPCRENDERER Events..
     ************************************************************************/
    oAPP.IPCRENDERER.on('if-relnote-info', (events, oInfo) => {

        oAPP.attr.oUserInfo = oInfo.USERINFO;
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo;
        oAPP.attr.sServerPath = oInfo.SERVPATH;
        oAPP.attr.ISCDN = oInfo.ISCDN;

        // oAPP.ISADM = oInfo.USERINFO.ISADM;
        oAPP.ISADM = "X";

        var oMainFrame = document.getElementById("mainFRAME");

        switch (oAPP.ISADM) {
            case "X":
                oMainFrame.src = "main.html";
                break;

            default:
                oMainFrame.src = "main_latest.html";
                break;
        }

    });

};

//Device ready 
document.addEventListener('DOMContentLoaded', onDeviceReady, false);

function onDeviceReady() {
    oAPP.onStart();
    oAPP.attachIpcRender();
}

function fn_getParent() {
    return oAPP;

}