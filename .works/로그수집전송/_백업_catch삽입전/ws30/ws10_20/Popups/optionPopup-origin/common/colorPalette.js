/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * 색상 팔레트와 투명도 선택 팝업 UI를 제공한다.
 *
 */
(function (global) {
    "use strict";

    const MSG = {
        COLOR_PALETTE: ["ZMSG_WS_COMMON_001", "903"],
        CUSTOM_COLOR: ["ZMSG_WS_COMMON_001", "904"],
        HEX_INVALID: ["ZMSG_WS_COMMON_001", "905"],
        SWATCH_TOOLTIP: ["ZMSG_WS_COMMON_001", "896"],
        CUSTOM_COLOR_TOOLTIP: ["ZMSG_WS_COMMON_001", "897"],
        TRANSPARENCY_TOOLTIP: ["ZMSG_WS_COMMON_001", "898"],
        HEX_COLOR_TOOLTIP: ["ZMSG_WS_COMMON_001", "899"],
        CONFIRM_TOOLTIP: ["ZMSG_WS_COMMON_001", "900"],
        CANCEL_TOOLTIP: ["ZMSG_WS_COMMON_001", "901"],
        TRANSPARENCY: ["ZMSG_WS_COMMON_001", "717"],
        CANCEL: ["ZMSG_WS_COMMON_001", "003"],
        CONFIRM: ["ZMSG_WS_COMMON_001", "002"]
    };

    const PALETTE = [
        "#00a3ff", "#00c2a8", "#6fdd8b", "#f9c74f",
        "#ff7a45", "#e54b4b", "#b55cff", "#5a6acf",
        "#1d2b36", "#335c67", "#ffffff", "#000000"
    ];

    function msgText(cls, no) {

        const oAPP = global.OptionPopupUtil?.getApp?.();
        const aParams = Array.prototype.slice.call(arguments, 2);

        if (!cls || !no) {
            return "";
        }

        if (typeof global.OptionPopupUtil?.getMsgClsText === "function") {
            return global.OptionPopupUtil.getMsgClsText(
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

    function setTooltip(node, tooltip, setAria) {

        if (!node || !tooltip) {
            return;
        }

        node.title = wrapTooltipText(tooltip);

        if (setAria === true) {
            node.setAttribute("aria-label", normalizeTooltipText(tooltip));
        }

    }

    function injectStyle() {

        if (document.getElementById("op-color-palette-style")) {
            return;
        }

        const oStyle = document.createElement("style");
        oStyle.id = "op-color-palette-style";
        oStyle.textContent = `
            .op-palette__grid {
                display: grid;
                grid-template-columns: repeat(6, 30px);
                gap: 7px;
                margin-top: 12px;
            }
            .op-palette__swatch {
                width: 30px;
                height: 30px;
                border: 1px solid var(--opt-input-border);
                border-radius: 4px;
                cursor: pointer;
                background-image: linear-gradient(45deg, rgba(0,0,0,.08) 25%, transparent 25%),
                    linear-gradient(-45deg, rgba(0,0,0,.08) 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, rgba(0,0,0,.08) 75%),
                    linear-gradient(-45deg, transparent 75%, rgba(0,0,0,.08) 75%);
                background-size: 10px 10px;
                background-position: 0 0, 0 5px, 5px -5px, -5px 0;
            }
            .op-palette__custom {
                display: grid;
                grid-template-columns: auto 42px minmax(92px, 1fr);
                align-items: center;
                gap: 10px;
                margin-top: 14px;
                font-size: 12px;
            }
            .op-palette__custom input[type="color"] {
                width: 42px;
                height: 30px;
                padding: 0;
                border: 1px solid var(--opt-input-border);
                border-radius: 4px;
                background: var(--opt-input-bg);
            }
            .op-palette__hex,
            .op-palette__number {
                height: 30px;
                padding: 0 8px;
                border: 1px solid var(--opt-input-border);
                border-radius: 4px;
                background: var(--opt-input-bg);
                color: var(--opt-text-color);
                font: inherit;
                outline: none;
            }
            .op-palette__hex:focus,
            .op-palette__number:focus {
                border-color: var(--opt-primary-color);
                box-shadow: var(--opt-focus-shadow);
            }
            .op-palette__hex.is-error,
            .op-palette__number.is-error {
                border-color: #e54b4b;
                box-shadow: 0 0 0 2px rgba(229, 75, 75, .18);
            }
            .op-palette__alpha {
                display: grid;
                grid-template-columns: 62px 1fr auto;
                align-items: center;
                gap: 8px;
                margin-top: 12px;
                font-size: 12px;
            }
            .op-palette__number-wrap {
                display: grid;
                grid-template-columns: 48px auto;
                align-items: center;
                gap: 3px;
            }
            .op-palette__number {
                width: 48px;
                text-align: right;
            }
            .op-palette__suffix {
                color: var(--opt-muted-text-color);
                white-space: nowrap;
            }
            .op-palette__error {
                display: none;
                margin-top: 8px;
                color: #ff8a8a;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.4;
            }
            .op-palette__error.is-visible {
                display: block;
            }
            .op-palette__alpha input[type="range"] {
                width: 100%;
                height: 18px;
                background: transparent;
                cursor: pointer;
                -webkit-appearance: none;
                --op-palette-range-percent: 100%;
            }
            .op-palette__alpha input[type="range"]::-webkit-slider-runnable-track {
                height: 8px;
                border: 1px solid var(--opt-input-border);
                border-radius: 999px;
                background: linear-gradient(90deg, var(--opt-primary-color) 0 var(--op-palette-range-percent), var(--opt-slider-track-color, #9fb0c2) var(--op-palette-range-percent) 100%);
                box-shadow: inset 0 1px 2px rgba(15, 23, 42, .18);
            }
            .op-palette__alpha input[type="range"]::-webkit-slider-thumb {
                width: 16px;
                height: 16px;
                margin-top: -5px;
                border: 2px solid var(--opt-button-bg);
                border-radius: 50%;
                background: var(--opt-primary-color);
                box-shadow: 0 1px 5px rgba(15, 23, 42, .24);
                -webkit-appearance: none;
            }
        `;

        document.head.appendChild(oStyle);

    }

    function componentToHex(value) {

        const sHex = Math.max(0, Math.min(255, Number(value) || 0)).toString(16);
        return sHex.length === 1 ? `0${sHex}` : sHex;

    }

    function rgbToHex(color) {

        return `#${componentToHex(color.r)}${componentToHex(color.g)}${componentToHex(color.b)}`;

    }

    function hexToRgb(hex) {

        const sHex = String(hex || "").replace("#", "");

        if (sHex.length !== 6) {
            return { r: 0, g: 0, b: 0 };
        }

        return {
            r: parseInt(sHex.slice(0, 2), 16),
            g: parseInt(sHex.slice(2, 4), 16),
            b: parseInt(sHex.slice(4, 6), 16)
        };

    }

    function normalizeHex(hex) {

        let sHex = String(hex || "").trim();

        if (!sHex) {
            return "";
        }

        if (sHex.charAt(0) !== "#") {
            sHex = `#${sHex}`;
        }

        if (/^#[0-9a-fA-F]{3}$/.test(sHex)) {
            sHex = `#${sHex.charAt(1)}${sHex.charAt(1)}${sHex.charAt(2)}${sHex.charAt(2)}${sHex.charAt(3)}${sHex.charAt(3)}`;
        }

        if (/^#[0-9a-fA-F]{6}$/.test(sHex) === false) {
            return "";
        }

        return sHex.toLowerCase();

    }

    function clampNumber(value, min, max) {

        const iValue = Number(value);

        if (Number.isFinite(iValue) === false) {
            return min;
        }

        return Math.max(min, Math.min(max, Math.round(iValue)));

    }

    function updateRangeProgress(input) {

        const iMin = Number(input.min) || 0;
        const iMax = Number(input.max) || 100;
        const iValue = Number(input.value) || 0;
        const iRange = Math.max(1, iMax - iMin);
        const iPercent = Math.max(0, Math.min(100, ((iValue - iMin) / iRange) * 100));

        input.style.setProperty("--op-palette-range-percent", `${iPercent}%`);

    }

    function open(initialColor) {

        injectStyle();

        return new Promise(function (resolve) {

            const oPopup = global.OptionPopupPopup;
            const oUi = createBaseDialog(oPopup, text("COLOR_PALETTE"));
            let oSelected = Object.assign({ r: 0, g: 163, b: 255, a: 100 }, initialColor || {});

            function clearError() {
                oHex.classList.remove("is-error");
                oError.classList.remove("is-visible");
                oError.textContent = "";
            }

            function showError(message) {
                oHex.classList.add("is-error");
                oError.textContent = message;
                oError.classList.add("is-visible");
                oHex.focus();
                oHex.select();
            }

            function syncColor(color, option) {
                const oOption = option || {};

                oSelected = Object.assign(oSelected, color);
                oColor.value = rgbToHex(oSelected);

                if (oOption.keepHexValue !== true) {
                    oHex.value = oColor.value;
                }

                clearError();
            }

            function setAlpha(value) {
                const iValue = clampNumber(value, 0, 100);
                oSelected.a = iValue;
                oAlphaRange.value = String(iValue);
                oAlphaInput.value = String(iValue);
                oAlphaInput.classList.remove("is-error");
                updateRangeProgress(oAlphaRange);
            }

            const oGrid = document.createElement("div");
            oGrid.className = "op-palette__grid";

            PALETTE.forEach(function (hex) {

                const oButton = document.createElement("button");
                oButton.type = "button";
                oButton.className = "op-palette__swatch";
                oButton.style.backgroundColor = hex;
                setTooltip(oButton, `${hex} ${text("SWATCH_TOOLTIP")}`, true);
                oButton.addEventListener("click", function () {
                    syncColor(hexToRgb(hex));
                });

                oGrid.appendChild(oButton);

            });

            const oCustom = document.createElement("div");
            oCustom.className = "op-palette__custom";

            const oColorLabel = document.createElement("span");
            oColorLabel.textContent = text("CUSTOM_COLOR");
            setTooltip(oColorLabel, text("CUSTOM_COLOR_TOOLTIP"));

            const oColor = document.createElement("input");
            oColor.type = "color";
            oColor.value = rgbToHex(oSelected);
            setTooltip(oColor, text("CUSTOM_COLOR_TOOLTIP"), true);
            oColor.addEventListener("input", function () {
                syncColor(hexToRgb(oColor.value));
            });

            const oHex = document.createElement("input");
            oHex.className = "op-palette__hex";
            oHex.type = "text";
            oHex.value = rgbToHex(oSelected);
            oHex.placeholder = "#ffff00";
            setTooltip(oHex, text("HEX_COLOR_TOOLTIP"), true);
            oHex.addEventListener("input", function () {

                const sHex = normalizeHex(oHex.value);

                if (!sHex) {
                    oHex.classList.add("is-error");
                    return;
                }

                syncColor(hexToRgb(sHex), { keepHexValue: true });

            });

            oHex.addEventListener("blur", function () {

                const sHex = normalizeHex(oHex.value);

                if (!sHex) {
                    return;
                }

                syncColor(hexToRgb(sHex));

            });

            oCustom.appendChild(oColorLabel);
            oCustom.appendChild(oColor);
            oCustom.appendChild(oHex);

            const oError = document.createElement("div");
            oError.className = "op-palette__error";

            const oAlpha = document.createElement("div");
            oAlpha.className = "op-palette__alpha";

            const oAlphaLabel = document.createElement("span");
            oAlphaLabel.textContent = text("TRANSPARENCY");
            setTooltip(oAlphaLabel, text("TRANSPARENCY_TOOLTIP"));

            const oAlphaRange = document.createElement("input");
            oAlphaRange.type = "range";
            oAlphaRange.min = "0";
            oAlphaRange.max = "100";
            oAlphaRange.value = String(oSelected.a);
            setTooltip(oAlphaRange, text("TRANSPARENCY_TOOLTIP"), true);
            updateRangeProgress(oAlphaRange);

            const oAlphaValue = document.createElement("div");
            oAlphaValue.className = "op-palette__number-wrap";

            const oAlphaInput = document.createElement("input");
            oAlphaInput.className = "op-palette__number";
            oAlphaInput.type = "text";
            oAlphaInput.inputMode = "numeric";
            oAlphaInput.value = String(oAlphaRange.value);
            setTooltip(oAlphaInput, text("TRANSPARENCY_TOOLTIP"), true);

            const oAlphaSuffix = document.createElement("span");
            oAlphaSuffix.className = "op-palette__suffix";
            oAlphaSuffix.textContent = "%";
            setTooltip(oAlphaSuffix, text("TRANSPARENCY_TOOLTIP"));

            oAlphaValue.appendChild(oAlphaInput);
            oAlphaValue.appendChild(oAlphaSuffix);

            oAlphaRange.addEventListener("input", function () {
                setAlpha(oAlphaRange.value);
            });

            oAlphaInput.addEventListener("input", function () {
                const sValue = oAlphaInput.value.replace(/[^\d]/g, "");
                oAlphaInput.value = sValue;

                if (!sValue) {
                    oAlphaInput.classList.add("is-error");
                    return;
                }

                setAlpha(sValue);
            });

            oAlphaInput.addEventListener("keydown", function (event) {

                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                    return;
                }

                event.preventDefault();

                const iCurrent = oAlphaInput.value === "" ? Number(oSelected.a || 0) : Number(oAlphaInput.value);
                const iDelta = event.key === "ArrowUp" ? 1 : -1;

                setAlpha(iCurrent + iDelta);

            });

            oAlphaInput.addEventListener("blur", function () {
                setAlpha(oAlphaInput.value || "0");
            });

            oAlpha.appendChild(oAlphaLabel);
            oAlpha.appendChild(oAlphaRange);
            oAlpha.appendChild(oAlphaValue);

            oUi.body.appendChild(oGrid);
            oUi.body.appendChild(oCustom);
            oUi.body.appendChild(oAlpha);
            oUi.body.appendChild(oError);

            const oCancel = makeButton(text("CANCEL"), false);
            const oOk = makeButton(text("CONFIRM"), true);
            setTooltip(oCancel, text("CANCEL_TOOLTIP"), true);
            setTooltip(oOk, text("CONFIRM_TOOLTIP"), true);

            oCancel.addEventListener("click", function () {
                oUi.close();
                resolve(null);
            });

            oOk.addEventListener("click", function () {
                const sHex = normalizeHex(oHex.value);

                if (!sHex) {
                    showError(text("HEX_INVALID"));
                    return;
                }

                syncColor(hexToRgb(sHex));
                oUi.close();
                resolve(oSelected);
            });

            oUi.footer.appendChild(oOk);
            oUi.footer.appendChild(oCancel);

        });

    }

    function createBaseDialog(oPopup, title) {

        if (typeof oPopup?.createDialog === "function") {
            return oPopup.createDialog({ title: title, message: "" });
        }

        return createDialogElement(title);

    }

    function createDialogElement(title) {

        const oBackdrop = document.createElement("div");
        oBackdrop.className = "op-dialog-backdrop";

        const oDialog = document.createElement("div");
        oDialog.className = "op-dialog";

        const oHeader = document.createElement("div");
        oHeader.className = "op-dialog__header";
        oHeader.textContent = title;

        const oBody = document.createElement("div");
        oBody.className = "op-dialog__body";

        const oFooter = document.createElement("div");
        oFooter.className = "op-dialog__footer";

        oDialog.appendChild(oHeader);
        oDialog.appendChild(oBody);
        oDialog.appendChild(oFooter);
        oBackdrop.appendChild(oDialog);
        document.body.appendChild(oBackdrop);

        return {
            body: oBody,
            footer: oFooter,
            close: function () {
                oBackdrop.remove();
            }
        };

    }

    function makeButton(text, primary) {

        const oButton = document.createElement("button");
        oButton.type = "button";
        oButton.className = "op-dialog__button";
        oButton.textContent = text;

        if (primary) {
            oButton.classList.add("op-dialog__button--primary");
        }

        return oButton;

    }

    global.OptionPopupColorPalette = {
        open,
        rgbToHex,
        hexToRgb
    };

})(window);
