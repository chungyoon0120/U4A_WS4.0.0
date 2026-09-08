/****************************************************************************************
 * ws20-roundtrip-memory.js — WS10↔WS20 왕복 반복 시 메모리/문서 누수 실측 (CDP)
 *
 * 목적: "왕복을 반복하면 무엇이 쌓이는가"를 추론이 아니라 실제 수치로 확인한다.
 *   · documents        = 살아 있는 문서 수 (미리보기 iframe 이 안 치워지면 증가)
 *   · jsEventListeners = 붙어 있는 이벤트 감지기 수 (F8 누적 등)
 *   · nodes            = DOM 노드 수
 *   · heapUsed         = 자바스크립트가 쓰는 메모리
 *
 * ★ 매 측정 전에 CDP 로 강제 쓰레기 치우기(collectGarbage)를 수행한다.
 *   치운 뒤에도 남으면 = 진짜 누수. 안 치우고 재면 "아직 안 치운 것"과 구분이 안 된다.
 *
 * 흐름: (--fresh) 앱 재기동 → 서버리스트 → 자동로그인 → WS10 → 편집(Change) 진입
 *       → [뒤로가기 → 재진입] × N회, 매회 측정 → 정상 로그오프
 *   ※ login-smoke.js 의 접속·로그오프 절차를 그대로 따름(락 반납 포함).
 *
 * 실행:
 *   node .works/auto-test/ws20-roundtrip-memory.js --fresh --app YLCY_TEST2143 --loops 12
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
const LOOPS = parseInt(getArg("--loops", "12"), 10);
const PORT = 9222;
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[mem]", ...a);

if (!APPID) { console.error("--app <APPID> 필요"); process.exit(1); }

async function cdpList() {
    try { const res = await fetch(`${DEBUG_HOST}/json/list`); return await res.json(); }
    catch (e) { return null; }
}

function killProjectElectron() {
    const ps = "Get-CimInstance Win32_Process | " +
        "Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -like '*U4A_WS4.0.0*' } | " +
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { }
}

async function waitForCdpDown(timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        if ((await cdpList()) === null) return true;
        await wait(500);
    }
    return false;
}

function launchApp() {
    log("앱 실행: npm start");
    const child = spawn("npm", ["start"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, WS_REMOTE_DEBUG_HOST: DEBUG_HOST },
        shell: true, detached: true, stdio: "ignore",
    });
    child.unref();
}

// ── 한 번 연결해서 계속 쓰는 CDP 세션 ────────────────────────────────────────────
function connect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pending = new Map();
        ws.on("open", () => resolve({
            send(method, params) {
                const i = ++id;
                return new Promise((res, rej) => {
                    pending.set(i, { res, rej });
                    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
                });
            },
            close() { try { ws.close(); } catch (e) { } }
        }));
        ws.on("error", reject);
        ws.on("message", (d) => {
            let j; try { j = JSON.parse(d); } catch (e) { return; }
            if (j.id && pending.has(j.id)) {
                const { res, rej } = pending.get(j.id);
                pending.delete(j.id);
                if (j.error) rej(new Error(JSON.stringify(j.error))); else res(j.result);
            }
        });
    });
}

// 1회용 eval (세션 만들기 전 단계용)
async function evalOnPage(page, expression) {
    const s = await connect(page.webSocketDebuggerUrl);
    await s.send("Runtime.enable");
    const r = await s.send("Runtime.evaluate", { expression, returnByValue: true });
    s.close();
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails));
    return r.result && r.result.value;
}

async function evalJson(sess, expr) {
    const r = await sess.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails));
    const v = r.result && r.result.value;
    return typeof v === "string" ? JSON.parse(v) : v;
}

// ── 화면 상태 ────────────────────────────────────────────────────────────────────
const STATE_EXPR =
    "JSON.stringify((function(){try{" +
    "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
    "var app={};try{app=((typeof getAppInfo==='function'?getAppInfo():null))||{};}catch(e){}" +
    "var busy='';try{busy=(typeof getBusy==='function')?getBusy():'';}catch(e){}" +
    "var prevLoaded=false;try{var f=document.getElementById('prevHTML');" +
    "prevLoaded=!!(f&&f.contentWindow&&f.contentWindow.sap&&f.contentWindow.sap.ui);}catch(e){}" +
    "var injected=false;try{injected=(typeof oAPP.fn.exceptionRespGridLayout==='function');}catch(e){}" +
    "var frames=document.querySelectorAll('iframe').length;" +
    "return{page:cur,appid:app.APPID||'',isEdit:app.IS_EDIT||'',busy:busy," +
    "prevLoaded:prevLoaded,injectedFn:injected,iframes:frames};" +
    "}catch(e){return{err:e.message};}})())";

async function measure(sess) {
    // ★ 강제로 쓰레기 치우기 → 그래도 남는 것만 진짜 누수
    for (let k = 0; k < 3; k++) {
        try { await sess.send("HeapProfiler.collectGarbage"); } catch (e) { }
        await wait(400);
    }
    const dom = await sess.send("Memory.getDOMCounters");
    const heap = await sess.send("Runtime.getHeapUsage");
    return {
        documents: dom.documents,
        nodes: dom.nodes,
        listeners: dom.jsEventListeners,
        heapMB: +(heap.usedSize / 1024 / 1024).toFixed(1),
    };
}

async function waitPage(sess, want, timeoutMs, needIdle) {
    const t0 = Date.now();
    let last = null;
    while (Date.now() - t0 < timeoutMs) {
        try { last = await evalJson(sess, STATE_EXPR); } catch (e) { last = { err: e.message }; }
        if (last.page === want && (!needIdle || last.busy !== "X")) return last;
        await wait(400);
    }
    throw new Error(`${want} 대기 실패(${timeoutMs}ms). 마지막=` + JSON.stringify(last));
}

async function gracefulLogoff() {
    const list = await cdpList();
    if (!list) return;
    try {
        const main = list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) {
            log("정상 로그오프(락 반납·세션 종료)");
            await evalOnPage(main,
                "(function(){try{" +
                "if(window.oAPP&&oAPP.common){oAPP.common.fnConfirmBox=function(t,m,cb){cb('YES');};}" +
                "if(window.oAPP&&oAPP.fn&&oAPP.fn.fnWS10WMENU30_04){oAPP.fn.fnWS10WMENU30_04();}" +
                "else if(window.oAPP&&oAPP.events&&oAPP.events.ev_Logout){oAPP.events.ev_Logout();}" +
                "}catch(e){}})()").catch(() => { });
        }
    } catch (e) { }
    const down = await waitForCdpDown(25000);
    if (!down) { log("로그오프 시간초과 → 강제 종료"); killProjectElectron(); await waitForCdpDown(8000); }
}

// ── 로그인까지 ───────────────────────────────────────────────────────────────────
async function loginFlow() {
    let started = false;
    if (FRESH) {
        log("--fresh: 기존 인스턴스 종료");
        await gracefulLogoff();
        if (!(await waitForCdpDown(3000))) throw new Error("종료 실패(CDP 살아있음)");
        launchApp(); started = true;
    }

    const t0 = Date.now();
    let sl = null;
    while (Date.now() - t0 < 90000) {
        const list = await cdpList();
        if (list) {
            sl = list.find((x) => x.type === "page" && /#ServerList/.test(x.title));
            if (sl) break;
            const m = list.find((x) => x.type === "page" && /#Main/.test(x.title));
            if (m) { log("이미 로그인됨 — 그대로 사용"); return m; }
        }
        if (!started) { launchApp(); started = true; }
        await wait(1500);
    }
    if (!sl) throw new Error("서버리스트 창을 못 찾음");
    log("서버리스트 창 확인");

    const connectExpr =
        "JSON.stringify((function(){try{" +
        "oAPP.attr._testMode=true;oAPP.attr._testId=" + JSON.stringify(STAFF) + ";" +
        "var sel=['.u4a-lnch__rname','.u4a-lnch__row'];var target=null;" +
        "for(var i=0;i<sel.length&&!target;i++){var els=[].slice.call(document.querySelectorAll(sel[i]));" +
        "target=els.filter(function(n){return (n.textContent||'').indexOf(" + JSON.stringify(SERVER) + ")!==-1;})[0];}" +
        "if(!target)return{ok:false,why:'서버 카드/행 없음'};" +
        "target.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));" +
        "return{ok:true};}catch(e){return{ok:false,why:e.message};}})())";

    let conn = null;
    const tCard = Date.now();
    while (Date.now() - tCard < 25000) {
        conn = JSON.parse(await evalOnPage(sl, connectExpr));
        if (conn.ok) break;
        await wait(1000);
    }
    if (!conn || !conn.ok) throw new Error("접속 트리거 실패: " + (conn ? conn.why : "?"));
    log("접속 트리거 → 자동로그인(" + STAFF + ")");

    const tL = Date.now();
    while (Date.now() - tL < 60000) {
        const list = await cdpList();
        const main = list && list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) {
            const u = new URL(main.url);
            if (u.searchParams.get("sessionKey") && u.searchParams.get("OBJTY") === "MAIN") {
                log("로그인 완료");
                return main;
            }
        }
        await wait(1000);
    }
    throw new Error("로그인 시간초과");
}

// ── 편집(Change) 진입 ────────────────────────────────────────────────────────────
async function enterEdit(sess) {
    // WS10 준비 대기 — 로그인 직후엔 화면이 아직 안 그려졌을 수 있어 넉넉히 기다린다.
    const readyExpr =
        "JSON.stringify((function(){" +
        "var i=document.getElementById('AppNmInput');" +
        "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
        "var fn=!!(window.oAPP&&oAPP.events&&oAPP.events.ev_AppChange);" +
        "return{ready:!!i&&fn&&cur==='WS10',hasInput:!!i,hasFn:fn,page:cur};})())";
    const t0 = Date.now();
    let rdy = null;
    while (Date.now() - t0 < 120000) {
        try { rdy = await evalJson(sess, readyExpr); } catch (e) { rdy = { err: e.message }; }
        if (rdy.ready) break;
        await wait(1000);
    }
    if (!rdy || !rdy.ready) throw new Error("WS10 준비 실패: " + JSON.stringify(rdy));
    log("WS10 준비 완료 → 편집 진입");

    await evalJson(sess,
        "JSON.stringify((function(){try{" +
        "var i=document.getElementById('AppNmInput');" +
        "if(!i)return{ok:0,why:'AppNmInput 없음'};" +
        "i.value=" + JSON.stringify(APPID) + ";" +
        "var f=i.closest&&i.closest('.u4a-field');if(f)f.setAttribute('data-filled','true');" +
        "oAPP.events.ev_AppChange();return{ok:1};" +
        "}catch(e){return{ok:0,why:e.message};}})())");
    return await waitPage(sess, "WS20", 90000, true);
}

// ── 메인 ─────────────────────────────────────────────────────────────────────────
(async () => {
    const mainPage = await loginFlow();
    const sess = await connect(mainPage.webSocketDebuggerUrl);
    await sess.send("Runtime.enable");
    await sess.send("HeapProfiler.enable");

    let st = await enterEdit(sess);
    await wait(2500);
    log("편집 진입 완료:", JSON.stringify(st));

    const rows = [];
    const base = await measure(sess);
    rows.push({ n: 0, ...base, prevLoaded: st.prevLoaded, iframes: st.iframes });
    log(`기준        문서=${base.documents} 노드=${base.nodes} 감지기=${base.listeners} 메모리=${base.heapMB}MB`);

    for (let i = 1; i <= LOOPS; i++) {
        await evalJson(sess, "JSON.stringify((function(){try{oAPP.events.ev_pageBack();return{ok:1};}catch(e){return{ok:0,why:e.message};}})())");
        await waitPage(sess, "WS10", 60000, true);

        await evalJson(sess,
            "JSON.stringify((function(){try{" +
            "var i=document.getElementById('AppNmInput');" +
            "if(!i)return{ok:0,why:'AppNmInput 없음'};" +
            "i.value=" + JSON.stringify(APPID) + ";" +
            "var f=i.closest&&i.closest('.u4a-field');if(f)f.setAttribute('data-filled','true');" +
            "oAPP.events.ev_AppChange();return{ok:1};" +
            "}catch(e){return{ok:0,why:e.message};}})())");
        st = await waitPage(sess, "WS20", 90000, true);
        await wait(2500);   // 미리보기까지 다 뜬 뒤 재기

        const m = await measure(sess);
        rows.push({ n: i, ...m, prevLoaded: st.prevLoaded, iframes: st.iframes });
        log(`왕복 ${String(i).padStart(2)}회   문서=${String(m.documents).padStart(3)} 노드=${String(m.nodes).padStart(6)} 감지기=${String(m.listeners).padStart(5)} 메모리=${String(m.heapMB).padStart(7)}MB  (미리보기=${st.prevLoaded} iframe=${st.iframes})`);
    }

    const a = rows[0], z = rows[rows.length - 1];
    const n = z.n - a.n || 1;
    console.log("\n===== 결과 (강제로 쓰레기 치운 뒤 측정) =====");
    console.log(`왕복 0회 → ${z.n}회`);
    console.log(`  살아있는 문서 수 : ${a.documents} → ${z.documents}   (1회당 ${((z.documents - a.documents) / n).toFixed(2)})`);
    console.log(`  이벤트 감지기 수 : ${a.listeners} → ${z.listeners}   (1회당 ${((z.listeners - a.listeners) / n).toFixed(2)})`);
    console.log(`  DOM 노드 수      : ${a.nodes} → ${z.nodes}   (1회당 ${((z.nodes - a.nodes) / n).toFixed(2)})`);
    console.log(`  JS 메모리(MB)    : ${a.heapMB} → ${z.heapMB}   (1회당 ${((z.heapMB - a.heapMB) / n).toFixed(2)}MB)`);
    console.log("");
    console.table(rows);

    sess.close();
    await gracefulLogoff();
    process.exit(0);
})().catch(async (e) => {
    console.error("[mem] 실패:", e.message);
    await gracefulLogoff().catch(() => { });
    process.exit(1);
});
