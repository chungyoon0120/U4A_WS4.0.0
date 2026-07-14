/****************************************************************************
 * Binding Popup(대형 별창) 공용 헬퍼 — HTML5 (frame.js 전역 뒤에 로드)
 *  · 여러 영역(모델필드/디자인/추가속성)이 공유하는 서버통신·트리변환 유틸.
 *  · frame.js 는 클래식 전역 스크립트라 여기서 oAPP/_msg/_zmsg 등 전역을 그대로 소비한다.
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP) { return; }

    /************************************************************************
     * sendAjax — 원본 index.js:2736 1:1(XHR POST FormData → JSON 콜백).
     *   ★ withCredentials(세션 쿠키) 유지. 실패 시 fn_success(null) 로 넘겨 호출측이 방어(원본은 무처리라
     *     서버 200 만 가정 — HTML5 는 네트워크/파싱 오류에도 busy 잔류를 막게 null 전달).
     ************************************************************************/
    oAPP.fn.sendAjax = function (sPath, oFormData, fn_success) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== xhr.DONE) { return; }
            if (xhr.status === 200 || xhr.status === 201) {
                var oRes = null;
                try { oRes = JSON.parse(xhr.response); }
                catch (e) { console.error("[HTML5][bindWindow] 응답 파싱 실패:", e && e.message); }
                try { fn_success(oRes); } catch (e2) { console.error("[HTML5][bindWindow] 콜백 오류:", e2 && e2.message); }
            } else {
                console.error("[HTML5][bindWindow] 서버 오류 status=", xhr.status, sPath);
                try { fn_success(null); } catch (e3) { }
            }
        };
        xhr.onerror = function () {
            console.error("[HTML5][bindWindow] 네트워크 오류:", sPath);
            try { fn_success(null); } catch (e) { }
        };
        xhr.withCredentials = true;
        xhr.open("post", sPath, true);
        xhr.send(oFormData);
    };

    /************************************************************************
     * setTreeData — 평면 배열 → 중첩 트리(원본 setTreeJson:2643 알고리즘 1:1, 순수 함수형).
     *   @param aFlat        평면 배열(불변 — 깊은복사 후 가공)
     *   @param sChild       자식 키 필드명(각 노드 고유 key, 예 "CHILD")
     *   @param sParent      부모 키 필드명(예 "PARENT"). 값이 falsy(""/0/undefined)면 루트.
     *   @param sTreePath    자식 배열을 담을 필드명(예 "zTREE")
     *   @return 루트 노드 배열(각 노드에 sTreePath 로 자식 배열 부착)
     *   ★ 원본은 oModel 을 변이하지만, HTML5 는 평면(TREE)·중첩(zTREE)을 분리 보관하려고 순수 함수로.
     ************************************************************************/
    oAPP.fn.setTreeData = function (aFlat, sChild, sParent, sTreePath) {
        if (!Array.isArray(aFlat) || aFlat.length === 0) { return []; }
        var aCopy = JSON.parse(JSON.stringify(aFlat));
        var aRoot = [], oMap = {};
        for (var i = 0, l = aCopy.length; i < l; i++) {
            var e = aCopy[i];
            var h = e[sChild];
            var u = e[sParent] || 0;
            oMap[h] = oMap[h] || [];
            e[sTreePath] = oMap[h];
            if (u !== 0) { oMap[u] = oMap[u] || []; oMap[u].push(e); }
            else { aRoot.push(e); }
        }
        return aRoot;
    };

    /************************************************************************
     * zTREE(중첩)에서 CHILD(key)로 노드 검색 — 재귀.
     ************************************************************************/
    oAPP.fn.findTreeNode = function (aNodes, sKey, sTreePath) {
        sTreePath = sTreePath || "zTREE";
        if (!Array.isArray(aNodes)) { return null; }
        for (var i = 0; i < aNodes.length; i++) {
            if (aNodes[i].CHILD === sKey) { return aNodes[i]; }
            var aChild = aNodes[i][sTreePath];
            if (aChild && aChild.length) {
                var r = oAPP.fn.findTreeNode(aChild, sKey, sTreePath);
                if (r) { return r; }
            }
        }
        return null;
    };

    /************************************************************************
     * 패널 헤더 툴바 반응형 오버플로(⋯) — 공통 U4AUI.attachOverflow 소비.
     *   ★ 각 스플릿 영역(모델/디자인/추가속성) 헤더 툴바는 패널이 좁아지면 버튼이 잘리거나 삐져나오면
     *     안 된다(16 §11). 넘치는 액션은 우측 ⋯ 메뉴로 접는다.
     *   ★ 기존 동일 패턴: WS10/20 공통헤더(buildMenubar, .u4a-ws10__common), 미리보기 패널 헤더
     *     (_buildPrevHeader), 개인화 미리보기 툴바(fnP13nDesignPopupOpen.js:831). 새로 만들지 말고 이걸 소비.
     *   · 세퍼레이터 = .u4aBwpToolSep, 스페이서(flex-grow) = .u4aBwpToolSpacer(측정 제외 isSkip).
     *   · noOvfAutoMargin:true — 스페이서가 이미 우측으로 밀므로 ⋯ 를 보이는 버튼 끝에 붙인다.
     ************************************************************************/
    // 원본 버튼의 시맨틱 변형 → ⋯ 메뉴 아이콘 색 클래스(원본 UI5 OverflowToolbar 가 접힌 버튼 색을
    //   유지하던 것 대응). 없으면 기본색(--icon-muted).
    function _menuIcoColor(el) {
        if (el.classList.contains("u4aBwpBtn--sync")) { return "u4aBwpMenuIco--success"; }   // 동일속성(녹)
        if (el.classList.contains("u4a-btn--emphasized")) { return "u4aBwpMenuIco--info"; }   // 멀티(파)
        if (el.classList.contains("u4a-btn--negative")) { return "u4aBwpMenuIco--error"; }     // Unbind(빨)
        return "";
    }

    oAPP.fn.attachToolOverflow = function (oTool) {
        if (!oTool || !window.U4AUI || typeof U4AUI.attachOverflow !== "function") { return null; }
        var oOvf = U4AUI.attachOverflow(oTool, {
            noOvfAutoMargin: true,
            btnClass: "u4a-btn-icon u4aBwpOvfBtn",
            isSep: function (el) { return el.classList.contains("u4aBwpToolSep"); },
            isSkip: function (el) { return el.classList.contains("u4aBwpToolSpacer"); },
            // ⋯ 메뉴 항목에 원본 버튼 색을 입힌다(아이콘 클론 + 색 클래스). 비활성/클릭은 공통이 자동 처리.
            menuItem: function (el) {
                var sColor = _menuIcoColor(el);
                var oI = el.querySelector("i");
                var sIcon = "";
                if (oI) {
                    var oClone = oI.cloneNode(true);
                    if (sColor) { oClone.classList.add(sColor); }
                    sIcon = oClone.outerHTML;
                }
                return {
                    iconHtml: sIcon,
                    text: (typeof U4AUI.btnLabel === "function") ? U4AUI.btnLabel(el, true) : (el.title || ""),
                    onClick: function () { el.click(); }
                };
            }
        });
        // 초기 reflow — 스플리터 레이아웃으로 폭이 확정된 뒤 측정(폭 0이면 항상 오버플로로 오판).
        if (oOvf && typeof requestAnimationFrame === "function") {
            (function _try(n) {
                if (oTool.clientWidth > 0) { try { oOvf.reflow(); } catch (e) { } return; }
                if (n <= 0) { return; }
                requestAnimationFrame(function () { _try(n - 1); });
            })(30);
        }
        return oOvf;
    };

    /************************************************************************
     * 빈 트리 표식 — 데이터가 없으면 host 에 .u4aBwpTreeEmpty 를 붙여 그리드/행라인을 끈다.
     *   ★ 공통 makeColumnTree 는 .u4aColTreeBody(반복 그라디언트=가로 행라인)+.u4aColTreeGrid(세로 컬럼라인)를
     *     데이터 없어도 그린다. 원본 sap.ui.table 은 빈 경우 선을 안 그리므로(사용자 지적), 빈 트리에선 스코프로 끈다.
     ************************************************************************/
    oAPP.fn.setTreeEmptyMark = function (oHost, bEmpty) {
        if (oHost) { oHost.classList.toggle("u4aBwpTreeEmpty", !!bEmpty); }
    };

    /************************************************************************
     * 컬럼 폭 계산 헬퍼 — makeColumnTree host 각 컬럼의 "콘텐츠 자연폭"(좌우 패딩 포함).
     *   ★ 글자폭 = canvas measureText(el 계산 폰트). Range.selectNodeContents 는 el 이 flex/block(헤더 셀)
     *     이면 글자폭이 아니라 "셀 레이아웃 폭"을 돌려줘 측정이 순환참조가 된다([[coltree-fit-container-and-range-trap]]).
     *   ★ 자연폭 = 가장 넓은 리프의 (셀좌측 기준 우측끝) + 우측 패딩. 텍스트만 있는 셀(헤더)은 좌패딩+글자폭+우패딩.
     *     (fallback 으로 flex 셀 offsetWidth 를 쓰면 현재폭을 되돌려 값이 튄다 — 안 씀.)
     ************************************************************************/
    var _bwpMeasCtx = null;   // 글자폭 측정용 canvas 2d 컨텍스트(1회 생성).
    function _bwpGlyphW(el) {
        try {
            if (!_bwpMeasCtx) { _bwpMeasCtx = document.createElement("canvas").getContext("2d"); }
            var cs = getComputedStyle(el);
            _bwpMeasCtx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
            return Math.ceil(_bwpMeasCtx.measureText(el.textContent || "").width);
        } catch (e) { return 0; }
    }
    function _bwpCellNat(oCell) {
        var cr = oCell.getBoundingClientRect();
        if (!cr.width) { return 0; }
        var cs = getComputedStyle(oCell);
        var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0, bdL = parseFloat(cs.borderLeftWidth) || 0;
        // ★ 셀 전체 텍스트 기준 후보(좌패딩+글자폭). 헤더 셀은 라벨이 직접 텍스트라 이게 정답.
        var natural = padL + _bwpGlyphW(oCell);
        // 리프(자식없는) 요소 중 콘텐츠(텍스트/아이콘)의 우측끝도 후보 — 단, 컬럼 리사이즈 그립은
        //   셀 우측 끝에 있어 셀 폭을 되돌리므로 제외(안 하면 순환참조로 값이 튐 — 그립·데코 스킵).
        var aEl = oCell.querySelectorAll("*");
        for (var i = 0; i < aEl.length; i++) {
            var el = aEl[i];
            if (el.children.length) { continue; }
            if (el.classList && el.classList.contains("u4aColTreeGrip")) { continue; }
            var lr = el.getBoundingClientRect();
            var w = (el.textContent && el.textContent.trim()) ? _bwpGlyphW(el) : el.offsetWidth;
            var right = (lr.left - cr.left) + w;
            if (right > natural) { natural = right; }
        }
        return natural + padR + bdL;
    }

    /************************************************************************
     * [161 버튼] 컬럼 자동맞춤(autofit) — 콘텐츠 자연폭에 맞춤(넘치면 가로 스크롤 = 사용자 의도).
     ************************************************************************/
    oAPP.fn.fitTreeColumns = function (oHost) {
        if (!oHost) { return; }
        try {
            var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            var slack = Math.round(0.5 * rem), minPx = Math.round(4 * rem);
            var overhead = Math.round(rem * 0.375 * 3 + 1);
            // ★ per-컬럼 폭은 공통 makeColumnTree 의 autoWidth(=리사이즈바 더블클릭과 완전 동일 계산)를 소비한다.
            //   과거엔 여기서 _bwpCellNat 로 따로 측정해 더블클릭과 폭이 어긋났음 → 단일화(장군님 지적 2026-07-14).
            //   대형 바인딩 트리는 makeColumnTree(autofit:{slackRem:0.5,minRem:4,max:Infinity}) 로 생성돼
            //   slack/최소/상한 정책까지 원본 setUiTableAutoResizeColumn 과 일치.
            var oCtrl = oHost.__u4aColTreeCtrl;
            function colFit(i) {   // i = 0-기반 컬럼 인덱스
                if (oCtrl && typeof oCtrl.autoWidth === "function") { return oCtrl.autoWidth(i); }
                // 폴백(ctrl 미부착 — 이론상 없음): 옛 측정 유지.
                var aSel = (i === 0)
                    ? [".u4aColTreeHead .u4aColTreeC1", ".u4aColTreeNameCell"]
                    : [".u4aColTreeHead .u4aColTreeC" + (i + 1), ".u4aColTreeBody .u4aColTreeC" + (i + 1)];
                var mx = 0;
                for (var s = 0; s < aSel.length; s++) {
                    var a = oHost.querySelectorAll(aSel[s]);
                    for (var j = 0; j < a.length; j++) { var w = _bwpCellNat(a[j]); if (w > mx) { mx = w; } }
                }
                return Math.max(minPx, Math.ceil(mx) + slack);
            }
            // ★ 원본 setUiTableAutoResizeColumn + scheduleFitTableColumns 1:1 — 각 컬럼을 콘텐츠 자연폭에 맞추고,
            //   컨테이너보다 좁으면 지정 컬럼(data-bwp-fill)이 잔여폭 흡수. 넓으면 자연폭 유지(가로 스크롤 = 원본).
            //   ★ 스플리터 드래그로는 재호출 안 함(원본 refreshBindLayoutTables 때만).
            //   ★ N컬럼 대응: data-col-count(기본 3). 디자인트리 = 4(이름/경로/MPROP/액션) 또는 3(패키징=MPROP숨김).
            var nCol = parseInt(oHost.getAttribute("data-col-count") || "3", 10);
            if (!(nCol >= 2 && nCol <= 8)) { nCol = 3; }
            var aCol = [];
            for (var k = 0; k < nCol; k++) { aCol[k] = colFit(k); }
            // 잔여폭 흡수 컬럼 = data-bwp-fill(기본 마지막). 디자인트리는 "2"(바인딩경로) → 액션(마지막)은 고정폭.
            var iFill = parseInt(oHost.getAttribute("data-bwp-fill") || String(nCol), 10);
            if (!(iFill >= 1 && iFill <= nCol)) { iFill = nCol; }
            overhead = Math.round(rem * 0.375 * nCol + 1);
            var natTotal = 0; for (var i = 0; i < nCol; i++) { natTotal += aCol[i]; }
            var avail = oHost.clientWidth - overhead;
            if (avail > natTotal) { aCol[iFill - 1] += (avail - natTotal); }
            var total = 0;
            for (var m = 1; m <= nCol; m++) { oHost.style.setProperty("--u4act-c" + m + "-w", aCol[m - 1] + "px"); total += aCol[m - 1]; }
            oHost.style.setProperty("--u4act-total-w", (total + overhead) + "px");
        } catch (e) { console.error("[HTML5][bindWindow] fitTreeColumns:", e && e.message); }
    };

    /************************************************************************
     * 표시 중인 트리 컬럼 재적합 — 원본 refreshBindLayoutTables 대응(화면 커스터마이징 등 레이아웃 변경 후).
     *   ★ 스플리터 드래그로는 호출하지 않는다(원본과 동일 — 드래그 시 컬럼 재계산 없음).
     ************************************************************************/
    oAPP.fn.refitBindTables = function () {
        setTimeout(function () {
            ["bwpModelTree", "bwpDesignTree"].forEach(function (sId) {
                var oHost = document.getElementById(sId);
                if (oHost && oHost.offsetParent !== null) { oAPP.fn.fitTreeColumns(oHost); }
            });
        }, 0);
    };

    /************************************************************************
     * oAPP.H — 바인딩 팝업 전 영역(모델필드/디자인/추가속성/동기화)이 공유하는 UI 헬퍼.
     *   ★ 화면마다 _el/_fa/_statIcon 을 복붙하지 말고 이걸 소비한다(중복 제거).
     ************************************************************************/
    oAPP.H = {
        // DOM 생성.
        el: function (sTag, sClass, sText) {
            var o = document.createElement(sTag);
            if (sClass) { o.className = sClass; }
            if (typeof sText !== "undefined" && sText !== null) { o.textContent = sText; }
            return o;
        },
        // FontAwesome 아이콘 마크업.
        fa: function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; },
        // 공통 아이콘 버튼(.u4a-btn-icon) — 툴바용.
        iconBtn: function (sFa, sTip, fn, sExtraCls) {
            var b = oAPP.H.el("button", "u4a-btn-icon" + (sExtraCls ? " " + sExtraCls : ""));
            b.type = "button";
            b.innerHTML = oAPP.H.fa(sFa);
            if (sTip) { b.title = sTip; b.setAttribute("aria-label", sTip); }
            if (typeof fn === "function") { b.addEventListener("click", fn); }
            return b;
        },
        // 원본 상태 아이콘(sap-icon) → FA + 시맨틱 상태색 클래스(--state-*). (소형 callBindPopup 과 동일 매핑)
        statIcon: function (sSrc) {
            switch (sSrc) {
                case "sap-icon://status-positive": return { fa: "circle-check", cls: "u4aBwpStat--success" };
                case "sap-icon://accept": return { fa: "circle-check", cls: "u4aBwpStat--info" };
                case "sap-icon://share-2": return { fa: "share-nodes", cls: "u4aBwpStat--warning" };
                default: return null;
            }
        },
        // UI5 ValueState(highlight) → 행 좌측 상태바 클래스.
        rowHl: function (sHl) {
            switch (sHl) {
                case "Success": return "u4aBwpRow--success";
                case "Information": return "u4aBwpRow--info";
                case "Warning": return "u4aBwpRow--warning";
                case "Error": return "u4aBwpRow--error";
                default: return "";
            }
        },
        // 메시지 — /U4A/CL_WS_COMMON.
        cl: function (sCode) { try { return oAPP.common.msg("/U4A/CL_WS_COMMON", sCode); } catch (e) { return ""; } },
        // 메시지 — /U4A/MSG_WS.
        mw: function (sCode, p1, p2, p3, p4) { try { return oAPP.common.msg("/U4A/MSG_WS", sCode, p1, p2, p3, p4); } catch (e) { return ""; } },
        // 메시지 — ZMSG_WS_COMMON_001(원본 bindPopup 전 문구가 이 클래스).
        z: function (sNo, p1) { try { return oAPP.common.zmsg(sNo, p1); } catch (e) { return ""; } }
    };

})();
