/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : OTRF4HelpPopup/index.js
 * - file Desc : OTR Manager 본문 (UI5 sap.m.Page/Panel/Table → HTML5).
 *               검색 패널(공통 createPanel/createField) + 결과 테이블(공통 .u4a-table) +
 *               더블클릭 시 "$OTR:<alias>" 클립보드 복사. 외부 셸(frame.js)의 oAPP 사용.
 *               백엔드 계약(servNm + "/f4serverData", trgubun F=필드정의 / D=데이터,
 *               if-otr-callback / if-send-action-<BROWSKEY>)은 원본 그대로 유지(06.팝업 7.5).
 ************************************************************************/

/************************************************************************
 * 에러 감지
 ************************************************************************/
const zconsole = parent.WSERR(window, document, console);

let oAPP = parent.oAPP,
    APPCOMMON = oAPP.common;

(function (window, oAPP) {
    "use strict";

    // 대상 OTR Search Help (원본 callOTRListPopup 인자 고정)
    var SHLPNAME = "/U4A/H_OTR_INF";

    // 기본 최대 검색건수
    var DEFAULT_MAX_ROWS = 200;

    var U4AUI = window.U4AUI;

    // ── 화면 상태 ──────────────────────────────────────────────
    var oState = {
        searchFields: [],   // [{ paramKey, field(createField), datatype }]
        columns: [],        // [{ key, label }]  (key = 셀 데이터 키)
        rows: [],           // 결과 행
        vs: null            // 공통 가상 스크롤러(U4AUI.makeVScroller)
    };

    // ── DOM 참조(빌드 후 세팅) ──────────────────────────────────
    var oEl = {
        panel: null,        // createPanel 인스턴스
        formGrid: null,     // 검색 필드 그리드
        searchBtn: null,
        maxRows: null,      // createField (number)
        resultLabel: null,
        tableWrap: null,
        tbody: null
    };


    /************************************************************************
     * 서버 전송 (원본 sendAjax 동일 — FormData POST, withCredentials)
     ************************************************************************/
    function sendAjax(sPath, oFormData, fn_success) {

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === xhr.DONE) {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        fn_success(JSON.parse(xhr.response));
                    } catch (e) {
                        console.error("[HTML5][OTR] 응답 파싱 오류:", e && e.message);
                        _setSearchBusy(false);
                    }
                }
            }
        };

        xhr.withCredentials = true;
        xhr.open("post", sPath, true);
        xhr.send(oFormData);

    } // end of sendAjax


    /************************************************************************
     * 공통 토스트 (MessageToast 대체) — 화면 정중앙 .u4a-toast 싱글톤(3초)
     ************************************************************************/
    var _iToastTimer = null;
    function _toast(sMsg) {

        if (sMsg == null || sMsg === "") {
            return;
        }

        var oToast = document.getElementById("u4aOtrToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aOtrToast";
            oToast.className = "u4a-toast";
            document.body.appendChild(oToast);
        }

        oToast.textContent = sMsg;
        // reflow 후 표시(transition)
        void oToast.offsetWidth;
        oToast.setAttribute("data-show", "true");

        if (_iToastTimer) { clearTimeout(_iToastTimer); }
        _iToastTimer = setTimeout(function () {
            oToast.setAttribute("data-show", "false");
        }, 3000);

    } // end of _toast


    /************************************************************************
     * 텍스트 클립보드 복사 (원본 setClipBoardTextCopy 동일 — textarea + execCommand)
     ************************************************************************/
    function _copyText(sText) {

        if (typeof sText !== "string") {
            return;
        }

        var oTextArea = document.createElement("textarea");
        oTextArea.value = sText;
        document.body.appendChild(oTextArea);
        oTextArea.select();

        try { document.execCommand('copy'); } catch (e) { }

        document.body.removeChild(oTextArea);

    } // end of _copyText


    /************************************************************************
     * 검색/결과 영역 Busy 토글 (원본 table/button local busy 대체 — 경량)
     ************************************************************************/
    function _setSearchBusy(bBusy) {

        if (oEl.searchBtn) { oEl.searchBtn.disabled = !!bBusy; }
        if (oEl.tableWrap) { oEl.tableWrap.setAttribute("aria-busy", bBusy ? "true" : "false"); }

    } // end of _setSearchBusy


    /************************************************************************
     * 정적 골격 빌드 — 힌트 + Selection 패널 + 결과 툴바 + 결과 테이블
     ************************************************************************/
    function _buildSkeleton() {

        var oContent = document.getElementById("content");
        oContent.innerHTML = "";

        var oRoot = U4AUI.el("div", "u4aOtr");

        // 힌트: "Alias can be copied by double-clicking the result list." (MSG_WS 366)
        var oHint = U4AUI.el("div", "u4aOtr__hint");
        oHint.textContent = APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "366", "", "", "", "");
        oRoot.appendChild(oHint);

        // Selection 패널 (D47) — 접이식. 헤더 액션에 Search 버튼(A75).
        var sSelTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D47", "", "", "", "");
        oEl.panel = U4AUI.createPanel({ title: sSelTxt });
        oEl.panel.el.classList.add("u4aOtr__panel");

        var sSearchTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A75", "", "", "", ""); // Search
        var oSearchBtn = U4AUI.el("button", "u4a-btn u4a-btn--emphasized u4aOtr__searchBtn");
        oSearchBtn.type = "button";
        oSearchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span>' + sSearchTxt + '</span>';
        oSearchBtn.title = sSearchTxt;
        oSearchBtn.addEventListener("click", function () { LF_getServerData(); });
        oEl.panel.actions.appendChild(oSearchBtn);
        oEl.searchBtn = oSearchBtn;

        // 검색 필드 그리드(필드 도착 후 채움)
        oEl.formGrid = U4AUI.el("div", "u4aOtr__form");
        oEl.panel.body.appendChild(oEl.formGrid);

        oRoot.appendChild(oEl.panel.el);

        // 결과 툴바: Maximum No, of Hits(A76) + 입력 + 결과건수(A73)
        var oBar = U4AUI.el("div", "u4aOtr__bar");

        var sMaxTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A76", "", "", "", ""); // Maximum No, of Hits
        var oMaxLb = U4AUI.el("label", "u4aOtr__barLabel");
        oMaxLb.textContent = sMaxTxt;
        oBar.appendChild(oMaxLb);

        oEl.maxRows = U4AUI.createField({ type: "text", value: String(DEFAULT_MAX_ROWS), clear: true, width: "5.5rem", className: "u4aOtr__max" });
        oEl.maxRows.input.setAttribute("inputmode", "numeric");
        oEl.maxRows.input.addEventListener("input", function () {
            // 숫자만 허용(원본 sap.m.Input type=Number)
            var s = oEl.maxRows.input.value.replace(/[^0-9]/g, "");
            if (s !== oEl.maxRows.input.value) { oEl.maxRows.input.value = s; }
        });
        oBar.appendChild(oEl.maxRows.el);

        var oSpacer = U4AUI.el("div", "u4aOtr__barSpacer");
        oBar.appendChild(oSpacer);

        var sResTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A73", "", "", "", ""); // Search Result
        oEl.resultLabel = U4AUI.el("span", "u4aOtr__result");
        oEl.resultLabel.textContent = sResTxt + " : 0";
        oEl.resultLabel.setAttribute("data-restext", sResTxt);
        oBar.appendChild(oEl.resultLabel);

        oRoot.appendChild(oBar);

        // 결과 테이블(공통 .u4a-table) — 가상 스크롤 컨테이너
        oEl.tableWrap = U4AUI.el("div", "u4a-table-wrap u4aOtr__tableWrap");
        var oTable = U4AUI.el("table", "u4a-table u4aOtr__table");
        var oThead = U4AUI.el("thead");
        oThead.appendChild(U4AUI.el("tr"));
        var oTbody = U4AUI.el("tbody");
        oTable.append(oThead, oTbody);
        oEl.tableWrap.appendChild(oTable);
        oEl.tbody = oTbody;
        oEl.thead = oThead;

        oRoot.appendChild(oEl.tableWrap);

        oContent.appendChild(oRoot);

    } // end of _buildSkeleton


    /************************************************************************
     * 검색조건 필드 구성 (원본 lf_setSearchCondition — SHLPSELPOS>0 만)
     ************************************************************************/
    function _buildSearchFields(aFieldDesc) {

        oEl.formGrid.innerHTML = "";
        oState.searchFields = [];

        for (var i = 0, l = aFieldDesc.length; i < l; i++) {

            var oFd = aFieldDesc[i];

            // 검색조건 필드가 아니면 skip
            if (oFd.SHLPSELPOS === 0) {
                continue;
            }

            // 모델 path(=서버 전송 키): 필드명의 '/' 는 'x'(소문자)로 — 원본 동일
            var sParamKey = String(oFd.FIELDNAME);
            if (sParamKey.indexOf("/") !== -1) {
                sParamKey = sParamKey.replace(/\//g, "x");
            }

            var sLabel = oFd.SCRTEXT_M || oFd.FIELDNAME;
            var sDfVal = (oFd.DFVAL != null) ? oFd.DFVAL : "";

            // datatype 별 placeholder 힌트(원본 DatePicker/TimePicker 포맷 — OTR Help 엔 날짜/시간 필드 없음).
            var sPlaceholder = "";
            if (oFd.DATATYPE === "D") { sPlaceholder = "YYYYMMDD"; }
            else if (oFd.DATATYPE === "T") { sPlaceholder = "HHMMSS"; }

            var oField = U4AUI.createField({
                type: "text",
                value: sDfVal,
                placeholder: sPlaceholder,
                clear: true,
                maxLength: (oFd.OUTPUTLEN != null && oFd.OUTPUTLEN > 0) ? oFd.OUTPUTLEN : undefined,
                className: "u4aOtr__field",
                onEnter: function () { LF_getServerData(); }
            });

            var oRow = U4AUI.el("div", "u4aOtr__formRow");
            var oLb = U4AUI.el("label", "u4aOtr__formLabel");
            oLb.textContent = sLabel;
            oLb.title = sLabel;
            oRow.append(oLb, oField.el);
            oEl.formGrid.appendChild(oRow);

            oState.searchFields.push({ paramKey: sParamKey, field: oField, datatype: oFd.DATATYPE });

        }

    } // end of _buildSearchFields


    /************************************************************************
     * 결과리스트 컬럼 설정 (원본 lf_setTableColumn — SHLPLISPOS>0 만)
     ************************************************************************/
    function _buildTableColumns(aFieldDesc) {

        oState.columns = [];

        for (var i = 0, l = aFieldDesc.length; i < l; i++) {

            var oFd = aFieldDesc[i];

            // 결과리스트 필드가 아니면 skip
            if (oFd.SHLPLISPOS === 0) {
                continue;
            }

            // 셀 데이터 키: 필드명의 '/' 는 'X'(대문자)로 — 원본 동일
            var sCellKey = String(oFd.FIELDNAME);
            if (sCellKey.indexOf("/") !== -1) {
                sCellKey = sCellKey.replace(/\//g, "X");
            }

            oState.columns.push({ key: sCellKey, label: oFd.SCRTEXT_S || oFd.FIELDNAME });

        }

        // thead 렌더
        var oTr = oEl.thead.firstChild;
        oTr.innerHTML = "";
        oState.columns.forEach(function (oCol) {
            var oTh = U4AUI.el("th");
            oTh.textContent = oCol.label;
            oTh.title = oCol.label;
            oTr.appendChild(oTh);
        });

        // 공통 가상 스크롤러 생성(컬럼 확정 후 1회). 보이는 구간만 DOM → 대용량 결과도 가볍게.
        //   0건=공통 no-data(ZMSG_WS_COMMON_001/946, WS20 형제 테이블과 동일).
        //   선택 키 = 행 고유 인덱스(__otrIdx) — ALIAS_NAME 은 빈 행이 많아 선택 키로 부적합(중복·미선택).
        var sNoData = "";
        try { sNoData = oAPP.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "946"); } catch (e) { }

        oState.vs = U4AUI.makeVScroller(oEl.tableWrap, oEl.tbody, {
            colCount: oState.columns.length || 1,
            buildRow: _buildRow,
            nodata: sNoData,
            getSelKey: function (oRowData) { return oRowData ? oRowData.__otrIdx : null; }
        });

    } // end of _buildTableColumns


    /************************************************************************
     * 결과 행 1개 빌드 (가상 스크롤러가 보이는 구간만 호출). idx=절대 인덱스(zebra).
     ************************************************************************/
    function _buildRow(oRowData, idx) {

        // 행 고유 선택 키(절대 인덱스) — getSelKey 가 이걸 읽어 선택 행을 식별.
        try { oRowData.__otrIdx = idx; } catch (e) { }

        var oTr = U4AUI.el("tr");
        oTr.setAttribute("data-otr-row", "X");
        if (idx % 2 === 1) { oTr.setAttribute("data-odd", "true"); } // 공통 zebra

        oState.columns.forEach(function (oCol) {
            var oTd = U4AUI.el("td");
            var v = oRowData[oCol.key];
            oTd.textContent = (v == null) ? "" : String(v);
            oTd.title = oTd.textContent;
            oTr.appendChild(oTd);
        });

        // 단일클릭=선택(스크롤로 행이 사라져도 유지), 더블클릭=복사 — 원본 selectionMode None + dblclick
        oTr.addEventListener("click", function () {
            if (oState.vs) {
                oState.vs.setSel(idx);
                oState.vs.refresh();
            }
        });
        oTr.addEventListener("dblclick", function () { _copyAlias(oRowData); });

        return oTr;

    } // end of _buildRow


    /************************************************************************
     * 결과 행 세팅 (가상 스크롤러에 위임)
     ************************************************************************/
    function _renderRows(aRows) {

        oState.rows = aRows || [];
        if (oState.vs) {
            oState.vs.setSel(null);   // 새 결과 → 이전 선택 해제
            oState.vs.setRows(oState.rows);
        }

    } // end of _renderRows


    /************************************************************************
     * 행 → "$OTR:<alias>" 클립보드 복사 (원본 dblclick 동일)
     ************************************************************************/
    function _copyAlias(oLine) {

        if (!oLine) { return; }

        // alias 없으면 메시지 처리 후 exit (원본 동일: "Alias &1 does not exist")
        if (!oLine.ALIAS_NAME || oLine.ALIAS_NAME === "") {
            var sAlias = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "E07", "", "", "", "");      // Alias
            _toast(APPCOMMON.fnGetMsgClsText("/U4A/MSG_WS", "196", sAlias, "", "", ""));               // &1 does not exist.
            return;
        }

        var sOtr = "$OTR:" + oLine.ALIAS_NAME;

        _copyText(sOtr);

        // "$OTR:<alias> copied" (E06 = copied)
        _toast(sOtr + " " + APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "E06", "", "", "", ""));

    } // end of _copyAlias


    /************************************************************************
     * F4 필드 정보 조회 (원본 lf_getF4Field — trgubun "F")
     ************************************************************************/
    function lf_getF4Field() {

        var oFormData = new FormData();
        oFormData.append("trgubun", "F");
        oFormData.append("_SHLPNAME", SHLPNAME);
        oFormData.append("_SHLPSUB", SHLPNAME);

        sendAjax(oAPP.attr.servNm + "/f4serverData", oFormData, function (param) {

            // 패널 펼침 + 검색조건/컬럼 구성
            oEl.panel.setCollapsed(false);
            _buildSearchFields(param);
            _buildTableColumns(param);
            _renderRows([]); // 초기 no-data

            // 메인(부모) 으로 로딩 완료 통지 — 원본 if-otr-callback 계약 유지
            try {
                var PARWIN = oAPP.CURRWIN.getParentWindow();
                if (PARWIN) { PARWIN.webContents.send("if-otr-callback", "X"); }
            } catch (e) { }

            // 로딩 종료 + 본문 CSS 페이드인(셸) + 메인 영역 Busy Lock 해제(원본 동일)
            parent.oAPP.setBusyLoading('');
            try { if (oAPP.fn && oAPP.fn.fnShowContent) { oAPP.fn.fnShowContent(); } } catch (e) { }
            oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });
            // ★형제 창 BUSY_OFF broadcast(opener 가 oMainBroad BUSY_ON 으로 형제창 잠금 → 짝맞춤).
            //   SETBUSYLOCK 은 "메인" busy 만 풀어 형제창(docPopup 등)은 안 풀린다 → 영구 busy+닫기차단 방지.
            try { oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "BROAD_BUSY", PRCCD: "BUSY_OFF" }); } catch (e) { }

        });

    } // end of lf_getF4Field


    /************************************************************************
     * 검색 실행 (원본 LF_getServerData — trgubun "D")
     ************************************************************************/
    function LF_getServerData() {

        // 아직 필드 미구성(F4 로딩 전)이면 무시
        if (!oState.searchFields) { return; }

        _setSearchBusy(true);

        var oFormData = new FormData();
        oFormData.append("trgubun", "D");
        oFormData.append("_SHLPNAME", SHLPNAME);
        oFormData.append("_SHLPSUB", SHLPNAME);

        // ~MAX ROW
        var sMax = (oEl.maxRows && oEl.maxRows.getValue()) ? oEl.maxRows.getValue() : String(DEFAULT_MAX_ROWS);
        oFormData.append("_MAXROWS", sMax);

        // 검색조건 입력값 수집(원본: 모델 param 키=소문자 x 치환 필드명)
        oState.searchFields.forEach(function (oSf) {
            oFormData.append(oSf.paramKey, oSf.field.getValue());
        });

        sendAjax(oAPP.attr.servNm + "/f4serverData", oFormData, function (param) {

            var sResTxt = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A73", "", "", "", ""); // Search Result

            if (param.TEXT[0].NAME === "REFDATA") {

                var iCnt = Number(param.TEXT[1].VALUE);
                oEl.resultLabel.textContent = sResTxt + " : " + iCnt;

                // 결과 많으면 검색 패널 접기(원본: visiRow>5 → setExpanded(false))
                if (iCnt > 5) { oEl.panel.setCollapsed(true); }

                var oData = {};
                try { oData = JSON.parse(param.TEXT[0].VALUE); } catch (e) { oData = {}; }
                _renderRows(oData.TF4LIST || []);

            } else if (param.TEXT[0].NAME === "NOTFOUND") {

                oEl.resultLabel.textContent = sResTxt + " : 0";
                _renderRows([]);
                _toast(param.TEXT[0].VALUE);

            }

            _setSearchBusy(false);

        });

    } // end of LF_getServerData


    /************************************************************************
     * -- Start of Program
     ************************************************************************/
    document.addEventListener("DOMContentLoaded", function () {

        // 부모와 동일 테마 적용(iframe 자체 토큰 동기화)
        try {
            var oTheme = (oAPP.attr.oThemeInfo && oAPP.attr.oThemeInfo.THEME) ? oAPP.attr.oThemeInfo : oAPP.fn.getThemeInfo();
            if (window.U4ATheme && oTheme && oTheme.THEME) {
                window.U4ATheme.apply(oTheme.THEME);
                try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }
            }
        } catch (e) { }

        // 정적 골격
        _buildSkeleton();

        // 창 표시(show)는 셸(frame.js)이 즉시 처리 — 네이티브 opacity 페이드 미사용(흰 플래시 방지).
        //   본문 등장은 F4 로딩 완료 시 CSS 페이드인(fnShowContent). (16.공통UX 2.6)

        // Esc = 닫기(공통 UX) — 포커스가 iframe(본문)에 있을 때 처리. 키 꾹 누름 가드.
        document.addEventListener("keydown", function (ev) {
            if (ev.repeat) { return; }
            if (ev.key === "Escape") {
                try { if (oAPP.fn && oAPP.fn.fnClose) { oAPP.fn.fnClose(); } } catch (e) { }
            }
        });

        // F4 필드 정보 조회 → 검색조건/컬럼 구성 + Busy 해제
        lf_getF4Field();

    });

})(window, oAPP);
