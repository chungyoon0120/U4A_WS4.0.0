/* 컨트롤러 클래스 실행 대기 팝업(IL1, tnt-Radar) 원본 그림 교체 실측용. 임시.
 * 사용: node verify-radar.js <windowId> <open|close|theme> [arg]
 */
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
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } });
    ws.close();
    if (r.result && r.result.exceptionDetails) throw new Error("eval exc: " + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
}

const WIN_ID = process.argv[2];
const MODE = process.argv[3];
const ARG = process.argv[4];

const EXPR = {
    theme: `(function(){ if(${JSON.stringify(ARG)}) { U4ATheme.apply(${JSON.stringify(ARG)}); } return JSON.stringify({theme:document.documentElement.getAttribute('data-sl-theme'), name:document.documentElement.dataset.theme}); })()`,
    open: `oAPP.common.fnIllustMsgDialogOpen({title:'실측',description:'tnt-Radar 원본 그림 확인용'});
        new Promise(function(resolve){
            setTimeout(function(){
                var img = document.querySelector('#u4aWsIllustedMsgDialog .u4aWsIllustArt');
                resolve(JSON.stringify({src:img && img.src, mode:img && img.getAttribute('data-mode'), naturalWidth:img && img.naturalWidth, complete:img && img.complete}));
            }, 300);
        });`,
    close: `oAPP.common.fnIllustMsgDialogClose();'closed'`,
};

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.id === WIN_ID);
    if (!win) { console.log("창 못 찾음:", WIN_ID); process.exit(1); }
    if (!EXPR[MODE]) { console.log("모드 오류"); process.exit(1); }
    const res = await evalOnPage(win, EXPR[MODE]);
    console.log(MODE, "→", res);
    process.exit(0);
})();
