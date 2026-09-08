"use strict";
const WebSocket=require("ws");const HOST="http://127.0.0.1:9222";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const list=async()=>await(await fetch(HOST+"/json/list")).json();
async function conn(p){const ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise(r=>ws.on("open",r));
let id=0;const send=m=>new Promise(r=>{const i=++id;const h=d=>{const j=JSON.parse(d);if(j.id===i){ws.off("message",h);r(j);}};ws.on("message",h);ws.send(JSON.stringify(Object.assign({id:i},m)));});
await send({method:"Runtime.enable"});
return{close:()=>ws.close(),eval:async e=>{const r=await send({method:"Runtime.evaluate",params:{expression:e,returnByValue:true,awaitPromise:true}});return r.result.exceptionDetails?("EXC:"+((r.result.exceptionDetails.exception||{}).description||"").slice(0,300)):r.result.result.value;}};}
const HEADS=`(function(){
  function h(sel){var a=[].slice.call(document.querySelectorAll(sel+' thead th'));return a.map(function(x){return (x.innerText||'').trim().replace(/\s+/g,' ');});}
  return JSON.stringify({고정칸:h('.u4aAppF4Tbl--frozen'),움직이는칸:h('.u4aAppF4Tbl--scroll'),
    고정칸폭:(document.querySelector('.u4aAppF4Pane--frozen')||{}).clientWidth,
    움직이는칸폭:(document.querySelector('.u4aAppF4Pane--scroll')||{}).clientWidth,
    ro:window.__ro});
})()`;
(async()=>{
 let L=await list();
 const m=L.find(x=>/#Main/.test(x.title)); if(!m){console.log("본창 없음");process.exit(1);}
 const cm=await conn(m);
 await cm.eval("oAPP.fn.fnWS10WMENU10_04_01()");
 let sc=null; for(let i=0;i<80;i++){await sleep(150);L=await list();sc=L.find(x=>/ShortCutCreator\/index\.html/.test(decodeURIComponent(x.url||"")));if(sc)break;}
 if(!sc){console.log("쇼컷링크 생성 창 안열림");process.exit(1);}
 const c=await conn(sc); await sleep(2500);
 await c.eval("(function(){window.__ro=0;window.addEventListener('error',function(e){if(String(e.message||'').indexOf('ResizeObserver loop')>=0){window.__ro++;e.stopImmediatePropagation();e.preventDefault();return false;}},true);return 1;})()");
 await c.eval("(function(){var u=getUserInfo();oAPP.fn.fnAppF4PopupOpen({autoSearch:true,pickOnly:true,initCond:{PACKG:'',APPNM:'',APPTY:'M',ERUSR:u.ID,HITS:500}},function(){});return 1;})()");
 await sleep(6000);
 console.log("탭1(모든 앱):", await c.eval(HEADS));
 await c.eval("(function(){var t=[].slice.call(document.querySelectorAll('.u4aAppF4Tab'));var b=t[1];if(b){b.click();}return b?'탭2 누름':'탭 없음';})()");
 await sleep(5000);
 console.log("탭2(계층 구조):", await c.eval(HEADS));
 console.log("ResizeObserver 경고:", await c.eval("String(window.__ro)"));
 await c.eval("(function(){var d=document.querySelector('dialog[class*=AppF4]');if(d&&d.open){d.close();}return 1;})()");
 c.close(); cm.close(); process.exit(0);
})().catch(e=>{console.log("오류:",e.message);process.exit(1);});
