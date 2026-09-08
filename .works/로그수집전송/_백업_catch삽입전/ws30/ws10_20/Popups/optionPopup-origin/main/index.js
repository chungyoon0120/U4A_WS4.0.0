/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * optionPopup 메인 프레임, 메뉴, iframe 화면 전환, 창 제어를 처리한다.
 *
 */
(function () {
    "use strict";

    const oAPP = OptionPopupUtil.getApp();
    const sScriptBaseUrl = document.currentScript?.src || location.href;
    const MIN_WINDOW_WIDTH = 600;
    const MIN_WINDOW_HEIGHT = 500;
    const MSG = {
        OPTIONS: ["/U4A/CL_WS_COMMON", "B52"],
        THEME_SETTINGS: ["/U4A/CL_WS_COMMON", "D22"],
        SELECTION_EFFECT_MENU: ["ZMSG_WS_COMMON_001", "823"],
        SELECTION_EFFECT_MENU_TOOLTIP: ["ZMSG_WS_COMMON_001", "859"],
        MINIMIZE: ["ZMSG_WS_COMMON_001", "855"],
        MAXIMIZE: ["ZMSG_WS_COMMON_001", "856"],
        RESTORE: ["ZMSG_WS_COMMON_001", "857"]
    };

    function resolveContentUrl(path) {
        return new URL(path, sScriptBaseUrl).href;
    }

    function msgText(cls, no) {

        const aParams = Array.prototype.slice.call(arguments, 2);

        if (!cls || !no) {
            return "";
        }

        if (typeof OptionPopupUtil?.getMsgClsText === "function") {
            return OptionPopupUtil.getMsgClsText(
                cls,
                no,
                aParams[0] || "",
                aParams[1] || "",
                aParams[2] || "",
                aParams[3] || ""
            );
        }

        const sMissingText = cls && no ? `${cls} ${no}` : "";

        if (typeof oAPP?.common?.fnGetMsgClsText !== "function") {
            return sMissingText;
        }

        try {
            return oAPP.common.fnGetMsgClsText(
                cls,
                no,
                aParams[0] || "",
                aParams[1] || "",
                aParams[2] || "",
                aParams[3] || ""
            ) || sMissingText;
        } catch (error) {
            return sMissingText;
        }

    }

    function text(key) {

        const aMsg = MSG[key];

        if (!aMsg) {
            return key || "";
        }

        return msgText.apply(null, aMsg);

    }

    function normalizeTooltipText(tooltip) {

        return String(tooltip || "").replace(/\s+/g, " ").trim();

    }

    function wrapTooltipText(tooltip) {

        const sText = normalizeTooltipText(tooltip);
        const iMaxLength = 34;
        const aWords = sText.split(" ");
        const aLines = [];
        let sLine = "";

        aWords.forEach(function (word) {

            const sNext = sLine ? `${sLine} ${word}` : word;

            if (sLine && sNext.length > iMaxLength) {
                aLines.push(sLine);
                sLine = word;
                return;
            }

            sLine = sNext;

        });

        if (sLine) {
            aLines.push(sLine);
        }

        return aLines.join("\n");

    }

    const MENU_ITEMS = [
        {
            key: "theme",
            textKey: "THEME_SETTINGS",
            icon: "sap-icon://u4a-fw-solid/Palette",
            url: resolveContentUrl("../theme/index.html")
        },
        {
            key: "selectionEffect",
            textKey: "SELECTION_EFFECT_MENU",
            tooltipKey: "SELECTION_EFFECT_MENU_TOOLTIP",
            icon: "sap-icon://u4a-fw-solid/Fill Drip",
            url: resolveContentUrl("../selectionEffect/index.html")
        }
    ];

    const oDom = {
        shell: document.querySelector(".op-shell"),
        menuToggle: document.getElementById("menuToggle"),
        windowMinimize: document.getElementById("windowMinimize"),
        windowMaximize: document.getElementById("windowMaximize"),
        windowClose: document.getElementById("windowClose"),
        menuList: document.getElementById("menuList"),
        frame: document.getElementById("optionContentFrame"),
        busyOverlay: document.getElementById("busyOverlay")
    };

    let sActiveKey = "";
    let bInitialContentLoaded = false;
    let bIsClosing = false;
    let oBroadcast;
    let oCurrentWindow;
    window.fn_getParent = function () {
        return oAPP;
    };

    window.PATHINFO = oAPP?.PATHINFO || OptionPopupUtil.getPathInfo();
    window.WSUTIL = oAPP?.WSUTIL || OptionPopupUtil.getWsUtil();

    window.OptionPopupMain = {
        getApp: function () {
            return oAPP;
        },
        isClosing: function () {
            return bIsClosing === true;
        },
        isBusy,
        setBusy,
        reloadActive: function () {
            if (bIsClosing === true) {
                return;
            }
            oDom.frame.contentWindow?.location?.reload();
        }
    };

    function init() {

        if (oAPP?.fn) {
            oAPP.fn.setBusy = setBusy;
        }

        applyWindowMinimumSize();
        OptionPopupUtil.applyThemeShell();
        OptionPopupUtil.applyText();
        document.title = text("OPTIONS");
        attachBroadcastEvent();
        attachIpcEvents();
        attachWindowStateEvents();
        bindEvents();
        renderMenu();
        loadMenu(MENU_ITEMS[0].key);

    }

    function bindEvents() {

        oDom.menuToggle.addEventListener("click", function () {
            oDom.shell.classList.toggle("is-collapsed");
        });

        oDom.windowMinimize.addEventListener("click", minimizeWindow);
        oDom.windowMaximize.addEventListener("click", toggleMaximizeWindow);
        oDom.windowClose.addEventListener("click", closeWindow);
        oDom.frame.addEventListener("load", function () {

            if (bIsClosing === true) {
                return;
            }

            setBusy(false);

            if (bInitialContentLoaded === true) {
                return;
            }

            bInitialContentLoaded = true;
            OptionPopupUtil.unlockAndShowWindow();

        });

        window.addEventListener("pagehide", markClosing);
        window.addEventListener("beforeunload", markClosing);
        window.addEventListener("pagehide", detachIpcEvents);
        window.addEventListener("beforeunload", detachIpcEvents);
        window.addEventListener("pagehide", detachWindowStateEvents);
        window.addEventListener("beforeunload", detachWindowStateEvents);

    }

    function markClosing() {

        if (bIsClosing === true) {
            return;
        }

        bIsClosing = true;
        window.__OPTION_POPUP_CLOSING = true;

        if (oAPP?.attr) {
            oAPP.attr.isClosing = true;
        }

        try {
            oBroadcast?.close();
        } catch (error) {
            return;
        }

    }

    function shouldIgnoreClosingError(error) {

        if (bIsClosing !== true) {
            return false;
        }

        const sMessage = String(error?.message || error || "");
        return sMessage.indexOf("Object has been destroyed") !== -1;

    }

    window.addEventListener("error", function (event) {
        if (shouldIgnoreClosingError(event.error || event.message) === true) {
            event.preventDefault();
            return true;
        }
    }, true);

    window.addEventListener("unhandledrejection", function (event) {
        if (shouldIgnoreClosingError(event.reason) === true) {
            event.preventDefault();
            return true;
        }
    }, true);

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

        try {

            const oWin = oAPP?.REMOTE?.getCurrentWindow?.() || oAPP?.CURRWIN;

            if (isDestroyedWindow(oWin) === true) {
                return;
            }

            return oWin;

        } catch (error) {
            return;
        }

    }

    function callWindowMethod(methodName) {

        const oWin = getCurrentWindow();

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

    function isBusy() {

        try {
            return oAPP?.fn?.getBusy?.() === true;
        } catch (error) {
            return false;
        }

    }

    function setWindowClosable(bClosable) {

        if (bIsClosing === true) {
            return;
        }

        const oWin = getCurrentWindow();

        if (!oWin) {
            return;
        }

        try {
            oWin.closable = bClosable;
        } catch (error) {
            return;
        }

    }

    function minimizeWindow() {

        callWindowMethod("minimize");

    }

    function toggleMaximizeWindow() {

        const oWin = getCurrentWindow();

        if (!oWin) {
            return;
        }

        try {

            if (typeof oWin.isMaximized === "function" && oWin.isMaximized() === true) {
                oWin.unmaximize?.();
                return;
            }

            oWin.maximize?.();

        } catch (error) {
            return;
        }

    }

    function closeWindow() {

        if (bIsClosing === true || isBusy() === true) {
            return;
        }

        markClosing();
        detachIpcEvents();
        detachWindowStateEvents();
        callWindowMethod("close");

    }

    function applyWindowMinimumSize() {

        const oWin = getCurrentWindow();

        if (!oWin) {
            return;
        }

        try {

            let iMinHeight = MIN_WINDOW_HEIGHT;

            if (typeof oWin.getMinimumSize === "function") {
                const aMinimumSize = oWin.getMinimumSize();
                iMinHeight = Array.isArray(aMinimumSize) && Number(aMinimumSize[1]) > 0 ? Math.max(MIN_WINDOW_HEIGHT, aMinimumSize[1]) : iMinHeight;
            }

            if (typeof oWin.setMinimumSize === "function") {
                oWin.setMinimumSize(MIN_WINDOW_WIDTH, iMinHeight);
            }

            if (typeof oWin.getSize === "function" && typeof oWin.setSize === "function") {
                const aSize = oWin.getSize();

                if (Array.isArray(aSize) && (aSize[0] < MIN_WINDOW_WIDTH || aSize[1] < iMinHeight)) {
                    oWin.setSize(Math.max(MIN_WINDOW_WIDTH, aSize[0]), Math.max(iMinHeight, aSize[1]));
                }
            }

        } catch (error) {
            return;
        }

    }

    function updateWindowState() {

        const oWin = getCurrentWindow();
        let bIsMaximized = false;

        if (!oWin || bIsClosing === true) {
            return;
        }

        try {
            bIsMaximized = typeof oWin.isMaximized === "function" && oWin.isMaximized() === true;
        } catch (error) {
            return;
        }

        const sText = text(bIsMaximized ? "RESTORE" : "MAXIMIZE");

        oDom.windowMaximize.classList.toggle("is-maximized", bIsMaximized);
        oDom.windowMaximize.setAttribute("aria-label", sText);
        oDom.windowMaximize.title = sText;
        window.OptionPopupIcon?.apply?.(
            oDom.windowMaximize.querySelector(".op-window-icon"),
            bIsMaximized ? window.OptionPopupIcon.ICONS.restore : window.OptionPopupIcon.ICONS.maximize
        );

    }

    function attachWindowStateEvents() {

        oCurrentWindow = getCurrentWindow();

        try {

            if (!oCurrentWindow || typeof oCurrentWindow.on !== "function") {
                return;
            }

            oCurrentWindow.on("maximize", updateWindowState);
            oCurrentWindow.on("unmaximize", updateWindowState);
            updateWindowState();

        } catch (error) {
            return;
        }

    }

    function detachWindowStateEvents() {

        if (!oCurrentWindow) {
            return;
        }

        try {

            if (isDestroyedWindow(oCurrentWindow) === true) {
                oCurrentWindow = null;
                return;
            }

            if (typeof oCurrentWindow.off === "function") {
                oCurrentWindow.off("maximize", updateWindowState);
                oCurrentWindow.off("unmaximize", updateWindowState);
                oCurrentWindow = null;
                return;
            }

            if (typeof oCurrentWindow.removeListener === "function") {
                oCurrentWindow.removeListener("maximize", updateWindowState);
                oCurrentWindow.removeListener("unmaximize", updateWindowState);
            }

            oCurrentWindow = null;

        } catch (error) {
            oCurrentWindow = null;
        }

    }

    function renderMenu() {

        const oFragment = document.createDocumentFragment();

        MENU_ITEMS.forEach(function (item) {

            const oButton = document.createElement("button");
            const sText = item.text || text(item.textKey);
            const sTooltip = item.tooltip || (item.tooltipKey ? text(item.tooltipKey) : sText);

            oButton.type = "button";
            oButton.className = "op-menu__item";
            oButton.dataset.key = item.key;
            oButton.setAttribute("aria-label", normalizeTooltipText(sTooltip));

            oButton.title = wrapTooltipText(sTooltip);

            const oIcon = document.createElement("span");
            oIcon.className = "op-menu__icon";
            window.OptionPopupIcon?.apply?.(oIcon, item.icon);

            const oText = document.createElement("span");
            oText.className = "op-menu__text";
            oText.textContent = sText;

            oButton.appendChild(oIcon);
            oButton.appendChild(oText);
            oButton.addEventListener("click", function () {
                loadMenu(item.key);
            });

            oFragment.appendChild(oButton);

        });

        oDom.menuList.replaceChildren(oFragment);

    }

    function loadMenu(key) {

        const oItem = MENU_ITEMS.find(function (item) {
            return item.key === key;
        });

        if (!oItem || sActiveKey === key) {
            return;
        }

        sActiveKey = key;

        Array.from(oDom.menuList.querySelectorAll(".op-menu__item")).forEach(function (button) {
            button.classList.toggle("is-active", button.dataset.key === key);
        });

        setBusy(true);
        oDom.frame.src = oItem.url;

    }

    function setBusy(bIsBusy, option) {

        if (bIsClosing === true) {
            return;
        }

        if (oAPP?.attr) {
            oAPP.attr.isBusy = bIsBusy;
        }

        oDom.busyOverlay.classList.toggle("is-active", bIsBusy === true);

        try {

            setWindowClosable(bIsBusy !== true);

            if (option?.ISBROAD !== true && oBroadcast) {
                oBroadcast.postMessage({ PRCCD: bIsBusy === true ? "BUSY_ON" : "BUSY_OFF" });
            }

        } catch (error) {
            return;
        }

    }

    function attachBroadcastEvent() {

        if (!oAPP?.BROWSKEY || typeof BroadcastChannel !== "function") {
            return;
        }

        oBroadcast = new BroadcastChannel(`broadcast-to-child-window_${oAPP.BROWSKEY}`);
        oAPP.broadToChild = oBroadcast;

        oBroadcast.onmessage = function (event) {

            const sProcessCode = event?.data?.PRCCD;

            if (sProcessCode === "BUSY_ON") {
                setBusy(true, { ISBROAD: true });
                return;
            }

            if (sProcessCode === "BUSY_OFF") {
                setBusy(false, { ISBROAD: true });
            }

        };

    }

    function onThemeChange() {

        const oThemeInfo = OptionPopupUtil.getThemeInfo();

        if (!oThemeInfo) {
            return;
        }

        OptionPopupUtil.applyThemeShell(oThemeInfo);

        try {
            oDom.frame.contentWindow?.postMessage({
                PRCCD: "THEME_CHANGE",
                DATA: oThemeInfo
            }, "*");
        } catch (error) {
            return;
        }

    }

    function onSelectionEffectChange(event, data) {

        try {
            oDom.frame.contentWindow?.postMessage({
                PRCCD: "SELECTION_EFFECT_CHANGE",
                DATA: data || {}
            }, "*");
        } catch (error) {
            return;
        }

    }

    /**
     * @since   2026-06-12 01:36:51
     * @version v3.6.4-4
     * @author  PES
     * @description
     * 메인에서 도움말 문서 다운로드 및 오픈 완료를 알려오면 옵션 팝업 Busy 상태를 해제한다.
     */
    function onOptionPopupMessage(event, data) {

        if (data?.PRCCD !== OptionPopupUtil.HELP_DOCUMENT_OPEN_PRCCD) {
            return;
        }

        setBusy(false);

    }

    function attachIpcEvents() {

        try {

            const sSysID = OptionPopupUtil.getSysId();

            if (!sSysID) {
                return;
            }

            if (typeof oAPP?.IPCMAIN?.on === "function") {
                oAPP.IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, onThemeChange);
                oAPP.IPCMAIN.on(`if-p13n-selectionEffectChange-${sSysID}`, onSelectionEffectChange);
            }

            if (typeof oAPP?.IPCRENDERER?.on === "function") {
                oAPP.IPCRENDERER.on(`if-optionPopup-${sSysID}`, onOptionPopupMessage);
            }

        } catch (error) {
            return;
        }

    }

    function detachIpcEvents() {

        try {

            const sSysID = OptionPopupUtil.getSysId();

            if (sSysID) {

                if (typeof oAPP?.IPCMAIN?.off === "function") {
                    oAPP.IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, onThemeChange);
                    oAPP.IPCMAIN.off(`if-p13n-selectionEffectChange-${sSysID}`, onSelectionEffectChange);
                }

                if (typeof oAPP?.IPCRENDERER?.off === "function") {
                    oAPP.IPCRENDERER.off(`if-optionPopup-${sSysID}`, onOptionPopupMessage);
                }

            }

        } catch (error) {
            return;
        }

        try {
            oBroadcast?.close();
        } catch (error) {
            return;
        }

    }

    document.addEventListener("DOMContentLoaded", init);

})();
