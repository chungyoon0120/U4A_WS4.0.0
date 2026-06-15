/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : library-preload.js
 * - file Desc : WS 초기 실행 시 필요한 js 및 Object 생성
 ************************************************************************/
// let oAPP = (function (window) {
(function () {
    "use strict";

    window.oAPP = window.oAPP || {};

    // Object 선언부
    // let oAPP = {},
    let PATH = parent.PATH,
        APP = parent.APP,
        PATHINFO = parent.PATHINFO,
        USERDATA = parent.USERDATA,
        require = parent.require;

    parent.oAPP.oChildApp = oAPP;

    oAPP.global = {};
    oAPP.main = {};

    oAPP.fn = {};
    oAPP.ui = {};
    oAPP.usp = {};

    oAPP.DATA = {};

    // oAPP.sap = {};
    // oAPP.sap.msgcls = {};

    oAPP.attr = {};
    oAPP.common = {};
    oAPP.wmenu = {}; // window menu

    oAPP.aPreloadScripts = [{
        URL: parent.getPath("JQUERYUI"),
        MIMETYPE: "script"
    },
    {
        // URL: "../js/shortcut.js",
        URL: PATH.join(APPPATH, "js/shortcut.js"),
        MIMETYPE: "script"
    },
    {
        // URL: "../js/download.js",
        URL: PATH.join(APPPATH, "js/download.js"),
        MIMETYPE: "script"
    },
    {
        // URL: "../js/dateformat.js",
        URL: PATH.join(APPPATH, "js/dateformat.js"),
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_common.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/fnNetworkChecker.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_events.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_events_01.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_events_02.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_01.js",
        MIMETYPE: "script"
    },
    {
        // WS10 HTML5 렌더러 (UI5 제거 1단계) — fnOnInitRendering 이 호출
        URL: "./js/ws10_html.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_02.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_03.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_04.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_05.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/fnSuggestion.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/fnDialogPopupOpener.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ipc/ws_fn_ipc.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/broadcast/ws_fn_broad.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/fnServerSession.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/fnHmws.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_fn_test.js",
        MIMETYPE: "script"
    },
    {
        URL: "design/js/main.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/usp/ws_usp.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/usp/ws_usp_01.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_main.js",
        MIMETYPE: "script"
    },
    ];

    oAPP.loadLibrary = function (scripts, index, fnCallback) {

        var oLoadFile = scripts[index];

        $.ajax({
            url: oLoadFile.URL,
            async: false,
            dataType: "text",
            success: function (data) {

                // 1. 상대경로(oLoadFile.URL)를 절대경로로 변환
                // window.location.href를 기준으로 전체 주소를 생성함
                var absoluteURL = new URL(oLoadFile.URL, window.location.href).href;

                // 2. 변환된 절대경로를 sourceURL에 적용
                var sSourceURL = "\n//# sourceURL=" + absoluteURL;

                // 3. 실행 (기존 로직 동일)
                window["eval"].call(window, data + sSourceURL);

                // --- 재귀 로직 시작 ---
                if (scripts.length - 1 <= index) {
                    if (fnCallback) fnCallback();
                    return;
                }

                if (index + 1 <= scripts.length - 1) {
                    oAPP.loadLibrary(scripts, index + 1, fnCallback);
                    return;
                }
                if (fnCallback) fnCallback();
            },
            error: function (xhr, status, err) {
                console.error("로드 실패: " + oLoadFile.URL);
            }
        });
    };

    oAPP.loadJs = function (sUrl, fnCallback) {

        var URL = "./js/" + sUrl + ".js"

        $.ajax({
            url: URL,
            async: false,
            dataType: "script",
            success: function (e) {

                if (typeof fnCallback == "function") {
                    fnCallback();
                }

            }

        });

    }; // end of oAPP.loadJs


    /************************************************************************
     * window onload Event
     ************************************************************************/
    oAPP.fnWindowOnInitLoad = function () {

        sap.ui.getCore().attachInit(function () {

            parent.CURRWIN.setOpacity(1.0);

            parent.CURRWIN.show();

            // 초기 JS Load
            oAPP.loadLibrary(oAPP.aPreloadScripts, 0);

            // WS 시작
            oAPP.main.fnWsStart();



        });

    }; // end of oAPP.fnWindowOnInitLoad

    oAPP.fnWindowOnInitLoad();

})();
