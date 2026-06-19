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

    /* ── 공통 입력 필드(.u4a-field + clear X) ─────────────────────── */
    function _mkField(sVal, opt) {
        opt = opt || {};
        var wrap = _el("div", "u4a-field u4aAppF4Field");
        wrap.setAttribute("data-trail", "1");
        if (opt.w) { wrap.style.width = opt.w; }
        var inp = _el("input", "u4a-input u4a-field__input");
        inp.type = opt.type || "text";
        inp.value = (sVal == null ? "" : String(sVal));
        if (opt.ph) { inp.placeholder = opt.ph; }
        if (opt.disabled) { inp.disabled = true; }
        var clr = _el("button", "u4a-field__clear");
        clr.type = "button"; clr.tabIndex = -1; clr.innerHTML = _fa("xmark");
        wrap.append(inp, clr);
        try { if (window.U4AUI && U4AUI.attachClear) { U4AUI.attachClear(inp, clr); } } catch (e) { }
        // 대문자 필드(패키지/사용자/웹앱ID) — 커서 보존 업서치.
        if (opt.upper) {
            inp.addEventListener("input", function () {
                var s = inp.selectionStart, e = inp.selectionEnd;
                var up = inp.value.toUpperCase();
                if (up !== inp.value) { inp.value = up; try { inp.setSelectionRange(s, e); } catch (x) { } }
            });
        }
        if (opt.onEnter) {
            inp.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter") { ev.preventDefault(); opt.onEnter(); }
            });
        }
        return { wrap: wrap, input: inp };
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

        // 중복 방지(이미 떠 있으면 닫고 새로).
        var oOld = document.getElementById("u4aAppF4Dlg");
        if (oOld) { try { oOld.close(); } catch (e) { } oOld.remove(); }

        // 팝업 상태(스코프 변수로 보관).
        var aResult = [];           // 탭1 검색결과
        var aTreeRoot = [];         // 탭2 트리 루트
        var oExpand = {};           // 트리 펼침 상태(노드 _uid → bool)
        var bTreeLoaded = false;
        var sTreeFilter = "";
        var _uidSeq = 0;

        /* ── 다이얼로그 골격 ─────────────────────────────────────── */
        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aAppF4Dlg";
        oDlg.id = "u4aAppF4Dlg";

        function lf_close() { try { oDlg.close(); } catch (e) { } try { oDlg.remove(); } catch (e) { } }

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

        var oSrchBar = _el("div", "u4aAppF4SrchBar");
        var oSrchTitle = _el("div", "u4aAppF4SrchTitle", "[U4A] " + _txt("/U4A/CL_WS_COMMON", "B94"));
        var oSrchBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oSrchBtn.type = "button";
        oSrchBtn.innerHTML = _fa("magnifying-glass") + "<span></span>";
        oSrchBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A75"); // Search
        oSrchBtn.addEventListener("click", _doSearch);
        oSrchBar.append(oSrchTitle, _el("span", "u4aAppF4Spacer"), oSrchBtn);

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

        var oT1Wrap = _el("div", "u4aAppF4TblWrap");
        var oT1 = _el("table", "u4aAppF4Tbl");
        var oT1Head = _el("thead");
        var oT1Hr = _el("tr");
        T1_COLS.forEach(function (c) {
            var th = _el("th", c.align === "center" ? "is-center" : null,
                c.action ? (c.action === "run" ? _wsTxt("436") : _wsTxt("564")) : c.label);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            oT1Hr.appendChild(th);
        });
        oT1Head.appendChild(oT1Hr);
        var oT1Body = _el("tbody");
        oT1.append(oT1Head, oT1Body);
        oT1Wrap.appendChild(oT1);
        var oT1Empty = _el("div", "u4aAppF4Empty", "—");
        oT1Empty.hidden = true;
        oT1Wrap.appendChild(oT1Empty);

        oPage1.append(oForm, oSrchBar, oT1Wrap);

        function _renderT1() {
            oT1Body.textContent = "";
            oT1Empty.hidden = aResult.length > 0;
            aResult.forEach(function (row) {
                var tr = _el("tr");
                tr.addEventListener("dblclick", function () { _pick(row); });
                T1_COLS.forEach(function (c) {
                    var td = _el("td", c.align === "center" ? "is-center" : null);
                    if (c.action === "run") {
                        td.classList.add("is-action");
                        td.appendChild(_actBtn("globe", _wsTxt("436"), function (e) { e.stopPropagation(); _doRun(row); }));
                    } else if (c.action === "disp") {
                        td.classList.add("is-action");
                        var b = _actBtn("desktop", _wsTxt("564"), function (e) { e.stopPropagation(); _doDisplay(row); });
                        if (!bWS10) { b.disabled = true; }
                        td.appendChild(b);
                    } else {
                        var v = row[c.key];
                        td.textContent = c.fmt ? c.fmt(v) : (v == null ? "" : String(v));
                    }
                    tr.appendChild(td);
                });
                oT1Body.appendChild(tr);
            });
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

        var oTBar = _el("div", "u4aAppF4TreeBar");
        var oExpandBtn = _actBtn("angles-down", "Expand", function () { _treeExpandAll(true); });
        oExpandBtn.title = "Expand";
        var oCollapseBtn = _actBtn("angles-up", "Collapse", function () { _treeExpandAll(false); });
        oCollapseBtn.title = "Collapse";
        var oTSrch = _mkField("", { w: "16rem", ph: _wsTxt("565") }); // 어플리케이션 검색
        oTSrch.input.addEventListener("input", function () {
            sTreeFilter = oTSrch.input.value.trim().toUpperCase();
            _renderTree();
        });
        oTBar.append(oExpandBtn, oCollapseBtn, _el("span", "u4aAppF4TBarSep"), oTSrch.wrap);

        var oT2Wrap = _el("div", "u4aAppF4TblWrap u4aAppF4TreeWrap");
        var oT2 = _el("table", "u4aAppF4Tbl u4aAppF4Tree");
        var oT2Head = _el("thead");
        var oT2Hr = _el("tr");
        T2_COLS.forEach(function (c) {
            var th = _el("th", c.align === "center" ? "is-center" : null, c.action ? _wsTxt("564") : c.label);
            if (c.w) { th.style.width = c.w; }
            if (c.action) { th.classList.add("is-action"); }
            oT2Hr.appendChild(th);
        });
        oT2Head.appendChild(oT2Hr);
        var oT2Body = _el("tbody");
        oT2.append(oT2Head, oT2Body);
        oT2Wrap.appendChild(oT2);
        oPage2.append(oTBar, oT2Wrap);

        function _matchFilter(node) {
            if (!sTreeFilter || _isRoot(node)) { return true; }
            return String(node.APPID || "").toUpperCase().indexOf(sTreeFilter) > -1
                || String(node.APPNM || "").toUpperCase().indexOf(sTreeFilter) > -1;
        }
        // 필터 시: 자신 또는 하위에 매칭이 있으면 표시.
        function _subtreeHasMatch(node) {
            if (!_isRoot(node) && _matchFilter(node)) { return true; }
            var kids = node.APPF4HIER || [];
            for (var i = 0; i < kids.length; i++) { if (_subtreeHasMatch(kids[i])) { return true; } }
            return false;
        }

        function _renderTree() {
            oT2Body.textContent = "";
            function walk(node, depth) {
                if (sTreeFilter && !_isRoot(node) && !_subtreeHasMatch(node)) { return; }
                if (sTreeFilter && _isRoot(node)) {
                    // 루트는 하위 매칭 있을 때만 표시(없으면 자식만 그릴 일도 없음)
                }
                var kids = node.APPF4HIER || [];
                var bHasKids = kids.length > 0;
                var bExp = sTreeFilter ? true : !!oExpand[node._uid];
                var tr = _el("tr");
                if (_isRoot(node)) { tr.classList.add("is-root"); }
                tr.addEventListener("dblclick", function () { if (!_isRoot(node)) { _pick(node); } });
                T2_COLS.forEach(function (c) {
                    var td = _el("td", c.align === "center" ? "is-center" : null);
                    if (c.tree) {
                        td.classList.add("u4aAppF4TreeCell");
                        var ind = _el("span", "u4aAppF4Indent");
                        ind.style.width = (depth * 1.25) + "rem";
                        var tog = _el("button", "u4aAppF4Toggle");
                        tog.type = "button";
                        if (bHasKids) {
                            tog.innerHTML = _fa(bExp ? "chevron-down" : "chevron-right");
                            tog.addEventListener("click", function (e) {
                                e.stopPropagation();
                                oExpand[node._uid] = !oExpand[node._uid];
                                _renderTree();
                            });
                        } else { tog.classList.add("is-leaf"); }
                        var lbl = _el("span", "u4aAppF4TreeLabel", _isRoot(node) ? (node.APPNM || "ROOT") : (node.APPNM || ""));
                        td.append(ind, tog, lbl);
                    } else if (c.action === "disp") {
                        td.classList.add("is-action");
                        var b = _actBtn("desktop", _wsTxt("564"), function (e) { e.stopPropagation(); _doTreeDisplay(node); });
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
                oT2Body.appendChild(tr);
                if (bExp && bHasKids) { kids.forEach(function (k) { walk(k, depth + 1); }); }
            }
            aTreeRoot.forEach(function (n) { walk(n, 0); });
        }

        function _treeExpandAll(bExpand) {
            function walkAll(n) { oExpand[n._uid] = bExpand; (n.APPF4HIER || []).forEach(walkAll); }
            aTreeRoot.forEach(walkAll);
            if (!bExpand) { aTreeRoot.forEach(function (n) { oExpand[n._uid] = true; }); } // 루트는 펼친 채
            _renderTree();
        }

        // flat T_APPL → nested(APPF4HIER), 원본 _appF4Tree 규칙.
        function _buildTree(aRaw) {
            var arr = (aRaw || []).slice().sort(function (a, b) { return String(a.APPID).localeCompare(String(b.APPID)); });
            var mLookup = {};
            arr.forEach(function (n) {
                n._uid = ++_uidSeq; n.APPF4HIER = [];
                if (!mLookup[n.APPID] || n.PACKG === "" || n.PACKG === "ROOT") { mLookup[n.APPID] = n; }
            });
            arr.forEach(function (n) {
                var par = mLookup[n.PACKG];
                if (par && par !== n) { par.APPF4HIER.push(n); }
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
            try { if (typeof fnCallback === "function") { fnCallback(row); } } catch (e) { }
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

        // WS10 Display 모드(원본 _navToWS20Display: 입력값 세팅 + Display 발화).
        function _doDisplay(row) {
            var sAPPID = row && row.APPID;
            if (!sAPPID || !bWS10) { return; }
            var inp = document.getElementById("AppNmInput");
            if (inp) {
                inp.value = sAPPID;
                try { inp.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { }
            }
            lf_close();
            try { if (oAPP.events && oAPP.events.ev_AppDisplay) { oAPP.events.ev_AppDisplay(); } } catch (e) { }
        }

        // 트리: 실행 불가(자식 있음/ROOT/APPID 없음) 가드.
        function _treeRunnable(node) {
            if (!node || !node.APPID || node.APPID === "ROOT") { return false; }
            if ((node.APPF4HIER || []).length > 0) { return false; }
            return true;
        }
        function _doTreeRun(node) {
            if (!_treeRunnable(node)) { _flash(); _msg("E", _wsTxt("435")); return; }
            _doRun(node);
        }
        function _doTreeDisplay(node) {
            if (!_treeRunnable(node)) { _flash(); _msg("E", _wsTxt("435")); return; }
            _doDisplay(node);
        }

        /* ── 오픈 ────────────────────────────────────────────────── */
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });
        if (window.U4AUI) {
            try { U4AUI.makeDialogDraggable && U4AUI.makeDialogDraggable(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogRecenter && U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogResizable && U4AUI.makeDialogResizable(oDlg, { minW: 720, minH: 420 }); } catch (e) { }
        }

        document.body.appendChild(oDlg);
        _selectTab("K1");
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
            ".u4aAppF4SrchBar{flex:0 0 auto;display:flex;align-items:center;gap:.5rem;padding-top:.25rem;border-top:.0625rem solid var(--divider);}",
            ".u4aAppF4SrchTitle{font-weight:700;color:var(--text);}",
            ".u4aAppF4Spacer{flex:1 1 auto;}",
            ".u4aAppF4TreeBar{flex:0 0 auto;display:flex;align-items:center;gap:.375rem;}",
            ".u4aAppF4TBarSep{width:.0625rem;height:1.25rem;background:var(--line);margin:0 .25rem;}",
            ".u4aAppF4TblWrap{flex:1 1 auto;min-height:0;overflow:auto;border:.0625rem solid var(--line);border-radius:var(--radius);background:var(--surface);}",
            ".u4aAppF4Tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:.8125rem;}",
            ".u4aAppF4Tbl th,.u4aAppF4Tbl td{padding:.4375rem .625rem;text-align:left;white-space:nowrap;border-bottom:.0625rem solid var(--line);}",
            ".u4aAppF4Tbl thead th{position:sticky;top:0;z-index:1;background:var(--surface-raised);color:var(--text-muted);font-weight:700;border-bottom:.0625rem solid var(--divider);}",
            ".u4aAppF4Tbl th.is-center,.u4aAppF4Tbl td.is-center{text-align:center;}",
            ".u4aAppF4Tbl th.is-action,.u4aAppF4Tbl td.is-action{text-align:center;width:5rem;}",
            ".u4aAppF4Tbl tbody tr:hover{background:var(--hover-bg);}",
            ".u4aAppF4Tbl tbody tr:nth-child(even){background:var(--app-bg);}",
            ".u4aAppF4Tbl tbody tr:nth-child(even):hover{background:var(--hover-bg);}",
            ".u4aAppF4ActBtn{width:1.75rem;height:1.75rem;}",
            ".u4aAppF4ActBtn i{font-size:.8125rem;}",
            ".u4aAppF4Empty{padding:2rem;text-align:center;color:var(--text-muted);}",
            ".u4aAppF4TreeCell{display:flex;align-items:center;}",
            ".u4aAppF4Indent{flex:0 0 auto;}",
            ".u4aAppF4Toggle{flex:0 0 auto;width:1.25rem;height:1.25rem;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--icon-muted);cursor:pointer;border-radius:var(--radius-sm);}",
            ".u4aAppF4Toggle:hover{background:var(--hover-bg);color:var(--text);}",
            ".u4aAppF4Toggle.is-leaf{visibility:hidden;}",
            ".u4aAppF4Toggle i{font-size:.6875rem;}",
            ".u4aAppF4TreeLabel{margin-left:.25rem;overflow:hidden;text-overflow:ellipsis;}",
            ".u4aAppF4Tbl tbody tr.is-root>td{font-weight:700;background:var(--surface-raised);}",
            ".u4aAppF4Link{color:var(--link);font-weight:600;cursor:pointer;}",
            ".u4aAppF4Link:hover{text-decoration:underline;}"
        ].join("\n");
        document.head.appendChild(s);
    }

})(window, $, oAPP);
