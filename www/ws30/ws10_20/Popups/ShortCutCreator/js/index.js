/************************************************************************
 * INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ShortCutCreator/js/index.js
 * - file Desc : U4A Shortcut Creator (HTML5 이식 버젼)
 ************************************************************************/

(function () {
    "use strict";

    // 1. Electron & Util 환경 설정
    const REMOTE = require('@electron/remote'),
          PATH = REMOTE.require('path'),
          APP = REMOTE.app,
          APPPATH = APP.getAppPath(),
          PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
          WSUTIL = require(PATHINFO.WSUTIL),
          CURRWIN = REMOTE.getCurrentWindow();

    // 브라우저의 쿼리 스트링 정보 파싱
    const oQueryParams = WSUTIL.QueryString.parse(location.href);
    const USERINFO = oQueryParams.USERINFO,
          LANGU = USERINFO.LANGU,
          SYSID = USERINFO.SYSID;

    // oAPP 컨텍스트 초기 구성
    const oAPP = {
        fn: {},
        attr: {
            isBusy: true,
            oMetadata: null,
            oUserInfo: USERINFO
        },
        common: {},
        remote: REMOTE,
        ipcMain: REMOTE.require('electron').ipcMain,
        ipcRenderer: require('electron').ipcRenderer,
        fs: REMOTE.require('fs'),
        path: REMOTE.require('path'),
        SHELL: REMOTE.require('electron').shell,
        browserInfo: [],
        config: {},
        IPCRENDERER: require('electron').ipcRenderer,
        CURRWIN: CURRWIN,
        BROWSKEY: oQueryParams.browserkey,
        IPCMAIN: REMOTE.require('electron').ipcMain,
        WSUTIL: WSUTIL,
        WSMSG: new WSUTIL.MessageClassText(SYSID, LANGU),
        REMOTE: REMOTE,
        PATH: REMOTE.require('path'),
        FS: REMOTE.require('fs'),
        APP: REMOTE,
        USERDATA: APP.getPath("userData"),
    };

    // 다국어 메시지 헬퍼 바인딩
    oAPP.common.fnGetMsgClsText = oAPP.WSMSG.fnGetMsgClsText.bind(oAPP.WSMSG);

    function getMsgText(sMsgCls, sMsgNo, sFallback) {
        let sTxt = oAPP.common.fnGetMsgClsText(sMsgCls, sMsgNo);
        return (sTxt && sTxt.trim()) ? sTxt : sFallback;
    }

    // window 전역 노출 / shim 추가 (fnAppF4PopupOpen.js 의존성 대비)
    window.oAPP = oAPP;
    window.$ = window.$ || {};              // $ 미사용이나 IIFE 인자 ReferenceError 방지
    window.WSUTIL = oAPP.WSUTIL;
    window.REMOTE = oAPP.REMOTE;
    window.CURRWIN = oAPP.CURRWIN;
    window.getUserInfo = function () { return oAPP.attr.oUserInfo; };
    window.getServerPath = function () { return (oAPP.config && oAPP.config.SHOST) || ''; };
    window.getIsTrial = function () { return false; };
    window.showMessage = function (oSap, iCode, sType, sText) { try { U4AUI.confirm({ type: sType, title: getMsgText('/U4A/CL_WS_COMMON','C00','fail'), message: sText }); } catch (e) { console.error('[숏컷] showMessage shim 오류:', e); } };
    // fnAppF4PopupOpen 의 전역 sendAjax(ws_common.js) 경량 shim — 자식창엔 원본이 없어 fetch 로 대체(FormData+WSVER 계약 유지).
    window.sendAjax = function (sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error) {
        try {
            var oUser = oAPP.attr.oUserInfo || {};
            if (oFormData && oFormData instanceof FormData) {
                oFormData.append("WSVER", oUser.WSVER);
                oFormData.append("WSPATCH_LEVEL", oUser.WSPATCH_LEVEL);
            }
            fetch(sPath, { method: (meth || "POST"), body: (oFormData || undefined) })
                .then(function (r) { if (!r.ok) { throw new Error("HTTP " + r.status); } return r.json(); })
                .then(function (oRes) { if (typeof fn_success === "function") { fn_success(oRes); } })
                .catch(function (err) {
                    console.error('[숏컷] sendAjax shim 오류:', err);
                    if (typeof fn_error === "function") { try { fn_error(err); } catch (e) { console.error('[숏컷] sendAjax fn_error 오류:', e); } }
                });
        } catch (e) {
            console.error('[숏컷] sendAjax shim 예외:', e);
            if (typeof fn_error === "function") { try { fn_error(e); } catch (e2) { console.error('[숏컷] sendAjax fn_error 예외:', e2); } }
        }
    };

    // 내부 화면 바인딩용 oData 정의
    const oData = {
        sHOST: "",
        SURL: "",
        APPTY: "",
        oMetadata: null
    };

    // 추가 파라미터 테이블용 데이터
    let aParams = [];

    // UI Field 인스턴스 저장용 객체
    let oAppIdField, oAppNmField, oFileNameField, oSavePathField, oIconPathField, oHostInputField;

    // =====================================================================================
    // 2. 비즈니스 펑션 정의
    // =====================================================================================

    // 테마 정보 구하기
    oAPP.fn.getThemeInfo = function () {
        let sSysID = oAPP.attr.oUserInfo.SYSID;
        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
        if (oAPP.FS.existsSync(sThemeJsonPath) === false) {
            return;
        }
        let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");
        try {
            return JSON.parse(sThemeJson);
        } catch (error) {
            return;
        }
    };

    // Busy 상태 구하기
    oAPP.fn.getBusy = function () {
        return oAPP.attr.isBusy;
    };

    // Busy 설정 함수 (top-layer <dialog> 제어 표준 준수)
    function fn_setBusy(bIsBusy, sOption) {
        oAPP.attr.isBusy = bIsBusy;
        const _ISBROAD = sOption?.ISBROAD || undefined;
        const busyOverlay = document.getElementById("u4aShortcutBusy");

        if (bIsBusy === true) {
            if (busyOverlay && !busyOverlay.open) {
                busyOverlay.showModal();
            }
            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_ON" });
            }
            return;
        }

        if (busyOverlay && busyOverlay.open) {
            busyOverlay.close();
        }
        if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
            oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
        }
    }

    // 브라우저 리스트에 따른 UI 활성/선택 처리
    function fn_setBrowserHandle() {
        let isFnd = "";

        for (let index = 0; index < oAPP.browserInfo.length; index++) {
            let sLine = oAPP.browserInfo[index];
            switch (sLine.TYPE) {
                case "CR":
                    document.getElementById("lblBrowserChrome").style.display = "";
                    if (isFnd === "") { isFnd = "chrome"; }
                    break;
                case "MS_EDGE":
                    document.getElementById("lblBrowserEdge").style.display = "";
                    if (isFnd === "") { isFnd = "edge"; }
                    break;
            }
        }

        if (isFnd !== "") {
            const radio = document.querySelector(`input[name="browserType"][value="${isFnd}"]`);
            if (radio) {
                radio.checked = true;
                fn_select_BROWSER();
            }
        }
    }

    // Host 타입 라디오 선택에 따른 입력창 활성/비활성 토글
    function fn_select_Host() {
        const hostType = document.querySelector('input[name="hostType"]:checked').value;
        if (hostType === "internal") {
            oHostInputField.setReadOnly(true);
            oHostInputField.setValue(oData.sHOST);
            oHostInputField.input.disabled = true; // 비활성화
        } else {
            oHostInputField.setReadOnly(false);
            oHostInputField.setValue("");
            oHostInputField.input.disabled = false; // 활성화
        }
    }

    // 브라우저 타입 선택에 따른 브라우저 옵션 영역 전환
    function fn_select_BROWSER() {
        const browserType = document.querySelector('input[name="browserType"]:checked').value;
        if (browserType === "chrome") {
            document.getElementById("chromeOptions").style.display = "";
            document.getElementById("edgeOptions").style.display = "none";
        } else {
            document.getElementById("chromeOptions").style.display = "none";
            document.getElementById("edgeOptions").style.display = "";
        }
    }

    // 저장 폴더 및 아이콘 파일 선택 다이얼로그 호출
    function fn_select_Path(mtype) {
        let options = {};
        let targetField = null;

        if (mtype === "01") {
            options = {
                title: getMsgText("/U4A/MSG_WS", "317", "Save Shortcut Download Directory"),
                filters: [],
                properties: ['openDirectory']
            };
            targetField = oSavePathField;
        } else {
            options = {
                title: getMsgText("/U4A/MSG_WS", "318", "Select Shortcut Icon"),
                filters: [{
                    name: 'Images',
                    extensions: ['ICO', 'ico']
                }],
                properties: ['openFile']
            };
            targetField = oIconPathField;
        }

        oAPP.remote.dialog.showOpenDialog(oAPP.CURRWIN, options).then(function (e) {
            if (!e.canceled && e.filePaths && e.filePaths.length > 0) {
                targetField.setValue(e.filePaths[0]);
                targetField.setValueState("none");
            }
        }).catch(err => {
            console.error("showOpenDialog error:", err);
        });
    }

    // APP ID F4 도움말 호출 (F4 로컬 호출 배선)
    function fn_AppId_F4Help() {
        var oUserInfo = oAPP.attr.oUserInfo;
        var oOptions = { autoSearch: true, pickOnly: true, initCond: { PACKG:'', APPNM:'', APPTY:'M', ERUSR: oUserInfo.ID, HITS: 500 } };
        if (oAPP.fn && typeof oAPP.fn.fnAppF4PopupOpen === 'function') {
            oAPP.fn.fnAppF4PopupOpen(oOptions, function (oRow) {
                if (oRow && oRow.APPID) { oAppIdField.setValue(oRow.APPID); oAppIdField.setValueState('none'); fn_Check_value(); }
            });
        } else { console.error('[숏컷] fnAppF4PopupOpen 미로드'); }
    }

    // 검증 실패 필드 자동 포커스(공통 §3.5.4) — Chromium93 함정 A(진행중 포커스에 밀림) 회피 위해 다음 틱으로 미룸.
    //   호출측이 busy/모달을 먼저 닫은 뒤(동기) 실행되도록 setTimeout(0) 사용(함정 B).
    function _refocus(oField) {
        if (oField && typeof oField.focus === "function") {
            setTimeout(function () { try { oField.focus(); } catch (e) { console.error("[숏컷] 재포커스 오류:", e); } }, 0);
        }
    }

    // 서버가 백엔드 로그온 언어로 구운 오류 텍스트(RTMSG)를 워크스페이스 언어로 역현지화(공통 WsMsgCls.relocalize SSOT 위임).
    //   자식창은 백엔드 언어를 몰라 beLangu=null(공통이 EN/KO 후보로 시도). 못 찾으면 원문 폴백. (mimeRepository 동일 패턴, .analy/17)
    function _relocalizeServer(sText) {
        try {
            var WC = oAPP.REMOTE.getGlobal("WsMsgCls");
            if (!WC || !WC.relocalize) { return sText; }
            var sRaw = String(sText || "");
            var sLoc = WC.relocalize(sRaw, null, (oAPP.attr.oUserInfo && oAPP.attr.oUserInfo.LANGU) || "");
            return (sLoc && sLoc !== sRaw) ? sLoc : sText;
        } catch (e) { console.error("[숏컷] 서버오류 역현지화 실패:", e); return sText; }
    }

    // 필수 입력 필드 유효성 점검 — 오류 시 첫 오류 필드 자동 포커스(공통 §3.5.4)
    function fn_Check_required() {
        let Lret = "";
        let oFirstBad = null;

        if (oAppIdField.getValue() === "") {
            Lret = "E";
            oAppIdField.setValueState("error", getMsgText("/U4A/MSG_WS", "014", "Input value is required."));
            if (!oFirstBad) { oFirstBad = oAppIdField; }
        } else {
            oAppIdField.setValueState("none");
        }

        if (oSavePathField.getValue() === "") {
            Lret = "E";
            oSavePathField.setValueState("error", getMsgText("/U4A/MSG_WS", "014", "Input value is required."));
            if (!oFirstBad) { oFirstBad = oSavePathField; }
        } else {
            oSavePathField.setValueState("none");
        }

        if (oHostInputField.getValue() === "") {
            Lret = "E";
            oHostInputField.setValueState("error", getMsgText("/U4A/MSG_WS", "014", "Input value is required."));
            if (!oFirstBad) { oFirstBad = oHostInputField; }
        } else {
            oHostInputField.setValueState("none");
        }

        if (Lret === "E") {
            const mainArea = document.querySelector(".u4aShortcutMain");
            if (mainArea) { mainArea.scrollTo({ top: 0, behavior: 'smooth' }); }
            _refocus(oFirstBad);   // 첫 오류 필드로 포커스 → 빨간 테두리 + 메시지 함께 표시
        }

        return Lret;
    }

    // APP ID 서버 검증 및 파라미터 유효성 검사
    async function fn_Check_value() {
        fn_setBusy(true);

        // App Name 라벨 초기화
        oAppNmField.setValue("");

        const Lappid = oAppIdField.getValue();
        const vurl = oData.SURL;
        const Ldata = { APPID: Lappid };

        try {
            const response = await fetch(vurl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Ldata)
            });

            fn_setBusy(false);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const e = await response.json();

            if (typeof e.RETCD === "undefined") {
                return "E";
            }

            switch (e.RETCD) {
                case "Z":
                    U4AUI.confirm({
                        type: "E",
                        title: getMsgText("/U4A/CL_WS_COMMON", "C00", "fail"),
                        message: _relocalizeServer(e.RTMSG),
                        onClose: function () {
                            fn_close();
                        }
                    });
                    return "E";

                case "E":
                    oAppIdField.setValueState("error", _relocalizeServer(e.RTMSG));
                    const mainArea = document.querySelector(".u4aShortcutMain");
                    if (mainArea) { mainArea.scrollTo({ top: 0, behavior: 'smooth' }); }
                    _refocus(oAppIdField);   // 공통 §3.5.4: 서버검증 오류도 해당 필드 자동 포커스(비동기 콜백 — busy 는 이미 해제됨)
                    return "E";

                default:
                    oAppNmField.setValue(e.APPNM);
                    oData.APPTY = e.APPTY;
                    break;
            }

        } catch (err) {
            console.error("[숏컷] App ID 서버 검증 및 파라미터 유효성 검사 오류:", err);
            fn_setBusy(false);
            const Lmsg = err.message || err.responseText || "";
            U4AUI.confirm({
                type: "E",
                title: "Error",
                message: Lmsg
            });
            return "E";
        }

        // 파라미터 값 검증
        let Lreturn = "";
        const regType1 = /^[A-Za-z0-9]*$/;

        // 이전 오류 상태 초기화
        aParams.forEach(p => { p.state = "None"; });

        let errorIndex = -1;
        for (let index = 0; index < aParams.length; index++) {
            const sLine = aParams[index];

            // Value는 있으나 Name이 공백인 경우
            if (sLine.name === "" && sLine.value !== "") {
                sLine.state = "Error";
                Lreturn = "01";
                errorIndex = index;
                break;
            }

            // Name에 영문/숫자 이외의 문자가 있는 경우
            if (sLine.name !== "") {
                if (!regType1.test(sLine.name)) {
                    sLine.state = "Error";
                    Lreturn = "02";
                    errorIndex = index;
                    break;
                }
            }
        }

        renderParamsTable();

        if (Lreturn !== "") {
            const mainArea = document.querySelector(".u4aShortcutMain");
            mainArea.scrollTo({ top: mainArea.scrollHeight, behavior: 'smooth' });
            
            // 에러난 필드에 포커스 부여 (가이드 준수)
            setTimeout(() => {
                const inputs = document.querySelectorAll("#tblParamsBody tr input.u4a-input");
                if (inputs && inputs[errorIndex * 2]) {
                    inputs[errorIndex * 2].focus();
                }
            }, 100);
        }

        let sMsg = "";
        if (Lreturn === "01") {
            sMsg = getMsgText("/U4A/CL_WS_COMMON", "C11", "Name");
            sMsg = "'" + sMsg + "'";
            sMsg = getMsgText("/U4A/MSG_WS", "319", "value does not exist in the &1 Field").replace("&1", sMsg);
            U4AUI.footerShow("u4aFooterMessage", "E", sMsg, 5000);
            return "E";
        }

        if (Lreturn === "02") {
            sMsg = getMsgText("/U4A/MSG_WS", "320", "Only English and numbers are accepted");
            U4AUI.footerShow("u4aFooterMessage", "E", sMsg, 5000);
            return "E";
        }

        return "S";
    }

    // 숏컷 생성 프로세스 진행전 확인 및 검증
    async function fn_CreateShortcut() {
        try {
            fn_setBusy(true);

        oAppIdField.setValueState("none");
        oSavePathField.setValueState("none");
        oHostInputField.setValueState("none");

        if (fn_Check_required() === "E") {
            fn_setBusy(false);
            return;
        }

        if (await fn_Check_value() === "E") {
            fn_setBusy(false);
            return;
        }

        const sMsg = getMsgText("/U4A/MSG_WS", "321", "Are you sure you want to proceed with creating a shortcut?");

        U4AUI.confirm({
            type: "C",
            title: "Confirm",
            message: sMsg,
            onClose: function (sAct) {
                if (sAct === "YES") {
                    fn_CreateShortcutRUN();
                } else {
                    const sCancelMsg = getMsgText("/U4A/MSG_WS", "161", "Job canceled.");
                    U4AUI.footerShow("u4aFooterMessage", "I", sCancelMsg, 3000);
                    fn_setBusy(false);
                }
            }
        });
        } catch (e) {
            console.error("[숏컷] 숏컷 생성 전 유효성 검사 예외 발생:", e);
            fn_setBusy(false);
            U4AUI.confirm({
                type: "E",
                title: "Error",
                message: e.message || e.toString()
            });
        }
    }

    // 숏컷 링크 파일 실제 생성 및 완료 후 로직
    function fn_CreateShortcutRUN() {
        try {
            const Lappid = oAppIdField.getValue();
        const Lappnm = oAppNmField.getValue();
        let LsPath = oSavePathField.getValue();
        let LFname = oFileNameField.getValue();
        let Loption = "";
        let U4Apath = "";

        const reg = /\s/g;
        let LFname_X = LFname.replace(reg, "");
        if (LFname_X.length === 0) {
            LFname = Lappid;
        }

        LFname = LFname.replace(".lnk", "");
        LFname = LFname + ".lnk";
        LsPath = oAPP.path.join(LsPath, LFname);

        const LicoPath = oIconPathField.getValue();
        const Lhost = oHostInputField.getValue();

        let U4AbasePath = "";
        switch (oData.APPTY) {
            case "M": // U4A
                U4AbasePath = "/zu4a/";
                break;
            case "U": // USP
                U4AbasePath = "/zu4a/usp/";
                break;
            default:
                U4AbasePath = "/zu4a/";
                break;
        }

        U4Apath = Lhost + U4AbasePath + Lappid.toLowerCase();

        let Lparam = "";
        aParams.forEach(p => {
            if (p.name === "" && p.value === "") { return; }
            if (Lparam !== "") {
                Lparam = Lparam + "&" + p.name + "=" + p.value;
            } else {
                Lparam = p.name + "=" + p.value;
            }
        });

        if (Lparam !== "") {
            U4Apath = U4Apath + "?" + Lparam;
        }

        const browserType = document.querySelector('input[name="browserType"]:checked').value;
        let Ltarget = "";

        if (browserType === "chrome") {
            let oFound = oAPP.browserInfo.find(b => b.TYPE === "CR");
            if (!oFound) {
                console.error("[숏컷] Chrome 브라우저 정보가 존재하지 않습니다.");
                let sMsg = getMsgText("/U4A/MSG_WS", "333", "Installed browser information not found.");
                U4AUI.confirm({
                    type: "E",
                    title: getMsgText("/U4A/CL_WS_COMMON", "C00", "fail"),
                    message: sMsg
                });
                fn_setBusy(false);
                return;
            }
            Ltarget = oFound.PATH;
            Loption = fn_setShorCutOptionCR(U4Apath);
        } else {
            let oFound = oAPP.browserInfo.find(b => b.TYPE === "MS_EDGE");
            if (!oFound) {
                console.error("[숏컷] Edge 브라우저 정보가 존재하지 않습니다.");
                let sMsg = getMsgText("/U4A/MSG_WS", "333", "Installed browser information not found.");
                U4AUI.confirm({
                    type: "E",
                    title: getMsgText("/U4A/CL_WS_COMMON", "C00", "fail"),
                    message: sMsg
                });
                fn_setBusy(false);
                return;
            }
            Ltarget = oFound.PATH;
            Loption = fn_setShorCutOptionIE(U4Apath);
        }

        // 바로가기 생성 API 호출
        const res = oAPP.SHELL.writeShortcutLink(LsPath, "create", {
            target: Ltarget,
            args: Loption,
            description: Lappnm,
            appUserModelId: Ltarget,
            icon: LicoPath,
            iconIndex: 0
        });

        if (res) {
            const sSuccessMsg = getMsgText("/U4A/MSG_WS", "322", "processing is complete");
            U4AUI.confirm({
                type: "S",
                title: "Success",
                message: sSuccessMsg,
                onClose: function () {
                    // 다운 폴더 탐색기 실행
                    oAPP.SHELL.showItemInFolder(LsPath);
                    fn_close();
                }
            });
            fn_setBusy(false);
        } else {
            const sFailMsg = getMsgText("/U4A/MSG_WS", "323", "processing failed");
            const sTitle = getMsgText("/U4A/CL_WS_COMMON", "C00", "fail");
            U4AUI.confirm({
                type: "E",
                title: sTitle,
                message: sFailMsg
            });
            fn_setBusy(false);
        }
        } catch (e) {
            console.error("[숏컷] 바로가기 파일 생성 실행 중 예외 발생:", e);
            fn_setBusy(false);
            U4AUI.confirm({
                type: "E",
                title: "Error",
                message: e.message || e.toString()
            });
        }
    }

    // Chrome 숏컷 명령 옵션 텍스트 생성
    function fn_setShorCutOptionCR(U4Apath) {
        let Loption = "";
        const Lchk1 = document.getElementById("chkChromeDisableTranslate").checked;
        const Lchk2 = document.getElementById("chkChromeSecret").checked;

        if (Lchk2) {
            Loption = "--incognito";
        }

        if (Lchk1) {
            if (Loption !== "") {
                Loption = Loption + " --disable-translate";
            } else {
                Loption = "--disable-translate";
            }
        }

        const chromeMode = document.querySelector('input[name="chromeMode"]:checked').value;
        switch (chromeMode) {
            case "app":
                Loption = (Loption !== "" ? Loption + " " : "") + "--app=" + U4Apath;
                break;
            case "fullscreen":
                Loption = (Loption !== "" ? Loption + " " : "") + "--start-maximized " + U4Apath;
                break;
            case "kiosk":
                Loption = (Loption !== "" ? Loption + " " : "") + "--kiosk " + U4Apath;
                break;
        }

        return Loption;
    }

    // IE Edge 숏컷 명령 옵션 텍스트 생성
    function fn_setShorCutOptionIE(U4Apath) {
        let Loption = "";
        const edgeMode = document.querySelector('input[name="edgeMode"]:checked').value;

        switch (edgeMode) {
            case "app":
                Loption = "--app=" + U4Apath;
                break;
            case "normal":
                Loption = "--start-maximized " + U4Apath;
                break;
        }

        return Loption;
    }

    // 창 닫기
    function fn_close() {
        U4AUI.closeWindow(oAPP.CURRWIN);
    }

    // =====================================================================================
    // 3. UI 및 테이블 드로잉
    // =====================================================================================

    // 파라미터 테이블 바인딩 렌더링
    function renderParamsTable() {
        const tbody = document.getElementById("tblParamsBody");
        tbody.innerHTML = "";

        if (aParams.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted" style="padding: 1.5rem;">
                        No optional parameters.
                    </td>
                </tr>
            `;
            return;
        }

        aParams.forEach((param, index) => {
            const tr = document.createElement("tr");

            // Checkbox
            const tdCheck = document.createElement("td");
            tdCheck.style.textAlign = "center";
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "chk-param-row";
            chk.dataset.index = index;
            tdCheck.appendChild(chk);

            // Name
            const tdName = document.createElement("td");
            const oNameField = U4AUI.createField({
                value: param.name,
                className: "w-100",
                upper: true,
                onChange: function (val) {
                    aParams[index].name = val;
                }
            });
            // 진짜 데이터그리드에서는 밸류스테이트 메시지 대신 빨간 테두리(None state + data-vs="error")를 사용
            if (param.state === "Error") {
                oNameField.setValueState("error", "");
            }
            tdName.appendChild(oNameField.el);

            // Value
            const tdValue = document.createElement("td");
            const oValueField = U4AUI.createField({
                value: param.value,
                className: "w-100",
                onChange: function (val) {
                    aParams[index].value = val;
                }
            });
            tdValue.appendChild(oValueField.el);

            tr.appendChild(tdCheck);
            tr.appendChild(tdName);
            tr.appendChild(tdValue);
            tbody.appendChild(tr);
        });
    }

    // 1단 폼 UI 빌드 셋업
    function initUIBuild() {
        // 1. General Information Panel
        const generalInfoPanel = document.getElementById("generalInfoPanel");
        const oGenPanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C66", "General Information"),
        });
        generalInfoPanel.appendChild(oGenPanel.el);

        const oFormGrid1 = document.createElement("div");
        oFormGrid1.className = "u4aFormGrid";
        oGenPanel.body.appendChild(oFormGrid1);

        // Fields 생성
        oAppIdField = U4AUI.createField({
            id: "FORM1_INPUT1",
            maxLength: 20,
            clear: true,
            upper: true,
            placeholder: getMsgText("/U4A/CL_WS_COMMON", "D09", "U4A Application ID"),
            f4: fn_AppId_F4Help
        });

        let sFileNamePlaceholder = getMsgText("/U4A/CL_WS_COMMON", "D10", "Shortcut") + " " + getMsgText("/U4A/CL_WS_COMMON", "C35", "File Name");
        oFileNameField = U4AUI.createField({
            id: "FORM1_INPUT3",
            placeholder: sFileNamePlaceholder
        });

        let sSavePathPlaceholder = sFileNamePlaceholder + " " + getMsgText("/U4A/CL_WS_COMMON", "D11", "Shortcut Download Path");
        oSavePathField = U4AUI.createField({
            id: "FORM1_INPUT4",
            readOnly: true,
            placeholder: sSavePathPlaceholder,
            f4: function () { fn_select_Path("01"); },
            f4Icon: "folder-open"
        });

        let sIconPathPlaceholder = sFileNamePlaceholder + " " + getMsgText("/U4A/CL_WS_COMMON", "C70", "Shortcut Icon Path");
        oIconPathField = U4AUI.createField({
            id: "FORM1_INPUT5",
            readOnly: true,
            placeholder: sIconPathPlaceholder,
            f4: function () { fn_select_Path("02"); },
            f4Icon: "image"
        });

        // Form Items append
        function createFormItem(sLabel, oFieldInstance, bRequired) {
            const oItem = document.createElement("div");
            // 공통 .u4a-form__row 병기 — value-state 메시지(.u4a-field__msg)는 shell.css 상 .u4a-form__row:focus-within 일 때만 노출되므로 필수.
            oItem.className = "u4a-form__row u4aFormItem";
            const oLabel = document.createElement("label");
            oLabel.className = "u4aFormLabel";
            oLabel.textContent = sLabel;
            if (bRequired) { oLabel.setAttribute("data-required", "true"); }
            oItem.appendChild(oLabel);
            oItem.appendChild(oFieldInstance.el);
            return oItem;
        }

        oFormGrid1.appendChild(createFormItem(getMsgText("/U4A/CL_WS_COMMON", "C67", "APP ID"), oAppIdField, true)); // APP ID

        oAppNmField = U4AUI.createField({
            id: "FORM1_TEXT1",
            readOnly: true
        });
        oFormGrid1.appendChild(createFormItem(getMsgText("/U4A/CL_WS_COMMON", "C68", "APP Name"), oAppNmField, false));

        oFormGrid1.appendChild(createFormItem(getMsgText("/U4A/CL_WS_COMMON", "C35", "File Name"), oFileNameField, false)); // File Name
        oFormGrid1.appendChild(createFormItem(getMsgText("/U4A/CL_WS_COMMON", "C69", "Save As Path"), oSavePathField, true)); // Save As Path
        oFormGrid1.appendChild(createFormItem(getMsgText("/U4A/CL_WS_COMMON", "C70", "Icon Path"), oIconPathField, false)); // Icon Path


        // 2. Target Host URL Panel
        const targetHostPanel = document.getElementById("targetHostPanel");
        const oHostPanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C71", "Target Host URL"),
        });
        targetHostPanel.appendChild(oHostPanel.el);

        const oHostWrap = document.createElement("div");
        oHostWrap.className = "d-flex flex-column gap-2 w-100";
        oHostPanel.body.appendChild(oHostWrap);

        const oHostRadioGroup = document.createElement("div");
        oHostRadioGroup.className = "u4aShortcutOptionGroup";
        oHostWrap.appendChild(oHostRadioGroup);

        oHostRadioGroup.innerHTML = `
            <label class="u4aShortcutOptionItem">
                <input type="radio" name="hostType" value="internal" checked>
                <span>${getMsgText("/U4A/CL_WS_COMMON", "C72", "Internal Host URL")}</span>
            </label>
            <label class="u4aShortcutOptionItem">
                <input type="radio" name="hostType" value="external">
                <span>${getMsgText("/U4A/CL_WS_COMMON", "C73", "External Host URL")}</span>
            </label>
        `;

        oHostInputField = U4AUI.createField({
            id: "FORM2_INPUT1",
            disabled: true,
            placeholder: getMsgText("/U4A/CL_WS_COMMON", "D13", "Host or Domain")
        });
        // 호스트 입력만 공통 .u4a-form__row 로 감싼다(라디오와 분리) — value-state 메시지가 이 입력 아래에 focus 시 뜨도록.
        const oHostFieldRow = document.createElement("div");
        oHostFieldRow.className = "u4a-form__row w-100";
        oHostFieldRow.appendChild(oHostInputField.el);
        oHostWrap.appendChild(oHostFieldRow);

        oHostRadioGroup.querySelectorAll('input[name="hostType"]').forEach(radio => {
            radio.addEventListener("change", fn_select_Host);
        });


        // 3. Browser Type Panel
        const browserTypePanel = document.getElementById("browserTypePanel");
        const oBrowserTypePanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C74", "Browser Type")
        });
        browserTypePanel.appendChild(oBrowserTypePanel.el);

        const oBrowserTypeRadioGroup = document.createElement("div");
        oBrowserTypeRadioGroup.className = "u4aShortcutOptionGroup";
        oBrowserTypePanel.body.appendChild(oBrowserTypeRadioGroup);

        oBrowserTypeRadioGroup.innerHTML = `
            <label class="u4aShortcutOptionItem" id="lblBrowserChrome" style="display:none;">
                <input type="radio" name="browserType" value="chrome">
                <span>${getMsgText("/U4A/CL_WS_COMMON", "C75", "Google Chrome Browser")}</span>
            </label>
            <label class="u4aShortcutOptionItem" id="lblBrowserEdge" style="display:none;">
                <input type="radio" name="browserType" value="edge">
                <span>${getMsgText("/U4A/CL_WS_COMMON", "C76", "Microsoft Edge")}</span>
            </label>
        `;

        oBrowserTypeRadioGroup.querySelectorAll('input[name="browserType"]').forEach(radio => {
            radio.addEventListener("change", fn_select_BROWSER);
        });


        // 4. Browser Option Panel
        const browserOptionPanel = document.getElementById("browserOptionPanel");
        const oBrowserOptPanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C77", "Browser Option")
        });
        browserOptionPanel.appendChild(oBrowserOptPanel.el);

        // Chrome Options
        const oChromeOpts = document.createElement("div");
        oChromeOpts.id = "chromeOptions";
        oChromeOpts.className = "d-flex flex-column gap-3 w-100";
        oChromeOpts.style.display = "none";
        oBrowserOptPanel.body.appendChild(oChromeOpts);

        oChromeOpts.innerHTML = `
            <div class="u4aShortcutOptionGroup">
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="chromeMode" value="app" checked>
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C78", "App Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="chromeMode" value="fullscreen">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C79", "Full Screen Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="chromeMode" value="kiosk">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C80", "Kiosk Mode")}</span>
                </label>
            </div>
            <div class="u4aShortcutOptionGroup" style="border-top: 0.0625rem solid var(--line); padding-top: 0.5rem;">
                <label class="u4aShortcutOptionItem">
                    <input type="checkbox" id="chkChromeDisableTranslate">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C81", "Displble Translate Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="checkbox" id="chkChromeSecret">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C82", "Secret Mode")}</span>
                </label>
            </div>
        `;

        // Edge Options
        const oEdgeOpts = document.createElement("div");
        oEdgeOpts.id = "edgeOptions";
        oEdgeOpts.className = "d-flex flex-column gap-3 w-100";
        oEdgeOpts.style.display = "none";
        oBrowserOptPanel.body.appendChild(oEdgeOpts);

        oEdgeOpts.innerHTML = `
            <div class="u4aShortcutOptionGroup">
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="edgeMode" value="app" checked>
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C78", "App Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="edgeMode" value="normal">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "D38", "Normal Mode")}</span>
                </label>
            </div>
        `;


        // 5. Additional Parameter Panel
        const paramPanel = document.getElementById("paramPanel");
        const oParamPanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C83", "Additional Parameter(Optional)")
        });
        paramPanel.appendChild(oParamPanel.el);

        const oTableContainer = document.createElement("div");
        oTableContainer.className = "u4aShortcutTableContainer w-100";
        oParamPanel.body.appendChild(oTableContainer);

        oTableContainer.innerHTML = `
            <div class="u4aShortcutTableToolbar">
                <button type="button" class="u4a-btn u4a-btn--accent-outline" id="btnParamAdd">
                    <i class="fa-solid fa-plus"></i>
                </button>
                <button type="button" class="u4a-btn u4a-btn--negative" id="btnParamDelete">
                    <i class="fa-solid fa-minus"></i>
                </button>
            </div>
            <div class="table-responsive">
                <table class="u4a-table u4a-table--boxed table-striped table-hover" id="tblParams">
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">
                                <input type="checkbox" id="chkParamAll">
                            </th>
                            <th style="width: 200px;">${getMsgText("/U4A/CL_WS_COMMON", "C11", "Name")}</th>
                            <th>${getMsgText("/U4A/CL_WS_COMMON", "A53", "Value")}</th>
                        </tr>
                    </thead>
                    <tbody id="tblParamsBody"></tbody>
                </table>
            </div>
        `;

        // Footer Message Bar 구성
        const oFooterMsgBox = document.getElementById("u4aFooterMessage");
        oFooterMsgBox.outerHTML = U4AUI.footerMarkup("u4aFooterMessage");

        // Param Event 바인딩
        document.getElementById("btnParamAdd").addEventListener("click", function () {
            aParams.push({ name: "", value: "", state: "None" });
            renderParamsTable();
            const mainArea = document.querySelector(".u4aShortcutMain");
            mainArea.scrollTo({ top: mainArea.scrollHeight, behavior: 'smooth' });
        });

        document.getElementById("btnParamDelete").addEventListener("click", function () {
            const checkedRows = document.querySelectorAll(".chk-param-row:checked");
            if (checkedRows.length === 0) {
                const sMsg = getMsgText("/U4A/MSG_WS", "268", "Selected line does not exists.");
                U4AUI.footerShow("u4aFooterMessage", "W", sMsg, 5000);
                return;
            }

            const indicesToDelete = Array.from(checkedRows).map(chk => parseInt(chk.dataset.index)).sort((a, b) => b - a);
            indicesToDelete.forEach(idx => {
                aParams.splice(idx, 1);
            });

            document.getElementById("chkParamAll").checked = false;
            renderParamsTable();
        });

        document.getElementById("chkParamAll").addEventListener("change", function (e) {
            const checked = e.target.checked;
            document.querySelectorAll(".chk-param-row").forEach(chk => {
                chk.checked = checked;
            });
        });
    }

    // =====================================================================================
    // 4. 시스템 및 테마 연동 라이프사이클
    // =====================================================================================

    // 테마 동기화 처리
    function _onIpcMain_if_p13n_themeChange() {
        let oThemeInfo = oAPP.fn.getThemeInfo();
        if (!oThemeInfo) { return; }

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oAPP.CURRWIN.webContents.insertCSS(sWebConBodyCss);

        if (window.U4ATheme) {
            window.U4ATheme.apply(oThemeInfo.THEME);
        }
    }

    // IPC 리스너 등록
    function _attachIpcEvents() {
        let sSysID = oAPP.attr.oUserInfo.SYSID;
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);
    }

    // IPC 리스너 해제
    function _detachIpcEvents() {
        let sSysID = oAPP.attr.oUserInfo.SYSID;
        oAPP.IPCMAIN.removeListener(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange);
    }

    // 브로드캐스트 이벤트
    function _attachBroadCastEvent() {
        oAPP.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${oAPP.BROWSKEY}`);
        oAPP.broadToChild.onmessage = function (oEvent) {
            let _PRCCD = oEvent?.data?.PRCCD || undefined;
            if (typeof _PRCCD === "undefined") { return; }

            switch (_PRCCD) {
                case "BUSY_ON":
                    fn_setBusy(true, { ISBROAD: true });
                    break;
                case "BUSY_OFF":
                    fn_setBusy(false, { ISBROAD: true });
                    break;
            }
        };
    }

    // 창 닫힐 때 브로드캐스트 전송
    function _setBroadCastBusy() {
        if (oAPP.fn.getBusy() === true) {
            if (oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
            }
        }
    }

    // =====================================================================================
    // 5. 프로그램 구동 시점
    // =====================================================================================

    // Opener로부터 통신 데이터 수신 처리
    oAPP.ipcRenderer.on('if_APP_shortcutCreator', (event, data) => {
        oAPP.browserInfo = data.browserInfo;
        oAPP.config = data.config;
        oAPP.attr.oMetadata = data.oMetadata;

        // HOST 경로 파싱 세팅
        oData.sHOST = oAPP.config.BASE_SHOST;
        oData.SURL = oAPP.config.SHOST + "/GET_SHORTCUT_APPINFO";

        // UI 빌드 및 데이터 세팅
        initUIBuild();
        fn_select_Host();
        fn_setBrowserHandle();
        renderParamsTable();

        // 로고 로드 (메인 창과 동일 APPPATH/img/logo.png)
        var oLogo = document.getElementById("u4aShortcutLogo");
        if (oLogo) {
            try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
        }

        // 자연스러운 팝업 현출 (Fade-in 효과)
        requestAnimationFrame(() => {
            oAPP.CURRWIN.show();
            document.body.classList.add("u4a-visible");
            fn_setBusy(false);

            // Opener 메인 영역 busy 해제 
            oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });
            if (oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
            }
        });
    });



    // DOM 로드 완료 라이프사이클
    document.addEventListener("DOMContentLoaded", function () {
        // 타이틀바 & 취소/저장 액션 바인딩
        document.getElementById("u4aShortcutWinClose").addEventListener("click", fn_close);
        document.getElementById("btnCancel").addEventListener("click", fn_close);
        document.getElementById("btnSave").addEventListener("click", fn_CreateShortcut);

        // 최소화 버튼 — 공통 .u4a-winbtn(fontStyleWizard 동일 패턴)
        (function () {
            var oMin = document.getElementById("u4aShortcutWinMin");
            if (!oMin) { return; }
            oMin.addEventListener("click", function () {
                try { oAPP.CURRWIN.minimize(); } catch (e) { console.error("[숏컷] 최소화 오류:", e); }
            });
        })();

        // 최대화 버튼 — 토글 + 아이콘 동기(공통 .u4a-winbtn, fontStyleWizard 동일 패턴)
        (function () {
            var oMax = document.getElementById("u4aShortcutWinMax");
            if (!oMax) { return; }
            function _syncMaxIcon() {
                try {
                    var oI = oMax.querySelector("i");
                    if (oI) { oI.className = oAPP.CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
                } catch (e) { console.error("[숏컷] 최대화 아이콘 동기화 오류:", e); }
            }
            oMax.addEventListener("click", function () {
                try {
                    if (oAPP.CURRWIN.isMaximized()) { oAPP.CURRWIN.unmaximize(); } else { oAPP.CURRWIN.maximize(); }
                } catch (e) { console.error("[숏컷] 최대화 토글 오류:", e); }
            });
            try {
                oAPP.CURRWIN.on("maximize", _syncMaxIcon);
                oAPP.CURRWIN.on("unmaximize", _syncMaxIcon);
            } catch (e) { console.error("[숏컷] 최대화 리스너 등록 오류:", e); }
            _syncMaxIcon();
        })();

        // 텍스트 다국어 바인딩
        document.getElementById("u4aShortcutTitle").textContent = getMsgText("/U4A/CL_WS_COMMON", "D31", "ShortCut Creator");
        document.getElementById("btnSaveText").textContent = getMsgText("/U4A/CL_WS_COMMON", "C84", "Save ShortCut");
        document.getElementById("btnCancelText").textContent = getMsgText("/U4A/CL_WS_COMMON", "A41", "Cancel");

        // IPC 및 BroadCast 활성화
        _attachIpcEvents();
        _attachBroadCastEvent();
    });

    // 창 닫히기 전 unload 라이프사이클
    window.onbeforeunload = function () {
        if (oAPP.attr.isBusy) {
            return false; // 바쁠 때는 창닫기 차단
        }
        _setBroadCastBusy();
    };

    // 창 완전히 제거될 때 IPC 이벤트 구독 해제
    window.addEventListener('pagehide', function () {
        _detachIpcEvents();
    }, { once: true });

})();
