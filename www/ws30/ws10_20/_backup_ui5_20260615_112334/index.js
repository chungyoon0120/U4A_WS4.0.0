/*************************************************************
 * @function - Node 글로벌 변수를 백업본으로부터 복구한다.
 *             UI5 attachInit 이후 호출.
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
 * @function - 메인화면 초기 렌더링
 *************************************************************/
async function _initRendering() {

    let sViewPath = parent.PATH.join(parent.__dirname, "views", "vw_main", "view.js");

    const oRes = await import(sViewPath);
    const oView = await oRes.getView();

    oAPP.views.VW_MAIN = {};
    oAPP.views.VW_MAIN = oView;

    let oMainAPP = oAPP.views.VW_MAIN.ui.APP;

    let oDelegate = {
        onAfterRendering: async function () {

            oMainAPP.removeEventDelegate(oDelegate);

            let oContentDom = document.getElementById("content");

            jQuery(oContentDom).fadeIn({ duration: 1500 });

            await oAPP.views.VW_MAIN.onViewReady();

        }
    };

    oMainAPP.addEventDelegate(oDelegate);

    oMainAPP.placeAt("content");

} // end of _initRendering


/*************************************************************
 * @function - 부트스트립 로드 이후에 호출되는 이벤트
 *************************************************************/
// async function _data_sap_ui_oninit() {

//     _restoreNodeGlobals();

//     await _initRendering();

// } // end of _data_sap_ui_oninit

/*************************************************************
 * @function - 부트스트립 로드 이후에 호출되는 이벤트
 *************************************************************/
async function _data_sap_ui_oninit() {

    _restoreNodeGlobals();

    let oUserInfo = parent.getUserInfo();
    if(oUserInfo){

        document.getElementById("content").style.display = "none";

        // // oContr.ui.ROOT_PAGE.destroyContent();
        // oContr.ui.APP.destroy();
        
        let oScript = document.createElement("script");
        oScript.src = "./js/library-preload.js";

        document.body.appendChild(oScript);

        return;
    }

    await _initRendering();

} // end of _data_sap_ui_oninit


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

    // // 이동할 페이지
    // if (oMetadata.EXEPAGE) {
    //     onMoveToPage(oMetadata.EXEPAGE);
    // }

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
     * 🔥 UI5와 Electron Node의 충돌 방지 로직
     *    - UI5 bootstrap 로드 전 글로벌 require/module 을 제거하고,
     *      attachInit 이후 _restoreNodeGlobals() 로 복구한다.
     ******************************************************************************/

    (function () {
        if (typeof module !== 'object' || typeof require !== 'function') {
            return;
        }

        console.log('[System] Node environment detected. Isolating global variables for UI5 bootstrap...');

        window.__node = {
            require: window.require,
            module: window.module,
            exports: window.exports
        };

        window.require = undefined;
        window.module = undefined;
        window.exports = undefined;
    }());


    /****************************************************************************
     * 🔥 UI5 Bootstrap 삽입
     ****************************************************************************/

    (function () {

        let oSettings = parent.WSUTIL.getWsSettingsInfo();
        let oSetting_UI5 = oSettings.UI5;
        let oBootStrap = oSetting_UI5.bootstrap;
        let oThemeInfo = parent.getThemeInfo();
        let sLangu = oSettings.globalLanguage;

        let oScript = document.createElement('script');
        oScript.id = 'sap-ui-bootstrap';

        // 기본 bootstrap 속성 주입
        for (const key in oBootStrap) {
            oScript.setAttribute(key, oBootStrap[key]);
        }

        // 추가 속성 설정
        oScript.setAttribute('data-sap-ui-theme', oThemeInfo.THEME);
        oScript.setAttribute('data-sap-ui-language', sLangu);
        oScript.setAttribute('data-sap-ui-libs', 'sap.m, sap.tnt, sap.ui.table, sap.ui.layout, sap.f, sap.ui.codeeditor, sap.ui.unified');
        oScript.setAttribute('src', oSetting_UI5.resourceUrl);
        oScript.setAttribute('data-sap-ui-resourceroots', JSON.stringify({ i18n_root: './' }));
        oScript.setAttribute("data-sap-ui-oninit", "_data_sap_ui_oninit");

        document.head.appendChild(oScript);

    }());


});