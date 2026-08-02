/****************************************************************************
 * Binding Popup(대형 별창) 좌측 "모델 필드 트리" 영역 — HTML5
 * --------------------------------------------------------------------------
 *  원본: index.js callBindPopup 의 oModelFieldTree(sap.ui.table.TreeTable, 3열
 *        Object Name/Type/Description) + getBindFieldInfo(서버 /getBindAttrData 로드).
 *  HTML5: 공통 컴포넌트 U4AUI.makeColumnTree(다열 리사이즈 트리, theme/u4a-ui.js) 소비 +
 *         공유 헬퍼 oAPP.H(el/fa/iconBtn/statIcon/rowHl/cl/z) 소비 — 화면 로컬 헬퍼 복붙 없음.
 *
 *  ★ 데이터 = /getBindAttrData(CLSNM=oAppInfo.CLSID, APPID=oAppInfo.APPID) → T_ATTR(평면 모델필드).
 *    setTreeData(평면 → 중첩 zTREE). 노드 키(원본 1:1): NTEXT/TYPE/DESCR/KIND(T/S/E)/CHILD/PARENT/ZLEVEL…
 *  ★ 상태아이콘/enable(선택가능)은 "디자인 트리에서 속성 선택 시" bindPossible 로 계산(Stage3).
 *    최초(선택 없음) 로드는 모델 구조만 표시 — 원본 초기 뷰와 동일.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP) { return; }

    var H = oAPP.H;   // 공유 UI 헬퍼(bindShared.js) — el/fa/iconBtn/statIcon/rowHl/cl/z

    var oM = { tool: null, host: null, ctrl: null };

    // 텍스트+아이콘 액션 버튼(공통 .u4a-btn) — 라벨 있는 툴바 버튼(원본 sap.m.Button).
    function _btn(sFa, sText, sTip, sVariant, fn) {
        var b = H.el("button", "u4a-btn" + (sVariant ? " " + sVariant : ""));
        b.type = "button";
        if (sFa) { b.innerHTML = H.fa(sFa); }
        if (sText) { b.appendChild(document.createTextNode(sText)); }
        if (sTip) { b.title = sTip; b.setAttribute("aria-label", sTip); }
        if (typeof fn === "function") { b.addEventListener("click", fn); }
        return b;
    }
    function _spacer() { return H.el("span", "u4aBwpToolSpacer"); }

    /************************************************************************
     * 영역 초기화(frame.js _bootApp 호출) — 툴바 + 레퍼런스 컬럼트리 생성.
     ************************************************************************/
    // 모델트리 선택 라인 얻기(원본 getSelectedModelLine 1:1) — 참조필드(P3-C setRefFieldList) 공용.
    //   선택 없으면 undefined(원본 계약 — null.PARENT 접근 방지).
    oAPP.fn.getSelectedModelLine = function () {
        var s = (oM.ctrl && typeof oM.ctrl.getSelected === "function") ? oM.ctrl.getSelected() : null;
        return s || undefined;
    };

    oAPP.fn.initModelArea = function () {
        oM.tool = document.getElementById("bwpModelTool");
        oM.host = document.getElementById("bwpModelTree");
        if (!oM.tool || !oM.host) { return; }

        // ── 툴바(원본 index.js:1099 oTool 1:1) — 펼침/접힘 · 새로고침(강조) · 분할초기화 · 도움말 ──
        //    펼침/접힘은 공통 트리 표준(16 §3.2 선택기준). 새로고침은 원본과 동일한 라벨 버튼(Emphasized).
        oM.tool.innerHTML = "";
        oM.tool.appendChild(H.iconBtn("angles-down", H.z("169"), function () {   // 169 Expand All
            // 전체 펼침(원본 expandToLevel(99999)) — 선택 노드만 펼치던 것 수정(장군님 지적 2026-07-23).
            if (oM.ctrl && oM.ctrl.tree && oM.ctrl.tree.expandAll) { oM.ctrl.tree.expandAll(); }
        }));
        oM.tool.appendChild(H.iconBtn("angles-up", H.z("170"), function () {     // 170 Collapse All
            // 전체 접기(원본 collapseAll).
            if (oM.ctrl && oM.ctrl.tree && oM.ctrl.tree.collapseAll) { oM.ctrl.tree.collapseAll(); }
        }));
        oM.tool.appendChild(H.el("span", "u4aBwpToolSep"));
        oM.tool.appendChild(_btn("rotate", H.z("171"), H.z("171"), "u4a-btn--emphasized", function () {  // 171 Refresh
            oAPP.fn.loadBindData();
        }));
        oM.tool.appendChild(_spacer());
        // 161 컬럼최적화 — 리사이즈바 더블클릭과 ★완전 동일★한 순수 autofit(잔여폭 흡수 없음).
        //   원본 setUiTableAutoResizeColumn 1:1. 채움(fitTreeColumns)은 레이아웃 변경 전용.
        oM.tool.appendChild(H.iconBtn("arrows-left-right-to-line", H.z("161"), function () {
            oAPP.fn.autofitTreeColumns(oM.host);
        }));
        // 168 분할 영역 초기화 — 드래그로 고정된 패널 인라인 flex 를 비워 CSS 기본 폭/높이로 복귀 + 재클램프.
        oM.tool.appendChild(H.iconBtn("table-columns", H.z("168"), function () {  // 168 분할 영역 초기화
            var oShell = document.getElementById("bwpShell");
            if (oShell) {
                oShell.querySelectorAll(".u4a-splitter__pane").forEach(function (p) { p.style.flex = ""; });
            }
            if (window.U4AUI && U4AUI.reclampSplitters) { U4AUI.reclampSplitters(); }
        }));
        // 957 화면 커스터마이징 — 3영역(바인딩필드/DESIGN TREE/추가속성) 표시·숨김 팝업(원본 좌측 툴바).
        oM.tool.appendChild(H.iconBtn("gear", H.z("957"), function () {
            if (oAPP.attr.editable === false) { return; }   // 원본 enabled="{/edit_layout_customizing}"
            if (typeof oAPP.fn.openLayoutCustomizingPopup === "function") { oAPP.fn.openLayoutCustomizingPopup(); }
        }));
        // 198 Help — 도움말 문서(원본 onHelp = U4A_HELP_DOC_OPEN 브로드캐스트)는 통신 단계(Stage6)에서 배선.
        oM.tool.appendChild(H.iconBtn("circle-question", H.z("198"), function () {  // 198 Help
            if (typeof oAPP.fn.onHelp === "function") { try { oAPP.fn.onHelp(); } catch (e) { console.error("[HTML5][bindWindow] onHelp:", e && e.message); } }
        }));

        // 패널 좁아질 때 넘치는 버튼을 ⋯ 오버플로 메뉴로(16 §11, 공통 attachOverflow).
        oAPP.fn.attachToolOverflow(oM.tool);

        // ── 공통 다열 트리(U4AUI.makeColumnTree) — 고정폭 컬럼 + 가로 스크롤(16 §3.4.2) ──
        oM.ctrl = U4AUI.makeColumnTree(oM.host, {
            columns: [
                { label: H.z("174"), width: "16rem" },  // 174 Object Name
                { label: H.z("175"), width: "8rem" },   // 175 Type
                { label: H.z("176"), width: "16rem" }    // 176 Description
            ],
            // autofit(더블클릭·161버튼 공용) = 원본 정책(여유 0.5rem/최소 4rem/상한 없음) — 디자인트리와 동일.
            virtual: true,   // 대용량(수만 노드) 대비 가상 스크롤 — WS20 디자인 트리와 동일(원본 sap.ui.table TreeTable 가상 재현).
            autofit: { slackRem: 0.5, minRem: 4, max: Infinity },
            roots: function () { return oAPP.attr.modelTree || []; },
            children: function (n) { return n.zTREE || []; },
            hasChildren: function (n) { return !!(n.zTREE && n.zTREE.length); },
            key: function (n) { return n.CHILD; },
            label: function (n) { return n.NTEXT; },
            tip: function (n) { return n.NTEXT; },
            selectable: true,
            emptyText: H.z("312"),   // 312 No data Found
            // C2 = 상태아이콘 + 유형텍스트, C3 = 설명(둘 다 말줄임 시 툴팁).
            cell: function (n) {
                var oType = H.el("span", "u4aBwpTypeWrap");
                var oIc = H.statIcon(n.stat_src);
                if (oIc) {
                    var oI = H.el("span", "u4aBwpStat " + oIc.cls);
                    oI.innerHTML = H.fa(oIc.fa);
                    oType.appendChild(oI);
                }
                var oTxt = H.el("span", "u4aBwpTypeTxt", n.TYPE || "");
                if (n.TYPE) { oTxt.setAttribute("data-tip", n.TYPE); oTxt.setAttribute("data-tip-trunc", ""); }
                oType.appendChild(oTxt);

                var oDesc = H.el("span", "u4aBwpDescTxt", n.DESCR || "");
                if (n.DESCR) { oDesc.setAttribute("data-tip", n.DESCR); oDesc.setAttribute("data-tip-trunc", ""); }

                return { c2: oType, c3: oDesc };
            },
            rowHook: function (oRow, n) {
                var sHl = H.rowHl(n.highlight);
                if (sHl) { oRow.classList.add(sHl); }
                // [가상 선택강조] 공통 selectKey 는 현재 DOM 행에만 aria-selected 를 걸어, 가상에서 스크롤로 행이
                //   재생성되면 강조가 소실된다(u4a-ui.js:2119 selKey 미동기). WS20(tree.js:595)처럼 화면 소유
                //   선택키(selModelNode)로 매 빌드 재적용해 유지한다.
                if (oAPP.attr.selModelNode && oAPP.attr.selModelNode.CHILD === n.CHILD) { oRow.setAttribute("aria-selected", "true"); }
                _wireModelDrag(oRow, n);   // 좌측 필드 → 중앙 디자인트리 드래그 소스(원본 setDragStart).
            },
            onSelect: function (n) {
                oAPP.attr.selModelNode = n;
                // 클릭한 행에 선택 강조(aria-selected) — 원본 좌측 트리 selectionMode:"Single"(index.js:4335)
                //   의 행 하이라이트 재현. 공통 트리는 강조 API(selectKey)만 제공하고 화면이 호출한다.
                //   bScroll=false: 사용자가 직접 클릭한 행이라 스크롤 점프 금지.
                if (oM.ctrl && typeof oM.ctrl.selectKey === "function") { try { oM.ctrl.selectKey(n.CHILD, false); } catch (e) { } }
                // 모델필드 선택 변경 → 우측 참조필드(P05) 재구성(원본 onSelTabRow → setRefFieldList, P3-C).
                oAPP.fn.setRefFieldList();   // [표준] 필수 호출 직접(삼킴 제거).
            }
        });

        // 초기(데이터 로드 전) = 빈 트리 → 경계선 끔(로드 성공 시 loadBindData 가 해제).
        oAPP.fn.setTreeEmptyMark(oM.host, true);
        // 컬럼 자동맞춤(원본 setUiTableAutoResizeColumn = 콘텐츠+마지막 컬럼 채움). 레이아웃 확정 후 1회.
        setTimeout(function () { oAPP.fn.fitTreeColumns(oM.host); }, 0);
    };

    /************************************************************************
     * 바인딩 가능여부(상태 아이콘) 계산 — 원본 index.js:5121 setBindEnable 1:1.
     *   KIND(백엔드 RTTI 분류): T=테이블 / S=구조체 / E=일반필드.
     *   · T, E → 녹색 체크(status-positive) = 바인딩(드래그) 가능.
     *   · S    → 아이콘 없음(구조체 자체는 드래그 불가), 하위로 재귀.
     *   ★ 첫 실행(디자인 선택 없음)에도 전 모델필드에 표시 — image1(첫 실행) 과 동일.
     *   ★ [L-1 2026-07-29] range table 각인(chkRangeTable, EXP_TYP="RANGE_TAB")을 T 케이스에 이식(원본 setBindEnable:8240).
     *     — SelectOptions value 드롭 검증(bindData.js:309)이 이 값에 의존. enable(드래그 활성)은 편집모드로 커버.
     ************************************************************************/
    function _applyBindEnable(aFlat) {
        if (!Array.isArray(aFlat) || aFlat.length === 0) { return; }
        var aRoots = aFlat.filter(function (n) { return !n.PARENT; });
        _walk(aRoots, "", "");

        function _walk(aLevel, sKindPath, sKind) {
            for (var i = 0; i < aLevel.length; i++) {
                var n = aLevel[i];
                n.isTabField = (sKind === "T");
                n.KIND_PATH = (sKindPath === "") ? n.KIND : (sKindPath + "-" + n.KIND);
                var aChild = aFlat.filter(function (a) { return a.PARENT === n.CHILD; });
                switch (n.KIND) {
                    case "T":   // 테이블 — 녹색 + 하위(파생필드)까지 재귀(KIND="T" 전파).
                        n.stat_src = "sap-icon://status-positive";
                        // [L-1] range table 각인 — 원본 chkRangeTable(index.js:5464) = setBindEnable:8240 부수효과 1:1.
                        //   자식이 정확히 4건이고 전부 SIGN/OPTION/LOW/HIGH 뿐 → EXP_TYP="RANGE_TAB".
                        //   SelectOptions value(EXT00001161/EXT00002507) 드롭 검증(bindData.js:309)이 이 값을 요구.
                        //   각인 없으면 정상 range 필드도 드롭 거부(장군님 지적 2026-07-29). 서버는 STR_TAB만 주고 RANGE_TAB는 클라 도출.
                        if (aChild.length === 4 && aChild.findIndex(function (c) {
                            return c.NTEXT !== "SIGN" && c.NTEXT !== "OPTION" && c.NTEXT !== "LOW" && c.NTEXT !== "HIGH";
                        }) === -1) {
                            n.EXP_TYP = "RANGE_TAB";
                        }
                        _walk(aChild, n.KIND_PATH, "T");
                        break;
                    case "S":   // 구조체 — 아이콘 없음, 하위 필드로 재귀(부모 KIND 유지).
                        _walk(aChild, n.KIND_PATH, sKind);
                        break;
                    case "E":   // 일반 필드 — 녹색.
                        n.stat_src = "sap-icon://status-positive";
                        break;
                    default:
                        // ★ 컨테이너(앱/모델 루트 등 KIND이 T/S/E 아님) — 아이콘·경로 없이 하위로만 재귀.
                        //   원본 setBindEnable 은 ZLEVEL===2 구조/테이블부터 진입해 이 케이스가 없었으나, HTML5 좌측 트리는
                        //   앱 루트가 최상위라 여기서 끊기면 하위 구조/필드에 KIND_PATH 가 안 붙어 checkValidBind(115)로 전부 거부됨
                        //   (장군님 지적 2026-07-14). 하위(구조/테이블)부터 KIND_PATH 를 다시 시작하도록 sKindPath="" 로 재귀.
                        _walk(aChild, "", sKind);
                        break;
                }
            }
        }
    }

    /************************************************************************
     * 좌측 바인딩 필드 드래그 시작(원본 index.js setDragStart 1:1) — 편집모드에서 행을 native 드래그 소스로.
     *   payload prc001 = {PRCCD:"PRC001", RETCD/RTMSG/T_ERMSG, DnDRandKey(=SSID), IF_DATA:{필드 + MPROP}}.
     *   ★ 원본과 달리 IF_DATA 에서 자식(zTREE) 은 제외한다(드롭측은 필드 자체 속성만 소비 — payload 경량화).
     *   중앙 디자인트리의 drop 가능표시(designSetDropFlag)·drop 처리·checkValidBind 는 증분2(중앙 드롭)에서 배선.
     ************************************************************************/
    // 드래그 payload 필드 = 노드에서 자식(zTREE) 제외한 얕은 복사.
    function _dragField(n) {
        var o = {};
        for (var k in n) { if (Object.prototype.hasOwnProperty.call(n, k) && k !== "zTREE") { o[k] = n[k]; } }
        return o;
    }
    function _wireModelDrag(oRow, n) {
        if (!oRow || !n) { return; }
        oRow.__bwpNode = n;
        var bEdit = (oAPP.attr.editable !== false);   // 원본 DragInfo enabled:{IS_EDIT==="X"} — 편집모드 전체 행.
        oRow.draggable = bEdit;
        if (!bEdit || oRow.__bwpDragWired) { return; }
        oRow.__bwpDragWired = true;

        oRow.addEventListener("dragstart", function (ev) {
            try {
                var oNode = oRow.__bwpNode || n;
                var oObj = {
                    PRCCD: "PRC001", RETCD: "", RTMSG: "", T_ERMSG: [],
                    DnDRandKey: oAPP.attr.DnDRandKey,
                    IF_DATA: _dragField(oNode)
                };
                // 추가속성(MPROP) — 우측 스테이징(MAIN_ADDIT = oAPP.attr.additRows) 미확정값을 캐리.
                //   원본 index.js:8494 setAdditBindData(oAddit.oModel.oData.T_MPROP) → HTML5 우측 스토어 additRows.
                oObj.IF_DATA.MPROP = (typeof oAPP.fn.setAdditBindData === "function")
                    ? (oAPP.fn.setAdditBindData(oAPP.attr.additRows) || "")
                    : "";
                // 추가속성 검증(있으면) — 오류 시 payload 에 실어 드롭측이 차단(원본 checkAdditData).
                try {
                    if (typeof oAPP.fn.checkAdditData === "function") {
                        var r = oAPP.fn.checkAdditData();
                        if (r && r.RETCD === "E") { oObj.RETCD = "E"; oObj.RTMSG = r.RTMSG || ""; oObj.T_ERMSG = r.T_ERMSG || []; }
                    }
                } catch (e2) { }
                ev.dataTransfer.setData("prc001", JSON.stringify(oObj));
                ev.dataTransfer.effectAllowed = "copy";
                oAPP.attr.dragModelNode = oNode;
                document.body.classList.add("u4a-dragging");   // iframe 위 드래그 끊김 방지(공통).
                // 중앙 트리 drop 가능표시(증분2에서 구현되면 자동 배선).
                try { if (typeof oAPP.fn.designSetDropFlag === "function") { oAPP.fn.designSetDropFlag(oNode); } } catch (e3) { }
                // [G-2] 원본 setDragStart 말미(index.js:8544 setSelectedIndex "라인 재 선택 처리") 이식.
                //   드래그 시작 = 그 행을 좌측 선택으로 잡아야, 드롭 후 참조필드(P05)가 드래그한 필드 기준으로 뜬다.
                //   클릭 경로(onSelect)를 그대로 재사용 — select: selNode 설정 + 강조 + setRefFieldList.
                oM.ctrl.select(oNode);
            } catch (e) { console.error("[HTML5][bindWindow] 모델필드 dragstart:", e && e.message); }
        });
        oRow.addEventListener("dragend", function () {
            oAPP.attr.dragModelNode = null;
            document.body.classList.remove("u4a-dragging");
            try { if (typeof oAPP.fn.designResetDropFlag === "function") { oAPP.fn.designResetDropFlag(); } } catch (e) { }
        });
    }

    // [PUBLIC] 좌측 모델트리 재렌더 — bindPossible(선택 시 상태색 재계산) 후 반영용.
    //   oM 은 이 IIFE 로컬이라 외부(bindPossible/designArea)에서 rerender 하려면 이 진입점을 쓴다.
    //   ★ 원본(UI5 model.refresh)은 바인딩/해제 후 판정색만 갱신하고 선택·스크롤을 건드리지 않는다.
    //     공통 rerender() 는 DOM 을 다시 그려 선택(aria-selected)·스크롤을 잃고, 인자 없으면 첫 루트를
    //     강제 선택(최상위로 튕김)한다 → 멀티바인딩/해제 후 좌측 선택이 최상위로 이동하던 버그(장군님 지적 2026-07-23).
    //     현재 선택 키/스크롤을 저장 → rerender(false)(자동선택 방지) → 복원해 원본 거동을 재현한다.
    oAPP.fn.refreshModelTree = function () {
        if (!oM.ctrl) { return; }
        var oSel = (typeof oM.ctrl.getSelected === "function") ? oM.ctrl.getSelected() : null;
        var sKey = oSel ? oSel.CHILD : null;
        var iTop = oM.host ? oM.host.scrollTop : 0;
        oM.ctrl.rerender(false);   // 첫 루트 자동선택 방지
        if (sKey && typeof oM.ctrl.selectKey === "function") { try { oM.ctrl.selectKey(sKey, false); } catch (e) { } }
        if (oM.host) { oM.host.scrollTop = iTop; }
    };

    // [PUBLIC] 좌측 모델트리 전체 펼침 — 원본 expandModelFieldTree(index.js:2691) 대응.
    //   레이아웃 커스터마이징으로 MODEL 영역이 (재)활성될 때 호출(applyBindLayout). 공통 트리 내부
    //   makeTree 의 expandAll 을 ctrl.tree 로 소비(공통 무수정). 원본 expandToLevel(99999) = 전체 펼침.
    oAPP.fn.expandModelFieldTree = function () {
        if (oM.ctrl && oM.ctrl.tree && typeof oM.ctrl.tree.expandAll === "function") {
            try { oM.ctrl.tree.expandAll(); } catch (e) { }
        }
    };

    /************************************************************************
     * [PUBLIC · UX 개선] 경로(sPath = 바인딩 경로 UIATV)로 좌측 모델 필드를 자동 선택.
     *   ★원본에 없는 동작(장군님 승인 2026-07-30). 바인딩 경로 링크 클릭 시 호출 →
     *     좌측 트리에서 그 필드를 펼침+선택+강조 → onSelect 와 동일하게 selNode 설정 + setRefFieldList
     *     → 우측 "참조 필드(P05)" 목록이 자동으로 채워짐(선택 왕복 제거).
     *   좌측에 해당 필드가 없으면 아무것도 안 함(원본 흐름 불변). 접힘 펼침은 R3b 와 동일 패턴.
     ************************************************************************/
    oAPP.fn.selectModelFieldByPath = function (sPath) {
        if (!oM.ctrl || !sPath) { return; }
        var oNode = null, aAnc = [];
        (function rec(a, aPath) {
            if (!a || oNode) { return; }
            for (var i = 0; i < a.length; i++) {
                if (a[i].CHILD === sPath) { oNode = a[i]; aAnc = aPath.slice(); return; }
                rec(a[i].zTREE, aPath.concat(a[i]));
                if (oNode) { return; }
            }
        })(oAPP.attr.modelTree || [], []);
        if (!oNode) { return; }   // 좌측에 없는 경로 = 무동작.
        // 접힌 조상 먼저 펼침(대상 행 DOM 이 있어야 선택·스크롤이 먹음 — R3b 패턴).
        if (oM.ctrl.tree && typeof oM.ctrl.tree.setExpanded === "function") {
            for (var e2 = 0; e2 < aAnc.length; e2++) { try { oM.ctrl.tree.setExpanded(aAnc[e2], true); } catch (e3) { } }
        }
        // ★마우스 클릭과 동일하게 선택(공통 select) → onSelect 발화 = selNode 설정 + 우측 참조필드(setRefFieldList) 등
        //   후속 로직이 알아서 작동(장군님 지적 2026-07-30). selectKey(강조만)로는 우측이 안 채워짐.
        if (typeof oM.ctrl.select === "function") { oM.ctrl.select(oNode, true); }
    };

    /************************************************************************
     * 모델 필드 데이터 로드(원본 getBindFieldInfo 1:1 — 서버 /getBindAttrData).
     ************************************************************************/
    oAPP.fn.loadBindData = function () {
        if (!oM.ctrl) { oAPP.fn.initModelArea(); }
        if (!oM.ctrl) { return; }

        oAPP.attr.modelFlat = [];
        oAPP.attr.modelTree = [];
        oAPP.attr.selModelNode = null;
        // [G-3] 원본 getBindFieldInfo 진입부(index.js:8058·8062) — 재로드 전 하단 "추가속성 적용" 패널 비움+숨김
        //   (안 하면 새로고침 후 옛 선택행 값이 잔존). 함수 없으면(초기화 전) 조용히 skip.
        oAPP.fn.clearSelectAdditBind();   // [표준·G-3] 필수 호출 직접(삼킴 제거).
        oAPP.fn.setAdditLayout("");

        var oInfo = oAPP.attr.oAppInfo || {};
        if (!oAPP.attr.servNm || !oInfo.CLSID) {
            console.warn("[HTML5][bindWindow] 모델필드 로드 skip — servNm/CLSID 없음");
            oM.ctrl.rerender();
            return;
        }

        oAPP.fn.setBusy(true);

        var oFormData = new FormData();
        oFormData.append("CLSNM", oInfo.CLSID);
        oFormData.append("APPID", oInfo.APPID || "");

        oAPP.fn.sendAjax(oAPP.attr.servNm + "/getBindAttrData", oFormData, function (param) {
            try {
                if (!param || param.RETCD === "E") {
                    oM.ctrl.rerender();
                    // ★ [.analy/17] 서버 렌더 텍스트 → 클라이언트 메시지 클래스 DB 역매핑 후 표시(못 찾으면 원문).
                    if (param && param.RTMSG) {
                        oAPP.fn.toast((typeof oAPP.common.relocalizeServerMsg === "function")
                            ? oAPP.common.relocalizeServerMsg(param.RTMSG) : param.RTMSG);
                    }
                    return;
                }

                var aTree = param.T_ATTR || [];
                oAPP.attr.modelFlat = aTree;
                oAPP.attr.editable = (oInfo.IS_EDIT === "X");

                if (aTree.length === 0) {
                    oM.ctrl.rerender();
                    oAPP.fn.toast(H.z("184"));   // 184 Binding attributes does not exist.
                    return;
                }

                // 바인딩 가능여부(상태 아이콘) 계산 — setTreeData 깊은복사 전 평면에 반영.
                _applyBindEnable(aTree);

                // 평면 → 중첩(zTREE).
                oAPP.attr.modelTree = oAPP.fn.setTreeData(aTree, "CHILD", "PARENT", "zTREE");
                // ★ 초기 로드 = 원본 getBindFieldInfo 순서 1:1 재현:
                //   collapseAll → clearSelection → expandToLevel(99999) → setSelectedIndex(0) (index.js:8142~8172).
                //   ★첫 행 선택(8172)이 onSelTabRow→setRefFieldList(우측 참조필드 P05)를 즉시 구성한다.
                //   예전 HTML5 는 8148(펼침)까지만 보고 8172(첫행 선택)를 누락 → 초기 우측 참조필드가 빈 채로 떴다(Δ1).
                //   ★★순서 결정적: 공통 expandAll 은 oUl.innerHTML 을 비우고 전 행을 재생성(u4a-ui.js:1584/1601)한다.
                //     따라서 "펼침 전에" 강조하면 재렌더가 aria-selected 를 지워 화면에 선택이 안 뜬다(장군님 2026-07-24).
                //     원본과 동일하게 반드시 [펼침 → 선택] 순으로 한다.
                oM.ctrl.rerender(true);           // 첫 루트를 selNode 로 설정(원본 setSelectedIndex(0) 대응).
                oAPP.fn.expandModelFieldTree();   // 전체 펼침(원본 expandToLevel(99999)) — 여기서 DOM 재생성.
                // 펼침(재렌더) 뒤 첫 행 강조를 재적용 → 화면에 선택바 유지(selNode 는 JS 변수라 재렌더에도 보존됨).
                var _oFirst = (typeof oM.ctrl.getSelected === "function") ? oM.ctrl.getSelected() : null;
                if (_oFirst && typeof oM.ctrl.selectKey === "function") { try { oM.ctrl.selectKey(_oFirst.CHILD, false); } catch (e) { } }
                oAPP.attr.selModelNode = _oFirst || null;
                // 공통 selectByKey 는 강조/selNode 전용이라 onSelect 콜백을 안 태운다 → 원본 onSelTabRow→
                //   setRefFieldList(우측 참조필드 P05) 를 명시 호출(중복 아님).
                oAPP.fn.setRefFieldList();   // [표준] 필수 호출 직접(삼킴 제거).
                oAPP.fn.setTreeEmptyMark(oM.host, !(oAPP.attr.modelTree || []).length);
                oAPP.fn.fitTreeColumns(oM.host);   // 데이터 반영 후 컬럼 자동맞춤(원본)

            } catch (e) {
                console.error("[HTML5][bindWindow] 모델필드 로드 처리 오류:", e && e.message);
                oM.ctrl.rerender();
            } finally {
                oAPP.fn.setBusy(false);
            }
        });
    };

})();
