/****************************************************************************
 * 🔥 Global Variables
 ****************************************************************************/

    const TY_RES = {
        RETCD: "",      // 수행 결과에 대한 코드
        STCOD: "",      // 수행 결과에 대한 상태 코드   
        PRCCD: "",      // 수행 중인 프로세스 코드
        ACTCD: "",      // 수행 중인 행위에 대한 코드         
        RTMSG: "",      // 수행 결과에 대한 메시지 
        RDATA: "",      // 수행 결과에 대한 데이터
    };

/****************************************************************************
 * 🔥 Remote / Modules
 ****************************************************************************/
    const REMOTE = require("@electron/remote");
    const APP = REMOTE.app;
    const PATH = require("path");
    const FS = require("fs");

    // SAP Landscape 관련 모듈
    const SAP_LANDSCAPE = require(PATH.join(__dirname, "sap_landscape.js"));


/****************************************************************************
 * 🔥 Private functions
 ****************************************************************************/


    /*********************************************************************     
     * @function
     * - SAP Logon Pad에 저장되어 있는 서버정보의 UUID값으로 
     *   SAP Logon Pad의 좌측트리 기준에 어떤 폴더에 속해있는지 정보를 구한다.
     * 
     * @param {string} sUUID - 서버정보의 UUID
     * 
     * @returns {Promise<Object|undefined>} 
     * - 서버가 속한 루트 폴더 정보 객체 또는 `undefined`
     *********************************************************************/
    function _getSAPLogonRootDirInfo(sUUID){

        return new Promise(async function(resolve){

            // 1. SAP Landscape xml 파일 경로 구하기
            let sLandscapeFilePath = await _getSAPLandscapeFilePath();
            if(!sLandscapeFilePath){
                return resolve();
            }

            // 2. Landscape xml을 Json Parse 해서 UUID가 속한 폴더 정보를 구한다.
            let oRootInfo = await SAP_LANDSCAPE.getSAPLogonRootDirInfo(sLandscapeFilePath, sUUID);
            if(!oRootInfo){
                return resolve();
            }

            return resolve(oRootInfo);

        });

    } // end of _getSAPLogonDirRootNodeInfo

    /*********************************************************************     
     * @function
     * - SAPGUI Logon XML 파일 경로 구하기
     * 
     * 
     * @returns {Promise<Object|undefined>} - JSON 객체 또는 `undefined`
     *********************************************************************/
    function _getSAPLandscapeFilePath(){

        return new Promise(async function(resolve){

            try {                

                // 레지스트리에 등록된 SAPLogon 정보를 읽는다.            
                var oRegInfoSapResult = await oAPP.fn.fnGetRegInfoForSAPLogon();

                var oLandscapeFileInfo = oRegInfoSapResult?.LandscapeFile || undefined;
                if(!oLandscapeFileInfo){
                    return resolve();
                }

                var sLandscapeFilePath = oLandscapeFileInfo?.value || "";
                if(!sLandscapeFilePath){
                    return resolve();
                }

                return resolve(sLandscapeFilePath);

            } catch (error) {
                if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
                return resolve();
            }

        });

    } // end of _getLandscapeFilePath




module.exports = async function(oStream, oIF_DATA){    

    oAPP.setBusy(true);

    console.log("OPEN_SERVER", oIF_DATA);

    // 응답 구조 복사
    let _oRES = JSON.parse(JSON.stringify(TY_RES));

    _oRES.RETCD = "E";

    // 프로세스 코드
    _oRES.PRCCD = oIF_DATA.PRCCD;
    
    // 전달받은 파라미터
    let oPARAM = oIF_DATA?.PARAM || undefined;

    // 서버의 SYSID
    let SYSID = oPARAM?.SYSID || "";

    // SSO KEY
    let SSO_TICKET = oPARAM?.SSO_TICKET || undefined;

    // 언어
    let LANGU = oPARAM?.LANGU || "";

    // WS 언어
    let WSLANGU = oPARAM?.WSLANGU || "";

    // 클라이언트
    let CLIENT = oPARAM.CLIENT || "";

    // SAP ID
    let SAPID = oPARAM?.SAPID || "";

    // SAP PW
    let SAPPW = oPARAM?.SAPPW || "";

    // APP ID
    let APPID = oPARAM?.APPID || "";
    

    // 전체 서버리스트 목록을 구한다.
    let aServerList = oAPP.attr.sap.ui.getCore().getModel().getProperty("/ServerList");
    if(!aServerList || Array.isArray(aServerList) === false || aServerList.length === 0){

        // 서버리스트에 등록된 서버 정보가 없습니다.           
        _oRES.STCOD = "E001";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));

        oAPP.setBusy(false);

        return;

    }

    // 기 저장된 서버리스트 전체를 구한다.
    let oSavedResult = oAPP.fn.fnGetSavedServerListDataAll();
    if (oSavedResult.RETCD === "E") {

        // 서버리스트에 등록된 서버 정보가 없습니다.
        _oRES.STCOD = "E002";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));

        oAPP.setBusy(false);

        return;

    }

    let aSavedServList = oSavedResult.RETDATA;
    if(!aSavedServList || Array.isArray(aSavedServList) === false || aSavedServList.length === 0){

        // 서버리스트에 등록된 서버 정보가 없습니다.
        _oRES.STCOD = "E003";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));

        oAPP.setBusy(false);

        return;

    }

    let oServerFound = aServerList.find(e => e.systemid === SYSID);
    if(!oServerFound){

        // 서버리스트에 등록된 서버 정보가 없습니다.
        _oRES.STCOD = "E004";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));

        oAPP.setBusy(false);

        return;
    }

    let sUUID = oServerFound.uuid;

    let oSysInfo = aSavedServList.find(e => e.uuid === sUUID);
    if(!oSysInfo){

        // 서버리스트에 등록된 서버 정보가 없습니다.
        _oRES.STCOD = "E005";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));

        oAPP.setBusy(false);

        return;
    }

    // 파라미터로 전달받은 서버가 SAP Logon Pad의 좌측트리 기준에 어떤 폴더에 속해있는지 정보를 구한다.
    let oRootNodeInfo = await _getSAPLogonRootDirInfo(sUUID);
    if(oRootNodeInfo){
        
        let parent_uuid = oRootNodeInfo.parent_uuid;

        // UUID 를 레지스트리에 저장
        await oAPP.fn.setRegistryLastSelectedNodeKey(parent_uuid);

        // 죄측 트리에서 해당 폴더의 위치로 선택표시 하기
        let oWorkTree = oAPP.attr.sap.ui.getCore().byId("WorkTree");
        if (oWorkTree && oWorkTree.getModel()) {

            oWorkTree.getModel().refresh(true);

            oWorkTree.attachEventOnce("rowsUpdated", oAPP.fn.fnAttachRowsUpdateOnce);

        }
      
    }
    
    // 로그인시 필요한 파라미터 정보
    var oLoginInfo = {
        NAME: oServerFound.name,
        SERVER_INFO: oSysInfo,
        SERVER_INFO_DETAIL: oServerFound,
        INSTANCENO: oServerFound.insno,
        SYSTEMID: oServerFound.systemid,
        CLIENT: CLIENT,
        
        LANGU: LANGU,         // 서버 접속 언어
        WSLANGU: WSLANGU,     // WS 언어
        SYSID: oServerFound.systemid,
        SSO_TICKET : SSO_TICKET,
        SAPID: SAPID,   // SAP ID
        SAPPW: SAPPW,   // SAP PW
        IS_SSO: "X",
        APPID: APPID    // 어플리케이션 ID
    };

    // 사용자 테마 정보를 읽어온다.
    let oP13nThemeInfo = await oAPP.fn.fnP13nCreateTheme(oLoginInfo.SYSID);
    if (oP13nThemeInfo.RETCD == "S") {
        oLoginInfo.oThemeInfo = oP13nThemeInfo.RTDATA;
    }
    
    setTimeout(function(){

        oAPP.fn.fnLoginPage(oLoginInfo);  // <== 이 안에 busy 끄는 로직이 있음!      

        // 실행 성공!!
        _oRES.RETCD = "S";

        // 응답 후 소캣을 종료한다.
        oStream.end(JSON.stringify(_oRES));            

    }, 2000);
        

};