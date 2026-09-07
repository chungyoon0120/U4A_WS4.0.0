/* 응답 대기(Controller 클래스 실행) 일러스트 팝업 — 실측+실제 오픈 테스트. 임시. */
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
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: false } });
    ws.close();
    if (r.result && r.result.exceptionDetails) throw new Error("eval exc: " + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
}

const MODE = process.argv[2] || "open"; // open | close | check

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.type === "page" && x.title === "U4A Workspace #Main");
    if (!win) { console.log("#Main 창을 못 찾음. 현재 창 목록:", list.map(x => x.title)); process.exit(1); }
    console.log("대상 창:", win.title, win.url);

    if (MODE === "check") {
        const probe =
            "JSON.stringify((function(){var r={};try{" +
            "r.hasOpen=typeof oAPP.common.fnIllustMsgDialogOpen==='function';" +
            "r.hasClose=typeof oAPP.common.fnIllustMsgDialogClose==='function';" +
            "r.dlgExists=!!document.getElementById('u4aWsIllustedMsgDialog');" +
            "return r;}catch(e){return{err:e.message};}})())";
        console.log(JSON.parse(await evalOnPage(win, probe)));
        process.exit(0);
    }

    if (MODE === "close") {
        await evalOnPage(win, "oAPP.common.fnIllustMsgDialogClose();'closed'");
        console.log("닫기 호출 완료 — 화면 확인해 주세요.");
        process.exit(0);
    }

    // open (기본): 실제 팝업을 눈으로 확인
    const openExpr =
        "oAPP.common.fnIllustMsgDialogOpen({" +
        "title:'CDP 테스트',description:'이 팝업이 보이면 정상입니다 (fnIllustMsgDialogOpen)'," +
        "illustrationType:'tnt-Radar'});" +
        "JSON.stringify({open:document.getElementById('u4aWsIllustedMsgDialog')?.hasAttribute('open')})";
    const res = await evalOnPage(win, openExpr);
    console.log(JSON.parse(res));
    console.log("→ WS10 화면(#Main 창)을 확인해 주세요. 닫으려면: node .works/auto-test/illustmsg-cdp-test.js close");
    process.exit(0);
})();
