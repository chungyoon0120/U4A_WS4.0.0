# CDP 자동 반복 테스트 (WS10 편집모드 진입→뒤로가기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 실행·로그인되어 있는 U4A Workspace 화면에 CDP로 붙어, WS10 편집모드 진입→뒤로가기를
실제 키보드 단축키 이벤트로 무제한 반복시키고, 콘솔오류·스크립트오류·화면크래시를 cmd와 로그 파일에 남기는
자기완결형 Node 도구를 `test/cdp-auto-test/`에 만든다.

**Architecture:** 순수 로직(창 고르기·키 이벤트 파라미터 생성·오류 판별·로그 포맷)과 라이브 CDP 통신(웹소켓 연결·실제
키 발사·실제 화면 상태 읽기)을 분리한다. 순수 로직은 `node:test`로 단위 테스트하고, 라이브 통신은 실제 앱을 띄운
채로 수동 검증한다(이 프로젝트 기존 `.works/auto-test/login-smoke.js`와 동일한 검증 방식).

**Tech Stack:** Node.js(내장 `node:test`/`node:assert`/`fetch`), `ws`(CDP 웹소켓 통신, 이 프로젝트가 이미 쓰는
버전과 동일하게 고정). Electron·이 레포의 다른 코드에 대한 `require` 의존 없음(폴더 하나만 복사해 다른 PC에서
동작해야 하므로).

## Global Constraints

- `test/cdp-auto-test/` 폴더 하나만 복사해서 다른 PC에서 돌아가야 한다 — 이 폴더 밖의 프로젝트 파일을 `require`하지 않는다.
- 폴더 안 모든 경로 참조는 `__dirname` 기준 **상대경로**로만 한다.
- 대상 PC 준비: `npm install` 한 번 → `node edit-back-loop.js`. 앱 실행·로그인은 이 도구 책임 밖(이미 되어 있다고 가정).
- **★2026-09-08 정정**: 대상 창은 하나가 아니다. 실행 시점에 로그인·WS10 상태인 `#Main` 창이 **여러 개(개수
  고정 아님, 1~N개)** 떠 있을 수 있고, `edit-back-loop.js` 한 번 실행으로 **그 시점에 떠 있는 창을 전부 찾아
  창마다 독립적으로 동시에** 반복한다(Task 9·10). 실행 후 새로 뜨는 창은 대상에 넣지 않는다.
- 키 조작은 CDP `Input.dispatchKeyEvent`로 실제 키 이벤트를 발사한다(내부 함수 직접 호출 금지).
- 반복 횟수 제한 없음. 오류(콘솔오류/스크립트오류/자동화 스크립트 자체 예외)가 나도 반복은 계속하고 로그만 남긴다.
  단, 화면 크래시(대상 창이 사라짐)는 물리적으로 이어갈 수 없으므로 로그 남기고 종료한다.
- 텔레그램 등 외부 알림 없음 — cmd 콘솔 출력 + `logs/` 폴더 파일로만 남긴다.
- 참고 문서: [`docs/superpowers/specs/2026-09-08-cdp-auto-test-design.md`](../specs/2026-09-08-cdp-auto-test-design.md)

---

## File Structure

```
test/cdp-auto-test/
  package.json
  .gitignore              # logs/*.log 만 무시, 폴더는 유지
  logs/
    .gitkeep
  lib/
    logger.js              # 콘솔+파일 동시 로그
    logger.test.js
    cdp-client.js           # 창 찾기, 키 이벤트 발사, 화면 JS 평가, 오류 구독
    cdp-client.test.js
  probe.js                  # ① 실측용 정찰 스크립트
  edit-back-loop.js         # ② 무제한 반복 자동화 스크립트
```

---

### Task 1: 폴더 뼈대 + package.json

**Files:**
- Create: `test/cdp-auto-test/package.json`
- Create: `test/cdp-auto-test/.gitignore`
- Create: `test/cdp-auto-test/logs/.gitkeep`

**Interfaces:**
- Produces: `npm install`이 되는 `test/cdp-auto-test/` 폴더, `ws` 의존성 확보, `logs/` 폴더 존재 보장.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "cdp-auto-test",
  "version": "1.0.0",
  "private": true,
  "description": "U4A Workspace 실행 중 화면에 CDP로 붙어 단축키 반복 자동화 테스트",
  "main": "edit-back-loop.js",
  "scripts": {
    "probe": "node probe.js",
    "start": "node edit-back-loop.js",
    "test": "node --test lib/*.test.js"
  },
  "dependencies": {
    "ws": "^8.13.0"
  }
}
```

- [ ] **Step 2: .gitignore 작성**

```
logs/*.log
!logs/.gitkeep
node_modules/
```

- [ ] **Step 3: logs/.gitkeep 작성**

빈 파일로 생성(내용 없음) — 로그 폴더 자체는 git에 남기고 실제 로그 파일만 무시하기 위함.

- [ ] **Step 4: 설치 확인**

Run: `cd test/cdp-auto-test && npm install`
Expected: `node_modules/ws`가 생기고 오류 없이 끝난다.

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/package.json test/cdp-auto-test/.gitignore test/cdp-auto-test/logs/.gitkeep
git commit -m "[2026-09-08 00:00] cdp-auto-test 폴더 뼈대 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: lib/logger.js — 콘솔+파일 동시 로그

**Files:**
- Create: `test/cdp-auto-test/lib/logger.js`
- Test: `test/cdp-auto-test/lib/logger.test.js`

**Interfaces:**
- Consumes: 없음(최하위 모듈)
- Produces:
  - `formatLogLine(level: 'INFO'|'ERROR', message: string): string`
  - `createLogger(logDir: string): { info(msg: string): void, error(msg: string): void, filePath: string }`
  - 이후 모든 태스크가 `createLogger`로 만든 로거 인스턴스의 `.info()`/`.error()`만 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// test/cdp-auto-test/lib/logger.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { formatLogLine, createLogger } = require('./logger');

test('formatLogLine은 [시각] [레벨] 메시지 형태로 만든다', () => {
    const line = formatLogLine('INFO', '반복 1회차 시작');
    assert.match(line, /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] 반복 1회차 시작$/);
});

test('createLogger는 콘솔과 파일에 같은 내용을 남긴다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-log-'));
    const logger = createLogger(dir);

    logger.info('시작');
    logger.error('콘솔오류 발생: 테스트');

    const fileText = fs.readFileSync(logger.filePath, 'utf8');
    assert.match(fileText, /\[INFO\] 시작/);
    assert.match(fileText, /\[ERROR\] 콘솔오류 발생: 테스트/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd test/cdp-auto-test && node --test lib/logger.test.js`
Expected: FAIL — `Cannot find module './logger'`

- [ ] **Step 3: 최소 구현 작성**

```js
// test/cdp-auto-test/lib/logger.js
'use strict';

const fs = require('fs');
const path = require('path');

function formatLogLine(level, message) {
    const ts = new Date().toISOString();
    return `[${ts}] [${level}] ${message}`;
}

function _stamp() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_`
        + `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

function createLogger(logDir) {
    fs.mkdirSync(logDir, { recursive: true });
    const filePath = path.join(logDir, `run_${_stamp()}.log`);

    function write(level, message) {
        const line = formatLogLine(level, message);
        if (level === 'ERROR') {
            console.error(line);
        } else {
            console.log(line);
        }
        fs.appendFileSync(filePath, line + '\n', 'utf8');
    }

    return {
        info: (msg) => write('INFO', msg),
        error: (msg) => write('ERROR', msg),
        filePath
    };
}

module.exports = { formatLogLine, createLogger };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd test/cdp-auto-test && node --test lib/logger.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/lib/logger.js test/cdp-auto-test/lib/logger.test.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 콘솔+파일 동시 로거 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: lib/cdp-client.js part A — 대상 창 찾기

**Files:**
- Create: `test/cdp-auto-test/lib/cdp-client.js`
- Test: `test/cdp-auto-test/lib/cdp-client.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `pickMainWindow(list: Array<{type:string, title:string, webSocketDebuggerUrl:string, id:string}>): object|null`
  - `listTargets(debugHost: string): Promise<Array<object>|null>` (fetch 실패 시 null)
  - 이후 태스크가 `pickMainWindow`로 고른 대상 객체를 `page`로 부른다.

- [ ] **Step 1: 실패하는 테스트 작성 (pickMainWindow만, 순수함수)**

```js
// test/cdp-auto-test/lib/cdp-client.test.js
const test = require('node:test');
const assert = require('node:assert');
const { pickMainWindow } = require('./cdp-client');

test('pickMainWindow는 #Main 타이틀을 가진 page 타입만 고른다', () => {
    const list = [
        { type: 'page', title: 'U4A Workspace #ServerList', id: 'a' },
        { type: 'page', title: 'U4A Workspace #Main', id: 'b', webSocketDebuggerUrl: 'ws://x/b' },
        { type: 'iframe', title: 'U4A Workspace #Main', id: 'c' }
    ];

    const picked = pickMainWindow(list);
    assert.strictEqual(picked.id, 'b');
});

test('#Main이 없으면 null을 돌려준다', () => {
    const picked = pickMainWindow([{ type: 'page', title: 'U4A Workspace #ServerList', id: 'a' }]);
    assert.strictEqual(picked, null);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: FAIL — `Cannot find module './cdp-client'`

- [ ] **Step 3: 최소 구현 작성**

```js
// test/cdp-auto-test/lib/cdp-client.js
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

module.exports = {
    listTargets,
    pickMainWindow
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/lib/cdp-client.js test/cdp-auto-test/lib/cdp-client.test.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 대상 창(#Main) 찾기 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: lib/cdp-client.js part B — JS 평가 + 키 이벤트 발사

**Files:**
- Modify: `test/cdp-auto-test/lib/cdp-client.js`
- Modify: `test/cdp-auto-test/lib/cdp-client.test.js`

**Interfaces:**
- Consumes: Task 3의 `page` 객체(`webSocketDebuggerUrl` 보유)
- Produces:
  - `parseKeySpec(text: string): { key: string, code: string, windowsVirtualKeyCode: number, modifiers: number }`
    (예: `"F6"` → F6키, `"ctrl+e"` → Ctrl+E. 지원 키: F1~F12, Escape, Enter, Tab, Backspace, A~Z, 0~9)
  - `evalOnPage(page, expression: string): Promise<any>` (기존 `.works/auto-test/login-smoke.js`의
    `evalOnPage`와 동일한 방식 — `Runtime.enable` 후 `Runtime.evaluate`, 예외 시 throw)
  - `dispatchKey(page, keySpec): Promise<void>` (keyDown+keyUp 순서로 `Input.dispatchKeyEvent` 전송)
  - 이후 태스크가 `parseKeySpec('F6')` 같은 문자열을 상수로 넘겨 키를 특정한다.

- [ ] **Step 1: 실패하는 테스트 작성 (parseKeySpec만, 순수함수)**

```js
// test/cdp-auto-test/lib/cdp-client.test.js 에 추가
const { parseKeySpec } = require('./cdp-client');

test('parseKeySpec("F6")은 F6 키 하나를 만든다', () => {
    const spec = parseKeySpec('F6');
    assert.strictEqual(spec.key, 'F6');
    assert.strictEqual(spec.code, 'F6');
    assert.strictEqual(spec.windowsVirtualKeyCode, 117);
    assert.strictEqual(spec.modifiers, 0);
});

test('parseKeySpec("ctrl+e")은 Ctrl 보정비트를 포함한다', () => {
    const spec = parseKeySpec('ctrl+e');
    assert.strictEqual(spec.key, 'e');
    assert.strictEqual(spec.code, 'KeyE');
    assert.strictEqual(spec.windowsVirtualKeyCode, 69);
    assert.strictEqual(spec.modifiers, 2); // CDP 보정키 비트: Ctrl=2
});

test('parseKeySpec("Escape")은 Escape 키를 만든다', () => {
    const spec = parseKeySpec('Escape');
    assert.strictEqual(spec.code, 'Escape');
    assert.strictEqual(spec.windowsVirtualKeyCode, 27);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: FAIL — `parseKeySpec is not a function`

- [ ] **Step 3: 구현 작성**

```js
// test/cdp-auto-test/lib/cdp-client.js 에 추가
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

module.exports = {
    listTargets,
    pickMainWindow,
    parseKeySpec,
    evalOnPage,
    dispatchKey
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/lib/cdp-client.js test/cdp-auto-test/lib/cdp-client.test.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 키 이벤트 발사 + 화면 JS 평가 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: lib/cdp-client.js part C — 오류 감시(콘솔오류/스크립트오류/크래시)

**Files:**
- Modify: `test/cdp-auto-test/lib/cdp-client.js`
- Modify: `test/cdp-auto-test/lib/cdp-client.test.js`

**Interfaces:**
- Consumes: Task 3의 `page`, Task 3의 `listTargets`
- Produces:
  - `classifyConsoleEntry(params: {type: string, args: Array<{value?:string, description?:string}>}): {isError: boolean, text: string}`
  - `describeException(params: {exceptionDetails: {text:string, exception?:{description?:string}}}): string`
  - `watchErrors(page, handlers: {onConsoleError(text), onScriptError(text)}): Promise<{close(): void}>`
  - `isWindowAlive(debugHost, targetId): Promise<boolean>` (크래시 판정용 — `listTargets` 재사용)

- [ ] **Step 1: 실패하는 테스트 작성 (순수함수만)**

```js
// test/cdp-auto-test/lib/cdp-client.test.js 에 추가
const { classifyConsoleEntry, describeException } = require('./cdp-client');

test('classifyConsoleEntry는 type이 error일 때만 오류로 본다', () => {
    const errorEntry = classifyConsoleEntry({ type: 'error', args: [{ value: '문제 발생' }] });
    assert.strictEqual(errorEntry.isError, true);
    assert.match(errorEntry.text, /문제 발생/);

    const logEntry = classifyConsoleEntry({ type: 'log', args: [{ value: '그냥 로그' }] });
    assert.strictEqual(logEntry.isError, false);
});

test('describeException은 예외 문구를 사람이 읽을 문자열로 만든다', () => {
    const text = describeException({
        exceptionDetails: { text: 'Uncaught', exception: { description: 'TypeError: x is not a function' } }
    });
    assert.match(text, /TypeError: x is not a function/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: FAIL — `classifyConsoleEntry is not a function`

- [ ] **Step 3: 구현 작성**

```js
// test/cdp-auto-test/lib/cdp-client.js 에 추가

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
```

파일 끝의 `module.exports`를 다음으로 바꾼다:

```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/lib/cdp-client.js test/cdp-auto-test/lib/cdp-client.test.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 콘솔오류·스크립트오류·크래시 감시 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: probe.js — 실측용 정찰 스크립트

**Files:**
- Create: `test/cdp-auto-test/probe.js`

**Interfaces:**
- Consumes: `lib/cdp-client.js`의 `listTargets, pickMainWindow, evalOnPage, dispatchKey, parseKeySpec`,
  `lib/logger.js`의 `createLogger`
- Produces: 사람이 읽을 콘솔 출력(자동화 없음, 다음 태스크의 판정식·키 값을 정하는 재료)

이 태스크는 라이브 CDP 접속이 필수라 자동 테스트가 불가능하다 — **수동 검증**으로 대체한다.

- [ ] **Step 1: 스크립트 작성**

```js
// test/cdp-auto-test/probe.js
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
```

- [ ] **Step 2: 수동 검증 (실제 앱 대상)**

Run: `cd test/cdp-auto-test && node probe.js`
Expected: `getCurrPage()`·`getAppInfo()` 값이 실제로 찍힌다(WS10 화면이면 `WS10`).

Run: `cd test/cdp-auto-test && node probe.js --key F6`
Expected: F6 발사 후 `getCurrPage()`가 `WS20`으로 바뀌는지 확인 — 바뀌면 편집모드 진입 키 확정.
안 바뀌면 다른 후보 키로 `--key` 값을 바꿔가며 재실행(코드 수정 없이 인자만 바꿈).

- [ ] **Step 3: Commit**

```bash
git add test/cdp-auto-test/probe.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 실측용 정찰 스크립트 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: edit-back-loop.js — 무제한 반복 자동화

**Files:**
- Create: `test/cdp-auto-test/edit-back-loop.js`

**Interfaces:**
- Consumes: `lib/cdp-client.js`의 전체, `lib/logger.js`의 `createLogger`
- Produces: 실행형 CLI(`node edit-back-loop.js [--port 9222] [--editKey F6] [--backKey Escape]`)

이 태스크도 라이브 CDP 접속이 필수라 자동 테스트가 불가능하다 — **수동 검증**으로 대체한다.
`--editKey`/`--backKey` 기본값은 Task 6(probe.js)의 실측 결과로 확정되기 전까지 잠정값이며,
소스 수정 없이 CLI 인자로 바로 교체 가능하다.

- [ ] **Step 1: 스크립트 작성**

```js
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
```

- [ ] **Step 2: 수동 검증 (실제 앱 대상, Task 6에서 확정한 키로)**

Run: `cd test/cdp-auto-test && node edit-back-loop.js --editKey <확정된키> --backKey <확정된키>`
Expected: 사이클이 계속 성공하며 로그가 `logs/run_*.log`에 쌓인다. Ctrl+C로 멈추면 그 사이클까지만 마치고 종료.

Run: 대상 화면에서 일부러 오류를 내는 시나리오가 있다면 재현 — 콘솔오류/스크립트오류가 로그에 `[콘솔오류]`/`[스크립트오류]`로 남는지 확인.

- [ ] **Step 3: Commit**

```bash
git add test/cdp-auto-test/edit-back-loop.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: 무제한 반복 자동화 스크립트 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: README — 사용법 문서화

**Files:**
- Create: `test/cdp-auto-test/README.md`

**Interfaces:**
- Consumes: 없음(문서)
- Produces: 다른 PC로 폴더를 넘길 때 같이 보는 사용 설명서

- [ ] **Step 1: README 작성**

```markdown
# cdp-auto-test

U4A Workspace가 **이미 실행 중이고 로그인까지 끝난 상태**에서, WS10 편집모드 진입→뒤로가기를
실제 키보드 단축키를 누른 것처럼 CDP로 무제한 반복시키며 오류를 감시하는 도구.

## 준비물 (대상 PC)

1. U4A Workspace를 **원격 디버그 포트를 연 채로** 실행해 둔다(환경변수 `WS_REMOTE_DEBUG_HOST=http://127.0.0.1:9222`).
2. 로그인 후 WS10 화면까지 띄워 둔다.
3. 이 `cdp-auto-test` 폴더를 통째로 복사해 온다.

## 실행

\`\`\`bash
cd cdp-auto-test
npm install
\`\`\`

### ① 먼저 실측 (편집모드 진입 키가 처음이면 필수)

\`\`\`bash
node probe.js --key F6
\`\`\`

`발사 후 getCurrPage()` 값이 `WS20`으로 바뀌면 그 키가 맞다. 안 바뀌면 다른 후보로 `--key` 값만 바꿔 재실행.

### ② 반복 자동화 시작

\`\`\`bash
node edit-back-loop.js --editKey F6 --backKey Escape
\`\`\`

- 무제한 반복, Ctrl+C로 정지(그 사이클까지는 마치고 종료).
- 콘솔오류·스크립트오류·화면크래시·자동화 스크립트 자체 예외 — 전부 cmd 창과 `logs/run_*.log`에 남는다.
- 화면크래시(대상 창이 사라짐)가 나면 반복을 멈추고 종료한다(재시작 안 함).

## 이 도구가 하지 않는 것

- 앱 실행/재시작, 로그인 — 실행 전에 이미 되어 있어야 한다.
- 텔레그램 등 외부 알림 — cmd·로그 파일로만 남긴다.
- 크래시 후 자동 재시작.
```

- [ ] **Step 2: Commit**

```bash
git add test/cdp-auto-test/README.md
git commit -m "[2026-09-08 00:00] cdp-auto-test: 사용법 README 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## ★2026-09-08 정정 추가 태스크 (Task 9·10)

Task 1~8 완료 후 장군님 지시로 범위가 정정됐다: 대상 창은 하나(`#Main` 1개)가 아니라,
실행 시점에 로그인·WS10 상태로 떠 있는 `#Main` 창 **여러 개(1~N개, 실행마다 다를 수 있음)**를
전부 찾아 **창마다 독립적으로 동시에** 반복해야 한다. 아래 두 태스크로 기존 Task 3·7의
`pickMainWindow`(단수)·`edit-back-loop.js`(단일 창 전제)를 보강한다. `pickMainWindow`는
`probe.js`(1개 창 대상 정찰 전용, 계속 유효)가 그대로 쓰므로 건드리지 않는다 — 이번 정정은
**추가**이지 교체가 아니다.

### Task 9: lib/cdp-client.js part D — 여러 `#Main` 창 전부 찾기

**Files:**
- Modify: `test/cdp-auto-test/lib/cdp-client.js`
- Modify: `test/cdp-auto-test/lib/cdp-client.test.js`

**Interfaces:**
- Consumes: 없음(Task 3의 `pickMainWindow`와 나란히 존재하는 순수함수, 서로 독립)
- Produces: `pickMainWindows(list): Array<object>` — `type==='page'` 이고 제목에 `#Main`이 매치되는
  항목을 **전부** 골라 배열로 돌려준다(없으면 빈 배열). Task 10이 이 함수로 여러 창을 찾는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// test/cdp-auto-test/lib/cdp-client.test.js 에 추가
const { pickMainWindows } = require('./cdp-client');

test('pickMainWindows는 #Main 타이틀을 가진 page 타입을 전부 고른다', () => {
    const list = [
        { type: 'page', title: 'U4A Workspace #ServerList', id: 'a' },
        { type: 'page', title: 'U4A Workspace #Main', id: 'b' },
        { type: 'page', title: 'U4A Workspace #Main', id: 'c' },
        { type: 'iframe', title: 'U4A Workspace #Main', id: 'd' }
    ];

    const picked = pickMainWindows(list);
    assert.strictEqual(picked.length, 2);
    assert.deepStrictEqual(picked.map((p) => p.id), ['b', 'c']);
});

test('#Main이 없으면 빈 배열을 돌려준다', () => {
    const picked = pickMainWindows([{ type: 'page', title: 'U4A Workspace #ServerList', id: 'a' }]);
    assert.deepStrictEqual(picked, []);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: FAIL — `pickMainWindows is not a function`

- [ ] **Step 3: 구현 작성**

```js
// test/cdp-auto-test/lib/cdp-client.js 에 추가 (pickMainWindow 함수 근처)

function pickMainWindows(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.filter((x) => x && x.type === 'page' && /#Main/.test(x.title || ''));
}
```

파일 끝의 `module.exports`를 다음으로 바꾼다(기존 9개 + `pickMainWindows` 추가, 총 10개):

```js
module.exports = {
    listTargets,
    pickMainWindow,
    pickMainWindows,
    parseKeySpec,
    evalOnPage,
    dispatchKey,
    classifyConsoleEntry,
    describeException,
    watchErrors,
    isWindowAlive
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd test/cdp-auto-test && node --test lib/cdp-client.test.js`
Expected: PASS (9 tests: 기존 7 + 새 2)

- [ ] **Step 5: Commit**

```bash
git add test/cdp-auto-test/lib/cdp-client.js test/cdp-auto-test/lib/cdp-client.test.js
git commit -m "[2026-09-08 00:00] cdp-auto-test: #Main 창 여러 개 전부 찾기(pickMainWindows) 추가

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: edit-back-loop.js — 여러 창 동시 반복으로 재작성

**Files:**
- Modify: `test/cdp-auto-test/edit-back-loop.js` (전체 재작성 — 아래가 최종본)
- Modify: `test/cdp-auto-test/README.md` (다중 창 동작 설명 반영)

**Interfaces:**
- Consumes: Task 9의 `pickMainWindows(list)`, 기존 `listTargets, evalOnPage, dispatchKey, parseKeySpec,
  watchErrors, isWindowAlive`, `lib/logger.js`의 `createLogger`
- Produces: 실행형 CLI(`node edit-back-loop.js [--port 9222] [--editKey F6] [--backKey F3]`) —
  실행 시점에 떠 있는 `#Main` 창을 전부 찾아 창마다 독립된 무제한 반복을 동시에 시작한다.

이 태스크는 라이브 CDP 접속이 필수라 자동 테스트가 불가능하다 — **수동 검증**으로 대체한다.

- [ ] **Step 1: edit-back-loop.js 전체를 아래 내용으로 교체**

```js
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

            // isWindowAlive까지 같은 try 안에 둔다 — 여기서 뭔가 던져도 이 창 밖으로 새나가면
            // Promise.all이 통째로 거부되어 main()이 process.exit(1)로 전체 창을 죽인다.
            try {
                const alive = await isWindowAlive(DEBUG_HOST, page.id);
                if (!alive) {
                    logger.error(`${label} [화면크래시] 창이 사라졌다 — 사이클 ${cycleNo} 시작 전. 이 창의 반복을 종료한다.`);
                    break;
                }

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
```

- [ ] **Step 2: README.md의 "② 반복 자동화 시작" 절을 아래로 바꾼다**

```markdown
### ② 반복 자동화 시작

실행 시점에 로그인·WS10 상태로 떠 있는 `#Main` 창을 **전부 찾아 창마다 동시에** 반복한다
(1개~N개, 개수를 미리 정하지 않는다 — 몇 개 띄워놨든 그만큼 알아서 돈다). 실행 뒤에 새로 뜨는
창은 대상에 포함되지 않는다.

\`\`\`bash
node edit-back-loop.js --editKey F6 --backKey F3
\`\`\`

편집 진입은 **개발자 계정**으로 로그인한 상태에서만 단축키가 먹는다. WS10에서 편집할 앱을 미리
선택해 두고, 뜬 팝업은 닫아 둘 것 — 둘 다 아니면 단축키가 무시돼 매번 시간초과로 실패한다.

- 무제한 반복, Ctrl+C로 정지(모든 창이 각자 이번 사이클까지만 마치고 종료).
- 로그는 한 곳(cmd 창 + `logs/run_*.log`)에 같이 남기되 `[창1]`처럼 창 번호를 붙여 구분한다.
- 콘솔오류·스크립트오류·화면크래시·자동화 스크립트 자체 예외 — 전부 로그에 남는다.
- 화면크래시(그 창이 사라짐)가 나면 **그 창만** 반복을 멈추고 끝난다(다른 창은 계속 돈다, 재시작 안 함).
```

- [ ] **Step 3: 수동 검증 (실제 앱 대상, 창 여러 개 띄운 상태에서)**

Run: `cd test/cdp-auto-test && node edit-back-loop.js --editKey <확정된키> --backKey <확정된키>`
Expected: 로그에 `대상 찾음: N개 창`(N = 실제 띄운 개수)이 찍히고, `[창1]`·`[창2]`… 각자 사이클이
동시에 진행된다. 창 하나를 강제로 닫아보면 그 창만 `[화면크래시]` 로그 남기고 멈추고, 나머지 창은
계속 도는지 확인.

- [ ] **Step 4: Commit**

```bash
git add test/cdp-auto-test/edit-back-loop.js test/cdp-auto-test/README.md
git commit -m "[2026-09-08 00:00] cdp-auto-test: 여러 #Main 창 동시 반복 지원

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
