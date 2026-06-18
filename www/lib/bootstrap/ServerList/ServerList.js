/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ServerList.js  (Bootstrap 5.0.2 edition)
 * - file Desc : U4A Workspace Logon Pad — Bootstrap 라이브러리 기반 재구성
 * ----------------------------------------------------------------------
 *  · UI 렌더링은 Bootstrap 5.0.2 컴포넌트(버튼/테이블/모달/드롭다운/토스트/
 *    배지/폼/스피너)로 전면 교체.
 *  · Electron/Node 백엔드 로직(REMOTE/FS/regedit/Named Pipe/XHR/BrowserWindow/
 *    레지스트리·SAPGUI 버전·로그인·서버정보 저장)은 원본 ServerList_v2 와
 *    동일하게 유지한다 (호출부 불변).
 *  · 기존 net 모듈(ServerList_v2/modules/Server/net)을 그대로 재사용한다.
 ************************************************************************/

(function (window) {
    "use strict";

    /**
     * "ResizeObserver loop limit exceeded" 등 무해한 경고는 전역 에러 핸들러가
     * 크리티컬 오류로 오인하지 않도록 가장 먼저 가로채 무시한다.
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
     * Electron / Node 자원 (유지)
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
        // 기존 net 모듈 재사용 (Named Pipe / U4A EDU 연동)
        oU4ASERV = require(PATH.join(APPPATH, "ServerList_v2", "modules", "Server", "net", "index.js")),
        XHR = new XMLHttpRequest();

    XHR.withCredentials = true;

    // 전역 에러 로거 (net/index.js 등이 전역 zconsole 참조)
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

    // 전역 노출 (iframe/팝업/Named Pipe 모듈 호환 계약 유지)
    Object.assign(window, {
        REMOTE: REMOTE, CURRWIN: CURRWIN, APP: APP, PATH: PATH, FS: FS,
        REGEDIT: REGEDIT, XMLJS: XMLJS, RANDOM: RANDOM, IPCRENDERER: IPCRENDERER,
        WSUTIL: WSUTIL, SETTINGS: SETTINGS, PATHINFO: PATHINFO, XHR: XHR,
        oU4ASERV: oU4ASERV, APPPATH: APPPATH, USERDATA: USERDATA
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
     * oAPP 네임스페이스
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
     * 상태 저장소 (UI5 JSONModel 대체)
     ********************************************************************/
    const M = {
        data: { ServerList: [], SAPLogon: {}, SAPLogonItems: [], WSLANGU: {} },
        getProperty(sPath) {
            if (!sPath || sPath === "/") { return this.data; }
            const aParts = sPath.replace(/^\//, "").split("/");
            let o = this.data;
            for (const p of aParts) {
                if (o == null) { return undefined; }
                o = o[p];
            }
            return o;
        },
        setProperty(sPath, val) {
            const aParts = sPath.replace(/^\//, "").split("/");
            let o = this.data;
            for (let i = 0; i < aParts.length - 1; i++) {
                if (o[aParts[i]] == null) { o[aParts[i]] = {}; }
                o = o[aParts[i]];
            }
            o[aParts[aParts.length - 1]] = val;
        },
        refresh() { oAPP.fn.fnRenderServerTable(); }
    };
    oAPP.model = M;

    /********************************************************************
     * i18n 텍스트 헬퍼 (메시지 키 → 텍스트)
     ********************************************************************/
    const MSG_FALLBACK = {
        "001": "Language", "004": "U4A Workspace Logon Pad", "005": "Theme",
        "044": "About WS..", "204": "Sound", "809": "Sort", "810": "Ascending", "811": "Descending"
    };
    function T(sMsgNr) {
        const oCls = M.getProperty("/WSLANGU/ZMSG_WS_COMMON_001");
        if (oCls && typeof oCls[sMsgNr] !== "undefined" && oCls[sMsgNr] !== "") {
            return oCls[sMsgNr];
        }
        return MSG_FALLBACK[sMsgNr] || "";
    }

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid)
     ********************************************************************/
    const _fa = (sName) => `<i class="fa-solid fa-${sName}"></i>`;
    const ICON = {
        min: _fa("window-minimize"), max: _fa("window-maximize"), restore: _fa("window-restore"),
        close: _fa("xmark"), chevron: _fa("chevron-right"), caret: _fa("chevron-down"),
        folder: _fa("folder"), gear: _fa("gear"), settings: _fa("gear"), translate: _fa("language"),
        palette: _fa("palette"), sound: _fa("volume-high"), hint: _fa("circle-info"),
        edit: _fa("pen"), trash: _fa("trash"), accept: _fa("check"), decline: _fa("xmark"),
        clear: _fa("xmark"), sortAsc: _fa("arrow-up"), sortDesc: _fa("arrow-down"), filter: _fa("filter"),
        confirm: _fa("circle-question"), success: _fa("circle-check"),
        error: _fa("circle-xmark"), warning: _fa("triangle-exclamation")
    };

    /********************************************************************
     * 테마 (horizon_* → Bootstrap data-bs-theme + 액센트)
     ********************************************************************/
    /**
     * 테마 팔레트. Bootstrap 자체 테마는 light/dark 둘뿐이므로, 색상 테마
     * (purple/red/green)는 "화이트(light) 베이스 + 커스텀 액센트"로 직접 만든다.
     *   mode      : 베이스(light|dark) → data-sl-theme
     *   accent    : 주 색상 (버튼/선택/포커스/링크/타이틀바 그라데이션)
     *   hover     : 액센트 hover
     *   soft      : 액센트 연한 배경(선택 하이라이트/배지/포커스 링)
     *   bar       : 타이틀바 베이스색
     *   bg        : (선택) 캔버스(트리/테이블 배경) 색조 — 테마 색을 화이트에 옅게
     *               섞어 배경까지 테마를 따라가게 한다(진짜 테마 전환 느낌).
     *   surface/2 : (선택) 표면(서브헤더/테이블 헤더) 및 hover 색조 — bg 보다 살짝 진하게.
     *   border    : (선택) 테두리 색조.
     *   미지정(white/dark)이면 CSS 기본 중립 팔레트를 그대로 쓴다.
     */
    const THEME_MAP = {
        horizon_white: { mode: "light", accent: "#0070f2", hover: "#0064d9", soft: "rgba(0,112,242,.14)", bar: "#354a5f", bar2: "#2c5a7a" },
        horizon_dark: { mode: "dark", accent: "#3c93f5", hover: "#5aa6f7", soft: "rgba(60,147,245,.18)", bar: "#1b2a3a", bar2: "#22405e" },
        horizon_purple: { mode: "light", accent: "#7a3ff2", hover: "#6a2fe0", soft: "rgba(122,63,242,.16)", bar: "#4a2a6f", bar2: "#5e3491", bg: "#f6f2fe", surface: "#efe8fd", surface2: "#e7dcfb", border: "#e3d8f6" },
        horizon_red: { mode: "light", accent: "#e23b3b", hover: "#c92f2f", soft: "rgba(226,59,59,.15)", bar: "#6f2a2a", bar2: "#8c3030", bg: "#fdf4f4", surface: "#fbeaea", surface2: "#f7dcdc", border: "#f2d6d6" },
        horizon_green: { mode: "light", accent: "#1f9d57", hover: "#178047", soft: "rgba(31,157,87,.15)", bar: "#244d2c", bar2: "#2c6639", bg: "#f1faf4", surface: "#e6f5ec", surface2: "#d6eede", border: "#d3ead9" }
    };
    const THEME_ALIAS = {
        sap_horizon: "horizon_white", sap_horizon_dark: "horizon_dark",
        sap_horizon_hcb: "horizon_dark", sap_horizon_hcw: "horizon_white",
        white: "horizon_white", dark: "horizon_dark", purple: "horizon_purple",
        red: "horizon_red", green: "horizon_green"
    };
    function _normTheme(sKey) {
        if (!sKey) { return "horizon_white"; }
        if (THEME_MAP[sKey]) { return sKey; }
        if (THEME_ALIAS[sKey]) { return THEME_ALIAS[sKey]; }
        return "horizon_white";
    }
    function applyBsTheme(sKey) {
        const sNorm = _normTheme(sKey);
        const oT = THEME_MAP[sNorm];
        oAPP.attr._curTheme = sNorm;
        const oRoot = document.documentElement;
        // Bootstrap 5.0.2 는 data-bs-theme 미지원 → 자체 data-sl-theme 로 라이트/다크 전환
        oRoot.setAttribute("data-sl-theme", oT.mode);
        oRoot.style.setProperty("--u4a-accent", oT.accent);
        oRoot.style.setProperty("--u4a-accent-hover", oT.hover);
        oRoot.style.setProperty("--u4a-accent-soft", oT.soft);
        oRoot.style.setProperty("--u4a-titlebar-bg", oT.bar);
        oRoot.style.setProperty("--u4a-titlebar-bg2", oT.bar2 || oT.bar);
        // 색조 팔레트(선택). 미지정(white/dark)이면 CSS 기본 팔레트로 되돌린다.
        const _setVar = (sName, sVal) => {
            if (sVal) { oRoot.style.setProperty(sName, sVal); }
            else { oRoot.style.removeProperty(sName); }
        };
        _setVar("--sl-bg", oT.bg);
        _setVar("--sl-surface", oT.surface);
        _setVar("--sl-surface-2", oT.surface2);
        _setVar("--sl-border", oT.border);
    }
    function currentTheme() { return oAPP.attr._curTheme || "horizon_white"; }

    /********************************************************************
     * Busy / Toast / MessageBox (Bootstrap)
     ********************************************************************/
    oAPP.fn.setBusyIndicator = function (sIsBusy) {
        const oDom = document.getElementById("u4aWsBusyIndicator");
        if (!oDom) { return; }
        const bBusy = (sIsBusy === "X");
        document.body.style.pointerEvents = bBusy ? "none" : "";
        oDom.dataset.busy = bBusy ? "true" : "false";
    };
    oAPP.setBusy = function (bIsBusy) {
        oAPP.fn.setBusyIndicator(bIsBusy ? "X" : "");
    };

    oAPP.fn.showToast = function (sMsg) {
        const oWrap = document.getElementById("u4aWsToastWrap");
        if (!oWrap || typeof bootstrap === "undefined") { return; }
        const oToast = _el("div", "toast align-items-center border-0 bg-dark text-white");
        oToast.setAttribute("role", "alert");
        oToast.setAttribute("aria-live", "assertive");
        oToast.setAttribute("aria-atomic", "true");
        const oFlex = _el("div", "d-flex");
        oFlex.appendChild(_el("div", "toast-body", sMsg));
        const oBtn = _el("button", "btn-close btn-close-white me-2 m-auto");
        oBtn.type = "button";
        oBtn.setAttribute("data-bs-dismiss", "toast");
        oFlex.appendChild(oBtn);
        oToast.appendChild(oFlex);
        oWrap.appendChild(oToast);
        const bt = new bootstrap.Toast(oToast, { delay: 3000 });
        oToast.addEventListener("hidden.bs.toast", () => oToast.remove());
        bt.show();
    };

    // sap.m.MessageBox 대체 — Bootstrap modal
    oAPP.fn.fnShowMessageBox = function (TYPE, sMsg, fnCallback) {
        const oMeta = ({
            C: { icon: ICON.confirm, title: L("dlgConfirm") },
            S: { icon: ICON.success, title: L("dlgSuccess") },
            E: { icon: ICON.error, title: L("dlgError") },
            W: { icon: ICON.warning, title: L("dlgWarning") }
        })[TYPE] || { icon: "", title: "" };

        const oBody = _el("div");
        oBody.style.whiteSpace = "pre-wrap";
        oBody.style.lineHeight = "1.45";
        oBody.textContent = sMsg;

        let oCtl;
        const _done = (sAction) => {
            oCtl.close();
            if (typeof fnCallback === "function") { fnCallback(sAction); }
        };

        const aButtons = [
            { text: T("002") || "OK", type: "emphasized", onClick: () => _done("OK") }
        ];
        if (TYPE === "C") {
            aButtons.push({ text: T("003") || "Cancel", onClick: () => _done("CANCEL") });
        }

        oCtl = _createFormDialog({
            title: oMeta.title,
            icon: oMeta.icon,
            iconType: TYPE,
            bodyEl: oBody,
            width: "28rem",
            buttons: aButtons,
            onCancel: (c) => {
                c.close();
                if (TYPE === "C" && typeof fnCallback === "function") { fnCallback("CANCEL"); }
            }
        });

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
            if (oSettingInfo.globalSound !== "X") { return; }
            const sSoundRootPath = PATH.join(APPPATH, "sound", "sap");
            const oAudio = document.getElementById("u4aWsAudio");
            let sAudioPath = "";
            switch (TYPE) {
                case "01": sAudioPath = PATH.join(sSoundRootPath, 'sapmsg.wav'); break;
                case "02": sAudioPath = PATH.join(sSoundRootPath, 'saperror.wav'); break;
            }
            if (!oAudio || !oAudio.paused) { return; }
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
        // 글로벌 설정 테마 → Bootstrap 테마 적용
        try {
            const oTheme = oAPP.data.GlobalSettings.theme;
            const sTheme = (oTheme && oTheme.value) ? oTheme.value : SETTINGS.defaultTheme;
            applyBsTheme(sTheme);
        } catch (e) {
            applyBsTheme("horizon_white");
        }
        // [흰색 플래시] 첫 페인트용 동기 배경(--boot-bg) 역할 종료 → 제거
        try {
            requestAnimationFrame(function () {
                document.documentElement.style.removeProperty("--boot-bg");
            });
        } catch (e) { }
        oAPP.fn.fnOnMainStart();
    };

    /********************************************************************
     * 프로그램 시작
     ********************************************************************/
    oAPP.fn.fnOnMainStart = async function () {

        oAPP.setBusy(true);

        await oAPP.fn.fnWsGlobalMsgList();

        _createTaskBarMenu();
        _attachCurrentWindowEvents();
        _attachWindowCloseGuard();

        await oAPP.fn.fnOnInitModeling();

        oAPP.fn.fnRenderShell();

        await _getMsgServPortList();

        await oAPP.fn.fnOnListupSapLogon();

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
            const C = (nr) => WSUTIL.getWsMsgClsTxt(sWsLangu, "/U4A/CL_WS_COMMON", nr);
            oAPP.msg.FILTERVAL = C("A68"); oAPP.msg.CLEARFILTER = C("A69");
            oAPP.msg.M01 = G("007"); oAPP.msg.M02 = G("008"); oAPP.msg.M03 = G("009");
            oAPP.msg.M04 = G("010"); oAPP.msg.M05 = G("011"); oAPP.msg.M06 = G("012");
            oAPP.msg.M07 = G("013"); oAPP.msg.M08 = G("014"); oAPP.msg.M09 = G("015");
            oAPP.msg.M10 = G("016"); oAPP.msg.M11 = G("017"); oAPP.msg.M12 = G("018");
            oAPP.msg.M13 = G("019"); oAPP.msg.M14 = G("020"); oAPP.msg.M15 = G("080");
            oAPP.msg.M16 = G("206"); oAPP.msg.M270 = G("270"); oAPP.msg.M271 = G("271");
            oAPP.msg.M048 = G("048"); oAPP.msg.M049 = G("049");
            oAPP.msg.M017 = "A problem occurred while saving the server settings.";
        } catch (e) {
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
            oAPP.msg.FILTERVAL = "Filter Value"; oAPP.msg.CLEARFILTER = "Clear Filter";
        }
    };

    /********************************************************************
     * i18n 모델 구성
     ********************************************************************/
    oAPP.fn.fnOnInitModeling = async function () {
        try {
            const aMsgTxtList = _getModelBindMsgTxtList();
            const oLanguTextResult = WSUTIL.getWsMsgClsModelData(aMsgTxtList);
            if (oLanguTextResult.RETCD === "E") { return; }
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
                if (err) { return resolve({ RETCD: "E" }); }
                return resolve({ RETCD: "S", RDATA: stdout });
            });
        });
    }

    async function _getMsgServPortList() {
        try {
            const oSys32Services = await _getSys32Services();
            if (oSys32Services.RETCD === "E") { return; }
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
                if (err) { reject(sErrMsg); return; }
                const oSapLogon = result[sSaplogonPath];
                if (typeof oSapLogon === "undefined" || oSapLogon.exists === false) {
                    reject(sErrMsg); return;
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
                if (err) { reject(err.toString()); return; }
                const xmlOption = { ignoreComment: true, ignoreDeclaration: true, compact: true, spaces: 4 };
                const sResult = XMLJS.xml2json(data, xmlOption);
                const oResult = JSON.parse(sResult);
                resolve({ "fileName": sFileName, "Result": oResult.Landscape });
            });
        });
    };

    oAPP.fn.fnReadSAPLogonDataThen = function (oResult) {
        return new Promise(async (resolve) => {

            const oCheckVer = await oAPP.fn.fnCheckSapguiVersion();
            if (oCheckVer.RETCD === "E") {
                oAPP.fn.fnShowMessageBox("E", oCheckVer.RTMSG, () => { APP.exit(); });
                console.error(oCheckVer.RTMSG);
                oAPP.setBusy(false);
                return;
            }

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

            oAPP.data.SAPLogon[oResult.fileName] = oResult.Result;

            const oLogonResult = oAPP.fn.fnSetSAPLogonLandscapeList();
            if (oLogonResult.RETCD === "E") {
                oAPP.fn.fnShowMessageBox("E", oLogonResult.RTMSG);
                console.error(oLogonResult.RTMSG);
                oAPP.setBusy(false);
                return;
            }

            oAPP.fn.fnCreateWorkspaceTree();

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
            if (!APP.isPackaged) { sPsRoot = "C:\\"; }
            const ps = SPAWN("powershell.exe", [
                "-ExecutionPolicy", "Bypass", "-File", PS_PATH.GET_SAPGUI_INFO
            ], { cwd: sPsRoot });

            let aShellConsole = [];

            ps.stdout.on("data", (data) => {
                if (!data || !data.toString().trim()) { return; }
                const sLog = `${data.toString()}`;
                console.log(sLog);
                const aSplit = sLog.split(/\r?\n/).filter(e => e !== "");
                aShellConsole = aShellConsole.concat(aSplit);
            });

            ps.stderr.on("data", (data) => {
                const sLog = `${data.toString()}`;
                console.error(sLog);
                if (!ps.killed) { ps.kill(9); }
                return resolve({ SUBRC: 999, LOG: sLog });
            });

            ps.on("close", (code) => {
                if (!ps.killed) { ps.kill(9); }
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

            if (oServiceAttr.shortcut && oServiceAttr.shortcut === "1") { continue; }

            if (oServiceAttr.mode && oServiceAttr.mode === "1") {
                const aServer = oServiceAttr.server.split(":");
                oServiceAttr.host = aServer[0];
                oServiceAttr.port = aServer[1];
            }

            if (oServiceAttr.routerid && oAPP.data.SAPLogon.aRouters) {
                const oRouter = oAPP.data.SAPLogon.aRouters.find(e => e._attributes.uuid === oServiceAttr.routerid);
                oServiceAttr.router = (oRouter == null ? {} : oRouter._attributes);
            }

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
        if (!aNode || aNode.length === 0) { return aNode; }
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
     * 셸 렌더 — 타이틀바 / 서브헤더 / 스플리터 (Bootstrap 마크업)
     ********************************************************************/
    oAPP.fn.fnRenderShell = function () {

        const oContent = document.getElementById("content");
        oContent.innerHTML = "";

        const oPage = _el("div", "sl-page");

        // ── 커스텀 타이틀바 (프레임리스 창 제어) ──
        const oTitlebar = _el("header", "sl-titlebar");
        const oLogo = _el("img", "sl-titlebar__logo");
        oLogo.src = _toFileUrl(PATHINFO.WS_LOGO);
        oLogo.alt = "U4A";
        oLogo.addEventListener("error", () => { oLogo.style.visibility = "hidden"; });
        const oTitle = _el("span", "sl-titlebar__title", "U4A Workspace");
        const oSpacer = _el("div", "sl-titlebar__spacer");

        const oMinBtn = _winBtn(ICON.min, "Minimize", () => CURRWIN.minimize());
        const oMaxBtn = _winBtn(CURRWIN.isMaximized() ? ICON.restore : ICON.max, "Maximize", () => {
            if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); }
        });
        oMaxBtn.id = "u4aWsMaxBtn";
        const oCloseBtn = _winBtn(ICON.close, "Close", oAPP.fn.fnRequestClose);
        oCloseBtn.classList.add("sl-winbtn--close");

        oTitlebar.append(oLogo, oTitle, oSpacer, oMinBtn, oMaxBtn, oCloseBtn);

        // ── 서브헤더 (Logon Pad 타이틀 + 설정 메뉴) ──
        const oSubBar = _el("div", "sl-subbar");
        const oSubTitle = _el("span", "sl-subbar__title", T("004"));
        oAPP.attr._elSubTitle = oSubTitle;
        const oSubSpacer = _el("div", "sl-subbar__spacer");

        const oSettingsBtn = _el("button", "sl-icon-btn sl-icon-btn--lg");
        oSettingsBtn.title = L("settings");
        oSettingsBtn.setAttribute("aria-haspopup", "true");
        oSettingsBtn.innerHTML = ICON.gear;
        oSettingsBtn.addEventListener("click", (ev) => oAPP.fn.fnOpenSettingsMenu(ev));
        oSubBar.append(oSubTitle, oSubSpacer, oSettingsBtn);

        // ── 본문: 스플리터 (좌 트리 / 우 테이블) ──
        const oBody = _el("div", "sl-body");
        const oSplitter = _el("div", "sl-splitter");

        const oPaneLeft = _el("div", "sl-pane sl-pane--tree");
        oPaneLeft.id = "u4aWsTreePane";

        const oGutter = _el("div", "sl-gutter");
        oGutter.setAttribute("role", "separator");
        _attachSplitterDrag(oGutter, oPaneLeft);

        const oPaneRight = _el("div", "sl-pane sl-pane--table");
        oPaneRight.id = "u4aWsTablePane";

        oSplitter.append(oPaneLeft, oGutter, oPaneRight);
        oBody.appendChild(oSplitter);

        oPage.append(oTitlebar, oSubBar, oBody);
        oContent.appendChild(oPage);

        oAPP.fn.fnRenderServerTable();

        setTimeout(() => { oContent.dataset.show = "true"; }, 50);
    };

    // 현재 WS 언어 코드 (KO/EN)
    function _getCurrentWsLangu() {
        try {
            const oG = oAPP.data.GlobalSettings && oAPP.data.GlobalSettings.language;
            if (oG && oG.value) { return String(oG.value).toUpperCase(); }
            const oS = WSUTIL.getWsSettingsInfo();
            return String((oS && oS.globalLanguage) || "EN").toUpperCase();
        } catch (e) {
            return "EN";
        }
    }

    /**
     * 서버리스트 화면 전용 i18n (컬럼 헤더/버튼/상태 등 메시지 클래스에 없는 라벨).
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

    oAPP.fn.fnRefreshShellTexts = function () {
        if (oAPP.attr._elSubTitle) {
            oAPP.attr._elSubTitle.textContent = T("004");
        }
        oAPP.fn.fnRenderServerTable();
    };

    /********************************************************************
     * 좌측 워크스페이스 트리 렌더 (Bootstrap 스타일 트리)
     ********************************************************************/
    oAPP.fn.fnRenderTree = function () {
        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane) { return; }
        oPane.innerHTML = "";

        const oRoot = _el("ul", "sl-tree");
        oRoot.setAttribute("role", "tree");

        const oSAPLogon = M.getProperty("/SAPLogon");
        const aNode = (oSAPLogon && oSAPLogon.Node) ? oSAPLogon.Node : [];

        for (const oNode of aNode) {
            _renderTreeNode(oRoot, oNode, 0, true);
        }
        oPane.appendChild(oRoot);
    };

    function _renderTreeNode(oParentUl, oNode, iLevel, bExpanded) {
        const oAttr = oNode._attributes || {};
        const aChildNodes = oNode.Node ? (Array.isArray(oNode.Node) ? oNode.Node : [oNode.Node]) : [];
        const bHasChild = aChildNodes.length > 0;

        const oLi = _el("li");
        oLi.setAttribute("role", "treeitem");

        const oRow = _el("div", "sl-tree__row");
        oRow.style.paddingLeft = (0.5 + iLevel * 1.0) + "rem";
        oRow.tabIndex = 0;
        oRow._nodeData = oNode;
        if (bHasChild) {
            oRow.setAttribute("aria-expanded", bExpanded ? "true" : "false");
        }

        const oToggle = _el("button", "sl-tree__toggle");
        oToggle.innerHTML = ICON.chevron;
        if (!bHasChild) {
            oToggle.classList.add("sl-tree__toggle--leaf");
        } else {
            oToggle.dataset.open = bExpanded ? "true" : "false";
        }
        oToggle.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const oChildUl = oLi.querySelector(":scope > ul");
            if (!oChildUl) { return; }
            const bNowOpen = oRow.getAttribute("aria-expanded") === "true";
            oRow.setAttribute("aria-expanded", bNowOpen ? "false" : "true");
            oToggle.dataset.open = bNowOpen ? "false" : "true";
            oChildUl.hidden = bNowOpen;
        });

        const oIcon = _el("span", "sl-tree__icon");
        oIcon.innerHTML = ICON.folder;

        const oLabel = _el("span", "sl-tree__label", oAttr.name || "");
        oLabel.title = oAttr.name || "";

        oRow.append(oToggle, oIcon, oLabel);

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
            for (const oChild of aChildNodes) {
                _renderTreeNode(oChildUl, oChild, iLevel + 1, iLevel < 1);
            }
            oLi.appendChild(oChildUl);
        }

        oParentUl.appendChild(oLi);
    }

    /********************************************************************
     * 트리 노드 선택 → 우측 서버 목록 필터
     ********************************************************************/
    oAPP.fn.fnSelectTreeNode = function (oRow) {
        const oPane = document.getElementById("u4aWsTreePane");
        if (oPane) {
            const oPrev = oPane.querySelector('.sl-tree__row[aria-selected="true"]');
            if (oPrev) { oPrev.removeAttribute("aria-selected"); }
        }
        oRow.setAttribute("aria-selected", "true");

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
        oAPP.attr._lastSelectedServerKey = (oItem && oItem.uuid) || "";
        if (!bSkipPersist && oAPP.attr._lastSelectedServerKey) {
            oAPP.fn.setRegistryLastSelectedServerKey(oAPP.attr._lastSelectedServerKey);
        }
    }

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

        oAPP.attr._colFilters = {};
        oAPP.attr._sortCol = null;
        oAPP.attr._sortDir = null;

        M.setProperty("/SAPLogonItems", []);

        if (!oNodeData || !oNodeData._attributes) {
            oAPP.fn.fnRenderServerTable();
            return;
        }

        const sUUID = oNodeData._attributes.uuid;

        await oAPP.fn.setRegistryLastSelectedNodeKey(sUUID);

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
            aItemList.push(_deepClone(oFindItem));
        }

        aItemList.sort((a, b) => a.name.localeCompare(b.name));

        M.setProperty("/SAPLogonItems", aItemList);

        _syncSavedServerInfo(M);

        oAPP.fn.fnRenderServerTable();
    };

    /********************************************************************
     * 마지막 선택 노드/서버 키 저장/복원 (레지스트리 — Electron/Node 유지)
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
                if (oRegData && oRegData.values && oRegData.values["LastSelectedServerKey"]) {
                    oAPP.attr._lastSelectedServerKey = oRegData.values["LastSelectedServerKey"].value;
                }
            }
        } catch (e) { /* 무시 */ }

        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane) { return; }

        let oTarget = null;
        if (sLastKey) {
            const aRows = oPane.querySelectorAll(".sl-tree__row");
            for (const oRow of aRows) {
                const oND = oRow._nodeData;
                if (oND && oND._attributes && oND._attributes.uuid === sLastKey) {
                    oTarget = oRow;
                    break;
                }
            }
        }
        if (!oTarget) {
            oTarget = oPane.querySelector(".sl-tree__row");
        }
        if (oTarget) {
            let oParentLi = oTarget.closest("li");
            while (oParentLi) {
                const oParentUl = oParentLi.parentElement;
                if (oParentUl && oParentUl.classList.contains("sl-tree")) { break; }
                const oOwnerLi = oParentUl ? oParentUl.closest("li") : null;
                if (oOwnerLi) {
                    const oOwnerRow = oOwnerLi.querySelector(":scope > .sl-tree__row");
                    const oOwnerUl = oOwnerLi.querySelector(":scope > ul");
                    if (oOwnerRow && oOwnerUl) {
                        oOwnerRow.setAttribute("aria-expanded", "true");
                        const oOwnerToggle = oOwnerRow.querySelector(".sl-tree__toggle");
                        if (oOwnerToggle) { oOwnerToggle.dataset.open = "true"; }
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
     * 우측 서버 리스트 테이블 렌더 (Bootstrap table)
     ********************************************************************/
    oAPP.fn.fnRenderServerTable = function () {
        const oPane = document.getElementById("u4aWsTablePane");
        if (!oPane) { return; }
        oPane.innerHTML = "";
        oAPP.attr._selectedServer = null;

        // 헤더 툴바 (Edit / Delete)
        const oToolbar = _el("div", "sl-toolbar");
        const oEditBtn = _el("button", "btn btn-sm btn-primary");
        oEditBtn.innerHTML = ICON.edit + " <span>" + _esc(L("edit")) + "</span>";
        oEditBtn.title = L("edit");
        oEditBtn.addEventListener("click", () => oAPP.fn.fnPressEdit());
        const oDelBtn = _el("button", "btn btn-sm btn-danger");
        oDelBtn.innerHTML = ICON.trash + " <span>" + _esc(L("del")) + "</span>";
        oDelBtn.title = L("del");
        oDelBtn.addEventListener("click", () => oAPP.fn.fnPressDelete());
        const oTbSpacer = _el("div", "sl-toolbar__spacer");
        const oCount = _el("span", "sl-count");
        oToolbar.append(oEditBtn, oDelBtn, oTbSpacer, oCount);
        oPane.appendChild(oToolbar);

        const oWrap = _el("div", "sl-table-wrap");
        const oTable = _el("table", "table table-sm table-hover sl-table align-middle");
        oTable.id = SERVER_TBL_ID;

        const aCols = [
            { key: "ISSAVE", label: L("status"), sortable: true, width: "6rem" },
            { key: "name", label: L("serverName"), sortable: true, cls: "sl-col-name" },
            { key: "systemid", label: L("sid"), sortable: true, width: "5rem" },
            { key: "host", label: L("host"), sortable: true, width: "9rem" },
            { key: "insno", label: L("sno"), sortable: true, align: "center", width: "4rem" },
            { key: "__action", label: L("settingsCol"), sortable: false, align: "center", width: "5.5rem" }
        ];

        const oFilters = oAPP.attr._colFilters || {};
        const oThead = _el("thead");
        const oHrow = _el("tr");
        for (const oCol of aCols) {
            const oTh = _el("th");
            if (oCol.width) { oTh.style.width = oCol.width; }
            oTh.scope = "col";

            const oInner = _el("div", "sl-th__inner");
            if (oCol.align === "center") { oInner.classList.add("sl-th__inner--center"); }
            oInner.appendChild(_el("span", null, oCol.label));

            if (oCol.sortable) {
                const bSorted = (oAPP.attr._sortCol === oCol.key);
                const bFiltered = !!oFilters[oCol.key];
                if (bSorted || bFiltered) {
                    const oInd = _el("span", "sl-th__ind");
                    if (bSorted) {
                        oInd.innerHTML += (oAPP.attr._sortDir === "desc") ? ICON.sortDesc : ICON.sortAsc;
                    }
                    if (bFiltered) {
                        oInd.innerHTML += ICON.filter;
                    }
                    oInner.appendChild(oInd);
                }
                oTh.appendChild(oInner);
                oTh.classList.add("sl-th--menu");
                oTh.dataset.col = oCol.key;
                oTh.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    oAPP.fn.fnOpenColumnMenu(oCol, oTh);
                });
            } else {
                oTh.appendChild(oInner);
            }
            oHrow.appendChild(oTh);
        }
        oThead.appendChild(oHrow);
        oTable.appendChild(oThead);

        const oTbody = _el("tbody");
        const aItems = _buildServerView(M.getProperty("/SAPLogonItems") || []);

        // 툴바 우측 서버 개수 칩
        const iActive = aItems.filter((o) => o.ISSAVE === true).length;
        oCount.innerHTML = '<i class="fa-solid fa-server"></i> <b>' + aItems.length + '</b>'
            + (iActive ? ' &middot; <span class="sl-count__on">' + iActive + ' ' + _esc(L("active")) + '</span>' : '');

        if (aItems.length === 0) {
            const oTr = _el("tr", "sl-nodata");
            const oTd = _el("td");
            oTd.colSpan = aCols.length;
            const oEmpty = _el("div", "sl-empty");
            oEmpty.innerHTML = '<i class="fa-regular fa-folder-open"></i>';
            oEmpty.appendChild(_el("span", null, L("noData")));
            oTd.appendChild(oEmpty);
            oTr.appendChild(oTd);
            oTbody.appendChild(oTr);
        } else {
            aItems.forEach((oItem) => {
                const oTr = _el("tr", "server-row");
                oTr.dataset.uuid = oItem.uuid || "";
                oTr.tabIndex = 0;
                oTr._rowData = oItem;

                // STATUS (커스텀 소프트 배지 + 상태 점)
                const oTdStatus = _el("td");
                const bSave = (oItem.ISSAVE === true);
                const oStatus = _el("span", "sl-status " + (bSave ? "sl-status--active" : "sl-status--inactive"));
                oStatus.appendChild(_el("span", "sl-status__dot"));
                oStatus.appendChild(_el("span", null, bSave ? L("active") : L("inactive")));
                oTdStatus.appendChild(oStatus);

                const oTdName = _el("td", "sl-col-name", oItem.name || "");
                oTdName.title = oItem.name || "";
                const oTdSid = _el("td", null, oItem.systemid || "");
                const oTdHost = _el("td", null, oItem.host || "");
                const oTdSno = _el("td", "text-center", oItem.insno || "");

                // Settings 버튼
                const oTdAct = _el("td", "text-center");
                const oActBtn = _el("button", "sl-icon-btn");
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

        // 마지막 선택 서버(행) 복원
        const sRestoreKey = oAPP.attr._lastSelectedServerKey;
        if (sRestoreKey) {
            const oTargetRow = oTbody.querySelector(`tr.server-row[data-uuid="${sRestoreKey}"]`);
            if (oTargetRow && oTargetRow._rowData) {
                _selectServerRow(oTargetRow, oTargetRow._rowData, true);
                oTargetRow.scrollIntoView({ block: "nearest" });
            }
        }
    };

    /**
     * 컬럼의 "화면 표시 텍스트" — 필터/정렬은 사용자가 보는 값 기준.
     */
    function _colDisplayText(sKey, oItem) {
        if (sKey === "ISSAVE") {
            return (oItem.ISSAVE === true) ? L("active") : L("inactive");
        }
        const v = oItem[sKey];
        return (v == null) ? "" : String(v);
    }

    /**
     * 원본 목록 → 화면 뷰(필터 AND 결합 + 단일 컬럼 정렬). 원본 배열 불변.
     */
    function _buildServerView(aSource) {
        let aView = aSource.slice();

        const oF = oAPP.attr._colFilters || {};
        const aKeys = Object.keys(oF).filter((k) => oF[k]);
        if (aKeys.length) {
            aView = aView.filter((oItem) =>
                aKeys.every((k) => _colDisplayText(k, oItem).toLowerCase().indexOf(oF[k]) !== -1)
            );
        }

        if (oAPP.attr._sortCol) {
            const sKey = oAPP.attr._sortCol;
            const iDir = (oAPP.attr._sortDir === "desc") ? -1 : 1;
            aView.sort((a, b) =>
                _colDisplayText(sKey, a).localeCompare(_colDisplayText(sKey, b), undefined, { numeric: true }) * iDir
            );
        }

        return aView;
    }

    /********************************************************************
     * 컬럼 헤더 메뉴 (필터 input + 오름/내림차순 + 초기화) — Bootstrap dropdown
     ********************************************************************/
    oAPP.fn.fnOpenColumnMenu = function (oCol, oAnchorTh) {
        _closeAllMenus();

        oAPP.attr._colFilters = oAPP.attr._colFilters || {};

        const oMenu = _el("div", "dropdown-menu show sl-colmenu sl-menu");
        oMenu.setAttribute("role", "menu");
        oMenu.addEventListener("click", (ev) => ev.stopPropagation());

        // ── 필터 입력 ──
        const oFilterWrap = _el("div", "sl-colmenu__filter");
        const oInput = _el("input", "form-control form-control-sm");
        oInput.type = "text";
        oInput.placeholder = oAPP.msg.FILTERVAL || "";
        oInput.value = oAPP.attr._colFilters[oCol.key] || "";
        const _applyFilter = () => {
            const sVal = oInput.value.trim().toLowerCase();
            const sCur = oAPP.attr._colFilters[oCol.key] || "";
            if (sVal === sCur) { return; }
            if (sVal) { oAPP.attr._colFilters[oCol.key] = sVal; }
            else { delete oAPP.attr._colFilters[oCol.key]; }
            oAPP.fn.fnRenderServerTable();
        };
        oInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") { ev.preventDefault(); _applyFilter(); _closeAllMenus(); }
        });
        oInput.addEventListener("blur", _applyFilter);
        oFilterWrap.appendChild(oInput);
        oMenu.appendChild(oFilterWrap);

        oMenu.appendChild(_el("hr", "dropdown-divider"));

        // ── 정렬 (오름/내림차순) ──
        const _mkSort = (sDir, sIcon, sLabel) => {
            const oRow = _el("button", "dropdown-item d-flex align-items-center gap-2");
            oRow.type = "button";
            oRow.innerHTML = sIcon + "<span>" + _esc(sLabel) + "</span>";
            const bActive = (oAPP.attr._sortCol === oCol.key && oAPP.attr._sortDir === sDir);
            if (bActive) { oRow.classList.add("active"); }
            oRow.addEventListener("click", () => {
                if (bActive) {
                    oAPP.attr._sortCol = null;
                    oAPP.attr._sortDir = null;
                } else {
                    oAPP.attr._sortCol = oCol.key;
                    oAPP.attr._sortDir = sDir;
                }
                oAPP.fn.fnRenderServerTable();
                _closeAllMenus();
            });
            return oRow;
        };
        oMenu.appendChild(_mkSort("asc", ICON.sortAsc, T("810")));
        oMenu.appendChild(_mkSort("desc", ICON.sortDesc, T("811")));

        oMenu.appendChild(_el("hr", "dropdown-divider"));

        // ── 필터 초기화 ──
        const oClear = _el("button", "dropdown-item d-flex align-items-center gap-2");
        oClear.type = "button";
        oClear.innerHTML = ICON.clear + "<span>" + _esc(oAPP.msg.CLEARFILTER || "") + "</span>";
        if (!oAPP.attr._colFilters[oCol.key]) { oClear.classList.add("disabled"); oClear.disabled = true; }
        oClear.addEventListener("click", () => {
            if (!oAPP.attr._colFilters[oCol.key]) { return; }
            delete oAPP.attr._colFilters[oCol.key];
            oInput.value = "";
            oAPP.fn.fnRenderServerTable();
            _closeAllMenus();
        });
        oMenu.appendChild(oClear);

        document.body.appendChild(oMenu);
        _positionMenu(oMenu, oAnchorTh);
        _bindOutsideClose(oMenu);
        setTimeout(() => oInput.focus(), 0);
    };

    /********************************************************************
     * 서버 옵션 팝업 (행 settings 버튼)
     ********************************************************************/
    oAPP.fn.fnPressServerSettings = function (oItem) {

        const oSettings = _deepClone(oItem.settings || {});

        const oForm = _el("div");

        const oChk1Wrap = _el("div", "form-check form-switch mb-2");
        const oChk1 = document.createElement("input");
        oChk1.className = "form-check-input";
        oChk1.type = "checkbox";
        oChk1.id = "sl-set-internal";
        oChk1.checked = !!oSettings.useInternal;
        const oChk1Lbl = _el("label", "form-check-label", "Use Internal");
        oChk1Lbl.setAttribute("for", "sl-set-internal");
        oChk1Wrap.append(oChk1, oChk1Lbl);

        const oChk2Wrap = _el("div", "form-check form-switch");
        const oChk2 = document.createElement("input");
        oChk2.className = "form-check-input";
        oChk2.type = "checkbox";
        oChk2.id = "sl-set-cert";
        oChk2.checked = !!oSettings.skipCertificate;
        const oChk2Lbl = _el("label", "form-check-label", "Skip Certificate");
        oChk2Lbl.setAttribute("for", "sl-set-cert");
        oChk2Wrap.append(oChk2, oChk2Lbl);

        oForm.append(oChk1Wrap, oChk2Wrap);

        _createFormDialog({
            title: `Settings - ${oItem.name || ""}`,
            icon: ICON.settings,
            bodyEl: oForm,
            buttons: [
                {
                    text: T("002") || "OK", icon: ICON.accept, type: "emphasized",
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
                { text: T("003") || "Cancel", icon: ICON.decline, type: "reject", onClick: (oCtl) => oCtl.close() }
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
     * 테이블 툴바 — 수정 / 삭제
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
        if (!oData.ISSAVE) { return; }

        const sAction = await new Promise((resolve) => {
            oAPP.fn.fnShowMessageBox("C", oAPP.msg.M15, resolve);
        });
        if (sAction !== "OK") { return; }

        const oSavedData = oAPP.fn.fnGetSavedServerListDataAll();
        if (oSavedData.RETCD !== "S") {
            oAPP.fn.fnShowMessageBox("E", oSavedData.RTMSG);
            return;
        }
        const aSavedData = oSavedData.RETDATA;
        const iDelIndex = aSavedData.findIndex(elem => elem.uuid === oData.uuid);
        if (iDelIndex < 0) { return; }

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

        oAPP.fn.fnRefreshCurrentFolder();
    };

    /********************************************************************
     * 기 저장된 서버 정보 동기화 / 조회 (SERVERINFO_V2.json — Node FS 유지)
     ********************************************************************/
    function _syncSavedServerInfo(oModel) {
        const aServerList = oModel.getProperty("/SAPLogonItems");
        if (!aServerList || !Array.isArray(aServerList) || aServerList.length === 0) { return; }
        const oSavedAllReturn = oAPP.fn.fnGetSavedServerListDataAll();
        if (oSavedAllReturn.RETCD !== "S") { return; }
        const aSavedServerList = oSavedAllReturn.RETDATA;
        if (aSavedServerList.length === 0) { return; }
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

        if (oTr) { _selectServerRow(oTr, oBindData); }

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

        const oP13nThemeInfo = await fnP13nCreateTheme(oLoginInfo.SYSID);
        if (oP13nThemeInfo.RETCD === "S") {
            oLoginInfo.oThemeInfo = oP13nThemeInfo.RTDATA;
        }

        await _registSelectedSystemInfo(oLoginInfo);

        fnLoginPage(oLoginInfo);
    };

    /********************************************************************
     * 서버 등록/편집 팝업 (fnEditDialogOpen + fnPressSave + fnCheckValid)
     ********************************************************************/
    oAPP.fn.fnEditDialogOpen = function (oBindData) {

        oAPP.setBusy(false);

        const oSaveData = { protocol: "http", host: "", port: "" };
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

        // ── 폼 구성 (Bootstrap) ──
        const oForm = _el("div");

        // Protocol
        const oRowP = _el("div", "mb-3");
        oRowP.appendChild(_mkLabel("Protocol", true));
        const oSelProto = _createSelect(
            [{ value: "http", text: "http" }, { value: "https", text: "https" }],
            oSaveData.protocol
        );
        oRowP.appendChild(oSelProto);
        oForm.appendChild(oRowP);

        // Host (required)
        const oRowH = _el("div", "mb-3");
        oRowH.appendChild(_mkLabel("Host", true));
        const oInpHost = _el("input", "form-control form-control-sm");
        oInpHost.type = "text";
        oInpHost.value = oSaveData.host || "";
        const oHostMsg = _el("div", "invalid-feedback");
        const oHostWrap = _wrapClear(oInpHost);
        oRowH.append(oHostWrap, oHostMsg);
        oForm.appendChild(oRowH);

        // Port
        const oRowPort = _el("div");
        oRowPort.appendChild(_mkLabel("Port", false));
        const oInpPort = _el("input", "form-control form-control-sm");
        oInpPort.type = "number";
        oInpPort.maxLength = 5;
        oInpPort.value = oSaveData.port || "";
        oRowPort.appendChild(_wrapClear(oInpPort));
        oForm.appendChild(oRowPort);

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
                { text: T("002") || "OK", icon: ICON.accept, type: "emphasized", onClick: (oCtl) => oAPP.fn.fnPressSave(oCtl) },
                { text: T("003") || "Cancel", icon: ICON.decline, type: "reject", onClick: (oCtl) => oCtl.close() }
            ]
        });
        oAPP.attr._editCtx.ctl = oDlgCtl;

        const _fnEnter = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); oAPP.fn.fnPressSave(oDlgCtl); } };
        oInpHost.addEventListener("keydown", _fnEnter);
        oInpPort.addEventListener("keydown", _fnEnter);

        oInpHost.addEventListener("input", () => {
            oInpHost.classList.remove("is-invalid");
            oHostMsg.classList.remove("d-block");
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

        const oValid = oAPP.fn.fnCheckValid(oSaveData);
        if (oValid.RETCD === "E") {
            oAPP.setSoundMsg("02");
            return oAPP.setBusy(false);
        }

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

        oCtx.server.ISSAVE = true;

        if (oCtl) { oCtl.close(); }

        oAPP.setSoundMsg("01");
        oAPP.fn.showToast(oAPP.msg.M01);

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

    // 입력값 Validation (host 필수 M13 / 공백 금지 M14)
    oAPP.fn.fnCheckValid = function (oSaveData) {
        const oCtx = oAPP.attr._editCtx;
        const oHost = oCtx ? oCtx.elHost : null;
        const oHostMsg = oCtx ? oCtx.elHostMsg : null;
        const sHost = oSaveData.host;

        function _setHostError(sMsg) {
            if (oHost) { oHost.classList.add("is-invalid"); }
            // .invalid-feedback 는 형제 .is-invalid 에만 반응하는데 input 이 .sl-field 안에
            // 중첩돼 있어 d-block 으로 직접 표시한다.
            if (oHostMsg) { oHostMsg.textContent = sMsg; oHostMsg.classList.add("d-block"); }
            setTimeout(() => { if (oHost) { oHost.focus(); } }, 0);
        }

        if (oHost) { oHost.classList.remove("is-invalid"); }
        if (oHostMsg) { oHostMsg.textContent = ""; oHostMsg.classList.remove("d-block"); }

        if (!sHost || sHost === "") {
            _setHostError(oAPP.msg.M13);
            return { RETCD: "E", RTMSG: oAPP.msg.M13 };
        }
        if (sHost.match(/\s/g)) {
            _setHostError(oAPP.msg.M14);
            return { RETCD: "E", RTMSG: oAPP.msg.M14 };
        }
        return { RETCD: "S" };
    };

    /********************************************************************
     * 로그인 창 (Electron BrowserWindow — 호출부 유지)
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
            SYSID: oLoginInfo.SYSID,
            THEME: oThemeInfo.THEME || "",
            BGCOL: oThemeInfo.BGCOL || ""
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
     * 설정 메뉴 (Bootstrap dropdown)
     ********************************************************************/
    oAPP.fn.fnOpenSettingsMenu = function (oEvent) {
        _closeAllMenus();

        const oBtn = oEvent.currentTarget;
        const oMenu = _el("div", "dropdown-menu show sl-menu");
        oMenu.setAttribute("role", "menu");

        const aItems = [
            { key: "WSLANGU", icon: ICON.translate, text: T("001") },
            { key: "WSTHEME", icon: ICON.palette, text: T("005") },
            { key: "WSSOUND", icon: ICON.sound, text: T("204") },
            { key: "ABOUTWS", icon: ICON.hint, text: T("044") }
        ];

        for (const oItem of aItems) {
            const oRow = _el("button", "dropdown-item d-flex align-items-center gap-2");
            oRow.type = "button";
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

        let aLangu = [{ KEY: "EN" }, { KEY: "KO" }];
        try {
            const sMsgDirPath = PATH.join(APPPATH, "MSG", "WS_COMMON");
            if (FS.existsSync(sMsgDirPath)) {
                const aDir = FS.readdirSync(sMsgDirPath);
                if (aDir.length) { aLangu = aDir.map(s => ({ KEY: s })); }
            }
        } catch (e) { /* 무시 */ }

        let sSelected = "EN";
        try {
            const oWsLangu = await WSUTIL.getGlobalSettingInfo("language");
            if (oWsLangu && oWsLangu.value) { sSelected = oWsLangu.value; }
        } catch (e) { /* 무시 */ }

        const oSel = _createSelect(aLangu.map(l => ({ value: l.KEY, text: l.KEY })), sSelected);

        const oForm = _el("div");
        const oRow = _el("div");
        oRow.append(_mkLabel(T("001"), false), oSel);
        oForm.appendChild(oRow);

        _createFormDialog({
            title: T("000") || "WS Language Settings",
            icon: ICON.translate,
            bodyEl: oForm,
            width: "24rem",
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { oAPP.setBusy(true); await _saveWsLangu(oSel.value, oCtl); } },
                { text: T("003") || "Cancel", type: "reject", onClick: (oCtl) => oCtl.close() }
            ]
        });
    }

    async function _saveWsLangu(sKey, oCtl) {
        try {
            const oSettingInfo = WSUTIL.getWsSettingsInfo();
            oSettingInfo.globalLanguage = sKey;
            WSUTIL.setWsSettingsInfo(oSettingInfo);
            await WSUTIL.saveGlobalSettingInfo("language", sKey);
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
     * [설정] WS 테마 (horizon 5종 → Bootstrap 적용)
     ********************************************************************/
    function _openWSThemeSettingPopup() {

        const aThemes = [
            { KEY: "horizon_white", TXT: "Horizon White" },
            { KEY: "horizon_dark", TXT: "Horizon Dark" },
            { KEY: "horizon_purple", TXT: "Horizon Purple" },
            { KEY: "horizon_red", TXT: "Horizon Red" },
            { KEY: "horizon_green", TXT: "Horizon Green" }
        ];
        const sCurrent = currentTheme();

        const oSel = _createSelect(
            aThemes.map(t => ({ value: t.KEY, text: t.TXT })),
            sCurrent,
            (v) => applyBsTheme(v)   // 실시간 미리보기
        );

        const oForm = _el("div");
        const oRow = _el("div");
        oRow.append(_mkLabel(T("005"), false), oSel);
        oForm.appendChild(oRow);

        _createFormDialog({
            title: T("006") || "Theme Settings",
            icon: ICON.palette,
            bodyEl: oForm,
            width: "24rem",
            onCancel: (oCtl) => { applyBsTheme(sCurrent); oCtl.close(); },
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { oAPP.setBusy(true); await _saveWsThemeInfo(oSel.value, oCtl); } },
                { text: T("003") || "Cancel", type: "reject", onClick: (oCtl) => { applyBsTheme(sCurrent); oCtl.close(); } }
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
        applyBsTheme(sKey);
        oCtl.close();
        oAPP.setBusy(false);
        oAPP.fn.showToast(oAPP.msg.M01);
    }

    /********************************************************************
     * [설정] WS 사운드 (Bootstrap switch)
     ********************************************************************/
    function _openWsSoundSettingPopup() {

        const oSwitchWrap = _el("div", "form-check form-switch");
        const oChk = document.createElement("input");
        oChk.className = "form-check-input";
        oChk.type = "checkbox";
        oChk.id = "sl-sound-switch";
        const oSwLbl = _el("label", "form-check-label", T("205") || "Sound Settings");
        oSwLbl.setAttribute("for", "sl-sound-switch");
        oSwitchWrap.append(oChk, oSwLbl);

        const oForm = _el("div");
        oForm.appendChild(oSwitchWrap);

        _createFormDialog({
            title: T("205") || "Sound Settings",
            icon: ICON.sound,
            bodyEl: oForm,
            width: "24rem",
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { await _saveWsSound(oChk.checked, oCtl); } },
                { text: T("003") || "Cancel", type: "reject", onClick: (oCtl) => oCtl.close() }
            ]
        });

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
        const oBody = _el("div");
        const oFrame = document.createElement("iframe");
        oFrame.className = "sl-about-frame";
        const sBg = encodeURIComponent(_resolveColor("--sl-surface"));
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
     * 창 제어 — 닫기 (자식 창 존재 시 안내, 없으면 종료)
     ********************************************************************/
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
                if (oWebPref.OBJTY !== "MAIN") { continue; }
                if (oBrows.isMinimized()) { oBrows.restore(); }
                oBrows.show();
                if (!oFirst) { oFirst = oBrows; }
            } catch (error) { continue; }
        }
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
     * OS/타이틀바발 창 닫기 가드
     ********************************************************************/
    function _attachWindowCloseGuard() {
        window.onbeforeunload = () => {
            try {
                CURRWIN.setAlwaysOnTop(true, "screen-saver");
                CURRWIN.show();
                CURRWIN.setAlwaysOnTop(false);
            } catch (e) { /* 무시 */ }

            if (_countActiveChildWindows() === 0) { return undefined; }
            if (CURRWIN.isDestroyed()) { return undefined; }

            oAPP.fn.fnShowMessageBox("W", T("043") || "An activated window exists. Please close all activated windows first.", () => {
                oAPP.fn.fnShowMainWindow();
            });
            return false;
        };
    }

    function _createTaskBarMenu() {
        try {
            CURRWIN.setThumbarButtons([{
                tooltip: oAPP.msg.M16 || "Shut Down",
                icon: PATH.join(APPPATH, "img", "shutdown.png"),
                click() {
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
     * 프로그램 종료 질문 팝업
     ********************************************************************/
    oAPP.fn.fnShowShutdownAskPopup = function () {
        const sMsg = (oAPP.msg.M048 || "Unsaved data will be lost.") + " \n " +
            (oAPP.msg.M049 || "Are you sure you want to exit the Program?");

        oAPP.fn.fnShowMessageBox("C", sMsg, (sAction) => {
            if (sAction !== "OK") { return; }

            oAPP.fn.fnProgramShuttDown();

            if (oAPP.attr.windowCloseInterval) {
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
            }
            oAPP.attr.windowCloseInterval = setInterval(() => {
                if (!_checkMainProgramExit()) { return; }
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
                APP.exit();
            }, 500);
        });
    };

    oAPP.fn.fnProgramShuttDown = function () {
        IPCRENDERER.send("if-browser-interconnection", { PRCCD: "04" });
    };

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

    // Bootstrap form-label (필수 표시 *)
    function _mkLabel(sText, bRequired) {
        const o = _el("label", "form-label fw-semibold", sText);
        if (bRequired) {
            const oStar = _el("span", "text-danger ms-1", "*");
            o.appendChild(oStar);
        }
        return o;
    }

    /**
     * 입력을 .sl-field 래퍼로 감싸고 "값이 있을 때만" 보이는 X(clear) 버튼을 단다.
     */
    function _wrapClear(oInput) {
        const oWrap = _el("div", "sl-field");
        const oClear = _el("button", "sl-field__clear");
        oClear.type = "button";
        oClear.title = "Clear";
        oClear.setAttribute("aria-label", "Clear");
        oClear.tabIndex = -1;
        oClear.innerHTML = ICON.clear;
        oWrap.append(oInput, oClear);

        const _sync = () => { oWrap.dataset.filled = (oInput.value && oInput.value.length) ? "true" : "false"; };
        oInput.addEventListener("input", _sync);
        oClear.addEventListener("click", () => {
            oInput.value = "";
            oInput.dispatchEvent(new Event("input", { bubbles: true }));
            oInput.focus();
        });
        _sync();
        return oWrap;
    }

    function _winBtn(sIcon, sTitle, fnClick) {
        const o = _el("button", "sl-winbtn");
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

    // CSS 변수를 실제 색(rgb(...))으로 해석
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
     * 공통 폼 다이얼로그 (sap.m.Dialog 대체) — Bootstrap modal.
     * @returns {{dlg:HTMLElement, modal:Object, close:Function}}
     */
    function _createFormDialog(opt) {
        const oModalEl = _el("div", "modal fade");
        oModalEl.tabIndex = -1;
        oModalEl.setAttribute("aria-hidden", "true");

        const oDialog = _el("div", "modal-dialog modal-dialog-centered modal-dialog-scrollable");
        if (opt.width) { oDialog.style.maxWidth = "min(" + opt.width + ", 92vw)"; }
        const oContent = _el("div", "modal-content");

        // header (icon + title + close)
        const oHead = _el("div", "modal-header py-2");
        if (opt.icon) {
            const oIconSpan = _el("span", "sl-msg-icon");
            if (opt.iconType) { oIconSpan.dataset.type = opt.iconType; }
            oIconSpan.innerHTML = opt.icon;
            oHead.appendChild(oIconSpan);
        }
        oHead.appendChild(_el("h6", "modal-title mb-0 flex-grow-1", opt.title || ""));
        const oCloseX = _el("button", "btn-close");
        oCloseX.type = "button";
        oCloseX.setAttribute("aria-label", "Close");
        oHead.appendChild(oCloseX);
        oContent.appendChild(oHead);

        // body
        const oBody = _el("div", "modal-body" + (opt.bodyFlush ? " p-0" : ""));
        if (opt.bodyEl) { oBody.appendChild(opt.bodyEl); }
        oContent.appendChild(oBody);

        // footer (buttons)
        const oFoot = _el("div", "modal-footer py-2");
        oDialog.appendChild(oContent);
        oModalEl.appendChild(oDialog);

        const oCtl = {
            dlg: oModalEl,
            _closing: false,
            modal: null,
            close() {
                this._closing = true;
                if (this.modal) { this.modal.hide(); }
            }
        };

        (opt.buttons || []).forEach(b => {
            let sCls = "btn btn-sm";
            if (b.type === "emphasized") { sCls += " btn-primary"; }
            else if (b.type === "reject") { sCls += " btn-outline-secondary"; }
            else if (b.type === "negative") { sCls += " btn-danger"; }
            else { sCls += " btn-secondary"; }
            const oBtn = _el("button", sCls);
            oBtn.type = "button";
            if (b.icon) {
                oBtn.innerHTML = b.icon + (b.text ? ` <span>${_esc(b.text)}</span>` : "");
            } else {
                oBtn.textContent = b.text || "";
            }
            oBtn.addEventListener("click", () => b.onClick(oCtl));
            oFoot.appendChild(oBtn);
        });
        oContent.appendChild(oFoot);

        // X(close) → onCancel 또는 단순 닫기
        oCloseX.addEventListener("click", () => {
            if (typeof opt.onCancel === "function") { opt.onCancel(oCtl); }
            else { oCtl.close(); }
        });

        document.body.appendChild(oModalEl);

        const oModal = new bootstrap.Modal(oModalEl, { backdrop: true, keyboard: true });
        oCtl.modal = oModal;

        // ESC(키보드) → cancel
        oModalEl.addEventListener("hide.bs.modal", (ev) => {
            if (!oCtl._closing && typeof opt.onCancel === "function") {
                // ESC/백드롭 dismiss — 기본 닫힘을 막고 onCancel 흐름으로 통일
                ev.preventDefault();
                opt.onCancel(oCtl);
            }
        });
        oModalEl.addEventListener("hidden.bs.modal", () => { oModalEl.remove(); });
        if (opt.initialFocusEl) {
            oModalEl.addEventListener("shown.bs.modal", () => { opt.initialFocusEl.focus(); });
        }

        oModal.show();

        return oCtl;
    }

    /**
     * 커스텀 셀렉트 — 네이티브 <select>(OS 기본 드롭다운) 대신 Bootstrap
     * .dropdown-menu UX 로 통일한다(컬럼/설정 메뉴와 동일한 룩앤필·테마).
     *  · `.value` getter/setter 로 네이티브 select 와 동일 계약 유지.
     *  · 펼침 목록은 body 에 fixed 로 띄워 모달 overflow 클리핑/ z-index 문제 회피.
     * @returns {HTMLElement} value 접근자를 가진 wrapper
     */
    function _createSelect(aItems, sValue, fnChange) {
        let _val = sValue;

        const oWrap = _el("div", "sl-select");
        const oBtn = _el("button", "sl-select__btn form-select form-select-sm");
        oBtn.type = "button";
        oBtn.setAttribute("aria-haspopup", "listbox");
        oBtn.setAttribute("aria-expanded", "false");
        const oText = _el("span", "sl-select__text");
        oBtn.appendChild(oText);
        oWrap.appendChild(oBtn);

        const _labelOf = (v) => { const o = aItems.find((i) => i.value === v); return o ? o.text : ""; };
        const _renderText = () => { oText.textContent = _labelOf(_val); };
        _renderText();

        let oMenu = null;
        const _onDoc = (ev) => {
            if (oMenu && !oMenu.contains(ev.target) && !oWrap.contains(ev.target)) { _close(); }
        };
        const _onKey = (ev) => { if (ev.key === "Escape") { _close(); } };
        function _close() {
            if (!oMenu) { return; }
            oMenu.remove();
            oMenu = null;
            oBtn.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onDoc, true);
            document.removeEventListener("keydown", _onKey, true);
        }
        function _open() {
            if (oMenu) { _close(); return; }
            oMenu = _el("div", "dropdown-menu show sl-menu sl-select__menu");
            oMenu.setAttribute("role", "listbox");
            aItems.forEach((it) => {
                const oItem = _el("button", "dropdown-item" + (it.value === _val ? " active" : ""));
                oItem.type = "button";
                oItem.setAttribute("role", "option");
                oItem.appendChild(_el("span", null, it.text));
                const oChk = _el("span", "sl-select__chk");
                oChk.innerHTML = ICON.accept;
                oItem.appendChild(oChk);
                oItem.addEventListener("click", () => {
                    const bChanged = (_val !== it.value);
                    _val = it.value;
                    _renderText();
                    _close();
                    if (bChanged && typeof fnChange === "function") { fnChange(_val); }
                });
                oMenu.appendChild(oItem);
            });
            document.body.appendChild(oMenu);
            const oR = oBtn.getBoundingClientRect();
            oMenu.style.position = "fixed";
            oMenu.style.margin = "0";
            oMenu.style.minWidth = oR.width + "px";
            // 아래 공간이 부족하면 위로 펼침
            const iMenuH = oMenu.offsetHeight;
            const bUp = (oR.bottom + iMenuH + 6 > window.innerHeight) && (oR.top - iMenuH - 6 > 0);
            oMenu.style.left = oR.left + "px";
            oMenu.style.top = (bUp ? (oR.top - iMenuH - 2) : (oR.bottom + 2)) + "px";
            oBtn.setAttribute("aria-expanded", "true");
            setTimeout(() => {
                document.addEventListener("mousedown", _onDoc, true);
                document.addEventListener("keydown", _onKey, true);
            }, 0);
        }
        oBtn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); _open(); });

        Object.defineProperty(oWrap, "value", {
            get() { return _val; },
            set(v) { _val = v; _renderText(); }
        });
        return oWrap;
    }

    function _attachSplitterDrag(oBar, oLeftPane) {
        let bDrag = false;
        oBar.addEventListener("mousedown", (ev) => {
            bDrag = true;
            ev.preventDefault();
            document.body.style.cursor = "col-resize";
            oBar.classList.add("sl-gutter--drag");
        });
        window.addEventListener("mousemove", (ev) => {
            if (!bDrag) { return; }
            const oSplitter = oBar.parentElement;
            const oRect = oSplitter.getBoundingClientRect();
            let iWidth = ev.clientX - oRect.left;
            const iMin = 120;
            const iMax = oRect.width - 248;
            iWidth = Math.max(iMin, Math.min(iMax, iWidth));
            oLeftPane.style.flex = `0 0 ${iWidth}px`;
        });
        window.addEventListener("mouseup", () => {
            if (bDrag) {
                bDrag = false;
                document.body.style.cursor = "";
                oBar.classList.remove("sl-gutter--drag");
            }
        });
    }

    function _positionMenu(oMenu, oAnchor) {
        const oRect = oAnchor.getBoundingClientRect();
        oMenu.style.position = "fixed";
        const iMenuW = oMenu.offsetWidth;
        let iLeft = oRect.right - iMenuW;
        if (iLeft < 4) { iLeft = 4; }
        oMenu.style.top = (oRect.bottom + 2) + "px";
        oMenu.style.left = iLeft + "px";
        oMenu.style.margin = "0";
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
        document.querySelectorAll(".sl-menu").forEach(o => o.remove());
        if (_fnOutside) {
            document.removeEventListener("mousedown", _fnOutside);
            _fnOutside = null;
        }
        document.removeEventListener("keydown", _escClose);
    }

    /********************************************************************
     * 네트워크 online/offline — 상태 플래그 유지
     ********************************************************************/
    window.addEventListener("online", () => { oAPP.attr.bIsNwActive = true; });
    window.addEventListener("offline", () => { oAPP.attr.bIsNwActive = false; });

})(window);
