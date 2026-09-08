// 오류코드 접두: UCSS / 다음 번호: 002

/*******************************************************************
 *  IF_DATA 필수 파라미터
 * - SESSKEY : 세션이 있어야 서버 로그인 할 수 있음.
 * - BROWSKEY: IPC 통신할 때 다른 브라우저 호출을 막을 수 있음.
 *******************************************************************/

export async function start(require, IF_DATA, fnCallback){

    // 단독으로 실행한다 생각하고 짤것!!!

    if(!IF_DATA){
        var IF_DATA = {};
    }
   
    let sPopupName = "UI5CSSPOP_V2";

    const 
        REMOTE = require('@electron/remote'),
        IPCMAIN = REMOTE.require('electron').ipcMain,
        
        CURRWIN = REMOTE.getCurrentWindow(),
        PATH = REMOTE.require('path'),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFOURL = PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"),
        PATHINFO = require(PATHINFOURL),
        WSUTIL = require(PATHINFO.WSUTIL),
        SETTINGS = require(PATHINFO.WSSETTINGS),
        oSetting_UI5 = SETTINGS.UI5;

    let SESSKEY = IF_DATA.SESSKEY;
    let BROWSKEY = IF_DATA.BROWSKEY;
    let oUserLoginInfo = await WSUTIL.getSysInfoIPC({ PRCCD: "USER_LOGIN_INFO", BROWSKEY: BROWSKEY });
    
    // 테마 관련 정보 — HTML5 WS4 메인 셸의 테마 정보(parent.getThemeInfo → {THEME, BGCOL}).
    //   ★ 원본은 sap.ui.core.theming.Parameters 사용 → HTML5 메인 셸엔 UI5 미로드라 크래시.
    //     다른 별창 opener(bindPopup/mimeRepo 등)와 동일하게 셸 테마 JSON 소스로 교체.
    let oThemeInfo = (typeof parent.getThemeInfo === "function" ? parent.getThemeInfo() : null) || { THEME: "", BGCOL: "" };

    IF_DATA.SESSKEY          = SESSKEY;
    IF_DATA.BROWSKEY         = BROWSKEY;
    IF_DATA.USER_LOGIN_INFO  = oUserLoginInfo;
    IF_DATA.USER_INFO        = await WSUTIL.getSysInfoIPC({ PRCCD: "USER_INFO",   BROWSKEY: BROWSKEY });    
    IF_DATA.SERVER_HOST      = await WSUTIL.getSysInfoIPC({ PRCCD: "SERVER_HOST", BROWSKEY: BROWSKEY });
    IF_DATA.SERVER_PATH      = await WSUTIL.getSysInfoIPC({ PRCCD: "SERVER_PATH", BROWSKEY: BROWSKEY });
    IF_DATA.SERVER_BOOT_PATH = IF_DATA.USER_INFO.META.LIBPATH;
    // ★[2026-09-08 장군님 지시] ★패키지(APP.isPackaged)일 때만★ 팝업 "틀"(main/index.js) + "다른 CSS 가이드"(others/M1·M2) 의
    //   UI5 부트 소스를 로컬 리소스 대신 서버 UI5(접속 서버 + LIBPATH)로 쓴다. 패키지에 로컬 UI5 를 더 이상 싣지 않기
    //   때문(node_modules/U4A 없음 → 틀이 못 떠 "통신 오류(391)" 안내). 개발 모드(isPackaged=false)는 원본 설계 그대로
    //   resourceUrl(=CDN 테스트 경로) 유지 — 일부러 나눠 둔 설계(장군님)라 건드리지 않는다.
    //   서버 경로 계산식 = 오른쪽 미리보기(detail)와 동일(main/views/control.js _setCssMenuConfig 의 '임시로직' 포함).
    //   실패 처리 추가 없음 — 로드 실패(onerror)·sap 없음 검사가 main/index.js 에 이미 있다. 타이머·사전 ping 금지(장군님).
    IF_DATA.WS30_BOOT_PATH   = oSetting_UI5.resourceUrl;
    if (APP.isPackaged) {
        // LIBPATH 없음 = 필수 의존성 없음 → 오류코드로 표면화하고 중단(throw → 오프너 fnUI5PreCssPopupOpener 의 catch 가 busy 해제).
        if (typeof IF_DATA.SERVER_BOOT_PATH !== "string" || IF_DATA.SERVER_BOOT_PATH === "") {
            console.error("[UCSS-001] start: USER_INFO.META.LIBPATH 없음 — 서버 UI5 부트 경로를 만들 수 없어 팝업을 열지 않음.");
            throw new Error("[UCSS-001] LIBPATH missing");
        }
        IF_DATA.WS30_BOOT_PATH = IF_DATA.SERVER_HOST + IF_DATA.SERVER_BOOT_PATH;
        // 임시로직(원본 그대로): 서버 라이브러리 경로가 '/zu4a_imp/' 로 시작하지 않으면 호스트를 붙이지 않고 경로 전체를 그대로 본다.
        if (IF_DATA.SERVER_BOOT_PATH.substring(0, 10) !== "/zu4a_imp/") {
            IF_DATA.WS30_BOOT_PATH = IF_DATA.SERVER_BOOT_PATH;
        }
    }
    IF_DATA.SUBROOT_PATH     = "/getui5_pre_css_v2";
    IF_DATA.THEME_INFO       = oThemeInfo;

    let LANGU = IF_DATA.USER_LOGIN_INFO.LANGU;
    let SYSID = IF_DATA.USER_LOGIN_INFO.SYSID;
    let WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);
    
    // 메시지 클래스 정보 구하는 function
    const fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);

    // 브라우저 옵션 설정
    const 
        sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = fnGetMsgClsText("/U4A/CL_WS_COMMON", "B58"); // UI5 Predefined CSS
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;
        oBrowserOptions.width = 1200;

        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = "hidden";

        // [HTML5] 네이티브 opacity 페이드 미사용(흰 번쩍/OS 리컴포짓) — backgroundColor 로 즉시 불투명,
        //   위치 확정 후 frame.js 가 CURRWIN.show(). (frameless-opener-no-native-opacity)
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        // oBrowserOptions.webPreferences.USERINFO = oUserLoginInfo;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;
    
    // 브라우저 오픈
    let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);     

    // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
    const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;

    oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

    // 브라우저 상단 메뉴 없애기        
    oBrowserWindow.setMenu(null);

    const oQueryParams = {
        browserkey: oBrowserOptions?.webPreferences?.browserkey,
        sessionKey: oBrowserOptions?.webPreferences?.partition,
        OBJTY: sPopupName,
        USERINFO: parent.process.USERINFO,
        // [HTML5] frameless 창 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
        THEME: oThemeInfo.THEME,
        BGCOL: oThemeInfo.BGCOL,
        TITLE: oBrowserOptions.title,
    };

    const sUrlPath = parent.getPath(sPopupName);

    // URL에 QueryString 파라미터를 적용한다.
    const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

    oBrowserWindow.loadURL(sLoadUrl);

    // no build 일 경우에는 개발자 툴을 실행한다.
    // if (!APP.isPackaged) {
    //     oBrowserWindow.webContents.openDevTools();
    // }

    // 브라우저가 활성화 될 준비가 될때 타는 이벤트
    oBrowserWindow.once('ready-to-show', () => {

        // 부모 위치 가운데 배치한다.
        WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow, oBrowserOptions);

    });
 
    // 브라우저가 오픈이 다 되면 타는 이벤트
    oBrowserWindow.webContents.on('did-finish-load', function () {

        // 오픈할 URL 파라미터 전송
        oBrowserWindow.webContents.send('if-ui5css-info', IF_DATA);

        // 부모 위치 가운데 배치한다.
        WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow, oBrowserOptions);

    });    

    // 브라우저를 닫을때 타는 이벤트
    oBrowserWindow.on('closed', () => {

        IPCMAIN.off(`${IF_DATA.BROWSKEY}--if-ui5css`, lf_ui5css_getData);

        oBrowserWindow = null;

        try {

            CURRWIN.focus();    

        } catch (error) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
            
        }

    });

    IPCMAIN.on(`${IF_DATA.BROWSKEY}--if-ui5css`, lf_ui5css_getData);

    function lf_ui5css_getData(event, res) {

        if(typeof fnCallback === "function"){

            res.WIN = oBrowserWindow;

            fnCallback(res);
            
            return;
        }

    }

};