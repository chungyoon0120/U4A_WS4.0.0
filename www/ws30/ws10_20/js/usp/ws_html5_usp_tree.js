/************************************************************************
 * ws_html5_usp_tree.js  (HTML5)  — WS30 USP 소스 트리
 * ----------------------------------------------------------------------
 * 구 sap.ui.table.TreeTable("usptree") → 공통 베이스 트리(U4AUI.createTree) 소비.
 *  ★ UX 통일: ServerList / WS20 디자인트리와 동일한 코어 렌더러(createTree)를 쓴다.
 *    - 마크업/색/들여쓰기(--u4a-tree-depth)/셰브론 회전/hover/선택(aria-selected)은
 *      shell.css 공통 컴포넌트가 단일 출처로 담당. USP 는 아이콘(SVG)·설명(DESC) 슬롯만 확장.
 *  - 데이터: /WS30/USPTREE (중첩 OBJKY/PUJKY/USPTREE) — ws_html5_usp.js 가 채움.
 *  - 아이콘: ISFLD/EXTEN → APP.getAppPath()/svg/*.svg (Node FS) — 원본 formatter 1:1.
 *  - 단일 클릭: oAPP.fn.fnUspTreeTableRowSelect(node) (ws_html5_usp.js). 토글(셰브론)만 펼침/접힘.
 *  - 펼침/접힘: createTree 컨트롤러(expandAll/collapseAll). 기본 루트만 펼침(구 numberOfExpandedLevels:1).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    oAPP.fn = oAPP.fn || {};
    oAPP.usphtml = oAPP.usphtml || {};

    var FS, PATH, APP;
    try { FS = parent.FS; PATH = parent.PATH; APP = parent.APP; } catch (e) { }

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

    function _attrEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
    function _hasChildren(o) { return o && Array.isArray(o.USPTREE) && o.USPTREE.length > 0; }
    function _key(o) { return (o && o.OBJKY != null) ? String(o.OBJKY) : ""; }

    // 공통 베이스 트리 컨트롤러(1회 생성, 이후 .render() 재사용)
    var _tree = null;
    function _ensureTree() {
        if (_tree) { return _tree; }
        if (!(window.U4AUI && U4AUI.createTree)) { return null; }

        _tree = U4AUI.createTree({
            // 대용량 USP 소스 트리 대비 — flat+windowed 렌더(보이는 행만 DOM). 행높이는 usp.css 가 고정(균일).
            virtual: true,
            roots: function () {
                var a = [];
                try { a = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
                return Array.isArray(a) ? a : [];
            },
            children: function (n) { return _hasChildren(n) ? n.USPTREE : []; },
            key: _key,
            label: function (n) { return (n && n.OBDEC != null) ? n.OBDEC : ""; },
            tip: function (n) { return (n && n.OBDEC != null) ? String(n.OBDEC) : ""; },
            icon: function (n) {
                var src = _iconSrc(n.ISFLD, n.EXTEN);
                if (!src) { return ""; }
                return '<img src="' + _attrEsc(src) + '" alt="" onerror="this.style.display=\'none\'">';
            },
            // 설명(Description 컬럼) — 우측 정렬(slotTrailing → 행에 data-u4a-tree-split)
            slotTrailing: function (n) {
                // 셀(구분선 풀하이트) / 텍스트(클램프) 분리 — 셀이 텍스트를 세로 중앙정렬(usp.css).
                var d = document.createElement("span");
                d.className = "u4aWs30TreeDesc";
                var t = document.createElement("span");
                t.className = "u4aWs30TreeDescText";
                var sDesc = (n && n.DESCT != null) ? n.DESCT : "";
                t.textContent = sDesc;
                // 2줄 클램프로 잘릴 때만 hover 툴팁(공통 initTooltip, 세로클램프 인식). 가상스크롤서도 동작
                //   (구 _applyDescTooltips 의 "렌더 후 1회 측정"은 윈도잉서 스크롤-인 행을 놓쳐 hover 방식으로 전환).
                if (sDesc) { t.setAttribute("data-tip", sDesc); t.setAttribute("data-tip-trunc", ""); }
                d.appendChild(t);
                return d;
            },
            // 기본 루트만 펼침(구 numberOfExpandedLevels:1)
            initialExpanded: function (n, lvl) { return lvl < 1; },
            // 단일 클릭 = 열기(우측 페이지 + Monaco 연동) — WS20 fnWs20TreeSelectRow 와 동일 UX.
            onSelect: function (n) {
                try { oAPP.fn.fnUspTreeTableRowSelect(n); }
                catch (e) { console.error("[HTML5][WS30] tree click open error:", e); }
            },
            // WS30 확장 식별/선택표시
            rowHook: function (oRow, n) {
                oRow.classList.add("u4aWs30TreeRow");
                var k = _key(n);
                if (k !== "") { oRow.setAttribute("data-objky", k); }
                if (n && n.ISSEL) { oRow.setAttribute("aria-selected", "true"); }
                oRow.__uspNode = n;   // 우클릭 컨텍스트 메뉴가 행→노드 데이터 해석에 사용
            }
        });
        _tree.el.classList.add("u4aWs30Tree");
        return _tree;
    }

    /************************************************************************
     * 트리 렌더 (구 fnGetUspTreeTableWs30 + rows binding)
     ************************************************************************/
    oAPP.fn.fnRenderUspTree = function () {
        var BODY = document.getElementById("uspTreeBody");
        if (!BODY) { return; }

        var oTree = _ensureTree();
        if (!oTree) { return; }

        // BODY 에는 컬럼 헤더(.u4aWs30TreeColHead, sticky)가 먼저 들어 있으므로 통째로 비우지 않고
        //   트리 el 만 헤더 뒤에 1회 붙인다(헤더 보존 → 행과 동일 폭 컨텍스트 유지).
        if (oTree.el.parentNode !== BODY) {
            BODY.appendChild(oTree.el);
        }
        oTree.render();

        // 설명 컬럼 툴팁은 이제 hover 기반(slotTrailing 에서 data-tip + data-tip-trunc) — 공통 initTooltip 이
        //   세로 클램프(2줄) 잘림을 hover 시점에 판정해 표시. 가상 스크롤로 나중에 나타나는 행도 자동 동작.
        //   (구 _applyDescTooltips 의 "렌더 후 1회 전체 측정" 방식은 윈도잉서 스크롤-인 행을 못 잡아 제거.)
    };

    /************************************************************************
     * 선택 표시 (구 _fnUspTreeSelectedRowMark + setSelectedIndex)
     ************************************************************************/
    oAPP.fn.fnUspTreeMarkSelected = function (oNode) {
        // 모델 ISSEL 플래그 갱신(현재 노드만 true)
        _walkTree(function (o) { o.ISSEL = false; });
        if (oNode) { oNode.ISSEL = true; }

        if (!_tree) { return; }
        var oRow = _tree.selectByKey(oNode ? _key(oNode) : "");
        if (oRow) { try { oRow.scrollIntoView({ block: "nearest" }); } catch (e) { } }
    };

    // 구 fnOnUspTreeUnSelect — 모든 노드 선택 해제(override; 셸 _fnLineSelectCb 가 호출)
    oAPP.fn.fnOnUspTreeUnSelect = function () {
        _walkTree(function (o) { o.ISSEL = false; });
        if (_tree) { _tree.selectByKey(""); } // 현재 aria-selected 해제
    };

    /************************************************************************
     * 전체 펼침/접힘 (구 fnCommonUspTreeTableExpand / Collapse)
     ************************************************************************/
    oAPP.fn.fnUspTreeExpandAll = function () {
        var oTree = _ensureTree();
        if (oTree) { oTree.expandAll(); }
    };
    oAPP.fn.fnUspTreeCollapseAll = function () {
        var oTree = _ensureTree();
        if (oTree) { oTree.collapseAll(); }
    };

    /************************************************************************
     * 컨텍스트 메뉴 연동 — 서브트리 펼침/접힘(구 fnCommonUspTreeTableExpand/Collapse).
     ************************************************************************/
    // K1 Expand Subtree — 노드+자손 폴더 전부 펼침(루트면 전체). 구 PUJKY=="" → expandToLevel(99) 포함.
    oAPP.fn.fnUspTreeExpandSubtree = function (oNode) {
        var oTree = _ensureTree();
        if (!oTree || !oNode) { return; }
        oTree.expandSubtree(oNode);
        if (oNode) { oTree.selectByKey(_key(oNode)); }   // render 후 우클릭 대상 강조 재적용
    };
    // K2 Collapse Subtree — 선택 노드만 접음(구 collapse(idx)).
    oAPP.fn.fnUspTreeCollapseSubtree = function (oNode) {
        var oTree = _ensureTree();
        if (!oTree || !oNode) { return; }
        oTree.setExpanded(oNode, false);
        if (oNode) { oTree.selectByKey(_key(oNode)); }
    };
    // 우클릭 시 시각적 선택만(행 열기 ajax 없이) — 구 setSelectedIndex 효과.
    oAPP.fn.fnUspTreeCtxSelect = function (oNode) {
        if (_tree && oNode) { _tree.selectByKey(_key(oNode)); }
    };

    // 현재 선택(aria-selected) 행의 노드 — 없으면 null. 트리 툴바 펼침/접힘이 사용.
    oAPP.fn.fnUspTreeGetSelectedNode = function () {
        if (!_tree) { return null; }
        var oRow = _tree.el.querySelector('.u4a-tree__row[aria-selected="true"]');
        return oRow ? (oRow.__uspNode || null) : null;
    };

    // 트리 툴바 펼침/접힘 — 구 ev_UspTreeTableExpand/Collapse 가 gIndex 없이 호출 →
    //   fnCommonUspTreeTableExpand/Collapse 가 getSelectedIndex() 사용 = "선택 노드" 기준(All 아님).
    //   루트 선택 시 expandSubtree(root)=트리 전체(구 expandToLevel(99)). 선택 없으면 no-op(구 동일).
    oAPP.fn.fnUspTreeExpandSelected = function () {
        var oNode = oAPP.fn.fnUspTreeGetSelectedNode();
        if (oNode) { oAPP.fn.fnUspTreeExpandSubtree(oNode); }
    };
    oAPP.fn.fnUspTreeCollapseSelected = function () {
        var oNode = oAPP.fn.fnUspTreeGetSelectedNode();
        if (oNode) { oAPP.fn.fnUspTreeCollapseSubtree(oNode); }
    };

    // 트리 전체 순회 콜백(모델 ISSEL 갱신용)
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
