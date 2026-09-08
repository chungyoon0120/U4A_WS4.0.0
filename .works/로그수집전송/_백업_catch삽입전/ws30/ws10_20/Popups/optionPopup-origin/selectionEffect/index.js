/**
 * @since   2026-06-12 01:36:51
 * @version v3.6.4-3
 * @author  PES
 * @description
 * 선택 및 컨텍스트 효과 프리셋 편집, 미리보기, 저장을 처리한다.
 *
 */
(function () {
    "use strict";

    const NUMERIC_FIELDS = [
        "BORDER_R", "BORDER_G", "BORDER_B", "BORDER_A",
        "FILL_R", "FILL_G", "FILL_B", "FILL_A",
        "STRIPE_R", "STRIPE_G", "STRIPE_B", "STRIPE_A",
        "STRIPE_ANGLE", "STRIPE_GAP", "STRIPE_WIDTH"
    ];
    const PRESET_NAME_MAX_LENGTH = 40;

    const PALETTE_FIELD_MAP = {
        border: {
            r: "BORDER_R",
            g: "BORDER_G",
            b: "BORDER_B",
            a: "BORDER_A"
        },
        fill: {
            r: "FILL_R",
            g: "FILL_G",
            b: "FILL_B",
            a: "FILL_A"
        },
        stripe: {
            r: "STRIPE_R",
            g: "STRIPE_G",
            b: "STRIPE_B",
            a: "STRIPE_A"
        }
    };
    const GROUP_FIELDS = {
        border: ["BORDER_R", "BORDER_G", "BORDER_B", "BORDER_A", "BORDER_NEON"],
        fill: ["FILL_R", "FILL_G", "FILL_B", "FILL_A"],
        stripe: ["STRIPE_R", "STRIPE_G", "STRIPE_B", "STRIPE_A", "STRIPE_ANGLE", "STRIPE_GAP", "STRIPE_WIDTH"]
    };

    const HELP_MENU_ID = "000280";
    const MSG = {
        SETTINGS_TITLE: ["ZMSG_WS_COMMON_001", "823"],
        PREVIEW_TITLE: ["ZMSG_WS_COMMON_001", "824"],
        SELECTION_EFFECT: ["ZMSG_WS_COMMON_001", "827"],
        CONTEXT_EFFECT: ["ZMSG_WS_COMMON_001", "828"],
        DEFAULT_PRESET: ["ZMSG_WS_COMMON_001", "838"],
        RENAME_PRESET_TITLE: ["ZMSG_WS_COMMON_001", "839"],
        PRESET_NAME_REQUIRED: ["ZMSG_WS_COMMON_001", "840"],
        PRESET_NAME_DUPLICATE: ["ZMSG_WS_COMMON_001", "841"],
        PRESET_RENAMED: ["ZMSG_WS_COMMON_001", "842"],
        PRESET_SAVE_TITLE: ["ZMSG_WS_COMMON_001", "843"],
        PRESET_SAVE_MESSAGE: ["ZMSG_WS_COMMON_001", "844"],
        PRESET_DESC_PLACEHOLDER: ["ZMSG_WS_COMMON_001", "845"],
        PRESET_DESC_REQUIRED: ["ZMSG_WS_COMMON_001", "846"],
        USER_PRESET_UPDATE_CONFIRM_MESSAGE: ["ZMSG_WS_COMMON_001", "847"],
        MAPPING_SAVED: ["ZMSG_WS_COMMON_001", "848"],
        USER_PRESET_SAVED: ["ZMSG_WS_COMMON_001", "849"],
        USER_PRESET_UPDATED: ["ZMSG_WS_COMMON_001", "850"],
        USER_PRESET_DELETE_TITLE: ["ZMSG_WS_COMMON_001", "851"],
        USER_PRESET_DELETE_MESSAGE: ["ZMSG_WS_COMMON_001", "852"],
        USER_PRESET_DELETED: ["ZMSG_WS_COMMON_001", "853"],
        DEFAULT_PRESET_BLOCKED: ["ZMSG_WS_COMMON_001", "854"],
        SETTINGS_TITLE_TOOLTIP: ["ZMSG_WS_COMMON_001", "859"],
        BASIC_SETTINGS_TOOLTIP: ["ZMSG_WS_COMMON_001", "860"],
        TYPE_FIELD_TOOLTIP: ["ZMSG_WS_COMMON_001", "861"],
        PRESET_FIELD_TOOLTIP: ["ZMSG_WS_COMMON_001", "862"],
        COLOR_SETTINGS_TOOLTIP: ["ZMSG_WS_COMMON_001", "863"],
        RESET_COLORS_TOOLTIP: ["ZMSG_WS_COMMON_001", "864"],
        RESET_COLORS_DISABLED_TOOLTIP: ["ZMSG_WS_COMMON_001", "865"],
        BORDER_COLOR_TOOLTIP: ["ZMSG_WS_COMMON_001", "866"],
        FILL_COLOR_TOOLTIP: ["ZMSG_WS_COMMON_001", "867"],
        STRIPE_COLOR_TOOLTIP: ["ZMSG_WS_COMMON_001", "868"],
        BORDER_PALETTE_TOOLTIP: ["ZMSG_WS_COMMON_001", "869"],
        FILL_PALETTE_TOOLTIP: ["ZMSG_WS_COMMON_001", "870"],
        STRIPE_PALETTE_TOOLTIP: ["ZMSG_WS_COMMON_001", "871"],
        BORDER_NEON_TOOLTIP: ["ZMSG_WS_COMMON_001", "872"],
        SPLITTER_TOOLTIP: ["ZMSG_WS_COMMON_001", "873"],
        PREVIEW_TITLE_TOOLTIP: ["ZMSG_WS_COMMON_001", "874"],
        PREVIEW_STAGE_TOOLTIP: ["ZMSG_WS_COMMON_001", "875"],
        HELP_TOOLTIP: ["ZMSG_WS_COMMON_001", "876"],
        APPLY_BUTTON_TOOLTIP: ["ZMSG_WS_COMMON_001", "877"],
        DELETE_BUTTON_TOOLTIP: ["ZMSG_WS_COMMON_001", "878"],
        BORDER_R_TOOLTIP: ["ZMSG_WS_COMMON_001", "879"],
        BORDER_G_TOOLTIP: ["ZMSG_WS_COMMON_001", "880"],
        BORDER_B_TOOLTIP: ["ZMSG_WS_COMMON_001", "881"],
        BORDER_A_TOOLTIP: ["ZMSG_WS_COMMON_001", "882"],
        FILL_R_TOOLTIP: ["ZMSG_WS_COMMON_001", "883"],
        FILL_G_TOOLTIP: ["ZMSG_WS_COMMON_001", "884"],
        FILL_B_TOOLTIP: ["ZMSG_WS_COMMON_001", "885"],
        FILL_A_TOOLTIP: ["ZMSG_WS_COMMON_001", "886"],
        STRIPE_R_TOOLTIP: ["ZMSG_WS_COMMON_001", "887"],
        STRIPE_G_TOOLTIP: ["ZMSG_WS_COMMON_001", "888"],
        STRIPE_B_TOOLTIP: ["ZMSG_WS_COMMON_001", "889"],
        STRIPE_A_TOOLTIP: ["ZMSG_WS_COMMON_001", "890"],
        STRIPE_ANGLE_TOOLTIP: ["ZMSG_WS_COMMON_001", "891"],
        STRIPE_GAP_TOOLTIP: ["ZMSG_WS_COMMON_001", "892"],
        STRIPE_WIDTH_TOOLTIP: ["ZMSG_WS_COMMON_001", "893"],
        RENAME_PRESET_TOOLTIP: ["ZMSG_WS_COMMON_001", "894"],
        DEFAULT_PRESET_RENAME_BLOCKED: ["ZMSG_WS_COMMON_001", "895"],
        SAVE: ["ZMSG_WS_COMMON_001", "315"],
        CANCEL: ["ZMSG_WS_COMMON_001", "003"],
        CONFIRM: ["ZMSG_WS_COMMON_001", "002"],
        DELETE: ["ZMSG_WS_COMMON_001", "029"],
        DEF_SELECT_BLUE: ["ZMSG_WS_COMMON_001", "907"],
        DEF_SELECT_NEON: ["ZMSG_WS_COMMON_001", "908"],
        DEF_SELECT_STRIPE: ["ZMSG_WS_COMMON_001", "909"],
        DEF_CONTEXT_BLUE: ["ZMSG_WS_COMMON_001", "910"],
        DEF_CONTEXT_NEON: ["ZMSG_WS_COMMON_001", "911"]
    };
    const DEFAULT_PRESET_TEXT_KEYS = {
        DEF_SELECT_BLUE: "DEF_SELECT_BLUE",
        DEF_SELECT_NEON: "DEF_SELECT_NEON",
        DEF_SELECT_STRIPE: "DEF_SELECT_STRIPE",
        DEF_CONTEXT_BLUE: "DEF_CONTEXT_BLUE",
        DEF_CONTEXT_NEON: "DEF_CONTEXT_NEON"
    };
    const PALETTE_TOOLTIP_KEYS = {
        border: "BORDER_PALETTE_TOOLTIP",
        fill: "FILL_PALETTE_TOOLTIP",
        stripe: "STRIPE_PALETTE_TOOLTIP"
    };
    const SLIDER_TOOLTIP_KEYS = {
        BORDER_R: "BORDER_R_TOOLTIP",
        BORDER_G: "BORDER_G_TOOLTIP",
        BORDER_B: "BORDER_B_TOOLTIP",
        BORDER_A: "BORDER_A_TOOLTIP",
        FILL_R: "FILL_R_TOOLTIP",
        FILL_G: "FILL_G_TOOLTIP",
        FILL_B: "FILL_B_TOOLTIP",
        FILL_A: "FILL_A_TOOLTIP",
        STRIPE_R: "STRIPE_R_TOOLTIP",
        STRIPE_G: "STRIPE_G_TOOLTIP",
        STRIPE_B: "STRIPE_B_TOOLTIP",
        STRIPE_A: "STRIPE_A_TOOLTIP",
        STRIPE_ANGLE: "STRIPE_ANGLE_TOOLTIP",
        STRIPE_GAP: "STRIPE_GAP_TOOLTIP",
        STRIPE_WIDTH: "STRIPE_WIDTH_TOOLTIP"
    };

    const oDom = {
        layout: document.querySelector(".se-layout"),
        splitter: document.getElementById("selectionSplitter"),
        effectTypeSelect: document.getElementById("effectTypeSelect"),
        presetSelect: document.getElementById("presetSelect"),
        renamePresetButton: document.getElementById("renamePresetButton"),
        previewTarget: document.getElementById("previewTarget"),
        deleteButton: document.getElementById("deleteButton"),
        applyButton: document.getElementById("applyButton"),
        resetColorButton: document.getElementById("resetColorButton"),
        groupResetButtons: Array.from(document.querySelectorAll("[data-reset-group]")),
        neon: document.getElementById("borderNeon"),
        previewHelp: document.getElementById("previewHelpButton")
    };

    const oAPP = OptionPopupUtil.getApp();

    const oState = {
        sysid: "",
        effty: "",
        presets: [],
        selectedPreset: null,
        current: {},
        baseSignature: ""
    };

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

    function findMsgNode(no) {

        return document.querySelector(`[data-opt-msg-cls="ZMSG_WS_COMMON_001"][data-opt-msg-no="${no}"]`);

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

        if (setAria === true || node.matches?.("button, select, input, [role]")) {
            node.setAttribute("aria-label", normalizeTooltipText(tooltip));
        }

    }

    function escapeRegExp(value) {

        return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    }

    function prepareValueInputs() {

        document.querySelectorAll("output[data-output]").forEach(function (output) {

            const sField = output.dataset.output;
            const oSlider = document.querySelector(`[data-field="${sField}"]`);
            const sSuffix = oSlider?.dataset.suffix || "";
            const oWrap = document.createElement("div");
            const oInput = document.createElement("input");
            const oSuffix = document.createElement("span");

            oWrap.className = "se-value-control";
            oInput.className = "se-value-input";
            oInput.type = "text";
            oInput.inputMode = "numeric";
            oInput.dataset.valueInput = sField;
            oSuffix.className = "se-value-suffix";
            oSuffix.dataset.valueSuffix = sField;
            oSuffix.textContent = sSuffix;

            oWrap.appendChild(oInput);
            oWrap.appendChild(oSuffix);
            output.replaceWith(oWrap);

        });

    }

    function applyTooltips() {

        const oSettingsPanelTitle = document.querySelector(".se-settings .se-panel-title");
        const oBasicTitle = findMsgNode("825");
        const oColorTitle = findMsgNode("826");
        const oPreviewPanelTitle = document.querySelector(".se-preview-pane .se-panel-title");

        setTooltip(oSettingsPanelTitle, text("SETTINGS_TITLE_TOOLTIP"));
        setTooltip(oBasicTitle, text("BASIC_SETTINGS_TOOLTIP"));
        setTooltip(oColorTitle, text("COLOR_SETTINGS_TOOLTIP"));
        setTooltip(oDom.effectTypeSelect.closest(".se-field"), text("TYPE_FIELD_TOOLTIP"));
        setTooltip(oDom.effectTypeSelect, text("TYPE_FIELD_TOOLTIP"), true);
        setTooltip(oDom.presetSelect.closest(".se-field"), text("PRESET_FIELD_TOOLTIP"));
        setTooltip(oDom.presetSelect, text("PRESET_FIELD_TOOLTIP"), true);
        setTooltip(oDom.splitter, text("SPLITTER_TOOLTIP"), true);
        setTooltip(oPreviewPanelTitle, text("PREVIEW_TITLE_TOOLTIP"));
        setTooltip(oDom.previewHelp, text("HELP_TOOLTIP"), true);
        setTooltip(document.querySelector(".se-preview-stage"), text("PREVIEW_STAGE_TOOLTIP"));
        setTooltip(oDom.previewTarget, text("PREVIEW_STAGE_TOOLTIP"));
        setTooltip(oDom.applyButton, text("APPLY_BUTTON_TOOLTIP"), true);

        applyColorPanelTooltip("border", text("BORDER_COLOR_TOOLTIP"));
        applyColorPanelTooltip("fill", text("FILL_COLOR_TOOLTIP"));
        applyColorPanelTooltip("stripe", text("STRIPE_COLOR_TOOLTIP"));
        applySliderTooltips();

        setTooltip(oDom.neon.closest(".se-switch"), text("BORDER_NEON_TOOLTIP"));
        setTooltip(oDom.neon, text("BORDER_NEON_TOOLTIP"), true);
        updateResetState();

    }

    function applyColorPanelTooltip(group, tooltip) {

        const oButton = document.querySelector(`[data-palette="${group}"]`);
        const oPanel = oButton?.closest(".se-color-panel");

        setTooltip(oPanel, tooltip);
        setTooltip(oPanel?.querySelector("h3"), tooltip);
        setTooltip(oButton, text(PALETTE_TOOLTIP_KEYS[group]), true);

    }

    function applySliderTooltips() {

        document.querySelectorAll("input[type='range'][data-field]").forEach(function (input) {

            const sTooltip = text(SLIDER_TOOLTIP_KEYS[input.dataset.field]);
            const oRow = input.closest(".se-slider-row");
            const oValueInput = getValueInputByField(input.dataset.field);

            setTooltip(oRow, sTooltip);
            setTooltip(oRow?.querySelector("label"), sTooltip);
            setTooltip(input, sTooltip, true);
            setTooltip(oValueInput, sTooltip, true);

        });

    }

    function init() {

        OptionPopupUtil.applyThemeShell();
        OptionPopupUtil.applyText();
        prepareValueInputs();
        applyTooltips();
        OptionPopupUtil.applyHelpButtonAvailability(oDom.previewHelp);
        document.title = text("SETTINGS_TITLE");
        oState.sysid = OptionPopupUtil.getSysId();

        try {
            OptionPopupDB.getDb();
        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
            setBusy(false);
            return;
        }

        bindEvents();
        bindSplitter();
        renderEffectTypes();
        loadType(oDom.effectTypeSelect.value);

    }

    function bindEvents() {

        oDom.effectTypeSelect.addEventListener("change", function () {
            loadType(oDom.effectTypeSelect.value);
        });

        oDom.presetSelect.addEventListener("change", function () {
            selectPreset(oDom.presetSelect.value);
        });

        document.querySelectorAll("input[type='range'][data-field]").forEach(function (input) {

            input.addEventListener("input", function () {

                const sField = input.dataset.field;
                setFieldValue(sField, input.value);

            });

        });

        document.querySelectorAll(".se-value-input[data-value-input]").forEach(function (input) {

            input.addEventListener("keydown", function (event) {
                handleValueInputKeydown(event, input);
            });

            input.addEventListener("input", function () {
                setFieldValueFromInput(input);
            });

            input.addEventListener("blur", function () {
                normalizeValueInput(input);
            });

        });

        oDom.neon.addEventListener("change", function () {
            oState.current.BORDER_NEON = oDom.neon.checked ? "X" : "";
            updatePreview();
            updateDeleteState();
        });

        document.querySelectorAll("[data-palette]").forEach(function (button) {
            button.addEventListener("click", function () {
                openPalette(button.dataset.palette);
            });
        });

        oDom.groupResetButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                resetGroupSettings(button.dataset.resetGroup);
            });
        });

        oDom.renamePresetButton.addEventListener("click", renameCurrentPreset);
        oDom.resetColorButton.addEventListener("click", resetColorSettings);
        oDom.applyButton.addEventListener("click", applyCurrent);
        oDom.deleteButton.addEventListener("click", deleteCurrent);
        oDom.previewHelp.addEventListener("click", openPreviewHelp);

        window.addEventListener("message", function (event) {

            if (event?.data?.PRCCD === "THEME_CHANGE") {
                OptionPopupUtil.applyThemeShell(event.data.DATA);
                return;
            }

            if (event?.data?.PRCCD === "SELECTION_EFFECT_CHANGE") {
                syncSelectionEffectChange(event.data.DATA);
            }

        });

        window.addEventListener("pagehide", function () {
            OptionPopupDB.close();
        });

    }

    function syncSelectionEffectChange(data) {

        const sEffty = data?.EFFTY || oState.effty || oDom.effectTypeSelect.value;
        const sSelky = data?.SELKY || "";

        if (!sEffty) {
            return;
        }

        if (oDom.effectTypeSelect.value !== sEffty) {
            oDom.effectTypeSelect.value = sEffty;
        }

        try {
            loadType(sEffty, sSelky);
        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
        }

    }

    function openPreviewHelp() {

        OptionPopupUtil.openHelpDocument(HELP_MENU_ID);

    }

    function renderEffectTypes() {

        const aTypes = OptionPopupDB.getEffectTypes();
        const oFragment = document.createDocumentFragment();

        aTypes.forEach(function (type) {

            const oOption = document.createElement("option");
            oOption.value = type.EFFTY;
            oOption.textContent = getEffectTypeText(type);
            oFragment.appendChild(oOption);

        });

        oDom.effectTypeSelect.replaceChildren(oFragment);

    }

    function getEffectTypeText(type) {

        if (type.EFFTY === "SELECT") {
            return text("SELECTION_EFFECT");
        }

        if (type.EFFTY === "CONTEXT") {
            return text("CONTEXT_EFFECT");
        }

        return type.TEXT;

    }

    function loadType(effty, preferredSelky) {

        oState.effty = effty;
        oState.presets = OptionPopupDB.getPresets(effty);

        renderPresetOptions();

        const oMapping = OptionPopupDB.getMapping(oState.sysid, effty);
        const sSelky = preferredSelky || oMapping?.SELKY;
        const oSelected = oState.presets.find(function (preset) {
            return preset.SELKY === sSelky;
        }) || OptionPopupDB.getDefaultPreset(effty) || oState.presets[0];

        if (oSelected) {
            oDom.presetSelect.value = oSelected.SELKY;
            selectPreset(oSelected.SELKY);
        }

    }

    function renderPresetOptions() {

        const oFragment = document.createDocumentFragment();

        oState.presets.forEach(function (preset) {

            const oOption = document.createElement("option");
            oOption.value = preset.SELKY;
            oOption.textContent = getPresetOptionText(preset);
            oFragment.appendChild(oOption);

        });

        oDom.presetSelect.replaceChildren(oFragment);

    }

    function getPresetOptionText(preset) {

        if (preset.IS_DEFAULT !== "X") {
            return preset.SELTX;
        }

        const sDefaultText = text(DEFAULT_PRESET_TEXT_KEYS[preset.SELKY]) || preset.SELTX || text("DEFAULT_PRESET");
        const sDefaultSuffix = text("DEFAULT_PRESET");

        return `${sDefaultText} (${sDefaultSuffix})`;

    }

    function selectPreset(selky) {

        const oPreset = oState.presets.find(function (preset) {
            return preset.SELKY === selky;
        }) || OptionPopupDB.getPreset(selky);

        if (!oPreset) {
            return;
        }

        oState.selectedPreset = oPreset;
        oState.current = normalizePreset(oPreset);
        oState.baseSignature = makeSignature(oState.current);

        renderControls();
        updatePreview();
        updateDeleteState();

    }

    function normalizePreset(preset) {

        const oData = {
            SELKY: preset.SELKY,
            SELTX: preset.SELTX,
            EFFTY: preset.EFFTY,
            IS_DEFAULT: preset.IS_DEFAULT,
            BORDER_NEON: preset.BORDER_NEON === "X" || preset.BORDER_NEON === true ? "X" : ""
        };

        NUMERIC_FIELDS.forEach(function (field) {
            oData[field] = Number(preset[field]) || 0;
        });

        return oData;

    }

    function renderControls() {

        document.querySelectorAll("input[type='range'][data-field]").forEach(function (input) {
            input.value = String(oState.current[input.dataset.field]);
            updateSliderProgress(input);
            updateOutput(input.dataset.field);
        });

        oDom.neon.checked = oState.current.BORDER_NEON === "X";

    }

    function updateSliderProgress(input) {

        const iMin = Number(input.min) || 0;
        const iMax = Number(input.max) || 100;
        const iValue = Number(input.value) || 0;
        const iRange = Math.max(1, iMax - iMin);
        const iPercent = Math.max(0, Math.min(100, ((iValue - iMin) / iRange) * 100));

        input.style.setProperty("--se-slider-percent", `${iPercent}%`);

    }

    function bindSplitter() {

        if (!oDom.layout || !oDom.splitter) {
            return;
        }

        oDom.splitter.addEventListener("pointerdown", function (event) {

            event.preventDefault();
            oDom.layout.classList.add("is-resizing");
            oDom.splitter.setPointerCapture?.(event.pointerId);
            setSplitFromPointer(event);

            function onPointerMove(moveEvent) {
                setSplitFromPointer(moveEvent);
            }

            function onPointerUp(upEvent) {
                oDom.layout.classList.remove("is-resizing");
                oDom.splitter.releasePointerCapture?.(upEvent.pointerId);
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
                window.removeEventListener("pointercancel", onPointerUp);
            }

            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
            window.addEventListener("pointercancel", onPointerUp);

        });

        oDom.splitter.addEventListener("keydown", function (event) {

            const bStacked = isStackedLayout();
            const iStep = event.shiftKey ? 32 : 12;
            const sPositiveKey = bStacked ? "ArrowDown" : "ArrowRight";
            const sNegativeKey = bStacked ? "ArrowUp" : "ArrowLeft";

            if (event.key !== sPositiveKey && event.key !== sNegativeKey) {
                return;
            }

            event.preventDefault();
            setSplitSize(getCurrentSplitSize(bStacked) + (event.key === sPositiveKey ? iStep : -iStep), bStacked);

        });

        window.addEventListener("resize", function () {
            setSplitterOrientation();
            setSplitSize(getCurrentSplitSize(isStackedLayout()), isStackedLayout());
        });

        setSplitterOrientation();

    }

    function isStackedLayout() {

        return window.matchMedia("(max-width: 760px)").matches;

    }

    function setSplitterOrientation() {

        oDom.splitter.setAttribute("aria-orientation", isStackedLayout() ? "horizontal" : "vertical");

    }

    function getCurrentSplitSize(stacked) {

        const oRect = oDom.layout.getBoundingClientRect();
        const sValue = getComputedStyle(oDom.layout).getPropertyValue(stacked ? "--se-settings-height" : "--se-settings-width").trim();
        const iParsed = Number.parseFloat(sValue);

        if (Number.isFinite(iParsed) && sValue.endsWith("%")) {
            return (stacked ? oRect.height : oRect.width) * (iParsed / 100);
        }

        if (Number.isFinite(iParsed)) {
            return iParsed;
        }

        return stacked ? oRect.height * .52 : 384;

    }

    function setSplitFromPointer(event) {

        const bStacked = isStackedLayout();
        const oRect = oDom.layout.getBoundingClientRect();
        const iSize = bStacked ? event.clientY - oRect.top : event.clientX - oRect.left;

        setSplitSize(iSize, bStacked);

    }

    function setSplitSize(size, stacked) {

        const oRect = oDom.layout.getBoundingClientRect();
        const iSplitterSize = 8;
        const iMinSettings = stacked ? 220 : 280;
        const iMinPreview = stacked ? 220 : 280;
        const iMax = Math.max(iMinSettings, (stacked ? oRect.height : oRect.width) - iMinPreview - iSplitterSize);
        const iClamped = Math.max(iMinSettings, Math.min(iMax, Number(size) || iMinSettings));

        if (stacked) {
            oDom.layout.style.setProperty("--se-settings-height", `${iClamped}px`);
            oDom.splitter.setAttribute("aria-valuenow", String(Math.round(iClamped)));
            return;
        }

        oDom.layout.style.setProperty("--se-settings-width", `${iClamped}px`);
        oDom.splitter.setAttribute("aria-valuenow", String(Math.round(iClamped)));

    }

    function getSliderByField(field) {

        return document.querySelector(`[data-field="${field}"]`);

    }

    function getValueInputByField(field) {

        return document.querySelector(`[data-value-input="${field}"]`);

    }

    function clampFieldValue(field, value) {

        const oInput = getSliderByField(field);
        const iMin = Number(oInput?.min) || 0;
        const iMax = Number(oInput?.max) || 100;
        const iValue = Number(value);

        if (Number.isFinite(iValue) === false) {
            return iMin;
        }

        return Math.max(iMin, Math.min(iMax, Math.round(iValue)));

    }

    function setFieldValue(field, value) {

        const iValue = clampFieldValue(field, value);
        const oSlider = getSliderByField(field);
        const oValueInput = getValueInputByField(field);

        oState.current[field] = iValue;

        if (oSlider) {
            oSlider.value = String(iValue);
            updateSliderProgress(oSlider);
        }

        if (oValueInput) {
            oValueInput.value = String(iValue);
            oValueInput.classList.remove("is-error");
        }

        updateOutput(field);
        updatePreview();
        updateDeleteState();

    }

    function setFieldValueFromInput(input) {

        const sValue = input.value.replace(/[^\d]/g, "");

        input.value = sValue;

        if (!sValue) {
            input.classList.add("is-error");
            return;
        }

        setFieldValue(input.dataset.valueInput, sValue);

    }

    function handleValueInputKeydown(event, input) {

        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            return;
        }

        event.preventDefault();

        const sField = input.dataset.valueInput;
        const iCurrent = input.value === "" ? Number(oState.current[sField] || 0) : Number(input.value);
        const iDelta = event.key === "ArrowUp" ? 1 : -1;

        setFieldValue(sField, iCurrent + iDelta);

    }

    function normalizeValueInput(input) {

        if (!input.value) {
            setFieldValue(input.dataset.valueInput, 0);
            return;
        }

        setFieldValue(input.dataset.valueInput, input.value);

    }

    function updateOutput(field) {

        const oInput = getSliderByField(field);
        const oValueInput = getValueInputByField(field);
        const oSuffix = document.querySelector(`[data-value-suffix="${field}"]`);

        if (!oInput || !oValueInput) {
            return;
        }

        oValueInput.value = String(oState.current[field]);

        if (oSuffix) {
            oSuffix.textContent = oInput.dataset.suffix || "";
        }

    }

    function alpha(value) {
        return Math.max(0, Math.min(100, Number(value) || 0)) / 100;
    }

    function rgba(prefix) {

        return `rgba(${oState.current[`${prefix}_R`]}, ${oState.current[`${prefix}_G`]}, ${oState.current[`${prefix}_B`]}, ${alpha(oState.current[`${prefix}_A`])})`;

    }

    function updatePreview() {

        const sBorder = rgba("BORDER");
        const sFill = rgba("FILL");
        const sStripe = rgba("STRIPE");
        const iStripeAlpha = Number(oState.current.STRIPE_A) || 0;
        const iStripeWidth = Math.max(1, Number(oState.current.STRIPE_WIDTH) || 1);
        const iStripeGap = Math.max(iStripeWidth + 1, Number(oState.current.STRIPE_GAP) || iStripeWidth + 1);
        const iAngle = Number(oState.current.STRIPE_ANGLE) || 0;

        oDom.previewTarget.style.setProperty("--se-border-color", sBorder);
        oDom.previewTarget.style.setProperty("--se-fill-color", sFill);

        if (iStripeAlpha > 0) {
            oDom.previewTarget.style.setProperty(
                "--se-stripe-layer",
                `repeating-linear-gradient(${iAngle}deg, ${sStripe} 0 ${iStripeWidth}px, transparent ${iStripeWidth}px ${iStripeGap}px)`
            );
        } else {
            oDom.previewTarget.style.setProperty("--se-stripe-layer", "none");
        }

        if (oState.current.BORDER_NEON === "X") {
            oDom.previewTarget.style.setProperty(
                "--se-neon-shadow",
                `0 0 0 2px ${sBorder}, 0 0 16px 3px ${sBorder}, 0 0 30px 8px rgba(${oState.current.BORDER_R}, ${oState.current.BORDER_G}, ${oState.current.BORDER_B}, .42)`
            );
        } else {
            oDom.previewTarget.style.setProperty("--se-neon-shadow", "0 1px 4px rgba(15, 23, 42, .16)");
        }

    }

    function makeSignature(data) {

        const oPlain = {};

        NUMERIC_FIELDS.forEach(function (field) {
            oPlain[field] = Number(data[field]) || 0;
        });

        oPlain.BORDER_NEON = data.BORDER_NEON === "X" ? "X" : "";

        return JSON.stringify(oPlain);

    }

    function getSelectedPresetSignature() {

        let oPreset = oState.selectedPreset;

        try {
            oPreset = OptionPopupDB.getPreset(oState.selectedPreset?.SELKY) || oPreset;
        } catch (error) {
            oPreset = oState.selectedPreset;
        }

        return oPreset ? makeSignature(normalizePreset(oPreset)) : "";

    }

    function isDirty() {

        const sCurrentSignature = makeSignature(oState.current);

        if (sCurrentSignature === oState.baseSignature) {
            return false;
        }

        const sStoredSignature = getSelectedPresetSignature();

        if (sStoredSignature && sCurrentSignature === sStoredSignature) {
            oState.baseSignature = sStoredSignature;
            return false;
        }

        return true;

    }

    function isDefaultPreset() {
        return oState.selectedPreset?.IS_DEFAULT === "X" || oState.selectedPreset?.IS_DEFAULT === true;
    }

    function hasLocalChanges() {

        if (!oState.selectedPreset) {
            return false;
        }

        return makeSignature(oState.current) !== oState.baseSignature;

    }

    function hasGroupChanges(group) {

        const aFields = GROUP_FIELDS[group];
        const oPreset = oState.selectedPreset ? normalizePreset(oState.selectedPreset) : null;

        if (!aFields || !oPreset) {
            return false;
        }

        return aFields.some(function (field) {
            const vCurrent = field === "BORDER_NEON" ? (oState.current[field] || "") : Number(oState.current[field]) || 0;
            const vPreset = field === "BORDER_NEON" ? (oPreset[field] || "") : Number(oPreset[field]) || 0;
            return vCurrent !== vPreset;
        });

    }

    function updateResetState() {

        if (!oDom.resetColorButton) {
            return;
        }

        const bHasChanges = hasLocalChanges();
        const sTooltip = bHasChanges ? text("RESET_COLORS_TOOLTIP") : text("RESET_COLORS_DISABLED_TOOLTIP");

        oDom.resetColorButton.disabled = bHasChanges !== true;
        setTooltip(oDom.resetColorButton, sTooltip, true);

        oDom.groupResetButtons.forEach(function (button) {
            const bGroupChanged = hasGroupChanges(button.dataset.resetGroup);
            button.disabled = bGroupChanged !== true;
        });

    }

    function updateRenameState() {

        const bCanRename = oState.selectedPreset && isDefaultPreset() !== true;

        oDom.renamePresetButton.disabled = bCanRename !== true;
        setTooltip(
            oDom.renamePresetButton,
            bCanRename ? text("RENAME_PRESET_TOOLTIP") : text("DEFAULT_PRESET_RENAME_BLOCKED"),
            true
        );

    }

    function updateDeleteState() {

        oDom.deleteButton.disabled = isDefaultPreset();
        setTooltip(
            oDom.deleteButton,
            isDefaultPreset() ? text("DEFAULT_PRESET_BLOCKED") : text("DELETE_BUTTON_TOOLTIP"),
            true
        );
        updateResetState();
        updateRenameState();

    }

    function resetColorSettings() {

        if (!oState.selectedPreset) {
            return;
        }

        const oPreset = OptionPopupDB.getPreset(oState.selectedPreset.SELKY) || oState.selectedPreset;

        if (!oPreset) {
            return;
        }

        oState.selectedPreset = oPreset;
        oState.current = normalizePreset(oPreset);
        oState.baseSignature = makeSignature(oState.current);

        renderControls();
        updatePreview();
        updateDeleteState();

    }

    function resetGroupSettings(group) {

        const aFields = GROUP_FIELDS[group];
        const oPreset = oState.selectedPreset ? normalizePreset(oState.selectedPreset) : null;

        if (!aFields || !oPreset) {
            return;
        }

        aFields.forEach(function (field) {
            oState.current[field] = oPreset[field];
        });

        renderControls();
        updatePreview();
        updateDeleteState();

    }

    function validatePresetName(name, currentSelky) {

        const sName = String(name || "").trim();

        if (!sName) {
            return text("PRESET_NAME_REQUIRED");
        }

        const sCompare = sName.toLowerCase();
        const sDefaultSuffix = text("DEFAULT_PRESET");
        const oDefaultSuffixRegExp = new RegExp(`\\s*\\(${escapeRegExp(sDefaultSuffix)}\\)\\s*$`);
        const bDuplicate = oState.presets.some(function (preset) {

            const aNames = [
                preset.SELTX,
                getPresetOptionText(preset)
            ].filter(Boolean).map(function (name) {
                return String(name).replace(oDefaultSuffixRegExp, "").trim().toLowerCase();
            });

            return preset.SELKY !== currentSelky && aNames.indexOf(sCompare) !== -1;

        });

        return bDuplicate ? text("PRESET_NAME_DUPLICATE") : "";

    }

    async function renameCurrentPreset() {

        if (!oState.selectedPreset || isDefaultPreset() === true) {
            return;
        }

        const sSelky = oState.selectedPreset.SELKY;
        const sName = await OptionPopupPopup.prompt({
            title: text("RENAME_PRESET_TITLE"),
            value: oState.selectedPreset.SELTX || "",
            maxLength: PRESET_NAME_MAX_LENGTH,
            okText: text("SAVE"),
            cancelText: text("CANCEL"),
            primaryFirst: true,
            validate: function (value) {
                return validatePresetName(value, sSelky);
            }
        });

        if (sName === null) {
            return;
        }

        setBusy(true);

        try {

            const oUpdated = OptionPopupDB.renameUserPreset(sSelky, sName);

            oState.selectedPreset = Object.assign({}, oState.selectedPreset, {
                SELTX: oUpdated.SELTX
            });

            oState.presets = oState.presets.map(function (preset) {
                return preset.SELKY === sSelky ? Object.assign({}, preset, { SELTX: oUpdated.SELTX }) : preset;
            });

            renderPresetOptions();
            oDom.presetSelect.value = sSelky;
            updateDeleteState();
            OptionPopupPopup.toast(text("PRESET_RENAMED"));

        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
        } finally {
            setBusy(false);
        }

    }

    async function openPalette(group) {

        const oMap = PALETTE_FIELD_MAP[group];

        if (!oMap) {
            return;
        }

        const oColor = await OptionPopupColorPalette.open({
            r: oState.current[oMap.r],
            g: oState.current[oMap.g],
            b: oState.current[oMap.b],
            a: oState.current[oMap.a]
        });

        if (!oColor) {
            return;
        }

        oState.current[oMap.r] = oColor.r;
        oState.current[oMap.g] = oColor.g;
        oState.current[oMap.b] = oColor.b;
        oState.current[oMap.a] = oColor.a;

        renderControls();
        updatePreview();
        updateDeleteState();

    }

    function getDetailForSave() {

        const oDetail = {};

        NUMERIC_FIELDS.forEach(function (field) {
            oDetail[field] = Number(oState.current[field]) || 0;
        });

        oDetail.BORDER_NEON = oState.current.BORDER_NEON === "X" ? "X" : "";

        return oDetail;

    }

    function setBusy(busy) {

        if (typeof window.parent?.OptionPopupMain?.setBusy === "function") {
            window.parent.OptionPopupMain.setBusy(busy);
        }

    }

    function notifySelectionEffectChange(selky) {

        const sSysID = oState.sysid || OptionPopupUtil.getSysId();

        if (!sSysID) {
            return;
        }

        oAPP?.IPCRENDERER?.send?.(`if-p13n-selectionEffectChange-${sSysID}`, {
            SYSID: sSysID,
            EFFTY: oState.effty,
            SELKY: selky || oState.selectedPreset?.SELKY || ""
        });

    }

    async function applyCurrent() {

        if (!oState.selectedPreset) {
            return;
        }

        if (isDirty() === false) {

            setBusy(true);

            try {
                OptionPopupDB.saveMapping(oState.sysid, oState.effty, oState.selectedPreset.SELKY);
                notifySelectionEffectChange(oState.selectedPreset.SELKY);
                OptionPopupPopup.toast(text("MAPPING_SAVED"));
            } catch (error) {
                OptionPopupPopup.toast(error.message || String(error), 6000);
            } finally {
                setBusy(false);
            }

            return;

        }

        if (isDefaultPreset() === true) {
            await saveAsUserPreset();
            return;
        }

        await updateUserPreset();

    }

    async function saveAsUserPreset() {

        const sDesc = await OptionPopupPopup.prompt({
            title: text("PRESET_SAVE_TITLE"),
            message: text("PRESET_SAVE_MESSAGE"),
            placeholder: text("PRESET_DESC_PLACEHOLDER"),
            maxLength: PRESET_NAME_MAX_LENGTH,
            okText: text("SAVE"),
            cancelText: text("CANCEL"),
            primaryFirst: true,
            validate: function (value) {
                if (!value) {
                    return text("PRESET_DESC_REQUIRED");
                }

                return validatePresetName(value);
            }
        });

        if (sDesc === null) {
            return;
        }

        setBusy(true);

        try {

            const oSaved = OptionPopupDB.saveCustomPresetAndMapping(
                oState.sysid,
                oState.effty,
                sDesc,
                getDetailForSave()
            );

            loadType(oState.effty, oSaved.SELKY);
            notifySelectionEffectChange(oSaved.SELKY);
            OptionPopupPopup.toast(text("USER_PRESET_SAVED"));

        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
        } finally {
            setBusy(false);
        }

    }

    async function updateUserPreset() {

        const bConfirm = await OptionPopupPopup.confirm({
            title: text("CONFIRM"),
            message: text("USER_PRESET_UPDATE_CONFIRM_MESSAGE"),
            okText: text("CONFIRM"),
            cancelText: text("CANCEL")
        });

        if (bConfirm !== true) {
            return;
        }

        setBusy(true);

        try {

            const oUpdated = OptionPopupDB.updateUserPresetAndMapping(
                oState.sysid,
                oState.effty,
                oState.selectedPreset.SELKY,
                getDetailForSave()
            );

            loadType(oState.effty, oUpdated.SELKY);
            notifySelectionEffectChange(oUpdated.SELKY);
            OptionPopupPopup.toast(text("USER_PRESET_UPDATED"));

        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
        } finally {
            setBusy(false);
        }

    }

    async function deleteCurrent() {

        if (!oState.selectedPreset) {
            return;
        }

        if (isDefaultPreset()) {
            OptionPopupPopup.toast(text("DEFAULT_PRESET_BLOCKED"), 4000);
            updateDeleteState();
            return;
        }

        const bConfirm = await OptionPopupPopup.confirm({
            title: text("USER_PRESET_DELETE_TITLE"),
            message: text("USER_PRESET_DELETE_MESSAGE"),
            okText: text("DELETE"),
            cancelText: text("CANCEL"),
            primaryFirst: true
        });

        if (bConfirm !== true) {
            return;
        }

        setBusy(true);

        try {

            const oDefault = OptionPopupDB.deletePresetAndUseDefault(
                oState.sysid,
                oState.effty,
                oState.selectedPreset.SELKY
            );

            loadType(oState.effty, oDefault?.SELKY);
            notifySelectionEffectChange(oDefault?.SELKY);
            OptionPopupPopup.toast(text("USER_PRESET_DELETED"));

        } catch (error) {
            OptionPopupPopup.toast(error.message || String(error), 6000);
        } finally {
            setBusy(false);
        }

    }

    document.addEventListener("DOMContentLoaded", init);

})();
