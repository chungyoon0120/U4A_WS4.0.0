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
    await new Promise(function (r) { setTimeout(r, 1500); });

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

    // [2026-10-30] ★Electron 은 한 번 읽은 CSS 를 다시 읽지 않는다 — 파일을 고쳐도 화면은 옛 CSS 다.
    //   그래서 u4a-busy.css 링크에 뒤에 붙는 값을 바꿔 **강제로 다시 읽힌다.** 앱 상태는 그대로다.
    out.cssReload = await ev("(function(){ var ls = document.querySelectorAll('link[rel=stylesheet]'); var n = 0; for (var i = 0; i < ls.length; i++) { var h = ls[i].getAttribute('href') || ''; if (h.indexOf('u4a-busy.css') >= 0) { ls[i].setAttribute('href', h.split('?')[0] + '?v=' + Date.now()); n++; } } return n; })()");
    await new Promise(function (r) { setTimeout(r, 900); });

    // ★시안 비교 때 요소에 직접 입힌 style 이 남아 있으면 CSS 를 덮어 화면이 안 바뀐다. 먼저 지운다.
    out.clearInline = await ev("(function(){ var el = document.querySelector('.u4aWsBusyAura i'); if (!el) { return 'no el'; } el.removeAttribute('style'); return 'cleared'; })()");

    await ev("setAIBusy(true, { desc: 'CDP 실측' })");

    // [2026-10-30] 앱은 이미 만들어 둔 busy DOM 을 다시 쓴다 — u4a-busy.js 를 고쳐도 반영되지 않는다.
    //   그래서 화면 테두리 띠 안쪽만 새 마크업으로 바꿔 넣고 CSS 를 눈으로 본다.
    await ev("(function(){ var a = document.querySelector('.u4aWsBusyAura'); if (!a) { return 'no aura'; } a.innerHTML = '<b class=\'glow\'><i></i></b><b class=\'line\'><i></i></b>'; return 'replaced'; })()");
    await new Promise(function (r) { setTimeout(r, 500); });
    await new Promise(function (r) { setTimeout(r, 700); });
    out.afterAIBusyOn = JSON.parse(await ev(PROBE));

    // 화면 캡처
    let shot = await send("Page.captureScreenshot", { format: "png" });
    let data = shot.result && shot.result.data;
    if (data) {
        require("fs").writeFileSync(process.argv[2] || "ai-busy.png", Buffer.from(data, "base64"));
        out.screenshot = process.argv[2] || "ai-busy.png";
    } else {
        out.screenshot = "캡처 실패";
    }

    console.log(JSON.stringify(out, null, 2));
    ws.close();
}

main().catch(function (e) {
    console.error("[verify-cdp] failed:", e);
    process.exit(1);
});
