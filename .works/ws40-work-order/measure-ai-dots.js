/**
 * @file measure-ai-dots.js
 * @description
 * AI 전용 busy 의 빛 입자가 **카드(dialog) 끝까지 잘 퍼지는지** desc 길이를 바꿔 가며 실측한다.
 * 떠 있는 앱(#Main)에 CDP 로 붙기만 한다 — 앱을 띄우거나 끄지 않는다.
 *
 * ★앱은 한 번 읽은 u4a-busy.js / u4a-busy.css 를 다시 읽지 않는다. 그래서
 *   ① busy dialog 를 지우고 ② 고친 u4a-busy.js 를 평가해 함수를 새로 설치하고
 *   ③ u4a-busy.css 링크를 다시 읽혀서 **지금 소스 그대로** 검증한다.
 * ★시간으로 기다리지 않는다 — 조건이 참이 될 때까지 지켜본다(장군님 지시 2026-10-30).
 *
 * 쓰는 법: node .works/ws40-work-order/measure-ai-dots.js [캡처를 저장할 폴더]
 */
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CSS_PATH = path.join(__dirname, "..", "..", "www", "ws30", "ws10_20", "theme", "u4a-busy.css");
const JS_PATH = path.join(__dirname, "..", "..", "www", "ws30", "ws10_20", "theme", "u4a-busy.js");

// desc 를 짧은 것부터 아주 긴 것까지 — 카드가 커질수록 입자도 같이 퍼져야 한다.
const CASES = [
    { name: "없음", desc: "" },
    { name: "한줄", desc: "처리 중입니다" },
    { name: "두줄", desc: "asdfasfsadfsadfsadfsadfsadfasdfsafsadf\nasdfsadfsadfasfsafasdf" },
    { name: "네줄", desc: "asdfasdfsadfasdfsadfsadfsadfsafasdf\nasdfsadfsafsadfsafasf\naSDFASDFSADFASFSADFASFSADFASDFSADF\nasdfasdfsadfsadfasfasdf" },
    { name: "여덟줄", desc: "1 asdfasdfsadfasdfsadfsadfsadfsafasdf\n2 asdfsadfsafsadfsafasf\n3 aSDFASDFSADFASFSADFASFSADFASDFSADF\n4 asdfasdfsadfsadfasfasdf\n5 asdfasdfsadfasdfsadfsadf\n6 asdfsadfsafsadfsafasf\n7 aSDFASDFSADFASFSADF\n8 asdfasdfsadfsadfasfasdf" }
];

function getJson(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (res) {
            let s = "";
            res.on("data", function (c) { s += c; });
            res.on("end", function () { resolve(JSON.parse(s)); });
        }).on("error", reject);
    });
}

async function main() {

    const outDir = process.argv[2] || ".";
    const list = await getJson("http://127.0.0.1:9222/json/list");
    const main = list.find(function (t) { return t.type === "page" && (t.title || "").indexOf("#Main") >= 0; });

    if (!main) {
        console.log("#Main 창을 못 찾았다. 앱이 떠 있어야 한다.");
        return;
    }

    const ws = new WebSocket(main.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
    await new Promise(function (r) { ws.on("open", r); });

    let seq = 0;
    const pending = {};

    ws.on("message", function (buf) {
        const m = JSON.parse(buf.toString());
        if (m.id && pending[m.id]) {
            pending[m.id](m);
            delete pending[m.id];
        }
    });

    function send(method, params) {
        seq++;
        const id = seq;
        ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        return new Promise(function (r) { pending[id] = r; });
    }

    async function ev(expr) {
        const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            const d = r.result.exceptionDetails;
            return "EXCEPTION: " + ((d.exception && d.exception.description) || d.text);
        }
        return r.result && r.result.result ? r.result.result.value : r;
    }

    /** 조건이 참이 될 때까지 지켜본다. 시간으로 재지 않는다. */
    async function waitFor(condExpr) {
        return await ev(`(function(){
            return new Promise(function (res) {
                var t0 = Date.now();
                function tick() {
                    var ok = false;
                    try { ok = !!(${condExpr}); } catch (e) { ok = false; }
                    if (ok) { return res("ok " + (Date.now() - t0) + "ms"); }
                    if (Date.now() - t0 > 15000) { return res("TIMEOUT"); }
                    requestAnimationFrame(tick);
                }
                tick();
            });
        })()`);
    }

    // ── ① 옛 busy DOM 을 지우고, 고친 JS 를 새로 설치한다 ───────────────────
    await ev("(function(){ var d = document.getElementById('u4aWsBusyIndicator'); if (d) { d.remove(); } return 'removed'; })()");

    const jsSrc = fs.readFileSync(JS_PATH, "utf8");
    const installed = await send("Runtime.evaluate", { expression: jsSrc, returnByValue: true });
    if (installed.result && installed.result.exceptionDetails) {
        console.log("JS 설치 실패:", JSON.stringify(installed.result.exceptionDetails).slice(0, 300));
        ws.close();
        return;
    }

    // ── ② CSS 를 다시 읽힌다 ─────────────────────────────────────────────
    await ev("(function(){ var ls = document.querySelectorAll('link[rel=stylesheet]'); for (var i = 0; i < ls.length; i++) { var h = ls[i].getAttribute('href') || ''; if (h.indexOf('u4a-busy.css') >= 0) { ls[i].setAttribute('href', h.split('?')[0] + '?v=' + Date.now()); } } return 'reloaded'; })()");
    await waitFor("Array.prototype.some.call(document.styleSheets, function (ss) { try { return (ss.href || '').indexOf('u4a-busy.css') >= 0 && ss.cssRules.length > 0; } catch (e) { return false; } })");

    // ── ③ desc 를 바꿔 가며 입자 분포를 잰다 ──────────────────────────────
    const MEASURE = `(function () {
        var card = document.querySelector(".u4aWsBusyCard");
        var ai = document.querySelector(".u4aWsBusyAi");
        var lg = document.querySelector(".u4aWsBusyAi .lg");
        if (!card || !ai || !lg) { return JSON.stringify({ err: "요소 없음" }); }

        var cr = card.getBoundingClientRect();
        var lr = lg.getBoundingClientRect();
        var cx = lr.left + lr.width / 2;      // 입자가 모이는 지점 = 로고 칸 가운데
        var cy = lr.top + lr.height / 2;

        // 입자의 **출발 자리**(애니메이션 0% 지점)를 계산한다. 화면 좌표.
        var zAi = parseFloat(getComputedStyle(ai).zoom) || 1;
        var zCard = parseFloat(getComputedStyle(card).zoom) || 1;
        var scale = zAi * zCard;              // 그림 좌표계 1px 이 화면에서 몇 px 인가

        // ★--x · --y 는 calc(...) 문자열이라 숫자로 못 읽는다(실측 2026-10-30).
        //   비율(--fx · --fy)과 카드 크기(--u4aWsAiW · --u4aWsAiH)로 직접 계산한다.
        var W = parseFloat(getComputedStyle(ai).getPropertyValue("--u4aWsAiW")) || 0;
        var H = parseFloat(getComputedStyle(ai).getPropertyValue("--u4aWsAiH")) || 0;
        var OX = parseFloat(getComputedStyle(ai).getPropertyValue("--u4aWsAiOX")) || 0;
        var OY = parseFloat(getComputedStyle(ai).getPropertyValue("--u4aWsAiOY")) || 0;

        var ps = ai.querySelectorAll(".p");
        var pts = [];
        for (var i = 0; i < ps.length; i++) {
            var cs = getComputedStyle(ps[i]);
            var fx = parseFloat(cs.getPropertyValue("--fx")) || 0;
            var fy = parseFloat(cs.getPropertyValue("--fy")) || 0;
            pts.push([cx + (OX + W * fx) * scale, cy + (OY + H * fy) * scale]);
        }
        if (!pts.length) { return JSON.stringify({ err: "입자 없음" }); }

        var xs = pts.map(function (p) { return p[0]; });
        var ys = pts.map(function (p) { return p[1]; });
        var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
        var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

        // 카드 밖으로 나간 입자 수(조금 나가는 것은 괜찮다 — 카드가 잘라 준다)
        var outside = 0;
        for (var j = 0; j < pts.length; j++) {
            if (pts[j][0] < cr.left || pts[j][0] > cr.right || pts[j][1] < cr.top || pts[j][1] > cr.bottom) { outside++; }
        }

        return JSON.stringify({
            card: [Math.round(cr.width), Math.round(cr.height)],
            spreadVar: [ai.style.getPropertyValue("--u4aWsAiW"), ai.style.getPropertyValue("--u4aWsAiH")],
            dots: pts.length,
            // 입자가 덮는 범위가 카드의 몇 % 인가 — 이것이 「끝까지 퍼지는가」의 지표
            coverW: Math.round((maxX - minX) / cr.width * 100),
            coverH: Math.round((maxY - minY) / cr.height * 100),
            // 카드 위/아래 끝에서 가장 가까운 입자까지의 거리(화면 px)
            gapTop: Math.round(minY - cr.top),
            gapBottom: Math.round(cr.bottom - maxY),
            gapLeft: Math.round(minX - cr.left),
            gapRight: Math.round(cr.right - maxX),
            outside: outside
        });
    })()`;

    const results = [];

    for (let i = 0; i < CASES.length; i++) {

        const c = CASES[i];

        await ev("setAIBusy(false)");
        await waitFor("(function(){ var d = document.getElementById('u4aWsBusyIndicator'); return !d || !d.hasAttribute('open'); })()");

        await ev("setAIBusy(true, { desc: " + JSON.stringify(c.desc) + " })");
        await waitFor("(function(){ var c = document.querySelector('.u4aWsBusyCard'); return c && c.clientWidth > 0 && c.clientHeight > 0; })()");
        // 카드 크기에 맞춘 값이 실제로 들어갔는지까지 본다
        await waitFor("(function(){ var a = document.querySelector('.u4aWsBusyAi'); return a && a.style.getPropertyValue('--u4aWsAiW') !== ''; })()");

        const raw = await ev(MEASURE);
        let r;
        try { r = JSON.parse(raw); } catch (e) { r = { err: String(raw).slice(0, 160) }; }
        r.case = c.name;
        results.push(r);

        const shot = await send("Page.captureScreenshot", { format: "png" });
        if (shot.result && shot.result.data) {
            fs.writeFileSync(path.join(outDir, "dots-" + c.name + ".png"), Buffer.from(shot.result.data, "base64"));
        }
    }

    await ev("setAIBusy(false)");
    await waitFor("(function(){ var d = document.getElementById('u4aWsBusyIndicator'); return !d || !d.hasAttribute('open'); })()");

    console.log(JSON.stringify(results, null, 1));
    ws.close();
}

main().catch(function (e) {
    console.error("[measure-ai-dots] 실패:", e.message);
    process.exit(1);
});
