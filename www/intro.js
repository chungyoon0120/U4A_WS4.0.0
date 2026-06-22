/**************************************************************************
 * intro.js
 * ************************************************************************
 * - Application Intro
 **************************************************************************/
(function() {
    "use strict";

    let oAPP = {};
    oAPP.fn = {};
    oAPP.msg = {};

    const
        REMOTE = require('@electron/remote'),
        CURRWIN = REMOTE.getCurrentWindow(),
        REMOTEMAIN = REMOTE.require('@electron/remote/main'),
        APP = REMOTE.app,
        DIALOG = REMOTE.dialog,
        PATH = REMOTE.require('path'),
        APPPATH = APP.getAppPath(),
        USERDATA = APP.getPath("userData"),

        FS = REMOTE.require('fs-extra'),
        REGEDIT = require('regedit'),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        USP_UTIL = require(PATHINFO.USP_UTIL),
        RANDOM = require("random-key");

    /**
     * @since   2026-01-06 11:18:14
     * @version v3.5.7-4
     * @author  soccerhs
     * @description
     *  처음 로딩 시 리소스 무거운 npm 라이브러리는 미리 로드하는 용도.
     *
     * @since   2026-06-22
     * @version v3.6.4-x
     * @author  soccerhs
     * @description
     *  [첫 실행 속도 개선]
     *  무거운 라이브러리(puppeteer-core ≈ 8MB)를 모듈 로드 시점에 동기 require 하면,
     *  인트로가 화면에 뜨기 전 임계 경로에서 콜드 디스크 로드를 그대로 떠안아 첫 실행이
     *  크게 느려진다. 인트로 표시 자체는 이 라이브러리에 의존하지 않으므로 preload 를
     *  인트로가 뜬 뒤 백그라운드로 미룬다(_preloadHeavyModules).
     *
     *  ※ 인트로 렌더러와 본 앱은 별도 프로세스라 require 캐시는 공유되지 않으며,
     *    이 preload 의 실효는 "OS 파일 캐시 워밍"이므로 시점을 미뤄도 효과는 동일하다.
     */
    function _preloadHeavyModules() {

        // 인트로 페인트를 막지 않도록 다음 틱으로 미루고, 실패해도 무시한다(워밍 목적).
        setTimeout(() => {
            try { require("events"); }        catch (e) {}
            try { require("puppeteer-core"); } catch (e) {}
            try { require("crypto"); }         catch (e) {}
        }, 0);

    } // end of _preloadHeavyModules

    const vbsDirectory = PATH.join(PATH.dirname(APP.getPath('exe')), 'resources/regedit/vbs');
    REGEDIT.setExternalVBSLocation(vbsDirectory);

    oAPP.fn.fnOnDeviceReady = function() {

        oAPP.fn.fnOnStart(); // [async]


    }; // end of oAPP.fn.fnOnDeviceReady

    function _fnwait() {

        return new Promise((resolve) => {

            setTimeout(() => {

                resolve();

            }, 3000);

        });

    }

    
    /************************************************************************
     * OS 및 시스템 정보 로그 출력
     ************************************************************************/
    async function _logOsSystemInfo(){

        const systeminfo = require("systeminformation");

        // - OS 정보
        let os = await systeminfo.osInfo();

        // - cpu 정보
        let cpu = await systeminfo.cpu();

        // - 메인보드 정보
        let mainboard = await systeminfo.baseboard();

        // - 바이오스 정보
        let bios = await systeminfo.bios();

        // - 그래픽카드 정보
        let graphics = await systeminfo.graphics();

        // - 하드디스크 정보
        let disk = await systeminfo.diskLayout();

        // - 하드디스크 드라이브 정보
        let drive = await systeminfo.blockDevices();

        // - 메모리 정보
        let memory = await systeminfo.memLayout();

        // - 배터리 정보
        let battery = await systeminfo.battery();

        console.log("============ System Information ==============");
        console.log("**os 정보: ", JSON.stringify(os, null, 4));
        console.log("**cpu 정보: ", JSON.stringify(cpu, null, 4));
        console.log("**메인보드 정보: ", JSON.stringify(mainboard, null, 4));
        console.log("**바이오스 정보: ", JSON.stringify(bios, null, 4));
        console.log("**그래픽카드 정보: ", JSON.stringify(graphics, null, 4));
        console.log("**하드디스크 정보: ", JSON.stringify(disk, null, 4));
        console.log("**하드디스크 드라이브 정보: ", JSON.stringify(drive, null, 4));
        console.log("**메모리 정보: ", JSON.stringify(memory, null, 4));
        console.log("**배터리 정보: ", JSON.stringify(battery, null, 4));
        console.log("==============================================");

    } // end of _logOsSystemInfo

    oAPP.fn.fnOnStart = async () => {

        oAPP.startTime = new Date().getTime();

        // ws setting Info를 UserData에 저장
        await _saveWsSettingsInfo(); // <--- 반드시 여기에 위치해야함!!

        /**
         * @since   2026-02-24 16:37:15
         * @version v3.5.9-3
         * @author  soccerhs
         * @description
         * 
         * - 신규 인트로 추가
         * - 사계절 인트로 적용
         */
        await _showIntro();

        /**
         * @since   2026-06-22
         * @description
         *  [첫 실행 속도 개선] 인트로가 화면에 뜬 직후, 무거운 라이브러리를 백그라운드로
         *  미리 로드한다. await 하지 않으므로 인트로 표시/이후 부팅 작업을 막지 않고,
         *  남은 부팅 디스크 I/O 와 겹쳐져 다음 실행을 위한 OS 파일 캐시를 데운다.
         */
        _preloadHeavyModules();

        /**
         * @since   2026-05-23 15:10:49
         * @version v3.6.4-2
         * @author  soccerhs
         * @description
         * 
         * 인트로에서 설치 완료된 인스톨 파일을 삭제하는 로직 추가
         * 
         */
        // 설치 완료된 인스톨 파일이 있으면 삭제한다.
        await _removeInstallFiles();
        
        // OS 관련 시스템 정보를 로그로 남긴다.
        // await _logOsSystemInfo();
 
        // 현재 버전 보여주기
        // oAPP.fn.fnDisplayCurrentVersion();

        // WS Settings 에 있는 레지스트리 저장 Path 정보를 가지고 기본 레지스트리 정보를 생성한다.
        await _registryRelated();

        await oAPP.fn.getWsMessageList(); // <--- 반드시 여기에 위치해야함!!        

        // 소스 패턴 관련작업
        await _sourcePatternRelated();

        // 실행 기준 3개월이 지난 로그가 있다면 삭제한다.
        await _oldLogDelete();

        // Vbs 파일을 UserData 쪽으로 복사
        await _copyToUserDataVbs();

        // ps 파일을 UserData 쪽으로 복사
        await _copyToUserDataPs();

        // u4a Icon 파일을 UserData 쪽으로 복사
        await _copyToUserDataU4aIcon();

        // IndexDB 관련
        await _indexDbRelated();

        let oGlobalSettings = await WSUTIL.getWsGlobalSettingInfoAsync();

        // 초기 설치(기본 폴더, vbs 옮기기 등등)
        oAPP.fn.setInitInstall(() => {

            oAPP.endTime = new Date().getTime();

            let iTime = 100,
                timeDiff = oAPP.endTime - oAPP.startTime;

            if (iTime - timeDiff >= 0) {
                iTime = iTime - timeDiff;
            } else {
                iTime = 0;
            }

            // WS 세팅 정보
            var oWsSettings = oAPP.fn.fnGetSettingsInfo();

            // Trial 버전 여부 확인
            if (oWsSettings.isTrial) {

                setTimeout(() => {
                    oAPP.fn.fnTrialLogin();
                }, iTime);

                return;
            }

            setTimeout(() => {

                oAPP.fn.fnOpenServerList(oGlobalSettings); // 서버리스트 오픈      

            }, iTime);

        });

    }; // end of oAPP.fn.fnOnStart       

    /************************************************************************
     * WS 글로벌 메시지 목록 구하기
     ************************************************************************/
    oAPP.fn.getWsMessageList = () => {

        return new Promise(async (resolve) => {

            let sWsLangu = await WSUTIL.getWsLanguAsync();

            oAPP.msg.M01 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "032"); // Restart
            oAPP.msg.M02 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "033"); // App Close
            oAPP.msg.M03 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "034"); // Ignore
            oAPP.msg.M04 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "015"); // Please contact U4A Solution Team!
            oAPP.msg.M05 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "035"); // Default Pattern File Copy Error!
            oAPP.msg.M06 = WSUTIL.getWsMsgClsTxt(sWsLangu, "ZMSG_WS_COMMON_001", "036"); // Pattern Json File Write Error!     

            resolve();

        });

    }; // end of oAPP.fn.getWsMessageList

    /************************************************************************
     * Trial 버전의 로그인 페이지로 이동한다.
     ************************************************************************/
    oAPP.fn.fnTrialLogin = () => {

        var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
            oServerInfo = oWsSettings.trialServerInfo;

        const WINDOWSTATE = REMOTE.require('electron-window-state');

        // 창 크기 기본값 설정
        let mainWindowState = WINDOWSTATE({
            defaultWidth: 800,
            defaultHeight: 800
        });

        var SESSKEY = RANDOM.generate(40),
            BROWSERKEY = RANDOM.generate(10);

        // Browser Options..        
        var sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
            oDefaultOption = parent.require(sSettingsJsonPath),
            // oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow),
            oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow)),
            oWebPreferences = oBrowserOptions.webPreferences;

        // [흰색 플래시 수정] 다크 배경 직후 흰색(#f7f7f7)으로 덮어쓰던 버그 제거.
        oBrowserOptions.backgroundColor = "#1c2228";

        // 브라우저 윈도우 기본 사이즈
        oBrowserOptions.x = mainWindowState.x;
        oBrowserOptions.y = mainWindowState.y;
        oBrowserOptions.width = mainWindowState.width;
        oBrowserOptions.height = mainWindowState.height;
        oBrowserOptions.opacity = 0.0;
        oWebPreferences.partition = SESSKEY;
        oWebPreferences.browserkey = BROWSERKEY;

        // 인트로 화면 닫기
        let oCurrWindow = REMOTE.getCurrentWindow();
        oCurrWindow.hide();

        // 브라우저 오픈
        var oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);        

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        // 브라우저 윈도우 기본 사이즈 감지
        mainWindowState.manage(oBrowserWindow);        

        // 브라우저 실행 경로에 붙일 QueryString 정보
        const oQueryParams = {
            browserkey: oBrowserOptions?.webPreferences?.browserkey,
            sessionKey: oBrowserOptions?.webPreferences?.partition,
        };        

        // URL에 QueryString 파라미터를 적용한다.
        let sLoadUrl = WSUTIL.QueryString.build(PATHINFO.MAINFRAME, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) {
        //     oBrowserWindow.webContents.openDevTools();
        // }

        // 브라우저가 오픈이 다 되면 타는 이벤트
        oBrowserWindow.webContents.on('did-finish-load', function() {

            var oMetadata = {
                SERVERINFO: oServerInfo,
                EXEPAGE: "LOGIN",
                SESSIONKEY: SESSKEY,
                BROWSERKEY: BROWSERKEY
            };

            // 메타 정보를 보낸다.
            oBrowserWindow.webContents.send('if-meta-info', oMetadata);

            oBrowserWindow.setOpacity(1.0);

            oCurrWindow.close();

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            oBrowserWindow = null;
        });

    }; // end of oAPP.fn.fnTrialLogin

    /************************************************************************
     * WS의 설정 정보를 구한다.
     ************************************************************************/
    oAPP.fn.fnGetSettingsInfo = () => {

        // Browser Window option
        var oSettingsPath = PATHINFO.WSSETTINGS,

            // JSON 파일 형식의 Setting 정보를 읽는다..
            oSettings = require(oSettingsPath);
        if (!oSettings) {
            return;
        }

        return oSettings;

    }; // end of fnGetSettingsInfo

    async function _showIntro(){

        // let oPackageJson = REMOTE.require("./package.json");
        let sVersion = APP.getVersion(); // 앱 버전
        let oWsSettings = WSUTIL.getWsSettingsInfo();
        let iSupportPatch = Number(oWsSettings.patch_level || 0);

        // no build 상태에서는 버전 정보를 package.json에서 읽는다.
        if (!APP.isPackaged) {
            sVersion = oWsSettings.appVersion;
        }

        const IntroRuntime = require(PATH.join(__dirname, 'u4a-intro'));

        oAPP.intro = new IntroRuntime();

        // 시작
		await oAPP.intro.start(
			{
				versn: sVersion, 
				splev: iSupportPatch,
				devTools: false,

                /**
                 * spring
                 * summer
                 * autumn
                 * winter
                 * 
                 * 아래 옵션은 'devTools: true' 일 때만 적용됨!!
                 */
				seasons: "winter",  
			}
		);

    }

    /************************************************************************
     * 현재 설치된 WS Version을 화면에 표시
     ************************************************************************/
    oAPP.fn.fnDisplayCurrentVersion = () => {

        // let oPackageJson = REMOTE.require("./package.json");

        let oVerTable = document.getElementById("verTable"),
            oVerTextArea = document.getElementById("verTextArea"),
            oRelVer = document.getElementById("relver"),
            oPatVer = document.getElementById("patver"),
            oVerTxt = document.getElementById("versionTxt"),
            oPatVerTr = document.getElementById("patVerTr"),

            sVersion = APP.getVersion(), // 앱 버전
            oWsSettings = WSUTIL.getWsSettingsInfo(),
            iSupportPatch = Number(oWsSettings.patch_level || 0);

        // no build 상태에서는 버전 정보를 package.json에서 읽는다.
        if (!APP.isPackaged) {
            sVersion = oWsSettings.appVersion;
        }

        // Trial 버전 여부 확인
        if (oWsSettings.isTrial) {

            oVerTxt.innerHTML = `Trial version`;

            // 버전 테이블 영역 숨기기
            oVerTable.style.display = "none";

            return;
        }

        // Trial Version 영역 숨기기
        oVerTextArea.style.display = "none";

        oRelVer.innerHTML = sVersion;

        // 빌드된 상태에서 실행했을 경우에만 Support Package version을 보여준다.
        // if (APP.isPackaged) {

        oPatVerTr.style.display = "";
        oPatVer.innerHTML = iSupportPatch;

        // }

    }; // end of oAPP.fn.fnDisplayCurrentVersion  

    /************************************************************************
     * 서버 리스트를 오픈한다.
     ************************************************************************/
    oAPP.fn.fnOpenServerList = function(oGlobalSettings) {

        // 글로벌 세팅된 테마 정보를 구한다.
        let sTheme = "sap_horizon_dark";
        if(oGlobalSettings?.theme?.value !== ""){
            sTheme = oGlobalSettings.theme.value;
        }

        // 팝업 고유 이름
        let sPopupName = "SERVERLIST";

        // 테마 별 배경 색을 구한다.
        let sBgColor = WSUTIL.getThemeBackgroundColor(sTheme);

        // Electron Browser Default Options        
        var sSettingsJsonPath = PATHINFO.BROWSERSETTINGS,
            oDefaultOption = require(sSettingsJsonPath),
            oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));

        // oBrowserWindow.backgroundColor = "#1c2228";
        oBrowserOptions.backgroundColor = sBgColor; // 글로벌 설정된 테마의 배경색
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.show = false;
        oBrowserOptions.titleBarStyle = 'hidden';

        oBrowserOptions.autoHideMenuBar = true;
        oBrowserOptions.opacity = 0.0;
        oBrowserOptions.resizable = true;
        oBrowserOptions.movable = true;
        // 최소 크기 — 메인 윈도우(ServerList.js fnLoginPage)와 동일하게 1000x800 으로 고정
        oBrowserOptions.minWidth = 1000;
        oBrowserOptions.minHeight = 800;

        // 인트로 화면 닫기
        let oCurrWindow = REMOTE.getCurrentWindow();
        oCurrWindow.hide();

        // Server List 화면 오픈
        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        

        // 오픈할 브라우저 백그라운드 색상을 테마 색상으로 적용
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${sBgColor}; }`;
        oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        // 브라우저 상단 메뉴 없애기
        oBrowserWindow.setMenu(null);

        let oQueryParams = {
            OBJTY: sPopupName,
            // [흰색 플래시 방지] 첫 페인트 전 동기 배경(--boot-bg)용 테마/배경색 전달
            THEME: sTheme,
            BGCOL: sBgColor,
        };

        // URL에 QueryString 파라미터를 적용한다.
        let sLoadUrl = WSUTIL.QueryString.build(PATHINFO.SERVERLIST_v2, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        if (!APP.isPackaged) {
            oBrowserWindow.webContents.openDevTools();
        }

        oBrowserWindow.webContents.on('did-finish-load', async function() {
            
            // 글로벌 설정 정보를 ServerList에 전달한다.
            oBrowserWindow.webContents.send('if-globalSetting-info', oGlobalSettings);

            oBrowserWindow.webContents.send('window-id', oBrowserWindow.id);

            oBrowserWindow.setOpacity(1.0);

            oBrowserWindow.show();
            oBrowserWindow.focus();

            await oAPP.intro.stop();

            oCurrWindow.close();

        });

        oBrowserWindow.on('closed', () => {
            oBrowserWindow = null;

            if (oCurrWindow.isDestroyed()) {
                return;
            }
            
            try {
                oCurrWindow.close();    
            } catch (error) {
                
            }

            
        });

    };

    /************************************************************************
     * WS 초기 설치
     ************************************************************************
     * 1. WS 구동에 필요한 폴더를 생성 및 파일 복사를 수행
     * 2. 설치 경로는 WS가 설치된 userData
     *    예) C:\Users\[UserName]\AppData\Roaming\com.u4a_ws.app
     ************************************************************************/
    oAPP.fn.setInitInstall = function(fnCallback) {

        var oSettingsPath = PATHINFO.WSSETTINGS,
            oSettings = require(oSettingsPath),
            aPaths = oSettings.requireFolders, // 필수 폴더 리스트
            aFiles = oSettings.requireFiles, // 필수 파일 리스트
            iFileLength = aFiles.length,
            iPathLength = aPaths.length,
            sAppPath = APP.getPath("userData"); // 앱이 설치된 경로

        var aPromise = [],
            oMkdirOptions = {
                recursive: true, // 상위 폴더까지 자동 생성
                mode: 0o777 // 생성시 권한 부여
            };

        // 필수 폴더를 생성한다.
        for (var i = 0; i < iPathLength; i++) {

            var sPath = aPaths[i],
                sFullPath = PATH.join(sAppPath, sPath);

            if (FS.existsSync(sFullPath)) {
                continue;
            }

            aPromise.push(new Promise(function(resolve, reject) {

                FS.mkdir(sFullPath, oMkdirOptions, function(err) {

                    if (err) {
                        reject(err.toString());
                        return;
                    }

                    resolve();

                });

            }));

        }

        // 필수 파일을 생성한다.
        for (var j = 0; j < iFileLength; j++) {

            var sFileName = aFiles[j],
                sFileFullPath = PATH.join(sAppPath, sFileName);

            if (FS.existsSync(sFileFullPath)) {
                continue;
            }

            aPromise.push(new Promise((resolve, reject) => {

                FS.writeFile(sFileFullPath, JSON.stringify(""), {
                    encoding: "utf8",
                    mode: 0o777 // 올 권한
                }, function(err) {

                    if (err) {
                        reject(err.toString());
                        return;
                    }

                    resolve();

                });

            }));

        }


        // 상위 폴더를 생성 후 끝나면 실행
        Promise.all(aPromise).then(function(values) {

            // oAPP.fn.copyVbsToLocalFolder(function (oResult) {

            //     if (oResult.RETCD == 'E') {
            //         alert(oResult.MSG);
            //         return;
            //     }

            //     fnCallback();

            // });

            fnCallback();

        }).catch(function(err) {

            alert(err.toString());

        });

    }; // end of oAPP.fn.setInitInstall    



    /**
     * Private functions
     */

    /************************************************************************
     * 레지스트리 키의 List를 구한다.
     ************************************************************************/
    function _getRegeditList(sRegPath) {

        return new Promise((resolve) => {

            REGEDIT.list(sRegPath, (err, result) => {

                if (err) {
                    resolve({
                        RETCD: "E",
                        RTMSG: err.toString()
                    });

                    return;
                }

                resolve({
                    RETCD: "S",
                    RTDATA: result
                });

            });

        });

    } // end of _getRegeditList

    /************************************************************************
     * 레지스트리의 키값 생성
     ************************************************************************/
    function _regeditCreateKey(aKeys) {

        return new Promise((resolve) => {

            REGEDIT.createKey(aKeys, (err) => {

                if (err) {
                    resolve({
                        RETCD: "E",
                        RTMSG: err.toString()
                    });
                    return;
                }

                resolve({
                    RETCD: "S",
                    RTMSG: "success!!"
                });

            });


        });

    } // end of _regeditCreateKey

    /************************************************************************
     * 레지스트리의 값을 지우는 function
     ************************************************************************/
    function _regeditDeleteValue(aValues) {

        return new Promise((resolve) => {

            REGEDIT.deleteValue(aValues, (err) => {

                if (err) {
                    resolve({
                        RETCD: "E",
                        RTMSG: err.toString()
                    });
                    return;
                }

                resolve({
                    RETCD: "S",
                    RTMSG: "success!!"
                });

            });

        });

    } // end of _deleteRegeditKey

    /************************************************************************
     * 레지스트리의 cSession에 가비지가 있으면 클리어
     ************************************************************************/
    function _cSessionClear() {

        return new Promise(async (resolve) => {

            let oSettings = oAPP.fn.fnGetSettingsInfo(),
                sRegPath = oSettings.regPaths,
                cSessionPath = sRegPath.cSession;

            let oRegData = await _getRegeditList(cSessionPath);
            if (oRegData.RETCD == "E") {
                resolve();
                return;
            }

            let cSessionReg = oRegData.RTDATA[cSessionPath];
            if (!cSessionReg) {
                resolve();
                return;
            }

            let cSessionVal = cSessionReg.values,
                aValues = [];

            for (const i in cSessionVal) {
                aValues.push(`${cSessionPath}\\${i}`);
            }

            if (aValues.length == 0) {
                resolve();
                return;
            }

            // cSession에 있는 값들을 지운다.
            await _regeditDeleteValue(aValues);

            resolve();

        });

    } // end of _cSessionClear

    /************************************************************************
     * 초기 글로벌 설정값 세팅
     ************************************************************************/
    function _initRegistryGlobalSettings() {

        return new Promise(async (resolve) => {

            // 레지스트리의 글로벌 세팅 경로 구하기
            //  · sGlobalSettingPath : WS4 전용 노드(...\WS\WS4\GlobalSettings)
            //  · sLegacySettingPath : WS3(UI5) 공유 노드(...\WS\GlobalSettings) — 최초 1회 import 소스
            // WS3·WS4 공존: theme/language/sound 는 렌더 엔진마다 값 규약이 달라(예: UI5=sap_horizon_dark,
            // HTML5=horizon_dark) 공유 노드에 함께 쓰면 구버전이 깨진다. 따라서 WS4 전용 서브트리로 분리하되,
            // WS4 노드가 비어 있으면(최초 실행) 기존 WS3 값을 승계(import)해 사용자의 테마/언어를 보존한다.
            // 이후로는 WS4 노드에만 write 하며, WS3(공유) 노드는 절대 되쓰지 않는다.
            let oSettings = oAPP.fn.fnGetSettingsInfo(),
                sRegPath = oSettings.regPaths,
                sGlobalSettingPath = sRegPath.globalSettings,
                sLegacySettingPath = sRegPath.globalSettingsWs3;

            // (WS4 노드는 _initCreateRegistryFolders 에서 globalSettings 경로로 이미 생성됨)
            // WS4 노드 + WS3(레거시) 노드를 함께 조회
            let aReadPaths = [sGlobalSettingPath];
            if (sLegacySettingPath) {
                aReadPaths.push(sLegacySettingPath);
            }

            let oRegList = await WSUTIL.getRegeditList(aReadPaths),
                oRetData = oRegList.RTDATA || {};

            var oSettingValues = (oRetData[sGlobalSettingPath] || {}).values || {},
                oLegacyValues = (oRetData[sLegacySettingPath] || {}).values || {};

            // WS4 노드에 값이 없을 때 적용할 값: WS3(레거시) 값이 있으면 승계, 없으면 기본값
            function _legacyOrDefault(sKey, sDefault) {
                let sLegacy = oLegacyValues?.[sKey]?.value;
                return (typeof sLegacy !== "undefined" && sLegacy !== "") ? sLegacy : sDefault;
            }

            // WS Language 정보 저장
            if (!oSettingValues?.language || !oSettingValues?.language?.value) {

                let oRegData = {};
                oRegData[sGlobalSettingPath] = {};
                oRegData[sGlobalSettingPath]["language"] = {
                    value: _legacyOrDefault("language", oSettings.defaultLanguage || "EN"),
                    type: "REG_SZ"
                };

                await WSUTIL.putRegeditValue(oRegData);

            }

            // WS Theme 정보 저장
            if (!oSettingValues?.theme || !oSettingValues?.theme?.value) {

                let oRegData = {};
                oRegData[sGlobalSettingPath] = {};
                oRegData[sGlobalSettingPath]["theme"] = {
                    value: _legacyOrDefault("theme", oSettings.defaultTheme || "sap_horizon_dark"),
                    type: "REG_SZ"
                };

                await WSUTIL.putRegeditValue(oRegData);

            }

            // WS Sound 정보 저장
            // if (!oSettingValues?.sound || !oSettingValues?.sound?.value) {
            if (typeof oSettingValues?.sound?.value === "undefined") {

                let oRegData = {};
                oRegData[sGlobalSettingPath] = {};
                oRegData[sGlobalSettingPath]["sound"] = {
                    value: _legacyOrDefault("sound", oSettings.defaultSound || "X"),
                    type: "REG_SZ"
                };

                await WSUTIL.putRegeditValue(oRegData);

            }

            resolve();

        });


    } // end of _initRegistryGlobalSettings

    /************************************************************************
     * 초기 글로벌 패스 세팅
     ************************************************************************/
    function _initRegistryGlobalPaths(){

        return new Promise(async function(resolve){

            // 레지스트리의 글로벌 세팅 패스 루트 경로 구하기
            let oSettings = oAPP.fn.fnGetSettingsInfo(),
                sRegPath = oSettings.regPaths;

           /**
             * 개발 브라우저 설치 경로 정보 저장
             */

            let oDevBrowserInfo = oSettings.dev_browser_info;

            // 1. 하위 상대 경로 공통 정의
            const sChromeSubPath = `node_modules\\U4A\\WS\\lib\\chrome\\${oDevBrowserInfo.chromeLatestVersion}\\chrome-win64\\chrome.exe`;

            // 2. 기본값 설정: 개발 환경(!isPackaged) 기준
            // 'C:\Users\socce\AppData\Local\Programs\com.u4a_ws3.app\resources'
            const sLocalAppData =  process.env.LOCALAPPDATA;
            let sBaseResourcesPath = PATH.join(sLocalAppData, "Programs\\com.u4a_ws3.app\\resources");

            // 3. 패키징된 환경일 경우 경로 덮어쓰기
            if (APP.isPackaged) {
                sBaseResourcesPath = process.resourcesPath;
            }

            // 4. 최종 Chrome 실행 파일 경로
            let sDevBrowserPath = PATH.join(sBaseResourcesPath, sChromeSubPath);

            // 개발 브라우저를 저장할 레지스트리 경로
            let sDevBrowserRegPath = sRegPath.devBrowser;

            let oRegData = {};
            oRegData[sDevBrowserRegPath] = {};
            oRegData[sDevBrowserRegPath]["U4A_DEV_BROWSER"] = {
                value: sDevBrowserPath,
                type: "REG_DEFAULT"                    
            };

            await WSUTIL.putRegeditValue(oRegData);

            resolve();

        });

    } // _initRegistryGlobalPaths

    /************************************************************************
     * ws 설치 폴더 및, UserData 경로를 저장한다.
     ************************************************************************/
    function _addRegWsInstallInfo() {

        return new Promise(async (resolve) => {

            /**
             * No build 할 때와, Build 할때의 앱 설치 경로가 다르므로
             * 빌드했을 경우에만 해당 설치 경로를 레지스트리에 등록한다.
             */
            if (!APP.isPackaged) {
                resolve();
                return;
            }

            // 레지스트리 경로 구하기
            let oSettings = oAPP.fn.fnGetSettingsInfo(),
                sRegPath = oSettings.regPaths,
                sU4AWsRegPath = sRegPath.u4aws;

            let oRegData = {};
            oRegData[sU4AWsRegPath] = {};
            oRegData[sU4AWsRegPath]["execPath"] = {
                value: process.execPath,
                type: "REG_SZ"
            };

            oRegData[sU4AWsRegPath]["resourcesPath"] = {
                value: process.resourcesPath,
                type: "REG_SZ"
            };

            oRegData[sU4AWsRegPath]["userDataPath"] = {
                value: APP.getPath("userData"),
                type: "REG_SZ"
            };

            await WSUTIL.putRegeditValue(oRegData);

            resolve();

        });


    } // end of _addRegWsInstallInfo

    function _addWindowContextMenu(sKeyName) {

        return new Promise(async (resolve) => {

            /**
             * No build 할 때와, Build 할때의 앱 설치 경로가 다르므로
             * 빌드했을 경우에만 해당 설치 경로를 레지스트리에 등록한다.
             */
            if (!APP.isPackaged) {
                resolve();
                return;
            }

            let sRootPath = "HKCU\\SOFTWARE\\Classes\\Directory\\background\\shell";

            // 키 생성부터
            let sKeys = [
                sRootPath + `\\${sKeyName}`,
                sRootPath + `\\${sKeyName}\\command`
            ];

            await _regeditCreateKey(sKeys);

            var oRegData = {};
            oRegData[sRootPath + `\\${sKeyName}`] = {};
            oRegData[sRootPath + `\\${sKeyName}`]["icon"] = {
                value: process.execPath,
                type: "REG_EXPAND_SZ"
            };

            await WSUTIL.putRegeditValue(oRegData);

            var oRegData = {};

            oRegData[sRootPath + `\\${sKeyName}\\command`] = {};
            oRegData[sRootPath + `\\${sKeyName}\\command`]["command"] = {
                value: process.execPath,
                type: "REG_DEFAULT"
            };

            await WSUTIL.putRegeditValue(oRegData);

            resolve();

        });

    } // end of _addWindowContextMenu

    /************************************************************************
     * 초기 레지스트리 폴더 생성
     ************************************************************************/
    function _initCreateRegistryFolders() {

        return new Promise(async (resolve) => {

            let aKeys = [];

            let oSettings = oAPP.fn.fnGetSettingsInfo(),
                sRegPath = oSettings.regPaths;

            aKeys.push(sRegPath.systems);
            aKeys.push(sRegPath.LogonSettings);
            aKeys.push(sRegPath.globalSettings);
            aKeys.push(sRegPath.globalPaths);
            aKeys.push(sRegPath.devBrowser);

            await _regeditCreateKey(aKeys);

            resolve();

        });

    } // end of _initCreateRegistryFolders


    /************************************************************************
     * 설치 완료된 인스톨 파일이 있으면 삭제한다.
     ************************************************************************/
    async function _removeInstallFiles(){

        FS.readdirSync(USERDATA)
        .filter(f => /\.(exe|zip|dmg|AppImage)$/.test(f))
        .forEach(f => {
            try { FS.unlinkSync(PATH.join(USERDATA, f)); } catch (e) {}
        });


    } // end of _removeInstallFiles


    /************************************************************************
     * 레지스트리 관련작업
     ************************************************************************/
    async function _registryRelated() {

        return new Promise(async (resolve) => {

            // 초기 레지스트리 폴더 생성
            await _initCreateRegistryFolders();

            // 레지스트리의 cSession에 가비지값 제거
            await _cSessionClear();


            /**
             * 레지스트리관련 로직 확장은 아래에 쭉 추가하면 됨         
             */

            // 초기 글로벌 설정값 세팅
            await _initRegistryGlobalSettings();

            // 초기 글로벌 경로값 세팅
            await _initRegistryGlobalPaths();

            // ws 설치 폴더 및, UserData 경로를 저장한다.
            await _addRegWsInstallInfo();

            // 윈도우 컨텍스트 메뉴 레지스트리 등록
            await _addWindowContextMenu("U4A Workspace");

            resolve();

        });


    } // end of _checkRegistry

    /************************************************************************
     * WS Global Setting 관련 정보
     ************************************************************************/
    function _setGlobalSettingInfo(oSettings) {

        return new Promise(async (resolve) => {

            let oGlobalSettingInfo = await WSUTIL.getWsGlobalSettingInfoAsync();
            oSettings.globalLanguage = oGlobalSettingInfo?.language?.value || "EN";
            oSettings.globalTheme    = oGlobalSettingInfo?.theme?.value;
            oSettings.globalSound    = oGlobalSettingInfo?.sound?.value;

            resolve();

        });

    } // end of _setGlobalSettingInfo

    /************************************************************************
     * WS Setting 정보를 Json 파일로 저장
     ************************************************************************/
    function _saveWsSettingsInfo() {

        return new Promise(async (resolve) => {

            if (!FS.existsSync(PATHINFO.CONF_ROOT)) {
                FS.mkdirSync(PATHINFO.CONF_ROOT);
            }

            let sConfPath = PATH.join(USERDATA, "conf", "ws_settings.json"),
                sSetttingJsonData = FS.readFileSync(PATH.join(APPPATH, "settings", "ws_settings.json"), 'utf-8'),
                oSettings = JSON.parse(sSetttingJsonData);

            var sSettingJson = JSON.stringify(oSettings),
                oWriteFileResult = await WSUTIL.fsWriteFile(sConfPath, sSettingJson);

            if (oWriteFileResult.RETCD == "E") {
                throw new Error("[intro] WS Setting Info File Write Error!");
            }

            /**
             * 여기서 Setting정보 추가할것. -- start
             */

            // WS Global Setting 관련 정보
            await _setGlobalSettingInfo(oSettings);

            // UI5 Bootstrap Url 구성
            _setUI5BootStrapUrl(oSettings);

            // 각종 루트 패스 등의 패스 정보 구성
            _setCommonPaths(oSettings);

            // 어플리케이션 버전, 패치 레벨 정보
            _setAppVersion(oSettings);

            // SAP 관련 패스 구성
            _setSapPath(oSettings);

            // U4A 관련 정보 구성
            _setU4ASettingInfo(oSettings);

            /**
             *  -- end
             */

            var sSettingJson = JSON.stringify(oSettings),
                oWriteFileResult = await WSUTIL.fsWriteFile(sConfPath, sSettingJson);

            if (oWriteFileResult.RETCD == "E") {
                throw new Error("[intro] WS Setting Info File Write Error!");
            }

            resolve();

        });

    } // end of _saveWsSettingsInfo

    /************************************************************************
     * SAP 관련 패스 구성
     ************************************************************************/
    function _setSapPath(oSettings) {

        oSettings.SAP = {};

        let APPDATA = process.env.APPDATA,
            sAbapEditorRootPath = PATH.join(APPDATA, "SAP", "SAP GUI", "ABAP Editor");

        oSettings.SAP.abapEditorRoot = sAbapEditorRootPath;
        oSettings.SAP.abap_user = PATH.join(sAbapEditorRootPath, "abap_user.xml");

    } // end of _setSapPath

    /************************************************************************
     * WS APP Version 정보 구성
     ************************************************************************/
    function _setAppVersion(oSettings) {

        // let oPackageJson = REMOTE.require("./package.json"),
        //     sAppVersion = oPackageJson.version;

        // if (APP.isPackaged) {
        //     sAppVersion = APP.getVersion();
        // }

        let oPackageJson;
        let sAppVersion;

        try {

            oPackageJson = REMOTE.require("./package.json");

            sAppVersion = oPackageJson.version;
            
        } catch (error) {
            
            sAppVersion = APP.getVersion();

        }

        // let sAppVersion = APP.getVersion();

        oSettings.appVersion = sAppVersion;

        oSettings.patch_level = Number(oSettings.patch_level);

    } // end of _setAppVersion

    /************************************************************************
     * UI5 Bootstrap 경로 구성
     ************************************************************************/
    function _setUI5BootStrapUrl(oSettings) {

        // 탑재된 UI5 Library 경로
        let sSettingUi5BootUrl = PATH.join(process.resourcesPath, oSettings.UI5.localResource);

        sSettingUi5BootUrl = sSettingUi5BootUrl.replaceAll("\\", "/");
        sSettingUi5BootUrl = `file:///${sSettingUi5BootUrl}`;
        sSettingUi5BootUrl = encodeURI(sSettingUi5BootUrl);
        
        oSettings.UI5.resourceUrl = sSettingUi5BootUrl;

        // 서버에 있는 UI5 라이브러리 Root Path
        oSettings.UI5.ServerLibraryRootPath = "/zu4a_imp/openUI5_LIB";
        oSettings.UI5.UI5IconTagsJsonPath = "/u4a/icons/tags.json";

        /**
         * @since   2026-01-29 17:20:16
         * @version v3.5.8-1
         * @author  soccerhs
         * @description
         * 
         * ws_settings 정보 중 개발 모드 여부 플래그(isDev) 항목 사용 안함.
         * 
         */
        // // 개발 모드일 경우, UI5 CDN 경로
        // if (oSettings.isDev) {
        //     oSettings.UI5.resourceUrl = oSettings.UI5.testResource;
        // }
        if(APP.isPackaged === false){
            oSettings.UI5.resourceUrl = oSettings.UI5.testResource;
        }

    } // end of _setUI5BootStrapUrl

    /************************************************************************
     * 공통으로 사용할 패스 정보 구성
     ************************************************************************/
    function _setCommonPaths(oSettings) {

        if (!oSettings.path) {
            oSettings.path = {};
        }

        oSettings.path = Object.assign(oSettings.path, PATHINFO);

    } // end of _setCommonPaths

    /************************************************************************
     * U4A 관련 정보 구성
     ************************************************************************/
    function _setU4ASettingInfo(oSettings) {

        if (!oSettings.U4A) {
            oSettings.U4A = {};
        }

        let sIconRootPath = "/zu4a_imp/publish/icons",
            sFontAwesomeRoot = sIconRootPath + "/fontAwesome";

        oSettings.U4A = {
            icons: {
                iconRootPath: sIconRootPath,
                fontAwesome: {
                    rootPath: sFontAwesomeRoot,
                    iconMetaJson: `${sFontAwesomeRoot}/icons.json`,
                    collectionNames: {
                        regular: "u4a-fw-regular",
                        brands: "u4a-fw-brands",
                        solid: "u4a-fw-solid"
                    },
                    fontList: {
                        regular: "u4a_fw_regular",
                        brands: "u4a_fw_brands",
                        solid: "u4a_fw_solid"
                    }
                }
            }
        };

    } // end of _setU4ASettingInfo

    /************************************************************************
     * 패턴 관련 작업
     ************************************************************************/
    function _sourcePatternRelated() {

        return new Promise(async (resolve) => {

            // 기본 패턴 파일을 설치폴더 경로에 옮기기
            let oResult1 = await _sourceDefaultPatternFileDown();
            if (oResult1.RETCD == "E") {

                let sMsg = "[intro] " + oAPP.msg.M05; // Default Pattern File Copy Error!

                // 패턴 관련 작업 중 오류 발생 시 공통 메시지 출력
                lf_sourcePatternErrorMsg(resolve, sMsg);

                console.error("[Intro] WWW에 있는 기본 패턴파일을 USERDATA에 복사하다가 오류");

                return;

            }

            // 패턴 관련 JSON 파일을 만든다.
            let oResult2 = await _saveSourcePatternJson();
            if (oResult2.RETCD == "E") {

                let sMsg = "[intro] " + oAPP.msg.M06; // Pattern Json File Write Error!

                // 패턴 관련 작업 중 오류 발생 시 공통 메시지 출력
                lf_sourcePatternErrorMsg(resolve, sMsg);

                return;

            }

            resolve();

        });

    } // end of _sourcePatternRelated

    // 패턴 관련 작업 중 오류 발생 시 공통 메시지 출력
    async function lf_sourcePatternErrorMsg(resolve, sMsg) {

        let sTxt1 = oAPP.msg.M01, // Restart
            sTxt2 = oAPP.msg.M02, // App Close
            sTxt3 = oAPP.msg.M03, // Ignore
            sTxt4 = oAPP.msg.M04; // Please contact U4A Solution Team!

        let options = {
            buttons: [sTxt1, sTxt2, sTxt3],
            message: sMsg,
            detail: sTxt4
        };

        let oMsgResult = await showMessageBox("E", options),
            iResponse = oMsgResult.response;

        switch (iResponse) {
            case 0: // App Restart

                APP.relaunch();
                APP.exit();
                return;

            case 1: // App Close

                APP.exit();
                return;

            case 2: // Ignore

                resolve();
                return;
        }

    }

    async function showErrorMsgBoxAsync(resolve, sMsg) {

        let sTxt1 = oAPP.msg.M01, // Restart
            sTxt2 = oAPP.msg.M02, // App Close
            sTxt3 = oAPP.msg.M03, // Ignore
            sTxt4 = oAPP.msg.M04; // Please contact U4A Solution Team!

        let options = {
            buttons: [sTxt1, sTxt2, sTxt3],
            message: sMsg,
            detail: sTxt4
        };

        let oMsgResult = await showMessageBox("E", options),
            iResponse = oMsgResult.response;

        switch (iResponse) {
            case 0: // App Restart

                APP.relaunch();
                APP.exit();
                return;

            case 1: // App Close

                APP.exit();
                return;

            case 2: // Ignore

                resolve();
                return;
        }

    }


    function showMessageBox(messageTypes, pOptions) {

        return new Promise((resolve) => {

            let sMsgType = "";

            switch (messageTypes) {
                case "I":
                    sMsgType = "info";
                    break;

                case "S":
                    sMsgType = "info";
                    break;

                case "W":
                    sMsgType = "warning";
                    break;

                case "E":
                    sMsgType = "error";
                    break;

                default:
                    sMsgType = "none";
                    break;
            }

            let options = {
                title: "U4A Workspace",
                type: sMsgType,
                message: "",
                detail: ""
            };

            options = Object.assign({}, options, pOptions);

            DIALOG.showMessageBox(CURRWIN, options).then((e) => {

                resolve(e);

            });

        });

    } // end of showMessageBox

    /************************************************************************
     * 기본 패턴 파일을 설치폴더 경로에 옮기기
     ************************************************************************/
    function _sourceDefaultPatternFileDown() {

        return new Promise(async (resolve) => {

            let sPattnFolderSourcePath = PATHINFO.PATTERN_ROOT, // WWW에 기본 패턴 파일이 있는 폴더
                sPattnFolderTargetPath = PATHINFO.USERDATA_PATT_FILES; // USERDATA의 패턴 파일들이 저장될 폴더

            // USERDATA의 패턴 파일들이 저장될 폴더가 없으면 생성
            const isExists = FS.existsSync(sPattnFolderTargetPath);
            if (!isExists) {
                FS.mkdirSync(sPattnFolderTargetPath, {
                    recursive: true
                });
            }

            var ncp = require('ncp').ncp;

            ncp.limit = 16; // 한번에 처리하는 수?  

            // WWW에 있는 패턴 파일을 USERDATA 폴더에 복사한다.
            ncp(sPattnFolderSourcePath, sPattnFolderTargetPath, function(err) {

                if (err) {
                    resolve({
                        RETCD: "E",
                        RTMSG: err.toString()
                    });

                    return;
                }

                resolve({
                    RETCD: "S",
                    RTMSG: ""
                });

            });

        });

    } // end of _sourceDefaultPatternFileDown

    /************************************************************************
     * 패턴 관련 JSON 파일을 만든다.
     ************************************************************************/
    function _saveSourcePatternJson() {

        return new Promise(async (resolve) => {

            /**
             * Default Pattern JSON 만들기
             */

            // Usp 기본 패턴 정보를 구한다.
            let oDefPattDataResult = await USP_UTIL.getDefaultPatternData();
            if (oDefPattDataResult.RETCD == "E") {
                resolve(oDefPattDataResult);
                console.error("[Intro] 기본 패턴 정보 오류");
                return;
            }

            let aDefPattData = oDefPattDataResult.RTDATA,
                sDefPattJsonPath = PATHINFO.DEF_PATT,
                sDefPattJsonData = JSON.stringify(aDefPattData);

            // Usp 기본 패턴 정보를 Json 파일로 저장한다.
            let oWriteJsonResult = await WSUTIL.fsWriteFile(sDefPattJsonPath, sDefPattJsonData);
            if (oWriteJsonResult.RETCD == "E") {
                resolve(oDefPattDataResult);
                console.error("[Intro] 기본패턴 정보 JSON 저장하다가 오류");
                return;
            }

            /**
             * Custom Pattern
             */

            let aCustomPatternInitData = await USP_UTIL.getCustomPatternInitData(), // 커스텀 패턴 기본 정보 구하기
                sCustPattInitJsonData = JSON.stringify(aCustomPatternInitData); // 커스텀 패턴 기본 정보 JSON 변환

            // 커스텀 패턴 파일이 없으면 신규 생성
            let sCustPattJsonPath = PATHINFO.CUST_PATT,
                bIsFileExist = FS.existsSync(sCustPattJsonPath);

            if (!bIsFileExist) {

                // 커스텀 패턴 정보를 JSON으로 말아서 앱 설치 폴더에 저장
                let oWriteResult = await WSUTIL.fsWriteFile(sCustPattJsonPath, sCustPattInitJsonData);
                if (oWriteResult.RETCD == "E") {
                    resolve(oWriteResult);
                    console.error("[Intro] 커스텀 패턴 파일 저장하다가 오류");
                    return;
                }

            }

            // 기존에 저장된 개인화 패턴 정보가 있을 경우, 개인화 패턴 ROOT의 Description을 Ws language에 맞게 변경
            let sCustPattJsonData = FS.readFileSync(sCustPattJsonPath, 'utf-8');

            try {
                var aCustPattData = JSON.parse(sCustPattJsonData);
            } catch (error) {
                console.error("[Intro] 기 저장된 커스텀 패턴 파일읽어서 JSON 파싱하다가 오류");
                throw new Error(error.toString());
            }

            let iCustomRoot = aCustPattData.findIndex(elem => elem.TYPE === "ROOT");
            if (iCustomRoot >= 0) {

                // 커스텀 패턴 ROOT의 Description을 WS Language 언어에 맞게 매핑
                aCustPattData[iCustomRoot] = JSON.parse(JSON.stringify(aCustomPatternInitData[0]));

            }

            let sCustPattJson = JSON.stringify(aCustPattData);

            // 커스텀 패턴 정보를 Json 파일로 저장한다.
            let oWriteCustJsonResult = await WSUTIL.fsWriteFile(sCustPattJsonPath, sCustPattJson);
            if (oWriteCustJsonResult.RETCD == "E") {
                resolve(oWriteCustJsonResult);
                console.error("[Intro] 기본패턴 정보 JSON 저장하다가 오류");
                return;
            }


            resolve({
                RETCD: "S"
            });

        });

    } // end of _saveSourcePatternJson

    /************************************************************************
     * 3개월 전 로그는 삭제한다.
     ************************************************************************/
    function _oldLogDelete() {

        return new Promise(async (resolve) => {

            let sLogPath = PATH.join(USERDATA, "logs"),
                oResult = await WSUTIL.readDir(sLogPath);

            if (oResult.RETCD == "E") {
                resolve();
                return;
            }

            let aLogList = oResult.RTDATA,
                iLogListLength = aLogList.length;

            if (iLogListLength < 0) {
                resolve();
                return;
            }


            // 오늘 날짜의 3개월 전 날짜
            let oBefore3Month = new Date();
            oBefore3Month.setMonth(oBefore3Month.getMonth() - 3);

            for (var i = 0; i < iLogListLength; i++) {

                let sLogFileName = aLogList[i],
                    sLogFilePath = PATH.join(sLogPath, sLogFileName);

                const oFileStatus = await WSUTIL.fsStat(sLogFilePath);
                if (oFileStatus.RETCD == "E") {
                    continue;
                }

                const oStatus = oFileStatus.RTDATA;

                let mtime = oStatus.mtime; // 로그 파일의 마지막 수정 날짜

                if (mtime - oBefore3Month > 0) {
                    continue;
                }

                // sLogFilePath <-- 이 경로를 지울것!!
                const oRemoveResult = await WSUTIL.fsRemove(sLogFilePath);

            }

            resolve();

        });


    } // end of _oldLogCheck


    /************************************************************************
     * ps 파일을 UserData에 복사한다.
     ************************************************************************/
    function _copyToUserDataPs(){

        return new Promise(async function(resolve){

            let oSettings = oAPP.fn.fnGetSettingsInfo();
            let sUserDataPath = APP.getPath("userData");
            let sPsUserDataFolderPath = PATH.join(sUserDataPath, oSettings.ps.rootPath); 

            let sPsFileName = oSettings.ps.ws_ps;
            let sPsSourcePath = PATH.join(APPPATH, oSettings.ps.rootPath, sPsFileName);
            let sPsTargetPath = PATH.join(sPsUserDataFolderPath, sPsFileName);

            let oCopyResult = await WSUTIL.fsCopy(sPsSourcePath, sPsTargetPath);
            if (oCopyResult.RETCD == "E") {
                console.error("ws_ps.zip 파일 복사하다가 오류!!");
                throw Error(oCopyResult.RTMSG);
            }

            // 압축된 ps zip 풀기
            await fnExtractFileAdmZip(sPsTargetPath, sPsUserDataFolderPath);

            // 압축푼 zip 파일 삭제
            let oRemoveResult = await WSUTIL.fsRemove(sPsTargetPath);
            if (oRemoveResult.RETCD == "E") {
                console.error("ws_ps.zip 파일 압축풀고 삭제하다가 오류!!");
                throw Error(oRemoveResult.RTMSG);
            }

            resolve();

        });


    } // end of _copyToUserDataPs

    /************************************************************************
     * vbs 파일을 UserData에 복사한다.
     ************************************************************************/
    function _copyToUserDataVbs() {

        return new Promise(async (resolve) => {

            let oSettings = oAPP.fn.fnGetSettingsInfo();
            let sUserDataPath = APP.getPath("userData");
            let sVbsUserDataFolderPath = PATH.join(sUserDataPath, oSettings.vbs.rootPath);                

            let sVbsFileName = oSettings.vbs.sapgui_ws_zip;
            let sVbsSourcePath = PATH.join(APPPATH, oSettings.vbs.rootPath, sVbsFileName);
            let sVbsTargetPath = PATH.join(sVbsUserDataFolderPath, sVbsFileName);

            let oCopyResult = await WSUTIL.fsCopy(sVbsSourcePath, sVbsTargetPath);
            if (oCopyResult.RETCD == "E") {
                console.error("Vbs Zip 파일 복사하다가 오류!!");
                throw Error(oCopyResult.RTMSG);
            }
        
            // 압축된 Vbs zip 풀기
            await fnExtractFileAdmZip(sVbsTargetPath, sVbsUserDataFolderPath);

            // 압축푼 zip 파일 삭제
            let oRemoveResult = await WSUTIL.fsRemove(sVbsTargetPath);
            if (oRemoveResult.RETCD == "E") {
                console.error("vbs zip 파일 압축풀고 삭제하다가 오류!!");
                throw Error(oRemoveResult.RTMSG);
            }

            resolve();

        });

    } // end of _copyToUserDataVbs


    /************************************************************************
     * zip 파일 풀기
     ************************************************************************/
    function fnExtractFileAdmZip(sSourcePath, sTargetFolderPath) {

        var AdmZip = require("adm-zip");

        return new Promise((resolve) => {

            try {
                const ZIP = new AdmZip(sSourcePath);

                ZIP.extractAllTo(sTargetFolderPath, /*overwrite*/ true);

            } catch (error) {
                console.error(`${sSourcePath}\n 파일 압축 풀다가 오류!!`);
                throw new Error(error.toString());
            }

            resolve();

        });

    } // end of fnExtractFileAdmZip

    /************************************************************************
     * u4a icon 파일을 UserData에 복사한다.
     ************************************************************************/
    function _copyToUserDataU4aIcon() {

        return new Promise(async (resolve) => {

            let sIconsPath = PATH.join(PATHINFO.WS10_20_ROOT, "icons");

            if (!FS.existsSync(sIconsPath)) {
                console.error("u4a icons 폴더 없음");
                resolve();
                return;
            }

            let sUserDataIconPath = PATH.join(APP.getPath("userData"), "ext_api", "icons");

            if (!FS.existsSync(sUserDataIconPath)) {
                FS.mkdirSync(sUserDataIconPath, {
                    recursive: true
                });
            }

            var ncp = require('ncp').ncp;

            ncp.limit = 16; // 한번에 처리하는 수?
          
            ncp(sIconsPath, sUserDataIconPath, function(err) {

                if (err) {
                    resolve({
                        RETCD: "E",
                        RTMSG: err.toString()
                    });

                    return;
                }

                resolve({
                    RETCD: "S",
                    RTMSG: ""
                });

            });

        });

    } // end of _copyToUserDataU4aIcon


    /************************************************************************
     * IndexDB 관련
     ************************************************************************/
    function _indexDbRelated(){

        return new Promise(async (resolve) => {



            resolve();

        });
        
    } // end of _indexDbRelated

    window.addEventListener("DOMContentLoaded", oAPP.fn.fnOnDeviceReady, false);

})();


(function() {
    "use strict";

    String.prototype.string = function(len) {
        var s = '',
            i = 0;
        while (i++ < len) {
            s += this;
        }
        return s;
    };
    String.prototype.zf = function(len) {
        return "0".string(len - this.length) + this;
    };
    Number.prototype.zf = function(len) {
        return this.toString().zf(len);
    };

    Date.prototype.format = function(f) {

        if (!this.valueOf()) return " ";

        var weekKorName = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
            weekKorShortName = ["일", "월", "화", "수", "목", "금", "토"],
            weekEngName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            weekEngShortName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            d = this;

        return f.replace(/(yyyy|yy|MM|dd|KS|KL|ES|EL|HH|hh|mm|ss|a\/p)/gi, function($1) {

            var h = "";

            switch ($1) {

                case "yyyy":
                    return d.getFullYear(); // 년 (4자리)

                case "yy":
                    return (d.getFullYear() % 1000).zf(2); // 년 (2자리)

                case "MM":
                    return (d.getMonth() + 1).zf(2); // 월 (2자리)

                case "dd":
                    return d.getDate().zf(2); // 일 (2자리)

                case "KS":
                    return weekKorShortName[d.getDay()]; // 요일 (짧은 한글)

                case "KL":
                    return weekKorName[d.getDay()]; // 요일 (긴 한글)

                case "ES":
                    return weekEngShortName[d.getDay()]; // 요일 (짧은 영어)

                case "EL":
                    return weekEngName[d.getDay()]; // 요일 (긴 영어)

                case "HH":
                    return d.getHours().zf(2); // 시간 (24시간 기준, 2자리)

                case "hh":
                    return ((h = d.getHours() % 12) ? h : 12).zf(2); // 시간 (12시간 기준, 2자리)

                case "mm":
                    return d.getMinutes().zf(2); // 분 (2자리)

                case "ss":
                    return d.getSeconds().zf(2); // 초 (2자리)

                case "a/p":
                    return d.getHours() < 12 ? "AM" : "PM"; // 오전/오후 구분

                default:
                    return $1;

            }

        });

    };

})();