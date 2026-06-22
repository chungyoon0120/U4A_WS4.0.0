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
     * [HTML5] sap 전역 스텁 (UI5 부트스트랩 제거 대응)
     * ---------------------------------------------------------------------
     *  서버가 내려주는 eval SCRIPT 가 UI5 객체를 참조한다 — 특히
     *    parent.showMessage(sap, 20, 'W', '메시지..')
     *  처럼 sap 을 "인자로만" 넘기는 케이스. 서버를 못 고치는 상황에서, sap 전역이
     *  없으면 인자 평가 시점에 ReferenceError → window.onerror(ws_trycatch) → APP.exit()
     *  로 앱이 죽는다. 부모(resources/index.js) showMessage 는 이미 oUI5(sap) 인자를
     *  "무시"하고 타입(S/E/W/I)·KIND 별로만 출력하므로, 여기선 sap 이 "존재하기만" 하면 된다.
     *
     *  단순 {} 로 두면 maximize 핸들러(ws_main.js)의 `if (typeof sap === "undefined")`
     *  가드가 풀려 sap.ui.getCore().byId(...) 에서 TypeError 가 나므로,
     *  byId()→null / lock·unlock→no-op 인 "안전 스텁"으로 만든다(해당 핸들러는 byId null
     *  이면 즉시 return). sap.m.MessageToast/MessageBox 를 직접 부르는 서버 스크립트도
     *  parent.showMessage 로 라우팅해 동일 메시지 시스템으로 출력한다.
     *
     *  ※ UI5 를 되살리는 게 아니라 "안 죽고 메시지만 뜨게" 하는 호환 셰임이다.
     ************************************************************************/
    if (typeof window.sap === "undefined") {
        (function () {
            function _noop() { }
            function _show(KIND, TYPE, sMsg, fnCb) {
                try { parent.showMessage(null, KIND, TYPE, sMsg, fnCb); } catch (e) { }
            }
            // 구 sap.ui.getCore() — byId 는 null(컨트롤 없음), lock/unlock/테마는 no-op.
            //   isLocked 는 항상 false(HTML5 의 "잠금"은 UI5 코어락이 아니라 busy=parent.getBusy
            //   이며 그쪽에서 따로 검사). isProcessRunning 등 sap.ui.getCore().isLocked() 호출부가
            //   스텁에 isLocked 가 없어 TypeError 나던 것 방지.
            var oCore = {
                byId: function () { return null; },
                lock: _noop,
                unlock: _noop,
                isLocked: function () { return false; },
                applyTheme: _noop,
                setModel: _noop,
                getModel: function () { return null; },
                setLanguage: _noop,
                attachInit: function (fn) { try { if (typeof fn === "function") { fn(); } } catch (e) { } },
                getConfiguration: function () {
                    return {
                        getLanguage: function () { return ""; },
                        getRTL: function () { return false; },
                        // 구 sap.ui.getCore().getConfiguration().getTheme() — USP Monaco iframe
                        //   (monaco/index.js:691)이 다크 여부 판정에 사용. 스텁에 없으면 TypeError →
                        //   에디터 EDITOR_LOAD 디스패치가 막혀 busy 가 안 꺼지던 원인.
                        //   활성 셸 테마(U4ATheme)를 반환 → 다크면 "...dark" 로 끝나 vs-dark 폴백 매칭.
                        getTheme: function () {
                            try {
                                var s = (window.U4ATheme && window.U4ATheme.current && window.U4ATheme.current()) || "";
                                return s || "";
                            } catch (e) { return ""; }
                        }
                    };
                }
            };
            window.sap = {
                ui: {
                    getCore: function () { return oCore; },
                    Device: { system: {}, browser: {}, support: {}, os: {}, media: { attach: _noop, detach: _noop } }
                },
                m: {
                    // 구 MessageToast.show → 토스트(KIND 10)
                    MessageToast: { show: function (sMsg) { _show(10, "I", sMsg); } },
                    // 구 MessageBox.* → 메시지박스(KIND 20). 콜백(onClose) 전달.
                    MessageBox: {
                        show: function (sMsg, o) { _show(20, (o && o.type) || "I", sMsg, o && o.onClose); },
                        alert: function (sMsg, o) { _show(20, "I", sMsg, o && o.onClose); },
                        error: function (sMsg, o) { _show(20, "E", sMsg, o && o.onClose); },
                        warning: function (sMsg, o) { _show(20, "W", sMsg, o && o.onClose); },
                        information: function (sMsg, o) { _show(20, "I", sMsg, o && o.onClose); },
                        success: function (sMsg, o) { _show(20, "S", sMsg, o && o.onClose); },
                        confirm: function (sMsg, o) { _show(30, "W", sMsg, o && o.onClose); },
                        Icon: { ERROR: "E", WARNING: "W", INFORMATION: "I", SUCCESS: "S", QUESTION: "C", NONE: "" },
                        Action: { OK: "OK", YES: "YES", NO: "NO", CANCEL: "CANCEL", CLOSE: "CLOSE", ABORT: "ABORT", RETRY: "RETRY", IGNORE: "IGNORE", DELETE: "DELETE" }
                    },
                    // 자주 참조되는 enum — 미정의 접근(TypeError) 방지용 폴백.
                    IllustratedMessageSize: { Base: "Base", Spot: "Spot", Dialog: "Dialog", Scene: "Scene", Auto: "Auto" },
                    ValueState: { Error: "Error", Warning: "Warning", Success: "Success", Information: "Information", None: "None" },
                    FlexAlignItems: {}, FlexJustifyContent: {}
                }
            };
        })();
    }

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

        // 구 ws_common.js: 새 메시지 표시 전 이전 메시지/타이머 제거(잔상 방지).
        oAPP.common.fnHideFloatingFooterMsg();

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

        // 구 ws_common.js: 10초 뒤 자동 숨김(타임아웃). 변환 누락으로 푸터가 영구히
        //   남아 이전 작업의 메시지가 다음 작업까지 보이던 회귀를 복원.
        if (oAPP.attr.footerMsgTimeout) {
            clearTimeout(oAPP.attr.footerMsgTimeout);
            delete oAPP.attr.footerMsgTimeout;
        }
        oAPP.attr.footerMsgTimeout = setTimeout(function () {
            oAPP.common.fnHideFloatingFooterMsg();
            clearTimeout(oAPP.attr.footerMsgTimeout);
            delete oAPP.attr.footerMsgTimeout;
        }, 10000);
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
     *  테마 native <dialog class="u4a-dialog"> 기반 확인창을 제공한다(서버리스트 메시지박스와 동일 디자인).
     *  fnCallback 은 원본 MessageBox onClose 와 동일하게 액션("YES"/"NO"/"CANCEL")을 전달.
     *  @param {string} sType  메시지 타입(S/E/I/W) — 제목 색/텍스트
     *  @param {string} sMsg   본문
     *  @param {Function} fnCallback (action)
     *  @param {Array}   [aBtns] 버튼 정의 [{act,label,emphasized}] — 생략 시 YES/NO.
     *                          3버튼(YES/NO/CANCEL) 등 커스텀 가능(구 showMessage KIND 40 대체).
     ************************************************************************/
    oAPP.common.fnConfirmBox = function (sType, sMsg, fnCallback, aBtns) {

        // 기본 버튼셋(YES/NO) — aBtns 로 3버튼 등 커스터마이즈 가능
        if (!aBtns || !aBtns.length) {
            aBtns = [{ act: "YES", label: "Yes", emphasized: true }, { act: "NO", label: "No" }];
        }
        var bHasCancel = aBtns.some(function (b) { return b.act === "CANCEL"; });

        function lf_done(sAct) {
            if (typeof fnCallback === "function") { try { fnCallback(sAct); } catch (e) { } }
        }

        // 네이티브 <dialog> 미지원/생성 실패 시 — 브라우저 confirm 폴백(동작 보장)
        var oDlg;
        try { oDlg = document.createElement("dialog"); } catch (e) { oDlg = null; }
        if (!oDlg || typeof oDlg.showModal !== "function") {
            var bOk = false;
            try { bOk = window.confirm(sMsg || ""); } catch (e2) { bOk = true; }
            lf_done(bOk ? "YES" : (bHasCancel ? "CANCEL" : "NO"));
            return;
        }

        // 제목 텍스트 (showMessage 와 동일 메시지클래스 — 없으면 영문 폴백) +
        //   타입별 아이콘 — 서버리스트 fnShowMessageBox(.u4a-dialog) 와 동일 디자인으로 통일.
        var oTypeMap = {
            S: ["D86", "Success", "circle-check"],
            E: ["B93", "Error", "circle-xmark"],
            W: ["B89", "Warning", "triangle-exclamation"],
            I: ["B86", "Information", "circle-info"],
            C: ["B86", "Information", "circle-question"]
        };
        var aT = oTypeMap[sType] || oTypeMap.I;
        var sTitle = aT[1];
        try { sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", aT[0]) || aT[1]; } catch (e) { }

        // 설정/서버리스트 다이얼로그와 동일한 .u4a-dialog 구조(헤더 아이콘 + 본문 + 푸터).
        oDlg.className = "u4a-dialog";
        oDlg.style.width = "min(28rem, 92vw)";
        oDlg.innerHTML =
            '<div class="u4a-dialog__header" data-type="' + (sType || "I") + '">' +
                '<i class="fa-solid fa-' + aT[2] + '"></i><span></span>' +
            '</div>' +
            '<div class="u4a-dialog__body" style="white-space:pre-wrap;line-height:1.45;"></div>' +
            '<div class="u4a-dialog__footer"></div>';
        oDlg.querySelector(".u4a-dialog__header span").textContent = sTitle;
        oDlg.querySelector(".u4a-dialog__body").textContent = sMsg || "";

        function lf_close(sAct) {
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
            lf_done(sAct);
        }

        var oFooter = oDlg.querySelector(".u4a-dialog__footer");
        aBtns.forEach(function (b) {
            var oBtn = document.createElement("button");
            oBtn.type = "button";
            oBtn.className = "u4a-btn" + (b.emphasized ? " u4a-btn--emphasized" : "");
            oBtn.textContent = b.label || b.act;
            oBtn.addEventListener("click", function () { lf_close(b.act); });
            oFooter.appendChild(oBtn);
        });
        // ESC → CANCEL(있으면) 아니면 NO
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(bHasCancel ? "CANCEL" : "NO"); });

        try { document.body.appendChild(oDlg); oDlg.showModal(); } catch (e) {
            lf_close(window.confirm(sMsg || "") ? "YES" : (bHasCancel ? "CANCEL" : "NO"));
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
     * [OVERRIDE] WS10 App Search Help (F4/돋보기) — 구 ev_AppValueHelp [ws_events.js, UI5]
     * ---------------------------------------------------------------------
     *  원본 진입 로직 이식: 현재 사용자/앱ID/앱유형으로 초기조건 구성 → fnAppF4PopupOpener
     *  (lazy-load fnAppF4PopupOpen[HTML5]). pick 콜백은 선택 APPID 를 AppNmInput 에 반영.
     ************************************************************************/
    oAPP.events.ev_AppValueHelp = function () {

        var sSapId = "";
        try { sSapId = String((parent.getUserInfo() || {}).ID || "").toUpperCase(); } catch (e) { }

        var oAppNmInput = document.getElementById("AppNmInput");
        var sAppId = oAppNmInput ? (oAppNmInput.value || "") : "";

        oAPP.attr = oAPP.attr || {};
        if (!oAPP.attr.gAPPTY) { oAPP.attr.gAPPTY = "M"; }

        var oOptions = {
            autoSearch: true,
            initCond: {
                PACKG: "", APPID: sAppId, APPNM: "", APPTY: oAPP.attr.gAPPTY,
                EXPAGE: "WS10", ERUSR: sSapId, HITS: 500
            }
        };

        // pick(더블클릭) 시 선택 APPID 를 입력값으로 반영(원본: fnSetModelProperty("/WS10/APPID")).
        //   ★ input 이벤트를 쏘지 않는다 — 쏘면 WS10 attachSuggest 가 추천목록을 연다(원본 setValue 도 이벤트 X).
        //   clear-X 노출은 감싼 .u4a-field 의 data-filled 로 직접 동기.
        function fnAppF4DataCallback(oAppData) {
            var i = document.getElementById("AppNmInput");
            if (i && oAppData && oAppData.APPID != null) {
                i.value = oAppData.APPID;
                var fld = i.closest ? i.closest(".u4a-field") : null;
                if (fld) { fld.setAttribute("data-filled", i.value ? "true" : "false"); }
            }
        }

        if (oAPP.fn.fnAppF4PopupOpener) {
            oAPP.fn.fnAppF4PopupOpener(oOptions, fnAppF4DataCallback);
        } else if (oAPP.fn.fnAppF4PopupOpen) {
            oAPP.fn.fnAppF4PopupOpen(oOptions, fnAppF4DataCallback);
        }
    };

    /************************************************************************
     * [OVERRIDE] WS10 트랜잭션 — App 생성 (구 oAPP.events.ev_AppCreate [ws_events.js])
     * ---------------------------------------------------------------------
     *  WS3.0 패턴 이식. AppNmInput(DOM) 값을 읽어 이름검증 → 서버 존재여부 확인 후
     *  HTML5 생성 팝업(design/js/createApplicationPopup.js)을 띄운다. 원본의
     *  sap.ui.getCore().byId / fnCheckAppName(UI5) 의존만 DOM 으로 치환, 흐름은 보존.
     ************************************************************************/
    oAPP.events.ev_AppCreate = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Create, Copy 일 경우에만 App Name MaxLength Check 수행.
        var bCheckAppNm = oAPP.fn.fnCheckAppName(true);
        if (!bCheckAppNm) {
            oAPP.common.fnSetBusyLock("");
            return;
        }

        var oAppNmInput = document.getElementById("AppNmInput");
        var sAppID = oAppNmInput ? oAppNmInput.value : "";

        var oFormData = new FormData();
        oFormData.append("APPID", sAppID);

        // 서버에서 App 정보를 구한다(존재 여부 확인).
        ajax_init_prc(oFormData, lf_success);

        function lf_success(oAppInfo) {

            // MSGTY 가 "" 이면 이미 등록된 application.
            if (oAppInfo.MSGTY == "") {
                // 035 It is already registered application information.
                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "035");
                APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), sMsg);
                oAPP.common.fnSetBusyLock("");
                return;
            }

            // 생성 팝업 호출(미로드 시 $.getScript 로 로드 후 호출).
            if (!oAPP.fn.createApplicationPopup) {
                $.getScript("design/js/createApplicationPopup.js", function () {
                    try { oAPP.fn.createApplicationPopup(sAppID); }
                    catch (e) { APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), "Create 오류: " + (e && e.message)); }
                    oAPP.common.fnSetBusyLock("");
                });
                return;
            }

            try { oAPP.fn.createApplicationPopup(sAppID); }
            catch (e) { APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), "Create 오류: " + (e && e.message)); }
            oAPP.common.fnSetBusyLock("");
        }
    };

    /************************************************************************
     * [OVERRIDE] WS10 트랜잭션 — App 삭제 (구 oAPP.events.ev_AppDelete [ws_events.js])
     * ---------------------------------------------------------------------
     *  WS3.0 검증 이식. 원본은 sap.ui.getCore().byId("AppNmInput").getValue() +
     *  parent.showMessage(sap, 30, 'W', …)(sap.m.MessageBox) 의존이라 UI5 제거 환경에서
     *  ReferenceError. 입력 읽기는 DOM(getElementById)으로, 질문창은 셸의 fnConfirmBox
     *  (showMessage KIND 30 대체)로 치환. 검증/존재확인/USP·일반 분기 흐름은 원본 그대로 보존.
     *    · 입력 검증(필수 273 / 공백 274 / 특수문자 278)
     *    · fnCheckAppExists → 없으면 007, 있으면 003 질문 → YES 시 APPTY 분기 삭제
     *  [HTML5] 원본은 input 이 /WS10 모델 바인딩이라 fnSetAppDelete 가 모델 APPID 를 읽었으나,
     *  HTML5 input 은 plain DOM 이므로 서버호출 전 /WS10/APPID 를 명시적으로 동기화한다.
     ************************************************************************/
    oAPP.events.ev_AppDelete = function () {

        // busy 키고 Lock 걸기
        oAPP.common.fnSetBusyLock("X");

        // Trial Version Check
        if (oAPP.fn.fnOnCheckIsTrial()) {
            oAPP.common.fnSetBusyLock("");
            return;
        }

        var oAppNmInput = document.getElementById("AppNmInput");
        if (!oAppNmInput) {
            oAPP.common.fnSetBusyLock("");
            return;
        }

        var sValue = oAppNmInput.value,
            sCurrPage = parent.getCurrPage(),
            sLangu = (parent.process.USERINFO || {}).LANGU;

        function lf_err(sMsg) {
            APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);
            oAPP.common.fnSetBusyLock("");
        }

        // 입력값 유무 확인
        if (typeof sValue !== "string" || sValue == "") {
            // 273 Application name is required.
            lf_err(parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273"));
            return;
        }

        // 입력값 공백 여부 체크
        if (/\s/.test(sValue)) {
            // 274 The application name must not contain any spaces.
            lf_err(parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "274"));
            return;
        }

        // 특수문자 존재 여부 체크
        if (/[^\w]/.test(sValue)) {
            // 278 Special characters are not allowed.
            lf_err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278"));
            return;
        }

        // application 존재 여부 체크
        var sAppID = oAppNmInput.value;
        oAPP.fn.fnCheckAppExists(sAppID, lf_result);

        function lf_result(RESULT) {

            var oAppInfo = RESULT.RETURN,
                oCurrWin = REMOTE.getCurrentWindow(),
                sCurrPage = parent.getCurrPage();

            if (RESULT.RETCD == "E") {

                // 작업표시줄 깜빡임
                oCurrWin.flashFrame(true);

                // 007 Application ID &1 does not exist.
                var sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "007", oAppInfo.APPID);
                APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg);

                oAPP.common.fnSetBusyLock("");
                return;
            }

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

            // [HTML5] DOM input → 모델 동기화: 서버호출(fnSetAppDelete/fnSetUspAppDelete)이
            //   /WS10 모델의 APPID 를 읽으므로, 검증된 APPID 를 모델에 반영한다.
            APPCOMMON.fnSetModelProperty("/WS10/APPID", sAppID);

            // 003 Do you really want to delete the object?
            var sQMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "003");

            // 질문팝업 — 구: parent.showMessage(sap, 30, 'W', …) → 셸 fnConfirmBox(YES/NO)
            oAPP.common.fnConfirmBox("W", sQMsg, function (TYPE) {

                // busy 키고 Lock 걸기
                oAPP.common.fnSetBusyLock("X");

                if (TYPE == null || TYPE == "NO") {
                    oAPP.common.fnSetBusyLock("");
                    return;
                }

                // 삭제 어플리케이션이 USP 일 경우.
                if (oAppInfo.APPTY == "U") {
                    oAPP.fn.fnSetUspAppDelete();
                    return;
                }

                // 어플리케이션 삭제하러 서버 호출
                oAPP.fn.fnSetAppDelete();

            });
        }

    }; // end of oAPP.events.ev_AppDelete

    /************************************************************************
     * [OVERRIDE] Application Name 입력 체크 (구 oAPP.fn.fnCheckAppName [ws_fn_02.js])
     * ---------------------------------------------------------------------
     *  원본은 sap.ui.getCore().byId("AppNmInput").getValue() + fnCheckValidAppName
     *  (jQuery.sap.startsWith 의존). UI5 제거 환경에서 동작하도록 DOM 값을 읽고
     *  정합성(필수/특수문자/길이/Z·Y 시작)을 인라인 검증한다.
     ************************************************************************/
    oAPP.fn.fnCheckAppName = function (bAppMaxLengthCheck) {

        var oAppNmInput = document.getElementById("AppNmInput");
        if (!oAppNmInput) { return false; }

        var sValue = oAppNmInput.value;
        var sCurrPage = parent.getCurrPage();
        var sLangu = (parent.process.USERINFO || {}).LANGU;

        function lf_err(sMsg) { APPCOMMON.fnShowFloatingFooterMsg("E", sCurrPage, sMsg); return false; }

        // 필수 입력.
        if (typeof sValue !== "string" || sValue === "") {
            // 273 Application name is required.
            return lf_err(parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273"));
        }

        // 특수문자 불가(영숫자/언더스코어 외).
        if (/[^\w]/.test(sValue)) {
            // 278 Special characters are not allowed.
            return lf_err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278"));
        }

        // Create/Copy 시에만 길이 체크.
        if (bAppMaxLengthCheck && sValue.length > oAPP.attr.iAppNameMaxLength) {
            // 115 Application ID can only be 15 characters or less !!
            return lf_err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "115"));
        }

        // Z 또는 Y 로 시작해야 함.
        var sUp = sValue.toUpperCase();
        if (sUp.charAt(0) !== "Z" && sUp.charAt(0) !== "Y") {
            // 009 The application ID must start with Z or Y.
            return lf_err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "009"));
        }

        return true;
    };

    /************************************************************************
     * [OVERRIDE] Application 명 정합성 체크 (구 oAPP.fn.fnCheckValidAppName [ws_fn_02.js])
     * ---------------------------------------------------------------------
     *  원본은 jQuery.sap.startsWith 의존 — UI5 제거 환경에선 jQuery.sap 가 없어 throw.
     *  로직(필수/특수문자/길이/Z·Y 시작)은 그대로, startsWith → charAt 로만 치환.
     *  Copy 팝업(fnAppCopyPopupOpen) OK 검증이 이 함수를 호출한다.
     ************************************************************************/
    oAPP.fn.fnCheckValidAppName = function (sAppID, bAppMaxLengthCheck) {

        var oRetData = { RETCD: false, RETMSG: "" };
        var sLangu = (parent.process.USERINFO || {}).LANGU;
        var sValue = sAppID;

        // 필수 입력.
        if (typeof sValue !== "string" || sValue === "") {
            // 273 Application name is required.
            oRetData.RETMSG = parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", "273");
            return oRetData;
        }

        // 특수문자 불가(영숫자/언더스코어 외).
        if (/[^\w]/.test(sValue)) {
            // 278 Special characters are not allowed.
            oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "278");
            return oRetData;
        }

        // Create/Copy 시에만 길이 체크.
        if (bAppMaxLengthCheck && sValue.length > oAPP.attr.iAppNameMaxLength) {
            // 115 Application ID can only be 15 characters or less !!
            oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "115");
            return oRetData;
        }

        // Z 또는 Y 로 시작해야 함.
        var sUp = sValue.toUpperCase();
        if (sUp.charAt(0) !== "Z" && sUp.charAt(0) !== "Y") {
            // 009 The application ID must start with Z or Y.
            oRetData.RETMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "009");
            return oRetData;
        }

        oRetData.RETCD = true;
        return oRetData;
    };

    /************************************************************************
     * [OVERRIDE] 생성 성공 후 편집 모드 전환 (구 onAppCrAndChgMode [ws_common.js])
     * ---------------------------------------------------------------------
     *  원본은 sap.ui.getCore().byId("AppNmInput"/"appChangeBtn") + firePress.
     *  HTML5: DOM input 에 APPID 세팅 후 ev_AppChange(WS20 Change 진입) 직접 호출.
     ************************************************************************/
    window.onAppCrAndChgMode = function (sAppID) {
        var oAppInput = document.getElementById("AppNmInput");
        if (!oAppInput) { return; }
        sAppID = (sAppID || "").toUpperCase();
        oAppInput.value = sAppID;
        try { oAPP.events.ev_AppChange(); } catch (e) {
            if (typeof console !== "undefined") { console.warn("[WS10] onAppCrAndChgMode error", e); }
        }
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

        // WS10 복귀(back) 시: 앱조회(display)로 숨겨둔 App Search 팝업을 다시 표시.
        //   (원본 ws_fn_01.js fnOnMoveToPage WS10 분기: AppF4DialogWS10 가 isOpen && !visible 이면 setVisible(true).
        //    HTML5 는 _pendingReshow 플래그로 "조회로 숨김"만 구분 — 사용자가 X/Close 한 건 재표시하지 않음.)
        if (sPgNm === "WS10") {
            try {
                var oF4Dlg = document.getElementById("u4aAppF4Dlg");
                if (oF4Dlg && oF4Dlg._pendingReshow && !oF4Dlg.open && typeof oF4Dlg._appf4Reshow === "function") {
                    oF4Dlg._appf4Reshow();
                }
            } catch (e) { }
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
