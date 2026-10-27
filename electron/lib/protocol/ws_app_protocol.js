/****************************************************************************************
 * 앱 화면을 내주는 custom protocol — u4a-ws://app/...
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: PROT / 다음 번호: 006
 *
 * 왜 만들었나 (2026-10-27, 장군님 지시):
 *   「우선 커스텀 프로토콜 방식으로 실행해야되고, 모든 브라우저 윈도우 실행 부분은 커스텀
 *    프로토콜 + 경로로, 브라우저 객체에서 제공하는 함수 중, loadFile 로 하는게 아니고
 *    loadUrl 함수로 해야한다」
 *   Electron 45(Chromium 156) 로 올리면서 화면을 file:// 로 열지 않는다.
 *
 * 무엇을 하나:
 *   ① 앱이 준비되기 전에 u4a-ws 를 standard · secure scheme 으로 등록한다.
 *      standard 라야 u4a-ws://host/path 모양으로 읽히고, secure 라야 보안 컨텍스트가 된다.
 *   ② 앱이 준비된 뒤 u4a-ws://app/<경로> 요청을 화면 뿌리 폴더(www)의 파일로 내준다.
 *   ③ OS 경로를 u4a-ws://app/... 주소로 바꿔 주는 함수(toAppUrl)를 준다.
 *
 * 지키는 것:
 *   - host 는 app 하나만 받는다. 다른 host(link 등)는 나중에 deep link 로 쓸 자리라 비워 둔다.
 *     까닭: scheme 이름 u4a-ws 가 deep link 이름과 같아서, 주소 한 벌을 host 로 갈라 쓴다.
 *   - 뿌리 폴더 밖으로 나가는 요청은 내주지 않는다(.. 로 빠져나가기 차단).
 *   - 쿼리스트링은 파일을 찾을 때 쓰지 않는다 — 창에 값을 넘기는 용도라 그대로 둔다.
 *   - 이 파일 때문에 앱이 죽으면 안 된다. 실패는 코드와 함께 로그에 남기고 계속 간다.
 ****************************************************************************************/

const { protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SCHEME = 'u4a-ws';   // 장군님 지시 2026-10-27
const HOST = 'app';        // 화면 파일을 내주는 host. deep link 용으로는 link 를 비워 둔다.

let _appRoot = '';         // 화면 파일이 있는 뿌리 폴더 (= app.getAppPath(), 실제로는 www)
let _registered = false;   // 중복 등록 방지
let _handled = false;      // 중복 설치 방지

/**
 * 없는 파일은 같은 경로에 딱 한 번만 남긴다(로그 표준).
 * devtools 가 없는 .js.map 을 줄줄이 찾아서, 안 그러면 로그가 그것으로 덮인다.
 */
const _missLogged = new Set();

/****************************************************************************************
 * 로그 — 앱 본체 로그에 같이 남긴다. 로그 모듈이 없어도 앱은 계속 가야 한다.
 ****************************************************************************************/
function _writeLog(sLevel, sText) {

    try {

        const WsMainLog = require('../log/ws_main_log');

        if (WsMainLog && typeof WsMainLog.writeLog === 'function') {
            WsMainLog.writeLog(sLevel, sText);
            return;
        }

    } catch (e) {
        // 로그 모듈을 못 불러도 아래 콘솔로 남긴다.
    }

    console.log('[PROT] ' + sLevel + ' | ' + sText);

}

/****************************************************************************************
 * 예외에서 메시지만 꺼낸다.
 ****************************************************************************************/
function _errText(e) {

    if (e && e.message) {
        return String(e.message);
    }

    return String(e);

}

/****************************************************************************************
 * 주소 뒤에 붙은 ?쿼리 · #조각만 떼어 돌려준다. 없으면 빈 글자.
 ****************************************************************************************/
function _getTail(sPath) {

    const iMark = sPath.search(/[?#]/);

    if (iMark > -1) {
        return sPath.substring(iMark);
    }

    return '';

}

/****************************************************************************************
 * scheme 등록 — 반드시 app ready 전에 불러야 한다.
 ****************************************************************************************/
function registerScheme() {

    if (_registered) {
        return;
    }

    try {

        protocol.registerSchemesAsPrivileged([{
            scheme: SCHEME,
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                corsEnabled: true,
                stream: true,
                allowServiceWorkers: true,
                bypassCSP: true
            }
        }]);

        _registered = true;

        _writeLog('알림', 'PROTOCOL | scheme registered | ' + SCHEME);

    } catch (e) {
        _writeLog('오류', 'PROT-001 | registerSchemesAsPrivileged failed | ' + _errText(e));
    }

}

/****************************************************************************************
 * 요청 하나를 파일로 내준다.
 ****************************************************************************************/
async function _serve(oRequest) {

    let oUrl = null;

    try {
        oUrl = new URL(oRequest.url);
    } catch (e) {
        _writeLog('주의', 'PROT-002 | bad url | ' + String(oRequest && oRequest.url));
        return new Response('', { status: 400 });
    }

    if (oUrl.hostname !== HOST) {
        _writeLog('주의', 'GUARD_EXIT | unknown host | ' + oUrl.hostname + ' | nothing served');
        return new Response('', { status: 404 });
    }

    let sPathname = '';

    try {
        sPathname = decodeURIComponent(oUrl.pathname);
    } catch (e) {
        _writeLog('주의', 'PROT-003 | pathname decode failed | ' + oUrl.pathname);
        return new Response('', { status: 400 });
    }

    const sFullPath = path.resolve(path.join(_appRoot, sPathname));
    const sRootWithSep = path.resolve(_appRoot) + path.sep;

    if (!(sFullPath + path.sep).startsWith(sRootWithSep)) {
        _writeLog('주의', 'GUARD_EXIT | path escapes app root | ' + sPathname + ' | nothing served');
        return new Response('', { status: 403 });
    }

    if (!fs.existsSync(sFullPath)) {

        if (!_missLogged.has(sPathname)) {
            _missLogged.add(sPathname);
            _writeLog('주의', 'DOM_MISS | file not found | ' + sPathname);
        }

        return new Response('', { status: 404 });
    }

    try {
        return await net.fetch(pathToFileURL(sFullPath).toString());
    } catch (e) {
        _writeLog('오류', 'PROT-004 | net.fetch failed | ' + sPathname + ' | ' + _errText(e));
        return new Response('', { status: 500 });
    }

}

/****************************************************************************************
 * 핸들러 설치 — app ready 뒤, 창을 만들기 전에 부른다.
 ****************************************************************************************/
function install(oApp) {

    if (_handled) {
        return;
    }

    _appRoot = oApp.getAppPath();

    const { session } = require('electron');
    const oDone = new Set();

    /**
     * ★session 마다 따로 걸어야 한다 (2026-10-27 실측으로 알아냈다).
     *   protocol.handle 은 **기본 session 에만** 걸린다. 그런데 이 앱은 창을 만들 때
     *   webPreferences.partition 에 매번 다른 값을 줘서 **창마다 session 이 다르다.**
     *   기본 session 에만 걸면 서버 목록 창이 u4a-ws 주소를 못 열고 조용히 실패한다
     *   (화면에는 「Render frame was disposed」 로만 보여서 원인을 못 찾는다).
     */
    const _handle = function (oSession) {

        if (!oSession || oDone.has(oSession)) {
            return;
        }

        try {

            oSession.protocol.handle(SCHEME, _serve);

            oDone.add(oSession);

        } catch (e) {
            _writeLog('오류', 'PROT-009 | session protocol.handle failed | ' + _errText(e));
        }

    };

    try {

        _handle(session.defaultSession);

        oApp.on('session-created', _handle);

        _handled = true;

        _writeLog('알림', 'PROTOCOL | handler installed on every session | root=' + _appRoot);

    } catch (e) {
        _writeLog('치명', 'PROT-005 | protocol.handle failed | ' + _errText(e));
    }

}

/****************************************************************************************
 * 화면의 __dirname 되살리기 — 모든 session 에 preload 를 건다.
 * --------------------------------------------------------------------------------------
 * 까닭은 ws_renderer_dirname.js 머리말 참고.
 * 창마다 `partition` 을 다르게 주는 자리가 있어 defaultSession 만으로는 모자라다.
 * 그래서 app 의 session-created 로 새로 생기는 session 에도 똑같이 건다.
 ****************************************************************************************/
function installRendererDirname(oApp) {

    const { session } = require('electron');
    const sPreloadPath = path.join(__dirname, 'ws_renderer_dirname.js');
    const oDone = new Set();

    const _register = function (oSession) {

        if (!oSession || oDone.has(oSession)) {
            return;
        }

        try {

            oSession.registerPreloadScript({
                type: 'frame',
                filePath: sPreloadPath
            });

            oDone.add(oSession);

        } catch (e) {
            _writeLog('오류', 'PROT-006 | registerPreloadScript failed | ' + _errText(e));
        }

    };

    _register(session.defaultSession);

    oApp.on('session-created', _register);

    _writeLog('알림', 'PROTOCOL | renderer __dirname preload registered');

}

/****************************************************************************************
 * OS 경로 → u4a-ws://app/... 주소
 * --------------------------------------------------------------------------------------
 * - 절대 경로면 뿌리 폴더 기준 상대 경로로 바꾼다.
 * - 뒤에 붙은 ?쿼리 · #조각은 떼어 두고 그대로 다시 붙인다(창에 값 넘기는 용도).
 * - 이미 u4a-ws:// 주소면 그대로 돌려준다.
 ****************************************************************************************/
function toAppUrl(sPath, oOptions) {

    const oOpt = oOptions || {};
    const sRootOverride = oOpt.root;

    if (typeof sPath !== 'string' || sPath === '') {
        _writeLog('주의', 'GUARD_EXIT | toAppUrl got empty path | returned empty');
        return '';
    }

    if (sPath.indexOf(SCHEME + '://') === 0) {
        return sPath;
    }

    /**
     * 이미 주소 모양이면 그대로 둔다 — http·https(SAP 서버) · about · data · blob 등.
     * ★윈도우 경로(`D:\…`)와 가르는 법: scheme 은 글자가 두 개 이상이고, 드라이브는 한 글자다.
     *   `D:` 를 scheme 으로 잘못 보면 서버 주소와 로컬 경로가 뒤섞인다.
     */
    if (/^[a-zA-Z][a-zA-Z0-9+.-]+:/.test(sPath) && sPath.indexOf('file:') !== 0) {
        return sPath;
    }

    // file:// 은 우리 파일이므로 OS 경로로 되돌려 아래에서 u4a-ws 로 바꾼다.
    if (sPath.indexOf('file:') === 0) {

        try {
            sPath = require('url').fileURLToPath(sPath.split('?')[0].split('#')[0]) + _getTail(sPath);
        } catch (e) {
            _writeLog('주의', 'PROT-007 | fileURLToPath failed | ' + sPath);
            return sPath;
        }

    }

    const sRoot = sRootOverride || _appRoot;

    if (!sRoot) {
        _writeLog('주의', 'GUARD_EXIT | toAppUrl has no app root | returned input as is');
        return sPath;
    }

    let sBody = sPath;
    let sTail = '';

    const iMark = sBody.search(/[?#]/);

    if (iMark > -1) {
        sTail = sBody.substring(iMark);
        sBody = sBody.substring(0, iMark);
    }

    let sRelative = sBody;

    if (path.isAbsolute(sBody)) {
        sRelative = path.relative(sRoot, sBody);
    }

    sRelative = sRelative.split('\\').join('/');

    while (sRelative.indexOf('/') === 0) {
        sRelative = sRelative.substring(1);
    }

    const aEncoded = sRelative.split('/').map(function (sPart) {
        return encodeURIComponent(sPart);
    });

    let sUrl = SCHEME + '://' + HOST + '/' + aEncoded.join('/') + sTail;

    /**
     * 옛 `loadFile(경로, { query·search·hash })` 자리를 `loadURL` 로 옮길 때 쓴다.
     * 세 가지를 다 받는다 — 하나라도 빠뜨리면 그 값을 쓰던 화면이 조용히 망가진다
     * (2026-10-27 실제 사고: `query` 를 빠뜨려 인트로 버전이 `undefined` 로 떴다).
     */
    if (oOpt.query) {

        const sQuery = require('querystring').stringify(oOpt.query);

        if (sQuery) {
            sUrl = sUrl + (sUrl.indexOf('?') > -1 ? '&' : '?') + sQuery;
        }

    }

    if (oOpt.search) {
        sUrl = sUrl + (oOpt.search.indexOf('?') === 0 ? oOpt.search : '?' + oOpt.search);
    }

    if (oOpt.hash) {
        sUrl = sUrl + (oOpt.hash.indexOf('#') === 0 ? oOpt.hash : '#' + oOpt.hash);
    }

    return sUrl;

}

/****************************************************************************************
 * 창에 배경색 CSS 를 넣는다 — 화면이 들어간 뒤에 넣어야 한다.
 * --------------------------------------------------------------------------------------
 * 왜 이 함수가 있나 (2026-10-27):
 *   Electron 45 에서는 **화면이 아직 하나도 안 들어간 창**에 `webContents.insertCSS` 를 부르면
 *   `Render frame was disposed before WebFrameMain could be accessed` 로 깨진다.
 *   그 깨짐을 아무도 안 받으면 공통 오류처리가 치명으로 보고 **앱을 통째로 종료**시킨다
 *   (2026-10-27 인트로에서 실제로 그렇게 죽었다).
 *
 * 화면 코드는 창을 만든 직후에 이 함수를 한 줄로 부른다:
 *   REMOTE.getGlobal("u4aSetWindowCss")(oBrowserWindow, sWebConBodyCss);
 *
 * 기다리는 자리는 `dom-ready` 다 — 창은 그때까지 `show:false` 라 눈에 안 보이므로
 * 번쩍임 없이 색이 들어간다.
 ****************************************************************************************/
function setWindowCss(oWindow, sCss) {

    if (!oWindow || !sCss) {
        _writeLog('주의', 'GUARD_EXIT | setWindowCss got no window or no css | nothing applied');
        return;
    }

    let oWebContents = null;

    try {
        oWebContents = oWindow.webContents ? oWindow.webContents : oWindow;
    } catch (e) {
        _writeLog('주의', 'PROT-010 | could not read webContents | ' + _errText(e));
        return;
    }

    const _apply = function () {

        try {

            oWebContents.insertCSS(sCss).catch(function (e) {
                _writeLog('주의', 'PROT-011 | insertCSS failed | ' + _errText(e));
            });

        } catch (e) {
            _writeLog('주의', 'PROT-012 | insertCSS threw | ' + _errText(e));
        }

    };

    /**
     * 이미 화면이 들어가 있으면 바로 넣는다(자기 창에 넣는 경우).
     * ★가르는 기준은 `getURL()` 이다 — 갓 만든 창은 빈 글자를 준다.
     *   `mainFrame` 으로 가르면 안 된다(2026-10-27 실측): 갓 만든 창도 `mainFrame` 은 있는 것처럼
     *   보여서 바로 넣으러 갔다가 `Render frame was disposed` 로 깨졌다.
     */
    let sNowUrl = '';

    try {
        sNowUrl = oWebContents.getURL();
    } catch (e) {
        sNowUrl = '';
    }

    if (sNowUrl) {
        _apply();
        return;
    }

    oWebContents.once('dom-ready', _apply);

}

module.exports = {
    SCHEME: SCHEME,
    HOST: HOST,
    setWindowCss: setWindowCss,
    registerScheme: registerScheme,
    install: install,
    installRendererDirname: installRendererDirname,
    toAppUrl: toAppUrl
};
