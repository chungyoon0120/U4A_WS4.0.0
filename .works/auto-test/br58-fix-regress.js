/* ********************************************************************
 * [BR58 검수반영] 회귀 자동 확인 — HLP12 / HLP13 / HLP15 / HLP16.
 *   HLP14(도움말 문서 폴더 이름 바꾸기)는 파일을 건드려야 해서 여기 없음.
 *   HLP16 은 "단축키 잠금이 풀렸는지"까지만 본다 — 실제 되돌리기 키를 누르면
 *   장군님 편집 내용이 바뀌므로 누르지 않는다.
 * 실행: node .works/auto-test/br58-fix-regress.js
 * ******************************************************************** */
"use strict";
const WebSocket = require("ws");
const HOST = "http://127.0.0.1:9222";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function list() { return await (await fetch(HOST + "/json/list")).json(); }

async function conn(p) {
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });
    let id = 0;
    const send = (m) => new Promise((r) => {
        const i = ++id;
        const h = (d) => { const j = JSON.parse(d); if (j.id === i) { ws.off("message", h); r(j); } };
        ws.on("message", h);
        ws.send(JSON.stringify(Object.assign({ id: i }, m)));
    });
    await send({ method: "Runtime.enable" });
    return {
        close: () => ws.close(),
        eval: async (e) => {
            const r = await send({ method: "Runtime.evaluate", params: { expression: e, returnByValue: true, awaitPromise: true } });
            if (r.result && r.result.exceptionDetails) {
                return "EXC:" + ((r.result.exceptionDetails.exception || {}).description || "").slice(0, 300);
            }
            return r.result && r.result.result ? r.result.result.value : undefined;
        }
    };
}

const BUSY = "document.getElementById(\"u4aWsBusyIndicator\").open ? \"★남음\" : \"꺼짐\"";
const LOCK = "(oAPP.attr && oAPP.attr.isShortcutLock) ? \"★잠김\" : \"풀림\"";

const HELPDOC = (t) => /u4a_helpdoc/.test(decodeURIComponent(t.url || ""));
const TIPDOC = (t) => decodeURIComponent(t.url || "").indexOf("design/html/helper/") >= 0;

async function closeAll() {
    let n = 0;
    for (const t of await list()) {
        if (t.type === "page" && (HELPDOC(t) || TIPDOC(t))) {
            try { await fetch(HOST + "/json/close/" + t.id); n++; } catch (e) { }
        }
    }
    return n;
}

const CLICK = (kind) => [
    "(function(){",
    "  var b = null;",
    "  if (\"" + kind + "\" === \"prev\") { b = document.getElementById(\"ws20PrevHelpBtn\"); }",
    "  else if (\"" + kind + "\" === \"attr\") { b = document.getElementById(\"ws20AttrHelpBtn\"); }",
    "  else { var a = [].slice.call(document.querySelectorAll(\"button\"));",
    "         b = a.filter(function(x){ return /fa-circle-question/.test(x.innerHTML) && !x.id; })[0] || null; }",
    "  if (!b) { return \"버튼없음\"; }",
    "  b.click(); return \"클릭\";",
    "})()"
].join("\n");

const OLD_ON = [
    "(function(){",
    "  if (window.__BR58_OLD) { return \"이미\"; }",
    "  var fn = function(e){",
    "    var b = e.target && e.target.closest ? e.target.closest(\"button\") : null;",
    "    if (!b) { return; }",
    "    if (!(b.id === \"ws20PrevHelpBtn\" || b.id === \"ws20AttrHelpBtn\" || /fa-circle-question/.test(b.innerHTML || \"\"))) { return; }",
    "    var bak = oAPP.common.checkWLOList;",
    "    oAPP.common.checkWLOList = function(a,c){ if (a===\"C\" && c===\"UHAK901369\") { return false; } return bak.apply(oAPP.common, arguments); };",
    "    setTimeout(function(){ oAPP.common.checkWLOList = bak; }, 0);",
    "  };",
    "  document.addEventListener(\"click\", fn, true); window.__BR58_OLD = fn; return \"켬\";",
    "})()"
].join("\n");

const OLD_OFF = [
    "(function(){",
    "  if (!window.__BR58_OLD) { return \"이미\"; }",
    "  document.removeEventListener(\"click\", window.__BR58_OLD, true); delete window.__BR58_OLD; return \"끔\";",
    "})()"
].join("\n");

(async () => {

    const L = await list();
    const main = L.find((x) => x.type === "page" && /ws10_20\/index\.html/.test(x.url));
    if (!main) { console.log("실패: 앱 본창을 못 찾음"); process.exit(1); }
    const c = await conn(main);

    const R = [];
    let oBounds = null;

    try {

        const pre = JSON.parse(await c.eval([
            "JSON.stringify({",
            "  fn: typeof oAPP.fn.callTooltipsPopup,",
            "  fixed: String(oAPP.fn.callTooltipsPopup).indexOf(\"lf_finish\") >= 0,",
            "  lock: (oAPP.attr && oAPP.attr.isShortcutLock) || false })"
        ].join("\n")));
        console.log("[사전점검]", JSON.stringify(pre));
        if (pre.fn !== "function" || !pre.fixed) {
            console.log("실패: 고친 코드 미반영 — 앱 재시작 필요");
            c.close(); process.exit(1);
        }
        await closeAll();

        // ── HLP12 : 현재 서버에서 3곳이 통합 도움말 창을 여는가 (회귀) ──
        let ok12 = true;
        const det12 = [];
        for (const pair of [["UI트리", "tree"], ["속성", "attr"], ["미리보기", "prev"]]) {
            const before = (await list()).filter(HELPDOC).length;
            await c.eval(CLICK(pair[1]));
            await sleep(4000);
            const after = (await list()).filter(HELPDOC).length;
            const busy = await c.eval(BUSY);
            const good = (after > before) && busy !== "★남음";
            if (!good) { ok12 = false; }
            det12.push(pair[0] + "=" + (after > before ? "뜸" : "★안뜸") + "/대기" + busy);
        }
        R.push(["HLP12", ok12, det12.join(" · ")]);
        console.log("[HLP12]", ok12 ? "OK" : "FAIL", det12.join(" · "));
        await closeAll();

        // ── HLP13 : 다섯 번 열고 닫아도 화면이 굳지 않는가 ──
        await c.eval(OLD_ON);
        let ok13 = true;
        const det13 = [];
        for (let i = 1; i <= 5; i++) {
            const before = (await list()).filter(TIPDOC).map((t) => t.id);
            await c.eval(CLICK("attr"));
            await sleep(2200);
            const fresh = (await list()).filter(TIPDOC).filter((t) => before.indexOf(t.id) < 0);
            for (const w of fresh) { try { await fetch(HOST + "/json/close/" + w.id); } catch (e) { } }
            await sleep(700);
            const busy = await c.eval(BUSY);
            const lock = await c.eval(LOCK);
            const good = fresh.length > 0 && busy !== "★남음" && lock !== "★잠김";
            if (!good) { ok13 = false; }
            det13.push(i + "회:창" + fresh.length + "/대기" + busy + "/잠금" + lock);
        }
        R.push(["HLP13", ok13, det13.join(" ")]);
        console.log("[HLP13]", ok13 ? "OK" : "FAIL", det13.join(" "));

        // ── HLP16 : 닫은 뒤 단축키 잠금이 풀려 있는가 ──
        const lockAfter = await c.eval(LOCK);
        const busyAfter = await c.eval(BUSY);
        const ok16 = lockAfter !== "★잠김" && busyAfter !== "★남음";
        R.push(["HLP16", ok16, "단축키잠금=" + lockAfter + " · 대기표시=" + busyAfter + " (되돌리기 키는 실제로 누르지 않음)"]);
        console.log("[HLP16]", ok16 ? "OK" : "FAIL", "잠금=" + lockAfter, "대기=" + busyAfter);

        // ── HLP15 : 폭 줄여 ⋯ 안으로 접힌 상태에서도 되는가 ──
        oBounds = JSON.parse(await c.eval("JSON.stringify(parent.REMOTE.getCurrentWindow().getBounds())"));
        await c.eval([
            "(function(){ var w = parent.REMOTE.getCurrentWindow(); var b = w.getBounds();",
            "  w.setBounds({ x: b.x, y: b.y, width: 900, height: b.height }); return 1; })()"
        ].join("\n"));
        await sleep(1800);

        const folded = await c.eval([
            "(function(){",
            "  var a = [].slice.call(document.querySelectorAll(\"button\"));",
            "  var q = a.filter(function(x){ return /fa-circle-question/.test(x.innerHTML) && !x.id; })[0];",
            "  return q ? (q.offsetParent ? \"아직보임\" : \"접힘\") : \"버튼없음\";",
            "})()"
        ].join("\n"));

        const beforeT = (await list()).filter(TIPDOC).map((t) => t.id);

        const menu = await c.eval([
            "(function(){",
            "  var bar = document.getElementById(\"ws20DesignTree\");",
            "  if (!bar) { return \"트리영역없음\"; }",
            "  var ovf = [].slice.call(bar.querySelectorAll(\"button\")).filter(function(b){ return /fa-ellipsis/.test(b.innerHTML); })[0];",
            "  if (!ovf) { return \"점세개버튼없음\"; }",
            "  if (!ovf.offsetParent) { return \"점세개안보임\"; }",
            "  ovf.click(); return \"점세개열음\";",
            "})()"
        ].join("\n"));
        await sleep(1000);

        const pick = await c.eval([
            "(function(){",
            "  var items = [].slice.call(document.querySelectorAll(\".u4a-menu [role=menuitem], .u4a-menu li, .u4a-menu button, .u4a-menu__item\"));",
            "  var hit = items.filter(function(x){ return (x.textContent || \"\").trim() === \"도움말\"; })[0];",
            "  if (!hit) { return \"메뉴항목없음(\" + items.length + \"개)\"; }",
            "  hit.click(); return \"항목누름\";",
            "})()"
        ].join("\n"));
        await sleep(3200);

        const freshT = (await list()).filter(TIPDOC).filter((t) => beforeT.indexOf(t.id) < 0);
        const busy15 = await c.eval(BUSY);
        const ok15 = freshT.length > 0 && busy15 !== "★남음";
        R.push(["HLP15", ok15, "물음표=" + folded + " · " + menu + " · " + pick + " · 창" + freshT.length + " · 대기" + busy15]);
        console.log("[HLP15]", ok15 ? "OK" : "FAIL", folded, menu, pick, "창" + freshT.length, "대기" + busy15);

    } finally {
        try { if (oBounds) { await c.eval("(function(){ parent.REMOTE.getCurrentWindow().setBounds(" + JSON.stringify(oBounds) + "); return 1; })()"); } } catch (e) { }
        try { await c.eval(OLD_OFF); } catch (e) { }
        const n = await closeAll();
        console.log("\n[정리] 도움말 창 " + n + "개 닫음 · 창크기 복원 · 구버전흉내 끔");
        try { console.log("[최종] 대기표시=" + (await c.eval(BUSY)) + " · 단축키잠금=" + (await c.eval(LOCK))); } catch (e) { }
    }

    console.log("\n===== 결과 =====");
    let all = true;
    for (const row of R) {
        if (!row[1]) { all = false; }
        console.log((row[1] ? "OK  " : "FAIL") + "  " + row[0] + "  " + row[2]);
    }
    console.log(all ? "\n전체 통과" : "\n실패 있음");
    c.close();
    process.exit(all ? 0 : 1);

})().catch((e) => { console.log("오류:", e.message); process.exit(1); });
