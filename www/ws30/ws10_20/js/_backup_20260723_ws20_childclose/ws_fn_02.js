/**************************************************************************
 * ws_fn_02.js
 **************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const
        REMOTE = parent.REMOTE,
        APP = parent.APP,
        CURRWIN = REMOTE.getCurrentWindow(),
        REMOTEMAIN = parent.REMOTEMAIN,
        APPCOMMON = oAPP.common;

    // // 브라우저 미리보기
    // const { CLBrowserPreview } = parent.require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "browser_preview"));

    /************************************************************************
     * 브라우저 설치 우뮤 등 상태 정보 모델 갱신
     * **********************************************************************/
    oAPP.fn.fnBrowserStateModelRefresh = async function () {

        // PC에 설치된 브라우저의 실제 설치 경로 위치를 얻는다.
        let aBrowserInstallPaths = await parent.WSUTIL.EXE_BROWSER.getBrowserInstallPath();

        // 해당 정보를 전역에 설정
        parent.setDefaultBrowserInfo(aBrowserInstallPaths);

        // 개인화 폴더없으면 생성
        oAPP.fn.fnOnP13nFolderCreate();

        // 개인화 기본 브라우저 설정
        oAPP.fn.fnOnP13nExeDefaultBrowser();

        // [HTML5] UI5 제거 환경 — sap.ui.getCore().getModel() 대신 모델 shim(fnGet/SetModelProperty) 사용.
        //   (ws_html5_shell.js 가 fnGet/SetModelProperty 를 oAPP.attr.oModel shim 으로 override)
        let aDEFBR = APPCOMMON.fnGetModelProperty("/DEFBR");

        // 브라우저 정보가 있을 경우에만 수행
        if (aDEFBR && Array.isArray(aDEFBR) === true && aDEFBR.length !== 0) {

            // 브라우저 정보 중, SELECT가 아닌 경우는 APP_MODE도 false로 강제 적용
            for (var oDef of aDEFBR) {

                if (oDef.SELECTED === false) {
                    oDef.APP_MODE = false;
                }

            }

            APPCOMMON.fnSetModelProperty("/DEFBR", aDEFBR);

        }

    }; // end of oAPP.fn.fnBrowserStateModelRefresh


    /************************************************************************
     * Application Display or Change mode 
     * **********************************************************************
     * @param {String} APPID  
     * - Application 명
     * 
     * @param {Char} ISEDIT
     * - 'X': Edit mode, ' ': Display Mode
     ************************************************************************/
    oAPP.fn.fnOnEnterDispChangeMode = async function (APPID, ISEDIT) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oAppNmInput = sap.ui.getCore().byId("AppNmInput");
        if (!oAppNmInput) {

            // busy 끄고 Lock 해제
            oAPP.common.fnSetBusyLock("");

            return;
        }

        var sValue = oAppNmInput.getValue(),
            sCurrPage = parent.getCurrPage();

        let oUserInfo = parent.process.USERINFO;
        let sLangu = oUserInfo.LANGU;

        // 입력값 유무 확인
        if (typeof sValue !== "string" || sValue == "") {

            // Application name is required.            
            let sErrMsg = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273");

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // 입력값 공백 여부 체크
        var reg = /\s/;
        if (reg.test(sValue)) {

            // The application name must not contain any spaces.
            let sErrMsg = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "274");

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }


        // 특수문자 존재 여부 체크
        var reg = /[^\w]/;
        if (reg.test(sValue)) {

            //Special characters are not allowed.
            let sErrMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278");

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        var sRandomKey = parent.getRandomKey(),
            SSID = APPID + "_" + sRandomKey;

        // SSID 저장
        parent.setSSID(SSID);

        var oFormData = new FormData();
        oFormData.append("APPID", APPID);
        oFormData.append("ISEDIT", ISEDIT);
        oFormData.append("SSID", SSID);

        // 서버에서 App 정보를 구한다.
        ajax_init_prc(oFormData, lf_success);

        async function lf_success(oAppInfo) {



            let sCurrPage = parent.getCurrPage();

            // application 이 없을 경우 메시지 처리.
            if (oAppInfo.MSGTY == "N") {

                let oCurrWin = parent.REMOTE.getCurrentWindow();

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", APPID);

                // 페이지 푸터 메시지
                // APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, oAppInfo.MESSAGE);
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;

            }

            // Change 모드로 들어왔는데 APP가 Lock 걸려 있는 경우.
            if (ISEDIT === "X" && oAppInfo.IS_EDIT === "") {

                // USP Application 일 경우
                if (oAppInfo.APPTY == "U") {

                    // 페이지 푸터 메시지
                    APPCOMMON.fnShowFloatingFooterMsg("E", "WS30", oAppInfo.MESSAGE);

                } else {

                    // 페이지 푸터 메시지                  
                    APPCOMMON.fnShowFloatingFooterMsg("E", "WS20", oAppInfo.MESSAGE);

                }

            }

            let oUserInfo = APPCOMMON.fnGetModelProperty("/USERINFO"),
                ISADM = oUserInfo.ISADM; // Admin 권한 여부

            // Admin이 아닌 유저가 Admin App을 열었을 경우 Disply 모드로 변환
            if (ISADM !== "X" && oAppInfo.ADMIN_APP === "X") {
                oAppInfo.IS_EDIT = "";
            }

            // 어플리케이션 정보에 버전 관리 정보가 포함되어 있을 경우 Display 모드로 전환
            if (typeof oAppInfo.S_APP_VMS !== "undefined") {
                oAppInfo.IS_EDIT = "";
            }


            /**
             * AI 서버 연결되어있을 경우 연결 해제 하기
             */

            // // AI 서버에 요청할 데이터
            // let _oPARAM = {
            //     CONID: parent.getBrowserKey()
            // }

            // // AI 연결 해제
            // await parent.UAI.disconnect(_oPARAM);

            // USP Application 일 경우
            if (oAppInfo.APPTY === "U") {

                // WS10 페이지의 APPID 입력 필드에 Suggestion을 구성할 데이터를 저장한다.
                oAPP.fn.fnOnSaveAppSuggestion(oAppInfo.APPID);

                // 모델에 데이터 업데이트
                APPCOMMON.fnSetModelProperty("/WS30/APP", oAppInfo);

                // 단축키 삭제
                APPCOMMON.removeShortCut("WS10");

                // 단축키 설정
                APPCOMMON.setShortCut("WS30");

                // USP 페이지로 이동한다.
                oAPP.fn.fnOnMoveToPage("WS30");

                // WS30번 페이지에 대한 AI I/F 커스텀 이벤트를 등록한다.(기존에 걸려있다면 다시 안걸림!!)        
                parent.UAI.setCustomEvent_WS_30();

                return;

            }

            // Application 이 존재 할 경우
            // 리턴받은 APP 정보를 Frame에 저장한다.
            parent.setAppInfo(oAppInfo);

            // WS20 기본 모델 데이터
            let oWs20 = oAPP.main.fnGetWs20InitData();
            oWs20.APP = oAppInfo;

            // 모델에 데이터 업데이트
            APPCOMMON.fnSetModelProperty("/WS20", oWs20);

            // 자동으로 새창을 띄우면서 20번 페이지로 이동 시,  
            let oNewWin_IF_DATA = parent.getNewBrowserIF_DATA();
            if (oNewWin_IF_DATA && oNewWin_IF_DATA.ACTCD === "MOVE20") {
                // "MOVE20"인 경우에는 아무 동작도 하지 않음

            } else {

                // "MOVE20"이 아닌 경우에만 실행
                oAPP.fn.fnOnSaveAppSuggestion(oAppInfo.APPID);

            }

            // 단축키 삭제
            APPCOMMON.removeShortCut("WS10");

            // 단축키 설정
            APPCOMMON.setShortCut("WS20");

            // WS20번 페이지로 이동한다.
            oAPP.fn.fnOnMoveToPage("WS20");

            // WS20번 페이지에 대한 AI I/F 커스텀 이벤트를 등록한다.(기존에 걸려있다면 다시 안걸림!!)        
            parent.UAI.setCustomEvent_WS_20();

        } // end of lf_success

    }; // end of oAPP.fn.fnOnEnterDispChangeMode    

    /************************************************************************
     * 페이지 이동 (WS10 -> WS20, WS20 -> WS10)
     * **********************************************************************
     * @param {String} sPgNo  
     * - page 명
     * 예) WS10, WS20     
     ************************************************************************/
    oAPP.fn.fnOnMoveToPage = function (sPgNm) {



        var oApp = sap.ui.getCore().byId("WSAPP");
        if (!oApp) {
            return;
        }

        var oMenu = document.querySelector(".sapMMenu");
        if (oMenu) {
            oMenu.style.visibility = "hidden";
        }

        oApp.to(sPgNm);

    }; // end of oAPP.fn.fnOnMoveToPage

    /************************************************************************
     * WS10 페이지의 APPID 입력 필드에 Suggestion을 구성할 데이터를 저장한다.
     * **********************************************************************
     * @param {String} sAppID  
     * - Application Name      
     ************************************************************************/
    oAPP.fn.fnOnSaveAppSuggestion = function (sAppID) {

        var FS = parent.FS;

        // 서버 접속 정보
        var oServerInfo = parent.getServerInfo(),
            sSysID = oServerInfo.SYSID;

        // P13N 파일 Path
        var sP13nPath = parent.getPath("P13N"),
            sP13nJsonData = FS.readFileSync(sP13nPath, 'utf-8'),

            // 개인화 정보
            oP13nData = JSON.parse(sP13nJsonData);

        // 개인화 정보 중, Default Browser 정보가 있는지 확인한다.	
        if (!oP13nData[sSysID].APPSUGG) {

            // 없으면 신규생성
            oP13nData[sSysID].APPSUGG = [{
                APPID: sAppID
            }];

            // suggustion save
            lf_saveSuggestion();

            return;
        }

        // 있으면 추가한다.

        // 기 저장된 APPID 정보를 읽는다.
        var aBeforeAppIds = oP13nData[sSysID].APPSUGG;

        // 저장하려는 APPID가 이미 있으면
        // 해당 APPID를 Suggestion 최상단에 배치한다. 
        var iFindIndex = aBeforeAppIds.findIndex(a => a.APPID == sAppID);

        // 저장하려는 APP가 이미 있고 Array에 가장 첫번째에 있으면 빠져나간다.    
        if (iFindIndex == 0) {
            return;
        }

        // 저장하려는 APP가 이미 있고 Array에 첫번째가 아니면 
        // 기존 저장된 위치의 APPID 정보를 삭제
        if (iFindIndex > 0) {
            aBeforeAppIds.splice(iFindIndex, 1);
        }

        var iBeforeCnt = aBeforeAppIds.length,
            oAppID = {
                APPID: sAppID
            },

            aNewArr = [];

        var SUGGMAXLENGTH = oAPP.attr.iAppSuggMaxCnt;

        // 저장된 Suggestion 갯수가 MaxLength 이상이면
        // 마지막거 지우고 최신거를 1번째로 저장한다.
        if (iBeforeCnt >= SUGGMAXLENGTH) {

            for (var i = 0; i < SUGGMAXLENGTH - 1; i++) {
                aNewArr.push(aBeforeAppIds[i]);
            }

        } else {

            for (var i = 0; i < iBeforeCnt; i++) {
                aNewArr.push(aBeforeAppIds[i]);
            }

        }

        aNewArr.unshift(oAppID);

        oP13nData[sSysID].APPSUGG = aNewArr;

        // suggustion save
        lf_saveSuggestion();

        function lf_saveSuggestion() {

            APPCOMMON.fnSetModelProperty("/WS10/APPSUGG", oP13nData[sSysID].APPSUGG);

            // p13n.json 파일에 APPID Suggestion 정보 저장
            FS.writeFileSync(sP13nPath, JSON.stringify(oP13nData));

        }

    }; // end of oAPP.fn.fnOnSaveAppSuggestion

    /************************************************************************
     * WS10 페이지로 이동
     * **********************************************************************/
    // oAPP.fn.fnMoveToWs10 = function () {

    //     // busy 키고 Lock 키기
    //     oAPP.common.fnSetBusyLock("X");

    //     var oAppInfo = parent.getAppInfo();

    //     // // 10번 페이지로 이동할때 서버 한번 콜 해준다. (서버 세션 죽이기)
    //     // oAPP.fn.fnKillUserSession(oAppInfo, lf_success, lf_success);

    //     let SSID = parent.getSSID();

    //     parent.setSSID("");

    //     let oFormData = new FormData();
    //         oFormData.append("APPID", oAppInfo.APPID);
    //         oFormData.append("SSID", SSID);

    //     // 서버 세션 죽이기
    //     fnKillSession(oFormData, lf_success);

    //     async function lf_success() {

    //         /**
    //          * 페이지 이동 시, CHANGE 모드였다면 현재 APP의 Lock Object를 해제한다.
    //          */
    //         var oAppInfo = parent.getAppInfo();

    //         if (oAppInfo && oAppInfo.IS_EDIT == 'X') {

    //             await new Promise(function(resolve){

    //                 let oParams = {
    //                     APPID: oAppInfo.APPID,  // Lock을 해제할 APPID                        
    //                     ACTCD: "APP_EXIT"       // 앱을 빠져나간다는 Action Code
    //                 };

    //                 ajax_unlock_app(oParams, function(oReturn){

    //                     if (oReturn.RTCOD === 'E') {

    //                         parent.setSoundMsg("02"); // error sound

    //                         // 작업표시줄 깜빡임
    //                         CURRWIN.flashFrame(true);

    //                         // 크리티컬 오류 처리
    //                         parent.showMessage(sap, 20, oReturn.RTCOD, oReturn.RTMSG, fnCriticalError);

    //                         // 화면 Lock 해제
    //                         sap.ui.getCore().unlock();

    //                         parent.setBusy('');

    //                         return;
    //                     }

    //                     return resolve(oReturn);

    //                 });

    //             }); 

    //         }

    //         // WS20 화면에서 떠있는 Dialog, Popup 종류, Electron Browser들 전체 닫는 function
    //         oAPP.fn.fnCloseAllWs20Dialogs();

    //         // WS20 페이지 삭제
    //         oAPP.fn.removeContent();

    //         // App Info 초기화
    //         parent.setAppInfo(undefined);

    //         // WS20에 대한 모델 정보 초기화
    //         APPCOMMON.fnSetModelProperty("/WS20", undefined);

    //         // 10번 프로그램으로 이동한다.        
    //         oAPP.fn.fnOnMoveToPage("WS10");

    //         // 20번 프로그램 단축키 삭제
    //         APPCOMMON.removeShortCut("WS20");

    //         // 10번 프로그램 단축키 설정
    //         APPCOMMON.setShortCut("WS10");

    //         // 브라우저 타이틀 변경
    //         parent.CURRWIN.setTitle("U4A Workspace - Main");

    //         // 윈도우 헤더 타이틀 변경
    //         oAPP.common.setWSHeadText("U4A Workspace - Main");

    //         // AI 서버 연결되어있을 경우 연결 해제 하기
    //         // AI 서버에 요청할 데이터
    //         let _oPARAM = {
    //             CONID: parent.getBrowserKey()
    //         };

    //         // AI 연결 해제
    //         await parent.UAI.disconnect(_oPARAM);

    //         // busy 끄고 Lock 끄기
    //         oAPP.common.fnSetBusyLock("");

    //     } // end of lf_success

    // }; // end of oAPP.fn.fnMoveToWs10    

    oAPP.fn.fnMoveToWs10 = function () {

        // busy 키고 Lock 키기
        oAPP.common.fnSetBusyLock("X");

        // [HTML5] 페이지 이동 in-flight 락 — F3 연타/재진입 시 fnMoveToWs10 중복 실행(화면 깨짐) 방지.
        //   busy 가 비동기 이동 중(저장확인창/주석된 busy해제) 잠깐 풀려도 단축키 가드가 이 락을 본다.
        oAPP.common.fnNaviLock();
        // 떠나는 현재 화면(이동 완료 전) 캡쳐.
        var sFromPage = "";
        try { sFromPage = (parent.getCurrPage && parent.getCurrPage()) || ""; } catch (e) { }

        // ★ 단축키 해제는 "가장 먼저" — 전환(서버콜·removeContent·렌더) 시작 전에 떠나는 화면의
        //   단축키를 즉시 제거한다. 그래야 비동기 이동 도중 그 화면 단축키가 한 번 더 발화하지 않는다.
        //   (기존엔 lf_success 끝에서 "WS20" 하드코딩으로 늦게 제거 → WS30 단축키 누수·연타 재진입 원인.)
        try { APPCOMMON.removeShortCut(sFromPage || "WS20"); } catch (e) { }

        var oAppInfo = parent.getAppInfo();

        // 10번 페이지로 이동할때 서버 한번 콜 해준다. (서버 세션 죽이기)
        // oAPP.fn.fnKillUserSession(oAppInfo, lf_success, lf_success);
        oAPP.fn.fnKillUserSession(oAppInfo, lf_success);

        async function lf_success() {

            /**
             * 페이지 이동 시, CHANGE 모드였다면 현재 APP의 Lock Object를 해제한다.
             */
            var oAppInfo = parent.getAppInfo();

            if (oAppInfo && oAppInfo.IS_EDIT == 'X') {

                await new Promise(function (resolve) {

                    let oParams = {
                        APPID: oAppInfo.APPID,  // Lock을 해제할 APPID                        
                        ACTCD: "APP_EXIT"       // 앱을 빠져나간다는 Action Code
                    };

                    ajax_unlock_app(oParams, function (oReturn) {

                        if (oReturn.RTCOD === 'E') {

                            parent.setSoundMsg("02"); // error sound

                            // 작업표시줄 깜빡임
                            CURRWIN.flashFrame(true);

                            // 크리티컬 오류 처리
                            parent.showMessage(sap, 20, oReturn.RTCOD, oReturn.RTMSG, fnCriticalError);

                            // busy 끄고 Lock 끄기
                            oAPP.common.fnSetBusyLock("");
                            // 이동 실패 → in-flight 락 해제(영구 잠김 방지)
                            oAPP.common.fnNaviRelease();

                            return;
                        }

                        return resolve(oReturn);

                    });

                });

            }

            // WS20 화면에서 떠있는 Dialog, Popup 종류, Electron Browser들 전체 닫는 function
            oAPP.fn.fnCloseAllWs20Dialogs();

            // WS20 페이지 삭제
            oAPP.fn.removeContent();

            // App Info 초기화
            parent.setAppInfo(undefined);

            // WS20에 대한 모델 정보 초기화
            APPCOMMON.fnSetModelProperty("/WS20", undefined);

            // 10번 프로그램으로 이동한다.        
            oAPP.fn.fnOnMoveToPage("WS10");

            // (떠나는 화면 단축키 해제는 위에서 "가장 먼저" 수행했음 — 여기선 등록만.)
            // WS10 단축키 설정 — 화면(fnOnMoveToPage("WS10")) 다 그린 "뒤" = 가장 마지막에 등록.
            APPCOMMON.setShortCut("WS10");

            // 브라우저 타이틀 변경
            parent.CURRWIN.setTitle("U4A Workspace - Main");

            // 윈도우 헤더 타이틀 변경
            oAPP.common.setWSHeadText("U4A Workspace - Main");

            // [HTML5] 이동 완료 → in-flight 락 해제 (이제 다음 페이지 단축키 허용)
            oAPP.common.fnNaviRelease();

            // // AI 서버 연결되어있을 경우 연결 해제 하기
            // // AI 서버에 요청할 데이터
            // let _oPARAM = {
            //     CONID: parent.getBrowserKey()
            // };

            // // AI 연결 해제
            // await parent.UAI.disconnect(_oPARAM);

            // // busy 끄고 Lock 끄기
            // oAPP.common.fnSetBusyLock("");          

        } // end of lf_success

    }; // end of oAPP.fn.fnMoveToWs10    

    /************************************************************************
     * WS20 페이지로 이동
     * **********************************************************************/
    oAPP.fn.fnMoveToWs20 = function () {

        var oAppInfo = parent.getAppInfo();

        // 20번 페이지 인스턴스
        var oMainPage = sap.ui.getCore().byId("WS20_MAIN");
        if (!oMainPage) {
            return;
        }

        // // APP 상태에 따라 트랜잭션 버튼을 비활성화 시킨다.
        // _setTransactionButtonInvisible();

        // 디자인 영역을 구성한다.
        if (oAPP.attr.oArea) {
            oAPP.attr.APPID = oAppInfo.APPID;
            oAPP.fn.setUIAreaEditable();
            return;
        }

        // 공유 Object에 20번 페이지 인스턴스를 넣는다.
        oAPP.attr.oArea = oMainPage;

        // 20번 페이지에 보여질 APPID를 입력한다.
        oAPP.attr.APPID = oAppInfo.APPID;

        // 20번 페이지를 그린다.
        oAPP.fn.main();

        // WS20 페이지의 EDIT/DISPLAY 설정(차장님 부분)
        oAPP.fn.setUIAreaEditable();


        // 새창 실행 시 액션코드가 "MOVE20(20번 페이지로 이동)" 일 경우 
        // 브라우저 opacity 1을 준다.
        let oNewWin_IF_DATA = parent.getNewBrowserIF_DATA();
        if (oNewWin_IF_DATA && oNewWin_IF_DATA.ACTCD === "MOVE20") {

            parent.CURRWIN.setOpacity(1);

            // IF_DATA 파라미터 삭제
            parent.setNewBrowserIF_DATA(undefined);

        }

    }; // end of oAPP.fn.fnMoveToWs20

    /************************************************************************
     * WS30 페이지로 이동
     * **********************************************************************/
    oAPP.fn.fnMoveToWs30 = () => {



        sap.ui.getCore().lock();

        // busy 키고 Lock 키기
        oAPP.common.fnSetBusyLock("X");

        // console.log("USP 페이지로 이동");

        /**
         * @since   2026-03-07 11:20:44
         * @version v3.6.0-2
         * @author  soccerhs
         * @description
         * 
         * USP 페이지 이동 시, 로직 순서 변경 및 중복 로직 공통 작업으로 아래 소스 주석처리
         * 
         */
        // // usp tree 부분 split 영역 
        // let oSplitLayout = sap.ui.getCore().byId("usptreeSplitLayout");
        // if (oSplitLayout) {
        //     oSplitLayout.setSize("500px");
        // }

        // // content 영역 split orientation 초기화
        // let oCodeEditorSplit = sap.ui.getCore().byId("uspCodeeditorSplit");
        // if (oCodeEditorSplit) {
        //     oCodeEditorSplit.setOrientation("Horizontal");
        // }

        // // content 영역 split size 초기화
        // let oCodeEditorSplitLayoutData = sap.ui.getCore().byId("codeEditorSplitLayout");
        // if (oCodeEditorSplitLayoutData) {
        //     oCodeEditorSplitLayoutData.setSize("0px");
        // }

        // // content 영역 상단 패널 펼치기
        // let oPanel = sap.ui.getCore().byId("uspPanel");
        // if (oPanel) {
        //     oPanel.setExpanded(true);
        // }

        // // 이전에 선택한 라인이 있다면 해당 라인 선택 아이콘 표시 해제
        // oAPP.fn.fnOnUspTreeUnSelect();

        // // USP 초기 레이아웃 설정
        // oAPP.fn.fnOnInitLayoutSettingsWs30(); // #[ws_usp.js]

        let oAppInfo = APPCOMMON.fnGetModelProperty("/WS30/APP"),
            sServerPath = parent.getServerPath(),
            sInitPath = `${sServerPath}/usp_init_prc`;

        let oFormData = new FormData();
        oFormData.append("APPID", oAppInfo.APPID);

        sendAjax(sInitPath, oFormData, _fnCallback);

        function _fnCallback(oResult) {



            // Critical Error
            if (oResult.RETCD == "Z") {

                // busy 끄고 Lock 끄기
                oAPP.common.fnSetBusyLock("");

                //  [Critical] 메시지 팝업 띄우고 확인 누르면 10번으로 강제 이동
                // 세션, 락 등등 처리 후 이동
                // 서버 세션이 죽었다면 오류 메시지 뿌리고 10번 화면으로 이동한다.
                oAPP.fn.fnCriticalErrorWs30(oResult);

                return;

            }

            if (oResult.RETCD != "S") {

                // busy 끄고 Lock 끄기
                oAPP.common.fnSetBusyLock("");

                parent.showMessage(sap, 20, 'E', oResult.RTMSG, fnCallback);

                function fnCallback() {

                    //  [Critical] 메시지 팝업 띄우고 확인 누르면 10번으로 강제 이동
                    // 세션, 락 등등 처리 후 이동
                    // 서버 세션이 죽었다면 오류 메시지 뿌리고 10번 화면으로 이동한다.
                    oAPP.fn.fnCriticalErrorWs30(oResult);

                }

                return;

            }


            // USP 좌측 Tree 구성
            APPCOMMON.fnSetModelProperty("/WS30/USPTREE", oResult.T_DATA);

            let oModel = sap.ui.getCore().getModel();

            oAPP.fn.fnSetTreeJson(oModel, "WS30.USPTREE", "OBJKY", "PUJKY", "USPTREE");

            let oUspTreeTable = sap.ui.getCore().byId("usptree");
            if (!oUspTreeTable) {

                // busy 끄고 Lock 끄기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            let oTreeModel = oUspTreeTable.getModel();
            if (!oTreeModel) {

                // busy 끄고 Lock 끄기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            oTreeModel.refresh();

            // USP 초기 레이아웃 설정
            oAPP.fn.fnOnInitLayoutSettingsWs30(); // #[ws_usp.js]

            /**
             * @since   2026-03-07 11:20:44
             * @version v3.6.0-2
             * @author  soccerhs
             * @description
             * 
             * USP 페이지 이동 시, 로직 순서 변경 및 중복 로직 공통 작업으로 아래 소스 주석처리
             * 
             */
            // oUspTreeTable.attachEventOnce("rowsUpdated", function(oEvent){

            //     zconsole.log("init ws30 rowsUpdated!!!");

            //     let oTable = oEvent.getSource();
            //     if(!oTable){

            //         // busy 끄고 Lock 끄기
            //         oAPP.common.fnSetBusyLock("");

            //         return;
            //     }

            //     let oRow = oTable.getRows()[0];
            //     if(!oRow){

            //         // busy 끄고 Lock 끄기
            //         oAPP.common.fnSetBusyLock("");

            //         return;
            //     }

            //     let oBindCtx = oRow.getBindingContext();
            //     if(!oBindCtx){

            //         // busy 끄고 Lock 끄기
            //         oAPP.common.fnSetBusyLock("");

            //         return;
            //     }

            //     oAPP.fn.fnUspTreeTableRowSelect(oRow);

            // });

            // 이전에 선택한 라인이 있다면 해당 라인 선택 아이콘 표시 해제
            // oAPP.fn.fnOnUspTreeUnSelect();

        }

    }; // end of oAPP.fn.fnMoveToWs30

    /************************************************************************
     * 20 -> 10번 페이지로 이동 시 서버 세션 죽이기 위한 공통 펑션
     * **********************************************************************/
    oAPP.fn.fnKillUserSession = function (oAppInfo, fn_callback, fn_fail) {

        let SSID = parent.getSSID();

        parent.setSSID("");

        let oFormData = new FormData();

        if (oAppInfo && oAppInfo.APPID) {
            oFormData.append("APPID", oAppInfo.APPID);
        }

        oFormData.append("SSID", SSID);
        oFormData.append("EXIT", 'X');

        // 서버에서 App 정보를 구한다.
        ajax_init_prc(oFormData, fn_callback, fn_fail);


    }; // end of oAPP.fn.fnKillUserSession    

    /************************************************************************
     * Application Name 정합성 체크
     * **********************************************************************
     * @param {String} sAppID  
     * - Application Name
     * 
     * @param {Boolean} bAppMaxLengthCheck Application Length Check를 할지 말지 여부
     * - true: Application Length Check를 하지 않는다.
     * - false or undefined : Application Length Check를 한다
     * 
     * @returns {Object}
     * - RETCD : 상태값 (Boolean)
     * - RETMSG: 상태 메시지 (String)
     ************************************************************************/
    oAPP.fn.fnCheckValidAppName = function (sAppID, bAppMaxLengthCheck) {

        var oRetData = {
            RETCD: false,
            RETMSG: ""
        };

        let oUserInfo = parent.process.USERINFO;
        let sLangu = oUserInfo.LANGU;

        var sValue = sAppID;

        // Application name is required.
        if (typeof sValue !== "string" || sValue == "") {
            // oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "050", APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A33"));
            oRetData.RETMSG = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273");
            return oRetData;
        }

        // 특수문자 존재 여부 체크
        var reg = /[^\w]/;
        if (reg.test(sValue)) {
            oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278"); // Special characters are not allowed.
            return oRetData;
        }

        // 20230107 Application Name의 길이를 체크해야 할 경우에만 수행
        // Create, Copy일 경우에만 Application Name의 길이를 체크함!!
        if (bAppMaxLengthCheck) {

            // AppID 자릿수가 15 이상일 경우 오류
            if (sValue.length > oAPP.attr.iAppNameMaxLength) {
                oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "115"); // Application ID can only be 15 characters or less !!  
                return oRetData;
            }

        }

        var sValueUpper = sValue.toUpperCase(),

            bIsStartZ = jQuery.sap.startsWith(sValueUpper, "Z"),
            bIsStartY = jQuery.sap.startsWith(sValueUpper, "Y");

        // Application 명 시작이 Z 이나 Y로 시작하는지 확인한다.
        if (!bIsStartZ && !bIsStartY) {

            oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "009"); // The application ID must start with Z or Y.
            return oRetData;
        }

        oRetData.RETCD = true;

        return oRetData;

    }; // end of oAPP.fn.fnCheckValidAppName

    /************************************************************************
     * Application Name 입력 체크
     * **********************************************************************
     * @param {Boolean} bAppMaxLengthCheck Application Name의 Max Length 체크 수행 여부
     * - true: App Name Maxlength Check 수행함
     * - false or undefined : App Name Maxlength Check 수행 안함
     * 
     * @returns {Boolean} 
     ************************************************************************/
    oAPP.fn.fnCheckAppName = function (bAppMaxLengthCheck) {

        var oAppNmInput = sap.ui.getCore().byId("AppNmInput");
        if (!oAppNmInput) {
            return false;
        }

        var sValue = oAppNmInput.getValue(),
            sCurrPage = parent.getCurrPage();

        // 어플리케이션 명 정합성 체크
        var oValid = oAPP.fn.fnCheckValidAppName(sValue, bAppMaxLengthCheck);

        if (oValid.RETCD == false) {
            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, oValid.RETMSG);
            return false;
        }

        return true;

    }; // end of oAPP.fn.fnCheckAppName

    /************************************************************************
     * WS20 Change 모드로 전환
     * **********************************************************************/
    oAPP.fn.fnSetAppChangeMode = function () {

        // 화면 Lock 걸기 — [HTML5] sap.ui.getCore().lock() → busy lock(시각 잠금).
        //   성공 시 setUIAreaEditable→fnLoadWs20TreeData 가 busy 를 관리/해제.
        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage();

        var oFormData = new FormData();
        oFormData.append("APPID", oAppInfo.APPID);
        oFormData.append("ISEDIT", 'X');

        // 서버에서 App 정보를 구한다.
        ajax_init_prc(oFormData, lf_success);

        function lf_success(oAppInfo) {

            if (oAppInfo.IS_EDIT != "X") {

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, oAppInfo.MESSAGE);

                // var sMsg = "Editing by " + oAppInfo.APPID;

                // // 페이지 푸터 메시지
                // APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // 화면 Lock 해제 — [HTML5] sap.ui.getCore().unlock() → busy 해제
                oAPP.common.fnSetBusyLock("");

                parent.setBusy('');

                return;

            }

            // App 정보 갱신
            parent.setAppInfo(oAppInfo);

            APPCOMMON.fnSetModelProperty("/WS20/APP", oAppInfo);

            // 현재 떠있는 Electron Browser들 전체 닫는 function
            oAPP.fn.fnChildWindowClose();

            oAPP.fn.setUIAreaEditable(); // Change Mode 모드로 변환

            // 푸터 메시지 처리                                  
            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "020"); // Switch to edit mode.

            APPCOMMON.fnShowFloatingFooterMsg("S", sCurrPage, sMsg);


            /**
             * @since   2026-01-07 16:57:11
             * @version v3.5.7-4
             * @author  soccerhs
             * @description
             * 
             * 앱 모드 전환 시 ipc의 command 이벤트 전송
             * 
             */
            let oIpcHandler = new parent.CLIpcHandler();
            oIpcHandler.command("appModeChange", {
                fromPage: parent.getCurrPage(),
                browserKey: parent.getBrowserKey(),
                IS_EDIT: "X",
            });

        }

    }; // end of oAPP.fn.fnSetAppChangeMode


    /************************************************************************
     * WS20 페이지 Lock 풀고 Display Mode로 전환
     * **********************************************************************/
    oAPP.fn.fnSetAppDisplayMode = function () {

        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage();

        let oParams = {
            APPID: oAppInfo.APPID
        };

        // Lock을 해제한다.
        ajax_unlock_app(oParams, lf_success);

        async function lf_success(RETURN) {

            if (RETURN.RTCOD === 'E') {

                parent.setSoundMsg("02"); // error sound

                // 작업표시줄 깜빡임
                CURRWIN.flashFrame(true);

                // 크리티컬 오류 처리 — [HTML5] showMessage 첫 인자(oUI5) 무시. sap → null.
                parent.showMessage(null, 20, RETURN.RTCOD, RETURN.RTMSG, fnCriticalError);

                // 화면 Lock 해제 — [HTML5] sap.ui.getCore().unlock() → busy 해제
                oAPP.common.fnSetBusyLock("");

                parent.setBusy('');

                return;
            }

            RETURN.IS_EDIT = ""; // Display Mode FLAG
            RETURN.IS_CHAG = "";

            parent.setAppInfo(RETURN); // Application 정보 갱신

            APPCOMMON.fnSetModelProperty("/WS20/APP", RETURN); // 모델 정보 갱신

            // 현재 떠있는 Electron Browser들 전체 닫는 function
            oAPP.fn.fnChildWindowClose();

            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "029"); // Switch to display mode.

            // 푸터 메시지 처리
            APPCOMMON.fnShowFloatingFooterMsg("S", sCurrPage, sMsg);

            oAPP.fn.setUIAreaEditable(oAppInfo.IS_CHAG); // Display 모드로 변환


            // AI 서버 연결되어있을 경우 연결 해제 하기
            // AI 서버에 요청할 데이터
            let _oPARAM = {
                CONID: parent.getBrowserKey()
            }

            // AI 연결 해제
            await parent.UAI.disconnect(_oPARAM);


            /**
             * @since   2026-01-07 16:57:11
             * @version v3.5.7-4
             * @author  soccerhs
             * @description
             * 
             * 앱 모드 전환 시 ipc의 command 이벤트 전송
             * 
             */
            let oIpcHandler = new parent.CLIpcHandler();
            oIpcHandler.command("appModeChange", {
                fromPage: parent.getCurrPage(),
                browserKey: parent.getBrowserKey(),
                IS_EDIT: "",
            });
        }

    }; // end of oAPP.fn.fnSetAppDisplayMode

    // /************************************************************************
    //  * WS20 페이지 Lock 풀고 Display Mode로 전환
    //  * **********************************************************************/
    // oAPP.fn.fnSetAppDisplayMode = function () {

    //     // 화면 Lock 걸기
    //     sap.ui.getCore().lock();

    //     // Busy를 킨다.
    //     parent.setBusy("X");

    //     var oAppInfo = parent.getAppInfo(),
    //         sCurrPage = parent.getCurrPage();

    //     var oFormData = new FormData();
    //     oFormData.append("APPID", oAppInfo.APPID);

    //     // Lock을 해제한다.
    //     ajax_unlock_app(oAppInfo.APPID, lf_success);

    //     function lf_success(RETURN) {

    //         if (RETURN.RTCOD == 'E') {
    //             // 오류..1
    //             parent.showMessage(sap, 20, RETURN.RTCOD, RETURN.RTMSG);

    //             // 화면 Lock 해제
    //             sap.ui.getCore().unlock();

    //             parent.setBusy('');

    //             return;
    //         }

    //         RETURN.IS_EDIT = ""; // Display Mode FLAG
    //         RETURN.IS_CHAG = "";

    //         parent.setAppInfo(RETURN); // Application 정보 갱신

    //         APPCOMMON.fnSetModelProperty("/WS20/APP", RETURN); // 모델 정보 갱신

    //         // 현재 떠있는 Electron Browser들 전체 닫는 function
    //         oAPP.fn.fnChildWindowClose();

    //         var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "020"); // Switch to edit mode.

    //         // 푸터 메시지 처리
    //         APPCOMMON.fnShowFloatingFooterMsg("S", sCurrPage, sMsg);

    //         oAPP.fn.setUIAreaEditable(oAppInfo.IS_CHAG); // Display 모드로 변환

    //         // 화면 Lock 해제
    //         sap.ui.getCore().unlock();

    //         parent.setBusy('');

    //     }

    // }; // end of oAPP.fn.fnSetAppDisplayMode

    /************************************************************************
     * 어플리케이션 존재 유뮤 체크
     * **********************************************************************
     * @param {String} APPID  
     * - APPID 명
     *   
     * @param {Function} fnCallback 
     * - 성공시 실행되는 Callback Function 
     ************************************************************************/
    oAPP.fn.fnCheckAppExists = function (APPID, fnCallback) {

        // 화면 Lock 걸기 ([HTML5] sap 미정의 — 가드)
        if (typeof sap !== "undefined" && sap.ui && sap.ui.getCore) { sap.ui.getCore().lock(); }

        // Busy를 킨다.
        parent.setBusy("X");

        var oFormData = new FormData();
        oFormData.append("APPID", APPID);

        // 서버에서 App 정보를 구한다.
        ajax_init_prc(oFormData, lf_success);

        function lf_success(oAppInfo) {

            var oResult = {
                RETCD: "",
                RETURN: oAppInfo
            };

            // application 이 없을 경우 메시지 처리.
            if (oAppInfo.MSGTY == "N") {

                oResult.RETCD = "E";

                fnCallback(oResult);

                return;

            }

            oResult.RETCD = "S";

            fnCallback(oResult);

        }

    }; // end of oAPP.fn.fnCheckAppExists

    /************************************************************************
     * Electron 브라우저로 Window Open
     * **********************************************************************
     * @param {Object} oBrowserOption  
     * - Electron window Browser Option 참고
     ************************************************************************/
    oAPP.fn.fnExternalOpen = function (oBrowserOptions) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        function lf_external_open(oBrowserOptions) {

            let sPath = oBrowserOptions.url,

                // sPath = parent.getServerPath() + "/external_open?URL=" + sExtUrl,
                sExtOpenHtmlUrl = parent.getPath('EXTOPEN');

            // [공통 헤더] 모든 extopen 팝업(예제 열기/아이콘 리스트/Property Help 등)은
            //   네이티브 타이틀바를 숨기고 extopen.html 의 공통 커스텀 헤더(.u4a-titlebar = 메인창과 동일)를 쓴다.
            //   → 창마다 따로 처리하지 않고 여기서 일괄 적용(홀리스틱 통일).
            oBrowserOptions.titleBarStyle = "hidden";

            // 브라우저 오픈
            let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

            oBrowserWindow.setMenu(null);

            // 공통 헤더가 "첫 페인트부터" 테마/제목을 반영하도록 쿼리스트링으로 전달
            //   (extopen.html head 의 조기 테마 적용 스크립트가 THEME/BGCOL/TITLE 을 소비).
            var oExtTheme = {};
            try { oExtTheme = (parent.getThemeInfo && parent.getThemeInfo()) || {}; } catch (e) { oExtTheme = {}; }

            const oQueryParams = {
                browserkey: oBrowserOptions?.webPreferences?.browserkey,
                sessionKey: oBrowserOptions?.webPreferences?.partition,
                OBJTY: oBrowserOptions?.webPreferences?.OBJTY || "",
                TITLE: oBrowserOptions?.title || "",
                THEME: oExtTheme.THEME || "",
                BGCOL: oExtTheme.BGCOL || "",
            };

            // URL에 QueryString 파라미터를 적용한다.
            const sLoadUrl = parent.WSUTIL.QueryString.build(sExtOpenHtmlUrl, oQueryParams);

            oBrowserWindow.loadURL(sLoadUrl);

            // no build 일 경우에는 개발자 툴을 실행한다.
            // if (!APP.isPackaged) {
            //     oBrowserWindow.webContents.openDevTools();
            // }      

            // 브라우저가 활성화 될 준비가 될때 타는 이벤트
            oBrowserWindow.once('ready-to-show', () => {

                // 부모 위치 가운데 배치한다.
                parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            });

            // 브라우저가 오픈이 다 되면 타는 이벤트
            oBrowserWindow.webContents.on('did-finish-load', function () {

                // 오픈할 URL 파라미터 전송
                oBrowserWindow.webContents.send('if-extopen-url', sPath);

                // 부모 위치 가운데 배치한다.
                parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            });

            // 브라우저를 닫을때 타는 이벤트
            oBrowserWindow.on('closed', () => {

                oBrowserWindow = null;

                CURRWIN.focus();

            });

        } // end of lf_external_open

        function lf_success(oReturn) {

            if (oReturn.RETCD != "S") {

                parent.setBusy('');

                return;
            }

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("X");

            lf_external_open(oBrowserOptions);

        } // end of lf_success

        // 로그인 세션 유지 상태 체크
        APPCOMMON.sendAjaxLoginChk(lf_success);

    }; // end of oAPP.fn.fnExternalOpen


    // /**
    //  * @since   2025-12-08 14:12:49
    //  * @version v3.5.6-17
    //  * @author  soccerhs
    //  * @description
    //  * 
    //  * 개발자 모드 브라우저 실행
    //  * 
    //  */
    // async function _openDevBrowser(oParam){

    //     let oBrowserOptions = {
    //         url: oParam.URL,
    //         launchOptions: {
    //             executablePath: oParam.INSPATH,
    //             args: [

    //             ]
    //         }
    //     };

    //     // 앱모드 일경우 파라미터 argument 추가
    //     // if(oParam.APP_MODE === true){
    //     //     oBrowserOptions.launchOptions.args.push(`--app=${oParam.URL}`);  
    //     // }

    //     let aLaunchArgs = [

    //         // 개발 브라우저는 무조건 앱 모드로 실행
    //         `--app=${oParam.URL}`,  

    //         // 개발 브라우저는 무조건 다크테마로 실행
    //         '--force-dark-mode',

    //     ];

    //     oBrowserOptions.launchOptions.args = aLaunchArgs;

    //     let oParams = {
    //         browserOptions: oBrowserOptions,
    //         oAPP : oAPP
    //     };

    //    await parent.require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "dev_browser"))(oParams);

    //     // busy 끄고 Lock 풀기
    //     oAPP.common.fnSetBusyLock("");

    // } // end of _openDevBrowser

    async function _openDevBrowser(oParams) {

        // 1. 하위 상대 경로 공통 정의
        // const sChromeSubPath = "node_modules\\U4A\\WS\\lib\\chrome\\win64-144.0.7559.96\\chrome-win64\\chrome.exe";
        const sLibSubPath = "node_modules\\U4A\\WS\\lib";

        // 2. 기본값 설정: 개발 환경(!isPackaged) 기준
        // 'C:\Users\socce\AppData\Local\Programs\com.u4a_ws3.app\resources'
        const sLocalAppData = parent.getLocalAppDataPath();
        let sBaseResourcesPath = parent.PATH.join(sLocalAppData, "Programs\\com.u4a_ws3.app\\resources");

        // 3. 패키징된 환경일 경우 경로 덮어쓰기
        if (APP.isPackaged) {
            sBaseResourcesPath = process.resourcesPath;
        }

        // 4. 최종 경로 조립
        // Chrome 실행 파일 경로
        let sChromeExePath = oParams.INSPATH;
        if (!parent.FS.existsSync(sChromeExePath)) {

            //#region 메시지 처리 해야할 부분
            //#endregion
            // [MSG]
            let sErrMsg = "개발 브라우저용 브라우저를 찾을 수 없습니다.";

            parent.showMessage(null, 20, 'E', sErrMsg);   // [HTML5] sap → null

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // Chrome 익스텐션/라이브러리 경로
        let sChromeExensionPath = parent.PATH.join(sBaseResourcesPath, sLibSubPath);

        let oBrowserOptions = {
            url: oParams.URL,
            launchOptions: {
                // devtools: !parent.REMOTE.app.isPackaged,
                executablePath: sChromeExePath,
                args: [
                    `--disable-extensions-except=${sChromeExensionPath}`,
                    `--load-extension=${sChromeExensionPath}`,
                ]
            }
        };

        let oDevBrowserParams = {
            browserOptions: oBrowserOptions,
            oAPP: oAPP
        };

        await parent.require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "dev_browser"))(oDevBrowserParams);

        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");

    } // end of _openDevBrowser

    /************************************************************************
     * 브라우저를 실행하는 공통 함수
     * @param {string} sUrl - 실행할 URL
     * @returns {boolean} - 성공 여부
     * **********************************************************************/
    oAPP.fn.fnLaunchBrowser = function (sUrl) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // [HTML5] 어떤 분기에서 throw 하더라도 busy 가 영구 잔류하지 않도록 전체 가드.
        //   (구: fnOnInitP13nSettings 가 /DEFBR 을 적재했으나 HTML5 에선 no-op 스텁이라
        //    /DEFBR 이 undefined → oDefBrows.find 에서 throw → busy 안 꺼지던 문제 수정.)
        try {

            // 기본 브라우저 설정 — /DEFBR 직접 적재(스텁 fnOnInitP13nSettings 대체).
            try { oAPP.fn.fnOnP13nExeDefaultBrowser(); } catch (e) { }
            oAPP.fn.fnOnInitP13nSettings();

            var SPAWN = parent.SPAWN,
                aComm = [];

            var oDefBrows = APPCOMMON.fnGetModelProperty("/DEFBR");
            if (!Array.isArray(oDefBrows)) { oDefBrows = []; }   // 미적재(undefined) 방어
            var oSelectedBrows = oDefBrows.find(a => a.SELECTED == true);

            // 브라우저 정보 검증
            if (!oSelectedBrows || !oSelectedBrows?.INSPATH) {

                // 설치된 브라우저 정보를 찾을 수 없습니다.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "333");

                parent.showMessage(null, 20, 'E', sMsg);   // [HTML5] sap → null

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // 개발 모드일 경우
            if (oSelectedBrows.NAME === "DEV_BROWSER") {

                let oParams = {
                    ...oSelectedBrows,
                    URL: sUrl
                };

                // 개발 모드 브라우저 실행 (async — 자체적으로 busy 해제)
                _openDevBrowser(oParams);

                return;
            }

            // 앱모드 처리
            if (oSelectedBrows?.APP_MODE === true) {
                sUrl = `--app=${sUrl}`;
            }

            aComm.push(sUrl);
            SPAWN(oSelectedBrows.INSPATH, aComm, { detached: true });

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

        } catch (e) {
            // 어떤 오류든 busy 잔류 방지(임의 메시지 미생성 — 개발자 콘솔만).
            console.error("[HTML5][WS20] fnLaunchBrowser:", e && e.message ? e.message : e);
            oAPP.common.fnSetBusyLock("");
        }

        return;
    };

    /************************************************************************
     * U4A 앱 실행
     * @param {string} APPID - 실행할 앱 ID
     * @param {boolean} bIsMulti - 멀티 프리뷰 모드 여부
     * **********************************************************************/
    oAPP.fn.fnOnExecApp = function (APPID, bIsMulti) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        APPID = APPID.toLowerCase();

        var oServerInfo = parent.getServerInfo(),
            sHost = parent.getHost(),
            sPath = `${sHost}/zu4a/${APPID}?sap-language=${oServerInfo.LANGU}&sap-client=${oServerInfo.CLIENT}`;

        if (bIsMulti) {
            sPath = `${sHost}/zu4a_imp/ui5multipreview?ws-platform=3.0&applid=${APPID}`;
        }

        oAPP.fn.fnLaunchBrowser(sPath);

        // oAPP.fn.fnExeBrowser(sPath);
    };


    /************************************************************************
     * 현재 파일에 저장되어있는 Default Browser 정보 기준으로 브라우저를 실행한다.
     * 
     * URL 경로로 브라우저 살행
     * 
     * (사용처 예시)
     * - USP의 Test Service
     * 
     * @param {string} sPath - 실행할 경로 (호스트 제외)
     * @param {string} sParam - 추가 URL 파라미터 (옵션)
     * **********************************************************************/
    oAPP.fn.fnExeBrowser = (sPath, sParam) => {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oServerInfo = parent.getServerInfo(),
            sHost = parent.getHost(),
            sUrl = `${sHost}${sPath}?sap-client=${oServerInfo.CLIENT}&sap-language=${oServerInfo.LANGU}`;

        if (typeof sParam == "string") {
            sUrl += `&${sParam}`;
        }

        oAPP.fn.fnLaunchBrowser(sUrl);
    };


    /************************************************************************
     * 어플리케이션의 실행 URL 구성     
     ************************************************************************/
    oAPP.fn.fnGetAppUrl = function (sAppId) {

        const oAppInfo = parent.getAppInfo();
        const oServerInfo = parent.getServerInfo();
        const sHost = parent.getHost();

        let sAPPID = oAppInfo?.APPID || "";
        if(sAppId){
            sAPPID = sAppId;
        }

        return `${sHost}/zu4a/${sAPPID}?sap-language=${oServerInfo.LANGU}&sap-client=${oServerInfo.CLIENT}`;

    }; // end of oAPP.fn.fnGetAppUrl


    /************************************************************************
     * 개발모드 브라우저 실행
     ************************************************************************/
    oAPP.fn.fnOpenDevBrowser = async function (option) {

        // 1. 하위 상대 경로 공통 정의
        // const sChromeSubPath = "node_modules\\U4A\\WS\\lib\\chrome\\win64-144.0.7559.96\\chrome-win64\\chrome.exe";
        const sLibSubPath = "node_modules\\U4A\\WS\\lib";

        // 2. 기본값 설정: 개발 환경(!isPackaged) 기준
        // 'C:\Users\socce\AppData\Local\Programs\com.u4a_ws3.app\resources'
        const sLocalAppData = parent.getLocalAppDataPath();
        let sBaseResourcesPath = parent.PATH.join(sLocalAppData, "Programs\\com.u4a_ws3.app\\resources");

        // 3. 패키징된 환경일 경우 경로 덮어쓰기
        if (APP.isPackaged) {
            sBaseResourcesPath = parent.process.resourcesPath;
        }

        // Chrome 익스텐션/라이브러리 경로
        let sChromeExensionPath = parent.PATH.join(sBaseResourcesPath, sLibSubPath);

        let oBrowserOptions = {
            url: option.URL,
            launchOptions: {
                // devtools: !parent.REMOTE.app.isPackaged,
                executablePath: option.INSPATH,
                args: [
                    `--disable-extensions-except=${sChromeExensionPath}`,
                    `--load-extension=${sChromeExensionPath}`,
                    '--disable-web-security',
                ]
            }
        };

        let oDevBrowserParams = {
            browserOptions: oBrowserOptions,
            oAPP: oAPP
        };

        await parent.require(parent.PATH.join(parent.PATHINFO.JS_ROOT, "utils", "dev_browser"))(oDevBrowserParams);

    };


    /************************************************************************
     * 어플리케이션 브라우저로 실행
     ************************************************************************/
    oAPP.fn.fnOpenAppInBrowser = async function (option) {

        // 공통 응답 구조
        const oRES = {
            RETCD: "E",
            STCOD: "",
            RTMSG: "",
        };

        // 1. 필수 값 체크 (URL, INSPATH)
        if (!option || !option.URL || !option.BROWSER_TYPE || !option.INSPATH) {

            oRES.STCOD = "E999";

            return oRES;
        }

        // 브라우저가 설치가 되지 않았을 경우 오류.
        if (parent.FS.existsSync(option.INSPATH) === false) {

            oRES.STCOD = "E001";

            return oRES;
        }

        // 개발모드 브라우저 일 경우.
        if (option.BROWSER_TYPE === "DEV_BROWSER") {

            await oAPP.fn.fnOpenDevBrowser({ URL: option.URL, INSPATH: option.INSPATH });

            oRES.RETCD = "S";

            return oRES;

        }

        const SPAWN = parent.SPAWN;
        const aComm = [];

        let sURL = option.URL;
        let bIsAppMode = option?.APP_MODE || false;

        // 앱모드 처리
        if (bIsAppMode === true) {
            sURL = `--app=${sURL}`;
        }

        aComm.push(sURL);

        SPAWN(option.INSPATH, aComm, { detached: true });

        oRES.RETCD = "S";

        return oRES;

    }; // end of oAPP.fn.fnOpenAppInBrowser


    /************************************************************************
     * APP SearchHelp의 App List Table Object Return
     ************************************************************************  
     * 예)oAPP.fn.fnSetTreeJson(oModel, "WS20.MIMETREE", "CHILD", "PARENT", "MIMETREE");
     * 
     * @param {*} m Core Model Instance
     * @param {*} p Tree를 구성할 원본 Model Path (Deep 은 [.] 점으로 구분)
     * @param {*} r CHILD
     * @param {*} t PARENT
     * @param {*} z 재구성할 MODEL PATH 명
     *************************************************************************/
    oAPP.fn.fnSetTreeJson = function (m, p, r, t, z) {

        var lp = p.replace(/[.\[\]]/g, '/');
        lp = lp.replace(/(\/\/)/g, '/');

        z = z.replace(/[\/]/g, 'x');
        r = r.replace(/[\/]/g, 'x');
        t = t.replace(/[\/]/g, 'x');

        var lp2 = lp.substr(0, lp.lastIndexOf('/'));

        var tm = m.getProperty('/' + lp);

        var tm2 = m.getProperty('/' + lp2);

        if (!tm || tm.length === 0) {
            tm2[z] = [];
            m.refresh();
            return;
        }

        var y = JSON.stringify(tm);

        var n = JSON.parse(y);

        for (var e, h, u, a = [], c = {}, o = 0, f = n.length; f > o; o++) {
            e = n[o],
                h = e[r],
                u = e[t] || 0,
                c[h] = c[h] || [],
                e[z] = c[h],
                0 != u ? (c[u] = c[u] || [], c[u].push(e)) : a.push(e);
        }

        tm2[z] = a;

    }; // end of oAPP.fn.fnSetTreeJson

    /************************************************************************
     * 현재 떠있는 브라우저 중, 같은 세션의 브라우저의 인스턴스를 구한다.
     ************************************************************************/
    oAPP.fn.fnGetSameBrowsers = function () {

        // 1. 현재 떠있는 브라우저 갯수를 구한다.
        var sKey = parent.getSessionKey(),
            oMeBrows = REMOTE.getCurrentWindow(), // 현재 나의 브라우저
            aBrowserList = REMOTE.BrowserWindow.getAllWindows(), // 떠있는 브라우저 전체
            iBrowsLen = aBrowserList.length;

        var iSamekeys = 0,
            aSameBrows = [];

        for (var i = 0; i < iBrowsLen; i++) {

            var oBrows = aBrowserList[i];
            if (oBrows.isDestroyed()) {
                continue;
            }

            try {

                var oWebCon = oBrows.webContents,
                    oWebPref = oWebCon.getWebPreferences();

            } catch (error) {
                continue;
            }

            // session 정보가 없으면 skip.
            var sSessionKey = oWebPref.partition;
            if (!sSessionKey) {
                continue;
            }

            // 브라우저가 내 자신이라면 skip.
            if (oBrows.id == oMeBrows.id) {
                // oMeBrowser = oBrows;
                continue;
            }

            // 현재 브라우저의 session key 와 동일하지 않으면 (다른 서버창) skip.
            if (sKey != sSessionKey) {
                continue;
            }

            /**
             * 메인이 아닌경우는 카운트 하지 않음.
             * (예: 팝업류)
             */
            if (oWebPref.OBJTY !== "MAIN") {
                continue;
            };

            // 같은 세션키를 가진 브라우저 갯수를 카운트한다.
            iSamekeys++;
            aSameBrows.push(oBrows);

        }

        return aSameBrows;

    }; // end of oAPP.fn.fnGetSameBrowsers

    oAPP.fn.fnGetSameBrowsersAll = () => {

        // 1. 현재 떠있는 브라우저 갯수를 구한다.
        var sKey = parent.getSessionKey(),
            oMeBrows = REMOTE.getCurrentWindow(), // 현재 나의 브라우저
            aBrowserList = REMOTE.BrowserWindow.getAllWindows(), // 떠있는 브라우저 전체
            iBrowsLen = aBrowserList.length;

        var aSameBrows = [];

        for (var i = 0; i < iBrowsLen; i++) {

            var oBrows = aBrowserList[i];
            if (oBrows.isDestroyed()) {
                continue;
            }

            try {

                var oWebCon = oBrows.webContents,
                    oWebPref = oWebCon.getWebPreferences();

            } catch (error) {
                continue;
            }

            // session 정보가 없으면 skip.
            var sSessionKey = oWebPref.partition;
            if (!sSessionKey) {
                continue;
            }

            // 현재 브라우저의 session key 와 동일하지 않으면 (다른 서버창) skip.
            if (sKey != sSessionKey) {
                continue;
            }

            // 같은 세션키를 가진 브라우저 갯수를 카운트한다.            
            aSameBrows.push(oBrows);
        }

        return aSameBrows;

    };

    /** 
     * @param {String} sUrl 
     * - window Open 시 실행할 URL
     * 
     * @param {Array} aParams 
     * - Post로 전송할 파라미터
     * - 형식 [{ NAME:"", VALUE:""}, ... ]
     */
    oAPP.fn.fnCallBrowserOpenPost = function (sUrl, aParams) {

        // dummy로 생성한 form이 있으면 지우고 시작
        var oDummyForm = document.getElementById('dummyform');
        if (oDummyForm) {
            document.body.removeChild(oDummyForm);
        }

        // window.open시 부여할 id
        var sWinKey = parent.getRandomKey(10);

        //동적 폼 생성
        var oDummyForm = document.createElement("form");
        oDummyForm.setAttribute("method", "POST");
        oDummyForm.setAttribute("id", "dummyform");
        oDummyForm.setAttribute("action", sUrl);
        oDummyForm.setAttribute("target", sWinKey);
        oDummyForm.setAttribute("name", sWinKey);

        document.body.appendChild(oDummyForm);

        // 동적 파라미터 생성
        if (aParams) {

            var iParlen = aParams.length;

            for (var i = 0; i < iParlen; i++) {

                var oParam = aParams[i],
                    oFormInput = document.createElement("input");

                oFormInput.setAttribute("type", "hidden");
                oFormInput.setAttribute("name", oParam.NAME);
                oFormInput.setAttribute("value", oParam.VALUE);

                oDummyForm.appendChild(oFormInput);

            }

        }

        // window open 실행
        var oWin = window.open("", sWinKey);

        // window open 후 focus 주기
        if (oWin) {
            oWin.focus();
        }

        // window open 후 Form Submit
        oDummyForm.submit();

        try {

            var oDummyForm = document.getElementById('dummyform');
            if (oDummyForm) {
                document.body.removeChild(oDummyForm);
            }

            aParams = null;

        } catch (err) {

        }

    }; // end of oAPP.fn.fnCallBrowserOpenPost    

    // /************************************************************************
    //  * 화면에 떠있는 Dialog 들이 있을 경우 모두 닫는다.
    //  * **********************************************************************/
    // oAPP.fn.fnCloseAllDialog = function () {

    //     // var $OpenDialogs = $(".sapMDialogOpen"),
    //     //     iDialogLen = $OpenDialogs.length;

    //     // if (iDialogLen <= 0) {
    //     //     return;
    //     // }

    //     // for (var i = 0; i < iDialogLen; i++) {

    //     //     var $oDialog = $OpenDialogs[i],
    //     //         sDialogId = $oDialog.id,

    //     //         oDialog = sap.ui.getCore().byId(sDialogId);

    //     //     if (!oDialog) {
    //     //         continue;
    //     //     }

    //     //     oDialog.close();
    //     //     oDialog.destroy();

    //     // }

    //     let oInsMan = sap.m.InstanceManager;

    //     oInsMan.closeAllDialogs();
    //     oInsMan.closeAllPopovers();
    //     oInsMan.closeAllLightBoxes();

    // }; // end of oAPP.fn.fnCloseAllDialog


    /*************************************************************************
     * 제외 대상을 제외한 모든 Open된 Dialog를 닫는다.
     *************************************************************************/
    function _closeAllDialogs() {
        // 1. 자동 Close 제외 대상 정의 (필요 시 상수로 외부 분리 가능)
        const EXCLUDE_DIALOG_NAMES = [
            "APPF4"
        ];

        // 2. 현재 열려있는 Dialog 목록 조회 및 유효성 검사
        const aOpenDialogs = sap.m.InstanceManager.getOpenDialogs();
        if (!Array.isArray(aOpenDialogs) || aOpenDialogs.length === 0) {
            return;
        }

        // 3. Dialog 순회 및 조건부 닫기
        aOpenDialogs.forEach(oDialog => {
            const sDlgName = oDialog.data("DLG_NAME");
            
            // CustomData가 없거나 제외 목록에 포함되어 있으면 스킵
            if (!sDlgName || EXCLUDE_DIALOG_NAMES.includes(sDlgName)) {
                return;
            }

            oDialog.close();
        });
    } // end of _closeAllDialogs

    /*************************************************************************
     * 화면에 표시된 모든 UI 요소(Dialog, Popover, LightBox)를 닫는다.
     * (단, 특정 제외 대상 Dialog는 유지)
     *************************************************************************/
    oAPP.fn.fnCloseAllDialog = function () {
        
        const oInsMan = sap.m.InstanceManager;

        // 1. 커스텀 Dialog 닫기 로직 실행
        _closeAllDialogs();

        // 2. 기타 팝업 요소 일괄 종료
        oInsMan.closeAllPopovers();
        oInsMan.closeAllLightBoxes();

    }; // end of oAPP.fn.fnCloseAllDialog


    /************************************************************************
    * Electron Browser들 예외 대상 제외한 전체 닫는 function
    ************************************************************************/
    oAPP.fn.fnChildWindowAllClose = () => {

        var oCurrWin = parent.REMOTE.getCurrentWindow();
        if (oCurrWin.isDestroyed()) {
            return;
        }

        var aChild = oCurrWin.getChildWindows(),
            iChildCnt = aChild.length;

        if (iChildCnt <= 0) {
            return;
        }

        for (var i = 0; i < iChildCnt; i++) {

            var oChild = aChild[i];
            if (oChild.isDestroyed()) {
                continue;
            }

            try {
                oChild.close();
            } catch (error) {

            }

        }

    }; // end of oAPP.fn.fnChildWindowAllClose


    /************************************************************************
     * 현재 윈도우 객체에서 맵으로 관리하고 있는 자식 윈도우를 닫아준다.
     ************************************************************************/
    function _closeAllChildWindowMap() {

        let CURRWIN = parent.CURRWIN;

        // 1. 맵이 비어있으면 즉시 종료
        if (!CURRWIN._aChildWinMap || CURRWIN._aChildWinMap.size === 0) return;

        // 2. Map의 모든 윈도우 객체를 배열로 변환
        const windows = Array.from(CURRWIN._aChildWinMap.values());

        for (const win of windows) {
            try {
                // win.isDestroyed() 체크는 필수입니다 (이미 닫힌 창 에러 방지)
                if (win && !win.isDestroyed()) {
                    win.close(); 
                }
            } catch (err) {
                console.warn("Window Close Error:", err);
            }
        }

        // 3. 맵을 완전히 비워 메모리 참조 해제
        CURRWIN._aChildWinMap.clear();

    } // end of _closeAllChildWindowMap

    /************************************************************************
     * Electron Browser들 예외 대상 제외한 전체 닫는 function
     ************************************************************************/
    oAPP.fn.fnChildWindowClose = function () {

        // 현재 윈도우 객체에서 맵으로 관리하고 있는 자식 윈도우를 닫아준다.
        _closeAllChildWindowMap();

        var oCurrWin = parent.REMOTE.getCurrentWindow();
        if (oCurrWin.isDestroyed()) {
            return;
        }

        var aChild = oCurrWin.getChildWindows(),
            iChildCnt = aChild.length;

        if (iChildCnt <= 0) {
            return;
        }

        for (var i = 0; i < iChildCnt; i++) {

            var oChild = aChild[i];
            if (oChild.isDestroyed()) {
                continue;
            }

            // 위에서 isDestroyed 를 체크를 할때는 윈도우가 죽지 않았지만
            // 여기까지 왔을때 죽었을 경우 오류 발생을 방지하기 위해 try catch로 조치함.
            // (이미 브라우저가 죽었기 때문에 아래 하위 로직은 의미가 없음)
            try {

                var oWebCon = oChild.webContents,
                    oWebPref = oWebCon.getWebPreferences(),
                    sOBJTY = oWebPref.OBJTY;

                // child window 닫을 때 예외 팝업 체크
                var bIsHideExp = oAPP.fn.fnCheckPopupCloseException(sOBJTY);
                if (bIsHideExp) {
                    continue;
                }

                oChild.close();

            } catch (error) {
                continue;
            }

        }

    }; // end of oAPP.fn.fnChildWindowClose

    /************************************************************************
     * Electron Browser들 전체 활성/비활성화
     ************************************************************************/
    oAPP.fn.fnChildWindowShow = function (bShow) {

        var oCurrWin = REMOTE.getCurrentWindow();
        if (oCurrWin.isDestroyed()) {
            return;
        }

        var aChild = oCurrWin.getChildWindows(),
            iChildCnt = aChild.length;

        if (iChildCnt <= 0) {
            return;
        }

        for (var i = 0; i < iChildCnt; i++) {

            let oChild = aChild[i],
                bIsDestroyed = oChild.isDestroyed();

            if (bIsDestroyed) {
                continue;
            }

            // 위에서 isDestroyed 를 체크를 할때는 윈도우가 죽지 않았지만
            // 여기까지 왔을때 죽었을 경우 오류 발생을 방지하기 위해 try catch로 조치함.
            // (이미 브라우저가 죽었기 때문에 아래 하위 로직은 의미가 없음)
            try {

                var oWebCon = oChild.webContents,
                    oWebPref = oWebCon.getWebPreferences(),
                    sOBJTY = oWebPref.OBJTY;

                // child window들 활성 or 비활성 시 예외 대상 팝업 체크
                var bIsHideExp = oAPP.fn.fnCheckPopupHideException(sOBJTY);
                if (bIsHideExp) {
                    continue;
                }

                var isVisible = oChild.isVisible();

                // 숨기려는 경우
                if (!bShow) {

                    setTimeout(() => {

                        if (oChild.isDestroyed()) {
                            return;
                        }

                        try {

                            // oChild.hide(); 

                            oChild.setOpacity(0);

                        } catch (error) {
                            return;
                        }

                    }, 0);

                    continue;
                }


                // if (isVisible) {
                //     continue;
                // }

                if (oChild.isDestroyed()) {
                    continue;
                }

                // oChild.show();
                try {
                    oChild.setOpacity(1);
                } catch (error) {

                }


            } catch (error) {
                continue;
            }

        }

    }; // end of oAPP.fn.fnChildWindowShow

    /************************************************************************
     * 전체 Electron Browser Close 시 예외 대상 체크
     ************************************************************************/
    oAPP.fn.fnCheckPopupCloseException = (OBJTY) => {

        let aExceptionList = [
            "VIDEOREC",
            "EXAMPLE",
            "PATTPOPUP",
            "FLTMENU",
        ];

        if (!OBJTY) {
            return false;
        }

        return (aExceptionList.find(element => element == OBJTY) == null ? false : true);


    }; // end of oAPP.fn.fnCheckPopupCloseException

    /************************************************************************
     * Electron Browser 활성 or 비활성 예외 대상 체크
     ************************************************************************/
    oAPP.fn.fnCheckPopupHideException = (OBJTY) => {

        let aExceptionList = [
            "VIDEOREC",
            "EXAMPLE",
            "WINSHOWHIDE"
            // "ICONPREV"
        ];

        if (!OBJTY) {
            return false;
        }

        return (aExceptionList.find(element => element == OBJTY) == null ? false : true);

    }; // end of oAPP.fn.fnCheckPopupHideException

    /************************************************************************
     * WS20 화면에서 떠있는 Dialog, Popup 종류, Electron Browser들 전체 닫는 function
     ************************************************************************/
    oAPP.fn.fnCloseAllWs20Dialogs = function () {

        // Dialog가 있을 경우 닫는다.
        oAPP.fn.fnCloseAllDialog();

        // footer 메시지가 열려 있을 경우 닫는다.
        APPCOMMON.fnHideFloatingFooterMsg();

        // Multi Footer 메시지 영역이 있으면 삭제.
        APPCOMMON.fnMultiFooterMsgClose();

        // Electron Browser들 전체 닫는 function
        oAPP.fn.fnChildWindowClose();

    }; // end of oAPP.fn.fnCloseAllWs20Dialogs

})(window, $, oAPP);