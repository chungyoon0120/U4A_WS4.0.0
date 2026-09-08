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

var WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

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

/************************************************************************
 * HTML5 WS4 테마 키 → UI5 표준 테마명(sap_horizon/sap_horizon_dark)으로 단순화(다크/라이트).
 *   raw 키를 UI5 부트스트랩/applyTheme 에 넘기면 서버에 테마 CSS 없어 404 → 색 깨짐. (main 동일)
 ************************************************************************/
oAPP.fn.toUI5Theme = function (sKey, sBgCol) {
    var bDark = String(sKey || "").toLowerCase().indexOf("dark") !== -1;
    if (!bDark && sBgCol) {
        var s = String(sBgCol).trim().replace(/^#/, ""), r, g, b;
        if (/^[0-9a-f]{3}$/i.test(s)) { s = s.replace(/(.)/g, "$1$1"); }   // 3자리 단축 hex(#abc)→6자리
        var mHex = s.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (mHex) { r = parseInt(mHex[1], 16); g = parseInt(mHex[2], 16); b = parseInt(mHex[3], 16); }
        else {
            var mRgb = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (mRgb) { r = +mRgb[1]; g = +mRgb[2]; b = +mRgb[3]; }
        }
        if (typeof r === "number") { bDark = (0.299 * r + 0.587 * g + 0.114 * b) < 128; }
    }
    return bDark ? "sap_horizon_dark" : "sap_horizon";
}; // end of oAPP.fn.toUI5Theme

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

        // [HTML5 2026-07-24] 속화면(frame.html)에도 테마색(BGCOL)·테마명(THEME) 전달 — 안 넘기면 iframe 이
        //   UI5 로드 전 흰색으로 떠 흰 번쩍. frame.html <head> 부트 스크립트가 이 값으로 첫 페인트 배경을 칠한다.
        var sBootBg = oQueryParams.BGCOL || "";
        var sBootTheme = oQueryParams.THEME || "";
        // 숨겨둔 속화면을 내용 로드 완료 시 표시(그전까진 부모 테마색). onload 를 src 지정 전에 걸어 누락 방지.
        oIframe.onload = function () { oIframe.style.visibility = "visible"; };
        oIframe.src = "frame.html?BGCOL=" + encodeURIComponent(sBootBg) + "&THEME=" + encodeURIComponent(sBootTheme);

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
