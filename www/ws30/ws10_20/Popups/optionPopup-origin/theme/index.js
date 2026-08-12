/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * 테마 목록, 미리보기, 사용자별 테마 저장을 처리한다.
 *
 */
(function () {
    "use strict";

    const THEMES = [
        { key: "sap_horizon_dark", text: "sap_horizon_dark" },
        { key: "sap_horizon", text: "sap_horizon" },
        { key: "sap_fiori_3_dark", text: "sap_fiori_3_dark" },
        { key: "sap_fiori_3", text: "sap_fiori_3" },
        { key: "sap_belize_plus", text: "sap_belize_plus" },
        { key: "sap_belize", text: "sap_belize" }
    ];

    const HELP_MENU_ID = "000131";
    const oAPP = OptionPopupUtil.getApp();
    const MSG = {
        OPTIONS: ["/U4A/CL_WS_COMMON", "B52"],
        THEME_SETTINGS: ["/U4A/CL_WS_COMMON", "D22"]
    };

    const oDom = {
        select: document.getElementById("themeSelect"),
        preview: document.getElementById("themePreview"),
        apply: document.getElementById("applyTheme"),
        help: document.getElementById("themeHelpButton")
    };

    function msgText(cls, no) {

        const aParams = Array.prototype.slice.call(arguments, 2);
        const sMissingText = cls && no ? `${cls} ${no}` : "";

        if (!cls || !no) {
            return "";
        }

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

    function init() {

        OptionPopupUtil.applyThemeShell();
        OptionPopupUtil.applyText();
        OptionPopupUtil.applyHelpButtonAvailability(oDom.help);
        document.title = text("THEME_SETTINGS");
        renderThemeOptions();
        bindEvents();

        const oThemeInfo = OptionPopupUtil.getThemeInfo();
        const sTheme = oThemeInfo?.THEME || OptionPopupUtil.DEFAULT_THEME.THEME;

        oDom.select.value = sTheme;
        setPreview(sTheme);

    }

    function renderThemeOptions() {

        const oFragment = document.createDocumentFragment();

        THEMES.forEach(function (theme) {

            const oOption = document.createElement("option");
            oOption.value = theme.key;
            oOption.textContent = theme.text;
            oFragment.appendChild(oOption);

        });

        oDom.select.replaceChildren(oFragment);

    }

    function bindEvents() {

        oDom.select.addEventListener("change", function () {
            setPreview(oDom.select.value);
        });

        oDom.apply.addEventListener("click", applyTheme);
        oDom.help.addEventListener("click", openThemeHelp);

        window.addEventListener("message", function (event) {

            if (event?.data?.PRCCD !== "THEME_CHANGE") {
                return;
            }

            const sTheme = event.data.DATA?.THEME;

            if (!sTheme) {
                return;
            }

            oDom.select.value = sTheme;
            setPreview(sTheme);
            OptionPopupUtil.applyThemeShell(event.data.DATA);

        });

    }

    function setPreview(theme) {

        oDom.preview.src = `images/${theme}.png`;
        oDom.preview.alt = `${theme} preview`;

    }

    function getThemeFilePath() {

        const sSysID = OptionPopupUtil.getSysId() || oAPP?.IF_DATA?.SYSID;
        const oPath = OptionPopupUtil.getPath();

        return oPath.join(OptionPopupUtil.getP13nRoot(), "theme", `${sSysID}.json`);

    }

    function setBusy(busy) {

        if (typeof window.parent?.OptionPopupMain?.setBusy === "function") {
            window.parent.OptionPopupMain.setBusy(busy);
            return;
        }

        if (typeof oAPP?.fn?.setBusy === "function") {
            oAPP.fn.setBusy(busy);
        }

    }

    function openThemeHelp() {

        OptionPopupUtil.openHelpDocument(HELP_MENU_ID);

    }

    function applyTheme() {

        setBusy(true);

        try {

            const sTheme = oDom.select.value;
            const oSaveData = {
                THEME: sTheme,
                BGCOL: OptionPopupUtil.getThemeBackgroundColor(sTheme)
            };

            OptionPopupUtil.writeJson(getThemeFilePath(), oSaveData);

            const sSysID = OptionPopupUtil.getSysId() || oAPP?.IF_DATA?.SYSID;

            if (sSysID) {
                oAPP?.IPCRENDERER?.send?.(`if-p13n-themeChange-${sSysID}`, oSaveData);
            }

            OptionPopupUtil.applyThemeShell(oSaveData);

            const sOptionText = text("OPTIONS");
            const sSavedText = msgText("/U4A/MSG_WS", "330", sOptionText);

            OptionPopupPopup.toast(sSavedText);

        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 5000);
        } finally {
            setBusy(false);
        }

    }

    document.addEventListener("DOMContentLoaded", init);

})();
