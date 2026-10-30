/**
 * @file verify-cdp.js
 * @description
 * ws40-work-order 작업(반복 억제 스위치 · 미리보기 로그 연결 · 속성값 기록 · console.error 오류 객체) 을
 * 떠 있는 앱(#Main)에 CDP 로 붙어 실측한다. 앱을 띄우거나 끄지 않는다 — 붙기만 한다.
 * 실행 전제: login-smoke.js --fresh --keep --app <APPID> 로 WS20 까지 열려 있을 것.
 */
const WebSocket = require("ws");
const http = require("http");

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

    let list = await getJson("http://127.0.0.1:9222/json/list");
    let main = list.find(function (t) { return t.type === "page" && t.title.indexOf("#Main") >= 0; });

    if (!main) {
        throw new Error("#Main target not found");
    }

    let ws = new WebSocket(main.webSocketDebuggerUrl);
    await new Promise(function (r) { ws.on("open", r); });

    let seq = 0;
    let pending = {};
    let consoleEvents = [];

    ws.on("message", function (buf) {
        let m = JSON.parse(buf.toString());
        if (m.id && pending[m.id]) {
            pending[m.id](m);
            delete pending[m.id];
            return;
        }
        if (m.method === "Runtime.consoleAPICalled") {
            consoleEvents.push(m.params);
        }
    });

    function send(method, params) {
        seq++;
        let id = seq;
        ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        return new Promise(function (r) { pending[id] = r; });
    }

    async function ev(expr) {
        let r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            return "EXCEPTION: " + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
        }
        return r.result && r.result.result ? r.result.result.value : r;
    }

    function argText(a) {
        if (a.value !== undefined) { return String(a.value); }
        if (a.description !== undefined) { return String(a.description); }
        return "[" + a.type + "]";
    }

    function lines() {
        return consoleEvents.map(function (p) {
            return p.type + " | " + (p.args || []).map(argText).join(" ");
        });
    }

    // 지난 콘솔도 다시 받는다(Runtime.enable 이 쌓인 메시지를 되돌려 준다)
    await send("Runtime.enable");

    /**
     * ★시간으로 기다리지 않는다(장군님 지시 2026-10-30 「불분명한 시간 재기는 넣지마」).
     * 브라우저 안에서 **조건이 참이 될 때까지** 지켜보고, 참이 되면 그때 돌아온다.
     * 상한에 닿으면 왜 못 기다렸는지 함께 돌려준다.
     */
    async function waitFor(sCondExpr, sWhat) {
        let r = await ev(`(function(){
            return new Promise(function (res) {
                var t0 = Date.now();
                function tick() {
                    var ok = false;
                    try { ok = !!(${sCondExpr}); } catch (e) { ok = false; }
                    if (ok) { return res("ok " + (Date.now() - t0) + "ms"); }
                    if (Date.now() - t0 > 15000) { return res("TIMEOUT"); }
                    requestAnimationFrame(tick);
                }
                tick();
            });
        })()`);
        if (String(r).indexOf("TIMEOUT") === 0) {
            out["wait_" + sWhat] = "못 기다렸다: " + sCondExpr;
        }
        return r;
    }

    let out = {};

    // [2026-10-30] AI 전용 busy 의 화면 테두리 띠(.u4aWsBusyAura) 실측 — 장군님 지시 「cdp 붙여서 실측해」
    const PROBE = `(function () {
        var r = {};
        var dlg = document.getElementById("u4aWsBusyIndicator");
        r.dialogExists = !!dlg;
        if (!dlg) { return JSON.stringify(r); }
        r.open = dlg.hasAttribute("open");
        r.mode = dlg.getAttribute("data-u4a-busy-mode");
        var dc = getComputedStyle(dlg);
        r.dlgBackdropFilter = dc.backdropFilter || dc.webkitBackdropFilter;
        r.accentOnDialog = dc.getPropertyValue("--busy-accent").trim();
        var aura = dlg.querySelector(".u4aWsBusyAura");
        r.auraExists = !!aura;
        if (aura) {
            var ac = getComputedStyle(aura);
            var ar = aura.getBoundingClientRect();
            r.auraDisplay = ac.display;
            r.auraPosition = ac.position;
            r.auraPadding = ac.padding;
            r.auraMask = (ac.webkitMaskImage || ac.maskImage || "").slice(0, 60);
            r.auraRect = [Math.round(ar.width), Math.round(ar.height)];
            r.auraAccent = ac.getPropertyValue("--busy-accent").trim();
            r.auraBoxShadow = (ac.boxShadow || "").slice(0, 120);
            r.auraMaskImage = (ac.webkitMaskImage || ac.maskImage || "").slice(0, 200);
            r.auraMaskComposite = (ac.maskComposite || "") + " / " + (ac.webkitMaskComposite || "");
            var pl2 = aura.querySelector("i");
            if (pl2) { r.plateBgImage = getComputedStyle(pl2).backgroundImage.slice(0, 120); }
            r.auraChildren = Array.prototype.map.call(aura.children, function (c) {
                var cc = getComputedStyle(c);
                var crr = c.getBoundingClientRect();
                return c.className + " | pad=" + cc.padding + " | filter=" + cc.filter + " | op=" + cc.opacity + " | rect=" + Math.round(crr.width) + "x" + Math.round(crr.height);
            });
            var pl = aura.querySelector("i");
            r.plateExists = !!pl;
            if (pl) {
                var pc = getComputedStyle(pl);
                var pr = pl.getBoundingClientRect();
                r.plateRect = [Math.round(pr.width), Math.round(pr.height)];
                r.plateBg = pc.backgroundImage.slice(0, 140);
                r.plateAnim = pc.animationName + " " + pc.animationDuration;
            }
        }
        var card = dlg.querySelector(".u4aWsBusyCard");
        if (card) {
            var cr = card.getBoundingClientRect();
            r.cardRect = [Math.round(cr.width), Math.round(cr.height)];
            r.cardZoom = getComputedStyle(card).zoom;
        }
        return JSON.stringify(r);
    })()`;

    out.before = JSON.parse(await ev(PROBE));

    // ★Electron 은 한 번 읽은 CSS 를 다시 읽지 않는다 — href 에 값을 붙여 강제로 다시 읽힌다.
    out.cssReload = await ev("(function(){ var ls = document.querySelectorAll('link[rel=stylesheet]'); var n = 0; for (var i = 0; i < ls.length; i++) { var h = ls[i].getAttribute('href') || ''; if (h.indexOf('u4a-busy.css') >= 0) { ls[i].setAttribute('href', h.split('?')[0] + '?v=' + Date.now()); n++; } } return n; })()");

    // CSS 가 실제로 다시 읽혔는지 — 그 파일의 규칙이 다시 잡힐 때까지 기다린다.
    out.cssReady = await waitFor("Array.prototype.some.call(document.styleSheets, function (ss) { try { return (ss.href || '').indexOf('u4a-busy.css') >= 0 && ss.cssRules.length > 0; } catch (e) { return false; } })", "css");

    // ★시안 비교 때 요소에 직접 입힌 style 이 남아 있으면 CSS 를 덮는다. 먼저 지운다.
    out.clearInline = await ev("(function(){ var el = document.querySelector('.u4aWsBusyAura i'); if (!el) { return 'no el'; } el.removeAttribute('style'); return 'cleared'; })()");

    // ① 켠다 (desc 를 길게 넣어 카드가 커진 상태를 본다)
    out.onCall = await ev("setAIBusy(true, { desc: 'asdfasfsadfsadfsadfsadfsadfasdfsafsadf\\n\\nasdfsadfsadfasfsafasdf' }), 'called'");

    // 카드가 **실제로 그려져 크기가 잡힐 때까지** 기다린다(시간으로 재지 않는다).
    out.cardReady = await waitFor("(function(){ var c = document.querySelector('.u4aWsBusyCard'); return c && c.clientWidth > 0 && c.clientHeight > 0; })()", "card");

    // ② 입자를 카드 크기에 맞춰 퍼지게 한다(앱은 고친 u4a-busy.js 를 다시 읽지 않으므로 여기서 흉내낸다)
    out.spread = await ev(`(function(){
        var card = document.querySelector(".u4aWsBusyCard");
        var ai = document.querySelector(".u4aWsBusyAi");
        if (!card || !ai) { return "no"; }
        var z = parseFloat(getComputedStyle(ai).zoom) || 1;
        ai.style.setProperty("--u4aWsAiW", (card.clientWidth / z) + "px");
        ai.style.setProperty("--u4aWsAiH", (card.clientHeight / z) + "px");
        var F = [[-0.53,-0.26],[0.34,-0.28],[-0.42,0.30],[0.33,0.27],[-0.21,-0.36],[0.14,-0.38],
                 [-0.62,0.02],[0.39,0],[-0.11,0.36],[0.21,0.34],[-0.04,-0.40],[0.04,0.40]];
        var ps = ai.querySelectorAll(".p");
        for (var i = 0; i < ps.length && i < F.length; i++) {
            var d = getComputedStyle(ps[i]).animationDelay;
            ps[i].setAttribute("style", "--fx:" + F[i][0] + ";--fy:" + F[i][1] + ";animation-delay:" + d);
        }
        return ps.length + " particles / W=" + Math.round(card.clientWidth / z) + " H=" + Math.round(card.clientHeight / z);
    })()`);

    // 입자가 새 자리로 다시 그려질 때까지 — 변수가 들어갔는지로 본다.
    out.spreadReady = await waitFor("(function(){ var a = document.querySelector('.u4aWsBusyAi'); return a && a.style.getPropertyValue('--u4aWsAiW') !== ''; })()", "spread");

    out.afterAIBusyOn = JSON.parse(await ev(PROBE));

    // ③ 켜진 채로 캡처
    let shot = await send("Page.captureScreenshot", { format: "png" });
    let data = shot.result && shot.result.data;
    if (data) {
        require("fs").writeFileSync(process.argv[2] || "ai-busy.png", Buffer.from(data, "base64"));
        out.screenshot = process.argv[2] || "ai-busy.png";
    } else {
        out.screenshot = "캡처 실패";
    }

    // ④ **반드시 끈다** — 켜 놓고 가면 화면이 잠긴 채로 남는다(장군님 지적 2026-10-30).
    if (process.env.U4A_KEEP_BUSY !== "1") {
        await ev("setAIBusy(false)");
        await waitFor("(function(){ var d = document.getElementById('u4aWsBusyIndicator'); return !d || !d.hasAttribute('open'); })()", "busyOff");
        out.busyOff = await ev("(function(){ var d = document.getElementById('u4aWsBusyIndicator'); return d ? (d.hasAttribute('open') ? 'still open' : 'closed') : 'no dialog'; })()");
    }

    console.log(JSON.stringify(out, null, 2));
    ws.close();
}

main().catch(function (e) {
    console.error("[verify-cdp] failed:", e);
    process.exit(1);
});
