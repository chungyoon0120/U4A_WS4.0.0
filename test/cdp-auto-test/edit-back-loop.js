// test/cdp-auto-test/edit-back-loop.js
'use strict';

const path = require('path');
const {
    listTargets, pickMainWindows, evalOnPage, dispatchKey, parseKeySpec, watchErrors, isWindowAlive
} = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');

const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };

const PORT = getArg('--port', '9222');
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
// 실측 확정값(소스 근거: ws_html5_ws20.js "F3": _ws20Back / 원본 ws_common.js KEY:"F3" [WS20] Back Button,
// ws10_html.js F6 편집진입). --editKey/--backKey로 필요시 교체 가능.
const EDIT_KEY = getArg('--editKey', 'F6');
const BACK_KEY = getArg('--backKey', 'F3');
const POLL_MS = 300;
const EDIT_TIMEOUT_MS = 20000;
const BACK_TIMEOUT_MS = 20000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logger = createLogger(path.join(__dirname, 'logs'));

// 모든 창이 함께 보는 정지 신호 — Ctrl+C 한 번으로 창 전부에 전달된다.
let running = true;
process.on('SIGINT', () => {
    logger.info('중지 요청(Ctrl+C) 받음 — 각 창은 이번 사이클까지만 마치고 종료.');
    running = false;
});

async function waitUntil(page, expression, timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        const value = await evalOnPage(page, expression);
        if (value) {
            return true;
        }
        await wait(POLL_MS);
    }
    return false;
}

async function runCycle(page, label, cycleNo) {
    logger.info(`${label} 사이클 ${cycleNo} 시작`);

    // 이미 WS20에 있으면 편집키를 안 눌러도 다음 폴링에서 참이 되어 헛성공으로 잡힌다.
    // 그래서 WS10에서 시작하는지 먼저 확인하고, 아니면 이번 사이클은 건너뛴다.
    const onWs10 = await evalOnPage(page, "window.getCurrPage && getCurrPage()==='WS10'");
    if (!onWs10) {
        logger.error(`${label} 사이클 ${cycleNo}: WS10이 아닌 상태에서 시작됨 — 이번 사이클 건너뜀`);
        return false;
    }

    await dispatchKey(page, parseKeySpec(EDIT_KEY));
    const entered = await waitUntil(page, "window.getCurrPage && getCurrPage()==='WS20'", EDIT_TIMEOUT_MS);

    if (!entered) {
        logger.error(`${label} 사이클 ${cycleNo}: 편집모드 진입 실패(시간초과) — 키=${EDIT_KEY}`);
        return false;
    }

    logger.info(`${label} 사이클 ${cycleNo}: 편집모드 진입 확인(WS20)`);

    await dispatchKey(page, parseKeySpec(BACK_KEY));
    const backOk = await waitUntil(page, "window.getCurrPage && getCurrPage()==='WS10'", BACK_TIMEOUT_MS);

    if (!backOk) {
        logger.error(`${label} 사이클 ${cycleNo}: 뒤로가기 실패(시간초과) — 키=${BACK_KEY}`);
        return false;
    }

    logger.info(`${label} 사이클 ${cycleNo}: WS10 복귀 확인 — 성공`);
    return true;
}

// 창 하나를 맡아 독립적으로 무제한 반복한다. 이 창이 크래시로 끝나도 다른 창의 반복에는 영향 없다.
async function runWindowLoop(page, label) {
    const watcher = await watchErrors(page, {
        onConsoleError: (text) => logger.error(`${label} [콘솔오류] ${text}`),
        onScriptError: (text) => logger.error(`${label} [스크립트오류] ${text}`)
    });

    let cycleNo = 0;

    try {
        while (running) {
            cycleNo++;

            const alive = await isWindowAlive(DEBUG_HOST, page.id);
            if (!alive) {
                logger.error(`${label} [화면크래시] 창이 사라졌다 — 사이클 ${cycleNo} 시작 전. 이 창의 반복을 종료한다.`);
                break;
            }

            try {
                await runCycle(page, label, cycleNo);
            } catch (e) {
                logger.error(`${label} 사이클 ${cycleNo} 중 자동화 스크립트 예외: ${e && e.stack ? e.stack : e}`);
            }
        }
    } finally {
        watcher.close();
        logger.info(`${label} 종료.`);
    }
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

    logger.info(`대상 찾음: ${pages.length}개 창 / 편집키=${EDIT_KEY} 뒤로가기키=${BACK_KEY}`);

    await Promise.all(pages.map((page, i) => runWindowLoop(page, `[창${i + 1}]`)));

    logger.info('모든 창의 반복이 끝났다.');
}

main().catch((e) => {
    logger.error(`실행 중 처리 안 된 예외: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
