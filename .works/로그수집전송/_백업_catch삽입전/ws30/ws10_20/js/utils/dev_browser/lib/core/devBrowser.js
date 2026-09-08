/**
 * @since   2026-01-06 10:59:47
 * @version v3.6.0-4
 * @author  soccerhs
 * @description
 *  개발 모드 브라우저 API
 *  
 */

const EventEmitter = require('events');
const puppeteer = require("puppeteer-core");
const crypto = require("crypto");

/**
 * ------------------------------------------------------------------
 * 브라우저 실행 상태 코드 정의 (STCOD)
 * ------------------------------------------------------------------
 * @readonly
 * @enum {string}
 */
const DevBrowserStatusCode = {

    /** 브라우저 실행 실패 (경로 오류, 호환성 문제, 권한 부족 등) */
    LAUNCH_FAILED: 'LAUNCH_FAILED',

    /** 브라우저 실행 후 초기 탭(Page)을 찾을 수 없음 */
    PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',

    /** 통신 브릿지(exposeFunction) 및 이벤트 감지 스크립트 주입 실패 */
    INJECT_SCRIPT_FAILED: "INJECT_SCRIPT_FAILED",

    /** 대상 URL 로드 실패 (네트워크 오류, 타임아웃, DNS 문제 등) */
    PAGE_LOAD_FAILED: 'PAGE_LOAD_FAILED',
};

/**
 * ------------------------------------------------------------------
 * @class CLDevBrowser
 * @extends EventEmitter
 * @description 
 * Puppeteer를 래핑하여 SAP UI5 등의 웹 환경에서 사용자 동작을 감지하고 제어하는 개발용 브라우저 클래스입니다.
 * ------------------------------------------------------------------
 * * ### 🔥 Emitted Events (이벤트 목록)
 * * **1. `user-action`**
 * - 설명: 웹 페이지 내에서 사용자 클릭(Click) 등의 액션이 감지되었을 때 발생
 * - 데이터: `{ EVTNM: "click", OBJID: "SAP_CONTROL_ID", IS_CURR_APP: boolean }`
 * 
 * * **2. `close`**
 * - 설명: 브라우저가 (사용자나 로직에 의해) 종료되었을 때 발생
 * - 데이터: 없음
 * 
 * * **3. `newtab`**
 * - 설명: 사용자가 링크 클릭 등으로 '새 탭'을 열려고 시도했으나, 로직에 의해 차단되었을 때 발생
 * - 데이터: 없음
 * 
 * * **4. `console-error`**
 * - 설명: 브라우저 개발자 도구(Console)에 에러 로그가 찍힐 때 발생
 * - 데이터: `{ type: "error", message: "Error Message..." }`
 * 
 * * **5. `framenavigated`**
 * - 설명: 페이지의 URL이 변경되거나(뒤로가기 포함), 새로고침 되어 주소가 갱신될 때 발생
 * - 데이터: `{ url: "https://..." }`
 * 
 * * **6. `pageerror`**
 * - 설명: 페이지 내부 스크립트 실행 중 처리되지 않은 예외(Uncaught Exception) 발생 시
 * - 데이터: `{ message: "...", stack: "..." }`
 * 
 * * **7. `requestfailed`**
 * - 설명: 이미지, 스크립트, API 등 네트워크 리소스 요청이 실패했을 때 발생 (404, 500 등)
 * - 데이터: `{ url: "...", failure: object, resourceType: "..." }`
 * * ------------------------------------------------------------------
 */
class CLDevBrowser extends EventEmitter {

    /**
     * 생성자
     * @param {object} option - 설정 옵션 객체
     * @param {string} option.url - [필수] 접속할 대상 웹페이지 URL
     * @param {object} [option.launchOptions] - Puppeteer `launch` 메서드 옵션
     * @param {string} option.launchOptions.executablePath - [필수] Chrome 실행 파일 절대 경로
     * @param {boolean} [option.launchOptions.headless=false] - 헤드리스 모드 사용 여부 (기본값: false)
     */
    constructor(option = {}){
        super();

        // 브라우저 실행 시 구분을 위한 UserAgent
        this.sUserAgent = "U4A_WS_DEV_BROWSER";

        // 🔥 인스턴스 생성 시 자동 랜덤 아이디 생성 (UUID)
        this.sId = crypto.randomUUID();  

        // 기본 옵션 설정
        const defaultOptions = {
            url: '',
            launchOptions: {
                headless: false,
                defaultViewport: null
            }
        };

        // 사용자 옵션 병합
        this.option = {
            ...defaultOptions,
            ...option,
            launchOptions: {
                ...defaultOptions.launchOptions,
                ...(option.launchOptions || {})
            }
        };
        
        // [유효성 검사] URL 필수
        if (!this.option.url) {
            throw new Error('URL은 필수입니다. option.url을 설정하세요.');
        }

        // [유효성 검사] 실행 경로 필수
        if (!this.option.launchOptions.executablePath) {
            throw new Error('Chrome 실행 경로가 필요합니다. option.launchOptions.executablePath를 설정하세요.');
        }

        /** @type {import('puppeteer-core').Browser|null} */
        this.browser = null;
        
        /** @type {import('puppeteer-core').Page|null} */
        this.page = null;
    }

    /**
     * 현재 인스턴스의 고유 ID(UUID)를 반환합니다.
     * @returns {string} Instance ID
     */
    getId(){
        return this.sId;
    }

    getOptions() {
        return this.option;
    }

    /**
     * [내부] 화면에서 감지된 액션 이벤트를 외부(`user-action`)로 방출합니다.
     * @private
     * @param {object} action - 수집된 액션 데이터
     */
    _fireUserAction(action) {
        
        this.emit('user-action', action);     
    }

    /**
     * [내부] Extension에서 전송한 데이터를 외부(`extension-message`) 로 방출합니다.
     * @private
     * @param {object} message - 수신된 메시지 데이터
     */
    _fireOnExtensionMessage(message){
        this.emit('extension-message', message);
    }

    /**
     * [내부] Puppeteer의 **Browser 레벨** 이벤트 리스너를 등록합니다.
     * * - `disconnected`: 브라우저 연결 해제 감지 -> `close` 이벤트 방출
     * - `targetcreated`: 새 탭 생성 감지 -> 즉시 닫기 수행 (Single Page 유지)
     * @private
     */
    _registerBrowserEventListeners(){

        if(!this.browser) return;

        // 1. 브라우저 연결 해제(종료) 감지
        this.browser.once('disconnected', () => {
            // console.log('[browser] - disconnected!');
            this.emit('close');
        });

        // 2. 새 탭(Target) 생성 감지 및 차단
        this.browser.on('targetcreated', async (target) => {

            // 생성된 타겟이 'page'(탭)인지 확인
            if (target.type() === 'page') {
                const newPage = await target.page();
                
                // 현재 메인 페이지(this.page)가 아닌 다른 탭이 열리면 닫아버림
                if (newPage !== this.page) { 

                    // 테스트 모드 일 경우에는 새탭을 허용
                    // 크롬 extension 디버깅도 해야되기 때문..
                    if(parent.APP.isPackaged === false){
                        console.log("개발모드여서 새창 감지 해제됨!");
                        return;
                    }

                    console.log('[browser] - 새 탭이 감지되어 닫았습니다.');
                    
                    await newPage.close();
                    
                    // (선택 사항) 필요한 경우 원래 탭으로 포커스를 다시 가져옴
                    if (this.page) await this.page.bringToFront();

                    this.emit('newtab');
                }
            }
        });

    } // end of _registerBrowserEventListeners

    /**
     * [내부] Puppeteer의 **Page 레벨** 이벤트 리스너를 등록합니다.
     * - `console`: 에러 로그 수집
     * - `framenavigated`: URL 변경 감지
     * - `pageerror`: JS 런타임 에러 감지
     * - `requestfailed`: 리소스 로딩 실패 감지
     * @private
     */
    _registerPageEventListeners() {

        if (!this.page) return;

        // 1. 콘솔(Console) 메시지 감지
        this.page.on('console', (msg) => {

            // 에러 타입 로그만 수집
            if(msg.type() !== "error"){
                return;
            }
            
            msg.args().forEach(arg => {
                try {
                    const val = arg.remoteObject();
                    const type = msg.type();
                    const text = val.type === 'string' ? val.value : (val.description || 'Unknown Error');
                    
                    // console.error("[page] - console 오류 발생!!", text);

                    this.emit('console-error', {
                        type: type,
                        message: text
                    });

                } catch (e) {}
            });
        });

        // 2. 페이지 네비게이션(URL 변경) 감지
        this.page.on('framenavigated', (event) => {
            
            // console.log("[page] - framenavigated 이벤트 발생!!", event.url());

            this.emit('framenavigated', {
                url: event.url()
            });
        });

        // 3. 페이지 내부 JS 런타임 에러 감지
        this.page.on('pageerror', (err) => {

            this.emit('pageerror', {
                message: err?.message || "",
                stack: err?.stack || ""
            });

        });

        // 4. 네트워크 요청 실패 감지
        this.page.on('requestfailed', (req) => {

            this.emit('requestfailed', {
                url: req.url(),
                failure: req.failure(),
                resourceType: req.resourceType()
            });

        });

        /**
         * 아래의 '페이지 request 요청 감지 이벤트' 주석을 풀어서 사용할려면 아래 로직도 주석 풀어야함.
         * - `await this.page.setRequestInterception(true);`
         */

        // // 5. 페이지 request 요청 감지 이벤트
        // this.page.on('request', async function(req) {

        //     // 1. [Early Return] 네비게이션 요청이 아니거나, 메인 프레임이 아닌 경우 무조건 통과
        //     // (리소스 요청, iframe 등)
        //     if (!req.isNavigationRequest() || req.frame() !== this.page.mainFrame()) {
        //         await req.continue();
        //         return;
        //     }

        //     // 2. [Early Return] 초기 진입(about:blank)인 경우 통과
        //     if (this.page.url() === 'about:blank') {
        //         await req.continue();
        //         return;
        //     }

        //     // URL 비교를 위한 정규화 (쿼리 파라미터 제거 등)
        //     // ※ this 컨텍스트가 올바른지 확인 필요 (화살표 함수는 상위 스코프의 this를 따름)
        //     const targetUrl = this._removeUrlParams(req.url());
        //     // const pageUrl   = this._removeUrlParams(this.page.url());
        //     const pageUrl   = this._removeUrlParams(this.option.url);

        //     // 3. [Early Return] 단순 새로고침(동일 URL)인 경우 통과
        //     if (targetUrl === pageUrl) {
        //         await req.continue();
        //         return;
        //     }

        //     // -----------------------------------------------------------
        //     // 4. 위 조건들을 모두 통과하지 못했다면 => "차단 대상"
        //     // -----------------------------------------------------------
        //     console.warn(`[Blocked] 페이지 이동이 차단되었습니다: ${req.url()}`);

        //     await req.respond({
        //         status: 200, 
        //         contentType: 'text/html; charset=utf-8',
        //         body: `<h1> 이동 안됨!! </h1>`
        //     });
           
        // }.bind(this));

    } // end of _registerPageEventListeners

    /**
     * [내부] Url에서 파라미터 제거
     * 
     * @param {string} url   
     * @returns {string} 파라미터를 제거한 URL
     */
    _removeUrlParams(url){

        try {
            const u = new URL(url);
            return u.origin + u.pathname;
        } catch (e) {
            return url.split('?')[0];
        }

    } // end of _removeUrlParams

    /**
     * [내부] 브라우저에 주입될 **이벤트 감지 스크립트**를 생성하여 반환합니다.     
     * - SAP UI5 Control (`OBJID`) 탐색 로직 (Parent 재귀 탐색 포함)
     * - Global Click Listener 등록
     * * @private
     * @returns {Function} 브라우저 컨텍스트(`evaluate`)에서 실행될 함수 본문
     */
    _getInjectionScript() {

        return require("../injector/index.js");

    } // end of _getInjectionScript

    /**
     * 브라우저를 실행하고 페이지 초기화 작업을 수행합니다.
     * * @returns {Promise<{RETCD: string, STCOD?: string, MSGTX?: string}>} 
     * 실행 결과를 담은 객체를 반환합니다.
     * * ---
     * ### 🟢 성공 시 (Success Return)
     * ```json
     * { "RETCD": "S" }
     * ```
     * * ---
     * ### 🔴 실패 시 (Error Return)
     * ```json
     * { 
     * "RETCD": "E", 
     * "STCOD": "LAUNCH_FAILED", 
     * "MSGTX": "Error Message Details..." 
     * }
     * ```
     * * ---
     * ### ⚠️ 에러 코드 상세 (STCOD)
     * * | 코드명 | 설명 |
     * | :--- | :--- |
     * | **`LAUNCH_FAILED`** | Puppeteer 브라우저 프로세스 실행 실패 (경로, 권한 등) |
     * | **`PAGE_NOT_FOUND`** | 브라우저 실행 후 초기 탭(Page)을 획득하지 못함 |
     * | **`INJECT_SCRIPT_FAILED`** | 통신용 브릿지(`exposeFunction`) 또는 감지 스크립트 주입 실패 |
     * | **`PAGE_LOAD_FAILED`** | 설정된 URL(`goto`) 로딩 실패 (네트워크 등) |
     * ---
     */
    async launchPage() {

        // 1. 브라우저 실행 시도
        try {
            this.browser = await puppeteer.launch(this.option.launchOptions);
        } catch (error) {
            return { RETCD: 'E', STCOD: DevBrowserStatusCode.LAUNCH_FAILED, MSGTX: error.message };
        }

        let page;

        // 2. 초기 페이지(탭) 확보
        try {

            const aPages = await this.browser.pages();
            page = aPages[0];
            
            // 페이지가 없으면 새로 생성
            if(!page){
                page = await this.browser.newPage(); 
            }

        } catch (error) {

            await this.browser.close();

            return { RETCD: 'E', STCOD: DevBrowserStatusCode.PAGE_NOT_FOUND, MSGTX: error.message };
        }      

        this.page = page;

        // 3. 스크립트 주입 및 통신 설정
        try {

            // Node.js <-> Browser 통신 함수 노출
            await this.page.exposeFunction('__u4aDevBrowserCallback', (oIF_DATA) => {

                if(!oIF_DATA?.PRCCD){
                    return;
                }
                
                let oParams = oIF_DATA.PARAM;

                switch (oIF_DATA.PRCCD) {

                    // 사용자 액션 정보
                    case "USER_ACTION":

                        return this._fireUserAction(oParams);  
                        
                    // CHROME Extension
                    case "EXTENSION_ONMESSAGE":

                        return this._fireOnExtensionMessage(oParams);

                    default:
                        break;
                }
                
            });


            /**
             * 현재 스콥에서 evaluateOnNewDocument 하면 document.body도 안나옴.
             */
            // // 로딩바 html 실행
            // this.page.evaluateOnNewDocument(function(){
            //     "use strict";
            //     console.log("start!!!!!!!");
            // });

            // 페이지 로드마다 실행될 스크립트 등록
            this.page.evaluateOnNewDocument(this._getInjectionScript());

        } catch (error) {
            
            await this.page.close();
            await this.browser.close();

            return { RETCD: 'E', STCOD: DevBrowserStatusCode.INJECT_SCRIPT_FAILED, MSGTX: error.message };
        }

        /****************************************************************
         * [추가됨] URL 변경(네비게이션) 차단 로직
         * 반드시 페이지 이동 명령(goto/replace) 전에 선언해야 함
         ****************************************************************/
        // await this.page.setRequestInterception(true);   

        // 4. 이벤트 리스너 최종 등록
        this._registerBrowserEventListeners();
        this._registerPageEventListeners();

        // 4. URL 이동
        try {

            // 1. 현재 브라우저의 기본 User-Agent를 가져옵니다.
            const defaultAgent = await this.browser.userAgent();

            // 2. 기존 문자열 끝에 원하는 식별자를 추가합니다.
            const customAgent = `${defaultAgent} ${this.sUserAgent}`;

            // 3. 변경된 Agent를 페이지에 적용합니다.
            await this.page.setUserAgent(customAgent);

            await this.page.goto(this.option.url);
  
        } catch (error) {

            await this.page.close();
            await this.browser.close();

            return { RETCD: 'E', STCOD: DevBrowserStatusCode.PAGE_LOAD_FAILED, MSGTX: error.message };
        }
        
        // try {

        //     let sUrl = this.option.url;

        //     // await page.goto(sUrl);

        //     await Promise.all([

        //         // 네비게이션이 완료될 때까지 대기 (networkidle0: 네트워크 연결이 0개일 때까지)
        //         this.page.waitForNavigation({ waitUntil: 'networkidle0' }), 
                
        //         // 현재 페이지(about:blank)를 새 URL로 '교체'하여 히스토리를 남기지 않음
        //         this.page.evaluate((sUrl) => {
        //             window.location.replace(sUrl);
        //         }, sUrl)

        //     ]);

        // } catch (error) {

        //     console.error("페이지 URL 실행 실패!!", error);

        //     try {
        //         await this.page.close();
        //         await this.browser.close(); 
        //     } catch (error) {}        

        //     return { RETCD: 'E', STCOD: DevBrowserStatusCode.PAGE_LOAD_FAILED, MSGTX: error.message };  
                      
        // }

        // 성공 리턴
        return { RETCD: 'S' };

    }

    // [NEW] URL 파라미터 제외하고 순수 주소만 비교하기 위한 유틸
    _removeUrlParams(url) {
        try {
            const u = new URL(url);
            return u.origin + u.pathname;
        } catch (e) {
            return url.split('?')[0];
        }
    }

    /**
     * 현재 활성화된 페이지를 **새로고침(Reload)** 합니다.
     */
    async reloadPage() {
        if (!this.page) return;
        try { await this.page.reload(); } catch (error) {}
    }


    /**
     * 브라우저(Page) 컨텍스트에서 문자열 형태의 스크립트를 실행(Eval)합니다.
     * @param {string} sScript - 실행할 자바스크립트 구문 문자열
     * @returns {Promise<{RETCD: string, RDATA?: any, MSGTX?: string}>}
     * - 성공 시: `{ RETCD: 'S', RDATA: (스크립트의 리턴값) }`
     * - 실패 시: `{ RETCD: 'E', MSGTX: (에러 메시지) }`
     */
    async executeScript(sScript) {

        // 1. 페이지 상태 확인
        if (!this.page || this.page.isClosed()) {
            return { RETCD: 'E', STCOD: "E001", MSGTX: "브라우저 페이지가 존재하지 않거나 닫혀있습니다." };
        }

        // 2. 파라미터 타입 방어 로직
        if (typeof sScript !== 'string') {
            return { RETCD: 'E', STCOD: "E002", MSGTX: "파라미터는 실행할 스크립트 문자열(String)이어야 합니다." };
        }

        try {
            /**
             * 3. 스크립트 실행
             * Puppeteer evaluate에 문자열을 넣으면 브라우저 콘솔에서 입력한 것처럼 동작합니다.
             * 값을 리턴받으려면 문자열 안에 'return ...' 구문이 있거나 표현식이어야 합니다.
             */
            const result = await this.page.evaluate(sScript);

            return { RETCD: 'S', RDATA: result };

        } catch (error) {
            
            // 4. 문법 오류(SyntaxError)나 실행 오류 발생 시
            // console.error("[CLDevBrowser] executeScript Error:", error);
            return { RETCD: 'E', STCOD: "E999", MSGTX: error.message };
        }
    }


    /**
     * 현재 실행 중인 브라우저의 위치 정보 구하기
     */
    async getBounds(){
        
        if (!this.page) return;

        // 현재 페이지의 클라이언트 정보 구하기
        let client;
        try {            
            // CDP 세션 생성
            client = await this.page.target().createCDPSession();
        } catch (error) {
            return { RETCD: "E", STCOD: "E001", MSGTX: "client 생성 실패!" }            
        }

        // 현재 페이지의 윈도우 아이디 구하기
        let windowId;
        try {
            // 현재 페이지가 속한 윈도우 ID 조회
            let oClientInfo = await client.send("Browser.getWindowForTarget");    

            windowId = oClientInfo.windowId;

        } catch (error) {
            return { RETCD: "E", STCOD: "E002", MSGTX: "Client 정보 구하기 실패!" };
        }
        
        // 윈도우 bounds 조회
        let oBounds;
        try {
            
            const { bounds } = await client.send("Browser.getWindowBounds", {
                windowId
            });

            oBounds = bounds;

        } catch (error) {
            return { RETCD: "E", STCOD: "E002", MSGTX: "Client 정보 구하기 실패!" };
        }

        return { RETCD: "S", RDATA: oBounds };

    }

    /**
     * 브라우저 인스턴스 및 열려있는 모든 탭을 안전하게 **종료(Close)** 합니다.
     */
    async close (){
        
        if (this.browser && this.browser.isConnected()) {
            try {
                const pages = await this.browser.pages();
                // 모든 페이지 닫기 시도
                await Promise.all(pages.map(page => page.close().catch(() => {})));
                // 브라우저 프로세스 종료
                await this.browser.close();
            } catch (e) {
                console.warn('Browser close warning:', e.message);
            }
        }
        
    }

}

module.exports = { CLDevBrowser, DevBrowserStatusCode };