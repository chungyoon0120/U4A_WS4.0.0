/****************************************************************************
 * Binding Popup(대형 별창) 우측 "추가 속성 바인딩"(bindAdditInfo) 영역 — HTML5
 * --------------------------------------------------------------------------
 *  원본: uiModule/bindAdditInfo.js(start 1046) — sap.ui.table.Table(속성|값 2열) +
 *        상단 OverflowToolbar(098 추가 속성 바인딩 / 161 컬럼최적화 / 198 Help).
 *        행 데이터 = index.js setAdditBindInfo(3064) 가 T_9011 UA028(P01~P08)로 구성.
 *  HTML5: 공통 .u4a-table 골격 + createField/createSelect(값 셀) + 공유 oAPP.H 소비.
 *
 *  ★ 레이아웃(BULK 모드): 이 패널(oPageRight)은 3분할 중 우측 영역이라 첫 실행부터 항상 보인다.
 *    (vis_addit 은 중앙 하단 "추가속성 적용"만 제어 — 이 패널과 무관. frame.css 참조.)
 *  ★ 행 P01~P08(원본 setAdditBindInfo 1:1):
 *      P01 Field name(txt) · P02 Field path(txt) · P03 type(txt) ·
 *      P04 Bind type(sel, 참조필드 DDLB, P타입만 편집) · P05 Reference Field name(sel, CUKY/UNIT 있을때만) ·
 *      P06 Conversion Routine(inp, maxlen5) · P07 Nozero(sel true/false, default false) ·
 *      P08 Is number format?(sel true/false, default false).
 *  ★ 첫 실행 = 디자인 선택 없음 → 빈 is_tree 로 8행 기본형(값 비고 잠금)을 표시(image1 첫 실행과 동일).
 *    실제 필드 선택 시 재구성은 디자인 트리 링크(onShowBindAdditInfo)에서 이 함수를 재호출(Stage4).
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.H) { return; }

    var H = oAPP.H;

    var oA = { tool: null, host: null, tbody: null };

    // Nozero 불가 타입(원본 l_nozero) / number format 가능 타입(원본 l_numfmt).
    var CS_NOZERO_NG = "Cg", CS_NUMFMT_OK = "IP";

    /* ── 영역 초기화(frame.js _bootApp → initAdditArea) ─────────────────────── */
    oAPP.fn.initAdditArea = function () {
        oA.tool = document.getElementById("bwpAdditInfoTool");
        oA.host = document.getElementById("bwpAdditInfo");
        if (!oA.tool || !oA.host) { return; }

        // ── 헤더 툴바(원본 bindAdditInfo.js:1078) — 098 추가 속성 바인딩(강조) · 도움말 ──
        oA.tool.innerHTML = "";
        var bRO = !oAPP.attr.editable;
        var oBind = H.el("button", "u4a-btn u4a-btn--emphasized");
        oBind.type = "button";
        oBind.innerHTML = H.fa("layer-group");
        oBind.appendChild(document.createTextNode(H.z("098")));   // 098 추가 속성 바인딩
        oBind.title = H.z("098");
        if (bRO) { oBind.disabled = true; }
        oBind.addEventListener("click", function () {
            // 멀티 추가속성 바인딩(원본 onMultiAdditionalBind) — 적용 단계(Stage4/5)에서 배선.
            if (typeof oAPP.fn.onMultiAdditionalBind === "function") {
                try { oAPP.fn.onMultiAdditionalBind(); } catch (e) { console.error("[HTML5][bindWindow] onMultiAdditionalBind:", e && e.message); }
            }
        });
        oA.tool.appendChild(oBind);
        oA.tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
        oA.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp(); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));

        // ── 속성|값 2열 테이블(원본 2열 Property/Value) ──
        oA.host.innerHTML = "";
        var oTbl = H.el("table", "u4aBwpAdditTbl u4a-table");
        var oThead = H.el("thead");
        var oTrH = H.el("tr");
        oTrH.appendChild(H.el("th", null, H.z("177")));   // 177 Property(속성)
        oTrH.appendChild(H.el("th", null, H.z("178")));   // 178 Value(값)
        oThead.appendChild(oTrH);
        oTbl.appendChild(oThead);
        oA.tbody = H.el("tbody");
        oTbl.appendChild(oA.tbody);
        oA.host.appendChild(oTbl);

        // 첫 실행 — 원본 초기 함수 setAdditialListData 로 UA028 기반 8행 기본형 표시.
        oAPP.fn.setAdditialListData();
    };

    /************************************************************************
     * 첫 실행 추가속성 8행 기본형 — 원본 uiModule/bindAdditInfo.js setAdditialListData(870) 1:1.
     *   ★ 이게 원본 첫 실행(onViewReady:117)의 SSOT다. 선택필드용 setAdditBindInfo(아래)와 다르다:
     *     초기엔 P04 Bind type · P06 Conversion Routine · P07 Nozero · P08 Is number format? = edit=true,
     *     P05 Reference Field name = sel 표시하되 edit=false(참조필드 목록 없음), P01~P03 = 값 공란(표시 안 함).
     *   ★ P07/P08 초기값 "false". T_DDLB: P04=참조필드(UA022 FLD03="X"), P07/P08=boolean.
     ************************************************************************/
    oAPP.fn.setAdditialListData = function () {
        var aT9011 = oAPP.attr.T_9011 || [];

        // boolean DDLB(원본 lt_bool).
        var aBool = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];

        // Bind type 참조 DDLB(원본 lt_refList = 빈 항목 + UA022 FLD03="X").
        var aRefList = [{ KEY: "", TEXT: "" }];
        aT9011.filter(function (a) { return a.CATCD === "UA022" && a.FLD03 === "X"; })
            .forEach(function (a) { aRefList.push({ KEY: a.FLD01, TEXT: a.FLD01 }); });

        // 추가속성 항목(UA028) — ITMCD 정렬.
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
                case "P01": case "P02": case "P03":   // Field name / Field path / type — 값 공란(초기 표시 없음).
                    r.isFieldInfo = true;
                    break;
                case "P04":   // Bind type — 편집 가능 콤보.
                    r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aRefList));
                    break;
                case "P05":   // Reference Field name — 콤보 표시(참조필드 없어 잠금).
                    r.sel_vis = true;
                    break;
                case "P06":   // Conversion Routine — 편집 가능 입력(5자).
                    r.maxlen = 5; r.edit = true; r.inp_vis = true;
                    break;
                case "P07":   // Nozero — 편집 가능 콤보, 기본 false.
                    r.val = "false"; r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                case "P08":   // Is number format? — 편집 가능 콤보, 기본 false.
                    r.val = "false"; r.edit = true; r.sel_vis = true; r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                default:
                    break;
            }
            aMprop.push(r);
        }
        oAPP.attr.additRows = aMprop;
        _renderRows();
    };

    /************************************************************************
     * 추가속성 정보(T_MPROP) 구성 — 원본 index.js setAdditBindInfo(3064) 1:1.
     *   @param is_tree    선택 필드 노드(KIND/NTEXT/CHILD/TYPE/TYPE_KIND)
     *   @param MPROP      기존 바인딩의 MPROP 문자열("|" 조인, 없으면 "")
     *   @param it_parent  선택 필드의 형제(참조필드 CUKY/UNIT 탐색용)
     *  ★ 원본은 KIND!=="E" 면 T_MPROP 를 비운다(프로퍼티가 아니면 추가속성 없음).
     *  ★ 첫 실행 8행은 이 함수가 아니라 setAdditialListData(위) 가 담당 — 이건 디자인트리 필드 선택 시(Stage4).
     ************************************************************************/
    oAPP.fn.setAdditBindInfo = function (is_tree, MPROP, it_parent) {
        is_tree = is_tree || { KIND: "", NTEXT: "", CHILD: "", TYPE: "", TYPE_KIND: "" };
        it_parent = it_parent || [];

        var aMprop = [];

        // 프로퍼티(E)가 아니면 추가속성 없음 — 빈 테이블.
        if (is_tree.KIND !== "E") {
            oAPP.attr.additRows = [];
            _renderRows();
            return;
        }

        var aT9011 = oAPP.attr.T_9011 || [];

        // 참조필드 DDLB(원본 UA022 FLD03="X").
        var aRefList = [{ KEY: "", TEXT: "" }];
        aT9011.filter(function (a) { return a.CATCD === "UA022" && a.FLD03 === "X"; })
            .forEach(function (a) { aRefList.push({ KEY: a.FLD01, TEXT: a.FLD01 }); });

        // boolean DDLB(원본 lt_bool).
        var aBool = [{ KEY: "true", TEXT: "true" }, { KEY: "false", TEXT: "false" }];

        // 추가속성 항목(UA028) — ITMCD 정렬(원본 localeCompare).
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
                case "P01":   // Field name
                    r.val = is_tree.NTEXT; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P02":   // Field path
                    r.val = is_tree.CHILD; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P03":   // type
                    r.val = is_tree.TYPE; r.txt_vis = true; r.isFieldInfo = true;
                    break;
                case "P04":   // Bind type
                    if (aSplit.length > 0) { r.val = aSplit[0]; }
                    r.sel_vis = true;
                    if (is_tree.TYPE_KIND !== "P") { r.edit = false; }   // P 타입만 편집.
                    r.T_DDLB = JSON.parse(JSON.stringify(aRefList));
                    break;
                case "P05":   // Reference Field name
                    if (aSplit.length > 0) { r.val = aSplit[1]; }
                    r.sel_vis = true;
                    r.edit = false;
                    var aFilt = it_parent.filter(function (a) { return a.DATATYPE === "CUKY" || a.DATATYPE === "UNIT"; });
                    if (aFilt.length !== 0) {
                        r.edit = true;
                        r.T_DDLB = [{ KEY: "", TEXT: "" }];
                        aFilt.forEach(function (a) { r.T_DDLB.push({ KEY: a.CHILD, TEXT: a.CHILD }); });
                    }
                    if (aSplit.length === 0 || aSplit[0] === "") { r.edit = false; }
                    break;
                case "P06":   // Conversion Routine
                    r.maxlen = 5;
                    if (aSplit.length > 0) { r.val = aSplit[2]; }
                    if (aSplit.length > 0 && aSplit[0] !== "") { r.edit = false; }
                    r.inp_vis = true;
                    break;
                case "P07":   // Nozero
                    if (aSplit.length > 0) { r.val = aSplit[3]; }
                    if (r.val === "") { r.val = "false"; }
                    r.sel_vis = true;
                    if (CS_NOZERO_NG.indexOf(is_tree.TYPE_KIND) !== -1) { r.edit = false; }
                    r.T_DDLB = JSON.parse(JSON.stringify(aBool));
                    break;
                case "P08":   // Is number format?
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

        oAPP.attr.additRows = aMprop;
        _renderRows();
    };

    /* ── 행 렌더(값 셀 = 텍스트 / 입력 / 선택) ─────────────────────────────── */
    function _renderRows() {
        if (!oA.tbody) { return; }
        oA.tbody.innerHTML = "";
        var aRows = oAPP.attr.additRows || [];
        var bEditGlobal = !!oAPP.attr.editable;   // 원본 enabled="{/edit}".

        for (var i = 0; i < aRows.length; i++) {
            var r = aRows[i];
            var oTr = H.el("tr");

            // 속성명(데이터 아님 — 선택 금지, 말줄임 툴팁).
            var oTdP = H.el("td");
            var oProp = H.el("span", "u4aBwpAdditProp", r.prop || "");
            if (r.prop) { oProp.setAttribute("data-tip", r.prop); oProp.setAttribute("data-tip-trunc", ""); }
            oTdP.appendChild(oProp);
            oTr.appendChild(oTdP);

            // 값 셀.
            var oTdV = H.el("td", "u4aBwpAdditVal");
            var bEnabled = bEditGlobal && r.edit;

            if (r.sel_vis) {
                var aItems = (r.T_DDLB || []).map(function (d) { return { value: d.KEY, text: d.TEXT }; });
                // ★ onChange 로 선택값을 행(r.val)에 되쓴다 — 원본 selectedKey:"{val}" 양방향 바인딩 대응.
                //   (이후 MPROP 조립/검증 단계가 r.val 을 읽으므로 미배선 시 입력값 유실.)
                var oSel = U4AUI.createField({
                    type: "combo", items: aItems, value: r.val || "", disabled: !bEnabled,
                    onChange: (function (row) { return function (v) { row.val = v; }; })(r)
                });
                oTdV.appendChild(oSel.el);
            } else if (r.inp_vis) {
                var oInp = U4AUI.createField({
                    type: "text", value: r.val || "",
                    maxLength: (r.maxlen != null ? r.maxlen : undefined),
                    disabled: !bEnabled, clear: bEnabled,
                    // ★ 입력값을 행(r.val)에 되쓴다 — 원본 value:"{val}" 양방향 바인딩 대응.
                    onChange: (function (row) { return function (v) { row.val = v; }; })(r),
                    onClear: (function (row) { return function () { row.val = ""; }; })(r)
                });
                oTdV.appendChild(oInp.el);
            } else {
                // txt_vis(또는 기본) — 읽기전용 텍스트(값 표면이라 선택 허용).
                var oTxt = H.el("span", "u4aBwpAdditTxt", r.val || "");
                if (r.val) { oTxt.setAttribute("data-tip", r.val); oTxt.setAttribute("data-tip-trunc", ""); }
                oTdV.appendChild(oTxt);
            }

            oTr.appendChild(oTdV);
            oA.tbody.appendChild(oTr);
        }
    }

})();
