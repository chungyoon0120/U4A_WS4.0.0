/************************************************************************
 * ws_html5_usp_tree.js  (HTML5)  — WS30 USP 소스 트리
 * ----------------------------------------------------------------------
 * 구 sap.ui.table.TreeTable("usptree") → 재귀 <ul>/<li> HTML5 트리.
 *  - 데이터: /WS30/USPTREE (중첩 OBJKY/PUJKY/USPTREE) — ws_html5_usp.js 가 채움.
 *  - 아이콘: ISFLD/EXTEN → APP.getAppPath()/svg/*.svg (Node FS) — 원본 formatter 1:1.
 *  - 선택: .selected 하이라이트(구 RowSettings highlight + 직접 CSS).
 *  - 펼침/접힘: 노드 트위스티 + expand-all/collapse-all (구 collapseAll/expandToLevel).
 *  - 단일 클릭: oAPP.fn.fnUspTreeTableRowSelect(node) (ws_html5_usp.js) — WS20 fnWs20TreeSelectRow 와
 *    동일 UX(클릭=선택+우측 페이지/Monaco 연동). 토글(셰브론)만 펼침/접힘(stopPropagation).
 *
 *  ws_html5_usp.js 보다 뒤에 로드(트리 렌더 함수 정의). 1차 보류: 우클릭 컨텍스트메뉴(CRUD).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};
    oAPP.usphtml = oAPP.usphtml || {};

    var FS, PATH, APP;
    try { FS = parent.FS; PATH = parent.PATH; APP = parent.APP; } catch (e) { }

    function _fa(s) { return (oAPP.usphtml._fa ? oAPP.usphtml._fa(s) : '<i class="fa-solid fa-' + s + '"></i>'); }
    function _esc(s) { return (oAPP.usphtml._esc ? oAPP.usphtml._esc(s) : String(s == null ? "" : s)); }

    // 펼친 노드 OBJKY 집합 (기본: 루트만 펼침 — 구 numberOfExpandedLevels:1)
    var _expanded = {};

    // SVG 파일 목록(확장자 아이콘 해석용) — 구 gaFileExtendImgList. 1회 로드.
    var _svgList = null;
    var _svgFolder = "";
    function _ensureSvgList() {
        if (_svgList !== null) { return; }
        _svgList = [];
        try {
            _svgFolder = PATH.join(APP.getAppPath(), "svg");
            _svgList = FS.readdirSync(_svgFolder) || [];
        } catch (e) {
            console.error("[HTML5][WS30] svg 목록 로드 오류:", e);
            _svgList = [];
        }
    }

    // 구 트리 Name 컬럼 아이콘 formatter(ISFLD/EXTEN) 1:1 이식
    function _iconSrc(ISFLD, EXTEN) {
        _ensureSvgList();
        if (!_svgFolder) { return ""; }
        if (ISFLD === "X") { return _svgFolder + "/folder.svg"; }
        if (!EXTEN) { return _svgFolder + "/file.svg"; }
        var sLow = String(EXTEN).toLowerCase();
        var sFind = _svgList.find(function (elem) { return elem.indexOf(sLow) === 0; });
        if (!sFind) { return _svgFolder + "/file.svg"; }
        return _svgFolder + "/" + sFind;
    }

    function _hasChildren(o) { return o && Array.isArray(o.USPTREE) && o.USPTREE.length > 0; }

    /************************************************************************
     * 트리 렌더 (구 fnGetUspTreeTableWs30 + rows binding)
     ************************************************************************/
    oAPP.fn.fnRenderUspTree = function () {

        var BODY = document.getElementById("uspTreeBody");
        if (!BODY) { return; }

        var aTree = [];
        try { aTree = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
        if (!Array.isArray(aTree)) { aTree = []; }

        // 최초 렌더 시 루트들 기본 펼침(구 numberOfExpandedLevels:1)
        if (!oAPP.attr.uspTreeInited) {
            aTree.forEach(function (o) { if (o && o.OBJKY != null) { _expanded[o.OBJKY] = true; } });
            oAPP.attr.uspTreeInited = true;
        }

        BODY.innerHTML = "";
        var UL = document.createElement("ul");
        // 공통 트리 컴포넌트(shell.css .u4a-tree) 소비 — WS20 와 동일 UX(hover/선택/셰브론 회전).
        UL.className = "u4a-tree u4aWs30Tree";
        aTree.forEach(function (o) { UL.appendChild(_renderNode(o, 0)); });
        BODY.appendChild(UL);
    };

    function _renderNode(oNode, iLevel) {

        var LI = document.createElement("li");
        LI.className = "u4aWs30TreeNode";
        LI.setAttribute("data-objky", oNode.OBJKY == null ? "" : oNode.OBJKY);

        var bHasChild = _hasChildren(oNode);
        var bOpen = !!_expanded[oNode.OBJKY];

        // 행(row) — 공통 컴포넌트(.u4a-tree__row). 들여쓰기는 --ws30-depth(CSS padding 계산),
        //   셰브론 회전은 aria-expanded, 선택 강조는 aria-selected (WS20 와 동일 규칙).
        var ROW = document.createElement("div");
        ROW.className = "u4a-tree__row u4aWs30TreeRow";
        ROW.setAttribute("role", "treeitem");
        ROW.setAttribute("data-objky", oNode.OBJKY == null ? "" : oNode.OBJKY);
        ROW.style.setProperty("--ws30-depth", iLevel);
        if (bHasChild) { ROW.setAttribute("aria-expanded", bOpen ? "true" : "false"); }
        if (oNode.ISSEL) { ROW.setAttribute("aria-selected", "true"); }

        // 펼침/접기 토글 (자식 있을 때만; 회전은 aria-expanded 가 제어 → chevron-right 고정)
        var TOG = document.createElement("span");
        TOG.className = "u4a-tree__toggle" + (bHasChild ? "" : " u4a-tree__toggle--leaf");
        TOG.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        if (bHasChild) {
            TOG.addEventListener("click", function (e) {
                e.stopPropagation();   // 토글은 선택/열기와 분리(WS20 동일)
                _expanded[oNode.OBJKY] = !_expanded[oNode.OBJKY];
                oAPP.fn.fnRenderUspTree();
            });
        }
        ROW.appendChild(TOG);

        // 아이콘 (SVG img — ISFLD/EXTEN)
        var ICON = document.createElement("span");
        ICON.className = "u4a-tree__icon u4aWs30TreeIcon";
        var sSrc = _iconSrc(oNode.ISFLD, oNode.EXTEN);
        if (sSrc) {
            var IMG = document.createElement("img");
            IMG.src = sSrc;
            IMG.alt = "";
            IMG.onerror = function () { this.style.display = "none"; };
            ICON.appendChild(IMG);
        }
        ROW.appendChild(ICON);

        // 이름 (Name 컬럼) — 길면 말줄임
        var NAME = document.createElement("span");
        NAME.className = "u4a-tree__label u4aWs30TreeName";
        NAME.textContent = oNode.OBDEC == null ? "" : oNode.OBDEC;
        ROW.appendChild(NAME);

        // 설명 (Description 컬럼) — 우측 정렬
        var DESC = document.createElement("span");
        DESC.className = "u4aWs30TreeDesc";
        DESC.textContent = oNode.DESCT == null ? "" : oNode.DESCT;
        ROW.appendChild(DESC);

        // 단일 클릭 = 열기(우측 페이지 + Monaco 연동) — WS20 fnWs20TreeSelectRow 와 동일 UX.
        ROW.addEventListener("click", function () {
            try { oAPP.fn.fnUspTreeTableRowSelect(oNode); }
            catch (e) { console.error("[HTML5][WS30] tree click open error:", e); }
        });

        LI.appendChild(ROW);

        // 자식 — 항상 렌더 후 펼침상태로 표시/숨김(셰브론 회전 애니메이션 유지)
        if (bHasChild) {
            var CUL = document.createElement("ul");
            CUL.className = "u4aWs30TreeChildren";
            CUL.hidden = !bOpen;
            oNode.USPTREE.forEach(function (c) { CUL.appendChild(_renderNode(c, iLevel + 1)); });
            LI.appendChild(CUL);
        }

        return LI;
    }

    /************************************************************************
     * 선택 표시 (구 _fnUspTreeSelectedRowMark + setSelectedIndex) — DOM 하이라이트.
     ************************************************************************/
    oAPP.fn.fnUspTreeMarkSelected = function (oNode) {
        var BODY = document.getElementById("uspTreeBody");
        if (!BODY) { return; }

        // 모델 ISSEL 플래그 갱신(현재 노드만 true)
        _walkTree(function (o) { o.ISSEL = false; });
        if (oNode) { oNode.ISSEL = true; }

        // DOM aria-selected 갱신 (공통 컴포넌트 규칙 — WS20 동일)
        var aRows = BODY.querySelectorAll('.u4aWs30TreeRow[aria-selected="true"]');
        for (var i = 0; i < aRows.length; i++) { aRows[i].removeAttribute("aria-selected"); }

        if (oNode && oNode.OBJKY != null) {
            var ROW = BODY.querySelector('.u4aWs30TreeRow[data-objky="' + _cssEsc(String(oNode.OBJKY)) + '"]');
            if (ROW) {
                ROW.setAttribute("aria-selected", "true");
                try { ROW.scrollIntoView({ block: "nearest" }); } catch (e) { }
            }
        }
    };

    // 구 fnOnUspTreeUnSelect — 모든 노드 선택 해제(override; 셸 _fnLineSelectCb 가 호출)
    oAPP.fn.fnOnUspTreeUnSelect = function () {
        _walkTree(function (o) { o.ISSEL = false; });
        var BODY = document.getElementById("uspTreeBody");
        if (!BODY) { return; }
        var aRows = BODY.querySelectorAll('.u4aWs30TreeRow[aria-selected="true"]');
        for (var i = 0; i < aRows.length; i++) { aRows[i].removeAttribute("aria-selected"); }
    };

    /************************************************************************
     * 전체 펼침/접힘 (구 fnCommonUspTreeTableExpand / Collapse, expandAll/collapseAll)
     ************************************************************************/
    oAPP.fn.fnUspTreeExpandAll = function () {
        _walkTree(function (o) { if (_hasChildren(o)) { _expanded[o.OBJKY] = true; } });
        oAPP.fn.fnRenderUspTree();
    };
    oAPP.fn.fnUspTreeCollapseAll = function () {
        _expanded = {};
        oAPP.fn.fnRenderUspTree();
    };

    // CSS 속성 선택자용 escape (OBJKY 에 특수문자 대비)
    function _cssEsc(s) {
        if (window.CSS && CSS.escape) { return CSS.escape(s); }
        return String(s).replace(/["\\\]\[]/g, "\\$&");
    }

    // 트리 전체 순회 콜백
    function _walkTree(fn) {
        var aTree = [];
        try { aTree = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
        (function rec(aNodes) {
            if (!Array.isArray(aNodes)) { return; }
            aNodes.forEach(function (o) {
                if (!o) { return; }
                fn(o);
                if (Array.isArray(o.USPTREE)) { rec(o.USPTREE); }
            });
        })(aTree);
    }

})(window, jQuery, oAPP);
