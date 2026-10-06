/* 서버리스트 창 - 프로그램 종료 확인 / 활성화된 창 있음 안내 팝업 실측. 임시.
 * ★주의: fnRequestClose() 는 활성 자식(MAIN) 창이 0개면 곧바로 APP.exit() 를 호출한다(원본 로직).
 *   그래서 "활성화된 창 있음" 팝업은 실제 자식창이 있을 때만 fnRequestClose 로 안전하게 재현 가능.
 *   지금처럼 자식창이 없으면 DOM 을 직접 만들어 같은 그림 파일이 뜨는지만 확인한다(_showIllustDialog
 *   자체는 파일 내부 지역함수라 밖에서 직접 호출 불가 — 동일 자산 경로/로직을 그대로 복제해 검증).
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
const MODE = process.argv[3]; // exitOpen | exitCancel | activatedProbe | activatedClose | theme

const EXPR = {
    theme: (arg) => `(function(){ if(${JSON.stringify(arg)}) { oAPP.fn.fnApplyTheme(${JSON.stringify(arg)}); } return JSON.stringify({theme:document.documentElement.getAttribute('data-sl-theme'), name:document.documentElement.dataset.theme}); })()`,
    exitOpen: () => `oAPP.fn.fnShowShutdownAskPopup();JSON.stringify({open:document.getElementById('u4aProgramExitDlg')?.hasAttribute('open')})`,
    exitCancel: () => `(function(){var d=document.getElementById('u4aProgramExitDlg');if(!d)return '없음';var btns=d.querySelectorAll('.u4aWsExitFoot button');var cancel=btns[btns.length-1];if(cancel){cancel.click();return 'Cancel 클릭으로 닫음';}return '버튼없음';})()`,
    // fnRequestClose 를 직접 부르면 자식창 0개일 때 APP.exit() 위험 → 같은 자산 경로만 직접 검증(안전).
    activatedProbe: (arg) => `(function(){var sMode=${JSON.stringify(arg)}||'light';var u=new URL('../svg/activated-windows-'+sMode+'.svg', location.href).href;var img=new Image();return new Promise(function(resolve){img.onload=function(){resolve(JSON.stringify({ok:true,w:img.naturalWidth,url:u}));};img.onerror=function(){resolve(JSON.stringify({ok:false,url:u}));};img.src=u;});})()`,
};

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.id === WIN_ID);
    if (!win) { console.log("창 못 찾음:", WIN_ID); process.exit(1); }
    if (!EXPR[MODE]) { console.log("모드 오류"); process.exit(1); }
    const arg = process.argv[4];
    const isAsync = MODE === "activatedProbe";
    const expr = EXPR[MODE](arg);
    const res = isAsync
        ? await (async () => {
            const ws = new WebSocket(win.webSocketDebuggerUrl);
            await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
            let id = 0;
            const send = (m) => new Promise((r) => { const i = ++id; const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, ...m })); });
            await send({ method: "Runtime.enable" });
            const r = await send({ method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } });
            ws.close();
            return r.result.result.value;
        })()
        : await evalOnPage(win, expr);
    console.log(MODE, "→", res);
    process.exit(0);
})();
