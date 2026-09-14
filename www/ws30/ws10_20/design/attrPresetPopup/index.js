
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

        // [HTML5 2026-09-13, 장군님 지시] 네이티브 창 투명도 페이드 제거 — show:false 로만 숨긴다.
        //   OS 합성이라 느린 PC 에서 무겁다. 창 표시는 페이지가 준비를 마친 뒤 CURRWIN.show() 로 한다.
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

        // ★ [2026-09-14, 장군님 지시] 창 문서를 못 읽은 경우 — 진짜 실패 이벤트를 배선한다.
        //   이 창은 뜨자마자 busy 를 켜고, 아래 did-finish-load 가 보내는 HANDLE_ON_INIT 를 받아야
        //   본문이 그려진다. 문서 로드가 실패하면 그 데이터가 영영 안 와 busy 가 고착된다.
        //   타이머로 덮는 것은 금지(.analy 16 §2.11)이므로 실패 이벤트에서 창을 정리하고 잠금을 푼다.
        //   오류코드 접두: APRO / 다음 번호: 002
        try {
            oBrowserWindow.webContents.on('did-fail-load', function (evt, iErrCode, sErrDesc, sUrl, bIsMainFrame) {
                if (bIsMainFrame === false || iErrCode === -3) { return; }
                console.error("[APRO-001] attribute preset window load failed:", iErrCode, sErrDesc, sUrl);
                try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
                catch (e2) { console.error("[APRO-001] cleanup of the failed window failed:", e2 && e2.message); }
                try { oAPP.common.fnSetBusyLock(""); } catch (e3) { console.error("[APRO-001] busy release failed:", e3 && e3.message); }
                try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e4) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e4); } }
            });
        } catch (e) { console.error("[APRO-001] did-fail-load register failed:", e && e.message); }



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
            
            // ★ [2026-09-14] 전송 자체가 실패하면 창은 busy 인 채로 남는다 — 창을 정리하고 잠금을 푼다.
            try {
                oBrowserWindow.webContents.send('HANDLE_ON_INIT', oOptionData);
            } catch (eSend) {
                console.error("[APRO-001] initial data send to the attribute preset window failed:", eSend && eSend.message);
                try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
                catch (e2) { console.error("[APRO-001] cleanup of the failed window failed:", e2 && e2.message); }
                try { oAPP.common.fnSetBusyLock(""); } catch (e3) { console.error("[APRO-001] busy release failed:", e3 && e3.message); }
                try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e4) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e4); } }
                return;
            }

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
            try { oBrowserWindow.close(); } catch (error) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }}
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


