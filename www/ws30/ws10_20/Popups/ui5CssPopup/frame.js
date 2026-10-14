/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : ui5CssPopup/frame.js
 ************************************************************************/
let oAPP = (function (window) {
    "use strict";

    let oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.events = {};

    oAPP.REMOTE = require('@electron/remote');
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.USERDATA = oAPP.APP.getPath("userData");
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain;


    /*************************************************************
     * @function - 테마 정보를 구한다.
     *************************************************************/
    oAPP.fn.getThemeInfo = function (){

        let oUserInfo = parent.process.USERINFO;
        let sSysID = oUserInfo.SYSID;
        
        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme_ws4", `${sSysID}.json`);
        if(oAPP.FS.existsSync(sThemeJsonPath) === false){
            return;
        }

        let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");

        try {
        
            var oThemeJsonData = JSON.parse(sThemeJson);    

        } catch (error) {
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(error); }
            return;
        }

        return oThemeJsonData;

    } // end of oAPP.fn.getThemeInfo

    /************************************************************************
     * HTML5 WS4 테마 키(예: horizon_white/horizon_dark) → UI5 표준 테마명으로 단순화.
     *   ★ raw 키를 서버(/getui5_pre_css)로 그대로 넘기면 서버에 해당 테마 CSS 가 없어
     *     .../themes/<key>/library.css 404 → sap.ui.core.theming.Parameters 실패 → 색 깨짐.
     *   UI5 는 sap_horizon / sap_horizon_dark 만 로드 → 다크/라이트로만 단순화.
     *   판정: 키에 "dark" 포함 or 배경색(BGCOL) 휘도가 어두우면 dark. (.analy/12 §5.3)
     *   2026-10-14 장군님 지시 — 신 버전 창(ui5CssPopup_v2/main/frame.js)과 같은 방식으로 맞춤.
     ************************************************************************/
    oAPP.fn.toUI5Theme = function (sKey, sBgCol) {
        var bDark = String(sKey || "").toLowerCase().indexOf("dark") !== -1;
        if (!bDark && sBgCol) {
            var s = String(sBgCol).trim().replace(/^#/, ""), r, g, b;
            if (/^[0-9a-f]{3}$/i.test(s)) { s = s.replace(/(.)/g, "$1$1"); }   // 3자리 단축 hex(#abc)→6자리
            var mHex = s.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
            if (mHex) { r = parseInt(mHex[1], 16); g = parseInt(mHex[2], 16); b = parseInt(mHex[3], 16); }
            else {
                var mRgb = s.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (mRgb) { r = +mRgb[1]; g = +mRgb[2]; b = +mRgb[3]; }
            }
            if (typeof r === "number") { bDark = (0.299 * r + 0.587 * g + 0.114 * b) < 128; }
        }
        return bDark ? "sap_horizon_dark" : "sap_horizon";
    }; // end of oAPP.fn.toUI5Theme


    oAPP.setBusyIndicator = (bIsBusy) => {

        var oBusy = document.getElementById("u4aWsBusyIndicator");

        if (!oBusy) {
            return;
        }

        if (bIsBusy) {
            oBusy.style.visibility = "visible";
        } else {
            oBusy.style.visibility = "hidden";
        }

    };

    oAPP.setBusy = function (bIsShow) {

        var oLoadPg = document.getElementById("u4a_main_load");

        if (!oLoadPg) {
            return;
        }

        if (bIsShow == 'X') {
            oLoadPg.classList.remove("u4a_loadersInactive");
        } else {
            oLoadPg.classList.add("u4a_loadersInactive");
        }

    };

    /************************************************************************
     * CSS 미리보기 전체 선택 해제 시 20번 페이지 미리보기 초기화
     ************************************************************************/
    oAPP.fn.fnUnselectCssItems = function(){

        var BROWSKEY = oAPP.attr.BROWSERKEY;

        var oSendData = {
            TYPE: "C", // P : Preview, S: Save, C: Close
            DATA: []
        }

        oAPP.IPCRENDERER.send(`${BROWSKEY}--if-ui5css`, oSendData);

    }; // end of oAPP.fn.fnUnselectCssItems

    /************************************************************************
     * 현재 팝업 닫기
     ************************************************************************/
    oAPP.fn.fnCurrentWindowClose = () => {

        var BROWSKEY = oAPP.attr.BROWSERKEY;

        var oSendData = {
            TYPE: "C", // P : Preview, S: Save, C: Close
            DATA: []
        }

        oAPP.IPCRENDERER.send(`${BROWSKEY}--if-ui5css`, oSendData);

        var oCurr = oAPP.REMOTE.getCurrentWindow();
        oCurr.close();

    }; // end of oAPP.fn.fnCurrentWindowClose

    /************************************************************************
     * 선택한 css 미리보기
     ************************************************************************/
    oAPP.fn.fnPredefinedCssPreview = (aPreviewCss) => {

        var BROWSKEY = oAPP.attr.BROWSERKEY;

        var oSendData = {
            TYPE: "P", // P : Preview, S: Save, C: Close
            DATA: aPreviewCss
        }

        oAPP.IPCRENDERER.send(`${BROWSKEY}--if-ui5css`, oSendData);

    }; // end of oAPP.fn.fnPredefinedCssPreview

    /************************************************************************
     * 선택한 css 저장
     ************************************************************************/
    oAPP.fn.fnPredefinedCssSave = (aSaveCss) => {

        var BROWSKEY = oAPP.attr.BROWSERKEY;

        var oSendData = {
            TYPE: "S", // P : Preview, S: Save
            DATA: aSaveCss
        }

        oAPP.IPCRENDERER.send(`${BROWSKEY}--if-ui5css`, oSendData);

    }; // end of oAPP.fn.fnPredefinedCssSave

    // [서버에서 호출함] 페이지 7번에 대한 FormData 구성
    oAPP.GET_FORMDATA_M7 = (oFormData) => {

        // sap icon 경로 전달
        let oIconUrl = oAPP.attr.oIconUrl;
        for (const key in oIconUrl) {
            if (Object.hasOwnProperty.call(oIconUrl, key)) {
                const element = oIconUrl[key];

                oFormData.append(key, element);

            }
        }

        return oFormData;

    }; // end of oAPP.M7

    /************************************************************************
     * IPCRENDERER Events..
     ************************************************************************/
    oAPP.IPCRENDERER.on('if-ui5css-info', (events, oInfo) => {

        let oWs_frame = document.getElementById("ws_frame");
        if (!oWs_frame) {
            return;
        }

        oAPP.attr.BROWSERKEY = oInfo.BROWSKEY;  // 브라우저 키
        oAPP.attr.oIconUrl = oInfo.oIconUrl; // SAP ICON PATH

        let oIconUrl = oInfo.oIconUrl, // sap icon url
            // 2026-10-14 장군님 지시 — WS4 테마 키(horizon_white 등)를 그대로 서버에 넘기면
            //   그 이름의 UI5 테마 CSS 가 없어 library.css 404 → 색이 깨진다.
            //   신 버전 창(ui5CssPopup_v2)과 같이 UI5 표준 테마명으로 바꿔 넘긴다.
            sThemeName = oAPP.fn.toUI5Theme(oInfo.oThemeInfo && oInfo.oThemeInfo.THEME,
                                            oInfo.oThemeInfo && oInfo.oThemeInfo.BGCOL), // 테마정보
            sUrl = oInfo.sServerPath + "/getui5_pre_css"; // 서버 호출 url

        // 서버로 던질 파라미터
        let oParam = {
            LIBPATH: decodeURIComponent(oInfo.sServerBootStrapUrl), // post로 쏠때는 url path 같은 경우 encoding 안해야함.
            THEME: sThemeName,
            ICON_LED_RED: oIconUrl.ICON_LED_RED,
            ICON_LED_GREEN: oIconUrl.ICON_LED_GREEN
        };

        let oForm = document.getElementById("ws_form");
        oForm.setAttribute("action", sUrl);

        for (const key in oParam) {
            if (Object.hasOwnProperty.call(oParam, key)) {

                const element = oParam[key];

                let oInput = document.createElement("input");
                oInput.setAttribute("type", "hidden");
                oInput.setAttribute("name", key);
                oInput.setAttribute("value", element);
                oForm.appendChild(oInput);

            }
        }

        oForm.submit();

        // oWs_frame.src = sUrl;

        oWs_frame.onload = () => {

            oAPP.setBusyIndicator("");

            // oAPP.setBusy("");

        };

    });


    /************************************************************************
     * 창 종료시 
     ************************************************************************/
    
    
    /**
     * [TEST]  테스트 끝나면 반드시 주석을 풀것!! ----------- Start
     */    
    // window.onbeforeunload = () => { 

    //     oAPP.fn.fnCurrentWindowClose();

    // };
    /**
     * [TEST]  테스트 끝나면 반드시 주석을 풀것!! ----------- End
     */    

    window.oAPP = oAPP;

    return oAPP;

})(window);