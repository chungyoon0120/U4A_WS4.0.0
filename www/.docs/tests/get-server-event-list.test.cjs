// Runs production source fragments with server/UI stubs. No live SAP requests.
// Run from any directory: node --test <absolute path to this file>
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const base = 'ws30/ws10_20/';
const read = file => fs.readFileSync(path.join(root, base, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function between(source, start, end, from = 0) {
  const a = source.indexOf(start, from);
  assert.ok(a >= 0, `Missing source start: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.ok(b >= 0, `Missing source end: ${end}`);
  return source.slice(a, b);
}
const implementations = {
  design: between(read('design/js/uiAttributeArea.js'),
    'oAPP.fn.getServerEventList = async function', '  };  //서버 이벤트 항목 검색.') + '};',
  html5: between(read('js/ws_html5_ws20_attr.js'),
    'oAPP.fn.getServerEventList = function', '        };  //서버 이벤트 항목 검색.') + '};'
};
const rows = [
  { EVTNM: 'EV_SEARCH', DESC: 'Search' },
  { EVTNM: 'EV_SAVE', DESC: 'Save' }
];
const expected = rows.map(r => ({ KEY: r.EVTNM, TEXT: r.EVTNM, DESC: r.DESC }));
function environment(implementation, mode = 'success', events = rows) {
  const trace = [];
  const context = vm.createContext({
    console,
    FormData: class { constructor() { this.fields = []; } append(...args) { this.fields.push(args); } },
    parent: { setBusy: value => trace.push(['busy', value]) },
    oAPP: {
      attr: { servNm: '/stub', appInfo: { CLSID: 'STUB_CLASS' } },
      fn: { designAreaLockUnlock: value => trace.push(['lock', value === true]) }
    },
    sendAjax(url, form, success, busy, async, method, failure) {
      assert.equal(url, '/stub/getServerEventList');
      assert.deepEqual(form.fields, [['CLSNM', 'STUB_CLASS']]);
      assert.equal(async, true);
      assert.equal(method, 'POST');
      trace.push(['request', busy]);
      queueMicrotask(() => {
        if (mode === 'transport') { failure(new Error('stub connection error')); }
        else { success({ RETCD: mode === 'business' ? 'E' : 'S', EVTLT: events }); }
      });
    }
  });
  vm.runInContext(implementations[implementation], context);
  return { context, trace, get: context.oAPP.fn.getServerEventList };
}

for (const implementation of Object.keys(implementations)) {
  test(`${implementation}: actual events returned for every successful callback/skip combination`, { timeout: 2000 }, async () => {
    for (const events of [[], rows.slice(0, 1), rows]) {
      for (const skip of [undefined, false, true]) {
        for (const withCallback of [false, true]) {
          const e = environment(implementation, 'success', events);
          let callbackValue;
          let calls = 0;
          const value = await e.get(withCallback ? list => {
            calls++;
            callbackValue = list;
            e.trace.push(['callback']);
          } : null, skip);
          assert.deepEqual(plain(value), expected.slice(0, events.length));
          assert.equal(calls, withCallback ? 1 : 0);
          if (withCallback) { assert.strictEqual(value, callbackValue); }
          const trace = [['lock', true], ['request', skip ? '' : 'X']];
          if (skip !== true) { trace.push(['busy', '']); }
          trace.push(['lock', true]);
          if (withCallback) { trace.push(['callback']); }
          if (skip !== true) { trace.push(['lock', false]); }
          assert.deepEqual(e.trace, trace);
        }
      }
    }
  });

  test(`${implementation}: failures do not call success callback and retain lock behavior`, { timeout: 2000 }, async () => {
    for (const mode of ['business', 'transport']) {
      for (const skip of [undefined, false, true]) {
        for (const withCallback of [false, true]) {
          const e = environment(implementation, mode);
          let called = false;
          const value = await e.get(withCallback ? () => { called = true; } : null, skip);
          assert.equal(called, false);
          if (implementation === 'html5') { assert.deepEqual(plain(value), []); }
          else { assert.equal(value, undefined); }
          const trace = [['lock', true], ['request', skip ? '' : 'X']];
          if (mode === 'business') {
            if (skip !== true) { trace.push(['busy', '']); }
            trace.push(['lock', true]);
            if (skip !== true) { trace.push(['lock', false]); }
          } else { trace.push(['lock', false]); }
          assert.deepEqual(e.trace, trace);
        }
      }
    }
  });
}

const designSource = read('design/js/uiAttributeArea.js');
test('design click/F4: blank choice is local; missing values retain existing behavior', () => {
  const first = designSource.indexOf('_sAttr.T_DDLB = [');
  const click = between(designSource, '_sAttr.T_DDLB = [', '_sAttr.valst = "None";', first);
  const f4 = between(designSource, '_sAttr.T_DDLB = [', '_sAttr.valst = "None";', first + 1);
  for (const [source, preservesMissing] of [[click, true], [f4, false]]) {
    for (const events of [[], expected]) {
      for (const current of ['', 'EV_SEARCH', 'EV_MISSING']) {
        const frozen = Object.freeze(events.map(e => Object.freeze({ ...e })));
        const ctx = vm.createContext({ _aEvent: frozen, _sAttr: { UIATV: current } });
        for (let n = 0; n < 3; n++) {
          vm.runInContext(source, ctx);
          const items = plain(ctx._sAttr.T_DDLB);
          assert.equal(items[0].KEY, '');
          assert.equal(items.filter(i => i.KEY === '').length, 1);
          assert.equal(items.length, events.length + 1 +
            (preservesMissing && current !== '' && !events.some(e => e.KEY === current) ? 1 : 0));
          assert.deepEqual(plain(frozen), events);
        }
      }
    }
  }
});

test('UI5 same-attribute callback builds a separate selection list', { timeout: 2000 }, async () => {
  const source = between(read('design/js/callSetSameAttrPopup.js'),
    'oAPP.fn.getServerEventList(function(oParam){', '}, true);') + '}, true);';
  for (const events of [[], rows]) {
    const e = environment('design', 'success', events);
    let raw;
    const original = e.get;
    e.context.oAPP.fn.getServerEventList = (callback, skip) => original(list => {
      raw = Object.freeze(list);
      callback(raw);
    }, skip);
    const items = await new Promise(resolve => {
      e.context.res = resolve;
      vm.runInContext(source, e.context);
    });
    assert.equal(items.length, events.length + 1);
    assert.deepEqual(plain(items[0]), { KEY: '', TEXT: '', DESC: '' });
    assert.deepEqual(plain(raw), expected.slice(0, events.length));
  }
});

const htmlSource = read('js/ws_html5_ws20_attr.js');
const onOpen = between(htmlSource, 'oSelOpts.onOpen = function (oCombo) {',
  '\n                };') + '\n};';
for (const implementation of Object.keys(implementations)) {
  test(`HTML5 onOpen with ${implementation}: repeated opens, empty/current/missing values`, { timeout: 2000 }, async () => {
    for (const events of [[], rows]) {
      for (const current of ['', 'EV_SEARCH', 'EV_MISSING']) {
        const e = environment(implementation, 'success', events);
        let moves = 0;
        let waits = 0;
        let items, state;
        e.context.oSelOpts = {};
        e.context.sAttr = { UIATV: current, UIATK: 'PRESS', valst: 'Error' };
        e.context._attrWaitScrollIdle = () => { waits++; return Promise.resolve(); };
        e.context.oAPP.fn.setAttrFocus = () => { moves++; };
        e.context.oAPP.common = { fnGetMsgClsText: () => 'stub missing event message' };
        vm.runInContext(onOpen, e.context);
        const combo = { setItems(v) { items = plain(v); }, setValueState(v) { state = v; } };
        for (let n = 0; n < 3; n++) {
          await e.context.oSelOpts.onOpen(combo);
          const missing = current !== '' && !events.some(e => e.EVTNM === current);
          assert.equal(items[0].value, '');
          assert.equal(items.filter(i => i.value === '').length, 1);
          assert.equal(items.length, events.length + 1 + (missing ? 1 : 0));
          assert.equal(state, missing ? 'error' : 'none');
          assert.equal(moves, missing ? n + 1 : 0);
          assert.equal(waits, moves);
        }
      }
    }
  });
}

test('HTML5 onOpen: failure preserves previous items/error state and does not move', { timeout: 2000 }, async () => {
  for (const implementation of Object.keys(implementations)) {
    for (const mode of ['business', 'transport']) {
      const e = environment(implementation, mode);
      e.context.oSelOpts = {};
      e.context.sAttr = { UIATV: 'EV_SEARCH', valst: 'None', T_DDLB: [{ KEY: 'OLD' }] };
      e.context.oAPP.fn.setAttrFocus = () => assert.fail('Must not move after failure');
      e.context._attrWaitScrollIdle = () => assert.fail('Must not wait after failure');
      vm.runInContext(onOpen, e.context);
      const before = plain(e.context.sAttr);
      await e.context.oSelOpts.onOpen({
        setItems() { assert.fail('Must preserve previous items'); },
        setValueState() { assert.fail('Must preserve previous error state'); }
      });
      assert.deepEqual(plain(e.context.sAttr), before);
    }
  }
});

const valueControl = between(read('js/fnSameAttrSyncPopupOpen.js'),
  'async function _buildValueControl(is_attr) {', '\n    /* ── 입력값 변경');
test('HTML5 same-attribute: blank/current/missing choices, value clearing, immutable server list', { timeout: 2000 }, async () => {
  for (const implementation of Object.keys(implementations)) {
    for (const events of [[], rows]) {
      for (const current of ['', 'EV_SEARCH', 'EV_MISSING']) {
        const e = environment(implementation, 'success', events);
        let raw;
        const original = e.get;
        e.context.oAPP.fn.getServerEventList = (...args) => original(...args).then(list => {
          raw = Object.freeze(list);
          return raw;
        });
        e.context.oAPP.DATA = { LIB: { T_0023: [] } };
        e.context.oState = { value: current };
        const ui = { createSelect: (items, value, change) => ({ items: plain(items), value, change }) };
        e.context.U4AUI = ui;
        e.context.window = { U4AUI: ui };
        vm.runInContext(valueControl, e.context);
        const control = await e.context._buildValueControl({ UIATK: 'PRESS', UIATY: '2' });
        assert.equal(control.items.filter(i => i.value === '').length, 1);
        assert.equal(e.context.oState.ddlb[0].KEY, '');
        assert.equal(control.value, current);
        if (current) { assert.ok(control.items.some(i => i.value === current)); }
        control.change('');
        assert.equal(e.context.oState.value, '');
        assert.deepEqual(plain(raw), expected.slice(0, events.length));
      }
    }
  }
});

test('Find data: actual event descriptions and shortcut descriptions work with empty/real lists', () => {
  const source = read('Popups/findPopup/findFrame.js');
  const m1 = between(source, 'function _deriveM1() {', 'function _deriveM2L() {');
  const m5 = between(source, 'function _deriveM5() {', '// ── 모드(메뉴) 정의');
  for (const events of [[], expected]) {
    const ctx = vm.createContext({
      _attr: () => [{ UIATY: '2', UIATV: 'EV_SEARCH', SHCUT: '{"SCKEY":"Ctrl+S"}' }],
      _serv: () => events
    });
    vm.runInContext(m1 + m5, ctx);
    assert.equal(ctx._deriveM1()[0].EVTXT, events.length ? 'Search' : undefined);
    assert.equal(ctx._deriveM5()[0].EVTXT, events.length ? 'Search' : '');
    assert.equal(ctx._deriveM5()[0].HOTKEY, 'Ctrl+S');
  }
});
