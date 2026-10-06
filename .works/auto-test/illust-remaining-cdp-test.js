/* 나머지 일러스트 팝업 중 지금 창(#Main)에서 바로 실측 가능한 2건 — 도움말 다운로드 진행률 /
 * 세션 타임아웃 안내. 로그인 화면 2건(버전확인/권한없음)은 Login 창이 떠야 실측 가능(별도 확인 필요). 임시.
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

const TARGET = process.argv[2]; // progress | session
const ACTION = process.argv[3] || "open"; // open | close

const EXPR = {
    progress: {
        open: "oAPP.common.fnProgressDialogOpen({title:'CDP 테스트',description:'도움말 다운로드 진행률 팝업입니다',percentValue:42,displayValue:'42%'});JSON.stringify({open:document.getElementById('u4aWsProgressDialog')?.hasAttribute('open')})",
        close: "oAPP.common.fnProgressDialogClose();'closed'",
    },
    session: {
        open: "oAPP.fn.fnShowIllustMsgDialog('CDP 테스트','세션 타임아웃 안내 팝업입니다','tnt-SessionExpired',null,function(){});JSON.stringify({open:document.getElementById('illustMsgDialog')?.hasAttribute('open')})",
        close: "(function(){var b=document.querySelector('#illustMsgDialog .u4aWsSessOk');if(b){b.click();return 'OK버튼 클릭으로 닫음';}return '팝업 없음';})()",
    },
};

if (!EXPR[TARGET]) { console.log("사용법: node illust-remaining-cdp-test.js <progress|session> <open|close>"); process.exit(1); }

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.type === "page" && x.title === "U4A Workspace #Main");
    if (!win) { console.log("#Main 창을 못 찾음"); process.exit(1); }
    const res = await evalOnPage(win, EXPR[TARGET][ACTION]);
    console.log(TARGET, ACTION, "→", res);
    process.exit(0);
})();
