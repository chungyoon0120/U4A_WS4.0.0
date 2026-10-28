/****************************************************************************************
 * http 서버용 쿠키 — 앱이 직접 들고 다닌다.
 * --------------------------------------------------------------------------------------
 * 오류코드 접두: HCOK / 다음 번호: 004
 *
 * 왜 만들었나 (2026-10-27, 장군님 지시 「http 로 진행해보자 이게 되야되」):
 *   https 서버는 된다. **http 서버는 로그인하자마자 쿠키가 아예 저장되지 않는다.**
 *
 *   까닭은 Chromium 의 두 규칙이 맞물려서다.
 *     ① 우리 화면(`u4a-ws://`)과 SAP 서버는 서로 다른 site 라, 쿠키가 실리려면 `SameSite=None` 이어야 한다.
 *     ② `SameSite=None` 쿠키는 `Secure` 가 있어야 하고, `Secure` 쿠키는 **https 응답만** 저장할 수 있다.
 *   그래서 http 응답은 `Secure` 를 붙여도 거부되고, 빼면 ① 에 걸린다. **응답 헤더를 어떻게 고쳐도 길이 없다.**
 *   (옛날에는 `--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure` 로
 *    이 규칙을 꺼서 됐는데, 그 기능들이 Chromium 에서 없어져 스위치가 아무 일도 안 한다.)
 *
 * 그래서 무엇을 하나:
 *   **http 서버에 한해서만** 우리가 쿠키를 직접 보관하고 직접 붙인다.
 *     ① 응답의 `Set-Cookie` 를 읽어 host 별로 기억한다.
 *     ② 그 host 로 나가는 요청에 `Cookie` 헤더로 다시 붙인다.
 *   Chromium 의 쿠키 저장소를 안 거치므로 위 두 규칙을 아예 안 탄다.
 *
 * ★2026-10-28 추가 — https 도 같이 본다 (장군님 지시 「우선 고쳐바」).
 *   WS20 미리보기가 서버 UI5 를 올리다 깨졌다(Unexpected token '<' — JavaScript 자리에 로그인 화면 HTML).
 *   Network 탭 실측으로 가른 것:
 *     · `<script>` 태그로 받는 sap-ui-core.js 는 쿠키가 실려 **성공**한다.
 *     · UI5 가 내부에서 쓰는 요청(sap.ui.requireSync · library-preload)은 **cross-origin XHR** 이라,
 *       withCredentials 가 꺼져 있으면 Chromium 이 Cookie 를 빼고 내보낸다 → 서버가 로그인 화면을 준다.
 *     · 그 로그인 화면 응답이 MYSAPSSO2 · SAP_SESSIONID 를 expires=1980 으로 **지워 버려** 뒤가 전부 무너진다.
 *   UI5 는 남의 라이브러리라 그 설정을 켤 수 없다. 그래서 **나가기 직전에 여기서 Cookie 를 붙인다** —
 *   webRequest 는 화면 밖(메인 process)이라 cross-origin 규칙을 타지 않는다.
 *   ★이미 Cookie 가 붙어 있으면 덮지 않고 **없는 것만** 더하므로 중복되지 않는다.
 *
 * 지키는 것:
 *   - **쿠키 값은 로그에 남기지 않는다** — 인증 표다(로그 표준). 개수와 host 만 남긴다.
 *   - 이미 Chromium 이 붙인 `Cookie` 가 있으면 **덮지 않고 없는 것만 더한다.**
 *   - 이 파일 때문에 앱이 죽으면 안 된다. 실패는 코드와 함께 남기고 그냥 통과시킨다.
 ****************************************************************************************/

/**
 * 쿠키를 들고 다닐 대상 scheme.
 *
 * ★[2026-10-28 장군님 지시 「우선 고쳐바」] https 를 넣었다. 그 전에는 http 만 봤다.
 *   까닭은 이 파일 머리말의 「2026-10-28 추가」 참고.
 */
const SCHEME_HTTP = 'http:';
const SCHEME_HTTPS = 'https:';

/**
 * ★[2026-10-27 장군님 지시] 어디서 끊기는지 보려고 넣은 진단 로그의 상한.
 *   요청마다 남기면 로그가 쏟아지므로 **처음 몇 번만** 남긴다(로그 양 표준).
 *   쿠키 값은 절대 남기지 않는다 — 인증 표다. 이름과 개수만 남긴다.
 */
const LOG_FIRST_N = 5;

/**
 * host 별 쿠키 보관함.  Map<host, Map<name, value>>
 * session 마다 따로 두려고 install() 안에서 만든다.
 */

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

    console.log('[HCOK] ' + sLevel + ' | ' + sText);

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
 * 주소에서 host 를 꺼낸다. http · https 가 아니면 빈 글자(= 손대지 않는다).
 *
 * ★[2026-10-28] https 를 받아들이게 넓혔다. 이름도 _getHttpHost 에서 바꿨다 —
 *   이제 http 만 보는 함수가 아니다. 부르는 곳은 이 파일 안 2곳뿐이다(전수 확인).
 ****************************************************************************************/
function _getCookieHost(sUrl) {

    let oUrl = null;

    try {
        oUrl = new URL(sUrl);
    } catch (e) {
        return '';
    }

    if (oUrl.protocol !== SCHEME_HTTP && oUrl.protocol !== SCHEME_HTTPS) {
        return '';
    }

    return oUrl.host;

}

/****************************************************************************************
 * `Set-Cookie` 한 줄에서 이름·값과 「지우라는 뜻인지」를 읽는다.
 * 속성(path·domain·SameSite…)은 쓰지 않는다 — 우리가 host 로만 갈라 보관하기 때문이다.
 ****************************************************************************************/
function _parseSetCookie(sLine) {

    const aParts = String(sLine).split(';');
    const sPair = aParts[0] || '';
    const iEq = sPair.indexOf('=');

    if (iEq < 1) {
        return null;
    }

    const sName = sPair.substring(0, iEq).trim();
    const sValue = sPair.substring(iEq + 1).trim();

    let bDelete = false;

    for (let i = 1; i < aParts.length; i++) {

        const sAttr = aParts[i].trim().toLowerCase();

        if (sAttr === 'max-age=0' || sAttr === 'max-age=-1') {
            bDelete = true;
        }

        if (sAttr.indexOf('expires=') === 0) {

            const iTime = Date.parse(aParts[i].trim().substring('expires='.length));

            if (!isNaN(iTime) && iTime <= Date.now()) {
                bDelete = true;
            }

        }

    }

    if (sValue === '') {
        bDelete = true;
    }

    return { name: sName, value: sValue, del: bDelete };

}

/****************************************************************************************
 * 한 session 에 건다. 창마다 partition 이 달라 session 이 여러 개라 자리마다 걸어야 한다.
 ****************************************************************************************/
function install(oSession) {

    if (!oSession || oSession.__u4aHttpCookieInstalled === true) {
        return;
    }

    const oJar = new Map();

    const oFilter = { urls: ['http://*/*', 'https://*/*'] };

    // 진단용 — 처음 몇 번만 남기려고 센다.
    let iReqLogged = 0;
    let iResLogged = 0;

    /**
     * ★[2026-10-28] host 마다 한 번만 남기려고 기억한다.
     *   https 를 보기 시작하면서 요청이 수백 건으로 늘었다 — 요청마다 남기면 로그가 쏟아진다(로그 양 표준).
     */
    const oKeptLoggedHosts = new Set();
    const oAttachLoggedHosts = new Set();

    _writeLog('알림', 'HTTP_COOKIE | hooked on a session');

    /************************************************************************************
     * ① 응답에서 Set-Cookie 를 거둔다.
     * ----------------------------------------------------------------------------------
     * ★**`onHeadersReceived` 를 쓰면 안 된다.** 그 자리는 session 당 **하나만** 걸 수 있어서,
     *   이미 쓰고 있는 자리(`electron/main.js` 의 configureSession ·
     *   `www/ServerList_v2/ServerList.js` 의 configureSession)를 밀어내 버린다.
     *   그래서 **읽기만 하는 `onCompleted`** 를 쓴다. 거기에도 응답 헤더가 들어 있다.
     ************************************************************************************/
    oSession.webRequest.onCompleted(oFilter, (oDetails) => {

        try {

            const sHost = _getCookieHost(oDetails.url);

            if (!sHost) {
                return;
            }

            const oHeaders = oDetails.responseHeaders || {};
            let aSetCookie = [];

            for (const sKey in oHeaders) {

                if (sKey.toLowerCase() === 'set-cookie') {
                    aSetCookie = oHeaders[sKey] || [];
                }

            }

            // ★[2026-10-27] 「서버가 안 보냈다」와 「헤더가 우리 눈에 안 보인다」를 가른다.
            //   Chromium 은 Set-Cookie 를 리스너에 안 보여 줄 수 있다. 그때는 헤더 개수는 세어지는데
            //   set-cookie 만 0 으로 나온다 — 그 모양이 보이면 거두는 자리를 옮겨야 한다.
            if (iResLogged < LOG_FIRST_N) {

                iResLogged = iResLogged + 1;

                _writeLog('알림', 'HTTP_COOKIE | response seen | host=' + sHost
                    + ' | status=' + oDetails.statusCode
                    + ' | headerCount=' + Object.keys(oHeaders).length
                    + ' | setCookieCount=' + aSetCookie.length);

            }

            if (aSetCookie.length > 0) {

                let oHostJar = oJar.get(sHost);

                if (!oHostJar) {
                    oHostJar = new Map();
                    oJar.set(sHost, oHostJar);
                }

                for (const sLine of aSetCookie) {

                    const oCookie = _parseSetCookie(sLine);

                    if (!oCookie) {
                        continue;
                    }

                    if (oCookie.del) {
                        oHostJar.delete(oCookie.name);
                        continue;
                    }

                    oHostJar.set(oCookie.name, oCookie.value);

                }

                // host 마다 한 번만 — 응답마다 남기면 로그만 커지고 새 정보가 없다.
                if (!oKeptLoggedHosts.has(sHost)) {

                    oKeptLoggedHosts.add(sHost);

                    _writeLog('알림', 'HTTP_COOKIE | kept | host=' + sHost + ' | count=' + oHostJar.size);

                }

            }

        } catch (e) {
            _writeLog('주의', 'HCOK-001 | could not keep cookies | ' + _errText(e));
        }

    });

    /************************************************************************************
     * ② 나가는 요청에 다시 붙인다. 이미 붙어 있는 것은 그대로 두고 없는 것만 더한다.
     ************************************************************************************/
    oSession.webRequest.onBeforeSendHeaders(oFilter, (oDetails, fnCallback) => {

        try {

            const sHost = _getCookieHost(oDetails.url);
            const oHostJar = sHost ? oJar.get(sHost) : null;

            // ★[2026-10-27] 요청이 여기까지 오기는 하는지부터 본다.
            //   아무 줄도 안 나오면 이 자리 자체가 안 불리는 것이다(걸린 session 이 다르다는 뜻).
            if (iReqLogged < LOG_FIRST_N) {

                iReqLogged = iReqLogged + 1;

                _writeLog('알림', 'HTTP_COOKIE | request seen | host=' + (sHost || '(not http)')
                    + ' | kept=' + (oHostJar ? oHostJar.size : 0));

            }

            if (!oHostJar || oHostJar.size === 0) {
                fnCallback({ cancel: false, requestHeaders: oDetails.requestHeaders });
                return;
            }

            const oHeaders = oDetails.requestHeaders || {};
            let sCookieKey = '';

            for (const sKey in oHeaders) {

                if (sKey.toLowerCase() === 'cookie') {
                    sCookieKey = sKey;
                }

            }

            const sNow = sCookieKey ? String(oHeaders[sCookieKey] || '') : '';
            const oAlready = new Set();

            for (const sPair of sNow.split(';')) {

                const sTrim = sPair.trim();

                if (!sTrim) {
                    continue;
                }

                const iEq = sTrim.indexOf('=');

                if (iEq > 0) {
                    oAlready.add(sTrim.substring(0, iEq).trim());
                }

            }

            const aAdd = [];

            oHostJar.forEach((sValue, sName) => {

                if (!oAlready.has(sName)) {
                    aAdd.push(sName + '=' + sValue);
                }

            });

            if (aAdd.length > 0) {

                const sMerged = sNow ? (sNow.replace(/;\s*$/, '') + '; ' + aAdd.join('; ')) : aAdd.join('; ');

                oHeaders[sCookieKey || 'Cookie'] = sMerged;

                // host 마다 한 번만 — 요청마다 남기면 https 는 수백 줄이 된다.
                if (!oAttachLoggedHosts.has(sHost)) {

                    oAttachLoggedHosts.add(sHost);

                    _writeLog('알림', 'HTTP_COOKIE | attached | host=' + sHost + ' | added=' + aAdd.length);

                }

            }

            fnCallback({ cancel: false, requestHeaders: oHeaders });
            return;

        } catch (e) {
            _writeLog('주의', 'HCOK-002 | could not attach cookies | ' + _errText(e));
        }

        fnCallback({ cancel: false, requestHeaders: oDetails.requestHeaders });

    });

    oSession.__u4aHttpCookieInstalled = true;

}

/****************************************************************************************
 * 모든 session 에 건다 — 기본 session + 앞으로 생기는 session 전부.
 ****************************************************************************************/
function installAll(oApp) {

    const { session } = require('electron');

    try {

        install(session.defaultSession);

        // ★[2026-10-27] 창마다 session 이 달라, 나중에 생기는 session 에도 걸려야 한다.
        //   몇 개에 걸렸는지 세어 둔다 — 로그인 창의 session 에 안 걸렸으면 여기 수가 안 는다.
        let iSession = 1;

        oApp.on('session-created', function (oNewSession) {

            iSession = iSession + 1;

            install(oNewSession);

            _writeLog('알림', 'HTTP_COOKIE | new session hooked | total=' + iSession);

        });

        _writeLog('알림', 'HTTP_COOKIE | installed on every session');

    } catch (e) {
        _writeLog('오류', 'HCOK-003 | installAll failed | ' + _errText(e));
    }

}

module.exports = {
    install: install,
    installAll: installAll
};
