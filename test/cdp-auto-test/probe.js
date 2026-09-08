'use strict';

const path = require('path');
const { listTargets, pickMainWindow, evalOnPage, dispatchKey, parseKeySpec } = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');

const ARGV = process.argv.slice(2);
const getArg = (k, def) => { const i = ARGV.indexOf(k); return i >= 0 ? ARGV[i + 1] : def; };

// --help / -h 는 아무것도 실행하지 않고 쓰는 법만 찍고 끝낸다.
if (ARGV.indexOf('--help') >= 0 || ARGV.indexOf('-h') >= 0) {
    console.log(`
[사용법]
  node probe.js [옵션]

  이미 켜져 있는 앱에 한 번만 붙어서 지금 상태를 찍어 봅니다.
  (찾은 창 이름 / 지금 화면이 어디인지 / 앱 정보)
  --key 를 주면 그 키를 한 번 눌러 보고, 1초 뒤 화면이 바뀌었는지도 보여줍니다.

[옵션]
  --port <번호>   앱의 원격디버그 포트 번호.        (기본 9222)
  --key <키>      한 번 눌러 볼 키. 안 주면 안 누름.  (예: F6)
  --help, -h      이 도움말만 보여주고 끝냄.

  키 이름은 F1~F12 / Escape / Enter / Tab / Backspace / 영문자 / 숫자 를 쓸 수 있고,
  ctrl+e 처럼 보정키(ctrl·alt·shift·meta)를 + 로 붙여 쓸 수 있습니다.

[예시]
  node probe.js
  node probe.js --key F6
  node probe.js --port 9333 --key F3

[로그]
  logs 폴더의 run_날짜_시각.log 에도 같은 내용이 쌓입니다.
`);
    process.exit(0);
}

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
