/****************************************************************************
 * Binding Popup(대형 별창) 중앙 "디자인 트리" 영역 — HTML5
 * --------------------------------------------------------------------------
 *  원본: uiModule/designTree.js — 현재 앱 전체 UI 계층(TreeTable) + 각 UI 의 Property/Aggregation
 *        자식 노드 + 기존 바인딩 표시 + 드래그드롭 바인딩 + 멀티/동기화 + 행 액션.
 *  HTML5: 공통 컴포넌트 U4AUI.makeColumnTree(다열 그리드 트리, theme/u4a-ui.js) + 공유 oAPP.H 소비.
 *
 *  ★ 이 단계(Stage3-a) = 트리 데이터 변환(원본 setDesignTreeData + 4 빌더 1:1) + 툴바 + 렌더.
 *    데이터(T_0014/T_0015)는 WS20 브로드캐스트(UPDATE_DESIGN_DATA)로 채워진다(Stage6) — 그 전엔 빈 트리.
 *    드래그드롭 바인딩·checkValidBind·행 액션(추가속성/Unbind)·멀티/동기화는 후속 스텝.
 *
 *  노드 키(원본 TY_TREE_DESIGN 1:1): PARENT/CHILD/DESCR/SUBTX/OBJID/UIATK/UIATT/UIATY/UIADT/ISMLB/ISSTR/
 *    UIATV(바인딩경로)/ISBND/MPROP/DATYP(01=UI/02=Attr/03=그룹)/EMATT/EMATT_ICON/_check_visible/_highlight/
 *    S_14_*(29). CHILD 명명: OBJID / OBJID-PROP / OBJID-AGGR / OBJID-UIATK(직접입력 aggr는 _1).
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.H) { return; }

    var H = oAPP.H;

    // 데이터 유형(원본 CS_DATYP): 01=UI(T_0014), 02=Attribute(T_0015), 03=ATTR 그룹표현.
    var CS_DATYP = { UOBJ: "01", ATTR: "02", ATTY: "03" };

    // 트리 노드 기본형(원본 TY_TREE_DESIGN 핵심 — 렌더/변환에 쓰는 필드 + S_14_* 보존).
    function _newNode() {
        return {
            PARENT: "", CHILD: "", DESCR: "", SUBTX: "",
            OBJID: "", PUIATK: "", UIOBK: "", UILIB: "", POBID: "", PUIOK: "",
            UIATK: "", UIATT: "", UIASN: "", UIATY: "", ISMLB: "", UIADT: "", ISSTR: "",
            UIATV: "", ISBND: "", ISSPACE: "", ADDSC: "", MPROP: "", ISWIT: "",
            DATYP: "", EMATT: "", EMATT_ICON: null,
            chk_seleced: false, _check_vs: null, _highlight: null,
            _image_src: null, _icon_src: null, _image_visible: false, _icon_visible: false,
            _bind_visible: false, _unbind_visible: false, _check_visible: false,
            _drop_enable: false, _bind_error: false,
            zTREE_DESIGN: []
        };
    }

    // S_14_* 로 T_0014 전 필드 보존(전송 시 역매핑 — 원본 1:1).
    var S14_KEYS = ["APPID", "GUINR", "OBJID", "POSIT", "POBID", "UIOBK", "PUIOK", "ISAGR", "AGRID",
        "ISDFT", "OBDEC", "AGTYP", "UIATK", "UIATT", "UIASN", "UIATY", "UIADT", "UIADS", "VALKY",
        "ISLST", "ISMLB", "TOOLB", "UIFND", "PUIATK", "UILIB", "ISEXT", "TGLIB", "DEL_UOK", "DEL_POK", "ISECP"];

    var oD = { tool: null, host: null, ctrl: null };

    // 텍스트+아이콘 액션 버튼(공통 .u4a-btn) — 원본 sap.m.Button(type Accept/Emphasized/Reject).
    function _btn(sFa, sText, sTip, sVariant, bDisabled, fn) {
        var b = H.el("button", "u4a-btn" + (sVariant ? " " + sVariant : ""));
        b.type = "button";
        if (sFa) { b.innerHTML = H.fa(sFa); }
        if (sText) { b.appendChild(document.createTextNode(sText)); }
        if (sTip) { b.title = sTip; b.setAttribute("aria-label", sTip); }
        if (bDisabled) { b.disabled = true; }
        if (typeof fn === "function") { b.addEventListener("click", fn); }
        return b;
    }
    // Stage5(멀티/동기화/Unbind) 핸들러 호출 — 아직 미배선이면 안전 무시(정의되면 자동 배선).
    function _call(sFn) {
        if (typeof oAPP.fn[sFn] === "function") {
            try { oAPP.fn[sFn](); } catch (e) { console.error("[HTML5][bindWindow] " + sFn + ":", e && e.message); }
        }
    }

    /* ── 트리 데이터 빌더(원본 designTree.js 360~687 1:1) ─────────────────── */

    // UI 노드(원본 _setDesignTreeData0014).
    function _build0014(s0014, aTree) {
        var t = _newNode();
        t.PARENT = s0014.POBID;
        // 부모를 현재 T_0014 에서 못 찾으면 ROOT.
        if ((oAPP.attr.T_0014 || []).findIndex(function (a) { return a.OBJID === s0014.POBID; }) === -1) { t.PARENT = ""; }
        t.CHILD = s0014.OBJID; t.OBJID = s0014.OBJID; t.DESCR = s0014.OBJID; t.PUIATK = s0014.PUIATK;
        t.UILIB = s0014.UILIB; t.POBID = s0014.POBID; t.PUIOK = s0014.PUIOK;
        for (var k = 0; k < S14_KEYS.length; k++) { t["S_14_" + S14_KEYS[k]] = s0014[S14_KEYS[k]]; }
        t.DATYP = CS_DATYP.UOBJ;
        t._highlight = "Success";
        t.EMATT = t.S_14_UIATT;
        if (t.EMATT !== "") {
            t.EMATT_ICON = "sap-icon://color-fill";                 // 0:1
            if (t.S_14_ISMLB === "X") { t.EMATT_ICON = "sap-icon://dimension"; }   // 0:N
        }
        // UI 컨트롤 아이콘(T_0022 UICON) — fnGetSapIconPath 있으면 이미지, 없으면 skip(FA 폴백은 icon()).
        var s0022 = (oAPP.attr.T_0022 || []).find(function (a) { return a.UIOBK === t.S_14_UIOBK; });
        if (s0022 && typeof oAPP.fn.fnGetSapIconPath === "function") {
            try { t._image_src = oAPP.fn.fnGetSapIconPath(s0022.UICON); t._image_visible = true; } catch (e) { }
        }
        aTree.push(t);
    }

    // Properties 그룹 + 프로퍼티 자식(원본 _setDesignTreeDataProp).
    function _buildProp(s0014, aTree) {
        var a0023 = (oAPP.attr.T_0023 || []).filter(function (a) { return a.UIOBK === s0014.UIOBK; });
        if (a0023.length === 0) { return; }
        var aProp = a0023.filter(function (a) { return a.UIATY === "1" || (a.UIATY === "3" && a.ISSTR === "X"); });
        if (aProp.length === 0) { return; }

        var g = _newNode();
        g.PARENT = s0014.OBJID; g.CHILD = s0014.OBJID + "-PROP"; g.OBJID = s0014.OBJID;
        g.DESCR = "Properties"; g.SUBTX = " : " + s0014.OBJID; g.DATYP = CS_DATYP.ATTY;
        aTree.push(g);

        for (var i = 0; i < aProp.length; i++) {
            var p = aProp[i];
            var t = _newNode();
            t.PARENT = s0014.OBJID + "-PROP"; t.CHILD = s0014.OBJID + "-" + p.UIATK;
            t.OBJID = s0014.OBJID; t.UIOBK = s0014.UIOBK;
            t.UILIB = s0014.UILIB; t.POBID = s0014.POBID; t.PUIOK = s0014.PUIOK;
            t.UIATK = p.UIATK; t.UIATT = p.UIATT; t.UIASN = p.UIASN; t.UIATY = p.UIATY;
            t.UIADT = p.UIADT; t.ISMLB = p.ISMLB; t.ISSTR = p.ISSTR;
            // 직접 입력 가능한 aggregation → 프로퍼티로 치환(_1).
            if (p.UIATY === "3" && p.ISSTR === "X") { t.CHILD += "_1"; t.UIATK += "_1"; t.UIATY = "1"; }
            t.DESCR = p.UIATT; t.DATYP = CS_DATYP.ATTR;
            t._icon_src = "sap-icon://customize"; t._icon_visible = true; t._check_visible = true;
            aTree.push(t);
        }
    }

    // Aggregations 그룹 + N건 aggregation 자식(원본 _setDesignTreeDataAggr).
    function _buildAggr(s0014, aTree) {
        var a0023 = (oAPP.attr.T_0023 || []).filter(function (a) { return a.UIOBK === s0014.UIOBK; });
        if (a0023.length === 0) { return; }
        var aAggr = a0023.filter(function (a) { return a.UIATY === "3" && a.ISMLB === "X"; });
        if (aAggr.length === 0) { return; }

        var g = _newNode();
        g.PARENT = s0014.OBJID; g.CHILD = s0014.OBJID + "-AGGR"; g.OBJID = s0014.OBJID;
        g.DESCR = "Aggregations"; g.SUBTX = " : " + s0014.OBJID; g.DATYP = CS_DATYP.ATTY;
        aTree.push(g);

        for (var i = 0; i < aAggr.length; i++) {
            var p = aAggr[i];
            var t = _newNode();
            t.PARENT = s0014.OBJID + "-AGGR"; t.CHILD = s0014.OBJID + "-" + p.UIATK;
            t.OBJID = s0014.OBJID; t.UIOBK = s0014.UIOBK;
            t.UILIB = s0014.UILIB; t.POBID = s0014.POBID; t.PUIOK = s0014.PUIOK;
            t.UIATK = p.UIATK; t.UIATT = p.UIATT; t.UIASN = p.UIASN; t.UIATY = p.UIATY;
            t.UIADT = p.UIADT; t.ISSTR = p.ISSTR; t.ISMLB = p.ISMLB;
            t.DESCR = p.UIATT; t.DATYP = CS_DATYP.ATTR;
            t._icon_src = "sap-icon://dimension"; t._icon_visible = true; t._check_visible = true;
            aTree.push(t);
        }
    }

    // 기존 바인딩(T_0015 ISBND="X") 매핑(원본 _setBindAttrData).
    function _bindAttr(s0014, aTree) {
        var a0015 = (oAPP.attr.T_0015 || []).filter(function (a) { return a.OBJID === s0014.OBJID && a.ISBND === "X"; });
        if (a0015.length === 0) { return; }
        for (var i = 0; i < a0015.length; i++) {
            var b = a0015[i];
            var t = aTree.find(function (a) { return a.OBJID === b.OBJID && a.UIATK === b.UIATK; });
            if (!t) { continue; }
            t.UIATV = b.UIATV; t.ISBND = b.ISBND; t.ISSPACE = b.ISSPACE;
            t.MPROP = b.MPROP; t.ADDSC = b.ADDSC; t.ISWIT = b.ISWIT;
            // 버튼 활성 플래그(있으면 — 행 액션 스텝에서 배선).
            if (typeof oAPP.fn.setDesignTreeEnableButton === "function") { try { oAPP.fn.setDesignTreeEnableButton(t); } catch (e) { } }
        }
    }

    /************************************************************************
     * 디자인 트리 데이터 구성(원본 setDesignTreeData 1:1) — T_0014 → 트리 → 렌더.
     ************************************************************************/
    oAPP.fn.setDesignTreeData = function () {
        var a0014 = oAPP.attr.T_0014 || [];
        var aTree = [];
        oAPP.attr.designFlat = [];
        oAPP.attr.designTree = [];

        if (a0014.length !== 0) {
            for (var i = 0; i < a0014.length; i++) {
                _build0014(a0014[i], aTree);
                _buildProp(a0014[i], aTree);
                _buildAggr(a0014[i], aTree);
                _bindAttr(a0014[i], aTree);
                // _setPrevData(미리보기 구조)·SEND-ROOT-OBJID(브로드캐스트)는 상호작용/Stage6 스텝.
            }
            oAPP.attr.designFlat = aTree;
            oAPP.attr.designTree = oAPP.fn.setTreeData(aTree, "CHILD", "PARENT", "zTREE_DESIGN");
        }

        if (oD.ctrl) { oD.ctrl.rerender(true); }
    };

    /* ── 영역 UI ──────────────────────────────────────────────────────────── */

    // 원본 상태 아이콘(sap-icon) → FA(디자인 트리 아이콘 매핑).
    function _nodeIcon(n) {
        if (n.DATYP === CS_DATYP.UOBJ) { return H.fa("cube"); }              // UI 노드
        if (n._icon_src === "sap-icon://customize") { return H.fa("sliders"); }  // 프로퍼티
        if (n._icon_src === "sap-icon://dimension") { return H.fa("cubes"); }    // 애그리게이션
        return "";   // Properties/Aggregations 그룹(아이콘 없음)
    }

    oAPP.fn.initDesignArea = function () {
        oD.tool = document.getElementById("bwpDesignTool");
        oD.host = document.getElementById("bwpDesignTree");
        if (!oD.tool || !oD.host) { return; }

        // ── 툴바(원본 designTree.js:3703 1:1) — 펼침/접힘 · 선택해제 · [동일속성 바인딩 · 멀티 바인딩 ·
        //    Unbind] · 도움말. 바인딩 3버튼은 원본 색(Accept 녹색 / Emphasized 파랑 / Reject 빨강)을 유지.
        //    실제 일괄 적용 로직(onSynchronizionBind/onMultiBind/onMultiUnbind)은 통신·적용 단계(Stage5)에서 배선. ──
        var bRO = !oAPP.attr.editable;   // IS_EDIT !== "X" → 편집 불가(원본 enabled="{/edit}").
        oD.tool.innerHTML = "";
        oD.tool.appendChild(H.iconBtn("angles-down", H.z("169"), function () { if (oD.ctrl) { oD.ctrl.expandSelected(); } }));  // 169 Expand All
        oD.tool.appendChild(H.iconBtn("angles-up", H.z("170"), function () { if (oD.ctrl) { oD.ctrl.collapseSelected(); } }));   // 170 Collapse All
        oD.tool.appendChild(H.el("span", "u4aBwpToolSep"));
        oD.tool.appendChild(H.iconBtn("ban", H.z("187"), function () { _clearChecks(); }));   // 187 Clear selection
        oD.tool.appendChild(H.el("span", "u4aBwpToolSep"));
        // 129 동일속성 바인딩 일괄적용(Accept, 녹색) / 130 멀티 바인딩(Emphasized, 파랑) / 186 Unbind(Reject, 빨강).
        oD.tool.appendChild(_btn("check-double", H.z("129"), H.z("129"), "u4aBwpBtn--sync", bRO, function () { _call("onSynchronizionBind"); }));
        oD.tool.appendChild(_btn("link", H.z("130"), H.z("130"), "u4a-btn--emphasized", bRO, function () { _call("onMultiBind"); }));
        oD.tool.appendChild(_btn("link-slash", H.z("186"), H.z("186"), "u4a-btn--negative", bRO, function () { _call("onMultiUnbind"); }));
        oD.tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
        oD.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp(); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));

        // ── 공통 다열 그리드 트리(U4AUI.makeColumnTree — Object Name / 바인딩 경로 / MPROP) ──
        oD.ctrl = U4AUI.makeColumnTree(oD.host, {
            columns: [
                { label: H.z("174"), width: "18rem" },   // 174 Object Name
                { label: H.z("165"), width: "14rem" },   // 165 바인딩 경로
                { label: "MPROP", width: "10rem" }        // MPROP(원본 하드코딩)
            ],
            roots: function () { return oAPP.attr.designTree || []; },
            children: function (n) { return n.zTREE_DESIGN || []; },
            hasChildren: function (n) { return !!(n.zTREE_DESIGN && n.zTREE_DESIGN.length); },
            key: function (n) { return n.CHILD; },
            label: function (n) { return (n.DESCR || "") + (n.SUBTX || ""); },
            tip: function (n) { return (n.DESCR || "") + (n.SUBTX || ""); },
            icon: function (n) { return _nodeIcon(n); },
            selectable: true,
            emptyText: H.z("162"),   // 162 No data(원본 TreeTable noData)
            // 체크박스(멀티 선택 대상 — _check_visible 인 속성/애그리게이션 라인만).
            slotLead: function (n) {
                if (!n._check_visible) { return null; }
                var oChk = H.el("input", "u4aBwpDesignChk");
                oChk.type = "checkbox";
                oChk.checked = !!n.chk_seleced;
                oChk.addEventListener("click", function (e) { e.stopPropagation(); });
                oChk.addEventListener("change", function () { n.chk_seleced = oChk.checked; });
                return oChk;
            },
            // C2 = 바인딩 경로(UIATV), C3 = MPROP.
            cell: function (n) {
                var oPath = H.el("span", "u4aBwpDesignPath", n.UIATV || "");
                if (n.UIATV) { oPath.setAttribute("data-tip", n.UIATV); oPath.setAttribute("data-tip-trunc", ""); }
                var oMp = H.el("span", "u4aBwpDescTxt", n.MPROP || "");
                if (n.MPROP) { oMp.setAttribute("data-tip", n.MPROP); oMp.setAttribute("data-tip-trunc", ""); }
                return { c2: oPath, c3: oMp };
            },
            rowHook: function (oRow, n) {
                var sHl = H.rowHl(n._highlight);
                if (sHl) { oRow.classList.add(sHl); }
            },
            onSelect: function (n) { oAPP.attr.selDesignNode = n; }
        });

        // 초기 렌더(현재 T_0014 로 — 브로드캐스트 전엔 빈 트리). Stage6 에서 데이터 도착 시 재호출.
        oAPP.fn.setDesignTreeData();
    };

    // 체크박스 전체 해제(원본 onClearSelection).
    function _clearChecks() {
        function rec(a) {
            if (!a) { return; }
            for (var i = 0; i < a.length; i++) { a[i].chk_seleced = false; rec(a[i].zTREE_DESIGN); }
        }
        rec(oAPP.attr.designTree);
        if (oD.ctrl) { oD.ctrl.rerender(false); }
    }

})();
