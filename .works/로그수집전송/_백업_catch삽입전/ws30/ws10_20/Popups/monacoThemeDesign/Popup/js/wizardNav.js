/************************************************************************
 * monacoThemeDesign/Popup/js/wizardNav.js  (HTML5)
 * ----------------------------------------------------------------------
 *  위저드 진행 내비게이터 + 스텝 카드 + 스크롤스파이 — **UI 템플릿 마법사
 *  (js/fnUiTempWizardPopupOpen.js)의 위저드 UX를 100% 그대로 이식**(장군님 지시).
 *   · 클래스명(.u4aTplWiz__*)·CSS 규칙·동작(번호 원 + 연결선 진행, 반응형 축소 mini,
 *     겹친 원 그룹 + 구간 팝오버, 스크롤스파이 current 이동, 하단 가상여백)을 동일 유지 →
 *     테마 디자이너 위저드가 UI 템플릿 마법사와 시각·조작이 완전히 같다.
 *   · 별창(다른 document)이라 원본 모듈을 직접 못 쓰므로 코드를 복사한다.
 *     원본은 "섹션(sec)" 다중 구조(WZD3 6스텝 통합)를 지원하나, 여기선 단일 위저드(3스텝)만
 *     쓰므로 sec/numOffset/sharedNav 분기만 제거(그 외 로직·수치·CSS는 원본 그대로).
 *
 *  API: U4ATplWiz.ensureStyle() / buildNav(provider) / syncNav(nav) /
 *       makeCard(nav, idx, host) / scrollToCard(nav, idx) /
 *       attachSpy(page) / updateScrollPad(page) / markCurrent(a) / closePop(nav)
 *   - provider() → [{ label, avail, current, scroll }]  (원본 동일 계약)
 ************************************************************************/

(function (window) {
    "use strict";

    function _el(sTag, sCls, sText) {
        var o = window.document.createElement(sTag);
        if (sCls) { o.className = sCls; }
        if (sText != null) { o.textContent = sText; }
        return o;
    }

    var aNavs = [];   // 정리 대상(RO/팝오버)

    /* ==================================================================
     * 진행 내비게이터 (원본 sap.m.WizardProgressNavigator)
     *   ★full(전체 표시) 스텝 DOM 은 한 번만 만들고 _syncNav 는 클래스/텍스트만 바꾼다(in-place) →
     *     번호 원 채움·연결선 진행이 CSS transition 으로 부드럽게 애니메이션.
     *   ★mini(축소) 는 폭에 따라 넘치는 스텝을 "겹친 원(그룹)" 하나로 접어 매 리사이즈마다 재배치.
     * ================================================================== */
    function _buildNav(fnProvider) {
        var nav = { provider: fnProvider, selIdx: null, els: { full: [], conns: [], cards: [] } };
        var oNav = _el("div", "u4aTplWiz__wzNav");
        var oFull = _el("div", "u4aTplWiz__navFull");
        var oMini = _el("div", "u4aTplWiz__navMini");
        var n = fnProvider().length;
        for (var i = 0; i < n; i++) {
            if (i > 0) { var oConn = _el("div", "u4aTplWiz__navConn"); oFull.appendChild(oConn); nav.els.conns[i] = oConn; }
            oFull.appendChild(_navMakeStep(nav, i));
        }
        oNav.appendChild(oFull);
        oNav.appendChild(oMini);
        nav.els.nav = oNav; nav.els.navFull = oFull; nav.els.navMini = oMini;
        if (window.ResizeObserver) {
            try { nav.ro = new window.ResizeObserver(function () { _wzNavResize(nav); }); nav.ro.observe(oNav); } catch (e) { }
        }
        aNavs.push(nav);
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

    // 현재(진행 위치) = available 중 가장 마지막(원본 Wizard current step).
    function _navMarkCurrent(a) {
        var cur = -1;
        for (var i = 0; i < a.length; i++) { if (a[i].avail) { cur = i; } }
        if (cur >= 0) { a[cur].current = true; }
    }

    // provider() + 수동 선택(nav.selIdx) 반영 — 사용자가 특정 스텝을 고르면 그 원이 current(선택 표시).
    function _navSteps(nav) {
        var a = nav.provider();
        if (nav.selIdx != null && a[nav.selIdx] && a[nav.selIdx].avail) {
            for (var i = 0; i < a.length; i++) { a[i].current = (i === nav.selIdx); }
        }
        return a;
    }

    // 스텝 선택(원본 setCurrentStep) — 해당 카드로 스크롤. 선택 표시는 스크롤스파이가 따라 이동.
    function _navGo(nav, idx) {
        var a = _navSteps(nav);
        if (!a[idx] || !a[idx].avail) { return; }
        a[idx].scroll();
    }

    // in-place 갱신(full) — 라벨/available/current + 연결선 진행(is-done)만 토글.
    function _syncNav(nav) {
        if (!nav) { return; }
        var a = _navSteps(nav);
        for (var i = 0; i < a.length; i++) {
            var st = a[i], f = nav.els.full[i];
            if (f) {
                f.lbl.textContent = st.label;
                // 라벨이 말줄임(잘림)일 때만 공통 툴팁으로 전체 텍스트 (.analy/16 §2.9a)
                f.root.setAttribute("data-tip", st.label);
                f.root.setAttribute("data-tip-trunc-sel", ".u4aTplWiz__navLbl");
                f.root.classList.toggle("is-avail", st.avail);
                f.root.classList.toggle("is-current", st.current);
            }
            if (i > 0 && nav.els.conns[i]) { nav.els.conns[i].classList.toggle("is-done", st.avail); }
        }
        _wzNavResize(nav);
    }

    // 반응형 : full 이 컨테이너를 넘치면 mini(축소)로 전환(원본 WizardProgressNavigator collapse).
    function _wzNavResize(nav) {
        var oNav = nav.els.nav, oFull = nav.els.navFull;
        if (!oNav || !oFull || !window.document.body.contains(oNav)) { return; }
        oNav.classList.remove("is-collapsed");
        if (oNav.clientWidth <= 0) { return; }
        var bOver = oFull.scrollWidth > oFull.clientWidth + 1;
        oNav.classList.toggle("is-collapsed", bOver);
        if (bOver) { _renderMiniCollapsed(nav); }
    }

    /* ---- 축소(mini) 재배치 [측정 기반] ---- */
    function _renderMiniCollapsed(nav) {
        var a = _navSteps(nav), N = a.length;
        var oMini = nav.els.navMini;
        if (!N) { oMini.innerHTML = ""; return; }

        var cur = 0;
        for (var i = 0; i < N; i++) { if (a[i].current) { cur = i; } }

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
        paint(lo, hi);
        var guard = 0;
        while (overflow() && guard++ < N * 2) {
            var canHi = hi > cur, canLo = lo < cur;
            if (!canHi && !canLo) { break; }
            if (canHi && (!canLo || (hi - cur) >= (cur - lo))) { hi--; } else { lo++; }
            paint(lo, hi);
        }

        var bChanged = false;
        if (lo === 1) { lo = 0; bChanged = true; }
        if (hi === N - 2) { hi = N - 1; bChanged = true; }
        if (bChanged) { paint(lo, hi); }

        _compressMini(nav);
    }

    // 넘침 보정 — 현재 칩(라벨) 제외한 원/그룹/연결선에 음수 마진으로 겹쳐 폭 축소.
    function _compressMini(nav) {
        var mini = nav.els.navMini;
        for (var k = 0; k < mini.children.length; k++) { mini.children[k].style.marginLeft = ""; }
        var over = mini.scrollWidth - mini.clientWidth;
        if (over <= 2) { return; }
        var aShrink = [];
        for (var i = 1; i < mini.children.length; i++) {
            if (!mini.children[i].classList.contains("is-current")) { aShrink.push(mini.children[i]); }
        }
        if (!aShrink.length) { return; }
        var per = Math.min(Math.ceil(over / aShrink.length) + 1, 14);
        for (var j = 0; j < aShrink.length; j++) { aShrink[j].style.marginLeft = (-per) + "px"; }
    }

    // 축소 개별 원(번호 + 현재만 라벨).
    function _miniChip(nav, a, idx, bCur) {
        var st = a[idx];
        var oStep = _el("div", "u4aTplWiz__navStep u4aTplWiz__navMiniStep");
        if (st.avail) { oStep.classList.add("is-avail"); }
        if (bCur) { oStep.classList.add("is-current"); }
        oStep.appendChild(_el("div", "u4aTplWiz__navNum", String(idx + 1)));
        var oLbl = _el("span", "u4aTplWiz__navLbl");
        if (bCur) { oLbl.textContent = st.label; }
        oStep.appendChild(oLbl);
        oStep.title = (idx + 1) + ". " + st.label;
        oStep.addEventListener("click", function () { _navGo(nav, idx); });
        return oStep;
    }

    // 겹친 원(그룹) — [iFrom..iTo] 를 하나로 접어 표시. 클릭 시 그 구간만 팝오버.
    function _miniGroup(nav, a, iFrom, iTo) {
        var oG = _el("div", "u4aTplWiz__navGroup");
        var bAny = false;
        for (var i = iFrom; i <= iTo; i++) { if (a[i].avail) { bAny = true; break; } }
        if (bAny) { oG.classList.add("is-avail"); }
        oG.appendChild(_el("div", "u4aTplWiz__navNum", String(iFrom + 1)));
        var aTip = [];
        for (var t = iFrom; t <= iTo; t++) { aTip.push((t + 1) + ". " + a[t].label); }
        oG.setAttribute("title", aTip.join("\n"));
        oG.addEventListener("click", function (ev) { ev.stopPropagation(); _wzOpenStepPopover(nav, ev.currentTarget, iFrom, iTo); });
        return oG;
    }

    // 축소 연결선(고정폭).
    function _miniConn(a, iRight) {
        var oC = _el("div", "u4aTplWiz__navConn u4aTplWiz__navConnMini");
        if (a[iRight] && a[iRight].avail) { oC.classList.add("is-done"); }
        return oC;
    }

    // 스텝 팝오버 (원본 grouped step popover).
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

        // 별창엔 모달 dialog 가 없으므로 body 에 append(원본은 oUI.dlg || document.body).
        window.document.body.appendChild(oPop);
        var r = oAnchor.getBoundingClientRect();
        oPop.style.left = Math.round(r.left) + "px";
        oPop.style.top = Math.round(r.bottom + 4) + "px";
        var pr = oPop.getBoundingClientRect();
        if (pr.right > window.innerWidth - 8) {
            oPop.style.left = Math.round(Math.max(8, window.innerWidth - 8 - pr.width)) + "px";
        }

        nav.els.pop = oPop;
        nav._popClose = function () { _wzClosePop(nav); };
        setTimeout(function () {
            window.document.addEventListener("mousedown", nav._popOutside = function (ev) {
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
        if (nav._popOutside) { try { window.document.removeEventListener("mousedown", nav._popOutside, true); } catch (e) { } nav._popOutside = null; }
        if (nav._popClose) {
            try { window.removeEventListener("resize", nav._popClose); } catch (e) { }
            if (nav._popScroller) { try { nav._popScroller.removeEventListener("scroll", nav._popClose, true); } catch (e) { } }
            nav._popClose = null; nav._popScroller = null;
        }
        if (nav.els && nav.els.pop) { try { nav.els.pop.remove(); } catch (e) { } nav.els.pop = null; }
    }

    /* ==================================================================
     * 스텝 카드 (원본 _card) — 번호 제목 + 본문. hidden = 미도달(available=false).
     * ================================================================== */
    function _makeCard(nav, idx, oHost) {
        var oCard = _el("div", "u4aTplWiz__stepCard");
        var oHead = _el("div", "u4aTplWiz__cardHead");
        oCard.appendChild(oHead);
        var oBody = _el("div", "u4aTplWiz__cardBody");
        oCard.appendChild(oBody);
        oCard.__nav = nav; oCard.__idx = idx;    // 스크롤스파이 : 카드 → 스텝 인덱스
        nav.els.cards[idx] = { root: oCard, head: oHead, body: oBody };
        oHost.appendChild(oCard);
        return oBody;
    }

    // 카드 제목(번호) + 노출(available) 갱신 — 원본 _wzGateCards.
    function _gateCards(nav) {
        var a = _navSteps(nav);
        for (var j = 0; j < a.length; j++) {
            var c = nav.els.cards[j];
            if (!c) { continue; }
            c.head.textContent = (j + 1) + ". " + a[j].label;
            c.root.hidden = !a[j].avail;
        }
    }

    // 카드로 스크롤(available 시).
    function _scrollToCard(nav, idx) {
        var c = nav.els.cards[idx];
        if (c && c.root && !c.root.hidden) {
            try { c.root.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { }
        }
    }

    /* ==================================================================
     * 스크롤스파이 / 하단 가상여백 (원본 _scrollSpy / _updateScrollPad)
     * ================================================================== */
    function _scrollSpy(oPage) {
        if (!oPage || !window.document.body.contains(oPage)) { return; }
        var oNavEl = oPage.querySelector(".u4aTplWiz__wzNav");
        var iNavH = oNavEl ? oNavEl.offsetHeight : 0;
        var iLine = oPage.getBoundingClientRect().top + Math.max(iNavH, 56) + 16;
        var aCards = oPage.querySelectorAll(".u4aTplWiz__stepCard");
        var oActive = null;
        for (var i = 0; i < aCards.length; i++) {
            if (aCards[i].hidden) { continue; }
            var iTop = aCards[i].getBoundingClientRect().top;
            if (iTop <= iLine + 2) { oActive = aCards[i]; }
            else if (oActive) { break; }
        }
        if (!oActive) {
            for (var j = 0; j < aCards.length; j++) { if (!aCards[j].hidden) { oActive = aCards[j]; break; } }
        }
        if (!oActive || !oActive.__nav) { return; }
        var nav = oActive.__nav;
        var idx = oActive.__idx;
        if (nav.selIdx !== idx) { nav.selIdx = idx; _syncNav(nav); }
    }

    function _updateScrollPad(oPage) {
        if (!oPage || !oPage.__pad || !window.document.body.contains(oPage)) { return; }
        var aCards = oPage.querySelectorAll(".u4aTplWiz__stepCard");
        var oLast = null;
        for (var i = aCards.length - 1; i >= 0; i--) { if (!aCards[i].hidden) { oLast = aCards[i]; break; } }
        var iH = 0;
        var iPageH = oPage.clientHeight;
        if (oLast && iPageH > 0) { iH = Math.max(0, iPageH - oLast.offsetHeight - 8); }
        oPage.__pad.style.height = iH + "px";
    }

    // 스크롤스파이 + 하단여백 RO 배선(원본 _buildMainPage 의 page 배선과 동일).
    function _attachSpy(oPage, oPad) {
        oPage.__pad = oPad;
        if (window.ResizeObserver) {
            try {
                var oContent = oPage.firstElementChild;
                var roPad = new window.ResizeObserver(function () { _updateScrollPad(oPage); });
                roPad.observe(oPage);
                if (oContent) { roPad.observe(oContent); }
                oPage.__ro = roPad;
            } catch (e) { }
        }
        oPage.addEventListener("scroll", function () {
            if (oPage.__spyRaf) { return; }
            oPage.__spyRaf = window.requestAnimationFrame(function () { oPage.__spyRaf = 0; _scrollSpy(oPage); });
        }, { passive: true });
    }

    /* ==================================================================
     * 스타일 1회 주입 — 원본 fnUiTempWizardPopupOpen lf_ensureStyle 의 위저드 관련 규칙 그대로.
     * ================================================================== */
    function _ensureStyle() {
        if (window.document.getElementById("u4aTplWizStyle")) { return; }
        var css = [
            /* 위자드 (원본 sap.m.Wizard) — 진행 내비게이터(스티키) + 번호 스텝 카드 */
            ".u4aTplWiz__wz{display:flex;flex-direction:column;}",
            ".u4aTplWiz__page{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0;}",
            /* 스크롤 하단 가상 여백 — 마지막 스텝 카드도 페이지 최상단까지 스크롤되게 */
            ".u4aTplWiz__scrollPad{width:100%;flex:0 0 auto;pointer-events:none;}",
            ".u4aTplWiz__wzNav{position:sticky;top:0;z-index:2;display:flex;align-items:center;padding:.75rem 1.25rem;background:var(--surface);border-bottom:.0625rem solid var(--line);}",
            ".u4aTplWiz__navFull{display:flex;align-items:center;flex:1 1 auto;min-width:0;overflow:hidden;}",
            ".u4aTplWiz__navMini{display:none;align-items:center;flex:1 1 auto;min-width:0;gap:0;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navFull{display:none;}",
            ".u4aTplWiz__wzNav.is-collapsed .u4aTplWiz__navMini{display:flex;}",
            ".u4aTplWiz__navMiniStep{cursor:pointer;min-width:0;flex:0 0 auto;gap:0;}",
            ".u4aTplWiz__navMiniStep.is-current{flex:0 0 auto;}",
            ".u4aTplWiz__navConnMini{flex:0 0 auto;width:1rem;min-width:1rem;margin:0 .25rem;}",
            /* 겹친 원(그룹) — 넘치는 스텝 묶음. 클릭=구간 팝오버 */
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
            ".u4aTplWiz__navStep.is-current .u4aTplWiz__navNum{background:var(--accent);border-color:var(--accent);color:#fff;transform:scale(1.08);}",
            /* 축소형(mini) : 현재 스텝 라벨만 부드럽게 펼침 */
            ".u4aTplWiz__navMiniStep .u4aTplWiz__navLbl{max-width:0;opacity:0;margin-left:0;transition:max-width .3s ease,opacity .3s ease,margin-left .3s ease;}",
            ".u4aTplWiz__navMiniStep.is-current .u4aTplWiz__navLbl{max-width:none;opacity:1;margin-left:.5rem;flex:0 0 auto;overflow:visible;text-overflow:clip;}",
            /* 연결선 — is-done(뒤 스텝 도달) 시 좌→우로 accent 채움 */
            ".u4aTplWiz__navConn{position:relative;overflow:hidden;flex:1 1 auto;height:.0625rem;background:var(--line);margin:0 1rem;min-width:1.5rem;}",
            ".u4aTplWiz__navConn::after{content:\"\";position:absolute;left:0;top:0;bottom:0;width:0;background:var(--accent);transition:width .35s ease;}",
            ".u4aTplWiz__navConn.is-done::after{width:100%;}",
            /* 스텝 팝오버(반응형 축소 시 그룹→목록) */
            ".u4aTplWiz__navPop{position:fixed;z-index:5;min-width:12rem;background:var(--surface-raised);border:.0625rem solid var(--line);border-radius:var(--radius);box-shadow:var(--popover-shadow);padding:.25rem;}",
            ".u4aTplWiz__navPopRow{display:flex;align-items:center;gap:.5rem;padding:.375rem .625rem;border-radius:var(--radius-sm);cursor:pointer;white-space:nowrap;color:var(--text);}",
            ".u4aTplWiz__navPopRow:hover{background:var(--hover-bg);}",
            ".u4aTplWiz__navPopRow.is-current{color:var(--accent);font-weight:600;}",
            ".u4aTplWiz__navPopRow.is-disabled{color:var(--text-muted);opacity:.5;cursor:default;}",
            ".u4aTplWiz__navPopRow.is-disabled:hover{background:none;}",
            ".u4aTplWiz__navPopNum{width:1.5rem;height:1.5rem;border-radius:50%;border:.125rem solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:600;flex:0 0 auto;box-sizing:border-box;}",
            ".u4aTplWiz__navPopRow.is-current .u4aTplWiz__navPopNum{background:var(--accent);border-color:var(--accent);color:#fff;}",
            /* 스텝 카드 */
            ".u4aTplWiz__steps{display:flex;flex-direction:column;gap:1rem;padding:1.25rem;}",
            ".u4aTplWiz__stepCard{background:var(--surface-raised);border:.0625rem solid var(--line);border-radius:var(--radius);padding:1rem 1.25rem;scroll-margin-top:4rem;box-sizing:border-box;max-width:100%;}",
            "@keyframes u4aTplWizCardIn{from{opacity:0;transform:translateY(.5rem);}to{opacity:1;transform:none;}}",
            ".u4aTplWiz__steps .u4aTplWiz__stepCard:not([hidden]){animation:u4aTplWizCardIn .28s ease both;}",
            ".u4aTplWiz__cardHead{font-weight:700;font-size:.9375rem;margin-bottom:.875rem;color:var(--text);}",
            ".u4aTplWiz__cardBody{min-width:0;}",
            /* 반응형 — 좁은 폭에서 패딩 축소(고정 px 폭 지양, .analy 12 §7) */
            "@media (max-width:52rem){.u4aTplWiz__steps{padding:.75rem;}.u4aTplWiz__wzNav{padding:.5rem .75rem;}.u4aTplWiz__stepCard{padding:.75rem .875rem;}}",
            /* 모션 최소화 선호 시 애니메이션/트랜지션 해제 (.analy/16 §9) */
            "@media (prefers-reduced-motion: reduce){.u4aTplWiz__navNum,.u4aTplWiz__navStep,.u4aTplWiz__navConn::after,.u4aTplWiz__navMiniStep .u4aTplWiz__navLbl{transition:none;}.u4aTplWiz__navStep.is-current .u4aTplWiz__navNum{transform:none;}.u4aTplWiz__steps .u4aTplWiz__stepCard:not([hidden]){animation:none;}}"
        ].join("\n");
        var oStyle = window.document.createElement("style");
        oStyle.id = "u4aTplWizStyle";
        oStyle.textContent = css;
        window.document.head.appendChild(oStyle);
    }

    window.U4ATplWiz = {
        ensureStyle: _ensureStyle,
        buildNav: _buildNav,
        syncNav: _syncNav,
        markCurrent: _navMarkCurrent,
        makeCard: _makeCard,
        gateCards: _gateCards,
        scrollToCard: _scrollToCard,
        attachSpy: _attachSpy,
        updateScrollPad: _updateScrollPad,
        closePop: _wzClosePop
    };

})(window);
