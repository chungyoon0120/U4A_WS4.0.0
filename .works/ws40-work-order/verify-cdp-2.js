/**
 * @file verify-cdp-2.js
 * @description
 * ws40-work-order-2 (A5 stack 출력 · A6 console.trace 줄 · A7 진입 기록 · A8 setConsoleLevel) 을
 * 떠 있는 dev mode 앱(#Main)에 CDP 로 붙어 실측한다. 앱을 띄우지는 않는다.
 *
 * 실행:
 *   node verify-cdp-2.js enter    # ENTER 줄 수 · setConsoleLevel 호출 결과 (WS20 까지 열린 상태에서)
 *   node verify-cdp-2.js error    # 일부러 uncaught error 를 낸다 — ★편집 중인 앱이 없는 상태(WS10)에서만
 *   node verify-cdp-2.js exit     # 로그오프 → 앱 종료
 *
 * 로그오프·종료는 cdp auto tester(D:/workspace/u4a-ws-cdp-tester/lib/py/launch.py) 방식 그대로다
 * (장군님 지시 2026-10-01): 앱 안에서 getServerPath() + "/logoff" 를 fetch → app.exit().
 * 오류창의 「확인」 을 누르거나 process 를 강제 종료하지 않는다 — 서버 편집 lock 이 남는다.
 */
const WebSocket = require("ws");
const http = require("http");

const PORT = 9222;
const LOGOFF_TRIES = 3;

function getJson(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (res) {
            let s = "";
            res.on("data", function (c) { s += c; });
            res.on("end", function () {
                try { resolve(JSON.parse(s)); } catch (e) { reject(e); }
            });
        }).on("error", reject);
    });
}

function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function openMain() {

    let list = await getJson("http://127.0.0.1:" + PORT + "/json/list");
    let target = list.find(function (t) { return t.type === "page" && t.title.indexOf("#Main") >= 0; });

    if (!target) {
        return null;
    }

    let ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(function (r, j) { ws.on("open", r); ws.on("error", j); });

    let seq = 0;
    let pending = {};
    let page = { events: [], ws: ws };

    ws.on("message", function (buf) {
        let m = JSON.parse(buf.toString());
        if (m.id && pending[m.id]) {
            pending[m.id](m);
            delete pending[m.id];
            return;
        }
        if (m.method === "Runtime.consoleAPICalled") {
            page.events.push(m.params);
        }
    });

    page.send = function (method, params) {
        seq++;
        let id = seq;
        ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        return new Promise(function (r) { pending[id] = r; });
    };

    page.ev = async function (expr) {
        let r = await page.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            return "EXCEPTION: " + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
        }
        return r.result && r.result.result ? r.result.result.value : r;
    };

    page.lines = function () {
        return page.events.map(function (p) {
            let sText = (p.args || []).map(function (a) {
                if (a.value !== undefined) { return String(a.value); }
                if (a.description !== undefined) { return String(a.description); }
                return "[" + a.type + "]";
            }).join(" ");
            return p.type + " | ctx=" + p.executionContextId + " | " + sText;
        });
    };

    return page;
}

async function runEnter() {

    let page = await openMain();
    if (!page) { throw new Error("#Main target not found"); }

    // Runtime.enable 이 그동안 쌓인 console 줄을 되돌려 준다
    await page.send("Runtime.enable");
    await wait(2000);

    let aAll = page.lines();
    let aEnter = aAll.filter(function (s) { return s.indexOf("ENTER") >= 0; });

    let out = {
        totalConsoleLines: aAll.length,
        errorLines: aAll.filter(function (s) { return s.indexOf("error |") === 0; }).length,
        enterCount: aEnter.length,
        enterLines: aEnter.slice(0, 30),
        api: await page.ev("JSON.stringify({ setConsoleLevel: typeof U4ALOG.setConsoleLevel, isPackaged: require('@electron/remote').app.isPackaged })")
    };

    // A8: dev mode 에서는 보이는 것이 안 바뀐다. 호출이 되고 줄이 남는지만 본다.
    page.events = [];
    out.setSilly = await page.ev("U4ALOG.setConsoleLevel('silly')");
    out.setBad = await page.ev("U4ALOG.setConsoleLevel('nope')");
    out.setError = await page.ev("U4ALOG.setConsoleLevel('error')");
    await wait(500);
    out.consoleLevelLines = page.lines().filter(function (s) { return s.indexOf("CONSOLE_LEVEL") >= 0; });

    console.log(JSON.stringify(out, null, 2));
    page.ws.close();
}

async function runError() {

    let page = await openMain();
    if (!page) { throw new Error("#Main target not found"); }

    await page.send("Runtime.enable");
    await wait(1500);

    let out = {};
    out.state = await page.ev("JSON.stringify({ page: (typeof getCurrPage === 'function') ? getCurrPage() : '?', title: document.title })");

    // ① uncaught error (window.onerror 길)
    page.events = [];
    // CDP 로 넣은 code 는 출처가 없어 browser 가 "Script error." 로 가린다(errorObj 도 null).
    // 그래서 inline <script> 로 넣는다 — 화면과 같은 출처라 진짜 오류 객체가 온다.
    await page.ev("(function () { var s = document.createElement('script'); s.textContent = 'setTimeout(function ws40ProbeThrow() { null.x; }, 0);'; document.head.appendChild(s); return 'sent'; })()");
    await wait(2500);
    out.onError = page.events.map(function (p) {
        return {
            type: p.type,
            text: (p.args || []).map(function (a) { return a.value !== undefined ? String(a.value) : String(a.description); }).join(" ").slice(0, 900),
            topFrame: (p.stackTrace && p.stackTrace.callFrames && p.stackTrace.callFrames[0]) ? (p.stackTrace.callFrames[0].functionName + " @ " + p.stackTrace.callFrames[0].url.split("/").pop() + ":" + (p.stackTrace.callFrames[0].lineNumber + 1)) : ""
        };
    }).filter(function (o) { return o.text.indexOf("[onError]") >= 0; });

    // ② unhandled rejection — 오류창은 이미 떠 있어 두 번째는 console.error 만 나온다
    page.events = [];
    await page.ev("(function () { var s = document.createElement('script'); s.textContent = 'Promise.reject(new Error(String.fromCharCode(119,115,52,48,45,112,114,111,98,101,45,114,101,106,101,99,116)));'; document.head.appendChild(s); return 'sent'; })()");
    await wait(2500);
    out.onRejection = page.events.map(function (p) {
        return {
            type: p.type,
            text: (p.args || []).map(function (a) { return a.value !== undefined ? String(a.value) : String(a.description); }).join(" ").slice(0, 900)
        };
    }).filter(function (o) { return o.text.indexOf("ws40-probe-reject") >= 0; });

    out.rejectionStackRepeat = out.onRejection.map(function (o) {
        return o.text.split("Error: ws40-probe-reject").length - 1;
    });

    console.log(JSON.stringify(out, null, 2));
    page.ws.close();
}

async function runExit() {

    let out = { loggedOff: false, tries: 0, why: "", ended: false };

    for (let i = 0; i < LOGOFF_TRIES; i++) {

        let page = await openMain();

        if (!page) {
            // 로그인한 창이 없다 — 풀 session 이 없다
            out.loggedOff = true;
            out.why = "no #Main window";
            break;
        }

        out.tries = i + 1;

        let sGot = await page.ev("(async function () { try { var base = getServerPath(); var res = await fetch(String(base).replace(/\\/+$/, '') + '/logoff', { method: 'GET', credentials: 'include' }); return JSON.stringify({ ok: !!res.ok, status: res.status }); } catch (e) { return JSON.stringify({ ok: false, why: String(e && e.message || e) }); } })()");
        page.ws.close();

        let oGot = {};
        try { oGot = JSON.parse(sGot); } catch (e) { oGot = { ok: false, why: String(sGot) }; }

        if (oGot.ok) {
            out.loggedOff = true;
            out.why = "status " + oGot.status;
            break;
        }

        out.why = oGot.why || ("status " + oGot.status);
    }

    // 종료 — 응답은 안 온다. port 가 비는지로만 본다.
    let list = [];
    try { list = await getJson("http://127.0.0.1:" + PORT + "/json/list"); } catch (e) { list = []; }

    let target = list.find(function (t) { return t.type === "page"; });

    if (target) {
        let ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(function (r, j) { ws.on("open", r); ws.on("error", j); });
        ws.on("error", function () { /* 종료 중 끊기는 것은 정상 */ });
        ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: "require('@electron/remote').app.exit()" } }));
    }

    for (let k = 0; k < 30; k++) {
        await wait(500);
        try {
            await getJson("http://127.0.0.1:" + PORT + "/json/list");
        } catch (e) {
            out.ended = true;
            break;
        }
    }

    console.log(JSON.stringify(out, null, 2));
}

let sMode = process.argv[2];
let fn = { enter: runEnter, error: runError, exit: runExit }[sMode];

if (!fn) {
    console.error("usage: node verify-cdp-2.js enter|error|exit");
    process.exit(1);
}

fn().then(function () {
    process.exit(0);
}).catch(function (e) {
    console.error("[verify-cdp-2] failed:", e);
    process.exit(1);
});
