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
        accept: _fa("check"),
        treeChevron: _fa("chevron-right")   // 트리 펼침/접힘 토글(회전은 aria-expanded CSS)
    };

    /**
     * 커스텀 셀렉트 (네이티브 <select> 대체 — 펼침 목록까지 테마 적용).
     * @param {Array<{value:string,text:string}>} aItems
     * @param {string} sValue 초기 값
     * @param {Function} [fnChange] 값 변경 콜백(newValue)
     * @returns {HTMLElement} `.value` getter/setter 를 가진 combo 엘리먼트
     */
    function createSelect(aItems, sValue, fnChange, opts) {

        aItems = aItems || [];
        opts = opts || {};

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

        // 항목 동적 교체 — 펼치기 직전에 서버 목록을 다시 받아 채우는 콤보(이벤트 DDLB 등)용.
        //   (aItems 는 클로저 변수라 재할당하면 _label/_open/_select 가 새 목록을 본다.)
        oCombo.setItems = function (aNew) {
            aItems = aNew || [];
            oText.textContent = _label(sCurrent);
        };

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
            // 창 리사이즈/스크롤 시 닫기 — 앵커(콤보)가 옮겨가 펼침목록 위치가 어긋나는 것 방지.
            //   scroll 은 capture 로 내부 스크롤러(속성패널 등)까지 잡는다(스크롤 이벤트는 버블 안 함).
            window.addEventListener("resize", _close);
            window.addEventListener("scroll", _close, true);
        }

        function _close() {
            if (!oList) { return; }
            oList.remove();
            oList = null;
            oCombo.removeAttribute("data-open");
            oCombo.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOutside);
            window.removeEventListener("resize", _close);
            window.removeEventListener("scroll", _close, true);
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

        // 펼치기 요청 — opts.onOpen 이 있으면 그 결과(Promise 가능)를 기다린 뒤 연다.
        //   (이벤트 DDLB: 펼치기 직전 서버이벤트 목록을 다시 받아 setItems 로 채운다.)
        //   onOpen 진행 중(data-loading) 재클릭은 무시해 중복 호출 방지.
        function _requestOpen() {
            if (oCombo.getAttribute("aria-disabled") === "true") { return; }   // 비활성 콤보는 열기 차단(클릭·키보드 공통)
            if (oList) { _close(); return; }
            if (oCombo.dataset.loading === "true") { return; }
            const fnOpen = opts.onOpen;
            if (typeof fnOpen === "function") {
                let r;
                try { r = fnOpen(oCombo); } catch (e) { r = null; }
                if (r && typeof r.then === "function") {
                    oCombo.dataset.loading = "true";
                    const _done = function () { delete oCombo.dataset.loading; _open(); };
                    r.then(_done, _done);
                    return;
                }
            }
            _open();
        }

        oCombo.addEventListener("click", () => { _requestOpen(); });
        oCombo.addEventListener("keydown", (ev) => {
            switch (ev.key) {
                case "ArrowDown":
                    ev.preventDefault();
                    if (!oList) { _requestOpen(); } else { _setActive(Math.min(iActive + 1, aItems.length - 1)); }
                    break;
                case "ArrowUp":
                    ev.preventDefault();
                    if (oList) { _setActive(Math.max(iActive - 1, 0)); }
                    break;
                case "Enter":
                case " ":
                    ev.preventDefault();
                    if (oList) { _select(iActive); } else { _requestOpen(); }
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
            let iTop = r.bottom + 2;
            // 같은 행에 value-state 메시지(.u4a-field__msg)가 떠 있으면 그 아래로 내려
            //   겹침 방지 — 메시지 위, 제안 목록 아래로 스택(UI5 valueState + suggestion 동일).
            const oRow = oInput.closest ? oInput.closest(".u4a-form__row") : null;
            if (oRow) {
                const oMsg = oRow.querySelector(":scope > .u4a-field__msg");
                if (oMsg && oMsg.offsetParent !== null && oMsg.textContent) {
                    const mr = oMsg.getBoundingClientRect();
                    if (mr.height) { iTop = mr.bottom + 2; }
                }
            }
            oList.style.top = iTop + "px";
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
                // 창 리사이즈/스크롤 시 닫기 — 앵커(입력칸) 이동으로 위치 어긋남 방지. scroll capture=내부 스크롤러 포함.
                window.addEventListener("resize", _close);
                window.addEventListener("scroll", _close, true);
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
            window.removeEventListener("resize", _close);
            window.removeEventListener("scroll", _close, true);
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
            window.removeEventListener("resize", _closeMenu);
            window.removeEventListener("scroll", _closeMenu, true);
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
            // 창 리사이즈/스크롤 시 닫기 — 앵커(⋯ 버튼) 이동으로 위치 어긋남 방지(ResizeObserver reflow 보강).
            window.addEventListener("resize", _closeMenu);
            window.addEventListener("scroll", _closeMenu, true);
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
            // 가로(말줄임) 또는 세로(line-clamp 등) 어느 쪽도 안 잘렸으면 툴팁 생략. (USP 설명=2줄 세로클램프)
            if (oTrunc && oTrunc.scrollWidth <= oTrunc.clientWidth + 1 && oTrunc.scrollHeight <= oTrunc.clientHeight + 1) { return; }

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
        // 공통 테이블(.u4a-table) 셀/헤더라벨 — 텍스트가 가로로 잘리면(말줄임) 자동으로 툴팁 대상이 된다.
        //   ★ 화면별 title 배선 불필요 — 전 공통 테이블이 자동으로 "잘릴 때만" 전체 텍스트 툴팁(data-tip-trunc).
        //   이미 명시 tip(title/data-tip)이 있거나 텍스트 없는 셀(아이콘/액션)은 건드리지 않는다.
        function _autoCellTip(cell) {
            if (!cell) { return null; }
            if (cell.hasAttribute("data-tip") || cell.hasAttribute("title")) { return cell; }
            const s = (cell.textContent || "").trim();
            if (!s) { return null; }
            cell.setAttribute("data-tip", s);
            cell.setAttribute("data-tip-trunc", "");   // 잘렸을 때만 표시(_show 가 scrollWidth 검사)
            return cell;
        }
        document.addEventListener("mouseover", function (e) {
            let el = e.target.closest && e.target.closest("[data-tip],[title]");
            if (!el) {
                const cell = e.target.closest && e.target.closest(".u4a-table tbody td, .u4a-table .u4a-th__label");
                el = _autoCellTip(cell);
                if (!el) { return; }
            }
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

        // ★ 창 크기 변경 시 — 드래그/리사이즈로 px 가 박힌 "열린" 다이얼로그를 뷰포트 안으로 클램프.
        //   (최대화 상태에서 키우거나 옮긴 팝업이 restore 후 작은 창을 넘쳐 오른쪽·아래가 잘리던 문제.
        //    전 .u4a-dialog 공통.) 인라인 위치/크기가 없는(=CSS vw/vh + 네이티브 중앙정렬) 다이얼로그는
        //   건드리지 않는다(그건 CSS 가 알아서 따라감).
        window.addEventListener("resize", function () {
            const vw = window.innerWidth, vh = window.innerHeight;
            const aDlg = document.querySelectorAll("dialog.u4a-dialog");
            for (let i = 0; i < aDlg.length; i++) {
                const d = aDlg[i];
                if (!d.open) { continue; }
                const bPos = d.style.position === "fixed" || d.style.left || d.style.top;
                const bSize = d.style.width || d.style.height;
                if (!bPos && !bSize) { continue; }
                const maxW = Math.max(160, vw - 16), maxH = Math.max(160, vh - 16);
                let r = d.getBoundingClientRect();
                if (r.width > maxW) { d.style.width = maxW + "px"; }
                if (r.height > maxH) { d.style.height = maxH + "px"; }
                if (bPos) {
                    r = d.getBoundingClientRect();
                    const mt = _minTop(d);
                    const left = Math.min(Math.max(parseFloat(d.style.left) || r.left, 0), Math.max(0, vw - r.width));
                    const top = Math.min(Math.max(parseFloat(d.style.top) || r.top, mt), Math.max(mt, vh - r.height));
                    d.style.left = left + "px";
                    d.style.top = top + "px";
                }
            }
        });
    }

    /**
     * 스플릿바 더블클릭 → 인접 패널을 "최초(드래그 전) 위치"로 복귀 — ★전역 자동★.
     * 모든 `.u4a-splitter__bar`(서버리스트/옵션/WS20/USP트리/USP에디터)에 위임 1개로 적용.
     *   · 최초 폭은 각 패널이 "처음 드래그되기 직전"(mousedown, capture)에 1회 기록한다.
     *     capture 라 화면별 드래그 핸들러보다 먼저 실행 → 항상 "드래그 전" 값. 이미 기록됐으면
     *     덮어쓰지 않으므로, 두 바가 공유하는 패널(WS20 가운데)도 최초값을 유지한다.
     *   · 더블클릭 → 바의 좌/우 인접 패널을 기록된 home(인라인 style.flex 문자열, 없으면 ""=CSS
     *     기본)으로 되돌린다. 기록이 없으면(드래그 안 함) 무시.
     *   · 패널 클래스는 화면마다 다르므로(.u4a-splitter__pane/.u4aWs20Panel/.u4aWs30TreePane…)
     *     바의 prev/next ElementSibling 을 인접 패널로 본다(바 양옆이 곧 패널).
     */
    let _SPLIT_RESET_ON = false;
    function _installGlobalSplitterReset() {
        if (_SPLIT_RESET_ON || typeof document === "undefined") { return; }
        _SPLIT_RESET_ON = true;

        function _sides(oBar) {
            return [oBar.previousElementSibling, oBar.nextElementSibling].filter(Boolean);
        }
        // 드래그 시작 직전(capture) — 인접 패널의 현재 flex 를 home 으로 1회 기록(미기록 시에만)
        document.addEventListener("mousedown", function (e) {
            if (e.button !== 0 || !e.target.closest) { return; }
            var oBar = e.target.closest(".u4a-splitter__bar");
            if (!oBar) { return; }
            _sides(oBar).forEach(function (oPane) {
                if (oPane.dataset.u4aSplitHome == null) {
                    oPane.dataset.u4aSplitHome = oPane.style.flex || "";
                }
            });
        }, true);
        // 더블클릭 — 인접 패널을 home 으로 복귀
        document.addEventListener("dblclick", function (e) {
            if (!e.target.closest) { return; }
            var oBar = e.target.closest(".u4a-splitter__bar");
            if (!oBar) { return; }
            _sides(oBar).forEach(function (oPane) {
                var sHome = oPane.dataset.u4aSplitHome;
                if (sHome != null) { oPane.style.flex = sHome; }
            });
            // 화면별 후처리(예: ServerList 테이블 폭 클래스 재계산)가 있으면 트리거 — 있을 때만.
            try {
                if (global.oAPP && oAPP.fn && typeof oAPP.fn.fnUpdateTableWidthClass === "function") {
                    oAPP.fn.fnUpdateTableWidthClass();
                }
            } catch (e2) { }
        });
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

    /**
     * 공통 베이스 트리 — 재귀 <ul.u4a-tree>/<li>/<div.u4a-tree__row> 렌더러.
     * (ServerList / WS20 디자인트리 / WS30 USP 등 모든 트리의 코어 UX 단일 출처)
     *
     *   · 마크업/색/상태는 shell.css 의 .u4a-tree__* 공통 컴포넌트를 소비(토큰만).
     *   · ARIA role 미부착 — aria-expanded(셰브론 회전)·aria-selected(선택 강조)만.
     *   · 토글 = WS20식: 자식 항상 렌더, 펼침=ul.hidden=false(제자리),
     *       접기=이 노드+자손 재귀 접힘 후 서브트리 재빌드(재오픈 시 자손은 접힌 상태).
     *   · 들여쓰기 = 행의 --u4a-tree-depth(=레벨) → padding 은 shell.css 가 계산.
     *   · 부가요소(체크박스/배지/설명/액션)는 slotLead/slotTrailing 콜백으로 주입 —
     *       베이스는 코어만, 확장 스타일은 각 화면 CSS 가 책임진다(소스 단일화 + 화면별 확장).
     *
     * @param {object} cfg
     *  --- 데이터 접근 ---
     *  @param {function():Array<*>}     cfg.roots         루트 노드 배열(매 render 호출 → 모델 최신값)
     *  @param {function(*):Array<*>}    cfg.children      자식 배열(없으면 [])
     *  @param {function(*):string}      cfg.key           노드 고유키(펼침 기억/행 조회용; 안정적이어야 함)
     *  @param {function(*):boolean}     [cfg.hasChildren] 기본: children(node).length>0
     *  --- 표현 ---
     *  @param {function(*):string}      cfg.label         라벨 텍스트
     *  @param {function(*):string}      [cfg.icon]        아이콘 HTML(<i>/<img>). 빈값이면 icon span 생략
     *  @param {function(*):string}      [cfg.tip]         행 data-tip(말줄임 시 .u4a-tree__label 기준 툴팁)
     *  --- 슬롯(HTMLElement|null 반환) ---
     *  @param {function(*,object):?Node} [cfg.slotLead]     토글↔아이콘 사이(예: 체크박스)
     *  @param {function(*,object):?Node} [cfg.slotTrailing] 라벨 뒤 우측(예: 배지/설명/액션). 반환 시 행에 data-u4a-tree-split
     *  --- 동작 ---
     *  @param {function(*,HTMLElement,object)} [cfg.onSelect]        행 클릭/Enter/Space
     *  @param {function(*,boolean,HTMLElement)} [cfg.onToggle]       토글 후(펼침 영속화 훅)
     *  @param {function(*,number):boolean}      [cfg.initialExpanded] 최초 펼침(기본 level<1)
     *  --- 행 후크 ---
     *  @param {function(HTMLElement,*,object)} [cfg.rowHook]   행 div 직후(줄무늬/클래스/data-속성/노드 stash)
     *  @param {boolean}                        [cfg.selectable=true]
     *
     * @returns {{el:HTMLUListElement, render:Function, expandAll:Function,
     *   collapseAll:Function, expandToLevel:Function, expandSubtree:Function, setExpanded:Function,
     *   setSelected:Function, selectByKey:Function, findRow:Function}}
     */
    function createTree(cfg) {
        cfg = cfg || {};
        const _roots = cfg.roots || function () { return []; };
        const _children = cfg.children || function () { return []; };
        const _key = cfg.key || function () { return ""; };
        const _hasChildren = cfg.hasChildren || function (n) { return (_children(n) || []).length > 0; };
        const _label = cfg.label || function () { return ""; };
        const _icon = cfg.icon || null;
        const _tip = cfg.tip || null;
        const _slotLead = cfg.slotLead || null;
        const _slotTrailing = cfg.slotTrailing || null;
        const _onSelect = cfg.onSelect || null;
        const _onToggle = cfg.onToggle || null;
        // 외부 펼침상태 위임(옵션) — 제공 시 내부 _expanded 대신 이 콜백이 펼침여부의 단일 출처.
        //   (WS20 디자인트리처럼 펼침맵을 화면이 직접 소유/조작하는 경우. 토글=onToggle+재렌더)
        const _extExpanded = cfg.isExpanded || null;
        const _initialExpanded = cfg.initialExpanded || function (n, lvl) { return lvl < 1; };
        const _rowHook = cfg.rowHook || null;
        const bSelectable = cfg.selectable !== false;
        const bVirtual = !!cfg.virtual;   // 대용량(수만 노드) 트리: flat+windowed 렌더(보이는 행만 DOM)

        const oUl = _el("ul", "u4a-tree");   // controller.el — role 미부착
        const _expanded = {};                // key → bool (render 간 유지; onToggle 으로 외부 영속화 동기)
        let _index = 0;                       // full render 마다 0 → 행 홀짝(ctx.odd)

        // 펼침 상태: 한 번 본 키는 기억, 처음이면 initialExpanded 로 seed.
        function _isExpanded(node, level) {
            if (_extExpanded) { return !!_extExpanded(node, level); } // 외부 위임 시 그쪽이 단일 출처
            const k = _key(node);
            if (k !== "" && Object.prototype.hasOwnProperty.call(_expanded, k)) { return !!_expanded[k]; }
            const b = !!_initialExpanded(node, level);
            if (k !== "") { _expanded[k] = b; }
            return b;
        }
        // 접기 시 자손까지 재귀 접힘(WS20식 — 재오픈해도 자손은 접힌 상태)
        function _collapseRec(node) {
            const k = _key(node);
            if (k !== "") { _expanded[k] = false; }
            const aCh = _children(node) || [];
            for (let i = 0; i < aCh.length; i++) { _collapseRec(aCh[i]); }
        }

        function _childrenUl(node, level, bExp) {
            const oCUl = _el("ul");
            oCUl.hidden = !bExp;
            const aCh = _children(node) || [];
            for (let i = 0; i < aCh.length; i++) { oCUl.appendChild(_buildNode(aCh[i], level + 1)); }
            return oCUl;
        }

        function _toggle(node, oLi, oRow, level) {
            const bNowOpen = oRow.getAttribute("aria-expanded") === "true";
            // 외부 펼침상태 모드: 외부 store 갱신(onToggle)에 위임 후 전체 재렌더.
            //   (펼침맵 소유가 화면 쪽이라 내부 _expanded/in-place 토글 대신 단순 재렌더가 정합)
            if (_extExpanded) {
                if (_onToggle) { _onToggle(node, !bNowOpen, oRow); }
                render();
                return;
            }
            if (bNowOpen) {
                _collapseRec(node);
                const oOld = oLi.querySelector(":scope > ul");
                if (oOld) { oLi.replaceChild(_childrenUl(node, level, false), oOld); }
                oRow.setAttribute("aria-expanded", "false");
            } else {
                const k = _key(node);
                if (k !== "") { _expanded[k] = true; }
                oRow.setAttribute("aria-expanded", "true");
                const oCUl = oLi.querySelector(":scope > ul");
                if (oCUl) { oCUl.hidden = false; }
            }
            if (_onToggle) { _onToggle(node, !bNowOpen, oRow); }
        }

        // 행(.u4a-tree__row) DOM 1개 빌드 — 중첩/가상 공용. fnToggle = 토글버튼 클릭 핸들러(모드별 주입).
        function _buildRowEl(node, level, idx, fnToggle) {
            const bHas = _hasChildren(node);
            const bExp = bHas ? _isExpanded(node, level) : false;
            const oCtx = { level: level, index: idx, odd: (idx % 2 === 1), expanded: bExp, hasChildren: bHas, key: _key(node) };

            const oRow = _el("div", "u4a-tree__row");
            oRow.style.setProperty("--u4a-tree-depth", String(level));
            oRow.__u4aKey = _key(node);
            if (bSelectable) { oRow.tabIndex = 0; }
            if (bHas) { oRow.setAttribute("aria-expanded", bExp ? "true" : "false"); }
            if (_tip) {
                const sTip = _tip(node);
                if (sTip) { oRow.setAttribute("data-tip", sTip); oRow.setAttribute("data-tip-trunc-sel", ".u4a-tree__label"); }
            }

            // 토글(셰브론) — 자식 없으면 leaf(투명, 자리만)
            const oTog = _el("button", "u4a-tree__toggle" + (bHas ? "" : " u4a-tree__toggle--leaf"));
            oTog.type = "button";
            oTog.innerHTML = ICON.treeChevron;
            if (bHas && fnToggle) {
                oTog.addEventListener("click", function (ev) { ev.stopPropagation(); fnToggle(); });
            }
            oRow.appendChild(oTog);

            // lead 슬롯(체크박스 등)
            if (_slotLead) { const x = _slotLead(node, oCtx); if (x) { oRow.appendChild(x); } }

            // 아이콘
            if (_icon) {
                const sIcon = _icon(node);
                if (sIcon) { const oIc = _el("span", "u4a-tree__icon"); oIc.innerHTML = sIcon; oRow.appendChild(oIc); }
            }

            // 라벨
            oRow.appendChild(_el("span", "u4a-tree__label", _label(node)));

            // trailing 슬롯(배지/설명/액션 등) — 있으면 우측정렬(space-between)
            if (_slotTrailing) {
                const x = _slotTrailing(node, oCtx);
                if (x) { oRow.setAttribute("data-u4a-tree-split", ""); oRow.appendChild(x); }
            }

            // 행 후크(줄무늬/클래스/data-속성/노드 stash)
            if (_rowHook) { _rowHook(oRow, node, oCtx); }

            // 선택
            if (bSelectable && _onSelect) {
                oRow.addEventListener("click", function () { _onSelect(node, oRow, oCtx); });
                oRow.addEventListener("keydown", function (ev) {
                    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); _onSelect(node, oRow, oCtx); }
                });
            }
            return oRow;
        }

        // 중첩 li (비가상 모드 — USP 등 기존 동작 그대로).
        function _buildNode(node, level) {
            const bHas = _hasChildren(node);
            const bExp = bHas ? _isExpanded(node, level) : false;
            const idx = _index++;
            const oLi = _el("li");
            const oRow = _buildRowEl(node, level, idx, bHas ? function () { _toggle(node, oLi, oRow, level); } : null);
            oLi.appendChild(oRow);
            if (bHas) { oLi.appendChild(_childrenUl(node, level, bExp)); }
            return oLi;
        }

        /* ── 가상(flat+windowed) 모드 — cfg.virtual 일 때. 대용량(수만 노드) 대비 보이는 행만 DOM.
         *  중첩 ul/li 대신 "펼친 노드만 평탄화 → 공통 makeVScroller 로 윈도잉". 들여쓰기는 --u4a-tree-depth
         *  라 시각 동일. 스크롤 컨테이너 = el(ul) 의 부모(화면이 부착). 토글=외부맵 갱신+재플래튼.
         *  ※ 가상 모드는 외부 펼침맵(cfg.isExpanded/onToggle) 사용 화면(WS20)을 전제로 한다. */
        let _vs = null, _vsWrap = null;
        function _flattenVisible() {
            const out = [];
            (function rec(aNodes, level) {
                if (!Array.isArray(aNodes)) { return; }
                for (let i = 0; i < aNodes.length; i++) {
                    const n = aNodes[i];
                    if (!n) { continue; }
                    out.push({ node: n, level: level });
                    if (_hasChildren(n) && _isExpanded(n, level)) { rec(_children(n) || [], level + 1); }
                }
            })(_roots() || [], 0);
            return out;
        }
        function _toggleVirtual(node) {
            const bOpen = _isExpanded(node, 0);
            if (_onToggle) { _onToggle(node, !bOpen, null); }
            else { const k = _key(node); if (k !== "") { _expanded[k] = !bOpen; } }
            _renderVirtual(true);
        }
        function _vsRowH() {
            const w = oUl.parentNode;
            const h = w ? parseFloat(getComputedStyle(w).getPropertyValue("--u4a-vsrowh")) : 0;
            return h > 0 ? h : 28;
        }
        function _renderVirtual(bKeepScroll) {
            const oWrap = oUl.parentNode;   // 스크롤 컨테이너(화면이 부착) — 미부착이면 부착 후 재호출됨
            if (!oWrap) { return; }
            if (!_vs || _vsWrap !== oWrap) {
                _vsWrap = oWrap;
                _vs = makeVScroller(oWrap, oUl, {
                    buildRow: function (item, idx) {
                        const oLi = _el("li");
                        // 윈도잉 높이 계산이 정확하도록 li 여백 0 (행높이 = li 높이).
                        oLi.style.listStyle = "none"; oLi.style.margin = "0"; oLi.style.padding = "0";
                        const fn = _hasChildren(item.node) ? function () { _toggleVirtual(item.node); } : null;
                        oLi.appendChild(_buildRowEl(item.node, item.level, idx, fn));
                        return oLi;
                    },
                    getSelKey: function (item) { return _key(item.node); },
                    makeSpacer: function () {
                        const li = document.createElement("li");
                        li.className = "u4aVSpacer"; li.setAttribute("aria-hidden", "true");
                        li.style.padding = "0"; li.style.margin = "0"; li.style.height = "0px"; li.style.listStyle = "none";
                        li._setH = function (px) { li.style.height = px + "px"; };
                        return li;
                    }
                });
            }
            _vs.setRows(_flattenVisible(), bKeepScroll !== false);
        }

        function render() {
            if (bVirtual) { _renderVirtual(true); return; }
            _index = 0;
            oUl.innerHTML = "";
            const aRoots = _roots() || [];
            for (let i = 0; i < aRoots.length; i++) { oUl.appendChild(_buildNode(aRoots[i], 0)); }
        }

        // 전체 펼침/접힘 — 모델 전체 순회로 _expanded 갱신 후 재렌더(WS20/USP 툴바용)
        function _walk(fn) {
            (function rec(aNodes, level) {
                if (!Array.isArray(aNodes)) { return; }
                for (let i = 0; i < aNodes.length; i++) {
                    const n = aNodes[i];
                    if (!n) { continue; }
                    fn(n, level);
                    rec(_children(n) || [], level + 1);
                }
            })(_roots() || [], 0);
        }
        function expandAll() { _walk(function (n) { if (_hasChildren(n)) { const k = _key(n); if (k !== "") { _expanded[k] = true; } } }); render(); }
        function collapseAll() { _walk(function (n) { const k = _key(n); if (k !== "") { _expanded[k] = false; } }); render(); }
        function expandToLevel(iLevel) { _walk(function (n, lvl) { if (_hasChildren(n)) { const k = _key(n); if (k !== "") { _expanded[k] = (lvl < iLevel); } } }); render(); }

        function setExpanded(node, bVal) { const k = _key(node); if (k !== "") { _expanded[k] = !!bVal; } render(); }

        // 한 노드의 서브트리(자신+모든 자손 폴더)를 한 번에 펼침(단일 render). 루트에 호출 시 트리 전체.
        //   (USP 컨텍스트 메뉴 "Expand Subtree" = 구 fnCommonUspTreeTableExpand 의 재귀 펼침)
        function expandSubtree(node) {
            (function rec(n) {
                if (!n) { return; }
                if (_hasChildren(n)) { const k = _key(n); if (k !== "") { _expanded[k] = true; } }
                const aCh = _children(n) || [];
                for (let i = 0; i < aCh.length; i++) { rec(aCh[i]); }
            })(node);
            render();
        }

        function findRow(sKey) {
            const aRows = oUl.querySelectorAll(".u4a-tree__row");
            for (let i = 0; i < aRows.length; i++) { if (aRows[i].__u4aKey === sKey) { return aRows[i]; } }
            return null;
        }
        // (선택사항) 베이스가 선택 강조를 소유할 화면용 — 한 행만 aria-selected
        function setSelected(node) { selectByKey(_key(node)); }
        function selectByKey(sKey) {
            // 가상 모드: 대상이 off-screen 이면 scrollToKey 로 reveal(스크롤+윈도우 렌더) 후 강조.
            const oRow = bVirtual ? scrollToKey(sKey) : findRow(sKey);
            const aSel = oUl.querySelectorAll('.u4a-tree__row[aria-selected="true"]');
            for (let i = 0; i < aSel.length; i++) { if (aSel[i] !== oRow) { aSel[i].removeAttribute("aria-selected"); } }
            if (oRow) { oRow.setAttribute("aria-selected", "true"); }
            return oRow;
        }

        // 키의 행을 화면에 보이게 — 가상 모드면 평탄 인덱스로 스크롤 후 윈도우 렌더(off-screen 행 reveal),
        //   비가상이면 scrollIntoView. (검색 이동/선택 reveal 공용)
        function scrollToKey(sKey) {
            if (!bVirtual) {
                const oRow = findRow(sKey);
                if (oRow && oRow.scrollIntoView) { oRow.scrollIntoView({ block: "center" }); }
                return oRow;
            }
            const aFlat = _flattenVisible();
            let idx = -1;
            for (let i = 0; i < aFlat.length; i++) { if (_key(aFlat[i].node) === sKey) { idx = i; break; } }
            if (idx < 0) { return null; }
            const oWrap = oUl.parentNode;
            if (oWrap) {
                const h = _vsRowH();
                oWrap.scrollTop = Math.max(0, idx * h - (oWrap.clientHeight / 2) + h / 2);
                _renderVirtual(true);
            }
            return findRow(sKey);
        }

        return {
            el: oUl, render: render,
            expandAll: expandAll, collapseAll: collapseAll, expandToLevel: expandToLevel,
            expandSubtree: expandSubtree,
            setExpanded: setExpanded, setSelected: setSelected, selectByKey: selectByKey, findRow: findRow,
            scrollToKey: scrollToKey
        };
    }

    /**
     * iframe(미리보기 등) 클릭 시 "열린 모든 오버레이"(팝오버/드롭다운/메뉴/셀렉트/서제스트/컨텍스트메뉴)를
     * 닫는다 — ★전역 1개 자동★ (팝오버마다 배선 불필요).
     *  ─ 문제: 바깥클릭 닫기는 전부 `document` 의 mousedown 으로 동작하는데, iframe **내부** 클릭은
     *    그 이벤트가 iframe 문서에서 소진돼 부모 document 로 안 올라온다 → 미리보기를 눌러도 안 닫혔다.
     *  ─ 해법: iframe 클릭 시 부모 window 가 blur 되고 document.activeElement 가 <iframe> 이 된다. 그 순간
     *    `document.body` 에 **합성 mousedown 을 1회 발화**하면, 이미 존재하는 모든 outside-close 핸들러가
     *    "바깥 클릭"으로 인식해 각자 닫힌다(메뉴바·셀렉트·서제스트·팝오버·컨텍스트메뉴 전부 한 번에).
     *  ─ 안전: 드래그류 document 핸들러(.u4a-dialog__header / .u4a-splitter__bar)는 target.closest 가드라
     *    body 가 target 이면 즉시 bail → 부작용 없음. alt-tab/다른 창 전환은 activeElement 가 iframe 이
     *    아니므로 발화 안 함(정확).
     */
    let _IFRAME_BLUR_CLOSE_ON = false;
    function _installIframeBlurClose() {
        if (_IFRAME_BLUR_CLOSE_ON || typeof window === "undefined") { return; }
        _IFRAME_BLUR_CLOSE_ON = true;
        window.addEventListener("blur", function () {
            // blur 시점엔 activeElement 가 아직 확정 전일 수 있어 다음 틱에 확인.
            setTimeout(function () {
                var oAE = document.activeElement;
                if (!oAE || oAE.tagName !== "IFRAME") { return; }   // iframe 클릭일 때만
                // 1) 합성 mousedown — 모든 outside-close 오버레이가 각자 정상 닫힘(리스너 정리까지).
                try {
                    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                } catch (e) { }
                // 2) 안전망 — 그래도 남은 메뉴(.u4a-menu = 상단 메뉴바 드롭다운 / 툴바 오버플로 ⋯)는 직접 제거.
                try {
                    var aMenus = document.querySelectorAll(".u4a-menu");
                    for (var i = 0; i < aMenus.length; i++) { aMenus[i].remove(); }
                } catch (e) { }
            }, 0);
        });
    }

    /**
     * 공통 플로팅 푸터 메시지 — WS10/WS20/WS30(USP) 단일 소스(구 화면별 복제 제거).
     * shell.css `.u4a-footer*` 스킨 소비. 아이콘(타입별)·텍스트·닫기(X)·자동숨김(기본 10s) 내장.
     *   · footerMarkup(sId)            → innerHTML 문자열(화면이 자기 마크업에 삽입)
     *   · footerShow(elOrId,type,msg,ms) → 표시(type: E/S/W/I, ms 생략=10000, 0=자동숨김 없음)
     *   · footerHide(elOrId)           → 숨김
     *   X(닫기)는 전역 위임 1개라 화면별 배선 불필요(data-u4a-footer-close).
     */
    const _FOOTER_ICON = { E: "circle-exclamation", S: "circle-check", W: "triangle-exclamation", I: "circle-info" };
    const _footerTimers = (typeof WeakMap !== "undefined") ? new WeakMap() : null;
    function _footerEl(elOrId) { return (typeof elOrId === "string") ? document.getElementById(elOrId) : elOrId; }
    function footerMarkup(sId) {
        return '' +
            '<div class="u4a-footer" id="' + (sId || "") + '" data-show="false" data-type="I">' +
            '<span class="u4a-footer__icon"><i class="fa-solid fa-circle-info"></i></span>' +
            '<span class="u4a-footer__text"></span>' +
            '<button class="u4a-btn-icon u4a-footer__close" type="button" title="Close" data-u4a-footer-close><i class="fa-solid fa-xmark"></i></button>' +
            '</div>';
    }
    function footerHide(elOrId) {
        const oF = _footerEl(elOrId);
        if (!oF) { return; }
        oF.setAttribute("data-show", "false");
        if (_footerTimers) { const t = _footerTimers.get(oF); if (t) { clearTimeout(t); _footerTimers.delete(oF); } }
    }
    function footerShow(elOrId, sType, sMsg, iMs) {
        const oF = _footerEl(elOrId);
        if (!oF) { return; }
        oF.setAttribute("data-type", sType || "I");
        const oIcon = oF.querySelector(".u4a-footer__icon");
        const oText = oF.querySelector(".u4a-footer__text");
        if (oIcon) { oIcon.innerHTML = '<i class="fa-solid fa-' + (_FOOTER_ICON[sType] || "circle-info") + '"></i>'; }
        if (oText) { oText.textContent = sMsg || ""; }
        oF.setAttribute("data-show", "true");
        if (_footerTimers) {
            const tp = _footerTimers.get(oF); if (tp) { clearTimeout(tp); _footerTimers.delete(oF); }
            const ms = (typeof iMs === "number") ? iMs : 10000;
            if (ms > 0) { _footerTimers.set(oF, setTimeout(function () { footerHide(oF); }, ms)); }
        }
    }
    // 닫기(X) 전역 위임 — 어느 화면의 .u4a-footer 든 X 클릭 시 닫힘(배선 0).
    if (typeof document !== "undefined" && !global.__u4aFooterCloseInit) {
        global.__u4aFooterCloseInit = true;
        document.addEventListener("click", function (ev) {
            const oBtn = (ev.target && ev.target.closest) ? ev.target.closest("[data-u4a-footer-close]") : null;
            if (!oBtn) { return; }
            const oF = oBtn.closest(".u4a-footer");
            if (oF) { footerHide(oF); }
        });
    }

    /**
     * 공통 입력 필드 팩토리 (sap.m.Input / sap.m.ComboBox 대응) — 생성+동작을 한 곳에서 단일화.
     * 화면은 createField(opts) 만 호출하고 마크업/클리어(X)/자동완성/F4/value-state/대문자/읽기전용을
     * 직접 짜지 않는다(두더지잡기 방지 — 색·구조는 shell.css/bootstrap-skin 공통이 단일 소유).
     * @param {Object} opts
     *   type      : "text"(기본)|"password"|"textarea"|"combo"|"select"
     *   value, placeholder, id, readOnly, disabled, rows(textarea), maxLength, width
     *   clear     : true → 값 있을 때만 X (attachClear)
     *   suggest   : fn()->string[] → 자동완성(attachSuggest), onPick: fn(value)
     *   f4        : fn(input) → 값도움(F4) 버튼, f4Icon(기본 magnifying-glass)
     *   upper     : true → 대문자 강제(커서 보존)
     *   onChange  : fn(value)  onEnter: fn(value)  onInput: fn(value)
     *   items/onOpen : combo/select 용(createSelect 위임)
     *   className(래퍼 추가 클래스), inputClassName(input 추가 클래스)
     * @returns {Object} { el, input, getValue, setValue, setReadOnly, setValueState, setItems, focus }
     */
    function createField(opts) {
        opts = opts || {};
        const sType = opts.type || "text";

        // ── combo / select : createSelect 위임(콤보는 .value getter/setter + setItems 보유) ──
        if (sType === "combo" || sType === "select") {
            const oCombo = createSelect(opts.items || [], opts.value, opts.onChange, { onOpen: opts.onOpen });
            if (opts.id) { oCombo.id = opts.id; }
            if (opts.className) { opts.className.split(/\s+/).forEach(c => { if (c) { oCombo.classList.add(c); } }); }
            if (opts.width) { oCombo.style.width = opts.width; }
            if (opts.disabled) { oCombo.setAttribute("aria-disabled", "true"); }
            return {
                el: oCombo, input: oCombo,
                getValue() { return oCombo.value; },
                setValue(v) { oCombo.value = v; },
                setItems(a) { if (oCombo.setItems) { oCombo.setItems(a); } },
                setReadOnly() { },
                setValueState() { },
                focus() { oCombo.focus(); }
            };
        }

        // ── text / password / textarea : .u4a-field 래퍼 + .u4a-input ──
        const oWrap = _el("div", "u4a-field" + (opts.className ? " " + opts.className : ""));
        if (opts.width) { oWrap.style.width = opts.width; }

        const oInput = _el(sType === "textarea" ? "textarea" : "input",
            "u4a-input u4a-field__input" + (opts.inputClassName ? " " + opts.inputClassName : ""));
        if (sType !== "textarea") { oInput.type = (sType === "password") ? "password" : "text"; }
        if (sType === "textarea" && opts.rows) { oInput.rows = opts.rows; }
        if (opts.id) { oInput.id = opts.id; }
        if (opts.placeholder) { oInput.placeholder = opts.placeholder; }
        if (opts.maxLength != null) { oInput.maxLength = opts.maxLength; }
        oInput.value = (opts.value == null ? "" : String(opts.value));
        if (opts.readOnly) { oInput.readOnly = true; }
        if (opts.disabled) { oInput.disabled = true; }
        oWrap.appendChild(oInput);

        // 트레일링 슬롯(clear / F4) — data-trail 로 CSS 가 우측 패딩 계산
        let iTrail = 0, oClear = null, _clearSync = null;
        if (opts.clear) {
            oClear = _el("button", "u4a-field__clear");
            oClear.type = "button"; oClear.tabIndex = -1;
            oClear.title = "Clear"; oClear.setAttribute("aria-label", "Clear");
            oClear.innerHTML = _fa("xmark");
            oWrap.appendChild(oClear); iTrail++;
        }
        if (opts.f4) {
            const oVh = _el("button", "u4a-field__vh");
            oVh.type = "button"; oVh.tabIndex = -1;
            oVh.innerHTML = opts.f4IconHtml || _fa(opts.f4Icon || "magnifying-glass");
            if (opts.f4Disabled) { oVh.disabled = true; }
            oVh.addEventListener("click", () => { try { opts.f4(oInput); } catch (e) { } });
            oWrap.appendChild(oVh); iTrail++;
        }
        if (iTrail) { oWrap.setAttribute("data-trail", String(iTrail)); }

        // 동작 배선(기존 공통 블록 재사용). onClear: 비운 뒤 콜백(모델 반영 등).
        if (opts.clear) { try { _clearSync = attachClear(oInput, oClear, opts.onClear || null); } catch (e) { } }
        if (opts.suggest) { try { attachSuggest(oInput, opts.suggest, opts.onPick || null); } catch (e) { } }
        if (opts.upper) {
            oInput.addEventListener("input", () => {
                const s = oInput.selectionStart, e = oInput.selectionEnd;
                const up = oInput.value.toUpperCase();
                if (up !== oInput.value) { oInput.value = up; try { oInput.setSelectionRange(s, e); } catch (x) { } }
            });
        }
        if (opts.onInput) { oInput.addEventListener("input", () => opts.onInput(oInput.value)); }
        if (opts.onChange) { oInput.addEventListener("change", () => opts.onChange(oInput.value)); }
        if (opts.onEnter) {
            oInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") { ev.preventDefault(); opts.onEnter(oInput.value); }
            });
        }

        let oMsg = null;
        return {
            el: oWrap, input: oInput,
            getValue() { return oInput.value; },
            setValue(v) {
                oInput.value = (v == null ? "" : String(v));
                if (typeof _clearSync === "function") { try { _clearSync(); } catch (e) { } }
            },
            setReadOnly(b) { oInput.readOnly = !!b; },
            // value-state(검증) — data-vs(빨간 테두리, 상시) + 메시지(.u4a-field__msg, 포커스시 표시는 CSS).
            setValueState(sState, sMsg) {
                if (sState && sState !== "none") { oInput.setAttribute("data-vs", sState); }
                else { oInput.removeAttribute("data-vs"); }
                if (sMsg != null && sMsg !== "") {
                    if (!oMsg) { oMsg = _el("span", "u4a-field__msg"); oWrap.appendChild(oMsg); }
                    oMsg.textContent = sMsg;
                    if (sState) { oMsg.setAttribute("data-vs", sState); }
                } else if (oMsg) { oMsg.textContent = ""; }
            },
            setItems() { },
            focus() { oInput.focus(); }
        };
    }

    /**
     * 접이식 패널 (sap.m.Panel expandable 대응) — 공통 컴포넌트.
     * 헤더 = 토글(twisty+제목) + 액션 슬롯(검색 버튼 등). 버튼 중첩 회피 위해 head 는 div,
     * 접기 토글만 button. 색/구조는 shell.css `.u4a-panel*` 단일 소유. USP Properties / F4 검색조건 소비.
     * @param {Object} [cfg] title(제목) · collapsed(초기 접힘) · onToggle(fn(bCollapsed))
     * @returns {Object} { el, head, body, actions, toggle, setCollapsed(b), isCollapsed() }
     */
    function createPanel(cfg) {
        cfg = cfg || {};
        const sec = _el("section", "u4a-panel");
        const head = _el("div", "u4a-panel__head");
        const tgl = _el("button", "u4a-panel__toggle");
        tgl.type = "button";
        tgl.setAttribute("aria-expanded", "true");
        const tw = _el("span", "u4a-panel__twisty"); tw.innerHTML = ICON.treeChevron; // chevron-right(+CSS 90° 회전)
        const ttl = _el("span", "u4a-panel__title"); ttl.textContent = cfg.title || "";
        tgl.append(tw, ttl);
        const actions = _el("div", "u4a-panel__actions");
        head.append(tgl, actions);
        const body = _el("div", "u4a-panel__body");
        sec.append(head, body);

        function isCollapsed() { return sec.getAttribute("data-collapsed") === "X"; }
        function setCollapsed(b) {
            sec.setAttribute("data-collapsed", b ? "X" : "");
            tgl.setAttribute("aria-expanded", b ? "false" : "true");
            if (typeof cfg.onToggle === "function") { try { cfg.onToggle(!!b); } catch (e) { } }
        }
        tgl.addEventListener("click", function () { setCollapsed(!isCollapsed()); });
        if (cfg.collapsed) { setCollapsed(true); }

        return { el: sec, head: head, body: body, actions: actions, toggle: tgl, setCollapsed: setCollapsed, isCollapsed: isCollapsed };
    }

    /**
     * 프로그램적으로 값을 채운 뒤 clear(X) 노출 상태를 재동기화한다(전 화면 공통).
     *  - attachClear 는 `input` 이벤트(타이핑)로만 data-filled 를 토글하므로, 화면 렌더가
     *    `el.value = ...` 로 값을 넣으면 X 가 안 뜬다(이벤트 미발생). 그 직후 이 함수를 호출.
     *  - createField 의 setValue 는 내부에서 자동 호출하지만, getElementById 로 직접 값을 넣는
     *    렌더 경로(예: WS30 fnRenderUspProperties/Doc)는 이 함수를 명시 호출한다.
     */
    function syncClear(oInput) {
        if (!oInput || !oInput.closest) { return; }
        const oField = oInput.closest(".u4a-field");
        if (oField) { oField.dataset.filled = oInput.value ? "true" : "false"; }
    }

    /* ── 컬럼 헤더 정렬/필터 메뉴 (.u4a-colmenu) — 전 화면 공통 ──────────────
     * 헤더(.u4a-th--menu) 클릭 시 공통 메뉴(필터 input → 오름/내림 정렬 → 필터 초기화)를 연다.
     * ServerList/AppF4 가 쓰던 패턴을 공통화 — 화면은 상태 컨트롤러(ctl)만 제공:
     *   ctl = { getFilter(key), setFilter(key,val), getSort()→{key,dir}|null, setSort(key,dir), rerender() }
     *   opts = { container: 앵커 append 대상(top-layer 다이얼로그 등, 기본 document.body),
     *            labels: { filter, asc, desc, clear } }  // 문구 키는 화면이 해석해 전달(메시지 SSOT 유지)
     */
    let _oColMenuEl = null;
    function _onColMenuOutside(e) { if (_oColMenuEl && !_oColMenuEl.contains(e.target)) { closeColumnMenu(); } }
    function closeColumnMenu() {
        if (!_oColMenuEl) { return; }
        try { _oColMenuEl.remove(); } catch (e) { }
        _oColMenuEl = null;
        document.removeEventListener("mousedown", _onColMenuOutside, true);
        window.removeEventListener("resize", closeColumnMenu);
        window.removeEventListener("scroll", closeColumnMenu, true);
    }
    function openColumnMenu(oCol, oTh, ctl, opts) {
        opts = opts || {};
        const L = opts.labels || {};
        const oContainer = opts.container || document.body;
        closeColumnMenu();

        const m = _el("div", "u4a-menu u4a-colmenu");
        m.setAttribute("role", "menu");
        m.addEventListener("click", function (e) { e.stopPropagation(); });

        // 필터 input (contains, Enter/blur 적용)
        const fw = _el("div", "u4a-colmenu__filter");
        const fi = _el("input", "u4a-input");
        fi.type = "text";
        fi.placeholder = L.filter || "";
        fi.value = ctl.getFilter(oCol.key) || "";
        function applyF() {
            const v = fi.value.trim().toLowerCase(), cur = ctl.getFilter(oCol.key) || "";
            if (v === cur) { return; }
            ctl.setFilter(oCol.key, v);
            ctl.rerender();
        }
        fi.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyF(); closeColumnMenu(); } });
        fi.addEventListener("blur", applyF);
        fw.appendChild(fi);
        m.appendChild(fw);

        m.appendChild(_el("div", "u4a-colmenu__sep"));

        // 정렬(오름/내림 — 활성 방향 재클릭 시 해제)
        function mkSort(sDir, sIcon, sLabel) {
            const it = _el("div", "u4a-menu__item");
            it.setAttribute("role", "menuitem");
            it.innerHTML = _fa(sIcon) + "<span></span>";
            it.querySelector("span").textContent = sLabel || "";
            const s = ctl.getSort();
            const bActive = (s && s.key === oCol.key && s.dir === sDir);
            if (bActive) { it.setAttribute("data-active", "true"); }
            it.addEventListener("click", function () {
                if (bActive) { ctl.setSort(null, null); } else { ctl.setSort(oCol.key, sDir); }
                ctl.rerender(); closeColumnMenu();
            });
            return it;
        }
        m.appendChild(mkSort("asc", "arrow-up", L.asc));
        m.appendChild(mkSort("desc", "arrow-down", L.desc));

        m.appendChild(_el("div", "u4a-colmenu__sep"));

        // 필터 초기화(이 컬럼) — 활성 필터 없으면 비활성
        const clr = _el("div", "u4a-menu__item");
        clr.setAttribute("role", "menuitem");
        clr.innerHTML = _fa("xmark") + "<span></span>";
        clr.querySelector("span").textContent = L.clear || "";
        if (!ctl.getFilter(oCol.key)) { clr.setAttribute("aria-disabled", "true"); }
        clr.addEventListener("click", function () {
            if (!ctl.getFilter(oCol.key)) { return; }
            ctl.setFilter(oCol.key, ""); fi.value = ""; ctl.rerender(); closeColumnMenu();
        });
        m.appendChild(clr);

        // 위치 — 앵커(헤더) 아래. container(top-layer 다이얼로그 등) 안에 붙여 모달 위로.
        oContainer.appendChild(m);
        const r = oTh.getBoundingClientRect();
        m.style.position = "fixed";
        m.style.top = r.bottom + "px";
        m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + "px";
        m.style.zIndex = "10";
        _oColMenuEl = m;
        // 창 리사이즈/스크롤 시 닫기 — 앵커 이동으로 위치 어긋남 방지.
        window.addEventListener("resize", closeColumnMenu);
        window.addEventListener("scroll", closeColumnMenu, true);
        setTimeout(function () { document.addEventListener("mousedown", _onColMenuOutside, true); }, 0);
        try { fi.focus(); } catch (e) { }   // 열리면 바로 필터 입력 가능
    }

    /* ── 가상 스크롤(windowing) — 보이는 행만 DOM 에 렌더 (전 화면 공통) ────────
     *  대용량 테이블에서 DOM 폭증을 막는다. 보이는 구간[start,end]만 <tr> 생성, 위/아래 빈 높이는
     *  스페이서 <tr> 로 확보(전체 높이=total*ROWH 일정 → scrollbar 안정). 행 실제높이를 1회 측정→정수
     *  반올림해 `--u4a-vsrowh`(셸 CSS 가 데이터 행에 강제) 고정 → 끝단 떨림 제거. (AppF4 에서 검증된 코드 승격)
     *  opt: { colCount, buildRow(item,absIdx)→<tr>, rowH?, overscan?, nodata?, getSelKey?(item) }
     *  반환: { setRows(arr, bKeepScroll), refresh(), setSel(key), getSel() }
     *  ※ oWrap 은 overflow:auto 스크롤 컨테이너, oTbody 는 그 안 <tbody>. 셸 공통 CSS 가
     *    `.u4a-table-wrap tbody tr:not(.u4aVSpacer)>td{height:var(--u4a-vsrowh,...)}` 로 행높이 강제. */
    function makeVScroller(oWrap, oTbody, opt) {
        let ROWH = opt.rowH || 36;          // 행 높이(첫 렌더 후 실제 측정으로 보정)
        const OVER = opt.overscan || 6;     // 위/아래 여유 행
        let aData = [];
        let bMeasured = false;
        let raf = 0;
        let selKey = null;

        // 스페이서 — 기본은 테이블(tr/td/div), opt.makeSpacer 주면 그걸로(리스트/트리 모드: li 스페이서).
        //   반환 요소는 반드시 _setH(px) 를 가져야 한다(위/아래 빈 높이 강제).
        function _defaultSpacer() {
            const tr = document.createElement("tr");
            tr.className = "u4aVSpacer"; tr.setAttribute("aria-hidden", "true");
            const td = document.createElement("td");
            td.colSpan = opt.colCount;
            td.style.padding = "0"; td.style.border = "0";
            const div = document.createElement("div");
            div.style.height = "0px"; div.style.width = "1px";
            td.appendChild(div);
            tr.appendChild(td);
            // 높이를 div + td 양쪽에 — table-layout:fixed 에서 cell 자식 div 높이가 행높이로 반영 안 되는 환경 대비.
            tr._setH = function (px) { div.style.height = px + "px"; td.style.height = px + "px"; };
            return tr;
        }
        const _mkSpacer = opt.makeSpacer || _defaultSpacer;
        const oTop = _mkSpacer(), oBot = _mkSpacer();

        function _render() {
            const total = aData.length;
            // ★ scrollTop 은 DOM 건드리기 전에 읽는다(비우면 높이 붕괴→scrollTop 0 클램프→맨 위로 튕김).
            const st = oWrap.scrollTop, vh = oWrap.clientHeight || 400;

            // oTbody(행 컨테이너)가 oWrap(스크롤 컨테이너) 안에서 시작하는 오프셋(sticky thead / USP 컬럼헤더 등)
            //   을 보정. 안 빼면 윈도우 시작행이 헤더 높이만큼 어긋나 양 끝에서 살짝 떠 보인다(특히 헤더>1행).
            //   off = oTbody 의 "콘텐츠 좌표상 top"(스크롤과 무관하게 일정).
            let off = 0;
            try {
                off = (oTbody.getBoundingClientRect().top - oWrap.getBoundingClientRect().top) + st;
                if (!(off > 0)) { off = 0; }
            } catch (e) { off = 0; }

            if (!total) {
                oTbody.textContent = "";
                if (opt.nodata != null) {
                    let trN;
                    if (opt.makeNodata) { trN = opt.makeNodata(opt.nodata); }
                    else {
                        trN = document.createElement("tr"); trN.className = "u4a-table__nodata";
                        const tdN = document.createElement("td"); tdN.colSpan = opt.colCount; tdN.textContent = opt.nodata;
                        trN.appendChild(tdN);
                    }
                    if (trN) { oTbody.appendChild(trN); }
                }
                return;
            }

            // 오버스캔 = 최소 한 뷰포트 만큼 위/아래 버퍼. ★ 빠른 끝→끝 스크롤서 컴포지터가 메인스레드 행
            //   재활용보다 앞서가 모서리에 1프레임 빈칸(부르르 뜸)이 생기는데, 버퍼를 뷰포트만큼 잡으면
            //   그 빈칸이 화면 밖에 머물러 체감 깜빡임이 사라진다(렌더 행 수는 ~3뷰포트로 여전히 적음).
            const over = Math.max(OVER, Math.ceil(vh / ROWH));
            const start = Math.max(0, Math.floor((st - off) / ROWH) - over);
            const cnt = Math.ceil(vh / ROWH) + over * 2;
            const end = Math.min(total, start + cnt);

            // 스페이서가 항상 양 끝에 존재하도록(없을 때만 초기화 — 높이 붕괴 방지).
            if (oTop.parentNode !== oTbody || oBot.parentNode !== oTbody) {
                oTbody.textContent = "";
                oTbody.appendChild(oTop);
                oTbody.appendChild(oBot);
            }
            oTop._setH(start * ROWH);
            oBot._setH(Math.max(0, total - end) * ROWH);

            // 새 행 먼저 삽입 후 옛 행 제거(삽입-먼저/제거-나중 → 높이 목표 밑으로 안 내려가 클램프 없음).
            const aOld = [];
            for (let n = oTop.nextElementSibling; n && n !== oBot; n = n.nextElementSibling) { aOld.push(n); }
            const frag = document.createDocumentFragment();
            for (let i = start; i < end; i++) {
                const tr = opt.buildRow(aData[i], i);
                if (selKey != null && opt.getSelKey && opt.getSelKey(aData[i]) === selKey) {
                    tr.setAttribute("aria-selected", "true");
                }
                frag.appendChild(tr);
            }
            oTbody.insertBefore(frag, oBot);
            for (let j = 0; j < aOld.length; j++) { oTbody.removeChild(aOld[j]); }

            // 첫 렌더 1회 실제 행높이 측정 → 정수 반올림해 ROWH 고정 + CSS 로 데이터 행높이 강제(끝단 떨림 제거).
            if (!bMeasured) {
                const oFirst = oTop.nextElementSibling;
                if (oFirst && oFirst !== oBot) {
                    bMeasured = true;
                    const h = oFirst.getBoundingClientRect().height;
                    if (h) {
                        const r = Math.max(1, Math.round(h));
                        oWrap.style.setProperty("--u4a-vsrowh", r + "px");
                        if (r !== ROWH) { ROWH = r; _render(); }
                    }
                }
            }
        }
        function _onScroll() {
            if (raf) { return; }
            raf = requestAnimationFrame(function () { raf = 0; _render(); });
        }
        oWrap.addEventListener("scroll", _onScroll);

        // ★ 휠 직접 처리 — 가상 스크롤 컨테이너의 네이티브 휠→스크롤이 안 먹는 환경(모달 top-layer 등) 대비.
        oWrap.addEventListener("wheel", function (e) {
            if (e.ctrlKey) { return; }   // Ctrl+휠=줌 양보
            const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? (oWrap.clientHeight || 1) : 1);
            const t0 = oWrap.scrollTop, l0 = oWrap.scrollLeft;
            oWrap.scrollTop = t0 + e.deltaY * unit;
            oWrap.scrollLeft = l0 + e.deltaX * unit;
            if (oWrap.scrollTop !== t0 || oWrap.scrollLeft !== l0) { e.preventDefault(); }
        }, { passive: false });

        // 컨테이너 크기 변경(스플리터/창 리사이즈) 시 보일 행 수가 바뀌므로 재계산(rAF 스로틀=_onScroll).
        if (typeof ResizeObserver !== "undefined") {
            try { new ResizeObserver(function () { _onScroll(); }).observe(oWrap); } catch (e) { }
        }

        return {
            setRows: function (a, bKeepScroll) {
                aData = a || [];
                if (!bKeepScroll) {
                    try { oWrap.scrollTop = 0; } catch (e) { }
                } else {
                    const maxTop = Math.max(0, aData.length * ROWH - (oWrap.clientHeight || 0));
                    if (oWrap.scrollTop > maxTop) { try { oWrap.scrollTop = maxTop; } catch (e) { } }
                }
                _render();
            },
            refresh: _render,
            setSel: function (k) { selKey = k; },
            getSel: function () { return selKey; }
        };
    }

    const U4AUI = {
        el: _el,
        createField: createField,
        syncClear: syncClear,
        createPanel: createPanel,
        footerMarkup: footerMarkup,
        footerShow: footerShow,
        footerHide: footerHide,
        createTree: createTree,
        createSelect: createSelect,
        attachSuggest: attachSuggest,
        attachClear: attachClear,
        attachOverflow: attachOverflow,
        openColumnMenu: openColumnMenu,
        closeColumnMenu: closeColumnMenu,
        makeVScroller: makeVScroller,
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

    // 스플릿바 더블클릭 → 최초 위치 복귀 전역 1회 설치 — 모든 .u4a-splitter__bar 자동(배선 불필요).
    try { _installGlobalSplitterReset(); } catch (e) { }

    // iframe(미리보기) 클릭 시 열린 모든 오버레이(메뉴/드롭다운/팝오버) 닫기 전역 1회 설치 — 배선 불필요.
    try { _installIframeBlurClose(); } catch (e) { }

    // CommonJS(Electron nodeIntegration) 환경에서도 require 가능하게
    if (typeof module === "object" && module.exports) {
        module.exports = U4AUI;
    }

})(typeof window !== "undefined" ? window : this);
