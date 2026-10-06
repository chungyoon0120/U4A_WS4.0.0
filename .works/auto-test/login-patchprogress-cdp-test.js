/* 로그인 화면 버전확인 팝업의 "다운로드 진행중(%막대)" 상태 실측 — 패치/메이저 업그레이드 공용. 임시.
 * 원본 근거: Login.js /BUSYPOP 모델(PROGVISI/TITLE/PERVALUE) → _fnSyncVersionDialog 가 반영.
 *   spAutoUpdater(Support Patch)/autoUpdaterSAP/autoUpdater(Github) 세 갈래가 같은 모델을 갱신.
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

const IFRAME = "document.querySelector('iframe').contentWindow";
const MODE = process.argv[2] || "patch"; // patch | major | close

const TITLE = {
    patch: "Support Patch Downloading...",
    major: "Downloading...",
};

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const candidates = list.filter((x) => x.type === "page" && x.title === "U4A Workspace #Main");
    let target = null;
    for (const c of candidates) {
        const r = JSON.parse(await evalOnPage(c, `JSON.stringify((function(){var w=${IFRAME};try{return {ok:typeof (w.oAPP&&w.oAPP.fn&&w.oAPP.fn.fnVersionCheckDialogOpen)==='function'};}catch(e){return{ok:false};}})())`));
        if (r.ok) { target = c; break; }
    }
    if (!target) { console.log("로그인 화면(iframe) 못 찾음"); process.exit(1); }

    if (MODE === "close") {
        const r = await evalOnPage(target, `(function(){var w=${IFRAME};var d=w.document.getElementById('u4aWsVersionCheckDialog');if(d){try{d.close();}catch(e){}return 'closed';}return '팝업없음';})()`);
        console.log(r);
        process.exit(0);
    }

    const sTitle = TITLE[MODE] || TITLE.patch;
    const expr = `(function(){var w=${IFRAME};
        var m=w.oAPP.model;
        m.setProperty('/BUSYPOP/PROGVISI', true);
        m.setProperty('/BUSYPOP/TITLE', ${JSON.stringify(sTitle)});
        m.setProperty('/BUSYPOP/DESC', 'CDP 테스트 - 다운로드 진행중 상태');
        m.setProperty('/BUSYPOP/PERVALUE', 55);
        m.setProperty('/BUSYPOP/ILLUSTTYPE', '');
        w.oAPP.fn.fnVersionCheckDialogOpen();
        var d=w.document.getElementById('u4aWsVersionCheckDialog');
        var prog=w.document.getElementById('u4aWsVerProgress');
        return JSON.stringify({open:d&&d.hasAttribute('open'), progHidden: prog&&prog.hidden, progValue: prog&&prog.value});
    })()`;
    const res = await evalOnPage(target, expr);
    console.log(MODE, "→", res);
    process.exit(0);
})();
