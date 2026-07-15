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

    // WLO(White List Object) — 공통 fnAppF4PopupOpen 의 _showAudit(=checkWLOList("C","UHAK901182"))가 참조.
    //   메인셸(ws_common/ws_html5_shell)은 모델 /METADATA/T_REG_WLO 를 보는데, 자식창엔 없다 → opener 가 넘긴
    //   oMetadata(=parent.getMetadata()) 안의 T_REG_WLO 로 동일 판정 재현(안하면 audit 컬럼[생성일/변경일 등] 미표시).
    oAPP.common.getWsWLOList = function () {
        var oMeta = oAPP.attr.oMetadata || {};
        var aWLO = oMeta.T_REG_WLO || (oMeta.METADATA && oMeta.METADATA.T_REG_WLO);
        return Array.isArray(aWLO) ? aWLO : [];
    };
    oAPP.common.checkWLOList = function (REGTYP, CHGOBJ) {
        REGTYP = REGTYP || ""; CHGOBJ = CHGOBJ || "";
        var aWLO = oAPP.common.getWsWLOList();
        return Array.isArray(aWLO) && !!aWLO.find(function (e) { return e.REGTYP == REGTYP && e.CHGOBJ == CHGOBJ; });
    };

    function getMsgText(sMsgCls, sMsgNo, sFallback) {
        let sTxt = oAPP.common.fnGetMsgClsText(sMsgCls, sMsgNo);
        return (sTxt && sTxt.trim()) ? sTxt : sFallback;
    }

    // 공통 메시지 토스트(.u4a-toast) — 화면 정중앙·싱글톤·3초 자동사라짐(원본 sap.m.MessageToast 대응, 하단 footer 아님).
    let _toastTimer = null;
    function _toast(sMsg) {
        if (!sMsg) { return; }
        let oT = document.getElementById("u4aShortcutToast");
        if (!oT) {
            oT = document.createElement("div");
            oT.id = "u4aShortcutToast";
            oT.className = "u4a-toast";
            oT.setAttribute("role", "alert");
            document.body.appendChild(oT);
        }
        oT.textContent = sMsg;
        oT.setAttribute("data-show", "true");
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { try { oT.setAttribute("data-show", "false"); } catch (e) { console.error("[숏컷] 토스트 숨김 오류:", e); } }, 3000);
    }

    // 워크스페이스 메시지(ZMSG_WS_COMMON_001) — 번호 기준. 공통 빈상태("데이터 없음"=946) 등. getMsgText(SAP 메시지클래스)와 별개 채널.
    //   p1 = &1 치환값. ★넘기지 않으면 유틸이 &1 을 '빈 문자열'로 치환해 주어가 사라진다(주의).
    function getWsText(sNo, sFallback, p1) {
        var sP1 = (p1 == null) ? "" : String(p1);
        try {
            let sTxt = oAPP.WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo, sP1);
            if (sTxt && sTxt.trim()) { return sTxt; }
        } catch (e) { console.error("[숏컷] 워크스페이스 메시지 조회 실패:", e); }
        // 폴백 문구에도 동일하게 &1 치환.
        return (sFallback || sNo).replace(/&1/g, sP1);
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
                radio.checked = true;   // 옵션 블록은 통합돼 브라우저 무관 — 별도 토글 불필요.
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

    // (구) fn_select_BROWSER(브라우저별 옵션 영역 토글) 제거 — 옵션이 하나로 통합돼 브라우저와 무관하게 항상 동일.

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
                if (oRow && oRow.APPID) { oAppIdField.setValue(oRow.APPID); oAppIdField.setValueState('none'); fn_CheckAppId(); }
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

    // MSG_WS 014 = "&1 은(는) 필수 입력값입니다" — 필드명(&1)을 반드시 넘긴다(안 넘기면 주어 없이 "은 필수 입력값입니다"로 뜸).
    //   fnGetMsgClsText(cls,no,p1) 의 p1=&1 치환(레퍼런스 createApplicationPopup 동일). 못 찾으면 영문 폴백.
    function _msgRequired(sFieldLabel) {
        var sTxt = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "014", sFieldLabel);
        return (sTxt && sTxt.trim()) ? sTxt : (sFieldLabel + " is required.");
    }

    // 파일 이름 형식 검사 — Windows 금지문자(\ / : * ? " < > |)·제어문자 또는 예약 파일명(CON/PRN/AUX/NUL/COM1-9/LPT1-9).
    //   (안 막으면 writeShortcutLink 가 원인 불명으로 실패한다.) 값이 없으면 앱ID 로 대체되므로 통과.
    //   ★.lnk 확장자는 대소문자 무관하게 떼고 본체만 검사한다(원본은 case-sensitive 라 .LNK 가 중복으로 붙던 버그).
    function fn_Check_fileName() {
        const sRaw = (oFileNameField.getValue() || "");
        const sName = sRaw.replace(/\.lnk$/i, "");

        if (sName.replace(/\s/g, "") === "") {   // 미입력/공백만 → 앱ID 로 대체되므로 검사 대상 아님
            oFileNameField.setValueState("none");
            return "";
        }

        if (/[\\\/:*?"<>|\x00-\x1f]/.test(sName) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(sName)) {
            oFileNameField.setValueState("error", getMsgText("/U4A/MSG_WS", "278", "Special characters are not allowed."));
            return "E";
        }

        oFileNameField.setValueState("none");
        return "";
    }

    // 필수 입력 필드 유효성 점검 — 오류 시 첫 오류 필드 자동 포커스(공통 §3.5.4)
    function fn_Check_required() {
        let Lret = "";
        let oFirstBad = null;

        if (oAppIdField.getValue() === "") {
            Lret = "E";
            oAppIdField.setValueState("error", _msgRequired(getMsgText("/U4A/CL_WS_COMMON", "C67", "APP ID")));
            if (!oFirstBad) { oFirstBad = oAppIdField; }
        } else {
            oAppIdField.setValueState("none");
        }

        if (oSavePathField.getValue() === "") {
            Lret = "E";
            oSavePathField.setValueState("error", _msgRequired(getMsgText("/U4A/CL_WS_COMMON", "C69", "Save As Path")));
            if (!oFirstBad) { oFirstBad = oSavePathField; }
        } else {
            oSavePathField.setValueState("none");
        }

        if (oHostInputField.getValue() === "") {
            Lret = "E";
            oHostInputField.setValueState("error", _msgRequired(getMsgText("/U4A/CL_WS_COMMON", "C71", "Target Host URL")));
            if (!oFirstBad) { oFirstBad = oHostInputField; }
        } else if (!/^https?:\/\/[^\s/?#]+/i.test(oHostInputField.getValue().trim())) {
            // ★외부 호스트 URL 은 사용자가 직접 타이핑한다(내부는 읽기전용). 형식 검사가 없으면 "uha.u4aide.com" 처럼
            //   스킴 없는 값이 그대로 URL 로 붙어, 브라우저가 이를 '주소'가 아니라 '검색어'로 처리해 엉뚱한 페이지가 뜬다.
            //   MSG_WS 109 = "유효성 문제. ( &1 )"
            Lret = "E";
            oHostInputField.setValueState("error",
                oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "109", getMsgText("/U4A/CL_WS_COMMON", "C71", "Target Host URL")));
            if (!oFirstBad) { oFirstBad = oHostInputField; }
        } else {
            oHostInputField.setValueState("none");
        }

        // 파일 이름 — 필수는 아니지만(비면 앱ID로 대체) 값이 있으면 여기서 형식까지 검사한다.
        //   ★확인 팝업 '이후'가 아니라 '이전'에 걸러야 한다(§ 핸들러 = 검증 먼저).
        if (fn_Check_fileName() === "E") {
            Lret = "E";
            if (!oFirstBad) { oFirstBad = oFileNameField; }
        }

        if (Lret === "E") {
            const mainArea = document.querySelector(".u4aShortcutMain");
            if (mainArea) { mainArea.scrollTo({ top: 0, behavior: 'smooth' }); }
            _refocus(oFirstBad);   // 첫 오류 필드로 포커스 → 빨간 테두리 + 메시지 함께 표시
        }

        return Lret;
    }

    // APP ID 서버 검증 및 파라미터 유효성 검사
    let _appIdCheckSeq = 0;   // 앱ID 검사 요청 순번 — 비동기 레이스 방지(늦게 도착한 이전 응답을 폐기)

    // 앱 ID 존재 검사 + 앱 Name 채움. blur/Enter/F4/제출 공통. 성공="", 실패="E".
    async function fn_CheckAppId() {
        const mySeq = ++_appIdCheckSeq;   // 이번 요청 순번(응답 적용 전 최신인지 확인)

        // ★검사 시작 시 이전 밸류스테이트(오류 테두리+메시지)를 먼저 지운다.
        //   정상값이면 이미 지워져 안 뜨고, 아래 검사에서 걸리면 그때 다시 세팅한다.
        oAppIdField.setValueState("none");

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

            // ★레이스 방지: 이 요청 이후 더 최신 검사(다른 앱ID 입력)가 시작됐으면 이 응답은 폐기한다.
            //   (안 그러면 늦게 온 이전 응답이 현재 앱ID 아닌 이름/APPTY 로 덮어써 잘못된 경로 생성.)
            if (mySeq !== _appIdCheckSeq) { return ""; }

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
                title: getMsgText("/U4A/CL_WS_COMMON", "B93", "Error"),
                message: Lmsg
            });
            return "E";
        }

        return "";   // 앱 ID 존재 확인 성공(앱 Name 채움 완료)
    }

    // 제출 전 전체 검증 — 앱 ID 존재검사(fn_CheckAppId) + 추가 파라미터 검증
    async function fn_Check_value() {
        if (await fn_CheckAppId() === "E") { return "E"; }

        // 파라미터 검증
        //   ★이름(name) 허용문자 = URI 표준(RFC 3986) 의 'unreserved' 집합: A-Z a-z 0-9 - . _ ~
        //     원본은 /^[A-Za-z0-9]*$/ 라 하이픈을 막아, 정작 SAP 표준 파라미터(sap-client / sap-language / sap-user)
        //     조차 입력 불가였다 → 표준 집합으로 교정.
        //   ★값(value)은 제한하지 않는다 — URLSearchParams 가 퍼센트 인코딩하므로 &, =, 공백, 한글이 와도 URL 이 안 깨진다.
        let Lreturn = "";
        const regParamName = /^[A-Za-z0-9._~-]+$/;

        // 이전 오류 상태 초기화
        aParams.forEach(p => { p.state = "None"; });

        let errorIndex = -1;
        const oSeenName = new Set();   // 이름 중복 검출용

        for (let index = 0; index < aParams.length; index++) {
            const sLine = aParams[index];

            // Value는 있으나 Name이 공백인 경우
            if (sLine.name === "" && sLine.value !== "") {
                sLine.state = "Error";
                Lreturn = "01";
                errorIndex = index;
                break;
            }

            // Name에 표준 허용문자 이외의 문자가 있는 경우(공백, &, =, ?, #, 한글 등)
            if (sLine.name !== "" && !regParamName.test(sLine.name)) {
                sLine.state = "Error";
                Lreturn = "02";
                errorIndex = index;
                break;
            }

            // ★이름 중복 — 같은 이름을 두 번 넣으면 URLSearchParams 가 "a=1&a=2" 로 둘 다 실어, 서버가 어느 값을
            //   쓸지는 구현마다 다르다(대개 마지막 것). 사용자 의도와 어긋나므로 생성 전에 막는다.
            if (sLine.name !== "") {
                const sKey = sLine.name.toLowerCase();
                if (oSeenName.has(sKey)) {
                    sLine.state = "Error";
                    Lreturn = "03";
                    errorIndex = index;
                    break;
                }
                oSeenName.add(sKey);
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
            _toast(sMsg);
            return "E";
        }

        if (Lreturn === "02") {
            // ★메시지는 '실제 허용 규칙'을 그대로 말해야 한다.
            //   - 320("알파벳 또는 숫자만") → 이제 - . _ ~ 도 되므로 거짓.
            //   - 278("특수 문자는 허용되지 않습니다") → 한글이 걸렸을 때 "한글=특수문자"가 되어 거짓.
            //   → ZMSG_WS_COMMON_001 / 971 (신규): 허용 집합을 명시.
            sMsg = getWsText("971", "Only letters, numbers, and -._~ are allowed.");
            _toast(sMsg);
            return "E";
        }

        if (Lreturn === "03") {
            sMsg = getMsgText("/U4A/MSG_WS", "069", "A duplicate value exists.");
            _toast(sMsg);
            return "E";
        }

        return "S";
    }

    // 생성될 .lnk 최종 경로 — 저장경로 + 파일명(.lnk). 파일명이 비면 앱ID 로 대체.
    //   중복 검사(확인 팝업 전)와 실제 생성(fn_CreateShortcutRUN) 이 '동일 경로'를 쓰도록 단일 계산.
    function fn_getTargetLnkPath() {
        let sName = (oFileNameField.getValue() || "");
        if (sName.replace(/\s/g, "") === "") { sName = oAppIdField.getValue(); }
        sName = sName.replace(/\.lnk$/i, "") + ".lnk";
        return oAPP.path.join(oSavePathField.getValue(), sName);
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

        // ★확인 팝업은 '한 번'만. 파일 중복이면 그 사실을 확인 문구에 함께 담고, 없으면 일반 진행 문구.
        //   (기존엔 진행확인 → YES → 중복확인 → YES 로 팝업이 두 번 떴다.)
        const sProceed = getMsgText("/U4A/MSG_WS", "321", "Are you sure you want to proceed with creating a shortcut?");
        let sMsg = sProceed;
        let sType = "C";
        if (oAPP.FS.existsSync(fn_getTargetLnkPath())) {
            // 중복 있음 → "중복된 파일 이름이 있습니다." + 진행 확인
            sMsg = getMsgText("/U4A/MSG_WS", "004", "A duplicate file name exists.") + " " + sProceed;
            sType = "W";
        }

        U4AUI.confirm({
            type: sType,
            title: getMsgText("/U4A/CL_WS_COMMON", "A40", "Confirm"),
            message: sMsg,
            onClose: function (sAct) {
                if (sAct === "YES") {
                    fn_CreateShortcutRUN();
                } else {
                    const sCancelMsg = getMsgText("/U4A/MSG_WS", "161", "Job canceled.");
                    _toast(sCancelMsg);
                    fn_setBusy(false);
                }
            }
        });
        } catch (e) {
            console.error("[숏컷] 숏컷 생성 전 유효성 검사 예외 발생:", e);
            fn_setBusy(false);
            U4AUI.confirm({
                type: "E",
                title: getMsgText("/U4A/CL_WS_COMMON", "B93", "Error"),
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

        // 최종 .lnk 경로 — 중복 검사(fn_CreateShortcut)와 동일 계산을 재사용.
        //   파일명 형식 검증(금지문자/예약어)·중복 확인은 '확인 팝업 이전'에 이미 끝났다.
        LsPath = fn_getTargetLnkPath();

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

        // 파라미터 → 쿼리스트링. 값에 &, =, 공백, 한글 등이 들어가도 URL 이 안 깨지게 인코딩(URLSearchParams).
        const oSearch = new URLSearchParams();
        aParams.forEach(p => {
            if (p.name === "" && p.value === "") { return; }
            oSearch.append(p.name, p.value);
        });
        const Lparam = oSearch.toString();

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
            Loption = fn_setShortcutOption(U4Apath, "chrome");
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
            Loption = fn_setShortcutOption(U4Apath, "edge");
        }

        // 실제 파일 쓰기 — 중복 확인은 fn_CreateShortcut 의 단일 확인 팝업에서 이미 끝났다(여기선 덮어쓰기 진행).
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
                title: getMsgText("/U4A/CL_WS_COMMON", "D86", "Success"),
                message: sSuccessMsg,
                onClose: function () {
                    // 다운 폴더 탐색기 실행. (창은 닫지 않는다 — 연속으로 여러 바로가기를 만들 수 있게)
                    oAPP.SHELL.showItemInFolder(LsPath);
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
                title: getMsgText("/U4A/CL_WS_COMMON", "B93", "Error"),
                message: e.message || e.toString()
            });
        }
    }

    // 'startup 전용' 플래그 안내문 동기화 — 전체화면/키오스크/번역해제는 브라우저가 이미 실행 중이면
    //   Chromium 이 기존 인스턴스로 URL 만 넘겨 플래그를 무시한다(그냥 새 탭). 사용자가 "안 먹는다"고 오인하지
    //   않도록, 해당 옵션을 고르는 즉시 조건을 알린다(해제하면 사라짐).
    function fn_syncStartupNote() {
        const oNote = document.getElementById("browserOptNote");
        if (!oNote) { return; }

        const oChecked = document.querySelector('input[name="browserMode"]:checked');
        const sMode = oChecked ? oChecked.value : "";
        const aNames = [];

        if (sMode === "fullscreen") { aNames.push(getMsgText("/U4A/CL_WS_COMMON", "C79", "Full Screen Mode")); }
        if (sMode === "kiosk") { aNames.push(getMsgText("/U4A/CL_WS_COMMON", "C80", "Kiosk Mode")); }

        if (aNames.length === 0) {
            oNote.hidden = true;
            return;
        }

        // ZMSG_WS_COMMON_001 / 970 = "&1 은(는) 브라우저가 이미 실행 중이면 적용되지 않습니다. 브라우저를 완전히
        //   종료한 후 바로가기를 실행하십시오." — &1 = 해당 옵션 이름(C79/C80)을 p1 로 넘겨 치환.
        oNote.querySelector(".u4aShortcutNote__text").textContent = getWsText(
            "970",
            "&1 is not applied if the browser is already running. Close the browser completely, then run the shortcut.",
            aNames.join(", ")
        );
        oNote.hidden = false;
    }

    // 숏컷 실행 옵션(커맨드라인 플래그) 생성 — Chrome/Edge 공통.
    //   둘 다 Chromium 이라 모드 플래그(--app / --start-fullscreen / --kiosk)와 번역 비활성화는 동일.
    //   ★브라우저별로 다른 것: 비밀 모드(Chrome=--incognito / Edge=--inprivate), 키오스크(Edge 는 --edge-kiosk-type 추가).
    //
    //   ★★사용자 기본 프로파일 사용(--user-data-dir 미사용) — 로그인/쿠키 세션을 평소 브라우저와 공유하기 위함.
    //     대가: --start-fullscreen / --kiosk 는 'startup 전용' 플래그라, 해당 브라우저가
    //     이미 실행 중이면 Chromium 이 기존 인스턴스로 URL 만 넘겨 플래그를 무시한다(그냥 새 탭으로 열림).
    //     → 전체화면/키오스크/번역해제는 '브라우저를 완전히 종료한 상태'에서 실행해야 적용된다.
    //     (--app= 과 --incognito/--inprivate 는 실행 중이어도 항상 새 창으로 뜬다.)
    function fn_setShortcutOption(U4Apath, sBrowserType) {
        let Loption = "";
        const bSecret = document.getElementById("chkSecret").checked;

        if (bSecret) {
            Loption = (sBrowserType === "chrome") ? "--incognito" : "--inprivate";
        }

        // ★원본의 '번역 모드 해제'(--disable-translate) 옵션은 제거했다.
        //   해당 스위치는 현행 Chromium 에서 삭제됐고, 대체 후보(--disable-features=Translate / TranslateUI)도
        //   Chrome 150 실측 결과 번역 버블이 그대로 떠 전부 no-op 이었다(크롬은 모르는 feature 이름을 조용히 무시).
        //   현행 브라우저에서 번역 차단은 페이지 측(<meta name="google" content="notranslate">,
        //   <html translate="no">) 또는 관리자 정책으로만 가능하며, 바로가기 인자로는 구현 불가.

        const sMode = document.querySelector('input[name="browserMode"]:checked').value;

        switch (sMode) {
            case "app":
                Loption = (Loption !== "" ? Loption + " " : "") + "--app=" + U4Apath;
                break;
            case "normal":
                // 일반 모드 = 모드 플래그 없이 URL 만 전달(브라우저 기본 창). 원본은 여기에 --start-maximized(=최대화)를
                //   붙여놨으나, 이는 '일반'이 아니라 '최대화 시작'이라 선택 옵션과 결과가 불일치 → 제거.
                Loption = (Loption !== "" ? Loption + " " : "") + U4Apath;
                break;
            case "fullscreen":
                // 원본은 --start-maximized(=최대화, 전체화면 아님) 오표기였음 → 진짜 전체화면 = --start-fullscreen.
                Loption = (Loption !== "" ? Loption + " " : "") + "--start-fullscreen " + U4Apath;
                break;
            case "kiosk":
                // Edge 는 --kiosk 만으로는 공식 키오스크가 아니며 --edge-kiosk-type 을 요구한다(MS 문서).
                //   fullscreen = 단일 앱 전체화면 키오스크(브라우저 UI 없음).
                Loption = (Loption !== "" ? Loption + " " : "") + "--kiosk "
                    + (sBrowserType === "edge" ? "--edge-kiosk-type=fullscreen " : "") + U4Apath;
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
                        ${getWsText("946", "No data")}
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
            f4: fn_AppId_F4Help,
            // 입력 중(live) 부수효과 — 앱ID 글자가 바뀌는 순간(타이핑/백스페이스/X) 이미 채워진 앱 Name 은
            //   더 이상 그 ID 의 것이 아니므로 즉시 비우고 밸류스테이트도 해제한다(blur 까지 기다리지 않음).
            //   createApplicationPopup 의 패키지→Request No 라이브 리셋(lf_packageLiveReset)과 동일 컨셉.
            onInput: function () {
                if (oAppNmField && oAppNmField.getValue()) { oAppNmField.setValue(""); }
                oAppIdField.setValueState("none");
            },
            // 포커스 이동(change=blur) 또는 Enter 시 앱 존재검사 + 앱 Name 채움. 빈 값이면 이름만 비운다.
            onChange: function (sVal) { if (sVal && sVal.trim()) { fn_CheckAppId(); } else if (oAppNmField) { oAppNmField.setValue(""); } },
            onEnter: function (sVal) { if (sVal && sVal.trim()) { fn_CheckAppId(); } },
            // 클리어(X) 클릭 = 앱ID 비움 → 앱 Name 도 함께 비우고 오류 밸류스테이트 해제(앱ID가 비면 명칭도 무효).
            onClear: function () { if (oAppNmField) { oAppNmField.setValue(""); } oAppIdField.setValueState("none"); }
        });

        let sFileNamePlaceholder = getMsgText("/U4A/CL_WS_COMMON", "D10", "Shortcut") + " " + getMsgText("/U4A/CL_WS_COMMON", "C35", "File Name");
        oFileNameField = U4AUI.createField({
            id: "FORM1_INPUT3",
            placeholder: sFileNamePlaceholder
        });

        let sSavePathPlaceholder = sFileNamePlaceholder + " " + getMsgText("/U4A/CL_WS_COMMON", "D11", "Shortcut Download Path");
        oSavePathField = U4AUI.createField({
            id: "FORM1_INPUT4",
            valueHelpOnly: true,   // 값도움 전용 — 직접 타이핑 불가·활성 외관·클릭=폴더선택 F4(.analy/15 §3.8)
            placeholder: sSavePathPlaceholder,
            f4: function () { fn_select_Path("01"); },
            f4Icon: "folder-open"
        });

        let sIconPathPlaceholder = sFileNamePlaceholder + " " + getMsgText("/U4A/CL_WS_COMMON", "C70", "Shortcut Icon Path");
        oIconPathField = U4AUI.createField({
            id: "FORM1_INPUT5",
            valueHelpOnly: true,   // 값도움 전용 — 직접 타이핑 불가·활성 외관·클릭=아이콘선택 F4(.analy/15 §3.8)
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

        // (구) 브라우저 타입 변경 시 옵션 블록 토글(fn_select_BROWSER) 제거 — 옵션이 통합돼 브라우저와 무관하게 동일하다.


        // 4. Browser Option Panel
        const browserOptionPanel = document.getElementById("browserOptionPanel");
        const oBrowserOptPanel = U4AUI.createPanel({
            title: getMsgText("/U4A/CL_WS_COMMON", "C77", "Browser Option")
        });
        browserOptionPanel.appendChild(oBrowserOptPanel.el);

        // 브라우저 옵션 — Chrome/Edge 둘 다 Chromium 이라 지원 플래그가 동일 → 옵션을 하나로 통합(브라우저 전환해도 유지).
        //   ★비밀 모드만 브라우저별 플래그가 다름(Chrome=--incognito / Edge=--inprivate) → 빌더(fn_setShortcutOption)에서 분기.
        //   토글이 없어 display 조작이 없으므로 d-flex 사용 안전(구 chrome/edge 분리 블록의 !important 함정 소멸).
        const oBrowserOpts = document.createElement("div");
        oBrowserOpts.id = "browserOptions";
        oBrowserOpts.className = "d-flex flex-column gap-3 w-100";
        oBrowserOptPanel.body.appendChild(oBrowserOpts);

        oBrowserOpts.innerHTML = `
            <div class="u4aShortcutOptionGroup">
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="browserMode" value="normal" checked>
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "D38", "Normal Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="browserMode" value="app">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C78", "App Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="browserMode" value="fullscreen">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C79", "Full Screen Mode")}</span>
                </label>
                <label class="u4aShortcutOptionItem">
                    <input type="radio" name="browserMode" value="kiosk">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C80", "Kiosk Mode")}</span>
                </label>
            </div>
            <div class="u4aShortcutOptionGroup" style="border-top: 0.0625rem solid var(--line); padding-top: 0.5rem;">
                <label class="u4aShortcutOptionItem">
                    <input type="checkbox" id="chkSecret">
                    <span>${getMsgText("/U4A/CL_WS_COMMON", "C82", "Secret Mode")}</span>
                </label>
            </div>
            <div id="browserOptNote" class="u4aShortcutNote" hidden>
                <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span class="u4aShortcutNote__text"></span>
            </div>
        `;

        // 시작(startup) 전용 플래그 안내 — 선택 즉시 노출/해제 즉시 숨김(A안).
        oBrowserOpts.querySelectorAll('input[name="browserMode"]').forEach(function (oRadio) {
            oRadio.addEventListener("change", fn_syncStartupNote);
        });
        fn_syncStartupNote();


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
                <button type="button" class="u4a-btn u4a-btn--emphasized" id="btnParamAdd">
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

        // (구) 하단 Footer 메시지 바 제거 — 메시지는 공통 .u4a-toast(화면 정중앙) _toast() 로 출력(원본 MessageToast 대응).

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
                _toast(sMsg);
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
