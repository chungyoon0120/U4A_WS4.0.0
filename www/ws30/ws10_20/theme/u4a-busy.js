// 오류코드 접두: UBSY / 다음 번호: 012
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

    // WS 로고 SVG — busy 그림 두 가지가 같이 쓴다. 복사하지 말고 이 상수를 쓴다.
    var WS_LOGO_SVG =
        '<svg class="logo" viewBox="0 0 307 311" aria-hidden="true">' +
            '<path d="M4 4 50 4 50 211 9 211Z"/>' +
            '<path d="M91 4 127 4 54 211 21 211Z"/>' +
            '<path d="M98 4 134 4 134 211 102 211Z"/>' +
            '<path d="M176 4 222 4 146 211 106 211Z"/>' +
            '<path d="M236 93 254 93 266 95 270 96 277 99 283 103 288 107 294 114 296 117 299 122 301 128 302 132 303 139 303 154 302 158 301 159 258 159 257 158 257 157 257 146 255 141 254 139 251 136 248 134 244 133 238 132 233 132 230 133 225 135 219 139 215 145 213 149 212 153 212 158 213 163 217 169 221 173 224 175 234 178 259 189 269 194 276 200 280 204 283 208 287 214 289 220 290 224 290 233 290 238 289 247 287 255 284 263 281 269 277 274 272 280 267 285 255 294 249 298 242 301 234 304 226 306 214 307 196 307 184 305 180 304 172 301 166 297 161 293 156 287 154 284 151 278 149 273 148 269 146 261 146 247 147 242 148 242 191 242 192 243 193 244 193 255 194 259 196 262 199 265 202 267 205 268 211 268 216 268 219 267 225 265 230 261 235 256 236 252 237 248 237 242 236 237 233 232 228 228 225 226 215 222 191 212 181 206 174 201 169 197 166 193 163 186 161 180 160 176 159 168 160 162 161 154 163 146 166 138 169 132 172 126 177 121 183 115 194 106 200 103 207 100 215 97 223 95Z"/>' +
        '</svg>';


    // busy 를 켤 때마다 증가 — 기다리는 중에 다시 켜면 그 끄기를 버린다(hide 참조).
    var nGen = 0;

    // 끄기 전 기다림의 두 시간값.
    /************************************************************************
     * ★★[2026-10-22 장군님 결정] 시간이 지났다고 **busy 를 강제로 끄지 않는다.**
     * ----------------------------------------------------------------------
     * 「차라리 오류가 나서 busy 가 안 꺼지는 게 더 낫지, 괜히 일정 시간 지났다고
     *  강제로 껐다가 다른 액션에서 꼬이거나 데이터 잘못되면 책임 누가 질 건데?」
     * 「제일 리스크는 잘못된 데이터가 저장되버리면 이거 복구하기도 힘들잖아」
     *
     * busy 는 **하나의 요청이 끝날 때까지 중복 요청을 막아 프로세스가 꼬이지 않게** 하는 것이다.
     * 화면 그리기도 그 요청의 일부라, 다 안 그려졌는데 끄면 그 목적이 깨진다.
     * → **fail-closed**: 못 끝내면 켠 채로 둔다. 멈춘 것처럼 보이는 편이
     *   잘못된 데이터가 저장되는 것보다 낫다(매번 백업하는 전략도 없다).
     *
     * 아래 값은 **끄는 기준이 아니다** — 「너무 오래 걸린다」고 한 번 알리는 기준이다.
     ************************************************************************/
    var SLOW_WARN_MS = 5000;

    // 한가해지기를 기다리는 자리의 상한 — 거긴 **이미 조용해진 뒤**라 곧 온다.
    //   한가해지지 않아도 이 시간에 진행한다(조용한 상태였으므로 끄는 것이 맞다).
    var IDLE_TIMEOUT_MS = 5000;

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
    /**
     * AI 전용 그림의 빛 입자 12개 HTML.
     * ★[2026-10-30 장군님 지시] AI 전용 그림 = 시안 40안 01 Beam + Data Flow.
     *   입자는 로고 칸(.lg) 안에 두고, 로고 가운데에서 --x · --y 만큼 떨어진 곳에서 출발해
     *   로고로 빨려 든다. 카드 가운데 기준으로 옮기면 엉뚱한 곳으로 모인다(지침서 2절).
     *   줄마다 복붙하지 않고 표로 둔다 — 자리를 고칠 때 이 표 한 곳만 고친다.
     */
    var AI_PARTICLES = [
        { x: -150, y: -46, delay: "0s" },
        { x: 96, y: -50, delay: "-0.3s" },
        { x: -120, y: 52, delay: "-0.6s" },
        { x: 92, y: 48, delay: "-0.9s" },
        { x: -60, y: -64, delay: "-1.2s" },
        { x: 40, y: -66, delay: "-1.5s" },
        { x: -176, y: 4, delay: "-1.8s" },
        { x: 110, y: 0, delay: "-2.1s" },
        { x: -30, y: 64, delay: "-0.45s" },
        { x: 60, y: 60, delay: "-0.75s" },
        { x: -10, y: -70, delay: "-1.05s" },
        { x: 10, y: 70, delay: "-1.65s" }
    ];

    function _aiParticlesHtml() {

        var sHtml = "";
        var i;
        var oP;

        for (i = 0; i < AI_PARTICLES.length; i++) {

            oP = AI_PARTICLES[i];

            sHtml += '<i class="p" style="--x:' + oP.x + 'px;--y:' + oP.y + 'px;animation-delay:' + oP.delay + '"></i>';
        }

        return sHtml;
    }

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

        // ★[2026-10-29 장군님 결정] 모양 = Sparkle 시안(u4a-busy.css 의 「중앙 카드 = Sparkle」 참조).
        //   빈 요소라 글자는 없다 — 모양은 전부 CSS 가 그린다.
        // ★[2026-10-30] 움직임은 전부 transform · opacity 로만 낸다 — 무거운 동기 작업이 main thread 를
        //   붙잡으면 각도(@property)·background-position 애니메이션은 멈추지만 transform 은 안 멈춘다.
        //   · <span class="u4aWsBusyEdge"><i></i></span> = 카드 테두리를 도는 빛(큰 원뿔 판을 rotate)
        // ★[2026-10-30 장군님 지시] 가운데 그림 = 시안 「18안 · 개발 툴킷」의 04번 API Call.
        //   WS 앱(왼쪽 로고)에서 서버(오른쪽 칸 3개)로 GET 이 날아가고, 서버가 깜빡여 처리한 뒤
        //   JSON 이 돌아오면 "200 OK" 가 뜬다 — 서버와 통신하는 중이라는 뜻.
        //   시안 출처 = busy_indicators.html #18-api. 모양은 전부 짝 CSS(.u4aWsBusyApi)가 그린다.
        oDlg.innerHTML =
            // ★[2026-10-30 장군님 지시] AI 모드일 때 화면 가장자리에 빛이 깔리고 **숨 쉬듯** 밝기가 오르내린다.
            //   평소에는 CSS 가 숨긴다. 모양은 전부 짝 CSS(.u4aWsBusyAura)가 그린다.
            '<span class="u4aWsBusyAura">' +
                '<i></i>' +
            '</span>' +
            '<div class="u4aWsBusyCard">' +
                '<span class="u4aWsBusyEdge">' +
                    '<i></i>' +
                '</span>' +
                '<div class="u4aWsBusyApi">' +
                    WS_LOGO_SVG +
                    '<b class="wire"></b>' +
                    '<span class="pk req"><em>GET</em></span>' +
                    '<span class="pk res"><em>JSON</em></span>' +
                    '<div class="srv">' +
                        '<i></i>' +
                        '<i></i>' +
                        '<i></i>' +
                    '</div>' +
                    '<span class="ok">200 OK</span>' +
                '</div>' +

                // ★[2026-10-30 장군님 지시] setAIBusy 전용 그림 = 시안 「40안 · 조합」의 01번 Beam + Data Flow.
                //   종전 23안 03 AI Steering 을 대체한다(두 벌 남기지 않는다).
                //   「AI」 글씨에서 빛줄기가 뻗어 WS 로고에 닿으면 로고 뒤가 환해지고(1.8초 박자),
                //   사방에서 빛 입자 12개가 로고로 빨려 든다(2.4초) — AI 가 WS4.0 으로 일을 보내는 중이라는 뜻.
                //   평소에는 숨어 있고, 카드에 data-u4a-busy-mode="ai" 가 붙으면 이쪽이 보인다.
                //   ★AI 모드에서는 카드 테두리를 도는 빛(u4aWsBusyEdge)을 CSS 로 끈다.
                '<div class="u4aWsBusyAi">' +
                    '<span class="ai">AI</span>' +
                    '<b class="ln">' +
                        '<i class="flare"></i>' +
                        '<i class="ray"></i>' +
                    '</b>' +
                    '<span class="lg">' +
                        '<i class="core"></i>' +
                        _aiParticlesHtml() +
                        '<i class="glow"></i>' +
                        WS_LOGO_SVG +
                    '</span>' +
                '</div>' +
                '<div class="u4aWsBusyTitle" id="u4aWsBusyTitle"></div>' +
                '<div class="u4aWsBusyText" id="u4aWsBusyText"></div>' +
            '</div>';

        oBody.appendChild(oDlg);

        return oDlg;
    }

    function _showCore() {

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
     *   ★상한에 닿아도 **끄지 않는다** — 위 SLOW_WARN_MS 설명 참조(장군님 결정 2026-10-22).
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
    function _hideCore(fnDone, bNow) {

        function _done() {

            // 기다리던 뒷일(afterOff)을 먼저 비운다 — 여기가 「실제로 꺼진」 자리다.
            _flushAfterOff();

            _runDone(fnDone);
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

        // ★★★[2026-10-30 장군님 지시 「그렇게 해라」] AI busy 끄기는 기다리지 않고 바로 끈다.
        //   [까닭] 아래 기다림은 「미리보기가 다 그려졌나」를 보는 것이다. AI busy 는 AI 가
        //     「내 일 끝났다」고 직접 끄는 것이라 그것을 볼 이유가 없다. 오히려 AI 가 화면을
        //     바꾸는 중이면 조용해질 때까지 창을 계속 다시 세어 한참 안 꺼졌다
        //     (빈 화면 실측 333ms = QUIET_WINDOW_MS x2 + idle, 실제 화면은 더 길다).
        //   [범위] 이 길은 setAIBusy(false) 만 탄다. U4ABusy.hide() 는 종전 그대로다.
        if (bNow === true) {
            _doHide();
            return;
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
        var bSlowWarned = false;            // 「너무 오래 걸린다」 알림을 이미 찍었나(한 번만)
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

            if (nLateMut > 0) {
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

                //너무 오래 걸리면 **한 번만** 알린다 — 그래도 끄지 않고 계속 기다린다(위 SLOW_WARN_MS 설명).
                if (bSlowWarned === false && performance.now() - t0 > SLOW_WARN_MS) {
                    bSlowWarned = true;
                    // ★[2026-10-23 장군님 지시 「내려라」] console.error → console.warn.
                    //   결함이 아니라 「오래 걸린다」는 알림이다 — 빨간 줄로 찍으면 진짜 오류와 섞인다.
                    console.warn("[UBSY-005] BUSY_STILL_ON: DOM still changing after "
                        + SLOW_WARN_MS + "ms - busy stays on until it settles (on purpose)");
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

            requestIdleCallback(_afterIdle, { timeout: IDLE_TIMEOUT_MS });
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


    /* ==================================================================
     * AI 가 제어하는 동안 다른 busy 가 끼어들지 못하게 막는 자물쇠
     * ------------------------------------------------------------------
     * [2026-10-30 장군님 지시] 「setAIBusy 를 실행중에 다른 setBusy 가 켜지는건 막는걸로 해줘」
     *
     *   · 켜기(show)뿐 아니라 **끄기(hide)도 막는다.** 켜기만 막으면 달라지는 것이 없기 때문이다 —
     *     화면 안 다른 처리는 켜기와 끄기를 짝으로 부르므로, 켜기만 막아도 그 짝인 **끄기가 와서
     *     AI busy 를 꺼 버린다.** 그러면 「AI 가 제어하는 동안 유지한다」는 목적이 깨진다.
     *   · 다만 막을 때도 **부르는 쪽이 넘긴 뒷정리(fnDone)는 해 준다** — 그쪽은 자기 작업이
     *     끝난 뒤 토스트 등을 띄워야 한다. busy 를 언제 끌지는 AI 쪽이 책임진다.
     *   · 자물쇠가 풀려 있으면(=평소) show / hide 는 **전과 한 줄도 다르지 않게** 돈다.
     * ================================================================== */

    var bAILocked = false;

    /** 부르는 쪽이 넘긴 뒷정리 — _hideCore 안의 _done 과 같은 일을 한 곳에서 한다. */
    function _runDone(fnDone) {

        if (typeof fnDone !== "function") {
            return;
        }

        try {
            fnDone();
        } catch (e) {
            _caught("UBSY-003", "U4ABusy.hide: fnDone failed", e);
        }
    }

    /* ==================================================================
     * busy 가 **실제로 꺼진 뒤** 할 일 — U4ABusy.afterOff(fn)
     * ------------------------------------------------------------------
     * [2026-10-30] hide() 는 화면이 조용해질 때까지 기다렸다 끄므로 **부르자마자 꺼지지 않는다**
     *   (최소 0.3초). 그래서 hide() 바로 뒤에 토스트를 띄우면 busy 와 겹쳐 보인다
     *   (장군님 지적 2026-10-30 「처리가 다 끝나고 메시지가 나와야 하지 않아?」).
     *
     *   · busy 가 떠 있지 않으면 **바로** 부른다. 떠 있으면 꺼지는 그때 부른다.
     *   · 끄기를 거는 쪽과 뒷일을 거는 쪽이 달라도 된다 — 그래서 화면 쪽은
     *     「끄기 한 줄 + afterOff 한 줄」로 끝난다. busy 함수를 창마다 고칠 필요가 없다.
     *   · AI 자물쇠로 끄기가 막혀 있으면 그동안 기다렸다가, AI busy 가 꺼질 때 같이 불린다.
     * ================================================================== */

    var aAfterOff = [];

    function afterOff(fnDone) {

        if (typeof fnDone !== "function") {
            return;
        }

        var oBusyDom = document.getElementById(BUSY_ID);

        // 떠 있지 않으면 기다릴 것이 없다.
        if (!oBusyDom || !oBusyDom.open) {
            _runDone(fnDone);
            return;
        }

        aAfterOff.push(fnDone);
    }

    /** 실제로 꺼진 그 자리에서 대기열을 비운다. */
    function _flushAfterOff() {

        if (aAfterOff.length === 0) {
            return;
        }

        var aList = aAfterOff;

        aAfterOff = [];

        for (var i = 0; i < aList.length; i++) {
            _runDone(aList[i]);
        }
    }


    function show() {

        if (bAILocked) {
            console.warn("[UBSY-008] U4ABusy.show ignored - setAIBusy holds the lock");
            return;
        }

        _showCore();
    }

    function hide(fnDone) {

        if (bAILocked) {
            console.warn("[UBSY-009] U4ABusy.hide ignored - setAIBusy holds the lock");
            _runDone(fnDone);
            return;
        }

        _hideCore(fnDone);
    }


    /* ==================================================================
     * AI 전용 busy — setAIBusy(bOn, oOpt)
     * ------------------------------------------------------------------
     * [2026-10-30 장군님 지시] AI 가 WS4.0 을 제어하는 동안 쓰는 busy.
     *   화면·동작은 **공통 busy 그대로**다 — 아래에서 show() / hide() 를 그대로 부른다.
     *   다른 점은 카드에 **무슨 작업 중인지 글(desc)을 띄운다**는 것뿐이다.
     *
     *     setAIBusy(true, { desc: "작업중입니다. \n 잠시만 기다려 주세요" });
     *     setAIBusy(false);
     *
     *   · 두 번째 인자는 **object** 로 받는다 — 나중에 항목을 더할 수 있게. 지금은 desc 하나.
     *   · desc 안의 "\n" 은 **그대로 개행**으로 보인다 — 짝 CSS 의
     *     .u4aWsBusyText { white-space: pre-line } 가 그렇게 그린다.
     *     innerHTML 을 쓰지 않는다 — desc 에 태그가 섞여 들어와도 글자로만 보이게.
     *   · 글자 자리(#u4aWsBusyText)는 다른 화면도 쓰는 **공용 자리**라, 끌 때 반드시 비운다.
     *     비우는 시점은 busy 가 **실제로 꺼진 뒤**다(hide 의 콜백) — 먼저 비우면
     *     busy 가 아직 떠 있는 동안 글만 사라져 이상하게 보인다.
     * ================================================================== */

    var AI_TEXT_ID = "u4aWsBusyText";

    /** busy 카드의 글자 자리에 글을 넣는다(빈 글자면 지운다). */
    function _setAIText(sDesc) {

        var oTxt = document.getElementById(AI_TEXT_ID);

        if (!oTxt) {
            console.warn("[UBSY-007] setAIBusy: #" + AI_TEXT_ID + " not found - desc not shown");
            return;
        }

        oTxt.textContent = sDesc;
    }

    /** busy 카드를 AI 모드로 바꾼다(그림이 AI Steering 으로 바뀐다) / 되돌린다. */
    function _setAIMode(bOn) {

        var oBusyDom = document.getElementById(BUSY_ID);

        if (!oBusyDom) {
            return;
        }

        if (bOn) {
            oBusyDom.setAttribute("data-u4a-busy-mode", "ai");
            return;
        }

        oBusyDom.removeAttribute("data-u4a-busy-mode");
    }

    /**
     * 다른 창(별창)에도 「지금 막아라 / 풀어라」를 알린다.
     *   ★[2026-10-30 장군님 지시 「같이 broadcast 로 다른 창에서도 못건들게 해라」]
     *     자물쇠는 창마다 따로라, AI 가 이 창을 잠가도 띄워 둔 별창은 그대로 조작된다.
     *     별창은 이미 BUSY_ON / BUSY_OFF 를 받아 자기 화면을 덮는 길을 갖고 있으므로
     *     **그 길에 쏘기만 하면 된다** — 받는 쪽은 한 줄도 고치지 않는다.
     *   ★메인 창도 이 신호를 받아 setBusy 를 부르지만, 자물쇠가 걸린 동안에는
     *     setBusy 가 통째로 그만두므로(resources/index.js) 겹쳐서 켜지지 않는다.
     */
    function _broadcastAIBusy(bOn) {

        try {

            if (typeof BroadcastChannel !== "function") {
                return;
            }

            var fnKey = null;

            if (typeof global.getBrowserKey === "function") {
                fnKey = global.getBrowserKey;
            } else if (global.parent && typeof global.parent.getBrowserKey === "function") {
                fnKey = global.parent.getBrowserKey;
            }

            if (!fnKey) {
                console.warn("[UBSY-010] setAIBusy: getBrowserKey not found - other windows are NOT locked");
                return;
            }

            var oCh = new BroadcastChannel("broadcast-to-child-window_" + fnKey());

            oCh.postMessage({ PRCCD: (bOn ? "BUSY_ON" : "BUSY_OFF") });

            oCh.close();

        } catch (e) {
            _caught("UBSY-011", "setAIBusy: broadcast failed - other windows may stay unlocked", e);
        }
    }


    function setAIBusy(bOn, oOpt) {

        var oOption = oOpt || {};
        var sDesc = (typeof oOption.desc === "string") ? oOption.desc : "";

        if (bOn) {

            // 자기 자신은 자물쇠에 걸리면 안 되므로 _showCore 를 바로 부른다.
            _showCore();

            // _showCore 가 카드를 만든 뒤라야 그림·글자 자리가 있다 — 순서를 바꾸지 말 것.
            _setAIMode(true);
            _setAIText(sDesc);

            bAILocked = true;

            // 별창도 같이 막는다(이 창이 잠긴 뒤에 쏜다 — 되받은 신호가 setBusy 를 못 타게).
            _broadcastAIBusy(true);

            return;
        }

        // 먼저 자물쇠를 풀어야 아래 _hideCore 가 평소대로 돈다.
        bAILocked = false;

        // 두 번째 인자 true = 기다리지 않고 바로 끈다(위 _hideCore 의 ★ 참조).
        _hideCore(function () {
            _setAIText("");
            _setAIMode(false);
        }, true);

        // 별창을 푼다 — 이 창이 닫힌 뒤에 쏜다(별창이 먼저 열려 조작되는 틈을 만들지 않는다).
        _broadcastAIBusy(false);
    }


    /**
     * AI 가 제어 중인가(setAIBusy 가 자물쇠를 쥐고 있나).
     *   ★[2026-10-30 장군님 지시] 메인 창 전역 setBusy(resources/index.js)가 이것을 보고
     *     통째로 그만둔다. 공통 busy 층만 막으면 그 바깥의 부수 작업(마우스 막기 풀기 ·
     *     창 닫기 버튼 활성 · busy 카드 글자 덮어쓰기)이 그대로 돌아 AI busy 가 깨진다.
     */
    function isAILocked() {
        return bAILocked === true;
    }

    global.U4ABusy = { show: show, hide: hide, afterOff: afterOff, setAIBusy: setAIBusy, isAILocked: isAILocked };

    // 부르는 쪽이 setAIBusy(true, {...}) 로 바로 쓰도록 전역에도 둔다(장군님 호출 예시).
    global.setAIBusy = setAIBusy;

})(window);
