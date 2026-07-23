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

        // 스크롤 시 닫기 — 단, 펼침목록 "자기 내부"의 overflow 스크롤은 무시한다. capture scroll 이
        //   내부 스크롤까지 잡으면(스크롤 이벤트는 버블 안 해 capture 필요) 목록을 휠로 넘기는 순간
        //   닫혀버려 "스크롤이 안 되는" 것처럼 보인다(테마 등 항목 많은 콤보). 바깥(앵커 이동)만 닫기.
        function _onScrollClose(ev) {
            if (oList && (ev.target === oList || (oList.contains && oList.contains(ev.target)))) { return; }
            _close();
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
            oList.style.minWidth = r.width + "px";
            // 좌우 클램프 — 목록이 콤보보다 넓을 수 있다(긴 항목명). 오른쪽 뷰포트 밖으로 나가 잘리지
            //   않게 left 보정(앵커 좌측 기준, 넘치면 좌측으로 당김, 최소 4px).
            const lw = oList.offsetWidth;
            let lLeft = r.left;
            if (lLeft + lw > window.innerWidth - 4) { lLeft = window.innerWidth - lw - 4; }
            if (lLeft < 4) { lLeft = 4; }
            oList.style.left = lLeft + "px";
            // 상단 경계 = 타이틀바 하단(공통 §2.2). 세로 배치/높이 클램프는 _clampListV 1곳.
            _clampListV(oList, r, r.bottom + 2);

            oCombo.dataset.open = "true";
            oCombo.setAttribute("aria-expanded", "true");
            _setActive(iActive < 0 ? 0 : iActive);

            setTimeout(() => document.addEventListener("mousedown", _onOutside), 0);
            // 창 리사이즈/스크롤 시 닫기 — 앵커(콤보)가 옮겨가 펼침목록 위치가 어긋나는 것 방지.
            //   scroll 은 capture 로 내부 스크롤러(속성패널 등)까지 잡는다(스크롤 이벤트는 버블 안 함).
            window.addEventListener("resize", _close);
            window.addEventListener("scroll", _onScrollClose, true);
        }

        function _close() {
            if (!oList) { return; }
            oList.remove();
            oList = null;
            oCombo.removeAttribute("data-open");
            oCombo.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOutside);
            window.removeEventListener("resize", _close);
            window.removeEventListener("scroll", _onScrollClose, true);
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
            oList.style.minWidth = r.width + "px";
            // 세로 배치/높이 클램프(§2.2) — 콤보와 동일 로직 1곳. 후보가 많아도 화면 밖으로
            //   늘어나지 않고 내부 스크롤로 제한된다(예전엔 CSS max-height 에만 기대고 있었다).
            _clampListV(oList, r, iTop);
        }

        function _open(bShowAll) {
            aMatch = _filtered(bShowAll);
            if (!aMatch.length) { _close(); return; }

            if (!oList) {
                oList = _el("div", "u4a-combo__list");
                oList.setAttribute("role", "listbox");
                (oInput.closest("dialog") || document.body).appendChild(oList);
                setTimeout(() => document.addEventListener("mousedown", _onOutside), 0);
                // 창 리사이즈/스크롤 시 닫기 — 앵커(입력칸) 이동으로 위치 어긋남 방지.
                //   단, 제안목록 자기 내부 스크롤은 무시(_onScrollClose) — 안 그러면 목록을 휠로 넘기는 순간 닫힌다.
                window.addEventListener("resize", _close);
                window.addEventListener("scroll", _onScrollClose, true);
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
            window.removeEventListener("scroll", _onScrollClose, true);
        }

        // 제안목록 자기 내부 스크롤은 닫지 않음(바깥 앵커 이동만 닫기) — createSelect 와 동일 이유.
        function _onScrollClose(ev) {
            if (oList && (ev.target === oList || (oList.contains && oList.contains(ev.target)))) { return; }
            _close();
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
        // 스크롤 닫기 — 단, 메뉴 자신/내부, 또는 메뉴에서 띄운 콤보 펼침목록(.u4a-combo__list) 안의
        //   스크롤은 무시한다(휠로 목록을 넘기는 순간 뒤 메뉴가 닫혀버리던 문제 방지 — createSelect
        //   _onScrollClose 와 동일 사상). 바깥(앵커 이동) 스크롤만 닫는다.
        function _onScroll(ev) {
            var t = ev.target;
            if (t && t.closest && (t.closest(".u4a-menu") || t.closest(".u4a-combo__list"))) { return; }
            _closeMenu();
        }
        function _closeMenu() {
            if (!oMenu) { return; }
            oMenu.remove(); oMenu = null;
            oOvf.setAttribute("aria-expanded", "false");
            document.removeEventListener("mousedown", _onOut, true);
            document.removeEventListener("keydown", _onEsc, true);
            window.removeEventListener("resize", _closeMenu);
            window.removeEventListener("scroll", _onScroll, true);
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
                // menuItem 은 단일 객체 또는 객체 배열을 반환할 수 있다 — 버튼 1개를 여러 메뉴
                //   항목으로 분해(예: range 슬라이더 → "Zoom Out / Zoom In")할 때 배열 사용.
                const aMi = Array.isArray(mi) ? mi : [mi];
                aMi.forEach(function (one) {
                    if (!one) { return; }
                    // 커스텀 노드(예: range 슬라이더) — 아이콘+텍스트 대신 노드를 그대로 배치한다.
                    //   조작용이라 hover 강조/클릭-닫기 없음(메뉴 내부 클릭은 outside-close 에 안 잡힘).
                    if (one.node) {
                        const oCustom = _el("div", "u4a-menu__item u4a-menu__item--custom");
                        oCustom.appendChild(one.node);
                        oMenu.appendChild(oCustom);
                        return;
                    }
                    // 비활성 상태: 항목이 명시(one.disabled)하면 그것을, 없으면 원본 버튼 상태를
                    //   자동 감지(disabled / .is-disabled). 메뉴 항목에 aria-disabled 를 붙여 흐리게
                    //   표시(shell.css)하고 클릭을 무시한다 — 툴바에서 비활성인 버튼이 ⋯ 메뉴에선
                    //   활성처럼 보이던 버그 방지(공통 1곳 수정으로 전 소비처 적용).
                    let bDis = one.disabled;
                    if (bDis === undefined) { bDis = el.disabled === true || el.classList.contains("is-disabled"); }
                    const oItem = _el("div", "u4a-menu__item");
                    oItem.setAttribute("role", "menuitem");
                    if (bDis) { oItem.setAttribute("aria-disabled", "true"); }
                    oItem.innerHTML = (one.iconHtml || "<i></i>") + '<span class="u4a-menu__item-text"></span>';
                    oItem.querySelector(".u4a-menu__item-text").textContent = one.text;
                    oItem.addEventListener("click", function (e) {
                        e.stopPropagation();
                        if (bDis) { return; }   // 비활성 항목은 클릭 무시(메뉴 유지)
                        _closeMenu();
                        if (typeof one.onClick === "function") { one.onClick(); }
                    });
                    oMenu.appendChild(oItem);
                });
            });
            (oBar.closest("dialog") || document.body).appendChild(oMenu);
            const r = oOvf.getBoundingClientRect();
            let left = r.right - oMenu.offsetWidth; // 우측 정렬
            if (left + oMenu.offsetWidth > window.innerWidth - 4) { left = window.innerWidth - oMenu.offsetWidth - 4; }
            if (left < 4) { left = 4; }
            // 상단 경계 = 타이틀바 하단(공통 §2.2: 팝업은 .u4a-titlebar 침범 금지). 위로 펼쳐도 그 아래까지.
            const topMin = (_topChromeBottom() || 0) + 2;
            let top = r.bottom + 2;
            if (top + oMenu.offsetHeight > window.innerHeight - 4) { top = r.top - oMenu.offsetHeight - 2; }  // 위로 플립
            if (top < topMin) { top = topMin; }
            // [타이틀바~화면하단] 에 안 들어가면 높이 제한 → 내부 스크롤(타이틀바/화면밖 침범 방지).
            const maxH = window.innerHeight - 4 - top;
            if (oMenu.offsetHeight > maxH) { oMenu.style.maxHeight = maxH + "px"; oMenu.style.overflowY = "auto"; }
            oMenu.style.left = left + "px";
            oMenu.style.top = top + "px";
            oOvf.setAttribute("aria-expanded", "true");
            // 창 리사이즈/스크롤 시 닫기 — 앵커(⋯ 버튼) 이동으로 위치 어긋남 방지(ResizeObserver reflow 보강).
            window.addEventListener("resize", _closeMenu);
            window.addEventListener("scroll", _onScroll, true);
            setTimeout(function () {
                document.addEventListener("mousedown", _onOut, true);
                document.addEventListener("keydown", _onEsc, true);
            }, 0);
        }
        oOvf.addEventListener("click", function () { if (oMenu) { _closeMenu(); } else { _openMenu(); } });

        // ★ 성능 — 항목 "자연폭"은 내용이 바뀔 때만 변한다(리사이즈로는 안 변함).
        //   과거 reflow 는 매번 [전 항목 hidden 해제 → 항목마다 offsetWidth 읽기 → 다시 숨김] 을 했는데,
        //   이 되살리기(쓰기)+측정(읽기) 반복이 레이아웃 스래싱이라, 스플리터 드래그처럼 폭이 매 프레임
        //   변하는 상황에서 툴바 수만큼 곱해져 버벅였다(이 팝업 툴바 4개). → 자연폭을 1회 실측해 캐시하고,
        //   리사이즈(RO)에선 캐시만 써서 "읽기 0". 내용 변경은 MutationObserver 로 감지해 캐시를 버린다.
        //   (hidden/style.display 는 속성 변경이라 MO(childList·characterData)를 건드리지 않음 → 자기유발 무효화 없음.)
        //   장군님 지적 2026-07-14.
        let C = null;   // { w:Map(el→px), gap, padL, padR, ovfW }
        function _measure() {
            const aAll = _items();
            aAll.forEach(function (el) { if (!fnIsSkip(el)) { el.hidden = false; } });   // 측정 위해 숨김 해제(스페이서 제외)
            oOvf.hidden = false;
            const cs = getComputedStyle(oBar);
            const m = new Map();
            aAll.forEach(function (el) { if (!fnIsSkip(el)) { m.set(el, el.offsetWidth); } });
            C = {
                w: m,
                gap: parseFloat(cs.columnGap || cs.gap) || 0,
                padL: parseFloat(cs.paddingLeft) || 0,
                padR: parseFloat(cs.paddingRight) || 0,
                ovfW: oOvf.offsetWidth
            };
        }
        // 캐시 기반 적용 — 레이아웃 읽기는 oBar.clientWidth 단 1회(쓰기 前).
        function _apply() {
            if (!oBar.isConnected) { return; }
            _closeMenu();
            if (!C) { _measure(); }
            // 모드 가시(style.display!=="none") 항목만 대상 + skip(스페이서) 제외
            const aVis = _items().filter(function (el) { return !fnIsSkip(el) && el.style.display !== "none"; });
            let avail = oBar.clientWidth - C.padL - C.padR;
            // 우측정렬(skip 스페이서) 모드: 스페이서 주변 gap 만큼 보수적으로 차감(폭 측정에서 스페이서를
            //   뺐으므로 실제 행 gap 1개가 누락 — 1~몇 px 차이로 버튼이 살짝 잘리는 것 방지).
            if (opt.isSkip) { avail -= C.gap; }
            const aW = aVis.map(function (el) { return C.w.get(el) || 0; });
            const total = aW.reduce(function (a, b) { return a + b; }, 0) + C.gap * Math.max(0, aVis.length - 1);
            if (total <= avail) {   // 다 들어감 → 전부 표시 + ⋯ 숨김
                aVis.forEach(function (el) { el.hidden = false; });
                oOvf.hidden = true;
                return;
            }
            let used = 0, iCut = aVis.length;
            for (let i = 0; i < aVis.length; i++) {
                const w = aW[i] + (i > 0 ? C.gap : 0);
                if (used + w + C.gap + C.ovfW > avail) { iCut = i; break; }
                used += w;
            }
            for (let i = 0; i < aVis.length; i++) { aVis[i].hidden = (i >= iCut); }
            // 보이는 영역 끝에 매달린 구분선 정리
            for (let k = iCut - 1; k >= 0; k--) {
                if (fnIsSep(aVis[k])) { aVis[k].hidden = true; } else { break; }
            }
            // 숨겨진 "버튼"(비구분선)이 없으면 ⋯ 불필요
            const bAny = aVis.some(function (el) { return el.hidden && !fnIsSep(el); });
            oOvf.hidden = !bAny;
        }
        // 공개 reflow = 내용이 바뀌었을 수 있으니 캐시 버리고 재측정.
        function reflow() { C = null; _apply(); }

        // ★ _apply 는 버튼 hidden 을 토글해 바 레이아웃을 바꾸므로, RO 콜백에서 동기로 부르면
        //   같은 프레임에 RO 가 재발화 → "ResizeObserver loop limit exceeded" 무해 경고가 뜬다
        //   (툴바 여러 개일수록 빈번). rAF 로 한 프레임에 1회만 코얼레싱해 루프 자체를 끊는다.
        let oRO = null, oMO = null, iRafOvf = 0;
        function _scheduleReflow() {
            if (iRafOvf) { return; }
            iRafOvf = requestAnimationFrame(function () { iRafOvf = 0; _apply(); });   // 리사이즈 = 캐시 사용(재측정 X)
        }
        if (window.ResizeObserver) { oRO = new ResizeObserver(_scheduleReflow); oRO.observe(oBar); }
        else { setTimeout(reflow, 0); }
        // 항목 추가/삭제·라벨(텍스트) 변경 시에만 캐시 무효화 → 다음 적용에서 재측정.
        if (window.MutationObserver) {
            oMO = new MutationObserver(function () { C = null; _scheduleReflow(); });
            oMO.observe(oBar, { childList: true, characterData: true, subtree: true });
        }

        return {
            reflow: reflow,
            destroy: function () {
                _closeMenu();
                if (iRafOvf) { cancelAnimationFrame(iRafOvf); iRafOvf = 0; }
                if (oMO) { oMO.disconnect(); oMO = null; }
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
            // 호버 요소가 열린 모달 <dialog> 안이면 툴팁도 그 다이얼로그에 부착해야 모달 위(top-layer)에 뜬다.
            //   (body 자식이면 showModal 모달의 top-layer 뒤로 가려 그림자에 묻힘 — z-index 로는 top-layer 못 이김.)
            //   드래그/리사이즈가 transform 이 아닌 position:fixed+left/top 라 부모를 바꿔도 fixed 좌표계는 그대로.
            const oTipHost = (el.closest && el.closest("dialog[open]")) || document.body;
            if (t.parentNode !== oTipHost) { oTipHost.appendChild(t); }
            t.textContent = sText;
            // ★ 측정 전 중립 위치(0,0)로 리셋 — 이전 표시 위치(예: 뷰포트 우측 끝)에 둔 채로 재면
            //   브라우저가 오른쪽 경계에 맞춰 텍스트를 미리 개행해 offsetWidth 가 좁게 잡히고
            //   (white-space:normal + overflow-wrap:anywhere 라 "More"→"Mo/re" 처럼 짧은 단어도 쪼개짐),
            //   그 좁은 폭으로 위치를 재계산해 개행이 고정된다. 0,0(전폭 가용)에서 자연 폭으로 측정.
            t.style.left = "0px";
            t.style.top = "0px";
            t.dataset.show = "true";              // 먼저 보이게 해야 offset 측정 가능
            const tw = t.offsetWidth, th = t.offsetHeight;
            // 위치 = 항상 마우스 커서 바로 아래(네이티브 title 툴팁과 동일 감각 — 트리 행/버튼/아이콘 공통).
            //   과거엔 버튼/아이콘만 "요소 바로 아래" 정렬이라, 모달 푸터 버튼 툴팁이 커서가 아닌
            //   버튼 밑(모달 하단 경계 밖)에 떠 어색했다 → 커서 기준으로 통일.
            let left = _mx + 12;
            let top = _my + 18;
            let flipTop = _my - th - 8;
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
        function up() { on = false; document.body.classList.remove("u4a-dragging"); document.removeEventListener("mousemove", mv, true); document.removeEventListener("mouseup", up, true); }
        grip.addEventListener("mousedown", function (e) {
            if (e.button !== 0) { return; }
            on = true;
            document.body.classList.add("u4a-dragging");   // 리사이즈 동안 iframe 마우스 차단(끊김 방지 — 헤더 드래그와 동일)
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
     * 펼침 목록(.u4a-combo__list) 세로 배치/높이 클램프 — 콤보·제안목록 공통 1곳(§2.2).
     *   아래 공간 우선, 부족하면 위로 플립하되 타이틀바 하단은 침범하지 않는다.
     *   ★상한은 CSS 가 아니라 여기서 실측한 가용 공간이다. shell.css 의 .u4a-combo__list 에
     *     max-height 를 다시 넣으면 아래 h 가 그 값으로 고정돼 `h > lMax` 가 거짓이 되고
     *     이 클램프가 통째로 죽는다(가용 494px 인데 256px 만 쓰던 버그).
     * @param {HTMLElement} oList     펼침 목록
     * @param {DOMRect}     rAnchor   앵커(콤보/입력칸) 사각형
     * @param {number}      iTopBelow 아래로 펼칠 때의 top(앵커 하단 +2, 제안목록은 메시지 아래)
     */
    function _clampListV(oList, rAnchor, iTopBelow) {
        const topMin = (_topChromeBottom() || 0) + 2;
        // 재측정 전 초기화 — 제안목록은 타이핑마다 재배치되므로 이전 클램프가 남으면 계속 좁아진다.
        oList.style.maxHeight = "";
        const h = oList.offsetHeight;
        const below = window.innerHeight - 4 - iTopBelow;
        const above = (rAnchor.top - 2) - topMin;
        let lTop, lMax;
        if (h <= below || below >= above) { lTop = iTopBelow; lMax = below; }          // 아래로
        else { lMax = above; lTop = Math.max(topMin, rAnchor.top - 2 - Math.min(h, lMax)); }   // 위로 플립
        oList.style.top = lTop + "px";
        if (h > lMax) { oList.style.maxHeight = Math.max(80, lMax) + "px"; oList.style.overflowY = "auto"; }
    }

    /**
     * 다이얼로그 헤더 드래그 — ★전역 자동★. document 에 위임 리스너 1개만 설치하면
     * 모든 `.u4a-dialog` 가 헤더(`.u4a-dialog__header` 또는 `[data-u4a-draghandle]`)를 잡고
     * 드래그된다 + 화면 밖/상단 공통 헤더 영역으로 못 나가게 클램프. → 팝업마다 배선 불필요
     * (현재·미래 전부 자동). makeDialogRecenter/Resizable 과 달리 "한 번 설치 = 전체 적용".
     *   · 좌/우/하: 뷰포트 안. · 상: 공통 헤더(타이틀바+메뉴바+툴바) 하단 아래로만.
     *   · 헤더 내 버튼/입력(.u4a-btn-icon/button/input…) 에서 시작한 드래그는 무시.
     */
    /**
     * 다이얼로그 "닫으면 DOM 제거" — ★전역 자동★. document 에 capture 단계 `close` 리스너 1개만
     * 설치하면, 모든 `dialog.u4a-dialog` 가 close 될 때 DOM 에서 제거된다 → 각 팝업은 다음 열기 때
     * 새로 build 되어 기본 상태로 시작(닫기 시 잔여 입력/스크롤/선택 상태가 남지 않음). 팝업마다 배선 불필요.
     *   · close 이벤트는 버블하지 않으나 capture 단계에서 target 으로 전파되므로 위임 1개로 전부 잡힌다.
     *   · opt-out: `[data-u4a-keep]` 가 있으면 제거하지 않는다(상태 보존 싱글톤 — 예: App F4 검색 팝업).
     *   · busy(`#u4aWsBusyIndicator`=.u4aWsBusyIndicator)·confirm(자체 remove)은 `.u4a-dialog` 비대상/무관.
     */
    let _DLG_CLOSE_ON = false;
    function _installGlobalDialogClose() {
        if (_DLG_CLOSE_ON || typeof document === "undefined") { return; }
        _DLG_CLOSE_ON = true;
        document.addEventListener("close", function (e) {
            const oDlg = e.target;
            if (!oDlg || oDlg.nodeName !== "DIALOG" || !oDlg.classList) { return; }
            if (!oDlg.classList.contains("u4a-dialog")) { return; }
            if (oDlg.hasAttribute("data-u4a-keep")) { return; }   // 상태 보존 싱글톤 — 제외
            try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e2) { }
        }, true);
    }

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
            document.body.classList.remove("u4a-dragging");   // 드래그 종료 → iframe 포인터 복구
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
            document.body.classList.add("u4a-dragging");   // 드래그 동안 iframe 마우스 차단(끊김 방지)
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
            document.body.classList.add("u4a-dragging");   // 드래그 동안 iframe 마우스 차단(끊김 방지)
            _sides(oBar).forEach(function (oPane) {
                if (oPane.dataset.u4aSplitHome == null) {
                    oPane.dataset.u4aSplitHome = oPane.style.flex || "";
                }
            });
        }, true);
        // 스플릿바 드래그 종료 → iframe 포인터 복구(어디서 떼든). 화면별 드래그 핸들러와 무관하게 항상 해제.
        document.addEventListener("mouseup", function () { document.body.classList.remove("u4a-dragging"); }, true);
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

    /* ======================================================================
     * [공통] 스플리터 배선 — 드래그 리사이즈 + 창 리사이즈 재클램프 (doc 16 §4.3/§4.4).
     *   대상 컨테이너의 직계 자식 중 `.u4a-splitter__bar` = 바, 그 외 엘리먼트 = 패널.
     *   패널 유연/고정 판정: `.u4a-splitter__pane--flex` 클래스 또는 (인라인 px 미지정 &
     *   계산된 flex-grow>0) = 유연(잔여 흡수), 그 외 = 고정. 최소폭/높이는 CSS
     *   min-width/min-height 단일 출처. 드래그 결과는 대상 패널에 `flex:0 0 <px>` 로 확정.
     *   더블클릭 최초복귀·드래그 home 기록·iframe 포인터 차단은 전역 _installGlobalSplitterReset 담당.
     *
     *   @param {HTMLElement} oSplit  스플리터 컨테이너
     *   @param {object} [opts]
     *     opts.axis  "x"(기본,가로 폭)|"y"(세로 높이)
     *     opts.mode  "adjacent"(기본, 인접 2패널 주고받기)|"giveway"(3분할: 가운데 흡수 후 반대편 양보)
     *     opts.onResize  드래그/재클램프 후 콜백(예: 테이블 폭 클래스 갱신)
     *   @return {{reclamp:function, panes:function}}
     * ==================================================================== */
    var _SPLIT_REGISTRY = [];
    var _SPLIT_RESIZE_ON = false;

    function _splitAxis(sAxis) {
        return (sAxis === "y")
            ? { pos: "clientY", rect: "height", off: "offsetHeight", min: "minHeight", client: "clientHeight", cur: "row-resize", fb: 80 }
            : { pos: "clientX", rect: "width", off: "offsetWidth", min: "minWidth", client: "clientWidth", cur: "col-resize", fb: 120 };
    }
    function _splitIsBar(el) { return el.classList && el.classList.contains("u4a-splitter__bar"); }
    function _splitBars(oSplit) {
        return Array.prototype.filter.call(oSplit.children, _splitIsBar);
    }
    function _splitPanes(oSplit) {
        return Array.prototype.filter.call(oSplit.children, function (el) {
            return el.nodeType === 1 && !_splitIsBar(el);
        });
    }
    function _splitBarsSize(oSplit, AX) {
        var w = 0;
        _splitBars(oSplit).forEach(function (b) { w += b[AX.off] || 11; });
        return w;
    }
    function _splitPaneMin(el, AX) {
        var v = parseFloat(getComputedStyle(el)[AX.min]);
        return (v && v > 0) ? v : AX.fb;
    }
    // 유연(잔여 흡수) 패널 판정 — 명시 클래스 또는 (px 미고정 & flex-grow>0).
    function _splitIsFlex(el) {
        if (el.classList && el.classList.contains("u4a-splitter__pane--flex")) { return true; }
        if (/\d(?:\.\d+)?px/.test(el.style.flex || "")) { return false; }   // 드래그로 px 고정됨
        return (parseFloat(getComputedStyle(el).flexGrow) > 0);
    }
    function _splitPrevPane(oBar) {
        var el = oBar.previousElementSibling;
        while (el && _splitIsBar(el)) { el = el.previousElementSibling; }
        return el;
    }
    function _splitNextPane(oBar) {
        var el = oBar.nextElementSibling;
        while (el && _splitIsBar(el)) { el = el.nextElementSibling; }
        return el;
    }
    // oA·oB 를 뺀 나머지 패널의 현재 크기 합(단일 패널 조절 시 상한 계산용).
    function _splitOtherSize(oSplit, AX, oA, oB) {
        var s = 0;
        _splitPanes(oSplit).forEach(function (p) {
            if (p !== oA && p !== oB) { s += p.getBoundingClientRect()[AX.rect]; }
        });
        return s;
    }
    function _splitPxFlex(el, px) { el.style.flex = "0 0 " + Math.round(px) + "px"; }

    function _splitBindBar(oSplit, oBar, AX, sMode, fnAfter) {
        if (oBar.__u4aSplitWired) { return; }
        oBar.__u4aSplitWired = true;

        var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0, iBStart = 0;
        var oSelf = null, oCenter = null, oOpp = null, sSide = "left";  // giveway 전용
        // ★ 성능 — 드래그 중 "불변값"은 mousedown 에서 1회만 실측해 캐시한다(D).
        //   과거엔 mousemove 마다 clientWidth·바크기·패널 min(getComputedStyle)·나머지패널 rect 를 읽고
        //   곧바로 style.flex 를 써서 [읽기→쓰기→읽기…] 레이아웃 스래싱이 났다. 이 팝업처럼 DOM 이 큰
        //   화면(트리 수백 행+그리드층+sticky)에선 매 mousemove 마다 전체 동기 재계산 = 버벅임.
        //   컨테이너 폭·바 크기·패널 min·건드리지 않는 패널 크기는 드래그 내내 안 변하므로 캐시가 안전하다.
        //   (giveway 의 opp 크기만 우리가 바꾸므로 JS 로 추적 — 역시 읽기 불필요.) 장군님 지적 2026-07-14.
        var D = null;
        // mousemove 는 프레임보다 자주 온다(고폴링 마우스) → rAF 로 프레임당 1회만 적용(코얼레싱).
        var iRaf = 0, iLastPos = 0;

        function _applyMove() {
            if (!bDrag || !D) { return; }
            var d = iLastPos - iStart;

            if (sMode === "giveway" && oSelf && oCenter && oOpp) {
                var iSelf = (sSide === "left") ? (iAStart + d) : (iAStart - d);
                var iSelfMax = D.avail - D.cMin - D.oMin;
                if (iSelf > iSelfMax) { iSelf = iSelfMax; }
                if (iSelf < D.sMin) { iSelf = D.sMin; }
                var iOpp = D.oppCur;   // 실측 대신 추적값(우리가 쓴 값) — 렌더 결과와 동일
                if (D.avail - iSelf - iOpp < D.cMin) {
                    iOpp = D.avail - iSelf - D.cMin;
                    if (iOpp < D.oMin) { iOpp = D.oMin; }
                }
                D.oppCur = iOpp;
                _splitPxFlex(oSelf, iSelf);
                _splitPxFlex(oOpp, iOpp);
            } else if (!D.flexA && D.flexB) {          // A 고정 조절, B(유연) 흡수
                var maxA = D.avail - D.bMin - D.other;
                var a = iAStart + d;
                if (a > maxA) { a = maxA; }
                if (a < D.aMin) { a = D.aMin; }
                _splitPxFlex(oA, a);
            } else if (D.flexA && !D.flexB) {          // B 고정 조절, A(유연) 흡수
                var maxB = D.avail - D.aMin - D.other;
                var b = iBStart - d;
                if (b > maxB) { b = maxB; }
                if (b < D.bMin) { b = D.bMin; }
                _splitPxFlex(oB, b);
            } else {                                   // 둘 다 고정 → 인접쌍(합 보존)
                var na = iAStart + d, nb = iBStart - d;
                if (na < D.aMin) { nb -= (D.aMin - na); na = D.aMin; }
                if (nb < D.bMin) { na -= (D.bMin - nb); nb = D.bMin; }
                if (na < D.aMin) { na = D.aMin; }
                _splitPxFlex(oA, na);
                _splitPxFlex(oB, nb);
            }
            if (fnAfter) { try { fnAfter(); } catch (e) { } }
        }
        function lf_move(ev) {
            if (!bDrag) { return; }
            iLastPos = ev[AX.pos];
            if (iRaf) { return; }
            iRaf = requestAnimationFrame(function () { iRaf = 0; _applyMove(); });
        }
        function lf_up() {
            if (!bDrag) { return; }
            bDrag = false;
            if (iRaf) { cancelAnimationFrame(iRaf); iRaf = 0; }
            D = null;
            try { document.body.style.cursor = ""; } catch (e) { }
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", function (ev) {
            oA = _splitPrevPane(oBar); oB = _splitNextPane(oBar);
            if (!oA || !oB) { return; }
            bDrag = true;
            iStart = ev[AX.pos];
            iLastPos = iStart;
            iAStart = oA.getBoundingClientRect()[AX.rect];
            iBStart = oB.getBoundingClientRect()[AX.rect];
            if (sMode === "giveway") {
                // self=인접 고정 패널, center=유연 패널, opp=반대 고정 패널(3분할 give-way).
                if (!_splitIsFlex(oA)) { oSelf = oA; sSide = "left"; }
                else { oSelf = oB; sSide = "right"; }
                iAStart = oSelf.getBoundingClientRect()[AX.rect];
                oCenter = null; oOpp = null;
                _splitPanes(oSplit).forEach(function (p) {
                    if (p === oSelf) { return; }
                    if (_splitIsFlex(p)) { if (!oCenter) { oCenter = p; } }
                    else if (!oOpp) { oOpp = p; }
                });
            }
            // ★ 드래그 불변값 1회 실측 → 이후 mousemove 는 읽기 0(순수 계산+쓰기).
            D = {
                avail: oSplit[AX.client] - _splitBarsSize(oSplit, AX),
                aMin: _splitPaneMin(oA, AX),
                bMin: _splitPaneMin(oB, AX),
                flexA: _splitIsFlex(oA),
                flexB: _splitIsFlex(oB),
                other: _splitOtherSize(oSplit, AX, oA, oB),
                cMin: oCenter ? _splitPaneMin(oCenter, AX) : 0,
                sMin: oSelf ? _splitPaneMin(oSelf, AX) : 0,
                oMin: oOpp ? _splitPaneMin(oOpp, AX) : 0,
                oppCur: oOpp ? oOpp.getBoundingClientRect()[AX.rect] : 0
            };
            try { document.body.style.cursor = AX.cur; } catch (e) { }
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            ev.preventDefault();
        });
    }

    // 창 리사이즈 재클램프(축별) — 드래그로 px 고정된 패널 합 + 바 + 유연패널 최소가 컨테이너를
    //   넘으면 큰 고정패널부터 min 까지 축소해 overflow:hidden 에 잘려 숨는 것 방지.
    function _splitReclampOne(rec) {
        var oSplit = rec.el, AX = rec.AX;
        if (!oSplit || (oSplit.isConnected === false)) { return; }
        var iAvail = oSplit.getBoundingClientRect()[AX.rect];
        if (!iAvail) { return; }
        var iBars = _splitBarsSize(oSplit, AX);
        function _px(p) { var m = (p.style.flex || "").match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : null; }
        var aFixed = [], iFlexMin = 0;
        _splitPanes(oSplit).forEach(function (p) {
            if (getComputedStyle(p).display === "none") { return; }   // 숨김 패널 제외(커스터마이징)
            if (_px(p) != null) { aFixed.push(p); } else { iFlexMin += _splitPaneMin(p, AX); }
        });
        if (!aFixed.length) { return; }
        var iFixedW = 0; aFixed.forEach(function (p) { iFixedW += _px(p); });
        var iNeed = (iFixedW + iBars + iFlexMin) - iAvail;
        if (iNeed <= 0) { return; }
        aFixed.slice().sort(function (a, b) { return _px(b) - _px(a); }).forEach(function (p) {
            if (iNeed <= 0) { return; }
            var iCur = _px(p), iMin = _splitPaneMin(p, AX);
            var iCut = Math.min(Math.max(0, iCur - iMin), iNeed);
            if (iCut > 0) { p.style.flex = "0 0 " + (iCur - iCut) + "px"; iNeed -= iCut; }
        });
        if (rec.onResize) { try { rec.onResize(); } catch (e) { } }
    }
    function _splitReclampAll() { _SPLIT_REGISTRY.forEach(_splitReclampOne); }

    function wireSplitter(oSplit, opts) {
        if (!oSplit) { return { reclamp: function () { }, panes: function () { return []; } }; }
        opts = opts || {};
        var AX = _splitAxis(opts.axis);
        var sMode = (opts.mode === "giveway") ? "giveway" : "adjacent";
        _splitBars(oSplit).forEach(function (oBar) { _splitBindBar(oSplit, oBar, AX, sMode, opts.onResize); });

        var rec = null;
        for (var i = 0; i < _SPLIT_REGISTRY.length; i++) {
            if (_SPLIT_REGISTRY[i].el === oSplit) { rec = _SPLIT_REGISTRY[i]; break; }
        }
        if (rec) { rec.AX = AX; rec.mode = sMode; rec.onResize = opts.onResize || rec.onResize; }
        else { rec = { el: oSplit, AX: AX, mode: sMode, onResize: opts.onResize || null }; _SPLIT_REGISTRY.push(rec); }

        if (!_SPLIT_RESIZE_ON) {
            _SPLIT_RESIZE_ON = true;
            window.addEventListener("resize", _splitReclampAll);
        }
        return {
            reclamp: function () { _splitReclampOne(rec); },
            panes: function () { return _splitPanes(oSplit); }
        };
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
        // 격자(표형) 옵션 — 켜면 shell.css .u4a-tree--grid 가 [가로 행선 + 빈영역 채움] 공통 격자를 그린다.
        //   세로 컬럼선은 화면이 CSS 변수(--u4a-tree-grid-vcolor / --u4a-tree-grid-vx)로 위치·색만 지정(옵션).
        //   (16 §3.4.1 — 화면별로 격자 CSS 를 복제하지 말고 이 공통 격자를 소비한다.)
        if (cfg.grid) { oUl.classList.add("u4a-tree--grid"); }
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

            // 아이콘 — oCtx(펼침/레벨/선택 등) 전달: 폴더 열림/닫힘 아이콘 등 상태별 아이콘 지원.
            if (_icon) {
                const sIcon = _icon(node, oCtx);
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
        // 가상 스크롤 컨테이너 = 명시 지정(cfg.scrollContainer) 우선, 미지정 시 기존대로 ul 부모(하위호환).
        //   makeColumnTree 처럼 [스크롤 host > 헤더(sticky) + 본문(grow) > 트리 ul] 구조에선 ul 부모(본문)가
        //   스크롤하지 않으므로 host 를 넘겨야 윈도잉(scrollTop/clientHeight)이 맞는다. (기존 가상 소비처는 미전달=무영향)
        function _vsHost() { return (cfg.scrollContainer && cfg.scrollContainer.nodeType === 1) ? cfg.scrollContainer : oUl.parentNode; }
        function _vsRowH() {
            const w = _vsHost();
            const h = w ? parseFloat(getComputedStyle(w).getPropertyValue("--u4a-vsrowh")) : 0;
            return h > 0 ? h : 28;
        }
        function _renderVirtual(bKeepScroll) {
            const oWrap = _vsHost();   // 스크롤 컨테이너(cfg.scrollContainer 우선, 없으면 ul 부모) — 미부착이면 부착 후 재호출됨
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
        function selectByKey(sKey, bReveal) {
            // bReveal(기본 true): 가상 모드에서 off-screen 행을 scrollToKey 로 reveal(스크롤). bReveal=false 면
            //   현재 DOM 의 행만 강조(스크롤 점프 없음 — 사용자가 직접 클릭한 행은 이미 보이므로). 비가상은 원래대로 스크롤 안 함.
            if (bReveal === undefined) { bReveal = true; }
            const oRow = (bVirtual && bReveal) ? scrollToKey(sKey) : findRow(sKey);
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
            const oWrap = _vsHost();   // ★ 스크롤 컨테이너 = cfg.scrollContainer 우선(makeColumnTree=host). oUl.parentNode 고정 시 컬럼트리(body=비스크롤)서 reveal 무동작.
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

        // valueHelpOnly(값도움 전용, .analy/15 §3.8): 직접 타이핑은 막되(readOnly — IME 회피, 이벤트 가로채기 금지)
        //   '활성(편집 가능)' 외관 유지(.u4a-input--vho, shell.css) + 입력칸 아무 곳 클릭 = F4 오픈(트레일링 F4 버튼
        //   프로그램 클릭 → 기존 opts.f4 핸들러 재사용). 값은 F4 로만 설정. (WS20 selectOption3·숏컷 저장/아이콘경로 공용)
        if (opts.valueHelpOnly) {
            oInput.readOnly = true;
            oInput.classList.add("u4a-input--vho");
            const oVhBtn = oWrap.querySelector(".u4a-field__vh");
            if (oVhBtn) {
                oInput.addEventListener("click", () => { if (!oVhBtn.disabled) { oVhBtn.click(); } });
            }
        }

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

        // 경계(맨 위/아래)에서 네이티브 오버스크롤·스무스휠이 우리 수동 스크롤과 경합 → 끝단 "부르르" 떨림.
        //   overscroll-behavior:contain 으로 경계 바운스/스크롤 체이닝을 끈다(Chromium 63+).
        //   overflow-anchor:none — 윈도잉이 뷰포트 위 행을 갈아끼울 때 브라우저 스크롤 앵커링이 위치를
        //   보정하려다 튀는 것 방지(가상스크롤은 우리가 scrollTop·스페이서로 위치를 직접 관리하므로 앵커링 불필요).
        try { oWrap.style.overscrollBehavior = "contain"; oWrap.style.overflowAnchor = "none"; } catch (e) { }

        // ★ 휠 직접 처리 — 가상 스크롤 컨테이너의 네이티브 휠→스크롤이 안 먹는 환경(모달 top-layer 등) 대비.
        //   ★ 끝단 떨림 방지: 우리가 직접 클램프하고, 스크롤 여지가 있으면 '항상' preventDefault 해서
        //     네이티브 스무스휠/오버스크롤 애니메이션이 끼어들지 못하게 휠을 완전히 점유한다.
        //     (예전엔 scrollTop 이 안 변할 때 prevent 를 건너뛰어 경계에서 네이티브가 다시 살아났다.)
        oWrap.addEventListener("wheel", function (e) {
            if (e.ctrlKey) { return; }   // Ctrl+휠=줌 양보
            const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? (oWrap.clientHeight || 1) : 1);
            const maxTop = oWrap.scrollHeight - oWrap.clientHeight;
            const maxLeft = oWrap.scrollWidth - oWrap.clientWidth;
            const bV = maxTop > 1 && e.deltaY;
            const bH = maxLeft > 1 && e.deltaX;
            if (!bV && !bH) { return; }   // 스크롤 여지 없음 → 바깥 스크롤러로 양보(체이닝 허용)
            if (bV) { oWrap.scrollTop = Math.max(0, Math.min(maxTop, oWrap.scrollTop + e.deltaY * unit)); }
            if (bH) { oWrap.scrollLeft = Math.max(0, Math.min(maxLeft, oWrap.scrollLeft + e.deltaX * unit)); }
            e.preventDefault();   // 휠을 우리가 완전히 점유 → 경계에서 네이티브 경합 제거
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

    /**
     * 공통 확인/메시지 다이얼로그 (sap.m.MessageBox 대응) — 공통 .u4a-dialog 소비.
     *   ★ 순수 UI 컴포넌트: 텍스트(제목/메시지/버튼라벨)는 호출부가 현지화해 넘긴다(메시지클래스 비결합).
     *     셸(ws_html5_shell.js fnConfirmBox)·별도창(MIME 등)이 동일 구현을 공유(SSOT).
     * @param {Object} opts
     *   - type    : "S"|"E"|"W"|"I"|"C" (헤더 아이콘/색)
     *   - title   : 헤더 제목(호출부 현지화)
     *   - message : 본문 메시지
     *   - buttons : [{act, label, emphasized, negative}] (미지정 시 Yes/No)
     *   - onClose : function(sAct) — 선택한 버튼 act("YES"/"NO"/"CANCEL"/커스텀)
     * @returns {HTMLDialogElement|undefined}
     */
    function confirm(opts) {
        opts = opts || {};
        const sType = opts.type || "I";
        const sTitle = opts.title || "";
        const sMsg = (opts.message == null) ? "" : String(opts.message);
        let aBtns = (opts.buttons && opts.buttons.length) ? opts.buttons
            : [{ act: "YES", label: opts.yesLabel || "Yes", emphasized: true }, { act: "NO", label: opts.noLabel || "No" }];
        const fnCb = opts.onClose;
        const bHasCancel = aBtns.some(function (b) { return b.act === "CANCEL"; });
        const oIcon = { S: "circle-check", E: "circle-xmark", W: "triangle-exclamation", I: "circle-info", C: "circle-question" }[sType] || "circle-info";

        function _done(sAct) { if (typeof fnCb === "function") { try { fnCb(sAct); } catch (e) { } } }

        // 네이티브 <dialog> 미지원 시 — 브라우저 confirm 폴백(동작 보장).
        let oDlg;
        try { oDlg = document.createElement("dialog"); } catch (e) { oDlg = null; }
        if (!oDlg || typeof oDlg.showModal !== "function") {
            let bOk = false;
            try { bOk = window.confirm(sMsg); } catch (e2) { bOk = true; }
            _done(bOk ? "YES" : (bHasCancel ? "CANCEL" : "NO"));
            return;
        }

        oDlg.className = "u4a-dialog";
        oDlg.style.width = "min(28rem, 92vw)";
        oDlg.innerHTML =
            '<div class="u4a-dialog__header" data-type="' + sType + '">' +
                '<i class="fa-solid fa-' + oIcon + '"></i><span></span>' +
            '</div>' +
            '<div class="u4a-dialog__body" style="white-space:pre-wrap;line-height:1.45;"></div>' +
            '<div class="u4a-dialog__footer"></div>';
        oDlg.querySelector(".u4a-dialog__header span").textContent = sTitle;
        oDlg.querySelector(".u4a-dialog__body").textContent = sMsg;

        function _close(sAct) {
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
            _done(sAct);
        }

        // 공통 UX: 확인=체크 / 취소·닫기=X 아이콘만 표시(전 팝업 동일, 라벨은 title/aria 로 보존).
        //   ★2버튼 이하일 때만 자동 아이콘 — 3버튼(예: 저장/저장안함/취소)은 NO·CANCEL 이 둘 다 X 라 모호 → 텍스트 유지.
        //   버튼별 b.icon(FA 이름) 을 주면 개수와 무관하게 그 아이콘 사용. 매핑 없는 커스텀 act 는 텍스트 폴백.
        const ICONMAP = { YES: "check", OK: "check", SAVE: "check", NO: "xmark", CANCEL: "xmark", CLOSE: "xmark" };
        const bIconize = aBtns.length <= 2;
        const oFooter = oDlg.querySelector(".u4a-dialog__footer");
        aBtns.forEach(function (b) {
            const oBtn = document.createElement("button");
            oBtn.type = "button";
            oBtn.className = "u4a-btn" + (b.emphasized ? " u4a-btn--emphasized" : "") + (b.negative ? " u4a-btn--negative" : "");
            const sLabel = b.label || b.act;
            const sIcon = b.icon || (bIconize ? ICONMAP[b.act] : null);
            if (sIcon) {
                oBtn.innerHTML = '<i class="fa-solid fa-' + sIcon + '"></i>';
                oBtn.title = sLabel;
                oBtn.setAttribute("aria-label", sLabel);
            } else {
                oBtn.textContent = sLabel;
            }
            oBtn.addEventListener("click", function () { _close(b.act); });
            oFooter.appendChild(oBtn);
        });
        // ESC → CANCEL(있으면) 아니면 NO
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(bHasCancel ? "CANCEL" : "NO"); });

        try { document.body.appendChild(oDlg); oDlg.showModal(); }
        catch (e) { _close(window.confirm(sMsg) ? "YES" : (bHasCancel ? "CANCEL" : "NO")); }

        return oDlg;
    }

    /**
     * 공통 — frameless 별도창(BrowserWindow) 안전 닫기 (SSOT).
     *   ★ 별도창은 `closable:false` 로 열어 OS 닫기(Alt+F4 / 시스템메뉴 Close)를 차단한다.
     *     따라서 정상 닫기는 반드시 이 함수로: setClosable(true) 직후 close().
     *   ★ busy 토글로 `win.closable = true` 를 주면 안 된다(idle 일 때 Alt+F4 가 먹는 버그) —
     *     busy 중 닫기 차단은 "닫기 호출부의 busy 가드 + onbeforeunload" 로 한다(closable 은 항상 false 유지).
     *   근거: 16.공통UX 별도창 체크리스트(browser-window-common-ux).
     * @param {Electron.BrowserWindow} oWin - 현재 창(REMOTE.getCurrentWindow()).
     */
    function closeWindow(oWin) {
        try {
            if (oWin && !oWin.isDestroyed()) {
                oWin.setClosable(true);
                oWin.close();
            }
        } catch (e) { /* 이미 파괴된 창 무시 */ }
    }

    /**
     * 공통 — 컬럼 리사이즈 그립(가이드 라인 + 놓을 때 적용, UI5 sap.ui.table 방식) SSOT.
     *   드래그 중엔 마우스를 따라 "세로 가이드 라인"만 이동하고, mouseup 때 한 번만 폭을 적용한다
     *   (실시간 컬럼 갱신은 매 프레임 리플로우로 무겁고 잔상). 근거: 16 §3.4.2.
     *   ★ 컬럼 리사이즈 바가 있는 모든 트리테이블(makeColumnTree / callBindPopup 등)은 이걸 소비한다.
     * @param {HTMLElement} oGrip 그립 엘리먼트(컬럼 우측 경계에 얹힌 핸들).
     * @param {Object} cfg
     *   - host {HTMLElement} 가이드 세로 범위 기준(스크롤 컨테이너).
     *   - getWidth {function():number} 현재 컬럼 폭(px) 반환.
     *   - setWidth {function(number)} 새 컬럼 폭(px) 적용(놓을 때 1회 호출).
     *   - min {number=} 최소 폭 px(기본 64).
     *   - getAutoWidth {function():number=} 더블클릭 auto-fit(엑셀/sap.ui.table autoResize) — 그 컬럼 내용 중
     *       최장 폭(px)을 반환하면 그 폭으로 맞춘다. 제공 시 더블클릭 = auto-fit(onReset 보다 우선).
     *   - onReset {function()=} getAutoWidth 미제공 시 더블클릭 동작(기본폭 복귀 등).
     *   - hoverEl {HTMLElement=} / hoverClass {string=} 그립 hover 시 경계 강조 토글(드래그 중엔 끔).
     */
    function attachColumnResize(oGrip, cfg) {
        if (!oGrip || !cfg || typeof cfg.getWidth !== "function" || typeof cfg.setWidth !== "function") { return; }
        var iMin = cfg.min || 64;
        var bDrag = false, bHover = false, iColLeft = 0, iGuideX = 0;

        function _guideEl() {
            var g = document.getElementById("u4aColResizeGuide");
            if (!g) {
                g = document.createElement("div");
                g.id = "u4aColResizeGuide";
                g.style.cssText = "position:fixed;width:2px;background:var(--accent);z-index:9999;pointer-events:none;display:none;";
            }
            // ★ 모달 <dialog>(showModal) 안이면 그 top-layer 안에 붙여야 보인다(body 에 붙이면 모달 뒤로 가려짐 — 16 §2.10).
            var oLayer = (oGrip.closest && oGrip.closest("dialog[open]")) || document.body;
            if (g.parentNode !== oLayer) { oLayer.appendChild(g); }
            return g;
        }
        // 가이드 세로 범위 = "보이는 테이블 영역"만. host 로 아무거나(테이블 전체/스크롤 컨테이너) 넘겨도
        //   그립의 실제 세로 스크롤 뷰포트 ∩ host ∩ 화면으로 클램프한다 → 화면 밖까지 뻗는 잔상 방지(호출부 실수 흡수).
        function _viewRect() {
            var n = oGrip.parentNode;
            while (n && n.nodeType === 1) {
                var st;
                try { st = getComputedStyle(n); } catch (e) { st = null; }
                if (st && /(auto|scroll|overlay)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) {
                    return n.getBoundingClientRect();
                }
                n = n.parentNode;
            }
            return { top: 0, bottom: (window.innerHeight || document.documentElement.clientHeight) };
        }
        function _showGuide(iX) {
            var rh = (cfg.host || oGrip).getBoundingClientRect();
            var rv = _viewRect();
            var vh = window.innerHeight || document.documentElement.clientHeight;
            var iTop = Math.max(rh.top, rv.top, 0);
            var iBot = Math.min(rh.bottom, rv.bottom, vh);
            if (iBot < iTop) { iBot = iTop; }
            var g = _guideEl();
            g.style.top = iTop + "px"; g.style.height = (iBot - iTop) + "px"; g.style.left = iX + "px"; g.style.display = "block";
        }
        function _moveGuide(iX) { var g = document.getElementById("u4aColResizeGuide"); if (g) { g.style.left = iX + "px"; } }
        function _hideGuide() { var g = document.getElementById("u4aColResizeGuide"); if (g) { g.style.display = "none"; } }
        function _hoverOn() { if (cfg.hoverEl && cfg.hoverClass) { cfg.hoverEl.classList.add(cfg.hoverClass); } }
        function _hoverOff() { if (cfg.hoverEl && cfg.hoverClass) { cfg.hoverEl.classList.remove(cfg.hoverClass); } }

        function lf_move(e) {
            if (!bDrag) { return; }
            iGuideX = Math.max(iColLeft + iMin, e.clientX);   // 컬럼 최소폭 clamp(가이드만 이동)
            _moveGuide(iGuideX);
        }
        function lf_up() {
            if (!bDrag) { return; }
            bDrag = false;
            try { document.body.classList.remove("u4a-dragging"); } catch (e) { }
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            _hideGuide();
            if (bHover) { _hoverOn(); }   // 드래그 끝 + 그립 위면 hover 강조 복귀
            try { cfg.setWidth(iGuideX - iColLeft); } catch (e) { }   // ★ 놓을 때 실제 폭 적용
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }

        oGrip.addEventListener("mouseenter", function () { bHover = true; if (!bDrag) { _hoverOn(); } });
        oGrip.addEventListener("mouseleave", function () { bHover = false; if (!bDrag) { _hoverOff(); } });
        oGrip.addEventListener("mousedown", function (e) {
            bDrag = true;
            var iW = cfg.getWidth();
            iColLeft = e.clientX - iW;   // 컬럼 좌측 경계(뷰포트 x) = 그립(우측 경계) − 현재 폭
            iGuideX = e.clientX;
            _hoverOff();   // 드래그 중엔 헤더 강조 끄고 가이드 라인만
            try { document.body.classList.add("u4a-dragging"); } catch (e2) { }   // iframe 위 드래그 끊김 방지(공통)
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            _showGuide(e.clientX);
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault(); e.stopPropagation();
        });
        if (typeof cfg.getAutoWidth === "function" || typeof cfg.onReset === "function") {
            oGrip.addEventListener("dblclick", function (e) {
                if (typeof cfg.getAutoWidth === "function") {
                    // ★ auto-fit(엑셀/sap.ui.table) — 콘텐츠 최장 폭으로. 최소폭 clamp.
                    try { var iW = cfg.getAutoWidth(); if (iW > 0) { cfg.setWidth(Math.max(iMin, iW)); } } catch (e2) { }
                } else {
                    try { cfg.onReset(); } catch (e2) { }
                }
                e.preventDefault(); e.stopPropagation();
            });
        }
    }

    /**
     * 공통 — 다열 그리드 트리테이블(고정폭 컬럼 3열 + 가로 스크롤 + 컬럼 리사이즈 가이드). 16 §3.4.1/§3.4.2 SSOT.
     *   ★ 컬럼 리사이즈 바가 있는 3열 트리테이블은 화면마다 새로 짜지 말고 전부 이걸 소비한다
     *     (소비처: 대형 바인딩 별창 modelField/design, 소형 callBindPopup — 2026-07-08 통일).
     *   구조: [sticky 컬럼헤더] + [본문(가로 행라인) > [세로 그리드라인 레이어] + [공통 createTree]].
     *   헤더/본문/트리를 동일 총폭(--u4act-total-w=컬럼폭 합)으로 묶어 가로 스크롤 어긋남 방지.
     *   CSS 단일출처 = shell.css `.u4aColTree*`. 색은 의미 토큰만.
     * @param {HTMLElement} oHost 스크롤 컨테이너(비워지고 .u4aColTree 로 채워짐).
     * @param {Object} oCfg columns:[{label,width?}×3], roots(), children(n), hasChildren(n)?, key(n),
     *   label(n), tip(n)?, selectable, icon(n)?, slotLead(n)?, cell(n)→{c2,c3}, rowHook(row,n)?, onSelect(n,row)?, emptyText?
     * @returns {Object} { host, tree, rerender(bSelectFirst), expandSelected(), collapseSelected(), getSelected(), selectKey(key,bScroll) }
     */
    function makeColumnTree(oHost, oCfg) {
        if (!oHost) { return null; }
        oCfg = oCfg || {};
        var aCols = oCfg.columns || [{ label: "" }, { label: "" }, { label: "" }];
        var nCol = aCols.length;                 // 가변 컬럼(2~3열). 기존 소비처는 3열 → 완전 동일 동작.
        var bVirtual = !!oCfg.virtual;           // 대용량 가상 트리테이블(USP/MIME). host 를 스크롤 컨테이너로 넘김.
        var bFill = !!oCfg.fillLast;             // 마지막 컬럼 채움(고정폭 아님) — USP 설명 등. 그 컬럼은 리사이즈 안 함(grow 흡수 §3.4.2).
        // autofit(더블클릭·161버튼 공용) 정책. 기본 = 현행(slack 0 / 최소 3rem=48px / 상한 800px) → 기존 소비처 무영향.
        //   대형 바인딩(원본 setUiTableAutoResizeColumn 1:1)만 {slackRem:0.5, minRem:4, max:Infinity} 주입해
        //   상단 161 버튼(fitTreeColumns)과 리사이즈바 더블클릭이 ★동일 폭★을 내도록 단일화. (장군님 지적 2026-07-14)
        var oFit = oCfg.autofit || {};
        var DEF_W = ["15rem", "8rem", "14rem"];  // 앞 3열 기본폭(고정 rem, % 금지 §3.4.2). 그 외 10rem.
        function _defW(i) { return (aCols[i] && aCols[i].width) || DEF_W[i] || "10rem"; }

        function _fill(oCell, vContent) {
            if (vContent == null) { return; }
            if (typeof vContent === "string") { oCell.textContent = vContent; }
            else { oCell.appendChild(vContent); }
        }

        oHost.classList.add("u4aColTree");
        if (bVirtual) { oHost.classList.add("u4aColTree--virtual"); }
        if (bFill) { oHost.classList.add("u4aColTree--fill"); }   // 마지막 컬럼 flex:1 채움(shell.css). host 폭=100%(가로스크롤 없음)
        oHost.innerHTML = "";
        for (var _ci = 0; _ci < nCol; _ci++) { oHost.style.setProperty("--u4act-c" + (_ci + 1) + "-w", _defW(_ci)); }

        // 헤더 — 컬럼 수만큼 셀(u4aColTreeC1..CnCol). 폭/보더는 기존 CSS(.u4aColTreeC1/2/3) 그대로 소비.
        var oHead = _el("div", "u4aColTreeHead");
        var aHeadCells = [];
        for (var _ci = 0; _ci < nCol; _ci++) {
            var _h = _el("span", "u4aColTreeCol u4aColTreeC" + (_ci + 1));
            _h.textContent = (aCols[_ci] && aCols[_ci].label) || "";
            oHead.appendChild(_h); aHeadCells.push(_h);
        }
        oHost.appendChild(oHead);

        // 본문 + 세로 그리드라인 레이어(컬럼 수만큼). ★host 가 스크롤·body 가 grow → 레이어가 전체높이 덮음(가상서도 안전, 실측 검증).
        var oBody = _el("div", "u4aColTreeBody");
        var oGrid = _el("div", "u4aColTreeGrid");
        oGrid.setAttribute("aria-hidden", "true");
        for (var _ci = 0; _ci < nCol; _ci++) { oGrid.appendChild(_el("span", "u4aColTreeGL u4aColTreeGL--c" + (_ci + 1))); }
        oBody.appendChild(oGrid);
        oHost.appendChild(oBody);

        function _colPx(iIdx) {
            var oCell = aHeadCells[iIdx];
            return (oCell && oCell.getBoundingClientRect().width) || 120;
        }
        function _overheadPx() {
            var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return rem * 0.375 * nCol + 1;   // padding-left(0.375rem) + gap×(nCol-1) + ul 좌측 1px = 0.375rem×nCol + 1
        }
        function _syncTotal() {
            var total = _overheadPx();
            for (var i = 0; i < nCol; i++) { total += _colPx(i); }
            oHost.style.setProperty("--u4act-total-w", total + "px");
        }
        function _applyColW(sVar, px) {
            oHost.style.setProperty(sVar, Math.max(64, px) + "px");   // 최소 4rem, 상한 없음
            _syncTotal();
        }
        function _resetCols() {
            for (var i = 0; i < nCol; i++) { oHost.style.setProperty("--u4act-c" + (i + 1) + "-w", _defW(i)); }
            _syncTotal();
        }
        // ── 더블클릭 auto-fit(엑셀/sap.ui.table autoResize) 폭 측정 (§3.4.2 · 마법사 _wzAutoW 패턴 차용) ──
        //   그 컬럼의 [헤더 + 보이는 행 셀] 콘텐츠 중 최장 잉크폭(오프스크린 span 실측) + 셀 패딩. 최소 48 / 상한 800(과확장 방지).
        //   ★가상: DOM 에 보이는 행만 측정(윈도잉) — 화면에 보이는 콘텐츠 기준 auto-fit.
        // ★ 글자폭 = canvas measureText(DOM 변형·reflow 없음). 구현: off-screen span 을 body 에
        //   append→getBoundingClientRect→remove 했는데, 그 DOM 변형이 셀마다 레이아웃을 무효화해
        //   auto-fit(전 행 순회) 시 셀마다 강제 리플로우 + 루프 내 다른 getBoundingClientRect 까지 오염 = 느림.
        //   canvas 는 순수 계산이라 리플로우 0. (letterSpacing 은 통상 0 이라 생략 — _bwpGlyphW 와 동일 정책.)
        var _mCtx = null;
        function _measTxt(sText, oRef) {
            if (!_mCtx) { try { _mCtx = document.createElement("canvas").getContext("2d"); } catch (e) { _mCtx = null; } }
            if (!_mCtx) { return (sText || "").length * 7; }   // canvas 미지원 폴백(대략폭).
            if (oRef) {
                var cs = getComputedStyle(oRef);
                _mCtx.font = (cs.fontStyle || "normal") + " " + (cs.fontWeight || "400") + " " + (cs.fontSize || "13px") + " " + (cs.fontFamily || "sans-serif");
            }
            return _mCtx.measureText(sText || "").width;
        }
        function _px(v) { return parseFloat(v) || 0; }
        // 셀 자연폭(px, 패딩 포함). iCol 0=이름셀(토글 들여쓰기+아이콘+라벨잉크), 그 외=텍스트 잉크(+아이콘류)+패딩.
        function _cellNatW(oCell, iCol) {
            if (!oCell) { return 0; }
            var cs = getComputedStyle(oCell);
            var iPad = _px(cs.paddingLeft) + _px(cs.paddingRight);
            if (iCol === 0) {
                var iGap = _px(cs.columnGap || cs.gap);
                var w = iPad, n = 0;
                for (var k = 0; k < oCell.children.length; k++) {
                    var ch = oCell.children[k]; n++;
                    if (ch.classList && ch.classList.contains("u4a-tree__label")) {
                        w += _measTxt((ch.textContent || "").trim(), ch);   // 라벨=잉크폭(자연폭)
                    } else {
                        var ccs = getComputedStyle(ch);
                        w += ch.getBoundingClientRect().width + _px(ccs.marginLeft) + _px(ccs.marginRight);   // 토글(들여쓰기 margin 포함)·아이콘=실측
                    }
                }
                if (n > 1) { w += iGap * (n - 1); }
                return w + 2;
            }
            var iTxt = _measTxt((oCell.textContent || "").trim(), oCell);
            var iEl = 0;   // 텍스트 없는 요소(상태 아이콘 등) 폭 가산
            for (var e = 0; e < oCell.children.length; e++) {
                var el = oCell.children[e];
                if (!(el.textContent || "").trim()) { iEl += el.getBoundingClientRect().width; }
            }
            return iTxt + iEl + iPad + 4;
        }
        function _autoW(iCol) {
            var oH = aHeadCells[iCol];
            var hcs = oH ? getComputedStyle(oH) : null;
            var iMax = oH ? (_measTxt((oH.textContent || "").trim(), oH) + (hcs ? _px(hcs.paddingLeft) + _px(hcs.paddingRight) : 0) + 4) : 0;
            var sSel = (iCol === 0) ? ".u4aColTreeNameCell" : (".u4aColTreeCell.u4aColTreeC" + (iCol + 1));
            var aRows = oTree.el.querySelectorAll(".u4aColTreeRow");
            for (var r = 0; r < aRows.length; r++) {
                // ★ 접힌(collapsed) 하위 노드는 DOM 에 남되 부모 ul.hidden=true 로만 토글된다(createTree 비가상 §토글).
                //   그래서 querySelectorAll 은 "화면에 안 보이는 행"까지 잡는다 → autofit 이 접힌 긴 자식 텍스트로
                //   컬럼을 과대하게 키움(사용자 눈엔 안 보이는데 컬럼만 넓어짐). getClientRects().length===0(렌더 안 됨)
                //   인 행은 제외해 "실제 보이는 데이터 최장폭"에만 맞춘다. (코덱스 진단, 장군님 지적 2026-07-15)
                if (!aRows[r].getClientRects().length) { continue; }
                iMax = Math.max(iMax, _cellNatW(aRows[r].querySelector(sSel), iCol));
            }
            // 정책(oFit) 적용 — slack(여유) 가산 후 [minRem, max] clamp. 기본 = slack 0 / 48px / 800px(현행).
            var _rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            var _slack = (oFit.slackRem != null ? oFit.slackRem : 0) * _rem;
            var _minW = Math.round((oFit.minRem != null ? oFit.minRem : 3) * _rem);
            var _maxW = (oFit.max != null ? oFit.max : 800);
            return Math.max(_minW, Math.min(Math.round(iMax + _slack), _maxW));
        }
        function _buildGrip(sVar, iColIdx, sHl, bRight) {
            var oGrip = _el("div", "u4aColTreeGrip" + (bRight ? " u4aColTreeGrip--right" : ""));
            oGrip.setAttribute("aria-hidden", "true");
            attachColumnResize(oGrip, {
                host: oHost,
                getWidth: function () { return _colPx(iColIdx); },
                setWidth: function (px) { _applyColW(sVar, px); },
                // ★ 더블클릭 = auto-fit(내용 최장폭). onReset(기본폭 복귀) 아님 — 장군 지적 2026-07-13.
                getAutoWidth: function () { return _autoW(iColIdx); },
                hoverEl: oHost,
                hoverClass: sHl
            });
            return oGrip;
        }
        // 컬럼 경계 리사이즈 그립: 헤더 i(1..nCol-1) 좌측경계 = 컬럼(i-1) 우측 → 컬럼(i-1) 리사이즈.
        //   (3열: C2에 C1그립, C3에 C2그립 — 기존과 동일)
        for (var _gi = 1; _gi < nCol; _gi++) {
            aHeadCells[_gi].appendChild(_buildGrip("--u4act-c" + _gi + "-w", _gi - 1, "u4aColTreeHl" + (_gi + 1)));
        }
        // 마지막 컬럼 우측 그립(고정폭 컬럼 = 넓히면 가로 스크롤). 채움 컬럼(bFill)이거나 lastColResize:false 면 생략.
        if (!bFill && oCfg.lastColResize !== false) {
            aHeadCells[nCol - 1].appendChild(_buildGrip("--u4act-c" + nCol + "-w", nCol - 1, "u4aColTreeHl" + nCol + "r", true));
        }

        var selNode = null;
        var oTree = createTree({
            virtual: bVirtual,
            scrollContainer: bVirtual ? oHost : null,   // 가상: host 가 스크롤 컨테이너(body 는 grow, 스크롤 안 함)
            roots: function () { return (typeof oCfg.roots === "function") ? (oCfg.roots() || []) : []; },
            children: function (n) { return (typeof oCfg.children === "function") ? (oCfg.children(n) || []) : []; },
            hasChildren: function (n) {
                if (typeof oCfg.hasChildren === "function") { return !!oCfg.hasChildren(n); }
                var c = (typeof oCfg.children === "function") ? oCfg.children(n) : null;
                return !!(c && c.length);
            },
            key: function (n) { return oCfg.key(n); },
            label: function (n) { return oCfg.label(n); },
            tip: function (n) { return (typeof oCfg.tip === "function") ? oCfg.tip(n) : oCfg.label(n); },
            icon: (typeof oCfg.icon === "function") ? oCfg.icon : undefined,
            // 펼침 상태 위임/영속화 pass-through(§3.4) — 외부 펼침맵·지연로딩(lazy expand) 화면(MIME 등)용.
            //   미지정 소비처는 undefined → createTree 기본(내부 펼침맵, initialExpanded level<1) 그대로 = 하위호환.
            isExpanded: (typeof oCfg.isExpanded === "function") ? oCfg.isExpanded : undefined,
            onToggle: (typeof oCfg.onToggle === "function") ? oCfg.onToggle : undefined,
            initialExpanded: (typeof oCfg.initialExpanded === "function") ? oCfg.initialExpanded : undefined,
            slotLead: (typeof oCfg.slotLead === "function") ? function (n, ctx) {
                var x = oCfg.slotLead(n, ctx);
                if (!x) { return null; }
                var w = _el("span", "u4aColTreeLead");
                w.appendChild(x);
                return w;
            } : undefined,
            selectable: oCfg.selectable !== false,
            slotTrailing: function (n) {
                var oWrap = _el("span", "u4aColTreeTrail");
                var oC = (typeof oCfg.cell === "function") ? (oCfg.cell(n) || {}) : {};
                // 컬럼 1..nCol-1 = 트레일링 셀(이름 컬럼 제외). cell()의 c2/c3/... → 컬럼 순서.
                for (var ti = 1; ti < nCol; ti++) {
                    var oCell = _el("span", "u4aColTreeCell u4aColTreeC" + (ti + 1));
                    _fill(oCell, oC["c" + (ti + 1)]);
                    oWrap.appendChild(oCell);
                }
                return oWrap;
            },
            rowHook: function (oRow, n) {
                oRow.classList.add("u4aColTreeRow");
                oRow.__bwpNode = n;
                var oNameCell = _el("div", "u4aColTreeNameCell");
                var oLead = oRow.querySelector(".u4aColTreeLead");
                var oTog = oRow.querySelector(".u4a-tree__toggle");
                var oIco = oRow.querySelector(".u4a-tree__icon");
                var oLbl = oRow.querySelector(".u4a-tree__label");
                // 순서 = 토글(들여쓰기) → 리드(체크박스) → 아이콘 → 라벨. 리드를 토글 뒤에 둬야
                //   체크박스가 트리 들여쓰기를 따라가 아이콘/이름 바로 앞에 붙는다(원본 UI5 TreeTable 셀 구조 = [indent][chk+icon+name]).
                //   (리드를 앞에 두면 체크박스가 좌측 고정되고 이름만 들여써져 사이가 벌어짐 — 장군님 지적 2026-07-14.)
                if (oTog) { oNameCell.appendChild(oTog); }
                if (oLead) { oNameCell.appendChild(oLead); }
                if (oIco) { oNameCell.appendChild(oIco); }
                if (oLbl) { oNameCell.appendChild(oLbl); }
                oRow.insertBefore(oNameCell, oRow.firstChild);
                if (typeof oCfg.rowHook === "function") { try { oCfg.rowHook(oRow, n); } catch (e) { } }
            },
            onSelect: function (n, oRow) {
                selNode = n;
                if (typeof oCfg.onSelect === "function") { try { oCfg.onSelect(n, oRow); } catch (e) { } }
            }
        });
        oTree.el.classList.add("u4aColTreeTree");
        oBody.appendChild(oTree.el);

        function _showEmpty(bShow) {
            var oExist = oBody.querySelector(".u4aColTreeEmpty");
            if (bShow) {
                oTree.el.style.display = "none";
                if (!oExist) {
                    oExist = _el("div", "u4a-empty u4aColTreeEmpty");
                    oExist.textContent = oCfg.emptyText || "";
                    oBody.appendChild(oExist);
                }
            } else {
                oTree.el.style.display = "";
                if (oExist) { oExist.remove(); }
            }
        }

        var oRet = {
            host: oHost,
            tree: oTree,
            // ★ per-컬럼 autofit 폭(px) — 리사이즈바 더블클릭과 동일 계산. 161버튼(fitTreeColumns)이 이걸 소비해
            //   두 경로가 완전히 같은 폭을 내도록 단일화(중복 측정 로직 제거).
            autoWidth: function (iCol) { try { return _autoW(iCol); } catch (e) { return 0; } },
            getSelected: function () { return selNode; },
            rerender: function (bSelectFirst) {
                var aRoots = (typeof oCfg.roots === "function") ? (oCfg.roots() || []) : [];
                if (!aRoots.length) { _showEmpty(true); selNode = null; _syncTotal(); return; }
                _showEmpty(false);
                oTree.render();
                _syncTotal();
                if (bSelectFirst !== false && aRoots[0]) {
                    try { oTree.selectByKey(oCfg.key(aRoots[0]), false); selNode = aRoots[0]; } catch (e) { }
                }
            },
            expandSelected: function () { if (selNode) { try { oTree.expandSubtree(selNode); } catch (e) { } } },
            collapseSelected: function () { if (selNode) { try { oTree.setExpanded(selNode, false); } catch (e) { } } },
            selectKey: function (sKey, bScroll) { try { oTree.selectByKey(sKey, bScroll === true); } catch (e) { } }
        };
        try { oHost.__u4aColTreeCtrl = oRet; } catch (e) { }   // fitTreeColumns(161) 등이 host→ctrl 역참조로 autoWidth 소비
        return oRet;
    }

    /**
     * 공통 평면 데이터 테이블 (sap.ui.table / sap.m.Table 대응) — 단일 페인 가상 스크롤 표.
     *   ★ 소비처(F4검색도움·OTR·동적리스트·WS20편집)가 각자 손으로 반복하던 [.u4a-table-wrap>table.u4a-table>
     *     thead(tr)+tbody + 컬럼→th + 행→td + zebra + 클릭선택/더블클릭확정 + makeVScroller 윈도잉 + no-data]
     *     를 한 함수로 수렴. 색/스킨/sticky/zebra/선택은 공통 shell.css .u4a-table 가 단일 담당(재발명 금지).
     *   ★ 2페인 고정컬럼(App-F4)은 별도 오케스트레이션이 필요한 특수 케이스라 대상 아님 — App-F4 는
     *     공통 makeVScroller·.u4a-table 를 그대로 소비(자체 유지). 정적 소형표는 .u4a-table 스킨만으로 충분.
     *   컬럼은 생성 시 또는 setColumns()로 나중에(서버 응답 후) 지정 — F4 처럼 동적 컬럼 지원.
     *
     * @param {HTMLElement} oHost  테이블을 채울 컨테이너(=.u4a-table-wrap 스크롤 컨테이너가 됨)
     * @param {Object} oCfg
     *   - columns : [{ key, label, width?, align?('center'|'right'..), cell?(row,idx)→string|Node, className?, cellClass? }]
     *   - virtual : 기본 true(makeVScroller 윈도잉). false 면 전 행 직접 렌더(소형표).
     *   - zebra   : 기본 true(홀수행 data-odd). shell.css .u4a-table 가 색 담당.
     *   - compact : true 면 .u4a-compact(밀도)
     *   - rowKey(row,idx) : 선택 키(기본 idx). 선택 강조 동기·getSel 에 사용.
     *   - onSelect(row,idx)   : 단일 클릭(행 선택 강조 + 콜백)
     *   - onActivate(row,idx) : 더블 클릭(확정 — 예: F4 pick+닫기)
     *   - rowHook(tr,row,idx)  : 행 커스텀(data-attr/클래스 등)
     *   - emptyText : 0건 표시(공통 .u4a-table__nodata)
     *   - rowH, tableClass
     * @returns {{el,table,thead,tbody, setColumns(cols), setRows(rows,keepScroll), setSel(key), getSel(), refresh(), renderHead()}}
     */
    function makeDataTable(oHost, oCfg) {
        if (!oHost) { return null; }
        oCfg = oCfg || {};
        var aCols = oCfg.columns || [];
        var bVirtual = oCfg.virtual !== false;
        var bZebra = oCfg.zebra !== false;

        // 골격 — 공통 .u4a-table(shell.css) + 스크롤 래퍼(호스트). 색/sticky/zebra/선택은 공통이 담당.
        oHost.classList.add("u4a-table-wrap");
        if (oCfg.compact) { oHost.classList.add("u4a-compact"); }
        oHost.innerHTML = "";
        var oTable = _el("table", "u4a-table");
        if (oCfg.tableClass) { oTable.classList.add(oCfg.tableClass); }
        var oThead = _el("thead");
        var oHeadTr = _el("tr");
        oThead.appendChild(oHeadTr);
        var oTbody = _el("tbody");
        oTable.appendChild(oThead);
        oTable.appendChild(oTbody);
        oHost.appendChild(oTable);

        function _rowKey(oRow, iIdx) {
            return (typeof oCfg.rowKey === "function") ? oCfg.rowKey(oRow, iIdx) : iIdx;
        }

        function _renderHead() {
            oHeadTr.innerHTML = "";
            for (var i = 0; i < aCols.length; i++) {
                var c = aCols[i];
                var th = _el("th", null, (c.label != null) ? c.label : "");
                if (c.label) { th.title = c.label; }
                if (c.align) { th.style.textAlign = c.align; }
                if (c.width) { th.style.width = c.width; }
                if (c.className) { th.classList.add(c.className); }
                oHeadTr.appendChild(th);
            }
        }

        // 행 1개 빌드(가상 스크롤러가 보이는 구간만 호출). idx=절대 인덱스(zebra·선택키).
        function _buildRow(oRow, iIdx) {
            var oTr = _el("tr");
            if (bZebra && (iIdx % 2 === 1)) { oTr.setAttribute("data-odd", "true"); }
            var sKey = _rowKey(oRow, iIdx);
            try { if (oRow && typeof oRow === "object") { oRow.__dtKey = sKey; } } catch (e) { }   // getSelKey 용 스태시(F4 __f4Idx 패턴)
            for (var i = 0; i < aCols.length; i++) {
                var c = aCols[i];
                var td = _el("td");
                if (typeof c.cell === "function") {
                    var v = null;
                    try { v = c.cell(oRow, iIdx); } catch (e) { console.error("[U4AUI][makeDataTable] cell 오류:", e); }
                    if (v == null) { /* 빈 셀 */ }
                    else if (typeof v === "string") { td.textContent = v; td.title = v; }
                    else { td.appendChild(v); }
                } else {
                    var raw = oRow ? oRow[c.key] : null;
                    td.textContent = (raw == null) ? "" : String(raw);
                    td.title = td.textContent;
                }
                if (c.align) { td.style.textAlign = c.align; }
                if (c.cellClass) { td.classList.add(c.cellClass); }
                oTr.appendChild(td);
            }
            oTr.addEventListener("click", function () {
                if (_vs) { _vs.setSel(sKey); _vs.refresh(); }
                else { _markSel(sKey); }
                if (typeof oCfg.onSelect === "function") { try { oCfg.onSelect(oRow, iIdx); } catch (e) { console.error("[U4AUI][makeDataTable] onSelect 오류:", e); } }
            });
            if (typeof oCfg.onActivate === "function") {
                oTr.addEventListener("dblclick", function () { try { oCfg.onActivate(oRow, iIdx); } catch (e) { console.error("[U4AUI][makeDataTable] onActivate 오류:", e); } });
            }
            if (typeof oCfg.rowHook === "function") { try { oCfg.rowHook(oTr, oRow, iIdx); } catch (e) { } }
            return oTr;
        }

        // ── 비가상(소형표) 경로 — 전 행 직접 렌더 + 선택 강조 ──
        var _aRows = [];
        var _selKey = null;
        function _markSel(sKey) {
            _selKey = sKey;
            var aTr = oTbody.querySelectorAll("tr[data-dt-row]");
            for (var i = 0; i < aTr.length; i++) {
                var bSel = String(aTr[i].getAttribute("data-dt-key")) === String(sKey);
                if (bSel) { aTr[i].setAttribute("aria-selected", "true"); } else { aTr[i].removeAttribute("aria-selected"); }
            }
        }
        function _renderAll() {
            oTbody.innerHTML = "";
            if (!_aRows.length) {
                if (oCfg.emptyText != null) {
                    var trN = _el("tr", "u4a-table__nodata");
                    var tdN = _el("td", null, oCfg.emptyText);
                    tdN.colSpan = aCols.length || 1;
                    trN.appendChild(tdN); oTbody.appendChild(trN);
                }
                return;
            }
            for (var i = 0; i < _aRows.length; i++) {
                var tr = _buildRow(_aRows[i], i);
                tr.setAttribute("data-dt-row", "");
                tr.setAttribute("data-dt-key", String(_rowKey(_aRows[i], i)));
                if (_selKey != null && String(_rowKey(_aRows[i], i)) === String(_selKey)) { tr.setAttribute("aria-selected", "true"); }
                oTbody.appendChild(tr);
            }
        }

        var _vs = null;
        function _makeVs() {
            if (!(bVirtual && window.U4AUI && U4AUI.makeVScroller)) { return; }
            _vs = makeVScroller(oHost, oTbody, {
                colCount: aCols.length || 1,
                buildRow: _buildRow,
                nodata: oCfg.emptyText,
                rowH: oCfg.rowH,
                getSelKey: function (oRow) { return oRow ? oRow.__dtKey : null; }
            });
        }

        function _applyColumns(aNewCols) {
            aCols = aNewCols || [];
            _renderHead();
            // ★ vs 는 컬럼이 실제로 생겼을 때 "딱 1회만" 생성. 빈 컬럼으로 미리 만들면(동적 컬럼 화면 F4/OTR/DynList)
            //   그 stale 인스턴스(aData=[])가 스크롤/휠 때마다 tbody 를 비워 높이 붕괴→스크롤 튕김(휠 안 먹힘).
            //   재호출 시엔 재생성 안 함(리스너 중복 방지) — 헤더만 갱신, buildRow 는 최신 aCols 사용.
            if (bVirtual && !_vs && aCols.length) { _makeVs(); }
        }

        // 초기 컬럼(주어졌을 때만 vs 생성 — 빈 컬럼이면 setColumns 시점까지 미룸).
        _renderHead();
        if (bVirtual && aCols.length) { _makeVs(); }

        return {
            el: oHost, table: oTable, thead: oThead, tbody: oTbody,
            setColumns: function (aNewCols) { _applyColumns(aNewCols); },
            renderHead: _renderHead,
            setRows: function (aRows, bKeepScroll) {
                if (bVirtual && _vs) { _vs.setRows(aRows || [], bKeepScroll); }
                else { _aRows = aRows || []; _renderAll(); }
            },
            setSel: function (sKey) {
                if (bVirtual && _vs) { _vs.setSel(sKey); _vs.refresh(); }
                else { _markSel(sKey); }
            },
            getSel: function () { return (bVirtual && _vs) ? _vs.getSel() : _selKey; },
            refresh: function () { if (bVirtual && _vs) { _vs.refresh(); } else { _renderAll(); } }
        };
    }

    const U4AUI = {
        el: _el,
        confirm: confirm,
        closeWindow: closeWindow,
        attachColumnResize: attachColumnResize,
        makeColumnTree: makeColumnTree,
        makeDataTable: makeDataTable,
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
        wireSplitter: wireSplitter,
        reclampSplitters: _splitReclampAll,
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

    // 다이얼로그 "닫으면 DOM 제거" 전역 1회 설치 — 모든 .u4a-dialog 가 close 시 자동 제거(배선 불필요).
    //   다음 열기 = 새 build(기본 상태). 상태 보존이 필요한 팝업만 [data-u4a-keep] 로 opt-out.
    try { _installGlobalDialogClose(); } catch (e) { }

    // 스플릿바 더블클릭 → 최초 위치 복귀 전역 1회 설치 — 모든 .u4a-splitter__bar 자동(배선 불필요).
    try { _installGlobalSplitterReset(); } catch (e) { }

    // iframe(미리보기) 클릭 시 열린 모든 오버레이(메뉴/드롭다운/팝오버) 닫기 전역 1회 설치 — 배선 불필요.
    try { _installIframeBlurClose(); } catch (e) { }

    // CommonJS(Electron nodeIntegration) 환경에서도 require 가능하게
    if (typeof module === "object" && module.exports) {
        module.exports = U4AUI;
    }

})(typeof window !== "undefined" ? window : this);
