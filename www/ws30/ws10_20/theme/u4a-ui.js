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

            aItems.forEach((it, idx) => {
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
            oInput.focus();
        }

        oInput.addEventListener("input", () => _open(false));     // 타이핑 → 부분일치 필터
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

    const U4AUI = {
        el: _el,
        createSelect: createSelect,
        attachSuggest: attachSuggest,
        attachClear: attachClear
    };

    global.U4AUI = U4AUI;

    // CommonJS(Electron nodeIntegration) 환경에서도 require 가능하게
    if (typeof module === "object" && module.exports) {
        module.exports = U4AUI;
    }

})(typeof window !== "undefined" ? window : this);
