/**************************************************************************
 * callDataSetFieldListPopop.js  (HTML5)
 * ------------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: Node CJS 모듈(global[0].sap/oAPP/sendAjax) + sap.m.Dialog + sap.ui.table.Table
 *        (DataSet "검색조건 필드 선택" B30 — MultiToggle 체크박스 멀티선택 + Token + 전체선택/해제).
 *  HTML5: design 컨텍스트 스크립트(createApplicationPopup 의 lf_getScript 로 eval 로드) →
 *        oAPP.fn._DATASET = { callDataSetFieldListPopop }. native <dialog class="u4a-dialog"> +
 *        공통 .u4a-table 멀티선택(체크박스 열 + 헤더 전체선택 + 토큰칩, CSS/JS Link Add §4-14 패턴)
 *        + makeDialogDraggable/Resizable/Recenter. sap.* / global[0] 의존 전부 제거.
 *
 *  ★ 로직/반환 계약 보존(원본 1:1):
 *   - _chkDataset: POST {servNm}/getDataSetSearchList (TABNM, TABTY=V|T) → {RETCD, TDESC, T_LIST:[
 *        {TABNM,FLDNM,FLDTX,FLDTT,ISKEY("X"),ENAB01("")}]}.
 *   - 반환: {RETCD:"E"}(TABNM 없음/서버 E) / {RETCD:"C",RTMSG:001}(닫기·취소) /
 *          {RETCD:"S",TDESC,FLIST(선택 FLDNM 을 "|" 로 조인)}.
 *   - 확인 검증(원본 lf_chkList): 결과 없음(227) / 미선택(268) / 30건 초과(300).
 *   - sap.ui.getCore().lock/unlock 은 제거(부모 setBusy 가 시각 잠금 담당).
 **************************************************************************/
(function () {
    "use strict";

    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (txt != null) { o.textContent = txt; }
        return o;
    }

    // 메시지 텍스트(원본 fnGetMsgClsText). oAPP 는 호출 시 전달(디자인 컨텍스트).
    function _txt(oAPP, sCls, sCode, p1) {
        try { return oAPP.common.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); } catch (e) { return sCode; }
    }
    // 공통 no-data(946) — ZMSG_WS_COMMON_001, 워크스페이스 언어.
    function _wsTxt(sNo) {
        try {
            var sLangu = (parent.getUserInfo() || {}).LANGU;
            return parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sNo);
        } catch (e) { return sNo; }
    }
    // 공통 토스트(셸 showMessage KIND 10) — 형제 멀티선택 팝업(CssJsLink/동일속성동기화)과 동일 전달.
    function _toast(sType, sText) { try { parent.showMessage(null, 10, sType || "I", sText); } catch (e) { } }


    /* ── 스코프 스타일 1회 주입(토큰 기반, 공통 컴포넌트와 일관) ── */
    function _ensureStyle() {
        if (document.getElementById("u4aDsFldStyle")) { return; }
        var s = document.createElement("style");
        s.id = "u4aDsFldStyle";
        s.textContent = [
            ".u4aDsFldDlg{width:min(92vw,720px);height:min(84vh,600px);padding:0;display:flex;flex-direction:column;}",
            ".u4aDsFldDlg .u4a-dialog__header{cursor:move;user-select:none;}",
            ".u4aDsFldDlg .u4a-dialog__header span{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
            ".u4aDsFldBody{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:.5rem;padding:.75rem;}",
            /* 툴바 */
            ".u4aDsFldBar{flex:0 0 auto;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;}",
            ".u4aDsFldSep{width:.0625rem;height:1.25rem;background:var(--line);margin:0 .25rem;}",
            ".u4aDsFldSpacer{flex:1 1 auto;}",
            ".u4aDsFldSel{color:var(--text);font-weight:600;white-space:nowrap;}",
            ".u4aDsFldTot{color:var(--text-muted);font-weight:700;white-space:nowrap;}",
            /* 멀티선택 테이블 */
            ".u4aDsFldTableWrap{flex:1 1 auto;min-height:0;overflow:auto;}",
            /* 체크박스·키필드 열=가운데. ★공통 .u4a-table thead th{text-align:left}(0,1,2)를 이기려 특이도 상향
               (.u4aDsFldTable 선행 → 0,2,0) — 안 그러면 헤더 체크박스/"키필드"는 좌측, 바디는 가운데로 어긋남. */
            ".u4aDsFldTable .u4aDsFldColChk{width:2.75rem;text-align:center;}",
            ".u4aDsFldTable .u4aDsFldColKey{width:5rem;text-align:center;}",
            /* 셀 말줄임/툴팁은 공통 .u4a-table(tbody td nowrap+ellipsis + 자동 data-tip-trunc)에 위임 — 커스텀 override 안 함 */
            ".u4aDsFldTable tr[data-disabled=\"true\"]{opacity:.55;}",
            ".u4aDsFldRowChk,.u4aDsFldHeadChk,.u4aDsFldKeyChk{width:1rem;height:1rem;accent-color:var(--accent);margin:0;}",
            ".u4aDsFldRowChk,.u4aDsFldHeadChk{cursor:pointer;}",
            /* ★방어 — 이 테이블 셀에 예기치 않은 ::before/::after 글리프(점/프리픽스)가 붙는 것 차단.
               형제 CssJsLink(.u4aCslTable td::before/::after{content:none})와 동일 이슈 — 체크박스 옆 "점"의 정체. */
            ".u4aDsFldTable td::before,.u4aDsFldTable td::after{content:none !important;}",
            /* 선택 필드 토큰(칩) */
            ".u4aDsFldTokens{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:.375rem;max-height:5.5rem;overflow:auto;}",
            ".u4aDsFldTokens:empty{display:none;}",
            ".u4aDsFldTok{display:inline-flex;align-items:center;gap:.375rem;padding:.1875rem .5rem;border:.0625rem solid var(--divider);border-radius:1rem;background:var(--surface-raised);color:var(--text);font-size:.8125rem;}",
            ".u4aDsFldTokX{border:0;background:transparent;color:var(--text-muted);cursor:pointer;padding:0;line-height:1;font-size:.75rem;}",
            ".u4aDsFldTokX:hover{color:var(--state-error);}",
            ""
        ].join("\n");
        document.head.appendChild(s);
    }

    /* ── 서버 조회: view(table)명의 검색조건 필드 리스트 (원본 lf_chkdataset) ── */
    function _chkDataset(is_dataSet) {
        return new Promise(function (resolve) {
            // VIEW(TABLE)명 미입력이면 EXIT.
            if (!is_dataSet || !is_dataSet.TABNM || is_dataSet.TABNM === "") {
                resolve({ RETCD: "E" });
                return;
            }
            parent.setBusy("X");
            var fd = new FormData();
            fd.append("TABNM", is_dataSet.TABNM);
            var l_TABTY = is_dataSet.RB01 ? "V" : (is_dataSet.RB02 ? "T" : "");   // V=Database View / T=Transparent Table
            fd.append("TABTY", l_TABTY);
            try {
                sendAjax(parent.getServerPath() + "/getDataSetSearchList", fd, function (ret) {
                    parent.setBusy("");
                    resolve(ret || { RETCD: "E" });
                });
            } catch (e) { parent.setBusy(""); resolve({ RETCD: "E" }); }
        });
    }

    /* ── T_LIST → 렌더 행(원본 lf_setBindList) ── */
    function _setBindList(T_LIST) {
        if (!T_LIST || !T_LIST.length) { return []; }
        var out = [];
        for (var i = 0; i < T_LIST.length; i++) {
            var r = T_LIST[i];
            out.push({
                TABNM: r.TABNM, FLDNM: r.FLDNM, FLDTX: r.FLDTX, FLDTT: r.FLDTT,
                isKey: r.ISKEY === "X",
                ENAB_SEL: r.ENAB01 !== "",   // ENAB01==="" 면 선택 불가(원본 동일)
                SEL: false
            });
        }
        return out;
    }

    /* ====================================================================
     * 메인 — 검색조건 필드 선택 팝업(원본 exports.callDataSetFieldListPopop)
     * ================================================================== */
    async function _run(is_dataSet, oAPP, resolve) {

        _ensureStyle();

        // 입력 TABLE명에 해당하는 필드정보 얻기. 못 얻으면 EXIT(원본 동일).
        var ls_ret = await _chkDataset(is_dataSet);
        if (ls_ret.RETCD === "E") { resolve(ls_ret); return; }

        var aRows = _setBindList(ls_ret.T_LIST);

        var bResolved = false;
        function _resolveOnce(o) { if (bResolved) { return; } bResolved = true; resolve(o); }

        // ── 다이얼로그 골격 ──
        var oDlg = _el("dialog", "u4a-dialog u4aDsFldDlg");
        function _close() { try { oDlg.close(); } catch (e) { } try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e) { } }
        function _cancel() {
            _close();
            // 001 Cancel operation
            _resolveOnce({ RETCD: "C", RTMSG: _txt(oAPP, "/U4A/MSG_WS", "001") });
        }

        // 제목: B30(Choose Search Field) + " - " + 컬럼수(E12~E15, SCCNT).
        var sTitle = _txt(oAPP, "/U4A/CL_WS_COMMON", "B30");
        var sColKey = ["E12", "E13", "E14", "E15"][is_dataSet.SCCNT || 0];
        if (sColKey) { sTitle += " - " + _txt(oAPP, "/U4A/CL_WS_COMMON", sColKey); }

        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("list-check") + "<span></span>";
        oHeader.querySelector("span").textContent = sTitle;
        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button"; oXBtn.setAttribute("data-act", "close");
        oXBtn.title = _txt(oAPP, "/U4A/CL_WS_COMMON", "A39"); oXBtn.innerHTML = _fa("xmark");  // Close
        oXBtn.addEventListener("click", _cancel);
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        var oBody = _el("div", "u4a-dialog__body u4aDsFldBody");
        oDlg.appendChild(oBody);

        // ── 툴바: [전체선택][해제] | 선택수 … 총건수 ──
        var oBar = _el("div", "u4aDsFldBar");

        var oSelAllBtn = _el("button", "u4a-btn");   // 툴바 보조액션 → 기본 톤(강조=주요 액션[확인]만, btn-color-semantics)
        oSelAllBtn.type = "button";
        oSelAllBtn.innerHTML = _fa("check-double") + "<span></span>";
        oSelAllBtn.querySelector("span").textContent = _txt(oAPP, "/U4A/CL_WS_COMMON", "B33"); // Select All
        oSelAllBtn.addEventListener("click", function () { _selectAll(true); });
        oBar.appendChild(oSelAllBtn);

        var oClrBtn = _el("button", "u4a-btn");
        oClrBtn.type = "button";
        oClrBtn.innerHTML = _fa("xmark") + "<span></span>";
        oClrBtn.querySelector("span").textContent = _txt(oAPP, "/U4A/CL_WS_COMMON", "B23"); // Clear selection
        oClrBtn.addEventListener("click", function () { _selectAll(false); });
        oBar.appendChild(oClrBtn);

        oBar.appendChild(_el("span", "u4aDsFldSep"));
        var oSelLb = _el("span", "u4aDsFldSel");
        oBar.appendChild(oSelLb);
        oBar.appendChild(_el("span", "u4aDsFldSpacer"));
        var oTotLb = _el("span", "u4aDsFldTot");
        oBar.appendChild(oTotLb);
        oBody.appendChild(oBar);

        // ── 테이블(공통 .u4a-table + 멀티선택 체크박스 열) ──
        var oWrap = _el("div", "u4a-table-wrap u4a-table-wrap--boxed u4aDsFldTableWrap");
        var oTable = _el("table", "u4a-table u4aDsFldTable");
        var oThead = _el("thead");
        var oHtr = _el("tr");
        var oThChk = _el("th", "u4aDsFldColChk");
        var oHeadChk = _el("input"); oHeadChk.type = "checkbox"; oHeadChk.className = "u4aDsFldHeadChk";
        oHeadChk.title = _txt(oAPP, "/U4A/CL_WS_COMMON", "B33");
        oHeadChk.addEventListener("change", function () { _selectAll(oHeadChk.checked); });
        oThChk.appendChild(oHeadChk);
        oHtr.appendChild(oThChk);
        oHtr.appendChild(_el("th", null, _txt(oAPP, "/U4A/CL_WS_COMMON", "D68")));                 // Field Name
        oHtr.appendChild(_el("th", "u4aDsFldColKey", _txt(oAPP, "/U4A/CL_WS_COMMON", "E16")));      // Key Field
        oHtr.appendChild(_el("th", null, _txt(oAPP, "/U4A/CL_WS_COMMON", "A35")));                  // Description
        oThead.appendChild(oHtr);
        var oTbody = _el("tbody");
        oTable.append(oThead, oTbody);
        oWrap.appendChild(oTable);
        oBody.appendChild(oWrap);

        // ── 선택 필드 토큰(칩) ──
        var oTokens = _el("div", "u4aDsFldTokens");
        oBody.appendChild(oTokens);

        // ── 푸터: 확인 / 취소(아이콘, 원본 Accept/Reject 톤) ──
        var oFoot = _el("div", "u4a-dialog__footer");
        oFoot.appendChild(_el("span", "u4aDsFldSpacer"));
        var oOkBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oOkBtn.type = "button"; oOkBtn.innerHTML = _fa("check");
        oOkBtn.title = _txt(oAPP, "/U4A/CL_WS_COMMON", "A40"); // Confirm
        oOkBtn.addEventListener("click", function () { _confirm(); });
        oFoot.appendChild(oOkBtn);
        var oCancelBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCancelBtn.type = "button"; oCancelBtn.innerHTML = _fa("xmark");
        oCancelBtn.title = _txt(oAPP, "/U4A/CL_WS_COMMON", "A41"); // Cancel
        oCancelBtn.addEventListener("click", _cancel);
        oFoot.appendChild(oCancelBtn);
        oDlg.appendChild(oFoot);

        /* ── 렌더/상태 함수 ─────────────────────────────────────── */
        function _selCount() { return aRows.filter(function (r) { return r.SEL === true; }).length; }

        function _buildRow(r, idx) {
            var oTr = _el("tr");
            if (idx % 2 === 1) { oTr.setAttribute("data-odd", "true"); }   // zebra — 공통 [data-odd](형제 팝업 동일)
            if (!r.ENAB_SEL) { oTr.setAttribute("data-disabled", "true"); }
            oTr.setAttribute("aria-selected", r.SEL ? "true" : "false");

            // (1) 선택 체크박스
            var oTdChk = _el("td", "u4aDsFldColChk");
            var oChk = _el("input"); oChk.type = "checkbox"; oChk.className = "u4aDsFldRowChk";
            oChk.checked = r.SEL === true;
            oChk.disabled = !r.ENAB_SEL;
            oChk.addEventListener("change", function () {
                r.SEL = oChk.checked;
                oTr.setAttribute("aria-selected", r.SEL ? "true" : "false");
                _afterSelChange();
            });
            r.__chk = oChk;
            oTdChk.appendChild(oChk);
            oTr.appendChild(oTdChk);

            // (2) 필드명 — 말줄임 시 공통 .u4a-table 자동 툴팁(data-tip-trunc). 네이티브 title 금지.
            var oTdNm = _el("td", null, r.FLDNM);
            oTr.appendChild(oTdNm);

            // (3) Key 여부(읽기전용 체크박스)
            var oTdKey = _el("td", "u4aDsFldColKey");
            var oKey = _el("input"); oKey.type = "checkbox"; oKey.className = "u4aDsFldKeyChk";
            oKey.checked = r.isKey === true; oKey.disabled = true;
            oTdKey.appendChild(oKey);
            oTr.appendChild(oTdKey);

            // (4) 설명 — 부가설명(FLDTT)이 있으면 공통 툴팁(data-tip, 항상). 없으면 셀 자동 말줄임 툴팁.
            var oTdTx = _el("td", null, r.FLDTX || "");
            if (r.FLDTT) { oTdTx.setAttribute("data-tip", r.FLDTT); }
            oTr.appendChild(oTdTx);

            return oTr;   // 선택은 체크박스로만(원본 selectionMode:"None" + 체크박스 템플릿과 동일)
        }

        function _renderTable() {
            oTbody.innerHTML = "";
            if (!aRows.length) {
                var oTrN = _el("tr", "u4a-table__nodata");
                var oTdN = _el("td", null, _wsTxt("946"));   // 데이터 없음(공통)
                oTdN.colSpan = 4;
                oTrN.appendChild(oTdN);
                oTbody.appendChild(oTrN);
                return;
            }
            var oFrag = document.createDocumentFragment();
            for (var i = 0; i < aRows.length; i++) { oFrag.appendChild(_buildRow(aRows[i], i)); }
            oTbody.appendChild(oFrag);
        }

        function _renderTokens() {
            oTokens.innerHTML = "";
            aRows.forEach(function (r) {
                if (r.SEL !== true) { return; }
                var oTok = _el("span", "u4aDsFldTok");
                oTok.appendChild(_el("span", null, r.FLDNM));
                var oXt = _el("button", "u4aDsFldTokX");
                oXt.type = "button"; oXt.title = r.FLDNM; oXt.innerHTML = _fa("xmark");
                oXt.addEventListener("click", function () {
                    r.SEL = false;
                    if (r.__chk) { r.__chk.checked = false; var tr = r.__chk.closest("tr"); if (tr) { tr.setAttribute("aria-selected", "false"); } }
                    _afterSelChange();
                });
                oTok.appendChild(oXt);
                oTokens.appendChild(oTok);
            });
        }

        function _updCounts() {
            // E08 Selected lines : n
            oSelLb.textContent = _txt(oAPP, "/U4A/CL_WS_COMMON", "E08") + " : " + _selCount();
            // D94 Results : n D90 Rows
            oTotLb.textContent = _txt(oAPP, "/U4A/CL_WS_COMMON", "D94") + " : " + aRows.length
                + " " + _txt(oAPP, "/U4A/CL_WS_COMMON", "D90");
        }

        function _syncHead() {
            var aSelectable = aRows.filter(function (r) { return r.ENAB_SEL; });
            var iSel = aSelectable.filter(function (r) { return r.SEL; }).length;
            oHeadChk.checked = aSelectable.length > 0 && iSel === aSelectable.length;
            oHeadChk.indeterminate = iSel > 0 && iSel < aSelectable.length;
            oHeadChk.disabled = aSelectable.length === 0;   // 선택 가능 행 없으면 비활성(형제 팝업 동일)
        }

        // 선택 상태 변화 후 공통 후처리(토큰/카운트/헤더).
        function _afterSelChange() { _renderTokens(); _updCounts(); _syncHead(); }

        // 전체선택/해제(선택 불가 행 skip — 원본 lf_selectionAll).
        function _selectAll(bSel) {
            aRows.forEach(function (r) {
                if (!r.ENAB_SEL) { return; }
                r.SEL = bSel;
                if (r.__chk) { r.__chk.checked = bSel; var tr = r.__chk.closest("tr"); if (tr) { tr.setAttribute("aria-selected", bSel ? "true" : "false"); } }
            });
            _afterSelChange();
        }

        // 확인 — 입력건 점검(원본 lf_chkList) 후 선택 필드 반환.
        function _confirm() {
            if (!aRows.length) {
                _toast("E", _txt(oAPP, "/U4A/MSG_WS", "227"));   // 227 Result not found.
                return;
            }
            var aSel = aRows.filter(function (r) { return r.SEL === true; });
            if (aSel.length === 0) {
                _toast("W", _txt(oAPP, "/U4A/MSG_WS", "268"));   // 268 Selected line does not exists.
                return;
            }
            if (aSel.length > 30) {
                _toast("W", _txt(oAPP, "/U4A/MSG_WS", "300"));   // 300 Choose no more than 30 entries
                return;
            }
            _close();
            _resolveOnce({
                RETCD: "S",
                TDESC: ls_ret.TDESC,
                FLIST: aSel.map(function (r) { return r.FLDNM; }).join("|")
            });
        }

        // ── 초기 렌더 ──
        _renderTable();
        _afterSelChange();

        // ESC 무동작 — 원본 escapeHandler:function(){} 와 동일(실수 닫힘 방지, 닫기는 X/취소 버튼으로만).
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); });

        // 헤더 드래그 / 더블클릭 리센터 / grip 리사이즈 — 공통 U4AUI.
        if (window.U4AUI) {
            try { U4AUI.makeDialogDraggable && U4AUI.makeDialogDraggable(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogRecenter && U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogResizable && U4AUI.makeDialogResizable(oDlg, { minW: 440, minH: 320 }); } catch (e) { }
        }

        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }
    }

    /* ── 공개 API(원본 exports 대체 — 디자인 컨텍스트 oAPP.fn 에 부착) ── */
    oAPP.fn = oAPP.fn || {};
    oAPP.fn._DATASET = {
        callDataSetFieldListPopop: function (is_dataSet, oAPPx) {
            return new Promise(function (resolve) {
                // _run 은 async — 초기 구성 중 예외로 거부되면 호출측 await 가 멈추므로 E 로 폴백(스크립트 오류는 콘솔로 표면화).
                Promise.resolve(_run(is_dataSet, oAPPx, resolve)).catch(function (e) {
                    try { parent.setBusy(""); } catch (e2) { }
                    console.error("[HTML5][DsFld] 팝업 오류:", e && (e.stack || e.message) || e);
                    resolve({ RETCD: "E" });
                });
            });
        }
    };

})();
