// test/cdp-auto-test/edit-back-loop.js
'use strict';

const path = require('path');
const {
    listTargets, pickMainWindow, evalOnPage, dispatchKey, parseKeySpec, watchErrors, isWindowAlive
} = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');

const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };

const PORT = getArg('--port', '9222');
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
// 잠정값 — probe.js 실측으로 확정 전까지의 기본값. --editKey/--backKey로 바로 교체 가능.
const EDIT_KEY = getArg('--editKey', 'F6');
const BACK_KEY = getArg('--backKey', 'Escape');
const POLL_MS = 300;
const EDIT_TIMEOUT_MS = 20000;
const BACK_TIMEOUT_MS = 20000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const logger = createLogger(path.join(__dirname, 'logs'));

let running = true;
process.on('SIGINT', () => {
    logger.info('중지 요청(Ctrl+C) 받음 — 이번 사이클까지만 마치고 종료.');
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

async function runCycle(page, cycleNo) {
    logger.info(`--- 사이클 ${cycleNo} 시작 ---`);

    await dispatchKey(page, parseKeySpec(EDIT_KEY));
    const entered = await waitUntil(page, "window.getCurrPage && getCurrPage()==='WS20'", EDIT_TIMEOUT_MS);

    if (!entered) {
        logger.error(`사이클 ${cycleNo}: 편집모드 진입 실패(시간초과) — 키=${EDIT_KEY}`);
        return false;
    }

    logger.info(`사이클 ${cycleNo}: 편집모드 진입 확인(WS20)`);

    await dispatchKey(page, parseKeySpec(BACK_KEY));
    const backOk = await waitUntil(page, "window.getCurrPage && getCurrPage()==='WS10'", BACK_TIMEOUT_MS);

    if (!backOk) {
        logger.error(`사이클 ${cycleNo}: 뒤로가기 실패(시간초과) — 키=${BACK_KEY}`);
        return false;
    }

    logger.info(`사이클 ${cycleNo}: WS10 복귀 확인 — 성공`);
    return true;
}

async function main() {
    logger.info(`대상 찾는 중... (${DEBUG_HOST})`);
    const list = await listTargets(DEBUG_HOST);

    if (!list) {
        logger.error('CDP에 붙지 못했다 — 대상 PC에서 앱이 원격디버그 포트를 켠 채로 실행 중인지 확인.');
        process.exit(1);
    }

    const page = pickMainWindow(list);
    if (!page) {
        logger.error('#Main 창을 못 찾았다 — 로그인까지 되어 있는지 확인.');
        process.exit(1);
    }

    logger.info(`대상 찾음: ${page.title} (id=${page.id}) / 편집키=${EDIT_KEY} 뒤로가기키=${BACK_KEY}`);

    const watcher = await watchErrors(page, {
        onConsoleError: (text) => logger.error(`[콘솔오류] ${text}`),
        onScriptError: (text) => logger.error(`[스크립트오류] ${text}`)
    });

    let cycleNo = 0;

    try {
        while (running) {
            cycleNo++;

            const alive = await isWindowAlive(DEBUG_HOST, page.id);
            if (!alive) {
                logger.error(`[화면크래시] 대상 창이 사라졌다 — 사이클 ${cycleNo} 시작 전. 반복을 종료한다.`);
                break;
            }

            try {
                await runCycle(page, cycleNo);
            } catch (e) {
                logger.error(`사이클 ${cycleNo} 중 자동화 스크립트 예외: ${e && e.stack ? e.stack : e}`);
            }
        }
    } finally {
        watcher.close();
        logger.info('종료.');
    }
}

main().catch((e) => {
    logger.error(`실행 중 처리 안 된 예외: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
