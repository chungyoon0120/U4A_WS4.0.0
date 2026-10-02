/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : fnServerSession.js
 * - file Desc : 서버 세션 유지
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    /************************************************************************
     * 서버 세션 유지를 위한 워커 실행
     ************************************************************************/
    oAPP.fn.fnServerSession = function (bIsForceRun) {     
        
        var sServerPath = parent.getServerPath() + "/dummycall";

        var oSendParam = {
            SERVPATH: sServerPath,
            USERINFO : parent.getUserInfo()
        };

        // 설정된 세션 timeout 시간 도래 여부를 체크하기 위한 워커 생성
        oAPP.attr._oServerWorker = new Worker("./js/workers/u4aWsServerSessionWorker.js");

        // Session Time Worker onmessage 이벤트        
        oAPP.attr._oServerWorker.onmessage = oAPP.fn.fnServerSessionTimeOut;

        // 워커에 값 전달
        oAPP.attr._oServerWorker.postMessage(oSendParam);

    }; // end of oAPP.fn.oAPP.fn.fnServerSession

    oAPP.fn.fnServerSessionTimeOut = (oRes) => {

        let oData = oRes.data;

        console.error(oData.RTMSG);

        // 로그 (2026-10-01 — 장군님 지시 「로그만 고친다」 · 재현 시험): 세션 유지 호출(/dummycall · 로그인 때 한 번 + 10분마다)이
        // 왜 실패했는지 남긴다. 위의 한 줄(RTMSG)만으로는 HTTP 상태를 알 수 없어 원인도 재현 조건도 짚을 수 없었다. 동작은 그대로다.
        try {
            var _oSessLog = (typeof U4ALOG !== "undefined" && U4ALOG) || (parent && parent.U4ALOG);
            if (_oSessLog && _oSessLog.warn) {
                _oSessLog.warn("SERVER_SESSION", "keep-alive /dummycall failed (sent at login and every 10 min)",
                    "RETCD=" + oData.RETCD + ", HTTP status=" + oData.HTTP_STATUS + " " + (oData.HTTP_STATUS_TEXT || "") + ", RTMSG=" + oData.RTMSG);
            }
        } catch (e) { /* 로그 때문에 흐름이 바뀌면 안 된다 */ }

        // 세션 유지 실패 시, 나를 제외한 나머지는 다 죽인다
        parent.IPCRENDERER.send('if-browser-close', {
            ACTCD: "A", // 나를 제외한 나머지는 다 죽인다.
            SESSKEY: parent.getSessionKey(),
            BROWSKEY: parent.getBrowserKey()
        });

        // 세션 타임 아웃 팝업을 띄운다.
        let sTitle = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "147"), // The session has terminated.
            sDesc = oData.RTMSG,
            sIllustType = "tnt-SessionExpired",
            sIllustSize = "Dialog"; // [HTML5] sap 제거 — 구 enum 값=문자열

        oAPP.fn.fnShowIllustMsgDialog(sTitle, sDesc, sIllustType, sIllustSize, lfSessionTimeOutDialogOk);

        function lfSessionTimeOutDialogOk(){

            fn_logoff_success("");
            
        }

        // 세션 타임아웃 시, 워커를 죽인다.
        if (oAPP.attr._oServerWorker && oAPP.attr._oServerWorker) {
            oAPP.attr._oServerWorker.terminate();
            delete oAPP.attr._oServerWorker;
        }

    };

})(window, $, oAPP);