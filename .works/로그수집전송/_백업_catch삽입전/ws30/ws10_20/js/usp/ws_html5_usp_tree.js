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
    function _iconSrc(ISFLD, EXTEN, bExpanded) {
        _ensureSvgList();
        if (!_svgFolder) { return ""; }
        // 폴더: 펼침=열린 폴더 / 접힘=닫힌 폴더 (펼침 상태는 createTree 가 icon 콜백 oCtx.expanded 로 전달).
        if (ISFLD === "X") { return _svgFolder + (bExpanded ? "/folder-open.svg" : "/folder.svg"); }
        if (!EXTEN) { return _svgFolder + "/file.svg"; }
        var sLow = String(EXTEN).toLowerCase();
        var sFind = _svgList.find(function (elem) { return elem.indexOf(sLow) === 0; });
        if (!sFind) { return _svgFolder + "/file.svg"; }
        return _svgFolder + "/" + sFind;
    }

    function _attrEsc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
    function _hasChildren(o) { return o && Array.isArray(o.USPTREE) && o.USPTREE.length > 0; }
    function _key(o) { return (o && o.OBJKY != null) ? String(o.OBJKY) : ""; }

    // 메시지 텍스트(컬럼 헤더/빈 데이터) — usp.js _msg/_wsMsg 와 동일 소스.
    function _msg(sNum) {
        try { var s = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", sNum); if (s != null && s !== "" && s.indexOf("|") === -1) { return s; } } catch (e) { }
        return sNum;
    }
    function _wsMsg(sNr) {
        try {
            var lg = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            var s = parent.WSUTIL.getWsMsgClsTxt(lg, "ZMSG_WS_COMMON_001", sNr);
            if (s && s.indexOf("|") === -1) { return s; }
        } catch (e) { }
        return sNr;
    }

    // 공통 컬럼 트리테이블(U4AUI.makeColumnTree) 컨트롤러(1회 생성). _tree = 내부 createTree 컨트롤러(기존 _tree.* 호출 호환).
    var _ctrl = null, _tree = null;
    function _ensureTree() {
        if (_ctrl) { return _ctrl; }
        var BODY = document.getElementById("uspTreeBody");
        if (!(window.U4AUI && U4AUI.makeColumnTree && BODY)) { return null; }

        // ★ 공통 컬럼 트리테이블로 통합(2026-07-13) — 헤더·격자·세로선·컬럼 리사이즈·더블클릭 auto-fit·hover 강조를
        //   전부 makeColumnTree 가 담당(화면별 재발명 제거, 16 §3.4.2). 화면은 데이터 매핑만.
        //   2열 = [이름(고정폭·리사이즈 대상) | 설명(채움 fillLast)]. 가상 스크롤(대용량 소스 트리).
        _ctrl = U4AUI.makeColumnTree(BODY, {
            virtual: true,
            fillLast: true,
            columns: [
                { label: _msg("C11"), width: "11rem" },   // C11 이름
                { label: _msg("A35") }                     // A35 설명(채움)
            ],
            roots: function () {
                var a = [];
                try { a = APPCOMMON.fnGetModelProperty("/WS30/USPTREE") || []; } catch (e) { }
                return Array.isArray(a) ? a : [];
            },
            children: function (n) { return _hasChildren(n) ? n.USPTREE : []; },
            hasChildren: _hasChildren,
            key: _key,
            label: function (n) { return (n && n.OBDEC != null) ? n.OBDEC : ""; },
            tip: function (n) { return (n && n.OBDEC != null) ? String(n.OBDEC) : ""; },
            selectable: true,
            emptyText: _wsMsg("312"),   // 312 No data Found
            // 아이콘(SVG, ISFLD/EXTEN) — 폴더 펼침/접힘은 oCtx.expanded.
            icon: function (n, oCtx) {
                var src = _iconSrc(n.ISFLD, n.EXTEN, !!(oCtx && oCtx.expanded));
                if (!src) { return ""; }
                return '<img src="' + _attrEsc(src) + '" alt="" onerror="this.style.display=\'none\'">';
            },
            // 설명 셀 — 2줄 클램프 + 잘릴 때 hover 툴팁(공통 initTooltip 세로클램프 인식). makeColumnTree 가 .u4aColTreeCell 로 감쌈.
            cell: function (n) {
                var t = document.createElement("span");
                t.className = "u4aWs30TreeDescText";
                var sDesc = (n && n.DESCT != null) ? n.DESCT : "";
                t.textContent = sDesc;
                if (sDesc) { t.setAttribute("data-tip", sDesc); t.setAttribute("data-tip-trunc", ""); }
                return { c2: t };
            },
            // 단일 클릭 = 열기(우측 페이지 + Monaco).
            onSelect: function (n) {
                try { oAPP.fn.fnUspTreeTableRowSelect(n); }
                catch (e) { console.error("[HTML5][WS30] tree click open error:", e); }
            },
            // WS30 확장 — 컨텍스트메뉴 트리거 클래스(.u4aWs30TreeRow)·식별(data-objky)·선택표시(ISSEL)·노드 stash.
            //   (이름 셀 래핑·컬럼 정렬은 makeColumnTree 가 담당 → USP 는 손대지 않음)
            rowHook: function (oRow, n) {
                oRow.classList.add("u4aWs30TreeRow");
                var k = _key(n);
                if (k !== "") { oRow.setAttribute("data-objky", k); }
                if (n && n.ISSEL) { oRow.setAttribute("aria-selected", "true"); }
                oRow.__uspNode = n;
            }
        });
        if (!_ctrl) { return null; }
        _tree = _ctrl.tree;   // 내부 createTree 컨트롤러 — 기존 _tree.selectByKey/expandAll/expandSubtree/setExpanded/el/scrollToKey 호환
        return _ctrl;
    }

    /************************************************************************
     * 트리 렌더 (구 fnGetUspTreeTableWs30 + rows binding) — makeColumnTree.rerender 로 위임.
     ************************************************************************/
    oAPP.fn.fnRenderUspTree = function () {
        var oCtrl = _ensureTree();
        if (!oCtrl) { return; }
        // 자동 첫선택 안 함(false) — 선택은 우측 콘텐츠와 연동(클릭/프로그램 선택만).
        oCtrl.rerender(false);
    };

    /************************************************************************
     * 선택 표시 (구 _fnUspTreeSelectedRowMark + setSelectedIndex)
     ************************************************************************/
    oAPP.fn.fnUspTreeMarkSelected = function (oNode, bScroll) {
        // 모델 ISSEL 플래그 갱신(현재 노드만 true)
        _walkTree(function (o) { o.ISSEL = false; });
        if (oNode) { oNode.ISSEL = true; }

        if (!_tree) { return; }
        // ★ 스크롤은 명시 요청(bScroll)일 때만 — selectByKey 2번째 인자(bReveal)로 위임.
        //   클릭 선택은 이미 보이는 행이라 스크롤 점프 금지(원본 UI5 도 클릭 시 스크롤 안 함). 신규 생성/검색 등
        //   화면 밖 노드를 프로그램으로 선택할 때만 호출처가 bScroll=true 로 보이게 한다.
        _tree.selectByKey(oNode ? _key(oNode) : "", !!bScroll);
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
        _ensureTree();
        if (_tree) { _tree.expandAll(); }
    };
    oAPP.fn.fnUspTreeCollapseAll = function () {
        _ensureTree();
        if (_tree) { _tree.collapseAll(); }
    };

    /************************************************************************
     * 컨텍스트 메뉴 연동 — 서브트리 펼침/접힘(구 fnCommonUspTreeTableExpand/Collapse).
     ************************************************************************/
    // K1 Expand Subtree — 노드+자손 폴더 전부 펼침(루트면 전체). 구 PUJKY=="" → expandToLevel(99) 포함.
    oAPP.fn.fnUspTreeExpandSubtree = function (oNode) {
        _ensureTree();
        if (!_tree || !oNode) { return; }
        _tree.expandSubtree(oNode);
        _tree.selectByKey(_key(oNode), false);   // render 후 우클릭 대상 강조 재적용
    };
    // K2 Collapse Subtree — 선택 노드만 접음(구 collapse(idx)).
    oAPP.fn.fnUspTreeCollapseSubtree = function (oNode) {
        _ensureTree();
        if (!_tree || !oNode) { return; }
        _tree.setExpanded(oNode, false);
        _tree.selectByKey(_key(oNode), false);
    };
    // 우클릭 시 선택(aria-selected) 을 옮기지 않는다.
    //   ★ 선택(파란 강조)은 "우측에 열린 콘텐츠"와 연동된 상태다. 우클릭만으로는 콘텐츠를 로드하지 않으므로,
    //     우클릭 행으로 선택을 옮기면 "선택 행 ≠ 우측 콘텐츠" 가 되어 논리가 어긋난다(원본 setSelectedIndex
    //     도 같은 불일치가 있었음). 컨텍스트 메뉴의 대상은 우클릭한 노드(oNode)이고, 메뉴가 그 위치에 떠서
    //     대상이 명확하므로 선택 표시는 기존(우측 콘텐츠) 그대로 둔다.
    oAPP.fn.fnUspTreeCtxSelect = function (oNode) { /* 선택 이동 없음 — 위 주석 참고 */ };

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
