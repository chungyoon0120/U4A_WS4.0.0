/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * SAP 및 U4A 아이콘 폰트를 로딩하고 아이콘 렌더링을 처리한다.
 *
 */
(function (global) {
    "use strict";

    const sScriptBaseUrl = document.currentScript?.src || location.href;

    const ICONS = {
        menu: "sap-icon://u4a-fw-solid/Bars",
        minimize: "sap-icon://u4a-fw-regular/Window Minimize",
        maximize: "sap-icon://u4a-fw-regular/Window Maximize",
        restore: "sap-icon://u4a-fw-regular/Window Restore",
        close: "sap-icon://u4a-fw-solid/Xmark",
        theme: "sap-icon://u4a-fw-solid/Palette",
        selectionEffect: "sap-icon://u4a-fw-solid/Fill Drip",
        help: "sap-icon://u4a-fw-regular/Circle Question",
        color: "sap-icon://u4a-fw-solid/Eye Dropper",
        resize: "sap-icon://u4a-fw-solid/Grip Vertical",
        apply: "sap-icon://u4a-fw-solid/Check",
        delete: "sap-icon://u4a-fw-regular/Trash Can",
        reset: "sap-icon://u4a-fw-solid/Arrow Rotate Left",
        edit: "sap-icon://u4a-fw-solid/Pen"
    };

    const FALLBACK_TEXT = {
        Bars: "M",
        "Window Minimize": "-",
        "Window Maximize": "□",
        "Window Restore": "□",
        Xmark: "x",
        Palette: "P",
        "Fill Drip": "F",
        "Circle Question": "?",
        "Eye Dropper": "C",
        "Arrow Rotate Left": "R",
        Pen: "E",
        "Arrows Left Right": "<>",
        "Grip Vertical": "::",
        Check: "OK",
        "Trash Can": "X"
    };

    const U4A_FONT_SETS = {
        "u4a-fw-regular": {
            fontFamily: "u4a_fw_regular",
            fileName: "u4a_fw_regular",
            jsonName: "u4a_fw_regular.json"
        },
        "u4a-fw-brands": {
            fontFamily: "u4a_fw_brands",
            fileName: "u4a_fw_brands",
            jsonName: "u4a_fw_brands.json"
        },
        "u4a-fw-solid": {
            fontFamily: "u4a_fw_solid",
            fileName: "u4a_fw_solid",
            jsonName: "u4a_fw_solid.json"
        }
    };

    const U4A_CODE_FALLBACK = {
        "u4a-fw-regular": {
            "Circle Question": "f059",
            "Trash Can": "f2ed",
            "Window Maximize": "f2d0",
            "Window Minimize": "f2d1",
            "Window Restore": "f2d2"
        },
        "u4a-fw-solid": {
            "Arrows Left Right": "f07e",
            "Arrow Rotate Left": "f0e2",
            Bars: "f0c9",
            Check: "f00c",
            "Eye Dropper": "f1fb",
            "Fill Drip": "f576",
            "Grip Vertical": "f58e",
            Palette: "f53f",
            Pen: "f304",
            Xmark: "f00d"
        }
    };

    const FONT_PATHS = {
        "SAP-icons": "sap/ui/core/themes/base/fonts",
        "SAP-icons-TNT": "sap/tnt/themes/base/fonts",
        BusinessSuiteInAppSymbols: "sap/ushell/themes/base/fonts"
    };

    const oLoadedFonts = {};
    const oU4AIconMaps = {};

    function injectBaseStyle() {

        if (document.getElementById("op-icon-font-style")) {
            return;
        }

        const oStyle = document.createElement("style");
        oStyle.id = "op-icon-font-style";
        oStyle.textContent = `
            .op-font-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                width: 1em;
                height: 1em;
                font-family: "SAP-icons";
                font-size: 16px;
                font-style: normal;
                font-weight: 400;
                line-height: 1;
                text-align: center;
                speak: none;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .op-font-icon.is-unresolved {
                width: auto;
                min-width: 1em;
                font-family: inherit;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0;
            }
        `;
        document.head.appendChild(oStyle);

    }

    function getSapWindow() {

        let oWin = global;

        for (let i = 0; i < 10 && oWin; i += 1) {

            try {

                if (oWin.sap?.ui) {
                    return oWin;
                }

                if (oWin.parent === oWin) {
                    return;
                }

                oWin = oWin.parent;

            } catch (error) {
                return;
            }

        }

    }

    function getPathModule() {

        try {
            return global.OptionPopupUtil?.getPath?.();
        } catch (error) {
            return;
        }

    }

    function getFsModule() {

        try {
            return global.OptionPopupUtil?.getFs?.();
        } catch (error) {
            return;
        }

    }

    function getPathInfo() {

        try {
            return global.OptionPopupUtil?.getPathInfo?.();
        } catch (error) {
            return;
        }

    }

    function pathToFileUrl(filePath) {

        if (!filePath) {
            return "";
        }

        return encodeURI(`file:///${String(filePath).replace(/\\/g, "/")}`);

    }

    function getU4AIconFileRoot() {

        const oFs = getFsModule();
        const oPath = getPathModule();
        const oPathInfo = getPathInfo();
        const aCandidates = [];

        if (oPathInfo?.U4AICON_ROOT) {
            aCandidates.push(oPathInfo.U4AICON_ROOT);
        }

        if (oPath && oPathInfo?.WS10_20_ROOT) {
            aCandidates.push(oPath.join(oPathInfo.WS10_20_ROOT, "icons", "u4a"));
        }

        if (!oFs?.existsSync) {
            return "";
        }

        for (let i = 0; i < aCandidates.length; i += 1) {

            try {

                if (oFs.existsSync(aCandidates[i]) === true) {
                    return aCandidates[i];
                }

            } catch (error) {
                continue;
            }

        }

        return "";

    }

    function getU4AIconUrlRoot() {

        const sFileRoot = getU4AIconFileRoot();

        if (sFileRoot) {
            return pathToFileUrl(sFileRoot);
        }

        return new URL("../../../icons/u4a/", sScriptBaseUrl).href.replace(/\/$/, "");

    }

    function readU4AIconMap(collection) {

        const oSet = U4A_FONT_SETS[collection];

        if (!oSet) {
            return;
        }

        if (oU4AIconMaps[collection]) {
            return oU4AIconMaps[collection];
        }

        const oFs = getFsModule();
        const oPath = getPathModule();
        const sFileRoot = getU4AIconFileRoot();
        let oMap;

        try {

            if (oFs?.existsSync && oPath && sFileRoot) {
                const sJsonPath = oPath.join(sFileRoot, oSet.jsonName);

                if (oFs.existsSync(sJsonPath) === true) {
                    oMap = JSON.parse(oFs.readFileSync(sJsonPath, "utf-8"));
                }
            }

        } catch (error) {
            oMap = null;
        }

        oU4AIconMaps[collection] = Object.assign({}, U4A_CODE_FALLBACK[collection] || {}, oMap || {});

        return oU4AIconMaps[collection];

    }

    function getU4AIconInfo(src) {

        const oParsed = parseIconSrc(src);
        const oSet = U4A_FONT_SETS[oParsed.collection];

        if (!oSet || !oParsed.name) {
            return;
        }

        const oMap = readU4AIconMap(oParsed.collection);
        const sCode = oMap?.[oParsed.name];

        if (!sCode) {
            return;
        }

        return {
            collection: oParsed.collection,
            fontFamily: oSet.fontFamily,
            content: String.fromCodePoint(parseInt(sCode, 16))
        };

    }

    function getIconPool() {

        const oSapWindow = getSapWindow();
        const oSap = oSapWindow?.sap;

        if (!oSap?.ui) {
            return;
        }

        try {

            if (oSap.ui.core?.IconPool) {
                return oSap.ui.core.IconPool;
            }

            if (typeof oSap.ui.requireSync === "function") {
                return oSap.ui.requireSync("sap/ui/core/IconPool");
            }

            oSapWindow.jQuery?.sap?.require?.("sap.ui.core.IconPool");
            return oSap.ui.core?.IconPool;

        } catch (error) {
            return;
        }

    }

    function toAbsoluteUrl(url, baseWindow) {

        if (!url) {
            return "";
        }

        try {
            return new URL(url, baseWindow?.location?.href || global.location.href).href;
        } catch (error) {
            return url;
        }

    }

    function getFontBaseUrl(fontFamily) {

        const oSapWindow = getSapWindow();
        const oSap = oSapWindow?.sap;
        const sPath = FONT_PATHS[fontFamily || "SAP-icons"];

        if (!sPath || typeof oSap?.ui?.require?.toUrl !== "function") {
            return "";
        }

        try {
            return toAbsoluteUrl(oSap.ui.require.toUrl(sPath), oSapWindow);
        } catch (error) {
            return "";
        }

    }

    function ensureFontFace(fontFamily) {

        const sFamily = fontFamily || "SAP-icons";

        if (oLoadedFonts[sFamily] === true) {
            return;
        }

        const oU4ASet = Object.keys(U4A_FONT_SETS).map(function (key) {
            return U4A_FONT_SETS[key];
        }).find(function (set) {
            return set.fontFamily === sFamily;
        });

        if (oU4ASet) {

            const sBaseUrl = getU4AIconUrlRoot();
            const oStyle = document.createElement("style");

            oStyle.id = `op-icon-face-${sFamily.replace(/[^a-z0-9_-]/gi, "-")}`;
            oStyle.textContent = `
                @font-face {
                    font-family: "${sFamily}";
                    src: url("${sBaseUrl}/${oU4ASet.fileName}.woff2") format("woff2");
                    font-weight: normal;
                    font-style: normal;
                }
            `;
            document.head.appendChild(oStyle);
            oLoadedFonts[sFamily] = true;
            return;

        }

        const sBaseUrl = getFontBaseUrl(sFamily);

        if (!sBaseUrl) {
            return;
        }

        const oStyle = document.createElement("style");
        const sEncodedFamily = encodeURIComponent(sFamily);

        oStyle.id = `op-icon-face-${sFamily.replace(/[^a-z0-9_-]/gi, "-")}`;
        oStyle.textContent = `
            @font-face {
                font-family: "${sFamily}";
                src:
                    url("${sBaseUrl}/${sEncodedFamily}.woff2") format("woff2"),
                    url("${sBaseUrl}/${sEncodedFamily}.woff") format("woff"),
                    url("${sBaseUrl}/${sEncodedFamily}.ttf") format("truetype");
                font-weight: normal;
                font-style: normal;
            }
        `;
        document.head.appendChild(oStyle);
        oLoadedFonts[sFamily] = true;

    }

    function parseIconSrc(src) {

        const sIcon = String(src || "").replace(/^sap-icon:\/\//, "");
        const aParts = sIcon.split("/");

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

    function getIconInfo(src) {

        const oU4AIconInfo = getU4AIconInfo(src);

        if (oU4AIconInfo) {
            return oU4AIconInfo;
        }

        const oParsed = parseIconSrc(src);
        const oIconPool = getIconPool();

        if (!oIconPool || !oParsed.name) {
            return;
        }

        try {
            return oParsed.collection ?
                oIconPool.getIconInfo(oParsed.name, oParsed.collection) :
                oIconPool.getIconInfo(oParsed.name);
        } catch (error) {
            return;
        }

    }

    function apply(node, src) {

        if (!node) {
            return;
        }

        const sSrc = src || node.dataset.sapIcon || "";
        const oParsed = parseIconSrc(sSrc);
        const oIconInfo = getIconInfo(sSrc);
        const sFontFamily = oIconInfo?.fontFamily || oParsed.collection || "SAP-icons";

        injectBaseStyle();
        node.classList.add("op-font-icon");
        node.setAttribute("aria-hidden", "true");
        node.dataset.sapIcon = sSrc;

        if (oIconInfo?.content) {
            ensureFontFace(sFontFamily);
            node.classList.remove("is-unresolved");
            node.style.fontFamily = `"${sFontFamily}"`;
            node.textContent = oIconInfo.content;
            return;
        }

        node.classList.add("is-unresolved");
        node.style.fontFamily = "";
        node.textContent = FALLBACK_TEXT[oParsed.name] || "";

    }

    function refresh(root) {

        injectBaseStyle();
        (root || document).querySelectorAll("[data-sap-icon]").forEach(function (node) {
            apply(node);
        });

    }

    global.OptionPopupIcon = {
        ICONS,
        apply,
        refresh,
        getIconInfo
    };

    document.addEventListener("DOMContentLoaded", function () {
        refresh();
    });

})(window);
