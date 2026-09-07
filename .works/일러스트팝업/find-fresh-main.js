/* 재시작 후 여러 #Main 창 중 최신 코드(data-mode 분기 포함)가 로드된 창을 찾는다. 임시. */
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
    const candidates = list.filter((x) => x.type === "page" && x.title === "U4A Workspace #Main");
    for (const c of candidates) {
        const probe =
            "JSON.stringify((function(){var r={};try{" +
            "r.hasFresh=/data-mode/.test(oAPP.common.fnProgressDialogOpen.toString());" +
            "r.theme=document.documentElement.getAttribute('data-sl-theme');" +
            "r.dataTheme=document.documentElement.dataset.theme;" +
            "r.destroyed=false;" +
            "return r;}catch(e){return{err:e.message};}})())";
        try {
            const res = JSON.parse(await evalOnPage(c, probe));
            console.log(c.id, "→", res);
        } catch (e) {
            console.log(c.id, "→ ERROR(아마 파괴된 창)", e.message);
        }
    }
    process.exit(0);
})();
