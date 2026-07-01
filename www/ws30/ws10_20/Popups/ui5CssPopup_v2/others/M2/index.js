/************************************************************************
 * Global Variable
 ************************************************************************/

var oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.common = {};

var REMOTE = require('@electron/remote'),
    PATH = REMOTE.require('path'),
    CURRWIN = REMOTE.getCurrentWindow(),    
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = require(PATHINFO.WSUTIL),
    WSERR = require(PATHINFO.WSTRYCATCH);   

var zconsole = WSERR(window, document, console);

// 브라우저의 쿼리 스트링 정보
const oQueryParams = WSUTIL.QueryString.parse(location.href);

var USERINFO = oQueryParams.USERINFO,
    LANGU = USERINFO.LANGU,
    SYSID = USERINFO.SYSID;

var WSMSGPATH = PATH.join(APPPATH, "ws30", "ws10_20", "js", "ws_util.js"),
    WSUTIL = require(WSMSGPATH),
    WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

oAPP.REMOTE = require('@electron/remote');
oAPP.IPCRENDERER = require('electron').ipcRenderer;
oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
oAPP.PATH = oAPP.REMOTE.require('path');
oAPP.FS = oAPP.REMOTE.require('fs');
oAPP.APP = oAPP.REMOTE.app;
oAPP.USERDATA = oAPP.APP.getPath("userData");

var IF_DATA = undefined;

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

document.addEventListener('DOMContentLoaded', function () {

    var oURL = new URL(location.href);
    var oSrchParam = oURL.searchParams;

    // 브로드캐스트 channal Id
    let sChennalId = oSrchParam.get('browskey') + oSrchParam.get('mid');

    // 브로드캐스트 객체 생성
    window.broadcast = new BroadcastChannel(sChennalId);

    // 브로드캐스트 메시지 수신
    window.broadcast.onmessage = function (e) {

        // console.log(e.data);

        var oBrodData = e.data;

        /*********************************************************************
         * 디테일 영역의 iframe에 로드 후 새창을 열면 broadcast가 둘다 수신되는데
         * 디테일 영역의 iframe은 이미 화면이 로드된 상태에서 또 수신받으면
         * 화면을 갱신하는 현상으로 iframe의 src가 없을 때에만 src를 지정함.
         *********************************************************************/

        let oIframe = document.getElementById("detail_frame");
        if (oIframe.src !== "") {
            return;
        }

        IF_DATA = oBrodData;

        oIframe.src = "frame.html";

    };

});

/************************************************************************
 * 부모의 APP Object 전달
 ************************************************************************/
function fnGetApp() {

    return oAPP;

}

window.onbeforeunload = function () {

    // 브로드캐스트 객체가 있으면 종료 후 삭제한다.
    if (window.broadcast) {
        window.broadcast.close();
        delete window.broadcast;
    }

    // console.log('end');    

};
