/**************************************************************************
 * ws_events.js
 **************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const USERINFO = parent.getUserInfo();
    const LANGU = USERINFO.LANGU;

    oAPP.events = {};

    let REMOTE = parent.REMOTE,
        APPCOMMON = oAPP.common,
        REMOTEMAIN = parent.REMOTEMAIN,
        CURRWIN = REMOTE.getCurrentWindow();

    /************************************************************************
     * App 생성팝업
     ************************************************************************/
    oAPP.events.ev_AppCreate = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Create, Copy일 경우에만 App Name MaxLength Check 해야함!!
        let bAppMaxLengthCheck = true;

        var bCheckAppNm = oAPP.fn.fnCheckAppName(bAppMaxLengthCheck);
        if (!bCheckAppNm) {

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // application 존재 여부 체크
        var oAppNmInput = sap.ui.getCore().byId("AppNmInput"),
            sAppID = oAppNmInput.getValue();

        var oFormData = new FormData();
        oFormData.append("APPID", sAppID);

        // 서버에서 App 정보를 구한다.
        ajax_init_prc(oFormData, lf_success);

        function lf_success(oAppInfo) {

            if (oAppInfo.MSGTY == "") {

                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "035"); // It is already registered application information.

                // 페이지 푸터 메시지			
                APPCOMMON.fnShowFloatingFooterMsg("E", "WS10", sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            if (!oAPP.fn.createApplicationPopup) {

                // Application 생성 팝업 띄우기
                $.getScript("design/js/createApplicationPopup.js", function () {

                    oAPP.fn.createApplicationPopup(sAppID);

                    // busy 끄고 Lock 풀기
                    oAPP.common.fnSetBusyLock("");

                });

                return;

            }

            // Application 생성 팝업 띄우기
            oAPP.fn.createApplicationPopup(sAppID);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

        }

    }; // end of oAPP.events.ev_AppCreate

    /************************************************************************
     * App 수정
     ************************************************************************/
    oAPP.events.ev_AppChange = async function () {

        // busy 키고 Lock 걸기        
        oAPP.common.fnSetBusyLock("X");

        zconsole.log("ev_AppChange");        

        var oAppNmInput = sap.ui.getCore().byId("AppNmInput"),
            sAppID = oAppNmInput.getValue();
        
        oAPP.fn.fnOnEnterDispChangeMode(sAppID, "X"); // [async]

    }; // end of oAPP.events.ev_AppChange

    /************************************************************************
     * App 삭제
     ************************************************************************/
    oAPP.events.ev_AppDelete = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {
            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // var bCheckAppNm = oAPP.fn.fnCheckAppName();
        // if (!bCheckAppNm) {
        //     // busy 끄고 Lock 풀기
        //     oAPP.common.fnSetBusyLock("");
        //     return;
        // }

        var oAppNmInput = sap.ui.getCore().byId("AppNmInput");
        if (!oAppNmInput) {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        let oUserInfo = parent.process.USERINFO;
        let sLangu = oUserInfo.LANGU;
        
        var sValue = oAppNmInput.getValue(),
            sCurrPage = parent.getCurrPage();

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

        // application 존재 여부 체크        
        let sAppID = oAppNmInput.getValue();

        // APP 존재 유무 확인
        oAPP.fn.fnCheckAppExists(sAppID, lf_result);

        function lf_result(RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (RESULT.RETCD == 'E') {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 질문 메시지
            var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "003"); // Do you really want to delete the object?

            // 질문팝업? 삭제하시겠습니까?            
            parent.showMessage(sap, 30, 'W', sMsg, function (TYPE) {
                
                // busy 키고 Lock 걸기
                oAPP.common.fnSetBusyLock("X");

                if (TYPE == null || TYPE == "NO") {

                    // busy 키고 Lock 걸기
                    oAPP.common.fnSetBusyLock("");

                    return;
                }
               
                // 삭제 어플리케이션이 USP 일 경우.
                if (oAppInfo.APPTY == "U") {

                    // 어플리케이션 삭제하러 서버 호출
                    oAPP.fn.fnSetUspAppDelete();

                    return;

                }

                // 어플리케이션 삭제하러 서버 호출
                oAPP.fn.fnSetAppDelete();

            });

        }

    }; // end of oAPP.events.ev_AppDelete

    /************************************************************************
     * App 삭제하러 서버 호출
     ************************************************************************/
    oAPP.fn.fnSetAppDelete = function (oParam) {

       // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // application 존재 여부 체크
        var oBindData = APPCOMMON.fnGetModelProperty("/WS10"),
            sAppId = oBindData.APPID;

        var sPath = parent.getServerPath() + '/app_delte',
            oFormData = new FormData();

        if (typeof oParam != "undefined") {
            oFormData.append("TRKORR", oParam.TRKORR);
        }

        oFormData.append("APPID", sAppId);

        sendAjax(sPath, oFormData, function (oResult) {

            // 스크립트가 있으면 eval 처리
            //   [HTML5] 서버 SCRIPT 는 UI5 의존 코드(parent.showMessage(sap, …) / sap.* 등)를
            //   담아 내려올 수 있다 — 특히 "다른 창에서 change 모드로 열려 lock 된 앱"을 삭제하면
            //   서버가 lock 오류 스크립트(sap 참조)를 보낸다. sap 전역이 없어 ReferenceError →
            //   window.onerror(ws_trycatch) → APP.exit() 로 앱이 강제종료되고 busy 도 멈춘 채
            //   남던 회귀를, eval 을 try/catch 로 감싸 차단(앱 유지 + 아래 busy 해제 보장).
            //   eval 은 lf_appDelCtsPopup 등 로컬 헬퍼를 서버 스크립트가 호출할 수 있어 동일 스코프 유지.
            if (oResult.SCRIPT) {
                try {
                    eval(oResult.SCRIPT);
                } catch (e) {
                    console.error("[HTML5] /app_delte SCRIPT eval 실패 (UI5 의존 추정):", e && e.message, oResult.SCRIPT);
                }
            }

            if (oResult.RETCD == "E") {

                // 오류 사운드 실행
                parent.setSoundMsg('02'); // sap sound(error)

                let oCurrWin = REMOTE.getCurrentWindow();

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // 화면 Lock 해제 ([HTML5] sap 미정의 — 가드)
                if (typeof sap !== "undefined" && sap.ui && sap.ui.getCore) { sap.ui.getCore().unlock(); }

                // [HTML5] 구 SCRIPT(showMessage) 가 sap 의존이라 못 떠도, 서버가 준 오류 메시지를
                //   푸터로 노출해 사용자에게 원인(lock 등)을 알린다. 메시지 없으면 사운드/깜빡임만.
                var sErrMsg = oResult.RETMSG || oResult.RTMSG || oResult.MESSAGE || "";
                if (sErrMsg) { APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), sErrMsg); }

                parent.setBusy("");

                return;
            }

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

        });

        // APP 삭제 전용 Cts Popup
        function lf_appDelCtsPopup() {

            // CTS Popup을 Open 한다.
            oAPP.fn.fnCtsPopupOpener(function (oResult) {

                oAPP.fn.fnSetAppDelete(oResult);

            });

        }

    }; // end of oAPP.fn.fnSetAppDelete

    /************************************************************************
     * USP App 삭제하러 서버 호출
     ************************************************************************/
    oAPP.fn.fnSetUspAppDelete = function (oParam) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // application 존재 여부 체크
        var oBindData = APPCOMMON.fnGetModelProperty("/WS10"),
            sAppId = oBindData.APPID;

        var sPath = parent.getServerPath() + '/usp_app_delete',
            oFormData = new FormData();

        var oDelAppInfo = {
            APPID: sAppId,
            TRKORR: "",
        };

        if (typeof oParam != "undefined") {
            oDelAppInfo.TRKORR = oParam.TRKORR;
        }

        oFormData.append("APPDATA", JSON.stringify(oDelAppInfo));

        sendAjax(sPath, oFormData, function (oResult) {

            // 스크립트가 있으면 eval 처리
            //   [HTML5] /app_delte 와 동일 — 서버 SCRIPT 의 UI5(sap) 의존으로 인한
            //   window.onerror → APP.exit() 회귀를 try/catch 로 차단. (lf_appDelCtsPopup 등
            //   로컬 헬퍼 호출 가능성 때문에 eval 은 동일 스코프 유지)
            if (oResult.SCRIPT) {
                try {
                    eval(oResult.SCRIPT);
                } catch (e) {
                    console.error("[HTML5] /usp_app_delete SCRIPT eval 실패 (UI5 의존 추정):", e && e.message, oResult.SCRIPT);
                }
            }

            // 오류 일 경우.
            if (oResult.RETCD == "E") {

                parent.setSoundMsg("02"); // error sound

                // 작업표시줄 깜빡임
                CURRWIN.flashFrame(true);

                // [HTML5] 구 SCRIPT(showMessage) 가 못 떠도 서버 오류 메시지를 푸터로 노출.
                var sErrMsg = oResult.RETMSG || oResult.RTMSG || oResult.MESSAGE || "";
                if (sErrMsg) { APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), sErrMsg); }

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;

            }

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

        });

        // APP 삭제 전용 Cts Popup
        function lf_appDelCtsPopup() {

            // CTS Popup을 Open 한다.
            oAPP.fn.fnCtsPopupOpener(function (oResult) {

                oAPP.fn.fnSetUspAppDelete(oResult);

            });

        }

    } // end of oAPP.fn.fnSetUspAppDelete

    /************************************************************************
     * App 복사
     ************************************************************************/
    oAPP.events.ev_AppCopy = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // // 어플리케이션 명 입력 유무 및 데이터 정합성 체크
        // var bCheckAppNm = oAPP.fn.fnCheckAppName();
        // if (!bCheckAppNm) {
        //     // busy 끄고 Lock 풀기
        //     oAPP.common.fnSetBusyLock("");
        //     return;
        // }

        // [HTML5] AppNmInput 은 WS10 의 HTML5 <input> — byId 대신 DOM 헬퍼, getValue()→.value 호환.
        var oAppNmInput = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null);
        if (!oAppNmInput) {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        var sValue = (typeof oAppNmInput.getValue === "function" ? oAppNmInput.getValue() : (oAppNmInput.value || "")),
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

        // application 존재 여부 체크
        // [HTML5] AppNmInput DOM 값 재조회(byId/getValue 미사용)
        var oAppNmInput2 = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null),
            sAppID = !oAppNmInput2 ? "" : (typeof oAppNmInput2.getValue === "function" ? oAppNmInput2.getValue() : (oAppNmInput2.value || ""));

        // APP 존재 유무 확인
        oAPP.fn.fnCheckAppExists(sAppID, lf_result);

        function lf_result(RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (RESULT.RETCD == 'E') {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;

            }

            // // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

            // Application 복사 팝업을 띄운다
            oAPP.fn.fnAppCopyPopupOpener(sAppID);

        }

    }; // end of oAPP.events.ev_AppCopy

    /************************************************************************
     * App 조회
     ************************************************************************/
    oAPP.events.ev_AppDisplay = function (oEvent) {

        

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oAppNmInput = sap.ui.getCore().byId("AppNmInput"),
            sAppID = oAppNmInput.getValue();

        oAPP.fn.fnOnEnterDispChangeMode(sAppID, ""); // [async]

    }; // end of oAPP.events.ev_AppDisplay

    /************************************************************************
     * App 실행
     ************************************************************************/
    oAPP.events.ev_AppExec = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");       

        // var bCheckAppNm = oAPP.fn.fnCheckAppName();
        // if (!bCheckAppNm) {
        //     // busy 끄고 Lock 풀기
        //     oAPP.common.fnSetBusyLock("");
        //     return;
        // }

        // [HTML5] AppNmInput 은 WS10 의 HTML5 <input> — byId 대신 DOM 헬퍼, getValue()→.value 호환.
        var oAppNmInput = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null);
        if (!oAppNmInput) {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        var sValue = (typeof oAppNmInput.getValue === "function" ? oAppNmInput.getValue() : (oAppNmInput.value || "")),
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


        // [HTML5] AppNmInput DOM 값 재조회(byId/getValue 미사용)
        var oAppNmInput2 = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null),
            sAppID = !oAppNmInput2 ? "" : (typeof oAppNmInput2.getValue === "function" ? oAppNmInput2.getValue() : (oAppNmInput2.value || ""));

        // APP 존재 유무 확인
        oAPP.fn.fnCheckAppExists(sAppID, lf_result);

        function lf_result(RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (RESULT.RETCD == 'E') {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // USP App 일 경우 실행하지 않음.
            if (oAppInfo.APPTY === "U") {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);
                
                let sMsg = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "189"); // USP apps are not supported.

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // Inactivate 상태일 경우
            if (oAppInfo.ACTST == "I") {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "031"); // Only in activity state !!!

                // This application cannot be executed.
                var sMsg = parent.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", "434");

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

                // 화면 Lock 해제 ([HTML5] sap 미정의 — 가드)
                if (typeof sap !== "undefined" && sap.ui && sap.ui.getCore) { sap.ui.getCore().unlock(); }

                // Busy를 끈다.
                parent.setBusy("");

                return;
            }

            oAPP.fn.fnOnExecApp(sAppID); // [ws_fn_02.js]

            // // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");
        }

    }; // end of oAPP.events.ev_AppExec

    /************************************************************************
     * Application Execution — 특정 브라우저로 실행 (WS10 / AppNmInput 기준)
     * ----------------------------------------------------------------------
     * 실행 분할버튼의 드롭다운 항목(Chrome/Edge/...)에서 호출.
     *   ★ 메인 ev_AppExec(→ fnLaunchBrowser, SELECTED 브라우저 + 저장된 APP_MODE)과 달리,
     *     원본 WS20 ev_pressAppExecBtnByBrowser 와 동일하게 "선택한 브라우저 + APP_MODE:false"
     *     로 실행한다. (fnLaunchBrowser 는 fnOnP13nExeDefaultBrowser 로 /DEFBR 을 재적재해
     *      임시 SELECTED 가 덮어써지고 저장된 APP_MODE 가 적용되어 앱모드로 떠버리는 문제.)
     *   검증(앱명 필수/공백/특수문자/존재/USP/Inactive)은 ev_AppExec 와 동일.
     * @param {string} sBrowserName "CHROME" | "MSEDGE" | "DEV_BROWSER"
     ************************************************************************/
    oAPP.events.ev_AppExecByBrowser = function (sBrowserName) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oAppNmInput = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null);
        if (!oAppNmInput) { oAPP.common.fnSetBusyLock(""); return; }

        var sValue = (typeof oAppNmInput.getValue === "function" ? oAppNmInput.getValue() : (oAppNmInput.value || "")),
            sCurrPage = parent.getCurrPage(),
            sLangu = (parent.process.USERINFO || {}).LANGU;

        // 입력값 유무 확인 (273 Application name is required.)
        if (typeof sValue !== "string" || sValue == "") {
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273"));
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 공백 (274 must not contain any spaces.)
        if (/\s/.test(sValue)) {
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "274"));
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 특수문자 (278 Special characters are not allowed.)
        if (/[^\w]/.test(sValue)) {
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278"));
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // APP 존재/상태 확인 후 실행 (ev_AppExec lf_result 와 동일 가드)
        oAPP.fn.fnCheckAppExists(sValue, function (RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow();

            if (RESULT.RETCD == "E") {
                oCurrWin.flashFrame(true);
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID));
                oAPP.common.fnSetBusyLock("");
                return;
            }

            // USP App 미지원 (189)
            if (oAppInfo.APPTY === "U") {
                oCurrWin.flashFrame(true);
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "189"));
                oAPP.common.fnSetBusyLock("");
                return;
            }

            // Inactivate 상태 (434)
            if (oAppInfo.ACTST == "I") {
                oCurrWin.flashFrame(true);
                APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "434"));
                oAPP.common.fnSetBusyLock("");
                return;
            }

            // 선택한 브라우저 정보 (/DEFBR)
            var aDefBrows = APPCOMMON.fnGetModelProperty("/DEFBR") || [],
                oBrows = aDefBrows.find(function (o) { return o.NAME === sBrowserName; });
            if (!oBrows) { oAPP.common.fnSetBusyLock(""); return; }

            // 선택 브라우저로 일반 모드 실행(APP_MODE:false — 원본 동일). fnLaunchBrowser 미경유.
            var oOptions = {
                BROWSER_TYPE: oBrows.NAME,
                INSPATH: oBrows.INSPATH,
                APP_MODE: false,
                URL: oAPP.fn.fnGetAppUrl(oAppInfo.APPID)
            };

            Promise.resolve(oAPP.fn.fnOpenAppInBrowser(oOptions)).then(function (oResult) {
                if (oResult && oResult.RETCD === "E" && oResult.STCOD === "E001") {
                    // 설치된 브라우저 정보를 찾을 수 없습니다. (333)
                    APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "333"));
                }
                oAPP.common.fnSetBusyLock("");
            }).catch(function (e) {
                if (typeof console !== "undefined") { console.error("[WS10] ev_AppExecByBrowser:", e && e.message ? e.message : e); }
                oAPP.common.fnSetBusyLock("");
            });
        });

    }; // end of oAPP.events.ev_AppExecByBrowser

    /************************************************************************
     * Example 실행
     ************************************************************************/
    oAPP.events.ev_AppExam = function (oEvent) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 전체 자식 윈도우에 Busy 킨다.
        oAPP.attr.oMainBroad.postMessage({PRCCD:"BUSY_ON"});


        var oCurrWin = REMOTE.getCurrentWindow(),
            SESSKEY = parent.getSessionKey(),
            BROWSERKEY = parent.getBrowserKey();

        // var sExamUrl = encodeURI("/zu4a_imp/u4a_samples?parentTyp=ELEC&WS=X");
        // var sPath = parent.getServerPath() + "/external_open?URL=" + encodeURIComponent(sExamUrl);
        var sExamUrl = encodeURI("/zu4a_imp/u4a_samples?parentTyp=ELEC&WS=X&ws-platform=3.0");        
        var sPath = parent.getServerPath() + "/external_open?ws-platform=3.0&URL=" + encodeURIComponent(sExamUrl);

        var sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.url = sPath;
        oBrowserOptions.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A07"); // Example Open
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.modal = true;        
        oBrowserOptions.parent = oCurrWin;

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSERKEY;
        oBrowserOptions.webPreferences.OBJTY = "EXAMPLE"

        oAPP.fn.fnExternalOpen(oBrowserOptions);

    }; // end of oAPP.events.ev_AppExam

    /************************************************************************
     * App 모바일 미리보기
     ************************************************************************/
    oAPP.events.ev_MultiPrev = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // var bCheckAppNm = oAPP.fn.fnCheckAppName();
        // if (!bCheckAppNm) {
        //     // busy 끄고 Lock 풀기
        //     oAPP.common.fnSetBusyLock("");
        //     return;
        // }

        // [HTML5] AppNmInput 은 WS10 의 HTML5 <input> — byId 대신 DOM 헬퍼, getValue()→.value 호환.
        var oAppNmInput = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null);
        if (!oAppNmInput) {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        var sValue = (typeof oAppNmInput.getValue === "function" ? oAppNmInput.getValue() : (oAppNmInput.value || "")),
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
        

        // [HTML5] AppNmInput DOM 값 재조회(byId/getValue 미사용)
        var oAppNmInput2 = (typeof oAPP.fn.fnGetWs10AppInputDom === "function")
            ? oAPP.fn.fnGetWs10AppInputDom()
            : ((typeof sap !== "undefined" && sap.ui) ? sap.ui.getCore().byId("AppNmInput") : null),
            sAppID = !oAppNmInput2 ? "" : (typeof oAppNmInput2.getValue === "function" ? oAppNmInput2.getValue() : (oAppNmInput2.value || ""));

        // APP 존재 유무 확인
        oAPP.fn.fnCheckAppExists(sAppID, lf_result);

        function lf_result(RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (RESULT.RETCD == 'E') {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // Application ID &1 does not exist.
                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // USP App 일 경우 실행하지 않음.
            if (oAppInfo.APPTY == "U") {

                let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "189"); // USP apps are not supported.

                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                APPCOMMON.fnSetBusyLock("");

                return;
            }

            // Inactivate 상태일 경우
            if (oAppInfo.ACTST == "I") {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "031"); // Only in activity state !!!

                // 페이지 푸터 메시지
                APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            oAPP.fn.fnOnExecApp(sAppID, true);

            // // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

        }

    }; // end of ev_MultiPrev

    /************************************************************************
     * Application Name Input Search Help(F4)
     ************************************************************************/
    oAPP.events.ev_AppValueHelp = function (oEvent) {

        var bIsPressClearBtn = oEvent.getParameter("clearButtonPressed");
        if (bIsPressClearBtn) {

            var oInput = oEvent.getSource();
            oInput.suggest(true);

            return;
        }

        var oSuggetionItem = oEvent.getParameter("suggestionItem");
        if (oSuggetionItem) {
            return;
        }

        var iKeyCode = event.keyCode;

        // 엔터 또는 F5를 눌렀을 경우에는 F4 Help를 띄우지 않는다.
        if (iKeyCode == 13 || iKeyCode == 116) {
            return;
        }

        var oUserInfo = parent.getUserInfo(),
            sSapId = oUserInfo.ID;

        sSapId = sSapId.toUpperCase();

        // SearchHelp 실행 시, 필요한 Application 정보 데이터를 구한다. 
        var APPCOMMON = oAPP.common;

        var oAppInput = oEvent.getSource(),
            sAppId = APPCOMMON.fnGetModelProperty("/WS10/APPID");

        oAppInput.fireChange({
            value: oAppInput.getValue()
        });

        // Global APPTY 변수가 없다면 기본 "M" 타입으로 설정.
        if (!oAPP.attr.gAPPTY) {
            oAPP.attr.gAPPTY = "M";
        }

        // APP 검색 팝업 옵션
        var oOptions = {
            autoSearch: true,            
            initCond: {
                PACKG: "",
                APPID: sAppId,
                APPNM: "",
                APPTY: oAPP.attr.gAPPTY,
                EXPAGE: "WS10",
                ERUSR: sSapId,
                HITS: 500,
            }
        };

        // APP 검색 팝업
        oAPP.fn.fnAppF4PopupOpener(oOptions, fnAppF4DataCallback);

        function fnAppF4DataCallback(oAppData) {

            APPCOMMON.fnSetModelProperty("/WS10/APPID", oAppData.APPID);

        }

    }; // end of oAPP.events.ev_AppValueHelp

    /************************************************************************
     * new Window
     ************************************************************************/
    oAPP.events.ev_NewWindow = function () {

        parent.onNewWindow();

    }; // end of oAPP.events.ev_NewWindow

    /************************************************************************
     * Application Name Input Change Event
     ************************************************************************/
    oAPP.events.ev_AppInputChange = function (oEvent) {

        oEvent.preventDefault();

        var sValue = oEvent.getParameter("value");

        var sValueUpper = sValue.toUpperCase();

        oEvent.getSource().setValue(sValueUpper);

    }; // end of oAPP.events.ev_AppInputChange

    /************************************************************************
     * logout
     ************************************************************************/
    oAPP.events.ev_Logout = function () {        

        // Logout 버튼으로 Logout을 시도 했다는 Flag      
        oAPP.attr.isBrowserCloseLogoutMsgOpen = "X";

        // Unsaved data will be lost.
        // Do you want to log off?
        var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "301");
        sMsg += " \n " + APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "302");

        // 질문 팝업 — [UI5 제거] 구: parent.showMessage(sap, 30, 'I', ...) 는 sap.m.MessageBox
        //  의존이라 HTML5 에서 ReferenceError. 셸의 테마 native 확인창으로 대체(YES/NO 동일 계약).
        if (oAPP.common && typeof oAPP.common.fnConfirmBox === "function") {
            oAPP.common.fnConfirmBox('I', sMsg, lf_MsgCallback);
        } else {
            // 폴백: 헬퍼 미로드 시 브라우저 confirm
            lf_MsgCallback(window.confirm(sMsg) ? "YES" : "NO");
        }

        function lf_MsgCallback(TYPE) {

            if (TYPE == null || TYPE == "NO") {
                delete oAPP.attr.isBrowserCloseLogoutMsgOpen;
                return;
            }

            // 현재 브라우저에 종속된 팝업 종류들을 닫는다.
            // true: 강제로 닫기
            oAPP.fn.closeAllCurrWinDependentPopups(); // => [ws_fn_04.js]

            parent.IPCRENDERER.send('if-browser-close', {
                ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
                SESSKEY: parent.getSessionKey(),
                BROWSKEY: parent.getBrowserKey()
            });

            // Application 정보를 구한다.
            var oAppInfo = parent.getAppInfo() || oAPP.common.fnGetModelProperty("/WS30/APP"),
                SSID = parent.getSSID(),
                oFormData = new FormData();

            if(oAppInfo && oAppInfo.APPID){
                oFormData.append("APPID", oAppInfo.APPID || "");
            }
            
            oFormData.append("SSID", SSID);

            var sUrl = parent.getServerPath() + "/logoff";

            var option = {
                URL: sUrl,
                FORMDATA: oFormData
            };

            sendServerExit(option, () => {

                window.onbeforeunload = null;

                top.window.close();

            });

        }

    }; // end of oAPP.events.ev_Logout

    /************************************************************************
     * ws main 페이지로 이동
     ************************************************************************/
    oAPP.events.ev_pageBack = function (oEvent) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // app 정보를 구한다.
        var oAppInfo = parent.getAppInfo(),

            IS_CHAG = oAppInfo.IS_CHAG,
            IS_EDIT = oAppInfo.IS_EDIT;

        // 변경된 데이터가 없거나 display 모드일 경우 묻지도 말고 바로 빠져나간다.
        if (IS_CHAG !== 'X' || IS_EDIT !== 'X') {

            // WS10 페이지로 이동        
            oAPP.fn.fnMoveToWs10();

            return;
        }

        var sMsg = "";
        sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "118"); // Application has been changed
        sMsg += " \n " + APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "119"); // Save before leaving editor?

        // 사용자 응답을 대기하므로 busy 해제 + 떠있는 팝업 잠시 숨김
        oAPP.common.fnSetBusyLock("");
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }

        // 저장 여부 질문 (구: parent.showMessage(sap, 40, 'W', ...) — sap 의존 →
        //   HTML5 확인창. YES=저장 후 이동 / NO=저장 안 하고 이동 / CANCEL=머무름.)
        if (oAPP.common && typeof oAPP.common.fnConfirmBox === "function") {
            oAPP.common.fnConfirmBox('W', sMsg, oAPP.events.ev_pageBack_MsgCallBack, [
                { act: "YES", label: "Yes", emphasized: true },
                { act: "NO", label: "No" },
                { act: "CANCEL", label: "Cancel" }
            ]);
        } else {
            oAPP.events.ev_pageBack_MsgCallBack(window.confirm(sMsg) ? "YES" : "CANCEL");
        }

    }; // end of oAPP.events.ev_pageBack

    /************************************************************************
     * WS10 으로 화면 이동 전에 질문 팝업 callback function
     ************************************************************************/
    oAPP.events.ev_pageBack_MsgCallBack = function (ACTCD) {

        // 이동을 하지 않는다.
        if (ACTCD == null || ACTCD == "CANCEL") {

            // 현재 떠있는 팝업 창이 있었고 숨김 처리 되있었다면 다시 활성화 시킨다.
            oAPP.fn.fnChildWindowShow(true);

            return;
        }

        // 저장 후 이동한다.
        if (ACTCD == "YES") {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("X");

            // [HTML5] 구: sap.ui.getCore().byId("saveBtn").firePress({ISBACK:"X"})
            //   → 저장 핸들러 직접 호출(ISBACK="X" → 저장 성공 후 WS10 으로 이동).
            if (typeof oAPP.events.ev_pressSaveBtn !== "function") {
                oAPP.common.fnSetBusyLock("");
                try { parent.showMessage(null, 20, "E", "[Save] ev_pressSaveBtn 미정의"); } catch (e) { }
                return;
            }
            try {
                oAPP.events.ev_pressSaveBtn({ ISBACK: "X" });
            } catch (e) {
                oAPP.common.fnSetBusyLock("");
                try { parent.showMessage(null, 20, "E", "[Save] " + (e && e.message ? e.message : String(e))); } catch (e2) { }
                console.error("[HTML5][WS20] save(ISBACK) error:", e);
            }

            return;

        }

        // WS10 페이지로 이동
        oAPP.fn.fnMoveToWs10();

    }; // end of oAPP.events.ev_pageBack_MsgCallBack

    /************************************************************************
     * side navigation Menu click
     ************************************************************************/
    oAPP.events.ev_pressSideNavMenu = function (oEvent) {

        // // busy 키고 Lock 걸기
        // oAPP.common.fnSetBusyLock("X");

        var oSelectedItem = oEvent.getParameter("item"),
            sItemKey = oSelectedItem.getProperty("key"),
            sItemTxt = oSelectedItem.getProperty("text");

        var sPrefix = `fnWs20Side${sItemKey}`;

        if (typeof oAPP.fn[sPrefix] == "undefined") {

            // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

            return;
        };

        oAPP.fn[sPrefix](oEvent);

        // parent.showMessage(sap, 10, "", "key: " + sItemKey + ", text: " + sItemTxt);

    }; // end of oAPP.events.ev_pressSideNavMenu

    /************************************************************************
     * Syntax Check Button Event
     ************************************************************************/
    oAPP.events.ev_pressSyntaxCheckBtn = function (oEvent) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 현재 떠있는 브라우저
        var oCurrWin = REMOTE.getCurrentWindow(),
            sCurrPage = parent.getCurrPage();

        // 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnHideFloatingFooterMsg();

        // 멀티 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnMultiFooterMsgClose();

        // 디자인 영역의 오류를 점검한다.
        let T_excep = oAPP.fn.chkExcepionAttr(),
            iexceplength = T_excep.length;

        if (iexceplength !== 0) {

            oAPP.fn.fnMultiFooterMsg(T_excep);

            // 작업표시줄 깜빡임
            oCurrWin.flashFrame(true);
        
            return;
        }

        // 서버단 런타임 클래스의 신텍스 오류를 점검한다.
        var sPath = parent.getServerPath() + '/chk_ws_syntx',
            oFormData = new FormData();

        oFormData.append("APPDATA", JSON.stringify(oAPP.fn.getSaveData()));

        // Ajax 서버 호출
        sendAjax(sPath, oFormData, (oResult) => {

            // Syntax 오류가 없다면 메시지 처리 후 빠져나간다.
            if (oResult.RETCD != "E") {

                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "027"); // No syntax errors found

                APPCOMMON.fnShowFloatingFooterMsg('S', sCurrPage, sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            oAPP.fn.fnMultiFooterMsg(oResult.DATA);

            // 작업표시줄 깜빡임
            oCurrWin.flashFrame(true);

        });

    }; // end of oAPP.events.ev_pressSyntaxCheckBtn

    /************************************************************************
     * Display or Change Button Event
     ************************************************************************/
    oAPP.events.ev_pressDisplayModeBtn = function (oEvent) {

        var oAppInfo = jQuery.extend(true, {}, parent.getAppInfo()); // APP 정보

        // edit 모드 -> display 모드
        if (oAppInfo.IS_EDIT == "X") {

            // 변경된 값이 있는데 Display 모드로 갈려고 할 경우 메시지 팝업 보여준다.		
            if (oAppInfo.IS_CHAG == 'X') {

                // 메시지 팝업 띄울 때 Child window 가 있으면 Hide 시킨다.
                APPCOMMON.fnIsChildWindowShow(false);

                var sMsg = "";
                sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "118"); // Application has been changed
                sMsg += " \n " + APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "119"); // Save before leaving editor?

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                // [HTML5] showMessage 는 UI5 제거 후에도 첫 인자(oUI5) 무시(서명 유지). sap → null.
                parent.showMessage(null, 40, 'W', sMsg, lf_MsgCallback);
                return;
            }

            // WS20 페이지 정보 갱신            
            oAPP.fn.fnSetAppDisplayMode();

            return;
        }

        // display 모드 -> edit 모드
        oAPP.fn.fnSetAppChangeMode();

        /** 
         *  Local Function...
         */
        function lf_MsgCallback(ACTCD) {

            // busy 키고 Lock 걸기
            oAPP.common.fnSetBusyLock("X");

            // child window(각종 Editor창 등..) 가 있었을 경우, 메시지 팝업 뜬 상태에서 어떤 버튼이라도 누른 후에는 
            // child window를 활성화 한다.
            APPCOMMON.fnIsChildWindowShow(true);

            // 이동을 하지 않는다.
            if (ACTCD == null || ACTCD === "CANCEL") {

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                return;
            }

            // 저장 후 Display 모드로 이동한다.
            if (ACTCD === "YES") {

                // [HTML5] 구: sap.ui.getCore().byId("saveBtn").firePress({ISDISP:"X"})
                //   → 저장 핸들러 직접 호출(ISDISP="X" → 저장 성공 후 Display 모드 전환).
                oAPP.events.ev_pressSaveBtn({ ISDISP: 'X' });

                return;

            }

            // WS20 페이지 정보 갱신
            oAPP.fn.fnSetAppDisplayMode();

        } // end of lf_MsgCallback

    }; // end of oAPP.events.ev_pressDisplayModeBtn

    function lf_saveActiveCtsPopup(oEvent) {

        var lo_Event = oEvent;

        // CTS Popup을 Open 한다.
        oAPP.fn.fnCtsPopupOpener(function (oResult) {

            var oEvent = this,
                IS_ACT = oEvent.getParameter("IS_ACT");

            oEvent.mParameters.TRKORR = oResult.TRKORR;

            if (IS_ACT == 'X') {
                oAPP.events.ev_pressActivateBtn(oEvent);
                return;
            }

            oAPP.events.ev_pressSaveBtn(oEvent);

        }.bind(lo_Event));

    }

    /************************************************************************
     * [HTML5] 작업표시줄 깜빡임 안전 호출 — CURRWIN/REMOTE 미정의 렌더러 대비.
     ************************************************************************/
    function _ws20FlashFrame() {
        try {
            var w = (typeof CURRWIN !== "undefined" && CURRWIN) ? CURRWIN
                  : (parent.REMOTE ? parent.REMOTE.getCurrentWindow() : (parent.CURRWIN || null));
            if (w && w.flashFrame) { w.flashFrame(true); }
        } catch (e) { }
    }

    /************************************************************************
     * Activate Button Event
     ************************************************************************/
    oAPP.events.ev_pressActivateBtn = async function (oEvent) {
        
        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnHideFloatingFooterMsg();

        // 멀티 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnMultiFooterMsgClose();

        // [HTML5] 예외검증은 design 모듈(chkExcepionAttr)에 의존 — 미로드/오류 시 검증 skip.
        let T_excep = [];
        try {
            if (typeof oAPP.fn.chkExcepionAttr === "function") { T_excep = oAPP.fn.chkExcepionAttr() || []; }
        } catch (e) { console.warn("[HTML5][WS20] chkExcepionAttr skip:", e && e.message); }
        let iexceplength = T_excep.length;

        if (iexceplength !== 0) {

            // // 자식 윈도우 활성화
            // oAPP.fn.fnChildWindowShow(true);
            
            // 멀티푸터 메시지 실행
            // 이 안에서 화면이 로드가 완료되면
            // IPC로 비지 끄는 로직 있음
            try { if (oAPP.fn.fnMultiFooterMsg) { oAPP.fn.fnMultiFooterMsg(T_excep); } } catch (e) { }

            // 작업표시줄 깜빡임
            _ws20FlashFrame();

            // // busy 끄고 Lock 풀기
            // oAPP.common.fnSetBusyLock("");

            return;

        }

        // 자식 윈도우 숨기기
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }

        // [HTML5] oEvent 는 HTML5 버튼/단축키에서 미전달될 수 있음(옵셔널).
        //   구 sap.ui.base.Event 기반 oNewEvent 는 이후 미사용(사장 코드)이라 제거.
        oEvent = oEvent || {};
        var TRKORR = (typeof oEvent.getParameter === "function") ? oEvent.getParameter("TRKORR") : oEvent.TRKORR;

        var sPath = parent.getServerPath() + '/save_active_appdata#active',
            oFormData = new FormData();

        var sReqNo = "";

        // 기존에 CTS 번호가 있을 경우
        if (oAPP.attr.appInfo.REQNO != "") {
            sReqNo = oAPP.attr.appInfo.REQNO;
        }

        if (TRKORR) {
            sReqNo = TRKORR;
        }

        if (sReqNo != "") {
            oFormData.append("TRKORR", sReqNo);
        }

        oFormData.append("IS_ACT", 'X');


        // 어플리케이션 저장 데이터
        let oSaveData = JSON.parse(JSON.stringify(oAPP.fn.getSaveData()));

        /**
         * @description
         * [FIX] 어플리케이션 데이터 중, 에디터 데이터 내 특수문자 (\n, \t 등) 저장 시 JSON 변환 과정에서 escape 처리 오류 발생.
         * 조회 시 줄바꿈이 의도치 않게 적용되어 코드가 깨져 보이는 문제가 있었음.
         * 
         * ex: 저장 시 => `var aaa = "\naaa\n";`
         *     조회 시 => 
         *     var aaa = "
         *     aaa
         *     "
         * 
         * 해결 방안:
         * 에디터 관련 데이터(CSS, HTML, JS, Error HTML 등)는 전체 JSON 포함 대신 개별 FormData 항목으로 전송.
         * 백엔드에서 별도 escape 처리 없이 저장 및 조회하도록 변경함.
         *
         * @date 2025-08-04
         * @version v3.5.6-10
         * @author soccerhs
         */
        // 어플리케이션 저장 데이터에서 FormData로 변환
        _convertSaveDataToFormData(oFormData, oSaveData);

        // oFormData.append("APPDATA", JSON.stringify(oAPP.fn.getSaveData()));
        oFormData.append("APPDATA", JSON.stringify(oSaveData));

        // Ajax 서버 호출
        sendAjax(sPath, oFormData, function (oResult) {

            // 현재 떠있는 브라우저
            var oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (typeof oResult == "string" || typeof oResult != "object") {

                try {

                    var oResult = JSON.parse(oResult);

                } catch (error) {

                    // 오류 사운드 실행
                    parent.setSoundMsg('02'); // sap sound(error)

                    // 작업표시줄 깜빡임
                    oCurrWin.flashFrame(true);

                    var sMsg = "[Activate Error]:" + error.toString();

                    // 메시지 처리.. 
                    parent.showMessage(null, 99, "E", sMsg);

                    console.error(error);

                    // busy 끄고 Lock 풀기
                    oAPP.common.fnSetBusyLock("");

                    // 자식 윈도우 활성화
                    oAPP.fn.fnChildWindowShow(true);

                    return;

                }

                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "312"); // A Critical error has occurred.

                // Footer Msg 출력
                APPCOMMON.fnShowFloatingFooterMsg("E", "WS20", sMsg);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                // 자식 윈도우 활성화
                oAPP.fn.fnChildWindowShow(true);

                return;

            }

            if (oResult.RETCD == "E") {

                // 오류 사운드 실행
                parent.setSoundMsg('02'); // sap sound(error)

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // 서버에서 만든 스크립트가 있다면 eval 처리.
                if (oResult.SCRIPT) {

                    // busy 끄고 Lock 풀기
                    oAPP.common.fnSetBusyLock("");

                    // 자식 윈도우 활성화
                    oAPP.fn.fnChildWindowShow(true);
                    
                    eval(oResult.SCRIPT);

                    return;
                }

                // Footer Msg 출력
                APPCOMMON.fnShowFloatingFooterMsg("E", "WS20", oResult.RTMSG);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                // 자식 윈도우 활성화
                oAPP.fn.fnChildWindowShow(true);

                return;

            }

            // 서버에서 만든 스크립트가 있다면 eval 처리.
            if (oResult.SCRIPT) {
                eval(oResult.SCRIPT);
            }

            // change Flag 초기화
            var oAppInfo = jQuery.extend(true, {}, parent.getAppInfo());
            oAppInfo.IS_CHAG = '';

            oAppInfo.ACTST = 'A';

            // var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "032"); // Activity success

            let oUserInfo = parent.process.USERINFO;
            let sLangu = oUserInfo.LANGU;

            // Activity success
            var sMsg = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "275");

            APPCOMMON.fnShowFloatingFooterMsg('S', sCurrPage, sMsg);

            parent.setAppInfo(oAppInfo);

            oAppInfo = jQuery.extend(true, {}, parent.getAppInfo());

            APPCOMMON.fnSetModelProperty("/WS20/APP", oAppInfo);

            // [HTML5] 앱헤더(Active/Inactive)·트랜잭션 버튼 상태 갱신
            try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

            // undo, redo 이력/버튼 초기화 (저장/활성화 후 이전 편집 히스토리 비움)
            //  ★ HTML5 편집 undo/redo 는 스냅샷 스택(fnWs20ClearHistory)이 본체다. 원본 design
            //    모듈 clearHistory 만 호출하면 스냅샷 스택이 안 비워져 "저장/활성화 후에도 Undo 가능"
            //    버그가 난다(data.js setUIAreaEditable 과 동일하게 스냅샷 clear 를 함께 호출).
            try {
                if (oAPP.fn.fnWs20ClearHistory) { oAPP.fn.fnWs20ClearHistory(); } // HTML5 스냅샷 undo/redo
                var _oUndoRedo = parent.require(oAPP.oDesign.pathInfo.undoRedo);
                _oUndoRedo.clearHistory();
                _oUndoRedo.setUndoRedoButtonEnable();
            } catch (e) { console.warn("[HTML5][WS20] undoRedo skip:", e && e.message); }

            oAPP.attr.oModel.refresh();

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 자식 윈도우 활성화
            oAPP.fn.fnChildWindowShow(true);

            // 마지막 포커스 위치가 있다면 해당 에디터에 포커스를 준다!!
            if (oAPP.attr.beforeActiveElement) {

                setTimeout(function(){

                    oAPP.attr.beforeActiveElement.focus();

                }, 0);            

            }

            // activate 이벤트 전파
            let oIpcHandler = new parent.CLIpcHandler();
                oIpcHandler.command("activate", { 
                    fromPage  : parent.getCurrPage(),       // Activate 수행한 화면
                    browserKey: parent.getBrowserKey()      // 현재 브라우저 고유 키
                });

        });

    }; // end of oAPP.events.ev_pressActivateBtn


    /************************************************************************
     * 어플리케이션 저장 데이터에서 FormData로 변환
     ************************************************************************/    
    function _convertSaveDataToFormData(oFormData, oSaveData){

        if(!oFormData || !oSaveData){
            return;
        }        

        // whiteList 포함 여부        
        let bIsWhiteList = oAPP.common.checkWLOList("C", "UHAK901209");

        /**
         * formdata 변환 대상
         */
        // ** T_EDIT -> /U4A/Y0050
            
        // 	OBJID -> formdata (name)
        // 	OBJTY
        // 	DATA  -> formdata (value)

        let aT_EDIT = oSaveData?.T_EDIT || [];
        if(aT_EDIT && Array.isArray(aT_EDIT) === true && aT_EDIT.length !== 0){

            for(const oEdit of aT_EDIT){

                let sOBJID = oEdit?.OBJID || "";
                let sDATA  = oEdit?.DATA  || "";

                if(!sOBJID || !sDATA){
                    continue;
                }                

                oFormData.append(sOBJID, sDATA);

                // 화이트리스트에 포함될 경우에만 에디터 데이터를 지운다. (서버 전송 데이터 용량 축소 목적)
                if(bIsWhiteList === true){
                    oEdit.DATA = "";
                }
                

            }

        }

        // ** S_ERHTML -> /U4A/S0056

        // 	formdata (name) -> ERHTML ?

        // 	IS_USE	
        // 	HTML -> formdata (value)

        let oErrHtml = oSaveData?.S_ERHTML || undefined;
        if(oErrHtml){

            let sErrHtml = oErrHtml?.HTML || "";
            if(sErrHtml){
                
                oFormData.append("ERHTML", sErrHtml);

                // 화이트리스트에 포함될 경우에만 에디터 데이터를 지운다. (서버 전송 데이터 용량 축소 목적)
                if(bIsWhiteList === true){
                    oErrHtml.HTML = "";
                }

            }

        }

        // ** T_CEVT -> /U4A/Y0050

        // 	OBJID -> formdata (name)
        // 	OBJTY
        // 	DATA  -> formdata (value)

        let aT_CEVT = oSaveData?.T_CEVT || [];
        if(aT_CEVT && Array.isArray(aT_CEVT) === true && aT_CEVT.length !== 0){
            
            for(const oCEVT of aT_CEVT){

                let sOBJID = oCEVT?.OBJID || "";
                let sDATA  = oCEVT?.DATA  || "";

                if(!sOBJID || !sDATA){
                    continue;
                }

                oFormData.append(sOBJID, sDATA);

                // 화이트리스트에 포함될 경우에만 에디터 데이터를 지운다. (서버 전송 데이터 용량 축소 목적)
                if(bIsWhiteList === true){
                    oCEVT.DATA = "";
                }

            }

        }

    } // end of _convertSaveDataToFormData

    /************************************************************************
     * Save Button Event
     ************************************************************************/
    oAPP.events.ev_pressSaveBtn = function (oEvent) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // 자식 윈도우 숨기기
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }

        // 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnHideFloatingFooterMsg();

        // [HTML5] oEvent 옵셔널(버튼/단축키는 미전달). 구 sap.ui.base.Event 기반
        //   oNewEvent 는 이후 미사용(사장 코드)이라 제거.
        oEvent = oEvent || {};
        function _ev(sKey) { return (typeof oEvent.getParameter === "function") ? oEvent.getParameter(sKey) : oEvent[sKey]; }

        var sPath = parent.getServerPath() + '/save_active_appdata#save',
            oFormData = new FormData();

        var ISBACK = _ev("ISBACK"), // 저장후 뒤로 갈 경우 (20 -> 10)
            ISDISP = _ev("ISDISP"), // 저장후 Display 모드로 전환일 경우
            TRKORR = _ev("TRKORR");

        try {

        var sReqNo = "";

        // 기존에 CTS 번호가 있을 경우
        if (oAPP.attr.appInfo && oAPP.attr.appInfo.REQNO != "") {
            sReqNo = oAPP.attr.appInfo.REQNO;
        }

        // CTS 팝업에서 선택한 CTS 번호가 있을 경우.
        if (TRKORR) {
            sReqNo = TRKORR;
        }

        if (sReqNo != "") {
            oFormData.append("TRKORR", sReqNo);
        }

        // 어플리케이션 저장 데이터
        let oSaveData = JSON.parse(JSON.stringify(oAPP.fn.getSaveData()));

        /**
         * @description
         * [FIX] 어플리케이션 데이터 중, 에디터 데이터 내 특수문자 (\n, \t 등) 저장 시 JSON 변환 과정에서 escape 처리 오류 발생.
         * 조회 시 줄바꿈이 의도치 않게 적용되어 코드가 깨져 보이는 문제가 있었음.
         * 
         * ex: 저장 시 => `var aaa = "\naaa\n";`
         *     조회 시 => 
         *     var aaa = "
         *     aaa
         *     "
         * 
         * 해결 방안:
         * 에디터 관련 데이터(CSS, HTML, JS, Error HTML 등)는 전체 JSON 포함 대신 개별 FormData 항목으로 전송.
         * 백엔드에서 별도 escape 처리 없이 저장 및 조회하도록 변경함.
         *
         * @date 2025-08-04
         * @version v3.5.6-10
         * @author soccerhs
         */

        // 어플리케이션 저장 데이터에서 FormData로 변환
        _convertSaveDataToFormData(oFormData, oSaveData);

        // oFormData.append("APPDATA", JSON.stringify(oAPP.fn.getSaveData()));
        oFormData.append("APPDATA", JSON.stringify(oSaveData));

        // Ajax 서버 호출
        sendAjax(sPath, oFormData, lf_getAppInfo);

        } catch (oSaveErr) {
            // [HTML5] 저장 데이터 구성/전송 중 동기 오류 → 조용한 실패 대신 사용자에게 표시.
            oAPP.common.fnSetBusyLock("");
            try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
            try { parent.showMessage(null, 20, "E", "[Save] " + (oSaveErr && oSaveErr.message ? oSaveErr.message : String(oSaveErr))); } catch (e) { }
            console.error("[HTML5][WS20] ev_pressSaveBtn error:", oSaveErr);
        }

        // 서버 호출 callback
        function lf_getAppInfo(oResult) {

            // 현재 떠있는 브라우저
            var oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            // 푸터 메시지가 있을 경우 닫기
            APPCOMMON.fnHideFloatingFooterMsg();

            // Multi Footer 메시지 영역이 있으면 삭제.
            APPCOMMON.fnMultiFooterMsgClose();

            // 오류 일때는 Script만 실행하고 빠져나간다.
            if (oResult.RETCD == "E") {

                // 오류 사운드
                parent.setSoundMsg('02'); // sap sound(error)

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // 서버에서 만든 스크립트가 있다면 eval 처리.
                if (oResult.SCRIPT) {                    

                    // busy 끄고 Lock 풀기
                    oAPP.common.fnSetBusyLock("");

                    // 자식 윈도우 활성화
                    oAPP.fn.fnChildWindowShow(true);

                    eval(oResult.SCRIPT);                    

                    return;
                }

                // Footer Msg 출력
                APPCOMMON.fnShowFloatingFooterMsg("E", "WS20", oResult.RTMSG);

                // busy 끄고 Lock 풀기
                oAPP.common.fnSetBusyLock("");

                // 자식 윈도우 활성화
                oAPP.fn.fnChildWindowShow(true);

                return;

            }

            // 서버에서 만든 스크립트가 있다면 eval 처리.
            if (oResult.SCRIPT) {
                eval(oResult.SCRIPT);
            }

            // 저장후 10번 페이지로 이동이면..
            if (ISBACK == 'X') {

                try {
                    oAPP.fn.fnMoveToWs10();
                } catch (eMove) {
                    oAPP.common.fnSetBusyLock("");
                    try { parent.showMessage(null, 20, "E", "[Back] " + (eMove && eMove.message ? eMove.message : String(eMove))); } catch (e) { }
                    console.error("[HTML5][WS20] fnMoveToWs10 error:", eMove);
                }

                return;
            }

            // WS20 페이지 Lock 풀고 Display Mode로 전환
            if (ISDISP == 'X') {

                oAPP.fn.fnSetAppDisplayMode();

                // // busy 끄고 Lock 풀기
                // oAPP.common.fnSetBusyLock("");

                return;
            }

            // change Flag 초기화
            var oAppInfo = jQuery.extend(true, {}, parent.getAppInfo());
            oAppInfo.IS_CHAG = '';

            var sMsg = "";
            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "002"); // Saved success

            APPCOMMON.fnShowFloatingFooterMsg('S', sCurrPage, sMsg);

            /**
             * APP 정보 갱신
             */
            parent.setAppInfo(oAppInfo);

            oAppInfo = jQuery.extend(true, {}, parent.getAppInfo());

            APPCOMMON.fnSetModelProperty("/WS20/APP", oAppInfo);

            // [HTML5] 앱헤더(Active/Inactive)·트랜잭션 버튼 상태 갱신 (IS_CHAG="" → 저장 반영)
            try { if (oAPP.fn.fnUpdateWs20AppHeader) { oAPP.fn.fnUpdateWs20AppHeader(); } } catch (e) { }

            // undo, redo 이력/버튼 초기화 (저장/활성화 후 이전 편집 히스토리 비움)
            //  ★ HTML5 편집 undo/redo 는 스냅샷 스택(fnWs20ClearHistory)이 본체다. 원본 design
            //    모듈 clearHistory 만 호출하면 스냅샷 스택이 안 비워져 "저장/활성화 후에도 Undo 가능"
            //    버그가 난다(data.js setUIAreaEditable 과 동일하게 스냅샷 clear 를 함께 호출).
            try {
                if (oAPP.fn.fnWs20ClearHistory) { oAPP.fn.fnWs20ClearHistory(); } // HTML5 스냅샷 undo/redo
                var _oUndoRedo = parent.require(oAPP.oDesign.pathInfo.undoRedo);
                _oUndoRedo.clearHistory();
                _oUndoRedo.setUndoRedoButtonEnable();
            } catch (e) { console.warn("[HTML5][WS20] undoRedo skip:", e && e.message); }

            oAPP.attr.oModel.refresh();

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // 자식 윈도우 활성화
            oAPP.fn.fnChildWindowShow(true);            

            // 마지막 포커스 위치가 있다면 해당 에디터에 포커스를 준다!!
            if (oAPP.attr.beforeActiveElement) {

                setTimeout(function(){

                    oAPP.attr.beforeActiveElement.focus();

                }, 0);            

            }

        } // end of lf_getAppInfo      

    }; // end of oAPP.events.ev_pressSaveBtn

    /************************************************************************
     * MIME Button Event
     ************************************************************************/
    oAPP.events.ev_pressMimeBtn = function () {

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {
            return;
        }

        // ★ 별도 모달 BrowserWindow 판(현재 활성). 인앱 다이얼로그로 롤백하려면 fnMimeDialogOpener 로.
        oAPP.fn.fnMimeWindowOpener();

    }; // end of oAPP.events.ev_pressMimeBtn

    /************************************************************************
     * Controller Button Event
     ************************************************************************/
    oAPP.events.ev_pressControllerBtn = function () {

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {
            return;
        }

        APPCOMMON.execControllerClass();

    }; // end of oAPP.events.ev_pressControllerBtn

    /************************************************************************
     * Application Execution Button Event
     ************************************************************************/
    oAPP.events.ev_pressAppExecBtn = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage(),
            sACTST = oAppInfo.ACTST,
            sMsg = "";

        // Inactivate 상태일 경우 실행하지 않는다
        if (sACTST === 'I') {

            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "031"); // Only in activity state !!! 

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        oAPP.fn.fnOnExecApp(oAppInfo.APPID);

    }; // end of oAPP.events.ev_pressAppExecBtn

    /************************************************************************
     * Application Execution - 특정 브라우저로 실행
     * ----------------------------------------------------------------------
     * Split 버튼(Application Executor)의 드롭다운 메뉴 항목에서 호출.
     * 원본: ws_fn_01.js WS20 oAppExecMenuBtn > MENU1 > MENUITEM1.press 로직 이식.
     * @param {string} sBrowserName "CHROME" | "MSEDGE" | "DEV_BROWSER"
     ************************************************************************/
    oAPP.events.ev_pressAppExecBtnByBrowser = async function (sBrowserName) {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage(),
            sACTST = oAppInfo.ACTST;

        // Inactivate 상태일 경우 실행하지 않는다
        if (sACTST === 'I') {

            let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "031"); // Only in activity state !!!

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // 선택한 브라우저 정보 조회 (/DEFBR 모델)
        var aDefBrows = APPCOMMON.fnGetModelProperty("/DEFBR") || [],
            oBrows = aDefBrows.find(function (o) { return o.NAME === sBrowserName; });

        if (!oBrows) {

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // 어플리케이션 실행 URL 구하기
        let sURL = oAPP.fn.fnGetAppUrl();

        let oOptions = {
            BROWSER_TYPE: oBrows.NAME,
            INSPATH: oBrows.INSPATH,
            APP_MODE: false,
            URL: sURL
        };

        let oResult = await oAPP.fn.fnOpenAppInBrowser(oOptions);
        if (oResult.RETCD === "E") {

            switch (oResult.STCOD) {
                case "E999":    // 필수 파라미터 오류!! 이건 로직이 샌것임!!

                    break;

                case "E001":

                    // 설치된 브라우저 정보를 찾을 수 없습니다.
                    let sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "333");

                    // 페이지 푸터 메시지
                    APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

                    break;

                default:
                    break;
            }

            // busy 끄고 Lock 해제
            oAPP.common.fnSetBusyLock("");

            return;
        }

        // busy 끄고 Lock 해제
        oAPP.common.fnSetBusyLock("");

    }; // end of oAPP.events.ev_pressAppExecBtnByBrowser

    /************************************************************************
     * Multi Preview Button Event
     ************************************************************************/
    oAPP.events.ev_pressMultiPrevBtn = function (oEvent) {

        var oAppInfo = parent.getAppInfo(),
            sCurrPage = parent.getCurrPage(),
            sACTST = oAppInfo.ACTST,
            sMsg = "";

        // Inactivate 상태일 경우 실행하지 않는다
        if (sACTST == 'I') {

            sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "031"); // Only in activity state !!!

            // 페이지 푸터 메시지
            APPCOMMON.fnShowFloatingFooterMsg("W", sCurrPage, sMsg);

            return;
        }

        oAPP.fn.fnOnExecApp(oAppInfo.APPID, true);

    }; // end of oAPP.events.ev_pressMultiPrevBtn

    /************************************************************************
     * IconList Button Event
     ************************************************************************/
    oAPP.events.ev_pressIconListBtn = function (oEvent) {

        // /**
        //  * White List Object에 해당 CTS 번호가 있을경우 새로운 Icon List를 실행
        //  */
        // let bIsNewPopup = oAPP.common.checkWLOList("C", "UHAK900630");
        // if (bIsNewPopup) {
        //     oAPP.fn.fnIconPreviewPopupOpener();
        //     return;
        // }

        oAPP.fn.fnIconListPopupOpener();

    }; // end of oAPP.events.ev_pressIconListBtn

    /************************************************************************
     * Icon Collection Button Event
     ************************************************************************/
    oAPP.events.ev_PressIconCollectBtn = function (oEvent) {

        let oSelectedMenuItem = oEvent.getParameter("item"),
            sSelectedKey = oSelectedMenuItem.getProperty("key");

        switch (sSelectedKey) {
            case "M1": // Icon Preview popup

                oAPP.fn.fnIconPreviewPopupOpener();

                return;

            case "M2": // Illustrated Message Preview Popup

                oAPP.fn.fnIllustedMsgPrevPopupOpener();

                return;

        }

    }; // end of oAPP.events.ev_PressIconCollectBtn

    /************************************************************************
     * Add Server Event Button Event
     ************************************************************************/
    oAPP.events.ev_pressAddEventBtn = function (oEvent) {

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {
            return;
        }

        if (!oAPP.fn.createEventPopup) {
            oAPP.fn.getScript("design/js/createEventPopup", function () {
                oAPP.fn.createEventPopup();
            });

            return;
        }

        oAPP.fn.createEventPopup();

    }; // end of oAPP.events.ev_pressAddEventBtn

    /**********************************************************************\**
     * Runtime Class Navigator Button
     ************************************************************************/
    oAPP.events.ev_pressRuntimeBtn = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        oAPP.fn.fnRuntimeClassNaviPopupOpener();

    }; // end of oAPP.events.ev_pressRuntimeBtn    

    /************************************************************************
     * 세션 끊기..
     ************************************************************************/
    oAPP.events.ev_LogoutTest = function () {

        var sPath = parent.getServerPath() + '/logoff';

        sendAjax(sPath, null, lf_success);

        function lf_success() {
            sap.m.MessageToast.show("세션 끊켰다.");
            parent.setBusy('');
        }

    }; // end of oAPP.events.ev_LogoutTest

})(window, $, oAPP);