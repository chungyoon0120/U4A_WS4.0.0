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
        delete oAPP.attr.uspObservers[sKey];
    }

    function _observeResize(sKey, oTarget, fnCb) {
        _disconnectObserver(sKey);                 // 같은 키 이전 옵저버 정리(중복 방지)
        if (!oTarget || typeof fnCb !== "function") { return; }
        var rec = {};
        try {
            if (window.ResizeObserver) {
                rec.ro = new ResizeObserver(function () { fnCb(); });
                rec.ro.observe(oTarget);
            } else {
                rec.winFn = function () { fnCb(); };
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
        BACK.innerHTML = _fa("arrow-left");
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

    // 실제 WS10 이동 (구 fnMoveToWs10)
    function _doBackToWs10() {
        try {
            if (oAPP.fn && typeof oAPP.fn.fnMoveToWs10 === "function") { oAPP.fn.fnMoveToWs10(); return; }
        } catch (e) { console.error("[HTML5][WS30] fnMoveToWs10 error:", e); }
        try { oAPP.fn.fnOnMoveToPage("WS10"); } catch (e) { console.error("[HTML5][WS30] back fallback error:", e); }
    }

    /************************************************************************
     * 뒤로가기 (구 ev_pressWs30Back → fnMoveBack_Ws30_To_Ws10) — WS20 ev_pageBack 과 동일 UX.
     *   변경분(IS_CHAG="X") + Change 모드일 때만 저장 질문(MSG_WS 118/119, Yes/No/Cancel).
     *   그 외엔 바로 이동.
     ************************************************************************/
    function _uspBack() {

        oAPP.common.fnSetBusyLock("X");

        var oApp = _model("/WS30/APP") || {};
        var bChag = (oApp.IS_CHAG === "X");
        var bEdit = (oApp.IS_EDIT === "X");

        // 변경 없거나 display 모드 → 묻지 않고 바로 이동
        if (!bChag || !bEdit) { _doBackToWs10(); return; }

        var sMsg = _msgWs("118") + " \n " + _msgWs("119"); // 변경됨 / 저장 후 나갈까요?

        // 사용자 응답 대기 → busy 해제 + 자식 팝업 잠시 숨김(원본 동일)
        oAPP.common.fnSetBusyLock("");
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

        // CANCEL/닫기 → 머무름 (숨긴 팝업 복원)
        if (ACTCD == null || ACTCD === "CANCEL") {
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
                try { fnSave({ ISBACK: "X" }); return; }
                catch (e) { oAPP.common.fnSetBusyLock(""); console.error("[HTML5][WS30] save(ISBACK):", e); }
            }
            // 저장 미구현(2차) — 변경 유실 방지 위해 이동하지 않고 머무름 + 안내.
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
        var aUspTreeData = _parseTree2Tab($.extend(true, [], aTreeData), "USPTREE");

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

        _uspRefreshAfterMode();
        oAPP.common.fnSetBusyLock("");
    }

    // Activate (구 ev_pressActivateBtn = 저장 + IS_ACT)
    oAPP.fn.fnActivateUspWs30 = function () { oAPP.fn.fnSaveUspWs30({ IS_ACT: "X" }); };

    /* === Display/Change 모드 전환 (구 ev_pressDisplayModeBtn) === */
    function _uspToggleMode() {
        oAPP.common.fnSetBusyLock("X");
        var oAppInfo = _model("/WS30/APP") || {};

        if (oAppInfo.IS_EDIT === "X") {
            // edit → display : 변경분 있으면 저장 질문
            if (oAppInfo.IS_CHAG === "X") {
                try { if (oAPP.fn.fnChildWindowShow) { oAPP.fn.fnChildWindowShow(false); } } catch (e) { }
                var sMsg = _msgWs("118") + " \n " + _msgWs("119");
                oAPP.common.fnSetBusyLock("");
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
                oAPP.common.fnSetBusyLock(""); return;
            }
            RETURN.IS_EDIT = ""; RETURN.IS_CHAG = "";
            APPCOMMON.fnSetModelProperty("/WS30/APP", RETURN);
            try { if (oAPP.fn.fnChildWindowClose) { oAPP.fn.fnChildWindowClose(); } } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("S", sCurrPage, _msgWs("029")); // Switch to display mode
            _uspRefreshAfterMode();
            try { if (parent.UAI && parent.UAI.disconnect) { parent.UAI.disconnect({ CONID: parent.getBrowserKey() }); } } catch (e) { }
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
                oAPP.common.fnSetBusyLock(""); return;
            }
            APPCOMMON.fnSetModelProperty("/WS30/APP", oNew);
            try { if (oAPP.fn.fnChildWindowClose) { oAPP.fn.fnChildWindowClose(); } } catch (e) { }
            oAPP.common.fnShowFloatingFooterMsg("S", sCurrPage, _msgWs("020")); // Switch to edit mode
            _uspRefreshAfterMode();
            try { if (parent.UAI && parent.UAI.disconnect) { parent.UAI.disconnect({ CONID: parent.getBrowserKey() }); } } catch (e) { }
            _uspInitLayout();   // 트리접기 + 최상위 루트 자동 선택(busy 는 루트 선택 콜백이 해제)
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
        try { if (e && e.stopImmediatePropagation) { e.stopImmediatePropagation(); } } catch (x) { }
        try { if (e && e.preventDefault) { e.preventDefault(); } } catch (x) { }
        if (e && e.repeat === true) { return; }                                  // 꾹 누름 중복 방지(필수)
        try { if (parent.getCurrPage && parent.getCurrPage() !== "WS30") { return; } } catch (x) { } // WS30 에서만
        try { if (parent.getBusy && parent.getBusy() === "X") { return; } } catch (x) { }            // busy 중엔 무시
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
            "Ctrl+F3": function (e) { _scGuard(e, _uspActivate); }   // 액티브
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
        BAR.appendChild(_txBtn({ id: "ws30_displayModeBtn", fa: "display", tooltip: sDispChg, evFn: _uspToggleMode }));
        // Change 모드 버튼 (Display 모드 + 개발/관리 권한에서 노출).
        BAR.appendChild(_txBtn({ id: "ws30_changeModeBtn", fa: "pen-to-square", tooltip: sDispChg, evFn: _uspToggleMode }));

        BAR.appendChild(_sep("ws30_sepEdit"));

        // Activate (Change 모드) — WS20 와 동일 마법사 아이콘. 단축키 Ctrl+F3 와 동일 핸들러.
        BAR.appendChild(_txBtn({ id: "ws30_activateBtn", fa: "wand-magic-sparkles", tooltip: _msg("B73") + " (Ctrl+F3)", evFn: _uspActivate }));
        // Save (Change 모드 + 개발 권한) — 단축키 Ctrl+S 와 동일 핸들러.
        BAR.appendChild(_txBtn({ id: "ws30_saveBtn", fa: "floppy-disk", tooltip: _msg("A64") + " (Ctrl+S)", evFn: _uspSave }));

        BAR.appendChild(_sep());

        // MIME Repository — 원본 oAPP.events.ev_pressMimeBtn (가드)
        BAR.appendChild(_txBtn({ id: "ws30_MimeBtn", fa: "image", text: _msg("A10"),
            tooltip: _msg("A10") + " (Ctrl+Shift+F12)", ev: "ev_pressMimeBtn" }));
        // Controller (Class Builder) — WS20 와 동일 아이콘(screwdriver-wrench). 원본 ev_pressControllerBtn (가드)
        BAR.appendChild(_txBtn({ id: "ws30_controllerBtn", fa: "screwdriver-wrench", text: _msg("A11"),
            tooltip: _msg("C38") + " (Ctrl+F12)", ev: "ev_pressControllerBtn" }));
        // Application Execution — 원본 ev_AppExec (가드)
        BAR.appendChild(_txBtn({ id: "ws30_appExecBtn", fa: "globe", text: _msg("A06"),
            tooltip: _msg("A06") + " (F8)", ev: "ev_AppExec" }));

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

        var PANEL = document.createElement("section");
        PANEL.id = "uspPanel";
        PANEL.className = "u4aWs30Panel";

        // 헤더(접힘/펼침) — 원본 sap.m.Panel(expandable)
        var HEAD = document.createElement("button");
        HEAD.type = "button";
        HEAD.className = "u4aWs30PanelHead";
        HEAD.setAttribute("aria-expanded", "true");
        HEAD.innerHTML = '<span class="u4aWs30PanelTwisty">' + _fa("chevron-down") + "</span>"
            + '<span class="u4aWs30PanelTitle">' + _esc(_msg("C17")) + "</span>"; // Properties
        HEAD.addEventListener("click", function () {
            var bOpen = PANEL.getAttribute("data-collapsed") !== "X";
            PANEL.setAttribute("data-collapsed", bOpen ? "X" : "");
            HEAD.setAttribute("aria-expanded", bOpen ? "false" : "true");
            HEAD.querySelector(".u4aWs30PanelTwisty").innerHTML = bOpen ? _fa("chevron-right") : _fa("chevron-down");
        });
        PANEL.appendChild(HEAD);

        var BODY = document.createElement("div");
        BODY.className = "u4aWs30PanelBody u4aWs30Form";

        // URL (readonly) + Copy
        BODY.appendChild(_formRow(_msg("C18"), (function () {
            var WRAP = document.createElement("div");
            WRAP.className = "u4aWs30UrlRow";
            var I = document.createElement("input");
            I.type = "text"; I.id = "uspPropUrl"; I.readOnly = true;
            I.className = "u4a-input u4aWs30Input";
            WRAP.appendChild(I);
            var B = document.createElement("button");
            B.type = "button"; B.className = "u4a-btn u4aWs30UrlCopyBtn";
            B.textContent = _msg("C21"); // URL Copy
            B.addEventListener("click", function () { _uspUrlCopy(I.value); });
            WRAP.appendChild(B);
            return WRAP;
        })()));

        // Is Folder? (readonly checkbox)
        BODY.appendChild(_formRow(_msg("C19"), (function () {
            var C = document.createElement("input");
            C.type = "checkbox"; C.id = "uspPropIsFld"; C.disabled = true;
            C.className = "u4aWs30Check";
            return C;
        })()));

        // Description (Change 모드에서 편집 — 원본 oDescInput editable {/WS30/APP/IS_EDIT})
        BODY.appendChild(_formRow(_msg("A35"), (function () {
            var I = document.createElement("input");
            I.type = "text"; I.id = "uspPropDesc";
            I.className = "u4a-input u4aWs30Input";
            I.addEventListener("change", function () { _onUspFieldChange("DESCT", I.value); });
            return I;
        })()));

        // Charset (폴더면 숨김 — Change 모드에서 편집, 원본 oCharsetInput editable)
        var oCharRow = _formRow(_msg("C20"), (function () {
            var I = document.createElement("input");
            I.type = "text"; I.id = "uspPropCodpg";
            I.className = "u4a-input u4aWs30Input";
            I.addEventListener("change", function () { _onUspFieldChange("CODPG", I.value); });
            return I;
        })());
        oCharRow.id = "uspPropCharsetRow";
        BODY.appendChild(oCharRow);

        PANEL.appendChild(BODY);
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

    function _uspUrlCopy(sUrl) {
        try {
            if (parent.REMOTE && parent.REMOTE.clipboard) { parent.REMOTE.clipboard.writeText(sUrl || ""); }
            else if (navigator.clipboard) { navigator.clipboard.writeText(sUrl || ""); }
            oAPP.common.fnShowFloatingFooterMsg("S", "WS30", _msg("C21"));
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
            var I = document.createElement("input");
            I.type = "text";
            I.readOnly = true;   // 실제 readOnly 는 fnRenderUspDoc 가 모드에 따라 토글(편집필드만)
            I.className = "u4a-input u4aWs30Input";
            I.setAttribute("data-doc", sField);
            if (bEditable) {
                I.setAttribute("data-doc-edit", "X");
                I.addEventListener("change", function () { _onUspFieldChange(sField, I.value); });
            }
            FORM.appendChild(_formRow(_msg(f[0]), I));
        });
        PAGE.appendChild(FORM);
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
            // 편집 가능 필드만 Change 모드에서 readOnly 해제
            if (bEditable) { el.readOnly = !bEdit; }
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
     * (F) 푸터 (구 floatingFooter /FMSG/WS30) — WS20 와 동일 컴포넌트(.u4aWs10__footer 재사용).
     ************************************************************************/
    //  WS10 푸터 컴포넌트(.u4a-ws10__footer, data-show/data-type)와 동일 마크업 → ws10.css 재사용.
    function _buildUspFooter() {
        var F = document.createElement("div");
        F.id = "ws30Footer";
        F.className = "u4a-ws10__footer";
        F.setAttribute("data-show", "false");
        F.innerHTML =
            '<span class="u4a-ws10__footer-icon"></span>' +
            '<span class="u4a-ws10__footer-text"></span>';
        return F;
    }

    var FOOTER_ICON = { S: "circle-check", E: "circle-exclamation", W: "triangle-exclamation", I: "circle-info" };
    oAPP.usphtml.showFooter = function (sType, sMsg) {
        var F = document.getElementById("ws30Footer");
        if (!F) { return; }
        F.dataset.type = sType || "I";
        F.dataset.show = "true";
        var elI = F.querySelector(".u4a-ws10__footer-icon");
        var elM = F.querySelector(".u4a-ws10__footer-text");
        if (elI) { elI.innerHTML = _fa(FOOTER_ICON[sType] || "circle-info"); }
        if (elM) { elM.textContent = sMsg || ""; }
    };
    oAPP.usphtml.hideFooter = function () {
        var F = document.getElementById("ws30Footer");
        if (F) { F.dataset.show = "false"; }
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
        THEAD.appendChild(_treeTbBtn("angles-down", "Expand All", function () { if (oAPP.fn.fnUspTreeExpandAll) { oAPP.fn.fnUspTreeExpandAll(); } }));
        THEAD.appendChild(_treeTbBtn("angles-up", "Collapse All", function () { if (oAPP.fn.fnUspTreeCollapseAll) { oAPP.fn.fnUspTreeCollapseAll(); } }));
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
