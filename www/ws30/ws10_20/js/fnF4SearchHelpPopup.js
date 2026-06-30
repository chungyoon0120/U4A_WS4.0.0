/**************************************************************************
 * fnF4SearchHelpPopup.js  (UI5 design/js/callF4HelpPopup.js → HTML5)
 * ------------------------------------------------------------------------
 * DDIC 검색 도움말(F4 Value Help) — 제네릭 / 재사용 모듈.
 *   원본: oAPP.fn.callF4HelpPopup(I_SHLPNAME, I_SHLP_DEF, IT_SHLP, IT_FIELDDESCR, cb)
 *         = sap.m.Dialog(draggable/resizable) + sap.m.Panel(검색조건) + sap.ui.table(결과).
 *   HTML5: 공통 <dialog class="u4a-dialog"> + 공통 컴포넌트(U4AUI.createPanel/createField/
 *          makeVScroller/makeDialogDraggable·Resizable·Recenter). UX 레퍼런스 = OTR Manager 팝업.
 *
 *   공개: oAPP.fn.fnF4SearchHelpOpen({ shlpname, shlpDef?, title?, onPick })
 *     · shlpname : 대표 Search Help 명 (= _SHLPNAME, _SHLPSUB)
 *     · shlpDef  : (선택) sub help — 미지정 시 shlpname
 *     · title    : (선택) 다이얼로그 제목 — 미지정 시 A26(Search Help)
 *     · onPick   : function(rowObject) 선택/더블클릭한 행 데이터(컬럼 셀 키 그대로)
 *
 *   백엔드 계약(원본 동일, 변경 금지 — .analy 06.팝업 / OTR 과 같은 /f4serverData):
 *     POST {servNm}/f4serverData (FormData, withCredentials)
 *       trgubun "F" {_SHLPNAME,_SHLPSUB} → 필드정의 배열
 *         (SHLPSELPOS>0 = 검색필드 / SHLPLISPOS>0 = 결과컬럼; SCRTEXT_M/SCRTEXT_S,DATATYPE,FIELDNAME,OUTPUTLEN,DFVAL)
 *       trgubun "D" {_SHLPNAME,_SHLPSUB,_MAXROWS, ...검색값} → TEXT[0].NAME=="REFDATA"
 *         면 TEXT[0].VALUE=JSON{TF4LIST:[]}, TEXT[1].VALUE=건수 / "NOTFOUND" 면 메시지.
 *     · 검색 전송키 = FIELDNAME '/'→'x'(소문자), 결과 셀키 = FIELDNAME '/'→'X'(대문자)  ※원본 비대칭 유지
 *   ※ 이 팝업엔 eval(SCRIPT) 없음. 데이터 콜만 존재(원본 동일).
 **************************************************************************/
(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    var DEFAULT_MAX_ROWS = 200;   // 원본 ZF4SH_input01 기본값.

    /* ── 작은 유틸 ─────────────────────────────────────────────────── */
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };

    function _el(tag, cls, txt) {
        var o = document.createElement(tag);
        if (cls) { o.className = cls; }
        if (txt != null) { o.textContent = txt; }
        return o;
    }
    // 코드형 라벨(/U4A/CL_WS_COMMON 등).
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
    function _flash() { try { (parent.CURRWIN || parent.REMOTE.getCurrentWindow()).flashFrame(true); } catch (e) { } }

    // 서버 경로(WS20 design context: oAPP.attr.servNm, 원본 callF4HelpPopup 은 parent.getServerPath()).
    function _serverPath() {
        try { if (oAPP.attr && oAPP.attr.servNm) { return oAPP.attr.servNm; } } catch (e) { }
        try { return parent.getServerPath(); } catch (e) { return ""; }
    }

    /* ====================================================================
     * 메인 진입 — 검색 도움말 팝업 생성/오픈
     * ================================================================== */
    oAPP.fn.fnF4SearchHelpOpen = function (opts) {

        _ensureStyle();

        opts = opts || {};
        var sShlpName = opts.shlpname || "";
        var sShlpDef = opts.shlpDef || sShlpName;     // 원본 I_SHLP_DEF(미지정 시 대표명)
        var fnPick = (typeof opts.onPick === "function") ? opts.onPick : null;

        // SHLPNAME 미지정 시 호출 무의미 — 방어.
        if (!sShlpName) { console.warn("[HTML5][F4SH] shlpname 미지정 — 호출 무시"); return; }

        // 이전 인스턴스 정리(싱글톤이 아니라 매 호출 새로 — 원본도 매번 new Dialog).
        var oOld = document.getElementById("u4aF4ShDlg");
        if (oOld) { try { oOld.remove(); } catch (e) { } }

        // ── 상태 ──────────────────────────────────────────────────
        var aSearchFields = [];   // [{ paramKey, field, datatype }]
        var aColumns = [];        // [{ key, label }]
        var oVs = null;           // 공통 가상 스크롤러

        // ── 다이얼로그 골격 ───────────────────────────────────────
        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aF4ShDlg";
        oDlg.id = "u4aF4ShDlg";

        function lf_close() {
            try { oDlg.close(); } catch (e) { }
            try { if (oDlg.parentNode) { oDlg.parentNode.removeChild(oDlg); } } catch (e) { }
        }

        // 헤더(검색 아이콘 + 제목 + 닫기 X)
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("magnifying-glass") + "<span></span>";
        // 제목: 지정값 우선, 없으면 A26(Search Help).
        oHeader.querySelector("span").textContent = opts.title || _txt("/U4A/CL_WS_COMMON", "A26");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.setAttribute("data-act", "close");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39"); oX.innerHTML = _fa("xmark");   // Close
        oX.addEventListener("click", lf_close);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 바디
        var oBody = _el("div", "u4a-dialog__body u4a-dialog__body--flush u4aF4ShBody");
        oDlg.appendChild(oBody);

        /* ── 검색조건 패널(공통 createPanel, 원본 sap.m.Panel expandable) ──
         *   헤더 제목 = A74(Search Condition), 헤더 액션 = Search 버튼(A75). 바디 = 검색필드 그리드. */
        var oPanel = (window.U4AUI && U4AUI.createPanel)
            ? U4AUI.createPanel({ title: _txt("/U4A/CL_WS_COMMON", "A74") })
            : null;
        var oFormGrid = _el("div", "u4aF4ShForm");
        var oSearchBtn = _el("button", "u4a-btn u4a-btn--emphasized u4aF4ShSearchBtn");
        oSearchBtn.type = "button";
        oSearchBtn.innerHTML = _fa("magnifying-glass") + "<span></span>";
        oSearchBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A75"); // Search
        oSearchBtn.addEventListener("click", function () { _doSearch(); });
        if (oPanel) {
            oPanel.el.classList.add("u4aF4ShPanel");
            oPanel.actions.appendChild(oSearchBtn);
            oPanel.body.appendChild(oFormGrid);
            oBody.appendChild(oPanel.el);
        } else {
            oBody.appendChild(oFormGrid);
        }

        /* ── 결과 툴바(Max rows + 결과 건수) — 원본 ZF4SH_ovtoolbar ── */
        var oBar = _el("div", "u4aF4ShBar");
        var oMaxLb = _el("label", "u4aF4ShBarLabel", _txt("/U4A/CL_WS_COMMON", "A76")); // Maximum No, of Hits
        oBar.appendChild(oMaxLb);

        var oMaxFld = window.U4AUI.createField({
            type: "text", value: String(DEFAULT_MAX_ROWS), clear: true,
            width: "6rem", className: "u4aF4ShMax"
        });
        oMaxFld.input.setAttribute("inputmode", "numeric");
        oMaxFld.input.addEventListener("input", function () {
            var s = oMaxFld.input.value.replace(/[^0-9]/g, "");
            if (s !== oMaxFld.input.value) { oMaxFld.input.value = s; }
        });
        oMaxFld.input.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") { ev.preventDefault(); _doSearch(); }
        });
        oBar.appendChild(oMaxFld.el);

        oBar.appendChild(_el("div", "u4aF4ShBarSpacer"));

        var sResTxt = _txt("/U4A/CL_WS_COMMON", "A73");   // Search Result
        var oResLabel = _el("span", "u4aF4ShResult", sResTxt + " : 0");
        oBar.appendChild(oResLabel);
        oBody.appendChild(oBar);

        /* ── 결과 테이블(공통 .u4a-table + 가상 스크롤) ── */
        var oTableWrap = _el("div", "u4a-table-wrap u4aF4ShTableWrap");
        var oTable = _el("table", "u4a-table u4aF4ShTable");
        var oThead = _el("thead"); oThead.appendChild(_el("tr"));
        var oTbody = _el("tbody");
        oTable.append(oThead, oTbody);
        oTableWrap.appendChild(oTable);
        oBody.appendChild(oTableWrap);

        // 푸터(닫기 — X 아이콘만, 원본 Reject 톤)
        var oFoot = _el("div", "u4a-dialog__footer");
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark");
        oCloseBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCloseBtn.addEventListener("click", lf_close);
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        /* ── 검색/결과 Busy 토글(원본 table/button local busy 대체 — 경량) ── */
        function _setSearchBusy(bBusy) {
            oSearchBtn.disabled = !!bBusy;
            oTableWrap.setAttribute("aria-busy", bBusy ? "true" : "false");
        }

        /* ── 행 빌드(가상 스크롤러가 보이는 구간만 호출). idx=절대 인덱스(zebra·선택키) ── */
        function _buildRow(oRowData, idx) {
            try { oRowData.__f4Idx = idx; } catch (e) { }   // 고유 선택 키(결과 셀에 빈값 많아 인덱스 사용)
            var oTr = _el("tr");
            if (idx % 2 === 1) { oTr.setAttribute("data-odd", "true"); }
            aColumns.forEach(function (oCol) {
                var oTd = _el("td");
                var v = oRowData[oCol.key];
                oTd.textContent = (v == null) ? "" : String(v);
                oTd.title = oTd.textContent;
                oTr.appendChild(oTd);
            });
            // 단일클릭=선택 강조, 더블클릭=선택 확정(pick + 닫기).
            //   ※ 원본 sap.ui.table 은 rowSelectionChange(단일클릭)에 바로 콜백+닫기지만,
            //     HTML5 공통 F4 UX(fnAppF4PopupOpen)와 동일하게 더블클릭 확정으로 통일(오선택 방지).
            oTr.addEventListener("click", function () {
                if (oVs) { oVs.setSel(idx); oVs.refresh(); }
            });
            oTr.addEventListener("dblclick", function () { _pick(oRowData); });
            return oTr;
        }

        // 선택 확정 → 콜백 + 닫기(원본 f_clientCallbak 후 close/destroy).
        function _pick(oRowData) {
            if (!oRowData) { return; }
            if (fnPick) { try { fnPick(oRowData); } catch (e) { console.error("[HTML5][F4SH] onPick 오류:", e && e.message); } }
            lf_close();
        }

        /* ── 검색조건 필드 구성(원본 lf_setSearchCondition — SHLPSELPOS>0) ── */
        function _buildSearchFields(aFieldDesc) {
            oFormGrid.innerHTML = "";
            aSearchFields = [];

            for (var i = 0, l = aFieldDesc.length; i < l; i++) {
                var oFd = aFieldDesc[i];
                if (oFd.SHLPSELPOS === 0) { continue; }   // 검색조건 필드가 아니면 skip

                // 서버 전송 키 = 필드명 '/'→'x'(소문자) — 원본 동일.
                var sParamKey = String(oFd.FIELDNAME);
                if (sParamKey.indexOf("/") !== -1) { sParamKey = sParamKey.replace(/\//g, "x"); }

                var sLabel = oFd.SCRTEXT_M || oFd.FIELDNAME;
                var sDfVal = (oFd.DFVAL != null) ? oFd.DFVAL : "";

                // datatype 힌트(원본 DatePicker/TimePicker 포맷 — 대부분 텍스트 필드).
                var sPlaceholder = "";
                if (oFd.DATATYPE === "D") { sPlaceholder = "YYYYMMDD"; }
                else if (oFd.DATATYPE === "T") { sPlaceholder = "HHMMSS"; }

                var oField = window.U4AUI.createField({
                    type: "text",
                    value: sDfVal,
                    placeholder: sPlaceholder,
                    clear: true,
                    maxLength: (oFd.OUTPUTLEN != null && oFd.OUTPUTLEN > 0) ? oFd.OUTPUTLEN : undefined,
                    className: "u4aF4ShField",
                    onEnter: function () { _doSearch(); }
                });

                var oRow = _el("div", "u4aF4ShFormRow");
                var oLb = _el("label", "u4aF4ShFormLabel", sLabel);
                oLb.title = sLabel;
                oRow.append(oLb, oField.el);
                oFormGrid.appendChild(oRow);

                aSearchFields.push({ paramKey: sParamKey, field: oField, datatype: oFd.DATATYPE });
            }
        }

        /* ── 결과 컬럼 구성(원본 lf_setTableColumn — SHLPLISPOS>0) ── */
        function _buildTableColumns(aFieldDesc) {
            aColumns = [];

            for (var i = 0, l = aFieldDesc.length; i < l; i++) {
                var oFd = aFieldDesc[i];
                if (oFd.SHLPLISPOS === 0) { continue; }   // 결과 컬럼이 아니면 skip

                // 셀 데이터 키 = 필드명 '/'→'X'(대문자) — 원본 비대칭 유지.
                var sCellKey = String(oFd.FIELDNAME);
                if (sCellKey.indexOf("/") !== -1) { sCellKey = sCellKey.replace(/\//g, "X"); }

                aColumns.push({ key: sCellKey, label: oFd.SCRTEXT_S || oFd.FIELDNAME });
            }

            // thead 렌더
            var oTr = oThead.firstChild;
            oTr.innerHTML = "";
            aColumns.forEach(function (oCol) {
                var oTh = _el("th", null, oCol.label);
                oTh.title = oCol.label;
                oTr.appendChild(oTh);
            });

            // 공통 가상 스크롤러(컬럼 확정 후 1회). 0건 = 공통 no-data(946).
            var sNoData = _wsTxt("946");
            oVs = (window.U4AUI && U4AUI.makeVScroller)
                ? U4AUI.makeVScroller(oTableWrap, oTbody, {
                    colCount: aColumns.length || 1,
                    buildRow: _buildRow,
                    nodata: sNoData,
                    getSelKey: function (oRowData) { return oRowData ? oRowData.__f4Idx : null; }
                })
                : null;
        }

        function _renderRows(aRows) {
            if (oVs) { oVs.setSel(null); oVs.setRows(aRows || []); }
        }

        /* ── F4 필드정보 조회(원본 lf_getF4Field — trgubun "F") ── */
        function _loadF4Field() {
            var fd = new FormData();
            fd.append("trgubun", "F");
            fd.append("_SHLPNAME", sShlpName);
            fd.append("_SHLPSUB", sShlpDef);

            _setSearchBusy(true);
            try {
                sendAjax(_serverPath() + "/f4serverData", fd, function (param) {
                    // 패널 펼침 + 검색조건/컬럼 구성.
                    if (oPanel && oPanel.setCollapsed) { oPanel.setCollapsed(false); }
                    _buildSearchFields(Array.isArray(param) ? param : []);
                    _buildTableColumns(Array.isArray(param) ? param : []);
                    _renderRows([]);   // 초기 no-data
                    _setSearchBusy(false);
                    // 첫 검색필드 포커스(원본 afterOpen 흐름 — 사용자가 바로 입력/검색).
                    try { if (aSearchFields.length) { aSearchFields[0].field.input.focus(); } } catch (e) { }
                });
            } catch (e) { _setSearchBusy(false); _msg("E", String(e && e.message || e)); }
        }

        /* ── 검색 실행(원본 LF_getServerData — trgubun "D") ── */
        function _doSearch() {
            if (!aSearchFields) { return; }   // 필드 미구성(F 로딩 전)이면 무시

            _setSearchBusy(true);

            var fd = new FormData();
            fd.append("trgubun", "D");
            fd.append("_SHLPNAME", sShlpName);
            fd.append("_SHLPSUB", sShlpDef);

            var sMax = (oMaxFld.getValue && oMaxFld.getValue()) ? oMaxFld.getValue() : String(DEFAULT_MAX_ROWS);
            fd.append("_MAXROWS", sMax);

            // 검색조건 입력값 수집(키 = 소문자 x 치환 필드명).
            aSearchFields.forEach(function (oSf) { fd.append(oSf.paramKey, oSf.field.getValue()); });

            try {
                sendAjax(_serverPath() + "/f4serverData", fd, function (param) {
                    var sRes = _txt("/U4A/CL_WS_COMMON", "A73");   // Search Result

                    if (param && param.TEXT && param.TEXT[0] && param.TEXT[0].NAME === "REFDATA") {
                        var iCnt = Number(param.TEXT[1].VALUE);
                        oResLabel.textContent = sRes + " : " + iCnt;
                        // 결과 많으면 검색 패널 접기(원본: visiRow>5 → setExpanded(false)).
                        if (iCnt > 5 && oPanel && oPanel.setCollapsed) { oPanel.setCollapsed(true); }

                        var oData = {};
                        try { oData = JSON.parse(param.TEXT[0].VALUE); } catch (e) { oData = {}; }
                        _renderRows(oData.TF4LIST || []);

                    } else if (param && param.TEXT && param.TEXT[0] && param.TEXT[0].NAME === "NOTFOUND") {
                        oResLabel.textContent = sRes + " : 0";
                        _renderRows([]);
                        _flash();
                        _msg("E", param.TEXT[0].VALUE || "");
                    }

                    _setSearchBusy(false);
                });
            } catch (e) { _setSearchBusy(false); _msg("E", String(e && e.message || e)); }
        }

        /* ── 오픈 ─────────────────────────────────────────────────── */
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_close(); });
        if (window.U4AUI) {
            try { U4AUI.makeDialogDraggable && U4AUI.makeDialogDraggable(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogRecenter && U4AUI.makeDialogRecenter(oDlg, oHeader); } catch (e) { }
            try { U4AUI.makeDialogResizable && U4AUI.makeDialogResizable(oDlg, { minW: 560, minH: 380 }); } catch (e) { }
        }

        document.body.appendChild(oDlg);
        try { oDlg.showModal(); } catch (e) { }

        // afterOpen: F4 필드정보 조회(원본 attachAfterOpen → lf_getF4Field). 자동검색은 안 함(원본 동일).
        _loadF4Field();

    }; // end of oAPP.fn.fnF4SearchHelpOpen

    /* ====================================================================
     * 스코프 CSS (1회 주입) — 토큰 기반, 공통 컴포넌트와 일관.
     * ================================================================== */
    function _ensureStyle() {
        if (document.getElementById("u4aF4ShStyle")) { return; }
        var s = document.createElement("style");
        s.id = "u4aF4ShStyle";
        s.textContent = [
            ".u4aF4ShDlg{width:min(92vw,1100px);height:80vh;max-width:none;display:flex;flex-direction:column;}",
            ".u4aF4ShDlg .u4a-dialog__header{cursor:move;user-select:none;}",
            ".u4aF4ShBody{display:flex;flex-direction:column;min-height:0;overflow:hidden;gap:.625rem;padding:.875rem 1rem;}",
            ".u4aF4ShPanel{flex:0 0 auto;}",
            /* 검색필드 그리드: 2열(좁으면 1열) 라벨+필드 */
            ".u4aF4ShForm{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem 2rem;}",
            ".u4aF4ShFormRow{display:flex;align-items:center;gap:.75rem;min-width:0;}",
            ".u4aF4ShFormLabel{flex:0 0 9rem;text-align:right;color:var(--text-muted);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
            ".u4aF4ShFormRow .u4aF4ShField{flex:1 1 auto;min-width:0;width:auto;}",
            ".u4aF4ShField .u4a-field__input{width:100%;}",
            /* 결과 툴바 */
            ".u4aF4ShBar{flex:0 0 auto;display:flex;align-items:center;gap:.5rem;}",
            ".u4aF4ShBarLabel{color:var(--text-muted);font-weight:600;}",
            ".u4aF4ShBarSpacer{flex:1 1 auto;}",
            ".u4aF4ShMax{flex:0 0 auto;}",
            ".u4aF4ShResult{color:var(--text);font-weight:700;white-space:nowrap;}",
            /* 결과 테이블 — 박스(보더+라운드+surface) + 내부 스크롤 */
            ".u4aF4ShTableWrap{flex:1 1 auto;min-height:0;overflow:auto;border:.0625rem solid var(--line);border-radius:var(--radius);background:var(--surface);}",
            ".u4aF4ShDlg .u4aF4ShTable{width:max-content;min-width:100%;}",
            ".u4aF4ShDlg .u4aF4ShTable td{vertical-align:middle;white-space:nowrap;}",
            /* 검색 진행 중 결과 영역 흐림 */
            ".u4aF4ShTableWrap[aria-busy=\"true\"]{opacity:.6;pointer-events:none;}",
            ""
        ].join("\n");
        document.head.appendChild(s);
    }

})(window, $, oAPP);
