/* ********************************************************************
 * [숏컷 링크 생성] 앱 검색 도움말(F4) 실행 시
 *   "ResizeObserver loop limit exceeded" 크리티컬 오류가 뜨는지 자동 판정.
 *
 * 앞서 로그인이 되어 있어야 한다:
 *     node .works/auto-test/login-smoke.js --fresh
 * 그 다음:
 *     node .works/auto-test/shortcut-appf4-ro-test.js
 * ******************************************************************** */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function list() { return await (await fetch(HOST + "/json/list")).json(); }

async function conn(p) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => {
        const i = ++id;
        const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } };
        ws.on("message", h); ws.send(JSON.stringify(Object.assign({ id: i }, m)));
    });
    await send({ method: "Runtime.enable" });
    return {
        close: () => ws.close(),
        eval: async (e) => {
            const r = await send({ method: "Runtime.evaluate", params: { expression: e, returnByValue: true, awaitPromise: true } });
            if (r.result && r.result.exceptionDetails) {
                return "EXC:" + ((r.result.exceptionDetails.exception || {}).description || "").slice(0, 400);
            }
            return r.result && r.result.result ? r.result.result.value : undefined;
        }
    };
}

// 크리티컬 오류창(네이티브)이 뜨면 앱이 죽으므로, RO 경고만 세고 삼킨다.
const INSTALL_COUNTER = [
    "(function(){",
    "  if (window.__roCount !== undefined) { return 'already ' + window.__roCount; }",
    "  window.__roCount = 0; window.__roMsg = [];",
    "  window.addEventListener('error', function(ev){",
    "    var m = String((ev && ev.message) || '');",
    "    if (m.indexOf('ResizeObserver loop') >= 0) {",
    "      window.__roCount++; if (window.__roMsg.length < 3) { window.__roMsg.push(m); }",
    "      ev.stopImmediatePropagation(); ev.preventDefault(); return false;",
    "    }",
    "  }, true);",
    "  return 'installed';",
    "})()"
].join("\n");

const OPEN_F4 = [
    "(function(){",
    "  if (!window.oAPP || !oAPP.fn || typeof oAPP.fn.fnAppF4PopupOpen !== 'function') { return 'F4 함수 없음'; }",
    "  var u = (window.getUserInfo && getUserInfo()) || {};",
    "  oAPP.fn.fnAppF4PopupOpen({ autoSearch:true, pickOnly:true,",
    "      initCond:{ PACKG:'', APPNM:'', APPTY:'M', ERUSR: u.ID || '', HITS: 500 } }, function(){});",
    "  return '호출됨';",
    "})()"
].join("\n");

const READ = [
    "(function(){",
    "  var dlg = document.querySelector('dialog.u4aAppF4Dlg') || document.querySelector('dialog[class*=AppF4]');",
    "  var rows = document.querySelectorAll('.u4aAppF4Tbl--scroll tbody tr').length;",
    "  return JSON.stringify({ ro: window.__roCount, msg: window.__roMsg,",
    "     팝업: dlg ? (dlg.open ? '열림' : '닫힘') : '없음', 그린행수: rows });",
    "})()"
].join("\n");

(async () => {

    let L = await list();
    const main = L.find((x) => x.type === "page" && /ws10_20\/index\.html/.test(x.url) && !/Popups/.test(x.url));
    if (!main) { console.log("실패: 로그인된 본창(#Main)을 못 찾음 — login-smoke.js --fresh 를 먼저 실행"); process.exit(1); }
    const cMain = await conn(main);

    console.log("[1] 숏컷 링크 생성 창 열기");
    const r1 = await cMain.eval("(function(){ if(!window.oAPP||!oAPP.fn||typeof oAPP.fn.fnWS10WMENU10_04_01!=='function'){return '메뉴함수 없음';} oAPP.fn.fnWS10WMENU10_04_01(); return '호출됨'; })()");
    console.log("    →", r1);

    let sc = null;
    for (let i = 0; i < 100; i++) {
        await sleep(150);
        L = await list();
        sc = L.find((x) => x.type === "page" && /ShortCutCreator\/index\.html/.test(decodeURIComponent(x.url || "")));
        if (sc) { break; }
    }
    if (!sc) { console.log("실패: 숏컷 링크 생성 창이 안 열림"); cMain.close(); process.exit(1); }
    console.log("[2] 숏컷 창 확인 —", decodeURIComponent(sc.url).split("?")[0].split("/").slice(-2).join("/"));   // 쿼리(계정정보 포함) 는 찍지 않는다

    const cSc = await conn(sc);
    console.log("[3] 오류 세는 장치 설치(가능한 한 이른 시점) —", await cSc.eval(INSTALL_COUNTER));
    await sleep(3000);   // 숏컷 화면 다 그릴 때까지

    const before = JSON.parse(await cSc.eval(READ));
    console.log("    숏컷 화면만 그린 뒤 / F4 열기 전:", JSON.stringify(before));

    console.log("[4] 앱 검색 도움말(F4) 열기 —", await cSc.eval(OPEN_F4));
    await sleep(7000);

    const after = JSON.parse(await cSc.eval(READ));
    console.log("    F4 연 뒤 :", JSON.stringify(after));

    const ok = after.ro === 0 && after.팝업 === "열림";
    console.log("\n===== 결과 =====");
    console.log((ok ? "OK  " : "FAIL") + "  ResizeObserver 경고 " + after.ro + "건 · 도움말팝업=" + after.팝업 + " · 그린행수=" + after.그린행수);
    if (after.msg && after.msg.length) { console.log("      메시지:", after.msg.join(" | ")); }

    try { await cSc.eval("(function(){ var d=document.querySelector('dialog[class*=AppF4]'); if(d&&d.open){d.close();} return 1; })()"); } catch (e) { }
    try { await cSc.eval("window.close()"); } catch (e) { }
    cSc.close(); cMain.close();
    process.exit(ok ? 0 : 1);

})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
