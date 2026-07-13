/**************************************************************************
 * fnDynListPopup.js  (UI5 design/js/callDynListPopup.js → HTML5)
 * ------------------------------------------------------------------------
 * 동적 리스트 팝업 — 서버 perform(getDynList) 결과를 "동적 컬럼" 테이블로 표시하고,
 *   행 더블클릭 시 해당 행 데이터를 콜백으로 넘기는 제네릭 선택 팝업.
 *
 *   공개(원본과 동일 시그니처 — 소비처 1:1 유지):
 *     oAPP.fn.callDynListPopup(sName, sTitle, it_param, f_callBack)
 *       · sName      : DYNNAM (서버에서 호출할 perform 명)
 *       · sTitle     : 팝업 제목
 *       · it_param   : [{NAME,VALUE}] 서버 전송 추가 파라미터
 *       · f_callBack : function(rowObject) 행 더블클릭 시 선택 행 데이터 콜백
 *
 *   백엔드(원본 동일, 변경 금지):
 *     POST {servNm}/getDynList (FormData {DYNNAM, ...it_param})
 *       → { RETCD, RTMSG, T_LIST:[{FIELD,TEXT}], T_DATA:[{<FIELD>:값, ...}] }
 *       · RETCD "E" → RTMSG 오류 토스트.
 *       · 컬럼 = T_LIST(FIELD=셀키, TEXT=헤더), 행 = T_DATA.
 *     ※ 이 팝업엔 eval(SCRIPT) 없음. 데이터 콜만 존재(원본 동일).
 *
 *   원본 동작 보존:
 *     · 닫기(X/푸터/ESC)  → 001(Cancel operation) 토스트.
 *     · 행 더블클릭       → 편집(IS_EDIT)일 때만 콜백 + 닫기 + 005(Job finished) 토스트.
 *
 *   HTML5: 공통 <dialog class="u4a-dialog"> + 공통 컴포넌트(U4AUI.makeVScroller/
 *          makeDialogDraggable·Recenter·Resizable). UX 레퍼런스 = fnF4SearchHelpPopup.
 **************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    /* ── 작은 유틸(fnF4SearchHelpPopup 와 동일 패턴) ───────────────────── */
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (txt != null) { o.textContent = txt; }
        return o;
    }
    // 코드형 라벨/메시지(/U4A/CL_WS_COMMON, /U4A/MSG_WS 등).
    function _txt(sCls, sCode, p1) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", ""); } catch (e) { return sCode; }
    }
    // ZMSG_WS_COMMON_001 — 워크스페이스 언어 기준(공통 no-data 등).
    function _wsTxt(sNo) {
        try {
            var sLangu = (parent.getUserInfo() || {}).LANGU;
            return parent.WSUTIL.getWsMsgClsTxt(sLangu, "ZMSG_WS_COMMON_001", sNo);
        } catch (e) { return sNo; }
    }
    function _msg(sType, sText) { try { parent.showMessage(null, 10, sType, sText); } catch (e) { } }

    // 서버 경로(WS20 design context — 원본 oAPP.attr.servNm).
    function _serverPath() {
        try { if (oAPP.attr && oAPP.attr.servNm) { return oAPP.attr.servNm; } } catch (e) { }
        try { return parent.getServerPath(); } catch (e) { return ""; }
    }

    /* ====================================================================
     * 메인 진입 — 동적 리스트 팝업 생성/오픈 (원본 callDynListPopup 1:1)
     * ================================================================== */
    oAPP.fn.callDynListPopup = function (sName, sTitle, it_param, f_callBack) {

        _ensureStyle();

        var fnPick = (typeof f_callBack === "function") ? f_callBack : null;

        // 이전 인스턴스 정리(원본도 매번 new Dialog — 싱글톤 아님).
        var oOld = document.getElementById("u4aDynLDlg");
        if (oOld) { try { oOld.remove(); } catch (e) { } }

        // ── 상태 ──────────────────────────────────────────────────
        var aColumns = [];   // [{ key, label }]
        var _dt = null;      // 공통 평면 데이터 테이블(U4AUI.makeDataTable)

        // ── 다이얼로그 골격 ───────────────────────────────────────
        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aDynLDlg";
        oDlg.id = "u4aDynLDlg";

        function _close() {
            try { oDlg.close(); } catch (e) { }
            try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e) { }
        }
        // 취소로 닫기(X/푸터/ESC) → 001(Cancel operation) 토스트(원본 닫기 버튼 54행).
        function _cancel() {
            _close();
            _msg("I", _txt("/U4A/MSG_WS", "001"));
        }

        // 헤더(리스트 아이콘 + 제목 + 닫기 X)
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("list") + "<span></span>";
        oHeader.querySelector("span").textContent = (sTitle != null) ? sTitle : "";
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.setAttribute("data-act", "close");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39"); oX.innerHTML = _fa("xmark");   // Close
        oX.addEventListener("click", _cancel);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 바디(결과 테이블만 — 원본 HBox + sap.ui.table) = 공통 U4AUI.makeDataTable(.u4a-table + 가상 스크롤).
        //   골격/헤더/행/zebra/선택/no-data/windowing 은 공통이 담당. 컬럼은 서버 응답 후 setColumns.
        //   단일클릭=행선택(내장), 더블클릭=확정(_pick, 편집상태 가드는 _pick 내부).
        var oBody = _el("div", "u4a-dialog__body u4a-dialog__body--flush u4aDynLBody");
        var oTableWrap = _el("div", "u4a-table-wrap u4aDynLTableWrap");
        oBody.appendChild(oTableWrap);
        oDlg.appendChild(oBody);
        _dt = window.U4AUI.makeDataTable(oTableWrap, {
            virtual: true,
            columns: [],
            emptyText: _wsTxt("946"),
            tableClass: "u4aDynLTable",
            rowKey: function (oRow, idx) { return idx; },
            onActivate: function (oRow) { _pick(oRow); }
        });

        // 푸터(닫기 — X 아이콘만, Reject 톤)
        var oFoot = _el("div", "u4a-dialog__footer");
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark");
        oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39");   // Close
        oCloseBtn.addEventListener("click", _cancel);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        // (행 빌드·zebra·단일클릭 선택·더블클릭 확정은 공통 makeDataTable 이 담당 —
        //  컬럼 key 로 셀 렌더, onActivate=_pick. 원본 __dynIdx 선택키는 rowKey:idx 로 대체.)

        // 선택 확정(원본 lf_tabDblClick): 편집(IS_EDIT)일 때만 콜백 + 닫기 + 005.
        function _pick(oRowData) {
            if (!oRowData) { return; }

            // 편집상태가 아닌경우 exit(원본 169행).
            var bEdit = false;
            try { bEdit = oAPP.attr.oModel.oData.IS_EDIT !== false; } catch (e) { bEdit = false; }
            if (!bEdit) { return; }

            if (fnPick) {
                try { fnPick(oRowData); }
                catch (e) { console.error("[HTML5][DynL] 콜백 오류:", e && e.message); }
            }

            _close();

            //005	Job finished.
            _msg("I", _txt("/U4A/MSG_WS", "005"));
        }

        /* ── 동적 컬럼/행 구성(원본 lf_setDynList) ── */
        function _setDynList(param) {
            aColumns = [];

            var aList = (param && Array.isArray(param.T_LIST)) ? param.T_LIST : [];
            aList.forEach(function (oL) {
                var sLabel = (oL.TEXT != null && oL.TEXT !== "") ? oL.TEXT : oL.FIELD;
                aColumns.push({ key: oL.FIELD, label: sLabel });
            });

            // 공통 테이블: 컬럼 지정(헤더 재렌더 + vs 재생성) → 행 세팅.
            if (_dt) {
                _dt.setColumns(aColumns);
                var aData = (param && Array.isArray(param.T_DATA)) ? param.T_DATA : [];
                _dt.setSel(null);
                _dt.setRows(aData);
            }
        }

        /* ── 동적 테이블 구성 정보 조회(원본 lf_getDynLayout — /getDynList) ── */
        function _load() {
            var fd = new FormData();
            fd.append("DYNNAM", sName);

            // 서버전송 추가 파라미터.
            if (it_param) {
                for (var i = 0, l = it_param.length; i < l; i++) {
                    fd.append(it_param[i].NAME, it_param[i].VALUE);
                }
            }

            try {
                // 4번째 "X" = busy 표시(원본 sendAjax(...,"X") 동일).
                sendAjax(_serverPath() + "/getDynList", fd, function (param) {

                    //★ busy 해제 — sendAjax 정상 응답 경로(onload)는 busy off 를 호출측 책임으로 둔다
                    //  (성공 시 setBusy("") 를 호출하지 않음). 원본도 lf_setDynList/에러 콜백에서 직접 해제.
                    try { parent.setBusy && parent.setBusy(""); } catch (e2) { }

                    // 테이블 구성정보를 얻지 못한 경우(원본 109행).
                    if (param && param.RETCD === "E") {
                        _msg("E", param.RTMSG || "");
                        return;
                    }
                    _setDynList(param || {});
                }, "X");
            } catch (e) {
                try { parent.setBusy && parent.setBusy(""); } catch (e2) { }
                _msg("E", String(e && e.message || e));
            }
        }

        /* ── 오픈 ─────────────────────────────────────────────────── */
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _cancel(); });
        if (window.U4AUI) {
            try { U4AUI.makeDialogDraggable && U4AUI.makeDialogDraggable(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogRecenter && U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogResizable && U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 300 }); } catch (e) { }
        }

        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }

        // afterOpen: 동적 테이블 구성 조회(원본 attachBeforeOpen → lf_getDynLayout).
        _load();

    }; // end of oAPP.fn.callDynListPopup

    /* ====================================================================
     * 스코프 CSS (1회 주입) — 토큰 기반, 공통 컴포넌트와 일관.
     * ================================================================== */
    function _ensureStyle() {
        if (document.getElementById("u4aDynLStyle")) { return; }
        var s = document.createElement("style");
        s.id = "u4aDynLStyle";
        s.textContent = [
            ".u4aDynLDlg{width:min(88vw,760px);height:70vh;max-width:none;display:flex;flex-direction:column;}",
            ".u4aDynLDlg .u4a-dialog__header{cursor:move;user-select:none;}",
            ".u4aDynLBody{display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:.875rem 1rem;}",
            /* 결과 테이블 — 박스(보더+라운드+surface) + 내부 스크롤 */
            ".u4aDynLTableWrap{flex:1 1 auto;min-height:0;overflow:auto;border:.0625rem solid var(--line);border-radius:var(--radius);background:var(--surface);}",
            ".u4aDynLDlg .u4aDynLTable{width:max-content;min-width:100%;}",
            ".u4aDynLDlg .u4aDynLTable td{vertical-align:middle;white-space:nowrap;}",
            ""
        ].join("\n");
        document.head.appendChild(s);
    }

})(window, $, oAPP);
