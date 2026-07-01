
const 
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey();

const USERINFO = parent.process.USERINFO;

module.exports = function(REMOTE, oAPP){


    // busy 키고 Lock 걸기
    oAPP.common.fnSetBusyLock("X");

    // 전체 자식 윈도우에 Busy 킨다.
    oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_ON" });

    let CURRWIN = REMOTE.getCurrentWindow();

    // 팝업 고유 이름
    let sPopupName = `ATTR_PRESET_POPUP-${USERINFO.SYSID}`;


    // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
    let oResult = oAPP.common.getCheckAlreadyOpenWindow2(sPopupName);
    if (oResult.ISOPEN) {

        // 부모 위치 가운데 배치한다.            
        parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);

        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");

        // 전체 자식 윈도우에 Busy 끈다.
        oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_OFF" });

        //해당 윈도우를 맨 앞으로 이동 처리.
        oResult.WINDOW.show();
        oResult.WINDOW.focus();

        return;
    }

    // theme 정보
    let oThemeInfo = parent.getThemeInfo(); 

    // Browswer Options
    let sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));        

        //652   UI Attribute 개인화 항목
        oBrowserOptions.title = parent.WSUTIL.getWsMsgClsTxt("", "ZMSG_WS_COMMON_001", "652");
        oBrowserOptions.autoHideMenuBar = true;

        oBrowserOptions.titleBarStyle = 'hidden';

        // oBrowserOptions.parent = CURRWIN;        
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL; //테마별 색상 처리
        oBrowserOptions.modal = false;
        oBrowserOptions.closable = false;
        oBrowserOptions.width = 1200;
        oBrowserOptions.height = 800;

        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.show = false;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = USERINFO;        

        // 브라우저 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions); 
        parent.REMOTEMAIN.enable(oBrowserWindow.webContents);

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);


        let sPopupPath = PATH.join(__dirname, "list", "index.html");

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
            OBJTY: sPopupName,
            USERINFO: parent.process.USERINFO,
            // [HTML5] frameless 창의 첫 페인트 플래시 방지 + 공통 타이틀바 — 테마/배경/제목 전달.
            THEME: oThemeInfo.THEME,
            BGCOL: oThemeInfo.BGCOL,
            TITLE: oBrowserOptions.title,
        };

        // URL에 QueryString 파라미터를 적용한다.
        const sLoadUrl = parent.WSUTIL.QueryString.build(sPopupPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);       


        // no build 일 경우에는 개발자 툴을 실행한다.
        if (!REMOTE.app.isPackaged) {
            oBrowserWindow.webContents.openDevTools();
        }

        oBrowserWindow.once('ready-to-show', () => {
            
            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);

        });

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function () {
         
            let oOptionData = {
                // BROWSKEY: BROWSKEY, // 브라우저 고유키 
                // oUserInfo: oUserInfo, // 로그인 사용자 정보
                // oServerInfo: oServerInfo, // 서버 정보            
                oLibData : {
                    LIBVER : parent.getUserInfo().META.LIBVER,
                    T_0022: oAPP.DATA.LIB.T_0022,
                    T_0023: oAPP.DATA.LIB.T_0023,
                    T_0024: oAPP.DATA.LIB.T_0024,
                    T_9011: oAPP.DATA.LIB.T_9011,
                },
                oThemeInfo: oThemeInfo, // 테마 정보                
            };
            
            oBrowserWindow.webContents.send('HANDLE_ON_INIT', oOptionData);

            // 부모 위치 가운데 배치한다.
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
            
        });
        

        oBrowserWindow.webContents.on('load-finish', function(){

            // console.log('로드완료!!');

            oAPP.attr.oMainBroad.postMessage({ PRCCD:"BUSY_OFF" });

            oAPP.common.fnSetBusyLock("");


        })


        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            
            oBrowserWindow = null;

            CURRWIN.focus();

        });


        //  현재 윈도우가 닫힐 때(새로고침 등) 브라우저 정리 (1회성)
        window.addEventListener('pagehide', function(){
            try { oBrowserWindow.close(); } catch (error) {}
        }, { once: true });


        //attr 개인화 팝업 -> 메인 통신을 위한 이벤트 등록.
        oBrowserWindow.webContents.on("ipc-message", async function(event, channel, data){

            const _if_name = `if-attrPresetPopup-${USERINFO.SYSID}`;
            
            if(channel !== _if_name){
                return;
            }

            switch (data.PRCCD) {
                case "U4A_HELP_DOCUMENT":
                    // U4A 도움말 문서 팝업 오픈
                    await oAPP.fn.fnU4AHelpDocuPopupOpener(data.DATA);

                    //U4A 도움말 문서가 열리는것을 기다린뒤, ATTR 개인화 팝업에 문서가 열렸음을 전달.
                    //(도움말 문서가 업데이트 되는경우 다운로드를 받은뒤 문서 OPEN까지를 기다림)
                    oBrowserWindow.send(_if_name, {PRCCD:"U4A_HELP_DOCUMENT_OPEN"});


                    break;
            
                default:
                    break;
            }

        });


};


