/* 동일속성(S1) CDP 진단 — 대형 바인딩 별창("바인딩 팝업")에 붙어 S1b 반영여부+진입 데이터 확인. 임시. */
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

(async () => {
    const list = await cdpList();
    if (!list) { console.log("CDP DOWN"); process.exit(1); }
    const win = list.find((x) => x.type === "page" && /바인딩 팝업|bindPopup|frame\.html/.test(x.title + x.url));
    if (!win) { console.log("바인딩 별창 page 없음"); process.exit(1); }
    console.log("별창:", win.title);

    const probe =
        "JSON.stringify((function(){var r={};try{" +
        "r.hasOpenSync=typeof oAPP.fn.openSyncBindScreen==='function';" +
        "r.hasOnSync=typeof oAPP.fn.onSynchronizionBind==='function';" +
        "r.hasSwap=typeof oAPP.fn.designSwapToPage==='function';" +
        "r.hasGetSel=typeof oAPP.fn.getSelectedDesignTree==='function';" +
        "r.hasGetSameAttr=typeof oAPP.fn.getSameAttrList==='function';" +
        "r.designRows=document.querySelectorAll('#bwpDesignTree .u4a-tree__row').length;" +
        "r.editable=oAPP.attr.editable;" +
        "var dt=oAPP.attr.designTree||[];var bound=[];" +
        "(function rec(a){(a||[]).forEach(function(n){if(n.DATYP==='02'&&n.UIATV)bound.push({OBJID:n.OBJID,UIATT:n.UIATT,UIATV:n.UIATV,UIATK:n.UIATK,UIATY:n.UIATY});rec(n.zTREE_DESIGN);});})(dt);" +
        "r.boundCount=bound.length;r.sample=bound.slice(0,4);" +
        "var withM=bound.filter(function(n){return n.MPROP;});r.mpropSampleRaw=bound.slice(0,2).map(function(n){return{OBJID:n.OBJID,UIATT:n.UIATT,UIADT:n.UIADT,MPROP:n.MPROP,keys:Object.keys(n).filter(function(k){return['OBJID','UIATT','UIADT','UIATV','UIATY','MPROP'].indexOf(k)>=0;})};});" +
        "var mp=null;(function rec(a){(a||[]).forEach(function(n){if(mp)return;if(n.DATYP==='02'&&n.MPROP)mp={OBJID:n.OBJID,UIATT:n.UIATT,MPROP:n.MPROP};rec(n.zTREE_DESIGN);});})(dt);r.firstWithMPROP=mp;" +
        "var u=(oAPP.attr.T_9011||[]).filter(function(a){return a.CATCD==='UA028'&&a.FLD02!=='X';}).slice().sort(function(a,b){return a.ITMCD.localeCompare(b.ITMCD);});r.ua028=u.map(function(a){return{ITMCD:a.ITMCD,FLD01:a.FLD01};});" +
        "r.lockBtns={};['edit','refresh','layout-main','additbind','layout-addit'].forEach(function(k){var e=document.querySelector('[data-bwp-lock=\"'+k+'\"]');r.lockBtns[k]=e?(e.disabled?'disabled':'enabled'):'없음';});" +
        "return r;}catch(e){return{err:e.message};}})())";
    const res = JSON.parse(await evalOnPage(win, probe));
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
})();
