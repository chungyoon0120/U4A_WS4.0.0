/****************************************************************************
 * Binding Popup(대형 별창) — 바인딩 쓰기 (bindWrite.js) — HTML5
 * --------------------------------------------------------------------------
 *  원본 index.js 의 바인딩 쓰기 함수 이식. 드래그앤드롭·멀티·동일속성 3곳이 공유하는
 *  단일 진입점 attrSetBindProp(프로퍼티) 을 1:1 로 재현(스펙 §3.4/§12 불변).
 *
 *  ★ attrChange 후속(미리보기 갱신 + WS20 브로드캐스트)은 원본 attrChangeProc = P6(동기화) 영역.
 *    여기선 로컬 후속(버튼 활성)만 수행하고, WS20 브로드캐스트는 designBroadcastUpdate(P6) 로 위임(가드).
 *    → 지금은 드롭 시 디자인트리 노드에 바인딩 경로(UIATV)가 로컬로 써지고 재렌더로 표시된다.
 *  ★ aggregation(UIATY="3") 쓰기 attrBindCallBackAggr 은 후속 증분(aggr 선택 팝업 포함).
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    // n건 바인딩한 프로퍼티 해제(원본 attrUnbindProp 1:1 — jQuery.isEmptyObject → Object.keys).
    oAPP.fn.attrUnbindProp = function (is_attr) {
        function lf_findModelBindParent(oParent) {
            if (!oParent) { return; }
            if (!oParent._BIND_AGGR || Object.keys(oParent._BIND_AGGR).length === 0) {
                lf_findModelBindParent(oParent.__PARENT);
                return;
            }
            for (var i in oParent._BIND_AGGR) {
                var l_indx = oParent._BIND_AGGR[i].findIndex(function (a) { return a.OBJID === is_attr.OBJID; });
                if (l_indx === -1) { continue; }
                oParent._BIND_AGGR[i].splice(l_indx, 1);
                return;
            }
            lf_findModelBindParent(oParent.__PARENT);
        }
        var oPrev = oAPP.attr.prev[is_attr.OBJID];
        if (oPrev) { lf_findModelBindParent(oPrev.__PARENT); }
    };

    // 클라이언트 이벤트 삭제(원본 attrDelClientEvent 1:1).
    oAPP.fn.attrDelClientEvent = function (is_attr, OBJTY) {
        if (!oAPP.attr.T_CEVT || oAPP.attr.T_CEVT.length === 0) { return; }
        var l_index = oAPP.attr.T_CEVT.findIndex(function (a) { return a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === OBJTY; });
        if (l_index === -1) { return; }
        oAPP.attr.T_CEVT.splice(l_index, 1);
    };

    // 바인딩 정보에 따른 행 액션 버튼 활성(원본 setDesignTreeEnableButton 1:1).
    oAPP.fn.setDesignTreeEnableButton = function (is_attr) {
        is_attr._bind_visible = false;
        is_attr._unbind_visible = false;
        if (is_attr.ISBND !== "X") { return; }
        is_attr._unbind_visible = true;
        if (is_attr.UIATY !== "1") { return; }
        if (is_attr.UIATK === "EXT00001161") { return; }
        if (is_attr.UIATK === "EXT00002507") { return; }
        if (is_attr.UIATY === "1" && is_attr.ISMLB === "X") { return; }
        is_attr._bind_visible = true;
    };

    // attribute 변경 후속(원본 attrChange → attrChangeProc). 로컬: 버튼 활성만.
    //   미리보기 갱신 + WS20 브로드캐스트(UPDATE-DESIGN-DATA)는 P6 designBroadcastUpdate 로 위임(가드).
    oAPP.fn.attrChange = function (is_attr) {
        oAPP.fn.setDesignTreeEnableButton(is_attr);
        // [SPEC §2.1] 바인딩/해제 후 좌측 모델필드 판정 재계산(원본 designTree.js:1588 등 — 해제/바인딩 후 bindPossible).
        if (typeof oAPP.fn.bindPossibleRecompute === "function") {
            try { oAPP.fn.bindPossibleRecompute(is_attr); } catch (e) { console.error("[HTML5][bindWindow] bindPossibleRecompute(attrChange):", e && e.message); }
        }
        try { if (typeof oAPP.fn.designBroadcastUpdate === "function") { oAPP.fn.designBroadcastUpdate(is_attr); } } catch (e) { }
    };

    /************************************************************************
     * 프로퍼티 바인딩 쓰기(원본 attrSetBindProp 1:1) — 드롭·멀티·동일속성 공유 단일 진입점.
     *   is_attr = 대상(디자인트리 리프 노드), is_bInfo = 드래그한 모델필드.
     *   ★ MPROP 은 UIATY="1" & is_bInfo.MPROP!=="" 일 때만 전달(스펙 §3.4/§5.4 의도된 비대칭).
     ************************************************************************/
    oAPP.fn.attrSetBindProp = function (is_attr, is_bInfo) {
        // 이미 바인딩되어 있고 N건 바인딩 파생건이 아니면 기존 N건 수집에서 제거.
        if (is_attr.ISBND === "X") {
            var l_model = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_attr.OBJID]);
            if (typeof l_model !== "undefined" && l_model !== "") {
                var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.findIndex(function (a) {
                    return a.ISBND === "X" && a.UIATK !== is_attr.UIATK && a.UIATV.substr(0, l_model.length) === l_model;
                });
                if (l_indx === -1 && is_bInfo.CHILD.substr(0, l_model.length) !== l_model) {
                    oAPP.fn.attrUnbindProp(is_attr);
                }
            }
        }

        is_attr.UIATV = is_bInfo.CHILD;
        is_attr.ISBND = "X";
        is_attr.MPROP = "";
        if (is_attr.UIATY === "1" && is_bInfo.MPROP !== "") { is_attr.MPROP = is_bInfo.MPROP || ""; }

        // sap.ui.core.HTML content 바인딩 시 수집 이벤트 삭제(원본).
        if (is_attr.UIATK === "AT000011858") { oAPP.fn.attrDelClientEvent(is_attr, "HM"); }

        // DDLB 항목 바인딩 정보 추가(원본).
        if (is_attr.UIATY === "1" && typeof is_attr.T_DDLB !== "undefined") {
            is_attr.T_DDLB.push({ KEY: is_attr.UIATV, TEXT: is_attr.UIATV, ISBIND: "X" });
        }

        oAPP.fn.attrChange(is_attr);
        oAPP.fn.setModelBind(oAPP.attr.prev[is_attr.OBJID]);
    };

    /************************************************************************
     * 프로퍼티 바인딩 해제(원본 attrSetUnbindProp 1:1) — 해제·멀티해제·재귀 공유.
     ************************************************************************/
    oAPP.fn.attrSetUnbindProp = function (is_attr) {
        // n건 바인딩 처리 정보 얻기.
        var l_model = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_attr.OBJID]);

        // n건 바인딩 정보가 존재하는 경우.
        if (typeof l_model !== "undefined" && l_model !== "") {
            // 현재 attr 이 아닌 다른 바인딩된 UI 가 N건 바인딩 처리됐는지 확인.
            var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.findIndex(function (a) {
                return a.ISBND === "X" && a.UIATK !== is_attr.UIATK && a.UIATV.substr(0, l_model.length) === l_model;
            });
            // 다른 바인딩 설정건 중 n건 바인딩 처리건이 없는 경우 부모에서 제거.
            if (l_indx === -1) { oAPP.fn.attrUnbindProp(is_attr); }
        }

        // 바인딩 PATH/FLAG/추가속성 초기화.
        is_attr.UIATV = "";
        is_attr.ISBND = "";
        is_attr.MPROP = "";

        // 변경건 후속 처리(버튼 활성 + 브로드캐스트 가드).
        oAPP.fn.attrChange(is_attr);

        // aggregation 인 경우 N건 바인딩 모델 정보 초기화.
        if (is_attr.UIATY === "3") {
            try { delete oAPP.attr.prev[is_attr.OBJID]._MODEL[is_attr.UIATT]; } catch (e) { }
        }
    };

    // 바인딩 해제 재귀호출(원본 attrUnbindAggr 1:1 — jQuery.isEmptyObject → Object.keys).
    oAPP.fn.attrUnbindAggr = function (oUi, UIATT, UIATV) {
        function lf_clearBindData(oUi) {
            if (!oUi) { return; }
            if (typeof oUi._T_0015 === "undefined") { return; }
            if (oUi._T_0015.length === 0) { return; }
            for (var i = oUi._T_0015.length - 1; i >= 0; i--) {
                if (oUi._T_0015[i].ISBND !== "X") { continue; }
                if (oAPP.fn.chkBindPath(UIATV, oUi._T_0015[i].UIATV) === true) {
                    var _s0015 = oUi._T_0015[i];
                    var _sTree = oAPP.fn.getDesignTreeAttrData(_s0015.OBJID, _s0015.UIATK);
                    if (typeof _sTree === "undefined") { continue; }
                    if (_sTree.UIATY === "3") { oAPP.fn.attrUnbindAggr(oUi, _sTree.UIATT, _sTree.UIATV); }
                    oAPP.fn.attrSetUnbindProp(_sTree);
                }
            }
        }

        // n건 바인딩이 없는 경우 exit.
        if (!oUi._BIND_AGGR[UIATT] || oUi._BIND_AGGR[UIATT].length === 0) {
            if (oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true) { delete oUi._MODEL[UIATT]; }
            return;
        }

        // N건 바인딩 설정한 하위 UI 가 존재하는 경우.
        for (var i = oUi._BIND_AGGR[UIATT].length - 1; i >= 0; i--) {
            if (Object.keys(oUi._BIND_AGGR[UIATT][i]._BIND_AGGR || {}).length === 0) {
                lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);
                oUi._BIND_AGGR[UIATT].splice(i, 1);
                continue;
            }
            for (var j in oUi._BIND_AGGR[UIATT][i]._BIND_AGGR) {
                oAPP.fn.attrUnbindAggr(oUi._BIND_AGGR[UIATT][i], j, UIATV);
            }
            lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);
            oUi._BIND_AGGR[UIATT].splice(i, 1);
        }

        // Aggregation 에 n건 바인딩 처리 제거.
        if (oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true) { delete oUi._MODEL[UIATT]; }
    };

    // sap.m.Tree / sap.ui.table.TreeTable 예외처리 unbind(원본 attrUnbindTree 1:1).
    oAPP.fn.attrUnbindTree = function (is_attr) {
        var lt_UIATK = [];
        switch (is_attr.UIATK) {
            case "AT000006260": lt_UIATK = ["EXT00001190", "EXT00001191"]; break;   // sap.m.Tree items
            case "AT000013146": lt_UIATK = ["EXT00001192", "EXT00001193"]; break;   // sap.ui.table.TreeTable rows
            default: return;
        }
        for (var i = 0, l = lt_UIATK.length; i < l; i++) {
            var ls_attr = oAPP.fn.getDesignTreeAttrData(is_attr.OBJID, lt_UIATK[i]);
            if (typeof ls_attr === "undefined") { continue; }
            if (ls_attr.UIATV !== "" && ls_attr.ISBND === "X") { oAPP.fn.attrSetUnbindProp(ls_attr); }
        }
    };

    // 확인 팝업(공통 U4AUI.confirm)을 원본 MessageBox.confirm 흐름처럼 Promise 로 감싼다.
    //   원본은 OK/Cancel → 여기선 YES(=OK)/NO. resolve 값은 "OK"/"" 로 원본 판정(_param!=="OK")과 일치.
    function _confirmAsync(sMsg) {
        return new Promise(function (resolve) {
            var H = oAPP.H;
            window.U4AUI.confirm({
                type: "C",
                message: sMsg,
                buttons: [{ act: "YES", label: H.cl("A03"), emphasized: true }, { act: "NO", label: H.cl("A39") }],
                onClose: function (sAct) { resolve(sAct === "YES" ? "OK" : ""); }
            });
        });
    }

    /************************************************************************
     * aggregation 바인딩 callback(원본 attrBindCallBackAggr 1:1).
     *   is_tree = 드래그한 모델필드, is_attr = 디자인트리 드롭 대상(aggregation 행).
     *   ★ 별도 aggregation 선택 팝업 없음 — 드롭 행이 곧 대상 aggregation(UIATT).
     *   ★ WS20 busy 핸드셰이크(setBusyWS20Interaction)는 P6 — 로컬은 동기라 생략.
     ************************************************************************/
    oAPP.fn.attrBindCallBackAggr = async function (bIsbind, is_tree, is_attr) {
        var oPrev = oAPP.attr.prev[is_attr.OBJID];

        // unbind 처리건.
        if (bIsbind === false) {
            // n건 바인딩 처리한 하위 UI 가 존재하면 확인 후 진행(181+182).
            if (typeof oPrev._BIND_AGGR[is_attr.UIATT] !== "undefined" && oPrev._BIND_AGGR[is_attr.UIATT].length !== 0) {
                var _p1 = await _confirmAsync(oAPP.common.zmsg("181") + oAPP.common.zmsg("182"));
                if (_p1 !== "OK") { return; }
            }
            oAPP.fn.attrUnbindAggr(oPrev, is_attr.UIATT, is_attr.UIATV);
            oAPP.fn.attrSetUnbindProp(is_attr);
            oAPP.fn.attrUnbindTree(is_attr);
            return;
        }

        // 이전 바인딩 정보가 존재하는 경우 → 재바인딩 확인(181+182) 후 기존 해제 + 새 바인딩.
        if (is_attr.UIATV !== "" && is_attr.ISBND === "X") {
            var _p2 = await _confirmAsync(oAPP.common.zmsg("181") + oAPP.common.zmsg("182"));
            if (_p2 !== "OK") { return; }

            oAPP.fn.attrUnbindAggr(oPrev, is_attr.UIATT, is_attr.UIATV);
            oAPP.fn.attrUnbindTree(is_attr);
            oAPP.fn.attrSetBindProp(is_attr, is_tree);
            oPrev._MODEL[is_attr.UIATT] = is_attr.UIATV;
            return;
        }

        // 이전 바인딩이 없으면 바로 바인딩.
        oAPP.fn.attrSetBindProp(is_attr, is_tree);
        oPrev._MODEL[is_attr.UIATT] = is_attr.UIATV;
    };

})();
