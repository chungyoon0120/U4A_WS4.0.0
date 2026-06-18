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
    // [UI5 제거] 모델/공통 override 레이어 — 반드시 원본들 "뒤"에 로드(덮어쓰기).
    {
        URL: "./js/ws_html5_shell.js",
        MIMETYPE: "script"
    },
    // [UI5 제거] WS10 HTML5 렌더러 — fnOnInitRendering 이 호출(fnRenderWs10Html).
    {
        URL: "./js/ws10_html.js",
        MIMETYPE: "script"
    },
    // [UI5 제거] WS20 HTML5 — 반드시 shell/ws10_html "뒤"(가장 마지막) 순서대로 로드.
    //   ws20(셸) → ws20_tree(트리) → ws20_data(데이터) → ws20_attr(속성) → ws20_prev(미리보기).
    //   각 파일은 앞 파일이 정의한 함수를 super 로 감싸 override 하므로 순서가 중요.
    {
        URL: "./js/ws_html5_ws20.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_html5_ws20_tree.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_html5_ws20_data.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_html5_ws20_attr.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_html5_ws20_prev.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/ws_html5_ws20_edit.js",
        MIMETYPE: "script"
    },
    // [UI5 제거] WS30 USP 코드에디터 HTML5 — shell/원본 ws_usp*.js "뒤"에 순서대로 로드.
    //   usp(셸+나브+속성+문서+overrides) → usp_tree(트리) → usp_editor(Monaco iframe).
    //   shell 의 fnOnMoveToPage("WS30") 와 원본 UI5 빌더(fnMoveToWs30/fnUspTreeTableRowSelect)를 override.
    {
        URL: "./js/usp/ws_html5_usp.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/usp/ws_html5_usp_tree.js",
        MIMETYPE: "script"
    },
    {
        URL: "./js/usp/ws_html5_usp_editor.js",
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

                // 3. 실행 — [UI5 제거] 한 스크립트가 eval 시점에 top-level 에서 sap 등을 참조해
                //    throw 하더라도 이후 스크립트(ws_main/ws_html5_shell/ws10_html 등) 로드가
                //    멈추지 않도록 개별 try/catch 로 격리한다(빈 화면 방지).
                try {
                    window["eval"].call(window, data + sSourceURL);
                } catch (e) {
                    console.error("[HTML5] preload eval error: " + oLoadFile.URL, e);
                }

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

        // [UI5 제거] 구: sap.ui.getCore().attachInit(...) 래퍼 → UI5 없으므로 즉시 실행.

        parent.CURRWIN.setOpacity(1.0);

        parent.CURRWIN.show();

        // 초기 JS Load (모든 WS 스크립트 eval 로드)
        oAPP.loadLibrary(oAPP.aPreloadScripts, 0);

        // WS 시작
        oAPP.main.fnWsStart();

    }; // end of oAPP.fnWindowOnInitLoad

    oAPP.fnWindowOnInitLoad();

})();
