/**
 * @file verify-cdp.js
 * @description
 * ws40-work-order 작업(반복 억제 스위치 · 미리보기 로그 연결 · 속성값 기록 · console.error 오류 객체) 을
 * 떠 있는 앱(#Main)에 CDP 로 붙어 실측한다. 앱을 띄우거나 끄지 않는다 — 붙기만 한다.
 * 실행 전제: login-smoke.js --fresh --keep --app <APPID> 로 WS20 까지 열려 있을 것.
 */
const WebSocket = require("ws");
const http = require("http");

function getJson(url) {
    return new Promise(function (resolve, reject) {
        http.get(url, function (res) {
            let s = "";
            res.on("data", function (c) { s += c; });
            res.on("end", function () { resolve(JSON.parse(s)); });
        }).on("error", reject);
    });
}

async function main() {

    let list = await getJson("http://127.0.0.1:9222/json/list");
    let main = list.find(function (t) { return t.type === "page" && t.title.indexOf("#Main") >= 0; });

    if (!main) {
        throw new Error("#Main target not found");
    }

    let ws = new WebSocket(main.webSocketDebuggerUrl);
    await new Promise(function (r) { ws.on("open", r); });

    let seq = 0;
    let pending = {};
    let consoleEvents = [];

    ws.on("message", function (buf) {
        let m = JSON.parse(buf.toString());
        if (m.id && pending[m.id]) {
            pending[m.id](m);
            delete pending[m.id];
            return;
        }
        if (m.method === "Runtime.consoleAPICalled") {
            consoleEvents.push(m.params);
        }
    });

    function send(method, params) {
        seq++;
        let id = seq;
        ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
        return new Promise(function (r) { pending[id] = r; });
    }

    async function ev(expr) {
        let r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result && r.result.exceptionDetails) {
            return "EXCEPTION: " + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description);
        }
        return r.result && r.result.result ? r.result.result.value : r;
    }

    function argText(a) {
        if (a.value !== undefined) { return String(a.value); }
        if (a.description !== undefined) { return String(a.description); }
        return "[" + a.type + "]";
    }

    function lines() {
        return consoleEvents.map(function (p) {
            return p.type + " | " + (p.args || []).map(argText).join(" ");
        });
    }

    // 지난 콘솔도 다시 받는다(Runtime.enable 이 쌓인 메시지를 되돌려 준다)
    await send("Runtime.enable");
    await new Promise(function (r) { setTimeout(r, 1500); });

    let out = {};
    let replay = lines();
    out.replayCount = replay.length;
    out.replayErrors = replay.filter(function (s) { return s.indexOf("error |") === 0; }).slice(-15);
    out.prev001 = replay.filter(function (s) { return s.indexOf("PREV-001") >= 0; });
    out.propCoerce = replay.filter(function (s) { return s.indexOf("PROP_COERCE") >= 0; });
    out.caughtLines = replay.filter(function (s) { return s.indexOf("CAUGHT") >= 0; }).length;

    // 1) 공개 함수가 있나
    out.api = await ev("JSON.stringify({ logger: typeof U4ALOG, throttle: typeof U4ALOG.setCaughtThrottle, clear: typeof U4ALOG.clearCaughtCount, note: typeof U4ALOG.note, page: (typeof getCurrPage === 'function') ? getCurrPage() : '?' })");

    // 2) 미리보기 iframe 이 부모 U4ALOG 를 이어 받았나
    out.preview = await ev("(function(){ var fr = Array.prototype.slice.call(document.querySelectorAll('iframe')); var r = []; fr.forEach(function(f){ try { var w = f.contentWindow; if (w && typeof w.parsePropertyValue === 'function') { r.push({ src: (f.getAttribute('src')||'').slice(-40), hasLog: typeof w.U4ALOG, same: w.U4ALOG === window.U4ALOG }); } } catch (e) { r.push({ err: String(e) }); } }); return JSON.stringify(r); })()");

    // 3) 반복 억제: 켜진 상태로 같은 오류 10번 → 끄고 10번 → 다시 켬
    consoleEvents = [];
    await ev("(function(){ for (var i = 0; i < 10; i++) { U4ALOG.caught(new Error('ws40-probe-on')); } })()");
    await new Promise(function (r) { setTimeout(r, 400); });
    out.throttleOnLines = lines().filter(function (s) { return s.indexOf("ws40-probe-on") >= 0; }).length;

    consoleEvents = [];
    await ev("U4ALOG.setCaughtThrottle(false)");
    await ev("(function(){ for (var i = 0; i < 10; i++) { U4ALOG.caught(new Error('ws40-probe-off')); } })()");
    await new Promise(function (r) { setTimeout(r, 400); });
    let offLines = lines();
    out.throttleOffLine = offLines.filter(function (s) { return s.indexOf("THROTTLE") >= 0; });
    out.throttleOffLines = offLines.filter(function (s) { return s.indexOf("ws40-probe-off") >= 0; }).length;

    consoleEvents = [];
    await ev("U4ALOG.setCaughtThrottle(true)");
    await new Promise(function (r) { setTimeout(r, 300); });
    out.throttleOnAgainLine = lines().filter(function (s) { return s.indexOf("THROTTLE") >= 0; });

    // 4) 미리보기 쪽에서 caught 를 부르면 부모 console 로 줄이 오고, 터진 자리가 미리보기 파일로 찍히나
    consoleEvents = [];
    out.previewCaught = await ev("(function(){ var fr = Array.prototype.slice.call(document.querySelectorAll('iframe')); for (var i = 0; i < fr.length; i++) { var w = fr[i].contentWindow; if (w && typeof w.parsePropertyValue === 'function') { w.eval(\"try { null.x; } catch (e) { if (typeof U4ALOG !== 'undefined' && U4ALOG.caught) { U4ALOG.caught(e, 'ws40-probe-preview'); } }\"); return 'called'; } } return 'no preview'; })()");
    await new Promise(function (r) { setTimeout(r, 400); });
    out.previewCaughtLines = lines().filter(function (s) { return s.indexOf("ws40-probe-preview") >= 0; });

    // 5) console.error 에 오류 객체를 넘기면 CDP 로 무엇이 오나 (지침서의 「측정」 — 참고용)
    consoleEvents = [];
    await ev("console.error('ws40-probe-err:', new Error('probe-stack-test'))");
    await new Promise(function (r) { setTimeout(r, 400); });
    let pe = consoleEvents.find(function (p) { return (p.args || []).some(function (a) { return a.value === "ws40-probe-err:"; }); });
    out.errObjArg = pe ? { argTypes: pe.args.map(function (a) { return a.type + (a.subtype ? "/" + a.subtype : ""); }), description: (pe.args[1] && pe.args[1].description || "").split("\n").slice(0, 3), hasPreview: !!(pe.args[1] && pe.args[1].preview), stackTop: (pe.stackTrace && pe.stackTrace.callFrames || []).slice(0, 1) } : "not captured";

    console.log(JSON.stringify(out, null, 2));
    ws.close();
}

main().catch(function (e) {
    console.error("[verify-cdp] failed:", e);
    process.exit(1);
});
