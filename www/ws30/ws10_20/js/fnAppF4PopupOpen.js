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
    function _makeVScroller(oWrap, oTbody, opt) {
        var ROWH = opt.rowH || 36;          // 행 높이(첫 렌더 후 실제 측정으로 보정)
        var OVER = opt.overscan || 6;       // 위/아래 여유 행
        var aData = [];
        var bMeasured = false;
        var raf = 0;
        var selKey = null;

        function _spacer() {
            var tr = document.createElement("tr");
            tr.className = "u4aVSpacer"; tr.setAttribute("aria-hidden", "true");
            var td = document.createElement("td");
            td.colSpan = opt.colCount;
            td.style.padding = "0"; td.style.border = "0";
            var div = document.createElement("div");
            div.style.height = "0px"; div.style.width = "1px";
            td.appendChild(div);
            tr.appendChild(td);
            // 높이를 div + td 양쪽에 건다 — table-layout:fixed 에서 cell 자식 div 높이가
            // 행높이로 반영 안 되는 환경 대비(둘 중 하나는 반드시 행높이로 먹는다).
            tr._setH = function (px) { div.style.height = px + "px"; td.style.height = px + "px"; };
            return tr;
        }
        var oTop = _spacer(), oBot = _spacer();

        function _render() {
            var total = aData.length;
            // ★ scrollTop 은 DOM 을 건드리기 전에 읽는다. tbody 를 통째로 비우면 테이블 높이가
            //   thead 만 남아 붕괴 → 브라우저가 scrollTop 을 0 으로 클램프 → 읽으면 항상 0 이 되어
            //   휠/드래그가 맨 위로 튕기던 핵심 버그. 그래서 (a) 먼저 읽고 (b) 스페이서를 절대
            //   떼지 않아 높이가 붕괴하지 않게 한다.
            var st = oWrap.scrollTop, vh = oWrap.clientHeight || 400;

            if (!total) {
                oTbody.textContent = "";
                if (opt.nodata != null) {
                    var trN = document.createElement("tr"); trN.className = "u4a-table__nodata";
                    var tdN = document.createElement("td"); tdN.colSpan = opt.colCount; tdN.textContent = opt.nodata;
                    trN.appendChild(tdN); oTbody.appendChild(trN);
                }
                return;
            }

            var start = Math.max(0, Math.floor(st / ROWH) - OVER);
            var cnt = Math.ceil(vh / ROWH) + OVER * 2;
            var end = Math.min(total, start + cnt);

            // 스페이서가 항상 tbody 양 끝에 존재하도록 보장(없을 때만 초기화 — 높이 붕괴 방지).
            if (oTop.parentNode !== oTbody || oBot.parentNode !== oTbody) {
                oTbody.textContent = "";
                oTbody.appendChild(oTop);
                oTbody.appendChild(oBot);
            }
            // 위/아래 빈 높이 먼저 갱신 → 전체 높이 = total*ROWH 유지(클램프 없음).
            oTop._setH(start * ROWH);
            oBot._setH(Math.max(0, total - end) * ROWH);

            // 새 행을 oBot 앞에 먼저 삽입한 뒤, 이전 윈도우 행을 제거(삽입-먼저/제거-나중 →
            // 높이가 목표 아래로 내려가는 순간이 없어 scrollTop 이 클램프되지 않는다).
            var aOld = [];
            for (var n = oTop.nextElementSibling; n && n !== oBot; n = n.nextElementSibling) { aOld.push(n); }
            var frag = document.createDocumentFragment();
            for (var i = start; i < end; i++) {
                var tr = opt.buildRow(aData[i], i);
                if (selKey != null && opt.getSelKey && opt.getSelKey(aData[i]) === selKey) {
                    tr.setAttribute("aria-selected", "true");
                }
                frag.appendChild(tr);
            }
            oTbody.insertBefore(frag, oBot);
            for (var j = 0; j < aOld.length; j++) { oTbody.removeChild(aOld[j]); }

            // 첫 렌더 1회 실제 행높이 측정 → 정수로 반올림해 ROWH 고정 + CSS 로 데이터 행높이 강제.
            //   ★ 끝단(맨 위/아래)에서 부르르 떠는 현상 방지: 행 실제높이가 ROWH 와 소수점 단위로
            //     다르면 스크롤할수록 scrollHeight 가 흔들리고, 끝에 닿으면 scrollTop 이 클램프되며
            //     scroll→재렌더 피드백 루프가 생겨 떨린다. 행을 정확히 ROWH(정수)px 로 강제하면
            //     total*ROWH 가 실제 높이와 항상 일치 → scrollHeight 불변 → 떨림 제거.
            if (!bMeasured) {
                var oFirst = oTop.nextElementSibling;
                if (oFirst && oFirst !== oBot) {
                    bMeasured = true;
                    var h = oFirst.getBoundingClientRect().height;
                    if (h) {
                        var r = Math.max(1, Math.round(h));
                        oWrap.style.setProperty("--u4a-vsrowh", r + "px");   // CSS 가 데이터 행을 이 높이로 강제
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

        // ★ 휠 직접 처리 — Electron/Chromium 에서 가상 스크롤 컨테이너의 네이티브 휠→스크롤이
        //   먹지 않는 케이스가 있어(앵커링/sticky thead/모달 top-layer 등 환경 의존), 휠 델타를
        //   scrollTop/Left 에 수동 반영한다. scrollTop 변경이 scroll 이벤트를 발화 → _render 재계산.
        //   - Ctrl+휠은 줌(전역 핸들러)에 양보. - 실제로 스크롤됐을 때만 preventDefault(가로/세로 양보).
        oWrap.addEventListener("wheel", function (e) {
            if (e.ctrlKey) { return; }
            var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? (oWrap.clientHeight || 1) : 1);
            var t0 = oWrap.scrollTop, l0 = oWrap.scrollLeft;
            oWrap.scrollTop = t0 + e.deltaY * unit;
            oWrap.scrollLeft = l0 + e.deltaX * unit;
            if (oWrap.scrollTop !== t0 || oWrap.scrollLeft !== l0) { e.preventDefault(); }
        }, { passive: false });

        return {
            setRows: function (a, bKeepScroll) {
                aData = a || [];
                if (!bKeepScroll) {
                    try { oWrap.scrollTop = 0; } catch (e) { }
                } else {
                    var maxTop = Math.max(0, aData.length * ROWH - (oWrap.clientHeight || 0));
                    if (oWrap.scrollTop > maxTop) { try { oWrap.scrollTop = maxTop; } catch (e) { } }
                }
                _render();
            },
            refresh: _render,
            setSel: function (k) { selKey = k; }
        };
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
        var _sortKey = null, _sortDir = null;   // 탭1 컬럼 정렬(단일) — 원본 sap.ui.table sortProperty
        var _colFilters = {};                   // 탭1 컬럼 필터(AND·contains) — 원본 filterProperty

        // ★ 메시지 텍스트는 호출마다 SQLite 조회라 비싸다 → 행 렌더 루프 밖에서 1회만 캐시.
        var MSG_RUN = _wsTxt("436");   // 앱 실행
        var MSG_DISP = _wsTxt("564");  // 앱 조회
        var MSG_NOAPP = _wsTxt("435"); // 실행할 수 없는 어플리케이션
        var MSG_SORTASC = _wsTxt("810");                        // 오름차순 정렬
        var MSG_SORTDESC = _wsTxt("811");                       // 내림차순 정렬
        var MSG_FILTERVAL = _txt("/U4A/CL_WS_COMMON", "A68");   // 필터 값(placeholder)
        var MSG_CLEARFILTER = _txt("/U4A/CL_WS_COMMON", "A69"); // 필터 초기화
        var MSG_NODATA = _wsTxt("946");                         // 데이터 없음(공통 .u4a-table__nodata — ServerList L("noData")=946 동일)

        /* ── 다이얼로그 골격 ─────────────────────────────────────── */
        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aAppF4Dlg";
        oDlg.id = "u4aAppF4Dlg";

        // 닫기 = 숨김(파괴 X). 원본 싱글톤처럼 DOM 유지 → 다음 호출에 재표시(상태 보존).
        function lf_close() { try { _closeColMenu(); } catch (e) { } try { oDlg.close(); } catch (e) { } }

        // 헤더
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.setAttribute("data-type", "I");
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
        oCloseBtn.innerHTML = _fa("xmark") + "<span></span>";
        oCloseBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A39");
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
            if (!b1 && !bTreeLoaded) { _loadTree(); }
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
            { action: "run" },
            { action: "disp" },
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

        // 좌측 3개 컬럼 고정(User Name / Open in Browser / App Views) — 가로 스크롤 시.
        var T1_FRZN = 3, T1_FRZ_LEFT = _frzLefts(T1_COLS, T1_FRZN);

        var oT1Wrap = _el("div", "u4aAppF4TblWrap u4a-table-wrap");
        var oT1 = _el("table", "u4a-table u4aAppF4Tbl");
        var oT1Head = _el("thead");   // 헤더는 _renderT1 이 매번 재구성(정렬/필터 표시자 갱신)
        var oT1Body = _el("tbody");
        oT1.append(oT1Head, oT1Body);
        oT1Wrap.appendChild(oT1);

        oPage1.append(oSrchPanel ? oSrchPanel.el : oForm, oT1Wrap);

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
        function _buildT1Th(c, idx) {
            var th = _el("th", c.align === "center" ? "is-center" : null);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            _applyFrz(th, idx, T1_FRZN, T1_FRZ_LEFT);
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
                th.addEventListener("click", function (e) { e.stopPropagation(); _openColMenu(c, th); });
            } else {
                th.appendChild(inner);
            }
            return th;
        }

        // 결과 행 1개 빌드(가상 스크롤러가 보이는 구간만 호출). i=절대 인덱스(zebra).
        function _buildT1Row(row, i) {
            var tr = _el("tr");
            if (i % 2 === 1) { tr.setAttribute("data-odd", "true"); }
            tr.addEventListener("click", function () { _vs1.setSel(row.APPID); _vs1.refresh(); });
            tr.addEventListener("dblclick", function () { _pick(row); });
            T1_COLS.forEach(function (c, idx) {
                var td = _el("td", c.align === "center" ? "is-center" : null);
                if (c.action === "run") {
                    td.classList.add("is-action");
                    td.appendChild(_actBtn("globe", MSG_RUN, function (e) { e.stopPropagation(); _doRun(row); }));
                } else if (c.action === "disp") {
                    td.classList.add("is-action");
                    var b = _actBtn("desktop", MSG_DISP, function (e) { e.stopPropagation(); _doDisplay(row); });
                    if (!bWS10) { b.disabled = true; }
                    td.appendChild(b);
                } else {
                    var v = row[c.key];
                    td.textContent = c.fmt ? c.fmt(v) : (v == null ? "" : String(v));
                }
                _applyFrz(td, idx, T1_FRZN, T1_FRZ_LEFT);
                tr.appendChild(td);
            });
            return tr;
        }
        function _renderT1() {
            // 헤더(정렬/필터 표시자 갱신 위해 매 렌더 재구성)
            oT1Head.textContent = "";
            var hr = _el("tr");
            T1_COLS.forEach(function (c, idx) { hr.appendChild(_buildT1Th(c, idx)); });
            oT1Head.appendChild(hr);
            // 바디 = 가상 스크롤(필터→정렬 파생 뷰)
            _vs1.setRows(_deriveView(aResult));
        }
        var _vs1 = _makeVScroller(oT1Wrap, oT1Body, {
            colCount: T1_COLS.length, buildRow: _buildT1Row, nodata: MSG_NODATA,
            getSelKey: function (row) { return row.APPID; }
        });

        // ── 컬럼 헤더 메뉴(정렬 asc/desc + 필터 input + 초기화) — 공통 .u4a-menu 소비 ──
        var _oColMenu = null;
        function _onColMenuOutside(e) { if (_oColMenu && !_oColMenu.contains(e.target)) { _closeColMenu(); } }
        function _closeColMenu() {
            if (!_oColMenu) { return; }
            try { _oColMenu.remove(); } catch (e) { }
            _oColMenu = null;
            document.removeEventListener("mousedown", _onColMenuOutside, true);
            window.removeEventListener("resize", _closeColMenu);
            window.removeEventListener("scroll", _closeColMenu, true);
        }
        function _openColMenu(c, th) {
            _closeColMenu();
            // ★ ServerList(fnOpenColumnMenu)와 동일 구성/순서: 필터 input → 정렬 asc/desc → 필터 초기화.
            var m = _el("div", "u4a-menu u4a-colmenu");
            m.setAttribute("role", "menu");
            m.addEventListener("click", function (e) { e.stopPropagation(); });

            // ── 필터 input (contains, Enter/blur 적용) ──
            var fw = _el("div", "u4a-colmenu__filter");
            var fi = _el("input", "u4a-input");
            fi.type = "text"; fi.placeholder = MSG_FILTERVAL;
            fi.value = _colFilters[c.key] || "";
            function applyF() {
                var v = fi.value.trim().toLowerCase(), cur = _colFilters[c.key] || "";
                if (v === cur) { return; }
                if (v) { _colFilters[c.key] = v; } else { delete _colFilters[c.key]; }
                _renderT1();
            }
            fi.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyF(); _closeColMenu(); } });
            fi.addEventListener("blur", applyF);
            fw.appendChild(fi);
            m.appendChild(fw);

            m.appendChild(_el("div", "u4a-colmenu__sep"));

            // ── 정렬 (오름/내림 — 활성 방향 재클릭 시 해제) ──
            function mkSort(sDir, sIcon, sLabel) {
                var it = _el("div", "u4a-menu__item");
                it.setAttribute("role", "menuitem");
                it.innerHTML = _fa(sIcon) + "<span></span>";
                it.querySelector("span").textContent = sLabel;
                var bActive = (_sortKey === c.key && _sortDir === sDir);
                if (bActive) { it.setAttribute("data-active", "true"); }
                it.addEventListener("click", function () {
                    if (bActive) { _sortKey = null; _sortDir = null; }
                    else { _sortKey = c.key; _sortDir = sDir; }
                    _renderT1(); _closeColMenu();
                });
                return it;
            }
            m.appendChild(mkSort("asc", "arrow-up", MSG_SORTASC));     // 오름차순 정렬
            m.appendChild(mkSort("desc", "arrow-down", MSG_SORTDESC)); // 내림차순 정렬

            m.appendChild(_el("div", "u4a-colmenu__sep"));

            // ── 필터 초기화(이 컬럼) — 활성 필터 없으면 비활성 ──
            var clr = _el("div", "u4a-menu__item");
            clr.setAttribute("role", "menuitem");
            clr.innerHTML = _fa("xmark") + "<span></span>";
            clr.querySelector("span").textContent = MSG_CLEARFILTER;
            if (!_colFilters[c.key]) { clr.setAttribute("aria-disabled", "true"); }
            clr.addEventListener("click", function () {
                if (!_colFilters[c.key]) { return; }
                delete _colFilters[c.key]; fi.value = ""; _renderT1(); _closeColMenu();
            });
            m.appendChild(clr);

            // top-layer 다이얼로그 안에 붙여(모달 위로) th 아래에 위치.
            oDlg.appendChild(m);
            var r = th.getBoundingClientRect();
            m.style.position = "fixed";
            m.style.top = r.bottom + "px";
            m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - m.offsetWidth - 8)) + "px";
            m.style.zIndex = "10";
            _oColMenu = m;
            // 창 리사이즈/스크롤 시 닫기 — 앵커(컬럼 헤더) 이동으로 위치 어긋남 방지.
            window.addEventListener("resize", _closeColMenu);
            window.addEventListener("scroll", _closeColMenu, true);
            setTimeout(function () { document.addEventListener("mousedown", _onColMenuOutside, true); }, 0);
            try { fi.focus(); } catch (e) { }
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
            { action: "disp" },
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

        // 좌측 2개 컬럼 고정(트리 / App Views) — 가로 스크롤 시.
        var T2_FRZN = 2, T2_FRZ_LEFT = _frzLefts(T2_COLS, T2_FRZN);

        var oTBar = _el("div", "u4aAppF4TreeBar");
        var oExpandBtn = _actBtn("angles-down", "Expand", function () { _treeExpandAll(true); });
        oExpandBtn.title = "Expand";
        var oCollapseBtn = _actBtn("angles-up", "Collapse", function () { _treeExpandAll(false); });
        oCollapseBtn.title = "Collapse";
        var oTSrch = _mkField("", { w: "16rem", ph: _wsTxt("565") }); // 어플리케이션 검색
        var _filtT = null;
        oTSrch.input.addEventListener("input", function () {
            if (_filtT) { clearTimeout(_filtT); }
            // 디바운스(타이핑 중 매 글자 재렌더 방지). 가상 스크롤이라 렌더는 보이는 행만 → 즉시.
            _filtT = setTimeout(function () {
                sTreeFilter = oTSrch.input.value.trim().toUpperCase();
                _renderTree();
            }, 200);
        });
        oTBar.append(oExpandBtn, oCollapseBtn, _el("span", "u4aAppF4TBarSep"), oTSrch.wrap);

        var oT2Wrap = _el("div", "u4aAppF4TblWrap u4a-table-wrap u4aAppF4TreeWrap");
        var oT2 = _el("table", "u4a-table u4aAppF4Tbl u4aAppF4Tree");
        var oT2Head = _el("thead");
        var oT2Hr = _el("tr");
        T2_COLS.forEach(function (c, idx) {
            var th = _el("th", c.align === "center" ? "is-center" : null, c.action ? MSG_DISP : c.label);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            _applyFrz(th, idx, T2_FRZN, T2_FRZ_LEFT);
            oT2Hr.appendChild(th);
        });
        oT2Head.appendChild(oT2Hr);
        var oT2Body = _el("tbody");
        oT2.append(oT2Head, oT2Body);
        oT2Wrap.appendChild(oT2);
        oPage2.append(oTBar, oT2Wrap);

        function _matchFilter(node) {
            if (!sTreeFilter || _isTopRoot(node)) { return true; }
            return String(node.APPID || "").toUpperCase().indexOf(sTreeFilter) > -1
                || String(node.APPNM || "").toUpperCase().indexOf(sTreeFilter) > -1;
        }
        // 필터 시: 자신 또는 하위에 매칭이 있으면 표시.
        function _subtreeHasMatch(node) {
            if (!_isTopRoot(node) && _matchFilter(node)) { return true; }
            var kids = node.APPF4HIER || [];
            for (var i = 0; i < kids.length; i++) { if (_subtreeHasMatch(kids[i])) { return true; } }
            return false;
        }

        // 공통 트리 UX(U4AUI.createTree _collapseRec 와 동일): 접을 때 하위 전체도 접는다
        //   → 다시 펼치면 직속 자식만 보이고 손자 이하는 접힌 상태.
        function _collapseDesc(node) {
            (node.APPF4HIER || []).forEach(function (k) {
                oExpand[k._uid] = false;
                _collapseDesc(k);
            });
        }

        // 한 노드 → <tr>(전 컬럼). idx=가상스크롤 절대 인덱스(zebra). 토글=펼침상태만 바꾸고 평탄목록 재세팅.
        function _treeRow(node, depth, idx) {
            var kids = node.APPF4HIER || [];
            var bHasKids = kids.length > 0;
            var bExp = sTreeFilter ? true : !!oExpand[node._uid];
            var tr = _el("tr");
            if (idx % 2 === 1) { tr.setAttribute("data-odd", "true"); }
            if (_isRoot(node)) { tr.classList.add("is-root"); }
            if (bHasKids) { tr.setAttribute("aria-expanded", bExp ? "true" : "false"); }
            tr.addEventListener("click", function () { _vs2.setSel(node._uid); _vs2.refresh(); });
            tr.addEventListener("dblclick", function () { if (!_isRoot(node)) { _pick(node); } });
            T2_COLS.forEach(function (c, idx) {
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
                            // 접기/펼치기 시 기존 선택은 해제(접힌 노드에 가려진 유령 선택 방지).
                            _vs2.setSel(null);
                            // 가상 스크롤: 펼침상태만 바꾸고 평탄목록 재계산 → 보이는 행만 렌더(대용량도 즉시).
                            _vs2.setRows(_flattenTree(), true);
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
                _applyFrz(td, idx, T2_FRZN, T2_FRZ_LEFT);
                tr.appendChild(td);
            });
            return tr;
        }

        // 펼침/필터 상태 기준 "보이는 노드"를 평탄화 → [{node, depth}] (DOM 없이, 빠름).
        function _flattenTree() {
            var out = [];
            function walk(node, depth) {
                // 검색 시: 자기 또는 하위에 매칭이 없으면 숨김(빈 부모 패키지·최상위 컨테이너 모두).
                //   매칭이 하나도 없으면 root 까지 빠져 빈 목록 → 공통 no-data 문구 표시.
                if (sTreeFilter && !_subtreeHasMatch(node)) { return; }
                out.push({ node: node, depth: depth });
                var bExp = sTreeFilter ? true : !!oExpand[node._uid];
                if (bExp && (node.APPF4HIER || []).length) {
                    node.APPF4HIER.forEach(function (k) { walk(k, depth + 1); });
                }
            }
            aTreeRoot.forEach(function (n) { walk(n, 0); });
            return out;
        }
        function _buildTreeRow(item, i) { return _treeRow(item.node, item.depth, i); }

        // 전체 렌더(로드/필터/Expand·Collapse all) = 평탄목록을 가상 스크롤러에 세팅.
        function _renderTree() { _vs2.setRows(_flattenTree()); }

        function _treeExpandAll(bExpand) {
            // 가상 스크롤이라 전체 펼침/접힘도 즉시(보이는 행만 렌더) — busy 불필요.
            function walkAll(n) { oExpand[n._uid] = bExpand; (n.APPF4HIER || []).forEach(walkAll); }
            aTreeRoot.forEach(walkAll);
            if (!bExpand) { aTreeRoot.forEach(function (n) { oExpand[n._uid] = true; }); } // 루트는 펼친 채
            _renderTree();
        }

        var _vs2 = _makeVScroller(oT2Wrap, oT2Body, {
            colCount: T2_COLS.length, buildRow: _buildTreeRow, nodata: MSG_NODATA,
            getSelKey: function (item) { return item.node._uid; }
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
                    aTreeRoot.forEach(function (n) { oExpand[n._uid] = true; }); // 최초 1레벨
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
            oAPP.fn.fnCheckAppExists(sAPPID, function (oRes) {
                var info = (oRes && oRes.RETURN) || {};
                if (oRes && oRes.RETCD === "E") {
                    parent.setBusy(""); _flash();
                    _msg("E", _txt("/U4A/MSG_WS", "007", info.APPID || sAPPID));
                    return;
                }
                if (info.APPTY === "U") { parent.setBusy(""); _msg("E", _txt("/U4A/MSG_WS", "189")); return; }
                if (info.ACTST === "I") { parent.setBusy(""); _msg("E", _wsTxt("434")); return; }
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

            lf_close();                                             // ② setVisible(false) 대응(숨김·상태보존)
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
            _selectTab("K1");
            if (!oDlg.open) { try { oDlg.showModal(); } catch (e) { } }
            try { oApp.input.focus(); } catch (e) { }
            if (opt && opt.autoSearch) { _doSearch(); }
        };

        // WS20→WS10 back 복귀 시 재표시(검색/탭/상태 그대로 — 원본 setVisible(true) 대응).
        //   호출은 셸 fnOnMoveToPage("WS10") 분기가 _pendingReshow 인 인스턴스에 한해 수행.
        oDlg._appf4Reshow = function () {
            oDlg._pendingReshow = false;
            if (!oDlg.open) { try { oDlg.showModal(); } catch (e) { } }
        };

        document.body.appendChild(oDlg);
        _selectTab("K1");
        try { _renderT1(); } catch (e) { }   // 초기 헤더(+no-data) 렌더(검색 전에도 컬럼 표시)
        oDlg.showModal();
        try { oApp.input.focus(); } catch (e) { }

        if (options.autoSearch) { _doSearch(); }

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
            ".u4aAppF4TBarSep{width:.0625rem;height:1.25rem;background:var(--line);margin:0 .25rem;}",
            /* overflow-anchor:none — 가상 스크롤이 뷰포트 위 DOM 을 매 틱 재생성할 때
               Chromium scroll-anchoring 이 scrollTop 을 되돌려 휠이 안 먹는 현상 차단(Chromium93 지원). */
            ".u4aAppF4TblWrap{flex:1 1 auto;min-height:0;overflow:auto;overflow-anchor:none;overscroll-behavior:contain;border:.0625rem solid var(--line);border-radius:var(--radius);background:var(--surface);}",
            ".u4aAppF4Tbl,.u4aAppF4Tbl *{overflow-anchor:none;}",
            /* 공통 .u4a-table(--compact) 소비 — 다열은 컬럼폭 합만큼 늘려 가로 스크롤 */
            /* ★ border-collapse:separate — collapse 면 Chromium 이 셀 z-index 를 무시해서
               가로 스크롤 시 뒤 컬럼이 고정 컬럼 위에 그려져 글자가 겹친다. separate 로 바꿔야
               sticky 고정 셀의 z-index 가 먹어 스크롤 셀을 가린다. 하단 보더만 쓰므로 모양 동일. */
            /* 트리테이블 텍스트 크기 — 다른 트리(.u4a-tree 0.8125rem)와 동일하게(2026-06-23 트리 통일).
               다이얼로그 기본(0.875rem) 상속 시 App-F4 트리만 14px 로 커 보였음. 행높이는 테이블(.u4a-table) 표준 유지. */
            /* 폰트는 공통 .u4a-table(다이얼로그 14px 상속) 기준 — F4 전용 축소(font-size:.8125rem) 제거(타 테이블과 통일). */
            ".u4aAppF4Dlg .u4aAppF4Tbl{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl th.is-center,.u4aAppF4Dlg .u4aAppF4Tbl td.is-center{text-align:center;}",
            ".u4aAppF4Dlg .u4aAppF4Tbl th.is-action,.u4aAppF4Dlg .u4aAppF4Tbl td.is-action{text-align:center;width:4.5rem;padding-left:.25rem;padding-right:.25rem;}",
            /* 모든 셀 수직 중앙(액션 아이콘이 텍스트와 어긋나지 않게) */
            ".u4aAppF4Dlg .u4aAppF4Tbl td{vertical-align:middle;}",
            ".u4aAppF4ActBtn{width:1.5rem;height:1.5rem;}",
            ".u4aAppF4ActBtn i{font-size:.75rem;}",
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
            /* ── 고정 컬럼(가로 스크롤 시 좌측 N개 sticky) — 탭1(3개)·트리(2개) 공통, `.is-frz` 클래스 기반 ──
               각 셀에 JS(_applyFrz)가 `.is-frz`(+마지막 `.is-frz-last`)와 inline `left`(누적폭)를 부여.
               아래 머신(positioned·z-index·배경·경계선)은 .u4aAppF4Tbl 스코프로 두 테이블이 공유한다.
               층위: 헤더 고정셀 z3 > 본문 고정셀 z2 > 일반 헤더 z1 > 일반 셀 z0. */
            /* ★ 본문 스크롤 셀도 positioned(relative) — static 셀은 sticky 고정셀과 stacking 비교가 안 돼
               테이블 페인트 순서상 고정셀 위에 그려져 겹친다(헤더는 전 셀 sticky라 안 겹쳤음). relative 면 z-index 먹음. */
            ".u4aAppF4Tbl tbody tr:not(.u4aVSpacer)>td{position:relative;}",
            ".u4aAppF4Tbl thead th.is-frz,.u4aAppF4Tbl tbody tr:not(.u4aVSpacer)>td.is-frz{position:sticky;z-index:2;}",
            ".u4aAppF4Tbl thead th.is-frz{z-index:3;}",
            /* ★ 고정 셀 상태별 불투명 배경 — 반투명 토큰(hover/active/selected)은 linear-gradient(단색 이미지)
               레이어로 깔고 var(--surface)(불투명)를 최종 color 레이어로(그냥 `색,색` 은 무효 CSS→드롭).
               → surface 위 오버레이 1회만 = 스크롤 영역과 동일 + 불투명(이중합성·비침 차단). */
            ".u4aAppF4Tbl tbody tr:not(.u4aVSpacer)>td.is-frz{background:var(--surface);}",
            ".u4aAppF4Tbl tbody tr[data-odd=\"true\"]>td.is-frz,.u4aAppF4Tbl tbody tr:hover>td.is-frz{background:linear-gradient(var(--hover-bg),var(--hover-bg)),var(--surface);}",
            ".u4aAppF4Tbl tbody tr[data-odd=\"true\"]:hover>td.is-frz{background:linear-gradient(var(--active-bg),var(--active-bg)),var(--surface);}",
            ".u4aAppF4Tbl tbody tr[aria-selected=\"true\"]>td.is-frz,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"][data-odd=\"true\"]>td.is-frz,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"]:hover>td.is-frz,.u4aAppF4Tbl tbody tr[aria-selected=\"true\"][data-odd=\"true\"]:hover>td.is-frz{background:linear-gradient(var(--selected-bg),var(--selected-bg)),var(--surface);}",
            /* 고정 경계선 — 마지막 고정 컬럼 우측 */
            ".u4aAppF4Tbl thead th.is-frz-last,.u4aAppF4Tbl tbody tr:not(.u4aVSpacer)>td.is-frz-last{box-shadow:inset -0.0625rem 0 0 var(--line);}",
            /* 트리 App Views(마지막 고정)만 폭 확보+우측 여백(헤더 텍스트가 세로 고정선에 안 붙게).
               탭1 App Views(액션 4.5rem)는 그대로 — 트리 스코프로 한정. */
            ".u4aAppF4Dlg .u4aAppF4Tree thead th.is-frz-last,.u4aAppF4Dlg .u4aAppF4Tree tbody tr:not(.u4aVSpacer)>td.is-frz-last{width:6.5rem;padding-right:.85rem;}",
            /* 가상 스크롤 스페이서 행 — hover/zebra/선택 표시 없음 */
            ".u4aAppF4Dlg .u4aVSpacer,.u4aAppF4Dlg .u4aVSpacer:hover{background:transparent;cursor:default;}",
            ".u4aAppF4Dlg .u4aVSpacer td{padding:0;border:0;}",
            /* 가상 스크롤 떨림 방지 — 데이터 행(스페이서 제외)을 측정된 정수 높이로 강제.
               total*ROWH 와 실제 높이를 정확히 일치시켜 끝단 scrollHeight 흔들림 제거. */
            ".u4aAppF4TblWrap tbody tr:not(.u4aVSpacer)>td{height:var(--u4a-vsrowh,auto);box-sizing:border-box;}",
            /* 컬럼 헤더 정렬/필터 메뉴 (ServerList 패턴 — 공통 .u4a-menu 위에 덧입힘) */
            ".u4aAppF4Tbl thead th.u4a-th--menu{cursor:pointer;}",
            ".u4aAppF4Tbl thead th.u4a-th--menu:hover{background:var(--hover-bg);color:var(--text);}",
            ".u4aAppF4Tbl .u4a-th__inner{display:flex;align-items:center;gap:.35rem;min-width:0;}",
            ".u4aAppF4Tbl .u4a-th__inner--center{justify-content:center;}",
            ".u4aAppF4Tbl .u4a-th__label{overflow:hidden;text-overflow:ellipsis;}",
            ".u4aAppF4Tbl .u4a-th__ind{display:inline-flex;align-items:center;gap:.25rem;flex:0 0 auto;color:var(--accent);}",
            ".u4aAppF4Tbl .u4a-th__ind i{font-size:.8rem;line-height:1;}",
            ".u4aAppF4Dlg .u4a-colmenu{min-width:13rem;}",
            ".u4aAppF4Dlg .u4a-colmenu__filter{padding:.25rem;}",
            ".u4aAppF4Dlg .u4a-colmenu__filter .u4a-input{width:100%;box-sizing:border-box;}",
            ".u4aAppF4Dlg .u4a-colmenu__sep{height:.0625rem;margin:.25rem 0;background:var(--line);}",
            ".u4aAppF4Dlg .u4a-colmenu .u4a-menu__item[data-active=\"true\"]{color:var(--accent);font-weight:600;}",
            ".u4aAppF4Dlg .u4a-colmenu .u4a-menu__item[data-active=\"true\"] i{color:var(--accent);}"
        ].join("\n");
        document.head.appendChild(s);
    }

})(window, $, oAPP);
