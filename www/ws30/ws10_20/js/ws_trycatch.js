module.exports = function (window, document, console) {
    
    /************************************************************************
     * onError 관련 공통 로직
     ************************************************************************/
    var REMOTE = require('@electron/remote'),
        PATH = REMOTE.require('path'),
        DIALOG = REMOTE.require('electron').dialog,
        CURRWIN = REMOTE.getCurrentWindow(),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        WSLOG = require(PATH.join(APPPATH, "ws30", "ws10_20", "js", "ws_log.js"));

    // [R&D 전용 console.log]
    var zconsole = {};
    zconsole.APP = APP;

    // if (APP.isPackaged) {
        // 오류 로그 감지
        WSLOG.start(REMOTE, console);
    // }

    // 무한 루프 오류 방지 flag
    // ※ 2026-09-08 이후 이 flag 는 "오류창을 여러 번 띄우지 않기" 용도로만 쓴다.
    //    로그 남기기와 전송은 이 flag 와 무관하게 계속된다(아래 _reportError 참고).
    var bIsError = false;

    /************************************************************************
     * 오류 한 건 보고 (2026-09-08 추가 — 장군님 지시)
     * ---------------------------------------------------------------------
     * 왜 넣었나:
     *   ① 기존에는 첫 오류 1건만 처리하고 그 뒤는 전부 무시했다.
     *      → 두 번째 오류부터는 로그도 안 남고 전송도 안 됐다.
     *   ② 오류를 잡은 그 자리에서 바로 텔레그램으로 보내야 한다.
     *
     * 무엇을 바꾸지 않았나:
     *   오류창을 띄우고 로그 폴더를 열고 앱을 끝내는 원래 동작은 그대로다.
     *   앱 종료를 기다리게 하지 않는다(전송이 잘리면 다음 실행 때 보낸다).
     ************************************************************************/
    function _reportError(sKind, sMessage, sStack) {

        // 1) 로그는 언제나 남긴다 (첫 1건 제한과 무관)
        try {
            console.error(sMessage);
        } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

        // 2) 전송은 앱 본체에 맡긴다. 설정에 토큰이 없으면 앱 본체가 알아서 넘어간다.
        try {

            var IPC = require('electron').ipcRenderer;

            var sScreenName = '';

            try {
                sScreenName = (document && document.title) ? document.title : '';
            } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

            // 오류가 난 그 순간 화면이 어떤 상태였는지 (2026-09-08 추가)
            // 로딩 표시가 켜진 채였는지 / 위에 덮는 창이 떠 있었는지를 알아야
            // 연타나 겹침 때문에 난 오류를 가려낼 수 있다.
            var sScreenState = '';

            // 어느 조작 때문에 난 오류인지 잇기 위한 추적 번호·창 이름 (2026-09-08 추가)
            var sTrace = '';
            var sWindowName = '';

            try {
                if (window.U4ALOG) {
                    if (typeof window.U4ALOG.screenState === 'function') { sScreenState = window.U4ALOG.screenState(); }
                    if (typeof window.U4ALOG.getTrace === 'function') { sTrace = window.U4ALOG.getTrace(); }
                    if (typeof window.U4ALOG.getWindow === 'function') { sWindowName = window.U4ALOG.getWindow(); }
                    if (typeof window.U4ALOG.getScreen === 'function') {
                        var sS = window.U4ALOG.getScreen();
                        if (sS) { sScreenName = sS; }
                    }
                }
            } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

            IPC.send('u4a-log:send-error', {
                kind: sKind,
                errorCode: 'WSERR',
                message: sMessage,
                stack: sStack || '',
                screenName: sScreenName,
                windowName: sWindowName,
                traceId: sTrace,
                screenState: sScreenState
            });

        } catch (e) {
            // 전송 통로가 없어도 앱은 계속 간다. 로그는 이미 위에서 남겼다.
            console.error('[WSERR-901] error report request failed', e);
        }

    }

    /************************************************************************
     * critical 오류 팝업
     ************************************************************************/
    function showCriticalErrorDialog(sErrorMsg) {

        // 무한루프 오류 방지 Flag
        // 오류가 한번이라도 발생되었다면 그 다음 오류는 무시
        if (bIsError == true) {
            return;
        }

        bIsError = true;

        // //[임시 -- start] 오류 발생시 디버깅 창을 오픈한다.
        // let oWebContents = CURRWIN.webContents;
        // oWebContents.openDevTools();
        // //[임시 -- end]

        let sTitle = "[Critical Error]: ";
        sTitle += "Please contact the solution team.";

        DIALOG.showMessageBox(CURRWIN, {
            title: sTitle,
            message: sErrorMsg,
            type: "error"
        }).then(() => {
  
            bIsError = false;

            /**
             * @since   2026-01-29 14:44:39
             * @version v3.5.8-0
             * @author  soccerhs
             * @description
             * 
             * 크리티컬 오류 발생 시, 
             * 메시지 닫을 때 로그 폴더 오픈 기능 추가
             */
            WSLOG.openLOG(true);
            
            APP.exit();

        });

    } // end of showCriticalErrorDialog

    // window onError 오류
    function onError(message, url, line, col, errorObj) {

        let sErrMsg = `[onError]: ${message}\n${url}, ${line}:${col}`;

        /**
         * 2026-09-08 변경 — 로그·전송은 첫 1건 제한 없이 항상 한다.
         * (기존에는 여기서 bIsError 로 막아 두 번째 오류부터는 아무것도 안 남았다.)
         */
        _reportError('error', sErrMsg, (errorObj && errorObj.stack) ? errorObj.stack : '');

        if (bIsError == true) {
            return;   // 오류창만 두 번 띄우지 않는다
        }

        console.trace(`[onError]: `);

        // critical 오류이므로 창을 닫는다.
        showCriticalErrorDialog(sErrMsg);

    }

    // 비동기 오류
    function onunhandledrejection(event) {

        let sErrorMsg = "";
        if (event.reason) {
            sErrorMsg = "[onunhandledrejection]: " + event?.reason?.stack?.toString();
        }

        if (sErrorMsg == "") {
            sErrorMsg = "critical Error!";
        }

        /**
         * 2026-09-08 변경 — 로그·전송은 첫 1건 제한 없이 항상 한다.
         */
        _reportError('error', sErrorMsg, (event && event.reason && event.reason.stack) ? event.reason.stack : '');

        if (bIsError == true) {
            return;   // 오류창만 두 번 띄우지 않는다
        }

        console.trace(`[onunhandledrejection]: `);

        // critical 오류이므로 창을 닫는다.
        showCriticalErrorDialog(sErrorMsg);

    }

    /************************************************************************
     * local console [R&D 전용 console.log]
     ************************************************************************/
    zconsole.log = function(sConsole) {

        const
            APP = zconsole.APP;

        // 빌드 상태에서는 실행하지 않음.
        if (APP.isPackaged) {
            return;
        }

        // console.log("[zconsole]: " + sConsole);
        console.log("[zconsole]: ", arguments);

    };

    zconsole.error = function(sConsole) {

        const
            APP = zconsole.APP;

        // 빌드 상태에서는 실행하지 않음.
        if (APP.isPackaged) {
            return;
        }

        console.error("[zconsole]: ", arguments);

    };

    zconsole.warn = function(sConsole){

        const
            APP = zconsole.APP;

        // 빌드 상태에서는 실행하지 않음.
        if (APP.isPackaged) {
            return;
        }

        console.warn("[zconsole]: ", arguments);

    };

    window.removeEventListener("unhandledrejection", onunhandledrejection);
    window.addEventListener("unhandledrejection", onunhandledrejection);

    window.onerror = onError;

    return zconsole;

};