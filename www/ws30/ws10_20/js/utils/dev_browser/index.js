/* 
*📦----------------------------------------------------------------------*
* Module       : devbrowser/index.js
* Category     : Workspace
* Role         : 개발 모드 브라우저를 실행할 모듈 JS
*
* Creator      : CHUNGYOON LEE
* Created On   : 2026-01-22
*
* 대표 사용처: oAPP.fn.fnOpenDevBrowser
*----------------------------------------------------------------------*
*/


/****************************************************************************
 * 📡 Remote / Modules
 ****************************************************************************/
    // DEV Browser 공통 함수 모음
    const COMMON = require("./common/index.js");

    const { CLDevBrowser, DevBrowserStatusCode } = require("./lib/core/devBrowser");
    const { CLIpcHandler } = parent.require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "ipc-handler"));

    // 전역 메시지 정보 추출
    const G_MSG = require("./msg/index.js")();

    /**     
     * * Chrome Extension 환경과의 통신을 위한 메시지 이벤트 핸들러 모듈입니다.
     * * 역할: 
     *    Chrome Extension(브라우저 확장 프로그램)으로부터 전달되는 'runtime.sendMessage' 또는 'tabs.sendMessage' 이벤트를 수신합니다. 
     * 
     * * 연동 흐름: 
     *   - chrome Extension 
     *      chrome.runtime.sendMessage (전송)
     * 
     *   - background.js
     *      chrome.runtime.onMessage   (수신)
     *      chrome.tabs.sendMessage    (전송)
     * 
     *   - content-script.js
     *      chrome.runtime.onMessage   (수신)
     *      CustomEvent Dispatch       (전송)
     * 
     *   - web browser
     *      CustomEvent onMessage      (수신)
     * 
     *   - 개발모드 브라우저가 심은 함수로 전달 (전송)
     *       -> _fireOnExtensionMessage 
     *       -> extension-message 이벤트 수행 (emit) 
     * 
     *   - 개발모드 브라우저 모듈 scope로 수신됨.
     *   
     *   Dev Browser (Extension) -> runtime.onMessage -> 본 모듈(extension-message.js)
     */
    const fEventHandleExtensionMessage = require("./eventHandler/extension-message.js");

    // 개발 모드 브라우저에서 사용자가 수행한 액션에 대한 데이터를 수신받는 모듈
    const fEventHandleUserAction = require("./eventHandler/user-action.js"); 

/****************************************************************************
 * 🌐 Global Variables
 ****************************************************************************/
    
    const APP = parent.APP;
    const CURRWIN = parent.CURRWIN;
    const BROWSER_KEY = parent.getBrowserKey(); // 현재 브라우저의 고유 키
    const CONSOLE_SCOPE = "[DEV BROWSER]";      // 로그 태그

    // 상태 관리용 변수
    const BROWSER_MAP = new Map();              // 실행된 브라우저 인스턴스 저장소
    const IPC_HANDLER = new CLIpcHandler();     // IPC 핸들러 인스턴스

    let oAPP = null;                            // 메인 APP 객체 참조

    let oInjectScripts = require("./runtime-injections/index.js");


/****************************************************************************
 * 🔒 Private functions
 ****************************************************************************/

    /** 콘솔 로그 출력 헬퍼 */
    function _consoleLog(msg, ...args) {

        if(APP.isPackaged){
            return;
        }

        console.log(`${CONSOLE_SCOPE} - ${msg}`, ...args);
    }

    /** 콘솔 오류 출력 헬퍼 */
    function _consoleErr(msg, ...args) {

        if(APP.isPackaged){
            return;
        }

        console.error(`${CONSOLE_SCOPE} - ${msg}`, ...args);
    }

    /** 경고 로그 출력 헬퍼 (박스 형태) */
    function _warnBox(title, reason) {

        if(APP.isPackaged){
            return;
        }

        const msg = [
            `\n######################################`,
            `## ${CONSOLE_SCOPE} - ${title}`,
            `######################################`,
            `- 작업을 수행할 수 없음`,
            `- 사유: ${reason}`,
            `######################################`,
        ];

        console.warn(msg.join("\r\n"));

    }

    /** 브라우저 키 검증 헬퍼 */
    function _isValidBrowserKey(key) {
        return key === BROWSER_KEY;
    }

    
    // ==============================================================================
    // 브라우저 제어 로직
    // ==============================================================================

    /**
     * [Async] 등록된 모든 브라우저 인스턴스 종료
     */
    async function _browserCloseAll() {

        if (BROWSER_MAP.size === 0) return;

        const closePromises = Array.from(BROWSER_MAP.values())
            .filter(browser => browser && typeof browser.close === "function")
            .map(browser => browser.close().catch(err => console.warn("Browser Close Error:", err)));

        await Promise.allSettled(closePromises);

        BROWSER_MAP.clear();

    }

    /**
     * [Async] 등록된 모든 브라우저 새로고침
     */
    async function _browserReloadAll() {

        if (BROWSER_MAP.size === 0) return;

        const reloadPromises = Array.from(BROWSER_MAP.values())
            .filter(browser => browser && typeof browser.reloadPage === "function")
            .map(browser => browser.reloadPage().catch(err => console.warn("Browser Reload Error:", err)));

        await Promise.allSettled(reloadPromises);

    }

  
    // ==============================================================================
    // IPC 이벤트 핸들러
    // ==============================================================================

    /** 화면 이동(NaviTo) 시 호출 */
    async function _fnIpcNaviTo(event, oParams) {

        if (!_isValidBrowserKey(oParams.browserKey)) return;

        _consoleLog("IPC: naviTo", oParams);

        await _browserCloseAll();

        _unregisterIpcEvents();

    } // end of _fnIpcNaviTo

    /** 화면 활성화(Activate) 시 호출 */
    async function _fnIpcActivate(event, oParams) {

        if (!_isValidBrowserKey(oParams.browserKey)) return;

        _consoleLog("IPC: activate", oParams);

        await _browserReloadAll();

    } // end of _fnIpcActivate

    /** 로그오프(Logoff) 시 호출 */
    async function _fnIpcLogoff(event, oParams) {

        if (!_isValidBrowserKey(oParams.browserKey)) return;

        _consoleLog("IPC: logoff", oParams);

        await _browserCloseAll();

    } // end of _fnIpcLogoff

    /** 앱 모드 변경 시 호출 */
    async function _fnIpcAppModeChange(event, oParams) {
        
        if (!_isValidBrowserKey(oParams.browserKey)) return;

        _consoleLog("IPC: appModeChange", oParams);
        
        if(oParams.IS_EDIT !== "X"){
            return;        
        }

        // Edit 모드로 전환 시 브라우저를 갱신 시킨다.
        await _browserReloadAll();    

    } // end of _fnIpcAppModeChange    


    /** 컨트롤러 실행 및 종료시 호출 */
    async function _fnExecControllerClass(event, oParams){

        /**
         * @description IPC 브로드캐스트 메시지를 통한 브라우저 간 Busy 상태 동기화
         * @reason 
         * 1. [중복 실행 방지]: 메인 프로세스에서 전송된 이벤트가 발신 주체(Self)에게도 전달됨.
         * 2. [상태 일관성]: 내가 실행한 경우 이미 Busy가 활성화되어 있으므로 로직을 건너뜀.
         * 3. [동기화]: '타 브라우저'에서 컨트롤러를 실행했을 때만 현재 영역(Side View)의 Busy를 동기화함.
         */
        // if (_isValidBrowserKey(oParams.browserKey)) return;
        
        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        // finish
        // execute
        let sStatus = oParams?.status || "";

        let bIsBusy = false;
        if(sStatus === "execute"){
            bIsBusy = true;
        }

        let oSendParams = {
            target: "EXT_SIDE_VIEW",
            action: "SET_BUSY",
            payload: {
                BUSY: bIsBusy
            }
        };

        await oDevBrowser.executeScript(oInjectScripts.Extension.sendParams(oSendParams));

    }

    // ==============================================================================
    // IPC 등록/해제
    // ==============================================================================

    let _fnBindExecControllerClass;

    function _registerIpcEvents(oBindData) {

        IPC_HANDLER.on("naviTo",         _fnIpcNaviTo);
        IPC_HANDLER.on("activate",       _fnIpcActivate);
        IPC_HANDLER.on("logoff",         _fnIpcLogoff);
        IPC_HANDLER.on("appModeChange",  _fnIpcAppModeChange);

        _fnBindExecControllerClass = _fnExecControllerClass.bind(oBindData);

        IPC_HANDLER.on("execControllerClass", _fnBindExecControllerClass);

    } // end of _registerIpcEvents

    function _unregisterIpcEvents() {

        IPC_HANDLER.off("naviTo",         _fnIpcNaviTo);
        IPC_HANDLER.off("activate",       _fnIpcActivate);
        IPC_HANDLER.off("logoff",         _fnIpcLogoff);
        IPC_HANDLER.off("appModeChange",  _fnIpcAppModeChange);   

        IPC_HANDLER.off("execControllerClass", _fnBindExecControllerClass);

        _fnBindExecControllerClass = null;    

    } // end of _unregisterIpcEvents



    // ==============================================================================
    // DEV BROWSER 관련 이벤트 핸들러
    // ==============================================================================

    /**
     * 브라우저 종료 이벤트
     */
    function _devBrowser_close(){

        let oBindData = this;
        let oDevBrowser = oBindData.oDevBrowser;

        _consoleLog(`Closed: ${oDevBrowser.getId()}`);
        
        BROWSER_MAP.delete(oDevBrowser.getId());

    } // end of _devBrowser_close


    /**
     * 브라우저 콘솔 오류
     */
    function _devBrowser_console_error(e){

        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        _consoleErr(`콘솔 오류: ${oDevBrowser.getId()}`, e);

        // let oParams = {
        //     oAPP: oAPP,
        //     oDevBrowser: oDevBrowser,
        //     payload: {
        //         ...e,
        //     }
        // };

        // // information popup 실행
        // _fnInfoPopupModule(oParams);

    } // end of _devBrowser_console_error


    /**
     * 브라우저 비동기 오류
     */
    function _devBrowser_pageerror(e){
    
        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        _consoleErr(`런타임 오류: ${oDevBrowser.getId()}`, e);

        // let oParams = {
        //     oAPP: oAPP,
        //     oDevBrowser: oDevBrowser,
        //     payload: {
        //         ...e,
        //     }
        // };

        // // information popup 실행
        // _fnInfoPopupModule(oParams);

    } // end of _devBrowser_pageerror

    /**
     * 브라우저 새탭 감지 이벤트
     */
    async function _devBrowser_newtab(){
        
        console.log("new tab detected");

        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        let sErrCode = "E999";
        try {
            
            //"새 탭이 감지되었습니다.\n해당 브라우저는 새탭을 지원하지 않습니다.";
            let sMsg = G_MSG.M001 + "\n" + G_MSG.M012; 

            sErrCode = "E001";
            await oDevBrowser.executeScript(oInjectScripts.Util.showBrowserMessage(sMsg, { type: "W" }));

        } catch (error) {
            
            // 콘솔용 오류 메시지
            var aConsoleMsg = [
                `\n######################################`,
                `## 개발 브라우저 새탭 감지 오류`,
                `######################################`,
                `=> ${parent.WSUTIL.getStackTraceInfo()}`,
                `=> _devBrowser_newtab`,
                `=> [ERRCOD]: ${sErrCode}`,
                `=> [ERRMSG]: ${error?.message || ""}`,
                `######################################\n`,
            ];

            console.error(aConsoleMsg.join("\r\n"));

        }
        

    } // end of _devBrowser_newtab


    /**
     * 브라우저 URL 변경 감지
     */
    async function _devBrowser_framenavigated(e){
        
        console.log("URL change detected", e);
        
        let oBindData = this;
        let oAPP = oBindData.oAPP;
        let oDevBrowser = oBindData.oDevBrowser;

        let sErrCode = "E999";        

        try {            

            sErrCode = "E001";
            let sPageUrl = oDevBrowser.page.url();

             sErrCode = "E002";
            let oChangedURL = new URL(sPageUrl);
            let sChangedURL = oChangedURL.origin + oChangedURL.pathname;
                sChangedURL = sChangedURL.toLowerCase();

            let oBrowserOptions = oDevBrowser.getOptions();

            sErrCode = "E003";
            let oBrowserURL = new URL(oBrowserOptions.url);
            let sBrowserURL = oBrowserURL.origin + oBrowserURL.pathname;
                sBrowserURL = sBrowserURL.toLowerCase();

            if(sChangedURL == sBrowserURL){
                return;
            }

            sErrCode = "E004";

            // 화면 전환 후 URL 원복
            await oDevBrowser.page.goto(oBrowserOptions.url);

            // URL을 변경할 수 없습니다.
            let sMsg = G_MSG.M011;

            sErrCode = "E005";
            await oDevBrowser.executeScript(oInjectScripts.Util.showBrowserMessage(sMsg, { type: "E" }));
            
        } catch (error) {

            // 콘솔용 오류 메시지
            var aConsoleMsg = [
                `\n######################################`,
                `## 개발 브라우저 URL 변경 감지 오류`,
                `######################################`,
                `=> ${parent.WSUTIL.getStackTraceInfo()}`,
                `=> _devBrowser_framenavigated`,
                `=> [ERRCOD]: ${sErrCode}`,
                `=> [ERRMSG]: ${error?.message || ""}`,
                `######################################\n`,
            ];

            console.error(aConsoleMsg.join("\r\n"));

        }

    } // end of _devBrowser_framenavigated


    /**
     * Request 요청 실패 시 호출되는 이벤트
     */
    function _devBrowser_requestfailed(e){
        
        console.error(`${CONSOLE_SCOPE} - request failed`, e);

        // let oBindData = this;
        // let oAPP = oBindData.oAPP;
        // let oDevBrowser = oBindData.oDevBrowser;






        

    } // end of _devBrowser_requestfailed


// ==============================================================================
//  ▶️ Module Start !!
// ==============================================================================

module.exports = async function(oParams) {

    _consoleLog("Dev Browser Module Started", oParams);

    // 1. 파라미터 및 전역 객체 설정
    oAPP = oParams.oAPP;

    // 2. 개발 브라우저 인스턴스 생성
    const oDevBrowser = new CLDevBrowser(oParams.browserOptions);    

    // 3. 브라우저 실행 (Launch)
    const oLaunchRes = await oDevBrowser.launchPage();

    // 실패 시 처리
    if (oLaunchRes.RETCD === "E") {

        // 콘솔용 오류 메시지
        var aConsoleMsg = [
            `\n######################################`,
            `## 개발 브라우저 실행 오류`,
            `######################################`,
            `=> ${parent.WSUTIL.getStackTraceInfo()}`,
            `=> oLaunchRes.RETCD === "E"`,
            `=> 응답 데이터: ${JSON.stringify(oLaunchRes, null, '\t')}`,
            `######################################\n`,
        ];
        console.error(aConsoleMsg.join("\r\n"));

        // 개발 모드 브라우저 실행 중, 오류가 발생하였습니다!
        let sMsg = G_MSG.M002;
            sMsg += `\n\n${JSON.stringify(oLaunchRes)}\n\n`;
            sMsg += G_MSG.M003;

        COMMON.showMessage(20, "E", sMsg);

        return;

    }

    // 4. 성공 시 저장소 등록
    BROWSER_MAP.set(oDevBrowser.getId(), oDevBrowser);

    // 5. 현재 윈도우가 닫힐 때(새로고침 등) 브라우저 정리 (1회성)
    window.addEventListener('pagehide', _browserCloseAll, { once: true });

    // 각 이벤트에 바인딩 할 데이터
    let oBindData = {
        oDevBrowser: oDevBrowser,
        oAPP: oAPP,        
    };

    // 6. IPC 이벤트 리스너 등록
    _registerIpcEvents(oBindData);

    /** Extension에서 전달받은 메시지 */
    oDevBrowser.on('extension-message', fEventHandleExtensionMessage.bind(oBindData));

    /** 사용자 액션 감지 */
    oDevBrowser.on('user-action', fEventHandleUserAction.bind(oBindData));

    /** 브라우저 종료 감지 */
    oDevBrowser.on('close', _devBrowser_close.bind(oBindData));

    /** 콘솔 오류 감지 */
    oDevBrowser.on('console-error', _devBrowser_console_error.bind(oBindData));

    /** 비동기 오류 감지 */
    oDevBrowser.on('pageerror', _devBrowser_pageerror.bind(oBindData));

    /** 새탭 감지 */
    oDevBrowser.on('newtab', _devBrowser_newtab.bind(oBindData));

    /** URL 변경 감지 */  
    oDevBrowser.on('framenavigated',_devBrowser_framenavigated.bind(oBindData));

    /** Request 요청 실패 시 호출되는 이벤트 */    
    oDevBrowser.on('requestfailed', _devBrowser_requestfailed.bind(oBindData));

};