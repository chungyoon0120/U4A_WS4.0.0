'use strict';

const path = require('path');
const {
    listTargets, pickMainWindow, evalOnPage, dispatchKey, parseKeySpec, describeSocketMaker
} = require('./lib/cdp-client');
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
    // ★맨 먼저 "창에 붙을 수단이 있는지"부터 본다. (장군님 지적 2026-09-10 "다른 pc 에서 실행하자마자 오류")
    //   없으면 창마다 알 수 없는 오류를 뱉다가 엉뚱한 문구로 끝나 원인이 안 보였다.
    const oSock = describeSocketMaker();

    if (!oSock.ok) {
        logger.error('cannot start - no way to attach to a window.');
        logger.error(String(oSock.reason));
        process.exitCode = 1;
        return;
    }

    logger.info(`창에 붙는 수단: ${oSock.from} (노드 ${oSock.node})`);

    logger.info(`looking for CDP targets... (${DEBUG_HOST})`);
    const list = await listTargets(DEBUG_HOST);

    if (!list) {
        logger.error('could not attach to CDP - check that the app is running with the remote debugging port open.');
        process.exit(1);
    }

    const page = pickMainWindow(list);
    if (!page) {
        logger.error('#Main 창을 못 찾았다 — 로그인까지 되어 있는지 확인.');
        process.exit(1);
    }

    logger.info(`target found: ${page.title} (id=${page.id})`);

    const currPage = await evalOnPage(page, 'window.getCurrPage ? getCurrPage() : "(getCurrPage not defined)"');
    const appInfo = await evalOnPage(page, 'window.getAppInfo ? JSON.stringify(getAppInfo()) : "(getAppInfo 없음)"');
    logger.info(`getCurrPage() = ${currPage}`);
    logger.info(`getAppInfo() = ${appInfo}`);

    if (TRY_KEY) {
        const spec = parseKeySpec(TRY_KEY);
        logger.info(`키 발사: ${TRY_KEY} → ${JSON.stringify(spec)}`);
        await dispatchKey(page, spec);
        await new Promise((r) => setTimeout(r, 1000));

        const after = await evalOnPage(page, 'window.getCurrPage ? getCurrPage() : "(getCurrPage not defined)"');
        logger.info(`getCurrPage() after dispatch = ${after}`);
    } else {
        logger.info('to dispatch a key, pass --key (e.g. --key F6) and run again.');
    }
}

main().catch((e) => {
    logger.error(`probe threw: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
