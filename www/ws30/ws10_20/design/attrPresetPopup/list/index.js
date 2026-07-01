/**
 * index.js
 * Cordova Electron + SAPUI5 기반 초기화 진입점
 *
 * - 유니코드 모음
 * 🟩🟦🟪🟫⬛🟧🟨🟥⬜
 * 🔥⚡
 */


/****************************************************************************
 * 🔥 Imports & Global Variables
 ****************************************************************************/

var REMOTE      = require('@electron/remote');
var IPCMAIN     = REMOTE.require('electron').ipcMain;
var IPCRENDERER = require('electron').ipcRenderer;
var PATH        = REMOTE.require('path');
var APP         = REMOTE.app;
var APPPATH     = APP.getAppPath();
var PATHINFO    = require(PATH.join(APPPATH, "ws30", "resources", 'pathInfo.js'));
var WSUTIL      = require(PATHINFO.WSUTIL);
var CURRWIN     = REMOTE.getCurrentWindow();
var USERDATA    = APP.getPath('userData');
var FS          = REMOTE.require('fs');

// 브라우저의 쿼리 스트링 정보
const oQueryParams = WSUTIL.QueryString.parse(location.href);

var BROWSKEY    = oQueryParams.browserkey;
var USERINFO    = oQueryParams.USERINFO;
var WSMSG       = new WSUTIL.MessageClassText(USERINFO.SYSID, USERINFO.LANGU);

// 오류 감지 객체
var WSERR = require(PATHINFO.WSTRYCATCH);

// 오류 감지 및 zconsole
var zconsole = WSERR(window, document, console);


/****************************************************************************
 * 🔥 App Namespace 초기화
 ****************************************************************************/

var oAPP = {
    attr   : { isBusy: '' },
    msg    : {},
    common : {},
    util   : {},
    fn     : {},
    views  : {},
    ui     : {},
    DATA   : {
        LIB : {
            LIBVER : "",
            T_0022 : [],
            T_0023 : [],
            T_0024 : [],
            T_9011 : [],
        },
        APPDATA : {
            T_CEVT : []
        }
    }
};


// 메시지 텍스트 관련 공통 function
oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);


/******************************************************************************
 * 🔥 UI5와 Electron Node의 충돌 방지 로직
 *    - UI5 bootstrap 로드 전 글로벌 require/module 을 제거하고,
 *      attachInit 이후 _restoreNodeGlobals() 로 복구한다.
 ******************************************************************************/

(function () {
    if (typeof module !== 'object' || typeof require !== 'function') {
        return;
    }

    console.log('[System] Node environment detected. Isolating global variables for UI5 bootstrap...');

    window.__node = {
        require : window.require,
        module  : window.module,
        exports : window.exports
    };

    window.require = undefined;
    window.module  = undefined;
    window.exports = undefined;
}());


/****************************************************************************
 * 🟥 Private Functions
 ****************************************************************************/


/***********************************************************************
 * @function - 브라우저 창을 닫을 때 Broadcast로 busy 끄라는 지시를 한다.
 ***********************************************************************/
function _setBroadCastBusy() {

    // 브라우저 닫는 시점에 busy가 켜있을 경우
    if (oAPP.fn.getBusy() === 'X') {
        oAPP.broadToChild.postMessage({ PRCCD: 'BUSY_OFF' });
        return;
    }

    if (typeof window?.sap?.m?.InstanceManager?.getOpenDialogs !== 'function') {
        return;
    }

    // 현재 호출된 dialog 정보 얻기
    var aDialog = sap.m.InstanceManager.getOpenDialogs();

    // 호출된 dialog가 없다면 exit
    if (!aDialog || aDialog.length === 0) {
        return;
    }

    // 내가 띄운 MessageBox가 있을 경우 Busy OFF
    var hasMessageBox = aDialog.findIndex(function (item) {
        return typeof item.getType === 'function' && item.getType() === 'Message';
    }) !== -1;

    if (hasMessageBox) {
        // 브로드캐스트로 다른 팝업의 BUSY 요청 처리
        oAPP.broadToChild.postMessage({ PRCCD: 'BUSY_OFF' });

        // 화면이 다 그려지고 난 후 메인 영역 Busy 끄기
        parent.IPCRENDERER.send(`if-send-action-${parent.BROWSKEY}`, { ACTCD: 'SETBUSYLOCK', ISBUSY: '' });
    }

} // end of _setBroadCastBusy


/*************************************************************
 * @function - Node 글로벌 변수를 백업본으로부터 복구한다.
 *             UI5 attachInit 이후 호출.
 *************************************************************/
function _restoreNodeGlobals() {

    if (!window.__node) {
        return;
    }

    console.log('[System] Restoring Node environment variables...');

    window.require = window.__node.require;
    window.module  = window.__node.module;
    window.exports = window.__node.exports;

    delete window.__node;

} // end of _restoreNodeGlobals


/*************************************************************
 * @function - SYSID에 해당하는 테마 변경 IPC 이벤트 핸들러
 *************************************************************/
function _onIpcMain_if_p13n_themeChange() {

    let oThemeInfo = oAPP.fn.getThemeInfo();
    if (!oThemeInfo) {
        return;
    }

    let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
    parent.REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);
    sap.ui.getCore().applyTheme(oThemeInfo.THEME);

} // end of _onIpcMain_if_p13n_themeChange


/*************************************************************
 * @function - SYSID에 해당하는 MAIN -> 팝업 통신 이벤트 핸들러
 *************************************************************/
function _onIpcRender_if_attrPresetPopup(events, data){
    
    switch (data.PRCCD) {
        case "ATTR_CHANGE":
            // 속성 변경이 발생했을 때 리스트 새로고침
            oAPP.views.VW_MAIN.fn.refreshPresetData(data.DATA);
            break;


        case "U4A_HELP_DOCUMENT_OPEN":
            //U4A 도움말 문서 팝업 오픈 완료건인경우.
            // Busy Off
            oAPP.fn.setBusy("");
            break;

        case "UI5_THEME_CHANGE":
            _onIpcMain_if_p13n_themeChange();
            break;
    
        default:
            break;
    }

}


/*************************************************************
 * @function - IPC Event 등록
 *************************************************************/
function _attachIpcEvents() {

    const sSysID = parent.USERINFO.SYSID;

    // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
    IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);


} // end of _attachIpcEvents



/*************************************************************
 * @function - IPC Event 해제
 *************************************************************/
function _detachIpcEvents() {

    const sSysID = parent.USERINFO.SYSID;

    // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록 해제.
    IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);


} // end of _detachIpcEvents



/***********************************************************************
 * @function - BroadCast Event 걸기
 *             다른 팝업으로부터 BUSY_ON / BUSY_OFF 메시지를 수신한다.
 ***********************************************************************/
function _attachBroadCastEvent() {

    oAPP.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${parent.BROWSKEY}`);

    oAPP.broadToChild.onmessage = function (oEvent) {

        var _PRCCD = oEvent?.data?.PRCCD || undefined;

        if (typeof _PRCCD === 'undefined') {
            return;
        }

        // 프로세스에 따른 로직 분기
        switch (_PRCCD) {
            case 'BUSY_ON':
                oAPP.fn.setBusy('X', { ISBROAD: true });
                break;

            case 'BUSY_OFF':
                oAPP.fn.setBusy('', { ISBROAD: true });
                break;

            default:
                break;
        }

    };

} // end of _attachBroadCastEvent



/***********************************************************************
 * @function - 메인 뷰(view.js) 동적 로드 및 인스턴스 반환
 * @param {string} sRootPath - 현재 디렉터리 경로
 * @returns {Promise<object>}
 ***********************************************************************/
async function _loadMainView(sRootPath) {

    var sPath = sRootPath + '/views/vw_main/view.js';

    try {

        var oRes = await import(sPath);
        return await oRes.getView();

    } catch (error) {

        console.error(error);

        jQuery.sap.require('sap.m.MessageBox');

        // [MSG]
        let _sErrMsg = `[ view.js ] 화면을 구성하기 위한 리소스 로드 중 오류가 발생하였습니다\n문제가 지속될 경우 관리자에게 문의하세요.\n\n${sPath}`;

        sap.m.MessageBox.error(_sErrMsg);

        throw error;

    }

} // end of _loadMainView


/****************************************************************************
 * 🟩 Public Functions  (oAPP.fn)
 ****************************************************************************/


/*************************************************************
 * @function - 테마 정보를 구한다.
 *************************************************************/
oAPP.fn.getThemeInfo = function () {

    let sSysID = USERINFO.SYSID;

    // 해당 SYSID별 테마 정보 JSON을 읽는다.
    let sThemeJsonPath = PATH.join(USERDATA, 'p13n', 'theme_ws4', `${sSysID}.json`);

    if (!FS.existsSync(sThemeJsonPath)) {
        return;
    }

    try {
        return JSON.parse(FS.readFileSync(sThemeJsonPath, 'utf-8'));
    } catch (e) {
        return;
    }

}; // end of oAPP.fn.getThemeInfo


/***********************************************************
 * @function - Busy 실행 여부 정보 리턴
 ***********************************************************/
oAPP.fn.getBusy = function () {

    return oAPP.attr.isBusy;

}; // end of oAPP.fn.getBusy


/********************************************************************
 * @function - Busy 켜기 끄기
 ********************************************************************
 * sOption
 * - 옵션에 ISBROAD 값이 있으면,
 *   내 브라우저의 BroadCast onMessage 이벤트에서 Busy를 킨 것으로,
 *   그럴때는 나만 Busy 키고 다시 BrodCast의 PostMessage를 하지 않는다.
 *********************************************************************/
// oAPP.fn.setBusy = function (isBusy, sOption) {

//     oAPP.attr.isBusy = isBusy;

//     if (isBusy === 'X') {

//         // 화면 Lock 걸기
//         sap.ui.getCore().lock();

//         // 브라우저 창 닫기 버튼 비활성
//         parent.CURRWIN.closable = false;

//         sap.ui.core.BusyIndicator.show(0);

//     } else {

//         // 브라우저 창 닫기 버튼 활성
//         parent.CURRWIN.closable = true;

//         sap.ui.core.BusyIndicator.hide();

//         // 화면 Lock 해제
//         sap.ui.getCore().unlock();

//     }

// }; // end of oAPP.fn.setBusy




oAPP.fn.setBusy = function(bBusy, sOption){

    //BUSY ON/OFF 정보 광역화.
    oAPP.attr.isBusy = bBusy;

    var _ISBROAD = sOption?.ISBROAD || undefined;

    switch (bBusy) {
        case "X":
            //busy on.
            sap.ui.getCore().lock();

            sap.ui.core.BusyIndicator.show(0);

            var _oWin = REMOTE.getCurrentWindow();

            //윈도우 닫기버튼 비활성화 처리.
            _oWin.closable = false;

            //다른 팝업의 BUSY ON 요청 처리.
            //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
            if(typeof _ISBROAD === "undefined"){
                oAPP.broadToChild.postMessage({PRCCD:"BUSY_ON"});
            }
            
            break;

        case "":
            //busy off.
            sap.ui.core.BusyIndicator.hide();

            var _oWin = REMOTE.getCurrentWindow();

            //윈도우 닫기버튼 활성화 처리.
            _oWin.closable = true;

            sap.ui.getCore().unlock();

            //다른 팝업의 BUSY OFF 요청 처리.
            //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
            if(typeof _ISBROAD === "undefined"){
                oAPP.broadToChild.postMessage({PRCCD:"BUSY_OFF"});
            }

            break;
    }

};  //화면 busy 처리.


/****************************************************************************
 * 🔥 Window 이벤트 핸들러
 ****************************************************************************/

//#region window onload 이벤트 호출 함수
//#endregion
/***********************************************************************
 * @function - window load 이벤트 핸들러
 *             UI5 bootstrap 완료 후 common.js → view.js 순으로 로드한다.
 ***********************************************************************/
async function _window_onload() {

    // BroadCast Event 걸기
    _attachBroadCastEvent();


    // UI5 부트스트랩 로드 실패 처리
    if (typeof sap === 'undefined') {

        parent.CURRWIN.show();
        parent.CURRWIN.setOpacity(1);

        // console.error('[UI5 Bootstrap load fail]', sBootStrapUrl);

        // [MSG]
        let _sErrMsg = '화면 구성중 오류가 발생하였습니다\n문제가 지속될 경우 관리자에게 문의하세요.';
        alert(_sErrMsg);

        return;
    }

    // Events after UI5 CORE libraries have been loaded.
    sap.ui.getCore().attachInit(async () => {

        oAPP.fn.setBusy('X');

        // var oResourceModel = new sap.ui.model.resource.ResourceModel({
		// 	bundleName: "i18n_root.i18n.i18n",
		// 	supportedLocales: ["", "en"],
		// 	fallbackLocale: "",
        //     // async: true
		// });

		// // Assign the model object to the SAPUI5 core using the name "i18n"
		// sap.ui.getCore().setModel(oResourceModel, "i18n");      

        // IPC Event 등록
        _attachIpcEvents();

        
        const sSysID = parent.USERINFO.SYSID;

        //SYSID에 해당하는 MAIN -> 팝업 통신 이벤트 핸들러 등록.
        IPCRENDERER.on(`if-attrPresetPopup-${sSysID}`, _onIpcRender_if_attrPresetPopup);


        parent.CURRWIN.show();
        parent.CURRWIN.setOpacity(1);

        // Node 글로벌 변수 복구
        _restoreNodeGlobals();

        let sRootPath = __dirname;

        // ── 메인 뷰 JS 로드 ─────────────────────────────────────
        try {

            oAPP.views.VW_MAIN = await _loadMainView(sRootPath);

        } catch (e) {

            // Busy Off
            oAPP.fn.setBusy('');
            return;

        }

        // ── 뷰 렌더링 후 처리 ───────────────────────────────────
        let _oMainAPP = oAPP.views.VW_MAIN.ui.APP;

        let _oDelegate = {
            onAfterRendering: async function () {
                _oMainAPP.removeEventDelegate(_oDelegate);
                jQuery(document.getElementById('content')).fadeIn({ duration: 1500 });
                await oAPP.views.VW_MAIN.onViewReady();
            }
        };

        _oMainAPP.addEventDelegate(_oDelegate);
        _oMainAPP.placeAt('content');

    });

} // end of _window_onload


/***********************************************************************
 * @function - window beforeunload 이벤트 핸들러
 *             Busy 상태이면 창 닫기를 막는다.
 ***********************************************************************/
function _window_onbeforeunload() {

    // Busy가 실행 중이면 창을 닫지 않는다.
    if (oAPP.fn.getBusy() === 'X') {
        return false;
    }

    // 브라우저 창을 닫을 때 Broadcast로 busy 끄라는 지시를 한다.
    _setBroadCastBusy();

} // end of _window_onbeforeunload


/***********************************************************************
 * @function - 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 함수
 ***********************************************************************/
function _window_pagehide(){

    console.log("[System] Page is being hidden or unloaded. Performing cleanup...");

    // IPC Event 해제
    _detachIpcEvents();

} // end of _window_pagehide




/*********************************************************
 * ⚡ @event - window 창 닫을때 호출 되는 이벤트
 *********************************************************/
window.onbeforeunload = _window_onbeforeunload;


/*********************************************************
 * ⚡ @event - 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 이벤트
 *********************************************************/
window.addEventListener("pagehide", _window_pagehide, { once: true });


/****************************************************************************
 * 🔥 UI5 Bootstrap 삽입
 ****************************************************************************/

(function () {

    let oSettings    = parent.WSUTIL.getWsSettingsInfo();
    let oSetting_UI5 = oSettings.UI5;
    let oBootStrap   = oSetting_UI5.bootstrap;
    let oThemeInfo   = oAPP.fn.getThemeInfo();
    let sLangu       = parent.USERINFO.LANGU;

    let oScript = document.createElement('script');
    oScript.id  = 'sap-ui-bootstrap';

    // 기본 bootstrap 속성 주입
    for (const key in oBootStrap) {
        oScript.setAttribute(key, oBootStrap[key]);
    }

    // 추가 속성 설정
    oScript.setAttribute('data-sap-ui-theme',         oThemeInfo.THEME);
    oScript.setAttribute('data-sap-ui-language',      sLangu);
    oScript.setAttribute('data-sap-ui-libs',          'sap.m');
    oScript.setAttribute('src',                        oSetting_UI5.resourceUrl);
    // oScript.setAttribute('data-sap-ui-resourceroots', JSON.stringify({ i18n_root: './' }));

    document.head.appendChild(oScript);

}());


/****************************************************************************
 * 🔥 IPC 초기화
 *    메인 프로세스로부터 HANDLE_ON_INIT 신호를 받아 로드를 시작한다.
 ****************************************************************************/

function _ipcHandleOnInit(events, oInfo) {

    oAPP.DATA.LIB = oInfo.oLibData;
    oAPP.attr.oThemeInfo = oInfo.oThemeInfo;


    // 문서 로드 상태 체크 후 실행
    if (document.readyState === 'loading') {
        window.addEventListener('load', _window_onload);
    } else {
        _window_onload();
    }

} // end of _ipcHandleOnInit



/*********************************************************
 * ⚡ @event - IPC HANDLE_ON_INIT
 *********************************************************/
IPCRENDERER.once('HANDLE_ON_INIT', _ipcHandleOnInit);

