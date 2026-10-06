/****************************************************************************************
 * ws20-listener-source.js — 왕복 때 "쌓이는 감지기"가 어느 파일 몇 번째 줄에서 붙는지 특정
 *
 * ws20-roundtrip-memory.js 실측 결과: 왕복 1회당 이벤트 감지기가 약 206개씩 영구히 쌓임.
 * 이 스크립트는 그 206개가 **어디서 붙은 것인지**를 소스 위치(파일:줄)까지 뽑아낸다.
 *
 * 방법: CDP DOMBebugger.getEventListeners 로 document/window 에 붙은 감지기 목록을
 *       왕복 전/후로 각각 받아, 소스 위치별 개수를 비교한다.
 *
 * 실행:
 *   node .works/auto-test/ws20-listener-source.js --fresh --app YLCY_TEST2143 --loops 3
 ****************************************************************************************/
"use strict";

const WebSocket = require("ws");
const { spawn, execSync } = require("child_process");
const path = require("path");

const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };
const FRESH = ARGV.includes("--fresh");
const APPID = getArg("--app", null);
const SERVER = getArg("--server", "UHA");
const STAFF = getArg("--staff", "soccerhs");
const LOOPS = parseInt(getArg("--loops", "3"), 10);
const PORT = 9222;
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[lsn]", ...a);
if (!APPID) { console.error("--app <APPID> 필요"); process.exit(1); }

async function cdpList() {
    try { const res = await fetch(`${DEBUG_HOST}/json/list`); return await res.json(); }
    catch (e) { return null; }
}
function killProjectElectron() {
    const ps = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -like '*U4A_WS4.0.0*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { }
}
async function waitForCdpDown(ms) { const t = Date.now(); while (Date.now() - t < ms) { if ((await cdpList()) === null) return true; await wait(500); } return false; }
function launchApp() {
    log("앱 실행: npm start");
    const c = spawn("npm", ["start"], { cwd: PROJECT_ROOT, env: { ...process.env, WS_REMOTE_DEBUG_HOST: DEBUG_HOST }, shell: true, detached: true, stdio: "ignore" });
    c.unref();
}

// scriptId → URL 매핑까지 수집하는 CDP 세션
function connect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pending = new Map();
        const scripts = new Map();   // scriptId → url
        ws.on("open", () => resolve({
            scripts,
            send(method, params) {
                const i = ++id;
                return new Promise((res, rej) => { pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
            },
            close() { try { ws.close(); } catch (e) { } }
        }));
        ws.on("error", reject);
        ws.on("message", (d) => {
            let j; try { j = JSON.parse(d); } catch (e) { return; }
            if (j.method === "Debugger.scriptParsed" && j.params) scripts.set(j.params.scriptId, j.params.url || "(inline)");
            if (j.id && pending.has(j.id)) {
                const { res, rej } = pending.get(j.id);
                pending.delete(j.id);
                if (j.error) rej(new Error(JSON.stringify(j.error))); else res(j.result);
            }
        });
    });
}
async function evalOnPage(page, expression) {
    const s = await connect(page.webSocketDebuggerUrl);
    await s.send("Runtime.enable");
    const r = await s.send("Runtime.evaluate", { expression, returnByValue: true });
    s.close();
    return r.result && r.result.value;
}
async function evalJson(sess, expr) {
    const r = await sess.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails));
    const v = r.result && r.result.value;
    return typeof v === "string" ? JSON.parse(v) : v;
}

const STATE_EXPR =
    "JSON.stringify((function(){try{" +
    "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
    "var busy='';try{busy=(typeof getBusy==='function')?getBusy():'';}catch(e){}" +
    "return{page:cur,busy:busy};}catch(e){return{err:e.message};}})())";

async function waitPage(sess, want, ms) {
    const t = Date.now(); let last = null;
    while (Date.now() - t < ms) {
        try { last = await evalJson(sess, STATE_EXPR); } catch (e) { last = { err: e.message }; }
        if (last.page === want && last.busy !== "X") return last;
        await wait(400);
    }
    throw new Error(want + " 대기 실패: " + JSON.stringify(last));
}

// ── 감지기 목록 수집 (document / window / body) ──────────────────────────────────
async function collectListeners(sess) {
    const out = [];
    for (const target of ["document", "window", "document.body"]) {
        let objectId;
        try {
            const r = await sess.send("Runtime.evaluate", { expression: target, returnByValue: false });
            objectId = r.result && r.result.objectId;
        } catch (e) { continue; }
        if (!objectId) continue;
        let res;
        try { res = await sess.send("DOMDebugger.getEventListeners", { objectId, depth: 0 }); }
        catch (e) { continue; }
        for (const l of (res.listeners || [])) {
            const url = sess.scripts.get(l.scriptId) || ("script#" + l.scriptId);
            out.push({
                target,
                type: l.type,
                where: url.replace(/^.*[\\/]www[\\/]/, "www/") + ":" + (l.lineNumber + 1),
            });
        }
        try { await sess.send("Runtime.releaseObject", { objectId }); } catch (e) { }
    }
    return out;
}
function tally(list) {
    const m = new Map();
    for (const l of list) {
        const k = `${l.target} [${l.type}]  ${l.where}`;
        m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
}

async function gracefulLogoff() {
    const list = await cdpList(); if (!list) return;
    try {
        const main = list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) {
            log("정상 로그오프(락 반납·세션 종료)");
            await evalOnPage(main, "(function(){try{if(window.oAPP&&oAPP.common){oAPP.common.fnConfirmBox=function(t,m,cb){cb('YES');};}if(window.oAPP&&oAPP.fn&&oAPP.fn.fnWS10WMENU30_04){oAPP.fn.fnWS10WMENU30_04();}else if(window.oAPP&&oAPP.events&&oAPP.events.ev_Logout){oAPP.events.ev_Logout();}}catch(e){}})()").catch(() => { });
        }
    } catch (e) { }
    if (!(await waitForCdpDown(25000))) { killProjectElectron(); await waitForCdpDown(8000); }
}

async function loginFlow() {
    let started = false;
    if (FRESH) {
        log("--fresh: 기존 인스턴스 종료");
        await gracefulLogoff();
        if (!(await waitForCdpDown(3000))) throw new Error("종료 실패");
        launchApp(); started = true;
    }
    const t0 = Date.now(); let sl = null;
    while (Date.now() - t0 < 90000) {
        const list = await cdpList();
        if (list) {
            sl = list.find((x) => x.type === "page" && /#ServerList/.test(x.title));
            if (sl) break;
            const m = list.find((x) => x.type === "page" && /#Main/.test(x.title));
            if (m) { log("이미 로그인됨"); return m; }
        }
        if (!started) { launchApp(); started = true; }
        await wait(1500);
    }
    if (!sl) throw new Error("서버리스트 창 없음");
    log("서버리스트 창 확인");
    const connectExpr =
        "JSON.stringify((function(){try{oAPP.attr._testMode=true;oAPP.attr._testId=" + JSON.stringify(STAFF) + ";" +
        "var sel=['.u4a-lnch__rname','.u4a-lnch__row'];var target=null;" +
        "for(var i=0;i<sel.length&&!target;i++){var els=[].slice.call(document.querySelectorAll(sel[i]));" +
        "target=els.filter(function(n){return (n.textContent||'').indexOf(" + JSON.stringify(SERVER) + ")!==-1;})[0];}" +
        "if(!target)return{ok:false};target.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return{ok:true};}catch(e){return{ok:false};}})())";
    let conn = null; const tc = Date.now();
    while (Date.now() - tc < 25000) { conn = JSON.parse(await evalOnPage(sl, connectExpr)); if (conn.ok) break; await wait(1000); }
    if (!conn || !conn.ok) throw new Error("접속 트리거 실패");
    log("접속 트리거 → 자동로그인");
    const tl = Date.now();
    while (Date.now() - tl < 60000) {
        const list = await cdpList();
        const main = list && list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) { const u = new URL(main.url); if (u.searchParams.get("sessionKey")) { log("로그인 완료"); return main; } }
        await wait(1000);
    }
    throw new Error("로그인 시간초과");
}

const ENTER_EXPR =
    "JSON.stringify((function(){try{var i=document.getElementById('AppNmInput');" +
    "if(!i)return{ok:0};i.value=" + JSON.stringify(APPID) + ";" +
    "var f=i.closest&&i.closest('.u4a-field');if(f)f.setAttribute('data-filled','true');" +
    "oAPP.events.ev_AppChange();return{ok:1};}catch(e){return{ok:0,why:e.message};}})())";

(async () => {
    const mainPage = await loginFlow();
    const sess = await connect(mainPage.webSocketDebuggerUrl);
    await sess.send("Runtime.enable");
    await sess.send("Debugger.enable");   // scriptId → 파일 경로 매핑용
    await sess.send("DOM.enable");
    await wait(1500);

    // WS10 준비 대기 → 첫 진입
    const readyExpr =
        "JSON.stringify((function(){" +
        "var i=document.getElementById('AppNmInput');" +
        "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
        "var fn=!!(window.oAPP&&oAPP.events&&oAPP.events.ev_AppChange);" +
        "return{ready:!!i&&fn&&cur==='WS10',hasInput:!!i,hasFn:fn,page:cur};})())";
    const t0 = Date.now(); let rdy = null;
    while (Date.now() - t0 < 120000) { try { rdy = await evalJson(sess, readyExpr); } catch (e) { } if (rdy && rdy.ready) break; await wait(1000); }
    if (!rdy || !rdy.ready) throw new Error("WS10 준비 실패");
    await evalJson(sess, ENTER_EXPR);
    await waitPage(sess, "WS20", 90000);
    await wait(2500);

    const before = tally(await collectListeners(sess));
    log(`왕복 전 감지기 총 ${[...before.values()].reduce((a, b) => a + b, 0)}개`);

    for (let i = 1; i <= LOOPS; i++) {
        await evalJson(sess, "JSON.stringify((function(){try{oAPP.events.ev_pageBack();return{ok:1};}catch(e){return{ok:0};}})())");
        await waitPage(sess, "WS10", 60000);
        await evalJson(sess, ENTER_EXPR);
        await waitPage(sess, "WS20", 90000);
        await wait(2500);
        log(`왕복 ${i}회 완료`);
    }

    const after = tally(await collectListeners(sess));
    log(`왕복 후 감지기 총 ${[...after.values()].reduce((a, b) => a + b, 0)}개`);

    // ── 증가한 것만 뽑아 정렬 ────────────────────────────────────────────────
    const rows = [];
    for (const [k, v] of after) {
        const b = before.get(k) || 0;
        if (v > b) rows.push({ 증가: v - b, "왕복전": b, "왕복후": v, 위치: k });
    }
    rows.sort((a, b) => b.증가 - a.증가);

    console.log(`\n===== 왕복 ${LOOPS}회로 늘어난 감지기 (많은 순) =====`);
    if (!rows.length) console.log("증가한 항목 없음 (document/window/body 기준)");
    else console.table(rows.slice(0, 40));
    console.log(`\n합계 증가: ${[...after.values()].reduce((a, b) => a + b, 0) - [...before.values()].reduce((a, b) => a + b, 0)}개  (왕복 1회당 약 ${(([...after.values()].reduce((a, b) => a + b, 0) - [...before.values()].reduce((a, b) => a + b, 0)) / LOOPS).toFixed(1)}개)`);

    sess.close();
    await gracefulLogoff();
    process.exit(0);
})().catch(async (e) => { console.error("[lsn] 실패:", e.message); await gracefulLogoff().catch(() => { }); process.exit(1); });
