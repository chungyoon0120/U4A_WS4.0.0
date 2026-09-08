const test = require('node:test');
const assert = require('node:assert');
const { pickMainWindow, parseKeySpec } = require('./cdp-client');

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
