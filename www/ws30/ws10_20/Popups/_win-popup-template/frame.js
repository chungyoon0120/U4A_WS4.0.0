/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : _win-popup-template/frame.js
 * - file Desc : ★ 별창 팝업 견본(복사해 사용) — 외부 창 셸.
 *               창 크롬(공통 .u4a-titlebar: 로고/제목/min·max·close + 드래그) +
 *               Busy/테마/Broadcast 스켈레톤. 본문 UX 는 index.html(iframe).
 *   사용법: 이 폴더 복사 → 이름 변경 → index.* 내용만 채움. frame 은 손대지 않는다.
 *   IPC: 이 팝업의 부모↔자식 채널은 아래 TODO(§2.11) 에 정의한다(견본엔 없음).
 ************************************************************************/

let oAPP = (function (window) {
    "use strict";

    const
        REMOTE = require('@electron/remote'),
        PATH = REMOTE.require('path'),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        CURRWIN = REMOTE.getCurrentWindow();

    // 브라우저의 쿼리 스트링 정보(opener 가 넘긴 USERINFO/browserkey/BGCOL/THEME/TITLE 등)
    const oQueryParams = WSUTIL.QueryString.parse(location.href);

    const
        USERINFO = oQueryParams.USERINFO,
        LANGU = USERINFO.LANGU,
        SYSID = USERINFO.SYSID,
        WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);

    let oAPP = {};
    oAPP.fn = {};
    oAPP.ui = {};
    oAPP.attr = {};
    oAPP.events = {};
    oAPP.common = {};

    // 현재 비지 상태
    oAPP.attr.isBusy = false;

    oAPP.REMOTE = REMOTE;
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.CURRWIN = CURRWIN;
    oAPP.WSUTIL = WSUTIL;
    oAPP.PATHINFO = PATHINFO;
    oAPP.BROWSKEY = oQueryParams.browserkey;
    oAPP.USERDATA = oAPP.APP.getPath("userData");
    oAPP.attr.LANGU = LANGU;   // Workspace 언어(라벨 현지화)

    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);


    /*************************************************************
     * @function - 테마 정보를 구한다(SYSID별 개인화 JSON). 파라미터 없으면 화이트 기본.
     *************************************************************/
    oAPP.fn.getThemeInfo = function () {

        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${SYSID}.json`);
        if (oAPP.FS.existsSync(sThemeJsonPath) === false) {
            return;
        }

        let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");

        try {
            var oThemeJsonData = JSON.parse(sThemeJson);
        } catch (error) {
            return;
        }

        return oThemeJsonData;

    }; // end of oAPP.fn.getThemeInfo


    /*************************************************************
     * @function - 전달받은 테마(UI5 테마명)를 셸 토큰으로 적용. outer + iframe 양쪽 반영.
     *************************************************************/
    oAPP.fn.applyTheme = function (sUI5Theme) {

        if (!window.U4ATheme) {
            return;
        }

        let sKey = window.U4ATheme.apply(sUI5Theme);

        try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }

        // iframe(본문) 도 동일 테마로 맞춘다.
        try {
            let oFrame = document.getElementById("ws_frame");
            let oWin = oFrame && oFrame.contentWindow;
            if (oWin && oWin.U4ATheme) {
                oWin.U4ATheme.apply(sKey);
                try { oWin.document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }
            }
        } catch (e) { /* iframe 미로드 시 무시 */ }

        return sKey;

    }; // end of oAPP.fn.applyTheme

    /*************************************************************
     * @function - SYSID에 해당하는 테마 변경 IPC 이벤트(전 창 실시간 동기화)
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange() {

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if (!oThemeInfo) {
            return;
        }

        // OS 창 배경색도 테마색으로 갱신(흰 플래시 방지)
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        oAPP.REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);

        oAPP.fn.applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange


    /*************************************************************
     * @function - IPC Event 등록 / 해제
     *************************************************************/
    oAPP.fn.attachIpcEvents = function () {
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);

        // TODO(견본): 이 팝업 고유의 부모↔자식 IPC 채널을 여기에 등록(스펙 §2.11 별창 IPC 계약).
        //   부모: 판정 후 RETCD/MSGTY/RTMSG 회신. 자식: 응답 수신 후 결과 표시(던지자마자 완료토스트 금지).
    };

    oAPP.fn.detachIpcEvents = function () {
        oAPP.IPCMAIN.off(`if-p13n-themeChange-${SYSID}`, _onIpcMain_if_p13n_themeChange);

        // TODO(견본): 위 attach 에서 등록한 이 팝업 고유 IPC 채널을 여기서 해제(죽은 콜백 방지).
    };


    /***********************************************************
     * 로딩 인디케이터 표시/숨김 (공통 .u4a-busy 토글)
     ***********************************************************/
    oAPP.setBusyLoading = function (bIsShow) {

        var oLoadPg = document.getElementById("u4a_main_load");
        if (!oLoadPg) {
            return;
        }

        oLoadPg.setAttribute("data-busy", bIsShow === 'X' ? "true" : "false");

    };

    oAPP.fn.getBusy = function () {
        return oAPP.attr.isBusy;
    };

    /*******************************************************
     * @function - Busy indicator (창 잠금/로더)
     *******************************************************/
    oAPP.fn.setBusy = function (bIsBusy, sOption) {

        oAPP.attr.isBusy = bIsBusy;

        var _ISBROAD = sOption?.ISBROAD || undefined;

        if (bIsBusy === true || bIsBusy === "X") {

            oAPP.CURRWIN.closable = false;
            oAPP.setBusyLoading('X');

            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_ON" });
            }

        } else {

            // ★ closable 은 항상 false 유지(Alt+F4/OS X 차단). 닫기는 fnClose(setClosable→close)로만.
            oAPP.CURRWIN.closable = false;
            oAPP.setBusyLoading('');

            if (typeof _ISBROAD === "undefined" && oAPP.broadToChild) {
                oAPP.broadToChild.postMessage({ PRCCD: "BUSY_OFF" });
            }

        }

    }; // end of oAPP.fn.setBusy


    /************************************************************************
     * 공통 .u4a-titlebar 초기화 — 로고/제목/창 제어(min/max/close).
     * 창 이동 드래그는 shell.css(-webkit-app-region:drag)가 자동 처리.
     ************************************************************************/
    oAPP.fn.fnInitHeader = function () {

        // 로고(file:/// URL)
        try {
            var oLogo = document.getElementById("tplLogo");
            if (oLogo) {
                var sLogoPath = String(oAPP.PATHINFO.WS_LOGO).replace(/\\/g, "/");
                oLogo.src = encodeURI("file:///" + sLogoPath);
            }
        } catch (e) { }

        // 제목 — opener 가 넘긴 TITLE(쿼리) → document.title 사용.
        //   TODO(견본): 고정 제목은 메시지 키로 현지화. 예: oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "<키>"). 하드코딩 금지.
        var oTitle = document.getElementById("tplTitle");
        if (oTitle) {
            oTitle.textContent = document.title || "";
        }

        // 창 제어 — 공통 .u4a-winbtn (frameless)
        var oMin = document.getElementById("tplWinMin");
        if (oMin) {
            oMin.addEventListener("click", function () { try { oAPP.CURRWIN.minimize(); } catch (e) { } });
        }

        var oMax = document.getElementById("tplWinMax");
        if (oMax) {
            oMax.addEventListener("click", function () {
                try { if (oAPP.CURRWIN.isMaximized()) { oAPP.CURRWIN.unmaximize(); } else { oAPP.CURRWIN.maximize(); } } catch (e) { }
            });
        }

        var oClose = document.getElementById("tplWinClose");
        if (oClose) {
            oClose.addEventListener("click", function () { oAPP.fn.fnClose(); });
        }

    }; // end of oAPP.fn.fnInitHeader

    /************************************************************************
     * 창 닫기 — Busy 중이면 무시. closable:false 로 열렸으니 풀고 닫는다.
     ************************************************************************/
    oAPP.fn.fnClose = function () {

        if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) {
            return;
        }

        try {
            var oCurrWin = oAPP.REMOTE.getCurrentWindow();
            if (!oCurrWin.isDestroyed()) {
                oCurrWin.setClosable(true);
                oCurrWin.close();
            }
        } catch (e) { /* 이미 파괴된 창 무시 */ }

    }; // end of oAPP.fn.fnClose

    /************************************************************************
     * 본문(iframe) 등장 — CSS opacity transition(스펙 §2.6).
     ************************************************************************/
    oAPP.fn.fnShowContent = function () {
        var el = document.getElementById("tplContent");
        if (el) { el.classList.add("u4aTplShown"); }
    }; // end of oAPP.fn.fnShowContent

    /************************************************************************
     * 본문(index.html) 로드 — opener 가 넘긴 BGCOL/THEME 를 이어받아 흰 플래시 방지(§2.6).
     *   견본은 데이터 IPC 를 기다리지 않고 바로 본문을 띄운다. 실팝업은 필요 시
     *   attachIpcEvents 의 데이터 채널 도착 후 src 를 주입하도록 바꾼다.
     ************************************************************************/
    oAPP.fn.fnLoadContent = function () {
        var oWsFrame = document.getElementById("ws_frame");
        if (!oWsFrame) {
            return;
        }
        var sBg = oQueryParams.BGCOL || "";
        var sTheme = oQueryParams.THEME || "";
        oWsFrame.addEventListener("load", function () { oAPP.fn.fnShowContent(); });
        oWsFrame.src = "index.html?BGCOL=" + encodeURIComponent(sBg) + "&THEME=" + encodeURIComponent(sTheme);
    }; // end of oAPP.fn.fnLoadContent

    window.oAPP = oAPP;

    return oAPP;

})(window);


/************************************************************************
 * -- Start of Program
 ************************************************************************/
window.onload = function () {

    // 다른 자식 창과의 Busy 동기화 채널
    oAPP.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${oAPP.BROWSKEY}`);

    oAPP.broadToChild.onmessage = function (oEvent) {

        var _PRCCD = oEvent?.data?.PRCCD || undefined;
        if (typeof _PRCCD === "undefined") {
            return;
        }

        switch (_PRCCD) {
            case "BUSY_ON":
                oAPP.fn.setBusy(true, { ISBROAD: true });
                break;
            case "BUSY_OFF":
                oAPP.fn.setBusy(false, { ISBROAD: true });
                break;
            default:
                break;
        }

    };

    // 첫 페인트 직후 테마 적용(파라미터 없으면 화이트 기본). IPC 도착 시 재적용.
    try {
        var oTheme = oAPP.fn.getThemeInfo();
        if (oTheme && oTheme.THEME) {
            oAPP.fn.applyTheme(oTheme.THEME);
        }
    } catch (e) { /* 기본 라이트 토큰 */ }

    // 네이티브 메뉴 제거 + 헤더 초기화 + 테마 변경 IPC 등록 + 본문 로드
    oAPP.CURRWIN.setMenu(null);
    oAPP.fn.fnInitHeader();
    oAPP.fn.attachIpcEvents();
    oAPP.fn.fnLoadContent();

    // Esc = 닫기(공통 UX). 키 꾹 누름(auto-repeat) 가드.
    document.addEventListener("keydown", function (ev) {
        if (ev.repeat) { return; }
        if (ev.key === "Escape") { oAPP.fn.fnClose(); }
    });

    // 창 즉시 표시(네이티브 opacity 페이드 미사용 — 흰 플래시 방지, 스펙 §2.6).
    try { oAPP.CURRWIN.show(); } catch (e) { }

};

/************************************************************************
 * 창 닫을때 호출 되는 이벤트 — Busy 중이면 닫지 않는다.
 ************************************************************************/
window.onbeforeunload = function () {

    if (oAPP.fn.getBusy() === "X" || oAPP.fn.getBusy() === true) {
        return false;
    }

};

/************************************************************************
 * 페이지가 실제로 숨겨지거나 종료 처리될 때 — IPC 리스너 해제(죽은 콜백 방지)
 ************************************************************************/
window.addEventListener('pagehide', function () {

    oAPP.fn.detachIpcEvents();

}, { once: true });
