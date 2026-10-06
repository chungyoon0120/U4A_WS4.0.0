/****************************************************************************************
 * _busy-style-capture.js — 메인 창 busy 계산된 스타일 덤프 (전·후 대조용 임시 스크립트)
 *   2026-09-15 busy 를 theme/u4a-busy.* 로 옮기기 전·후 모양이 같은지 대조한다.
 *   실행: node .works/auto-test/_busy-style-capture.js <출력 json 경로>
 *   전제: login-smoke.js --keep 으로 #Main 창이 떠 있어야 한다(원격 디버깅 9222).
 ****************************************************************************************/
"use strict";

const WebSocket = require("ws");
const fs = require("fs");

const OUT = process.argv[2];
if (!OUT) { console.error("usage: node _busy-style-capture.js <out.json>"); process.exit(2); }

async function main() {
    const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
    const aMain = list.filter((p) => p.type === "page" && /\/ws30\/ws10_20\/index\.html/i.test(p.url));
    if (aMain.length === 0) { throw new Error("#Main page not found. pages=" + list.map((p) => p.url).join(" | ")); }
    const page = aMain[0];

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => {
        const i = ++id;
        const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } };
        ws.on("message", h);
        ws.send(JSON.stringify({ id: i, ...m }));
    });

    const expression = `(function () {
        var res = { url: location.href };
        res.beforeExists = !!document.getElementById("u4aWsBusyIndicator");
        setDomBusy("X");
        var d = document.getElementById("u4aWsBusyIndicator");
        function pick(el, pseudo) {
            if (!el) { return null; }
            var cs = getComputedStyle(el, pseudo || null), o = {};
            for (var i = 0; i < cs.length; i++) { var k = cs[i]; o[k] = cs.getPropertyValue(k); }
            return o;
        }
        var card = d && d.querySelector(".u4aWsBusyCard");
        var sp = d && d.querySelector(".u4aWsSpinner");
        res.open = !!(d && d.open);
        res.tag = d && d.tagName;
        res.parentTag = d && d.parentElement && d.parentElement.tagName;
        res.structure = d ? d.outerHTML.replace(/\\s+/g, " ") : null;
        res.dialog = pick(d);
        res.backdrop = pick(d, "::backdrop");
        res.card = pick(card);
        res.spinner = pick(sp);
        res.spBefore = pick(sp, "::before");
        res.spAfter = pick(sp, "::after");
        res.title = pick(document.getElementById("u4aWsBusyTitle"));
        res.text = pick(document.getElementById("u4aWsBusyText"));
        res.cardRect = card ? card.getBoundingClientRect().toJSON() : null;
        setDomBusy("");
        res.openAfterClose = !!(d && d.open);
        return res;
    })()`;

    await send({ method: "Runtime.enable" });
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true } });
    ws.close();
    if (r.result && r.result.exceptionDetails) { throw new Error(JSON.stringify(r.result.exceptionDetails)); }
    fs.writeFileSync(OUT, JSON.stringify(r.result.result.value, null, 2), "utf8");
    const v = r.result.result.value;
    console.log("saved", OUT, "open=", v.open, "openAfterClose=", v.openAfterClose, "parent=", v.parentTag, "beforeExists=", v.beforeExists);
}

main().catch((e) => { console.error("[capture] FAIL:", e && e.message); process.exit(1); });
