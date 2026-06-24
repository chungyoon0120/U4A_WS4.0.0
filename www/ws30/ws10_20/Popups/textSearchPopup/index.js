
const 
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey();


module.exports = function(REMOTE, oAPP){

    const CURRWIN = REMOTE.getCurrentWindow();

    // 팝업 고유 이름
    const sPopupName = "TXTSRCH";

    // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
    const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
    if (oResult.ISOPEN) {
        return;
    }

    // theme 정보
    const oThemeInfo = parent.getThemeInfo(); 

    // Browswer Options
    const 
        sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));       


        oBrowserOptions.autoHideMenuBar = true;
        
        // oBrowserOptions.width = 380;
        // oBrowserOptions.minWidth = 380;
        // oBrowserOptions.height = 60;
        // oBrowserOptions.minHeight = 60;


        oBrowserOptions.width = 400;
        oBrowserOptions.minWidth = 400;
        oBrowserOptions.height = 49;
        oBrowserOptions.minHeight = 49;


        oBrowserOptions.frame = false;
        oBrowserOptions.thickFrame = false;
        // ★ 투명 창 — 둥근 찾기 바만 떠 보이게(불투명 사각 창이면 모서리가 각져 보임, 특히 최대화 시).
        oBrowserOptions.transparent = true;
        oBrowserOptions.backgroundColor = "#00000000";   // Windows 투명창 검정 방지(완전 투명)
        oBrowserOptions.hasShadow = false;               // 투명창은 OS 사각 그림자 끄고 CSS 로 처리
        oBrowserOptions.center = false;
        oBrowserOptions.resizable = false;
        oBrowserOptions.parent = CURRWIN;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;        

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions); 

        // 투명 창 — 외곽(index.html) html/body 는 투명, 실제 배경은 iframe 안 찾기 바가 가진다.
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: transparent; }`;

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

        oBrowserWindow.hide();

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!REMOTE.app.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        oBrowserWindow.once('ready-to-show', () => {
            lf_move();
        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {
         
            let oOptionData = {           
                oThemeInfo: oThemeInfo, // 테마 정보                
            };
            
            oBrowserWindow.webContents.send('if-text-search', oOptionData);

            lf_move();

            // setTimeout(() => {
            //     oBrowserWindow.show();
            // }, 10);

        });

        oBrowserWindow.webContents.on("dom-ready", function () {

            lf_move();

        });

        // function lf_move() {

        //     let oCurrWin = REMOTE.getCurrentWindow();

        //     // // 팝업 위치를 부모 위치에 배치시킨다.
        //     var oParentBounds = oCurrWin.getBounds(),
        //         oBrowserBounds = oBrowserWindow.getBounds();

        //     let xPos = (oParentBounds.x + oParentBounds.width) - 390,
        //         yPos = Math.round((oParentBounds.y) + 30)

        //     if (oParentBounds.y > oBrowserBounds.y) {
        //         yPos = oParentBounds.y + 10;
        //     }

        //     oBrowserWindow.setBounds({
        //         x: xPos,
        //         y: yPos
        //     });

        // }



        function lf_move() {

            let oCurrWin = REMOTE.getCurrentWindow();

            // // 팝업 위치를 부모 위치에 배치시킨다.
            var oParentBounds = oCurrWin.getBounds(),
                oBrowserBounds = oBrowserWindow.getBounds();

            let xPos = (oParentBounds.x + oParentBounds.width) - 410,
                yPos = Math.round((oParentBounds.y) + 40)

            if (oParentBounds.y > oBrowserBounds.y) {
                yPos = oParentBounds.y + 10;
            }

            oBrowserWindow.setBounds({
                x: xPos,
                y: yPos
            });

        }

        // 부모 창이 움직일려고 할때 타는 이벤트
        function lf_will_move() {

            lf_move();

            oBrowserWindow.hide();

        }

        // 부모 창이 움직임 완료 되었을 때 타는 이벤트
        function lf_moved() {

            lf_move();

            oBrowserWindow.show();

        }

        function lf_off() {

            CURRWIN.off("maximize", lf_move);
            CURRWIN.off("unmaximize", lf_move);

            CURRWIN.off('will-move', lf_will_move);
            CURRWIN.off("move", lf_move);
            CURRWIN.off('moved', lf_moved);

            CURRWIN.off('will-resize', lf_will_move);
            CURRWIN.off('resize', lf_move);
            CURRWIN.off('resized', lf_moved);

            CURRWIN.off("restore", lf_move);

            CURRWIN.off("enter-full-screen", lf_move);
            CURRWIN.off("leave-full-screen", lf_move);

            REMOTE.screen.off('display-metrics-changed', lf_screenChange);

        }

        lf_off();

        CURRWIN.on('maximize', lf_move);
        CURRWIN.on('unmaximize', lf_move);

        CURRWIN.on('will-move', lf_will_move);
        CURRWIN.on('move', lf_move);
        CURRWIN.on('moved', lf_moved);

        CURRWIN.on('will-resize', lf_will_move);
        CURRWIN.on('resize', lf_move);
        CURRWIN.on('resized', lf_moved);     

        CURRWIN.on('restore', lf_move);
        CURRWIN.on('enter-full-screen', lf_move);
        CURRWIN.on('leave-full-screen', lf_move);


        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {

            lf_off();

            oBrowserWindow = null;

            CURRWIN.focus();

        });

        function lf_screenChange() {
            lf_move();
        }

        REMOTE.screen.on('display-metrics-changed', lf_screenChange);

};