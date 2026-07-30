/************************************************************************
 * monacoSnippetDesigner/Popup/js/index.js  (HTML5)
 * ----------------------------------------------------------------------
 *  Monaco 스니펫 디자이너 — 콘텐츠 로직. 원본 UI5(view.js/control.js)의 기능을
 *  공통 자산(U4AUI.*: createPanel/createField/wireSplitter/confirm, .u4a-table/.u4a-busy)
 *  으로 1:1 이식. 스니펫 코드 에디터는 공통 Monaco 호스트(js/codeeditor) 재사용.
 *
 *  [불변 계약 — .analy 04 §10.4 / §6.4]
 *   · 저장: P13N_ROOT/monaco/snippet/list.json(메타 [{_key,snippet_name,snippet_desc,snippet_langu}])
 *           + {_key} 파일(코드 본문 순수 텍스트). FS 직접 I/O(서버 API 아님).
 *   · 저장·삭제 후 IPC(if-browser-interconnection / PRCCD:MONACO_SNIPPET_CHANGE) 방송 →
 *           열린 모든 USP 본편집기 자동완성 스니펫 갱신(js/usp/monaco 가 동일 파일 소비).
 *   · 언어 목록: javascript / css / html (원본 하드코딩).
 ************************************************************************/

(function () {
    "use strict";

    /* ==================================================================
     * 1. Electron / Util 컨텍스트
     * ================================================================== */
    const REMOTE = require("@electron/remote"),
        PATH = REMOTE.require("path"),
        FS = REMOTE.require("fs"),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        WSERR = require(PATHINFO.WSTRYCATCH),
        IPCRENDERER = require("electron").ipcRenderer,
        IPCMAIN = REMOTE.require("electron").ipcMain,
        CURRWIN = REMOTE.getCurrentWindow();

    // 전역 오류 감시견(window.onerror + unhandledrejection) — 다른 팝업과 동일 표준(누락 보강 2026-07-30).
    const zconsole = WSERR(window, document, console);

    const oQueryParams = WSUTIL.QueryString.parse(location.href);
    const USERINFO = oQueryParams.USERINFO || {},
        LANGU = USERINFO.LANGU || "",
        SYSID = USERINFO.SYSID || "",
        BROWSKEY = oQueryParams.browserkey || "";

    // 메시지 클래스 텍스트(/U4A/CL_WS_COMMON 등 SAP 메시지 클래스) — 꾸밈정렬 라벨(C25) 등.
    const WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);
    function mcMsg(sCls, sNo, sFallback) {
        try { const s = WSMSG.fnGetMsgClsText(sCls, sNo); if (s && s.trim()) { return s; } }
        catch (e) { console.error("[스니펫디자이너] 메시지클래스 조회 실패:", sCls, sNo, e); }
        return sFallback || sNo;
    }

    // 공통 Monaco 호스트(js/codeeditor)가 GRAND_FATHER(=최상위 창)에서 lib 경로를 해석한다 →
    //   최상위 창(이 문서)에 PATH/APPPATH 노출(안 하면 호스트가 monaco lib 경로를 못 찾음).
    window.PATH = PATH;
    window.APPPATH = APPPATH;

    /* ==================================================================
     * 2. 경로 / 상수 / 상태
     * ================================================================== */
    // P13N 스니펫 루트(원본 control.js MONACO_EDITOR_SNIPPET_P13N_ROOT 와 동일).
    const SNIPPET_ROOT = PATH.join(PATHINFO.P13N_ROOT, "monaco", "snippet");
    const SNIPPET_LIST_JSON = PATH.join(SNIPPET_ROOT, "list.json");

    // Monaco 호스트(editorPopup/host — 에디터 시리즈 전용, 꾸밈정렬 capability evt:"fmtcap" 통지) 채널.
    const HOST_CH = "__u4aedh";
    const HOSTID = "SNIPPET_CODE";

    // 언어 목록(원본 TY_SNIPPET_LANGU_DDLB: ""(미선택) + js/css/html).
    //   빈 항목("")은 원본 DDLB 의 공백 선택지 — 필수 검증(M349)의 "미선택" 상태를 재현.
    const LANGU_ITEMS = [
        { value: "", text: "" },
        { value: "javascript", text: "JavaScript" },
        { value: "css", text: "CSS" },
        { value: "html", text: "HTML" }
    ];

    const oState = {
        list: [],          // [{_key, snippet_langu, snippet_name, snippet_desc, _isnew?}]
        cur: null,         // 편집중 {_key, snippet_*, snippet_code, _isnew, _ischg}
        isBusy: false,
        editorReady: false,
        monacoTheme: "vs-dark"
    };

    // UI refs
    let oLanguField, oNameField, oDescField, oInfoPanel;
    let oLanguMsg = null;              // 언어 콤보용 valueState 메시지(.u4a-field__msg) — 콤보는 공통 setValueState 미지원
    let oBtnNew, oBtnDel, oBtnSave, oBtnCancel;
    let oBtnSaveTop, oBtnCancelTop;    // 상단(기본정보 패널 헤더) 저장/취소 — 원본은 헤더+푸터 양쪽에 배치
    let oListActsBar = null;           // 좌측 헤더 액션 바(⋯ 오버플로 대상)
    let _dt = null;                    // 공통 makeDataTable 컨트롤러(스니펫 리스트)
    let _descFit = null;               // 설명 TextArea 자동 높이조절 함수
    let _ovfTools = null, _ovfActs = null, _ovfInfoActs = null;   // attachOverflow 핸들(reflow 용)

    /* ==================================================================
     * 3. 공통 유틸(메시지 / 토스트 / busy / 오류)
     * ================================================================== */
    // 워크스페이스 메시지(ZMSG_WS_COMMON_001). p1 = &1 치환.
    function wsMsg(sNo, sFallback, p1) {
        const sP1 = (p1 == null) ? "" : String(p1);
        try {
            const s = WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo, sP1);
            if (s && s.trim()) { return s; }
        } catch (e) { console.error("[스니펫디자이너] 메시지 조회 실패:", sNo, e); }
        return (sFallback || sNo).replace(/&1/g, sP1);
    }

    // 공통 토스트(.u4a-toast) — 화면 정중앙·싱글톤·3초.
    let _toastTimer = null;
    function _toast(sMsg) {
        if (!sMsg) { return; }
        // ★ 열린 <dialog>(confirm top-layer) 위에 뜨도록 매 표시마다 host 재선택(안 하면 모달 뒤에 묻힘).
        //   toast-common-center 표준 — dialog[open] 있으면 거기에, 없으면 body.
        //   ★★ 단 busy(.u4a-busy)는 제외 — busy 는 작업 끝나면 곧 close 되고, 그 안에 붙은 토스트도
        //      함께 사라져 사용자가 "저장됨"을 못 본다(장군님 지적). busy 중 토스트는 body 에 둔다.
        const oHost = document.querySelector("dialog[open]:not(.u4a-busy)") || document.body;
        let oT = document.getElementById("snipToast");
        if (!oT) {
            oT = document.createElement("div");
            oT.id = "snipToast";
            oT.className = "u4a-toast";
            oT.setAttribute("role", "alert");
        }
        if (oT.parentNode !== oHost) { oHost.appendChild(oT); }
        oT.textContent = sMsg;
        oT.setAttribute("data-show", "true");
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { try { oT.setAttribute("data-show", "false"); } catch (e) { } }, 3000);
    }

    // busy(top-layer <dialog>) 제어.
    function fn_setBusy(bIsBusy) {
        oState.isBusy = !!bIsBusy;
        const oBusy = document.getElementById("snipBusy");
        if (!oBusy) { return; }
        try {
            if (bIsBusy) { if (!oBusy.open) { oBusy.showModal(); } }
            else { if (oBusy.open) { oBusy.close(); } }
        } catch (e) { console.error("[스니펫디자이너] busy 토글 오류:", e); }
    }

    // 자식창 일괄 busy 방송 수신 — 원본 frame.js _attachBroadCastEvent 이식(장군님 지시로 복원).
    //   메인(WS)이 다른 별창(MIME/바인딩/문서/옵션/OTR 등 fnDialogPopupOpener 11곳)을 열 때
    //   `broadcast-to-child-window_{BROWSKEY}` 로 BUSY_ON 을 쏘면 떠 있는 모든 자식창이 함께 잠긴다.
    //   ★ 이 팝업은 수신 전용 — opener 는 BUSY_ON 을 쏘지 않는다(원본 동일).
    let _oBroadToChild = null;
    function _attachBroadCastEvent() {
        try {
            _oBroadToChild = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
            _oBroadToChild.onmessage = function (oEvent) {
                const _PRCCD = (oEvent && oEvent.data && oEvent.data.PRCCD) || undefined;
                if (typeof _PRCCD === "undefined") { return; }

                // 프로세스에 따른 로직분기(원본 동일).
                switch (_PRCCD) {
                    case "BUSY_ON":
                        // BUSY ON을 요청받은경우.
                        fn_setBusy(true);
                        break;

                    case "BUSY_OFF":
                        // BUSY OFF를 요청 받은 경우.
                        fn_setBusy(false);
                        break;

                    default:
                        break;
                }
            };
        } catch (e) { console.error("[스니펫디자이너] BroadCast 배선 오류:", e); }
    }

    // 오류 모달(공통 U4AUI.confirm) — 저장/삭제 실패 등. 단추는 OK 하나.
    function showErr(sMsg, sTitle) {
        try { U4AUI.confirm({ type: "E", title: sTitle || "", message: sMsg, buttons: [{ act: "OK", label: "OK", emphasized: true }] }); }
        catch (e) { console.error("[스니펫디자이너] 오류 모달 실패:", e, sMsg); }
    }

    // 랜덤키(원본 getRandomKey — A-Za-z0-9, 30자).
    function getRandomKey(iLen) {
        let sResult = "";
        const sChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < iLen; i++) { sResult += sChars.charAt(Math.floor(Math.random() * sChars.length)); }
        return sResult;
    }

    // 언어 → Monaco language id.
    function _monacoLang(sLangu) {
        return sLangu ? sLangu : "plaintext";
    }

    // 현재 적용 테마의 다크/화이트 → Monaco 빌트인 테마(vs-dark / vs).
    //   ★판정 = <html data-sl-theme>("dark"|"light") — U4ATheme.apply() 의 _applySkin 이 세팅하는 공식 신호.
    //     (BGCOL 명도 추측 금지 — 실제 테마와 어긋난다. horizon_dark 만 dark, 나머지(red/purple 등)는 light.)
    function _monacoThemeNow() {
        try {
            const sMode = document.documentElement.getAttribute("data-sl-theme");
            if (sMode === "dark") { return "vs-dark"; }
            if (sMode === "light") { return "vs"; }
        } catch (e) { }
        return "vs-dark";
    }

    // 테마 변경 시 에디터 테마도 함께 전환(안 하면 화이트 테마에 다크 에디터가 남는다 — 장군님 지적).
    function _applyMonacoTheme() {
        oState.monacoTheme = _monacoThemeNow();
        _toHost({ cmd: "setTheme", theme: oState.monacoTheme });
    }

    // 실시간 테마 변경 추종(원본 frame.js if-p13n-themeChange-{SYSID}) — 창 배경 CSS + U4ATheme 재적용.
    function _getThemeInfo() {
        try {
            const sPath = PATH.join(PATHINFO.THEME, SYSID + ".json");
            if (!FS.existsSync(sPath)) { return null; }
            return JSON.parse(FS.readFileSync(sPath, "utf-8"));
        } catch (e) { console.error("[스니펫디자이너] 테마 정보 로드 오류:", e); return null; }
    }
    function _onThemeChange() {
        const oTheme = _getThemeInfo();
        if (!oTheme) { return; }
        try { CURRWIN.webContents.insertCSS("html, body { margin: 0px; height: 100%; background-color: " + oTheme.BGCOL + "; }"); } catch (e) { }
        try {
            if (window.U4ATheme && oTheme.THEME) {
                window.U4ATheme.apply(window.U4ATheme.normalize ? window.U4ATheme.normalize(oTheme.THEME) : oTheme.THEME);
            }
        } catch (e) { console.error("[스니펫디자이너] 테마 적용 오류:", e); }
    }
    const _THEME_CH = SYSID ? ("if-p13n-themeChange-" + SYSID) : "";

    /* ==================================================================
     * 4. 데이터 계층 (P13N FS I/O) — 원본 control.js 1:1
     * ================================================================== */
    // list.json → [{_key, snippet_langu, snippet_name, snippet_desc}]
    function _readList() {
        try {
            if (!FS.existsSync(SNIPPET_LIST_JSON)) { return []; }
            const a = JSON.parse(FS.readFileSync(SNIPPET_LIST_JSON, "utf-8"));
            if (!Array.isArray(a)) { return []; }
            return a.map(function (o) {
                return {
                    _key: o && o._key || "",
                    snippet_langu: o && o.snippet_langu || "",
                    snippet_name: o && o.snippet_name || "",
                    snippet_desc: o && o.snippet_desc || ""
                };
            }).filter(function (o) { return o._key; });
        } catch (e) {
            console.error("[스니펫디자이너] list.json 로드 오류:", e);
            return [];
        }
    }

    // {_key} 코드 파일 읽기.
    function _readCode(sKey) {
        try {
            const sFile = PATH.join(SNIPPET_ROOT, sKey);
            if (!FS.existsSync(sFile)) { return ""; }
            return FS.readFileSync(sFile, "utf-8");
        } catch (e) {
            console.error("[스니펫디자이너] 코드 파일 로드 오류:", sKey, e);
            return "";
        }
    }

    // list.json 저장(메타만: _key/name/desc/langu).
    function _writeList(aList) {
        try {
            if (!FS.existsSync(SNIPPET_ROOT)) { FS.mkdirSync(SNIPPET_ROOT, { recursive: true }); }
            const aSave = (aList || []).map(function (o) {
                return { _key: o._key, snippet_name: o.snippet_name, snippet_desc: o.snippet_desc, snippet_langu: o.snippet_langu };
            });
            FS.writeFileSync(SNIPPET_LIST_JSON, JSON.stringify(aSave), "utf-8");
            return { RETCD: "S" };
        } catch (e) {
            console.error("[스니펫디자이너] list.json 저장 오류:", e);
            return { RETCD: "E" };
        }
    }

    // {_key} 코드 파일 저장.
    function _writeCode(sKey, sCode) {
        try {
            if (!FS.existsSync(SNIPPET_ROOT)) { FS.mkdirSync(SNIPPET_ROOT, { recursive: true }); }
            FS.writeFileSync(PATH.join(SNIPPET_ROOT, sKey), sCode == null ? "" : String(sCode), "utf-8");
            return { RETCD: "S" };
        } catch (e) {
            console.error("[스니펫디자이너] 코드 파일 저장 오류:", sKey, e);
            return { RETCD: "E" };
        }
    }

    // {_key} 코드 파일 삭제.
    function _removeCode(sKey) {
        try {
            const sFile = PATH.join(SNIPPET_ROOT, sKey);
            if (FS.existsSync(sFile)) { FS.unlinkSync(sFile); }
        } catch (e) { console.error("[스니펫디자이너] 코드 파일 삭제 오류:", sKey, e); }
    }

    // 통합 저장(원본 _saveP13nSnippetData): 신규건 제외한 목록에 update/unshift → 목록 + 코드 저장.
    function _saveData(oSaveData) {
        // 저장 대상 목록 = 현재 목록에서 미저장 신규건 제외.
        const aBase = oState.list.filter(function (o) { return !o._isnew; }).map(function (o) {
            return { _key: o._key, snippet_langu: o.snippet_langu, snippet_name: o.snippet_name, snippet_desc: o.snippet_desc };
        });
        const oFound = aBase.find(function (e) { return e._key === oSaveData._key; });
        if (oFound) {
            oFound.snippet_name = oSaveData.snippet_name;
            oFound.snippet_desc = oSaveData.snippet_desc;
            oFound.snippet_langu = oSaveData.snippet_langu;
        } else {
            aBase.unshift({ _key: oSaveData._key, snippet_langu: oSaveData.snippet_langu, snippet_name: oSaveData.snippet_name, snippet_desc: oSaveData.snippet_desc });
        }
        let oRes = _writeList(aBase);
        if (oRes.RETCD === "E") { return oRes; }
        oRes = _writeCode(oSaveData._key, oSaveData.snippet_code);
        return oRes;
    }

    // 저장·삭제 후 방송(불변 계약).
    function _broadcastChange() {
        try { IPCRENDERER.send("if-browser-interconnection", { PRCCD: "MONACO_SNIPPET_CHANGE" }); }
        catch (e) { console.error("[스니펫디자이너] snippet_change 방송 오류:", e); }
    }

    /* ==================================================================
     * 5. 공통 Monaco 호스트 통신 (js/codeeditor)
     * ================================================================== */
    function _toHost(oMsg) {
        try {
            const oFrame = document.getElementById("snipEditor");
            if (!oFrame || !oFrame.contentWindow) { return; }
            oMsg = oMsg || {};
            oMsg[HOST_CH] = true;
            oMsg.hostId = HOSTID;
            oFrame.contentWindow.postMessage(oMsg, "*");
        } catch (e) { console.error("[스니펫디자이너] 호스트 송신 오류:", e); }
    }

    // 줌 % 라벨 갱신(호스트 evt:zoom). 숫자라 i18n 불필요.
    function _setZoomLabel(pct) {
        const oBtn = document.getElementById("snipZoomBtn");
        if (!oBtn) { return; }
        const n = (typeof pct === "number" && isFinite(pct)) ? pct : 100;
        const oSpan = oBtn.querySelector("span");
        if (oSpan) { oSpan.textContent = n + "%"; }
        oBtn.title = n + "% (Ctrl+0)";
    }

    // 꾸밈정렬 버튼 활성/비활성 — 호스트 evt:"fmtcap"(현재 언어 포맷 지원 여부)로만 결정.
    //   ★부모가 isSupported 를 추측하지 않는다(언어 비동기 반영 레이스 회피 — format-btn-capability).
    //   Monaco 0.33 은 CSS 포맷 provider 미등록 → 미지원 언어는 비활성(장군님 지시).
    function _setFormatCap(bSupported) {
        const oBtn = document.getElementById("snipFormatBtn");
        if (!oBtn) { return; }
        oBtn.disabled = !bSupported;
        const sLabel = mcMsg("/U4A/CL_WS_COMMON", "C25", "Pretty Print");
        oBtn.title = bSupported ? (sLabel + " (Shift+F1)") : (sLabel + " — N/A");
    }

    // 현재 에디터 값(동일 출처 직접 접근).
    function _readEditorValue() {
        try {
            const oFrame = document.getElementById("snipEditor");
            if (oFrame && oFrame.contentWindow && oFrame.contentWindow.editor) {
                return oFrame.contentWindow.editor.getValue();
            }
        } catch (e) { console.error("[스니펫디자이너] 에디터 값 읽기 오류:", e); }
        return "";
    }

    // 현재 편집 상태를 에디터에 반영(언어/읽기전용/값).
    function _applyEditorState() {
        if (!oState.editorReady) { return; }
        if (oState.cur) {
            _toHost({ cmd: "setLanguage", language: _monacoLang(oState.cur.snippet_langu) });
            _toHost({ cmd: "setReadOnly", readOnly: false });
            _toHost({ cmd: "setValue", value: oState.cur.snippet_code || "" });
        } else {
            _toHost({ cmd: "setValue", value: "" });
            _toHost({ cmd: "setReadOnly", readOnly: true });
        }
    }

    // 호스트 → 부모 통지 수신.
    window.addEventListener("message", function (oEvent) {
        const d = oEvent && oEvent.data;
        if (!d || d[HOST_CH] !== true || d.hostId !== HOSTID) { return; }
        switch (d.evt) {
            case "ready":
                oState.editorReady = true;
                _applyMonacoTheme();   // 로드 전 테마가 바뀌었을 수 있으니 현재 테마로 확정
                _applyEditorState();
                return;
            case "change":
                // 외부 주입(setValue) 이 아닌 사용자 편집 → 변경 표시.
                if (oState.cur) { oState.cur._ischg = true; _syncActionButtons(); }
                return;
            case "save":
                // 에디터 Ctrl+S → 저장(편집 화면일 때만).
                if (oState.cur) { saveSnippet(); }
                return;
            case "zoom":
                _setZoomLabel(d.pct);
                return;
            case "fmtcap":
                // 현재 언어의 꾸밈정렬 지원 여부 → 버튼 활성/비활성.
                _setFormatCap(!!d.supported);
                return;
            default:
                return;
        }
    });

    /* ==================================================================
     * 6. 화면 표시 토글 / 액션 버튼 상태
     * ================================================================== */
    // ── 우측 서브페이지 전환(빈상태 ↔ 편집) — 16 §9.2 고정 사양(0.26s±32px 슬라이드+페이드).
    //    별창은 ws20.css(.u4aWsNav*) 미로드 → 화면 스코프로 복제(patternPopup 선례). ──
    const _A_SNIPNAV = ["u4aSnipNavInFwd", "u4aSnipNavInBack", "u4aSnipNavOutFwd", "u4aSnipNavOutBack"];
    function _navRight(oShow, oHide, bForward) {
        if (!oShow) { return; }
        oShow.classList.remove.apply(oShow.classList, _A_SNIPNAV);
        oShow.classList.remove("u4aSnipPageHidden");
        if (!oHide) { return; }   // 최초 표시 = 애니메이션 없이 노출
        oShow.classList.add(bForward ? "u4aSnipNavInFwd" : "u4aSnipNavInBack");

        oHide.classList.remove.apply(oHide.classList, _A_SNIPNAV);
        const sOut = bForward ? "u4aSnipNavOutFwd" : "u4aSnipNavOutBack";
        oHide.classList.add(sOut);
        let bDone = false;
        const _done = function () {   // 완료 후 정리(animationend + 400ms 폴백).
            if (bDone) { return; }
            bDone = true;
            oHide.classList.remove(sOut);
            oHide.classList.add("u4aSnipPageHidden");
            oHide.removeEventListener("animationend", _done);
        };
        oHide.addEventListener("animationend", _done);
        setTimeout(_done, 400);
    }

    function _showEmpty() {
        const oE = document.getElementById("snipEmpty");
        const oEd = document.getElementById("snipEdit");
        // 편집이 보이던 상태에서만 슬라이드(빈상태 이미 보이면 no-op = 최초 포함).
        if (oEd && !oEd.classList.contains("u4aSnipPageHidden")) {
            _navRight(oE, oEd, false);   // 편집→빈 = back
        } else {
            if (oE) { oE.classList.remove("u4aSnipPageHidden"); }
            if (oEd) { oEd.classList.add("u4aSnipPageHidden"); }
        }
        // 원본 setInit 대칭 — 빈 상태에선 에디터를 clear + readonly 로 되돌린다(숨은 에디터에 직전 코드/편집상태 잔존 방지).
        //   cur 는 이 시점 null → _applyEditorState 가 setValue("")+setReadOnly(true) 전송(슬라이드 페이드가 가림).
        _applyEditorState();
        _syncActionButtons();
    }

    function _showEdit() {
        const oE = document.getElementById("snipEmpty");
        const oEd = document.getElementById("snipEdit");
        if (!oEd) { _syncActionButtons(); return; }
        if (oEd.classList.contains("u4aSnipPageHidden")) {
            _navRight(oEd, oE, true);    // 빈→편집 = forward
        } else {
            // 이미 편집중(다른 스니펫 선택) — 편집 페이지를 다시 슬라이드-인(선택 피드백).
            oEd.classList.remove.apply(oEd.classList, _A_SNIPNAV);
            void oEd.offsetWidth;        // reflow 강제 → 같은 애니메이션 재발화
            oEd.classList.add("u4aSnipNavInFwd");
        }
        // 전환 후 Monaco 레이아웃 재계산(자동레이아웃 보조).
        _toHost({ cmd: "layout" });
        // 숨김→표시로 폭이 확정되면 편집 페이지 툴바 오버플로 재계산(폭 0 시점 오판 보정).
        if (_ovfTools) { try { _ovfTools.reflow(); } catch (e) { } }
        if (_ovfInfoActs) { try { _ovfInfoActs.reflow(); } catch (e) { } }
        _syncActionButtons();
    }

    // 툴바 버튼 활성 — 원본 setPageToolHdrBtnHandle 매트릭스 1:1.
    //   선택없음(초기) : 신규 ON  / 삭제 off / 저장 off / 취소 off
    //   신규 생성중    : 신규 OFF / 삭제 off / 저장 ON  / 취소 ON      ← ★신규 버튼 비활성
    //   기존 로드행    : 신규 ON  / 삭제 ON  / 저장 ON  / 취소 off
    //   (원본은 _ischg 시 재평가하지 않으므로 기존행은 변경 여부와 무관하게 저장 ON 유지 = 위 매트릭스가 실효 동작.)
    function _syncActionButtons() {
        const bCur = !!oState.cur;
        const bNew = bCur && !!oState.cur._isnew;
        const bExist = bCur && !bNew && !!oState.cur._key;
        const bSave = (bNew || bExist);
        if (oBtnNew) { oBtnNew.disabled = bNew; }
        if (oBtnDel) { oBtnDel.disabled = !bExist; }
        // 저장/취소는 상단(패널 헤더)·하단(푸터) 양쪽 동일 상태 — 원본 헤더툴바 + clone 푸터 구조.
        if (oBtnSave) { oBtnSave.disabled = !bSave; }
        if (oBtnSaveTop) { oBtnSaveTop.disabled = !bSave; }
        if (oBtnCancel) { oBtnCancel.disabled = !bNew; }
        if (oBtnCancelTop) { oBtnCancelTop.disabled = !bNew; }
    }

    /* ==================================================================
     * 7. 리스트(공통 makeDataTable) / 선택
     * ================================================================== */
    // 이름 셀 = 이름 + 설명 서브라인(원본 Description popin). 잘릴 때만 공통 툴팁(16 §2.9a).
    function _nameCell(rec) {
        const frag = document.createDocumentFragment();
        const oNm = document.createElement("div");
        oNm.className = "u4aSnipTable__nm";
        oNm.textContent = rec.snippet_name || (rec._isnew ? wsMsg("361", "New") : "");
        if (oNm.textContent) { oNm.setAttribute("data-tip", oNm.textContent); oNm.setAttribute("data-tip-trunc", ""); }
        frag.appendChild(oNm);
        if (rec.snippet_desc) {
            const oDesc = document.createElement("div");
            oDesc.className = "u4aSnipTable__desc";
            oDesc.textContent = wsMsg("176", "Description") + ": " + rec.snippet_desc;
            oDesc.setAttribute("data-tip", oDesc.textContent);
            oDesc.setAttribute("data-tip-trunc", "");
            frag.appendChild(oDesc);
        }
        return frag;
    }

    // 공통 데이터테이블 1회 생성(호스트 부착). 이후 데이터 변경은 renderList()가 setRows.
    //   선택=aria-selected(공통), 빈상태=tr.u4a-table__nodata(공통 emptyText).
    //   ★진입(로드)=행 단일클릭(onSelect) — 장군님 지시(원본 상세버튼/더블클릭 대신 원클릭, 상세버튼 미사용).
    function _initListTable(oHost) {
        if (!oHost || !U4AUI.makeDataTable) { return; }
        _dt = U4AUI.makeDataTable(oHost, {
            virtual: false,                 // 개인 스니펫 소형 목록 — 가상스크롤 불필요
            tableClass: "u4aSnipTable",
            emptyText: wsMsg("946", "No data"),
            rowKey: function (r) { return r._key; },
            columns: [
                { label: wsMsg("363", "Snippet Name"), cellClass: "u4aSnipTable__name", cell: _nameCell },
                { label: wsMsg("001", "Language"), cellClass: "u4aSnipTable__langu", cell: function (r) { return (r && r.snippet_langu) || ""; } }
            ],
            onSelect: function (r) { if (r) { onRowClick(r._key); } },   // 단일클릭 = 로드
            rowHook: function (tr, r) { if (r && r._isnew) { tr.classList.add("is-new"); } }
        });
    }

    function renderList() {
        if (!_dt) { return; }
        _dt.setRows(oState.list.slice());   // 사본 전달(내부 보관 배열과 참조 분리)
        _dt.setSel(oState.cur ? oState.cur._key : null);
    }

    function _markSelectedRow(sKey) {
        if (_dt) { _dt.setSel(sKey); }
    }

    // 미저장 신규건 제거.
    function _dropUnsavedNew() {
        oState.list = oState.list.filter(function (o) { return !o._isnew; });
    }

    // 변경/신규 미저장 가드 후 콜백. (원본 M354/M355·M356 확인창)
    function _guardDirtyThen(cb) {
        if (!oState.cur) { cb(true); return; }
        if (oState.cur._isnew) {
            U4AUI.confirm({
                type: "C",
                title: wsMsg("361", "New"),
                message: wsMsg("355", "There is unsaved new data.") + "\n" + wsMsg("356", "Discard the new item and continue?"),
                onClose: function (a) { if (a === "YES") { _dropUnsavedNew(); cb(true); } else { cb(false); } }
            });
            return;
        }
        if (oState.cur._ischg) {
            U4AUI.confirm({
                type: "C",
                message: wsMsg("354", "Discard changes and continue?"),
                onClose: function (a) { cb(a === "YES"); }
            });
            return;
        }
        cb(true);
    }

    function onRowClick(sKey) {
        if (oState.cur && oState.cur._key === sKey) { return; }   // 이미 선택
        _guardDirtyThen(function (bProceed) {
            if (!bProceed) {
                // makeDataTable 은 클릭 즉시 선택(aria-selected)을 옮기므로, 가드 취소 시 현재 편집행으로 되돌린다.
                if (_dt) { _dt.setSel(oState.cur ? oState.cur._key : null); }
                return;
            }
            _loadIntoEdit(sKey);
        });
    }

    // 선택 스니펫을 편집 폼/에디터에 로드.
    function _loadIntoEdit(sKey) {
        const rec = oState.list.find(function (o) { return o._key === sKey; });
        if (!rec) { return; }

        const sCode = rec._isnew ? "" : _readCode(rec._key);

        oState.cur = {
            _key: rec._key,
            snippet_langu: rec.snippet_langu || "",
            snippet_name: rec.snippet_name || "",
            snippet_desc: rec.snippet_desc || "",
            snippet_code: sCode,
            _isnew: !!rec._isnew,
            _ischg: false
        };

        // 폼 반영
        try { oLanguField.setValue(oState.cur.snippet_langu); } catch (e) { }
        try { oNameField.setValue(oState.cur.snippet_name); } catch (e) { }
        try { oDescField.setValue(oState.cur.snippet_desc); } catch (e) { }
        _clearValueStates();

        _showEdit();
        if (_descFit) { _descFit(); }   // 설명 높이를 로드된 내용에 맞춤(2~5행)
        _markSelectedRow(sKey);
        _applyEditorState();
        _syncActionButtons();
    }

    // 언어 select value-state — 공통 createField(select)의 setValueState 는 no-op(15 §3.5.5, 콤보는 공통
    //   [data-vs] 마커 없음) → 화면 스코프로 콤보에 data-vs(빨간 테두리) + 공통 .u4a-field__msg(메시지) 직접 제어.
    //   메시지는 공통 규칙대로 행 포커스 시에만 노출(.u4a-form__row:focus-within).
    function _setLanguVs(bError, sMsg) {
        const oCombo = oLanguField && oLanguField.el;
        if (oCombo) {
            if (bError) { oCombo.setAttribute("data-vs", "error"); } else { oCombo.removeAttribute("data-vs"); }
        }
        if (oLanguMsg) { oLanguMsg.textContent = bError ? (sMsg || "") : ""; }
    }

    function _clearValueStates() {
        _setLanguVs(false);
        try { oNameField.setValueState("none"); } catch (e) { }
    }

    /* ==================================================================
     * 8. 액션 : 신규 / 삭제 / 저장 / 취소
     * ================================================================== */
    function newSnippet() {
        // 이미 미저장 신규건이 있으면 차단(원본 M353).
        if (oState.list.some(function (o) { return o._isnew; })) { _toast(wsMsg("353", "An unsaved new item already exists.")); return; }
        _guardDirtyThen(function (bProceed) {
            if (!bProceed) { return; }
            const sKey = getRandomKey(30);
            oState.list.unshift({ _key: sKey, snippet_langu: "", snippet_name: "", snippet_desc: "", _isnew: true });
            renderList();
            _loadIntoEdit(sKey);
            setTimeout(function () { try { oNameField.focus(); } catch (e) { } }, 0);
        });
    }

    function deleteSnippet() {
        if (!oState.cur) { _toast(wsMsg("359", "Select a snippet from the list.")); return; }
        const sKey = oState.cur._key;
        const bWasNew = !!oState.cur._isnew;
        U4AUI.confirm({
            type: "C",
            title: wsMsg("029", "Delete"),
            message: wsMsg("080", "Delete this item?"),
            onClose: function (a) {
                if (a !== "YES") { return; }
                fn_setBusy(true);
                try {
                    // 삭제 위치(원본 iFindIndex) — 인접행 자동선택 기준.
                    const iIdx = oState.list.findIndex(function (o) { return o._key === sKey; });

                    // 목록에서 제거.
                    oState.list = oState.list.filter(function (o) { return o._key !== sKey; });

                    if (!bWasNew) {
                        const oRes = _writeList(oState.list);
                        if (oRes.RETCD === "E") {
                            fn_setBusy(false);
                            showErr(wsMsg("357", "Failed to update personalization file after delete.") + "\n" + wsMsg("228", ""));
                            return;
                        }
                        _removeCode(sKey);
                    }

                    oState.cur = null;
                    renderList();

                    // 원본 프로세스: 삭제 위치의 다음 행(없으면 이전 행)을 자동 로드. 없으면 빈 화면.
                    let oNext = null;
                    if (oState.list.length) {
                        if (iIdx <= 0) { oNext = oState.list[0]; }
                        else { oNext = oState.list[iIdx] || oState.list[iIdx - 1]; }
                    }
                    if (oNext) { _loadIntoEdit(oNext._key); } else { _showEmpty(); }

                    if (!bWasNew) { _broadcastChange(); }
                } finally {
                    fn_setBusy(false);
                }
            }
        });
    }

    function saveSnippet() {
        if (!oState.cur) { return; }
        // 유효성 우선(validate-first).
        if (_checkSave().RETCD === "E") { return; }

        let bSaved = false;
        fn_setBusy(true);
        try {
            const oSaveData = {
                _key: oState.cur._key,
                snippet_langu: oState.cur.snippet_langu,
                snippet_name: oState.cur.snippet_name,
                snippet_desc: oState.cur.snippet_desc,
                snippet_code: _readEditorValue()
            };

            const oRes = _saveData(oSaveData);
            if (oRes.RETCD === "E") {
                fn_setBusy(false);
                showErr(wsMsg("367", "A problem occurred while saving the snippet.") + "\n" + wsMsg("228", ""));
                return;
            }

            // 상태/목록 갱신.
            oState.cur._isnew = false;
            oState.cur._ischg = false;
            oState.cur.snippet_code = oSaveData.snippet_code;

            const rec = oState.list.find(function (o) { return o._key === oSaveData._key; });
            if (rec) {
                rec.snippet_langu = oSaveData.snippet_langu;
                rec.snippet_name = oSaveData.snippet_name;
                rec.snippet_desc = oSaveData.snippet_desc;
                delete rec._isnew;
            }

            renderList();
            _markSelectedRow(oSaveData._key);
            _syncActionButtons();
            _broadcastChange();
            bSaved = true;
        } finally {
            fn_setBusy(false);
        }

        // ★ busy 해제 후에 토스트 — busy(top-layer dialog)가 열린 채로 띄우면 그 위에 가려지거나
        //   busy 가 닫힐 때 함께 사라져 사용자가 저장 여부를 못 본다(원본 M366 = "저장되었습니다!").
        if (bSaved) { _toast(wsMsg("366", "Saved.")); }
    }

    function cancelSnippet() {
        if (!oState.cur) { _showEmpty(); return; }
        const _finish = function () {
            if (oState.cur && oState.cur._isnew) { _dropUnsavedNew(); }
            oState.cur = null;
            renderList();
            _showEmpty();
        };
        // ★원본 cancelSnippet 1:1 — 확인창은 실제 변경(_ischg)이 있을 때만.
        //   신규 생성 직후처럼 입력이 없으면(_ischg=false) 확인 없이 바로 취소한다(_isnew 는 조건 아님).
        if (oState.cur._ischg) {
            U4AUI.confirm({ type: "C", message: wsMsg("354", "Discard changes and continue?"), onClose: function (a) { if (a === "YES") { _finish(); } } });
        } else {
            _finish();
        }
    }

    // 저장 전 필수값/정합성(원본 _checkSaveSnippetData).
    function _checkSave() {
        _clearValueStates();

        const sLangu = (oLanguField.getValue() || "");
        const sName = (oNameField.getValue() || "");
        const sDesc = (oDescField.getValue() || "");
        const sCode = _readEditorValue();

        // 현재 폼값을 편집 상태에 동기화.
        oState.cur.snippet_langu = sLangu;
        oState.cur.snippet_name = sName;
        oState.cur.snippet_desc = sDesc;

        // ★필드 검증 메시지는 토스트가 아니라 valueState 메시지로(장군님 지시) — 포커스 이동으로 노출된다.
        if (!sLangu) {
            _setLanguVs(true, wsMsg("349", "Language is required."));
            try { oLanguField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        if (!sName) {
            oNameField.setValueState("error", wsMsg("350", "Snippet name is required."));
            try { oNameField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        if (/\s/.test(sName)) {
            oNameField.setValueState("error", wsMsg("351", "Snippet name cannot contain spaces."));
            try { oNameField.focus(); } catch (e) { }
            return { RETCD: "E" };
        }
        // 코드는 입력 필드가 아니라 에디터 → 붙일 valueState 자리가 없어 토스트 유지(원본 M352 동일).
        if (!sCode) {
            _toast(wsMsg("352", "Enter snippet code."));
            _toHost({ cmd: "focus" });
            return { RETCD: "E" };
        }
        return { RETCD: "S" };
    }

    /* ==================================================================
     * 9. 입력 필드 change 핸들러
     * ================================================================== */
    function onLanguChange() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        const sLangu = oLanguField.getValue() || "";
        _setLanguVs(false);
        if (!sLangu) {
            _setLanguVs(true, wsMsg("349", "Language is required."));
        }
        // 언어(빈값=plaintext 포함)를 항상 호스트에 반영 → 호스트가 fmtcap 재통지.
        //   (빈값으로 바꿔도 setLanguage 를 보내야 이전 언어/꾸밈정렬 활성상태가 잔존하지 않음 — Codex 지적)
        _toHost({ cmd: "setLanguage", language: _monacoLang(sLangu) });
        _syncActionButtons();
    }

    function onNameChange() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        const sName = oNameField.getValue() || "";
        try { oNameField.setValueState("none"); } catch (e) { }
        if (/\s/.test(sName)) {
            // 입력 중이라 이미 포커스가 있어 valueState 메시지가 바로 보인다(토스트 사용 안 함).
            try { oNameField.setValueState("error", wsMsg("351", "Snippet name cannot contain spaces.")); } catch (e) { }
        }
        _syncActionButtons();
    }

    function _markDirty() {
        if (!oState.cur) { return; }
        oState.cur._ischg = true;
        _syncActionButtons();
    }

    /* ==================================================================
     * 10. UI 빌드
     * ================================================================== */
    // 폼 행 — 공통 .u4a-form__row 소비(필수!): shell.css 가 `.u4a-form__row:focus-within .u4a-field__msg`
    //   로만 valueState 메시지를 노출한다. 이 클래스가 없으면 메시지가 영영 안 뜬다(장군님 지적).
    function _fieldBlock(sLabel, bRequired, oInputEl) {
        const oWrap = document.createElement("div");
        oWrap.className = "u4a-form__row u4aSnipField";
        const oLbl = document.createElement("label");
        oLbl.className = "u4aSnipField__label";
        if (bRequired) { oLbl.setAttribute("data-required", "true"); }
        oLbl.textContent = sLabel;
        oWrap.appendChild(oLbl);
        oWrap.appendChild(oInputEl);
        return oWrap;
    }

    // 좌측 = 평면 헤더(제목 + 신규/삭제) + 테이블(원본 sap.m.Table 대응). 패널(접이식 카드) 아님.
    function _buildListPanel() {
        const oRoot = document.getElementById("snipListPanel");
        if (!oRoot) { return; }
        oRoot.innerHTML = "";

        // 헤더 행: 제목 + [신규 생성][삭제]
        const oHead = document.createElement("div");
        oHead.className = "u4aSnipListHead";

        const oTitle = document.createElement("span");
        oTitle.className = "u4aSnipListHead__title";
        oTitle.innerHTML = '<i class="fa-solid fa-rectangle-list"></i>';
        const oTitleTxt = document.createElement("span");
        oTitleTxt.textContent = wsMsg("360", "Snippet List");
        oTitle.appendChild(oTitleTxt);

        const oActs = document.createElement("div");
        oActs.className = "u4aSnipListHead__actions";

        oBtnNew = document.createElement("button");
        oBtnNew.type = "button";
        oBtnNew.className = "u4a-btn u4a-btn--emphasized u4aSnipHeadBtn";
        oBtnNew.innerHTML = '<i class="fa-solid fa-plus"></i><span></span>';
        oBtnNew.querySelector("span").textContent = wsMsg("361", "New");
        oBtnNew.addEventListener("click", newSnippet);

        oBtnDel = document.createElement("button");
        oBtnDel.type = "button";
        oBtnDel.className = "u4a-btn u4a-btn--negative u4aSnipHeadBtn";
        oBtnDel.innerHTML = '<i class="fa-solid fa-trash"></i><span></span>';
        oBtnDel.querySelector("span").textContent = wsMsg("029", "Delete");
        oBtnDel.addEventListener("click", deleteSnippet);

        oActs.appendChild(oBtnNew);
        oActs.appendChild(oBtnDel);
        oListActsBar = oActs;   // ⋯ 오버플로 배선 대상
        oHead.appendChild(oTitle);
        oHead.appendChild(oActs);

        // 테이블 스크롤 본문 + 공통 makeDataTable 생성
        const oBody = document.createElement("div");
        oBody.className = "u4aSnipListBody";
        const oTableHost = document.createElement("div");
        oTableHost.id = "snipTableHost";
        oBody.appendChild(oTableHost);

        oRoot.appendChild(oHead);
        oRoot.appendChild(oBody);

        _initListTable(oTableHost);
    }

    // 설명 TextArea growing — 원본 sap.m.TextArea(growing:true, growingMaxLines:5, 초기 2행).
    //   초기 2행 → 내용 늘면 최대 5행까지 자동 성장 → 그 이후 내부 스크롤. 높이는 JS 로 실측 조절.
    function _makeTextareaGrow(ta, iMin, iMax) {
        if (!ta) { return null; }
        ta.rows = iMin;
        ta.style.overflowY = "hidden";
        return function () {
            try {
                const cs = getComputedStyle(ta);
                const lh = parseFloat(cs.lineHeight) || 18;
                const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
                const bordV = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
                const bBorder = (cs.boxSizing === "border-box");
                const minH = lh * iMin + padV + bordV;
                const maxH = lh * iMax + padV + bordV;
                ta.style.height = "auto";
                let h = ta.scrollHeight + (bBorder ? bordV : 0);
                if (h < minH) { h = minH; }
                if (h >= maxH) { h = maxH; ta.style.overflowY = "auto"; } else { ta.style.overflowY = "hidden"; }
                ta.style.height = h + "px";
            } catch (e) { }
        };
    }

    function _buildInfoPanel() {
        oInfoPanel = U4AUI.createPanel({ title: wsMsg("362", "Snippet Basic Info") });

        oLanguField = U4AUI.createField({ type: "select", items: LANGU_ITEMS, onChange: onLanguChange });
        oNameField = U4AUI.createField({ type: "text", maxLength: 100, clear: true, onChange: onNameChange, onInput: _markDirty });
        oDescField = U4AUI.createField({ type: "textarea", rows: 2, maxLength: 200, onInput: function () { _markDirty(); if (_descFit) { _descFit(); } } });
        _descFit = _makeTextareaGrow(oDescField.input, 2, 5);

        // 초기 미선택 상태.
        try { oLanguField.setValue(""); } catch (e) { }

        const oGrid = document.createElement("div");
        oGrid.className = "u4aSnipInfoGrid";

        // 언어(콤보)는 createField 가 .u4a-field 래퍼/메시지를 안 만든다 → 공통 구조로 직접 감싼다
        //   (.u4a-field = position:relative → .u4a-field__msg 가 입력칸 바로 아래 절대배치).
        const oLanguWrap = document.createElement("div");
        oLanguWrap.className = "u4a-field";
        oLanguWrap.appendChild(oLanguField.el);
        oLanguMsg = document.createElement("span");
        oLanguMsg.className = "u4a-field__msg";
        oLanguWrap.appendChild(oLanguMsg);
        oGrid.appendChild(_fieldBlock(wsMsg("001", "Language"), true, oLanguWrap));
        oGrid.appendChild(_fieldBlock(wsMsg("363", "Snippet Name"), true, oNameField.el));
        const oDescBlock = _fieldBlock(wsMsg("176", "Description"), false, oDescField.el);
        oDescBlock.classList.add("u4aSnipField--full");
        oGrid.appendChild(oDescBlock);

        oInfoPanel.body.appendChild(oGrid);

        // 상단 저장/취소(패널 헤더 액션 슬롯) — 원본은 커스텀 헤더 툴바 + 그 clone 을 푸터에 둔다(양쪽 동일 동작).
        oBtnSaveTop = document.createElement("button");
        oBtnSaveTop.type = "button";
        oBtnSaveTop.className = "u4a-btn u4a-btn--emphasized u4aSnipHeadBtn";
        oBtnSaveTop.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span></span>';
        oBtnSaveTop.querySelector("span").textContent = wsMsg("365", "Save");
        oBtnSaveTop.addEventListener("click", saveSnippet);

        oBtnCancelTop = document.createElement("button");
        oBtnCancelTop.type = "button";
        oBtnCancelTop.className = "u4a-btn u4a-btn--negative u4aSnipHeadBtn";
        oBtnCancelTop.innerHTML = '<i class="fa-solid fa-xmark"></i><span></span>';
        oBtnCancelTop.querySelector("span").textContent = wsMsg("003", "Cancel");
        oBtnCancelTop.addEventListener("click", cancelSnippet);

        oInfoPanel.actions.appendChild(oBtnSaveTop);
        oInfoPanel.actions.appendChild(oBtnCancelTop);

        document.getElementById("snipInfoPanel").appendChild(oInfoPanel.el);
    }

    function _buildEditorFrame() {
        oState.monacoTheme = _monacoThemeNow();
        const oFrame = document.getElementById("snipEditor");
        if (!oFrame) { return; }
        const oParams = { HOSTID: HOSTID, LANG: "plaintext", THEME: oState.monacoTheme, READONLY: true };
        // 에디터 시리즈 호스트(editorPopup/host — 꾸밈정렬 capability evt:"fmtcap" 지원). ?PARAMS 초기값 주입.
        oFrame.src = "../../editorPopup/host/index.html?PARAMS=" + encodeURIComponent(JSON.stringify(oParams));
    }

    function _bindTitlebar() {
        // 로고
        const oLogo = document.getElementById("snipLogo");
        if (oLogo) {
            try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
        }
        // 제목
        const oTitle = document.getElementById("snipTitle");
        if (oTitle) { oTitle.textContent = wsMsg("343", document.title || "Snippet Designer"); }

        // 닫기
        const oClose = document.getElementById("snipWinClose");
        if (oClose) { oClose.addEventListener("click", fn_close); }

        // 최대화 토글 + 아이콘 동기.
        const oMax = document.getElementById("snipWinMax");
        if (oMax) {
            const _syncMaxIcon = function () {
                try {
                    const oI = oMax.querySelector("i");
                    if (oI) { oI.className = CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
                } catch (e) { }
            };
            oMax.addEventListener("click", function () {
                try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
            });
            try { CURRWIN.on("maximize", _syncMaxIcon); CURRWIN.on("unmaximize", _syncMaxIcon); } catch (e) { }
            _syncMaxIcon();
        }
    }

    function fn_close() {
        if (oState.isBusy) { return; }   // busy 중 닫기 차단
        try { U4AUI.closeWindow(CURRWIN); } catch (e) { console.error("[스니펫디자이너] 닫기 오류:", e); }
    }

    function _bindStaticTexts() {
        const oEmptyTitle = document.getElementById("snipEmptyTitle");
        if (oEmptyTitle) { oEmptyTitle.textContent = wsMsg("358", "No item selected!"); }
        const oEmptyDesc = document.getElementById("snipEmptyDesc");
        if (oEmptyDesc) { oEmptyDesc.textContent = wsMsg("359", "Select a snippet from the list."); }
        const oCodeTitle = document.getElementById("snipCodeTitle");
        if (oCodeTitle) { oCodeTitle.textContent = wsMsg("364", "Snippet Code"); }
        const oFmtTxt = document.getElementById("snipFormatText");
        if (oFmtTxt) { oFmtTxt.textContent = mcMsg("/U4A/CL_WS_COMMON", "C25", "Pretty Print"); }
        const oSaveTxt = document.getElementById("snipBtnSaveText");
        if (oSaveTxt) { oSaveTxt.textContent = wsMsg("365", "Save"); }
        const oCancelTxt = document.getElementById("snipBtnCancelText");
        if (oCancelTxt) { oCancelTxt.textContent = wsMsg("003", "Cancel"); }
    }

    function initUIBuild() {
        _bindTitlebar();
        _bindStaticTexts();
        _buildListPanel();
        _buildInfoPanel();
        _buildEditorFrame();

        // 저장/취소.
        oBtnSave = document.getElementById("snipBtnSave");
        oBtnCancel = document.getElementById("snipBtnCancel");
        oBtnSave.addEventListener("click", saveSnippet);
        oBtnCancel.addEventListener("click", cancelSnippet);

        // 코드 에디터 툴바 한 세트(확대/축소·줌%·꾸밈정렬) — 공통 UX(에디터=한 세트).
        const _byId = function (id) { return document.getElementById(id); };
        if (_byId("snipZoomOut")) { _byId("snipZoomOut").addEventListener("click", function () { _toHost({ cmd: "fontZoomOut" }); }); }
        if (_byId("snipZoomBtn")) { _byId("snipZoomBtn").addEventListener("click", function () { _toHost({ cmd: "fontZoomReset" }); }); }
        if (_byId("snipZoomIn")) { _byId("snipZoomIn").addEventListener("click", function () { _toHost({ cmd: "fontZoomIn" }); }); }
        if (_byId("snipFormatBtn")) { _byId("snipFormatBtn").addEventListener("click", function () { _toHost({ cmd: "format" }); }); }
        _setZoomLabel(100);
        _setFormatCap(false);   // 언어 반영(fmtcap) 전까지 비활성.

        // 좌|우 스플리터(공통).
        try { U4AUI.wireSplitter(document.getElementById("snipSplit"), { axis: "x" }); } catch (e) { console.error("[스니펫디자이너] 스플리터 배선 오류:", e); }

        // 테마 변경 추종 — U4ATheme.apply() 가 쏘는 u4a-theme-changed 를 받아 에디터 테마도 전환.
        //   (IPC if-p13n-themeChange 핸들러도 결국 U4ATheme.apply 를 부르므로 이 한 곳으로 수렴.)
        try { if (window.U4ATheme && U4ATheme.onChange) { U4ATheme.onChange(_applyMonacoTheme); } }
        catch (e) { console.error("[스니펫디자이너] 테마 변경 구독 오류:", e); }

        // 헤더/툴바 반응형 오버플로(⋯) — 공통 U4AUI.attachOverflow(§11). 좁아지면 넘치는 액션을 ⋯ 로 접는다.
        //   ★ btnClass 를 반드시 넘긴다 — 기본값(u4a-tx-*)은 테마 CSS 미정의라 브라우저 기본 박스로 뜬다.
        //     레퍼런스(bindShared/fnP13nDesignPopupOpen)처럼 화면 툴바 버튼과 동일 스타일로 맞춘다(여기선 평면 u4aSnipFlat).
        try { _ovfTools = U4AUI.attachOverflow(document.getElementById("snipEdTools"), { noOvfAutoMargin: true, btnClass: "u4a-btn u4aSnipFlat u4aSnipOvfBtn" }); }
        catch (e) { console.error("[스니펫디자이너] 코드 툴바 오버플로 배선 오류:", e); }
        try { if (oListActsBar) { _ovfActs = U4AUI.attachOverflow(oListActsBar, { noOvfAutoMargin: true, btnClass: "u4a-btn u4aSnipFlat u4aSnipOvfBtn" }); } }
        catch (e) { console.error("[스니펫디자이너] 리스트 헤더 오버플로 배선 오류:", e); }
        try { if (oInfoPanel && oInfoPanel.actions) { _ovfInfoActs = U4AUI.attachOverflow(oInfoPanel.actions, { noOvfAutoMargin: true, btnClass: "u4a-btn u4aSnipFlat u4aSnipOvfBtn" }); } }
        catch (e) { console.error("[스니펫디자이너] 기본정보 헤더 오버플로 배선 오류:", e); }

        // 초기 데이터 로드 + 렌더 + 빈상태.
        oState.list = _readList();
        renderList();
        _showEmpty();
    }

    /* ==================================================================
     * 11. 라이프사이클
     * ================================================================== */
    // opener 초기 데이터(scope/theme) — 없어도 동작(테마/타이틀은 쿼리로 이미 반영).
    IPCRENDERER.on("if-data", function (event, oData) {
        try { oState.scopeCode = (oData && oData.scopeCode) || ""; } catch (e) { }
    });

    document.addEventListener("DOMContentLoaded", function () {
        try {
            // BroadCast Event 걸기 — 원본 frame.js 는 UI 빌드보다 먼저 건다(동일 순서).
            _attachBroadCastEvent();

            initUIBuild();

            // 실시간 테마 변경 추종 등록(원본 frame.js 동일).
            if (_THEME_CH) { try { IPCMAIN.on(_THEME_CH, _onThemeChange); } catch (e) { console.error("[스니펫디자이너] 테마 IPC 등록 오류:", e); } }

            // 준비 완료 → 창 노출(플래시 방지: opener show:false 로 열림).
            requestAnimationFrame(function () {
                try { CURRWIN.show(); } catch (e) { }
                document.body.classList.add("u4a-visible");
                fn_setBusy(false);
            });
        } catch (e) {
            console.error("[스니펫디자이너] 초기화 오류:", e);
            try { CURRWIN.show(); } catch (e2) { }
        }
    });

    // 창 제거 시 IPC 리스너 해제(누수 방지) + 방송 채널 종료.
    window.addEventListener("pagehide", function () {
        if (_THEME_CH) { try { IPCMAIN.removeListener(_THEME_CH, _onThemeChange); } catch (e) { } }
        if (_oBroadToChild) { try { _oBroadToChild.close(); } catch (e) { } _oBroadToChild = null; }
    }, { once: true });

    // busy 중 닫기 차단.
    window.onbeforeunload = function () {
        if (oState.isBusy) { return false; }
    };

})();
