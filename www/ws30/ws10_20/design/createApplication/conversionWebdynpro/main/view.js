/********************************************************************
 *📝 VIEW.JS  (UI5 → HTML5)
 *   내역 : 웹딘(Web Dynpro) 컨버전 화면 구성 영역.
 *
 *   [컨버전 메모]
 *   - 원본: sap.m.Page + sap.ui.layout.form.Form(ResponsiveGridLayout labelSpanL:3, columnsL:1)
 *           + sap.ui.table.Table(VIEW 리스트). → HTML5: 공통 U4AUI.createField(라벨 좌측 그리드,
 *           생성옵션 General/DataSet 탭과 동일 폼) + 공통 .u4a-table(VIEW 리스트).
 *   - 상태(oData)↔DOM 동기는 oContr.fn.render()(원본 oModel.refresh 대체)로 일원화.
 *   - createView 반환 = control.js 의 oContr(ui.ROOT/onEvt/oData/fn/onViewReady). 인터페이스 원본 유지.
 *   - 메시지 키(438~446, 026) / 필드 구성 원본 1:1.
 ********************************************************************/
export async function createView(oParam) {

    const _path = parent.PATH.join(parent.getPath("WS10_20_ROOT"), "design",
        "createApplication", "conversionWebdynpro", "main", "control.js");

    const _mod = await import(_path);
    const oContr = await _mod.createControl(oParam);

    const U = window.U4AUI;

    // ZMSG_WS_COMMON_001 코드 텍스트.
    const _wt = function (sNo) { try { return parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", sNo); } catch (e) { return sNo; } };
    const _el = function (tag, cls, txt) { const o = document.createElement(tag); if (cls) { o.className = cls; } if (txt != null) { o.textContent = txt; } return o; };

    _ensureStyle();

    const ROOT = _el("div", "u4aUawd");
    oContr.ui.ROOT = ROOT;

    /* ── 폼(라벨 좌측 그리드) ─────────────────────────────────── */
    const oForm = _el("div", "u4aUawdForm");
    ROOT.appendChild(oForm);

    // 438 웹딘프로 컴포넌트명을 입력하여 View List 조회.
    //   ★원본: FORM toolbar 의 ObjectStatus 로, visible="{/S_VIS/CREATE_WIZARD}" = 위자드에서만 노출.
    const oHint438 = _el("div", "u4aUawdStatus", _wt("438"));
    oForm.appendChild(oHint438);
    oContr.ui.hint438 = oHint438;

    function _row(sLabel, bReq) {
        const r = _el("div", "u4aUawdRow");
        const lab = _el("label", "u4a-label" + (bReq ? " u4a-label--required" : ""), sLabel);
        const ctl = _el("div", "u4aUawdCtl");
        r.append(lab, ctl);
        oForm.appendChild(r);
        return { row: r, label: lab, ctl: ctl };
    }

    // 439 Web Dynpro 컴포넌트 — F4 + change + clear + 대문자.
    const r1 = _row(_wt("439"), true);
    const fComp = U.createField({
        type: "text", clear: true, upper: true,
        f4: function () { oContr.fn.onValueHelpWDCompName(); },
        onChange: function (v) { oContr.fn.onChangeWebdynComp(v); },
        onClear: function () { oContr.fn.onChangeWebdynComp(""); }
    });
    r1.ctl.appendChild(fComp.el);
    oContr.ui.compField = fComp;

    // 440 Web Dynpro Description — 읽기전용.
    const r2 = _row(_wt("440"), false);
    const fDesc = U.createField({ type: "text", readOnly: true });
    fDesc.input.classList.add("u4aUawdRO");
    r2.ctl.appendChild(fDesc.el);
    oContr.ui.descField = fDesc;

    // 386 Package — F4 + change + clear + 대문자.
    const r3 = _row(_wt("386"), true);
    const fPack = U.createField({
        type: "text", clear: true, upper: true,
        f4: function () { oContr.fn.onValueHelpPackage(); },
        onInput: function (v) { oContr.fn.onPackageLiveReset(v); }, // 입력 중 CTS 즉시 비활성(데이터세트 동일)
        onChange: function (v) { oContr.fn.onChangePackage(v); },
        onClear: function () { oContr.fn.onChangePackage(""); }
    });
    r3.ctl.appendChild(fPack.el);
    oContr.ui.packField = fPack;
    oContr.ui.packRow = r3.row;

    // 441 Request No — F4 only(직접입력 불가) + clear(원본 showClearIcon).
    //   clear 시 CTS 번호(REQNR)와 그 설명(REQTX)을 함께 비운다(옆 General/DataSet 탭 CTS clearAlso 와 동일).
    const r4 = _row(_wt("441"), false);
    const fReq = U.createField({
        type: "text", readOnly: true, clear: true,
        f4: function () { oContr.fn.onValueHelpReqNumber(); },
        onClear: function () {
            const D = oContr.oData;
            D.S_UAWD.REQNR = "";
            D.S_UAWD.REQTX = "";
            D.S_VALST.REQNR = undefined;
            D.S_VALTX.REQNR = "";
            oContr.fn.render();
        }
    });
    fReq.input.classList.add("u4aUawdVho");
    r4.ctl.appendChild(fReq.el);
    oContr.ui.reqnrField = fReq;
    oContr.ui.reqnrRow = r4.row;
    oContr.ui.reqnrLabel = r4.label;

    // 442 Request Description — 읽기전용.
    const r5 = _row(_wt("442"), false);
    const fReqTx = U.createField({ type: "text", readOnly: true });
    fReqTx.input.classList.add("u4aUawdRO");
    r5.ctl.appendChild(fReqTx.el);
    oContr.ui.reqtxField = fReqTx;
    oContr.ui.reqtxRow = r5.row;

    /* ── VIEW 리스트 테이블(위자드 CREATE_WIZARD 에서만 노출) ── */
    const oTableWrap = _el("div", "u4aUawdTableWrap");
    // 443 Select View → Select Create button to switch to U4A UI. (원본 table extension ObjectStatus)
    oTableWrap.appendChild(_el("div", "u4aUawdStatus", _wt("443")));
    // 444 Web Dynpro 뷰 항목.
    oTableWrap.appendChild(_el("div", "u4aUawdTableTitle", _wt("444")));
    const oBox = _el("div", "u4aUawdTableBox u4a-table-wrap--boxed");
    const oTable = _el("table", "u4a-table u4aUawdTable");
    const oThead = _el("thead");
    const oHtr = _el("tr");
    oHtr.append(_el("th", null, _wt("445")), _el("th", null, _wt("446"))); // View Name / View Description
    oThead.appendChild(oHtr);
    const oTbody = _el("tbody");
    oTable.append(oThead, oTbody);
    oBox.appendChild(oTable);
    oTableWrap.appendChild(oBox);
    ROOT.appendChild(oTableWrap);
    oContr.ui.tableWrap = oTableWrap;
    oContr.ui.tbody = oTbody;

    /* ── 위자드 생성 버튼(CREATE_WIZARD 에서만) ── */
    const oWzdBar = _el("div", "u4aUawdWzdBar");
    const oWzdBtn = _el("button", "u4a-btn u4a-btn--emphasized");
    oWzdBtn.type = "button";
    oWzdBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    oWzdBtn.title = _wt("026"); // Create
    oWzdBtn.addEventListener("click", function () { oContr.fn.onCreateWebdynConvUI(); });
    oWzdBar.appendChild(oWzdBtn);
    ROOT.appendChild(oWzdBar);
    oContr.ui.wzdBar = oWzdBar;

    /* ── 렌더(상태 → DOM). 원본 oModel.refresh 대체 ── */
    oContr.fn.render = function () {
        const D = oContr.oData;

        // 값(포커스 중인 편집필드는 덮지 않음).
        if (document.activeElement !== fComp.input) { fComp.setValue(D.S_UAWD.COMP_NAME); }
        fDesc.setValue(D.S_UAWD.COMP_DESC);
        if (document.activeElement !== fPack.input) { fPack.setValue(D.S_UAWD.PACKG); }
        fReq.setValue(D.S_UAWD.REQNR);
        fReqTx.setValue(D.S_UAWD.REQTX);

        // value-state(인라인). ★REQNR 은 비활성(disabled)이면 표시 안 함 — 원본 UI5 editable:false 필드는
        //   valueState 를 렌더하지 않는다(패키지 미입력 시 REQNR 도 모델상 Error 지만 비활성이라 화면엔 X).
        const _reqEnabled = (D.S_EDIT.REQNR === true);
        fComp.setValueState(D.S_VALST.COMP_NAME === "Error" ? "error" : "none", D.S_VALTX.COMP_NAME || "");
        fPack.setValueState(D.S_VALST.PACKG === "Error" ? "error" : "none", D.S_VALTX.PACKG || "");
        fReq.setValueState((_reqEnabled && D.S_VALST.REQNR === "Error") ? "error" : "none", _reqEnabled ? (D.S_VALTX.REQNR || "") : "");

        // REQNR 필수(*) 동적.
        r4.label.classList.toggle("u4a-label--required", D.S_UAWD.REQNR_REQ === true);

        // 가시성.
        oHint438.hidden = !D.S_VIS.CREATE_WIZARD; // 원본: FORM toolbar 안내 = 위자드에서만.
        r3.row.hidden = !D.S_VIS.PACKG;
        r4.row.hidden = !D.S_VIS.REQNR;
        r5.row.hidden = !D.S_VIS.REQTX;
        oTableWrap.hidden = !D.S_VIS.VLIST;
        oWzdBar.hidden = !D.S_VIS.CREATE_WIZARD;

        // REQNR 활성 여부(로컬이면 비활성 — 입력·F4 차단). (_reqEnabled 는 위 value-state 에서 선언됨)
        fReq.input.disabled = !_reqEnabled;
        const _vhBtn = fReq.el.querySelector(".u4a-field__vh");
        if (_vhBtn) { _vhBtn.disabled = !_reqEnabled; }

        _renderRows();
    };

    function _renderRows() {
        const D = oContr.oData;
        oTbody.textContent = "";
        const rows = D.T_VLIST || [];

        if (rows.length === 0) {
            const tr = _el("tr");
            const td = _el("td", "u4a-table__nodata", _wt("946")); // no data
            td.colSpan = 2;
            tr.appendChild(td);
            oTbody.appendChild(tr);
            return;
        }

        for (let i = 0; i < rows.length; i++) {
            const rec = rows[i];
            const tr = _el("tr");
            if (i % 2 === 1) { tr.setAttribute("data-odd", "true"); } // ★공통 shell.css 는 [data-odd="true"] 매치
            if (D._vlistSel === i) { tr.setAttribute("aria-selected", "true"); }
            tr.append(_el("td", null, rec.VIEW_NAME || ""), _el("td", null, rec.VIEW_DESC || ""));
            (function (idx) {
                tr.addEventListener("click", function () { oContr.oData._vlistSel = idx; oContr.fn.render(); });
                tr.addEventListener("dblclick", function () { oContr.fn.onDblClickViewTable(idx); });
            })(i);
            oTbody.appendChild(tr);
        }
    }

    // onAfterRendering(원본) 대체 — 상태 초기화 + busy off.
    await oContr.onViewReady();

    return oContr;
}


/********************************************************************
 *📝 스코프 CSS(1회 주입) — 토큰 기반, 라벨 좌측 폼(생성옵션 탭과 일관).
********************************************************************/
function _ensureStyle() {
    if (document.getElementById("u4aUawdStyle")) { return; }
    const s = document.createElement("style");
    s.id = "u4aUawdStyle";
    s.textContent = [
        ".u4aUawd{display:flex;flex-direction:column;height:100%;min-height:0;gap:.625rem;}",
        /* 원본 ObjectStatus(Indication05) 대체 — 안내성 상태 텍스트. */
        ".u4aUawdStatus{color:var(--accent);font-weight:600;font-size:.8125rem;}",
        ".u4aUawdStatus[hidden]{display:none;}",
        /* ★간격은 옆 General/DataSet 탭과 픽셀 동일(같은 다이얼로그 — 라벨 10.5rem, 행간 1rem, gap .75rem). */
        ".u4aUawdForm{display:flex;flex-direction:column;gap:1rem;flex:0 0 auto;}",
        ".u4aUawdRow{display:grid;grid-template-columns:10.5rem minmax(0,1fr);align-items:center;column-gap:.75rem;}",
        ".u4aUawdRow[hidden]{display:none;}",
        /* ★value-state 메시지 표시 트리거 — 공통 .u4a-field__msg 는 display:none 이라
           .u4a-form__row:focus-within 로만 노출(shell.css). 이 폼은 .u4aUawdRow 라 공통 셀렉터가
           안 먹으므로 동일 규칙을 스코프로 깐다(빨간 테두리는 뜨는데 메시지 안 나오던 원인). */
        ".u4aUawdRow:focus-within .u4a-field__msg:not(:empty){display:inline-flex;}",
        ".u4aUawdRow > .u4a-label{text-align:right;}",
        /* 좁을 때(옆 General/DataSet 탭 @media 560 과 동일) 라벨을 위로 접어 1열 스택. */
        "@media (max-width:560px){.u4aUawdRow{grid-template-columns:1fr;}.u4aUawdRow > .u4a-label{text-align:left;}}",
        ".u4aUawdCtl{min-width:0;}",
        ".u4aUawdCtl .u4a-field{width:100%;max-width:28rem;}",
        /* 읽기전용 표시필드 = 평평/옅은/muted(입력 아님을 구분). */
        ".u4aUawdRO:read-only:not(:disabled){background:transparent;border-color:var(--divider);color:var(--text-muted);}",
        /* F4-only(Request No) 활성 외관 = raised + pointer(값은 F4 로만). 비활성 시 기본 disabled 색. */
        ".u4aUawd .u4aUawdVho:read-only:not(:disabled){background:var(--surface-raised);border-color:var(--divider);color:var(--text);cursor:pointer;}",
        /* VIEW 리스트(위자드에서만). */
        ".u4aUawdTableWrap{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:.25rem;}",
        ".u4aUawdTableWrap[hidden]{display:none;}",
        ".u4aUawdTableTitle{font-weight:700;}",
        ".u4aUawdTableBox{flex:1 1 auto;min-height:0;overflow:auto;}",
        ".u4aUawdWzdBar{display:flex;justify-content:flex-end;flex:0 0 auto;}",
        ".u4aUawdWzdBar[hidden]{display:none;}",
        ""
    ].join("\n");
    document.head.appendChild(s);
}
