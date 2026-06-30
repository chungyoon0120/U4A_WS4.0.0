/**************************************************************************
 * fnAppF4PopupOpen.js  (UI5 → HTML5 변환)
 * ------------------------------------------------------------------------
 * App Search Help (앱 검색 도움말) — WS10 앱이름 입력의 F4/돋보기 value-help.
 *   원본: sap.m.Dialog + IconTabBar + sap.ui.table.Table/TreeTable.
 *   HTML5: 공통 <dialog class="u4a-dialog"> + 공통 컴포넌트(.u4a-field, U4AUI.createSelect,
 *          makeDialogDraggable/Resizable/Recenter) + 토큰 기반 테이블/트리.
 *
 *   탭1 "[U4A] 모든 앱": 검색폼(패키지/사용자/웹앱ID/앱설명/앱유형/최대조회수) + 검색버튼
 *                        + 결과 테이블(사용자/앱실행/앱조회/웹앱ID/앱명/앱유형[+생성·변경정보]).
 *   탭2 "[U4A] 패키지별 앱 계층 구조": 트리 테이블 + Expand/Collapse all + 검색(클라이언트 필터).
 *
 *   백엔드(원본 동일): POST {serverPath}/getappsearch (APPINFO=JSON)        → 앱 배열
 *                      POST {serverPath}/getapplhierarchydata (no body)    → {RETCD,RTMSG,T_APPL[]}
 *   행 액션: pick(더블클릭=콜백+닫기) / 앱실행(fnCheckAppExists→fnOnExecApp) / 앱조회(WS10 Display).
 *   ※ 이 팝업엔 eval(SCRIPT) 없음. 데이터 콜만 존재.
 **************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    /* ── 작은 유틸 ─────────────────────────────────────────────────── */
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (txt != null) { o.textContent = txt; }
        return o;
    }

    // 코드형 라벨(/U4A/CL_WS_COMMON 등). p1 = &1 치환 파라미터(선택).
    function _txt(sCls, sCode, p1) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1); } catch (e) { return sCode; }
    }
    // ZMSG_WS_COMMON_001 "번호" — 워크스페이스 언어(getUserInfo().LANGU) 기준.
    function _wsTxt(sNo) {
        try {
            var sLangu = (parent.getUserInfo() || {}).LANGU;
            return parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sNo);
        } catch (e) { return sNo; }
    }

    function _msg(sType, sText) { try { parent.showMessage(null, 10, sType, sText); } catch (e) { } }
    function _flash() {
        try { (parent.CURRWIN || parent.REMOTE.getCurrentWindow()).flashFrame(true); } catch (e) { }
    }
    function _busy(bOn) { try { APPCOMMON.fnSetBusyLock(bOn ? "X" : ""); } catch (e) { } }

    function _isRoot(o) { return !!(o && (o.APPID === "ROOT" || o.PACKG === "ROOT")); }
    // 진짜 최상위 컨테이너(U4A IDE)만 — 필터 시 항상 표시 대상. (PACKG==="ROOT" 인 최상위 패키지들은
    //  제외 → 패키지도 이름 매칭/매칭 자식이 있어야만 보임. display 용 _isRoot 와 구분.)
    function _isTopRoot(o) { return !!(o && o.APPID === "ROOT"); }

    /* ── 고정 컬럼(가로 스크롤 시 좌측 N개 sticky 고정) — 탭1/트리 공통 헬퍼 ──────────
     *  CSS(.is-frz/.is-frz-last) 는 .u4aAppF4Tbl 스코프로 두 테이블 공유. 고정 개수·left 오프셋만
     *  테이블별로 준다. lefts = 선행 고정컬럼 폭 누적(rem). 액션컬럼 기본폭 4.5rem(=.is-action). */
    function _frzLefts(cols, frzn) {
        var lefts = [], acc = 0;
        for (var i = 0; i < frzn; i++) {
            lefts.push(acc + "rem");
            var c = cols[i] || {};
            acc += c.w ? parseFloat(c.w) : (c.action ? 4.5 : 8);
        }
        return lefts;
    }
    function _applyFrz(cell, idx, frzn, lefts) {
        if (idx < frzn) {
            cell.classList.add("is-frz");
            cell.style.left = lefts[idx];
            if (idx === frzn - 1) { cell.classList.add("is-frz-last"); }
        }
    }
    function _fmtDate(s) {
        if (!s || s === "00000000") { return ""; }
        s = String(s); if (s.length !== 8) { return s; }
        return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
    }
    function _fmtTime(s) {
        if (!s || s === "000000") { return ""; }
        s = String(s); if (s.length !== 6) { return s; }
        return s.slice(0, 2) + ":" + s.slice(2, 4) + ":" + s.slice(4, 6);
    }

    // 생성/변경 부가 컬럼 표시 여부(원본: checkWLOList("C","UHAK901182"))
    function _showAudit() {
        try { return !!APPCOMMON.checkWLOList("C", "UHAK901182"); } catch (e) { return false; }
    }

    /* ── 공통 입력 필드 — 공통 팩토리(U4AUI.createField) 위임(생성/clear/대문자/Enter 단일화) ── */
    function _mkField(sVal, opt) {
        opt = opt || {};
        var fld = window.U4AUI.createField({
            type: opt.type || "text",
            value: sVal,
            placeholder: opt.ph,
            disabled: opt.disabled,
            clear: true,
            upper: opt.upper,
            onEnter: opt.onEnter ? function () { opt.onEnter(); } : null,
            className: "u4aAppF4Field",
            width: opt.w
        });
        // 기존 호출부 계약 유지({ wrap, input }).
        return { wrap: fld.el, input: fld.input };
    }

    /* ── 가상 스크롤(windowing) — 보이는 행만 DOM 에 렌더 ───────────────
     *  스크롤 기준: scrollTop+행높이+뷰포트로 보일 구간[start,end] 계산 → 그 구간만 <tr> 생성.
     *  안 보이는 위/아래 영역 높이는 **스페이서 <tr> 의 <td><div height></div></td>** 로 확보
     *  (빈 td 높이가 안 먹는 함정 회피 — div 는 빈 높이도 100% 확보). 전체 표 높이 = total*ROWH 로
     *  항상 일정 → 스크롤바 안정(재렌더해도 scrollTop 안 튐). 윈도잉 계산은 node 로 단위검증함.
     *  opt: { colCount, buildRow(item,absIdx)→<tr>, rowH?, overscan?, nodata?, getSelKey?(item) }
     *  반환: { setRows(arr, bKeepScroll), refresh(), setSel(key) }
     ************************************************************************/
    //   가상 스크롤은 전 화면 공통 U4AUI.makeVScroller 로 승격(2026-06-24) — 여기선 위임만(인자/반환 동일).
    function _makeVScroller(oWrap, oTbody, opt) {
        return (window.U4AUI && U4AUI.makeVScroller) ? U4AUI.makeVScroller(oWrap, oTbody, opt) : null;
    }

    /* ====================================================================
     * 메인 진입 — 팝업 생성/오픈
     * ================================================================== */
    oAPP.fn.fnAppF4PopupOpen = function (options, fnCallback) {

        _ensureStyle();

        options = options || {};
        var initCond = options.initCond || {};
        var bWS10 = initCond.EXPAGE === "WS10";       // 앱조회(display) 활성 조건
        var bAudit = _showAudit();

        // ── 싱글톤(원본 아키텍처) ───────────────────────────────────
        //   앱 조회(display) 시 다이얼로그를 파괴하지 않고 숨겨(close, DOM 유지) 검색 상태를 보존.
        //   다음 F4 호출에는 새로 만들지 말고 같은 인스턴스를 재표시 + 콜백/검색만 갱신.
        var oExisting = document.getElementById("u4aAppF4Dlg");
        if (oExisting && typeof oExisting._appf4Reopen === "function") {
            oExisting._appf4Reopen(options, fnCallback);
            return;
        }
        if (oExisting) { try { oExisting.remove(); } catch (e) { } }

        // 팝업 상태(스코프 변수로 보관).
        var _fnCb = fnCallback;     // pick 콜백(재오픈 시 갱신 가능하게 mutable)
        var aResult = [];           // 탭1 검색결과
        var aTreeRoot = [];         // 탭2 트리 루트
        var oExpand = {};           // 트리 펼침 상태(노드 _uid → bool)
        var bTreeLoaded = false;
        var sTreeFilter = "";
        var _uidSeq = 0;
        var _bAutoSearch = !!(options && options.autoSearch);   // 재오픈 시 갱신(원본 oOptions.autoSearch)
        var _sortKey = null, _sortDir = null;   // 탭1 컬럼 정렬(단일) — 원본 sap.ui.table sortProperty
        var _colFilters = {};                   // 탭1 컬럼 필터(AND·contains) — 원본 filterProperty
        var _treeSortKey = null, _treeSortDir = null;   // 탭2(트리) 컬럼 정렬 — 형제 노드끼리 정렬(계층 유지)
        var _treeColFilters = {};                       // 탭2(트리) 컬럼 필터(AND·contains, 경로 유지)

        // ★ 메시지 텍스트는 호출마다 SQLite 조회라 비싸다 → 행 렌더 루프 밖에서 1회만 캐시.
        var MSG_RUN = _wsTxt("436");   // 앱 실행
        var MSG_DISP = _wsTxt("564");  // 앱 조회
        var MSG_NOAPP = _wsTxt("435"); // 실행할 수 없는 어플리케이션
        var MSG_SORTASC = _wsTxt("810");                        // 오름차순 정렬
        var MSG_SORTDESC = _wsTxt("811");                       // 내림차순 정렬
        var MSG_FILTERVAL = _txt("/U4A/CL_WS_COMMON", "A68");   // 필터 값(placeholder)
        var MSG_CLEARFILTER = _txt("/U4A/CL_WS_COMMON", "A69"); // 필터 초기화
        var MSG_NODATA = _wsTxt("946");                         // 데이터 없음(공통 .u4a-table__nodata — ServerList L("noData")=946 동일)

        // ── 2-pane 테이블 골격(sap.ui.table 고정컬럼 재현) — CSS Grid [고정|스크롤 / 본문|하단가로바] ──────────
        //   고정/스크롤 페인 모두 공통 가상 스크롤(makeVScroller) 독립 인스턴스. 행높이는 양쪽 공통 --row-h 강제로
        //   동일 → scrollTop 양방향 동기로 행 정렬(보이는 행만 렌더). 가로 스크롤은 하단 별도 트랙(hsb)으로 분리
        //   → 행과 안 겹치고 '고정바 이후'에만(UI5 HSb 방식). hover 는 마우스 위치 기반 양쪽 동시 적용.
        function _build2Pane() {
            var grid = _el("div", "u4aAppF4Grid");
            var frzPane = _el("div", "u4aAppF4Pane u4aAppF4Pane--frozen u4a-table-wrap");   // u4a-table-wrap=공통 행높이(--u4a-vsrowh) 규칙 적용
            var scrPane = _el("div", "u4aAppF4Pane u4aAppF4Pane--scroll u4a-table-wrap");
            var frzTbl = _el("table", "u4a-table u4aAppF4Tbl u4aAppF4Tbl--frozen");
            var scrTbl = _el("table", "u4a-table u4aAppF4Tbl u4aAppF4Tbl--scroll");
            var frzHead = _el("thead"), frzBody = _el("tbody");
            var scrHead = _el("thead"), scrBody = _el("tbody");
            frzTbl.append(frzHead, frzBody); scrTbl.append(scrHead, scrBody);
            frzPane.appendChild(frzTbl); scrPane.appendChild(scrTbl);
            // ★ 가로 스크롤바는 테이블 하단 별도 트랙(UI5 sap.ui.table HSb)으로 분리 — 행과 안 겹친다.
            //   CSS Grid 로 hsb 를 스크롤 컬럼(col2) 아래(row2)에 둬 고정 컬럼(col1) 영역은 자동 제외(=고정바 이후).
            var hsb = _el("div", "u4aAppF4HSb");
            var hsbSpacer = _el("div", "u4aAppF4HSbSpacer");
            hsb.appendChild(hsbSpacer);
            grid.append(frzPane, scrPane, hsb);

            var _hoverIdx = null, _lastY = null, _syncing = false;

            // 세로 동기(양방향, guard) — 두 페인 독립 가상스크롤. 한쪽 스크롤 → 다른쪽 scrollTop 추종.
            function _syncTop(from, to) {
                if (_syncing) { return; }
                _syncing = true;
                if (to.scrollTop !== from.scrollTop) { to.scrollTop = from.scrollTop; }
                _syncing = false;
            }
            // 가로 동기 — 스크롤 페인 ↔ 하단 가로바(hsb). 고정 페인은 가로 스크롤 안 함(컬럼 고정).
            function _syncLeft(from, to) {
                if (_syncing) { return; }
                _syncing = true;
                if (to.scrollLeft !== from.scrollLeft) { to.scrollLeft = from.scrollLeft; }
                _syncing = false;
            }
            scrPane.addEventListener("scroll", function () { _syncTop(scrPane, frzPane); _syncLeft(scrPane, hsb); _reHover(); });
            frzPane.addEventListener("scroll", function () { _syncTop(frzPane, scrPane); _reHover(); });
            hsb.addEventListener("scroll", function () { _syncLeft(hsb, scrPane); });   // 하단바 드래그 → 스크롤 페인 가로

            // 하단 가로바 트랙 폭 = 스크롤 페인 콘텐츠(테이블) 실제 폭. setRows/리사이즈 시 갱신.
            function _sync() { hsbSpacer.style.width = (scrTbl.scrollWidth || scrPane.scrollWidth) + "px"; }
            try { new ResizeObserver(_sync).observe(scrPane); } catch (e) { }

            // ── 같은 행 hover 동기 — ★마우스 위치 기반★. 두 페인 행 DOM 이 비동기로 갈려, mouseover 만으론 스크롤 직후
            //   한쪽(마우스 있는 페인)만 떠서 어긋난다. → 마우스 y 아래 스크롤 페인 행 idx 를 elementFromPoint 로 구해
            //   두 페인에 동시 적용. 스크롤/렌더 후에도 같은 마우스 위치로 재계산(_reHover=렌더 완료 보장 2-rAF 뒤).
            function _hoverApply(idx, on) {
                [frzBody, scrBody].forEach(function (tb) {
                    var tr = tb.querySelector('tr[data-row-idx="' + idx + '"]');
                    if (tr) { tr.classList.toggle("is-hover", on); }
                });
            }
            function _clearHover() { if (_hoverIdx != null) { _hoverApply(_hoverIdx, false); _hoverIdx = null; } }
            function _hoverAtMouse() {
                if (_lastY == null) { _clearHover(); return; }
                var r = scrPane.getBoundingClientRect();
                if (_lastY < r.top || _lastY >= r.bottom) { _clearHover(); return; }   // 페인(본문) 밖
                var el = document.elementFromPoint(r.left + 8, _lastY);                 // 좌측 근처 x(세로바·셀경계 회피)
                var tr = el && el.closest ? el.closest("tr[data-row-idx]") : null;       // 헤더/스페이서면 null
                var idx = tr ? tr.getAttribute("data-row-idx") : null;
                if (idx === _hoverIdx) { return; }
                _clearHover();
                if (idx != null) { _hoverIdx = idx; _hoverApply(idx, true); }
            }
            // 스크롤/렌더 후 hover 재계산 — makeVScroller 가 rAF 로 행을 갈므로 렌더 완료(2-rAF) 뒤 적용.
            function _reHover() { requestAnimationFrame(function () { requestAnimationFrame(_hoverAtMouse); }); }
            grid.addEventListener("mousemove", function (e) { _lastY = e.clientY; _hoverAtMouse(); });
            grid.addEventListener("mouseleave", function () { _lastY = null; _clearHover(); });

            // ★ buildRow 안전망 — 행 생성 시 _hoverIdx 를 반영(선택 getSelKey 와 동일 방식). 어느 페인이 언제
            //   렌더되든 그 행이 자동으로 hover 를 가지므로, 두 페인 가상스크롤 렌더 타이밍 경합과 무관하게 양쪽 정합.
            function _isHovered(idx) { return _hoverIdx != null && String(idx) === _hoverIdx; }

            return { grid: grid, frzPane: frzPane, scrPane: scrPane, frzHead: frzHead, frzBody: frzBody, scrHead: scrHead, scrBody: scrBody, sync: _sync, isHovered: _isHovered };
        }

        /* ── 다이얼로그 골격 ─────────────────────────────────────── */
        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aAppF4Dlg";
        oDlg.id = "u4aAppF4Dlg";
        // ★ 공통 "닫으면 DOM 제거" 위임에서 제외(opt-out). 이 팝업은 닫기 경로를 직접 구분한다:
        //   · 앱 조회(_doDisplay) = lf_hide() 숨김(DOM 유지) → WS10 복귀/다음 F4 에 재표시(원본 setVisible 상태보존)
        //   · 명시적 닫기(X·푸터·ESC·선택완료) = lf_close() 숨긴 뒤 DOM 제거 → 다음 열기는 새 build(상태 폐기)
        //   공통 위임에 맡기면 _doDisplay 숨김의 close 이벤트에서도 제거돼 보존이 깨지므로 keep + 직접 제거.
        oDlg.setAttribute("data-u4a-keep", "");

        // 숨김(파괴 X) — 앱 조회 시 검색 상태 보존용(다음 호출/복귀에 재표시).
        function lf_hide() { try { _closeColMenu(); } catch (e) { } try { oDlg.close(); } catch (e) { } }
        // 명시적 닫기(X·푸터·ESC·선택완료) — 숨긴 뒤 DOM 제거(상태 폐기). 다음 열기 = 새 build.
        function lf_close() { lf_hide(); try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e) { } }

        // 헤더
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("magnifying-glass") + "<span></span>";
        oHeader.querySelector("span").textContent =
            _txt("/U4A/CL_WS_COMMON", "B96") + " " + _txt("/U4A/CL_WS_COMMON", "A26");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.setAttribute("data-act", "close");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39"); oX.innerHTML = _fa("xmark");
        oX.addEventListener("click", lf_close);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 탭바
        var oTabs = _el("div", "u4aAppF4Tabs");
        var oTab1Btn = _el("button", "u4aAppF4Tab", "[U4A] " + _txt("/U4A/CL_WS_COMMON", "B94")); // All App.
        var oTab2Btn = _el("button", "u4aAppF4Tab", "[U4A] " + _txt("/U4A/CL_WS_COMMON", "B98")); // Hierarchy By Packages
        oTab1Btn.type = "button"; oTab2Btn.type = "button";
        oTabs.append(oTab1Btn, oTab2Btn);
        oDlg.appendChild(oTabs);

        // 바디(탭 페이지 컨테이너)
        var oBody = _el("div", "u4a-dialog__body u4a-dialog__body--flush u4aAppF4Body");
        oDlg.appendChild(oBody);

        var oPage1 = _el("div", "u4aAppF4Page u4aAppF4Page1");
        var oPage2 = _el("div", "u4aAppF4Page u4aAppF4Page2");
        oPage2.hidden = true;
        oBody.append(oPage1, oPage2);

        // 푸터(닫기)
        var oFoot = _el("div", "u4a-dialog__footer");
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark");   // X 아이콘만 (텍스트 라벨 제거)
        oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCloseBtn.addEventListener("click", lf_close);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        /* ── 공통 액션 아이콘 버튼 ───────────────────────────────── */
        function _actBtn(sIcon, sTip, fn) {
            var b = _el("button", "u4a-btn-icon u4aAppF4ActBtn");
            b.type = "button"; b.title = sTip || ""; b.innerHTML = _fa(sIcon);
            b.addEventListener("click", fn);
            return b;
        }
        /* ── 탭 전환 ─────────────────────────────────────────────── */
        function _selectTab(sKey) {
            var b1 = sKey === "K1";
            oPage1.hidden = !b1; oPage2.hidden = b1;
            oTab1Btn.setAttribute("aria-selected", b1 ? "true" : "false");
            oTab2Btn.setAttribute("aria-selected", b1 ? "false" : "true");
            if (b1) {
                // 원본 K1: 트리 선택해제 + 패키지 입력 포커스.
                //   ★ K1 은 탭 전환으로 재검색하지 않는다(결과는 마지막 검색 스냅샷 유지 — 사용자 요청).
                //     autoSearch(처음 오픈) 자동검색은 오픈/재오픈 경로에서 1회만 한다(여기서 X).
                try { _vs2.setSel(null); _vs2f.setSel(null); _vs2.refresh(); _vs2f.refresh(); } catch (e) { }
                try { oPkg.input.focus(); } catch (e) { }
            } else {
                // ★ 원본 K2: 선택할 때마다 매번 서버에서 계층 재조회(once 가드 없음 — fnGetAppHierList).
                _loadTree();
            }
        }
        oTab1Btn.addEventListener("click", function () { _selectTab("K1"); });
        oTab2Btn.addEventListener("click", function () { _selectTab("K2"); });

        /* ============================================================
         * 탭 1 — 검색 폼 + 결과 테이블
         * ========================================================== */
        var oForm = _el("div", "u4aAppF4Form");

        function _row(sLabel, oControl) {
            var r = _el("div", "u4aAppF4FRow");
            var l = _el("label", "u4a-label", sLabel);
            r.append(l, oControl);
            return r;
        }

        var bTrial = false; try { bTrial = !!(parent.getIsTrial && parent.getIsTrial()); } catch (e) { }

        var oPkg = _mkField(initCond.PACKG || "", { upper: true, disabled: bTrial, onEnter: _doSearch });
        var oUsr = _mkField(initCond.ERUSR || "", { upper: true, disabled: bTrial, onEnter: _doSearch });
        var oApp = _mkField(initCond.APPID || "", { upper: true, onEnter: _doSearch });
        var oDesc = _mkField(initCond.APPNM || "", { onEnter: _doSearch });
        var oHits = _mkField(initCond.HITS != null ? initCond.HITS : 500, { onEnter: _doSearch });

        var aApptyItems = [
            { value: "M", text: "M ( " + _txt("/U4A/CL_WS_COMMON", "B96") + " )" }, // U4A Application
            { value: "U", text: "U ( " + _txt("/U4A/CL_WS_COMMON", "D48") + " )" }  // U4A Server Page
        ];
        var sApptyDef = initCond.APPTY || "M";
        var oApptySel = (window.U4AUI && U4AUI.createSelect)
            ? U4AUI.createSelect(aApptyItems, sApptyDef, function () { _doSearch(); })
            : (function () { var s = _el("div"); s.value = sApptyDef; return s; })();
        oApptySel.classList.add("u4aAppF4Sel");
        // 원본: WS10 페이지가 아니면(EXPAGE!="WS10") App Type 비활성화(enabled formatter).
        if (!bWS10) { oApptySel.setAttribute("aria-disabled", "true"); oApptySel.tabIndex = -1; }

        oForm.append(
            _row(_txt("/U4A/CL_WS_COMMON", "A22"), oPkg.wrap),   // Package
            _row(_txt("/U4A/CL_WS_COMMON", "B95"), oUsr.wrap),   // User Name
            _row(_txt("/U4A/CL_WS_COMMON", "A90"), oApp.wrap),   // Web App ID
            _row(_txt("/U4A/CL_WS_COMMON", "A91"), oDesc.wrap),  // App Desc
            _row(_txt("/U4A/CL_WS_COMMON", "B02"), oApptySel),   // App Type
            _row(_txt("/U4A/CL_WS_COMMON", "A76"), oHits.wrap)   // Max rows
        );

        // 조회 조건 = 공통 접이식 패널(원본 sap.m.Panel expandable) — 헤더에 제목 + 검색 버튼, 바디에 폼.
        var oSrchBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oSrchBtn.type = "button";
        oSrchBtn.innerHTML = _fa("magnifying-glass") + "<span></span>";
        oSrchBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A75"); // Search
        oSrchBtn.addEventListener("click", _doSearch);
        var oSrchPanel = (window.U4AUI && U4AUI.createPanel)
            ? U4AUI.createPanel({ title: "[U4A] " + _txt("/U4A/CL_WS_COMMON", "B94") })
            : null;
        if (oSrchPanel) {
            oSrchPanel.el.classList.add("u4aAppF4SrchPanel");
            oSrchPanel.actions.appendChild(oSrchBtn);
            oSrchPanel.body.appendChild(oForm);
        }

        var T1_COLS = [
            { key: "ERUSR", label: _txt("/U4A/CL_WS_COMMON", "B95"), w: "8rem", align: "center" },
            { action: "run", w: "8.5rem", align: "center" },   // Open in Browser — 헤더 들어갈 폭(고정 컬럼)
            { action: "disp", w: "6.5rem", align: "center" },  // App Views — 트리탭과 동일 폭
            { key: "APPID", label: _txt("/U4A/CL_WS_COMMON", "A90"), w: "14rem" },
            { key: "APPNM", label: _txt("/U4A/CL_WS_COMMON", "A91"), w: "20rem" },
            { key: "APPTY", label: _txt("/U4A/CL_WS_COMMON", "B97"), w: "6rem", align: "center" }
        ];
        if (bAudit) {
            T1_COLS.push(
                { key: "ERDAT", label: _wsTxt("387"), w: "8rem", align: "center", fmt: _fmtDate },
                { key: "ERTIM", label: _wsTxt("388"), w: "7rem", align: "center", fmt: _fmtTime },
                { key: "AEUSR", label: _wsTxt("411"), w: "8rem", align: "center" },
                { key: "AEDAT", label: _wsTxt("412"), w: "8rem", align: "center", fmt: _fmtDate },
                { key: "AETIM", label: _wsTxt("413"), w: "7rem", align: "center", fmt: _fmtTime }
            );
        }

        var T1_MAP = {};   // key → col (셀 텍스트/정렬·필터용)
        T1_COLS.forEach(function (c) { if (c.key) { T1_MAP[c.key] = c; } });

        // 좌측 3개 컬럼 고정(User Name / Open in Browser / App Views) — 2-pane 의 고정 페인.
        var T1_FRZN = 3;
        var T1_FRZ_COLS = T1_COLS.slice(0, T1_FRZN);   // 고정 페인 컬럼
        var T1_SCR_COLS = T1_COLS.slice(T1_FRZN);      // 스크롤 페인 컬럼

        var oT1G = _build2Pane();
        var oT1Wrap = oT1G.grid;        // oPage1 에 들어갈 컨테이너(그리드)
        var oT1FrzHead = oT1G.frzHead, oT1FrzBody = oT1G.frzBody;   // 고정 페인(일반 렌더)
        var oT1ScrHead = oT1G.scrHead, oT1ScrBody = oT1G.scrBody;   // 스크롤 페인(가상 스크롤)

        // 결과 테이블 위 툴바 — 정렬·컬럼필터 전체 해제(탭2와 동일 버튼). 검색 폼(서버 쿼리)은 건드리지 않음.
        var oT1Bar = _el("div", "u4aAppF4TreeBar u4aAppF4T1Bar");
        var oT1ClearBtn = _actBtn("filter-circle-xmark", MSG_CLEARFILTER, function () { _clearAllT1SF(); });
        oT1ClearBtn.disabled = true;   // 걸린 정렬/필터 없을 땐 비활성(첫 렌더에서 _syncT1ClearBtn 가 갱신)
        oT1ClearBtn.classList.add("u4aAppF4ClearBtn");   // 탭1·탭2 공통: 툴바 우측 끝 정렬(margin-left:auto)
        oT1Bar.appendChild(oT1ClearBtn);

        oPage1.append(oSrchPanel ? oSrchPanel.el : oForm, oT1Bar, oT1Wrap);

        // ── 컬럼 정렬/필터 (원본 sap.ui.table sortProperty/filterProperty → ServerList 패턴 포팅) ──
        function _cellText(sKey, row) {
            var c = T1_MAP[sKey]; var v = row[sKey];
            return (c && c.fmt) ? c.fmt(v) : (v == null ? "" : String(v));
        }
        function _deriveView(src) {
            var arr = src.slice();
            var aKeys = Object.keys(_colFilters).filter(function (k) { return _colFilters[k]; });
            if (aKeys.length) {
                arr = arr.filter(function (row) {
                    return aKeys.every(function (k) { return _cellText(k, row).toLowerCase().indexOf(_colFilters[k]) !== -1; });
                });
            }
            if (_sortKey) {
                var d = _sortDir === "desc" ? -1 : 1;
                arr.sort(function (a, b) {
                    return _cellText(_sortKey, a).localeCompare(_cellText(_sortKey, b), undefined, { numeric: true }) * d;
                });
            }
            return arr;
        }
        // 탭1 컬럼 메뉴 컨트롤러 — 공유 _openColMenu 가 소비(상태=_sortKey/_sortDir/_colFilters).
        var _t1ColCtl = {
            getFilter: function (k) { return _colFilters[k] || ""; },
            setFilter: function (k, v) { if (v) { _colFilters[k] = v; } else { delete _colFilters[k]; } },
            getSort: function () { return _sortKey ? { key: _sortKey, dir: _sortDir } : null; },
            setSort: function (k, d) { _sortKey = k; _sortDir = d; },
            rerender: function () { _renderT1(); }
        };
        function _buildT1Th(c) {
            var th = _el("th", c.align === "center" ? "is-center" : null);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            var inner = _el("div", "u4a-th__inner");
            if (c.align === "center") { inner.classList.add("u4a-th__inner--center"); }
            inner.appendChild(_el("span", "u4a-th__label", c.action ? (c.action === "run" ? MSG_RUN : MSG_DISP) : c.label));
            // 데이터 컬럼만 정렬/필터 메뉴(액션 컬럼 제외) — 원본도 데이터컬럼에만 sort/filterProperty.
            if (c.key && !c.action) {
                var bSorted = _sortKey === c.key, bFiltered = !!_colFilters[c.key];
                if (bSorted || bFiltered) {
                    var ind = _el("span", "u4a-th__ind");
                    if (bSorted) { ind.innerHTML += _fa(_sortDir === "desc" ? "arrow-down" : "arrow-up"); }
                    if (bFiltered) { ind.innerHTML += _fa("filter"); }
                    inner.appendChild(ind);
                }
                th.appendChild(inner);
                th.classList.add("u4a-th--menu");
                th.addEventListener("click", function (e) { e.stopPropagation(); _openColMenu(c, th, _t1ColCtl); });
            } else {
                th.appendChild(inner);
            }
            return th;
        }

        // 결과 행 1개 빌드(cols=고정/스크롤 페인별 컬럼 부분집합). i=절대 인덱스(zebra·hover/선택 동기 키).
        function _buildT1Row(row, i, cols) {
            var tr = _el("tr");
            if (i % 2 === 1) { tr.setAttribute("data-odd", "true"); }
            tr.setAttribute("data-row-idx", String(i));               // 고정/스크롤 페인 행 hover 동기 키
            tr.setAttribute("data-appid", row.APPID == null ? "" : String(row.APPID));   // 선택 동기 키
            if (oT1G.isHovered(i)) { tr.classList.add("is-hover"); }  // 렌더 시 hover 상태 반영(타이밍 경합 무관)
            tr.addEventListener("click", function () { _selectT1(row.APPID); });
            tr.addEventListener("dblclick", function () { _pick(row); });
            cols.forEach(function (c) {
                var td = _el("td", c.align === "center" ? "is-center" : null);
                if (c.action === "run") {
                    td.classList.add("is-action");
                    td.appendChild(_actBtn("globe", MSG_RUN, function (e) { e.stopPropagation(); _doRun(row); }));
                } else if (c.action === "disp") {
                    td.classList.add("is-action");
                    var b = _actBtn("desktop", MSG_DISP, function (e) {
                        e.stopPropagation();
                        _selectT1(row.APPID);   // 원본 _setUiTableSelectedRow — 복귀 시 강조 유지
                        _doDisplay(row);
                    });
                    if (!bWS10) { b.disabled = true; }
                    td.appendChild(b);
                } else {
                    var v = row[c.key];
                    td.textContent = c.fmt ? c.fmt(v) : (v == null ? "" : String(v));
                }
                tr.appendChild(td);
            });
            return tr;
        }
        // 정렬·필터 전체 해제(탭1) — 컬럼 정렬·컬럼필터 초기화(검색 폼=서버 쿼리는 유지).
        function _syncT1ClearBtn() {
            var bFilt = Object.keys(_colFilters).some(function (k) { return _colFilters[k]; });
            oT1ClearBtn.disabled = !(_sortKey || bFilt);
        }
        function _clearAllT1SF() {
            if (!_sortKey && !Object.keys(_colFilters).some(function (k) { return _colFilters[k]; })) { return; }
            _sortKey = null; _sortDir = null;
            _colFilters = {};
            _renderT1();
        }
        // 헤더(정렬/필터 표시자 갱신 위해 매 렌더 재구성) — 고정/스크롤 페인 각각.
        function _renderT1Head() {
            oT1FrzHead.textContent = "";
            var fr = _el("tr");
            T1_FRZ_COLS.forEach(function (c) { fr.appendChild(_buildT1Th(c)); });
            oT1FrzHead.appendChild(fr);
            oT1ScrHead.textContent = "";
            var sr = _el("tr");
            T1_SCR_COLS.forEach(function (c) { sr.appendChild(_buildT1Th(c)); });
            oT1ScrHead.appendChild(sr);
        }
        // 선택 강조 동기 — 두 페인 각 makeVScroller getSelKey 가 보이는 행에 aria-selected 자동 부여.
        function _selectT1(appid) { _vs1f.setSel(appid); _vs1f.refresh(); _vs1.setSel(appid); _vs1.refresh(); }
        function _renderT1() {
            _renderT1Head();
            _syncT1ClearBtn();
            // 바디 = 필터→정렬 파생 뷰: 고정 페인·스크롤 페인 모두 가상 스크롤(보이는 행만)
            var view = _deriveView(aResult);
            _vs1f.setRows(view);
            _vs1.setRows(view);
            oT1G.sync();   // 가로바 하단 보정
        }
        // 고정 페인(좌측 컬럼) 가상 스크롤 인스턴스.
        var _vs1f = _makeVScroller(oT1G.frzPane, oT1FrzBody, {
            colCount: T1_FRZ_COLS.length,
            buildRow: function (row, i) { return _buildT1Row(row, i, T1_FRZ_COLS); },
            getSelKey: function (row) { return row.APPID; }
        });
        // 스크롤 페인(나머지 컬럼) 가상 스크롤 인스턴스 — no-data 문구는 이쪽(넓은 영역)에만.
        var _vs1 = _makeVScroller(oT1G.scrPane, oT1ScrBody, {
            colCount: T1_SCR_COLS.length,
            buildRow: function (row, i) { return _buildT1Row(row, i, T1_SCR_COLS); },
            nodata: MSG_NODATA, getSelKey: function (row) { return row.APPID; }
        });

        // ── 컬럼 헤더 메뉴(정렬 asc/desc + 필터 input + 초기화) — 공통 U4AUI.openColumnMenu 소비 ──
        //   (구: 로컬 _openColMenu 1벌 → 전 화면 공통 헬퍼로 통합. ctl 인자 동일, .u4a-colmenu CSS=shell.css.)
        //   ctl = 탭별 컨트롤러(getFilter/setFilter/getSort/setSort/rerender) — 탭1·탭2(트리) 공유.
        function _closeColMenu() { try { if (window.U4AUI && U4AUI.closeColumnMenu) { U4AUI.closeColumnMenu(); } } catch (e) { } }
        function _openColMenu(c, th, ctl) {
            if (window.U4AUI && U4AUI.openColumnMenu) {
                U4AUI.openColumnMenu(c, th, ctl, {
                    container: oDlg,   // top-layer 다이얼로그 안에 붙여 모달 위로
                    labels: { filter: MSG_FILTERVAL, asc: MSG_SORTASC, desc: MSG_SORTDESC, clear: MSG_CLEARFILTER }
                });
            }
        }

        function _doSearch() {
            _busy(true);
            var oCond = {
                PACKG: oPkg.input.value, ERUSR: oUsr.input.value, APPID: oApp.input.value,
                APPNM: oDesc.input.value, APPTY: oApptySel.value,
                HITS: oHits.input.value, EXPAGE: initCond.EXPAGE || ""
            };
            try { oAPP.attr.gAPPTY = oApptySel.value; } catch (e) { }
            var sPath = parent.getServerPath() + "/getappsearch";
            var fd = new FormData();
            fd.append("APPINFO", JSON.stringify(oCond));
            try {
                sendAjax(sPath, fd, function (oRes) {
                    if (oRes && !Array.isArray(oRes) && oRes.RETCD === "E") { _flash(); _msg("E", oRes.RTMSG || ""); _busy(false); return; }
                    var arr = Array.isArray(oRes) ? oRes : [];
                    arr.sort(function (a, b) { return String(a.APPID).localeCompare(String(b.APPID)); });
                    aResult = arr;
                    _renderT1();
                    _busy(false);
                });
            } catch (e) { _busy(false); _msg("E", String(e && e.message || e)); }
        }

        /* ============================================================
         * 탭 2 — 패키지 계층 트리
         * ========================================================== */
        var T2_COLS = [
            { tree: true, key: "APPNM", label: _txt("/U4A/CL_WS_COMMON", "B99"), w: "26rem" },
            { action: "disp", w: "6.5rem", align: "center" },  // App Views — 고정 컬럼(탭1과 동일 폭)
            { key: "APPID", label: _txt("/U4A/CL_WS_COMMON", "C01"), w: "12rem", link: true },
            { key: "APPVR", label: _txt("/U4A/CL_WS_COMMON", "C02"), w: "6rem", align: "center", nz: true },
            { key: "CODPG", label: _txt("/U4A/CL_WS_COMMON", "C03"), w: "6rem", align: "center", nz: true },
            { key: "UITHM", label: _txt("/U4A/CL_WS_COMMON", "C04"), w: "8rem", nz: true },
            { key: "ERUSR", label: _txt("/U4A/CL_WS_COMMON", "C05"), w: "8rem", nz: true },
            { key: "ERDAT", label: _wsTxt("387"), w: "7rem", align: "center", nz: true, fmt: _fmtDate },
            { key: "ERTIM", label: _wsTxt("388"), w: "6rem", align: "center", nz: true, fmt: _fmtTime },
            { key: "AEUSR", label: _wsTxt("411"), w: "8rem", nz: true },
            { key: "AEDAT", label: _wsTxt("412"), w: "7rem", align: "center", nz: true, fmt: _fmtDate },
            { key: "AETIM", label: _wsTxt("413"), w: "6rem", align: "center", nz: true, fmt: _fmtTime }
        ];

        var T2_MAP = {};   // key → col (트리 셀 텍스트/정렬·필터용)
        T2_COLS.forEach(function (c) { if (c.key) { T2_MAP[c.key] = c; } });

        // 좌측 2개 컬럼 고정(트리 / App Views) — 2-pane 의 고정 페인.
        var T2_FRZN = 2;
        var T2_FRZ_COLS = T2_COLS.slice(0, T2_FRZN);   // 고정 페인(트리 컬럼 + 앱 조회)
        var T2_SCR_COLS = T2_COLS.slice(T2_FRZN);      // 스크롤 페인(나머지)

        var oTBar = _el("div", "u4aAppF4TreeBar");
        // 공통(USP fnUspTreeExpand/CollapseSelected = 원본 getSelectedIndex 기준): Expand=선택 노드의
        //   "서브트리 전체" 펼침(루트 선택이면 트리 전체=구 expandToLevel99), Collapse=선택 노드만 접음(단일).
        //   선택 없으면 no-op. 툴팁=메시지키 C27/C28(USP 와 동일, 하드코딩 금지).
        var oExpandBtn = _actBtn("angles-down", _txt("/U4A/CL_WS_COMMON", "C27"), function () {
            var node = _selTreeNode();
            if (node) { _expandSubtree(node); _renderTree(); }
        });
        var oCollapseBtn = _actBtn("angles-up", _txt("/U4A/CL_WS_COMMON", "C28"), function () {
            var node = _selTreeNode();
            if (node) { oExpand[node._uid] = false; _renderTree(); }
        });
        var oTSrch = _mkField("", { w: "16rem", ph: _wsTxt("565") }); // 어플리케이션 검색
        var _filtT = null;
        oTSrch.input.addEventListener("input", function () {
            if (_filtT) { clearTimeout(_filtT); }
            // 디바운스(타이핑 중 매 글자 재렌더 방지). 가상 스크롤이라 렌더는 보이는 행만 → 즉시.
            _filtT = setTimeout(function () {
                sTreeFilter = oTSrch.input.value.trim().toUpperCase();
                // 검색 시 매칭 경로만 자동 펼쳐 매치를 드러낸다(강제펼침 X → 이후 수동 접기 가능).
                if (sTreeFilter) { _expandMatchPaths(); }
                _renderTree();
            }, 200);
        });
        // 정렬·필터 전체 해제 — 컬럼 정렬·컬럼필터·검색박스를 한 번에 초기화(걸린 게 없으면 비활성).
        //   per-column 초기화(A69)와 같은 의미라 툴팁도 MSG_CLEARFILTER 재사용.
        var oClearAllBtn = _actBtn("filter-circle-xmark", MSG_CLEARFILTER, function () { _clearAllTreeSF(); });
        oClearAllBtn.disabled = true;   // 걸린 정렬/필터/검색 없을 땐 비활성(첫 렌더에서 _syncClearAllBtn 가 갱신)
        oClearAllBtn.classList.add("u4aAppF4ClearBtn");   // 탭1·탭2 공통: 툴바 우측 끝 정렬(margin-left:auto)
        oTBar.append(oExpandBtn, oCollapseBtn, _el("span", "u4aAppF4TBarSep"), oTSrch.wrap, oClearAllBtn);

        var oT2G = _build2Pane();
        var oT2Wrap = oT2G.grid;        // oPage2 에 들어갈 컨테이너(그리드)
        // 트리 컬럼이 고정 페인에 들어가므로 트리 식별 클래스를 고정 테이블에 부여(셰브론 회전 CSS 스코프).
        oT2G.frzPane.querySelector("table").classList.add("u4aAppF4Tree");
        var oT2FrzHead = oT2G.frzHead, oT2FrzBody = oT2G.frzBody;   // 고정 페인(일반 렌더)
        var oT2ScrHead = oT2G.scrHead, oT2ScrBody = oT2G.scrBody;   // 스크롤 페인(가상 스크롤)
        oPage2.append(oTBar, oT2Wrap);

        function _matchFilter(node) {   // 검색박스(상단) — APPID/APPNM contains
            if (!sTreeFilter || _isTopRoot(node)) { return true; }
            return String(node.APPID || "").toUpperCase().indexOf(sTreeFilter) > -1
                || String(node.APPNM || "").toUpperCase().indexOf(sTreeFilter) > -1;
        }

        // ── 컬럼 정렬/필터 (탭1과 동일 UX — 트리: 정렬=형제끼리(계층 유지), 필터=경로 유지 contains·AND) ──
        function _treeCellText(node, key) {
            var c = T2_MAP[key], v = node[key];
            if (c && c.nz && _isRoot(node)) { v = ""; }   // ROOT/패키지의 nz 컬럼은 빈값(렌더와 동일)
            return (c && c.fmt) ? c.fmt(v) : (v == null ? "" : String(v));
        }
        function _hasTreeColFilters() {
            return Object.keys(_treeColFilters).some(function (k) { return _treeColFilters[k]; });
        }
        function _anyTreeFilter() { return !!sTreeFilter || _hasTreeColFilters(); }
        // 컬럼 필터(AND·contains) — 최상위 컨테이너(U4A IDE)는 항상 통과(자손 매칭 시 경로 표시).
        function _matchColFilters(node) {
            if (_isTopRoot(node)) { return true; }
            return Object.keys(_treeColFilters).every(function (k) {
                var val = _treeColFilters[k];
                return !val || _treeCellText(node, k).toLowerCase().indexOf(val) !== -1;
            });
        }
        // 노드 자체 매칭 = 검색박스 AND 컬럼필터.
        function _nodeSelfMatch(node) { return _matchFilter(node) && _matchColFilters(node); }
        // 정렬: 형제 배열을 정렬키로(계층 구조 유지) — 비파괴(원본 배열 보존).
        function _sortArr(arr) {
            if (!_treeSortKey || !arr || arr.length < 2) { return arr || []; }
            var d = _treeSortDir === "desc" ? -1 : 1;
            return arr.slice().sort(function (a, b) {
                return _treeCellText(a, _treeSortKey).localeCompare(_treeCellText(b, _treeSortKey), undefined, { numeric: true }) * d;
            });
        }
        function _sortedKids(node) { return _sortArr(node.APPF4HIER || []); }

        // 필터 시: 자신 또는 하위에 매칭이 있으면 표시.
        function _subtreeHasMatch(node) {
            if (!_isTopRoot(node) && _nodeSelfMatch(node)) { return true; }
            var kids = node.APPF4HIER || [];
            for (var i = 0; i < kids.length; i++) { if (_subtreeHasMatch(kids[i])) { return true; } }
            return false;
        }
        // 검색/컬럼필터 적용 시 매칭 경로만 자동 펼침(매칭 자손이 있는 노드 oExpand=true). 단일 패스 O(n).
        //   강제 펼침이 아니라 oExpand 를 세팅만 하므로, 이후 토글로 다시 접을 수 있다.
        function _expandMatchPaths() {
            function walk(node) {   // 반환: 이 서브트리(자신/자손)에 매칭이 있는가
                var selfMatch = !_isTopRoot(node) && _nodeSelfMatch(node);
                var kids = node.APPF4HIER || [], anyKid = false;
                kids.forEach(function (k) { if (walk(k)) { anyKid = true; } });
                if (anyKid) { oExpand[node._uid] = true; }   // 매칭 자손 있으면 펼쳐서 드러냄
                return selfMatch || anyKid;
            }
            aTreeRoot.forEach(walk);
        }

        // 공통 트리 UX(U4AUI.createTree _collapseRec 와 동일): 접을 때 하위 전체도 접는다
        //   → 다시 펼치면 직속 자식만 보이고 손자 이하는 접힌 상태.
        function _collapseDesc(node) {
            (node.APPF4HIER || []).forEach(function (k) {
                oExpand[k._uid] = false;
                _collapseDesc(k);
            });
        }
        // 서브트리 전체 펼침(노드+모든 자손) — Expand 버튼/공통 expandSubtree 대응. 루트면 트리 전체.
        function _expandSubtree(node) {
            oExpand[node._uid] = true;
            (node.APPF4HIER || []).forEach(_expandSubtree);
        }

        // 한 노드 → <tr>(전 컬럼). idx=가상스크롤 절대 인덱스(zebra). 토글=펼침상태만 바꾸고 평탄목록 재세팅.
        function _treeRow(node, depth, idx, cols) {
            var kids = node.APPF4HIER || [];
            var bHasKids = kids.length > 0;
            var bExp = !!oExpand[node._uid];   // 필터 중에도 oExpand 존중(검색 시 매칭경로는 _expandMatchPaths 가 미리 펼침)
            var tr = _el("tr");
            if (idx % 2 === 1) { tr.setAttribute("data-odd", "true"); }
            tr.setAttribute("data-row-idx", String(idx));     // 고정/스크롤 페인 행 hover 동기 키
            tr.setAttribute("data-uid", String(node._uid));   // 선택 동기 키
            if (oT2G.isHovered(idx)) { tr.classList.add("is-hover"); }   // 렌더 시 hover 상태 반영(타이밍 경합 무관)
            if (_isRoot(node)) { tr.classList.add("is-root"); }
            if (bHasKids) { tr.setAttribute("aria-expanded", bExp ? "true" : "false"); }
            tr.addEventListener("click", function () { _selectTree(node._uid); });
            tr.addEventListener("dblclick", function () { if (!_isRoot(node)) { _pick(node); } });
            cols.forEach(function (c) {
                var td = _el("td", c.align === "center" ? "is-center" : null);
                if (c.tree) {
                    td.classList.add("u4aAppF4TreeCell");
                    td.style.setProperty("--u4a-tree-depth", String(depth));
                    var inner = _el("span", "u4aAppF4TreeInner");   // td 는 table-cell 유지(정렬), 안쪽만 flex
                    var tog = _el("button", "u4a-tree__toggle");
                    tog.type = "button";
                    tog.innerHTML = _fa("chevron-right");   // 공통 트리: 우향 셰브론이 aria-expanded 로 회전
                    if (bHasKids) {
                        tog.addEventListener("click", function (e) {
                            e.stopPropagation();
                            var bOpen = !oExpand[node._uid];
                            oExpand[node._uid] = bOpen;
                            // 공통 트리 UX: 접으면 하위 전체도 접는다(다시 펼치면 직속 자식만).
                            if (!bOpen) { _collapseDesc(node); }
                            // 접기/펼치기 시 기존 선택은 해제(접힌 노드에 가려진 유령 선택 방지) — 두 페인 모두.
                            _vs2.setSel(null); _vs2f.setSel(null);
                            // 가상 스크롤: 펼침상태만 바꾸고 평탄목록 재계산 → 고정/스크롤 페인 동시 재세팅(보이는 행만).
                            _setTreeRows(_flattenTree(), true);
                        });
                    } else { tog.classList.add("u4a-tree__toggle--leaf"); }
                    var lbl = _el("span", "u4aAppF4TreeLabel", _isRoot(node) ? (node.APPNM || "ROOT") : (node.APPNM || ""));
                    inner.append(tog, lbl);
                    td.appendChild(inner);
                } else if (c.action === "disp") {
                    td.classList.add("is-action");
                    var b = _actBtn("desktop", MSG_DISP, function (e) { e.stopPropagation(); _doTreeDisplay(node); });
                    if (!bWS10 || bHasKids || _isRoot(node)) { b.disabled = true; }
                    td.appendChild(b);
                } else if (c.link) {
                    if (_isRoot(node)) { td.textContent = ""; }
                    else {
                        var a = _el("a", "u4aAppF4Link", node[c.key] || "");
                        a.href = "javascript:void(0)";
                        a.addEventListener("click", function (e) { e.stopPropagation(); _doTreeRun(node); });
                        td.appendChild(a);
                    }
                } else {
                    var v = node[c.key];
                    if (c.nz && _isRoot(node)) { v = ""; }
                    td.textContent = c.fmt ? c.fmt(v) : (v == null ? "" : String(v));
                }
                tr.appendChild(td);
            });
            return tr;
        }

        // 펼침/필터 상태 기준 "보이는 노드"를 평탄화 → [{node, depth}] (DOM 없이, 빠름).
        function _flattenTree() {
            var out = [];
            function walk(node, depth) {
                // 검색/컬럼필터 시: 자기 또는 하위에 매칭이 없으면 숨김(빈 부모 패키지·최상위 컨테이너 모두).
                //   매칭이 하나도 없으면 root 까지 빠져 빈 목록 → 공통 no-data 문구 표시.
                if (_anyTreeFilter() && !_subtreeHasMatch(node)) { return; }
                out.push({ node: node, depth: depth });
                var bExp = !!oExpand[node._uid];   // 필터 중에도 oExpand 존중(검색 시 매칭경로는 _expandMatchPaths 가 미리 펼침)
                if (bExp && (node.APPF4HIER || []).length) {
                    _sortedKids(node).forEach(function (k) { walk(k, depth + 1); });   // 형제는 정렬 순서로
                }
            }
            _sortArr(aTreeRoot).forEach(function (n) { walk(n, 0); });   // 최상위도 정렬 순서로
            return out;
        }
        function _buildTreeRow(item, i, cols) { return _treeRow(item.node, item.depth, i, cols); }

        // 탭2(트리) 컬럼 메뉴 컨트롤러 — 공유 _openColMenu 가 소비(상태=_treeSortKey/_treeColFilters).
        var _t2ColCtl = {
            getFilter: function (k) { return _treeColFilters[k] || ""; },
            setFilter: function (k, v) { if (v) { _treeColFilters[k] = v; } else { delete _treeColFilters[k]; } },
            getSort: function () { return _treeSortKey ? { key: _treeSortKey, dir: _treeSortDir } : null; },
            setSort: function (k, d) { _treeSortKey = k; _treeSortDir = d; },
            rerender: function () {
                // 필터 변경 시 매칭 경로 자동 펼침(검색박스와 동일) → 매치 드러냄.
                if (_anyTreeFilter()) { _expandMatchPaths(); }
                _renderTree();
            }
        };
        // 헤더 셀 1개(탭1 _buildT1Th 와 동일 구성) — 데이터/트리/링크 컬럼만 정렬·필터 메뉴, action 제외.
        function _buildT2Th(c) {
            var th = _el("th", c.align === "center" ? "is-center" : null);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            var inner = _el("div", "u4a-th__inner");
            if (c.align === "center") { inner.classList.add("u4a-th__inner--center"); }
            inner.appendChild(_el("span", "u4a-th__label", c.action ? MSG_DISP : c.label));
            if (c.key && !c.action) {
                var bSorted = _treeSortKey === c.key, bFiltered = !!_treeColFilters[c.key];
                if (bSorted || bFiltered) {
                    var ind = _el("span", "u4a-th__ind");
                    if (bSorted) { ind.innerHTML += _fa(_treeSortDir === "desc" ? "arrow-down" : "arrow-up"); }
                    if (bFiltered) { ind.innerHTML += _fa("filter"); }
                    inner.appendChild(ind);
                }
                th.appendChild(inner);
                th.classList.add("u4a-th--menu");
                th.addEventListener("click", function (e) { e.stopPropagation(); _openColMenu(c, th, _t2ColCtl); });
            } else {
                th.appendChild(inner);
            }
            return th;
        }
        function _buildT2Head() {
            oT2FrzHead.textContent = "";
            var fr = _el("tr");
            T2_FRZ_COLS.forEach(function (c) { fr.appendChild(_buildT2Th(c)); });
            oT2FrzHead.appendChild(fr);
            oT2ScrHead.textContent = "";
            var sr = _el("tr");
            T2_SCR_COLS.forEach(function (c) { sr.appendChild(_buildT2Th(c)); });
            oT2ScrHead.appendChild(sr);
        }

        // 정렬·필터 전체 해제 버튼 활성/비활성 동기화(걸린 정렬·필터·검색이 하나라도 있을 때만 활성).
        function _syncClearAllBtn() { oClearAllBtn.disabled = !(_treeSortKey || _anyTreeFilter()); }
        function _clearAllTreeSF() {
            if (!_treeSortKey && !_anyTreeFilter()) { return; }
            _treeSortKey = null; _treeSortDir = null;
            _treeColFilters = {};
            sTreeFilter = "";
            if (oTSrch.input.value) {   // 검색박스도 비우고 clear(X) 글리프 동기화(input 이벤트)
                oTSrch.input.value = "";
                try { oTSrch.input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { }
            }
            _renderTree();
        }

        // 고정/스크롤 페인 모두 가상스크롤 동시 세팅(토글/필터/정렬 공통 경로).
        function _setTreeRows(view, keep) { _vs2f.setRows(view, keep); _vs2.setRows(view, keep); oT2G.sync(); }
        // 선택 강조 동기 — 두 페인 각 makeVScroller getSelKey 가 보이는 행에 aria-selected 자동 부여.
        function _selectTree(uid) { _vs2f.setSel(uid); _vs2f.refresh(); _vs2.setSel(uid); _vs2.refresh(); }
        // 전체 렌더(로드/필터/Expand·Collapse all) = 헤더(정렬/필터 표시자) 재구성 + 평탄목록을 두 페인에.
        function _renderTree() { _buildT2Head(); _syncClearAllBtn(); _setTreeRows(_flattenTree()); }

        function _treeExpandAll(bExpand) {
            // 가상 스크롤이라 전체 펼침/접힘도 즉시(보이는 행만 렌더) — busy 불필요.
            function walkAll(n) { oExpand[n._uid] = bExpand; (n.APPF4HIER || []).forEach(walkAll); }
            aTreeRoot.forEach(walkAll);
            if (!bExpand) { aTreeRoot.forEach(function (n) { oExpand[n._uid] = true; }); } // 루트는 펼친 채
            _renderTree();
        }

        // 현재 선택된 트리 노드(없으면 null) — Expand/Collapse 버튼이 "선택 기준"으로 동작하게(원본 getSelectedIndex).
        function _findNodeByUid(uid) {
            var found = null;
            (function walk(nodes) {
                for (var i = 0; i < nodes.length && !found; i++) {
                    if (nodes[i]._uid === uid) { found = nodes[i]; return; }
                    walk(nodes[i].APPF4HIER || []);
                }
            })(aTreeRoot);
            return found;
        }
        function _selTreeNode() {
            var uid = _vs2.getSel();
            return uid != null ? _findNodeByUid(uid) : null;
        }

        // 고정 페인(트리 컬럼 + 앱 조회) 가상 스크롤 인스턴스.
        var _vs2f = _makeVScroller(oT2G.frzPane, oT2FrzBody, {
            colCount: T2_FRZ_COLS.length,
            buildRow: function (item, i) { return _buildTreeRow(item, i, T2_FRZ_COLS); },
            getSelKey: function (item) { return item.node._uid; }
        });
        // 스크롤 페인(나머지 컬럼) 가상 스크롤 인스턴스 — no-data 문구는 이쪽(넓은 영역)에만.
        var _vs2 = _makeVScroller(oT2G.scrPane, oT2ScrBody, {
            colCount: T2_SCR_COLS.length,
            buildRow: function (item, i) { return _buildTreeRow(item, i, T2_SCR_COLS); },
            nodata: MSG_NODATA, getSelKey: function (item) { return item.node._uid; }
        });

        // flat T_APPL → nested(APPF4HIER), 원본 _appF4Tree 규칙.
        function _buildTree(aRaw) {
            var arr = (aRaw || []).slice().sort(function (a, b) { return String(a.APPID).localeCompare(String(b.APPID)); });
            var mLookup = {};
            arr.forEach(function (n) {
                n._uid = ++_uidSeq; n.APPF4HIER = [];
                if (!mLookup[n.APPID] || n.PACKG === "" || n.PACKG === "ROOT") { mLookup[n.APPID] = n; }
            });
            // 부모 연결 — 순환(A→B→A) 방지: par 의 조상 체인에 n 이 있으면 연결 스킵(비순환 보장).
            function lf_wouldCycle(par, n) {
                var cur = par, g = 0;
                while (cur && g++ < 100000) { if (cur === n) { return true; } cur = cur._par; }
                return false;
            }
            arr.forEach(function (n) {
                var par = mLookup[n.PACKG];
                if (par && par !== n && !n._par && !lf_wouldCycle(par, n)) {
                    par.APPF4HIER.push(n); n._par = par;
                }
            });
            var rootNode = arr.find(function (n) { return n.APPID === "ROOT"; });
            if (rootNode) { return [rootNode]; }
            // ROOT 노드가 없으면 부모를 못 찾은 노드들을 최상위로.
            return arr.filter(function (n) { return !mLookup[n.PACKG] || mLookup[n.PACKG] === n; });
        }

        function _loadTree() {
            _busy(true);
            var sPath = parent.getServerPath() + "/getapplhierarchydata";
            try {
                sendAjax(sPath, null, function (oRes) {
                    if (oRes && oRes.RETCD === "E") {
                        _flash(); _busy(false);
                        try { APPCOMMON.fnShowFloatingFooterMsg("E", parent.getCurrPage(), oRes.RTMSG); } catch (e) { }
                        return;
                    }
                    aTreeRoot = _buildTree(oRes && oRes.T_APPL);
                    bTreeLoaded = true;
                    oExpand = {};                                                  // 재조회마다 펼침상태 초기화(원본 collapseAll→expandToLevel(1))
                    aTreeRoot.forEach(function (n) { oExpand[n._uid] = true; });    // 최초 1레벨
                    if (_anyTreeFilter()) {
                        // 검색/컬럼필터가 활성이면 매칭 경로를 다시 펼친다 → 다른 탭 갔다 와도(=K2 재조회) 펼침 모습 유지.
                        _expandMatchPaths();
                    } else {
                        try { var _u0 = aTreeRoot[0] ? aTreeRoot[0]._uid : null; _vs2.setSel(_u0); _vs2f.setSel(_u0); } catch (e) { } // 원본 setSelectedIndex(0)
                    }
                    _renderTree();
                    _busy(false);
                });
            } catch (e) { _busy(false); _msg("E", String(e && e.message || e)); }
        }

        /* ── 행 액션 ─────────────────────────────────────────────── */
        function _pick(row) {
            try { if (typeof _fnCb === "function") { _fnCb(row); } } catch (e) { }
            lf_close();
        }

        function _doRun(row) {
            var sAPPID = row && row.APPID;
            if (!sAPPID) { return; }
            parent.setBusy("X");                       // 원본: 존재확인(fnCheckAppExists) 전 busy on
            oAPP.fn.fnCheckAppExists(sAPPID, function (oRes) {
                var info = (oRes && oRes.RETURN) || {};
                // ★ 원본은 oResult.RETURN.RETCD 로 존재여부 판정(최상위 oRes.RETCD 아님). 세 에러경로 모두 flashFrame.
                if (info.RETCD === "E") {
                    parent.setBusy(""); _flash();
                    _msg("E", _txt("/U4A/MSG_WS", "007", info.APPID || sAPPID));
                    return;
                }
                if (info.APPTY === "U") { parent.setBusy(""); _flash(); _msg("E", _txt("/U4A/MSG_WS", "189")); return; }
                if (info.ACTST === "I") { parent.setBusy(""); _flash(); _msg("E", _wsTxt("434")); return; }
                try { oAPP.fn.fnOnExecApp(sAPPID); } catch (e) { parent.setBusy(""); _msg("E", String(e && e.message || e)); }
            });
        }

        // WS10 Display 모드 — 원본 _navToWS20Display 아키텍처 1:1.
        //   ① 필수 가드(APPID + AppNmInput + Display 핸들러)  ② 다이얼로그 숨김(파괴 X, 모달 해제)
        //   ③ APPID 세팅 → 조회 발화(ev_AppDisplay 가 값을 동기로 읽음)  ④ 입력 초기화(부수효과 방지)
        function _doDisplay(row) {
            var sAPPID = row && row.APPID;
            if (!sAPPID || !bWS10) { return; }
            var inp = document.getElementById("AppNmInput");
            var fnDisp = oAPP.events && oAPP.events.ev_AppDisplay;
            if (!inp || typeof fnDisp !== "function") { return; }   // 원본: AppNmInput + displayBtn 존재 가드
            var fld = inp.closest ? inp.closest(".u4a-field") : null;

            lf_hide();                                              // ② setVisible(false) 대응(숨김·상태보존)
            oDlg._pendingReshow = true;                             //    WS10 복귀(back) 시 자동 재표시 대상(원본 isOpen&&!visible)
            // ③ setValue(APPID) — ★ input 이벤트를 쏘지 않는다(쏘면 WS10 attachSuggest 가 추천목록을 연다).
            //    원본 sap setValue 도 이벤트 미발생. clear-X 노출은 data-filled 로 직접 동기.
            inp.value = sAPPID;
            if (fld) { fld.setAttribute("data-filled", "true"); }
            try { fnDisp(); } catch (e) { }                         //    firePress(displayBtn) → 동기로 값 읽음
            inp.value = "";                                         // ④ setValue("") — WS10 입력칸에 잔상 방지
            if (fld) { fld.setAttribute("data-filled", "false"); }
        }

        // 트리: 실행 불가(자식 있음/ROOT/APPID 없음) 가드.
        function _treeRunnable(node) {
            if (!node || !node.APPID || node.APPID === "ROOT") { return false; }
            if ((node.APPF4HIER || []).length > 0) { return false; }
            return true;
        }
        function _doTreeRun(node) {
            if (!_treeRunnable(node)) { _flash(); _msg("E", MSG_NOAPP); return; }
            _doRun(node);
        }
        function _doTreeDisplay(node) {
            if (!_treeRunnable(node)) { _flash(); _msg("E", MSG_NOAPP); return; }
            _selectTree(node._uid);   // 원본 _setUiTableSelectedRow — 복귀 시 강조 유지(고정/스크롤 페인 동기)
            _doDisplay(node);
        }

        /* ── 오픈 ────────────────────────────────────────────────── */
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });
        if (window.U4AUI) {
            try { U4AUI.makeDialogDraggable && U4AUI.makeDialogDraggable(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogRecenter && U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogResizable && U4AUI.makeDialogResizable(oDlg, { minW: 720, minH: 420 }); } catch (e) { }
        }

        // 싱글톤 재표시 훅 — 숨겨진 인스턴스를 다음 F4 에 다시 띄울 때 사용(상태 보존, 콜백/검색 갱신).
        oDlg._appf4Reopen = function (opt, cb) {
            if (typeof cb === "function") { _fnCb = cb; }
            oDlg._pendingReshow = false;
            _bAutoSearch = !!(opt && opt.autoSearch);   // 원본 oOptions.autoSearch 갱신
            if (!oDlg.open) { try { oDlg.showModal(); } catch (e) { } }
            _selectTab("K1");                           // showModal 후 select(포커스)
            if (_bAutoSearch) { _doSearch(); }          // 재오픈 요청이 autoSearch 면 1회 자동검색
        };

        // WS20→WS10 back 복귀 시 재표시(검색/탭/상태 그대로 — 원본 setVisible(true) 대응).
        //   호출은 셸 fnOnMoveToPage("WS10") 분기가 _pendingReshow 인 인스턴스에 한해 수행.
        oDlg._appf4Reshow = function () {
            oDlg._pendingReshow = false;
            if (!oDlg.open) { try { oDlg.showModal(); } catch (e) { } }
        };

        document.body.appendChild(oDlg);
        try { _renderT1(); } catch (e) { }   // 초기 헤더(+no-data) 렌더(검색 전에도 컬럼 표시)
        oDlg.showModal();
        // 원본 ev_AppF4DialogAfterOpen: 열린 뒤 현재 탭으로 select 발화(포커스). autoSearch 면 1회 자동검색.
        _selectTab("K1");
        if (_bAutoSearch) { _doSearch(); }   // 처음 오픈 시 1회만(탭 클릭 재검색 아님)

    }; // end of oAPP.fn.fnAppF4PopupOpen

    /* ====================================================================
     * 스코프 CSS (1회 주입) — 토큰 기반, 공통 컴포넌트와 일관.
     * ================================================================== */
    function _ensureStyle() {
        if (document.getElementById("u4aAppF4Style")) { return; }
        var s = document.createElement("style");
        s.id = "u4aAppF4Style";
        s.textContent = [
            ".u4aAppF4Dlg{width:min(94vw,1400px);height:86vh;max-width:none;display:flex;flex-direction:column;}",
            ".u4aAppF4Dlg .u4a-dialog__header{cursor:move;user-select:none;}",
            ".u4aAppF4Body{display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:0;}",
            ".u4aAppF4Tabs{flex:0 0 auto;display:flex;gap:.25rem;padding:.5rem .75rem 0;border-bottom:.0625rem solid var(--line);background:var(--surface);}",
            ".u4aAppF4Tab{appearance:none;border:0;background:transparent;color:var(--text-muted);font:inherit;font-weight:600;padding:.5rem .875rem;border-radius:var(--radius-sm) var(--radius-sm) 0 0;border-bottom:.125rem solid transparent;cursor:pointer;}",
            ".u4aAppF4Tab:hover{background:var(--hover-bg);color:var(--text);}",
            ".u4aAppF4Tab[aria-selected=\"true\"]{color:var(--accent);border-bottom-color:var(--accent);}",
            ".u4aAppF4Page{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;padding:.875rem 1rem;gap:.75rem;overflow:hidden;}",
            ".u4aAppF4Page[hidden]{display:none;}",
            ".u4aAppF4Form{flex:0 0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.625rem 2rem;}",
            ".u4aAppF4FRow{display:flex;align-items:center;gap:.75rem;}",
            ".u4aAppF4FRow>.u4a-label{flex:0 0 6rem;text-align:right;color:var(--text-muted);font-weight:600;}",
            ".u4aAppF4FRow .u4aAppF4Field{flex:1 1 auto;min-width:0;width:auto;}",
            ".u4aAppF4FRow .u4aAppF4Sel{flex:1 1 auto;min-width:0;max-width:none;}",
            ".u4aAppF4Field .u4a-field__input{width:100%;}",
            ".u4aAppF4SrchPanel{flex:0 0 auto;}",
            ".u4aAppF4TreeBar{flex:0 0 auto;display:flex;align-items:center;gap:.375rem;}",
            ".u4aAppF4ClearBtn{margin-left:auto;}",   /* 탭1·탭2 공통: 전체해제 버튼을 툴바 우측 끝으로 */
            ".u4aAppF4TBarSep{width:.0625rem;height:1.25rem;background:var(--line);margin:0 .25rem;}",
            /* overflow-anchor:none·overscroll-behavior:contain 은 공통 U4AUI.makeVScroller 가
               스크롤컨테이너(이 wrap)에 inline 으로 설정(끝단 떨림·스크롤앵커링 방지 단일 출처). */
            /* ── 2-pane 그리드(CSS Grid): 박스(보더+라운드+surface)=그리드. col1=고정,col2=스크롤 / row1=본문,row2=하단 가로바.
               가로바(hsb)를 col2/row2 에 둬 고정 컬럼(col1) 영역 자동 제외 → '고정바 이후'가 폭 동기 없이 성립. ── */
            ".u4aAppF4Grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;overflow:hidden;border:.0625rem solid var(--line);border-radius:var(--radius);background:var(--surface);}",
            /* 고정 페인 — col1/row1. 세로바 없음(스크롤 페인 scrollTop 추종). 우측 경계선 = '고정바'. */
            ".u4aAppF4Pane--frozen{grid-column:1;grid-row:1;min-width:0;overflow:hidden;border-right:.0625rem solid var(--line);}",
            /* 스크롤 페인 — col2/row1. ★가로 스크롤바는 여기서 제거(하단 hsb 로 분리)★ → 가로바가 행과 안 겹침. 세로바만. */
            ".u4aAppF4Pane--scroll{grid-column:2;grid-row:1;min-width:0;overflow-x:hidden;overflow-y:auto;}",
            /* 하단 별도 가로 스크롤바(UI5 sap.ui.table HSb) — col2/row2. 트랙 폭(spacer)=스크롤 페인 콘텐츠 폭(JS 동기). */
            ".u4aAppF4HSb{grid-column:2;grid-row:2;overflow-x:auto;overflow-y:hidden;}",
            ".u4aAppF4HSbSpacer{height:.0625rem;}",
            /* 공통 .u4a-table(--compact) 소비. 고정=컬럼폭 합 고정, 스크롤=내용폭(좁으면 가로스크롤·넓으면 채움). */
            ".u4aAppF4Dlg .u4aAppF4Tbl{border-collapse:separate;border-spacing:0;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl--frozen{width:max-content;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl--scroll{width:max-content;min-width:100%;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl th.is-center,.u4aAppF4Dlg .u4aAppF4Tbl td.is-center{text-align:center;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl th.is-action,.u4aAppF4Dlg .u4aAppF4Tbl td.is-action{text-align:center;width:4.5rem;padding-left:.25rem;padding-right:.25rem;}",
            /* ★ 2-pane 행높이 정합 핵심 — 셀 줄바꿈 금지. 좁혀도 줄바꿈으로 행이 커지지 않음(넘치면 가로스크롤=고정바 이후).
               고정/스크롤 페인 행이 항상 1줄·동일 높이라 scrollTop 동기 정렬이 어긋나지 않는다. */
            ".u4aAppF4Dlg .u4aAppF4Tbl th,.u4aAppF4Dlg .u4aAppF4Tbl td{white-space:nowrap;}",
            /* 모든 셀 수직 중앙(액션 아이콘이 텍스트와 어긋나지 않게) */
            ".u4aAppF4Dlg .u4aAppF4Tbl td{vertical-align:middle;}",
            /* 행 안 액션 버튼만 컴팩트(콤팩트 행에 맞춤). 툴바(Expand/Collapse/전체해제) 버튼은
               공통 .u4a-btn-icon 표준(2rem)을 그대로 쓴다 — 화면별로 작게 줄이지 않음. */
            ".u4aAppF4Tbl .u4aAppF4ActBtn{width:1.5rem;height:1.5rem;}",
            ".u4aAppF4Tbl .u4aAppF4ActBtn i{font-size:.75rem;}",
            /* 트리 셀: td 는 table-cell 유지(다른 컬럼과 정렬), 안쪽 래퍼만 flex. 공통 토글 + --u4a-tree-depth 들여쓰기 */
            ".u4aAppF4TreeCell{overflow:hidden;}",
            /* 토글↔텍스트 간격·들여쓰기 step 은 공통 트리 표준(shell.css .u4a-tree__row gap 0.375rem,
               step 1rem)과 동일하게 맞춘다(2026-06-23 트리 통일). */
            ".u4aAppF4TreeInner{display:flex;align-items:center;gap:.375rem;min-width:0;}",
            /* ★ 들여쓰기 padding-left 는 공통 .u4a-table td(0,1,2)보다 specificity 를 높여야 안 먹힌다. */
            ".u4aAppF4Dlg .u4aAppF4Tbl td.u4aAppF4TreeCell{padding-left:calc(.375rem + var(--u4a-tree-depth,0) * var(--u4a-tree-indent-step,1rem));}",
            ".u4aAppF4TreeInner .u4a-tree__toggle i{transition:transform var(--motion) linear;}",
            ".u4aAppF4Dlg .u4aAppF4Tree tbody tr[aria-expanded=\"true\"] .u4a-tree__toggle i{transform:rotate(90deg);}",
            ".u4aAppF4TreeLabel{overflow:hidden;text-overflow:ellipsis;}",
            ".u4aAppF4Link{color:var(--link);font-weight:600;cursor:pointer;}",
            ".u4aAppF4Link:hover{text-decoration:underline;}",
            /* ── zebra(공통 data-odd 배경) off — 사용자 요청(눈 피로). 행 구분은 hover/선택으로만(.analy 16 §6.1 기본은 zebra). ── */
            ".u4aAppF4Tbl tbody tr[data-odd=\"true\"]{background:transparent;}",
            /* hover 동기(JS .is-hover) + 공통 :hover — 짝/홀 동일색(2-pane 라 마우스 없는 페인도 동시 강조). */
            ".u4aAppF4Tbl tbody tr:hover,.u4aAppF4Tbl tbody tr.is-hover,.u4aAppF4Tbl tbody tr[data-odd=\"true\"]:hover,.u4aAppF4Tbl tbody tr[data-odd=\"true\"].is-hover{background:var(--hover-bg);}",
            /* 선택행 우선(hover/zebra 보다 강하게 — 공통 selected 색 유지). */
            ".u4aAppF4Tbl tbody tr[aria-selected=\"true\"],.u4aAppF4Tbl tbody tr[aria-selected=\"true\"][data-odd=\"true\"],.u4aAppF4Tbl tbody tr[aria-selected=\"true\"]:hover,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"].is-hover,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"][data-odd=\"true\"]:hover,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"][data-odd=\"true\"].is-hover{background:var(--selected-bg);}",
            /* 선택 좌측 accent bar(공통 td:first-child)는 고정 페인 첫 컬럼에만 — 스크롤 페인 첫 컬럼(테이블 중간)엔 끔. */
            ".u4aAppF4Tbl--scroll tbody tr[aria-selected=\"true\"]>td:first-child{box-shadow:none;}",
            /* 가상 스크롤 스페이서 행 — hover/zebra/선택 표시 없음 */
            ".u4aAppF4Dlg .u4aVSpacer,.u4aAppF4Dlg .u4aVSpacer:hover{background:transparent;cursor:default;}",
            ".u4aAppF4Dlg .u4aVSpacer td{padding:0;border:0;}",
            /* 컬럼 헤더(.u4a-th--menu/__inner/__label/__ind) + 정렬/필터 메뉴(.u4a-colmenu)
               CSS 는 전 화면 공통(shell.css)으로 승격 — 여기 인라인 복제 제거(2026-06-24). */
            ""
        ].join("\n");
        document.head.appendChild(s);
    }

})(window, $, oAPP);
