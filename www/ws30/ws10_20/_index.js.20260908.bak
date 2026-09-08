/*************************************************************
 * U4A Workspace - 메인 프레임 부트스트랩 (HTML5)
 *
 * [컨버전 메모]
 *  - 원본은 UI5 부트스트랩(<script id="sap-ui-bootstrap">)을 동적 주입하고
 *    attachInit 이후 vw_main(UI5 View)을 placeAt 했다.
 *  - HTML5 버전에서는 UI5 로더를 제거하고, vw_main(HTML5)을 직접 마운트한다.
 *  - Electron/Node 연동(IPC if-meta-info, parent 전역, getUserInfo 등)은 그대로 유지.
 *************************************************************/

// 중복 초기화 방지 플래그
let _bMainFrameInited = false;


/*************************************************************
 * @function - Node 글로벌 복구 (UI5 미사용 시 no-op, 호환 위해 유지)
 *************************************************************/
function _restoreNodeGlobals() {

    if (!window.__node) {
        return;
    }

    console.log('[System] Restoring Node environment variables...');

    window.require = window.__node.require;
    window.module = window.__node.module;
    window.exports = window.__node.exports;

    delete window.__node;

} // end of _restoreNodeGlobals


/*************************************************************
 * @function - 메인화면 초기 렌더링 (HTML5 vw_main 마운트)
 *************************************************************/
async function _initRendering() {

    let sViewPath = PATHINFO.WS10_20_ROOT + "/views/vw_main/view.js";

    // file:/// URL 로 변환 (윈도우 경로 → ESM import 가능 형태)
    let URL = require('url');
    let sViewUrl = URL.pathToFileURL(sViewPath).href;

    const oRes = await import(sViewUrl);
    const oView = await oRes.getView();

    oAPP.views.VW_MAIN = oView;

    let oContentDom = document.getElementById("content");

    // HTML5 프레임을 #content 에 마운트
    oView.mount(oContentDom);

    // (WS3.0 원형) #content 페이드인. 흰색 플래시는 --boot-bg 동기 캔버스로 방지됨.
    jQuery(oContentDom).fadeIn({ duration: 1000 });

    await oView.onViewReady();

} // end of _initRendering


/*************************************************************
 * @function - 메인 프레임 초기화 진입점
 *             (원본 _data_sap_ui_oninit 의 HTML5 대체)
 *************************************************************/
async function _mainFrameInit() {

    if (_bMainFrameInited) {
        return;
    }
    _bMainFrameInited = true;

    _restoreNodeGlobals();

    // 로그인 유저 정보가 이미 있으면(로그인 후 새창) WS 본 앱을 바로 로드
    let oUserInfo = parent.getUserInfo();
    if (oUserInfo) {

        document.getElementById("content").style.display = "none";

        let oScript = document.createElement("script");
        oScript.src = "./js/library-preload.js";

        document.body.appendChild(oScript);

        return;
    }

    // 로그인 전: HTML5 프레임(헤더+빈 바디)을 렌더링하고, 바디에 로그인 화면 로드
    await _initRendering();

} // end of _mainFrameInit


/**
 *  Electron Event
 */

// 전달받은 Meta 정보를 저장한다.
IPCRENDERER.on('if-meta-info', (event, res) => {

    var oMetadata = res;

    // 메타데이터 정보
    if (oMetadata.METADATA) {
        setMetadata(oMetadata.METADATA);
    }

    // Default Browser 정보
    if (oMetadata.DEFBR) {
        parent.setDefaultBrowserInfo(oMetadata.DEFBR);
    }

    // 서버 정보
    if (oMetadata.SERVERINFO) {
        oWS.oServerInfo = oMetadata.SERVERINFO;
    }

    // 이전 서버 접속 정보
    if (oMetadata.BeforeServerInfo) {
        parent.setBeforeServerInfo(oMetadata.BeforeServerInfo);
    }

    // 로그인 유저 정보
    if (oMetadata.USERINFO) {
        setUserInfo(oMetadata.USERINFO);
    }

    // 브라우저 세션 키 정보
    if (oMetadata.SESSIONKEY) {
        setSessionKey(oMetadata.SESSIONKEY);
    }

    // 브라우저 키 정보
    if (oMetadata.BROWSERKEY) {
        setBrowserKey(oMetadata.BROWSERKEY);
    }

    // 테마정보
    if (oMetadata.THEMEINFO) {
        setThemeInfo(oMetadata.THEMEINFO);
    }

    // 새창 실행 후 IF 데이터가 있을 경우
    if (oMetadata.IF_DATA) {
        setNewBrowserIF_DATA(oMetadata.IF_DATA);
    }

    // 새창일 경우 process object에 USERINFO 정보를 저장한다.
    const
        CURRWIN = REMOTE.getCurrentWindow(),
        WEBCON = CURRWIN.webContents,
        WEBPREF = WEBCON.getWebPreferences(),
        USERINFO = WEBPREF.USERINFO;

    if (USERINFO) {
        // 새창 띄울 경우 process
        setProcessEnvUserInfo(USERINFO);
    }

    // 타이틀 설정
    CURRWIN.setTitle("U4A Workspace - #Main");

    /******************************************************************************
     * 🔥 메타 정보 수신 완료 → HTML5 메인 프레임 초기화
     *    (원본은 이 시점에 UI5 bootstrap 을 주입했으나, HTML5 에서는 직접 init)
     ******************************************************************************/
    _mainFrameInit();

});


/******************************************************************************
 * 🔧 [DEV] 직접 로드(메타 정보 IPC 미수신) 대비 폴백 초기화
 *    - 정상 부팅에서는 if-meta-info 수신 시 init 되므로 아래는 거의 타지 않음.
 *    - index.html 을 단독으로 띄워 빈 메인 프레임을 확인할 때 동작.
 ******************************************************************************/
window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if (!_bMainFrameInited) {
            console.log("[DEV] if-meta-info 미수신 → 폴백 초기화 실행");
            _mainFrameInit();
        }
    }, 600);
});
