/****************************************************************************
 * Binding Popup(대형 별창) "바인딩 추가 속성"(MPROP) 영역 — HTML5
 * --------------------------------------------------------------------------
 *  ★ 원본은 추가속성 패널이 2개다(SPEC §4 / bindAdditInfo.js:1126, index.js:4499):
 *    1) 우측  MAIN_ADDIT  = 스테이징 입력폼(항상 표시, 초기 8행). 신규/일괄 적용용.
 *       소비 3곳 = 좌측필드 드래그 캐리 · 098 멀티일괄 · 디자인트리 행액션 accept.
 *    2) 중앙하단 DESIGN_ADDIT = 이미 바인딩된 디자인트리 1행의 MPROP 열람/수정용.
 *       바인딩경로 링크 클릭 시 표시(vis_addit), 툴바 172 접기 / 139 적용 / 161.
 *  ★ 두 패널은 서로 다른 스토어를 갖는다(코덱스 교차검증 2026-07-16):
 *       우측  = oAPP.attr.additRows      (CTX.MAIN)
 *       중앙하단= oAPP.attr.additRowsSel  (CTX.SEL)
 *     내부 helper 가 전역 additRows 를 암묵 참조하면 두 패널이 다시 섞이므로,
 *     모든 렌더/DDLB 함수는 ctx(스토어·host·tbody) 를 명시로 받는다.
 *
 *  ★ 행 P01~P08(원본 setAdditBindInfo 1:1):
 *      P01 Field name(txt) · P02 Field path(txt) · P03 type(txt) ·
 *      P04 Bind type(sel, 참조필드 DDLB, P타입만 편집) · P05 Reference Field name(sel, CUKY/UNIT 있을때만) ·
 *      P06 Conversion Routine(inp, maxlen5) · P07 Nozero(sel true/false, default false) ·
 *      P08 Is number format?(sel true/false, default false).
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.H) { return; }

    var H = oAPP.H;

    // 패널 컨텍스트 — 우측(MAIN) / 중앙하단(SEL). host/tbody 는 initAdditArea 에서 채움.
    var oA = {
        MAIN: { tool: null, host: null, tbody: null, tab: "MAIN_ADDIT", store: "additRows", hostId: "bwpAdditInfo", toolId: "bwpAdditInfoTool" },
        SEL: { tool: null, host: null, tbody: null, tab: "DESIGN_ADDIT", store: "additRowsSel", hostId: "bwpAdditApply", toolId: "bwpAdditApplyTool", statEl: null }
    };
    // 스토어 접근(코덱스: 읽기/쓰기에 어느 패널인지 명시).
    function _rows(ctx) { return oAPP.attr[ctx.store] || []; }
    function _setRows(ctx, a) { oAPP.attr[ctx.store] = a; }

    // Nozero 불가 타입(원본 l_nozero) / number format 가능 타입(원본 l_numfmt).
    var CS_NOZERO_NG = "Cg", CS_NUMFMT_OK = "IP";

    // 161 컬럼최적화 — 공통 평면표의 컬럼 자동맞춤(내용 최장 폭). 원본 setUiTableAutoResizeColumn 대응. 실패 무해.
    function _fitCols(ctx) {
        if (!ctx || !ctx.dt || typeof ctx.dt.autoFit !== "function") { return; }
        try { ctx.dt.autoFit(); } catch (e) { console.error("[HTML5][bindWindow] additFitCols:", e && e.message); }
    }

    // 161 컬럼최적화 외부 노출(우측 MAIN 버튼용 — 원본 setUiTableAutoResizeColumn 대응).
    oAPP.fn.additFitCols = function () { _fitCols(oA.MAIN); };

    /* ── 공통 평면표(속성|값 2열) 생성 — 모달과 동일 컴포넌트·옵션(격자 + 컬럼 폭 드래그 조절). 컨텍스트당 1회 생성 후 행만 갱신. ── */
    function _buildTable(ctx) {
        ctx.dt = U4AUI.makeDataTable(ctx.host, {
            virtual: false, grid: true, resizable: true, selectable: false, zebra: false,
            tableClass: "u4aBwpAdditTbl",
            columns: [
                {
                    label: H.z("177"),   // 177 Property(속성)
                    cell: function (r) {
                        var s = H.el("span", "u4aBwpAdditProp", r.prop || "");
                        if (r.prop) { s.setAttribute("data-tip", r.prop); s.setAttribute("data-tip-trunc", ""); }
                        return s;
                    }
                },
                {
                    label: H.z("178"), cellClass: "u4aBwpAdditVal",   // 178 Value(값)
                    cell: (function (cx) { return function (r) { return _additValCell(cx, r); }; })(ctx)
                }
            ],
            rowHook: function (oTr, r) {
                if (r && r.ITMCD) { oTr.setAttribute("data-itmcd", r.ITMCD); }   // [SPEC §6] 오류 위치 이동/강조 대상 식별
                if (r && r.stat === "Error") { oTr.classList.add("u4aBwpAdditRow--error"); }   // 오류 행 표시
                // [R1] 필드(입력/선택) 값셀은 공통 말줄임 툴팁 대상에서 제외(숨은 검증 메시지 hover 누수 차단).
                if (r && (r.sel_vis || r.inp_vis)) { var oV = oTr.cells[1]; if (oV) { oV.setAttribute("data-tip", ""); } }
            }
        });
        ctx.tbody = ctx.dt.tbody;   // 기존 ctx.tbody 참조 호환(refreshAdditFieldsLock truthy 체크 등).
    }

    // 값 셀 빌더 — 콤보(P04↔P05 연동) / Conversion 입력(검증·포커스 팝오버) / 읽기전용 텍스트. 원본 _renderRows 값셀 1:1.
    //   ★ 편집가능(bEnabled)은 재렌더마다 바뀌므로 매 호출 실시간 판독(makeDataTable setRows 가 cell 재호출).
    function _additValCell(ctx, r) {
        var bEnabled = (!!oAPP.attr.editable && oAPP.attr.bSyncDialogLock !== true) && r.edit;
        if (r.sel_vis) {
            var aItems = (r.T_DDLB || []).map(function (d) { return { value: d.KEY, text: d.TEXT }; });
            var oSel = U4AUI.createField({
                type: "combo", items: aItems, value: r.val || "", disabled: !bEnabled,
                // ★ P04↔P05 동기화 판정은 클로저 안에서 row.ITMCD 로 직접(행별 캡처).
                onChange: (function (row, cx) { return function (v) { row.val = v; if (row.ITMCD === "P04" || row.ITMCD === "P05") { oAPP.fn.setAddtBindInfoDDLB(row, cx); } }; })(r, ctx)
            });
            return oSel.el;
        }
        if (r.inp_vis) {
            var bConv = (r.ITMCD === "P06");
            var oInp = U4AUI.createField({
                type: "text", value: r.val || "",
                // [R1] 검증 메시지 = 원본 UI5 ValueState.Error 재현(빨간 테두리 + 포커스 시 top-layer 팝오버 _bwpVsShow).
                className: "u4aBindAdditField",
                maxLength: (r.maxlen != null ? r.maxlen : undefined),
                disabled: !bEnabled, clear: bEnabled, upper: bConv,
                onChange: (function (row) { return function (v) { row.val = v; if (bConv) { oAPP.fn.convChangeInput(row, oInp); } }; })(r),
                onInput: bConv ? (function (row) { return function () { oAPP.fn.clearConvError(row, oInp); }; })(r) : undefined,
                onClear: (function (row) { return function () { row.val = ""; if (bConv) { oAPP.fn.clearConvError(row, oInp); } }; })(r)
            });
            if (bConv && r.stat === "Error") { try { oInp.setValueState("error", r.statTxt || ""); } catch (e) { } }
            if (bConv) {
                (function (row, inpEl) {
                    inpEl.addEventListener("focus", function () { oAPP.fn._bwpVsShow(inpEl, row); });
                    inpEl.addEventListener("blur", function () { oAPP.fn._bwpVsHide(); });
                })(r, oInp.input);
            }
            return oInp.el;
        }
        var oTxt = H.el("span", "u4aBwpAdditTxt", r.val || "");
        if (r.val) { oTxt.setAttribute("data-tip", r.val); oTxt.setAttribute("data-tip-trunc", ""); }
        return oTxt;
    }

    /* ── 영역 초기화(frame.js _bootApp → initAdditArea) — 두 패널 모두 구성 ──── */
    oAPP.fn.initAdditArea = function () {
        oA.MAIN.tool = document.getElementById(oA.MAIN.toolId);
        oA.MAIN.host = document.getElementById(oA.MAIN.hostId);
        oA.SEL.tool = document.getElementById(oA.SEL.toolId);
        oA.SEL.host = document.getElementById(oA.SEL.hostId);

        // ── 우측(MAIN) 툴바 — 098 추가 속성 바인딩 / 161 / 957 / 198 (원본 bindAdditInfo.js:1102) ──
        if (oA.MAIN.tool && oA.MAIN.host) {
            oA.MAIN.tool.innerHTML = "";
            var bRO = !oAPP.attr.editable;
            var oBind = H.el("button", "u4a-btn u4a-btn--emphasized");
            oBind.type = "button";
            oBind.innerHTML = H.fa("layer-group");
            oBind.appendChild(document.createTextNode(H.z("098")));   // 098 추가 속성 바인딩
            oBind.title = H.z("098");
            oBind.setAttribute("data-bwp-lock", "additbind");   // [S1a] setAdditBindButtonEnable 대상.
            if (bRO) { oBind.disabled = true; }
            oBind.addEventListener("click", function () {
                if (typeof oAPP.fn.onMultiAdditionalBind === "function") {
                    try { oAPP.fn.onMultiAdditionalBind(oBind); } catch (e) { console.error("[HTML5][bindWindow] onMultiAdditionalBind:", e && e.message); }
                }
            });
            oA.MAIN.tool.appendChild(oBind);
            oA.MAIN.tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
            oA.MAIN.tool.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () { _fitCols(oA.MAIN); }));   // 161 컬럼최적화
            var _oGearAddit = H.iconBtn("gear", H.z("957"), function () {   // 957 화면 커스터마이징
                if (oAPP.attr.editable === false) { return; }
                if (typeof oAPP.fn.openLayoutCustomizingPopup === "function") { oAPP.fn.openLayoutCustomizingPopup(); }
            });
            _oGearAddit.setAttribute("data-bwp-lock", "layout-addit");   // [S1a] setLayoutCustomizingEditable 대상.
            oA.MAIN.tool.appendChild(_oGearAddit);
            oA.MAIN.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
                // [B4] 추가속성 도움말 문서 "000274"(원본 bindAdditInfo.js:348). 영역별 라우팅.
                if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp("000274"); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
            }));
            oAPP.fn.attachToolOverflow(oA.MAIN.tool);

            _buildTable(oA.MAIN);
            oAPP.fn.setAdditialListData();   // 우측 = 초기 8행 스테이징.
        }

        // ── 중앙 하단(SEL) 툴바 — 172 접기 / 139 추가속성적용 / 상태 / 161 (원본 index.js:4273) ──
        if (oA.SEL.tool && oA.SEL.host) {
            oA.SEL.tool.innerHTML = "";
            // 172 Collapse(접기) — 원본 press: clearSelectAdditBind + setAdditLayout("").
            var oCol = H.el("button", "u4a-btn u4a-btn--emphasized");
            oCol.type = "button";
            oCol.innerHTML = H.fa("down-left-and-up-right-to-center");
            oCol.appendChild(document.createTextNode(H.z("172")));   // 172 Collapse
            oCol.title = H.z("172");
            oCol.addEventListener("click", function () {
                oAPP.fn.clearSelectAdditBind();   // [표준] 필수 호출 직접(삼킴 제거).
                oAPP.fn.setAdditLayout("");
            });
            oA.SEL.tool.appendChild(oCol);
            // 139 추가속성적용 — 원본 press: onAdditBind(enabled {/edit}).
            var oApply = H.el("button", "u4a-btn u4a-btn--emphasized");
            oApply.type = "button";
            oApply.innerHTML = H.fa("check");
            oApply.appendChild(document.createTextNode(H.z("139")));   // 139 추가속성적용
            oApply.title = H.z("139");
            oApply.setAttribute("data-bwp-lock", "edit");   // [S1a] setViewEditable(edit) 주 대상 = 중앙하단 적용버튼.
            if (!oAPP.attr.editable) { oApply.disabled = true; }
            oApply.addEventListener("click", function () {
                if (typeof oAPP.fn.applyDesignAdditBind === "function") {
                    try { oAPP.fn.applyDesignAdditBind(oApply); } catch (e) { console.error("[HTML5][bindWindow] applyDesignAdditBind:", e && e.message); }
                }
            });
            oA.SEL.tool.appendChild(oApply);
            // 선택 attribute 상태(원본 ObjectStatus S_SEL_ATTR OBJID/UIATT).
            oA.SEL.statEl = H.el("span", "u4aBwpAdditSelStat");
            oA.SEL.tool.appendChild(oA.SEL.statEl);
            oA.SEL.tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
            oA.SEL.tool.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () { _fitCols(oA.SEL); }));   // 161 컬럼최적화
            oAPP.fn.attachToolOverflow(oA.SEL.tool);

            _buildTable(oA.SEL);
            _setRows(oA.SEL, []);
            _renderRows(oA.SEL);   // 초기 빈(숨김 상태 = frame.css u4aBwpShowAddit 없음).
        }
    };

    // 중앙하단 상태 텍스트 갱신(원본 ObjectStatus title/text = S_SEL_ATTR OBJID/UIATT).
    function _updateSelStat() {
        if (!oA.SEL.statEl) { return; }
        var s = oAPP.attr.S_SEL_ATTR || {};
        var sTxt = (s.OBJID || "") + (s.UIATT ? (" · " + s.UIATT) : "");
        oA.SEL.statEl.textContent = sTxt;
        if (sTxt) { oA.SEL.statEl.setAttribute("data-tip", sTxt); oA.SEL.statEl.setAttribute("data-tip-trunc", ""); }
        else { oA.SEL.statEl.removeAttribute("data-tip"); }
    }

    /************************************************************************
     * 우측(MAIN) 첫 실행 8행 기본형 — 원본 setAdditialListData(bindAdditInfo.js:870) 1:1.
     ************************************************************************/
    oAPP.fn.setAdditialListData = function () {
        var aT9011 = oAPP.attr.T_9011 || [];
        var aBool = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];
        var aRefList = [{ KEY: "", TEXT: "" }];
        aT9011.filter(function (a) { return a.CATCD === "UA022" && a.FLD03 === "X"; })
            .forEach(function (a) { aRefList.push({ KEY: a.FLD01, TEXT: a.FLD01 }); });
        var aUa028 = aT9011.filter(function (a) { return a.CATCD === "UA028"; })
            .slice().sort(function (a, b) { return a.ITMCD.localeCompare(b.ITMCD); });

        var aMprop = [];
        for (var i = 0; i < aUa028.length; i++) {
            var s = aUa028[i];
            var r = {
                ITMCD: s.ITMCD, prop: s.FLD01, val: "", stat: "None", statTxt: "", isFieldInfo: false,
                edit: false, inp_vis: false, sel_vis: false, txt_vis: false, maxlen: null, T_DDLB: null
            };
            switch (s.ITMCD) {
                case "P01": case "P02": case "P03":
                    r.isFieldInfo = true;
                    break;
                case "P04":
                    r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aRefList));
                    break;
                case "P05":
                    r.sel_vis = true;
                    // UI5 Select 는 항목 없어도 빈 줄 하나를 렌더 — 공란 1개로 모양새 재현(장군님 지시).
                    r.T_DDLB = [{ KEY: "", TEXT: "" }];
                    break;
                case "P06":
                    r.maxlen = 5; r.edit = true; r.inp_vis = true;
                    break;
                case "P07":
                    r.val = "false"; r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                case "P08":
                    r.val = "false"; r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                default:
                    break;
            }
            aMprop.push(r);
        }
        _setRows(oA.MAIN, aMprop);
        _renderRows(oA.MAIN);
    };

    /************************************************************************
     * 중앙하단(SEL) 추가속성 정보 구성 — 원본 setAdditBindInfo(index.js:3064) 1:1.
     *   바인딩경로 링크 클릭(designArea _showBindAdditInfo)에서 호출. ★ SEL 스토어에만 쓴다.
     ************************************************************************/
    oAPP.fn.setAdditBindInfo = function (is_tree, MPROP, it_parent) {
        is_tree = is_tree || { KIND: "", NTEXT: "", CHILD: "", TYPE: "", TYPE_KIND: "" };
        it_parent = it_parent || [];

        var aMprop = [];

        if (is_tree.KIND !== "E") {
            _setRows(oA.SEL, []);
            _renderRows(oA.SEL);
            _updateSelStat();
            return;
        }

        var aT9011 = oAPP.attr.T_9011 || [];
        var aRefList = [{ KEY: "", TEXT: "" }];
        aT9011.filter(function (a) { return a.CATCD === "UA022" && a.FLD03 === "X"; })
            .forEach(function (a) { aRefList.push({ KEY: a.FLD01, TEXT: a.FLD01 }); });
        var aBool = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];
        var aUa028 = aT9011.filter(function (a) { return a.CATCD === "UA028"; })
            .slice().sort(function (a, b) { return a.ITMCD.localeCompare(b.ITMCD); });

        var aSplit = (typeof MPROP !== "undefined" && MPROP !== "") ? MPROP.split("|") : [];

        for (var i = 0; i < aUa028.length; i++) {
            var s = aUa028[i];
            var r = {
                ITMCD: s.ITMCD, prop: s.FLD01,
                val: "", stat: "None", statTxt: "", isFieldInfo: false,
                edit: (s.FLD02 !== "X"), inp_vis: false, sel_vis: false, txt_vis: false,
                maxlen: null, T_DDLB: null
            };

            switch (s.ITMCD) {
                case "P01":
                    r.val = is_tree.NTEXT; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P02":
                    r.val = is_tree.CHILD; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P03":
                    r.val = is_tree.TYPE; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P04":
                    if (aSplit.length > 0) { r.val = aSplit[0]; }
                    r.sel_vis = true;
                    if (is_tree.TYPE_KIND !== "P") { r.edit = false; }
                    r.T_DDLB = JSON.parse(JSON.stringify(aRefList));
                    break;
                case "P05":
                    if (aSplit.length > 0) { r.val = aSplit[1]; }
                    r.sel_vis = true;
                    r.edit = false;
                    // UI5 Select 는 항목 없어도 빈 줄 하나를 렌더 — 공란 1개 기본(장군님 지시). CUKY/UNIT 있으면 뒤에 추가.
                    r.T_DDLB = [{ KEY: "", TEXT: "" }];
                    var aFilt = it_parent.filter(function (a) { return a.DATATYPE === "CUKY" || a.DATATYPE === "UNIT"; });
                    if (aFilt.length !== 0) {
                        r.edit = true;
                        aFilt.forEach(function (a) { r.T_DDLB.push({ KEY: a.CHILD, TEXT: a.CHILD }); });
                    }
                    if (aSplit.length === 0 || aSplit[0] === "") { r.edit = false; }
                    break;
                case "P06":
                    r.maxlen = 5;
                    if (aSplit.length > 0) { r.val = aSplit[2]; }
                    if (aSplit.length > 0 && aSplit[0] !== "") { r.edit = false; }
                    r.inp_vis = true;
                    break;
                case "P07":
                    if (aSplit.length > 0) { r.val = aSplit[3]; }
                    if (r.val === "") { r.val = "false"; }
                    r.sel_vis = true;
                    if (CS_NOZERO_NG.indexOf(is_tree.TYPE_KIND) !== -1) { r.edit = false; }
                    r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                case "P08":
                    if (aSplit.length > 0) { r.val = aSplit[4]; }
                    if (r.val === "") { r.val = "false"; }
                    r.sel_vis = true;
                    if (CS_NUMFMT_OK.indexOf(is_tree.TYPE_KIND) === -1) { r.edit = false; }
                    r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                default:
                    r.txt_vis = true;
                    break;
            }
            aMprop.push(r);
        }

        _setRows(oA.SEL, aMprop);
        _renderRows(oA.SEL);
        _updateSelStat();
    };

    /************************************************************************
     * [P3-A 검증] 추가속성 바인딩 가능여부 — 원본 chkPossibleAdditBind(bindAdditInfo.js:440) 1:1.
     *   ★ 098 멀티/행액션(우측 MAIN) 경로 전용. 값 판정은 우측 additRows(MAIN) 기준.
     ************************************************************************/
    oAPP.fn.chkPossibleAdditBind = function (is_attr) {
        var _sRes = { RETCD: "", RTMSG: "" };
        if (is_attr.DATYP !== "02") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("148"); return _sRes; }
        if (is_attr.UIATY !== "1") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("148"); return _sRes; }
        if (is_attr.UIATV === "" || is_attr.ISBND === "") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("149"); return _sRes; }
        _sRes = oAPP.fn.chkModelFiendAdditData(is_attr.UIATV);
        return _sRes;
    };

    /************************************************************************
     * [P3-A 검증] 모델필드 기준 — 원본 chkModelFiendAdditData(495) 1:1. 우측 MAIN 값 기준.
     ************************************************************************/
    oAPP.fn.chkModelFiendAdditData = function (modelField) {
        var _sRes = { RETCD: "", RTMSG: "" };

        var _sField = oAPP.fn.getModelBindData(modelField, oAPP.attr.modelTree);
        if (typeof _sField === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("150", modelField); return _sRes; }
        if (_sField.KIND !== "E") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("151"); return _sRes; }

        var _aMPROP = _rows(oA.MAIN);

        var _sP04 = _aMPROP.find(function (i) { return i.ITMCD === "P04"; });
        if (typeof _sP04 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("092"); return _sRes; }
        if (_sP04.val !== "" && _sField.TYPE_KIND !== "P") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("093"); return _sRes; }

        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (typeof _sP05 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("136"); return _sRes; }
        if (_sP05.val !== "") {
            if (_sP05.val.substr(0, _sP05.val.lastIndexOf("-")) !== _sField.CHILD.substr(0, _sField.CHILD.lastIndexOf("-"))) {
                _sRes.RETCD = "E"; _sRes.RTMSG = H.z("152"); return _sRes;
            }
        }

        var _sP07 = _aMPROP.find(function (i) { return i.ITMCD === "P07"; });
        if (typeof _sP07 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("094"); return _sRes; }
        if (_sP07.val === "true" && "Cg".indexOf(_sField.TYPE_KIND) !== -1) { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("095"); return _sRes; }

        var _sP08 = _aMPROP.find(function (i) { return i.ITMCD === "P08"; });
        if (typeof _sP08 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("096"); return _sRes; }
        if (_sP08.val === "true" && "IP".indexOf(_sField.TYPE_KIND) === -1) { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("097"); return _sRes; }

        return _sRes;
    };

    /************************************************************************
     * [P3-B 서버검증] Conversion Routine(P06) — 원본 checkConversion/convChangeInput/clearConvError 1:1.
     *   ★ 행 r 만 갱신(스토어 무관) — value-state 는 그 입력칸 ctrl 에 직접.
     ************************************************************************/
    function _clearRowErr(r) { r.stat = null; r.statTxt = ""; r._error = false; r._error_msg = ""; }

    // [오류표시 통일] 입력칸(oInp)이 속한 행 <tr> 에 오류 라인 강조(u4aBwpAdditRow--error) 토글.
    //   원본은 conversion 오류 시 oContr.oModel.refresh()(bindAdditInfo.js:423)로 테이블을 다시 그려 행 전체가
    //   빨개진다. HTML5 는 실시간 입력 포커스 유지를 위해 재렌더 대신 그 행에만 클래스를 직접 토글한다
    //   (재렌더 경로 additInfoArea.js:755 와 동일 클래스 — 디자인 트리 오류행과 통일된 라인 빨강).
    function _bwpAdditRowErr(oInp, bOn) {
        var oTr = (oInp && oInp.input && oInp.input.closest) ? oInp.input.closest("tr") : null;
        if (!oTr) { return; }
        oTr.classList.toggle("u4aBwpAdditRow--error", bOn === true);
    }

    oAPP.fn.checkConversion = function (convName) {
        return new Promise(function (resolve) {
            var _sRes = { RETCD: "", RTMSG: "" };
            if (convName === "") { return resolve(_sRes); }
            var oFormData = new FormData();
            oFormData.append("CONVEXIT", convName);
            oAPP.fn.sendAjax(oAPP.attr.servNm + "/chkConvExit", oFormData, function (param) {
                if (param && param.RETCD === "E") {
                    _sRes.RETCD = param.RETCD;
                    // ★ chkConvExit 오류 = "Conversion Routine 존재 안 함" 단일 종류(원본 index.js:5297 은 서버 param.RTMSG 를 그대로 표시).
                    //   [.analy/17] 서버 영문 문구를 백엔드 WsMsgCls.relocalize 로 현지화하려 했으나, 부분매핑으로
                    //   "변환 루틴 does not exist"(로컬조각 D76 + 영문 잔존) 잡탕이 나온다(백엔드 수정 불가 — 장군님 확인 08-10).
                    //   → 이 오류는 종류가 하나뿐이므로 로컬 완성 문구 138("…Conversion Routine 이 존재하지 않습니다")로 고정한다.
                    _sRes.RTMSG = H.z("138");
                }
                resolve(_sRes);
            });
        });
    };

    oAPP.fn.convChangeInput = async function (r, oInp) {
        oAPP.fn.setBusy(true);
        if (!r || r.ITMCD !== "P06") { oAPP.fn.setBusy(false); return; }
        // 빈 값 = 에러 해제 → in-cell/입력칸 상태 + top-layer 팝오버 모두 내림.
        if (r.val === "") { _clearRowErr(r); if (oInp) { oInp.setValueState("none", ""); } _bwpAdditRowErr(oInp, false); oAPP.fn._bwpVsHide(); oAPP.fn.setBusy(false); return; }
        var _sRes = await oAPP.fn.checkConversion(r.val);
        if (_sRes.RETCD === "E") {
            r.stat = "Error"; r.statTxt = _sRes.RTMSG; r._error = true; r._error_msg = _sRes.RTMSG;
            if (oInp) { oInp.setValueState("error", _sRes.RTMSG); }
            _bwpAdditRowErr(oInp, true);   // [오류표시 통일] 그 라인 전체를 빨강으로(원본 refresh 재현, 재렌더 없이).
            oAPP.fn.setBusy(false);   // busy 먼저 내려야(오버레이 제거) 재포커스가 먹는다.
            // [원본 UI5 아키텍처 재현] 엔터/blur 로 값이 바뀌어 오류가 나면 UI5 는 busy 로 잠깐 blur 됐다가
            //   오류 필드에 ★포커스를 되돌리고★ ValueState 메시지를 띄운다(장군님 지적 2026-07-29).
            //   HTML5 엔 자동 재포커스가 없으므로 명시적으로 재포커스 + top-layer 팝오버 표시 —
            //   그래야 "다른 곳을 클릭해 blur 시켜도 오류면 이 칸으로 다시 돌아오고 메시지가 뜬다".
            //   ★_bwpVsShow 는 DOM 입력요소(oInp.input)를 받는다(794행 배선과 동일) — 래퍼 넘기면 위치계산 실패.
            if (oInp && oInp.input) {
                try { oInp.input.focus(); } catch (e) { }
                oAPP.fn._bwpVsShow(oInp.input, r);
            }
            return;
        }
        _clearRowErr(r);
        if (oInp) { oInp.setValueState("none", ""); }
        _bwpAdditRowErr(oInp, false);
        oAPP.fn._bwpVsHide();   // 정상 값 → 팝오버 내림
        oAPP.fn.setBusy(false);
    };

    oAPP.fn.clearConvError = function (r, oInp) {
        if (!r || r.ITMCD !== "P06") { return; }
        _clearRowErr(r);
        if (oInp) { oInp.setValueState("none", ""); }
        _bwpAdditRowErr(oInp, false);
        oAPP.fn._bwpVsHide();   // X(clear)·타이핑 등으로 에러 해제 시 top-layer 팝오버도 내림
    };

    /************************************************************************
     * [P3-C 상호배타] Bind type(P04) ↔ Reference Field(P05) / Conversion(P06)
     *   — 원본 setAddtBindInfoDDLB(index.js:8276) 1:1. ★ ctx 패널 내부에서만 작동(코덱스: 패널별 독립).
     ************************************************************************/
    oAPP.fn.setAddtBindInfoDDLB = function (r, ctx) {
        ctx = ctx || oA.MAIN;
        var _aMPROP = _rows(ctx);
        r.stat = null; r.statTxt = "";
        if (r.ITMCD !== "P04" && r.ITMCD !== "P05") { _renderRows(ctx); return; }

        var ls_P04 = _aMPROP.find(function (a) { return a.ITMCD === "P04"; });
        var ls_P05 = _aMPROP.find(function (a) { return a.ITMCD === "P05"; });
        var ls_P06 = _aMPROP.find(function (a) { return a.ITMCD === "P06"; });
        if (!ls_P04 || !ls_P05 || !ls_P06) { return; }

        if (r.ITMCD === "P04" && r.val === "") { ls_P05.val = ""; }
        if (r.ITMCD === "P05" && r.val === "") { ls_P04.val = ""; }

        if (ls_P04.val === "") {
            ls_P05.edit = false; ls_P05.val = ""; ls_P06.edit = true;
        } else if (r.val !== "") {
            ls_P05.edit = true; ls_P06.edit = false; ls_P06.val = "";
            _clearRowErr(ls_P06);
        }
        _renderRows(ctx);
    };

    /************************************************************************
     * [P3-C 참조필드] Reference Field(P05) DDLB — 원본 setRefFieldList/clearRefField 1:1.
     *   ★ 원본은 우측(MAIN) 모듈 전용(bindAdditInfo.js:706, 모델트리 선택 onSelTabRow에서 호출). MAIN 고정.
     ************************************************************************/
    oAPP.fn.clearRefField = function () {
        var _aMPROP = _rows(oA.MAIN);
        if (_aMPROP.length === 0) { return; }
        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (!_sP05) { return; }
        // 원본 데이터는 [] 지만 UI5 Select 위젯은 항목이 없어도 빈 줄 하나를 렌더한다.
        //   공통 콤보는 items 0개면 아무것도 안 보이므로, 그 모양새를 공란 1개로 재현(장군님 지시 2026-07-23).
        _sP05.val = ""; _sP05.T_DDLB = [{ KEY: "", TEXT: "" }];
        _renderRows(oA.MAIN);
    };

    oAPP.fn.setRefFieldList = function () {
        var _aTree = (typeof oAPP.fn.getSelectedDesignTree === "function") ? (oAPP.fn.getSelectedDesignTree() || []) : [];
        var _aField = [];
        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            if (_sTree.UIATV === "" || _sTree.ISBND === "") { continue; }
            if (_sTree.UIATY !== "1") { oAPP.fn.clearRefField(); return; }
            var _field = _sTree.UIATV.substr(0, _sTree.UIATV.lastIndexOf("-"));
            if (_aField.indexOf(_field) === -1) { _aField.push(_field); }
        }
        var _sMField = (typeof oAPP.fn.getSelectedModelLine === "function") ? oAPP.fn.getSelectedModelLine() : undefined;
        if (_sMField && _aField.indexOf(_sMField.PARENT) === -1) { _aField.push(_sMField.PARENT); }

        if (_aField.length > 1) { oAPP.fn.clearRefField(); return; }

        var _sField = oAPP.fn.getModelBindData(_aField[0], oAPP.attr.modelTree);
        if (typeof _sField === "undefined") { oAPP.fn.clearRefField(); return; }

        var _aFilt = (_sField.zTREE || []).filter(function (it) { return it.DATATYPE === "CUKY" || it.DATATYPE === "UNIT"; });
        if (_aFilt.length === 0) { oAPP.fn.clearRefField(); return; }

        var _aMPROP = _rows(oA.MAIN);
        if (_aMPROP.length === 0) { return; }
        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (!_sP05) { return; }

        _sP05.T_DDLB = [{ KEY: "", TEXT: "" }];
        for (var j = 0; j < _aFilt.length; j++) { _sP05.T_DDLB.push({ KEY: _aFilt[j].CHILD, TEXT: _aFilt[j].CHILD }); }
        if (_sP05.T_DDLB.findIndex(function (it) { return it.KEY === _sP05.val; }) === -1) { _sP05.val = ""; }
        _renderRows(oA.MAIN);
    };

    /************************************************************************
     * [P3-D 적용] MPROP 직렬화 — 원본 setAdditBindData(index.js:5316) 1:1. 파라미터 배열(스토어 무관).
     ************************************************************************/
    oAPP.fn.setAdditBindData = function (aMPROP) {
        if (typeof aMPROP === "undefined") { return; }
        var _a = aMPROP.filter(function (i) { return i.isFieldInfo === false; });
        _a.sort(function (a, b) { return a.ITMCD.localeCompare(b.ITMCD); });
        return _a.map(function (i) { return i.val; }).join("|");
    };

    /************************************************************************
     * [P3-D 검증] 입력 완결성 — 원본 chkAdditBindData(index.js:4886) 간이판.
     *   @param sPanel "SEL"=중앙하단(additRowsSel), 그 외=우측 MAIN(additRows).
     *   ★ 원본은 oTab.data(TAB_NAME) 으로 ACTCD 라우팅만 분기(검증 로직 동일) — P6에서 정교화.
     ************************************************************************/
    oAPP.fn.chkAdditBindData = function (sPanel) {
        var ctx = (sPanel === "SEL") ? oA.SEL : oA.MAIN;
        var a = _rows(ctx);
        var A = oAPP.attr.CS_MSG_ACTCD || {};
        // 원본 chkAdditBindData(index.js:4895) TAB_NAME 분기: MAIN=ACT03(영역)/ACT05(행), DESIGN=ACT06/ACT07.
        var _ACTCD01 = (ctx === oA.SEL) ? A.ACT06 : A.ACT03;   // 영역 단위 오류.
        var _ACTCD02 = (ctx === oA.SEL) ? A.ACT07 : A.ACT05;   // 행 단위 오류(LINE_KEY=ITMCD).
        var _res = { RETCD: "", RTMSG: "", T_RTMSG: [] };

        // 영역 오류(LK_VIS=false — 이동할 행이 없음).
        function _errArea(sMsg, sDesc) {
            _res.RETCD = "E"; _res.RTMSG = sMsg;
            _res.T_RTMSG.push(oAPP.fn.newBindError({ ACTCD: _ACTCD01, TYPE: "Error", TITLE: sMsg, DESC: sDesc || sMsg, LK_VIS: false }));
            return _res;
        }
        // 행 오류(LINE_KEY=ITMCD → "오류 위치 확인"으로 그 행 강조).
        function _errRow(sItmcd, sMsg, sDesc) {
            _res.RETCD = "E"; _res.RTMSG = sMsg;
            _res.T_RTMSG.push(oAPP.fn.newBindError({ ACTCD: _ACTCD02, LINE_KEY: sItmcd, TYPE: "Error", TITLE: sMsg, DESC: sDesc || sMsg }));
        }

        // ★ DESC 는 원본 그대로: 구조 누락(133/135/136/138) = 131(관리자 문의), 134 = 자기 자신,
        //   137 = 105(Reference Field 입력), P06 서버오류 = 서버 RTMSG. (원본 index.js:4917~ 1:1)
        if (a.length === 0) { return _errArea(H.z("133"), H.z("131")); }                             // 133 추가속성 정보 없음.
        if (a.findIndex(function (i) { return i.val !== ""; }) === -1) { return _errArea(H.z("134")); }   // 134 입력건 없음(DESC=TITLE).
        var p04 = a.find(function (i) { return i.ITMCD === "P04"; });
        if (!p04) { return _errArea(H.z("135"), H.z("131")); }                                       // 135 Bind type 없음.
        var p05 = a.find(function (i) { return i.ITMCD === "P05"; });
        if (!p05) { return _errArea(H.z("136"), H.z("131")); }                                       // 136 Reference Field 없음.
        if (p04.val !== "" && p05.val === "") { _errRow(p05.ITMCD, H.z("137"), H.z("105")); }         // 137 필수 / DESC=105 입력 안내.
        var p06 = a.find(function (i) { return i.ITMCD === "P06"; });
        if (!p06) { return _errArea(H.z("138"), H.z("131")); }                                       // 138 Conversion 없음.
        if (p06._error === true) { _errRow(p06.ITMCD, p06._error_msg || H.z("138")); }               // P06 서버검증 오류(이미 로컬 DB 로 현지화된 문구).
        return _res;
    };

    // [SPEC §6] 검증 오류 표시 — 목록 팝오버(앵커 필요), 없으면 토스트 폴백.
    async function _showErrPop(oAnchor, oRes) {
        var aMsg = (oRes && oRes.T_RTMSG) || [];
        if (oAnchor && aMsg.length && typeof oAPP.fn.showMessagePopoverOppener === "function") {
            await oAPP.fn.showMessagePopoverOppener(oAnchor, aMsg);
            return;
        }
        if (oRes && oRes.RTMSG) { oAPP.fn.toast(oRes.RTMSG); }
    }

    /************************************************************************
     * [SPEC §6] 추가속성 행 오류 표시/해제 — 원본 setFocusErrorBindAdditLine /
     *   setFocusErrorDesignBindAdditLine(showMessagePopover.js) 1:1.
     *   @param sItmcd P04~P08 / @param sPanel "SEL"=중앙하단, 그 외=우측 MAIN.
     ************************************************************************/
    oAPP.fn.focusErrorAdditLine = function (sItmcd, sPanel) {
        var ctx = (sPanel === "SEL") ? oA.SEL : oA.MAIN;
        oAPP.fn.clearAdditErrorMark();   // 원본: 표시 전 초기화.
        var r = _rows(ctx).find(function (i) { return i.ITMCD === sItmcd; });
        if (!r) { return; }
        r.stat = "Error"; r.statTxt = "";
        _renderRows(ctx);
        // 해당 행으로 스크롤(원본 UI5 는 테이블 자체 스크롤 — HTML5 는 DOM 이동).
        try {
            var oTr = ctx.tbody && ctx.tbody.querySelector('tr[data-itmcd="' + sItmcd + '"]');
            if (oTr && typeof oTr.scrollIntoView === "function") { oTr.scrollIntoView({ block: "nearest" }); }
        } catch (e) { }
    };

    // 추가속성 오류 표시 초기화(원본 resetErrorField) — 양 패널.
    oAPP.fn.clearAdditErrorMark = function () {
        [oA.MAIN, oA.SEL].forEach(function (ctx) {
            var a = _rows(ctx), bHit = false;
            for (var i = 0; i < a.length; i++) {
                if (a[i].stat === "Error" && a[i]._error !== true) { a[i].stat = null; a[i].statTxt = ""; bHit = true; }
            }
            if (bHit) { _renderRows(ctx); }
        });
    };

    /************************************************************************
     * [P3-D 멀티 적용] 098 "추가 속성 바인딩" — 원본 onMultiAdditionalBind(bindAdditInfo.js:162).
     *   ★ 우측(MAIN) 스토어 값을 체크된 N행에 일괄 stamp. busy 왕복·방송 = P6.
     ************************************************************************/
    oAPP.fn.onMultiAdditionalBind = async function (oAnchor) {
        // ★[원본 onMultiAdditionalBind bindAdditInfo.js:170] 진입 즉시 WS20 busy(219 "추가 속성 바인딩 처리 진행중").
        //   검증 실패마다 off, 확인창은 팝업 로딩만 껐다 켬(WS20 유지), 취소는 전체 off, 성공은 WS20 왕복이 해제(자기해제 금지).
        oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("219") });
        // ★ 검증 순서 = 원본 checkMultiAdditBind.js 그대로: ①디자인 트리 선택(16행) → ②추가속성 입력(53행)
        //   → ③행별 적용 가능여부(84행). 입력 검증을 먼저 하면 사용자가 값을 다 채운 뒤에야
        //   "선택된 라인 없음"을 만나 헛수고한다(장군님 지적 2026-07-16 — 원본도 선택 검증이 먼저다).
        var _aTree = (typeof oAPP.fn.getSelectedDesignTree === "function") ? (oAPP.fn.getSelectedDesignTree() || []) : [];
        if (_aTree.length === 0) {
            // 원본 checkMultiAdditBind.js:21~39 — ACT02(디자인트리 영역) / TITLE=087 / DESC=142 / LK_VIS=false.
            var A0 = oAPP.attr.CS_MSG_ACTCD || {};
            await _showErrPop(oAnchor, {
                RETCD: "E", RTMSG: H.z("087"),
                T_RTMSG: [oAPP.fn.newBindError({ ACTCD: A0.ACT02, TYPE: "Error", TITLE: H.z("087"), DESC: H.z("142"), LK_VIS: false })]
            });
            oAPP.fn.setBusyWS20Interaction(false, {});   // 원본 201
            return;
        }

        var _r1 = oAPP.fn.chkAdditBindData();   // MAIN 입력 완결성.
        // [SPEC §6] 오류는 목록 팝오버(항목별 "오류 위치 확인" 링크 포함).
        if (_r1.RETCD === "E") { await _showErrPop(oAnchor, _r1); oAPP.fn.setBusyWS20Interaction(false, {}); return; }

        // 행별 적용 가능여부 — 원본 checkMultiAdditBind.js:84~ 1:1.
        //   실패 행은 _bind_error 마크 + ACT04(LINE_KEY=CHILD)로 수집하고, 하나라도 있으면 084 로 전체 차단.
        var A1 = oAPP.attr.CS_MSG_ACTCD || {};
        var _aErr = [], _bErr = false;
        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            var _rr = oAPP.fn.chkPossibleAdditBind(_sTree);
            if (_rr.RETCD !== "E") { continue; }
            _bErr = true;
            _sTree._bind_error = true;   // 트리 행 오류 마크(원본).
            _aErr.push(oAPP.fn.newBindError({
                ACTCD: A1.ACT04, LINE_KEY: _sTree.CHILD, TYPE: "Error",
                TITLE: H.z("143", (_sTree.OBJID || "") + " - " + (_sTree.UIATT || "")),   // 143 &1 필드 추가속성 바인딩 오류.
                DESC: _rr.RTMSG
            }));
        }
        if (_bErr) {
            oAPP.fn.refreshDesignTree();   // [표준] 필수 호출 직접(삼킴 제거).
            // 084 선택한 정보 중 추가 속성 불가능건이 존재합니다.
            await _showErrPop(oAnchor, { RETCD: "E", RTMSG: H.z("084"), T_RTMSG: _aErr });
            oAPP.fn.setBusyWS20Interaction(false, {});
            return;
        }

        // 166+089 확인 — 원본 bindAdditInfo.js 확인창: 진입 busy(219) 켜진 채, 확인창 뜰 때 "팝업만" off / onClose 팝업 재on / 취소 전체 off.
        oAPP.fn.setBusy(false, { ISBROAD: true });                    // 확인창 위해 팝업만 off(WS20 유지).
        var _ok = await _confirmAdditApply(H.z("166", String(_aTree.length)) + "\n" + H.z("089"));   // 순수 확인창(sBusyDesc 없음 — busy 는 여기서 관리).
        if (!_ok) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // 취소 → WS20+팝업 off.
        oAPP.fn.setBusy(true, { ISBROAD: true });                     // onClose 팝업만 재on(WS20 유지, 성공 왕복이 최종 해제).

        var _MPROP = oAPP.fn.setAdditBindData(_rows(oA.MAIN));
        oAPP.fn.additionalBindMulti(_MPROP);
        oAPP.fn.toast(H.z("090"));
    };

    // sBusyDesc 주면 원본 동작 재현: 확인창 뜨는 즉시 WS20 busy 다이얼로그(진행 메시지) ON → 확인창 동안 유지(팝업만 끔)
    //   → 취소면 WS20+팝업 해제 / 확인이면 유지(성공 후 방송 왕복이 해제). 근거=메모리 ws20-busy-dialog-during-popup-confirm.
    function _confirmAdditApply(sMsg, sBusyDesc) {
        if (sBusyDesc) { oAPP.fn.setBusyWS20Interaction(true, { DESC: sBusyDesc }); }
        return new Promise(function (resolve) {
            U4AUI.confirm({
                type: "C", message: sMsg,
                buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
                onClose: function (sAct) {
                    if (sBusyDesc) {
                        oAPP.fn.setBusy(true, { ISBROAD: true });   // 팝업 재-ON(WS20 재방송 없음).
                        if (sAct !== "YES") { oAPP.fn.setBusyWS20Interaction(false, {}); }   // 취소 → WS20+팝업 OFF.
                    }
                    resolve(sAct === "YES");
                }
            });
            if (sBusyDesc) { oAPP.fn.setBusy(false, { ISBROAD: true }); }   // 확인창 표시 직후 팝업만 OFF(WS20 유지).
        });
    }

    /************************************************************************
     * [BR64] 추가속성 오류 점검 — 원본 checkAdditData(index.js:8380) 1:1.
     *   좌측 바인딩 필드를 드래그(modelFieldArea setDragStart)할 때, 우측 스테이징(additRows)에 오류값
     *   (_error===true, 예: 존재하지 않는 Conversion Routine)이 하나라도 있으면 RETCD="E"+RTMSG(146)를
     *   반환한다. 그 값은 드래그 payload(oObj.RETCD/RTMSG)에 실려 → 드롭측 _checkDragData(designArea:196)가
     *   RETCD==="E" 를 만나 쓰기 전에 차단(기존 프로퍼티 바인딩·추가속성 유지) + RTMSG 를 toast 로 안내한다.
     *   ★ 원본은 oAddit.oModel.oData.T_MPROP 를, HTML5 는 그 대응 스토어 oAPP.attr.additRows 를 본다
     *     (modelFieldArea:273 매핑과 동일). 판정 기준(_error)은 적용 버튼 경로 chkAdditBindData(:599 p06._error)와 같다.
     *   (2026-08-05 'GAP1 되돌림'을 BR64로 재적용 — 원본 소스는 명확히 차단하고, BR64가 D&D 차단을 요구한다.)
     ************************************************************************/
    oAPP.fn.checkAdditData = function () {
        var _sRes = { RETCD: "", RTMSG: "", T_ERMSG: [] };
        var _aErr = (oAPP.attr.additRows || []).filter(function (i) { return i._error === true; });
        if (_aErr.length === 0) { return _sRes; }                                   // 오류건 없으면 통과(정상 드래그).
        for (var i = 0; i < _aErr.length; i++) {
            _sRes.T_ERMSG.push({ ITMCD: _aErr[i].ITMCD, ERMSG: _aErr[i]._error_msg || "" });   // 원본 T_ERMSG(ITMCD+ERMSG) 수집.
        }
        _sRes.RETCD = "E";
        _sRes.RTMSG = H.z("146");   // 146 바인딩 추가속성 정보에 오류건이 존재합니다.
        return _sRes;
    };

    /************************************************************************
     * [중앙하단 레이아웃] setAdditLayout — 원본 index.js:6052(BULK) 1:1.
     *   KIND==="E" → 중앙하단(bwpAdditApply) 표시(vis_addit=true), 그 외 숨김.
     *   원본 width/height/resize_v(30%/60%) = HTML5 CSS flex + 세로 스플리터로 대체(추적표 §1.3).
     ************************************************************************/
    oAPP.fn.setAdditLayout = function (KIND, oOption) {
        var oShell = document.getElementById("bwpShell");
        if (!oShell) { return; }
        var bShow = (KIND === "E");

        // ★ 스플리터 드래그가 박은 인라인 flex(px 고정, u4a-ui.js:1077 _splitPxFlex)를 제거 →
        //   CSS 기본 비율로 복귀. 안 지우면 접어도 디자인이 그 높이에 멈춰 아래가 빈다(장군님 지적).
        //   접힘: .u4aBwpDesign flex:1 1 auto(100%) / 펼침: 디자인 60% + 추가 40%(원본 height 60% 정합).
        var oDes = document.getElementById("bwpDesignArea");
        var oAdd = document.getElementById("bwpAdditApplyArea");
        if (oDes) { oDes.style.flex = ""; oDes.style.flexBasis = ""; oDes.style.flexGrow = ""; }
        if (oAdd) { oAdd.style.flex = ""; oAdd.style.flexBasis = ""; oAdd.style.flexGrow = ""; }

        oShell.classList.toggle("u4aBwpShowAddit", bShow);
        if (bShow) {
            // 원본 setUiTableAutoResizeColumn(oAdditTab) — 표시 직후 컬럼 폭 맞춤(레이아웃 안정 후).
            setTimeout(function () { try { _fitCols(oA.SEL); } catch (e) { } }, 0);
        }
    };

    /************************************************************************
     * [중앙하단 초기화] clearSelectAdditBind — 원본 index.js:2xxx 1:1.
     *   중앙하단 스토어(additRowsSel) 비움 + 선택 attribute(S_SEL_ATTR) 비움.
     ************************************************************************/
    oAPP.fn.clearSelectAdditBind = function () {
        _setRows(oA.SEL, []);
        oAPP.attr.S_SEL_ATTR = {};
        _renderRows(oA.SEL);
        _updateSelStat();
    };

    /* ── [R1] valueState 검증 메시지 = top-layer 팝오버 (원본 UI5 ValueStateMessage 대응) ─────
       추가속성 표가 overflow 컨테이너(.u4aBwpTableHost) 안이라, 셀 안 absolute 팝오버는 클리핑/스태킹으로
       안 보일 수 있다(장군님 실기 재현). → 원본 UI5 처럼 문서 최상단(body/dialog[open])에 position:fixed 로
       입력칸 바로 아래 부착. 싱글톤 1개 재사용. 스크롤/리사이즈로 앵커 어긋나면 숨김(공통 툴팁 정책과 동일).
       색/아이콘/보더는 공통 .u4a-field__msg 소비(신규 스타일 없음), 폭은 입력칸 폭으로 설정 → 반응형 개행. */
    var _vsPop = null, _vsBound = false, _vsField = null;
    function _vsEl() {
        if (!_vsPop) {
            _vsPop = document.createElement("span");
            _vsPop.className = "u4a-field__msg u4aBwpVsPop";
            _vsPop.setAttribute("data-vs", "error");
        }
        return _vsPop;
    }
    oAPP.fn._bwpVsHide = function () { if (_vsPop) { _vsPop.style.display = "none"; } };
    oAPP.fn._bwpVsShow = function (oInputEl, r) {
        if (!oInputEl || !r || r.stat !== "Error" || !r.statTxt) { oAPP.fn._bwpVsHide(); return; }
        var el = _vsEl();
        _vsField = (oInputEl.closest && oInputEl.closest(".u4aBindAdditField")) || oInputEl;  // 현재 앵커 필드(외부클릭 판정용)
        el.textContent = r.statTxt;
        el.setAttribute("data-vs", "error");
        var host = (oInputEl.closest && oInputEl.closest("dialog[open]")) || document.body;
        if (el.parentNode !== host) { host.appendChild(el); }
        var rc = oInputEl.getBoundingClientRect();
        el.style.position = "fixed";
        el.style.margin = "0";                          // 공통 margin-top(0.25rem) 무효화 → top 결정적
        el.style.left = Math.round(rc.left) + "px";
        el.style.top = Math.round(rc.bottom + 4) + "px";
        el.style.width = Math.round(rc.width) + "px";   // 입력칸 폭 → 문구 개행(반응형)
        el.style.display = "inline-flex";
        if (!_vsBound) {
            _vsBound = true;
            window.addEventListener("scroll", function () { oAPP.fn._bwpVsHide(); }, true);
            window.addEventListener("resize", function () { oAPP.fn._bwpVsHide(); });
            // [C-1 버그1] 다른 영역 클릭 시 숨김 — blur 만으론 스플릿바(mousedown 에서 preventDefault 로
            //   포커스 이동을 막음)처럼 input blur 를 안 일으키는 클릭을 못 잡는다. mousedown capture 로 보강.
            //   단, 현재 앵커 필드 내부(input 재클릭)·팝오버 자체 클릭은 유지(재포커스 깜빡임/영구숨김 방지).
            document.addEventListener("mousedown", function (e) {
                if (!_vsPop || _vsPop.style.display === "none") { return; }
                var t = e.target;
                if (_vsField && t && t.closest && t.closest(".u4aBindAdditField") === _vsField) { return; }
                if (_vsPop.contains && t && _vsPop.contains(t)) { return; }
                oAPP.fn._bwpVsHide();
            }, true);
        }
    };

    /* ── 행 렌더 — 공통 평면표에 데이터만 갱신(컬럼폭·격자·리사이즈는 컴포넌트가 유지). 값셀 구성은 _additValCell. ── */
    function _renderRows(ctx) {
        if (!ctx || !ctx.dt) { return; }
        ctx.dt.setRows(_rows(ctx));
    }

    // [S5 잠금] 동일속성 적용 팝업 열/닫 시 추가속성 값 입력칸(중앙하단 SEL·우측 MAIN) 잠금 상태 반영.
    //   ★우측 MAIN 은 팝업 진입 시 재렌더되지 않으므로(SEL 만 clearSelectAdditBind), 잠금 토글 시점에 강제 재렌더해야
    //     이미 그려진 입력칸이 bSyncDialogLock 을 반영해 비활성/활성으로 바뀐다. per-row r.edit 은 재렌더로 보존.
    oAPP.fn.refreshAdditFieldsLock = function () {
        try {
            if (oA.MAIN && oA.MAIN.tbody) { _renderRows(oA.MAIN); }
            if (oA.SEL && oA.SEL.tbody) { _renderRows(oA.SEL); }
        } catch (e) { console.error("[HTML5][bindWindow] refreshAdditFieldsLock:", e && e.message); }
    };

})();
