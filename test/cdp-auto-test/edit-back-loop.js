// test/cdp-auto-test/edit-back-loop.js
'use strict';

const path = require('path');
const readline = require('readline');
const {
    listTargets, pickMainWindows, evalOnPage, parseKeySpec, openSession, isWindowAlive
} = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');

const ARGV = process.argv.slice(2);

function getArg(sName, sDefault) {

    const iAt = ARGV.indexOf(sName);

    if (iAt < 0) {
        return sDefault;
    }

    return ARGV[iAt + 1];

}

// --help / -h 는 아무것도 실행하지 않고 쓰는 법만 찍고 끝낸다.
// (로그 파일도 만들지 않는다 — 로그 폴더가 --help 만으로 지저분해지지 않게)
if (ARGV.indexOf('--help') >= 0 || ARGV.indexOf('-h') >= 0) {
    console.log(`
[사용법]
  node edit-back-loop.js [옵션]

  이미 켜져 있고 로그인까지 끝난 앱에 붙어서, WS10 화면인 창을 모두 찾아
  각 창마다 따로 단축키를 계속 눌러 봅니다.
  (지금 화면이 WS10 이면 편집진입 키, WS20 이면 뒤로가기 키)
  멈추려면 Ctrl+C.

[옵션]
  --port <번호>        앱의 원격디버그 포트 번호.            (기본 9222)
  --editKey <키>       WS10 에서 누를 편집진입 키.            (기본 F6)
  --backKey <키>       WS20 에서 누를 뒤로가기 키.            (기본 F3)
  --intervalMs <밀리초> 키를 누르는 간격.                      (기본 100 = 0.1초)
  --busyStuckMs <밀리초> 화면이 이 시간 넘게 계속 "처리중" 이면
                       멈춘 걸로 보고 전체 종료.              (기본 60000 = 1분)
  --help, -h           이 도움말만 보여주고 끝냄.

  키 이름은 F1~F12 / Escape / Enter / Tab / Backspace / 영문자 / 숫자 를 쓸 수 있고,
  ctrl+e 처럼 보정키(ctrl·alt·shift·meta)를 + 로 붙여 쓸 수 있습니다.

[예시]
  node edit-back-loop.js
  node edit-back-loop.js --intervalMs 50
  node edit-back-loop.js --port 9333 --editKey F6 --backKey F3

[로그]
  logs 폴더에 두 개가 쌓입니다.
   - run_날짜_시각.log         : 사람이 읽는 진행 기록
   - run_날짜_시각_errors.jsonl : 오류 원문(분석용, 한 줄에 한 건)
`);
    process.exit(0);
}

const PORT = getArg('--port', '9222');
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
// 실측 확정값(소스 근거: ws_html5_ws20.js "F3": _ws20Back / 원본 ws_common.js KEY:"F3" [WS20] Back Button,
// ws10_html.js F6 편집진입). --editKey/--backKey로 필요시 교체 가능.
const EDIT_KEY = getArg('--editKey', 'F6');
const BACK_KEY = getArg('--backKey', 'F3');
// 사람이 단축키를 연타하는 상황을 그대로 재현한다 — 이 간격으로 계속 누른다.
// 누를 키는 그때그때 현재 화면만 보고 정한다(WS10이면 편집진입, WS20이면 뒤로가기).
// busy 는 누를지 말지를 정하는 데 쓰지 않는다 — busy 가 켜져 있어도 계속 누른다.
// 다만 busy 가 이 시간 넘게 계속 켜진 채면 화면이 멈춘 걸로 보고 전체를 종료한다(감시용).
const PRESS_INTERVAL_MS = Number(getArg('--intervalMs', '100'));
const BUSY_STUCK_MS = Number(getArg('--busyStuckMs', '60000'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logger = createLogger(path.join(__dirname, 'logs'));

// 모든 창이 함께 보는 정지 신호 — Ctrl+C 한 번으로 창 전부에 전달된다.
let running = true;
process.on('SIGINT', () => {
    logger.info('중지 요청(Ctrl+C) 받음 — 각 창은 이번 사이클까지만 마치고 종료.');
    running = false;
});

// 메시지박스/확인창/값도움 같은 "진짜 창"이 떠 있는지만 본다.
//   ★busy 표시(<dialog id="u4aWsBusyIndicator">)는 제외한다 — 이것도 <dialog> 라서 그냥
//     세면 busy 켜질 때마다 창이 뜬 걸로 잘못 보고 멈춰버린다. 앱 자기 코드도 다이얼로그를
//     훑을 때 이 id 는 건너뛴다(www/ws30/resources/index.js:213).
//   그래서 앱의 fnCheckIsDialogOpen(busy 포함) 대신 여기서 직접 걸러 본다.
const DIALOG_SELECTOR = ".sapMDialogOpen, dialog[open]:not(#u4aWsBusyIndicator):not(.u4aWsBusyIndicator)";

// ★한 바퀴에 필요한 걸 한 번에 물어본다 — 지금 화면 / 처리중인지 / 창이 떠 있는지.
//   전에는 이걸 따로따로 물어봐서 왕복이 늘어났고, 그만큼 누르는 간격이 벌어졌다.
const STATE_EXPRESSION = `
(function () {

    var d = document.querySelector(${JSON.stringify(DIALOG_SELECTOR)});

    // 지금 이 화면에 실제로 걸려 있는 단축키 목록.
    // ★키를 눌러도 아무 반응이 없을 때, 앱이 그 키를 아예 안 듣고 있는 건지 알아야 한다.
    //   (실측 2026-09-08: WS20 화면인데 뒤로가기 키가 목록에 없던 순간이 있었다.)
    var keys = null;

    try {
        keys = Object.keys(oAPP.attr.oShortcut.all_shortcuts);
    } catch (e) {
        keys = null;
    }

    return JSON.stringify({
        page      : window.getCurrPage ? getCurrPage() : '',
        busy      : window.getBusy ? getBusy() : '',
        dialog    : !!d,
        dialogText: d ? (d.innerText || '').slice(0, 2000) : '',
        keys      : keys
    });

})()
`;

// 창이 아직 목록에 있는지는 매번 확인할 필요가 없다(확인 자체가 느려서 연타를 방해한다).
// 연결이 끊기면 바로 알 수 있고, 이 횟수마다 한 번씩만 목록으로 다시 확인한다.
const ALIVE_CHECK_EVERY = 50;

// 창 하나를 맡아 독립적으로 무제한 반복한다. 이 창이 크래시로 끝나도 다른 창의 반복에는 영향 없다.
async function runWindowLoop(page, label) {
    let cycleNo = 0;
    let busySince = null;   // busy가 연속으로 켜져 있기 시작한 시각(안 켜져 있으면 null)
    let lastPressAt = null; // 직전에 키를 누른 시각 — 실제 간격을 로그에 찍기 위해
    let listeningWas = null; // 직전 바퀴에 앱이 그 키를 듣고 있었는지(바뀌는 순간만 자세히 남기려고)

    // 연결을 한 번만 열어 계속 쓴다. 오류 감시(콘솔오류·스크립트오류)도 이 연결로 같이 받는다.
    // 사람이 읽는 줄과 별개로, 원인 분석에 필요한 원문(스택·파일·줄번호 등)을 통째로
    // 별도 파일(run_*_errors.jsonl)에 한 줄 JSON 으로 남긴다.
    const session = await openSession(page, {
        onConsoleError: (text, raw) => {
            logger.error(`${label} [콘솔오류] ${text}`);
            logger.errorDetail({
                kind: 'consoleError',
                window: label,
                windowTitle: page.title,
                windowId: page.id,
                cycleNo,
                summary: text,
                cdpEvent: raw
            });
        },
        onScriptError: (text, raw) => {
            logger.error(`${label} [스크립트오류] ${text}`);
            logger.errorDetail({
                kind: 'scriptError',
                window: label,
                windowTitle: page.title,
                windowId: page.id,
                cycleNo,
                summary: text,
                cdpEvent: raw
            });
        }
    });

    // 키 이름 풀이는 한 번만 해 두고 계속 쓴다(반복 안에서 매번 풀 필요가 없다).
    const editSpec = parseKeySpec(EDIT_KEY);
    const backSpec = parseKeySpec(BACK_KEY);

    try {
        while (running) {
            cycleNo++;
            const cycleStart = Date.now();

            try {
                if (session.isClosed()) {
                    logger.error(`${label} [화면크래시] 연결이 끊겼다 — 사이클 ${cycleNo}. 이 창의 반복을 종료한다.`);
                    logger.errorDetail({
                        kind: 'windowGone',
                        window: label,
                        windowTitle: page.title,
                        windowId: page.id,
                        cycleNo,
                        summary: '창과의 연결이 끊김(화면 크래시 또는 창 닫힘)'
                    });
                    break;
                }

                // 창 목록으로 다시 확인하는 건 느리므로 가끔만 한다(연결 끊김은 위에서 이미 잡는다).
                if (cycleNo % ALIVE_CHECK_EVERY === 0) {
                    const alive = await isWindowAlive(DEBUG_HOST, page.id);
                    if (!alive) {
                        logger.error(`${label} [화면크래시] 창이 사라졌다 — 사이클 ${cycleNo}. 이 창의 반복을 종료한다.`);
                        logger.errorDetail({
                            kind: 'windowGone',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            cycleNo,
                            summary: '창이 목록에서 사라짐(화면 크래시 또는 창 닫힘)'
                        });
                        break;
                    }
                }

                // ★한 번의 왕복으로 지금 화면·처리중 여부·떠 있는 창을 통째로 받아온다.
                const state = JSON.parse(await session.eval(STATE_EXPRESSION));
                const currPage = state.page;
                const busy = state.busy;

                // 메시지박스/다이얼로그가 떠 있으면 단축키가 앱 쪽에서 막히므로 그 자리서 중지
                if (state.dialog) {
                    logger.error(`${label} 사이클 ${cycleNo}: 메시지박스/다이얼로그가 떠 있음 — 자동화를 멈춘다.`);
                    logger.errorDetail({
                        kind: 'dialogOpen',
                        window: label,
                        cycleNo,
                        summary: '메시지박스/다이얼로그가 떠 있어 단축키가 막힘',
                        dialogText: state.dialogText
                    });
                    process.exit(1);
                }

                // busy 감시(누르는 건 막지 않음) — 계속 켜진 채 제한 시간을 넘기면 화면 멈춤으로 보고 종료.
                if (busy === 'X') {
                    if (busySince === null) {
                        busySince = Date.now();
                    } else if (Date.now() - busySince >= BUSY_STUCK_MS) {
                        const stuckMs = Date.now() - busySince;
                        logger.error(`${label} 사이클 ${cycleNo}: busy가 ${stuckMs}ms 동안 계속 켜져 있음 — 화면 멈춤으로 보고 전체 종료.`);
                        logger.errorDetail({
                            kind: 'busyStuck',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            cycleNo,
                            stuckMs,
                            limitMs: BUSY_STUCK_MS,
                            currPage,
                            summary: 'busy 가 제한 시간 넘게 계속 켜져 있음(화면 멈춤 의심)'
                        });
                        process.exit(1);
                    }
                } else {
                    busySince = null;
                }

                // ★누를지 말지는 오로지 지금 화면만 보고 정한다 — busy 는 여기에 관여 안 한다.
                //   WS10이면 편집진입, WS20이면 뒤로가기. 사람이 연타하는 상황 그대로.
                if (currPage === 'WS10' || currPage === 'WS20') {
                    const isEdit = (currPage === 'WS10');
                    const keyName = isEdit ? EDIT_KEY : BACK_KEY;

                    // 이 키를 앱이 지금 듣고 있는지 확인한다. 안 듣고 있으면 눌러도 아무 일이 안 생기고
                    // 앱 쪽 로그도 안 남는다 — 이 사실 자체가 중요한 증거라 따로 남긴다.
                    const listening = Array.isArray(state.keys)
                        ? state.keys.indexOf(keyName.toLowerCase()) >= 0
                        : null;

                    await session.dispatchKey(isEdit ? editSpec : backSpec);

                    const now = Date.now();
                    const gap = lastPressAt === null ? 0 : now - lastPressAt;
                    lastPressAt = now;

                    const what = isEdit ? `WS10 → 편집진입(${EDIT_KEY})` : `WS20 → 뒤로가기(${BACK_KEY})`;
                    const mark = (listening === false) ? ' ※앱이 이 키를 안 듣고 있음' : '';
                    logger.info(`${label} 사이클 ${cycleNo}: ${what} 누름 (직전 누름과 ${gap}ms 차)${mark}`);

                    // 안 듣는 상태로 바뀌는 그 순간에만 자세히 남긴다(매 바퀴 남기면 파일만 커진다).
                    if (listening === false && listeningWas !== false) {
                        logger.error(`${label} 사이클 ${cycleNo}: ${currPage} 화면인데 ${keyName} 가 앱에 안 걸려 있다 — 눌러도 아무 일도 안 일어난다.`);
                        logger.errorDetail({
                            kind: 'shortcutNotRegistered',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            cycleNo,
                            currPage,
                            wantKey: keyName,
                            registeredKeys: state.keys,
                            busy,
                            summary: '지금 화면에 필요한 단축키가 앱에 걸려 있지 않음'
                        });
                    }
                    listeningWas = listening;
                } else {
                    logger.error(`${label} 사이클 ${cycleNo}: WS10도 WS20도 아닌 화면(${currPage || '(알수없음)'}) — 이번 사이클은 안 누름`);
                }
            } catch (e) {
                logger.error(`${label} 사이클 ${cycleNo} 중 자동화 스크립트 예외: ${e && e.stack ? e.stack : e}`);
                logger.errorDetail({
                    kind: 'driverException',
                    window: label,
                    windowTitle: page.title,
                    windowId: page.id,
                    cycleNo,
                    summary: e && e.message ? e.message : String(e),
                    stack: e && e.stack ? e.stack : null
                });
            }

            // 한 바퀴에 쓴 시간을 빼고 남은 만큼만 쉰다 — 그래야 실제 간격이 정한 값에 맞는다.
            // (이미 정한 시간보다 오래 걸렸으면 안 쉬고 바로 다음 바퀴로 간다.)
            const spent = Date.now() - cycleStart;
            if (spent < PRESS_INTERVAL_MS) {
                await wait(PRESS_INTERVAL_MS - spent);
            }
        }
    } finally {
        session.close();
        logger.info(`${label} 종료.`);
    }
}

function askConfirm(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(/^y(es)?$/i.test(answer.trim()));
        });
    });
}

async function main() {
    logger.info(`대상 찾는 중... (${DEBUG_HOST})`);
    const list = await listTargets(DEBUG_HOST);

    if (!list) {
        logger.error('CDP에 붙지 못했다 — 대상 PC에서 앱이 원격디버그 포트를 켠 채로 실행 중인지 확인.');
        process.exit(1);
    }

    const pages = pickMainWindows(list);
    if (pages.length === 0) {
        logger.error('#Main 창을 못 찾았다 — 로그인까지 되어 있는지 확인.');
        process.exit(1);
    }

    // WS10인 창만 골라 그 개수를 사람에게 먼저 확인받고, y일 때만 그 창들로 시작한다.
    const ws10Pages = [];
    for (const page of pages) {
        const currPage = await evalOnPage(page, "window.getCurrPage ? getCurrPage() : ''");
        if (currPage === 'WS10') {
            ws10Pages.push(page);
        }
    }

    if (ws10Pages.length === 0) {
        logger.error('WS10 화면이 하나도 없어 시작할 수 없다 — WS10으로 이동해 두고 다시 실행할 것.');
        process.exit(1);
    }

    const proceed = await askConfirm(`현재 WS10 화면 갯수가 ${ws10Pages.length}개입니다. 진행할까요? (y/n) `);

    if (!proceed) {
        logger.info('사용자가 진행을 취소했다.');
        process.exit(0);
    }

    logger.info(`대상 찾음: ${ws10Pages.length}개 창(WS10) / 편집키=${EDIT_KEY} 뒤로가기키=${BACK_KEY} / 누르는 간격=${PRESS_INTERVAL_MS}ms`);
    logger.info(`오류 원문 로그: ${logger.errorFilePath}`);

    await Promise.all(ws10Pages.map((page, i) => runWindowLoop(page, `[창${i + 1}]`)));

    logger.info('모든 창의 반복이 끝났다.');
}

main().catch((e) => {
    logger.error(`실행 중 처리 안 된 예외: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
