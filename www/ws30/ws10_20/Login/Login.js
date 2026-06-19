/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : Login.js
 * - file Desc : WS Login Page (HTML5 컨버전)
 * ----------------------------------------------------------------------
 * doc 02 §8(B-1)/§9, doc 12 테마 전략 기반 SAP UI5 → 순수 HTML5 컨버전.
 *   · Electron/Node 자원(REMOTE/FS/regedit/XHR/autoUpdater/GlobalShortCut)은
 *     호출부를 그대로 유지한다 (doc 02 §9.4 불변 제약).
 *   · 인증/세션 흐름(ev_login XHR /wsloginchk, withCredentials, 권한·라이선스·
 *     버전체크, fnOnLoginSuccess → loadWS30MainPage)은 로직 그대로 보존하고
 *     UI5 UI 레이어(렌더·Dialog·MessageBox·Model·byId)만 HTML5 로 교체한다.
 *   · 색/모양은 theme/tokens.css 의미 토큰만 소비 (테마 전환 U4ATheme).
 ************************************************************************/
var oAPP = (function () {
    "use strict";

    /********************************************************************
     * Electron / Node 자원 (유지 — doc 02 §9.4 / 8장 A)
     *   Login.html(iframe)의 parent = WS30 메인 프레임. 동일 계약 유지.
     ********************************************************************/
    const
        require = parent.require,
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        CURRWIN = REMOTE.getCurrentWindow(),
        APPPATH = parent.APPPATH,
        PATH = parent.PATH,
        REGEDIT = parent.REGEDIT,
        APP = parent.APP,
        USERDATA = APP.getPath("userData"),
        FS = parent.FS,
        IPCMAIN = REMOTE.require('electron').ipcMain,
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        autoUpdater = REMOTE.require("electron-updater").autoUpdater,
        autoUpdaterSAP = require(parent.getPath("AUTOUPDSAP")).autoUpdaterSAP,
        SERVPATH = parent.getServerPath(),
        autoUpdaterServerUrl = `${SERVPATH}/update_check`,
        OCTOKIT = REMOTE.require("@octokit/core").Octokit,
        WSLOG = require(PATH.join(PATHINFO.WS10_20_ROOT, "js", "ws_log.js")),
        GlobalShortCut = REMOTE.globalshortcut || REMOTE.globalShortcut;

    let oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.events = {};
    oAPP.msg = {};

    // 외부(부모/Login_trial) 호환을 위해 window 노출
    window.oAPP = oAPP;

    /********************************************************************
     * 상태 저장소 (UI5 JSONModel 대체 — getProperty/setProperty 호환 API)
     *   doc 02 §9.3 step3. 깊은 로직은 oModel.get/setProperty 를 그대로 호출.
     ********************************************************************/
    const oModel = {
        data: {},
        _observers: {}, // path-prefix → fn (setProperty 시 동기화)
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
        setProperty(sPath, val /*, bSilent*/) {
            const aParts = sPath.replace(/^\//, "").split("/");
            let o = this.data;
            for (let i = 0; i < aParts.length - 1; i++) {
                if (o[aParts[i]] == null) {
                    o[aParts[i]] = {};
                }
                o = o[aParts[i]];
            }
            o[aParts[aParts.length - 1]] = val;
            // 등록된 옵저버(예: /BUSYPOP)에 동기화 통지
            for (const sPrefix in this._observers) {
                if (sPath.indexOf(sPrefix) === 0) {
                    try { this._observers[sPrefix](); } catch (e) { /* noop */ }
                }
            }
        },
        setData(oData) {
            this.data = oData;
        },
        refresh() { /* DOM 동기화는 명시적 render 함수가 담당 */ }
    };
    oAPP.model = oModel;

    /********************************************************************
     * 아이콘 (Font Awesome 7.2.0 solid — currentColor 상속, doc 12 §6.6 G)
     ********************************************************************/
    const _fa = (sName) => `<i class="fa-solid fa-${sName}"></i>`;
    const ICON = {
        min: _fa("window-minimize"),
        max: _fa("window-maximize"),
        restore: _fa("window-restore"),
        close: _fa("xmark"),
        eye: _fa("eye"),
        eyeSlash: _fa("eye-slash"),
        disconnected: _fa("plug-circle-xmark"),
        question: _fa("circle-question"),
        checklist: _fa("list-check"),
        noauth: _fa("user-lock"),
        spinner: _fa("spinner"),
        success: _fa("circle-check"),
        caret: _fa("chevron-down"),
        accept: _fa("check"),
        clear: _fa("xmark")
    };

    // 화면에 생성된 커스텀 콤보 인스턴스 보관 (id → combo element)
    const oCombos = {};

    /********************************************************************
     * 깊은 복제 (jQuery.extend(true,...) 대체)
     ********************************************************************/
    function _deepClone(o) {
        try {
            return structuredClone(o);
        } catch (e) {
            try { return JSON.parse(JSON.stringify(o)); } catch (e2) { return Object.assign({}, o); }
        }
    }

    // 절대 경로 → file:// URL (img src 용 — ServerList 와 동일 규칙)
    function _toFileUrl(sPath) {
        let s = String(sPath).replaceAll("\\", "/");
        return encodeURI(`file:///${s}`);
    }

    /********************************************************************
     * Busy / Toast / MessageBox (UI5 BusyIndicator/Toast/MessageBox 대체)
     ********************************************************************/
    let _iToastTimer;
    oAPP.fn.showToast = function (sMsg) {
        let oToast = document.getElementById("u4aWsLoginToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aWsLoginToast";
            oToast.className = "u4a-toast";
            oToast.setAttribute("role", "alert");
            document.body.appendChild(oToast);
        }
        oToast.textContent = sMsg;
        oToast.dataset.show = "true";
        clearTimeout(_iToastTimer);
        _iToastTimer = setTimeout(() => { oToast.dataset.show = "false"; }, 3000);
    };

    /**
     * sap.m.MessageBox 대체 — 테마 토큰 소비 native <dialog>.
     *  @param {string} TYPE   E/W/I/S/C (Error/Warning/Information/Success/Confirm)
     *  @param {string} sMsg
     *  @param {object} [opts] { title, actions:[..], emphasizedAction, initialFocus, onClose }
     */
    oAPP.fn.fnMessageBox = function (TYPE, sMsg, opts) {
        opts = opts || {};
        let oDlg = document.getElementById("u4aWsLoginMsgDlg");
        if (oDlg) { oDlg.remove(); }

        oDlg = document.createElement("dialog");
        oDlg.id = "u4aWsLoginMsgDlg";
        // 서버리스트/셸 메시지박스와 동일한 .u4a-dialog(헤더 아이콘 + 본문 + 푸터) 디자인으로 통일.
        oDlg.className = "u4a-dialog";
        oDlg.style.width = "min(28rem, 92vw)";

        const oTypeIcon = { C: "circle-question", S: "circle-check", E: "circle-xmark", W: "triangle-exclamation", I: "circle-info" };
        const sTitle = opts.title || ({ C: "Confirm", S: "Success", E: "Error", W: "Warning", I: "Information" }[TYPE] || "");

        const oHead = document.createElement("div");
        oHead.className = "u4a-dialog__header";
        oHead.dataset.type = TYPE || "I";
        const oIcon = document.createElement("i");
        oIcon.className = "fa-solid fa-" + (oTypeIcon[TYPE] || "circle-info");
        oHead.appendChild(oIcon);
        const oTitleSpan = document.createElement("span");
        oTitleSpan.textContent = sTitle;
        oHead.appendChild(oTitleSpan);
        oDlg.appendChild(oHead);

        const oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body";
        oBody.style.whiteSpace = "pre-wrap";
        oBody.style.lineHeight = "1.45";
        oBody.textContent = sMsg;
        oDlg.appendChild(oBody);

        const oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer";

        function _close(sAction) {
            oDlg.close();
            oDlg.remove();
            if (typeof opts.onClose === "function") { opts.onClose(sAction); }
        }

        let aActions = Array.isArray(opts.actions) && opts.actions.length ? opts.actions : ["OK"];
        let oFocusBtn = null;
        aActions.forEach((sAction) => {
            const oBtn = document.createElement("button");
            const bEmph = (opts.emphasizedAction && opts.emphasizedAction === sAction) || (!opts.emphasizedAction && sAction === "OK");
            oBtn.className = "u4a-btn" + (bEmph ? " u4a-btn--emphasized" : "");
            oBtn.textContent = sAction;
            oBtn.addEventListener("click", () => _close(sAction));
            oFoot.appendChild(oBtn);
            if (opts.initialFocus === sAction) { oFocusBtn = oBtn; }
        });
        oDlg.appendChild(oFoot);

        document.body.appendChild(oDlg);
        oDlg.showModal();
        (oFocusBtn || oFoot.querySelector("button")).focus();

        if (TYPE === "E") { try { parent.setSoundMsg("02"); } catch (e) { } }
    };

    /************************************************************************
     * div의 content DOM을 활성화 처리 한다.
     ************************************************************************/
    function _showContentDom(bIsShow) {
        let oContentDom = document.getElementById("content");
        if (!oContentDom) { return; }
        oContentDom.style.display = "none";
        if (bIsShow === "X") {
            oContentDom.style.display = "";
            oContentDom.dataset.show = "true"; // .u4a-fade opacity 보장
        }
    } // end of _showContentDom

    function _checkWLOListAsync(aWLO, REGTYP, CHGOBJ) {
        if (!aWLO || Array.isArray(aWLO) === false || aWLO.length === 0) {
            return false;
        }
        let oFind = aWLO.find(e => e.REGTYP === REGTYP && e.CHGOBJ === CHGOBJ);
        return !!oFind;
    } // end of _checkWLOListAsync

    /************************************************************************
     * 서버 언어 데이터를 수집한다. (FS 유지)
     ************************************************************************/
    function _serverMsgConfig(oMeta) {
        if (!oMeta.MSGCLS || Array.isArray(oMeta.MSGCLS) === false) {
            oMeta.MSGCLS = [];
        }
        let oUserInfo = parent.getUserInfo();
        let sLoginLangu = oUserInfo.LANGU;
        let oSettingsInfo = oAPP.fn.fnGetSettingsInfo();
        let oPath = oSettingsInfo.path;
        let sLanguPath = parent.PATH.join(oPath.WSMSG_ROOT, "WS_MSG", sLoginLangu, "U4AMSG_WS.json");
        if (parent.FS.existsSync(sLanguPath) === false) { return; }
        try {
            var sMsgStr = parent.FS.readFileSync(sLanguPath, "utf8");
            var aServMsg = JSON.parse(sMsgStr);
        } catch (error) {
            return;
        }
        oMeta.MSGCLS = aServMsg;
    } // end of _serverMsgConfig

    /************************************************************************
     * 기본 실행 브라우저 목록을 구한다.
     ************************************************************************/
    oAPP.fn.getDefaultBrowserInfo = () => {
        let oSettingsInfo = parent.getSettingsInfo();
        return oSettingsInfo.aBrowserInfo;
    };

    /************************************************************************
     * 현재 PC에 설치되어 있는 브라우저 설치 경로를 구한다.
     ************************************************************************/
    oAPP.fn.fnCheckIstalledBrowser = () => {
        return new Promise((resolve) => {
            var aDefaultBrowsers = oAPP.fn.getDefaultBrowserInfo(),
                iBrowsCnt = aDefaultBrowsers.length;
            var aPromise = [];
            for (var i = 0; i < iBrowsCnt; i++) {
                aPromise.push(oAPP.fn.fnGetBrowserInfoPromise(aDefaultBrowsers, i));
            }
            Promise.all(aPromise).then((aValues) => {
                parent.setDefaultBrowserInfo(aValues);
                resolve();
            });
        });
    }; // end of fnCheckIstalledBrowser

    /************************************************************************
     * 레지스트리를 확인하여 각 브라우저별 설치 경로를 구한다.
     ************************************************************************/
    oAPP.fn.fnGetBrowserInfoPromise = (aDefaultBrowsers, index) => {
        var oDefBrows = aDefaultBrowsers[index],
            sRegPath = oDefBrows.REGPATH,
            sRegPath2 = oDefBrows.REGPATH2;
        return new Promise(async (resolve) => {
            let oRETURN = Object.assign({}, aDefaultBrowsers[index]);
            if (!sRegPath && !sRegPath2) { resolve(oRETURN); return; }
            let oBrowsInstResult = await parent.WSUTIL.getRegeditList([sRegPath, sRegPath2]);
            if (oBrowsInstResult.RETCD == "E") { resolve(oRETURN); return; }
            let oBrowsInstData = oBrowsInstResult.RTDATA,
                oCheckHKCU = oBrowsInstData[sRegPath2];
            if (oCheckHKCU.exists) {
                var oExePathObj = oCheckHKCU.values[""];
                if (oExePathObj != null) { oRETURN.INSPATH = oExePathObj.value; resolve(oRETURN); return; }
            }
            let oCheckHKLM = oBrowsInstData[sRegPath];
            if (oCheckHKLM.exists) {
                var oExePathObj2 = oCheckHKLM.values[""];
                if (oExePathObj2 != null) { oRETURN.INSPATH = oExePathObj2.value; resolve(oRETURN); return; }
            }
            resolve(oRETURN);
        });
    }; // end of fnGetBrowserInfoPromise

    /************************************************************************
     * WS의 설정 정보를 구한다.
     ************************************************************************/
    oAPP.fn.fnGetSettingsInfo = () => {
        return WSUTIL.getWsSettingsInfo();
    }; // end of fnGetSettingsInfo

    /************************************************************************
     * 테마 적용 (UI5 applyTheme 대체 — U4ATheme + 브라우저 배경색)
     ************************************************************************/
    oAPP.fn.fnApplyTheme = (oThemeInfo) => {
        try {
            if (oThemeInfo && oThemeInfo.THEME && window.U4ATheme) {
                // apply() 가 활성 테마 CSS 보장 로드 + data-theme 전환을 함께 처리
                window.U4ATheme.apply(oThemeInfo.THEME);
            }
            if (oThemeInfo && oThemeInfo.BGCOL) {
                const sCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
                REMOTE.getCurrentWindow().webContents.insertCSS(sCss);
            }
        } catch (e) { /* 기본 테마 유지 */ }
    };

    /************************************************************************
     * ───────────────────────── 렌더링 (UI5 → HTML5) ───────────────────
     * doc 02 §8(B-1): App/Page/Card/Form/Input/Select/CheckBox/Button/Bar →
     *   순수 HTML5 요소 + CSS Grid/Flex. shell.css 컴포넌트 클래스 소비.
     ************************************************************************/
    oAPP.fn.fnOnInitRendering = () => {

        const oContent = document.getElementById("content");
        oContent.innerHTML = "";

        const sLogo = _toFileUrl(PATHINFO.WS_LOGO);

        // ── 1) 타이틀바는 그리지 않는다 — 호스트(vw_main)의 최상위 헤더 사용 ──
        //   ★ 창 드래그 근본 해결: 로그인은 iframe 안에 있고, iframe 내부의
        //     -webkit-app-region:drag 영역은 창 리사이즈를 반복하면 Chromium 이
        //     hit-test 영역을 재계산하지 못해 드래그가 먹통된다(레이아웃/컴포지팅 차원,
        //     JS 로직 드래그로도 근본 해결 안 됨). 따라서 로그인은 자체 타이틀바를
        //     그리지 않고 "콘텐츠 전용"으로 두고, 창 크롬(로고/제목/min·max·close/드래그)은
        //     최상위 문서 헤더(.u4aFrameHeader)가 담당한다. 호스트(control.js _loadLoginPage)
        //     가 그 헤더를 표시하고 제목을 "U4A Workspace - Login" 으로 설정한다.
        //     (참고: u4a-ws-40 커밋 7e7f98d "공통 헤더 단일화 + 창 드래그 근본 해결")

        // ── 2) 본문(중앙 정렬) + 로그인 카드 ──
        const oMain = document.createElement("main");
        oMain.className = "u4a-login__main";

        const oCard = document.createElement("section");
        // Bootstrap .card(브리지로 토큰 색) + 로그인 전용 레이아웃(.u4a-login__card)
        oCard.className = "card u4a-login__card u4aWsLoginFormFcard";

        // 카드 헤더 (sap.f.cards.Header 대체)
        const oCardHead = document.createElement("header");
        oCardHead.className = "u4a-login__card-head";
        oCardHead.innerHTML =
            `<img class="u4a-login__card-logo" src="${sLogo}" alt="U4A">` +
            `<h1 class="u4a-login__card-title">U4A Workspace Login</h1>`;
        oCard.appendChild(oCardHead);

        // 폼 (sap.ui.layout.form.Form 대체)
        const oForm = document.createElement("form");
        oForm.id = "loginForm";
        oForm.className = "u4a-form u4a-login__form";
        oForm.autocomplete = "off";
        oForm.addEventListener("submit", (e) => { e.preventDefault(); });

        oForm.appendChild(_buildField({
            label: "CLIENT",
            ctrl: `<div class="u4a-login__field u4a-field" data-trail="1">` +
                `<input id="ws_client" class="u4a-input u4a-field__input" type="number" inputmode="numeric" maxlength="3" autocomplete="off">` +
                `<button type="button" class="u4a-login__clear u4a-field__clear" data-clear="ws_client" title="Clear" aria-label="Clear" tabindex="-1">${ICON.clear}</button>` +
                `</div>`,
            id: "ws_client"
        }));

        oForm.appendChild(_buildField({
            label: "ID",
            ctrl: `<div class="u4a-login__field u4a-field" data-trail="1">` +
                `<input id="ws_id" class="u4a-input u4a-field__input" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false">` +
                `<button type="button" class="u4a-login__clear u4a-field__clear" data-clear="ws_id" title="Clear" aria-label="Clear" tabindex="-1">${ICON.clear}</button>` +
                `</div>`,
            id: "ws_id"
        }));

        oForm.appendChild(_buildField({
            label: "PASSWORD",
            ctrl: `<div class="u4a-login__pw u4a-field" data-trail="2">` +
                `<input id="ws_pw" class="u4a-input u4a-field__input" type="password" autocomplete="off">` +
                `<button type="button" class="u4a-login__clear u4a-field__clear" data-clear="ws_pw" title="Clear" aria-label="Clear" tabindex="-1">${ICON.clear}</button>` +
                `<button type="button" id="ws_pw_toggle" class="u4a-login__pw-toggle u4a-field__pw" title="Show / Hide" tabindex="-1">${ICON.eye}</button>` +
                `</div>`,
            id: "ws_pw"
        }));

        // LANGUAGE — 직접 입력 (기본 hidden)
        oForm.appendChild(_buildField({
            label: "LANGUAGE",
            rowId: "ws_langu_input_form",
            hidden: true,
            ctrl: `<div class="u4a-login__field u4a-field" data-trail="1">` +
                `<input id="ws_langu" class="u4a-input u4a-field__input" type="text" maxlength="2" autocomplete="off">` +
                `<button type="button" class="u4a-login__clear u4a-field__clear" data-clear="ws_langu" title="Clear" aria-label="Clear" tabindex="-1">${ICON.clear}</button>` +
                `</div>`,
            id: "ws_langu"
        }));

        // LANGUAGE — 커스텀 콤보 (네이티브 <select> 대체, ServerList 와 동일 UX, 기본 hidden)
        oForm.appendChild(_buildField({
            label: "LANGUAGE",
            rowId: "ws_langu_select_form",
            hidden: true,
            ctrl: `<div id="ws_langu_select_host"></div>`,
            id: "ws_langu_select_host"
        }));

        // Workspace Language — 커스텀 콤보 (ServerList 와 동일 UX)
        oForm.appendChild(_buildField({
            label: "Workspace Language",
            ctrl: `<div id="ws_wslangu_host"></div>`,
            id: "ws_wslangu_host"
        }));

        // Remember (Bootstrap form-check — 체크색은 브리지가 accent 로 입힘)
        const oRemRow = document.createElement("div");
        oRemRow.className = "form-check u4a-login__remember";
        oRemRow.innerHTML =
            `<input id="ws_rem" type="checkbox" class="form-check-input">` +
            `<label class="form-check-label u4a-label" for="ws_rem">Remember</label>`;
        oForm.appendChild(oRemRow);

        oCard.appendChild(oForm);

        // 로그인 버튼 (sap.m.Button Emphasized 대체)
        const oLoginBtn = document.createElement("button");
        oLoginBtn.id = "ws_loginBtn";
        oLoginBtn.type = "button";
        oLoginBtn.className = "btn btn-primary u4a-login__btn";
        oLoginBtn.textContent = "LOGIN";
        oLoginBtn.addEventListener("click", () => oAPP.events.ev_login());
        oCard.appendChild(oLoginBtn);

        // R&D Staff 자동 로그인 버튼 (RND 서버일 때만)
        try {
            const oServerInfo = parent.getServerInfo();
            if (parent.isU4A_RND_SERVER && parent.isU4A_RND_SERVER(oServerInfo.SYSID)) {
                oCard.appendChild(oAPP.fn.fnGetStaffLoginButtons());
            }
        } catch (e) { /* RND 아님 */ }

        oMain.appendChild(oCard);

        // ── 3) 푸터 (sap.m.Toolbar footer 대체) ──
        const oFooter = document.createElement("footer");
        oFooter.className = "u4a-bar u4a-login__footer";
        oFooter.innerHTML =
            `<span>Copyright 2022. Infocg inc. all rights reserved.</span>` +
            `<span class="u4a-bar__spacer"></span>` +
            `<span id="ws_footer_sysid">SYSID: </span>`;

        // 타이틀바 없음(호스트 최상위 헤더 사용) → 본문 + 푸터만 마운트
        oContent.appendChild(oMain);
        oContent.appendChild(oFooter);

        // ── 이벤트 바인딩 (모델 동기화 / 단축키 / 비밀번호 토글 / CapsLock) ──
        _attachFormEvents();

    }; // end of oAPP.fn.fnOnInitRendering

    /** 폼 한 줄(label + control + 검증 메시지) 빌드 */
    function _buildField(o) {
        const oRow = document.createElement("div");
        oRow.className = "u4a-form__row";
        if (o.rowId) { oRow.id = o.rowId; }
        if (o.hidden) { oRow.hidden = true; }
        oRow.innerHTML =
            `<label class="u4a-label" for="${o.id}">${o.label}</label>` +
            o.ctrl +
            `<div class="u4a-field__msg" id="${o.id}_msg"></div>`;
        return oRow;
    }

    // 클리어(X) 버튼 동기화 함수 모음 — 모델 → 입력 렌더 후 채움 상태 갱신용
    const aClearSyncs = [];

    /**
     * 입력값 클리어(X) 버튼 부착 — 값이 있으면 노출(.data-filled), 클릭 시 비운다.
     * (UI5 Input showClearIcon 대체) 비밀번호처럼 추가 버튼이 있는 래퍼도 지원.
     * @param {string} sInputId 대상 입력 id
     */
    function _attachClear(sInputId) {
        const oInput = document.getElementById(sInputId);
        if (!oInput) { return; }
        const oWrap = oInput.closest(".u4a-login__field, .u4a-login__pw");
        const oClear = oWrap && oWrap.querySelector(".u4a-login__clear");
        if (!oWrap || !oClear) { return; }

        const _sync = () => { oWrap.dataset.filled = oInput.value ? "true" : "false"; };
        oInput.addEventListener("input", _sync);
        // mousedown preventDefault → 클릭해도 입력 포커스 유지
        oClear.addEventListener("mousedown", (ev) => ev.preventDefault());
        oClear.addEventListener("click", () => {
            oInput.value = "";
            // input 이벤트로 모델 동기화/자동완성/채움상태를 한 번에 갱신
            oInput.dispatchEvent(new Event("input", { bubbles: true }));
            oInput.focus();
        });
        aClearSyncs.push(_sync);
        _sync();
    }

    /** 모델→입력 렌더(프로그램 set) 후 클리어 버튼 노출 상태 재계산 */
    function _refreshClearButtons() { aClearSyncs.forEach((fn) => fn()); }

    /** 입력 필드 ↔ 모델 동기화 및 키 이벤트 */
    function _attachFormEvents() {

        const oClient = document.getElementById("ws_client");
        const oId = document.getElementById("ws_id");
        const oPw = document.getElementById("ws_pw");
        const oLangu = document.getElementById("ws_langu");
        const oRem = document.getElementById("ws_rem");

        const _set = (sPath, val) => oModel.setProperty(sPath, val);

        oClient.addEventListener("input", () => _set("/LOGIN/CLIENT", oClient.value));
        oId.addEventListener("input", () => _set("/LOGIN/ID", oId.value));
        oPw.addEventListener("input", () => _set("/LOGIN/PW", oPw.value));
        oLangu.addEventListener("input", () => _set("/LOGIN/LANGU", oLangu.value));
        oLangu.addEventListener("change", () => {
            oLangu.value = (oLangu.value || "").toUpperCase();
            _set("/LOGIN/LANGU", oLangu.value);
        });
        // 언어 콤보(ws_langu_select / ws_wslangu)의 값 변경은 _createSelect 콜백에서 모델에 반영한다.
        oRem.addEventListener("change", () => _set("/LOGIN/REMEMBER", oRem.checked));

        // 입력값 클리어(X) 버튼 (UI5 showClearIcon 대체) — CLIENT/ID/PASSWORD/LANGUAGE(직접입력)
        ["ws_client", "ws_id", "ws_pw", "ws_langu"].forEach(_attachClear);

        // ID 자동완성 — 네이티브 <datalist> 대체(테마 드롭다운). Enter 로그인 핸들러보다
        // 먼저 등록해, 목록이 열린 상태의 Enter 는 선택으로 소비(stopImmediatePropagation)한다.
        window.U4AUI.attachSuggest(oId, () => (oModel.getProperty("/LOGIN/IDSUGG") || []).map((o) => o.ID), (sVal) => _set("/LOGIN/ID", sVal));

        // Enter → 로그인 (CLIENT/ID/PW/LANGU)
        [oClient, oId, oPw, oLangu].forEach((el) => {
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); oAPP.events.ev_login(); }
            });
        });

        // 비밀번호 보이기/숨기기 토글 (showValueHelp 대체)
        document.getElementById("ws_pw_toggle").addEventListener("click", () => {
            const bPw = oPw.type === "password";
            oPw.type = bPw ? "text" : "password";
            document.getElementById("ws_pw_toggle").innerHTML = bPw ? ICON.eyeSlash : ICON.eye;
        });

        // CapsLock 감지 (Information ValueState 대체)
        const _caps = (e) => {
            _fnClearFieldState("ws_pw");
            if (e.getModifierState && e.getModifierState("CapsLock")) {
                _fnSetFieldState("ws_pw", "information", "Caps lock is switched on.");
            }
        };
        oPw.addEventListener("keydown", _caps);
        oPw.addEventListener("mousedown", _caps);
        oPw.addEventListener("focusout", () => {
            _set("/LOGIN/PW", oPw.value);
            _fnClearFieldState("ws_pw");
        });
    }

    /** 필드 ValueState 설정 (UI5 setValueState 대체) */
    function _fnSetFieldState(sId, sState, sMsg) {
        const oEl = document.getElementById(sId);
        const oMsg = document.getElementById(sId + "_msg");
        if (oEl) { oEl.dataset.vs = (sState === "error") ? "error" : ""; }
        if (oMsg) { oMsg.textContent = sMsg || ""; oMsg.dataset.vs = sState || ""; }
    }
    function _fnClearFieldState(sId) {
        const oEl = document.getElementById(sId);
        const oMsg = document.getElementById(sId + "_msg");
        if (oEl) { oEl.dataset.vs = ""; }
        if (oMsg) { oMsg.textContent = ""; oMsg.dataset.vs = ""; }
    }

    /** 모델 → 입력 필드 렌더 (초기/리프레시) */
    oAPP.fn.fnRenderLoginFields = () => {
        const oLogin = oModel.getProperty("/LOGIN") || {};

        const _v = (id, val) => { const el = document.getElementById(id); if (el && document.activeElement !== el) { el.value = val == null ? "" : val; } };
        _v("ws_client", oLogin.CLIENT);
        _v("ws_id", oLogin.ID);
        _v("ws_pw", oLogin.PW);
        _v("ws_langu", oLogin.LANGU);

        // 프로그램으로 값을 채운 뒤 클리어(X) 버튼 노출 상태 갱신
        _refreshClearButtons();

        // ID Suggestion 은 커스텀 드롭다운(_attachSuggest)이 모델 IDSUGG 를 직접 읽어 표시.

        // Workspace Language 콤보 (모델 WSLANGU 가 비었으면 렌더된 선택값으로 동기화)
        _fnFillCombo("ws_wslangu_host", "ws_wslangu", oLogin.T_WSLANGU, "KEY", "VALUE", oLogin.WSLANGU, "/LOGIN/WSLANGU");
        const oWsLanguSel = oCombos["ws_wslangu"];
        if (oWsLanguSel && !oLogin.WSLANGU && oWsLanguSel.value) {
            oModel.setProperty("/LOGIN/WSLANGU", oWsLanguSel.value);
        }
        // SAP Language 콤보
        _fnFillCombo("ws_langu_select_host", "ws_langu_select", oLogin.T_LANGU, "KEY", "LANGU", oLogin.LANGU, "/LOGIN/LANGU");

        const oRem = document.getElementById("ws_rem");
        if (oRem) { oRem.checked = !!oLogin.REMEMBER; }

        const oSysid = document.getElementById("ws_footer_sysid");
        if (oSysid) { oSysid.textContent = "SYSID: " + (oLogin.SYSID || ""); }
    };

    /**
     * 호스트 컨테이너에 커스텀 콤보를 생성/재생성하고 모델과 연결한다.
     * (ServerList 의 _createSelect 와 동일한 테마 콤보 — 펼침 목록까지 테마 적용)
     * @param {string} sHostId   콤보를 담을 컨테이너 id
     * @param {string} sComboId  콤보 인스턴스 식별자(oCombos 키)
     * @param {Array}  aItems    원본 항목 배열
     * @param {string} sKey      값 필드명
     * @param {string} sText     표시 텍스트 필드명
     * @param {*}      sSelected 초기 선택값
     * @param {string} sModelPath 값 변경 시 갱신할 모델 경로
     */
    function _fnFillCombo(sHostId, sComboId, aItems, sKey, sText, sSelected, sModelPath) {
        const oHost = document.getElementById(sHostId);
        if (!oHost) { return; }

        const aOpt = (aItems || []).map((o) => ({
            value: o[sKey],
            text: (o[sText] != null ? o[sText] : o[sKey])
        }));

        // 네이티브 <select> 와 동일하게: 선택값이 목록에 없으면 첫 항목으로 폴백
        const bHas = sSelected != null && sSelected !== "" && aOpt.some(o => o.value === sSelected);
        const sInit = bHas ? sSelected : (aOpt[0] ? aOpt[0].value : "");

        const oCombo = window.U4AUI.createSelect(aOpt, sInit, (sVal) => {
            oModel.setProperty(sModelPath, sVal);
        });
        oCombo.id = sComboId;

        oHost.innerHTML = "";
        oHost.appendChild(oCombo);
        oCombos[sComboId] = oCombo;
    }

    /************************************************************************
     * U4A R&D Staff 자동 로그인 버튼
     ************************************************************************/
    oAPP.fn.fnGetStaffLoginButtons = () => {
        const oWrap = document.createElement("div");
        oWrap.className = "u4a-login__staff";
        const aStaff = [
            { text: "영선", id: "yshong" },
            { text: "성호", id: "shhong" },
            { text: "은섭", id: "pes" },
            { text: "청윤", id: "soccerhs" }
        ];
        aStaff.forEach((o) => {
            const oBtn = document.createElement("button");
            oBtn.type = "button";
            oBtn.className = "btn btn-outline-secondary btn-sm";
            oBtn.textContent = o.text;
            oBtn.addEventListener("click", () => oAPP.fn.fnStaffLogin(o.id));
            oWrap.appendChild(oBtn);
        });
        return oWrap;
    };

    oAPP.fn.fnStaffLogin = (sStaffID) => {
        const oId = document.getElementById("ws_id"),
            oPw = document.getElementById("ws_pw");
        oId.value = sStaffID;
        oModel.setProperty("/LOGIN/ID", sStaffID);
        let sPw = "";
        switch (sStaffID) {
            case "yshong": sPw = "1qazxsw2"; break;
            case "shhong": sPw = "2wsxzaq1!"; break;
            case "pes": sPw = "dmstjq8!"; break;
            case "soccerhs": sPw = "cjddbs12"; break;
        }
        oPw.value = sPw;
        oModel.setProperty("/LOGIN/PW", sPw);
        oAPP.events.ev_login();
    }; // end of fnStaffLogin

    /************************************************************************
     * 로그인 페이지 초기 모델 바인딩
     ************************************************************************/
    oAPP.fn.fnOnInitModelBinding = () => {

        let oUserInfo = parent.getUserInfo(),
            oServerInfo = parent.getServerInfo(),
            bIsRemember = oAPP.fn.fnGetRememberCheck(),
            oRememberInfo = oAPP.fn.fnGetRememberLoginInfo();

        if (oUserInfo) {
            parent.setUserInfo(null);
            parent.setServerInfo(parent.getBeforeServerInfo());
            oServerInfo = parent.getServerInfo();
        }

        let sClient = (bIsRemember ? (oRememberInfo && oRememberInfo.CLIENT) || "" : oServerInfo.CLIENT);
        let sLangu = (bIsRemember ? (oRememberInfo && oRememberInfo.LANGU) || "" : oServerInfo.LANGU);
        let sId = (bIsRemember ? (oRememberInfo && oRememberInfo.ID) || "" : "");
        let sWsLangu = (bIsRemember ? (oRememberInfo && oRememberInfo.WSLANGU) || "" : "");

        let oLoginData = {
            CLIENT: sClient,
            ID: sId,
            PW: "",
            LANGU: sLangu,
            SYSID: oServerInfo.SYSID,
            WSLANGU: sWsLangu,
            T_WSLANGU: [
                { KEY: "EN", VALUE: "EN" },
                { KEY: "KO", VALUE: "KO" }
            ],
            T_LANGU: [],
            REMEMBER: bIsRemember,
            IDSUGG: [],
            SERVER_SETTINGS: oServerInfo.SETTINGS
        };

        let oBusyPop = {
            TITLE: "Checking for updates...",
            DESC: "　",
            ILLUSTTYPE: "sapIllus-BeforeSearch",
            PROGVISI: false,
            PERVALUE: 0,
            PROGTXT: "Downloading",
            ANIMATION: true
        };

        oLoginData.IDSUGG = oAPP.fn.fnReadIDSuggData();

        oModel.setData({
            LOGIN: oLoginData,
            BUSYPOPINIT: _deepClone(oBusyPop),
            BUSYPOP: oBusyPop
        });

        oAPP.fn.fnRenderLoginFields();

    }; // end of fnOnInitModelBinding

    /************************************************************************
     * 로그인 버튼 클릭 — 인증/세션 흐름 보존 (doc 02 §9.4)
     ************************************************************************/
    oAPP.events.ev_login = (oPARAM) => {

        parent.setDomBusy('X');

        let oLogInData = oModel.getProperty("/LOGIN");
        if (oLogInData == null) {
            parent.setDomBusy("");
            _showContentDom("X");
            return;
        }

        // SSO 로그인 처리가 아닐 경우에만 로그인 입력값 체크를 수행 한다.
        if (typeof oPARAM?.SSO_TICKET === "undefined") {
            var oResult = oAPP.fn.fnLoginCheck(oLogInData.ID, oLogInData.PW, oLogInData.CLIENT, oLogInData.LANGU);
            if (oResult.RETCD == 'E') {
                oAPP.fn.showToast(oResult.MSG);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }
        }

        // Remember / ID Suggestion 저장
        oAPP.fn.fnSaveRemember(oLogInData);
        oAPP.fn.fnSaveIDSuggData(oLogInData.ID);

        let oSettings = WSUTIL.getWsSettingsInfo();
        var sServicePath = parent.getServerPath() + "/wsloginchk";
        var oFormData = new FormData();

        if (typeof oPARAM?.SSO_TICKET === "undefined") {
            oFormData.append("sap-user", oLogInData?.ID);
            oFormData.append("sap-password", oLogInData?.PW);
            oFormData.append("sap-client", oLogInData?.CLIENT);
        }

        oFormData.append("sap-language", oLogInData?.LANGU);
        oFormData.append("SYSID", oLogInData?.SYSID);
        oFormData.append("WSVER", oSettings.appVersion);
        oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);
        oFormData.append("PRCCD", "00");
        oFormData.append("ACTCD", "001");

        var oPwInput = document.getElementById("ws_pw");
        var xhr = new XMLHttpRequest();

        xhr.onload = async function (e) {

            let u4a_status = xhr.getResponseHeader("u4a_status");
            if (u4a_status) {
                try {
                    JSON.parse(xhr.response);
                } catch (error) {
                    console.error(error);
                    let sErrMsg = oAPP.msg.M295 + "\n\n" + oAPP.msg.M290;
                    _openLoginErrorDialog({ TITLE: oAPP.msg.M417, DESC: sErrMsg });
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            var oResult;
            try {
                oResult = JSON.parse(xhr.response);
                oResult.SERVER_SETTINGS = oLogInData.SERVER_SETTINGS;
            } catch (error) {
                console.error(error);
                _openLoginErrorDialog({ TITLE: oAPP.msg.M417, DESC: oAPP.msg.M081 });
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            if (oResult.TYPE === "E") {

                if (oPwInput) { oPwInput.value = ""; oModel.setProperty("/LOGIN/PW", ""); }

                // Change Password 안내
                if (oResult.RCODE === "R001") {
                    oAPP.fn.fnMessageBox("W", oAPP.msg.M082);
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }

                // 권한 점검 오류 → 권한 오류 리스트 팝업
                var _called = await oAPP.fn.fnCallAuthErrorListPopup(oResult);
                if (_called === true) {
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }

                var sMsg = "";
                let sCriticalErrMsg = oAPP.msg.M295 + "\n" + oAPP.msg.M290;
                let sSTCOD = oResult?.STCOD || "";
                if (sSTCOD) {
                    sMsg = `[ Error code: ${sSTCOD} ]\n${sCriticalErrMsg}`;
                } else {
                    sMsg = oResult.MSG;
                }
                oAPP.fn.fnMessageBox("E", sMsg);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            // 로그인 성공 — 권한/라이선스/버전 체크
            oAPP.attr.HTTPONLY = oResult.HTTP_ONLY;
            oAPP.attr.LOGIN = oLogInData;
            oAPP.attr.LOGIN_INFO = oResult;

            try {
                var oAuthInfo = await oAPP.fn.fnCheckAuthority();
                if (oAuthInfo?.TYPE === "E") {
                    oAPP.fn.fnMessageBox("E", oAuthInfo.MSG);
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }
            } catch (err) {
                console.error(err);
                oAPP.fn.fnShowNoAuthIllustMsg(err);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
                bIsTrial = oWsSettings.isTrial,
                bIsPackaged = APP.isPackaged;

            oAuthInfo.IS_TRIAL = bIsTrial;

            // no build 혹은 Trial 이면 최신 버전 체크 생략
            if (!bIsPackaged || bIsTrial) {
                oAPP.fn.fnCheckVersionFinished(oResult, oAuthInfo);
                return;
            }

            oAPP.fn.fnCheckAuthSuccess(oResult, oAuthInfo);

        }; // end of xhr.onload

        function _onError(ev) {
            console.error(ev);
            if (ev.type === "timeout") {
                oAPP.fn.fnMessageBox("E", oAPP.msg.M294);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }
            let sErrMsg = oAPP.msg.M283;
            if (xhr.response == "") {
                oAPP.fn.fnMessageBox("E", sErrMsg);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }
            var sCleanHtml = parent.setCleanHtml(xhr.response);
            parent.showMessage(null, 99, "E", sCleanHtml);
            parent.setDomBusy("");
            _showContentDom("X");
        }

        xhr.onerror = _onError;
        xhr.ontimeout = _onError;
        xhr.open('POST', sServicePath);
        xhr.withCredentials = true;
        xhr.send(oFormData);

    }; // end of ev_login

    /************************************************************************
     * 권한 오류 리스트 팝업 (sap.ui.table.Table → HTML5 table dialog)
     ************************************************************************/
    oAPP.fn.fnCallAuthErrorListPopup = (oRes) => {
        return new Promise(async (resolve) => {

            if (oRes?.TYPE !== "E") { return resolve(); }

            let T_AUTH = oRes?.T_AUTH || oRes?.META?.T_AUTH || [];
            if (!T_AUTH || Array.isArray(T_AUTH) === false || T_AUTH.length === 0) {
                return resolve();
            }

            var _SYSID = oModel.getProperty("/LOGIN/SYSID");
            var _found1 = await WSUTIL.checkWLOListAsync(_SYSID, "C", "UHAK900697");
            let aREG_WLO = oRes?.META?.T_REG_WLO || [];
            var _found2 = _checkWLOListAsync(aREG_WLO, "C", "UHAK900697");

            if (_found1 === false && _found2 === false) {
                return resolve();
            }

            let oDlg = document.createElement("dialog");
            oDlg.className = "u4a-dialog u4a-login__authdlg";

            const oHead = document.createElement("div");
            oHead.className = "u4a-dialog__header";
            oHead.innerHTML = `<span>Authorization Error</span><span class="u4a-bar__spacer"></span>`;
            const oCloseBtn = document.createElement("button");
            oCloseBtn.className = "u4a-btn-icon";
            oCloseBtn.innerHTML = ICON.close;
            oCloseBtn.addEventListener("click", () => { oDlg.close(); oDlg.remove(); resolve(true); });
            oHead.appendChild(oCloseBtn);

            const oBody = document.createElement("div");
            oBody.className = "u4a-dialog__body";

            const oMsg = document.createElement("div");
            oMsg.className = "u4a-login__authdlg-msg";
            oMsg.textContent = oRes.MSG || "";
            oBody.appendChild(oMsg);

            const oTable = document.createElement("table");
            oTable.className = "u4a-table";
            oTable.innerHTML =
                `<thead><tr>` +
                `<th>Auth. Object</th><th>Description</th><th>Field</th><th>Value</th>` +
                `</tr></thead>`;
            const oTbody = document.createElement("tbody");
            T_AUTH.forEach((o) => {
                const oTr = document.createElement("tr");
                oTr.innerHTML =
                    `<td>${_esc(o.OBJECT)}</td><td>${_esc(o.TTEXT)}</td>` +
                    `<td>${_esc(o.ACTVT)}</td><td>${_esc(o.FIELD)}</td>`;
                oTbody.appendChild(oTr);
            });
            oTable.appendChild(oTbody);
            oBody.appendChild(oTable);

            const oFoot = document.createElement("div");
            oFoot.className = "u4a-dialog__footer";
            const oOk = document.createElement("button");
            oOk.className = "u4a-btn u4a-btn--negative"; // 닫기 — Reject 느낌
            oOk.textContent = "Close";
            oOk.addEventListener("click", () => { oDlg.close(); oDlg.remove(); resolve(true); });
            oFoot.appendChild(oOk);

            oDlg.appendChild(oHead);
            oDlg.appendChild(oBody);
            oDlg.appendChild(oFoot);
            document.body.appendChild(oDlg);
            oDlg.showModal();
        });
    }; // end of fnCallAuthErrorListPopup

    function _esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    /************************************************************************
     * 개발 권한 체크 (XHR 유지)
     ************************************************************************/
    oAPP.fn.fnCheckAuthority = () => {
        return new Promise((resolve, reject) => {
            var sServicePath = parent.getServerPath() + "/chk_u4a_authority";
            var oFormData = new FormData();
            let oSettings = WSUTIL.getWsSettingsInfo();
            oFormData.append("WSVER", oSettings.appVersion);
            oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === xhr.DONE) {
                    if (xhr.status === 200 || xhr.status === 201) {
                        var oResult;
                        try {
                            oResult = JSON.parse(xhr.response);
                            console.log("## 개발 권한 결과!!", oResult);
                        } catch (error) {
                            console.error("개발 권한 체크시 JSON parse error", error);
                            var sCleanHtml = parent.setCleanHtml(xhr.response);
                            parent.showMessage(null, 99, "E", sCleanHtml);
                            parent.setDomBusy("");
                            return;
                        }
                        if (oResult.ISLICEN == "") { reject(oResult.RTMSG); return; }
                        if (oResult.DEV_KEY == "") { reject(oResult.RTMSG); return; }
                        resolve(oResult);
                    } else {
                        parent.showMessage(null, 99, "E", xhr.response);
                        parent.setDomBusy("");
                    }
                }
            };
            xhr.open('POST', sServicePath);
            xhr.withCredentials = true;
            xhr.send(oFormData);
        });
    }; // end of fnCheckAuthority

    /************************************************************************
     * 개발자 권한 체크 성공시 수행
     ************************************************************************/
    oAPP.fn.fnCheckAuthSuccess = (oResult, oAuthInfo) => {
        var oResultData = { oResult: oResult, oAuthInfo: oAuthInfo };
        oAPP.fn.fnCheckCustomerLisence().then(oAPP.fn.fnCheckCustomerLisenceThen.bind(oResultData));
    };

    /************************************************************************
     * 고객사 라이센스 체크 (XHR 유지)
     ************************************************************************/
    oAPP.fn.fnCheckCustomerLisence = () => {
        return new Promise((resolve) => {
            var sServicePath = parent.getServerPath() + "/chk_customer_license";
            var oFormData = new FormData();
            let oSettings = WSUTIL.getWsSettingsInfo();
            oFormData.append("WSVER", oSettings.appVersion);
            oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState === xhr.DONE) {
                    if (xhr.status === 200 || xhr.status === 201) {
                        try {
                            resolve(JSON.parse(xhr.response));
                        } catch (error) {
                            console.error("고객사 라이센스 체크시 JSON parse error", error);
                            var sCleanHtml = parent.setCleanHtml(xhr.response);
                            parent.showMessage(null, 99, "E", sCleanHtml);
                            parent.setDomBusy("");
                            _showContentDom("X");
                        }
                    } else {
                        parent.showMessage(null, 99, "E", xhr.response);
                        parent.setDomBusy("");
                        _showContentDom("X");
                    }
                }
            };
            xhr.open('POST', sServicePath);
            xhr.withCredentials = true;
            xhr.send(oFormData);
        });
    }; // end of fnCheckCustomerLisence

    /************************************************************************
     * 고객사 라이센스 체크 성공
     ************************************************************************/
    oAPP.fn.fnCheckCustomerLisenceThen = function (oLicenseInfo) {
        if (oLicenseInfo.RETCD == "E") {
            console.error("고객사 라이센스 체크 후 오류", oLicenseInfo);
            oAPP.fn.fnShowNoAuthIllustMsg(oLicenseInfo.RTMSG);
            parent.setDomBusy('');
            _showContentDom("X");
            return;
        }
        var bIsCDN = parent.getIsCDN();
        if (bIsCDN == "X") {
            oAPP.fn.fnConnectionGithub().then(oAPP.fn.fnConnectionGithubThen.bind(this));
            return;
        }
        oAPP.fn.fnSetAutoUpdateForSAP(this).then(oAPP.fn.fnSetAutoUpdateForSAPThen.bind(this));
    }; // end of fnCheckCustomerLisenceThen

    //#region - 메이저 버전 체크 (SAP On-Premise — autoUpdaterSAP 유지)
    oAPP.fn.fnSetAutoUpdateForSAP = (oPARAM) => {
        return new Promise((resolve) => {

            autoUpdaterSAP.on('checking-for-update-sap', (e) => {
                console.log(e?.params?.message || "major update check...");
            });

            autoUpdaterSAP.on('update-available-sap', () => {
                _showContentDom("X");
                let oBusyPop = oModel.getProperty("/BUSYPOP");
                oBusyPop.PROGVISI = true;
                oBusyPop.PROGTXT = "Downloading";
                oModel.setProperty("/BUSYPOP", oBusyPop);
                _fnFadeLoginCard(0.3);
                oAPP.fn.fnVersionCheckDialogOpen();
                parent.setDomBusy("");
            });

            autoUpdaterSAP.on('update-not-available-sap', (e) => {
                let oParam = { ISCDN: "", oLoginInfo: oPARAM.oResult };
                let oVerInfo = e?.params?.verInfo;
                if (oVerInfo && oVerInfo.appVer === oVerInfo.updVER) {
                    oAPP.fn.fnCheckSupportPackageVersion(resolve, oParam);
                    return;
                }
                resolve();
            });

            autoUpdaterSAP.on('download-progress-sap', (e) => {
                var iToTal = e.params.TOTAL, iJobCnt = e.params.jobCnt,
                    iPerCnt = (iJobCnt / iToTal) * 100;
                var iPer = parseFloat(iPerCnt).toFixed(2);
                if (iPer >= 100) { iPer = 100; }
                oModel.setProperty("/BUSYPOP/TITLE", "Downloading...");
                oModel.setProperty("/BUSYPOP/PERVALUE", iPer);
            });

            autoUpdaterSAP.on('update-downloaded-sap', () => {
                oModel.setProperty("/BUSYPOP/TITLE", "Update Complete! Restarting...");
                oModel.setProperty("/BUSYPOP/ILLUSTTYPE", "sapIllus-SuccessHighFive");
                oModel.setProperty("/BUSYPOP/PERVALUE", 100);
                setTimeout(() => { autoUpdaterSAP.quitAndInstall(); }, 3000);
            });

            autoUpdaterSAP.on('update-error-sap', (e) => {
                _showContentDom("X");
                parent.setDomBusy("");
                let sErrMsg = e?.params?.message || "";
                let sMsg = oAPP.msg.M051 + "\n\n";
                if (sErrMsg !== "") { sMsg += sErrMsg + "\n\n"; }
                sMsg += oAPP.msg.M052 + "\n\n";
                sMsg += "RETRY: " + oAPP.msg.M055 + " " + oAPP.msg.M056 + "\n\n";
                sMsg += "CLOSE: " + oAPP.msg.M055 + " " + oAPP.msg.M056 + "\n\n";
                oAPP.fn.fnMessageBox("E", sMsg, {
                    title: oAPP.msg.M054,
                    initialFocus: "RETRY",
                    emphasizedAction: "RETRY",
                    actions: ["RETRY", "OpenLog", "CLOSE"],
                    onClose: function (action) {
                        switch (action) {
                            case "RETRY": APP.relaunch(); APP.exit(); return;
                            case "CLOSE": APP.exit(); return;
                            case "OpenLog": WSLOG.openLOG(true); APP.exit(); return;
                        }
                    }
                });
            });

            let oServerInfo = { HTTPONLY: oAPP.attr.HTTPONLY, LOGIN: oAPP.attr.LOGIN };
            let sVersion = REMOTE.app.getVersion();
            let oLoginInfo = oPARAM.oResult;
            oServerInfo.LOGIN.META = oLoginInfo.META;
            autoUpdaterSAP.checkForUpdates(sVersion, oServerInfo);
        });
    }; // end of fnSetAutoUpdateForSAP
    //#endregion

    oAPP.fn.fnSetAutoUpdateForSAPThen = function () {
        oAPP.fn.fnCheckVersionFinished(this.oResult, this.oAuthInfo);
    };

    function HexToStr(hex) {
        hex = hex.toString();
        var str = '';
        for (var i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return str;
    }

    /************************************************************************
     * Github 연결 시도 → on-premise / CDN 판별 (OCTOKIT 유지)
     ************************************************************************/
    oAPP.fn.fnConnectionGithub = () => {
        return new Promise((resolve) => {
            var oSettings = oAPP.fn.fnGetSettingsInfo(),
                oGitSettings = oSettings.GITHUB,
                sGitDevKey = oGitSettings.devKey,
                sLatestUrl = oGitSettings.latestUrl;
            const octokit = new OCTOKIT({ auth: HexToStr(sGitDevKey) });
            octokit.request(sLatestUrl, { org: "octokit", type: "Public" })
                .then(() => resolve({ ISCDN: "X" }))
                .catch((err) => { console.log(err); resolve({ ISCDN: "" }); });
        });
    };

    oAPP.fn.fnConnectionGithubThen = function (oReturn) {
        parent.setIsCDN(oReturn.ISCDN);
        if (oReturn.ISCDN != "X") {
            oAPP.fn.fnSetAutoUpdateForSAP(this).then(oAPP.fn.fnSetAutoUpdateForSAPThen.bind(this));
            return;
        }
        oAPP.fn.fnSetAutoUpdateForCDN(this).then(oAPP.fn.fnSetAutoUpdateForCDNThen.bind(this));
    };

    //#region - CDN 버전 체크 (electron-updater 유지)
    oAPP.fn.fnSetAutoUpdateForCDN = (oPARAM) => {
        return new Promise((resolve) => {

            autoUpdater.on('checking-for-update', () => console.log("CDN - 업데이트 확인 중..."));

            autoUpdater.on('update-available', () => {
                _showContentDom("X");
                let oBusyPop = oModel.getProperty("/BUSYPOP");
                oBusyPop.PROGVISI = true;
                oBusyPop.PROGTXT = "Downloading";
                oModel.setProperty("/BUSYPOP", oBusyPop);
                _fnFadeLoginCard(0.3);
                oAPP.fn.fnVersionCheckDialogOpen();
                parent.setDomBusy("");
            });

            autoUpdater.on('update-not-available', () => {
                let oParam = { ISCDN: "X", oLoginInfo: oPARAM.oResult };
                oAPP.fn.fnCheckSupportPackageVersion(resolve, oParam);
                parent.setIsCDN("");
            });

            autoUpdater.on('error', (err) => {
                _showContentDom("X");
                let sMsg = oAPP.msg.M051 + " \n " + oAPP.msg.M052 + " \n \n";
                sMsg += "RETRY: " + oAPP.msg.M055 + " " + oAPP.msg.M056 + " \n \n ";
                sMsg += "CLOSE: " + oAPP.msg.M055 + " " + oAPP.msg.M056 + " \n \n ";
                oAPP.fn.fnMessageBox("E", sMsg, {
                    title: oAPP.msg.M054,
                    initialFocus: "RETRY",
                    emphasizedAction: "RETRY",
                    actions: ["RETRY", "CLOSE"],
                    onClose: function (action) {
                        switch (action) {
                            case "RETRY": APP.relaunch(); APP.exit(); return;
                            case "CLOSE": APP.exit(); return;
                        }
                    }
                });
                console.log('CDN - 에러가 발생하였습니다. 에러내용 : ' + err);
            });

            autoUpdater.on('download-progress', (progressObj) => {
                var iPer = parseFloat(progressObj.percent).toFixed(2);
                oModel.setProperty("/BUSYPOP/TITLE", "Downloading...");
                oModel.setProperty("/BUSYPOP/PERVALUE", iPer);
            });

            autoUpdater.on('update-downloaded', () => {
                oModel.setProperty("/BUSYPOP/TITLE", "Update Complete! Restarting...");
                oModel.setProperty("/BUSYPOP/ILLUSTTYPE", "sapIllus-SuccessHighFive");
                setTimeout(() => { parent.setIsCDN(""); autoUpdater.quitAndInstall(); }, 3000);
            });

            autoUpdater.checkForUpdates();
        });
    };
    //#endregion

    oAPP.fn.fnSetAutoUpdateForCDNThen = function () {
        oAPP.fn.fnCheckVersionFinished(this.oResult, this.oAuthInfo);
    };

    /************************************************************************
     * 버전 체크 완료시
     ************************************************************************/
    oAPP.fn.fnCheckVersionFinished = (oResult, oAuthInfo) => {
        let oLogInData = oModel.getProperty("/LOGIN");
        oLogInData.ID = oResult.UNAME;
        oLogInData.CLIENT = oResult.MANDT;
        oModel.setProperty("/LOGIN", oLogInData);

        var oResultData = _deepClone(oResult);
        oResultData.USER_AUTH = oAuthInfo;

        parent.showLoadingPage("X");
        parent.setDomBusy("X");
        parent.CURRWIN.setTitle("U4A Workspace - Main");

        oAPP.fn.fnOnLoginSuccess(oResultData);
    }; // end of fnCheckVersionFinished

    /************************************************************************
     * Version Check Dialog (IllustratedMessage + ProgressIndicator 대체)
     ************************************************************************/
    oAPP.fn.fnVersionCheckDialogOpen = () => {
        let oDlg = document.getElementById("u4aWsVersionCheckDialog");
        if (oDlg) { if (!oDlg.open) { oDlg.showModal(); } _fnSyncVersionDialog(); return; }

        oDlg = document.createElement("dialog");
        oDlg.id = "u4aWsVersionCheckDialog";
        oDlg.className = "u4a-dialog u4a-login__verdlg";
        oDlg.innerHTML =
            `<div class="u4a-dialog__body u4a-login__verdlg-body">` +
            `<div class="u4a-login__verdlg-illust" id="u4aWsVerIllust"><div class="u4a-busy__spinner"></div></div>` +
            `<div class="u4a-login__verdlg-title" id="u4aWsVerTitle"></div>` +
            `<div class="u4a-login__verdlg-desc" id="u4aWsVerDesc"></div>` +
            `<progress class="u4a-login__verdlg-progress" id="u4aWsVerProgress" max="100" hidden></progress>` +
            `<div class="u4a-login__verdlg-pct" id="u4aWsVerPct" hidden></div>` +
            `</div>`;
        // esc 키 방지
        oDlg.addEventListener("cancel", (e) => e.preventDefault());
        document.body.appendChild(oDlg);
        oDlg.showModal();
        _fnSyncVersionDialog();
    }; // end of fnVersionCheckDialogOpen

    // /BUSYPOP 변경 시 다이얼로그 동기화 (모델 옵저버)
    function _fnSyncVersionDialog() {
        const oDlg = document.getElementById("u4aWsVersionCheckDialog");
        if (!oDlg) { return; }
        const o = oModel.getProperty("/BUSYPOP") || {};
        const _t = (id, v) => { const el = document.getElementById(id); if (el) { el.textContent = v == null ? "" : v; } };
        _t("u4aWsVerTitle", o.TITLE);
        _t("u4aWsVerDesc", o.DESC);
        const oProg = document.getElementById("u4aWsVerProgress");
        const oPct = document.getElementById("u4aWsVerPct");
        if (oProg) {
            oProg.hidden = !o.PROGVISI;
            if (o.ANIMATION === false || o.PROGVISI) { oProg.value = Number(o.PERVALUE) || 0; }
        }
        if (oPct) {
            oPct.hidden = !o.PROGVISI;
            oPct.textContent = (o.PROGTXT || "") + " " + (Number(o.PERVALUE) || 0) + "%";
        }
        const oIllust = document.getElementById("u4aWsVerIllust");
        if (oIllust) {
            const bDone = (o.ILLUSTTYPE === "sapIllus-SuccessHighFive");
            // 완료=성공 아이콘, 진행중=공통 busy 스피너(.u4a-busy__spinner, 셸/ServerList 와 동일 이중 링)
            oIllust.innerHTML = bDone ? ICON.success : '<div class="u4a-busy__spinner"></div>';
            oIllust.dataset.spin = bDone ? "false" : "true";
        }
    }
    oModel._observers["/BUSYPOP"] = _fnSyncVersionDialog;

    function _fnFadeLoginCard(opacity) {
        const oCard = document.querySelector(".u4aWsLoginFormFcard");
        if (oCard) { oCard.style.transition = "opacity .5s linear"; oCard.style.opacity = String(opacity); }
    }

    /************************************************************************
     * 권한 없음 Illustration Message Popup (HTML5 dialog)
     ************************************************************************/
    oAPP.fn.fnShowNoAuthIllustMsg = (sMsg) => {
        let oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4a-login__noauth";
        oDlg.innerHTML =
            `<div class="u4a-dialog__body u4a-login__noauth-body">` +
            `<div class="u4a-login__noauth-illust">${ICON.noauth}</div>` +
            `<div class="u4a-login__noauth-title">No Authority!</div>` +
            `<div class="u4a-login__noauth-desc"></div>` +
            `</div>` +
            `<div class="u4a-dialog__footer"></div>`;
        oDlg.querySelector(".u4a-login__noauth-desc").textContent = sMsg || "";
        oDlg.addEventListener("cancel", (e) => e.preventDefault());
        const oOk = document.createElement("button");
        oOk.className = "u4a-btn u4a-btn--emphasized";
        oOk.textContent = "OK";
        oOk.addEventListener("click", () => { oDlg.close(); oDlg.remove(); oAPP.events.ev_attachIllustMsgOkBtn(); });
        oDlg.querySelector(".u4a-dialog__footer").appendChild(oOk);
        document.body.appendChild(oDlg);
        oDlg.showModal();
        oOk.focus();
    };

    oAPP.events.ev_attachIllustMsgOkBtn = () => {
        oAPP.attr.isPressWindowClose = "X";
        REMOTE.getCurrentWindow().close();
    };

    /************************************************************************
     * 로그인 성공시 — 메타/유저/서버 정보 저장 후 WS30 메인 로드 (로직 보존)
     ************************************************************************/
    oAPP.fn.fnOnLoginSuccess = async (oResult) => {

        let oLogInData = oModel.getProperty("/LOGIN");
        if (oLogInData == null) { return; }

        var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
            bIsTrial = oWsSettings.isTrial,
            oTrialServerInfo = oWsSettings.trialServerInfo;

        if (bIsTrial) {
            oResult.META.HOST = `http://${oTrialServerInfo.SERVERIP}:80${oTrialServerInfo.INSTANCENO}`;
        } else {
            oAPP.fn.fnSaveRemember(oLogInData);
            oAPP.fn.fnSaveIDSuggData(oLogInData.ID);
        }

        var oUserInfo = Object.assign({}, oResult, oLogInData);
        var sAppVer = APP.getVersion();
        if (!APP.isPackaged) { sAppVer = oWsSettings.appVersion; }

        oUserInfo.WSVER = sAppVer;
        oUserInfo.WSPATCH_LEVEL = Number(oWsSettings.patch_level || 0);

        var oServerInfo = parent.getServerInfo();
        oServerInfo.WSVER = sAppVer;
        oServerInfo.WSPATCH_LEVEL = Number(oWsSettings.patch_level || 0);

        parent.setBeforeServerInfo(_deepClone(oServerInfo));

        oServerInfo.CLIENT = oUserInfo.CLIENT;
        oServerInfo.LANGU = oUserInfo.LANGU;
        parent.setServerInfo(oServerInfo);

        oUserInfo.LANGU = oUserInfo.WSLANGU;
        parent.setUserInfo(oUserInfo);

        if (oResult.META) {
            _serverMsgConfig(oResult.META);
            parent.setMetadata(oResult.META);
            if (oResult.META.T_REG_THEME) { await _registry_T_REG_THEME(oResult.META.T_REG_THEME); }
            if (oResult.META.T_REG_WLO) { await _registry_T_REG_WLO(oResult.META.T_REG_WLO); }
        }

        let oProcessUserInfo = {
            CLIENT: oUserInfo.CLIENT,
            ID: oUserInfo.ID,
            PW: oUserInfo.PW,
            SYSID: oUserInfo.SYSID,
            LANGU: oResult.META.LANGU,
            LANGU_CNV: oUserInfo.LANGU
        };
        oProcessUserInfo.LANGU = oUserInfo.LANGU;
        parent.setProcessEnvUserInfo(oProcessUserInfo);

        const oContent = document.getElementById("content");
        if (oContent) { oContent.style.display = "none"; }

        try {
            var oThemeInfo = await oAPP.fn.fnP13nCreateTheme();
        } catch (error) {
            console.error(error);
        }

        parent.setThemeInfo(oThemeInfo);

        var oCurrWin = REMOTE.getCurrentWindow();
        if (oThemeInfo && oThemeInfo.BGCOL) { oCurrWin.setBackgroundColor(oThemeInfo.BGCOL); }

        oAPP.attr.isPressWindowClose = "X";

        if (oServerInfo?.IS_SSO === "X" && oServerInfo.APPID && oServerInfo.APPID !== "") {
            parent.setNewBrowserIF_DATA({ ACTCD: "MOVE20", APPID: oServerInfo.APPID });
        }

        parent.oAPP.views.VW_MAIN.fn.loadWS30MainPage();
        parent.showLoadingPage('');
        parent.setSoundMsg('WELCOME');

    }; // end of fnOnLoginSuccess

    /************************************************************************
     * 테마 정보 저장 (FS 유지)
     ************************************************************************/
    oAPP.fn.fnP13nCreateTheme = () => {
        return new Promise((resolve, reject) => {
            let oLogInData = oModel.getProperty("/LOGIN"),
                sSysID = oLogInData.SYSID,
                sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme", `${sSysID}.json`);

            let oWsSettings = oAPP.fn.fnGetSettingsInfo(),
                oDefThemeInfo = {
                    THEME: oWsSettings.defaultTheme,
                    BGCOL: oWsSettings.defaultBackgroundColor
                };

            if (!FS.existsSync(sThemeJsonPath)) {
                FS.writeFile(sThemeJsonPath, JSON.stringify(oDefThemeInfo), { encoding: "utf8", mode: 0o777 }, function (err) {
                    if (err) { reject(err.toString()); return; }
                    resolve(oDefThemeInfo);
                });
                return;
            }
            let sThemeData = FS.readFileSync(sThemeJsonPath, 'utf-8'),
                oThemeInfo = JSON.parse(sThemeData);
            resolve(oThemeInfo);
        });
    };

    /************************************************************************
     * 로그인 정보 입력 체크 (검증 순서·메시지 키 보존 — doc 02 §3.3)
     ************************************************************************/
    oAPP.fn.fnLoginCheck = (ID, PW, CLIENT, LANGU) => {

        _fnClearFieldState("ws_client");
        _fnClearFieldState("ws_pw");
        _fnClearFieldState("ws_langu");
        _fnClearFieldState("ws_id");

        var oCheck = { RETCD: "S", MSG: "" };

        if (isEmpty(CLIENT) === true || isBlank(CLIENT) === true) {
            oCheck.RETCD = "E";
            oCheck.MSG = oAPP.msg.M0271;
            _fnSetFieldState("ws_client", "error");
            setTimeout(() => { document.getElementById("ws_client")?.focus(); }, 0);
            return oCheck;
        }
        if (isEmpty(ID) === true || isBlank(ID) === true) {
            oCheck.RETCD = "E";
            oCheck.MSG = oAPP.msg.M0272;
            _fnSetFieldState("ws_id", "error");
            setTimeout(() => { document.getElementById("ws_id")?.focus(); }, 0);
            return oCheck;
        }
        if (isEmpty(PW) === true || isBlank(PW) === true) {
            oCheck.RETCD = "E";
            oCheck.MSG = oAPP.msg.M0273;
            _fnSetFieldState("ws_pw", "error");
            setTimeout(() => { document.getElementById("ws_pw")?.focus(); }, 0);
            return oCheck;
        }
        if (isEmpty(LANGU) === true || isBlank(LANGU) === true) {
            oCheck.RETCD = "E";
            oCheck.MSG = oAPP.msg.M0274;
            _fnSetFieldState("ws_langu", "error");
            setTimeout(() => { document.getElementById("ws_langu")?.focus(); }, 0);
            return oCheck;
        }
        return oCheck;
    }; // end of fnLoginCheck

    /************************************************************************
     * Remember / ID Suggestion (FS p13n/login.json 유지)
     ************************************************************************/
    oAPP.fn.fnSaveRemember = (oLogInData) => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json"),
            oLoginInfo;
        try {
            oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, 'utf-8'));
        } catch (e) { oLoginInfo = {}; }
        if (typeof oLoginInfo !== "object" || oLoginInfo == null) { oLoginInfo = {}; }
        if (typeof oLoginInfo[sSysID] == "undefined") { oLoginInfo[sSysID] = {}; }
        var oSysInfo = oLoginInfo[sSysID], bIsRemember = oLogInData.REMEMBER;
        oSysInfo.REMEMBER = bIsRemember;
        if (bIsRemember) {
            oSysInfo.CLIENT = oLogInData.CLIENT;
            oSysInfo.LANGU = oLogInData.LANGU;
            oSysInfo.ID = oLogInData.ID;
            oSysInfo.WSLANGU = oLogInData.WSLANGU;
        }
        FS.writeFileSync(sJsonPath, JSON.stringify(oLoginInfo));
    };

    oAPP.fn.fnGetRememberLoginInfo = () => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json"), oLoginInfo;
        try { oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, 'utf-8')); } catch (e) { return; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null) { return; }
        if (typeof oLoginInfo[sSysID] == "undefined") { return; }
        return oLoginInfo[sSysID];
    };

    oAPP.fn.fnGetRememberCheck = () => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json"), oLoginInfo;
        try { oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, 'utf-8')); } catch (e) { return false; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null) { return false; }
        if (typeof oLoginInfo[sSysID] == "undefined") { return false; }
        return oLoginInfo[sSysID].REMEMBER;
    };

    oAPP.fn.fnSaveIDSuggData = (ID) => {
        const iIdSuggMaxCnt = 10;
        const sJsonPath = PATH.join(USERDATA, "p13n", "login.json");
        let oLoginInfo = {};
        try {
            if (FS.existsSync(sJsonPath)) { oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, 'utf-8')); }
        } catch (e) { oLoginInfo = {}; }
        oLoginInfo.aIds = Array.isArray(oLoginInfo.aIds) ? oLoginInfo.aIds : [];
        oLoginInfo.aIds = oLoginInfo.aIds.filter(a => a.ID !== ID);
        oLoginInfo.aIds.unshift({ ID });
        if (oLoginInfo.aIds.length > iIdSuggMaxCnt) { oLoginInfo.aIds = oLoginInfo.aIds.slice(0, iIdSuggMaxCnt); }
        try { FS.writeFileSync(sJsonPath, JSON.stringify(oLoginInfo, null, 2)); }
        catch (e) { console.error("login.json write error", e); }
    };

    oAPP.fn.fnReadIDSuggData = () => {
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json"), oLoginInfo;
        try { oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, 'utf-8')); } catch (e) { return []; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null || oLoginInfo.aIds == null) { return []; }
        return oLoginInfo.aIds;
    };

    /************************************************************************
     * 네트워크 online/offline (parent.setNetworkBusy 유지)
     ************************************************************************/
    oAPP.fn.fnNetworkCheckerOnline = function () {
        oAPP.attr.bIsNwActive = true;
        parent.setNetworkBusy(!oAPP.attr.bIsNwActive);
    };
    oAPP.fn.fnNetworkCheckerOffline = function () {
        oAPP.attr.bIsNwActive = false;
        parent.setNetworkBusy(!oAPP.attr.bIsNwActive);
    };

    /************************************************************************
     * 개인화 폴더 생성 (FS 유지)
     ************************************************************************/
    oAPP.fn.fnOnP13nFolderCreate = function () {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        var sP13nfolderPath = PATH.join(USERDATA, "p13n"),
            sP13nPath = parent.getPath("P13N"),
            bIsExists = FS.existsSync(sP13nPath);
        if (bIsExists) {
            var oSavedData = JSON.parse(FS.readFileSync(sP13nPath, 'utf-8'));
            if (oSavedData == "") { oSavedData = {}; }
            if (oSavedData[sSysID]) { return; }
            oSavedData[sSysID] = {};
            FS.writeFileSync(sP13nPath, JSON.stringify(oSavedData));
            return;
        }
        var oP13N_data = {};
        oP13N_data[sSysID] = {};
        if (!FS.existsSync(sP13nfolderPath)) { FS.mkdirSync(sP13nfolderPath); }
        FS.writeFileSync(sP13nPath, JSON.stringify(oP13N_data));
    };

    /************************************************************************
     * 단축키 (GlobalShortCut 유지)
     ************************************************************************/
    oAPP.fn.fnSetShortCut = () => {
        if (!GlobalShortCut) { return; }
        GlobalShortCut.register('F11', () => {
            var oCurrWin = REMOTE.getCurrentWindow();
            oCurrWin.setFullScreen(!oCurrWin.isFullScreen());
        });
    };
    oAPP.fn.fnOnBeforeUnload = () => {
        if (GlobalShortCut) { GlobalShortCut.unregisterAll(); }
    };

    /************************************************************************
     * WS Support Package Version Check (SP autoUpdater 유지)
     ************************************************************************/
    oAPP.fn.fnCheckSupportPackageVersion = (resolve, oParam) => {

        let oModelData = oModel.getProperty("/BUSYPOP");
        oModelData.ANIMATION = true;
        oModelData.PROGVISI = true;
        oModelData.TITLE = "Downloading...";
        oModelData.DESC = "If the patch is completed\nplease restart your computer!";
        oModelData.PROGTXT = "Downloading";
        oModelData.PERVALUE = 0;
        oModel.setProperty("/BUSYPOP", oModelData);

        let sSupportPackageCheckerPath = parent.getPath("WS_SP_UPD"),
            spAutoUpdater = require(sSupportPackageCheckerPath);

        spAutoUpdater.on("checking-for-update-SP", (e) => {
            console.log(e?.detail?.message || "패치 업데이트 확인중..");
        });

        spAutoUpdater.on("update-available-SP", () => {
            _fnFadeLoginCard(0.3);
            oAPP.fn.fnVersionCheckDialogOpen();
            parent.setDomBusy("");
            _showContentDom("X");
        });

        spAutoUpdater.on("update-not-available-SP", () => resolve());

        spAutoUpdater.on("download-progress-SP", (e) => {
            oModel.setProperty("/BUSYPOP/TITLE", "Support Patch Downloading...");
            if (oParam.ISCDN == "X") { _supportPackageVersionCheckDialogProgressStart(); return; }
            let iTotal = e.detail.file_info.TOTAL, iCurr = e.detail.file_info.TRANSFERRED;
            let iPer = parseFloat(iCurr / iTotal * 100).toFixed(2);
            if (iPer >= 100) { iPer = 100; }
            oModel.setProperty("/BUSYPOP/PERVALUE", iPer);
        });

        spAutoUpdater.on("update-install-SP", () => {
            _supportPackageVersionCheckDialogProgressEnd();
            oModel.setProperty("/BUSYPOP/TITLE", "Support Patch Installing...");
            oModel.setProperty("/BUSYPOP/PROGTXT", "Processing");
            _supportPackageVersionCheckDialogProgressStart();
        });

        spAutoUpdater.on("update-downloaded-SP", () => {
            _supportPackageVersionCheckDialogProgressEnd(true);
            oModel.setProperty("/BUSYPOP/TITLE", "Update Complete! Restarting...");
            oModel.setProperty("/BUSYPOP/PROGTXT", "Processing Complete!");
            oModel.setProperty("/BUSYPOP/ILLUSTTYPE", "sapIllus-SuccessHighFive");
            setTimeout(() => {
                if (oParam.ISCDN == "X") { parent.setIsCDN(""); }
                APP.relaunch(); APP.exit();
            }, 3000);
        });

        spAutoUpdater.on("update-error-SP", (e) => {
            _showContentDom("X");
            parent.setDomBusy("");
            let sRetMsg = e?.detail?.message || "";
            let sMsg = oAPP.msg.M057 + "\n\n" + sRetMsg + "\n\n";
            oAPP.fn.fnMessageBox("E", sMsg, {
                title: oAPP.msg.M058,
                initialFocus: "OK",
                emphasizedAction: "OK",
                actions: ["OK", "OpenLog"],
                onClose: function (action) {
                    if (action === "OpenLog") { WSLOG.openLOG(true); }
                    APP.exit();
                }
            });
            console.log('SP - 패치 업데이트 중 에러 : ' + sRetMsg);
        });

        let bIsCDN = (oParam.ISCDN == "X"),
            sAppVer = `v${APP.getVersion()}`,
            oSettings = oAPP.fn.fnGetSettingsInfo(),
            sPatch_level = oSettings.patch_level,
            oWSLoginInfo = oModel.getProperty("/LOGIN");
        oWSLoginInfo.META = oParam.oLoginInfo.META;
        spAutoUpdater.checkForUpdates(REMOTE, bIsCDN, sAppVer, sPatch_level, oWSLoginInfo);
    };

    function _supportPackageVersionCheckDialogProgressStart() {
        if (oAPP.attr.progressIntervalStop === true) { return; }
        if (typeof oAPP.attr.progressInterval !== "undefined") {
            clearInterval(oAPP.attr.progressInterval);
            delete oAPP.attr.progressInterval;
        }
        let iPer = 0;
        oAPP.attr.progressInterval = setInterval(function () {
            iPer += 1;
            oModel.setProperty("/BUSYPOP/PERVALUE", iPer);
            if (iPer >= 100) {
                if (typeof oAPP.attr.progressInterval !== "undefined") {
                    clearInterval(oAPP.attr.progressInterval);
                    delete oAPP.attr.progressInterval;
                    setTimeout(function () { _supportPackageVersionCheckDialogProgressStart(); }, 500);
                }
            }
        }, 20);
    }

    function _supportPackageVersionCheckDialogProgressEnd(bIsStop) {
        let oModelData = oModel.getProperty("/BUSYPOP");
        if (typeof oAPP.attr.progressInterval !== "undefined") {
            clearInterval(oAPP.attr.progressInterval);
            delete oAPP.attr.progressInterval;
        }
        oAPP.attr.progressIntervalStop = bIsStop;
        oModelData.PERVALUE = 100;
        oModelData.ANIMATION = false;
        oModel.setProperty("/BUSYPOP", oModelData);
    }

    /************************************************************************
     * 레지스트리 저장 (테마 / WhiteList Object — WSUTIL.putRegeditValue 유지)
     ************************************************************************/
    function _registry_T_REG_THEME(T_REG_THEME) {
        return new Promise(async (resolve) => {
            let oServerInfo = parent.getServerInfo(),
                oSettings = oAPP.fn.fnGetSettingsInfo(),
                oRegPaths = oSettings.regPaths,
                sSystemsRegPath = oRegPaths.systems,
                sRegThemeInfo = JSON.stringify(T_REG_THEME);
            let sRegPath = PATH.join(sSystemsRegPath, oServerInfo.SYSID);
            let oRegData = {};
            oRegData[sRegPath] = {};
            oRegData[sRegPath]["T_REG_THEME"] = { value: sRegThemeInfo, type: "REG_SZ" };
            await WSUTIL.putRegeditValue(oRegData);
            resolve();
        });
    }

    function _registry_T_REG_WLO(T_REG_WLO) {
        return new Promise(async (resolve) => {
            let oServerInfo = parent.getServerInfo(),
                oSettings = oAPP.fn.fnGetSettingsInfo(),
                oRegPaths = oSettings.regPaths,
                sSystemsRegPath = oRegPaths.systems,
                sWhiteListObj = JSON.stringify(T_REG_WLO);
            let sRegPath = PATH.join(sSystemsRegPath, oServerInfo.SYSID);
            let oRegData = {};
            oRegData[sRegPath] = {};
            oRegData[sRegPath]["T_REG_WLO"] = { value: sWhiteListObj, type: "REG_SZ" };
            await WSUTIL.putRegeditValue(oRegData);
            resolve();
        });
    }

    /************************************************************************
     * IPC / 현재 창 이벤트
     ************************************************************************/
    function _attachCurrentWindowEvents() {
        CURRWIN.on("maximize", () => {
            let oMaxBtn = document.getElementById("maxWinBtn");
            if (oMaxBtn) { oMaxBtn.innerHTML = ICON.restore; }
        });
        CURRWIN.on("unmaximize", () => {
            let oMaxBtn = document.getElementById("maxWinBtn");
            if (oMaxBtn) { oMaxBtn.innerHTML = ICON.max; }
        });
    }

    function _attachIPCEvents() {
        IPCMAIN.on('if-browser-interconnection', oAPP.fn.fnIpcMain_browser_interconnection);
        let oServerInfo = parent.getServerInfo();
        let sSysID = oServerInfo.SYSID;
        IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, oAPP.fn.onIpcMain_if_p13n_themeChange);
    }

    oAPP.fn.onIpcMain_if_p13n_themeChange = function () {
        let oLogInData = oModel.getProperty("/LOGIN");
        let sSysID = oLogInData.SYSID;
        let sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme", `${sSysID}.json`);
        if (FS.existsSync(sThemeJsonPath) === false) { return; }
        try {
            var oThemeJsonData = JSON.parse(FS.readFileSync(sThemeJsonPath, "utf-8"));
        } catch (error) { return; }
        oAPP.fn.fnApplyTheme(oThemeJsonData);
    };

    oAPP.fn.fnIpcMain_browser_interconnection = (oEvent, oRes) => {
        if (oRes.PRCCD === "04") { oAPP.fn.fnIpcMain_browser_interconnection_04(oRes); }
    };
    oAPP.fn.fnIpcMain_browser_interconnection_04 = () => {
        oAPP.attr.isPressWindowClose = "X";
        CURRWIN.close();
    };

    /************************************************************************
     * 로그인 오류 확인사항 가이드 Popup (BrowserWindow 유지)
     ************************************************************************/
    function _showLoginErrorHelpPopup() {
        parent.setDomBusy("X");
        const oSettingInfo = WSUTIL.getWsSettingsInfo(), WS_LANGU = oSettingInfo.globalLanguage;
        const sHelpRoot = PATH.join(APPPATH, "help", "login");
        let sHelpLanguPath = PATH.join(sHelpRoot, WS_LANGU, "index.html");
        if (!parent.FS.existsSync(sHelpLanguPath)) {
            sHelpLanguPath = PATH.join(sHelpRoot, "EN", "index.html");
            if (!parent.FS.existsSync(sHelpLanguPath)) {
                oAPP.fn.fnMessageBox("I", oAPP.msg.M414);
                parent.setDomBusy("");
                return;
            }
        }
        const sPopupName = "LOGIN_ERROR";
        const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);
            parent.setDomBusy("");
            return;
        }
        const SESSKEY = parent.getSessionKey(), BROWSKEY = parent.getBrowserKey();
        const oThemeInfo = parent.getThemeInfo();
        const sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = _deepClone(oDefaultOption.browserWindow);
        oBrowserOptions.title = oAPP.msg.M415;
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);
        oBrowserWindow.setMenu(null);
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName
        };
        const sLoadUrl = WSUTIL.QueryString.build(sHelpLanguPath, oQueryParams);
        oBrowserWindow.loadURL(sLoadUrl);
        oBrowserWindow.once('ready-to-show', () => { WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow); });
        oBrowserWindow.webContents.on('did-finish-load', function () {
            WSUTIL.setBrowserOpacity(oBrowserWindow);
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
            parent.setDomBusy("");
            oBrowserWindow.closable = true;
            oBrowserWindow.show();
        });
        oBrowserWindow.on('closed', () => { oBrowserWindow = null; CURRWIN.focus(); });
    }

    /************************************************************************
     * 로그인 오류 메시지 Dialog (sap.m.Dialog → HTML5 dialog)
     ************************************************************************/
    function _openLoginErrorDialog(oPARAM) {
        let sTitle = oPARAM?.TITLE || "";
        let sMsg01 = oAPP.msg.M249; // 점검사항
        let sMsg02 = oAPP.msg.M250; // 아래의 점검사항을 확인하세요.

        let oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4a-login__errdlg";
        oDlg.dataset.state = "error";

        const oHead = document.createElement("div");
        oHead.className = "u4a-dialog__header";
        oHead.innerHTML = ICON.disconnected + `<span></span>`;
        oHead.querySelector("span").textContent = sTitle;

        const oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body";
        const oDesc = document.createElement("div");
        oDesc.className = "u4a-login__errdlg-desc";
        oDesc.textContent = oPARAM?.DESC || "";
        const oHint = document.createElement("div");
        oHint.className = "u4a-login__errdlg-hint";
        oHint.textContent = sMsg02;
        oBody.appendChild(oDesc);
        oBody.appendChild(oHint);

        const oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer";
        // 점검사항(체크리스트) 열기 = 사용자가 취할 주 동작 → 강조(primary). 아이콘도
        //   물음표(도움말) 대신 체크리스트(list-check)로 의미를 맞춘다.
        const oHelpBtn = document.createElement("button");
        oHelpBtn.className = "u4a-btn u4a-btn--emphasized";
        oHelpBtn.innerHTML = ICON.checklist + " " + (sMsg01 || "");
        oHelpBtn.addEventListener("click", () => _showLoginErrorHelpPopup());
        // Close = 단순 닫기(보조). 제목/아이콘이 이미 오류색이라 버튼까지 빨강이면 과함 → 중립 버튼.
        const oCloseBtn = document.createElement("button");
        oCloseBtn.className = "u4a-btn";
        oCloseBtn.textContent = "Close";
        oCloseBtn.addEventListener("click", () => oDlg.close());
        oFoot.appendChild(oHelpBtn);
        oFoot.appendChild(oCloseBtn);

        oDlg.appendChild(oHead);
        oDlg.appendChild(oBody);
        oDlg.appendChild(oFoot);

        // afterClose → 로그인 창 닫기 (원본 동작 보존)
        oDlg.addEventListener("close", () => {
            oDlg.remove();
            oAPP.attr.isPressWindowClose = "X";
            CURRWIN.close();
        });

        document.body.appendChild(oDlg);
        oDlg.showModal();
    }

    /************************************************************************
     * 접속서버 설치 언어 목록 조회 (XHR — jQuery.ajax 대체)
     ************************************************************************/
    function _getSupportedLangu(PARAM) {
        return new Promise(function (resolve) {
            let sServicePath = parent.getServerPath();
            let oFormData = new FormData();
            oFormData.append("GET_LANGU", "X");
            oFormData.append("PRCCD", PARAM.PRCCD);

            const xhr = new XMLHttpRequest();
            xhr.timeout = 5000;
            xhr.withCredentials = true;
            xhr.onload = function () {
                try {
                    var oRetJson = JSON.parse(xhr.response);
                } catch (error) {
                    console.log("[_getSupportedLangu] JSON.parse error (하위버전 서버 추정)");
                    return resolve({ RETCD: "E", STCOD: "E998" });
                }
                return resolve(oRetJson);
            };
            xhr.onerror = xhr.ontimeout = function () {
                console.error("[_getSupportedLangu] 통신오류");
                return resolve({ RETCD: "E", STCOD: "E999" });
            };
            xhr.open("POST", sServicePath);
            xhr.send(oFormData);
        });
    }

    /************************************************************************
     * 로그인 화면 언어 영역 제어 (서버 응답 기준)
     ************************************************************************/
    function _handleLoginLangu() {
        return new Promise(async function (resolve) {
            let sLanguPRCCD = "GET_LANGU";
            let oLanguResult = await _getSupportedLangu({ PRCCD: sLanguPRCCD });
            console.log("[_handleLoginLangu]", oLanguResult);

            if (oLanguResult.RETCD === "E") {
                let sErrMsg = "";
                switch (oLanguResult.STCOD) {
                    case "E001":
                        sErrMsg = oAPP.msg.M282; break;
                    case "E998":
                        document.getElementById("ws_langu_input_form").hidden = false;
                        return resolve();
                    case "E999":
                    default:
                        sErrMsg = oAPP.msg.M283; break;
                }
                _openLoginErrorDialog({ TITLE: oAPP.msg.M416, DESC: sErrMsg });
                parent.setDomBusy("");
                return;
            }

            if (oLanguResult?.PRCCD !== sLanguPRCCD) {
                document.getElementById("ws_langu_input_form").hidden = false;
                return resolve();
            }

            document.getElementById("ws_langu_select_form").hidden = false;

            let aLangu = oLanguResult?.T_LANGU || [];
            let sLangu = oModel.getProperty("/LOGIN/LANGU");
            if (!sLangu) {
                oModel.setProperty("/LOGIN/LANGU", oLanguResult.DEFLANGU || "");
            }
            oModel.setProperty("/LOGIN/T_LANGU", aLangu);

            oAPP.fn.fnRenderLoginFields();
            return resolve();
        });
    }

    /************************************************************************
     * SSO 관련 로그인 처리 (fetch 유지)
     ************************************************************************/
    function _handleSSOLogin() {
        return new Promise(async function (resolve) {
            let oServerInfo = parent.getServerInfo();
            let SSO_TICKET = oServerInfo?.SSO_TICKET || undefined;
            if (typeof SSO_TICKET === "undefined") { return resolve(); }
            let sServerPath = parent.getServerPath();
            let SSO_HDR = `${SSO_TICKET}_XXX`;
            let oFormData = new FormData();
            oFormData.append("SSO_TICKET", SSO_TICKET);
            try {
                await fetch(sServerPath, { headers: { "sso_hdr": SSO_HDR }, method: "POST", body: oFormData });
            } catch (error) {
                console.error(error);
                console.error("[_handleSSOLogin] 통신오류 — SSO 로그인 처리 실패");
            }
            resolve();
        });
    }

    /************************************************************************
     * WS Global 메시지 텍스트 (WSUTIL.getWsMsgClsTxt — 하드코딩 금지)
     ************************************************************************/
    function fnWsGlobalMsgList() {
        return new Promise(async (resolve) => {
            const WSUTIL = parent.WSUTIL;
            let oSettingInfo = WSUTIL.getWsSettingsInfo(), sWsLangu = oSettingInfo.globalLanguage;
            const G = (nr, p) => WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", nr, p);

            oAPP.msg.M001 = G("001");
            oAPP.msg.M032 = G("032");
            oAPP.msg.M051 = G("051"); oAPP.msg.M052 = G("052"); oAPP.msg.M053 = G("053");
            oAPP.msg.M054 = G("054"); oAPP.msg.M055 = G("055"); oAPP.msg.M056 = G("056");
            oAPP.msg.M057 = G("057"); oAPP.msg.M058 = G("058");
            oAPP.msg.M063 = G("063"); oAPP.msg.M064 = G("064"); oAPP.msg.M065 = G("065");
            oAPP.msg.M081 = G("081"); oAPP.msg.M082 = G("082");
            oAPP.msg.M249 = G("249"); oAPP.msg.M250 = G("250");
            oAPP.msg.M0271 = G("027", oAPP.msg.M063); // Client
            oAPP.msg.M0272 = G("027", oAPP.msg.M064); // ID
            oAPP.msg.M0273 = G("027", oAPP.msg.M065); // Password
            oAPP.msg.M0274 = G("027", oAPP.msg.M001); // Language
            oAPP.msg.M282 = G("282"); oAPP.msg.M283 = G("283");
            oAPP.msg.M290 = G("290"); oAPP.msg.M294 = G("294"); oAPP.msg.M295 = G("295");
            oAPP.msg.M414 = G("414"); oAPP.msg.M415 = G("415");
            oAPP.msg.M416 = G("416"); oAPP.msg.M417 = G("417");
            resolve();
        });
    }

    /************************************************************************
     * 화면 렌더링 이후 초기화 (UI5 attachInit/UIUpdated 대체)
     ************************************************************************/
    async function _onViewReady() {

        // 참고: 런치 busy(스피너)는 호스트가 iframe 을 붙이기 "전"에 이미 켠다
        //   (control.js _loadLoginPage). 여기서 켜면 iframe 로드+JS 실행 후라야 켜져
        //   로딩 초반(빈 화면) 구간을 못 덮는다. 해제만 아래 _fnFadeInContent 직전에서 한다.

        // Default Browser check
        await oAPP.fn.fnCheckIstalledBrowser();

        // WS Global 메시지 글로벌 변수 설정
        await fnWsGlobalMsgList();

        // 초기값 바인딩
        oAPP.fn.fnOnInitModelBinding();

        // 현재 브라우저의 이벤트 핸들러 / IPC
        _attachCurrentWindowEvents();
        _attachIPCEvents();

        // 개인화 폴더 체크 후 없으면 생성
        oAPP.fn.fnOnP13nFolderCreate();

        // 단축키
        oAPP.fn.fnSetShortCut();

        // 언어 영역 제어
        await _handleLoginLangu();

        // SSO 자동 로그인
        let oServerInfo = parent.getServerInfo();
        if (oServerInfo?.IS_SSO === "X") {
            let oLogInData = oModel.getProperty("/LOGIN");
            if (oServerInfo.CLIENT) { oLogInData.CLIENT = oServerInfo.CLIENT; }
            if (oServerInfo.SAPID) { oLogInData.ID = oServerInfo.SAPID; }
            if (oServerInfo.SAPPW) { oLogInData.PW = oServerInfo.SAPPW; }
            if (oServerInfo.LANGU) { oLogInData.LANGU = oServerInfo.LANGU; }
            if (oServerInfo.WSLANGU) { oLogInData.WSLANGU = oServerInfo.WSLANGU; }
            oModel.setProperty("/LOGIN", oLogInData);

            await _handleSSOLogin();
            oAPP.events.ev_login(oServerInfo);
            return;
        }

        _fnFadeInContent();
        parent.setDomBusy("");
    }

    function _fnFadeInContent() {
        const oContent = document.getElementById("content");
        if (!oContent) { return; }
        oContent.style.display = "";
        setTimeout(() => { oContent.dataset.show = "true"; }, 50);
    }

    /************************************************************************
     * ───────────────────────── 부트스트랩 ─────────────────────────────
     ************************************************************************/
    oAPP.fn.fnInit = async () => {
        try {
            // 테마 적용 (parent 메타 기준)
            oAPP.fn.fnApplyTheme(parent.getThemeInfo());
        } catch (e) { /* 기본 테마 */ }

        var oWsSettings = oAPP.fn.fnGetSettingsInfo();

        // Trial 버전 — 별도 작업 단위(doc 02 §3.6). 현재 HTML5 미변환.
        if (oWsSettings.isTrial) {
            if (typeof oAPP.fn.fnOnTrialLoginPageRendering === "function") {
                oAPP.fn.fnOnTrialLoginPageRendering();
            } else {
                document.getElementById("content").style.display = "";
                oAPP.fn.fnMessageBox("I", "Trial(Guest) 로그인 화면은 아직 HTML5로 변환되지 않았습니다.");
            }
            return;
        }

        // 로그인 페이지 렌더
        oAPP.fn.fnOnInitRendering();

        // 렌더 이후 초기화 파이프라인
        await _onViewReady();
    };

    return oAPP;

})();

/************************************************************************
 * 유틸 (원본 유지)
 ************************************************************************/
function isBlank(s) {
    return isEmpty(String(s).trim());
}
function isEmpty(s) {
    return (s == null || String(s).length === 0);
}

/************************************************************************
 * 윈도우 라이프사이클 (원본 동작 보존)
 ************************************************************************/
window.addEventListener("load", () => {
    oAPP.fn.fnInit();
});

window.onbeforeunload = () => {
    // 브라우저의 닫기 버튼을 누른게 아니라면 종료 하지 않음
    if (parent.oAPP.attr.isPressWindowClose !== "X" && oAPP.attr.isPressWindowClose !== "X") {
        return false;
    }
    window.removeEventListener("online", oAPP.fn.fnNetworkCheckerOnline);
    window.removeEventListener("offline", oAPP.fn.fnNetworkCheckerOffline);
    try {
        const IPCMAIN = parent.REMOTE.require('electron').ipcMain;
        IPCMAIN.off('if-browser-interconnection', oAPP.fn.fnIpcMain_browser_interconnection);
        let oServerInfo = parent.getServerInfo();
        IPCMAIN.off(`if-p13n-themeChange-${oServerInfo.SYSID}`, oAPP.fn.onIpcMain_if_p13n_themeChange);
    } catch (e) { /* noop */ }
    oAPP.fn.fnOnBeforeUnload();
};

window.addEventListener("online", oAPP.fn.fnNetworkCheckerOnline, false);
window.addEventListener("offline", oAPP.fn.fnNetworkCheckerOffline, false);

document.addEventListener('DOMContentLoaded', function () {
    // 브라우저 타이틀 변경
    parent.CURRWIN.setTitle("U4A Workspace - Login");
    // 기본 zoom 레벨 적용
    try { parent.WEBFRAME.setZoomLevel(0); } catch (e) { /* noop */ }
});
