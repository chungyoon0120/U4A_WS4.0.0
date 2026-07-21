/****************************************************************************
 * Binding Popup(대형 별창) 동일속성 매칭 — HTML5 (SPEC §5.3)
 * --------------------------------------------------------------------------
 *  원본: synchronizionArea/getSameAttrList.js(module.exports) 1:1 이식.
 *  ★ 매칭 기준 = UIATT(속성명) + UIADT(데이터타입) 동일. UILIB(컨트롤 클래스)는 표시용일 뿐
 *    후보 판정에 관여하지 않는다(SPEC §5.3 강조 — "동일 컨트롤 타입" 전제 금지).
 *  ★ 자기 제외 = OBJID+UIATT+UIATY 모두 동일. SelectOption2/3 value 특수처리(EXT00001161/2507).
 *  ★ isTablePath = KIND_PATH 마지막 KIND 제거 후 "T" 포함 여부 → 테이블 파생이면 같은 N-바인딩
 *    부모 UI 아래로 스코프 한정(무관 테이블 행 배제).
 *  데이터 어댑트: 원본 oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN → HTML5 oAPP.attr.designTree,
 *               oAPP.attr.oModel.oData.zTREE → oAPP.attr.modelTree.
 *  ★ CJS(module.exports) 아님 — 별창 CommonJS require 미지원이라 oAPP.fn 전역 노출로 이식.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    // 후보 행 구조(원본 TY_LIST).
    function _newList() {
        return { OBJID: "", UIATT: "", UIATK: "", UIATV: "", UILIB: "", UIOBK: "", POBID: "", PUIOK: "" };
    }

    // SelectOption2/3 의 value 프로퍼티 UIATK(원본 C_SEL_OPT_VALUE).
    var C_SEL_OPT_VALUE = ["EXT00001161", "EXT00002507"];

    // table 파생 여부(원본 isTablePath) — KIND_PATH 마지막 KIND 제거 후 "T" 포함.
    function _isTablePath(KIND_PATH) {
        if (typeof KIND_PATH === "undefined") { return false; }
        var _parentPath = KIND_PATH.slice(0, KIND_PATH.length - 2);
        return _parentPath.indexOf("T") !== -1;
    }

    // 동일 속성 리스트 재귀 구성(원본 setSameAttrList 1:1).
    function _setSameAttrList(aTree, is_attr, aList, oUi) {
        if (typeof aTree === "undefined" || aTree.length === 0) { return; }

        for (var i = 0; i < aTree.length; i++) {
            var _sTree = aTree[i];

            // N건 바인딩된 부모 UI 스코프가 지정된 경우.
            if (typeof oUi !== "undefined") {
                if (_sTree.OBJID === oUi._OBJID) { _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, aList, oUi); continue; }
                if (oUi._UILIB === "sap.ui.table.TreeTable" && _sTree.UILIB === "sap.ui.table.Column") { _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, aList, oUi); continue; }
                if (oUi._UILIB === "sap.ui.table.Table" && _sTree.UILIB === "sap.ui.table.Column") { _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, aList, oUi); continue; }
                var _oUiParent = oAPP.fn.getParentUi(oAPP.attr.prev[_sTree.OBJID]);
                if (typeof _oUiParent === "undefined") { continue; }
                if (oUi._OBJID !== _oUiParent._OBJID) { continue; }   // 부모가 다르면 SKIP.
            }

            // 리프(DATYP 02) 아니면 하위 재귀.
            if (_sTree.DATYP !== "02") { _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, aList, oUi); continue; }

            // 자기 자신 제외(OBJID+UIATT+UIATY).
            if (_sTree.OBJID === is_attr.OBJID && _sTree.UIATT === is_attr.UIATT && _sTree.UIATY === is_attr.UIATY) { continue; }

            // value 프로퍼티 SelectOption 특수처리.
            if (is_attr.UIATT === "value") {
                switch (is_attr.UIOBK) {
                    case "UO99992": case "UO99984":   // SelectOption2/3 → value 는 SelectOption value 만.
                        if (C_SEL_OPT_VALUE.indexOf(_sTree.UIATK) === -1) { continue; }
                        break;
                    default:                           // 그 외 → SelectOption value 제외.
                        if (C_SEL_OPT_VALUE.indexOf(_sTree.UIATK) !== -1) { continue; }
                        break;
                }
            }

            // ★ 핵심 매치: 속성명 + 데이터타입 동일.
            if (_sTree.UIATT === is_attr.UIATT && is_attr.UIADT === _sTree.UIADT) {
                var _sList = _newList();
                _sList.OBJID = _sTree.OBJID; _sList.UIATT = _sTree.UIATT; _sList.UIATK = _sTree.UIATK;
                _sList.UIATV = _sTree.UIATV; _sList.UILIB = _sTree.UILIB; _sList.UIOBK = _sTree.UIOBK;
                _sList.POBID = _sTree.POBID; _sList.PUIOK = _sTree.PUIOK;
                aList.push(_sList);
            }

            _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, aList, oUi);
        }
    }

    /************************************************************************
     * [PUBLIC] 동일속성 후보 목록 — 원본 getSameAttrList(module.exports) 1:1.
     ************************************************************************/
    oAPP.fn.getSameAttrList = function (is_attr) {
        var _aList = [];

        var _sField = oAPP.fn.getModelBindData(is_attr.UIATV, oAPP.attr.modelTree);
        if (typeof _sField === "undefined") { return _aList; }

        var _aTREE_DESIGN = oAPP.attr.designTree || [];

        // 테이블 파생이 아니면 전체 스캔.
        if (_isTablePath(_sField.KIND_PATH) !== true) {
            _setSameAttrList(_aTREE_DESIGN, is_attr, _aList);
            return _aList;
        }

        // 테이블 파생 → 같은 N-바인딩 부모 UI 아래로 스코프 한정.
        var _oUi = oAPP.fn.getParentUi(oAPP.attr.prev[is_attr.OBJID]);
        if (typeof _oUi === "undefined") {
            _setSameAttrList(_aTREE_DESIGN, is_attr, _aList);
            return _aList;
        }

        var _sTree = oAPP.fn.getDesignTreeData(_oUi._OBJID);
        if (typeof _sTree === "undefined") { return _aList; }
        _setSameAttrList(_sTree.zTREE_DESIGN, is_attr, _aList, _oUi);

        return _aList;
    };

})();
