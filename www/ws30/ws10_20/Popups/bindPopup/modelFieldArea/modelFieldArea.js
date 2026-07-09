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
        // 168 분할 영역 초기화 — 셸 스플리터 폭/높이 변수 제거(frame.js 가 CSS 변수로 관리).
        oM.tool.appendChild(H.iconBtn("table-columns", H.z("168"), function () {  // 168 분할 영역 초기화
            var oShell = document.getElementById("bwpShell");
            var oCenter = document.getElementById("bwpCenterPane");
            if (oShell) { oShell.style.removeProperty("--bwp-left-w"); oShell.style.removeProperty("--bwp-right-w"); }
            if (oCenter) { oCenter.style.removeProperty("--bwp-design-h"); }
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
            },
            onSelect: function (n) { oAPP.attr.selModelNode = n; }
        });
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
                }
            }
        }
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

            } catch (e) {
                console.error("[HTML5][bindWindow] 모델필드 로드 처리 오류:", e && e.message);
                oM.ctrl.rerender();
            } finally {
                oAPP.fn.setBusy(false);
            }
        });
    };

})();
