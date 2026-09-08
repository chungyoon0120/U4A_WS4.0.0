/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : errMsgPopup/index.js
 * - file Desc : Error Message Popup 본문 테이블 (UI5 sap.m.Table → HTML5).
 *               공통 테이블 컴포넌트(shell.css .u4a-table + 카드 반응형)를 소비.
 *               외부 셸(frame.js)의 oAPP(데이터/IPC/Busy/테마)를 사용.
 ************************************************************************/
/************************************************************************
 * 에러 감지
 ************************************************************************/
const zconsole = parent.WSERR(window, document, console);

let oAPP = parent.oAPP,
    APPCOMMON = oAPP.common;

(function (window, oAPP) {
    "use strict";

    // 카드(타일) 뷰 전환 폭(px). 이보다 좁으면 각 행을 카드로(공통 .u4a-table-wrap[data-view]).
    var CARD_VIEW_MAX = 480;

    /************************************************************************
     * 이벤트 대상에서 데이터 행(tr) 찾기
     ************************************************************************/
    function _getRow(oEvent) {
        return oEvent.target ? oEvent.target.closest("tr[data-err-row]") : null;
    } // end of _getRow

    /************************************************************************
     * 행 단일 선택 표시 (공통 규약: aria-selected → shell.css 선택 토큰)
     ************************************************************************/
    function _selectRow(oRow) {

        if (!oRow) {
            return;
        }

        var oTbody = oRow.parentNode;
        if (oTbody) {
            var oPrev = oTbody.querySelector('tr[aria-selected="true"]');
            if (oPrev && oPrev !== oRow) {
                oPrev.setAttribute("aria-selected", "false");
            }
        }

        oRow.setAttribute("aria-selected", "true");

    } // end of _selectRow

    /************************************************************************
     * 행 실행 → 부모(메인 창)로 클릭한 행 데이터 전달.
     * (기존 UI5 dblclick → `${browserkey}--errormsg--click` 계약 동일 유지)
     ************************************************************************/
    function _fireRowAction(oRow) {

        if (!oRow || !oRow._rowData) {
            return;
        }

        let oCurrWin = oAPP.REMOTE.getCurrentWindow();
        if (oCurrWin.isDestroyed()) {
            return;
        }

        try {

            var sBrowserKey = oAPP.BROWSKEY,
                IPCRENDERER = oAPP.IPCRENDERER;

        } catch (error) {
            return;
        }

        IPCRENDERER.send(`${sBrowserKey}--errormsg--click`, {
            oRowData: oRow._rowData
        });

    } // end of _fireRowAction

    /************************************************************************
     * 행 이벤트 — 단일클릭=선택, 더블클릭/Enter=실행
     ************************************************************************/
    function _onRowClick(oEvent) {
        _selectRow(_getRow(oEvent));
    } // end of _onRowClick

    function _onRowDblclick(oEvent) {
        var oRow = _getRow(oEvent);
        _selectRow(oRow);
        _fireRowAction(oRow);
    } // end of _onRowDblclick

    function _onRowKeydown(oEvent) {

        // 키 꾹 누름(auto-repeat) 중복 발화 방지
        if (oEvent.repeat) {
            return;
        }

        if (oEvent.key !== "Enter" && oEvent.key !== " " && oEvent.key !== "Spacebar") {
            return;
        }

        var oRow = _getRow(oEvent);
        if (!oRow) {
            return;
        }

        oEvent.preventDefault(); // Space 스크롤 방지
        _selectRow(oRow);
        _fireRowAction(oRow);

    } // end of _onRowKeydown

    /************************************************************************
     * 반응형 — 폭에 따라 table↔card 전환(공통 방식: ResizeObserver→data-view).
     *  Chromium93 컨테이너쿼리 미지원이라 JS 로 토글한다(ServerList 와 동일).
     ************************************************************************/
    function _applyView(oWrap) {

        if (!oWrap || !oWrap.isConnected) {
            return;
        }

        var iWidth = oWrap.getBoundingClientRect().width;
        if (!iWidth) {
            return;
        }

        var sView = (iWidth < CARD_VIEW_MAX) ? "card" : "table";
        if (oWrap.dataset.view !== sView) {
            oWrap.dataset.view = sView;
        }

    } // end of _applyView

    function _observeView(oWrap) {

        // 1) 즉시 1회
        _applyView(oWrap);

        // 2) ResizeObserver — 콜백 안 동기 변경 시 루프 경고 → rAF 디바운스
        if (typeof ResizeObserver !== "undefined") {
            var bScheduled = false;
            var oRO = new ResizeObserver(function () {
                if (bScheduled) {
                    return;
                }
                bScheduled = true;
                var fnRAF = (typeof requestAnimationFrame === "function")
                    ? requestAnimationFrame
                    : function (cb) { return setTimeout(cb, 16); };
                fnRAF(function () {
                    bScheduled = false;
                    _applyView(oWrap);
                });
            });
            oRO.observe(oWrap);
        }

        // 3) 창 리사이즈
        window.addEventListener("resize", function () { _applyView(oWrap); });

    } // end of _observeView

    /************************************************************************
     * 헤더 셀 생성 헬퍼
     ************************************************************************/
    function _makeTh(sText, sModifier) {

        var oTh = document.createElement("th");
        if (sModifier) {
            oTh.className = sModifier;
        }
        oTh.textContent = sText;
        return oTh;

    } // end of _makeTh

    /************************************************************************
     * 본문 테이블 렌더링 (공통 .u4a-table 소비)
     ************************************************************************/
    oAPP.fn.fnInitRendering = function () {

        var aMsg = oAPP.attr.aMsg || [];

        // 컬럼 헤더 텍스트 (메시지 키 — 하드코딩 금지)
        var sColType = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D26"), // Error Type
            sColLine = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D27"), // Line
            sColDesc = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "A35"); // Description

        // 공통 스크롤 래퍼 + 테이블(compact 밀도)
        var oWrap = document.createElement("div");
        oWrap.className = "u4a-table-wrap u4aErrWrap";

        var oTable = document.createElement("table");
        //행높이=공통 .u4a-table 기본(전 테이블 통일 — F4/Login/insert 동일). --compact 제거.
        oTable.className = "u4a-table u4aErrTbl";

        // colgroup — fixed 레이아웃 컬럼 폭(테이블뷰)
        var oColgroup = document.createElement("colgroup");
        ["u4aErrCol--type", "u4aErrCol--line", "u4aErrCol--desc"].forEach(function (sCls) {
            var oCol = document.createElement("col");
            oCol.className = sCls;
            oColgroup.appendChild(oCol);
        });
        oTable.appendChild(oColgroup);

        // thead
        var oThead = document.createElement("thead");
        var oTrHead = document.createElement("tr");
        oTrHead.appendChild(_makeTh(sColType, "u4a-c-etype"));
        oTrHead.appendChild(_makeTh(sColLine, "u4a-c-eline"));
        oTrHead.appendChild(_makeTh(sColDesc, "u4a-c-edesc"));
        oThead.appendChild(oTrHead);
        oTable.appendChild(oThead);

        // tbody — aMsg(에러 목록) 행 렌더
        var oTbody = document.createElement("tbody");

        aMsg.forEach(function (oRowData, idx) {

            var oTr = document.createElement("tr");
            oTr.setAttribute("data-err-row", "X");
            oTr.setAttribute("aria-selected", "false");
            oTr.setAttribute("tabindex", "0");           // 키보드 포커스/선택
            oTr.dataset.odd = (idx % 2 === 1) ? "true" : "false"; // zebra(공통)
            // 더블클릭 시 전달할 원본 행 데이터(GRCOD/OBJID/LINE/UIATK/TYPE 등 전체 보존)
            oTr._rowData = oRowData;

            // data-label = 카드(타일) 뷰에서 셀 앞 라벨(공통 td[data-label]::before)
            var oTdType = document.createElement("td");
            oTdType.className = "u4a-c-etype";
            oTdType.dataset.label = sColType;
            oTdType.textContent = oRowData.TYPE != null ? oRowData.TYPE : "";

            var oTdLine = document.createElement("td");
            oTdLine.className = "u4a-c-eline";
            oTdLine.dataset.label = sColLine;
            oTdLine.textContent = oRowData.LINE != null ? oRowData.LINE : "";

            var oTdDesc = document.createElement("td");
            oTdDesc.className = "u4a-c-edesc";
            oTdDesc.dataset.label = sColDesc;
            oTdDesc.textContent = oRowData.DESC != null ? oRowData.DESC : "";

            oTr.appendChild(oTdType);
            oTr.appendChild(oTdLine);
            oTr.appendChild(oTdDesc);
            oTbody.appendChild(oTr);

        });

        oTable.appendChild(oTbody);
        oWrap.appendChild(oTable);

        // 행 이벤트 위임 — 클릭=선택, 더블클릭/Enter=실행
        oTbody.addEventListener("click", _onRowClick);
        oTbody.addEventListener("dblclick", _onRowDblclick);
        oTbody.addEventListener("keydown", _onRowKeydown);

        var oContent = document.getElementById("content");
        oContent.innerHTML = "";
        oContent.appendChild(oWrap);

        // 반응형 table↔card 토글 가동
        _observeView(oWrap);

    }; // end of oAPP.fn.fnInitRendering

    /************************************************************************
     * -- Start of Program
     ************************************************************************/
    document.addEventListener("DOMContentLoaded", function () {

        // 본문 렌더
        oAPP.fn.fnInitRendering();

        // 렌더 완료 → Busy 해제 + 메인 영역 Busy Lock 해제(기존 동작 유지)
        oAPP.fn.setBusy(false);
        oAPP.IPCRENDERER.send(`if-send-action-${oAPP.BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });

        // 자연스러운 표시 (UI5 fadeIn 대체)
        requestAnimationFrame(function () {
            document.body.classList.add("u4aErrBody--ready");
        });

    });

})(window, oAPP);
