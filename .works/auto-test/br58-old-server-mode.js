/* ********************************************************************
 * [BR58] "구버전 서버인 척" 켜기/끄기 — 사람이 직접 눈으로 확인할 때 쓴다.
 *
 * 무엇을 하나:
 *   도움말 물음표 버튼을 **누르는 그 순간에만** "통합 도움말이 등록 안 된 서버"로
 *   판정되게 만든다. 버튼 처리가 끝나면 곧바로 원래대로 돌아가므로,
 *   같은 판정을 쓰는 다른 기능(속성값 예외처리 등)에는 영향이 없다.
 *   서버는 전혀 건드리지 않는다 — 화면 쪽 판정만 잠깐 바꾼다.
 *
 * 쓰는 법:
 *   node .works/auto-test/br58-old-server-mode.js on     ← 켜기
 *   node .works/auto-test/br58-old-server-mode.js off    ← 끄기
 *   node .works/auto-test/br58-old-server-mode.js        ← 지금 상태 보기
 *
 * 전제: 앱이 켜져 있고 WS20 편집화면(앱 하나 열기)까지 들어간 상태.
 * 참고: 앱을 껐다 켜면 자동으로 꺼진 상태가 된다(화면에만 걸어둔 임시 상태).
 * ******************************************************************** */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";

async function list() { return await (await fetch(`${HOST}/json/list`)).json(); }
async function conn(p) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => { const i = ++id; const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, ...m })); });
    await send({ method: "Runtime.enable" });
    return {
        close: () => ws.close(),
        eval: async (expression) => {
            const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } });
            if (r.result && r.result.exceptionDetails) { throw new Error(((r.result.exceptionDetails.exception || {}).description || "").slice(0, 300)); }
            return r.result && r.result.result ? r.result.result.value : undefined;
        }
    };
}

// 도움말 버튼인지 판별 — 세 영역 모두 물음표 아이콘.
const IS_HELP_BTN = `function(b){
    if (!b) { return false; }
    if (b.id === "ws20PrevHelpBtn" || b.id === "ws20AttrHelpBtn") { return true; }
    return /fa-circle-question/.test(b.innerHTML || "");
}`;

const ON = `(function(){
    if (window.__BR58_OLD) { return "이미 켜져 있음"; }
    var isHelp = ${IS_HELP_BTN};
    var fnWatch = function(e){
        var b = e.target && e.target.closest ? e.target.closest("button") : null;
        if (!isHelp(b)) { return; }
        var bak = oAPP.common.checkWLOList;
        oAPP.common.checkWLOList = function(REGTYP, CHGOBJ){
            if (REGTYP === "C" && CHGOBJ === "UHAK901369") { return false; }
            return bak.apply(oAPP.common, arguments);
        };
        //버튼 처리(같은 순간에 동기 실행)가 끝나면 곧바로 원래대로.
        setTimeout(function(){ oAPP.common.checkWLOList = bak; }, 0);
    };
    document.addEventListener("click", fnWatch, true);   //버튼 자신보다 먼저 실행
    window.__BR58_OLD = fnWatch;
    return "켬";
})()`;

const OFF = `(function(){
    if (!window.__BR58_OLD) { return "이미 꺼져 있음"; }
    document.removeEventListener("click", window.__BR58_OLD, true);
    delete window.__BR58_OLD;
    return "끔";
})()`;

const STATE = `(function(){
    return JSON.stringify({
        구버전인척: !!window.__BR58_OLD,
        지금판정: (function(){ try { return oAPP.common.checkWLOList("C","UHAK901369"); } catch(e){ return "확인불가"; } })(),
        도움말팝업실림: typeof oAPP.fn.callTooltipsPopup === "function"
    });
})()`;

(async () => {
    const arg = (process.argv[2] || "").toLowerCase();
    const L = await list();
    const main = L.find((x) => x.type === "page" && /ws10_20\/index\.html/.test(x.url));
    if (!main) { console.log("실패: 앱 본창을 못 찾음. 앱이 켜져 있는지 확인."); process.exit(1); }
    const c = await conn(main);

    if (arg === "on") { console.log("[구버전 서버인 척]", await c.eval(ON)); }
    else if (arg === "off") { console.log("[구버전 서버인 척]", await c.eval(OFF)); }

    const st = JSON.parse(await c.eval(STATE));
    console.log("[현재 상태] 구버전인척=" + (st.구버전인척 ? "켜짐" : "꺼짐")
        + " · 평소판정(통합도움말 등록됨)=" + st.지금판정
        + " · 도움말팝업 실림=" + (st.도움말팝업실림 ? "예" : "아니오(앱 재시작 필요)"));

    if (arg === "on") {
        console.log("\n이제 화면에서 물음표 버튼(도움말)을 누르면 앱 안에 들어 있는 도움말 창이 뜹니다.");
        console.log("확인 끝나면 반드시 꺼주십시오:  node .works/auto-test/br58-old-server-mode.js off");
    }
    c.close();
})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
