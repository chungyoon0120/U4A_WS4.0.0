/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - merged frame logic into bindPopup/index.js
 ************************************************************************/

window.oAPP = (function(window) {
    "use strict";

    const
        REMOTE = require('@electron/remote'),
        PATH = REMOTE.require('path'),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        CURRWIN = REMOTE.getCurrentWindow(),
        WSUTIL = require(PATHINFO.WSUTIL);

    window.PATHINFO = PATHINFO;
    window.WSERR = require(PATHINFO.WSTRYCATCH);

    // 브라우저의 쿼리 스트링 정보
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

    oAPP.PES_DEV = process?.env?.PES_DEV || undefined;

    oAPP.REMOTE = require('@electron/remote');
    oAPP.IPCRENDERER = require('electron').ipcRenderer;
    oAPP.IPCMAIN = oAPP.REMOTE.require('electron').ipcMain,
    oAPP.PATH = oAPP.REMOTE.require('path');
    oAPP.FS = oAPP.REMOTE.require('fs');
    oAPP.APP = oAPP.REMOTE.app;
    oAPP.USERDATA = oAPP.APP.getPath("userData");

    oAPP.common.fnGetMsgClsText = WSMSG.fnGetMsgClsText.bind(WSMSG);
    oAPP.WSUTIL = WSUTIL;

    oAPP.attr.GLANGU = oAPP.WSUTIL.getWsSettingsInfo().globalLanguage;

    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 팝업은 OS 기본 title bar를 사용하지 않고 popup 내부에서 직접 그린 custom title bar를 사용한다.
    *  현재 workspace theme가 light/dark로 변경되어도 title bar, button hover, icon 색상이 기존 화면과
    *  이질감 없이 맞춰지도록 CSS variable 기준 색상 정보를 이곳에서 관리한다.
    *  window control icon은 option popup과 동일한 U4A icon font를 사용하며,
    *  font json 또는 font file을 찾지 못하는 경우에도 최소한의 fallback text가 표시되도록 구성한다.
    */
    const C_TITLEBAR_THEME = {
        light: {
            "--u4a-bind-bg-color": "#f5f6f7",
            "--u4a-bind-panel-color": "#ffffff",
            "--u4a-bind-border-color": "#c6d0dc",
            "--u4a-bind-titlebar-color": "#f7fafd",
            "--u4a-bind-titlebar-text-color": "#10283f",
            "--u4a-bind-titlebar-icon-color": "#0070f2",
            "--u4a-bind-titlebar-hover-bg": "#e5f1ff",
            "--u4a-bind-titlebar-active-bg": "#d8ecff",
            "--u4a-bind-danger-hover-bg": "#d13438",
            "--u4a-bind-danger-hover-text": "#ffffff"
        },
        dark: {
            "--u4a-bind-bg-color": "#12171c",
            "--u4a-bind-panel-color": "#1b242d",
            "--u4a-bind-border-color": "#33414f",
            "--u4a-bind-titlebar-color": "#1b242d",
            "--u4a-bind-titlebar-text-color": "#f1f5f9",
            "--u4a-bind-titlebar-icon-color": "#36a9ff",
            "--u4a-bind-titlebar-hover-bg": "#253340",
            "--u4a-bind-titlebar-active-bg": "#2d3d4b",
            "--u4a-bind-danger-hover-bg": "#d13438",
            "--u4a-bind-danger-hover-text": "#ffffff"
        }
    };

    const C_WINDOW_ICONS = {
        minimize: "sap-icon://u4a-fw-regular/Window Minimize",
        maximize: "sap-icon://u4a-fw-regular/Window Maximize",
        restore: "sap-icon://u4a-fw-regular/Window Restore",
        close: "sap-icon://u4a-fw-solid/Xmark"
    };

    const C_U4A_FONT_SETS = {
        "u4a-fw-regular": {
            fontFamily: "u4a_fw_regular",
            fileName: "u4a_fw_regular",
            jsonName: "u4a_fw_regular.json"
        },
        "u4a-fw-solid": {
            fontFamily: "u4a_fw_solid",
            fileName: "u4a_fw_solid",
            jsonName: "u4a_fw_solid.json"
        }
    };

    const C_U4A_ICON_CODE_FALLBACK = {
        "u4a-fw-regular": {
            "Window Maximize": "f2d0",
            "Window Minimize": "f2d1",
            "Window Restore": "f2d2"
        },
        "u4a-fw-solid": {
            Xmark: "f00d"
        }
    };

    const C_U4A_ICON_TEXT_FALLBACK = {
        "Window Minimize": "-",
        "Window Maximize": "[]",
        "Window Restore": "[]",
        Xmark: "x"
    };

    const oU4AIconMaps = {};
    const oLoadedU4AFonts = {};


    function isDarkTheme(oThemeInfo) {

        return String(oThemeInfo?.THEME || "").toLowerCase().indexOf("dark") !== -1;

    }


    function setCssVariables(oVariables) {

        var oRoot = document.documentElement;

        Object.keys(oVariables || {}).forEach(function (sName) {
            oRoot.style.setProperty(sName, oVariables[sName]);
        });

    }


    function applyFrameTheme(oThemeInfo) {

        var oTheme = oThemeInfo || {},
            bDark = isDarkTheme(oTheme),
            oVariables = Object.assign({}, C_TITLEBAR_THEME[bDark === true ? "dark" : "light"]),
            sBgColor = oTheme.BGCOL || oVariables["--u4a-bind-bg-color"];

        oVariables["--u4a-bind-bg-color"] = sBgColor;

        setCssVariables(oVariables);
        document.body.style.backgroundColor = sBgColor;
        document.body.classList.toggle("u4a_bind_theme_dark", bDark);
        document.body.classList.toggle("u4a_bind_theme_light", !bDark);

        try {
            CURRWIN.webContents.insertCSS(`html, body { margin: 0px; height: 100%; background-color: ${sBgColor}; }`);
        } catch (error) {}

    }


    function onFrameThemeChange() {

        var oThemeInfo = oAPP.fn.getThemeInfo();

        if(!oThemeInfo){
            return;
        }

        oAPP.attr.oThemeInfo = oThemeInfo;
        applyFrameTheme(oThemeInfo);

    }


    function attachFrameThemeEvent() {

        try {
            oAPP.IPCMAIN.on(`if-p13n-themeChange-${SYSID}`, onFrameThemeChange);
        } catch (error) {
            return;
        }

        window.addEventListener("pagehide", function () {
            try {
                oAPP.IPCMAIN.off(`if-p13n-themeChange-${SYSID}`, onFrameThemeChange);
            } catch (error) {}
        }, { once: true });

    }


    function pathToFileUrl(filePath) {

        if (!filePath) {
            return "";
        }

        return encodeURI(`file:///${String(filePath).replace(/\\/g, "/")}`);

    }


    function getU4AIconFileRoot() {

        var aCandidates = [];

        if (PATHINFO?.U4AICON_ROOT) {
            aCandidates.push(PATHINFO.U4AICON_ROOT);
        }

        if (PATHINFO?.WS10_20_ROOT) {
            aCandidates.push(PATH.join(PATHINFO.WS10_20_ROOT, "icons", "u4a"));
        }

        aCandidates.push(PATH.join(APPPATH, "ws30", "ws10_20", "icons", "u4a"));

        for (var i = 0, l = aCandidates.length; i < l; i += 1) {

            try {

                if (oAPP.FS.existsSync(aCandidates[i]) === true) {
                    return aCandidates[i];
                }

            } catch (error) {
                continue;
            }

        }

        return "";

    }


    function getU4AIconUrlRoot() {

        var sFileRoot = getU4AIconFileRoot();

        if (sFileRoot) {
            return pathToFileUrl(sFileRoot);
        }

        return new URL("../../icons/u4a/", location.href).href.replace(/\/$/, "");

    }


    function parseU4AIconSrc(src) {

        var sIcon = String(src || "").replace(/^sap-icon:\/\//, ""),
            aParts = sIcon.split("/");

        if (aParts.length > 1) {
            return {
                collection: aParts[0],
                name: aParts.slice(1).join("/")
            };
        }

        return {
            collection: "",
            name: sIcon
        };

    }


    function readU4AIconMap(collection) {

        var oSet = C_U4A_FONT_SETS[collection],
            sFileRoot = getU4AIconFileRoot(),
            oMap;

        if (!oSet) {
            return;
        }

        if (oU4AIconMaps[collection]) {
            return oU4AIconMaps[collection];
        }

        try {

            if (sFileRoot) {

                var sJsonPath = PATH.join(sFileRoot, oSet.jsonName);

                if (oAPP.FS.existsSync(sJsonPath) === true) {
                    oMap = JSON.parse(oAPP.FS.readFileSync(sJsonPath, "utf-8"));
                }

            }

        } catch (error) {
            oMap = null;
        }

        oU4AIconMaps[collection] = Object.assign({}, C_U4A_ICON_CODE_FALLBACK[collection] || {}, oMap || {});

        return oU4AIconMaps[collection];

    }


    function getU4AIconContent(src) {

        var oParsed = parseU4AIconSrc(src),
            oMap = readU4AIconMap(oParsed.collection),
            sCode = oMap?.[oParsed.name];

        if (!sCode) {
            return;
        }

        sCode = String(sCode).replace(/^\\u/i, "").replace(/^0x/i, "");

        var iCode = parseInt(sCode, 16);

        if (Number.isNaN(iCode) === true) {
            return;
        }

        return String.fromCodePoint(iCode);

    }


    function ensureU4AFontFace(fontFamily) {

        if (!fontFamily || oLoadedU4AFonts[fontFamily] === true) {
            return;
        }

        var oSet = Object.keys(C_U4A_FONT_SETS).map(function (key) {
            return C_U4A_FONT_SETS[key];
        }).find(function (set) {
            return set.fontFamily === fontFamily;
        });

        if (!oSet) {
            return;
        }

        var sStyleId = `u4a-bind-icon-face-${fontFamily.replace(/[^a-z0-9_-]/gi, "-")}`;

        if (document.getElementById(sStyleId)) {
            oLoadedU4AFonts[fontFamily] = true;
            return;
        }

        var sBaseUrl = getU4AIconUrlRoot();

        if (!sBaseUrl) {
            return;
        }

        var oStyle = document.createElement("style");

        oStyle.id = sStyleId;
        oStyle.textContent = `
            @font-face {
                font-family: "${fontFamily}";
                src: url("${sBaseUrl}/${oSet.fileName}.woff2") format("woff2");
                font-weight: normal;
                font-style: normal;
            }
        `;
        document.head.appendChild(oStyle);
        oLoadedU4AFonts[fontFamily] = true;

    }


    function applyU4AIcon(node, src) {

        if (!node) {
            return;
        }

        var sSrc = src || node.dataset.sapIcon || "",
            oParsed = parseU4AIconSrc(sSrc),
            oSet = C_U4A_FONT_SETS[oParsed.collection],
            sContent = getU4AIconContent(sSrc);

        node.setAttribute("aria-hidden", "true");
        node.dataset.sapIcon = sSrc;

        if (oSet && sContent) {
            ensureU4AFontFace(oSet.fontFamily);
            node.classList.remove("is-unresolved");
            node.style.fontFamily = `"${oSet.fontFamily}"`;
            node.textContent = sContent;
            return;
        }

        node.classList.add("is-unresolved");
        node.style.fontFamily = "";
        node.textContent = C_U4A_ICON_TEXT_FALLBACK[oParsed.name] || "";

    }


    function refreshU4AIcons(root) {

        Array.prototype.forEach.call((root || document).querySelectorAll("[data-sap-icon]"), function (node) {
            applyU4AIcon(node);
        });

    }


    function setWindowControlIcon(button, iconSrc) {

        if (!button) {
            return;
        }

        applyU4AIcon(button.querySelector(".u4a_bind_window_icon"), iconSrc);

    }


    /*************************************************************
     * @function - frame titlebar window control.
     *************************************************************/
    function isDestroyedWindow(oWin) {

        if (!oWin) {
            return true;
        }

        try {
            return typeof oWin.isDestroyed === "function" && oWin.isDestroyed() === true;
        } catch (error) {
            return true;
        }

    }


    function getCurrentWindow() {

        if (isDestroyedWindow(CURRWIN) === true) {
            return;
        }

        return CURRWIN;

    }


    function getElectronScreenModule() {

        try {

            if (oAPP?.REMOTE?.screen) {
                return oAPP.REMOTE.screen;
            }

            if (typeof oAPP?.REMOTE?.require === "function") {
                var oElectron = oAPP.REMOTE.require("electron");

                return oElectron?.screen;
            }

        } catch (error) {
            return;
        }

    }


    function getFrameTitlebarPointerPoint(oEvent, aWinPos, sPointMode) {

        var oRawPoint = {
                x: Number(oEvent.screenX) || 0,
                y: Number(oEvent.screenY) || 0
            },
            oDipPoint;

        try {
            var oScreen = getElectronScreenModule();

            if (oScreen && typeof oScreen.screenToDipPoint === "function") {
                oDipPoint = oScreen.screenToDipPoint(oRawPoint);

                if (!oDipPoint || Number.isFinite(oDipPoint.x) !== true || Number.isFinite(oDipPoint.y) !== true) {
                    oDipPoint = undefined;
                }
            }
        } catch (error) {
            oDipPoint = undefined;
        }

        if (sPointMode === "dip" && oDipPoint) {
            return {x: oDipPoint.x, y: oDipPoint.y, mode: "dip"};
        }

        if (sPointMode === "raw" || !oDipPoint) {
            return {x: oRawPoint.x, y: oRawPoint.y, mode: "raw"};
        }

        if (
            Array.isArray(aWinPos) !== true ||
            Number.isFinite(oEvent.clientX) !== true ||
            Number.isFinite(oEvent.clientY) !== true
        ) {
            return {x: oRawPoint.x, y: oRawPoint.y, mode: "raw"};
        }

        var nExpectX = aWinPos[0] + oEvent.clientX,
            nExpectY = aWinPos[1] + oEvent.clientY,
            nRawScore = Math.abs(oRawPoint.x - nExpectX) + Math.abs(oRawPoint.y - nExpectY),
            nDipScore = Math.abs(oDipPoint.x - nExpectX) + Math.abs(oDipPoint.y - nExpectY);

        if (nDipScore + 1 < nRawScore) {
            return {x: oDipPoint.x, y: oDipPoint.y, mode: "dip"};
        }

        return {x: oRawPoint.x, y: oRawPoint.y, mode: "raw"};

    }


    function callWindowMethod(methodName) {

        var oWin = getCurrentWindow();

        if (!oWin) {
            return;
        }

        try {
            if (typeof oWin[methodName] === "function") {
                return oWin[methodName]();
            }
        } catch (error) {
            return;
        }

    }


    function setFrameTitle() {

        var oTitle = document.getElementById("u4a_bind_title_text");

        if (!oTitle) {
            return;
        }

        var sTitle = "",
            sDefaultTitle = "";

        try {
            sTitle = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "/U4A/CL_WS_COMMON", "A15");
        } catch (error) {
            sTitle = "";
        }

        try {
            sDefaultTitle = oAPP.WSUTIL.getWsMsgClsTxt("", "/U4A/CL_WS_COMMON", "A15");
        } catch (error) {
            sDefaultTitle = "";
        }

        oTitle.innerText = sTitle || document.title || sDefaultTitle;
        document.title = oTitle.innerText;

    }


    function updateWindowState() {

        var oWin = getCurrentWindow(),
            oButton = document.getElementById("u4a_bind_maximize"),
            oTitlebar = document.querySelector(".u4a_bind_titlebar");

        if (!oWin || !oButton) {
            return;
        }

        var bIsMaximized = false;

        try {
            bIsMaximized = typeof oWin.isMaximized === "function" && oWin.isMaximized() === true;
        } catch (error) {
            return;
        }

        var sButtonTitle = bIsMaximized === true ? 
            oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "955") :
            oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "954");

        oButton.classList.toggle("is_maximized", bIsMaximized);
        oTitlebar?.classList?.toggle("u4a_bind_titlebar_maximized", bIsMaximized);
        oTitlebar?.classList?.add("u4a_bind_titlebar_native_drag");
        oButton.title = sButtonTitle;
        oButton.setAttribute("aria-label", oButton.title);
        setWindowControlIcon(oButton, bIsMaximized === true ? C_WINDOW_ICONS.restore : C_WINDOW_ICONS.maximize);

    }


    function minimizeWindow() {

        callWindowMethod("minimize");

    }


    function toggleMaximizeWindow() {

        var oWin = getCurrentWindow();

        if (!oWin) {
            return;
        }

        try {

            if (typeof oWin.isMaximized === "function" && oWin.isMaximized() === true) {
                oWin.unmaximize();
                return;
            }

            oWin.maximize();

        } catch (error) {
            return;
        }

    }


    function closeWindow() {

        if (oAPP?.oMain?.attr?.isBusy === true) {
            return;
        }

        callWindowMethod("close");

    }


    var oFrameTitlebarDragState = null;
    var bFrameTitlebarManualDragActive = false;


    function isFrameTitlebarInteractiveTarget(oTarget) {

        if (!oTarget || typeof oTarget.closest !== "function") {
            return true;
        }

        return !!oTarget.closest("button, input, select, textarea, a, label, [role='button'], [role='link'], .u4a_bind_window_controls");

    }


    function canStartFrameTitlebarDrag(oEvent) {

        if (!oEvent || oEvent.button !== 0) {
            return false;
        }

        if (isFrameTitlebarInteractiveTarget(oEvent.target) === true) {
            return false;
        }

        return !!oEvent.target.closest(".u4a_bind_titlebar");

    }


    function isFrameToolbarDragTarget(oTarget) {

        if (!oTarget || typeof oTarget.closest !== "function") {
            return false;
        }

        if (!oTarget.closest(".u4a_bind_body .sapMTB")) {
            return false;
        }

        if (oTarget.closest("button, input, select, textarea, a, label, [role='button'], [role='link'], .sapMBtn, .sapMBtnBase, .sapMSlt, .sapMInputBase, .sapUiLoSplitterBar, .sapUiLoSplitterOverlayBar")) {
            return false;
        }

        return true;

    }


    function isCurrentWindowMaximized(oWin) {

        try {
            return typeof oWin?.isMaximized === "function" && oWin.isMaximized() === true;
        } catch (error) {
            return false;
        }

    }


    function isScaledDisplay() {

        var nScale = Number(window.devicePixelRatio) || 1;

        if (Math.abs(nScale - 1) > 0.01) {
            return true;
        }

        try {

            var oWin = getCurrentWindow(),
                oScreen = getElectronScreenModule();

            if (
                oWin &&
                oScreen &&
                typeof oWin.getBounds === "function" &&
                typeof oScreen.getDisplayMatching === "function"
            ) {
                var oDisplay = oScreen.getDisplayMatching(oWin.getBounds());

                return Math.abs((Number(oDisplay?.scaleFactor) || 1) - 1) > 0.01;
            }

        } catch (error) {
            return false;
        }

        return false;

    }


    function endFrameTitlebarDrag() {

        oFrameTitlebarDragState = null;
        bFrameTitlebarManualDragActive = false;
        window.removeEventListener("mousemove", moveFrameTitlebarDrag, true);
        window.removeEventListener("mouseup", endFrameTitlebarDrag, true);
        window.removeEventListener("blur", endFrameTitlebarDrag, true);
        updateWindowState();

    }


    function moveFrameTitlebarDrag(oEvent) {

        if (!oFrameTitlebarDragState) {
            return;
        }

        var oWin = getCurrentWindow();

        if (!oWin || typeof oWin.setPosition !== "function") {
            endFrameTitlebarDrag();
            return;
        }

        try {

            var oPoint = getFrameTitlebarPointerPoint(oEvent, [oFrameTitlebarDragState.x, oFrameTitlebarDragState.y], oFrameTitlebarDragState.pointMode),
                iX = Math.round(oFrameTitlebarDragState.x + oPoint.x - oFrameTitlebarDragState.screenX),
                iY = Math.round(oFrameTitlebarDragState.y + oPoint.y - oFrameTitlebarDragState.screenY);

            if (
                typeof oWin.setBounds === "function" &&
                Number.isFinite(oFrameTitlebarDragState.width) === true &&
                Number.isFinite(oFrameTitlebarDragState.height) === true
            ) {
                oWin.setBounds({
                    x: iX,
                    y: iY,
                    width: oFrameTitlebarDragState.width,
                    height: oFrameTitlebarDragState.height
                });

                return;
            }

            oWin.setPosition(iX, iY);

        } catch (error) {
            endFrameTitlebarDrag();
        }

    }


    function startFrameTitlebarDrag(oEvent, bAllowToolbarArea) {

        if (canStartFrameTitlebarDrag(oEvent) !== true && (bAllowToolbarArea !== true || isFrameToolbarDragTarget(oEvent?.target) !== true)) {
            return;
        }

        var oWin = getCurrentWindow();

        if (!oWin || typeof oWin.getPosition !== "function") {
            return;
        }

        try {

            var aPos = oWin.getPosition();

            if (Array.isArray(aPos) !== true) {
                return;
            }

            var oPoint = getFrameTitlebarPointerPoint(oEvent, aPos);

            if (typeof oWin.isFullScreen === "function" && oWin.isFullScreen() === true) {
                return;
            }

            var bIsMaximized = isCurrentWindowMaximized(oWin);

            if (oEvent.currentTarget?.classList?.contains("u4a_bind_titlebar_native_drag") === true && bIsMaximized !== true) {
                return;
            }

            if (bIsMaximized === true) {

                if (typeof oWin.unmaximize !== "function" || typeof oWin.setPosition !== "function") {
                    return;
                }

            }

            bFrameTitlebarManualDragActive = true;

            if (bIsMaximized === true) {

                var nRatioX = oEvent.clientX / Math.max(window.innerWidth || 1, 1);

                oWin.unmaximize();

                if (typeof oWin.getSize === "function") {
                    var aSize = oWin.getSize();

                    if (Array.isArray(aSize) === true) {
                        var iX = Math.round(oPoint.x - (aSize[0] * nRatioX)),
                            iY = Math.round(oPoint.y - Math.min(oEvent.clientY, 20));

                        if (typeof oWin.setBounds === "function") {
                            oWin.setBounds({x: iX, y: iY, width: aSize[0], height: aSize[1]});
                        } else {
                            oWin.setPosition(iX, iY);
                        }
                    }
                }

            }

            aPos = oWin.getPosition();

            if (Array.isArray(aPos) !== true) {
                return;
            }

            oPoint = getFrameTitlebarPointerPoint(oEvent, aPos, oPoint.mode);

            var aSize = typeof oWin.getSize === "function" ? oWin.getSize() : undefined;

            oFrameTitlebarDragState = {
                screenX: oPoint.x,
                screenY: oPoint.y,
                pointMode: oPoint.mode,
                x: aPos[0],
                y: aPos[1],
                width: Array.isArray(aSize) === true ? aSize[0] : undefined,
                height: Array.isArray(aSize) === true ? aSize[1] : undefined
            };

            window.addEventListener("mousemove", moveFrameTitlebarDrag, true);
            window.addEventListener("mouseup", endFrameTitlebarDrag, true);
            window.addEventListener("blur", endFrameTitlebarDrag, true);

            oEvent.preventDefault();

        } catch (error) {
            bFrameTitlebarManualDragActive = false;
            endFrameTitlebarDrag();
        }

    }


    function startFrameToolbarMaximizedDrag(oEvent) {

        var oWin = getCurrentWindow();

        if (isCurrentWindowMaximized(oWin) !== true) {
            return;
        }

        startFrameTitlebarDrag(oEvent, true);

    }


    function onFrameTitlebarDoubleClick(oEvent) {

        if (canStartFrameTitlebarDrag(oEvent) !== true) {
            return;
        }

        toggleMaximizeWindow();

    }


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  custom title bar의 최소화, 최대화/복원, 닫기 버튼 이벤트를 현재 Electron BrowserWindow에 연결한다.
    *  OS 기본 title bar를 숨긴 상태에서도 기존 popup 사용에 필요한 window control 기능을 유지하기 위한 처리이며,
    *  maximize/unmaximize 이벤트를 감지해 버튼 icon과 aria-label을 복원/최대화 상태에 맞게 갱신한다.
    *  close 버튼은 기존 busy 상태 보호 로직을 존중하여 작업 중에는 popup이 닫히지 않도록 한다.
    */
    function attachFrameTitlebarEvents() {

        var oTitlebar = document.querySelector(".u4a_bind_titlebar"),
            oBody = document.querySelector(".u4a_bind_body"),
            oWindowControls = document.querySelector(".u4a_bind_window_controls"),
            oMinimize = document.getElementById("u4a_bind_minimize"),
            oMaximize = document.getElementById("u4a_bind_maximize"),
            oClose = document.getElementById("u4a_bind_close");

        refreshU4AIcons(document);
        setWindowControlIcon(oMinimize, C_WINDOW_ICONS.minimize);
        setWindowControlIcon(oClose, C_WINDOW_ICONS.close);

        if (oWindowControls) {
            oWindowControls.setAttribute("aria-label", oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "952"));
        }

        if (oMinimize) {
            oMinimize.title = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "953");
            oMinimize.setAttribute("aria-label", oMinimize.title);
            oMinimize.addEventListener("click", minimizeWindow);
        }

        if (oMaximize) {
            oMaximize.title = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "954");
            oMaximize.setAttribute("aria-label", oMaximize.title);
            oMaximize.addEventListener("click", toggleMaximizeWindow);
        }

        if (oClose) {
            oClose.title = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "056");
            oClose.setAttribute("aria-label", oClose.title);
            oClose.addEventListener("click", closeWindow);
        }

        if (oTitlebar) {
            oTitlebar.classList.add("u4a_bind_titlebar_native_drag");
        }

        var oWin = getCurrentWindow();

        if (!oWin || typeof oWin.on !== "function") {
            return;
        }

        oWin.on("maximize", updateWindowState);
        oWin.on("unmaximize", updateWindowState);

        window.addEventListener("pagehide", function () {

            if (oTitlebar) {
                oTitlebar.classList.remove("u4a_bind_titlebar_native_drag");
            }

            endFrameTitlebarDrag();

            try {
                oWin.off("maximize", updateWindowState);
                oWin.off("unmaximize", updateWindowState);
            } catch (error) {
                try {
                    oWin.removeListener("maximize", updateWindowState);
                    oWin.removeListener("unmaximize", updateWindowState);
                } catch (e) {}
            }

        }, { once: true });

        updateWindowState();

    }


    /*************************************************************
     * @function - 테마 정보를 구한다.
     *************************************************************/
    oAPP.fn.getThemeInfo = function (){

        let oUserInfo = parent.process.USERINFO;
        let sSysID = oUserInfo.SYSID;
        
        // 해당 SYSID별 테마 정보 JSON을 읽는다.
        let sThemeJsonPath = oAPP.PATH.join(oAPP.USERDATA, "p13n", "theme", `${sSysID}.json`);
        if(oAPP.FS.existsSync(sThemeJsonPath) === false){
            return;
        }

        let sThemeJson = oAPP.FS.readFileSync(sThemeJsonPath, "utf-8");

        try {
        
            var oThemeJsonData = JSON.parse(sThemeJson);    

        } catch (error) {
            return;
        }

        return oThemeJsonData;

    } // end of oAPP.fn.getThemeInfo


    /*************************************************************
     * @function - White List Object 유무 확인 
     *************************************************************/
    oAPP.common.checkWLOList = function(REGTYP = "", CHGOBJ = ""){

        return oAPP.attr.oUserInfo.META.T_REG_WLO.some( item => item.REGTYP === REGTYP && item.CHGOBJ === CHGOBJ );

    };
    

    /*******************************************************
     * 메시지클래스 텍스트 작업 관련 Object -- end
     *******************************************************/

    oAPP.setBusy = function() {
        return;
    };


    function loadBindPopupContent(){

        initBindPopupContent();

    }


    oAPP.fn.setBindPopupWithinArea = function(){

        var oBindBodyDom = document.querySelector(".u4a_bind_body");

        if(!oBindBodyDom || typeof window?.sap?.ui?.core?.Popup?.setWithinArea !== "function"){
            return;
        }

        // 모든 UI5 popup의 위치 가능 영역을 custom titlebar 아래 본문으로 제한한다.
        window.sap.ui.core.Popup.setWithinArea(oBindBodyDom);

    };


    function getBindPopupWindowSizeKey(oBounds){

        if(
            oBounds &&
            Number.isFinite(oBounds.width) === true &&
            Number.isFinite(oBounds.height) === true
        ){
            return `${Math.round(oBounds.width)}x${Math.round(oBounds.height)}`;
        }

        try {

            var oWin = getCurrentWindow();

            if(oWin && typeof oWin.getSize === "function"){
                var aSize = oWin.getSize();

                if(Array.isArray(aSize) === true){
                    return `${Math.round(aSize[0])}x${Math.round(aSize[1])}`;
                }
            }

        } catch (error) {}

        return `${Math.round(window.innerWidth || 0)}x${Math.round(window.innerHeight || 0)}`;

    }


    oAPP.fn.setResizeSensitivePopoverWindowSize = function(){

        oAPP.attr.sResizeSensitivePopoverWindowSize = getBindPopupWindowSizeKey();

    };


    function isMessagePopoverControl(oPopover){

        if(typeof oPopover?.data === "function" && oPopover.data("msg_popover") === true){
            return true;
        }

        if(typeof oPopover?.oParent?.data === "function" && oPopover.oParent.data("msg_popover") === true){
            return true;
        }

        return false;

    }


    function closeMessagePopoverControl(oPopover){

        if(isMessagePopoverControl(oPopover) !== true){
            return false;
        }

        if(typeof oAPP.fn.clearMessagePopoverErrorState === "function"){
            oAPP.fn.clearMessagePopoverErrorState();
        }

        try {
            if(typeof oPopover?.oParent?.close === "function"){
                oPopover.oParent.close();
                return true;
            }

            if(typeof oPopover?.close === "function"){
                oPopover.close();
                return true;
            }

            if(typeof oPopover?.destroy === "function"){
                oPopover.destroy();
                return true;
            }

        } catch (error) {}

        return true;

    }


    oAPP.fn.closeMessagePopoverControl = closeMessagePopoverControl;


    function isActualWindowResize(oNextBounds){

        var sCurrentSize = getBindPopupWindowSizeKey(),
            sNextSize = getBindPopupWindowSizeKey(oNextBounds),
            sPrevSize = oAPP.attr.sResizeSensitivePopoverWindowSize;

        if(typeof sPrevSize === "undefined"){
            oAPP.attr.sResizeSensitivePopoverWindowSize = sNextSize || sCurrentSize;
            return false;
        }

        if(sNextSize === sCurrentSize && sCurrentSize === sPrevSize){
            return false;
        }

        oAPP.attr.sResizeSensitivePopoverWindowSize = sNextSize || sCurrentSize;

        return true;

    }


    oAPP.fn.closeResizeSensitivePopovers = function(oEvent, oNextBounds){

        if(isActualWindowResize(oNextBounds) !== true){
            return;
        }

        if(typeof window?.sap?.m?.InstanceManager?.getOpenPopovers !== "function"){
            return;
        }

        var aPopovers = window.sap.m.InstanceManager.getOpenPopovers() || [];

        for(var i = 0, l = aPopovers.length; i < l; i++){

            var oPopover = aPopovers[i];

            oAPP.fn.closeMessagePopoverControl(oPopover);

        }

    };


    applyFrameTheme(oAPP.fn.getThemeInfo());
    attachFrameTitlebarEvents();
    attachFrameThemeEvent();

    /************************************************************************
     * IPCRENDERER Events..
     ************************************************************************/
    oAPP.IPCRENDERER.on('if_modelBindingPopup', (events, oInfo) => {

        oAPP.attr.oUserInfo = oInfo.oUserInfo; // User 정보(필수)
        oAPP.attr.oThemeInfo = oInfo.oThemeInfo; // User 정보(필수)

        oAPP.attr.T_9011 = oInfo.T_9011;
        oAPP.attr.T_0022 = oInfo.T_0022;
        oAPP.attr.T_0023 = oInfo.T_0023;

        oAPP.attr.T_0014 = oInfo.T_0014;
        oAPP.attr.T_0015 = oInfo.T_0015;
        oAPP.attr.T_CEVT = oInfo.T_CEVT;
        oAPP.attr.oAppInfo = oInfo.oAppInfo;
        oAPP.attr.servNm = oInfo.servNm;
        oAPP.attr.DnDRandKey = oInfo.SSID;
        oAPP.attr.SSID       = oInfo.SSID;
        oAPP.attr.channelKey = oInfo.channelKey;
        oAPP.attr.browserkey = oQueryParams.browserkey;

        applyFrameTheme(oInfo.oThemeInfo);
        setFrameTitle();
        loadBindPopupContent();

    });
    

    window.oAPP = oAPP;

    return oAPP;

})(window);



function initBindPopupContent(){

    if(initBindPopupContent._started === true){
        return;
    }

    initBindPopupContent._started = true;

/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved. 
 * ----------------------------------------------------------------------
 * - file Name : bindPopup/index.js
 ************************************************************************/

/************************************************************************
 * 에러 감지 (index.js)
 ************************************************************************/
let zconsole = parent.WSERR(window, document, console);

let oAPP = parent.oAPP,
    PATHINFO = parent.PATHINFO;

(function (window, oAPP) {
    "use strict";
    

    //바인딩 모드.
    const CS_BIND_MODE = {
        DEFAULT : "01", //일반 바인딩 모드.
        BULK    : "02"  //바인딩 일괄적용 모드.
    };


    //파일, 폴더 경로 정보.
    const CS_PATH_INFO = {
        ROOT   : "",    //ROOT 경로
        DESIGN : "",    //DESIGN TREE UI 경로
        ADDIT  : ""     //바인딩 추가속성 정보 UI 경로.
    };


    //메시지 표현 ACTION CODE 정보.
    oAPP.attr.CS_MSG_ACTCD = {
        ACT01 : "01",     //모델 TREE 영역.
        ACT02 : "02",     //디자인 TREE 영역.
        ACT03 : "03",     //추가속성 정보 영역.
        ACT04 : "04",     //디자인 TREE 라인.
        ACT05 : "05",     //바인딩 추가속성 정보 TABLE 라인.
        ACT06 : "06",     //디자인 TREE 하단 추가속성 TABLE 영역.
        ACT07 : "07",     //디자인 TREE 하단 추가속성 TABLE 라인.
    };

    

    //바인딩 제외 항목.
    oAPP.attr.CT_BIND_EXCEPT = [
        {ITMCD:"", FLD01:"EXT00000030"},    //appcontainer의 AppID 프로퍼티인경우
        {ITMCD:"", FLD01:"EXT00000031"},    //appcontainer의 AppDescript.
        {ITMCD:"", FLD01:"EXT00000032"},    //appcontainer의 height
        {ITMCD:"", FLD01:"EXT00000033"},    //appcontainer의 width
        {ITMCD:"", FLD01:"EXT00001188"},    //selectOption2의 F4HelpID
        {ITMCD:"", FLD01:"EXT00001189"},    //selectOption2의 F4HelpReturnFIeld
        {ITMCD:"", FLD01:"EXT00002534"},    //selectOption3의 F4HelpID
        {ITMCD:"", FLD01:"EXT00002535"},    //selectOption3의 F4HelpReturnFIeld

        {ITMCD:"", FLD01:"EXT00001347"},    //sap.ui.table.Table autoGrowing
        {ITMCD:"", FLD01:"EXT00001348"},    //sap.m.Table autoGrowing
        {ITMCD:"", FLD01:"EXT00001349"},    //sap.m.List autoGrowing
        {ITMCD:"", FLD01:"EXT00002374"},    //sap.m.Page useBackToTopButton
        {ITMCD:"", FLD01:"EXT00002378"},    //sap.uxap.ObjectPageLayout useBackToTopButton
        {ITMCD:"", FLD01:"EXT00002379"}     //sap.f.DynamicPage
    ];


    oAPP.types = {};

    //오류 발생 정보 수집 구조.
    oAPP.types.TY_BIND_ERROR = {
        ACTCD    : "",     //오류 ACTION CODE
        LINE_KEY : "",     //오류 라인 KEY
        TYPE     : "",     //오류 TYPE
        TITLE    : "",     //오류 제목
        DESC     : "",     //오류 상세내역.
        LK_VIS   : true,   //오류 상세내역 링크 활성화 바인딩.
    };


    //바인딩 추가속성 정보 메시지 구조.
    oAPP.types.TY_ADDIT_MSG = {
        ITMCD : "",  //바인딩 추가속성 정보 ITEM CODE.
        ERMSG : "",  //오류 메시지 정보.
    };


    //BUSY DIALOG OPTION 파라메터 구조.
    oAPP.types.TY_BUSY_OPTION = {
        TITLE : "", //BUSY DIALOG 타이틀.
        DESC  : "", //BUSY DIALOG 메시지.
    };


    //오류 정보 수집 광역 ARRAY
    //(converion명 점검 오류 발생과 같은 특정 오류건 수집을 위한 array)
    oAPP.attr.T_EXCEP_ERR = [];

    //CONFIRM POPUP 호출시 SID.
    oAPP.attr.C_CONFIRM_POPUP = "WS_CONFIRM_POPUP";

    oAPP.settings = {};

    //미리보기 UI 수집 OBJECT.
    oAPP.attr.prev = {};

    let PATH = oAPP.PATH,
        APP = oAPP.APP,
        require = parent.require;


    function isolateNodeGlobalsForUi5Bootstrap(){

        if(typeof window.require !== "function" || typeof window.module !== "object"){
            return;
        }

        if(window.__u4aBindNode){
            return;
        }

        window.__u4aBindNode = {
            require : window.require,
            module  : window.module,
            exports : window.exports
        };

        window.require = undefined;
        window.module  = undefined;
        window.exports = undefined;

    }


    function restoreNodeGlobalsAfterUi5Bootstrap(){

        if(!window.__u4aBindNode){
            return;
        }

        window.require = window.__u4aBindNode.require;
        window.module  = window.__u4aBindNode.module;
        window.exports = window.__u4aBindNode.exports;

        delete window.__u4aBindNode;

    }

    //default 바인딩 모드.
    oAPP.attr.BIND_MODE = CS_BIND_MODE.BULK;


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 팝업의 화면 커스터마이징 기능에서 제어할 영역 코드를 정의한다.
    *  MODEL은 좌측 바인딩 필드 영역, DESIGN은 가운데 DESIGN TREE 영역,
    *  ADDIT은 우측 바인딩 추가 속성 영역을 의미한다.
    *  각 영역의 표시 여부는 저장된 사용자 설정과 현재 parent window 기준 상태에 따라
    *  독립적으로 관리되며, 영역 수에 맞춰 popup width/minWidth 및 splitter layout이
    *  다시 계산될 수 있도록 공통 기준값을 함께 둔다.
    */
    const CS_BIND_LAYOUT_AREA = {
        MODEL  : "MODEL",
        DESIGN : "DESIGN",
        ADDIT  : "ADDIT"
    };


    const CS_BIND_LAYOUT_MIN_WIDTH = {
        1: 360,
        2: 650,
        3: 900
    };


    const CS_BIND_LAYOUT_WIDTH = {
        1: 560,
        2: 900,
        3: 1280
    };


    //메인 관련 오브젝트.
    oAPP.oMain = {};

    //메인 이벤트 function 오브젝트.
    oAPP.oMain.events = {};

    //메인 관련 function.
    oAPP.oMain.fn = {};

    oAPP.oMain.attr = {};


    function lf_setCurrentWindowClosable(bClosable){

        try {

            var _oWin = oAPP.REMOTE.getCurrentWindow();

            if(!_oWin){
                return;
            }

            if(typeof _oWin.isDestroyed === "function" && _oWin.isDestroyed() === true){
                return;
            }

            _oWin.closable = bClosable;

        } catch (error) {}

    }


    function lf_postBusyToChild(oParam){

        try {

            if(!oAPP.oMain.broadToChild || typeof oAPP.oMain.broadToChild.postMessage !== "function"){
                return;
            }

            oAPP.oMain.broadToChild.postMessage(oParam);

        } catch (error) {}

    }
    

    /*************************************************************
     * @function - SYSID에 해당하는 테마 변경 IPC 이벤트
     *************************************************************/
    function _onIpcMain_if_p13n_themeChange(){ 

        let oThemeInfo = oAPP.fn.getThemeInfo();
        if(!oThemeInfo){
            return;
        }

        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
        let oBrowserWindow = oAPP.REMOTE.getCurrentWindow();
            oBrowserWindow.webContents.insertCSS(sWebConBodyCss);

        sap.ui.getCore().applyTheme(oThemeInfo.THEME);

    } // end of _onIpcMain_if_p13n_themeChange


    /*************************************************************
     * @function - IPC Event 등록
     *************************************************************/
    function _detachIpcEvents(){

        let oUserInfo = parent.process.USERINFO;
        let sSysID = oUserInfo.SYSID;

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
        oAPP.IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange); 

    } // end of _detachIpcEvents

    /*************************************************************
     * @function - IPC Event 등록
     *************************************************************/
    function _attachIpcEvents(){

        let oUserInfo = parent.process.USERINFO;
        let sSysID = oUserInfo.SYSID;

        // SYSID에 해당하는 테마 변경 IPC 이벤트를 등록한다.
        oAPP.IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, _onIpcMain_if_p13n_themeChange); 

    } // end of _attachIpcEvents


    /*************************************************************
     * @function - UI 구성 완료후 call back 처리.
     *************************************************************/
    function uiUpdateComplate(oUI){

        return new Promise((res)=>{
            
            if(typeof oUI === "undefined" || oUI === null){
                return res();
            }

            var _oTimer = null,
                _bDone = false,
                _fnDone = function(){

                    if(_bDone === true){
                        return;
                    }

                    _bDone = true;

                    if(_oTimer){
                        clearTimeout(_oTimer);
                    }

                    if(typeof oUI.removeEventDelegate === "function"){
                        oUI.removeEventDelegate(_oDelegate);
                    }

                    if(typeof oUI.data === "function"){
                        oUI.data("_onAfterRendering", null);
                    }

                    return res();

                };

            var _oDelegate = {
                onAfterRendering:(oEvent)=>{

                    //onAfterRendering 이벤트 제거.
                    _fnDone();

                    //onAfterRendering 정보 초기화.
                    // oUI.data("_onAfterRendering", null);

                    return;

                }
            };

            //onAfterRendering 추가.
            oUI.addEventDelegate(_oDelegate);
            
            //onAfterRendering 정보 매핑.
            oUI.data("_onAfterRendering", _oDelegate);

            _oTimer = setTimeout(_fnDone, 1000);

        });

    }


    function waitTableRowsUpdated(oTable, iTimeout){

        return new Promise((resolve)=>{

            if(!oTable || typeof oTable.attachEventOnce !== "function"){
                return resolve();
            }

            var _oTimer = null,
                _bDone = false,
                _fnDone = function(){

                    if(_bDone === true){
                        return;
                    }

                    _bDone = true;

                    if(_oTimer){
                        clearTimeout(_oTimer);
                    }

                    resolve();

                };

            oTable.attachEventOnce("rowsUpdated", _fnDone);

            _oTimer = setTimeout(_fnDone, iTimeout || 500);

        });

    }



    /*************************************************************
     * @function - path 정보 구성.
     *************************************************************/
    function getPathInfo(){
        
        //ROOT 경로.
        CS_PATH_INFO.ROOT   = oAPP.APP.getAppPath();


        //design tree path 구성.
        CS_PATH_INFO.DESIGN = oAPP.PATH.join(CS_PATH_INFO.ROOT, 
            "ws30", "ws10_20", "Popups", "bindPopup", "uiModule", "designTree.js");


        //바인딩 추가 속성  path 구성.
        CS_PATH_INFO.ADDIT  = oAPP.PATH.join(CS_PATH_INFO.ROOT, 
            "ws30", "ws10_20", "Popups", "bindPopup", "uiModule", "bindAdditInfo.js");


    }   //path 정보 구성.


    /*************************************************************
     * @function - UI TABLE 라이브러리 예외처리.
     *************************************************************/
    function excepUiTableLibrary(){

        jQuery.sap.require("sap.ui.table.extensions.KeyboardDelegate");
        sap.ui.table.extensions.KeyboardDelegate.prototype.onkeyup = function(oEvent) {
            var oCellInfo = sap.ui.table.utils.TableUtils.getCellInfo(oEvent.target);
            var ModKey = {
                CTRL: 1,
                SHIFT: 2,
                ALT: 4
            };
            
            function startRangeSelectionMode(oTable) {
                var iFocusedRowIndex = sap.ui.table.utils.TableUtils.getRowIndexOfFocusedCell(oTable);
                var iDataRowIndex = oTable.getRows()[iFocusedRowIndex].getIndex();
                var oSelectionPlugin = oTable._getSelectionPlugin();

                /**
                 * Contains information that are used when the range selection mode is active.
                 * If this property is undefined the range selection mode is not active.
                 * @type {{startIndex: int, selected: boolean}}
                 * @property {int} startIndex The index of the data row in which the selection mode was activated.
                 * @property {boolean} selected True, if the data row in which the selection mode was activated is selected.
                 * @private
                 */
                oTable._oRangeSelection = {
                    startIndex: iDataRowIndex,
                    selected: oSelectionPlugin.isIndexSelected(iDataRowIndex)
                };
            }

            // End the range selection mode.
            if (sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.SHIFT)) {
                delete this._oRangeSelection;
            }

            if (oCellInfo.isOfType(sap.ui.table.utils.TableUtils.CELLTYPE.COLUMNHEADER)) {
                if (sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.SPACE) || sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.ENTER)) {
                    sap.ui.table.utils.TableUtils.Menu.openContextMenu(this, oEvent.target);
                }
            } else if (sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.SPACE)) {
                //sap.ui.table.extensions.KeyboardDelegate._handleSpaceAndEnter(this, oEvent);
                sap.ui.table.extensions.KeyboardDelegate.prototype.onsapenter.call(this, oEvent);
            } else if ( oCellInfo.rowIndex !== null && sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.SPACE, ModKey.SHIFT)) {
                sap.ui.table.utils.TableUtils.toggleRowSelection(this, this.getRows()[oCellInfo.rowIndex].getIndex());


                startRangeSelectionMode(this);
            } else if (this._legacyMultiSelection && !oCellInfo.isOfType(sap.ui.table.utils.TableUtils.CELLTYPE.COLUMNROWHEADER) &&
                        (sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.SPACE, ModKey.CTRL) ||
                        sap.ui.table.extensions.KeyboardDelegate._isKeyCombination(oEvent, jQuery.sap.KeyCodes.ENTER, ModKey.CTRL))) {
                //sap.ui.table.extensions.KeyboardDelegate._handleSpaceAndEnter(this, oEvent);
                sap.ui.table.extensions.KeyboardDelegate.prototype.onsapenter.call(this, oEvent);
            }
        };

    }


    
    /*************************************************************
     * @function - 컬럼 width 계산 처리.
     *************************************************************/
    function uiTableCalcColumnWidth(oTable, oCol){
        
        var $this = oTable.$();
        var $hiddenArea = jQuery("<div>").addClass("sapUiTableHiddenSizeDetector sapUiTableHeaderDataCell sapUiTableDataCell");
        
        var oDom = sap.ui.getCore().getStaticAreaRef();
        
        oDom.appendChild($hiddenArea[0]);
        
                        
        var $cells = $this.find("td[data-sap-ui-colid = \"" + oCol.getId() + "\"]")
                        .filter(function(index, element) {
                            return element.style.display != "none";
                        }).children().clone();


        $cells.removeAttr("id"); // remove all id attributes

        // Determine the column width
        var iWidth = $hiddenArea.append($cells).width() + 4; // widest cell + 4px for borders, padding and rounding
        
        iWidth = Math.max(iWidth + 4, sap.ui.table.utils.TableUtils.Column.getMinColumnWidth()); // not to small

        $hiddenArea.remove();
        

        return iWidth;
        
    }   //컬럼 width 계산 처리.



    /*************************************************************
     * @function - sap.ui.table.Table의 autoResize 처리 이후 초기화.
     *************************************************************/
    function uiTabclearColumResizing(oTable) {
        if (oTable._$colResize) {
            oTable._$colResize.toggleClass("sapUiTableColRszActive", false);
            oTable._$colResize = null;
        }
        oTable._bIsColumnResizerMoving = false;
        oTable.$().toggleClass("sapUiTableResizing", false);
        oTable._enableTextSelection();

        var $Document = jQuery(document);
        $Document.off("touchmove.sapUiTableColumnResize");
        $Document.off("touchend.sapUiTableColumnResize");
        $Document.off("mousemove.sapUiTableColumnResize");
        $Document.off("mouseup.sapUiTableColumnResize");
        
    }  //sap.ui.table.Table의 autoResize 처리 이후 초기화.



    /*************************************************************
     * @function - 컬럼 resize 처리.
     *************************************************************/
    function setResizeCol(oTable, oCol, indx){

        setTimeout(function(){
            
            //UI, COLUMN, COLUMN INDEX 정보가 존재하지 않는경우 EXIT.
            if(!oTable){return;}

            if(typeof indx === "undefined"){return;}
            
        
            //해당 컬럼이 autoResize처리가 안되거나, resize가 안되는경우 다음 컬럼을 최적화 처리.
            if(!oCol.getAutoResizable() || !oCol.getResizable()){
                return;
            }
            
            //컬럼의 width를 계산.
            var _width = uiTableCalcColumnWidth(oTable, oCol);
            
            //계산된 컬럼 width를 얻을 수 없다면 다음 컬럼을 최적화 처리.
            if(!_width){return;}

            
            //컬럼 width 최적화처리.
            sap.ui.table.utils.TableUtils.Column.resizeColumn(oTable, indx, _width);
            
            //컬럼 최적화 이후 clear처리.
            uiTabclearColumResizing(oTable);
        
        }, 0);
        
    }   //컬럼 resize 처리.



    /*************************************************************
     * @function - 바인딩된 정보 확인 팝업 호출.(테스트목적)
     *************************************************************/
    function callBindingListPopup(){

        var _aT_0015 = [];

        for (const key in oAPP.attr.prev) {

            var _oUi = oAPP.attr.prev[key];

            if(typeof _oUi._T_0015 === "undefined"){
                continue;
            }

            _aT_0015 = _aT_0015.concat(JSON.parse(JSON.stringify(_oUi._T_0015)));
                
        }

        _aT_0015 = _aT_0015.filter( item => item.ISBND !== "" );

        if(_aT_0015.length === 0){
            sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "956"), 
                {my:"center center", at:"center center"});
            return;
        }


        var _oTab = new sap.ui.table.Table({
            selectionMode:"None",
            visibleRowCountMode:"Auto",
            extension:[
                new sap.m.OverflowToolbar({
                    content:[
                        new sap.m.Button({
                            text: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "161"),
                            press:function(){
                                oAPP.fn.setUiTableAutoResizeColumn(_oTab);
                            }
                        })
                    ]
                })
            ],
            rows:{
                path:"/T_LIST",
                template: new sap.ui.table.Row()
            }
        });
        
        var _s0015 = oAPP.fn.crtStru0015();

        for (let fld in _s0015) {
            _oTab.addColumn(new sap.ui.table.Column({
                sortProperty: fld,
                filterProperty: fld,
                autoResizable: true,
                label: new sap.m.Label({
                    text: fld,
                    design:"Bold"
                }),
                template: new sap.m.Text({
                    text:`{${fld}}`,
                    tooltip:`{${fld}}`,
                    wrapping: false
                })
            }));
        }

        var oDialog = new sap.m.Dialog({
            draggable:true,
            resizable: true,
            verticalScrolling:false,
            contentHeight: "60%",
            afterOpen:function(){
            },
            afterClose:function(){
                oDialog.destroy();
            },
            content:[
                _oTab
            ],
            buttons:[
                new sap.m.Button({
                    text: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "056"),
                    press:function(){
                        oDialog.close();
                    }
                })
            ]
        }).addStyleClass("sapUiSizeCompact");

        oDialog.setModel(new sap.ui.model.json.JSONModel({
            T_LIST:_aT_0015
        }));

        oDialog.oPopup.setModal(false);

        oDialog.open();

    }


    /*************************************************************
     * @function - design tree 활성화 처리.
     *************************************************************/
    function setVisibleDesignTree(){

        //design 영역의 tree 정보가 존재하지 않는경우 exit.
        if(typeof oAPP?.attr?.oDesign?.ui?.ROOT === "undefined"){
            return;
        }

        //design tree 활성화 처리.
        oAPP.attr.oDesign.ui.ROOT.setVisible(true);

    }
    

    /************************************************************************
     * sap.ui.table.Table의 Column AutoResize 처리.
     *-----------------------------------------------------------------------
    * @param   {object} oTable             
    *  - Column AutoResize 처리할 table UI
    ***********************************************************************/
    oAPP.fn.setUiTableAutoResizeColumn = function(oTable){
        
        if(typeof oTable === "undefined"){return;}
        
        //TABLE의 컬럼 정보 얻기.
        var _aColumn = oTable.getColumns();

        //컬럼이 존재하지 않는경우 exit.
        if(_aColumn.length === 0){return;}
        
        for(var i = 0, l = _aColumn.length; i < l; i++){

            var _oColumn = _aColumn[i];

            setResizeCol(oTable, _oColumn, i);

        }

        if(isFitColumnTargetTable(oTable) === true){
            /**
            * @since   2026-06-12 01:36:51
            * @version v3.6.4-3
            * @author  PES
            * @description
            *  화면 커스터마이징으로 특정 영역만 표시되는 경우 sap.ui.table의 기본 auto resize만으로는
            *  table 전체 폭을 채우지 못하고 우측에 빈 영역이 남을 수 있다.
            *  기존 column resize 흐름은 유지하되, 커스터마이징 layout에서 보정 대상인 table에 한해서
            *  rendering 이후 남은 폭을 마지막 표시 column에 분배하도록 예약 처리한다.
            *  이 보정은 바인딩 필드 단독 화면, DESIGN TREE 영역, 바인딩 추가 속성 영역처럼
            *  popup layout 변경으로 column 폭 재계산이 필요한 경우에만 수행된다.
            */
            scheduleFitTableColumns(oTable);
        }
        
    };   //table의 컬럼 resize 처리.


    


    /************************************************************************
     * 모델 데이터 set
     * **********************************************************************
     * @param {String} sModelPath  
     * - Model Path 명
     * 예) /WS10/APPDATA
     * @param {Object} oModelData
     * 
     * @param {Boolean} bIsRefresh 
     * model Refresh 유무
     ************************************************************************/
    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 팝업 본문 3개 영역의 표시 상태를 관리하기 위한 helper 영역이다.
    *  저장된 layout 상태를 읽어오고, 유효하지 않은 조합을 보정하며, 현재 JSONModel에 반영한다.
    *  ADDIT 영역은 보조 정보 영역이므로 MODEL 또는 DESIGN 중 하나 이상과 함께 표시되어야 하며,
    *  세 영역이 모두 비활성화되는 상태는 허용하지 않고 기본 전체 표시 상태로 되돌린다.
    *  또한 비활성 영역은 visible false로 처리하여 화면에는 보이지 않게 하고,
    *  이후 module start 시 rendering wait를 생략할 수 있는 옵션을 제공한다.
    */
    function getBindLayoutDefaultState(){

        return {
            MODEL  : true,
            DESIGN : true,
            ADDIT  : true
        };

    }


    function getBindLayoutActiveCount(oState){

        var iCount = 0;

        if(oState?.MODEL === true){
            iCount++;
        }

        if(oState?.DESIGN === true){
            iCount++;
        }

        if(oState?.ADDIT === true){
            iCount++;
        }

        return iCount;

    }


    function normalizeBindLayoutState(oState){

        var oDefault = getBindLayoutDefaultState(),
            oResult = {};

        oResult.MODEL  = typeof oState?.MODEL  === "boolean" ? oState.MODEL  : oDefault.MODEL;
        oResult.DESIGN = typeof oState?.DESIGN === "boolean" ? oState.DESIGN : oDefault.DESIGN;
        oResult.ADDIT  = typeof oState?.ADDIT  === "boolean" ? oState.ADDIT  : oDefault.ADDIT;

        if(oResult.ADDIT === true && oResult.MODEL !== true && oResult.DESIGN !== true){
            oResult.MODEL = true;
        }

        if(getBindLayoutActiveCount(oResult) === 0){
            oResult = oDefault;
        }

        return oResult;

    }


    function getBindLayoutStorageKey(){

        var sParentKey = oAPP.attr.browserkey || oAPP.attr.SSID || "default";

        return `U4A_BIND_POPUP_LAYOUT_${sParentKey}`;

    }


    function loadBindLayoutState(){

        try {

            var sState = localStorage.getItem(getBindLayoutStorageKey());

            if(!sState){
                return getBindLayoutDefaultState();
            }

            return normalizeBindLayoutState(JSON.parse(sState));

        } catch (error) {
            return getBindLayoutDefaultState();
        }

    }


    function saveBindLayoutState(oState){

        try {
            localStorage.setItem(getBindLayoutStorageKey(), JSON.stringify(normalizeBindLayoutState(oState)));
        } catch (error) {}

    }


    function setBindLayoutModelState(oState){

        if(!oAPP.attr.oModel){
            return;
        }

        oAPP.attr.oModel.oData.BIND_LAYOUT = JSON.parse(JSON.stringify(normalizeBindLayoutState(oState)));
        oAPP.attr.oModel.refresh(true);

    }


    function getCurrentBindLayoutState(){

        return normalizeBindLayoutState(oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT);

    }


    function isBindLayoutAreaActive(sAreaKey){

        return getCurrentBindLayoutState()[sAreaKey] === true;

    }


    function getBindLayoutRenderOption(sAreaKey){

        return {
            skipRenderingWait: isBindLayoutAreaActive(sAreaKey) !== true
        };

    }


    function isDesignAdditInfoVisible(oState){

        oState = normalizeBindLayoutState(oState || oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT);

        return oState.DESIGN === true && oAPP.attr.oModel?.oData?.vis_addit === true;

    }


    function setDesignAdditInfoVisible(oState){

        if(!oAPP.ui.oPageAdit){
            return;
        }

        oAPP.ui.oPageAdit.setVisible(isDesignAdditInfoVisible(oState));

    }


    function setBindLayoutPageVisible(oState){

        oState = normalizeBindLayoutState(oState || oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT);

        if(oAPP.ui.oPageLeft){
            oAPP.ui.oPageLeft.setVisible(oState.MODEL === true);
        }

        if(oAPP.ui.oPageCenter){
            oAPP.ui.oPageCenter.setVisible(oState.DESIGN === true);

            var oDesignArea = oAPP.ui.oPageCenter.data("area1");
            if(oDesignArea){
                oDesignArea.setVisible(oState.DESIGN === true);
            }
        }

        if(oAPP.ui.oPageRight){
            oAPP.ui.oPageRight.setVisible(oState.ADDIT === true);
        }

        setDesignAdditInfoVisible(oState);

    }


    function setBindLayoutData(oArea, sSize, iMinSize, bResizable){

        if(!oArea || typeof oArea.getLayoutData !== "function"){
            return;
        }

        var oLayoutData = oArea.getLayoutData();

        if(!oLayoutData){
            return;
        }

        if(typeof oLayoutData.setSize === "function"){
            oLayoutData.setSize(sSize);
        }

        if(typeof oLayoutData.setMinSize === "function"){
            oLayoutData.setMinSize(iMinSize);
        }

        if(typeof oLayoutData.setResizable === "function"){
            oLayoutData.setResizable(bResizable);
        }

    }


    function getCurrentWindowBoundsSnapshot(){

        try {

            var oWin = oAPP.REMOTE?.getCurrentWindow?.();

            if(!oWin || oWin.isDestroyed?.() === true || typeof oWin.getBounds !== "function"){
                return;
            }

            var oBounds = oWin.getBounds();

            return {
                width  : oBounds.width,
                height : oBounds.height
            };

        } catch (error) {
            return;
        }

    }


    function restoreCurrentWindowBoundsSnapshot(oSnapshot){

        if(!oSnapshot?.windowBounds){
            return;
        }

        try {

            var oWin = oAPP.REMOTE?.getCurrentWindow?.();

            if(!oWin || oWin.isDestroyed?.() === true || typeof oWin.getBounds !== "function" || typeof oWin.setBounds !== "function"){
                return;
            }

            if(typeof oWin.isMaximized === "function" && oWin.isMaximized() === true){
                return;
            }

            if(typeof oWin.isFullScreen === "function" && oWin.isFullScreen() === true){
                return;
            }

            var oBounds = oWin.getBounds();

            if(oBounds.width === oSnapshot.windowBounds.width && oBounds.height === oSnapshot.windowBounds.height){
                return;
            }

            oWin.setBounds({
                x      : oBounds.x,
                y      : oBounds.y,
                width  : oSnapshot.windowBounds.width,
                height : oSnapshot.windowBounds.height
            });

        } catch (error) {}

    }


    function getMainSplitterLayoutSnapshot(){

        var oSplitter = oAPP.ui.oSptMain;

        if(!oSplitter || typeof oSplitter.getContentAreas !== "function"){
            return;
        }

        var aArea = oSplitter.getContentAreas();

        if(Array.isArray(aArea) !== true || aArea.length === 0){
            return;
        }

        return {
            layoutState  : JSON.stringify(getCurrentBindLayoutState()),
            layoutData   : JSON.parse(JSON.stringify(getCurrentBindLayoutState())),
            windowBounds : getCurrentWindowBoundsSnapshot(),
            areas        : aArea.map(function(oArea){

                var oLayoutData = oArea?.getLayoutData?.();

                return {
                    area      : oArea,
                    size      : oLayoutData?.getSize?.(),
                    minSize   : oLayoutData?.getMinSize?.(),
                    resizable : oLayoutData?.getResizable?.()
                };

            })
        };

    }


    function getBindLayoutSnapshotState(oSnapshot){

        if(oSnapshot?.layoutData){
            return normalizeBindLayoutState(oSnapshot.layoutData);
        }

        try {
            return normalizeBindLayoutState(JSON.parse(oSnapshot?.layoutState || "{}"));
        } catch (error) {
            return getCurrentBindLayoutState();
        }

    }


    function getBindLayoutSnapshotArea(oSnapshot, oArea){

        if(Array.isArray(oSnapshot?.areas) !== true){
            return;
        }

        return oSnapshot.areas.find(function(oAreaInfo){
            return oAreaInfo.area === oArea;
        });

    }


    function getDefaultMainSplitterAreaSize(iIndex, iActiveCount){

        if(iActiveCount === 2 && iIndex === 0){
            return "50%";
        }

        if(iActiveCount === 3){
            return iIndex === 0 ? "30%" : (iIndex === 1 ? "40%" : "auto");
        }

        return "auto";

    }


    function rebuildMainSplitterLayoutFromSnapshot(oSnapshot){

        var oSplitter = oAPP.ui.oSptMain;

        if(!oSplitter){
            return false;
        }

        var oState = getBindLayoutSnapshotState(oSnapshot),
            aAreaInfo = getBindLayoutAreaInfo(),
            aActiveArea = aAreaInfo.filter(function(oAreaInfo){
                return oState[oAreaInfo.KEY] === true && !!oAreaInfo.UI;
            }),
            iActiveCount = aActiveArea.length,
            oAreaSize = {};

        if(iActiveCount === 0){
            return false;
        }

        oAPP.attr.oBindLayoutState = JSON.parse(JSON.stringify(oState));
        setBindLayoutPageVisible(oState);
        oSplitter.removeAllAggregation("contentAreas", true);

        for(var i = 0, l = aAreaInfo.length; i < l; i++){
            if(!aAreaInfo[i].UI){
                continue;
            }

            aAreaInfo[i].UI.setVisible(oState[aAreaInfo[i].KEY] === true);
        }

        for(var i = 0, l = aActiveArea.length; i < l; i++){

            var oAreaInfo = aActiveArea[i],
                oSnapshotArea = getBindLayoutSnapshotArea(oSnapshot, oAreaInfo.UI),
                sSize = typeof oSnapshotArea?.size !== "undefined" ? oSnapshotArea.size : getDefaultMainSplitterAreaSize(i, iActiveCount),
                iMinSize = typeof oSnapshotArea?.minSize !== "undefined" ? oSnapshotArea.minSize : oAreaInfo.MIN_SIZE,
                bResizable = typeof oSnapshotArea?.resizable !== "undefined" ? oSnapshotArea.resizable : iActiveCount > 1;

            setBindLayoutData(oAreaInfo.UI, sSize, iMinSize, bResizable);
            oAreaSize[oAreaInfo.KEY] = sSize;
            oSplitter.addContentArea(oAreaInfo.UI);

        }

        if(oAPP.attr.oModel){
            oAPP.attr.oModel.oData.BIND_LAYOUT = JSON.parse(JSON.stringify(oState));
            oAPP.attr.oModel.oData.width = oAreaSize.MODEL || "auto";
            oAPP.attr.oModel.oData.width_c = oAreaSize.DESIGN || "auto";
            oAPP.attr.oModel.oData.width_r = oAreaSize.ADDIT || "auto";
            oAPP.attr.oModel.refresh(true);
        }

        oAPP.attr.iBindLayoutActiveCount = iActiveCount;
        oAPP.attr.oBindLayoutAppliedState = JSON.parse(JSON.stringify(oState));
        applyBindLayoutMinimumWidth(iActiveCount, false);
        restoreCurrentWindowBoundsSnapshot(oSnapshot);
        refreshBindLayoutTables(oState);
        oSplitter.invalidate();
        scheduleFitModelFieldTableColumns();

        if(oState.MODEL === true){
            scheduleExpandModelFieldTree();
        }

        return true;

    }


    function syncMainSplitterSnapshotToModel(oSnapshot){

        var oModel = oAPP.attr.oModel;

        if(!oModel || !oModel.oData || Array.isArray(oSnapshot?.areas) !== true){
            return;
        }

        var bChanged = false;

        for(var i = 0, l = oSnapshot.areas.length; i < l; i++){

            var oAreaInfo = oSnapshot.areas[i],
                sPath;

            if(oAreaInfo.area === oAPP.ui.oPageLeft){
                sPath = "width";
            }

            if(oAreaInfo.area === oAPP.ui.oPageCenter){
                sPath = "width_c";
            }

            if(oAreaInfo.area === oAPP.ui.oPageRight){
                sPath = "width_r";
            }

            if(!sPath || typeof oAreaInfo.size === "undefined"){
                continue;
            }

            if(oModel.oData[sPath] === oAreaInfo.size){
                continue;
            }

            oModel.oData[sPath] = oAreaInfo.size;
            bChanged = true;

        }

        if(bChanged === true){
            oModel.refresh(true);
        }

    }


    function restoreMainSplitterLayoutSnapshot(oSnapshot){

        var oSplitter = oAPP.ui.oSptMain;

        if(!oSplitter || Array.isArray(oSnapshot?.areas) !== true){
            return;
        }

        if(oSnapshot.layoutState !== JSON.stringify(getCurrentBindLayoutState())){
            rebuildMainSplitterLayoutFromSnapshot(oSnapshot);
            return;
        }

        var aArea = oSplitter.getContentAreas();

        if(Array.isArray(aArea) !== true || aArea.length !== oSnapshot.areas.length){
            rebuildMainSplitterLayoutFromSnapshot(oSnapshot);
            return;
        }

        for(var i = 0, l = aArea.length; i < l; i++){
            if(aArea[i] !== oSnapshot.areas[i].area){
                rebuildMainSplitterLayoutFromSnapshot(oSnapshot);
                return;
            }
        }

        syncMainSplitterSnapshotToModel(oSnapshot);

        for(var i = 0, l = oSnapshot.areas.length; i < l; i++){

            var oAreaInfo = oSnapshot.areas[i],
                oLayoutData = oAreaInfo.area?.getLayoutData?.();

            if(!oLayoutData){
                continue;
            }

            if(typeof oLayoutData.setSize === "function" && typeof oAreaInfo.size !== "undefined"){
                oLayoutData.setSize(oAreaInfo.size);
            }

            if(typeof oLayoutData.setMinSize === "function" && typeof oAreaInfo.minSize !== "undefined"){
                oLayoutData.setMinSize(oAreaInfo.minSize);
            }

            if(typeof oLayoutData.setResizable === "function" && typeof oAreaInfo.resizable !== "undefined"){
                oLayoutData.setResizable(oAreaInfo.resizable);
            }

        }

        restoreCurrentWindowBoundsSnapshot(oSnapshot);
        oSplitter.invalidate();
        scheduleFitModelFieldTableColumns();

    }


    function clearBindFieldDragLayoutRestoreTimers(){

        var aTimer = oAPP.attr.aBindFieldDragLayoutRestoreTimer;

        if(Array.isArray(aTimer) !== true){
            oAPP.attr.aBindFieldDragLayoutRestoreTimer = [];
            return;
        }

        for(var i = 0, l = aTimer.length; i < l; i++){
            clearTimeout(aTimer[i]);
        }

        oAPP.attr.aBindFieldDragLayoutRestoreTimer = [];

    }


    oAPP.fn.captureBindFieldDragLayout = function(){

        clearBindFieldDragLayoutRestoreTimers();
        oAPP.attr.oBindFieldDragLayoutSnapshot = getMainSplitterLayoutSnapshot();

    };


    oAPP.fn.scheduleRestoreBindFieldDragLayout = function(){

        var oSnapshot = oAPP.attr.oBindFieldDragLayoutSnapshot;

        if(!oSnapshot){
            return;
        }

        clearBindFieldDragLayoutRestoreTimers();

        var aDelay = [0, 80, 250, 700, 1200];

        for(var i = 0, l = aDelay.length; i < l; i++){

            oAPP.attr.aBindFieldDragLayoutRestoreTimer.push(setTimeout(function(){
                restoreMainSplitterLayoutSnapshot(oSnapshot);
            }, aDelay[i]));

        }

        oAPP.attr.aBindFieldDragLayoutRestoreTimer.push(setTimeout(function(){
            oAPP.attr.oBindFieldDragLayoutSnapshot = null;
            clearBindFieldDragLayoutRestoreTimers();
        }, 1500));

    };


    function applyBindLayoutMinimumWidth(iActiveCount, bResizeWindow){

        var oWin = oAPP.REMOTE.getCurrentWindow(),
            iMinWidth = CS_BIND_LAYOUT_MIN_WIDTH[iActiveCount] || CS_BIND_LAYOUT_MIN_WIDTH[3],
            iWidth = Math.max(iMinWidth, CS_BIND_LAYOUT_WIDTH[iActiveCount] || iMinWidth),
            iMinHeight = 650;

        try {

            if(!oWin){
                return;
            }

            if(typeof oWin.isDestroyed === "function" && oWin.isDestroyed() === true){
                return;
            }

            if(typeof oWin.getMinimumSize === "function"){
                var aMinSize = oWin.getMinimumSize();

                if(Array.isArray(aMinSize) === true && aMinSize[1] > 0){
                    iMinHeight = aMinSize[1];
                }
            }

            if(typeof oWin.setMinimumSize === "function"){
                oWin.setMinimumSize(iMinWidth, iMinHeight);
            }

            if(typeof oWin.isMaximized === "function" && oWin.isMaximized() === true){
                return;
            }

            if(typeof oWin.isFullScreen === "function" && oWin.isFullScreen() === true){
                return;
            }

            if(typeof oWin.getSize !== "function" || typeof oWin.setSize !== "function"){
                return;
            }

            var aSize = oWin.getSize();

            if(Array.isArray(aSize) === false){
                return;
            }

            if(bResizeWindow === true){
                oWin.setSize(iWidth, aSize[1]);
                return;
            }

            if(aSize[0] < iMinWidth){
                oWin.setSize(iMinWidth, aSize[1]);
            }

        } catch (error) {}

    }


    function getBindLayoutAreaInfo(){

        return [
            {
                KEY     : CS_BIND_LAYOUT_AREA.MODEL,
                UI      : oAPP.ui.oPageLeft,
                MIN_SIZE: 260
            },
            {
                KEY     : CS_BIND_LAYOUT_AREA.DESIGN,
                UI      : oAPP.ui.oPageCenter,
                MIN_SIZE: 300
            },
            {
                KEY     : CS_BIND_LAYOUT_AREA.ADDIT,
                UI      : oAPP.ui.oPageRight,
                MIN_SIZE: 260
            }
        ];

    }


    function refreshBindLayoutTables(oState){

        setTimeout(function(){

            if(oState.MODEL === true){
                if(isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) === true){
                    oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);
                }
            }

            if(oState.DESIGN === true && oAPP.attr?.oDesign?.ui?.TREE){
                oAPP.fn.setUiTableAutoResizeColumn(oAPP.attr.oDesign.ui.TREE);
            }

            if(oState.ADDIT === true || isDesignAdditInfoVisible(oState) === true){
                oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oAdditTab);
            }

            if(oState.ADDIT === true){
                if(oAPP.attr?.oAddit?.ui?.ROOT){
                    oAPP.fn.setUiTableAutoResizeColumn(oAPP.attr.oAddit.ui.ROOT);
                }
            }

        }, 0);

    }


    function expandModelFieldTree(){

        var oTree = oAPP.ui.oModelFieldTree;

        if(!oTree || typeof oTree.expandToLevel !== "function"){
            return;
        }

        if(isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) !== true){
            return;
        }

        oTree.expandToLevel(99999);

    }


    function scheduleExpandModelFieldTree(){

        var oTree = oAPP.ui.oModelFieldTree;

        if(!oTree){
            return;
        }

        if(isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) !== true){
            return;
        }

        if(typeof oTree.attachEventOnce === "function"){
            oTree.attachEventOnce("rowsUpdated", expandModelFieldTree);
        }

        setTimeout(expandModelFieldTree, 0);
        setTimeout(expandModelFieldTree, 100);
        setTimeout(expandModelFieldTree, 300);

    }


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  커스터마이징 layout 적용 후 table column이 실제 표시 영역을 끝까지 채우도록 보정한다.
    *  UI5 table은 column auto resize 이후에도 splitter 폭, 세로 scrollbar, 비활성 영역 제거 시점에 따라
    *  마지막 column 뒤에 빈 공간이 남을 수 있으므로 실제 DOM 폭을 기준으로 남는 폭을 계산한다.
    *  보정 대상은 현재 표시 중인 영역의 table로 제한하여 기존 바인딩 처리, 선택 이벤트,
    *  drag & drop 흐름에는 영향을 주지 않고 화면 표시 품질만 보완한다.
    */
    function isOnlyModelFieldLayout(){

        var oState = normalizeBindLayoutState(oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT);

        return oState.MODEL === true && oState.DESIGN !== true && oState.ADDIT !== true;

    }


    function getTableColumnAreaWidth(oTable){

        if(!oTable || !oTable.getDomRef()){
            return 0;
        }

        var $Table = oTable.$(),
            $ScrollArea = $Table.find(".sapUiTableCtrlScr").first(),
            iWidth = $ScrollArea.length > 0 ? $ScrollArea.innerWidth() : $Table.innerWidth();

        if(!$ScrollArea.length){
            var $VerticalScroll = $Table.find(".sapUiTableVSb:visible").first();

            if($VerticalScroll.length > 0){
                iWidth -= $VerticalScroll.outerWidth();
            }
        }

        return Math.max(Math.floor(iWidth || 0) - 2, 0);

    }


    function getTableColumnRenderedWidth(oTable, oColumn){

        if(!oTable || !oColumn){
            return 0;
        }

        var $Cell = oTable.$().find(`td[data-sap-ui-colid="${oColumn.getId()}"]`).filter(":visible").first();

        if($Cell.length > 0){
            return Math.ceil($Cell.outerWidth());
        }

        var sWidth = oColumn.getWidth && oColumn.getWidth(),
            iWidth = parseInt(sWidth, 10);

        return Number.isNaN(iWidth) === true ? 0 : iWidth;

    }


    function isFitColumnTargetTable(oTable){

        if(!oTable){
            return false;
        }

        if(oTable === oAPP.ui.oModelFieldTree){
            return isOnlyModelFieldLayout() === true;
        }

        if(oTable === oAPP.attr?.oDesign?.ui?.TREE){
            return isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.DESIGN) === true;
        }

        if(oTable === oAPP.attr?.oAddit?.ui?.ROOT){
            return isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.ADDIT) === true;
        }

        if(oTable === oAPP.ui.oAdditTab){
            return oTable.getVisible && oTable.getVisible() === true;
        }

        return false;

    }


    function isAdditBindInfoTable(oTable){

        if(!oTable || typeof oTable.data !== "function"){
            return false;
        }

        var sTabName = oTable.data("TAB_NAME");

        return sTabName === "DESIGN_ADDIT" || sTabName === "MAIN_ADDIT";

    }


    function fitAdditBindInfoTableColumns(oTable, aColumn, iAreaWidth){

        if(isAdditBindInfoTable(oTable) !== true || aColumn.length !== 2){
            return false;
        }

        var iMinValueWidth = iAreaWidth < 360 ? 120 : 180,
            iMaxPropertyWidth = iAreaWidth < 600 ? 220 : 280,
            iPropertyWidth = Math.floor(iAreaWidth * (iAreaWidth < 460 ? 0.44 : 0.4));

        iPropertyWidth = Math.max(iPropertyWidth, iAreaWidth < 360 ? 120 : 160);
        iPropertyWidth = Math.min(iPropertyWidth, iMaxPropertyWidth, iAreaWidth - iMinValueWidth);

        if(iPropertyWidth <= 0){
            return false;
        }

        aColumn[0].setWidth(`${iPropertyWidth}px`);
        aColumn[1].setWidth(`${iAreaWidth - iPropertyWidth}px`);

        return true;

    }


    function fitTableColumns(oTable, iDelay){

        setTimeout(function(){

            if(!oTable || !oTable.getDomRef()){
                return;
            }

            var aColumn = oTable.getColumns().filter(function(oColumn){
                return typeof oColumn.getVisible !== "function" || oColumn.getVisible() === true;
            });

            if(aColumn.length === 0){
                return;
            }

            var iAreaWidth = getTableColumnAreaWidth(oTable);

            if(iAreaWidth <= 0){
                return;
            }

            if(fitAdditBindInfoTableColumns(oTable, aColumn, iAreaWidth) === true){
                return;
            }

            var iColumnWidth = 0;

            for(var i = 0, l = aColumn.length; i < l; i++){
                iColumnWidth += getTableColumnRenderedWidth(oTable, aColumn[i]);
            }

            var iRemainWidth = iAreaWidth - iColumnWidth;

            if(iRemainWidth <= 1){
                return;
            }

            var oTargetColumn = aColumn[aColumn.length - 1],
                iTargetWidth = getTableColumnRenderedWidth(oTable, oTargetColumn);

            if(iTargetWidth <= 0){
                return;
            }

            oTargetColumn.setWidth(`${iTargetWidth + iRemainWidth}px`);

        }, iDelay || 0);

    }


    function scheduleFitTableColumns(oTable){

        if(isFitColumnTargetTable(oTable) !== true){
            return;
        }

        fitTableColumns(oTable, 0);
        fitTableColumns(oTable, 100);
        fitTableColumns(oTable, 300);

    }


    function scheduleFitModelFieldTableColumns(){

        scheduleFitTableColumns(oAPP.ui.oModelFieldTree);

    }


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  사용자가 선택한 바인딩 팝업 영역 구성을 실제 Splitter layout에 반영한다.
    *  비활성 영역은 contentAreas에서 제외하고 visible false로 숨겨 빈 공간이 남지 않게 하며,
    *  활성 영역 수에 따라 splitter size/resizable/minSize와 BrowserWindow minWidth를 재계산한다.
    *  저장 옵션이 전달된 경우 현재 parent window 기준 저장소에 상태를 보관하여
    *  같은 편집 창에서 팝업을 다시 열 때 마지막 화면 구성을 유지한다.
    *  layout 변경 후에는 표시 중인 table만 다시 column 최적화를 수행하여 기존 데이터/이벤트 흐름은 유지한다.
    */
    oAPP.fn.applyBindLayoutCustomizing = function(bSave){

        var oSplitter = oAPP.ui.oSptMain;

        if(!oSplitter){
            return;
        }

        var oPrevState = normalizeBindLayoutState(oAPP.attr.oBindLayoutAppliedState || oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT),
            oState = normalizeBindLayoutState(oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT),
            bReactivateModelArea = oPrevState.MODEL !== true && oState.MODEL === true;

        oAPP.attr.oBindLayoutState = oState;
        setBindLayoutModelState(oState);
        setBindLayoutPageVisible(oState);

        if(bSave === true){
            saveBindLayoutState(oState);
        }

        var aAreaInfo = getBindLayoutAreaInfo(),
            iPrevActiveCount = oAPP.attr.iBindLayoutActiveCount,
            aActiveArea = aAreaInfo.filter(function(oAreaInfo){
                return oState[oAreaInfo.KEY] === true && !!oAreaInfo.UI;
            }),
            iActiveCount = aActiveArea.length;

        if(iActiveCount === 0){
            return;
        }

        oSplitter.removeAllAggregation("contentAreas", true);

        for(var i = 0, l = aAreaInfo.length; i < l; i++){
            if(!aAreaInfo[i].UI){
                continue;
            }

            aAreaInfo[i].UI.setVisible(oState[aAreaInfo[i].KEY] === true);
        }

        var oAreaSize = {};

        for(var i = 0, l = aActiveArea.length; i < l; i++){

            var oAreaInfo = aActiveArea[i],
                bLast = i === l - 1,
                sSize = "auto";

            if(iActiveCount === 2 && bLast === false){
                sSize = "50%";
            }

            if(iActiveCount === 3){
                sSize = i === 0 ? "30%" : (i === 1 ? "40%" : "auto");
            }

            setBindLayoutData(oAreaInfo.UI, sSize, oAreaInfo.MIN_SIZE, iActiveCount > 1);
            oAreaSize[oAreaInfo.KEY] = sSize;
            oSplitter.addContentArea(oAreaInfo.UI);

        }

        if(oAPP.attr.oModel){
            oAPP.attr.oModel.oData.width = oAreaSize.MODEL || "auto";
            oAPP.attr.oModel.oData.width_c = oAreaSize.DESIGN || "auto";
            oAPP.attr.oModel.oData.width_r = oAreaSize.ADDIT || "auto";
            oAPP.attr.oModel.refresh(true);
        }

        applyBindLayoutMinimumWidth(iActiveCount, typeof iPrevActiveCount === "undefined" || iPrevActiveCount !== iActiveCount);
        oAPP.attr.iBindLayoutActiveCount = iActiveCount;
        refreshBindLayoutTables(oState);
        oSplitter.invalidate();
        scheduleFitModelFieldTableColumns();

        if(bReactivateModelArea === true){
            scheduleExpandModelFieldTree();
        }

        oAPP.attr.oBindLayoutAppliedState = JSON.parse(JSON.stringify(oState));

    };


    /**
        * @since   2026-06-26 17:04:08
        * @version v3.6.4-4
        * @author  PES
        * @description
        * 화면 커스터마이징 dialog에서 도움말 문서 호출 중인 상태를 사용자가 확인할 수 있도록 dialog 자체 busy 상태를 제어한다.
        */
    oAPP.fn.setBindLayoutCustomizingDialogBusy = function(bBusy){

        var oDialog = oAPP.attr.oBindLayoutCustomizingDialog;

        if(typeof oDialog?.setBusy !== "function"){
            return;
        }

        if(bBusy === true && typeof oDialog?.setBusyIndicatorDelay === "function"){
            oDialog.setBusyIndicatorDelay(1);
        }

        oDialog.setBusy(bBusy);

    };


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 필드, DESIGN TREE, 바인딩 추가 속성 각 영역의 toolbar에서 공통으로 사용할
    *  화면 커스터마이징 버튼을 생성한다.
    *  어느 영역에서 호출하더라도 동일한 설정 popup을 열도록 하여 사용자가 현재 위치와 관계없이
    *  표시 영역 조합을 즉시 변경할 수 있게 한다.
    */
    oAPP.fn.createBindLayoutCustomizingButton = function(){

        var sText = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "957");

        return new sap.m.OverflowToolbarButton({
            icon: "sap-icon://action-settings",
            text: sText,
            tooltip: sText,
            enabled: "{/edit_layout_customizing}",
            busyIndicatorDelay: 1,
            press: oAPP.fn.openBindLayoutCustomizingPopup
        });

    };


    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  화면 커스터마이징 popup을 호출하여 바인딩 필드, DESIGN TREE, 바인딩 추가 속성 영역의
    *  표시 여부를 사용자가 직접 선택할 수 있게 한다.
    *  단순 텍스트 대신 icon, ObjectStatus, Switch, 안내 MessageStrip을 함께 배치하여
    *  현재 표시/숨김 상태와 영역의 의미를 직관적으로 확인하도록 구성한다.
    *  추가 속성 영역만 단독으로 표시되는 조합은 허용하지 않으며,
    *  MODEL 또는 DESIGN 중 하나가 항상 함께 선택되도록 switch 변경 시점에 상호 보정한다.
    */
    oAPP.fn.openBindLayoutCustomizingPopup = function(){

        var oState = normalizeBindLayoutState(oAPP.attr.oBindLayoutState || oAPP.attr.oModel?.oData?.BIND_LAYOUT),
            oDialogModel = new sap.ui.model.json.JSONModel(JSON.parse(JSON.stringify(oState))),
            sTitle = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "957"),
            sHelp = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "198"),
            sClose = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "056"),
            bHelpVisible = oAPP.common.checkWLOList("C", "UHAK901435") === true,
            sMsg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "958"),
            sShow = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "959"),
            sHide = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "960");

        function fnOpenHelpDocument(){

            /**
                * @since   2026-06-26 17:04:08
                * @version v3.6.4-4
                * @author  PES
                * @description
                * 도움말 버튼 선택 시 먼저 busy를 표시한 뒤, 도움말 문서 호출 대상이 아닌 경우 busy를 해제하고 종료한다.
                */
            oAPP.fn.setBindLayoutCustomizingDialogBusy(true);
            oAPP.fn.setBusy(true, {ISBROAD:true});

            if(oAPP.common.checkWLOList("C", "UHAK901435") !== true){
                oAPP.fn.setBindLayoutCustomizingDialogBusy(false);
                oAPP.fn.setBusy(false, {ISBROAD:true});
                return;
            }

            parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("U4A_HELP_DOC_OPEN", 
                {opstion:{startMenuId:"000281"}});

        }


        function fnGetStatusText(bVisible){

            return bVisible === true ? sShow : sHide;

        }


        function fnGetStatusState(bVisible){

            return bVisible === true ? "Success" : "None";

        }


        function fnMakeAreaItem(oInfo){

            var oSwitch = new sap.m.Switch({
                state: `{/${oInfo.PATH}}`,
                change: function(oEvent){

                    var bState = oEvent.getParameter("state");

                    if(oInfo.PATH === "ADDIT"){

                        if(bState !== true){
                            return;
                        }

                        if(oDialogModel.getProperty("/MODEL") === true || oDialogModel.getProperty("/DESIGN") === true){
                            return;
                        }

                        oDialogModel.setProperty("/MODEL", true);
                        oDialogModel.refresh(true);
                        return;

                    }

                    if(bState !== false || oDialogModel.getProperty("/ADDIT") !== true){
                        return;
                    }

                    if(oInfo.PATH === "MODEL" && oDialogModel.getProperty("/DESIGN") !== true){
                        oDialogModel.setProperty("/DESIGN", true);
                    }

                    if(oInfo.PATH === "DESIGN" && oDialogModel.getProperty("/MODEL") !== true){
                        oDialogModel.setProperty("/MODEL", true);
                    }

                    oDialogModel.refresh(true);

                }
            }).addStyleClass("u4aWsLayoutOptionSwitch");

            return new sap.m.CustomListItem({
                content: [
                    new sap.m.HBox({
                        width: "100%",
                        alignItems: "Center",
                        items: [
                            new sap.ui.core.Icon({
                                src: oInfo.ICON,
                                decorative: true
                            }).addStyleClass("u4aWsLayoutOptionIcon"),
                            new sap.m.VBox({
                                layoutData: new sap.m.FlexItemData({
                                    growFactor: 1
                                }),
                                items: [
                                    new sap.m.HBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.m.Title({
                                                text: oInfo.TITLE,
                                                level: "H5"
                                            }),
                                            new sap.m.ObjectStatus({
                                                text: {
                                                    path: `/${oInfo.PATH}`,
                                                    formatter: fnGetStatusText
                                                },
                                                state: {
                                                    path: `/${oInfo.PATH}`,
                                                    formatter: fnGetStatusState
                                                }
                                            }).addStyleClass("u4aWsLayoutOptionStatus")
                                        ]
                                    }).addStyleClass("u4aWsLayoutOptionTitle"),
                                    new sap.m.Text({
                                        text: oInfo.DESC,
                                        wrapping: true
                                    }).addStyleClass("u4aWsLayoutOptionDesc")
                                ]
                            }).addStyleClass("u4aWsLayoutOptionText"),
                            oSwitch
                        ]
                    }).addStyleClass("u4aWsLayoutOption")
                ]
            });

        }


        var aLayoutOption = [
            {
                PATH : "MODEL",
                TITLE: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "193"),
                DESC : oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "961"),
                ICON : "sap-icon://table-view"
            },
            {
                PATH : "DESIGN",
                TITLE: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "962"),
                DESC : oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "963"),
                ICON : "sap-icon://tree"
            },
            {
                PATH : "ADDIT",
                TITLE: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "964"),
                DESC : oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "965"),
                ICON : "sap-icon://form"
            }
        ];

        var oDialog = new sap.m.Dialog({
            draggable: true,
            resizable: true,
            contentWidth: "460px",
            customHeader: new sap.m.Toolbar({
                content: [
                    new sap.m.Title({
                        text: sTitle,
                        tooltip: sTitle
                    }).addStyleClass("sapUiTinyMarginBegin"),
                    new sap.m.ToolbarSpacer(),
                    new sap.m.Button({
                        icon: "sap-icon://question-mark",
                        tooltip: sHelp,
                        type: "Transparent",
                        visible: bHelpVisible,
                        enabled: bHelpVisible,
                        press: fnOpenHelpDocument
                    }),
                    new sap.m.Button({
                        icon: "sap-icon://decline",
                        tooltip: sClose,
                        type: "Reject",
                        press: function(){
                            oDialog.close();
                        }
                    })
                ]
            }),
            content: [
                new sap.m.VBox({
                    width: "100%",
                    items: [
                        new sap.m.List({
                            showSeparators: "Inner",
                            items: aLayoutOption.map(fnMakeAreaItem)
                        }).addStyleClass("u4aWsLayoutCustomizingList"),
                        new sap.m.MessageStrip({
                            type: "Information",
                            showIcon: true,
                            text: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "966")
                        }).addStyleClass("u4aWsLayoutCustomizingNotice")
                    ]
                }).addStyleClass("u4aWsLayoutCustomizingBox")
            ],
            buttons: [
                new sap.m.Button({
                    text: oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "232"),
                    type: "Emphasized",
                    press: function(){

                        var oNewState = oDialogModel.getData();

                        if(getBindLayoutActiveCount(oNewState) === 0){
                            sap.m.MessageToast.show(sMsg, {duration: 2000, at:"center center", my:"center center"});
                            return;
                        }

                        oAPP.attr.oBindLayoutState = normalizeBindLayoutState(oNewState);
                        oAPP.fn.applyBindLayoutCustomizing(true);
                        oDialog.close();

                    }
                }),
                new sap.m.Button({
                    text: sClose,
                    press: function(){
                        oDialog.close();
                    }
                })
            ],
            afterClose: function(){
                if(oAPP.attr.oBindLayoutCustomizingDialog === oDialog){
                    delete oAPP.attr.oBindLayoutCustomizingDialog;
                }

                oDialog.destroy();
            }
        }).addStyleClass("sapUiSizeCompact");

        oAPP.attr.oBindLayoutCustomizingDialog = oDialog;

        oDialog.setModel(oDialogModel);
        oDialog.open();

    };


    oAPP.fn.fnSetModelProperty = function (sModelPath, oModelData, bIsRefresh) {

        var oCoreModel = sap.ui.getCore().getModel();
        oCoreModel.setProperty(sModelPath, oModelData);

        if (bIsRefresh) {
            oCoreModel.refresh(true);
        }

    }; // end of oAPP.common.fnSetModelProperty

    /************************************************************************
     * 모델 데이터 get
     * **********************************************************************
     * @param {String} sModelPath  
     * - Model Path 명
     * 예) /WS10/APPDATA
     ************************************************************************/
    oAPP.fn.fnGetModelProperty = function (sModelPath) {

        return sap.ui.getCore().getModel().getProperty(sModelPath);

    }; // end of oAPP.fn.fnGetModelProperty

    /************************************************************************
     * ws의 설정 정보를 구한다.
     ************************************************************************/
    oAPP.fn.getSettingsInfo = function () {

        // // Browser Window option
        // var sSettingsJsonPath = PATHINFO.WSSETTINGS,

        //     // JSON 파일 형식의 Setting 정보를 읽는다..
        //     oSettings = require(sSettingsJsonPath);
        // if (!oSettings) {
        //     return;
        // }

        // return oSettings;

        return oAPP.WSUTIL.getWsSettingsInfo();

    }; // end of oAPP.fn.getSettingsInfo

    // /************************************************************************
    //  * UI5 BootStrap 
    //  ************************************************************************/
    oAPP.fn.fnLoadBootStrapSetting = async function () {

        var oSettings = oAPP.fn.getSettingsInfo(),
            oSetting_UI5 = oSettings.UI5,
            oBootStrap = oSetting_UI5.bootstrap,
            oUserInfo = oAPP.attr.oUserInfo,            
            oThemeInfo = oAPP.fn.getThemeInfo(),            
            sLangu = oUserInfo.LANGU;

        isolateNodeGlobalsForUi5Bootstrap();

        var oScript = document.createElement("script");
        oScript.id = "sap-ui-bootstrap";

        // 공통 속성 적용
        for (const key in oBootStrap) {
            oScript.setAttribute(key, oBootStrap[key]);
        }

        // 로그인 Language 적용
        oScript.setAttribute("data-sap-ui-theme", oThemeInfo.THEME);
        oScript.setAttribute("data-sap-ui-language", sLangu);
        oScript.setAttribute("data-sap-ui-libs", "sap.m, sap.tnt, sap.ui.table, sap.ui.layout");
        oScript.setAttribute("src", oSetting_UI5.resourceUrl); 

        document.head.appendChild(oScript);

    }; // end of fnLoadBootStrapSetting


    /************************************************************************
     * 초기 모델 바인딩
     ************************************************************************/
    oAPP.fn.fnInitModelBinding = function () {

        // var oFind2Data = oAPP.fn.fnGetFindData2();

        // var oModelData = {
        //     SELKEY: C_FIND_MENU1_ID,
        //     MENULIST: oAPP.fn.fnGetFindMenuList(), // find의 메뉴 리스트       
        //     FIND1TABLE: oAPP.fn.fnGetFindData1(),
        //     FIND2LEFT: oFind2Data.LEFT,
        //     FIND2RIGHT: oFind2Data.RIGHT,
        //     FIND3TABLE: oAPP.fn.fnGetFindData3(),
        //     FIND4TABLE: oAPP.fn.fnGetFindData4(),
        // };

        // var oJsonModel = new sap.ui.model.json.JSONModel();
        // oJsonModel.setData({
        //     FIND: oModelData
        // });

        // sap.ui.getCore().setModel(oJsonModel);

    }; // end of oAPP.fn.fnInitModelBinding



    /*************************************************************
     * @function - 화면 busy 처리.
     *************************************************************/
    function lf_setAppBusy(bBusy){

        if(typeof oAPP?.ui?.APP?.setBusy !== "function"){
            return;
        }

        oAPP.ui.APP.setBusy(bBusy);

    }


    oAPP.fn.setBusy = function(bBusy, sOption){

        //BUSY ON/OFF 정보 광역화.
        oAPP.oMain.attr.isBusy = bBusy;

        var _ISBROAD = sOption?.ISBROAD || undefined;

        switch (bBusy) {
            case true:
                //busy on.
                sap.ui.getCore().lock();

                lf_setAppBusy(true);

                //윈도우 닫기버튼 비활성화 처리.
                lf_setCurrentWindowClosable(false);

                //다른 팝업의 BUSY ON 요청 처리.
                //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                if(typeof _ISBROAD === "undefined"){
                    lf_postBusyToChild({PRCCD:"BUSY_ON"});
                }
                
                break;
        
            case false:
                //busy off.
                lf_setAppBusy(false);

                //윈도우 닫기버튼 활성화 처리.
                lf_setCurrentWindowClosable(true);

                sap.ui.getCore().unlock();

                //다른 팝업의 BUSY OFF 요청 처리.
                //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                if(typeof _ISBROAD === "undefined"){
                    lf_postBusyToChild({PRCCD:"BUSY_OFF"});
                }

                break;
        }

    };  //화면 busy 처리.



    /*************************************************************
     * @function - 바인딩 팝업 busy 처리 및 WS_20의 BUSY 요청 처리.
     *************************************************************/
    oAPP.fn.setBusyWS20Interaction = function(bBusy, sOption){

        //BUSY ON/OFF 정보 광역화.
        oAPP.oMain.attr.isBusy = bBusy;

        switch (bBusy) {
            case true:
                //busy on.
                sap.ui.getCore().lock();

                lf_setAppBusy(true);

                //윈도우 닫기버튼 비활성화 처리.
                lf_setCurrentWindowClosable(false);


                //WS20의 BUSY 요청 처리 정보가 존재하는경우.
                if(typeof sOption !== "undefined"){

                    var _sOption = {};

                    _sOption.PRCCD = "BUSY_ON";
                    _sOption.TITLE = sOption.TITLE || "";
                    _sOption.DESC  = sOption.DESC  || "";
                    _sOption.TYPE  = "DIALOG";

                    //WS 3.0 DESIGN 영역에 BUSY ON 요청 처리.
                    lf_postBusyToChild(_sOption);
                }
                
                break;
        
            case false:
                //busy off.
                lf_setAppBusy(false);

                //윈도우 닫기버튼 활성화 처리.
                lf_setCurrentWindowClosable(true);

                sap.ui.getCore().unlock();
                
                //WS20의 BUSY 요청 처리 정보가 존재하는경우.
                if(typeof sOption !== "undefined"){

                    var _sOption = {};

                    _sOption.PRCCD = "BUSY_OFF";

                    //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
                    lf_postBusyToChild(_sOption);

                }

                break;
        }



    };


    function lf_finishInitialBusy(){

        try {
            oAPP.fn.setBusy(false);
        } catch (error) {

            try {
                oAPP.oMain.attr.isBusy = false;
            } catch (e) {}

            try {
                lf_setAppBusy(false);
            } catch (e) {}

            try {
                sap.ui.getCore().unlock();
            } catch (e) {}

            try {
                lf_postBusyToChild({PRCCD:"BUSY_OFF"});
            } catch (e) {}

        }

        lf_setCurrentWindowClosable(true);

    }


    /*************************************************************
     * @function - UI화면 갱신 이후 이벤트 처리.
     *************************************************************/
    oAPP.fn.UIUpdated = async function(){

        oAPP.fn.setBusy(true);

        //20240730 PES
        //UIUpdated 이벤트가 ui5 상위 버전에서 더이상 동작하지 않기에
        //onAfterRendering으로 대체 처리를 위한 주석 처리.
        // //UI화면 갱신 이후 이벤트 제거 처리.
		// sap.ui.getCore().detachEvent("UIUpdated", oAPP.fn.UIUpdated);

        jQuery.sap.require("sap.m.MessageBox");

        //최초 실행 HTML 로딩바 종료.
        oAPP.setBusy('');

        //바인딩 팝업 Broadcast Channel 생성.
        parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("CHANNEL-CREATE");

        //split 영역 초기화 처리.
        oAPP.fn.resetSplitArea();


        setTimeout(async () => {

            try {

                //path 정보 구성.
                getPathInfo();


                //추가속성 table layout 설정.
                oAPP.fn.setAdditLayout('');


                //바인딩 모드 변경.
                await oAPP.fn.changeBindingMode(oAPP.attr.BIND_MODE);


                //서버에서 바인딩 정보 얻기.
                await oAPP.fn.getBindFieldInfo();

                oAPP.fn.applyBindLayoutCustomizing(false);

                
                // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
                // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

            } catch (error) {
                console.error(error);
            } finally {
                lf_finishInitialBusy();
            }

        }, 0);

    };  //UI화면 갱신 이후 이벤트 처리.



    /*************************************************************
     * @function - //바인딩 팝업 화면 layout 변경.
     *************************************************************/
    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 모드 전환 시 저장된 화면 커스터마이징 상태를 먼저 확인하여
    *  DESIGN TREE 영역과 바인딩 추가 속성 영역의 visible 상태를 반영한다.
    *  비활성 영역은 기존 UI aggregation 정리 과정에서 오류가 발생하지 않도록 content를 비우되,
    *  rendering 완료 대기 대상에서는 제외하여 popup 재호출 시 불필요한 wait로 busy가 유지되지 않게 한다.
    *  실제 데이터와 controller 초기화 흐름은 유지하고 화면 표시 여부만 layout 단계에서 분리 처리한다.
    */
    oAPP.fn.changeDesignLayout = function(bindMode){

        return new Promise(async (res)=>{

            var oLayoutState = getCurrentBindLayoutState();

            setBindLayoutPageVisible(oLayoutState);

            let _aPromise = [];

            // //left splitter
            // _aPromise.push(uiUpdateComplate(oAPP.ui.oSptCenter));

            //right page 
            if(oLayoutState.ADDIT === true){
                _aPromise.push(uiUpdateComplate(oAPP.ui.oPageRight));
            }


            //추가속성정보 페이지 content 초기화.
            oAPP.ui.oPageAdit.removeAllAggregation("content", true);

            //좌측 splitter에 추가속성 정보 페이지 제거.
            // oAPP.ui.oSptCenter.removeAggregation("contentAreas", oAPP.ui.oPageAdit, true);
            oAPP.ui.oSptCenter.removeAllAggregation("contentAreas", true);


            var _oArea1 = oAPP.ui.oPageCenter.data("area1");

            _oArea1.setVisible(oLayoutState.DESIGN === true);
            _oArea1.removeAllAggregation("content", true);

            var _oArea2 = oAPP.ui.oPageCenter.data("area2");
            
            _oArea2.setVisible(oLayoutState.ADDIT === true);
            _oArea2.removeAllAggregation("content", true);

            if(oAPP.ui.oPageAdit){
                setDesignAdditInfoVisible(oLayoutState);
            }


            //우측 페이지 content 초기화.
            oAPP.ui.oPageRight.removeAllAggregation("content", true);


            // //좌측 splitter 갱신.
            // oAPP.ui.oSptCenter.invalidate();

            //우측 page 갱신.
            oAPP.ui.oPageRight.invalidate();


            //화면 제거를 기다림.
            await Promise.all(_aPromise);

            _aPromise = [];

            // //left splitter
            // _aPromise.push(uiUpdateComplate(oAPP.ui.oSptCenter));

            //right page 
            if(oLayoutState.ADDIT === true){
                _aPromise.push(uiUpdateComplate(oAPP.ui.oPageRight));
            }


            
            let _sArea = {};


            //화면 변환 구분자에 따른 UI구성.
            switch (bindMode) {
                
                case CS_BIND_MODE.DEFAULT: //기존 바인딩 화면.
                    
                    //우측 페이지.
                    _sArea.area1 = oAPP.ui.oPageRight;

                            
                    oAPP.attr.oModel.oData.resize = false;
                    oAPP.attr.oModel.oData.width  = "100%";

                    break;

                case CS_BIND_MODE.BULK:  //바인딩 일괄 적용 화면

                    //가운데 area 영역.
                    _sArea.area1 = oAPP.ui.oPageCenter.data("area1");

                    //우측 area 영역.
                    _sArea.area2  = oAPP.ui.oPageCenter.data("area2");


                    // //추가속성 정의 PAGE를 좌측 SPLITTER에 추가.
                    // oAPP.ui.oSptCenter.addAggregation("contentAreas", oAPP.ui.oPageAdit, true);

                    oAPP.ui.oSptCenter.addAggregation("contentAreas", _sArea.area1, true);
                    oAPP.ui.oSptCenter.addAggregation("contentAreas", oAPP.ui.oPageAdit, true);

                    

                    // //우측 페이지에 design, 추가속성 일괄적용 테이블 추가.
                    // oAPP.ui.oPageRight.addAggregation("content", oAPP.ui.oSptRight, true);
            
                    oAPP.attr.oModel.oData.resize = true;
                    oAPP.attr.oModel.oData.width  = "30%";
                    
                    break;
            
            }
                        
            oAPP.attr.oModel.refresh();


            // //좌측 splitter 갱신.
            // oAPP.ui.oSptCenter.invalidate();

            //우측 page 갱신.
            oAPP.ui.oPageRight.invalidate();

            //화면 구성을 기다림.
            await Promise.all(_aPromise);
            

            return res(_sArea);

        });

    };



    /*************************************************************
     * @function - 메시지 팝업 호출.
     *************************************************************/
    oAPP.fn.showMessagePopoverOppener = async function(oTarget, aMessage){

        return new Promise(async (resolve)=>{

            var _path = oAPP.PATH.join(CS_PATH_INFO.ROOT, 
                "ws30", "ws10_20", "Popups", "bindPopup", "utils", "showMessagePopover.js");
            

            //메시지 팝오버 호출 처리.
            var _oPop =  await import(_path);

            //입력 파라메터 전달 처리.
            await _oPop.default(oTarget, aMessage);

            resolve();
            
        });

    };



    /*************************************************************
     * @function - 바인딩 모드 변경.
     *************************************************************/
    /**
    * @since   2026-06-12 01:36:51
    * @version v3.6.4-3
    * @author  PES
    * @description
    *  바인딩 팝업의 화면 구성 모듈은 기존과 동일하게 import/start 하되,
    *  저장된 커스터마이징 상태에서 비활성화된 영역은 start 옵션으로 rendering wait를 skip 한다.
    *  이를 통해 영역을 숨긴 상태로 팝업을 다시 호출할 때 모든 화면이 먼저 표시된 뒤 재배치되는 현상을 줄이고,
    *  비활성 영역의 UI update 완료를 기다리느라 busy가 해제되지 않는 문제를 방지한다.
    *  controller와 내부 데이터 상태는 생성해 두므로 이후 영역을 다시 활성화해도 기존 처리 흐름을 이어갈 수 있다.
    */
    oAPP.fn.changeBindingMode = async function(bindMode){
        
        // oAPP.fn.setBusy(true);

        var oLayoutState = getCurrentBindLayoutState();

        //추가 속성 정보 초기화.
        oAPP.fn.clearSelectAdditBind();

        oAPP.attr.oModel.refresh();

        //디자인 영역의 레이아웃 변경 처리.
        let _sArea = await oAPP.fn.changeDesignLayout(bindMode);


        switch (bindMode) {
            case CS_BIND_MODE.DEFAULT:
                //일반 바인딩 모드.

                //right page.
                var _oPromise = oLayoutState.ADDIT === true ? uiUpdateComplate(_sArea.area1) : Promise.resolve();

                _sArea.area1.addAggregation("content", oAPP.ui.oAdditTab, true);

                _sArea.area1.invalidate();

                await _oPromise;

                
                break;
        
            case CS_BIND_MODE.BULK:
                //바인딩 일괄적용 모드.

                //module js 얻기.
                var _oContrArea1 = await import(CS_PATH_INFO.DESIGN);

                //design tree start.
                oAPP.attr.oDesign = await _oContrArea1.start(_sArea.area1, getBindLayoutRenderOption(CS_BIND_LAYOUT_AREA.DESIGN));


                //module js 얻기.
                var _oContrArea2 = await import(CS_PATH_INFO.ADDIT);

                //바인딩 추가 속성  start.
                oAPP.attr.oAddit = await _oContrArea2.start(_sArea.area2, oAPP.ui.oAdditTab, getBindLayoutRenderOption(CS_BIND_LAYOUT_AREA.ADDIT));



                //좌측 하단 페이지.
                var _oPromise = oLayoutState.ADDIT === true ? uiUpdateComplate(oAPP.ui.oPageAdit) : Promise.resolve();

                oAPP.ui.oPageAdit.addAggregation("content", oAPP.ui.oAdditTab, true);

                oAPP.ui.oPageAdit.invalidate();

                await _oPromise;

                break;
        }


        oAPP.fn.applyBindLayoutCustomizing(false);

        // oAPP.fn.setBusy(false);


    };


    /*************************************************************
     * @function - 오류 메시지 출력.
     *************************************************************/
    oAPP.fn.showErrorMessage = function(msg){
        sap.m.MessageBox.error(msg);
    };


    //바인딩 팝업 화면 구성.
    oAPP.fn.callBindPopup = async function () {

        //20240730 PES
        //UIUpdated 이벤트가 ui5 상위 버전에서 더이상 동작하지 않기에
        //onAfterRendering으로 대체 처리를 위한 주석 처리.
        // //UI화면 갱신 이후 이벤트 처리.
		// sap.ui.getCore().attachEvent("UIUpdated", oAPP.fn.UIUpdated);

        //최상위 UI.
        var oApp = new sap.m.App({busy:true, busyIndicatorDelay:0});

        //UIUpdated 이벤트 대체 처리.
        var _oDeligate = {onAfterRendering:(oEvent)=>{
            oApp.removeEventDelegate(_oDeligate);

            oAPP.fn.UIUpdated();
        }};

        oApp.addEventDelegate(_oDeligate);
        

        oApp.placeAt("content");
        oApp.addStyleClass("sapUiSizeCompact");

        oAPP.ui.APP = oApp;

        //모델 정보 세팅.
        oAPP.attr.oModel = new sap.ui.model.json.JSONModel();
        oApp.setModel(oAPP.attr.oModel);
        oAPP.attr.oModel.oData.edit_layout_customizing = true;

        /**
        * @since   2026-06-12 01:36:51
        * @version v3.6.4-3
        * @author  PES
        * @description
        *  바인딩 팝업 최초 구성 시 현재 parent window 기준으로 저장된 화면 커스터마이징 상태를 읽어
        *  JSONModel의 BIND_LAYOUT에 반영한다.
        *  각 Page의 visible binding과 Splitter 재배치 로직은 이 값을 기준으로 동작하므로,
        *  popup을 닫았다가 다시 열어도 이전 영역 구성 상태를 유지할 수 있다.
        */
        oAPP.attr.oBindLayoutState = loadBindLayoutState();
        oAPP.attr.oModel.oData.BIND_LAYOUT = JSON.parse(JSON.stringify(oAPP.attr.oBindLayoutState));


        //바인딩 팝업 table 출력 page.
        var oPage = new sap.m.Page({
            enableScrolling:false,
            showHeader: false
        });
        oApp.addPage(oPage);


        //바인딩 tree toolabar 정보.
        var oTool = new sap.m.OverflowToolbar();
        // oPage.setCustomHeader(oTool);

        //169	Expand All
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "169");

        //전체펼침
        var oToolBtn1 = new sap.m.Button({
            // text: l_txt,
            icon: "sap-icon://expand-all",
            // type: "Emphasized",
            busy: "{/busy}",
            tooltip: l_txt,
            busyIndicatorDelay: 1
        });
        oTool.addContent(oToolBtn1);

        //tree 전체펼침 이벤트
        oToolBtn1.attachPress(function () {

            oAPP.ui.oModelFieldTree.expandToLevel(99999);

            // //tree table 컬럼길이 재조정 처리.
            // oAPP.fn.setTreeAutoResizeCol(100);

            // //tree table 컬럼길이 재조정 처리.
            oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);

        });

        //170	Collapse All
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "170");

        //전체접힘
        var oToolBtn2 = new sap.m.Button({
            // text: l_txt,
            icon: "sap-icon://collapse-all",
            // type: "Emphasized",
            busy: "{/busy}",
            tooltip: l_txt,
            busyIndicatorDelay: 1
        });
        oTool.addContent(oToolBtn2);

        //tree 전체접힘 이벤트
        oToolBtn2.attachPress(function () {
            oAPP.ui.oModelFieldTree.collapseAll();

            //tree table 컬럼길이 재조정 처리.
            oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);

        });


        oTool.addContent(new sap.m.ToolbarSeparator());

        //171	Refresh
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "171");

        //갱신버튼
        var oToolBtn3 = new sap.m.Button({
            text: l_txt,
            icon: "sap-icon://refresh",
            type: "Emphasized",
            busy: "{/busy}",
            enabled: "{/edit_refresh}",
            tooltip: l_txt,
            busyIndicatorDelay: 1
        });
        oTool.addContent(oToolBtn3);

        //갱신버튼 이벤트
        oToolBtn3.attachPress(async function () {

            // oAPP.fn.setBusy(true);

            var _sOption = JSON.parse(JSON.stringify(oAPP.types.TY_BUSY_OPTION));

            //229	바인딩 팝업에서 바인딩 모델 정보를 갱신하고 있습니다.
            _sOption.DESC = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "229"); 


            oAPP.fn.setBusyWS20Interaction(true, _sOption);

            //서버에서 바인딩 정보 얻기.
            await oAPP.fn.getBindFieldInfo();

            oAPP.fn.applyBindLayoutCustomizing(false);

            // oAPP.fn.setBusy(false);

            oAPP.fn.setBusyWS20Interaction(false, {});

        });


        oTool.addContent(new sap.m.ToolbarSpacer());


        //161	컬럼최적화
        var _txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "161");

        //table autoresize.        
        var oToolBtn4 = new sap.m.OverflowToolbarButton({
            icon: "sap-icon://resize-horizontal",
            text : _txt,        //161	컬럼최적화
            tooltip: _txt,      //161	컬럼최적화
            busyIndicatorDelay: 1,
            press: function(){
                // //tree table 컬럼길이 재조정 처리.
                oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);
            }
        });
        oTool.addContent(oToolBtn4);


        //168	분할 영역 초기화
        var _txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "168");

        var oToolBtn5 = new sap.m.OverflowToolbarButton({
            icon: "sap-icon://screen-split-three",
            text : _txt,        //168	분할 영역 초기화
            tooltip: _txt,      //168	분할 영역 초기화
            busyIndicatorDelay: 1,
            press: function(){
                //각 영역의 size 재설정.
                oAPP.fn.resetSplitArea();

                //메인 splitter invalidate 처리.
                //(바인딩 팝업의 window를 최소 사이즈로 설정한뒤,
                //area의 resize세로 바를 이동하면 간헐적으로
                //resize 세로바가 사라지는현상을 보완하기 위함)
                oAPP.ui.oSptMain.invalidate();

            }
        });
        oTool.addContent(oToolBtn5);

        /**
        * @since   2026-06-12 01:36:51
        * @version v3.6.4-3
        * @author  PES
        * @description
        *  좌측 바인딩 필드 영역 toolbar에서 바로 화면 커스터마이징 popup을 호출할 수 있도록
        *  공통 버튼을 추가한다.
        *  버튼은 영역 표시 상태만 변경하며, 바인딩 필드 조회/선택/refresh 처리 로직은 기존 흐름을 유지한다.
        */
        oTool.addContent(oAPP.fn.createBindLayoutCustomizingButton());

        //198	Help
        var _txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "198");

        //도움말 팝업 호출.
        var oHelp = new sap.m.OverflowToolbarButton({
            text:_txt,      //198	Help
            tooltip: _txt,  //198	Help
            icon:"sap-icon://question-mark",
            press:oAPP.fn.onHelp
        });

        oTool.addContent(oHelp);


        //메인의 좌, 가운데, 우 분할 Splitter.
        var oSpt1 = new sap.ui.layout.Splitter();
        oPage.addContent(oSpt1);

        oSpt1.attachBrowserEvent("mousedown", oAPP.fn.onMainSplitterResizeStart);
        oSpt1.attachBrowserEvent("touchstart", oAPP.fn.onMainSplitterResizeStart);

        oSpt1.attachResize(oAPP.fn.onMainSplitResize);

        oAPP.ui.oSptMain = oSpt1;


        //좌측 페이지.
        /**
        * @since   2026-06-12 01:36:51
        * @version v3.6.4-3
        * @author  PES
        * @description
        *  좌측 바인딩 필드, 가운데 DESIGN TREE, 우측 바인딩 추가 속성 Page는
        *  BIND_LAYOUT 모델 값을 visible 속성에 바인딩한다.
        *  단순히 DOM을 숨기는 방식이 아니라 Splitter contentAreas 재구성과 함께 사용하여,
        *  비활성 영역이 화면에 빈 공간으로 남지 않고 활성 영역만 자연스럽게 재분배되도록 한다.
        */
        var oPageLeft = new sap.m.Page({
            showHeader:false,
            visible: "{/BIND_LAYOUT/MODEL}",
            layoutData:  new sap.ui.layout.SplitterLayoutData({
                size: "{/width}",
                resizable: "{/resize}",
                minSize: 300
            })
        });
        oAPP.ui.oPageLeft = oPageLeft;
        oSpt1.addContentArea(oPageLeft);


        // //좌측 트리의 상하 분할 Splitter.
        // oAPP.ui.oSptCenter = new sap.ui.layout.Splitter({orientation:"Vertical"});
        // oPageLeft.addContent(oAPP.ui.oSptCenter);


        //추가!!!!!!!!!!!
        //가운데 페이지.
        oAPP.ui.oPageCenter = new sap.m.Page({
            showHeader:false,
            visible: "{/BIND_LAYOUT/DESIGN}",
            layoutData: new sap.ui.layout.SplitterLayoutData({
                size:"{/width_c}",
                minSize:300
            })
        });
        oSpt1.addContentArea(oAPP.ui.oPageCenter);


        //우측 페이지.
        oAPP.ui.oPageRight = new sap.m.Page({
            showHeader:false,
            visible: "{/BIND_LAYOUT/ADDIT}",
            layoutData: new sap.ui.layout.SplitterLayoutData({
                size:"{/width_r}",
                minSize:300
            })
        });
        oSpt1.addContentArea(oAPP.ui.oPageRight);


        //가운데 트리의 상하 분할 Splitter.
        oAPP.ui.oSptCenter = new sap.ui.layout.Splitter({
            orientation:"Vertical",
            layoutData: new sap.ui.layout.SplitterLayoutData({
                // size:"{/width_c}",
                size:"auto",
                minSize:300
            })
        });

        oAPP.ui.oPageCenter.addContent(oAPP.ui.oSptCenter);


        //가운데 트리 영역.
        var oPageArea1 = new sap.m.Page({
            showHeader: false,
            visible: "{/BIND_LAYOUT/DESIGN}",
            layoutData: new sap.ui.layout.SplitterLayoutData({
                // size:"60%"
                minSize:300,
                size:"{/height}",
                resizable: "{/resize_v}"
            })
        });
        // oAPP.ui.oSptRight.addContentArea(oPageArea1);
        oAPP.ui.oSptCenter.addContentArea(oPageArea1);
        
        
        oAPP.ui.oPageCenter.data("area1", oPageArea1);


        oAPP.ui.oPageCenter.data("area2", oAPP.ui.oPageRight);


        // //좌측 트리의 상하 분할 Splitter.
        // oAPP.ui.oSptCenter = new sap.ui.layout.Splitter({orientation:"Vertical"});
        // oPageArea1.addContent(oAPP.ui.oSptCenter);


        //바인딩 필드 TREE PAGE.
        var oPageTree = new sap.m.Page({
            showHeader:false,
            layoutData: new sap.ui.layout.SplitterLayoutData({
                size:"auto"
            })
        });
        // oAPP.ui.oSptCenter.addContentArea(oPageTree);
        oPageLeft.addContent(oPageTree);

        //172	Collapse
        var _txt1 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "172");

        //139   추가속성적용
        var _txt2 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "139");

        //161	컬럼최적화
        var _txt3 = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "161");

        //바인딩 추가속성 정보 페이지.
        var oPageAdit = new sap.m.Page({
            visible: false,
            layoutData: new sap.ui.layout.SplitterLayoutData({
                size:"auto",
                minSize:200
            }),
            customHeader : new sap.m.OverflowToolbar({
                visible:"{/vis_addit}",
                content:[                    
                    new sap.m.Button({
                        text:_txt1,
                        tooltip:_txt1,
                        icon:"sap-icon://connected",
                        type:"Emphasized",
                        press: function(){

                            //추가속성 정보 초기화.
                            oAPP.fn.clearSelectAdditBind();
                            
                            //추가속성 정보 필드 비활성 처리.
                            oAPP.fn.setAdditLayout('');

                        }
                    }),
                    new sap.m.Button({
                        text:_txt2,
                        tooltip:_txt2,
                        icon:"sap-icon://accept",
                        type:"Emphasized",
                        enabled: "{/edit}",
                        press: oAPP.fn.onAdditBind
                    }),
                    new sap.m.ObjectStatus({
                        title:"{/S_SEL_ATTR/OBJID}",
                        text:"{/S_SEL_ATTR/UIATT}"
                    }),

                    new sap.m.ToolbarSpacer(),
                    
                    //161	컬럼최적화
                    //table autoresize.        
                    new sap.m.OverflowToolbarButton({
                        icon: "sap-icon://resize-horizontal",
                        text : _txt3,       //161	컬럼최적화
                        tooltip: _txt3,     //161	컬럼최적화
                        busyIndicatorDelay: 1,
                        press: function(){
                            // //tree table 컬럼길이 재조정 처리.
                            oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oAdditTab);
                        }
                    })

                ]
            })
            
        });
        oAPP.ui.oPageAdit = oPageAdit;
        setBindLayoutPageVisible(oAPP.attr.oBindLayoutState);

        // //!!!!!!!!!
        // oAPP.ui.oSptCenter.addContentArea(oAPP.ui.oPageAdit);


        //173	Binds to 'attributes' or 'aggregations' when dragged and dropped.
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "173");

        //바인딩 tree 정보.
        oAPP.ui.oModelFieldTree = new sap.ui.table.TreeTable({
            selectionMode: "Single",
            selectionBehavior: "RowOnly",
            visibleRowCountMode: "Auto",
            width : "100%",
            rowHeight:35,
            // title:new sap.m.Label({text:l_txt, tooltip:l_txt}),            
            rowSelectionChange: oAPP.fn.onSelTabRow,
            extension:[
                oTool
            ]
        });
        // oPageLeft.addContent(oAPP.ui.oModelFieldTree);
        oPageTree.addContent(oAPP.ui.oModelFieldTree);

        oAPP.ui.oModelFieldTree.addEventDelegate({onmousedown:oAPP.fn.onTreeMouseDown});

        
        oAPP.ui.oModelFieldTree.attachFilter(function () {
            //tee에서 필터 처리시 전체 펼침 처리.
            this.expandToLevel(99999);
        });

        var l_edit = false;

        if(oAPP.attr.oAppInfo.IS_EDIT === "X"){
            l_edit = true;
        }

        //drag UI 생성.
        var oDrag = new sap.ui.core.dnd.DragInfo({enabled:l_edit,
            sourceAggregation: "rows",
            //drag start 이벤트
            dragStart: oAPP.fn.setDragStart,

            //drag 종료 이벤트.
            dragEnd: oAPP.fn.onBindFieldDragEnd,

        });
        oAPP.ui.oModelFieldTree.addDragDropConfig(oDrag);




        //174	Object Name
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "174");

        //바인딩 필드 정보 컬럼.
        var oTreeCol1 = new sap.ui.table.Column({
            filterProperty: "NTEXT",
            autoResizable: true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{NTEXT}",
                wrapping: false,
                tooltip: "{NTEXT}"
            })
        });
        oAPP.ui.oModelFieldTree.addColumn(oTreeCol1);

        //175	Type
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "175");

        //바인딩 필드 타입 컬럼.
        var oTreeCol2 = new sap.ui.table.Column({
            filterProperty: "TYPE",
            autoResizable: true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            })
        });
        oAPP.ui.oModelFieldTree.addColumn(oTreeCol2);

        var oCol2Hbox1 = new sap.m.HBox({
            alignItems: "Center",
            renderType: "Bare"
        });
        oTreeCol2.setTemplate(oCol2Hbox1);

        var oHbox1Icon1 = new sap.ui.core.Icon({
            src: "{stat_src}",
            color: "{stat_color}"
        });
        oHbox1Icon1.addStyleClass("sapUiTinyMarginEnd");
        oCol2Hbox1.addItem(oHbox1Icon1);

        var oHbox1Txt1 = new sap.m.Text({
            text: "{TYPE}",
            wrapping: false,
            tooltip: "{TYPE}"
        });
        oCol2Hbox1.addItem(oHbox1Txt1);

        //176	Description
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "176");

        //필드 description 컬럼.
        var oTreeCol3 = new sap.ui.table.Column({
            filterProperty: "DESCR",
            autoResizable: true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{DESCR}",
                wrapping: false,
                tooltip: "{DESCR}"
            })
        });
        oAPP.ui.oModelFieldTree.addColumn(oTreeCol3);


        // //테스트 바인딩 가능 여부 필드.
        // var oTreeCol4 = new sap.ui.table.Column({
        //     label: new sap.m.Label({
        //         text: "enable",
        //         design: "Bold"
        //     }),
        //     template: new sap.m.Text({
        //         text: "{enable}"
        //     })
        // });
        // oAPP.ui.oModelFieldTree.addColumn(oTreeCol4);


        //바인딩 TREE 모델 바인딩 처리.
        oAPP.ui.oModelFieldTree.bindAggregation("rows", {
            path: "/zTREE",
            template: new sap.ui.table.Row(),
            parameters: {
                arrayNames: ["zTREE"]
            }
        });


        //바인딩 추가속성 정보 table.
        var oTab = new sap.ui.table.Table({
            selectionMode: "None",
            selectionBehavior: "RowOnly",
            visibleRowCountMode: "Auto",
            width: "100%",
            minAutoRowCount:3,
            // visible: "{/resize}",
            visible:"{/vis_addit}",
            rowHeight:30,            
            layoutData: new sap.ui.layout.SplitterLayoutData()
        });
        oAPP.ui.oPageRight.addContent(oTab);

        var _oUtil = await import("./utils/setStyleClassUiTable.js");

        //tree table의 style class 처리.
        _oUtil.setStyleClassUiTable(oTab, "_style");

       
        //디자인 영역 하단의 추가속성 정보 table인경우.
        //(가운데 하단의 추가속성 정보 테이블)
        oTab.data("TAB_NAME", "DESIGN_ADDIT");


        oAPP.ui.oAdditTab = oTab;

        //177	Property
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "177");

        //추가바인딩 속성의 Property 컬럼.
        var oTabCol1 = new sap.ui.table.Column({
            width:"40%",
            autoResizable:true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{prop}"
            })
        });
        oTab.addColumn(oTabCol1);
        
        //178	Value
        var l_txt = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "178");

        //추가바인딩 속성의 value 컬럼.
        var oTabCol2 = new sap.ui.table.Column({
            width:"60%",
            autoResizable:true,
            label: new sap.m.Label({
                text: l_txt,
                tooltip: l_txt,
                design: "Bold"
            }),
            template: new sap.m.Text({
                text: "{val}"
            })
        });
        oTab.addColumn(oTabCol2);

        var oTabCol2HBox1 = new sap.m.HBox({
            justifyContent: "Center",
            renderType: "Bare",
            direction: "Column"
        });
        oTabCol2.setTemplate(oTabCol2HBox1);

        //추가속성정보 TEXT.
        var oTabCol2Txt1 = new sap.m.Text({
            text: "{val}",
            visible: "{txt_vis}"
        });
        oTabCol2HBox1.addItem(oTabCol2Txt1);

        //추가속성정보 입력 필드.
        var oTabCol2Inp1 = new sap.m.Input({
            value: "{val}",
            visible: "{inp_vis}",
            editable: "{edit}",
            maxLength: "{maxlen}",
            valueState: "{stat}",
            valueStateText: "{statTxt}",
            enabled: "{/edit}",
            showClearIcon : true,
            change: oAPP.fn.onChangeInput,
            liveChange: oAPP.fn.onLiveChangeInput
        });
        oTabCol2HBox1.addItem(oTabCol2Inp1);


        //추가속성정보 DDLB 필드.
        var oTabCol2Sel1 = new sap.m.Select({
            selectedKey: "{val}",
            visible: "{sel_vis}",
            editable: "{edit}",
            valueState: "{stat}",
            valueStateText: "{statTxt}",
            enabled: "{/edit}"
        });
        oTabCol2HBox1.addItem(oTabCol2Sel1);

        //바인딩 추가속성 정보 DDLB 선택 이벤트.
        oTabCol2Sel1.attachChange(function (oEvent) {

            var _oUi = oEvent.oSource;

            //바인딩 추가속성 정보 DDLB 선택 이벤트.
            oAPP.fn.setAddtBindInfoDDLB(_oUi);

            // //바인딩 추가속성값 설정.
            // oAPP.fn.setMPROP();

        });

        //DDLB ITEM 바인딩 처리.
        oTabCol2Sel1.bindAggregation("items", {
            path: "T_DDLB",
            template: new sap.ui.core.Item({
                key: "{KEY}",
                text: "{TEXT}"
            }),
            templateShareable: true
        });

        //추가속성 정보 바인딩 처리.
        oTab.bindAggregation("rows", {
            path: "/T_MPROP",
            templateShareable: true,
            template: new sap.ui.table.Row()
        });


        // //table Drag 설정.
        // oAPP.fn.setTreeDrag();


        // //서버에서 바인딩 정보 얻기.
        // oAPP.fn.getBindFieldInfo();



    };  //바인딩 팝업 화면 구성.


    function isMainSplitterBarTarget(oTarget){

        if(!oTarget || typeof oTarget.closest !== "function"){
            return false;
        }

        var oBar = oTarget.closest(".sapUiLoSplitterBar, .sapUiLoSplitterOverlayBar");

        if(!oBar){
            return false;
        }

        var oMainSplitterDom = oAPP.ui.oSptMain?.getDomRef?.();

        if(oMainSplitterDom && oMainSplitterDom.contains(oBar) !== true){
            return false;
        }

        return true;

    }


    function scheduleMainSplitterResizeEnd(){

        clearTimeout(oAPP.attr.iMainSplitterResizeEndTimer);

        oAPP.attr.iMainSplitterResizeEndTimer = setTimeout(function(){
            oAPP.attr.bMainSplitterResizeByUser = false;
        }, 150);

    }


    oAPP.fn.onMainSplitterResizeStart = function(oEvent){

        if(isMainSplitterBarTarget(oEvent?.target) !== true){
            return;
        }

        oAPP.attr.bMainSplitterResizeByUser = true;

        clearTimeout(oAPP.attr.iMainSplitterResizeEndTimer);

        window.addEventListener("mouseup", scheduleMainSplitterResizeEnd, {once:true, capture:true});
        window.addEventListener("touchend", scheduleMainSplitterResizeEnd, {once:true, capture:true});
        window.addEventListener("touchcancel", scheduleMainSplitterResizeEnd, {once:true, capture:true});
        window.addEventListener("blur", scheduleMainSplitterResizeEnd, {once:true, capture:true});

    };



    /*************************************************************
     * @function - splitter resize시 area size 재조정 처리.(px -> %)
     *************************************************************/
    oAPP.oMain.fn.resizeSplitter = function(oEvent){

        if(oAPP.attr.bMainSplitterResizeByUser !== true){
            return;
        }

        var _oUi = oEvent.oSource || undefined;
        
        if(typeof _oUi === "undefined"){
            return;
        }
        
        //size 정보 얻기.
        var _aSize = oEvent?.mParameters?.newSizes || undefined;
                
        //size 정보가 없다면 exit.
        if(typeof _aSize === "undefined"){
            return;
        }
        
        if(Array.isArray(_aSize) !== true){
            return;
        }
        
        if(_aSize.length === 0){
            return;
        }
        
        
        //splitter dom 정보 얻기.    
        var _oDom = _oUi.getDomRef();
            
        //화면에 그려지지 않은경우 exit.
        if(typeof _oDom === "undefined" || _oDom === null){
            return;
        }
        
        
        //splitter의 하위 area 정보 얻기.
        var _aArea = _oUi.getContentAreas();
        
        //area가 없다면 exit
        if(typeof _aArea === "undefined"){
            return;
        }
        
        if(Array.isArray(_aArea) !== true){
            return;
        }
        
        if(_aArea.length === 0){
            return;
        }


        //bar에 해당하는 size 얻기.
        //(resizable 프로퍼티 변경시 bar 존재여부 확인해.)
        var _barSize = (_aSize.length - 1) * 16;
        
        var _totalSize = 0;
        
        
        //splitter의 수직, 수평 표현 값에 따른 분기.
        switch (_oUi.getOrientation()) {
            case 'Vertical':
                //수직으로 표현하는경우 height값으로 계산.
                _totalSize = _oDom.scrollHeight - _barSize;
                break;
                
            case 'Horizontal':
                //수팽으로 표현하는경우 width 값으로 계산.
                _totalSize = _oDom.scrollWidth - _barSize;
                break;
            
            default:
                return;
        }
        
        
        //전체 크기가 0px 인경우 exit.
        if(_totalSize === 0){
            return;
        }
        

        //마지막 위치 index.
        var _last = _aArea.length - 1;
        
        //area의 size를 %로 계산 처리.
        for (var i = 0, l = _aArea.length; i < l; i++) {
            
            var _oArea = _aArea[i];
            
            var _oLayout = _oArea.getLayoutData();
            
            if(typeof _oLayout === "undefined" || _oLayout === null){
                continue;
            }

            //마지막 area인경우 size auto 처리.
            if(i === _last){
                //area의 size를 auto로 지정.
                //(마지막 size를 %로 지정할 경우 window창을 최소화 한뒤
                //각 area를 minSize로 줄이고 windown를 전체창으로 변경하면
                //resize 이벤트가 동작하지 않아 size 계산을 하지 못함.
                //마지막 area의 size를 auto로 설정하면 window전체창시 resize이벤트가 호출됨)
                _oLayout.setSize(`auto`);
                continue;
            }
            
            var _size = _aSize[i];
            
            _size = (_size / _totalSize) * 100;
            
            //소숫점 2자리까지 반올림.
            _size = _size.toFixed(2);
                        
            _oLayout.setSize(`${_size}%`);
            
            
        }

    };


    /*************************************************************
     * @event - 메인 splitter resize 이벤트.
     *************************************************************/
    oAPP.fn.onMainSplitResize = function(oEvent){

        //splitter의 영역 다시 그리는 로직 주석 처리 -START.
        //(잘못된 로직임)
        // oAPP.ui.oSptMain.detachResize(oAPP.fn.onMainSplitResize);

        // var _oLayout = oAPP.ui.oPageRight.getLayoutData();

        // if(typeof _oLayout === "undefined" || _oLayout === null){
        //     oAPP.ui.oSptMain.attachResize(oAPP.fn.onMainSplitResize);
        //     return;
        // }


        // _oLayout.setSize("auto");
        // oAPP.ui.oSptMain.attachResize(oAPP.fn.onMainSplitResize);
        //splitter의 영역 다시 그리는 로직 주석 처리 -END.

        //splitter resize시 area size 재조정 처리.(px -> %)
        oAPP.oMain.fn.resizeSplitter(oEvent);


    };


    /*************************************************************
     * @event - 모델 tree mouse down 이벤트.
     *************************************************************/
    oAPP.fn.onTreeMouseDown = function(){

        //text 선택 정보 얻기.
        var _oSel = window.getSelection();

        if(typeof _oSel === "undefined" || _oSel === null){
            return;
        }

        //text 선택 해제.
        //(text가 선택된 상태에서 라인 선택 이벤트가 동작 하지 않음)
        _oSel.removeAllRanges();

    };


    /*************************************************************
     * @event - help 버튼 선택 이벤트.
     *************************************************************/
    oAPP.fn.onHelp = async function(oEvent){

        /**
         * @since   2026-04-29 15:26:27
         * @version v3.6.2-0
         * @author  pes
         * @description
         * 도움말 HTML 정보를 U4A HELP DOCUMENT로 통합하게 됨에 따라
         * v3.6.0_00004 버전 이후 부터 U4A HELP DOCUMENT 팝업을 
         * 호출 하도록 로직 개선.
         */
        if(oAPP.common.checkWLOList("C", "UHAK901369") === true){
            
            oAPP.fn.setBusy(true, {ISBROAD:true});

            //바인딩 팝업 -> DESIGN 영역에 broadCast로 U4A HELP DOCUMENT 호출 요청.
            parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("U4A_HELP_DOC_OPEN", 
                {opstion:{startMenuId:"000276"}});
            return;
        }
        
        //200	Model Fields Area
        await parent.require("./utils/callTooltipsPopup.js")("modelFieldArea", "200");
        
    };



    /*************************************************************
     * @function - 바인딩 추가 속성 정보 입력값 점검.
     *************************************************************/
    oAPP.fn.chkAdditBindData = function(oTab){

        return new Promise(async (resolve)=>{

            var _sRes = {RETCD:"", RTMSG:"", T_RTMSG:[]};

            var _oModel = oTab.getModel();

            //function 호출 테이블명에 따른 로직분기.
            switch (oTab.data("TAB_NAME")) {                 
                case "MAIN_ADDIT":
                    //메인의 추가속성 정보 table인경우
                    //(우측 추가속성 정보 테이블)

                    var _ACTCD01 = oAPP.attr.CS_MSG_ACTCD.ACT03;
                    var _ACTCD02 = oAPP.attr.CS_MSG_ACTCD.ACT05;
                    
                    break;
                
                case "DESIGN_ADDIT":
                    //디자인 영역 하단의 추가속성 정보 table인경우.
                    //(가운데 하단의 추가속성 정보 테이블)
                    var _ACTCD01 = oAPP.attr.CS_MSG_ACTCD.ACT06;
                    var _ACTCD02 = oAPP.attr.CS_MSG_ACTCD.ACT07;

                    break;

                default:
                    return resolve(_sRes);
            }

            if(typeof _oModel?.oData?.T_MPROP === "undefined" || _oModel?.oData?.T_MPROP.length === 0){

                _sRes.RETCD = "E";

                //133	바인딩 추가 속성 정보가 존재하지 않습니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "133");

                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD01;
                _sBindError.TYPE     = "Error";
                
                //133	바인딩 추가 속성 정보가 존재하지 않습니다.
                _sBindError.TITLE    = _msg;

                //131	관리자에게 문의 하십시오.
                _sBindError.DESC     = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "131");

                _sBindError.LK_VIS   = false;

                _sRes.T_RTMSG.push(_sBindError);

                return resolve(_sRes);
            }


            var _aMPROP = _oModel?.oData?.T_MPROP;

            
            //추가속성 정보 입력건 존재 여부 확인.
            if(_aMPROP.findIndex( item => item.val !== "") === -1){

                _sRes.RETCD = "E";
                
                //134	바인딩 추가 속성 정보 입력건이 존재하지 않습니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "134");

                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD01;
                _sBindError.TYPE     = "Error";

                //134	바인딩 추가 속성 정보 입력건이 존재하지 않습니다.
                _sBindError.TITLE    = _msg;
                _sBindError.DESC     = _sBindError.TITLE;

                _sBindError.LK_VIS   = false;

                _sRes.T_RTMSG.push(_sBindError);

                _oModel.refresh();

                return resolve(_sRes);

            }


            //Bind type 라인 얻기.
            var ls_p04 = _aMPROP.find( a=> a.ITMCD === "P04");
            
            if(typeof ls_p04 === "undefined"){
                _sRes.RETCD = "E";

                //135	바인딩 추가 속성 정보 Bind type이 존재하지 않습니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "135");

                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD01;
                _sBindError.TYPE     = "Error";

                //135	바인딩 추가 속성 정보 Bind type이 존재하지 않습니다.
                _sBindError.TITLE    = _msg;

                //131	관리자에게 문의 하십시오.
                _sBindError.DESC     = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "131");

                _sBindError.LK_VIS   = false;

                _sRes.T_RTMSG.push(_sBindError);

                _oModel.refresh();

                return resolve(_sRes);
            }


            //Reference Field name 라인 얻기.
            var ls_p05 = _aMPROP.find( a=> a.ITMCD === "P05");

            if(typeof ls_p05 === "undefined"){
                _sRes.RETCD = "E";

                //136	바인딩 추가 속성 정보 Reference Field name이 존재하지 않습니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "136");

                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD01;
                _sBindError.TYPE     = "Error";

                //136	바인딩 추가 속성 정보 Reference Field name이 존재하지 않습니다.
                _sBindError.TITLE    = _msg;
                
                //131	관리자에게 문의 하십시오.
                _sBindError.DESC     = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "131");

                _sBindError.LK_VIS   = false;

                _sRes.T_RTMSG.push(_sBindError);

                _oModel.refresh();

                return resolve(_sRes);
            }


            //Bind type이 구성된경우 Reference Field name이 존재하지 않는다면.
            if(ls_p04.val !== "" && ls_p05.val === ""){

                //137	바인딩 유형을 선택한 경우 참조 필드 이름은 필수입니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "137");

                _sRes.RETCD = "E";
                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD02;
                _sBindError.LINE_KEY = ls_p05.ITMCD;
                _sBindError.TYPE     = "Error";

                //137	바인딩 유형을 선택한 경우 참조 필드 이름은 필수입니다.
                _sBindError.TITLE    = _msg;
                
                //105	Reference Field를 입력 하십시오.
                _sBindError.DESC     = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "105");

                _sRes.T_RTMSG.push(_sBindError);

            }


            //Conversion Routine 라인 얻기.
            var ls_p06 = _aMPROP.find( a=> a.ITMCD === "P06");

            if(typeof ls_p06 === "undefined"){
                
                _sRes.RETCD = "E";
                //138	바인딩 추가 속성 정보 Conversion Routine이 존재하지 않습니다.
                var _msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "138");

                _sRes.RTMSG = _msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
            
                _sBindError.ACTCD    = _ACTCD01;
                _sBindError.TYPE     = "Error";

                //138	바인딩 추가 속성 정보 Conversion Routine이 존재하지 않습니다.
                _sBindError.TITLE    = _msg;
                
                //131	관리자에게 문의 하십시오.
                _sBindError.DESC     = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "131");

                _sBindError.LK_VIS   = false;

                _sRes.T_RTMSG.push(_sBindError);

                _oModel.refresh();

                return resolve(_sRes);
            }


            //conversion routine 입력건 오류가 존재하는경우.
            if(ls_p06._error === true){

                _sRes.RETCD = "E";
                _sRes.RTMSG = ls_p06._error_msg;

                var _sBindError = JSON.parse(JSON.stringify(oAPP.types.TY_BIND_ERROR));
        
                _sBindError.ACTCD    = _ACTCD02;
                _sBindError.LINE_KEY = ls_p06.ITMCD;
                _sBindError.TYPE     = "Error";
                _sBindError.TITLE    = ls_p06._error_msg;
                _sBindError.DESC     = ls_p06._error_msg;

                _sRes.T_RTMSG.push(_sBindError);

            }

            _oModel.refresh();

            return resolve(_sRes);

        });

    };


    /*************************************************************
     * @function - UI의 bindingContext에서 데이터 추출.
     *************************************************************/
    oAPP.fn.getUiContextData = function(oUi){

        if(typeof oUi === "undefined" || oUi === null){
            return;
        }

        var _oCtxt = oUi.getBindingContext();

        if(typeof _oCtxt === "undefined" || _oCtxt === null){
            return;
        }

        return _oCtxt.getProperty();

    };


    /*************************************************************
     * @function - conversion 입력라인에 대한 광역 오류 정보 초기화 처리.
     *************************************************************/
    oAPP.fn.clearConvError = function(sAddit){

        //conversion 입력 라인이 아닌경우 exit.
        if(sAddit.ITMCD !== "P06"){
            return;
        }
        
        //오류 표현 초기화.
        sAddit.stat       = null;
        sAddit.statTxt    = "";

        //conversion 라인의 오류 필드 초기화.
        sAddit._error     = false;

        //오류 메시지 초기화.
        sAddit._error_msg = "";
        
        oAPP.attr.oModel.refresh();

    };
    

    /*************************************************************
     * @event - 바인딩 추가속성 정보 입력필드 live change 이벤트.
     *************************************************************/
    oAPP.fn.onLiveChangeInput = function(oEvent){

        var _oUi = oEvent.oSource;

        //UI의 bindingContext에서 데이터 추출.
        var _sAddit = oAPP.fn.getUiContextData(_oUi);
        
        if(typeof _sAddit === "undefined"){
            return;
        }

        //conversion 입력라인에 대한 광역 오류 정보 초기화 처리.
        oAPP.fn.clearConvError(_sAddit);


    };


    /*************************************************************
     * @function - 추가속성 정보 입력필드 변경 이벤트.
     *************************************************************/
    oAPP.fn.onChangeInput = async function(oEvent){

        var _oUi = oEvent.oSource;

        //UI의 bindingContext에서 데이터 추출.
        var _sAddit = oAPP.fn.getUiContextData(_oUi);
        
        if(typeof _sAddit === "undefined"){
            return;
        }

        //추가속성 정보 conversion 입력필드 변경에 대한 처리.
        oAPP.fn.convChangeInput(_sAddit);


    };


    /*************************************************************
     * @function - 추가속성 정보 conversion 입력필드 변경에 대한 처리.
     *************************************************************/
    oAPP.fn.convChangeInput = async function(sAddit){

        oAPP.fn.setBusy(true);
    
        //conversion 입력 라인이 아닌경우 exit.
        if(sAddit.ITMCD !== "P06"){
            oAPP.fn.setBusy(false);
            return;
        }

        //오류 표현 초기화.
        sAddit.stat    = null;
        sAddit.statTxt = "";

        //입력된 값이 존재하지 않는경우.
        if(sAddit.val === ""){

            oAPP.attr.oModel.refresh();

            oAPP.fn.setBusy(false);

            return;
        }
        
        //conversion명 대문자 변환 처리.
        oAPP.fn.setConvNameUpperCase(sAddit);
        

        //conversion 명 점검.
        var _sRes = await oAPP.fn.checkConversion(sAddit.val);

        
        if(_sRes.RETCD === "E"){

            //오류 표현 처리.
            sAddit.stat    = "Error";
            sAddit.statTxt = _sRes.RTMSG;

            //conversion 라인의 오류 flag 처리.
            sAddit._error      = true;
            sAddit._error_msg  = _sRes.RTMSG;

            oAPP.attr.oModel.refresh();

            oAPP.fn.setBusy(false);

            return;
        }

        oAPP.attr.oModel.refresh();

        oAPP.fn.setBusy(false);

    };


    /*************************************************************
     * @function - conversion 명 점검.
     *************************************************************/
    oAPP.fn.checkConversion = function(convName){

        return new Promise(async (resolve)=>{

            var _sRes = {RETCD:"", RTMSG:""};
            
            //conversion명이 입력되지 않은경우.
            if(convName === ""){

                return resolve(_sRes);
            }


            //Conversion Routine명 서버전송 데이터 구성.
            var oFormData = new FormData();
            oFormData.append("CONVEXIT", convName);

            // Conversion Routine 존재여부 확인.
            sendAjax(oAPP.attr.servNm + "/chkConvExit", oFormData, function(param){

                //Conversion Routine 존재여부 오류가 발생한 경우.
                if(param.RETCD === "E"){
    
                    _sRes.RETCD    = param.RETCD;
                    _sRes.RTMSG    = param.RTMSG;

                }
                
                resolve(_sRes);
        
            });

        });

    };


    /*************************************************************
     * @function - 바인딩 추가 속성값 구성.
     *************************************************************/
    oAPP.fn.setAdditBindData = function(aMPROP){

        if(typeof aMPROP === "undefined"){
            return;
        }


        //필드 정보 row 제거(필터명, 필드 path, 필드 타입.)
        var _aMPROP = aMPROP.filter( item => item.isFieldInfo === false );

        //itmcd로 정렬 처리.
        _aMPROP.sort(function(a, b){

            return a.ITMCD.localeCompare(b.ITMCD);

        });

        
        var _aProp = [];

        for (let i = 0, l = _aMPROP.length; i < l; i++) {
            
            var _sMPROP = _aMPROP[i];

            _aProp.push(_sMPROP.val);

        }

        return _aProp.join("|");

    };


    /*************************************************************
     * @function - 모델 tree의 선택된 라인 정보 얻기.
     *************************************************************/
    oAPP.fn.getSelectedModelLine = function(){

        //모델 필드 라인 선택 위치 얻기.
        var _indx = oAPP.ui.oModelFieldTree.getSelectedIndex();

        //선택된 라인이 존재하지 않는경우 exit.
        if(_indx ===  -1){
            return;
        }

        var _oCtxt = oAPP.ui.oModelFieldTree.getContextByIndex(_indx);

        if(typeof _oCtxt === "undefined" || _oCtxt === null){
            return;
        }

        return _oCtxt.getProperty();

    };
    

    //바인딩 추가 속성값 설정.
    oAPP.fn.setMPROP = function(){
        
        var l_indx = oAPP.ui.oModelFieldTree.getSelectedIndex();
        if(l_indx === -1){return;}

        var l_ctxt = oAPP.ui.oModelFieldTree.getContextByIndex(l_indx);
        if (!l_ctxt) {
            return;
        }

        var ls_tree = l_ctxt.getProperty();

        if(ls_tree.KIND !== "E"){return;}

        //Bind type 라인 얻기.
        var ls_p04 = oAPP.attr.oModel.oData.T_MPROP.find( a=> a.ITMCD === "P04");
        if(!ls_p04){
            oAPP.attr.oModel.setProperty("MPROP", "", l_ctxt);
            return;
        }

        //Reference Field name 라인 얻기.
        var ls_p05 = oAPP.attr.oModel.oData.T_MPROP.find( a=> a.ITMCD === "P05");
        if(!ls_p05){
            oAPP.attr.oModel.setProperty("MPROP", "", l_ctxt);
            return;
        }

        //Bind type이 구성된경우 Reference Field name이 존재하지 않는다면.
        if(ls_p04.val !== "" && ls_p05.val === ""){
            //추가속성정보 제거 처리.
            oAPP.attr.oModel.setProperty("MPROP", "", l_ctxt);
            return;
        }

        //추가속성 세팅된 값을 취합.
        for(var i=3, l=oAPP.attr.oModel.oData.T_MPROP.length, l_array = []; i<l; i++){
            //바인딩 추가 속성 정보 수집.
            l_array.push(oAPP.attr.oModel.oData.T_MPROP[i].val);
    
        }

        //return 파라메터에 바인딩 추가 속성 정보 매핑.
        ls_tree.MPROP = l_array.join("|");

        //tree의 해당 라인에 바인딩 추가속성값 매핑.
        oAPP.attr.oModel.setProperty("MPROP", ls_tree.MPROP, l_ctxt);


    };  //바인딩 추가 속성값 설정.


    //conversion명 대문자 변환 처리.
    oAPP.fn.setConvNameUpperCase = function(sline) {

        //Conversion Routine에서 값을 입력한 경우 하위 로직 수행.
        if (sline.ITMCD !== "P06") {
            return;
        }

        //Conversion 명 대문자 변환 처리.
        sline.val = sline.val.toUpperCase();

    }; //conversion명 대문자 변환 처리.




    //STRING_TABLE 여부 확인.
    oAPP.fn.chkStringTable = function(is_tree) {

        //TABLE이 아닌경우 EXIT.
        if (is_tree.KIND !== "T") {
            return;
        }

        //부모가 ROOT인경우 EXIT.(바인딩 가능한건은 STRU-FIELD or TABLE-FIELD만 가능)
        if(is_tree.PARENT === "Attribute"){return;}

        //현재 라인이 STRING_TABLE인경우 STRING_TABLE FLAG RETURN.
        if (is_tree.EXP_TYP === "STR_TAB") {
            return true;
        }

    }; //STRING_TABLE 여부 확인.




    //range table 여부 확인.
    oAPP.fn.chkRangeTable = function(is_tree) {

        //TABLE이 아닌경우 EXIT.
        if (is_tree.KIND !== "T") {
            return;
        }

        //현재 table의 하위 필드 정보 검색.
        var lt_filter = oAPP.attr.oModel.oData.TREE.filter(a => a.PARENT === is_tree.CHILD);

        //child가 4건이 아닌경우 exit.
        if (lt_filter.length !== 4) {
            return;
        }

        //SIGN, OPTION, LOW, HIGH 필드가 아닌 필드 검색.
        var l_indx = lt_filter.findIndex(a => a.NTEXT !== "SIGN" && a.NTEXT !== "OPTION" &&
            a.NTEXT !== "LOW" && a.NTEXT !== "HIGH");

        //SIGN, OPTION, LOW, HIGH 이외의 필드가 존재하지 않는경우.
        if (l_indx === -1) {

            //RANGE TABLE 처리.
            is_tree.EXP_TYP = "RANGE_TAB";

            //range table flag return
            return true;
        }

    }; //range table 여부 확인.



    //라인선택 이벤트
    oAPP.fn.onSelTabRow = function(oEvent) {

        //모델 tree의 라인 선택정보 얻기.
        var _indx = oAPP.ui.oModelFieldTree.getSelectedIndex();

        //라인 선택이 해제 된경우.
        if(_indx === -1){
            
            //이벤트 발생 index 얻기.
            _indx = oEvent.getParameter("rowIndex");

            //라인선택 이벤트 제거.
            //(라인 선택 이벤트 동작을 회피하기 위함)
            oAPP.ui.oModelFieldTree.detachRowSelectionChange(oAPP.fn.onSelTabRow);

            //라인 재 선택 처리.
            oAPP.ui.oModelFieldTree.setSelectedIndex(_indx);

            //다시 이벤트 등록 처리.
            oAPP.ui.oModelFieldTree.attachRowSelectionChange(oAPP.fn.onSelTabRow);

            return;
        }


        //참조 필드 DDLB 리스트 구성
        oAPP.attr.oAddit.fn.setRefFieldList();


        // var l_bind = this.getBinding("rows");

        // var l_ctxt = l_bind.getContextByIndex(l_indx);
        // if (!l_ctxt) {
        //     return;
        // }

        // var ls_tree = l_ctxt.getProperty();

        
        // //추가속성 table layout 설정.
        // oAPP.fn.setAdditLayout(ls_tree.KIND);


        // var l_path = l_ctxt.getPath();

        // l_path = l_path.substr(0, l_path.lastIndexOf("/"));

        // //추가속성 정보 출력 처리.
        // oAPP.fn.setAdditBindInfo(ls_tree, ls_tree.MPROP, oAPP.attr.oModel.getProperty(l_path));

    }; //라인선택 이벤트



    //바인딩 추가속성정보 메시지 초기화.
    oAPP.fn.resetMPROPMsg = function () {

        if (typeof oAPP.attr.oModel.oData.T_MPROP === "undefined" ||
            oAPP.attr.oModel.oData.T_MPROP.length === 0) {
            return;
        }


        for (var i = 0, l = oAPP.attr.oModel.oData.T_MPROP.length; i < l; i++) {
            oAPP.attr.oModel.oData.T_MPROP[i].stat = "None";
            oAPP.attr.oModel.oData.T_MPROP[i].statTxt = "";
            oAPP.attr.oModel.oData.T_MPROP[i]._style = "";
        }

    }; //바인딩 추가속성정보 메시지 초기화.


    oAPP.fn.clearMessagePopoverErrorState = function(){

        try {
            if(typeof oAPP.attr?.oDesign?.fn?.resetErrorField === "function"){
                oAPP.attr.oDesign.fn.resetErrorField();
            }

            if(typeof oAPP.attr?.oDesign?.oModel?.refresh === "function"){
                oAPP.attr.oDesign.oModel.refresh();
            }
        } catch (error) {}

        try {
            if(typeof oAPP.attr?.oAddit?.fn?.resetErrorField === "function"){
                oAPP.attr.oAddit.fn.resetErrorField();
            }

            if(typeof oAPP.attr?.oAddit?.oModel?.refresh === "function"){
                oAPP.attr.oAddit.oModel.refresh(true);
            }
        } catch (error) {}

        try {
            oAPP.fn.resetMPROPMsg();

            if(typeof oAPP.attr?.oModel?.refresh === "function"){
                oAPP.attr.oModel.refresh(true);
            }
        } catch (error) {}

    };


    //tree -> tab으로 변환.
    oAPP.fn.parseTree2Tab = function(aTree, childName) {
        var a = [];
        var t = function(e) {
            $.each(e, function(e, o) {
                o[childName] && (t(o[childName]),
                delete o[childName]);
                a.push(o);
            })
        };

        t(JSON.parse(JSON.stringify(aTree)));
        return a;
  
    };  //tree -> tab으로 변환.


    //tree 구성 function.
    oAPP.fn.setTreeJson = function (oModel, path, child, parent, treePath) {

        //"stru/table" 형식인경우 stru부분 발췌.
        var l_ppath = path.substr(0, path.lastIndexOf("/"));

        //원본 table 정보 얻기.
        var lt_org = oModel.getProperty("/" + path);

        //stru에 해당하는 정보 얻기.
        var tm2 = oModel.getProperty("/" + l_ppath);

        //원본 table 정보가 존재하지 않는경우.
        if (!lt_org || lt_org.length === 0) {
            //stru에 treePath이름으로 table 필드 생성.
            tm2[treePath] = [];

            //모델 갱신 처리 후 exit.
            oModel.refresh();
            return;

        }

        //table 복사 처리.
        var lt_copy = JSON.parse(JSON.stringify(lt_org));

        for (var e, h, u, a = [], c = {}, o = 0, f = lt_copy.length; f > o; o++) {

            e = lt_copy[o];

            h = e[child];

            u = e[parent] || 0;

            c[h] = c[h] || [];

            e[treePath] = c[h];

            0 != u ? (c[u] = c[u] || [], c[u].push(e)) : a.push(e);
        }

        tm2[treePath] = a;

    }; //tree 구성 function.




    //tree table 컬럼길이 재조정 처리.
    oAPP.fn.setTreeAutoResizeCol = function (iTime) {

        setTimeout(() => {
            var lt_col = oAPP.ui.oModelFieldTree.getColumns();

            if (lt_col.length === 0) {
                return;
            }

            for (var i = lt_col.length - 1; i >= 0; i--) {
                oAPP.ui.oModelFieldTree.autoResizeColumn(i);
            }

        }, iTime);


    };  //tree table 컬럼길이 재조정 처리.




    //tree drag 처리.
    oAPP.fn.setTreeDrag = function(){

        function lf_setDraggable(){

            //row UI 정보 얻기.
            var lt_row = oAPP.ui.oModelFieldTree.getRows();

            if(lt_row.length == 0){return;}

            for(var i = 0, l = lt_row.length; i < l; i++){
                
                //row의 DOM 얻기.
                var l_dom = lt_row[i].getDomRef();
                if(!l_dom){continue;}

                //dom의 default drag false 처리.
                l_dom.draggable = false;

                var l_ctxt = lt_row[i].getBindingContext();
                if(!l_ctxt){continue;}

                var l_binfo = l_ctxt.getProperty();

                l_dom.draggable = l_binfo.enable;


            }


        }

        var l_meta = sap.ui.table.Row.getMetadata();
        l_meta.dnd.draggable = true;

        var l_bind = oAPP.ui.oModelFieldTree.getBinding();

        if(!l_bind){return;}

        l_bind.attachChange(lf_setDraggable);

        oAPP.ui.oModelFieldTree.attachToggleOpenState(lf_setDraggable);
        oAPP.ui.oModelFieldTree.attachFirstVisibleRowChanged(lf_setDraggable);



    };  //tree drag 처리.


    function sendAjax(sPath, oFormData, fn_success) {

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () { // 요청에 대한 콜백
            if (xhr.readyState === xhr.DONE) { // 요청이 완료되면
                if (xhr.status === 200 || xhr.status === 201) {

                    fn_success(JSON.parse(xhr.response));

                }
            }
        };

        xhr.withCredentials = true;

        // FormData가 없으면 GET으로 전송
        xhr.open("post", sPath, true);

        xhr.send(oFormData);


    } // end of sendAjax


    /************************************************************************
     * -- Start of Program
     ************************************************************************/

    // // UI5 Boot Strap을 로드 하고 attachInit 한다.
    oAPP.fn.fnLoadBootStrapSetting();

    function startBindPopup(){

        if(startBindPopup._started === true){
            return;
        }

        if(typeof window.sap === "undefined" || !window.sap.ui || typeof window.sap.ui.getCore !== "function"){
            setTimeout(startBindPopup, 50);
            return;
        }

        startBindPopup._started = true;

        // //바인딩 팝업, WS3.0 디자인화면
        // //각 화면에서 순간적으로 이벤트를 발생하면서 생기는 문제를 처리하기위해
        // //팝업화면이 hidden 처리될때 confirm popup과 같이 다음 액션을
        // //기다리는 팝업류 종료 처리.
        function _onVisibilitychange(){
            
            document.activeElement.blur();

            if(typeof window?.sap?.m?.InstanceManager?.getOpenDialogs !== "function"){
                return;
            }

            //현재 호출된 dialog 정보 얻기.
            var _aDialog = sap.m.InstanceManager.getOpenDialogs();

            //호출된 dialog가 없다면 exit.
            if(typeof _aDialog === "undefined" || _aDialog?.length === 0){
                return;
            }

            //confirm 팝업 종료처리됨 flag.
            var _destroied = false;

            for (let i = 0, l = _aDialog.length; i < l; i++) {
                
                var _oDialog = _aDialog[i];

                //id 정보 얻는 function이 존재하지 않는경우 exit.
                if(typeof _oDialog.getId !== "function"){
                    continue;
                }

                //로직에 의해 호출된 confirm popup인경우.
                if(_oDialog.getId() === oAPP.attr.C_CONFIRM_POPUP){

                    _destroied = true;

                    //해당 dialog destroy 처리.
                    _oDialog.destroy();
                }
               
            }

            //confirm 팝업 종료처리된경우 WS20에 BUSY OFF 요청 처리.
            if(_destroied === true){
                // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
                // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

                //다른 팝업의 BUSY OFF 요청 처리.
                //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_OFF"});

            }

            // oAPP.ui.APP.focus();
            if(oAPP.attr?.oBindLayoutState?.DESIGN !== false && oAPP.attr?.oDesign?.ui?.TREE){
                oAPP.attr.oDesign.ui.TREE.focus();
            }
        }

        
        //20240818 PES -START.
        //visibilitychange 이벤트를 대체처리함.
        var _oWin = oAPP.REMOTE.getCurrentWindow();

        _oWin.on('hide', _onVisibilitychange);

        _oWin.on('minimize', _onVisibilitychange);
        //20240818 PES -END.

        oAPP.fn.setResizeSensitivePopoverWindowSize();

        var _fnCloseResizeSensitivePopovers = oAPP.fn.closeResizeSensitivePopovers;

        _oWin.on("will-resize", _fnCloseResizeSensitivePopovers);
        _oWin.on("resize", _fnCloseResizeSensitivePopovers);

        window.addEventListener("pagehide", function(){

            try {
                _oWin.off("will-resize", _fnCloseResizeSensitivePopovers);
                _oWin.off("resize", _fnCloseResizeSensitivePopovers);
            } catch (error) {}

        }, {once: true});

        // //20240726 PES.
        // //바인딩 팝업, WS3.0 디자인화면
        // //각 화면에서 순간적으로 이벤트를 발생하면서 생기는 문제를 처리하기위해
        // //팝업화면이 hidden 처리될때 confirm popup과 같이 다음 액션을
        // //기다리는 팝업류 종료 처리.
        // document.addEventListener('visibilitychange', function() {

        //     //화면이 숨겨지지 않은경우 exit.
        //     if (document.hidden !== true){
        //         return;
        //     }

        //     document.activeElement.blur();

        //     if(typeof window?.sap?.m?.InstanceManager?.getOpenDialogs !== "function"){
        //         return;
        //     }

        //     //현재 호출된 dialog 정보 얻기.
        //     var _aDialog = sap.m.InstanceManager.getOpenDialogs();

        //     //호출된 dialog가 없다면 exit.
        //     if(typeof _aDialog === "undefined" || _aDialog?.length === 0){
        //         return;
        //     }

        //     //confirm 팝업 종료처리됨 flag.
        //     var _destroied = false;

        //     for (let i = 0, l = _aDialog.length; i < l; i++) {
                
        //         var _oDialog = _aDialog[i];

        //         //id 정보 얻는 function이 존재하지 않는경우 exit.
        //         if(typeof _oDialog.getId !== "function"){
        //             continue;
        //         }

        //         //로직에 의해 호출된 confirm popup인경우.
        //         if(_oDialog.getId() === oAPP.attr.C_CONFIRM_POPUP){

        //             _destroied = true;

        //             //해당 dialog destroy 처리.
        //             _oDialog.destroy();
        //         }
               
        //     }

        //     //confirm 팝업 종료처리된경우 WS20에 BUSY OFF 요청 처리.
        //     if(_destroied === true){
        //         //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
        //         parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");
        //     }

        //     // oAPP.ui.APP.focus();
        //     oAPP.attr.oDesign.ui.TREE.focus();

        // });


        sap.ui.getCore().attachInit(function () {

            restoreNodeGlobalsAfterUi5Bootstrap();

            // IPC Event 등록
            _attachIpcEvents();

            //UI TABLE 라이브러리 예외처리.
            excepUiTableLibrary();

            oAPP.fn.setBindPopupWithinArea();

            //바인딩 팝업 화면 구성.
            oAPP.fn.callBindPopup();

            // oAPP.fn.fnInitModelBinding();

            // oAPP.fn.fnInitRendering();

            // oAPP.setBusy('');

        });

        _oWin.on('close', function(){


            oAPP.fn.setBusyWS20Interaction(false, {});

            //20240827 PES -START.
            //팝업 BUSY ON 처리시 모든 창은(메인포함) 닫지 못하는 내용이 추가됨에 따라 
            //현재 팝업이 닫을 수 있는 경우라면 다른 영역에 busy off 처리 요청 로직으로 
            //변경됨에 따라 기존 로직 주석 처리함.
            //(닫기 버튼을 누를 수 있는 상황 - busy 처리가 안되었거나, 
            //confirm 팝업으로 나를 제외한 다른 창(메인포함)은 busy 처리 됐을때)
            // if(typeof oAPP?.ui?.APP?.getBusy === "undefined"){
            //     return;
            // }

            
            // if(oAPP.ui.APP.getBusy() === true){
            //     //취소를 선택한 경우 다른 팝업의 BUSY OFF 요청 처리.
            //     oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_OFF"});
            //     return;
            // }


            // if(typeof window?.sap?.m?.InstanceManager?.getOpenDialogs !== "function"){
            //     return;
            // }
            

            // //현재 호출된 dialog 정보 얻기.
            // var _aDialog = sap.m.InstanceManager.getOpenDialogs();

            // //호출된 dialog가 없다면 exit.
            // if(typeof _aDialog === "undefined" || _aDialog?.length === 0){
            //     return;
            // }

            // //confirm 팝업 호출건이 존재하지 않는경우 exit.
            // if(_aDialog.findIndex( item => typeof item.getId === "function" && 
            //     item.getId() === oAPP.attr.C_CONFIRM_POPUP) !== -1){
                
            //     //취소를 선택한 경우 다른 팝업의 BUSY OFF 요청 처리.
            //     oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_OFF"});

            // }
            //20240827 PES -END.

        });

        oAPP.oMain.broadToChild = new BroadcastChannel(`broadcast-to-child-window_${oAPP.attr.browserkey}`);

        oAPP.oMain.broadToChild.onmessage = function(oEvent){

            var _PRCCD = oEvent?.data?.PRCCD || undefined;

            if(typeof _PRCCD === "undefined"){
                return;
            }


            //프로세스에 따른 로직분기.
            switch (_PRCCD) {
                case "BUSY_ON":
                    //BUSY ON을 요청받은경우.
                    oAPP.fn.setBusy(true, {ISBROAD:true});
                    break;

                case "BUSY_OFF":
                    //BUSY OFF를 요청 받은 경우.
                    oAPP.fn.setBusy(false, {ISBROAD:true});
                    break;

                default:
                    break;
            }

        };

    }


    if(document.readyState === "loading"){
        window.addEventListener("load", startBindPopup, {once:true});
    }else{
        startBindPopup();
    }


    //window 종료처리전 이벤트.
    window.onbeforeunload = function(){

        //현재 busy가 on 상태인경우 종료 하지 않음.
        if(oAPP.oMain.attr.isBusy === true){
            return false;
        }

    };


    //추가속성 table layout 설정.
    oAPP.fn.setAdditLayout = function(KIND, oOption){

        var bShowAdditTable = false,
            bKeepSplitterSize = oOption?.KEEP_SPLITTER_SIZE === true;

        switch (oAPP.attr.BIND_MODE) {
            case CS_BIND_MODE.DEFAULT:
                //일반 바인딩 모드.

                //DEFAULT 화면 크기 설정.
                if(bKeepSplitterSize !== true){
                    oAPP.attr.oModel.oData.width = "100%";
                    oAPP.attr.oModel.oData.height = "100%";
                    oAPP.attr.oModel.oData.resize = false;
                }

                //선택한 라인의 데이터 유형이 일반 필드면 추가속성 정보 활성화.
                if(KIND === "E"){
                    if(bKeepSplitterSize !== true){
                        oAPP.attr.oModel.oData.width = "65%";
                        oAPP.attr.oModel.oData.resize = true;
                    }

                    bShowAdditTable = true;
                }
                
                break;
            
            case CS_BIND_MODE.BULK:
                //바인딩 일괄적용 모드.

                //DEFAULT 화면 크기 설정.
                if(bKeepSplitterSize !== true){
                    oAPP.attr.oModel.oData.width = "30%";
                    oAPP.attr.oModel.oData.resize = true;

                    oAPP.attr.oModel.oData.height = "100%";
                    oAPP.attr.oModel.oData.resize_v = false;
                }


                oAPP.attr.oModel.oData.vis_addit = false;

                //선택한 라인의 데이터 유형이 일반 필드면 추가속성 정보 활성화.
                if(KIND === "E"){
                    if(bKeepSplitterSize !== true){
                        oAPP.attr.oModel.oData.resize_v = true;
                        oAPP.attr.oModel.oData.height = "60%";
                    }

                    oAPP.attr.oModel.oData.vis_addit = true;
                    bShowAdditTable = true;
                }

                break;

            default:
                break;
        }

        oAPP.attr.oModel.refresh();
        setDesignAdditInfoVisible(getCurrentBindLayoutState());

        if(bShowAdditTable === true && oAPP.ui.oAdditTab){
            setTimeout(function(){
                oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oAdditTab);
            }, 0);
        }

    };  //추가속성 table layout 설정.




    //추가속성 정보 출력 처리.
    oAPP.fn.setAdditBindInfo = function(is_tree, MPROP, it_parent) {

        oAPP.attr.oModel.oData.T_MPROP = [];

        //바인딩 팝업 호출 ATTR의 타입이 프로퍼티가 아닌경우 EXIT.
        if (is_tree.KIND !== "E") {
            oAPP.attr.oModel.refresh();
            return;
        }

        //바인딩 추가속성 정보 공통코드 발췌.
        var lt_ua022 = oAPP.attr.T_9011.filter( item => item.CATCD === "UA022" && item.FLD03 === "X" );

        var lt_refList = [{KEY:"", TEXT:""}];

        //참조필드 DDLB 구성.
        for (var i = 0, l = lt_ua022.length; i < l; i++) {
            var ls_ua022 = lt_ua022[i];
            
            lt_refList.push({
                KEY : ls_ua022.FLD01,
                TEXT: ls_ua022.FLD01
            });
            
        }

        //boolean ddlb 정보.
        var lt_bool = [
            {KEY:"true",  TEXT:"true"},
            {KEY:"false", TEXT:"false"}
        ];


        //바인딩 추가속성 리스트 얻기.
        var lt_ua028 = oAPP.attr.T_9011.filter(a => a.CATCD === "UA028");

        //itmcd로 정렬 처리.
        lt_ua028.sort(function(a, b){

            return a.ITMCD.localeCompare(b.ITMCD);

        });

        var ls_mprop = {},
            lt_split = [];

        var lt_mprop = [];

        // //바인딩 추가 속성 정의건이 존재하는 경우.
        // if (is_tree.MPROP) {
        //     lt_split = is_tree.MPROP.split("|");
        // }

        if(typeof MPROP !== "undefined" && MPROP !== ""){
            lt_split = MPROP.split("|");
        }

        //nozero 불가능 항목.
        var l_nozero = "Cg";

        //number format 가능항목.
        var l_numfmt = "IP";

        for (var i = 0, l = lt_ua028.length; i < l; i++) {

            ls_mprop.ITMCD       = lt_ua028[i].ITMCD;
            ls_mprop.prop        = lt_ua028[i].FLD01;

            ls_mprop.val         = "";
            ls_mprop.stat        = "None";
            ls_mprop.statTxt     = "";
            ls_mprop.isFieldInfo = false;

            ls_mprop.edit        = false;
            ls_mprop.inp_vis     = false;
            ls_mprop.sel_vis     = false;
            ls_mprop.txt_vis     = false;
            ls_mprop._style      = "";

            //조회모드 여부 (예:X) 가 아닌경우 화면 edit 처리.
            if (lt_ua028[i].FLD02 !== "X") {
                ls_mprop.edit = true;
            }

            switch (lt_ua028[i].ITMCD) {

                case "P01": //Field name
                    ls_mprop.val         = is_tree.NTEXT;
                    ls_mprop.txt_vis     = true;
                    ls_mprop.isFieldInfo = true;
                    break;

                case "P02": //Field path
                    ls_mprop.val         = is_tree.CHILD;
                    ls_mprop.txt_vis     = true;
                    ls_mprop.isFieldInfo = true;
                    break;

                case "P03": //type
                    ls_mprop.val         = is_tree.TYPE;
                    ls_mprop.txt_vis     = true;
                    ls_mprop.isFieldInfo = true;
                    break;

                case "P04": //Bind type
                    // if (is_tree.MPROP) {
                    //     ls_mprop.val = lt_split[0];
                    // }

                    if(lt_split.length > 0){
                        ls_mprop.val = lt_split[0];
                    }


                    //추가 속성정보 재수집.
                    lt_mprop.push(ls_mprop.val);

                    ls_mprop.sel_vis = true;

                    //P 타입이 아닌경우 입력 필드 잠금 처리.
                    if (is_tree.TYPE_KIND !== "P") {
                        ls_mprop.edit = false;
                    }

                    ls_mprop.T_DDLB = JSON.parse(JSON.stringify(lt_refList));

                    break;

                case "P05": //Reference Field name
                    // if (is_tree.MPROP) {
                    //     ls_mprop.val = lt_split[1];
                    // }

                    if(lt_split.length > 0){
                        ls_mprop.val = lt_split[1];
                    }

                    //추가 속성정보 재수집.
                    lt_mprop.push(ls_mprop.val);

                    ls_mprop.sel_vis = true;

                    //구조(TAB) 안에 있는 필드 중 CUKY, UNIT 타입이 없으면 잠김.
                    var lt_filt = it_parent.filter(a => a.DATATYPE === "CUKY" || a.DATATYPE === "UNIT");

                    //금액, UNIT 참조필드가 존재하지 않는경우 화면 잠금 처리.

                    ls_mprop.edit = false;

                    if (lt_filt.length !== 0) {

                        ls_mprop.edit = true;

                        ls_mprop.T_DDLB = [{
                            "KEY": "",
                            "TEXT": ""
                        }];

                        for (var j = 0, l2 = lt_filt.length, ls_ddlb = {}; j < l2; j++) {

                            ls_ddlb.KEY = ls_ddlb.TEXT = lt_filt[j].CHILD;
                            ls_mprop.T_DDLB.push(ls_ddlb);
                            ls_ddlb = {};

                        }

                    }

                    if (lt_split.length === 0 || lt_split[0] === "") {
                        ls_mprop.edit = false;
                    }

                    break;

                case "P06": //Conversion Routine

                    // //해당 필드가 갖고 있는 conversion명을 default로 매핑.
                    // ls_mprop.val = is_tree.CONVE;

                    //입력 길이 제한(5자)
                    ls_mprop.maxlen = 5;

                    // if (is_tree.MPROP) {
                    //     ls_mprop.val = lt_split[2];
                    // }

                    if(lt_split.length > 0){
                        ls_mprop.val = lt_split[2];
                    }
                    

                    //Bind type을 구성했다면
                    if(lt_split.length > 0 && lt_split[0] !== ""){

                        //Conversion Routine 선택 불가 처리.
                        ls_mprop.edit = false;

                    }

                    //추가 속성정보 재수집.
                    lt_mprop.push(ls_mprop.val);

                    ls_mprop.inp_vis = true;


                    break;

                case "P07": //Nozero
                    // if (is_tree.MPROP) {
                    //     ls_mprop.val = lt_split[3];
                    // }

                    if(lt_split.length > 0){
                        ls_mprop.val = lt_split[3];
                    }

                    //값이 존재하지 않는경우 default false
                    if (ls_mprop.val === "") {
                        ls_mprop.val = "false";
                    }

                    //추가 속성정보 재수집.
                    lt_mprop.push(ls_mprop.val);

                    ls_mprop.sel_vis = true;

                    //Nozero 가능항목에 속하지 않는 타입인경우 입력필드 잠금 처리.
                    if (l_nozero.indexOf(is_tree.TYPE_KIND) !== -1) {
                        ls_mprop.edit = false;
                    }

                    ls_mprop.T_DDLB = JSON.parse(JSON.stringify(lt_bool));

                    break;

                case "P08": //Is number format?
                    // if (is_tree.MPROP) {
                    //     ls_mprop.val = lt_split[4];
                    // }

                    if(lt_split.length > 0){
                        ls_mprop.val = lt_split[4];
                    }

                    //값이 존재하지 않는경우 default false
                    if (ls_mprop.val === "") {
                        ls_mprop.val = "false";
                    }

                    //추가 속성정보 재수집.
                    lt_mprop.push(ls_mprop.val);

                    ls_mprop.sel_vis = true;

                    //number format 가능항목에 속하지 않는 타입인경우 입력필드 잠금 처리.
                    if (l_numfmt.indexOf(is_tree.TYPE_KIND) === -1) {
                        ls_mprop.edit = false;
                    }

                    ls_mprop.T_DDLB = JSON.parse(JSON.stringify(lt_bool));

                    break;
            }

            oAPP.attr.oModel.oData.T_MPROP.push(ls_mprop);
            ls_mprop = {};

        }


        // //기존 바인딩 팝업일경우만 필드에 추가속성 정보 매핑.
        // if(oAPP.attr.BIND_MODE === CS_BIND_MODE.DEFAULT){
                
        //     //재구성된 바인딩 추가 속성 정보가 존재하는경우 해당 라인에 바인딩 추가 속성정보 재매핑.
        //     if(lt_mprop.length > 0){
        //         is_tree.MPROP = lt_mprop.join("|");
        //     }
            
        // }

        oAPP.attr.oModel.refresh();

    }; //추가속성 정보 출력 처리.



/********************************************************************
 * ******************************************************************
 * ******************************************************************
 *📝 바인딩 추가 기능 관련 로직 -START.
 ********************************************************************
 ********************************************************************
 ********************************************************************/

    //부모 path로부터 파생된 child path 여부 확인.
    oAPP.fn.chkBindPath = function(parent, child){
        //부모 path를 -로 분리.
        if(typeof parent === "undefined" || parent === ""){return;}
        if(typeof child === "undefined"  || child === ""){return;}

        var l_sp1 = parent.split("-");

        //CHILD path를 -로 분리.
        var l_sp2 = child.split("-");

        //부모 path 부분만 남김.
        l_sp2.splice(l_sp1.length);

        //부모 path로부터 파생된 child path인경우.
        if(parent === l_sp2.join("-")){
            //부모 path로부터 파생됨 flag return
            return true;
        }

    };  //부모 path로부터 파생된 child path 여부 확인.

    

    //Aggregation에 N건 모델 바인딩 처리시 모델정보 ui에 매핑 처리.
    oAPP.fn.setAggrBind = function(oUI){

        if(typeof oUI?._T_0015 === "undefined"){
            return;
        }

        if(oUI._T_0015.length === 0){return;}

        //Aggregation에 바인딩처리된 정보 얻기.
        var lt_0015 = oUI._T_0015.filter( a => a.UIATY === "3" && a.ISBND === "X" && a.UIATV !== "" );

        if(lt_0015.length === 0){return;}

        for(var i = 0, l = lt_0015.length; i < l; i++){

            oUI._MODEL[lt_0015[i].UIATT] = lt_0015[i].UIATV;

        }

    };  //Aggregation에 N건 모델 바인딩 처리시 모델정보 ui에 매핑 처리.


    //UI에 바인딩처리된경우 부모 UI에 해당 정보 매핑.
    oAPP.fn.setModelBind = function(oUi){

        //부모 model 바인딩 정보에 해당 UI 매핑 처리 function.
        function lf_getParentAggrModel(UIATV, EMBED_AGGR, parent){

            if(!parent){return;}

            //대상 Aggregation에 N건 바인딩 처리가 안된경우 상위 부모 탐색.
            if(!parent._MODEL[EMBED_AGGR]){

                var l_name = parent._UILIB;

                //부모가 sap.ui.table.Column인경우 sap.ui.table.Table(TreeTable)의
                //row Aggregation에 N건 바인딩 처리됐는지 여부 판단.
                if(l_name === "sap.ui.table.Column"){

                    //ui table(tree table의 columns에 바인딩처리가 안된경우.)
                    if(!parent.__PARENT._MODEL["coloums"]){
                        return lf_getParentAggrModel(UIATV, "rows", parent.__PARENT);
                    }

                }

                if(l_name === "sap.ui.table.RowAction" && !parent._MODEL["items"]){
                    //부모가 sap.ui.table.RowAction 인경우 items에 바인딩 처리가 안됐다면.
                    //그 상위 부모인 table(tree table)의 rows aggregation에 N건 바인딩 처리 됐는지 여부 판단
                    return lf_getParentAggrModel(UIATV, "rows", parent.__PARENT);

                }

                if((l_name === "sap.ui.table.Table" || l_name === "sap.ui.table.TreeTable" ) &&
                    (EMBED_AGGR === "rowActionTemplate" || EMBED_AGGR === "rowSettingsTemplate")){
                
                    //부모가 table, tree table이면서 현재 UI가 rowActionTemplate, rowSettingsTemplate에 존재하는경우.
                    //rows rows aggregation에 N건 바인딩 처리 됐는지 여부 판단.
                    return lf_getParentAggrModel(UIATV, "rows", parent);

                }

                return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
            }

            //대상 Aggregation에 N건 바인딩 Path가 다른경우 상위 부모 탐색.
            if(oAPP.fn.chkBindPath(parent._MODEL[EMBED_AGGR], UIATV) !== true){
                return lf_getParentAggrModel(UIATV, parent._EMBED_AGGR, parent.__PARENT);
            }

            //model 정보 수집된건이 없는경우.
            if(!parent._BIND_AGGR[EMBED_AGGR]){
                //구조 생성.
                parent._BIND_AGGR[EMBED_AGGR] = [];
            }

            //이미 model정보가 수집되어있는경우 exit.
            if(parent._BIND_AGGR[EMBED_AGGR].findIndex( a=> a === oUi) !== -1){
                return true;
            }

            //현재 UI 수집처리.
            parent._BIND_AGGR[EMBED_AGGR].push(oUi);

            return true;

        } //부모 model 바인딩 정보에 해당 UI 매핑 처리 function.

        
        //현재 UI의 property에 바인딩된 정보 얻기.
        var lt_0015 = oUi._T_0015.filter( a => a.ISBND === "X" && a.UIATV !== "" );

        //바인딩된 정보가 존재하지 않는경우 exit.
        if(lt_0015.length === 0){return;}


        //바인딩된 정보를 기준으로 부모를 탐색하며 N건 바인딩 여부 확인.
        for(var i = 0, l = lt_0015.length; i < l; i++){
        
            //N건 바인딩 처리되어 parent에 현재 UI를 추가한 경우 exit.
            if(lf_getParentAggrModel(lt_0015[i].UIATV, oUi._EMBED_AGGR, oUi.__PARENT) === true){
                return;
            }

        }

    };  //UI에 바인딩처리된경우 부모 UI에 해당 정보 매핑.



    //대상 UI로부터 부모를 탐색하며 n건 바인딩 값 얻기.
    oAPP.fn.getParentAggrBind = function(oUI, UIATT){

        if(!oUI){return;}

        if(!oUI._MODEL[UIATT]){

            //sap.ui.table.Column의 template Aggregation에서 부모를 탐색하는경우.
            if(oUI._UILIB === "sap.ui.table.Column" &&
                typeof oUI.__PARENT !== "undefined" &&
                UIATT === "template"){

                //sap.ui.table.Column의 상위 부모가 sap.ui.table.Table이라면.
                if(oUI.__PARENT._UILIB === "sap.ui.table.Table" ||
                    oUI.__PARENT._UILIB === "sap.ui.table.TreeTable"){

                    //상위 부모의 columns에 바인딩 처리안된경우 rows aggregation으로 판단.
                    if(typeof oUI.__PARENT._MODEL["columns"] === "undefined"){
                        //rows에 바인딩 처리됐는지 확인.
                        return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");
                    }

                }

            }

            if(oUI._UILIB === "sap.ui.table.RowAction" || oUI._UILIB === "sap.ui.table.RowSettings"){

                if(oUI.__PARENT._UILIB === "sap.ui.table.Table" ||
                    oUI.__PARENT._UILIB === "sap.ui.table.TreeTable"){

                    //rows에 바인딩 처리됐는지 확인.
                    return oAPP.fn.getParentAggrBind(oUI.__PARENT, "rows");

                }

            }

            return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);
        }

        //모델에 n건 바인딩이 구성된 경우.
        if(oUI._MODEL[UIATT] !== ""){
            return oUI._MODEL[UIATT];
        }

        return oAPP.fn.getParentAggrBind(oUI.__PARENT, oUI._EMBED_AGGR);

    };  //대상 UI로부터 부모를 탐색하며 n건 바인딩 값 얻기.



    //대상 UI로부터 부모를 탐색하며 n건 바인딩한 UI 얻기.
    oAPP.fn.getParentUi = function(oUI, UIATT){

        if(!oUI){return;}

        if(!oUI._MODEL[UIATT]){

            //sap.ui.table.Column의 template Aggregation에서 부모를 탐색하는경우.
            if(oUI._UILIB === "sap.ui.table.Column" &&
                typeof oUI.__PARENT !== "undefined" &&
                UIATT === "template"){

                //sap.ui.table.Column의 상위 부모가 sap.ui.table.Table이라면.
                if(oUI.__PARENT._UILIB === "sap.ui.table.Table" ||
                    oUI.__PARENT._UILIB === "sap.ui.table.TreeTable"){

                    //상위 부모의 columns에 바인딩 처리안된경우 rows aggregation으로 판단.
                    if(typeof oUI.__PARENT._MODEL["columns"] === "undefined"){
                        //rows에 바인딩 처리됐는지 확인.
                        return oAPP.fn.getParentUi(oUI.__PARENT, "rows");
                    }

                }

            }

            if(oUI._UILIB === "sap.ui.table.RowAction" || oUI._UILIB === "sap.ui.table.RowSettings"){

                if(oUI.__PARENT._UILIB === "sap.ui.table.Table" ||
                    oUI.__PARENT._UILIB === "sap.ui.table.TreeTable"){

                    //rows에 바인딩 처리됐는지 확인.
                    return oAPP.fn.getParentUi(oUI.__PARENT, "rows");

                }

            }

            return oAPP.fn.getParentUi(oUI.__PARENT, oUI._EMBED_AGGR);
        }

        //모델에 n건 바인딩이 구성된 경우.
        if(oUI._MODEL[UIATT] !== ""){
            return oUI;
        }

        return oAPP.fn.getParentUi(oUI.__PARENT, oUI._EMBED_AGGR);

    };  //대상 UI로부터 부모를 탐색하며 n건 바인딩한 UI 얻기.



    //대상 UI로부터 자식을 탐색하며 바인딩 가능 여부 점검.
    oAPP.fn.getChildAggrBind = function(OBJID, BINDFIELD){
        
        //입력 OBJECT의 CHILD UI 정보 얻기.
        var _aChild = oAPP.attr.T_0014.filter( item => item.POBID ===  OBJID );

        //CHILD 정보가 없다면 EXIT.
        if(_aChild.length === 0){
            return;
        }

        for (let i = 0; i < _aChild.length; i++) {

            var sChild = _aChild[i];

            //CHILD에 매핑된 모델 바인딩 정보를 확인.
            for (const key in oAPP.attr.prev[sChild.OBJID]._MODEL) {

                var _sModel = oAPP.attr.prev[sChild.OBJID]._MODEL[key];

                //CHILD에 매핑된 모델 바인딩건과 현재 입력한 모델 PATH가 같다면.
                if(_sModel === BINDFIELD){
                    
                    //같은 PATH 정보 바인딩됨 FLAG RETURN.
                    return true;
                }

            }


            //attr 수집건이 존재하는경우.
            if(typeof oAPP.attr.prev[sChild.OBJID]._T_0015 !== "undefined"){

                //바인딩 path로 부터 파생된 정보가 존재하는경우.
                var _found = oAPP.attr.prev[sChild.OBJID]._T_0015.findIndex( item => item.ISBND === "X" &&
                    item.UIATY === "3" &&
                    String(item.UIATV).startsWith(BINDFIELD) === true );

                if(_found !== -1){
                    return true;
                }

            }

            

            //하위를 탐색하며 입력 모델 PATH와 같은 바인딩이 설정 됐는지 확인.
            var _found = oAPP.fn.getChildAggrBind(sChild.OBJID, BINDFIELD);

            if(_found === true){
                return _found;
            }

        }

    };


    /**
     * @since   2025-12-31 03:41:08
     * @version v3.5.7-4
     * @author  PES
     * @description
     * 입력한 UI로부터 하위를 탐색하며 단축키가 등록된 이벤트 존재여부를 확인하는.
     * 로직 추가.
     * (모델 바인딩 처리시 대상 UI의 하위에 단축키가 등록된 UI가 존재하는 경우
     * 모델 바인딩을 수행할 수 없음)
     */
    oAPP.fn.attrGetShortcutEvent = function(OBJID){

        //입력 OBJECT의 CHILD UI 정보 얻기.
        let _aChild = oAPP.attr.T_0014.filter( item => item.POBID ===  OBJID );

        if(_aChild.length === 0){
            return;
        }

        for(let _sChild of _aChild){

            let _found = oAPP.attr.prev[_sChild.OBJID]._T_0015?.findIndex( item => item.UIATY === "2" && Object.keys(item.SHCUT).length > 0 );

            if(_found !== -1){
                return true;
            }

            //하위를 탐색하며 단축키 등록건 존재 여부 확인.
            let _foundChild = oAPP.fn.attrGetShortcutEvent(_sChild.OBJID);

            if(_foundChild === true){
                return _foundChild;
            }

        }

    };


    //aggregation 바인딩 처리 가능여부 점검.
    oAPP.fn.attrChkBindAggrPossible = function(is_attr){

        //파라메터 정보가 잘못됀 경우 오류 flag RETURN.
        if(typeof is_attr?.OBJID === "undefined" || is_attr?.OBJID === ""){
            return true;
        }

        //파라메터 정보가 잘못됀 경우 오류 flag RETURN.
        if(typeof is_attr?.UIATK === "undefined" || is_attr?.UIATK === ""){
            return true;
        }


        //DESIGN TREE에서 입력한 OBJECT ID의 CHILD UI정보 얻기.
        var _aChild = oAPP.attr.oDesign.oModel.oData.TREE_DESIGN.filter( item => 
            item.DATYP === "01" && item.S_14_POBID === is_attr.OBJID );

        //CHILD 정보가 없는경우 exit.
        if(_aChild.length === 0){
            return false;
        }
        
        //현재 바인딩 아이콘을 선택한 AGGREGATION에 추가된 UI정보 얻기.
        var _afilter = _aChild.filter( a => a.S_14_UIATK === is_attr.UIATK);

        //현재 aggregation에 2개 이상의 UI가 추가된경우.
        if(_afilter.length >= 2){
            
            //오류 FLAG RETURN.
            return true;
        }

        return false;


    };  //aggregation 바인딩 처리 가능여부 점검.




    //design tree 정보에서 UI명에 해당하는건 검색.
    oAPP.fn.getDesignTreeData = function(OBJID, is_tree){

        //최초 호출상태인경우.
        if(typeof is_tree === "undefined"){
            //ROOT를 매핑.
            is_tree = oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN[0];
        }

        //현재 TREE가 검색대상건인경우 해당 TREE정보 RETURN.
        if(is_tree.OBJID === OBJID && is_tree.DATYP === "01"){
            return is_tree;
        }

        //child가 존재하지 않는경우 exit.
        if(!is_tree.zTREE_DESIGN || is_tree.zTREE_DESIGN.length === 0){return;}

        //현재 TREE가 검색대상이 아닌경우 CHILD를 탐색하며 OBJID에 해당하는 TREE정보 검색.
        for(var i = 0, l = is_tree.zTREE_DESIGN.length; i < l; i++){
        
            var ls_tree = oAPP.fn.getDesignTreeData(OBJID, is_tree.zTREE_DESIGN[i]);
            
            if(typeof ls_tree  !== "undefined"){
                return ls_tree;
            }

        }

    };  //design tree 정보에서 UI명에 해당하는건 검색.



    //design tree 정보에서 UI명에 해당하는 attr 정보 검색.
    oAPP.fn.getDesignTreeAttrData = function(OBJID, UIATK, is_tree){

        //최초 호출상태인경우.
        if(typeof is_tree === "undefined"){
            //ROOT를 매핑.
            is_tree = oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN[0];
        }

        //현재 TREE가 검색대상건인경우 해당 TREE정보 RETURN.
        if(is_tree.OBJID === OBJID && is_tree.UIATK === UIATK && is_tree.DATYP === "02"){
            return is_tree;
        }

        //child가 존재하지 않는경우 exit.
        if(!is_tree.zTREE_DESIGN || is_tree.zTREE_DESIGN.length === 0){return;}

        //현재 TREE가 검색대상이 아닌경우 CHILD를 탐색하며 OBJID에 해당하는 TREE정보 검색.
        for(var i = 0, l = is_tree.zTREE_DESIGN.length; i < l; i++){
        
            var ls_tree = oAPP.fn.getDesignTreeAttrData(OBJID, UIATK, is_tree.zTREE_DESIGN[i]);
            
            if(typeof ls_tree  !== "undefined"){
                return ls_tree;
            }

        }

    };  //design tree 정보에서 UI명에 해당하는건 검색.


    //sap.ui.core.HTML UI의 content 프로퍼티에서 바인딩, editor 호출전 점검.
    oAPP.fn.attrChkHTMLContent = function(is_attr, bFlag, fnCallback){

        //HTML UI의 content 프로퍼티가 아닌경우 exit.
        if(is_attr.UIATK !== "AT000011858"){return;}

        var l_chk = false, l_msg = "";

        //바인딩 팝업전 호출한 경우.
        if(bFlag === true){

            //UI명 + 프로퍼티명으로 OBJID 구성.
            var l_objid = is_attr.OBJID + is_attr.UIASN;

            //HTML editor 입력건 존재여부 확인.
            l_chk = oAPP.attr.T_CEVT.findIndex( a => a.OBJTY === "HM" && a.OBJID === l_objid) !== -1 ? true : false;
            
            //179	The value entered in the HTML Editor exists. Would you like to proceed?
            l_msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "179");
        

        //HTML editor 팝업전 호출한 경우.
        }else if(bFlag === false){

            //바인딩건이 존재하는경우.
            if(is_attr.ISBND === "X" && is_attr.UIATV !== ""){
                l_chk = true;
            }

            //180	Binding information exists. Would you like to proceed?
            l_msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "180");
            
        }

        //확인 불필요상태면 입력 function 호출 후 exit.
        if(l_chk !== true){

            fnCallback(is_attr);

            //function 호출처 skip을 위한 flag return.
            return true;
        }


        //확인이 필요한경우 메시지 팝업 호출.
        // parent.showMessage(sap, 30, "I", l_msg, function(param){
        sap.m.MessageBox.confirm(l_msg, {id: oAPP.attr.C_CONFIRM_POPUP, onClose:function(param){

            oAPP.fn.setBusy(true);

            // if(param !== "YES"){return;}
            if(param !== "OK"){
                oAPP.fn.setBusy(false);
                return;
            }

            fnCallback(is_attr);

        }});

        oAPP.fn.setBusy(false);
        
        //현재 팝업에서 이벤트 발생시 다른 팝업의 BUSY ON 요청 처리.
        //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
        oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_ON"});

        //function 호출처 skip을 위한 flag return.
        return true;


    };  //sap.ui.core.HTML UI의 content 프로퍼티에서 바인딩, editor 호출전 점검.



    //aggregation 바인딩 callback 처리.
    oAPP.fn.attrBindCallBackAggr = async function(bIsbind, is_tree, is_attr){

        //unbind 처리건인경우.
        if(bIsbind === false){

            //n건 바인딩 처리한 UI가 존재하는경우(GT_OTAB-F01).
            if(typeof oAPP.attr.prev[is_attr.OBJID]._BIND_AGGR[is_attr.UIATT] !== "undefined" && 
                oAPP.attr.prev[is_attr.OBJID]._BIND_AGGR[is_attr.UIATT].length !== 0){

                //181	Change the model, the binding that exists in the child is initialized.
                var l_msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "181");

                //182	Do you want to continue?
                l_msg += oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "182");


                var _param = await new Promise(function(resolve){
                    
                    //확인 팝업 호출.
                    // parent.showMessage(sap, 30, "I", l_msg, function(param){
                    sap.m.MessageBox.confirm(l_msg, {id: oAPP.attr.C_CONFIRM_POPUP, onClose:function(param){
                        
                        // oAPP.fn.setBusy(true);

                        //현재 팝업의 BUSY만 ON 처리.
                        //(다른 팝업은 BUSY ON 상태임.)
                        oAPP.fn.setBusyWS20Interaction(true);
                        
                        return resolve(param);

                    }});

                    // oAPP.fn.setBusy(false);
                    
                    // //현재 팝업에서 이벤트 발생시 다른 팝업의 BUSY ON 요청 처리.
                    // //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                    // oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_ON"});

                    //바인딩 팝업의 BUSY만 종료 처리.
                    //(WS20과 다른 팝업은 BUSY 유지 처리.)
                    oAPP.fn.setBusyWS20Interaction(false);

                });
        
                //확인팝업에서 YES를 안누른경우 EXIT.
                // if(param !== "YES"){return;}
                if(_param !== "OK"){
                    // oAPP.fn.setBusy(false);

                    oAPP.fn.setBusyWS20Interaction(false, {});

                    return;
                }

                //unbind 처리.
                oAPP.fn.attrUnbindAggr(oAPP.attr.prev[is_attr.OBJID], is_attr.UIATT, is_attr.UIATV);

                //변경건 대한 후속 처리.
                oAPP.fn.attrSetUnbindProp(is_attr);

                //TREE의 PARENT, CHILD 프로퍼티 예외처리.
                oAPP.fn.attrUnbindTree(is_attr);
                    
                return;

            }

            //N건 바인딩 처리한 UI가 없으면 확인팝업 없이 unbind 처리.
            oAPP.fn.attrUnbindAggr(oAPP.attr.prev[is_attr.OBJID], is_attr.UIATT, is_attr.UIATV);

            //변경건 대한 후속 처리.
            oAPP.fn.attrSetUnbindProp(is_attr);

            //TREE의 PARENT, CHILD 프로퍼티 예외처리.
            oAPP.fn.attrUnbindTree(is_attr);

            return;

        }

    
        //이전 바인딩 정보가 존재하는경우.
        if(is_attr.UIATV !== "" && is_attr.ISBND === "X"){

            //181	Change the model, the binding that exists in the child is initialized.
            var l_msg = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "181");

            //182	Do you want to continue?
            l_msg += oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "182");


            var _param = await new Promise(function(resolve){

                //확인 팝업 호출.
                // parent.showMessage(sap, 30, "I", l_msg, function(param){
                sap.m.MessageBox.confirm(l_msg, {id: oAPP.attr.C_CONFIRM_POPUP, onClose:function(param){

                    // oAPP.fn.setBusy(true);

                    //현재 팝업의 BUSY만 ON 처리.
                    //(다른 팝업은 BUSY ON 상태임.)
                    oAPP.fn.setBusyWS20Interaction(true);

                    return resolve(param);
                }});

                // oAPP.fn.setBusy(false);
                
                // //현재 팝업에서 이벤트 발생시 다른 팝업의 BUSY ON 요청 처리.
                // //(다른 팝업에서 이벤트가 발생될 경우 WS20 화면의 BUSY를 먼저 종료 시키는 문제를 방지하기 위함)
                // oAPP.oMain.broadToChild.postMessage({PRCCD:"BUSY_ON"});

                //바인딩 팝업의 BUSY만 종료 처리.
                //(WS20과 다른 팝업은 BUSY 유지 처리.)
                oAPP.fn.setBusyWS20Interaction(false);


            });

            
            //확인팝업에서 YES를 안누른경우 EXIT.
            // if(param !== "YES"){return;}
            if(_param !== "OK"){
                // oAPP.fn.setBusy(false);

                oAPP.fn.setBusyWS20Interaction(false, {});

                return;
            }

            //UNBIND 처리.
            oAPP.fn.attrUnbindAggr(oAPP.attr.prev[is_attr.OBJID],is_attr.UIATT, is_attr.UIATV);

            //TREE의 PARENT, CHILD 프로퍼티 예외처리.
            oAPP.fn.attrUnbindTree(is_attr);

            //AGGREGATION 바인딩 처리.
            oAPP.fn.attrSetBindProp(is_attr, is_tree);
            

            oAPP.attr.prev[is_attr.OBJID]._MODEL[is_attr.UIATT] = is_attr.UIATV;

            return;

        }

        //이전 바인딩 정보가 존재하지 않는경우 바로 바인딩 처리.
        oAPP.fn.attrSetBindProp(is_attr, is_tree);

        oAPP.attr.prev[is_attr.OBJID]._MODEL[is_attr.UIATT] = is_attr.UIATV;


    };  //aggregation 바인딩 callback 처리.



    //프로퍼티 바인딩 처리.
    oAPP.fn.attrSetBindProp = function(is_attr, is_bInfo){

        //이전 바인딩 정보가 존재하는경우.
        if(is_attr.ISBND === "X"){
            //n건 바인딩 처리 정보 얻기.
            var l_model = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_attr.OBJID]);

            //n건 바인딩 정보가 존재하는경우.
            if(typeof l_model !== "undefined" && l_model !== ""){

                //현재 attr가 아닌 다른 바인딩된 UI가 N건 바인딩 처리됐는지 여부 확인.
                var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.findIndex(  a=> a.ISBND === "X" && a.UIATK !== is_attr.UIATK 
                    && a.UIATV.substr(0, l_model.length) === l_model );


                //다른 바인딩 설정건중 n건 바인딩 처리건이 없으면서 바인딩 팝업에서 선택한건도 n건 바인딩에 파생된건이 아닌경우.
                if(l_indx === -1 && is_bInfo.CHILD.substr(0, l_model.length) !== l_model){

                    //부모에서 현재 n건 바인딩 정보 제거 처리.
                    oAPP.fn.attrUnbindProp(is_attr);

                }

            }

        }

        //바인딩 팝업에서 선택한 PATH 정보.
        is_attr.UIATV = is_bInfo.CHILD;

        //바인딩됨 FLAG 처리.
        is_attr.ISBND = "X";

        //추가속성정의
        is_attr.MPROP = "";

        //프로퍼티인경우, 바인딩 추가 속성 정의가 존재하는경우.
        if(is_attr.UIATY === "1" && is_bInfo.MPROP !== ""){
            //바인딩 추가 속성 정의값 매핑.
            is_attr.MPROP = is_bInfo.MPROP || "";
        }


        //sap.ui.core.HTML UI의 content 프로퍼티에 바인딩 처리한경우.
        if(is_attr.UIATK === "AT000011858"){
            //UI에 수집되어있는 해당 이벤트 삭제.
            oAPP.fn.attrDelClientEvent(is_attr, "HM");
        }

        

        //프로퍼티의 DDLB 항목에서 바인딩 처리한경우.
        if(is_attr.UIATY === "1" && typeof is_attr.T_DDLB !== "undefined"){
            //DDLB항목에 바인딩한 정보 추가.
            is_attr.T_DDLB.push({KEY:is_attr.UIATV, TEXT:is_attr.UIATV, ISBIND:"X"});
        }

        //변경건 대한 후속 처리.
        oAPP.fn.attrChange(is_attr);

        //n건 바인딩 처리건인경우 부모 UI에 현재 UI 매핑 처리.
        oAPP.fn.setModelBind(oAPP.attr.prev[is_attr.OBJID]);


    };  //프로퍼티 바인딩 처리.



    //프로퍼티 바인딩 해제 처리.
    oAPP.fn.attrSetUnbindProp = function(is_attr){
        
        //n건 바인딩 처리 정보 얻기.
        var l_model = oAPP.fn.getParentAggrBind(oAPP.attr.prev[is_attr.OBJID]);

        //n건 바인딩 정보가 존재하는경우.
        if(typeof l_model !== "undefined" && l_model !== ""){

            //현재 attr이 아닌 다른 바인딩된 UI가 N건 바인딩 처리됐는지 여부 확인.
            var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.findIndex(  a=> a.ISBND === "X" && a.UIATK !== is_attr.UIATK 
                && a.UIATV.substr(0, l_model.length) === l_model );


            //다른 바인딩 설정건중 n건 바인딩 처리건이 없는경우.
            if(l_indx === -1){

                //부모에서 현재 n건 바인딩 정보 제거 처리.
                oAPP.fn.attrUnbindProp(is_attr);

            }

        }


        //바인딩 팝업에서 선택한 PATH 정보 초기화.
        is_attr.UIATV = "";

        //바인딩됨 FLAG 해제.
        is_attr.ISBND = "";

        //추가속성정의 초기화.
        is_attr.MPROP = "";

        //변경건 대한 후속 처리.
        oAPP.fn.attrChange(is_attr);

        //aggregation인경우 N건 바인딩 모델 정보 초기화.
        if(is_attr.UIATY === "3"){
            delete oAPP.attr.prev[is_attr.OBJID]._MODEL[is_attr.UIATT];
        }


    };  //프로퍼티 바인딩 해제 처리.



    //바인딩 해제 재귀호출.
    oAPP.fn.attrUnbindAggr = function(oUi, UIATT, UIATV){

        //T_0015의 바인딩 수집건 제거 처리.
        function lf_clearBindData(oUi){

            if(!oUi){return;}

            if(typeof oUi._T_0015 === "undefined"){return;}

            if(oUi._T_0015.length === 0){return;}

            //현재 UI에 설정된 N건 바인딩 해제 처리.
            for(var i = oUi._T_0015.length - 1; i >= 0; i--){

                //바인딩된건이 아닌경우 SKIP.
                if(oUi._T_0015[i].ISBND !== "X"){continue;}

                //바인딩건인경우 N건 바인딩 처리된 건인지 판단.
                if(oAPP.fn.chkBindPath(UIATV, oUi._T_0015[i].UIATV) === true){

                    var _s0015 = oUi._T_0015[i];

                    var _sTree = oAPP.fn.getDesignTreeAttrData(_s0015.OBJID, _s0015.UIATK);
                    if(typeof _sTree === "undefined"){
                        continue;
                    }

                    if(_sTree.UIATY === "3"){
                        oAPP.fn.attrUnbindAggr(oUi, _sTree.UIATT, _sTree.UIATV);

                    }

                    oAPP.fn.attrSetUnbindProp(_sTree);

                    // //N건 바인딩된 건인경우 바인딩 해제 처리.
                    // oUi._T_0015.splice(i, 1);
                }

            }

        } //T_0015의 바인딩 수집건 제거 처리.


        //n건 바인딩이 없는경우 exit.
        if(!oUi._BIND_AGGR[UIATT] || oUi._BIND_AGGR[UIATT].length === 0){

            //현재 UI에 수집된 ATTR 정보 초기화 로직 주석.
            //해당 FUNCTION 수행 이후 ATTR 수집건 처리 FUNCTION에 판단함.
            // //n건 바인딩 초기화 처리.
            // lf_clearBindData(oUi);

            //Aggregation에 n건 바인딩 처리 제거.
            if(oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true){
                delete oUi._MODEL[UIATT];
            }

            return;
        }


        //N건 바인딩 설정한 하위 UI가 존재하는경우.
        for(var i = oUi._BIND_AGGR[UIATT].length - 1; i >= 0; i--){

            //해당 UI로 파생된 N건 바인딩처리 UI가 없는경우.
            if(jQuery.isEmptyObject(oUi._BIND_AGGR[UIATT][i]._BIND_AGGR) === true){
                
                //n건 바인딩 초기화 처리.
                lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);

                //n건 바인딩 수집건에서 제거 처리.
                oUi._BIND_AGGR[UIATT].splice(i, 1);

                continue;

            }


            //해당 UI로 파생된 N건 바인딩처리 UI가 있는경우.
            for(var j in oUi._BIND_AGGR[UIATT][i]._BIND_AGGR){
                //하위를 탐색하며 n건 바인딩 수집 제거 처리.  
                oAPP.fn.attrUnbindAggr(oUi._BIND_AGGR[UIATT][i], j, UIATV);
            }

            //n건 바인딩 초기화 처리.
            lf_clearBindData(oUi._BIND_AGGR[UIATT][i]);

            //n건 바인딩 수집건에서 제거 처리.
            oUi._BIND_AGGR[UIATT].splice(i, 1);


        } //N건 바인딩 설정한 하위 UI가 존재하는경우.


        //현재 UI에 수집된 ATTR 정보 초기화 로직 주석.
        //해당 FUNCTION 수행 이후 ATTR 수집건 처리 FUNCTION에 판단함.
        // //n건 바인딩 초기화 처리.
        // lf_clearBindData(oUi);

        
        //Aggregation에 n건 바인딩 처리 제거.
        if(oAPP.fn.chkBindPath(UIATV, oUi._MODEL[UIATT]) === true){
            delete oUi._MODEL[UIATT];
        }

    };  //바인딩 해제 재귀호출.


    //sap.m.Tree, sap.ui.table.TreeTable의 경우 예외처리 unbind.
    oAPP.fn.attrUnbindTree = function(is_attr){

        var lt_UIATK = [];

        switch (is_attr.UIATK) {
            case "AT000006260": //sap.m.Tree  items

                //PARENT, CHILD 프로퍼티 KEY 정보 구성.
                lt_UIATK = ["EXT00001190", "EXT00001191"];

                break;

            case "AT000013146": //sap.ui.table.TreeTable  rows

                //PARENT, CHILD 프로퍼티 KEY 정보 구성.
                lt_UIATK = ["EXT00001192", "EXT00001193"];

                break;
            
            default:
                return;
        }


        for(var i = 0, l = lt_UIATK.length; i < l; i++){

            //design tree 정보에서 UI명에 해당하는 attr 정보 검색.
            var ls_attr = oAPP.fn.getDesignTreeAttrData(is_attr.OBJID, lt_UIATK[i]);

            if(typeof ls_attr === "undefined"){
                continue;
            }


            //PARENT, CHILD ATTRIBUTE에 바인딩이 구성되어 있다면.
            if(ls_attr.UIATV !== "" && ls_attr.ISBND === "X" ){

                //변경건 대한 후속 처리.
                oAPP.fn.attrSetUnbindProp(ls_attr);

            }

        } 

    };  //sap.m.Tree, sap.ui.table.TreeTable의 경우 예외처리 unbind.


    /************************************************************************
   * attribute 입력건에 대한 처리.
   * **********************************************************************
   * @param {object} is_attr - 처리대상 attribute 라인 정보
   ************************************************************************/
    oAPP.fn.attrChange = function(is_attr){

        //attribute 입력건에 대한 미리보기, attr 라인 style 등에 대한 처리.
        oAPP.fn.attrChangeProc(is_attr);

    
    }; //attribute 입력건에 대한 처리.


    /************************************************************************
     * 바인딩 정보에 따른 기능 버튼 활성여부 설정.
     * **********************************************************************/
    oAPP.fn.setDesignTreeEnableButton = function(is_attr){
        
        //default 동일속성 적용 버튼 비활성.
        is_attr._bind_visible   = false;

        //default 바인딩 해제 버튼 비활성.
        is_attr._unbind_visible = false;

        //바인딩 처리가 되지 않은경우 exit.
        if(is_attr.ISBND !== "X"){
            return;
        }

        //바인딩 처리 된경우, 바인딩 해제 버튼 활성.
        is_attr._unbind_visible = true;

        //property가 아닌경우 동일속성 바인딩 버튼 활성화 처리 하지 않음.
        if(is_attr.UIATY !== "1"){
            return;
        }

        //select option2의 value 프로퍼티인경우.
        if(is_attr.UIATK === "EXT00001161"){
            //동일속성 바인딩 적용버튼 활성화 처리 하지 않음.
            return;
        }

        //select option3의 value 프로퍼티인경우.
        if(is_attr.UIATK === "EXT00002507"){
            //동일속성 바인딩 적용버튼 활성화 처리 하지 않음.
            return;
        }

        //N건 입력 가능한 프로퍼티인경우 EXIT.
        if(is_attr.UIATY === "1" && is_attr.ISMLB === "X"){
            //동일속성 바인딩 적용버튼 활성화 처리 하지 않음.
            return;
        }

        
                    
        //동일속성 적용 버튼 활성.
        is_attr._bind_visible   = true;

        
    };


    /************************************************************************
   * attribute 입력건에 대한 미리보기, attr 라인 style 등에 대한 처리.
   * **********************************************************************
   * @param {object} is_attr - 처리대상 attribute 라인 정보
   ************************************************************************/
  oAPP.fn.attrChangeProc = function(is_attr){

        //attr 변경처리.
        oAPP.fn.attrChgAttrVal(is_attr);


        //바인딩 정보에 따른 기능 버튼 활성여부 설정.
        oAPP.fn.setDesignTreeEnableButton(is_attr);


    };  //attribute 입력건에 대한 미리보기, attr 라인 style 등에 대한 처리.



    //property, event, Aggregation 입력값 처리.
    oAPP.fn.attrChgAttrVal = function(is_attr){

        //ATTRIBUTE 수집처리.
        function lf_add_T_0015(){

            //수집건이 존재하는경우.
            if(l_indx !== -1){
                //해당 이벤트 매핑.
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].UIATV = is_attr.UIATV;
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].ISBND = is_attr.ISBND;
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].MPROP = is_attr.MPROP;
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].ADDSC = is_attr.ADDSC;
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].ISWIT = is_attr.ISWIT;
                oAPP.attr.prev[is_attr.OBJID]._T_0015[l_indx].ISSPACE = is_attr.ISSPACE;
                return;
            }

            //수집건이 존재하지 않는경우 신규 라인 생성 처리.
            var ls_0015 = oAPP.fn.crtStru0015();

            //attr의 입력값 매핑.
            oAPP.fn.moveCorresponding(is_attr, ls_0015);

            //이벤트 입력건 수집 처리.
            ls_0015.APPID = oAPP.attr.oAppInfo.APPID;
            ls_0015.GUINR = oAPP.attr.oAppInfo.GUINR;

            var ls_0022 = oAPP.attr.T_0022.find( a => a.UIOBK === is_attr.UIOBK );

            if(ls_0022){
                ls_0015.UILIK = ls_0022.UILIK;
            }

            oAPP.attr.prev[is_attr.OBJID]._T_0015.push(ls_0015);

        } //ATTRIBUTE 수집처리.


        //기존 수집건 존재 여부 확인.
        var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.findIndex( a => a.OBJID === is_attr.OBJID &&
            a.UIATT === is_attr.UIATT && a.UIATY === is_attr.UIATY );
        
        //바인딩 해제 건인경우.
        if(is_attr.UIATV === ""){

            //수집건 존재시.
            if(l_indx !== -1){
                //수집된 라인 삭제 처리.
                oAPP.attr.prev[is_attr.OBJID]._T_0015.splice(l_indx, 1);

            }

            //바인딩 표현 필드 초기화.
            is_attr.UIATV   = "";
            is_attr.ISBND   = "";
            is_attr.ISSPACE = "";
            is_attr.MPROP   = "";
            is_attr.ADDSC   = "";
            is_attr.MPROP   = "";
            is_attr.ISWIT   = "";

            return;

        }


        //이벤트인경우 값이 입력됐다면.
        if(is_attr.UIATY === "2" && is_attr.UIATV !== ""){
            //입력값 수집 처리.
            lf_add_T_0015();
            return;

        }

        //AGGREGATION인경우 값이 입력됐다면.
        if(is_attr.UIATY === "3" && is_attr.UIATV !== ""){
            //입력값 수집 처리.
            lf_add_T_0015();
            return;

        }
        

        //이벤트에 라인의 입력값이 존재하지 않는경우.
        if(is_attr.UIATY === "2" && is_attr.UIATV === ""){
        
            //클라이언트 이벤트 검색.
            var l_cevt = oAPP.DATA.APPDATA.T_CEVT.find( a => a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === "JS" );
            
            //클라이언트 이벤트가 존재하는경우 이벤트 수집처리.
            if(l_cevt){
                //서버이벤트 공백처리만 함.
                lf_add_T_0015();
                return;
            }

            //수집건이 존재하지 않는경우 exit.
            if(l_indx === -1){return;}

            //수집건존재, 서버이벤트, 클라이언트 이벤트가 없는경우 해당 라인 삭제 처리.
            oAPP.attr.prev[is_attr.OBJID]._T_0015.splice(l_indx, 1);
            return;

        }

            
        //AGGREGATION인경우 입력값이 존재하지 않는경우 수집건 존재시.
        if(is_attr.UIATY === "3" && is_attr.UIATV === "" && l_indx !== -1){
            //수집된 라인 삭제 처리.
            oAPP.attr.prev[is_attr.OBJID]._T_0015.splice(l_indx, 1);
            return;
        }

        
        var ls_0023, l_dval = "", l_ISLST = "";

        //ROOT가 아닌경우, 직접 입력가능한 aggregation이 아닌경우 default 값 얻기.
        if(is_attr.OBJID !== "ROOT" && is_attr.UIATK.indexOf("_1") === -1){
            ls_0023 = oAPP.attr.T_0023.find( a => a.UIATK === is_attr.UIATK );

        }

        if(ls_0023){
            l_dval = ls_0023.DEFVL;
            l_ISLST = ls_0023.ISLST;
        }

        //default 값과 동일한 경우 수집항목이 존재하지 않는경우 exit.
        if(l_dval === is_attr.UIATV && l_indx === -1){
            return;
        }

        //default 값과 동일한 경우 수집항목이 존재하는경우 해당 라인 제거 후 exit.
        if(l_dval === is_attr.UIATV && l_indx !== -1){
            var l_indx = oAPP.attr.prev[is_attr.OBJID]._T_0015.splice(l_indx,1);
            return;
        }

        //프로퍼티 type이 숫자 유형인경우.
        if(is_attr.UIATY === "1" && is_attr.ISBND === "" && is_attr.ISMLB === "" &&
        ( is_attr.UIADT === "int" || is_attr.UIADT === "float")){
            //입력값 숫자 유형으로 변경 처리.
            is_attr.UIATV  = String(Number(is_attr.UIATV));
        }


        is_attr.ISSPACE = "";

        //입력값이 존재하지 않는경우, default 값과 다르다면.
        if(is_attr.UIATV === "" && l_dval !== is_attr.UIATV){
            //SPACE 입력됨 FLAG 처리.
            is_attr.ISSPACE = "X";
        }


        //attr 입력건 수집 처리.
        lf_add_T_0015();


    }; //property, event, Aggregation 입력값 처리.


    //n건 바인딩한 프로퍼티 해제 처리.
    oAPP.fn.attrUnbindProp = function(is_attr){

        function lf_findModelBindParent(oParent){

            if(!oParent){return;}

            //N건 바인딩 정보가 존재하지 않는경우 상위 UI를 탐색.
            if(jQuery.isEmptyObject(oParent._BIND_AGGR) === true){
                lf_findModelBindParent(oParent.__PARENT);
                return;
            }

            //N건 바인딩 정보가 존재하는경우 입력 UI가 존재하는지 여부 확인.
            for(var i in oParent._BIND_AGGR){

                //현재 UI가 N건 바인딩 처리됐는지 확인.
                // var l_indx = oParent._BIND_AGGR[i].findIndex( a => a === oAPP.attr.prev[is_attr.OBJID] );
                var l_indx = oParent._BIND_AGGR[i].findIndex( a => a.OBJID === is_attr.OBJID );

                //N건 바인딩 처리 안된경우 SKIP.
                if(l_indx === -1){continue;}

                //부모의 N건 바인딩 수집건에서 현재 UI 제거 처리.
                oParent._BIND_AGGR[i].splice(l_indx, 1);
                return;

            }

            //N건 바인딩 정보에 입력 UI가 존재하지 않는경우 상위 UI 탐색.
            lf_findModelBindParent(oParent.__PARENT);

        }

        //상위 부모를 탐색하며 n건 바인딩 UI 수집건 제거.
        lf_findModelBindParent(oAPP.attr.prev[is_attr.OBJID].__PARENT);


    };  //n건 바인딩한 프로퍼티 해제 처리.


    /************************************************************************
     * 클라이언트 이벤트 삭제 처리.
     * **********************************************************************
     * @param {object} is_attr - 이벤트 발생한 attribute의 라인 정보.
     ************************************************************************/
    oAPP.fn.attrDelClientEvent = function(is_attr, OBJTY){

        //수집된 클라이언트 이벤트가 존재하지 않는경우 exit.
        if(oAPP.attr.T_CEVT.length === 0){return;}

        //클라이언트 이벤트 존재여부 확인.
        var l_index = oAPP.attr.T_CEVT.findIndex( a => a.OBJID === is_attr.OBJID + is_attr.UIASN && a.OBJTY === OBJTY );

        //클라이언트 이벤트가 존재하지 않는경우 EXIT.
        if(l_index === -1){return;}
        
        //클라이언트 이벤트 존재시 해당 라인 삭제 처리.
        oAPP.attr.T_CEVT.splice(l_index, 1);

    };  //클라이언트 이벤트 삭제 처리.




    //15번 정보 구조 생성.
    oAPP.fn.crtStru0015 = function(){

        return {"APPID":"","GUINR":"","OBJID":"","UIATK":"","UIATV":"","ISBND":"","UILIK":"",
                "UIOBK":"","UIATT":"","UIASN":"","UIADT":"","RVALU":"","BPATH":"","ADDSC":"",
                "UIATY":"","ISMLB":"","ISEMB":"","DEL_LIB":"","DEL_UOK":"","DEL_ATT":"",
                "ISWIT":"","ISSPACE":"","FTYPE":"","REFFD":"","CONVR":"","MPROP":""};
  
    };  //15번 정보 구조 생성.
  


    //MOVE-CORRESPONDING
    oAPP.fn.moveCorresponding = function(source,target){

        for(var i in source){
            if(typeof target[i] === "undefined"){continue;}
            target[i] = source[i];
        }
  
    };  //MOVE-CORRESPONDING


    /*******************************************************
    * @function - split 영역 초기화 처리.
    *******************************************************/  
    oAPP.fn.resetSplitArea = function(){

        //좌측 model tree width.
        oAPP.attr.oModel.oData.width = "30%";

        //가운데 design tree height
        oAPP.attr.oModel.oData.height = "100%";

        //가운데 split의 resize 여부.
        oAPP.attr.oModel.oData.resize_v = false;

        //가운데 바인딩 추가속성 정보 visible 여부.
        oAPP.attr.oModel.oData.vis_addit = false;

        //우측 바인딩 추가속성 정보 width.
        oAPP.attr.oModel.oData.width_r = "30%";

        //가운데 design, 바인딩 추가속성 영역 wdith.
        oAPP.attr.oModel.oData.width_c = "40%";


        oAPP.attr.oModel.refresh();
        setDesignAdditInfoVisible(getCurrentBindLayoutState());

        if(oAPP.attr.oDesign && oAPP.attr.oAddit){
            oAPP.fn.applyBindLayoutCustomizing(false);
        }

    };


    /************************************************************************
     * sap.ui.table.Table의 SORT, FILTER초기화.(sap.ui.table.TreeTable도 가능)
     *-----------------------------------------------------------------------
    * @param {object} oTable - sort, filter를 초기화 할 대상 table UI
    ***********************************************************************/
    oAPP.fn.resetUiTableFilterSort = function(oTable) {

        if (typeof oTable === "undefined") { return; }

        //table 바인딩 sort 해제 처리.
        oTable.sort();

        //table의 컬럼 정보 얻기.
        var _aCol = oTable.getColumns();

        for (var i = 0, l = _aCol.length; i < l; i++) {

            var _oCol = _aCol[i];

            //필터 초기화.
            oTable.filter(_oCol);

            //sort 초기화.
            _oCol.setSorted(false);
        }


    }   //end of resetUiTableFilterSort     결과리스트 테이블의 SORT, FILTER초기화.



    /*************************************************************
     * @function - 모델 바인딩 필드 정보 검색.
     *************************************************************/
    oAPP.fn.getModelBindData = function(CHILD, aTree){

        if(typeof aTree === "undefined"){
            return;
        }

        for (let i = 0, l = aTree.length; i < l; i++) {
            
            var _sTree = aTree[i];

            //검색대상 모델 바인딩 필드 정보인경우.
            if(_sTree.CHILD === CHILD){
                //해당 라인 return.
                return _sTree;
            }


            //검색 대상 바인딩 필드가 아닌경우 하위를 탐색하며 검색. 
            var _sFound = oAPP.fn.getModelBindData(CHILD, _sTree.zTREE);

            //검색건이 존재한 경우 해당 라인 정보 return.
            if(typeof _sFound !== "undefined"){
                return _sFound;
            }
            
        }

    };


    /*************************************************************
     * @function - 바인딩 추가속성 정보 초기화.
     *************************************************************/
    oAPP.fn.clearSelectAdditBind = function(){

        //추가속성 정보 초기화.
        oAPP.attr.oModel.oData.T_MPROP = [];

        oAPP.attr.oModel.oData.S_SEL_ATTR = {};

    };

    
    /*************************************************************
     * @function - busy open이 될때까지 대기 처리.
     *************************************************************/
    oAPP.fn.waitBusyOpened = function(){

        return new Promise((res)=>{
                       
            setTimeout(() => {
                res();
            }, 100);

        });

    };



    /*************************************************************
     * @function - tree item 펼침 처리.
     *************************************************************/
    oAPP.fn.expandTreeItem = function(oTree){

        oAPP.fn.setBusy(true);

        //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.
        function _fn_expand(){

            //처리대상 라인의 node 정보 얻기.
            var _oNode = _oBind.getNodeByIndex(_indx);

            //node를 찾지 못한 경우 exit(모든 node 탐색).
            if(typeof _oNode === "undefined"){return;}

            //선택한 라인에서 파생된건이 아닌경우 exit.
            if(_group !== _oNode.groupID.substr(0, _group.length)){return;}
            
            //현재 node의 child가 존재, 해당 node가 펼쳐져있지 않다면.
            if(_oNode.isLeaf === false && _oNode.nodeState.expanded === false){
                //해당위치 펼침 처리.
                _oBind.expand(_indx);

            }

            //다음 라인 정보 구성.
            _indx += 1;

            //하위를 탐색하며 tree 펼첨 처리.
            _fn_expand();
        
        } //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.


        if(typeof oTree === "undefined"){
            oAPP.fn.setBusy(false);
            return;
        }

        //선택한 라인 index 얻기.
        var _indx = oTree.getSelectedIndex();

        //선택한 라인이 없는경우 exit.
        if(_indx === -1){
            oAPP.fn.setBusy(false);

            //183	Selected line does not exists.
            sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "183"),
                {duration: 3000, at:"center center", my:"center center"});

            return;
        }

        //tree 바인딩 정보 얻기.
        var _oBind = oTree.getBinding();

        if(typeof _oBind === "undefined" || _oBind === null){
            oAPP.fn.setBusy(false);
            return;
        }

        //선택한 라인의 바인딩 정보 얻기.
        var _group = _oBind.getNodeByIndex(_indx).groupID;

        //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.
        _fn_expand();

        oAPP.fn.setBusy(false);


    };  //tree item 펼침 처리.





    /*************************************************************
     * @function - tree item 펼침 처리.
     *************************************************************/
    oAPP.fn.expandTreeItem = function(oTree){

        oAPP.fn.setBusy(true);

        //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.
        function _fn_expand(is_tree){

            if(typeof is_tree === "undefined"){
                return;
            }

            //현재 라인 펼침 처리.
            _oBind.expand(_indx);


            for (let i = 0, l = is_tree.zTREE_DESIGN.length; i < l; i++) {
                _fn_expand(is_tree.zTREE_DESIGN[i]);
                
            }
           
        
        } //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.


        if(typeof oTree === "undefined"){
            oAPP.fn.setBusy(false);
            return;
        }

        //선택한 라인 index 얻기.
        var _indx = oTree.getSelectedIndex();

        //선택한 라인이 없는경우 exit.
        if(_indx === -1){
            oAPP.fn.setBusy(false);

            //183	Selected line does not exists.
            sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "183"),
                {duration: 3000, at:"center center", my:"center center"});

            return;
        }

        //tree 바인딩 정보 얻기.
        var _oBind = oTree.getBinding();

        if(typeof _oBind === "undefined" || _oBind === null){
            oAPP.fn.setBusy(false);
            return;
        }


        var _oCtxt = _oBind.getContextByIndex(_indx);
        
        if(typeof _oCtxt === "undefined" || _oCtxt === null){
            oAPP.fn.setBusy(false);
            return;
        }

        var _sTree = _oCtxt.getProperty();


        //선택한 라인을 기준으로 하위를 탐색하며 펼침 처리.
        _fn_expand(_sTree);

        oAPP.fn.setBusy(false);


    };  //tree item 펼침 처리.



    /*************************************************************
     * @function - tree item 접힘 처리.
     *************************************************************/
    oAPP.fn.collapseTreeItem = function(oTree){

        oAPP.fn.setBusy(true);

        if(typeof oTree === "undefined"){
            oAPP.fn.setBusy(false);
            return;
        }

        var _indx = oTree.getSelectedIndex();

        if(_indx === -1){
            oAPP.fn.setBusy(false);

            //183	Selected line does not exists.
            sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "183"),
                {duration: 3000, at:"center center", my:"center center"});

            return;
        }
        
        //선택한 라인을 접힘 처리.
        oTree.collapse(_indx);

        oAPP.fn.setBusy(false);

    };



    /*************************************************************
     * @function - 화면 잠금/잠금해제 처리.
     *************************************************************/
    oAPP.fn.setViewEditable = function(bLock){

        //application이 조회모드인경우 exit.
        if(oAPP.attr.oAppInfo.IS_EDIT === ""){
            return;
        }

        //모델 tree, 가운데 하단 바인딩 추가속성 정보 잠금/ 잠금 해제 처리.
        oAPP.attr.oModel.oData.edit         = bLock;

        //모델 tree 갱신버튼 잠금/ 잠금 해제 처리.
        oAPP.attr.oModel.oData.edit_refresh = bLock;

        //화면 개인화 버튼 잠금/ 잠금 해제 처리.
        oAPP.attr.oModel.oData.edit_layout_customizing = bLock;

        oAPP.attr.oModel.refresh();

    };
    
/********************************************************************
 * ******************************************************************
 * ******************************************************************
 *📝 바인딩 추가 기능 관련 로직 -END.
 ********************************************************************
 ********************************************************************
 ********************************************************************/



    //서버에서 바인딩 attr 정보 얻기.
    oAPP.fn.getBindFieldInfo = function() {
        
        return new Promise((resolve)=>{

            //화면 잠금 처리.
            // oAPP.attr.oModel.setProperty("/busy", true);

            //바인딩 필드 정보 초기화.
            oAPP.attr.oModel.oData.zTREE = [];
            oAPP.attr.oModel.oData.TREE  = [];

            //바인딩 추가속성 정보 초기화.
            oAPP.fn.clearSelectAdditBind();


            //추가속성 정보 화면 비활성 처리.
            oAPP.fn.setAdditLayout("");


            oAPP.attr.oModel.refresh();
            

            //클래스명 서버 전송 데이터에 구성.
            var oFormData = new FormData();
            oFormData.append("CLSNM", oAPP.attr.oAppInfo.CLSID);
            oFormData.append("APPID", oAPP.attr.oAppInfo.APPID);

            //바인딩 필드 정보 검색.
            sendAjax(oAPP.attr.servNm + "/getBindAttrData", oFormData, async function (param) {

                var l_model = oAPP.attr.oModel;

                //오류가 발생한 경우.
                if(param.RETCD === "E"){
                    //오류 메시지 처리.
                    sap.m.MessageToast.show(param.RTMSG,
                        {duration: 3000, at:"center center", my:"center center"});
                    
                    //20240729 PES -START.
                    //WS 3.0 디자인 영역과 바인딩 팝업 통신을 BROADCAST로 변경함에 따른 IPC 통신 주석처리.
                    // var CURRWIN = oAPP.REMOTE.getCurrentWindow(),
                    // PARWIN = CURRWIN.getParentWindow();

                    // PARWIN.webContents.send("if-bindPopup-callback", "X");
                    //20240729 PES -END.
                    

                    return resolve();
                }

                l_model.oData.TREE = param.T_ATTR;

                //default 화면 편집 불가능.
                l_model.oData.edit = false;

                //workbench 화면이 편집상태인경우.
                if(oAPP.attr.oAppInfo.IS_EDIT === "X"){
                    //화면 편집 가능 flag 처리.
                    l_model.oData.edit = true;
                }

                //바인딩 정보가 존재하지 않는경우.
                if (l_model.oData.TREE.length === 0) {

                    //184	Binding attributes does not exist.
                    // //바인딩 필드가 존재하지 않음 메시지 처리.
                    sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "184"), 
                        {duration: 3000, at:"center center", my:"center center"});

                    //20240729 PES -START.
                    //WS 3.0 디자인 영역과 바인딩 팝업 통신을 BROADCAST로 변경함에 따른 IPC 통신 주석처리.
                    // var CURRWIN = oAPP.REMOTE.getCurrentWindow(),
                    // PARWIN = CURRWIN.getParentWindow();

                    // PARWIN.webContents.send("if-bindPopup-callback", "X");
                    //20240729 PES -END.
                    
                    return resolve();

                }

                //controller의 바인딩 가능 attribute 정보가 존재하는경우.
                if (l_model.oData.TREE.length !== 0) {

                    //2레벨의 TABLE, STRUCTURE정보만 발췌.
                    var lt_filt = l_model.oData.TREE.filter(a => a.ZLEVEL === 2 && a.KIND !== "E");

                    //TABLE, STRUCTURE를 탐색하며 선택 가능 여부 처리.
                    oAPP.fn.setBindEnable(lt_filt, "", l_model, "");

                    //tree 바인딩 정보 구성.
                    oAPP.fn.setTreeJson(l_model, "TREE", "CHILD", "PARENT", "zTREE");

                }

                //tree 전체 접힘 처리.
                oAPP.ui.oModelFieldTree.collapseAll();

                //이전 선택 라인정보 초기화.
                oAPP.ui.oModelFieldTree.clearSelection();

                //tee에서 필터 처리시 전체 펼침 처리.
                oAPP.ui.oModelFieldTree.expandToLevel(99999);

                //화면 잠금 해제 처리.
                l_model.oData.busy = false;

                /**
                * @since   2026-06-12 01:36:51
                * @version v3.6.4-3
                * @author  PES
                * @description
                *  바인딩 필드 영역이 비활성화된 상태에서는 table row rendering 완료를 기다리지 않는다.
                *  화면에 표시되지 않는 table의 rowsUpdated 이벤트를 기다리면 popup 재호출 시 busy가 유지될 수 있으므로,
                *  MODEL 영역이 활성화된 경우에만 기존 waitTableRowsUpdated 흐름을 수행한다.
                *  데이터 모델 갱신과 선택 상태 초기화는 그대로 수행하여 영역을 다시 활성화했을 때 기존 상태 흐름을 유지한다.
                */
                var _oPromise = isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) === true ?
                    waitTableRowsUpdated(oAPP.ui.oModelFieldTree, 1000) : Promise.resolve();

                //모델 정보 바인딩 처리.
                l_model.refresh(true);

                await _oPromise;

                //모델 tree 첫번째 라인 선택 처리.
                oAPP.ui.oModelFieldTree.setSelectedIndex(0);

                if(isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) === true){
                    oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);
                }
                
                //20240729 PES -START.
                //WS 3.0 디자인 영역과 바인딩 팝업 통신을 BROADCAST로 변경함에 따른 IPC 통신 주석처리.
                // var CURRWIN = oAPP.REMOTE.getCurrentWindow(),
                // PARWIN = CURRWIN.getParentWindow();

                // PARWIN.webContents.send("if-bindPopup-callback", "X");
                //20240729 PES -END.


                if(isBindLayoutAreaActive(CS_BIND_LAYOUT_AREA.MODEL) === true){
                    oAPP.ui.oModelFieldTree.attachEventOnce("rowsUpdated", ()=>{
                        // //tree table 컬럼길이 재조정 처리.
                        oAPP.fn.setUiTableAutoResizeColumn(oAPP.ui.oModelFieldTree);
                    });
                }
            
                return resolve();

            }); //바인딩 필드 정보 검색.

        });

    }; //서버에서 바인딩 attr 정보 얻기.




    //바인딩 가능여부 flag 처리.
    oAPP.fn.setBindEnable = function(it_tree, l_path, l_model, KIND_PATH, KIND) {

        if (it_tree.length === 0) {
            return;
        }

        for (var i = 0, l = it_tree.length; i < l; i++) {
            
            it_tree[i].isTabField = false;

            //table로부터 파생된 필드인경우.
            if(KIND === "T"){
                //table로부터 팡생된 필드임 flag 처리.
                it_tree[i].isTabField = true;
            }

            if(KIND_PATH === ""){
                it_tree[i].KIND_PATH = it_tree[i].KIND;

            }else{
                
                it_tree[i].KIND_PATH = KIND_PATH + "-" + it_tree[i].KIND;
            }

            switch (it_tree[i].KIND) {
                case "T": //TABLE인경우.

                    it_tree[i].enable = true;
                    it_tree[i].stat_src = "sap-icon://status-positive";
                    it_tree[i].stat_color = "#01DF3A";

                    var lt_child = l_model.oData.TREE.filter(a => a.PARENT === it_tree[i].CHILD);

                    //range table 여부 확인.
                    oAPP.fn.chkRangeTable(it_tree[i]);

                    oAPP.fn.setBindEnable(lt_child, l_path, l_model, it_tree[i].KIND_PATH, it_tree[i].KIND);

                    break;

                case "S": //STRUCTURE인경우.

                    //structure은 drag false.
                    it_tree[i].enable = false;

                    //현재 path의 하위 path정보 얻기.
                    var lt_child = l_model.oData.TREE.filter(a => a.PARENT === it_tree[i].CHILD);

                    //하위 path를 탐색하며 선택 가능 flag 처리.
                    oAPP.fn.setBindEnable(lt_child, l_path, l_model, it_tree[i].KIND_PATH, KIND);
                    break;

                case "E": //일반 필드인경우.

                    it_tree[i].enable = true;
                    it_tree[i].stat_src = "sap-icon://status-positive";
                    it_tree[i].stat_color = "#01DF3A";


                    break;

            }

        }

    }; //바인딩 가능여부 flag 처리.



    //바인딩 추가속성 정보 DDLB 선택 이벤트.
    oAPP.fn.setAddtBindInfoDDLB = function(oUi) {
        
        var _oModel = oUi.getModel();

        if(typeof _oModel === "undefined"){
            return;
        }

        var l_ctxt = oUi.getBindingContext();

        if(typeof l_ctxt === "undefined"){
            return;
        }

        var ls_line = l_ctxt.getProperty();

        //오류 표현 초기화.
        ls_line.stat    = null;
        ls_line.statTxt = "";

        //Bind type, Reference Field name DDLB을 선택하지 않은경우 exit.
        if (ls_line.ITMCD !== "P04" && ls_line.ITMCD !== "P05") {

            //모델 갱신 처리.
            _oModel.refresh();

            return;
        }

        //Bind type 라인 정보 얻기.
        var ls_P04 = _oModel.oData.T_MPROP.find(a => a.ITMCD === "P04");
        if (typeof ls_P04 === "undefined"){
            return;
        }

        //Reference Field name 라인 정보 얻기.
        var ls_P05 = _oModel.oData.T_MPROP.find(a => a.ITMCD === "P05");
        if (typeof ls_P05 === "undefined"){
            return;
        }

        //conversion name 라인 정보 얻기.
        var ls_P06 = _oModel.oData.T_MPROP.find(a => a.ITMCD === "P06");
        if (typeof ls_P06 === "undefined") {
            return;
        }


        //Bind type을 빈값으로 선택한경우.
        if(ls_line.ITMCD === "P04" && ls_line.val === ""){
            //Reference Field name를 초기화 처리.
            ls_P05.val = "";
        }

        //Reference Field name을 빈값으로 선택한경우.
        if(ls_line.ITMCD === "P05" && ls_line.val === ""){
            //Bind type을 초기화 처리.
            ls_P04.val = "";
        }

        
        //Bind type DDLB을 빈값 선택한 경우.
        if (ls_P04.val === "") {

            //Reference Field name DEFAULT 선택 불가능 처리.
            ls_P05.edit = false;

            //Reference Field name 선택값 초기화.
            ls_P05.val = "";

            //Conversion Routine 선택 가능 처리.
            ls_P06.edit = true;

        } else if (ls_line.val !== "") {
            //Bind type DDLB을 선택한 경우.

            //Reference Field name DEFAULT 선택 가능 처리.
            ls_P05.edit = true;

            //Conversion Routine 선택 불가 처리.
            ls_P06.edit = false;

            //Conversion Routine 선택값 초기화.
            ls_P06.val = "";

            //오류 FLAG 초기화.
            ls_P06._error     = false;
            ls_P06._error_msg = "";
            
            ls_P06.stat       = null;
            ls_P06.statTxt    = "";

        }

        //모델 갱신 처리.
        _oModel.refresh();

    }; //바인딩 추가속성 정보 DDLB 선택 이벤트.



    /*************************************************************
     * @function - 바인딩 추가 속성 정보 오류 점검.
     *************************************************************/
    oAPP.fn.checkAdditData = function(){

        var _sRes = {RETCD:"", RTMSG:"", T_ERMSG:[]};

        //추가속성 매핑 전 오류건 확인.
        var _aMPROP = oAPP.attr.oAddit.oModel.oData.T_MPROP.filter( item => item._error === true);

        //오류건이 존재하지 않는경우 exit.
        if(_aMPROP.length === 0){
            return _sRes;
        }

        //오류 메시지 정보 수집.
        for (let i = 0, l =_aMPROP.length; i < l; i++) {
            
            var _sMPROP = _aMPROP[i];

            var _sERMSG = JSON.parse(JSON.stringify(oAPP.types.TY_ADDIT_MSG));

            _sERMSG.ITMCD = _sMPROP.ITMCD;
            _sERMSG.ERMSG = _sMPROP._error_msg;

            _sRes.T_ERMSG.push(_sERMSG);
            
        }

        _sRes.RETCD  = "E";

        //146	바인딩 추가속성 정보에 오류건이 존재합니다.
        _sRes.RTMSG  = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "146");
        
        return _sRes;

    };


    /*************************************************************
     * @function - 바인딩 추가 속성 정보 오류 점검.
     *************************************************************/
    oAPP.fn.closeMessagePopover = function(){

        if(typeof window?.sap?.m?.InstanceManager?.getOpenPopovers !== "function"){
            return;
        }

        var _aPopOver = window.sap.m.InstanceManager.getOpenPopovers();

        if(_aPopOver.length === 0){
            return;
        }

        for (let i = 0, l = _aPopOver.length; i < l; i++) {
            
            var _oPopOver = _aPopOver[i];

            //메시지 팝업 호출건인경우 종료 처리.
            if(typeof oAPP.fn.closeMessagePopoverControl === "function"){
                oAPP.fn.closeMessagePopoverControl(_oPopOver);
            }
            
        }

    };


    //drag 정보 처리.
    oAPP.fn.setDragStart = async function(oEvent){

        var _oUi = oEvent?.mParameters?.target;

        if(typeof _oUi === "undefined" || _oUi === null){
            return;
        }

        //drag한 위치의 바인딩 정보 얻기.
        var l_ctxt = _oUi.getBindingContext();
        if (!l_ctxt) {
            return;
        }

        //drag한 TREE 정보 얻기.
        var ls_drag = l_ctxt.getProperty();
        if (!ls_drag) {
            return;
        }

        //외부 attribute 영역 drop 후에도 바인딩 팝업 레이아웃을 유지하기 위한 스냅샷.
        //복원 로직 제외 테스트를 위해 임시 비활성.
        // oAPP.fn.captureBindFieldDragLayout();

        //바인딩 필드 정보에서 drag 시작처리.
        oAPP.attr.oDesign.ui.ROOT.data("dragStart", true);

        var l_obj = {};

        //프로세스 코드.
        l_obj.PRCCD = "PRC001";

        //오류 코드.
        l_obj.RETCD = "";

        //오류 메시지.
        l_obj.RTMSG = "";

        //오류 세부 코드.
        l_obj.T_ERMSG = [];

        //application session key 매핑.
        l_obj.DnDRandKey = oAPP.attr.DnDRandKey;

        //DRAG 한 라인 정보.
        l_obj.IF_DATA = JSON.parse(JSON.stringify(ls_drag));

        //바인딩 추가속성 정보 매핑.
        l_obj.IF_DATA.MPROP = oAPP.fn.setAdditBindData(oAPP.attr.oAddit.oModel.oData.T_MPROP);

        //추가속성 매핑 오류건 확인.
        var _sRes = oAPP.fn.checkAdditData();

        //오류가 발생한 경우 해당 내용 drag data에 세팅.
        if(_sRes.RETCD === "E"){
            l_obj.RETCD   = _sRes.RETCD;
            l_obj.RTMSG   = _sRes.RTMSG;
            l_obj.T_ERMSG = _sRes.T_ERMSG;
        }


        var l_json = JSON.stringify(l_obj);

        //DRAG한 UI ID 정보 세팅.
        event.dataTransfer.setData("prc001", l_json);


        //design tree의 drop 가능 여부 초기화.
        oAPP.attr.oDesign.fn.resetDropFlag(oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN);


        //design tree의 drop style 초기화.
        oAPP.attr.oDesign.fn.resetDropStyle();


        //drop 가능 여부 설정.
        oAPP.attr.oDesign.fn.setDropFlag(oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN, ls_drag);


        //drop style 설정.
        oAPP.attr.oDesign.fn.setDropStyle();


        //drop 타겟 aggregation 설정 처리.
        oAPP.attr.oDesign.fn.setDropTargetAggregation("rows");

        //오류 팝업 종료 처리.
        oAPP.fn.closeMessagePopover();


        //drag한 UI의 라인 위치 얻기.
        var _indx = oAPP.ui.oModelFieldTree.indexOfRow(_oUi);

        if(_indx === -1){
            return;
        }

        //라인 재 선택 처리.
        oAPP.ui.oModelFieldTree.setSelectedIndex(_indx);


    };  //drag 정보 처리.


    /*************************************************************
     * @function - 호출된 모든 팝업 종료 처리.
     *************************************************************/
    oAPP.fn.closeAllPopups = function(){

        //호출된 모든 팝업 종료.
        sap.m.InstanceManager.closeAllDialogs();

        //호출된 모든 팝업 종료.
        sap.m.InstanceManager.closeAllPopovers();


    };


    /*************************************************************
     * @event - drag 종료 이벤트.
     *************************************************************/
    oAPP.fn.cleanupBindFieldDragState = function(){

        //바인딩 필드 정보에서 drag 종료처리.
        oAPP.attr.oDesign.ui.ROOT.data("dragStart", null);

        
        //drop 가능 flag 초기화.
        oAPP.attr.oDesign.fn.resetDropFlag(oAPP.attr.oDesign.oModel.oData.zTREE_DESIGN);


        //drop style 초기화.
        oAPP.attr.oDesign.fn.resetDropStyle();

        //design tree의 drop 타겟 aggregation 초기화.
        oAPP.attr.oDesign.fn.setDropTargetAggregation();

    };


    /*************************************************************
     * @event - drag 종료 이벤트.
     *************************************************************/
    oAPP.fn.onBindFieldDragEnd = function(oEvent){

        oAPP.fn.cleanupBindFieldDragState();
        //복원 로직 제외 테스트를 위해 임시 비활성.
        // oAPP.fn.scheduleRestoreBindFieldDragLayout();

    };


    /*************************************************************
     * @event - 추가속성 적용 버튼 선택 이벤트.
     *************************************************************/
    oAPP.fn.onAdditBind = async function(oEvent){

        var _sOption = JSON.parse(JSON.stringify(oAPP.types.TY_BUSY_OPTION));

        //219	바인딩 팝업에서 추가 속성 바인딩 처리를 진행하고 있습니다.
        _sOption.DESC = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "219"); 


        oAPP.fn.setBusyWS20Interaction(true, _sOption);
        
        //20240827 PES -START.
        //기존 BUSY 처리시, BROADCAST로 WS20메인 화면 및 다른 팝업에 BUSY 요청 처리되어
        //WS20 메인 화면의 BUSY DIALOG를 호출할 수 없기에 주석 처리함.
        // oAPP.fn.setBusy(true);

        // var _sOption = JSON.parse(JSON.stringify(oAPP.types.TY_BUSY_OPTION));

        // //219	바인딩 팝업에서 추가 속성 바인딩 처리를 진행하고 있습니다.
        // _sOption.DESC = oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "219"); 

        // //WS 3.0 DESIGN 영역에 BUSY ON 요청 처리.
        // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_ON", _sOption);
        //20240827 PES -END.



        var _oUi = oEvent?.oSource;

        if(typeof _oUi === "undefined"){

            // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
            // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

            // oAPP.fn.setBusy(false);

            oAPP.fn.setBusyWS20Interaction(false, {});

            return;
        }

        
        //오류 표현 필드 초기화.
        oAPP.attr.oAddit.fn.resetErrorField();


        //바인딩 추가 속성 정보 적용 전 입력값 점검.
        var _sRes = await oAPP.fn.chkAdditBindData(oAPP.ui.oAdditTab);

        //바인딩 추가 속성 점검 오류가 존재하는경우.
        if(_sRes.RETCD === "E"){

            //메시지 처리.
            await oAPP.fn.showMessagePopoverOppener(_oUi, _sRes.T_RTMSG);
            
            // //WS 3.0 DESIGN 영역에 BUSY OFF 요청 처리.
            // parent.require("./wsDesignHandler/broadcastChannelBindPopup.js")("BUSY_OFF");

            // oAPP.fn.setBusy(false);

            oAPP.fn.setBusyWS20Interaction(false, {});

            return;
        }


        //오류 표현 초기화 처리.
        oAPP.attr.oDesign.fn.resetErrorField();


        //디자인 영역의 추가속성정보 갱신 처리.
        oAPP.attr.oDesign.fn.setMPROP();


        //090	바인딩 추가 속성 정보를 적용 했습니다.
        sap.m.MessageToast.show(oAPP.WSUTIL.getWsMsgClsTxt(oAPP.attr.GLANGU, "ZMSG_WS_COMMON_001", "090"), 
            {duration: 3000, at:"center center", my:"center center"});

        //해당 영역에서 BUSY OFF 처리하지 않음.
        //바인딩 팝업에서 WS20 디자인 영역에 데이터 전송 ->
        //WS20 디자인 영역에서 데이터 반영 ->
        //WS20 디자인 영역에서 BUSY OFF 요청으로 팝업의 BUSY가 종료됨.

    };
    


    //drag 종료시 css 잔상 제거.
    window.ondragend = function(){

        if(oAPP.attr.oBindFieldDragLayoutSnapshot){
            oAPP.fn.cleanupBindFieldDragState();
            //복원 로직 제외 테스트를 위해 임시 비활성.
            // oAPP.fn.scheduleRestoreBindFieldDragLayout();
        }

        oAPP.IPCRENDERER.send("if-dragEnd");
    };  //drag 종료시 css 잔상 제거.



    /************************************************************************
     * SAP Icon Image 경로를 주는 펑션
     ************************************************************************/
    oAPP.fn.fnGetSapIconPath = function (sIcon) {

        if (sIcon == null) {
            return;
        }

        var sIconName = sIcon + ".gif";

        return PATH.join(APP.getAppPath(), "icons", sIconName);

    }; // end of oAPP.fn.fnGetSapIconPath

    /************************************************************************
     * 페이지가 실제로 숨겨지거나 종료 처리될 때 호출되는 이벤트
     ************************************************************************/
    window.addEventListener('pagehide', function(){

        // IPC Event 해제
        _detachIpcEvents();

    },{ once: true });

})(window, oAPP);


}
