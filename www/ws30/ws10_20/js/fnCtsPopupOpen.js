/**************************************************************************
 * fnCtsPopupOpen.js  (HTML5)
 * ------------------------------------------------------------------------
 * CTS(이관요청) 선택 공통 팝업 — "Prompt for Transportable Workbench Request".
 *
 * [컨버전 메모]
 *  원본: sap.m.Dialog(customHeader Toolbar) + 상단 Form(Request No/Short Desc, 읽기전용)
 *        + Refresh 버튼 + sap.ui.table.Table(CTS No./Description/Date/Time) + Accept/Cancel.
 *  HTML5: native <dialog class="u4a-dialog u4aCtsDlg"> + 공통 컴포넌트(.u4a-input/.u4a-btn)
 *        + 스크롤 sticky-header <table class="u4aCtsTb">.
 *
 *  ★ 공통 팝업: 진입점은 oAPP.fn.fnCtsPopupOpen(fnCallback) 하나뿐이며, 전 코드베이스의
 *    Request No(CTS) 값도움이 oAPP.fn.fnCtsPopupOpener → 이 함수로 위임된다
 *    (createApplicationPopup / changeAppPackagePopup / conversionWebdynpro /
 *     createEventPopup / ws_events / fnMimePopupOpen / fnAppCopyPopupOpen / ws_usp ...).
 *    → 이 한 파일만 고치면 모든 호출부의 Request No F4 가 동일 UX 로 통일된다.
 *  ★ 콜백 계약(원본 유지): 선택한 행 데이터 객체를 그대로 전달. 호출부는 param.TRKORR /
 *    param.AS4TEXT (그 외 AS4DATE/AS4TIME/AS4USER/STRKORR) 를 사용한다.
 *  ★ 메시지: 전부 SQLite 메시지 클래스 키 사용(임의 영문 금지) — 원본 키 그대로 재사용.
 **************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const APPCOMMON = oAPP.common;

    // 데이터 조회 endpoint(원본 ev_GetCtsDialogAfterOpen 유지).
    const C_GET_CTS_URL = "/getctsdata";

    // 메시지 클래스 텍스트 헬퍼(원본 fnGetMsgClsText 호출 그대로).
    function _txt(sCls, sCode) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, "", "", "", ""); }
        catch (e) { return ""; }
    }
    const _fa = (sName) => '<i class="fa-solid fa-' + sName + '"></i>';

    function _el(sTag, sClass, sText) {
        const o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    // 서버 날짜(YYYYMMDD)/시간(HHMMSS) → 가독 포맷(yyyy-MM-dd / HH:mm:ss). 형식 안 맞으면 원본 그대로.
    //   ※ 표시(셀)에만 적용 — 콜백으로 넘기는 행 데이터(AS4DATE/AS4TIME)는 원본 유지.
    function _fmtDate(s) {
        s = (s == null) ? "" : String(s);
        return /^\d{8}$/.test(s) ? (s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8)) : s;
    }
    function _fmtTime(s) {
        s = (s == null) ? "" : String(s);
        return /^\d{6}$/.test(s) ? (s.slice(0, 2) + ":" + s.slice(2, 4) + ":" + s.slice(4, 6)) : s;
    }

    /************************************************************************
     * 공통 스타일 1회 주입 (테마 토큰 소비 — 하드코딩 색 없음)
     ************************************************************************/
    function _ensureStyle() {
        if (document.getElementById("u4aCtsStyle")) { return; }
        const oStyle = document.createElement("style");
        oStyle.id = "u4aCtsStyle";
        oStyle.textContent = `
        .u4aCtsDlg { width: min(70vw, 1000px); height: min(78vh, 680px); padding: 0; display: flex; flex-direction: column; }
        .u4aCtsDlg .u4a-dialog__header { cursor: move; user-select: none; }
        .u4aCtsDlg .u4a-dialog__header span { flex: 1 1 auto; }
        .u4aCtsBody { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
                      gap: 0.75rem; padding: 1rem 1.25rem 1.25rem; overflow: hidden; }
        /* 상단 선택정보 폼(읽기전용) — 라벨 우측정렬 + 입력 (원본 Form 레이아웃) */
        .u4aCtsForm { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 0.875rem;
                      align-items: center; flex: 0 0 auto; }
        .u4aCtsForm label { justify-self: end; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
        /* 조회 툴바(Refresh) */
        .u4aCtsBar { display: flex; align-items: center; gap: 0.5rem; flex: 0 0 auto; }
        .u4aCtsBar .u4aCtsSpacer { flex: 1 1 auto; }
        .u4aCtsCount { font-size: 0.8125rem; color: var(--text-muted); }
        /* 결과 테이블 — 스크롤 컨테이너 + sticky 헤더 */
        .u4aCtsTbWrap { flex: 1 1 auto; min-height: 0; overflow: auto;
                        border: 0.0625rem solid var(--line); border-radius: var(--radius-sm);
                        background: var(--surface-raised); }
        .u4aCtsTb { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem; }
        .u4aCtsTb thead th { position: sticky; top: 0; z-index: 1; background: var(--surface);
                             color: var(--text); font-weight: 700; text-align: left;
                             padding: 0.5rem 0.75rem; border-bottom: 0.0625rem solid var(--line); white-space: nowrap; }
        .u4aCtsTb tbody td { padding: 0.4375rem 0.75rem; color: var(--text);
                             border-bottom: 0.0625rem solid var(--line); white-space: nowrap; }
        .u4aCtsTb tbody tr { cursor: pointer; }
        .u4aCtsTb tbody tr:hover { background: var(--hover-bg); }
        .u4aCtsTb tbody tr[aria-selected="true"] { background: var(--selection-bg); }
        .u4aCtsTb tbody tr[aria-selected="true"] td { color: var(--selected-text); font-weight: 600; }
        /* 컬럼 정렬: CTS No./Date/Time 중앙, Description 좌측(원본 hAlign) */
        .u4aCtsTb .u4aCtsColC { text-align: center; }
        .u4aCtsEmpty { padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.875rem; }
        `;
        document.head.appendChild(oStyle);
    }

    // 헤더 드래그는 공통 U4AUI.makeDialogDraggable 사용(화면 밖/상단 헤더 클램프). 로컬 _attachDrag 제거.

    /************************************************************************
     * CTS 선택 팝업 열기
     ************************************************************************
     * @param {Function} fnCallback  선택한 CTS 행 데이터 객체를 전달하는 콜백.
     ************************************************************************/
    oAPP.fn.fnCtsPopupOpen = function (fnCallback) {

        _ensureStyle();

        // 팝업 상태(클로저) — 행 데이터 / 선택 인덱스.
        const oState = { aRows: [], iSel: -1, fnCb: (typeof fnCallback === "function") ? fnCallback : null };

        // ── 다이얼로그 골격 ─────────────────────────────────────────────
        const oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aCtsDlg";

        // 헤더: 아이콘(이관/트럭) + 제목 + 닫기 X
        const oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("truck") + "<span></span>";
        // 345  Prompt for Transportable Workbench Request
        oHeader.querySelector("span").textContent = _txt("/U4A/MSG_WS", "345");
        const oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.setAttribute("data-act", "close");
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oXBtn.addEventListener("click", function () { _close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 바디 ────────────────────────────────────────────────────────
        const oBody = _el("div", "u4a-dialog__body u4aCtsBody");
        oDlg.appendChild(oBody);

        // 상단 선택정보 폼(읽기전용): Request No / Short Description.
        const oForm = _el("div", "u4aCtsForm");
        // B03  Request No
        oForm.appendChild(_el("label", null, _txt("/U4A/CL_WS_COMMON", "B03")));
        const oInpNo = _el("input", "u4a-input");
        oInpNo.type = "text";
        oInpNo.readOnly = true;
        oForm.appendChild(oInpNo);
        // D54  Short Description
        oForm.appendChild(_el("label", null, _txt("/U4A/CL_WS_COMMON", "D54")));
        const oInpTx = _el("input", "u4a-input");
        oInpTx.type = "text";
        oInpTx.readOnly = true;
        oForm.appendChild(oInpTx);
        oBody.appendChild(oForm);

        // 조회 툴바: Refresh + 결과건수.
        const oBar = _el("div", "u4aCtsBar");
        const oRefresh = _el("button", "u4a-btn u4a-btn--emphasized");
        oRefresh.type = "button";
        oRefresh.innerHTML = _fa("rotate") + "<span></span>";
        oRefresh.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A48"); // Refresh
        oRefresh.addEventListener("click", function () { _loadData(); });
        oBar.appendChild(oRefresh);
        oBar.appendChild(_el("span", "u4aCtsSpacer"));
        const oCount = _el("span", "u4aCtsCount", "");
        oBar.appendChild(oCount);
        oBody.appendChild(oBar);

        // 결과 테이블.
        const oTbWrap = _el("div", "u4aCtsTbWrap");
        const oTb = _el("table", "u4aCtsTb");
        const oThead = _el("thead");
        const oHr = _el("tr");
        // A21 CTS No. / A35 Description / D55 Date / D56 Time
        const aCols = [
            { txt: _txt("/U4A/CL_WS_COMMON", "A21"), cls: "u4aCtsColC" },
            { txt: _txt("/U4A/CL_WS_COMMON", "A35"), cls: "" },
            { txt: _txt("/U4A/CL_WS_COMMON", "D55"), cls: "u4aCtsColC" },
            { txt: _txt("/U4A/CL_WS_COMMON", "D56"), cls: "u4aCtsColC" }
        ];
        aCols.forEach(function (c) {
            const oTh = _el("th", c.cls, c.txt);
            oHr.appendChild(oTh);
        });
        oThead.appendChild(oHr);
        oTb.appendChild(oThead);
        const oTbody = _el("tbody");
        oTb.appendChild(oTbody);
        oTbWrap.appendChild(oTb);
        const oEmpty = _el("div", "u4aCtsEmpty");
        oEmpty.hidden = true;
        oTbWrap.appendChild(oEmpty);
        oBody.appendChild(oTbWrap);

        // ── 푸터: Confirm(A40) / Close(A39) ─────────────────────────────
        const oFoot = _el("div", "u4a-dialog__footer");
        oFoot.style.display = "flex";
        oFoot.style.gap = "0.5rem";
        oFoot.style.alignItems = "center";
        oFoot.appendChild(_el("span", null, "")).style.flex = "1 1 auto";

        const oAccept = _el("button", "u4a-btn u4a-btn--emphasized");
        oAccept.type = "button";
        oAccept.innerHTML = _fa("check");   // 아이콘만 (텍스트 라벨 제거)
        oAccept.title = _txt("/U4A/CL_WS_COMMON", "A40"); // Confirm
        oAccept.addEventListener("click", function () { _accept(); });
        oFoot.appendChild(oAccept);

        const oCancel = _el("button", "u4a-btn u4a-btn--negative"); // 닫기 — Reject 느낌
        oCancel.type = "button";
        oCancel.innerHTML = _fa("xmark");   // X 아이콘만 (텍스트 라벨 제거)
        oCancel.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCancel.addEventListener("click", function () { _close(); });
        oFoot.appendChild(oCancel);
        oDlg.appendChild(oFoot);

        // busy — 전역 parent.setBusy(셸의 setDomBusy 가 모달 <dialog> 로 top-layer 표시).
        function _setBusy(bOn) { parent.setBusy(bOn ? "X" : ""); }

        // ── 행 선택/렌더 헬퍼 ───────────────────────────────────────────
        function _selectRow(iIdx) {
            oState.iSel = iIdx;
            const aTr = oTbody.querySelectorAll("tr");
            for (let i = 0; i < aTr.length; i++) {
                aTr[i].setAttribute("aria-selected", i === iIdx ? "true" : "false");
            }
            const oRow = (iIdx >= 0) ? oState.aRows[iIdx] : null;
            oInpNo.value = oRow ? (oRow.TRKORR || "") : "";
            oInpTx.value = oRow ? (oRow.AS4TEXT || "") : "";
        }

        function _renderRows() {
            oTbody.innerHTML = "";
            oState.iSel = -1;
            oInpNo.value = "";
            oInpTx.value = "";
            const aRows = oState.aRows;
            oEmpty.hidden = aRows.length > 0;
            if (aRows.length === 0) {
                // 268  Selected line does not exists. (목록 없음 안내 재사용)
                oEmpty.textContent = _txt("/U4A/MSG_WS", "268");
            }
            // A73 Search Result : n  형태로 건수 표기(원본 결과건수 라벨과 동일 키).
            oCount.textContent = _txt("/U4A/CL_WS_COMMON", "A73") + " : " + aRows.length;
            aRows.forEach(function (oRow, iIdx) {
                const oTr = _el("tr");
                oTr.setAttribute("aria-selected", "false");
                const aCell = [
                    { v: oRow.TRKORR, cls: "u4aCtsColC" },
                    { v: oRow.AS4TEXT, cls: "" },
                    { v: _fmtDate(oRow.AS4DATE), cls: "u4aCtsColC" },
                    { v: _fmtTime(oRow.AS4TIME), cls: "u4aCtsColC" }
                ];
                aCell.forEach(function (c) { oTr.appendChild(_el("td", c.cls, c.v || "")); });
                oTr.addEventListener("click", function () { _selectRow(iIdx); });
                oTr.addEventListener("dblclick", function () { _selectRow(iIdx); _accept(true); });
                oTbody.appendChild(oTr);
            });
        }

        // ── 서버 조회(원본 ev_GetCtsDialogAfterOpen / fnGetCtsDataSucc/Err) ──
        function _loadData() {
            _setBusy(true);       // 공통 top-layer busy(모달 위에도 보임)
            oState.aRows = [];
            _renderRows();
            const sPath = parent.getServerPath() + C_GET_CTS_URL,
                oUserInfo = parent.getUserInfo(),
                oFormData = new FormData();
            oFormData.append("USRID", oUserInfo.ID);
            sendAjax(sPath, oFormData, _onDataSucc, null, null, "POST", _onDataErr);
        }

        function _onDataSucc(oResult) {
            _setBusy(false);
            if (!oResult || oResult.RETCD !== "S") { return; }
            oState.aRows = Array.isArray(oResult.RESULT) ? oResult.RESULT : [];
            _renderRows();
        }

        function _onDataErr() {
            _setBusy(false);
        }

        // ── 선택 확정(Accept / 더블클릭) ────────────────────────────────
        //   더블클릭(bImmediate=true) 은 원본과 동일하게 확인 질문 후 콜백.
        function _accept(bImmediate) {
            if (oState.iSel < 0) {
                // 268  Selected line does not exists.
                parent.showMessage(null, 10, "I", _txt("/U4A/MSG_WS", "268"));
                return;
            }
            const oRow = oState.aRows[oState.iSel];
            if (bImmediate) {
                // 346  Do you want to choose?
                parent.showMessage(null, 30, "I", _txt("/U4A/MSG_WS", "346"), function (sAction) {
                    if (sAction !== "YES") { return; }
                    _fireCallback(oRow);
                });
                return;
            }
            _fireCallback(oRow);
        }

        function _fireCallback(oRow) {
            if (oState.fnCb) {
                try { oState.fnCb(oRow); }
                catch (e) { if (typeof console !== "undefined") { console.error("[CTS] callback 실패:", e && e.message); } }
            }
            _close();
        }

        function _close() {
            try { oDlg.close(); } catch (e) { }
            try { oDlg.remove(); } catch (e) { }
        }

        // ESC → 닫기.
        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); _close(); });

        // 공통 팝업 UX(드래그/더블클릭 리센터/우하단 resize grip) — SAPUI5 동일.
        if (window.U4AUI && U4AUI.makeDialogDraggable) { U4AUI.makeDialogDraggable(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 560, minH: 360 }); }

        document.body.appendChild(oDlg);
        oDlg.showModal();

        // 오픈 직후 데이터 조회(원본 afterOpen).
        _loadData();

    }; // end of oAPP.fn.fnCtsPopupOpen

})(window, $, oAPP);
