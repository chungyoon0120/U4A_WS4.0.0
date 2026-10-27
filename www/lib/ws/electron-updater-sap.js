//=================
// 확인 사항!!!
// oAPP.remote <-- 확인 
//__ofs = oAPP.remote.require('fs'); <-- 확인 
//oAPP.remote.require('electron').shell.openExternal(__downPath); <-- 확인 

// sap 서버 통신 url 확인 
//let _sURL_V = "http://27.102.205.26:8000/ZU4A_WBC/UPDATE_CHECK?sap-user=shhong&sap-password=2wsxzaq1!", //버젼 파일 get 
//    _sURL_U = "http://27.102.205.26:8000/ZU4A_WBC/WS_UPDATE_FILE_GET";    //update 파일 get 

//==================

// IF 구조
const TY_IFDATA = {
    PRCCD: "",      // 수행중인 프로세스 코드    
    ACTCD: "",      // 수행중인 행위에 대한 코드     
    PARAM: "",      // 수행 결과에 대한 데이터
};

// // 응답 구조
// const TY_RES = {
//     PRCCD: "",      // 수행중인 프로세스 코드
//     RETCD: "",      // 수행 결과에 대한 코드
//     ERRCD: "",      // 오류 코드
//     ACTCD: "",      // 수행중인 행위에 대한 코드    
//     STCOD: "",      // 수행 결과에 대한 상태 코드    
//     RTMSG: "",      // 수행 결과에 대한 메시지 
//     RDATA: "",      // 수행 결과에 대한 데이터
// };


// 전역 메시지 변수 구조
// 메시지 구조에 대한 내용은 getGlobalMsg 메소드 참조
var GS_MSG = {
    // M001: "U4A Workspace 버전 정보를 조회 하는 도중에 문제가 발생하였습니다.",
    // M002: "U4A Workspace 업데이트 파일을 다운받는 과정에 문제가 발생하였습니다.",
    // M003: "다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요."
};


//----------------------------------------------------------------//
// 로컬 전역 변수 
//----------------------------------------------------------------//

const
    HOST = parent.getServerHost(),
    PATH = parent.PATH,
    REMOTE = parent.REMOTE,
    APP = REMOTE.app,
    FS = parent.FS,
    USERDATA = APP.getPath("userData"),
    APPPATH = APP.getAppPath();

let __updateFilename = "",
    __appVer = "",
    __oWriter,
    __ofs,
    __jobCnt = 0, //sap 서버 호출 수행 count
    __total = 0, //스트림 다운 전체 건수
    __downPath = "", //업데이트 파일(exe) 다운로드 경로
    __downFldPath = ""; //업데이트 파일(exe) 다운로드 폴더 경로

// let __sap_id_pw = "sap-user=shhong&sap-password=2wsxzaq1!"; //WS3.0 이관후 삭제대상!!!
let __sap_id_pw = ""; //WS3.0 이관후 삭제대상!!!

// sap 서버 통신 url 
let _sURL_V = `${HOST}/zu4a_wbc/u4a_ipcmain/update_check`,
    _sURL_U = `${HOST}/zu4a_wbc/u4a_ipcmain/ws_update_file_get`;
    
// Worker 경로
let _sWorkerPath = PATH.join(APPPATH, "lib", "ws", "worker", "majorUpdateWorker.js");

//----------------------------------------------------------------//
// 로컬 전역 펑션 
//----------------------------------------------------------------//

//procces event call
function __fireEvent(node, eventName, param) {

    var doc;
    if (node.ownerDocument) {
        doc = node.ownerDocument;
    } else if (node.nodeType == 9) {
        // the node may be the document itself, nodeType 9 = DOCUMENT_NODE
        doc = node;
    } else {
        throw new Error("Invalid node passed to fireEvent: " + node.id);
    }
    if (node.dispatchEvent) {
        // Gecko-style approach (now the standard) takes more work
        var eventClass = "";
        // Different events have different event classes.
        // If this switch statement can't map an eventName to an eventClass,
        // the event firing is going to fail.
        switch (eventName) {
            case "checking-for-update-sap": //업데이트 확인 
            case "update-available-sap": //업데이트 가능 
            case "update-not-available-sap": //최신버젼 
            case "download-progress-sap": //다운로드중 ..
            case "update-downloaded-sap": //다운로드중 완료 
            case "update-error-sap": //오류  
                eventClass = "HTMLEvents";
                break;
            default:
                throw "fireEvent: Couldn't find an event class for event '" + eventName + "'.";
                break;
        }
        var event = doc.createEvent(eventClass);
        event.params = param;

        var bubbles = eventName == "change" ? false : true;
        event.initEvent(eventName, bubbles, true); // All events created as bubbling and cancelable.
        event.synthetic = true; // allow detection of synthetic events
        // The second parameter says go ahead with the default action
        node.dispatchEvent(event, true);
    } else if (node.fireEvent) {
        // IE-old school style
        var event = doc.createEventObject();
        event.synthetic = true; // allow detection of synthetic events
        node.fireEvent("on" + eventName, event);
    }
}

/**
 * 업데이트 파일을 워커로 다운
 */
function _getUpdateFileWorker(oPARAM) {

    let oWsVerInfo = oPARAM.WSVER_INFO;     // 설치할 WS 버전 정보
    let oLoginInfo = oPARAM.LOGIN_INFO;     // 로그인 정보

    let oWorker = new Worker(_sWorkerPath);

    oWorker.onmessage = function(e){
        
        var oIF_DATA = e?.data || undefined;
        if(!oIF_DATA){

            try {
                oWorker.terminate();
                console.log("worker terminate - [WORKER-001]");
            } catch (error) {
                
            }

            var aConsoleMsg = [              
              `[PATH]: www/lib/ws/electron-updater-sap.js`,  
              `=> _getUpdateFileWorker`,
              `=> oWorker.onmessage`,                    
              `=> oIF_DATA undefined`,
              `[WORKER-001]`                   
            ];
            console.error(aConsoleMsg.join("\r\n"));
            console.trace();
            

            // [MSG - M002] U4A Workspace 업데이트 파일을 다운받는 과정에 문제가 발생하였습니다.
            // [MSG - M003] 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
            let sErrMsg = GS_MSG.M002 + "\n\n";
                sErrMsg += GS_MSG.M003;

            // 응답 오류!!
            __fireEvent(document, 'update-error-sap', {
                message: `[WORKER-001] ${sErrMsg}`
            });

            return;
        }
        
        switch (oIF_DATA.PRCCD) {
            
            case "download-progress-sap": //다운로드중 ..

                var _oPARAM = oIF_DATA.PARAM;

                let sTotal = _oPARAM.TOTAL;
                let iCount = _oPARAM.COUNT;
                var sLog   = _oPARAM?.LOG || "";
                
                console.log(sLog);

                //다운로드중 ..event 핸들러 call
                __fireEvent(document, 'download-progress-sap', {
                    TOTAL: sTotal,
                    jobCnt: iCount
                });

                return;

            case "update-downloaded-sap": // 다운로드 완료 

                try {
                    oWorker.terminate();
                    console.log("worker terminate - [update-downloaded-sap]");
                } catch (error) {
                    
                }

                //다운로드중 완료 ..event 핸들러 call
                __fireEvent(document, 'update-downloaded-sap', {
                    message: "다운로드 완료"
                });

                return;

            case "update-error-console": // 콘솔 오류 대상

                // 로그 정보가 있을 경우에는 콘솔 오류에 로그 정보를 담는다
                var sLog = "";
                var _oPARAM = oIF_DATA?.PARAM || undefined;
                if(_oPARAM?.LOG){
                    sLog = _oPARAM.LOG;
                }  

                console.error(sLog);

                return;

            case "update-error-sap": //오류

                try {
                    oWorker.terminate();
                    console.log("worker terminate - [update-error-sap]");
                } catch (error) {
                    
                }                

                // 로그 정보가 있을 경우에는 콘솔 오류에 로그 정보를 담는다
                var sLog = "";
                var _oPARAM = oIF_DATA?.PARAM || undefined;
                if(_oPARAM?.LOG){
                    sLog = _oPARAM.LOG;
                }

                // 콘솔용 오류 메시지
                var aConsoleMsg = [             
                    `[PATH]: www/lib/ws/electron-updater-sap.js`,  
                    `=> _getUpdateFileWorker`,
                    `=> oWorker.onmessage`,
                    `=> update-error-sap`,
                    `[WORKER-${oIF_DATA.STCOD}]`,
                    `[Log]: ${sLog}`
                ];
                console.error(aConsoleMsg.join("\r\n"), oIF_DATA);
                console.trace();       
                
                // [Default Error Msg] 
                // U4A Workspace 업데이트 파일을 다운받는 과정에 문제가 발생하였습니다.
                // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                var sDefErrMsg = GS_MSG.M002 + "\n\n";
                    sDefErrMsg += GS_MSG.M003;

                var sErrMsg = GS_MSG[oIF_DATA.MSGNR];

                // MSGNR에 해당하는 메시지가 있을 경우 추가 메시지 내용을 덧붙인다.
                if(sErrMsg){
                    sErrMsg += "\n\n" + GS_MSG.M003; // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                }

                sErrMsg = sErrMsg || sDefErrMsg;
                
                // 응답 오류!!
                __fireEvent(document, 'update-error-sap', {
                    message: `[WORKER-${oIF_DATA.STCOD}]\n${sErrMsg}`
                });

                return;
        
            default:                

                return;
        }

    };

    // WS Setting Json 정보
    let oSettings = getSettingsInfo();

    // WS Setting Json 정보에서 powerShell 관련 정보
    let oPsInfo   = oSettings.ps;

    // WS Setting Json 정보에서 powerShell 파일 루트 경로
    let sPsRootPath = oPsInfo.rootPath;

    // WS Setting Json 정보에서 powerShell 실행 파일 경로
    let sWsMajorPsPath = oPsInfo.ws_major;

    // WS 설치 파일 다운로드 경로
    let sInstFileDownPath = PATH.join(APP.getPath("userData"), oWsVerInfo.UPDT_FNAME);

    /**
     * @description
     * 
     * WS 설치 파일 다운로드 경로를 전역변수에 저장.
     * 
     * 설치가 정상적으로 완료되면 마지막에 quitAndInstall 호출 시 
     * 해당 function에서 설치 파일 다운로드 경로를 참조함.
     */
    __downPath = sInstFileDownPath;

    // Package 여부에 따른 PowerShell 파일 경로
    // let sPsPath = PATH.join(APPPATH, sPsRootPath /* ext_api/ps */, sWsMajorPsPath /* WS_PATCH/ws_major_update.ps1 */);
    
    // if(APP.isPackaged){
    //     sPsPath = PATH.join(process.resourcesPath, "www",  sPsRootPath /* ext_api/ps */, sWsMajorPsPath /* WS_PATCH/ws_major_update.ps1 */);
    // }

    /**
     * @since   2025-04-24
     * @version 3.5.5-sp0
     * @author  soccerhs
     * 
     * @description
     * ## Powershell 경로 변경
     *
     * - 기존: [extraResource]/www/ext_api
     * - 변경: [UserData]/ext_api
     */

    let sPsPath = PATH.join(APP.getPath("userData"), sPsRootPath /* ext_api/ps */, sWsMajorPsPath /* WS_PATCH/ws_major_update.ps1 */);

    // // powerShell 실행 파일이 없을 경우 오류!!
    // if(FS.existsSync(sPsPath) === false){

    //     try {
    //         oWorker.terminate();
    //         console.log("worker terminate - [WORKER-002]");
    //     } catch (error) {
            
    //     }

    //     __fireEvent(document, 'update-error-sap', {
    //         message: `[WORKER-002 ${GS_MSG.M002}`
    //     });

    //     return;
    // }

    // 일렉트론 리소스 경로
    let sResourcePath = process.resourcesPath;

    // 로그 저장 폴더 경로
    let sLogFolderPath = PATH.join(USERDATA, "logs", "u4a_ws_major");
    
    if(APP.isPackaged){
        sLogFolderPath = PATH.join(USERDATA, "logs");
    }

    /**
     * @since   2026-02-04 23:32:31
     * @version v3.5.9-3
     * @author  soccerhs
     * @description
     * 
     * 메이저 업그레이드 전, 로그 폴더 생성
     * 
     */
    if(FS.existsSync(sLogFolderPath) === false){
        FS.mkdirSync(sLogFolderPath, { recursive: true });
    }

    let oServerSettings = oLoginInfo?.SERVER_SETTINGS || undefined;

    // Base Url 설정
    let sBaseUrl = parent.getServerHost();

    /**
     * @since   2025-11-07 15:06:07
     * @version v3.5.6-16
     * @author  soccerhs
     * @description
     * 
     * 서버 설정값에 내부 인터널 주소 설정이 되어있다면 내부 호스트를 BaseUrl로 지정한다.
     *      
     */
    if(oServerSettings && oServerSettings.useInternal === true){
        sBaseUrl = oLoginInfo.META.HOST;
    }

    /**
     * @since   2026-02-09 15:27:05
     * @version v3.5.9-3
     * @author  soccerhs
     * @description
     * 
     * 패치 업그레이드 방식 변경
     * - 기존: powershell
     * - 변경: executor node.exe
     */
    
    // Node 기반 Executor 실행 경로
    let sExecutorNodeExePath = PATH.join(sResourcePath, "node_modules", "U4A", "SUPPORT", "executor-node", "index.exe");
    if(FS.existsSync(sExecutorNodeExePath) === false){

        console.error("Major Update downloader executable (Node executor) not found.");

        __fireEvent(document, 'update-error-sap', {
            message: GS_MSG.M004
        });

        return;
    }


    // 파워쉘 실행 파라미터
    let _oPARAM = {
        PS_PATH      : sPsPath,
        BASE_URL     : sBaseUrl,
        SAP_CLIENT   : oLoginInfo.CLIENT,
        SAP_USER     : oLoginInfo.ID,
        SAP_PW       : oLoginInfo.PW,
        DOWN_PATH    : PATH.join(sInstFileDownPath, ".."),
        FILE_INFO    : oWsVerInfo,
        LOG_FLD_PATH : sLogFolderPath,      // 파워쉘 로그 저장 폴더 경로
        SKIP_CERT    : false,               // https 인증서 오류 회피
        EXE_NODE_PATH: sExecutorNodeExePath
    };

    /**
     * @since   2025-12-10 17:57:03
     * @version v3.5.6-17
     * @author  soccerhs
     * @description
     * 
     * https 인증서 오류 회피 옵션 추가
     * 
     */
    if(oServerSettings && oServerSettings.skipCertificate === true){
        _oPARAM.SKIP_CERT = true;
    }

    // 공통 IF 구조
    let oIF_DATA = JSON.parse(JSON.stringify(TY_IFDATA));

    oIF_DATA.PRCCD = "WS_MAJOR_UPDATE";
    oIF_DATA.PARAM = _oPARAM;

    oWorker.postMessage(oIF_DATA);   

}

//----------------------------------------------------------------//
// 메인 
//----------------------------------------------------------------//
exports.autoUpdaterSAP = {

    // 글로벌 언어 정보 가져오기
    getGlobalMsg: function(){

        // WS Setting Json 정보
        let oSettingInfo = parent.getSettingsInfo();

        let sWsLangu = oSettingInfo.globalLanguage;

        const WSUTIL = parent.WSUTIL;

        GS_MSG.M001 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "296"); // U4A Workspace 버전 정보를 조회 하는 도중에 문제가 발생하였습니다.
        GS_MSG.M002 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "297"); // U4A Workspace 업데이트 파일을 다운받는 과정에 문제가 발생하였습니다.
        GS_MSG.M003 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "290"); // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.        
        GS_MSG.M004 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "493") + "\n\n" + GS_MSG.M003;  // U4A Workspace 업데이트 파일을 다운로드하는 데 필요한 실행 파일을 찾을 수 없습니다.

    },

    //이벤트 핸들러 등록 
    on: function (evtNM, cb) {
        document.addEventListener(evtNM, cb);
    },

    // == 점검 수행 ==
    checkForUpdates: function (appVer, oServerInfo) {
        
        //업데이트 확인 이벤트 수행 
        __fireEvent(document, 'checking-for-update-sap', {
            message: "check version"
        });

        // 글로벌 언어 정보 가져오기
        this.getGlobalMsg();

        __downPath = "";

        //현재 WS3.0 앱 버전 
        __appVer = appVer;        

        var oFormData = new FormData();

        // (New) 신규 개선된 업데이트에 대한 플래그
        oFormData.append("NEW_UPCK", "X");

        var xhr = new XMLHttpRequest();

        xhr.open("POST", _sURL_V, true);

        xhr.onreadystatechange = function (oEvent) {
            if (xhr.readyState == XMLHttpRequest.DONE) {

                /*****************************************************************
                 * 이전로직 ----------------Start
                 *****************************************************************/
                // try {

                //     //정상적으로 파싱된다는건 서버측에서 처리 오류 메시지를 리턴받앗다는 의미임 !!
                //     var sRET = JSON.parse(xhr.response);

                //     //업데이트 오류 발생 
                //     // __fireEvent(document, 'update-error-sap', sRET);

                //     // 20240708 soccerhs: 오류 발생시 오류 메시지 데이터를 공통 구조로 매핑함
                //     __fireEvent(document, 'update-error-sap', {
                //         message: sRET.RTMSG
                //     });

                //     return;

                // } catch (error) {

                //     var YAML = REMOTE.require('yamljs');

                //     //download exe update file name 
                //     __updateFilename = xhr.getResponseHeader('UPDT_FNAME');

                //     var nativeObject = YAML.parse(xhr.response);

                //     //var appVER = "V1.0.4";//현재 app 버젼  oAPP.remote.app.getVersion()
                //     var appVer = "";
                //     var updVER = nativeObject.version; //등록되있는 서버 업데이트 버젼 

                //     var regex = /[^0-9]/g;
                //     appVer = Number(__appVer.replace(regex, "")); //현재 app 버젼  oAPP.remote.app.getVersion()
                //     updVER = Number(updVER.replace(regex, "")); //등록되있는 서버 업데이트 버젼  

                //     if (appVer < updVER) {
                //         //업데이트 가능 
                //         __fireEvent(document, 'update-available-sap', {
                //             message: "업데이트가능"
                //         });

                //         __ofs = REMOTE.require('fs');

                //         //get update file - exe
                //         __getUpdateFile();

                //     } else {
                //         //최신버젼 
                //         __fireEvent(document, 'update-not-available-sap', {
                //             message: "최신버젼",
                //             verInfo: {                                
                //                 appVer: appVer,
                //                 updVER : updVER
                //             }
                //         });

                //     }

                // }

                /*****************************************************************
                 * 이전로직 ---------------- End
                 *****************************************************************/


                /*****************************************************************
                 * 📝 TO-BE ---------Start
                 *****************************************************************/

                // /**
                //  * @description 
                //  * 신규 업데이트 버전에 따른 로직 변경
                //  *                  
                //  * @author soccerhs
                //  * @version 3.5.0-sp7
                //  * @date 2025-02-25                               
                //  */

                // try {
                   
                //     var oWsVerInfo = JSON.parse(xhr.response);
                //     var updVER = oWsVerInfo.VERSN;

                //     var regex = /[^0-9]/g;
                 
                //     appVer = Number(__appVer.replace(regex, "")); //현재 app 버젼  oAPP.remote.app.getVersion()
                //     updVER = Number(updVER.replace(regex, "")); //등록되있는 서버 업데이트 버젼  

                //     if (appVer < updVER) {

                //         //업데이트 가능 
                //         __fireEvent(document, 'update-available-sap', {
                //             message: "업데이트가능"
                //         });

                //         let oPARAM = {
                //             WSVER_INFO : oWsVerInfo,         // 서버의 최신 WS 버전 정보
                //             LOGIN_INFO : oServerInfo.LOGIN   // 현재 접속하려는 서버의 정보(SYSID, LOGIN 정보등)
                //         };

                //         // 업데이트 파일을 워커로 다운
                //         _getUpdateFileWorker(oPARAM);

                //     } else {

                //         //최신버젼 
                //         __fireEvent(document, 'update-not-available-sap', {
                //             message: "최신버젼",
                //             verInfo: {                                
                //                 appVer: appVer,
                //                 updVER : updVER
                //             }
                //         });

                //     }

                // } catch (error) {

                //     console.error(error);
                //     console.trace();

                //     __fireEvent(document, 'update-error-sap', {
                //         message: GS_MSG.M001 // 버전 정보 구하는 도중에 문제가 발생하였습니다
                //     });

                //     return;

                // }

                /*****************************************************************
                 * TO-BE ---------End
                 *****************************************************************/

                // 1. 오류가 있는지 먼저 체크한다.
                try {
                    
                    //정상적으로 파싱된다는건 서버측에서 처리 오류 메시지를 리턴받앗다는 의미임 !!
                    var oRES = JSON.parse(xhr.response);
                    if(oRES.RETCD === "E"){

                        // 20240708 soccerhs: 오류 발생시 오류 메시지 데이터를 공통 구조로 매핑함
                        __fireEvent(document, 'update-error-sap', {
                            message: oRES?.RTMSG || ""
                        });

                        return;
                    }

                } catch (error) {
                    
                }


                try {

                    var oWsVerInfo = {};

                    var appVer = "";

                    var updVER = "";

                    var regexVer = /[^0-9]/g;

                    // 1. header (UPDT_FNAME) 부터 읽어서 이전 소스인지 아닌지 판단한다.
                    let sUpdateFilename = xhr.getResponseHeader('UPDT_FNAME');
                    if(sUpdateFilename){

                        // 2026-10-27 Electron 45: REMOTE.require 는 npm 모듈을 못 찾는다 — 앱 본체 require 로 부른다.
                        var YAML = REMOTE.getGlobal("mainRequire")('yamljs');

                        var nativeObject = YAML.parse(xhr.response);

                        updVER = nativeObject.version; //등록되있는 서버 업데이트 버젼 
                        
                        appVer = Number(__appVer.replace(regexVer, "")); //현재 app 버젼  oAPP.remote.app.getVersion()
                        updVER = Number(updVER.replace(regexVer, "")); //등록되있는 서버 업데이트 버젼  

                        oWsVerInfo.VERSN = updVER;
                        
                    }
                    else {

                        oWsVerInfo = JSON.parse(xhr.response);

                        updVER = oWsVerInfo?.VERSN || "";

                        if(!updVER){

                            __fireEvent(document, 'update-error-sap', {
                                message: GS_MSG.M001 // 버전 정보 구하는 도중에 문제가 발생하였습니다
                            });

                            // 콘솔용 오류 메시지
                            var aConsoleMsg = [             
                                `[PATH]: www/lib/ws/electron-updater-sap.js`,  
                                `=> checkForUpdates`,
                                `=> xhr.onreadystatechange`,
                                `=> oWsVerInfo: ${oWsVerInfo}`,  
                            ];

                            console.error(aConsoleMsg.join("\r\n"));
                            console.trace();

                            return;
                        }
                        
                        appVer = Number(__appVer.replace(regexVer, "")); //현재 app 버젼  oAPP.remote.app.getVersion()
                        updVER = Number(updVER.replace(regexVer, "")); //등록되있는 서버 업데이트 버젼

                    }

                    if (appVer < updVER) {

                        //업데이트 가능 
                        __fireEvent(document, 'update-available-sap', {
                            message: "업데이트가능"
                        });

                        let oPARAM = {
                            WSVER_INFO : oWsVerInfo,         // 서버의 최신 WS 버전 정보
                            LOGIN_INFO : oServerInfo.LOGIN   // 현재 접속하려는 서버의 정보(SYSID, LOGIN 정보등)
                        };

                        // 업데이트 파일을 워커로 다운
                        _getUpdateFileWorker(oPARAM);

                    } else {

                        //최신버젼 
                        __fireEvent(document, 'update-not-available-sap', {
                            message: "최신버젼",
                            verInfo: {                                
                                appVer: appVer,
                                updVER : updVER
                            }
                        });

                    }


                } catch (error) {
                        
                    console.error(error);
                    console.trace();

                    __fireEvent(document, 'update-error-sap', {
                        message: GS_MSG.M001 // 버전 정보 구하는 도중에 문제가 발생하였습니다
                    });

                    return;

                }

            }

        };

        xhr.send(oFormData);

    },   

    quitAndInstall: function () {

        if (__downPath !== "") {

            // 재실행 할 파일경로를 지정한다.
            REMOTE.app.relaunch({
                execPath: __downPath
            });

            // 앱을 종료한다.
            REMOTE.app.exit(0);
        }

    }

};