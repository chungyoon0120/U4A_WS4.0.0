/************************************************************************
 * ws_html5_usp.js  (HTML5)  — WS30 USP 코드에디터 "셸"
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 — U1 단계: WS30 셸 + 트리 + 속성 + 에디터 열기(읽기)]
 *  원본 ws_usp.js(UI5 sap.m.Page / sap.ui.table.TreeTable / JSONModel / iframe)
 *  → 순수 HTML5(DOM + flex + CSS + 바닐라 JS) 로 재구현한다.
 *  권위 스펙: .analy/04_WS30_USP_코드에디터.md, 셸 테마: .analy/12 (theme/tokens.css).
 *
 *  - 본 파일은 library-preload.js 의 로드 목록에서 ws_html5_shell.js·원본 ws_usp*.js
 *    "보다 뒤" 에 위치하여, shell 의 fnOnMoveToPage("WS30") placeholder 분기와
 *    원본 UI5 빌더(fnMoveToWs30 / fnUspTreeTableRowSelect) 를 override 한다.
 *    (원본 ws_usp*.js 는 수정하지 않음 — 롤백/참조 보존.)
 *
 *  - 보존(불변, 9장 표 A): 서버 Ajax(/usp_init_prc, /usp_get_object_line_data),
 *    sendAjax, Node FS(SVG 아이콘), @electron/remote, Monaco iframe 플러밍
 *    (onFrameLoadUspEditor / sendEditorPostMessageAll / getSelectedUspLineData /
 *     USP_EDITOR_CHANNEL — 원본 ws_usp*.js 가 정의, UI5 비의존 → 그대로 재사용).
 *
 *  - 1차 보류(다음 단계): 저장/활성화, Display↔Change 모드전환(서버 lock),
 *    컨텍스트메뉴 CRUD, 패턴/스니펫, New Window, 멀티(2분할) 에디터/Pretty/풀스크린.
 *    해당 버튼은 표시하되 클릭은 try/catch 가드(미구현 시 푸터 안내).
 *
 *  - 트리 렌더는 ws_html5_usp_tree.js, 에디터 iframe 은 ws_html5_usp_editor.js 가 담당
 *    (각각 oAPP.fn.fnRenderUspTree / oAPP.usphtml.editor* 를 정의).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    // 전역 onError 안전 가드 — "ResizeObserver loop limit exceeded / completed with undelivered
    //   notifications" 는 브라우저가 던지는 무해한 경고다(레이아웃은 정상 정착). 이 앱의 window.onerror
    //   (ws_trycatch)가 이를 Critical Error 로 띄우므로, 그 메시지만 삼키고 나머지는 원본 핸들러로
    //   위임한다. (공통 ws_trycatch 는 수정하지 않고 1회 래핑.) rAF 지연(_observeResize)으로 발생
    //   자체를 막지만, 공통 attachOverflow 등 다른 RO 소스 대비 안전망.
    (function () {
        if (window.__uspRoGuard) { return; }
        window.__uspRoGuard = true;
        var _prevOnError = window.onerror;
        window.onerror = function (message) {
            if (message && String(message).indexOf("ResizeObserver loop") !== -1) { return true; }
            return _prevOnError ? _prevOnError.apply(this, arguments) : false;
        };
    })();

    // 네임스페이스 보장 (원본 ws_usp.js 가 먼저 만들지만 방어적)
    oAPP.usp = oAPP.usp || {};
    oAPP.ui = oAPP.ui || {};
    oAPP.attr = oAPP.attr || {};
    oAPP.usphtml = oAPP.usphtml || {};

    // FontAwesome 7.2.0 (다른 화면과 동일 — ws10_html.js / ws_html5_ws20.js ICON 규칙)
    function _fa(sName, bBrand) {
        return '<i class="' + (bBrand ? "fa-brands" : "fa-solid") + ' fa-' + sName + '"></i>';
    }

    // HTML escape (innerHTML 삽입 안전)
    function _esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /************************************************************************
     * 라벨 메시지 — 서버 메시지 클래스 단일 출처에서만(영문 사전/폴백 금지).
     *   · _msg(코드)   : /U4A/CL_WS_COMMON (A05/B66/C17 …). 원본 fnGetMsgClsText 동일.
     *   · _wsMsg(번호) : ZMSG_WS_COMMON_001 (059/068/808 …). 원본 oAPP.msg.M0xx 동일.
     *   M0xx 키는 ZMSG_WS_COMMON_001 "번호"(M 제거)로 라우팅(ws-language-mechanism).
     ************************************************************************/
    function _msg(sNum) {
        if (/^M\d{3}$/.test(sNum)) { return _wsMsg(sNum.slice(1)); }
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }
    function _wsMsg(sNr) {
        try {
            var lg = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(lg, "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    // 모듈 공용 노출(트리/에디터 모듈이 동일 라벨 출처 사용)
    oAPP.usphtml._msg = _msg;
    oAPP.usphtml._wsMsg = _wsMsg;
    oAPP.usphtml._fa = _fa;
    oAPP.usphtml._esc = _esc;

    // 모델 안전 읽기
    function _model(sPath) {
        try {
            var v = APPCOMMON.fnGetModelProperty(sPath);
            if (v != null) { return v; }
        } catch (e) { }
        return null;
    }

    /************************************************************************
     * WS30 옵저버/리스너 중앙 관리 (누수·중복 방지 단일 출처)
     * ---------------------------------------------------------------------
     *  키별로 ResizeObserver(또는 window resize 폴백) 1개만 유지. 같은 키로 다시
     *  observeResize 하면 이전 것을 먼저 정리한다. 셸 재구성/에디터 비움 시 키 단위로
     *  또는 일괄(disconnectAll) 해제한다. (트리 분할바 = "treeSplit", 에디터 분할바 = "editorSplit")
     *  ws_html5_usp_editor.js 도 동일 레지스트리(oAPP.usphtml.observeResize)를 쓴다.
     ************************************************************************/
    oAPP.attr.uspObservers = oAPP.attr.uspObservers || {};

    function _disconnectObserver(sKey) {
        var rec = oAPP.attr.uspObservers[sKey];
        if (!rec) { return; }
        try { if (rec.ro) { rec.ro.disconnect(); } } catch (e) { }
        try { if (rec.winFn) { window.removeEventListener("resize", rec.winFn); } } catch (e) { }
        try { if (rec.raf) { cancelAnimationFrame(rec.raf); rec.raf = 0; } } catch (e) { }
        delete oAPP.attr.uspObservers[sKey];
    }

    function _observeResize(sKey, oTarget, fnCb) {
        _disconnectObserver(sKey);                 // 같은 키 이전 옵저버 정리(중복 방지)
        if (!oTarget || typeof fnCb !== "function") { return; }
        var rec = {};
        // ★ 콜백을 requestAnimationFrame 으로 지연 + 코얼레싱.
        //   ResizeObserver 콜백 안에서 관찰 대상의 레이아웃을 바로 바꾸면(예: 폼 반응형이 data-narrow
        //   토글→그리드 높이 변경) 브라우저가 "ResizeObserver loop limit exceeded" 를 던지고,
        //   이 앱의 전역 window.onerror(ws_trycatch) 가 그걸 Critical Error 로 띄운다. rAF 로 미뤄
        //   같은 전달 사이클 밖에서 처리 → 루프 경고 자체가 발생하지 않게 한다.
        function _schedule() {
            if (rec.raf) { return; }
            rec.raf = requestAnimationFrame(function () {
                rec.raf = 0;
                try { fnCb(); } catch (e) { console.error("[HTML5][WS30] resize cb error:", sKey, e); }
            });
        }
        try {
            if (window.ResizeObserver) {
                rec.ro = new ResizeObserver(_schedule);
                rec.ro.observe(oTarget);
            } else {
                rec.winFn = _schedule;
                window.addEventListener("resize", rec.winFn);
            }
        } catch (e) { console.error("[HTML5][WS30] observeResize error:", sKey, e); }
        oAPP.attr.uspObservers[sKey] = rec;
    }

    function _disconnectAllObservers() {
        var o = oAPP.attr.uspObservers || {};
        Object.keys(o).forEach(function (k) { _disconnectObserver(k); });
    }

    // 에디터 모듈 등에서 동일 레지스트리 사용
    oAPP.usphtml.observeResize = _observeResize;
    oAPP.usphtml.disconnectObserver = _disconnectObserver;
    oAPP.usphtml.disconnectAllObservers = _disconnectAllObservers;

    /************************************************************************
     * 멀티파트 응답 파서 (구 _getUspMultiPartData [ws_usp.js:5626] 1:1 이식)
     *   원본은 IIFE-private 라 외부에서 못 부른다 → 동일 로직 포팅(Node 'dicer' 사용, UI5 무관).
     ************************************************************************/
    function _uspMultiPart(res_data, xhr) {
        return new Promise(function (resolve) {
            try {
                var contentType = xhr.getResponseHeader("Content-Type");
                var boundary = contentType && contentType.split("boundary=")[1];

                if (!xhr.response || xhr.response.type !== "multipart/form-data") { return resolve({ RETCD: "E" }); }
                if (typeof boundary === "undefined") { return resolve({ RETCD: "E" }); }

                var dicer = parent.require("dicer");
                var parser = new dicer({ boundary: boundary });
                var oPartData = {};

                parser.on("part", function (part) {
                    part.on("header", function (header) { part._name = header["content-disposition"][0]; });
                    part.on("data", function (data) { oPartData[part._name] = data.toString(); });
                });
                parser.on("finish", function () { resolve({ RETCD: "S", RDATA: oPartData }); });

                parser.write(res_data);
                parser.end();
            } catch (e) {
                console.error("[HTML5][WS30] _uspMultiPart error:", e);
                resolve({ RETCD: "E" });
            }
        });
    }

    /************************************************************************
     * WS30 윈도우 메뉴 데이터 (원본 fnGetWindowMenuWS30 / fnGetWindowMenuListWS30 미러)
     *   sap-icon → FontAwesome 매핑. ws10_html.js 의 공유 buildMenubar 가 소비.
     *   카테고리: Utilities(B35)/System(B36)/Help(B39)/Test(B69, staffOnly).
     ************************************************************************/
    function _getWindowMenuWS30() {

        var bIconViewer = true;
        try { bIconViewer = APPCOMMON.checkWLOList("C", "UHAK900630"); } catch (e) { }

        var aMenu = [
            { key: "WMENU20", text: _msg("B35"), items: [
                { key: "WMENU20_01", icon: "globe", text: _msg("B49") },        // Select Browser Type
                { key: "WMENU20_03", icon: "video", text: _wsMsg("808") },      // Screen Recording
                { key: "WMENU20_05", icon: "code", text: _wsMsg("059") }        // Source Pattern
            ] },
            { key: "WMENU30", text: _msg("B36"), items: [
                { key: "WMENU30_01", icon: "window-restore", text: _msg("A09") },          // New Window
                { key: "WMENU30_02", icon: "xmark", text: _msg("B51") },                   // Close Window
                { key: "WMENU30_03", icon: "gear", text: _msg("B52") },                    // Options
                { key: "WMENU30_04", icon: "right-from-bracket", text: _msg("B53") },      // Logoff
                { key: "WMENU30_06", icon: "user-gear", text: _msg("B55"), items: [        // Administrator
                    { key: "WMENU30_06_01", icon: "bug", text: _wsMsg("252") },            // DevTool
                    { key: "WMENU30_06_02", icon: "note-sticky", text: _msg("B54") },      // Release Notes
                    { key: "WMENU30_06_03", icon: "triangle-exclamation", text: _msg("B70") } // Error Log
                ] },
                { key: "WMENU30_07", icon: "server", text: _msg("C42") }                   // Server Information
            ] },
            { key: "WMENU50", text: _msg("B39"), items: [
                { key: "WMENU50_01", icon: "book-open-reader", text: _msg("B44") },         // U4A Help Document
                { key: "WMENU50_04", icon: "keyboard", text: _wsMsg("253") }               // Keyboard Shortcut List
            ] },
            { key: "Test10", text: _msg("B69"), staffOnly: true, items: [
                { key: "Test97", text: "개발툴" },
                { key: "Test86", text: "모나코 에디터 테마 디자이너" },
                { key: "Test85", text: "모나코 에디터 스니펫 생성기" }
            ] }
        ];

        // Icon Viewer(WMENU20_04) — WLO 활성 시에만 노출 (원본 visible 조건)
        if (bIconViewer) {
            aMenu[0].items.push({ key: "WMENU20_04", icon: "icons", text: _wsMsg("068"), items: [
                { key: "WMENU20_04_01", icon: "icons", text: _wsMsg("047") },   // Icon List
                { key: "WMENU20_04_02", icon: "image", text: _wsMsg("067") }    // Image Icons
            ] });
        }

        return aMenu;
    }

    // WS30 메뉴 항목 선택 → 핸들러 위임.
    //   WS30(USP) 상단 메뉴는 WS10 과 동일 항목·동일 키 체계를 공유한다
    //   (Utilities=WMENU20 / System=WMENU30 / Help=WMENU50). WS20 은 키가 다르므로(System=WMENU40,
    //   WMENU30=Editor) 폴백 대상에서 제외 — WS30 전용 fnWS30* 가 없으면 이미 구현된 fnWS10* 로 위임한다.
    //   (Select Browser·Options·Server Info·Help·Source Pattern·Icon List 등 전부 앱 비종속 공통 동작)
    function _ws30MenuSelect(it) {
        var fn = oAPP.fn["fnWS30" + it.key] || oAPP.fn["fnWS10" + it.key];
        if (typeof fn === "function") {
            try { fn(); } catch (e) { console.error("[HTML5][WS30] menu " + it.key + " error:", e); }
            return;
        }
        console.warn("[HTML5][WS30] menu not implemented:", it.key);
        try { oAPP.common.fnShowFloatingFooterMsg("I", "WS30", (it.text || it.key) + " — 변환 예정"); } catch (e) { }
    }

    /************************************************************************
     * 트랜잭션 버튼 1개 (구 sap.m.Button) — WS20 _txBtn 와 동일 컴포넌트(.u4a-tx-btn).
     *   oCfg: { id, fa, brand, text, tooltip, ev, evFn, reject }
     *     - ev   : oAPP.events[ev] 위임(가드). evFn: 직접 콜백(우선).
     ************************************************************************/
    function _txBtn(oCfg) {
        var BTN = document.createElement("button");
        BTN.type = "button";
        if (oCfg.id) { BTN.id = oCfg.id; }
        BTN.className = "u4a-tx-btn" + (oCfg.reject ? " u4a-tx-btn--reject" : "");
        BTN.title = oCfg.tooltip || oCfg.text || "";
        BTN.innerHTML = (oCfg.fa ? _fa(oCfg.fa, oCfg.brand) : "")
            + (oCfg.text ? "<span>" + _esc(oCfg.text) + "</span>" : "");

        BTN.addEventListener("click", function () {
            if (typeof oCfg.evFn === "function") {
                try { oCfg.evFn(); } catch (e) { console.error("[HTML5][WS30] tx action error:", oCfg.id, e); }
                return;
            }
            if (oCfg.ev) {
                var fn = oAPP.events && oAPP.events[oCfg.ev];
                if (typeof fn !== "function") {
                    console.warn("[HTML5][WS30] transaction action not implemented:", oCfg.ev);
                    try { oAPP.common.fnShowFloatingFooterMsg("I", "WS30", (oCfg.text || oCfg.tooltip || oCfg.ev) + " — 변환 예정"); } catch (e) { }
                    return;
                }
                try { fn(); } catch (e) { console.error("[HTML5][WS30] transaction action error:", oCfg.ev, e); }
            }
        });
        return BTN;
    }

    function _sep(sId) {
        var S = document.createElement("span");
        S.className = "u4a-tx-sep";
        if (sId) { S.id = sId; }
        return S;
    }

    // 트리 툴바 아이콘 버튼 — WS20 트리 툴바(_tbBtn, .u4a-btn-icon + .u4aWs20TreeTbIcon)와 동일.
    function _treeTbBtn(sFa, sTip, fnPress) {
        var B = document.createElement("button");
        B.type = "button";
        B.className = "u4a-btn-icon";
        B.title = sTip || "";
        B.innerHTML = '<span class="u4aWs30TreeTbIcon">' + _fa(sFa) + "</span>";
        B.addEventListener("click", function () {
            try { fnPress(); } catch (e) { console.error("[HTML5][WS30] tree toolbar:", sFa, e); }
        });
        return B;
    }

    /************************************************************************
     * (A) 앱 헤더 줄 (구 fnGetSubHeaderWs30)
     *   [← APPID  모드  상태 | NewWindow] ...  — 텍스트는 fnUpdateUspAppHeader 가 채움.
     ************************************************************************/
    function _buildUspAppHeader() {

        var HDR = document.createElement("div");
        HDR.id = "ws30AppHeader";
        HDR.className = "u4aWs30AppHeader";

        // 뒤로가기 (←) — 원본 ev_pressWs30Back. 1차: WS30→WS10 안전 이동(미저장 프롬프트는 다음 단계).
        var BACK = document.createElement("button");
        BACK.type = "button";
        BACK.id = "ws30AppHeaderBackBtn";
        BACK.className = "u4aWs30AppHdrBtn back";
        BACK.title = "Back";
        BACK.innerHTML = _fa("chevron-left");
        BACK.addEventListener("click", _uspBack);
        HDR.appendChild(BACK);

        var APPID = document.createElement("span");
        APPID.id = "ws30AppHeaderAppId";
        APPID.className = "u4aWs30AppHdrAppId";
        HDR.appendChild(APPID);

        var MODE = document.createElement("span");
        MODE.id = "ws30AppHeaderMode";
        MODE.className = "u4aWs30AppHdrMode";
        HDR.appendChild(MODE);

        var STAT = document.createElement("span");
        STAT.id = "ws30AppHeaderStatus";
        STAT.className = "u4aWs30AppHdrStat";
        HDR.appendChild(STAT);

        // New Window (구 ws30_newWindowBtn, sap-icon://create) — WS10/WS20 와 동일 통일(window-restore + A09).
        var NEWWIN = document.createElement("button");
        NEWWIN.type = "button";
        NEWWIN.id = "ws30AppHeaderNewWinBtn";
        NEWWIN.className = "u4aWs30AppHdrBtn";
        NEWWIN.title = _msg("A09") + " (Ctrl+N)";
        NEWWIN.innerHTML = _fa("window-restore");
        NEWWIN.addEventListener("click", function () {
            if (oAPP.events && typeof oAPP.events.ev_NewWindow === "function") {
                try { oAPP.events.ev_NewWindow(); return; } catch (e) { console.error("[HTML5][WS30] ev_NewWindow error:", e); }
            }
            console.warn("[HTML5][WS30] ev_NewWindow not available");
        });
        HDR.appendChild(NEWWIN);

        var SPC = document.createElement("span");
        SPC.className = "u4aWs30AppHdrSpacer";
        HDR.appendChild(SPC);

        return HDR;
    }

    // WS30 전용 WS10 복귀.
    // ws_fn_02.js fnMoveToWs10(WS20 전용)을 직접 쓰지 않는 이유:
    //   fnMoveToWs10 → removeContent() 가 WS20 DOM/상태를 지우므로
    //   WS30에서 호출하면 WS20 콘텐츠가 날아간다.
    function _doBackToWs10() {

        try {
            // busy + navLock 은 _uspBack 에서 이미 걸려 있다.
            // 단축키는 비동기 이동이 시작되기 전에 즉시 제거한다.
            try { APPCOMMON.removeShortCut("WS30"); } catch (e) { }

            // 서버 세션 종료 → lf_success 에서 잠금 해제 + WS10 이동
            oAPP.fn.fnKillUserSession(parent.getAppInfo(), lf_success);

        } catch (e) {
            console.error("[HTML5][WS30] _doBackToWs10 error:", e);
            try { oAPP.common.fnNaviRelease(); } catch (x) { }
        }

        async function lf_success() {
            try {
                var oInfo = parent.getAppInfo();

                // Change 모드였다면 서버 Lock 해제
                if (oInfo && oInfo.IS_EDIT === "X") {
                    await new Promise(function (resolve) {
                        ajax_unlock_app({ APPID: oInfo.APPID, ACTCD: "APP_EXIT" }, function (oReturn) {
                            if (oReturn.RTCOD === "E") {
                                parent.setSoundMsg("02");
                                try { parent.CURRWIN.flashFrame(true); } catch (e) { }
                                parent.showMessage(null, 20, oReturn.RTCOD, oReturn.RTMSG, fnCriticalError);
                                oAPP.common.fnSetBusyLock("");
                                oAPP.common.fnNaviRelease();
                                return;
                            }
                            return resolve(oReturn);
                        });
                    });
                }

                // WS30 팝업·자식창 정리 (fnCloseAllWs20Dialogs 와 동일한 4가지 처리)
                // removeContent() 는 WS20 DOM 전용이므로 호출하지 않는다 — fnMoveToWs10 에서
                // fnCloseAllWs20Dialogs 와 removeContent 는 별도 순차 호출임에 주의.
                try { oAPP.fn.fnChildWindowClose(); } catch (e) { }
                try { oAPP.fn.fnCloseAllDialog(); } catch (e) { }
                try { APPCOMMON.fnHideFloatingFooterMsg(); } catch (e) { }
                try { APPCOMMON.fnMultiFooterMsgClose(); } catch (e) { }

                // WS30 모델 초기화 — 원본과 동일하게 {} 로 초기화. WS20 모델·DOM 은 건드리지 않는다
                try { APPCOMMON.fnSetModelProperty("/WS30", {}); } catch (e) { }

                // AppInfo 초기화
                parent.setAppInfo(undefined);

                // WS10 으로 이동
                oAPP.fn.fnOnMoveToPage("WS10");

                // WS10 단축키 등록
                APPCOMMON.setShortCut("WS10");

                // 타이틀 복원
                try { parent.CURRWIN.setTitle("U4A Workspace - Main"); } catch (e) { }
                oAPP.common.setWSHeadText("U4A Workspace - Main");

                // NavLock 해제 (이제 WS10 단축키 허용)
                oAPP.common.fnNaviRelease();

            } catch (e) {
                console.error("[HTML5][WS30] _doBackToWs10 lf_success error:", e);
                try { oAPP.common.fnNaviRelease(); } catch (x) { }
            }
        }
    }

    /************************************************************************
     * 뒤로가기 (구 ev_pressWs30Back → fnMoveBack_Ws30_To_Ws10) — WS20 ev_pageBack 과 동일 UX.
     *   변경분(IS_CHAG="X") + Change 모드일 때만 저장 질문(MSG_WS 118/119, Yes/No/Cancel).
     *   그 외엔 바로 이동.
     ************************************************************************/
    function _uspBack() {

        // Change/Display 모드 전환이 진행 중이면 F3 즉시 차단 (mousedown→click 사이 타이밍 경쟁 방어)
        if (oAPP.attr.uspModeChanging) { return; }

        // ── F3(뒤로가기) 연타·재진입 가드 — 코드베이스 공통 메커니즘(fnNaviLock) 사용 ──────────
        //  뒤로가기를 시작하는 순간 "페이지이동 in-flight 락"(fnNaviLock → isNaviBusy=true)을 건다.
        //  이 락은 모든 단축키가 거치는 중앙 가드(fnShortCutExeAvaliableCheck)가 보므로, 이동/저장확인
        //  팝업이 끝날 때까지 F3·Ctrl+F1 등 모든 단축키 연타가 통째로 막힌다(비동기 구간 내내).
        //  ※ 직전 가드(uspNavLeaving)는 이 중앙 가드가 보지 않는 별개 플래그라 확인팝업 경로에 구멍이
        //    있었음 → fnMoveToWs10 가 쓰는 정식 락으로 통일.
        //   · 바로 이동   → fnMoveToWs10 완료/실패 시 fnNaviRelease (그 안에서 처리).
        //   · 저장확인    → "머무름"(Cancel/저장미구현) 선택 시 _uspBackCb 가 fnNaviRelease, "나가기"는 유지.
        //  (Back 버튼 클릭은 단축키 중앙 가드를 안 거치므로 여기서 직접 락 상태도 본다 — 버튼 더블클릭 방어.)
        if (oAPP.attr.isNaviBusy === true) { return; }
        oAPP.common.fnNaviLock();

        var oApp = _model("/WS30/APP") || {};
        var bChag = (oApp.IS_CHAG === "X");
        var bEdit = (oApp.IS_EDIT === "X");

        // 변경 없거나 display 모드 → 묻지 않고 바로 이동
        if (!bChag || !bEdit) {
            oAPP.common.fnSetBusyLock("X");
            _doBackToWs10();
            return;
        }

        var sMsg = _msgWs("118") + " \n " + _msgWs("119"); // 변경됨 / 저장 후 나갈까요?

        // 저장확인 팝업 — 자식 팝업 잠시 숨김(원본 동일). 팝업 동안 위 락이 단축키 연타를 막는다.
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }

        if (oAPP.common && typeof oAPP.common.fnConfirmBox === "function") {
            oAPP.common.fnConfirmBox("W", sMsg, _uspBackCb, [
                { act: "YES", label: "Yes", emphasized: true },
                { act: "NO", label: "No" },
                { act: "CANCEL", label: "Cancel" }
            ]);
        } else {
            _uspBackCb(window.confirm(sMsg) ? "YES" : "CANCEL");
        }
    }

    // 저장 질문 콜백 (구 fnMoveBack_Ws30_To_Ws10Cb)
    function _uspBackCb(ACTCD) {

        // CANCEL/닫기 → 머무름: 페이지이동 락 해제(단축키 재허용) + 숨긴 팝업 복원
        if (ACTCD == null || ACTCD === "CANCEL") {
            try { oAPP.common.fnNaviRelease(); } catch (e) { }
            try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
            return;
        }

        // YES → 저장 후 이동.
        //   ★ WS30(USP) 저장은 원본 ws_usp.js 의 ws30_saveBtn 전용 ev_pressSaveBtn(/usp_save_active_appdata)
        //     이며 아직 미이식(WS30 2차). **WS20 의 oAPP.events.ev_pressSaveBtn 을 부르면 안 된다**
        //     (그건 디자인앱 저장이라 USP 에선 "Package is required" 에러가 난다).
        //   → WS30 전용 저장 훅(oAPP.fn.fnSaveUspWs30, 2차에서 정의)이 있으면 위임, 없으면 안내 후 머무름.
        if (ACTCD === "YES") {
            var fnSave = oAPP.fn && oAPP.fn.fnSaveUspWs30;
            if (typeof fnSave === "function") {
                oAPP.common.fnSetBusyLock("X");
                try { fnSave({ ISBACK: "X" }); return; }   // 저장→이동: 락 유지(이동 완료 시 해제)
                catch (e) { oAPP.common.fnSetBusyLock(""); try { oAPP.common.fnNaviRelease(); } catch (x) { } console.error("[HTML5][WS30] save(ISBACK):", e); }
            }
            // 저장 미구현(2차) — 이동하지 않고 머무름 → 페이지이동 락 해제 + 안내.
            try { oAPP.common.fnNaviRelease(); } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("I", "WS30", _msg("A64") + " — 변환 예정"); // Save
            try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
            return;
        }

        // NO → 변경 버리고 이동
        _doBackToWs10();
    }

    /************************************************************************
     * 저장 / 액티브 액션 (툴바 버튼 + 단축키 공용).
     *   WS30 저장/활성화 서버흐름(원본 ws30_saveBtn/ws30_activateBtn → /usp_save_active_appdata)은
     *   UI5결합·미이식(WS30 2차). 전용 훅(oAPP.fn.fnSaveUspWs30/fnActivateUspWs30)이 있으면 위임,
     *   없으면 안내(변환 예정). Change 모드에서만(버튼 숨김 규칙과 동일).
     ************************************************************************/
    // 저장/액티브 — Change 모드에서만(버튼 숨김 규칙과 동일). 실제 로직은 fnSaveUspWs30/fnActivateUspWs30.
    function _uspSave() { if (_isEditMode() && oAPP.fn.fnSaveUspWs30) { oAPP.fn.fnSaveUspWs30(); } }
    function _uspActivate() { if (_isEditMode() && oAPP.fn.fnActivateUspWs30) { oAPP.fn.fnActivateUspWs30(); } }

    /************************************************************************
     * Application Execution (구 ev_AppExec, ws_usp.js) — ★ WS20/일반 ev_AppExec 과 다름.
     *   일반(ws_fn_01.js) ev_AppExec 은 USP 앱을 "USP apps are not supported"(MSG_WS 189)로 거부한다.
     *   USP 화면은 자체 실행 로직을 가진다(원본 그대로):
     *     · 비활성(ACTST==="I") → 사운드02+플래시+푸터경고(MSG_WS 031 "Only in activity state !!!")
     *     · 선택데이터 없음 / 폴더(ISFLD==="X") → 모달 E(MSG_WS 364 "Application cannot be execution.")+사운드02
     *     · 파일 → fnExeBrowser(USPDATA.SPATH) (ws_fn_02.js — 서버 URL 조립 후 브라우저 실행)
     ************************************************************************/
    function _uspAppExec() {
        var oAppInfo = _model("/WS30/APP") || {};

        // 비활성 상태에서는 실행하지 않는다.
        if (oAppInfo.ACTST === "I") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("W", "WS30", _msgWs("031")); // Only in activity state !!!
            return;
        }

        var oUspData = _model("/WS30/USPDATA");
        var sMsg = _msgWs("364"); // Application cannot be execution.

        // 선택 데이터 없음 또는 폴더 → 실행 불가.
        if (!oUspData || oUspData.ISFLD === "X") {
            try { parent.showMessage(null, 10, "E", sMsg); }
            catch (e) { oAPP.common.fnShowFloatingFooterMsg("E", "WS30", sMsg); }
            try { parent.setSoundMsg("02"); } catch (e) { }
            return;
        }

        // 파일 → SPATH 로 브라우저 실행.
        try { oAPP.fn.fnExeBrowser(oUspData.SPATH); }
        catch (e) {
            console.error("[HTML5][WS30] Application Execution(fnExeBrowser):", e);
            oAPP.common.fnShowFloatingFooterMsg("E", "WS30", sMsg);
        }
    }

    /************************************************************************
     * Controller (Class Builder) (구 ev_pressControllerBtn, ws_usp.js) — ★ 일반 핸들러와 파라미터 다름.
     *   일반(ws_events.js) ev_pressControllerBtn 은 execControllerClass() 를 "인자 없이" 호출 → oAppInfo 누락.
     *   USP 는 현재 앱 정보(/WS30/APP)를 4번째 인자로 넘겨야 한다(원본: execControllerClass(null,null,null,oAppInfo)).
     *   execControllerClass(METHNM, INDEX, TCODE, oAppInfo) — ws_common.js.
     ************************************************************************/
    function _uspControllerClass() {
        var oAppInfo = _model("/WS30/APP");
        try { oAPP.common.execControllerClass(null, null, null, oAppInfo); }
        catch (e) { console.error("[HTML5][WS30] Controller(Class Builder):", e); }
    }

    // MIME Repository (Ctrl+Shift+F12) — 버튼과 동일한 일반 핸들러(ev_pressMimeBtn → fnMimeWindowOpener) 호출.
    function _uspMime() {
        var fn = oAPP.events && oAPP.events.ev_pressMimeBtn;
        if (typeof fn === "function") { try { fn(); } catch (e) { console.error("[HTML5][WS30] MIME:", e); } }
    }

    // Code Editor Pretty Print (Shift+F1) — 에디터 모듈 핸들러 위임(가드는 그쪽이 소유).
    function _uspPrettyPrint() {
        if (oAPP.usphtml.editorPrettyPrint) { oAPP.usphtml.editorPrettyPrint(); }
    }

    /* ====================================================================
     * WS30 Display/Change 모드전환 · Save · Activate (원본 ws_usp.js 1:1 이식)
     *   UI5 의존부만 대체: sap.ui.getCore().byId/firePress/Event/getModel().refresh,
     *   showMessage(sap,..) → fnConfirmBox/footer. 서버 흐름(ajax_init_prc/ajax_unlock_app/
     *   /usp_save_active_appdata, FormData/Blob/멀티파트 헤더, SCRIPT eval)은 보존.
     * ==================================================================== */

    // 중첩 트리 → 평면 배열 (구 _parseTree2Tab) — USPTREE 자식키 제거.
    function _parseTree2Tab(aTree, sArrName) {
        var a = [];
        (function rec(arr) {
            $.each(arr, function (i, o) {
                if (o[sArrName]) { rec(o[sArrName]); delete o[sArrName]; }
                a.push(o);
            });
        })(JSON.parse(JSON.stringify(aTree)));
        return a;
    }

    // 선택(ISSEL) 노드 재귀 탐색 (구 _fnGetSelectedUspTreeData)
    function _fnGetSelectedUspTreeData(aTree) {
        if (!Array.isArray(aTree)) { return undefined; }
        for (var i = 0; i < aTree.length; i++) {
            var o = aTree[i];
            if (o.ISSEL === true) { return o; }
            if (Array.isArray(o.USPTREE) && o.USPTREE.length) {
                var r = _fnGetSelectedUspTreeData(o.USPTREE);
                if (r) { return r; }
            }
        }
        return undefined;
    }

    // Activate 성공 시 상태 A (구 setAppActive)
    function _setAppActive(b) {
        var o = _model("/WS30/APP") || {};
        if (b === "X") { o.ACTST = "A"; }
        APPCOMMON.fnSetModelProperty("/WS30/APP", o);
    }

    // 모드전환/저장 후 화면 갱신 (구 getModel().refresh + fnOnInitLayoutSettingsWs30 의 HTML5 대체)
    function _uspRefreshAfterMode() {
        try { oAPP.fn.fnUpdateUspAppHeader(); } catch (e) { }   // 헤더+툴바
        try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
        try { if (oAPP.fn.fnRenderUspProperties) { oAPP.fn.fnRenderUspProperties(); } } catch (e) { }
        try { if (oAPP.fn.fnRenderUspDoc) { oAPP.fn.fnRenderUspDoc(); } } catch (e) { }
        // 살아있는 에디터(재사용)에 모드별 읽기전용 상태 동기화 (재로드 없음).
        try { if (oAPP.usphtml.editorSetReadOnly) { oAPP.usphtml.editorSetReadOnly(!_isEditMode()); } } catch (e) { }
    }

    /* 구 fnOnInitLayoutSettingsWs30 (ws_usp.js:107) + ev_getRootNodeRowsUpdated (ws_usp.js:5835) 의 HTML5 대체.
     *   ─ 모드 전환(Display↔Change) 성공 시에만 호출 ─ (일반 저장 콜백에는 없음.)
     *   원본 동작: 트리 전체 접기 → 선택 해제 → 어떤 라인이 열려 있었든 **무조건 최상위 루트
     *   폴더를 자동 선택·표시**(ev_getRootNodeRowsUpdated → fnUspTreeTableRowSelect(루트행)).
     *   이로써 Change 에서 편집(더티) 후 Display 로 전환("저장? → 아니오") 하면 편집 중이던
     *   Monaco 버퍼가 버려지고 루트 문서 화면으로 돌아간다(파일 재선택 시 서버에서 원본 재조회).
     *   busy 는 루트 선택(fnUspTreeTableRowSelect)이 콜백에서 해제(원본도 여기서 release 안 함). */
    function _uspInitLayout() {
        // 트리 전체 접기
        try { if (oAPP.fn.fnUspTreeCollapseAll) { oAPP.fn.fnUspTreeCollapseAll(); } } catch (e) { }
        // 에디터 host 비우기 → 더티 Monaco 버퍼 폐기(루트 분기는 에디터를 비우지 않으므로 여기서 정리)
        try { if (oAPP.usphtml.editorClear) { oAPP.usphtml.editorClear(); } } catch (e) { }

        // 최상위 루트 노드(PUJKY === "") 찾기
        var aTree = [];
        try { aTree = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
        var oRoot = null;
        for (var i = 0; i < aTree.length; i++) {
            if (aTree[i] && (aTree[i].PUJKY === "" || aTree[i].PUJKY == null)) { oRoot = aTree[i]; break; }
        }
        if (!oRoot && aTree.length) { oRoot = aTree[0]; }

        if (oRoot && oAPP.fn.fnUspTreeTableRowSelect) {
            // 루트 자동 선택 → ajax(라인) → 선택표시 + 문서 페이지(USP30) + busy 해제
            oAPP.fn.fnUspTreeTableRowSelect(oRoot);
            return;
        }

        // 트리가 비어 루트가 없으면 인트로로 복귀 + busy 직접 해제
        try { if (oAPP.fn.fnOnUspTreeUnSelect) { oAPP.fn.fnOnUspTreeUnSelect(); } } catch (e) { }
        try { oAPP.usp.oSelectRowData = null; } catch (e) { }
        try { if (oAPP.fn.fnUspNavTo) { oAPP.fn.fnUspNavTo("USP10"); } } catch (e) { }
        oAPP.common.fnSetBusyLock("");
    }

    // 서버 SCRIPT eval 방어 (메모리: 전역 sap 안전스텁 + try/catch + busy 해제)
    function _uspEvalScript(sScript) {
        try { eval(sScript); }
        catch (e) {
            console.error("[HTML5][WS30] save SCRIPT eval error:", e);
            try { oAPP.common.fnSetBusyLock(""); } catch (x) { }
        }
    }

    /* === Save (구 ev_pressSaveBtn) ===
     *   oParams: { IS_ACT, TRKORR, PRCCD, ISBACK, ISDISP } (구 UI5 Event.getParameter 대체) */
    oAPP.fn.fnSaveUspWs30 = function (oParams) {
        oParams = oParams || {};
        oAPP.common.fnSetBusyLock("X");
        APPCOMMON.fnHideFloatingFooterMsg();

        var oAppData = _model("/WS30/APP") || {};
        var IS_ACT = oParams.IS_ACT, TRKORR = oParams.TRKORR, PRCCD = oParams.PRCCD;
        var sReqNo = oAppData.REQNO || "";
        if (TRKORR) { sReqNo = TRKORR; }

        // 저장 직전 에디터 라이브 내용을 모델에 동기화(CONTENT_SYNC 타이밍 비의존 — 메인 에디터 getValue).
        try {
            var ifr = document.querySelector("#uspEditorHost iframe.EDITOR_MAIN");
            if (ifr && ifr.contentWindow && ifr.contentWindow.editor) {
                var oUd = _model("/WS30/USPDATA") || {};
                oUd.CONTENT = ifr.contentWindow.editor.getValue();
                APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oUd);
            }
        } catch (e) { }

        var oSaveData = {
            APPID: oAppData.APPID, TRKORR: sReqNo, PRCCD: PRCCD || "02",
            IS_ACT: IS_ACT || "", S_CONTENT: {}, T_TREE: [], TU4A0010: oAppData
        };

        var oContent = _model("/WS30/USPDATA") || {};
        var oContCP = JSON.parse(JSON.stringify(oContent));
        var sContentTmp = "";
        if (APPCOMMON.checkWLOList("C", "UHAK900763")) {   // 3.4.1+ : CONTENT 는 Blob 로 분리 전송
            sContentTmp = oContCP.CONTENT || "";
            oContCP.CONTENT = "";
        }

        var aTreeData = _model("/WS30/USPTREE") || [];
        // TREEDATA 가 직접 전달된 경우(Create: 신규 노드 포함 평면 배열) → 그대로 사용.
        var aUspTreeData = oParams.TREEDATA || _parseTree2Tab($.extend(true, [], aTreeData), "USPTREE");

        var oBeforeSelectData = aUspTreeData.find(function (a) { return a.ISSEL == true; });
        if (oBeforeSelectData) {
            var sOBJKY = oBeforeSelectData.OBJKY;
            for (var i = 0; i < aUspTreeData.length; i++) {
                if (aUspTreeData[i].OBJKY != sOBJKY) { continue; }
                aUspTreeData[i].CODPG = oContCP.CODPG;
                aUspTreeData[i].DESCT = oContCP.DESCT;
                break;
            }
            oSaveData.S_CONTENT = oContCP;
        }
        oSaveData.T_TREE = aUspTreeData;

        var sPath = parent.getServerPath() + "/usp_save_active_appdata" + (IS_ACT === "X" ? "#active" : "#save");
        var oBlob = new Blob([sContentTmp], { type: "application/json;charset=utf-8" });
        var oFormData = new FormData();
        oFormData.append("APPDATA", JSON.stringify(oSaveData));
        oFormData.append("file", oBlob, "usp_save_content");

        sendAjax(sPath, oFormData, _fnUspSaveCallback.bind(oParams));
    };

    // 저장 콜백 (구 _fnSaveCallback) — 일반 저장/활성화/뒤로/디스플레이 전환 분기 보존.
    //   (AFPRC 신규/Rename, ISROW 분기는 컨텍스트메뉴 CRUD 영역(미구현)이라 발생 안 함 → 생략)
    function _fnUspSaveCallback(oResult) {
        var oParams = this || {};

        if (typeof oResult !== "object" || oResult == null) {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: "[usp_save_active_appdata] JSON Parse Error" }); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }

        if (oResult.RETCD === "Z") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30(oResult); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }
        if (oResult.RETCD === "E") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            if (oResult.SCRIPT) { _uspEvalScript(oResult.SCRIPT); oAPP.common.fnSetBusyLock(""); return; }
            oAPP.common.fnShowFloatingFooterMsg("E", "WS30", oResult.RTMSG);
            oAPP.common.fnSetBusyLock(""); return;
        }

        // 성공
        if (oResult.SCRIPT) { _uspEvalScript(oResult.SCRIPT); }
        else { oAPP.common.fnShowFloatingFooterMsg("S", "WS30", oResult.RTMSG); }
        try { parent.setSoundMsg("01"); } catch (e) { }

        oAPP.fn.setAppChangeWs30("");   // 변경 플래그 해제
        try { if (oAPP.fn.fnClearOnBeforeUspTreeData) { oAPP.fn.fnClearOnBeforeUspTreeData(); } } catch (e) { }

        if (oParams.IS_ACT === "X") { _setAppActive("X"); }

        // 저장 후 Display 전환 / 뒤로 이동
        if (oParams.ISDISP === "X") { _uspSetDisplayMode(); return; }   // busy 는 display 전환이 해제
        if (oParams.ISBACK === "X") { _doBackToWs10(); return; }

        // 일반 저장: app 정보 + 선택 트리/컨텐츠 갱신
        var oAppInfo = Object.assign({}, _model("/WS30/APP") || {}, oResult.S_RETURN);
        APPCOMMON.fnSetModelProperty("/WS30/APP", oAppInfo);

        var oContent2 = _model("/WS30/USPDATA") || {};
        var aTree2 = _model("/WS30/USPTREE") || [];
        var oSel = _fnGetSelectedUspTreeData(aTree2);
        if (oSel) {
            oSel.DESCT = oContent2.DESCT;
            if (oSel.PUJKY === "" || oSel.PUJKY == null) {   // 루트면 APP 반환정보까지 머지
                oContent2 = Object.assign({}, oContent2, oResult.S_RETURN);
                APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oContent2);
                Object.assign(oSel, oResult.S_RETURN);
            }
            oAPP.usp.oSelectRowData = JSON.parse(JSON.stringify(oSel));
        }
        APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aTree2);

        // Activate 면 다른 창에 broadcast (구 CLIpcHandler activate)
        if (oParams.IS_ACT === "X") {
            try {
                var oH = new parent.CLIpcHandler();
                oH.command("activate", { fromPage: parent.getCurrPage(), browserKey: parent.getBrowserKey() });
            } catch (e) { }
        }

        // AFPRC 분기 — Create: "_C"(신규 생성 후처리) / "C"(변경 저장 후 팝업 재오픈)
        if (oParams.AFPRC === "_C") {
            // 서버 저장 성공 → 트리 모델에 신규 노드 추가 + 선택 (busy 는 fnUspTreeTableRowSelect 콜백이 해제)
            _fnAddCreatedNode(oParams._createNode, oParams._parentNode);
            return;
        }
        if (oParams.AFPRC === "C") {
            // 변경 저장 완료 → Create 팝업 오픈 (busy = fnCreateUspNodePopup 내부 해제)
            try { if (oAPP.fn.fnCreateUspNodePopup) { oAPP.fn.fnCreateUspNodePopup(oParams._createNode); } } catch (e) { }
            return;
        }
        if (oParams.AFPRC === "_RN") {
            // Rename 저장 성공 → 변경 평면트리 반영 + 우측/팝업 후처리
            _fnRenameApply(oParams);
            return;
        }
        if (oParams.AFPRC === "RN") {
            // 변경 저장 완료 → Rename 팝업 오픈
            try { if (oAPP.fn.fnRenameUspNodePopup) { oAPP.fn.fnRenameUspNodePopup(oParams._renameNode); } } catch (e) { }
            return;
        }

        _uspRefreshAfterMode();
        oAPP.common.fnSetBusyLock("");

        // 저장/활성화 후 에디터로 포커스 복원 (구 _fnSaveCallback 끝의 beforeActiveElement.focus()).
        //   단축키 activate/save 로 포커스가 에디터(iframe)에서 빠진 경우, 파일 편집 중이었으면 Monaco 로
        //   되돌린다. Monaco 는 마지막 커서/선택 위치를 그대로 유지하므로 editor.focus() 만으로 충분.
        _refocusUspEditor();
    }

    // 메인 Monaco 에디터로 포커스 복원(파일 편집 중일 때만 — editor 인스턴스 존재 = 파일 열림).
    function _refocusUspEditor() {
        try {
            var ifr = document.querySelector("#uspEditorHost iframe.EDITOR_MAIN");
            if (ifr && ifr.contentWindow && ifr.contentWindow.editor) {
                setTimeout(function () { try { ifr.contentWindow.editor.focus(); } catch (e) { } }, 0);
            }
        } catch (e) { }
    }

    /************************************************************************
     * K3 Create 팝업 + 서버 저장 (구 fnCreateUspNodePopup · ev_createUspNodeAcceptEvent · _fnCreateUspNode)
     ************************************************************************/

    // 이름 입력값 검증 (구 _fnCheckCreateNodeData 재설계)
    //   원본은 "첫 글자 영문 강제 + 영문/숫자/언더바만" 이라 1.js, main-test.js 같은 정상
    //   파일명까지 거부했다. 실제 가능한 파일명 조합을 허용하도록 화이트리스트로 변경:
    //   허용 문자 = 영문/숫자/. _ -  (그 외 공백·경로문자·OS 금지문자는 전부 거부)
    function _fnCheckCreateNodeData(oCrData) {
        var oCheck = {};
        var sName = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C11");
        var sReq  = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "050", sName);

        // 1) 필수 입력
        if (!oCrData || !oCrData.NAME) { oCheck.RETCD = "E"; oCheck.RTMSG = sReq; return oCheck; }
        var sNm = String(oCrData.NAME);
        try {
            if (parent.isEmpty(sNm) === true || parent.isBlank(sNm) === true) {
                oCheck.RETCD = "E"; oCheck.RTMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "358"); return oCheck;
            }
        } catch (e) { }

        // 2) 공백 불가
        if (/\s/.test(sNm)) {
            oCheck.RETCD = "E"; oCheck.RTMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "358"); return oCheck;
        }

        // 3) 허용 문자(영문/숫자/. _ -)만 — 그 외 특수문자·경로구분자(\ / : * ? " < > |)는 전부 거부
        if (!/^[A-Za-z0-9._-]+$/.test(sNm)) {
            oCheck.RETCD = "E"; oCheck.RTMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "359"); return oCheck;
        }

        // 4) 점(.)으로만 이루어진 이름(., .., ...)은 불가
        if (/^\.+$/.test(sNm)) {
            oCheck.RETCD = "E"; oCheck.RTMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "359"); return oCheck;
        }

        // 5) 폴더는 점(.) 불가 (확장자 개념 없음 — 원본 규칙 유지)
        if (oCrData.ISFLD === true && /[.]/.test(sNm)) {
            oCheck.RETCD = "E"; oCheck.RTMSG = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "359"); return oCheck;
        }

        oCheck.RETCD = "S"; return oCheck;
    }

    // 신규 노드 데이터 초기화 (구 _fnClearNewRowData — 모든 필드 "")
    function _fnClearNewNodeData(oData) {
        var oNew = {};
        if (oData && typeof oData === "object") {
            Object.keys(oData).forEach(function (k) { oNew[k] = ""; });
        }
        return oNew;
    }

    // 랜덤 OBJKY (구 RANDOM.generateBase30(34))
    function _randomKey() {
        try { return parent.RANDOM.generateBase30(34); } catch (e) { }
        var s = "";
        for (var i = 0; i < 34; i++) { s += Math.floor(Math.random() * 36).toString(36); }
        return s;
    }

    // Create 팝업 타이틀 (구 "생성 [ 부모명 ]")
    function _crTitle(oNode) {
        return APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A01") + " [ " + (oNode && oNode.OBDEC || "") + " ]";
    }

    // 라벨+입력 행 — 공통 .u4a-form__row / .u4a-label(--required) / .u4a-field(+clear) / .u4a-field__msg
    //   (createEventPopup.js 와 동일 패턴: 세로 스택, clear X, 포커스시 value-state 메시지 자동 노출)
    function _crRow(sLabel, bReq) {
        var oRow = document.createElement("div"); oRow.className = "u4a-form__row";
        var oLab = document.createElement("label");
        oLab.className = "u4a-label" + (bReq ? " u4a-label--required" : "");
        oLab.textContent = sLabel;
        var oField = document.createElement("div"); oField.className = "u4a-field"; oField.setAttribute("data-trail", "1");
        var oInp = document.createElement("input");
        oInp.className = "u4a-input u4a-field__input";
        oInp.autocomplete = "off"; oInp.setAttribute("spellcheck", "false");
        var oClr = document.createElement("button");
        oClr.type = "button"; oClr.className = "u4a-field__clear"; oClr.tabIndex = -1; oClr.title = "Clear";
        oClr.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        var oMsg = document.createElement("div"); oMsg.className = "u4a-field__msg";
        oField.appendChild(oInp); oField.appendChild(oClr);
        oRow.appendChild(oLab); oRow.appendChild(oField); oRow.appendChild(oMsg);
        try { if (window.U4AUI && U4AUI.attachClear) { U4AUI.attachClear(oInp, oClr); } } catch (e) { }
        return { row: oRow, input: oInp, msg: oMsg };
    }

    // 팝업 재사용 시 초기화 + 타이틀 갱신 + 포커스
    function _uspCrDialogReset(oDlg, oNode) {
        oDlg.__uspCrParent = oNode;
        try { oDlg._nameInp.value = ""; oDlg._nameInp.removeAttribute("data-vs"); oDlg._nameMsg.textContent = ""; oDlg._nameInp.dispatchEvent(new Event("input")); } catch (e) { }
        try { oDlg._descInp.value = ""; oDlg._descInp.dispatchEvent(new Event("input")); } catch (e) { }
        try { oDlg._codpgInp.value = "utf-8"; oDlg._codpgInp.dispatchEvent(new Event("input")); } catch (e) { }
        try { oDlg._isfldChk.checked = false; } catch (e) { }
        try { oDlg.querySelector(".u4aUspCrTitle").textContent = _crTitle(oNode); } catch (e) { }
        requestAnimationFrame(function () { try { oDlg._nameInp.focus(); } catch (e) { } });
    }

    // Create 팝업 열기 (구 fnCreateUspNodePopup) — 공통 다이얼로그/폼/입력 컴포넌트 소비
    oAPP.fn.fnCreateUspNodePopup = function (oNode) {
        if (!oNode) { oAPP.common.fnSetBusyLock(""); return; }

        // 잔여 팝업 제거 후 매번 새로 생성 — createEventPopup 패턴(close 만으로는 top-layer 간섭 시
        //   안 닫히므로 close+remove 로 확실히 정리). 재사용 분기는 close 무효 시 좀비 팝업을 남겨 폐기.
        var oOld = document.getElementById("uspCrNodePopup");
        if (oOld) { try { oOld.close(); } catch (e) { } try { oOld.remove(); } catch (e) { } }

        var oDlg = null;
        var sLblName    = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C11");  // Name
        var sLblDesc    = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A35");  // Description
        var sLblCharset = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C20");  // Charset
        var sLblFolder  = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D45");  // Folder

        oDlg = document.createElement("dialog");
        oDlg.id = "uspCrNodePopup";
        oDlg.className = "u4a-dialog";
        oDlg.style.cssText = "width:min(92vw,460px);padding:0;display:flex;flex-direction:column";
        oDlg.__uspCrParent = oNode;

        // 헤더 — 아이콘 + 타이틀 + 닫기(공통 .u4a-btn-icon)
        var oHeader = document.createElement("div");
        oHeader.className = "u4a-dialog__header";
        oHeader.innerHTML = '<i class="fa-solid fa-file-circle-plus" aria-hidden="true"></i><span class="u4aUspCrTitle"></span>';
        var oX = document.createElement("button");
        oX.type = "button"; oX.className = "u4a-btn-icon"; oX.setAttribute("aria-label", "Close");
        oX.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A39");
        oX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);
        oDlg.querySelector(".u4aUspCrTitle").textContent = _crTitle(oNode);

        // 바디 — 공통 .u4a-form(세로 스택)
        var oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body";
        // overflow:visible — 공통 .u4a-dialog__body 의 overflow:auto 를 무력화(value-state 메시지가 absolute 라
        //   바디 경계에서 잘리지 않게. createEventPopup.js 와 동일 이유).
        oBody.style.cssText = "flex:1 1 auto;display:flex;flex-direction:column;padding:1.25rem 1.25rem 1.75rem;overflow:visible";
        var oForm = document.createElement("div"); oForm.className = "u4a-form";

        var oRName  = _crRow(sLblName, true);                                  // 이름(필수)
        var oRDesc  = _crRow(sLblDesc, false);                                 // 설명
        var oRCodpg = _crRow(sLblCharset + " (ex: utf-8, euc-kr..)", false);   // 문자세트
        oRCodpg.input.value = "utf-8";

        // 폴더 체크박스 행 (공통 .u4a-check)
        var oRFld = document.createElement("div"); oRFld.className = "u4a-form__row";
        var oFldLab = document.createElement("label"); oFldLab.className = "u4a-check";
        var oFldChk = document.createElement("input"); oFldChk.type = "checkbox";
        var oFldTxt = document.createElement("span"); oFldTxt.textContent = sLblFolder;
        oFldLab.appendChild(oFldChk); oFldLab.appendChild(oFldTxt);
        oRFld.appendChild(oFldLab);

        oForm.appendChild(oRName.row);
        oForm.appendChild(oRDesc.row);
        oForm.appendChild(oRCodpg.row);
        oForm.appendChild(oRFld);
        oBody.appendChild(oForm);
        oDlg.appendChild(oBody);

        // 푸터 — Accept(강조 파랑) / Cancel(Reject 느낌 빨강) (메모리 btn-color-semantics)
        var oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer";
        var oOk = document.createElement("button");
        oOk.type = "button"; oOk.className = "u4a-btn u4a-btn--emphasized";
        oOk.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A01");
        oOk.innerHTML = '<i class="fa-solid fa-check"></i>';
        var oCancel = document.createElement("button");
        oCancel.type = "button"; oCancel.className = "u4a-btn u4a-btn--negative";
        oCancel.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A39");
        oCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oFoot.appendChild(oOk); oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        // 입력 참조 저장(_fnCrAccept / _uspCrDialogReset 가 사용)
        oDlg._nameInp = oRName.input; oDlg._nameMsg = oRName.msg;
        oDlg._descInp = oRDesc.input;
        oDlg._codpgInp = oRCodpg.input;
        oDlg._isfldChk = oFldChk;

        // 이벤트 — 닫기는 close()+remove() (createEventPopup 패턴). close() 가 top-layer 간섭으로
        //   무효여도 remove() 로 DOM 에서 제거돼 확실히 사라진다. 모델 초기화는 직접 수행(remove 시 close 이벤트 미발화 대비).
        function _close() {
            try { APPCOMMON.fnSetModelProperty("/WS30/USPCRT", {}, true); } catch (e) { }
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
        }
        oX.addEventListener("click", _close);
        oCancel.addEventListener("click", _close);
        oOk.addEventListener("click", function () { _fnCrAccept(oDlg); });
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });   // ESC
        // Enter → Accept (IME 한글 조합 확정 Enter 는 무시 — 오submit 방지)
        function _enter(e) {
            if (e.key !== "Enter") { return; }
            if (e.isComposing || e.keyCode === 229) { return; }
            e.preventDefault(); oOk.click();
        }
        [oRName.input, oRDesc.input, oRCodpg.input].forEach(function (inp) { inp.addEventListener("keydown", _enter); });

        document.body.appendChild(oDlg);
        // 헤더 드래그는 공통 전역 위임. 더블클릭 리센터 / 우하단 grip 리사이즈는 공통 헬퍼(전 팝업 동일 UX).
        try { if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); } } catch (e) { }
        try { if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 240 }); } } catch (e) { }
        try { oDlg.showModal(); } catch (e) { }
        oAPP.common.fnSetBusyLock("");
        requestAnimationFrame(function () { try { oRName.input.focus(); } catch (e) { } });
    };

    // Create Accept 핸들러 (구 ev_createUspNodeAcceptEvent)
    function _fnCrAccept(oDlg) {
        var oParent = oDlg.__uspCrParent;
        if (!oParent) { return; }
        // ★ 검증 전에는 busy 를 걸지 않는다 — busy 는 #u4aWsBusyIndicator <dialog>.showModal() 이라
        //   이미 showModal 인 Create 팝업 위에 떠서 입력칸 focus() 를 가로챈다(focus-within 미발생 →
        //   value-state 메시지 안 보임). 검증/중복은 동기 로컬 작업이라 busy 불필요. 서버 저장은
        //   fnSaveUspWs30 가 자체적으로 busy 를 건다.

        var sName  = (oDlg._nameInp.value || "").trim();
        var sDesc  = oDlg._descInp.value || "";
        var sCodpg = oDlg._codpgInp.value || "utf-8";
        var bFld   = !!oDlg._isfldChk.checked;

        // 이름 필드 value-state(error) — 포커스시 .u4a-field__msg 자동 노출(공통 규약). 첫 오류에 focus.
        function _err(sMsg) {
            oDlg._nameInp.setAttribute("data-vs", "error");
            oDlg._nameMsg.textContent = sMsg || "";
            try { oDlg._nameInp.focus(); } catch (e) { }
        }

        // 입력값 검증
        var oCheck = _fnCheckCreateNodeData({ NAME: sName, DESC: sDesc, CODPG: sCodpg, ISFLD: bFld });
        if (oCheck.RETCD === "E") { _err(oCheck.RTMSG); return; }

        // 중복 이름 체크 (같은 부모 자식 중)
        var aChildren = Array.isArray(oParent.USPTREE) ? oParent.USPTREE : [];
        if (aChildren.find(function (n) { return n && n.OBDEC === sName; })) {
            _err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "004")); return;
        }
        oDlg._nameInp.removeAttribute("data-vs"); oDlg._nameMsg.textContent = "";

        // 신규 노드 구성 (구 oNewRowData)
        var oAppData = _model("/WS30/APP") || {};
        var sKey = oAppData.APPID + "|" + _randomKey();
        var oNewRow = _fnClearNewNodeData($.extend(true, {}, oParent));
        oNewRow.PUJKY = oParent.OBJKY;
        oNewRow.OBJKY = sKey;
        oNewRow.APPID = oParent.APPID || oAppData.APPID;
        oNewRow.ISFLD = bFld ? "X" : "";
        oNewRow.OBDEC = sName;
        oNewRow.DESCT = sDesc;
        oNewRow.CODPG = sCodpg;
        oNewRow.ISSEL = false;
        oNewRow.SPATH = (oParent.SPATH || "") + "/" + sName;
        oNewRow.USPTREE = [];
        if (!bFld) {
            try { oNewRow.MIME  = parent.MIMETYPES.lookup(sName) || ""; } catch (e) { oNewRow.MIME  = ""; }
            try { oNewRow.EXTEN = APPCOMMON.fnGetFileExt(sName)  || ""; } catch (e) { oNewRow.EXTEN = ""; }
        } else {
            oNewRow.MIME = ""; oNewRow.EXTEN = "";
        }

        // 평면 트리 + 신규 노드 → 서버 저장(PRCCD="01" Create, AFPRC="_C")
        var aTree = _model("/WS30/USPTREE") || [];
        var aFlat = _parseTree2Tab($.extend(true, [], aTree), "USPTREE");
        aFlat.push(oNewRow);

        oAPP.fn.fnSaveUspWs30({ PRCCD: "01", AFPRC: "_C", TREEDATA: aFlat, _createNode: oNewRow, _parentNode: oParent });
    }

    // 신규 노드 트리에 반영 + 선택 + 팝업 닫기 (구 _fnCreateUspNode)
    function _fnAddCreatedNode(oNewRow, oParentNode) {
        if (!oNewRow || !oParentNode) { oAPP.common.fnSetBusyLock(""); return; }
        if (!Array.isArray(oParentNode.USPTREE)) { oParentNode.USPTREE = []; }
        oParentNode.USPTREE.push(oNewRow);

        var aTree = _model("/WS30/USPTREE") || [];
        APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aTree);
        try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
        try { if (oAPP.fn.fnUspTreeExpandSubtree) { oAPP.fn.fnUspTreeExpandSubtree(oParentNode); } } catch (e) { }

        // ★ 닫기 순서 중요: 저장 때 건 busy 는 #u4aWsBusyIndicator <dialog>.showModal() 이라 Create 팝업
        //   위(top-layer)에 떠 있다. 그 상태로 close() 하면 Chromium93 에서 안 닫힌다. 먼저 busy 를 해제해
        //   Create 팝업을 top-layer 최상위로 만든 뒤 close, 그 다음 신규 행을 선택(선택이 자체 busy 재설정).
        oAPP.common.fnSetBusyLock("");
        try { APPCOMMON.fnSetModelProperty("/WS30/USPCRT", {}, true); } catch (e) { }
        try { var d = document.getElementById("uspCrNodePopup"); if (d) { try { d.close(); } catch (e2) { } d.remove(); } } catch (e) { }

        // 신규 행 선택 → ajax + 우측 페이지(선택 콜백이 busy 해제)
        try { if (oAPP.fn.fnUspTreeTableRowSelect) { oAPP.fn.fnUspTreeTableRowSelect(oNewRow); } } catch (e) { }
    }

    /************************************************************************
     * K4 Delete (구 fnDeleteUspNode · _fnDeleteUspNodeCb · _fnDeleteUspNodeSuccessCb)
     *   confirm(msg 003) → /usp_page_del (T_TREE=노드+자손 평면) → 트리에서 제거.
     ************************************************************************/
    oAPP.fn.fnDeleteUspNode = function (oNode) {
        if (!oNode) { oAPP.common.fnSetBusyLock(""); return; }
        oAPP.common.fnSetBusyLock("X");

        var oAppData = _model("/WS30/APP") || {};
        var aDel = _parseTree2Tab($.extend(true, [], [oNode]), "USPTREE");   // 노드 + 자손 평면
        var oSend = {
            APPID: oAppData.APPID,
            TRKORR: oAppData.REQNO || "",
            T_TREE: aDel,
            TU4A0010: oAppData
        };
        var oFd = new FormData();
        oFd.append("APPDATA", JSON.stringify(oSend));
        sendAjax(parent.getServerPath() + "/usp_page_del", oFd, _fnDeleteCb.bind({ _node: oNode }));
    };

    function _fnDeleteCb(oResult) {
        var oP = this || {};
        if (typeof oResult !== "object" || oResult == null) {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: "[usp_page_del] JSON Parse Error" }); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }
        if (oResult.RETCD === "Z") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30(oResult); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }
        if (oResult.RETCD === "E") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            if (oResult.SCRIPT) { _uspEvalScript(oResult.SCRIPT); oAPP.common.fnSetBusyLock(""); return; }
            oAPP.common.fnShowFloatingFooterMsg("E", "WS30", oResult.RTMSG);
            oAPP.common.fnSetBusyLock(""); return;
        }
        // 성공
        if (oResult.SCRIPT) { _uspEvalScript(oResult.SCRIPT); }
        else { oAPP.common.fnShowFloatingFooterMsg("S", "WS30", oResult.RTMSG); }
        try { parent.setSoundMsg("01"); } catch (e) { }
        _fnRemoveNodeFromTree(oP._node);
        oAPP.common.fnSetBusyLock("");
    }

    // 모델 트리에서 노드(+자손) 제거 + 우측이 삭제대상이면 인트로(USP10)로 (구 splice + fnOnMoveToPage)
    function _fnRemoveNodeFromTree(oNode) {
        if (!oNode) { return; }
        var aTree = _model("/WS30/USPTREE") || [];
        var oCur = _model("/WS30/USPDATA") || {};
        // 삭제 대상(자손 포함)에 현재 우측 콘텐츠가 들어있는지
        var aDelFlat = _parseTree2Tab($.extend(true, [], [oNode]), "USPTREE");
        var bCurDeleted = !!(oCur && oCur.OBJKY && aDelFlat.some(function (n) { return n && n.OBJKY === oCur.OBJKY; }));

        (function rec(arr) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] === oNode || (arr[i] && arr[i].OBJKY === oNode.OBJKY)) { arr.splice(i, 1); return true; }
                if (arr[i] && Array.isArray(arr[i].USPTREE) && rec(arr[i].USPTREE)) { return true; }
            }
            return false;
        })(aTree);

        APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aTree);
        try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
        // ★ 선택은 "삭제 대상이 우측에 열려 있던 것일 때만" 해제한다. 다른 노드를 삭제하면 현재 선택은
        //   그대로 유지돼야 한다(삭제와 선택은 별개). 남은 선택 노드는 ISSEL 이 살아 있어 fnRenderUspTree 가
        //   자동 재강조한다. (무조건 fnOnUspTreeUnSelect 호출하던 게 다른 노드 삭제 시에도 선택을 풀던 원인)
        if (bCurDeleted) {
            try { if (oAPP.fn.fnOnUspTreeUnSelect) { oAPP.fn.fnOnUspTreeUnSelect(); } } catch (e) { }
            try { oAPP.fn.setAppChangeWs30(""); } catch (e) { }
            try { if (oAPP.fn.fnUspNavTo) { oAPP.fn.fnUspNavTo("USP10"); } } catch (e) { }   // 인트로로
        }
    }

    /************************************************************************
     * K7 Rename (구 fnRenameUspNodePopup · fnRenameSubmit · fnRenameUspNode)
     ************************************************************************/
    function _rnTitle() {
        return APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D44");   // Rename
    }

    // 읽기전용 표시 행 (URL / Old Name) — 공통 .u4a-form__row + readonly .u4a-input
    function _roRow(sLabel, sValue) {
        var oRow = document.createElement("div"); oRow.className = "u4a-form__row";
        var oLab = document.createElement("label"); oLab.className = "u4a-label"; oLab.textContent = sLabel;
        var oInp = document.createElement("input"); oInp.className = "u4a-input"; oInp.readOnly = true; oInp.value = (sValue == null ? "" : sValue);
        oRow.appendChild(oLab); oRow.appendChild(oInp);
        return oRow;
    }

    oAPP.fn.fnRenameUspNodePopup = function (oNode) {
        if (!oNode) { oAPP.common.fnSetBusyLock(""); return; }

        var oOld = document.getElementById("uspRnNodePopup");
        if (oOld) { try { oOld.close(); } catch (e) { } try { oOld.remove(); } catch (e) { } }

        var sLblUrl  = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C18");  // URL
        var sLblOld  = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D92");  // Old Name
        var sLblFold = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "C19");  // Is Folder?
        var sLblNew  = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D93");  // New Name

        var oDlg = document.createElement("dialog");
        oDlg.id = "uspRnNodePopup";
        oDlg.className = "u4a-dialog";
        oDlg.style.cssText = "width:min(92vw,460px);padding:0;display:flex;flex-direction:column";
        oDlg.__uspRnNode = oNode;

        var oHeader = document.createElement("div");
        oHeader.className = "u4a-dialog__header";
        oHeader.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i><span class="u4aUspRnTitle"></span>';
        var oX = document.createElement("button");
        oX.type = "button"; oX.className = "u4a-btn-icon"; oX.setAttribute("aria-label", "Close");
        oX.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A39");
        oX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);
        oDlg.querySelector(".u4aUspRnTitle").textContent = _rnTitle();

        var oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body";
        oBody.style.cssText = "flex:1 1 auto;display:flex;flex-direction:column;padding:1.25rem 1.25rem 1.75rem;overflow:visible";
        var oForm = document.createElement("div"); oForm.className = "u4a-form";

        oForm.appendChild(_roRow(sLblUrl, oNode.SPATH || ""));
        oForm.appendChild(_roRow(sLblOld, oNode.OBDEC || ""));

        // 폴더 여부(읽기전용 체크박스)
        var oRFld = document.createElement("div"); oRFld.className = "u4a-form__row";
        var oFldLab = document.createElement("label"); oFldLab.className = "u4a-check";
        var oFldChk = document.createElement("input"); oFldChk.type = "checkbox"; oFldChk.disabled = true; oFldChk.checked = (oNode.ISFLD === "X");
        var oFldTxt = document.createElement("span"); oFldTxt.textContent = sLblFold;
        oFldLab.appendChild(oFldChk); oFldLab.appendChild(oFldTxt);
        oRFld.appendChild(oFldLab);
        oForm.appendChild(oRFld);

        // 새 이름 (필수, clear + value-state) — Create 의 _crRow 재사용
        var oRNew = _crRow(sLblNew, true);
        oForm.appendChild(oRNew.row);

        oBody.appendChild(oForm);
        oDlg.appendChild(oBody);

        var oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer";
        var oOk = document.createElement("button");
        oOk.type = "button"; oOk.className = "u4a-btn u4a-btn--emphasized";
        oOk.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A66");   // Accept(없으면 코드)
        oOk.innerHTML = '<i class="fa-solid fa-check"></i>';
        var oCancel = document.createElement("button");
        oCancel.type = "button"; oCancel.className = "u4a-btn u4a-btn--negative";
        oCancel.title = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A39");
        oCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oFoot.appendChild(oOk); oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        oDlg._nameInp = oRNew.input; oDlg._nameMsg = oRNew.msg;

        function _close() { try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } }
        oX.addEventListener("click", _close);
        oCancel.addEventListener("click", _close);
        oOk.addEventListener("click", function () { _fnRnAccept(oDlg); });
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });
        oRNew.input.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); oOk.click(); }
        });

        document.body.appendChild(oDlg);
        try { if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); } } catch (e) { }
        try { if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 240 }); } } catch (e) { }
        try { oDlg.showModal(); } catch (e) { }
        oAPP.common.fnSetBusyLock("");
        requestAnimationFrame(function () { try { oRNew.input.focus(); } catch (e) { } });
    };

    // 트리에서 노드의 부모 찾기(PUJKY)
    function _fnFindParentNode(oNode) {
        if (!oNode || !oNode.PUJKY) { return null; }
        var aTree = _model("/WS30/USPTREE") || [], oFound = null;
        (function rec(arr) {
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].OBJKY === oNode.PUJKY) { oFound = arr[i]; return; }
                if (arr[i] && Array.isArray(arr[i].USPTREE)) { rec(arr[i].USPTREE); }
                if (oFound) { return; }
            }
        })(aTree);
        return oFound;
    }

    // Rename Accept (구 fnRenameSubmit) — 검증 → SPATH/OBDEC/MIME 재구성 → 저장(_RN, 03)
    function _fnRnAccept(oDlg) {
        var oNode = oDlg.__uspRnNode;
        if (!oNode) { return; }
        var sNew = (oDlg._nameInp.value || "").trim();
        var bFld = (oNode.ISFLD === "X");

        function _err(sMsg) {
            oDlg._nameInp.setAttribute("data-vs", "error");
            oDlg._nameMsg.textContent = sMsg || "";
            try { oDlg._nameInp.focus(); } catch (e) { }
        }

        // 기존 이름과 동일
        if (sNew === oNode.OBDEC) { _err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "363")); return; }
        // 입력값 검증(Create 와 동일 규칙)
        var oChk = _fnCheckCreateNodeData({ NAME: sNew, ISFLD: bFld });
        if (oChk.RETCD === "E") { _err(oChk.RTMSG); return; }
        // 같은 레벨 중복(나 제외)
        var oParent = _fnFindParentNode(oNode);
        var aSib = oParent ? (oParent.USPTREE || []) : (_model("/WS30/USPTREE") || []);
        if (aSib.find(function (n) { return n && n.OBDEC === sNew && n.OBJKY !== oNode.OBJKY; })) {
            _err(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "004")); return;
        }
        oDlg._nameInp.removeAttribute("data-vs"); oDlg._nameMsg.textContent = "";

        // 파일 확장자 변경 경고 (구 _checkDiffFileExtension) — 파일이고 확장자가 달라지면
        //   "확장자가 다르면 파일이 손상될 수 있습니다 / 계속?"(497+182) 확인 후에만 진행.
        //   YES → MIME/EXTEN 재계산(bMime=true), NO/취소 → 중단(팝업 유지). 확장자 동일·폴더면 바로 진행.
        if (!bFld) {
            var sExtOld = _extOf(oNode.OBDEC), sExtNew = _extOf(sNew);
            if (sExtOld !== sExtNew) {
                var sWarn = _wsMsg("497") + "\n\n" + _wsMsg("182");
                oAPP.common.fnConfirmBox("W", sWarn, function (act) {
                    if (act !== "YES") { return; }
                    _doRenameSave(oNode, sNew, true);
                }, [
                    { act: "YES", label: "Yes", emphasized: true },
                    { act: "NO",  label: "No" }
                ]);
                return;
            }
        }
        _doRenameSave(oNode, sNew, false);
    }

    // 확장자 추출(. 포함) — PATH.extname 대응(없으면 "")
    function _extOf(s) {
        var t = String(s == null ? "" : s);
        var i = t.lastIndexOf(".");
        return (i <= 0) ? "" : t.slice(i);   // 선두 점(.gitignore 등)은 확장자로 보지 않음(i>0)
    }

    // Rename 실제 적용 — SPATH/OBDEC(+승인 시 MIME/EXTEN) 재구성 후 저장(_RN, 03)
    function _doRenameSave(oNode, sNew, bMimeChange) {
        oAPP.common.fnSetBusyLock("X");
        var bFld = (oNode.ISFLD === "X");

        // 노드 + 자손 평면화 → SPATH/OBDEC 재구성 (MIME/EXTEN 은 확장자 변경 승인 시에만)
        var aChild = _parseTree2Tab($.extend(true, [], [oNode]), "USPTREE");
        var iDepth = (oNode.SPATH || "").split("/").length;   // 변경 노드의 SPATH 세그먼트 수(빈값 포함)
        aChild.forEach(function (it) {
            var aSeg = (it.SPATH || "").split("/");
            if (aSeg.length === iDepth) {   // 변경 노드 자신
                it.OBDEC = sNew;
                if (!bFld && bMimeChange) {
                    try { it.MIME  = parent.MIMETYPES.lookup(sNew) || ""; } catch (e) { }
                    try { it.EXTEN = APPCOMMON.fnGetFileExt(sNew)  || ""; } catch (e) { }
                }
            }
            // SPATH 의 변경 깊이 세그먼트를 새 이름으로 교체
            var sNewPath = "";
            for (var j = 0; j < aSeg.length; j++) {
                if (aSeg[j] === "") { continue; }
                sNewPath += "/" + (j === iDepth - 1 ? sNew : aSeg[j]);
            }
            it.SPATH = sNewPath;
        });

        // 전체 평면트리에서 변경 노드들 교체
        var aTree = _model("/WS30/USPTREE") || [];
        var aFlat = _parseTree2Tab($.extend(true, [], aTree), "USPTREE");
        aChild.forEach(function (it) {
            var idx = aFlat.findIndex(function (e) { return e.OBJKY === it.OBJKY; });
            if (idx >= 0) { aFlat.splice(idx, 1, it); }
        });

        oAPP.fn.fnSaveUspWs30({ PRCCD: "03", AFPRC: "_RN", TREEDATA: aFlat, CHANGEDATA: aChild, _renameNode: oNode });
    }

    // Rename 저장 콜백 (구 fnRenameUspNode) — 변경 평면트리 → 중첩 반영 + 우측/팝업 후처리
    function _fnRenameApply(oParams) {
        var aFlat = oParams.TREEDATA || [];
        var aNested = oAPP.fn.fnBuildUspTree($.extend(true, [], aFlat));
        APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aNested);

        // 우측 콘텐츠가 이름 변경 대상이면 갱신(+ 언어 재적용 + Properties 패널 재표시).
        //   변경 노드 필드(SPATH/OBDEC/+MIME/EXTEN)만 기존 USPDATA 에 덮어써 CONTENT 등 보존.
        var aChg = oParams.CHANGEDATA || [];
        var oCur = _model("/WS30/USPDATA") || {};
        var oChgSel = aChg.find(function (e) { return e && oCur && e.OBJKY === oCur.OBJKY; });
        if (oChgSel) {
            var oMerged = $.extend(true, {}, oCur, oChgSel);
            APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oMerged);
            // Properties 패널(URL=SPATH·이름 등)을 새 값으로 다시 그림 — 선택 핸들러와 동일.
            try { if (oAPP.fn.fnRenderUspProperties) { oAPP.fn.fnRenderUspProperties(); } } catch (e) { }
            // 에디터 헤더 파일명 라벨도 새 이름으로 갱신(열린 파일이 변경 대상일 때).
            try { if (oAPP.usphtml.editorRefreshToolbar) { oAPP.usphtml.editorRefreshToolbar(); } } catch (e) { }
            try { oAPP.usp.sendEditorPostMessageAll({ actcd: "language_change", extension: oMerged.EXTEN || "" }); } catch (e) { }
        }
        try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
        // 선택 표시는 새로 빌드된 트리(aNested) 의 "실제 노드" 에 찍어야 한다. oChgSel 은 CHANGEDATA
        //   의 분리된 복사본이라, 그걸 넘기면 fnUspTreeMarkSelected 가 트리 노드 ISSEL 은 전부 false 로
        //   비운 뒤 엉뚱한 복사본에만 true 를 찍어 모델 ISSEL=false → 이후 Activate 재렌더 시 선택이 풀린다.
        if (oChgSel && oAPP.fn.fnUspTreeMarkSelected) {
            var oRealNode = (function findByKey(arr) {
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].OBJKY === oChgSel.OBJKY) { return arr[i]; }
                    if (arr[i] && Array.isArray(arr[i].USPTREE)) { var r = findByKey(arr[i].USPTREE); if (r) { return r; } }
                }
                return null;
            })(_model("/WS30/USPTREE") || []);
            try { if (oRealNode) { oAPP.fn.fnUspTreeMarkSelected(oRealNode); } } catch (e) { }
        }

        oAPP.common.fnSetBusyLock("");
        try { var d = document.getElementById("uspRnNodePopup"); if (d) { try { d.close(); } catch (e2) { } d.remove(); } } catch (e) { }
    }

    /************************************************************************
     * 저장 취소(변경 버림) — 구 _fnSaveCancel. Create/Rename 의 "변경분 있음" 질문에서
     *   NO(저장 안 함) 선택 시: 에디터 수정분을 마지막 저장 내용으로 원복 + 변경 플래그 해제.
     *   (트리 미저장 변경 복원=구 fnResetUspTree 는 노드 이동 미구현이라 현재 불필요)
     ************************************************************************/
    oAPP.fn.fnUspSaveCancel = function () {
        var oBefore = oAPP.usp.oSelectRowData;
        if (oBefore) {
            var oUd = _model("/WS30/USPDATA") || {};
            oUd.CODPG = oBefore.CODPG;
            oUd.DESCT = oBefore.DESCT;
            oUd.CONTENT = oBefore.CONTENT;
            APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oUd);
            // 모나코 에디터에도 변경 전 값 전송(원복) — 구 _fnSaveCancel 의 sendEditorPostMessageAll setValue.
            try { oAPP.usp.sendEditorPostMessageAll({ actcd: "setValue", value: oUd.CONTENT }); } catch (e) { }
        }
        try { if (oAPP.fn.setAppChangeWs30) { oAPP.fn.setAppChangeWs30(""); } } catch (e) { }
    };

    /************************************************************************
     * K8 Up / K9 Down / K10 Move Position — 노드 이동 (WS20 트리 이동과 동일 컨셉:
     *   형제 배열 내 순서 변경 → 재렌더 + 변경플래그. 서버 저장은 별도 Save 버튼).
     *   ★ 선택(우측 콘텐츠 연동)은 건드리지 않는다 — splice 는 노드 객체를 옮기므로 ISSEL 이 보존되어
     *     fnRenderUspTree 가 현재 선택을 자동 재강조한다(이동/삭제는 선택과 별개).
     ************************************************************************/
    function _fnUspSiblings(oNode) {
        var oParent = _fnFindParentNode(oNode);
        return oParent ? (oParent.USPTREE || (oParent.USPTREE = [])) : (_model("/WS30/USPTREE") || []);
    }

    function _fnUspMove(oNode, sDir) {   // sDir: "-" 위로 / "+" 아래로
        if (!oNode) { return; }
        var aSib = _fnUspSiblings(oNode);
        var idx = aSib.findIndex(function (n) { return n && n.OBJKY === oNode.OBJKY; });
        if (idx === -1) { return; }
        var iNew = (sDir === "-") ? idx - 1 : idx + 1;
        if (iNew < 0 || iNew >= aSib.length) { return; }   // 경계(최상위/최하위)
        var oMoved = aSib.splice(idx, 1)[0];
        aSib.splice(iNew, 0, oMoved);
        APPCOMMON.fnSetModelProperty("/WS30/USPTREE", _model("/WS30/USPTREE"));
        try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
        try { if (oAPP.fn.setAppChangeWs30) { oAPP.fn.setAppChangeWs30("X"); } } catch (e) { }
    }

    oAPP.fn.fnUspTreeNodeMoveUp   = function (oNode) { _fnUspMove(oNode, "-"); };
    oAPP.fn.fnUspTreeNodeMoveDown = function (oNode) { _fnUspMove(oNode, "+"); };

    // K10 Move Position — 형제 내 임의 위치로(위치선택 다이얼로그, WS20 _moveUIPosition 식)
    oAPP.fn.fnUspTreeNodeMovePosition = function (oNode) {
        if (!oNode) { return; }
        var aSib = _fnUspSiblings(oNode);
        if (aSib.length <= 1) { return; }
        var iCur = aSib.findIndex(function (n) { return n && n.OBJKY === oNode.OBJKY; });
        if (iCur === -1) { return; }
        var nTot = aSib.length;

        var oDlg = document.createElement("dialog");
        oDlg.id = "uspMovePosPopup";
        oDlg.className = "u4a-dialog";
        oDlg.style.cssText = "width:min(92vw,360px);padding:0;display:flex;flex-direction:column";

        // 타이틀에 대상 객체명 표기(원본 UI5 "위치 이동 - {name}" 동일).
        var sTitle = _msg("A57") + " - " + (oNode.OBDEC || "");   // Move Position - {name}
        var oHeader = document.createElement("div");
        oHeader.className = "u4a-dialog__header";
        oHeader.innerHTML = '<i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i><span></span>';
        oHeader.querySelector("span").textContent = sTitle;
        var oX = document.createElement("button");
        oX.type = "button"; oX.className = "u4a-btn-icon"; oX.setAttribute("aria-label", "Close");
        oX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        var oBody = document.createElement("div");
        oBody.className = "u4a-dialog__body";
        oBody.style.cssText = "flex:1 1 auto;display:flex;flex-direction:column;gap:1rem;padding:1.25rem 1.5rem;overflow:visible";
        // 큰 현재값 + 슬라이더(range) + 양끝 라벨. (− 입력 + 스테퍼 → 슬라이더 UX, WS20 와 통일)
        var oNumRow = document.createElement("div");
        oNumRow.style.cssText = "display:flex;align-items:baseline;justify-content:center;gap:0.4rem";
        var oInp = document.createElement("input");
        oInp.type = "number"; oInp.className = "u4a-input";
        oInp.style.cssText = "width:4.5rem;font-size:1.6rem;font-weight:700;text-align:center;flex:0 0 auto";
        oInp.min = "1"; oInp.max = String(nTot); oInp.value = String(iCur + 1);
        var oMax = document.createElement("span"); oMax.style.cssText = "color:var(--text-muted);font-size:1rem";
        oMax.textContent = "/ " + nTot;
        oNumRow.appendChild(oInp); oNumRow.appendChild(oMax);

        var oSldRow = document.createElement("div");
        oSldRow.style.cssText = "display:flex;align-items:center;gap:0.75rem;width:100%";
        var oLblMin = document.createElement("span");
        oLblMin.style.cssText = "color:var(--text-muted);font-size:0.8rem;flex:0 0 auto"; oLblMin.textContent = "1";
        var oRange = document.createElement("input");
        oRange.type = "range"; oRange.style.cssText = "flex:1 1 auto;min-width:0;accent-color:var(--accent);cursor:pointer";
        oRange.min = "1"; oRange.max = String(nTot); oRange.value = String(iCur + 1);
        var oLblMax = document.createElement("span");
        oLblMax.style.cssText = "color:var(--text-muted);font-size:0.8rem;flex:0 0 auto"; oLblMax.textContent = String(nTot);
        oSldRow.appendChild(oLblMin); oSldRow.appendChild(oRange); oSldRow.appendChild(oLblMax);

        oBody.appendChild(oNumRow); oBody.appendChild(oSldRow);
        oDlg.appendChild(oBody);

        var oFoot = document.createElement("div");
        oFoot.className = "u4a-dialog__footer";
        var oOk = document.createElement("button");
        oOk.type = "button"; oOk.className = "u4a-btn u4a-btn--emphasized";
        oOk.innerHTML = '<i class="fa-solid fa-check"></i>';
        var oCancel = document.createElement("button");
        oCancel.type = "button"; oCancel.className = "u4a-btn u4a-btn--negative";
        oCancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        oFoot.appendChild(oOk); oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        function _close() { try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } }
        function _ok() {
            var v = parseInt(oInp.value, 10);
            if (!(v >= 1)) { v = 1; }
            if (v > nTot) { v = nTot; }
            var iTarget = v - 1;
            _close();
            if (iTarget === iCur) { return; }
            var oMoved = aSib.splice(iCur, 1)[0];
            aSib.splice(iTarget, 0, oMoved);
            APPCOMMON.fnSetModelProperty("/WS30/USPTREE", _model("/WS30/USPTREE"));
            try { if (oAPP.fn.fnRenderUspTree) { oAPP.fn.fnRenderUspTree(); } } catch (e) { }
            try { if (oAPP.fn.setAppChangeWs30) { oAPP.fn.setAppChangeWs30("X"); } } catch (e) { }
        }
        // 슬라이더 ↔ 숫자 input 동기화(둘 다 1..nTot 클램프).
        function _clamp(v) { v = parseInt(v, 10); if (!(v >= 1)) { v = 1; } if (v > nTot) { v = nTot; } return v; }
        oRange.addEventListener("input", function () { oInp.value = String(_clamp(oRange.value)); });
        oInp.addEventListener("input", function () { oRange.value = String(_clamp(oInp.value)); });
        oX.addEventListener("click", _close);
        oCancel.addEventListener("click", _close);
        oOk.addEventListener("click", _ok);
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });
        oInp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); _ok(); } });

        document.body.appendChild(oDlg);
        try { if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); } } catch (e) { }
        try { if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 280, minH: 160 }); } } catch (e) { }
        try { oDlg.showModal(); } catch (e) { }
        requestAnimationFrame(function () { try { oInp.focus(); oInp.select(); } catch (e) { } });
    };

    /************************************************************************
     * K5 Download — 선택 노드 하위 파일 수집 → 서버 CONTENT 조회 → zip 생성 → 폴더 선택 저장.
     *   구 fnOnDownloadUspFiles / fnUspTreeDownloadFileCollect / _fnGetFileContents / _fnUspFileDown.
     *
     *   ★ zip 라이브러리 교체(버그 수정): 구 node-zip 은 Windows 탐색기 기본 압축해제로는
     *     안 풀리고 알집/반디집 같은 외부 도구로만 풀리는 비표준 zip 을 만든다(SR 보고 내용).
     *     이미 의존성이며 다른 모듈(intro.js·help)에서 쓰는 adm-zip(표준 zip)으로 교체해
     *     Windows 기본 압축해제와 호환되게 한다. (신규 npm 설치 없음.)
     ************************************************************************/
    // 선택 노드 + 하위 전체에서 파일(폴더 제외) 평면 수집 (구 fnUspTreeDownloadFileCollect)
    function _fnUspCollectFiles(oNode, aOut) {
        if (!oNode) { return; }
        if (oNode.ISFLD !== "X") { aOut.push(oNode); }   // 선택 노드 자신이 파일이면 포함
        (function rec(o) {
            if (!o || !Array.isArray(o.USPTREE)) { return; }
            for (var i = 0; i < o.USPTREE.length; i++) {
                var c = o.USPTREE[i];
                if (!c) { continue; }
                if (c.ISFLD !== "X") { aOut.push(c); }
                if (Array.isArray(c.USPTREE) && c.USPTREE.length) { rec(c); }
            }
        })(oNode);
    }

    oAPP.fn.fnDownloadUspFiles = function (oNode) {
        if (!oNode) { return; }
        oAPP.common.fnSetBusyLock("X");

        var aFiles = [];
        _fnUspCollectFiles(oNode, aFiles);

        // 다운로드 대상 파일이 없는 경우 — "Download File &1 does not exist." 토스트
        if (aFiles.length === 0) {
            var sMsg = _msg("B78") + " " + _msg("B79");   // Download File
            try { sMsg = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "073", sMsg); } catch (e) { }   // &1 does not exist.
            try { parent.showMessage(null, 10, "E", sMsg); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        var oFormData = new FormData();
        oFormData.append("USPDATA", JSON.stringify(aFiles));
        var sPath = parent.getServerPath() + "/usp_get_file_data";
        sendAjax(sPath, oFormData, _fnUspDownloadCb);
    };

    // 서버 CONTENT 응답 → zip 생성 (구 _fnGetFileContents, node-zip → adm-zip)
    function _fnUspDownloadCb(oResult) {
        if (typeof oResult !== "object" || oResult == null) {
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: "[usp_get_file_data] JSON Parse Error" }); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }
        if (oResult.RETCD === "Z") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30(oResult); } catch (e) { }
            oAPP.common.fnSetBusyLock(""); return;
        }
        if (oResult.RETCD === "E") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            if (oResult.SCRIPT) { _uspEvalScript(oResult.SCRIPT); oAPP.common.fnSetBusyLock(""); return; }
            oAPP.common.fnShowFloatingFooterMsg("E", "WS30", oResult.RTMSG);
            oAPP.common.fnSetBusyLock(""); return;
        }

        var aUspData = oResult.USPDATA;
        if (!Array.isArray(aUspData)) {
            console.error("[HTML5][WS30] download: USPDATA type error");
            oAPP.common.fnSetBusyLock(""); return;
        }

        var oZip;
        try {
            var AdmZip = parent.require("adm-zip");
            oZip = new AdmZip();
        } catch (e) {
            console.error("[HTML5][WS30] adm-zip load error:", e);
            oAPP.common.fnSetBusyLock(""); return;
        }

        for (var i = 0; i < aUspData.length; i++) {
            var o = aUspData[i] || {};
            // zip 내부 경로 = SPATH 에서 "/zu4a/usp" 접두 제거 + 선행 슬래시 제거(상대경로).
            var sEntry = String(o.SPATH || "").replace("/zu4a/usp", "").replace(/^\/+/, "");
            if (sEntry === "") { continue; }
            try {
                if (String(o.MIME || "").indexOf("image") === 0) {
                    // 이미지: data URL(base64) → 바이너리 버퍼
                    var s = String(o.CONTENT || ""), aSplit = s.split(",");
                    if (aSplit.length > 1) { s = aSplit[1]; }
                    oZip.addFile(sEntry, parent.Buffer.from(s, "base64"));
                } else {
                    oZip.addFile(sEntry, parent.Buffer.from(String(o.CONTENT || ""), "utf8"));
                }
            } catch (e) { console.error("[HTML5][WS30] zip add error:", sEntry, e); }
        }

        var sAppId = ((_model("/WS30/APP") || {}).APPID || "usp").toLowerCase();
        _fnUspFileDownSave(sAppId, oZip);
    }

    // 저장 폴더 선택 → zip 파일 기록 → 완료 토스트 + 탐색기에서 파일 강조 (구 _fnUspFileDown)
    //   ※ 노드 자원(REMOTE/FS/PATH/app/shell)은 이 모듈 스코프엔 없으므로 전부 parent.* 로 접근
    //     (editor 모듈도 parent.FS/parent.PATH 사용). bare 참조 시 ReferenceError 로 후속처리가 통째로
    //     날아가 "폴더 안 열림·완료 메시지 없음" 이 됐던 버그 수정.
    function _fnUspFileDownSave(sFileName, oZip) {
        var REMOTE = parent.REMOTE, FS = parent.FS, PATH = parent.PATH;
        var APPRT = (REMOTE && REMOTE.app), SHELL = (REMOTE && REMOTE.shell);
        if (!REMOTE || !FS || !PATH) {
            console.error("[HTML5][WS30] download: node resource(parent.REMOTE/FS/PATH) unavailable");
            oAPP.common.fnSetBusyLock(""); return;
        }

        var sDefault = "";
        try { sDefault = oAPP.attr._uspDownFolder || (APPRT && APPRT.getPath("downloads")) || ""; } catch (e) { }
        var oOpts = {
            title: _msg("B78"),   // Download
            defaultPath: sDefault,
            properties: ["openDirectory", "dontAddToRecent"]
        };
        var oP;
        try { oP = REMOTE.dialog.showOpenDialog(REMOTE.getCurrentWindow(), oOpts); }
        catch (e) { console.error("[HTML5][WS30] showOpenDialog error:", e); oAPP.common.fnSetBusyLock(""); return; }

        oP.then(function (oPaths) {
            if (!oPaths || oPaths.canceled || !oPaths.filePaths || !oPaths.filePaths.length) {
                oAPP.common.fnSetBusyLock(""); return;
            }
            var sFolder = oPaths.filePaths[0];
            oAPP.attr._uspDownFolder = sFolder;   // 다음 다운로드 기본 경로로 기억
            var sFull = PATH.join(sFolder, sFileName + "_" + _tsStamp() + ".zip");
            try {
                var oBuf = oZip.toBuffer();
                FS.writeFile(sFull, oBuf, {}, function (err) {
                    if (err) {
                        try { parent.setSoundMsg("02"); } catch (e) { }
                        try { parent.showMessage(null, 10, "E", String(err)); } catch (e) { }
                        oAPP.common.fnSetBusyLock(""); return;
                    }
                    // 완료음 + 완료 토스트(MSG_WS 002 = 저장/완료) + 탐색기에서 zip 강조 표시.
                    try { parent.setSoundMsg("01"); } catch (e) { }
                    try { parent.showMessage(null, 10, "S", _msgWs("002")); } catch (e) { }
                    try { if (SHELL && SHELL.showItemInFolder) { SHELL.showItemInFolder(sFull); } } catch (e) { }
                    oAPP.common.fnSetBusyLock("");
                });
            } catch (e) {
                console.error("[HTML5][WS30] zip write error:", e);
                oAPP.common.fnSetBusyLock("");
            }
        }, function (e) {
            console.error("[HTML5][WS30] download dialog error:", e);
            oAPP.common.fnSetBusyLock("");
        });
    }

    // 타임스탬프 yyyyMMddHHmmss (구 Date.format 의존 제거)
    function _tsStamp() {
        var d = new Date();
        function p(n) { return (n < 10 ? "0" : "") + n; }
        return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    }

    /************************************************************************
     * K6 Test Service — 선택 파일을 브라우저로 실행 (구 fnTestServiceWs30).
     *   Inactive(ACTST="I") 면 실행 금지: 에러음 + 작업표시줄 플래시 + 경고(MSG_WS 031).
     *   실행은 공통 oAPP.fn.fnExeBrowser(SPATH) (URL 조립+브라우저 실행, ws_fn_02.js).
     ************************************************************************/
    oAPP.fn.fnTestServiceUsp = function (oNode) {
        if (!oNode || !oNode.SPATH) { return; }
        var oApp = _model("/WS30/APP") || {};
        if (oApp.ACTST === "I") {
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            try { oAPP.common.fnShowFloatingFooterMsg("W", "WS30", _msgWs("031")); } catch (e) { }   // Only in activity state !!!
            return;
        }
        try { if (oAPP.fn.fnExeBrowser) { oAPP.fn.fnExeBrowser(oNode.SPATH); } } catch (e) { console.error("[HTML5][WS30] test service error:", e); }
    };

    // Activate (구 ev_pressActivateBtn = 저장 + IS_ACT)
    oAPP.fn.fnActivateUspWs30 = function () { oAPP.fn.fnSaveUspWs30({ IS_ACT: "X" }); };

    /* === Display/Change 모드 전환 (구 ev_pressDisplayModeBtn) === */
    function _uspToggleMode() {
        // 네비게이션 중(F3이 먼저 발화해 isNaviBusy=true)이면 토글 금지 — 두 ajax 경쟁 방지
        if (oAPP.attr.isNaviBusy === true) { return; }
        // 모드전환 ajax 진행 중(연타 방지) — mousedown이 미리 uspModeChanging=true를 세팅하므로
        // 이 함수 내에서는 getBusy로 in-flight 여부를 판단한다
        try { if (parent.getBusy && parent.getBusy() === "X") { return; } } catch (e) { }
        oAPP.attr.uspModeChanging = true;   // 전환 in-flight 플래그: F3 연타 차단(mousedown→click 경쟁 포함)
        oAPP.common.fnSetBusyLock("X");
        var oAppInfo = _model("/WS30/APP") || {};

        if (oAppInfo.IS_EDIT === "X") {
            // edit → display : 변경분 있으면 저장 질문
            if (oAppInfo.IS_CHAG === "X") {
                try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }
                var sMsg = _msgWs("118") + " \n " + _msgWs("119");
                oAPP.common.fnSetBusyLock("");
                oAPP.attr.uspModeChanging = false;  // 다이얼로그가 자체적으로 단축키 차단
                oAPP.common.fnConfirmBox("W", sMsg, _uspModeMsgCb, [
                    { act: "YES", label: "Yes", emphasized: true },
                    { act: "NO", label: "No" },
                    { act: "CANCEL", label: "Cancel" }
                ]);
                return;
            }
            _uspSetDisplayMode();
            return;
        }
        // display → edit
        _uspSetChangeMode();
    }

    function _uspModeMsgCb(ACTCD) {
        oAPP.common.fnSetBusyLock("X");
        try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(true); } } catch (e) { }
        if (ACTCD == null || ACTCD === "CANCEL") { oAPP.common.fnSetBusyLock(""); return; }
        if (ACTCD === "YES") { oAPP.fn.fnSaveUspWs30({ ISDISP: "X" }); return; }   // 저장 후 display
        _uspSetDisplayMode();                                                      // 저장 안 하고 display
    }

    // change → display (구 fnSetAppDisplayMode) : 서버 Lock 해제
    function _uspSetDisplayMode() {
        oAPP.common.fnSetBusyLock("X");
        var oAppInfo = _model("/WS30/APP") || {};
        var sCurrPage = (function () { try { return parent.getCurrPage(); } catch (e) { return "WS30"; } })();

        ajax_unlock_app({ APPID: oAppInfo.APPID }, function (RETURN) {
            if (RETURN.RTCOD === "E") {
                try { parent.setSoundMsg("02"); } catch (e) { }
                try { parent.CURRWIN.flashFrame(true); } catch (e) { }
                try { parent.showMessage(null, 20, RETURN.RTCOD, RETURN.RTMSG); }
                catch (e) { oAPP.common.fnShowFloatingFooterMsg("E", "WS30", RETURN.RTMSG); }
                oAPP.attr.uspModeChanging = false;
                oAPP.common.fnSetBusyLock(""); return;
            }
            RETURN.IS_EDIT = ""; RETURN.IS_CHAG = "";
            APPCOMMON.fnSetModelProperty("/WS30/APP", RETURN);
            try { if (oAPP.fn.fnChildWindowClose) { oAPP.fn.fnChildWindowClose(); } } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("S", sCurrPage, _msgWs("029")); // Switch to display mode
            _uspRefreshAfterMode();
            try { if (parent.UAI && parent.UAI.disconnect) { parent.UAI.disconnect({ CONID: parent.getBrowserKey() }); } } catch (e) { }
            oAPP.attr.uspModeChanging = false;
            _uspInitLayout();   // 트리접기 + 최상위 루트 자동 선택(busy 는 루트 선택 콜백이 해제)
        });
    }

    // display → change (구 fnSetAppChangeMode) : 서버 Lock 획득
    function _uspSetChangeMode() {
        oAPP.common.fnSetBusyLock("X");
        var oAppInfo = _model("/WS30/APP") || {};
        var sCurrPage = (function () { try { return parent.getCurrPage(); } catch (e) { return "WS30"; } })();

        var oFormData = new FormData();
        oFormData.append("APPID", oAppInfo.APPID);
        oFormData.append("ISEDIT", "X");

        ajax_init_prc(oFormData, function (oNew) {
            if (oNew.IS_EDIT !== "X") {   // 다른 사용자가 잠금 등
                oAPP.common.fnShowFloatingFooterMsg("E", sCurrPage, oNew.MESSAGE);
                try { parent.setSoundMsg("02"); } catch (e) { }
                oAPP.attr.uspModeChanging = false;
                oAPP.common.fnSetBusyLock(""); return;
            }
            APPCOMMON.fnSetModelProperty("/WS30/APP", oNew);
            try { if (oAPP.fn.fnChildWindowClose) { oAPP.fn.fnChildWindowClose(); } } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("S", sCurrPage, _msgWs("020")); // Switch to edit mode
            // Change 전환: 현재 보던 파일/에디터를 그대로 유지한다.
            //   원본(fnSetAppChangeMode)도 fnOnInitLayoutSettingsWs30()은 UI5 트리 용도라 HTML5 에선 무의미.
            //   _uspInitLayout(루트 리셋)은 초기 진입 전용 — 여기서 호출하면 에디터가 날아가고
            //   트리가 루트로 초기화돼 "화면이 작살나는" 원인이 됨.
            _uspRefreshAfterMode();   // 헤더/모드 표시 + 에디터 읽기전용 해제
            try { if (parent.UAI && parent.UAI.disconnect) { parent.UAI.disconnect({ CONID: parent.getBrowserKey() }); } } catch (e) { }
            oAPP.attr.uspModeChanging = false;
            oAPP.common.fnSetBusyLock("");   // busy 직접 해제(루트 선택 콜백에 의존 않음)
        });
    }

    /************************************************************************
     * USP 단축키 — Back(F3)/Save(Ctrl+S)/Activate(Ctrl+F3) 만 HTML5 핸들러로 교체.
     * ---------------------------------------------------------------------
     *  구 getShortCutList("WS30") 의 해당 fn 은 sap.ui.getCore().byId(...).firePress()
     *  (UI5결합) → HTML5 에선 throw. getShortCutList 를 super-wrap 해서 이 3개 KEY 의 fn 만
     *  교체한다. 이러면 두 경로 모두 HTML5 핸들러를 쓴다:
     *    ① 화면(트리/버튼) 포커스: setShortCut("WS30")(셸 fnOnEnterDispChangeMode) →
     *       getShortCutList(override) → oShortcut 레지스트리에 내 fn 등록.
     *    ② 에디터(iframe) 포커스: monaco onKeyDown 이 parent.getShortCutList("WS30").fn 직접 호출
     *       (key 이벤트는 iframe→parent 버블 안 됨) → 역시 내 fn.
     *  공통 가드: e.repeat(꾹 누름 중복)·현재 페이지 WS30·busy.
     ************************************************************************/
    function _scGuard(e, fn) {
        // 공통 가드(ws_common.js fnRunShortCut)에 위임 — 꾹누름·화면일치(WS30)·종합체크
        //   (busy/메뉴열림/다이얼로그열림/isShortcutLock/페이지이동 in-flight) 단일 방어 통로.
        if (oAPP.common && typeof oAPP.common.fnRunShortCut === "function") {
            oAPP.common.fnRunShortCut(e, "WS30", fn);
            return;
        }
        // 폴백(공통 미로드 시) — 최소 가드
        try { if (e && e.stopImmediatePropagation) { e.stopImmediatePropagation(); } } catch (x) { }
        try { if (e && e.preventDefault) { e.preventDefault(); } } catch (x) { }
        if (e && e.repeat === true) { return; }
        try { if (parent.getCurrPage && parent.getCurrPage() !== "WS30") { return; } } catch (x) { }
        try { if (parent.getBusy && parent.getBusy() === "X") { return; } } catch (x) { }
        try { fn(e); } catch (err) { console.error("[HTML5][WS30] shortcut:", err); }
    }

    var _getShortCutList_super = oAPP.common.getShortCutList;
    oAPP.common.getShortCutList = function (sPgNo) {
        var aList = (typeof _getShortCutList_super === "function") ? _getShortCutList_super(sPgNo) : [];
        if (sPgNo !== "WS30" || !Array.isArray(aList)) { return aList; }
        var oFnMap = {
            "F3": function (e) { _scGuard(e, _uspBack); },          // 뒤로가기
            "Ctrl+F1": function (e) { _scGuard(e, _uspToggleMode); }, // Display↔Change 모드전환
            "Ctrl+S": function (e) { _scGuard(e, _uspSave); },       // 저장
            "Ctrl+F3": function (e) { _scGuard(e, _uspActivate); },  // 액티브
            "F8": function (e) { _scGuard(e, _uspAppExec); },        // Application Execution (구 ev_AppExec)
            "Ctrl+F12": function (e) { _scGuard(e, _uspControllerClass); }, // Controller(Class Builder) (구 ev_pressControllerBtn)
            "Ctrl+Shift+F12": function (e) { _scGuard(e, _uspMime); },      // MIME Repository (구 ev_pressMimeBtn)
            "Shift+F1": function (e) { _scGuard(e, _uspPrettyPrint); }      // Code Editor Pretty Print (구 prettyBtn)
        };
        aList.forEach(function (o) { if (o && oFnMap[o.KEY]) { o.fn = oFnMap[o.KEY]; } });
        return aList;
    };

    /************************************************************************
     * [PUBLIC] 앱 헤더 텍스트 갱신 (APPID / 모드 / 상태) — 원본 fnGetSubHeaderWs30 formatter 미러.
     *   모드  : IS_EDIT === "X" ? Change(A02) : Display(A05)
     *   상태  : ACTST === "A" ? Active(B66) : Inactive(B67)  (APPID 없으면 빈값)
     *   윈도우/헤더 타이틀: "U4A Workspace - {APPID} {모드} {상태}" (원본 리터럴 접두).
     ************************************************************************/
    oAPP.fn.fnUpdateUspAppHeader = function () {

        var elAppId = document.getElementById("ws30AppHeaderAppId");
        var elMode = document.getElementById("ws30AppHeaderMode");
        var elStat = document.getElementById("ws30AppHeaderStatus");
        if (!elAppId && !elMode && !elStat) { return; }

        var oApp = _model("/WS30/APP") || {};
        var sAppId = oApp.APPID || "";
        var sIsEdit = oApp.IS_EDIT;
        var sActst = oApp.ACTST;
        var sIsChag = oApp.IS_CHAG;

        var sModeTxt = (sIsEdit === "X") ? _msg("A02") : _msg("A05");
        var sStatTxt = "";
        if (sAppId) {
            // 변경분(IS_CHAG=="X")이 있으면 아직 활성 전이라 Inactive 로 표시(WS20 동일 UX).
            if (sIsChag === "X") { sStatTxt = _msg("B67"); }            // Inactivate
            else { sStatTxt = (sActst === "A") ? _msg("B66") : _msg("B67"); } // Activate / Inactivate
        }

        if (elAppId) { elAppId.textContent = sAppId; }
        if (elMode) { elMode.textContent = sModeTxt; }
        if (elStat) { elStat.textContent = sStatTxt; }

        try {
            if (sAppId) {
                var sTitle = "U4A Workspace - " + sAppId + " " + sModeTxt + (sStatTxt ? (" " + sStatTxt) : "");
                if (APPCOMMON.setWSHeadText) { APPCOMMON.setWSHeadText(sTitle); }
                var oWin = (parent.CURRWIN) || (parent.REMOTE && parent.REMOTE.getCurrentWindow && parent.REMOTE.getCurrentWindow());
                if (oWin && oWin.setTitle) { oWin.setTitle(sTitle); }
            }
        } catch (e) { }

        try { oAPP.fn.fnUpdateUspToolbar(); } catch (e) { }
    };

    /************************************************************************
     * (B) 트랜잭션 툴바 (구 fnGetUspPageToolbarButtonsWs30)
     *   Display/Change · Activate · Save · | · MIME · Controller · App Exec
     *   가시성은 IS_EDIT/권한에 따라 fnUpdateUspToolbar 가 토글(원본 binding 미러).
     ************************************************************************/
    function _buildUspToolbar() {

        var BAR = document.createElement("div");
        BAR.id = "ws30Toolbar";
        BAR.className = "u4aWs30Toolbar u4a-ws10__subheader";

        var sDispChg = _msg("A05") + " <--> " + _msg("A02") + " (Ctrl+F1)";

        // [공통 UX 통일] WS20 트랜잭션 툴바와 동일 아이콘 사용(_buildWs20Toolbar 기준):
        //   Display=display · Change=pen-to-square · Activate=wand-magic-sparkles ·
        //   Save=floppy-disk · MIME=image · Controller=screwdriver-wrench · App Exec=globe.
        // Display 모드 버튼 (Change 모드에서 노출 — display 아이콘으로 Display 로 전환). 단축키 Ctrl+F1 동일.
        // mousedown 에서 플래그를 세워 click(mouseup 후) 전에 F3 가 발사되는 경쟁 조건을 막는다.
        (function () {
            var b1 = _txBtn({ id: "ws30_displayModeBtn", fa: "display", tooltip: sDispChg, evFn: _uspToggleMode });
            b1.addEventListener("mousedown", function () { oAPP.attr.uspModeChanging = true; });
            BAR.appendChild(b1);
            var b2 = _txBtn({ id: "ws30_changeModeBtn", fa: "pen-to-square", tooltip: sDispChg, evFn: _uspToggleMode });
            b2.addEventListener("mousedown", function () { oAPP.attr.uspModeChanging = true; });
            BAR.appendChild(b2);
        }());

        BAR.appendChild(_sep("ws30_sepEdit"));

        // Activate (Change 모드) — WS20 와 동일 마법사 아이콘. 단축키 Ctrl+F3 와 동일 핸들러.
        BAR.appendChild(_txBtn({ id: "ws30_activateBtn", fa: "wand-magic-sparkles", tooltip: _msg("B73") + " (Ctrl+F3)", evFn: _uspActivate }));
        // Save (Change 모드 + 개발 권한) — 단축키 Ctrl+S 와 동일 핸들러.
        BAR.appendChild(_txBtn({ id: "ws30_saveBtn", fa: "floppy-disk", tooltip: _msg("A64") + " (Ctrl+S)", evFn: _uspSave }));

        BAR.appendChild(_sep());

        // MIME Repository — 원본 oAPP.events.ev_pressMimeBtn (가드)
        BAR.appendChild(_txBtn({ id: "ws30_MimeBtn", fa: "image", text: _msg("A10"),
            tooltip: _msg("A10") + " (Ctrl+Shift+F12)", ev: "ev_pressMimeBtn" }));
        // Controller (Class Builder) — USP 전용(일반 핸들러는 oAppInfo 누락). evFn 으로 /WS30/APP 전달.
        BAR.appendChild(_txBtn({ id: "ws30_controllerBtn", fa: "screwdriver-wrench", text: _msg("A11"),
            tooltip: _msg("C38") + " (Ctrl+F12)", evFn: _uspControllerClass }));
        // Application Execution — USP 전용 ev_AppExec(일반 핸들러는 USP 미지원). evFn 직접 연결.
        BAR.appendChild(_txBtn({ id: "ws30_appExecBtn", fa: "globe", text: _msg("A06"),
            tooltip: _msg("A06") + " (F8)", evFn: _uspAppExec }));

        return BAR;
    }

    /************************************************************************
     * [PUBLIC] 트랜잭션 버튼 모드별 표시/숨김 (원본 fnGetUspPageToolbarButtonsWs30 binding 미러)
     *   bIsEdit = IS_EDIT==="X"
     *   · displayModeBtn : edit 모드에서만(되돌리기)        · changeModeBtn : display 모드 + 개발/관리 권한
     *   · activateBtn/saveBtn : edit 모드(저장은 개발 권한)  · sepEdit : edit 모드
     *   · MIME/Controller/AppExec : 항상
     ************************************************************************/
    oAPP.fn.fnUpdateUspToolbar = function () {

        var oApp = _model("/WS30/APP") || {};
        var bIsEdit = (oApp.IS_EDIT === "X");

        var sIsDev = _model("/USERINFO/USER_AUTH/IS_DEV");
        var sIsAdm = _model("/USERINFO/ISADM");
        var sAdminApp = oApp.ADMIN_APP;

        function lf_show(sId, bShow) {
            var el = document.getElementById(sId);
            if (el) { el.style.display = bShow ? "" : "none"; }
        }

        // changeMode 노출 조건(원본): 개발권한 D + (관리자거나 관리앱 아님) + display 모드
        var bShowChange = (sIsDev === "D") && !(sIsAdm !== "X" && sAdminApp === "X") && !bIsEdit;

        lf_show("ws30_displayModeBtn", bIsEdit);
        lf_show("ws30_changeModeBtn", bShowChange);
        lf_show("ws30_sepEdit", bIsEdit);
        lf_show("ws30_activateBtn", bIsEdit);
        lf_show("ws30_saveBtn", bIsEdit && (sIsDev === "D"));
    };

    /************************************************************************
     * (C) Properties 패널 (구 fnGetUspPanelWs30) — USP20 상단.
     *   URL(SPATH, readonly) + URL Copy / Is Folder?(ISFLD) / Description(DESCT) / Charset(CODPG)
     ************************************************************************/
    function _buildUspPanel() {

        // 공통 접이식 패널(U4AUI.createPanel) 소비 — 헤더/토글/접힘은 공통, 폼 내용만 화면별.
        //   (원본 sap.m.Panel expandable. 과거 화면 전용 u4aWs30Panel* 구현 → 2026-06-23 공통 이관.)
        var P = window.U4AUI.createPanel({ title: _msg("C17") }); // Properties
        var PANEL = P.el;
        PANEL.id = "uspPanel";
        PANEL.classList.add("u4aWs30Panel"); // USP 레이아웃(여백/flex)만 화면 CSS 확장

        var BODY = P.body;
        BODY.classList.add("u4aWs30Form");

        // URL (readonly) + Copy — 공통 입력 팩토리(U4AUI.createField) 소비.
        BODY.appendChild(_formRow(_msg("C18"), (function () {
            var WRAP = document.createElement("div");
            WRAP.className = "u4aWs30UrlRow";
            var oUrl = window.U4AUI.createField({ type: "text", id: "uspPropUrl", readOnly: true, inputClassName: "u4aWs30Input" });
            WRAP.appendChild(oUrl.el);
            var B = document.createElement("button");
            B.type = "button"; B.className = "u4a-btn u4aWs30UrlCopyBtn";
            B.textContent = _msg("C21"); // URL Copy
            B.addEventListener("click", function () { _uspUrlCopy(oUrl.getValue()); });
            WRAP.appendChild(B);
            return WRAP;
        })()));

        // Is Folder? (readonly checkbox) — 체크박스는 별도 컨트롤(팩토리 text 아님)
        BODY.appendChild(_formRow(_msg("C19"), (function () {
            var C = document.createElement("input");
            C.type = "checkbox"; C.id = "uspPropIsFld"; C.disabled = true;
            C.className = "u4aWs30Check";
            return C;
        })()));

        // Description (Change 모드에서 편집 — 원본 oDescInput editable {/WS30/APP/IS_EDIT})
        BODY.appendChild(_formRow(_msg("A35"), window.U4AUI.createField({
            type: "text", id: "uspPropDesc", inputClassName: "u4aWs30Input",
            clear: true, onClear: function () { _onUspFieldChange("DESCT", ""); },
            onChange: function (v) { _onUspFieldChange("DESCT", v); }
        }).el));

        // Charset (폴더면 숨김 — Change 모드에서 편집, 원본 oCharsetInput editable)
        var oCharRow = _formRow(_msg("C20"), window.U4AUI.createField({
            type: "text", id: "uspPropCodpg", inputClassName: "u4aWs30Input",
            clear: true, onClear: function () { _onUspFieldChange("CODPG", ""); },
            onChange: function (v) { _onUspFieldChange("CODPG", v); }
        }).el);
        oCharRow.id = "uspPropCharsetRow";
        BODY.appendChild(oCharRow);

        // BODY(=P.body)는 createPanel 이 이미 PANEL 에 넣음 → 별도 append 불필요.
        _uspFormResponsive("uspPropsForm", BODY);   // 좁아지면 라벨/필드 스택
        return PANEL;
    }

    // 라벨 + 필드 한 줄 (구 FormElement) — CSS Grid(label | field)
    function _formRow(sLabel, oField) {
        var ROW = document.createElement("div");
        ROW.className = "u4aWs30FormRow";
        var L = document.createElement("label");
        L.className = "u4aWs30FormLabel";
        L.textContent = sLabel;
        ROW.appendChild(L);
        var F = document.createElement("div");
        F.className = "u4aWs30FormField";
        F.appendChild(oField);
        ROW.appendChild(F);
        return ROW;
    }

    // 폼 반응형 — 폭이 좁아지면 라벨|필드(2열) → 라벨 위/필드 아래(1열) 로 스택.
    //   컨테이너 쿼리 미지원(Chromium93)이라 ResizeObserver 로 폭 감지해 data-narrow 토글
    //   (CSS .u4aWs30Form[data-narrow="1"]). Properties·Document 폼 공용.
    function _uspFormResponsive(sKey, oForm) {
        if (!oForm) { return; }
        function _apply() {
            // 라벨 12rem(192px)+필드가 편히 들어가려면 ~380px 필요 → 그 전에 미리 1열 스택(UI5 폼 동작).
            var w = oForm.clientWidth || oForm.getBoundingClientRect().width || 0;
            if (w > 0 && w < 420) { oForm.setAttribute("data-narrow", "1"); }
            else { oForm.removeAttribute("data-narrow"); }
        }
        _observeResize(sKey, oForm, _apply);
        requestAnimationFrame(_apply);   // 최초 레이아웃 직후 1회
    }

    function _uspUrlCopy(sUrl) {
        try {
            if (parent.REMOTE && parent.REMOTE.clipboard) { parent.REMOTE.clipboard.writeText(sUrl || ""); }
            else if (navigator.clipboard) { navigator.clipboard.writeText(sUrl || ""); }
            // 토스트(구 MessageToast) — MIME URL Copy 와 동일 메시지(MSG_WS 303 = Clipboard Copy Success!).
            try { parent.showMessage(null, 10, "S", _msgWs("303")); } catch (e2) { }
        } catch (e) { console.error("[HTML5][WS30] url copy error:", e); }
    }

    // Change(편집) 모드 여부 — /WS30/APP/IS_EDIT
    function _isEditMode() {
        var oApp = _model("/WS30/APP") || {};
        return oApp.IS_EDIT === "X";
    }

    // 입력 변경 → /WS30/USPDATA 갱신 + 변경 플래그 (원본 ev_UspDescInputChangeEvent → setAppChangeWs30("X"))
    function _onUspFieldChange(sField, sValue) {
        var oData = _model("/WS30/USPDATA") || {};
        oData[sField] = sValue;
        APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oData);
        try {
            if (typeof oAPP.fn.setAppChangeWs30 === "function") { oAPP.fn.setAppChangeWs30("X"); }
            else {
                var oApp = _model("/WS30/APP") || {};
                oApp.IS_CHAG = "X";
                APPCOMMON.fnSetModelProperty("/WS30/APP", oApp);
            }
        } catch (e) { console.error("[HTML5][WS30] field change:", e); }
    }

    // 날짜/시간 표시 포맷 통일 (SAP raw: YYYYMMDD→YYYY-MM-DD, HHMMSS→HH:MM:SS). 형식 안 맞으면 원문.
    function _fmtDate(s) {
        s = String(s == null ? "" : s).trim();
        return /^\d{8}$/.test(s) ? (s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8)) : s;
    }
    function _fmtTime(s) {
        s = String(s == null ? "" : s).trim();
        return /^\d{6}$/.test(s) ? (s.slice(0, 2) + ":" + s.slice(2, 4) + ":" + s.slice(4, 6)) : s;
    }
    var DOC_DATE_FIELDS = { ERDAT: 1, AEDAT: 1 };
    var DOC_TIME_FIELDS = { ERTIM: 1, AETIM: 1 };

    // /U4A/MSG_WS 메시지(118 변경됨 / 119 저장? 등) — p1 치환.
    function _msgWs(sNum, p1) {
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNum, p1 == null ? "" : String(p1));
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNum;
    }

    /************************************************************************
     * [OVERRIDE] Application 변경 플래그 (구 oAPP.fn.setAppChangeWs30 [ws_usp.js:7886]).
     *   변경 시 ACTST="I"(Inactive) — 수정하면 상태가 Inactive 로(WS20 동일 UX).
     *   원본은 모델만 갱신(UI5 바인딩 자동반영) → HTML5 는 헤더를 즉시 다시 그린다.
     ************************************************************************/
    oAPP.fn.setAppChangeWs30 = function (bIsChange) {
        if (typeof bIsChange !== "string") { return; }
        if (bIsChange !== "X" && bIsChange !== "") { return; }
        var oApp = _model("/WS30/APP") || {};
        oApp.IS_CHAG = bIsChange;
        if (bIsChange === "X") { oApp.ACTST = "I"; }   // 변경분 발생 → Inactive
        APPCOMMON.fnSetModelProperty("/WS30/APP", oApp);
        try { oAPP.fn.fnUpdateUspAppHeader(); } catch (e) { }
    };
    // 변경 플래그 조회 (구 private getAppChangeWs30)
    function _getAppChange() {
        var oApp = _model("/WS30/APP") || {};
        return oApp.IS_CHAG;
    }

    /************************************************************************
     * [PUBLIC] Properties 패널 값 채움 (/WS30/USPDATA)
     ************************************************************************/
    oAPP.fn.fnRenderUspProperties = function () {
        var oData = _model("/WS30/USPDATA") || {};
        var bFld = (oData.ISFLD === "X");

        var elUrl = document.getElementById("uspPropUrl");
        var elFld = document.getElementById("uspPropIsFld");
        var elDesc = document.getElementById("uspPropDesc");
        var elCod = document.getElementById("uspPropCodpg");
        var elCodRow = document.getElementById("uspPropCharsetRow");

        var bEdit = _isEditMode();
        if (elUrl) { elUrl.value = oData.SPATH || ""; }
        if (elFld) { elFld.checked = bFld; }
        if (elDesc) { elDesc.value = oData.DESCT || ""; elDesc.readOnly = !bEdit; }
        if (elCod) { elCod.value = oData.CODPG || ""; elCod.readOnly = !bEdit; }
        if (elCodRow) { elCodRow.style.display = bFld ? "none" : ""; }
        // 프로그램적 값 세팅 후 clear(X) 노출 재동기화(입력 이벤트 미발생 → 직접 호출). readonly 면 CSS 가 X 숨김.
        try { if (window.U4AUI && window.U4AUI.syncClear) { window.U4AUI.syncClear(elDesc); window.U4AUI.syncClear(elCod); } } catch (e) { }
    };

    /************************************************************************
     * (D) Document 페이지 (구 fnGetUspDocPageWs30 / fnGetUspDocPageContentWs30) — USP30.
     *   루트 노드 선택 시 표시되는 전체 메타데이터 폼(읽기). 모든 필드 readonly(1차).
     ************************************************************************/
    // (라벨코드, USPDATA 필드) 매핑 — 원본 순서/키 그대로
    //   [라벨코드, USPDATA 필드, 편집가능?] — 원본에서 DESCT(App Description)만 Change 모드 편집.
    var DOC_FIELDS = [
        ["A90", "APPID"],         // Web Application ID
        ["A91", "DESCT", true],   // APP Description (Change 모드 편집)
        ["C12", "REQNO"],  // Request/Task
        ["A98", "LANGU"],  // Language Key
        ["C03", "CODPG"],  // Code Page
        ["C13", "PACKG"],  // Dev. Package
        ["A92", "CLSID"],  // Assigned Class Object ID
        ["C14", "PGMID"],  // Program ID in Requests and Tasks
        ["B27", "OBJTY"],  // Object Type
        ["C15", "AUTHG"],  // Authorization Group
        ["C16", "ERUSR"],  // Create User
        ["C06", "ERDAT"],  // Create Date
        ["C07", "ERTIM"],  // Create Time
        ["C08", "AEUSR"],  // Change User
        ["C09", "AEDAT"],  // Change Date
        ["C10", "AETIM"]   // Change Time
    ];

    function _buildUspDocPage() {
        var PAGE = document.createElement("div");
        PAGE.id = "USP30";
        PAGE.className = "u4aWs30NavPage u4aWsHidden";

        var HEAD = document.createElement("div");
        HEAD.className = "u4aWs30DocHead";
        HEAD.textContent = _msg("B65"); // Document
        PAGE.appendChild(HEAD);

        var FORM = document.createElement("div");
        FORM.className = "u4aWs30Form u4aWs30DocForm";
        FORM.id = "uspDocForm";
        DOC_FIELDS.forEach(function (f) {
            var sField = f[1], bEditable = f[2] === true;
            // 공통 입력 팩토리(U4AUI.createField). 실제 readOnly 는 fnRenderUspDoc 가 모드에 따라 토글(편집필드만).
            //   편집 필드만 clear(X) — readonly(Display 모드) 일 땐 공통 CSS 가 X 를 자동 숨김.
            var oFld = window.U4AUI.createField({
                type: "text", readOnly: true, inputClassName: "u4aWs30Input",
                clear: bEditable,
                onClear: bEditable ? function () { _onUspFieldChange(sField, ""); } : null
            });
            oFld.input.setAttribute("data-doc", sField);
            if (bEditable) {
                oFld.input.setAttribute("data-doc-edit", "X");
                oFld.input.addEventListener("change", function () { _onUspFieldChange(sField, oFld.input.value); });
            }
            FORM.appendChild(_formRow(_msg(f[0]), oFld.el));
        });
        PAGE.appendChild(FORM);
        _uspFormResponsive("uspDocForm", FORM);   // 좁아지면 라벨/필드 스택
        return PAGE;
    }

    oAPP.fn.fnRenderUspDoc = function () {
        var oData = _model("/WS30/USPDATA") || {};
        var FORM = document.getElementById("uspDocForm");
        if (!FORM) { return; }
        var bEdit = _isEditMode();
        DOC_FIELDS.forEach(function (f) {
            var sField = f[1], bEditable = f[2] === true;
            var el = FORM.querySelector('[data-doc="' + sField + '"]');
            if (!el) { return; }
            var v = (oData[sField] != null ? oData[sField] : "");
            // 날짜/시간 표시 포맷 통일
            if (DOC_DATE_FIELDS[sField]) { v = _fmtDate(v); }
            else if (DOC_TIME_FIELDS[sField]) { v = _fmtTime(v); }
            el.value = v;
            // 편집 가능 필드만 Change 모드에서 readOnly 해제 + clear(X) 노출 재동기화(readonly 면 CSS 가 숨김).
            if (bEditable) {
                el.readOnly = !bEdit;
                try { if (window.U4AUI && window.U4AUI.syncClear) { window.U4AUI.syncClear(el); } } catch (e) { }
            }
        });
    };

    /************************************************************************
     * (E) NavContainer (구 fnGetUspNavContainerWs30 — usp_navcon) : USP10/USP20/USP30
     *   USP10 = 인트로(로고), USP20 = 콘텐츠(Properties 패널 + 에디터), USP30 = 문서폼.
     ************************************************************************/
    function _buildUspNav() {
        var NAV = document.createElement("div");
        NAV.id = "usp_navcon";
        NAV.className = "u4aWs30Nav";

        // USP10 인트로
        var INTRO = document.createElement("div");
        INTRO.id = "USP10";
        INTRO.className = "u4aWs30NavPage u4aWs30Intro";
        var IMG = document.createElement("img");
        IMG.className = "u4aWs30IntroImg";
        try {
            // 구 fnGetUspIntroPageWs30: PATH.join(APPPATH, "img", "intro.png"). 없으면 미표시(깨진 아이콘 방지).
            var sImg = parent.PATH.join(parent.APPPATH, "img", "intro.png");
            if (sImg && (!parent.FS || parent.FS.existsSync(sImg))) { IMG.src = sImg; }
        } catch (e) { }
        IMG.alt = "";
        INTRO.appendChild(IMG);
        NAV.appendChild(INTRO);

        // USP20 콘텐츠 (Properties 패널 + 에디터 호스트)
        var CONT = document.createElement("div");
        CONT.id = "USP20";
        CONT.className = "u4aWs30NavPage u4aWsHidden";
        CONT.appendChild(_buildUspPanel());
        var EDHOST = document.createElement("div");
        EDHOST.id = "uspEditorHost";
        EDHOST.className = "u4aWs30EditorHost";
        CONT.appendChild(EDHOST);
        NAV.appendChild(CONT);

        // USP30 문서
        NAV.appendChild(_buildUspDocPage());

        return NAV;
    }

    /************************************************************************
     * [PUBLIC] USP 내부 페이지 전환 (구 usp_navcon.to / fnOnMoveToPage("USPxx"))
     ************************************************************************/
    oAPP.fn.fnUspNavTo = function (sPgId) {
        var NAV = document.getElementById("usp_navcon");
        if (!NAV) { return; }
        ["USP10", "USP20", "USP30"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) { el.classList.toggle("u4aWsHidden", id !== sPgId); }
        });
        oAPP.attr.uspCurrNav = sPgId;
    };

    /************************************************************************
     * (F) 푸터 (구 floatingFooter /FMSG/WS30) — 공통 컴포넌트(U4AUI.footer*, shell.css .u4a-footer).
     *   WS10/WS20 와 단일 소스(아이콘/텍스트/닫기X/자동숨김 내장). 화면별 복제 없음.
     ************************************************************************/
    function _buildUspFooter() {
        var T = document.createElement("div");
        T.innerHTML = window.U4AUI.footerMarkup("ws30Footer");
        return T.firstChild;   // <div class="u4a-footer" id="ws30Footer">…</div>
    }

    oAPP.usphtml.showFooter = function (sType, sMsg) {
        //  자동숨김은 아래 라우팅 래퍼(fnShowFloatingFooterMsg)가 소유(모델 /FMSG/WS30 리셋 포함) → ms=0.
        if (window.U4AUI) { window.U4AUI.footerShow("ws30Footer", sType || "I", sMsg || "", 0); }
    };
    oAPP.usphtml.hideFooter = function () {
        if (window.U4AUI) { window.U4AUI.footerHide("ws30Footer"); }
    };

    // 셸 푸터 라우팅(fnShowFloatingFooterMsg)에 WS30 분기 추가 — shell.js 무수정(super-wrap).
    var _superShowFooter = oAPP.common.fnShowFloatingFooterMsg;
    var _superHideFooter = oAPP.common.fnHideFloatingFooterMsg;
    oAPP.common.fnShowFloatingFooterMsg = function (TYPE, POS, MSG) {
        var sPos = POS || (function () { try { return parent.getCurrPage(); } catch (e) { return ""; } })();
        if (sPos === "WS30") {
            try { oAPP.common.fnHideFloatingFooterMsg(); } catch (e) { }
            try { APPCOMMON.fnSetModelProperty("/FMSG/WS30", { ISSHOW: true, TYPE: TYPE, TXT: MSG }); } catch (e) { }
            try { oAPP.usphtml.showFooter(TYPE || "I", MSG || ""); } catch (e) { }
            if (oAPP.attr.footerMsgTimeout) { clearTimeout(oAPP.attr.footerMsgTimeout); }
            oAPP.attr.footerMsgTimeout = setTimeout(function () {
                try { oAPP.common.fnHideFloatingFooterMsg(); } catch (e) { }
            }, 10000);
            return;
        }
        if (typeof _superShowFooter === "function") { return _superShowFooter(TYPE, POS, MSG); }
    };
    oAPP.common.fnHideFloatingFooterMsg = function () {
        try { oAPP.usphtml.hideFooter(); } catch (e) { }
        if (typeof _superHideFooter === "function") { return _superHideFooter(); }
    };

    /************************************************************************
     * WS30 셸 렌더 (1회) — #WS30 컨테이너에 [메뉴바 + 앱헤더 + 툴바 + 2분할 + 푸터] 그림.
     ************************************************************************/
    oAPP.fn.fnRenderUspShell = function () {

        var oUi = oAPP.attr.ui || {};
        var oPages = oUi.pages || {};
        var oWS30 = (oPages && oPages.WS30) || document.getElementById("WS30");
        if (!oWS30) {
            console.warn("[HTML5][WS30] #WS30 container not found — shell 미초기화");
            return;
        }

        // 앱 경로(인트로 이미지/SVG 아이콘용) 보관 — 원본 APP.getAppPath()
        try {
            oAPP.attr.uspAppPath = (parent.APP && parent.APP.getAppPath && parent.APP.getAppPath()) || oAPP.attr.uspAppPath || "";
        } catch (e) { }

        // shell 의 "변환 예정" placeholder(.u4aWsConvertNotice) 제거.
        //   shell fnOnMoveToPage 의 placeholder 가드는 data-ws20-shell 만 검사하므로(WS30 는
        //   data-ws30-shell 사용) WS30 재진입마다 super 가 placeholder 를 다시 붙인다.
        //   → 렌더 진입 시 항상 제거(아래 early-return 경로 포함).
        try {
            var aPH = oWS30.querySelectorAll(".u4aWsConvertNotice");
            for (var iPH = 0; iPH < aPH.length; iPH++) { aPH[iPH].parentNode.removeChild(aPH[iPH]); }
            oWS30.removeAttribute("data-placeholder-shown");
        } catch (e) { }

        // 이미 셸 렌더됨 → 헤더/툴바/패널만 최신화 (placeholder 는 위에서 이미 제거됨)
        if (oWS30.getAttribute("data-ws30-shell") === "X") {
            try { oAPP.fn.fnUpdateUspAppHeader(); } catch (e) { }
            // 재진입 시 셸을 재빌드하지 않으므로, 직전 전체화면 상태(트리/리사이저 display:none)를 해제해
            //   좌측 트리가 사라진 채로 들어오는 것을 막는다.
            try { if (oAPP.usphtml.editorExitFullscreen) { oAPP.usphtml.editorExitFullscreen(); } } catch (e) { }
            // 방어: 트리/에디터 스플릿 드래그 중 화면 이탈로 전역 리사이즈 커서/선택차단 클래스가 body 에
            //   남았을 수 있다(mouseup 미발생). 재진입 시 정리(없으면 무해).
            try { document.body.classList.remove("u4aWs20ResizingCursor"); } catch (e) { }
            return;
        }

        // 새 셸 구성 — 이전 셸 인스턴스의 옵저버/리스너 일괄 해제(누수 방지) 후 DOM 교체.
        _disconnectAllObservers();
        oWS30.innerHTML = "";

        var MAIN = document.createElement("div");
        MAIN.id = "WS30_MAIN";
        MAIN.className = "u4aWs30MainPage";

        // 윈도우 메뉴바 + 공통 헤더 (WS10/WS20 공통 컴포넌트)
        try {
            if (oAPP.ws10html && typeof oAPP.ws10html.buildMenubar === "function") {
                MAIN.appendChild(oAPP.ws10html.buildMenubar(_getWindowMenuWS30(), _ws30MenuSelect));
            }
        } catch (e) { console.error("[HTML5][WS30] menubar build error:", e); }

        // 앱 헤더 + 트랜잭션 툴바
        MAIN.appendChild(_buildUspAppHeader());
        MAIN.appendChild(_buildUspToolbar());

        // 2분할: 좌(트리, 500px) | 우(NavContainer)
        var SPLIT = document.createElement("div");
        SPLIT.id = "ws30SplitRow";
        SPLIT.className = "u4aWs30SplitRow";

        var LEFT = document.createElement("div");
        LEFT.id = "ws30TreePane";
        LEFT.className = "u4aWs30TreePane";
        // 접힘/펼침 툴바 (별도 밴드) — 원본처럼 컬럼 헤더 위에 분리.
        var THEAD = document.createElement("div");
        THEAD.className = "u4aWs30TreeToolbar";
        // 구 ev_UspTreeTableExpand/Collapse = "선택 노드" 서브트리 펼침/접힘(루트면 전체). 툴팁=C27/C28(컨텍스트 메뉴와 동일 동작).
        THEAD.appendChild(_treeTbBtn("angles-down", _msg("C27"), function () { if (oAPP.fn.fnUspTreeExpandSelected) { oAPP.fn.fnUspTreeExpandSelected(); } }));
        THEAD.appendChild(_treeTbBtn("angles-up", _msg("C28"), function () { if (oAPP.fn.fnUspTreeCollapseSelected) { oAPP.fn.fnUspTreeCollapseSelected(); } }));
        LEFT.appendChild(THEAD);
        // 트리 본문 컨테이너 (ws_html5_usp_tree.js 가 트리를 채움) — 2컬럼(이름|설명) 트리.
        var TBODY = document.createElement("div");
        TBODY.id = "uspTreeBody";
        TBODY.className = "u4aWs30TreeBody";
        // 컬럼 헤더(이름 | 설명)를 본문(스크롤 영역) 안에 sticky 로 둔다 — 행과 동일한 폭
        //   컨텍스트(스크롤바 유무 영향 동일)를 공유해야 컬럼 구분선이 행 구분선과 정확히 정렬된다.
        var TCOL = document.createElement("div");
        TCOL.className = "u4aWs30TreeColHead";
        var COLNAME = document.createElement("div");
        COLNAME.className = "u4aWs30TreeColName";
        COLNAME.textContent = _msg("C11");
        var COLDESC = document.createElement("div");
        COLDESC.className = "u4aWs30TreeColDesc";
        COLDESC.textContent = _msg("A35");
        TCOL.appendChild(COLNAME);
        TCOL.appendChild(COLDESC);
        TBODY.appendChild(TCOL);
        LEFT.appendChild(TBODY);
        SPLIT.appendChild(LEFT);

        // 리사이저(좌우 드래그)
        var RES = document.createElement("div");
        RES.id = "ws30Resizer";
        // 공통 스플릿바 스킨(.u4a-splitter__bar = 서버리스트 기준 그립) 소비. 드래그는 자체 JS 훅 유지.
        RES.className = "u4aWs30Resizer u4a-splitter__bar";
        SPLIT.appendChild(RES);

        // 우측 NavContainer
        var RIGHT = document.createElement("div");
        RIGHT.id = "ws30ContentPane";
        RIGHT.className = "u4aWs30ContentPane";
        RIGHT.appendChild(_buildUspNav());
        SPLIT.appendChild(RIGHT);

        MAIN.appendChild(SPLIT);

        // 푸터
        MAIN.appendChild(_buildUspFooter());

        oWS30.appendChild(MAIN);
        oWS30.setAttribute("data-ws30-shell", "X");

        // 참조 보관
        oAPP.attr.ui = oAPP.attr.ui || {};
        oAPP.attr.ui.usp = { main: MAIN, treeBody: TBODY, nav: document.getElementById("usp_navcon") };

        // 리사이저 바인딩
        _bindResizer(RES, LEFT, SPLIT);

        // 초기 표시: 인트로
        oAPP.fn.fnUspNavTo("USP10");

        // 헤더/툴바 텍스트
        try { oAPP.fn.fnUpdateUspAppHeader(); } catch (e) { }

        // 렌더 전 설정된 /FMSG/WS30 리플레이
        try {
            var oFMsg = _model("/FMSG/WS30");
            if (oFMsg && oFMsg.ISSHOW) { oAPP.usphtml.showFooter(oFMsg.TYPE || "I", oFMsg.TXT || ""); }
        } catch (e) { }
    };

    // 좌측 트리 패널 폭 드래그 리사이즈 (구 SplitterLayoutData usptreeSplitLayout).
    //   드래그 하한 = 패널의 CSS min-width(--ws30-tree-minw) 를 그대로 읽어 사용(단일 출처).
    function _bindResizer(oBar, oLeft, oSplit) {
        var bDrag = false, iStartX = 0, iStartW = 0;
        function _cssMinW() {
            try {
                var v = parseFloat(window.getComputedStyle(oLeft).minWidth);
                if (!isNaN(v) && v > 0) { return v; }
            } catch (e) { }
            return 220;
        }
        // 트리 최대폭 = 컨테이너 폭 − 콘텐츠 최소 가시폭(320). 항상 최소폭 이상.
        //   콘텐츠는 이 하한까지 줄 수 있고, 그 안에서 폼은 반응형(라벨↑/필드↓ 스택)으로 대응한다.
        function _maxTree() {
            var iMax = oSplit.clientWidth - 320;
            var iMin = _cssMinW();
            return iMax < iMin ? iMin : iMax;
        }
        // 현재 트리폭이 최대폭을 넘으면 줄여서 스플릿바/콘텐츠가 화면 밖으로 밀리지 않게 한다.
        //   (최대화 상태에서 넓게 드래그 → restore 시 컨테이너가 줄어 트리(고정폭)가 넘치던 문제)
        function _clampWidth() {
            var iCur = oLeft.getBoundingClientRect().width;
            var iMax = _maxTree();
            if (iCur > iMax) { oLeft.style.flex = "0 0 " + iMax + "px"; }
        }
        function lf_move(e) {
            if (!bDrag) { return; }
            var iW = iStartW + (e.clientX - iStartX);
            var iMin = _cssMinW(), iMax = _maxTree();
            if (iW < iMin) { iW = iMin; }
            if (iW > iMax) { iW = iMax; }
            oLeft.style.flex = "0 0 " + iW + "px";
        }
        function lf_up() {
            bDrag = false;
            document.body.classList.remove("u4aWs20ResizingCursor");
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", function (e) {
            bDrag = true;
            iStartX = e.clientX;
            iStartW = oLeft.getBoundingClientRect().width;
            document.body.classList.add("u4aWs20ResizingCursor");
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault();
        });

        // 컨테이너 크기 변경(최대화↔복원/창 리사이즈) 시 트리폭 재클램프 — 스플릿바 숨음 방지.
        //   중앙 레지스트리로 관리(같은 키 재호출 시 이전 옵저버 자동 정리).
        _observeResize("treeSplit", oSplit, _clampWidth);
    }

    /************************************************************************
     * [OVERRIDE] 페이지 이동 (shell fnOnMoveToPage 를 super-wrap) — WS20 패턴 동일.
     *   sPgNm === "WS30" 일 때 placeholder 대신 셸 렌더 + 서버 트리 로드(fnMoveToWs30).
     ************************************************************************/
    var _fnOnMoveToPage_super = oAPP.fn.fnOnMoveToPage;
    oAPP.fn.fnOnMoveToPage = function (sPgNm) {
        if (typeof _fnOnMoveToPage_super === "function") { _fnOnMoveToPage_super(sPgNm); }
        if (sPgNm === "WS30") {
            try { oAPP.fn.fnRenderUspShell(); } catch (e) { console.error("[HTML5][WS30] fnOnMoveToPage render error:", e); }
            // ★ WS30 단축키 등록은 "여기" — 셸(트리/패널) 동기 렌더 직후, WS30 진입마다 항상 실행되는
            //   지점. (진입부 fnOnEnterDispChangeMode 에선 등록 안 함: 화면 그리기 전 등록 금지 원칙.
            //    에디터 _releaseBusy 는 노드 선택 전엔 안 불려 부적합.) removeShortCut 선행 = 멱등(재진입
            //    누수 방지). 직후 fnMoveToWs30 가 트리 로드까지 busy 유지 → 그 사이 F3 은 종합가드가 차단.
            try {
                if (oAPP.common && oAPP.common.setShortCut) {
                    oAPP.common.removeShortCut("WS30");
                    oAPP.common.setShortCut("WS30");
                }
            } catch (e) { console.error("[HTML5][WS30] setShortCut(WS30):", e); }
            try { oAPP.fn.fnMoveToWs30(); } catch (e) { console.error("[HTML5][WS30] fnMoveToWs30 error:", e); }
        }
    };

    /************************************************************************
     * [OVERRIDE] WS30 진입 — 서버 트리 로드 (구 oAPP.fn.fnMoveToWs30 [ws_fn_02.js:668])
     * ---------------------------------------------------------------------
     *  UI5 의존부(sap.ui.getCore().lock / byId("usptree") / getModel().refresh) 제거.
     *  서버 흐름 보존: ajax /usp_init_prc(APPID) → /WS30/USPTREE = T_DATA →
     *  평면→중첩 트리화 → 트리 렌더 → 루트 자동 선택. RETCD 분기도 보존.
     ************************************************************************/
    oAPP.fn.fnMoveToWs30 = function () {

        oAPP.common.fnSetBusyLock("X");

        // WS30 (재)진입 → 혹시 남아있을 페이지이동 락 해제(백스톱).
        try { oAPP.common.fnNaviRelease(); } catch (e) { }

        // USP 단축키(Back/Save/Activate)는 getShortCutList("WS30") override + 셸 setShortCut("WS30")
        //   (fnOnEnterDispChangeMode)로 이미 HTML5 핸들러가 등록됨 — 여기서 별도 작업 불필요.

        var oAppInfo = _model("/WS30/APP") || {};
        var sServerPath = parent.getServerPath();
        var sInitPath = sServerPath + "/usp_init_prc";

        var oFormData = new FormData();
        oFormData.append("APPID", oAppInfo.APPID || "");

        sendAjax(sInitPath, oFormData, _fnCallback);

        function _fnCallback(oResult) {

            // Critical Error → 10번 강제 이동
            if (oResult.RETCD === "Z") {
                oAPP.common.fnSetBusyLock("");
                try { oAPP.fn.fnCriticalErrorWs30(oResult); } catch (e) { console.error("[HTML5][WS30] critical:", e); }
                return;
            }

            if (oResult.RETCD !== "S") {
                oAPP.common.fnSetBusyLock("");
                try {
                    parent.showMessage(null, 20, "E", oResult.RTMSG, function () {
                        try { oAPP.fn.fnCriticalErrorWs30(oResult); } catch (e) { }
                    });
                } catch (e) {
                    oAPP.common.fnShowFloatingFooterMsg("E", "WS30", oResult.RTMSG || "");
                }
                return;
            }

            // 좌측 트리 데이터(평면) → 중첩 트리화 후 모델 반영
            var aFlat = oResult.T_DATA || [];
            APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aFlat);
            var aTree = oAPP.fn.fnBuildUspTree(aFlat);
            APPCOMMON.fnSetModelProperty("/WS30/USPTREE", aTree);

            // 트리 렌더 (ws_html5_usp_tree.js)
            try {
                if (typeof oAPP.fn.fnRenderUspTree === "function") { oAPP.fn.fnRenderUspTree(); }
            } catch (e) { console.error("[HTML5][WS30] fnRenderUspTree error:", e); }

            // 화면 처음 로딩 시 초기 레이아웃 (구 fnOnInitLayoutSettingsWs30, ws_fn_02.js:795):
            //   트리 전체 접기 + 최상위 루트 폴더 자동 선택(구 ev_getRootNodeRowsUpdated).
            //   → 초기 화면은 루트만 접힌 채 선택된 상태(하위 펼침 아님). busy 는 루트 선택 콜백이 해제.
            try { _uspInitLayout(); }
            catch (e) {
                console.error("[HTML5][WS30] _uspInitLayout error:", e);
                oAPP.common.fnSetBusyLock("");
            }
        }
    };

    /************************************************************************
     * 평면 배열(OBJKY/PUJKY) → 중첩 트리(USPTREE children). 구 fnSetTreeJson 대체.
     *   루트 = PUJKY 가 빈값이거나 부모를 못 찾는 노드.
     ************************************************************************/
    oAPP.fn.fnBuildUspTree = function (aFlat) {
        if (!Array.isArray(aFlat)) { return []; }

        // 이미 중첩(자식 USPTREE 보유)인지 감지 — 중첩이면 그대로 사용
        var bNested = aFlat.some(function (o) { return o && Array.isArray(o.USPTREE) && o.USPTREE.length; });
        if (bNested) { return aFlat; }

        var oMap = {}, aRoot = [];
        aFlat.forEach(function (o) {
            o.USPTREE = o.USPTREE || [];
            oMap[o.OBJKY] = o;
        });
        aFlat.forEach(function (o) {
            var sPar = o.PUJKY;
            if (sPar && oMap[sPar] && oMap[sPar] !== o) { oMap[sPar].USPTREE.push(o); }
            else { aRoot.push(o); }
        });
        return aRoot;
    };

    /************************************************************************
     * [OVERRIDE] 트리 Row 선택 → 서버에서 파일 내용 요청 (구 fnUspTreeTableRowSelect [ws_usp.js:4747])
     * ---------------------------------------------------------------------
     *  UI5 row 대신 선택 노드 데이터(oNodeData) 를 받는다(트리 모듈이 전달).
     ************************************************************************/
    oAPP.fn.fnUspTreeTableRowSelect = function (oNodeData) {

        if (!oNodeData) { return; }

        oAPP.common.fnSetBusyLock("X");

        var sServerPath = parent.getServerPath();
        var sPath = sServerPath + "/usp_get_object_line_data";

        var oSendData = { S_HEAD: oNodeData };
        var oFormData = new FormData();
        oFormData.append("sData", JSON.stringify(oSendData));
        oFormData.append("response_format", "SINGLE");   // 단일 멀티파트(원본 동일)

        var oParam = { oNodeData: oNodeData };

        // sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob
        sendAjax(sPath, oFormData, _fnLineSelectCb.bind(oParam), null, null, null, null, "X");
    };

    /************************************************************************
     * 파일 내용 응답 처리 (구 _fnLineSelectCb [ws_usp.js:5054]) — 멀티파트/헤더분리 보존.
     *   읽기 경로: /WS30/USPDATA 갱신 → 루트면 USP30(문서)/파일·폴더면 USP20 →
     *   파일이면 에디터 iframe 에 내용 표시(에디터 모듈).
     ************************************************************************/
    async function _fnLineSelectCb(oResult, xhr) {

        var oNodeData = this && this.oNodeData;

        // Blob → text
        var oJsonResult = await new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () { resolve({ RETCD: "S", RDATA: reader.result }); };
            reader.onerror = function (error) {
                console.error("[HTML5][WS30] _fnLineSelectCb Blob→Text 변환 오류", error);
                var sErrMsg = "";
                try { sErrMsg = (oAPP.msg.M348 || "") + "\n\n" + (oAPP.msg.M228 || ""); } catch (e) { }
                resolve({ RETCD: "E", RTMSG: sErrMsg });
            };
            reader.readAsText(oResult);
        });

        if (oJsonResult.RETCD === "E") {
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: oJsonResult.RTMSG }); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 멀티파트(UHAK900763 버전) — 원본 _getUspMultiPartData 보존(원본 ws_usp.js 가 정의)
        var oMULTI_RESULT;
        try {
            if (APPCOMMON.checkWLOList("C", "UHAK900763")) {
                oMULTI_RESULT = await _uspMultiPart(oJsonResult.RDATA, xhr);
                if (oMULTI_RESULT && oMULTI_RESULT.RETCD !== "E") {
                    oJsonResult.RDATA = oMULTI_RESULT.RDATA.usp_head_data;
                }
            }
        } catch (error) {
            console.error("[HTML5][WS30] _getUspMultiPartData 오류", error);
            var sErrMsg2 = "";
            try { sErrMsg2 = (oAPP.msg.M348 || "") + "\n\n" + (oAPP.msg.M228 || ""); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: sErrMsg2 }); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // BLOB→string→JSON (응답 헤더 usp_head_data_Length 기반 헤더/컨텐츠 분리 보존)
        var sJsonResult = oJsonResult.RDATA;
        var oParsed;
        try {
            var sUspHeaderLength = xhr && xhr.getResponseHeader && xhr.getResponseHeader("usp_head_data_Length");
            if (sUspHeaderLength) {
                var oUspBytes = new TextEncoder().encode(sJsonResult);
                var oDecoder = new TextDecoder("utf-8");
                sJsonResult = oDecoder.decode(oUspBytes.slice(0, Number(sUspHeaderLength)));
                oParsed = JSON.parse(sJsonResult);
                oParsed.CONTENT = oDecoder.decode(oUspBytes.slice(Number(sUspHeaderLength)));
            } else {
                oParsed = JSON.parse(sJsonResult);
            }
        } catch (error) {
            console.error("[HTML5][WS30] _fnLineSelectCb JSON Parse 오류", error);
            var sErrMsg3 = "";
            try { sErrMsg3 = (oAPP.msg.M348 || "") + "\n\n" + (oAPP.msg.M228 || ""); } catch (e) { }
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: sErrMsg3 }); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        if (typeof oParsed !== "object" || oParsed == null) {
            try { oAPP.fn.fnCriticalErrorWs30({ RTMSG: "[usp_get_object_line_data] JSON Parse Error" }); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        if (oMULTI_RESULT && oMULTI_RESULT.RDATA && typeof oMULTI_RESULT.RDATA.usp_body_data !== "undefined") {
            oParsed.CONTENT = oMULTI_RESULT.RDATA.usp_body_data;
        }

        // 서버 분기 (Z/E)
        if (oParsed.RETCD === "Z") {
            console.error(oParsed);
            try { oAPP.fn.fnCriticalErrorWs30(oParsed); } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }
        if (oParsed.RETCD === "E") {
            console.error(oParsed);
            try { parent.setSoundMsg("02"); } catch (e) { }
            try { parent.CURRWIN.flashFrame(true); } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("E", "WS30", oParsed.RTMSG || "");
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 이전 선택 해제 (트리 모듈)
        try { if (oAPP.fn.fnOnUspTreeUnSelect) { oAPP.fn.fnOnUspTreeUnSelect(); } } catch (e) { }

        // 서버 라인 정보 + 노드 데이터 병합
        var oResultRowData = oParsed.S_HEAD || {};
        oResultRowData.ISSEL = true;
        oResultRowData = $.extend(true, {}, oNodeData || {}, oResultRowData);

        var bIsRoot = (oResultRowData.PUJKY === "" || oResultRowData.PUJKY == null);
        var bIsFold = (oResultRowData.ISFLD === "X");

        // CONTENT 매핑
        oResultRowData.CONTENT = oParsed.CONTENT;

        // 선택 라인 저장 (에디터 iframe 이 getSelectedUspLineData 로 읽음)
        oAPP.usp.oSelectRowData = JSON.parse(JSON.stringify(oResultRowData));

        // 트리 노드 상태(선택 표시) 반영 — 원래 노드 객체에도 머지
        try {
            if (oNodeData) {
                oNodeData.ISSEL = true;
                $.extend(oNodeData, { SPATH: oResultRowData.SPATH, DESCT: oResultRowData.DESCT, CODPG: oResultRowData.CODPG });
            }
            if (oAPP.fn.fnUspTreeMarkSelected) { oAPP.fn.fnUspTreeMarkSelected(oNodeData); }
        } catch (e) { }

        if (bIsRoot) {
            // 루트 → APP 정보 머지 + 문서 페이지
            var oAppInfo = _model("/WS30/APP") || {};
            oAppInfo = Object.assign({}, oAppInfo, oParsed.S_APPINFO);
            APPCOMMON.fnSetModelProperty("/WS30/APP", oAppInfo);
            oResultRowData = $.extend(true, oResultRowData, oAppInfo);
            APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oResultRowData);

            try { oAPP.fn.fnUpdateUspAppHeader(); } catch (e) { }
            try { oAPP.fn.fnRenderUspDoc(); } catch (e) { }
            oAPP.fn.fnUspNavTo("USP30");
            oAPP.common.fnSetBusyLock("");
            return;
        }

        APPCOMMON.fnSetModelProperty("/WS30/USPDATA", oResultRowData);

        // 콘텐츠 페이지 (Properties + 에디터)
        try { oAPP.fn.fnRenderUspProperties(); } catch (e) { }
        oAPP.fn.fnUspNavTo("USP20");

        if (bIsFold) {
            // 폴더 → 에디터 없음(비움). busy 해제.
            try { if (oAPP.usphtml.editorClear) { oAPP.usphtml.editorClear(); } } catch (e) { }
            oAPP.common.fnSetBusyLock("");
            return;
        }

        // 파일 → 에디터에 내용 표시(에디터 모듈). busy 는 에디터 로드 완료/실패 시 해제.
        try {
            if (oAPP.usphtml.editorLoadSelected) {
                oAPP.usphtml.editorLoadSelected(oResultRowData);
            } else {
                oAPP.common.fnSetBusyLock("");
            }
        } catch (e) {
            console.error("[HTML5][WS30] editorLoadSelected error:", e);
            oAPP.common.fnSetBusyLock("");
        }
    }

})(window, jQuery, oAPP);
