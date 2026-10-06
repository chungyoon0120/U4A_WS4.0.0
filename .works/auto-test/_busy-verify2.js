/* 서버 응답을 일부러 1.5초 늦춰서, 그 사이 대기 표시가 켜져 있고 팝업을 못 만지는지 확인.
   ① 도움말 창을 "닫힌 상태"에서 처음 여는 경로  ② 계층 구조 탭 누르는 경로 */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = async () => await (await fetch(HOST + "/json/list")).json();
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
        if (r.result && r.result.exceptionDetails) { return "EXC:" + ((r.result.exceptionDetails.exception || {}).description || "").slice(0, 400); }
        return r.result && r.result.result ? r.result.result.value : undefined;
    } };
}

const DELAY_ON = `(function(){
  if (window.__origSendAjax) { return "이미"; }
  window.__origSendAjax = window.sendAjax;
  window.sendAjax = function(p, fd, ok, a, b, m, err){
    var _ok = ok;
    return window.__origSendAjax(p, fd, function(res){ setTimeout(function(){ if(_ok){_ok(res);} }, 1500); }, a, b, m, err);
  };
  return "지연 1.5초 걸었음";
})()`;
const DELAY_OFF = `(function(){
  if (!window.__origSendAjax) { return "이미"; }
  window.sendAjax = window.__origSendAjax; delete window.__origSendAjax; return "지연 풀었음";
})()`;

const PROBE = `(function(){
  var busy = document.getElementById("u4aShortcutBusy");
  var dlg = document.querySelector("dialog[class*=AppF4]");
  var inp = document.querySelector(".u4aAppF4Form input");
  var got = "입력칸 없음";
  if (inp) {
    var before = document.activeElement;
    try { inp.focus(); } catch(e){}
    got = (document.activeElement === inp) ? "★만져짐(문제)" : "안 만져짐(정상)";
    try { if (before && before.focus) { before.focus(); } } catch(e){}
  }
  return JSON.stringify({ 대기표시: busy && busy.open ? "켜짐" : "꺼짐",
     도움말창: dlg ? (dlg.open?"열림":"닫힘") : "없음",
     줄수: document.querySelectorAll(".u4aAppF4Tbl--scroll tbody tr").length,
     팝업만지기: got });
})()`;

async function trace(c, label, ms) { console.log("    " + label, await c.eval(PROBE)); }

(async () => {
    const L = await list();
    const sc = L.find((x) => x.type === "page" && /ShortCutCreator\/index\.html/.test(decodeURIComponent(x.url || "")));
    if (!sc) { console.log("실패: 쇼컷링크 생성 창을 못 찾음"); process.exit(1); }
    const c = await conn(sc);

    try {
        // 도움말 창을 완전히 없앤다 → "처음 여는 경로"로 강제
        console.log("[준비] 도움말 창 제거 —", await c.eval(
            `(function(){ var d=document.getElementById("u4aAppF4Dlg"); if(!d){return "원래 없음";} try{if(d.open){d.close();}}catch(e){} d.remove(); return "제거함"; })()`));
        console.log("[준비] 응답 지연 —", await c.eval(DELAY_ON));
        await sleep(300);

        console.log("[A] 닫힌 상태에서 도움말 처음 열기 —", await c.eval(
            `(function(){ var u=getUserInfo(); oAPP.fn.fnAppF4PopupOpen({autoSearch:true,pickOnly:true,
              initCond:{PACKG:'',APPNM:'',APPTY:'M',ERUSR:u.ID,HITS:500}}, function(){}); return "호출됨"; })()`));
        await sleep(300);  await trace(c, "0.3초 :");
        await sleep(700);  await trace(c, "1.0초 :");
        await sleep(1500); await trace(c, "2.5초 :");
        await sleep(1500); await trace(c, "4.0초 :");

        console.log("[B] 계층 구조 탭 누름 —", await c.eval(
            `(function(){ var t=[].slice.call(document.querySelectorAll(".u4aAppF4Tab")); if(t.length<2){return "탭 없음";} t[1].click(); return "눌렀음"; })()`));
        await sleep(300);  await trace(c, "0.3초 :");
        await sleep(700);  await trace(c, "1.0초 :");
        await sleep(1500); await trace(c, "2.5초 :");
        await sleep(1500); await trace(c, "4.0초 :");

    } finally {
        console.log("[정리] ", await c.eval(DELAY_OFF));
    }
    c.close();
    process.exit(0);
})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
