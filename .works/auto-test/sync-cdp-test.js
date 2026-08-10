/* 동일속성(S1a+S1b) CDP 실화면 테스트 — 대형 바인딩 별창에 붙어 진입/잠금/슬라이드/뒤로 자동판정+스크린샷. 임시. */
"use strict";
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const PORT = 9222, HOST = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve(__dirname, "..", "..", "..", "..", "AppData", "Local", "Temp", "claude"); // fallback below
const SHOT_DIR = "C:/Users/socce/AppData/Local/Temp/claude/C--Users-socce-Documents-Github-CHUNGYOON0120-U4A-WS4-0-0/097aa5ef-e9b8-4f37-871a-02ec00e9c39d/scratchpad";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpList() { try { return await (await fetch(`${HOST}/json/list`)).json(); } catch (e) { return null; } }

function conn(page) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const ready = new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    const send = (m) => new Promise((r) => { const i = ++id; const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, ...m })); });
    return { ws, ready, send };
}
async function evalP(c, expression) {
    const r = await c.send({ method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } });
    if (r.result && r.result.exceptionDetails) throw new Error("eval exc: " + JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
}
async function shot(c, file) {
    const r = await c.send({ method: "Page.captureScreenshot", params: { format: "png" } });
    if (r.result && r.result.data) { fs.writeFileSync(file, Buffer.from(r.result.data, "base64")); return true; }
    return false;
}

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.type === "page" && /바인딩 팝업|bindPopup|frame\.html/.test(x.title + x.url));
    if (!win) { console.log("바인딩 별창 없음"); process.exit(1); }
    const c = conn(win);
    await c.ready;
    await c.send({ method: "Runtime.enable" });
    await c.send({ method: "Page.enable" });

    const P = []; let fail = 0;
    const ok = (cond, m) => { P.push((cond ? "✅" : "❌") + " " + m); if (!cond) fail++; };

    // ── 0) 진입 전 상태 ──
    const pre = JSON.parse(await evalP(c,
        "JSON.stringify((function(){var l={};['edit','refresh','layout-main','additbind','layout-addit'].forEach(function(k){var e=document.querySelector('[data-bwp-lock=\"'+k+'\"]');l[k]=e?(e.disabled?'D':'E'):'-';});return{lock:l,bSync:oAPP.attr.bSyncEqualityScreenActive,page:!!document.querySelector('#bwpDesignArea .u4aBwpDesignPage')};})())"));
    ok(Object.values(pre.lock).every(v => v === "E"), "진입 전: 잠금버튼 5개 전부 활성");
    ok(pre.bSync === false, "진입 전: bSync=false");
    ok(pre.page === false, "진입 전: 동일속성 페이지 없음");

    // ── 1) 후보 있는 바인딩 행 체크 + 진입 ──
    const picked = JSON.parse(await evalP(c,
        "JSON.stringify((function(){try{var dt=oAPP.attr.designTree||[];var pick=null;" +
        "(function rec(a){(a||[]).forEach(function(n){if(pick)return;if(n.DATYP==='02'&&n.UIATV){var cc=oAPP.fn.getSameAttrList(n);if(cc&&cc.length>0)pick=n;}rec(n.zTREE_DESIGN);});})(dt);" +
        "if(!pick)return{ok:false,why:'후보 있는 바운드 리프 없음'};" +
        "(function rec(a){(a||[]).forEach(function(n){n.chk_seleced=false;rec(n.zTREE_DESIGN);});})(dt);" +
        "pick.chk_seleced=true;var cand=oAPP.fn.getSameAttrList(pick);" +
        "return{ok:true,pick:{OBJID:pick.OBJID,UIATT:pick.UIATT,UIATV:pick.UIATV,UIATY:pick.UIATY},candCount:cand.length};" +
        "}catch(e){return{ok:false,why:e.message};}})())"));
    ok(picked.ok, "체크 대상 선정: " + (picked.ok ? (picked.pick.OBJID + "/" + picked.pick.UIATT + " 후보 " + picked.candCount + "건") : picked.why));
    if (!picked.ok) { console.log(P.join("\n")); process.exit(1); }

    await evalP(c, "oAPP.fn.onSynchronizionBind();");
    await wait(700);   // 슬라이드 260 + rAF busy off + 여유.

    // ── 2) 진입 후 판정 + 스크린샷 ──
    const ent = JSON.parse(await evalP(c,
        "JSON.stringify((function(){var l={};['edit','refresh','layout-main','additbind','layout-addit'].forEach(function(k){var e=document.querySelector('[data-bwp-lock=\"'+k+'\"]');l[k]=e?(e.disabled?'D':'E'):'-';});" +
        "var pop=document.querySelector('[data-bwp-sync-popup]');var th=document.getElementById('bwpDesignTree');" +
        "return{page:!!document.querySelector('#bwpDesignArea .u4aBwpDesignPage'),syncRoot:!!document.querySelector('#bwpDesignArea .u4aBwpSyncRoot')," +
        "popDisabled:pop?pop.disabled:null,bSync:oAPP.attr.bSyncEqualityScreenActive,lock:l,treeHide:th?(th.style.display==='none'):null,busy:(document.getElementById('bwpBusy')||{}).getAttribute?document.getElementById('bwpBusy').getAttribute('data-busy'):'?'};})())"));
    ok(ent.page && ent.syncRoot, "진입: 동일속성 페이지(슬라이드 스왑) 표시");
    ok(Object.values(ent.lock).every(v => v === "D"), "진입: 잠금버튼 5개 전부 비활성 " + JSON.stringify(ent.lock));
    ok(ent.popDisabled === true, "진입: 팝업호출(140) 버튼 비활성");
    ok(ent.bSync === true, "진입: bSync=true");
    ok(ent.treeHide === true, "진입: 디자인 트리 숨김(슬라이드아웃 후)");
    ok(ent.busy === "false", "진입: busy 해제됨(렌더 후 off)");
    await shot(c, SHOT_DIR + "/sync_enter.png");

    // ── 3) 뒤로 + 복귀 판정 + 스크린샷 ──
    await evalP(c, "oAPP.fn.onSyncMoveDesignPage();");
    await wait(700);
    const back = JSON.parse(await evalP(c,
        "JSON.stringify((function(){var l={};['edit','refresh','layout-main','additbind','layout-addit'].forEach(function(k){var e=document.querySelector('[data-bwp-lock=\"'+k+'\"]');l[k]=e?(e.disabled?'D':'E'):'-';});" +
        "var th=document.getElementById('bwpDesignTree');" +
        "return{page:!!document.querySelector('#bwpDesignArea .u4aBwpDesignPage'),bSync:oAPP.attr.bSyncEqualityScreenActive,lock:l,treeShown:th?(th.style.display!=='none'):null,busy:document.getElementById('bwpBusy').getAttribute('data-busy')};})())"));
    ok(back.page === false, "뒤로: 동일속성 페이지 제거(teardown)");
    ok(Object.values(back.lock).every(v => v === "E"), "뒤로: 잠금버튼 5개 전부 복원(활성) " + JSON.stringify(back.lock));
    ok(back.bSync === false, "뒤로: bSync=false 복원");
    ok(back.treeShown === true, "뒤로: 디자인 트리 다시 표시");
    ok(back.busy === "false", "뒤로: busy 해제됨");
    await shot(c, SHOT_DIR + "/sync_back.png");

    console.log("\n" + P.join("\n"));
    console.log("\n결과: " + (P.length - fail) + " pass / " + fail + " fail");
    console.log("스크린샷: sync_enter.png, sync_back.png");
    c.ws.close();
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
