/************************************************************************
 * U4A Workspace — 공통 UI 컴포넌트 라이브러리 (window.U4AUI)
 * ----------------------------------------------------------------------
 * shell.css(공통 컴포넌트 CSS)의 짝이 되는 "공통 컴포넌트 JS".
 * UI5 의 sap.m.* 컨트롤을 순수 HTML5 로 표준화한 빌더 모음으로,
 * 모든 화면(ServerList / Login / 향후 셸·팝업 등)이 동일하게 소비한다.
 *
 *   · 디자인/동작은 화면 무관 단일 표준 (UX 통일성)
 *   · 색·모양은 theme/tokens.css 의 의미 토큰만 소비 (하드코딩 0)
 *
 * 제공:
 *   U4AUI.el(tag, class, text)                          → 엘리먼트 생성 헬퍼
 *   U4AUI.createSelect(aItems, value, onChange)          → 커스텀 셀렉트(드롭다운)
 *     · aItems: [{ value, text }]
 *     · 반환: `.value` getter/setter 를 가진 `.u4a-combo` 엘리먼트
 *     · 네이티브 <select> 대체 — 펼침 목록(.u4a-combo__list)까지 테마 적용,
 *       키보드 내비게이션(ArrowUp/Down/Enter/Space/Esc/Tab), 모달 <dialog> 내부 지원
 ************************************************************************/
(function (global) {
    "use strict";

    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    // Font Awesome 7.2.0 solid (currentColor 상속) — shell.css 와 동일 아이콘 규칙
    const _fa = (sName) => `<i class="fa-solid fa-${sName}"></i>`;
    const ICON = {
        caret: _fa("chevron-down"),
        accept: _fa("check")
    };

    /**
     * 커스텀 셀렉트 (네이티브 <select> 대체 — 펼침 목록까지 테마 적용).
     * @param {Array<{value:string,text:string}>} aItems
     * @param {string} sValue 초기 값
     * @param {Function} [fnChange] 값 변경 콜백(newValue)
     * @returns {HTMLElement} `.value` getter/setter 를 가진 combo 엘리먼트
     */
    function createSelect(aItems, sValue, fnChange) {

        aItems = aItems || [];

        const oCombo = _el("div", "u4a-combo");
        oCombo.tabIndex = 0;
        oCombo.setAttribute("role", "combobox");
        oCombo.setAttribute("aria-haspopup", "listbox");
        oCombo.setAttribute("aria-expanded", "false");

        const oText = _el("span", "u4a-combo__text");
        const oArrow = _el("span", "u4a-combo__arrow");
        oArrow.innerHTML = ICON.caret;
        oCombo.append(oText, oArrow);

        let sCurrent = sValue;
        let oList = null;
        let iActive = -1;

        function _label(v) {
            const o = aItems.find(i => i.value === v);
            return o ? o.text : "";
        }
        oText.textContent = _label(sCurrent);

        Object.defineProperty(oCombo, "value", {
            get() { return sCurrent; },
            set(v) { sCurrent = v; oText.textContent = _label(v); }
        });

        function _onOutside(ev) {
            if (!oCombo.contains(ev.target) && (!oList || !oList.contains(ev.target))) {
                _close();
            }
        }

        function _setActive(idx) {
            if (!oList) { return; }
            const aEl = oList.querySelectorAll(".u4a-combo__item");
            aEl.forEach((el, i) => { el.dataset.active = (i === idx) ? "true" : "false"; });
            iActive = idx;
            if (aEl[idx]) { aEl[idx].scrollIntoView({ block: "nearest" }); }
        }

        function _open() {
            if (oList) { return; }
            oList = _el("div", "u4a-combo__list");
            oList.setAttribute("role", "listbox");

            let sLastGroup = null;
            aItems.forEach((it, idx) => {
                // 그룹 헤더(선택 불가) — it.group 이 바뀔 때마다 1개 삽입. group 없는 항목은 종전과 동일.
                //   (.u4a-combo__group 은 .u4a-combo__item 이 아니므로 키보드 내비/인덱스에서 자동 제외)
                if (it.group != null && it.group !== sLastGroup) {
                    sLastGroup = it.group;
                    const oGrp = _el("div", "u4a-combo__group", it.group);
                    oList.appendChild(oGrp);
                }
                const oItem = _el("div", "u4a-combo__item");
                oItem.setAttribute("role", "option");
                if (it.value === sCurrent) {
                    oItem.setAttribute("aria-selected", "true");
                    iActive = idx;
                }
                const oLbl = _el("span", null, it.text);
                const oChk = _el("span", "u4a-combo__check");
                oChk.innerHTML = ICON.accept;
                oItem.append(oLbl, oChk);
                oItem.addEventListener("mousedown", (ev) => { ev.preventDefault(); _select(idx); });
                oItem.addEventListener("mousemove", () => _setActive(idx));
                oList.appendChild(oItem);
            });

            // 모달 <dialog> 내부면 top-layer 유지 위해 dialog 에 append
            const oHost = oCombo.closest("dialog") || document.body;
            oHost.appendChild(oList);

            const r = oCombo.getBoundingClientRect();
            oList.style.left = r.left + "px";
            oList.style.top = (r.bottom + 2) + "px";
            oList.style.minWidth = r.width + "px";

            oCombo.dataset.open = "true";
            oCombo.setAttribute("aria-expanded", "true");
            _setActive(iActive < 0 ? 0 : iActive);

            setTimeout(() => document.addEventListener("mousedown", _onOutside), 0);
        }

        function _close() {
            if (!oList) { return; }
            oList.remove();
            oList = null;
            oCombo.removeAttribute("data-open");
            oCombo.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOutside);
        }

        function _select(idx) {
            const it = aItems[idx];
            if (!it) { return; }
            const bChanged = it.value !== sCurrent;
            sCurrent = it.value;
            oText.textContent = it.text;
            _close();
            oCombo.focus();
            if (bChanged && typeof fnChange === "function") {
                fnChange(sCurrent);
            }
        }

        oCombo.addEventListener("click", () => { if (oList) { _close(); } else { _open(); } });
        oCombo.addEventListener("keydown", (ev) => {
            switch (ev.key) {
                case "ArrowDown":
                    ev.preventDefault();
                    if (!oList) { _open(); } else { _setActive(Math.min(iActive + 1, aItems.length - 1)); }
                    break;
                case "ArrowUp":
                    ev.preventDefault();
                    if (oList) { _setActive(Math.max(iActive - 1, 0)); }
                    break;
                case "Enter":
                case " ":
                    ev.preventDefault();
                    if (oList) { _select(iActive); } else { _open(); }
                    break;
                case "Escape":
                    if (oList) { ev.stopPropagation(); _close(); }
                    break;
                case "Tab":
                    _close();
                    break;
            }
        });

        return oCombo;
    }

    /**
     * 텍스트 입력에 커스텀 자동완성 드롭다운을 부착한다 (네이티브 <datalist> 대체).
     * 펼침 목록은 콤보와 동일한 .u4a-combo__list/__item 테마를 재사용한다.
     * @param {HTMLInputElement} oInput  대상 입력
     * @param {Function} fnItems  현재 후보 문자열 배열을 반환하는 함수
     * @param {Function} [fnPick] 항목 선택 시 콜백(value)
     * @returns {{close:Function}}
     */
    function attachSuggest(oInput, fnItems, fnPick) {

        let oList = null;
        let iActive = -1;
        let aMatch = [];
        let _suppressOpen = false;  // 선택 시 프로그램적 input 이벤트가 목록을 재오픈하지 않도록

        function _onOutside(ev) {
            if (oInput !== ev.target && (!oList || !oList.contains(ev.target))) { _close(); }
        }

        // bShowAll: 포커스로 열 때는 입력값과 무관하게 전체 이력을 보여준다.
        // 사용자가 직접 타이핑(input)할 때만 부분일치로 좁힌다.
        function _filtered(bShowAll) {
            const aAll = fnItems() || [];
            const sQ = (oInput.value || "").toLowerCase();
            if (bShowAll || !sQ) { return aAll.slice(); }
            const a = aAll.filter((s) => String(s).toLowerCase().includes(sQ));
            if (a.length === 1 && String(a[0]).toLowerCase() === sQ) { return []; }
            return a;
        }

        function _setActive(idx) {
            if (!oList) { return; }
            const aEl = oList.querySelectorAll(".u4a-combo__item");
            aEl.forEach((el, i) => { el.dataset.active = (i === idx) ? "true" : "false"; });
            iActive = idx;
            if (aEl[idx]) { aEl[idx].scrollIntoView({ block: "nearest" }); }
        }

        function _position() {
            const r = oInput.getBoundingClientRect();
            oList.style.left = r.left + "px";
            oList.style.top = (r.bottom + 2) + "px";
            oList.style.minWidth = r.width + "px";
        }

        function _open(bShowAll) {
            aMatch = _filtered(bShowAll);
            if (!aMatch.length) { _close(); return; }

            if (!oList) {
                oList = _el("div", "u4a-combo__list");
                oList.setAttribute("role", "listbox");
                (oInput.closest("dialog") || document.body).appendChild(oList);
                setTimeout(() => document.addEventListener("mousedown", _onOutside), 0);
            }

            oList.innerHTML = "";
            aMatch.forEach((s, idx) => {
                const oItem = _el("div", "u4a-combo__item");
                oItem.setAttribute("role", "option");
                oItem.appendChild(_el("span", null, String(s)));
                oItem.addEventListener("mousedown", (ev) => { ev.preventDefault(); _select(idx); });
                oItem.addEventListener("mousemove", () => _setActive(idx));
                oList.appendChild(oItem);
            });
            iActive = -1;
            _position();
            oInput.setAttribute("aria-expanded", "true");
        }

        function _close() {
            if (!oList) { return; }
            oList.remove();
            oList = null;
            iActive = -1;
            oInput.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOutside);
        }

        function _select(idx) {
            const s = aMatch[idx];
            if (s == null) { return; }
            oInput.value = String(s);
            if (typeof fnPick === "function") { fnPick(oInput.value); }
            _close();
            // [공통 UX] 값이 프로그램적으로 채워졌으니 input 이벤트를 쏴서 다른 리스너(attachClear 의
            //   클리어 X 노출=data-filled, 모델 바인딩 등)도 함께 동기화. 단 자기 자신의 input 핸들러는
            //   재오픈하지 않게 잠깐 억제. (타이핑이 아니라 "선택"으로 채울 때도 X 가 떠야 함)
            _suppressOpen = true;
            try { oInput.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { }
            _suppressOpen = false;
            oInput.focus();
        }

        oInput.addEventListener("input", () => { if (_suppressOpen) { return; } _open(false); }); // 타이핑 → 부분일치 필터
        oInput.addEventListener("focus", () => _open(true));       // 포커스 → 전체 이력
        oInput.addEventListener("keydown", (ev) => {
            switch (ev.key) {
                case "ArrowDown":
                    ev.preventDefault();
                    if (!oList) { _open(true); } else { _setActive(Math.min(iActive + 1, aMatch.length - 1)); }
                    break;
                case "ArrowUp":
                    if (oList) { ev.preventDefault(); _setActive(Math.max(iActive - 1, 0)); }
                    break;
                case "Enter":
                    // 후보가 활성화된 상태의 Enter 는 선택으로 소비 → 상위 Enter 핸들러 차단
                    if (oList && iActive >= 0) { ev.preventDefault(); ev.stopImmediatePropagation(); _select(iActive); }
                    break;
                case "Escape":
                    if (oList) { ev.stopPropagation(); _close(); }
                    break;
                case "Tab":
                    _close();
                    break;
            }
        });
        // 포커스 아웃 시 닫기(클릭 선택의 mousedown 이 먼저 처리되도록 약간 지연)
        oInput.addEventListener("blur", () => setTimeout(_close, 120));

        return { close: _close };
    }

    /**
     * 입력값 클리어(X) 버튼 공통 동작 — 값이 있을 때만 노출, 클릭 시 비우고 input 이벤트 발화.
     * (UI5 Input showClearIcon 대체) Login 의 _attachClear 패턴을 공통화 → 모든 화면이
     * 동일 UX 로 "값 있을 때만 X" 를 얻는다.
     * @param {HTMLInputElement|HTMLTextAreaElement} oInput 대상 입력
     * @param {HTMLElement} oClearBtn 클리어(X) 버튼
     * @param {Function} [fnAfterClear] 비운 뒤 추가 콜백(모델 동기화 등, 선택)
     * @returns {Function} 프로그램 set 후 노출상태 재계산용 sync 함수
     */
    function attachClear(oInput, oClearBtn, fnAfterClear) {
        if (!oInput || !oClearBtn) { return function () {}; }
        // 공통 컴포넌트(.u4a-field) 안이면 래퍼의 data-filled 로 CSS 가 노출 제어,
        // 아니면(폴백) 버튼 display 직접 토글.
        const oField = oInput.closest ? oInput.closest(".u4a-field") : null;
        const _sync = function () {
            const bFilled = !!oInput.value;
            if (oField) { oField.dataset.filled = bFilled ? "true" : "false"; }
            else { oClearBtn.style.display = bFilled ? "" : "none"; }
        };
        // 타이핑 등 값 변화마다 노출 동기화 (input 은 매 입력마다 발화)
        oInput.addEventListener("input", _sync);
        // mousedown preventDefault → 클릭해도 입력 포커스 유지
        oClearBtn.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
        oClearBtn.addEventListener("click", function () {
            if (oInput.value === "") { return; }
            oInput.value = "";
            // input 이벤트로 노출상태/자동완성/모델 동기화를 한 번에 갱신
            oInput.dispatchEvent(new Event("input", { bubbles: true }));
            oInput.focus();
            if (typeof fnAfterClear === "function") { fnAfterClear(); }
        });
        _sync();
        return _sync;
    }

    /* 창 이동은 네이티브 -webkit-app-region:drag(shell.css .u4a-titlebar)로 처리한다.
       JS 포인터 기반 창 이동은 근본 해결이 안 돼(레이아웃/컴포지팅 문제) 제거함.
       iframe stale 은 호스트의 _kickHostDragRegion 가, 컴포지팅 레이어는 CSS 정적화로
       해결한다. (참고: u4a-ws-40 7e7f98d "창 드래그 근본 해결") */

    /**
     * 가로 툴바 오버플로(⋯) — 폭이 모자라 넘치는 항목을 드롭다운 메뉴로 접는다.
     *   (sap.m.OverflowToolbar 대체. WS10 서브헤더와 동일 컨셉을 공통화)
     *   컨테이너는 flex-row + nowrap + overflow:hidden 이어야 하고, 항목은 flex-shrink:0 권장.
     *   모드별로 style.display="none" 처리된 항목은 "현재 숨김"으로 간주하여 reflow 대상에서 제외한다.
     * @param {HTMLElement} oBar  툴바 컨테이너
     * @param {object} [opt]
     *    opt.btnClass {string}  ⋯ 버튼 class (기본 "u4a-tx-btn u4a-tx-overflow")
     *    opt.btnHtml  {string}  ⋯ 버튼 innerHTML (기본 ellipsis 아이콘)
     *    opt.title    {string}  ⋯ 버튼 title (기본 "More")
     *    opt.isSep(el){fn}      구분선 판별 (기본 .u4a-tx-sep)
     *    opt.menuItem(el){fn}   숨겨진 항목 → {iconHtml,text,onClick} (기본: i/span/title 파싱 + el.click())
     * @returns {{reflow:Function, destroy:Function}}
     */
    /**
     * 버튼 라벨 추출 — 자식 `<span>` 텍스트 우선, 없으면(아이콘 전용 버튼)
     *   title → data-tip → aria-label 순 폴백.
     *   ★ 중요: initTooltip._promote 가 hover 시 `title` 을 `data-tip`/`aria-label` 로 옮기고
     *     title 을 제거한다. 따라서 title 만 보면 "한 번이라도 hover 된" 아이콘 버튼은 라벨이 빈다
     *     (오버플로 ⋯ 메뉴에서 이름이 사라지던 버그). data-tip/aria-label 폴백이 필수.
     * @param {HTMLElement} el
     * @param {boolean} [bStripShortcut] 끝의 " (단축키)" 제거 여부
     */
    function btnLabel(el, bStripShortcut) {
        const oSpan = el.querySelector("span");
        let s = (oSpan && oSpan.textContent.trim())
            ? oSpan.textContent
            : (el.title || el.getAttribute("data-tip") || el.getAttribute("aria-label") || "");
        if (bStripShortcut) { s = s.replace(/\s*\([^)]*\)\s*$/, ""); }
        return s;
    }

    function attachOverflow(oBar, opt) {
        opt = opt || {};
        const fnIsSep = opt.isSep || function (el) { return el.classList.contains("u4a-tx-sep"); };
        // isSkip: 측정·숨김에서 완전히 제외할 요소(예: flex-grow 스페이서). 우측정렬 툴바에서
        //   스페이서를 폭 계산에 넣으면(=flex-grow 라 항상 가득 참) 항상 오버플로로 판정되는 함정 방지.
        const fnIsSkip = opt.isSkip || function () { return false; };

        // ⋯ 오버플로 버튼. 좌측정렬 툴바는 marginLeft:auto 로 맨 우측에 둔다.
        //   우측정렬(스페이서가 이미 우측으로 미는) 툴바는 noOvfAutoMargin:true → 보이는 버튼 클러스터
        //   끝에 자연스럽게 붙는다(auto-margin 이 스페이서와 free space 를 나눠 ⋯ 가 떨어지는 문제 방지).
        const oOvf = _el("button", opt.btnClass || "u4a-tx-btn u4a-tx-overflow");
        oOvf.type = "button";
        oOvf.title = opt.title || "More";
        oOvf.innerHTML = opt.btnHtml || _fa("ellipsis");
        if (!opt.noOvfAutoMargin) { oOvf.style.marginLeft = "auto"; }
        oOvf.hidden = true;
        oBar.appendChild(oOvf);

        let oMenu = null;
        function _onOut(ev) {
            if (oMenu && !(ev.target.closest && ev.target.closest(".u4a-menu")) && ev.target !== oOvf && !oOvf.contains(ev.target)) {
                _closeMenu();
            }
        }
        function _onEsc(ev) { if (ev.key === "Escape") { _closeMenu(); } }
        function _closeMenu() {
            if (!oMenu) { return; }
            oMenu.remove(); oMenu = null;
            oOvf.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOut, true);
            document.removeEventListener("keydown", _onEsc, true);
        }

        function _items() {
            return Array.prototype.filter.call(oBar.children, function (el) { return el !== oOvf; });
        }

        function _defMenuItem(el) {
            const oI = el.querySelector("i");
            return { iconHtml: oI ? oI.outerHTML : "", text: btnLabel(el, true), onClick: function () { el.click(); } };
        }
        const fnMenuItem = opt.menuItem || _defMenuItem;

        function _openMenu() {
            _closeMenu();
            oMenu = _el("div", "u4a-menu");
            oMenu.setAttribute("role", "menu");
            _items().forEach(function (el) {
                if (!el.hidden || fnIsSep(el)) { return; } // 오버플로로 숨겨진 "버튼"만
                const mi = fnMenuItem(el);
                const oItem = _el("div", "u4a-menu__item");
                oItem.setAttribute("role", "menuitem");
                oItem.innerHTML = (mi.iconHtml || "<i></i>") + '<span class="u4a-menu__item-text"></span>';
                oItem.querySelector(".u4a-menu__item-text").textContent = mi.text;
                oItem.addEventListener("click", function (e) {
                    e.stopPropagation(); _closeMenu();
                    if (typeof mi.onClick === "function") { mi.onClick(); }
                });
                oMenu.appendChild(oItem);
            });
            (oBar.closest("dialog") || document.body).appendChild(oMenu);
            const r = oOvf.getBoundingClientRect();
            let left = r.right - oMenu.offsetWidth; // 우측 정렬
            if (left + oMenu.offsetWidth > window.innerWidth - 4) { left = window.innerWidth - oMenu.offsetWidth - 4; }
            if (left < 4) { left = 4; }
            let top = r.bottom + 2;
            if (top + oMenu.offsetHeight > window.innerHeight - 4) { top = Math.max(4, r.top - oMenu.offsetHeight - 2); }
            oMenu.style.left = left + "px";
            oMenu.style.top = top + "px";
            oOvf.setAttribute("aria-expanded", "true");
            setTimeout(function () {
                document.addEventListener("mousedown", _onOut, true);
                document.addEventListener("keydown", _onEsc, true);
            }, 0);
        }
        oOvf.addEventListener("click", function () { if (oMenu) { _closeMenu(); } else { _openMenu(); } });

        function reflow() {
            if (!oBar.isConnected) { return; }
            _closeMenu();
            const aAll = _items();
            aAll.forEach(function (el) { if (!fnIsSkip(el)) { el.hidden = false; } }); // 측정 위해 오버플로 숨김 해제(스페이서 제외)
            oOvf.hidden = false;
            // 모드 가시(style.display!=="none") 항목만 대상 + skip(스페이서) 제외
            const aVis = aAll.filter(function (el) { return !fnIsSkip(el) && el.style.display !== "none"; });
            const cs = getComputedStyle(oBar);
            const gap = parseFloat(cs.columnGap || cs.gap) || 0;
            let avail = oBar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            // 우측정렬(skip 스페이서) 모드: 스페이서 주변 gap 만큼 보수적으로 차감(폭 측정에서 스페이서를
            //   뺐으므로 실제 행 gap 1개가 누락 — 1~몇 px 차이로 버튼이 살짝 잘리는 것 방지).
            if (opt.isSkip) { avail -= gap; }
            const ovfW = oOvf.offsetWidth;
            const aW = aVis.map(function (el) { return el.offsetWidth; });
            const total = aW.reduce(function (a, b) { return a + b; }, 0) + gap * Math.max(0, aVis.length - 1);
            if (total <= avail) { oOvf.hidden = true; return; }
            let used = 0, iCut = aVis.length;
            for (let i = 0; i < aVis.length; i++) {
                const w = aW[i] + (i > 0 ? gap : 0);
                if (used + w + gap + ovfW > avail) { iCut = i; break; }
                used += w;
            }
            for (let j = iCut; j < aVis.length; j++) { aVis[j].hidden = true; }
            // 보이는 영역 끝에 매달린 구분선 정리
            for (let k = iCut - 1; k >= 0; k--) {
                if (fnIsSep(aVis[k])) { aVis[k].hidden = true; } else { break; }
            }
            // 숨겨진 "버튼"(비구분선)이 없으면 ⋯ 불필요
            const bAny = aVis.some(function (el) { return el.hidden && !fnIsSep(el); });
            if (!bAny) { oOvf.hidden = true; }
        }

        let oRO = null;
        if (window.ResizeObserver) { oRO = new ResizeObserver(function () { reflow(); }); oRO.observe(oBar); }
        else { setTimeout(reflow, 0); }

        return {
            reflow: reflow,
            destroy: function () {
                _closeMenu();
                if (oRO) { oRO.disconnect(); oRO = null; }
                if (oOvf.parentNode) { oOvf.parentNode.removeChild(oOvf); }
            }
        };
    }

    /**
     * 공용 커스텀 툴팁 — [data-tip] 요소에 hover 시 테마 플로팅 툴팁을 띄운다.
     *   네이티브 title 보다 예쁘고(테마색/라운드/그림자/페이드), overflow:hidden 컨테이너에서도
     *   잘리지 않도록 body 에 단일 엘리먼트로 띄운다. (문서 전역 위임 — 한 번만 init)
     *   · data-tip          : 표시할 텍스트
     *   · data-tip-trunc    : (선택) 있으면 "말줄임(넘침)된 경우에만" 표시
     */
    function initTooltip() {
        if (global.__u4aTipInit) { return; }
        global.__u4aTipInit = true;

        let oTip = null, iTimer = null, oCur = null;
        let _mx = 0, _my = 0;   // 최근 커서 좌표(텍스트가 안 보일 수 있는 영역은 커서 기준 배치)
        document.addEventListener("mousemove", function (e) { _mx = e.clientX; _my = e.clientY; }, true);

        function _ensure() {
            if (!oTip) {
                oTip = _el("div", "u4a-tooltip");
                oTip.setAttribute("role", "tooltip");
                document.body.appendChild(oTip);
            }
            return oTip;
        }
        function _hide() {
            if (iTimer) { clearTimeout(iTimer); iTimer = null; }
            if (oTip) { oTip.dataset.show = "false"; }
            oCur = null;
        }
        function _show(el) {
            const sText = el.getAttribute("data-tip");
            if (!sText) { return; }
            // 말줄임 전용 표시:
            //   · data-tip-trunc      → el 자신이 잘렸을 때만
            //   · data-tip-trunc-sel  → 지정 자식(예: 트리 이름)이 잘렸을 때만 (자식이 0폭이라 hover 못해도 행에서 동작)
            const sSel = el.getAttribute("data-tip-trunc-sel");
            const oTrunc = sSel ? el.querySelector(sSel) : (el.hasAttribute("data-tip-trunc") ? el : null);
            if (oTrunc && oTrunc.scrollWidth <= oTrunc.clientWidth + 1) { return; }

            const t = _ensure();
            t.textContent = sText;
            t.dataset.show = "true";              // 먼저 보이게 해야 offset 측정 가능
            const tw = t.offsetWidth, th = t.offsetHeight;
            let left, top, flipTop;
            if (sSel) {
                // 텍스트가 안 보일 수 있는 영역(트리 행 등) → 커서 옆에 배치
                left = _mx + 12;
                top = _my + 18;
                flipTop = _my - th - 8;
            } else {
                // 일반(버튼/아이콘) → 요소 바로 아래 정렬
                const r = el.getBoundingClientRect();
                left = r.left;
                top = r.bottom + 6;
                flipTop = r.top - th - 6;
            }
            left = Math.min(Math.max(4, left), window.innerWidth - tw - 4);
            if (top + th > window.innerHeight - 4) { top = Math.max(4, flipTop); } // 아래 공간 부족 시 위로
            t.style.left = left + "px";
            t.style.top = top + "px";
        }

        // 네이티브 title → data-tip 자동 승격: 앱 전역의 모든 title 툴팁을 테마 커스텀 툴팁으로 통일.
        //   (OS 기본 툴팁 중복 방지로 title 제거, 접근성 위해 aria-label 로 보존)
        function _promote(el) {
            if (!el.hasAttribute("title")) { return; }
            const sT = el.getAttribute("title");
            if (sT) {
                el.setAttribute("data-tip", sT);
                if (!el.hasAttribute("aria-label")) { el.setAttribute("aria-label", sT); }
            }
            el.removeAttribute("title");
        }
        document.addEventListener("mouseover", function (e) {
            const el = e.target.closest && e.target.closest("[data-tip],[title]");
            if (!el) { return; }
            _promote(el);
            if (el === oCur) { return; }
            oCur = el;
            if (iTimer) { clearTimeout(iTimer); }
            iTimer = setTimeout(function () { _show(el); }, 350);
        }, true);
        document.addEventListener("mouseout", function (e) {
            const el = e.target.closest && e.target.closest("[data-tip]");
            if (el && el === oCur) { _hide(); }
        }, true);
        document.addEventListener("mousedown", _hide, true);
        window.addEventListener("scroll", _hide, true);
        window.addEventListener("blur", _hide);
    }

    /**
     * 다이얼로그 헤더 더블클릭 → 화면 중앙 복귀. (SAPUI5 Dialog 의 헤더 더블클릭 리센터 UX 공통화)
     * 드래그가 박아둔 인라인 위치(position/margin/left/top)를 비워 네이티브 <dialog> 의
     * 기본 중앙정렬로 되돌린다. 헤더 내 버튼(닫기 X 등) 더블클릭은 제외.
     * @param {HTMLDialogElement} oDlg   대상 다이얼로그
     * @param {HTMLElement} oHandle      헤더(더블클릭 대상). 보통 .u4a-dialog__header
     */
    function makeDialogRecenter(oDlg, oHandle) {
        if (!oDlg || !oHandle) { return function () {}; }
        const _recenter = function (e) {
            if (e && e.target && e.target.closest("button")) { return; } // 헤더 내 버튼 더블클릭 제외
            oDlg.style.left = "";
            oDlg.style.top = "";
            oDlg.style.margin = "";
            oDlg.style.position = "";
        };
        oHandle.addEventListener("dblclick", _recenter);
        return _recenter; // 프로그램에서 강제 리센터 호출용
    }

    /**
     * 다이얼로그 크기 조절 — 우하단 grip(.u4a-dialog__resize) 으로 width/height 드래그.
     * grip 은 시각 인디케이터(대각선 그립)라 사용자가 리사이즈 가능함을 안다(shell.css).
     * grip 은 푸터(있으면) 우하단 패딩 영역에 둬 닫기 버튼과 겹치지 않게 한다.
     * @param {HTMLDialogElement} oDlg
     * @param {object} [opt]  opt.minW(기본 320) opt.minH(기본 220)
     */
    function makeDialogResizable(oDlg, opt) {
        if (!oDlg || oDlg.querySelector(".u4a-dialog__resize")) { return; }
        opt = opt || {};
        const minW = opt.minW || 320, minH = opt.minH || 220;
        const oHost = oDlg.querySelector(".u4a-dialog__footer") || oDlg;
        if (oHost !== oDlg) { oHost.style.position = "relative"; }
        const grip = document.createElement("div");
        grip.className = "u4a-dialog__resize";
        grip.setAttribute("aria-hidden", "true");
        grip.title = "Resize";
        oHost.appendChild(grip);

        let on = false, sx = 0, sy = 0, sw = 0, sh = 0;
        function mv(e) {
            if (!on) { return; }
            const w = Math.min(Math.max(minW, sw + (e.clientX - sx)), window.innerWidth - 16);
            const h = Math.min(Math.max(minH, sh + (e.clientY - sy)), window.innerHeight - 16);
            oDlg.style.width = w + "px";
            oDlg.style.height = h + "px";
        }
        function up() { on = false; document.removeEventListener("mousemove", mv, true); document.removeEventListener("mouseup", up, true); }
        grip.addEventListener("mousedown", function (e) {
            if (e.button !== 0) { return; }
            on = true;
            const r = oDlg.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; sw = r.width; sh = r.height;
            // 좌상단을 고정하고 우하단만 늘리도록 현재 위치 박제(드래그와 동일 방식).
            oDlg.style.margin = "0"; oDlg.style.position = "fixed";
            oDlg.style.left = r.left + "px"; oDlg.style.top = r.top + "px";
            e.preventDefault(); e.stopPropagation();
            document.addEventListener("mousemove", mv, true);
            document.addEventListener("mouseup", up, true);
        });
    }

    /**
     * 드래그 다이얼로그 상단 경계 = "창 타이틀바(.u4a-titlebar) 하단 y".
     * 즉 다이얼로그는 타이틀바(로고/제목/min·max·close 창 크롬) 바로 아래까지만 올라간다.
     * (메뉴바·툴바 위는 덮어도 됨 — 사용자 요구: 타이틀바만 침범 금지.)
     */
    function _topChromeBottom() {
        try {
            const el = document.querySelector(".u4a-titlebar");
            if (el) {
                const r = el.getBoundingClientRect();
                if (r.height > 0 && r.top < window.innerHeight * 0.5) { return r.bottom; }
            }
            return 0;
        } catch (e) { return 0; }
    }

    /**
     * 다이얼로그 헤더 드래그 — ★전역 자동★. document 에 위임 리스너 1개만 설치하면
     * 모든 `.u4a-dialog` 가 헤더(`.u4a-dialog__header` 또는 `[data-u4a-draghandle]`)를 잡고
     * 드래그된다 + 화면 밖/상단 공통 헤더 영역으로 못 나가게 클램프. → 팝업마다 배선 불필요
     * (현재·미래 전부 자동). makeDialogRecenter/Resizable 과 달리 "한 번 설치 = 전체 적용".
     *   · 좌/우/하: 뷰포트 안. · 상: 공통 헤더(타이틀바+메뉴바+툴바) 하단 아래로만.
     *   · 헤더 내 버튼/입력(.u4a-btn-icon/button/input…) 에서 시작한 드래그는 무시.
     */
    let _DLG_DRAG_ON = false;
    function _installGlobalDialogDrag() {
        if (_DLG_DRAG_ON || typeof document === "undefined") { return; }
        _DLG_DRAG_ON = true;

        const sIgnore = ".u4a-btn-icon, button, input, select, textarea, a";
        let oCur = null, dx = 0, dy = 0;

        const _minTop = function (oDlg) {
            const tb = oDlg && oDlg.__u4aTopBoundary;
            if (typeof tb === "function") { return tb() || 0; }
            if (typeof tb === "number") { return tb; }
            return _topChromeBottom();
        };
        function mv(e) {
            if (!oCur) { return; }
            const r = oCur.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight, mt = _minTop(oCur);
            const left = Math.min(Math.max(e.clientX - dx, 0), Math.max(0, vw - r.width));
            const top = Math.min(Math.max(e.clientY - dy, mt), Math.max(mt, vh - r.height));
            oCur.style.left = left + "px";
            oCur.style.top = top + "px";
        }
        function up() {
            oCur = null;
            document.removeEventListener("mousemove", mv, true);
            document.removeEventListener("mouseup", up, true);
        }
        document.addEventListener("mousedown", function (e) {
            if (e.button !== 0 || !e.target.closest) { return; }
            const oHandle = e.target.closest(".u4a-dialog__header, [data-u4a-draghandle]");
            if (!oHandle) { return; }
            if (e.target.closest(sIgnore)) { return; } // 헤더 내 버튼/입력에서 시작한 드래그 제외
            const oDlg = oHandle.closest(".u4a-dialog");
            if (!oDlg) { return; }
            oCur = oDlg;
            const r = oDlg.getBoundingClientRect();
            oDlg.style.margin = "0"; oDlg.style.position = "fixed";
            oDlg.style.left = r.left + "px"; oDlg.style.top = r.top + "px";
            dx = e.clientX - r.left; dy = e.clientY - r.top;
            e.preventDefault();
            document.addEventListener("mousemove", mv, true);
            document.addEventListener("mouseup", up, true);
        }, true);
    }

    /**
     * (옵션) 표준 `.u4a-dialog__header` 는 전역 자동 처리라 호출이 필요 없다.
     * 헤더가 `.u4a-dialog__header` 가 아닌 커스텀 핸들이거나, 상단 경계를 커스텀할 때만 사용.
     * @param {HTMLDialogElement} oDlg
     * @param {HTMLElement} [oHandle]  커스텀 드래그 핸들(없으면 표준 헤더 자동)
     * @param {object} [opt]  opt.topBoundary(number|fn)
     */
    function makeDialogDraggable(oDlg, oHandle, opt) {
        _installGlobalDialogDrag(); // 전역 1회 설치 보장
        try {
            if (oHandle && oHandle.matches && !oHandle.matches(".u4a-dialog__header")) {
                oHandle.setAttribute("data-u4a-draghandle", ""); // 커스텀 핸들도 위임이 잡게 표식
            }
            if (oDlg && opt && opt.topBoundary != null) { oDlg.__u4aTopBoundary = opt.topBoundary; }
        } catch (e) { }
    }

    /**
     * 창 포커스 상태 표시 — 현재 브라우저 창에 포커스가 없으면(blur) <body> 에
     * u4a-window-blurred 클래스를 달아 타이틀바(.u4a-titlebar)를 살짝 흐리게 한다.
     * (시각 처리는 shell.css) "포커스 간 창 / 아닌 창" 을 구분해 주기 위함.
     * 모든 셸 화면(index/WS10/Login/ServerList) 공통, 전역 1회 호출.
     *
     * 설계 (★ 두 신호를 합치고 항상 OS 포커스를 재독한다):
     *  - 활성 여부의 "정답"은 언제나 Electron 네이티브 oWin.isFocused() 다. 모든
     *    핸들러는 이 값을 다시 읽어(_resync) 클래스를 정한다.
     *  - DOM 의 window 'blur'/'focus' 만 단독으로 쓰면, 화면 안 iframe(자식 프레임)으로
     *    포커스가 옮겨가기만 해도 부모 window 에서 blur 가 발화해 OS 창은 활성인데도
     *    비활성으로 오판한다(Login 화면). → 그래서 DOM 이벤트는 "신호"로만 쓰고
     *    실제 상태는 oWin.isFocused() 로 재확인하므로 오판이 없다.
     *  - 반대로 네이티브 oWin.on('blur') 만 쓰면, index.html 처럼 u4a-ui.js 를 <head>
     *    에서 매우 일찍 로드하는 창은 remote 리스너 등록이 "유실"돼(첫 등록이 안 붙음)
     *    blur 가 와도 토글이 안 된다(실측: 재등록하면 정상). → 'load' 후 네이티브
     *    리스너를 다시 바인딩해 보정하고, 전달이 확실한 DOM 이벤트를 병행한다.
     */
    function initWindowFocusState() {
        const CLS = "u4a-window-blurred";
        const _set = function (bBlurred) {
            if (!document.body) { return; }
            document.body.classList.toggle(CLS, bBlurred);
        };

        let oWin = null;
        try { oWin = require("@electron/remote").getCurrentWindow(); } catch (e) { oWin = null; }

        // 활성 여부를 항상 네이티브 OS 창 포커스에서 재독 → iframe 포커스 이동에도 오판 없음
        const _resync = function () {
            let bFocused;
            try { bFocused = oWin ? oWin.isFocused() : document.hasFocus(); }
            catch (e) { bFocused = document.hasFocus(); }
            _set(!bFocused);
        };

        // ① 네이티브 창 포커스(재바인딩 가능) — "iframe 에 포커스가 있는 상태의 OS blur"
        //    까지 잡는 유일한 신호. <head> 선로드 유실 보정을 위해 remove 후 재등록한다.
        const _rebindNative = function () {
            if (!oWin) { return; }
            try { oWin.removeListener("focus", _resync); oWin.removeListener("blur", _resync); } catch (e) { }
            try { oWin.on("focus", _resync); oWin.on("blur", _resync); } catch (e) { }
        };
        _rebindNative();
        window.addEventListener("load", _rebindNative);   // 로드 후 재바인딩(유실 보정)
        if (oWin) {
            window.addEventListener("beforeunload", function () {
                try { oWin.removeListener("focus", _resync); oWin.removeListener("blur", _resync); } catch (e) { }
            });
        }

        // ② DOM 신호(전달 확실) — isFocused 재독이라 iframe 오발화 안전. 네이티브가
        //    유실된 창에서도 OS blur/focus 를 보정한다.
        window.addEventListener("focus", _resync);
        window.addEventListener("blur", _resync);
        document.addEventListener("visibilitychange", _resync);

        // ③ 초기 상태 + 로드 후 1회 재확정
        if (document.body) { _resync(); }
        else { document.addEventListener("DOMContentLoaded", _resync); }
        window.addEventListener("load", _resync);
    }

    const U4AUI = {
        el: _el,
        createSelect: createSelect,
        attachSuggest: attachSuggest,
        attachClear: attachClear,
        attachOverflow: attachOverflow,
        btnLabel: btnLabel,
        makeDialogRecenter: makeDialogRecenter,
        makeDialogResizable: makeDialogResizable,
        makeDialogDraggable: makeDialogDraggable,
        initTooltip: initTooltip,
        initWindowFocusState: initWindowFocusState
    };

    global.U4AUI = U4AUI;

    // 커스텀 툴팁 전역 1회 초기화 (모든 화면 공통 — [data-tip] 요소에 자동 적용)
    try { initTooltip(); } catch (e) { }

    // 창 포커스 상태(활성/비활성) 표시 전역 1회 초기화 (모든 셸 공통)
    try { initWindowFocusState(); } catch (e) { }

    // 다이얼로그 헤더 드래그 전역 1회 설치 — 모든 .u4a-dialog 가 자동으로 드래그+화면/헤더 클램프.
    //   (팝업마다 배선 불필요. 헤더는 .u4a-dialog__header / [data-u4a-draghandle] 둘 다 인식)
    try { _installGlobalDialogDrag(); } catch (e) { }

    // CommonJS(Electron nodeIntegration) 환경에서도 require 가능하게
    if (typeof module === "object" && module.exports) {
        module.exports = U4AUI;
    }

})(typeof window !== "undefined" ? window : this);
