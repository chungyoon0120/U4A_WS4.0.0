// 오류코드 접두: MFRM / 다음 번호: 002
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

    // ★ [2026-09-15, 장군님 지시] 새창이 뜨면 처음 호출되는 곳 — 여기서 busy 부터 켠다.
    //   [고친 이유] 로그인 후 새창이 busy 없이 검은 화면으로 먼저 보였다(장군님 실측 2026-09-15).
    //   해제는 메인 본문 등장 완료(js/ws_main.js) · 첫 화면 본문 그리기(js/ws10_html.js) ·
    //   로그인 화면 준비 완료(Login/Login.js)가 한다.
    if (typeof setDomBusy === "function") {
        setDomBusy("X");
    } else {
        console.error("[MFRM-001] setDomBusy not found - new window starts without busy");
    }

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

        /**
         * 접속 서버 로그 (2026-09-08 추가)
         * -------------------------------------------------------------
         * 왜 여기인가: 창이 "어느 서버에 붙었는지" 처음 알게 되는 자리다.
         * 무엇을 남기나: 서버 이름·시스템 번호·클라이언트 정도.
         *              비밀번호나 접속 열쇠는 남기지 않는다.
         */
        try {

            if (typeof U4ALOG !== "undefined") {

                var _oSrv = oMetadata.SERVERINFO;
                var _sSrv = "";

                _sSrv += (_oSrv.NAME || _oSrv.host || "(이름 없음)");

                if (_oSrv.SYSID) { _sSrv += " / 시스템 " + _oSrv.SYSID; }
                if (_oSrv.CLIENT) { _sSrv += " / 클라이언트 " + _oSrv.CLIENT; }
                if (_oSrv.LANGU) { _sSrv += " / 언어 " + _oSrv.LANGU; }

                U4ALOG.info("접속 서버", _sSrv, "");

            }

        } catch (e) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
            // 로그 때문에 창이 뜨는 것을 막으면 안 된다.
        }

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
 ******************************************************************************
 * ★★[2026-10-27 장군님 지시 — 노션 오류 70] 통째로 주석 처리했다. (우선 주석만, 삭제는 나중에)
 *
 * 무엇이 문제였나:
 *   이 코드는 화면이 준비되고 **0.6초**가 지나도 메인 창에서 접속 서버·사용자 정보가 안 오면
 *   **서버 정보 없이** 화면을 그려 버린다. 그러면 로그인 화면이 접속 서버를 묻는 자리에서
 *   SYSID 를 읽다 터진다 → 「새 Workspace 창 열기」 를 누르면 Critical Error 창이 떴다.
 *   (TypeError: Cannot read properties of undefined (reading 'SYSID')
 *    at fnGetRememberCheck → fnOnInitModelBinding → _onViewReady → fnInit)
 *
 *   no-build 에서는 새 창마다 개발자 도구를 자동으로 연다(resources/index.js). 그게 0.6초를
 *   쉽게 먹는다. 중단점을 걸면 **반드시** 재현된다. 느린 PC 에서도 같다.
 *
 * 왜 없애도 되나 (소스로 확인):
 *   이 화면(index.html)을 띄우는 곳은 3곳이고, **전부 로드가 끝나는 그 자리에서 바로**
 *   메타정보를 보낸다 — 「로드는 됐는데 정보만 안 오는」 경우가 없다.
 *     · 앱 시작(로그인 전)      = intro.js
 *     · 서버 목록에서 접속        = ServerList_v2/ServerList.js
 *     · 새 Workspace 창 열기     = ws30/resources/index.js
 *   로드 자체가 실패하면 화면이 안 뜨므로 이 폴백도 의미가 없고, 세 곳 다 실패 처리가 따로 있다.
 *   없애서 사라지는 것은 **화면 파일을 앱 없이 직접 열어 보는 개발 편의** 하나뿐이다.
 *
 * 되돌리려면: 아래 주석을 풀면 된다. 단 그때는 판별을 **시간이 아니라 실제 값**으로 바꿀 것
 *   (세션 키가 있으면 앱이 띄운 창이니 기다리고, 없으면 단독 로드로 보고 그린다).
 ******************************************************************************/
// window.addEventListener("DOMContentLoaded", () => {
//     setTimeout(() => {
//         if (!_bMainFrameInited) {
//             console.warn("[WARN] could not get server info - initializing with defaults");
//             _mainFrameInit();
//         }
//     }, 600);
// });
