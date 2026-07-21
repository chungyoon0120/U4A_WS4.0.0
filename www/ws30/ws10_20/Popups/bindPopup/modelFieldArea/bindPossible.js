/****************************************************************************
 * Binding Popup(대형 별창) 좌측 모델필드 "바인딩 가능/불가 판정" — HTML5 (SPEC §2.1)
 * --------------------------------------------------------------------------
 *  원본: modelFieldArea/bindPossible.js(module.exports) 1:1 이식.
 *  디자인 트리에서 속성/aggregation 행을 선택할 때마다 좌측 모델필드 트리의
 *  enable/상태아이콘/하이라이트를 재계산한다. 좌측 트리는 이미 n.stat_src/n.highlight 를
 *  소비해 렌더하므로(modelFieldArea.js), 이 함수가 그 필드를 세팅 후 재렌더만 하면 된다.
 *
 *  ★ 상태 4종(SPEC §2.1):
 *     가능(초록)      status-positive / highlight "Success"
 *     이미 같은 경로(파랑) accept        / highlight "Information"   ← "이미 바인딩된" 표시
 *     N건 경로 조상(주황) share-2        / highlight "Warning"
 *     불가(기본)      enable:false, 아이콘/하이라이트 null
 *  ★ CARDI(카디널리티 요청): F=필드만 / T=테이블 / S=구조 / R=Range / ST=String table.
 *  ★ 데이터 어댑트: 원본 oAPP.attr.oModel.oData.zTREE → HTML5 oAPP.attr.modelTree,
 *     refresh() → oAPP.fn.refreshModelTree(). 색은 highlight(의미) 로 렌더 — stat_color(hex)는
 *     원본 잔존값이며 HTML5 렌더가 소비하지 않는다(하드코딩 hex 미사용, §2.1 아이콘/하이라이트만).
 *  ★ CJS(module.exports) 아님 — 별창 require 미지원이라 oAPP.fn.bindPossibleRecompute 전역 노출.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    /************************************************************************
     * [PUBLIC] 좌측 판정 재계산 — 원본 bindPossible.js module.exports 1:1.
     *   @param is_attr 디자인 트리 선택 노드(ATTR).
     ************************************************************************/
    oAPP.fn.bindPossibleRecompute = function (is_attr) {
        var aRoot = oAPP.attr.modelTree || [];
        if (aRoot.length === 0) { return { RETCD: "", RCODE: "" }; }

        // 2레벨(TABLE/STRUCTURE)부터 판정(원본 zTREE[0].zTREE).
        var _aBindTree = aRoot[0].zTREE || [];

        _resetBindPossible(aRoot);   // 전 노드 상태 초기화.

        var _sRes = _chkBindPossible(is_attr);
        if (_sRes.RETCD === "E") {
            // 표현 대상 아님(리프 아님) → 기존 바인딩 표현(T/E 전부 가능 초록)만.
            _setBindEnableOrg(_aBindTree, "", "");
            oAPP.fn.refreshModelTree();
            return _sRes;
        }

        var l_CARDI = _setFieldCardinality(is_attr);
        var l_path = _getParentModelPath(is_attr);

        // 재귀 판정이 참조하는 광역 컨텍스트(원본 oAPP.attr.oBindDialog).
        oAPP.attr.oBindDialog = { _CARDI: l_CARDI, _is_attr: is_attr };
        _lf_setBindEnable(_aBindTree, l_path, "");
        delete oAPP.attr.oBindDialog;

        oAPP.fn.refreshModelTree();
        return _sRes;
    };

    // 표현 대상 여부(원본 chkBindPossible) — 리프(DATYP 02)만 판정 대상.
    function _chkBindPossible(is_attr) {
        var _sRes = { RETCD: "", RCODE: "" };
        if (!is_attr || is_attr.DATYP !== "02") { _sRes.RETCD = "E"; _sRes.RCODE = "01"; }
        return _sRes;
    }

    // 카디널리티(원본 setFieldCardinality).
    function _setFieldCardinality(is_attr) {
        var l_CARDI = "";
        switch (is_attr.UIATY) {
            case "1":   // property → 필드(F).
                l_CARDI = "F";
                if (is_attr.UIATK === "EXT00001161") { l_CARDI = "R"; }   // SelectOption2 value → Range.
                if (is_attr.UIATK === "EXT00002507") { l_CARDI = "R"; }   // SelectOption3 value → Range.
                if (is_attr.ISMLB === "X" && (is_attr.UIADT !== "int" && is_attr.UIADT !== "float")) { l_CARDI = "ST"; }   // 배열형(숫자 아님) → String table.
                break;
            case "3":   // aggregation → 테이블(T).
                l_CARDI = "T";
                break;
            default: break;
        }
        return l_CARDI;
    }

    // N건 바인딩 부모 모델 path(원본 getParentModelPath) — Tree/TreeTable/Column/RowAction 특수 매핑.
    function _getParentModelPath(is_attr) {
        var l_path = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_attr.OBJID]);
        var ls_tree = oAPP.fn.getDesignTreeData(is_attr.OBJID);

        if (is_attr.UIATK === "EXT00001190" || is_attr.UIATK === "EXT00001191") {   // sap.m.Tree parent/child → items.
            l_path = oAPP.attr.prev[is_attr.OBJID]._MODEL["items"];
        } else if (is_attr.UIATK === "EXT00001192" || is_attr.UIATK === "EXT00001193") {   // TreeTable parent/child → rows.
            l_path = oAPP.attr.prev[is_attr.OBJID]._MODEL["rows"];
        } else if (is_attr.UIATK === "EXT00002382" && oAPP.attr.prev[is_attr.OBJID].__PARENT) {   // Column markCellColor → 부모 rows.
            l_path = oAPP.attr.prev[is_attr.OBJID].__PARENT._MODEL["rows"];
        } else if (ls_tree && (ls_tree.PUIATK === "AT000022249" || ls_tree.PUIATK === "AT000022258" ||
            ls_tree.PUIATK === "AT000013070" || ls_tree.PUIATK === "AT000013148")) {   // rowSettings/rowAction template → 부모 rows.
            l_path = oAPP.attr.prev[ls_tree.POBID]._MODEL["rows"];
        } else if (ls_tree && ls_tree.PUIATK === "AT000013013") {   // RowAction.items 하위 UI.
            if (!oAPP.attr.prev[ls_tree.POBID]._MODEL["items"]) {
                var ls_parent = oAPP.fn.getDesignTreeData(ls_tree.POBID);
                if (ls_parent && (ls_parent.UIOBK === "UO01139" || ls_parent.UIOBK === "UO01142")) {
                    l_path = oAPP.attr.prev[ls_parent.POBID]._MODEL["rows"];
                }
            }
        }
        return l_path;
    }

    // 상태 초기화(원본 resetBindPossible).
    function _resetBindPossible(aTree) {
        for (var i = 0; i < aTree.length; i++) {
            var _sTree = aTree[i];
            _sTree.enable = false;
            _sTree.stat_color = null; _sTree.stat_src = null; _sTree.highlight = null;
            _resetBindPossible(_sTree.zTREE || []);
        }
    }

    // 표현 대상 아닐 때 기존 바인딩 표현(원본 setBindEnableOrg) — T/E 는 모두 가능(초록).
    function _setBindEnableOrg(it_tree, l_path, KIND) {
        if (!it_tree || it_tree.length === 0) { return; }
        for (var i = 0; i < it_tree.length; i++) {
            switch (it_tree[i].KIND) {
                case "T":
                    it_tree[i].enable = true; it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].stat_color = "#01DF3A";
                    _setBindEnableOrg(it_tree[i].zTREE || [], l_path, it_tree[i].KIND);
                    break;
                case "S":
                    _setBindEnableOrg(it_tree[i].zTREE || [], l_path, KIND);
                    break;
                case "E":
                    it_tree[i].enable = true; it_tree[i].stat_src = "sap-icon://status-positive"; it_tree[i].stat_color = "#01DF3A";
                    break;
                default: break;
            }
        }
    }

    // 상태 세팅(초록/파랑/주황) — 원본과 동일. HTML5 렌더는 stat_src/highlight 소비.
    function _mark(t, sSrc, sColor, sHl) { t.stat_src = sSrc; t.stat_color = sColor; t.highlight = sHl; }
    function _markPos(t) { t.enable = true; _mark(t, "sap-icon://status-positive", "#01DF3A", "Success"); }   // 가능 초록.
    function _markSel(t) { _mark(t, "sap-icon://accept", "#1589FF", "Information"); }                          // 이미 바인딩(파랑).
    function _markAnc(t) { _mark(t, "sap-icon://share-2", "#FBB917", "Warning"); }                             // N건 경로 조상(주황).

    // model field tree 판정(원본 lf_setBindEnable 1:1).
    function _lf_setBindEnable(it_tree, l_path, KIND) {
        if (!it_tree || it_tree.length === 0) { return; }
        var oD = oAPP.attr.oBindDialog;

        for (var i = 0; i < it_tree.length; i++) {
            var t = it_tree[i];
            switch (t.KIND) {
                case "T":   // TABLE.
                    if (_lf_chkRangeTable(t) === true) {   // Range table.
                        _markPos(t);
                        if (t.CHILD === oD._is_attr.UIATV) { _markSel(t); }
                        continue;
                    }
                    if (_lf_chkStringTable(t) === true) {   // String table.
                        _markPos(t);
                        if (t.CHILD === oD._is_attr.UIATV) { _markSel(t); }
                        continue;
                    }
                    // 프로퍼티 호출 + N건 경로 조상 → 주황 후 하위 탐색.
                    if ((oD._CARDI === "F" || oD._CARDI === "R" || oD._CARDI === "ST") &&
                        (l_path && l_path.substr(0, t.CHILD.length) === t.CHILD)) {
                        _markAnc(t);
                        _lf_setBindEnable(t.zTREE || [], l_path, t.KIND);
                        continue;
                    }
                    if (oD._CARDI === "F") { continue; }   // 프로퍼티 → 테이블 하위 skip.
                    // aggregation + 경로 조상 테이블 → 하위(비-E) 탐색.
                    if (oD._CARDI === "T" && l_path && l_path.substr(0, t.CHILD.length) === t.CHILD) {
                        var lt_child = (t.zTREE || []).filter(function (a) { return a.PARENT === t.CHILD && a.KIND !== "E"; });
                        _lf_setBindEnable(lt_child, l_path, t.KIND);
                        continue;
                    }
                    if (oAPP.fn.attrChkBindAggrPossible(oD._is_attr) === true) { continue; }   // 대상 UI aggr N건 → 불가.
                    if (oAPP.fn.getChildAggrBind(oD._is_attr.OBJID, t.CHILD) === true) { continue; }
                    if (oD._CARDI === "T") {   // aggregation → 첫 테이블 선택 가능.
                        if ((t.zTREE || []).length > 0) { _markPos(t); }
                        if (t.CHILD === oD._is_attr.UIATV) { _markSel(t); }
                        continue;
                    }
                    break;

                case "S": {   // STRUCTURE.
                    var l_KIND = (oD._CARDI === "T") ? "E" : "";
                    if (oD._CARDI === "S") { _markPos(t); }
                    var lt_childS = (t.zTREE || []).filter(function (a) { return a.PARENT === t.CHILD && a.KIND !== l_KIND; });
                    _lf_setBindEnable(lt_childS, l_path, KIND);
                    break;
                }

                case "E":   // 일반 필드.
                    // Tree/TreeTable parent·child 바인딩은 바인딩된 aggr 테이블 하위만 가능.
                    if (oD._is_attr.UIATK === "EXT00001190" || oD._is_attr.UIATK === "EXT00001191" ||
                        oD._is_attr.UIATK === "EXT00001192" || oD._is_attr.UIATK === "EXT00001193") {
                        if (l_path && t.CHILD.substr(0, l_path.length) !== l_path) { continue; }
                    }
                    if (oD._CARDI === "F") {   // property → 필드 선택 가능.
                        if (l_path && KIND === "T" && t.CHILD.substr(0, l_path.length) !== l_path) { continue; }
                        if (oAPP.attr.CT_BIND_EXCEPT.findIndex(function (item) { return item.FLD01 === oD._is_attr.UIATK; }) !== -1) { continue; }   // 제외 프로퍼티.
                        _markPos(t);
                        if (t.CHILD === oD._is_attr.UIATV) { _markSel(t); }   // ★ 이미 바인딩된 경로 = 파랑 accept.
                    }
                    break;

                default: break;
            }
        }
    }

    // Range table 여부(원본 lf_chkRangeTable) — CARDI R, 자식 4개가 SIGN/OPTION/LOW/HIGH 뿐.
    function _lf_chkRangeTable(is_tree) {
        if (oAPP.attr.oBindDialog._CARDI !== "R") { return; }
        if (is_tree.KIND !== "T") { return; }
        var lt = is_tree.zTREE || [];
        if (lt.length !== 4) { return; }
        var l_indx = lt.findIndex(function (a) { return a.NTEXT !== "SIGN" && a.NTEXT !== "OPTION" && a.NTEXT !== "LOW" && a.NTEXT !== "HIGH"; });
        if (l_indx === -1) { return true; }
    }

    // String table 여부(원본 lf_chkStringTable) — CARDI ST, 루트 아님, EXP_TYP STR_TAB.
    function _lf_chkStringTable(is_tree) {
        if (oAPP.attr.oBindDialog._CARDI !== "ST") { return; }
        if (is_tree.KIND !== "T") { return; }
        if (is_tree.PARENT === "Attribute") { return; }
        if (is_tree.EXP_TYP === "STR_TAB") { return true; }
    }

})();
