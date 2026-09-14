/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnFindPopupOpen.js
 * - file Desc : [WS20] Find (찾기) — HTML5 별도창 opener
 * - 오류코드 접두: FFPO / 다음 번호: 003
 * ----------------------------------------------------------------------
 *  원본: Popups/findPopup (UI5 별도 BrowserWindow: frame.html→frame.js→iframe index.html→index.js,
 *        sap.tnt.ToolPage = 좌 SideNavigation(5메뉴) + 우 NavContainer(메뉴별 테이블)).
 *  HTML5: frameless 별도창 1단(공통 .u4a-titlebar) — versionMng/runtimeClassNav 와 동일 컨벤션.
 *   · 창 본문 = Popups/findPopup/findFrame.html (좌 네비 + 메뉴별 공통 .u4a-table + 검색).
 *   · IF 데이터(사용자/테마/변경속성/서버이벤트/T_0022)는 did-finish-load 후 IPC 'if-find-info' 로 전달.
 *   · 링크 클릭 → 원본 계약 1:1:
 *       ${BROWSKEY}--find            (row) → fnIpcMain_Find            : 트리 선택 → --find--success
 *       ${BROWSKEY}--find--controller(row) → fnIpcMain_Find_Controller : 컨트롤러(클래스빌더) 실행
 *       ${BROWSKEY}--find--data--refresh   → fnIpcMain_Find_Data_Refresh: 최신 데이터 재수집 → callback
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    const
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        IPCMAIN = parent.IPCMAIN,
        IPCRENDERER = parent.IPCRENDERER,
        APP = parent.APP,
        CURRWIN = REMOTE.getCurrentWindow(),
        APPCOMMON = oAPP.common;

    /**************************************************************************
     * WS20 Find 별도창 Open
     **************************************************************************/
    oAPP.fn.fnFindPopupOpen = function () {

        // busy 키고 Lock 걸기 + 전체 자식 윈도우 Busy
        oAPP.common.fnSetBusyLock("X");
        try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_ON" }); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

        const sPopupName = "UIFIND";

        // 기존에 Find 창이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다.
        const oResult = parent.WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
        if (oResult.ISOPEN) {
            parent.WSUTIL.setParentCenterBounds(REMOTE, oResult.WINDOW);
            oAPP.common.fnSetBusyLock("");
            try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
            return;
        }

        const
            SESSKEY = parent.getSessionKey(),
            BROWSKEY = parent.getBrowserKey(),
            oThemeInfo = parent.getThemeInfo();

        // 창 제목(원본 oBrowserOptions.title = /U4A/CL_WS_COMMON D02 "Find").
        let sTitle = "";
        try { sTitle = APPCOMMON.fnGetMsgClsText("/U4A/CL_WS_COMMON", "D02") || "Find"; }
        catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } sTitle = "Find"; }

        const
            sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
            oDefaultOption = parent.require(sSettingsJsonPath),
            oBrowserOptions = jQuery.extend(true, {}, oDefaultOption.browserWindow);

        oBrowserOptions.title = sTitle;
        oBrowserOptions.autoHideMenuBar = true;
        // [HTML5] frameless — 네이티브 타이틀바 제거(공통 .u4a-titlebar 사용). browser-window-common-ux 표준.
        oBrowserOptions.titleBarStyle = 'hidden';
        oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;   // 테마별 배경(첫 페인트 플래시 방지)
        oBrowserOptions.parent = CURRWIN;
        // [HTML5] 네이티브 opacity 페이드 미사용 — backgroundColor 로 즉시 불투명, show=false 로 위치 잡고 표시.
        oBrowserOptions.show = false;
        oBrowserOptions.closable = false;
        oBrowserOptions.width = 1100;
        oBrowserOptions.height = 720;
        // [HTML5] 최소 크기 — 좌 네비(8.5rem)+메인(20rem)+스플리터(≈480px) 보장(본문 잘림 방지, findFrame.css min-width 짝).
        oBrowserOptions.minWidth = 520;
        oBrowserOptions.minHeight = 420;

        oBrowserOptions.webPreferences.partition = SESSKEY;
        oBrowserOptions.webPreferences.browserkey = BROWSKEY;
        oBrowserOptions.webPreferences.OBJTY = sPopupName;
        oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

        // find 대상 모수(변경 속성 정보)는 창 생성 전 스냅샷.
        const aAttrData = oAPP.fn.getAttrChangedData();

        let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
        try { REMOTEMAIN.enable(oBrowserWindow.webContents); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

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
            TITLE: sTitle
        };

        const sUrlPath = parent.getPath(sPopupName);
        const sLoadUrl = parent.WSUTIL.QueryString.build(sUrlPath, oQueryParams);

        oBrowserWindow.loadURL(sLoadUrl);

        // ★ [2026-09-14, 장군님 지시] 창 문서를 못 읽은 경우 — 진짜 실패 이벤트를 배선한다.
        //   이 창은 뜨자마자 busy 를 켜고, 아래 did-finish-load 가 보내는 if-find-info 를 받아야
        //   목록이 채워진다. 문서 로드가 실패하면 그 데이터가 영영 안 와 busy 가 고착된다.
        //   타이머로 덮는 것은 금지(.analy 16 §2.11)이므로 실패 이벤트에서 창을 정리하고 잠금을 푼다.
        try {
            oBrowserWindow.webContents.on('did-fail-load', function (evt, iErrCode, sErrDesc, sUrl, bIsMainFrame) {
                if (bIsMainFrame === false || iErrCode === -3) { return; }
                console.error("[FFPO-001] Find window load failed:", iErrCode, sErrDesc, sUrl);
                try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
                catch (e2) { console.error("[FFPO-001] cleanup of the failed window failed:", e2 && e2.message); }
                try { oAPP.common.fnSetBusyLock(""); } catch (e3) { console.error("[FFPO-001] busy release failed:", e3 && e3.message); }
                try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e4) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e4); } }
            });
        } catch (e) { console.error("[FFPO-001] did-fail-load register failed:", e && e.message); }

        // no build 일 경우에는 개발자 툴을 실행한다.
        // if (!APP.isPackaged) { oBrowserWindow.webContents.openDevTools(); }

        oBrowserWindow.once('ready-to-show', () => {
            // 부모 위치 가운데 배치(busy 해제는 프레임이 렌더 완료 후 SETBUSYLOCK/BUSY_OFF 로 — runtimeClassNav 동일).
            parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        });

        // 브라우저가 오픈이 다 되면 IF 데이터 전달(원본 if-find-info 1:1).
        oBrowserWindow.webContents.on('did-finish-load', function () {

            // 서버이벤트 리스트를 구한다(원본 동일 — 비동기).
            // ★ [2026-09-14, 장군님 지시] 성공 콜백 대신 Promise 로 받는다.
            //   [고친 이유] getServerEventList 는 서버 왕복이 실패하면 성공 콜백을 부르지 않는다
            //   (실패 콜백에서 Promise 만 resolve 한다). 그래서 서버가 안 되면 if-find-info 가
            //   영영 안 가 Find 창이 busy 인 채로 굳었다. Promise 는 성공·실패 모두 resolve 되므로
            //   어느 쪽이든 창에 데이터가 간다(실패면 서버이벤트 목록만 빈 상태).
            Promise.resolve(oAPP.fn.getServerEventList()).then(function (aServerEventList) {

                const oFindData = {
                    oUserInfo: parent.getUserInfo(),   // 로그인 사용자 정보
                    oThemeInfo: oThemeInfo,            // 테마 개인화 정보
                    aAttrData: aAttrData,              // 변경 속성 정보(find 모수)
                    aServEvtData: aServerEventList || [],   // 서버 이벤트 리스트
                    aT_0022: oAPP.DATA.LIB.T_0022      // UI 클래스 매핑용
                };

                try {
                    oBrowserWindow.webContents.send('if-find-info', oFindData);
                    parent.WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
                } catch (eSend) {
                    console.error("[FFPO-002] initial data send to the Find window failed:", eSend && eSend.message);
                    try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
                    catch (e2) { console.error("[FFPO-002] cleanup of the failed window failed:", e2 && e2.message); }
                    try { oAPP.common.fnSetBusyLock(""); } catch (e3) { console.error("[FFPO-002] busy release failed:", e3 && e3.message); }
                    try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e4) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e4); } }
                }

            }).catch(function (eErr) {
                console.error("[FFPO-002] server event list read failed:", eErr && eErr.message);
                try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
                catch (e2) { console.error("[FFPO-002] cleanup of the failed window failed:", e2 && e2.message); }
                try { oAPP.common.fnSetBusyLock(""); } catch (e3) { console.error("[FFPO-002] busy release failed:", e3 && e3.message); }
                try { oAPP.attr.oMainBroad.postMessage({ PRCCD: "BUSY_OFF" }); } catch (e4) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e4); } }
            });

        });

        // 브라우저를 닫을때 타는 이벤트
        oBrowserWindow.on('closed', () => {
            try { IPCMAIN.off(`${BROWSKEY}--find`, oAPP.fn.fnIpcMain_Find); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
            try { IPCMAIN.off(`${BROWSKEY}--find--controller`, oAPP.fn.fnIpcMain_Find_Controller); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
            try { IPCMAIN.off(`${BROWSKEY}--find--data--refresh`, oAPP.fn.fnIpcMain_Find_Data_Refresh); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
            oBrowserWindow = null;
            CURRWIN.focus();
        });

        // 선택한 UI 정보를 WS20 트리에 표시
        IPCMAIN.on(`${BROWSKEY}--find`, oAPP.fn.fnIpcMain_Find);

        // 선택한 UI 정보를 가지고 controller(class builder) 실행
        IPCMAIN.on(`${BROWSKEY}--find--controller`, oAPP.fn.fnIpcMain_Find_Controller);

        // Find Data Refresh
        IPCMAIN.on(`${BROWSKEY}--find--data--refresh`, oAPP.fn.fnIpcMain_Find_Data_Refresh);

    }; // end of oAPP.fn.fnFindPopupOpen

    /**************************************************************************
     * Find 창에서 전달 받은 UI 정보를 가지고 WS20 트리에 선택 표시.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find = async function (events, res) {

        await oAPP.fn.setSelectTreeItem(res.OBJID, res.UIATK, null);

        const BROWSKEY = parent.getBrowserKey();
        IPCRENDERER.send(`${BROWSKEY}--find--success`, "X");

    }; // end of oAPP.fn.fnIpcMain_Find

    /**************************************************************************
     * Find 창에서 전달 받은 UI 정보를 가지고 controller(class builder) 실행.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find_Controller = function (events, res) {

        APPCOMMON.execControllerClass(res.UIATV);

    }; // end of oAPP.fn.fnIpcMain_Find_Controller

    /**************************************************************************
     * Find Data 갱신 — 최신 변경속성/서버이벤트 재수집 후 창으로 콜백.
     **************************************************************************/
    oAPP.fn.fnIpcMain_Find_Data_Refresh = function (events, res) {

        // ★ [2026-09-14, 장군님 지시] 성공 콜백 대신 Promise — 위 if-find-info 와 같은 이유다.
        //   Find 창은 새로고침을 누르는 순간 busy 를 켜고 이 콜백만 기다린다. 서버가 안 되면
        //   성공 콜백이 안 불려 busy 가 영영 안 풀렸다.
        Promise.resolve(oAPP.fn.getServerEventList()).then(function (aServerEventList) {

            const oSender = events.sender,
                oWebPref = oSender.getWebPreferences(),
                sBrowserKey = oWebPref.browserkey;

            const oFindData = {
                oUserInfo: parent.getUserInfo(),
                oThemeInfo: parent.getThemeInfo(),
                aAttrData: oAPP.fn.getAttrChangedData(),
                aServEvtData: aServerEventList || [],
                aT_0022: oAPP.DATA.LIB.T_0022
            };

            oSender.send(`${sBrowserKey}--find--data--refresh--callback`, oFindData);

        }).catch(function (eErr) {
            console.error("[FFPO-003] Find data refresh failed:", eErr && eErr.message);
            // 창이 계속 기다리지 않도록 빈 결과라도 반드시 보낸다(busy 해제 신호를 겸한다).
            try {
                events.sender.send(`${events.sender.getWebPreferences().browserkey}--find--data--refresh--callback`, null);
            } catch (e2) { console.error("[FFPO-003] empty result notice failed:", e2 && e2.message); }
        });

    }; // end of oAPP.fn.fnIpcMain_Find_Data_Refresh

})(window, $, oAPP);
