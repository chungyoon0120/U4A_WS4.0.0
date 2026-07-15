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
            if (oM.ctrl) { oM.ctrl.expandSelected(); }
        }));
        oM.tool.appendChild(H.iconBtn("angles-up", H.z("170"), function () {     // 170 Collapse All
            if (oM.ctrl) { oM.ctrl.collapseSelected(); }
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
                _wireModelDrag(oRow, n);   // 좌측 필드 → 중앙 디자인트리 드래그 소스(원본 setDragStart).
            },
            onSelect: function (n) {
                oAPP.attr.selModelNode = n;
                // 모델필드 선택 변경 → 우측 참조필드(P05) 재구성(원본 onSelTabRow → setRefFieldList, P3-C).
                if (typeof oAPP.fn.setRefFieldList === "function") { try { oAPP.fn.setRefFieldList(); } catch (e) { } }
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
     *   ★ 원본의 chkRangeTable/enable(드래그 활성) 은 드래그드롭 단계(Stage3)에서 배선. 여기선 표시색만.
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
                // 추가속성(MPROP) — 우측 패널 미확정값. 아직 미배선(P3)이면 "".
                oObj.IF_DATA.MPROP = (typeof oAPP.fn.setAdditBindData === "function")
                    ? (oAPP.fn.setAdditBindData(oAPP.attr.oAddit && oAPP.attr.oAddit.oModel && oAPP.attr.oAddit.oModel.oData.T_MPROP) || "")
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
            } catch (e) { console.error("[HTML5][bindWindow] 모델필드 dragstart:", e && e.message); }
        });
        oRow.addEventListener("dragend", function () {
            oAPP.attr.dragModelNode = null;
            document.body.classList.remove("u4a-dragging");
            try { if (typeof oAPP.fn.designResetDropFlag === "function") { oAPP.fn.designResetDropFlag(); } } catch (e) { }
        });
    }

    /************************************************************************
     * 모델 필드 데이터 로드(원본 getBindFieldInfo 1:1 — 서버 /getBindAttrData).
     ************************************************************************/
    oAPP.fn.loadBindData = function () {
        if (!oM.ctrl) { oAPP.fn.initModelArea(); }
        if (!oM.ctrl) { return; }

        oAPP.attr.modelFlat = [];
        oAPP.attr.modelTree = [];
        oAPP.attr.selModelNode = null;

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
                    if (param && param.RTMSG) { oAPP.fn.toast(param.RTMSG); }
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
                oM.ctrl.rerender(true);   // 첫 루트 선택 → Expand=전체(16 §3.2)
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
