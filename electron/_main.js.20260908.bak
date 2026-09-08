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
        sDeepLinkId = 'u4a-ws-dev';
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


// samesite 회피
function configureSession() {

    const filter = {
        urls: ["http://*/*", "https://*/*"]
    };

    session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {

        let cookies = (details.responseHeaders['set-cookie'] || []).map((cookie) => {

            if (cookie.indexOf("SameSite=OFF") > 0 || cookie.indexOf("SameSite=None") > 0) {
                return cookie;
            }

            let sCookie = cookie;

            sCookie = sCookie.replace('SameSite=Strict', 'SameSite=None');
            sCookie = sCookie.replace('SameSite=Lax', 'SameSite=None');

            return sCookie;

        });

        if (cookies.length > 0) {
            details.responseHeaders['set-cookie'] = cookies;
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

    const loadUrl = path.join(app.getAppPath(), 'intro3.html');
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
        if (input.type === 'keyDown' && input.code === 'F11' && !input.isAutoRepeat) {
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