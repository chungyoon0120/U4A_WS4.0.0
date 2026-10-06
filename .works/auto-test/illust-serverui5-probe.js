/* Image Icons(illustMsgPopup) 별창이 busy 에서 멈추는 원인 실측 — 패키지 앱(CDP 9222)에 붙어
 *   ① 호스트(index.html) 상태: 부트 경로(WSSRC/SSRC)·isPackaged·bLoadFailed·attachInit 통과 여부(oAPP.WIN)
 *   ② 뷰어 iframe(frame.html): sap 존재·버전·Core 초기화·로드된 라이브러리·테마·부트 script src
 *   ③ iframe 리소스 타이밍: sap-ui/library-preload/themes 요청의 크기·시간(0바이트 = 실패 의심)
 *   ④ 서버 라이브러리 직접 조회: sap-ui-core.js + 선언 라이브러리 4개 preload + 테마 CSS 의 HTTP 상태
 *   ⑤ 콘솔 메시지 재생(Runtime/Log enable 시 버퍼 재생분)
 * 읽기만 한다(GET/HEAD 조회 외 화면 조작 없음). 사용: NODE_PATH=<repo>/node_modules node illust-serverui5-probe.js
 */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";

async function cdpList() { try { return await (await fetch(`${HOST}/json/list`)).json(); } catch (e) { return null; } }

function connect(page) {
    return new Promise((res, rej) => {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        let id = 0; const waiters = new Map(); const events = [];
        ws.on("message", (d) => {
            const j = JSON.parse(d);
            if (j.id && waiters.has(j.id)) { waiters.get(j.id)(j); waiters.delete(j.id); }
            else if (j.method) { events.push(j); }
        });
        ws.on("open", () => res({
            send: (method, params) => new Promise((r) => { const i = ++id; waiters.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }),
            events, close: () => ws.close(),
        }));
        ws.on("error", rej);
    });
}

async function evalJs(c, expression) {
    const r = await c.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __error: r.result.exceptionDetails.text || JSON.stringify(r.result.exceptionDetails).slice(0, 300) }; }
    return r.result && r.result.result ? r.result.result.value : undefined;
}

const EXPR_HOST = `(function(){
  var f = document.getElementById('floatFrame');
  var w = f && f.contentWindow, d = w && w.document;
  var out = {
    hostUrl: location.href,
    isPackaged: (oAPP.APP && oAPP.APP.isPackaged),
    WSSRC: oAPP.UI5LIB_WSSRC, SSRC: oAPP.UI5LIB_SSRC,
    sServerHost: oAPP.attr && oAPP.attr.sServerHost, sServerLibPath: oAPP.attr && oAPP.attr.sServerLibPath,
    UI5_THEME: oAPP.UI5_THEME, UI5_LANGU: oAPP.UI5_LANGU,
    bLoadFailed: !!(oAPP.attr && oAPP.attr.bLoadFailed),
    attachInitRan_oAPP_WIN: !!oAPP.WIN,
    frameIsReady: !!(f && f.classList.contains('is-ready')),
    frameSrc: f && f.getAttribute('src'),
  };
  if (!w) { out.iframe = 'floatFrame 없음'; return JSON.stringify(out); }
  var s = w.sap;
  out.iframe = {
    readyState: d.readyState,
    bootScriptSrc: (d.getElementById('sap-ui-bootstrap') || {}).src,
    bootLibsAttr: (d.getElementById('sap-ui-bootstrap') || {}).getAttribute && d.getElementById('sap-ui-bootstrap').getAttribute('data-sap-ui-libs'),
    typeofSap: typeof s,
    ui5Version: (s && s.ui && s.ui.version) || null,
    coreInitialized: (s && s.ui && s.ui.getCore && (function(){ try { return s.ui.getCore().isInitialized(); } catch(e){ return 'ERR ' + e.message; } })()) ,
    loadedLibs: (s && s.ui && s.ui.getCore) ? (function(){ try { return Object.keys(s.ui.getCore().getLoadedLibraries()); } catch(e){ return 'ERR ' + e.message; } })() : null,
    theme: (s && s.ui && s.ui.getCore) ? (function(){ try { return s.ui.getCore().getConfiguration().getTheme(); } catch(e){ return 'ERR ' + e.message; } })() : null,
    frameJsTagPresent: !!d.querySelector('script[src="JS/frame.js"]'),
    resources: (w.performance.getEntriesByType('resource') || [])
      .filter(function(e){ return /sap-ui|library-preload|library\\.css|library-parameters|\\/sap\\//.test(e.name); })
      .map(function(e){ return { name: e.name.replace(/^.*?\\/(resources|sap)\\//, '…/$1/').slice(0, 110), ms: Math.round(e.duration), bytes: e.transferSize, body: e.decodedBodySize }; })
      .slice(0, 60),
  };
  return JSON.stringify(out);
})()`;

const EXPR_SERVER_CHECK = `(async function(){
  var base = String(oAPP.UI5LIB_SSRC || '').replace(/sap-ui-core\\.js.*$/, '');
  var libs = ['sap-ui-core.js','sap/ui/core/library-preload.js','sap/m/library-preload.js','sap/f/library-preload.js','sap/ui/table/library-preload.js',
              'sap/m/themes/' + (oAPP.UI5_THEME||'sap_horizon') + '/library.css','sap/f/themes/' + (oAPP.UI5_THEME||'sap_horizon') + '/library.css','sap/ui/table/themes/' + (oAPP.UI5_THEME||'sap_horizon') + '/library.css'];
  var out = { base: base, results: [] };
  for (var i = 0; i < libs.length; i++) {
    var u = base + libs[i];
    try {
      var r = await fetch(u, { method: 'GET', cache: 'no-store' });
      var ct = r.headers.get('content-type') || '';
      var head = '';
      try { head = (await r.text()).slice(0, 80).replace(/\\s+/g, ' '); } catch (e) { head = 'text ERR'; }
      out.results.push({ file: libs[i], status: r.status, ok: r.ok, contentType: ct.slice(0, 40), head: head });
    } catch (e) { out.results.push({ file: libs[i], error: String(e && e.message) }); }
  }
  return JSON.stringify(out);
})()`;

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN (9222 닫힘)"); process.exit(1); }
    console.log("== CDP 타겟 ==");
    list.forEach((x) => console.log("  ", x.type, "|", x.title, "|", (x.url || "").slice(0, 100)));
    const win = list.find((x) => x.type === "page" && /illustMsgPopup/i.test(x.url || ""));
    if (!win) { console.log("\nImage Icons 팝업 창(url 에 illustMsgPopup)을 못 찾음 — 팝업이 열려 있어야 합니다."); process.exit(2); }

    const c = await connect(win);
    await c.send("Runtime.enable");
    try { await c.send("Log.enable"); } catch (e) { }
    await new Promise((r) => setTimeout(r, 800));   // 버퍼 재생 수신 대기(대기 로직이 아니라 이벤트 수집 창)

    console.log("\n== ① ② ③ 호스트/iframe 상태 ==");
    const st = await evalJs(c, EXPR_HOST);
    console.log(typeof st === "string" ? JSON.stringify(JSON.parse(st), null, 2) : st);

    console.log("\n== ④ 서버 라이브러리 직접 조회(GET) ==");
    const sv = await evalJs(c, EXPR_SERVER_CHECK);
    console.log(typeof sv === "string" ? JSON.stringify(JSON.parse(sv), null, 2) : sv);

    console.log("\n== ⑤ 콘솔/로그 재생분 ==");
    const msgs = c.events.filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Log.entryAdded" || e.method === "Runtime.exceptionThrown");
    if (!msgs.length) { console.log("  (재생된 메시지 없음)"); }
    msgs.slice(0, 40).forEach((e) => {
        if (e.method === "Runtime.consoleAPICalled") {
            console.log("  [console." + e.params.type + "]", e.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(" ").slice(0, 300));
        } else if (e.method === "Log.entryAdded") {
            const p = e.params.entry; console.log("  [log." + p.level + "]", (p.url || "").slice(-80), "|", String(p.text).slice(0, 250));
        } else {
            const d = e.params.exceptionDetails; console.log("  [exception]", d.text, (d.exception && d.exception.description || "").slice(0, 250));
        }
    });
    c.close();
    process.exit(0);
})().catch((e) => { console.error("PROBE ERR", e && e.message); process.exit(1); });
