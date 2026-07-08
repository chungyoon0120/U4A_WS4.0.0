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
    // 원본 MessageToast 대응 — 자동 사라짐·버튼 없음·중앙. 공통 .u4a-toast 스타일을 소비하되,
    //   위자드가 showModal(top-layer) 이라 body 토스트는 뒤로 가려짐(§2.10) → 위자드 다이얼로그 "안"에
    //   append 해 top-layer 안에서 모달 위에 표시(공통 툴팁이 모달 안에 붙는 것과 동일 사상).
    function _alert(sType, sMsg) {
        try {
            if (oUI && oUI.dlg && document.body.contains(oUI.dlg)) {
                var oT = oUI.dlg.querySelector(".u4aTplWizToast");
                if (!oT) {
                    oT = _el("div", "u4a-toast u4aTplWizToast");
                    oT.setAttribute("role", "alert");
                    oUI.dlg.appendChild(oT);
                }
                oT.textContent = sMsg || "";
                oT.setAttribute("data-show", "true");
                clearTimeout(oUI._toastT);
                oUI._toastT = setTimeout(function () { try { oT.setAttribute("data-show", "false"); } catch (e) { } }, 3000);
                return;
            }
        } catch (e) { }
        _msg(10, sType, sMsg); // 폴백(다이얼로그 부재 시 공통 토스트)
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
            menuCfg: {}, // 메뉴키 -> 섹션 cfg (푸터 생성 버튼 dispatch)
            navs: []     // 진행 내비게이터 목록(섹션 자체 + WZD3 통합) — lf_close 정리 대상
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
        } else if (m.key === K_WZD2) {
            // Stage 3 : Forms Ui Create 위자드 (트리 없음, UICHOICE.S) — WZD1 표준 재사용
            oPage.appendChild(_buildWizardSection({
                sid: "WZD2",
                menuKey: K_WZD2,
                treeCapable: false,       // Form 은 TreeTable 없음(Parent/Child 컬럼 없음)
                bindCardi: "S",           // 구조(Structure) cardinality
                getItems: function () { return oS.UICHOICE.S.ITEM; },
                getSel: function () { return oS.UICHOICE.S.sel; },
                setSel: function (v) { oS.UICHOICE.S.sel = v; }
            }));
        } else if (m.key === K_WZD3) {
            // Stage 3 : Report Template = 원본 단일 sap.m.Wizard 6스텝.
            //   Form(3): Form UI 선택(D78)/모델선택(D79)/모델정보(D80) — UICHOICE.S / selS.
            //   Table(3): Table UI 선택(D84)/모델선택(D81)/모델정보(D82) — UICHOICE.T / selT(트리).
            //   진행 내비게이터는 두 섹션을 통합한 1개(6스텝). 프리뷰는 메뉴(ReportTemplate) 고정 → noPreview.
            var oWz3 = _el("div", "u4aTplWiz__wz3");

            var oCardsF = _buildWizardSection({
                sid: "WZD3F", menuKey: "WZD3F", treeCapable: false, bindCardi: "S", noPreview: true,
                sharedNav: true, numOffset: 0,
                stepTitles: [_cl("D78"), _cl("D79"), _cl("D80")], // Form UI Choice / Model Select / Model Information
                getItems: function () { return oS.UICHOICE.S.ITEM; },
                getSel: function () { return oS.UICHOICE.A.selS; },
                setSel: function (v) { oS.UICHOICE.A.selS = v; }
            });
            var oCardsT = _buildWizardSection({
                sid: "WZD3T", menuKey: "WZD3T", treeCapable: true, bindCardi: "T", noPreview: true,
                sharedNav: true, numOffset: 3,
                stepTitles: [_cl("D84"), _cl("D81"), _cl("D82")], // Table UI Choice / Model Select / Model Information
                getItems: function () { return oS.UICHOICE.T.ITEM; },
                getSel: function () { return oS.UICHOICE.A.selT; },
                setSel: function (v) { oS.UICHOICE.A.selT = v; }
            });

            var secF = oS.sec.WZD3F, secT = oS.sec.WZD3T;
            secT.gate = function () { return !!secF.model; }; // 원본: Table 스텝은 Form 모델 로드 후 진입

            // 통합 진행 내비게이터(6스텝) — Form 3 + Table(게이트) 3.
            var oSharedNav = _buildNav(function () {
                var a = _navStepsForSec(secF, true).concat(_navStepsForSec(secT, !!secF.model));
                _navMarkCurrent(a);
                return a;
            });
            secF.shared = oSharedNav; secT.shared = oSharedNav; // _wzSyncSteps 갱신 대상
            oS.sharedNav = { nav: oSharedNav, secs: [secF, secT] }; // 형제 카드 재게이트 대상

            oWz3.appendChild(oSharedNav.els.nav);
            oWz3.appendChild(oCardsF);
            oWz3.appendChild(oCardsT);
            oPage.appendChild(oWz3);

            _wzSyncSteps(secF); _wzSyncSteps(secT); // 카드 게이트 + 통합 내비 초기 반영
        } else if (m.key === K_WZD4) {
            // WZD4 : 임베드 모듈(conversionWebdynpro)이 순수 UI5·미변환 → 준비중 안내.
            // TODO(i18n): 안내 문구 메시지 키 수집 필요(현재 임시 KO/EN 하드코딩).
            var oNote = _el("div", "u4aTplWiz__note");
            oNote.innerHTML = _fa("screwdriver-wrench") + "<span></span>";
            oNote.querySelector("span").textContent = "Web Dynpro Conversion 화면은 준비 중입니다.";
            oPage.appendChild(oNote);
        }
        // else (WZD2/WZD3): Stage 3 에서 위자드 스텝 UI 로 채움.

        // ★스크롤 하단 가상 여백 — 스텝 클릭 시 마지막 섹션도 페이지 최상단으로 올라오게(그 아래 스크롤 공간 확보).
        //   높이 = 페이지 높이 − 마지막 보이는 카드 높이(그만큼 뒤에 여백 → 마지막 카드가 top 까지 도달).
        //   페이지 크기·콘텐츠(카드 등장/테이블 로드) 변화에 ResizeObserver 로 재계산.
        var oPad = _el("div", "u4aTplWiz__scrollPad");
        oPad.setAttribute("aria-hidden", "true");
        oPage.appendChild(oPad);
        oPage.__pad = oPad;
        if (window.ResizeObserver) {
            try {
                var oContent = oPage.firstElementChild; // wz/wz3/note (pad 앞)
                var roPad = new ResizeObserver(function () { _updateScrollPad(oPage); });
                roPad.observe(oPage);
                if (oContent) { roPad.observe(oContent); }
                oPg.__ro = roPad; // 정리 대상: oUI.pages[key] = oPg (외부 래퍼)
            } catch (e) { }
        }

        // ★스크롤스파이 — 스크롤하면 최상단에 걸린 섹션 카드에 맞춰 진행바 선택 표시(nav.selIdx)를 따라 이동.
        //   (스텝 클릭/자동스크롤의 부드러운 스크롤 중에도 선택이 함께 움직인다). rAF 스로틀.
        oPage.addEventListener("scroll", function () {
            if (oPage.__spyRaf) { return; }
            oPage.__spyRaf = requestAnimationFrame(function () { oPage.__spyRaf = 0; _scrollSpy(oPage); });
        }, { passive: true });

        oPg.appendChild(oPage);
        return oPg;
    }

    // 스크롤스파이 — 스크롤 컨테이너(page) 최상단(스티키 진행바 아래)에 걸린 스텝 카드를 찾아 그 스텝을 진행바 current 로.
    function _scrollSpy(oPage) {
        if (!oPage || !document.body.contains(oPage)) { return; }
        var oNavEl = oPage.querySelector(".u4aTplWiz__wzNav");
        var iNavH = oNavEl ? oNavEl.offsetHeight : 0;
        // 활성 기준선 — 카드 scroll-margin-top(4rem=64px, 스크롤 도착 위치)보다 살짝 아래여야 도착 카드가 선택된다.
        var iLine = oPage.getBoundingClientRect().top + Math.max(iNavH, 56) + 16;
        var aCards = oPage.querySelectorAll(".u4aTplWiz__stepCard");
        var oActive = null;
        for (var i = 0; i < aCards.length; i++) {
            if (aCards[i].hidden) { continue; }
            var iTop = aCards[i].getBoundingClientRect().top;
            if (iTop <= iLine + 2) { oActive = aCards[i]; }   // 기준선 위/근처면 후보(더 아래로 갈수록 마지막이 현재)
            else if (oActive) { break; }                       // 기준선 아래 카드 도달 → 확정
        }
        if (!oActive) { // 맨 위 : 첫 보이는 카드
            for (var j = 0; j < aCards.length; j++) { if (!aCards[j].hidden) { oActive = aCards[j]; break; } }
        }
        if (!oActive || !oActive.__sec) { return; }
        var sec = oActive.__sec, nav = sec.nav || sec.shared;
        if (!nav) { return; }
        var idx = oActive.__local + (sec.cfg.numOffset || 0);
        if (nav.selIdx !== idx) { nav.selIdx = idx; _syncNav(nav); } // 스크롤 위치의 스텝을 선택 표시
    }

    // 스크롤 하단 가상 여백 갱신 — 마지막 보이는 스텝 카드가 페이지 최상단까지 스크롤될 만큼 뒤 공간 확보.
    function _updateScrollPad(oPage) {
        if (!oPage || !oPage.__pad || !document.body.contains(oPage)) { return; }
        var aCards = oPage.querySelectorAll(".u4aTplWiz__stepCard");
        var oLast = null;
        for (var i = aCards.length - 1; i >= 0; i--) { if (!aCards[i].hidden) { oLast = aCards[i]; break; } }
        var iH = 0;
        var iPageH = oPage.clientHeight;
        if (oLast && iPageH > 0) { iH = Math.max(0, iPageH - oLast.offsetHeight - 8); } // 8 = 상단 여유
        oPage.__pad.style.height = iH + "px";
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
        if (sKey === K_WZD3) {
            // Report Template : Form·Table 두 섹션 모두 모델 로드 시 노출.
            var f = oS.sec.WZD3F, t = oS.sec.WZD3T;
            bShow = !!(f && f.model && t && t.model);
        } else {
            var cfg = oS.menuCfg && oS.menuCfg[sKey];
            if (cfg) { var sec = oS.sec[cfg.sid]; bShow = !!(sec && sec.model); }
        }
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

        // ★연타 방어 : 진행 중이던(또는 잔여) 전환을 즉시 정리 — 모든 페이지의 애니 클래스 제거 +
        //   현재 페이지(oFrom)만 남기고 전부 hidden. (이전 전환의 _done 이 gen 으로 취소되며 남긴
        //    "hidden=false + 잔여 클래스 + absolute" 잔여 페이지들이 겹쳐 그려지던 버그 제거)
        for (var kc in oUI.pages) {
            if (!Object.prototype.hasOwnProperty.call(oUI.pages, kc)) { continue; }
            var pc = oUI.pages[kc];
            pc.classList.remove("u4aWsNavInFwd", "u4aWsNavInBack", "u4aWsNavOutFwd", "u4aWsNavOutBack");
            if (pc !== oFrom) { pc.hidden = true; }
        }

        // 최초 표시(나가는 페이지 없음) 또는 동일 페이지 → 애니메이션 없이 확정.
        if (!oFrom || oFrom === oTo) {
            oTo.hidden = false;
            oUI.curPage = oTo;
            oUI.curPageKey = sKey;
            oUI.main.classList.remove("u4aTplWizNaving");
            return;
        }

        var bFwd = _menuIndex(sKey) > _menuIndex(oUI.curPageKey);
        var sIn = bFwd ? "u4aWsNavInFwd" : "u4aWsNavInBack";
        var sOut = bFwd ? "u4aWsNavOutFwd" : "u4aWsNavOutBack";

        var gen = (oS._mainNavGen = (oS._mainNavGen || 0) + 1); // 연타 stale animationend 차단 (클래스 정리는 상단 루프가 이미 수행)

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
        _busy(true); // ★버튼 이벤트 진입 즉시 busy (첫 라인) — 이후 분기/검증/생성. 조기 return 은 각자 busy off.

        // 원본 ev_tmplWzdComplete : 현재 메뉴(SELKEY)로 위자드별 Complete dispatch.
        if (oS && oS.cur === K_WZD3) { _wz3Complete(); return; } // Report Template = Form+Table 통합(자체 검증·busy off)

        var cfg = oS && oS.menuCfg && oS.menuCfg[oS.cur];
        if (!cfg) { _busy(false); return; }

        var oComplete = _wzComplete(cfg);
        if (!oComplete) { return; } // 검증 실패 — _wzComplete 가 메시지 + _busy(false) 처리

        // Stage 4 : 생성 통합(ws_html5_ws20_wizard.js). 아직 미연결이면 무동작(대기).
        if (typeof oAPP.fn.designWizardCallback === "function") {
            oAPP.fn.designWizardCallback(oComplete, function (oRet) {
                _busy(false);
                // 에러는 위자드(showModal) 위 top-layer 박스로(토스트는 뒤로 가려짐). 성공 토스트는 닫힘 후 노출.
                if (oRet && oRet.SUBRC === "E") { _alert("E", oRet.MSG); return; }
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
            els: { cards: [], cardHeads: [] }
        };
        oS.sec[cfg.sid] = sec;
        oS.menuCfg[cfg.menuKey] = cfg; // 푸터 생성 버튼 dispatch

        // 스텝 메타 (원본 sap.m.WizardStep title) — 동적 key 접미 포함.
        //   기본(WZD1/2) = UI Choice / Model Select / Model Information.
        //   WZD3 는 cfg.stepTitles 로 Form/Table 별 원본 제목(D78~D82) 주입.
        var aTitles = cfg.stepTitles || [_cl("D77"), _cl("D66"), _cl("D67")];
        sec.steps = [
            { base: aTitles[0], suffix: function () { var k = cfg.getSel(); return k ? " [ " + k + " ] " : ""; } }, // UI Choice
            { base: aTitles[1], suffix: function () { return ""; } },                                               // Model Select
            { base: aTitles[2], suffix: function () { return sec.model ? " [ " + sec.model + " ] " : ""; } }        // Model Information
        ];

        /* ---- 진행 내비게이터 ----
         *   WZD1/2 = 섹션마다 자체 3스텝 내비게이터.
         *   WZD3   = 두 섹션(Form+Table)을 하나의 6스텝 내비게이터로 통합(cfg.sharedNav) →
         *            내비게이터는 _buildMainPage(WZD3) 에서 한 번만 만든다(여기선 생략). */
        var oWrap;
        if (cfg.sharedNav) {
            oWrap = _el("div", "u4aTplWiz__steps"); // 카드만(내비게이터는 통합본이 상단에)
        } else {
            oWrap = _el("div", "u4aTplWiz__wz");
            sec.nav = _buildNav(function () {
                var a = _navStepsForSec(sec, true);
                _navMarkCurrent(a);
                return a;
            });
            oWrap.appendChild(sec.nav.els.nav);
        }

        /* ---- 스텝 카드 컨테이너 ---- */
        var oSteps = cfg.sharedNav ? oWrap : _el("div", "u4aTplWiz__steps");

        function _card(idx) {
            var oCard = _el("div", "u4aTplWiz__stepCard");
            var oHead = _el("div", "u4aTplWiz__cardHead");
            oCard.appendChild(oHead);
            var oBody = _el("div", "u4aTplWiz__cardBody");
            oCard.appendChild(oBody);
            sec.els.cards[idx] = oCard;
            sec.els.cardHeads[idx] = oHead;
            oCard.__sec = sec; oCard.__local = idx; // 스크롤스파이 : 카드 → (섹션, 로컬 스텝 인덱스)
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
        oBtn.querySelector("span").textContent = aTitles[1]; // Model Select(WZD3=Form/Table Model Select)
        oBtn.addEventListener("click", function () { _wzModelSelect(cfg); });
        oB2.appendChild(oBtn);

        // Card 3 : Model Information 테이블
        var oB3 = _card(2);
        var oTblWrap = _el("div", "u4aTplWiz__tblWrap");
        oB3.appendChild(oTblWrap);
        sec.els.tableWrap = oTblWrap;

        if (oSteps !== oWrap) { oWrap.appendChild(oSteps); }

        _wzSyncSteps(sec); // 초기 상태(Step1 만 available)
        return oWrap;
    }

    /* ---- 스텝 available/current 동기화 + 라벨 갱신 (원본 Wizard step 진행) ----
     *   available : step1=항상 / step2=UI Choice 선택됨 / step3=모델 로드됨.
     *   카드 hidden = !available. WZD3 는 sec.gate() 로 Table 섹션을 Form 모델 로드 후 노출.
     *   내비게이터(라벨/현재/축소)는 provider 를 읽는 _syncNav 가 담당(WZD1/2=자체, WZD3=통합). */
    function _wzSyncSteps(sec) {
        var cfg = sec.cfg;
        var aAvail = [true, !!cfg.getSel(), !!sec.model];
        var iCur = 0;
        for (var i = 0; i < aAvail.length; i++) { if (aAvail[i]) { iCur = i; } }
        sec.avail = aAvail;
        sec.iCur = iCur;

        _wzGateCards(sec);

        // WZD3 통합 그룹 : 형제 섹션의 gate 가 이 섹션 model 에 의존(Table=Form 모델 로드 후) →
        //   내 model 이 바뀌면 형제 카드 노출도 재평가한다.
        if (sec.shared && oS.sharedNav && oS.sharedNav.secs) {
            var aGrp = oS.sharedNav.secs;
            for (var g = 0; g < aGrp.length; g++) {
                if (aGrp[g] !== sec && aGrp[g].avail) { _wzGateCards(aGrp[g]); }
            }
        }

        // 상태 변화(선택/모델 로드) = 진행 위치가 바뀐 것 → 수동 선택 해제해 current 를 다시 "가장 마지막 도달"로.
        var nv = sec.nav || sec.shared;
        if (nv) { nv.selIdx = null; }
        _syncNav(nv); // 섹션 자체 내비 or 통합 내비 갱신(provider 가 live 값 읽음)

        // ★카드 게이팅(스텝 노출/숨김)이 바뀌면 하단 가상 여백을 즉시 재계산 — "현재 보이는 마지막 카드" 기준.
        //   (RO 비동기 타이밍 의존 제거. 예: 스텝4가 마지막이면 스텝6 기준의 과다 여백이 남아 과다 스크롤되던 것 방지)
        try {
            var oCard0 = sec.els.cards[0];
            var oPageEl = oCard0 && oCard0.closest ? oCard0.closest(".u4aTplWiz__page") : null;
            if (oPageEl) { _updateScrollPad(oPageEl); }
        } catch (e) { }
    }

    // 카드 제목(번호) + 노출(available && gate) 갱신. gate=WZD3 Table 은 Form 모델 로드 후.
    function _wzGateCards(sec) {
        var iOff = sec.cfg.numOffset || 0;             // WZD3 Table 섹션은 카드 번호 4~6
        var bGate = sec.gate ? !!sec.gate() : true;    // WZD3 Table = Form 모델 로드 후 노출
        for (var j = 0; j < sec.steps.length; j++) {
            var sTitle = sec.steps[j].base + sec.steps[j].suffix();
            sec.els.cardHeads[j].textContent = (j + 1 + iOff) + ". " + sTitle;
            sec.els.cards[j].hidden = !((sec.avail && sec.avail[j]) && bGate);
        }
    }

    // 카드로 스크롤(available/gate 통과 시) — full/mini/팝오버 공용.
    function _wzScrollToCard(sec, idx) {
        var c = sec.els.cards[idx];
        if (c && !c.hidden) { try { c.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { } }
    }

    /* ================================================================
     * 진행 내비게이터 공통 (원본 sap.m.WizardProgressNavigator)
     *   provider() → [{ label, avail, current, scroll }]. full/mini/팝오버가 동일 소비.
     *   WZD1/2 = 섹션 1개(3스텝), WZD3 = 두 섹션 통합(6스텝) 모두 이 하나로 렌더.
     * ================================================================ */
    //   ★full(전체 표시) 스텝 DOM 은 한 번만 만들고 _syncNav 는 클래스/텍스트만 바꾼다(in-place) →
    //     번호 원 채움·연결선 진행이 CSS transition 으로 부드럽게 애니메이션.
    //   ★mini(축소) 는 폭에 따라 넘치는 스텝을 "겹친 원(그룹)" 하나로 접어 매 리사이즈마다 재배치.
    function _buildNav(fnProvider) {
        var nav = { provider: fnProvider, els: { full: [], conns: [] } };
        var oNav = _el("div", "u4aTplWiz__wzNav");
        var oFull = _el("div", "u4aTplWiz__navFull");
        var oMini = _el("div", "u4aTplWiz__navMini");
        var n = fnProvider().length; // 스텝 수 고정(WZD1/2=3, WZD3=6)
        for (var i = 0; i < n; i++) {
            if (i > 0) { var oConn = _el("div", "u4aTplWiz__navConn"); oFull.appendChild(oConn); nav.els.conns[i] = oConn; }
            oFull.appendChild(_navMakeStep(nav, i));
        }
        oNav.appendChild(oFull);
        oNav.appendChild(oMini);
        nav.els.nav = oNav; nav.els.navFull = oFull; nav.els.navMini = oMini;
        if (window.ResizeObserver) {
            try { nav.ro = new ResizeObserver(function () { _wzNavResize(nav); }); nav.ro.observe(oNav); } catch (e) { }
        }
        if (oS) { (oS.navs = oS.navs || []).push(nav); } // lf_close 정리 대상
        _syncNav(nav);
        return nav;
    }

    // full 스텝 DOM 1개(번호 원 + 라벨). 클릭 시 available 이면 해당 카드로 스크롤.
    function _navMakeStep(nav, idx) {
        var oStep = _el("div", "u4aTplWiz__navStep");
        oStep.appendChild(_el("div", "u4aTplWiz__navNum", String(idx + 1)));
        var oLbl = _el("span", "u4aTplWiz__navLbl");
        oStep.appendChild(oLbl);
        oStep.addEventListener("click", function () { _navGo(nav, idx); });
        nav.els.full[idx] = { root: oStep, lbl: oLbl };
        return oStep;
    }

    // 섹션 → 스텝 디스크립터. bGate=false 면 그 섹션 스텝 전부 비활성(WZD3 Table 게이트).
    function _navStepsForSec(sec, bGate) {
        var out = [];
        for (var i = 0; i < sec.steps.length; i++) {
            (function (idx) {
                out.push({
                    label: sec.steps[idx].base + sec.steps[idx].suffix(),
                    avail: !!(sec.avail && sec.avail[idx]) && (bGate !== false),
                    current: false,
                    scroll: function () { _wzScrollToCard(sec, idx); }
                });
            })(i);
        }
        return out;
    }

    // 현재(진행 위치) = available 중 가장 마지막(원본 Wizard current step).
    function _navMarkCurrent(a) {
        var cur = -1;
        for (var i = 0; i < a.length; i++) { if (a[i].avail) { cur = i; } }
        if (cur >= 0) { a[cur].current = true; }
    }

    // provider() + 수동 선택(nav.selIdx) 반영 — 사용자가 특정 스텝을 고르면 그 원이 current(선택 표시).
    //   상태 변화(_wzSyncSteps) 시 selIdx=null 로 리셋되어 다시 "가장 마지막 도달"이 current 가 된다.
    function _navSteps(nav) {
        var a = nav.provider();
        if (nav.selIdx != null && a[nav.selIdx] && a[nav.selIdx].avail) {
            for (var i = 0; i < a.length; i++) { a[i].current = (i === nav.selIdx); }
        }
        return a;
    }

    // 스텝 선택(원본 setCurrentStep) — 해당 카드로 스크롤 + 그 원에 선택 표시 유지.
    function _navGo(nav, idx) {
        var a = _navSteps(nav);
        if (!a[idx] || !a[idx].avail) { return; }
        // 스크롤만 — 선택 표시(current)는 스크롤스파이가 스크롤을 따라 이동시킨다(즉시 selIdx 박으면 목표로 튀었다
        //   스파이가 되돌려 깜빡임). 스크롤이 실제로 일어나면 scroll 이벤트→_scrollSpy 가 selIdx 갱신.
        a[idx].scroll();
    }

    // in-place 갱신(full) — 라벨/available/current + 연결선 진행(is-done)만 토글. mini 는 _wzNavResize 가 재배치.
    function _syncNav(nav) {
        if (!nav) { return; }
        var a = _navSteps(nav);
        for (var i = 0; i < a.length; i++) {
            var st = a[i], f = nav.els.full[i];
            if (f) {
                f.lbl.textContent = st.label;
                // 라벨이 말줄임(잘림)일 때만 공통 툴팁으로 전체 텍스트 — .u4a-table 과 동일한 data-tip-trunc 패턴(.analy/16 §2.9a)
                f.root.setAttribute("data-tip", st.label);
                f.root.setAttribute("data-tip-trunc-sel", ".u4aTplWiz__navLbl");
                f.root.classList.toggle("is-avail", st.avail);
                f.root.classList.toggle("is-current", st.current);
            }
            // 연결선(스텝 i 앞) — 스텝 i 에 도달(available)하면 accent 로 채워진다.
            if (i > 0 && nav.els.conns[i]) { nav.els.conns[i].classList.toggle("is-done", st.avail); }
        }
        _wzNavResize(nav);
    }

    // 반응형 : full 이 컨테이너를 넘치면 mini(축소)로 전환(원본 WizardProgressNavigator collapse).
    function _wzNavResize(nav) {
        var oNav = nav.els.nav, oFull = nav.els.navFull;
        if (!oNav || !oFull || !document.body.contains(oNav)) { return; }
        oNav.classList.remove("is-collapsed");          // 측정 위해 full 표시
        if (oNav.clientWidth <= 0) { return; }          // 페이지 숨김 상태 — 표시 시 RO 재측정
        var bOver = oFull.scrollWidth > oFull.clientWidth + 1;
        oNav.classList.toggle("is-collapsed", bOver);
        if (bOver) { _renderMiniCollapsed(nav); }       // 축소 시 폭에 맞춰 그룹 접기 재계산
    }

    /* ---- 축소(mini) 재배치 [측정 기반] : 전부 개별로 그려 보고, 실제로 넘치면 현재에서 먼 쪽부터
     *   바깥 스텝을 "겹친 원(그룹)"으로 접는다. 매직 폭 상수 없이 scrollWidth 로 판정(정확).
     *   (원본 WizardProgressNavigator : 넘치는 스텝 → 그룹 앵커, 클릭 시 그 구간만 팝오버) */
    function _renderMiniCollapsed(nav) {
        var a = _navSteps(nav), N = a.length;
        var oMini = nav.els.navMini;
        if (!N) { oMini.innerHTML = ""; return; }

        var cur = 0;
        for (var i = 0; i < N; i++) { if (a[i].current) { cur = i; } }

        // [lo..hi] = 개별로 보일 구간(항상 cur 포함). 그 바깥은 앞/뒤 그룹.
        function paint(lo, hi) {
            oMini.innerHTML = "";
            if (lo > 0) { oMini.appendChild(_miniGroup(nav, a, 0, lo - 1)); oMini.appendChild(_miniConn(a, lo)); }
            for (var s = lo; s <= hi; s++) {
                if (s > lo) { oMini.appendChild(_miniConn(a, s)); }
                oMini.appendChild(_miniChip(nav, a, s, s === cur));
            }
            if (hi < N - 1) { oMini.appendChild(_miniConn(a, hi + 1)); oMini.appendChild(_miniGroup(nav, a, hi + 1, N - 1)); }
        }
        function overflow() { return oMini.scrollWidth > oMini.clientWidth + 1; }

        var lo = 0, hi = N - 1;
        paint(lo, hi);                                   // 우선 전부 개별
        var guard = 0;
        while (overflow() && guard++ < N * 2) {          // 넘치면 cur 에서 먼 쪽부터 한 스텝씩 접기
            var canHi = hi > cur, canLo = lo < cur;
            if (!canHi && !canLo) { break; }             // 현재 + 양옆 그룹만 남음(더 못 줄임)
            if (canHi && (!canLo || (hi - cur) >= (cur - lo))) { hi--; } else { lo++; }
            paint(lo, hi);
        }

        // 1개짜리 그룹은 개별 원이 더 좁으니 다시 펴준다(개별이 항상 더 작아 재측정 불필요).
        var bChanged = false;
        if (lo === 1) { lo = 0; bChanged = true; }
        if (hi === N - 2) { hi = N - 1; bChanged = true; }
        if (bChanged) { paint(lo, hi); }

        _compressMini(nav); // 창=현재만 남았는데도 넘치면(라벨이 아주 길 때) 원들을 겹쳐 폭 축소
    }

    // 넘침 보정 — 현재 칩(라벨)을 제외한 원/그룹/연결선에 음수 마진을 줘 겹치게 해서 폭을 줄인다.
    function _compressMini(nav) {
        var mini = nav.els.navMini;
        for (var k = 0; k < mini.children.length; k++) { mini.children[k].style.marginLeft = ""; } // 리셋
        var over = mini.scrollWidth - mini.clientWidth;
        if (over <= 2) { return; } // 미세 초과는 무시(불필요한 겹침 방지) — 실제로 넘칠 때만 겹친다
        var aShrink = [];
        for (var i = 1; i < mini.children.length; i++) { // 첫 항목 제외(음수 마진이 왼쪽으로 잘림)
            if (!mini.children[i].classList.contains("is-current")) { aShrink.push(mini.children[i]); }
        }
        if (!aShrink.length) { return; }
        var per = Math.min(Math.ceil(over / aShrink.length) + 1, 14); // 항목당 겹침(과도 방지)
        for (var j = 0; j < aShrink.length; j++) { aShrink[j].style.marginLeft = (-per) + "px"; }
    }

    // 축소 개별 원(번호+현재만 라벨). 클릭=available 이면 해당 카드로 이동(선택 표시는 is-current).
    function _miniChip(nav, a, idx, bCur) {
        var st = a[idx];
        var oStep = _el("div", "u4aTplWiz__navStep u4aTplWiz__navMiniStep");
        if (st.avail) { oStep.classList.add("is-avail"); }
        if (bCur) { oStep.classList.add("is-current"); }
        oStep.appendChild(_el("div", "u4aTplWiz__navNum", String(idx + 1)));
        var oLbl = _el("span", "u4aTplWiz__navLbl");
        if (bCur) { oLbl.textContent = st.label; }
        oStep.appendChild(oLbl);
        oStep.title = (idx + 1) + ". " + st.label; // 라벨 없는 원/겹칠 때도 hover 로 스텝명(.analy/16 §2.9a)
        oStep.addEventListener("click", function () { _navGo(nav, idx); });
        return oStep;
    }

    // 겹친 원(그룹) — [iFrom..iTo] 를 하나로 접어 표시. 클릭 시 그 구간만 팝오버.
    function _miniGroup(nav, a, iFrom, iTo) {
        var oG = _el("div", "u4aTplWiz__navGroup");
        var bAny = false;
        for (var i = iFrom; i <= iTo; i++) { if (a[i].avail) { bAny = true; break; } }
        if (bAny) { oG.classList.add("is-avail"); }         // 하나라도 도달 시 accent(선택 표시)
        oG.appendChild(_el("div", "u4aTplWiz__navNum", String(iFrom + 1))); // 첫 스텝 번호
        var aTip = [];                                       // 접힌 스텝명 hover 로(클릭=팝오버, .analy/16 §2.9a)
        for (var t = iFrom; t <= iTo; t++) { aTip.push((t + 1) + ". " + a[t].label); }
        oG.setAttribute("title", aTip.join("\n"));
        oG.addEventListener("click", function (ev) { ev.stopPropagation(); _wzOpenStepPopover(nav, ev.currentTarget, iFrom, iTo); });
        return oG;
    }

    // 축소 연결선(고정폭) — 오른쪽 스텝 도달 시 accent 채움.
    function _miniConn(a, iRight) {
        var oC = _el("div", "u4aTplWiz__navConn u4aTplWiz__navConnMini");
        if (a[iRight] && a[iRight].avail) { oC.classList.add("is-done"); }
        return oC;
    }

    // 스텝 팝오버 (원본 grouped step popover) — [iFrom..iTo] 구간만(그룹 클릭 시 그 구간).
    function _wzOpenStepPopover(nav, oAnchor, iFrom, iTo) {
        _wzClosePop(nav);
        var aSteps = _navSteps(nav);
        var lo = (iFrom == null) ? 0 : iFrom;
        var hi = (iTo == null) ? aSteps.length - 1 : iTo;

        var oPop = _el("div", "u4aTplWiz__navPop");
        for (var i = lo; i <= hi; i++) {
            var st = aSteps[i];
            var oRow = _el("div", "u4aTplWiz__navPopRow");
            if (st.current) { oRow.classList.add("is-current"); }
            if (!st.avail) { oRow.classList.add("is-disabled"); }
            oRow.appendChild(_el("span", "u4aTplWiz__navPopNum", String(i + 1)));
            oRow.appendChild(_el("span", "u4aTplWiz__navPopLbl", st.label));
            if (st.avail) {
                (function (idx) {
                    oRow.addEventListener("click", function () { _wzClosePop(nav); _navGo(nav, idx); });
                })(i);
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

        nav.els.pop = oPop;
        // 바깥 클릭/스크롤/리사이즈 시 닫기.
        nav._popClose = function () { _wzClosePop(nav); };
        setTimeout(function () {
            document.addEventListener("mousedown", nav._popOutside = function (ev) {
                if (oPop.contains(ev.target)) { return; }
                _wzClosePop(nav);
            }, true);
        }, 0);
        window.addEventListener("resize", nav._popClose);
        var oScroller = nav.els.nav.closest(".u4aTplWiz__page");
        if (oScroller) { oScroller.addEventListener("scroll", nav._popClose, true); }
        nav._popScroller = oScroller;
    }

    function _wzClosePop(nav) {
        if (!nav) { return; }
        if (nav._popOutside) { try { document.removeEventListener("mousedown", nav._popOutside, true); } catch (e) { } nav._popOutside = null; }
        if (nav._popClose) { try { window.removeEventListener("resize", nav._popClose); } catch (e) { } if (nav._popScroller) { try { nav._popScroller.removeEventListener("scroll", nav._popClose, true); } catch (e) { } } nav._popClose = null; nav._popScroller = null; }
        if (nav.els && nav.els.pop) { try { nav.els.pop.remove(); } catch (e) { } nav.els.pop = null; }
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

        // 프리뷰 갱신 — WZD3(Report) 섹션은 메뉴 프리뷰(ReportTemplate) 고정이라 건드리지 않음(원본 동일).
        if (!cfg.noPreview) {
            if (!key) { _prevInit(); }   // 미리보기 P1
            else { _prevImage(key); }    // 미리보기 이미지
        }

        _wzSyncSteps(sec);           // 스텝 available/라벨 갱신 (step2 노출/숨김 포함)
        _syncCreateForMenu(oS.cur);

        // 스텝1(UI 선택) 값 지정 → 새로 나타난 스텝2(모델 선택) 카드를 페이지 상단으로 스크롤(모델정보=step3 로드시 처리와 동일 UX).
        //   값 비움/게이트로 카드 숨김이면 _wzScrollToCard 가 no-op.
        if (key) { _wzScrollToCard(sec, 1); }
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
        // TreeTable = Parent/Child(+2) 표시 & Position(-1) 숨김(원본 visible:!TREEVISI) ⇒ 9열, 그 외 8열.
        var iCols = sec.treevisi ? 9 : 8;
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
        // ★ 채움(trailing filler) 컬럼 — 폭 미지정(auto). table-layout:fixed 에서 폭 지정된 데이터 컬럼은
        //   고정되고, 나머지 공간은 이 컬럼 하나가 흡수한다(원본 UI5 처럼 격자가 우측 끝까지 이어짐, 데이터 컬럼 stretch 없음).
        oCg.appendChild(document.createElement("col"));
        oTbl.appendChild(oCg);
        oTbl.style.minWidth = iSum + "px";   // 데이터 컬럼 합(채움 제외) — 이보다 좁아지면 가로 스크롤

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
        if (sec.treevisi) { th(_cl("D69")); th(_cl("D70")); } // Is Parent / Is Child (TreeTable)
        if (!sec.treevisi) { th(_cl("D71")); } // Position (Order) — TreeTable 이면 숨김(원본 visible:!TREEVISI)
        th(_cl("D72")); // UI Type Select
        th(_cl("D73")); // Label Text
        th(_cl("D74")); // Field Type
        th(_cl("D75")); // Field Length
        th(_cl("D76")); // Conv. Routine
        oTrH.appendChild(_el("th", "u4a-th u4aTplWiz__fillCol"));   // 채움 헤더(빈 셀, 나머지 폭 흡수)
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

    // 기본 컬럼폭(px) — 순서: chk, Field Name, [Parent, Child | Position], UI Type, Label, Field Type, Field Length, Conv.
    // TreeTable = Parent/Child 표시 + Position 숨김(원본 visible:!TREEVISI). 그 외 = Position 표시.
    function _wzDefaultColW(bTree) {
        var w = [36, 200];
        if (bTree) { w.push(100, 100); } // Parent, Child
        else { w.push(112); }            // Position
        w.push(208, 208, 150, 112, 150); // UI Type, Label, Field Type, Field Length, Conv.
        return w;
    }

    // 컬럼 리사이즈 그립 — 공통 SSOT U4AUI.attachColumnResize(가이드 라인 + 놓을 때 적용, 16 §3.4.2)
    //   소비. 마지막 컬럼 제외. 폭 적용 시 sec.colW 영속 + 테이블 minWidth 재계산(가로 스크롤).
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
        U4AUI.attachColumnResize(oGrip, {
            host: sec.els.tbl,   // 가이드 세로 범위 = 테이블 높이(공통 함수가 보이는 영역으로 클램프)
            min: 48,
            // ★ 실제 렌더폭 실측(그립이 얹힌 헤더 셀) — 저장폭 대신(§3.4.2 트리 소비처와 동일). 어긋남 방지.
            getWidth: function () {
                var oTh = oGrip.parentNode;
                return (oTh && oTh.getBoundingClientRect().width) || sec.colW[idx];
            },
            setWidth: function (px) {
                sec.colW[idx] = px;
                if (sec.els.cols[idx]) { sec.els.cols[idx].style.width = px + "px"; }
                _wzApplyTblMinW(sec);
            },
            // 더블클릭 = 기본폭 복귀.
            onReset: function () {
                sec.colW = _wzDefaultColW(sec.treevisi);
                for (var c = 0; c < sec.colW.length; c++) { if (sec.els.cols[c]) { sec.els.cols[c].style.width = sec.colW[c] + "px"; } }
                _wzApplyTblMinW(sec);
            }
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

        // Position (숫자) — TreeTable 이면 숨김(원본 visible:!TREEVISI)
        if (!sec.treevisi) {
            var tdP = document.createElement("td");
            var fP = U4AUI.createField({
                type: "text", value: (r.POSIT != null ? r.POSIT : ""), disabled: !bEn,
                onChange: function (v) { r.POSIT = parseInt(v, 10) || 0; }
            });
            tdP.appendChild(fP.el);
            tr.appendChild(tdP);
        }

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
        tr.appendChild(_el("td", "u4aTplWiz__fillCol"));   // 채움 셀(빈, 나머지 폭)
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
            _alert("E", _mw("268")); // Selected line does not exists. (top-layer 박스)
            _busy(false);
            return null;
        }

        var sUi = cfg.getSel();
        if (sec.treevisi) {
            // TreeTable → Parent, Child 필수(원본 fnCheckValidTmplWzd1TreeTable)
            var bP = false, bC = false;
            for (var j = 0; j < rows.length; j++) { if (rows[j].PARENT === "X") { bP = true; } if (rows[j].CHILD === "X") { bC = true; } }
            if (!bP || !bC) {
                _alert("E", _mw("050", _cl("B76") + ", " + _cl("B77"))); // & is required. (top-layer 박스)
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

    /* ---- Report Template : 섹션 수집(원본 fnGetTmplWzd3Form/TableComplete) ----
     *   행 미선택 = 348 "Please select a row of &1"(&1=D80 Form / D82 Table).
     *   반환: oComplete(uName/mName/selTab/uiDDLB) 또는 { RETCD:"E", RTMSG }. */
    function _wzGather(sid, sInfoKey) {
        var sec = oS.sec[sid];
        if (!sec || !sec.model) { return { RETCD: "E", RTMSG: _mw("348", _cl(sInfoKey)) }; }

        var rows = [];
        for (var i = 0; i < sec.outab.length; i++) { if (sec.outab[i].enabled === true) { rows.push(sec.outab[i]); } }
        if (rows.length <= 0) { return { RETCD: "E", RTMSG: _mw("348", _cl(sInfoKey)) }; }

        if (sec.treevisi) {
            var bP = false, bC = false;
            for (var j = 0; j < rows.length; j++) { if (rows[j].PARENT === "X") { bP = true; } if (rows[j].CHILD === "X") { bC = true; } }
            if (!bP || !bC) { return { RETCD: "E", RTMSG: _mw("050", _cl("B76") + ", " + _cl("B77")) }; }
        } else {
            rows = rows.slice().sort(function (a, b) { return (a.POSIT - b.POSIT); });
        }
        return {
            uName: sec.cfg.getSel(), mName: sec.model, selTab: rows,
            uiDDLB: (oS.MASTER && oS.MASTER.T_UIDDLB) || []
        };
    }

    /* ---- Report Template 통합 완료 (원본 ev_tmplWzd3Complete) ---- */
    function _wz3Complete() {
        _busy(true);
        var oForm = _wzGather("WZD3F", "D80");  // Form Ui Model Information
        if (oForm.RETCD === "E") { _alert("E", oForm.RTMSG); _busy(false); return; }
        var oTable = _wzGather("WZD3T", "D82"); // Table Ui Model Information
        if (oTable.RETCD === "E") { _alert("E", oTable.RTMSG); _busy(false); return; }

        var oResult = { uName: "ReportTemplate", oSearch: oForm, oList: oTable };
        if (typeof oAPP.fn.designWizardCallback === "function") {
            oAPP.fn.designWizardCallback(oResult, function (oRet) {
                _busy(false);
                if (oRet && oRet.SUBRC === "E") { _alert("E", oRet.MSG); return; }
                if (oRet && oRet.MSG) { _msg(10, "S", oRet.MSG); }
                lf_close();
            });
        } else { _busy(false); }
    }

    /* ==================================================================
     * 닫기 (원본 pressUiTempWizardDialogClose + afterClose 초기화)
     * ================================================================== */
    function lf_close() {
        // 위자드 내비게이터 정리 — ResizeObserver + 열린 팝오버(섹션 자체 내비 + WZD3 통합 내비).
        try {
            if (oS && oS.navs) {
                for (var n = 0; n < oS.navs.length; n++) {
                    var nv = oS.navs[n];
                    _wzClosePop(nv);
                    if (nv.ro) { try { nv.ro.disconnect(); } catch (e) { } nv.ro = null; }
                }
            }
        } catch (e) { }
        // 페이지 스크롤 스페이서 ResizeObserver 정리.
        try {
            if (oUI && oUI.pages) {
                for (var pk in oUI.pages) {
                    if (!Object.prototype.hasOwnProperty.call(oUI.pages, pk)) { continue; }
                    var op = oUI.pages[pk];
                    if (op && op.__ro) { try { op.__ro.disconnect(); } catch (e) { } op.__ro = null; }
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
            ".u4aTplWiz__wz{display:flex;flex-direction:column;}",
            /* 스크롤 하단 가상 여백 — 마지막 스텝 카드도 페이지 최상단까지 스크롤되게(높이는 _updateScrollPad 가 실측) */
            ".u4aTplWiz__scrollPad{width:100%;flex:0 0 auto;pointer-events:none;}",
            ".u4aTplWiz__wzNav{position:sticky;top:0;z-index:2;display:flex;align-items:center;padding:.75rem 1.25rem;background:var(--surface);border-bottom:.0625rem solid var(--line);}",
            ".u4aTplWiz__navFull{display:flex;align-items:center;flex:1 1 auto;min-width:0;overflow:hidden;}",
            ".u4aTplWiz__navMini{display:none;align-items:center;flex:1 1 auto;min-width:0;gap:0;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navFull{display:none;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navMini{display:flex;}",
            ".u4aTplWiz__navMiniStep{cursor:pointer;min-width:0;flex:0 0 auto;gap:0;}",
            ".u4aTplWiz__navMiniStep.is-current{flex:0 0 auto;}",
            /* 축소 연결선 : 고정폭(짧은 선) */
            /* 축소 연결선 : 짧은 선 + 양옆 마진(원/텍스트와 안 붙게). footprint = 1rem + .5rem = 1.5rem(=CONN 예산) */
            ".u4aTplWiz__navConnMini{flex:0 0 auto;width:1rem;min-width:1rem;margin:0 .25rem;}",
            /* 겹친 원(그룹) — 넘치는 스텝 묶음. 뒤로 반투명 원 2개가 살짝 겹쳐 스택처럼 보인다. 클릭=구간 팝오버 */
            ".u4aTplWiz__navGroup{position:relative;display:flex;align-items:center;flex:0 0 auto;cursor:pointer;padding-right:.9rem;}",
            ".u4aTplWiz__navGroup .u4aTplWiz__navNum{position:relative;z-index:2;}",
            ".u4aTplWiz__navGroup::before,.u4aTplWiz__navGroup::after{content:\"\";position:absolute;top:50%;left:0;width:1.75rem;height:1.75rem;border-radius:50%;border:.125rem solid var(--line);background:var(--surface);box-sizing:border-box;}",
            ".u4aTplWiz__navGroup::before{transform:translate(.3rem,-50%);z-index:1;opacity:.7;}",
            ".u4aTplWiz__navGroup::after{transform:translate(.6rem,-50%);z-index:0;opacity:.4;}",
            ".u4aTplWiz__navGroup.is-avail .u4aTplWiz__navNum{border-color:var(--accent);color:var(--accent);}",
            ".u4aTplWiz__navGroup.is-avail::before,.u4aTplWiz__navGroup.is-avail::after{border-color:var(--accent);}",
            ".u4aTplWiz__navStep{display:flex;align-items:center;gap:.5rem;color:var(--text-muted);flex:0 0 auto;min-width:0;transition:color .26s ease;}",
            ".u4aTplWiz__navNum{width:1.75rem;height:1.75rem;border-radius:50%;border:.125rem solid var(--line);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.8125rem;background:var(--surface);flex:0 0 auto;box-sizing:border-box;transition:background-color .26s ease,border-color .26s ease,color .26s ease,transform .26s ease;}",
            ".u4aTplWiz__navLbl{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".u4aTplWiz__navStep.is-avail{color:var(--text);cursor:pointer;}",
            ".u4aTplWiz__navStep.is-avail .u4aTplWiz__navNum{border-color:var(--accent);color:var(--accent);}",
            ".u4aTplWiz__navStep.is-current .u4aTplWiz__navNum{background:var(--accent);border-color:var(--accent);color:#fff;transform:scale(1.08);}", // 현재 스텝 번호 원 살짝 확대(강조)
            /* 축소형(mini) : 현재 스텝 라벨만 부드럽게 펼침 */
            ".u4aTplWiz__navMiniStep .u4aTplWiz__navLbl{max-width:0;opacity:0;margin-left:0;transition:max-width .3s ease,opacity .3s ease,margin-left .3s ease;}",
            /* 현재 스텝 라벨은 축소에서도 최대한 살린다 — 잘림(ellipsis) 없이 전체 표시(폭은 _renderMiniCollapsed 가 실측 확보) */
            ".u4aTplWiz__navMiniStep.is-current .u4aTplWiz__navLbl{max-width:none;opacity:1;margin-left:.5rem;flex:0 0 auto;overflow:visible;text-overflow:clip;}",
            /* 연결선 — is-done(뒤 스텝 도달) 시 좌→우로 accent 채움 */
            ".u4aTplWiz__navConn{position:relative;overflow:hidden;flex:1 1 auto;height:.0625rem;background:var(--line);margin:0 1rem;min-width:1.5rem;}",
            ".u4aTplWiz__navConn::after{content:\"\";position:absolute;left:0;top:0;bottom:0;width:0;background:var(--accent);transition:width .35s ease;}",
            ".u4aTplWiz__navConn.is-done::after{width:100%;}",
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
            /* 스텝 카드 등장 — 숨김([hidden])이 풀릴 때 아래에서 위로 페이드인(원본 Wizard step reveal) */
            "@keyframes u4aTplWizCardIn{from{opacity:0;transform:translateY(.5rem);}to{opacity:1;transform:none;}}",
            ".u4aTplWiz__steps .u4aTplWiz__stepCard:not([hidden]){animation:u4aTplWizCardIn .28s ease both;}",
            ".u4aTplWiz__cardHead{font-weight:700;font-size:.9375rem;margin-bottom:.875rem;color:var(--text);}",
            ".u4aTplWiz__cardBody{min-width:0;}",
            /* WZD3 Report Template — 원본 단일 위저드 6스텝. 통합 진행바 1개(sticky) + Form/Table 카드 스택 */
            ".u4aTplWiz__wz3{display:flex;flex-direction:column;}",
            /* 통합 내비게이터 바로 아래 Form 카드묶음과 Table 카드묶음이 이어지므로 위쪽 카드묶음의 하단 패딩 제거(이중 여백 방지) */
            ".u4aTplWiz__wz3 > .u4aTplWiz__steps:not(:last-child){padding-bottom:0;}",
            /* 반응형 — 좁은 폭에서 패딩 축소(고정 px 폭 지양, .analy 12 §7) */
            "@media (max-width:52rem){.u4aTplWiz__steps{padding:.75rem;}.u4aTplWiz__wzNav{padding:.5rem .75rem;}.u4aTplWiz__stepCard{padding:.75rem .875rem;}.u4aTplWiz__mainHead,.u4aTplWiz__paneHead{padding-left:.75rem;padding-right:.75rem;}}",
            /* 모션 최소화 선호 시 애니메이션/트랜지션 해제 (.analy/16 §9 · ws20.css 페이지전환과 동일 정책) */
            "@media (prefers-reduced-motion: reduce){.u4aTplWiz__navNum,.u4aTplWiz__navStep,.u4aTplWiz__navConn::after,.u4aTplWiz__navMiniStep .u4aTplWiz__navLbl{transition:none;}.u4aTplWiz__navStep.is-current .u4aTplWiz__navNum{transform:none;}.u4aTplWiz__steps .u4aTplWiz__stepCard:not([hidden]){animation:none;}}",
            ".u4aTplWiz__tblWrap{width:100%;max-width:100%;overflow-x:auto;}",
            /* ★ 데이터 컬럼 = 고정폭(§3.4.2), 마지막에 폭 미지정 "채움 컬럼" 하나로 나머지 흡수(원본 UI5 동일).
               table-layout:fixed 는 폭 지정 컬럼을 고정하고 남는 폭을 폭 미지정 컬럼(채움)에만 준다 →
               데이터 컬럼 stretch 없음(리사이즈 정확), 격자는 우측 끝까지 채움. 데이터 폭 합 > 랩이면 채움=0 + 가로 스크롤. */
            ".u4aTplWiz__tbl{width:100%;}",
            /* 채움 컬럼(빈 헤더/셀) — 최소폭 0(데이터 컬럼 폭 보호), 좌측 구분선은 앞 셀 box-shadow 가 그린다. */
            ".u4aTplWiz__tbl th.u4aTplWiz__fillCol,.u4aTplWiz__tbl td.u4aTplWiz__fillCol{min-width:0;padding:0;}",
            ".u4aTplWiz__tbl th,.u4aTplWiz__tbl td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
            ".u4aTplWiz__tbl td{padding:.1875rem .375rem;vertical-align:middle;}",
            /* 세로 컬럼 구분선 (원본 sap.ui.table.Table 셀 보더) — 마지막 컬럼 제외.
               ★border-right(collapse 보더) 대신 box-shadow inset : 공통 .u4a-table 은 table-layout:fixed+
               border-collapse:collapse 라, 리사이즈로 컬럼 x 가 소수px 가 되면 collapse 1px 보더가 픽셀 스냅에
               걸려 나왔다 사라졌다 한다(떨림). box-shadow 는 셀 자기 박스에 그려 스냅에 안 사라진다. */
            ".u4aTplWiz__tbl tbody td{box-shadow:inset -1px 0 0 var(--line);}",
            ".u4aTplWiz__tbl tbody td:last-child{box-shadow:none;}",
            /* 헤더 th = static (진행바 sticky 와 충돌 방지) + 동일 box-shadow 세로선(바디와 같은 컬럼 경계 정렬) */
            ".u4aTplWiz__tbl thead th{position:static;box-shadow:inset -1px 0 0 var(--line);}",
            ".u4aTplWiz__tbl thead th:last-child{box-shadow:none;}",
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
