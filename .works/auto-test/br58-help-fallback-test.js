/* ********************************************************************
 * [BR58] 도움말(Tooltips) 폴백 자동 확인 — 구버전 서버가 없어도 검증.
 *
 * 하는 일:
 *   ① 실행중인 앱(디버그 포트 9222)의 WS20 편집화면에 붙는다.
 *   ② "통합 도움말 등록 여부" 판정을 잠깐 '없음'으로 바꿔 구버전 서버인 척 만든다.
 *   ③ UI트리 / 속성 / 미리보기 도움말 버튼을 차례로 눌러 창이 뜨는지 본다.
 *   ④ 뜬 창의 제목과 대기표시 잔류 여부를 확인하고 창을 닫는다.
 *   ⑤ 판정을 원래대로 되돌린다.
 *
 * 실행: node .works/auto-test/br58-help-fallback-test.js
 * 전제: 코드 반영을 위해 앱을 껐다 켠 뒤, WS20 편집화면(앱 하나 열기)까지 진입한 상태.
 * ******************************************************************** */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function list() { return await (await fetch(`${HOST}/json/list`)).json(); }

async function conn(page) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => {
        const i = ++id;
        const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } };
        ws.on("message", h); ws.send(JSON.stringify({ id: i, ...m }));
    });
    await send({ method: "Runtime.enable" });
    return {
        close: () => ws.close(),
        eval: async (expression) => {
            const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } });
            if (r.result && r.result.exceptionDetails) {
                const ex = r.result.exceptionDetails;
                throw new Error("eval 예외: " + ((ex.exception && ex.exception.description) || JSON.stringify(ex)));
            }
            return r.result && r.result.result ? r.result.result.value : undefined;
        }
    };
}

// 도움말 창 목록 — 여는 문서 경로로 판별.
//   ★ 창 제목으로 찾으면 안 된다: 도움말 HTML 문서가 자기 제목을 갖고 있어
//     창을 만들 때 준 제목("Tooltips - ...")을 덮어쓴다(원본도 동일).
async function tooltipWindows() {
    return (await list()).filter((x) => x.type === "page" && decodeURIComponent(x.url || "").indexOf("design/html/helper/") >= 0);
}

const CASES = [
    { key: "UI트리",   sel: "designTooltip" },
    { key: "속성",     sel: "attrTooltip" },
    { key: "미리보기", sel: "prevTooltip" }
];

(async () => {

    const L = await list();
    const main = L.find((x) => x.type === "page" && /ws10_20\/index\.html/.test(x.url));
    if (!main) { console.log("실패: WS20 화면(앱 본창)을 못 찾음. 앱이 켜져 있는지 확인."); process.exit(1); }

    const c = await conn(main);

    // 0) 사전 점검 — 이식본 로드 여부.
    const pre = JSON.parse(await c.eval(`JSON.stringify({
        fn: typeof oAPP.fn.callTooltipsPopup,
        wlo: (function(){ try { return oAPP.common.checkWLOList("C","UHAK901369"); } catch(e){ return "err"; } })(),
        btnPrev: !!document.getElementById("ws20PrevHelpBtn"),
        btnAttr: !!document.getElementById("ws20AttrHelpBtn"),
        btnTree: !!(function(){
            var bar = document.querySelector(".u4aWs20TreeTb, #ws20DesignTree");
            var all = Array.prototype.slice.call(document.querySelectorAll("button.u4a-btn-icon"));
            return all.filter(function(b){ return /fa-circle-question/.test(b.innerHTML); })[0];
        })()
    })`));
    console.log("[사전점검]", JSON.stringify(pre));

    if (pre.fn !== "function") {
        console.log("실패: 도움말 팝업 이식본이 안 실려 있음 → 앱을 껐다 켜야 반영됩니다.");
        c.close(); process.exit(1);
    }
    if (!pre.btnPrev || !pre.btnAttr) {
        console.log("실패: 도움말 버튼이 화면에 없음 → WS20 편집화면(앱 하나 열기)까지 들어간 뒤 다시 실행.");
        c.close(); process.exit(1);
    }

    // 1) 구버전 서버인 척 — 통합 도움말 '미등록' 으로 잠시 바꾼다.
    await c.eval(`(function(){
        if (!window.__BR58_BAK) { window.__BR58_BAK = oAPP.common.checkWLOList; }
        oAPP.common.checkWLOList = function(REGTYP, CHGOBJ){
            if (REGTYP === "C" && CHGOBJ === "UHAK901369") { return false; }
            return window.__BR58_BAK.apply(oAPP.common, arguments);
        };
        return true;
    })()`);
    console.log("[준비] 통합 도움말 = '미등록' 으로 임시 전환");

    const before = (await tooltipWindows()).map((w) => w.id);
    const result = [];

    for (const cs of CASES) {
        // 버튼 클릭 — 영역별로 버튼을 찾아 누른다.
        const clicked = await c.eval(`(function(){
            var b = null;
            if ("${cs.sel}" === "prevTooltip") { b = document.getElementById("ws20PrevHelpBtn"); }
            else if ("${cs.sel}" === "attrTooltip") { b = document.getElementById("ws20AttrHelpBtn"); }
            else {
                var all = Array.prototype.slice.call(document.querySelectorAll("button.u4a-btn-icon"));
                b = all.filter(function(x){ return /fa-circle-question/.test(x.innerHTML); })[0] || null;
            }
            if (!b) { return "버튼없음"; }
            b.click();
            return "클릭";
        })()`);

        await sleep(2500);

        const now = await tooltipWindows();
        const fresh = now.filter((w) => before.indexOf(w.id) === -1 && !result.some((r) => r.id === w.id));

        const busy = await c.eval(`(function(){
            var el = document.querySelector(".u4a-busy");
            if (!el) { return "없음"; }
            var st = window.getComputedStyle(el);
            return (st.display === "none" || st.visibility === "hidden" || el.hasAttribute("hidden")) ? "해제됨" : "★남아있음";
        })()`);

        const w = fresh[fresh.length - 1];
        result.push({
            영역: cs.key,
            클릭: clicked,
            창뜸: !!w,
            문서: w ? (decodeURIComponent(w.url).split("/helper/")[1] || w.url) : "-",
            문서맞음: w ? (decodeURIComponent(w.url).indexOf("/" + cs.sel + "/") >= 0) : false,
            대기표시: busy,
            id: w ? w.id : null
        });
        console.log("[" + cs.key + "]", JSON.stringify(result[result.length - 1]));
    }

    // 2) 판정 원복.
    await c.eval(`(function(){
        if (window.__BR58_BAK) { oAPP.common.checkWLOList = window.__BR58_BAK; delete window.__BR58_BAK; }
        return true;
    })()`);
    console.log("[정리] 통합 도움말 판정 원래대로 되돌림");

    // 3) 열린 도움말 창 닫기.
    for (const r of result) {
        if (!r.id) { continue; }
        try { await fetch(`${HOST}/json/close/${r.id}`); } catch (e) { }
    }
    console.log("[정리] 열었던 도움말 창 닫음");

    console.log("\n===== 결과 =====");
    let ok = true;
    for (const r of result) {
        const pass = r.창뜸 && r.문서맞음 && r.대기표시 !== "★남아있음";
        if (!pass) { ok = false; }
        console.log((pass ? "OK  " : "FAIL") + "  " + r.영역 + "  문서=" + r.문서 + "  대기표시=" + r.대기표시);
    }
    console.log(ok ? "\n전체 통과" : "\n실패 있음");

    c.close();
    process.exit(ok ? 0 : 1);
})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
