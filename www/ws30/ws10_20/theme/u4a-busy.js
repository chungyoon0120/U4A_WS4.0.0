// 오류코드 접두: UBSY / 다음 번호: 007
/************************************************************************
 * U4A Workspace — 공통 busy (window.U4ABusy)  · 짝 = u4a-busy.css
 * ----------------------------------------------------------------------
 * [2026-09-15, 장군님 지시] busy 도 하나의 UI — 공통 화면 리소스(theme/) 전용 파일로 옮기고,
 *   화면 시작 때 가장 먼저 로드한다(ws10_20/index.html <head> 맨 앞, jQuery 보다 앞).
 *   옮겨온 곳 = resources/index.js 의 setDomBusy 본체 + ws10_20/index.html 의 <dialog>.
 *
 *   · U4ABusy.show() / U4ABusy.hide()
 *   · busy 화면(<dialog>)은 처음 show() 때 스스로 만들어 <body> 끝에 붙인다.
 *     로드되자마자 만들지 않는 이유: <head> 에서 로드되는 순간엔 <body> 가 아직 없다.
 *     busy 를 켜는 호출은 전부 <body> 가 생긴 뒤에 온다.
 *   · id·class 는 옛 이름 그대로(u4aWsBusyIndicator · u4aWsBusyTitle · u4aWsBusyText) —
 *     카드 제목·문구 넣는 곳(ws_html5_shell.js), 로그인 남은 초 표시(Login.js),
 *     로그의 busy 상태 확인(ws_html5_logger.js)이 이 id 로 찾는다.
 *   · 켜고 끄는 동작은 옛 setDomBusy 그대로(showModal · ESC 막기 · showModal 실패 시 display flex).
 *   · 기존 호출 이름 setDomBusy(resources/index.js)는 그대로 두고 여기로 넘긴다.
 *   · U4AUI 아래에 두지 않는다 — u4a-ui.js 가 global.U4AUI 를 새 객체로 통째로 대입해 지워진다.
 ************************************************************************/
(function (global) {
    "use strict";

    var BUSY_ID = "u4aWsBusyIndicator";
    var nGen = 0;                       // busy 를 켤 때마다 증가 — 대기 중 끄기를 무효화한다(hide 설명 참조)
    var SETTLE_LIMIT_MS = 5000;         // 상한 — 고장 알림용(정상 경로 아님)

    /************************************************************************
     * busy 켠 순간부터 DOM 변경을 세어 둔다 (장군님 지시 2026-10-19 — 눈으로 확인용)
     *   끌 때 「마지막 DOM 변경이 끄기 몇 ms 전이었나」를 같이 찍는다.
     ************************************************************************/
    var oWatch = null;

    function _watchStart() {
        if (!_isDev() || oWatch || typeof MutationObserver !== "function" || !document.body) { return; }
        var w = { t0: performance.now(), mut: 0, last: -1, obs: null };
        try {
            w.obs = new MutationObserver(function (aMut) {
                var n = 0;
                for (var i = 0; i < aMut.length; i++) {
                    var bSelf = false;
                    for (var el = aMut[i].target; el; el = el.parentNode) {
                        if (el.id === BUSY_ID) { bSelf = true; break; }
                    }
                    if (!bSelf) { n++; }
                }
                if (n > 0) { w.mut += n; w.last = performance.now(); }
            });
            w.obs.observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });
        } catch (e) { _caught("UBSY-004", "U4ABusy watch: observe failed", e); return; }
        oWatch = w;
    }

    function _watchEnd() {
        var w = oWatch;
        oWatch = null;
        if (!w) { return null; }
        try { if (w.obs) { w.obs.disconnect(); } } catch (e) { _caught("UBSY-004", "U4ABusy watch: disconnect failed", e); }
        var nNow = performance.now();
        return { onToOff: Math.round(nNow - w.t0), mut: w.mut, lastBeforeOff: (w.last < 0 ? -1 : Math.round(nNow - w.last)) };
    }

    /** 개발 모드인가 — 패키징본에서는 확인용 줄을 안 찍는다. 창마다 APP 이 다른 자리에 있다. */
    function _isDev() {
        try { if (typeof APP !== "undefined" && APP && APP.isPackaged === false) { return true; } } catch (e) { /* 창에 APP 없음 */ }
        try { if (global.parent && global.parent !== global && global.parent.APP && global.parent.APP.isPackaged === false) { return true; } } catch (e) { /* cross-origin */ }
        try { if (typeof oAPP !== "undefined" && oAPP && oAPP.APP && oAPP.APP.isPackaged === false) { return true; } } catch (e) { /* oAPP 없음 */ }
        return false;
    }

    // 오류 흔적 — 로그 함수(U4ALOG)는 이 파일보다 늦게 로드되므로 부르는 시점에 있으면 쓰고, 없으면 console.
    function _caught(sCode, sWhere, e) {
        if (typeof global.U4ALOG !== "undefined" && global.U4ALOG && global.U4ALOG.caught) {
            global.U4ALOG.caught(e);
            return;
        }
        console.error("[" + sCode + "] " + sWhere + " -", e && e.message);
    }

    // busy <dialog> 를 만들어 <body> 에 붙인다(구 ws10_20/index.html 마크업과 같은 구조).
    function _create() {

        var oBody = document.body;
        if (!oBody) {
            console.error("[UBSY-001] U4ABusy.show: document.body not ready - busy dialog not created, busy not shown");
            return null;
        }

        var oDlg = document.createElement("dialog");
        oDlg.id = BUSY_ID;
        oDlg.className = "u4aWsBusyIndicator";
        oDlg.setAttribute("data-act", "BUSY");   // 2026-10-14 자동 테스트 도구가 집을 이름(.analy/21)
        oDlg.innerHTML =
            '<div class="u4aWsBusyCard">' +
                '<div class="u4aWsSpinner"></div>' +
                '<div class="u4aWsBusyTitle" id="u4aWsBusyTitle"></div>' +
                '<div class="u4aWsBusyText" id="u4aWsBusyText"></div>' +
            '</div>';

        oBody.appendChild(oDlg);

        return oDlg;
    }

    function show() {

        // ★ 켤 때 세대를 올린다 — 대기 중이던 끄기가 이 busy 를 꺼 버리지 않게(아래 hide 설명).
        nGen++;

        // 켠 순간부터 DOM 변경을 세어 둔다(개발 모드 확인용).
        try { _watchStart(); } catch (e) { _caught("UBSY-004", "U4ABusy watch start failed", e); }

        var oBusyDom = document.getElementById(BUSY_ID) || _create();
        if (!oBusyDom) {
            return;
        }

        // busy 요소가 <dialog> 면 showModal() 로 띄운다 — 모달 팝업(showModal)도 top-layer 라
        //   일반 <div>(z-index 무한대라도) busy 는 그 뒤로 가려 안 보인다. busy 도 모달이어야
        //   어떤 모달 팝업 위에도 보인다. <dialog> 가 아니면(다른 창) display 토글.
        var bIsDialog = (typeof oBusyDom.showModal === "function");

        if (bIsDialog) {
            if (!oBusyDom.__escGuard) {
                oBusyDom.__escGuard = true;
                // busy 중 ESC 로 닫히지 않게(닫혀도 작업은 계속되지만 시각 잠금 유지).
                oBusyDom.addEventListener("cancel", function (e) { e.preventDefault(); });
            }
            if (!oBusyDom.open) {
                try { oBusyDom.showModal(); } catch (e) { _caught("UBSY-002", "U4ABusy.show: showModal failed", e); oBusyDom.style.display = "flex"; }
            }
        } else {
            oBusyDom.style.display = "flex"; // 카드 중앙정렬 (스크림 flex center)
        }

    }

    /********************************************************************
     * busy 를 끄기 전에 「화면이 다 그려졌는지」 확인한다 (장군님 지시 2026-10-19)
     * ------------------------------------------------------------------
     * 메인 창의 전역 setBusy 와 같은 규칙이다(resources/index.js 참조).
     *   ① DOM 이 조용해짐(MutationObserver, 2 frame 연속 변경 없음)
     *   ② 브라우저가 한가해짐(requestIdleCallback)
     * 둘 다 와야 끈다. 기다리는 중 show() 가 오면 끄기를 버린다(세대 번호).
     * 상한에 닿으면 끄고 ERROR 로그 — 정상 경로가 아니라 고장 알림용.
     ********************************************************************/
    function hide() {

        // 한 번도 안 켰으면 요소가 없다 — 끌 것이 없는 정상 상태라 로그를 남기지 않는다.
        var oBusyDom = document.getElementById(BUSY_ID);
        if (!oBusyDom) {
            return;
        }

        function _doHide() {
            if (typeof oBusyDom.showModal === "function") {
                if (oBusyDom.open) { try { oBusyDom.close(); } catch (e) { _caught("UBSY-003", "U4ABusy.hide: close failed", e); } }
            } else {
                oBusyDom.style.display = "none";
            }
        }

        // 쓸 수 없는 환경이면 종전대로 즉시 끈다(동작 유지).
        if (typeof MutationObserver !== "function" || !document.body) {
            _doHide();
            return;
        }

        var nMyGen = nGen;
        var t0 = performance.now();
        var nLast = t0, nPrev = -1, nQuietFrames = 0;
        var oObs = null, bEnded = false, bIdleCame = false;
        var nQuietMs = -1, nIdleMs = -1, nMutAfterQuiet = 0;

        function _finish(sHow) {

            if (bEnded) { return; }
            bEnded = true;

            try { if (oObs) { oObs.disconnect(); oObs = null; } }
            catch (e) { _caught("UBSY-004", "U4ABusy.hide: observer disconnect failed", e); }

            if (nMyGen !== nGen) { return; }      // 기다리는 사이에 다시 켰다 → 끄지 않는다

            var nTotal = Math.round(performance.now() - t0);

            if (sHow === "LIMIT") {
                console.error("[UBSY-005] BUSY_OFF_LIMIT: DOM not settled within " + SETTLE_LIMIT_MS + "ms - turning busy off anyway");
            } else if (nMutAfterQuiet > 0) {
                console.warn("[UBSY-006] BUSY_OFF_LATE_DOM: " + nMutAfterQuiet + " mutations after quiet, quiet=" + nQuietMs + "ms total=" + nTotal + "ms");
            }

            // ★ [2026-10-19 장군님 지시] 눈으로 확인하실 수 있게 개발 모드에서는 꺼질 때마다 한 줄 찍는다.
            if (_isDev()) {
                var oW = _watchEnd();
                if (oW) {
                    console.log("[BUSY] on→off=" + (oW ? oW.onToOff : "?") + "ms"
                    + " mut=" + (oW ? oW.mut : "?")
                    + " lastChangeBeforeOff=" + (oW ? (oW.lastBeforeOff < 0 ? "none" : oW.lastBeforeOff + "ms") : "?")
                    + " lateMut=" + nMutAfterQuiet
                    + " (offSignal→off=" + nTotal + "ms quiet=" + nQuietMs + "ms idle=" + nIdleMs + "ms)");
                }
            }

            _doHide();
        }

        try {
            oObs = new MutationObserver(function (aMut) {
                var nCnt = 0;
                for (var i = 0; i < aMut.length; i++) {
                    var bSelf = false;
                    for (var el = aMut[i].target; el; el = el.parentNode) {
                        if (el.id === BUSY_ID) { bSelf = true; break; }
                    }
                    if (!bSelf) { nCnt++; }
                }
                if (nCnt === 0) { return; }
                if (nQuietMs < 0) { nLast = performance.now(); }
                else { nMutAfterQuiet += nCnt; }
            });
            oObs.observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });
        } catch (e) {
            _caught("UBSY-004", "U4ABusy.hide: observe failed", e);
            _doHide();
            return;
        }

        function _tick() {
            if (bEnded || nQuietMs >= 0) { return; }
            if (nLast === nPrev) { nQuietFrames++; } else { nQuietFrames = 0; nPrev = nLast; }
            if (nQuietFrames >= 2) {
                nQuietMs = Math.round(nLast - t0);
                if (bIdleCame) { _finish("BOTH"); }
                return;
            }
            if (performance.now() - t0 > SETTLE_LIMIT_MS) { _finish("LIMIT"); return; }
            requestAnimationFrame(_tick);
        }

        function _onIdle() {
            bIdleCame = true;
            nIdleMs = Math.round(performance.now() - t0);
            if (nQuietMs >= 0) { _finish("BOTH"); }
        }

        requestAnimationFrame(_tick);

        if (typeof requestIdleCallback === "function") {
            requestIdleCallback(_onIdle, { timeout: SETTLE_LIMIT_MS });
        } else {
            _onIdle();
        }

    }

    global.U4ABusy = { show: show, hide: hide };

})(window);
