/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : ws_html5_shell.js
 * - file Desc : UI5 제거 — 모델/공통 override 레이어 (구 ws_main/ws_common 의 UI5 의존 대체)
 * ----------------------------------------------------------------------
 * doc 03 §11(B) / .analy/14 설계 기반. WS3.0 검증 구현 이식.
 *   · UI5 JSONModel → 경로기반 상태객체(oAPP.attr.oModel) shim.
 *   · UI5 의존 공통함수(fnSetBusyLock/checkWLOList/setWSHeadText/푸터 등)를
 *     같은 이름으로 override(원본보다 "뒤"에 로드되어야 함 — library-preload 끝).
 *   · WS10 화면 렌더는 ws10_html.js(fnRenderWs10Html)가 담당 → 여기서 안 함.
 *   · sap 글로벌 없음(부트스트랩 제거) → 모든 sap.* 호출부는 override 또는 가드.
 ************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP = window.oAPP || {};
    oAPP.fn = oAPP.fn || {};
    oAPP.main = oAPP.main || {};
    oAPP.common = oAPP.common || {};
    oAPP.attr = oAPP.attr || {};
    oAPP.events = oAPP.events || {};

    var APPCOMMON = oAPP.common;

    /************************************************************************
     * showCriticalErrorDialog 폴백 (구 ws_trycatch.js — 현재 미로드)
     *   미리보기 iframe(design/preview/index.js)이 parent.parent.showCriticalErrorDialog
     *   로 오류를 보고하는데, 메인 창에 정의가 없어 2차 TypeError 가 났음.
     *   UI5 의존 없이 푸터 메시지/콘솔로 안전하게 대체. (이미 있으면 유지)
     ************************************************************************/
    if (typeof window.showCriticalErrorDialog !== "function") {
        window.showCriticalErrorDialog = function (sMsg) {
            try { console.error("[Critical]", sMsg); } catch (e) { }
            try {
                var sPage = (parent.getCurrPage && parent.getCurrPage()) || "WS10";
                APPCOMMON.fnShowFloatingFooterMsg && APPCOMMON.fnShowFloatingFooterMsg("E", sPage, String(sMsg || ""));
            } catch (e) { }
        };
    }

    /************************************************************************
     * 경로기반 상태 모델 (구 sap.ui.model.json.JSONModel 대체)
     ************************************************************************/
    function _createModel() {

        var _data = {};

        function _resolveParent(sPath) {
            var aParts = sPath.replace(/^\//, "").split("/");
            var oObj = _data;
            for (var i = 0; i < aParts.length - 1; i++) {
                if (oObj[aParts[i]] == null) { oObj[aParts[i]] = {}; }
                oObj = oObj[aParts[i]];
            }
            return { obj: oObj, key: aParts[aParts.length - 1] };
        }

        return {
            get oData() { return _data; },
            set oData(v) { _data = v || {}; },
            setData: function (o) { _data = o || {}; },
            getData: function () { return _data; },
            getProperty: function (sPath) {
                if (sPath === "/" || sPath === "" || sPath == null) { return _data; }
                var aParts = sPath.replace(/^\//, "").split("/");
                var oObj = _data;
                for (var i = 0; i < aParts.length; i++) {
                    if (oObj == null) { return undefined; }
                    oObj = oObj[aParts[i]];
                }
                return oObj;
            },
            setProperty: function (sPath, vValue) {
                if (sPath === "/" || sPath === "") { _data = vValue; }
                else { var oRef = _resolveParent(sPath); oRef.obj[oRef.key] = vValue; }
                // 바인딩된 화면 부분 갱신 (현재는 푸터 메시지)
                try { oAPP.fn.fnRenderFooterMsg && oAPP.fn.fnRenderFooterMsg(); } catch (e) { }
            },
            refresh: function () { }
        };
    }

    /************************************************************************
     * UI5 BusyDialog 호환 더미 (parent.setBusy/setDomBusy 가 oBusy 참조)
     ************************************************************************/
    oAPP.fn.fnCreateDummyBusy = function () {
        // busy 카드 DOM 은 메인 프레임(index.html)에 있으므로 parent.document 기준으로 갱신.
        function _doc() { try { return parent.document; } catch (e) { return document; } }
        function _set(sId, sVal) {
            try { var el = _doc().getElementById(sId); if (el) { el.textContent = sVal || ""; } } catch (e) { }
        }
        return {
            _open: false,
            // 구 BusyDialog 의 제목/메시지 → 카드의 #u4aWsBusyTitle/#u4aWsBusyText 갱신
            setText: function (s) { _set("u4aWsBusyText", s); },
            setTitle: function (s) { _set("u4aWsBusyTitle", s); },
            isOpen: function () { return this._open; },
            open: function () { this._open = true; parent.setDomBusy && parent.setDomBusy("X"); },
            close: function () {
                this._open = false;
                _set("u4aWsBusyText", ""); _set("u4aWsBusyTitle", "");
                parent.setDomBusy && parent.setDomBusy("");
            }
        };
    };

    /************************************************************************
     * 모델 get / set (구 sap.ui.getCore().getModel().getProperty/setProperty)
     ************************************************************************/
    oAPP.common.fnGetModelProperty = function (sModelPath) {
        if (!oAPP.attr.oModel) { return undefined; }
        return oAPP.attr.oModel.getProperty(sModelPath);
    };
    oAPP.common.fnSetModelProperty = function (sModelPath, oModelData /*, bIsRefresh */) {
        if (!oAPP.attr.oModel) { return; }
        oAPP.attr.oModel.setProperty(sModelPath, oModelData);
    };

    /************************************************************************
     * 초기 모델 바인딩 (구 fnOnInitModelBinding 의 HTML5 대체)
     ************************************************************************/
    oAPP.main.fnOnInitModelBinding = function () {

        var oMetaData = {
            METADATA: parent.getMetadata(),
            USERINFO: parent.getUserInfo(),
            SERVERINFO: parent.getServerInfo(),
            SUGG: { TCODE: [] },
            WMENU: { WS10: {}, WS20: {} },
            SETTING: { ISPIN: false },
            WS10: oAPP.main.fnGetWs10InitData ? oAPP.main.fnGetWs10InitData() : {},
            WS20: oAPP.main.fnGetWs20InitData ? oAPP.main.fnGetWs20InitData() : {},
            WS30: {},
            UAI: {},
            FMSG: {
                WS10: { ISSHOW: false, ICONCOLOR: "", TXT: "" },
                WS20: { ISSHOW: false, ICONCOLOR: "", TXT: "" }
            }
        };

        oAPP.attr.metadata = oMetaData;

        var oModelData = $.extend(true, {}, oMetaData);

        oAPP.attr.oModel = _createModel();
        oAPP.attr.oModel.setData(oModelData);

    };

    /************************************************************************
     * WS Global Setting Language 메시지 텍스트 → 상태객체 저장
     *   구 ws_main.js fnGetWsMsgModelData 가 getModel() 사용 → override.
     ************************************************************************/
    oAPP.main.fnGetWsMsgModelData = function () {
        return new Promise(function (resolve) {
            try {
                var aMsgTxtList = [
                    { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "047" },
                    { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "067" },
                    { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "068" },
                    { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "247" },
                    { "ARBGB": "ZMSG_WS_COMMON_001", "MSGNR": "248" }
                ];
                var oLanguTextResult = parent.WSUTIL.getWsMsgClsModelData(aMsgTxtList);
                if (oLanguTextResult.RETCD === "E") { resolve(); return; }
                APPCOMMON.fnSetModelProperty("/WSLANGU", oLanguTextResult.RTDATA);
            } catch (e) {
                console.warn("[HTML5] fnGetWsMsgModelData skip:", e && e.message);
            }
            resolve();
        });
    };

    /************************************************************************
     * checkWLOList / getWsWLOList (구 sap 모델 의존 → 상태객체)
     ************************************************************************/
    oAPP.common.getWsWLOList = function () {
        var aWLO = oAPP.common.fnGetModelProperty("/METADATA/T_REG_WLO");
        if (!Array.isArray(aWLO)) { return []; }
        return aWLO;
    };
    oAPP.common.checkWLOList = function (REGTYP, CHGOBJ) {
        REGTYP = REGTYP || "";
        CHGOBJ = CHGOBJ || "";
        var aWLO = oAPP.common.getWsWLOList();
        if (!Array.isArray(aWLO)) { return false; }
        return !!aWLO.find(function (elem) { return elem.REGTYP == REGTYP && elem.CHGOBJ == CHGOBJ; });
    };

    /************************************************************************
     * R&D Staff 여부 (구 fnIsStaff 가 sap 의존일 수 있어 안전 래핑)
     ************************************************************************/
    var _fnIsStaffOrig = oAPP.fn.fnIsStaff;
    oAPP.fn.fnIsStaff = function () {
        try { if (_fnIsStaffOrig) { return _fnIsStaffOrig(); } } catch (e) { }
        try {
            var oUser = parent.getUserInfo() || {};
            return oUser.IS_STAFF === "X" || oUser.ISSTAFF === "X";
        } catch (e) { return false; }
    };

    /************************************************************************
     * 헤더 타이틀 텍스트 (구 setWSHeadText)
     ************************************************************************/
    oAPP.common.setWSHeadText = function (sText) {
        var oTitle = document.getElementById("u4aWsHeaderTitle");
        if (oTitle) { oTitle.textContent = sText || ""; }
    };

    /************************************************************************
     * Busy + Lock (구 fnSetBusyLock: UI5 core lock 제거, setBusy 만)
     ************************************************************************/
    oAPP.common.fnSetBusyLock = function (isbusy, sDesc) {
        if (isbusy === "X") {
            // sDesc 가 있으면 BusyDialog(카드 메시지) 경로로, 없으면 일반 busy(스피너 카드).
            parent.setBusy("X", sDesc ? { DESC: sDesc } : undefined);
            return;
        }
        parent.setBusy("");
    };

    /************************************************************************
     * 개인화 설정 (구 fnOnInitP13nSettings) — 추후 변환 스텁(WS20 영역)
     ************************************************************************/
    oAPP.fn.fnOnInitP13nSettings = function () {
        // [추후 변환] WS20/디자인 개인화. 메인 셸/WS10 렌더엔 영향 없음.
    };

    /************************************************************************
     * WS10 AppName Input DOM 접근 헬퍼
     ************************************************************************/
    oAPP.fn.fnGetWs10AppInputDom = function () {
        return document.getElementById("AppNmInput");
    };

    /************************************************************************
     * 푸터 메시지 (구 ws_common.js — sap 모델/사운드 의존 제거)
     *   실제 렌더는 ws10_html.js 의 훅(oAPP.ws10html.showFooter/hideFooter)에 위임.
     ************************************************************************/
    oAPP.fn.fnRenderFooterMsg = function () {
        try {
            var oMsg = oAPP.common.fnGetModelProperty("/FMSG/WS10") || {};
            if (oMsg.ISSHOW && oAPP.ws10html && oAPP.ws10html.showFooter) {
                oAPP.ws10html.showFooter(oMsg.TYPE || "I", oMsg.TXT || "");
            }
        } catch (e) { }
    };
    oAPP.common.fnShowFloatingFooterMsg = function (TYPE, POS, MSG) {
        // POS(WS10/WS20/WS30) 또는 현재 페이지로 대상 푸터 결정.
        var sPos = POS || (function () { try { return parent.getCurrPage(); } catch (e) { return "WS10"; } })() || "WS10";
        try {
            APPCOMMON.fnSetModelProperty("/FMSG/" + sPos, { ISSHOW: true, TYPE: TYPE, TXT: MSG });
        } catch (e) { }
        try {
            if (sPos === "WS20" && oAPP.ws20html && oAPP.ws20html.showFooter) {
                oAPP.ws20html.showFooter(TYPE || "I", MSG || "");
            } else if (oAPP.ws10html && oAPP.ws10html.showFooter) {
                oAPP.ws10html.showFooter(TYPE || "I", MSG || "");
            }
        } catch (e) { }
    };
    oAPP.common.fnHideFloatingFooterMsg = function () {
        try { APPCOMMON.fnSetModelProperty("/FMSG", { WS10: { ISSHOW: false }, WS20: { ISSHOW: false } }); } catch (e) { }
        try { if (oAPP.ws10html && oAPP.ws10html.hideFooter) { oAPP.ws10html.hideFooter(); } } catch (e) { }
        try { if (oAPP.ws20html && oAPP.ws20html.hideFooter) { oAPP.ws20html.hideFooter(); } } catch (e) { }
    };

    /************************************************************************
     * [HTML5] YES/NO 확인 다이얼로그 (구 showMessage(sap, 30, ...) 대체)
     * ---------------------------------------------------------------------
     *  메인프레임 showMessage 의 KIND 30 분기는 아직 sap.m.MessageBox 의존이라
     *  UI5 제거 환경에서 동작하지 않는다. 창 닫기(ev_Logout) 등 셸 경로에서 쓰도록
     *  테마 native <dialog class="u4a-msgbox"> 기반 확인창을 제공한다.
     *  fnCallback 은 원본 MessageBox onClose 와 동일하게 "YES"/"NO" 를 전달.
     *  @param {string} sType  메시지 타입(S/E/I/W) — 제목 색/텍스트
     *  @param {string} sMsg   본문
     *  @param {Function} fnCallback (action:"YES"|"NO")
     ************************************************************************/
    oAPP.common.fnConfirmBox = function (sType, sMsg, fnCallback) {

        function lf_done(sAct) {
            if (typeof fnCallback === "function") { try { fnCallback(sAct); } catch (e) { } }
        }

        // 네이티브 <dialog> 미지원/생성 실패 시 — 브라우저 confirm 폴백(동작 보장)
        var oDlg;
        try { oDlg = document.createElement("dialog"); } catch (e) { oDlg = null; }
        if (!oDlg || typeof oDlg.showModal !== "function") {
            var bOk = false;
            try { bOk = window.confirm(sMsg || ""); } catch (e2) { bOk = true; }
            lf_done(bOk ? "YES" : "NO");
            return;
        }

        // 제목 텍스트 (showMessage 와 동일 메시지클래스 — 없으면 영문 폴백)
        var oTitleMap = { S: ["D86", "Success"], E: ["B93", "Error"], W: ["B89", "Warning"], I: ["B86", "Information"] };
        var aT = oTitleMap[sType] || oTitleMap.I;
        var sTitle = aT[1];
        try { sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", aT[0]) || aT[1]; } catch (e) { }

        // 버튼 텍스트 — Yes/No 메시지코드 불확실(미존재 시 "경로|코드" 노출) → 리터럴 유지
        var sYes = "Yes", sNo = "No";

        oDlg.className = "u4a-msgbox";
        oDlg.innerHTML =
            '<div class="u4a-msgbox__title" data-type="' + (sType || "I") + '"></div>' +
            '<div class="u4a-msgbox__body"></div>' +
            '<div class="u4a-msgbox__footer">' +
            '  <button type="button" class="u4a-btn u4a-btn--emphasized" data-act="YES"></button>' +
            '  <button type="button" class="u4a-btn" data-act="NO"></button>' +
            '</div>';
        oDlg.querySelector(".u4a-msgbox__title").textContent = sTitle;
        oDlg.querySelector(".u4a-msgbox__body").textContent = sMsg || "";
        oDlg.querySelector('[data-act="YES"]').textContent = sYes;
        oDlg.querySelector('[data-act="NO"]').textContent = sNo;

        function lf_close(sAct) {
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
            lf_done(sAct);
        }
        oDlg.querySelector('[data-act="YES"]').addEventListener("click", function () { lf_close("YES"); });
        oDlg.querySelector('[data-act="NO"]').addEventListener("click", function () { lf_close("NO"); });
        // ESC(취소) → NO
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close("NO"); });

        try { document.body.appendChild(oDlg); oDlg.showModal(); } catch (e) {
            // showModal 실패 시 폴백
            lf_close(window.confirm(sMsg || "") ? "YES" : "NO");
        }
    };

    /************************************************************************
     * [OVERRIDE] WS10 트랜잭션 — App 조회 / 수정 (구 oAPP.events.ev_AppDisplay/ev_AppChange)
     * ---------------------------------------------------------------------
     *  WS3.0 검증 이식. AppNmInput(DOM) 값을 읽어 fnOnEnterDispChangeMode 로 위임.
     *   · Display → ISEDIT ""   · Change → ISEDIT "X"
     ************************************************************************/
    oAPP.events.ev_AppDisplay = function (oEvent) {
        oAPP.common.fnSetBusyLock("X");
        var oAppNmInput = document.getElementById("AppNmInput");
        var sAppID = oAppNmInput ? oAppNmInput.value : "";
        oAPP.fn.fnOnEnterDispChangeMode(sAppID, ""); // [async]
    };

    oAPP.events.ev_AppChange = async function () {
        oAPP.common.fnSetBusyLock("X");
        var oAppNmInput = document.getElementById("AppNmInput");
        var sAppID = oAppNmInput ? oAppNmInput.value : "";
        oAPP.fn.fnOnEnterDispChangeMode(sAppID, "X"); // [async]
    };

    /************************************************************************
     * [OVERRIDE] Application Display or Change mode
     *            (구 oAPP.fn.fnOnEnterDispChangeMode [ws_fn_02.js])
     * ---------------------------------------------------------------------
     *  WS3.0 검증 이식. 입력 읽기만 DOM 으로 치환. 검증/ajax_init_prc/lf_success 의
     *  모델/단축키/suggestion/fnOnMoveToPage 흐름은 원본 그대로 보존.
     ************************************************************************/
    oAPP.fn.fnOnEnterDispChangeMode = async function (APPID, ISEDIT) {

        // busy 키고 Lock 걸기 — 구 동작처럼 경로별 메시지 표시(BusyDialog 카드).
        //   258 = Application Change Mode / 261 = Application Display Mode (ZMSG_WS_COMMON_001)
        var sBusyMsg = "";
        try {
            var _lg = (parent.process.USERINFO || {}).LANGU;
            sBusyMsg = parent.WSUTIL.getWsMsgClsTxt(_lg, "ZMSG_WS_COMMON_001", ISEDIT === "X" ? "258" : "261");
        } catch (e) { sBusyMsg = (ISEDIT === "X") ? "Change" : "Display"; }
        oAPP.common.fnSetBusyLock("X", sBusyMsg);

        var oAppNmInput = document.getElementById("AppNmInput");
        if (!oAppNmInput) {
            oAPP.common.fnSetBusyLock("");
            return;
        }

        var sValue = oAppNmInput.value,
            sCurrPage = parent.getCurrPage();

        var oUserInfo = parent.process.USERINFO;
        var sLangu = oUserInfo.LANGU;

        // 입력값 유무 확인
        if (typeof sValue !== "string" || sValue == "") {
            // Application name is required.
            var sErrMsg = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273");
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 입력값 공백 여부 체크
        var reg = /\s/;
        if (reg.test(sValue)) {
            // The application name must not contain any spaces.
            var sErrMsg = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "274");
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 특수문자 존재 여부 체크
        var reg = /[^\w]/;
        if (reg.test(sValue)) {
            // Special characters are not allowed.
            var sErrMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278");
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sErrMsg);
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

            var sCurrPage = parent.getCurrPage();

            // application 이 없을 경우 메시지 처리.
            if (oAppInfo.MSGTY == "N") {
                var oCurrWin = parent.REMOTE.getCurrentWindow();
                oCurrWin.flashFrame(true);
                // Application ID &1 does not exist.
                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", APPID);
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);
                oAPP.common.fnSetBusyLock("");
                return;
            }

            // Change 모드로 들어왔는데 APP가 Lock 걸려 있는 경우.
            if (ISEDIT === "X" && oAppInfo.IS_EDIT === "") {
                if (oAppInfo.APPTY == "U") {
                    APPCOMMON.fnShowFloatingFooterMsg("E", "WS30", oAppInfo.MESSAGE);
                } else {
                    APPCOMMON.fnShowFloatingFooterMsg("E", "WS20", oAppInfo.MESSAGE);
                }
            }

            var oUserInfo = APPCOMMON.fnGetModelProperty("/USERINFO"),
                ISADM = oUserInfo.ISADM; // Admin 권한 여부

            // Admin이 아닌 유저가 Admin App을 열었을 경우 Disply 모드로 변환
            if (ISADM !== "X" && oAppInfo.ADMIN_APP === "X") {
                oAppInfo.IS_EDIT = "";
            }

            // 어플리케이션 정보에 버전 관리 정보가 포함되어 있을 경우 Display 모드로 전환
            if (typeof oAppInfo.S_APP_VMS !== "undefined") {
                oAppInfo.IS_EDIT = "";
            }

            // USP Application 일 경우
            if (oAppInfo.APPTY === "U") {
                oAPP.fn.fnOnSaveAppSuggestion(oAppInfo.APPID);
                APPCOMMON.fnSetModelProperty("/WS30/APP", oAppInfo);
                APPCOMMON.removeShortCut("WS10");
                APPCOMMON.setShortCut("WS30");
                oAPP.fn.fnOnMoveToPage("WS30");
                try {
                    parent.UAI.setCustomEvent_WS_30();
                } catch (e) {
                    console.warn("[추후 변환] UAI.setCustomEvent_WS_30:", e && e.message);
                }
                return;
            }

            // Application 이 존재 할 경우 — 리턴받은 APP 정보를 Frame에 저장한다.
            parent.setAppInfo(oAppInfo);

            // WS20 기본 모델 데이터
            var oWs20 = oAPP.main.fnGetWs20InitData();
            oWs20.APP = oAppInfo;
            APPCOMMON.fnSetModelProperty("/WS20", oWs20);

            // 자동으로 새창을 띄우면서 20번 페이지로 이동 시,
            var oNewWin_IF_DATA = parent.getNewBrowserIF_DATA();
            if (oNewWin_IF_DATA && oNewWin_IF_DATA.ACTCD === "MOVE20") {
                // "MOVE20"인 경우에는 아무 동작도 하지 않음
            } else {
                oAPP.fn.fnOnSaveAppSuggestion(oAppInfo.APPID);
            }

            APPCOMMON.removeShortCut("WS10");
            APPCOMMON.setShortCut("WS20");

            // WS20번 페이지로 이동한다.
            oAPP.fn.fnOnMoveToPage("WS20");

            try {
                parent.UAI.setCustomEvent_WS_20();
            } catch (e) {
                console.warn("[추후 변환] UAI.setCustomEvent_WS_20:", e && e.message);
            }

        } // end of lf_success

    }; // end of oAPP.fn.fnOnEnterDispChangeMode

    /************************************************************************
     * [OVERRIDE] 페이지 이동 (base) — 구 oAPP.fn.fnOnMoveToPage [ws_fn_02.js]
     * ---------------------------------------------------------------------
     *  구: sap.ui.getCore().byId("WSAPP").to(sPgNm) (UI5 NavContainer)
     *  신: #WSAPP 의 WS10/WS20/WS30 div 토글(ws10_html.js fnNavTo).
     *  WS20/WS30 콘텐츠는 ws_html5_ws20.js 가 이 함수를 super 로 감싸 렌더한다.
     *  콘텐츠가 아직 없으면 "변환 예정" 안내 DOM 을 임시로 표시(곧 override 가 교체).
     ************************************************************************/
    oAPP.fn.fnOnMoveToPage = function (sPgNm) {

        var oUi = oAPP.attr.ui || {};
        var oPages = oUi.pages || {};

        // 셸 미초기화(페이지 컨테이너 없음)면 중단 — 구 byId("WSAPP") null 체크 대체
        if (!oUi.WSAPP) { return; }

        // 열려있는 윈도우 메뉴(드롭다운) 숨김 (구 .sapMMenu visibility hidden)
        try { if (oAPP.ws10html && oAPP.ws10html.closeMenus) { oAPP.ws10html.closeMenus(); } } catch (e) { }

        // WS20 / WS30 컨테이너가 없으면 생성 (방어적 — 셸 렌더에서 이미 생성됨)
        if (!oPages[sPgNm] && (sPgNm === "WS20" || sPgNm === "WS30")) {
            var oNew = document.createElement("div");
            oNew.id = sPgNm;
            oNew.className = "u4aWsPage u4aWsHidden";
            oUi.WSAPP.appendChild(oNew);
            oPages[sPgNm] = oNew;
            oUi.pages = oPages;
        }

        // WS20/WS30 콘텐츠가 아직 없으면 "변환 예정" 안내 DOM 표시 (override 가 곧 교체)
        if ((sPgNm === "WS20" || sPgNm === "WS30") && oPages[sPgNm]) {
            var oPageEl = oPages[sPgNm];
            if (!oPageEl.getAttribute("data-placeholder-shown") && !oPageEl.getAttribute("data-ws20-shell")) {
                var sNotice = (sPgNm === "WS20")
                    ? "WS20 (애플리케이션 편집화면) 로딩중…"
                    : "WS30 (USP 코드 에디터) — 변환 예정";
                var oPH = document.createElement("div");
                oPH.className = "u4aWsConvertNotice";
                oPH.textContent = sNotice;
                oPageEl.appendChild(oPH);
                oPageEl.setAttribute("data-placeholder-shown", "X");
            }
        }

        // 페이지 전환 (div 토글 + parent.setCurrPage) — 구 NavContainer.to
        oAPP.fn.fnNavTo(sPgNm);

        // 페이지 전환(도착) 직후 busy 해제.
        //   · WS10(back)/WS30: fnMoveToWs10 이 busy-off 안 함(원본 주석처리)/placeholder
        //     라 여기서 해제.
        //   · WS20: 끄지 않는다 — 데이터(getAppData)→가운데 미리보기(iframe) 로드까지
        //     busy 를 연속 유지해야 함. 최종 해제는 미리보기 성공 시점
        //     (ws_html5_ws20_prev.js _ws20ReleasePrevBusy) / 실패·watchdog 에서 수행.
        if (sPgNm !== "WS20") {
            try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
        }

    }; // end of oAPP.fn.fnOnMoveToPage

    /************************************************************************
     * [OVERRIDE] 모든 Dialog 닫기 (구 oAPP.fn.fnCloseAllDialog [ws_fn_02.js])
     * ---------------------------------------------------------------------
     *  구: sap.m.InstanceManager.closeAllPopovers/LightBoxes → sap 없음(크래시).
     *  신: 열려있는 native <dialog> 전부 닫기(HTML5). 뒤로가기(fnMoveToWs10) 경로의
     *      "sap is not defined" 크래시 제거.
     ************************************************************************/
    oAPP.fn.fnCloseAllDialog = function () {
        try {
            var aDlg = document.querySelectorAll("dialog[open]");
            for (var i = 0; i < aDlg.length; i++) {
                try { aDlg[i].close(); } catch (e) { }
            }
        } catch (e) { }
    };

    /************************************************************************
     * [OVERRIDE] WS20 디자인 영역 정리 (구 oAPP.fn.removeContent [design/js/main.js])
     * ---------------------------------------------------------------------
     *  구: UI5 TreeTable(oLTree1)/undoRedo/미리보기 UI 참조 → HTML5 WS20 에는 없음(크래시).
     *  신: WS20 디자인 상태/데이터만 초기화하고 WS20 페이지 DOM 을 비워(다음 진입 시 재렌더)
     *      안전하게 teardown. **전역 모델(oAPP.attr.oModel)은 비우지 않는다** — 단일
     *      shim 모델이라 WS10/USERINFO/메타까지 날아감. /WS20 모델 정리는 fnMoveToWs10 이
     *      별도로 수행한다.
     ************************************************************************/
    oAPP.fn.removeContent = function () {

        try {
            oAPP.attr.prev = {};
            oAPP.attr.popup = [];
            oAPP.attr.bfselUI = undefined;
            oAPP.attr.UA015UI = undefined;
            oAPP.attr.DnDRandKey = "";
            oAPP.attr.prevCSS = [];
            oAPP.attr.appInfo = {};
            delete oAPP.attr.T_EVT;
            delete oAPP.DATA.APPDATA;
            try { if (oAPP.common.checkWLOList("C", "UHAK901369")) { delete oAPP.DATA.LIB; } } catch (e) { }
        } catch (e) {
            console.warn("[HTML5][WS20] removeContent state reset:", e && e.message);
        }

        // WS20 디자인 모델 데이터 초기화 — 다음 진입 시 이전 앱의 트리/속성 잔상 방지.
        //   (트리는 oData.zTREE, 속성은 oData.T_ATTR 에서 렌더되며 refresh 훅이 재렌더하므로
        //    DOM 만 비우면 재진입 시 stale 데이터로 이전 트리가 다시 그려진다.)
        //   전역 모델은 비우지 않고 WS20 전용 키만 초기화(WS10/USERINFO/메타 보존).
        try {
            var oD = oAPP.attr.oModel && oAPP.attr.oModel.oData;
            if (oD) {
                oD.zTREE = [];
                oD.TREE = [];
                oD.T_ATTR = [];
                oD.uiinfo = undefined;
            }
        } catch (e) { }

        // WS20 페이지 DOM 비우기 → 다음 Display/Change 진입 시 셸 새로 렌더
        try {
            var oWS20 = (oAPP.attr.ui && oAPP.attr.ui.pages && oAPP.attr.ui.pages.WS20)
                || document.getElementById("WS20");
            if (oWS20) {
                oWS20.innerHTML = "";
                oWS20.removeAttribute("data-ws20-shell");
                oWS20.removeAttribute("data-placeholder-shown");
            }
            if (oAPP.attr.ui) { oAPP.attr.ui.ws20 = undefined; }
        } catch (e) {
            console.warn("[HTML5][WS20] removeContent DOM clear:", e && e.message);
        }

    }; // end of oAPP.fn.removeContent

})();
