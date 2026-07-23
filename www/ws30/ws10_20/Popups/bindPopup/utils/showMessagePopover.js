/****************************************************************************
 * Binding Popup(대형 별창) 오류목록 팝오버 — HTML5 (SPEC §6)
 * --------------------------------------------------------------------------
 *  원본: utils/showMessagePopover.js (sap.m.MessagePopover + MessageItem + Link) 1:1 이식.
 *    · 검증 실패 오류(TY_BIND_ERROR)를 N건 목록으로 표시.
 *    · 각 항목에 "오류 위치 확인"(msg 091) 링크 — LK_VIS 로 노출 제어.
 *      클릭 시 ACTCD 로 라우팅해 실제 오류 위치를 강조/스크롤 이동(원본 onSelLink).
 *    · 닫힐 때 clearError() — 디자인트리/추가속성 오류 표시 전부 초기화(원본 afterClose).
 *
 *  ★ 시그니처·완료시점 유지: oAPP.fn.showMessagePopoverOppener(oTarget, aMessage) → Promise
 *    (원본 index.js showMessagePopoverOppener 가 동적 import 후 default(oTarget, aMessage) 호출한 것과 동일 계약)
 *  ★ HTML5: sap 의존 제거하고 DOM 팝오버로. 바인딩 팝업 전용(공통 u4a-ui.js 미수정 — .analy/16 §0.5, 장군님 지시 A안).
 *    색/그림자는 공통 토큰만(--popover-bg/--popover-shadow/--state-error…), 하드코딩 hex 금지.
 *  ★ 앵커: 원본 openBy(oTarget) = 클릭한 버튼 기준. placement "PreferredLeftOrFlip"(좌측 우선→flip) 대응 +
 *    타이틀바 침범 금지(.analy/16 §2.2 상단 클램프) + 뷰포트 밖 보정 + resize 시 닫기(앵커 오버레이 규칙).
 ****************************************************************************/
(function () {
    "use strict";

    var oAPP = window.oAPP;
    if (!oAPP || !oAPP.fn || !oAPP.H) { return; }

    var H = oAPP.H;
    var oPop = null;          // 현재 열린 팝오버 DOM
    var fnOnDocDown = null;   // 바깥 클릭/리사이즈 닫기 핸들러

    /* ── 닫기(원본 closeMessagePopover + afterClose) ─────────────────────── */
    oAPP.fn.closeMessagePopover = function () {
        if (!oPop) { return; }
        try { oPop.remove(); } catch (e) { }
        oPop = null;
        if (fnOnDocDown) {
            document.removeEventListener("mousedown", fnOnDocDown, true);
            window.removeEventListener("resize", fnOnDocDown, true);
            fnOnDocDown = null;
        }
        _clearError();
    };

    // 오류 표시 초기화(원본 clearError) — 디자인트리 + 추가속성 양쪽. 각 영역이 제공하는 API 만 소비.
    function _clearError() {
        try { if (typeof oAPP.fn.resetErrorField === "function") { oAPP.fn.resetErrorField(); } } catch (e) { }
        try { if (typeof oAPP.fn.clearAdditErrorMark === "function") { oAPP.fn.clearAdditErrorMark(); } } catch (e) { }
        try { if (typeof oAPP.fn.refreshDesignTree === "function") { oAPP.fn.refreshDesignTree(); } } catch (e) { }
    }

    /* ── 위치 계산(원본 placement PreferredLeftOrFlip) ───────────────────── */
    function _place(oEl, oTarget) {
        var GAP = 8, EDGE = 8;
        var oTitle = document.querySelector(".u4a-titlebar");
        var iTop0 = oTitle ? Math.round(oTitle.getBoundingClientRect().bottom) : 0;

        var r = oTarget.getBoundingClientRect();
        var w = oEl.offsetWidth, h = oEl.offsetHeight;

        // 좌측 우선 → 공간 부족하면 우측으로 flip.
        var left = r.left - w - GAP;
        if (left < EDGE) {
            left = r.right + GAP;
            if (left + w > window.innerWidth - EDGE) { left = Math.max(EDGE, window.innerWidth - w - EDGE); }
        }
        // 세로: 앵커 상단 정렬 후 뷰포트/타이틀바 안으로 클램프.
        var top = r.top;
        if (top + h > window.innerHeight - EDGE) { top = window.innerHeight - h - EDGE; }
        if (top < iTop0 + EDGE) { top = iTop0 + EDGE; }

        oEl.style.left = Math.round(left) + "px";
        oEl.style.top = Math.round(top) + "px";
    }

    /* ── 항목 렌더(원본 MessageItem: TITLE/DESC/TYPE + Link 091) ─────────── */
    function _row(oMsg) {
        var oLi = H.el("li", "u4aBwpMsgItem");

        var oIco = H.el("span", "u4aBwpMsgIco");
        oIco.innerHTML = H.fa("circle-xmark");
        oLi.appendChild(oIco);

        var oBody = H.el("div", "u4aBwpMsgBody");
        oBody.appendChild(H.el("div", "u4aBwpMsgTitle", oMsg.TITLE || ""));
        if (oMsg.DESC && oMsg.DESC !== oMsg.TITLE) {
            oBody.appendChild(H.el("div", "u4aBwpMsgDesc", oMsg.DESC));
        }

        // "오류 위치 확인"(091) — 원본 LK_VIS. 이동 대상(LINE_KEY)이 있어야 의미가 있다.
        if (oMsg.LK_VIS !== false && oMsg.LINE_KEY) {
            var oLink = H.el("button", "u4aBwpMsgLink");
            oLink.type = "button";
            oLink.textContent = H.z("091");   // 091 오류 위치 확인
            oLink.title = H.z("091");
            oLink.addEventListener("click", function (e) { e.stopPropagation(); _onSelLink(oMsg); });
            oBody.appendChild(oLink);
        }

        oLi.appendChild(oBody);
        return oLi;
    }

    /* ── 링크 라우팅(원본 onSelLink — ACTCD 분기) ────────────────────────── */
    function _onSelLink(oMsg) {
        var A = oAPP.attr.CS_MSG_ACTCD || {};
        if (!oMsg.LINE_KEY) { return; }

        switch (oMsg.ACTCD) {
            case A.ACT04:   // 디자인 트리 라인 → 강조 + 스크롤 이동(원본 setFocusErrorDesignLine).
                if (typeof oAPP.fn.focusErrorDesignLine === "function") { oAPP.fn.focusErrorDesignLine(oMsg.LINE_KEY); }
                break;
            case A.ACT05:   // 우측 추가속성 라인(원본 setFocusErrorBindAdditLine).
                if (typeof oAPP.fn.focusErrorAdditLine === "function") { oAPP.fn.focusErrorAdditLine(oMsg.LINE_KEY, "MAIN"); }
                break;
            case A.ACT07:   // 중앙 하단 추가속성 라인(원본 setFocusErrorDesignBindAdditLine).
                if (typeof oAPP.fn.focusErrorAdditLine === "function") { oAPP.fn.focusErrorAdditLine(oMsg.LINE_KEY, "SEL"); }
                break;
            // ACT01/02/03/06 = 영역 단위 — 원본도 본문이 비어 있다(no-op).
            default:
                break;
        }
    }

    /* ── [PUBLIC] 열기 — 원본 default(oTarget, aMessage) 1:1 ─────────────── */
    oAPP.fn.showMessagePopoverOppener = function (oTarget, aMessage) {
        return new Promise(function (resolve) {
            if (!oTarget) { return resolve(); }              // 원본: target 없으면 그대로 종료.
            var aMsg = aMessage || [];
            if (aMsg.length === 0) { return resolve(); }

            oAPP.fn.closeMessagePopover();                   // 기존 팝오버 종료(원본).

            oPop = H.el("div", "u4aBwpMsgPop");
            oPop.setAttribute("role", "dialog");

            // 헤더 — 건수 + 닫기.
            var oHead = H.el("div", "u4aBwpMsgHead");
            oHead.appendChild(H.el("span", "u4aBwpMsgCnt", String(aMsg.length)));
            oHead.appendChild(H.el("span", "u4aBwpToolSpacer"));
            var oX = H.el("button", "u4aBwpMsgClose");
            oX.type = "button";
            oX.innerHTML = H.fa("xmark");
            oX.title = H.cl("A39");
            oX.addEventListener("click", function () { oAPP.fn.closeMessagePopover(); });
            oHead.appendChild(oX);
            oPop.appendChild(oHead);

            // 목록.
            var oUl = H.el("ul", "u4aBwpMsgList");
            for (var i = 0; i < aMsg.length; i++) { oUl.appendChild(_row(aMsg[i])); }
            oPop.appendChild(oUl);

            document.body.appendChild(oPop);
            _place(oPop, oTarget);

            // 바깥 클릭 / 리사이즈 → 닫기(앵커 오버레이 재배치 규칙).
            fnOnDocDown = function (ev) {
                if (ev && ev.type === "mousedown" && oPop && oPop.contains(ev.target)) { return; }
                oAPP.fn.closeMessagePopover();
            };
            document.addEventListener("mousedown", fnOnDocDown, true);
            window.addEventListener("resize", fnOnDocDown, true);

            resolve();   // 원본 afterOpen → resolve.
        });
    };

})();
