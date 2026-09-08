'use strict';

const path = require('path');
const { listTargets, pickMainWindow, evalOnPage, dispatchKey, parseKeySpec } = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');

const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };

const PORT = getArg('--port', '9222');
const DEBUG_HOST = `http://127.0.0.1:${PORT}`;
const TRY_KEY = getArg('--key', null); // 예: node probe.js --key F6

const logger = createLogger(path.join(__dirname, 'logs'));

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

    logger.info(`대상 찾음: ${page.title} (id=${page.id})`);

    const currPage = await evalOnPage(page, 'window.getCurrPage ? getCurrPage() : "(getCurrPage 없음)"');
    const appInfo = await evalOnPage(page, 'window.getAppInfo ? JSON.stringify(getAppInfo()) : "(getAppInfo 없음)"');
    logger.info(`getCurrPage() = ${currPage}`);
    logger.info(`getAppInfo() = ${appInfo}`);

    if (TRY_KEY) {
        const spec = parseKeySpec(TRY_KEY);
        logger.info(`키 발사: ${TRY_KEY} → ${JSON.stringify(spec)}`);
        await dispatchKey(page, spec);
        await new Promise((r) => setTimeout(r, 1000));

        const after = await evalOnPage(page, 'window.getCurrPage ? getCurrPage() : "(getCurrPage 없음)"');
        logger.info(`발사 후 getCurrPage() = ${after}`);
    } else {
        logger.info('키를 눌러보려면 --key F6 처럼 --key 인자를 주고 다시 실행.');
    }
}

main().catch((e) => {
    logger.error(`정찰 중 예외: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
