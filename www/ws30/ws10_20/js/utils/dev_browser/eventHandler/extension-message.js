/* 
*📦----------------------------------------------------------------------*
* Module       : extension-message.js
* Creator      : SOCCERHS
* Created On   : 2026-02-03
* Description  : extension에서 전송된 파라미터의 액션별 수행 프로세스
*----------------------------------------------------------------------*
*/

/****************************************************************************
 * 🌐 Global Variables
 ****************************************************************************/
const oInjectScripts = require("../runtime-injections/index.js");
const { CLIpcHandler } = require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "ipc-handler"));

const IPCRENDERER = parent.IPCRENDERER;

const BROWSER_KEY = parent.getBrowserKey(); // 현재 브라우저의 고유 키
const ACTION_MAP = new Map();
const IPC_HANDLER = new CLIpcHandler();     // IPC 핸들러 인스턴스

const SERVER_INFO = parent.getServerInfo(); // 서버의 접속 정보

/****************************************************************************
 * 🔒 Private functions
 ****************************************************************************/

/** 브라우저 키 검증 헬퍼 */
function _isValidBrowserKey(key) {
    return key === BROWSER_KEY;
}

/****************************************************************************
 * ⚡ACTION MAPS
 ****************************************************************************/

/**
 * Extension Side Panel 다 열었다고 콜백이 오면 호출한 영역으로 custom Event 발생시킨다.
 */
ACTION_MAP.set('OPEN_EXTENSION_CB', async function (message) {

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    let oPayload = message.payload;
    let callbackId = oPayload.callbackId;

    await oDevBrowser.executeScript(oInjectScripts.Extension.fireCallback(callbackId, oPayload));

});



function _openBusyDialog(options = {}){
    
    let oSendParams =  { 
        PRCCD: "01", 
        SYSID: SERVER_INFO.SYSID, 
        CLIENT: SERVER_INFO.CLIENT, 
        OPTIONS: {
            illustrationType: "tnt-Radar",
            illustrationSize: "Dialog",
            ...options
        }
    };

    IPCRENDERER.send("if-browser-interconnection", oSendParams);

} // end of _openBusyDialog

function _closeBusyDialog(options = {}){
    
    let oSendParams =  { 
        PRCCD: "02", 
        SYSID: SERVER_INFO.SYSID, 
        CLIENT: SERVER_INFO.CLIENT, 
        OPTIONS: {
            illustrationType: "tnt-Radar",
            illustrationSize: "Dialog",
            ...options
        }
    };

    IPCRENDERER.send("if-browser-interconnection", oSendParams);
    
} // end of _openBusyDialog


/**
 * Workspace 실행!
 */
ACTION_MAP.set('EXEC_U4A_WORKSPACE', async function (message) {

    // Busy Dialog 실행!
    _openBusyDialog({ title: "새 브라우저 실행", description: "Workspace 새 브라우저가 실행 중입니다... 잠시만 기다려주세요..." });

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    let oPayload = message.payload;
    let sAPPID = oPayload.APPID;

    let fnBindWsMainUiUpdated = async function (event, oParams) {

        // 같은 세션키가 아니라면 빠져나감
        if(parent.getSessionKey() !== oParams.sessionKey){
            console.log("different session - skipped");
            return;
        }

        IPC_HANDLER.off("WS_MAIN_UI_UPDATED", fnBindWsMainUiUpdated);

        // extension 영역에 busy 끄라고 알려준다.
        let oSendParams = {
            target: "EXT_SIDE_VIEW",
            action: "SET_BUSY",
            payload: {
                BUSY: false
            }
        };

        await oDevBrowser.executeScript(oInjectScripts.Extension.sendParams(oSendParams));

        _closeBusyDialog();

    }.bind(this);

    // Workspace 새창 실행 후 메인(10번) 페이지가 로드가 완료될때 호출됨.
    // IPC_HANDLER.once("WS_MAIN_UI_UPDATED", fnBindWsMainUiUpdated);
    IPC_HANDLER.on("WS_MAIN_UI_UPDATED", fnBindWsMainUiUpdated);

    let oIF_DATA = {
        ACTCD: "MOVE20",    // 새창 띄우면서 20번으로 넘어가는 액션 코드
        APPID: sAPPID,      // 실행 어플리케이션명
    };

    // 새창 띄우면서 APPID에 대한 20번 페이지로 이동
    parent.onNewWindow(oIF_DATA);

});



/**
 * 컨트롤러 실행 액션
 */
ACTION_MAP.set('EXEC_CONTROLLER_CLASS', async function (message) {

    // console.warn("컨트롤러 실행해줘!!!");

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    let oPayload = message.payload;

    let oAppInfo = {
        APPID: oPayload.APPID,
        IS_EDIT: oPayload.IS_EDIT || ""
    };

    let fnBindExecControllerClass = async function (event, oParams) {

        if (!_isValidBrowserKey(oParams.browserKey)) return;

        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        let sStatus = oParams?.status || "";
        if (!sStatus || sStatus !== "finish") {
            return;
        }

        IPC_HANDLER.off("execControllerClass", fnBindExecControllerClass);

        let oSendParams = {
            target: "EXT_SIDE_VIEW",
            action: "EXEC_CONTROLLER_CLASS",
            payload: oParams
        };

        await oDevBrowser.executeScript(oInjectScripts.Extension.sendParams(oSendParams));

    }.bind(this);

    // 컨트롤러 클래스 실행 상태 관련 command 이벤트 걸기
    IPC_HANDLER.on("execControllerClass", fnBindExecControllerClass);

    // 컨트롤러 클래스 실행!
    oAPP.common.execControllerClass(oPayload.SEVENT, "", "", oAppInfo);

});


/**
 * 서버 이벤트가 걸려있는 UI 마킹 표시 
 */
ACTION_MAP.set("SERVER_EVENT_HIGHLIGHT_APPLY", async function (message) {

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    await oDevBrowser.executeScript(oInjectScripts.ServerEventHighlight.apply());

});

/**
 * 서버 이벤트가 걸려있는 UI 마킹 표시 해제 
 */
ACTION_MAP.set("SERVER_EVENT_HIGHLIGHT_CLEAR", async function (message) {

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    await oDevBrowser.executeScript(oInjectScripts.ServerEventHighlight.clear());

});


/**
 * 서버 이벤트 목록 구하기
 */
ACTION_MAP.set("GET_SERVER_EVENT_LIST", async function (message) {

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    var oResult = await oDevBrowser.executeScript(oInjectScripts.test.get());
    if (oResult.RETCD === "E") {

        // 오류 처리..
        return;
    }

    let aRDATA = oResult.RDATA;

    let oParams = {
        target: "EXT_SIDE_VIEW",
        action: "SHOW_SERVER_EVENT_LIST",
        payload: {
            SERVER_EVENT_LIST: aRDATA.filter(e => e.SEVENT_NAME !== "")
        }
    };

    await oDevBrowser.executeScript(oInjectScripts.Extension.sendParams(oParams));

});



// GET_ABAP_CLASS_METHOD_SOURCE



ACTION_MAP.set("GET_ABAP_CLASS_METHOD_SOURCE", async function (message) {

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;


    debugger;


    // 서버 가서 메소드 소스 구한다.





});






module.exports = function (message) {

    console.log('extension-message', message);

    let oBindData = this;
    let oAPP = oBindData.oAPP;
    let oDevBrowser = oBindData.oDevBrowser;

    // Action별 Map 코드를 조합
    // let sMapCode = message.target + "_" + message.action;
    let sMapCode = message.action;

    // Action 별 실행 함수가 저장된 Map 객체
    let oActionMap = ACTION_MAP;

    // Map 코드에 해당하는 실행 함수가 없다면 리턴(이건 로직이 샌것임.)
    if (!oActionMap.has(sMapCode)) {
        return;
    }

    // Map 코드에 해당하는 실행 함수 구하기
    let fnMap = oActionMap.get(sMapCode);

    // 실행!!
    fnMap.call(this, message);

}