'use strict';

async function listTargets(debugHost) {
    try {
        const res = await fetch(`${debugHost}/json/list`);
        return await res.json();
    } catch (e) {
        return null;
    }
}

function pickMainWindow(list) {
    if (!Array.isArray(list)) {
        return null;
    }
    const found = list.find((x) => x && x.type === 'page' && /#Main/.test(x.title || ''));
    return found || null;
}

function pickMainWindows(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.filter((x) => x && x.type === 'page' && /#Main/.test(x.title || ''));
}

const WebSocket = require('ws');

// CDP 요청 하나가 응답 없이 이 시간을 넘기면 실패로 처리한다.
// 원래는 응답을 기다리는 Promise에 시간제한이 없어서, 응답이 영영 안 오면(창이 멈췄거나
// 소켓이 끊겼거나) 호출부가 20초 waitUntil 안에서도 영원히 멈춰 있었다(실측으로 확인됨).
const REQUEST_TIMEOUT_MS = 10000;

// CDP 요청 하나를 보내고 응답을 기다리는 함수를 만든다 — evalOnPage/dispatchKey가 공유.
// 응답이 오면 resolve, 시간초과·소켓끊김·소켓오류면 reject한다(전엔 셋 다 무한대기였다).
function _createRequestSender(ws, timeoutMs) {
    let id = 0;

    return (m) => new Promise((resolve, reject) => {
        const myId = ++id;
        let settled = false;

        const cleanup = () => {
            ws.off('message', onMessage);
            ws.off('close', onClose);
            ws.off('error', onError);
            clearTimeout(timer);
        };

        const onMessage = (data) => {
            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch (e) {
                return; // 이 요청과 무관한 손상된 메시지 — 무시하고 계속 기다린다.
            }
            if (parsed.id === myId) {
                settled = true;
                cleanup();
                resolve(parsed);
            }
        };

        const onClose = () => {
            if (settled) { return; }
            settled = true;
            cleanup();
            reject(new Error(`CDP 연결이 응답 전에 닫혔다: ${m.method}`));
        };

        const onError = (err) => {
            if (settled) { return; }
            settled = true;
            cleanup();
            reject(err);
        };

        const timer = setTimeout(() => {
            if (settled) { return; }
            settled = true;
            cleanup();
            reject(new Error(`CDP 요청 시간초과(${timeoutMs}ms): ${m.method}`));
        }, timeoutMs);

        ws.on('message', onMessage);
        ws.on('close', onClose);
        ws.on('error', onError);
        ws.send(JSON.stringify({ id: myId, ...m }));
    });
}

// CDP Input.dispatchKeyEvent 의 modifiers 비트: Alt=1, Ctrl=2, Meta/Cmd=4, Shift=8
const _MODIFIER_BITS = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

const _KEY_TABLE = {
    escape: { key: 'Escape', code: 'Escape', vk: 27 },
    enter: { key: 'Enter', code: 'Enter', vk: 13 },
    tab: { key: 'Tab', code: 'Tab', vk: 9 },
    backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
    f1: { key: 'F1', code: 'F1', vk: 112 }, f2: { key: 'F2', code: 'F2', vk: 113 },
    f3: { key: 'F3', code: 'F3', vk: 114 }, f4: { key: 'F4', code: 'F4', vk: 115 },
    f5: { key: 'F5', code: 'F5', vk: 116 }, f6: { key: 'F6', code: 'F6', vk: 117 },
    f7: { key: 'F7', code: 'F7', vk: 118 }, f8: { key: 'F8', code: 'F8', vk: 119 },
    f9: { key: 'F9', code: 'F9', vk: 120 }, f10: { key: 'F10', code: 'F10', vk: 121 },
    f11: { key: 'F11', code: 'F11', vk: 122 }, f12: { key: 'F12', code: 'F12', vk: 123 }
};

function _letterOrDigit(sChar) {
    const c = sChar.toUpperCase();
    if (/^[A-Z]$/.test(c)) {
        return { key: sChar, code: `Key${c}`, vk: c.charCodeAt(0) };
    }
    if (/^[0-9]$/.test(c)) {
        return { key: sChar, code: `Digit${c}`, vk: c.charCodeAt(0) };
    }
    return null;
}

// "F6" | "Escape" | "ctrl+e" 같은 문자열을 CDP 키 이벤트 파라미터로 바꾼다.
function parseKeySpec(text) {
    const parts = String(text).split('+').map((s) => s.trim());
    const mainPart = parts[parts.length - 1];
    const modParts = parts.slice(0, -1);

    let modifiers = 0;
    modParts.forEach((m) => {
        const bit = _MODIFIER_BITS[m.toLowerCase()];
        if (!bit) {
            throw new Error(`알 수 없는 보정키: ${m}`);
        }
        modifiers |= bit;
    });

    const lower = mainPart.toLowerCase();
    const found = _KEY_TABLE[lower] || _letterOrDigit(mainPart);

    if (!found) {
        throw new Error(`지원하지 않는 키: ${mainPart}`);
    }

    return {
        key: found.key,
        code: found.code,
        windowsVirtualKeyCode: found.vk,
        modifiers
    };
}

async function evalOnPage(page, expression) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    const send = _createRequestSender(ws, REQUEST_TIMEOUT_MS);

    await send({ method: 'Runtime.enable' });
    const result = await send({ method: 'Runtime.evaluate', params: { expression, returnByValue: true } });
    ws.close();

    if (result.result && result.result.exceptionDetails) {
        throw new Error('eval exception: ' + JSON.stringify(result.result.exceptionDetails));
    }

    return result.result && result.result.result ? result.result.result.value : undefined;
}

// 키 발사 방식(장군님 지시 2026-09-08로 교체):
//   전에는 CDP Input.dispatchKeyEvent 로 직접 쐈으나, 장군님이 개발자 콘솔에서
//   executeJavaScript 방식이 실제로 먹히는 걸 확인해 이 방식으로 바꾼다.
//   흐름: CDP eval → 그 창 안에서 @electron/remote 로 자기 webContents 를 잡고
//         → executeJavaScript 로 keydown 이벤트를 화면에 던진다.
//   (앱이 nodeIntegration/remote 를 켜둔 상태라 가능 — electron/main.js:131,474)
function _keyExpression(keySpec) {
    const eventInit = {
        key: keySpec.key,
        code: keySpec.code,
        keyCode: keySpec.windowsVirtualKeyCode,
        which: keySpec.windowsVirtualKeyCode,
        bubbles: true,
        altKey: (keySpec.modifiers & 1) !== 0,
        ctrlKey: (keySpec.modifiers & 2) !== 0,
        metaKey: (keySpec.modifiers & 4) !== 0,
        shiftKey: (keySpec.modifiers & 8) !== 0
    };

    // 화면 안에서 실제로 돌 스크립트(문자열) — 따옴표 꼬임 없게 JSON 으로 감싼다.
    const innerScript = `document.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify(eventInit)})); 'ok';`;

    return `
(function () {
    var remote = require('@electron/remote');
    var wc = remote.getCurrentWindow().webContents;
    wc.executeJavaScript(${JSON.stringify(innerScript)});
    return 'sent';
})()
`;
}

async function dispatchKey(page, keySpec) {
    await evalOnPage(page, _keyExpression(keySpec));
}

function classifyConsoleEntry(params) {
    const isError = params && params.type === 'error';
    const text = ((params && params.args) || [])
        .map((a) => (a && (a.value || a.description)) || '')
        .filter(Boolean)
        .join(' ');
    return { isError, text: text || '(내용 없음)' };
}

function describeException(params) {
    const details = (params && params.exceptionDetails) || {};
    const desc = details.exception && details.exception.description;
    return desc || details.text || '(알 수 없는 예외)';
}

async function watchErrors(page, handlers) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return;
        }

        // 두 번째 인자로 CDP 원본 이벤트를 그대로 넘긴다 — 스택·파일·줄번호까지 다 들어있어
        // 나중에 로그 파일에서 원인 분석할 때 필요하다(요약 문구만으론 분석이 안 된다).
        if (msg.method === 'Runtime.consoleAPICalled') {
            const { isError, text } = classifyConsoleEntry(msg.params);
            if (isError) {
                handlers.onConsoleError(text, msg.params);
            }
        } else if (msg.method === 'Runtime.exceptionThrown') {
            handlers.onScriptError(describeException(msg.params), msg.params);
        }
    });

    let id = 0;
    const send = (m) => {
        const myId = ++id;
        ws.send(JSON.stringify({ id: myId, ...m }));
    };

    send({ method: 'Runtime.enable' });

    return {
        close: () => ws.close()
    };
}

// ★창 하나에 연결 하나를 열어 계속 쓴다(세션) — 장군님 지적 2026-09-08.
//   전에는 화면 물어보기·키 누르기를 할 때마다 연결을 새로 열고 닫아서, 한 바퀴에 연결을
//   4개씩 여닫느라 실제 간격이 0.1초를 훨씬 넘겼다(연타가 안 됨).
//   이제는 연결을 한 번만 열어 두고 계속 재사용한다 — 한 바퀴에 왕복 2번이면 끝난다.
//   오류 감시(콘솔오류·스크립트오류)도 이 연결 하나로 같이 받는다.
async function openSession(page, handlers) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        const onOpen = () => { ws.off('error', onErr); resolve(); };
        const onErr = (e) => { ws.off('open', onOpen); reject(e); };
        ws.once('open', onOpen);
        ws.once('error', onErr);
    });

    let closed = false;
    let closeReason = null;
    const pending = new Map();

    const failAll = (err) => {
        closed = true;
        closeReason = err;
        pending.forEach((entry) => {
            clearTimeout(entry.timer);
            entry.reject(err);
        });
        pending.clear();
    };

    ws.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch (e) {
            return; // 손상된 메시지 — 이 요청과 무관하므로 무시.
        }

        if (msg.id !== undefined && pending.has(msg.id)) {
            const entry = pending.get(msg.id);
            pending.delete(msg.id);
            clearTimeout(entry.timer);
            entry.resolve(msg);
            return;
        }

        if (!handlers) {
            return;
        }

        // 두 번째 인자로 원본 이벤트를 그대로 넘긴다 — 스택·파일·줄번호까지 들어 있어야 분석이 된다.
        if (msg.method === 'Runtime.consoleAPICalled') {
            const entry = classifyConsoleEntry(msg.params);
            if (entry.isError && handlers.onConsoleError) {
                handlers.onConsoleError(entry.text, msg.params);
            }
        } else if (msg.method === 'Runtime.exceptionThrown' && handlers.onScriptError) {
            handlers.onScriptError(describeException(msg.params), msg.params);
        }
    });

    ws.on('close', () => failAll(new Error('CDP 연결이 닫혔다 — 창이 닫혔거나 앱이 죽었을 수 있다.')));
    ws.on('error', (e) => failAll(e));

    let id = 0;

    function send(method, params) {
        if (closed) {
            return Promise.reject(closeReason || new Error('CDP 연결이 이미 닫혀 있다.'));
        }
        return new Promise((resolve, reject) => {
            const myId = ++id;
            const timer = setTimeout(() => {
                pending.delete(myId);
                reject(new Error(`CDP 요청 시간초과(${REQUEST_TIMEOUT_MS}ms): ${method}`));
            }, REQUEST_TIMEOUT_MS);

            pending.set(myId, { resolve, reject, timer });

            try {
                ws.send(JSON.stringify({ id: myId, method, params }));
            } catch (e) {
                pending.delete(myId);
                clearTimeout(timer);
                reject(e);
            }
        });
    }

    await send('Runtime.enable');

    async function evaluate(expression) {
        const res = await send('Runtime.evaluate', { expression, returnByValue: true });
        if (res.result && res.result.exceptionDetails) {
            throw new Error('eval exception: ' + JSON.stringify(res.result.exceptionDetails));
        }
        return res.result && res.result.result ? res.result.result.value : undefined;
    }

    // 화면을 그림으로 찍는다 — 고장 났을 때 "어떻게 보였는지" 증거를 남기려고.
    //   Page.enable 은 한 번만 해 두면 되고, 실패해도 캡처는 대체로 동작하므로 조용히 넘긴다.
    let pageEnabled = false;

    async function captureScreenshot() {

        if (!pageEnabled) {
            try {
                await send('Page.enable');
                pageEnabled = true;
            } catch (e) {
                // 캡처 자체는 될 수 있으니 여기서 포기하지 않는다.
            }
        }

        const res = await send('Page.captureScreenshot', { format: 'png' });

        if (!res.result || !res.result.data) {
            throw new Error('화면 캡처 결과가 비어 있다.');
        }

        return Buffer.from(res.result.data, 'base64');

    }

    return {
        isClosed: () => closed,
        eval: evaluate,
        dispatchKey: (keySpec) => evaluate(_keyExpression(keySpec)),
        captureScreenshot,
        close: () => {
            closed = true;
            try { ws.close(); } catch (e) { /* 이미 닫힌 연결 — 더 할 일 없음 */ }
        }
    };
}

async function isWindowAlive(debugHost, targetId) {
    const list = await listTargets(debugHost);
    if (!list) {
        return false;
    }
    return list.some((x) => x.id === targetId);
}

module.exports = {
    listTargets,
    pickMainWindow,
    pickMainWindows,
    parseKeySpec,
    evalOnPage,
    dispatchKey,
    openSession,
    classifyConsoleEntry,
    describeException,
    watchErrors,
    isWindowAlive
};
