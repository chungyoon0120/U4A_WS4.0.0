
/************************************************************************
 * Global Variable
 ************************************************************************/

var oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.common = {};

    oAPP.REMOTE = require('@electron/remote');
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.USERDATA = oAPP.APP.getPath("userData");

    var CURRWIN = oAPP.REMOTE.getCurrentWindow();
    
    var APP = oAPP.REMOTE.app;
    var APPPATH = APP.getAppPath();
    var PATHINFO = require(oAPP.PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));
    var WSUTIL = require(PATHINFO.WSUTIL);

    // 브라우저의 쿼리 스트링 정보
    const oQueryParams = WSUTIL.QueryString.parse(location.href);

    var USERINFO = oQueryParams.USERINFO;
    var LANGU = USERINFO.LANGU;
    var SYSID = USERINFO.SYSID;    

/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function () {

    let oUserInfo = USERINFO;
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


/*************************************************************
 * @function - IPC Event 등록
 *************************************************************/
function _attachIpcEvents() {

    // let oUserInfo = parent.process.USERINFO;
    let oUserInfo = USERINFO;
    let sSysID = oUserInfo.SYSID;

    // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
    oAPP.IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);

} // end of _attachIpcEvents

/*************************************************************
 * @function - IPC Event 해제
 *************************************************************/
function _detachIpcEvents() {

    // let oUserInfo = parent.process.USERINFO;
    let oUserInfo = USERINFO;
    let sSysID = oUserInfo.SYSID;

    // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
    oAPP.IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);

} // end of _detachIpcEvents



/*************************************************************
 * @function - SYSID에 해당하는 테마 변경 IPC 이벤트
 *************************************************************/
function _onIpcMain_if_p13n_themeChange() {

    let oThemeInfo = oAPP.fn.getThemeInfo();
    if (!oThemeInfo) {
        return;
    }

    let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
    let oBrowserWindow = oAPP.REMOTE.getCurrentWindow();
    oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

    document.body.style.backgroundColor = oThemeInfo.BGCOL;

    // sap.ui.getCore().applyTheme(oThemeInfo.THEME);

} // end of _onIpcMain_if_p13n_themeChange 


window.addEventListener("DOMContentLoaded", function () {

    // IPC Event 등록
    _attachIpcEvents();

});

/************************************************************************
 * 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 이벤트
 ************************************************************************/
parent.window.addEventListener('pagehide', function(){

	// IPC Event 해제
	_detachIpcEvents();

},{ once: true });
