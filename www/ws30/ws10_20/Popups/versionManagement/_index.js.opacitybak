
const 
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey(),
    USERINFO = parent.getUserInfo();
    


module.exports = function(REMOTE, oAPP){

    // busy 키고 Lock 걸기
    oAPP.common.fnSetBusyLock("X");

    // // 전체 자식 윈도우에 Busy 킨다.
    // oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_ON" });

    const CURRWIN = REMOTE.getCurrentWindow();

    // 팝업 고유 이름
    const sPopupName = "VER_MNG_POPUP";

    // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
    const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
    if (oResult.ISOPEN) {

        // 부모 위치 가운데 배치한다.            
        parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");

        // // 전체 자식 윈도우에 Busy 끈다.
        // oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_OFF" });

        return;
    }

    // theme 정보
    const oThemeInfo = parent.getThemeInfo(); 

    // Browswer Options
    const 
        sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));        

        oBrowserOptions.title = parent.WSUTIL.getWsMsgClsTxt(USERINFO.LANGU, "ZMSG_WS_COMMON_001", "403"); // Version Management
        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.parent = CURRWIN;        
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL; //테마별 색상 처리
        oBrowserOptions.modal = false;
        oBrowserOptions.closable = false;
        oBrowserOptions.width = 1200;
        
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
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
        };

        const sPopupPath = PATH.join(__dirname, "Popup", "index.html");

          // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sPopupPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!REMOTE.app.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        oBrowserWindow.once('ready-to-show', () => {
            
            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

            // busy 끄고 Lock 풀기
            oAPP.common.fnSetBusyLock("");

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {
         
            const oOptionData = {
                BROWSKEY: BROWSKEY, // 브라우저 고유키                 
                sServerHost: parent.getHost(), //  서버 호스트 정보
                sServerPath: parent.getServerPath(), // 서버 Url
                oAppInfo: parent.getAppInfo(),  // 앱 정보               
                oThemeInfo: oThemeInfo, // 테마 정보                
            };
            
            oBrowserWindow.webContents.send('if-version-management', oOptionData);

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });        
    
        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            oBrowserWindow = null;

            parent.IPCMAIN.off(`${BROWSKEY}-if-version-management-new-window`, _fnNewWindow);

            CURRWIN.focus();

        });

        parent.IPCMAIN.on(`${BROWSKEY}-if-version-management-new-window`, _fnNewWindow);

        function _fnNewWindow(event, res){

            const TAPPID = res.TAPPID;

            const oIF_DATA = {
                ACTCD: "MOVE20",    // 새창 띄우면서 20번으로 넘어가는 액션 코드
                APPID: TAPPID       // 실행 어플리케이션명
            };

            // 새창 띄우면서 APPID에 대한 20번 페이지로 이동
            parent.onNewWindow(oIF_DATA);

        }

};