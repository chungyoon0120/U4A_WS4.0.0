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

    /************************************************************************
     * [P6 송신] WS20 전송용 T_0014 구성 — 원본 broadcastChannelBindPopup.js set0014Data 1:1.
     *   디자인 트리를 평면화해 DATYP==="01"(UI 오브젝트) 행만 추리고, 보존해 둔 S_14_* 를 T_0014 필드로 역매핑.
     *   (원본 parseTree2Tab(zTREE_DESIGN) + filter(DATYP==="01") 대응 — 트리가 SSOT 이므로 재귀 수집.)
     ************************************************************************/
    oAPP.fn.getDesignT0014 = function () {
        var aOut = [];
        (function rec(aList) {
            if (!aList) { return; }
            for (var i = 0; i < aList.length; i++) {
                var n = aList[i];
                if (n.DATYP === "01") {
                    var s = {};
                    for (var k = 0; k < S14_KEYS.length; k++) { s[S14_KEYS[k]] = n["S_14_" + S14_KEYS[k]]; }
                    aOut.push(s);
                }
                rec(n.zTREE_DESIGN);
            }
        })(oAPP.attr.designTree || []);
        return aOut;
    };

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
    // 툴바 핸들러 호출 — 클릭한 버튼을 앵커로 넘긴다(원본 oEvent.oSource → 오류목록 팝오버 openBy 대상).
    function _call(sFn, oAnchor) {
        if (typeof oAPP.fn[sFn] === "function") {
            try { oAPP.fn[sFn](oAnchor); } catch (e) { console.error("[HTML5][bindWindow] " + sFn + ":", e && e.message); }
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

    /* ── 좌측 필드 → 디자인트리 드롭(원본 onDropBindField/_setBindAttribute) ──────── */

    // 드래그 데이터 정합성(원본 _checkDragData 축약) — DnDRandKey(=SSID) 일치 + 사전 오류 없음.
    function _checkDragData(sPrc001) {
        var r = { RETCD: "", RTMSG: "", IF_DATA: null };
        if (!sPrc001) { r.RETCD = "E"; return r; }
        var o;
        try { o = JSON.parse(sPrc001); } catch (e) { r.RETCD = "E"; return r; }
        if (!o || o.PRCCD !== "PRC001") { r.RETCD = "E"; return r; }
        if (o.DnDRandKey !== oAPP.attr.DnDRandKey) { r.RETCD = "E"; return r; }   // 다른 팝업 인스턴스 드래그 차단.
        if (o.RETCD === "E") { r.RETCD = "E"; r.RTMSG = o.RTMSG || ""; return r; } // 추가속성 검증 오류.
        r.IF_DATA = o.IF_DATA;
        return r;
    }

    // 드롭 위치 tree 노드(원본 _getContextData) — 이벤트 target 의 행에서 __bwpNode.
    function _dropNodeOf(ev) {
        var oRow = (ev.target && ev.target.closest) ? ev.target.closest(".u4a-tree__row") : null;
        return oRow ? oRow.__bwpNode : undefined;
    }

    // design tree 라인 오류 필드 초기화(원본 _resetErrorFieldLine 1:1).
    function _resetErrorFieldLine(sTree) {
        sTree._bind_error = false;
        sTree._check_vs = null;
        sTree._style = "";
        sTree._error_tooltip = null;
    }

    // dropAble 프로퍼티 unbind 예외처리(원본 excepUnbindDropAbleProperty 1:1).
    //   DATYP02·UIATY1·UIASN==="DROPABLE"·UIATV="" 일 때 prev._T_0015 의 DNDDROP 수집건 제거.
    function _excepUnbindDropAbleProperty(is_tree) {
        if (is_tree.DATYP !== "02") { return; }
        if (is_tree.UIATY !== "1") { return; }
        if (is_tree.UIASN !== "DROPABLE") { return; }
        if (is_tree.UIATV !== "") { return; }
        var _oUi = oAPP.attr.prev[is_tree.OBJID];
        if (typeof (_oUi && _oUi._T_0015) === "undefined") { return; }
        var _found = _oUi._T_0015.findIndex(function (item) { return item.UIASN === "DNDDROP"; });
        if (_found === -1) { return; }
        _oUi._T_0015.splice(_found, 1);
    }

    // 디자인 트리 재렌더(해제/바인딩 후 공통 후속).
    //   ★ 컬럼 재적합(fitTreeColumns) 안 함 — 바인딩/해제는 레이아웃 변경이 아니다(원본은 refreshBindLayoutTables=패널 표시/숨김 때만 재적합).
    //     여기서 재적합하면 사용자가 수동으로 조절한 컬럼 폭이 autofit 으로 덮여 기본폭으로 튄다(장군님 지적 2026-07-14).
    function _refreshDesignTree() {
        if (oD.ctrl) { oD.ctrl.rerender(false); }
    }

    /************************************************************************
     * 행 액션 - 바인딩 해제(원본 onUnbind 1:1). 대상 노드 n 을 직접 받음.
     *   ★ WS20 busy 핸드셰이크(setBusyWS20Interaction)는 P6 — 로컬 해제는 동기이므로 busy 생략.
     *   ★ 참조필드/추가속성 후속(setRefFieldList/clearSelectAdditBind/setAdditLayout)은 P3 — 가드 호출.
     ************************************************************************/
    oAPP.fn.onUnbind = function (n) {
        if (!n) { return; }
        // 185 Do you want to continue unbind?
        U4AUI.confirm({
            type: "C",
            message: H.z("185"),
            buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
            onClose: function (sAct) {
                if (sAct !== "YES") { return; }

                if (typeof oAPP.fn.resetErrorField === "function") { try { oAPP.fn.resetErrorField(); } catch (e) { } }

                switch (n.UIATY) {
                    case "1":
                        oAPP.fn.attrSetUnbindProp(n);
                        _excepUnbindDropAbleProperty(n);   // dropAble 프로퍼티 예외.
                        break;
                    case "3":
                        oAPP.fn.attrUnbindAggr(oAPP.attr.prev[n.OBJID], n.UIATT, n.UIATV);
                        oAPP.fn.attrSetUnbindProp(n);
                        oAPP.fn.attrUnbindTree(n);   // Tree/TreeTable PARENT·CHILD 예외.
                        break;
                    default: break;
                }

                _refreshDesignTree();

                // 후속(P3 도착 전 가드): 참조필드/추가속성/좌측 재판정.
                if (typeof oAPP.attr.oAddit === "object" && oAPP.attr.oAddit && oAPP.attr.oAddit.fn
                    && typeof oAPP.attr.oAddit.fn.setRefFieldList === "function") { try { oAPP.attr.oAddit.fn.setRefFieldList(); } catch (e) { } }
                if (typeof oAPP.fn.clearSelectAdditBind === "function") { try { oAPP.fn.clearSelectAdditBind(); } catch (e) { } }
                if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(""); } catch (e) { } }
                if (typeof oAPP.fn.bindPossibleRecompute === "function") { try { oAPP.fn.bindPossibleRecompute(n); } catch (e) { } }

                // 153 바인딩 해제 처리를 완료 했습니다.
                oAPP.fn.toast(H.z("153"));
            }
        });
    };

    /************************************************************************
     * [SPEC §3.5 · 원본 designTree.js:225 _showBindAdditInfo] 바인딩경로 링크 클릭 →
     *   ★ 중앙 하단(DESIGN_ADDIT) 패널을 그 필드 정보로 재구성해 표시(vis_addit).
     *     우측(MAIN_ADDIT 스테이징)은 절대 건드리지 않는다 — setAdditBindInfo 는 SEL 스토어 전용.
     *   게이트 통과 못하면 중앙 하단 숨김(setAdditLayout("")).
     ************************************************************************/
    oAPP.fn.onShowBindAdditInfo = function (n) { _showBindAdditInfo(n); };

    function _showBindAdditInfo(sTree) {
        if (typeof oAPP.fn.clearSelectAdditBind === "function") { try { oAPP.fn.clearSelectAdditBind(); } catch (e) { } }
        function _hide() { if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(""); } catch (e) { } } }

        if (!sTree || sTree.UIATV === "") { _hide(); return; }          // 바인딩 없음.
        if (sTree.UIATY !== "1") { _hide(); return; }                   // 프로퍼티만.

        var _sBind = oAPP.fn.getModelBindData(sTree.UIATV, oAPP.attr.modelTree);
        if (typeof _sBind === "undefined") { oAPP.fn.toast(H.z("150", sTree.UIATV)); _hide(); return; }   // 150 필드 없음.
        if (_sBind.KIND !== "E") { _hide(); return; }                   // 일반 필드만.

        var _sParent = oAPP.fn.getModelBindData(_sBind.PARENT, oAPP.attr.modelTree);
        if (typeof _sParent === "undefined") { oAPP.fn.toast(H.z("150", _sBind.PARENT)); _hide(); return; }

        oAPP.attr.S_SEL_ATTR = JSON.parse(JSON.stringify(sTree));       // 선택 attribute 전역화(원본).
        if (typeof oAPP.fn.setAdditBindInfo === "function") {
            oAPP.fn.setAdditBindInfo(_sBind, sTree.MPROP, _sParent.zTREE);   // 중앙 하단(SEL) = 선택 필드로 재구성.
        }
        if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(_sBind.KIND); } catch (e) { } }
    }

    /************************************************************************
     * [139 추가속성적용] 중앙 하단(DESIGN_ADDIT) — 원본 onAdditBind(index.js:8602)→setMPROP(designTree.js:2780) 1:1.
     *   중앙 하단에서 고친 값(additRowsSel)을 S_SEL_ATTR 선택행 + prev._T_0015 에 stamp 후 트리 갱신.
     *   ★ WS20 busy 왕복·UPDATE-DESIGN-DATA 방송 = P6. 여기선 로컬 적용 + toast(090)까지.
     ************************************************************************/
    oAPP.fn.applyDesignAdditBind = async function (oAnchor) {
        // ① 중앙 하단 입력 완결성(원본 chkAdditBindData(oAdditTab=DESIGN_ADDIT)).
        var _r1 = (typeof oAPP.fn.chkAdditBindData === "function") ? oAPP.fn.chkAdditBindData("SEL") : { RETCD: "" };
        if (_r1.RETCD === "E") { await _showErr(oAnchor, _r1); return; }   // [SPEC §6] 목록 팝오버.

        // ② 선택 attribute(S_SEL_ATTR) 존재.
        var _sAttr = oAPP.attr.S_SEL_ATTR;
        if (!_sAttr || !_sAttr.OBJID) { return; }

        // ③ 트리 라인 + UI 정보(_T_0015) 확인(원본 setMPROP).
        var _sTree = (typeof oAPP.fn.getDesignTreeAttrData === "function") ? oAPP.fn.getDesignTreeAttrData(_sAttr.OBJID, _sAttr.UIATK) : undefined;
        if (typeof _sTree === "undefined") { oAPP.fn.toast(H.z("110", _sAttr.UIATT || _sAttr.OBJID)); return; }   // 110 정보 없음.
        var _oUi = oAPP.attr.prev && oAPP.attr.prev[_sTree.OBJID];
        if (!_oUi || !_oUi._T_0015) { oAPP.fn.toast(H.z("110", _sTree.OBJID)); return; }

        // ④ 로컬 적용: 트리행 + _T_0015 stamp(중앙 하단 스토어 = additRowsSel).
        _sTree.MPROP = oAPP.fn.setAdditBindData(oAPP.attr.additRowsSel);
        var _s15 = _oUi._T_0015.find(function (it) { return it.UIATK === _sTree.UIATK; });
        if (_s15) { _s15.MPROP = _sTree.MPROP; }

        _refreshDesignTree();
        oAPP.fn.toast(H.z("090"));   // 090 적용 완료.
        // [P6] WS20 반영(§3.11) — MPROP stamp 는 attrChange 를 거치지 않으므로 명시 방송.
        //   busy 는 여기서 켜고 WS20 왕복(UPDATE_DESIGN_DATA 수신) 후에 풀린다 — 스스로 끄지 않음.
        if (typeof oAPP.fn.designBroadcastUpdate === "function") { oAPP.fn.designBroadcastUpdate(); }
    };

    /************************************************************************
     * [SPEC §6] 전 라인 오류표시 초기화 — 원본 designTree.js resetErrorField 1:1.
     ************************************************************************/
    oAPP.fn.resetErrorField = function () {
        (function rec(a) {
            if (!a) { return; }
            for (var i = 0; i < a.length; i++) { _resetErrorFieldLine(a[i]); rec(a[i].zTREE_DESIGN); }
        })(oAPP.attr.designTree || []);
    };

    /************************************************************************
     * [SPEC §6] 검증 오류 표시 — 목록이 있으면 팝오버, 없으면(단문) 토스트 폴백.
     *   원본: showMessagePopoverOppener(oEvent.oSource, _sRes.T_RTMSG).
     ************************************************************************/
    async function _showErr(oAnchor, oRes) {
        var aMsg = (oRes && oRes.T_RTMSG) || [];
        if (oAnchor && aMsg.length && typeof oAPP.fn.showMessagePopoverOppener === "function") {
            await oAPP.fn.showMessagePopoverOppener(oAnchor, aMsg);
            return;
        }
        if (oRes && oRes.RTMSG) { oAPP.fn.toast(oRes.RTMSG); }   // 앵커/목록 없을 때만 토스트.
    }

    /************************************************************************
     * [SPEC §6] 오류행 수집(TY_BIND_ERROR) — 원본 checkMultiBinding/Unbinding/AdditBind 1:1.
     *   sLineKey(디자인트리 CHILD) 가 있으면 ACT04(라인) + 위치확인 링크 노출,
     *   없으면 영역 단위(ACT02 디자인트리 / ACT01 모델트리)로 링크 숨김.
     ************************************************************************/
    function _pushErr(aOut, sTitle, sDesc, sLineKey, sActcdArea) {
        var A = oAPP.attr.CS_MSG_ACTCD || {};
        var bLine = !!sLineKey;
        aOut.push(oAPP.fn.newBindError({
            ACTCD: bLine ? A.ACT04 : (sActcdArea || A.ACT02),
            LINE_KEY: sLineKey || "",
            TYPE: "Error", TITLE: sTitle, DESC: sDesc,
            LK_VIS: bLine   // 이동할 라인이 있을 때만 "오류 위치 확인" 노출(원본).
        }));
    }

    /************************************************************************
     * [SPEC §6] 디자인 트리 오류 라인 강조 + 스크롤 이동
     *   — 원본 showMessagePopover.js setFocusErrorDesignLine 1:1
     *     (resetErrorField → _check_vs="Error" → getTreeItemIndex → setFirstVisibleRow).
     *   HTML5: 노드 마크 후 재렌더 → 해당 행 DOM 을 scrollIntoView.
     ************************************************************************/
    oAPP.fn.focusErrorDesignLine = function (LINE_KEY) {
        if (!LINE_KEY) { return; }
        oAPP.fn.resetErrorField();   // 원본: 표시 전 초기화.

        var oNode = null;
        (function rec(a) {
            if (!a || oNode) { return; }
            for (var i = 0; i < a.length; i++) {
                if (a[i].CHILD === LINE_KEY) { oNode = a[i]; return; }
                rec(a[i].zTREE_DESIGN);
                if (oNode) { return; }
            }
        })(oAPP.attr.designTree || []);
        if (!oNode) { return; }

        oNode._bind_error = true;
        oNode._check_vs = "Error";
        oNode._highlight = "Error";   // 행 좌측 상태바(H.rowHl → u4aBwpRow--error).

        _refreshDesignTree();

        // 해당 행으로 스크롤(원본 setFirstVisibleRow 대응).
        try {
            var oRow = null, aRows = oD.host ? oD.host.querySelectorAll(".u4aColTreeRow") : [];
            for (var r = 0; r < aRows.length; r++) {
                if (aRows[r].__bwpNode && aRows[r].__bwpNode.CHILD === LINE_KEY) { oRow = aRows[r]; break; }
            }
            if (oRow && typeof oRow.scrollIntoView === "function") { oRow.scrollIntoView({ block: "nearest" }); }
        } catch (e) { }
    };

    // [SPEC §6] 오류목록 팝오버 닫힘 시 트리 재렌더(원본 clearError 의 model.refresh 대응).
    oAPP.fn.refreshDesignTree = function () { _refreshDesignTree(); };

    /************************************************************************
     * [SPEC §3.8/§6 게이트] 멀티 바인딩 가능여부 — 원본 designArea/checkMultiBinding.js 1:1.
     *   차단: 디자인 미선택(087+142) · 모델필드 미선택(085+083) · checkValidBind 실패행 1건이라도(088).
     *   ★ 원본 §11-7 낙관적 fallthrough(0건 분기에 return 없음) 그대로 — 뒤 재검사가 실제 종료 담당.
     ************************************************************************/
    function _checkMultiBinding() {
        var _sRes = { RETCD: "", RTMSG: "", T_RTMSG: [] };
        oAPP.fn.resetErrorField();

        var _aTree = oAPP.fn.getSelectedDesignTree();
        if (_aTree.length === 0) {
            _sRes.RETCD = "E"; _sRes.RTMSG = H.z("087");
            _pushErr(_sRes.T_RTMSG, H.z("087"), H.z("142"));   // 087 라인 미선택 / 142 안내.
        }

        var _sField = (typeof oAPP.fn.getSelectedModelLine === "function") ? oAPP.fn.getSelectedModelLine() : undefined;
        if (typeof _sField === "undefined") {
            _sRes.RETCD = "E"; _sRes.RTMSG = H.z("085");
            _pushErr(_sRes.T_RTMSG, H.z("085"), H.z("083"), "", (oAPP.attr.CS_MSG_ACTCD || {}).ACT01);   // 085 모델필드 미선택 / 083 안내(ACT01=모델트리 영역).
            return _sRes;
        }
        if (_aTree.length === 0) { return _sRes; }   // 원본 동일(위에서 이미 E 세팅).

        var _bErr = false;
        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            var _sChk = oAPP.fn.checkValidBind(_sTree, _sField);
            if (_sChk.RETCD !== "E") { continue; }
            _bErr = true;
            _sTree._bind_error = true;   // 실패행 마크(빨간 하이라이트 렌더 = P6 잔여).
            _pushErr(_sRes.T_RTMSG, H.z("144", (_sTree.OBJID || "") + " - " + (_sTree.UIATT || "")),
                oAPP.common.msg(_sChk.MSGID, _sChk.MSGNO), _sTree.CHILD);   // 144 &1 필드 바인딩 오류.
        }
        if (_bErr) {
            _refreshDesignTree();
            _sRes.RETCD = "E"; _sRes.RTMSG = H.z("088");   // 088 오류행 존재 → 멀티 바인딩 불가.
        }
        return _sRes;
    }

    /************************************************************************
     * [SPEC §3.7/§6 게이트] 멀티 해제 가능여부 — 원본 designArea/checkMultiUnbinding.js 1:1.
     *   차단: 디자인 미선택(087+145) · 미바인딩(UIATV==="") 행 1건이라도(147).
     ************************************************************************/
    function _checkMultiUnbinding() {
        var _sRes = { RETCD: "", RTMSG: "", T_RTMSG: [] };
        var _aTree = oAPP.fn.getSelectedDesignTree();
        if (_aTree.length === 0) {
            _sRes.RETCD = "E"; _sRes.RTMSG = H.z("087");
            _pushErr(_sRes.T_RTMSG, H.z("087"), H.z("145"));   // 087 / 145 안내.
            return _sRes;
        }
        var _bErr = false;
        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            if (_sTree.UIATV !== "") { continue; }
            _bErr = true;
            _sTree._bind_error = true;
            _pushErr(_sRes.T_RTMSG, H.z("144", (_sTree.OBJID || "") + " - " + (_sTree.UIATT || "")),
                H.z("108"), _sTree.CHILD);   // 108 바인딩되지 않은 필드 선택.
        }
        if (_bErr) {
            _refreshDesignTree();
            _sRes.RETCD = "E"; _sRes.RTMSG = H.z("147");   // 147 오류행 존재 → 멀티 해제 불가.
        }
        return _sRes;
    }

    /************************************************************************
     * [SPEC §3.8] 멀티 바인딩(130) — 원본 designTree.js onMultiBind 1:1.
     *   게이트 → 확인창(166+156, aggregation 기존바인딩 섞이면 181+182 로 교체) → attrSetBindProp 반복 → 157.
     *   ★ 쓰기 함수는 §3.4 드래그드롭과 동일(attrSetBindProp) — 세 경로 결과 일관성 보장.
     *   ★ WS20 반영: attrSetBindProp → attrChange → designBroadcastUpdate(rAF 합침) = 1회 방송(P6).
     ************************************************************************/
    oAPP.fn.onMultiBind = async function (oAnchor) {
        var _sRes = _checkMultiBinding();
        // [SPEC §6] 오류는 목록 팝오버로(원본 showMessagePopoverOppener). 앵커 = 클릭한 버튼.
        if (_sRes.RETCD === "E") { await _showErr(oAnchor, _sRes); return; }

        var _sField = oAPP.fn.getSelectedModelLine();
        if (typeof _sField === "undefined") { return; }

        var _aTree = oAPP.fn.getSelectedDesignTree();

        // 166 &1건 선택 + 156 진행 확인. 기존 aggregation 바인딩이 섞이면 원본은 181+182 로 문구를 "교체"한다.
        var _msg = H.z("166", String(_aTree.length)) + "\n" + H.z("156");
        if (_aTree.findIndex(function (it) { return it.UIATV !== "" && it.UIATY === "3"; }) !== -1) {
            _msg = H.z("181") + H.z("182");   // 181 자식 바인딩 초기화 경고 + 182 계속?
        }
        var _ok = await _confirmAdditApply(_msg);
        if (!_ok) { return; }

        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            _sTree.chk_seleced = false;   // 라인 선택 해제(원본).
            switch (_sTree.UIATY) {
                case "1":
                    oAPP.fn.attrSetBindProp(_sTree, _sField);
                    break;
                case "3":
                    if (_sTree.UIATV !== "" && _sTree.ISBND === "X") {
                        oAPP.fn.attrUnbindAggr(oAPP.attr.prev[_sTree.OBJID], _sTree.UIATT, _sTree.UIATV);
                        oAPP.fn.attrUnbindTree(_sTree);   // Tree/TreeTable PARENT·CHILD 예외.
                    }
                    oAPP.fn.attrSetBindProp(_sTree, _sField);
                    if (oAPP.attr.prev[_sTree.OBJID]) { oAPP.attr.prev[_sTree.OBJID]._MODEL[_sTree.UIATT] = _sTree.UIATV; }
                    break;
                default: break;
            }
        }

        if (typeof oAPP.fn.clearSelectAdditBind === "function") { try { oAPP.fn.clearSelectAdditBind(); } catch (e) { } }
        if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(""); } catch (e) { } }
        _refreshDesignTree();
        oAPP.fn.toast(H.z("157"));   // 157 멀티 바인딩 완료.
    };

    /************************************************************************
     * [SPEC §3.7] 멀티 해제(186) — 원본 designTree.js onMultiUnbind 1:1.
     *   게이트 → 확인창(166+167) → 체크행마다 §3.6 단일해제와 동일 로직 → 155.
     ************************************************************************/
    oAPP.fn.onMultiUnbind = async function (oAnchor) {
        var _sRes = _checkMultiUnbinding();
        if (_sRes.RETCD === "E") { await _showErr(oAnchor, _sRes); return; }

        var _aTree = oAPP.fn.getSelectedDesignTree();
        // 166 &1건 선택 + 167 해제 진행 확인.
        var _ok = await _confirmAdditApply(H.z("166", String(_aTree.length)) + "\n" + H.z("167"));
        if (!_ok) { return; }

        for (var i = 0; i < _aTree.length; i++) {
            var _sTree = _aTree[i];
            _resetErrorFieldLine(_sTree);
            _sTree.chk_seleced = false;
            switch (_sTree.UIATY) {
                case "1":
                    oAPP.fn.attrSetUnbindProp(_sTree);
                    _excepUnbindDropAbleProperty(_sTree);   // dropAble 프로퍼티 예외.
                    break;
                case "3":
                    oAPP.fn.attrUnbindAggr(oAPP.attr.prev[_sTree.OBJID], _sTree.UIATT, _sTree.UIATV);
                    oAPP.fn.attrSetUnbindProp(_sTree);
                    oAPP.fn.attrUnbindTree(_sTree);
                    break;
                default: break;
            }
        }

        if (typeof oAPP.fn.clearSelectAdditBind === "function") { try { oAPP.fn.clearSelectAdditBind(); } catch (e) { } }
        if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(""); } catch (e) { } }
        _refreshDesignTree();
        oAPP.fn.toast(H.z("155"));   // 155 멀티 해제 완료.
    };

    /************************************************************************
     * [SPEC §5.1] 동일속성 바인딩(129) 진입 — 원본 designTree.js onSynchronizionBind 1:1(검증부).
     *   검증: 0건(183) / 2건이상(107) / 미바인딩(108) / 모델필드 매칭실패(109) / 후보 0건(158).
     *   통과 시 = 동일속성 화면으로 전환(§5.2 start) → ★스텝2에서 배선. 부수효과(4종 off) 도 스텝2.
     ************************************************************************/
    oAPP.fn.onSynchronizionBind = async function () {
        var _aTree = oAPP.fn.getSelectedDesignTree();
        if (_aTree.length === 0) { oAPP.fn.toast(H.z("183")); return; }   // 183 선택 라인 없음.
        if (_aTree.length > 1) { oAPP.fn.toast(H.z("107")); return; }     // 107 1건만 선택.

        var _sTree = _aTree[0];
        if (_sTree.UIATV === "") { oAPP.fn.toast(H.z("108")); return; }   // 108 미바인딩 필드 선택.

        var _sField = oAPP.fn.getModelBindData(_sTree.UIATV, oAPP.attr.modelTree);
        if (typeof _sField === "undefined") { oAPP.fn.toast(H.z("109")); return; }   // 109 바인딩 필드 정보 없음.

        var _aList = (typeof oAPP.fn.getSameAttrList === "function") ? oAPP.fn.getSameAttrList(_sTree) : [];
        if (_aList.length === 0) { oAPP.fn.toast(H.z("158", _sTree.UIATT)); return; }   // 158 동일 속성 없음.

        // 검증 통과 — 동일속성 화면 진입(§5.2). ★스텝2에서 배선(현재는 후보 수집까지 완료).
        if (typeof oAPP.fn.openSyncBindScreen === "function") {
            oAPP.fn.openSyncBindScreen(_sTree, _aList);
        } else {
            console.warn("[HTML5][bindWindow] onSynchronizionBind: 동일속성 화면(openSyncBindScreen) 미배선(P4 스텝2). 후보 " + _aList.length + "건 수집 완료.");
        }
    };

    // 디자인트리 체크선택 행 수집(원본 getSelectedDesignTree 1:1) — 멀티/참조필드(P3-C) 공용.
    oAPP.fn.getSelectedDesignTree = function () {
        var aSel = [];
        (function rec(a) {
            if (!a) { return; }
            for (var i = 0; i < a.length; i++) { if (a[i].chk_seleced === true) { aSel.push(a[i]); } rec(a[i].zTREE_DESIGN); }
        })(oAPP.attr.designTree || []);
        return aSel;
    };

    // 적용 확인창(원본 MessageBox.confirm 089) — 공통 U4AUI.confirm. Promise<bool>.
    function _confirmAdditApply(sMsg) {
        return new Promise(function (resolve) {
            U4AUI.confirm({
                type: "C", message: sMsg,
                buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
                onClose: function (sAct) { resolve(sAct === "YES"); }
            });
        });
    }

    // 행 액션 - 추가속성 정보 적용(단건, 원본 onAdditionalBind: designTree.js:1633). ★로컬 적용까지(P3-D).
    //   busy 왕복·UPDATE-DESIGN-DATA 방송 = P6. 검증 오류표시는 간이 toast(정교 showMessagePopover = P6).
    oAPP.fn.onAdditionalBind = async function (n, oAnchor) {
        if (!n) { return; }
        // ① 우측 입력 완결성.
        var _r1 = (typeof oAPP.fn.chkAdditBindData === "function") ? oAPP.fn.chkAdditBindData() : { RETCD: "" };
        if (_r1.RETCD === "E") { await _showErr(oAnchor, _r1); return; }   // [SPEC §6] 목록 팝오버.
        // ② 라인 가능여부.
        var _r2 = (typeof oAPP.fn.chkPossibleAdditBind === "function") ? oAPP.fn.chkPossibleAdditBind(n) : { RETCD: "" };
        if (_r2.RETCD === "E") { oAPP.fn.toast(_r2.RTMSG); return; }
        // ③ UI 정보(_T_0015) 확인.
        var _oUi = oAPP.attr.prev && oAPP.attr.prev[n.OBJID];
        if (!_oUi || !_oUi._T_0015) { oAPP.fn.toast(H.z("106", n.OBJID)); return; }   // 106 UI 정보 없음.
        // ④ 기존 MPROP 있으면 재적용 확인(089).
        if (n.MPROP !== "") {
            var _ok = await _confirmAdditApply(H.z("089"));
            if (!_ok) { return; }
        }
        // ⑤ 로컬 적용: 트리행 + _T_0015 stamp.
        n.MPROP = oAPP.fn.setAdditBindData(oAPP.attr.additRows);
        var _s15 = _oUi._T_0015.find(function (it) { return it.UIATK === n.UIATK; });
        if (_s15) { _s15.MPROP = n.MPROP; }
        oAPP.fn.toast(H.z("154"));   // 154 적용 완료.
        _refreshDesignTree();
        // [P6] WS20 반영(§3.11) — MPROP stamp 는 attrChange 를 안 거치므로 명시 방송.
        if (typeof oAPP.fn.designBroadcastUpdate === "function") { oAPP.fn.designBroadcastUpdate(); }
    };

    // 멀티 적용 stamp(원본 additionalBindMulti: designTree.js:2936) — 체크행 전부 동일 MPROP + _T_0015 갱신.
    oAPP.fn.additionalBindMulti = function (MPROP) {
        var _aTree = oAPP.fn.getSelectedDesignTree();
        if (_aTree.length === 0) { return; }
        for (var i = 0; i < _aTree.length; i++) {
            var n = _aTree[i];
            n.chk_seleced = false;   // 선택 해제.
            n.MPROP = MPROP;
            var _oUi = oAPP.attr.prev && oAPP.attr.prev[n.OBJID];
            if (!_oUi || !_oUi._T_0015) { continue; }
            var _s15 = _oUi._T_0015.find(function (it) { return it.UIATK === n.UIATK; });
            if (_s15) { _s15.MPROP = MPROP; }
        }
        _refreshDesignTree();
        // [P6] WS20 반영(§3.11) — 체크행 N건을 한 번에 stamp 했으므로 방송도 1회(rAF 합침).
        if (typeof oAPP.fn.designBroadcastUpdate === "function") { oAPP.fn.designBroadcastUpdate(); }
    };

    // 바인딩 쓰기 디스패처(원본 _setBindAttribute 1:1 — UIATK _1 제거 + T_0023/0022 가드 + 오류초기화 + switch).
    //   ★ aggregation(UIATY "3")은 confirm(181/182)이 있어 async — 원본 await 흐름 그대로.
    async function _setBindAttribute(is_drag, is_drop) {
        var _UIATK = is_drop.UIATK;
        if (_UIATK.endsWith("_1") === true) { _UIATK = _UIATK.substr(0, _UIATK.lastIndexOf("_1")); }   // 직접입력 aggregation 예외 KEY 제거.
        var _s0023 = (oAPP.attr.T_0023 || []).find(function (item) { return item.UIATK === _UIATK; });
        if (typeof _s0023 === "undefined") { return false; }
        var _s0022 = (oAPP.attr.T_0022 || []).find(function (item) { return item.UIOBK === _s0023.UIOBK; });
        if (typeof _s0022 === "undefined") { return false; }

        _resetErrorFieldLine(is_drop);   // 오류 표현 초기화.

        switch (is_drop.UIATY) {
            case "1":
                oAPP.fn.attrSetBindProp(is_drop, is_drag);   // 프로퍼티 바인딩.
                return true;
            case "3":
                await oAPP.fn.attrBindCallBackAggr(true, is_drag, is_drop);   // aggregation 바인딩(재바인딩 confirm 포함).
                return true;
            default:
                return false;
        }
    }

    // WS20 캔버스 드래그(prc002) 데이터 점검(원본 _chkDesignTreeDragData 1:1 — msg 100/103/104).
    function _chkDesignTreeDragData(sDragData) {
        var _sRes = { RETCD: "", RTMSG: "" };
        function _bad100() { _sRes.RETCD = "E"; _sRes.RTMSG = oAPP.common.zmsg("100"); return _sRes; }   // 100 잘못된 Drag 정보.
        if (typeof sDragData.RETCD === "undefined") { return _bad100(); }
        if (typeof sDragData.RTMSG === "undefined") { return _bad100(); }
        if (typeof sDragData.DnDRandKey === "undefined") { return _bad100(); }
        if (typeof sDragData.T_0014 === "undefined") { return _bad100(); }
        if (typeof sDragData.T_0015 === "undefined") { return _bad100(); }
        if (typeof sDragData.T_CEVT === "undefined") { return _bad100(); }
        if (sDragData.RETCD === "E") { _sRes.RETCD = "E"; _sRes.RTMSG = sDragData.RTMSG; return _sRes; }   // WS20 drop 불가 메시지 전달.
        if (sDragData.T_0014.length === 0) { _sRes.RETCD = "E"; _sRes.RTMSG = oAPP.common.zmsg("103"); return _sRes; }   // 103 Drag UI 없음.
        if (sDragData.DnDRandKey !== oAPP.attr.DnDRandKey) { _sRes.RETCD = "E"; _sRes.RTMSG = oAPP.common.zmsg("104"); return _sRes; }   // 104 같은 세션만.
        return _sRes;
    }

    // WS20 캔버스에서 끌어온 UI(prc002) → 디자인 트리 전체 재구성(원본 dropDesignArea 1:1).
    //   ★ 별창은 별도 BrowserWindow — 원본과 동일하게 native dataTransfer("prc002") 를 소비한다.
    //   반환: true=WS20 드래그로 처리됨(또는 검증오류 표시) / false=prc002 없음 → 프로퍼티 드롭(prc001)으로 폴백.
    oAPP.fn.dropDesignArea = function (oData) {
        if (oAPP.attr.editable === false) { return false; }
        if (typeof oData === "undefined" || oData === null || oData === "") { return false; }
        var _sDragData;
        try { _sDragData = JSON.parse(oData); } catch (e) { return false; }

        var _sRes = _chkDesignTreeDragData(_sDragData);
        if (_sRes.RETCD === "E") { oAPP.fn.toast(_sRes.RTMSG); return true; }

        // 광역변수 갱신(원본) — 이후 setDesignTreeData 가 이걸로 트리 재구성.
        oAPP.attr.T_0014 = _sDragData.T_0014;
        oAPP.attr.T_0015 = _sDragData.T_0015;
        oAPP.attr.T_CEVT = _sDragData.T_CEVT;

        // 추가속성 선택/레이아웃 초기화(P3 도착 전 가드).
        if (typeof oAPP.fn.clearSelectAdditBind === "function") { try { oAPP.fn.clearSelectAdditBind(); } catch (e) { } }
        if (typeof oAPP.fn.setAdditLayout === "function") { try { oAPP.fn.setAdditLayout(""); } catch (e) { } }

        // 디자인 영역 데이터 구성(재렌더 + 컬럼맞춤 포함).
        oAPP.fn.setDesignTreeData();

        // 추가속성 리스트 재구성(P3 가드).
        if (oAPP.attr.oAddit && oAPP.attr.oAddit.fn && typeof oAPP.attr.oAddit.fn.setAdditialListData === "function") {
            try { oAPP.attr.oAddit.fn.setAdditialListData(); } catch (e) { }
        }

        return true;
    };

    // 드롭 처리(원본 onDropBindField 1:1 — WS20 캔버스(prc002) 우선 → 프로퍼티/aggregation(prc001)) — 편집모드 + 검증 통과 시 쓰기 후 재렌더.
    async function _onDesignDrop(ev) {
        if (oAPP.attr.editable === false) { return; }

        // ① WS20 디자인 트리 드래그(prc002) → 디자인 트리 전체 재구성(원본 우선 분기).
        if (oAPP.fn.dropDesignArea(ev.dataTransfer.getData("prc002")) === true) { return; }

        // ② 좌측 모델필드 드래그(prc001) → 바인딩 쓰기.
        var _sRes = _checkDragData(ev.dataTransfer.getData("prc001"));   // ★ dataTransfer 는 await 前 동기 판독.
        if (_sRes.RETCD === "E") { if (_sRes.RTMSG) { oAPP.fn.toast(_sRes.RTMSG); } return; }

        var _sDrop = _dropNodeOf(ev);
        if (typeof _sDrop === "undefined") { return; }

        // 드롭 가능 검증(원본 checkValidBind) — 불가 시 메시지.
        var _chk = oAPP.fn.checkValidBind(_sDrop, _sRes.IF_DATA);
        if (_chk.RETCD === "E") { oAPP.fn.toast(oAPP.common.zmsg(_chk.MSGNO) || ""); return; }

        // DESIGN TREE 드롭은 추가속성 미적용(원본 §4.8-b) — MPROP 초기화.
        _sRes.IF_DATA.MPROP = "";

        if ((await _setBindAttribute(_sRes.IF_DATA, _sDrop)) === false) { return; }
        _sDrop.chk_seleced = false;

        // 재렌더(바인딩 경로 표시). ★컬럼 재적합 안 함 — 바인딩은 레이아웃 변경 아님(수동 폭 보존, 위 _refreshDesignTree 주석 참고).
        if (oD.ctrl) { oD.ctrl.rerender(false); }
    }

    // 디자인트리 호스트에 native 드롭 배선(1회).
    function _wireDesignDrop(oHost) {
        if (!oHost || oHost.__bwpDropWired) { return; }
        oHost.__bwpDropWired = true;

        // WS20 디자인 트리 드래그(외부 창)인지 = dataTransfer 에 prc002 존재(dragover 시 getData 불가 → types 로 판별).
        function _hasPrc002(dt) { return !!(dt && dt.types && Array.prototype.indexOf.call(dt.types, "prc002") !== -1); }
        // 드롭존 표시 토글(마우스 뗄 때까지 유지 — dragenter/over 유지, leave/drop 해제).
        //   ★ 클래스는 비스크롤 래퍼(.u4aBwpDesign)에 — 스크롤 호스트에 걸면 ::after 오버레이 기준이 어긋남.
        var oZone = (oHost.closest && oHost.closest(".u4aBwpDesign")) || oHost;
        function _dropZone(b) { oZone.classList.toggle("u4aBwpDropZone", !!b); }
        // 좌측(prc001) 드래그: 커서가 올라간 "드롭 가능 행"에만 드롭존 테두리(§4.3a). 한 행만 유지.
        var oCurDropRow = null;
        function _setDropRow(oRowEl) {
            if (oCurDropRow === oRowEl) { return; }
            if (oCurDropRow) { oCurDropRow.classList.remove("u4aBwpDropRow"); }
            oCurDropRow = oRowEl;
            if (oCurDropRow) { oCurDropRow.classList.add("u4aBwpDropRow"); }
        }

        oHost.addEventListener("dragenter", function (ev) {
            if (_hasPrc002(ev.dataTransfer)) { ev.preventDefault(); _dropZone(true); }   // enter 에서 안 막으면 일부 브라우저 drop 거부.
        });
        oHost.addEventListener("dragover", function (ev) {
            var dt = ev.dataTransfer;
            // ① WS20 디자인 트리 드래그(외부 창) — 트리 전체가 드롭 타겟 + 드롭존 표시.
            if (_hasPrc002(dt)) { ev.preventDefault(); try { dt.dropEffect = "copy"; } catch (e) { } _dropZone(true); return; }
            // ② 좌측 모델필드 드래그(로컬) — drop 가능행 위에서만 허용 + 그 행에 드롭존 테두리.
            if (!oAPP.attr.dragModelNode) { _setDropRow(null); return; }
            var oRowEl = (ev.target && ev.target.closest) ? ev.target.closest(".u4a-tree__row") : null;
            var oNode = oRowEl ? oRowEl.__bwpNode : undefined;
            if (oNode && oNode._drop_enable === true) {
                ev.preventDefault(); ev.dataTransfer.dropEffect = "copy";
                _setDropRow(oRowEl);
            } else {
                _setDropRow(null);
            }
        });
        oHost.addEventListener("dragleave", function (ev) {
            // 호스트를 완전히 벗어날 때만 해제(자식 요소로 이동 시 relatedTarget 이 호스트 내부면 유지 — 깜빡임 방지).
            if (!ev.relatedTarget || !oHost.contains(ev.relatedTarget)) { _dropZone(false); _setDropRow(null); }
        });
        oHost.addEventListener("drop", async function (ev) {
            ev.preventDefault();   // ★ preventDefault 는 await 前 동기 호출.
            _dropZone(false); _setDropRow(null);
            try { await _onDesignDrop(ev); }
            catch (e) { console.error("[HTML5][bindWindow] 디자인트리 drop:", e && e.message); }
        });
    }

    // 현재 렌더된 행에 drop 가능/불가 표시 토글(원본 setDropStyle/resetDropStyle 의 HTML5 대응).
    function _applyDropStyle(bDragging) {
        if (!oD.host) { return; }
        var aRows = oD.host.querySelectorAll(".u4a-tree__row");
        for (var i = 0; i < aRows.length; i++) {
            var oRow = aRows[i], n = oRow.__bwpNode;
            if (!bDragging || !n) { oRow.classList.remove("u4aBwpDropOk", "u4aBwpDropNo", "u4aBwpDropRow"); continue; }   // DropRow=hover 행 테두리(드래그 종료 시 정리).
            oRow.classList.toggle("u4aBwpDropOk", n._drop_enable === true);
            oRow.classList.toggle("u4aBwpDropNo", n.DATYP === "02" && n._drop_enable !== true);
        }
    }

    // [PUBLIC] 좌측 드래그 시작 시 drop 가능행 표시(원본 setDropFlag+setDropStyle) — 드래그 소스가 호출.
    oAPP.fn.designSetDropFlag = function (sField) {
        oAPP.fn._bwpResetDropFlag(oAPP.attr.designTree);
        oAPP.fn._bwpSetDropFlag(oAPP.attr.designTree, sField);
        _applyDropStyle(true);
    };
    // [PUBLIC] 드래그 종료 시 표시 초기화(원본 resetDropFlag+resetDropStyle).
    oAPP.fn.designResetDropFlag = function () {
        oAPP.fn._bwpResetDropFlag(oAPP.attr.designTree);
        _applyDropStyle(false);
    };

    /************************************************************************
     * 디자인 트리 데이터 구성(원본 setDesignTreeData 1:1) — T_0014 → 트리 → 렌더.
     ************************************************************************/
    oAPP.fn.setDesignTreeData = function () {
        var a0014 = oAPP.attr.T_0014 || [];
        var aTree = [];
        oAPP.attr.designFlat = [];
        oAPP.attr.designTree = [];
        oAPP.attr.prev = {};   // 미리보기/바인딩 캐시 초기화(원본 setDesignTreeData 진입부).

        if (a0014.length !== 0) {
            for (var i = 0; i < a0014.length; i++) {
                _build0014(a0014[i], aTree);
                _buildProp(a0014[i], aTree);
                _buildAggr(a0014[i], aTree);
                _bindAttr(a0014[i], aTree);
                // prev[OBJID] 캐시 구성(원본 _setPrevData) — 부모→자식 순서라 부모 prev 가 먼저 존재.
                if (typeof oAPP.fn._bwpSetPrevData === "function") { oAPP.fn._bwpSetPrevData(a0014[i]); }
            }
            oAPP.attr.designFlat = aTree;
            oAPP.attr.designTree = oAPP.fn.setTreeData(aTree, "CHILD", "PARENT", "zTREE_DESIGN");
        }

        if (oD.ctrl) {
            // ★ 트리 재구성(드롭/방송 수신) 후 전체 펼침 — 원본 setDesignTreeData 후 expandToLevel(99999)
            //   (designTree.js:1171/2025 등). 예전엔 rerender(true) 로 첫 루트만 선택하고 펼침을 안 해
            //   중앙 트리가 1레벨만 펼쳐졌다 — 장군님 지적 2026-07-23.
            oD.ctrl.rerender(false);   // 첫 루트 자동선택 방지
            if (oD.ctrl.tree && oD.ctrl.tree.expandAll) { oD.ctrl.tree.expandAll(); }
            // 디자인 트리는 브로드캐스트 전엔 빈 트리 → 경계선 끔(데이터 도착 시 해제).
            oAPP.fn.setTreeEmptyMark(oD.host, !(oAPP.attr.designTree || []).length);
            oAPP.fn.fitTreeColumns(oD.host);   // 데이터 반영 후 컬럼 자동맞춤(원본)
        }
    };

    /* ── 영역 UI ──────────────────────────────────────────────────────────── */

    // 원본 상태 아이콘(sap-icon) → FA(디자인 트리 아이콘 매핑).
    function _nodeIcon(n) {
        if (n.DATYP === CS_DATYP.UOBJ) { return H.fa("cube"); }              // UI 노드
        if (n._icon_src === "sap-icon://customize") { return H.fa("sliders"); }  // 프로퍼티
        if (n._icon_src === "sap-icon://dimension") { return H.fa("cubes"); }    // 애그리게이션
        return "";   // Properties/Aggregations 그룹(아이콘 없음)
    }

    // 행 액션 컬럼(원본 rowActionTemplate — accept=추가속성적용 / disconnected=해제).
    //   WS20 디자인 트리의 +/휴지통과 동일한 2슬롯 구조(빈슬롯으로 세로 정렬 유지). 편집 상태 + 가시 플래그일 때만 버튼.
    function _rowActions(n) {
        var oAct = H.el("span", "u4aBwpRowActions");
        var bEdit = !!oAPP.attr.editable;
        // 슬롯1: 추가속성 정보 적용(accept, 132)
        if (bEdit && n._bind_visible) {
            oAct.appendChild(H.iconBtn("circle-check", H.z("132"), function (e) { e.stopPropagation(); oAPP.fn.onAdditionalBind(n, e && e.currentTarget); }, "u4aBwpRowActBtn u4aBwpRowActBtn--bind"));
        } else { oAct.appendChild(H.el("span", "u4aBwpRowActSlot")); }
        // 슬롯2: 바인딩 해제(disconnected, 186)
        if (bEdit && n._unbind_visible) {
            oAct.appendChild(H.iconBtn("link-slash", H.z("186"), function (e) { e.stopPropagation(); oAPP.fn.onUnbind(n); }, "u4aBwpRowActBtn u4aBwpRowActBtn--unbind"));
        } else { oAct.appendChild(H.el("span", "u4aBwpRowActSlot")); }
        return oAct;
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
        // 169/170 = 전체 펼침/접기(원본 expandCollapseAll → expandToLevel(99999)/collapseAll). 선택 노드만 하던 것 수정.
        oD.tool.appendChild(H.iconBtn("angles-down", H.z("169"), function () { if (oD.ctrl && oD.ctrl.tree && oD.ctrl.tree.expandAll) { oD.ctrl.tree.expandAll(); } }));  // 169 Expand All
        oD.tool.appendChild(H.iconBtn("angles-up", H.z("170"), function () { if (oD.ctrl && oD.ctrl.tree && oD.ctrl.tree.collapseAll) { oD.ctrl.tree.collapseAll(); } }));   // 170 Collapse All
        oD.tool.appendChild(H.el("span", "u4aBwpToolSep"));
        oD.tool.appendChild(H.iconBtn("ban", H.z("187"), function () { _clearChecks(); }));   // 187 Clear selection
        oD.tool.appendChild(H.el("span", "u4aBwpToolSep"));
        // 129 동일속성 바인딩 일괄적용(Accept, 녹색) / 130 멀티 바인딩(Emphasized, 파랑) / 186 Unbind(Reject, 빨강).
        oD.tool.appendChild(_btn("check-double", H.z("129"), H.z("129"), "u4aBwpBtn--sync", bRO, function (e) { _call("onSynchronizionBind", e && e.currentTarget); }));
        oD.tool.appendChild(_btn("link", H.z("130"), H.z("130"), "u4a-btn--emphasized", bRO, function (e) { _call("onMultiBind", e && e.currentTarget); }));
        oD.tool.appendChild(_btn("link-slash", H.z("186"), H.z("186"), "u4a-btn--negative", bRO, function (e) { _call("onMultiUnbind", e && e.currentTarget); }));
        oD.tool.appendChild(H.el("span", "u4aBwpToolSpacer"));
        // 161 컬럼최적화 — 리사이즈바 더블클릭과 ★완전 동일★한 순수 autofit(잔여폭 흡수 없음).
        //   원본 setUiTableAutoResizeColumn 1:1. 채움(fitTreeColumns)은 레이아웃 변경 전용.
        oD.tool.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () {
            oAPP.fn.autofitTreeColumns(oD.host);
        }));
        // 957 화면 커스터마이징 — 원본 designTree.js:4025 createBindLayoutCustomizingButton(좌·중·우 공통).
        oD.tool.appendChild(H.iconBtn("gear", H.z("957"), function () {
            if (oAPP.attr.editable === false) { return; }
            if (typeof oAPP.fn.openLayoutCustomizingPopup === "function") { oAPP.fn.openLayoutCustomizingPopup(); }
        }));
        oD.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {   // 198 Help
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp(); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));

        // 패널 좁아질 때 넘치는 버튼(동일속성/멀티/Unbind 등)을 ⋯ 오버플로 메뉴로(16 §11, 공통 attachOverflow).
        oAPP.fn.attachToolOverflow(oD.tool);

        // ── 공통 다열 그리드 트리(원본 순서: Object Name / 바인딩 경로 / MPROP / 행 액션) ──
        //   ★ MPROP = 개발 전용 디버그(추가속성 원시 직렬화값) — 원본 visible:!isPackaged 라 배포빌드에선 숨김. 원본대로 gate.
        //   ★ 행 액션(추가속성적용/해제) = 원본 rowActionCount:2 = 우측 고정 거터. WS20 트리 +/휴지통과 동일 패턴.
        //     스플리터 좁힐 때 데이터 컬럼은 가로 스크롤, 액션 컬럼은 우측 고정(sticky) — 원본 sap.ui.table.RowAction 거동.
        var bDevCol = !(oAPP.REMOTE && oAPP.REMOTE.app && oAPP.REMOTE.app.isPackaged);   // 개발(비패키징)에서만 MPROP 표시.
        var aCols = [
            { label: H.z("174"), width: "18rem" },   // 174 Object Name
            { label: H.z("165"), width: "14rem" }     // 165 바인딩 경로(잔여 흡수)
        ];
        if (bDevCol) { aCols.push({ label: "MPROP", width: "10rem" }); }   // 개발 전용(원본 1:1).
        aCols.push({ label: "", width: "4.5rem" });   // 행 액션(우측 고정).
        var iActCol = aCols.length;   // 액션 = 마지막 컬럼(sticky 대상).
        oD.host.setAttribute("data-col-count", String(aCols.length));
        oD.host.setAttribute("data-bwp-fill", "2");   // 바인딩 경로(c2)가 잔여폭 흡수.
        oD.host.setAttribute("data-act-col", String(iActCol));   // 액션 컬럼 인덱스 → sticky CSS 대상.
        oD.ctrl = U4AUI.makeColumnTree(oD.host, {
            columns: aCols,
            // autofit(더블클릭·161버튼 공용) = 원본 setUiTableAutoResizeColumn 정책(여유 0.5rem/최소 4rem/상한 없음).
            autofit: { slackRem: 0.5, minRem: 4, max: Infinity },
            lastColResize: false,   // 액션 컬럼(마지막)은 고정 거터 — 우측 리사이즈 그립(||) 제거.
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
                oChk.addEventListener("change", function () {
                    n.chk_seleced = oChk.checked;
                    // 체크 선택 변경 → 우측 참조필드(P05) 재구성(원본 setRefFieldList, P3-C).
                    if (typeof oAPP.fn.setRefFieldList === "function") { try { oAPP.fn.setRefFieldList(); } catch (e2) { } }
                });
                return oChk;
            },
            // C2 = 바인딩 경로(UIATV) / (개발) C3 = MPROP / 마지막 = 행 액션 컬럼.
            cell: function (n) {
                var oPath = H.el("span", "u4aBwpDesignPath", n.UIATV || "");
                if (n.UIATV) {
                    oPath.setAttribute("data-tip", n.UIATV); oPath.setAttribute("data-tip-trunc", "");
                    // SPEC §3.2 2열=바인딩경로 Link, press onShowBindAdditInfo(원본 designTree.js:4123) →
                    //   클릭 시 우측 추가속성 패널을 이 필드로 재구성(§3.5 _showBindAdditInfo).
                    oPath.classList.add("u4aBwpDesignPathLink");
                    oPath.setAttribute("role", "button"); oPath.tabIndex = 0;
                    oPath.addEventListener("click", function (e) {
                        e.stopPropagation();
                        if (typeof oAPP.fn.onShowBindAdditInfo === "function") { oAPP.fn.onShowBindAdditInfo(n); }
                    });
                }
                var out = { c2: oPath };
                if (bDevCol) {
                    var oMp = H.el("span", "u4aBwpDescTxt", n.MPROP || "");
                    if (n.MPROP) { oMp.setAttribute("data-tip", n.MPROP); oMp.setAttribute("data-tip-trunc", ""); }
                    out.c3 = oMp;
                }
                out["c" + iActCol] = _rowActions(n);   // 액션 = 마지막 컬럼.
                return out;
            },
            rowHook: function (oRow, n) {
                var sHl = H.rowHl(n._highlight);
                if (sHl) { oRow.classList.add(sHl); }
                oRow.__bwpNode = n;   // 드롭 대상 조회용(좌측 필드 → 이 행).
                // 드래그 진행 중이면 현재 drop 가능여부 표시 유지(재렌더 대비).
                if (oAPP.attr.dragModelNode) {
                    oRow.classList.toggle("u4aBwpDropOk", n._drop_enable === true);
                    oRow.classList.toggle("u4aBwpDropNo", n.DATYP === "02" && n._drop_enable !== true);
                }
            },
            onSelect: function (n) {
                oAPP.attr.selDesignNode = n;
                // [SPEC §2.1] 디자인 트리 속성 선택 → 좌측 모델필드 바인딩 가능/불가 재계산(이미 바인딩=파랑).
                if (typeof oAPP.fn.bindPossibleRecompute === "function") {
                    try { oAPP.fn.bindPossibleRecompute(n); } catch (e) { console.error("[HTML5][bindWindow] bindPossibleRecompute:", e && e.message); }
                }
            }
        });

        // 좌측 필드 → 디자인트리 드롭(원본 onDropBindField/_setBindAttribute) 배선.
        _wireDesignDrop(oD.host);

        // [빈상태 안내 보정] 공통 makeColumnTree 는 빈 안내(.u4aColTreeEmpty)를 내부 body(컬럼폭 합 기준)에
        //   넣는다. 좁은 패널에선 안내가 컬럼폭(≈46rem) 가운데라 가시영역 밖(오른쪽)으로 밀리고 가로 스크롤이
        //   생긴다(실측 2026-07-16: 769px 기준 가운데 386 vs 가시 298). → 스크롤 컨테이너(host) 직속으로
        //   끌어올려 가시영역 가운데 표시 + 빈상태 가로 스크롤 억제(공통 미수정, bindPopup 스코프).
        (function () {
            var oHost = oD.host;
            var iRaf = 0;
            function _fixEmpty() {
                var emp = oHost.querySelector(".u4aColTreeEmpty");
                if (!emp) { oHost.classList.remove("u4aBwpTreeEmptyState"); return; }
                oHost.classList.add("u4aBwpTreeEmptyState");
                // ★ emp 는 공통이 만든 자리(내부 body) 그대로 둔다(옮기면 트리 아래로 쌓여 바닥에 붙고,
                //   공통 _showEmpty(false) 가 제거도 못 한다 — 장군님 지적). 폭만 host 가시폭으로 고정하면
                //   sticky left:0 와 함께 가로는 가시영역 가운데, 세로는 기존대로 body 가운데가 된다.
                var w = oHost.clientWidth;
                if (w && emp.style.width !== w + "px") { emp.style.width = w + "px"; }
            }
            function _schedule() {   // RO 콜백서 동기 쓰기 금지 → rAF 지연(공통 §3.4.2 규칙).
                if (iRaf) { return; }
                iRaf = requestAnimationFrame(function () { iRaf = 0; _fixEmpty(); });
            }
            try { new MutationObserver(_fixEmpty).observe(oHost, { childList: true, subtree: true }); } catch (e) { }
            try { new ResizeObserver(_schedule).observe(oHost); } catch (e) { }
            _fixEmpty();
        })();

        // 컬럼 자동맞춤(원본 setUiTableAutoResizeColumn = 콘텐츠+마지막 컬럼 채움). 레이아웃 확정 후 1회.
        setTimeout(function () { oAPP.fn.fitTreeColumns(oD.host); }, 0);

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
