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
            // 버튼 활성 플래그 — 필수 호출 직접(삼킴 제거).
            oAPP.fn.setDesignTreeEnableButton(t);
        }
    }

    /* ── 좌측 필드 → 디자인트리 드롭(원본 onDropBindField/_setBindAttribute) ──────── */

    // 드래그 데이터 정합성 — 원본 _checkDragData(designTree.js:838-883) 1:1(4종 안내 메시지 이식, G-4).
    //   실패 시 RTMSG 를 호출부(_onDesignDrop:779)가 토스트로 노출한다(예전엔 RTMSG 비어 무음이었음).
    function _checkDragData(sPrc001) {
        var r = { RETCD: "", RTMSG: "", IF_DATA: null };
        if (!sPrc001) { r.RETCD = "E"; r.RTMSG = oAPP.common.zmsg("099"); return r; }                       // 099 Drag 정보 없음
        var o;
        try { o = JSON.parse(sPrc001); } catch (e) { r.RETCD = "E"; r.RTMSG = oAPP.common.zmsg("100"); return r; }  // 100 잘못된 Drag 정보
        if (!o || o.PRCCD !== "PRC001") { r.RETCD = "E"; r.RTMSG = oAPP.common.zmsg("101"); return r; }     // 101 작업 수행 불가
        if (o.DnDRandKey !== oAPP.attr.DnDRandKey) { r.RETCD = "E"; r.RTMSG = oAPP.common.zmsg("102"); return r; }  // 102 다른 영역 Drag
        if (o.RETCD === "E") { r.RETCD = "E"; r.RTMSG = o.RTMSG || ""; return r; }                          // 추가속성 검증 오류(payload 동봉)
        r.IF_DATA = o.IF_DATA;
        return r;
    }

    // 필터(_filterDesignRoots) 상태에선 렌더 노드가 Object.assign 복사본이라 원본 designTree 의 라이브 상태
    //   (_drop_enable · 바인딩 결과)와 분리된다 → CHILD 로 원본 노드를 되찾아 드롭 판정·쓰기·하이라이트에 쓴다.
    function _designNodeByChild(sChild) {
        if (!sChild) { return undefined; }
        var oFound;
        (function rec(a) {
            if (!a || oFound) { return; }
            for (var i = 0; i < a.length; i++) {
                if (a[i].CHILD === sChild) { oFound = a[i]; return; }
                rec(a[i].zTREE_DESIGN);
                if (oFound) { return; }
            }
        })(oAPP.attr.designTree || []);
        return oFound;
    }
    // 렌더 노드(필터 시 복사본) → 원본 노드. 못 찾으면(비필터=이미 원본) 그대로.
    function _srcNode(n) { return n ? (_designNodeByChild(n.CHILD) || n) : n; }

    // 드롭 위치 tree 노드(원본 _getContextData) — 이벤트 target 의 행에서 __bwpNode → 원본 노드.
    function _dropNodeOf(ev) {
        var oRow = (ev.target && ev.target.closest) ? ev.target.closest(".u4a-tree__row") : null;
        return oRow ? _srcNode(oRow.__bwpNode) : undefined;
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
        // ★ [원본 onUnbind designTree.js:1457] 해제 버튼 즉시 busy ON(DESC=222 "바인딩 해제 진행 중").
        //   setBusyWS20Interaction(_, sOption) 이 broadcast-to-child-window 로 BUSY_ON(TYPE:DIALOG) 을 쏴
        //   WS20 이 자기 busy 다이얼로그를 띄운다(ws_fn_broad.js:26 → parent.setBusy). → 확인창 동안 WS20 잠금.
        oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("222") });
        // 185 Do you want to continue unbind?
        U4AUI.confirm({
            type: "C",
            message: H.z("185"),
            buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
            onClose: function (sAct) {
                // 원본 1506: onClose 시 팝업 busy 재-ON(WS20 는 계속 잠김). ISBROAD=팝업만(WS20 재방송 없음).
                oAPP.fn.setBusy(true, { ISBROAD: true });
                if (sAct !== "YES") {
                    // 원본 1535: 취소 → WS20 BUSY_OFF(방송) + 팝업 OFF.
                    oAPP.fn.setBusyWS20Interaction(false, {});
                    return;
                }
                // 성공 경로는 자기해제 금지(§3.11, 원본 1595) — attrSetUnbindProp→attrChange→designBroadcastUpdate
                //   (WS20 왕복, UIATY 1·3 항상 발생 확인) 후 _updateDesignData 가 팝업 setBusy(false)+_sendDesignAreaBusyOff
                //   (oChannel BUSY_OFF)로 팝업·WS20 을 함께 해제한다.
                oAPP.fn.resetErrorField();   // [표준] 필수 호출 직접(삼킴 제거).

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

                // 후속: 참조필드/추가속성/좌측 재판정 — 필수 호출 직접(삼킴 제거).
                //   ★ oAPP.attr.oAddit 는 라이브에서 미할당(UI5 잔재)이라 죽은 네임스페이스였음 → oAPP.fn 으로 복구.
                oAPP.fn.setRefFieldList();
                oAPP.fn.clearSelectAdditBind();
                oAPP.fn.setAdditLayout("");
                oAPP.fn.bindPossibleRecompute(n);

                // 153 바인딩 해제 처리를 완료 했습니다.
                oAPP.fn.toast(H.z("153"));
            }
        });
        // 원본 1522: 확인창 표시 직후 "팝업 busy 만" OFF(WS20 잠금은 유지) → 확인창 상호작용 가능.
        //   ★ISBROAD=true 로 WS20 에 BUSY_OFF 를 방송하지 않는다 — HTML5 setBusyWS20Interaction(false) 은
        //   인자 없어도 방송해 WS20 이 풀려버리므로(원본은 sOption 있을 때만 방송), 팝업만 끄려면 이 경로를 쓴다.
        oAPP.fn.setBusy(false, { ISBROAD: true });
    };

    /************************************************************************
     * [SPEC §3.5 · 원본 designTree.js:225 _showBindAdditInfo] 바인딩경로 링크 클릭 →
     *   ★ 중앙 하단(DESIGN_ADDIT) 패널을 그 필드 정보로 재구성해 표시(vis_addit).
     *     우측(MAIN_ADDIT 스테이징)은 절대 건드리지 않는다 — setAdditBindInfo 는 SEL 스토어 전용.
     *   게이트 통과 못하면 중앙 하단 숨김(setAdditLayout("")).
     ************************************************************************/
    oAPP.fn.onShowBindAdditInfo = function (n) {
        _showBindAdditInfo(n);
        // [UX 개선 · 원본에 없음, 장군님 승인 2026-07-30] 바인딩 경로 링크 클릭 시 좌측 모델 트리에서
        //   그 경로(UIATV) 필드를 자동 선택 → 우측 참조필드(P05) 목록이 자동으로 채워짐(선택 왕복 제거).
        //   ★링크 클릭 경로에서만 호출 — _showBindAdditInfo 자체(적용/새로고침 재구성)엔 안 걸어 부작용 차단.
        if (n && n.UIATV && typeof oAPP.fn.selectModelFieldByPath === "function") {
            try { oAPP.fn.selectModelFieldByPath(n.UIATV); } catch (e) { }
        }
    };

    function _showBindAdditInfo(sTree) {
        oAPP.fn.clearSelectAdditBind();   // [표준] 필수 호출 직접(삼킴 제거) — 없으면 감시견(ws_trycatch)이 표면화.
        function _hide() { oAPP.fn.setAdditLayout(""); }

        if (!sTree || sTree.UIATV === "") { _hide(); return; }          // 바인딩 없음.
        if (sTree.UIATY !== "1") { _hide(); return; }                   // 프로퍼티만.

        var _sBind = oAPP.fn.getModelBindData(sTree.UIATV, oAPP.attr.modelTree);
        if (typeof _sBind === "undefined") { oAPP.fn.toast(H.z("150", sTree.UIATV)); _hide(); return; }   // 150 필드 없음.
        if (_sBind.KIND !== "E") { _hide(); return; }                   // 일반 필드만.

        var _sParent = oAPP.fn.getModelBindData(_sBind.PARENT, oAPP.attr.modelTree);
        if (typeof _sParent === "undefined") { oAPP.fn.toast(H.z("150", _sBind.PARENT)); _hide(); return; }

        oAPP.attr.S_SEL_ATTR = JSON.parse(JSON.stringify(sTree));       // 선택 attribute 전역화(원본).
        oAPP.fn.setAdditBindInfo(_sBind, sTree.MPROP, _sParent.zTREE);   // 중앙 하단(SEL) = 선택 필드로 재구성.
        oAPP.fn.setAdditLayout(_sBind.KIND);
    }

    /************************************************************************
     * [R-3] 선택행(S_SEL_ATTR) 있으면 그 라인을 재조회해 중앙하단(SEL) 패널 재구성.
     *   원본 _refreshAdditBindInfo(designTree.js:199) 1:1. 선택행 없으면 무동작.
     *   호출: 멀티 추가속성 적용(원본 2980) + 드롭 바인딩(원본 1332).
     ************************************************************************/
    function _refreshAdditBindInfo() {
        var _sAttr = oAPP.attr.S_SEL_ATTR;
        if (!_sAttr) { return; }
        if (typeof oAPP.fn.getDesignTreeAttrData !== "function") { return; }
        var _sTree = oAPP.fn.getDesignTreeAttrData(_sAttr.OBJID, _sAttr.UIATK);
        if (typeof _sTree === "undefined") { return; }
        _showBindAdditInfo(_sTree);   // SEL 패널 재구성(원본 _showBindAdditInfo).
    }

    /************************************************************************
     * [139 추가속성적용] 중앙 하단(DESIGN_ADDIT) — 원본 onAdditBind(index.js:8602)→setMPROP(designTree.js:2780) 1:1.
     *   중앙 하단에서 고친 값(additRowsSel)을 S_SEL_ATTR 선택행 + prev._T_0015 에 stamp 후 트리 갱신.
     *   ★ WS20 busy 왕복·UPDATE-DESIGN-DATA 방송 = P6. 여기선 로컬 적용 + toast(090)까지.
     ************************************************************************/
    oAPP.fn.applyDesignAdditBind = async function (oAnchor) {
        // ★[원본 onAdditBind:8610] 클릭 즉시 WS20 busy(219 "추가 속성 바인딩 처리 진행중"). 성공은 왕복이 해제(자기해제 금지),
        //   각 중단 분기는 setBusyWS20Interaction(false,{})로 해제(원본 8637/8661). off 짝 누락 = WS20 영구잠금.
        oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("219") });
        oAPP.fn.clearAdditErrorMark();   // [원본 onAdditBind:8644] 추가속성 오류 표시 초기화(검증 전).
        // ① 중앙 하단 입력 완결성(원본 chkAdditBindData(oAdditTab=DESIGN_ADDIT)).
        var _r1 = (typeof oAPP.fn.chkAdditBindData === "function") ? oAPP.fn.chkAdditBindData("SEL") : { RETCD: "" };
        if (_r1.RETCD === "E") { await _showErr(oAnchor, _r1); oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // [SPEC §6] 목록 팝오버 + busy off(원본 8661).
        // [원본 onAdditBind:8668] 검증 통과 → 디자인 트리 오류 각인 초기화(하단으로 정상 적용 시 이전 빨강 해제).
        oAPP.fn.resetErrorField();

        // ② 선택 attribute(S_SEL_ATTR) 존재.
        var _sAttr = oAPP.attr.S_SEL_ATTR;
        if (!_sAttr || !_sAttr.OBJID) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }

        // ③ 트리 라인 + UI 정보(_T_0015) 확인(원본 setMPROP).
        var _sTree = (typeof oAPP.fn.getDesignTreeAttrData === "function") ? oAPP.fn.getDesignTreeAttrData(_sAttr.OBJID, _sAttr.UIATK) : undefined;
        if (typeof _sTree === "undefined") { oAPP.fn.setBusyWS20Interaction(false, {}); oAPP.fn.toast(H.z("110", _sAttr.UIATT || _sAttr.OBJID)); return; }   // 110 정보 없음.
        var _oUi = oAPP.attr.prev && oAPP.attr.prev[_sTree.OBJID];
        if (!_oUi || !_oUi._T_0015) { oAPP.fn.setBusyWS20Interaction(false, {}); oAPP.fn.toast(H.z("110", _sTree.OBJID)); return; }

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
        oNode._check_vs = "Error";   // 오류=_bind_error → rowHook 이 u4aBwpRow--error(배경+좌측바). _highlight 는 Success 전용(reset 대상 아님).

        _refreshDesignTree();

        // 해당 행으로 스크롤(원본 setFirstVisibleRow 대응) — 가상 scrollToKey 경유 selectKey(key,true).
        //   (비가상 querySelectorAll+scrollIntoView 제거 — 가상은 화면 밖 행 DOM 없음.)
        if (oD.ctrl && typeof oD.ctrl.selectKey === "function") { oD.ctrl.selectKey(LINE_KEY, true); }
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
        // 224 "멀티 바인딩 처리를 진행하고 있습니다" — 확인창 동안 WS20 busy 다이얼로그(원본 onMultiBind:2291·2294).
        var _ok = await _confirmAdditApply(_msg, H.z("224"));
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

        oAPP.fn.clearSelectAdditBind();   // [표준] 필수 호출 직접(삼킴 제거).
        oAPP.fn.setAdditLayout("");
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
        // 166 &1건 선택 + 167 해제 진행 확인. 223 "멀티 바인딩 해제 진행" — 확인창 동안 WS20 busy(원본 onMultiUnbind:2089·2092).
        var _ok = await _confirmAdditApply(H.z("166", String(_aTree.length)) + "\n" + H.z("167"), H.z("223"));
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

        // [G-1] 원본 onMultiUnbind 말미(designTree.js:2232) — 우측 참조필드(P05) DDLB 재구성. 필수 호출 직접.
        oAPP.fn.setRefFieldList();
        oAPP.fn.clearSelectAdditBind();
        oAPP.fn.setAdditLayout("");
        _refreshDesignTree();
        // ★ 원본 onMultiUnbind:2244 bindPossible(_sTree) — 좌측 모델필드 바인딩 가능여부 재판정(마지막 해제행 기준).
        //   onUnbind(위 285)에는 있으나 멀티 해제엔 누락됐던 것 복원(2026-08-04 감사). _sTree=루프 마지막 값(var 스코프).
        oAPP.fn.bindPossibleRecompute(_sTree);
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

        // 검증 통과 — 동일속성 화면 진입(§5.2). 진입 busy on(원본 designTree.js:2489·2492).
        //   ★DESC = 225 "바인딩 팝업에서 동일속성 바인딩 처리를 진행하고 있습니다."(원본 그대로). 129=버튼 라벨이라 오이식이었음.
        //   busy off 는 화면 렌더 후 openSyncBindScreen(원본 onViewReady:430)이 담당(진입 왕복).
        oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("225") });
        if (typeof oAPP.fn.openSyncBindScreen === "function") {
            oAPP.fn.openSyncBindScreen(_sTree, _aList);
        } else {
            oAPP.fn.setBusyWS20Interaction(false);   // 미배선 방어 — busy 잔류 금지.
            console.warn("[HTML5][bindWindow] onSynchronizionBind: 동일속성 화면(openSyncBindScreen) 미배선.");
        }
    };

    /************************************************************************
     * [S4 §5.4/§6] 동일속성 일괄적용 — 원본 synchronizionBind.js onSetSyncAttr(494)+_setSyncAttr(224).
     *   141 버튼(syncBindScreen)이 호출. all-or-nothing / ★MPROP 전파는 이 경로만 / 복원4종 /
     *   busy 는 WS20 왕복 후 해제(자기해제 금지 — onMultiBind 동일). 쓰기=공유 attrSetBindProp(§12).
     ************************************************************************/
    oAPP.fn.onSetSyncAttr = async function () {
        var _oSync = oAPP.attr.oSync || {};
        var _aSel = (typeof oAPP.fn.getSyncSelectedRows === "function") ? oAPP.fn.getSyncSelectedRows() : [];

        // 183 선택 라인 없음(원본 541) — busy 켜기 전이라 off 불필요.
        if (_aSel.length === 0) { oAPP.fn.toast(H.z("183")); return; }

        // ★원본 onSetSyncAttr(synchronizionBind.js:494~)는 이 경로에서 WS20 에 busy 를 절대 방송하지 않는다
        //   (setBusyWS20Interaction 을 전부 sOption 없이 호출 = 방송 안 함, 497/512/529/549/584/601). 진입 때 켠
        //   WS20 busy(225)를 그대로 유지하고, 확인창·아니오·성공 내내 WS20 는 안 건드린다(성공은 WS20 왕복이 225 해제, 331~334).
        //   ▶ _confirmAdditApply 에 sBusyDesc(129)를 주면 안 됨 — 주면 WS20 에 129 재방송(문구 225→129 로 바뀜) + 아니오 시
        //     WS20 BUSY_OFF(225 조기해제)가 되어 원본과 어긋난다(장군님 08-09 발견). 그래서 sBusyDesc 없이 호출.
        //   166 &1건 선택 + 159 일괄적용 확인.
        var _ok = await _confirmAdditApply(H.z("166", String(_aSel.length)) + "\n" + H.z("159"));
        if (!_ok) { return; }   // 취소 — WS20(225) 유지(안 건드림). 로컬 busy 도 안 켰으니 정리 불필요.

        // 성공 처리 동안 "별창 로컬 busy 만"(원본 onClose:567 setBusy(true)+570 ROOT.setBusy(true), WS20 미방송=ISBROAD).
        //   자기해제 안 함 — _setSyncAttr 의 attrSetBindProp→WS20 왕복이 로컬·WS20(225) busy 를 함께 해제(원본 331~334).
        oAPP.fn.setBusy(true, { ISBROAD: true });
        await _setSyncAttr(_aSel, _oSync);
    };

    // 원본 _setSyncAttr(synchronizionBind.js:224) 1:1(별창 각색: setBusyDialog→setBusy, autoResize→fitTreeColumns).
    async function _setSyncAttr(aList, oSync) {
        var _UIATV = oSync.S_ATTR.UIATV;
        var _sField = oAPP.fn.getModelBindData(_UIATV, oAPP.attr.modelTree);

        // 150 &1 필드가 모델 항목에 존재하지 않습니다 — all-or-nothing 중단.
        //   ★원본 236 = setBusyWS20Interaction(false)[sOption 없음] = WS20 미방송(225 유지) + 로컬 off.
        //   setBusyWS20Interaction(false,{})는 sOption={} 라 WS20 에 BUSY_OFF 방송(225 조기해제) → 금지. 로컬만 끈다.
        if (typeof _sField === "undefined") {
            oAPP.fn.setBusy(false, { ISBROAD: true });
            oAPP.fn.toast(H.z("150", _UIATV));
            return;
        }

        _sField = JSON.parse(JSON.stringify(_sField));

        // ★MPROP 전파 — 동일속성 일괄적용만(§5.4). 일반 드롭/멀티는 미전파.
        if (typeof oSync.S_ATTR.MPROP !== "undefined" && oSync.S_ATTR.MPROP !== "") {
            _sField.MPROP = oSync.S_ATTR.MPROP;
        }

        for (var i = 0; i < aList.length; i++) {
            var _sLine = aList[i];
            var _sTree = oAPP.fn.getDesignTreeAttrData(_sLine.OBJID, _sLine.UIATK);
            if (typeof _sTree === "undefined") { continue; }

            switch (_sTree.UIATY) {
                case "1":
                    oAPP.fn.attrSetBindProp(_sTree, _sField);   // 프로퍼티 바인딩.
                    break;
                case "3":
                    if (_sTree.UIATV !== "" && _sTree.ISBND === "X") {
                        oAPP.fn.attrUnbindAggr(oAPP.attr.prev[_sTree.OBJID], _sTree.UIATT, _sTree.UIATV);
                        oAPP.fn.attrUnbindTree(_sTree);   // Tree/TreeTable PARENT·CHILD 예외.
                    }
                    oAPP.fn.attrSetBindProp(_sTree, _sField);   // aggregation 바인딩.
                    if (oAPP.attr.prev[_sTree.OBJID]) { oAPP.attr.prev[_sTree.OBJID]._MODEL[_sTree.UIATT] = _sTree.UIATV; }
                    break;
                default: break;
            }

            _sLine.UIATV = _sTree.UIATV;   // 후보 행 값 갱신(원본 298).
        }

        // 자기화면 갱신(원본 oDesign.oModel.refresh(true)+oModel.refresh() 대응) — 가운데 트리(UIATV 반영) + 후보테이블.
        //   WS20 반영은 attrSetBindProp→attrChange→designBroadcastUpdate(rAF 1회 방송)가 이미 담당.
        _refreshDesignTree();
        if (oSync.tbl && typeof oSync.tbl.setRows === "function") { oSync.tbl.setRows(oSync.aList || []); }

        oAPP.fn.toast(H.z("160"));   // 160 동일속성 바인딩 처리 완료.

        // 디자인 영역으로 복귀(원본 moveDesignPage) — 슬라이드.
        await oAPP.fn.moveDesignPage();

        // 복원 4종(§5.6 — 진입의 정확한 역).
        oAPP.fn.setAdditBindButtonEnable(true);
        oAPP.fn.setLayoutCustomizingEditable(true);
        oAPP.attr.bSyncEqualityScreenActive = false;
        oAPP.fn.setViewEditable(true);

        // 트리 컬럼 재조정(원본 setUiTableAutoResizeColumn:328).
        var _oHost = document.getElementById("bwpDesignTree");
        if (_oHost && typeof oAPP.fn.fitTreeColumns === "function") { oAPP.fn.fitTreeColumns(_oHost); }

        // ★busy 자기해제 안 함(원본 331~334) — WS20 가 UPDATE-DESIGN-DATA 반영 후 BUSY_OFF 방송으로 해제. onMultiBind 동일.

        // S5 훅 자리: 비모달 다이얼로그가 열려 있으면 close(원본 337~339). 현재 no-op.
        if (oSync.oDialog && typeof oSync.oDialog.close === "function") { oSync.oDialog.close(); }
    }

    // 디자인트리 체크선택 행 수집(원본 getSelectedDesignTree 1:1) — 멀티/참조필드(P3-C) 공용.
    oAPP.fn.getSelectedDesignTree = function () {
        var aSel = [];
        (function rec(a) {
            if (!a) { return; }
            for (var i = 0; i < a.length; i++) { if (a[i].chk_seleced === true) { aSel.push(a[i]); } rec(a[i].zTREE_DESIGN); }
        })(oAPP.attr.designTree || []);
        return aSel;
    };

    // 적용 확인창(원본 MessageBox.confirm) — 공통 U4AUI.confirm. Promise<bool>.
    //   ★ sBusyDesc 주면 원본 동작 재현(각 핸들러 setBusyWS20Interaction(true,{DESC})→confirm→취소 OFF, 성공은 왕복 위임):
    //     확인창 뜨는 즉시 WS20 busy 다이얼로그(진행 메시지) ON → 확인창 동안 유지(팝업만 끔) → 취소면 WS20+팝업 해제 /
    //     확인이면 유지(성공 후 방송 왕복이 해제). 근거·시퀀스 = 메모리 ws20-busy-dialog-during-popup-confirm.
    //     sBusyDesc 없으면 기존대로 busy 없음(하위호환).
    function _confirmAdditApply(sMsg, sBusyDesc) {
        if (sBusyDesc) { oAPP.fn.setBusyWS20Interaction(true, { DESC: sBusyDesc }); }   // 진입: WS20 다이얼로그 + 팝업 ON
        return new Promise(function (resolve) {
            U4AUI.confirm({
                type: "C", message: sMsg,
                buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
                onClose: function (sAct) {
                    if (sBusyDesc) {
                        oAPP.fn.setBusy(true, { ISBROAD: true });   // 팝업 재-ON(원본 onClose). ISBROAD=WS20 재방송 없음.
                        if (sAct !== "YES") { oAPP.fn.setBusyWS20Interaction(false, {}); }   // 취소 → WS20+팝업 OFF.
                    }
                    resolve(sAct === "YES");
                }
            });
            // 확인창 표시 직후 "팝업만" OFF(WS20 잠금 유지) — ISBROAD 로 WS20 에 BUSY_OFF 방송 안 함(원본 1522 대응).
            if (sBusyDesc) { oAPP.fn.setBusy(false, { ISBROAD: true }); }
        });
    }

    // 행 액션 - 추가속성 정보 적용(단건, 원본 onAdditionalBind: designTree.js:1633). ★로컬 적용까지(P3-D).
    //   busy 왕복·UPDATE-DESIGN-DATA 방송 = P6. 검증 오류표시는 간이 toast(정교 showMessagePopover = P6).
    oAPP.fn.onAdditionalBind = async function (n, oAnchor) {
        if (!n) { return; }
        // ★[원본 onAdditionalBind:1655] 진입 즉시 WS20 busy(219 "추가 속성 바인딩 처리 진행중"). 검증 실패마다 off,
        //   확인창은 팝업 로딩만 껐다 켬(WS20 유지), 취소는 전체 off, 성공은 WS20 왕복이 해제(자기해제 금지).
        oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("219") });
        // [G-4] 진입 시 오류표시 초기화(원본 onAdditionalBind:1679/1703 resetErrorField). 필수 호출 직접.
        //   ※ 추가속성칸 오류마크(clearAdditErrorMark)는 여기서 안 지운다 — 팝오버 바깥클릭 자동닫힘 시
        //     _clearError(showMessagePopover.js)가 이미 지운다(장군님 결정 08-05: 자동닫힘 UX 유지).
        oAPP.fn.resetErrorField();
        // ① 우측 입력 완결성.
        var _r1 = (typeof oAPP.fn.chkAdditBindData === "function") ? oAPP.fn.chkAdditBindData() : { RETCD: "" };
        if (_r1.RETCD === "E") { await _showErr(oAnchor, _r1); oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // [SPEC §6] 목록 팝오버 + off(원본 1696).
        // ② 라인 가능여부 — 실패 시 그 행을 오류(빨강)로 각인(원본 1713-1718 _check_vs/_style + refresh).
        var _r2 = (typeof oAPP.fn.chkPossibleAdditBind === "function") ? oAPP.fn.chkPossibleAdditBind(n) : { RETCD: "" };
        if (_r2.RETCD === "E") {
            n._bind_error = true; n._check_vs = "Error";   // [G-4] 원본 1713-1718(_check_vs + _style). 오류=_bind_error → rowHook 배경 + reset 해제.
            n._error_tooltip = _r2.RTMSG;   // [원본 1718] 오류 라인 hover 툴팁 각인 → rowHook 이 data-tip 으로 렌더(누락 복원 2026-08-04).
            _refreshDesignTree();
            oAPP.fn.toast(_r2.RTMSG); oAPP.fn.setBusyWS20Interaction(false, {}); return;   // 원본 1729
        }
        // ③ UI 정보(_T_0015) 확인.
        var _oUi = oAPP.attr.prev && oAPP.attr.prev[n.OBJID];
        if (!_oUi || !_oUi._T_0015) { oAPP.fn.toast(H.z("106", n.OBJID)); oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // 106 UI 정보 없음(원본 1750).
        // ④ 기존 MPROP 있으면 재적용 확인(089) — 원본 1758~1802: 진입 busy 켜진 채, 확인창 뜰 때 "팝업만" off / onClose 팝업 재on / 취소 전체 off.
        if (n.MPROP !== "") {
            oAPP.fn.setBusy(false, { ISBROAD: true });                 // 원본 1790: 확인창 위해 팝업만 off(WS20 유지).
            var _ok = await _confirmAdditApply(H.z("089"));            // 순수 확인창(sBusyDesc 없음 — busy 는 여기서 관리).
            if (!_ok) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // 원본 1802: 취소 → WS20+팝업 off.
            oAPP.fn.setBusy(true, { ISBROAD: true });                  // 원본 1773: onClose 팝업만 재on(WS20 유지, 성공 왕복이 최종 해제).
        }
        // ⑤ 로컬 적용: 트리행 + _T_0015 stamp.
        n.MPROP = oAPP.fn.setAdditBindData(oAPP.attr.additRows);
        var _s15 = _oUi._T_0015.find(function (it) { return it.UIATK === n.UIATK; });
        if (_s15) { _s15.MPROP = n.MPROP; }
        oAPP.fn.toast(H.z("154"));   // 154 적용 완료.
        _refreshDesignTree();
        _showBindAdditInfo(n);   // [R-3] 원본 onAdditionalBind 말미 _showBindAdditInfo(designTree.js:1827) — 하단 "추가속성 적용" 영역을 적용한 행으로 갱신.
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
        _refreshAdditBindInfo();   // [R-3] 원본 additionalBindMulti 말미 _refreshAdditBindInfo(designTree.js:2980) — 중앙하단 SEL 패널 재구성.
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

        // 추가속성 선택/레이아웃 초기화 — 필수 호출 직접(삼킴 제거).
        oAPP.fn.clearSelectAdditBind();
        oAPP.fn.setAdditLayout("");

        // 디자인 영역 데이터 구성(재렌더 + 컬럼맞춤 포함).
        oAPP.fn.setDesignTreeData();

        // 추가속성 리스트 재구성 — ★oAPP.attr.oAddit 는 라이브 미할당(죽은 네임스페이스)이던 것 → oAPP.fn 으로 복구.
        oAPP.fn.setAdditialListData();

        // ※ busy 는 이 함수가 아니라 호출부(drop 이벤트 핸들러 _wireDesignDrop)에서 드롭 즉시 ON→재구성 후 OFF 한다
        //   — dataTransfer 유효구간(이벤트 내)에서 prc002 를 읽어야 하고, 페인트 확보(rAF)를 위해 호출부가 감싼다.
        return true;
    };

    // 드롭 처리(원본 onDropBindField 1:1 — WS20 캔버스(prc002) 우선 → 프로퍼티/aggregation(prc001)) — 편집모드 + 검증 통과 시 쓰기 후 재렌더.
    async function _onDesignDrop(ev) {
        // ★ 진입 WS20 busy(220)는 호출측 drop 리스너가 켠다 → 여기 각 중단 분기에서 반드시 OFF(원본 onDropBindField 1244/1278/1299).
        //   성공은 OFF 하지 않음 — _setBindAttribute→attrSetBindProp→WS20 왕복이 해제(자기해제 금지).
        if (oAPP.attr.editable === false) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }

        // ① WS20 디자인 트리 드래그(prc002) → 디자인 트리 전체 재구성(원본 우선 분기). 리스너가 이미 처리하므로 보통 도달 안 함(방어).
        if (oAPP.fn.dropDesignArea(ev.dataTransfer.getData("prc002")) === true) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }

        // ② 좌측 모델필드 드래그(prc001) → 바인딩 쓰기.
        var _sRes = _checkDragData(ev.dataTransfer.getData("prc001"));   // ★ dataTransfer 는 await 前 동기 판독.
        if (_sRes.RETCD === "E") { if (_sRes.RTMSG) { oAPP.fn.toast(_sRes.RTMSG); } oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // 원본 1278

        var _sDrop = _dropNodeOf(ev);
        if (typeof _sDrop === "undefined") { oAPP.fn.setBusyWS20Interaction(false, {}); return; }   // 원본 1299

        // 드롭 가능 검증(원본 checkValidBind) — 불가 시 메시지.
        var _chk = oAPP.fn.checkValidBind(_sDrop, _sRes.IF_DATA);
        if (_chk.RETCD === "E") { oAPP.fn.toast(oAPP.common.zmsg(_chk.MSGNO) || ""); oAPP.fn.setBusyWS20Interaction(false, {}); return; }

        // DESIGN TREE 드롭은 추가속성 미적용(원본 §4.8-b) — MPROP 초기화.
        _sRes.IF_DATA.MPROP = "";

        if ((await _setBindAttribute(_sRes.IF_DATA, _sDrop)) === false) { oAPP.fn.setBusyWS20Interaction(false, {}); return; }
        _sDrop.chk_seleced = false;

        // [R-3] 원본 onDropBindField: 바인딩 후 참조필드 DDLB + 중앙하단 SEL 패널 재구성(designTree.js:1328·1332). 필수 호출 직접.
        oAPP.fn.setRefFieldList();
        _refreshAdditBindInfo();

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
            var oNode = oRowEl ? _srcNode(oRowEl.__bwpNode) : undefined;   // 필터 복사본 → 원본(_drop_enable 라이브).
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
            // ★ 선별 금지 — 드롭 이벤트 진입 즉시 무조건 busy ON, 필요 없는 분기에서만 OFF(장군님 지시).
            oAPP.fn.setBusy(true);   // 즉시 로컬 오버레이(busy 페이드 조기해제 방지).
            // dataTransfer 는 이 이벤트 안에서만 유효 → prc002 문자열 동기 판독.
            var _prc002 = ev.dataTransfer.getData("prc002");
            if (_prc002) {
                // WS20 UI 드롭 → 트리 전체 재구성. ★원본 221 "디자인 TREE 영역을 갱신하고 있습니다" WS20 busy
                //   (designTree.js onDropBindField:1229/1232). 재구성은 로컬이라 완료/예외 시 직접 OFF(원본 1268).
                oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("221") });
                var _fnDrop = function () {
                    try { oAPP.fn.dropDesignArea(_prc002); }
                    catch (e) { console.error("[HTML5][bindWindow] dropDesignArea:", e && e.message); }
                    finally { oAPP.fn.setBusyWS20Interaction(false, {}); }
                };
                if (typeof requestAnimationFrame === "function") {
                    requestAnimationFrame(function () { requestAnimationFrame(_fnDrop); });
                } else { _fnDrop(); }
                return;
            }
            // 좌측 모델필드(prc001) 바인딩 — ★원본 220 "바인딩 처리를 진행하고 있습니다" WS20 busy
            //   (designTree.js onDropBindField:1224/1232). 성공은 attrSetBindProp→WS20 왕복이 해제(자기해제 금지),
            //   중단 분기는 _onDesignDrop 안에서 setBusyWS20Interaction(false,{})로 OFF(원본 1290/1309).
            oAPP.fn.setBusyWS20Interaction(true, { DESC: H.z("220") });
            try { await _onDesignDrop(ev); }
            catch (e) { console.error("[HTML5][bindWindow] 디자인트리 drop:", e && e.message); oAPP.fn.setBusyWS20Interaction(false, {}); }
        });
    }

    // 현재 렌더된 행에 drop 가능/불가 표시 토글(원본 setDropStyle/resetDropStyle 의 HTML5 대응).
    function _applyDropStyle(bDragging) {
        if (!oD.host) { return; }
        var aRows = oD.host.querySelectorAll(".u4a-tree__row");
        for (var i = 0; i < aRows.length; i++) {
            var oRow = aRows[i], n = _srcNode(oRow.__bwpNode);   // 필터 복사본 → 원본(_drop_enable 라이브).
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

        // [R4] 데이터 재적재(드롭/방송 수신) → 이름 필터 리셋(옛 트리 기준 필터 잔존 방지).
        oAPP.attr.designNameFilter = "";
        var _oNameThReset = oD.host && oD.host.querySelector(".u4aColTreeHead .u4aColTreeCol");
        if (_oNameThReset) { _bwpSyncFilterInd(_oNameThReset, false); }

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
            // [R3/ΔF1] 최상위 UI OBJID 를 WS20 에 통지(원본 setDesignTreeData 끝 SEND-ROOT-OBJID, designTree.js:3384).
            //   aTree[0] = 첫 _build0014(최상위 UI). 채널 없으면(팝업 단독) sendRootObjid 가 조용히 skip.
            if (aTree.length && typeof oAPP.fn.sendRootObjid === "function") {
                try { oAPP.fn.sendRootObjid(aTree[0].OBJID); } catch (e) { }
            }
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

    // 원본 이름칸 아이콘(designTree.js:4064~4075):
    //   UI 오브젝트 = sap.m.Image src="{_image_src}" visible="{_image_visible}"(실제 컨트롤 .gif, WS20 디자인 트리와 동일) — 큐브 아님.
    //   프로퍼티/애그리게이션 = sap.ui.core.Icon src="{_icon_src}"(customize/dimension) → FA 매핑.
    function _nodeIcon(n) {
        if (n.DATYP === CS_DATYP.UOBJ) {
            // UI 컨트롤 이미지(_image_visible 일 때만; 원본 Image visible="{_image_visible}").
            // _image_src = fnGetSapIconPath(UICON) = raw OS 경로 → file:/// 변환(WS20 tree.js:503 동일).
            if (n._image_visible && n._image_src) {
                var p = String(n._image_src);
                var src = /^(file:|https?:|data:|\/)/i.test(p) ? p : ("file:///" + p.replace(/\\/g, "/"));
                src = src.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                return '<img class="u4aBwpTreeIcon" src="' + src + '" alt="" onerror="this.style.display=\'none\'">';
            }
            return "";   // 이미지 없으면 아이콘 없음(원본 Image visible=false 동일).
        }
        if (n._icon_src === "sap-icon://customize") { return H.fa("sliders"); }  // 프로퍼티
        if (n._icon_src === "sap-icon://dimension") { return H.fa("cubes"); }    // 애그리게이션
        return "";   // Properties/Aggregations 그룹(아이콘 없음)
    }

    // 임베디드 속성 배지(원본 designTree.js:4093 이름칸 ObjectStatus{text:EMATT, icon:EMATT_ICON}, SpaceBetween 우측).
    //   EMATT = 그 UI 가 대표하는 임베디드 속성(S_14_UIATT). 아이콘 = Aggregation 카디널리티(원본 _build0014:105).
    //   ★WS20 UI 트리(js/ws_html5_ws20_tree.js:193 _AGGR_ICON)와 ★동일 클래스★로 맞춤(장군님 통일 지시 2026-07-24):
    //     0:1 color-fill → fa-regular fa-square(사각형 1개) / 0:N dimension → fa-regular fa-clone(겹친 사각형).
    function _ematBadge(n) {
        if (!n || !n.EMATT) { return null; }
        var oB = H.el("span", "u4aBwpEmatt");
        var sCls = (n.EMATT_ICON === "sap-icon://dimension") ? "fa-regular fa-clone"   // 0:N (겹친 사각형)
            : (n.EMATT_ICON === "sap-icon://color-fill") ? "fa-regular fa-square" : ""; // 0:1 (사각형 1개)
        if (sCls) { var oI = H.el("span", "u4aBwpEmattIcon"); oI.innerHTML = '<i class="' + sCls + '"></i>'; oB.appendChild(oI); }
        oB.appendChild(document.createTextNode(n.EMATT));
        oB.setAttribute("data-tip", n.EMATT); oB.setAttribute("data-tip-trunc", "");   // 잘릴 때만 툴팁(공통).
        return oB;
    }

    // 행 액션 컬럼(원본 rowActionTemplate — accept=추가속성적용 / disconnected=해제).
    //   WS20 디자인 트리의 +/휴지통과 동일한 2슬롯 구조(빈슬롯으로 세로 정렬 유지). 편집 상태 + 가시 플래그일 때만 버튼.
    function _rowActions(n) {
        var oAct = H.el("span", "u4aBwpRowActions");
        var bEdit = !!oAPP.attr.editable;
        // 슬롯1: 추가속성 정보 적용(accept). 툴팁=139 "추가속성적용" — 원본 _txt6 실제값(designTree.js:3914).
        //   ★ 원본 사용처 주석(designTree.js:4167)은 132로 오기돼 있으나 런타임 바인딩 값은 139다.
        if (bEdit && n._bind_visible) {
            oAct.appendChild(H.iconBtn("circle-check", H.z("139"), function (e) { e.stopPropagation(); oAPP.fn.onAdditionalBind(n, e && e.currentTarget); }, "u4aBwpRowActBtn u4aBwpRowActBtn--bind"));
        } else { oAct.appendChild(H.el("span", "u4aBwpRowActSlot")); }
        // 슬롯2: 바인딩 해제(disconnected, 186)
        if (bEdit && n._unbind_visible) {
            oAct.appendChild(H.iconBtn("link-slash", H.z("186"), function (e) { e.stopPropagation(); oAPP.fn.onUnbind(n); }, "u4aBwpRowActBtn u4aBwpRowActBtn--unbind"));
        } else { oAct.appendChild(H.el("span", "u4aBwpRowActSlot")); }
        return oAct;
    }

    /************************************************************************
     * [R3] WS20 캔버스 선택 → 팝업 트리 선택 반영 — 원본 responeSelectDesignTreeOBJID(방송) 대응.
     *   OBJID 로 UI 오브젝트 행(CHILD===OBJID)을 찾아 선택+스크롤. 못 찾으면 무시(원본).
     *   ★_bRemoteDesignSelect: 수신에 의한 선택 중엔 되-송신 금지(에코 방지). 공통 selectKey 는
     *     onSelect 를 안 태우므로 실제로도 에코가 없지만, 방어적으로 플래그를 둔다.
     ************************************************************************/
    var _bRemoteDesignSelect = false;
    oAPP.fn.selectDesignNodeByObjid = function (sObjid) {
        if (!oD.ctrl || !sObjid) { return; }
        var oNode = null, aAnc = [];
        (function rec(a, aPath) {
            if (!a || oNode) { return; }
            for (var i = 0; i < a.length; i++) {
                if (a[i].CHILD === sObjid) { oNode = a[i]; aAnc = aPath.slice(); return; }   // UI 오브젝트 행 = CHILD===OBJID(_build0014).
                rec(a[i].zTREE_DESIGN, aPath.concat(a[i]));   // 조상 경로 수집(접힘 펼침용).
                if (oNode) { return; }
            }
        })(oAPP.attr.designTree || [], []);
        if (!oNode) { return; }
        _bRemoteDesignSelect = true;
        try {
            oAPP.attr.selDesignNode = oNode;
            // ★접힌 조상 먼저 펼침(원본은 선택 시 해당 위치까지 확장). 안 그러면 대상 행 DOM 이 없어
            //   선택 강조·스크롤이 무효(장군님 지적 2026-07-29). ★펼침→선택 순서 필수(재렌더가 강조를 지우므로).
            if (oD.ctrl.tree && typeof oD.ctrl.tree.setExpanded === "function") {
                for (var e2 = 0; e2 < aAnc.length; e2++) { try { oD.ctrl.tree.setExpanded(aAnc[e2], true); } catch (e3) { } }
            }
            // 선택 강조(원본 setSelectedIndex). ★공통 selectKey 는 비가상 트리에선 스크롤을 안 한다
            //   (u4a-ui.js:1630 — bVirtual&&bReveal 일 때만 scrollToKey). 디자인 트리는 비가상이라
            //   스크롤은 아래서 행 DOM 을 직접 scrollIntoView(원본 setFirstVisibleRow 대응, focusErrorDesignLine 과 동일).
            // 선택 강조 + off-screen reveal — 공통 selectKey(key,true)가 가상 scrollToKey 로 스크롤 이동
            //   (원본 setSelectedIndex+setFirstVisibleRow). 비가상 querySelectorAll+scrollIntoView 제거(가상은 화면 밖 행 DOM 없음).
            if (typeof oD.ctrl.selectKey === "function") { oD.ctrl.selectKey(oNode.CHILD, true); }
            oAPP.fn.bindPossibleRecompute(oNode);   // [표준] 필수 호출 직접(삼킴 제거).
        } finally { _bRemoteDesignSelect = false; }
    };

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
            // [B4] 디자인트리 도움말 문서 "000275"(원본 designTree.js:2696). 영역별 라우팅.
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp("000275"); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
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
            virtual: true,   // 대용량(수만 UI) 대비 가상 스크롤 — WS20 디자인 트리와 동일 자산(원본 TreeTable 가상).
            // autofit(더블클릭·161버튼 공용) = 원본 setUiTableAutoResizeColumn 정책(여유 0.5rem/최소 4rem/상한 없음).
            autofit: { slackRem: 0.5, minRem: 4, max: Infinity },
            lastColResize: false,   // 액션 컬럼(마지막)은 고정 거터 — 우측 리사이즈 그립(||) 제거.
            roots: function () { return _filterDesignRoots(); },   // [R4] 이름 필터(§3.10) 스코프 반영
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
                    // 체크 선택 변경 → 우측 참조필드(P05) 재구성(원본 setRefFieldList, P3-C). 필수 호출 직접.
                    oAPP.fn.setRefFieldList();
                });
                return oChk;
            },
            // C2 = 바인딩 경로(UIATV) / (개발) C3 = MPROP / 마지막 = 행 액션 컬럼.
            cell: function (n) {
                var oPath = H.el("span", "u4aBwpDesignPath", n.UIATV || "");
                if (n.UIATV) {
                    oPath.setAttribute("data-tip", n.UIATV); oPath.setAttribute("data-tip-trunc", "");
                    // SPEC §3.2 2열=바인딩경로 Link, press onShowBindAdditInfo(원본 designTree.js:4123) →
                    //   클릭 시 ★중앙 하단(DESIGN_ADDIT/SEL) 추가속성 패널을 이 필드로 재구성(§3.5 _showBindAdditInfo). ("우측" 오기 정정 2026-08-09)
                    oPath.classList.add("u4aBwpDesignPathLink");
                    oPath.setAttribute("role", "button"); oPath.tabIndex = 0;
                    oPath.addEventListener("click", function (e) {
                        e.stopPropagation();
                        // [UX · 원본에 없음, 장군님 지시 2026-08-02] 바인딩 경로 링크 클릭도 테이블 행 클릭과
                        //   동일 효과가 나게 — 그 행을 선택(selDesignNode+파랑+bindPossibleRecompute).
                        //   ★select→패널 순서: 재계산이 먼저, 좌측 자동선택(C-15, onShowBindAdditInfo 내부)이 나중이라
                        //   재계산 재렌더가 좌측 선택을 지우지 않는다. select 는 클릭 경로(oCfg.onSelect) 그대로 재사용.
                        if (oD.ctrl && typeof oD.ctrl.select === "function") { oD.ctrl.select(n); }
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
                // 오류 행 = _bind_error 전용(원본 _style="u4aWsDesignTreeError" 대응). reset(_resetErrorFieldLine)이
                //   _bind_error 를 지우므로 다음 동작 시 해제된다. 오류를 _highlight 에 얹으면 reset 이 못 지우거나
                //   UI 줄 Success 까지 날리므로 분리(장군님 지적 2026-07-30 "언제 지워지나").
                if (n._bind_error) {
                    oRow.classList.add("u4aBwpRow--error");
                    // [원본 designTree.js:4051~ tooltip="{_error_tooltip}"] 오류 라인 hover 시 검증 메시지 표시(누락 복원).
                    //   ★ 공통 makeColumnTree 는 행에 data-tip-trunc-sel(이름 잘릴 때만 툴팁)을 건다(1130 tip 옵션).
                    //     오류 툴팁은 이름 길이와 무관하게 항상 떠야 하므로 그 "잘릴 때만" 조건을 해제한다([GAP2] 배선 복원).
                    if (n._error_tooltip) {
                        oRow.setAttribute("data-tip", n._error_tooltip);
                        oRow.removeAttribute("data-tip-trunc-sel");
                        oRow.removeAttribute("data-tip-trunc");
                    } else { oRow.removeAttribute("data-tip"); }
                } else {
                    oRow.removeAttribute("data-tip");
                    var sHl = H.rowHl(n._highlight); if (sHl) { oRow.classList.add(sHl); }
                }
                oRow.__bwpNode = n;   // 드롭 대상 조회용(좌측 필드 → 이 행).
                // [가상 선택강조] WS20(tree.js:595) 패턴 — 화면 소유 선택키(selDesignNode)로 매 빌드 aria-selected
                //   재적용(공통 selKey 미동기라 가상 스크롤 재생성 시 강조 소실 방지).
                if (oAPP.attr.selDesignNode && oAPP.attr.selDesignNode.CHILD === n.CHILD) { oRow.setAttribute("aria-selected", "true"); }
                // 임베디드 속성 배지 — 이름칸(.u4aColTreeNameCell) 우측에 덧댐(원본 ObjectStatus SpaceBetween 재현).
                //   공통 미수정 — 이름칸은 공통이 조립하고 여기(화면 rowHook)서 추가만 한다.
                var oEmat = _ematBadge(n);
                if (oEmat) {
                    var oNameCell = oRow.querySelector(".u4aColTreeNameCell");
                    if (oNameCell) { oNameCell.appendChild(oEmat); }
                }
                // 드래그 진행 중이면 현재 drop 가능여부 표시 유지(재렌더 대비).
                if (oAPP.attr.dragModelNode) {
                    var _nSrc = _srcNode(n);   // 필터 복사본 → 원본(_drop_enable 라이브).
                    oRow.classList.toggle("u4aBwpDropOk", _nSrc._drop_enable === true);
                    oRow.classList.toggle("u4aBwpDropNo", _nSrc.DATYP === "02" && _nSrc._drop_enable !== true);
                }
            },
            onSelect: function (n) {
                oAPP.attr.selDesignNode = n;
                // 클릭한 행에 선택 강조(aria-selected) 즉시 적용 — 공통 트리는 강조 API(selectKey)만 제공하고 화면이 호출한다.
                //   가상 전환 후 클릭만으론 재렌더가 안 일어나 rowHook 강조가 스크롤(재렌더)해야 뜨던 것 수정(장군님 지적 2026-07-31).
                //   bScroll=false: 사용자가 직접 클릭한 보이는 행이라 스크롤 점프 금지. 좌측 모델트리(modelFieldArea.js:143)와 동일.
                if (oD.ctrl && typeof oD.ctrl.selectKey === "function") { try { oD.ctrl.selectKey(n.CHILD, false); } catch (e) { } }
                // [SPEC §2.1] 디자인 트리 속성 선택 → 좌측 모델필드 바인딩 가능/불가 재계산(이미 바인딩=파랑).
                if (typeof oAPP.fn.bindPossibleRecompute === "function") {
                    try { oAPP.fn.bindPossibleRecompute(n); } catch (e) { console.error("[HTML5][bindWindow] bindPossibleRecompute:", e && e.message); }
                }
                // [R3] UI 오브젝트 행(DATYP 01) 선택 → WS20 캔버스에서 같은 UI 선택 요청(원본 designTree.js:1891~1893).
                //   _bRemoteDesignSelect 중(WS20 수신 반영)엔 되-송신 금지(에코 방지).
                if (!_bRemoteDesignSelect && n && n.DATYP === CS_DATYP.UOBJ && typeof oAPP.fn.sendDesignTreeSelect === "function") {
                    try { oAPP.fn.sendDesignTreeSelect(n.OBJID); } catch (e) { }
                }
            }
        });

        // 좌측 필드 → 디자인트리 드롭(원본 onDropBindField/_setBindAttribute) 배선.
        _wireDesignDrop(oD.host);

        // ── [R4] 오브젝트이름 컬럼 필터(원본 onFilterDesignTree §3.10) — 헤더 이름칸 클릭 → 공통 컬럼메뉴(필터 전용) ──
        //   원본 = sap.ui.table Column filter(filterProperty:"DESCR", 정렬 없음). 공통 openColumnMenu 를
        //   filter:true / sort:false 로 소비(공통 makeColumnTree·openColumnMenu 미수정). 필터 로직=_filterDesignRoots.
        (function () {
            var oNameTh = oD.host.querySelector(".u4aColTreeHead .u4aColTreeCol");   // 첫 컬럼(오브젝트이름) 헤더
            if (!oNameTh) { return; }
            oNameTh.classList.add("u4aBwpDesignNameTh");   // 클릭 어포던스=pointer+hover 만(공통 관례 shell.css:1976). 깔때기 표시자는 활성 시에만.
            oNameTh.addEventListener("click", function () {
                if (!(window.U4AUI && U4AUI.openColumnMenu)) { return; }
                U4AUI.openColumnMenu({ key: "DESCR" }, oNameTh, {
                    getFilter: function () { return oAPP.attr.designNameFilter || ""; },
                    setFilter: function (k, v) { oAPP.attr.designNameFilter = (v || "").toLowerCase(); },
                    rerender: function () { _applyDesignFilter(); }
                }, {
                    container: document.body,   // frameless 팝업 = body top-layer
                    filter: true, sort: false,  // ★ 원본 이름컬럼 = 필터 전용(정렬 없음)
                    labels: { filter: H.cl("A68"), clear: H.cl("A69") }   // A68 필터 값 / A69 필터 초기화
                });
            });
        })();

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
            // [가상 대비] 가상 스크롤은 매 프레임 행을 add/remove → MutationObserver 동기 _fixEmpty 폭주.
            //   rAF 게이트(_schedule)로 프레임당 1회로 합침(공통 §3.4.2 RO 콜백 동기쓰기 금지와 동일 결).
            try { new MutationObserver(_schedule).observe(oHost, { childList: true, subtree: true }); } catch (e) { }
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
        // [G-2] 원본 onClearSelection 말미(designTree.js:1619) — 우측 참조필드(P05) DDLB 재구성. 필수 호출 직접.
        oAPP.fn.setRefFieldList();
    }

    // ── [R4] 오브젝트이름 컬럼 필터 — 전체 트리 이름(DESCR) contains 검색. 매칭행 + 조상 경로 유지(트리 필터 표준). ──
    //   ★ 원본(designTree.js:2020 onFilterDesignTree)은 실제로 "선택한 UI 오브젝트(DATYP=01)의 속성행만" 스코프
    //     검색이다(UI 미선택 시 무동작). 그러나 장군님 결정(2026-08-06)으로 UI 무관 전역 검색을 유지한다
    //     (원본과 의도적 상이 — 사용성). 과거 주석 "UI 스코프는 원본에 없음"은 원본 오독이었어 정정함.
    function _filterDesignRoots() {
        var aAll = oAPP.attr.designTree || [];
        var sF = oAPP.attr.designNameFilter || "";
        if (!sF) { return aAll; }
        var _pruneAll = function (aKids) {
            var aOut = [];
            for (var i = 0; i < (aKids ? aKids.length : 0); i++) {
                var n = aKids[i];
                var aSub = _pruneAll(n.zTREE_DESIGN);
                var bSelf = String(n.DESCR || "").toLowerCase().indexOf(sF) !== -1;
                if (bSelf || aSub.length) { var c = Object.assign({}, n); c.zTREE_DESIGN = aSub; aOut.push(c); }
            }
            return aOut;
        };
        return _pruneAll(aAll);
    }

    // [R4] 필터 표시자(깔때기) — 공통 관례(shell.css:1976): ★필터 걸린 컬럼에만★ 노출(상시 아이콘 금지).
    //   공통 .u4a-th__ind(색=--accent · 아이콘 fa-filter) 재사용 → AppF4 등 다른 컬럼필터와 완전 동일.
    function _bwpSyncFilterInd(oTh, bActive) {
        if (!oTh) { return; }
        var oInd = oTh.querySelector(".u4a-th__ind");
        if (bActive) {
            if (!oInd) { oInd = H.el("span", "u4a-th__ind"); oInd.innerHTML = H.fa("filter"); oTh.appendChild(oInd); }
        } else if (oInd) { oInd.remove(); }
    }

    // [R4] 필터 적용 = 걸러진 roots 로 재렌더(첫행 자동선택 방지) + 전체 펼침(원본 expandToLevel 99999). 공통 미수정.
    function _applyDesignFilter() {
        if (!oD.ctrl) { return; }
        oD.ctrl.rerender(false);
        var bActive = !!oAPP.attr.designNameFilter;   // 필터값 있으면 활성(일반/스코프 무관) → 깔때기 표시
        var oNameTh = oD.host.querySelector(".u4aColTreeHead .u4aColTreeCol");
        if (oNameTh) { _bwpSyncFilterInd(oNameTh, bActive); }
        if (oD.ctrl.tree && typeof oD.ctrl.tree.expandAll === "function") {
            try { oD.ctrl.tree.expandAll(); } catch (e) { }
        }
    }

    /************************************************************************
     * [S1b §9.2] 가운데 디자인트리 영역(#bwpDesignArea) 페이지 스왑 — 원본 NavContainer to()/moveDesignPage.
     *   트리 콘텐츠(툴바+트리호스트) ↔ 외부 페이지 el 을 슬라이드+페이드(.analy 16 §9.2: 0.26s, ±32px, opacity,
     *   들어오는 z-index:2). 즉시스왑 금지(§9). 진입=forward, 뒤로=back.
     ************************************************************************/
    oAPP.fn.designSwapToPage = function (elPage, bBack) {
        var oArea = document.getElementById("bwpDesignArea");
        if (!oArea || !elPage) { return; }
        elPage.classList.add("u4aBwpDesignPage");
        oArea.appendChild(elPage);
        elPage.classList.add(bBack ? "u4aBwpPgInBack" : "u4aBwpPgIn");   // 들어오는 페이지 슬라이드인.
        var aOut = [oD.tool, oD.host];
        aOut.forEach(function (el) { if (el) { el.classList.add(bBack ? "u4aBwpPgOutBack" : "u4aBwpPgOut"); } });   // 나가는 트리 슬라이드아웃.
        setTimeout(function () {
            aOut.forEach(function (el) {
                if (!el) { return; }
                el.style.display = "none";
                el.classList.remove("u4aBwpPgOut", "u4aBwpPgOutBack");
            });
        }, 260);
        oD._syncPage = elPage;
    };

    // 디자인 트리로 복귀(원본 moveDesignPage) — teardown(동일속성 페이지 제거, 원본 onViewExit destroy) 포함.
    //   Promise = 트랜지션(0.26s) 완료 시 resolve → 호출측이 복원/ busy off 를 그 후에 수행.
    oAPP.fn.moveDesignPage = function () {
        return new Promise(function (res) {
            var elPage = oD._syncPage;
            var aIn = [oD.tool, oD.host];
            aIn.forEach(function (el) {
                if (!el) { return; }
                el.style.display = "";
                el.classList.add("u4aBwpPgInBack");   // 트리 슬라이드인(back).
            });
            if (elPage) {
                elPage.classList.remove("u4aBwpPgIn", "u4aBwpPgInBack");
                elPage.classList.add("u4aBwpPgOutBack");   // 동일속성 페이지 슬라이드아웃(back).
            }
            setTimeout(function () {
                aIn.forEach(function (el) { if (el) { el.classList.remove("u4aBwpPgInBack"); } });
                if (elPage && elPage.parentNode) { elPage.parentNode.removeChild(elPage); }
                oD._syncPage = null;
                res();
            }, 260);
        });
    };

})();
