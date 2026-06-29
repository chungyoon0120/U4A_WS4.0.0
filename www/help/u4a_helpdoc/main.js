/* ***************************************************************** */
// 설치 npm 
// 
/* ***************************************************************** */

/* ***************************************************************** */
// I/F 필드 정의 
/* ***************************************************************** */
/*
 */
/* ***************************************************************** */
/* ***************************************************************** */
/* 사용 예시 
    var HelpDoc = require(oAPP.path.join(__dirname, 'HelpDocument/main.js'));

    Help Document 수행 
        - 파라메터 설명 
            REMOTE         : electron remote 오브젝트 
            DOWN_ROOT_PATH : 다운로드 처리할 폴더 경로 

        - 아래 펑션을 수행전  (busy indicator 수행) 처리함 

            var retdata = await HelpDoc.Excute(oAPP.remote, "D:\\DOWNLOAD"); 
            retdata.RETCD <-- E:오류 
            retdata.RTMSG <-- 처리 메시지 
      
        - (busy indicator 종료)
*/
/* ***************************************************************** */
/* ***************************************************************** */
/* 내부 광역 변수  
/* ***************************************************************** */

// 응답 공통 구조
let TY_RES = {
    RETCD: "",
    STCOD: "",
    RTMSG: "",
};

// IF 구조
const TY_IFDATA = {
    PRCCD: "",      // 수행중인 프로세스 코드    
    ACTCD: "",      // 수행중인 행위에 대한 코드     
    PARAM: "",      // 수행 결과에 대한 데이터
};

const REMOTE = parent.REMOTE;
const APP = REMOTE.app;
const APPPATH = APP.getAppPath();
const FS = require("fs");
const USERDATA = APP.getPath("userData");
const PATH = require("path");
const ADMZIP = require("adm-zip");

const DOCU_VIEWER = require(PATH.join(APPPATH, 'help', 'u4a_helpdoc', 'viewer', 'u4a-ws30-help', 'helpViewer.js'));

// 로그인 사용자 정보
const GV_USER_INFO = parent.getUserInfo();
const LANGU = GV_USER_INFO.LANGU;


const GS_MSG = {
    M01: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "367", "", "", "", ""), //"Help Document 처리 통신 오류",
    M02: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "368", "", "", "", ""), //"Help Document 다운로드 처리 과정에서 해더 정보 누락되었습니다",
    M03: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "369", "", "", "", ""), //"Help Document 분할 파일정보를 가져오는 과정에서 오류가 발생하였습니다.",
    M04: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "370", "", "", "", ""), //"Help Document 분할 다운로드 처리 과정에서 오류 발생",
    M05: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "371", "", "", "", ""), //"처리 완료",
    M06: oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "372", "", "", "", ""), //"Help Document 버젼 파일 생성중 오류 발생",
    M07: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B44", "", "", "", ""), // U4A Help Document
    M08: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B78", "", "", "", ""), // Download
    M09: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "290"), // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.

    // Help Document를 다운로드하는 데 필요한 실행 파일을 찾을 수 없습니다.
    M10: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "495") + "\n\n" + parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "290"),
    M11: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "498"), // Help Document 실행 준비중
    M12: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "499"), // Help Document 압축 해제중
    M13: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "500"), // Help Document 압축 해제중 오류가 발생하였습니다.
    M14: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "501"), // Help Document 압축 해제 완료
    M15: parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "502"), // 잠시 후 실행 됩니다.
    
};

let GV_HOST = parent.getHost();



/* ***************************************************************** */
/* 내부 전역 펑션 
/* ***************************************************************** */

/************************************************************************
 * @function - 압축 해제
 ************************************************************************/
function _zipExtractAsync(sSourcePath, sTargetPath, pOverwrite){

    return new Promise(function(resolve){

        try {
            var zip = new ADMZIP(sSourcePath);

            zip.extractAllToAsync(sTargetPath, pOverwrite, (err) => {

                if (err) {
                    resolve({ RETCD: "E" });
                    return;
                }

                resolve({ RETCD: "S" });

            });

        } catch (error) {
            return resolve({ RETCD: "E" });            
        }

    });

} // end of _zipExtractAsync


//파일 삭제 
async function gfn_fileDel(oFS, PATH) {
    return new Promise((resolve, reject) => {

        try {
            oFS.unlink(PATH, (e) => { });
        } catch (error) {

        }

        resolve();

    });
}

//파일 이동
async function gfn_FileMove(oFS, NEW_PATH, OLD_PATH) {
    return new Promise((resolve, reject) => {

        oFS.rename(OLD_PATH, NEW_PATH, function (err) {
            if (err) { }

            resolve();

        });

    });
}

//Help document 해더 정보 추출
async function gfn_getHeadData() {
    return new Promise((resolve, reject) => {

        // var LV_URL = GV_HOST + "/zu4a_wbc/u4a_ipcmain/U4A_HELP_DOC_WS30?PRCCD=HEAD";

        /**
         * @since   2025-02-11 10:38:52
         * @version v3.5.1-1
         * @author  soccerhs
         * @description
         * 
         * Help Document 헤더 정보 요청 시 언어 정보까지 전달.
         * 
         */
        var LV_URL = `${GV_HOST}/zu4a_wbc/u4a_ipcmain/U4A_HELP_DOC_WS30?PRCCD=HEAD&LANGU_OUT=${GV_USER_INFO.LANGU}`;
        var xhttp = new XMLHttpRequest();
        xhttp.onerror = (e) => {
            resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M01
            });
        }; //통신오류
        xhttp.ontimeout = () => {
            resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M01
            });
        }; //통신오류
        xhttp.onload = (e) => {

            try {
                var sDATA = JSON.parse(e.target.response);
            } catch (error) {
                resolve({
                    RETCD: "E",
                    RTMSG: GS_MSG.M01
                }); //통신오류
                return;
            }

            if(sDATA?.RETCD === "E"){
                
                var sErrMsg = parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sDATA.MSGNR) + "\n\n";
                    sErrMsg += GS_MSG.M09; // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.

                return resolve({                    
                    RETCD: "E",                    
                    RTMSG: sErrMsg

                }); //통신오류               
                

            }

            resolve({
                RETCD: "S",
                RTMSG: "",
                DATA: sDATA
            });
            return;

        };

        xhttp.open("GET", LV_URL, true);
        xhttp.withCredentials = true;
        xhttp.send();

    });
}

//File 존재여부 점검
async function gfn_file_existence(oFS, FOLD_PATH, CHK_FNAME) {
    return new Promise((resolve, reject) => {
        oFS.readdir(FOLD_PATH, (err, files) => {
            var isFnd = false;
            files.forEach(file => {
                if (file === CHK_FNAME) {
                    isFnd = true;

                }
            });

            resolve(isFnd);

        });
    });

}

// 프로그레스바 다이얼로그 열기
function gfn_openProgressDialogOpen(oDialogOptions = {}) {

    // let oFrame = document.getElementById("ws_frame");
    // if (!oFrame) {
    //     return;
    // }

    // let oConWin = oFrame.contentWindow;
    // if (!oConWin || !oConWin.oAPP) {
    //     return;
    // }

    let oAPP = parent.oAPP,
        sTitle = `${GS_MSG.M07} ${GS_MSG.M08}`;

    let oInitOptions = {
        description: sTitle,
        // title: sTitle,
        illustrationType: "tnt-Systems",
        ...oDialogOptions
    };

    oAPP.common.fnProgressDialogOpen(oInitOptions);

} // end of gfn_openProgressDialog

// 프로그레스바 다이얼로그 닫기
function gfn_closeProgressDialog() {

    // let oFrame = document.getElementById("ws_frame");
    // if (!oFrame) {
    //     return;
    // }

    // let oConWin = oFrame.contentWindow;
    // if (!oConWin || !oConWin.oAPP) {
    //     return;
    // }

    let oAPP = parent.oAPP;

    oAPP.common.fnProgressDialogClose();

} // end of gfn_closeProgressDialog

function gfn_setProgressbar(iValue, iTotalValue) {

    // let oFrame = document.getElementById("ws_frame");
    // if (!oFrame) {
    //     return;
    // }

    // let oConWin = oFrame.contentWindow;
    // if (!oConWin || !oConWin.sap) {
    //     return;
    // }

    // // sap 인스턴스 여부 확인
    // let sap = oConWin.sap;
    // if (!sap) {
    //     return;
    // }

    // 혹시나 나눗셈 할때 0으로 나누는지 확인
    if (!isFinite(iValue / iTotalValue)) {
        return;
    }

    let sPerValue = (iValue / iTotalValue) * 100;

    sPerValue = sPerValue.toFixed(2);

    // 계산된 퍼센트 값이 100이 넘으면 100으로 고정
    if(sPerValue >= 100){
        sPerValue = 100;
    }

    let sMsg = `${GS_MSG.M08}.....${sPerValue}%`;

    // [HTML5] 구 sap.ui.getCore().byId("u4aWsProg").setPercentValue/setDisplayValue 대체.
    //   진행 팝업이 네이티브 <dialog> 로 변환됨 → 공통 갱신 함수 호출(parent = WS 메인 프레임).
    //   (원본의 oProgressbar null 가드 대응 — 함수 미정의 시 워커 메시지 처리 중 크래시 방지.)
    try {
        if (parent.oAPP && parent.oAPP.common &&
            typeof parent.oAPP.common.fnProgressDialogSetValue === "function") {
            parent.oAPP.common.fnProgressDialogSetValue(sPerValue, sMsg);
        }
    } catch (e) { }

} // end of gfn_setProgressbar


function _waiting(iTime = 1000) { 
    return new Promise(resolve => setTimeout(resolve, iTime)); 
}

/**
 * @since   2026-05-20 13:26:32
 * @version v3.6.3-0
 * @author  soccerhs
 * @description
 * 
 * Help Document를 실행하고, 로드 완료될때까지 기다리는 함수.
 * 
 */
function openHelpDocViewer(oOpenOptions){

    return new Promise(function(resolve){

        let oHelpViewer = DOCU_VIEWER(oOpenOptions);

        oHelpViewer.once('load-finish', function(){
            resolve();
        });

    });

} // end of openHelpDocViewer


/************************************************************************
 * @function - 압축 해제 후 Document 실행
 ************************************************************************/
async function _zipDocuOpen(oOptions){    

    // 공통 응답 구조
    var oRES = JSON.parse(JSON.stringify(TY_RES)); 

    let sDocFilePath = oOptions.docFilePath;
    let sTheme       = oOptions.theme;
    let iWidth       = oOptions.width;
    let iHeight      = oOptions.height;
    let sVersion     = oOptions.version;
    let sStartMenuId = oOptions.startMenuId;
    
    let sFolderName = PATH.parse(sDocFilePath).name;
    let sTargetPath = PATH.dirname(sDocFilePath);    
    let sExtractFolderPath = PATH.join(sTargetPath, sFolderName);
    let sDocuIndexPath = PATH.join(sExtractFolderPath, "index.html");

    let oOpenOptions = {};        
        oOpenOptions.helpSiteRoot       = sExtractFolderPath;
        oOpenOptions.theme              = sTheme;

    if(iWidth){ oOpenOptions.width      = iWidth; }
    if(iHeight){ oOpenOptions.width     = iHeight; }
    if(sVersion){ oOpenOptions.version  = sVersion; }
    if(sStartMenuId){ oOpenOptions.startMenuId = sStartMenuId; }

    // 기존에 다운받은 document 가 있다면 바로 실행한다.
    if(FS.existsSync(sDocuIndexPath) === true){

        // DOCU_VIEWER(oOpenOptions);
        
        // Help Document 실행 (실행 완료시 await 종료됨.)
        await openHelpDocViewer(oOpenOptions);

        oRES.RETCD = "S";    

        return oRES;

    }
    
    // 해당 버전에 맞는 document 폴더를 생성한다.
    if(FS.existsSync(sExtractFolderPath) === false){        
        FS.mkdirSync(sExtractFolderPath, { recursive: true });
    } 

    // 압축 풀고 있다는 메시지 출력
    gfn_openProgressDialogOpen({
        description: GS_MSG.M12 + "....", // Help Document 압축 푸는 중....
        percentValue: 100
    });

    // document zip 파일을 압축 푼다
    let oZipExtResult = await _zipExtractAsync(sDocFilePath, sExtractFolderPath, true);
    if(oZipExtResult.RETCD === "E"){
       
        // Help Document 압축 해제중 오류가 발생하였습니다.
        var sErrMsg = GS_MSG.M13 + "\n\n" + GS_MSG.M09;

        oRES.RETCD = "E";
        oRES.RTMSG = sErrMsg;
        
        return oRES;
    }

    // 압축 풀고 있다는 메시지 출력
    gfn_openProgressDialogOpen({
        description: GS_MSG.M14 + "\n\n" + GS_MSG.M15, // Help Document 압축 해제 완료 잠시 후 실행 됩니다.
        percentValue: 100,
    });

    // 일부러 딜레이 2초 줌.. ProgressDialog 메시지 한번 보라구..
    await _waiting(2000);

    /**
     * 기존 ZIP 파일을 삭제하면 안됨!!
     * - 사유: Document 다운 워커 안에서 해당 파일이 없으면 다시 다운 받는 로직으로 되어 있음!!
     */
    // 기존 다운 받은 ZIP 파일이 남아 있으면 삭제한다.
    // if(FS.existsSync(sDocFilePath) === true){
    //     try { FS.unlinkSync(sDocFilePath); } catch (error) {}
    // }

    // DOCU_VIEWER(oOpenOptions);

    // Help Document 실행 (실행 완료시 await 종료됨.)
    await openHelpDocViewer(oOpenOptions);

    oRES.RETCD = "S";    

    return oRES;

} // end of _zipDocuOpen


/**
 * @since   2025-02-27
 * @version 3.5.0-sp7
 * @author  soccerhs
 * 
 * @description
 * Help Document 파일 다운로드
 * 
 * @returns
 * resolve의 Return 구조는 다음과 같이 한다.
 * 
 * resolve({
 *    RETCD: "",      // 리턴코드 S: 성공, E: 오류)
 *    RTMSG: "",      // 리턴코드에 대한 메시지
 * }); 
 */
function _getHelpDocFileDown(oPARAM){

    const PARAMS = oPARAM;

    return new Promise(function(resolve){

        // Document 다운로드 처리에 대한 Worker js
        let _sWorkerPath = PATH.join(APPPATH, "help", "u4a_helpdoc", "workers", "u4aHelpDownWorker.js");

        let oWorker = new Worker(_sWorkerPath);

        oWorker.onmessage = async function(e){
            
            // 공통 응답 구조
            var oRES = JSON.parse(JSON.stringify(TY_RES)); 

            oRES.RETCD = "E";

            var oIF_DATA = e?.data || undefined;
            if(!oIF_DATA){

                // 실행 중인 워커를 종료시킨다.
                try {
                    oWorker.terminate();
                    console.log("worker terminate - [WORKER-001]");
                } catch (error) {
                    
                }

                var aConsoleMsg = [              
                    `[PATH]: www/help/u4a_helpdoc/main.js`,  
                    `=> _getHelpDocFileDown`,
                    `=> oWorker.onmessage`,                    
                    `=> oIF_DATA undefined`,
                    `[WORKER-001]`                   
                ];
                console.error(aConsoleMsg.join("\r\n"));
                console.trace();

                // Help Document 버젼 파일 생성중 오류 발생
                // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                let sErrMsg = GS_MSG.M06 + "\n\n";
                    sErrMsg += GS_MSG.M09;
             
                oRES.RTMSG = sErrMsg;

                resolve(oRES);

                return;
            }

          
            // 프로세스 코드에 따른 분기
            switch (oIF_DATA.PRCCD) {

                // 오류
                case "ERROR":

                    // 실행 중인 워커를 종료시킨다.
                    try {
                        oWorker.terminate();
                        console.log(`worker terminate - [PRCCD]: ${oIF_DATA.PRCCD}`);
                    } catch (error) {
                        
                    }            

                    // 로그 정보가 있을 경우에는 콘솔 오류에 로그 정보를 담는다
                    var sLog = "";
                    var oPARAM = oIF_DATA?.PARAM || undefined;
                    if(oPARAM?.LOG){
                        sLog = oPARAM.LOG;
                    }    

                    var aConsoleMsg = [              
                        `[PATH]: www/help/u4a_helpdoc/main.js`,  
                        `=> _getHelpDocFileDown`,
                        `=> oWorker.onmessage`,  
                        `[WORKER-${oIF_DATA.STCOD}]`,
                        `[Log]: ${sLog}`                  
                    ];
                    console.error(aConsoleMsg.join("\r\n"));
                    console.trace();
                    
                    // [Default Error Msg] Help Document 버젼 파일 생성중 오류 발생
                    // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                    var sDefErrMsg = GS_MSG.M06 + "\n\n";
                        sDefErrMsg += GS_MSG.M09;

                    var sErrMsg = GS_MSG[oIF_DATA.MSGNR];

                    // MSGNR에 해당하는 메시지가 있을 경우 추가 메시지 내용을 덧붙인다.
                    if(sErrMsg){
                        sErrMsg += "\n\n" + GS_MSG.M09; // 다시시도 하시거나, 문제가 지속될 경우 U4A 솔루션 팀에 문의 하세요.
                    }

                    // MSGNR에 해당하는 메시지가 없을 경우에는 기본값 메시지 내용을 출력한다.
                    oRES.RTMSG = sErrMsg || sDefErrMsg;

                    // 프로그래스 Dialog를 닫는다.
                    gfn_closeProgressDialog();

                    break;

                // Document 실행
                case "OPEN_DOCU":

                    console.log("help document open!!");

                    // // 압축 풀고 있다는 메시지 출력
                    // gfn_openProgressDialogOpen({
                    //     description: GS_MSG.M11 + "....", // Help Document 실행 준비중....
                    //     percentValue: 100
                    // });
                
                    // 실행 중인 워커를 종료시킨다.
                    try {
                        oWorker.terminate();
                        console.log(`worker terminate - [PRCCD]: ${oIF_DATA.PRCCD}`);
                    } catch (error) {
                        
                    }

                    var _oPARAM = oIF_DATA.PARAM;
                    var _sDocFilePath = _oPARAM.DOC_FILE_PATH;

                    /**
                     * @since   2026-03-17 19:31:07
                     * @version v3.6.0-3
                     * @author  soccerhs
                     * @description 
                     * [Help Document File Format 변경!]
                     * 
                     * - 기존: .chm
                     * - 변경: html (mkdocs)                     
                     * 
                     * - 내용:
                     *   Help Document 파일 포맷 변경에 따른, document 파일 실행 로직 분기
                     *   document 파일의 확장자가 zip 일 경우는 압축을 풀고 html 파일을
                     *   전용 viewer로 실행한다.
                     */
                    // 확장자 별 Document 열기
                    let sExtName = PATH.extname(_sDocFilePath);
                        sExtName = sExtName.toUpperCase();

                    switch (sExtName) {
                        case ".ZIP":           

                            let oThemeInfo = parent.getThemeInfo();
                            let sThemeName = oThemeInfo?.THEME || "";
                            
                            let sDocuTheme = "light";
                            if(sThemeName.endsWith("dark") === true){
                                sDocuTheme = "dark";
                            }                            

                            let oOpenOptions = {
                                docFilePath: _sDocFilePath,
                                theme: sDocuTheme,
                                width: 1500,
                                height: 1000,
                            };

                            // Help Document Options
                            let oHelpDocOptions = PARAMS?.HELP_DOC_OPT || undefined;
                            if(oHelpDocOptions && oHelpDocOptions.startMenuId){
                                oOpenOptions.startMenuId = oHelpDocOptions.startMenuId;
                            }

                            let oOpenResult = await _zipDocuOpen(oOpenOptions);

                            oRES.RETCD = oOpenResult?.RETCD;
                            oRES.RTMSG = oOpenResult?.RTMSG;

                            break;
                    
                        default:

                            REMOTE.shell.openPath(_sDocFilePath); //파일 실행 

                            oRES.RETCD = "S";
                            oRES.RTMSG = "";                   

                            break;
                    }

                    // 프로그래스 Dialog를 닫는다.
                    gfn_closeProgressDialog();

                    break;

                // 프로그래스바 Dialog Open
                case "PROG_DIALOG_OPEN": 

                    gfn_openProgressDialogOpen();

                    return;

                // 프로그래스바 Dialog Close
                case "PROG_DIALOG_CLOSE": 

                    gfn_closeProgressDialog();

                    return;

                // 파워쉘 수행 중 오류에 대한 로그 남기기
                case "update-error-console": 

                    // 로그 정보가 있을 경우에는 콘솔 오류에 로그 정보를 담는다
                    var sLog = "";
                    var _oPARAM = oIF_DATA?.PARAM || undefined;
                    if(_oPARAM?.LOG){
                        sLog = _oPARAM.LOG;
                    }  

                    console.error(sLog);

                    return;

                // 프로그래스바 데이터 설정
                case "SET_PROG_DATA":

                    var _oPARAM = oIF_DATA.PARAM;

                    let iCount = _oPARAM.COUNT;
                    let iTotal = _oPARAM.TOTAL;
                    var sLog   = _oPARAM.LOG || "";

                    console.log(sLog);

                    gfn_setProgressbar(iCount, iTotal);

                    return;

                default:                

                    break;

            }

            // 실행 중인 워커를 종료시킨다.
            try {
                oWorker.terminate();
                console.log("worker terminate - END");
            } catch (error) {
                
            }

            resolve(oRES);

        };

        // 공통 IF 구조
        let oIF_DATA = JSON.parse(JSON.stringify(TY_IFDATA));

        oIF_DATA.PRCCD = "WS_HELP_DOCU_DOWN";
        oIF_DATA.PARAM = oPARAM;

        oWorker.postMessage(oIF_DATA);

    });

} // end of _getHelpDocFileDown

/*=================================================================== */
// Export Module Function - Help document 서버 Data 추출후 다운로드 처리
/*=================================================================== */
exports.Excute = async function (REMOTE, DOWN_ROOT_PATH, HELP_DOC_OPT) {
    //REMOTE         : electron remote 오브젝트 
    //HEAD_DATA      : Help document 해더 Data => getHeadData <- 이 펑션에서 추출한 Data
    //DOWN_ROOT_PATH : 다운로드 처리할 폴더 경로 

    return new Promise(async (resolve, reject) => {        

        //Help document 해더 정보 추출
        let HEAD_DATA = await gfn_getHeadData();

        //Help Document 다운로드 처리 과정에서 해더 정보 누락되었습니다
        if (typeof HEAD_DATA !== "object") {
            resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M02
            });
            return;
        }

        if(HEAD_DATA?.RETCD === "E"){
            return resolve(HEAD_DATA);
        }

        if (typeof HEAD_DATA.DATA !== "object") {
            resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M02
            });
            return;
        }

        if (typeof HEAD_DATA.DATA.RINDX === "undefined") {
            resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M02
            });
            return;
        }


        // 하위 버전 서버를 접속했을 경우에는
        // 헤더 정보에 아래의 필드(LANG_O, BLOBCNT) 가 없는데
        // PowerShell 에서는 필수 파라미터 이므로
        // 필요한 값을 정의해준다.
        if(typeof HEAD_DATA?.DATA?.LANG_O === "undefined"){
            HEAD_DATA.DATA.LANG_O = LANGU;
        }

        if(typeof HEAD_DATA?.DATA?.BLOBCNT === "undefined"){
            HEAD_DATA.DATA.BLOBCNT = HEAD_DATA.DATA.SPCNT;
        }
    

        // WS Setting Json 정보
        let oSettings = parent.getSettingsInfo();

        // WS Setting Json 정보에서 powerShell 관련 정보
        let oPsInfo   = oSettings.ps;

        // WS Setting Json 정보에서 powerShell 파일 루트 경로
        let sPsRootPath = oPsInfo.rootPath;

        // WS Setting Json 정보에서 powerShell 실행 파일 경로
        let sWsDocPath = oPsInfo.ws_help_doc;

        // Package 여부에 따른 PowerShell 파일 경로
        // let sPsPath = PATH.join(process.resourcesPath, "www",  sPsRootPath /* ext_api/ps */, sWsDocPath /* WS_HELP/ws_doc.ps1 */);

        // if(!APP.isPackaged){
        //     sPsPath = PATH.join(APPPATH, sPsRootPath /* ext_api/ps */, sWsDocPath /* WS_HELP/ws_doc.ps1 */);   
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
        let sPsPath = PATH.join(APP.getPath("userData"), sPsRootPath /* ext_api/ps */, sWsDocPath /* WS_HELP/ws_doc.ps1 */);


        // 로그인 사용자 정보
        let oLoginInfo = GV_USER_INFO;

        let oPATH = PATH;

        // 다운로드 파일 처리 경로 설정 
        let LV_ROOT_PATH = oPATH.join(DOWN_ROOT_PATH, "U4A_HELP_DOC");
        let LV_DOWN_PATH = oPATH.join(LV_ROOT_PATH, HEAD_DATA.DATA.LOCFN);

        // 다운로드 임시폴더 경로 설정 
        let LV_TMP_ROOT_PATH = oPATH.join(LV_ROOT_PATH, "U4A_HELP_DOC_TMP");
        let LV_TMP_DOWN_PATH = oPATH.join(LV_TMP_ROOT_PATH, HEAD_DATA.DATA.LOCFN);

        //Help document 버젼 파일 Path 설정 
        let LV_VESN_PATH = oPATH.join(LV_ROOT_PATH, "U4A_HELP_DOC_VER" + HEAD_DATA.DATA.VERSN + ".json");
        
        // 일렉트론 리소스 경로
        let sResourcePath = process.resourcesPath;

        /**
         * @since   2025-11-07 15:06:07
         * @version v3.5.6-16
         * @author  soccerhs
         * @description
         * 
         * 파워쉘에서 발생되는 로그를 남기기 위한 경로
         
         */
        // 로그 저장 폴더 경로
        let sLogFolderPath = PATH.join(USERDATA, "logs", "u4a_ws_help_doc");
        
        if(APP.isPackaged){
            sLogFolderPath = PATH.join(USERDATA, "logs");
        }

        /**
         * @since   2026-02-09 16:27:31
         * @version v3.5.9-3
         * @author  soccerhs
         * @description
         * 
         * Help Document 다운로드 전, 로그 폴더 생성
         * 
         */
        if(FS.existsSync(sLogFolderPath) === false){
            FS.mkdirSync(sLogFolderPath, { recursive: true });
        }

        /**
         * @since   2025-11-07 15:06:07
         * @version v3.5.6-16
         * @author  soccerhs
         * @description
         * 
         * 서버 설정값에 내부 인터널 주소 설정이 되어있다면 내부 호스트를 BaseUrl로 지정한다.
         *      
         */
        let oServerSettings = oLoginInfo?.SERVER_SETTINGS || undefined;

        // Base Url 설정
        let sBaseUrl = parent.getServerHost();

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
        
        
        let sNodeModulePath = PATH.join("node_modules", "U4A", "SUPPORT", "executor-node", "index.exe");

        // Node 기반 Executor 실행 경로
        let sExecutorNodeExePath = PATH.join(sResourcePath, sNodeModulePath);
        if(!APP.isPackaged){
            sExecutorNodeExePath = PATH.join(process.env.LOCALAPPDATA, "Programs", "com.u4a_ws3.app", "resources", sNodeModulePath);
        }

        if(FS.existsSync(sExecutorNodeExePath) === false){

            console.error("Help Document downloader executable (Node executor) not found.");

            return resolve({
                RETCD: "E",
                RTMSG: GS_MSG.M10
            });

        }

        let oPARAM = {

            // 파워쉘 파일 경로
            PS_DOC_PATH : sPsPath,

            BASE_URL     : sBaseUrl,
            SAP_CLIENT   : oLoginInfo.CLIENT,
            SAP_USER     : oLoginInfo.ID,
            SAP_PW       : oLoginInfo.PW,

            ROOT_PATH    : LV_ROOT_PATH,
            DOWN_PATH    : LV_DOWN_PATH,
            TMP_ROOT_PATH: LV_TMP_ROOT_PATH,
            TMP_DOWN_PATH: LV_TMP_DOWN_PATH,
            VESN_PATH    : LV_VESN_PATH,

            // Help Document Header Data
            HEAD_DATA    : HEAD_DATA,

            // 로그 폴더 경로
            LOG_FLD_PATH : sLogFolderPath,

            // https 인증서 오류 회피
            SKIP_CERT    : false,

            EXE_NODE_PATH: sExecutorNodeExePath,

            // Help Document 실행시 전달할 옵션
            HELP_DOC_OPT: HELP_DOC_OPT

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
            oPARAM.SKIP_CERT = true;
        }

        // Help Document 파일 다운로드
        let oResult = await _getHelpDocFileDown(oPARAM);

        resolve(oResult);

    }); //return new Promise( async (resolve, reject)


}; //exports.HelpDocDown