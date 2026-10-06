"use strict";
const WebSocket=require("ws");const HOST="http://127.0.0.1:9222";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const list=async()=>await(await fetch(HOST+"/json/list")).json();
async function conn(p){const ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise(r=>ws.on("open",r));
let id=0;const send=m=>new Promise(r=>{const i=++id;const h=d=>{const j=JSON.parse(d);if(j.id===i){ws.off("message",h);r(j);}};ws.on("message",h);ws.send(JSON.stringify(Object.assign({id:i},m)));});
await send({method:"Runtime.enable"});
return{close:()=>ws.close(),eval:async e=>{const r=await send({method:"Runtime.evaluate",params:{expression:e,returnByValue:true,awaitPromise:true}});return r.result.exceptionDetails?("EXC:"+((r.result.exceptionDetails.exception||{}).description||"").slice(0,300)):r.result.result.value;}};}
(async()=>{
 let L=await list();
 const m=L.find(x=>/#Main/.test(x.title)); const cm=await conn(m);
 await cm.eval("oAPP.fn.fnWS10WMENU10_04_01()");
 let sc=null; for(let i=0;i<80;i++){await sleep(150);L=await list();sc=L.find(x=>/ShortCutCreator\/index\.html/.test(decodeURIComponent(x.url||"")));if(sc)break;}
 if(!sc){console.log("창 안열림");process.exit(1);}
 const c=await conn(sc); await sleep(2500);
 await c.eval("(function(){window.__ro=0;window.addEventListener('error',function(e){if(String(e.message||'').indexOf('ResizeObserver loop')>=0){window.__ro++;e.stopImmediatePropagation();e.preventDefault();return false;}},true);return 1;})()");
 await c.eval("(function(){var u=getUserInfo();oAPP.fn.fnAppF4PopupOpen({autoSearch:true,pickOnly:true,initCond:{PACKG:'',APPNM:'',APPTY:'M',ERUSR:u.ID,HITS:500}},function(){});return 1;})()");
 await sleep(6000);
 console.log("가로바 상태:", await c.eval("(function(){var sp=document.querySelector('.u4aAppF4HSbSpacer');var hsb=document.querySelector('.u4aAppF4HSb');var t=document.querySelector('.u4aAppF4Tbl--scroll');var p=document.querySelector('.u4aAppF4Pane--scroll');return JSON.stringify({스페이서폭:sp?sp.style.width:'없음',표실제폭:t?t.scrollWidth:-1,바보이는폭:hsb?hsb.clientWidth:-1,바스크롤폭:hsb?hsb.scrollWidth:-1,가로스크롤가능:hsb?(hsb.scrollWidth>hsb.clientWidth):false,페인폭:p?p.clientWidth:-1});})()"));
 // 가로 드래그 동기 확인
 console.log("가로 이동 동기:", await c.eval("(function(){var hsb=document.querySelector('.u4aAppF4HSb');var p=document.querySelector('.u4aAppF4Pane--scroll');if(!hsb||!p)return '없음';hsb.scrollLeft=80;return new Promise(function(r){setTimeout(function(){r(JSON.stringify({바:hsb.scrollLeft,표페인:p.scrollLeft}));},400);});})()"));
 console.log("ResizeObserver 경고:", await c.eval("String(window.__ro)"));
 await c.eval("(function(){var d=document.querySelector('dialog[class*=AppF4]');if(d&&d.open){d.close();}return 1;})()");
 await sleep(300); await c.eval("window.close()");
 c.close(); cm.close(); process.exit(0);
})().catch(e=>{console.log("오류:",e.message);process.exit(1);});
