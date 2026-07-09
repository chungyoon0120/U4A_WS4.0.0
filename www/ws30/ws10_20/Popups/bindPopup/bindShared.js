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
