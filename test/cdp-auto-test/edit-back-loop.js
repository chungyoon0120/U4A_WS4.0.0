// test/cdp-auto-test/edit-back-loop.js
'use strict';

const path = require('path');
const readline = require('readline');
const {
    listTargets, pickMainWindows, evalOnPage, parseKeySpec, openSession, isWindowAlive,
    describeSocketMaker
} = require('./lib/cdp-client');
const { createLogger } = require('./lib/logger');
const { saveIncident, KIND_NAMES } = require('./lib/incident');
const { notifyIncident } = require('./lib/notify');
const { loadConfig } = require('./env');

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
  --busyStuckMs <밀리초> busy 가 이 시간 넘게 안 꺼지면
                       화면이 잠긴 걸로 보고 전체 stopped.       (기본 300000 = 5분)
  --cdpTimeoutMs <밀리초> 앱에 물어보고 답을 기다리는 시간.  (기본 300000 = 5분)
  --quietMissing <횟수> 화면이 다 그려졌는데 단축키가 안 걸려 있는 상태가
                       연달아 이만큼 이어지면 고장으로 본다.    (기본 10바퀴)
  --keepGoing          오류가 나도 멈추지 않고 계속 돈다.
                       (기본은 처음 오류에서 멈춤)
  --help, -h           이 도움말만 보여주고 끝냄.

  키 이름은 F1~F12 / Escape / Enter / Tab / Backspace / 영문자 / 숫자 를 쓸 수 있고,
  ctrl+e 처럼 보정키(ctrl·alt·shift·meta)를 + 로 붙여 쓸 수 있습니다.

[예시]
  node edit-back-loop.js
  node edit-back-loop.js --intervalMs 50
  node edit-back-loop.js --port 9333 --editKey F6 --backKey F3

[건드리지 않는 창]
  핀(항상 위 고정)을 걸어 둔 창은 시험 대상에서 뺍니다.
  보고 계신 창을 지키기 위해서입니다. 그 창도 시험하려면 압정 단추를 꺼 두십시오.

[오류가 나면]
  처음 터진 것 하나만 붙잡고 멈춥니다. 뒤따라오는 오류는 대개 뒷북이라,
  다 담으면 정작 원인이 파묻히기 때문입니다. 멈출 때 소리로 한 번 알립니다.

  그 순간의 증거를 logs 폴더 안에 「사고_날짜_시각_종류」 폴더로 묶어 둡니다.
   - SUMMARY.md       : 무슨 일인지 · 몇  cycles in a row · 어느 화면이었는지  ← 이것부터 보세요
   - 화면.png      : 그 순간 화면 모습
   - log-tail.log  : log tail before the failure
   - 원문.json     : 오류 원문(stack까지)

[로그]
  logs 폴더에 사람이 읽는 진행 기록(run_날짜_시각.log)이 쌓입니다.
  오류 원문은 사고가 났을 때만 증거 폴더 안 「원문.json」 에 담깁니다.
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
// 다만 busy 가 이 시간 넘게 계속 켜진 채면 화면이 잠긴 걸로 보고 전체를 종료한다(감시용).
//   ★기본 5분 (장군님 지시 2026-09-09). 전에는 1분이었는데, 앱은 서버 응답을 최대 10분까지
//     기다리므로 느린 요청 하나만 있어도 아직 정상인데 도구가 먼저 포기했다.
const PRESS_INTERVAL_MS = Number(getArg('--intervalMs', '100'));
const BUSY_STUCK_MS = Number(getArg('--busyStuckMs', '300000'));

// 앱에 뭘 물어보고 답을 기다리는 시간. (장군님 지시 2026-09-09 — 10초에서 5분으로)
//   연타 중 앱이 무거운 일을 하면 10초 안에 못 돌아본다. 멀쩡한데 시간초과로 끝나면 안 된다.
const CDP_TIMEOUT_MS = Number(getArg('--cdpTimeoutMs', '300000'));

// 화면이 다 그려졌는데(넘어가는 중도 아니고 처리중도 아닌데) 단축키가 안 걸려 있는 바퀴가
// 연달아 이만큼 이어지면 고장으로 본다. (장군님 지적 2026-09-10)
//   ★시간이 아니라 "바퀴 수"로 센다 - 느린 PC 에서는 한 바퀴가 길어지므로 실제 기다리는 시간도
//     자연히 늘어난다. 시간으로 재면 사양에 따라 답이 달라져서 못 쓴다.
const QUIET_MISSING_LIMIT = Number(getArg('--quietMissing', '10'));

// ★처음 오류에서 멈춘다 (장군님 지시 2026-09-09).
//   0.1초마다 도는 시험이라, 한 번 고장 나면 뒤따라오는 오류가 수천 줄씩 쌓여
//   정작 "맨 처음 터진 곳"이 파묻힌다. 그래서 첫 오류에서 증거를 챙기고 멈춘다.
//   그래도 끝까지 돌려 보고 싶을 때만 --keepGoing 을 준다.
const KEEP_GOING = ARGV.indexOf('--keepGoing') >= 0;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 기록은 이 프로그램이 놓인 자리 옆 logs 폴더에 쌓는다.
//   ★한 덩어리 exe 로 굽던 갈래는 뺐다(장군님 지시 2026-09-10 "bat 파일로 해").
//     bat 은 이 파일을 그대로 돌리므로 파일이 놓인 자리가 곧 프로그램 자리다.
const LOG_DIR = path.join(__dirname, 'logs');
const logger = createLogger(LOG_DIR);

// 바깥으로 알릴 곳(텔레그램·노션) 설정 — env/config.json.
// 설정이 없어도 도구는 그냥 돈다. 안 보낼 뿐이다.
const ENV = loadConfig();

if (ENV.error) {
    logger.error(`could not read the notify config - notifications are disabled: ${ENV.error}`);
}

// 모든 창이 함께 보는 정지 신호 — Ctrl+C 한 번으로 창 전부에 전달된다.
let running = true;
process.on('SIGINT', () => {
    logger.info('stop requested (Ctrl+C) - each window will finish the current cycle, then stop.');
    running = false;
});

/* ═══════════════════════════════════════════════════════════════════
 * 사고(오류) 처리 — 처음 하나만 붙잡고 멈춘다 (장군님 지시 2026-09-09)
 * ═══════════════════════════════════════════════════════════════════
 * 뒤따라오는 오류는 대부분 첫 고장의 뒷북이라, 다 담으면 정작 원인이 파묻힌다.
 * 그래서 첫 사고에서만 증거를 챙기고(화면 캡처·직전 기록·오류 원문) 전체를 멈춘다.
 */
let incidentTaken = false;   // 이미 사고 하나를 붙잡았나
let incidentPromise = null;  // 증거 담기 + 알림까지 다 끝날 때까지 기다릴 약속

// ★증거 담기(화면 그림 찍기)만 따로 기다릴 약속. (실측 2026-09-10)
//   전에는 사진을 다 찍기도 전에 반복 돌리던 쪽이 창과의 연결을 끊어서,
//   찍던 사진이 중간에 끊기고 「화면 캡처 실패: WebSocket 오류」 만 남았다.
//   이제 연결을 닫기 전에 이것부터 기다린다.
let incidentSavePromise = null;
let incidentDir = null;      // 증거를 담은 폴더
let incidentInfo = null;     // 무슨 사고였는지(끝에 요약할 때 쓴다)

function fireIncident(session, info) {

    if (incidentTaken) {
        return;
    }

    incidentTaken = true;
    incidentInfo = info;

    // 소리로 한 번 알린다 — 자리를 비워 둬도 알아챌 수 있게.
    try {
        process.stdout.write('');
    } catch (e) {
        // 소리를 못 내는 환경이어도 그것 때문에 멈추면 안 된다.
    }

    // 알림 글에 같이 담을 "log tail before the failure"은 지금 이 순간 것을 써야 한다
    // (증거를 담는 동안에도 기록은 계속 쌓이므로 여기서 한 번 떠 둔다).
    const aRecent = logger.getRecent();
    const sKindName = KIND_NAMES[info.kind] || info.kind || 'unknown incident';

    const oSaving = saveIncident({
        logDir: LOG_DIR,
        info,
        recentLines: aRecent,
        errorDetails: logger.getErrorDetails(),
        session
    });

    // 연결을 닫기 전에 이것부터 기다리게 한다(사진이 끊기지 않도록).
    //   여기서 터져도 흐름이 멈추면 안 되므로 따로 받아 둔다 — 진짜 처리는 아래 chain 에서 한다.
    incidentSavePromise = oSaving.catch(() => null);

    incidentPromise = oSaving.then((sDir) => {

        incidentDir = sDir;
        logger.error(`incident evidence saved -> ${sDir}`);
        return sDir;

    }).catch((e) => {

        logger.error(`failed while saving incident evidence: ${e && e.stack ? e.stack : e}`);
        return null;

    }).then((sDir) => {

        // 증거를 담은 뒤에 알린다 — 화면 그림도 같이 보내려면 폴더가 먼저 있어야 한다.
        return notifyIncident({
            config: ENV.config,
            info,
            kindName: sKindName,
            incidentDir: sDir,
            recentLines: aRecent
        });

    }).then((aResults) => {

        (aResults || []).forEach((r) => {

            if (r.skipped) {
                logger.info(`notify skipped (${r.where}) — ${r.error}`);
                return;
            }

            if (r.ok) {
                logger.info(`notify sent (${r.where})${r.url ? ` → ${r.url}` : ''}`);
                return;
            }

            logger.error(`notify failed (${r.where}) — ${r.error}`);

        });

        return incidentDir;

    }).catch((e) => {

        // 알림이 통째로 터져도 시험 결과는 남아야 한다.
        logger.error(`notify threw: ${e && e.stack ? e.stack : e}`);
        return incidentDir;

    });

    if (KEEP_GOING) {
        logger.error('★ 첫 오류를 붙잡았다. --keepGoing 이라 계속 돈다(이후 오류는 기록만).');
        return;
    }

    logger.error('★ 첫 오류에서 멈춘다. 끝까지 돌려 보려면 --keepGoing 을 붙일 것.');
    running = false;

}

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

    // 그 창이 지금 다루고 있는 앱 이름 — 창이 여러 개일 때 어느 창인지 가려내는 단서.
    var appId = '';

    try {
        var a = window.getAppInfo ? getAppInfo() : null;
        appId = (a && (a.APPID || a.appId || a.APP_ID)) || '';
    } catch (e) {
        appId = '';
    }

    // 앱이 "지금 화면 넘어가는 중"이라고 스스로 켜 두는 표시.
    //   앱 자신도 이걸 보고 단축키를 막는다(ws_common.js fnShortCutExeAvaliableCheck).
    //   도구도 같은 기준을 써야 "넘어가는 중이라 잠깐 없는 것"을 고장으로 잘못 보지 않는다.
    var moving = false;

    try {
        moving = (oAPP.attr.isNaviBusy === true);
    } catch (e) {
        moving = false;
    }

    return JSON.stringify({
        page      : window.getCurrPage ? getCurrPage() : '',
        busy      : window.getBusy ? getBusy() : '',
        moving    : moving,
        appId     : appId,
        dialog    : !!d,
        dialogText: d ? (d.innerText || '').slice(0, 2000) : '',
        keys      : keys
    });

})()
`;

// ★창을 고를 때 쓰는 물음 — 지금 화면과 "핀(항상 위 고정)" 여부를 같이 본다.
//   (장군님 지시 2026-09-09) 핀을 걸어 둔 창은 장군님이 보고 계신 창이므로 건드리면 안 된다.
//   두 가지를 다 본다:
//     ① 앱이 들고 있는 핀 값   (화면 위쪽 압정 단추 눌림 상태)
//     ② 창이 실제로 항상 위인지 (앱 값이 어긋나 있어도 실제 창 상태로 잡아낸다)
const PICK_EXPRESSION = `
(function () {

    var page = '';
    var pinModel = false;
    var pinWindow = false;

    try {
        page = window.getCurrPage ? getCurrPage() : '';
    } catch (e) {
        page = '';
    }

    try {
        pinModel = !!(window.oAPP && oAPP.common && oAPP.common.fnGetModelProperty
            && oAPP.common.fnGetModelProperty('/SETTING/ISPIN'));
    } catch (e) {
        pinModel = false;
    }

    try {
        var w = require('@electron/remote').getCurrentWindow();
        pinWindow = !!(w && w.isAlwaysOnTop && w.isAlwaysOnTop());
    } catch (e) {
        pinWindow = false;
    }

    return JSON.stringify({ page: page, pinned: (pinModel || pinWindow), pinModel: pinModel, pinWindow: pinWindow });

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
    let quietMissing = 0;    // 조용한 상태(넘어가는 중 아님)인데 단축키가 없는 바퀴가 몇 번 이어졌나

    // 오류가 터진 순간의 정황(어느 화면·처리중이었나·직전에 무슨 키를 눌렀나)을 같이 남기려고
    // 최근 값을 들고 있는다. 오류 알림은 반복문 밖(연결 쪽)에서도 오기 때문에 필요하다.
    let lastState = { page: '', busy: '', appId: '' };
    let lastKeyName = null;

    /**
     * 창을 나중에 봐도 가려낼 수 있게 한 줄로 만든다. (장군님 지적 2026-09-09)
     *   "[win1]" 만으로는 어느 창인지 알 수 없다 — 창 제목은 다 같고, 순번은 돌릴 때마다 바뀐다.
     *   그래서 창 번호(유일한 값)와, 그 창이 다루던 앱 이름을 같이 적는다.
     */
    function _windowDesc() {

        const aBits = [label];

        if (page.title) {
            aBits.push(page.title);
        }

        if (page.id) {
            aBits.push(`windowId ${page.id}`);
        }

        if (lastState.appId) {
            aBits.push(`app ${lastState.appId}`);
        }

        return aBits.join(' · ');

    }

    // 연결을 한 번만 열어 계속 쓴다. 오류 감시(콘솔오류·스크립트오류)도 이 연결로 같이 받는다.
    // 사람이 읽는 줄과 별개로, 원인 분석에 필요한 원문(스택·파일·줄번호 등)을 통째로
    // 들고 있다가, 사고가 나면 증거 폴더 안 「원문.json」 에 담는다.
    // ★연결을 만드는 도중에도 오류 알림이 먼저 날아온다 - 앱에 "이미 쌓여 있던" 지난 오류다.
    //   (실측 2026-09-09)
    //   ① 그때 아래 콜백이 session 을 건드리면 "아직 준비 안 됐다"며 도구가 터졌다.
    //   ② 게다가 그건 이번 시험에서 난 오류가 아닌데도 시작하자마자 멈춰 버렸다
    //      (0 cycles in a row · 화면도 모름 · 그림도 없음).
    //   그래서 연결이 다 준비될 때까지는 사고로 치지 않고, 지난 오류로만 적어 둔다.
    let session = null;
    let ready = false;

    session = await openSession(page, {
        onConsoleError: (text, raw) => {

            if (!ready) {
                logger.info(`${label} [pre-existing before attach - ignored] ${text}`);
                return;
            }

            logger.error(`${label} [CONSOLE ERROR] ${text}`);
            const info = {
                kind: 'consoleError',
                window: label,
                windowTitle: page.title,
                windowId: page.id,
                windowDesc: _windowDesc(),
                cycleNo,
                currPage: lastState.page,
                busy: lastState.busy,
                lastKey: lastKeyName,
                summary: text,
                cdpEvent: raw
            };
            logger.errorDetail(info);
            fireIncident(session, info);
        },
        onScriptError: (text, raw) => {

            if (!ready) {
                logger.info(`${label} [pre-existing before attach - ignored] ${text}`);
                return;
            }

            logger.error(`${label} [SCRIPT ERROR] ${text}`);
            const info = {
                kind: 'scriptError',
                window: label,
                windowTitle: page.title,
                windowId: page.id,
                windowDesc: _windowDesc(),
                cycleNo,
                currPage: lastState.page,
                busy: lastState.busy,
                lastKey: lastKeyName,
                summary: text,
                detail: { stack: raw && raw.exceptionDetails && raw.exceptionDetails.exception
                    ? raw.exceptionDetails.exception.description : null },
                cdpEvent: raw
            };
            logger.errorDetail(info);
            fireIncident(session, info);
        }
    }, CDP_TIMEOUT_MS);

    // 키 이름 풀이는 한 번만 해 두고 계속 쓴다(반복 안에서 매번 풀 필요가 없다).
    const editSpec = parseKeySpec(EDIT_KEY);
    const backSpec = parseKeySpec(BACK_KEY);

    // 밀려 있던 지난 오류가 다 지나갈 짬을 준 뒤에 감시를 시작한다.
    await wait(300);

    ready = true;

    try {
        while (running) {
            cycleNo++;
            const cycleStart = Date.now();

            try {
                if (session.isClosed()) {
                    logger.error(`${label} [RENDERER GONE] CDP connection closed - cycle ${cycleNo}. stopping this window.`);
                    const info = {
                        kind: 'windowGone',
                        window: label,
                        windowTitle: page.title,
                        windowId: page.id,
                        windowDesc: _windowDesc(),
                        cycleNo,
                        currPage: lastState.page,
                        busy: lastState.busy,
                        lastKey: lastKeyName,
                        summary: 'CDP connection closed (renderer crash or window closed)'
                    };
                    logger.errorDetail(info);
                    fireIncident(session, info);
                    break;
                }

                // 창 목록으로 다시 확인하는 건 느리므로 가끔만 한다(연결 끊김은 위에서 이미 잡는다).
                if (cycleNo % ALIVE_CHECK_EVERY === 0) {
                    const alive = await isWindowAlive(DEBUG_HOST, page.id);
                    if (!alive) {
                        logger.error(`${label} [RENDERER GONE] window disappeared from the target list - cycle ${cycleNo}. stopping this window.`);
                        const info = {
                            kind: 'windowGone',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            windowDesc: _windowDesc(),
                            cycleNo,
                            currPage: lastState.page,
                            busy: lastState.busy,
                            lastKey: lastKeyName,
                            summary: 'window gone from the CDP target list (renderer crash or window closed)'
                        };
                        logger.errorDetail(info);
                        fireIncident(session, info);
                        break;
                    }
                }

                // ★한 번의 왕복으로 지금 화면·처리중 여부·떠 있는 창을 통째로 받아온다.
                const state = JSON.parse(await session.eval(STATE_EXPRESSION));
                const currPage = state.page;
                const busy = state.busy;

                lastState = state;

                // 메시지박스/다이얼로그가 떠 있으면 단축키가 앱 쪽에서 막히므로 그 자리서 중지
                if (state.dialog) {
                    logger.error(`${label} cycle ${cycleNo}: a modal dialog is open - stopping automation.`);
                    const info = {
                        kind: 'dialogOpen',
                        window: label,
                        windowTitle: page.title,
                        windowId: page.id,
                        windowDesc: _windowDesc(),
                        cycleNo,
                        currPage,
                        busy,
                        lastKey: lastKeyName,
                        summary: 'a modal dialog is blocking the shortcut',
                        dialogText: state.dialogText
                    };
                    logger.errorDetail(info);
                    fireIncident(session, info);
                    break;
                }

                // busy 감시(누르는 건 막지 않음) — 계속 켜진 채 제한 시간을 넘기면 화면 멈춤으로 보고 stopped.
                if (busy === 'X') {
                    if (busySince === null) {
                        busySince = Date.now();
                    } else if (Date.now() - busySince >= BUSY_STUCK_MS) {
                        const stuckMs = Date.now() - busySince;
                        logger.error(`${label} cycle ${cycleNo}: busy has stayed on for ${stuckMs}ms - treating it as a hang, stopping everything.`);
                        const info = {
                            kind: 'busyStuck',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            windowDesc: _windowDesc(),
                            cycleNo,
                            stuckMs,
                            limitMs: BUSY_STUCK_MS,
                            currPage,
                            busy,
                            lastKey: lastKeyName,
                            summary: `busy stuck on for ${stuckMs}ms (suspected hang)`
                        };
                        logger.errorDetail(info);
                        fireIncident(session, info);
                        break;
                    }
                } else {
                    busySince = null;
                }

                // ★누를지 말지는 오로지 지금 화면만 보고 정한다 — busy 는 여기에 관여 안 한다.
                //   WS10이면 편집진입, WS20이면 뒤로가기. 사람이 연타하는 상황 그대로.
                if (currPage === 'WS10' || currPage === 'WS20') {
                    const isEdit = (currPage === 'WS10');
                    const keyName = isEdit ? EDIT_KEY : BACK_KEY;

                    /********************************************************************
                     * 이 키를 앱이 지금 듣고 있는지 본다. (판정 기준 고침 2026-09-10 — 장군님 지적)
                     * ------------------------------------------------------------------
                     * 화면마다 걸리는 단축키가 다르다. 그래서 화면을 넘어갈 때 앱은
                     *   ① 이전 화면 단축키를 떼고 → ② 서버 갔다 와서 → ③ 새 화면 단축키를 건다.
                     * 그 사이엔 아무것도 안 걸려 있는 게 당연하다.
                     * 도구는 0.1초마다 계속 누르므로 그 틈에 반드시 걸린다 — 이걸 고장으로 적으면
                     * 기록이 온통 헛것으로 도배된다(실측: 한 번 돌려 200줄 넘게 도배됨).
                     *
                     * ★그래서 시간으로 재지 않는다. 느린 PC 에서는 그 틈이 길어지므로
                     *   시간 기준은 사양에 따라 답이 달라진다.
                     *   대신 앱이 스스로 켜 두는 두 표시를 본다:
                     *     - busy   (처리중)
                     *     - moving (화면 넘어가는 중)
                     *   앱 자신도 이 둘을 보고 단축키를 막으므로, 켜져 있는 동안은
                     *   단축키가 걸려 있든 없든 어차피 실행되지 않는다 = 볼 필요가 없다.
                     *
                     * 판정:
                     *   busy 또는 moving 켜짐  → 넘어가는 중. 그냥 넘어간다(고장 아님)
                     *   둘 다 꺼짐 + 계속 없음 → 화면은 멀쩡한데 눌러도 안 먹는 상태 = 진짜 고장
                     *
                     * 한 바퀴 튀는 것은 넘기고, 조용한 상태로 연달아 이만큼 없을 때만 고장으로 본다.
                     * 바퀴 수로 세므로 느린 PC 에서는 그만큼 실제 시간도 길어진다.
                     ********************************************************************/
                    const listening = Array.isArray(state.keys)
                        ? state.keys.indexOf(keyName.toLowerCase()) >= 0
                        : null;

                    // 앱이 "지금 넘어가는 중"이라고 켜 둔 표시. 이때는 단축키가 없는 게 당연하다.
                    const bMoving = (busy === 'X') || (state.moving === true);

                    if (listening === false && !bMoving) {
                        quietMissing++;
                    } else {
                        quietMissing = 0;
                    }

                    await session.dispatchKey(isEdit ? editSpec : backSpec);

                    const now = Date.now();
                    const gap = lastPressAt === null ? 0 : now - lastPressAt;
                    lastPressAt = now;

                    lastKeyName = keyName;

                    const what = isEdit ? `WS10 -> enter edit (${EDIT_KEY})` : `WS20 -> back (${BACK_KEY})`;

                    // 넘어가는 중에 잠깐 없는 건 정상이라 아무 표시도 안 한다(기록 도배 방지).
                    const mark = (quietMissing > 0) ? '  <-- page is settled but this key is NOT registered' : '';
                    logger.info(`${label} cycle ${cycleNo}: ${what} dispatched (+${gap}ms since previous)${mark}`);

                    // 조용한 상태로 연달아 이만큼 없으면 그때 고장으로 본다. 그 순간 한 번만 남긴다.
                    if (quietMissing === QUIET_MISSING_LIMIT) {

                        logger.error(`${label} cycle ${cycleNo}: ${currPage} is settled but ${keyName} has been unregistered for ${QUIET_MISSING_LIMIT} cycles in a row - pressing it does nothing.`);

                        logger.errorDetail({
                            kind: 'shortcutNotRegistered',
                            window: label,
                            windowTitle: page.title,
                            windowId: page.id,
                            windowDesc: _windowDesc(),
                            cycleNo,
                            currPage,
                            wantKey: keyName,
                            registeredKeys: state.keys,
                            busy,
                            moving: state.moving,
                            quietCycles: quietMissing,
                            summary: `${keyName} still unregistered ${QUIET_MISSING_LIMIT} cycles after the page settled`
                        });

                    }

                    listeningWas = listening;
                } else {
                    logger.error(`${label} cycle ${cycleNo}: page is neither WS10 nor WS20 (${currPage || '(unknown)'}) - no key dispatched this cycle`);
                }
            } catch (e) {
                logger.error(`${label} cycle ${cycleNo} : automation script threw: ${e && e.stack ? e.stack : e}`);
                const info = {
                    kind: 'driverException',
                    window: label,
                    windowTitle: page.title,
                    windowId: page.id,
                    windowDesc: _windowDesc(),
                    cycleNo,
                    currPage: lastState.page,
                    busy: lastState.busy,
                    lastKey: lastKeyName,
                    summary: e && e.message ? e.message : String(e),
                    detail: { stack: e && e.stack ? e.stack : null }
                };
                logger.errorDetail(info);
                fireIncident(session, info);
            }

            // 한 바퀴에 쓴 시간을 빼고 남은 만큼만 쉰다 — 그래야 실제 간격이 정한 값에 맞는다.
            // (이미 정한 시간보다 오래 걸렸으면 안 쉬고 바로 다음 바퀴로 간다.)
            const spent = Date.now() - cycleStart;
            if (spent < PRESS_INTERVAL_MS) {
                await wait(PRESS_INTERVAL_MS - spent);
            }
        }
    } finally {

        // ★사고 증거(화면 그림)를 다 찍기 전에 연결을 끊으면 사진이 중간에 끊긴다(실측 2026-09-10).
        //   그래서 연결을 닫기 전에 증거 담기가 끝나기를 기다린다.
        if (incidentSavePromise) {
            logger.info(`${label} saving incident evidence - keeping the CDP connection open until it finishes.`);
            try {
                await incidentSavePromise;
            } catch (e) {
                logger.error(`${label} failed while waiting for evidence capture: ${e && e.message ? e.message : e}`);
            }
        }

        session.close();
        logger.info(`${label} stopped.`);
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

    const pages = pickMainWindows(list);
    if (pages.length === 0) {
        logger.error('#Main 창을 못 찾았다 — 로그인까지 되어 있는지 확인.');
        process.exit(1);
    }

    // WS10인 창만 골라 그 개수를 사람에게 먼저 확인받고, y일 때만 그 창들로 시작한다.
    //   ★핀(항상 위 고정)을 걸어 둔 창은 뺀다 — 장군님이 보고 계신 창이라 건드리면 안 된다.
    const ws10Pages = [];
    let iPinnedSkipped = 0;

    // ★못 붙은 창이 몇 개인지 따로 센다. (장군님 지적 2026-09-10)
    //   전에는 창마다 "못 읽어 건너뛴다" 만 찍고 넘어간 뒤,
    //   마지막에 「WS10 화면이 하나도 없다」 로 끝냈다. 붙지도 못한 것을
    //   화면 탓으로 돌린 셈이라, 진짜 원인(창에 못 붙음)이 안 보였다.
    const aFailed = [];

    for (const page of pages) {

        let oPick;

        try {
            oPick = JSON.parse(await evalOnPage(page, PICK_EXPRESSION));
        } catch (e) {
            const sWhy = e && e.message ? e.message : String(e);
            aFailed.push({ title: page.title, id: page.id, why: sWhy });
            logger.error(`could not attach (${page.title}, windowId ${page.id}): ${sWhy}`);
            continue;
        }

        if (oPick.pinned) {
            iPinnedSkipped++;
            logger.info(`skipping a pinned window - ${page.title} (windowId ${page.id})`);
            continue;
        }

        if (oPick.page === 'WS10') {
            ws10Pages.push(page);
        }

    }

    if (iPinnedSkipped > 0) {
        logger.info(`핀이 걸려 있어 뺀 창: ${iPinnedSkipped}개`);
    }

    // ★못 붙은 것이 먼저다 — 화면 탓으로 돌리기 전에 이것부터 말한다. (장군님 지적 2026-09-10)
    //   창에 붙지 못했으면 그 창이 무슨 화면인지 알 방법이 아예 없다.
    //   그런데도 "WS10 화면이 없다" 고 끝내면, 장군님이 엉뚱하게 화면을 옮겨 놓고 다시 돌리게 된다.
    if (aFailed.length > 0) {

        logger.error(`★ 창 ${aFailed.length}개에 붙지 못했다 — 무슨 화면인지 알 수조차 없다.`);

        aFailed.forEach((o) => {
            logger.error(`   · ${o.title} (windowId ${o.id}) : ${o.why}`);
        });

        if (ws10Pages.length === 0) {
            logger.error('   no window could be attached - fix the reasons above first.');
            process.exit(1);
        }

        logger.error('   continuing with the rest.');

    }

    if (ws10Pages.length === 0) {
        logger.error('no WS10 page found - navigate to WS10 first, then run again.');
        logger.error('  (pinned windows are excluded on purpose. turn the pin off to include them.)');
        process.exit(1);
    }

    const proceed = await askConfirm(`현재 WS10 화면 갯수가 ${ws10Pages.length}개입니다. 진행할까요? (y/n) `);

    if (!proceed) {
        logger.info('cancelled by the user.');
        process.exit(0);
    }

    logger.info(`대상 찾음: ${ws10Pages.length}개 창(WS10) / 편집키=${EDIT_KEY} 뒤로가기키=${BACK_KEY} / 누르는 간격=${PRESS_INTERVAL_MS}ms`);

    await Promise.all(ws10Pages.map((page, i) => runWindowLoop(page, `[win${i + 1}]`)));

    // 증거 담기가 아직 진행 중일 수 있다 — 다 담고 나서 끝낸다.
    if (incidentPromise) {
        await incidentPromise;
    }

    logger.info('');
    logger.info('══════════════ END ══════════════');

    if (!incidentTaken) {
        logger.info('finished with no incident (stopped with Ctrl+C, or all windows closed).');
        logger.info(`run log: ${logger.filePath}`);
        return;
    }

    logger.error(`왜 멈췄나 : ${incidentInfo && incidentInfo.summary ? incidentInfo.summary : '(unknown)'}`);
    logger.error(`어느 창   : ${incidentInfo && incidentInfo.window ? incidentInfo.window : '(unknown)'}`);
    logger.error(`몇  cycles in a row : ${incidentInfo && incidentInfo.cycleNo != null ? incidentInfo.cycleNo : '(unknown)'}`);
    logger.error(`그때 화면 : ${incidentInfo && incidentInfo.currPage ? incidentInfo.currPage : '(unknown)'}`);

    if (incidentDir) {
        logger.error('');
        logger.error(`★ 증거 폴더 : ${incidentDir}`);
        logger.error('   start with SUMMARY.md in that folder (screenshot, log tail and the raw error are all there).');
    }

    process.exitCode = 1;
}

main().catch((e) => {
    logger.error(`unhandled exception during the run: ${e && e.stack ? e.stack : e}`);
    process.exit(1);
});
