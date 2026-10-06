/****************************************************************************************
 * 모든 창·틀 안 화면에 오류 감시 자동 설치
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: EHOK / 다음 번호: 004
 *
 * 왜 만들었나 (2026-09-08, 실측 근거)
 *   오류 감시가 안 걸린 화면이 49곳이었다. 창 26곳, 틀 안 화면 23곳.
 *   특히 코드 편집기 안쪽, WS20 미리보기, 서버가 준 코드를 돌리는 숨은 화면이 통째로 빠져 있었다.
 *   화면마다 한 줄씩 넣는 방식으로는 또 빠뜨린다. 그래서 앱 본체에서 자동으로 붙인다.
 *
 * 어떻게 하나
 *   화면(틀 안 화면 포함)이 다 뜨는 순간, 그 화면 안에 작은 감시 코드를 넣는다.
 *   그 감시가 오류를 잡으면 앱 본체로 보내고, 앱 본체가 로그 파일에 남긴다.
 *
 * 이미 감시가 있는 화면은 건드리지 않는다
 *   기존 감시(ws_trycatch)가 걸린 화면은 window.onerror 가 이미 채워져 있다.
 *   그런 화면은 그냥 지나간다. 그래서 로그가 두 번 남지 않는다.
 *
 * 기존 동작을 바꾸지 않는다
 *   오류를 잡아서 남기기만 한다. 오류창을 띄우거나 앱을 끄지 않는다.
 ****************************************************************************************/

let _app = null;
let _installed = false;

/****************************************************************************************
 * 화면 안에 넣을 감시 코드
 *  - 그 화면 안에서 도는 코드다. 짧고 방어적으로 유지한다.
 ****************************************************************************************/
const INJECT_SCRIPT = `
(function () {

    try {

        // 이미 넣었으면 두 번 넣지 않는다
        // ※ 표시는 끝까지 성공한 뒤에 남긴다. 중간에 실패하면 다음에 다시 시도해야 한다.
        if (window.__u4aErrHookInstalled) { return 'already installed'; }

        /**
         * 두 가지를 각각 따로 판단한다 (2026-09-08 정정)
         *  ① 오류 감시 : 기존 감시가 있으면 안 넣는다(로그가 두 번 남지 않게)
         *  ② 버튼 누름 : 공통 로그 함수가 없는 화면이면 넣는다
         * 앞서 ① 하나로 둘 다 건너뛰어, 기존 감시만 있고 공통 로그 함수가 없는
         * 화면 81곳에서 버튼 누름이 안 남았다. 그 구멍을 막는다.
         */
        var bNeedErrorHook = (typeof window.onerror !== 'function');

        /**
         * 버튼 누름 기록은 **일단 늘 건다**(2026-09-08 정정).
         * 앞서는 여기서 "화면쪽 로그 함수가 없으면"으로 판단했는데,
         * 그 함수는 화면이 다 뜬 뒤 목록을 따라 늦게 올라온다.
         * 그래서 판단 시점엔 늘 없었고, 결국 같은 조작이 두 줄로 남았다(실측).
         * 이제는 **남길 그 순간에** 화면쪽 함수가 있는지 보고 건너뛴다(아래).
         */
        var bNeedClickHook = true;

        /**
         * 앱 본체로 보내는 길 만들기 (2026-09-08 보완 — 감사에서 지적된 구멍)
         * -----------------------------------------------------------------
         * 문제였던 것:
         *   틀 안 화면(iframe)은 이 앱에서 앱 본체로 직접 보낼 수단이 꺼져 있다.
         *   그래서 예전 코드는 틀 안 화면에서 그 화면 콘솔에만 남기고 끝났고,
         *   정작 노렸던 편집기 안쪽·미리보기 화면이 여전히 안 잡혔다.
         *
         * 고친 방법:
         *   ① 직접 보낼 수 있으면 그대로 보낸다(바깥 창).
         *   ② 못 보내면 바깥 창으로 넘긴다. 바깥 창이 대신 앱 본체로 보낸다.
         *   그래서 바깥 창에는 '넘겨받아 대신 보내는 자리'를 늘 깔아 둔다.
         */
        var _send = null;
        var IPC = null;

        try {
            IPC = require('electron').ipcRenderer;
        } catch (e) {
            IPC = null;   // 틀 안 화면 — 직접 보낼 수 없다
        }

        if (IPC) {

            _send = function (o) { IPC.send('u4a-log:renderer-error', o); };

            if (!window.__u4aLogRelay) {

                window.__u4aLogRelay = true;

                window.addEventListener('message', function (ev) {
                    try {
                        if (ev && ev.data && ev.data.__u4aLog === true && ev.data.payload) {
                            IPC.send('u4a-log:renderer-error', ev.data.payload);
                        }
                    } catch (e2) { }
                });

            }

        } else {

            _send = function (o) {
                try {
                    window.top.postMessage({ __u4aLog: true, payload: o }, '*');
                } catch (e2) {
                    try { console.error('[ERROR] ' + o.message); } catch (e3) { }
                }
            };

        }

        function _where() {
            try { return document.title || location.pathname || ''; } catch (e) { return ''; }
        }

        /** 어느 창인지 — 맨 위 창의 제목. 틀 안 화면이면 '(창제목) 안' (2026-09-08 추가) */
        function _win() {
            try {
                var sTop = (window.top && window.top.document) ? (window.top.document.title || '') : '';
                if (!sTop) { sTop = document.title || ''; }
                var bInFrame = false;
                try { bInFrame = (window.top !== window); } catch (e2) { bInFrame = true; }
                if (!sTop) { return bInFrame ? '(iframe)' : '(window)'; }
                return bInFrame ? (sTop + ' > iframe') : sTop;
            } catch (e) {
                return '';
            }
        }

        /** 화면쪽 로그 함수가 들고 있는 추적 번호를 그대로 쓴다 (2026-09-08 추가) */
        function _trace() {
            try {
                if (window.U4ALOG && typeof window.U4ALOG.getTrace === 'function') {
                    return window.U4ALOG.getTrace();
                }
            } catch (e) { }
            return '';
        }

        /**
         * 오류가 난 그 순간 화면 상태 (2026-09-08 추가)
         * 로딩 표시 = id 가 u4aWsBusyIndicator 인 요소 하나뿐이다(소스 확인).
         * 틀 안 화면은 자기 것이 없고 맨 위 창 것을 빌려 쓰므로 거기서도 찾는다.
         */
        function _state() {

            var BUSY_ID = 'u4aWsBusyIndicator';
            var oDoc = null;

            try {
                if (document.getElementById(BUSY_ID)) { oDoc = document; }
            } catch (e) { }

            if (!oDoc) {
                try {
                    if (window.top && window.top !== window && window.top.document.getElementById(BUSY_ID)) {
                        oDoc = window.top.document;
                    }
                } catch (e) { }
            }

            var aOut = [];

            try {

                var oBusy = oDoc ? oDoc.getElementById(BUSY_ID) : null;
                var bOn = false;

                if (oBusy) {
                    bOn = (typeof oBusy.showModal === 'function')
                        ? !!oBusy.open
                        : (oBusy.style && oBusy.style.display === 'flex');
                }

                aOut.push(oBusy ? ('busy=' + (bOn ? 'on' : 'off')) : 'busy=n/a');

            } catch (e) {
                aOut.push('busy=unreadable');
            }

            try {

                var aOpen = (oDoc || document).querySelectorAll('dialog[open]');
                var iCnt = 0;

                for (var i = 0; i < aOpen.length; i++) {
                    if (aOpen[i].id !== BUSY_ID) { iCnt++; }
                }

                aOut.push('openDialogs=' + iCnt);

            } catch (e) {
                aOut.push('openDialogs=unreadable');
            }

            return aOut.join(' / ');

        }

        // 넘겨받는 자리를 깐 뒤에 판단한다(그 자리는 조건과 무관하게 늘 있어야 한다)
        if (!bNeedErrorHook && !bNeedClickHook) {
            window.__u4aErrHookInstalled = true;
            return 'both hooks already present (receiver re-installed)';
        }

        if (bNeedErrorHook) {

        window.onerror = function (message, url, line, col, errorObj) {

            _send({
                message: 'SCRIPT_ERROR | ' + message + ' (' + url + ' ' + line + ':' + col + ')',
                stack: (errorObj && errorObj.stack) ? errorObj.stack : '',
                screenName: _where(),
                windowName: _win(),
                traceId: _trace(),
                screenState: _state(),
                pageUrl: (location && location.href) ? location.href : ''
            });

            return false;   // 원래 흐름을 막지 않는다

        };

        window.addEventListener('unhandledrejection', function (ev) {

            var r = ev ? ev.reason : null;

            _send({
                message: 'UNHANDLED_REJECT | ' + ((r && r.message) ? r.message : String(r)),
                stack: (r && r.stack) ? r.stack : '',
                screenName: _where(),
                windowName: _win(),
                traceId: _trace(),
                screenState: _state(),
                pageUrl: (location && location.href) ? location.href : ''
            });

        });

        }   // end of bNeedErrorHook

        /**
         * 버튼 누름 기록 (2026-09-08 추가)
         * 공통 로그 함수가 안 올라온 화면에서도 무엇을 눌렀는지는 남겨야 한다.
         * 이름은 화면에 적힌 글자 → 설명 → 읽어주는 이름 → 이름표 순으로 찾는다.
         */
        if (bNeedClickHook) {
        try {

            var _cut = function (s) {
                if (!s) { return ''; }
                s = String(s).replace(/\\s+/g, ' ').trim();
                return (s.length > 40) ? (s.slice(0, 40) + '…') : s;
            };

            document.addEventListener('click', function (ev) {

                try {

                    /**
                     * ★남길 그 순간에 판단한다.
                     * 화면쪽 공통 로그 함수가 올라와 있으면 그쪽이 이미 남기므로
                     * 여기서는 남기지 않는다(같은 조작이 두 줄로 남는 것을 막는다).
                     */
                    if (typeof window.U4ALOG !== 'undefined') { return; }

                    var el = ev && ev.target;
                    if (!el || !el.closest) { return; }

                    var hit = el.closest('button, a, [role="button"], input[type="button"], input[type="submit"], [role="menuitem"], [role="tab"], [role="treeitem"], tr, li');
                    if (!hit) { return; }

                    var name = _cut(hit.getAttribute('data-log-name'))
                        || _cut(hit.innerText || hit.textContent)
                        || _cut(hit.getAttribute('title'))
                        || _cut(hit.getAttribute('aria-label'))
                        || '(unnamed control)';

                    _send({
                        kind: 'action',
                        message: 'CLICK | ' + name,
                        stack: '',
                        screenName: _where(),
                        windowName: _win(),
                        traceId: _trace(),
                        pageUrl: (location && location.href) ? location.href : ''
                    });

                } catch (e) { }

            }, true);

        } catch (e) {
            // 버튼 기록을 못 걸어도 오류 감시는 살아 있어야 한다.
        }
        }   // end of bNeedClickHook

        window.__u4aErrHookInstalled = true;   // 끝까지 성공했을 때만 표시한다

        return 'installed - errorHook:' + (bNeedErrorHook ? 'added' : 'kept existing')
            + ' / clickHook:' + (bNeedClickHook ? 'added' : 'handled by U4ALOG');

    } catch (e) {
        return 'install failed: ' + (e && e.message ? e.message : e);
    }

})();
`;

/****************************************************************************************
 * 한 화면(틀 안 화면 포함)에 넣기
 ****************************************************************************************/
function _injectToFrame(iProcessId, iRoutingId) {

    let webFrameMain = null;

    try {
        webFrameMain = require('electron').webFrameMain;
    } catch (e) {
        console.error('[EHOK-001] webFrameMain is unavailable - skipping auto install of the error hook.', e);
        return;
    }

    if (!webFrameMain || typeof webFrameMain.fromId !== 'function') {
        console.error('[EHOK-001] webFrameMain not found - skipping auto install of the error hook.');
        return;
    }

    let frame = null;

    try {
        frame = webFrameMain.fromId(iProcessId, iRoutingId);
    } catch (e) {
        return;   // 이미 사라진 화면 — 넘어간다
    }

    if (!frame) {
        return;
    }

    try {

        frame.executeJavaScript(INJECT_SCRIPT, true).catch((e) => {
            // 화면이 도중에 닫히면 여기로 온다. 앱은 계속 간다.
            console.warn('[EHOK-002] could not install the error hook - the window may have been closed. ' + (e && e.message ? e.message : e));
        });

    } catch (e) {
        console.warn('[EHOK-002] could not install the error hook.', e);
    }

}

/****************************************************************************************
 * 설치
 ****************************************************************************************/
function install(appInstance) {

    /**
     * ★포장한 앱에서만 돈다 (장군님 지시).
     * 개발로 돌릴 때는 화면 콘솔로 보면 되므로 파일에 쌓지도, 밖으로 보내지도 않는다.
     * 2026-09-08: 이 조건이 빠져 있어 개발 실행에서도 그대로 돌고 있었다(실제 로그로 확인).
     */
    if (!appInstance || !appInstance.isPackaged) {
        return;
    }

    if (_installed) {
        return;
    }

    _installed = true;
    _app = appInstance;

    const { app } = require('electron');

    app.on('web-contents-created', (event, contents) => {

        /**
         * 화면 하나가 다 뜰 때마다 부른다.
         * 틀 안 화면(iframe)도 각각 한 번씩 온다 — 그래서 틀 안까지 다 걸린다.
         */
        contents.on('did-frame-finish-load', (e, bIsMainFrame, iProcessId, iRoutingId) => {
            _injectToFrame(iProcessId, iRoutingId);
        });

    });

}

module.exports = {
    install: install
};
