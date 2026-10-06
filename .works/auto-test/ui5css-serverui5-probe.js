/* UI5 미리 정의된 CSS 팝업(패키지, 서버 UI5) 실측 — 읽기만.
 *   틀 창 + 카드 영역 iframe + 다른 CSS 가이드 별창(M1/M2)이 열려 있으면 각각:
 *   UI5 버전·Core 초기화·로드된 라이브러리·로딩표시(busy) 상태·예외/콘솔오류 를 찍는다.
 * 사용: NODE_PATH=<repo>/node_modules node ui5css-serverui5-probe.js
 */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(page) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
    let id = 0; const events = [];
    ws.on("message", (d) => { const m = JSON.parse(d); if (m.method) { events.push(m); } });
    const send = (method, params) => new Promise((r) => { const i = ++id; const h = (d) => { const m = JSON.parse(d); if (m.id === i) { ws.off("message", h); r(m); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
    return { send, events, close: () => ws.close() };
}
async function evalv(c, expression) {
    const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return "EVAL EXC: " + ((r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text); }
    return r.result && r.result.result ? r.result.result.value : undefined;
}
// 창 종류별 iframe 경로: 틀 = #ws_frame(index.html) → 그 안 #u4aWsCssPrevFrame(detail/frame.html) → #detail_frame(detail/index.html)
//                       M1/M2 = #detail_frame(frame.html)
const EXPR = `(function(){
  function ui5(w){ try { var s = w.sap; if (!s || !s.ui) return { sap: typeof s }; var c = s.ui.getCore();
    return { ver: s.ui.version, init: c.isInitialized(), libs: Object.keys(c.getLoadedLibraries()), theme: c.getConfiguration().getTheme(),
             boot: ((w.document.getElementById('sap-ui-bootstrap')||{}).src||'').replace(/^https?:\\/\\/[^/]+/, '') }; } catch(e){ return { err: e.message }; } }
  var out = { url: location.href.split('?')[0].split('/').slice(-3).join('/'), busyAttr: (function(){ var b = document.querySelector('.u4a-busy'); return b ? b.getAttribute('data-busy') : 'no .u4a-busy'; })() };
  var f1 = document.getElementById('ws_frame') || document.getElementById('detail_frame');
  if (f1 && f1.contentWindow) {
    out.level1 = ui5(f1.contentWindow);
    var f2 = f1.contentWindow.document.getElementById('u4aWsCssPrevFrame');
    if (f2 && f2.contentWindow) {
      out.level2_prevFrame = { src: (f2.getAttribute('src')||'').split('?')[0].split('/').slice(-2).join('/') };
      var f3 = f2.contentWindow.document.getElementById('detail_frame');
      if (f3 && f3.contentWindow) { out.level3_cards = ui5(f3.contentWindow); out.level3_cards.cardCount = f3.contentWindow.document.querySelectorAll('.sapMCheckBox').length; }
    }
  }
  return JSON.stringify(out);
})()`;

(async () => {
    let list; try { list = await (await fetch(`${HOST}/json/list`)).json(); } catch (e) { console.log("CDP DOWN"); process.exit(1); }
    const wins = list.filter((x) => x.type === "page" && /ui5CssPopup_v2/i.test(x.url || ""));
    if (!wins.length) { console.log("UI5 미리 정의된 CSS 팝업(또는 별창)이 열려 있지 않음"); process.exit(2); }
    for (const w of wins) {
        console.log("\n==== " + w.title + " | " + (w.url || "").split("?")[0].split("/").slice(-3).join("/"));
        const c = await connect(w);
        await c.send("Runtime.enable"); try { await c.send("Log.enable"); } catch (e) { }
        await sleep(600);
        const st = await evalv(c, EXPR);
        console.log(typeof st === "string" && st.startsWith("{") ? JSON.stringify(JSON.parse(st), null, 2) : st);
        const ex = c.events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") || (e.method === "Log.entryAdded" && e.params.entry.level === "error"));
        console.log("오류/예외 재생분: " + ex.length);
        ex.slice(0, 10).forEach((e) => {
            if (e.method === "Runtime.exceptionThrown") { const d = e.params.exceptionDetails; console.log("  [exception]", ((d.exception || {}).description || d.text || "").split("\n")[0].slice(0, 250)); }
            else if (e.method === "Runtime.consoleAPICalled") { console.log("  [console.error]", e.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(" ").slice(0, 250)); }
            else { console.log("  [log.error]", String(e.params.entry.text).slice(0, 250)); }
        });
        c.close();
    }
    process.exit(0);
})().catch((e) => { console.error("PROBE ERR", e.message); process.exit(1); });
