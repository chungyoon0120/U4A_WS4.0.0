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
