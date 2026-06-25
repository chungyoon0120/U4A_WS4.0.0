/**
 * index.js  (cleaned)
 *
 * 기존 분리 파일을 로드 순서대로 병합 후 정리한 통합 파일.
 *   1) Frame01.js  (전역 객체 oWS / oAPP 및 oWS.utill.fn.* 정의)
 *   2) wsIF01.js   (oWS.utill.fn.* 을 호출하는 전역 래퍼 함수 정의)
 *
 * 정리 내역:
 *   - 사용하지 않는 주석 처리된 옛 코드 블록 제거 (setBusy/setBusyDialog 구버전 등)
 *   - setProcessEnvUserInfo 의 const 선언부 콤마 누락 수정
 *   - 줄 끝 공백 제거, 연속 빈 줄 축소
 *   - 실제 동작 로직 및 설명용 주석은 원본 그대로 유지
 */

/**
 *  ## oWS WS
 */

var // <-- 여기는 반드시 var로 선언해야함. (let, const는 자식에서 parent로 접근이 안됨.)
    oWS = window.oWS || {},
    oAPP = window.oAPP || {};
oAPP.common = window?.oAPP?.common || {};
oAPP.msg = window?.oAPP?.msg || {};
oAPP.attr = window?.oAPP?.attr || {};
oAPP.views = window?.oAPP?.views || {};

(function (oWS) {
    "use strict";

    const REMOTE = require('@electron/remote');
    const APP = REMOTE.app;
    const PATH = require("path");
    const APPPATH = APP.getAppPath();

    oWS.utill = {};
    oWS.utill.fn = {};
    oWS.utill.attr = {};
    oWS.utill.attr.paths = {}; // 각종 패스 모음
    oWS.utill.attr.METADATA = {}; // 메타 데이터

    // AI와 인터페이스 관련 맵 정보
    oWS.utill.attr.AI_IF_MAP = new Map();

    // Busy Indicator 상태
    oWS.utill.attr.isBusy = "";

    oWS.utill.attr.paths = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));

    // Default Browser 기준정보 (Login.js 에서 관련 기준 정보 선행체크함.)
    oWS.utill.attr.aDefaultBrowsInfo = [];

    // Theme 정보
    oWS.utill.attr.oThemeInfo = {};

    // Browser Session Key 정보
    oWS.utill.attr.sessionkey = "";

    // Browser Key 정보
    oWS.utill.attr.browserkey = "";

    // 에디터 정보
    oWS.utill.attr.oWsConfInfo = {
        BUSYTYPE: '01',
    };

    // 현재 페이지 정보
    oWS.utill.attr.currPage = "";

    // Busy를 실행하는 DOM 객체 정보
    oWS.utill.attr.oBusyDom = undefined;

    // Busy 타입별 Busy Dom 객체정보를 글로벌에 저장
    let oDefBusyDom = document.getElementById("u4aWsBusyIndicator");
    switch (oWS.utill.attr.oWsConfInfo.BUSYTYPE) {

        case "01":
            oWS.utill.attr.oBusyDom = oDefBusyDom;
            break;

        default:
            oWS.utill.attr.oBusyDom = oDefBusyDom;
            break;

    }

    /**********************************************************
     * 📝 Local Functions
     **********************************************************/

    /**********************************************************
     * ## 접속 언어별 웰컴 사운드 경로를 반환 한다.
     **********************************************************/
    function _getWelComeSoundPath() {

        let oUserInfo = parent.process.USERINFO;
        if (!oUserInfo) {
            return;
        }

        let sLangu = oUserInfo.LANGU;

        // 사운드 ROOT 경로
        // let sSoundRootPath = PATH.join(__dirname, '../sound/welcome/');
        let sSoundRootPath = PATH.join(APPPATH, "sound", "welcome");
        let sSoundFileName = "WELCOME";

        let sSoundPath = PATH.join(sSoundRootPath, sLangu, sSoundFileName + ".wav");

        // 로그인 언어에 해당하는 사운드가 없다면 기본 EN 사운드로 출력한다.
        if (FS.existsSync(sSoundPath) === false) {
            return PATH.join(sSoundRootPath, "EN", sSoundFileName + ".wav");
        }

        return sSoundPath;

    } // end of _getWelComeSoundPath

    /**********************************************************
     * ## Function
     **********************************************************/

    /**
     * 1. 메시지 호출
     *
     * # oUI5
     * - (instance) sap
     *
     * # KIND
     * - 10: MessageToast
     * - 20: MessageBox (1 button: OK)
     * - 30: MessageBox (2 button: YES, NO)
     * - 40: MessageBox (3 button: YES, NO, CANCLE)
     * - 99: Electron Message
     *
     * # TYPE
     * - S : success
     * - E : error
     * - W : warning
     * - I : information
     *
     * # MSG
     * - (string) Message
     */
    // ★ 모달 top-layer 순서 추적 — UI5 가 팝업 z-index 를 1씩 올려 쌓듯, native `<dialog>.showModal()` 은
    //   top-layer 라 z-index 무관하게 "showModal 호출 순서"가 위아래를 결정한다. showModal 을 1회 감싸
    //   호출마다 증가 seq(`data-tl-seq`)를 기록 → 토스트 등이 "가장 위 모달"을 정확히 찾는다(DOM 순서는 부정확).
    (function () {
        try {
            if (typeof HTMLDialogElement === "undefined" || HTMLDialogElement.prototype.__tlSeqWrapped) { return; }
            var _orig = HTMLDialogElement.prototype.showModal, _seq = 0;
            HTMLDialogElement.prototype.showModal = function () {
                try { this.dataset.tlSeq = String(++_seq); } catch (e) { }
                return _orig.apply(this, arguments);
            };
            HTMLDialogElement.prototype.__tlSeqWrapped = true;
        } catch (e) { }
    })();

    oWS.utill.fn.showMessage = function (oUI5, KIND, TYPE, MSG, fn_callback) {

        // 메시지가 Array 일 경우 개행 문자를 넣는다.
        var newMsg = "";

        // if (MSG instanceof Array) {
        if (Array.isArray(MSG)) {

            var iMsgcnt = MSG.length;

            for (var i = 0; i < iMsgcnt; i++) {

                var sMsg = MSG[i];

                if (i == iMsgcnt - 1) {
                    newMsg = sMsg;
                    break;
                }

                newMsg = sMsg + "\n";

            }

        } else {
            newMsg = MSG;
        }

        // [HTML5] 메시지 시스템 통일 — 토스트/팝업을 테마 공통 컴포넌트(.u4a-toast/.u4a-msgbox)로
        //   렌더한다. 구 oUI5.m.MessageToast/MessageBox 의존 제거(oUI5 인자 무시). KIND 99(네이티브)만 유지.
        //   기존 모든 parent.showMessage(sap, KIND, TYPE, MSG, cb) 호출부가 그대로 동작.
        function lf_sound(t) {
            try { if (t === "S") { setSoundMsg("01"); } else if (t === "W" || t === "E") { setSoundMsg("02"); } } catch (e) { }
        }
        // 토스트(구 MessageToast) — 싱글톤 .u4a-toast, 3초 자동 숨김
        function _u4aToast(sMsg) {
            try {
                var oT = document.getElementById("u4aWsToast");
                if (!oT) {
                    oT = document.createElement("div");
                    oT.id = "u4aWsToast";
                    oT.className = "u4a-toast";
                    oT.setAttribute("role", "alert");
                }
                // ★ showModal 모달은 top-layer 라 body 의 토스트(div)가 그 뒤에 가려진다(busy 와 동일 문제).
                //   Chromium93 은 popover API 없음 → 토스트를 "가장 위에 열린 모달 <dialog> 안"에 넣어 top-layer 에 올린다.
                //   가장 위 = data-tl-seq(showModal 호출 순서) 최대값(busy 제외). 모달 없으면 body 폴백 = 기존 동작.
                //   .u4a-toast 는 position:fixed + pointer-events:none 이라 어디 붙어도 뷰포트 중앙·클릭통과 유지.
                var oHost = document.body, aDlg = document.querySelectorAll("dialog[open]"), iTop = -1;
                for (var i = 0; i < aDlg.length; i++) {
                    if (aDlg[i].id === "u4aWsBusyIndicator") { continue; }
                    var iSeq = parseInt(aDlg[i].dataset.tlSeq || "0", 10);
                    if (iSeq >= iTop) { iTop = iSeq; oHost = aDlg[i]; }
                }
                if (oT.parentNode !== oHost) { oHost.appendChild(oT); }
                oT.textContent = sMsg || "";
                oT.dataset.show = "true";
                if (oT.__t) { clearTimeout(oT.__t); }
                oT.__t = setTimeout(function () { oT.dataset.show = "false"; }, 3000);
            } catch (e) { try { alert(sMsg); } catch (e2) { } }
        }
        // 메시지 팝업(구 MessageBox) — 테마 native <dialog class="u4a-msgbox">.
        //   aBtns: [{act,label,emphasized}] → 콜백에 UI5 Action 과 동일한 act("OK"/"YES"/"NO"/"CANCEL") 전달.
        function _u4aMsgBox(sType, sTitle, sMsg, aBtns, fnCb) {
            function lf_cb(sAct) { if (typeof fnCb === "function") { try { fnCb(sAct); } catch (e) { } } }
            var bCancel = aBtns.some(function (b) { return b.act === "CANCEL"; });
            var bNo = aBtns.some(function (b) { return b.act === "NO"; });
            var oDlg;
            try { oDlg = document.createElement("dialog"); } catch (e) { oDlg = null; }
            if (!oDlg || typeof oDlg.showModal !== "function") {
                if (aBtns.length <= 1) { try { alert(sMsg); } catch (e) { } lf_cb("OK"); return; }
                var bOk = false; try { bOk = confirm(sMsg); } catch (e) { }
                lf_cb(bOk ? "YES" : (bCancel ? "CANCEL" : "NO")); return;
            }
            // 서버리스트/셸/로그인 메시지박스와 동일한 .u4a-dialog(헤더 아이콘 + 본문 + 푸터) 디자인으로 통일.
            var oTypeIcon = { C: "circle-question", S: "circle-check", E: "circle-xmark", W: "triangle-exclamation", I: "circle-info" };
            oDlg.className = "u4a-dialog";
            oDlg.style.width = "min(28rem, 92vw)";
            oDlg.innerHTML =
                '<div class="u4a-dialog__header" data-type="' + (sType || "I") + '">' +
                    '<i class="fa-solid fa-' + (oTypeIcon[sType] || "circle-info") + '"></i><span></span>' +
                '</div>' +
                '<div class="u4a-dialog__body" style="white-space:pre-wrap;line-height:1.45;"></div>' +
                '<div class="u4a-dialog__footer"></div>';
            oDlg.querySelector(".u4a-dialog__header span").textContent = sTitle || "";
            oDlg.querySelector(".u4a-dialog__body").textContent = sMsg || "";
            function lf_close(sAct) { try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } lf_cb(sAct); }
            var oFooter = oDlg.querySelector(".u4a-dialog__footer");
            aBtns.forEach(function (b) {
                var oBtn = document.createElement("button");
                oBtn.type = "button";
                oBtn.className = "u4a-btn" + (b.emphasized ? " u4a-btn--emphasized" : "");
                oBtn.textContent = b.label || b.act;
                oBtn.addEventListener("click", function () { lf_close(b.act); });
                oFooter.appendChild(oBtn);
            });
            oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(bCancel ? "CANCEL" : (bNo ? "NO" : "OK")); });
            try { document.body.appendChild(oDlg); oDlg.showModal(); } catch (e) {
                if (aBtns.length <= 1) { try { alert(sMsg); } catch (e2) { } lf_close("OK"); }
                else { var ok = false; try { ok = confirm(sMsg); } catch (e2) { } lf_close(ok ? "YES" : (bCancel ? "CANCEL" : "NO")); }
            }
        }

        // 메시지 타입별 텍스트
        let oMsgcls = {
            S: "Success",
            E: "Error",
            I: "Information",
            W: "Warning",
            WORKSPACE: "U4A WorkSpace"
        };

        let APPCOMMON = oAPP.common;

        // 로그인 후 메시지 정보를 읽었을 경우 접속 언어에 맞게 텍스트 변경
        if (APPCOMMON && APPCOMMON.fnGetMsgClsText) {
            oMsgcls.S = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D86"); // Success
            oMsgcls.E = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B93"); // Error
            oMsgcls.I = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B86"); // Information
            oMsgcls.W = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B89"); // Warning
            oMsgcls.WORKSPACE = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D29"); // U4A WorkSpace
        }

        switch (KIND) {

            case 10: // 토스트 (구 MessageToast)

                _u4aToast(newMsg);

                break;

            case 20: // 1버튼 (OK) — 구 MessageBox 1버튼

                lf_sound(TYPE);
                _u4aMsgBox(TYPE, oMsgcls[TYPE] || oMsgcls.WORKSPACE, newMsg,
                    [{ act: "OK", label: "OK", emphasized: true }], fn_callback);

                break;

            case 30: // 2버튼 (YES/NO) — 구 MessageBox 2버튼

                lf_sound(TYPE);
                _u4aMsgBox(TYPE, oMsgcls[TYPE] || oMsgcls.WORKSPACE, newMsg,
                    [{ act: "YES", label: "Yes", emphasized: true }, { act: "NO", label: "No" }], fn_callback);

                break;

            case 40: // 3버튼 (YES/NO/CANCEL) — 구 MessageBox 3버튼

                lf_sound(TYPE);
                _u4aMsgBox(TYPE, oMsgcls[TYPE] || oMsgcls.WORKSPACE, newMsg,
                    [{ act: "YES", label: "Yes", emphasized: true }, { act: "NO", label: "No" }, { act: "CANCEL", label: "Cancel" }], fn_callback);

                break;

            case 99:

                var oCurrView = REMOTE.getCurrentWindow();

                let sTitle = oMsgcls.WORKSPACE; // U4A WorkSpace

                switch (TYPE) {
                    case "I":
                        DIALOG.showMessageBox(oCurrView, {
                            type: "info",
                            title: sTitle,
                            message: newMsg
                        });
                        break;

                    case "W":
                        DIALOG.showMessageBox(oCurrView, {
                            type: "warning",
                            title: sTitle,
                            message: newMsg
                        });
                        break;

                    case "E":

                        setSoundMsg("02"); // error

                        DIALOG.showMessageBox(oCurrView, {
                            type: "error",
                            title: sTitle,
                            message: newMsg
                        });

                        break;

                }

        }

        // [HTML5] 구 lf_loadLibrary(UI5 sap.m.MessageBox requireSync) 제거 — 더 이상 UI5 미사용.

    }; // end of oWS.utill.fn.showMessage

    // 2. 서버 정보를 구한다.
    oWS.utill.fn.getServerInfo = function () {

        if (!oWS.oServerInfo) {
            return;
        }

        return oWS.oServerInfo;

    };

    oWS.utill.fn.setServerInfo = (oServerInfo) => {

        oWS.oServerInfo = oServerInfo;

    };

    oWS.utill.fn.setBeforeServerInfo = (oServerInfo) => {

        oWS.oBeforeServerInfo = oServerInfo;

    };

    oWS.utill.fn.getBeforeServerInfo = () => {

        if (!oWS.oBeforeServerInfo) {
            return;
        }

        return oWS.oBeforeServerInfo;

    };

    // 3. 서버 URL을 구한다.
    oWS.utill.fn.getServerPath = function (bIsStateLess) {

        var sServerHost = getServerHost(),
            sServicePath = sServerHost + "/zu4a_wbc/u4a_ipcmain";

        if (bIsStateLess === true) {
            sServicePath = sServerHost + "/zu4a_wbc/u4a_dynpro";
        }

        return sServicePath;

    };

    // 4. 서버 호스트를 구한다.
    oWS.utill.fn.getServerHost = function () {

        let oWS_ServerInfo = oWS.oServerInfo;
        if (!oWS_ServerInfo) {
            return;
        }

        let oServerInfo = oWS_ServerInfo.SERVER_INFO,
            sProtocol = oServerInfo.protocol,
            sHost = oServerInfo.host,
            sPort = oServerInfo.port;

        let sServicePath = `${sProtocol}://${sHost}`;
        if (sPort != "") {
            sServicePath += `:${sPort}`;
        }

        return sServicePath;

    };

    // 4. Page 이동
    oWS.utill.fn.onMoveToPage = function (sMovePath) {

        // var oWs_frame = document.getElementById("ws_frame");
        // if (!oWs_frame) {
        //     return;
        // }

        // var sPath = getPath(sMovePath);
        // if (!sPath) {
        //     return;
        // }

        // if (sMovePath == "LOGIN") {
        //     delete oWS.utill.attr.ISINIT;
        // }

        // oWs_frame.src = sPath;

    };

    // 5. Electron Instance return.
    oWS.utill.fn.getElectronRemote = function () {
        return REMOTE;
    };

    // 6. NODE JS 'require' return.
    oWS.utill.fn.getRequire = function () {
        return require;
    };

    // 7. Application 정보 저장
    oWS.utill.fn.setAppInfo = function (oAppInfo) {

        if (oWS.utill.attr.oAppInfo) {
            delete oWS.utill.attr.oAppInfo;
        }

        if (!oAppInfo) {
            return;
        }

        // Object가 빈값이면 리턴 (초기화 일 경우).
        if (Object.keys(oAppInfo).length === 0 &&
            JSON.stringify(oAppInfo) === JSON.stringify({})) {
            return;
        }

        // 변경된 값이 있으면 Inactive 상태로 변환
        if (oAppInfo.IS_CHAG == 'X') {
            oAppInfo.ACTST = "I";
        }

        // Global AppInfo에 저장
        oWS.utill.attr.oAppInfo = oAppInfo;

        // 변경된 값이 있을 경우
        if (oAppInfo.IS_CHAG == 'X') {

            let oWS20APP = sap.ui.getCore().byId("WSAPP");

            // [HTML5] sap 안전스텁에서 byId→null. 원본 (!oWS20APP && oWS20APP.oToPage.sId…)는
            //   oWS20APP 가 null 이면 null.oToPage 역참조로 크래시(setAppChange 경로 = CSS/JS/HTML
            //   에디터 저장 등). 의도(WSAPP 없거나 WS20 페이지 아니면 /WS20/APP 모델 갱신 skip)대로
            //   || + null 가드로 교정 — UI5(WS20 페이지)에선 기존처럼 갱신, HTML5 에선 조용히 skip.
            if (!oWS20APP || !oWS20APP.oToPage || oWS20APP.oToPage.sId != "WS20") {
                return;
            }

            oAPP.common.fnSetModelProperty("/WS20/APP", oAppInfo);

        }

    };

    // 8. AppID 및 Create, Change, Display 모드 정보 구하기
    oWS.utill.fn.getAppInfo = function () {

        if (!oWS.utill.attr.oAppInfo) {
            return;
        }

        return oWS.utill.attr.oAppInfo;

    };

    // 10. Window Header Menu Setting
    oWS.utill.fn.setBrowserMenu = function (aTemplate) {

        var oCurrWin = REMOTE.getCurrentWindow(),
            MENU = REMOTE.Menu;

        if (aTemplate == null) {
            oCurrWin.setMenu(null);
            return;
        }

        var oMenu = MENU.buildFromTemplate(aTemplate);
        oCurrWin.setMenu(oMenu);

    };

    // 11. 현재 dirname 구하기
    oWS.utill.fn.getDirName = function () {
        return __dirname;
    };

    // 12. Page Path 구하기
    oWS.utill.fn.getPath = function (sPagePath) {

        var sPath = oWS.utill.attr.paths[sPagePath];
        if (!sPath) {
            return;
        }

        return sPath;

    };

    // 14. 서버에서 App 정보를 구한다.
    oWS.utill.fn.getAppDataFromServer = function (oFormData, fn_callback) {

        var sPath = getServerPath() + '/INIT_PRC';

        setBusy('X');

        sendAjax(sPath, oFormData, (oAppInfo) => {

            fn_callback(oAppInfo);

        });

    }; // end of oWS.utill.fn.getAppDataFromServer

    // 15. 새창 띄우기
    oWS.utill.fn.onNewWindow = function (IF_DATA) {

        // 새 창 생성은 무거운 로직(BrowserWindow 생성 + URL 로드)이라 진행 중 연속 클릭을 막는다.
        //   · 이미 Busy 면 재진입 차단(중복 창 생성 방지).
        //   · 진입 시 Busy ON(setBusy = pointerEvents 차단) → 로드 완료(did-finish-load)에 OFF.
        //   버튼/메뉴(fnWS10WMENU30_01)/USP/WS20 모두 이 함수로 모이므로 여기 한 곳이면 전부 커버.
        if (oWS.utill.fn.getBusy() === "X") {
            return;
        }
        oWS.utill.fn.setBusy("X");

        // Busy 안전 해제 — did-finish-load 가 끝내 안 오는 예외(생성 실패 등) 대비(창 안 떠도 busy 박힘 방지).
        let _busyReleased = false;
        const _releaseBusy = function () {
            if (_busyReleased) { return; }
            _busyReleased = true;
            oWS.utill.fn.setBusy("");
        };
        const _busySafetyTimer = setTimeout(_releaseBusy, 8000);

        const WINDOWSTATE = REMOTE.getGlobal("mainRequire")('electron-window-state');

        // 창 크기 기본값 설정
        let mainWindowState = WINDOWSTATE({
            defaultWidth: 1000,
            defaultHeight: 800
        });

        let SESSKEY = getSessionKey(),
            BROWSERKEY = getRandomKey(10);

        // 팝업 고유 이름
        let sPopupName = "MAIN";

        let oThemeInfo = getThemeInfo(), // 테마 정보
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));

        oBrowserOptions.title = "U4A Workspace - #Main";
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;

        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.autoHideMenuBar = true;

        // 브라우저 윈도우 기본 사이즈
        oBrowserOptions.x = mainWindowState.x;
        oBrowserOptions.y = mainWindowState.y;
        oBrowserOptions.width = mainWindowState.width;
        oBrowserOptions.height = mainWindowState.height;
        oBrowserOptions.minWidth = 1000;
        oBrowserOptions.minHeight = 800;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSERKEY;
        oBrowserOptions.webPreferences.USERINFO = process.USERINFO;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.SYSID = process.USERINFO.SYSID;

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        function lf_setBound() {

            let oBrowserOptions = {};

            var oParentBounds = CURRWIN.getBounds();
            oBrowserOptions.x = oParentBounds.x + 30;
            oBrowserOptions.y = oParentBounds.y + 30;
            oBrowserOptions.width = oParentBounds.width;
            oBrowserOptions.height = oParentBounds.height;

            oBrowserWindow.setBounds(oBrowserOptions);

            oBrowserWindow.setPosition(oBrowserOptions.x, oBrowserOptions.y);

        }

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        let oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            SYSID: process.USERINFO.SYSID,
            USERINFO: process.USERINFO,
            // [흰색 플래시 방지] 새 창은 top-level 이라 parent.getThemeInfo() 폴백이 안 먹는다.
            // index.html head 가 동기로 --boot-bg(BGCOL)+테마(THEME)를 깔도록 쿼리로 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
        };

        // URL에 QueryString 파라미터를 적용한다.
        let sLoadUrl = WSUTIL.QueryString.build(PATHINFO.MAINFRAME, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        if (!APP.isPackaged) {
            oBrowserWindow.webContents.openDevTools();
        }

        // 브라우저가 활성화 될 준비가 될때 타는 이벤트
        oBrowserWindow.once('ready-to-show', () => {

            lf_setBound();

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {

            // 새 창 로드 완료 = 무거운 작업 끝 → 부모 Busy 해제(연타 가드 종료).
            clearTimeout(_busySafetyTimer);
            _releaseBusy();

            var oSAPServerInfo = getServerInfo();

            var oMetadata = {};
            oMetadata.METADATA = parent.getMetadata();
            oMetadata.SERVERINFO = oSAPServerInfo;
            oMetadata.USERINFO = parent.getUserInfo();
            oMetadata.SESSIONKEY = SESSKEY;
            oMetadata.BROWSERKEY = BROWSERKEY;
            oMetadata.EXEPAGE = "WS10";
            oMetadata.DEFBR = parent.getDefaultBrowserInfo();
            oMetadata.THEMEINFO = parent.getThemeInfo();
            oMetadata.BeforeServerInfo = parent.getBeforeServerInfo();

            // 새창 띄운 후 추가 파라미터
            oMetadata.IF_DATA = IF_DATA;

            // 브라우저가 오픈되면서 부모가 가지고 있는 메타 관련 정보들을 전달한다.
            oBrowserWindow.webContents.send('if-meta-info', oMetadata);

            // 윈도우 오픈할때 opacity를 이용하여 자연스러운 동작 연출
            // WSUTIL.setBrowserOpacity(oBrowserWindow);

            // 부모 위치에서 우측 + 30, 하단 + 30 위치에 배치한다.
            lf_setBound();

            // 새창 띄울때 파라미터 중 20번페이지로 이동일 경우에는 브라우저 opacity를 0으로 한다.
            // 추후 새창 뜨고 나서 20번으로 넘어갈때 opacity를 줄 목적임
            if (IF_DATA && IF_DATA.ACTCD === "MOVE20") {

                oBrowserWindow.show();

                return;
            }

            // oBrowserWindow.setOpacity(1.0);

            // oBrowserWindow.show();

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            oBrowserWindow = null;

            // 로드 완료 전에 닫힌 예외 상황에서도 Busy 가 박히지 않게 해제.
            clearTimeout(_busySafetyTimer);
            _releaseBusy();

            // if (oWS.utill.attr.oBusyIndicator) {
            //     oWS.utill.attr.oBusyIndicator.close();
            //     delete oWS.utill.attr.oBusyIndicator;
            // }

        });

    };

    /**
     * 16. 새창 띄울때 현재 세션 추가하기
     * @param {*} TYPE
     *  - A : +
     *  - D : -
     */
    oWS.utill.fn.setSessionCount = function (TYPE) {
        return;

        var sFoldPath = PATH.join(__dirname, '../conf/'),
            sConfPath = PATH.join(__dirname, '../conf/conf.json');

        // Session 갯수 관련 conf.json 파일이 있으면 해당 필드에 세션 Count (자주 수행될 로직)
        if (FS.existsSync(sFoldPath) && FS.existsSync(sConfPath)) {

            var sSessionDataJSON = FS.readFileSync(sConfPath, 'utf-8'),
                oSessionData = JSON.parse(sSessionDataJSON);

            /**
             * TYPE
             * - A : +,
             * - D : -
             */
            if (TYPE == "A") {

                if (oSessionData.sessionCnt >= 6) {
                    return false;

                }

                ++oSessionData.sessionCnt;

            } else {
                --oSessionData.sessionCnt;
            }

            //showMessage(null, 99, "E", oSessionData.sessionCnt + "");

            FS.writeFileSync(sConfPath, JSON.stringify(oSessionData), {
                encoding: "utf8"
            });

            return true;

        }

        // conf 폴더가 없으면 폴더를 생성한다.
        if (!FS.existsSync(sFoldPath)) {
            FS.mkdirSync(sFoldPath);
        }

        // 세션 갯수 초기값
        var oConf = {
            sessionCnt: 1,
        },

            oConfJson = JSON.stringify(oConf);

        // conf 폴더가 있는데 JSON 파일이 없으면 세션 갯수 정보를 생성하여 JSON 파일로 저장한다.
        if (!FS.existsSync(sConfPath)) {

            /* 파일 디렉토리에 파일 생성 */
            FS.writeFileSync(sConfPath, oConfJson, {
                encoding: "utf8"
            });
            return true;

        }

    };

    // 18. error message 가져오기
    oWS.utill.fn.getErrorMsg = () => {

        if (!oWS.utill.attr.sErrorMsg) {
            return;
        }

        var sErrorMsg = oWS.utill.attr.sErrorMsg;

        delete oWS.utill.attr.sErrorMsg;

        return sErrorMsg;

    };

    // 메인 브라우저 닫기 버튼 활성/비활성
    oWS.utill.fn.setMainCloseBtnDisabled = function (sIsEnabled) {
        // oWS.utill.fn.setMainCloseBtnEnabled = function(sIsEnabled){

        if (!oWS.utill.attr.sap) {
            return;
        }

        // 메인 브라우저 닫기 버튼
        let _oMainCloseBtn = oWS.utill.attr.sap.ui.getCore().byId("mainWinClose");

        if (sIsEnabled === "X") {

            _oMainCloseBtn.setEnabled(false);

            return;
        }

        _oMainCloseBtn.setEnabled(true);

    };

    // 19. Busy Indicator 실행
    /**
     * @since   2026-01-07 10:20:24
     * @version v3.5.7-4
     * @author  soccerhs
     * @description
     *
     * 기존 소스 리펙토링
     *
     */
    oWS.utill.fn.setBusy = (sIsBusy) => {

        // 공통 참조 변수 캐싱 (반복 접근 최소화)
        const util = oWS.utill;
        const attr = util.attr;

        // 1. 중복 실행 방지
        // 이미 Busy 상태인데 다시 'X'를 요청받은 경우 무시
        if (sIsBusy === "X" && attr.isBusy === "X") {
            return;
        }

        // 상태 업데이트
        attr.isBusy = sIsBusy;
        const bIsBusy = (sIsBusy === "X");

        // 2. 사용자 인터랙션 차단 (마우스 이벤트 제어)
        document.body.style.pointerEvents = bIsBusy ? "none" : "";

        // if(bIsBusy){
        //     attr.sap.ui.getCore().lock();
        // } else {
        //     attr.sap.ui.getCore().unlock();
        // }

        // 3. 포커스(Focus) 매니지먼트
        // iframe 등의 환경을 고려하여 ws_frame 체크
        const targetDoc = (typeof ws_frame === "object" && ws_frame?.document) ? ws_frame.document : document;

        if (bIsBusy) {
            // [Busy 시작] 현재 포커스 저장 및 블러 처리
            const activeEl = targetDoc.activeElement;

            if (activeEl && typeof activeEl.blur === "function") {
                attr.beforeActiveElement = activeEl; // 포커스 위치 저장
                activeEl.blur(); // 포커스 해제
            }

        } else {
            // [Busy 종료] 이전 포커스 복구
            const prevEl = attr.beforeActiveElement;

            if (prevEl && typeof prevEl.focus === "function") {
                prevEl.focus();
                delete attr.beforeActiveElement; // 저장된 요소 초기화
            }
        }

        // 4. Busy Indicator UI 제어
        const oBusy = attr.oBusy;

        if (oBusy) {
            if (bIsBusy) {
                // UI 초기화 및 오픈
                if (typeof oBusy.setTitle === "function") oBusy.setTitle("");
                if (typeof oBusy.setText === "function") oBusy.setText("");

                // 이미 열려있지 않다면 오픈 (isOpen 메서드가 있다면 활용 권장)
                // if (!oBusy.isOpen || !oBusy.isOpen()) { oBusy.open(); }
                if (typeof oBusy.open === "function") oBusy.open();

                // 메인 브라우저 닫기 버튼 비활성
                util.fn.setMainCloseBtnDisabled("X");

            } else {
                // 닫기
                if (typeof oBusy.close === "function") oBusy.close();

                // 메인 브라우저 닫기 버튼 활성
                util.fn.setMainCloseBtnDisabled("");
            }
        }

        // 5. 작업표시줄 ProgressBar 실행 (외부 연동)
        // setProgressBar 함수가 전역에 있다고 가정
        if (typeof setProgressBar === "function") {
            setProgressBar("S", bIsBusy);
        }

    };

    /**********************************************************
     * 공통 Busy Dialog
     **********************************************************
     * @param {Char1} bIsBusy
     *  - "X" : busy 실행
     *  - ""  : busy 종료
     *
     * @param {Object} oOptions
     * {
     *    TITLE: "",   // 제목
     *    DESC : ""    // 내역
     * }
     **********************************************************/
    oWS.utill.fn.setBusyDialog = function (sIsbusy, oOptions) {

        // [UI5 제거] 구: if(!attr.sap) return; → BusyDialog 가 sap 의존이라 HTML5 에선
        //   아무것도 안 떴음. 이제 attr.oBusy(더미 busy = DOM 카드 컨트롤러)로 동작.

        oWS.utill.attr.isBusy = sIsbusy;

        var bIsBusy = (sIsbusy === "X" ? true : false);

        // 실행 즉시 lock을 건다 (UI5 있을 때만 — HTML5 는 setBusy 가 pointerEvents 차단)
        if (bIsBusy && oWS.utill.attr.sap) {
            oWS.utill.attr.sap.ui.getCore().lock();
        }

        // Cursor Focus Handle
        if (bIsBusy) {

            var _oBeforeActiveElement = document.activeElement || undefined;

            if (_oBeforeActiveElement && typeof _oBeforeActiveElement?.blur !== "undefined") {

                //마지막 포커스 위치 전역화
                oWS.utill.attr.beforeActiveElement = _oBeforeActiveElement;

                //이전 포커스 제거
                _oBeforeActiveElement.blur();

            }

        } else {

            //이전 등록된 위치정보가 존재시
            if (typeof oWS?.utill?.attr?.beforeActiveElement?.focus !== "undefined") {

                oWS.utill.attr.beforeActiveElement.focus();

                delete oWS.utill.attr.beforeActiveElement;

            }

        }

        /**
         * "setBusy" function에서 Busy를 키고 끌 때, 메인 화면 상단의 "X" 버튼 활성, 비활성화 처리를
         * setTimeout에서 실행하여, BusyDialog에서도 동일하게 setTimeout으로 해야
         * busy와 busyDialog를 동시에 실행해도 sync가 깨지지 않음.
         *
         * 예) 아래의 두개의 소스를 동시에 실행
         * 1. setBusy("");                         <---- 메인 화면 상단의 "X" 버튼 활성 비활성을 setTimeout에서 수행
         * 2. setBusy("X", { DESC:"loading.."});   <---- 메인 화면 상단의 "X" 버튼 활성 비활성을 동기로 수행
         *
         * 동기로 수행한 2번째 로직에서는 "X"로 BusyDialog를 실행했는데,
         * 비동기로 수행한 1번째 로직이 setTimeout으로 비동기 동작을 하여,
         * 수행은 1 => 2의 순서로 수행했지만, 1번이 비동기라 2번 수행 후 1번이 타는 현상.
         */
        // setTimeout(function(){

        // 20250207
        let oBusyDlg = oWS.utill.attr.oBusy;

        // zconsole.warn("setBusyDialog", `bIsBusy: "${bIsBusy}"`);

        // Busy를 켰을 경우
        if (bIsBusy) {

            // 메인 브라우저 닫기 버튼 비활성
            oWS.utill.fn.setMainCloseBtnDisabled("X");

            let sDefTitle = "";
            let sDefDesc = "";

            let sTitle = sDefTitle;
            let sDesc = sDefDesc;

            // 옵션값이 있을 경우
            if (typeof oOptions === "object") {

                sTitle = oOptions.TITLE || sDefTitle;
                sDesc = oOptions.DESC || sDefDesc;

            }

            // // BusyDialog가 없으면 신규 생성
            // if(!oWS.utill.attr.oBusyDlg){

            //     oWS.utill.attr.oBusyDlg = new oWS.utill.attr.sap.m.BusyDialog();

            //     // CustomData에 MUTATION_EXCEP을 주는 이유?
            //     // Mutation이 화면에 dialog 류 들이 감지되면 현재 떠있는 자식 윈도우를 활성 or 비활성 하는데,
            //     // 특정 Dialog는 Mutation 감지 대상에서 제외시키고자 할 때
            //     // Dialog Object에 CustomData로 구분함
            //     oWS.utill.attr.oBusyDlg._oDialog.data("MUTATION_EXCEP", "X");

            // }

            // let oBusyDlg = oWS.utill.attr.oBusyDlg;

            oBusyDlg.setTitle(sTitle);
            oBusyDlg.setText(sDesc);

            // if(sTitle){

            //     oBusyDlg.setTitle(sTitle);
            //     oBusyDlg.setText(sDesc);

            // } else {

            //     oBusyDlg.setTitle("　");
            //     oBusyDlg.setText(sDesc);
            //     oBusyDlg.setTitle("");

            // }

            // oBusyDlg.setTitle(sTitle);
            // oBusyDlg.setText(sDesc);

            // Busy Dialog가 open되지 않았을 경우 오픈시킨다.
            if (oBusyDlg.isOpen() === false) {
                oBusyDlg.open();
            }

        } else {

            // 메인 브라우저 닫기 버튼 활성
            oWS.utill.fn.setMainCloseBtnDisabled("");

            // if(oWS.utill.attr.oBusyDlg){

            //     oWS.utill.attr.oBusyDlg.destroy();

            //     delete oWS.utill.attr.oBusyDlg;

            //     oWS.utill.attr.sap.ui.getCore().unlock();

            // }

            if (oBusyDlg) {

                oBusyDlg.close();

                oBusyDlg.setTitle("");
                oBusyDlg.setText("");

                if (oWS.utill.attr.sap) {
                    oWS.utill.attr.sap.ui.getCore().unlock();
                }

            }

        }

        // }, 0);

        // 작업표시줄에 ProgressBar 실행
        setProgressBar("S", bIsBusy);

    }; // end of oWS.utill.fn.setBusyDialog

    // 현재 Busy Indicator 상태를 리턴해준다.
    oWS.utill.fn.getBusy = function () {
        return oWS.utill.attr.isBusy;
    };

    // 20. Page Loading 실행
    oWS.utill.fn.showLoadingPage = function (bIsShow) {

        var oLoadPg = document.getElementById("u4a_main_load");
        if (!oLoadPg) {
            return;
        }

        if (bIsShow == 'X') {
            oLoadPg.style.background = "linear-gradient(to right, #1c2228, #1c2228)";
            oLoadPg.classList.remove("u4a_loadersInactive");

        } else {

            // oLoadPg.style.background = "";
            oLoadPg.classList.add("u4a_loadersInactive");
        }

    };

    // 21. 에디터 정보 저장
    oWS.utill.fn.setWsConfigInfo = (oWsConfInfo) => {
        oWS.utill.attr.oWsConfInfo = Object.assign(oWS.utill.attr.oWsConfInfo, oWsConfInfo);
    };

    // 22. 에디터 정보 구하기
    oWS.utill.fn.getWsConfigInfo = () => {

        if (!oWS.utill.attr.oWsConfInfo) {
            return;
        }

        return oWS.utill.attr.oWsConfInfo;

    };

    // 23. sap sound
    oWS.utill.fn.setSoundMsg = (TYPE) => {

        // 글로벌 사운드 설정값이 X 일 경우에만 수행
        let oSettingInfo = WSUTIL.getWsSettingsInfo();
        if (oSettingInfo.globalSound !== "X") {
            return;
        }

        // var oAudio = new Audio(),
        let oAudio = document.getElementById("u4aWsAudio");
        let sSoundRootPath = PATH.join(APPPATH, "sound", "sap");
        let sAudioPath = "";

        switch (TYPE) {
            case "01": // active
                sAudioPath = PATH.join(sSoundRootPath, 'sapmsg.wav');
                break;

            case "02": // error
                sAudioPath = PATH.join(sSoundRootPath, 'saperror.wav');
                break;

            case "WELCOME":

                // 웰컴 사운드 경로를 구한다.
                sAudioPath = _getWelComeSoundPath();

                break;

        }

        // 실행 중이면 리턴.
        if (!oAudio.paused) {
            return;
        }

        oAudio.src = "";
        oAudio.src = sAudioPath;
        oAudio.play();

    };

    // 24. Login 유저 정보 저장
    oWS.utill.fn.setUserInfo = (oUserInfo) => {

        if (oWS.utill.attr.oUserInfo) {
            delete oWS.utill.attr.oUserInfo;
        }

        oWS.utill.attr.oUserInfo = oUserInfo;

        IPCRENDERER.send("if-test-user", oUserInfo);

    };

    // 25. Login 유저 정보 구하기
    oWS.utill.fn.getUserInfo = () => {

        if (!oWS.utill.attr.oUserInfo) {
            return;
        }

        return oWS.utill.attr.oUserInfo;

    };

    // 27. random Key
    oWS.utill.fn.getRandomKey = (iLenth) => {
        if (iLenth) {
            return RANDOM.generate(iLenth);
        }
        return RANDOM.generate(40);
    };

    // 28. SSID Setting
    oWS.utill.fn.setSSID = (SSID) => {

        if (oWS.utill.attr.SSID) {
            delete oWS.utill.attr.SSID;
        }

        oWS.utill.attr.SSID = SSID;

    };

    // 29. SSID 구하기
    oWS.utill.fn.getSSID = () => {

        if (typeof oWS.utill.attr.SSID === "undefined") {
            return "";
        }

        return oWS.utill.attr.SSID;
    };

    // 30. Browser Session Key를 구한다.
    oWS.utill.fn.getSessionKey = () => {
        return oWS.utill.attr.sessionkey;
    };

    // 31. Browser Session Key를 설정한다.
    oWS.utill.fn.setSessionKey = (sSessKey) => {
        oWS.utill.attr.sessionkey = sSessKey;
    }

    // 32. Browser 개별 key를 구한다.
    oWS.utill.fn.getBrowserKey = () => {
        return oWS.utill.attr.browserkey;
    }

    // 33. Browser 개별 key를 설정한다.
    oWS.utill.fn.setBrowserKey = (sBrowserKey) => {
        oWS.utill.attr.browserkey = sBrowserKey;
    }

    // 35. Default Browser 정보 리턴
    oWS.utill.fn.getDefaultBrowserInfo = () => {
        return oWS.utill.attr.aDefaultBrowsInfo;
    };

    // 36. Default Browser 정보 저장
    oWS.utill.fn.setDefaultBrowserInfo = (aDefaultBrowsInfo) => {

        if (oWS.utill.attr.aDefaultBrowsInfo.length != 0) {
            oWS.utill.attr.aDefaultBrowsInfo = [];
        }

        oWS.utill.attr.aDefaultBrowsInfo = aDefaultBrowsInfo;

    };

    // 37. 메타 정보 세팅
    oWS.utill.fn.setMetadata = (METADATA) => {

        if (oWS.utill.attr.METADATA) {
            delete oWS.utill.attr.METADATA;
        }

        oWS.utill.attr.METADATA = METADATA;

    };

    // 38. 메타 정보 구하기
    oWS.utill.fn.getMetadata = () => {

        if (!oWS.utill.attr.METADATA) {
            return;
        }

        return oWS.utill.attr.METADATA;

    };

    // 39. 네트워크 상태에 따른 Busy Indicator 실행 메소드
    oWS.utill.fn.setNetworkBusy = (bIsBusy, iZindex) => {

        var oNetBusy = document.getElementById("u4a_neterr");
        if (!oNetBusy) {
            return;
        }

        oNetBusy.classList.add("u4a_neterrInactive");

        if (bIsBusy) {

            setTimeout(() => {
                oNetBusy.focus();
            }, 0);

            oNetBusy.classList.remove("u4a_neterrInactive");
            oNetBusy.style.zIndex = iZindex ? iZindex : 999999;
            return;
        }

    };

})(oWS);


/**
 *  ## Electron
 */

var // <-- 여기는 반드시 var로 선언해야함. (let, const는 자식에서 parent로 접근이 안됨.)
    REMOTE = require('@electron/remote'),
    MAIN_REQUIRE = REMOTE.getGlobal("mainRequire"),
    REMOTEMAIN = MAIN_REQUIRE('@electron/remote/main'),
    SCREEN = REMOTE.require('electron').screen,
    GLOBALSHORTCUT = REMOTE.require('electron').globalShortcut,
    IPCMAIN = REMOTE.require('electron').ipcMain,
    IPCRENDERER = require('electron').ipcRenderer,
    DIALOG = REMOTE.require('electron').dialog,
    PATH = REMOTE.require('path'),
    APP = REMOTE.app,
    FS = REMOTE.require('fs'),
    RANDOM = require("random-key"),
    SPAWN = require("child_process").spawn,
    REGEDIT = require('regedit'),
    WEBFRAME = require('electron').webFrame,
    APPPATH = APP.getAppPath(),
    USERDATA = APP.getPath("userData"),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = parent.require(PATHINFO.WSUTIL),
    USP_UTIL = parent.require(PATHINFO.USP_UTIL),
    CURRWIN = REMOTE.getCurrentWindow(),
    MIMETYPES = require('mime-types'),
    POWERMONITOR = REMOTE.require('electron').powerMonitor,
    COMPUTERNAME = process.env.COMPUTERNAME,
    WSLOG = require(PATH.join(PATHINFO.WS10_20_ROOT, "js", "ws_log.js")),
    UAI = require(PATH.join(PATHINFO.JS_ROOT, "uai", "index.js")),
    DEV_SOURCE_FINDER = require(PATH.join(PATHINFO.JS_ROOT, "utils", "devSourceFinder"));

var WSERR = require(PATHINFO.WSTRYCATCH);
var zconsole = WSERR(window, document, console);

var { CLIpcHandler } = require(PATH.join(PATHINFO.JS_ROOT, "utils", "ipc-handler"));
var IPC_HANDLER = new CLIpcHandler();

const vbsDirectory = PATH.join(PATH.dirname(APP.getPath('exe')), 'resources/regedit/vbs');
REGEDIT.setExternalVBSLocation(vbsDirectory);

// 자식 윈도우를 관리하는 용도
CURRWIN._aChildWinMap = new Map();

POWERMONITOR.setMaxListeners(100);
IPCMAIN.setMaxListeners(100);
IPCRENDERER.setMaxListeners(100);

/* ===================================================================
 * ===  [2/2] wsIF01.js  ============================================
 * =================================================================== */
/**
 *  선언적 Function
 */

// 1. 메시지 호출
function showMessage(oUI5, KIND, TYPE, MSG, fn_callback) {
    oWS.utill.fn.showMessage(oUI5, KIND, TYPE, MSG, fn_callback);
}

// 2. 서버 정보를 구한다.
function getServerInfo() {
    return oWS.utill.fn.getServerInfo();
}

function setServerInfo(oServerInfo) {
    oWS.utill.fn.setServerInfo(oServerInfo);
}

function setBeforeServerInfo(oServerInfo) {
    oWS.utill.fn.setBeforeServerInfo(oServerInfo);
}

function getBeforeServerInfo() {
    return oWS.utill.fn.getBeforeServerInfo();
}

// 3. 서버 URL을 구한다.
function getServerPath(bIsStateLess) {
    return oWS.utill.fn.getServerPath(bIsStateLess);
}

// 서버의 호스트를 구한다.
function getServerHost() {
    return oWS.utill.fn.getServerHost();
}

// 4. Page 이동
function onMoveToPage(sPagePath) {
    oWS.utill.fn.onMoveToPage(sPagePath);
}

// 5. Electron Instance return.
function getElectronRemote() {
    return oWS.utill.fn.getElectronRemote();
}

// 6. NODE JS 'require' return.
function getRequire() {
    return oWS.utill.fn.getRequire();
}

// 7. AppID 및 Create, Change, Display 모드 정보 저장
function setAppInfo(oAppInfo) {
    oWS.utill.fn.setAppInfo(oAppInfo);
}

// 8. AppID 및 Create, Change, Display 모드 정보 구하기
function getAppInfo() {
    return oWS.utill.fn.getAppInfo();
}

// 10. Window Header Menu Setting
function setBrowserMenu(aTemplate) {
    oWS.utill.fn.setBrowserMenu(aTemplate);
}

// 11. 현재 dirname 구하기
function getDirName() {
    return oWS.utill.fn.getDirName();
}

// 12. Page Path 구하기
function getPath(sPagePath) {
    return oWS.utill.fn.getPath(sPagePath);
}

// 14. 서버에서 App 정보를 구한다.
function getAppDataFromServer(oFormData, fn_success) {
    oWS.utill.fn.getAppDataFromServer(oFormData, fn_success);
}

// 15. 새창 띄우기
function onNewWindow(IF_DATA) {
    oWS.utill.fn.onNewWindow(IF_DATA);
}

/**
 * 16. 새창 띄울때 현재 세션 추가하기
 * @param {*} TYPE
 *  - A : +
 *  - D : -
 */
function setSessionCount(TYPE) {
    return oWS.utill.fn.setSessionCount(TYPE);
}

// 18. error message 가져오기
function getErrorMsg() {
    return oWS.utill.fn.getErrorMsg();
}

function setDomBusy(bIsBusy) {

    let oBusyDom = document.getElementById("u4aWsBusyIndicator");
    if (!oBusyDom) {
        return;
    }

    // busy 요소가 <dialog> 면 showModal() 로 띄운다 — 모달 팝업(showModal)도 top-layer 라
    //   일반 <div>(z-index 무한대라도) busy 는 그 뒤로 가려 안 보인다. busy 도 모달이어야
    //   어떤 모달 팝업 위에도 보인다(전 화면 공통 — 모든 parent.setBusy 가 그대로 위에 뜸).
    //   <dialog> 가 아니면(다른 창) 기존 display 토글로 폴백.
    var bIsDialog = (typeof oBusyDom.showModal === "function");

    if (bIsBusy === "X") {
        if (bIsDialog) {
            if (!oBusyDom.__escGuard) {
                oBusyDom.__escGuard = true;
                // busy 중 ESC 로 닫히지 않게(닫혀도 작업은 계속되지만 시각 잠금 유지).
                oBusyDom.addEventListener("cancel", function (e) { e.preventDefault(); });
            }
            if (!oBusyDom.open) {
                try { oBusyDom.showModal(); } catch (e) { oBusyDom.style.display = "flex"; }
            }
        } else {
            oBusyDom.style.display = "flex"; // 카드 중앙정렬 (스크림 flex center)
        }
        return;
    }

    if (bIsDialog) {
        if (oBusyDom.open) { try { oBusyDom.close(); } catch (e) { } }
    } else {
        oBusyDom.style.display = "none";
    }

}

// 19. Busy Indicator 실행
// - 파라미터에 Option이 존재할 경우는 busyDialog로 호출함
function setBusy(bIsBusy, oOptions) {

    // console.trace(`Busy: ${bIsBusy}`);

    zconsole.warn("setBusy", `bIsBusy: "${bIsBusy}", oOptions: ${oOptions}`);

    //busy on 처리 건인경우.
    if (bIsBusy === "X") {
        // 파라미터에 옵션을 추가했을 경우는 BusyDialog로 호출함!!
        if (typeof oOptions === "object") {
            oWS.utill.fn.setBusyDialog(bIsBusy, oOptions);
            return;
        }

        oWS.utill.fn.setBusy(bIsBusy);

        return;
    }

    //busy dialog 종료처리.
    oWS.utill.fn.setBusyDialog("", oOptions);

    //기존 busy 종료 처리.
    oWS.utill.fn.setBusy("");

}

// 현재 Busy Indicator 상태를 구한다.
function getBusy() {
    return oWS.utill.fn.getBusy();
}

// 20. Page Loading 실행
function showLoadingPage(bIsShow) {
    oWS.utill.fn.showLoadingPage(bIsShow);
}

// 21. 에디터 정보 저장
function setWsConfigInfo(oWsConfInfo) {
    oWS.utill.fn.setWsConfigInfo(oWsConfInfo);
}

// 22. 에디터 정보 구하기
function getWsConfigInfo() {
    return oWS.utill.fn.getWsConfigInfo();
}

// 23. sap sound
function setSoundMsg(TYPE) {
    oWS.utill.fn.setSoundMsg(TYPE);
}

// 24. Login 유저 정보 저장
function setUserInfo(oUserInfo) {
    oWS.utill.fn.setUserInfo(oUserInfo);
}

// 25. Login 유저 정보 구하기
function getUserInfo() {
    return oWS.utill.fn.getUserInfo();
}

// 27. random Key 생성
function getRandomKey(iLenth) {
    return oWS.utill.fn.getRandomKey(iLenth);
}

// 28. SSID Setting
function setSSID(SSID) {
    oWS.utill.fn.setSSID(SSID);
}

// 29. SSID 구하기
function getSSID() {
    return oWS.utill.fn.getSSID();
}

// 30. Browser Session Key를 구한다.
function getSessionKey() {
    return oWS.utill.fn.getSessionKey();
}

// Browser Session Key 정보를 set 한다.
function setSessionKey(sSessKey) {
    oWS.utill.fn.setSessionKey(sSessKey);
}

function getBrowserKey() {
    return oWS.utill.fn.getBrowserKey();
}

function setBrowserKey(sBrowserKey) {
    oWS.utill.fn.setBrowserKey(sBrowserKey);
}

// 31. 메시지 번호에 맞는 메시지 내용을 구한다.
function getMessage(MSGKY) {
    return oWS.utill.fn.getMessage(MSGKY);
}

// 33. Default Browser 정보 리턴
function getDefaultBrowserInfo() {
    return oWS.utill.fn.getDefaultBrowserInfo();
}

// 34. Default Browser 정보 저장
function setDefaultBrowserInfo(aDefaultBrowsInfo) {
    oWS.utill.fn.setDefaultBrowserInfo(aDefaultBrowsInfo);
}

// 35. 메타 정보 세팅
function setMetadata(METADATA) {
    oWS.utill.fn.setMetadata(METADATA);
}

// 36. 메타 정보 구하기
function getMetadata() {
    return oWS.utill.fn.getMetadata();
}

// Network 상태에 따른 Busy Indicator
function setNetworkBusy(bIsBusy, iZindex) {
    oWS.utill.fn.setNetworkBusy(bIsBusy, iZindex);
}

// 헤더 메뉴 보이기/ 숨기기 기능
function setHeaderMenuVisible(bIsVisi) {

    if (typeof bIsVisi !== "boolean") {
        return;
    }

    var oCurrWin = REMOTE.getCurrentWindow();

    oCurrWin.setMenuBarVisibility(bIsVisi);

}

function setCurrPage(sPageId) {
    oWS.utill.attr.currPage = sPageId;
    oAPP.oChildApp.common.fnSetModelProperty("/CURR_PAGE", sPageId);
}

function getCurrPage() {
    return oWS.utill.attr.currPage;
}

function getLocalAppDataPath() {
    return process.env.LOCALAPPDATA;
}

// 텍스트 클립보드 복사
function setClipBoardTextCopy(sText, fnCallback) {

    if (typeof sText !== "string") {
        return;
    }

    var oTextArea = document.createElement("textarea");
    oTextArea.value = sText;

    document.body.appendChild(oTextArea);

    oTextArea.select();

    document.execCommand('copy');

    document.body.removeChild(oTextArea);

    if (typeof fnCallback === "function") {
        fnCallback();
    }

}

// Application Change 모드 변경
function setAppChange(bIsChange) {

    if (typeof bIsChange !== "string") {
        return;
    }

    if (bIsChange != 'X' && bIsChange != '') {
        return;
    }

    // 어플리케이션 정보 가져오기
    var oAppInfo = getAppInfo();

    // 어플리케이션 정보에 변경 플래그
    oAppInfo.IS_CHAG = bIsChange;

    setAppInfo(oAppInfo);

}

/************************************************************************
 *  작업표시줄에 ProgressBar
 * **********************************************************************
 * @param {CHAR1} TYPE
 * - ProgressBar Type
 * - "S" : 일반 스타일, "E": "오류 스타일"
 * @param {Boolean}} bIsShow
 * - ProgressBar 실행/중지
 * - true: 실행
 * - false: 중지
 ************************************************************************/
function setProgressBar(TYPE, bIsShow) {

    if (typeof TYPE !== "string") {
        return;
    }

    if (typeof bIsShow !== "boolean") {
        return;
    }

    var oCurrWin = REMOTE.getCurrentWindow();

    var oOptions = {
        mode: "error"
    },
        iStatus = (bIsShow ? 1 : 0);

    // 현재 Busy Indicator 상태정보를 글로벌 변수에 저장한다.
    oWS.utill.attr.isBusy = (bIsShow == true ? "X" : "");

    switch (TYPE) {
        case "S":
            oOptions.mode = "normal";
            iStatus = (bIsShow ? 2 : 0);
            break;

        case "E":
            oOptions.mode = "error";
            break;

        default:
            oOptions.mode = "none";
            break;
    }

    oCurrWin.setProgressBar(iStatus, oOptions);

} // end of oAPP.common.setProgressBar

function onLoadBusyIndicator() {

    var oCurrWin = REMOTE.getCurrentWindow(),
        SESSKEY = getSessionKey();

    var sIndicatorPath = APPPATH + "\\Frame\\BusyIndicator.html";

    // 브라우저 옵션 설정
    var sSettingsJsonPath = PATH.join(APP.getAppPath(), "/settings/BrowserWindow/BrowserWindow-settings.json"),
        oOptions = require(sSettingsJsonPath),
        oBrowserOptions = jQuery.extend(true, {}, oOptions.browserWindow);

    oBrowserOptions.modal = true;
    oBrowserOptions.show = false;
    oBrowserOptions.resizable = false;
    oBrowserOptions.frame = false;
    oBrowserOptions.transparent = true;
    oBrowserOptions.thickFrame = false;
    oBrowserOptions.maximizable = false;
    oBrowserOptions.minimizable = false;
    oBrowserOptions.autoHideMenuBar = true;
    oBrowserOptions.devTools = false;
    oBrowserOptions.parent = oCurrWin;
    oBrowserOptions.webPreferences.partition = SESSKEY;
    oBrowserOptions.webPreferences.nodeIntegration = false;

    // 브라우저 오픈
    var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
    REMOTEMAIN.enable(oBrowserWindow.webContents);

    // 브라우저 상단 메뉴 없애기
    oBrowserWindow.setMenu(null);

    oBrowserWindow.loadURL(sIndicatorPath);

    // 브라우저가 오픈이 다 되면 타는 이벤트
    oBrowserWindow.webContents.on('did-finish-load', function () {
        oBrowserWindow.setContentBounds(oCurrWin.getBounds());
    });

    // 브라우저를 닫을때 타는 이벤트
    oBrowserWindow.on('closed', () => {

        oBrowserWindow = null;

        if (oWS.utill.attr.oBusyIndicator) {
            delete oWS.utill.attr.oBusyIndicator;
        }

    });

    oWS.utill.attr.oBusyIndicator = oBrowserWindow;

}

//Window Move 이벤트 on/off 설정 펑션
function fn_onWinMove(on, oWin) {

    if (typeof oWin === "undefined") {
        return;
    }

    if (typeof oWin.__fnWinMove === "undefined") {

        oWin.__fnWinMove = function () {

            fn_setWinMinSize(oWin);

        };

    }

    if (on) {

        fn_setWinMinSize(oWin);

        oWin.on("move", oWin.__fnWinMove);

    } else {

        oWin.setMinimumSize(800, 800);

        var oSize = oWin.getBounds();
        oSize.width = 800;
        oSize.height = 800;

        oWin.setBounds(oSize);

        oWin.off("move", oWin.__fnWinMove);

        delete oWin.__fnWinMove;
        delete screen.__width;

    }

}

//윈도우 최소 size 설정 펑션
function fn_setWinMinSize(oWin) {

    if (typeof screen.__width === "undefined") {
        screen.__width = screen.width;
        screen.__height = screen.height;

        var Lwidth = screen.width / 2;
        var Lheight = screen.height / 2;

        oWin.setMinimumSize(Math.ceil(Lwidth), Math.ceil(Lheight));

        return;

    }

    //멀티 모니터 사용시 모니터별 해상도 변화가 감지 되었을경우
    if (screen.__width != screen.width) {
        screen.__width = screen.width;
        screen.__height = screen.height;

        var Lwidth = screen.width / 2;
        var Lheight = screen.height / 2;

        var oSize = oWin.getBounds(),
            isRun = false;

        if (oSize.width < Lwidth) {
            isRun = true;
            oSize.width = Lwidth;
        }

        if (oSize.height < Lheight) {
            isRun = true;
            oSize.height = Lheight;
        }

        if (isRun) {
            oWin.setBounds(oSize);
        }

        oWin.setMinimumSize(Math.ceil(Lwidth), Math.ceil(Lheight));

    }

}

// window Size 개인화
function fn_setPersonalWinSize(oWin) {

    //차후 사용자 창 닫을때 마지막 윈도우창 SIZE을 읽는 로직이 필요함

    var Lwidth = screen.width / 2;
    var Lheight = screen.height / 2;

    var oSize = oWin.getBounds(),
        isRun = false;
    if (oSize.width < Lwidth) {
        isRun = true;
        oSize.width = Lwidth;
    }
    if (oSize.height < Lheight) {
        isRun = true;
        oSize.height = Lheight;
    }
    if (isRun) {
        oWin.setBounds(oSize);
    }

}

//
function fnSaveEventSuggestion(sName, sValue) {

    const iMaxCnt = 20;

    let sJsonPath = PATH.join(USERDATA, "p13n", "events.json"),
        sJsonData = FS.readFileSync(sJsonPath, 'utf-8'),
        aEvents = JSON.parse(sJsonData);

    if (aEvents instanceof Array == false) {
        aEvents = [];
    }

    let iEventLength = aEvents.length;
    if (iEventLength == 0) {
        aEvents.push({
            name: sName,
            value: sValue
        });

        // events.json 파일에 Event Suggestion 정보 저장
        FS.writeFileSync(sJsonPath, JSON.stringify(aEvents));
        return;
    }

    // 저장하려는 ID가 이미 있으면
    // 해당 ID를 Suggestion 최상단에 배치한다.
    let iFindIndex = aEvents.findIndex(a => a.name == sName);

    // 저장하려는 ID가 이미 있고 Array에 가장 첫번째에 있으면 빠져나간다.
    if (iFindIndex == 0) {
        return;
    }

    // 저장하려는 ID가 이미 있고 Array에 첫번째가 아니면
    // 기존 저장된 위치의 ID 정보를 삭제
    if (iFindIndex > 0) {
        aEvents.splice(iFindIndex, 1);
    }

    // 저장된 Suggestion 갯수가 iIdSuggMaxCnt 이상이면
    // 마지막거 지우고 최신거를 1번째로 저장한다.
    let iBeforeCnt = aEvents.length;
    if (iBeforeCnt >= iMaxCnt) {
        aEvents.pop();
    }

    // ID를 Array의 가장 첫번째로 넣는다.
    aEvents.unshift({
        name: sName,
        value: sValue
    });

    // login.json 파일에 ID Suggestion 정보 저장
    FS.writeFileSync(sJsonPath, JSON.stringify(aEvents));

}

/************************************************************************
 * 서버 이벤트 Suggestion 데이터 읽기
 ************************************************************************/
function fnReadEventSuggestion(sName) {

    let sJsonPath = PATH.join(USERDATA, "p13n", "events.json"),
        sJsonData = FS.readFileSync(sJsonPath, 'utf-8'),
        aEvents = JSON.parse(sJsonData);

    if (aEvents instanceof Array == false) {
        return [];
    }

}

/************************************************************************
 * 새창 실행 시, IF_DATA 된 정보 저장
 ************************************************************************/
function setNewBrowserIF_DATA(IF_DATA) {

    oWS.utill.attr.NEW_BROWS_IF_DATA = IF_DATA;

} // end of setNewBrowserIF_DATA

/************************************************************************
 * 새창 실행 시, IF_DATA 저장된 데이터 구하기
 ************************************************************************/
function getNewBrowserIF_DATA() {

    return oWS.utill.attr.NEW_BROWS_IF_DATA || undefined;

} // end of getNewBrowserIF_DATA

/************************************************************************
 * 테마 정보 저장
 ************************************************************************/
function setThemeInfo(oThemeInfo) {

    oWS.utill.attr.oThemeInfo = oThemeInfo;

}

/************************************************************************
 * 테마 정보 구하기
 ************************************************************************/
function getThemeInfo() {
    return oWS.utill.attr.oThemeInfo || {};
}

/************************************************************************
 * HTML 문서에서 HTML 태그만 없애고 순수 text만 리턴
 ************************************************************************/
function setCleanHtml(msgtxt) {

    /****************************************
        @2020.11.17 by soccerhs
        - html에서 텍스트만 추출하는 Regex
    *****************************************/

    if (typeof msgtxt !== "string") {
        return;
    }

    /* html 부터 head 태그 날리기 */
    msgtxt = msgtxt.replace(/(<html>|<html)(\s|\S)*?<\/head>/igm, "\n");

    /* script영역 날리기 */
    msgtxt = msgtxt.replace(/(<script>|<script)(\s|\S)*?<\/script>/igm, "\n");

    /* Table Tag만 따로 수집한다 */
    var aTableTag = [];

    msgtxt = msgtxt.replace(/(<table>|<table)(\s|\S)*?<\/table>/igm, function (full) {

        var iTableCnt = aTableTag.length;

        aTableTag.push(full);

        return "\n&&table" + iTableCnt + "&&\n";

    });

    /* html의 END 태그를 개행 시키기 */
    msgtxt = msgtxt.replace(/\s*<\/[^>]+>\s*/igm, "\n");

    /* html 태그 날리기 */
    msgtxt = msgtxt.replace(/\s*<[^>]+>/igm, "\n");

    /* 여러 개행 문자를 하나의 개행문자로 축소하기 */
    msgtxt = msgtxt.replace(/[\n$]+[\n$]/igm, "\n");

    /* 추출된 문자열의 첫번째와 마지막의 개행 문자를 제거하기 */
    msgtxt = msgtxt.replace(/(^\n|\n$)/igm, "");

    // msgtxt = msgtxt.replace(/\n/g, '<br>');

    /* Table 태그가 있을 경우 원래 위치로 replace 수행 */
    if (aTableTag.length != 0) {

        var iLen = aTableTag.length,
            regex = "";

        for (var i = 0; i < iLen; i++) {

            var oTag = aTableTag[i],
                oDom = document.createElement("div");

            oDom.innerHTML = oTag;

            var oTagData = lf_removeStyleAttr(oDom);
            aTableTag[i] = oTagData.innerHTML;

            regex = "&&table" + i + "&&";
            msgtxt = msgtxt.replace(regex, aTableTag[i]);

        }

    }

    function lf_removeStyleAttr(oDom) {

        var aChild = oDom.childNodes,
            iChildCnt = aChild.length;

        if (iChildCnt == 0) {
            return;
        }

        for (var i = 0; i < iChildCnt; i++) {

            var oChild = aChild[i],
                aAttr = oChild.attributes;

            if (aAttr == null) {
                continue;
            }

            var iAttrLen = aAttr.length;

            /* Dom이 가지고 있는 속성을 확인한다. */
            if (iAttrLen != 0) {

                for (var j = iAttrLen - 1; j >= 0; j--) {

                    /* width, height 속성을 제외하고 나머지 속성 전체 제거 */
                    var sAttrName = aAttr[j].name;

                    if (sAttrName == null ||
                        sAttrName == "" ||
                        sAttrName == "width" ||
                        sAttrName == "height" ||
                        sAttrName == "background") {
                        continue;
                    }

                    oChild.removeAttribute(sAttrName);

                }

            }

            if (oChild.childNodes.length == 0) {
                continue;
            }

            lf_removeStyleAttr(oChild);
        }

        return oDom;

    }; /* end of f_removeStyle */

    return msgtxt;

}

/************************************************************************
 * trial 모드 여부 플래그
 ************************************************************************/
function getIsTrial() {

    // trial 버전이 아닐때만 수행
    var oWsSettings = getSettingsInfo(),
        bIsTrial = oWsSettings.isTrial;

    return bIsTrial;

}

/************************************************************************
 * ws setting 정보
 ************************************************************************/
function getSettingsInfo() {

    // Browser Window option
    var oSettingsPath = PATHINFO.WSSETTINGS,

        // JSON 파일 형식의 Setting 정보를 읽는다..
        oSettings = require(oSettingsPath);
    if (!oSettings) {
        return;
    }

    return oSettings;

}

/************************************************************************
 * 개인화 파일에 저장된 CDN 허용 여부 플래그를 가져온다.
 ************************************************************************/
function getIsCDN() {

    // 서버 접속 정보
    var oServerInfo = getServerInfo(),
        sSysID = oServerInfo.SYSID;

    // P13N 파일 Path
    var sP13nPath = getPath("P13N"),
        sP13nJsonData = FS.readFileSync(sP13nPath, 'utf-8'),

        // 개인화 정보
        oP13nData = JSON.parse(sP13nJsonData);

    return oP13nData[sSysID].ISCDN;

}; // end of oAPP.fn.fnGetIsCDN

/************************************************************************
 * 개인화 파일에 저장된 CDN 허용 여부 플래그를 저장한다.
 ************************************************************************/
function setIsCDN(bIsCDN) {

    // 서버 접속 정보
    var oServerInfo = getServerInfo(),
        sSysID = oServerInfo.SYSID;

    // P13N 파일 Path
    var sP13nPath = getPath("P13N"),
        sP13nJsonData = FS.readFileSync(sP13nPath, 'utf-8'),

        // 개인화 정보
        oP13nData = JSON.parse(sP13nJsonData);

    oP13nData[sSysID].ISCDN = bIsCDN;

    FS.writeFileSync(sP13nPath, JSON.stringify(oP13nData));

}; // end of oAPP.fn.fnSetIsCDN

/************************************************************************
 *  개인화 파일에 저장.
 * **********************************************************************
 * @param {String} sName
 * - 개인화 구분자명
 *
 * @param {any} anyData
 * - 저장하고 싶은 형태 자유.
 ************************************************************************/
function setP13nData(sName, anyData) {

    // 서버 접속 정보
    var oServerInfo = getServerInfo(),
        sSysID = oServerInfo.SYSID;

    // P13N 파일 Path
    var sP13nPath = getPath("P13N"),
        sP13nJsonData = FS.readFileSync(sP13nPath, 'utf-8'),

        // 개인화 정보
        oP13nData = JSON.parse(sP13nJsonData);

    oP13nData[sSysID][sName] = anyData;

    FS.writeFileSync(sP13nPath, JSON.stringify(oP13nData));

}

/************************************************************************
 *  저장된 개인화 파일 읽기
 * **********************************************************************
 * @param {String} sName
 * - 개인화 구분자명
 *
 * @return {any}
 * - 저장했던 구조
 ************************************************************************/
function getP13nData(sName) {

    // 서버 접속 정보
    var oServerInfo = getServerInfo(),
        sSysID = oServerInfo.SYSID;

    // P13N 파일 Path
    var sP13nPath = getPath("P13N"),
        sP13nJsonData = FS.readFileSync(sP13nPath, 'utf-8'),

        // 개인화 정보
        oP13nData = JSON.parse(sP13nJsonData);

    return oP13nData[sSysID][sName];

}

/************************************************************************
 * 호스트 정보를 구한다.
 ************************************************************************/
function getHost() {

    return getServerHost();

}

/************************************************************************
 * 공백 여부
 ************************************************************************/
function isBlank(s) {
    return isEmpty(s.trim());
}

/************************************************************************
 * 빈값 여부
 ************************************************************************/
function isEmpty(s) {
    return !s.length;
}

/************************************************************************
 * CONV Base64 -> ArrayBuffer
 ************************************************************************/
function base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

/************************************************************************
 * 같은 세션의 브라우저 인스턴스 구하기
 ************************************************************************/
function getSameBrowsers() {

    // 1. 현재 떠있는 브라우저 갯수를 구한다.
    var sKey = getSessionKey(),
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

        // 팝업같은 경우는 카운트 하지 않는다.
        if (oWebPref.OBJTY) {
            continue;
        };

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

        // 같은 세션키를 가진 브라우저 갯수를 카운트한다.
        iSamekeys++;
        aSameBrows.push(oBrows);
    }

    return aSameBrows;

}

/************************************************************************
 * electron native object에 접속한 User 정보를 저장한다
 ************************************************************************/
function setProcessEnvUserInfo(oUserInfo) {

    process.USERINFO = oUserInfo;

    const
        PATH = REMOTE.require('path'),
        USERINFO = process.USERINFO,
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        LANGU = USERINFO.LANGU,
        SYSID = USERINFO.SYSID;

    const PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));
    const WSUTIL = require(PATHINFO.WSUTIL);
    const WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

}

/************************************************************************
 * 기 저장한 electron native object에 접속 User 정보를 구한다
 ************************************************************************/
function getProcessEnvUserInfo() {
    return process.USERINFO;
}

function getAiIfMap() {
    return oWS.utill.attr.AI_IF_MAP;
} // end of getAiIfMap

/************************************************************************
 * 우리 회사 서버인지 판단
 ************************************************************************/
function isU4A_RND_SERVER(sSYSID) {

    // 1. 우리 회사 전용 SAP 서버 SYSID 3대 정의
    const aWhitelistedSysIds = [
        'UHA', // 개발 서버
        'U4A', // 운영 서버
    ];

    // 2. 전달받은 SYSID가 없으면 무조건 탈락
    if (!sSYSID) {
        return false;
    }

    // 3. 목록에 포함되어 있는지 확인 (대문자 변환으로 안정성 확보)
    return aWhitelistedSysIds.includes(sSYSID.toUpperCase());
};
