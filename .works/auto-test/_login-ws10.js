"use strict";
const WebSocket=require("ws");const HOST="http://127.0.0.1:9222";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function conn(p){const ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise(r=>ws.on("open",r));
let id=0;const send=m=>new Promise(r=>{const i=++id;const h=d=>{const j=JSON.parse(d);if(j.id===i){ws.off("message",h);r(j);}};ws.on("message",h);ws.send(JSON.stringify(Object.assign({id:i},m)));});
await send({method:"Runtime.enable"});
return{close:()=>ws.close(),eval:async e=>{const r=await send({method:"Runtime.evaluate",params:{expression:e,returnByValue:true,awaitPromise:true}});return r.result.exceptionDetails?("EXC:"+((r.result.exceptionDetails.exception||{}).description||"").slice(0,300)):r.result.result.value;}};}
(async()=>{
 const L=await(await fetch(HOST+"/json/list")).json();
 const m=L.find(x=>/#Main/.test(x.title));
 if(!m){console.log("본창 없음");process.exit(1);}
 const c=await conn(m);
 console.log("현재 WS10 함수 수:", await c.eval("String(Object.keys((window.oAPP||{}).fn||{}).length)"));
 const r=await c.eval("(function(){var f=document.querySelector('iframe');var w=f&&f.contentWindow;if(!w||!w.oAPP||!w.oAPP.fn||typeof w.oAPP.fn.fnStaffLogin!=='function'){return 'staffLogin 없음';}w.oAPP.fn.fnStaffLogin('soccerhs');return '로그인 시도';})()");
 console.log("로그인:", r);
 for(let i=0;i<60;i++){
   await sleep(1000);
   const n=await c.eval("String(Object.keys((window.oAPP||{}).fn||{}).length)");
   const has=await c.eval("String(typeof ((window.oAPP||{}).fn||{}).fnWS10WMENU10_04_01)");
   if(has==="function"){console.log("WS10 준비 완료 (함수 "+n+"개) — "+(i+1)+"초");c.close();process.exit(0);}
 }
 console.log("시간초과: WS10 미준비");c.close();process.exit(1);
})().catch(e=>{console.log("오류:",e.message);process.exit(1);});
