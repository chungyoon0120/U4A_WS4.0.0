/* 나머지 4건 일러스트 팝업 — #Main 창에 함수가 로드돼 있는지 실측. 임시. */
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
    for (const title of ["U4A Workspace #Main", "U4A Workspace #ServerList"]) {
        const win = list.find((x) => x.type === "page" && x.title === title);
        if (!win) { console.log(title, ": 창 없음"); continue; }
        const probe =
            "JSON.stringify((function(){var r={};try{" +
            "r.hasProgressOpen=typeof (oAPP&&oAPP.common&&oAPP.common.fnProgressDialogOpen)==='function';" +
            "r.hasProgressClose=typeof (oAPP&&oAPP.common&&oAPP.common.fnProgressDialogClose)==='function';" +
            "r.hasShowIllustMsgDialog=typeof (oAPP&&oAPP.fn&&oAPP.fn.fnShowIllustMsgDialog)==='function';" +
            "r.hasVersionCheckDialog=typeof (oAPP&&oAPP.fn&&oAPP.fn.fnVersionCheckDialogOpen)==='function';" +
            "r.hasNoAuthIllustMsg=typeof (oAPP&&oAPP.fn&&oAPP.fn.fnShowNoAuthIllustMsg)==='function';" +
            "return r;}catch(e){return{err:e.message};}})())";
        const res = JSON.parse(await evalOnPage(win, probe));
        console.log(title, "→", res);
    }
    process.exit(0);
})();
