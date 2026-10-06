/******************************************************************************
 *  💖 DATA / ATTRIBUTE 선언부
 ******************************************************************************/

// AI 서버와 통신하기 위한 채널ID
const C_PIPE_NANE = '\\\\.\\pipe\\u4a_ai';

// AI 서버와 통신 시 응답 대기 시간
const C_AI_CB_WAIT_TIME = 10000;

// 콘솔용 로그 파일 경로
const CONSOLE_LOG_FILE_PATH = "www/ws10_20/js/uai/index.js";

const NET = require("net");

// AI 서버 연결 클라이언트 인스턴스
let CLIENT = undefined;

// AI 대표 Object
let AI = {};

/******************************************************************************
 *  💖 PRIVITE FUNCTION 선언부
 ******************************************************************************/


    /*************************************************************
     * @function - 커스텀 이벤트 대표 function
     *************************************************************/
    function _customEventAI(oEvent){

        let oIF_DATA = oEvent.detail;

        // 요청 데이터의 PRCCD 코드별 호출 분기
        try {

            // PRC_MODULES 폴더를 ROOT로 해서 하위 PRC별 프로세스 수행
           let _sModulePath = parent.PATH.join(parent.PATHINFO.JS_ROOT, "uai", "PRC_MODULES", oIF_DATA.PRCCD, "index.js");

            require(_sModulePath)(oIF_DATA);

        } catch (oError) {

            var sErrcode = "[PRC-COMMON-E001]";

            console.error(sErrcode, oError);

            // [MSG]
            var _sErrMsg = `[${sErrcode}] 외부에서 잘못된 요청을 수행하였습니다.`;

            parent.showMessage(oAPP.oChildApp.sap, 20, "E", _sErrMsg);

            return;

        }

    } // end of _customEventAI


    /****************************************************************
     * @private function - AI 프로그램에 연결 시, 연결 정보 전송
     ****************************************************************/
    function _sendConnectInfo(oIF_DATA, fCallback){
        
        console.log("ai logical connect start");

        // AI 서버에 요청 수행 타임아웃 변수 초기화
        if(AI.iConnTimeout){
            clearTimeout(AI.iConnTimeout);
            delete AI.iConnTimeout;
        }

        // AI IF용 Map
        let oAI_IF_MAP = parent.getAiIfMap();

        let _fCallback = function(oEvent){
            
            // AI 서버에 요청 수행 타임아웃 변수 초기화
            if(AI.iConnTimeout){
                clearTimeout(AI.iConnTimeout);
                delete AI.iConnTimeout;
            }

            // 맵에서 등록된 이벤트 삭제
            oAI_IF_MAP.delete(oIF_DATA.CB_ID);

            // AI 서버에서 전달받은 데이터
            let _oIF_DATA = oEvent.detail;

            /*********************************************************************************
             * 연결이 성공일 경우에만 CLIENT의 end 이벤트를 건다.
             *********************************************************************************
             * - AI 모듈 API의 connect를 수행 할때, 
             *   createConnection을 생성하면서 CLIENT.end 이벤트를 걸어 놓으면,
             *   기존에 다른 브라우저가 이미 연결된 상태에서 연결을 시도 시, AI서버에서 이미 연결된
             *   브라우저가 있다고 오류 코드와 함께 Stream.end를 전송하면,
             *   해당 파라미터를 AI 모듈 API의 connect의 콜백으로 받아서
             *   메시지 처리 등의 후속 프로세스를 처리하려고 하는데
             *   AI에서 Stream.end를 수행 했기 때문에 나의 CLIENT.end 이벤트도 호출되어
             *   결과적으로 이벤트가 두번 타는 현상이 생기기 때문에,
             *   연결 성공할때만 CLIENT.end를 걸고, 실패할 경우는 CLIENT.end 이벤트를 안걸면
             *   위와 같은 혼선이 없어서 이렇게 처리함.
             *********************************************************************************/
            if(_oIF_DATA?.RETCD === "S"){

                console.log("ai logical connect ok");

                // CLIENT.end 이벤트 걸기
                attachEndEvent();

            }

            if(typeof fCallback === "function"){
                fCallback(_oIF_DATA);
            }

        };


        // 콜백받을 용도의 커스텀 이벤트를 등록한다.
        let oCustomEvent = oAPP.oChildApp.common.addCustomEvent(oIF_DATA.CB_ID, _fCallback);

        // 등록한 커스텀 이벤트를 맵에 저장한다.
        oAI_IF_MAP.set(oIF_DATA.CB_ID, oCustomEvent);


        // 연결 정보 전달
        CLIENT.write(JSON.stringify(oIF_DATA));

        // AI 서버에 요청 수행 후 응답 대기
        AI.iConnTimeout = setTimeout(function(){

            // 맵에서 등록된 이벤트 삭제
            oAI_IF_MAP.delete(oIF_DATA.CB_ID);

            // AI 서버에 요청 수행 타임아웃 변수 초기화
            if(AI.iConnTimeout){
                clearTimeout(AI.iConnTimeout);
                delete AI.iConnTimeout;
            }

            if(typeof fCallback === "function"){            

                fCallback({
                    RETCD: "E",
                    STCOD: "AI-CONNECT-E999" // 응답 없음 오류!!
                });
                
            }

        }, C_AI_CB_WAIT_TIME);        

    } // end of _sendConnectInfo


    /*************************************************************
     * @function - AI 서버와 연결된 이후에 
     *             AI 서버와 연결이 해제 되었을 경우에 대한 화면 핸들링
     *************************************************************/
    function _connectionCloseHandle(){

        // 아래 로직에 대한 내용 설명은
        // AI.connect => _sendConnectInfo 의 주석 참조
        let bIsDisconnMsgShow = true;
        if(CLIENT && CLIENT.bIsDisconnMsgShow === false){
            bIsDisconnMsgShow = false;
        }


        // 연결이 끊어졌을 경우 CLIENT 전역 객체 초기화
        CLIENT = undefined;

        // 스위치 버튼 연결 해제 표시
        oAPP.oChildApp.common.fnSetModelProperty("/UAI/state", false);        

        // [MSG]
        var _sMsg = "AI와 연결이 해제 되었습니다."; 

        if(bIsDisconnMsgShow === true){
            setTimeout(function(){
                oAPP.oChildApp.sap.m.MessageToast.show(_sMsg);
            },0);            
        }        

        // busy 끄고 Lock 풀기
        oAPP.oChildApp.common.fnSetBusyLock("");

    } // end of _connectionCloseHandle


    /*************************************************************
     * @function - [공통] PRCCD 별, AI I/F 용 Custom Event 설정
     *************************************************************/
    function _setCustomEvent(sPRCCD){

        // AI I/F용 Map
        const oAI_IF_MAP = parent.getAiIfMap();

        // 기존에 맵에 커스텀 이벤트가 등록되어 있을 경우 빠져나간다.
        const oEventTarget = oAI_IF_MAP.get(sPRCCD);
        if(oEventTarget){
            return;
        }
        
        // Process code 에 대한 커스텀 이벤트를 구한다.
        const oCustomEvent = oAPP.oChildApp.common.addCustomEvent(sPRCCD, _customEventAI);

        // Process code 에 대한 커스텀 이벤트를 맵에 등록한다.
        oAI_IF_MAP.set(sPRCCD, oCustomEvent);

    } // end of setCustomEvent


/******************************************************************************
 *  💖 PUBLIC FUNCTION 선언부
 ******************************************************************************/


    /*************************************************************
     * @function - AI 연결 관련 초기 설정
     *************************************************************/
    AI.init = function(){

        const sPRCCD = "WS";

        // AI IF용 Map
        const oAI_IF_MAP = parent.getAiIfMap();
        
        // Process code 에 대한 커스텀 이벤트를 구한다.
        const oCustomEvent = oAPP.oChildApp.common.addCustomEvent(sPRCCD, _customEventAI);

        // Process code 에 대한 커스텀 이벤트를 맵에 등록한다.
        oAI_IF_MAP.set(sPRCCD, oCustomEvent);

    }; // end of AI.init


    /*************************************************************
     * @function - WS10에 대한 AI I/F 용 Custom Event 설정 (1회만)
     *************************************************************/
    AI.setCustomEvent_WS_10 = function(){

        const sPRCCD = "WS_10";

        _setCustomEvent(sPRCCD);

    }; // end of AI.setCustomEvent_WS_20


    /*************************************************************
     * @function - WS20에 대한 AI I/F 용 Custom Event 설정 (1회만)
     *************************************************************/
    AI.setCustomEvent_WS_20 = function(){

        const sPRCCD = "WS_20";

        _setCustomEvent(sPRCCD);

    }; // end of AI.setCustomEvent_WS_20


    /*************************************************************
     * @function - WS30에 대한 AI I/F 용 Custom Event 설정 (1회만)
     *************************************************************/
    AI.setCustomEvent_WS_30 = function(){

        const sPRCCD = "WS_30";

        _setCustomEvent(sPRCCD);

    }; // end of AI.setCustomEvent_WS_30


    /*************************************************************
     * @function - AI 서버 연결
     *************************************************************/
    AI.connect = function(oPARAM){

        console.log("ai net connect start");

        return new Promise(async (resolve) => {
            
            // 필수 파라미터 오류인 경우는 크리티컬 오류를 발생시킨다.
            if(typeof oPARAM !== "object" || !oPARAM?.CONID){
                
                let _sErrMsg = "[critical error!!] AI.connect 수행 시, 필수 파라미터 누락!!";

                // 콘솔용 오류 메시지
                var aConsoleMsg = [
                    `######################################`,
                    `## AI 연결 요청 시 필수 파라미터 CONID 누락`,
                    `######################################`,
                    `[PATH]: ${CONSOLE_LOG_FILE_PATH}`,  
                    `=> AI.connect`,
                    `######################################\n`,
                ];
                console.error(aConsoleMsg.join("\r\n"));

                throw new Error(_sErrMsg);

            }

            CLIENT = NET.createConnection(C_PIPE_NANE, function(e){
                
                console.log("ai net connect ok");

                // AI에 전달할 I/F 데이터
                let oIF_DATA = {
                    PRCCD: "AI",
                    ACTCD: "CONNECT",
                    PARAM: oPARAM
                };

                // 콜백 받을 이벤트 명
                oIF_DATA.CB_ID = `${oIF_DATA.PRCCD}-${oIF_DATA.ACTCD}-${getRandomKey(30)}`; 

                _sendConnectInfo(oIF_DATA, function(oResult){                    
                    
                    // 연결 시도하다가 다른 서버에서 이미 연결이 되어있는 상태일 경우
                    // AI 서버에서 client end를 하는데..
                    // 그러면 3.0의 client의 end 이벤트도 연결 끊었을 때 이벤트를 호출 하여
                    // 그 이벤트에서 연결 해제 메시지 출력을 할지 말지 정하는 플래그를 설정함.
                    if(oResult.ACTCD === "CONNECT" && oResult.STCOD === "AI-CONNECT-E002"){
                        CLIENT.bIsDisconnMsgShow = false;
                    }

                    return resolve(oResult);

                });
                
            });


            /*********************************************************************
             * AI 서버에서 보낸 데이터를 수신받는 이벤트
             *********************************************************************
            * - WS30에서 요청 후 수신 받아야할 상황일 경우,
            *   수신받다가 오류 발생하면 오류 내용을 AI에 다시 전달하고,
            *   WS30에서는 응답을 못받게 되어 일정시간 지난 뒤 응답 없음 오류를 발생시킴         
            *********************************************************************/        
            CLIENT.on('data', function(data){
                
                try {

                    let _sData = data.toString();

                    var _oIF_DATA = JSON.parse(_sData);

                } catch (error) {

                    var sErrcode = "AI-CLIENT-E001";
    
                    // 콘솔용 오류 메시지
                    var aConsoleMsg = [
                        `######################################`,
                        `## [${sErrcode}] UAI에서 전달한 값을 JSON 파싱 하다가 오류`,
                        `######################################`,
                        `[PATH]: ${CONSOLE_LOG_FILE_PATH}`,  
                        `=> AI.connect`,
                        `=> CLIENT.on('data')`,
                        `######################################\n`,
                    ];
                    console.error(aConsoleMsg.join("\r\n"));
                    console.error(error);

                    // 😡😡😡😡 여기 탔다는건 크리티컬 오류 😡😡😡😡  

                    // AI 서버에서 잘못된 포맷의 데이터를 호출했다는 메시지 처리..

                    // [MSG]
                    var sMsg = `[${sErrcode}] AI 서버에서 잘못된 포맷의 데이터를 전송하였습니다.`;

                    parent.showMessage(oAPP.oChildApp.sap, 20, "E", sMsg);

                    return;         

                }    

                if(typeof _oIF_DATA?.PRCCD === "undefined"){

                    var sErrcode = "AI-CLIENT-E002";

                    // 콘솔용 오류 메시지
                    var aConsoleMsg = [
                        `######################################`,
                        `## [${sErrcode}] UAI에서 전달한 값중, 필수 파라미터 누락!!`,
                        `######################################`,
                        `[PATH]: ${CONSOLE_LOG_FILE_PATH}`,  
                        `=> AI.connect`,
                        `=> CLIENT.on('data')`,
                        `######################################\n`,
                    ];
                    console.error(aConsoleMsg.join("\r\n"));


                    // 😡😡😡😡 여기 탔다는건 크리티컬 오류 😡😡😡😡                  
                    
                    // AI 서버에서 잘못된 포맷의 데이터를 호출했다는 메시지 처리..

                    // [MSG]
                    var sMsg = `[${sErrcode}] AI 서버에서 잘못된 포맷의 데이터를 전송하였습니다.`;

                    parent.showMessage(oAPP.oChildApp.sap, 20, "E", sMsg);

                    return;
            
                }


                let oAI_IF_MAP = parent.getAiIfMap();
                let oEventTarget = oAI_IF_MAP.get(_oIF_DATA.PRCCD);
                if(!oEventTarget){

                    // 3.0 브라우저가 숨어져 있을 수 있으므로 최상단에 위치시킨다.
                    CURRWIN.setAlwaysOnTop(true, "screen-saver");

                    // 📝📝📝📝📝📝실행할 수 없는 상태입니다.📝📝📝📝📝📝
                    // 메시지 처리라도 할것!!

                    // [MSG]
                    var sMsg = "현재 화면에서는 실행 할 수 없습니다.";

                    parent.showMessage(oAPP.oChildApp.sap, 10, "W", sMsg);                    

                    parent.CURRWIN.show();
                    parent.CURRWIN.focus();

                    // 사용자가 브라우저 최상위 고정 핀을 박았다면 setAlwaysOnTop을 원복 시키지 않음
                    if(oAPP.oChildApp.common.fnGetModelProperty("/SETTING/ISPIN") !== true){
                        CURRWIN.setAlwaysOnTop(false);
                    }    

                    return;
                }
         
                // IF 데이터 전달 시, Net의 Client 인스턴스도 함께 전달 
                _oIF_DATA.AI_CLIENT = CLIENT;

                let oCustomEvent = new CustomEvent(_oIF_DATA.PRCCD, { detail: _oIF_DATA });

                oEventTarget.dispatchEvent(oCustomEvent);
    
            });
      

            /*********************************************************************
             * AI 서버가 실행되어 있지 않을 경우 바로 여기가 호출됨.
             *********************************************************************/
            CLIENT.on('error', function(oError){

                return resolve({
                    RETCD: "E",
                    // ERRCD: "AI-CONNECT-E998" // AI 서버가 실행되지 않았을 경우
                    STCOD: "AI-CONNECT-E998" // AI 서버가 실행되지 않았을 경우
                });

            });


            // CLIENT.on('end', function(oEvent){

            //     // console.log("error", oEvent);
            //     // console.log("2");
            //     // 연결 이후 AI 서버가 끊어졌을 경우에 대한 UI 핸들링                
            //     _connectionCloseHandle();

            // });


        });


    }; // end of AI.connect

    
    /*************************************************************
     * @function - CLIENT.end 이벤트 걸기
     *************************************************************/
    function attachEndEvent (){

        if(typeof CLIENT === "undefined"){
            return;
        }

        CLIENT.on('end', function(oEvent){

            // 연결 이후 AI 서버가 끊어졌을 경우에 대한 UI 핸들링                
            _connectionCloseHandle();

        });

    } // end of attachEndEvent


    /*************************************************************
     * @function - AI 서버 연결 해제
     *************************************************************/
    AI.disconnect = function(oPARAM){

        console.log("ai net connect release");

        return new Promise(function(resolve){

            // AI에 전달할 I/F 데이터
            let oIF_DATA = {
                PRCCD: "AI",
                ACTCD: "DISCONNECT",
                CB_ID: getRandomKey(30),
                PARAM: oPARAM
            };

            // 연결된 상태가 아닐 경우
            if(typeof CLIENT === "undefined"){
                return resolve({ RETCD: "E", STCOD: "AI-DISCONNECT-E001" });
            }

            // AI 서버에 요청 수행 타임아웃 변수 초기화
            if(AI.iDisconTimeout){
                clearTimeout(AI.iDisconTimeout);
                delete AI.iDisconTimeout;
            }

            // AI IF용 Map
            let oAI_IF_MAP = parent.getAiIfMap();

            // 커스텀 이벤트 콜백
            let _fCallback = function(oEvent){

                // AI 서버에 요청 수행 타임아웃 변수 초기화
                if(AI.iDisconTimeout){
                    clearTimeout(AI.iDisconTimeout);
                    delete AI.iDisconTimeout;
                }

                // AI 서버에서 전달받은 데이터
                let _oIF_DATA = oEvent.detail;

                CLIENT = undefined;

                // 맵에서 등록된 이벤트 삭제
                oAI_IF_MAP.delete(oIF_DATA.CB_ID);

                return resolve(_oIF_DATA);

            };

            let oCustomEvent = oAPP.oChildApp.common.addCustomEvent(oIF_DATA.CB_ID, _fCallback);

            oAI_IF_MAP.set(oIF_DATA.CB_ID, oCustomEvent);

            // 연결 정보 전달
            CLIENT.write(JSON.stringify(oIF_DATA));

            // AI 서버에 요청 수행 후 응답 대기
            AI.iDisconTimeout = setTimeout(function(){

                // 응답이 없습니다 연결 실패!!
                // AI 서버에 요청 수행 타임아웃 변수 초기화
                if(AI.iDisconTimeout){
                    clearTimeout(AI.iDisconTimeout);
                    delete AI.iDisconTimeout;
                }

                return resolve({
                    RETCD: "E",
                    STCOD: "AI-DISCONNECT-E999" // 응답 없음 오류!!
                });

            }, C_AI_CB_WAIT_TIME);

        });

    }; // end of AI.disconnect


module.exports = AI;