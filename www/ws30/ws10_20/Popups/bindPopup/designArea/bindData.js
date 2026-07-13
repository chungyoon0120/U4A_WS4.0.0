/****************************************************************************
 * Binding Popup(대형 별창) — 바인딩 데이터 레이어 (bindData.js) — HTML5
 * --------------------------------------------------------------------------
 *  원본 index.js/designTree.js 의 "순수 데이터 함수"(UI5 컨트롤 미참조) 이식.
 *  드롭 검증(checkValidBind)·바인딩 쓰기(attrSetBindProp)·미리보기 캐시(prev)의 토대.
 *
 *  ★ 접근자만 HTML5 로 어댑트(나머지 로직 1:1):
 *    · 원본 oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN → oAPP.attr.designTree
 *    · 원본 oAPP.attr.oDesign.oModel.oData.TREE_DESIGN  → oAPP.attr.designFlat
 *    · 모델필드 트리는 호출측이 aTree(=oAPP.attr.modelTree) 를 넘겨준다.
 *  ★ prev[OBJID] = { _UILIB, _T_0015, _MODEL, _BIND_AGGR, _OBJID, __PARENT?, _EMBED_AGGR? }
 *    = 원본 _setPrevData 산출물. setDesignTreeData 가 T_0014 순회하며 _bwpSetPrevData 로 구성한다.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn) { return; }

    /* ── 경로/파생 판정 ─────────────────────────────────────────────────── */

    // 부모 path 로부터 파생된 child path 여부(원본 chkBindPath 1:1).
    oAPP.fn.chkBindPath = function (parent, child) {
        if (typeof parent === "undefined" || parent === "") { return; }
        if (typeof child === "undefined" || child === "") { return; }
        var l_sp1 = parent.split("-");
        var l_sp2 = child.split("-");
        l_sp2.splice(l_sp1.length);
        if (parent === l_sp2.join("-")) { return true; }
    };

    // KIND_PATH(S-S-T-T-E) 가 table 로부터 파생된 필드인지(원본 _isTablePath 1:1).
    oAPP.fn._isTablePath = function (KIND_PATH) {
        if (typeof KIND_PATH === "undefined") { return false; }
        var _parentPath = KIND_PATH.slice(0, KIND_PATH.length - 2);
        if (_parentPath.indexOf("T") !== -1) { return true; }
        return false;
    };

    /* ── prev 캐시 구성용 매핑 ────────────────────────────────────────────── */

    // Aggregation 에 N건 모델 바인딩 처리 시 모델정보 UI 에 매핑(원본 setAggrBind 1:1).
    oAPP.fn.setAggrBind = function (oUI) {
        if (typeof (oUI && oUI._T_0015) === "undefined") { return; }
        if (oUI._T_0015.length === 0) { return; }
        var lt_0015 = oUI._T_0015.filter(function (a) { return a.UIATY === "3" && a.ISBND === "X" && a.UIATV !== ""; });
        if (lt_0015.length === 0) { return; }
        for (var i = 0, l = lt_0015.length; i < l; i++) {
            oUI._MODEL[lt_0015[i].UIATT] = lt_0015[i].UIATV;
        }
    };

    // UI 에 바인딩 처리된 경우 부모 UI 에 해당 정보 매핑(원본 setModelBind 1:1).
    oAPP.fn.setModelBind = function (oUi) {
        function lf_getParentAggrModel(UIATV, EMBED_AGGR, parent) {
            if (!parent) { return; }
            if (!parent._MODEL[EMBED_AGGR]) {
                var l_name = parent._UILIB;
                if (l_name === "sap.ui.table.Column") {
                    if (!parent.__PARENT._MODEL["coloums"]) {
                        return lf_getParentAggrModel(UIATV, "rows", parent.__PARENT);
                    }
                }
                if (l_name === "sap.ui.table.RowAction" && !parent._MODEL["items"]) {
                    return lf_getParentAggrModel(UIATV, "rows", parent.__PARENT);
                }
                if ((l_name === "sap.ui.table.Table" || l_name === "sap.ui.table.TreeTable") &&
                    (EMBED_AGGR === "rowActionTemplate" || EMBED_AGGR === "rowSettingsTemplate")) {
                    return lf_getParentAggrModel(UIATV, "rows", parent);
                }
                return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
            }
            if (oAPP.fn.chkBindPath(parent._MODEL[EMBED_AGGR], UIATV) !== true) {
                return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
            }
            if (!parent._BIND_AGGR[EMBED_AGGR]) { parent._BIND_AGGR[EMBED_AGGR] = []; }
            if (parent._BIND_AGGR[EMBED_AGGR].findIndex(function (a) { return a === oUi; }) !== -1) { return true; }
            parent._BIND_AGGR[EMBED_AGGR].push(oUi);
            return true;
        }
        var lt_0015 = oUi._T_0015.filter(function (a) { return a.ISBND === "X" && a.UIATV !== ""; });
        if (lt_0015.length === 0) { return; }
        for (var i = 0, l = lt_0015.length; i < l; i++) {
            if (lf_getParentAggrModel(lt_0015[i].UIATV, oUi._EMBED_AGGR, oUi.__PARENT) === true) { return; }
        }
    };

    // 대상 UI 로부터 부모를 탐색하며 N건 바인딩 값 얻기(원본 getParentAggrBind 1:1).
    oAPP.fn.getParentAggrBind = function (oUI, UIATT) {
        if (!oUI) { return; }
        if (!oUI._MODEL[UIATT]) {
            if (oUI._UILIB === "sap.ui.table.Column" && typeof oUI.__PARENT !== "undefined" && UIATT === "template") {
                if (oUI.__PARENT._UILIB === "sap.ui.table.Table" || oUI.__PARENT._UILIB === "sap.ui.table.TreeTable") {
                    if (typeof oUI.__PARENT._MODEL["columns"] === "undefined") {
                        return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");
                    }
                }
            }
            if (oUI._UILIB === "sap.ui.table.RowAction" || oUI._UILIB === "sap.ui.table.RowSettings") {
                if (oUI.__PARENT._UILIB === "sap.ui.table.Table" || oUI.__PARENT._UILIB === "sap.ui.table.TreeTable") {
                    return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");
                }
            }
            return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);
        }
        if (oUI._MODEL[UIATT] !== "") { return oUI._MODEL[UIATT]; }
        return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);
    };

    // 대상 UI 로부터 부모를 탐색하며 N건 바인딩한 UI 얻기(원본 getParentUi 1:1).
    oAPP.fn.getParentUi = function (oUI, UIATT) {
        if (!oUI) { return; }
        if (!oUI._MODEL[UIATT]) {
            if (oUI._UILIB === "sap.ui.table.Column" && typeof oUI.__PARENT !== "undefined" && UIATT === "template") {
                if (oUI.__PARENT._UILIB === "sap.ui.table.Table" || oUI.__PARENT._UILIB === "sap.ui.table.TreeTable") {
                    if (typeof oUI.__PARENT._MODEL["columns"] === "undefined") {
                        return oAPP.fn.getParentUi(oUI.__PARENT, "rows");
                    }
                }
            }
            if (oUI._UILIB === "sap.ui.table.RowAction" || oUI._UILIB === "sap.ui.table.RowSettings") {
                if (oUI.__PARENT._UILIB === "sap.ui.table.Table" || oUI.__PARENT._UILIB === "sap.ui.table.TreeTable") {
                    return oAPP.fn.getParentUi(oUI.__PARENT, "rows");
                }
            }
            return oAPP.fn.getParentUi(oUI.__PARENT, oUI._EMBED_AGGR);
        }
        if (oUI._MODEL[UIATT] !== "") { return oUI; }
        return oAPP.fn.getParentUi(oUI.__PARENT, oUI._EMBED_AGGR);
    };

    // 대상 UI 로부터 자식을 탐색하며 동일 바인딩 존재 여부(원본 getChildAggrBind 1:1).
    oAPP.fn.getChildAggrBind = function (OBJID, BINDFIELD) {
        var _aChild = (oAPP.attr.T_0014 || []).filter(function (item) { return item.POBID === OBJID; });
        if (_aChild.length === 0) { return; }
        for (var i = 0; i < _aChild.length; i++) {
            var sChild = _aChild[i];
            var oPrev = oAPP.attr.prev[sChild.OBJID];
            if (!oPrev) { continue; }
            for (var key in oPrev._MODEL) {
                if (oPrev._MODEL[key] === BINDFIELD) { return true; }
            }
            if (typeof oPrev._T_0015 !== "undefined") {
                var _found = oPrev._T_0015.findIndex(function (item) {
                    return item.ISBND === "X" && item.UIATY === "3" && String(item.UIATV).startsWith(BINDFIELD) === true;
                });
                if (_found !== -1) { return true; }
            }
            var _foundChild = oAPP.fn.getChildAggrBind(sChild.OBJID, BINDFIELD);
            if (_foundChild === true) { return _foundChild; }
        }
    };

    /* ── 트리 조회(HTML5 접근자 어댑트: designTree / modelTree) ───────────── */

    // 디자인 트리(중첩)에서 OBJID(UI 오브젝트 행) 검색(원본 getDesignTreeData — zTREE_DESIGN → designTree).
    oAPP.fn.getDesignTreeData = function (OBJID, is_tree) {
        if (typeof is_tree === "undefined") { is_tree = (oAPP.attr.designTree || [])[0]; }
        if (!is_tree) { return; }
        if (is_tree.OBJID === OBJID && is_tree.DATYP === "01") { return is_tree; }
        if (!is_tree.zTREE_DESIGN || is_tree.zTREE_DESIGN.length === 0) { return; }
        for (var i = 0, l = is_tree.zTREE_DESIGN.length; i < l; i++) {
            var ls_tree = oAPP.fn.getDesignTreeData(OBJID, is_tree.zTREE_DESIGN[i]);
            if (typeof ls_tree !== "undefined") { return ls_tree; }
        }
    };

    // 디자인 트리에서 OBJID+UIATK(속성 리프) 검색(원본 getDesignTreeAttrData — 어댑트).
    oAPP.fn.getDesignTreeAttrData = function (OBJID, UIATK, is_tree) {
        if (typeof is_tree === "undefined") { is_tree = (oAPP.attr.designTree || [])[0]; }
        if (!is_tree) { return; }
        if (is_tree.OBJID === OBJID && is_tree.UIATK === UIATK && is_tree.DATYP === "02") { return is_tree; }
        if (!is_tree.zTREE_DESIGN || is_tree.zTREE_DESIGN.length === 0) { return; }
        for (var i = 0, l = is_tree.zTREE_DESIGN.length; i < l; i++) {
            var ls_tree = oAPP.fn.getDesignTreeAttrData(OBJID, UIATK, is_tree.zTREE_DESIGN[i]);
            if (typeof ls_tree !== "undefined") { return ls_tree; }
        }
    };

    // 모델필드 트리(중첩)에서 CHILD 검색(원본 getModelBindData 1:1 — 호출측이 aTree 제공).
    oAPP.fn.getModelBindData = function (CHILD, aTree) {
        if (typeof aTree === "undefined") { return; }
        for (var i = 0, l = aTree.length; i < l; i++) {
            var _sTree = aTree[i];
            if (_sTree.CHILD === CHILD) { return _sTree; }
            var _sFound = oAPP.fn.getModelBindData(CHILD, _sTree.zTREE);
            if (typeof _sFound !== "undefined") { return _sFound; }
        }
    };

    /* ── 바인딩 제외 목록(원본 CT_BIND_EXCEPT 1:1) ────────────────────────── */
    oAPP.attr.CT_BIND_EXCEPT = [
        { ITMCD: "", FLD01: "EXT00000030" },   // appcontainer AppID
        { ITMCD: "", FLD01: "EXT00000031" },   // appcontainer AppDescript
        { ITMCD: "", FLD01: "EXT00000032" },   // appcontainer height
        { ITMCD: "", FLD01: "EXT00000033" },   // appcontainer width
        { ITMCD: "", FLD01: "EXT00001188" },   // selectOption2 F4HelpID
        { ITMCD: "", FLD01: "EXT00001189" },   // selectOption2 F4HelpReturnField
        { ITMCD: "", FLD01: "EXT00002534" },   // selectOption3 F4HelpID
        { ITMCD: "", FLD01: "EXT00002535" },   // selectOption3 F4HelpReturnField
        { ITMCD: "", FLD01: "EXT00001347" },   // sap.ui.table.Table autoGrowing
        { ITMCD: "", FLD01: "EXT00001348" },   // sap.m.Table autoGrowing
        { ITMCD: "", FLD01: "EXT00001349" },   // sap.m.List autoGrowing
        { ITMCD: "", FLD01: "EXT00002374" },   // sap.m.Page useBackToTopButton
        { ITMCD: "", FLD01: "EXT00002378" },   // sap.uxap.ObjectPageLayout useBackToTopButton
        { ITMCD: "", FLD01: "EXT00002379" }    // sap.f.DynamicPage
    ];

    // 하위 UI 에 단축키 등록건 존재 여부(원본 attrGetShortcutEvent 1:1).
    oAPP.fn.attrGetShortcutEvent = function (OBJID) {
        var _aChild = (oAPP.attr.T_0014 || []).filter(function (item) { return item.POBID === OBJID; });
        if (_aChild.length === 0) { return; }
        for (var i = 0; i < _aChild.length; i++) {
            var _sChild = _aChild[i];
            var oPrev = oAPP.attr.prev[_sChild.OBJID];
            var _found = (oPrev && oPrev._T_0015)
                ? oPrev._T_0015.findIndex(function (item) { return item.UIATY === "2" && item.SHCUT && Object.keys(item.SHCUT).length > 0; })
                : -1;
            if (_found !== -1) { return true; }
            var _foundChild = oAPP.fn.attrGetShortcutEvent(_sChild.OBJID);
            if (_foundChild === true) { return _foundChild; }
        }
    };

    // aggregation 바인딩 가능 여부(원본 attrChkBindAggrPossible — TREE_DESIGN → designFlat).
    oAPP.fn.attrChkBindAggrPossible = function (is_attr) {
        if (typeof (is_attr && is_attr.OBJID) === "undefined" || (is_attr && is_attr.OBJID) === "") { return true; }
        if (typeof (is_attr && is_attr.UIATK) === "undefined" || (is_attr && is_attr.UIATK) === "") { return true; }
        var _aChild = (oAPP.attr.designFlat || []).filter(function (item) { return item.DATYP === "01" && item.S_14_POBID === is_attr.OBJID; });
        if (_aChild.length === 0) { return false; }
        var _afilter = _aChild.filter(function (a) { return a.S_14_UIATK === is_attr.UIATK; });
        if (_afilter.length >= 2) { return true; }
        return false;
    };

    /* ── 드롭 가능 플래그(원본 setDropFlag/resetDropFlag 1:1 — 디자인트리 노드에 _drop_enable) ── */
    // 드래그한 필드(sField) 기준으로 디자인트리를 재귀하며 각 리프의 drop 가능 여부 세팅.
    oAPP.fn._bwpSetDropFlag = function (aTree, sField) {
        if (typeof aTree === "undefined") { return; }
        for (var i = 0, l = aTree.length; i < l; i++) {
            var _sTree = aTree[i];
            oAPP.fn._bwpSetDropFlag(_sTree.zTREE_DESIGN, sField);
            var _sRes = oAPP.fn.checkValidBind(_sTree, sField);
            if (_sRes.RETCD === "E") { continue; }
            _sTree._drop_enable = true;
        }
    };
    oAPP.fn._bwpResetDropFlag = function (aTree) {
        if (typeof aTree === "undefined") { return; }
        for (var i = 0, l = aTree.length; i < l; i++) {
            aTree[i]._drop_enable = false;
            oAPP.fn._bwpResetDropFlag(aTree[i].zTREE_DESIGN);
        }
    };

    /* ── 드롭 가능 여부 검증(원본 designTree.js checkValidBind 1:1) ─────────────
     *   sTree = 드롭 위치(디자인트리 리프 노드), sField = 드래그한 모델필드.
     *   반환 {RETCD:""|"E", MSGID, MSGNO}. 접근자 어댑트: oModel.oData.TREE → modelFlat.
     * ------------------------------------------------------------------------ */
    oAPP.fn.checkValidBind = function (sTree, sField) {
        var _sRes = { RETCD: "", MSGID: "", MSGNO: "" };

        if (sTree.DATYP !== "02") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "111"; return _sRes; }
        if (oAPP.attr.CT_BIND_EXCEPT.findIndex(function (item) { return item.FLD01 === sTree.UIATK; }) !== -1) {
            _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "112"; return _sRes;
        }
        if (sField.KIND === "" || sField.KIND === "S") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "113"; return _sRes; }
        if (sTree.UIATY === "3" && sField.KIND !== "T") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "114"; return _sRes; }
        if (typeof sField.KIND_PATH === "undefined") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "115"; return _sRes; }

        var l_path = oAPP.fn.getParentAggrBind(oAPP.attr.prev[sTree.OBJID]);
        var l_isTree = false;

        if (sTree.UIATK === "EXT00001190" || sTree.UIATK === "EXT00001191") {
            l_path = oAPP.attr.prev[sTree.OBJID]._MODEL["items"]; l_isTree = true;
        } else if (sTree.UIATK === "EXT00001192" || sTree.UIATK === "EXT00001193") {
            l_path = oAPP.attr.prev[sTree.OBJID]._MODEL["rows"]; l_isTree = true;
        } else if (sTree.UIATK === "EXT00002382" && oAPP.attr.prev[sTree.OBJID].__PARENT) {
            l_path = oAPP.attr.prev[sTree.OBJID].__PARENT._MODEL["rows"]; l_isTree = true;
        } else if (sTree.PUIATK === "AT000022249" || sTree.PUIATK === "AT000022258" ||
            sTree.PUIATK === "AT000013070" || sTree.PUIATK === "AT000013148") {
            l_path = oAPP.attr.prev[sTree.POBID]._MODEL["rows"]; l_isTree = true;
        } else if (sTree.PUIATK === "AT000013013") {
            if (!oAPP.attr.prev[sTree.POBID]._MODEL["items"]) {
                var ls_parent = oAPP.fn.getDesignTreeData(sTree.POBID);
                if (ls_parent && (ls_parent.UIOBK === "UO01139" || ls_parent.UIOBK === "UO01142")) {
                    l_path = oAPP.attr.prev[ls_parent.POBID]._MODEL["rows"];
                }
            }
        }

        if (l_isTree && !l_path) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "116"; return _sRes; }

        var lt_split1, lt_split2;
        if (oAPP.fn._isTablePath(sField.KIND_PATH) === true) {
            if (typeof l_path === "undefined" || l_path === "" || l_path === null) {
                _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "117"; return _sRes;
            }
            if (l_path !== sField.CHILD.substr(0, l_path.length)) {
                _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "118"; return _sRes;
            }
            lt_split1 = l_path.split("-");
            lt_split2 = sField.KIND_PATH.split("-");
            lt_split2.splice(0, lt_split1.length);
        }

        if (sTree.UIATY === "1") {
            if (sTree.UIATK === "EXT00001161" || sTree.UIATK === "EXT00002507") {
                if (sField.EXP_TYP !== "RANGE_TAB") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "119"; return _sRes; }
                if (typeof lt_split2 !== "undefined") {
                    lt_split2.splice(lt_split2.length - 1, 1);
                    if (lt_split2.findIndex(function (a) { return a === "T"; }) !== -1) {
                        _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "119"; return _sRes;
                    }
                }
                return _sRes;
            }
            if (sTree.ISMLB === "X" && (sTree.UIADT !== "int" && sTree.UIADT !== "float")) {
                if (sField.EXP_TYP !== "STR_TAB") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "120"; return _sRes; }
                if (sField.EXP_TYP === "STR_TAB" && sField.PARENT === "Attribute") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "115"; return _sRes; }
                if (typeof lt_split2 !== "undefined") {
                    lt_split2.splice(lt_split2.length - 1, 1);
                    if (lt_split2.findIndex(function (a) { return a === "T"; }) !== -1) {
                        _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "120"; return _sRes;
                    }
                }
                return _sRes;
            }
            if (sField.KIND !== "E") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "121"; return _sRes; }
            if (typeof lt_split2 !== "undefined" && lt_split2.findIndex(function (a) { return a === "T"; }) !== -1) {
                _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "118"; return _sRes;
            }
            if (l_isTree && l_path && l_path !== sField.CHILD.substr(0, l_path.length)) {
                _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "118"; return _sRes;
            }
            return _sRes;
        }

        if (sTree.UIATY === "3" && sTree.ISMLB !== "X") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "122"; return _sRes; }
        if (sTree.UIATY === "3" && sField.EXP_TYP === "STR_TAB") { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "123"; return _sRes; }

        if (sTree.UIATY === "3" && sField.KIND === "T") {
            var aReg = (oAPP.attr.oUserInfo && oAPP.attr.oUserInfo.META && oAPP.attr.oUserInfo.META.T_REG_WLO) || [];
            var _allow = aReg.findIndex(function (item) { return item.REGTYP === "C" && item.CHGOBJ === "UHAK901289"; });
            if (_allow !== -1 && oAPP.fn.attrGetShortcutEvent(sTree.OBJID) === true) {
                _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "486"; return _sRes;
            }
            var _aChild = (oAPP.attr.modelFlat || []).filter(function (item) { return item.PARENT === sField.CHILD; });
            if (_aChild.length === 0) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "124"; return _sRes; }
            if (oAPP.fn.attrChkBindAggrPossible(sTree) === true) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "125"; return _sRes; }
            if (oAPP.fn.getChildAggrBind(sTree.OBJID, sField.CHILD) === true) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "126"; return _sRes; }

            var _parentModel = oAPP.fn.getParentAggrBind(oAPP.attr.prev[sTree.POBID], oAPP.attr.prev[sTree.OBJID]._EMBED_AGGR);
            if (typeof _parentModel !== "undefined") {
                if (_parentModel.startsWith(sField.CHILD) === true) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "127"; return _sRes; }
                if (sField.CHILD !== _parentModel && sField.CHILD.startsWith(_parentModel) === true) {
                    if (oAPP.fn.getChildAggrBind(sTree.OBJID, _parentModel) === true) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "127"; return _sRes; }
                }
            }
            if (typeof lt_split2 !== "undefined") {
                lt_split2.splice(lt_split2.length - 1, 1);
                if (lt_split2.findIndex(function (a) { return a === "T"; }) !== -1) { _sRes.RETCD = "E"; _sRes.MSGID = "ZMSG_WS_COMMON_001"; _sRes.MSGNO = "128"; return _sRes; }
            }
            return _sRes;
        }

        return _sRes;
    };

    /* ── prev 캐시 구성(원본 _setPrevData 1:1) ──────────────────────────────
     *   setDesignTreeData 가 T_0014 를 순회하며(부모→자식 순서) UI 오브젝트마다 호출.
     *   (호출 전 oAPP.attr.prev = {} 로 초기화한다.)
     * ------------------------------------------------------------------------ */
    oAPP.fn._bwpSetPrevData = function (s0014) {
        if (!oAPP.attr.prev) { oAPP.attr.prev = {}; }
        oAPP.attr.prev[s0014.OBJID] = {};
        var _oUi = oAPP.attr.prev[s0014.OBJID];
        _oUi._UILIB = s0014.UILIB;
        _oUi._T_0015 = (oAPP.attr.T_0015 || []).filter(function (item) { return item.OBJID === s0014.OBJID; });
        _oUi._MODEL = {};
        oAPP.fn.setAggrBind(_oUi);
        _oUi._BIND_AGGR = {};
        _oUi._OBJID = s0014.OBJID;
        var ls_embed = _oUi._T_0015.find(function (a) { return a.OBJID === s0014.OBJID && a.UIATY === "6"; });
        if (typeof ls_embed === "undefined") { return; }
        _oUi.__PARENT = oAPP.attr.prev[s0014.POBID];
        _oUi._EMBED_AGGR = ls_embed.UIATT;
        oAPP.fn.setModelBind(_oUi);
    };

})();
