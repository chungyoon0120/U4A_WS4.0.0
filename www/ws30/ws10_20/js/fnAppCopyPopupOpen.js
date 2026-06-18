/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnAppCopyPopupOpen.js
 * - file Desc : Application Copy Popup Open
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog + sap.ui.layout.form.Form(JSONModel two-way binding)
 *        + customHeader Toolbar + footer accept/decline Button.
 *  HTML5: native <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (.u4a-form__row/.u4a-input/.u4a-field/.u4a-label/.u4a-field__msg).
 *        createApplicationPopup.js 와 동일한 전략 — "로직 보존, UI만 교체".
 *
 *  ★ 비즈니스 로직(검증 fnCheckValidAppName / 존재확인 ajax_init_prc /
 *    복사수행 fnSetAppCopy /app_copy / Package F4 fnPackgSchpPopupOpener)은
 *    원본 그대로. UI5 의존부만 치환:
 *      · JSONModel two-way binding  → /WS10/APPCOPY 모델 + DOM 직접 동기.
 *      · sap.ui.core.ValueState     → data-vs="error" + .u4a-field__msg.
 *      · sap.m.* 컨트롤             → DOM + shell.css 컴포넌트.
 *      · parent.showMessage(sap, …) → parent.showMessage(null, …) (HTML5).
 *      · afterOpen fnSetBusyLock("") → showModal 직후 busy 해제.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    /************************************************************************
     * Root Variable Area..
     ************************************************************************/
    const
        C_BIND_ROOT_PATH = "/WS10/APPCOPY",
        C_APP_COPY_DLG_ID = "u4aWsAppCopyDlg";

    var APPCOMMON = oAPP.common,
        REMOTE = parent.REMOTE;

    // 다이얼로그 DOM 참조(재오픈 시 재사용 + 값/밸류스테이트 갱신).
    var oCopyUI = null;

    const _fa = (sName) => '<i class="fa-solid fa-' + sName + '"></i>';
    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }
    // clear(X) 버튼 — 전 화면 공통 글리프(fa-xmark)로 통일. 텍스트 "×" 금지(폰트 불일치).
    function _buildClearBtn() {
        const o = _el("button", "u4a-field__clear");
        o.type = "button";
        o.title = "Clear";
        o.tabIndex = -1;
        o.innerHTML = _fa("xmark");
        return o;
    }

    /************************************************************************
     * 공통 스타일 1회 주입 (테마 토큰 소비 — 하드코딩 색 없음)
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aCopyStyle")) { return; }
        const oStyle = document.createElement("style");
        oStyle.id = "u4aCopyStyle";
        oStyle.textContent = `
        .u4aCopyDlg { width: min(92vw, 460px); padding: 0; display: flex; flex-direction: column; }
        .u4aCopyDlg .u4a-dialog__header { cursor: move; user-select: none; }
        .u4aCopyDlg .u4a-dialog__header span { flex: 1 1 auto; }
        .u4aCopyBody { padding: 1.25rem 1.25rem 1.75rem; display: grid; gap: 1.25rem; }
        .u4aCopyBody .u4a-form__row .u4a-field__msg { white-space: nowrap; }
        .u4aCopyFoot { display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end; }
        `;
        document.head.appendChild(oStyle);
    }

    /************************************************************************
     * label + control row. 반환: {row, label, control, msg}
     ************************************************************************/
    function _row(sLabel, bRequired) {
        const oRow = _el("div", "u4a-form__row");
        const oLabel = _el("label", "u4a-label" + (bRequired ? " u4a-label--required" : ""), sLabel);
        oRow.appendChild(oLabel);
        const oCtrl = _el("div", "u4aCopyControl");
        oRow.appendChild(oCtrl);
        const oMsg = _el("div", "u4a-field__msg");
        oRow.appendChild(oMsg);
        return { row: oRow, label: oLabel, control: oCtrl, msg: oMsg };
    }

    /************************************************************************
     * Application Copy Popup Open
     ************************************************************************/
    oAPP.fn.fnAppCopyPopupOpen = function (sAppId) {

        // 푸터 메시지가 있을 경우 닫기
        APPCOMMON.fnHideFloatingFooterMsg();

        // Application Copy Init Model Setting (원본 oBindData 그대로)
        var oBindData = {
            SOURCEID: sAppId,
            TARGETID: "",
            TARGETID_VS: "None",
            TARGETID_VSTXT: "",
            PACKG: "$TMP",
            PACKG_VS: "None",
            PACKG_VSTXT: ""
        };
        APPCOMMON.fnSetModelProperty(C_BIND_ROOT_PATH, oBindData);

        // 이미 만들어진 다이얼로그가 있으면 값만 초기화하고 다시 연다.
        if (oCopyUI && oCopyUI.dlg && document.body.contains(oCopyUI.dlg)) {
            lf_syncModelToDom();
            lf_setVs(oCopyUI.tgtInp, oCopyUI.tgtMsg, false, "");
            lf_setVs(oCopyUI.packInp, oCopyUI.packMsg, false, "");
            oCopyUI.dlg.showModal();
            oAPP.common.fnSetBusyLock("");
            return;
        }

        _ensureStyle();

        // ── 다이얼로그 골격 ────────────────────────────────────────────
        const oDlg = document.createElement("dialog");
        oDlg.id = C_APP_COPY_DLG_ID;
        oDlg.className = "u4a-dialog u4aCopyDlg";

        // 헤더 — 메인 툴바 Copy 버튼(fa-copy)과 동일 아이콘으로 인지 통일.
        const oHeader = _el("div", "u4a-dialog__header");
        oHeader.setAttribute("data-type", "I");
        oHeader.innerHTML = _fa("copy") + '<span></span>';
        oHeader.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "B90"); // Application Copy
        const oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.setAttribute("data-act", "close");
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oXBtn.addEventListener("click", oAPP.events.ev_AppCopyDlgCancel);
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // 바디
        const oBody = _el("div", "u4a-dialog__body u4aCopyBody");
        oDlg.appendChild(oBody);

        // Source App. ID (B91) — 복사 원본(읽기 전용 표시).
        let oR = _row(_txt("/U4A/CL_WS_COMMON", "B91"), false);
        const oSrcInp = _el("input", "u4a-input u4a-input--display");
        oSrcInp.readOnly = true;
        oSrcInp.tabIndex = -1;
        oR.control.appendChild(oSrcInp);
        oBody.appendChild(oR.row);

        // Target App. ID (B92, required) — 입력 + 대문자화 + clear(X) + value-state.
        //   공통 .u4a-field + U4AUI.attachClear 로 다른 화면과 동일한 clear UX.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "B92"), true);
        const oTgtWrap = _el("div", "u4a-field");
        oTgtWrap.setAttribute("data-trail", "1");
        const oTgtInp = _el("input", "u4a-input u4a-field__input");
        oTgtInp.maxLength = oAPP.attr.iAppNameMaxLength || 15;
        oTgtWrap.appendChild(oTgtInp);
        const oTgtClear = _buildClearBtn();
        oTgtWrap.appendChild(oTgtClear);
        oR.control.appendChild(oTgtWrap);
        const oTgtMsg = oR.msg;
        oBody.appendChild(oR.row);

        // Package (A22, required) — 입력 + 대문자화 + clear(X) + value-help(F4) + value-state.
        oR = _row(_txt("/U4A/CL_WS_COMMON", "A22"), true);
        const oPackWrap = _el("div", "u4a-field");
        oPackWrap.setAttribute("data-trail", "2"); // clear + value-help 둘 다
        const oPackInp = _el("input", "u4a-input u4a-field__input");
        oPackWrap.appendChild(oPackInp);
        const oPackClear = _buildClearBtn();
        oPackWrap.appendChild(oPackClear);
        const oVh = _el("button", "u4a-field__vh");
        oVh.type = "button";
        oVh.innerHTML = _fa("magnifying-glass");
        oVh.title = _txt("/U4A/CL_WS_COMMON", "A22"); // Package
        oVh.addEventListener("click", oAPP.events.ev_packageSchpEvt);
        oPackWrap.appendChild(oVh);
        oR.control.appendChild(oPackWrap);
        const oPackMsg = oR.msg;
        oBody.appendChild(oR.row);

        // 푸터 — Copy(확정) / Close(취소)
        const oFoot = _el("div", "u4a-dialog__footer u4aCopyFoot");
        const oOk = _el("button", "u4a-btn u4a-btn--emphasized");
        oOk.type = "button";
        oOk.innerHTML = _fa("check") + '<span></span>';
        oOk.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A04"); // Copy
        oOk.addEventListener("click", oAPP.events.ev_AppCopyDlgOK);
        oFoot.appendChild(oOk);

        const oCancel = _el("button", "u4a-btn u4a-btn--negative");
        oCancel.type = "button";
        oCancel.innerHTML = _fa("xmark") + '<span></span>';
        oCancel.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCancel.addEventListener("click", oAPP.events.ev_AppCopyDlgCancel);
        oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        // 입력 → 모델 반영 + 대문자화(원본 ev_AppCopyDlgTargetInpChgEvt).
        oTgtInp.addEventListener("input", function () {
            const v = oTgtInp.value.toUpperCase();
            if (oTgtInp.value !== v) { oTgtInp.value = v; }
            lf_modelSet("TARGETID", v);
        });
        oPackInp.addEventListener("input", function () {
            const v = oPackInp.value.toUpperCase();
            if (oPackInp.value !== v) { oPackInp.value = v; }
            lf_modelSet("PACKG", v);
        });

        // clear(X) — 값 있을 때만 노출(공통 U4AUI.attachClear). clear 후 input 이벤트로
        //   모델/노출이 자동 동기화되지만, 명시적으로도 모델을 비운다.
        if (window.U4AUI && U4AUI.attachClear) {
            U4AUI.attachClear(oTgtInp, oTgtClear, function () { lf_modelSet("TARGETID", ""); });
            U4AUI.attachClear(oPackInp, oPackClear, function () { lf_modelSet("PACKG", ""); });
        }

        // ESC → 취소(닫기).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); oAPP.events.ev_AppCopyDlgCancel(); });

        _attachDrag(oDlg, oHeader);
        // 헤더 더블클릭 → 화면 중앙 복귀 / 우하단 grip → 크기조절 (공통 U4AUI, SAPUI5 동일 UX)
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 260 }); }

        // DOM 참조 저장.
        oCopyUI = {
            dlg: oDlg, srcInp: oSrcInp,
            tgtInp: oTgtInp, tgtMsg: oTgtMsg,
            packInp: oPackInp, packMsg: oPackMsg
        };

        // 모델값 → DOM 초기 동기.
        lf_syncModelToDom();

        document.body.appendChild(oDlg);
        oDlg.showModal();

        // busy 끄고 Lock 풀기 (원본 afterOpen).
        oAPP.common.fnSetBusyLock("");

    }; // end of oAPP.fn.fnAppCopyPopupOpen

    /************************************************************************
     * 어플리케이션 복사 수행
     ************************************************************************/
    oAPP.fn.fnSetAppCopy = function (oParam) {

        parent.setBusy('X');

        var sPath = parent.getServerPath() + '/app_copy',
            oFormData = new FormData();

        if (typeof oParam != "undefined") {
            oFormData.append("TRKORR", oParam.TRKORR);
        }

        var oBindData = APPCOMMON.fnGetModelProperty(C_BIND_ROOT_PATH),
            sSourceAppId = oBindData.SOURCEID, // 복사 원본 APPID
            sTargetAppId = oBindData.TARGETID, // 복사 대상 APPID
            sPackg = oBindData.PACKG;

        oFormData.append("S_APPID", sSourceAppId);
        oFormData.append("T_APPID", sTargetAppId);
        oFormData.append("PACKG", sPackg);

        sendAjax(sPath, oFormData, function (oResult) {

            // 복사 성공이면 복사 팝업을 먼저 닫는다(이후 SCRIPT 가 화면전환 수행).
            if (oResult.RETCD == "S") {
                lf_AppCopyPopupClose();
            }

            // 서버가 케이스별로 내려준 SCRIPT 를 그대로 수행한다.
            //   분기는 "스크립트가 호출하는 심볼" 이 결정한다(문자열 파싱 아님):
            //     · byId('AppNmInput').setValue + appChangeBtn.firePress → Change 모드(성공/정상)
            //     · 〃                          + displayBtn.firePress    → Display 모드(성공/제한)
            //     · lf_appCopyCtsPopup()                                  → CTS 팝업(비로컬 패키지)
            //     · parent.showMessage(sap,…)                             → 각종 검증 실패 메시지
            //   UI5 의존 심볼은 _evalServerScript 가 "이 스코프 한정" 으로 HTML5 동작에
            //   연결(전역 sap 스텁 무영향). 메시지 텍스트가 바뀌어도 안 깨진다.
            if (oResult.SCRIPT) {

                // 화면전환/CTS 팝업이 busy 가드에 막히지 않게 먼저 해제.
                //   (성공 스크립트는 ev_AppChange/ev_AppDisplay 가 다시 busy 를 건다)
                parent.setBusy('');

                try {
                    _evalServerScript(oResult.SCRIPT);
                } catch (e) {
                    console.error("[HTML5] /app_copy SCRIPT 수행 실패:", e && e.message, oResult.SCRIPT);
                    if (oResult.RTMSG) {
                        parent.showMessage(null, 20, (oResult.RETCD === "S" ? "S" : "E"), _relocalizeBakedMsg(oResult.RTMSG));
                    }
                }

                return;
            }

            // SCRIPT 가 없는 응답(예: 타깃 객체 존재 220 — RTMSG 만) — 서버 메시지로 폴백.
            parent.showMessage(null, 20, (oResult.RETCD === "E" ? "E" : "S"), _relocalizeBakedMsg(oResult.RTMSG));

            parent.setBusy('');

        });

    }; // end of oAPP.fn.fnSetAppCopy

    /************************************************************************
     * (Local) 서버 SCRIPT 수행 — UI5 의존 심볼을 "이 스코프 한정" 으로 HTML5 동작에 연결.
     * ---------------------------------------------------------------------
     *  /app_copy(/U4A/WS000002 FORM APP_COPY) 응답 SCRIPT 는 케이스별로 서로 다른
     *  UI5 심볼을 호출한다. 전역 sap 스텁(byId→null)을 기능형으로 바꾸면 byId('AppNmInput')
     *  null 반환을 전제로 가드된 코드(ws_events/ws_fn_*)가 회귀하므로, 여기서만 기능하는
     *  지역 sap.byId shim + lf_appCopyCtsPopup 을 두고 eval 한다(strict eval 은 바깥
     *  지역변수를 "읽기" 가능 — 새 전역을 만들지 않음).
     *    · byId('AppNmInput').setValue/getValue → WS10 앱명 DOM
     *    · byId('appChangeBtn').firePress()     → ev_AppChange (Change 모드)
     *    · byId('displayBtn').firePress()       → ev_AppDisplay (Display 모드)
     *    · lf_appCopyCtsPopup()                 → CTS(전송요청) 팝업
     *    · parent.showMessage(sap,…)            → 메시지(부모 showMessage 가 sap 인자 무시)
     ************************************************************************/
    function _evalServerScript(sScript) {
        // 서버 스크립트가 참조하는 지역 심볼(아래 sap / lf_appCopyCtsPopup).
        // eslint-disable-next-line no-unused-vars
        var sap = {
            ui: {
                getCore: function () {
                    return {
                        byId: function (sId) {
                            if (sId === "AppNmInput") {
                                var el = document.getElementById("AppNmInput");
                                return {
                                    setValue: function (v) { if (el) { el.value = (v == null ? "" : v); } },
                                    getValue: function () { return el ? el.value : ""; }
                                };
                            }
                            if (sId === "appChangeBtn") { return { firePress: function () { oAPP.events.ev_AppChange(); } }; }
                            if (sId === "displayBtn") { return { firePress: function () { oAPP.events.ev_AppDisplay(); } }; }
                            return null;
                        }
                    };
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        var lf_appCopyCtsPopup = _appCopyCtsPopup;

        // 백엔드가 "구운 텍스트"(백엔드 로그온 언어)로 내려준 검증실패 메시지를
        //   워크스페이스 언어로 재현지화 — 이 eval 동안만 parent.showMessage 를 감싼다.
        //   (성공 스크립트는 showMessage 를 안 부르므로 영향 없음. CTS 케이스도 무관.)
        var _origShowMessage = parent.showMessage;
        parent.showMessage = function (oUI5, kind, type, sMsg, fnCb) {
            return _origShowMessage.call(parent, oUI5, kind, type, _relocalizeBakedMsg(sMsg), fnCb);
        };

        try {
            // eslint-disable-next-line no-eval
            eval(sScript);
        } finally {
            parent.showMessage = _origShowMessage;
        }
    }

    // 백엔드 언어별 "파라미터(&) 템플릿" 캐시(REMOTE 왕복 1회 후 정규식 컴파일 보관).
    var _oParamTmplCache = {};

    /************************************************************************
     * (Local) baked 메시지 재현지화 — 백엔드가 메시지번호 없이 텍스트만 구워 보낼 때,
     *   그 텍스트를 백엔드 언어 DB 에서 역조회 → 키 확보 → 워크스페이스 언어로 재현지화.
     * ---------------------------------------------------------------------
     *  1) 완전일치 역조회 — 파라미터 없는 메시지(예: /U4A/MSG_WS 163).
     *  2) 템플릿 역매칭 — 파라미터(&1..) baked 메시지(008/050/073/220 등). 백엔드가
     *     &1 을 값으로 치환해버려 완전일치는 실패하므로, 템플릿의 & 자리를 와일드카드로
     *     매칭 → 파라미터 추출 → fnGetMsgClsText(번호, 파라미터)로 워크스페이스 언어 재구성.
     *  둘 다 실패하면 원문 폴백(예: SAP 시스템 메시지 — 우리 메시지클래스에 키 없음).
     *  ※ 백엔드 ABAP 의 MESSAGE Exxx INTO(=백엔드 언어로 구움)를 못 고칠 때의 클라이언트 우회.
     ************************************************************************/
    function _relocalizeBakedMsg(sText) {
        if (typeof sText !== "string" || sText === "") { return sText; }
        try {
            var sWsLangu = (parent.getUserInfo() || {}).LANGU;        // 워크스페이스(화면) 언어
            var sBeLangu = (parent.getServerInfo() || {}).LANGU;      // 백엔드 로그온 언어(구운 언어)
            if (!sBeLangu || sBeLangu === sWsLangu) { return sText; } // 언어 같으면 손댈 필요 없음

            // 1) 완전일치(파라미터 없는 메시지).
            var oKey = REMOTE.getGlobal("WsMsgCls").findKeyByText(sBeLangu, sText);
            if (oKey && oKey.ARBGB) {
                var sLocal = APPCOMMON.fnGetMsgClsText(oKey.ARBGB, oKey.MSGNR);
                if (sLocal && sLocal.indexOf("|") === -1) { return sLocal; }
            }

            // 2) 템플릿 역매칭(파라미터 있는 메시지).
            var aTmpl = _getParamTemplates(sBeLangu);
            for (var i = 0; i < aTmpl.length; i++) {
                var m = aTmpl[i].re.exec(sText);
                if (!m) { continue; }
                // 캡처값(텍스트 순서) → 자리표시자 번호(&n) 슬롯에 배치 → p1..p4.
                var p = ["", "", "", ""];
                var aSlots = aTmpl[i].slots;
                for (var g = 1; g < m.length; g++) {
                    var slot = aSlots[g - 1];
                    if (slot >= 1 && slot <= 4) { p[slot - 1] = m[g]; }
                }
                var sLoc = APPCOMMON.fnGetMsgClsText(aTmpl[i].ARBGB, aTmpl[i].MSGNR, p[0], p[1], p[2], p[3]);
                if (sLoc && sLoc.indexOf("|") === -1) { return sLoc; }
            }

            return sText; // 어느 것도 못 잡음(예: SAP 시스템 메시지) → 원문.
        } catch (e) {
            return sText;
        }
    }

    /************************************************************************
     * (Local) 백엔드 언어 "파라미터 템플릿" 목록을 정규식으로 컴파일해 캐시 반환.
     *   리터럴 많은(=구체적인) 템플릿이 먼저 매칭되도록 정렬 → 오매칭 최소화.
     ************************************************************************/
    function _getParamTemplates(sLangu) {
        if (_oParamTmplCache[sLangu]) { return _oParamTmplCache[sLangu]; }

        var aRows = [];
        try { aRows = REMOTE.getGlobal("WsMsgCls").getParamTemplates(sLangu) || []; } catch (e) { aRows = []; }

        var aCompiled = [];
        aRows.forEach(function (r) {
            var re = _tmplToRegex(r.TEXT);
            if (!re) { return; }
            aCompiled.push({
                ARBGB: r.ARBGB, MSGNR: r.MSGNR, re: re,
                slots: _tmplSlots(r.TEXT),
                litLen: r.TEXT.replace(/&[1-4]|&/g, "").length // 리터럴 길이(구체성)
            });
        });
        // 구체적인(리터럴 긴) 템플릿 우선.
        aCompiled.sort(function (a, b) { return b.litLen - a.litLen; });

        _oParamTmplCache[sLangu] = aCompiled;
        return aCompiled;
    }

    // 템플릿 TEXT → 앵커 정규식(리터럴 이스케이프 + &/&n → 캡처그룹).
    function _tmplToRegex(sText) {
        try {
            var sEsc = sText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 정규식 특수문자 이스케이프(& 는 비특수 → 보존)
            sEsc = sEsc.replace(/&[1-4]/g, "(.+?)").replace(/&/g, "(.+?)"); // &n 먼저(긴 토큰 우선)
            return new RegExp("^" + sEsc + "$");
        } catch (e) { return null; }
    }

    // 템플릿 자리표시자 등장순서 → 파라미터 슬롯번호 배열(&n→n, 바깥 &→1부터 순차).
    function _tmplSlots(sText) {
        var aTokens = sText.match(/&[1-4]|&/g) || [];
        var iPos = 0, aSlots = [];
        aTokens.forEach(function (t) {
            if (t.length === 2) { aSlots.push(parseInt(t.charAt(1), 10)); }
            else { iPos += 1; aSlots.push(iPos); }
        });
        return aSlots;
    }

    /************************************************************************
     * (Local) APP 복사 전용 CTS(전송요청) 팝업 — 구 lf_appCopyCtsPopup.
     *   요청번호 선택 후 그 TRKORR 로 복사를 재수행한다.
     ************************************************************************/
    function _appCopyCtsPopup() {
        oAPP.fn.fnCtsPopupOpener(function (oResult) {
            oAPP.fn.fnSetAppCopy(oResult);
        });
    }

    /************************************************************************
     * Application Copy Dialog After Close Event (원본 호환 유지)
     ************************************************************************/
    oAPP.events.ev_AppCopyDlgAfterClose = function () {

        // Application Copy Dialog Close
        lf_AppCopyPopupClose();

    }; // end of oAPP.events.ev_AppCopyDlgAfterClose

    /************************************************************************
     * Application Copy OK Button Event
     ************************************************************************/
    oAPP.events.ev_AppCopyDlgOK = function () {

        parent.setBusy('X');

        var oModelData = APPCOMMON.fnGetModelProperty(C_BIND_ROOT_PATH),
            sTargetId = oModelData.TARGETID;

        // Target ID / PACKG 의 valueState 초기화
        lf_setVs(oCopyUI.tgtInp, oCopyUI.tgtMsg, false, "");
        lf_setVs(oCopyUI.packInp, oCopyUI.packMsg, false, "");

        // 어플리케이션 명 정합성 체크
        var oValid = oAPP.fn.fnCheckValidAppName(sTargetId, true);

        if (oValid.RETCD == false) {

            var oCurrWin = REMOTE.getCurrentWindow();

            oCurrWin.flashFrame(true); // 작업표시줄 깜빡임

            parent.showMessage(null, 10, "", oValid.RETMSG);

            lf_setTargetIdValueStateChange("Error", oValid.RETMSG);

            parent.setBusy('');

            return;
        }

        // 패키지를 입력했는지 여부 확인
        if (oModelData.PACKG == "") {

            let sPackageTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A22"), // Package
                sPackgMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "050", sPackageTxt); // Package is required.

            parent.showMessage(null, 10, "", sPackgMsg);

            lf_setVs(oCopyUI.packInp, oCopyUI.packMsg, true, sPackgMsg);
            lf_modelSet("PACKG_VS", "Error");
            lf_modelSet("PACKG_VSTXT", sPackgMsg);

            parent.setBusy('');

            return;
        }

        var oFormData = new FormData();
        oFormData.append("APPID", sTargetId);

        // 복사 대상 APP 명 존재 유무 확인하여 없으면 복사 수행.
        ajax_init_prc(oFormData, function (oResult) {

            // 복사대상 어플리케이션이 존재 하는지 유무 확인
            var bIsAppExists = lf_getAppInfo(oResult);
            if (bIsAppExists == false) {

                parent.setBusy('');

                return;
            }

            // 복사 대상 어플리케이션 명이 없을 경우에만 복사 수행
            oAPP.fn.fnSetAppCopy();

        });

    }; // end of oAPP.events.ev_AppCopyDlgOK

    /************************************************************************
     * Application Copy Cancel Button Event
     ************************************************************************/
    oAPP.events.ev_AppCopyDlgCancel = function (oEvent) {

        // Application Copy Dialog Close
        lf_AppCopyPopupClose();

    }; // end of oAPP.events.ev_AppCopyDlgCancel

    /************************************************************************
     * Package Search Help Popup valueHelp Event
     ************************************************************************/
    oAPP.events.ev_packageSchpEvt = function (oEvent) {

        oAPP.fn.fnPackgSchpPopupOpener(function (oResult) {

            var sPackage = oResult.DEVCLASS;

            lf_modelSet("PACKG", sPackage);
            if (oCopyUI && oCopyUI.packInp) { oCopyUI.packInp.value = (sPackage == null ? "" : sPackage); }

        });

    }; // end of oAPP.events.ev_packageSchpEvt

    //-------------------------------------------------------------------------------//
    //-------------------------------------------------------------------------------//

    /************************************************************************
     * (Local Function) 헤더 드래그 이동 (구 sap.m.Dialog draggable 대체)
     ************************************************************************/
    function _attachDrag(oDlg, oHandle) {
        let bDrag = false, dx = 0, dy = 0;
        oHandle.addEventListener("mousedown", function (e) {
            if (e.target.closest(".u4a-btn-icon")) { return; }
            bDrag = true;
            const r = oDlg.getBoundingClientRect();
            oDlg.style.margin = "0";
            oDlg.style.position = "fixed";
            oDlg.style.left = r.left + "px";
            oDlg.style.top = r.top + "px";
            dx = e.clientX - r.left;
            dy = e.clientY - r.top;
            e.preventDefault();
        });
        document.addEventListener("mousemove", function (e) {
            if (!bDrag) { return; }
            oDlg.style.left = (e.clientX - dx) + "px";
            oDlg.style.top = (e.clientY - dy) + "px";
        });
        document.addEventListener("mouseup", function () { bDrag = false; });
    }

    /************************************************************************
     * (Local Function) 모델 단일 프로퍼티 갱신
     ************************************************************************/
    function lf_modelSet(sKey, vVal) {
        var o = APPCOMMON.fnGetModelProperty(C_BIND_ROOT_PATH) || {};
        o[sKey] = vVal;
        APPCOMMON.fnSetModelProperty(C_BIND_ROOT_PATH, o);
    }

    /************************************************************************
     * (Local Function) 모델값 → DOM 동기 (구 two-way binding 초기 반영)
     ************************************************************************/
    function lf_syncModelToDom() {
        if (!oCopyUI) { return; }
        var o = APPCOMMON.fnGetModelProperty(C_BIND_ROOT_PATH) || {};
        oCopyUI.srcInp.value = (o.SOURCEID == null ? "" : o.SOURCEID);
        oCopyUI.tgtInp.value = (o.TARGETID == null ? "" : o.TARGETID);
        oCopyUI.packInp.value = (o.PACKG == null ? "" : o.PACKG);
        // 값 직접 주입은 input 이벤트가 안 떠 clear(X) 노출(data-filled)이 갱신 안 됨.
        // attachClear 의 _sync(input 리스너)를 깨워 X 노출 상태를 맞춘다.
        oCopyUI.tgtInp.dispatchEvent(new Event("input", { bubbles: true }));
        oCopyUI.packInp.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /************************************************************************
     * (Local Function) value-state(error) 토글 — 구 ValueState/ValueStateText
     ************************************************************************/
    function lf_setVs(oInp, oMsg, bError, sText) {
        if (!oInp) { return; }
        if (bError) { oInp.setAttribute("data-vs", "error"); }
        else { oInp.removeAttribute("data-vs"); }
        if (oMsg) { oMsg.textContent = bError ? (sText || "") : ""; }
    }

    /************************************************************************
     * (Local Function) Application Copy Dialog Close
     ************************************************************************/
    function lf_AppCopyPopupClose() {

        if (!oCopyUI || !oCopyUI.dlg) { return; }

        try { oCopyUI.dlg.close(); } catch (e) { }

    } // end of lf_AppCopyPopupClose

    /************************************************************************
     * (Local Function) Application ID 존재 유무 확인하여 없으면 복사 수행
     ************************************************************************/
    function lf_getAppInfo(oResult) {

        if (oResult.MSGTY !== "N") {

            var oCurrWin = REMOTE.getCurrentWindow(),
                sMsg = parent.WSUTIL.getWsMsgClsTxt(parent.getUserInfo().LANGU, "ZMSG_WS_COMMON_001", "371"); // It is already registered application information.

            parent.showMessage(null, 10, "", sMsg);

            oCurrWin.flashFrame(true); // 작업표시줄 깜빡임

            // Target APPID에 대한 정합성 체크 후 오류 시, ValueState를 Error 로 변경
            lf_setTargetIdValueStateChange("Error", sMsg);

            return false;
        }

        // Target APPID에 ValueState 초기화
        lf_setTargetIdValueStateChange("None", "");

        return true;

    } // end of lf_getAppInfo

    /************************************************************************
     * (Local Function) Target APPID Input 의 valueState 변경
     ************************************************************************/
    function lf_setTargetIdValueStateChange(sValueState, sValueStateTxt) {

        // 정합성 체크 후 오류 시, ValueState를 Error 로 변경
        lf_modelSet("TARGETID_VS", sValueState);
        lf_modelSet("TARGETID_VSTXT", sValueStateTxt);

        if (oCopyUI) {
            lf_setVs(oCopyUI.tgtInp, oCopyUI.tgtMsg, sValueState === "Error", sValueStateTxt);
        }

    } // end of lf_setTargetIdValueStateChange

})(window, $, oAPP);
