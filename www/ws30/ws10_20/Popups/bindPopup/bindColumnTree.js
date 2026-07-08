/****************************************************************************
 * makeColumnTree — 다열 그리드 트리테이블 (Binding Popup 레퍼런스 컴포넌트) — HTML5
 * ==========================================================================
 *  ★ 레퍼런스 = 소형 callBindPopup(js/fnBindPopupOpen.js)의 검증된 "그리드 트리" +
 *    App-F4(fnAppF4PopupOpen.js) 고정컬럼/가로스크롤. 새 트리는 이걸 소비/참조.
 *
 *  구조(스크롤 컨테이너 안):
 *    [sticky 컬럼 헤더] + [본문(그라디언트 가로 행라인) > [세로 그리드라인 레이어] + [공통 U4AUI.createTree]]
 *   · 전체 그리드 = 행 라인(각 행 border-bottom + 빈 영역 반복 그라디언트) + 컬럼 라인(헤더/행 셀 border-left
 *     + 빈 영역 그리드라인 레이어) → 데이터 없는 아래 영역까지 화면 전체에 격자.
 *   · ★ 헤더·본문·트리를 "같은 명시적 총폭"(--u4act-total-w = 컬럼폭 합)으로 묶어 가로 스크롤 시 어긋나지
 *     않는다(요소별 max-content 는 값이 달라 깨진다 — 2026-07-08 실측).
 *   · 컬럼 = 고정폭(App-F4). 팬(스플리터) 리사이즈에 불변, 폭 합이 팬보다 넓으면 가로 스크롤(16 §3.4.2).
 *   · 정렬 = 16 §3.4.1(라벨 flex / 들여쓰기=토글 margin / 헤더 padding-left=행+1px / display:contents 트레일링).
 *   · 행높이·간격·텍스트·토글 = shell.css .u4a-tree* 단일출처(§3.2) — 덮지 않음. 색은 의미 토큰만.
 *
 *  API — oAPP.fn.makeColumnTree(oHostEl, cfg) → 컨트롤러. cfg:
 *    columns:[{label,width?}×3], roots(), children(n), hasChildren(n)?, key(n), label(n), tip(n)?,
 *    selectable, icon(n)?, slotLead(n)?, cell(n)→{c2,c3}, rowHook(row,n)?, onSelect(n,row)?, emptyText?
 *  컨트롤러: { host, tree, rerender(bSelectFirst), expandSelected(), collapseSelected(),
 *             getSelected(), selectKey(key,bScroll) }
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.H) { return; }

    var _el = oAPP.H.el;   // 공유 DOM 헬퍼

    function _fill(oCell, vContent) {
        if (vContent == null) { return; }
        if (typeof vContent === "string") { oCell.textContent = vContent; }
        else { oCell.appendChild(vContent); }
    }

    oAPP.fn.makeColumnTree = function (oHost, oCfg) {
        if (!oHost) { return null; }
        if (!(window.U4AUI && U4AUI.createTree)) {
            console.error("[HTML5][bindWindow] U4AUI.createTree 미로드");
            return null;
        }
        oCfg = oCfg || {};
        var aCols = oCfg.columns || [{ label: "" }, { label: "" }, { label: "" }];
        // 컬럼 고정폭 기본값(rem — 줌 대응). % 금지(16 §3.4.2).
        var C1_DEF = (aCols[0] && aCols[0].width) || "15rem";
        var C2_DEF = (aCols[1] && aCols[1].width) || "8rem";
        var C3_DEF = (aCols[2] && aCols[2].width) || "14rem";

        // ── 컨테이너 + sticky 헤더 ──
        oHost.classList.add("u4aColTree");
        oHost.innerHTML = "";
        oHost.style.setProperty("--u4act-c1-w", C1_DEF);
        oHost.style.setProperty("--u4act-c2-w", C2_DEF);
        oHost.style.setProperty("--u4act-c3-w", C3_DEF);

        var oHead = _el("div", "u4aColTreeHead");
        var oC1H = _el("span", "u4aColTreeCol u4aColTreeC1"); oC1H.textContent = (aCols[0] && aCols[0].label) || "";
        var oC2H = _el("span", "u4aColTreeCol u4aColTreeC2"); oC2H.textContent = (aCols[1] && aCols[1].label) || "";
        var oC3H = _el("span", "u4aColTreeCol u4aColTreeC3"); oC3H.textContent = (aCols[2] && aCols[2].label) || "";
        oHead.appendChild(oC1H); oHead.appendChild(oC2H); oHead.appendChild(oC3H);
        oHost.appendChild(oHead);

        // ── 본문(그라디언트 가로 행라인) + 세로 그리드라인 레이어 ──
        var oBody = _el("div", "u4aColTreeBody");
        var oGrid = _el("div", "u4aColTreeGrid");
        oGrid.setAttribute("aria-hidden", "true");
        oGrid.appendChild(_el("span", "u4aColTreeGL u4aColTreeGL--c1"));
        oGrid.appendChild(_el("span", "u4aColTreeGL u4aColTreeGL--c2"));
        oGrid.appendChild(_el("span", "u4aColTreeGL u4aColTreeGL--c3"));
        oBody.appendChild(oGrid);
        oHost.appendChild(oBody);

        // ── 총폭 동기(헤더/본문/트리 동일 폭 = 컬럼폭 합) → 가로 스크롤 어긋남 방지 ──
        function _colPx(iIdx) {
            var oCell = (iIdx === 0) ? oC1H : (iIdx === 1) ? oC2H : oC3H;
            return (oCell && oCell.getBoundingClientRect().width) || 120;
        }
        function _overheadPx() {
            var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            return rem * 0.375 * 3 + 1;   // padding-left(0.375rem) + gap×2(0.375rem) + ul 좌측 1px
        }
        function _syncTotal() {
            var total = _colPx(0) + _colPx(1) + _colPx(2) + _overheadPx();
            oHost.style.setProperty("--u4act-total-w", total + "px");
        }

        // ── 컬럼 리사이즈(고정폭 조절, 초과분 가로 스크롤. 각 컬럼 우측 경계 그립) ──
        function _applyColW(sVar, px) {
            oHost.style.setProperty(sVar, Math.max(64, px) + "px");   // 최소 4rem, 상한 없음
            _syncTotal();
        }

        // 컬럼 리사이즈 그립 — 공통 U4AUI.attachColumnResize(가이드 라인 + 놓을 때 적용) 소비. 16 §3.4.2
        function _resetCols() {
            oHost.style.setProperty("--u4act-c1-w", C1_DEF);
            oHost.style.setProperty("--u4act-c2-w", C2_DEF);
            oHost.style.setProperty("--u4act-c3-w", C3_DEF);
            _syncTotal();
        }
        function _buildGrip(sVar, iColIdx, sHl, bRight) {
            var oGrip = _el("div", "u4aColTreeGrip" + (bRight ? " u4aColTreeGrip--right" : ""));
            oGrip.setAttribute("aria-hidden", "true");
            U4AUI.attachColumnResize(oGrip, {
                host: oHost,
                getWidth: function () { return _colPx(iColIdx); },
                setWidth: function (px) { _applyColW(sVar, px); },
                onReset: _resetCols,
                hoverEl: oHost,
                hoverClass: sHl
            });
            return oGrip;
        }
        oC2H.appendChild(_buildGrip("--u4act-c1-w", 0, "u4aColTreeHl2"));         // C1|C2 → C1
        oC3H.appendChild(_buildGrip("--u4act-c2-w", 1, "u4aColTreeHl3"));         // C2|C3 → C2
        oC3H.appendChild(_buildGrip("--u4act-c3-w", 2, "u4aColTreeHl3r", true));  // C3 우단 → C3

        // ── 트리(공통 createTree) ──
        var selNode = null;

        var oTree = U4AUI.createTree({
            roots: function () { return (typeof oCfg.roots === "function") ? (oCfg.roots() || []) : []; },
            children: function (n) { return (typeof oCfg.children === "function") ? (oCfg.children(n) || []) : []; },
            hasChildren: function (n) {
                if (typeof oCfg.hasChildren === "function") { return !!oCfg.hasChildren(n); }
                var c = (typeof oCfg.children === "function") ? oCfg.children(n) : null;
                return !!(c && c.length);
            },
            key: function (n) { return oCfg.key(n); },
            label: function (n) { return oCfg.label(n); },
            tip: function (n) { return (typeof oCfg.tip === "function") ? oCfg.tip(n) : oCfg.label(n); },
            icon: (typeof oCfg.icon === "function") ? oCfg.icon : undefined,
            // slotLead(체크박스 등) — 이름 셀 안으로 넣기 위해 알아볼 수 있게 래핑(.u4aColTreeLead).
            slotLead: (typeof oCfg.slotLead === "function") ? function (n, ctx) {
                var x = oCfg.slotLead(n, ctx);
                if (!x) { return null; }
                var w = _el("span", "u4aColTreeLead");
                w.appendChild(x);
                return w;
            } : undefined,
            selectable: oCfg.selectable !== false,
            // 트레일링 = C2/C3 셀(display:contents 래퍼 → 두 셀이 행 직계 flex 자식 = 헤더/그리드와 정렬).
            slotTrailing: function (n) {
                var oWrap = _el("span", "u4aColTreeTrail");
                var oCell2 = _el("span", "u4aColTreeCell u4aColTreeC2");
                var oCell3 = _el("span", "u4aColTreeCell u4aColTreeC3");
                if (typeof oCfg.cell === "function") {
                    var oC = oCfg.cell(n) || {};
                    _fill(oCell2, oC.c2);
                    _fill(oCell3, oC.c3);
                }
                oWrap.appendChild(oCell2);
                oWrap.appendChild(oCell3);
                return oWrap;
            },
            rowHook: function (oRow, n) {
                oRow.classList.add("u4aColTreeRow");
                oRow.__bwpNode = n;
                var oNameCell = _el("div", "u4aColTreeNameCell");
                var oLead = oRow.querySelector(".u4aColTreeLead");   // 체크박스 등(slotLead)
                var oTog = oRow.querySelector(".u4a-tree__toggle");
                var oIco = oRow.querySelector(".u4a-tree__icon");
                var oLbl = oRow.querySelector(".u4a-tree__label");
                if (oLead) { oNameCell.appendChild(oLead); }   // [체크박스][토글][아이콘][라벨]
                if (oTog) { oNameCell.appendChild(oTog); }
                if (oIco) { oNameCell.appendChild(oIco); }
                if (oLbl) { oNameCell.appendChild(oLbl); }
                oRow.insertBefore(oNameCell, oRow.firstChild);
                if (typeof oCfg.rowHook === "function") { try { oCfg.rowHook(oRow, n); } catch (e) { } }
            },
            onSelect: function (n, oRow) {
                selNode = n;
                if (typeof oCfg.onSelect === "function") { try { oCfg.onSelect(n, oRow); } catch (e) { } }
            }
        });

        oTree.el.classList.add("u4aColTreeTree");
        oBody.appendChild(oTree.el);

        // ── 컨트롤러 ──
        function _showEmpty(bShow) {
            var oExist = oBody.querySelector(".u4aColTreeEmpty");
            if (bShow) {
                oTree.el.style.display = "none";
                if (!oExist) {
                    oExist = _el("div", "u4a-empty u4aColTreeEmpty");
                    oExist.textContent = oCfg.emptyText || "";
                    oBody.appendChild(oExist);
                }
            } else {
                oTree.el.style.display = "";
                if (oExist) { oExist.remove(); }
            }
        }

        return {
            host: oHost,
            tree: oTree,
            getSelected: function () { return selNode; },
            rerender: function (bSelectFirst) {
                var aRoots = (typeof oCfg.roots === "function") ? (oCfg.roots() || []) : [];
                if (!aRoots.length) { _showEmpty(true); selNode = null; _syncTotal(); return; }
                _showEmpty(false);
                oTree.render();
                _syncTotal();
                if (bSelectFirst !== false && aRoots[0]) {
                    try { oTree.selectByKey(oCfg.key(aRoots[0]), false); selNode = aRoots[0]; } catch (e) { }
                }
            },
            expandSelected: function () { if (selNode) { try { oTree.expandSubtree(selNode); } catch (e) { } } },
            collapseSelected: function () { if (selNode) { try { oTree.setExpanded(selNode, false); } catch (e) { } } },
            selectKey: function (sKey, bScroll) { try { oTree.selectByKey(sKey, bScroll === true); } catch (e) { } }
        };
    };

})();
