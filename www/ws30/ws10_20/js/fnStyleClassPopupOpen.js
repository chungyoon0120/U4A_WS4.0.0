/************************************************************************
 * fnStyleClassPopupOpen.js  (HTML5) — WS20 속성 styleClass 값도움(F4) "미리 정의된 CSS"
 * ----------------------------------------------------------------------
 * 원본: design/attributesArea/styleClassPopup.js  +  design/html/documents/styleClassPopup/index.html
 *   · styleClass 프로퍼티 행의 확장 편집(⧉) 버튼 → 미리 정의된 SAPUI5 CSS 클래스 참조 목록.
 *   트리거 : ws_html5_ws20_attr.js 값필드 F4 핸들러(styleClass 분기) → oAPP.loadJs 온디맨드 후 호출.
 *
 * ★ 목록 데이터(원본 1:1)
 *   · 미리 정의 CSS 8구획 ~40종(마진/밀도/유틸/노마진) 인라인(SSOT=원본 index.html). 클래스명=리터럴,
 *     제목/설명=전부 메시지키(ZMSG_WS_COMMON_001). 클래스↔설명 40쌍 diff 검증.
 *
 * ★ UX = 앵커바(ObjectPageLayout) 방식 (2026-07-09, 사용자 지정)
 *   · [좌 앵커바] 공통 사이드네비 `.u4a-navlist`(§16 §3.7) — 8구획 목록(+매치 개수). 클릭 → 우측이 해당
 *     구획으로 자동 스크롤. 우측 스크롤 시 현재 구획 자동 활성(scroll-spy, aria-selected).
 *   · [우 콘텐츠] 구획별 섹션(sticky 헤더 + 클래스 행). 행 더블클릭 → styleClass 값에 추가(중복 무시).
 *   · [적용 값 바] 현재 styleClass 를 칩으로 + 각 칩 × 삭제(원본에 없던 지우기).
 *   · [검색] 클래스명 + (메시지 DB 에서 미리 해석한 현지화 설명) 키워드 필터 → 매치 구획만 표시 + 좌 앵커
 *     개수/비활성 갱신. 설명이 이미 로그인 언어라 언어 분기 불필요. (placeholder=MSG_WS 294, 없음=174.)
 *   · 커밋 = fnWs20AttrChange(sAttr,"INPUT")(색/아이콘 F4 형제 동일 경로, undo 단일푸시, 동기라 busy 깜빡임 없음).
 *     바인딩(ISBND="X")=추가없이 닫기(원본 보호). 조회(IS_EDIT=false)=참조 전용(값바 숨김·행 액션 없음).
 *
 * ★ UI (SSOT=.analy/16) : 네이티브 .u4a-dialog(§2.1/§2.5/§2.2) + 공통 .u4a-navlist(§3.7). 색=의미토큰만,
 *   문구=메시지키만. u4a-compact 미사용(행 압축 금지). 설명 줄바꿈 허용.
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};

    var C_DLG_ID = "u4aWsStyleClassDlg";

    /* ── 미리 정의된 CSS 클래스 목록 — 원본 index.html 1:1 인라인(SSOT=원본) ─────────── */
    var C_SECTIONS = [
        {
            titleNr: "568", descNr: "569", rows: [   // Full Margins
                ["sapUiTinyMargin", "570"], ["sapUiSmallMargin", "571"],
                ["sapUiMediumMargin", "572"], ["sapUiLargeMargin", "573"]
            ]
        },
        {
            titleNr: "574", descNr: "575", rows: [   // Single-Sided Margins
                ["sapUiTinyMarginTop", "576"], ["sapUiTinyMarginBottom", "577"],
                ["sapUiTinyMarginBegin", "578"], ["sapUiTinyMarginEnd", "579"],
                ["sapUiSmallMarginTop", "580"], ["sapUiSmallMarginBottom", "581"],
                ["sapUiSmallMarginBegin", "582"], ["sapUiSmallMarginEnd", "583"],
                ["sapUiMediumMarginTop", "584"], ["sapUiMediumMarginBottom", "585"],
                ["sapUiMediumMarginBegin", "586"], ["sapUiMediumMarginEnd", "587"],
                ["sapUiLargeMarginTop", "588"], ["sapUiLargeMarginBottom", "589"],
                ["sapUiLargeMarginBegin", "590"], ["sapUiLargeMarginEnd", "591"]
            ]
        },
        {
            titleNr: "592", descNr: "593", rows: [   // Two-Sided Margins
                ["sapUiTinyMarginBeginEnd", "594"], ["sapUiTinyMarginTopBottom", "595"],
                ["sapUiSmallMarginBeginEnd", "596"], ["sapUiSmallMarginTopBottom", "597"],
                ["sapUiMediumMarginBeginEnd", "598"], ["sapUiMediumMarginTopBottom", "599"],
                ["sapUiLargeMarginBeginEnd", "600"], ["sapUiLargeMarginTopBottom", "601"]
            ]
        },
        {
            titleNr: "602", descNr: "603", rows: [   // Negative Margins
                ["sapUiTinyNegativeMarginBeginEnd", "604"], ["sapUiSmallNegativeMarginBeginEnd", "605"],
                ["sapUiMediumNegativeMarginBeginEnd", "606"], ["sapUiLargeNegativeMarginBeginEnd", "607"]
            ]
        },
        {
            titleNr: "608", descNr: "609", rows: [   // Responsive Margin
                ["sapUiResponsiveMargin", "610"]
            ]
        },
        {
            titleNr: "611", descNr: "612", rows: [   // Content Density
                ["sapUiSizeCozy", "613"], ["sapUiSizeCompact", "614"]
            ]
        },
        {
            titleNr: "615", descNr: "616", rows: [   // Utility
                ["sapUiForceWidthAuto", "617"]
            ]
        },
        {
            titleNr: "618", descNr: "619", rows: [   // No Margin
                ["sapUiNoMargin", "620"], ["sapUiNoMarginTop", "621"], ["sapUiNoMarginBottom", "622"],
                ["sapUiNoMarginBegin", "623"], ["sapUiNoMarginEnd", "624"]
            ]
        }
    ];

    /* ── 헬퍼 ───────────────────────────────────────────────────────── */
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (typeof txt !== "undefined") { o.textContent = txt; }
        return o;
    }
    function _wsC(sNr) {
        try {
            var s = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    function _msgM(sNr) {   // /U4A/MSG_WS (294=검색 placeholder, 174=결과 없음)
        try {
            var s = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", sNr);
            if (s != null && s !== "" && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }
    function _isEdit() {
        try { return oAPP.attr.oModel.oData.IS_EDIT === true; } catch (e) { return false; }
    }

    /* ── 단일 인스턴스 + 상태 ────────────────────────────────────────── */
    var oUI = null;    // { dlg, nav, content, searchInp, searchClr, valueBar, valueChips, valueEmpty }
    var oCtx = null;   // { attr, edit }
    var oModel = null; // 해석된 구획/행(설명=현지화 — 검색 대상)
    var sQuery = "";
    var bSpyOff = false;   // 앵커 클릭 스크롤 중 scroll-spy 일시 정지

    function _close() {
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    function _resolveModel() {
        oModel = C_SECTIONS.map(function (sec) {
            return {
                title: _wsC(sec.titleNr),
                desc: _wsC(sec.descNr),
                rows: sec.rows.map(function (r) { return { cls: r[0], desc: _wsC(r[1]) }; })
            };
        });
    }
    function _match(r) {
        if (!sQuery) { return true; }
        return r.cls.toLowerCase().indexOf(sQuery) !== -1 ||
            (r.desc && r.desc.toLowerCase().indexOf(sQuery) !== -1);
    }

    function _curArr() {
        var v = (oCtx && oCtx.attr && oCtx.attr.UIATV != null) ? String(oCtx.attr.UIATV) : "";
        return v.split(/\s+/).filter(Boolean);
    }
    function _commit(aCls) {
        oCtx.attr.UIATV = aCls.join(" ");
        try { oAPP.fn.fnWs20AttrChange(oCtx.attr, "INPUT"); }
        catch (e) { console.error("[HTML5][WS20][styleClass] 커밋 오류:", e && e.message); }
        _renderAll();
    }
    function _addClass(sCls) {
        if (!sCls || !oCtx || oCtx.edit !== true) { return; }
        if (oCtx.attr.ISBND === "X") { _close(); return; }
        var a = _curArr();
        if (a.indexOf(sCls) !== -1) { return; }
        a.push(sCls);
        _commit(a);
    }
    function _removeClass(sCls) {
        if (!sCls || !oCtx || oCtx.edit !== true) { return; }
        _commit(_curArr().filter(function (c) { return c !== sCls; }));
    }

    /* ── 적용 값 바 ── */
    function _updateValueBar() {
        if (!oUI || !oUI.valueBar) { return; }
        if (!oCtx || oCtx.edit !== true) { oUI.valueBar.hidden = true; return; }
        oUI.valueBar.hidden = false;

        var a = _curArr();
        oUI.valueChips.innerHTML = "";
        if (a.length === 0) { oUI.valueEmpty.hidden = false; return; }
        oUI.valueEmpty.hidden = true;

        a.forEach(function (c) {
            var oChip = _el("span", "u4aScsValChip");
            oChip.appendChild(_el("code", "u4aScsValChipTxt u4a-selectable", c));
            var oDel = _el("button", "u4aScsValChipDel");
            oDel.type = "button"; oDel.title = c; oDel.innerHTML = _fa("xmark");
            oDel.addEventListener("click", function () { _removeClass(c); });
            oChip.appendChild(oDel);
            oUI.valueChips.appendChild(oChip);
        });
    }

    /* ── 좌 앵커바 + 우 콘텐츠 렌더 ── */
    function _renderAll() {
        if (!oUI) { return; }

        var oAdded = {};
        _curArr().forEach(function (c) { oAdded[c] = true; });

        //구획별 매치 행 계산(검색 반영).
        var aGroups = oModel.map(function (sec, i) {
            return { sec: sec, gi: i, rows: sec.rows.filter(_match) };
        });

        // ── 좌 앵커바 ──
        oUI.nav.innerHTML = "";
        aGroups.forEach(function (g) {
            var oItem = _el("button", "u4a-navlist__item u4aScsNavItem");
            oItem.type = "button";
            oItem.setAttribute("data-gi", String(g.gi));
            oItem.appendChild(_el("span", null, g.sec.title));
            oItem.appendChild(_el("small", "u4aScsNavCount", String(g.rows.length)));
            if (g.rows.length === 0) {
                oItem.setAttribute("aria-disabled", "true");
                oItem.disabled = true;
            } else {
                oItem.addEventListener("click", function () { _scrollTo(g.gi); });
            }
            oUI.nav.appendChild(oItem);
        });

        // ── 우 콘텐츠 ──
        oUI.content.innerHTML = "";
        var bAny = false;
        aGroups.forEach(function (g) {
            if (g.rows.length === 0) { return; }
            bAny = true;

            var oSec = _el("section", "u4aScsSec");
            oSec.setAttribute("data-gi", String(g.gi));

            var oHead = _el("div", "u4aScsSecHead");
            oHead.appendChild(_el("div", "u4aScsSecTitle", g.sec.title));
            oHead.appendChild(_el("div", "u4aScsSecDesc u4a-selectable", g.sec.desc));
            oSec.appendChild(oHead);

            g.rows.forEach(function (r) {
                var bAdded = oAdded[r.cls] === true;
                var oRow = _el("div", "u4aScsRow" + (bAdded ? " u4aScsRow--added" : ""));

                var oCls = _el("div", "u4aScsCls");
                oCls.appendChild(_el("code", "u4aScsCode u4a-selectable", r.cls));
                if (bAdded) {
                    var oMark = _el("span", "u4aScsAddedMark");
                    oMark.innerHTML = _fa("check");
                    oCls.appendChild(oMark);
                }
                oRow.appendChild(oCls);
                oRow.appendChild(_el("div", "u4aScsDesc u4a-selectable", r.desc));

                if (oCtx && oCtx.edit === true && !bAdded) {
                    oRow.classList.add("u4aScsRow--actionable");
                    oRow.addEventListener("dblclick", function () { _addClass(r.cls); });
                }
                oSec.appendChild(oRow);
            });
            oUI.content.appendChild(oSec);
        });

        if (!bAny) {
            var oNo = _el("div", "u4aScsNodata", _msgM("174"));   // 결과 없음
            oUI.content.appendChild(oNo);
        }

        _updateValueBar();
        _spy();   // 현재 스크롤 위치 기준 앵커 활성 초기화
    }

    /* ── 앵커 클릭 → 해당 구획으로 스크롤 ── */
    function _scrollTo(gi) {
        var oSec = oUI.content.querySelector('.u4aScsSec[data-gi="' + gi + '"]');
        if (!oSec) { return; }
        bSpyOff = true;
        _setActive(gi);
        try { oUI.content.scrollTo({ top: oSec.offsetTop, behavior: "smooth" }); }
        catch (e) { oUI.content.scrollTop = oSec.offsetTop; }
        //smooth 스크롤 애니 중엔 spy 억제(끝나면 재개) — scrollend 이벤트 미지원 대비 시간 재개.
        window.setTimeout(function () { bSpyOff = false; }, 450);
    }

    /* ── scroll-spy: 현재 최상단 구획을 앵커 활성 ── */
    function _spy() {
        if (bSpyOff || !oUI || !oUI.content) { return; }
        var aSec = oUI.content.querySelectorAll(".u4aScsSec");
        if (!aSec.length) { return; }
        var iTop = oUI.content.scrollTop + 8, sGi = aSec[0].getAttribute("data-gi");
        for (var i = 0; i < aSec.length; i++) {
            if (aSec[i].offsetTop <= iTop) { sGi = aSec[i].getAttribute("data-gi"); }
        }
        _setActive(sGi);
    }
    function _setActive(gi) {
        if (!oUI || !oUI.nav) { return; }
        var aItem = oUI.nav.querySelectorAll(".u4aScsNavItem");
        for (var i = 0; i < aItem.length; i++) {
            aItem[i].setAttribute("aria-selected", aItem[i].getAttribute("data-gi") === String(gi) ? "true" : "false");
        }
    }

    /************************************************************************
     * 다이얼로그 1회 생성.
     ************************************************************************/
    function _build() {
        _ensureStyle();

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aScsDlg";

        //헤더.
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("palette") + "<span></span>";
        oHeader.querySelector("span").textContent = _wsC("626");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.innerHTML = _fa("xmark"); oX.title = _wsC("056");
        oX.addEventListener("click", function () { _close(); });
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        //바디.
        var oBody = _el("div", "u4a-dialog__body u4aScsBody");

        //(1) 안내 힌트(567).
        var oHint = _el("div", "u4aScsHintBox");
        oHint.innerHTML = _fa("circle-info") + '<span class="u4aScsHintTxt u4a-selectable"></span>';
        oHint.querySelector(".u4aScsHintTxt").textContent = _wsC("567");
        oBody.appendChild(oHint);

        //(2) 적용 값 바.
        var oValueBar = _el("div", "u4aScsValueBar");
        oValueBar.hidden = true;
        var oValLbl = _el("span", "u4aScsValLbl");
        oValLbl.innerHTML = _fa("tag") + "<span>styleClass</span>";
        oValueBar.appendChild(oValLbl);
        var oValChips = _el("span", "u4aScsValChips");
        oValueBar.appendChild(oValChips);
        var oValEmpty = _el("span", "u4aScsValEmpty", "—");
        oValEmpty.hidden = true;
        oValueBar.appendChild(oValEmpty);
        oBody.appendChild(oValueBar);

        //(3) 검색.
        var oSearch = _el("div", "u4aScsSearch");
        var oSIco = _el("span", "u4aScsSearchIco");
        oSIco.innerHTML = _fa("magnifying-glass");
        oSearch.appendChild(oSIco);
        var oSInp = document.createElement("input");
        oSInp.type = "text";
        oSInp.className = "u4a-input u4aScsSearchInp";
        oSInp.placeholder = _msgM("294");
        var oSClr = _el("button", "u4aScsSearchClr");
        oSClr.type = "button"; oSClr.innerHTML = _fa("xmark"); oSClr.hidden = true;
        function _applyQuery() {
            sQuery = (oSInp.value || "").trim().toLowerCase();
            oSClr.hidden = (oSInp.value === "");
            _renderAll();
            //검색 시 상단으로(첫 매치 구획).
            try { oUI.content.scrollTop = 0; } catch (e) { }
        }
        oSInp.addEventListener("input", _applyQuery);
        oSClr.addEventListener("click", function () { oSInp.value = ""; _applyQuery(); oSInp.focus(); });
        oSearch.appendChild(oSInp);
        oSearch.appendChild(oSClr);
        oBody.appendChild(oSearch);

        //(4) 좌 앵커바 + 우 콘텐츠.
        var oSplit = _el("div", "u4aScsSplit");
        var oNav = _el("nav", "u4a-navlist u4aScsNav");
        var oContent = _el("div", "u4aScsContent");
        oContent.addEventListener("scroll", _spy);
        oSplit.appendChild(oNav);
        oSplit.appendChild(oContent);
        oBody.appendChild(oSplit);

        oDlg.appendChild(oBody);

        //푸터 — 닫기.
        var oFoot = _el("div", "u4a-dialog__footer u4aScsFoot");
        oFoot.appendChild(_el("span", "u4aScsFootSpacer"));
        var oClose = _el("button", "u4a-btn u4a-btn--negative u4aScsBtn");
        oClose.type = "button";
        oClose.innerHTML = _fa("xmark") + "<span></span>";
        oClose.querySelector("span").textContent = _wsC("056");
        oClose.addEventListener("click", function () { _close(); });
        oFoot.appendChild(oClose);
        oDlg.appendChild(oFoot);

        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 560, minH: 420 }); }

        document.body.appendChild(oDlg);

        oUI = {
            dlg: oDlg, nav: oNav, content: oContent,
            searchInp: oSInp, searchClr: oSClr,
            valueBar: oValueBar, valueChips: oValChips, valueEmpty: oValEmpty
        };
    }

    /************************************************************************
     * 공개 진입점.
     ************************************************************************/
    oAPP.fn.fnStyleClassPopupOpen = function (is_attr) {
        if (!is_attr) { return; }

        if (!oUI || !oUI.dlg || !document.body.contains(oUI.dlg)) { oUI = null; _build(); }
        if (oUI.dlg.open) { return; }

        oCtx = { attr: is_attr, edit: _isEdit() };
        oUI.dlg.querySelector(".u4aScsBody").setAttribute("data-edit", oCtx.edit ? "true" : "false");

        //검색 초기화.
        sQuery = ""; bSpyOff = false;
        oUI.searchInp.value = "";
        oUI.searchClr.hidden = true;

        //설명 미리 해석(검색 대상 확보) → 렌더.
        _resolveModel();
        _renderAll();
        try { oUI.content.scrollTop = 0; } catch (e) { }

        try { oUI.dlg.showModal(); } catch (e) { }
    };

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰만).
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aScsStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aScsStyle";
        oStyle.textContent =
            ".u4aScsDlg { width: min(94vw, 800px); height: min(88vh, 640px); padding: 0; display: flex; flex-direction: column; }" +
            ".u4aScsDlg .u4a-dialog__header { cursor: move; user-select: none; }" +
            ".u4aScsDlg .u4a-dialog__header span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }" +
            ".u4aScsBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.7rem; padding: 0.9rem; }" +
            //안내 힌트.
            ".u4aScsHintBox { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.625rem 0.75rem; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; background: var(--surface); flex: 0 0 auto; }" +
            ".u4aScsHintBox > i { color: var(--accent); margin-top: 0.15rem; flex: 0 0 auto; font-size: 0.9rem; }" +
            ".u4aScsHintTxt { color: var(--text-muted); line-height: 1.55; font-size: 0.8125rem; }" +
            //적용 값 바.
            ".u4aScsValueBar { display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem; padding: 0.5rem 0.625rem; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); flex: 0 0 auto; }" +
            ".u4aScsValLbl { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--text-muted); font-size: 0.75rem; font-family: 'JetBrains Mono','Consolas',ui-monospace,monospace; margin-right: 0.25rem; }" +
            ".u4aScsValLbl > i { color: var(--accent); font-size: 0.78rem; }" +
            ".u4aScsValChips { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; }" +
            ".u4aScsValEmpty { color: var(--text-muted); }" +
            ".u4aScsValChip { display: inline-flex; align-items: center; gap: 0.15rem; padding: 0.1rem 0.15rem 0.1rem 0.4rem; background: var(--selected-bg); border-radius: 4px; }" +
            ".u4aScsValChipTxt { font-family: 'JetBrains Mono','Consolas',ui-monospace,monospace; font-size: 0.72rem; font-weight: 600; color: var(--accent); background: transparent; }" +
            ".u4aScsValChipDel { display: inline-flex; align-items: center; justify-content: center; width: 1.05rem; height: 1.05rem; padding: 0; border: none; background: transparent; color: var(--text-muted); cursor: pointer; border-radius: 3px; font-size: 0.7rem; line-height: 1; }" +
            ".u4aScsValChipDel:hover { background: var(--active-bg); color: var(--state-error); }" +
            //검색.
            ".u4aScsSearch { position: relative; flex: 0 0 auto; }" +
            ".u4aScsSearchIco { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem; pointer-events: none; }" +
            ".u4aScsSearchInp { width: 100%; height: 2.2rem; padding: 0 2rem 0 1.95rem; }" +
            ".u4aScsSearchClr { position: absolute; right: 0.45rem; top: 50%; transform: translateY(-50%); width: 1.2rem; height: 1.2rem; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; background: transparent; color: var(--text-muted); cursor: pointer; border-radius: 3px; font-size: 0.72rem; }" +
            ".u4aScsSearchClr:hover { background: var(--active-bg); color: var(--text); }" +
            //좌 앵커바 + 우 콘텐츠.
            ".u4aScsSplit { flex: 1 1 auto; min-height: 0; display: flex; gap: 0.75rem; }" +
            ".u4aScsNav { flex: 0 0 12.5rem; overflow: auto; padding: 0.25rem; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); gap: 0.1rem; }" +
            ".u4aScsNavItem { border-radius: 6px; min-height: 2.25rem; }" +
            ".u4aScsNavItem[disabled] { opacity: 0.4; cursor: default; }" +
            ".u4aScsNavCount { flex: 0 0 auto; font-size: 0.7rem; color: var(--text-muted); background: var(--surface-raised); border-radius: 10px; padding: 0.05rem 0.4rem; }" +
            ".u4aScsNavItem[aria-selected='true'] .u4aScsNavCount { color: var(--accent); }" +
            ".u4aScsContent { flex: 1 1 auto; min-height: 0; overflow: auto; position: relative; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); scroll-behavior: smooth; }" +
            //섹션.
            ".u4aScsSec { border-bottom: 1px solid var(--line); }" +
            ".u4aScsSec:last-child { border-bottom: none; }" +
            ".u4aScsSecHead { position: sticky; top: 0; z-index: 1; background: var(--surface); box-shadow: inset 0.1875rem 0 0 0 var(--accent); padding: 0.55rem 0.8rem; border-bottom: 1px solid var(--line); }" +
            ".u4aScsSecTitle { color: var(--accent); font-weight: 700; font-size: 0.85rem; }" +
            ".u4aScsSecDesc { color: var(--text-muted); font-size: 0.75rem; margin-top: 0.15rem; line-height: 1.45; }" +
            //행.
            ".u4aScsRow { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--line); }" +
            ".u4aScsRow:last-child { border-bottom: none; }" +
            ".u4aScsRow--actionable { cursor: pointer; }" +
            ".u4aScsRow--actionable:hover { background: var(--hover-bg); }" +
            ".u4aScsRow--added { opacity: 0.5; }" +
            ".u4aScsCls { flex: 0 0 46%; }" +
            ".u4aScsCode { display: inline-block; font-family: 'JetBrains Mono','Consolas',ui-monospace,monospace; font-size: 0.75rem; font-weight: 600; color: var(--text); background: var(--surface-raised); border: 1px solid var(--divider); border-radius: 4px; padding: 0.15rem 0.45rem; }" +
            ".u4aScsAddedMark { color: var(--state-success); margin-left: 0.4rem; font-size: 0.72rem; }" +
            ".u4aScsDesc { flex: 1 1 auto; color: var(--text); font-size: 0.8125rem; line-height: 1.5; }" +
            //결과 없음.
            ".u4aScsNodata { padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8125rem; }" +
            //푸터.
            ".u4aScsFoot { display: flex; gap: 0.5rem; align-items: center; }" +
            ".u4aScsFootSpacer { flex: 1 1 auto; }" +
            ".u4aScsBtn { display: inline-flex; align-items: center; gap: 0.375rem; }";
        document.head.appendChild(oStyle);
    }

})(window, jQuery, oAPP);
