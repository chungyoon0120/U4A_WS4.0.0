/****************************************************************************************
 * login-smoke.js  —  U4A Workspace 자동 로그인 스모크 테스트 드라이버 (CDP)
 *
 * 흐름: 앱 실행 → 인트로 → 서버리스트 → UHA 접속 → "청윤"(soccerhs) 자동 로그인
 * 판정: #Main 창 URL 에 sessionKey + SYSID=UHA 가 뜨면 PASS.
 *
 * 실행:
 *   node .works/auto-test/login-smoke.js            # 앱이 떠 있으면 재사용, 없으면 자동 실행
 *   node .works/auto-test/login-smoke.js --fresh    # 이 프로젝트 electron 만 종료 후 새로 실행(코드수정 검증용)
 *   node .works/auto-test/login-smoke.js --server U4E --staff shhong   # 다른 서버/스태프
 *
 * 종료코드: PASS=0, FAIL=1
 ****************************************************************************************/
"use strict";

const WebSocket = require("ws");
const { spawn, execSync } = require("child_process");
const path = require("path");

// ── 파라미터 ──────────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };
const FRESH   = ARGV.includes("--fresh");
const SERVER  = getArg("--server", "UHA");     // 서버리스트에서 접속할 서버(이름/시스템ID 부분일치)
const STAFF   = getArg("--staff", "soccerhs");  // 자동 로그인 스태프 ID
const APP     = getArg("--app", null);          // 지정 시 로그인 후 이 앱으로 편집(Change) 모드 진입까지 검증
const BIND    = ARGV.includes("--bind");        // 지정 시 편집 진입 후 바인딩 팝업 실행까지 검증(--app 필요)
const PORT    = 9222;
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CONNECT_TIMEOUT_MS = 60000;  // 앱 부팅 + 서버리스트 렌더 대기
const LOGIN_TIMEOUT_MS   = 30000;  // 접속 후 #Main 세션 확립 대기
const EDIT_TIMEOUT_MS    = 25000;  // 편집(Change) 모드 진입(WS20/WS30 이동) 대기

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log  = (...a) => console.log("[smoke]", ...a);

// ── CDP 유틸 ──────────────────────────────────────────────────────────────────────
async function cdpList() {
    try {
        const res = await fetch(`${DEBUG_HOST}/json/list`);
        return await res.json();
    } catch (e) { return null; }
}

async function evalOnPage(page, expression) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => {
        const i = ++id;
        const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } };
        ws.on("message", h);
        ws.send(JSON.stringify({ id: i, ...m }));
    });
    await send({ method: "Runtime.enable" });
    const r = await send({ method: "Runtime.evaluate", params: { expression, returnByValue: true } });
    ws.close();
    if (r.result && r.result.exceptionDetails) {
        throw new Error("eval exception: " + JSON.stringify(r.result.exceptionDetails));
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
}

// ── 앱 라이프사이클 ────────────────────────────────────────────────────────────────
function killProjectElectron() {
    // 이 프로젝트 경로의 electron.exe 만 정확히 종료(다른 Electron 앱은 건드리지 않음).
    // 따옴표 충돌을 피하려 -Filter 대신 Where-Object 안에서 이름/경로를 모두 단일따옴표로 판정한다.
    const ps = "Get-CimInstance Win32_Process | " +
        "Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -like '*U4A_WS4.0.0*' } | " +
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
    try { execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: "ignore" }); } catch (e) {}
}

// CDP 가 완전히 내려갈 때까지 대기(종료 확인 → 진짜 fresh 보장). 성공 시 true.
async function waitForCdpDown(timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        if ((await cdpList()) === null) return true;
        await wait(500);
    }
    return false;
}

function launchApp() {
    log("앱 실행: npm start (WS_REMOTE_DEBUG_HOST=" + DEBUG_HOST + ")");
    const child = spawn("npm", ["start"], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, WS_REMOTE_DEBUG_HOST: DEBUG_HOST },
        shell: true,
        detached: true,
        stdio: "ignore",
    });
    child.unref();
}

// ★ 정상 로그오프로 앱 종료 (강제 kill 금지가 기본).
//   #Main 로그인 상태 → ev_Logout(fnWS10WMENU30_04): 확인창 자동 YES → 서버 /logoff 에
//   APPID+SSID 전송(편집 락 반납 + SAP 세션 종료) → 창 닫힘 → 앱 종료. 락 누수 원천 차단.
//   로그인 전(ServerList/로그인창) → 세션·락 없음, 창을 정상 종료.
//   응답이 없거나 시간초과일 때만 마지막 수단으로 강제종료.
async function gracefulLogoff() {
    const list = await cdpList();
    if (!list) return; // 이미 종료됨
    try {
        const main = list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) {
            log("정상 로그오프(ev_Logout → /logoff APPID+SSID: 락 반납·세션 종료)");
            // 창이 닫히며 eval 연결이 끊길 수 있어 예외는 무시.
            await evalOnPage(main,
                "(function(){try{" +
                "if(window.oAPP&&oAPP.common){oAPP.common.fnConfirmBox=function(t,m,cb){cb('YES');};}" +
                "if(window.oAPP&&oAPP.fn&&oAPP.fn.fnWS10WMENU30_04){oAPP.fn.fnWS10WMENU30_04();}" +
                "else if(window.oAPP&&oAPP.events&&oAPP.events.ev_Logout){oAPP.events.ev_Logout();}" +
                "}catch(e){}})()").catch(() => {});
        } else {
            // 로그인 전 창 — 세션/락 없음. 정상적으로 창 닫기.
            const any = list.find((x) => x.type === "page");
            if (any) await evalOnPage(any,
                "(function(){try{window.onbeforeunload=null;top.window.close();}catch(e){}})()").catch(() => {});
        }
    } catch (e) { /* ignore */ }
    const down = await waitForCdpDown(25000);
    if (!down) {
        log("정상 로그오프 시간초과 → 마지막 수단으로 강제 종료");
        killProjectElectron();
        await waitForCdpDown(8000);
    }
}

// ── 메인 시나리오 ──────────────────────────────────────────────────────────────────
async function main() {
    let started = false;

    if (FRESH) {
        // 기존 인스턴스를 정상 로그오프로 종료(강제 kill 금지) → CDP 다운 확인 → 재기동.
        // 정상 로그오프가 편집 락을 반납하므로 락 누수가 발생하지 않는다.
        log("--fresh: 기존 인스턴스 정상 로그오프 후 재기동");
        await gracefulLogoff();
        const down = await waitForCdpDown(3000);
        if (!down) throw new Error("종료 후에도 CDP(" + PORT + ")가 살아있음 — 종료 실패. 거짓 PASS 방지 위해 중단.");
        log("종료 확인(CDP down). 새로 실행합니다.");
        launchApp();
        started = true;
    }

    // 1) CDP 접속(없으면 실행 후 대기)
    const t0 = Date.now();
    while (Date.now() - t0 < CONNECT_TIMEOUT_MS) {
        const list = await cdpList();
        if (list) {
            const sl = list.find((x) => x.type === "page" && /#ServerList/.test(x.title));
            if (sl) { log("서버리스트 창 확인:", sl.title); return runFlow(sl); }
            // 서버리스트 없이 #Main 만 있으면 이미 로그인된 상태 → 깨끗한 검증 불가
            const main = list.find((x) => x.type === "page" && /#Main/.test(x.title));
            if (main && !started) {
                throw new Error("이미 #Main(로그인됨) 상태이고 서버리스트 창이 없음. 정확한 검증은 --fresh 로 재실행하세요.");
            }
        }
        if (!started) { launchApp(); started = true; }
        await wait(1500);
    }
    throw new Error("서버리스트 창을 시간 내 찾지 못했습니다(" + CONNECT_TIMEOUT_MS + "ms).");
}

async function runFlow(serverListPage) {
    // 2) 테스트모드 ON + 스태프 ID 세팅 → 대상 서버 카드/행 dblclick(=fnPressServerListItem)
    const connectExpr =
        "JSON.stringify((function(){try{" +
        "oAPP.attr._testMode=true;oAPP.attr._testId=" + JSON.stringify(STAFF) + ";" +
        // 최근연결 카드 우선, 없으면 검색결과 행에서 SERVER 부분일치 탐색
        "var sel=['.u4a-lnch__rname','.u4a-lnch__row'];var target=null;" +
        "for(var i=0;i<sel.length&&!target;i++){var els=[].slice.call(document.querySelectorAll(sel[i]));" +
        "target=els.filter(function(n){return (n.textContent||'').indexOf(" + JSON.stringify(SERVER) + ")!==-1;})[0];}" +
        "if(!target)return{ok:false,why:'서버 카드/행 없음: " + SERVER + "'};" +
        "target.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));" +
        "return{ok:true,clicked:(target.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40)};" +
        "}catch(e){return{ok:false,why:e.message};}})())";

    // fresh 부팅 직후엔 서버리스트 DOM 렌더 전일 수 있음 → 카드가 나타날 때까지 폴링(최대 20s)
    let conn = null;
    const tCard = Date.now();
    while (Date.now() - tCard < 20000) {
        conn = JSON.parse(await evalOnPage(serverListPage, connectExpr));
        if (conn.ok) break;
        await wait(1000);
    }
    if (!conn || !conn.ok) throw new Error("접속 트리거 실패: " + (conn ? conn.why : "no result"));
    log("접속 트리거:", conn.clicked, "→ 테스트모드 자동로그인(" + STAFF + ")");

    // 3) #Main 세션 확립 대기 → sessionKey + SYSID 판정
    const t0 = Date.now();
    while (Date.now() - t0 < LOGIN_TIMEOUT_MS) {
        const list = await cdpList();
        const main = list && list.find((x) => x.type === "page" && /#Main/.test(x.title));
        if (main) {
            const u = new URL(main.url);
            const sessionKey = u.searchParams.get("sessionKey");
            const sysid = u.searchParams.get("SYSID");
            const objty = u.searchParams.get("OBJTY");
            if (sessionKey && objty === "MAIN") {
                // 로그인 폼이 사라졌는지도 교차 확인
                let hasForm = true;
                try { hasForm = await evalOnPage(main, "!!document.getElementById('ws_pw')"); } catch (e) {}
                log("로그인 PASS ✅  #Main 세션 확립 (SYSID=" + sysid + ", session=" + sessionKey.slice(0, 12) + "…, loginForm gone=" + (hasForm === false) + ")");
                // 편집 진입 단계가 지정됐으면 이어서 검증, 아니면 로그인만으로 종료
                if (APP) return runEditMode(main.id);
                return true;
            }
        }
        await wait(1000);
    }
    throw new Error("#Main 세션이 시간 내 확립되지 않음(" + LOGIN_TIMEOUT_MS + "ms). 로그인 실패로 판정.");
}

// ── 편집(Change) 모드 진입 검증 ────────────────────────────────────────────────────
// 앱이름(#AppNmInput) 세팅 → ev_AppChange(ISEDIT="X") → WS20/WS30 이동 + IS_EDIT="X" 판정.
async function runEditMode(mainTargetId) {
    // #Main 페이지 핸들 재취득(내비게이션으로 ws 재연결 안전)
    const getMain = async () => {
        const l = await cdpList();
        return l && l.find((x) => x.type === "page" && x.id === mainTargetId);
    };
    let main = await getMain();
    if (!main) throw new Error("#Main 타겟 소실");

    // 1) WS10 메뉴 렌더 대기(로그인 직후엔 AppNmInput 미존재) → 준비되면 입력+편집 트리거
    const readyExpr =
        "JSON.stringify((function(){" +
        "var i=document.getElementById('AppNmInput');" +
        "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
        "var fn=!!(window.oAPP&&oAPP.events&&oAPP.events.ev_AppChange);" +
        "return{ready:!!i&&fn&&cur==='WS10',hasInput:!!i,hasFn:fn,page:cur};})())";
    const tReady = Date.now();
    let rdy = null;
    while (Date.now() - tReady < 20000) {
        main = (await getMain()) || main;
        rdy = JSON.parse(await evalOnPage(main, readyExpr));
        if (rdy.ready) break;
        await wait(700);
    }
    if (!rdy || !rdy.ready) throw new Error("WS10 앱이름 입력칸 미준비: " + JSON.stringify(rdy));

    const setExpr =
        "JSON.stringify((function(){try{" +
        "var i=document.getElementById('AppNmInput');" +
        "if(!i)return{ok:false,why:'AppNmInput 입력칸 없음'};" +
        "i.value=" + JSON.stringify(APP) + ";" +
        "var f=i.closest&&i.closest('.u4a-field');if(f)f.setAttribute('data-filled','true');" +
        "oAPP.events.ev_AppChange();" +
        "return{ok:true,value:i.value};" +
        "}catch(e){return{ok:false,why:e.message};}})())";
    const set = JSON.parse(await evalOnPage(main, setExpr));
    if (!set.ok) throw new Error("편집 트리거 실패: " + set.why);
    log("앱이름 입력 '" + set.value + "' → 편집(Change) 트리거");

    // 2) WS20/WS30 이동 + IS_EDIT 판정 폴링 (상태는 getAppInfo()/getCurrPage() 전역으로 판독)
    const stateExpr =
        "JSON.stringify((function(){try{" +
        "var cur='';try{cur=(typeof getCurrPage==='function')?getCurrPage():'';}catch(e){}" +
        "var app={};try{app=((typeof getAppInfo==='function'?getAppInfo():null))||{};}catch(e){}" +
        "var errEl=document.querySelector('[class*=FloatingFooter],[class*=floating-msg],[class*=FloatMsg]');" +
        "var err=errEl?(errEl.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90):'';" +
        "return{page:cur,appid:app.APPID||'',isEdit:app.IS_EDIT,appty:app.APPTY||'',err:err};" +
        "}catch(e){return{fatal:e.message};}})())";

    const want = APP.toUpperCase();
    const t0 = Date.now();
    let last = null;
    let healed = false;   // 자기락 강등 시 unlock+재시도 1회
    while (Date.now() - t0 < EDIT_TIMEOUT_MS) {
        main = (await getMain()) || main;
        last = JSON.parse(await evalOnPage(main, stateExpr));
        const onPage = last.page === "WS20" || last.page === "WS30";
        const idMatch = (last.appid || "").toUpperCase() === want;
        if (onPage && idMatch && last.isEdit === "X") {
            log("편집모드 PASS ✅  " + last.page + " 진입 (APPID=" + last.appid + ", IS_EDIT=" + last.isEdit + ", APPTY=" + last.appty + ")");
            let ok = true;
            if (BIND) ok = await runBindPopup(mainTargetId);
            // 종료는 상위(gracefulLogoff)에서 정상 로그오프로 처리 → 편집 락 반납.
            return ok;
        }
        // 편집 진입은 됐으나 표시모드로 강등된 경우
        if (onPage && idMatch && last.isEdit !== "X") {
            const locked = /is locked by/i.test(last.err || "") || last.err === "-" || !last.err;
            if (!healed && locked) {
                // 자기 자신이 건 누수 락일 수 있음 → WS20(unlock 함수 로드됨)에서 반납 후 편집 재시도 1회.
                healed = true;
                log("표시모드 강등 감지(" + (last.err || "lock?") + ") → 락 반납 후 편집 재시도");
                await evalOnPage(main,
                    "new Promise(function(res){try{if(typeof ajax_unlock_app==='function'){ajax_unlock_app({APPID:" + JSON.stringify(APP) + "},function(){res(1);});}else res(0);}catch(e){res(0);}})",
                    true);
                await wait(1500);
                await evalOnPage(main,
                    "(function(){try{var i=document.getElementById('AppNmInput');if(i)i.value=" + JSON.stringify(APP) + ";oAPP.events.ev_AppChange();}catch(e){}})()");
                await wait(1500);
                continue;
            }
            throw new Error("편집 진입 실패 — " + last.page + " 로 열렸으나 IS_EDIT='" + last.isEdit + "'(표시모드 강등). 원인=" + (last.err || "잠금(다른 사용자/세션) 또는 버전관리/권한") + ". 자기락이면 원 소유 세션 종료/백엔드 해제 필요.");
        }
        // 앱 없음/검증오류로 푸터 메시지가 뜬 경우
        if (last.err && !/is locked by/i.test(last.err)) throw new Error("편집 진입 실패 — 메시지: " + last.err);
        await wait(1000);
    }
    throw new Error("편집 모드 미진입(" + EDIT_TIMEOUT_MS + "ms). 마지막상태=" + JSON.stringify(last));
}

// ── 바인딩 팝업 실행 검증 (실제 속성 행의 바인딩 아이콘 버튼 클릭) ─────────────────────
// WS20 디자인트리 노드 선택 → 바인딩 가능 속성(icon1_src='sap-icon://fallback', UIATY 1/3)의
// 행 아이콘버튼(.u4aWs20AttrIcBtn)을 실제 클릭 → dialog.u4aBindDlg[open] 확인.
async function runBindPopup(mainTargetId) {
    const getMain = async () => {
        const l = await cdpList();
        return l && l.find((x) => x.type === "page" && x.id === mainTargetId);
    };
    let main = await getMain();
    if (!main) throw new Error("#Main 타겟 소실");

    // 트리 노드를 순회하며 바인딩 가능 속성이 있는 컨트롤을 찾아 그 행의 아이콘버튼 클릭
    const nodeCountExpr = "document.querySelectorAll('.u4a-tree__row').length";
    const nNodes = await evalOnPage(main, nodeCountExpr);
    if (!nNodes) throw new Error("WS20 디자인트리 행 없음(.u4a-tree__row)");

    const bindTitle = { value: null };
    for (let i = 0; i < nNodes; i++) {
        // 노드 선택
        await evalOnPage(main,
            "(function(){var r=document.querySelectorAll('.u4a-tree__row')[" + i + "];" +
            "if(r)r.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()");
        // 속성 로드 대기 후 bindable 속성 탐색 + 해당 행 아이콘버튼 클릭
        let clicked = null;
        const tAttr = Date.now();
        while (Date.now() - tAttr < 6000) {
            await wait(700);
            clicked = JSON.parse(await evalOnPage(main,
                "JSON.stringify((function(){try{" +
                "var d=(oAPP.attr.oModel&&oAPP.attr.oModel.oData)||{};var t=d.T_ATTR||[];" +
                "var b=t.filter(function(a){return a.icon1_src==='sap-icon://fallback'&&(a.UIATY==='1'||a.UIATY==='3');})[0];" +
                "if(!b)return{bindable:false};" +
                "var rows=[].slice.call(document.querySelectorAll('.u4aWs20AttrRow'));" +
                "var row=rows.filter(function(r){var lb=r.querySelector('.u4aWs20AttrRowLbl');return lb&&lb.textContent.trim()===b.UIATT;})[0];" +
                "if(!row)return{bindable:true,rowFound:false,uiatt:b.UIATT};" +
                "var btn=row.querySelector('.u4aWs20AttrIcBtn');" +
                "if(!btn)return{bindable:true,btn:false,uiatt:b.UIATT};" +
                "btn.dispatchEvent(new MouseEvent('click',{bubbles:true}));" +
                "return{clicked:true,uiatt:b.UIATT,uiaty:b.UIATY};" +
                "}catch(e){return{err:e.message};}})())"));
            if (clicked && (clicked.clicked || clicked.bindable === false)) break;
        }
        if (clicked && clicked.clicked) {
            bindTitle.value = clicked.uiatt;
            log("바인딩 아이콘 클릭: 속성 '" + clicked.uiatt + "' (노드 index " + i + ")");
            break;
        }
    }
    if (!bindTitle.value) throw new Error("바인딩 가능 속성/아이콘 버튼을 트리에서 찾지 못함");

    // dialog.u4aBindDlg[open] 확인
    const tDlg = Date.now();
    while (Date.now() - tDlg < 8000) {
        await wait(600);
        const d = JSON.parse(await evalOnPage(main,
            "JSON.stringify((function(){var d=document.querySelector('dialog.u4aBindDlg');" +
            "return{exists:!!d,open:d?!!d.open:false,head:d?(d.querySelector('.u4a-dialog__header')||{}).textContent.replace(/\\s+/g,' ').trim().slice(0,60):''};})())"));
        if (d.exists && d.open) {
            log("바인딩팝업 PASS ✅  dialog.u4aBindDlg 열림");
            log("   헤더    = " + d.head);
            log("   대상속성 = " + bindTitle.value);
            return true;
        }
    }
    throw new Error("바인딩 팝업 미개방(dialog.u4aBindDlg[open] 없음). 속성=" + bindTitle.value);
}

// 성공/실패 무관하게 종료 시 정상 로그오프(락 반납·세션 종료). 강제 kill 은 최후수단.
main()
    .then(async (ok) => { await gracefulLogoff().catch(() => {}); process.exit(ok === false ? 1 : 0); })
    .catch(async (e) => { console.error("[smoke] FAIL ❌ ", e.message); await gracefulLogoff().catch(() => {}); process.exit(1); });
