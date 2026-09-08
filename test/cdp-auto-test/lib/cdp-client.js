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

const WebSocket = require('ws');

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

    let id = 0;
    const send = (m) => new Promise((resolve) => {
        const myId = ++id;
        const handler = (data) => {
            const parsed = JSON.parse(data);
            if (parsed.id === myId) {
                ws.off('message', handler);
                resolve(parsed);
            }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: myId, ...m }));
    });

    await send({ method: 'Runtime.enable' });
    const result = await send({ method: 'Runtime.evaluate', params: { expression, returnByValue: true } });
    ws.close();

    if (result.result && result.result.exceptionDetails) {
        throw new Error('eval exception: ' + JSON.stringify(result.result.exceptionDetails));
    }

    return result.result && result.result.result ? result.result.result.value : undefined;
}

async function dispatchKey(page, keySpec) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    let id = 0;
    const send = (m) => new Promise((resolve) => {
        const myId = ++id;
        const handler = (data) => {
            const parsed = JSON.parse(data);
            if (parsed.id === myId) {
                ws.off('message', handler);
                resolve(parsed);
            }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: myId, ...m }));
    });

    const base = {
        key: keySpec.key,
        code: keySpec.code,
        windowsVirtualKeyCode: keySpec.windowsVirtualKeyCode,
        nativeVirtualKeyCode: keySpec.windowsVirtualKeyCode,
        modifiers: keySpec.modifiers
    };

    await send({ method: 'Input.dispatchKeyEvent', params: { type: 'rawKeyDown', ...base } });
    await send({ method: 'Input.dispatchKeyEvent', params: { type: 'keyUp', ...base } });

    ws.close();
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

        if (msg.method === 'Runtime.consoleAPICalled') {
            const { isError, text } = classifyConsoleEntry(msg.params);
            if (isError) {
                handlers.onConsoleError(text);
            }
        } else if (msg.method === 'Runtime.exceptionThrown') {
            handlers.onScriptError(describeException(msg.params));
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
    parseKeySpec,
    evalOnPage,
    dispatchKey,
    classifyConsoleEntry,
    describeException,
    watchErrors,
    isWindowAlive
};
