/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnP13nDesignPopupOpen.js
 * - file Desc : WS20 디자인영역 컨텍스트 메뉴 "내 패턴 / My Pattern"(M11) —
 *               UI 개인화(UI Personalization) 저장·조회 팝업 (HTML5)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본(UI5): design/js/callP13nDesignDataPopup.js 가 sap.m.Dialog +
 *        sap.ui.layout.Splitter + sap.ui.table.Table/TreeTable + NavContainer 로
 *        UI 개인화 팝업을 구성했다. 진입:
 *          · 컨텍스트 메뉴 M11(내 패턴) → contextMenuP13nDesignPopup() → callP13nDesignDataPopup("C", node)
 *          · 좌측 툴바 E28(개인화 리스트) → callP13nDesignDataPopup("R")
 *        두 진입 모두 UI5(uiDesignArea/callDesignContextMenu)라 HTML5 런타임엔 미로드 →
 *        지금까지 M11 은 무동작(_ctxDelegate 대상 fn 부재). 본 파일이 그 두 함수를 HTML5 로 제공한다.
 *
 *  HTML5: 인앱 native <dialog class="u4a-dialog"> + 공통 컴포넌트
 *        (U4AUI.createTree / createField / createSelect / confirm ·
 *         .u4a-table · .u4a-splitter · makeDialogRecenter/Resizable · 전역 헤더드래그/닫기DOM제거).
 *        fnBindPopupOpen / prevSetSkeletonScreen 과 동일 컨벤션.
 *        ★ 공통 파일(shell.css/u4a-ui.js) 미수정 — 화면 스코프(.u4aP13n*) 주입 스타일만.
 *
 *  ★ 미리보기(KEEP-UI5): 원본과 동일하게 미리보기는 서버 렌더(getP13nPreviewHTML)한 UI5 를
 *        iframe 으로 유지한다(05 §B-2 / 00 §6 — 미리보기 iframe 은 UI5 유지). 부트 헬퍼
 *        (getBootStrapUrl/getUi5Libraries)·getUiClientEvent 는 UI5 전용이라 HTML5 미로드일 수
 *        있어 typeof 가드로 우아하게 degrade(없으면 미리보기 안내문구, 나머지 기능은 정상).
 *
 *  ★ 보존 로직(원본 1:1): 개인화 파일 I/O(userData/p13n/U4A_UI_PATTERN/{SYSID}/header.json +
 *        패턴별 json), proper-lockfile 잠금, 라이브러리 버전 호환 점검(381), 저장/삭제/편집/새로고침,
 *        테마 콤보(iframe UI5 applyTheme), 디자인트리→팝업 drop 으로 패턴 생성.
 *  ★ 메시지: 전부 기존 키 소비(신규 문구 없음).
 *        E24 UI Personalization · E25 Preview · E27 Choose Theme · E29 Personalization ·
 *        E30 Back · A03 Delete · A05 Display · A35 Description · A39 Close · A46/A47 Expand/Collapse ·
 *        A48 Refresh · A64 Save · B38 Edit · A84 UI Object ID / MSG_WS 002/015/018/196/379/380/381/382 등.
 *  ★ 남은 항목: "저장된 패턴을 디자인 트리에 드래그해 적용"(P13nUIData drop 수신)은 아직 UI5
 *        (uiDesignArea.js drop_cb)만 존재하고, 인앱 모달 백드롭과 충돌하므로 이번 범위 밖.
 *        (본 팝업은 드래그 소스 dataTransfer 만 원본대로 세팅 — 수신부 HTML5 화 시 즉시 연동.)
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    // 개인화 폴더/파일 상수(원본 동일).
    var C_P13N = "p13n";
    var C_FOLDER = "U4A_UI_PATTERN";
    var C_HEADER_FILE = "header.json";
    var C_DLG_ID = "u4aP13nDlg";

    // ── 로컬 헬퍼(다른 WS20 팝업과 동일 컨벤션) ────────────────────────────
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined" && sText !== null) { o.textContent = sText; }
        return o;
    }
    // /U4A/CL_WS_COMMON 메시지.
    function _cl(sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    // /U4A/MSG_WS 메시지.
    function _mw(sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    // ZMSG_WS_COMMON_001 (언어 라우팅 — 원본 parent.WSUTIL.getWsMsgClsTxt).
    function _zc(sCode, p1, p2, p3) {
        try {
            var lang = "";
            try { lang = (oAPP.oDesign && oAPP.oDesign.settings && oAPP.oDesign.settings.GLANGU) || ""; } catch (e) { }
            return parent.WSUTIL.getWsMsgClsTxt(lang, "ZMSG_WS_COMMON_001", sCode, p1 || "", p2 || "", p3 || "");
        } catch (e) { return ""; }
    }
    // 메시지 팝업(원본 parent.showMessage).
    function _msg(iKind, sType, sMsg, fnCb) {
        try { parent.showMessage(window.sap || null, iKind, sType, sMsg, fnCb); }
        catch (e) { console.warn("[HTML5][WS20][p13n] showMessage 실패:", e && e.message); }
    }
    function _busy(bOn) { try { parent.setBusy && parent.setBusy(bOn ? "X" : ""); } catch (e) { } }
    function _unlock() { try { oAPP.fn.setShortcutLock(false); } catch (e) { } }
    function _lock() { try { oAPP.fn.setShortcutLock(true); } catch (e) { } }
    function _esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

    // aggregation cardinality 아이콘: sap-icon:// → FontAwesome 클래스(원본/WS20 트리와 동일).
    //   ★ sap-icon://* 는 <img src> 로 쓰면 ERR_UNKNOWN_URL_SCHEME → 반드시 FA 폰트 클래스로 매핑.
    var _AGGR_ICON = {
        "sap-icon://color-fill": "fa-regular fa-square",   // 0:1 단일
        "sap-icon://dimension": "fa-regular fa-clone"      // 0:N 다중
    };
    function _aggrIconClass(s) { return (s && _AGGR_ICON[s]) || ""; }
    // UI 아이콘(UICON) src 정규화 — WS20 트리와 동일(.gif OS경로 → file:// URL). sap-icon:// 등은 제외(빈값).
    function _uiconSrc(p) {
        if (!p || /^sap-icon:/i.test(p)) { return ""; }
        return /^(file:|https?:|data:|\/)/i.test(p) ? p : ("file:///" + String(p).replace(/\\/g, "/"));
    }

    // ── 모듈 상태 ─────────────────────────────────────────────────────────
    var oUI = null;   // 다이얼로그/DOM 참조(1회 build 후 재사용, 닫으면 공통이 DOM 제거)
    var oS = {};      // 세션: mode/is_tree/HTML/frameID/theme/bootPath/T_THEME/lock/lockFile/
    //         T_HEAD/is_head/zTREE/selFileName/frameLoaded

    function _resetSession() {
        oS = {
            mode: "", is_tree: null, HTML: "", frameID: "", theme: "", bootPath: "",
            T_THEME: [], lock: false, lockFile: null, T_HEAD: [], is_head: null,
            zTREE: [], selFileName: "", frameLoaded: false, fullSize: false
        };
    }

    function _sysid() { try { return parent.getUserInfo().SYSID; } catch (e) { return ""; } }

    // 개인화 폴더/헤더 파일 경로(userData 기준).
    function _userP13nPath() { return parent.PATH.join(parent.REMOTE.app.getPath("userData"), C_P13N, C_FOLDER); }
    function _userSysPath() { return parent.PATH.join(_userP13nPath(), _sysid()); }
    function _userHeaderPath() { return parent.PATH.join(_userSysPath(), C_HEADER_FILE); }
    function _userItemPath(sFile) { return parent.PATH.join(_userSysPath(), sFile); }
    // proper-lockfile 은 P13N_ROOT(getPath) 기준(원본 동일).
    function _lockHeaderPath() { return parent.PATH.join(parent.getPath("P13N_ROOT"), C_FOLDER, _sysid(), C_HEADER_FILE); }
    function _lockItemPath(sFile) { return parent.PATH.join(parent.getPath("P13N_ROOT"), C_FOLDER, _sysid(), sFile); }


    /* ====================================================================
     * 1. 초기값 / 폴더 / 잠금 (원본 lf_setInitData/lf_createDefaultFolder/lf_headerLock)
     * ==================================================================== */

    function lf_setInitData(sMode) {
        oS.mode = sMode;

        try { oS.lockFile = parent.require("proper-lockfile"); } catch (e) { oS.lockFile = null; }

        // bootstrap url(미리보기용) — UI5 전용 헬퍼(HTML5 미로드일 수 있음).
        oS.bootPath = "";
        try { if (typeof oAPP.fn.getBootStrapUrl === "function") { oS.bootPath = oAPP.fn.getBootStrapUrl() || ""; } } catch (e) { }

        // default 테마 — ROOT 의 DH001021(theme) 프로퍼티 → 없으면 공통코드 UA007 기본.
        oS.theme = "";
        try {
            var aRoot15 = oAPP.attr.prev && oAPP.attr.prev.ROOT && oAPP.attr.prev.ROOT._T_0015;
            if (aRoot15) {
                var l = aRoot15.find(function (a) { return a.UIATK === "DH001021"; });
                if (l) { oS.theme = l.UIATV || ""; }
            }
        } catch (e) { }

        var aUA007 = [];
        try { aUA007 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA007) || []; } catch (e) { aUA007 = []; }

        var bWLO = false;
        try { bWLO = (typeof oAPP.common.checkWLOList === "function") && oAPP.common.checkWLOList("C", "UHAK900889") === true; } catch (e) { bWLO = false; }

        if (oS.theme === "") {
            var lsDef = aUA007.find(function (i) { return i.FLD02 === "X"; });
            if (bWLO) { lsDef = aUA007.find(function (i) { return i.FLD02 === "X" && i.FLD03 === "X"; }); }
            oS.theme = (lsDef && lsDef.FLD01) || "";
        }

        // 테마 콤보 목록.
        var aTheme = bWLO ? aUA007.filter(function (i) { return i.FLD03 === "X"; }) : aUA007;
        oS.T_THEME = aTheme.map(function (i) { return { value: i.FLD01, text: i.FLD01 }; });
    }

    // 개인화 default 폴더/헤더 파일 생성(원본 lf_createDefaultFolder). 실패 시 true.
    function lf_createDefaultFolder() {
        try {
            var l1 = _userP13nPath();
            if (!parent.FS.existsSync(l1)) { parent.FS.mkdirSync(l1); }
            var l2 = _userSysPath();
            if (!parent.FS.existsSync(l2)) { parent.FS.mkdirSync(l2); }
            var l3 = _userHeaderPath();
            if (!parent.FS.existsSync(l3)) { parent.FS.writeFileSync(l3, JSON.stringify([])); }
        } catch (e) {
            _msg(10, "E", e && e.message ? e.message : e);
            return true;
        }
    }

    // header 파일 잠금/해제(원본 lf_headerLock). bUnlock=true → 해제.
    function lf_headerLock(bUnlock) {
        if (!oS.lockFile) { return; }
        var l_path = _lockHeaderPath();

        if (bUnlock) {
            if (oS.lock) { try { oS.lockFile.unlockSync(l_path); } catch (e) { } }
            return;
        }
        if (oS.lock) { return; }
        try {
            if (oS.lockFile.checkSync(l_path)) {
                // 382 Personalizing UI on other screens.
                _msg(10, "S", _mw("382"));
                return;
            }
        } catch (e) { }
        try {
            oS.lockFile.lockSync(l_path);
            oS.lock = true;
        } catch (e) { }
    }


    /* ====================================================================
     * 2. 헤더 리스트 / 아이템 파일 I/O (원본 lf_getP13nHeaderData/lf_getItemData/lf_getFileName)
     * ==================================================================== */

    function lf_getP13nHeaderData() {
        var l_path = _userHeaderPath();
        var l_notExist = _mw("196", _cl("E29"));   // E29 Personalization / 196 &1 does not exist.

        if (parent.FS.existsSync(l_path) !== true) { _msg(10, "I", l_notExist); return []; }

        var l_file;
        try { l_file = parent.FS.readFileSync(l_path, "utf-8"); } catch (e) { l_file = ""; }
        if (!l_file) { _msg(10, "I", l_notExist); return []; }

        var lt_head;
        try { lt_head = JSON.parse(l_file); } catch (e) { lt_head = []; }

        // 세팅정보(라이브러리 버전).
        var ls_setting = {};
        try { ls_setting = parent.WSUTIL.getWsSettingsInfo() || {}; } catch (e) { ls_setting = {}; }
        var sVer = (ls_setting.UI5 && ls_setting.UI5.version) || "";

        // 현재 화면 lock 획득 시도(리스트 진입 시 편집 가능하게).
        lf_headerLock();

        var l_incompat = _mw("381");   // 381 Library version is not compatible.

        for (var i = 0; i < lt_head.length; i++) {
            var h = lt_head[i];
            h.tooltip = h.title;
            h.notAllow = false;
            h.visible_edit = false;
            h.visible_delete = false;

            if (oS.lock) { h.visible_edit = true; h.visible_delete = true; }

            if (h.LibraryVersion !== sVer) {
                h.notAllow = true;
                h.visible_edit = false;
                h.tooltip = (h.title || "") + "\n\n 🚫" + l_incompat + "🚫";
            }
        }
        return lt_head;
    }

    function lf_getItemData(is_head) {
        var l_path = _userItemPath(is_head.fileName);
        if (parent.FS.existsSync(l_path) !== true) {
            _msg(10, "E", _mw("196", _cl("E29")));
            return null;
        }
        var l_file;
        try { l_file = parent.FS.readFileSync(l_path, "utf-8"); } catch (e) { l_file = ""; }
        if (!l_file) { _msg(10, "E", _mw("018")); return null; }
        try { return JSON.parse(l_file); } catch (e) { return null; }
    }

    // 랜덤 파일명 구성(중복 회피 — 원본 lf_getFileName).
    function lf_getFileName(it_head) {
        var l_fname = "";
        while (l_fname === "") {
            var l_temp = oAPP.fn.getRandomKey() + ".json";
            if (it_head.findIndex(function (a) { return a.fileName === l_temp; }) === -1) {
                l_fname = l_temp;
                if (parent.FS.existsSync(_userItemPath(l_fname))) { l_fname = ""; }
            }
        }
        return l_fname;
    }


    /* ====================================================================
     * 3. 미리보기용 UI HTML 직렬화 + 저장 트리 수집 (원본 lf_getUiHTML/lf_collectSaveData)
     * ==================================================================== */

    // 선택 UI 의 미리보기 DOM 직렬화(원본 lf_getUiHTML). 스탠드인(getDomRef 없음)이면 HTML 비움.
    function lf_getUiHTML(is_tree) {
        oS.HTML = "";
        try {
            var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_tree.OBJID];
            if (!oPrev || typeof oPrev.getDomRef !== "function") { return; }
            var l_dom = oPrev.getDomRef();
            if (!l_dom) { return; }

            var l_tempCSS;
            // 팝업 유형 UI 는 innerHTML 스타일 보정(원본 동일 — 중앙배치 top/left 회피).
            try {
                var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIOBK === is_tree.UIOBK; });
                var aUA026 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA026) || [];
                if (ls_0022 && aUA026.findIndex(function (a) { return a.FLD01 === ls_0022.LIBNM && a.FLD02 !== "X"; }) !== -1) {
                    l_tempCSS = l_dom.style.cssText;
                    l_dom.style.cssText = "width:100%; height:100%;";
                }
            } catch (e) { }

            oS.HTML = new XMLSerializer().serializeToString(l_dom);

            if (l_tempCSS) { l_dom.style.cssText = l_tempCSS; }
        } catch (e) {
            console.error("[HTML5][WS20][p13n] lf_getUiHTML 오류:", e && e.message);
        }
    }

    // 저장 대상 트리 수집(원본 lf_collectSaveData) — 14번 구조 + _T_0015/_CEVT/_DESC + 하위 재귀.
    function lf_collectSaveData(is_tree) {
        var ls_0014 = oAPP.fn.crtStru0014();
        oAPP.fn.moveCorresponding(is_tree, ls_0014);

        // UICON = 파일명만(확장자 제거).
        try {
            ls_0014.UICON = parent.PATH.basename(is_tree.UICON || "").replace(".gif", "");
        } catch (e) { ls_0014.UICON = ""; }

        ls_0014.UIATT_ICON = is_tree.UIATT_ICON;

        // DESC.
        try {
            var l_desc = (typeof oAPP.fn.getDesc === "function") ? oAPP.fn.getDesc(is_tree.OBJID) : "";
            if (l_desc !== "" && l_desc != null) { ls_0014._DESC = l_desc; }
        } catch (e) { }

        ls_0014.zTREE = [];

        // 실제 라이브러리명 재매핑.
        try {
            var ls_0022 = oAPP.DATA.LIB.T_0022.find(function (a) { return a.UIOBK === ls_0014.UIOBK; });
            if (ls_0022) { ls_0014.UILIB = ls_0022.LIBNM; }
        } catch (e) { }

        // 바인딩/이벤트 항목 제외한 프로퍼티만.
        try {
            var oPrev = oAPP.attr.prev && oAPP.attr.prev[is_tree.OBJID];
            var a15 = (oPrev && oPrev._T_0015) || [];
            ls_0014._T_0015 = a15.filter(function (a) { return a.ISBND !== "X" && a.UIATY !== "2"; });
        } catch (e) { ls_0014._T_0015 = []; }

        // CLIENT EVENT(UI5 전용 헬퍼 — 가드).
        try {
            if (typeof oAPP.fn.getUiClientEvent === "function") {
                var lt_CEVT = oAPP.fn.getUiClientEvent(is_tree);
                if (typeof lt_CEVT !== "undefined") {
                    ls_0014._CEVT = lt_CEVT.filter(function (a) { return a.OBJTY !== "JS"; });
                }
            }
        } catch (e) { }

        var aCh = is_tree.zTREE || [];
        for (var i = 0; i < aCh.length; i++) { ls_0014.zTREE.push(lf_collectSaveData(aCh[i])); }

        return ls_0014;
    }


    /* ====================================================================
     * 4. 저장 / 삭제 (원본 lf_saveP13nData/lf_saveItemData/lf_setHeaderLineDelete)
     * ==================================================================== */

    function lf_saveItemData(is_head) {
        var ls_item = {};
        ls_item.is_tree = lf_collectSaveData(oS.zTREE[0]);
        ls_item.HTML = oS.HTML;
        try {
            parent.FS.writeFileSync(_userItemPath(is_head.fileName), JSON.stringify(ls_item));
        } catch (e) {
            _msg(10, "E", e && e.message ? e.message : e);
        }
    }

    function lf_saveP13nData() {
        _busy(true);

        var l_folder = _userSysPath();
        if (!parent.FS.existsSync(l_folder)) {
            try { parent.FS.mkdirSync(l_folder); } catch (e) { _msg(10, "E", e && e.message ? e.message : e); _busy(false); return; }
        }

        var l_filePath = _userHeaderPath();
        var lt_head = [];
        if (parent.FS.existsSync(l_filePath)) {
            try { lt_head = JSON.parse(parent.FS.readFileSync(l_filePath, "utf-8")); } catch (e) { lt_head = []; }
            try { parent.FS.unlinkSync(l_filePath); } catch (e) { _msg(10, "E", e && e.message ? e.message : e); _busy(false); return; }
        }

        var ls_head = {};
        var sTitle = (oUI.descInput && oUI.descInput.getValue) ? oUI.descInput.getValue() : (oS.is_head ? oS.is_head.title : "");

        if (!oS.is_head || oS.is_head.isNew === true) {
            // 신규.
            ls_head.title = sTitle;
            ls_head.fileName = lf_getFileName(lt_head);
            ls_head.THEME = oS.theme;
            ls_head.UIOBK = oS.zTREE[0].UIOBK;
            ls_head.UILIB = oS.zTREE[0].UILIB;
            ls_head.bootPath = oS.bootPath;

            var ls_setting = {};
            try { ls_setting = parent.WSUTIL.getWsSettingsInfo() || {}; } catch (e) { }
            ls_head.LibraryVersion = (ls_setting.UI5 && ls_setting.UI5.version) || "";

            lt_head.splice(0, 0, ls_head);
            lf_saveItemData(ls_head);
        } else {
            // 수정.
            var l_indx = lt_head.findIndex(function (a) { return a.fileName === oS.is_head.fileName; });
            if (l_indx === -1) { lt_head.splice(0, 0, ls_head); } else { ls_head = lt_head[l_indx]; }
            ls_head.title = sTitle;
            ls_head.fileName = oS.is_head.fileName;
            ls_head.THEME = oS.theme;
            ls_head.UIOBK = oS.is_head.UIOBK;
            ls_head.UILIB = oS.is_head.UILIB;
            ls_head.bootPath = oS.is_head.bootPath;
            ls_head.LibraryVersion = oS.is_head.LibraryVersion;
        }

        try {
            parent.FS.writeFileSync(l_filePath, JSON.stringify(lt_head));
        } catch (e) {
            _msg(20, "E", e && e.message ? e.message : e); _busy(false); return;
        }

        // 저장 후 조회모드 재구성.
        oS.mode = "R";
        lf_setModelData("R");
        lf_setHeadLineSelect(ls_head.fileName);

        _busy(false);
        // 002 Saved success.
        _msg(10, "S", _mw("002"));
    }

    function lf_setHeaderLineDelete(sFileName) {
        // 379 Delete selected rows?
        U4AUI.confirm({
            type: "C",
            title: _cl("A03"),
            message: _mw("379"),
            onClose: function (act) {
                if (act !== "YES") { return; }

                _busy(true);

                var l_folder = _userSysPath();
                if (!parent.FS.existsSync(l_folder)) {
                    try { parent.FS.mkdirSync(l_folder); } catch (e) { _msg(10, "E", e && e.message ? e.message : e); _busy(false); return; }
                }

                var l_filePath = _userHeaderPath();
                var lt_head = [];
                if (parent.FS.existsSync(l_filePath)) {
                    try { lt_head = JSON.parse(parent.FS.readFileSync(l_filePath, "utf-8")); } catch (e) { lt_head = []; }
                    try { parent.FS.unlinkSync(l_filePath); } catch (e) { _msg(10, "E", e && e.message ? e.message : e); _busy(false); return; }
                }

                var l_indx = lt_head.findIndex(function (a) { return a.fileName === sFileName; });
                if (l_indx !== -1) {
                    try { parent.FS.unlinkSync(_userItemPath(sFileName)); } catch (e) { }
                    lt_head.splice(l_indx, 1);
                }

                try {
                    parent.FS.writeFileSync(l_filePath, JSON.stringify(lt_head));
                } catch (e) { _msg(20, "E", e && e.message ? e.message : e); _busy(false); return; }

                oS.mode = "R";
                oS.HTML = "";
                lf_setPrevHTML();
                lf_setModelData("R");
                lf_setHeadLineSelect();
                lf_showRight(false);

                _busy(false);
                // 015 Removed.
                _msg(10, "S", _mw("015"));
            }
        });
    }


    /* ====================================================================
     * 5. 미리보기 iframe (KEEP-UI5, 원본 lf_loadP13nPrevHTML/lf_setP13nPrevHTML)
     * ==================================================================== */

    function lf_setParam(oForm, name, value) {
        var iput = document.createElement("input");
        iput.setAttribute("name", name);
        iput.setAttribute("value", value == null ? "" : value);
        iput.setAttribute("type", "hidden");
        oForm.appendChild(iput);
    }

    // 미리보기 HTML 주입(원본 lf_setP13nPrevHTML).
    function lf_setPrevHTML(sHTML) {
        sHTML = sHTML || "";
        var l_frame = document.getElementById(oS.frameID);
        if (!l_frame || !l_frame.contentDocument) { return; }

        // extension 아이콘 등록(가드 — contentWindow UI5 준비된 경우만).
        try { lf_setPrevExtIcon(l_frame.contentWindow); } catch (e) { }

        var l_prev = l_frame.contentDocument.getElementById("prev");
        if (!l_prev) {
            l_prev = l_frame.contentDocument.createElement("div");
            l_prev.id = "prev";
            l_prev.style.width = "100%";
            l_prev.style.height = "100%";
            if (l_frame.contentDocument.body) { l_frame.contentDocument.body.appendChild(l_prev); }
        }
        l_prev.innerHTML = sHTML;
    }

    function lf_setPrevExtIcon(oWin) {
        if (!oWin || !oWin.sap || !oWin.jQuery) { return; }
        oWin.jQuery.sap.require("sap.ui.core.IconPool");
        oWin.jQuery.sap.require("sap.m.IllustrationPool");

        oWin.sap.ui.core.IconPool.registerFont({
            collectionName: "SAP-icons-TNT", fontFamily: "SAP-icons-TNT",
            fontURI: sap.ui.require.toUrl("sap/tnt/themes/base/fonts"), lazy: true
        });
        oWin.sap.ui.core.IconPool.registerFont({
            collectionName: "BusinessSuiteInAppSymbols", fontFamily: "BusinessSuiteInAppSymbols",
            fontURI: sap.ui.require.toUrl("sap/ushell/themes/base/fonts"), lazy: true
        });
        oWin.sap.m.IllustrationPool.registerIllustrationSet({
            setFamily: "tnt", setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
        }, false);

        var aUA053 = (oAPP.attr.S_CODE && oAPP.attr.S_CODE.UA053) || [];
        for (var i = 0; i < aUA053.length; i++) {
            oWin.sap.ui.core.IconPool.registerFont({
                collectionName: aUA053[i].FLD01, fontFamily: aUA053[i].FLD02, fontURI: aUA053[i].FLD03, lazy: true
            });
        }
    }

    // 미리보기 iframe 서버 렌더 로드(원본 lf_loadP13nPrevHTML). 부트 헬퍼 없으면 degrade.
    function lf_loadPrevHTML() {
        var l_dom = document.getElementById(oS.frameID);
        if (!l_dom) { return; }

        // UI5 부트 헬퍼 부재(HTML5) → 미리보기 안내 후 종료(나머지 기능 정상).
        if (typeof oAPP.fn.getBootStrapUrl !== "function" || typeof oAPP.fn.getUi5Libraries !== "function") {
            lf_showPrevFallback();
            _busy(false);
            return;
        }

        var l_info;
        try { l_info = parent.getUserInfo(); } catch (e) { l_info = {}; }

        var sHost = "";
        try { sHost = parent.getHost(); } catch (e) { }

        var oForm = document.createElement("form");
        oForm.setAttribute("id", "u4aP13nPrvForm");
        oForm.setAttribute("target", l_dom.id);
        oForm.setAttribute("method", "POST");
        oForm.setAttribute("action", sHost + "/zu4a_wbc/u4a_ipcmain/getP13nPreviewHTML");
        oForm.style.display = "none";

        lf_setParam(oForm, "sap-client", l_info.CLIENT);
        lf_setParam(oForm, "sap-language", l_info.LANGU);
        lf_setParam(oForm, "sap-user", l_info.ID);
        lf_setParam(oForm, "sap-password", l_info.PW);
        lf_setParam(oForm, "LIBPATH", oS.bootPath);
        try { lf_setParam(oForm, "LIBRARY", oAPP.fn.getUi5Libraries(true)); } catch (e) { lf_setParam(oForm, "LIBRARY", ""); }
        lf_setParam(oForm, "THEME", oS.theme);
        lf_setParam(oForm, "LANGU", l_info.LANGU);
        lf_setParam(oForm, "CALLBACKFUNC", "parent.oAPP.fn.P13nPrevLoaded();");

        document.body.appendChild(oForm);
        oForm.submit();
        setTimeout(function () { try { document.body.removeChild(oForm); } catch (e) { } }, 0);
    }

    // 부트 헬퍼 부재 시 미리보기 영역 안내(HTML5 degrade).
    function lf_showPrevFallback() {
        var l_frame = document.getElementById(oS.frameID);
        if (!l_frame || !l_frame.contentDocument || !l_frame.contentDocument.body) { return; }
        var oDoc = l_frame.contentDocument;
        oDoc.body.style.margin = "0";
        oDoc.body.innerHTML =
            '<div style="display:flex;height:100%;align-items:center;justify-content:center;' +
            'font:13px/1.5 sans-serif;color:#8a8f99;text-align:center;padding:12px;">' +
            _esc(_cl("E25")) + '</div>';
    }

    // 미리보기 load 완료 콜백(iframe → parent). 원본 P13nPrevLoaded.
    oAPP.fn.P13nPrevLoaded = function () {
        lf_setPrevHTML(oS.HTML);
        _busy(false);
    };

    // 테마 변경(iframe UI5 applyTheme). 원본 P13nChangeTheme.
    oAPP.fn.P13nChangeTheme = function (sTheme) {
        var l_frame = document.getElementById(oS.frameID);
        if (!l_frame || !l_frame.contentWindow || !l_frame.contentWindow.sap) { return; }
        try { l_frame.contentWindow.sap.ui.getCore().applyTheme(sTheme); } catch (e) { }
    };


    /* ====================================================================
     * 6. 다이얼로그 셸 빌드 (공통 .u4a-dialog + 스플리터)
     * ==================================================================== */

    function lf_build() {
        lf_ensureStyle();
        oUI = {};

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aP13nDlg";

        // ── 헤더(48px): 아이콘 + 제목 + 전체화면 토글 + 닫기 X ──
        var oHeader = _el("div", "u4a-dialog__header u4aP13nHead");
        oHeader.innerHTML = _fa("user-gear") + "<span></span>";
        oUI.titleTxt = oHeader.querySelector("span");

        oUI.btnFull = _el("button", "u4a-btn-icon");
        oUI.btnFull.type = "button";
        oUI.btnFull.innerHTML = _fa("expand");
        oUI.btnFull.title = _cl("A05");   // (전체화면 토글)
        oUI.btnFull.addEventListener("click", function () { lf_toggleFull(); });
        oHeader.appendChild(oUI.btnFull);

        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _cl("A39");
        oXBtn.addEventListener("click", function () { lf_closeCancel(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 바디: 가로 스플리터 [좌(리스트/등록) | 우(미리보기+트리)] ──
        var oBody = _el("div", "u4a-dialog__body u4aP13nBody");

        // 좌측 패널 — 등록/리스트 페이지 토글.
        var oLeft = _el("div", "u4aP13nLeft");
        lf_buildRegPage(oLeft);
        lf_buildListPage(oLeft);
        oBody.appendChild(oLeft);
        oUI.left = oLeft;

        // 좌우 스플리터 바.
        oUI.barL = _el("div", "u4a-splitter__bar u4aP13nBarL");
        oUI.barL.setAttribute("role", "separator");
        oBody.appendChild(oUI.barL);

        // 우측 패널 — init(빈) / detail(미리보기+트리).
        var oRight = _el("div", "u4aP13nRight");
        lf_buildInitPage(oRight);
        lf_buildDetail(oRight);
        oBody.appendChild(oRight);
        oUI.right = oRight;

        oDlg.appendChild(oBody);
        oUI.body = oBody;

        // ── 푸터(48px): 닫기(negative X) ──
        var oFoot = _el("div", "u4a-dialog__footer u4aP13nFoot");
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark");
        oCloseBtn.title = _cl("A39");
        oCloseBtn.addEventListener("click", function () { lf_closeCancel(); });
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closeCancel(); });

        // 스플리터 드래그(좌우 + 미리보기/트리) — §4.3: 인접 패널 min-width(px) 기준 클램프.
        lf_wireSplitters();

        // §4.3 리사이즈 재클램프 — 창 resize + 다이얼로그 grip/최대화(바디 크기 변화)를 모두 커버.
        //   px 고정된 패널만 손댐(%/flex 패널은 CSS 가 알아서 줄어듦). 클램프는 초과 시 1회 축소라 RO 루프 없음.
        window.removeEventListener("resize", lf_clampSplit);
        window.addEventListener("resize", lf_clampSplit);
        try { oUI.ro = new ResizeObserver(function () { lf_clampSplit(); }); oUI.ro.observe(oBody); } catch (e) { }

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 720, minH: 460 }); }

        document.body.appendChild(oDlg);
        oUI.dlg = oDlg;
        oUI.header = oHeader;
    }

    // 등록 페이지(원본 oRegPage) — 뒤로/저장/삭제 + Description.
    function lf_buildRegPage(oParent) {
        var oPage = _el("div", "u4aP13nRegPage");
        oPage.hidden = true;

        // 원본 oTool4 1:1 — [뒤로(아이콘)] [구분선] [저장(아이콘)] [삭제(아이콘)].
        //   좌측정렬·아이콘 전용. 삭제=원본 visible:{/is_head/visible_delete} — 신규 등록(컨텍스트
        //   메뉴 진입)에선 숨김, 리스트→기존건 편집일 때만 표시(.u4aP13nRegTool>[hidden] override 로 실숨김).
        var oTool = _el("div", "u4aP13nRegTool");
        oUI.btnBack = _el("button", "u4a-btn-icon u4aP13nRegBack");
        oUI.btnBack.type = "button";
        oUI.btnBack.innerHTML = _fa("chevron-left");
        oUI.btnBack.title = _cl("E30");   // E30 Back
        oUI.btnBack.addEventListener("click", function () { lf_back(); });
        oTool.appendChild(oUI.btnBack);

        oTool.appendChild(_el("span", "u4aP13nTbSep"));   // 원본 ToolbarSeparator.

        oUI.btnSave = _el("button", "u4a-btn u4a-btn--emphasized u4aP13nIcoBtn");
        oUI.btnSave.type = "button";
        oUI.btnSave.innerHTML = _fa("floppy-disk");
        oUI.btnSave.title = _cl("A64");   // A64 Save
        oUI.btnSave.addEventListener("click", function () { lf_saveP13nData(); });
        oTool.appendChild(oUI.btnSave);

        oUI.btnRegDel = _el("button", "u4a-btn u4a-btn--negative u4aP13nIcoBtn");
        oUI.btnRegDel.type = "button";
        oUI.btnRegDel.innerHTML = _fa("trash");
        oUI.btnRegDel.title = _cl("A03");   // A03 Delete
        oUI.btnRegDel.hidden = true;
        oUI.btnRegDel.addEventListener("click", function () {
            lf_setHeaderLineDelete(oS.is_head ? oS.is_head.fileName : "");
        });
        oTool.appendChild(oUI.btnRegDel);
        oPage.appendChild(oTool);

        // Description textarea(공통 createField).
        oUI.descInput = U4AUI.createField({
            type: "textarea",
            value: "",
            placeholder: _cl("A35"),   // A35 Description
            className: "u4aP13nDescField"
        });
        var oDescWrap = _el("div", "u4aP13nRegBody");
        oDescWrap.appendChild(oUI.descInput.el);
        oPage.appendChild(oDescWrap);

        oParent.appendChild(oPage);
        oUI.regPage = oPage;
    }

    // 리스트 페이지(원본 oHeadListPage) — 새로고침 툴바 + .u4a-table + 드래그 안내 푸터.
    function lf_buildListPage(oParent) {
        var oPage = _el("div", "u4aP13nListPage");
        oPage.hidden = true;

        // 원본 oTool3 1:1 — 갱신(Emphasized 아이콘) 하나뿐(제목 없음, 좌측정렬).
        var oTool = _el("div", "u4aP13nListTool");
        oUI.btnRefresh = _el("button", "u4a-btn u4a-btn--emphasized u4aP13nIcoBtn");
        oUI.btnRefresh.type = "button";
        oUI.btnRefresh.innerHTML = _fa("rotate");
        oUI.btnRefresh.title = _cl("A48");   // A48 Refresh
        oUI.btnRefresh.addEventListener("click", function () { lf_refresh(); });
        oTool.appendChild(oUI.btnRefresh);
        oPage.appendChild(oTool);

        // 테이블(공통 .u4a-table).
        var oWrap = _el("div", "u4a-table-wrap u4aP13nTableWrap");
        var oTbl = _el("table", "u4a-table u4aP13nTable");
        var oThead = _el("thead");
        var oTr = _el("tr");
        oTr.appendChild(_el("th", null, _cl("A35")));   // Description
        oTr.appendChild(_el("th", "u4aP13nColAct", ""));
        oThead.appendChild(oTr);
        oTbl.appendChild(oThead);
        oUI.tbody = _el("tbody");
        oTbl.appendChild(oUI.tbody);
        oWrap.appendChild(oTbl);
        oPage.appendChild(oWrap);

        // 드래그 안내 푸터(062).
        var sHint = _zc("062");
        var oHint = _el("div", "u4aP13nListHint", sHint);
        oHint.title = sHint;
        oPage.appendChild(oHint);

        oParent.appendChild(oPage);
        oUI.listPage = oPage;
    }

    // 우측 init 페이지(원본 IllustratedMessage NoEntries).
    function lf_buildInitPage(oParent) {
        var oPage = _el("div", "u4aP13nInitPage");
        oPage.innerHTML =
            '<div class="u4aP13nInitInner">' + _fa("folder-open") +
            '<span></span></div>';
        oPage.querySelector("span").textContent = _mw("196", _cl("E29"));
        oParent.appendChild(oPage);
        oUI.initPage = oPage;
    }

    // 우측 detail(미리보기 | 트리) — 원본 oDetail Splitter.
    function lf_buildDetail(oParent) {
        var oDetail = _el("div", "u4aP13nDetail");
        oDetail.hidden = true;

        // 미리보기 패널.
        var oPrev = _el("div", "u4aP13nPrevPane");
        oUI.prevPane = oPrev;   // 스플리터 클램프(min-width 실측)용.
        var oPTool = _el("div", "u4aP13nPrevTool");
        oUI.prevTitle = _el("span", "u4aP13nPrevTitle", _cl("E25"));   // E25 Personalization Preview
        oPTool.appendChild(oUI.prevTitle);
        oPTool.appendChild(_el("span", "u4aP13nToolSpacer"));

        // 테마선택 = [라벨 "테마 선택"] + [콤보] 를 한 요소(wrapper)로 묶는다 → attachOverflow 가
        //   "한 항목"으로 취급해 좁아지면 라벨·콤보가 **함께** ⋯ 메뉴로 접힌다(라벨만 남는 문제 방지).
        oUI.themeWrap = _el("div", "u4aP13nThemeWrap");
        oUI.themeLbl = _el("label", "u4aP13nThemeLbl", _cl("E27"));    // E27 Choose Theme
        oUI.themeWrap.appendChild(oUI.themeLbl);
        oUI.themeCombo = U4AUI.createSelect(oS.T_THEME || [], oS.theme, function (v) {
            oS.theme = v;
            oAPP.fn.P13nChangeTheme(v);
        });
        oUI.themeCombo.classList.add("u4aP13nThemeCombo");
        oUI.themeWrap.appendChild(oUI.themeCombo);
        oPTool.appendChild(oUI.themeWrap);
        oPrev.appendChild(oPTool);
        oUI.prevTool = oPTool;

        // 좁아지면 테마선택(라벨+콤보 wrapper)을 통째로 ⋯ 오버플로 메뉴로(공통 attachOverflow).
        //   콤보는 원본 el 을 옮기지 않고 메뉴 안에 "새 콤보"를 만들어 동일 핸들러 실행(T-CODE 입력칸 패턴).
        try {
            if (window.U4AUI && U4AUI.attachOverflow) {
                oUI.prevOvf = U4AUI.attachOverflow(oPTool, {
                    noOvfAutoMargin: true,
                    btnClass: "u4a-btn-icon u4aP13nPrevOvf",
                    btnHtml: _fa("ellipsis"),
                    isSep: function () { return false; },
                    isSkip: function (el) { return el.classList.contains("u4aP13nToolSpacer"); },
                    menuItem: function (el) {
                        if (el === oUI.themeWrap) {
                            var oRow = _el("div", "u4aP13nThemeMenuRow");
                            oRow.appendChild(_el("span", "u4aP13nThemeLbl", _cl("E27")));
                            var oCmb = U4AUI.createSelect(oS.T_THEME || [], oS.theme, function (v) {
                                oS.theme = v;
                                oAPP.fn.P13nChangeTheme(v);
                                if (oUI.themeCombo) { oUI.themeCombo.value = v; }
                            });
                            oCmb.classList.add("u4aP13nThemeCombo");
                            oRow.appendChild(oCmb);
                            return { node: oRow };
                        }
                        return null;   // 제목은 접힘 대상 아님(축소 금지 flex:0 0 auto).
                    }
                });
                // 초기 reflow — 폭 확정 후 측정(ws10 헤더와 동일 재시도 패턴).
                if (oUI.prevOvf && typeof requestAnimationFrame === "function") {
                    (function _tryReflow(n) {
                        if (oPTool.clientWidth > 0) { try { oUI.prevOvf.reflow(); } catch (e) { } return; }
                        if (n > 0) { requestAnimationFrame(function () { _tryReflow(n - 1); }); }
                    })(30);
                }
            }
        } catch (e) { console.warn("[HTML5][WS20][p13n] preview toolbar overflow attach 실패:", e && e.message); }

        // iframe(랜덤 id). 랩에 원본 u4aP13nPreview(design/css/common.css — index.html 로드) 소비
        //   → :after "PREVIEW" 워터마크(45도 회전+blink) 원본 1:1.
        oS.frameID = "u4aP13nPrev" + (oAPP.fn.getRandomKey ? oAPP.fn.getRandomKey() : String(Date.now()));
        var oFrameWrap = _el("div", "u4aP13nFrameWrap u4aP13nPreview");
        var oFrame = document.createElement("iframe");
        oFrame.id = oS.frameID;
        oFrame.name = oS.frameID;
        oFrame.className = "u4aP13nFrame";
        oFrameWrap.appendChild(oFrame);
        oPrev.appendChild(oFrameWrap);
        oDetail.appendChild(oPrev);

        // 스플리터 바.
        oUI.barR = _el("div", "u4a-splitter__bar u4aP13nBarR");
        oUI.barR.setAttribute("role", "separator");
        oDetail.appendChild(oUI.barR);

        // 트리 패널.
        var oTreePane = _el("div", "u4aP13nTreePane");
        oUI.treePane = oTreePane;   // 스플리터 클램프(min-width 실측)용.
        // 트리 툴바 — WS20 디자인트리 툴바 스킨 통째 재사용(.u4aWs20TreeToolbar 바 +
        //   .u4a-btn-icon/u4aWs20TreeTbIcon 플랫 아이콘 버튼, ws_html5_ws20_tree.js _tbBtn 동일 모양).
        var oTTool = _el("div", "u4aWs20TreeToolbar u4aP13nTreeTool");
        oUI.btnExpand = _mkTreeTbBtn("angles-down", _cl("A46"), function () {   // A46 Expand All
            if (oUI.tree) { oUI.tree.expandToLevel(99999); }
        });
        oUI.btnCollapse = _mkTreeTbBtn("angles-up", _cl("A47"), function () {   // A47 Collapse All
            if (oUI.tree) { oUI.tree.collapseAll(); if (oS.zTREE[0]) { oUI.tree.setExpanded(oS.zTREE[0], true); } }
        });
        oTTool.appendChild(oUI.btnExpand);
        oTTool.appendChild(oUI.btnCollapse);
        oTreePane.appendChild(oTTool);

        oUI.treeWrap = _el("div", "u4aP13nTreeWrap");
        oTreePane.appendChild(oUI.treeWrap);
        oDetail.appendChild(oTreePane);

        oParent.appendChild(oDetail);
        oUI.detail = oDetail;
    }

    // WS20 트리 툴바 버튼(ws_html5_ws20_tree.js _tbBtn 1:1 모양) — .u4a-btn-icon +
    //   <span class="u4aWs20TreeTbIcon"><i class="fa-..."></i></span> (플랫 아이콘, ws20.css 스킨).
    function _mkTreeTbBtn(sFa, sTip, fn) {
        var BTN = _el("button", "u4a-btn-icon");
        BTN.type = "button";
        BTN.title = sTip || "";
        var GLY = _el("span", "u4aWs20TreeTbIcon");
        GLY.innerHTML = _fa(sFa);
        BTN.appendChild(GLY);
        BTN.addEventListener("click", fn);
        return BTN;
    }

    // 스플릿바 폭(공통 .u4a-splitter__bar flex:0 0 11px).
    var C_BAR_W = 11;

    // 패널의 실효 최소폭(px) — CSS min-width(rem) 실측, 없으면 §4.3 폴백 120px.
    function _paneMin(oEl) {
        try {
            var v = parseFloat(getComputedStyle(oEl).minWidth);
            if (isFinite(v) && v > 0) { return v; }
        } catch (e) { }
        return 120;
    }

    /************************************************************************
     * 스플리터 드래그(§4.3) — 인접 패널 min-width(px) 기준 클램프.
     *   · 고정 패널(좌 리스트/우 트리)에 인라인 flex-basis(px) 직접 지정,
     *     가운데 미리보기는 flex 1 1 auto 잔여(마지막 유연 패널 보호).
     *   · 인라인 flex 방식이라 공통 더블클릭 복귀(_installGlobalSplitterReset,
     *     data-u4aSplitHome=최초 style.flex)도 자동 동작(CSS var 방식은 복귀 불가였음).
     *   · iframe 위 드래그 끊김은 body.u4a-dragging(공통) 처리.
     ************************************************************************/
    function lf_wireSplitters() {
        function wire(oBar, fnMove) {
            if (!oBar) { return; }
            var bDrag = false;
            oBar.addEventListener("mousedown", function (ev) {
                bDrag = true;
                document.body.classList.add("u4a-dragging");
                if (oUI.dlg) { oUI.dlg.classList.add("u4aP13nResizing"); }
                ev.preventDefault();
            });
            document.addEventListener("mousemove", function (ev) { if (bDrag) { fnMove(ev); } });
            document.addEventListener("mouseup", function () {
                if (bDrag) {
                    bDrag = false;
                    document.body.classList.remove("u4a-dragging");
                    if (oUI.dlg) { oUI.dlg.classList.remove("u4aP13nResizing"); }
                    // 미리보기 패널 폭이 바뀌었으니 툴바 오버플로(⋯) 재측정.
                    try { if (oUI.prevOvf) { oUI.prevOvf.reflow(); } } catch (e) { }
                }
            });
        }
        // 좌(리스트/등록) ↔ 우(디테일): 좌측=px 고정, 우측=flex 잔여.
        //   최대 = 바디 − 바 − (미리보기min + 바 + 트리min) → 어느 패널도 최소폭 아래로 찌부되지 않음.
        wire(oUI.barL, function (ev) {
            var r = oUI.body.getBoundingClientRect();
            if (r.width <= 0) { return; }
            var px = ev.clientX - r.left;
            var iMax = r.width - C_BAR_W - (_paneMin(oUI.prevPane) + C_BAR_W + _paneMin(oUI.treePane));
            px = Math.max(_paneMin(oUI.left), Math.min(iMax, px));
            oUI.left.style.flex = "0 0 " + Math.round(px) + "px";
        });
        // 미리보기 ↔ 트리: 트리=px 고정(우측 기준), 미리보기=flex 잔여.
        wire(oUI.barR, function (ev) {
            var r = oUI.detail.getBoundingClientRect();
            if (r.width <= 0) { return; }
            var px = r.right - ev.clientX;
            var iMax = r.width - C_BAR_W - _paneMin(oUI.prevPane);
            px = Math.max(_paneMin(oUI.treePane), Math.min(iMax, px));
            oUI.treePane.style.flex = "0 0 " + Math.round(px) + "px";
        });
    }

    /************************************************************************
     * 창/다이얼로그 리사이즈 재클램프(§4.3 필수) — 드래그로 px 고정된 패널이
     *   축소된 컨테이너를 넘쳐 overflow:hidden 에 바/패널이 잘리는 것 방지.
     *   px 고정분만 처리(%/flex 패널은 CSS 가 알아서 줄어듦).
     ************************************************************************/
    function lf_clampSplit() {
        if (!oUI || !oUI.body || !document.body.contains(oUI.body)) { return; }
        var w = oUI.body.clientWidth;
        if (w <= 0) { return; }
        var pMin = _paneMin(oUI.prevPane), tMin = _paneMin(oUI.treePane), lMin = _paneMin(oUI.left);

        // ① 좌측 px 고정분 — 우측(미리보기+바+트리) 최소가 들어갈 자리 확보.
        var l = parseFloat(oUI.left.style.flexBasis);
        if (isFinite(l)) {
            var lMax = w - C_BAR_W - (pMin + C_BAR_W + tMin);
            if (l > lMax) { oUI.left.style.flex = "0 0 " + Math.round(Math.max(lMin, lMax)) + "px"; }
        }
        // ② 트리 px 고정분 — 디테일 안에서 미리보기 최소 확보.
        var t = parseFloat(oUI.treePane.style.flexBasis);
        if (isFinite(t)) {
            var dw = oUI.detail.clientWidth;
            if (dw > 0) {
                var tMax = dw - C_BAR_W - pMin;
                if (t > tMax) { oUI.treePane.style.flex = "0 0 " + Math.round(Math.max(tMin, tMax)) + "px"; }
            }
        }
        // 미리보기 툴바 오버플로(⋯) 재측정 — 패널 폭 변동 반영.
        try { if (oUI.prevOvf) { oUI.prevOvf.reflow(); } } catch (e) { }
    }

    // 다이얼로그 상단 경계 = 창 타이틀바(.u4a-titlebar) 하단 y.
    //   (공통 드래그 클램프 u4a-ui.js _topChromeBottom 과 동일 — 최대화도 타이틀바는 침범 금지.)
    function lf_topChromeBottom() {
        try {
            var el = document.querySelector(".u4a-titlebar");
            if (el) {
                var r = el.getBoundingClientRect();
                if (r.height > 0 && r.top < window.innerHeight * 0.5) { return Math.max(0, r.bottom); }
            }
        } catch (e) { }
        return 0;
    }

    // 최대화 크기 적용 — 타이틀바 하단부터 현재 뷰포트 끝까지 채운다(호출 시점 창 크기 기준).
    function lf_applyMaxSize() {
        var d = oUI && oUI.dlg;
        if (!d) { return; }
        var iTop = lf_topChromeBottom();
        d.style.position = "fixed";
        d.style.margin = "0";
        d.style.left = "0px";
        d.style.top = iTop + "px";
        d.style.width = "100vw";
        d.style.maxWidth = "100vw";
        d.style.height = (window.innerHeight - iTop) + "px";
        d.style.maxHeight = (window.innerHeight - iTop) + "px";
    }

    // 창 리사이즈 추종 — 최대화 상태면 새 창 크기로 다시 채운다(px 고정이 안 따라오는 문제 해결).
    function lf_onWinResizeFull() {
        if (oS.fullSize && oUI && oUI.dlg && oUI.dlg.open) { lf_applyMaxSize(); }
        else { try { window.removeEventListener("resize", lf_onWinResizeFull); } catch (e) { } }
    }

    // 전체화면 토글(원본 lf_setPopupResize) — 타이틀바 하단부터 뷰포트 끝까지(헤더 미침범 + 창 추종).
    function lf_toggleFull() {
        if (!oUI.dlg) { return; }
        var d = oUI.dlg;
        if (oS.fullSize) {
            oS.fullSize = false;
            oUI.btnFull.innerHTML = _fa("expand");
            window.removeEventListener("resize", lf_onWinResizeFull);
            // 인라인 최대화 스타일 해제 → CSS 기본(중앙 배치) 복귀.
            d.style.position = ""; d.style.margin = ""; d.style.left = ""; d.style.top = "";
            d.style.width = ""; d.style.height = ""; d.style.maxWidth = ""; d.style.maxHeight = "";
        } else {
            oS.fullSize = true;
            oUI.btnFull.innerHTML = _fa("compress");
            lf_applyMaxSize();
            // 최대화 동안 창 크기 변화 추종(같은 함수 참조라 중복 add 无해).
            window.addEventListener("resize", lf_onWinResizeFull);
        }
        // 크기 급변 직후 스플리터 px 고정분 재클램프(§4.3 — RO 와 별개로 즉시 1회).
        lf_clampSplit();
    }


    /* ====================================================================
     * 7. 트리 / 리스트 렌더 (공통 createTree / .u4a-table)
     * ==================================================================== */

    // 우측 디자인 트리 렌더(공통 U4AUI.createTree).
    function lf_renderTree() {
        if (!oUI.treeWrap) { return; }
        oUI.treeWrap.innerHTML = "";
        oUI.tree = U4AUI.createTree({
            roots: function () { return oS.zTREE || []; },
            children: function (n) { return n.zTREE || []; },
            hasChildren: function (n) { return !!(n.zTREE && n.zTREE.length); },
            key: function (n) { return n.OBJID; },
            label: function (n) { return n.OBJID; },
            tip: function (n) { return n.OBJID; },
            selectable: false,
            // UI 아이콘 — WS20 트리와 동일(.gif OS경로 → file:// URL, sap-icon:// 등은 제외).
            icon: function (n) {
                var src = _uiconSrc(n && n.UICON);
                if (!src) { return ""; }
                return '<img class="u4aWs20TreeIcon" src="' + _esc(src) + '" alt="" onerror="this.style.display=\'none\'">';
            },
            // aggregation 라벨 — WS20 트리와 동일(sap-icon:// → FA 클래스 + UIATT 텍스트, img 아님).
            slotTrailing: function (n) {
                if (!n.UIATT) { return null; }
                var RIGHT = _el("span", "u4aWs20TreeRowRight");
                var AGGR = _el("span", "u4aWs20TreeAggr");
                var sCls = _aggrIconClass(n.UIATT_ICON);
                if (sCls) { AGGR.appendChild(_el("i", "u4aWs20TreeAggrIcon " + sCls)); }
                AGGR.appendChild(_el("span", null, n.UIATT));
                RIGHT.appendChild(AGGR);
                return RIGHT;
            },
            // WS20 트리와 동일 행 클래스 — 라벨 flex:1(남는 폭 채움)로 aggregation 우측 정렬.
            rowHook: function (oRow) { oRow.classList.add("u4aWs20TreeRow"); }
        });
        oUI.tree.el.classList.add("u4aWs20Tree");
        oUI.tree.el.classList.add("u4aP13nTree");
        oUI.treeWrap.appendChild(oUI.tree.el);
        oUI.tree.collapseAll();
        oUI.tree.expandToLevel(1);
    }

    // 헤더 리스트 테이블 렌더(공통 .u4a-table). selFileName 선택강조.
    function lf_renderList() {
        if (!oUI.tbody) { return; }
        oUI.tbody.innerHTML = "";

        var aHead = oS.T_HEAD || [];
        if (aHead.length === 0) {
            var oEmpty = _el("tr", "u4a-table__nodata");
            var oTd = _el("td", null, _mw("196", _cl("E29")));
            oTd.colSpan = 2;
            oEmpty.appendChild(oTd);
            oUI.tbody.appendChild(oEmpty);
            return;
        }

        aHead.forEach(function (h) {
            var oTr = _el("tr", "u4aP13nRow");
            // 처리 불가(라이브러리 버전 불일치) — 원본 u4aP13nNegativeLine(취소선+옅게) 1:1.
            if (h.notAllow === true) { oTr.classList.add("u4aP13nNegativeLine"); }
            if (h.fileName === oS.selFileName) { oTr.setAttribute("aria-selected", "true"); }
            oTr.setAttribute("data-file", h.fileName);
            oTr.title = h.tooltip || h.title || "";

            // 드래그 소스(패턴 적용 — dataTransfer 세팅. 수신부는 별도 항목).
            oTr.setAttribute("draggable", "true");
            oTr.addEventListener("dragstart", function (ev) { lf_rowDragStart(ev, h); });
            oTr.addEventListener("dragend", function () { try { oAPP.fn.designDragEnd(); } catch (e) { } });

            // Description 셀 — 빈 설명은 원본 u4aP13nPreviewNoText(:after "NO TEXT" 오버레이) 1:1.
            var oTdDesc = _el("td", "u4aP13nCellDesc");
            var sTxt = h.title || "";
            if (sTxt === "") { oTdDesc.classList.add("u4aP13nPreviewNoText"); }
            oTdDesc.textContent = sTxt;
            oTr.appendChild(oTdDesc);

            // 액션 셀(편집/삭제) — WS20 디자인트리 행 액션 버튼(.u4aWs20TreeActBtn 22×22) 재사용.
            //   (구 .u4a-btn-icon 은 커서 td 4.5rem 을 넘쳐 공통 td 말줄임에 삭제버튼이 "…"로 잘리던 원인)
            var oTdAct = _el("td", "u4aP13nCellAct");
            if (h.visible_edit) {
                var oEdit = _el("button", "u4aWs20TreeActBtn add u4aP13nRowAct");
                oEdit.type = "button";
                oEdit.innerHTML = _fa("pen");
                oEdit.title = _cl("B38");   // B38 Edit
                oEdit.addEventListener("click", function (ev) { ev.stopPropagation(); lf_setHeaderLineEdit(h); });
                oTdAct.appendChild(oEdit);
            }
            if (h.visible_delete) {
                var oDel = _el("button", "u4aWs20TreeActBtn del u4aP13nRowAct");
                oDel.type = "button";
                oDel.innerHTML = _fa("trash");
                oDel.title = _cl("A03");   // A03 Delete
                oDel.addEventListener("click", function (ev) { ev.stopPropagation(); lf_setHeaderLineDelete(h.fileName); });
                oTdAct.appendChild(oDel);
            }
            oTr.appendChild(oTdAct);

            // 라인 선택 → 미리보기.
            oTr.addEventListener("click", function () { lf_rowSelect(h); });

            oUI.tbody.appendChild(oTr);
        });
    }

    // 헤더 라인 드래그 시작(원본 lf_dragStart).
    function lf_rowDragStart(ev, is_head) {
        try {
            var ls_setting = parent.WSUTIL.getWsSettingsInfo() || {};
            var sVer = (ls_setting.UI5 && ls_setting.UI5.version) || "";
            if (is_head.LibraryVersion !== sVer) {
                _msg(10, "E", _mw("381"));   // 381 not compatible.
                ev.preventDefault();
                return;
            }
            // drop 가능 제어(원본 designTreeDragStart).
            try { oAPP.fn.designTreeDragStart({ OBJID: undefined, UIOBK: is_head.UIOBK }); } catch (e) { }

            ev.dataTransfer.setData("rtmcls", is_head.UILIB || "");
            ev.dataTransfer.setData("text/plain", "P13nUIData|" + is_head.fileName + "|" + (oAPP.attr.DnDRandKey || ""));
        } catch (e) {
            console.error("[HTML5][WS20][p13n] 드래그 시작 오류:", e && e.message);
        }
    }


    /* ====================================================================
     * 8. 화면 상태 전환 (원본 lf_setModelData/lf_selHeaderLine/lf_setHeaderLineEdit/back/refresh)
     * ==================================================================== */

    // 좌측 등록/리스트 페이지 토글.
    function lf_showLeftPage(sPage) {
        if (!oUI.regPage) { return; }
        oUI.regPage.hidden = (sPage !== "C");
        oUI.listPage.hidden = (sPage !== "R");
    }

    // 우측 init/detail 토글.
    function lf_showRight(bDetail) {
        if (!oUI.initPage) { return; }
        oUI.initPage.hidden = !!bDetail;
        oUI.detail.hidden = !bDetail;
    }

    // 모델 데이터 구성(원본 lf_setModelData). is_head/is_tree 선택 입력.
    function lf_setModelData(sMode, is_head, is_tree) {
        oS.is_head = null;
        if (is_head) {
            oS.is_head = {
                title: is_head.title, fileName: is_head.fileName, UIOBK: is_head.UIOBK,
                UILIB: is_head.UILIB, THEME: is_head.THEME, bootPath: is_head.bootPath,
                LibraryVersion: is_head.LibraryVersion, isNew: false
            };
        } else {
            oS.is_head = { title: "", fileName: "", UIOBK: "", UILIB: "", THEME: "", bootPath: "", LibraryVersion: "", isNew: true };
        }

        // 등록 페이지 Description + 삭제버튼 표시(원본 visible_delete — 기존건 편집시만).
        if (oUI.descInput) { oUI.descInput.setValue(oS.is_head.title); }
        if (oUI.btnRegDel) { oUI.btnRegDel.hidden = !is_head; }
        // 뒤로가기: 신규 등록(context menu "C", isNew)에선 돌아갈 리스트 컨텍스트가 없어 비활성.
        //   기존 항목 편집(리스트→편집, is_head 존재)일 때만 활성(리스트로 복귀). 저장하면 "R"로 자동 이동.
        if (oUI.btnBack) { oUI.btnBack.disabled = !is_head; }

        if (is_tree) { oS.zTREE = [is_tree]; lf_renderTree(); }

        if (sMode === "R") {
            oS.T_HEAD = lf_getP13nHeaderData();
            lf_renderList();
        }

        // 좌측 페이지 전환.
        lf_showLeftPage(sMode);
    }

    // 초기 테마 콤보/트리 반영.
    function lf_setInitModelData() {
        if (oUI.themeCombo) {
            if (oUI.themeCombo.setItems) { oUI.themeCombo.setItems(oS.T_THEME || []); }
            oUI.themeCombo.value = oS.theme;
        }
    }

    // 헤더 라인 선택(원본 lf_rowSelectionChange + lf_selHeaderLine).
    function lf_rowSelect(is_head) {
        _busy(true);
        oS.selFileName = is_head.fileName;
        lf_renderList();   // 선택강조 갱신.

        var ls_item = lf_getItemData(is_head);
        if (!ls_item) { _busy(false); return; }

        try { if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(ls_item.is_tree); } } catch (e) { }

        oS.zTREE = [ls_item.is_tree];
        oS.HTML = ls_item.HTML || "";
        lf_renderTree();

        lf_showRight(true);
        lf_setPrevNav();
    }

    // 편집(원본 lf_setHeaderLineEdit) — 등록 모드로 진입.
    function lf_setHeaderLineEdit(is_head) {
        _busy(true);
        var ls_item = lf_getItemData(is_head);
        if (!ls_item) { _busy(false); return; }

        try { if (typeof oAPP.fn.setTreeUiIcon === "function") { oAPP.fn.setTreeUiIcon(ls_item.is_tree); } } catch (e) { }

        oS.mode = "C";
        oS.HTML = ls_item.HTML || "";
        lf_setModelData("C", is_head, ls_item.is_tree);

        lf_showRight(true);
        lf_setPrevNav();
    }

    // 뒤로가기(원본 lf_back) — 등록 → 리스트.
    function lf_back() {
        oS.mode = "R";
        oS.HTML = "";
        lf_setPrevHTML();
        var l_fileName = oS.is_head ? oS.is_head.fileName : "";
        lf_setModelData("R");
        lf_setHeadLineSelect(l_fileName);
    }

    // 새로고침(원본 lf_setHeaderRefresh).
    function lf_refresh() {
        oS.mode = "R";
        oS.HTML = "";
        lf_setPrevHTML();
        var l_fileName = oS.selFileName;
        lf_setModelData("R");
        lf_setHeadLineSelect(l_fileName);
    }

    // 헤더 라인 선택 반영(원본 lf_setHeadLineSelect). 없으면 init.
    function lf_setHeadLineSelect(sFileName) {
        if (!sFileName || !(oS.T_HEAD && oS.T_HEAD.length) ||
            oS.T_HEAD.findIndex(function (a) { return a.fileName === sFileName; }) === -1) {
            oS.selFileName = "";
            lf_renderList();
            lf_showRight(false);
            return;
        }
        oS.selFileName = sFileName;
        lf_renderList();
    }

    // 미리보기 화면 표시(원본 lf_setPrevNav) — iframe 최초 1회 서버로드, 이후 HTML 주입.
    function lf_setPrevNav() {
        if (!oS.frameLoaded) {
            oS.frameLoaded = true;
            lf_loadPrevHTML();   // 로드 완료 시 P13nPrevLoaded → setPrevHTML.
            return;
        }
        lf_setPrevHTML(oS.HTML);
        _busy(false);
    }


    /* ====================================================================
     * 9. 열기 / 닫기 / 공개 진입점
     * ==================================================================== */

    function lf_close() {
        try { window.removeEventListener("resize", lf_onWinResizeFull); } catch (e) { }
        try { window.removeEventListener("resize", lf_clampSplit); } catch (e) { }
        try { if (oUI && oUI.ro) { oUI.ro.disconnect(); oUI.ro = null; } } catch (e) { }
        oS.fullSize = false;
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    // 닫기(취소) — 원본 lf_close("001") + 파일 unlock + 잠금해제.
    function lf_closeCancel() {
        lf_headerLock(true);   // unlock.
        _unlock();
        lf_close();
        _busy(false);
        // 001 Cancel operation.
        _msg(10, "I", _mw("001"));
    }

    // 팝업 열림 후 처리(원본 lf_dialogAfterOpen).
    function lf_afterOpen() {
        _unlock();

        var ls_tree = oS.is_tree ? JSON.parse(JSON.stringify(oS.is_tree)) : null;

        if (oS.mode === "C") {
            lf_headerLock();

            // lock 실패 → 조회 모드 fallback.
            if (!oS.lock) {
                oS.mode = "R";
                lf_setInitModelData();
                lf_setModelData("R");
                lf_showRight(false);
                _busy(false);
                return;
            }

            // 미리보기 HTML 직렬화 + detail 표시.
            lf_getUiHTML(ls_tree);
            lf_showRight(true);
        }

        lf_setInitModelData();
        lf_setModelData(oS.mode, undefined, ls_tree);

        if (oS.mode === "C") { lf_setPrevNav(); }
        else { _busy(false); }
    }

    /************************************************************************
     * 공개 진입점 — UI 개인화 팝업 열기 (원본 callP13nDesignDataPopup).
     *   sMode: "R"(리스트 조회) | "C"(선택 UI 로 신규 등록)
     *   is_tree: "C" 일 때 개인화 대상 디자인 트리 노드.
     ************************************************************************/
    oAPP.fn.fnP13nDesignPopupOpen = function (sMode, is_tree) {

        // ROOT 는 개인화 불가(원본 380).
        if (is_tree && is_tree.OBJID === "ROOT") {
            _msg(10, "E", _mw("380", "ROOT"));
            _unlock();
            _busy(false);
            return;
        }

        _resetSession();
        oS.is_tree = is_tree || null;

        lf_setInitData(sMode);

        // 폴더/헤더 파일 생성 실패 시 종료.
        if (lf_createDefaultFolder()) { _unlock(); _busy(false); return; }

        // 팝업 재빌드(닫으면 공통이 DOM 제거).
        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; lf_build(); }

        // 제목 — E24 UI Personalization [- OBJID].
        var sTitle = _cl("E24");
        if (is_tree && is_tree.OBJID) { sTitle = sTitle + " - " + is_tree.OBJID; }
        if (oUI.titleTxt) { oUI.titleTxt.textContent = sTitle; }

        // 초기 표시 상태.
        lf_showRight(false);

        try { oUI.dlg.showModal(); } catch (e) { }

        // afterOpen 처리.
        lf_afterOpen();
    };

    // ★UI5 원본 callP13nDesignDataPopup(new sap.m.Dialog)이 런타임에 로드돼 있을 수 있으므로
    //   HTML5 로 오버라이드(E28 툴바 등 다른 호출부가 이 이름을 써도 HTML5 팝업으로 라우팅).
    oAPP.fn.callP13nDesignDataPopup = function (sMode, is_tree) {
        oAPP.fn.fnP13nDesignPopupOpen(sMode, is_tree);
    };


    /************************************************************************
     * 컨텍스트 메뉴 M11(내 패턴) 진입 — 원본 contextMenuP13nDesignPopup 1:1(HTML5).
     *   폴더/헤더 생성 + 다른화면 lock 점검(382) 후 선택 노드로 "C" 모드 오픈.
     *   ★ HTML5 컨텍스트 메뉴는 /lcmenu/OBJID 미세팅 → 호출부가 노드(is_node)를 직접 전달.
     *     미전달 시(원본 UI5 경로 호환) /lcmenu/OBJID 로 폴백.
     ************************************************************************/
    oAPP.fn.contextMenuP13nDesignPopup = function (is_node) {

        _busy(true);
        _lock();

        // 폴더/헤더 파일 생성.
        if (lf_createDefaultFolderStandalone()) { _unlock(); _busy(false); return; }

        // 다른 화면에서 개인화 중이면 종료(382).
        try {
            var lockFile = parent.require("proper-lockfile");
            if (lockFile.checkSync(_lockHeaderPath())) {
                _msg(10, "S", _mw("382"));
                _unlock();
                _busy(false);
                return;
            }
        } catch (e) { }

        // 호출 노드 OBJID — 전달 노드 우선, 없으면 /lcmenu/OBJID(UI5 경로).
        var l_OBJID = (is_node && is_node.OBJID) ? is_node.OBJID : "";
        if (!l_OBJID) { try { l_OBJID = oAPP.attr.oModel.getProperty("/lcmenu/OBJID"); } catch (e) { } }
        if (!l_OBJID || l_OBJID === "ROOT") { _unlock(); _busy(false); return; }

        // 최신/완전한 트리 노드 확보(getTreeData 우선, 실패 시 전달 노드).
        var ls_tree = null;
        try { ls_tree = oAPP.fn.getTreeData(l_OBJID); } catch (e) { }
        if (!ls_tree) { ls_tree = is_node || null; }
        if (!ls_tree) { _unlock(); _busy(false); return; }

        oAPP.fn.fnP13nDesignPopupOpen("C", ls_tree);
    };

    // 폴더 생성(컨텍스트 진입 프리체크용 — 실패 시 true). lf_createDefaultFolder 와 동일하나
    //   진입 시점엔 oS 초기화 전이라 별도(부작용 없이) 처리.
    function lf_createDefaultFolderStandalone() {
        try {
            var l1 = _userP13nPath();
            if (!parent.FS.existsSync(l1)) { parent.FS.mkdirSync(l1); }
            var l2 = _userSysPath();
            if (!parent.FS.existsSync(l2)) { parent.FS.mkdirSync(l2); }
            var l3 = _userHeaderPath();
            if (!parent.FS.existsSync(l3)) { parent.FS.writeFileSync(l3, JSON.stringify([])); }
        } catch (e) { _msg(10, "E", e && e.message ? e.message : e); return true; }
    }


    /* ====================================================================
     * 10. 스코프 스타일(공통 파일 미수정 — 화면 스코프만, 테마 토큰 소비)
     * ==================================================================== */

    function lf_ensureStyle() {
        if (document.getElementById("u4aP13nStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aP13nStyle";
        oStyle.textContent =
            ".u4aP13nDlg { width: min(94vw, 1040px); height: min(88vh, 720px); padding: 0; display: flex; flex-direction: column; }" +
            ".u4aP13nDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aP13nDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // 바디 = 가로 스플리터.
            ".u4aP13nBody { flex: 1 1 auto; min-height: 0; display: flex; padding: 0; overflow: hidden; }" +
            // 기본 30% — 드래그 시 인라인 flex(px)가 덮음(더블클릭=인라인 제거→이 기본으로 복귀).
            ".u4aP13nLeft { flex: 0 0 30%; min-width: 13rem; display: flex; flex-direction: column; min-height: 0; overflow: hidden; background: var(--surface); }" +
            ".u4aP13nRight { flex: 1 1 auto; min-width: 0; display: flex; min-height: 0; }" +
            // ★[hidden] 강제 — 페이지(display:flex)·버튼(.u4a-btn display:inline-flex)이 UA [hidden]을
            //   덮어써 안 숨겨지는 공통 함정. 등록툴바 삭제버튼(hidden=true 인데 계속 보이던 버그) 포함.
            ".u4aP13nRegPage[hidden], .u4aP13nListPage[hidden], .u4aP13nInitPage[hidden], .u4aP13nDetail[hidden] { display: none !important; }" +
            ".u4aP13nRegTool > [hidden] { display: none !important; }" +
            // 좌측 페이지 공통.
            ".u4aP13nRegPage, .u4aP13nListPage { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }" +
            ".u4aP13nRegTool, .u4aP13nListTool { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.5rem; border-bottom: 0.0625rem solid var(--line); flex-wrap: nowrap; min-height: 2.5rem; box-sizing: border-box; }" +
            // 제목은 축소/말줄임 금지(flex:0 0 auto) — 좁아지면 제목이 "..."로 찌그러지는 대신
            //   뒤쪽 UI(테마 콤보→라벨)가 attachOverflow 로 먼저 ⋯ 메뉴에 접힌다.
            ".u4aP13nPrevTitle { font-weight: 600; color: var(--text); font-size: 0.8125rem; white-space: nowrap; flex: 0 0 auto; }" +
            // 아이콘 전용 버튼(원본 sap.m.Button icon-only) — 정사각 시각.
            ".u4aP13nIcoBtn { min-width: 2.25rem; justify-content: center; }" +
            // 원본 ToolbarSeparator.
            ".u4aP13nTbSep { flex: 0 0 auto; width: 0.0625rem; height: 1.25rem; background: var(--line); margin: 0 0.25rem; }" +
            ".u4aP13nRegBack[disabled] { opacity: 0.4; pointer-events: none; }" +
            ".u4aP13nToolSpacer { flex: 1 1 auto; }" +
            ".u4aP13nRegBody { flex: 1 1 auto; min-height: 0; padding: 0.5rem; display: flex; align-items: stretch; }" +
            ".u4aP13nDescField { flex: 1 1 auto; min-height: 0; display: flex; }" +
            ".u4aP13nDescField .u4a-input { width: 100%; height: 100%; min-height: 6rem; resize: none; }" +
            // 리스트 테이블.
            ".u4aP13nTableWrap { flex: 1 1 auto; min-height: 0; overflow: auto; }" +
            ".u4aP13nColAct, .u4aP13nCellAct { width: 4.5rem; text-align: right; white-space: nowrap; }" +
            ".u4aP13nRow { cursor: pointer; }" +
            // 빈 설명 "NO TEXT" 오버레이(원본 u4aP13nPreviewNoText :after absolute)의 기준 좌표.
            ".u4aP13nCellDesc { position: relative; }" +
            ".u4aP13nRowAct { vertical-align: middle; }" +
            ".u4aP13nListHint { flex: 0 0 auto; padding: 0.375rem 0.625rem; font-size: 0.6875rem; color: var(--text-muted); border-top: 0.0625rem solid var(--line); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            // 우측 init.
            ".u4aP13nInitPage { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; min-width: 0; }" +
            ".u4aP13nInitInner { display: flex; flex-direction: column; align-items: center; gap: 0.625rem; color: var(--text-muted); }" +
            ".u4aP13nInitInner i { font-size: 2.5rem; opacity: 0.5; }" +
            ".u4aP13nInitInner span { font-size: 0.8125rem; }" +
            // 우측 detail = 미리보기 | 트리.
            ".u4aP13nDetail { flex: 1 1 auto; min-width: 0; display: flex; min-height: 0; }" +
            ".u4aP13nPrevPane { flex: 1 1 auto; min-width: 15rem; display: flex; flex-direction: column; min-height: 0; }" +
            ".u4aP13nTreePane { flex: 0 0 28%; min-width: 16rem; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }" +
            // min-width:0+overflow:hidden = attachOverflow 폭 측정 전제(자연폭으로 늘어나 오판 방지 — 트리툴바 fix 동일).
            ".u4aP13nPrevTool { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.5rem; border-bottom: 0.0625rem solid var(--line); flex-wrap: nowrap; min-height: 2.5rem; box-sizing: border-box; min-width: 0; overflow: hidden; }" +
            // 트리 툴바 = WS20 .u4aWs20TreeToolbar 스킨 소유(padding/gap/배경/보더) — 여기선 이웃(미리보기
            //   툴바 2.5rem)과 높이 정렬만 확장.
            ".u4aP13nTreeTool { min-height: 2.5rem; box-sizing: border-box; }" +
            // 테마선택 wrapper(라벨+콤보) — 한 항목으로 접히게 축소 금지(flex:0 0 auto).
            ".u4aP13nThemeWrap { display: flex; align-items: center; gap: 0.375rem; flex: 0 0 auto; }" +
            ".u4aP13nThemeLbl { font-weight: 600; color: var(--text); font-size: 0.75rem; white-space: nowrap; flex: 0 0 auto; }" +
            // 공통 .u4a-combo 는 width:100% → 툴바 안에서 전체로 늘어난다. 이 인스턴스만 고정폭으로 override.
            ".u4aP13nThemeCombo { flex: 0 0 auto; width: 12rem; }" +
            // position:relative = 원본 u4aP13nPreview :after "PREVIEW" 워터마크(absolute)의 기준 좌표.
            ".u4aP13nFrameWrap { flex: 1 1 auto; min-height: 0; overflow: hidden; background: var(--surface); position: relative; }" +
            ".u4aP13nFrame { width: 100%; height: 100%; border: none; overflow: hidden; }" +
            ".u4aP13nTreeWrap { flex: 1 1 auto; min-height: 0; overflow: auto; }" +
            ".u4aP13nTree { min-height: 0; }" +
            // 스플리터 바 = 공통 .u4a-splitter__bar(flex:0 0 11px + 가운데 알약 그립) 그대로 소비.
            //   ★flex 오버라이드 금지(0 0 auto 주면 폭 붕괴 → 얇은 선 됨). 화면 스코프는 배경만 손대지 않는다.
            ".u4aP13nDlg.u4aP13nResizing { cursor: col-resize; }" +
            ".u4aP13nDlg.u4aP13nResizing * { cursor: col-resize !important; }" +
            // 오버플로(⋯) — attachOverflow 가 el.hidden 으로 접을 때 span/label 도 확실히 숨김([hidden] 함정).
            ".u4aP13nPrevTool > [hidden] { display: none !important; }" +
            // ⋯ 메뉴 안 테마선택 행(라벨+새 콤보 — T-CODE 입력칸 패턴).
            ".u4aP13nThemeMenuRow { display: flex; align-items: center; gap: 0.375rem; padding: 0.125rem 0.25rem; }" +
            ".u4aP13nThemeMenuRow .u4a-combo { width: 11rem; }" +
            ".u4aP13nFoot { display: flex; justify-content: flex-end; }";
        document.head.appendChild(oStyle);
    }

})(window, window.jQuery || window.$, oAPP);
