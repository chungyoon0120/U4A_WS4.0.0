/****************************************************************************************
 * Electron Main Process
 ****************************************************************************************/

const {
    app,
    BrowserWindow,
    ipcMain,
    net,
    nativeTheme,
    session
} = require('electron');

const fs = require('fs');
const path = require('path');
const remoteMain = require('@electron/remote/main');

//#region U4A userData 경로 고정
/**
 * 패키징 후 productName이 "U4A AI"로 잡히면 Electron 기본 userData가
 * AppData/Roaming/U4A AI 로 생성된다.
 *
 * 하지만 U4A AI 런타임/모델/설정 저장 기준은 기존부터
 * AppData/Roaming/com.u4a.ai 로 사용하고 있으므로,
 * 앱 실행 초기에 userData 경로를 명시적으로 고정한다.
 *
 * 반드시 app.whenReady() 이전,
 * 그리고 app.getPath('userData')를 최초 호출하기 전에 실행되어야 한다.
 */
let appName = app.getName();

const U4A_USER_DATA_DIR_NAME = app.isPackaged
    ? appName
    : `${appName}.dev`;

app.setPath(
    'userData',
    path.join(app.getPath('appData'), U4A_USER_DATA_DIR_NAME)
);
//#endregion


//#region 앱 본체 로그 · 오류 수집 (2026-09-08 추가)
/**
 * 왜 넣었나:
 *   앱 본체에는 오류·창 종료·응답 없음을 받는 자리가 하나도 없었다(실측 0건).
 *   그래서 앱이 뻗으면 로그가 한 줄도 안 남았다.
 *
 * 왜 여기인가:
 *   userData 경로를 고정한 직후, 창이 만들어지기 전에 걸어야 처음부터 다 잡힌다.
 *
 * 무엇을 바꾸지 않았나:
 *   오류를 받아서 남기기만 한다. 앱을 끄거나 기존 흐름을 바꾸지 않는다.
 */
const WsMainLog = require('./lib/log/ws_main_log');
WsMainLog.install(app);

/**
 * 텔레그램 전송 (테스트 기간 전용).
 * 설정 파일에 토큰·방 번호가 없으면 아무것도 보내지 않는다. 앱은 정상 동작한다.
 * 테스트가 끝나면 설정 파일의 enabled 를 false 로 두면 전송이 전부 멈춘다.
 */
const WsTelegram = require('./lib/log/ws_telegram');
WsTelegram.install(app);

/**
 * 감시가 없던 화면 49곳(창 26 · 틀 안 화면 23)에 오류 감시를 자동으로 넣는다.
 * 화면마다 한 줄씩 넣는 방식은 또 빠뜨리므로 앱 본체에서 일괄로 건다.
 * 이미 감시가 있는 화면은 건드리지 않는다(로그가 두 번 남지 않게).
 */
const WsErrorHook = require('./lib/log/ws_error_hook');
WsErrorHook.install(app);

/**
 * 앱이 뻗었을 때 처리.
 *  ① 죽는 순간 잡는 장치를 켠다(서버로 안 올리고 이 컴퓨터에만 남긴다)
 *  ② "돌고 있음" 표시를 남기고, 정상 종료 때 지운다
 *  ③ 다음에 켤 때 표시가 남아 있으면 지난번에 뻗은 것으로 보고 그때 로그를 보낸다
 */
const WsCrashReport = require('./lib/log/ws_crash_report');
WsCrashReport.install(app);
//#endregion


//#region Sqlite 기반 메시지 클래스
const WsMsgClsService = require('./lib/msg/WsMsgClsService');

global.WsMsgCls = new WsMsgClsService();

//#endregion


/***************************************************************************************
 * Global
 ***************************************************************************************/
global.mainRequire = require;

let mainWindow;

/***************************************************************************************
 * Electron App Command Line Options
 ***************************************************************************************/
app.disableHardwareAcceleration();

app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('no-sandbox');
// app.commandLine.appendSwitch(
//     'disable-features',
//     'IsolateOrigins,site-per-process,SitePerProcess,OriginAgentCluster,CrossSiteDocumentBlockingIfIsolating,CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy,BlockInsecurePrivateNetworkRequests'
// );
app.commandLine.appendSwitch('enable-features', 'DisableOriginKeyedProcessesByDefault');

app.commandLine.appendSwitch('disable-features', [
    'SameSiteByDefaultCookies',
    'CookiesWithoutSameSiteMustBeSecure',
    'SchemefulSameSite',
    'ThirdPartyStoragePartitioning'
].join(','));

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-site-isolation-trials');

/***************************************************************************************
 * 화면을 내주는 custom protocol (u4a-ws://app/...)
 * -------------------------------------------------------------------------------------
 * 2026-10-27 장군님 지시 — 「우선 커스텀 프로토콜 방식으로 실행해야되고, 모든 브라우저
 *   윈도우 실행 부분은 커스텀 프로토콜 + 경로로, loadFile 로 하는게 아니고 loadUrl 함수로」.
 * scheme 등록은 app ready 전에 해야 먹으므로 여기(명령줄 옵션 바로 뒤)에서 부른다.
 * 화면 코드(renderer)는 REMOTE.getGlobal('u4aAppProtocol').toAppUrl(경로) 로 쓴다.
 ***************************************************************************************/
const WsAppProtocol = require('./lib/protocol/ws_app_protocol');
const WsHttpCookie = require('./lib/net/ws_http_cookie');

WsAppProtocol.registerScheme();

global.u4aAppProtocol = WsAppProtocol;

/**
 * 2026-10-27 — 화면 코드가 창에 배경색 CSS 를 넣을 때 쓰는 함수.
 *   창을 만든 직후에 바로 insertCSS 를 부르면 Electron 45 에서 깨지고 앱이 종료된다.
 *   화면 코드는 다음 한 줄로 부른다:
 *     REMOTE.getGlobal("u4aSetWindowCss")(oBrowserWindow, sWebConBodyCss);
 */
global.u4aSetWindowCss = WsAppProtocol.setWindowCss;

/**
 * 2026-10-27 — 화면 코드가 창을 띄울 때 주소를 바꾸는 함수.
 *   OS 경로(`D:\…\x.html`)는 Electron 45 에서 안 열린다. custom protocol 주소로 바꿔서 넘긴다.
 *   화면 코드는 다음 한 줄로 쓴다:
 *     oBrowserWindow.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));
 *   옛 loadFile 자리는 이렇게 옮긴다(loadFile 은 쓰지 않는다 — 장군님 지시):
 *     oWindow.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sPath, { query: {...} }));
 *   http · https(SAP 서버) 주소는 그대로 통과한다.
 */
global.u4aToAppUrl = WsAppProtocol.toAppUrl;

/***************************************************************************************
 * Remote Main Initialize
 ***************************************************************************************/
remoteMain.initialize();

/***************************************************************************************
 * Redefined - app.getAppPath
 ***************************************************************************************/
const originalGetAppPath = app.getAppPath.bind(app);

app.getAppPath = () => {
    const rootPath = originalGetAppPath();
    return rootPath.endsWith('www') ? rootPath : path.join(rootPath, 'www');
};

/***************************************************************************************
 * Remote Debugging Port
 *
 * @since   2026-02-04 23:36:43
 * @author  soccerhs
 * @description 환경 변수에 Remote debugging Port가 있을 경우에만 설정
 ***************************************************************************************/
// app.commandLine.appendSwitch('remote-debugging-port', "9222");
function configureRemoteDebuggingPort() {

    if (typeof process?.env?.WS_REMOTE_DEBUG_HOST === 'undefined') {
        return;
    }

    try {
        const oDebugHost = new URL(process.env.WS_REMOTE_DEBUG_HOST);
        app.commandLine.appendSwitch('remote-debugging-port', oDebugHost.port);
    } catch (error) {

    }

}

/***************************************************************************************
 * Deep Link
 ***************************************************************************************/
function configureDeepLink() {

    let sDeepLinkId = 'u4a-ws';

    if (!app.isPackaged) {
        // 2026-10-27 임시: 기존 WS4.0 과 OS 에 같은 deep link 가 등록되어 겹치지 않게 한다.
        sDeepLinkId = 'u4a-ws-dev-elecup';
    }

    if (process.defaultApp) {

        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient(sDeepLinkId, process.execPath, [path.resolve(process.argv[1])]);
        }

        return;
    }

    app.setAsDefaultProtocolClient(sDeepLinkId);

}

/***************************************************************************************
 * Single Instance Lock
 ***************************************************************************************/
function configureSingleInstanceLock() {

    /**
     * single instance lock 요청
     * 프로그램을 한 프로세스만 켜지도록 만드는 작업.
     */
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
        app.quit();
        return;
    }

    /**
     * @since   2026-03-04 16:11:08
     * @author  soccerhs
     * @description
     * 중복 실행 시 기존 창 활성화 로직 비활성화
     * - 사유: 인트로 실행 파일 구조 변경에 따라, 앱 중복 실행 시
     *   기존의 인트로 화면이 불필요하게 노출되거나 포커스되는 현상을 방지하기 위함.
     */
    // app.on('second-instance', () => {
    //     if (mainWindow) {
    //         if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
    //             mainWindow.show();
    //         }
    //         mainWindow.focus();
    //     }
    // });

}

/***************************************************************************************
 * App Icon
 ***************************************************************************************/
function getAppIconPath() {

    const appIconPath = path.join(__dirname, 'img', 'app.png');
    const iconPath    = path.join(__dirname, 'img', 'icon.png');
    const logoPath    = path.join(__dirname, 'img', 'logo.png');

    if (fs.existsSync(appIconPath)) return appIconPath;
    if (fs.existsSync(iconPath))    return iconPath;

    return logoPath;

}


/***************************************************************************************
 * samesite 회피 — https 응답의 쿠키를 다른 site 에서도 쓸 수 있게 고친다.
 *
 * 2026-10-27 Electron 45 로 올리면서 고쳤다 (장군님 보고 「https 인데 로그인 쿠키가 유지가 안된다」).
 *
 * 우리 화면은 `u4a-ws://` 이고 SAP 서버는 **다른 site** 다. 그래서 쿠키가 실리려면
 * **`SameSite=None` 과 `Secure` 두 가지가 다 있어야 한다.**
 *
 * 전에는 그 두 규칙이 Chromium switch 로 꺼져 있어서 그냥 됐다
 * (이 파일 위쪽 `disable-features` 의 `SameSiteByDefaultCookies` ·
 *  `CookiesWithoutSameSiteMustBeSecure`). **그 기능이 Chromium 에서 없어져 스위치가
 * 아무 일도 하지 않는다.** 그래서 여기서 직접 붙인다.
 *
 * ★`http` 응답은 건드리지 않는다 — http 는 `Secure` 쿠키를 저장할 수 없어서
 *   `electron/lib/net/ws_http_cookie.js` 가 쿠키를 직접 들고 다닌다.
 ***************************************************************************************/
function toCrossSiteCookie(sSetCookieLine) {

    let sCookie = String(sSetCookieLine);

    // SameSite 값을 None 으로. Strict · Lax · OFF 전부 해당한다.
    // 속성이 아예 없으면 붙인다 — 없으면 Lax 로 취급돼 다른 site 에 안 실린다.
    if (/;\s*SameSite\s*=/i.test(sCookie)) {
        sCookie = sCookie.replace(/;\s*SameSite\s*=\s*[^;]*/i, "; SameSite=None");
    } else {
        sCookie = sCookie + "; SameSite=None";
    }

    // SameSite=None 인데 Secure 가 없으면 Chromium 이 쿠키를 통째로 거부한다.
    if (!/;\s*Secure\s*(;|$)/i.test(sCookie)) {
        sCookie = sCookie + "; Secure";
    }

    return sCookie;

}

// 응답 헤더의 키는 서버가 보낸 대소문자 그대로 올 수 있다('Set-Cookie' · 'set-cookie').
// 소문자로 박아 두면 못 찾고 그냥 지나간다.
function findSetCookieKey(oHeaders) {

    for (const sKey in oHeaders) {

        if (sKey.toLowerCase() === "set-cookie") {
            return sKey;
        }

    }

    return "";

}

// 같은 host 는 한 번만 남긴다 — 응답마다 남기면 로그만 커지고 새 정보가 없다.
const oCookieFixLoggedHosts = new Set();

function logCookieFix(sUrl, aBefore) {

    let sHost = "";

    try {
        sHost = new URL(sUrl).host;
    } catch (e) {
        sHost = "";
    }

    if (!sHost) {
        return;
    }

    if (oCookieFixLoggedHosts.has(sHost)) {
        return;
    }

    oCookieFixLoggedHosts.add(sHost);

    // 쿠키 값은 인증 표다 — 남기지 않는다. 이름과 개수만 남긴다.
    const aNames = aBefore.map((sLine) => String(sLine).split("=")[0].trim());
    const iNoSameSite = aBefore.filter((sLine) => !/;\s*SameSite\s*=/i.test(sLine)).length;
    const iNoSecure = aBefore.filter((sLine) => !/;\s*Secure\s*(;|$)/i.test(sLine)).length;

    console.log("[MAIN-011] INFO | COOKIE_FIX | host=" + sHost
        + " | count=" + aBefore.length
        + " | names=" + aNames.join(",")
        + " | sameSiteMissing=" + iNoSameSite
        + " | secureMissing=" + iNoSecure);

}

function configureSession() {

    const filter = {
        urls: ["http://*/*", "https://*/*"]
    };

    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {

        const oHeaders = details.responseHeaders || {};
        const sKey = findSetCookieKey(oHeaders);
        const bHttps = String(details.url || "").toLowerCase().indexOf("https:") === 0;

        if (sKey && bHttps) {

            const aBefore = oHeaders[sKey] || [];

            if (aBefore.length > 0) {
                logCookieFix(details.url, aBefore);
                oHeaders[sKey] = aBefore.map(toCrossSiteCookie);
            }

        }

        callback({
            cancel: false,
            responseHeaders: details.responseHeaders
        });

    });
}

/***************************************************************************************
 * Main Window
 ***************************************************************************************/
function createWindow() {

    configureSession();

    mainWindow = new BrowserWindow({
        icon: getAppIconPath(),
        alwaysOnTop: true,
        transparent: true,
        show: false,
        frame: false,
        movable: true,
        resizable: false,
        width: 850,
        height: 500,
        minWidth: 850,
        minHeight: 500,
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false,
            nativeWindowOpen: true,
            webSecurity: false,
            nodeIntegrationInWorker: true,
            allowRunningInsecureContent: true
        }
    });

    // 2026-10-27 장군님 지시 — file:// 이 아니라 custom protocol 로 띄운다.
    const loadUrl = WsAppProtocol.toAppUrl(path.join(app.getAppPath(), 'intro3.html'));

    mainWindow.loadURL(loadUrl);

    // if (!app.isPackaged) {
    //     mainWindow.webContents.openDevTools();
    // }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

}

/***************************************************************************************
 * WebContents Helper
 ***************************************************************************************/
function redefineGetWebPreferences(contents) {

    contents.getWebPreferences = function() {
        const prefs = this.getLastWebPreferences() || {};
        return prefs;
    };

}

/***************************************************************************************
 * Alt + F4 Handling
 ***************************************************************************************/
function isAltF4KeyDown(input) {
    return input.code === 'F4' && input?.alt && input?.type === 'keyDown';
}

function isClosableWebContents(oWebContent) {

    if (!oWebContent) {
        return false;
    }

    if (
        typeof oWebContent?.isLoading          !== 'function' ||
        typeof oWebContent?.isLoadingMainFrame !== 'function' ||
        typeof oWebContent?.isCrashed          !== 'function' ||
        typeof oWebContent?.isDestroyed        !== 'function'
    ) {
        return false;
    }

    // 단축키 수행 시점에 아직 브라우저가 로드 중이거나,
    // 이미 브라우저가 죽어있거나 등의 경우에는 하위 로직 수행 하지 않는다.
    if (
        oWebContent.isLoading()          === true ||
        oWebContent.isLoadingMainFrame() === true ||
        oWebContent.isCrashed()          === true ||
        oWebContent.isDestroyed()        === true
    ) {
        return false;
    }

    if (typeof oWebContent?.getOwnerBrowserWindow !== 'function') {
        return false;
    }

    return true;

}

function closeOwnerBrowserWindow(oWebContent) {

    // 단축키 누른 위치의 브라우저 객체를 구한 후 해당 브라우저를 닫는다.
    const CURRWIN = oWebContent.getOwnerBrowserWindow();

    if (typeof CURRWIN?.close !== 'function') {
        return;
    }

    CURRWIN.close();

}

function attachBeforeInputEvent(contents) {

    /***********************************************************************
     * 실행되고 있는 브라우저에 키 관련 이벤트를 전파 하기 전에 호출되는 이벤트
     ***********************************************************************/
    contents.on('before-input-event', (event, input) => {

        if (typeof event === 'undefined' || typeof input === 'undefined') {
            return;
        }

        // F11 = 앱 창 전체화면 토글 (창 포커스 시에만, 전 프레임 커버).
        //   ★ 메인 프로세스의 before-input-event 는 "창당 1회 등록 + 입력당 1회 발화"라,
        //     렌더러(@electron/remote)에서 CURRWIN.webContents.on 으로 붙일 때 생기던 다중발화·중복
        //     바인딩(→ 단일 F11 에 2~3번 토글돼 "커졌다 작아졌다")이 없다. Alt+F4 와 동일한 정석 위치.
        //     OS 전역(globalShortcut)이 아니라 이 창이 포커스일 때만 동작 → 타 앱 F11 선점 없음.
        //   ★ 2026-09-10 수정 — 보정키(Shift/Ctrl/Alt/Meta)가 하나도 안 눌린 F11 만 전체화면으로 처리한다.
        //     그전에는 보정키를 안 봐서 Shift+F11(어플리케이션 복사)까지 여기서 가로채고
        //     event.preventDefault() 로 막아 버려, 화면까지 도달하지 못했다 → 복사 창이 안 뜨고
        //     전체화면만 켜졌다 꺼짐. 보정키가 붙은 F11 은 아래로 흘려보내 화면이 받게 한다.
        if (input.type === 'keyDown' && input.code === 'F11' && !input.isAutoRepeat) {

            if (input.shift || input.control || input.alt || input.meta) {
                // 보정키가 붙은 F11 → 전체화면 아님. 화면 쪽 단축키가 처리하도록 그대로 통과.
                WsMainLog.writeLog('알림', "GUARD_EXIT | F11 with modifier -> pass through to renderer"
                    + " | shift=" + !!input.shift + " ctrl=" + !!input.control
                    + " alt=" + !!input.alt + " meta=" + !!input.meta
                    + " @ electron/main.js before-input-event");
                return;
            }

            event.preventDefault();
            const oFsWin = BrowserWindow.fromWebContents(event.sender);
            if (oFsWin && !oFsWin.isDestroyed()) {
                oFsWin.setFullScreen(!oFsWin.isFullScreen());
            }
            return;
        }

        // 브라우저 단축키(Alt + F4 막기)
        if (!isAltF4KeyDown(input)) {
            return;
        }

        // 단축키 이벤트 전파 방지
        event.preventDefault();

        /**********************************************************
         * 목적:
         * - 브라우저 새 창 띄우자 마자 단축키로 alt+f4 눌렀을 때,
         *   브라우저가 실행 하려는 도중에 닫을려고 하다가
         *   오류 발생되는 문제로 인한 오류 방지 목적임.
         **********************************************************/

        // 키 이벤트 중, keyUp일 경우에만 수행
        // 키 이벤트중 keyDown 보단 keyUp이 조금 더 늦게 타기 때문에
        // 최대한 늦게 타는 시점으로 만들기 위함!!
        console.log(input.type);

        // if(input.type == "keyDown"){
        //     return;
        // }

        // if(input.type !== "keyUp"){
        //     return;
        // }

        const oWebContent = event?.sender;

        if (!isClosableWebContents(oWebContent)) {
            return;
        }

        closeOwnerBrowserWindow(oWebContent);

    });

}

/***************************************************************************************
 * App Event Bindings
 ***************************************************************************************/
function bindAppEvents() {

    app.whenReady().then(() => {

        // 2026-10-27 — 창을 만들기 전에 u4a-ws 핸들러를 설치해야 첫 화면부터 내줄 수 있다.
        WsAppProtocol.install(app);

        // 2026-10-27 — 화면의 __dirname 을 되살리는 preload 를 모든 session 에 건다.
        WsAppProtocol.installRendererDirname(app);

        /**
         * 2026-10-27 장군님 지시 — http SAP 서버에서도 로그인이 되게 한다.
         *   http 응답의 쿠키는 Chromium 이 저장을 거부한다(SameSite=None 에는 Secure 가 필요하고,
         *   Secure 쿠키는 https 응답만 저장할 수 있다). 그래서 **http 에 한해** 앱이 쿠키를
         *   직접 보관했다가 요청에 직접 붙인다. 까닭은 ws_http_cookie.js 머리말 참고.
         */
        WsHttpCookie.installAll(app);

        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });

    });

    //새 창이 생성시 수행 이벤트
    app.on('browser-window-created', (_, window) => {

        //자식 창에 remote 허용
        remoteMain.enable(window.webContents);

        // 2026-10-27 — 창이 주소를 못 열면 로그에 남긴다. 안 남기면 화면에는 엉뚱한 오류만 보인다.
        window.webContents.on('did-fail-load', (e, iErrCode, sErrDesc, sUrl, bIsMainFrame) => {

            if (bIsMainFrame === false) {
                return;
            }

            WsMainLog.writeLog('오류', 'NAV_FAIL | ' + sUrl + ' | code=' + iErrCode + ' | ' + sErrDesc);

        });

        // 2026-10-09 장군님 지시 (메인이 없으면 자식도 없다) — 메인 창이 사라지면 그 메인에서
        //   파생된 별창을 전부 없앤다. 별창에 parent 를 두지 않기로 해서(커스텀 헤더 창은 parent 가
        //   있으면 Minimize 후 되살릴 길이 없다) OS 가 같이 닫아 주던 그물이 사라졌다.
        //   화면 코드(로그오프·창 닫기·세션 종료)에도 넣었지만, 그 코드가 아예 안 도는 경우
        //   (화면이 터져 죽음 · 작업 관리자로 강제 종료)는 여기서만 잡힌다. 여기는 창을 누가
        //   만들었든 전부 걸리는 유일한 한 곳이다.
        try {

            // 창 설정값을 읽는다. 창이 만들어진 직후에는 아직 비어 있을 수 있어
            //   문서 로드가 끝난 뒤에도 한 번 더 읽는다. 창이 사라진 뒤에는 못 읽으므로 미리 기억해 둔다.
            const _readPref = function (oTarget) {
                try {
                    const oWebCon = oTarget.webContents;
                    if (!oWebCon || oWebCon.isDestroyed()) { return {}; }
                    if (typeof oWebCon.getWebPreferences === "function") {
                        return oWebCon.getWebPreferences() || {};
                    }
                    if (typeof oWebCon.getLastWebPreferences === "function") {
                        return oWebCon.getLastWebPreferences() || {};
                    }
                } catch (e) { /* 아래에서 빈 값으로 처리 */ }
                return {};
            };

            const iWinId = window.id;
            let sMainKey = "";

            const _remember = function () {
                const oPref = _readPref(window);
                // 메인 창만 OBJTY=MAIN 이다. 별창이면 기억할 것이 없다.
                if (oPref.OBJTY === "MAIN" && oPref.browserkey) { sMainKey = oPref.browserkey; }
            };

            _remember();
            window.webContents.on('did-finish-load', _remember);

            window.on('closed', () => {

                if (!sMainKey) { return; }   // 메인 창이 아니었다

                let iKilled = 0;

                BrowserWindow.getAllWindows().forEach((oWin) => {
                    try {
                        if (!oWin || oWin.isDestroyed() || oWin.id === iWinId) { return; }
                        const oChildPref = _readPref(oWin);
                        if (oChildPref.browserkey !== sMainKey) { return; }
                        if (oChildPref.OBJTY === "MAIN") { return; }   // 다른 메인 창은 건드리지 않는다
                        // destroy: 별창이 "처리 중에는 못 닫음"으로 거는 차단을 타지 않는다.
                        oWin.destroy();
                        iKilled++;
                    } catch (e) {
                        console.error("[MAIN-010] child window cleanup failed:", e && e.message, e);
                    }
                });

                if (iKilled > 0) {
                    console.log("[MAIN-010] main window gone - destroyed " + iKilled + " child window(s)");
                }

            });

        } catch (e) {
            console.error("[MAIN-010] child window cleanup hook not installed:", e && e.message, e);
        }

        if (!app.isPackaged) {
            window.webContents.openDevTools();
        }

    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    /***********************************************************************
     * 브라우저가 생성될 때 호출 되는 이벤트
     ***********************************************************************/
    app.on('web-contents-created', (event, contents) => {

        redefineGetWebPreferences(contents);
        attachBeforeInputEvent(contents);

    });

}

/***************************************************************************************
 * Bootstrap
 ***************************************************************************************/
configureRemoteDebuggingPort();
configureDeepLink();
configureSingleInstanceLock();
bindAppEvents();