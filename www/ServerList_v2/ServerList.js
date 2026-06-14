/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ServerList.js
 * - file Desc : U4A Workspace Logon Pad (HTML5 컨버전)
 * ----------------------------------------------------------------------
 * doc 02 §8(B-2)/§9, doc 12 테마 전략 기반 SAP UI5 → 순수 HTML5 컨버전.
 *   · Electron/Node 자원(REMOTE/FS/regedit/Named Pipe/XHR/BrowserWindow)은
 *     호출부를 그대로 유지한다 (doc 02 §9.4 불변 제약).
 *   · UI5 컨트롤 → HTML 요소 + render 함수, JSONModel → 상태 저장소(M).
 *   · 색/모양은 theme/tokens.css 의미 토큰만 소비 (테마 전환 U4ATheme).
 ************************************************************************/

(function (window) {
    "use strict";

    /**
     * "ResizeObserver loop limit exceeded" / "...loop completed with undelivered
     * notifications" 는 브라우저가 내는 무해한 경고다. 전역 에러 핸들러
     * (ws_trycatch)가 이를 크리티컬 오류로 오인하지 않도록 가장 먼저 가로채 무시한다.
     */
    window.addEventListener("error", function (oErr) {
        const sMsg = oErr && oErr.message ? oErr.message : "";
        if (sMsg.indexOf("ResizeObserver loop") >= 0) {
            oErr.stopImmediatePropagation();
            oErr.preventDefault();
            return false;
        }
    }, true);

    /********************************************************************
     * Electron / Node 자원 (유지 — doc 02 §9.4 / 8장 A)
     ********************************************************************/
    const
        REMOTE = require('@electron/remote'),
        IPCRENDERER = require('electron').ipcRenderer,
        APP = REMOTE.app,
        CURRWIN = REMOTE.getCurrentWindow(),
        PATH = REMOTE.require('path'),
        FS = REMOTE.require('fs'),
        REGEDIT = require('regedit'),
        XMLJS = require('xml-js'),
        RANDOM = require("random-key"),
        SPAWN = require("child_process").spawn,
        APPPATH = APP.getAppPath(),
        USERDATA = APP.getPath("userData");

    const
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = parent.require(PATHINFO.WSUTIL),
        oU4ASERV = require(PATH.join(APPPATH, "ServerList_v2", "modules", "Server", "net", "index.js")),
        XHR = new XMLHttpRequest();

    XHR.withCredentials = true;

    /**
     * 전역 에러 로거 (유지) — Named Pipe 모듈(net/index.js) 등이 전역 `zconsole`
     * 을 참조하므로, 원본과 동일하게 렌더러 전역에 노출한다.
     */
    try {
        const WSERR = parent.require(PATHINFO.WSTRYCATCH);
        window.zconsole = WSERR(window, document, console);
    } catch (e) {
        window.zconsole = console;
    }

    // ws_settings.json (userData/conf 우선, 없으면 번들 settings 폴백)
    let SETTINGS;
    try {
        SETTINGS = require(PATHINFO.WSSETTINGS);
    } catch (e) {
        SETTINGS = require(PATH.join(APPPATH, "settings", "ws_settings.json"));
    }

    /**
     * 전역 노출 (유지) — 원본은 아래 값들을 최상위 var(=window 전역)로 뒀고,
     * iframe(aboutWs.html 등)·팝업·Named Pipe 모듈이 parent.REMOTE / parent.WSUTIL
     * 등으로 참조한다. 동일 계약을 유지하기 위해 window 에 노출한다.
     * (SETTINGS 초기화 이후에 노출해야 TDZ 오류가 없다.)
     */
    Object.assign(window, {
        REMOTE: REMOTE,
        CURRWIN: CURRWIN,
        APP: APP,
        PATH: PATH,
        FS: FS,
        REGEDIT: REGEDIT,
        XMLJS: XMLJS,
        RANDOM: RANDOM,
        IPCRENDERER: IPCRENDERER,
        WSUTIL: WSUTIL,
        SETTINGS: SETTINGS,
        PATHINFO: PATHINFO,
        XHR: XHR,
        oU4ASERV: oU4ASERV,
        APPPATH: APPPATH,
        USERDATA: USERDATA
    });

    const
        SAPGUIVER = 7700,
        SERVER_TBL_ID = "serverlist_table";

    // 레지스트리 vbs 경로 (regedit)
    try {
        const vbsDirectory = PATH.join(PATH.dirname(APP.getPath('exe')), 'resources/regedit/vbs');
        REGEDIT.setExternalVBSLocation(vbsDirectory);
    } catch (e) { /* dev 환경 무시 */ }

    // PowerShell 경로
    const PS_ROOT_PATH = PATH.join(USERDATA, "ext_api", "ps");
    const PS_PATH = {
        GET_SAPGUI_INFO: PATH.join(PS_ROOT_PATH, "WS_SAPGUI_INFO", "get_sapgui_inf.ps1")
    };

    /********************************************************************
     * oAPP 네임스페이스 (parent/외부 모듈 호환 위해 window 노출)
     ********************************************************************/
    let oAPP = {};
    oAPP.fn = {};
    oAPP.data = {};
    oAPP.attr = {};
    oAPP.msg = {};
    oAPP.data.SAPLogon = {};
    oAPP.data.SAPLogon.aSys32MsgServPort = [];

    oAPP.REMOTE = REMOTE;
    oAPP.IPCRENDERER = IPCRENDERER;
    oAPP.APP = APP;
    oAPP.CURRWIN = CURRWIN;
    oAPP.PATH = PATH;

    window.oAPP = oAPP;

    /********************************************************************
     * 상태 저장소 (UI5 JSONModel 대체) — doc 00 §5 / 플레이북 모델 shim
     *   getProperty / setProperty / refresh 시그니처 유지.
     ********************************************************************/
    const M = {
        data: {
            ServerList: [],     // SAPGUI 등록 서버 전체
            SAPLogon: {},       // 워크스페이스 폴더 트리
            SAPLogonItems: [],  // 선택 폴더의 서버 목록 (우측 테이블)
            WSLANGU: {}         // i18n 메시지 텍스트
        },
        getProperty(sPath) {
            if (!sPath || sPath === "/") {
                return this.data;
            }
            const aParts = sPath.replace(/^\//, "").split("/");
            let o = this.data;
            for (const p of aParts) {
                if (o == null) {
                    return undefined;
                }
                o = o[p];
            }
            return o;
        },
        setProperty(sPath, val) {
            const aParts = sPath.replace(/^\//, "").split("/");
            let o = this.data;
            for (let i = 0; i < aParts.length - 1; i++) {
                if (o[aParts[i]] == null) {
                    o[aParts[i]] = {};
                }
                o = o[aParts[i]];
            }
            o[aParts[aParts.length - 1]] = val;
        },
        refresh() {
            oAPP.fn.fnRenderServerTable();
        }
    };
    oAPP.model = M;

    /********************************************************************
     * i18n 텍스트 헬퍼 (메시지 키 → 텍스트, 하드코딩 금지 — doc 02 §9.3)
     ********************************************************************/
    const MSG_FALLBACK = {
        "001": "Language",
        "004": "U4A Workspace Logon Pad",
        "005": "Theme",
        "044": "About WS..",
        "204": "Sound",
        "809": "Sort",
        "810": "Ascending",
        "811": "Descending"
    };
    function T(sMsgNr) {
        const oCls = M.getProperty("/WSLANGU/ZMSG_WS_COMMON_001");
        if (oCls && typeof oCls[sMsgNr] !== "undefined" && oCls[sMsgNr] !== "") {
            return oCls[sMsgNr];
        }
        return MSG_FALLBACK[sMsgNr] || "";
    }

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid — currentColor 상속, doc 12 §6.6 G)
     *   값은 <i> HTML 문자열. 호출부는 innerHTML 로 그대로 소비.
     ********************************************************************/
    const _fa = (sName) => `<i class="fa-solid fa-${sName}"></i>`;
    const ICON = {
        min: _fa("window-minimize"),
        max: _fa("window-maximize"),
        restore: _fa("window-restore"),
        close: _fa("xmark"),
        chevron: _fa("chevron-right"),
        caret: _fa("chevron-down"),
        folder: _fa("folder"),
        gear: _fa("gear"),
        settings: _fa("gear"),
        translate: _fa("language"),
        palette: _fa("palette"),
        sound: _fa("volume-high"),
        hint: _fa("circle-info"),
        edit: _fa("pen"),
        trash: _fa("trash"),
        accept: _fa("check"),
        decline: _fa("xmark"),
        sortAsc: _fa("caret-up"),
        sortDesc: _fa("caret-down"),
        // 메시지 박스 타입별 아이콘 (Confirm/Success/Error/Warning)
        confirm: _fa("circle-question"),
        success: _fa("circle-check"),
        error: _fa("circle-xmark"),
        warning: _fa("triangle-exclamation")
    };

    /********************************************************************
     * Busy / Toast / MessageBox (UI5 BusyIndicator/Toast/MessageBox 대체)
     ********************************************************************/
    oAPP.fn.setBusyIndicator = function (sIsBusy) {
        const oDom = document.getElementById("u4aWsBusyIndicator");
        if (!oDom) {
            return;
        }
        const bBusy = (sIsBusy === "X");
        document.body.style.pointerEvents = bBusy ? "none" : "";
        oDom.dataset.busy = bBusy ? "true" : "false";
    };

    oAPP.setBusy = function (bIsBusy) {
        oAPP.fn.setBusyIndicator(bIsBusy ? "X" : "");
    };

    let _iToastTimer;
    oAPP.fn.showToast = function (sMsg) {
        let oToast = document.getElementById("u4aWsToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aWsToast";
            oToast.className = "u4a-toast";
            oToast.setAttribute("role", "alert");
            document.body.appendChild(oToast);
        }
        oToast.textContent = sMsg;
        oToast.dataset.show = "true";
        clearTimeout(_iToastTimer);
        _iToastTimer = setTimeout(() => { oToast.dataset.show = "false"; }, 3000);
    };

    // sap.m.MessageBox 대체 — 테마 토큰 소비 native <dialog>
    oAPP.fn.fnShowMessageBox = function (TYPE, sMsg, fnCallback) {
        // 설정 다이얼로그(_createFormDialog)와 동일한 .u4a-dialog 구조/스타일로 통일.
        // 중복 표시 방지 — 이전 메시지 박스 제거
        const oPrev = document.getElementById("u4aWsMsgDlg");
        if (oPrev) { oPrev.remove(); }

        // 타입별 아이콘 + 현지화 타이틀 (I18N JS 객체 — doc 02 §8)
        const oMeta = ({
            C: { icon: ICON.confirm, title: L("dlgConfirm") },
            S: { icon: ICON.success, title: L("dlgSuccess") },
            E: { icon: ICON.error, title: L("dlgError") },
            W: { icon: ICON.warning, title: L("dlgWarning") }
        })[TYPE] || { icon: "", title: "" };

        // 본문 (줄바꿈 \n 유지)
        const oBody = _el("div");
        oBody.style.whiteSpace = "pre-wrap";
        oBody.style.lineHeight = "1.45";
        oBody.textContent = sMsg;

        let oCtl;
        const _done = (sAction) => {
            oCtl.close();
            if (typeof fnCallback === "function") { fnCallback(sAction); }
        };

        // 버튼 현지화 — 확인=T("002"), 취소=T("003") (설정 다이얼로그와 동일 소스)
        const aButtons = [
            { text: T("002") || "OK", type: "emphasized", onClick: () => _done("OK") }
        ];
        if (TYPE === "C") {
            aButtons.push({ text: T("003") || "Cancel", onClick: () => _done("CANCEL") });
        }

        oCtl = _createFormDialog({
            title: oMeta.title,
            icon: oMeta.icon,
            bodyEl: oBody,
            width: "28rem",
            buttons: aButtons,
            // ESC: 확인형(C)만 취소 콜백, 그 외는 단순 닫기(원본과 동일하게 콜백 미실행)
            onCancel: (c) => {
                c.close();
                if (TYPE === "C" && typeof fnCallback === "function") { fnCallback("CANCEL"); }
            }
        });

        // 헤더 아이콘 타입별 색상용 마커 + 중복 제거용 id
        oCtl.dlg.id = "u4aWsMsgDlg";
        const oHead = oCtl.dlg.querySelector(".u4a-dialog__header");
        if (oHead) { oHead.dataset.type = TYPE; }

        // 사운드
        if (TYPE === "S") { oAPP.setSoundMsg("01"); }
        if (TYPE === "E") { oAPP.setSoundMsg("02"); }
    };

    oAPP.fn.fnPromiseError = function (oError) {
        let sMsg = (oError ? oError.toString() : "") + " \n " + (oAPP.msg.M09 || "Please contact U4A Solution Team!");
        oAPP.fn.fnShowMessageBox("E", sMsg, () => { APP.exit(); });
        oAPP.setBusy(false);
        console.error(oError);
    };

    /********************************************************************
     * SAP 사운드 (Electron/Node 자원 유지)
     ********************************************************************/
    oAPP.setSoundMsg = function (TYPE) {
        try {
            const oSettingInfo = WSUTIL.getWsSettingsInfo();
            if (oSettingInfo.globalSound !== "X") {
                return;
            }
            const sSoundRootPath = PATH.join(APPPATH, "sound", "sap");
            const oAudio = document.getElementById("u4aWsAudio");
            let sAudioPath = "";
            switch (TYPE) {
                case "01": sAudioPath = PATH.join(sSoundRootPath, 'sapmsg.wav'); break;
                case "02": sAudioPath = PATH.join(sSoundRootPath, 'saperror.wav'); break;
            }
            if (!oAudio || !oAudio.paused) {
                return;
            }
            oAudio.src = "";
            oAudio.src = sAudioPath;
            oAudio.play();
        } catch (e) { /* 사운드 실패는 무시 */ }
    };

    /********************************************************************
     * 진입 — if-globalSetting-info IPC (유지)
     ********************************************************************/
    IPCRENDERER.on("if-globalSetting-info", (events, oInfo) => {
        oAPP.data.GlobalSettings = oInfo || {};
        oAPP.data.SystemRootPath = process.env.SystemRoot;
        oAPP.fn.fnOnDeviceReady();
    });

    oAPP.fn.fnOnDeviceReady = function () {
        // 글로벌 설정의 UI5 테마명 → 5종 data-theme 키 매핑 (doc 02 §9.3 step5)
        try {
            const oTheme = oAPP.data.GlobalSettings.theme;
            const sUi5Theme = (oTheme && oTheme.value) ? oTheme.value : SETTINGS.defaultTheme;
            U4ATheme.apply(sUi5Theme);
        } catch (e) {
            U4ATheme.apply("horizon_white");
        }
        oAPP.fn.fnOnMainStart();
    };

    /********************************************************************
     * 프로그램 시작
     ********************************************************************/
    oAPP.fn.fnOnMainStart = async function () {

        oAPP.setBusy(true);

        // WS Global 메시지 텍스트
        await oAPP.fn.fnWsGlobalMsgList();

        // 작업표시줄 메뉴 / 현재 창 이벤트 / OS 닫기 가드
        _createTaskBarMenu();
        _attachCurrentWindowEvents();
        _attachWindowCloseGuard();

        // i18n 모델 구성
        await oAPP.fn.fnOnInitModeling();

        // 셸(타이틀바·서브헤더·스플리터) 렌더
        oAPP.fn.fnRenderShell();

        // /etc/services 메시지 서버 포트 추출
        await _getMsgServPortList();

        // 레지스트리 SAPLogon → 서버 목록 화면 출력
        await oAPP.fn.fnOnListupSapLogon();

        // U4A EDU 연동 Named Pipe 서버 (유지)
        try {
            await oU4ASERV.createServer();
        } catch (e) {
            console.error("[Named Pipe] createServer 실패:", e);
        }

        oAPP.setBusy(false);
        CURRWIN.focus();

    };

    /********************************************************************
     * WS Global 메시지 텍스트 (Electron/Node 자원 유지)
     ********************************************************************/
    oAPP.fn.fnWsGlobalMsgList = async function () {
        try {
            const sWsLangu = await WSUTIL.getWsLanguAsync();
            const G = (nr) => WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", nr);
            oAPP.msg.M01 = G("007"); oAPP.msg.M02 = G("008"); oAPP.msg.M03 = G("009");
            oAPP.msg.M04 = G("010"); oAPP.msg.M05 = G("011"); oAPP.msg.M06 = G("012");
            oAPP.msg.M07 = G("013"); oAPP.msg.M08 = G("014"); oAPP.msg.M09 = G("015");
            oAPP.msg.M10 = G("016"); oAPP.msg.M11 = G("017"); oAPP.msg.M12 = G("018");
            oAPP.msg.M13 = G("019"); oAPP.msg.M14 = G("020"); oAPP.msg.M15 = G("080");
            oAPP.msg.M16 = G("206"); oAPP.msg.M270 = G("270"); oAPP.msg.M271 = G("271");
            oAPP.msg.M048 = G("048"); oAPP.msg.M049 = G("049"); // 프로그램 종료 확인 문구
            oAPP.msg.M017 = "A problem occurred while saving the server settings.";
        } catch (e) {
            // 메시지 조회 실패 시 영문 폴백 (display 차단 방지)
            console.warn("[fnWsGlobalMsgList] 메시지 조회 실패, 폴백 사용:", e);
            oAPP.msg.M03 = "Please Check the SAPGUI is Installed and whether saved Server exists!";
            oAPP.msg.M04 = "Server information does not exist in the SAPGUI logon file.";
            oAPP.msg.M05 = "No SAPGUI version information.";
            oAPP.msg.M06 = "SAPGUI version information not Found.";
            oAPP.msg.M07 = "Not supported lower than SAPGUI 770 versions.";
            oAPP.msg.M08 = "Please upgrade SAPGUI 770 or Higher.";
            oAPP.msg.M09 = "Please contact U4A Solution Team!";
            oAPP.msg.M11 = "Not exists save file.";
            oAPP.msg.M12 = "Server List file not exists.";
            oAPP.msg.M16 = "Shut Down";
            oAPP.msg.M048 = "Unsaved data will be lost.";
            oAPP.msg.M049 = "Are you sure you want to exit the Program?";
            oAPP.msg.M017 = "A problem occurred while saving the server settings.";
        }
    };

    /********************************************************************
     * i18n 모델 구성 (WSLANGU 텍스트 → 상태 저장소)
     ********************************************************************/
    oAPP.fn.fnOnInitModeling = async function () {
        try {
            const aMsgTxtList = _getModelBindMsgTxtList();
            const oLanguTextResult = WSUTIL.getWsMsgClsModelData(aMsgTxtList);
            if (oLanguTextResult.RETCD === "E") {
                return;
            }
            M.setProperty("/WSLANGU", oLanguTextResult.RTDATA);
        } catch (e) {
            console.warn("[fnOnInitModeling] i18n 모델 구성 실패, 폴백 사용:", e);
        }
    };

    function _getModelBindMsgTxtList() {
        const aNr = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009",
            "010", "011", "012", "013", "014", "015", "016", "017", "018", "019", "020",
            "043", "044", "048", "049", "080", "204", "205", "206", "270", "271", "809", "810", "811"];
        return aNr.map(nr => ({ ARBGB: "ZMSG_WS_COMMON_001", MSGNR: nr }));
    }

    /********************************************************************
     * /etc/services 메시지 서버 포트 추출 (Electron/Node 자원 유지)
     ********************************************************************/
    function _getSys32Services() {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            const servicePath = PATH.join(oAPP.data.SystemRootPath, 'System32', 'Drivers', 'etc', 'services');
            const cmd = `findstr "^sapms*" ${servicePath}`;
            exec(cmd, (err, stdout) => {
                if (err) {
                    return resolve({ RETCD: "E" });
                }
                return resolve({ RETCD: "S", RDATA: stdout });
            });
        });
    }

    async function _getMsgServPortList() {
        try {
            const oSys32Services = await _getSys32Services();
            if (oSys32Services.RETCD === "E") {
                return;
            }
            const lines = oSys32Services.RDATA.split('\n');
            const sapmsEntries = lines
                .filter(line => line.trim().startsWith('sapms'))
                .map(line => {
                    const match = line.match(/^sapms(\w+)\s+(\d+)\/tcp/);
                    return match ? { SYSID: match[1], PORT: match[2] } : null;
                })
                .filter(entry => entry !== null);
            oAPP.data.SAPLogon.aSys32MsgServPort = sapmsEntries;
        } catch (e) {
            console.warn("[_getMsgServPortList] 실패:", e);
        }
    }

    /********************************************************************
     * 레지스트리 SAPLogon → SAPUILandscape.xml 읽기 (Electron/Node 유지)
     ********************************************************************/
    oAPP.fn.fnOnListupSapLogon = async function () {

        // 모델 clear
        M.setProperty("/SAPLogon", {});
        M.setProperty("/ServerList", []);
        M.setProperty("/SAPLogonItems", []);

        let oResult;
        try {
            oResult = await oAPP.fn.fnGetRegInfoForSAPLogon();
        } catch (error) {
            return oAPP.fn.fnPromiseError(error);
        }
        await oAPP.fn.fnGetRegInfoForSAPLogonThen(oResult);
    };

    oAPP.fn.fnGetRegInfoForSAPLogon = function () {
        return new Promise((resolve, reject) => {
            const sSaplogonPath = SETTINGS.regPaths.saplogon;
            const sErrMsg = oAPP.msg.M03;
            REGEDIT.list(sSaplogonPath, (err, result) => {
                if (err) {
                    reject(sErrMsg);
                    return;
                }
                const oSapLogon = result[sSaplogonPath];
                if (typeof oSapLogon === "undefined" || oSapLogon.exists === false) {
                    reject(sErrMsg);
                    return;
                }
                resolve(oSapLogon.values);
            });
        });
    };

    oAPP.fn.fnGetRegInfoForSAPLogonThen = function (oResult) {
        return new Promise(async (resolve) => {
            const oLandscapeFile = oResult.LandscapeFile;
            const sErrMsg = oAPP.msg.M03;

            if (typeof oLandscapeFile === "undefined") {
                oAPP.setBusy(false);
                oAPP.fn.fnShowMessageBox("E", sErrMsg);
                return;
            }

            const sLandscapeFilePath = oLandscapeFile.value;

            if (!FS.existsSync(sLandscapeFilePath)) {
                oAPP.setBusy(false);
                oAPP.fn.fnShowMessageBox("E", sErrMsg);
                return;
            }

            // SAPUILandscape.xml 변경 감지 (1초 디바운스 후 자동 갱신)
            if (oAPP.oSapLogonWatch) {
                oAPP.oSapLogonWatch.close();
                delete oAPP.oSapLogonWatch;
            }
            oAPP.oSapLogonWatch = FS.watch(sLandscapeFilePath, oAPP.fn.fnSapLogonFileChange);

            let oReadResult;
            try {
                oReadResult = await oAPP.fn.fnReadSAPLogonData("LandscapeFile", sLandscapeFilePath);
            } catch (error) {
                oAPP.fn.fnPromiseError(error);
                return;
            }

            await oAPP.fn.fnReadSAPLogonDataThen(oReadResult);
            resolve();
        });
    };

    oAPP.fn.fnSapLogonFileChange = function () {
        if (typeof oAPP.iSapLogonChangeTimeout !== "undefined") {
            clearTimeout(oAPP.iSapLogonChangeTimeout);
            delete oAPP.iSapLogonChangeTimeout;
        }
        oAPP.iSapLogonChangeTimeout = setTimeout(function () {
            clearTimeout(oAPP.iSapLogonChangeTimeout);
            delete oAPP.iSapLogonChangeTimeout;
            console.log("[FS.watch] SAP Landscape XML File Change Detected.");
            oAPP.fn.fnOnListupSapLogon();
        }, 1000);
    };

    oAPP.fn.fnReadSAPLogonData = function (sFileName, sFilePath) {
        return new Promise((resolve, reject) => {
            FS.readFile(sFilePath, { "encoding": "utf8" }, (err, data) => {
                if (err) {
                    reject(err.toString());
                    return;
                }
                const xmlOption = { ignoreComment: true, ignoreDeclaration: true, compact: true, spaces: 4 };
                const sResult = XMLJS.xml2json(data, xmlOption);
                const oResult = JSON.parse(sResult);
                resolve({ "fileName": sFileName, "Result": oResult.Landscape });
            });
        });
    };

    oAPP.fn.fnReadSAPLogonDataThen = function (oResult) {
        return new Promise(async (resolve) => {

            // 설치된 SAPGUI 버전 체크 (PowerShell)
            const oCheckVer = await oAPP.fn.fnCheckSapguiVersion();
            if (oCheckVer.RETCD === "E") {
                oAPP.fn.fnShowMessageBox("E", oCheckVer.RTMSG, () => { APP.exit(); });
                console.error(oCheckVer.RTMSG);
                oAPP.setBusy(false);
                return;
            }

            // 레지스트리에 SAPGUI 버전/경로 저장
            try {
                const oRegPaths = SETTINGS.regPaths;
                const Regedit = parent.require('regedit').promisified;
                await Regedit.createKey([oRegPaths.GUIVer]);
                await Regedit.createKey([oRegPaths.cSession]);
                await Regedit.createKey([oRegPaths.GUIPath]);
                await Regedit.putValue({
                    "HKCU\\SOFTWARE\\U4A\\WS\\GUIVer": { "GUIVer": { value: oCheckVer.RTVER, type: "REG_DEFAULT" } }
                });
                await Regedit.putValue({
                    "HKCU\\SOFTWARE\\U4A\\WS\\GUIPath": { "GUIVer": { value: oCheckVer.RTPATH, type: "REG_DEFAULT" } }
                });
            } catch (e) {
                console.warn("[fnReadSAPLogonDataThen] 레지스트리 저장 실패:", e);
            }

            // Landscape 정보 저장
            oAPP.data.SAPLogon[oResult.fileName] = oResult.Result;

            // 서버 전체 목록 빌드 (/ServerList)
            const oLogonResult = oAPP.fn.fnSetSAPLogonLandscapeList();
            if (oLogonResult.RETCD === "E") {
                oAPP.fn.fnShowMessageBox("E", oLogonResult.RTMSG);
                console.error(oLogonResult.RTMSG);
                oAPP.setBusy(false);
                return;
            }

            // 워크스페이스 폴더 트리 빌드 (/SAPLogon)
            oAPP.fn.fnCreateWorkspaceTree();

            // 트리 렌더 + 마지막 선택 노드 복원
            oAPP.fn.fnRenderTree();
            await oAPP.fn.fnRestoreLastSelectedNode();

            resolve();
        });
    };

    /********************************************************************
     * SAPGUI 버전 체크 (PowerShell — Electron/Node 자원 유지)
     ********************************************************************/
    function _checkSapGuiInfoShell() {
        return new Promise((resolve) => {
            let sPsRoot = PS_ROOT_PATH;
            if (!APP.isPackaged) {
                sPsRoot = "C:\\";
            }
            const ps = SPAWN("powershell.exe", [
                "-ExecutionPolicy", "Bypass", "-File", PS_PATH.GET_SAPGUI_INFO
            ], { cwd: sPsRoot });

            let aShellConsole = [];

            ps.stdout.on("data", (data) => {
                if (!data || !data.toString().trim()) {
                    return;
                }
                const sLog = `${data.toString()}`;
                console.log(sLog);
                const aSplit = sLog.split(/\r?\n/).filter(e => e !== "");
                aShellConsole = aShellConsole.concat(aSplit);
            });

            ps.stderr.on("data", (data) => {
                const sLog = `${data.toString()}`;
                console.error(sLog);
                if (!ps.killed) {
                    ps.kill(9);
                }
                return resolve({ SUBRC: 999, LOG: sLog });
            });

            ps.on("close", (code) => {
                if (!ps.killed) {
                    ps.kill(9);
                }
                let sSapGuiVer = "";
                const oFoundVer = aShellConsole.find(item => item.includes("SAPGUI_VER|"));
                if (oFoundVer) {
                    sSapGuiVer = (oFoundVer.split("SAPGUI_VER|")[1] || "").trim();
                }
                let sSapGuiPath = "";
                const oFoundPath = aShellConsole.find(item => item.includes("SAPGUI_PATH|"));
                if (oFoundPath) {
                    sSapGuiPath = (oFoundPath.split("SAPGUI_PATH|")[1] || "").trim();
                }
                return resolve({ SUBRC: code, RDATA: { SAPGUI_VER: sSapGuiVer, SAPGUI_PATH: sSapGuiPath } });
            });

            ps.on("error", (err) => {
                console.error("[_checkSapGuiInfoShell] PowerShell 실행 오류:", err);
                resolve({ SUBRC: 999, LOG: err.toString() });
            });
        });
    }

    oAPP.fn.fnCheckSapguiVersion = function () {
        return new Promise(async (resolve) => {
            const oRES = { RETCD: "E" };
            const oCheckSapVer = await _checkSapGuiInfoShell();

            if (oCheckSapVer.SUBRC === 8) {
                oRES.RTMSG = oAPP.msg.M04;
                return resolve(oRES);
            }
            const sSapGuiVer = oCheckSapVer.RDATA && oCheckSapVer.RDATA.SAPGUI_VER;
            const sSapGuiPath = (oCheckSapVer.RDATA && oCheckSapVer.RDATA.SAPGUI_PATH) || "";

            if (!sSapGuiVer) {
                oRES.RTMSG = oAPP.msg.M05;
                return resolve(oRES);
            }
            const parseVer = parseInt(sSapGuiVer, 10);
            if (isNaN(parseVer)) {
                oRES.RTMSG = oAPP.msg.M06;
                return resolve(oRES);
            }
            if (parseVer < SAPGUIVER) {
                oRES.RTMSG = oAPP.msg.M07 + " \n " + oAPP.msg.M08;
                return resolve(oRES);
            }
            oRES.RETCD = "S";
            oRES.RTVER = sSapGuiVer;
            oRES.RTPATH = sSapGuiPath;
            return resolve(oRES);
        });
    };

    /********************************************************************
     * SAPUILandscape.xml → 서버 전체 목록(/ServerList) (Node 로직 유지)
     ********************************************************************/
    oAPP.fn.fnSetSAPLogonLandscapeList = function () {

        const oErr = { RETCD: "E", RTMSG: oAPP.msg.M04 };
        const oSucc = { RETCD: "S", RTMSG: "" };

        const oSAPLogonLandscape = oAPP.data.SAPLogon;
        if (oSAPLogonLandscape == null) { return oErr; }

        const oLandscapeFile = oSAPLogonLandscape.LandscapeFile;
        if (oLandscapeFile == null || !oLandscapeFile.Services) { return oErr; }

        const aServices0 = oLandscapeFile.Services.Service;
        if (!aServices0) { return oErr; }

        oAPP.data.SAPLogon.aServices = Array.isArray(aServices0) ? aServices0 : [aServices0];

        if (oLandscapeFile.Routers) {
            oAPP.data.SAPLogon.aRouters = Array.isArray(oLandscapeFile.Routers.Router)
                ? oLandscapeFile.Routers.Router : [oLandscapeFile.Routers.Router];
        }
        if (oLandscapeFile.Messageservers) {
            oAPP.data.SAPLogon.aMessageservers = Array.isArray(oLandscapeFile.Messageservers.Messageserver)
                ? oLandscapeFile.Messageservers.Messageserver : [oLandscapeFile.Messageservers.Messageserver];
        }

        const aBindData = [];
        const aServices = oAPP.data.SAPLogon.aServices;

        for (let i = 0; i < aServices.length; i++) {

            const oService = aServices[i];
            const oServiceAttr = oService._attributes;
            if (oServiceAttr == null) { continue; }

            // shortcut 제외
            if (oServiceAttr.shortcut && oServiceAttr.shortcut === "1") { continue; }

            // mode 1 → server "host:port"
            if (oServiceAttr.mode && oServiceAttr.mode === "1") {
                const aServer = oServiceAttr.server.split(":");
                oServiceAttr.host = aServer[0];
                oServiceAttr.port = aServer[1];
            }

            // 라우터 join
            if (oServiceAttr.routerid && oAPP.data.SAPLogon.aRouters) {
                const oRouter = oAPP.data.SAPLogon.aRouters.find(e => e._attributes.uuid === oServiceAttr.routerid);
                oServiceAttr.router = (oRouter == null ? {} : oRouter._attributes);
            }

            // 메시지 서버 join
            if (oServiceAttr.msid && oAPP.data.SAPLogon.aMessageservers) {
                const oMsgSvr = oAPP.data.SAPLogon.aMessageservers.find(e => e._attributes.uuid === oServiceAttr.msid);
                oServiceAttr.msgsvr = (oMsgSvr == null ? {} : oMsgSvr._attributes);
                oServiceAttr.host = oServiceAttr.server;
                oServiceAttr.port = oServiceAttr.msgsvr.port;

                if (!oServiceAttr.port && Array.isArray(oAPP.data.SAPLogon.aSys32MsgServPort)) {
                    const oPortInfo = oAPP.data.SAPLogon.aSys32MsgServPort.find(e => e.SYSID === oServiceAttr.systemid);
                    if (oPortInfo) {
                        oServiceAttr.port = oPortInfo.PORT;
                        oServiceAttr.msgsvr.port = oPortInfo.PORT;
                    }
                }
                oServiceAttr.msgsvr.port = oServiceAttr.msgsvr.port ? oServiceAttr.msgsvr.port : "3600";
            }

            // instance no
            if (oServiceAttr.port) {
                oServiceAttr.insno = oServiceAttr.port.substring(2, 4);
            }

            aBindData.push(oServiceAttr);
        }

        M.setProperty("/ServerList", aBindData);
        return oSucc;
    };

    /********************************************************************
     * 워크스페이스 폴더 트리 빌드 (/SAPLogon) + 정렬
     ********************************************************************/
    oAPP.fn.fnCreateWorkspaceTree = function () {
        const aWorkSpace = oAPP.data.SAPLogon.LandscapeFile.Workspaces.Workspace;
        const aWs = Array.isArray(aWorkSpace) ? aWorkSpace : [aWorkSpace];
        const oWorkSpace = {
            Node: [{
                _attributes: { name: "Workspace", uuid: "WorkspaceROOT" },
                Node: aWs
            }]
        };
        oWorkSpace.Node = oAPP.fn.fnWorkSpaceSort(oWorkSpace.Node);
        M.setProperty("/SAPLogon", oWorkSpace);
    };

    oAPP.fn.fnWorkSpaceSort = function (aNode) {
        if (!aNode || aNode.length === 0) {
            return aNode;
        }
        if (aNode.length >= 2) {
            aNode = aNode.sort((a, b) => {
                const keyA = a._attributes.name.toUpperCase();
                const keyB = b._attributes.name.toUpperCase();
                if (keyA < keyB) { return -1; }
                if (keyA > keyB) { return 1; }
                return 0;
            });
        }
        for (let i = 0; i < aNode.length; i++) {
            const oNode = aNode[i];
            if (oNode.Node) {
                const aChild = Array.isArray(oNode.Node) ? oNode.Node : [oNode.Node];
                oNode.Node = oAPP.fn.fnWorkSpaceSort(aChild);
            }
        }
        return aNode;
    };

    /********************************************************************
     * 셸 렌더 — 타이틀바 / 서브헤더 / 스플리터 (UI5 App/Page/Bar 대체)
     ********************************************************************/
    oAPP.fn.fnRenderShell = function () {

        const oContent = document.getElementById("content");
        oContent.innerHTML = "";

        const oPage = _el("div", "u4a-page");

        // ── 커스텀 타이틀바 (창 제어) ──
        const oTitlebar = _el("header", "u4a-titlebar");
        const oLogo = _el("img", "u4a-titlebar__logo");
        oLogo.src = _toFileUrl(PATHINFO.WS_LOGO);
        oLogo.alt = "U4A";
        oLogo.addEventListener("error", () => { oLogo.style.visibility = "hidden"; });
        const oTitle = _el("span", "u4a-titlebar__title", "U4A Workspace");
        const oSpacer = _el("div", "u4a-titlebar__spacer");

        const oMinBtn = _winBtn(ICON.min, "Minimize", () => CURRWIN.minimize());
        const oMaxBtn = _winBtn(CURRWIN.isMaximized() ? ICON.restore : ICON.max, "Maximize", () => {
            if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); }
        });
        oMaxBtn.id = "u4aWsMaxBtn";
        const oCloseBtn = _winBtn(ICON.close, "Close", oAPP.fn.fnRequestClose);
        oCloseBtn.classList.add("u4a-winbtn--close");

        oTitlebar.append(oLogo, oTitle, oSpacer, oMinBtn, oMaxBtn, oCloseBtn);

        // ── 서브헤더 (Logon Pad 타이틀 + 설정 메뉴) ──
        const oSubBar = _el("div", "u4a-bar");
        const oSubTitle = _el("span", "u4a-bar__title", T("004"));
        oAPP.attr._elSubTitle = oSubTitle;
        const oSubSpacer = _el("div", "u4a-bar__spacer");

        const oSettingsBtn = _el("button", "u4a-btn-icon");
        oSettingsBtn.title = L("settings");
        oSettingsBtn.setAttribute("aria-haspopup", "true");
        oSettingsBtn.innerHTML = ICON.gear;
        oSettingsBtn.addEventListener("click", (ev) => oAPP.fn.fnOpenSettingsMenu(ev));
        oSubBar.append(oSubTitle, oSubSpacer, oSettingsBtn);

        // ── 본문: 스플리터 (좌 트리 / 우 테이블) ──
        const oBody = _el("div", "u4a-page__body");
        const oSplitter = _el("div", "u4a-splitter");

        const oPaneLeft = _el("div", "u4a-splitter__pane");
        oPaneLeft.id = "u4aWsTreePane";
        oPaneLeft.style.flex = "0 0 30%";

        const oBar = _el("div", "u4a-splitter__bar");
        oBar.setAttribute("role", "separator");
        _attachSplitterDrag(oBar, oPaneLeft);

        const oPaneRight = _el("div", "u4a-splitter__pane");
        oPaneRight.id = "u4aWsTablePane";
        oPaneRight.style.flex = "1 1 auto";

        oSplitter.append(oPaneLeft, oBar, oPaneRight);
        oBody.appendChild(oSplitter);

        oPage.append(oTitlebar, oSubBar, oBody);
        oContent.appendChild(oPage);

        // 초기 빈 테이블
        oAPP.fn.fnRenderServerTable();

        // 페이드 인
        setTimeout(() => { oContent.dataset.show = "true"; }, 50);
    };

    // 현재 WS 언어 코드 (KO/EN) — GlobalSettings 우선, 없으면 ws_settings.json
    function _getCurrentWsLangu() {
        try {
            const oG = oAPP.data.GlobalSettings && oAPP.data.GlobalSettings.language;
            if (oG && oG.value) {
                return String(oG.value).toUpperCase();
            }
            const oS = WSUTIL.getWsSettingsInfo();
            return String((oS && oS.globalLanguage) || "EN").toUpperCase();
        } catch (e) {
            return "EN";
        }
    }

    /**
     * 서버리스트 화면 전용 i18n (doc 02 §8: "JS 메시지 객체" 방식 허용).
     * WSUTIL 메시지 클래스에 키가 없는 라벨(컬럼 헤더/버튼/상태 등)을 현지화한다.
     * 언어 전환 시 화면 텍스트가 실제로 바뀌어 KO/EN 을 식별할 수 있게 한다.
     */
    const I18N = {
        EN: {
            status: "STATUS", serverName: "SERVER NAME", sid: "SID", host: "HOST(Or IP)",
            sno: "SNO", settingsCol: "Settings", settings: "Settings",
            edit: "Edit", del: "Delete", active: "Active", inactive: "Inactive",
            noData: "No data", selectServer: "Please select a server first.",
            dlgConfirm: "Confirm", dlgSuccess: "Success", dlgError: "Error", dlgWarning: "Warning"
        },
        KO: {
            status: "상태", serverName: "서버 이름", sid: "시스템 ID", host: "호스트(또는 IP)",
            sno: "인스턴스", settingsCol: "설정", settings: "설정",
            edit: "편집", del: "삭제", active: "활성", inactive: "비활성",
            noData: "데이터 없음", selectServer: "서버를 먼저 선택하세요.",
            dlgConfirm: "확인", dlgSuccess: "성공", dlgError: "오류", dlgWarning: "경고"
        }
    };
    function L(sKey) {
        const oDict = I18N[_getCurrentWsLangu()] || I18N.EN;
        return (oDict[sKey] != null) ? oDict[sKey] : (I18N.EN[sKey] != null ? I18N.EN[sKey] : sKey);
    }

    // 언어 변경 후 화면 텍스트(UI 라벨) 갱신 — 트리 폴더명(XML 데이터)은 대상 아님
    oAPP.fn.fnRefreshShellTexts = function () {
        // 서브헤더 타이틀 (WSUTIL 메시지)
        if (oAPP.attr._elSubTitle) {
            oAPP.attr._elSubTitle.textContent = T("004");
        }
        // 서버 테이블(헤더/버튼/상태/no-data) 재렌더 → 현지화 반영
        oAPP.fn.fnRenderServerTable();
    };

    /********************************************************************
     * 좌측 워크스페이스 트리 렌더 (UI5 TreeTable 대체)
     ********************************************************************/
    oAPP.fn.fnRenderTree = function () {
        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane) { return; }
        oPane.innerHTML = "";

        const oRoot = _el("ul", "u4a-tree");
        oRoot.setAttribute("role", "tree");

        const oSAPLogon = M.getProperty("/SAPLogon");
        const aNode = (oSAPLogon && oSAPLogon.Node) ? oSAPLogon.Node : [];

        let iRowOdd = { v: 0 };
        for (const oNode of aNode) {
            _renderTreeNode(oRoot, oNode, 0, true, iRowOdd);
        }
        oPane.appendChild(oRoot);
    };

    function _renderTreeNode(oParentUl, oNode, iLevel, bExpanded, iRowOdd) {
        const oAttr = oNode._attributes || {};
        const aChildNodes = oNode.Node ? (Array.isArray(oNode.Node) ? oNode.Node : [oNode.Node]) : [];
        const bHasChild = aChildNodes.length > 0;

        const oLi = _el("li");
        oLi.setAttribute("role", "treeitem");

        const oRow = _el("div", "u4a-tree__row");
        oRow.style.paddingLeft = (0.5 + iLevel * 1.1) + "rem";
        oRow.dataset.odd = (iRowOdd.v % 2 === 1) ? "true" : "false";
        iRowOdd.v++;
        oRow.tabIndex = 0;
        oRow._nodeData = oNode;
        if (bHasChild) {
            oRow.setAttribute("aria-expanded", bExpanded ? "true" : "false");
        }

        // 토글(셰브론)
        const oToggle = _el("button", "u4a-tree__toggle");
        oToggle.innerHTML = ICON.chevron;
        if (!bHasChild) {
            oToggle.classList.add("u4a-tree__toggle--leaf");
        }
        oToggle.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const oChildUl = oLi.querySelector(":scope > ul");
            if (!oChildUl) { return; }
            const bNowOpen = oRow.getAttribute("aria-expanded") === "true";
            oRow.setAttribute("aria-expanded", bNowOpen ? "false" : "true");
            oChildUl.hidden = bNowOpen;
        });

        const oIcon = _el("span", "u4a-tree__icon");
        oIcon.innerHTML = ICON.folder;

        // 트리 라벨은 SAPUILandscape.xml 의 폴더명(사용자 데이터) — 현지화 대상 아님
        const oLabel = _el("span", "u4a-tree__label", oAttr.name || "");

        oRow.append(oToggle, oIcon, oLabel);

        // 선택
        oRow.addEventListener("click", () => oAPP.fn.fnSelectTreeNode(oRow));
        oRow.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                oAPP.fn.fnSelectTreeNode(oRow);
            }
        });

        oLi.appendChild(oRow);

        if (bHasChild) {
            const oChildUl = _el("ul");
            oChildUl.setAttribute("role", "group");
            oChildUl.hidden = !bExpanded;
            // 루트(level0)와 그 하위(level1)까지 펼침
            for (const oChild of aChildNodes) {
                _renderTreeNode(oChildUl, oChild, iLevel + 1, iLevel < 1, iRowOdd);
            }
            oLi.appendChild(oChildUl);
        }

        oParentUl.appendChild(oLi);
    }

    /********************************************************************
     * 트리 노드 선택 → 우측 서버 목록 필터 (UI5 rowSelectionChange 대체)
     ********************************************************************/
    oAPP.fn.fnSelectTreeNode = function (oRow) {
        // 이전 선택 해제
        const oPane = document.getElementById("u4aWsTreePane");
        if (oPane) {
            const oPrev = oPane.querySelector('.u4a-tree__row[aria-selected="true"]');
            if (oPrev) { oPrev.removeAttribute("aria-selected"); }
        }
        oRow.setAttribute("aria-selected", "true");

        // 우측 서버 리스트 선택 해제
        oAPP.fn.fnServerListUnselect();

        oAPP.fn.fnPressWorkSpaceTreeItem(oRow._nodeData);
    };

    oAPP.fn.fnServerListUnselect = function () {
        oAPP.attr._selectedServer = null;
        const oTbl = document.getElementById(SERVER_TBL_ID);
        if (!oTbl) { return; }
        const oSel = oTbl.querySelector('tr[aria-selected="true"]');
        if (oSel) { oSel.removeAttribute("aria-selected"); }
    };

    function _selectServerRow(oTr, oItem, bSkipPersist) {
        oAPP.fn.fnServerListUnselect();
        oTr.setAttribute("aria-selected", "true");
        oAPP.attr._selectedServer = { data: oItem, tr: oTr };
        // 마지막 선택 서버 키 기억 (앱 재시작 후 복원용). 복원 중(bSkipPersist)에는 재저장 생략.
        oAPP.attr._lastSelectedServerKey = (oItem && oItem.uuid) || "";
        if (!bSkipPersist && oAPP.attr._lastSelectedServerKey) {
            oAPP.fn.setRegistryLastSelectedServerKey(oAPP.attr._lastSelectedServerKey);
        }
    }

    // 현재 선택 폴더 기준으로 우측 서버 목록 재조회 (저장/삭제 후 갱신)
    oAPP.fn.fnRefreshCurrentFolder = function () {
        const oNode = oAPP.attr._selectedTreeNodeData;
        if (oNode) {
            oAPP.fn.fnPressWorkSpaceTreeItem(oNode);
        } else {
            oAPP.fn.fnRenderServerTable();
        }
    };

    oAPP.fn.fnPressWorkSpaceTreeItem = async function (oNodeData) {

        oAPP.attr._selectedTreeNodeData = oNodeData;

        M.setProperty("/SAPLogonItems", []);

        if (!oNodeData || !oNodeData._attributes) {
            oAPP.fn.fnRenderServerTable();
            return;
        }

        const sUUID = oNodeData._attributes.uuid;

        // 마지막 선택 노드 키 저장
        await oAPP.fn.setRegistryLastSelectedNodeKey(sUUID);

        // 폴더의 서버(Item) 목록
        let aItem = oNodeData.Item;
        if (!aItem) {
            oAPP.fn.fnRenderServerTable();
            return;
        }
        if (!Array.isArray(aItem)) {
            aItem = [aItem];
        }

        const aServerList = M.getProperty("/ServerList") || [];
        const aItemList = [];

        for (const oItem of aItem) {
            const sServiceid = oItem._attributes && oItem._attributes.serviceid;
            if (!sServiceid) { continue; }
            const oFindItem = aServerList.find(e => e.uuid === sServiceid);
            if (!oFindItem) { continue; }
            // deep clone (jQuery.extend 대체)
            aItemList.push(_deepClone(oFindItem));
        }

        // name 오름차순 정렬
        aItemList.sort((a, b) => a.name.localeCompare(b.name));

        M.setProperty("/SAPLogonItems", aItemList);

        // 기 저장된 서버 정보 동기화 (ISSAVE 플래그)
        _syncSavedServerInfo(M);

        oAPP.fn.fnRenderServerTable();
    };

    /********************************************************************
     * 마지막 선택 노드 키 저장/복원 (레지스트리 — Electron/Node 유지)
     ********************************************************************/
    oAPP.fn.setRegistryLastSelectedNodeKey = async function (sSelectedNodeKey) {
        try {
            const sSettingsPath = SETTINGS.regPaths.LogonSettings;
            const oRegData = {};
            oRegData[sSettingsPath] = {
                "LastSelectedNodeKey": { value: sSelectedNodeKey, type: "REG_SZ" }
            };
            const RegeditPromisified = parent.require('regedit').promisified;
            await RegeditPromisified.putValue(oRegData);
        } catch (e) {
            console.warn("[setRegistryLastSelectedNodeKey] 실패:", e);
        }
    };

    // 마지막 선택 서버(행) 키 저장 — 노드 키와 같은 레지스트리 경로에 별도 값으로 보관.
    oAPP.fn.setRegistryLastSelectedServerKey = async function (sServerKey) {
        try {
            const sSettingsPath = SETTINGS.regPaths.LogonSettings;
            const oRegData = {};
            oRegData[sSettingsPath] = {
                "LastSelectedServerKey": { value: sServerKey, type: "REG_SZ" }
            };
            const RegeditPromisified = parent.require('regedit').promisified;
            await RegeditPromisified.putValue(oRegData);
        } catch (e) {
            console.warn("[setRegistryLastSelectedServerKey] 실패:", e);
        }
    };

    oAPP.fn.fnRestoreLastSelectedNode = async function () {
        let sLastKey = "";
        try {
            const sLogonSettingsPath = SETTINGS.regPaths.LogonSettings;
            const oResult = await _getRegeditList([sLogonSettingsPath]);
            if (oResult.RETCD === "S") {
                const oRegData = oResult.RTDATA[sLogonSettingsPath];
                if (oRegData && oRegData.values && oRegData.values["LastSelectedNodeKey"]) {
                    sLastKey = oRegData.values["LastSelectedNodeKey"].value;
                }
                // 서버(행) 선택 복원용 키도 같은 타이밍에 읽어 메모리에 보관
                if (oRegData && oRegData.values && oRegData.values["LastSelectedServerKey"]) {
                    oAPP.attr._lastSelectedServerKey = oRegData.values["LastSelectedServerKey"].value;
                }
            }
        } catch (e) { /* 무시 */ }

        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane) { return; }

        // 저장된 키의 행을 찾는다.
        let oTarget = null;
        if (sLastKey) {
            const aRows = oPane.querySelectorAll(".u4a-tree__row");
            for (const oRow of aRows) {
                const oND = oRow._nodeData;
                if (oND && oND._attributes && oND._attributes.uuid === sLastKey) {
                    oTarget = oRow;
                    break;
                }
            }
        }
        // 없으면 루트(Workspace) 노드 선택
        if (!oTarget) {
            oTarget = oPane.querySelector(".u4a-tree__row");
        }
        if (oTarget) {
            // 선택 노드까지 부모 펼치기
            let oParentLi = oTarget.closest("li");
            while (oParentLi) {
                const oParentUl = oParentLi.parentElement;
                if (oParentUl && oParentUl.classList.contains("u4a-tree")) { break; }
                const oOwnerLi = oParentUl ? oParentUl.closest("li") : null;
                if (oOwnerLi) {
                    const oOwnerRow = oOwnerLi.querySelector(":scope > .u4a-tree__row");
                    const oOwnerUl = oOwnerLi.querySelector(":scope > ul");
                    if (oOwnerRow && oOwnerUl) {
                        oOwnerRow.setAttribute("aria-expanded", "true");
                        oOwnerUl.hidden = false;
                    }
                }
                oParentLi = oOwnerLi;
            }
            oTarget.scrollIntoView({ block: "nearest" });
            oAPP.fn.fnSelectTreeNode(oTarget);
        }
    };

    /********************************************************************
     * 우측 서버 리스트 테이블 렌더 (UI5 sap.m.Table 대체)
     ********************************************************************/
    oAPP.fn.fnRenderServerTable = function () {
        const oPane = document.getElementById("u4aWsTablePane");
        if (!oPane) { return; }
        oPane.innerHTML = "";
        oAPP.attr._selectedServer = null;

        // 헤더 툴바 (Edit / Delete — fnGetSAPLogonListTableToolbar 대체)
        const oToolbar = _el("div", "u4a-toolbar");
        const oEditBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oEditBtn.innerHTML = ICON.edit + "<span>" + _esc(L("edit")) + "</span>";
        oEditBtn.title = L("edit");
        oEditBtn.addEventListener("click", () => oAPP.fn.fnPressEdit());
        const oDelBtn = _el("button", "u4a-btn u4a-btn--negative");
        oDelBtn.innerHTML = ICON.trash + "<span>" + _esc(L("del")) + "</span>";
        oDelBtn.title = L("del");
        oDelBtn.addEventListener("click", () => oAPP.fn.fnPressDelete());
        oToolbar.append(oEditBtn, oDelBtn);
        oPane.appendChild(oToolbar);

        const oWrap = _el("div", "u4a-table-wrap");
        const oTable = _el("table", "u4a-table");
        oTable.id = SERVER_TBL_ID;

        // 헤더 (정렬 가능 컬럼: ISSAVE/name/systemid/host)
        const aCols = [
            { key: "ISSAVE", label: L("status"), sortable: true, cls: "u4a-c-status" },
            { key: "name", label: L("serverName"), sortable: true, cls: "u4a-c-name" },
            { key: "systemid", label: L("sid"), sortable: true, cls: "u4a-c-sid" },
            { key: "host", label: L("host"), sortable: true, cls: "u4a-c-host" },
            { key: "insno", label: L("sno"), sortable: false, align: "center", cls: "u4a-c-sno" },
            { key: "__action", label: L("settingsCol"), sortable: false, align: "center", cls: "u4a-c-action" }
        ];

        const oThead = _el("thead");
        const oHrow = _el("tr");
        for (const oCol of aCols) {
            const oTh = _el("th", oCol.cls);
            oTh.appendChild(_el("span", null, oCol.label));
            if (oCol.align === "center") { oTh.style.textAlign = "center"; }
            if (oCol.sortable) {
                oTh.dataset.col = oCol.key;
                if (oAPP.attr._sortCol === oCol.key) {
                    // 정렬 표시 — Font Awesome caret (일반 문자 대신)
                    const oSortIco = _el("span", "u4a-sort-ico");
                    oSortIco.innerHTML = (oAPP.attr._sortDir === "desc") ? ICON.sortDesc : ICON.sortAsc;
                    oTh.appendChild(oSortIco);
                }
                oTh.addEventListener("click", () => oAPP.fn.fnSortServerTable(oCol.key));
            } else {
                oTh.style.cursor = "default";
            }
            oHrow.appendChild(oTh);
        }
        oThead.appendChild(oHrow);
        oTable.appendChild(oThead);

        // 바디
        const oTbody = _el("tbody");
        const aItems = M.getProperty("/SAPLogonItems") || [];

        if (aItems.length === 0) {
            const oTr = _el("tr", "u4a-table__nodata");
            const oTd = _el("td", null, L("noData"));
            oTd.colSpan = aCols.length;
            oTr.appendChild(oTd);
            oTbody.appendChild(oTr);
        } else {
            aItems.forEach((oItem, idx) => {
                const oTr = _el("tr", "server-row");
                oTr.dataset.uuid = oItem.uuid || "";
                oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false";
                oTr.tabIndex = 0;
                oTr._rowData = oItem;

                // STATUS (ObjectStatus 대체)
                const oTdStatus = _el("td", "u4a-c-status");
                const bSave = (oItem.ISSAVE === true);
                const oStatus = _el("span", "u4a-status" + (bSave ? " u4a-status--success" : ""),
                    bSave ? L("active") : L("inactive"));
                oTdStatus.appendChild(oStatus);

                const oTdName = _el("td", "u4a-c-name", oItem.name || "");
                oTdName.title = oItem.name || "";
                const oTdSid = _el("td", "u4a-c-sid", oItem.systemid || "");
                const oTdHost = _el("td", "u4a-c-host", oItem.host || "");
                const oTdSno = _el("td", "u4a-c-sno", oItem.insno || "");
                oTdSno.style.textAlign = "center";

                // Settings 버튼
                const oTdAct = _el("td", "u4a-col-action u4a-c-action");
                const oActBtn = _el("button", "u4a-btn-icon");
                oActBtn.innerHTML = ICON.settings;
                oActBtn.title = L("settings");
                oActBtn.disabled = !bSave;
                oActBtn.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    _selectServerRow(oTr, oItem);
                    oAPP.fn.fnPressServerSettings(oItem);
                });
                oTdAct.appendChild(oActBtn);

                oTr.append(oTdStatus, oTdName, oTdSid, oTdHost, oTdSno, oTdAct);

                // 행 선택 + 더블클릭 → 로그인
                oTr.addEventListener("click", () => _selectServerRow(oTr, oItem));
                oTr.addEventListener("dblclick", () => oAPP.fn.fnPressServerListItem(oItem, oTr));
                oTr.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") {
                        ev.preventDefault();
                        oAPP.fn.fnPressServerListItem(oItem, oTr);
                    }
                });

                oTbody.appendChild(oTr);
            });
        }

        oTable.appendChild(oTbody);
        oWrap.appendChild(oTable);
        oPane.appendChild(oWrap);

        // 마지막 선택 서버(행) 복원 — 현재 목록에 그 uuid 가 있을 때만 (없으면 선택 없음).
        const sRestoreKey = oAPP.attr._lastSelectedServerKey;
        if (sRestoreKey) {
            const oTargetRow = oTbody.querySelector(`tr.server-row[data-uuid="${sRestoreKey}"]`);
            if (oTargetRow && oTargetRow._rowData) {
                _selectServerRow(oTargetRow, oTargetRow._rowData, true); // 복원 시 재저장 생략
                oTargetRow.scrollIntoView({ block: "nearest" });
            }
        }

        // 반응형: 테이블 폭에 따라 저우선 컬럼 접기 (스플리터 드래그/창 리사이즈 모두 반응)
        _observeTableWidth(oWrap);
    };

    // 현재 테이블 폭으로 data-w(lg/md/sm/xs) 갱신 — 폭은 엘리먼트에서 직접 읽는다.
    function _setTableWidthClass() {
        const oWrap = oAPP.attr._tblWrap;
        if (!oWrap || !oWrap.isConnected) {
            return;
        }
        const iWidth = oWrap.getBoundingClientRect().width;
        if (!iWidth) {
            return;
        }
        let sKey = "lg";
        if (iWidth < 400) { sKey = "xs"; }
        else if (iWidth < 520) { sKey = "sm"; }
        else if (iWidth < 680) { sKey = "md"; }
        // 값이 바뀔 때만 기록 (불필요한 레이아웃 무효화/루프 방지)
        if (oWrap.dataset.w !== sKey) {
            oWrap.dataset.w = sKey;
        }
    }

    /**
     * rAF 디바운스 — ResizeObserver 콜백 내부에서 동기로 레이아웃을 바꾸면
     * "ResizeObserver loop limit exceeded" 가 발생한다. 갱신을 다음 프레임으로
     * 미뤄 관측 사이클 밖에서 처리한다.
     */
    function _scheduleTableWidthUpdate() {
        if (oAPP.attr._tblRAF) {
            return;
        }
        const fnRAF = (typeof requestAnimationFrame === "function")
            ? requestAnimationFrame
            : function (cb) { return setTimeout(cb, 16); };
        oAPP.attr._tblRAF = fnRAF(function () {
            oAPP.attr._tblRAF = null;
            _setTableWidthClass();
        });
    }
    oAPP.fn.fnUpdateTableWidthClass = _scheduleTableWidthUpdate;

    function _observeTableWidth(oWrap) {
        oAPP.attr._tblWrap = oWrap;

        // 1) 즉시 1회 (observer 초기 콜백 타이밍에 의존하지 않음)
        _setTableWidthClass();

        // 2) ResizeObserver (스플리터 드래그/내용 변화 등) — rAF 디바운스
        if (oAPP.attr._tblRO) {
            oAPP.attr._tblRO.disconnect();
        }
        if (typeof ResizeObserver !== "undefined") {
            oAPP.attr._tblRO = new ResizeObserver(function () { _scheduleTableWidthUpdate(); });
            oAPP.attr._tblRO.observe(oWrap);
        }

        // 3) window resize (창 리사이즈 — 1회만 바인딩)
        if (!oAPP.attr._tblResizeBound) {
            oAPP.attr._tblResizeBound = true;
            window.addEventListener("resize", function () { _scheduleTableWidthUpdate(); });
        }
    }

    oAPP.fn.fnSortServerTable = function (sKey) {
        // none → asc → desc → asc ... (UI5 컬럼 정렬 메뉴 대체)
        if (oAPP.attr._sortCol === sKey) {
            oAPP.attr._sortDir = (oAPP.attr._sortDir === "asc") ? "desc" : "asc";
        } else {
            oAPP.attr._sortCol = sKey;
            oAPP.attr._sortDir = "asc";
        }
        const aItems = M.getProperty("/SAPLogonItems") || [];
        const iDir = (oAPP.attr._sortDir === "asc") ? 1 : -1;
        aItems.sort((a, b) => {
            const va = (a[sKey] == null) ? "" : String(a[sKey]);
            const vb = (b[sKey] == null) ? "" : String(b[sKey]);
            return va.localeCompare(vb) * iDir;
        });
        M.setProperty("/SAPLogonItems", aItems);
        oAPP.fn.fnRenderServerTable();
    };

    /********************************************************************
     * 서버 옵션 팝업 (행 settings 버튼 — fnOpenServerSettings 대체)
     ********************************************************************/
    oAPP.fn.fnPressServerSettings = function (oItem) {

        const oSettings = _deepClone(oItem.settings || {});

        // Use Internal
        const oRow1 = _el("div", "u4a-form__row");
        const oChk1Lbl = _el("label", "u4a-check");
        const oChk1 = document.createElement("input");
        oChk1.type = "checkbox";
        oChk1.checked = !!oSettings.useInternal;
        oChk1Lbl.append(oChk1, _el("span", null, "Use Internal"));
        oRow1.appendChild(oChk1Lbl);

        // Skip Certificate
        const oRow2 = _el("div", "u4a-form__row");
        const oChk2Lbl = _el("label", "u4a-check");
        const oChk2 = document.createElement("input");
        oChk2.type = "checkbox";
        oChk2.checked = !!oSettings.skipCertificate;
        oChk2Lbl.append(oChk2, _el("span", null, "Skip Certificate"));
        oRow2.appendChild(oChk2Lbl);

        const oForm = _el("div", "u4a-form");
        oForm.append(oRow1, oRow2);

        _createFormDialog({
            title: `Settings - ${oItem.name || ""}`,
            icon: ICON.settings,
            bodyEl: oForm,
            buttons: [
                {
                    text: "", icon: ICON.accept, type: "emphasized",
                    onClick: async (oCtl) => {
                        const oNewSettings = {
                            useInternal: oChk1.checked,
                            skipCertificate: oChk2.checked
                        };
                        const oSaveResult = await _saveServerSettings(oItem.uuid, { settings: oNewSettings });
                        if (oSaveResult.RETCD === "E") {
                            oAPP.setSoundMsg("02");
                            oAPP.fn.showToast(oAPP.msg.M017);
                            return;
                        }
                        oItem.settings = oNewSettings;
                        oCtl.close();
                        oAPP.setSoundMsg("01");
                        oAPP.fn.showToast(oAPP.msg.M01);
                    }
                },
                { text: "", icon: ICON.decline, type: "reject", onClick: (oCtl) => oCtl.close() }
            ]
        });
    };

    // 서버 설정 정보 저장 (SERVERINFO_V2.json — Node FS 유지)
    async function _saveServerSettings(sUUID, oSettings) {
        const oSavedData = oAPP.fn.fnGetSavedServerListDataAll();
        if (oSavedData.RETCD === "E") {
            return { RETCD: "E", STCOD: "E001" };
        }
        const aSavedServer = oSavedData.RETDATA;
        const oFindServer = aSavedServer.find(e => e.uuid === sUUID);
        if (!oFindServer) {
            return { RETCD: "E", STCOD: "E002" };
        }
        oFindServer.settings = oSettings.settings;
        const oSaveResult = await _setSavedServerList(aSavedServer);
        if (oSaveResult.RETCD === "E") {
            return { RETCD: "E", STCOD: "E003" };
        }
        return { RETCD: "S" };
    }

    function _setSavedServerList(aSaveServerData) {
        try {
            FS.writeFileSync(PATHINFO.SERVERINFO_V2, JSON.stringify(aSaveServerData, null, 2), 'utf-8');
            return { RETCD: "S" };
        } catch (error) {
            return { RETCD: "E" };
        }
    }

    /********************************************************************
     * 테이블 툴바 — 수정 / 삭제 (fnPressEdit / fnPressDelete 대체)
     ********************************************************************/
    oAPP.fn.fnPressEdit = function () {
        const oSel = oAPP.attr._selectedServer;
        if (!oSel) {
            oAPP.fn.showToast(L("selectServer"));
            return;
        }
        oAPP.fn.fnEditDialogOpen(oSel.data);
    };

    oAPP.fn.fnPressDelete = async function () {
        const oSel = oAPP.attr._selectedServer;
        if (!oSel) {
            oAPP.fn.showToast(L("selectServer"));
            return;
        }
        const oData = oSel.data;
        if (!oData.ISSAVE) {
            return;
        }

        // 삭제 확인
        const sAction = await new Promise((resolve) => {
            oAPP.fn.fnShowMessageBox("C", oAPP.msg.M15, resolve);
        });
        if (sAction !== "OK") {
            return;
        }

        const oSavedData = oAPP.fn.fnGetSavedServerListDataAll();
        if (oSavedData.RETCD !== "S") {
            oAPP.fn.fnShowMessageBox("E", oSavedData.RTMSG);
            return;
        }
        const aSavedData = oSavedData.RETDATA;
        const iDelIndex = aSavedData.findIndex(elem => elem.uuid === oData.uuid);
        if (iDelIndex < 0) {
            return;
        }

        const sLocalJsonPath = PATHINFO.SERVERINFO_V2 || "";
        if (!FS.existsSync(sLocalJsonPath)) {
            oAPP.fn.fnShowMessageBox("E", oAPP.msg.M10);
            return;
        }

        aSavedData.splice(iDelIndex, 1);

        const oWriteFileResult = await oAPP.fn.fnWriteFile(sLocalJsonPath, JSON.stringify(aSavedData));
        if (oWriteFileResult.RETCD !== "S") {
            oAPP.fn.fnShowMessageBox("E", oWriteFileResult.RTMSG);
            return;
        }

        oAPP.setSoundMsg("01");
        oAPP.fn.showToast(oAPP.msg.M02);

        // 우측 서버 목록 갱신
        oAPP.fn.fnRefreshCurrentFolder();
    };

    /********************************************************************
     * 기 저장된 서버 정보 동기화 / 조회 (SERVERINFO_V2.json — Node FS 유지)
     ********************************************************************/
    function _syncSavedServerInfo(oModel) {
        const aServerList = oModel.getProperty("/SAPLogonItems");
        if (!aServerList || !Array.isArray(aServerList) || aServerList.length === 0) {
            return;
        }
        const oSavedAllReturn = oAPP.fn.fnGetSavedServerListDataAll();
        if (oSavedAllReturn.RETCD !== "S") {
            return;
        }
        const aSavedServerList = oSavedAllReturn.RETDATA;
        if (aSavedServerList.length === 0) {
            return;
        }
        for (const oSavedServer of aSavedServerList) {
            const oServerInfo = aServerList.find(e => e.uuid === oSavedServer.uuid);
            if (!oServerInfo) { continue; }
            oServerInfo.ISSAVE = true;
            if (oSavedServer.settings) {
                oServerInfo.settings = oSavedServer.settings;
            }
        }
    }

    oAPP.fn.fnGetSavedServerListData = function (pUUID) {
        const sLocalJsonPath = PATHINFO.SERVERINFO_V2 || "";
        if (!FS.existsSync(sLocalJsonPath)) {
            return { RETCD: "E", RTMSG: oAPP.msg.M04 };
        }
        const sReadFileData = FS.readFileSync(sLocalJsonPath, 'utf-8') || JSON.stringify("");
        const aSavedJsonData = JSON.parse(sReadFileData);
        if (!Array.isArray(aSavedJsonData)) {
            return { RETCD: "E", RTMSG: oAPP.msg.M11 };
        }
        const oFindData = aSavedJsonData.find(elem => elem.uuid === pUUID);
        if (!oFindData) {
            return { RETCD: "E", RTMSG: oAPP.msg.M11 };
        }
        return { RETCD: "S", RETDATA: oFindData };
    };

    oAPP.fn.fnGetSavedServerListDataAll = function () {
        const sLocalJsonPath = PATHINFO.SERVERINFO_V2 || "";
        if (!FS.existsSync(sLocalJsonPath)) {
            return { RETCD: "E", RTMSG: oAPP.msg.M12 };
        }
        const sReadFileData = FS.readFileSync(sLocalJsonPath, 'utf-8') || JSON.stringify("");
        const aSavedJsonData = JSON.parse(sReadFileData);
        if (!Array.isArray(aSavedJsonData)) {
            return { RETCD: "E", RTMSG: oAPP.msg.M11 };
        }
        return { RETCD: "S", RETDATA: aSavedJsonData };
    };

    /********************************************************************
     * 서버 행 더블클릭 → 로그인 창 오픈 (Electron BrowserWindow — 유지)
     ********************************************************************/
    oAPP.fn.fnPressServerListItem = async function (oBindData, oTr) {

        // 선택 표시
        if (oTr) { _selectServerRow(oTr, oBindData); }

        // 미저장 서버 → 등록 팝업
        if (!oBindData.ISSAVE) {
            oAPP.fn.fnEditDialogOpen(oBindData);
            return;
        }

        const sUUID = oBindData.uuid;
        const oSavedData = oAPP.fn.fnGetSavedServerListData(sUUID);
        if (oSavedData.RETCD === "E") {
            oAPP.fn.fnEditDialogOpen(oBindData);
            return;
        }

        oAPP.setBusy(true);

        const oRetData = oSavedData.RETDATA;
        const sProtocol = oRetData.protocol;
        const sHost = oRetData.host;
        const sPort = oRetData.port;
        let sUrl = `${sProtocol}://${sHost}`;
        if (sPort !== "") {
            sUrl += `:${sPort}`;
        }

        const oLoginInfo = {
            NAME: oBindData.name,
            SERVER_INFO: oRetData,
            SERVER_INFO_DETAIL: oBindData,
            INSTANCENO: oBindData.insno,
            SYSTEMID: oBindData.systemid,
            CLIENT: "",
            LANGU: "",
            SYSID: oBindData.systemid,
            SETTINGS: oBindData.settings || undefined
        };

        // 사용자 테마 정보
        const oP13nThemeInfo = await fnP13nCreateTheme(oLoginInfo.SYSID);
        if (oP13nThemeInfo.RETCD === "S") {
            oLoginInfo.oThemeInfo = oP13nThemeInfo.RTDATA;
        }

        // 선택 정보 레지스트리 저장
        await _registSelectedSystemInfo(oLoginInfo);

        fnLoginPage(oLoginInfo);
    };

    /********************************************************************
     * 서버 등록/편집 팝업 (fnEditDialogOpen + fnPressSave + fnCheckValid)
     ********************************************************************/
    oAPP.fn.fnEditDialogOpen = function (oBindData) {

        oAPP.setBusy(false);

        // 저장 데이터 기본값 + 기 저장값 병합
        const oSaveData = { protocol: "http", host: "", port: "" };
        // 기 저장된 settings 는 보존 (편집 시 옵션 유실 방지)
        let oKeepSettings = oBindData.settings ? _deepClone(oBindData.settings) : undefined;

        const oSavedData = oAPP.fn.fnGetSavedServerListData(oBindData.uuid);
        if (oSavedData.RETCD === "S") {
            const oFind = oSavedData.RETDATA;
            oSaveData.protocol = oFind.protocol;
            oSaveData.host = oFind.host;
            oSaveData.port = oFind.port;
            if (oFind.settings) {
                oKeepSettings = _deepClone(oFind.settings);
            }
        }

        // ── 폼 구성 ──
        const oForm = _el("div", "u4a-form");

        // Protocol
        const oRowP = _el("div", "u4a-form__row");
        oRowP.appendChild(_el("label", "u4a-label u4a-label--required", "Protocol"));
        const oSelProto = _createSelect(
            [{ value: "http", text: "http" }, { value: "https", text: "https" }],
            oSaveData.protocol
        );
        oRowP.appendChild(oSelProto);
        oForm.appendChild(oRowP);

        // Host (required + ValueState)
        const oRowH = _el("div", "u4a-form__row");
        oRowH.appendChild(_el("label", "u4a-label u4a-label--required", "Host"));
        const oInpHost = _el("input", "u4a-input");
        oInpHost.type = "text";
        oInpHost.value = oSaveData.host || "";
        const oHostMsg = _el("div", "u4a-field__msg");
        oRowH.append(oInpHost, oHostMsg);
        oForm.appendChild(oRowH);

        // Port (number, maxlength 5)
        const oRowPort = _el("div", "u4a-form__row");
        oRowPort.appendChild(_el("label", "u4a-label", "Port"));
        const oInpPort = _el("input", "u4a-input");
        oInpPort.type = "number";
        oInpPort.maxLength = 5;
        oInpPort.value = oSaveData.port || "";
        oRowPort.appendChild(oInpPort);
        oForm.appendChild(oRowPort);

        // 편집 컨텍스트 보관
        oAPP.attr._editCtx = {
            server: oBindData,
            keepSettings: oKeepSettings,
            elHost: oInpHost,
            elHostMsg: oHostMsg,
            elPort: oInpPort,
            elProto: oSelProto
        };

        const oDlgCtl = _createFormDialog({
            title: oBindData.name || "",
            icon: ICON.gear,
            bodyEl: oForm,
            width: "32rem",
            initialFocusEl: oInpHost,
            buttons: [
                { text: "", icon: ICON.accept, type: "emphasized", onClick: (oCtl) => oAPP.fn.fnPressSave(oCtl) },
                { text: "", icon: ICON.decline, type: "reject", onClick: (oCtl) => oCtl.close() }
            ]
        });
        oAPP.attr._editCtx.ctl = oDlgCtl;

        // Enter 로 저장 (submit 대체)
        const _fnEnter = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); oAPP.fn.fnPressSave(oDlgCtl); } };
        oInpHost.addEventListener("keydown", _fnEnter);
        oInpPort.addEventListener("keydown", _fnEnter);

        // 입력 시작 시 에러 힌트 제거 (suggestion 처럼 dismiss)
        oInpHost.addEventListener("input", () => {
            delete oInpHost.dataset.vs;
            oHostMsg.textContent = "";
        });
    };

    oAPP.fn.fnEditDialogClose = function () {
        const oCtx = oAPP.attr._editCtx;
        if (oCtx && oCtx.ctl) {
            oCtx.ctl.close();
        }
    };

    oAPP.fn.fnPressSave = async function (oCtl) {

        oAPP.setBusy(true);

        const oCtx = oAPP.attr._editCtx;
        if (!oCtx) {
            return oAPP.setBusy(false);
        }

        const oSaveData = {
            protocol: oCtx.elProto.value,
            host: oCtx.elHost.value,
            port: oCtx.elPort.value
        };

        // 입력값 검증
        const oValid = oAPP.fn.fnCheckValid(oSaveData);
        if (oValid.RETCD === "E") {
            oAPP.setSoundMsg("02");
            return oAPP.setBusy(false);
        }

        // 저장 데이터 구성 (기존 settings 보존)
        const oKeep = oCtx.keepSettings || {};
        const oLocalSaveData = {
            uuid: oCtx.server.uuid,
            protocol: oSaveData.protocol,
            host: oSaveData.host,
            port: oSaveData.port,
            settings: {
                useInternal: !!oKeep.useInternal,
                skipCertificate: !!oKeep.skipCertificate
            }
        };

        const sJsonPath = PATHINFO.SERVERINFO_V2 || "";
        if (!FS.existsSync(sJsonPath)) {
            oAPP.fn.fnShowMessageBox("E", oAPP.msg.M10, oAPP.fn.fnEditDialogClose);
            return oAPP.setBusy(false);
        }

        const sFileContent = FS.readFileSync(sJsonPath, "utf-8") || "[]";
        let aSavedData;
        try {
            aSavedData = JSON.parse(sFileContent);
        } catch (e) {
            aSavedData = [];
        }
        if (!Array.isArray(aSavedData)) {
            aSavedData = [];
        }

        const iIdx = aSavedData.findIndex(e => e.uuid === oLocalSaveData.uuid);
        if (iIdx >= 0) {
            aSavedData[iIdx] = Object.assign(aSavedData[iIdx], oLocalSaveData);
        } else {
            aSavedData.push(oLocalSaveData);
        }

        const oWriteResult = await oAPP.fn.fnWriteFile(sJsonPath, JSON.stringify(aSavedData));
        if (oWriteResult.RETCD !== "S") {
            oAPP.fn.fnShowMessageBox("E", oWriteResult.RTMSG, oAPP.fn.fnEditDialogClose);
            return oAPP.setBusy(false);
        }

        // 모델 갱신
        oCtx.server.ISSAVE = true;

        if (oCtl) { oCtl.close(); }

        oAPP.setSoundMsg("01");
        oAPP.fn.showToast(oAPP.msg.M01);

        // 우측 서버 목록 갱신 (ISSAVE 반영)
        oAPP.fn.fnRefreshCurrentFolder();

        oAPP.setBusy(false);
    };

    oAPP.fn.fnWriteFile = function (path, file, option) {
        const oDefaultOptions = { encoding: "utf-8", mode: 0o777, flag: "w" };
        const oOptions = Object.assign({}, oDefaultOptions, option);
        return new Promise((resolve) => {
            FS.writeFile(path, file, oOptions, (err) => {
                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                    return;
                }
                resolve({ RETCD: "S" });
            });
        });
    };

    // 입력값 Validation (host 필수 M13 / 공백 금지 M14 → ValueState.Error)
    oAPP.fn.fnCheckValid = function (oSaveData) {
        const oCtx = oAPP.attr._editCtx;
        const oHost = oCtx ? oCtx.elHost : null;
        const oHostMsg = oCtx ? oCtx.elHostMsg : null;
        const sHost = oSaveData.host;

        function _setHostError(sMsg) {
            if (oHost) { oHost.dataset.vs = "error"; }
            if (oHostMsg) { oHostMsg.textContent = sMsg; }
            setTimeout(() => { if (oHost) { oHost.focus(); } }, 0);
        }

        // 초기화
        if (oHost) { delete oHost.dataset.vs; }
        if (oHostMsg) { oHostMsg.textContent = ""; }

        // 필수
        if (!sHost || sHost === "") {
            _setHostError(oAPP.msg.M13);
            return { RETCD: "E", RTMSG: oAPP.msg.M13 };
        }
        // 공백 포함 금지
        if (sHost.match(/\s/g)) {
            _setHostError(oAPP.msg.M14);
            return { RETCD: "E", RTMSG: oAPP.msg.M14 };
        }
        return { RETCD: "S" };
    };

    /********************************************************************
     * 로그인 창 (Electron BrowserWindow — 호출부 유지, doc 02 §9.4)
     ********************************************************************/
    function fnLoginPage(oLoginInfo) {

        const WINDOWSTATE = REMOTE.getGlobal("mainRequire")('electron-window-state');
        const mainWindowState = WINDOWSTATE({ defaultWidth: 1000, defaultHeight: 800 });

        const SESSKEY = RANDOM.generate(40);
        const BROWSERKEY = RANDOM.generate(10);

        const sSettingsJsonPath = PATHINFO.BROWSERSETTINGS;
        const oDefaultOption = parent.require(sSettingsJsonPath);
        const oBrowserOptions = _deepClone(oDefaultOption.browserWindow);
        const oWebPreferences = oBrowserOptions.webPreferences;
        const oThemeInfo = oLoginInfo.oThemeInfo;

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.x = mainWindowState.x;
        oBrowserOptions.y = mainWindowState.y;
        oBrowserOptions.width = mainWindowState.width;
        oBrowserOptions.height = mainWindowState.height;
        oBrowserOptions.minWidth = 1000;
        oBrowserOptions.minHeight = 800;

        oWebPreferences.partition = SESSKEY;
        oWebPreferences.browserkey = BROWSERKEY;
        oWebPreferences.OBJTY = "MAIN";
        oWebPreferences.SYSID = oLoginInfo.SYSID;

        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);
        oBrowserWindow.setMenu(null);
        mainWindowState.manage(oBrowserWindow);

        const oQueryParams = {
            browserkey: BROWSERKEY,
            sessionKey: SESSKEY,
            OBJTY: "MAIN",
            SYSID: oLoginInfo.SYSID
        };
        const sLoadUrl = WSUTIL.QueryString.build(PATHINFO.MAINFRAME, oQueryParams);
        oBrowserWindow.loadURL(sLoadUrl);

        if (!APP.isPackaged) {
            oBrowserWindow.webContents.openDevTools();
        }

        oBrowserWindow.webContents.on('did-finish-load', function () {
            oAPP.setBusy(false);
            const oMetadata = {
                SERVERINFO: oLoginInfo,
                THEMEINFO: oLoginInfo.oThemeInfo,
                EXEPAGE: "LOGIN",
                SESSIONKEY: SESSKEY,
                BROWSERKEY: BROWSERKEY
            };
            oBrowserWindow.webContents.send('if-meta-info', oMetadata);
            configureSession(oBrowserWindow);
        });

        oBrowserWindow.on('closed', () => { oBrowserWindow = null; });
    }
    oAPP.fn.fnLoginPage = fnLoginPage;

    function configureSession(oBrowserWindow) {
        const session = oBrowserWindow.webContents.session;
        const filter = { urls: ["http://*/*", "https://*/*"] };
        session.webRequest.onHeadersReceived(filter, (details, callback) => {
            const cookies = (details.responseHeaders['set-cookie'] || []).map((cookie) => {
                if (cookie.indexOf("SameSite=OFF") > 0 || cookie.indexOf("SameSite=None") > 0) {
                    return cookie;
                }
                let sCookie = cookie;
                sCookie = sCookie.replace('SameSite=Strict', 'SameSite=None');
                sCookie = sCookie.replace('SameSite=Lax', 'SameSite=None');
                return sCookie;
            });
            if (cookies.length > 0) {
                details.responseHeaders['set-cookie'] = cookies;
            }
            callback({ cancel: false, responseHeaders: details.responseHeaders });
        });
    }

    function fnP13nCreateTheme(SYSID) {
        return new Promise((resolve) => {
            const sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme", `${SYSID}.json`);
            const oDefThemeInfo = {
                THEME: SETTINGS.defaultTheme,
                BGCOL: SETTINGS.defaultBackgroundColor
            };
            if (!FS.existsSync(sThemeJsonPath)) {
                FS.writeFile(sThemeJsonPath, JSON.stringify(oDefThemeInfo), { encoding: "utf8", mode: 0o777 }, function (err) {
                    if (err) {
                        resolve({ RETCD: "E", RTMSG: err.toString() });
                        return;
                    }
                    resolve({ RETCD: "S", RTMSG: "", RTDATA: oDefThemeInfo });
                });
                return;
            }
            FS.readFile(sThemeJsonPath, { encoding: "utf8" }, (err, data) => {
                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                    return;
                }
                resolve({ RETCD: "S", RTMSG: "", RTDATA: JSON.parse(data) });
            });
        });
    }
    oAPP.fn.fnP13nCreateTheme = fnP13nCreateTheme;

    function _registSelectedSystemInfo(oServerInfo) {
        return new Promise(async (resolve) => {
            try {
                const sSystemPath = SETTINGS.regPaths.systems;
                const sCreatePath = `${sSystemPath}\\${oServerInfo.SYSID}`;
                await _regeditCreateKey([sCreatePath]);
            } catch (e) {
                console.warn("[_registSelectedSystemInfo] 실패:", e);
            }
            resolve();
        });
    }

    function _getRegeditList(aPaths) {
        return new Promise((resolve) => {
            REGEDIT.list(aPaths, (err, result) => {
                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                    return;
                }
                resolve({ RETCD: "S", RTDATA: result });
            });
        });
    }

    function _regeditCreateKey(aKeys) {
        return new Promise((resolve) => {
            REGEDIT.createKey(aKeys, (err) => {
                if (err) {
                    resolve({ RETCD: "E", RTMSG: err.toString() });
                    return;
                }
                resolve({ RETCD: "S", RTMSG: "success!!" });
            });
        });
    }

    /********************************************************************
     * 설정 메뉴 (UI5 MenuButton/Menu 대체) — 드롭다운
     ********************************************************************/
    oAPP.fn.fnOpenSettingsMenu = function (oEvent) {
        _closeAllMenus();

        const oBtn = oEvent.currentTarget;
        const oMenu = _el("div", "u4a-menu");
        oMenu.setAttribute("role", "menu");

        const aItems = [
            { key: "WSLANGU", icon: ICON.translate, text: T("001") },
            { key: "WSTHEME", icon: ICON.palette, text: T("005") },
            { key: "WSSOUND", icon: ICON.sound, text: T("204") },
            { key: "ABOUTWS", icon: ICON.hint, text: T("044") }
        ];

        for (const oItem of aItems) {
            const oRow = _el("div", "u4a-menu__item");
            oRow.setAttribute("role", "menuitem");
            oRow.tabIndex = 0;
            oRow.innerHTML = oItem.icon + `<span>${_esc(oItem.text)}</span>`;
            oRow.addEventListener("click", () => {
                _closeAllMenus();
                oAPP.fn.fnSettingItemSelected(oItem.key, oBtn);
            });
            oMenu.appendChild(oRow);
        }

        document.body.appendChild(oMenu);
        _positionMenu(oMenu, oBtn);
        _bindOutsideClose(oMenu);
    };

    oAPP.fn.fnSettingItemSelected = function (sKey) {
        switch (sKey) {
            case "WSLANGU": _openWsLanguSettingPopup(); break;
            case "WSTHEME": _openWSThemeSettingPopup(); break;
            case "WSSOUND": _openWsSoundSettingPopup(); break;
            case "ABOUTWS": _openAboutWsPopup(); break;
        }
    };

    /********************************************************************
     * [설정] WS 언어 (Electron/Node 설정 저장 유지)
     ********************************************************************/
    async function _openWsLanguSettingPopup() {

        // 언어 목록: MSG/WS_COMMON 하위 폴더 (없으면 EN/KO)
        let aLangu = [{ KEY: "EN" }, { KEY: "KO" }];
        try {
            const sMsgDirPath = PATH.join(APPPATH, "MSG", "WS_COMMON");
            if (FS.existsSync(sMsgDirPath)) {
                const aDir = FS.readdirSync(sMsgDirPath);
                if (aDir.length) { aLangu = aDir.map(s => ({ KEY: s })); }
            }
        } catch (e) { /* 무시 */ }

        // 현재 선택 언어
        let sSelected = "EN";
        try {
            const oWsLangu = await WSUTIL.getGlobalSettingInfo("language");
            if (oWsLangu && oWsLangu.value) { sSelected = oWsLangu.value; }
        } catch (e) { /* 무시 */ }

        const oSel = _createSelect(aLangu.map(l => ({ value: l.KEY, text: l.KEY })), sSelected);

        const oForm = _el("div", "u4a-form");
        const oRow = _el("div", "u4a-form__row");
        oRow.append(_el("label", "u4a-label", T("001")), oSel);
        oForm.appendChild(oRow);

        _createFormDialog({
            title: T("000") || "WS Language Settings",
            icon: ICON.translate,
            bodyEl: oForm,
            width: "24rem",
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { oAPP.setBusy(true); await _saveWsLangu(oSel.value, oCtl); } },
                { text: T("003") || "Cancel", onClick: (oCtl) => oCtl.close() }
            ]
        });
    }

    async function _saveWsLangu(sKey, oCtl) {
        try {
            const oSettingInfo = WSUTIL.getWsSettingsInfo();
            oSettingInfo.globalLanguage = sKey;
            WSUTIL.setWsSettingsInfo(oSettingInfo);
            await WSUTIL.saveGlobalSettingInfo("language", sKey);
            // GlobalSettings 도 갱신 — _getCurrentWsLangu()/L() 가 이 값을 우선 참조하므로
            // 갱신하지 않으면 i18n 텍스트(헤더/버튼/상태)가 이전 언어로 남는다.
            if (!oAPP.data.GlobalSettings) {
                oAPP.data.GlobalSettings = {};
            }
            oAPP.data.GlobalSettings.language = { value: sKey };
            await oAPP.fn.fnWsGlobalMsgList();
            await oAPP.fn.fnOnInitModeling();
            oAPP.fn.fnRefreshShellTexts();
        } catch (e) {
            console.warn("[_saveWsLangu] 실패:", e);
        }
        oCtl.close();
        oAPP.setBusy(false);
        oAPP.fn.showToast(oAPP.msg.M01);
    }

    /********************************************************************
     * [설정] WS 테마 (doc 12 5종 테마, U4ATheme.apply)
     ********************************************************************/
    function _openWSThemeSettingPopup() {

        const aThemes = [
            { KEY: "horizon_white", TXT: "Horizon White" },
            { KEY: "horizon_dark", TXT: "Horizon Dark" },
            { KEY: "horizon_purple", TXT: "Horizon Purple" },
            { KEY: "horizon_red", TXT: "Horizon Red" },
            { KEY: "horizon_green", TXT: "Horizon Green" }
        ];
        const sCurrent = U4ATheme.current();

        const oSel = _createSelect(
            aThemes.map(t => ({ value: t.KEY, text: t.TXT })),
            sCurrent,
            (v) => U4ATheme.apply(v)   // 실시간 미리보기
        );

        const oForm = _el("div", "u4a-form");
        const oRow = _el("div", "u4a-form__row");
        oRow.append(_el("label", "u4a-label", T("005")), oSel);
        oForm.appendChild(oRow);

        _createFormDialog({
            title: T("006") || "Theme Settings",
            icon: ICON.palette,
            bodyEl: oForm,
            width: "24rem",
            onCancel: (oCtl) => { U4ATheme.apply(sCurrent); oCtl.close(); },
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { oAPP.setBusy(true); await _saveWsThemeInfo(oSel.value, oCtl); } },
                { text: T("003") || "Cancel", onClick: (oCtl) => { U4ATheme.apply(sCurrent); oCtl.close(); } }
            ]
        });
    }

    async function _saveWsThemeInfo(sKey, oCtl) {
        try {
            const oSettingInfo = WSUTIL.getWsSettingsInfo();
            oSettingInfo.globalTheme = sKey;
            WSUTIL.setWsSettingsInfo(oSettingInfo);
            await WSUTIL.saveGlobalSettingInfo("theme", sKey);
        } catch (e) {
            console.warn("[_saveWsThemeInfo] 실패:", e);
        }
        U4ATheme.apply(sKey);
        oCtl.close();
        oAPP.setBusy(false);
        oAPP.fn.showToast(oAPP.msg.M01);
    }

    /********************************************************************
     * [설정] WS 사운드 (Switch on/off)
     ********************************************************************/
    function _openWsSoundSettingPopup() {

        const oSwitch = _el("label", "u4a-switch");
        const oChk = document.createElement("input");
        oChk.type = "checkbox";
        oSwitch.append(oChk, _el("span", "u4a-switch__slider"));

        const oForm = _el("div", "u4a-form");
        const oRow = _el("div", "u4a-form__row");
        oRow.append(_el("label", "u4a-label", T("205") || "Sound Settings"), oSwitch);
        oForm.appendChild(oRow);

        _createFormDialog({
            title: T("205") || "Sound Settings",
            icon: ICON.sound,
            bodyEl: oForm,
            width: "24rem",
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { await _saveWsSound(oChk.checked, oCtl); } },
                { text: T("003") || "Cancel", onClick: (oCtl) => oCtl.close() }
            ]
        });

        // 현재 사운드 상태 반영
        (async () => {
            try {
                const oResult = await WSUTIL.getGlobalSettingInfo("sound");
                if (oResult && oResult.value === "X") { oChk.checked = true; }
            } catch (e) { /* 무시 */ }
        })();
    }

    async function _saveWsSound(bState, oCtl) {
        const sState = bState ? "X" : "";
        try {
            const oSettingInfo = WSUTIL.getWsSettingsInfo();
            oSettingInfo.globalSound = sState;
            WSUTIL.setWsSettingsInfo(oSettingInfo);
            await WSUTIL.saveGlobalSettingInfo("sound", sState);
        } catch (e) {
            console.warn("[_saveWsSound] 실패:", e);
        }
        oCtl.close();
        oAPP.fn.showToast(oAPP.msg.M01);
    }

    /********************************************************************
     * [설정] About WS (aboutWs.html iframe)
     ********************************************************************/
    function _openAboutWsPopup() {
        // 본문을 다이얼로그 폭에 꽉 채운다(흰 여백 제거). iframe 은 본문 100% 채움.
        const oBody = _el("div", "u4a-about-body");
        const oFrame = document.createElement("iframe");
        oFrame.className = "u4a-about-frame";
        // 현재 테마의 다이얼로그 표면색을 aboutWs.html 에 넘겨 배경을 일치시킨다
        // (iframe 투명 의존 대신 명시적으로 칠함 — 다크/라이트 모두 균일).
        const sBg = encodeURIComponent(_resolveColor("--surface-raised"));
        oFrame.src = _toFileUrl(PATH.join(APPPATH, "aboutWs.html")) + "?bg=" + sBg;
        oBody.appendChild(oFrame);

        _createFormDialog({
            title: T("044") || "About WS..",
            icon: ICON.hint,
            bodyEl: oBody,
            bodyFlush: true,
            width: "46rem",
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: (oDlg) => oDlg.close() }
            ]
        });
    }

    /********************************************************************
     * 창 제어 — 닫기 (자식 창 존재 시 안내, 없으면 종료) — 로직 유지
     ********************************************************************/
    /** SERVERLIST/FLTMENU 를 제외한 활성 자식 창(MAIN 등) 개수 */
    function _countActiveChildWindows() {
        const aBrowserList = REMOTE.BrowserWindow.getAllWindows();
        let iChildLength = 0;
        for (const oBrows of aBrowserList) {
            if (!oBrows || oBrows.isDestroyed()) { continue; }
            let oWebPref;
            try {
                oWebPref = WSUTIL.QueryString.parse(oBrows.getURL());
            } catch (error) {
                continue;
            }
            if (oWebPref.OBJTY === "SERVERLIST" || oWebPref.OBJTY === "FLTMENU") { continue; }
            ++iChildLength;
        }
        return iChildLength;
    }

    oAPP.fn.fnRequestClose = function () {
        if (_countActiveChildWindows() === 0) {
            APP.exit();
            return;
        }
        // 활성 자식 창이 있을 경우 안내 (UI5 IllustratedMessage 대체)
        oAPP.fn.fnShowMessageBox("W", T("043") || "An activated window exists. Please close all activated windows first.", () => {
            oAPP.fn.fnShowMainWindow();
        });
    };

    oAPP.fn.fnShowMainWindow = function () {
        const aBrowserList = REMOTE.BrowserWindow.getAllWindows();
        let oFirst = null;
        for (const oBrows of aBrowserList) {
            try {
                if (oBrows.isDestroyed()) { continue; }
                const sBrowserUrl = oBrows.getURL();
                const oWebPref = WSUTIL.QueryString.parse(sBrowserUrl);
                // 활성 자식 창(로그인/메인)은 OBJTY === "MAIN" — 이들을 전면으로 끌어온다.
                if (oWebPref.OBJTY !== "MAIN") { continue; }
                if (oBrows.isMinimized()) { oBrows.restore(); }
                oBrows.show();
                if (!oFirst) { oFirst = oBrows; }
            } catch (error) { continue; }
        }
        // 가장 먼저 열린(첫 번째) 활성 창을 포커스
        if (oFirst) { oFirst.focus(); }
    };

    function _attachCurrentWindowEvents() {
        CURRWIN.on("maximize", () => {
            const oBtn = document.getElementById("u4aWsMaxBtn");
            if (oBtn) { oBtn.innerHTML = ICON.restore; }
        });
        CURRWIN.on("unmaximize", () => {
            const oBtn = document.getElementById("u4aWsMaxBtn");
            if (oBtn) { oBtn.innerHTML = ICON.max; }
        });
    }

    /********************************************************************
     * OS/타이틀바발 창 닫기 가드 (원본 window.onbeforeunload 대체)
     * ----------------------------------------------------------------
     * 서버리스트 외 실행 중인 자식 창(MAIN 등)이 있으면 닫기를 막고 안내한다.
     * 사유: SameSite 쿠키 처리 webRequest 핸들러가 서버리스트에 있어, 먼저 닫히면
     *      실행 중인 앱에서 ajax 통신이 깨진다.
     * 앱 자체 종료(fnRequestClose / 종료팝업)는 APP.exit() 로 beforeunload 를
     * 우회하므로 이 가드의 영향을 받지 않는다.
     ********************************************************************/
    function _attachWindowCloseGuard() {
        window.onbeforeunload = () => {
            // 창을 잠깐 최상단으로 끌어올린다 (원본 동작)
            try {
                CURRWIN.setAlwaysOnTop(true, "screen-saver");
                CURRWIN.show();
                CURRWIN.setAlwaysOnTop(false);
            } catch (e) { /* 무시 */ }

            // 자식 창이 없으면 정상 종료 허용 (Electron: undefined 반환 → 닫기 진행)
            if (_countActiveChildWindows() === 0) { return undefined; }
            if (CURRWIN.isDestroyed()) { return undefined; }

            // 자식 창이 살아있으면: 안내 + (OK 시) 해당 메인 창을 전면·포커스 → 사용자가
            // 어떤 창을 닫아야 하는지 알 수 있게 한다. (fnRequestClose 와 동일 동작)
            oAPP.fn.fnShowMessageBox("W", T("043") || "An activated window exists. Please close all activated windows first.", () => {
                oAPP.fn.fnShowMainWindow();
            });
            // Electron: undefined 외 값을 반환하면 닫기가 취소된다.
            return false;
        };
    }
    // 단일 인스턴스 잠금은 메인 프로세스(electron/main.js configureSingleInstanceLock)
    // 에서 이미 처리하므로 렌더러에서는 추가하지 않는다 (second-instance 포커스는
    // main.js 에서 의도적으로 비활성화된 상태 — 2026-03-04 결정).

    function _createTaskBarMenu() {
        try {
            CURRWIN.setThumbarButtons([{
                tooltip: oAPP.msg.M16 || "Shut Down",
                icon: PATH.join(APPPATH, "img", "shutdown.png"),
                click() {
                    // 창을 잠깐 최상단으로 끌어올린 뒤 종료 확인 팝업 표시 (원본 동작)
                    CURRWIN.setAlwaysOnTop(true, "screen-saver");
                    CURRWIN.show();
                    CURRWIN.setAlwaysOnTop(false);
                    oAPP.fn.fnShowShutdownAskPopup();
                }
            }]);
        } catch (e) {
            console.warn("[_createTaskBarMenu] 실패(무시):", e);
        }
    }

    /********************************************************************
     * 프로그램 종료 질문 팝업 (원본 _showShuttdownAskPopup 대체)
     *  - OK : 전체 자식(MAIN) 프로그램 종료 요청 후, 모두 닫히면 APP.exit()
     *  - CANCEL : 아무것도 하지 않음
     ********************************************************************/
    oAPP.fn.fnShowShutdownAskPopup = function () {
        const sMsg = (oAPP.msg.M048 || "Unsaved data will be lost.") + " \n " +
            (oAPP.msg.M049 || "Are you sure you want to exit the Program?");

        oAPP.fn.fnShowMessageBox("C", sMsg, (sAction) => {
            if (sAction !== "OK") { return; }

            oAPP.fn.fnProgramShuttDown(); // 전체 자식 프로그램 종료 요청

            if (oAPP.attr.windowCloseInterval) {
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
            }
            // 자식(MAIN) 창이 모두 닫힐 때까지 폴링 후 종료
            oAPP.attr.windowCloseInterval = setInterval(() => {
                if (!_checkMainProgramExit()) { return; }
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
                APP.exit();
            }, 500);
        });
    };

    /** 전체 프로그램 종료 요청 (IPC — 원본 PRCCD "04" 유지) */
    oAPP.fn.fnProgramShuttDown = function () {
        IPCRENDERER.send("if-browser-interconnection", { PRCCD: "04" });
    };

    /** MAIN(자식) 프로그램이 모두 종료되었는지 확인 — 남아있으면 false */
    function _checkMainProgramExit() {
        const aBrowserList = REMOTE.BrowserWindow.getAllWindows();
        let iChildLength = 0;
        for (const oBrows of aBrowserList) {
            if (oBrows && oBrows.isDestroyed()) { continue; }
            let oWebPref;
            try {
                oWebPref = WSUTIL.QueryString.parse(oBrows.getURL());
            } catch (error) {
                continue;
            }
            if (oWebPref.OBJTY !== "MAIN") { continue; }
            ++iChildLength;
        }
        return iChildLength === 0;
    }

    /********************************************************************
     * DOM / 유틸 헬퍼
     ********************************************************************/
    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    function _winBtn(sIcon, sTitle, fnClick) {
        const o = _el("button", "u4a-winbtn");
        o.title = sTitle;
        o.innerHTML = sIcon;
        o.addEventListener("click", fnClick);
        return o;
    }

    function _toFileUrl(sPath) {
        let s = sPath.replaceAll("\\", "/");
        s = encodeURI(`file:///${s}`);
        return s;
    }

    // CSS 변수를 실제 색(rgb(...))으로 해석 (var() 미해석 문제 회피)
    function _resolveColor(sVarName) {
        const oEl = document.createElement("div");
        oEl.style.cssText = "position:absolute;visibility:hidden;background:var(" + sVarName + ")";
        document.body.appendChild(oEl);
        const sColor = getComputedStyle(oEl).backgroundColor;
        oEl.remove();
        return sColor;
    }

    function _deepClone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    function _esc(s) {
        const d = document.createElement("div");
        d.textContent = (s == null) ? "" : String(s);
        return d.innerHTML;
    }

    /**
     * 공통 폼 다이얼로그 (sap.m.Dialog 대체) — native <dialog> + 테마 토큰.
     * @returns {{dlg:HTMLDialogElement, close:Function}}
     */
    function _createFormDialog(opt) {
        const oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog";
        // 반응형: 지정 폭을 뷰포트(92vw) 내로 제한
        if (opt.width) { oDlg.style.width = "min(" + opt.width + ", 92vw)"; }

        const oCtl = {
            dlg: oDlg,
            close() {
                if (oDlg.open) { oDlg.close(); }
                oDlg.remove();
            }
        };

        // header (icon + title)
        const oHead = _el("div", "u4a-dialog__header");
        if (opt.icon) {
            const oIconSpan = document.createElement("span");
            oIconSpan.innerHTML = opt.icon;
            if (oIconSpan.firstChild) { oHead.appendChild(oIconSpan.firstChild); }
        }
        oHead.appendChild(_el("span", null, opt.title || ""));
        oDlg.appendChild(oHead);

        // body
        const oBody = _el("div", "u4a-dialog__body" + (opt.bodyFlush ? " u4a-dialog__body--flush" : ""));
        if (opt.bodyEl) { oBody.appendChild(opt.bodyEl); }
        oDlg.appendChild(oBody);

        // footer (buttons)
        const oFoot = _el("div", "u4a-dialog__footer");
        (opt.buttons || []).forEach(b => {
            let sCls = "u4a-btn";
            if (b.type === "emphasized") { sCls += " u4a-btn--emphasized"; }
            if (b.type === "reject") { sCls += " u4a-btn--negative"; }
            const oBtn = _el("button", sCls);
            if (b.icon) {
                oBtn.innerHTML = b.icon + (b.text ? `<span>${_esc(b.text)}</span>` : "");
            } else {
                oBtn.textContent = b.text || "";
            }
            oBtn.addEventListener("click", () => b.onClick(oCtl));
            oFoot.appendChild(oBtn);
        });
        oDlg.appendChild(oFoot);

        // ESC → cancel
        oDlg.addEventListener("cancel", (ev) => {
            ev.preventDefault();
            if (typeof opt.onCancel === "function") {
                opt.onCancel(oCtl);
            } else {
                oCtl.close();
            }
        });

        document.body.appendChild(oDlg);
        oDlg.showModal();

        if (opt.initialFocusEl) {
            setTimeout(() => opt.initialFocusEl.focus(), 0);
        }

        return oCtl;
    }

    /**
     * 커스텀 셀렉트 (네이티브 <select> 대체 — 펼침 목록까지 테마 적용).
     * @param {Array<{value:string,text:string}>} aItems
     * @param {string} sValue 초기 값
     * @param {Function} [fnChange] 값 변경 콜백(newValue)
     * @returns {HTMLElement} `.value` getter/setter 를 가진 combo 엘리먼트
     */
    function _createSelect(aItems, sValue, fnChange) {

        const oCombo = _el("div", "u4a-combo");
        oCombo.tabIndex = 0;
        oCombo.setAttribute("role", "combobox");
        oCombo.setAttribute("aria-haspopup", "listbox");
        oCombo.setAttribute("aria-expanded", "false");

        const oText = _el("span", "u4a-combo__text");
        const oArrow = _el("span", "u4a-combo__arrow");
        oArrow.innerHTML = ICON.caret;
        oCombo.append(oText, oArrow);

        let sCurrent = sValue;
        let oList = null;
        let iActive = -1;

        function _label(v) {
            const o = aItems.find(i => i.value === v);
            return o ? o.text : "";
        }
        oText.textContent = _label(sCurrent);

        Object.defineProperty(oCombo, "value", {
            get() { return sCurrent; },
            set(v) { sCurrent = v; oText.textContent = _label(v); }
        });

        function _onOutside(ev) {
            if (!oCombo.contains(ev.target) && (!oList || !oList.contains(ev.target))) {
                _close();
            }
        }

        function _setActive(idx) {
            if (!oList) { return; }
            const aEl = oList.querySelectorAll(".u4a-combo__item");
            aEl.forEach((el, i) => { el.dataset.active = (i === idx) ? "true" : "false"; });
            iActive = idx;
            if (aEl[idx]) { aEl[idx].scrollIntoView({ block: "nearest" }); }
        }

        function _open() {
            if (oList) { return; }
            oList = _el("div", "u4a-combo__list");
            oList.setAttribute("role", "listbox");

            aItems.forEach((it, idx) => {
                const oItem = _el("div", "u4a-combo__item");
                oItem.setAttribute("role", "option");
                if (it.value === sCurrent) {
                    oItem.setAttribute("aria-selected", "true");
                    iActive = idx;
                }
                const oLbl = _el("span", null, it.text);
                const oChk = _el("span", "u4a-combo__check");
                oChk.innerHTML = ICON.accept;
                oItem.append(oLbl, oChk);
                oItem.addEventListener("mousedown", (ev) => { ev.preventDefault(); _select(idx); });
                oItem.addEventListener("mousemove", () => _setActive(idx));
                oList.appendChild(oItem);
            });

            // 모달 <dialog> 내부면 top-layer 유지 위해 dialog 에 append
            const oHost = oCombo.closest("dialog") || document.body;
            oHost.appendChild(oList);

            const r = oCombo.getBoundingClientRect();
            oList.style.left = r.left + "px";
            oList.style.top = (r.bottom + 2) + "px";
            oList.style.minWidth = r.width + "px";

            oCombo.dataset.open = "true";
            oCombo.setAttribute("aria-expanded", "true");
            _setActive(iActive < 0 ? 0 : iActive);

            setTimeout(() => document.addEventListener("mousedown", _onOutside), 0);
        }

        function _close() {
            if (!oList) { return; }
            oList.remove();
            oList = null;
            oCombo.removeAttribute("data-open");
            oCombo.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOutside);
        }

        function _select(idx) {
            const it = aItems[idx];
            if (!it) { return; }
            const bChanged = it.value !== sCurrent;
            sCurrent = it.value;
            oText.textContent = it.text;
            _close();
            oCombo.focus();
            if (bChanged && typeof fnChange === "function") {
                fnChange(sCurrent);
            }
        }

        oCombo.addEventListener("click", () => { if (oList) { _close(); } else { _open(); } });
        oCombo.addEventListener("keydown", (ev) => {
            switch (ev.key) {
                case "ArrowDown":
                    ev.preventDefault();
                    if (!oList) { _open(); } else { _setActive(Math.min(iActive + 1, aItems.length - 1)); }
                    break;
                case "ArrowUp":
                    ev.preventDefault();
                    if (oList) { _setActive(Math.max(iActive - 1, 0)); }
                    break;
                case "Enter":
                case " ":
                    ev.preventDefault();
                    if (oList) { _select(iActive); } else { _open(); }
                    break;
                case "Escape":
                    if (oList) { ev.stopPropagation(); _close(); }
                    break;
                case "Tab":
                    _close();
                    break;
            }
        });

        return oCombo;
    }

    function _attachSplitterDrag(oBar, oLeftPane) {
        let bDrag = false;
        oBar.addEventListener("mousedown", (ev) => {
            bDrag = true;
            ev.preventDefault();
            document.body.style.cursor = "col-resize";
        });
        window.addEventListener("mousemove", (ev) => {
            if (!bDrag) { return; }
            const oSplitter = oBar.parentElement;
            const oRect = oSplitter.getBoundingClientRect();
            let iWidth = ev.clientX - oRect.left;
            const iMin = 120;
            const iMax = oRect.width - 200;
            iWidth = Math.max(iMin, Math.min(iMax, iWidth));
            oLeftPane.style.flex = `0 0 ${iWidth}px`;
            // 스플리터 드래그 시 테이블 반응형 즉시 갱신
            if (oAPP.fn.fnUpdateTableWidthClass) {
                oAPP.fn.fnUpdateTableWidthClass();
            }
        });
        window.addEventListener("mouseup", () => {
            if (bDrag) {
                bDrag = false;
                document.body.style.cursor = "";
            }
        });
    }

    function _positionMenu(oMenu, oAnchor) {
        const oRect = oAnchor.getBoundingClientRect();
        const iMenuW = oMenu.offsetWidth;
        let iLeft = oRect.right - iMenuW;
        if (iLeft < 4) { iLeft = 4; }
        oMenu.style.top = (oRect.bottom + 2) + "px";
        oMenu.style.left = iLeft + "px";
    }

    let _fnOutside;
    function _bindOutsideClose(oMenu) {
        _fnOutside = (ev) => {
            if (!oMenu.contains(ev.target)) {
                _closeAllMenus();
            }
        };
        setTimeout(() => document.addEventListener("mousedown", _fnOutside), 0);
        document.addEventListener("keydown", _escClose);
    }
    function _escClose(ev) {
        if (ev.key === "Escape") { _closeAllMenus(); }
    }
    function _closeAllMenus() {
        document.querySelectorAll(".u4a-menu").forEach(o => o.remove());
        if (_fnOutside) {
            document.removeEventListener("mousedown", _fnOutside);
            _fnOutside = null;
        }
        document.removeEventListener("keydown", _escClose);
    }

    /********************************************************************
     * 네트워크 online/offline (doc 02 §2.5) — 상태 플래그 유지
     ********************************************************************/
    window.addEventListener("online", () => { oAPP.attr.bIsNwActive = true; });
    window.addEventListener("offline", () => { oAPP.attr.bIsNwActive = false; });

})(window);
