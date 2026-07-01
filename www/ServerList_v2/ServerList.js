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
     * 테마 적용 — 베이스 토큰(shell) + Bootstrap 데모 스킨 틴트.
     *  스킨 틴트(data-sl-theme + --u4a-/--sl- 인라인 변수)는 theme-api.js 의
     *  U4ATheme.apply() 가 SKIN_MAP 으로 직접 세팅한다(전 화면 단일 출처).
     *  (구: 여기 THEME_MAP/applyBsTheme → theme-api 로 이관, 중복 제거)
     ********************************************************************/
    oAPP.fn.fnApplyTheme = function (sKey) {
        try { U4ATheme.apply(sKey); } catch (e) { }
    };

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
            _renderFolderContents();
        }
    };
    oAPP.model = M;

    /********************************************************************
     * i18n 텍스트 헬퍼 (메시지 키 → 텍스트, 하드코딩 금지 — doc 02 §9.3)
     ********************************************************************/
    // ★ 언어 텍스트는 소스에 두지 않는다 — 폴백 영문 문구 제거. T() 는 DB(/WSLANGU 모델)에서만 읽는다.
    const MSG_FALLBACK = {};
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
        connect: _fa("arrow-right-to-bracket"),
        accept: _fa("check"),
        decline: _fa("xmark"),
        clear: _fa("xmark"),
        sortAsc: _fa("arrow-up"),
        sortDesc: _fa("arrow-down"),
        filter: _fa("filter"),
        // 메시지 박스 타입별 아이콘 (Confirm/Success/Error/Warning)
        confirm: _fa("circle-question"),
        success: _fa("circle-check"),
        error: _fa("circle-xmark"),
        warning: _fa("triangle-exclamation")
    };

    /********************************************************************
     * Busy / Toast / MessageBox (UI5 BusyIndicator/Toast/MessageBox 대체)
     ********************************************************************/
    oAPP.fn.setBusyIndicator = function (sIsBusy, sMsg) {
        const oDom = document.getElementById("u4aWsBusyIndicator");
        if (!oDom) {
            return;
        }
        const bBusy = (sIsBusy === "X");
        document.body.style.pointerEvents = bBusy ? "none" : "";
        oDom.dataset.busy = bBusy ? "true" : "false";

        // 선택적 안내 문구(예: 종료 중) — busy 카드 하단에 표시. 비면 :empty 로 자동 숨김.
        const oCard = oDom.querySelector(".u4a-busy__card");
        if (oCard) {
            let oLabel = oCard.querySelector(".u4a-busy__label");
            if (!oLabel) {
                oLabel = document.createElement("div");
                oLabel.className = "u4a-busy__label";
                oCard.appendChild(oLabel);
            }
            oLabel.textContent = (bBusy && sMsg) ? sMsg : "";
        }
    };

    oAPP.setBusy = function (bIsBusy, sMsg) {
        oAPP.fn.setBusyIndicator(bIsBusy ? "X" : "", sMsg);
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

        // 타입별 아이콘 + 현지화 타이틀 (L()=MSGNR_MAP→DB 조회)
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
            oAPP.fn.fnApplyTheme(sUi5Theme);
        } catch (e) {
            oAPP.fn.fnApplyTheme("horizon_white");
        }
        // [흰색 플래시] 첫 페인트용 동기 배경(--boot-bg, intro 가 BGCOL 로 전달)은 테마 CSS 가
        //   로드된 지금 역할 종료. 다음 프레임에 제거하여, 이후 런타임 테마 변경(설정 실시간
        //   미리보기)이 var(--app-bg) 로 배경까지 갱신되게 한다. (제거 전이라도 첫 페인트는 보호됨)
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
            // 컬럼 필터 메뉴 라벨 (/U4A/CL_WS_COMMON: A68 필터 값 / A69 필터 초기화)
            const C = (nr) => WSUTIL.getWsMsgClsTxt(sWsLangu, "/U4A/CL_WS_COMMON", nr);
            oAPP.msg.FILTERVAL = C("A68"); oAPP.msg.CLEARFILTER = C("A69");
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
            oAPP.msg.FILTERVAL = "Filter Value"; oAPP.msg.CLEARFILTER = "Clear Filter";
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
            "029", "043", "044", "048", "049", "080", "204", "205", "206", "270", "271",
            "380", "667", "809", "810", "811",
            // 화면 라벨(MSGNR_MAP) — 신규 키. DB(ZMSG_WS_COMMON_001) 적재 후 출력됨
            "913", "914", "915", "916", "917", "918", "919", "920", "921", "922", "923",
            "924", "925", "926", "927", "928", "929", "930", "931", "932", "933", "934",
            "935", "936", "937", "938", "939", "940", "941", "942", "943", "944", "945", "946",
            // busy 안내 문구(종료 중)
            "951"];
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

            // Launcher 뷰는 트리/폴더 선택과 무관하게 전체 서버를 보여주므로,
            // /ServerList 로드가 끝난 지금 시점에 반드시 다시 그린다(초기 'No data' 방지).
            if (oAPP.attr._viewMode === VIEW_MODES.LAUNCHER) {
                oAPP.fn.fnRenderLauncher();
            }

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
     * 뷰 모드 (Tree / Master-Detail) — 상태 + appdata 영속화
     *   SAP Logon Pad 의 뷰 전환 컨셉. 레지스트리 대신 userData(appdata)/p13n
     *   에 마지막 선택 뷰를 저장한다(사용자 지시). [Launcher 뷰는 다음 단계]
     ********************************************************************/
    const VIEW_MODES = { TREE: "tree", MASTER: "master", LAUNCHER: "launcher" };

    function _viewStateFilePath() {
        return PATH.join(USERDATA, "p13n", "serverlist_view.json");
    }
    oAPP.fn.fnLoadViewMode = function () {
        try {
            const sPath = _viewStateFilePath();
            if (FS.existsSync(sPath)) {
                const o = JSON.parse(FS.readFileSync(sPath, "utf-8") || "{}");
                if (o && (o.viewMode === VIEW_MODES.TREE || o.viewMode === VIEW_MODES.MASTER || o.viewMode === VIEW_MODES.LAUNCHER)) {
                    return o.viewMode;
                }
            }
        } catch (e) { /* 손상/누락 → 기본값 */ }
        return VIEW_MODES.TREE;
    };
    oAPP.fn.fnSaveViewMode = function (sMode) {
        try {
            const sDir = PATH.join(USERDATA, "p13n");
            if (!FS.existsSync(sDir)) { FS.mkdirSync(sDir, { recursive: true }); }
            FS.writeFileSync(_viewStateFilePath(), JSON.stringify({ viewMode: sMode }, null, 2), "utf-8");
        } catch (e) {
            console.error("[ServerList] 뷰 모드 저장 실패:", e);
        }
    };

    /** 테스트 모드 상태(스위치 on/off + 자동 로그인 ID) — appdata 영속화 */
    function _testStateFilePath() {
        return PATH.join(USERDATA, "p13n", "serverlist_test.json");
    }
    function _loadTestState() {
        try {
            const sPath = _testStateFilePath();
            if (FS.existsSync(sPath)) {
                const o = JSON.parse(FS.readFileSync(sPath, "utf-8") || "{}");
                return { testMode: !!o.testMode, testId: typeof o.testId === "string" ? o.testId : "" };
            }
        } catch (e) { /* 손상/누락 → 기본값 */ }
        return { testMode: false, testId: "" };
    }
    function _saveTestState() {
        try {
            const sDir = PATH.join(USERDATA, "p13n");
            if (!FS.existsSync(sDir)) { FS.mkdirSync(sDir, { recursive: true }); }
            FS.writeFileSync(_testStateFilePath(), JSON.stringify({
                testMode: !!oAPP.attr._testMode,
                testId: oAPP.attr._testId || ""
            }, null, 2), "utf-8");
        } catch (e) {
            console.error("[ServerList] 테스트 상태 저장 실패:", e);
        }
    }

    /** 서브헤더 뷰 전환 세그먼트 (Tree / Master-Detail) — Bootstrap btn-group */
    /** 테스트 모드 스위치 + 자동 로그인 ID 입력 — 환경변수 U4A_WS_TEST_MODE='X' 일 때만 활성화.
     *  스위치 ON → ID 입력칸 노출. 입력한 ID 는 서버 더블클릭 시 로그인 창으로 전달되어
     *  하단 스태프 버튼 중 일치하는 계정으로 자동 로그인된다. (개발/테스트 전용, 라벨 하드코딩) */
    function _buildTestModeToggle() {
        const bDevHost = process.env.U4A_WS_TEST_MODE === "X";

        // 마지막 입력값/스위치 상태 복원(appdata). 비-테스트 머신에선 스위치 강제 off.
        if (oAPP.attr._testId === undefined) {
            const oTs = _loadTestState();
            oAPP.attr._testId = oTs.testId;
            oAPP.attr._testMode = bDevHost ? oTs.testMode : false;
        }

        const oWrap = _el("span", "u4a-bar__testmode");
        if (!bDevHost) { oWrap.classList.add("is-disabled"); } // :has() 미지원(Chromium93) → 클래스로 흐림

        const oText = _el("span", "u4a-bar__testmode-label", "테스트 모드");

        const oSwitch = _el("label", "u4a-switch");
        const oChk = document.createElement("input");
        oChk.type = "checkbox";
        oChk.id = "u4aWsTestMode";
        oChk.checked = !!oAPP.attr._testMode;
        oChk.disabled = !bDevHost; // U4A_WS_TEST_MODE='X' 일 때만 활성화
        oSwitch.append(oChk, _el("span", "u4a-switch__slider"));

        // 자동 로그인 ID 입력칸 — 스위치 ON 일 때만 노출
        const oIdInput = _el("input", "u4a-input u4a-bar__testmode-input");
        oIdInput.type = "text";
        oIdInput.placeholder = "자동 로그인 ID";
        oIdInput.value = oAPP.attr._testId || "";
        oIdInput.hidden = !oAPP.attr._testMode;
        // 입력 중엔 라이브로 반영, 커밋(blur/Enter) 시점에 영속화
        oIdInput.addEventListener("input", () => { oAPP.attr._testId = oIdInput.value; });
        oIdInput.addEventListener("change", () => { oAPP.attr._testId = oIdInput.value; _saveTestState(); });

        oChk.addEventListener("change", () => {
            if (!bDevHost) { return; }
            oAPP.attr._testMode = oChk.checked;
            oIdInput.hidden = !oChk.checked;
            _saveTestState();
            if (oChk.checked) { setTimeout(() => oIdInput.focus(), 0); }
        });

        oWrap.append(oText, oSwitch, oIdInput);
        return oWrap;
    }

    function _buildViewSwitcher() {
        const oWrap = _el("div", "btn-group btn-group-sm");
        oWrap.id = "u4aWsViewSwitcher";
        oWrap.setAttribute("role", "group");
        const aBtns = [
            { mode: VIEW_MODES.TREE, icon: "sitemap", tip: L("viewTree") },
            { mode: VIEW_MODES.MASTER, icon: "table-columns", tip: L("viewMaster") },
            { mode: VIEW_MODES.LAUNCHER, icon: "magnifying-glass", tip: L("viewLauncher") }
        ];
        for (const o of aBtns) {
            const oBtn = _el("button", "btn btn-outline-secondary");
            oBtn.type = "button";
            oBtn.dataset.mode = o.mode;
            oBtn.title = o.tip;
            oBtn.innerHTML = _fa(o.icon);
            oBtn.addEventListener("click", () => {
                if (oAPP.attr._viewMode === o.mode) { return; }
                oAPP.attr._viewMode = o.mode;
                oAPP.fn.fnSaveViewMode(o.mode);
                oAPP.fn.fnRenderActiveView();
            });
            oWrap.appendChild(oBtn);
        }
        return oWrap;
    }
    function _updateViewSwitcherActive() {
        const oSw = document.getElementById("u4aWsViewSwitcher");
        if (!oSw) { return; }
        oSw.querySelectorAll("[data-mode]").forEach((b) => {
            const bOn = (b.dataset.mode === oAPP.attr._viewMode);
            b.classList.toggle("btn-primary", bOn);
            b.classList.toggle("btn-outline-secondary", !bOn);
            b.setAttribute("aria-pressed", bOn ? "true" : "false");
        });
    }

    /** 서브헤더 설정(기어) 드롭다운 — Bootstrap dropdown (구 fnOpenSettingsMenu/.u4a-menu) */
    function _buildSettingsDropdown() {
        const oWrap = _el("div", "dropdown");
        // 뷰 전환 버튼(plain btn-sm)과 동일한 박스 → 높이 일치(기존 d-inline-flex 가 높이 어긋남 유발)
        const oBtn = _el("button", "btn btn-sm btn-outline-secondary");
        oBtn.type = "button";
        oBtn.title = L("settings");
        oBtn.setAttribute("data-bs-toggle", "dropdown");
        oBtn.setAttribute("aria-expanded", "false");
        oBtn.innerHTML = ICON.gear;
        const oMenu = _el("ul", "dropdown-menu dropdown-menu-end");
        const aItems = [
            { key: "WSLANGU", icon: ICON.translate, text: T("001") },
            { key: "WSTHEME", icon: ICON.palette, text: T("005") },
            { key: "WSSOUND", icon: ICON.sound, text: T("204") },
            { key: "ABOUTWS", icon: ICON.hint, text: T("044") }
        ];
        for (const oItem of aItems) {
            const oLi = _el("li");
            const oA = _el("button", "dropdown-item d-flex align-items-center gap-2");
            oA.type = "button";
            oA.innerHTML = oItem.icon + "<span>" + _esc(oItem.text) + "</span>";
            oA.addEventListener("click", () => oAPP.fn.fnSettingItemSelected(oItem.key, oBtn));
            oLi.appendChild(oA);
            oMenu.appendChild(oLi);
        }
        oWrap.append(oBtn, oMenu);
        return oWrap;
    }

    /** Tree 뷰 본문 (좌 트리 / 우 테이블 — 2분할) */
    function _buildTreeViewBody(oBody) {
        // 스플릿바 표준(doc 16 §4) — 마스터-디테일과 동일 기준:
        //   좌(트리)=0 1 %(초기 basis %, 공간 부족 시 양보)+단일 min-width(px),
        //   우(테이블)=1 1 auto(잔여 흡수)+단일 min-width(px). 드래그는 단순 인접 리사이저.
        const oSplitter = _el("div", "u4a-splitter");
        const oPaneLeft = _el("div", "u4a-splitter__pane");
        oPaneLeft.id = "u4aWsTreePane";
        oPaneLeft.style.flex = "0 1 25%";
        oPaneLeft.style.minWidth = "300px";
        const oBar = _el("div", "u4a-splitter__bar");
        oBar.setAttribute("role", "separator");
        _attachSplitterDrag(oBar, oPaneLeft);
        const oPaneRight = _el("div", "u4a-splitter__pane");
        oPaneRight.id = "u4aWsTablePane";
        oPaneRight.style.flex = "1 1 auto";
        oPaneRight.style.minWidth = "300px";
        oSplitter.append(oPaneLeft, oBar, oPaneRight);
        oBody.appendChild(oSplitter);
    }

    /** Master-Detail 뷰 본문 (폴더 → 서버목록 → 상세, 3컬럼) */
    function _buildMasterDetailBody(oBody) {
        // 스플릿바 = WS20 디자인 영역과 **동일 구조/거동**(doc 16 §4, give-way):
        //   구조: 트리(좌 사이드) | 목록(센터 fill) | 상세(우 사이드)
        //   · 사이드(트리·상세)=0 1 %(초기 basis %)+단일 min-width(px). 센터(목록)=1 1 auto(잔여 흡수).
        //   · 각 바는 인접 "사이드" 패널을 리사이즈(give-way): 끌면 self 확대 → 센터가 먼저 min 까지
        //     흡수 → 센터가 min 에 닿으면 반대편 사이드가 자기 min 까지 양보(밀림). 셋 다 min=hard stop.
        //   값 세트 WS20 동일{사이드 300 / 센터 200}. (창 최소폭 1000 > 300+200+300+바 ≈ 816)
        const oSplit = _el("div", "u4a-splitter");

        const oCol1 = _el("div", "u4a-splitter__pane");
        oCol1.id = "u4aWsTreePane";
        oCol1.style.flex = "0 1 25%";
        oCol1.style.minWidth = "300px";
        const oBar1 = _el("div", "u4a-splitter__bar");
        oBar1.setAttribute("role", "separator");

        const oCol2 = _el("div", "u4a-splitter__pane u4a-md__list");
        oCol2.id = "u4aWsMasterListPane";
        oCol2.style.flex = "1 1 auto";   // 센터 = 잔여 흡수(fill)
        oCol2.style.minWidth = "200px";
        const oBar2 = _el("div", "u4a-splitter__bar");
        oBar2.setAttribute("role", "separator");

        const oCol3 = _el("div", "u4a-splitter__pane u4a-md__detail");
        oCol3.id = "u4aWsMasterDetailPane";
        oCol3.style.flex = "0 1 30%";
        oCol3.style.minWidth = "300px";

        // give-way 드래그: 바1=트리(좌 사이드), 바2=상세(우 사이드). 센터(목록)가 흡수.
        _attachGiveWaySplitterDrag(oBar1, oCol1, "left");
        _attachGiveWaySplitterDrag(oBar2, oCol3, "right");

        oSplit.append(oCol1, oBar1, oCol2, oBar2, oCol3);
        oBody.appendChild(oSplit);
    }

    /** 선택 폴더 내용 렌더 — 활성 뷰에 맞게 분기 */
    function _renderFolderContents() {
        if (oAPP.attr._viewMode === VIEW_MODES.LAUNCHER) {
            // Launcher 는 전체 서버 기준 → 데이터 로드/갱신 시 다시 그린다(검색어는 보존)
            oAPP.fn.fnRenderLauncher();
            return;
        }
        if (oAPP.attr._viewMode === VIEW_MODES.MASTER) {
            oAPP.fn.fnRenderMasterList();
        } else {
            oAPP.fn.fnRenderServerTable();
        }
    }

    /********************************************************************
     * [LAUNCHER 뷰] 검색 중심 런처 (사진 참고) — 검색창 + 최근연결 + 결과 + 단축키
     ********************************************************************/
    const _bIsMac = (typeof process !== "undefined" && process.platform === "darwin");

    // 접속 이력(appdata, 레지스트리 X) — { uuid: timestampMs }
    function _recentFilePath() { return PATH.join(USERDATA, "p13n", "serverlist_recent.json"); }
    function _loadRecentMap() {
        try {
            const p = _recentFilePath();
            if (FS.existsSync(p)) {
                const o = JSON.parse(FS.readFileSync(p, "utf-8") || "{}");
                if (o && typeof o === "object") { return o; }
            }
        } catch (e) { /* 손상/누락 → 빈 이력 */ }
        return {};
    }
    // 이력 엔트리 정규화(구 포맷 number → {ts,count} 호환)
    function _recentEntry(v) {
        if (v && typeof v === "object") { return { ts: v.ts || 0, count: v.count || 1 }; }
        return { ts: (typeof v === "number" ? v : 0), count: 1 };
    }
    function _writeRecentMap(o) {
        const sDir = PATH.join(USERDATA, "p13n");
        if (!FS.existsSync(sDir)) { FS.mkdirSync(sDir, { recursive: true }); }
        FS.writeFileSync(_recentFilePath(), JSON.stringify(o), "utf-8");
    }
    // 연결 시 호출 — 타임스탬프 + 접속 횟수 누적
    oAPP.fn.fnRecordConnection = function (sUuid) {
        if (!sUuid) { return; }
        try {
            const o = _loadRecentMap();
            const e = _recentEntry(o[sUuid]);
            o[sUuid] = { ts: Date.now(), count: e.count + 1 };
            _writeRecentMap(o);
        } catch (e) { console.error("[ServerList] 접속 이력 저장 실패:", e); }
    };
    // 최근 카드에서 항목 제거(× 버튼)
    oAPP.fn.fnRemoveRecent = function (sUuid) {
        try {
            const o = _loadRecentMap();
            if (o[sUuid] != null) { delete o[sUuid]; _writeRecentMap(o); }
        } catch (e) { console.error("[ServerList] 접속 이력 삭제 실패:", e); }
    };
    // 상대 시간 표기 — 오늘/어제 HH:MM, 그 외 MM-DD HH:MM (오늘/어제는 i18n)
    function _fmtConnTime(ts) {
        const d = new Date(ts), now = new Date();
        const p2 = (n) => (n < 10 ? "0" : "") + n;
        const hm = p2(d.getHours()) + ":" + p2(d.getMinutes());
        const _start = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
        const iDiff = Math.round((_start(now) - _start(d)) / 86400000);
        if (iDiff <= 0) { return L("today") + " " + hm; }
        if (iDiff === 1) { return L("yesterday") + " " + hm; }
        return p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + " " + hm;
    }

    // uuid → 소속 폴더(그룹)명 매핑 (SAPLogon 트리 순회)
    function _buildServerGroupMap() {
        const oMap = {};
        const oSAP = M.getProperty("/SAPLogon");
        const aRoot = (oSAP && oSAP.Node) ? (Array.isArray(oSAP.Node) ? oSAP.Node : [oSAP.Node]) : [];
        function _walk(oNode) {
            const oAttr = oNode._attributes || {};
            const aItems = oNode.Item ? (Array.isArray(oNode.Item) ? oNode.Item : [oNode.Item]) : [];
            aItems.forEach((it) => {
                const sid = it._attributes && it._attributes.serviceid;
                if (sid && !oMap[sid]) { oMap[sid] = oAttr.name || ""; }
            });
            const aKids = oNode.Node ? (Array.isArray(oNode.Node) ? oNode.Node : [oNode.Node]) : [];
            aKids.forEach(_walk);
        }
        aRoot.forEach(_walk);
        return oMap;
    }

    // 전체 서버 목록 + 저장(활성) 여부 동기화 (읽기 전용 사본)
    function _getAllServers() {
        const aAll = M.getProperty("/ServerList") || [];
        const oSaved = new Set();
        try {
            const r = oAPP.fn.fnGetSavedServerListDataAll();
            if (r.RETCD === "S") { r.RETDATA.forEach((s) => oSaved.add(s.uuid)); }
        } catch (e) { /* 저장파일 없음 → 전부 미저장 */ }
        return aAll.map((o) => Object.assign({}, o, { ISSAVE: oSaved.has(o.uuid) }));
    }
    function _getRecentServers(iLimit) {
        const oMap = _loadRecentMap();
        const oByUuid = {};
        _getAllServers().forEach((s) => { oByUuid[s.uuid] = s; });
        return Object.keys(oMap)
            .filter((u) => oByUuid[u])
            .map((u) => { const e = _recentEntry(oMap[u]); return { uuid: u, srv: oByUuid[u], ts: e.ts, count: e.count }; })
            .sort((a, b) => b.ts - a.ts)
            .slice(0, iLimit || 8);
    }

    // 검색어 매칭부 하이라이트 (HTML 안전: 전부 _esc 후 <mark> 삽입)
    function _hlMatch(sText, sQ) {
        const t = sText || "";
        if (!sQ) { return _esc(t); }
        const i = t.toLowerCase().indexOf(sQ);
        if (i < 0) { return _esc(t); }
        return _esc(t.slice(0, i)) + "<mark class=\"u4a-lnch__hl\">" + _esc(t.slice(i, i + sQ.length)) + "</mark>" + _esc(t.slice(i + sQ.length));
    }

    /** Launcher 본문 컨테이너 (트리/스플리터 없음) */
    function _buildLauncherBody(oBody) {
        const oWrap = _el("div", "u4a-launcher");
        oWrap.id = "u4aWsLauncher";
        oBody.appendChild(oWrap);
    }

    // 현재 결과(키보드 핸들러 공유)
    function _launcherConnectActive() {
        const aRes = oAPP.attr._launcherResults || [];
        const s = aRes[oAPP.attr._launcherActiveIdx || 0];
        if (s) { oAPP.fn.fnPressServerListItem(s); }
    }
    function _launcherEditActive() {
        const aRes = oAPP.attr._launcherResults || [];
        const s = aRes[oAPP.attr._launcherActiveIdx || 0];
        if (s) { oAPP.fn.fnEditDialogOpen(s); }
    }

    /** [PUBLIC] Launcher 렌더 — 검색창은 1회, 결과/최근은 부분 갱신(커서 유지) */
    oAPP.fn.fnRenderLauncher = function () {
        const oWrap = document.getElementById("u4aWsLauncher");
        if (!oWrap) { return; }
        oWrap.innerHTML = "";
        if (oAPP.attr._launcherQuery == null) { oAPP.attr._launcherQuery = ""; }
        oAPP.attr._launcherActiveIdx = oAPP.attr._launcherActiveIdx || 0;

        // ── 검색창 ──
        const oSearch = _el("div", "u4a-lnch__search");
        const oIco = _el("span", "u4a-lnch__searchico");
        oIco.innerHTML = _fa("magnifying-glass");
        const oInput = _el("input", "u4a-lnch__input");
        oInput.type = "text";
        oInput.placeholder = L("launcherPlaceholder") + "…";   // "…"는 표현이라 DB 텍스트가 아닌 소스에서 부착
        oInput.value = oAPP.attr._launcherQuery;
        // 값 있을 때만 보이는 X(clear) — 다른 입력과 동일한 공통 UX(U4AUI.attachClear)
        const oClear = _el("button", "u4a-lnch__clear");
        oClear.type = "button";
        oClear.title = L("hintClear");
        oClear.setAttribute("aria-label", L("hintClear"));
        oClear.tabIndex = -1;
        oClear.innerHTML = ICON.clear;
        oSearch.append(oIco, oInput, oClear);
        oWrap.appendChild(oSearch);
        // clear 클릭 → 입력 비우고 input 이벤트 발화(아래 input 리스너가 쿼리/렌더 동기화)
        window.U4AUI.attachClear(oInput, oClear);

        // ── 섹션 앵커바 (SAPUI5 ObjectPageLayout 식) — 최근/결과 점프 + scroll-spy ──
        const oAnchor = _el("div", "u4a-lnch__anchor");
        const _mkChip = (sKey) => {
            const b = _el("button", "u4a-lnch__achip");
            b.type = "button";
            b.append(_el("span", "u4a-lnch__achipdot"));
            b.append(_el("span", "u4a-lnch__achiptext", L(sKey)));
            const c = _el("span", "u4a-lnch__achipcount", "");
            b.append(c);
            return { btn: b, count: c };
        };
        const oChipRecent = _mkChip("recentConn");
        const oChipResults = _mkChip("searchResults");
        oAnchor.append(oChipRecent.btn, oChipResults.btn);
        oWrap.appendChild(oAnchor);

        // ── 결과/최근 컨테이너 (부분 갱신 대상) ──
        const oBodyArea = _el("div", "u4a-lnch__body");
        oWrap.appendChild(oBodyArea);

        // 섹션 점프 + scroll-spy (본문 스크롤 위치로 현재 섹션 칩 하이라이트)
        const _secEl = (sMod) => oBodyArea.querySelector(".u4a-lnch__sec--" + sMod);
        const _scrollToSec = (sMod) => {
            const sec = _secEl(sMod);
            if (!sec) { return; }
            const nTop = oBodyArea.scrollTop + (sec.getBoundingClientRect().top - oBodyArea.getBoundingClientRect().top);
            oBodyArea.scrollTo({ top: Math.max(0, nTop - 4), behavior: "smooth" });
        };
        oChipRecent.btn.addEventListener("click", () => _scrollToSec("recent"));
        oChipResults.btn.addEventListener("click", () => _scrollToSec("results"));
        const _syncSpy = () => {
            const oResSec = _secEl("results");
            let sActive = "recent";
            if (oResSec) {
                const nResTop = oResSec.getBoundingClientRect().top - oBodyArea.getBoundingClientRect().top;
                if (nResTop <= 8) { sActive = "results"; }
            }
            if (!_secEl("recent")) { sActive = "results"; }
            oChipRecent.btn.classList.toggle("is-active", sActive === "recent");
            oChipResults.btn.classList.toggle("is-active", sActive === "results");
        };
        oBodyArea.addEventListener("scroll", () => {
            _syncSpy();
            oAPP.attr._lnchScroll = oBodyArea.scrollTop; // 풀 재렌더 시 복원용(스크롤 점프 방지)
        }, { passive: true });

        // ── 푸터 액션 (Connect / Edit / Delete) — 활성 결과 대상 ──
        const _activeSrv = () => {
            const a = oAPP.attr._launcherResults || [];
            return a[oAPP.attr._launcherActiveIdx || 0] || null;
        };
        const oFoot = _el("div", "u4a-lnch__foot");
        const oConnBtn = _el("button", "btn btn-sm btn-primary d-inline-flex align-items-center gap-2");
        oConnBtn.id = "u4aLnchConn";
        oConnBtn.innerHTML = ICON.connect + "<span>" + _esc(L("connect")) + "</span>";
        oConnBtn.addEventListener("click", () => { const s = _activeSrv(); if (s) { oAPP.fn.fnPressServerListItem(s); } });
        const oEditBtn = _el("button", "btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2");
        oEditBtn.id = "u4aLnchEdit";
        oEditBtn.innerHTML = ICON.edit + "<span>" + _esc(L("edit")) + "</span>";
        oEditBtn.addEventListener("click", () => { const s = _activeSrv(); if (s) { oAPP.fn.fnEditDialogOpen(s); } });
        const oFootSpacer = _el("div", "u4a-lnch__footspacer");
        const oDelBtn2 = _el("button", "btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-2");
        oDelBtn2.id = "u4aLnchDel";
        oDelBtn2.innerHTML = ICON.trash + "<span>" + _esc(L("del")) + "</span>";
        oDelBtn2.addEventListener("click", () => { const s = _activeSrv(); if (s) { oAPP.attr._selectedServer = { data: s, tr: null }; oAPP.fn.fnPressDelete(); } });
        oFoot.append(oConnBtn, oEditBtn, oFootSpacer, oDelBtn2);
        oWrap.appendChild(oFoot);

        // 결과/최근 부분 렌더
        function _renderBody() {
            oBodyArea.innerHTML = "";
            const sQ = (oAPP.attr._launcherQuery || "").trim().toLowerCase();
            const oGroupMap = _buildServerGroupMap();

            // 최근 연결 — 검색 중에도 항상 상단 노출(Chrome 새 탭식 카드 그리드·원클릭 재연결)
            {
                const aRecent = _getRecentServers(8);
                oChipRecent.count.textContent = aRecent.length ? String(aRecent.length) : "";
                const oSec = _el("div", "u4a-lnch__sec u4a-lnch__sec--recent");
                oSec.appendChild(_el("div", "u4a-lnch__seclabel", L("recentConn")));
                if (!aRecent.length) {
                    // 이력 없어도 섹션은 유지 — 안내 메시지
                    oSec.appendChild(_el("div", "u4a-lnch__recentempty", L("recentEmpty")));
                } else {
                    const oRow = _el("div", "u4a-lnch__recent");
                    aRecent.forEach((o) => {
                        const s = o.srv, bSave = (s.ISSAVE === true);
                        const sGroup = oGroupMap[s.uuid] || "";
                        const sHostPort = (s.host || "") + (s.port ? (":" + s.port) : "");
                        const oCard = _el("div", "u4a-lnch__rcard");
                        oCard.tabIndex = 0;
                        oCard.title = (s.name || "") + "  (" + L("connect") + ")";

                        // 헤더: SID 배지 + (접속 횟수) + 상태점 + 제거(×)
                        const oHead = _el("div", "u4a-lnch__rhead");
                        const oLeft = _el("div", "u4a-lnch__rheadL");
                        oLeft.append(_el("span", "u4a-md__badge", s.systemid || ""));
                        const oRight = _el("div", "u4a-lnch__rheadR");
                        oRight.append(_el("span", "u4a-status-dot" + (bSave ? " u4a-status-dot--on" : "")));
                        const oDelBtn = _el("button", "u4a-lnch__rdel");
                        oDelBtn.type = "button";
                        oDelBtn.title = L("hintClear");
                        oDelBtn.innerHTML = _fa("xmark");
                        oDelBtn.addEventListener("click", (ev) => { ev.stopPropagation(); oAPP.fn.fnRemoveRecent(o.uuid); _renderBody(); });
                        oRight.append(oDelBtn);
                        oHead.append(oLeft, oRight);

                        const oName = _el("div", "u4a-lnch__rname", s.name || "");
                        const oMeta = _el("div", "u4a-lnch__rmeta");
                        oMeta.append(
                            _el("span", "u4a-lnch__rhost", sHostPort),
                            _el("span", "u4a-lnch__rtime", (sGroup ? sGroup + " · " : "") + _fmtConnTime(o.ts))
                        );
                        oCard.append(oHead, oName, oMeta);

                        const _go = () => oAPP.fn.fnPressServerListItem(s);
                        oCard.addEventListener("dblclick", _go);
                        oCard.addEventListener("keydown", (ev) => {
                            if (ev.key === "Enter") { ev.preventDefault(); _go(); }
                        });
                        oRow.appendChild(oCard);
                    });
                    oSec.appendChild(oRow);
                }
                oBodyArea.appendChild(oSec);
            }

            // 검색 결과
            const aAll = _getAllServers();
            const aRes = sQ ? aAll.filter((s) =>
                (s.name || "").toLowerCase().indexOf(sQ) !== -1 ||
                (s.systemid || "").toLowerCase().indexOf(sQ) !== -1 ||
                (s.host || "").toLowerCase().indexOf(sQ) !== -1
            ) : aAll;
            oAPP.attr._launcherResults = aRes;
            oChipResults.count.textContent = aRes.length ? String(aRes.length) : "";
            if (oAPP.attr._launcherActiveIdx > aRes.length - 1) { oAPP.attr._launcherActiveIdx = Math.max(0, aRes.length - 1); }

            const oSecR = _el("div", "u4a-lnch__sec u4a-lnch__sec--results");
            oSecR.appendChild(_el("div", "u4a-lnch__seclabel", L("searchResults") + (aRes.length ? "  ·  " + aRes.length : "")));
            const oList = _el("div", "u4a-lnch__results");
            if (!aRes.length) {
                oList.appendChild(_el("div", "u4a-lnch__empty", L("noData")));
            } else {
                aRes.forEach((s, idx) => {
                    const bSave = (s.ISSAVE === true);
                    const bActive = (idx === oAPP.attr._launcherActiveIdx);
                    const oR = _el("div", "u4a-lnch__row" + (bActive ? " active" : ""));
                    oR.dataset.idx = idx;
                    const oBadge = _el("span", "u4a-md__badge", s.systemid || "");
                    const oMain = _el("div", "u4a-lnch__rowmain");
                    const sGroup = oGroupMap[s.uuid] || "";
                    const sHostPort = (s.host || "") + (s.port ? (":" + s.port) : "");
                    // 검색어 하이라이트(이름/호스트) + 잘릴 때 hover 툴팁
                    const oNm = _el("div", "u4a-lnch__rowname");
                    oNm.innerHTML = _hlMatch(s.name || "", sQ);
                    oNm.title = s.name || "";
                    const oSub = _el("div", "u4a-lnch__rowsub");
                    oSub.innerHTML = (sGroup ? _esc(sGroup) + " · " : "") + _hlMatch(sHostPort, sQ);
                    oSub.title = (sGroup ? sGroup + " · " : "") + sHostPort;
                    oMain.append(oNm, oSub);
                    oR.append(oBadge, oMain);
                    // 상태는 모든 행 공통 표시(연결은 더블클릭/Enter/푸터 버튼)
                    oR.appendChild(_el("span", "u4a-lnch__rowstat" + (bSave ? " on" : ""), bSave ? L("active") : L("inactive")));
                    oR.addEventListener("click", () => { oAPP.attr._launcherActiveIdx = idx; _renderBody(); });
                    oR.addEventListener("dblclick", () => oAPP.fn.fnPressServerListItem(s));
                    oList.appendChild(oR);
                });
            }
            oSecR.appendChild(oList);
            oBodyArea.appendChild(oSecR);

            // 활성 행 보이게 스크롤
            const oActiveRow = oList.querySelector(".u4a-lnch__row.active");
            if (oActiveRow && oActiveRow.scrollIntoView) { try { oActiveRow.scrollIntoView({ block: "nearest" }); } catch (e) { } }

            // 활성 서버 기준으로 푸터 버튼 상태/선택 동기화
            const oActSrv = aRes[oAPP.attr._launcherActiveIdx] || null;
            const bActSave = !!(oActSrv && oActSrv.ISSAVE === true);
            oAPP.attr._selectedServer = oActSrv ? { data: oActSrv, tr: null } : null;
            const _setDis = (sId, bDis) => { const el = document.getElementById(sId); if (el) { el.disabled = bDis; } };
            _setDis("u4aLnchConn", !bActSave);   // 저장(활성)된 서버만 연결
            _setDis("u4aLnchEdit", !oActSrv);    // 선택 있으면 편집(미저장은 등록 팝업)
            _setDis("u4aLnchDel", !bActSave);    // 저장된 서버만 삭제

            // 재렌더로 섹션 구성이 바뀌면 앵커 칩 활성 상태도 재평가
            _syncSpy();
        }

        // 입력/단축키
        oInput.addEventListener("input", () => {
            oAPP.attr._launcherQuery = oInput.value;
            oAPP.attr._launcherActiveIdx = 0;
            _renderBody();
        });
        oInput.addEventListener("keydown", (ev) => {
            const aRes = oAPP.attr._launcherResults || [];
            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                oAPP.attr._launcherActiveIdx = Math.min((oAPP.attr._launcherActiveIdx || 0) + 1, aRes.length - 1);
                _renderBody();
            } else if (ev.key === "ArrowUp") {
                ev.preventDefault();
                oAPP.attr._launcherActiveIdx = Math.max((oAPP.attr._launcherActiveIdx || 0) - 1, 0);
                _renderBody();
            } else if (ev.key === "Enter") {
                ev.preventDefault();
                _launcherConnectActive();
            } else if ((ev.ctrlKey || ev.metaKey) && (ev.key === "e" || ev.key === "E")) {
                ev.preventDefault();
                _launcherEditActive();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                // 값 비우고 input 발화 → 쿼리/렌더/clear(X) 노출까지 한 경로로 동기화
                if (oInput.value) { oInput.value = ""; oInput.dispatchEvent(new Event("input", { bubbles: true })); }
            }
        });

        _renderBody();
        // 풀 재렌더(접속 후 RECENT 갱신·뷰 전환 등)에서 _renderBody 의 active 행 scrollIntoView 가
        // 이전 선택 위치로 점프시킨다 → 직전 스크롤 위치를 복원해 점프 방지(키보드 네비는 부분 렌더라 무관).
        const iKeepScroll = oAPP.attr._lnchScroll || 0;
        oBodyArea.scrollTop = iKeepScroll;
        setTimeout(() => {
            try { oInput.focus({ preventScroll: true }); oInput.setSelectionRange(oInput.value.length, oInput.value.length); } catch (e) { }
            oBodyArea.scrollTop = iKeepScroll; // 포커스 후에도 위치 유지
        }, 0);
    };

    /** [PUBLIC] 활성 뷰 렌더 (본문 재구성 + 트리/내용 채움) */
    oAPP.fn.fnRenderActiveView = function () {
        const oBody = document.getElementById("u4aWsBody");
        if (!oBody) { return; }
        if (!oAPP.attr._viewMode) { oAPP.attr._viewMode = oAPP.fn.fnLoadViewMode(); }
        oBody.innerHTML = "";

        // Launcher 뷰: 트리/폴더 없이 전체 검색 UI (별도 처리)
        if (oAPP.attr._viewMode === VIEW_MODES.LAUNCHER) {
            _updateViewSwitcherActive();
            _buildLauncherBody(oBody);
            oAPP.fn.fnRenderLauncher();
            return;
        }

        if (oAPP.attr._viewMode === VIEW_MODES.MASTER) {
            _buildMasterDetailBody(oBody);
        } else {
            _buildTreeViewBody(oBody);
        }
        _updateViewSwitcherActive();

        // 트리(좌측)는 두 뷰 공통
        oAPP.fn.fnRenderTree();

        // 트리 선택 복원
        const oSelNode = oAPP.attr._selectedTreeNodeData;
        const oPane = document.getElementById("u4aWsTreePane");
        let bRestoredViaKey = false;
        if (oPane) {
            if (oSelNode && oSelNode._attributes) {
                // (1) 메모리에 선택이 있으면 하이라이트만 복원 (뷰 전환 시)
                const sUuid = oSelNode._attributes.uuid;
                const aRows = oPane.querySelectorAll(".u4a-tree__row");
                for (const r of aRows) {
                    if (r._nodeData && r._nodeData._attributes && r._nodeData._attributes.uuid === sUuid) {
                        r.setAttribute("aria-selected", "true");
                        break;
                    }
                }
            } else if (oAPP.attr._lastSelectedNodeKey) {
                // (2) 메모리 선택이 없으면(런처로 시작 후 트리/마스터로 전환 등) 마지막 키로
                //     '전체 선택' = 폴더 로드 + 하이라이트. fnSelectTreeNode 가 내용까지 렌더.
                const aRows = oPane.querySelectorAll(".u4a-tree__row");
                for (const r of aRows) {
                    if (r._nodeData && r._nodeData._attributes && r._nodeData._attributes.uuid === oAPP.attr._lastSelectedNodeKey) {
                        oAPP.fn.fnSelectTreeNode(r);
                        bRestoredViaKey = true;
                        break;
                    }
                }
            }
        }

        // 선택 폴더 내용(테이블/리스트) — (2) 에서 fnSelectTreeNode 가 이미 렌더했으면 중복 생략
        if (!bRestoredViaKey) { _renderFolderContents(); }
    };

    /** [PUBLIC] Master-Detail 가운데 컬럼 — 서버 카드 목록 */
    oAPP.fn.fnRenderMasterList = function () {
        const oPane = document.getElementById("u4aWsMasterListPane");
        if (!oPane) { return; }
        oPane.innerHTML = "";
        oAPP.attr._selectedServer = null;

        const aItems = M.getProperty("/SAPLogonItems") || [];

        // 헤더: 폴더명 · N servers / M active
        let sFolder = "";
        try { sFolder = (oAPP.attr._selectedTreeNodeData && oAPP.attr._selectedTreeNodeData._attributes && oAPP.attr._selectedTreeNodeData._attributes.name) || ""; } catch (e) { }
        const iActive = aItems.filter(o => o.ISSAVE === true).length;
        const oHead = _el("div", "u4a-md__listhead");
        const oHInfo = _el("div", "u4a-md__listinfo");
        const oListTitle = _el("span", "u4a-md__listtitle", sFolder || "");
        oListTitle.title = sFolder || "";   // 잘릴 때 hover 툴팁으로 전체 폴더경로
        oHInfo.appendChild(oListTitle);
        if (aItems.length) {
            oHInfo.appendChild(_el("span", "u4a-md__listmeta", "· " + aItems.length + " " + L("servers")));
        }
        oHead.appendChild(oHInfo);
        if (aItems.length && iActive > 0) {
            // 활성 개수는 성공 틴트 pill 로 (점 + 숫자)
            const oCnt = _el("span", "u4a-md__listcount");
            oCnt.append(_el("span", "u4a-status-dot u4a-status-dot--on"), _el("span", null, iActive + " " + L("active").toLowerCase()));
            oHead.appendChild(oCnt);
        }
        oPane.appendChild(oHead);

        if (aItems.length === 0) {
            oPane.appendChild(_el("div", "u4a-md__empty", L("noData")));
            // 빈 폴더 → 상세도 비움
            oAPP.fn.fnRenderServerDetail(null);
            return;
        }

        // Bootstrap list-group 기반 + 폴리시된 카드 외형(둥근/간격/배지/점) 유지
        const oList = _el("div", "u4a-md__cards list-group");
        aItems.forEach((oItem) => {
            const bSave = (oItem.ISSAVE === true);
            const oCard = _el("div", "u4a-md__card list-group-item list-group-item-action");
            oCard.tabIndex = 0;
            oCard._rowData = oItem;
            const oBadge = _el("span", "u4a-md__badge", oItem.systemid || "");
            const oMain = _el("div", "u4a-md__cardmain");
            oMain.append(_el("div", "u4a-md__cardname", oItem.name || ""), _el("div", "u4a-md__cardsub", oItem.host || ""));
            const oDot = _el("span", "u4a-status-dot" + (bSave ? " u4a-status-dot--on" : ""));
            oCard.append(oBadge, oMain, oDot);

            const _sel = () => {
                oPane.querySelectorAll(".u4a-md__card.active").forEach(c => c.classList.remove("active"));
                oCard.classList.add("active");
                oAPP.attr._selectedServer = { data: oItem, tr: oCard };
                // 뷰별 마지막 선택 기억 (master)
                oAPP.attr._viewSel = oAPP.attr._viewSel || {};
                oAPP.attr._viewSel.master = oItem.uuid || null;
                oAPP.fn.fnRenderServerDetail(oItem);
            };
            oCard.addEventListener("click", _sel);
            oCard.addEventListener("dblclick", () => oAPP.fn.fnPressServerListItem(oItem, oCard));
            oCard.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") { ev.preventDefault(); oAPP.fn.fnPressServerListItem(oItem, oCard); }
            });
            oList.appendChild(oCard);
        });
        oPane.appendChild(oList);

        // 이 뷰(master)의 마지막 선택 복원 → 현재 폴더에 그 서버가 있으면 그것, 없으면 첫 항목
        const sRemMaster = (oAPP.attr._viewSel && oAPP.attr._viewSel.master) || null;
        let oTargetCard = null;
        if (sRemMaster) {
            const aCards = oList.querySelectorAll(".u4a-md__card");
            for (let i = 0; i < aCards.length; i++) {
                if (aCards[i]._rowData && aCards[i]._rowData.uuid === sRemMaster) { oTargetCard = aCards[i]; break; }
            }
        }
        if (!oTargetCard) { oTargetCard = oList.querySelector(".u4a-md__card"); }
        if (oTargetCard) { oTargetCard.click(); oTargetCard.scrollIntoView({ block: "nearest" }); }
    };

    /** [PUBLIC] Master-Detail 우측 컬럼 — 서버 상세 */
    oAPP.fn.fnRenderServerDetail = function (oItem) {
        const oPane = document.getElementById("u4aWsMasterDetailPane");
        if (!oPane) { return; }
        oPane.innerHTML = "";

        if (!oItem) {
            oPane.appendChild(_el("div", "u4a-md__detailempty", L("selectServerHint")));
            return;
        }
        const bSave = (oItem.ISSAVE === true);

        // 상태 pill (active 면 성공 틴트)
        const oStat = _el("div", "u4a-md__detailstat" + (bSave ? " u4a-md__detailstat--on" : ""));
        oStat.append(_el("span", "u4a-status-dot" + (bSave ? " u4a-status-dot--on" : "")), _el("span", null, bSave ? L("active") : L("inactive")));
        oPane.appendChild(oStat);

        // 제목 줄: [SID 배지] 서버명
        const oHead = _el("div", "u4a-md__detailhead");
        oHead.append(
            _el("span", "u4a-md__badge u4a-md__badge--lg", oItem.systemid || ""),
            _el("div", "u4a-md__detailtitle", oItem.name || "")
        );
        oPane.appendChild(oHead);

        // 접속 문자열 (액센트 · 모노)
        const sConn = (oItem.host || "") + (oItem.port ? (":" + oItem.port) : "");
        oPane.appendChild(_el("div", "u4a-md__detailconn", sConn));

        // 구분선
        oPane.appendChild(_el("div", "u4a-md__rule"));

        // 필드 그리드
        let sGroup = "";
        try { sGroup = (oAPP.attr._selectedTreeNodeData && oAPP.attr._selectedTreeNodeData._attributes && oAPP.attr._selectedTreeNodeData._attributes.name) || ""; } catch (e) { }
        const _field = (sLabel, sVal) => {
            const oF = _el("div", "u4a-md__field");
            oF.append(_el("div", "u4a-md__flabel", sLabel), _el("div", "u4a-md__fval", sVal || "—"));
            return oF;
        };
        const oGrid = _el("div", "u4a-md__fields");
        oGrid.append(
            _field(L("host"), oItem.host),
            _field(L("port"), oItem.port),
            _field(L("sid"), oItem.systemid),
            _field(L("sno"), oItem.insno),
            _field(L("group"), sGroup)
        );
        oPane.appendChild(oGrid);

        // 활성(저장)된 서버는 등록한 호스트 정보(protocol://host:port)도 표기 — 접속 host 와 별개
        if (bSave) {
            try {
                const oSaved = oAPP.fn.fnGetSavedServerListData(oItem.uuid);
                if (oSaved.RETCD === "S" && oSaved.RETDATA && oSaved.RETDATA.host) {
                    const d = oSaved.RETDATA;
                    const sUrl = (d.protocol ? d.protocol + "://" : "") + d.host + (d.port ? (":" + d.port) : "");
                    const oReg = _el("div", "u4a-md__reg");
                    oReg.append(
                        _el("div", "u4a-md__flabel", L("regHost")),
                        _el("div", "u4a-md__regval", sUrl)
                    );
                    oPane.appendChild(oReg);
                }
            } catch (e) { console.error("[ServerList] registered host read failed", e); }
        }

        // 액션 (Connect / Edit / Delete) — 기존 핸들러 재사용, Bootstrap 버튼
        const oActions = _el("div", "u4a-md__actions");
        const oConnect = _el("button", "btn btn-primary btn-sm d-inline-flex align-items-center gap-2");
        oConnect.innerHTML = ICON.connect + "<span>" + _esc(L("connect")) + "</span>";
        oConnect.disabled = !bSave;
        oConnect.addEventListener("click", () => oAPP.fn.fnPressServerListItem(oItem));
        const oEdit = _el("button", "btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2");
        oEdit.innerHTML = ICON.edit + "<span>" + _esc(L("edit")) + "</span>";
        oEdit.addEventListener("click", () => oAPP.fn.fnPressEdit());
        const oSpc = _el("div", "u4a-md__actionspacer");
        const oDel = _el("button", "btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2");
        oDel.innerHTML = ICON.trash + "<span>" + _esc(L("del")) + "</span>";
        oDel.disabled = !bSave;
        oDel.addEventListener("click", () => oAPP.fn.fnPressDelete());
        oActions.append(oConnect, oEdit, oSpc, oDel);
        oPane.appendChild(oActions);
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
        // 창 이동은 .u4a-titlebar 의 네이티브 -webkit-app-region:drag(shell.css)로 처리
        // (ServerList 는 최상위 문서라 iframe stale 문제 없음).

        // ── 서브헤더 (Logon Pad 타이틀 + 설정 메뉴) ──
        const oSubBar = _el("div", "u4a-bar");
        const oSubTitle = _el("span", "u4a-bar__title", T("004"));
        oAPP.attr._elSubTitle = oSubTitle;
        const oSubSpacer = _el("div", "u4a-bar__spacer");

        const oSettingsBtn = _buildSettingsDropdown();
        // 마지막 선택 뷰 복원(appdata) 후 뷰 전환 세그먼트 배치
        if (!oAPP.attr._viewMode) { oAPP.attr._viewMode = oAPP.fn.fnLoadViewMode(); }
        oSubBar.append(oSubTitle, oSubSpacer, _buildTestModeToggle(), _buildViewSwitcher(), oSettingsBtn);

        // ── 본문: 활성 뷰(Tree/Master-Detail)에 따라 fnRenderActiveView 가 채운다 ──
        const oBody = _el("div", "u4a-page__body");
        oBody.id = "u4aWsBody";

        oPage.append(oTitlebar, oSubBar, oBody);
        oContent.appendChild(oPage);

        // 활성 뷰 렌더 (초기엔 데이터 비어있음 — fnOnListupSapLogon 이후 재렌더됨)
        oAPP.fn.fnRenderActiveView();

        // 창 리사이즈 시 스플리터 폭 재클램프 (드래그로 고정된 px 가 창 축소 시 넘치는 문제)
        _bindSplitterResizeClamp();

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
     * 화면 라벨 → SQLite 메시지 클래스(ZMSG_WS_COMMON_001) MSGNR 매핑.
     * ★ 언어 텍스트는 절대 소스에 두지 않는다 — 실제 문구는 DB 에서 읽어 출력한다.
     *   L(key) 는 이 표로 번호를 찾아 T(번호)(=/WSLANGU 모델, DB 적재) 로 조회한다.
     *   여기에 쓰는 번호들은 _getModelBindMsgTxtList() 에 함께 적재되어야 한다.
     *   (재사용: status=380, settings=667, del=029 / 신규: 913~946)
     */
    const MSGNR_MAP = {
        status: "380", serverName: "913", sid: "914", host: "915", sno: "916",
        settingsCol: "667", settings: "667", edit: "917", del: "029",
        active: "918", inactive: "919", noData: "946", selectServer: "920",
        dlgConfirm: "921", dlgSuccess: "922", dlgError: "923", dlgWarning: "924",
        viewTree: "925", viewMaster: "926", viewLauncher: "927",
        port: "928", group: "929", connect: "930", servers: "931",
        selectServerHint: "932", regHost: "933",
        launcherPlaceholder: "934", recentConn: "935", searchResults: "936",
        hintMove: "937", hintClear: "938", today: "939", yesterday: "940",
        recentEmpty: "941",
        // 다이얼로그/폼 인라인 라벨
        protocol: "942", hostShort: "943", useInternal: "944", skipCertificate: "945",
        // busy 안내 문구
        exiting: "951"
    };
    function L(sKey) {
        const sNr = MSGNR_MAP[sKey];
        return sNr ? T(sNr) : "";
    }

    // 언어 변경 후 화면 텍스트(UI 라벨) 갱신 — 트리 폴더명(XML 데이터)은 대상 아님
    oAPP.fn.fnRefreshShellTexts = function () {
        // 서브헤더 타이틀 (WSUTIL 메시지)
        if (oAPP.attr._elSubTitle) {
            oAPP.attr._elSubTitle.textContent = T("004");
        }
        // 활성 뷰 전체 재렌더 → 현지화(헤더/버튼/상태/상세 라벨) 반영
        oAPP.fn.fnRenderActiveView();
    };

    /********************************************************************
     * 좌측 워크스페이스 트리 렌더 (UI5 TreeTable 대체)
     ********************************************************************/
    oAPP.fn.fnRenderTree = function () {
        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane) { return; }

        // 공통 베이스 트리(U4AUI.createTree) — 코어 UX 단일 출처(재귀 마크업/토글/들여쓰기).
        //   펼침 영속(uuid 맵)·선택·복원은 기존 외부 로직이 DOM 계약(li>.u4a-tree__row+ul) 위에서
        //   그대로 동작한다. 컨트롤러는 1회 생성 후 재사용(상태 유지), 매 호출 render() 만 다시.
        if (!oAPP.attr._treeCtrl) {
            oAPP.attr._treeCtrl = window.U4AUI.createTree({
                roots:    () => { const o = M.getProperty("/SAPLogon"); return (o && o.Node) ? (Array.isArray(o.Node) ? o.Node : [o.Node]) : []; },
                children: (n) => { const c = n.Node; return c ? (Array.isArray(c) ? c : [c]) : []; },
                key:      (n) => (n._attributes && n._attributes.uuid) || "",
                // 트리 라벨/툴팁은 SAPUILandscape.xml 의 폴더명(사용자 데이터) — 현지화 대상 아님
                label:    (n) => (n._attributes && n._attributes.name) || "",
                tip:      (n) => (n._attributes && n._attributes.name) || "",
                icon:     () => ICON.folder,
                // 기본 펼침: 루트(level0)와 그 하위(level1)까지. 그 외는 토글 기억값(uuid 맵).
                initialExpanded: (n, lvl) => {
                    const u = n._attributes && n._attributes.uuid;
                    const m = (oAPP.attr._treeExpanded = oAPP.attr._treeExpanded || {});
                    return (u && Object.prototype.hasOwnProperty.call(m, u)) ? !!m[u] : (lvl < 2);
                },
                onToggle: (n, bOpen) => {
                    const u = n._attributes && n._attributes.uuid;
                    if (u) { (oAPP.attr._treeExpanded = oAPP.attr._treeExpanded || {})[u] = bOpen; }
                },
                // 외부 로직(재선택 복원/우클릭 복원)이 r._nodeData 로 행을 찾으므로 stash 필수. 홀짝 줄무늬도 유지.
                rowHook: (oRow, n, ctx) => { oRow.dataset.odd = ctx.odd ? "true" : "false"; oRow._nodeData = n; },
                onSelect: (n, oRow) => oAPP.fn.fnSelectTreeNode(oRow),
            });
        }

        const oCtrl = oAPP.attr._treeCtrl;
        if (oCtrl.el.parentElement !== oPane) { oPane.innerHTML = ""; oPane.appendChild(oCtrl.el); }
        oCtrl.render();

        // 스크롤 위치 기억/복원 (뷰 전환 시 트리 스크롤 유지)
        if (oAPP.attr._treeScroll) { oPane.scrollTop = oAPP.attr._treeScroll; }
        if (!oPane._u4aScrollBound) {
            oPane._u4aScrollBound = true;
            oPane.addEventListener("scroll", () => { oAPP.attr._treeScroll = oPane.scrollTop; });
        }
    };

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
        // 뷰별 마지막 선택 기억 (현재 뷰 슬롯). master 에서 연결 시에도 master 슬롯에 기록됨.
        oAPP.attr._viewSel = oAPP.attr._viewSel || {};
        oAPP.attr._viewSel[oAPP.attr._viewMode] = (oItem && oItem.uuid) || null;
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
            _renderFolderContents();
        }
    };

    oAPP.fn.fnPressWorkSpaceTreeItem = async function (oNodeData) {

        oAPP.attr._selectedTreeNodeData = oNodeData;

        // 폴더 전환 시 컬럼 필터/정렬 초기화 — 폴더 간 필터가 새지 않도록.
        //  (기본 정렬은 아래에서 name 오름차순으로 로드되는 원본 순서)
        oAPP.attr._colFilters = {};
        oAPP.attr._sortCol = null;
        oAPP.attr._sortDir = null;

        M.setProperty("/SAPLogonItems", []);

        if (!oNodeData || !oNodeData._attributes) {
            _renderFolderContents();
            return;
        }

        const sUUID = oNodeData._attributes.uuid;

        // 마지막 선택 노드 키 저장 (메모리 + 레지스트리)
        oAPP.attr._lastSelectedNodeKey = sUUID;
        await oAPP.fn.setRegistryLastSelectedNodeKey(sUUID);

        // 폴더의 서버(Item) 목록
        let aItem = oNodeData.Item;
        if (!aItem) {
            _renderFolderContents();
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

        _renderFolderContents();
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

        // 선택 노드 키는 뷰(트리 유무)와 무관하게 메모리에 보관 — 런처로 시작했다가
        //  나중에 트리/마스터로 전환할 때 폴더 선택을 복원하기 위함.
        if (sLastKey) { oAPP.attr._lastSelectedNodeKey = sLastKey; }

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

        // 헤더 툴바 (Edit / Delete — fnGetSAPLogonListTableToolbar 대체), Bootstrap 버튼
        const oToolbar = _el("div", "u4a-toolbar");
        const oEditBtn = _el("button", "btn btn-primary btn-sm d-inline-flex align-items-center gap-2");
        oEditBtn.innerHTML = ICON.edit + "<span>" + _esc(L("edit")) + "</span>";
        oEditBtn.title = L("edit");
        oEditBtn.addEventListener("click", () => oAPP.fn.fnPressEdit());
        const oDelBtn = _el("button", "btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2");
        oDelBtn.innerHTML = ICON.trash + "<span>" + _esc(L("del")) + "</span>";
        oDelBtn.title = L("del");
        oDelBtn.addEventListener("click", () => oAPP.fn.fnPressDelete());
        oToolbar.append(oEditBtn, oDelBtn);
        oPane.appendChild(oToolbar);

        const oWrap = _el("div", "u4a-table-wrap");
        // Bootstrap .table 기반(테마=브리지 --bs-table-*) + 커스텀 .u4a-table 비주얼 유지.
        //  (sticky/zebra/선택/반응형/컬럼메뉴는 커스텀 CSS 가 담당 → table-hover/striped 는 미사용)
        const oTable = _el("table", "u4a-table table align-middle");
        oTable.id = SERVER_TBL_ID;

        // 헤더 (정렬 가능 컬럼: ISSAVE/name/systemid/host)
        // width: fixed 레이아웃용 컬럼 폭. name 은 미지정 → 남은 폭을 차지.
        const aCols = [
            { key: "ISSAVE", label: L("status"), sortable: true, cls: "u4a-c-status", width: "7.5rem" },
            { key: "name", label: L("serverName"), sortable: true, cls: "u4a-c-name" },
            { key: "systemid", label: L("sid"), sortable: true, cls: "u4a-c-sid", width: "5rem" },
            { key: "host", label: L("host"), sortable: true, cls: "u4a-c-host", width: "9rem" },
            { key: "insno", label: L("sno"), sortable: true, align: "center", cls: "u4a-c-sno", width: "5.25rem" },
            // 폭: 영문 라벨("Settings")이 셀 좌우 패딩(0.75rem) 안에 들어가도록 확보.
            //  (구 3.75rem 는 아이콘 폭 기준이라 영문 헤더가 셀을 넘쳐 창 우측에 붙어 잘렸음)
            { key: "__action", label: L("settingsCol"), sortable: false, align: "center", cls: "u4a-c-action", width: "5.5rem" }
        ];

        const oFilters = oAPP.attr._colFilters || {};
        const oThead = _el("thead");
        const oHrow = _el("tr");
        for (const oCol of aCols) {
            const oTh = _el("th", oCol.cls);
            if (oCol.width) { oTh.style.width = oCol.width; }
            // 라벨이 컬럼 폭보다 길어 말줄임될 때 전체 텍스트를 호버로 확인 가능하게
            oTh.title = oCol.label;

            // 라벨 + 표시자(정렬 caret / 필터 아이콘)를 한 줄 flex 로 배치
            //  → 구: 라벨 뒤에 caret 을 그냥 붙여 컬럼 경계에 끼이던 문제 해소
            const oInner = _el("div", "u4a-th__inner");
            if (oCol.align === "center") { oInner.classList.add("u4a-th__inner--center"); }
            oInner.appendChild(_el("span", "u4a-th__label", oCol.label));

            if (oCol.sortable) {
                // 정렬/필터가 걸린 컬럼에만 표시자 노출
                const bSorted = (oAPP.attr._sortCol === oCol.key);
                const bFiltered = !!oFilters[oCol.key];
                if (bSorted || bFiltered) {
                    const oInd = _el("span", "u4a-th__ind");
                    if (bSorted) {
                        oInd.innerHTML += (oAPP.attr._sortDir === "desc") ? ICON.sortDesc : ICON.sortAsc;
                    }
                    if (bFiltered) {
                        oInd.innerHTML += ICON.filter;
                    }
                    oInner.appendChild(oInd);
                }
                oTh.appendChild(oInner);
                oTh.classList.add("u4a-th--menu");
                oTh.dataset.col = oCol.key;
                oTh.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    oAPP.fn.fnOpenColumnMenu(oCol, oTh);
                });
            } else {
                oTh.appendChild(oInner);
                oTh.style.cursor = "default";
            }
            oHrow.appendChild(oTh);
        }
        oThead.appendChild(oHrow);
        oTable.appendChild(oThead);

        // 바디
        const oTbody = _el("tbody");
        // 원본(/SAPLogonItems)은 보존하고, 화면에 그릴 뷰만 필터+정렬로 파생한다.
        //  (저장상태 동기화·선택·삭제 흐름이 항상 전체 목록 기준으로 동작하도록)
        const aItems = _buildServerView(M.getProperty("/SAPLogonItems") || []);

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

                // 카드(타일) 뷰에서 라벨로 쓰일 컬럼명
                oTdStatus.dataset.label = L("status");
                oTdSid.dataset.label = L("sid");
                oTdHost.dataset.label = L("host");
                oTdSno.dataset.label = L("sno");

                // Settings 버튼
                const oTdAct = _el("td", "u4a-col-action u4a-c-action");
                oTdAct.dataset.label = L("settingsCol");
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

        // 마지막 선택 서버(행) 복원 — 이 뷰(tree) 슬롯 우선, 없으면 앱 재시작 복원용 키.
        const sRestoreKey = (oAPP.attr._viewSel && oAPP.attr._viewSel.tree) || oAPP.attr._lastSelectedServerKey;
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
        // 일정 폭(560px) 미만이면 컬럼을 숨기지 않고 카드(타일) 뷰로 전환.
        const sView = (iWidth < 560) ? "card" : "table";
        // 값이 바뀔 때만 기록 (불필요한 레이아웃 무효화/루프 방지)
        if (oWrap.dataset.view !== sView) {
            oWrap.dataset.view = sView;
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
    // 드래그/리사이즈는 동기로 즉시 갱신(관측 사이클 밖이라 루프 위험 없음)
    oAPP.fn.fnUpdateTableWidthClass = _setTableWidthClass;

    function _observeTableWidth(oWrap) {
        oAPP.attr._tblWrap = oWrap;

        // 1) 즉시 1회 (observer 초기 콜백 타이밍에 의존하지 않음)
        _setTableWidthClass();

        // 2) ResizeObserver — 콜백 안 동기 변경 시 루프 경고 → rAF 디바운스만 여기 사용
        if (oAPP.attr._tblRO) {
            oAPP.attr._tblRO.disconnect();
        }
        if (typeof ResizeObserver !== "undefined") {
            oAPP.attr._tblRO = new ResizeObserver(function () { _scheduleTableWidthUpdate(); });
            oAPP.attr._tblRO.observe(oWrap);
        }

        // 3) window resize (창 리사이즈 — 동기, 1회만 바인딩)
        if (!oAPP.attr._tblResizeBound) {
            oAPP.attr._tblResizeBound = true;
            window.addEventListener("resize", function () {
                _clampSplitterPane();   // restore 시 트리 패널이 창보다 넓어지는 것 방지
                _setTableWidthClass();
            });
        }
    }

    /**
     * 컬럼의 "화면 표시 텍스트" — 필터/정렬은 사용자가 보는 값 기준으로 동작한다.
     *  (예: STATUS 는 내부값 true/false 가 아니라 Active/Inactive 텍스트로 필터)
     */
    function _colDisplayText(sKey, oItem) {
        if (sKey === "ISSAVE") {
            return (oItem.ISSAVE === true) ? L("active") : L("inactive");
        }
        const v = oItem[sKey];
        return (v == null) ? "" : String(v);
    }

    /**
     * 원본 목록 → 화면 뷰(필터 AND 결합 + 단일 컬럼 정렬). 원본 배열은 변형하지 않는다.
     */
    function _buildServerView(aSource) {
        let aView = aSource.slice();

        // 1) 필터 (활성화된 모든 컬럼 AND, 대소문자 무시 contains)
        const oF = oAPP.attr._colFilters || {};
        const aKeys = Object.keys(oF).filter((k) => oF[k]);
        if (aKeys.length) {
            aView = aView.filter((oItem) =>
                aKeys.every((k) => _colDisplayText(k, oItem).toLowerCase().indexOf(oF[k]) !== -1)
            );
        }

        // 2) 정렬 (선택된 컬럼 1개)
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
     * 컬럼 헤더 메뉴 (필터 input + 오름/내림차순 + 초기화)
     *  — 구 fnSortServerTable(단순 asc/desc 토글)을 대체.
     *  공통 팝오버 컴포넌트(.u4a-menu / _positionMenu / _bindOutsideClose) 재사용.
     ********************************************************************/
    oAPP.fn.fnOpenColumnMenu = function (oCol, oAnchorTh) {
        _closeAllMenus();

        oAPP.attr._colFilters = oAPP.attr._colFilters || {};

        const oMenu = _el("div", "u4a-menu u4a-colmenu");
        oMenu.setAttribute("role", "menu");
        // 메뉴 내부 클릭이 헤더(정렬 토글 등)로 버블링되지 않도록 차단
        oMenu.addEventListener("click", (ev) => ev.stopPropagation());

        // ── 필터 입력 (라이브) ──
        const oFilterWrap = _el("div", "u4a-colmenu__filter");
        const oInput = _el("input", "u4a-input");
        oInput.type = "text";
        oInput.placeholder = oAPP.msg.FILTERVAL || ""; // /U4A/CL_WS_COMMON A68 (필터 값)
        oInput.value = oAPP.attr._colFilters[oCol.key] || "";
        // 입력 즉시가 아니라 Enter / 포커스 아웃(blur) 시점에만 필터 적용.
        const _applyFilter = () => {
            const sVal = oInput.value.trim().toLowerCase();
            const sCur = oAPP.attr._colFilters[oCol.key] || "";
            if (sVal === sCur) { return; } // 변화 없으면 재렌더 생략(선택 유지)
            if (sVal) { oAPP.attr._colFilters[oCol.key] = sVal; }
            else { delete oAPP.attr._colFilters[oCol.key]; }
            oAPP.fn.fnRenderServerTable(); // 메뉴는 body 에 있어 재렌더에도 유지됨
        };
        oInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") { ev.preventDefault(); _applyFilter(); _closeAllMenus(); }
        });
        oInput.addEventListener("blur", _applyFilter);
        oFilterWrap.appendChild(oInput);
        oMenu.appendChild(oFilterWrap);

        oMenu.appendChild(_el("div", "u4a-colmenu__sep"));

        // ── 정렬 (오름/내림차순) — 라벨은 ZMSG_WS_COMMON_001 810/811 ──
        //  현재 적용 중인 방향을 다시 누르면 정렬 해제(토글 off).
        const _mkSort = (sDir, sIcon, sLabel) => {
            const oRow = _el("div", "u4a-menu__item");
            oRow.setAttribute("role", "menuitem");
            oRow.tabIndex = 0;
            oRow.innerHTML = sIcon + "<span>" + _esc(sLabel) + "</span>";
            const bActive = (oAPP.attr._sortCol === oCol.key && oAPP.attr._sortDir === sDir);
            if (bActive) { oRow.dataset.active = "true"; }
            oRow.addEventListener("click", () => {
                if (bActive) {
                    // 같은 방향 재클릭 → 정렬 해제
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
        oMenu.appendChild(_mkSort("asc", ICON.sortAsc, T("810")));   // 오름차순 / Ascending
        oMenu.appendChild(_mkSort("desc", ICON.sortDesc, T("811"))); // 내림차순 / Descending

        oMenu.appendChild(_el("div", "u4a-colmenu__sep"));

        // ── 필터 초기화 (/U4A/CL_WS_COMMON A69) — 이 컬럼 필터만 해제 ──
        const oClear = _el("div", "u4a-menu__item");
        oClear.setAttribute("role", "menuitem");
        oClear.tabIndex = 0;
        oClear.innerHTML = ICON.clear + "<span>" + _esc(oAPP.msg.CLEARFILTER || "") + "</span>";
        // 활성 필터가 없으면 비활성 표시
        if (!oAPP.attr._colFilters[oCol.key]) { oClear.setAttribute("aria-disabled", "true"); }
        oClear.addEventListener("click", () => {
            if (!oAPP.attr._colFilters[oCol.key]) { return; }
            delete oAPP.attr._colFilters[oCol.key];
            oInput.value = "";
            oAPP.fn.fnRenderServerTable();
            _closeAllMenus();
        });
        oMenu.appendChild(oClear);

        document.body.appendChild(oMenu);
        _positionMenu(oMenu, oAnchorTh, "left"); // 컬럼 메뉴는 헤더 좌변 기준 정렬
        _bindOutsideClose(oMenu);
        setTimeout(() => oInput.focus(), 0);
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
        oChk1Lbl.append(oChk1, _el("span", null, L("useInternal")));
        oRow1.appendChild(oChk1Lbl);

        // Skip Certificate
        const oRow2 = _el("div", "u4a-form__row");
        const oChk2Lbl = _el("label", "u4a-check");
        const oChk2 = document.createElement("input");
        oChk2.type = "checkbox";
        oChk2.checked = !!oSettings.skipCertificate;
        oChk2Lbl.append(oChk2, _el("span", null, L("skipCertificate")));
        oRow2.appendChild(oChk2Lbl);

        const oForm = _el("div", "u4a-form");
        oForm.append(oRow1, oRow2);

        _createFormDialog({
            title: `${L("settings")} - ${oItem.name || ""}`,
            icon: ICON.settings,
            bodyEl: oForm,
            buttons: [
                {
                    text: T("002") || "OK", type: "emphasized",
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
                { text: T("003") || "Cancel", onClick: (oCtl) => oCtl.close() }
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

        // 테스트 모드: 입력한 ID 를 로그인 창으로 전달 → 일치하는 스태프 버튼 자동 로그인
        if (oAPP.attr._testMode && oAPP.attr._testId && oAPP.attr._testId.trim()) {
            oLoginInfo.TESTID = oAPP.attr._testId.trim();
        }

        // 사용자 테마 정보
        const oP13nThemeInfo = await fnP13nCreateTheme(oLoginInfo.SYSID);
        if (oP13nThemeInfo.RETCD === "S") {
            oLoginInfo.oThemeInfo = oP13nThemeInfo.RTDATA;
        }

        // 선택 정보 레지스트리 저장
        await _registSelectedSystemInfo(oLoginInfo);

        // 접속 이력 기록 (Launcher '최근 연결' 용 — appdata)
        oAPP.fn.fnRecordConnection(sUUID);
        // Launcher 가 떠 있으면 즉시 RECENT 갱신(연결 새 창은 별도 → 이 창은 남아있음)
        if (oAPP.attr._viewMode === VIEW_MODES.LAUNCHER) {
            try { oAPP.fn.fnRenderLauncher(); } catch (e) { }
        }

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
        oRowP.appendChild(_el("label", "u4a-label u4a-label--required", L("protocol")));
        const oSelProto = _createSelect(
            [{ value: "http", text: "http" }, { value: "https", text: "https" }],
            oSaveData.protocol
        );
        oRowP.appendChild(oSelProto);
        oForm.appendChild(oRowP);

        // Host (required + ValueState)
        const oRowH = _el("div", "u4a-form__row");
        oRowH.appendChild(_el("label", "u4a-label u4a-label--required", L("hostShort")));
        const oInpHost = _el("input", "u4a-input");
        oInpHost.type = "text";
        oInpHost.value = oSaveData.host || "";
        const oHostMsg = _el("div", "u4a-field__msg");
        oRowH.append(_wrapClear(oInpHost), oHostMsg);
        oForm.appendChild(oRowH);

        // Port (number, maxlength 5)
        const oRowPort = _el("div", "u4a-form__row");
        oRowPort.appendChild(_el("label", "u4a-label", L("port")));
        const oInpPort = _el("input", "u4a-input");
        oInpPort.type = "number";
        oInpPort.maxLength = 5;
        oInpPort.value = oSaveData.port || "";
        oRowPort.appendChild(_wrapClear(oInpPort));
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
                { text: T("002") || "OK", type: "emphasized", onClick: (oCtl) => oAPP.fn.fnPressSave(oCtl) },
                { text: T("003") || "Cancel", onClick: (oCtl) => oCtl.close() }
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
            SYSID: oLoginInfo.SYSID,
            // [테마 기반 부팅] 메인 프레임이 첫 페인트 전에 설정 테마를 적용하도록 테마명 전달.
            // BGCOL: 테마 CSS(<link>)가 비동기 로드되는 찰나의 흰색을 막기 위해, 창이 이미 아는
            //        테마 배경색을 동기 캔버스(--boot-bg)로 즉시 깔도록 함께 전달.
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
            const sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme_ws4", `${SYSID}.json`);
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
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { const v = oSel.value; oCtl.close(); oAPP.setBusy(true); await _saveWsLangu(v, oCtl); } },
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
            { KEY: "horizon_green", TXT: "Horizon Green" },
            { KEY: "horizon_xp", TXT: "Windows XP" },
            { KEY: "horizon_95", TXT: "Windows 95" },
            { KEY: "horizon_7", TXT: "Windows 7" },
            { KEY: "horizon_signature", TXT: "SAP Signature" }
        ];
        const sCurrent = U4ATheme.current();

        const oSel = _createSelect(
            aThemes.map(t => ({ value: t.KEY, text: t.TXT })),
            sCurrent,
            (v) => oAPP.fn.fnApplyTheme(v)   // 실시간 미리보기
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
            onCancel: (oCtl) => { oAPP.fn.fnApplyTheme(sCurrent); oCtl.close(); },
            buttons: [
                { text: T("002") || "OK", type: "emphasized", onClick: async (oCtl) => { const v = oSel.value; oCtl.close(); oAPP.setBusy(true); await _saveWsThemeInfo(v, oCtl); } },
                { text: T("003") || "Cancel", onClick: (oCtl) => { oAPP.fn.fnApplyTheme(sCurrent); oCtl.close(); } }
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
        oAPP.fn.fnApplyTheme(sKey);
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

            // 종료 진행 동안 busy 오버레이 + 안내 문구로 사용자 인지 ("종료 중… (남은초)")
            const sExiting = L("exiting");
            const sBase = sExiting ? sExiting + "…" : "";
            const _renderBusy = (iSec) => {
                oAPP.setBusy(true, sBase ? `${sBase} (${iSec}s)` : `(${iSec}s)`);
            };

            oAPP.fn.fnProgramShuttDown(); // 전체 자식 프로그램 종료 요청

            if (oAPP.attr.windowCloseInterval) {
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
            }

            // 자식(MAIN) 창이 모두 닫히면 즉시 종료. 단, 최대 30초까지만 기다리고
            // 그래도 안 닫힌 창이 있으면 강제로 파기한 뒤 앱을 종료한다(무한 대기 방지).
            let iLeft = 30;
            _renderBusy(iLeft);
            const _finish = () => {
                clearInterval(oAPP.attr.windowCloseInterval);
                delete oAPP.attr.windowCloseInterval;
                APP.exit();
            };
            oAPP.attr.windowCloseInterval = setInterval(() => {
                if (_checkMainProgramExit()) { _finish(); return; }

                iLeft -= 1;
                if (iLeft <= 0) {
                    // 30초 경과 — 정상 종료에 응답하지 않는 MAIN 창을 강제 파기 후 종료
                    console.warn("[shutdown] 30초 경과 — 남은 MAIN 창 강제 종료");
                    _forceCloseRemainMain();
                    _finish();
                    return;
                }
                _renderBusy(iLeft);
            }, 1000);
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

    /** 정상 종료에 응답하지 않는 MAIN 창을 강제 파기 (30초 타임아웃 후 호출) */
    function _forceCloseRemainMain() {
        const aBrowserList = REMOTE.BrowserWindow.getAllWindows();
        for (const oBrows of aBrowserList) {
            if (!oBrows || oBrows.isDestroyed()) { continue; }
            let oWebPref;
            try {
                oWebPref = WSUTIL.QueryString.parse(oBrows.getURL());
            } catch (error) {
                continue;
            }
            if (oWebPref.OBJTY !== "MAIN") { continue; }
            try {
                oBrows.destroy();
            } catch (e) {
                console.error("[shutdown] MAIN 창 강제 종료 실패:", e);
            }
        }
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

    /**
     * 입력을 .u4a-field 래퍼로 감싸고 "값이 있을 때만" 보이는 X(clear) 버튼을 단다.
     * (UI5 Input showClearIcon 대체 — Login 화면과 동일한 공통 컴포넌트/동작 사용)
     * @param {HTMLInputElement} oInput 대상 입력 (u4a-input)
     * @returns {HTMLElement} .u4a-field 래퍼 (행에 append 하여 사용)
     */
    function _wrapClear(oInput) {
        oInput.classList.add("u4a-field__input");
        const oWrap = _el("div", "u4a-field");
        oWrap.dataset.trail = "1";
        const oClear = _el("button", "u4a-field__clear");
        oClear.type = "button";
        oClear.title = L("hintClear");
        oClear.setAttribute("aria-label", L("hintClear"));
        oClear.tabIndex = -1;
        oClear.innerHTML = ICON.clear;
        oWrap.append(oInput, oClear);
        // 값 있을 때만 노출 + 클릭 시 비우고 input 이벤트 발화 (data-filled 토글)
        window.U4AUI.attachClear(oInput, oClear);
        return oWrap;
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
        // 공통 인앱 다이얼로그 — 앱 전 화면 공통인 네이티브 <dialog class="u4a-dialog"> (16 §2).
        //   · 헤더 드래그=전역 자동(u4a-ui.js _installGlobalDialogDrag)
        //   · 우하단 grip 리사이즈(makeDialogResizable) · 헤더 더블클릭 중앙복귀(makeDialogRecenter)
        //   · 헤더/푸터 48px · 헤더 닫기 X · data-type 의미색 — 전부 shell.css .u4a-dialog 공통.
        //   반환 계약(dlg/close)·opt(title/icon/bodyEl/buttons/width/onCancel/initialFocusEl/bodyFlush) 보존.
        const oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog";
        if (opt.width) { oDlg.style.width = "min(" + opt.width + ", 92vw)"; }

        const oCtl = {
            dlg: oDlg,
            close() { try { oDlg.close(); } catch (e) { oDlg.remove(); } }
        };

        const _cancel = () => {
            if (typeof opt.onCancel === "function") { opt.onCancel(oCtl); }
            else { oCtl.close(); }
        };

        // header: 선두 아이콘(직계 <i>) + 제목 span(flex) + 닫기 X
        const oHead = _el("div", "u4a-dialog__header");
        if (opt.icon) {
            const oTmp = document.createElement("span");
            oTmp.innerHTML = opt.icon;
            if (oTmp.firstChild) { oHead.appendChild(oTmp.firstChild); } // <i> 를 직계로
        }
        const oTitleSpan = _el("span", null, opt.title || "");
        oTitleSpan.title = opt.title || ""; // 말줄임될 때 전체 제목 호버 확인
        oHead.appendChild(oTitleSpan);
        const oX = _el("button", "u4a-btn-icon");
        oX.type = "button";
        oX.dataset.act = "close";
        oX.setAttribute("aria-label", T("056") || "Close");
        oX.innerHTML = ICON.close;
        oX.addEventListener("click", _cancel);
        oHead.appendChild(oX);
        oDlg.appendChild(oHead);

        // body
        const oBody = _el("div", "u4a-dialog__body" + (opt.bodyFlush ? " u4a-dialog__body--flush" : ""));
        if (opt.bodyEl) { oBody.appendChild(opt.bodyEl); }
        oDlg.appendChild(oBody);

        // footer (buttons) — 공통 .u4a-btn 의미색(emphasized=accent / reject=negative / 기본=중립)
        if (opt.buttons && opt.buttons.length) {
            const oFoot = _el("div", "u4a-dialog__footer");
            opt.buttons.forEach(b => {
                let sCls = "u4a-btn";
                if (b.type === "emphasized") { sCls = "u4a-btn u4a-btn--emphasized"; }
                if (b.type === "reject") { sCls = "u4a-btn u4a-btn--negative"; }
                const oBtn = _el("button", sCls);
                oBtn.type = "button";
                if (b.icon) {
                    oBtn.innerHTML = b.icon + (b.text ? `<span>${_esc(b.text)}</span>` : "");
                } else {
                    oBtn.textContent = b.text || "";
                }
                oBtn.addEventListener("click", () => b.onClick(oCtl));
                oFoot.appendChild(oBtn);
            });
            oDlg.appendChild(oFoot);
        }

        document.body.appendChild(oDlg);

        // ESC(native cancel) → 원본 cancel 동작
        oDlg.addEventListener("cancel", (ev) => { ev.preventDefault(); _cancel(); });
        // 닫힘 후 DOM 제거
        oDlg.addEventListener("close", () => { oDlg.remove(); });

        oDlg.showModal();

        // 공통 동작: 우하단 grip 리사이즈 + 헤더 더블클릭 중앙복귀 (드래그는 전역 자동)
        try {
            if (window.U4AUI) {
                if (U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg); }
                if (U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHead); }
            }
        } catch (e) { /* 헬퍼 없으면 무시 */ }

        // 초기 포커스
        if (opt.initialFocusEl) {
            setTimeout(() => { try { opt.initialFocusEl.focus(); } catch (e) { } }, 0);
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
        // 공통 컴포넌트 라이브러리(U4AUI)에 위임 — 단일 표준 (theme/u4a-ui.js)
        return window.U4AUI.createSelect(aItems, sValue, fnChange);
    }

    /** 드래그 대상 패널 오른쪽으로 확보해야 할 폭 — 뒤 형제(패널 min-width + 바)를 합산.
     *  2컬럼/3컬럼 모두 정확(마지막 패널이 짜부되어 사라지는 문제 방지). */
    function _splitterReserve(oPane) {
        let iReserve = 0;
        let el = oPane.nextElementSibling;
        while (el) {
            if (el.classList && el.classList.contains("u4a-splitter__bar")) {
                iReserve += el.offsetWidth || 11;
            } else if (el.classList && el.classList.contains("u4a-splitter__pane")) {
                // 뒤 패널이 px 고정(드래그됨, 축소 불가)이면 '실제 폭'을, 유연(1 1 auto)이면
                // 최소폭을 예약 → 고정 패널들 합이 커도 마지막 유연 패널이 잘려 사라지지 않음.
                const bFixed = /\dpx/.test(el.style.flex || "");
                if (bFixed) {
                    iReserve += el.offsetWidth || 160;
                } else {
                    const mw = parseFloat(getComputedStyle(el).minWidth);
                    iReserve += (mw && mw > 0) ? mw : 160;
                }
            }
            el = el.nextElementSibling;
        }
        return iReserve > 0 ? iReserve : 248; // 폴백(뒤 형제 없을 때)
    }

    function _minPaneW(oPane) {
        const mw = parseFloat(getComputedStyle(oPane).minWidth);
        return (mw && mw > 0) ? mw : 120;
    }
    // 바 바로 오른쪽의 인접 패널
    function _rightPaneOf(oBar) {
        let el = oBar.nextElementSibling;
        while (el && !(el.classList && el.classList.contains("u4a-splitter__pane"))) { el = el.nextElementSibling; }
        return el;
    }
    // 해당 패널이 (뒤에 다른 패널이 없는) 마지막 유연 패널인가
    function _isLastPane(oPane) {
        let el = oPane && oPane.nextElementSibling;
        while (el) {
            if (el.classList && el.classList.contains("u4a-splitter__pane")) { return false; }
            el = el.nextElementSibling;
        }
        return true;
    }

    /**
     * 표준 스플리터(인접 재분배): 바를 드래그하면 "양 옆 인접 패널" 사이에서만 폭을
     * 주고받는다. 오른쪽 이웃이 마지막(유연) 패널이면 왼쪽만 px 로 두고 flex 로 채운다.
     *  → 바2 를 옮겨도 바1 은 col2 를 줄이며 정상 이동(상식적 동작). 마지막 패널 안 사라짐.
     */
    /**
     * give-way 스플리터 드래그 (Master-Detail 전용) — WS20 _bindResizer 포팅.
     *   구조: 트리(좌 사이드) | 목록(센터=#u4aWsMasterListPane, 1 1 auto) | 상세(우 사이드).
     *   바를 끌면 self(사이드) 확대 → ① 센터가 먼저 자기 min 까지 흡수 → ② 센터가 min 에 닿으면
     *   반대편 사이드가 자기 min 까지 양보(밀림). self 상한 = 전체 − 센터min − 반대편min(hard stop).
     *   self·opp 는 0 0 px(JS 단일 출처), 센터는 1 1 auto 라 나머지를 자동 흡수.
     * @param {HTMLElement} oBar   드래그 바
     * @param {HTMLElement} oSelf  바가 리사이즈할 사이드 패널(트리=좌바 / 상세=우바)
     * @param {"left"|"right"} sSide  좌바=+delta(우로 끌면 self 확대) / 우바=−delta
     */
    function _attachGiveWaySplitterDrag(oBar, oSelf, sSide) {
        // ★ oSplit 은 setup 시점(append 전)엔 oBar.parentElement 가 null 이므로 mousedown 에서 잡는다.
        let oSplit = null;
        const _min = (el) => { const v = parseFloat(getComputedStyle(el).minWidth); return (v > 0) ? v : 120; };
        const _barsW = () => {
            let w = 0;
            oSplit.querySelectorAll(".u4a-splitter__bar").forEach((b) => { w += b.offsetWidth || 8; });
            return w;
        };
        const _center = () => oSplit.querySelector("#u4aWsMasterListPane");
        const _opp = () => oSplit.querySelector(
            oSelf.id === "u4aWsTreePane" ? "#u4aWsMasterDetailPane" : "#u4aWsTreePane"
        );

        let bDrag = false, iStartX = 0, iStartW = 0;
        function lf_move(ev) {
            if (!bDrag || !oSplit) { return; }
            const oCenter = _center(), oOpp = _opp();
            if (!oCenter || !oOpp) { return; }

            const iCenterMin = _min(oCenter), iSelfMin = _min(oSelf), iOppMin = _min(oOpp);
            const iTotal = oSplit.clientWidth - _barsW();

            const iDelta = ev.clientX - iStartX;
            let iSelf = (sSide === "left") ? (iStartW + iDelta) : (iStartW - iDelta);

            // self 상한 = 센터·반대편이 모두 min 일 때
            const iSelfMax = iTotal - iCenterMin - iOppMin;
            if (iSelf > iSelfMax) { iSelf = iSelfMax; }
            if (iSelf < iSelfMin) { iSelf = iSelfMin; }

            // 반대편: 센터가 자기 min 보다 더 줄어야 할 때만 양보(자기 min 까지)
            let iOpp = oOpp.getBoundingClientRect().width;
            if (iTotal - iSelf - iOpp < iCenterMin) {
                iOpp = iTotal - iSelf - iCenterMin;
                if (iOpp < iOppMin) { iOpp = iOppMin; }
            }

            oSelf.style.flex = "0 0 " + iSelf + "px";
            oOpp.style.flex = "0 0 " + iOpp + "px";
        }
        function lf_up() {
            if (!bDrag) { return; }
            bDrag = false;
            document.body.style.cursor = "";
            window.removeEventListener("mousemove", lf_move);
            window.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", (ev) => {
            oSplit = oBar.parentElement; // 이 시점엔 이미 append 됨
            if (!oSplit) { return; }
            bDrag = true;
            iStartX = ev.clientX;
            iStartW = oSelf.getBoundingClientRect().width;
            document.body.style.cursor = "col-resize";
            window.addEventListener("mousemove", lf_move);
            window.addEventListener("mouseup", lf_up);
            ev.preventDefault();
        });
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
            const oLRect = oLeftPane.getBoundingClientRect();
            const iMinL = _minPaneW(oLeftPane);
            const oRight = _rightPaneOf(oBar);

            if (oRight && !_isLastPane(oRight)) {
                // 인접 재분배 — 왼쪽/오른쪽 패널 폭 합은 보존(그 뒤 패널은 불변)
                const iTotal = oLeftPane.offsetWidth + oRight.offsetWidth;
                const iMinR = _minPaneW(oRight);
                let newL = ev.clientX - oLRect.left;
                newL = Math.max(iMinL, Math.min(iTotal - iMinR, newL));
                oLeftPane.style.flex = `0 0 ${newL}px`;
                oRight.style.flex = `0 0 ${iTotal - newL}px`;
            } else {
                // 오른쪽이 마지막(유연) 패널 → 왼쪽만 px, 오른쪽은 flex 로 잔여폭 채움
                const oSplitRect = oBar.parentElement.getBoundingClientRect();
                const iReserve = oRight ? (oBar.offsetWidth + _minPaneW(oRight)) : 0;
                let newL = ev.clientX - oLRect.left;
                newL = Math.max(iMinL, Math.min(oSplitRect.right - oLRect.left - iReserve, newL));
                oLeftPane.style.flex = `0 0 ${newL}px`;
            }

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

    /**
     * 창 리사이즈 시: 드래그로 고정된 px 폭의 스플리터 패널이 줄어든 창을 넘쳐
     * 다른 패널/스플릿 바가 overflow:hidden 에 잘려 숨는 문제 방지.
     *  → 현재 화면의 모든 .u4a-splitter 패널(px 고정분)을 컨테이너에 맞게 재클램프.
     *  (한 번만 바인딩 — 뷰 전환으로 스플리터가 새로 그려져도 querySelector 로 현재 것 처리)
     */
    let _splitterResizeBound = false;
    function _bindSplitterResizeClamp() {
        if (_splitterResizeBound) { return; }
        _splitterResizeBound = true;
        window.addEventListener("resize", () => {
            document.querySelectorAll(".u4a-splitter").forEach((oSplitter) => {
                const iAvail = oSplitter.getBoundingClientRect().width;
                if (!iAvail) { return; }
                const aKids = Array.prototype.slice.call(oSplitter.children);
                const aPanes = aKids.filter((el) => el.classList && el.classList.contains("u4a-splitter__pane"));
                if (!aPanes.length) { return; }
                const iBars = aKids.filter((el) => el.classList && el.classList.contains("u4a-splitter__bar"))
                    .reduce((s, b) => s + b.offsetWidth, 0);
                const _minOf = (p) => { const m = parseFloat(getComputedStyle(p).minWidth); return (m && m > 0) ? m : 120; };
                const _pxOf = (p) => { const m = (p.style.flex || "").match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : null; };
                // px 고정 패널 vs 유연 패널 분리
                const aFixed = [], aFlex = [];
                aPanes.forEach((p) => { (_pxOf(p) != null ? aFixed : aFlex).push(p); });
                const iFixedW = aFixed.reduce((s, p) => s + _pxOf(p), 0);
                const iFlexMin = aFlex.reduce((s, p) => s + _minOf(p), 0);
                // 고정폭 합 + 바 + 유연패널 최소 가 창을 넘으면, 큰 고정 패널부터 min 까지 줄여 확보
                //  → 마지막(유연) 패널(상세 등)이 화면 밖으로 밀려 잘리는 것 방지
                let iNeed = (iFixedW + iBars + iFlexMin) - iAvail;
                if (iNeed <= 0) { return; }
                aFixed.slice().sort((a, b) => _pxOf(b) - _pxOf(a)).forEach((p) => {
                    if (iNeed <= 0) { return; }
                    const iCur = _pxOf(p), iMin = _minOf(p);
                    const iCut = Math.min(Math.max(0, iCur - iMin), iNeed);
                    if (iCut > 0) { p.style.flex = `0 0 ${iCur - iCut}px`; iNeed -= iCut; }
                });
            });
            if (oAPP.fn.fnUpdateTableWidthClass) { oAPP.fn.fnUpdateTableWidthClass(); }
        });
    }

    /**
     * 창 리사이즈(특히 최대화→restore) 시, 드래그로 고정 px 가 된 트리 패널이
     * 창보다 넓어 바·테이블이 화면 밖으로 밀리는 것을 방지한다.
     * 현재 폭이 (전체 - 우측최소확보) 보다 넓을 때만 줄여 클램프한다.
     */
    function _clampSplitterPane() {
        const oPane = document.getElementById("u4aWsTreePane");
        if (!oPane || !oPane.parentElement) {
            return;
        }
        const iTotal = oPane.parentElement.getBoundingClientRect().width;
        if (!iTotal) {
            return;
        }
        const iReserve = 248; // 스플리터 바 + 우측 테이블 최소폭(14rem) + 스크롤바 확보
        const iMaxLeft = iTotal - iReserve;
        const iCur = oPane.getBoundingClientRect().width;
        if (iCur > iMaxLeft) {
            oPane.style.flex = "0 0 " + Math.max(120, iMaxLeft) + "px";
        }
    }

    function _positionMenu(oMenu, oAnchor, sAlign) {
        const oRect = oAnchor.getBoundingClientRect();
        const iMenuW = oMenu.offsetWidth;
        // 기본은 우측 정렬(앵커 우변에 메뉴 우변을 맞춤). sAlign==="left" 면 앵커 좌변 기준.
        let iLeft = (sAlign === "left") ? oRect.left : (oRect.right - iMenuW);
        // 화면 오른쪽 밖으로 나가면 당겨 넣고, 왼쪽 최소 여백 보장
        const iMaxLeft = window.innerWidth - iMenuW - 4;
        if (iLeft > iMaxLeft) { iLeft = iMaxLeft; }
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
        // 창 리사이즈/스크롤 시 닫기 — 앵커(헤더/버튼) 이동으로 메뉴 위치 어긋남 방지.
        window.addEventListener("resize", _closeAllMenus);
        window.addEventListener("scroll", _closeAllMenus, true);
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
        window.removeEventListener("resize", _closeAllMenus);
        window.removeEventListener("scroll", _closeAllMenus, true);
    }

    /********************************************************************
     * 네트워크 online/offline (doc 02 §2.5) — 상태 플래그 유지
     ********************************************************************/
    window.addEventListener("online", () => { oAPP.attr.bIsNwActive = true; });
    window.addEventListener("offline", () => { oAPP.attr.bIsNwActive = false; });

})(window);
