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

    // busy 를 켤 때마다 증가 — 기다리는 중에 다시 켜면 그 끄기를 버린다(hide 참조).
    var nGen = 0;

    // 끄기 전 기다림의 두 시간값.
    var SETTLE_LIMIT_MS = 5000;         // 상한 — 고장 알림용(정상 경로 아님)

    // 조용함을 보는 창. 마지막 여유도 같은 값을 쓰므로, 끄기 신호부터 실제로 꺼지기까지
    //   **최소 이 값의 2배**가 걸린다(지금 150 × 2 = 300ms).
    //   ★[2026-10-21 장군님 지시] 300 → 150 («0.6초도 왠지 느린 거 같은데.. 전체 0.3초로 맞춰바»).
    //     처음 정한 값은 300 이었고, 그때는 합이 600ms 였다.
    //   ★이 값을 바꾸면 양쪽이 같이 바뀐다 — 고칠 자리는 여기 한 줄뿐이다.
    var QUIET_WINDOW_MS = 150;


    /* ==================================================================
     * 공통 — DOM 변경 세기
     * ================================================================== */

    /** 이 변경이 busy 자신(또는 그 안)에서 난 것인가. */
    function _isBusySelf(oTarget) {

        for (var el = oTarget; el; el = el.parentNode) {

            if (el.id === BUSY_ID) {
                return true;
            }
        }

        return false;
    }

    /** busy 자신을 뺀 변경 건수. */
    function _countOutside(aMut) {

        var nCnt = 0;

        for (var i = 0; i < aMut.length; i++) {

            if (_isBusySelf(aMut[i].target) === false) {
                nCnt++;
            }
        }

        return nCnt;
    }

    /** 가장 넓은 범위로 관찰 — 요소 생김·사라짐 · 속성 · 글자 · 하위 전부. */
    function _observeBody(oObs) {
        oObs.observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });
    }


    /* ==================================================================
     * 개발 모드 확인용 — busy 켠 순간부터 DOM 변경을 세어 둔다
     *   (장군님 지시 2026-10-19) 끌 때 「마지막 변경이 끄기 몇 ms 전이었나」를 같이 찍는다.
     *   ★끄기 판정에는 쓰이지 않는다. 패키징본에서는 아예 돌지 않는다.
     * ================================================================== */

    var oWatch = null;

    function _watchStart() {

        if (!_isDev()) {
            return;
        }

        if (oWatch || typeof MutationObserver !== "function" || !document.body) {
            return;
        }

        var w = { t0: performance.now(), mut: 0, last: -1, obs: null };

        try {

            w.obs = new MutationObserver(function (aMut) {

                var n = _countOutside(aMut);

                if (n > 0) {
                    w.mut += n;
                    w.last = performance.now();
                }
            });

            _observeBody(w.obs);

        } catch (e) {
            _caught("UBSY-004", "U4ABusy watch: observe failed", e);
            return;
        }

        oWatch = w;
    }

    function _watchEnd() {

        var w = oWatch;
        oWatch = null;

        if (!w) {
            return null;
        }

        try {
            if (w.obs) {
                w.obs.disconnect();
            }
        } catch (e) {
            _caught("UBSY-004", "U4ABusy watch: disconnect failed", e);
        }

        var nNow = performance.now();

        return {
            onToOff: Math.round(nNow - w.t0),
            mut: w.mut,
            lastBeforeOff: (w.last < 0 ? -1 : Math.round(nNow - w.last))
        };
    }

    /** 개발 모드인가 — 패키징본에서는 확인용 줄을 안 찍는다. 창마다 APP 이 다른 자리에 있다. */
    function _isDev() {

        try {
            if (typeof APP !== "undefined" && APP && APP.isPackaged === false) {
                return true;
            }
        } catch (e) { /* 이 창에 APP 없음 */ }

        try {
            if (global.parent && global.parent !== global
                && global.parent.APP && global.parent.APP.isPackaged === false) {
                return true;
            }
        } catch (e) { /* cross-origin */ }

        try {
            if (typeof oAPP !== "undefined" && oAPP && oAPP.APP && oAPP.APP.isPackaged === false) {
                return true;
            }
        } catch (e) { /* oAPP 없음 */ }

        return false;
    }

    /** 오류 흔적 — U4ALOG 는 이 파일보다 늦게 로드되므로, 있으면 쓰고 없으면 console. */
    function _caught(sCode, sWhere, e) {

        if (typeof global.U4ALOG !== "undefined" && global.U4ALOG && global.U4ALOG.caught) {
            global.U4ALOG.caught(e);
            return;
        }

        console.error("[" + sCode + "] " + sWhere + " -", e && e.message);
    }


    /* ==================================================================
     * busy 켜기
     * ================================================================== */

    /** busy <dialog> 를 만들어 <body> 에 붙인다(구 ws10_20/index.html 마크업과 같은 구조). */
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
        try {
            _watchStart();
        } catch (e) {
            _caught("UBSY-004", "U4ABusy watch start failed", e);
        }

        var oBusyDom = document.getElementById(BUSY_ID) || _create();

        if (!oBusyDom) {
            return;
        }

        // busy 요소가 <dialog> 면 showModal() 로 띄운다 — 모달 팝업(showModal)도 top-layer 라
        //   일반 <div>(z-index 무한대라도) busy 는 그 뒤로 가려 안 보인다. busy 도 모달이어야
        //   어떤 모달 팝업 위에도 보인다. <dialog> 가 아니면(다른 창) display 토글.
        if (typeof oBusyDom.showModal !== "function") {
            oBusyDom.style.display = "flex";     // 카드 중앙정렬 (스크림 flex center)
            return;
        }

        // busy 중 ESC 로 닫히지 않게(닫혀도 작업은 계속되지만 시각 잠금 유지).
        if (!oBusyDom.__escGuard) {
            oBusyDom.__escGuard = true;
            oBusyDom.addEventListener("cancel", function (e) { e.preventDefault(); });
        }

        if (oBusyDom.open) {
            return;
        }

        try {
            oBusyDom.showModal();
        } catch (e) {
            _caught("UBSY-002", "U4ABusy.show: showModal failed", e);
            oBusyDom.style.display = "flex";
        }
    }


    /* ==================================================================
     * busy 끄기 — 화면이 조용해진 뒤에 끈다
     * ------------------------------------------------------------------
     * 메인 창의 전역 setBusy 와 같은 규칙이다(resources/index.js 참조).
     *
     * ★★★[2026-10-21 장군님 지시] 판정 방식 — 조용함을 보는 창(QUIET_WINDOW_MS).
     *   ① 끄는 시점에 MutationObserver 를 켜고 그 창마다 확인한다.
     *   ② 그 창 안에 변경이 있었으면 한 창 더 기다린다.
     *   ③ 한 창이 지나도 변경이 없으면 그때 requestIdleCallback 을 건다.
     *   ④ 거기 도착하면 한 창 더 기다린 뒤 끈다.
     *   ★④ 의 그 창 동안 일어난 변경은 판정에 쓰지 않는다 — 장군님 「4번이면 이미 끝난 것으로 보라」.
     *     세기만 해서 로그에 남긴다. 다시 세기로 하면 조금씩 계속 바뀌는 화면에서 영영 안 꺼진다.
     *   (구) requestAnimationFrame 으로 「변경 없는 frame 2번 연속」 — 간격이 ~16ms 로 너무 짧았다.
     *   상한(SETTLE_LIMIT_MS)은 ② 자리에서만 본다 — ④ 의 한 창은 상한 뒤에 붙을 수 있다.
     *
     * 기다리는 중 show() 가 오면 끄기를 버린다(세대 번호).
     * 상한에 닿으면 끄고 ERROR 로그 — 정상 경로가 아니라 고장 알림용.
     *
     * ★[2026-10-21 장군님 지시] fnDone — **창이 실제로 닫힌 뒤** 불린다.
     *   까닭: 메인 창 setBusy 가 끄기와 함께 하는 일(마우스 막기 풀기 · 포커스 복원 ·
     *     창 닫기 버튼 활성 · 작업표시줄 진행바)이 **닫힌 뒤에** 돌아야 화면과 어긋나지 않는다.
     *   기다리는 중에 show() 가 와서 이 끄기를 버린 경우에는 **부르지 않는다**(창이 안 닫혔으니).
     *   인자 없이 부르면 종전과 똑같다 — 별창 20여 곳이 그렇게 부른다.
     * ================================================================== */
    function hide(fnDone) {

        function _done() {

            if (typeof fnDone !== "function") {
                return;
            }

            try {
                fnDone();
            } catch (e) {
                _caught("UBSY-003", "U4ABusy.hide: fnDone failed", e);
            }
        }

        // 한 번도 안 켰으면 요소가 없다 — 끌 것이 없는 정상 상태라 로그를 남기지 않는다.
        var oBusyDom = document.getElementById(BUSY_ID);

        if (!oBusyDom) {
            _done();                        // 끌 것이 없다 = 이미 꺼진 상태 → 뒷정리는 해 준다
            return;
        }

        function _doHide() {

            if (typeof oBusyDom.showModal !== "function") {
                oBusyDom.style.display = "none";
                _done();
                return;
            }

            if (!oBusyDom.open) {
                _done();                    // 이미 닫혀 있다 → 뒷정리는 해 준다
                return;
            }

            try {
                oBusyDom.close();
            } catch (e) {
                _caught("UBSY-003", "U4ABusy.hide: close failed", e);
            }

            _done();
        }

        // 쓸 수 없는 환경이면 종전대로 즉시 끈다(동작 유지).
        if (typeof MutationObserver !== "function" || !document.body) {
            _doHide();
            return;
        }

        var nMyGen = nGen;
        var t0 = performance.now();
        var oObs = null;
        var bEnded = false;
        var bDirty = false;                 // 지금 창 안에 변경이 있었나
        var nQuietMs = -1;                  // 조용해진 시점(-1 = 아직)
        var nIdleMs = -1;                   // 한가해진 시점(-1 = 아직)
        var nLateMut = 0;                   // 마지막 여유 중의 변경 건수(기록용)
        var nRounds = 0;                    // 창을 다시 센 횟수


        function _finish(sHow) {

            if (bEnded) {
                return;
            }
            bEnded = true;

            try {
                if (oObs) {
                    oObs.disconnect();
                    oObs = null;
                }
            } catch (e) {
                _caught("UBSY-004", "U4ABusy.hide: observer disconnect failed", e);
            }

            // 기다리는 사이에 다시 켰다 → 그 busy 를 끄면 안 된다.
            if (nMyGen !== nGen) {
                return;
            }

            var nTotal = Math.round(performance.now() - t0);

            if (sHow === "LIMIT") {
                console.error("[UBSY-005] BUSY_OFF_LIMIT: DOM not settled within "
                    + SETTLE_LIMIT_MS + "ms - turning busy off anyway");

            } else if (nLateMut > 0) {
                console.warn("[UBSY-006] BUSY_OFF_LATE_DOM: " + nLateMut + " mutations during final grace"
                    + ", quiet=" + nQuietMs + "ms total=" + nTotal + "ms");
            }

            // ★ [2026-10-19 장군님 지시] 눈으로 확인하실 수 있게 개발 모드에서는 꺼질 때마다 한 줄 찍는다.
            if (_isDev()) {

                var oW = _watchEnd();

                if (oW) {
                    console.log("[BUSY] on→off=" + oW.onToOff + "ms"
                        + " mut=" + oW.mut
                        + " lastChangeBeforeOff=" + (oW.lastBeforeOff < 0 ? "none" : oW.lastBeforeOff + "ms")
                        + " lateMut=" + nLateMut
                        + " (offSignal→off=" + nTotal + "ms"
                        + " quiet=" + nQuietMs + "ms idle=" + nIdleMs + "ms rounds=" + nRounds + ")");
                }
            }

            _doHide();
        }


        try {

            oObs = new MutationObserver(function (aMut) {

                var nCnt = _countOutside(aMut);

                if (nCnt === 0) {
                    return;
                }

                // 아직 조용함을 못 봤다 → 지금 창을 「변경 있었음」 으로(창을 다시 센다).
                if (nQuietMs < 0) {
                    bDirty = true;
                    return;
                }

                // 마지막 여유 중 → 세기만 한다(판정에 쓰지 않음 — 위 ★ 참조).
                nLateMut += nCnt;
            });

            _observeBody(oObs);

        } catch (e) {
            _caught("UBSY-004", "U4ABusy.hide: observe failed", e);
            _doHide();
            return;
        }


        // ①② 조용함을 보는 창 — 그 안에 변경이 있었으면 한 창 더. 없으면 조용해진 것으로 본다.
        function _checkQuiet() {

            if (bEnded) {
                return;
            }

            if (bDirty === true) {

                bDirty = false;
                nRounds++;

                // 상한은 이 자리에서만 본다 — 계속 바뀌는 화면에서 영영 안 꺼지는 것을 막는다.
                if (performance.now() - t0 > SETTLE_LIMIT_MS) {
                    _finish("LIMIT");
                    return;
                }

                setTimeout(_checkQuiet, QUIET_WINDOW_MS);
                return;
            }

            nQuietMs = Math.round(performance.now() - t0);

            _waitIdle();
        }


        // ③④ 브라우저가 한가해지면 한 창 더 기다린 뒤 끈다(그 사이 변경은 보지 않는다).
        function _waitIdle() {

            if (typeof requestIdleCallback !== "function") {
                _afterIdle();               // 없는 환경이면 ①② 만으로 판정
                return;
            }

            // 남은 상한만큼만 기다린다 — 한가해지지 않아도 그 시간에 도착한다.
            var nLeft = SETTLE_LIMIT_MS - (performance.now() - t0);

            requestIdleCallback(_afterIdle, { timeout: (nLeft > 0 ? nLeft : 0) });
        }

        function _afterIdle() {

            if (bEnded) {
                return;
            }

            nIdleMs = Math.round(performance.now() - t0);

            setTimeout(function () { _finish("BOTH"); }, QUIET_WINDOW_MS);
        }


        setTimeout(_checkQuiet, QUIET_WINDOW_MS);
    }


    global.U4ABusy = { show: show, hide: hide };

})(window);
