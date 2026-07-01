/************************************************************************
 * Global Variable
 ************************************************************************/
var REMOTE = require('@electron/remote');
var CURRWIN = REMOTE.getCurrentWindow();
var PATH = REMOTE.require('path');
var APP = REMOTE.app;
var APPPATH = APP.getAppPath();
var IPCRENDERER = require('electron').ipcRenderer;
var PATHINFOURL = PATH.join(APPPATH, "ws30", "resources", "pathInfo.js");
var PATHINFO = require(PATHINFOURL);
var WSUTIL = require(PATHINFO.WSUTIL);
var WSERR = require(PATHINFO.WSTRYCATCH);




// 브라우저의 쿼리 스트링 정보
const oQueryParams = WSUTIL.QueryString.parse(location.href);

var zconsole = WSERR(window, document, console);

var oAPP = {};
oAPP.fn = {};
oAPP.attr = {};

// 현재 비지 상태 
oAPP.attr.isBusy = false;

oAPP.REMOTE = require('@electron/remote');
oAPP.IPCRENDERER = require('electron').ipcRenderer;
oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
oAPP.PATH = oAPP.REMOTE.require('path');
oAPP.FS = oAPP.REMOTE.require('fs');
oAPP.APP = oAPP.REMOTE.app;
oAPP.USERDATA = oAPP.APP.getPath("userData");
oAPP.BROWSKEY = oQueryParams.browserkey;

/************************************************************************
 * IPC 통신
 ************************************************************************/
IPCRENDERER.on("if-ui5css-info", function (events, oInfo) {

    let oWs_frame = document.getElementById("ws_frame");
    if (!oWs_frame) {
        return;
    }

    oAPP.attr.IF_DATA = oInfo;

    // 로컬스토리지에 저장할때의 키값에 들어갈 prefix
    oAPP.attr.IF_DATA.STORAGE_KEY_PREFIX = "PRE_CSS";

    oWs_frame.src = "index.html";

});

/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function () {

    let oUserInfo = parent.process.USERINFO;
    let sSysID = oUserInfo.SYSID;

    // 해당 SYSID별 테마 정보 JSON을 읽는다.
    let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
    if (oAPP.FS.existsSync(sThemeJsonPath) === false) {
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

/************************************************************************
 * 부모의 APP Object 전달
 ************************************************************************/
function fnGetApp() {

    return oAPP;

}

// 현재 Busy 실행 여부
function fnGetBusy() {

    return oAPP.attr.isBusy;

}
