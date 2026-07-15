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

    // 161 컬럼최적화 — 속성 컬럼을 라벨 최대폭에 맞춤(원본 setUiTableAutoResizeColumn 대응). 실패 무해.
    //   ★ Range 로 실제 텍스트폭 측정(컬럼폭 무관·항상 동일). scrollWidth 는 grow-only 버그라 안 씀.
    function _textW(el) {
        try {
            var r = document.createRange();
            r.selectNodeContents(el);
            var w = r.getBoundingClientRect().width;
            if (w) { return w; }
        } catch (e) { }
        return el.offsetWidth;
    }
    function _fitCols() {
        if (!oA.host) { return; }
        try {
            var oTbl = oA.host.querySelector(".u4aBwpAdditTbl");
            if (!oTbl) { return; }
            var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            var mx = 0, aProp = oTbl.querySelectorAll("th:first-child, .u4aBwpAdditProp");
            for (var i = 0; i < aProp.length; i++) { var w = _textW(aProp[i]); if (w > mx) { mx = w; } }
            if (mx > 0) {
                var sW = Math.max(6 * rem, Math.ceil(mx) + 1.5 * rem) + "px";
                var aFirst = oTbl.querySelectorAll("tr > :first-child");
                for (var j = 0; j < aFirst.length; j++) { aFirst[j].style.width = sW; }
            }
        } catch (e) { console.error("[HTML5][bindWindow] additFitCols:", e && e.message); }
    }

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
        // 161 컬럼최적화 — 속성 컬럼을 라벨 콘텐츠 폭에 맞춤(원본 resize-horizontal).
        oA.tool.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () { _fitCols(); }));
        // 957 화면 커스터마이징 — 원본 bindAdditInfo.js:1164 createBindLayoutCustomizingButton(좌·중·우 공통).
        oA.tool.appendChild(H.iconBtn("gear", H.z("957"), function () {
            if (oAPP.attr.editable === false) { return; }
            if (typeof oAPP.fn.openLayoutCustomizingPopup === "function") { oAPP.fn.openLayoutCustomizingPopup(); }
        }));
        oA.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp(); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));

        // 패널 좁아질 때 넘치는 버튼(추가 속성 바인딩/도움말)을 ⋯ 오버플로 메뉴로(16 §11, 공통 attachOverflow).
        oAPP.fn.attachToolOverflow(oA.tool);

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

    /************************************************************************
     * [P3-A 검증] 추가속성 바인딩 가능여부 점검 — 원본 bindAdditInfo.js chkPossibleAdditBind(440) 1:1.
     *   대상 = 디자인트리 선택라인(ATTR: DATYP/UIATY/UIATV/ISBND). 반환 {RETCD:""|"E", RTMSG}.
     *   데이터 매핑: 원본 oContr.oModel.oData.T_MPROP → HTML5 oAPP.attr.additRows,
     *               oAPP.attr.oModel.oData.zTREE → oAPP.attr.modelTree, getModelBindData 그대로.
     ************************************************************************/
    oAPP.fn.chkPossibleAdditBind = function (is_attr) {
        var _sRes = { RETCD: "", RTMSG: "" };
        // ATTRIBUTE 가 프로퍼티(DATYP 02)가 아니면 불가 — 148 Property 라인만 적용 가능.
        if (is_attr.DATYP !== "02") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("148"); return _sRes; }
        if (is_attr.UIATY !== "1") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("148"); return _sRes; }
        // 바인딩 안 된 라인은 추가속성 적용 불가 — 149 바인딩 정보 없음.
        if (is_attr.UIATV === "" || is_attr.ISBND === "") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("149"); return _sRes; }
        // 모델필드 기준 상세 점검 위임.
        _sRes = oAPP.fn.chkModelFiendAdditData(is_attr.UIATV);
        return _sRes;
    };

    /************************************************************************
     * [P3-A 검증] 모델필드 기준 추가속성 가능여부 — 원본 chkModelFiendAdditData(495) 1:1.
     ************************************************************************/
    oAPP.fn.chkModelFiendAdditData = function (modelField) {
        var _sRes = { RETCD: "", RTMSG: "" };

        var _sField = oAPP.fn.getModelBindData(modelField, oAPP.attr.modelTree);
        // 150 &1 필드가 모델 항목에 존재하지 않음.
        if (typeof _sField === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("150", modelField); return _sRes; }
        // 151 일반유형 ABAP TYPE(E)만 가능.
        if (_sField.KIND !== "E") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("151"); return _sRes; }

        var _aMPROP = oAPP.attr.additRows || [];

        // P04 Bind type — 092 없음 / 093 P 유형만.
        var _sP04 = _aMPROP.find(function (i) { return i.ITMCD === "P04"; });
        if (typeof _sP04 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("092"); return _sRes; }
        if (_sP04.val !== "" && _sField.TYPE_KIND !== "P") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("093"); return _sRes; }

        // P05 Reference Field — 136 없음 / 152 부모 path 다름.
        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (typeof _sP05 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("136"); return _sRes; }
        if (_sP05.val !== "") {
            if (_sP05.val.substr(0, _sP05.val.lastIndexOf("-")) !== _sField.CHILD.substr(0, _sField.CHILD.lastIndexOf("-"))) {
                _sRes.RETCD = "E"; _sRes.RTMSG = H.z("152"); return _sRes;
            }
        }

        // P07 Nozero — 094 없음 / 095 CHAR(C)·STRING(g) 불가.
        var _sP07 = _aMPROP.find(function (i) { return i.ITMCD === "P07"; });
        if (typeof _sP07 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("094"); return _sRes; }
        if (_sP07.val === "true" && "Cg".indexOf(_sField.TYPE_KIND) !== -1) { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("095"); return _sRes; }

        // P08 Is number format — 096 없음 / 097 INT(I)·P 만.
        var _sP08 = _aMPROP.find(function (i) { return i.ITMCD === "P08"; });
        if (typeof _sP08 === "undefined") { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("096"); return _sRes; }
        if (_sP08.val === "true" && "IP".indexOf(_sField.TYPE_KIND) === -1) { _sRes.RETCD = "E"; _sRes.RTMSG = H.z("097"); return _sRes; }

        return _sRes;
    };

    /************************************************************************
     * [P3-B 서버검증] Conversion Routine(P06) — 원본 checkConversion(index.js:5276) /
     *   convChangeInput / clearConvError(bindAdditInfo.js:361/386) 1:1.
     *   서버콜 = POST {servNm}/chkConvExit (FormData CONVEXIT). 실패 시 value-state Error.
     *   HTML5: 원본 oContr.oModel.refresh() → 해당 입력칸 ctrl.setValueState 직접 갱신(재렌더 없이 포커스 유지).
     ************************************************************************/
    function _clearRowErr(r) { r.stat = null; r.statTxt = ""; r._error = false; r._error_msg = ""; }

    oAPP.fn.checkConversion = function (convName) {
        return new Promise(function (resolve) {
            var _sRes = { RETCD: "", RTMSG: "" };
            if (convName === "") { return resolve(_sRes); }   // 미입력 = 서버콜 안 함(원본).
            var oFormData = new FormData();
            oFormData.append("CONVEXIT", convName);
            oAPP.fn.sendAjax(oAPP.attr.servNm + "/chkConvExit", oFormData, function (param) {
                if (param && param.RETCD === "E") { _sRes.RETCD = param.RETCD; _sRes.RTMSG = param.RTMSG; }
                resolve(_sRes);
            });
        });
    };

    // P06 값 변경 완료(change) — 대문자(createField upper)·서버검증·오류표시. oInp = 그 입력칸 ctrl.
    oAPP.fn.convChangeInput = async function (r, oInp) {
        oAPP.fn.setBusy(true);
        if (!r || r.ITMCD !== "P06") { oAPP.fn.setBusy(false); return; }
        if (r.val === "") { _clearRowErr(r); if (oInp) { oInp.setValueState("none", ""); } oAPP.fn.setBusy(false); return; }
        var _sRes = await oAPP.fn.checkConversion(r.val);
        if (_sRes.RETCD === "E") {
            r.stat = "Error"; r.statTxt = _sRes.RTMSG; r._error = true; r._error_msg = _sRes.RTMSG;
            if (oInp) { oInp.setValueState("error", _sRes.RTMSG); }
            oAPP.fn.setBusy(false); return;
        }
        _clearRowErr(r);
        if (oInp) { oInp.setValueState("none", ""); }
        oAPP.fn.setBusy(false);
    };

    // P06 입력 중(liveChange) — 오류 표시 즉시 해제(원본 clearConvError).
    oAPP.fn.clearConvError = function (r, oInp) {
        if (!r || r.ITMCD !== "P06") { return; }
        _clearRowErr(r);
        if (oInp) { oInp.setValueState("none", ""); }
    };

    /************************************************************************
     * [P3-C 상호배타] Bind type(P04) ↔ Reference Field(P05) / Conversion(P06)
     *   — 원본 setAddtBindInfoDDLB(index.js:8276) 1:1.
     *   · P04 빈값 → P05 초기화+잠금, P06 활성.
     *   · P04 값 선택 → P05 활성, P06 잠금+초기화(오류도 클리어).
     *   HTML5: 원본 refresh() → _renderRows()(edit 변경=위젯 활성/잠금 반영).
     ************************************************************************/
    oAPP.fn.setAddtBindInfoDDLB = function (r) {
        var _aMPROP = oAPP.attr.additRows || [];
        // 변경행 오류 표현 초기화(원본).
        r.stat = null; r.statTxt = "";
        if (r.ITMCD !== "P04" && r.ITMCD !== "P05") { _renderRows(); return; }

        var ls_P04 = _aMPROP.find(function (a) { return a.ITMCD === "P04"; });
        var ls_P05 = _aMPROP.find(function (a) { return a.ITMCD === "P05"; });
        var ls_P06 = _aMPROP.find(function (a) { return a.ITMCD === "P06"; });
        if (!ls_P04 || !ls_P05 || !ls_P06) { return; }

        if (r.ITMCD === "P04" && r.val === "") { ls_P05.val = ""; }   // Bind type 비움 → 참조필드 비움.
        if (r.ITMCD === "P05" && r.val === "") { ls_P04.val = ""; }   // 참조필드 비움 → Bind type 비움.

        if (ls_P04.val === "") {
            ls_P05.edit = false; ls_P05.val = ""; ls_P06.edit = true;              // 참조필드 잠금·비움 / Conversion 활성.
        } else if (r.val !== "") {
            ls_P05.edit = true; ls_P06.edit = false; ls_P06.val = "";               // 참조필드 활성 / Conversion 잠금·비움.
            _clearRowErr(ls_P06);                                                   // Conversion 오류 초기화.
        }
        _renderRows();
    };

    /************************************************************************
     * [P3-C 참조필드] Reference Field(P05) DDLB 구성/초기화
     *   — 원본 setRefFieldList(bindAdditInfo.js:706) / clearRefField(672) 1:1.
     *   디자인트리 체크선택 + 모델선택의 부모경로가 단일 구조일 때만, 그 형제 중
     *   DATATYPE CUKY/UNIT 필드로 P05 목록 구성. 섞이거나 없으면 초기화(잠금).
     ************************************************************************/
    oAPP.fn.clearRefField = function () {
        var _aMPROP = oAPP.attr.additRows || [];
        if (_aMPROP.length === 0) { return; }
        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (!_sP05) { return; }
        _sP05.val = ""; _sP05.T_DDLB = [];
        _renderRows();
    };

    oAPP.fn.setRefFieldList = function () {
        var _aTree = (typeof oAPP.fn.getSelectedDesignTree === "function") ? (oAPP.fn.getSelectedDesignTree() || []) : [];
        var _aField = [];
        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            if (_sTree.UIATV === "" || _sTree.ISBND === "") { continue; }      // 미바인딩 skip.
            if (_sTree.UIATY !== "1") { oAPP.fn.clearRefField(); return; }      // 프로퍼티 아님 → 초기화.
            var _field = _sTree.UIATV.substr(0, _sTree.UIATV.lastIndexOf("-"));
            if (_aField.indexOf(_field) === -1) { _aField.push(_field); }
        }
        // 모델트리 선택라인의 부모경로도 수집.
        var _sMField = (typeof oAPP.fn.getSelectedModelLine === "function") ? oAPP.fn.getSelectedModelLine() : undefined;
        if (_sMField && _aField.indexOf(_sMField.PARENT) === -1) { _aField.push(_sMField.PARENT); }

        if (_aField.length > 1) { oAPP.fn.clearRefField(); return; }           // 서로 다른 구조 섞임 → 초기화.

        var _sField = oAPP.fn.getModelBindData(_aField[0], oAPP.attr.modelTree);
        if (typeof _sField === "undefined") { oAPP.fn.clearRefField(); return; }

        // 구조 형제 중 CUKY/UNIT 만.
        var _aFilt = (_sField.zTREE || []).filter(function (it) { return it.DATATYPE === "CUKY" || it.DATATYPE === "UNIT"; });
        if (_aFilt.length === 0) { oAPP.fn.clearRefField(); return; }

        var _aMPROP = oAPP.attr.additRows || [];
        if (_aMPROP.length === 0) { return; }
        var _sP05 = _aMPROP.find(function (i) { return i.ITMCD === "P05"; });
        if (!_sP05) { return; }

        _sP05.T_DDLB = [{ KEY: "", TEXT: "" }];   // 공란 + CUKY/UNIT.
        for (var j = 0; j < _aFilt.length; j++) { _sP05.T_DDLB.push({ KEY: _aFilt[j].CHILD, TEXT: _aFilt[j].CHILD }); }
        // 기존 선택값이 새 목록에 없으면 초기화.
        if (_sP05.T_DDLB.findIndex(function (it) { return it.KEY === _sP05.val; }) === -1) { _sP05.val = ""; }
        _renderRows();
    };

    /************************************************************************
     * [P3-D 적용] MPROP 직렬화 — 원본 setAdditBindData(index.js:5316) 1:1.
     *   isFieldInfo(P01~P03) 제외 → ITMCD 정렬 → val 을 "|" 조인 = "P04|P05|P06|P07|P08".
     ************************************************************************/
    oAPP.fn.setAdditBindData = function (aMPROP) {
        if (typeof aMPROP === "undefined") { return; }
        var _a = aMPROP.filter(function (i) { return i.isFieldInfo === false; });
        _a.sort(function (a, b) { return a.ITMCD.localeCompare(b.ITMCD); });
        return _a.map(function (i) { return i.val; }).join("|");
    };

    /************************************************************************
     * [P3-D 검증] 우측 입력 완결성 — 원본 chkAdditBindData(index.js:4886, MAIN_ADDIT) 간이판.
     *   ★ P6 경계: 원본의 TY_BIND_ERROR/ACTCD 라우팅·showMessagePopover 는 P6 → 여기선 {RETCD,RTMSG}(첫 오류)만.
     *   반환 {RETCD:""|"E", RTMSG}.
     ************************************************************************/
    oAPP.fn.chkAdditBindData = function () {
        var a = oAPP.attr.additRows || [];
        if (a.length === 0) { return { RETCD: "E", RTMSG: H.z("133") }; }                 // 133 추가속성 정보 없음.
        if (a.findIndex(function (i) { return i.val !== ""; }) === -1) { return { RETCD: "E", RTMSG: H.z("134") }; }  // 134 입력건 없음.
        var p04 = a.find(function (i) { return i.ITMCD === "P04"; });
        if (!p04) { return { RETCD: "E", RTMSG: H.z("135") }; }                           // 135 Bind type 없음.
        var p05 = a.find(function (i) { return i.ITMCD === "P05"; });
        if (!p05) { return { RETCD: "E", RTMSG: H.z("136") }; }                           // 136 Reference Field 없음.
        var _res = { RETCD: "", RTMSG: "" };
        if (p04.val !== "" && p05.val === "") { _res = { RETCD: "E", RTMSG: H.z("137") }; }   // 137 Bind type 선택 시 참조필드 필수.
        var p06 = a.find(function (i) { return i.ITMCD === "P06"; });
        if (!p06) { return { RETCD: "E", RTMSG: H.z("138") }; }                           // 138 Conversion 없음.
        if (p06._error === true) { _res = { RETCD: "E", RTMSG: p06._error_msg || H.z("138") }; }   // P06 서버검증 오류.
        return _res;
    };

    /************************************************************************
     * [P3-D 멀티 적용] 098 "추가 속성 바인딩" — 원본 onMultiAdditionalBind(bindAdditInfo.js:162) 이식.
     *   ★ P6 경계: busy 왕복·UPDATE-DESIGN-DATA 방송·showMessagePopover 정교 라우팅 = P6.
     *   ★ 부분적용 방지(간이 all-or-nothing): 체크행 하나라도 chkPossibleAdditBind E 면 전체 중단.
     ************************************************************************/
    oAPP.fn.onMultiAdditionalBind = async function () {
        // 우측 입력 완결성.
        var _r1 = oAPP.fn.chkAdditBindData();
        if (_r1.RETCD === "E") { oAPP.fn.toast(_r1.RTMSG); return; }

        var _aTree = (typeof oAPP.fn.getSelectedDesignTree === "function") ? (oAPP.fn.getSelectedDesignTree() || []) : [];
        if (_aTree.length === 0) { oAPP.fn.toast(H.z("142")); return; }   // 142 디자인 라인 선택 필요.

        // 간이 all-or-nothing — 하나라도 불가면 전체 차단(원본 checkMultiAdditBind 취지).
        for (var i = 0; i < _aTree.length; i++) {
            var _rr = oAPP.fn.chkPossibleAdditBind(_aTree[i]);
            if (_rr.RETCD === "E") {
                oAPP.fn.toast(H.z("143", (_aTree[i].OBJID || "") + " - " + (_aTree[i].UIATT || "")) + " : " + _rr.RTMSG);
                return;
            }
        }

        // 166 &1건 선택 + 089 적용 확인.
        var _ok = await _confirmAdditApply(H.z("166", String(_aTree.length)) + "\n" + H.z("089"));
        if (!_ok) { return; }

        var _MPROP = oAPP.fn.setAdditBindData(oAPP.attr.additRows);
        oAPP.fn.additionalBindMulti(_MPROP);   // designArea — 체크행 일괄 stamp + _T_0015 갱신.
        oAPP.fn.toast(H.z("090"));             // 090 적용 완료.
    };

    // 적용 확인창(원본 MessageBox.confirm 166+089) — 공통 U4AUI.confirm 로. Promise<bool>.
    function _confirmAdditApply(sMsg) {
        return new Promise(function (resolve) {
            U4AUI.confirm({
                type: "C", message: sMsg,
                buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
                onClose: function (sAct) { resolve(sAct === "YES"); }
            });
        });
    }

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
                // P04(Bind type)/P05(Reference Field) 변경 = 상호배타 보정(setAddtBindInfoDDLB). 그 외 콤보는 값만.
                var bDdlbSync = (r.ITMCD === "P04" || r.ITMCD === "P05");
                var oSel = U4AUI.createField({
                    type: "combo", items: aItems, value: r.val || "", disabled: !bEnabled,
                    onChange: (function (row) { return function (v) { row.val = v; if (bDdlbSync) { oAPP.fn.setAddtBindInfoDDLB(row); } }; })(r)
                });
                oTdV.appendChild(oSel.el);
            } else if (r.inp_vis) {
                // P06 Conversion Routine — 대문자(upper) + change=서버검증(convChangeInput) + 입력중=오류해제(clearConvError).
                var bConv = (r.ITMCD === "P06");
                var oInp = U4AUI.createField({
                    type: "text", value: r.val || "",
                    maxLength: (r.maxlen != null ? r.maxlen : undefined),
                    disabled: !bEnabled, clear: bEnabled, upper: bConv,
                    // ★ 입력값을 행(r.val)에 되쓰고(원본 value:"{val}") P06 이면 서버검증.
                    onChange: (function (row) { return function (v) { row.val = v; if (bConv) { oAPP.fn.convChangeInput(row, oInp); } }; })(r),
                    onInput: bConv ? (function (row) { return function () { oAPP.fn.clearConvError(row, oInp); }; })(r) : undefined,
                    onClear: (function (row) { return function () { row.val = ""; if (bConv) { oAPP.fn.clearConvError(row, oInp); } }; })(r)
                });
                // 재구성 시 기존 오류 상태 복원(원본 stat/_error).
                if (bConv && r.stat === "Error") { try { oInp.setValueState("error", r.statTxt || ""); } catch (e) { } }
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
