/* 현재 열린 창들의 iframe 구조까지 확인해 로그인 화면(Login.js)이 어디 있는지 찾는다. 임시. */
"use strict";
const WebSocket = require("ws");
const PORT = 9222, HOST = `http://127.0.0.1:${PORT}`;

async function cdpList() { try { return await (await fetch(`${HOST}/json/list`)).json(); } catch (e) { return null; } }
async function evalOnPage(page, expression) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => { const i = ++id; const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, ...m })); });
    await send({ method: "Runtime.enable" });
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true } });
    ws.close();
    if (r.result && r.result.exceptionDetails) throw new Error("eval exc: " + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
}

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const pages = list.filter(x => x.type === "page" && x.title !== "DevTools");
    for (const win of pages) {
        const probe =
            "JSON.stringify((function(){var r={};try{" +
            "r.iframes=Array.from(document.querySelectorAll('iframe')).map(function(f){return {id:f.id,src:(f.src||'').slice(0,140)};});" +
            "r.bodyClasses=document.body?document.body.className:'';" +
            "r.currPage=(typeof getCurrPage==='function')?getCurrPage():'fn없음';" +
            "return r;}catch(e){return{err:e.message};}})())";
        try {
            const res = JSON.parse(await evalOnPage(win, probe));
            console.log(win.title, win.id, "→", JSON.stringify(res));
        } catch (e) {
            console.log(win.title, win.id, "→ ERROR", e.message);
        }
    }
    process.exit(0);
})();
