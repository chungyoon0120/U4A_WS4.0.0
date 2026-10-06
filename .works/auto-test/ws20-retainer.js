/****************************************************************************************
 * ws20-retainer.js — 왕복 후 "치워지지 않은 화면 조각"을 누가 붙잡고 있는지 찾는다
 *
 * 앞선 실측(ws20-roundtrip-memory.js):
 *   왕복 1회당 DOM 노드 +666, 이벤트 감지기 +206, 메모리 +5.6MB 가
 *   **강제로 쓰레기를 치운 뒤에도** 남는다.
 * 앞선 실측(ws20-listener-source.js):
 *   document/window/body 에 직접 붙는 것은 왕복 1회당 1개(단축키)뿐.
 *   → 나머지는 "버려진 DOM 노드에 붙은 감지기".
 *
 * 이 스크립트는 힙 스냅샷을 직접 떠서
 *   ① 버려졌는데 안 치워진(detached) 노드가 몇 개인지
 *   ② 그것들을 **무엇이 붙잡고 있는지**(붙잡는 쪽의 이름/변수명)
 * 를 뽑는다.
 *
 * 실행:
 *   node .works/auto-test/ws20-retainer.js --fresh --app YLCY_TEST2143 --loops 4
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
const LOOPS = parseInt(getArg("--loops", "4"), 10);
const PORT = 9222;
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[ret]", ...a);
if (!APPID) { console.error("--app <APPID> 필요"); process.exit(1); }

async function cdpList() { try { const r = await fetch(`${DEBUG_HOST}/json/list`); return await r.json(); } catch (e) { return null; } }
function killProjectElectron() {
    const ps = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -like '*U4A_WS4.0.0*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) { }
}
async function waitForCdpDown(ms) { const t = Date.now(); while (Date.now() - t < ms) { if ((await cdpList()) === null) return true; await wait(500); } return false; }
function launchApp() { log("앱 실행: npm start"); const c = spawn("npm", ["start"], { cwd: PROJECT_ROOT, env: { ...process.env, WS_REMOTE_DEBUG_HOST: DEBUG_HOST }, shell: true, detached: true, stdio: "ignore" }); c.unref(); }

function connect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 0;
        const pending = new Map();
        const chunks = [];
        ws.on("open", () => resolve({
            chunks,
            send(method, params) { const i = ++id; return new Promise((res, rej) => { pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }); },
            close() { try { ws.close(); } catch (e) { } }
        }));
        ws.on("error", reject);
        ws.on("message", (d) => {
            let j; try { j = JSON.parse(d); } catch (e) { return; }
            if (j.method === "HeapProfiler.addHeapSnapshotChunk") { chunks.push(j.params.chunk); return; }
            if (j.id && pending.has(j.id)) { const { res, rej } = pending.get(j.id); pending.delete(j.id); if (j.error) rej(new Error(JSON.stringify(j.error))); else res(j.result); }
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
const STATE_EXPR = "JSON.stringify((function(){try{var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}var busy='';try{busy=(typeof getBusy==='function')?getBusy():'';}catch(e){}return{page:cur,busy:busy};}catch(e){return{err:e.message};}})())";
async function waitPage(sess, want, ms) {
    const t = Date.now(); let last = null;
    while (Date.now() - t < ms) { try { last = await evalJson(sess, STATE_EXPR); } catch (e) { last = { err: e.message }; } if (last.page === want && last.busy !== "X") return last; await wait(400); }
    throw new Error(want + " 대기 실패: " + JSON.stringify(last));
}
async function gracefulLogoff() {
    const list = await cdpList(); if (!list) return;
    try {
        const main = list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) { log("정상 로그오프(락 반납·세션 종료)"); await evalOnPage(main, "(function(){try{if(window.oAPP&&oAPP.common){oAPP.common.fnConfirmBox=function(t,m,cb){cb('YES');};}if(window.oAPP&&oAPP.fn&&oAPP.fn.fnWS10WMENU30_04){oAPP.fn.fnWS10WMENU30_04();}else if(window.oAPP&&oAPP.events&&oAPP.events.ev_Logout){oAPP.events.ev_Logout();}}catch(e){}})()").catch(() => { }); }
    } catch (e) { }
    if (!(await waitForCdpDown(25000))) { killProjectElectron(); await waitForCdpDown(8000); }
}
async function loginFlow() {
    let started = false;
    if (FRESH) { log("--fresh: 기존 인스턴스 종료"); await gracefulLogoff(); if (!(await waitForCdpDown(3000))) throw new Error("종료 실패"); launchApp(); started = true; }
    const t0 = Date.now(); let sl = null;
    while (Date.now() - t0 < 90000) {
        const list = await cdpList();
        if (list) { sl = list.find((x) => x.type === "page" && /#ServerList/.test(x.title)); if (sl) break; const m = list.find((x) => x.type === "page" && /#Main/.test(x.title)); if (m) { log("이미 로그인됨"); return m; } }
        if (!started) { launchApp(); started = true; }
        await wait(1500);
    }
    if (!sl) throw new Error("서버리스트 창 없음");
    log("서버리스트 창 확인");
    const connectExpr = "JSON.stringify((function(){try{oAPP.attr._testMode=true;oAPP.attr._testId=" + JSON.stringify(STAFF) + ";var sel=['.u4a-lnch__rname','.u4a-lnch__row'];var target=null;for(var i=0;i<sel.length&&!target;i++){var els=[].slice.call(document.querySelectorAll(sel[i]));target=els.filter(function(n){return (n.textContent||'').indexOf(" + JSON.stringify(SERVER) + ")!==-1;})[0];}if(!target)return{ok:false};target.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));return{ok:true};}catch(e){return{ok:false};}})())";
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
const ENTER_EXPR = "JSON.stringify((function(){try{var i=document.getElementById('AppNmInput');if(!i)return{ok:0};i.value=" + JSON.stringify(APPID) + ";var f=i.closest&&i.closest('.u4a-field');if(f)f.setAttribute('data-filled','true');oAPP.events.ev_AppChange();return{ok:1};}catch(e){return{ok:0,why:e.message};}})())";

// ── 힙 스냅샷 뜨고 파싱 ──────────────────────────────────────────────────────────
async function takeSnapshot(sess) {
    sess.chunks.length = 0;
    await sess.send("HeapProfiler.collectGarbage");
    await wait(500);
    await sess.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, treatGlobalObjectsAsRoots: true });
    await wait(1500);
    const raw = sess.chunks.join("");
    return JSON.parse(raw);
}

function analyze(snap) {
    const nf = snap.snapshot.meta.node_fields;
    const ef = snap.snapshot.meta.edge_fields;
    const nodeTypes = snap.snapshot.meta.node_types[0];
    const edgeTypes = snap.snapshot.meta.edge_types[0];
    const NF = nf.length, EF = ef.length;
    const iType = nf.indexOf("type"), iName = nf.indexOf("name"), iEdgeCnt = nf.indexOf("edge_count"), iSize = nf.indexOf("self_size");
    const eType = ef.indexOf("type"), eName = ef.indexOf("name_or_index"), eTo = ef.indexOf("to_node");
    const nodes = snap.nodes, edges = snap.edges, strings = snap.strings;
    const nodeCount = nodes.length / NF;

    const nodeName = (i) => strings[nodes[i * NF + iName]] || "";
    const nodeTypeName = (i) => nodeTypes[nodes[i * NF + iType]] || "";

    // 각 노드의 edge 시작 위치
    const firstEdge = new Uint32Array(nodeCount + 1);
    let acc = 0;
    for (let i = 0; i < nodeCount; i++) { firstEdge[i] = acc; acc += nodes[i * NF + iEdgeCnt]; }
    firstEdge[nodeCount] = acc;

    // 역참조(누가 나를 붙잡나) 만들기
    const retainerOf = new Map();   // toNodeIndex → [{from, edgeName}]
    for (let from = 0; from < nodeCount; from++) {
        const s = firstEdge[from], e = firstEdge[from + 1];
        for (let k = s; k < e; k++) {
            const to = edges[k * EF + eTo] / NF;
            const et = edgeTypes[edges[k * EF + eType]];
            let en = "";
            if (et === "element" || et === "hidden") en = "[" + edges[k * EF + eName] + "]";
            else en = strings[edges[k * EF + eName]] || "";
            if (!retainerOf.has(to)) retainerOf.set(to, []);
            const arr = retainerOf.get(to);
            if (arr.length < 4) arr.push({ from, edgeName: en, edgeType: et });
        }
    }

    // 버려졌는데 안 치워진 노드 찾기
    //  · 우선 detachedness 필드(2=버려짐) 사용 — V8 이 알려주는 정확한 값
    //  · 그 필드가 없는 경우에만 이름이 "Detached " 로 시작하는지로 판정
    const iDetach = nf.indexOf("detachedness");
    const detached = [];
    let detachedBytes = 0;
    for (let i = 0; i < nodeCount; i++) {
        const isDet = (iDetach >= 0)
            ? (nodes[i * NF + iDetach] === 2)
            : nodeName(i).startsWith("Detached ");
        if (isDet) { detached.push(i); detachedBytes += nodes[i * NF + iSize]; }
    }
    console.log(`[ret] detachedness 필드 ${iDetach >= 0 ? "있음" : "없음"} → 버려진 조각 ${detached.length}개 검출`);

    // 그 노드들을 붙잡고 있는 쪽을 집계 (detached 끼리 서로 붙잡는 건 제외)
    const detachedSet = new Set(detached);
    const holders = new Map();
    for (const d of detached) {
        for (const r of (retainerOf.get(d) || [])) {
            if (detachedSet.has(r.from)) continue;                  // 버려진 것끼리는 원인이 아님
            const hn = nodeName(r.from) || "(무명)";
            const ht = nodeTypeName(r.from);
            const key = `${ht} ${hn}  ←(${r.edgeName || r.edgeType})`;
            holders.set(key, (holders.get(key) || 0) + 1);
        }
    }

    // 종류별 개수
    const kinds = new Map();
    for (const d of detached) { const nm = nodeName(d); kinds.set(nm, (kinds.get(nm) || 0) + 1); }

    // ── ★ GC 루트에서 각 노드까지 최단 경로 만들기 (BFS) ─────────────────────
    //   "누가 끝까지 붙잡고 있는가"를 알아야 고칠 자리가 나온다.
    const parent = new Int32Array(nodeCount).fill(-1);
    const parentEdge = new Array(nodeCount).fill("");
    const seen = new Uint8Array(nodeCount);
    const queue = new Int32Array(nodeCount);
    let qh = 0, qt = 0;
    queue[qt++] = 0; seen[0] = 1;          // 0번 = GC 루트
    while (qh < qt) {
        const cur = queue[qh++];
        const s = firstEdge[cur], e = firstEdge[cur + 1];
        for (let k = s; k < e; k++) {
            const to = edges[k * EF + eTo] / NF;
            if (seen[to]) continue;
            const et = edgeTypes[edges[k * EF + eType]];
            if (et === "weak") continue;                    // 약한 참조는 붙잡지 않음
            seen[to] = 1;
            parent[to] = cur;
            parentEdge[to] = (et === "element" || et === "hidden")
                ? "[" + edges[k * EF + eName] + "]"
                : (strings[edges[k * EF + eName]] || et);
            queue[qt++] = to;
        }
    }

    function pathOf(idx) {
        const out = [];
        let cur = idx, guard = 0;
        while (cur >= 0 && guard++ < 40) {
            const nm = nodeName(cur) || "(무명)";
            const tp = nodeTypeName(cur);
            out.push(`${tp === "object" || tp === "native" ? nm : tp + " " + nm}${parentEdge[cur] ? " ." + parentEdge[cur] : ""}`);
            cur = parent[cur];
        }
        return out.reverse().join("\n      → ");
    }

    // 버려진 조각 중 대표 경로
    //  ★ 가장 많은 갈래(경로에 "_el" 이 끼어 있는 것)를 우선으로 뽑는다.
    //    대표 몇 개만 보고 단정하지 않기 위함.
    const samples = [];
    const viaEl = detached.filter((d) => {
        let cur = d, g = 0;
        while (cur >= 0 && g++ < 60) { if (nodeName(cur) === "_el" || parentEdge[cur] === "_el") return true; cur = parent[cur]; }
        return false;
    });
    for (const f of viaEl.slice(0, 3)) samples.push({ kind: "★가장 많은 갈래(_el) " + nodeName(f), path: pathOf(f) });
    const wantKinds = ["HTMLIFrameElement", "HTMLDocument"];
    for (const kind of wantKinds) {
        const found = detached.filter((d) => nodeName(d) === kind && parent[d] >= 0).slice(0, 1);
        for (const f of found) samples.push({ kind, path: pathOf(f) });
    }

    // 루트에서 도달 가능한 버려진 조각 수
    const reachable = detached.filter((d) => seen[d]).length;

    // ── ★ 전수 집계: 1,513개가 "정말 다" 같은 뿌리를 거치는가 ────────────────
    //   대표 몇 개만 보고 단정하지 않기 위해, 버려진 조각 전부의 루트 경로를 훑는다.
    const viaCallbackRegistry = new Set();   // 바깥에 넘긴 콜백 보관소를 거치는 것
    const rootLabelCount = new Map();        // 경로 2~3번째(뿌리 쪽) 이름 집계
    for (const d of detached) {
        if (parent[d] < 0) continue;
        const chain = [];
        let cur = d, guard = 0;
        while (cur >= 0 && guard++ < 60) { chain.push(cur); cur = parent[cur]; }
        chain.reverse();
        let hit = false;
        for (const c of chain) {
            const nm = nodeName(c);
            if (nm === "CallbacksRegistry" || nm === "onPreviewSelectionEffectChange") { hit = true; break; }
        }
        if (hit) viaCallbackRegistry.add(d);
        // 뿌리 쪽 라벨(루트 바로 다음 2단계)
        const label = chain.slice(1, 4).map((c) => nodeName(c) || nodeTypeName(c)).join(" → ");
        rootLabelCount.set(label, (rootLabelCount.get(label) || 0) + 1);
    }

    return {
        nodeCount, detachedCount: detached.length, detachedKB: Math.round(detachedBytes / 1024),
        holders, kinds, samples, reachable,
        viaCallbackRegistry: viaCallbackRegistry.size,
        rootLabelCount,
    };
}

(async () => {
    const mainPage = await loginFlow();
    const sess = await connect(mainPage.webSocketDebuggerUrl);
    await sess.send("Runtime.enable");
    await sess.send("HeapProfiler.enable");

    const readyExpr = "JSON.stringify((function(){var i=document.getElementById('AppNmInput');var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}var fn=!!(window.oAPP&&oAPP.events&&oAPP.events.ev_AppChange);return{ready:!!i&&fn&&cur==='WS10'};})())";
    const t0 = Date.now(); let rdy = null;
    while (Date.now() - t0 < 120000) { try { rdy = await evalJson(sess, readyExpr); } catch (e) { } if (rdy && rdy.ready) break; await wait(1000); }
    if (!rdy || !rdy.ready) throw new Error("WS10 준비 실패");
    await evalJson(sess, ENTER_EXPR);
    await waitPage(sess, "WS20", 90000);
    await wait(2500);
    log("편집 진입 완료 → 왕복 시작");

    for (let i = 1; i <= LOOPS; i++) {
        await evalJson(sess, "JSON.stringify((function(){try{oAPP.events.ev_pageBack();return{ok:1};}catch(e){return{ok:0};}})())");
        await waitPage(sess, "WS10", 60000);
        await evalJson(sess, ENTER_EXPR);
        await waitPage(sess, "WS20", 90000);
        await wait(2000);
        log(`왕복 ${i}회 완료`);
    }

    log("힙 스냅샷 뜨는 중…");
    const snap = await takeSnapshot(sess);
    const r = analyze(snap);

    console.log(`\n===== 왕복 ${LOOPS}회 후, 버려졌는데 안 치워진 화면 조각 =====`);
    console.log(`  전체 객체 수 : ${r.nodeCount}`);
    console.log(`  안 치워진 조각 : ${r.detachedCount}개  (약 ${r.detachedKB}KB)`);

    console.log(`\n--- 안 치워진 조각의 종류 (많은 순 20) ---`);
    console.table([...r.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ 개수: v, 종류: k })));

    console.log(`\n--- 바로 위에서 붙잡는 것 (많은 순 25) ---`);
    console.table([...r.holders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => ({ 붙잡은수: v, "붙잡는 쪽": k })));

    console.log(`\n===== ★★ 전수 집계 — 정말 다 같은 뿌리인가 =====`);
    console.log(`  루트에서 도달 가능(=못 치움) : ${r.reachable} / ${r.detachedCount}개`);
    console.log(`  ★ 바깥에 넘긴 콜백 보관소를 거치는 것 : ${r.viaCallbackRegistry} / ${r.detachedCount}개  (${(r.viaCallbackRegistry / Math.max(1, r.detachedCount) * 100).toFixed(1)}%)`);
    console.log(`\n--- 뿌리 쪽 경로별 개수 (많은 순 10) ---`);
    console.table([...r.rootLabelCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ 개수: v, "뿌리 쪽 경로": k })));

    console.log(`\n===== 대표 경로 (GC 루트 → 버려진 조각) =====`);
    for (const s of r.samples) {
        console.log(`\n[${s.kind}]`);
        console.log("      → " + s.path);
    }

    sess.close();
    await gracefulLogoff();
    process.exit(0);
})().catch(async (e) => { console.error("[ret] 실패:", e.message); await gracefulLogoff().catch(() => { }); process.exit(1); });
