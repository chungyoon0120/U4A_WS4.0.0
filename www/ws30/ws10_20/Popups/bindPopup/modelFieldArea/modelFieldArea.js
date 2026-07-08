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

    /************************************************************************
     * 영역 초기화(frame.js _bootApp 호출) — 툴바 + 레퍼런스 컬럼트리 생성.
     ************************************************************************/
    oAPP.fn.initModelArea = function () {
        oM.tool = document.getElementById("bwpModelTool");
        oM.host = document.getElementById("bwpModelTree");
        if (!oM.tool || !oM.host) { return; }

        // ── 툴바: 펼침(선택 서브트리) / 접힘(선택 노드) / 새로고침 — 16 §3.2 선택기준 ──
        oM.tool.innerHTML = "";
        oM.tool.appendChild(H.iconBtn("angles-down", H.cl("C27"), function () {   // C27 Expand
            if (oM.ctrl) { oM.ctrl.expandSelected(); }
        }));
        oM.tool.appendChild(H.iconBtn("angles-up", H.cl("C28"), function () {     // C28 Collapse
            if (oM.ctrl) { oM.ctrl.collapseSelected(); }
        }));
        oM.tool.appendChild(H.iconBtn("rotate", H.cl("A48"), function () {        // A48 Refresh
            oAPP.fn.loadBindData();
        }));

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
