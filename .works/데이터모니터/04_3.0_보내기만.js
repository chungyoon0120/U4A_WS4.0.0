/************************************************************************
 * 3.0 → 4.0 보내기 — 이것만 따로 (9999 로 HTTP 전송)
 * ----------------------------------------------------------------------
 *  ★ 이 코드는 **수집 코드를 먼저 심은 뒤에** 돌려야 한다.
 *    수집 코드 = 03_3.0에_심을_수집코드.js 의 앞부분(4.0 원본 그대로).
 *    그 파일 한 덩이를 통째로 심었다면 **이 파일은 따로 돌릴 필요가 없다** —
 *    같은 내용이 그 파일 뒤쪽에 이미 들어 있다.
 *
 *  무엇을 하나:
 *    ① 3.0 화면 오른쪽 아래에 [3.0 → 4.0 보내기] 단추를 만든다
 *    ② 누르면 지금 데이터 구조를 통째로 떠서 http://127.0.0.1:9999/snapshot 으로 보낸다
 *    ③ 감시를 켜 두고 변경 내용도 같이 모아 보낸다
 *
 *  받는 쪽 = 4.0 의 데이터 모니터 창(비교 뷰). 그 창이 떠 있어야 9999 가 열려 있다.
 *
 *  오류코드 접두: DM30
 ************************************************************************/


/* ======================================================================
 * [2] 보내기 — 이 부분만 3.0 전용
 * ====================================================================== */

(function (window, oAPP) {
    "use strict";

    //4.0 의 데이터 모니터 창이 열어 두는 자리.
    var C_URL = "http://127.0.0.1:9999/snapshot";

    //단추 하나만 남게 하는 표식.
    var C_BTN_ID = "dm30SendBtn";

    //쌓아 둔 변경 내용. 보낼 때 같이 넘긴다.
    var _aBatch = [];


    /* ----------------------------------------------------------------
     *  감시 켜기 — 조작할 때마다 변경 내용을 여기에 쌓는다.
     * ---------------------------------------------------------------- */
    function _startWatch() {

        if (!oAPP || !oAPP.datamon || typeof oAPP.datamon.start !== "function") {
            console.error("[DM30-001] ERROR ENGINE_MISSING - the collector part did not load. nothing will be collected.");
            return false;
        }

        if (oAPP.datamon.isOn && oAPP.datamon.isOn()) {
            console.log("[DM30] INFO WATCH_ALREADY_ON");
            return true;
        }

        var bOk = oAPP.datamon.start(function (oBatch) {

            _aBatch.push(oBatch);

            //너무 쌓이면 오래된 것부터 버린다(창이 무거워지지 않게).
            if (_aBatch.length > 500) { _aBatch.splice(0, _aBatch.length - 500); }

            console.log("[DM30] INFO CHANGE_BATCH seq=" + oBatch.번호 +
                " act=" + oBatch.조작 + " rows=" + oBatch.변경.length);
        });

        if (!bOk) {
            console.error("[DM30-002] ERROR WATCH_START_FAILED - see the DMON code above. nothing will be collected.");
            return false;
        }

        console.log("[DM30] INFO WATCH_ON");
        return true;
    }


    /* ----------------------------------------------------------------
     *  보내기
     * ---------------------------------------------------------------- */
    function _send(oBtn) {

        function _say(sText) {
            if (!oBtn) { return; }
            oBtn.textContent = sText;
        }

        if (!oAPP || !oAPP.datamon || typeof oAPP.datamon.snapshot !== "function") {
            console.error("[DM30-001] ERROR ENGINE_MISSING - the collector part did not load. nothing was sent.");
            _say("수집 코드 없음");
            return;
        }

        var oSnap = oAPP.datamon.snapshot();

        if (!oSnap) {
            //수집 코드 쪽에서 이미 흔적을 남긴다(DMON-009).
            console.error("[DM30-003] ERROR SNAPSHOT_EMPTY - nothing was sent.");
            _say("담을 것이 없음");
            return;
        }

        var sBody = "";

        try {
            sBody = JSON.stringify({
                FROM: "3.0",
                TIME: new Date().toISOString(),
                SNAP: oSnap,
                BATCH: _aBatch
            });
        } catch (e) {
            console.error("[DM30-003] ERROR SNAPSHOT_STRINGIFY_FAILED - nothing was sent:", e);
            _say("글자로 못 바꿈");
            return;
        }

        if (oBtn) { oBtn.disabled = true; }
        _say("보내는 중…");

        var t0 = (window.performance && performance.now) ? performance.now() : 0;

        fetch(C_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: sBody
        }).then(function (res) {
            if (!res.ok) { throw new Error("HTTP " + res.status); }
            return res.json();
        }).then(function (oRes) {
            var t1 = (window.performance && performance.now) ? performance.now() : 0;
            console.log("[DM30] INFO SEND_DONE size=" + sBody.length +
                " roots=" + (oRes && oRes.ROOTS) + " ms=" + Math.round(t1 - t0));
            _say("보냄 (" + sBody.length + "자)");
        })["catch"](function (e) {
            //4.0 창이 안 떠 있거나 자리가 안 열렸으면 여기로 온다 - 조용히 넘기지 않는다.
            console.error("[DM30-004] ERROR SEND_FAILED url=" + C_URL +
                " size=" + sBody.length + " - is the 4.0 data monitor window open?", e);
            _say("보내기 실패");
        }).then(function () {
            if (oBtn) { oBtn.disabled = false; }
            setTimeout(function () { _say("3.0 → 4.0 보내기"); }, 2500);
        });
    }


    /* ----------------------------------------------------------------
     *  단추 만들기
     * ---------------------------------------------------------------- */
    function _makeButton() {

        if (!document || !document.body) {
            console.error("[DM30-005] ERROR NO_BODY - the send button was not created.");
            return null;
        }

        //여러 번 심어도 하나만 남게.
        var oOld = document.getElementById(C_BTN_ID);
        if (oOld) { oOld.remove(); }

        var oBtn = document.createElement("button");
        oBtn.id = C_BTN_ID;
        oBtn.type = "button";
        oBtn.textContent = "3.0 → 4.0 보내기";

        //3.0 화면의 스타일을 안 건드리려고 이 단추에만 직접 적는다(임시 도구).
        oBtn.style.cssText =
            "position:fixed; right:16px; bottom:16px; z-index:2147483647;" +
            "padding:8px 14px; font-size:13px; line-height:1.2; cursor:pointer;" +
            "background:#0070f2; color:#fff; border:0; border-radius:6px;" +
            "box-shadow:0 2px 8px rgba(0,0,0,.35);";

        oBtn.addEventListener("click", function () { _send(oBtn); });

        document.body.appendChild(oBtn);
        return oBtn;
    }


    /* ----------------------------------------------------------------
     *  심기
     * ---------------------------------------------------------------- */
    var _oBtn = _makeButton();
    var _bOn = _startWatch();

    //바깥에서 직접 부를 수 있게 열어 둔다(단추 없이 콘솔에서 보내고 싶을 때).
    window.DM30 = {
        send: function () { _send(_oBtn); },
        start: _startWatch,
        stop: function () {
            if (oAPP && oAPP.datamon && oAPP.datamon.stop) { oAPP.datamon.stop(); }
            console.log("[DM30] INFO WATCH_OFF");
        },
        batches: function () { return _aBatch; },
        clear: function () { _aBatch = []; console.log("[DM30] INFO BATCH_CLEARED"); }
    };

    console.log("[DM30] INFO READY url=" + C_URL + " watch=" + _bOn +
        " button=" + (_oBtn ? "yes" : "no"));

})(window, oAPP);
