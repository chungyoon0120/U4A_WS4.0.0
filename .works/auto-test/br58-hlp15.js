/* [BR58 검수반영] HLP15 단독 — 폭을 좁혀 물음표 버튼이 ⋯ 안으로 접힌 상태에서
   ⋯ 메뉴의 "도움말" 로 도움말 창이 뜨는지. 끝나면 창 크기를 원래대로 되돌린다. */
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
    return { close: () => ws.close(), eval: async (e) => {
        const r = await send({ method: "Runtime.evaluate", params: { expression: e, returnByValue: true, awaitPromise: true } });
        if (r.result && r.result.exceptionDetails) { return "EXC:" + ((r.result.exceptionDetails.exception || {}).description || "").slice(0, 300); }
        return r.result && r.result.result ? r.result.result.value : undefined;
    } };
}
const BUSY = "document.getElementById(\"u4aWsBusyIndicator\").open ? \"★남음\" : \"꺼짐\"";
const TIPDOC = (t) => decodeURIComponent(t.url || "").indexOf("design/html/helper/") >= 0;
const OLD_ON = [
    "(function(){ if (window.__BR58_OLD) { return \"이미\"; }",
    "  var fn = function(e){ var b = e.target && e.target.closest ? e.target.closest(\"button\") : null;",
    "    if (!b) { return; }",
    "    if (!(b.id === \"ws20PrevHelpBtn\" || b.id === \"ws20AttrHelpBtn\" || /fa-circle-question/.test(b.innerHTML || \"\"))) { return; }",
    "    var bak = oAPP.common.checkWLOList;",
    "    oAPP.common.checkWLOList = function(a,c){ if (a===\"C\" && c===\"UHAK901369\") { return false; } return bak.apply(oAPP.common, arguments); };",
    "    setTimeout(function(){ oAPP.common.checkWLOList = bak; }, 0); };",
    "  document.addEventListener(\"click\", fn, true); window.__BR58_OLD = fn; return \"켬\"; })()"
].join("\n");
const OLD_OFF = "(function(){ if (!window.__BR58_OLD) { return \"이미\"; } document.removeEventListener(\"click\", window.__BR58_OLD, true); delete window.__BR58_OLD; return \"끔\"; })()";
const STATE = [
    "(function(){",
    "  var bar = document.getElementById(\"ws20DesignTree\");",
    "  var a = bar ? [].slice.call(bar.querySelectorAll(\"button\")) : [];",
    "  var q = a.filter(function(x){ return /fa-circle-question/.test(x.innerHTML); })[0];",
    "  var o = a.filter(function(x){ return /fa-ellipsis/.test(x.innerHTML); })[0];",
    "  return JSON.stringify({ 창폭: window.innerWidth,",
    "    트리폭: bar ? Math.round(bar.getBoundingClientRect().width) : -1,",
    "    물음표: q ? (q.offsetParent ? \"보임\" : \"접힘\") : \"없음\",",
    "    점세개: o ? (o.offsetParent ? \"보임\" : \"숨김\") : \"없음\" });",
    "})()"
].join("\n");

(async () => {
    const L = await list();
    const main = L.find((x) => x.type === "page" && /ws10_20\/index\.html/.test(x.url));
    if (!main) { console.log("실패: 앱 본창을 못 찾음"); process.exit(1); }
    const c = await conn(main);
    let oBounds = null, ok = false, sDet = "", bWasMax = false;

    try {
        oBounds = JSON.parse(await c.eval("JSON.stringify(parent.REMOTE.getCurrentWindow().getBounds())"));
        bWasMax = await c.eval("parent.REMOTE.getCurrentWindow().isMaximized()");
        console.log("[원래 창 크기]", JSON.stringify(oBounds), "· 최대화=" + bWasMax);

        //최대화 상태면 크기 변경이 먹지 않는다 → 잠깐 풀고, 끝나면 다시 최대화.
        if (bWasMax) {
            await c.eval("(function(){ parent.REMOTE.getCurrentWindow().unmaximize(); return 1; })()");
            await sleep(1200);
        }
        await c.eval(OLD_ON);

        let st = null;
        for (const w of [1000, 860, 740, 640, 560, 480]) {
            await c.eval("(function(){ var win = parent.REMOTE.getCurrentWindow(); var b = win.getBounds();"
                + " win.setBounds({ x: b.x, y: b.y, width: " + w + ", height: b.height }); return 1; })()");
            await sleep(1500);
            st = JSON.parse(await c.eval(STATE));
            console.log("[폭 " + w + " 시도]", JSON.stringify(st));
            if (st.물음표 === "접힘" && st.점세개 === "보임") { break; }
        }

        if (!st || st.물음표 !== "접힘" || st.점세개 !== "보임") {
            sDet = "접힘 상태를 못 만듦 — 마지막 상태 " + JSON.stringify(st);
        } else {
            const before = (await list()).filter(TIPDOC).map((t) => t.id);
            const menu = await c.eval([
                "(function(){",
                "  var bar = document.getElementById(\"ws20DesignTree\");",
                "  var o = [].slice.call(bar.querySelectorAll(\"button\")).filter(function(b){ return /fa-ellipsis/.test(b.innerHTML); })[0];",
                "  if (!o || !o.offsetParent) { return \"점세개 못 누름\"; }",
                "  o.click(); return \"점세개 누름\";",
                "})()"
            ].join("\n"));
            await sleep(1000);
            const items = await c.eval([
                "(function(){",
                "  var m = document.querySelectorAll(\".u4a-menu\");",
                "  if (!m.length) { return \"메뉴 안 열림\"; }",
                "  var all = [].slice.call(m[m.length-1].querySelectorAll(\"*\")).filter(function(x){ return x.children.length === 0 && (x.textContent||\"\").trim(); });",
                "  return JSON.stringify(all.map(function(x){ return (x.textContent||\"\").trim(); }).slice(0, 30));",
                "})()"
            ].join("\n"));
            console.log("[⋯ 메뉴]", menu, items);
            const pick = await c.eval([
                "(function(){",
                "  var m = document.querySelectorAll(\".u4a-menu\");",
                "  if (!m.length) { return \"메뉴 없음\"; }",
                "  var box = m[m.length-1];",
                "  var cand = [].slice.call(box.querySelectorAll(\"*\")).filter(function(x){ return (x.textContent||\"\").trim() === \"도움말\"; });",
                "  if (!cand.length) { return \"도움말 항목 없음\"; }",
                "  var t = cand[cand.length-1];",
                "  var row = t.closest(\"[role=menuitem], li, button\") || t;",
                "  row.click(); return \"도움말 누름\";",
                "})()"
            ].join("\n"));
            await sleep(3500);
            const fresh = (await list()).filter(TIPDOC).filter((t) => before.indexOf(t.id) < 0);
            const busy = await c.eval(BUSY);
            ok = fresh.length > 0 && busy !== "★남음";
            sDet = "폭" + st.창폭 + " 물음표=" + st.물음표 + " · " + menu + " · " + pick + " · 창" + fresh.length
                + (fresh.length ? "(" + decodeURIComponent(fresh[0].url).split("/helper/")[1] + ")" : "") + " · 대기" + busy;
        }
    } finally {
        try { if (oBounds) { await c.eval("(function(){ parent.REMOTE.getCurrentWindow().setBounds(" + JSON.stringify(oBounds) + "); return 1; })()"); } } catch (e) { }
        try { if (bWasMax) { await sleep(600); await c.eval("(function(){ parent.REMOTE.getCurrentWindow().maximize(); return 1; })()"); } } catch (e) { }
        try { await c.eval(OLD_OFF); } catch (e) { }
        let n = 0;
        for (const t of await list()) { if (t.type === "page" && TIPDOC(t)) { try { await fetch(HOST + "/json/close/" + t.id); n++; } catch (e) { } } }
        console.log("[정리] 도움말 창 " + n + "개 닫음 · 창크기 복원 · 구버전흉내 끔");
    }

    console.log("\n===== 결과 =====");
    console.log((ok ? "OK  " : "FAIL") + "  HLP15  " + sDet);
    c.close();
    process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
