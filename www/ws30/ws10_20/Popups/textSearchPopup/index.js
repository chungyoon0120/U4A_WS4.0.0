
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
        // 불투명 창 — 투명창은 Windows 에서 모서리가 검게 렌더되는 글리치가 있어 안 씀.
        //   바가 창을 꽉 채우는 직사각(둥근모서리 X)이라 모서리 mismatch 없음. 창 배경=테마색(insertCSS).
        oBrowserOptions.transparent = false;
        oBrowserOptions.center = false;
        oBrowserOptions.resizable = false;
        oBrowserOptions.parent = CURRWIN;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;        

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions); 

        // 외곽 창 배경 = 테마색(플래시 방지). 바(iframe)가 꽉 채우므로 로드 중에만 보임.
        const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${(oThemeInfo && oThemeInfo.BGCOL) || "#ffffff"}; }`;

        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // SYSID 를 문자열로 직접 전달 — USERINFO(객체)는 쿼리 직렬화에서 깨질 수 있어
            //   테마 JSON 경로/테마변경 IPC 채널이 어긋난다(팝업에서 테마 미적용/미반영 원인).
            SYSID: (parent.process.USERINFO && parent.process.USERINFO.SYSID) || "",
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