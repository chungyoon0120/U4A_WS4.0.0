/* 로그인 화면(iframe) 안의 버전확인/권한없음 일러스트 팝업 실측. 임시.
 * 대상 창: #Main(내부 iframe=Login.html). top window에서 iframe.contentWindow 로 접근(동일 출처, file://).
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

const TARGET = process.argv[2]; // version | noauth | check
const ACTION = process.argv[3] || "open";

const IFRAME = "document.querySelector('iframe').contentWindow";

const EXPR = {
    check: `JSON.stringify((function(){var w=${IFRAME};var r={};try{
        r.hasVersionCheck=typeof (w.oAPP&&w.oAPP.fn&&w.oAPP.fn.fnVersionCheckDialogOpen)==='function';
        r.hasNoAuth=typeof (w.oAPP&&w.oAPP.fn&&w.oAPP.fn.fnShowNoAuthIllustMsg)==='function';
    }catch(e){r.err=e.message;}return r;})())`,
    version: {
        open: `${IFRAME}.oAPP.fn.fnVersionCheckDialogOpen();JSON.stringify({open:${IFRAME}.document.getElementById('u4aWsVersionCheckDialog')?.hasAttribute('open')})`,
        close: `(function(){var d=${IFRAME}.document.getElementById('u4aWsVersionCheckDialog');if(d){try{d.close();}catch(e){}return 'closed';}return '팝업없음';})()`,
    },
    noauth: {
        open: `${IFRAME}.oAPP.fn.fnShowNoAuthIllustMsg('CDP 테스트 - 권한 없음 안내');'열림시도(직접 window.confirm류 아님, 아래 결과 확인)'`,
        close: `(function(){var d=${IFRAME}.document.querySelector('.u4a-login__noauth');if(d){try{d.close();}catch(e){}try{d.remove();}catch(e){}return 'closed';}return '팝업없음';})()`,
    },
};

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.type === "page" && x.title === "U4A Workspace #Main" &&
        // Login.html iframe 을 가진 #Main 창을 찾기 위해 일단 첫 매칭, check 모드로 걸러도 됨
        true);
    // 여러 #Main 창이 있을 수 있어 순서대로 확인
    const candidates = list.filter((x) => x.type === "page" && x.title === "U4A Workspace #Main");
    let target = null;
    for (const c of candidates) {
        try {
            const r = JSON.parse(await evalOnPage(c, EXPR.check));
            if (r.hasVersionCheck || r.hasNoAuth) { target = c; break; }
        } catch (e) { /* skip */ }
    }
    if (!target) { console.log("로그인 화면(iframe) 못 찾음. #Main 후보:", candidates.length); process.exit(1); }
    console.log("대상 창:", target.id);

    if (TARGET === "check") { console.log(JSON.parse(await evalOnPage(target, EXPR.check))); process.exit(0); }
    if (!EXPR[TARGET]) { console.log("사용법: node login-illust-cdp-test.js <version|noauth|check> <open|close>"); process.exit(1); }

    const res = await evalOnPage(target, EXPR[TARGET][ACTION]);
    console.log(TARGET, ACTION, "→", res);
    process.exit(0);
})();
