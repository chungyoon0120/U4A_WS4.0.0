/* 재시작 후 최신 코드로 그림 3종(진행률/세션타임아웃/Trial잠금) 실측. 임시.
 * 사용: node verify-original-svgs.js <windowId> <progress|session|lock|theme|closeAll> [arg]
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
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true } });
    ws.close();
    if (r.result && r.result.exceptionDetails) throw new Error("eval exc: " + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
}

const WIN_ID = process.argv[2];
const MODE = process.argv[3];
const ARG = process.argv[4];

const EXPR = {
    theme: `(function(){ if(${JSON.stringify(ARG)}) { U4ATheme.apply(${JSON.stringify(ARG)}); } return JSON.stringify({theme:document.documentElement.getAttribute('data-sl-theme'), name:document.documentElement.dataset.theme}); })()`,
    progress: `oAPP.common.fnProgressDialogOpen({title:'실측',description:'그림 확인용',percentValue:60,displayValue:'60%'});JSON.stringify({src:document.querySelector('#u4aWsProgressDialog .u4aWsProgArt')?.src})`,
    progressClose: `oAPP.common.fnProgressDialogClose();'closed'`,
    session: `oAPP.fn.fnShowIllustMsgDialog('실측','세션 타임아웃 그림 확인용','tnt-SessionExpired',null,function(){});JSON.stringify({src:document.querySelector('#illustMsgDialog .u4aWsSessArtImg')?.src, fbVisible:document.querySelector('#illustMsgDialog .u4aWsSessArtFb')?.style.display})`,
    lock: `oAPP.fn.fnShowIllustMsgDialog('실측','Trial 잠금 그림 확인용','tnt-Lock',null,function(){});JSON.stringify({src:document.querySelector('#illustMsgDialog .u4aWsSessArtImg')?.src, fbVisible:document.querySelector('#illustMsgDialog .u4aWsSessArtFb')?.style.display})`,
    sessionClose: `(function(){var b=document.querySelector('#illustMsgDialog .u4aWsSessOk');if(b){b.click();return 'closed';}return '없음';})()`,
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
