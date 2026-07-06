/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnUiTempWizardPopupOpen.js
 * - file Desc : UI Template Wizard (HTML5)
 * ----------------------------------------------------------------------
 * [HTML5 컨버전 메모]
 *  원본(4299줄, 순수 UI5: sap.m.Dialog + ResponsiveSplitter + sap.tnt.ToolPage
 *  + sap.m.Wizard + sap.ui.table.Table)을 공통 자산(.u4a-dialog / .u4a-splitter /
 *  .u4a-navlist / .u4a-table / U4AUI.*) 기반 HTML5 인앱 다이얼로그로 재작성한다.
 *  UI5 데이터바인딩 대신 로컬 상태(oS) + 수동 렌더(바인딩/P13n 팝업 선례와 동일).
 *
 *  [단계 진행]
 *   ▣ Stage 1 (본 파일 현재 범위): 팝업 셸 — 다이얼로그(드래그·리사이즈) +
 *     좌우 스플리터(좌 프리뷰 / 우 사이드네비 + 본문) + 사이드네비 4항목
 *     (활성규칙 T→Table·S→Form·T&S→Report·라이선스→WebDyn, 첫 활성 자동선택,
 *     녹색 활성) + 프리뷰 이미지(images/wizard/{key}.png) + 푸터(생성[숨김]/닫기).
 *   □ Stage 2~3: WZD1(Table)/WZD2(Form)/WZD3(Report) 위자드 스텝 본문.
 *   □ Stage 4: 완료(생성) → designWizardCallback(HTML5) 로 실제 UI 노드 생성.
 *   ※ WZD4(Web Dynpro Conversion): 원본 라이선스 게이트 유지. 임베드 모듈
 *     (conversionWebdynpro) 이 순수 UI5·미변환이라 본 단계에선 "준비중" 안내.
 *
 *  [트리거] WS20 디자인 툴바 B24(모니터 아이콘) → oAPP.fn.designCallWizardPopup()
 *     (js/ws_html5_ws20_wizard.js) → 서버 /ui_temp_wzd(WZD_CHKER)
 *     → fnUiTempWizardPopupOpener(param)(fnDialogPopupOpener.js) → 본 함수.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    /* ==================================================================
     * 상수
     * ================================================================== */
    var C_DLG_ID = "u4aTplWizDlg";

    // 사이드네비 메뉴 키 (원본 C_TMPL_WZD1~4_ID 와 동일 — 프리뷰 이미지 파일명에 사용)
    var K_WZD1 = "u4aWsTmplWzd1"; // Table Ui Create
    var K_WZD2 = "u4aWsTmplWzd2"; // Forms Ui Create
    var K_WZD3 = "u4aWsTmplWzd3"; // Report Template Create
    var K_WZD4 = "u4aWsTmplWzd4"; // Web Dynpro Conversion

    var C_BAR_W = 11; // 공통 .u4a-splitter__bar 폭(flex:0 0 11px)

    var APPCOMMON = oAPP.common;

    /* ==================================================================
     * 로컬 헬퍼
     * ================================================================== */
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (sText != null) { o.textContent = sText; }
        return o;
    }
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }

    // /U4A/CL_WS_COMMON 메시지 클래스
    function _cl(sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return sCode; }
    }
    // /U4A/MSG_WS 워크스페이스 메시지 클래스
    function _mw(sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return sCode; }
    }
    // ZMSG_WS_COMMON_001 (워크스페이스 언어별)
    function _ws(sCode, p1) {
        try {
            var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, p1 || "");
        } catch (e) { return sCode; }
    }
    function _msg(iKind, sType, sMsg, fnCb) {
        try { parent.showMessage(window.sap || null, iKind, sType, sMsg, fnCb); }
        catch (e) { console.warn("[HTML5][WS20][tplwiz] showMessage:", e && e.message); }
    }
    function _busy(bOn) {
        try { parent.setBusy && parent.setBusy(bOn ? "X" : ""); } catch (e) { }
    }

    // 웹딘→U4A 변환 플러그인(U4A_CVT_WDR) 설치 서버 여부 (원본 uiDesignArea.js 888행)
    function _hasWdrPlugin() {
        try {
            var oUser = parent.getUserInfo && parent.getUserInfo();
            var aP = oUser && oUser.META && oUser.META.T_PLIST;
            return !!(aP && typeof aP.find === "function" && aP.find(function (x) { return x === "U4A_CVT_WDR"; }));
        } catch (e) { return false; }
    }

    /* ==================================================================
     * 상태 / DOM 캐시
     * ================================================================== */
    var oUI = null; // DOM 캐시
    var oS = null;  // 로컬 상태

    /* ==================================================================
     * [PUBLIC] UI Template Wizard 팝업 열기
     *   (원본 oAPP.fn.fnUiTempWizardPopupOpen — sap.m.Dialog.open())
     * @param {object} oTempData - 서버 /ui_temp_wzd(WZD_CHKER) 응답
     *   { S_TMPL:[{CANDTY:"T"|"S", OBJNM,...}], T_MINFO:["T"|"S"...],
     *     T_UIDDLB:[...], RETCD, ... }
     * ================================================================== */
    oAPP.fn.fnUiTempWizardPopupOpen = function (oTempData) {

        _initState(oTempData);

        // 다이얼로그 최초 1회 생성 (파괴되었으면 재생성)
        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) {
            oUI = null;
            lf_build();
        }

        // 데이터 기반 렌더 (사이드네비 활성/자동선택 + 프리뷰)
        _renderMenu();
        _selectFirstEnabledMenu();

        if (!oUI.dlg.open) {
            try { oUI.dlg.showModal(); } catch (e) { }
        }

        // 원본 ev_UiTempWizardAfterOpen : busy 해제
        _busy(false);

    }; // end of fnUiTempWizardPopupOpen

    /* ==================================================================
     * 상태 초기화 — oTempData 로부터 UICHOICE / 메뉴 활성 구성
     *   (원본 fnUiTempWizardModelBinding)
     * ================================================================== */
    function _initState(oTempData) {

        oS = {
            MASTER: oTempData || {},
            cur: null,
            UICHOICE: {
                T: { sel: "", ITEM: [] }, // Table 계열 UI Choice
                S: { sel: "", ITEM: [] }, // Structure 계열 UI Choice
                A: { selS: "", selT: "" } // Report Template (Form=S / Table=T)
            },
            sec: {},     // 위자드 섹션 런타임 상태 (sid -> {model, outab, treevisi, treeflg, els, cfg})
            menuCfg: {}  // 메뉴키 -> 섹션 cfg (푸터 생성 버튼 dispatch)
        };

        // UI Choice 콤보 데이터 구성 (CANDTY: T / S) — 원본 306~321행
        var aTmpl = (oTempData && oTempData.S_TMPL) || [];
        for (var i = 0; i < aTmpl.length; i++) {
            var o = aTmpl[i];
            if (o.CANDTY === "T") { oS.UICHOICE.T.ITEM.push(o); }
            else if (o.CANDTY === "S") { oS.UICHOICE.S.ITEM.push(o); }
        }

        // 메뉴 활성 규칙 — 원본 formatter(546~614행)
        var aInfo = (oTempData && oTempData.T_MINFO) || [];
        var bT = aInfo.indexOf("T") !== -1;
        var bS = aInfo.indexOf("S") !== -1;

        oS.menu = [
            { key: K_WZD1, text: _cl("D63"), enabled: bT },        // Table Ui Create
            { key: K_WZD2, text: _cl("D64"), enabled: bS },        // Forms Ui Create
            { key: K_WZD3, text: _cl("D65"), enabled: (bT && bS) },// Report Template Create
            { key: K_WZD4, text: _ws("457"), enabled: _hasWdrPlugin() } // Web Dynpro Conversion
        ];
    }

    /* ==================================================================
     * 다이얼로그 1회 생성
     * ================================================================== */
    function lf_build() {

        lf_ensureStyle();
        oUI = {};

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aTplWiz";

        /* ---- 헤더 (드래그 핸들) ---- */
        var oHeader = _el("div", "u4a-dialog__header u4aTplWiz__header");
        oHeader.innerHTML = _fa("wand-magic-sparkles") + "<span class='u4a-dialog__title'></span>";
        oHeader.querySelector(".u4a-dialog__title").textContent = _cl("B24"); // UI Template Wizard

        var oXBtn = _el("button", "u4a-btn-icon u4aTplWiz__x");
        oXBtn.type = "button";
        oXBtn.setAttribute("aria-label", "Close");
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.addEventListener("click", function () { lf_close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        /* ---- 바디 : 좌우 스플리터 ---- */
        var oBody = _el("div", "u4a-dialog__body u4aTplWiz__body");

        // 좌측 : 프리뷰
        var oLeft = _el("div", "u4a-splitter__pane u4aTplWiz__left");
        var oPrevHead = _el("div", "u4aTplWiz__paneHead", _cl("A67")); // Preview
        var oPrevBody = _el("div", "u4aTplWiz__prev");
        // P1 : 이미지 없음
        var oPrevEmpty = _el("div", "u4aTplWiz__prevEmpty");
        oPrevEmpty.innerHTML = _fa("image") +
            "<span></span>";
        oPrevEmpty.querySelector("span").textContent = _mw("347", _cl("E32")); // Preview Image Not found.
        // P2 : 이미지
        var oPrevImgWrap = _el("div", "u4aTplWiz__prevImgWrap");
        var oPrevImg = document.createElement("img");
        oPrevImg.className = "u4aTplWiz__prevImg";
        oPrevImg.alt = "";
        oPrevImgWrap.appendChild(oPrevImg);
        oPrevBody.appendChild(oPrevEmpty);
        oPrevBody.appendChild(oPrevImgWrap);
        oLeft.appendChild(oPrevHead);
        oLeft.appendChild(oPrevBody);

        // 스플릿 바 — 공통 .u4a-splitter__bar 풀스킨 소비(flex:0 0 11px + 알약 그립).
        //   ★flex/배경 override 금지(§4.3): 스코프 클래스 안 붙임.
        var oBar = _el("div", "u4a-splitter__bar");
        oBar.setAttribute("role", "separator");
        oBar.setAttribute("aria-orientation", "vertical");

        // 우측 : 사이드네비 + 본문
        var oRight = _el("div", "u4a-splitter__pane u4aTplWiz__right");
        var oNav = _el("nav", "u4a-navlist u4aTplWiz__nav");
        var oMain = _el("div", "u4aTplWiz__main");
        oRight.appendChild(oNav);
        oRight.appendChild(oMain);

        oBody.appendChild(oLeft);
        oBody.appendChild(oBar);
        oBody.appendChild(oRight);
        oDlg.appendChild(oBody);

        /* ---- 푸터 : 생성 / 닫기 ---- */
        var oFoot = _el("div", "u4a-dialog__footer u4aTplWiz__footer");
        oFoot.appendChild(_el("span", "u4a-spacer"));

        // 원본 footer 는 아이콘 전용(Create=document/Emphasized, Close=decline).
        // 공통 규약(confirm-buttons-icon-only): 버튼 2개 이하 → 아이콘만.
        var oCreateBtn = _el("button", "u4a-btn-icon u4aTplWiz__create");
        oCreateBtn.type = "button";
        oCreateBtn.style.color = "var(--accent)"; // Emphasized 의미(생성)
        oCreateBtn.title = _cl("B24"); // UI Template Wizard (생성)
        oCreateBtn.innerHTML = _fa("wand-magic-sparkles");
        oCreateBtn.hidden = true; // CRBTN_VISI (Stage 2~4에서 제어)
        oCreateBtn.addEventListener("click", function () { lf_onCreate(); });
        oFoot.appendChild(oCreateBtn);

        var oCloseBtn = _el("button", "u4a-btn-icon u4aTplWiz__close");
        oCloseBtn.type = "button";
        oCloseBtn.style.color = "var(--negative)"; // Close 의미
        oCloseBtn.innerHTML = _fa("xmark");
        oCloseBtn.addEventListener("click", function () { lf_close(); });
        oFoot.appendChild(oCloseBtn);

        oDlg.appendChild(oFoot);

        /* ---- 이벤트 : ESC / cancel ---- */
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });
        oDlg.addEventListener("keydown", function (e) {
            if (e.key === "Escape") { e.preventDefault(); lf_close(); }
        });

        /* ---- 공통 API : 중앙정렬 + 리사이즈 ---- */
        if (window.U4AUI && U4AUI.makeDialogRecenter) { try { U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { } }
        if (window.U4AUI && U4AUI.makeDialogResizable) { try { U4AUI.makeDialogResizable(oDlg, { minW: 880, minH: 560 }); } catch (e) { } }

        document.body.appendChild(oDlg);

        // DOM 캐시
        oUI.dlg = oDlg;
        oUI.header = oHeader;
        oUI.nav = oNav;
        oUI.main = oMain;
        oUI.prevEmpty = oPrevEmpty;
        oUI.prevImgWrap = oPrevImgWrap;
        oUI.prevImg = oPrevImg;
        oUI.left = oLeft;
        oUI.right = oRight;
        oUI.bar = oBar;
        oUI.body = oBody;
        oUI.createBtn = oCreateBtn;

        _wireSplitter();

    } // end of lf_build

    /* ==================================================================
     * 사이드네비 렌더 (활성/비활성 + 녹색 활성 표시)
     *   (원본 SideNavigation + onAfterRendering 녹색 아이콘)
     * ================================================================== */
    function _renderMenu() {
        if (!oUI || !oUI.nav) { return; }
        oUI.nav.innerHTML = "";

        oS.menu.forEach(function (m) {
            var oItem = _el("button", "u4a-navlist__item u4aTplWiz__navItem");
            oItem.type = "button";
            oItem.setAttribute("aria-selected", "false");
            oItem.setAttribute("data-key", m.key);
            // 활성 메뉴만 녹색 아이콘 (원본 u4aWsTmplWzdAttrActive)
            var sIcon = m.enabled ? "u4aTplWiz__navIco--on" : "u4aTplWiz__navIco--off";
            oItem.innerHTML = "<i class='fa-solid fa-fill-drip u4aTplWiz__navIco " + sIcon + "'></i><span></span>";
            oItem.querySelector("span").textContent = m.text;
            if (!m.enabled) {
                oItem.classList.add("is-disabled");
                oItem.disabled = true;
            }
            oItem.addEventListener("click", function () {
                if (!m.enabled) { return; }
                _selectMenu(m.key);
            });
            oUI.nav.appendChild(oItem);
        });

        // 본문 4개 페이지 상주 생성 (원본 NavContainer 4 pages) — 전환 애니메이션 대상.
        _renderPages();
    }

    /* ==================================================================
     * 본문 페이지 상주 생성 (원본 NavContainer pages)
     *   4개 메뉴 페이지를 미리 만들어 두고 hidden 토글 + 전환 애니메이션으로 넘긴다.
     *   Stage 2~3 에서 각 위자드(WZD1/2/3) 스텝 UI 로 body 를 채운다.
     * ================================================================== */
    function _renderPages() {
        if (!oUI || !oUI.main) { return; }
        oUI.main.innerHTML = "";
        oUI.pages = {};
        oUI.curPage = null;
        oUI.curPageKey = null;

        oS.menu.forEach(function (m) {
            var oPg = _buildMainPage(m);
            oPg.hidden = true;
            oUI.main.appendChild(oPg);
            oUI.pages[m.key] = oPg;
        });
    }

    /* ==================================================================
     * 메뉴 페이지 1개 생성 (head + body).  Stage 1 = 플레이스홀더.
     * ================================================================== */
    function _buildMainPage(m) {
        var oPg = _el("div", "u4aTplWiz__mpage");
        oPg.setAttribute("data-key", m.key);

        oPg.appendChild(_el("div", "u4aTplWiz__mainHead", m.text));

        var oPage = _el("div", "u4aTplWiz__page");
        if (m.key === K_WZD1) {
            // Stage 2 : Table Ui Create 위자드 (UI Choice → Model Select → 편집테이블)
            oPage.appendChild(_buildWizardSection({
                sid: "WZD1",
                menuKey: K_WZD1,
                treeCapable: true,        // sap.ui.table.TreeTable 선택 시 Parent/Child 컬럼
                bindCardi: "T",           // Bind 팝업(모델 피커) cardinality
                getItems: function () { return oS.UICHOICE.T.ITEM; },
                getSel: function () { return oS.UICHOICE.T.sel; },
                setSel: function (v) { oS.UICHOICE.T.sel = v; }
            }));
        } else if (m.key === K_WZD4) {
            // WZD4 : 임베드 모듈(conversionWebdynpro)이 순수 UI5·미변환 → 준비중 안내.
            // TODO(i18n): 안내 문구 메시지 키 수집 필요(현재 임시 KO/EN 하드코딩).
            var oNote = _el("div", "u4aTplWiz__note");
            oNote.innerHTML = _fa("screwdriver-wrench") + "<span></span>";
            oNote.querySelector("span").textContent = "Web Dynpro Conversion 화면은 준비 중입니다.";
            oPage.appendChild(oNote);
        }
        // else (WZD2/WZD3): Stage 3 에서 위자드 스텝 UI 로 채움.
        oPg.appendChild(oPage);
        return oPg;
    }

    /* ==================================================================
     * 첫 활성 메뉴 자동 선택 (원본 onAfterRendering 첫 enabled 선택)
     * ================================================================== */
    function _selectFirstEnabledMenu() {
        var first = null;
        for (var i = 0; i < oS.menu.length; i++) {
            if (oS.menu[i].enabled) { first = oS.menu[i].key; break; }
        }
        if (first) { _selectMenu(first); }
        else {
            // 활성 메뉴 없음 — 프리뷰 초기화
            oS.cur = null;
            _prevInit();
        }
    }

    /* ==================================================================
     * 메뉴 선택 → 본문 페이지 전환(애니메이션) + 프리뷰 갱신
     *   (원본 ev_sideNaviItemSelection + NavContainer.to())
     * ================================================================== */
    function _selectMenu(sKey) {

        oS.cur = sKey;

        // 사이드네비 선택 표시
        if (oUI.nav) {
            var aItems = oUI.nav.querySelectorAll(".u4aTplWiz__navItem");
            for (var i = 0; i < aItems.length; i++) {
                aItems[i].setAttribute("aria-selected", aItems[i].getAttribute("data-key") === sKey ? "true" : "false");
            }
        }

        // 본문 페이지 전환 (페이지 이동 애니메이션 .analy/16 §9)
        _navMainPage(sKey);

        // 프리뷰 이미지 갱신
        _updatePreviewForMenu(sKey);

        // 생성 버튼 표시 동기화 (해당 메뉴 섹션에 모델 로드됐을 때만)
        _syncCreateForMenu(sKey);
    }

    // 생성(완료) 버튼 표시 — 현재 메뉴 섹션에 모델정보가 로드됐을 때만(원본 CRBTN_VISI).
    function _syncCreateForMenu(sKey) {
        if (!oUI || !oUI.createBtn) { return; }
        var bShow = false;
        var cfg = oS.menuCfg && oS.menuCfg[sKey];
        if (cfg) { var sec = oS.sec[cfg.sid]; bShow = !!(sec && sec.model); }
        oUI.createBtn.hidden = !bShow;
    }

    // 메뉴 순서(전환 방향 판정 기준 — 원본 NavContainer page 순서)
    function _menuIndex(sKey) {
        for (var i = 0; i < oS.menu.length; i++) {
            if (oS.menu[i].key === sKey) { return i; }
        }
        return -1;
    }

    /* ==================================================================
     * 본문 페이지 전환 애니메이션 (.analy/16 §9, 공통 .u4aWsNav* 소비)
     *   원본 fnNavTo 구조 이식 — P13n 좌측패널(lf_showLeftPage)과 동일.
     *   메뉴 index 큰 쪽으로 이동=forward(우측 진입), 작은 쪽=back(좌측 진입).
     *   상주 페이지(hidden 토글) — 파괴 안 함(원본 NavContainer 동일).
     * ================================================================== */
    function _navMainPage(sKey) {
        if (!oUI || !oUI.pages) { return; }
        var oTo = oUI.pages[sKey];
        if (!oTo) { return; }
        var oFrom = oUI.curPage;

        // 최초 표시(나가는 페이지 없음) 또는 동일 페이지 → 애니메이션 없이 확정.
        if (!oFrom || oFrom === oTo) {
            for (var k in oUI.pages) {
                if (Object.prototype.hasOwnProperty.call(oUI.pages, k)) { oUI.pages[k].hidden = (oUI.pages[k] !== oTo); }
            }
            oUI.curPage = oTo;
            oUI.curPageKey = sKey;
            return;
        }

        var bFwd = _menuIndex(sKey) > _menuIndex(oUI.curPageKey);
        var sIn = bFwd ? "u4aWsNavInFwd" : "u4aWsNavInBack";
        var sOut = bFwd ? "u4aWsNavOutFwd" : "u4aWsNavOutBack";

        var gen = (oS._mainNavGen = (oS._mainNavGen || 0) + 1); // 연타 stale animationend 차단
        ["u4aWsNavInFwd", "u4aWsNavInBack", "u4aWsNavOutFwd", "u4aWsNavOutBack"].forEach(function (c) {
            oTo.classList.remove(c); oFrom.classList.remove(c);
        });

        oUI.main.classList.add("u4aTplWizNaving"); // 전환 중 두 페이지 겹침(absolute)
        oTo.hidden = false;
        oTo.classList.add(sIn);
        oFrom.classList.add(sOut);

        oUI.curPage = oTo;
        oUI.curPageKey = sKey;

        var _done = function (ev) {
            if (ev && ev.target !== oFrom) { return; } // 자식 animationend 무시
            oFrom.removeEventListener("animationend", _done);
            if (oS._mainNavGen !== gen) { return; }     // 더 최신 전환 시작됨 → 정리 취소
            oFrom.hidden = true;
            oFrom.classList.remove(sOut);
            oTo.classList.remove(sIn);
            oUI.main.classList.remove("u4aTplWizNaving");
        };
        oFrom.addEventListener("animationend", _done);
        setTimeout(_done, 400); // 폴백(prefers-reduced-motion=animation:none 시)
    }

    /* ==================================================================
     * 프리뷰 : 메뉴별 이미지 결정
     *   (원본 ev_sideNaviItemSelection 의 switch)
     * ================================================================== */
    function _updatePreviewForMenu(sKey) {
        switch (sKey) {
            case K_WZD1:
                if (oS.UICHOICE.T.sel) { _prevImage(oS.UICHOICE.T.sel); } else { _prevInit(); }
                break;
            case K_WZD2:
                if (oS.UICHOICE.S.sel) { _prevImage(oS.UICHOICE.S.sel); } else { _prevInit(); }
                break;
            case K_WZD3:
                _prevImage("ReportTemplate");
                break;
            case K_WZD4:
                _prevImage(K_WZD4); // u4aWsTmplWzd4.png
                break;
            default:
                _prevInit();
        }
    }

    /* ==================================================================
     * 프리뷰 이미지 표시 (P2) / 초기화 (P1)
     *   경로: images/wizard/{key}.png (원본 APPPATH/ws30/ws10_20/images/wizard)
     * ================================================================== */
    function _prevImage(sKey) {
        if (!oUI) { return; }
        if (!sKey) { _prevInit(); return; }
        oUI.prevImg.src = "images/wizard/" + sKey + ".png";
        oUI.prevEmpty.hidden = true;
        oUI.prevImgWrap.hidden = false;
    }
    function _prevInit() {
        if (!oUI) { return; }
        oUI.prevImg.removeAttribute("src");
        oUI.prevImgWrap.hidden = true;
        oUI.prevEmpty.hidden = false;
    }

    /* ==================================================================
     * 완료(생성) — Stage 4 에서 designWizardCallback 연결.
     * ================================================================== */
    function lf_onCreate() {
        // 현재 메뉴 섹션의 Complete → oComplete 구성 → designWizardCallback(생성 통합).
        //   (원본 ev_tmplWzdComplete : SELKEY 로 위자드별 Complete dispatch)
        var cfg = oS && oS.menuCfg && oS.menuCfg[oS.cur];
        if (!cfg) { return; }

        _busy(true);
        var oComplete = _wzComplete(cfg);
        if (!oComplete) { return; } // 검증 실패 — _wzComplete 가 메시지/busy 처리

        // Stage 4 : 생성 통합(ws_html5_ws20_wizard.js). 아직 미연결이면 무동작(대기).
        if (typeof oAPP.fn.designWizardCallback === "function") {
            oAPP.fn.designWizardCallback(oComplete, function (oRet) {
                _busy(false);
                if (oRet && oRet.SUBRC === "E") { _msg(10, "E", oRet.MSG); return; }
                if (oRet && oRet.MSG) { _msg(10, "S", oRet.MSG); }
                lf_close();
            });
        } else {
            _busy(false); // 생성 통합 미연결(Stage 4 예정)
        }
    }

    /* ==================================================================================
     * 위자드 섹션 (UI Choice → Model Select → 편집 테이블)
     *   원본 sap.m.Wizard(3 step) + sap.ui.table.Table → HTML5 로컬상태 + 수동렌더.
     *   WZD1(Table)/WZD2(Form)/WZD3(Report=Form+Table)에서 공용(cfg 로 파라미터화).
     *   cfg = { sid, menuKey, treeCapable, bindCardi, getItems(), getSel(), setSel(v) }
     * ================================================================================== */
    function _buildWizardSection(cfg) {

        var sec = {
            cfg: cfg,
            model: null,           // 선택 모델명(Bind 팝업)
            outab: [],             // 필드 정보(서버 T_OTAB, 각 row +UILIST)
            treevisi: false,       // TreeTable → Parent/Child 컬럼 표시
            treeflg: { bIsPChk: false, bIsCChk: false },
            els: { navSteps: [], navLbls: [], cards: [], cardHeads: [] }
        };
        oS.sec[cfg.sid] = sec;
        oS.menuCfg[cfg.menuKey] = cfg; // 푸터 생성 버튼 dispatch

        // 스텝 메타 (원본 sap.m.WizardStep title) — 동적 key 접미 포함.
        sec.steps = [
            { base: _cl("D77"), suffix: function () { var k = cfg.getSel(); return k ? " [ " + k + " ] " : ""; } }, // UI Choice
            { base: _cl("D66"), suffix: function () { return ""; } },                                                  // Model Select
            { base: _cl("D67"), suffix: function () { return sec.model ? " [ " + sec.model + " ] " : ""; } }           // Model Information
        ];

        var oWrap = _el("div", "u4aTplWiz__wz");

        /* ---- 진행 내비게이터 (원본 WizardProgressNavigator, 반응형) ----
         *   넓으면 full(전체 스텝+연결선), 좁으면 mini(현재 스텝 + 숫자버튼→팝오버). */
        var oNav = _el("div", "u4aTplWiz__wzNav");

        // full : 전체 스텝
        var oFull = _el("div", "u4aTplWiz__navFull");
        for (var i = 0; i < sec.steps.length; i++) {
            if (i > 0) { oFull.appendChild(_el("div", "u4aTplWiz__navConn")); }
            var oStep = _el("div", "u4aTplWiz__navStep");
            oStep.appendChild(_el("div", "u4aTplWiz__navNum", String(i + 1)));
            var oLbl = _el("span", "u4aTplWiz__navLbl");
            oStep.appendChild(oLbl);
            oStep.addEventListener("click", (function (idx) {
                return function () { _wzScrollToCard(sec, idx); };
            })(i));
            oFull.appendChild(oStep);
            sec.els.navSteps.push(oStep);
            sec.els.navLbls.push(oLbl);
        }
        oNav.appendChild(oFull);

        // mini(축소형) : 스텝을 "순서대로" 렌더(번호 원, 현재 스텝만 라벨 펼침).
        //   _wzSyncSteps 가 매번 채운다(현재/available 이 바뀌므로).
        var oMini = _el("div", "u4aTplWiz__navMini");
        oNav.appendChild(oMini);

        oWrap.appendChild(oNav);
        sec.els.nav = oNav;
        sec.els.navFull = oFull;
        sec.els.navMini = oMini;

        // 반응형 토글 — full 이 넘치면 mini 로. (페이지 표시/리사이즈에 반응)
        if (window.ResizeObserver) {
            try {
                sec.ro = new ResizeObserver(function () { _wzNavResize(sec); });
                sec.ro.observe(oNav);
            } catch (e) { }
        }

        /* ---- 스텝 카드 컨테이너 ---- */
        var oSteps = _el("div", "u4aTplWiz__steps");

        function _card(idx) {
            var oCard = _el("div", "u4aTplWiz__stepCard");
            var oHead = _el("div", "u4aTplWiz__cardHead");
            oCard.appendChild(oHead);
            var oBody = _el("div", "u4aTplWiz__cardBody");
            oCard.appendChild(oBody);
            sec.els.cards[idx] = oCard;
            sec.els.cardHeads[idx] = oHead;
            oSteps.appendChild(oCard);
            return oBody;
        }

        // Card 1 : UI Choice 콤보
        var oB1 = _card(0);
        var aItems = [{ value: "", text: "" }].concat(cfg.getItems().map(function (i) {
            return { value: i.OBJNM, text: i.OBJNM };
        }));
        var oCombo = U4AUI.createSelect(aItems, cfg.getSel() || "", function (v) { _wzOnChoice(cfg, v); }, {});
        oCombo.style.width = "100%";
        oCombo.style.maxWidth = "22rem"; // 반응형 — 넓으면 22rem, 좁으면 카드 폭 100%
        oB1.appendChild(oCombo);
        sec.els.combo = oCombo;

        // Card 2 : Model Select 버튼
        var oB2 = _card(1);
        var oBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aTplWiz__modelBtn");
        oBtn.type = "button";
        oBtn.innerHTML = _fa("table-list") + "<span></span>";
        oBtn.querySelector("span").textContent = _cl("D66"); // Model Select
        oBtn.addEventListener("click", function () { _wzModelSelect(cfg); });
        oB2.appendChild(oBtn);

        // Card 3 : Model Information 테이블
        var oB3 = _card(2);
        var oTblWrap = _el("div", "u4aTplWiz__tblWrap");
        oB3.appendChild(oTblWrap);
        sec.els.tableWrap = oTblWrap;

        oWrap.appendChild(oSteps);

        _wzSyncSteps(sec); // 초기 상태(Step1 만 available)
        return oWrap;
    }

    /* ---- 스텝 available/current 동기화 + 라벨 갱신 (원본 Wizard step 진행) ----
     *   available : step1=항상 / step2=UI Choice 선택됨 / step3=모델 로드됨.
     *   current   : available 중 가장 마지막(진행 위치). 카드 hidden = !available. */
    function _wzSyncSteps(sec) {
        var cfg = sec.cfg;
        var aAvail = [true, !!cfg.getSel(), !!sec.model];
        var iCur = 0;
        for (var i = 0; i < aAvail.length; i++) { if (aAvail[i]) { iCur = i; } }
        sec.avail = aAvail;
        sec.iCur = iCur;

        for (var j = 0; j < sec.steps.length; j++) {
            var sSuffix = sec.steps[j].suffix();
            var sBase = sec.steps[j].base;
            sec.els.navLbls[j].textContent = sBase + sSuffix;
            sec.els.cardHeads[j].textContent = (j + 1) + ". " + sBase + sSuffix;
            sec.els.cards[j].hidden = !aAvail[j];
            sec.els.navSteps[j].classList.toggle("is-avail", aAvail[j]);
            sec.els.navSteps[j].classList.toggle("is-current", j === iCur);
        }

        // mini(축소형) : 스텝을 "순서대로" 렌더(번호 원 + 현재 스텝만 라벨). 숫자 클릭→팝오버.
        //   ★번호 순서 유지(원본 WizardProgressNavigator) — 현재 스텝을 앞으로 빼지 않는다.
        sec.els.navMini.innerHTML = "";
        for (var k = 0; k < sec.steps.length; k++) {
            var oM = _el("div", "u4aTplWiz__navStep u4aTplWiz__navMiniStep");
            if (aAvail[k]) { oM.classList.add("is-avail"); }
            if (k === iCur) { oM.classList.add("is-current"); }
            oM.appendChild(_el("div", "u4aTplWiz__navNum", String(k + 1)));
            if (k === iCur) { oM.appendChild(_el("span", "u4aTplWiz__navLbl", sec.steps[k].base + sec.steps[k].suffix())); }
            oM.addEventListener("click", function (ev) { ev.stopPropagation(); _wzOpenStepPopover(sec, ev.currentTarget); });
            sec.els.navMini.appendChild(oM);
        }

        _wzNavResize(sec);
    }

    // 카드로 스크롤(available 일 때만) — full/mini/팝오버 공용.
    function _wzScrollToCard(sec, idx) {
        var c = sec.els.cards[idx];
        if (c && !c.hidden) { try { c.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { } }
    }

    // 반응형 : full 이 컨테이너를 넘치면 mini 로 전환(원본 WizardProgressNavigator collapse).
    function _wzNavResize(sec) {
        var oNav = sec.els.nav, oFull = sec.els.navFull;
        if (!oNav || !oFull || !document.body.contains(oNav)) { return; }
        oNav.classList.remove("is-collapsed");          // 측정 위해 full 표시
        if (oNav.clientWidth <= 0) { return; }          // 페이지 숨김 상태 — 표시 시 RO 재측정
        var bOver = oFull.scrollWidth > oFull.clientWidth + 1;
        oNav.classList.toggle("is-collapsed", bOver);
    }

    // 스텝 팝오버 (원본 narrow WizardProgressNavigator popover) — 전체 스텝 목록.
    function _wzOpenStepPopover(sec, oAnchor) {
        _wzClosePop(sec);

        var oPop = _el("div", "u4aTplWiz__navPop");
        for (var i = 0; i < sec.steps.length; i++) {
            var bAvail = !!(sec.avail && sec.avail[i]);
            var oRow = _el("div", "u4aTplWiz__navPopRow");
            if (i === sec.iCur) { oRow.classList.add("is-current"); }
            if (!bAvail) { oRow.classList.add("is-disabled"); }
            oRow.appendChild(_el("span", "u4aTplWiz__navPopNum", String(i + 1)));
            oRow.appendChild(_el("span", "u4aTplWiz__navPopLbl", sec.steps[i].base + sec.steps[i].suffix()));
            if (bAvail) {
                oRow.addEventListener("click", (function (idx) {
                    return function () { _wzClosePop(sec); _wzScrollToCard(sec, idx); };
                })(i));
            }
            oPop.appendChild(oRow);
        }

        // 모달 top-layer 안에 append(showModal 위 표시). 앵커 아래 위치.
        (oUI.dlg || document.body).appendChild(oPop);
        var r = oAnchor.getBoundingClientRect();
        oPop.style.left = Math.round(r.left) + "px";
        oPop.style.top = Math.round(r.bottom + 4) + "px";
        // 우측 넘침 보정.
        var pr = oPop.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8) {
            oPop.style.left = Math.round(Math.max(8, window.innerWidth - 8 - pr.width)) + "px";
        }

        sec.els.pop = oPop;
        // 바깥 클릭/스크롤/리사이즈 시 닫기.
        sec._popClose = function () { _wzClosePop(sec); };
        setTimeout(function () {
            document.addEventListener("mousedown", sec._popOutside = function (ev) {
                if (oPop.contains(ev.target)) { return; }
                _wzClosePop(sec);
            }, true);
        }, 0);
        window.addEventListener("resize", sec._popClose);
        var oScroller = sec.els.nav.closest(".u4aTplWiz__page");
        if (oScroller) { oScroller.addEventListener("scroll", sec._popClose, true); }
        sec._popScroller = oScroller;
    }

    function _wzClosePop(sec) {
        if (sec._popOutside) { try { document.removeEventListener("mousedown", sec._popOutside, true); } catch (e) { } sec._popOutside = null; }
        if (sec._popClose) { try { window.removeEventListener("resize", sec._popClose); } catch (e) { } if (sec._popScroller) { try { sec._popScroller.removeEventListener("scroll", sec._popClose, true); } catch (e) { } } sec._popClose = null; sec._popScroller = null; }
        if (sec.els && sec.els.pop) { try { sec.els.pop.remove(); } catch (e) { } sec.els.pop = null; }
    }

    // UI Choice 변경 (원본 ev_tmplWzd1SelectChangeEvent)
    function _wzOnChoice(cfg, key) {
        var sec = oS.sec[cfg.sid];
        cfg.setSel(key);

        // UI Choice 변경 = 위자드 초기화(원본 fnSetWizard1PopupInit) — 모델/테이블 리셋.
        sec.model = null;
        sec.outab = [];
        sec.treeflg = { bIsPChk: false, bIsCChk: false };
        sec.els.tableWrap.innerHTML = "";
        sec.treevisi = (cfg.treeCapable && key === "sap.ui.table.TreeTable");

        if (!key) { _prevInit(); }   // 미리보기 P1
        else { _prevImage(key); }    // 미리보기 이미지

        _wzSyncSteps(sec);           // 스텝 available/라벨 갱신 (step2 노출/숨김 포함)
        _syncCreateForMenu(oS.cur);
    }

    // Model Select 버튼 → Bind 팝업(모델 피커) 재사용 (원본 ev_tmplWzd1ModelSelectBtn)
    function _wzModelSelect(cfg) {
        var sel = cfg.getSel();
        if (!sel) { return; }
        var oItem = null, a = cfg.getItems();
        for (var i = 0; i < a.length; i++) { if (a[i].OBJNM === sel) { oItem = a[i]; break; } }
        var sUIFND = oItem ? oItem.UIFND : "";

        var run = function () {
            try {
                // 원본 fnBindPopupOpener(B24, "T"/"S", cb). HTML5 콜백 = (bIsBind, ls_tree, is_attr),
                //   선택 모델명 = ls_tree.CHILD.
                oAPP.fn.fnBindPopupOpen(_cl("B24"), cfg.bindCardi, function (bIsBind, oResult) {
                    if (!bIsBind || !oResult) { return; }
                    _wzLoadModel(cfg, oResult.CHILD, sUIFND);
                });
            } catch (e) { console.error("[HTML5][WS20][tplwiz] bind picker:", e && e.message ? e.message : e); }
        };
        if (typeof oAPP.fn.fnBindPopupOpen === "function") { run(); }
        else { try { oAPP.loadJs("fnBindPopupOpen", run); } catch (e) { console.error(e); } }
    }

    // 선택 모델의 필드정보 서버 조회 (원본 fnTmplWzd1ModelSelectPopupCallback + fnGetTmplWzd1ModelSuccess)
    function _wzLoadModel(cfg, sModel, sUIFND) {
        var sec = oS.sec[cfg.sid];
        if (!sModel) { return; }

        var oFormData = new FormData();
        oFormData.append("ACTCD", "WZD_GET_FLD_INFO");
        oFormData.append("MODEL", sModel);
        oFormData.append("CLSID", (oAPP.attr.appInfo && oAPP.attr.appInfo.CLSID) || "");
        oFormData.append("UIFND", sUIFND);

        _busy(true);
        sendAjax(oAPP.attr.servNm + "/ui_temp_wzd", oFormData, function (oRet) {
            _busy(false);
            if (!oRet || oRet.RETCD !== "S") { _msg(10, "E", (oRet && oRet.RTMSG) || ""); return; }

            var aDDLB = _wzDDLB(sUIFND);
            if (!aDDLB.length) { _msg(10, "E", _mw("347", _cl("D67"))); return; } // Model Information Not found.

            var aOut = oRet.T_OTAB || [];
            for (var i = 0; i < aOut.length; i++) { aOut[i].UILIST = aDDLB; }

            sec.model = sModel;
            sec.outab = aOut;
            _wzAllRowEnable(sec, true); // 전체 선택(원본 selectAll)

            _wzRenderTable(sec);
            _wzSyncSteps(sec);          // step3 노출 + 라벨(모델명) 갱신
            _syncCreateForMenu(oS.cur);

            // 모델 정보 스텝으로 스크롤 이동(원본 setCurrentStep STEP3)
            try { sec.els.cards[2].scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { }
        });
    }

    // UIFND 별 UI Type DDLB (원본 fnGetDDLBInfo — VAL4 === UIFND)
    function _wzDDLB(sUIFND) {
        var aAll = (oS.MASTER && oS.MASTER.T_UIDDLB) || [];
        var aOut = [];
        for (var i = 0; i < aAll.length; i++) {
            if (aAll[i].VAL4 === sUIFND) { aOut.push(aAll[i]); }
        }
        return aOut;
    }

    /* ---- 편집 테이블 렌더 (원본 fnGetModelInfoTable1 + 컬럼) ---- */
    function _wzRenderTable(sec) {
        var wrap = sec.els.tableWrap;
        wrap.innerHTML = "";

        var oTblWrap = _el("div", "u4a-table-wrap u4a-table-wrap--boxed");
        var oTbl = _el("table", "u4a-table u4aTplWiz__tbl");
        sec.els.tbl = oTbl;

        // 컬럼 폭 — sec.colW 에 영속(리사이즈/재렌더에도 유지). 최초/컬럼수 변동 시 기본폭.
        var iCols = sec.treevisi ? 10 : 8;
        if (!sec.colW || sec.colW.length !== iCols) { sec.colW = _wzDefaultColW(sec.treevisi); }

        var oCg = document.createElement("colgroup");
        sec.els.cols = [];
        var iSum = 0;
        for (var c = 0; c < sec.colW.length; c++) {
            var oCol = document.createElement("col");
            oCol.style.width = sec.colW[c] + "px";
            oCg.appendChild(oCol);
            sec.els.cols.push(oCol);
            iSum += sec.colW[c];
        }
        oTbl.appendChild(oCg);
        oTbl.style.minWidth = iSum + "px";

        var oThead = document.createElement("thead");
        var oTrH = document.createElement("tr");
        // 전체선택 체크박스
        var thChk = _el("th", "u4a-th u4aTplWiz__chkCol");
        var cbAll = document.createElement("input");
        cbAll.type = "checkbox";
        cbAll.addEventListener("change", function () { _wzSelectAll(sec, this.checked); });
        thChk.appendChild(cbAll);
        oTrH.appendChild(thChk);
        sec.els.headChk = cbAll;

        function th(sTxt) { var t = _el("th", "u4a-th", sTxt); oTrH.appendChild(t); }
        th(_cl("D68")); // Field Name
        if (sec.treevisi) { th(_cl("D69")); th(_cl("D70")); } // Is Parent / Is Child
        th(_cl("D71")); // Position (Order)
        th(_cl("D72")); // UI Type Select
        th(_cl("D73")); // Label Text
        th(_cl("D74")); // Field Type
        th(_cl("D75")); // Field Length
        th(_cl("D76")); // Conv. Routine
        oThead.appendChild(oTrH);
        oTbl.appendChild(oThead);

        // 컬럼 리사이즈 그립 (원본 바인딩 팝업 _buildColGrip 패턴)
        _wzAddColResize(sec, oTrH);

        var oTbody = document.createElement("tbody");
        for (var i = 0; i < sec.outab.length; i++) {
            oTbody.appendChild(_wzRow(sec, sec.outab[i]));
        }
        oTbl.appendChild(oTbody);
        oTblWrap.appendChild(oTbl);
        wrap.appendChild(oTblWrap);

        _wzSyncHeadChk(sec);
    }

    // 기본 컬럼폭(px) — 순서: chk, Field Name, [Parent, Child], Position, UI Type, Label, Field Type, Field Length, Conv.
    function _wzDefaultColW(bTree) {
        var w = [36, 200];
        if (bTree) { w.push(100, 100); }
        w.push(112, 208, 208, 150, 112, 150);
        return w;
    }

    // 컬럼 리사이즈 그립 (원본 바인딩 팝업 _buildColGrip 1:1 — 그립 드래그로 해당 col 폭 조절,
    //   body.u4a-dragging(iframe 위 끊김 방지), 더블클릭=기본폭 복귀). 마지막 컬럼 제외.
    function _wzAddColResize(sec, oTrH) {
        var aTh = oTrH.children;
        for (var i = 0; i < aTh.length - 1; i++) {
            aTh[i].style.position = "relative";
            aTh[i].appendChild(_wzColGrip(sec, i));
        }
    }
    function _wzColGrip(sec, idx) {
        var oGrip = _el("div", "u4aTplWiz__colGrip");
        oGrip.setAttribute("aria-hidden", "true");
        var bDrag = false, iStartX = 0, iStart0 = 0;
        function lf_move(e) {
            if (!bDrag) { return; }
            var w = Math.max(48, iStart0 + (e.clientX - iStartX));
            sec.colW[idx] = w;
            if (sec.els.cols[idx]) { sec.els.cols[idx].style.width = w + "px"; }
            _wzApplyTblMinW(sec);
        }
        function lf_up() {
            bDrag = false;
            document.body.classList.remove("u4a-dragging");
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oGrip.addEventListener("mousedown", function (e) {
            bDrag = true;
            iStartX = e.clientX;
            iStart0 = sec.colW[idx];
            document.body.classList.add("u4a-dragging");
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault();
            e.stopPropagation();
        });
        // 더블클릭 = 기본폭 복귀.
        oGrip.addEventListener("dblclick", function (e) {
            e.stopPropagation();
            sec.colW = _wzDefaultColW(sec.treevisi);
            for (var c = 0; c < sec.colW.length; c++) { if (sec.els.cols[c]) { sec.els.cols[c].style.width = sec.colW[c] + "px"; } }
            _wzApplyTblMinW(sec);
        });
        return oGrip;
    }
    function _wzApplyTblMinW(sec) {
        var s = 0;
        for (var i = 0; i < sec.colW.length; i++) { s += sec.colW[i]; }
        if (sec.els.tbl) { sec.els.tbl.style.minWidth = s + "px"; }
    }

    function _wzRow(sec, r) {
        var tr = document.createElement("tr");
        var bEn = (r.enabled === true);

        // 행 선택 체크박스
        var tdC = _el("td", "u4aTplWiz__chkCol");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = bEn;
        cb.addEventListener("change", function () { _wzRowSelect(sec, r, this.checked); });
        tdC.appendChild(cb);
        tr.appendChild(tdC);

        tr.appendChild(_wzTextTd(r.FNAME)); // Field Name

        if (sec.treevisi) {
            tr.appendChild(_wzChkTd(r.PARENT === "X", r.enabled_pchk !== false, function (b) { _wzParentChk(sec, r, b); }));
            tr.appendChild(_wzChkTd(r.CHILD === "X", r.enabled_cchk !== false, function (b) { _wzChildChk(sec, r, b); }));
        }

        // Position (숫자)
        var tdP = document.createElement("td");
        var fP = U4AUI.createField({
            type: "text", value: (r.POSIT != null ? r.POSIT : ""), disabled: !bEn,
            onChange: function (v) { r.POSIT = parseInt(v, 10) || 0; }
        });
        tdP.appendChild(fP.el);
        tr.appendChild(tdP);

        // UI Type Select
        var tdU = document.createElement("td");
        var aUi = (r.UILIST || []).map(function (u) { return { value: u.VAL1, text: u.VAL1 }; });
        var fU = U4AUI.createField({
            type: "select", items: aUi, value: r.UITYP || "", disabled: !bEn,
            onChange: function (v) { r.UITYP = v; }
        });
        tdU.appendChild(fU.el);
        tr.appendChild(tdU);

        // Label Text
        var tdL = document.createElement("td");
        var fL = U4AUI.createField({
            type: "text", value: r.FTEXT || "", disabled: !bEn,
            onChange: function (v) { r.FTEXT = v; }
        });
        tdL.appendChild(fL.el);
        tr.appendChild(tdL);

        tr.appendChild(_wzTextTd(r.FTYPE)); // Field Type
        tr.appendChild(_wzTextTd(r.FLEN));  // Field Length
        tr.appendChild(_wzTextTd(r.CONVE)); // Conv. Routine
        return tr;
    }

    function _wzTextTd(v) {
        var t = document.createElement("td");
        t.textContent = (v == null ? "" : String(v));
        return t;
    }
    function _wzChkTd(bChecked, bEnabled, fn) {
        var td = _el("td", "u4aTplWiz__chkCol");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!bChecked;
        cb.disabled = !bEnabled;
        cb.addEventListener("change", function () { fn(this.checked); });
        td.appendChild(cb);
        return td;
    }

    function _wzSyncHeadChk(sec) {
        var cb = sec.els.headChk;
        if (!cb) { return; }
        var n = sec.outab.length, s = 0;
        for (var i = 0; i < n; i++) { if (sec.outab[i].enabled === true) { s++; } }
        cb.checked = (n > 0 && s === n);
        cb.indeterminate = (s > 0 && s < n);
        cb.disabled = (n === 0);
    }

    /* ---- 행 enable/선택 (원본 fnSetTmplWzd1TableAllRowEnable / RowSelection) ---- */
    function _wzAllRowEnable(sec, bAll) {
        for (var i = 0; i < sec.outab.length; i++) {
            var r = sec.outab[i];
            r.enabled = bAll;
            if (sec.treevisi) {
                r.enabled_pchk = bAll;
                r.enabled_cchk = bAll;
                r.PARENT = "";
                r.CHILD = "";
            }
        }
        sec.treeflg = { bIsPChk: false, bIsCChk: false };
    }

    function _wzSelectAll(sec, bAll) {
        _wzAllRowEnable(sec, bAll);
        _wzRenderTable(sec);
    }

    function _wzRowSelect(sec, r, bSel) {
        r.enabled = bSel;

        if (!sec.treevisi) { _wzRenderTable(sec); return; }

        if (bSel) {
            r.enabled_pchk = true;
            r.enabled_cchk = true;
            if (sec.treeflg.bIsPChk === true) { r.enabled_pchk = false; }
            if (sec.treeflg.bIsCChk === true) { r.enabled_cchk = false; }
            _wzRenderTable(sec);
            return;
        }
        // 선택 해제
        r.enabled_pchk = false;
        r.enabled_cchk = false;
        var flg = { bIsPChk: false, bIsCChk: false };
        if (r.PARENT === "X") { flg.bIsPChk = false; _wzParentWithoutMe(sec, true, r); }
        if (r.CHILD === "X") { flg.bIsCChk = false; _wzChildWithoutMe(sec, true, r); }
        sec.treeflg = flg;
        _wzRenderTable(sec);
    }

    /* ---- Parent/Child 상호배타 (원본 ev_tmplWzd1TreeTable*Chkbox + WithoutMe) ---- */
    function _wzParentWithoutMe(sec, bEnabled, me) {
        for (var i = 0; i < sec.outab.length; i++) {
            var r = sec.outab[i];
            if (r.enabled === false) { continue; }
            if (sec.treeflg.bIsCChk === true && r.enabled_cchk === true) { continue; }
            if (r.FNAME === me.FNAME) { continue; }
            r.enabled_pchk = bEnabled;
        }
    }
    function _wzChildWithoutMe(sec, bEnabled, me) {
        for (var i = 0; i < sec.outab.length; i++) {
            var r = sec.outab[i];
            if (r.enabled === false) { continue; }
            if (sec.treeflg.bIsPChk === true && r.enabled_pchk === true) { continue; }
            if (r.FNAME === me.FNAME) { continue; }
            r.enabled_cchk = bEnabled;
        }
    }
    function _wzParentChk(sec, r, bSel) {
        sec.treeflg.bIsPChk = bSel;
        r.PARENT = (bSel ? "X" : "");
        _wzParentWithoutMe(sec, !bSel, r);
        if (bSel) {
            if (r.CHILD === "X") { r.CHILD = ""; }
            r.enabled_cchk = false;
        } else if (r.enabled_cchk === false && sec.treeflg.bIsCChk === false) {
            r.enabled_cchk = true;
        }
        _wzRenderTable(sec);
    }
    function _wzChildChk(sec, r, bSel) {
        sec.treeflg.bIsCChk = bSel;
        r.CHILD = (bSel ? "X" : "");
        _wzChildWithoutMe(sec, !bSel, r);
        if (bSel) {
            if (r.PARENT === "X") { r.PARENT = ""; }
            r.enabled_pchk = false;
        } else if (r.enabled_pchk === false && sec.treeflg.bIsPChk === false) {
            r.enabled_pchk = true;
        }
        _wzRenderTable(sec);
    }

    /* ---- Complete → oComplete (원본 ev_tmplWzd1Complete) ---- */
    function _wzComplete(cfg) {
        var sec = oS.sec[cfg.sid];
        var rows = [];
        for (var i = 0; i < sec.outab.length; i++) { if (sec.outab[i].enabled === true) { rows.push(sec.outab[i]); } }

        if (rows.length <= 0) {
            _msg(10, "E", _mw("268")); // Selected line does not exists.
            _busy(false);
            return null;
        }

        var sUi = cfg.getSel();
        if (sec.treevisi) {
            // TreeTable → Parent, Child 필수(원본 fnCheckValidTmplWzd1TreeTable)
            var bP = false, bC = false;
            for (var j = 0; j < rows.length; j++) { if (rows[j].PARENT === "X") { bP = true; } if (rows[j].CHILD === "X") { bC = true; } }
            if (!bP || !bC) {
                _msg(10, "E", _mw("050", _cl("B76") + ", " + _cl("B77"))); // & is required.
                _busy(false);
                return null;
            }
        } else {
            rows = rows.slice().sort(function (a, b) { return (a.POSIT - b.POSIT); });
        }

        return {
            uName: sUi,                                   // UI 종류 (sap.m.Table..)
            mName: sec.model,                             // 모델명
            selTab: rows,                                 // 선택 필드
            uiDDLB: (oS.MASTER && oS.MASTER.T_UIDDLB) || [] // UI Type DDLB
        };
    }

    /* ==================================================================
     * 닫기 (원본 pressUiTempWizardDialogClose + afterClose 초기화)
     * ================================================================== */
    function lf_close() {
        // 위자드 섹션 정리 — ResizeObserver + 열린 팝오버.
        try {
            if (oS && oS.sec) {
                for (var sid in oS.sec) {
                    if (!Object.prototype.hasOwnProperty.call(oS.sec, sid)) { continue; }
                    var s = oS.sec[sid];
                    _wzClosePop(s);
                    if (s.ro) { try { s.ro.disconnect(); } catch (e) { } s.ro = null; }
                }
            }
        } catch (e) { }
        // 리사이즈 재클램프 리스너 정리 (§4.3).
        try { window.removeEventListener("resize", lf_clampSplit); } catch (e) { }
        try { if (oUI && oUI.ro) { oUI.ro.disconnect(); oUI.ro = null; } } catch (e) { }
        // dlg.close() 만 — 공통 _installGlobalDialogClose 가 DOM 제거(§2.2). 다음 열기=재build.
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
        // 원본 ev_UiTempWizardAfterClose : 상태 초기화
        oS = null;
    }

    /* ==================================================================
     * 좌우 스플리터 (§4.3) — 공통 .u4a-splitter__bar 소비.
     *   · 드래그 = 인접 두 패널(좌 px 고정 / 우 flex 잔여) 재분배, min-width 클램프.
     *     좌측=px 인라인, 우측=flex:1 1 auto 잔여(마지막 유연 패널 보호).
     *   · iframe 위 드래그 끊김/더블클릭 최초폭 복귀 = 공통 전역 자동
     *     (body.u4a-dragging + _installGlobalSplitterReset). 화면 배선 불필요.
     *   · 창 리사이즈 재클램프(필수) = px 고정 좌패널이 축소 컨테이너를 넘쳐
     *     overflow:hidden 에 우패널/바가 잘리는 것 방지. 리스너 1벌.
     *   레퍼런스: fnP13nDesignPopupOpen.js lf_wireSplitters / lf_clampSplit.
     * ================================================================== */
    function _wireSplitter() {
        var oBar = oUI.bar;
        var bDrag = false;

        oBar.addEventListener("mousedown", function (ev) {
            if (ev.button !== 0) { return; }
            bDrag = true;
            try { document.body.classList.add("u4a-dragging"); } catch (e) { }
            ev.preventDefault();
        });
        document.addEventListener("mousemove", function (ev) {
            if (!bDrag) { return; }
            var r = oUI.body.getBoundingClientRect();
            if (r.width <= 0) { return; }
            var px = ev.clientX - r.left;
            var iMax = r.width - C_BAR_W - _paneMin(oUI.right);
            px = Math.max(_paneMin(oUI.left), Math.min(iMax, px));
            oUI.left.style.flex = "0 0 " + Math.round(px) + "px";
        });
        document.addEventListener("mouseup", function () {
            if (bDrag) {
                bDrag = false;
                try { document.body.classList.remove("u4a-dragging"); } catch (e) { }
            }
        });

        // 창 리사이즈 재클램프 (§4.3 필수) — 리스너 1벌.
        window.removeEventListener("resize", lf_clampSplit);
        window.addEventListener("resize", lf_clampSplit);
        if (window.ResizeObserver) {
            try {
                oUI.ro = new ResizeObserver(function () { lf_clampSplit(); });
                oUI.ro.observe(oUI.body);
            } catch (e) { }
        }
    }

    /* ==================================================================
     * 창/다이얼로그 리사이즈 재클램프 (§4.3 필수) — px 고정 좌패널만 처리.
     * ================================================================== */
    function lf_clampSplit() {
        if (!oUI || !oUI.body || !document.body.contains(oUI.body)) { return; }
        var w = oUI.body.clientWidth;
        if (w <= 0) { return; }
        var l = parseFloat(oUI.left.style.flexBasis);
        if (isFinite(l)) {
            var lMax = w - C_BAR_W - _paneMin(oUI.right);
            if (l > lMax) { oUI.left.style.flex = "0 0 " + Math.round(Math.max(_paneMin(oUI.left), lMax)) + "px"; }
        }
    }

    /* ==================================================================
     * 유틸
     * ================================================================== */
    function _findMenu(sKey) {
        if (!oS || !oS.menu) { return null; }
        for (var i = 0; i < oS.menu.length; i++) {
            if (oS.menu[i].key === sKey) { return oS.menu[i]; }
        }
        return null;
    }

    // 패널 min-width(px) — 스플리터 클램프용(§4.3, 폴백 120).
    function _paneMin(oEl) {
        try {
            var v = parseFloat(getComputedStyle(oEl).minWidth);
            if (isFinite(v) && v > 0) { return v; }
        } catch (e) { }
        return 120;
    }

    /* ==================================================================
     * 스코프 스타일 (화면 전용 .u4aTplWiz* — 공통 오버라이드 아님)
     *   색/그림자/보더는 공통 토큰만 사용(하드코딩 hex 금지).
     * ================================================================== */
    function lf_ensureStyle() {
        if (document.getElementById("u4aTplWizStyle")) { return; }
        var css = [
            /* 대형 다이얼로그 — 화면의 80% 기준 (드래그/리사이즈로 조절 가능) */
            ".u4aTplWiz{width:80vw;height:80vh;max-width:96vw;max-height:92vh;padding:0;display:flex;flex-direction:column;}",
            ".u4aTplWiz .u4a-dialog__body{flex:1 1 auto;min-height:0;display:flex;flex-direction:row;padding:0;overflow:hidden;}",
            /* 좌측 프리뷰 (surface 배경 + 상단 밴드로 영역 구분, min-width=스플리터 클램프 기준) */
            ".u4aTplWiz__left{flex:0 0 40%;min-width:14rem;display:flex;flex-direction:column;overflow:hidden;background:var(--surface);}",
            ".u4aTplWiz__paneHead{flex:0 0 auto;height:2.5rem;display:flex;align-items:center;padding:0 .75rem;font-weight:600;color:var(--text);background:var(--surface-raised);border-bottom:.0625rem solid var(--line);box-sizing:border-box;}",
            ".u4aTplWiz__prev{flex:1 1 auto;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:auto;padding:1rem;}",
            ".u4aTplWiz__prevEmpty{display:flex;flex-direction:column;align-items:center;gap:.75rem;color:var(--text-muted);}",
            ".u4aTplWiz__prevEmpty i{font-size:2.75rem;opacity:.5;}",
            ".u4aTplWiz__prevImgWrap{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}",
            ".u4aTplWiz__prevImg{max-width:100%;max-height:100%;object-fit:contain;}",
            /* [hidden] 함정: author display(flex/inline-flex) 가 UA [hidden]{display:none} 를
               이김 → 팝업 스코프 전체 명시 override (프리뷰 P1/P2 · 생성버튼 CRBTN_VISI 등) */
            ".u4aTplWiz [hidden]{display:none!important;}",
            /* 우측 (min-width = 스플리터 클램프 기준; 바는 공통 .u4a-splitter__bar 그대로) */
            ".u4aTplWiz__right{flex:1 1 auto;min-width:22rem;display:flex;flex-direction:row;overflow:hidden;}",
            ".u4aTplWiz__nav{flex:0 0 clamp(13rem,26%,17rem);min-width:13rem;overflow:auto;border-right:.0625rem solid var(--line);padding:.375rem 0;background:var(--surface);}",
            ".u4aTplWiz__navIco{margin-right:.5rem;width:1rem;text-align:center;}",
            ".u4aTplWiz__navIco--on{color:var(--success);}",
            ".u4aTplWiz__navIco--off{color:var(--text-muted);opacity:.5;}",
            /* 본문 = 상주 4페이지(원본 NavContainer). position:relative + 전환 중 겹침(absolute). */
            ".u4aTplWiz__main{flex:1 1 auto;min-width:0;position:relative;display:flex;flex-direction:column;overflow:hidden;}",
            ".u4aTplWiz__mpage{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;}",
            ".u4aTplWiz__main.u4aTplWizNaving > .u4aTplWiz__mpage{position:absolute;inset:0;}",
            ".u4aTplWiz__mainHead{flex:0 0 auto;height:2.5rem;display:flex;align-items:center;padding:0 1rem;font-weight:600;color:var(--text);background:var(--surface-raised);border-bottom:.0625rem solid var(--line);box-sizing:border-box;}",
            ".u4aTplWiz__page{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0;}",
            ".u4aTplWiz__note{display:flex;align-items:center;gap:.5rem;color:var(--text-muted);padding:1rem;}",
            ".u4aTplWiz__note i{font-size:1.25rem;opacity:.6;}",
            /* 위자드 (원본 sap.m.Wizard) — 진행 내비게이터(스티키) + 번호 스텝 카드 */
            ".u4aTplWiz__wz{display:flex;flex-direction:column;min-height:100%;}",
            ".u4aTplWiz__wzNav{position:sticky;top:0;z-index:2;display:flex;align-items:center;padding:.75rem 1.25rem;background:var(--surface);border-bottom:.0625rem solid var(--line);}",
            ".u4aTplWiz__navFull{display:flex;align-items:center;flex:1 1 auto;min-width:0;overflow:hidden;}",
            ".u4aTplWiz__navMini{display:none;align-items:center;flex:1 1 auto;min-width:0;gap:.625rem;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navFull{display:none;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navMini{display:flex;}",
            ".u4aTplWiz__navMiniStep{cursor:pointer;min-width:0;flex:0 1 auto;}",
            ".u4aTplWiz__navMiniStep.is-current{min-width:0;flex:1 1 auto;}",
            ".u4aTplWiz__navStep{display:flex;align-items:center;gap:.5rem;color:var(--text-muted);flex:0 0 auto;min-width:0;}",
            ".u4aTplWiz__navNum{width:1.75rem;height:1.75rem;border-radius:50%;border:.125rem solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.8125rem;background:var(--surface);flex:0 0 auto;box-sizing:border-box;}",
            ".u4aTplWiz__navLbl{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".u4aTplWiz__navStep.is-avail{color:var(--text);cursor:pointer;}",
            ".u4aTplWiz__navStep.is-avail .u4aTplWiz__navNum{border-color:var(--accent);color:var(--accent);}",
            ".u4aTplWiz__navStep.is-current .u4aTplWiz__navNum{background:var(--accent);border-color:var(--accent);color:#fff;}",
            ".u4aTplWiz__navConn{flex:1 1 auto;height:.0625rem;background:var(--line);margin:0 1rem;min-width:1.5rem;}",
            /* 스텝 팝오버(반응형 축소 시 숫자버튼→목록) — 모달 top-layer 안 append */
            ".u4aTplWiz__navPop{position:fixed;z-index:5;min-width:12rem;background:var(--surface-raised);border:.0625rem solid var(--line);border-radius:var(--radius);box-shadow:var(--popover-shadow);padding:.25rem;}",
            ".u4aTplWiz__navPopRow{display:flex;align-items:center;gap:.5rem;padding:.375rem .625rem;border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap;color:var(--text);}",
            ".u4aTplWiz__navPopRow:hover{background:var(--hover-bg);}",
            ".u4aTplWiz__navPopRow.is-current{color:var(--accent);font-weight:600;}",
            ".u4aTplWiz__navPopRow.is-disabled{color:var(--text-muted);opacity:.5;cursor:default;}",
            ".u4aTplWiz__navPopRow.is-disabled:hover{background:none;}",
            ".u4aTplWiz__navPopNum{width:1.5rem;height:1.5rem;border-radius:50%;border:.125rem solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:600;flex:0 0 auto;box-sizing:border-box;}",
            ".u4aTplWiz__navPopRow.is-current .u4aTplWiz__navPopNum{background:var(--accent);border-color:var(--accent);color:#fff;}",
            ".u4aTplWiz__steps{display:flex;flex-direction:column;gap:1rem;padding:1.25rem;}",
            /* scroll-margin-top = 스티키 진행바 높이 여유 → 스텝 이동 시 카드 제목이 진행바에 안 가려짐 */
            ".u4aTplWiz__stepCard{background:var(--surface-raised);border:.0625rem solid var(--line);border-radius:var(--radius);padding:1rem 1.25rem;scroll-margin-top:4rem;box-sizing:border-box;max-width:100%;}",
            ".u4aTplWiz__cardHead{font-weight:700;font-size:.9375rem;margin-bottom:.875rem;color:var(--text);}",
            ".u4aTplWiz__cardBody{min-width:0;}",
            /* 반응형 — 좁은 폭에서 패딩 축소(고정 px 폭 지양, .analy 12 §7) */
            "@media (max-width:52rem){.u4aTplWiz__steps{padding:.75rem;}.u4aTplWiz__wzNav{padding:.5rem .75rem;}.u4aTplWiz__stepCard{padding:.75rem .875rem;}.u4aTplWiz__mainHead,.u4aTplWiz__paneHead{padding-left:.75rem;padding-right:.75rem;}}",
            ".u4aTplWiz__tblWrap{width:100%;max-width:100%;overflow-x:auto;}",
            /* 컬럼 폭 보장 — colgroup 고정폭 + 테이블 min-width, 좁으면 tblWrap 가로 스크롤 */
            ".u4aTplWiz__tbl{width:100%;}",
            ".u4aTplWiz__tbl th,.u4aTplWiz__tbl td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".u4aTplWiz__tbl td{padding:.1875rem .375rem;vertical-align:middle;}",
            /* 세로 컬럼 구분선 (원본 sap.ui.table.Table 셀 보더) — 마지막 컬럼 제외 */
            ".u4aTplWiz__tbl tbody td{border-right:.0625rem solid var(--line);}",
            ".u4aTplWiz__tbl tbody td:last-child{border-right:none;}",
            /* 헤더 th = static — sticky+collapse 에서 우측 보더 미렌더(Chromium) 회피 + 진행바 sticky 와 충돌 방지.
               static 이면 border-right 가 바디 border 와 같은 컬럼 경계에서 정확히 정렬된다. */
            ".u4aTplWiz__tbl thead th{position:static;border-right:.0625rem solid var(--line);}",
            ".u4aTplWiz__tbl thead th:last-child{border-right:none;}",
            /* 컬럼 리사이즈 그립 (원본 바인딩 팝업 .u4aBindColGrip) — 컬럼 우측 경계에 절대배치 */
            ".u4aTplWiz__colGrip{position:absolute;top:0;bottom:0;right:-0.1875rem;width:0.4375rem;cursor:col-resize;z-index:2;}",
            ".u4aTplWiz__tbl .u4a-field,.u4aTplWiz__tbl .u4a-combo{margin:0;width:100%;}",
            /* 체크박스 컬럼 halign=center — 공통 .u4a-table thead th{text-align:left} 를 이기게 th/td.chkCol 특이도로 */
            ".u4aTplWiz__tbl th.u4aTplWiz__chkCol,.u4aTplWiz__tbl td.u4aTplWiz__chkCol{width:2.25rem;text-align:center;padding-left:0;padding-right:0;}",
            ".u4aTplWiz__tbl .u4aTplWiz__chkCol input{margin:0;vertical-align:middle;}",
            /* 비활성 콤보(행 미선택 시 UI Type) — createSelect 는 aria-disabled 만 세팅 → 입력 차단 */
            ".u4aTplWiz .u4a-combo[aria-disabled=\"true\"]{pointer-events:none;opacity:.55;}",
            /* 푸터 */
            ".u4aTplWiz__footer{flex:0 0 auto;}",
            ".u4aTplWiz__footer .u4a-btn span{margin-left:.375rem;}"
        ].join("\n");
        var oStyle = document.createElement("style");
        oStyle.id = "u4aTplWizStyle";
        oStyle.textContent = css;
        document.head.appendChild(oStyle);
    }

})(window, window.jQuery, window.oAPP);
