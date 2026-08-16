/**
 * @u4a-preview-js-callback-doc-version 2026-06-09
 *
 * Callback and function-expression comments are included so nested
 * handlers are documented with the same care as named functions.
 */
/**
 * @u4a-preview-js-source-doc-version 2026-06-09
 *
 * Additional source-flow comments were added inside function bodies.
 * They document branch checks, DOM writes, UI5 lifecycle hooks, async
 * scheduling, CustomData synchronization, and marker-layer geometry work.
 */
/**
 * @u4a-preview-js-doc-version 2026-06-09
 *
 * Preview runtime source map.
 *
 * This file runs inside the design preview iframe. It is responsible for
 * creating the rendered UI5 preview, wiring preview click/context-menu events
 * back to the parent workspace, applying design-time CustomData to rendered
 * controls, drawing the selection/context highlight overlay layers, and
 * handling UI-specific preview exceptions.
 *
 * Commenting policy for this file:
 * - Comments explain what each function owns and how its source flow is split.
 * - Behavior must not change; every added line is documentation only.
 * - Comments stay ASCII to avoid mixing encodings with existing legacy text.
 */
var oU4A = {};
oU4A.taskPromiseStack = [];
let G_CRITCAL_ERROR = "";

var oWS = {};
var u4a = {};

//================================================================
//#region Preview selection/context mark configuration
//================================================================
// Context menu and normal selection markers are drawn by detached layer DOMs
// sized to the target UI, so the selected control's DOM/layout stays untouched.
oWS.sMark = {};
oWS.sMark.contextStyleDefault = {
	borderColor: "#0084ff",
	borderOpacity: 1,
	borderWidth: 2,
	borderStyle: "solid",
	fillColor: "#0084ff",
	fillOpacity: 0.16,
	hatchLineColor: "#0084ff",
	hatchLineOpacity: 0,
	hatchLineAngle: 45,
	hatchLineGap: 32,
	hatchLineSize: 8,
	neon: false
};
oWS.sMark.selectionStyleDefault = {
	borderColor: "#0078ff",
	borderOpacity: 1,
	borderWidth: 2,
	borderStyle: "solid",
	fillColor: "#0078ff",
	fillOpacity: 0.08,
	hatchLineColor: "#0078ff",
	hatchLineOpacity: 0,
	hatchLineAngle: 45,
	hatchLineGap: 32,
	hatchLineSize: 8,
	neon: false
};
oWS.sMark.selectableAttr = "data-u4a-selectable";
oWS.sMark.selectedAttr = "data-u4a-selected";
oWS.sMark.contextAttr = "data-u4a-contextmenu";
oWS.sMark.selectedValue = "X";
/**
 * @since   2026-06-10 19:24:17
 * @version v3.6.4-3
 * @author  pes
 * @description
 * 미리보기 선택/컨텍스트 메뉴 마커 표시 여부를 관리하는 런타임 상태를 추가한다.
 * 선택 상태는 유지하고, 마커 표시용 클래스만 토글한다.
 */
oWS.sMark.hiddenClass = "u4a_preview_mark_hidden";
oWS.sMark.bMarkVisible = true;
oWS.sMark.tabIndexValue = "-1";
oWS.sMark.oSelectedUi = null;
oWS.sMark.oSelectionLayer = null;
oWS.sMark.bSelectionLayerEventBound = false;
oWS.sMark.iSelectionLayerRaf = 0;
oWS.sMark.oSelectionResizeObserver = null;
oWS.sMark.oSelectionIntersectionObserver = null;
oWS.sMark.oSelectionObservedDom = null;
oWS.sMark.bSelectionTargetIntersecting = true;
oWS.sMark.oContextUi = null;
oWS.sMark.oContextLayer = null;
oWS.sMark.iContextLayerRaf = 0;
oWS.sMark.bContextMenuOpen = false;
oWS.sMark.iContextMenuOpenSeq = 0;
oWS.sMark.oSelectionEffectIpcMain = null;
oWS.sMark.sSelectionEffectIpcChannel = "";
oWS.sMark.bSelectionEffectIpcAttached = false;
//#endregion

window.u4aRootParent = parent.parent;

//================================================================
//#region Preview selection style personalization
//================================================================
var U4A_SELECTION_EFFECT_MAP_TABLE = "WS_SELECTION_EFFECT_MAP";
var U4A_SELECTION_EFFECT_DETAIL_TABLE = "WS_SELECTION_EFFECT_DETAIL";

function getPreviewSelectionEffectHostValue(sName) {
	var aTargets = [];

	try {
		aTargets.push(parent);
	} catch (e) {}

	try {
		aTargets.push(parent.parent);
	} catch (e) {}

	aTargets.push(window);

	for (var i = 0; i < aTargets.length; i++) {
		try {
			if (typeof aTargets[i]?.[sName] !== "undefined") {
				return aTargets[i][sName];
			}
		} catch (e) {}
	}
}

function getPreviewSelectionEffectRequire() {
	var oRequire = getPreviewSelectionEffectHostValue("require");

	if (typeof oRequire === "function") {
		return oRequire;
	}

	try {
		var oRemote = getPreviewSelectionEffectHostValue("REMOTE");

		if (oRemote?.require) {
			return oRemote.require.bind(oRemote);
		}
	} catch (e) {}
}

function getPreviewSelectionEffectSysId() {
	try {
		if (parent?.process?.USERINFO?.SYSID) {
			return parent.process.USERINFO.SYSID;
		}
	} catch (e) {}

	try {
		if (parent?.oAPP?.attr?.metadata?.USERINFO?.SYSID) {
			return parent.oAPP.attr.metadata.USERINFO.SYSID;
		}
	} catch (e) {}

	try {
		if (u4aRootParent?.process?.USERINFO?.SYSID) {
			return u4aRootParent.process.USERINFO.SYSID;
		}
	} catch (e) {}

	return "";
}

function getPreviewSelectionEffectP13nRoot() {
	var oPathInfo = getPreviewSelectionEffectHostValue("PATHINFO");

	if (oPathInfo?.P13N_ROOT) {
		return oPathInfo.P13N_ROOT;
	}

	try {
		if (typeof parent?.getPath === "function") {
			return parent.getPath("P13N_ROOT");
		}
	} catch (e) {}

	try {
		var oPath = getPreviewSelectionEffectHostValue("PATH");
		var oRemote = getPreviewSelectionEffectHostValue("REMOTE");

		if (oPath && oRemote?.app?.getPath) {
			return oPath.join(oRemote.app.getPath("userData"), "p13n");
		}
	} catch (e) {}
}

function getPreviewSelectionEffectDbPath() {
	var oPath = getPreviewSelectionEffectHostValue("PATH");
	var sP13nRoot = getPreviewSelectionEffectP13nRoot();

	if (!oPath) {
		try {
			var oRequire = getPreviewSelectionEffectRequire();
			oPath = typeof oRequire === "function" ? oRequire("path") : null;
		} catch (e) {
			oPath = null;
		}
	}

	if (!oPath || !sP13nRoot) {
		return "";
	}

	return oPath.join(sP13nRoot, "selectionEffect", "SELECTION_EFFECT.db");
}

function openPreviewSelectionEffectDb() {
	try {
		var oFs = getPreviewSelectionEffectHostValue("FS");
		var sDbPath = getPreviewSelectionEffectDbPath();
		var oRequire = getPreviewSelectionEffectRequire();

		if (!oFs && typeof oRequire === "function") {
			oFs = oRequire("fs");
		}

		if (!oFs || !sDbPath || oFs.existsSync(sDbPath) !== true) {
			return null;
		}

		if (typeof oRequire !== "function") {
			return null;
		}

		var Database = oRequire("better-sqlite3");

		return new Database(sDbPath, {
			readonly: true,
			fileMustExist: true
		});
	} catch (e) {
		return null;
	}
}

function normalizePreviewSelectionEffectAlpha(vValue) {
	var fValue = parseFloat(vValue);

	if (isNaN(fValue)) {
		return 1;
	}

	if (fValue > 1) {
		fValue = fValue / 100;
	}

	return Math.max(0, Math.min(1, fValue));
}

function normalizePreviewSelectionEffectByte(vValue) {
	var iValue = parseInt(vValue, 10);

	if (isNaN(iValue)) {
		return 0;
	}

	return Math.max(0, Math.min(255, iValue));
}

function buildPreviewSelectionEffectRgb(iRed, iGreen, iBlue) {
	return "rgb(" +
		normalizePreviewSelectionEffectByte(iRed) + ", " +
		normalizePreviewSelectionEffectByte(iGreen) + ", " +
		normalizePreviewSelectionEffectByte(iBlue) +
		")";
}

function readPreviewSelectionEffectRow(sEffty) {
	var oDb = openPreviewSelectionEffectDb();

	if (!oDb) {
		return null;
	}

	try {
		var sSysID = getPreviewSelectionEffectSysId();
		var oMapping;
		var oRow;

		if (sSysID) {
			oMapping = oDb.prepare(
				"SELECT SELKY FROM " + U4A_SELECTION_EFFECT_MAP_TABLE + " WHERE SYSID = ? AND EFFTY = ?"
			).get(sSysID, sEffty);
		}

		if (oMapping?.SELKY) {
			oRow = oDb.prepare(
				"SELECT * FROM " + U4A_SELECTION_EFFECT_DETAIL_TABLE + " WHERE SELKY = ? AND EFFTY = ?"
			).get(oMapping.SELKY, sEffty);
		}

		if (!oRow) {
			oRow = oDb.prepare(
				"SELECT * FROM " + U4A_SELECTION_EFFECT_DETAIL_TABLE + " WHERE EFFTY = ? AND IS_DEFAULT = 'X' ORDER BY CRTDT, SELKY LIMIT 1"
			).get(sEffty);
		}

		return oRow || null;
	} catch (e) {
		return null;
	} finally {
		try {
			oDb.close();
		} catch (e) {}
	}
}

function convertSelectionEffectRowToPreviewConfig(oRow) {
	if (!oRow) {
		return null;
	}

	return {
		borderColor: buildPreviewSelectionEffectRgb(oRow.BORDER_R, oRow.BORDER_G, oRow.BORDER_B),
		borderOpacity: normalizePreviewSelectionEffectAlpha(oRow.BORDER_A),
		borderWidth: 2,
		borderStyle: "solid",
		fillColor: buildPreviewSelectionEffectRgb(oRow.FILL_R, oRow.FILL_G, oRow.FILL_B),
		fillOpacity: normalizePreviewSelectionEffectAlpha(oRow.FILL_A),
		hatchLineColor: buildPreviewSelectionEffectRgb(oRow.STRIPE_R, oRow.STRIPE_G, oRow.STRIPE_B),
		hatchLineOpacity: normalizePreviewSelectionEffectAlpha(oRow.STRIPE_A),
		hatchLineAngle: parseInt(oRow.STRIPE_ANGLE, 10) || 0,
		hatchLineGap: parseInt(oRow.STRIPE_GAP, 10) || 21,
		hatchLineSize: parseInt(oRow.STRIPE_WIDTH, 10) || 30,
		neon: oRow.BORDER_NEON === "X" || oRow.BORDER_NEON === true
	};
}

function applyPreviewSelectionEffectPersonalizationFromDb() {
	var oSelectionConfig = convertSelectionEffectRowToPreviewConfig(readPreviewSelectionEffectRow("SELECT"));
	var oContextConfig = convertSelectionEffectRowToPreviewConfig(readPreviewSelectionEffectRow("CONTEXT"));

	if (oSelectionConfig) {
		setPreviewRuntimePersonalization("previewSelectionPersonalization", "_u4aPreviewSelectionPersonalization", oSelectionConfig);
	}

	if (oContextConfig) {
		setPreviewRuntimePersonalization("previewContextMenuPersonalization", "_u4aPreviewContextMenuPersonalization", oContextConfig);
	}

	applyPreviewSelectionPersonalization();
	applyPreviewContextMenuPersonalization();
}

function onPreviewSelectionEffectChange() {
	applyPreviewSelectionEffectPersonalizationFromDb();
}

function attachPreviewSelectionEffectIpcEvent() {
	if (oWS.sMark.bSelectionEffectIpcAttached === true) {
		return;
	}

	var sSysID = getPreviewSelectionEffectSysId();

	if (!sSysID) {
		return;
	}

	try {
		var oIpcMain = getPreviewSelectionEffectHostValue("IPCMAIN");

		if (!oIpcMain) {
			var oRemote = getPreviewSelectionEffectHostValue("REMOTE");
			oIpcMain = oRemote?.require?.("electron")?.ipcMain;
		}

		if (!oIpcMain?.on) {
			return;
		}

		oWS.sMark.oSelectionEffectIpcMain = oIpcMain;
		oWS.sMark.sSelectionEffectIpcChannel = "if-p13n-selectionEffectChange-" + sSysID;
		oIpcMain.on(oWS.sMark.sSelectionEffectIpcChannel, onPreviewSelectionEffectChange);
		oWS.sMark.bSelectionEffectIpcAttached = true;
	} catch (e) {}
}

function detachPreviewSelectionEffectIpcEvent() {
	try {
		if (
			oWS.sMark.bSelectionEffectIpcAttached !== true ||
			!oWS.sMark.oSelectionEffectIpcMain?.off ||
			!oWS.sMark.sSelectionEffectIpcChannel
		) {
			return;
		}

		oWS.sMark.oSelectionEffectIpcMain.off(oWS.sMark.sSelectionEffectIpcChannel, onPreviewSelectionEffectChange);
		oWS.sMark.oSelectionEffectIpcMain = null;
		oWS.sMark.sSelectionEffectIpcChannel = "";
		oWS.sMark.bSelectionEffectIpcAttached = false;
	} catch (e) {}
}

window.addEventListener("pagehide", detachPreviewSelectionEffectIpcEvent);

/**
 * @u4a-doc
 * Returns persisted selection style settings when a personalization source is available.
 *
 * Source flow:
 * - Personalization storage is not wired yet, so this function safely checks only optional runtime holders.
 * - Missing personalization returns null and lets the default selection style remain active.
 */
function getPreviewSelectionPersonalization() {
	// @u4a-src Defines local state used by the following preview calculation.
	var oPers = null;

	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		oPers =
			window._u4aPreviewSelectionPersonalization ||
			parent?.oAPP?.attr?.previewSelectionPersonalization ||
			parent?.oAPP?.attr?.oPreviewSelectionPersonalization ||
			parent?.oAPP?.DATA?.APPDATA?.PREVIEW_SELECTION_PERSONALIZATION ||
			null;
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		oPers = null;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oPers || typeof oPers !== "object") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return null;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oPers;
}

/**
 * @u4a-doc
 * Merges the global default selection style with optional personalization values.
 *
 * Source flow:
 * - Defaults always exist so preview selection has deterministic styling.
 * - Personalization overrides only the keys it provides.
 * Parameters: oPers.
 */
function getPreviewSelectionStyleConfig(oPers) {
	// @u4a-src Defines local state used by the following preview calculation.
	var oConfig = {};
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oDefault = oWS.sMark.selectionStyleDefault || {};

	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	Object.keys(oDefault).forEach(function(sKey) {
		oConfig[sKey] = oDefault[sKey];
	});

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oPers && typeof oPers === "object") {
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		Object.keys(oPers).forEach(function(sKey) {
			if (Object.prototype.hasOwnProperty.call(oDefault, sKey) !== true) {
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof oPers[sKey] !== "undefined" && oPers[sKey] !== null && oPers[sKey] !== "") {
				oConfig[sKey] = oPers[sKey];
			}
		});
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oConfig;
}

/**
 * @u4a-doc
 * Normalizes pixel-like values for CSS variables.
 *
 * Source flow:
 * - Numeric values become px.
 * - String values with units are kept as-is.
 * Parameters: vValue, vDefault.
 */
function normalizePreviewSelectionCssLength(vValue, vDefault) {
	// @u4a-src Defines local state used by the following preview calculation.
	var vTarget = typeof vValue === "undefined" || vValue === null || vValue === "" ? vDefault : vValue;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof vTarget === "number" && isFinite(vTarget)) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return vTarget + "px";
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return String(vTarget);
}

/**
 * @u4a-doc
 * Normalizes opacity values to the 0-1 CSS alpha range.
 *
 * Source flow:
 * - Invalid opacity falls back to the provided default.
 * - Values outside the valid range are clamped.
 * Parameters: vValue, vDefault.
 */
function normalizePreviewSelectionOpacity(vValue, vDefault) {
	// @u4a-src Defines local state used by the following preview calculation.
	var fValue = parseFloat(vValue);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(fValue)) {
		fValue = parseFloat(vDefault);
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(fValue)) {
		fValue = 1;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return Math.max(0, Math.min(1, fValue));
}

/**
 * @u4a-doc
 * Converts a CSS color plus alpha into a CSS color value where possible.
 *
 * Source flow:
 * - Hex and comma-based rgb/rgba values can receive a separate opacity.
 * - CSS variables or named colors are returned as-is because their alpha cannot be derived safely.
 * Parameters: sColor, vOpacity.
 */
function buildPreviewSelectionColor(sColor, vOpacity) {
	// @u4a-src Defines local state used by the following preview calculation.
	var sValue = typeof sColor === "string" && sColor !== "" ? sColor.trim() : "#0078ff";
	// @u4a-src Defines local state used by the following preview calculation.
	var fOpacity = normalizePreviewSelectionOpacity(vOpacity, 1);
	// @u4a-src Defines local state used by the following preview calculation.
	var aMatch;
	// @u4a-src Defines local state used by the following preview calculation.
	var aParts;
	// @u4a-src Defines local state used by the following preview calculation.
	var iR;
	// @u4a-src Defines local state used by the following preview calculation.
	var iG;
	// @u4a-src Defines local state used by the following preview calculation.
	var iB;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sValue.charAt(0) === "#") {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (sValue.length === 4) {
			iR = parseInt(sValue.charAt(1) + sValue.charAt(1), 16);
			iG = parseInt(sValue.charAt(2) + sValue.charAt(2), 16);
			iB = parseInt(sValue.charAt(3) + sValue.charAt(3), 16);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isNaN(iR) || isNaN(iG) || isNaN(iB)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return sValue;
			}
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return "rgba(" + iR + ", " + iG + ", " + iB + ", " + fOpacity + ")";
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (sValue.length === 7) {
			iR = parseInt(sValue.substr(1, 2), 16);
			iG = parseInt(sValue.substr(3, 2), 16);
			iB = parseInt(sValue.substr(5, 2), 16);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isNaN(iR) || isNaN(iG) || isNaN(iB)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return sValue;
			}
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return "rgba(" + iR + ", " + iG + ", " + iB + ", " + fOpacity + ")";
		}
	}

	aMatch = sValue.match(/^rgba?\(([^)]+)\)$/i);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (aMatch) {
		aParts = aMatch[1].split(",");
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (aParts.length >= 3) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return "rgba(" + aParts[0].trim() + ", " + aParts[1].trim() + ", " + aParts[2].trim() + ", " + fOpacity + ")";
		}
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sValue;
}

function hasPreviewStyleConfigValue(oConfig, sKey) {
	return !!(
		oConfig &&
		typeof oConfig[sKey] !== "undefined" &&
		oConfig[sKey] !== null &&
		oConfig[sKey] !== ""
	);
}

function applyPreviewColorStyleProperty(oStyle, sCssVar, oConfig, oProvidedConfig, sColorKey, sOpacityKey, sDefaultColor, vDefaultOpacity) {
	var bHasColor = hasPreviewStyleConfigValue(oProvidedConfig, sColorKey);
	var bHasOpacity = hasPreviewStyleConfigValue(oProvidedConfig, sOpacityKey);
	var sColor;
	var vOpacity;

	if (!oStyle) {
		return;
	}

	if (bHasColor !== true && bHasOpacity !== true) {
		oStyle.removeProperty(sCssVar);
		return;
	}

	sColor = hasPreviewStyleConfigValue(oConfig, sColorKey) ? oConfig[sColorKey] : sDefaultColor;
	vOpacity = hasPreviewStyleConfigValue(oConfig, sOpacityKey) ? oConfig[sOpacityKey] : vDefaultOpacity;

	oStyle.setProperty(sCssVar, buildPreviewSelectionColor(sColor, vOpacity));
}

function applyPreviewLengthStyleProperty(oStyle, sCssVar, oConfig, oProvidedConfig, sKey, vDefault) {
	if (!oStyle) {
		return;
	}

	if (hasPreviewStyleConfigValue(oProvidedConfig, sKey) !== true) {
		oStyle.removeProperty(sCssVar);
		return;
	}

	oStyle.setProperty(sCssVar, normalizePreviewSelectionCssLength(oConfig[sKey], vDefault));
}

function normalizePreviewSelectionCssAngle(vValue, vDefault) {
	var vTarget = typeof vValue === "undefined" || vValue === null || vValue === "" ? vDefault : vValue;

	if (typeof vTarget === "number" && isFinite(vTarget)) {
		return vTarget + "deg";
	}

	return String(vTarget);
}

function applyPreviewAngleStyleProperty(oStyle, sCssVar, oConfig, oProvidedConfig, sKey, vDefault) {
	if (!oStyle) {
		return;
	}

	if (hasPreviewStyleConfigValue(oProvidedConfig, sKey) !== true) {
		oStyle.removeProperty(sCssVar);
		return;
	}

	oStyle.setProperty(sCssVar, normalizePreviewSelectionCssAngle(oConfig[sKey], vDefault));
}

function applyPreviewHatchStyleConfig(oStyle, sCssPrefix, oConfig, oProvidedConfig) {
	if (oStyle) {
		oStyle.removeProperty(sCssPrefix + "bg");
		oStyle.removeProperty(sCssPrefix + "border");
		oStyle.removeProperty(sCssPrefix + "inner");
		oStyle.removeProperty(sCssPrefix + "outer");
	}

	applyPreviewColorStyleProperty(oStyle, sCssPrefix + "line", oConfig, oProvidedConfig, "hatchLineColor", "hatchLineOpacity", "#0a6ed1", 0.18);
	applyPreviewAngleStyleProperty(oStyle, sCssPrefix + "angle", oConfig, oProvidedConfig, "hatchLineAngle", "135deg");
	applyPreviewLengthStyleProperty(oStyle, sCssPrefix + "gap", oConfig, oProvidedConfig, "hatchLineGap", 21);
	applyPreviewLengthStyleProperty(oStyle, sCssPrefix + "size", oConfig, oProvidedConfig, "hatchLineSize", 30);
}

function normalizePreviewStyleBoolean(vValue) {
	if (typeof vValue === "boolean") {
		return vValue;
	}

	if (typeof vValue === "number") {
		return vValue !== 0;
	}

	if (typeof vValue === "string") {
		var sValue = vValue.trim().toLowerCase();
		return sValue === "true" || sValue === "x" || sValue === "1" || sValue === "on" || sValue === "yes";
	}

	return false;
}

function applyPreviewNeonStyleConfig(oStyle, sCssPrefix, sColorCssVar, sWidthCssVar, bNeon, sAnimationName, bHasInsetBase) {
	var sColorToken = "var(" + sColorCssVar + ")";
	var sWidthToken = "var(" + sWidthCssVar + ")";
	var sBaseShadow = bHasInsetBase === true ? "inset 0 0 0 " + sWidthToken + " " + sColorToken : "none";

	if (!oStyle) {
		return;
	}

	if (bNeon !== true) {
		oStyle.setProperty(sCssPrefix + "layer-shadow", "none");
		oStyle.setProperty(sCssPrefix + "compact-shadow", "none");
		oStyle.setProperty(sCssPrefix + "layer-compact-shadow", "none");
		oStyle.setProperty(sCssPrefix + "pseudo-shadow", sBaseShadow);
		oStyle.setProperty(sCssPrefix + "popup-shadow", "none");
		oStyle.setProperty(sCssPrefix + "native-shadow", sBaseShadow);
		oStyle.setProperty(sCssPrefix + "native-filter", "none");
		oStyle.setProperty(sCssPrefix + "layer-animation", "none");
		oStyle.setProperty(sCssPrefix + "compact-animation", "none");
		oStyle.setProperty(sCssPrefix + "layer-compact-animation", "none");
		oStyle.setProperty(sCssPrefix + "pseudo-animation", "none");
		oStyle.setProperty(sCssPrefix + "popup-animation", "none");
		oStyle.setProperty(sCssPrefix + "native-animation", "none");
		return;
	}

	oStyle.setProperty(sCssPrefix + "layer-shadow", "0 0 0 1px " + sColorToken + ", 0 0 10px " + sColorToken + ", 0 0 22px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "compact-shadow", "0 0 0 1px " + sColorToken + ", 0 0 8px " + sColorToken + ", 0 0 18px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "layer-compact-shadow", "0 0 0 1px " + sColorToken + ", 0 0 8px " + sColorToken + ", 0 0 18px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "pseudo-shadow", "inset 0 0 0 " + sWidthToken + " " + sColorToken + ", 0 0 10px " + sColorToken + ", 0 0 22px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "popup-shadow", "0 0 10px " + sColorToken + ", 0 0 22px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "native-shadow", "inset 0 0 0 " + sWidthToken + " " + sColorToken + ", 0 0 10px " + sColorToken + ", 0 0 22px " + sColorToken);
	oStyle.setProperty(sCssPrefix + "native-filter", "drop-shadow(0 0 6px " + sColorToken + ")");
	oStyle.setProperty(sCssPrefix + "layer-animation", sAnimationName + " 1.6s ease-in-out infinite");
	oStyle.setProperty(sCssPrefix + "compact-animation", sAnimationName + " 1.6s ease-in-out infinite");
	oStyle.setProperty(sCssPrefix + "layer-compact-animation", sAnimationName + " 1.6s ease-in-out infinite");
	oStyle.setProperty(sCssPrefix + "pseudo-animation", sAnimationName + " 1.6s ease-in-out infinite");
	oStyle.setProperty(sCssPrefix + "popup-animation", sAnimationName + " 1.6s ease-in-out infinite");
	oStyle.setProperty(sCssPrefix + "native-animation", sAnimationName + " 1.6s ease-in-out infinite");
}

function getPreviewContextMenuPersonalization() {
	var oPers = null;

	try {
		oPers =
			window._u4aPreviewContextMenuPersonalization ||
			parent?.oAPP?.attr?.previewContextMenuPersonalization ||
			parent?.oAPP?.attr?.oPreviewContextMenuPersonalization ||
			parent?.oAPP?.DATA?.APPDATA?.PREVIEW_CONTEXT_MENU_PERSONALIZATION ||
			parent?.oAPP?.DATA?.APPDATA?.PREVIEW_CONTEXT_PERSONALIZATION ||
			null;
	} catch (e) {
		oPers = null;
	}

	if (!oPers || typeof oPers !== "object") {
		return null;
	}

	return oPers;
}

function getPreviewContextMenuStyleConfig(oPers) {
	var oConfig = {};
	var oDefault = oWS.sMark.contextStyleDefault || {};

	Object.keys(oDefault).forEach(function(sKey) {
		oConfig[sKey] = oDefault[sKey];
	});

	if (oPers && typeof oPers === "object") {
		Object.keys(oPers).forEach(function(sKey) {
			if (Object.prototype.hasOwnProperty.call(oDefault, sKey) !== true) {
				return;
			}

			if (typeof oPers[sKey] !== "undefined" && oPers[sKey] !== null && oPers[sKey] !== "") {
				oConfig[sKey] = oPers[sKey];
			}
		});
	}

	return oConfig;
}

function applyPreviewContextMenuPersonalization() {
	var oPers = getPreviewContextMenuPersonalization();
	var oConfig = getPreviewContextMenuStyleConfig(oPers);
	var oRootStyle = document.documentElement.style;

	applyPreviewColorStyleProperty(
		oRootStyle,
		"--u4a-preview-context-color",
		oConfig,
		oPers,
		"borderColor",
		"borderOpacity",
		"#0084ff",
		1
	);
	applyPreviewColorStyleProperty(oRootStyle, "--u4a-preview-context-bg", oConfig, oPers, "fillColor", "fillOpacity", "#0084ff", 0.16);
	applyPreviewLengthStyleProperty(oRootStyle, "--u4a-preview-context-width", oConfig, oPers, "borderWidth", 2);
	oRootStyle.setProperty("--u4a-preview-context-border-style", oConfig.borderStyle || "solid");
	applyPreviewHatchStyleConfig(oRootStyle, "--u4a-preview-context-hatch-", oConfig, oPers);
	applyPreviewNeonStyleConfig(
		oRootStyle,
		"--u4a-preview-context-",
		"--u4a-preview-context-color",
		"--u4a-preview-context-width",
		normalizePreviewStyleBoolean(oConfig.neon),
		"u4aPreviewContextNeonPulse",
		true
	);

	if (oWS.sMark.bContextMenuOpen === true) {
		requestPreviewContextLayerUpdate();
	}
}

/**
 * @u4a-doc
 * Applies selection style settings to preview CSS variables.
 *
 * Source flow:
 * - Uses global defaults when personalization is missing.
 * - Writes variables to documentElement so selection layer and data-u4a-selected fallback rules use the same values.
 */
function applyPreviewSelectionPersonalization() {
	// @u4a-src Defines local state used by the following preview calculation.
	var oPers = getPreviewSelectionPersonalization();
	// @u4a-src Defines local state used by the following preview calculation.
	var oConfig = getPreviewSelectionStyleConfig(oPers);
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oRootStyle = document.documentElement.style;
	// @u4a-src Defines local state used by the following preview calculation.
	var sBorderColor = buildPreviewSelectionColor(oConfig.borderColor, oConfig.borderOpacity);
	// @u4a-src Defines local state used by the following preview calculation.
	var sFillColor = buildPreviewSelectionColor(oConfig.fillColor, oConfig.fillOpacity);

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oRootStyle.setProperty("--u4a-preview-selection-border-color", sBorderColor);
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oRootStyle.setProperty("--u4a-preview-selection-width", normalizePreviewSelectionCssLength(oConfig.borderWidth, 2));
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oRootStyle.setProperty("--u4a-preview-selection-border-style", oConfig.borderStyle || "solid");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oRootStyle.setProperty("--u4a-preview-selection-bg", sFillColor);
	applyPreviewHatchStyleConfig(oRootStyle, "--u4a-preview-selection-hatch-", oConfig, oPers);
	applyPreviewNeonStyleConfig(
		oRootStyle,
		"--u4a-preview-selection-",
		"--u4a-preview-selection-border-color",
		"--u4a-preview-selection-width",
		normalizePreviewStyleBoolean(oConfig.neon),
		"u4aPreviewSelectionNeonPulse",
		true
	);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectedUi) {
		requestPreviewSelectionLayerUpdate();
	}
}

function setPreviewRuntimePersonalization(sAttrName, sWindowName, oConfig) {
	var oTarget = oConfig && typeof oConfig === "object" ? oConfig : {};

	window[sWindowName] = oTarget;

	try {
		if (parent?.oAPP?.attr) {
			parent.oAPP.attr[sAttrName] = oTarget;
		}
	} catch (e) {}

	return oTarget;
}

/**
 * @since   2026-06-10 19:24:17
 * @version v3.6.4-3
 * @author  pes
 * @description
 * 미리보기 툴바 스위치에서 호출하는 마커 표시 제어 API를 제공한다.
 * u4aSetPreviewMarkVisible()은 루트 CSS 클래스를 토글하여 선택/컨텍스트
 * 메뉴 마커를 표시 규칙으로 숨기며, 선택된 UI 상태는 제거하지 않는다.
 */
function normalizePreviewMarkVisibleState(vValue) {
	if (typeof vValue === "boolean") {
		return vValue;
	}

	if (typeof vValue === "number") {
		return vValue !== 0;
	}

	if (typeof vValue === "string") {
		var sValue = vValue.trim().toLowerCase();
		return !(sValue === "false" || sValue === "0" || sValue === "" || sValue === "off" || sValue === "n");
	}

	return true;
}

function getPreviewMarkVisiblePersonalization() {
	try {
		if (typeof parent?.oAPP?.attr?.previewMarkVisible !== "undefined") {
			return normalizePreviewMarkVisibleState(parent.oAPP.attr.previewMarkVisible);
		}
	} catch (e) {}

	if (typeof window._u4aPreviewMarkVisible !== "undefined") {
		return normalizePreviewMarkVisibleState(window._u4aPreviewMarkVisible);
	}

	return true;
}

function applyPreviewMarkVisibility(bVisible) {
	var bState = normalizePreviewMarkVisibleState(bVisible);
	var oRoot = document.documentElement;

	oWS.sMark.bMarkVisible = bState;

	if (oRoot && oRoot.classList) {
		oRoot.classList.toggle(oWS.sMark.hiddenClass, bState !== true);
	}

	return bState;
}

window.u4aSetPreviewMarkVisible = function(bVisible) {
	var bState = normalizePreviewMarkVisibleState(bVisible);

	window._u4aPreviewMarkVisible = bState;

	try {
		if (parent?.oAPP?.attr) {
			parent.oAPP.attr.previewMarkVisible = bState;
		}
	} catch (e) {}

	return applyPreviewMarkVisibility(bState);
};

window.u4aGetPreviewMarkVisible = function() {
	return oWS.sMark.bMarkVisible;
};

window.u4aSetPreviewSelectionStyle = function(oConfig) {
	setPreviewRuntimePersonalization("previewSelectionPersonalization", "_u4aPreviewSelectionPersonalization", oConfig);
	applyPreviewSelectionPersonalization();
	return getPreviewSelectionStyleConfig(getPreviewSelectionPersonalization());
};

window.u4aGetPreviewSelectionStyle = function() {
	return getPreviewSelectionStyleConfig(getPreviewSelectionPersonalization());
};

window.u4aResetPreviewSelectionStyle = function() {
	setPreviewRuntimePersonalization("previewSelectionPersonalization", "_u4aPreviewSelectionPersonalization", {});
	applyPreviewSelectionPersonalization();
	return getPreviewSelectionStyleConfig(getPreviewSelectionPersonalization());
};

window.u4aSetPreviewContextMenuStyle = function(oConfig) {
	setPreviewRuntimePersonalization("previewContextMenuPersonalization", "_u4aPreviewContextMenuPersonalization", oConfig);
	applyPreviewContextMenuPersonalization();
	return getPreviewContextMenuStyleConfig(getPreviewContextMenuPersonalization());
};

window.u4aGetPreviewContextMenuStyle = function() {
	return getPreviewContextMenuStyleConfig(getPreviewContextMenuPersonalization());
};

window.u4aResetPreviewContextMenuStyle = function() {
	setPreviewRuntimePersonalization("previewContextMenuPersonalization", "_u4aPreviewContextMenuPersonalization", {});
	applyPreviewContextMenuPersonalization();
	return getPreviewContextMenuStyleConfig(getPreviewContextMenuPersonalization());
};
//#endregion

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * Parameters: oEvent.
 */
window.oncontextmenu = function(oEvent) {
	setUiContextMenu(oEvent);
	return false;
};
/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: e, t, n, a, o.
 */
window.onerror = function(e, t, n, a, o) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (G_CRITCAL_ERROR === "X") {

		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.designAreaLockUnlock();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Schedules preview work to run outside the current browser event frame.
	/**
	 * @u4a-doc
	 * Timer/frame callback used to defer preview work until the browser can update safely.
	 */
	setTimeout(() => {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e);
	}, 0);
	G_CRITCAL_ERROR = "X";
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof e !== "undefined" && e !== "") {
		l_msg = l_msg + " \n " + " \n " + e + " \n ";
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.parent.showCriticalErrorDialog(l_msg);

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.designAreaLockUnlock();
};
/**
 * @u4a-doc
 * Promise rejection boundary for async preview code.
 * Converts unhandled rejections into the same critical-error flow as synchronous errors.
 */
window.addEventListener("unhandledrejection", function(e) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (G_CRITCAL_ERROR === "X") {

		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.designAreaLockUnlock();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Schedules preview work to run outside the current browser event frame.
	/**
	 * @u4a-doc
	 * Timer/frame callback used to defer preview work until the browser can update safely.
	 */
	setTimeout(() => {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e.reason.stack);
	}, 0);
	G_CRITCAL_ERROR = "X";
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof e.reason !== "undefined" && e.reason !== "") {
		l_msg = l_msg + " \n " + " \n " + e.reason.toString() + " \n ";
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.parent.showCriticalErrorDialog(l_msg);

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.designAreaLockUnlock();
});
/**
 * @u4a-doc
 * Drag-end bridge from the preview iframe to the Electron parent window.
 * The parent process uses this IPC signal to finish design drag/drop cleanup.
 */
window.ondragend = () => {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.parent.IPCRENDERER.send("if-dragEnd");
};

//================================================================
//#region 🟦 u4a.m.Preview
//================================================================
//#endregion
/**
 * @u4a-doc
 * Defines the lightweight u4a.m.Preview container control used as the preview root.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function definePreviewControl() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof sap === "undefined" || !sap.ui || typeof sap.ui.define !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof u4a !== "undefined" && u4a.m && u4a.m.Preview) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	sap.ui.define("u4a.m.Preview", ["sap/ui/core/Control"], function(Control) {
		"use strict";
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var oPreview = Control.extend("u4a.m.Preview", {
			metadata: {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				library: "u4a.m",
				defaultAggregation: "content",
				aggregations: {
					content: {
						type: "sap.ui.core.Control",
						multiple: true,
						singularName: "content"
					}
				}
			},
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oRm, oPreview.
			 */
			renderer: function(oRm, oPreview) {
				oRm.openStart("div", oPreview);
				oRm.style("width", "100%");
				oRm.style("height", "100%");
				oRm.class("u4aMPreview");
				oRm.openEnd();
				// @u4a-src Defines local state used by the following preview calculation.
				var aContents = oPreview.getContent(),
					iContLength = aContents.length;
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (iContLength > 0) {
					// @u4a-src Iterates through a collection and applies the same preview rule to each item.
					for (var i = 0; i < iContLength; i++) {
						// @u4a-src Defines local state used by the following preview calculation.
						var oCont = aContents[i];
						oRm.renderControl(oCont);
					}
				}
				// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
				oRm.close("div");
			}
		});
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oPreview;
	});
}


//================================================================
//#region 🟦 sap/ui/core/CustomData
//================================================================
//#endregion
/**
 * @u4a-doc
 * Defines the U4A CustomData shim that writes safe attributes/classes/styles to target DOM nodes.
 *
 * Source flow:
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 */
function defineU4ACustomData() {

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	sap.ui.define("u4a.ui.core.CustomData", [
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		"sap/ui/core/CustomData",
		"sap/ui/core/Control"
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	], function (CustomData, Control) {
		"use strict";

		/**
		 * u4a.ui.core.CustomData
		 *
		 * 목적
		 * - sap.ui.core.CustomData의 writeToDom=true 기본 동작(data-[key])은 사용하지 않는다.
		 * - key/value를 기준으로 CustomData가 추가된 부모 UI의 실제 DOM attribute를 직접 제어한다.
		 * - class/style은 기존 DOM 값을 최대한 훼손하지 않도록 U4A가 적용한 값만 추적/회수한다.
		 *
		 * 추가 property
		 * - targetDomRef  : 부모 UI의 getDomRef(sSuffix)에 전달할 DOM suffix
		 *                   공백이면 root DOM을 대상으로 한다.
		 * - targetSelector: targetDomRef로 얻은 DOM 하위에서 querySelector로 찾을 CSS selector
		 *                   공백이면 targetDomRef DOM 자체를 대상으로 한다.
		 *
		 * 예
		 * - root DOM 대상
		 *   new u4a.ui.core.CustomData({ key: "class", value: "sapUiLargeMargin", writeToDom: true })
		 *
		 * - 특정 DOM suffix 대상
		 *   new u4a.ui.core.CustomData({ key: "class", value: "u4aInner", writeToDom: true, targetDomRef: "inner" })
		 *
		 * - root 하위 selector 대상
		 *   new u4a.ui.core.CustomData({ key: "style", value: "color:red;", writeToDom: true, targetSelector: ".sapMBtnContent" })
		 */

		// @u4a-src Defines local state used by the following preview calculation.
		const mOwnerControlState = typeof WeakMap === "function" ? new WeakMap() : null;
		// @u4a-src Defines local state used by the following preview calculation.
		const aOwnerControlStateFallback = [];
		// @u4a-src Defines local state used by the following preview calculation.
		const aTrackedOwnerControls = [];
		// @u4a-src Defines local state used by the following preview calculation.
		let bCoreUiUpdatedHandlerAttached = false;

		/**
		 * @u4a-doc
		 * Creates a prototype-free map object for class/style/attribute tracking.
		 *
		 * Source flow:
		 * - Keeps design-time metadata and rendered UI5 state aligned.
		 */
		function createEmptyMap() {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return Object.create(null);
		}

		/**
		 * @u4a-doc
		 * Returns the UI5 control that owns a CustomData instance.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oCustomData.
		 */
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		function getOwnerControl(oCustomData) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oCustomData || typeof oCustomData.getParent !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return oCustomData.getParent();
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function trackOwnerControl(oOwnerControl) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl || aTrackedOwnerControls.indexOf(oOwnerControl) !== -1) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			aTrackedOwnerControls.push(oOwnerControl);
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function untrackOwnerControl(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			const iIndex = aTrackedOwnerControls.indexOf(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (iIndex === -1) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			aTrackedOwnerControls.splice(iIndex, 1);
		}

		/**
		 * @u4a-doc
		 * Synchronizes all tracked controls whose DOM may have been rerendered.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 */
		function syncTrackedOwnerControls() {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerControl;
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (let i = aTrackedOwnerControls.length - 1; i >= 0; i--) {
				oOwnerControl = aTrackedOwnerControls[i];
				oOwnerState = peekOwnerControlState(oOwnerControl);

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (isDestroyed(oOwnerControl) || !oOwnerState || oOwnerState.refCount === 0) {
					aTrackedOwnerControls.splice(i, 1);
					// @u4a-src Skips the remaining loop body for this item and moves to the next one.
					continue;
				}

				syncOwnerControlDom(oOwnerControl);
			}
		}

		/**
		 * @u4a-doc
		 * Registers one UIUpdated hook so CustomData DOM attributes are restored after UI5 rerendering.
		 *
		 * Source flow:
		 * - Works against parent.oAPP preview registries and the iframe document.
		 */
		function ensureCoreUiUpdatedHandler() {
			// @u4a-src Defines local state used by the following preview calculation.
			let oCore;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (bCoreUiUpdatedHandlerAttached === true) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof sap === "undefined" || !sap.ui || typeof sap.ui.getCore !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			oCore = sap.ui.getCore();

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oCore || typeof oCore.attachUIUpdated !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			/**
			 * @u4a-doc
			 * UI5 lifecycle callback that reacts after framework state or rendering changes.
			 */
			oCore.attachUIUpdated(function () {
				syncTrackedOwnerControls();
			});

			bCoreUiUpdatedHandlerAttached = true;
		}

		/**
		 * @u4a-doc
		 * Finds the nearest control that can receive after-rendering delegates for DOM sync.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function getRenderDelegateOwnerControl(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oCurrent = oOwnerControl;

			/**
			 * CustomData가 추가된 부모 UI와 실제 렌더링 완료 이벤트를 받을 UI가
			 * 항상 같지는 않다.
			 *
			 * sap.m.IconTabFilter는 IconTabBar/IconTabHeader 쪽 renderer에 의해
			 * DOM이 생성/교체될 수 있으므로, 가장 가까운 상위 sap.ui.core.Control의
			 * onAfterRendering 이후 다시 sync해야 한다.
			 */
			// @u4a-src Repeats the following block while the preview condition remains true.
			while (oCurrent) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oCurrent instanceof Control && typeof oCurrent.addEventDelegate === "function") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return oCurrent;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (typeof oCurrent.getParent !== "function") {
					// @u4a-src Stops the current switch or loop branch after this preview case is handled.
					break;
				}

				oCurrent = oCurrent.getParent();
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return null;
		}

		/**
		 * @u4a-doc
		 * Function that returns a boolean decision used by preview guards.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function isDestroyed(oOwnerControl) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return true;
			}

			// UI5 ManagedObject 계열은 destroy 이후 bIsDestroyed가 true가 된다.
			// 일부 내부 흐름에서는 _bIsBeingDestroyed가 먼저 설정될 수 있으므로 같이 방어한다.
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return oOwnerControl.bIsDestroyed === true || oOwnerControl._bIsBeingDestroyed === true;
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sKey.
		 */
		function normalizeKey(sKey) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof sKey !== "string") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return "";
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return sKey.trim();
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sValue.
		 */
		function normalizeText(sValue) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof sValue !== "string") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return "";
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return sValue.trim();
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sName.
		 */
		function camelToKebab(sName) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			/**
			 * @u4a-doc
			 * Callback/function expression used by the surrounding preview workflow.
			 */
			return sName.replace(/[A-Z]/g, function (sChar) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return "-" + sChar.toLowerCase();
			});
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sKeyLower, vValue.
		 */
		function valueToString(sKeyLower, vValue) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof vValue === "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (vValue === null || typeof vValue === "undefined") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return "";
			}

			// class 값이 배열이면 class list로 처리한다.
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (sKeyLower === "class" && Array.isArray(vValue)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vValue.join(" ");
			}

			// style 값이 object면 CSS 문자열로 변환한다.
			// 예: { color: "red", marginLeft: "1rem" }
			// -> color:red;margin-left:1rem;
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (sKeyLower === "style" && typeof vValue === "object" && !Array.isArray(vValue)) {
				// @u4a-src Iterates through a collection and applies the same preview rule to each item.
				/**
				 * @u4a-doc
				 * Collection callback that applies the preview rule to each item in the current list.
				 */
				return Object.keys(vValue).map(function (sProp) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return camelToKebab(sProp) + ":" + vValue[sProp];
				}).join(";");
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof vValue === "object") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return JSON.stringify(vValue);
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return String(vValue);
		}

		/**
		 * @u4a-doc
		 * Function that returns a boolean decision used by preview guards.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: sKey.
		 */
		function isDeniedAttribute(sKey) {
			// @u4a-src Defines local state used by the following preview calculation.
			const sLowerKey = sKey.toLowerCase();

			// DOM 안정성상 id 변경은 막는다.
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (sLowerKey === "id") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return true;
			}

			// onclick, onmouseover 같은 inline event attribute는 차단한다.
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (/^on/i.test(sKey)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return true;
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return false;
		}

		/**
		 * @u4a-doc
		 * Function that returns a boolean decision used by preview guards.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: sKey.
		 */
		function isValidAttributeName(sKey) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return /^[a-zA-Z_][a-zA-Z0-9_\-:.]*$/.test(sKey);
		}

		/**
		 * @u4a-doc
		 * Function that constructs runtime controls, DOM, or data structures for the preview.
		 *
		 * Source flow:
		 * - Keeps design-time metadata and rendered UI5 state aligned.
		 */
		function createOwnerControlState() {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return {
				syncRequested: false,

				// 실제 onAfterRendering delegate가 등록된 Control.
				// sap.m.IconTabFilter처럼 부모 Renderer에 의해 DOM이 생성되는 Element는
				// 자기 자신이 아니라 상위 Control의 렌더링 완료 시점에 다시 동기화해야 한다.
				delegateOwnerControl: null,
				delegate: null,
				refCount: 0,

				// targetKey별 이전 U4A 적용 상태
				// {
				//   "root||": {
				//       dom: HTMLElement,
				//       targetDomRef: "",
				//       targetSelector: "",
				//       classes: { className: { added: true } },
				//       styles : { color: { hadValue, oldValue, oldPriority, appliedValue, appliedPriority } },
				//       attrs  : { title: { hadValue, oldValue, appliedValue } }
				//   }
				// }
				targets: createEmptyMap()
			};
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function findFallbackOwnerControlState(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let i;

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (i = 0; i < aOwnerControlStateFallback.length; i++) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (aOwnerControlStateFallback[i].ownerControl === oOwnerControl) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return aOwnerControlStateFallback[i].state;
				}
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return null;
		}

		/**
		 * @u4a-doc
		 * Function that reads or derives OwnerControlState without changing preview state.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function getOwnerControlState(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oState;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (mOwnerControlState) {
				oState = mOwnerControlState.get(oOwnerControl);

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oState) {
					oState = createOwnerControlState();
					mOwnerControlState.set(oOwnerControl, oState);
				}

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return oState;
			}

			// WeakMap이 없는 구형 환경 fallback.
			// 부모 UI 객체에 내부 property를 직접 남기지 않기 위해 별도 배열로 관리한다.
			oState = findFallbackOwnerControlState(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oState) {
				oState = createOwnerControlState();

				aOwnerControlStateFallback.push({
					ownerControl: oOwnerControl,
					state: oState
				});
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return oState;
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function peekOwnerControlState(oOwnerControl) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (mOwnerControlState) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return mOwnerControlState.get(oOwnerControl) || null;
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return findFallbackOwnerControlState(oOwnerControl);
		}

		/**
		 * @u4a-doc
		 * Function that removes eteFallbackOwnerControlState and cleans related preview state.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function deleteFallbackOwnerControlState(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let i;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (mOwnerControlState || !oOwnerControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (i = aOwnerControlStateFallback.length - 1; i >= 0; i--) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (aOwnerControlStateFallback[i].ownerControl === oOwnerControl) {
					aOwnerControlStateFallback.splice(i, 1);
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
			}
		}

		/**
		 * @u4a-doc
		 * Function that reads or derives TargetKey without changing preview state.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sTargetDomRef, sTargetSelector.
		 */
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		function getTargetKey(sTargetDomRef, sTargetSelector) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return normalizeText(sTargetDomRef) + "||" + normalizeText(sTargetSelector);
		}

		/**
		 * @u4a-doc
		 * Function that adds DomCandidate to a preview collection, DOM node, or UI5 aggregation.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * - Keeps design-time metadata and rendered UI5 state aligned.
		 * Parameters: aDoms, oDom.
		 */
		function addDomCandidate(aDoms, oDom) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oDom || typeof oDom.nodeType !== "number" || oDom.nodeType !== 1) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (aDoms.indexOf(oDom) !== -1) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			aDoms.push(oDom);
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: sValue.
		 */
		function escapeCssAttributeValue(sValue) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return String(sValue).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
		}

		/**
		 * @u4a-doc
		 * Function that collects candidate DOM/control data for later processing.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: aDoms, sAttrName, sAttrValue.
		 */
		function collectDomCandidatesByAttribute(aDoms, sAttrName, sAttrValue) {
			// @u4a-src Defines local state used by the following preview calculation.
			let aFound;
			// @u4a-src Defines local state used by the following preview calculation.
			let i;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!sAttrValue) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				aFound = document.querySelectorAll("[" + sAttrName + "=\"" + escapeCssAttributeValue(sAttrValue) + "\"]");

				// @u4a-src Iterates through a collection and applies the same preview rule to each item.
				for (i = 0; i < aFound.length; i++) {
					addDomCandidate(aDoms, aFound[i]);
				}
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {}
		}

		/**
		 * @u4a-doc
		 * Function that reads or derives DefaultTargetDomCandidates without changing preview state.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: oOwnerControl.
		 */
		function getDefaultTargetDomCandidates(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let aDoms = [];
			// @u4a-src Defines local state used by the following preview calculation.
			let sId;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return aDoms;
			}

			sId = typeof oOwnerControl.getId === "function" ? oOwnerControl.getId() : "";

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (sId) {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				addDomCandidate(aDoms, document.getElementById(sId));
				collectDomCandidatesByAttribute(aDoms, "data-sap-ui", sId);
				collectDomCandidatesByAttribute(aDoms, "data-sap-ui-render", sId);
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (aDoms.length === 0 && typeof oOwnerControl.getDomRef === "function") {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				addDomCandidate(aDoms, oOwnerControl.getDomRef());
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return aDoms;
		}

		/**
		 * @u4a-doc
		 * Function that reads or derives TargetDom without changing preview state.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: oOwnerControl, sTargetDomRef, sTargetSelector.
		 */
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		function getTargetDom(oOwnerControl, sTargetDomRef, sTargetSelector) {
			// @u4a-src Defines local state used by the following preview calculation.
			let aDomCandidates;
			// @u4a-src Defines local state used by the following preview calculation.
			let oBaseDom;
			// @u4a-src Defines local state used by the following preview calculation.
			let i;
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			const sDomRef = normalizeText(sTargetDomRef);
			// @u4a-src Defines local state used by the following preview calculation.
			const sSelector = normalizeText(sTargetSelector);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!sDomRef) {
				aDomCandidates = getDefaultTargetDomCandidates(oOwnerControl);

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (aDomCandidates.length > 0) {
					oBaseDom = aDomCandidates[0];

					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!sSelector) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return oBaseDom;
					}

					// @u4a-src Iterates through a collection and applies the same preview rule to each item.
					for (i = 0; i < aDomCandidates.length; i++) {
						// @u4a-src Starts a protected block so preview errors can be contained.
						try {
							// @u4a-src Accesses browser DOM/window state used by the preview iframe.
							oBaseDom = aDomCandidates[i].querySelector(sSelector);

							// @u4a-src Checks a required condition before the following preview logic continues.
							if (oBaseDom) {
								// @u4a-src Returns the computed preview value or exits the function at this point.
								return oBaseDom;
							}
						// @u4a-src Handles an error raised by the protected preview block.
						} catch (e) {
							// @u4a-src Returns the computed preview value or exits the function at this point.
							return null;
						}
					}
				}
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl) || typeof oOwnerControl.getDomRef !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}

			// targetDomRef가 있으면 UI5의 getDomRef(sSuffix)를 우선 사용한다.
			// 공백이면 부모 UI의 root DOM을 대상으로 한다.
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			oBaseDom = sDomRef ? oOwnerControl.getDomRef(sDomRef) : oOwnerControl.getDomRef();

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oBaseDom) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!sSelector) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return oBaseDom;
			}

			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return oBaseDom.querySelector(sSelector);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				// 잘못된 CSS selector는 DOM 반영 대상 없음으로 처리한다.
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			}
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sValue.
		 */
		function splitClassNames(sValue) {
			// @u4a-src Defines local state used by the following preview calculation.
			const mClasses = createEmptyMap();

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!sValue) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return mClasses;
			}

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			sValue.split(/\s+/).forEach(function (sClassName) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!sClassName) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				mClasses[sClassName] = true;
			});

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return mClasses;
		}

		/**
		 * @u4a-doc
		 * Function that converts serialized design-time values into runtime values.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: sValue.
		 */
		function parseStyle(sValue) {
			// @u4a-src Defines local state used by the following preview calculation.
			const mStyles = createEmptyMap();
			// @u4a-src Defines local state used by the following preview calculation.
			let oTemp;
			// @u4a-src Defines local state used by the following preview calculation.
			let i;
			// @u4a-src Defines local state used by the following preview calculation.
			let sProp;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!sValue) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return mStyles;
			}

			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			oTemp = document.createElement("div");
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oTemp.style.cssText = sValue;

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (i = 0; i < oTemp.style.length; i++) {
				sProp = oTemp.style[i];

				mStyles[sProp] = {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					value: oTemp.style.getPropertyValue(sProp),
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					priority: oTemp.style.getPropertyPriority(sProp)
				};
			}

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return mStyles;
		}

		/**
		 * @u4a-doc
		 * Function that constructs runtime controls, DOM, or data structures for the preview.
		 *
		 * Source flow:
		 * - Keeps design-time metadata and rendered UI5 state aligned.
		 * Parameters: oAttr.
		 */
		function createTargetPlan(oAttr) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				targetDomRef: oAttr.targetDomRef,
				targetSelector: oAttr.targetSelector,
				classes: createEmptyMap(),
				styles: createEmptyMap(),
				attrs: createEmptyMap()
			};
		}

		/**
		 * @u4a-doc
		 * Function that collects candidate DOM/control data for later processing.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function collectPlans(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let mPlans = createEmptyMap();

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl) || typeof oOwnerControl.getCustomData !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return mPlans;
			}

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			oOwnerControl.getCustomData().forEach(function (oCustomData) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oAttr;
				// @u4a-src Defines local state used by the following preview calculation.
				let sTargetKey;
				// @u4a-src Defines local state used by the following preview calculation.
				let oPlan;
				// @u4a-src Defines local state used by the following preview calculation.
				let mClass;
				// @u4a-src Defines local state used by the following preview calculation.
				let mStyle;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oCustomData || typeof oCustomData._getU4aDomAttribute !== "function") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
				oAttr = oCustomData._getU4aDomAttribute();

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oAttr) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				sTargetKey = getTargetKey(oAttr.targetDomRef, oAttr.targetSelector);
				oPlan = mPlans[sTargetKey];

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oPlan) {
					oPlan = createTargetPlan(oAttr);
					mPlans[sTargetKey] = oPlan;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oAttr.keyLower === "class") {
					mClass = splitClassNames(oAttr.value);

					// @u4a-src Iterates through a collection and applies the same preview rule to each item.
					/**
					 * @u4a-doc
					 * Collection callback that applies the preview rule to each item in the current list.
					 */
					Object.keys(mClass).forEach(function (sClassName) {
						// class는 다중 CustomData 값을 병합한다.
						oPlan.classes[sClassName] = true;
					});

					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oAttr.keyLower === "style") {
					mStyle = parseStyle(oAttr.value);

					// @u4a-src Iterates through a collection and applies the same preview rule to each item.
					/**
					 * @u4a-doc
					 * Collection callback that applies the preview rule to each item in the current list.
					 */
					Object.keys(mStyle).forEach(function (sProp) {
						// 동일 CSS property는 뒤쪽 CustomData 값이 최종 우선한다.
						oPlan.styles[sProp] = mStyle[sProp];
					});

					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!isValidAttributeName(oAttr.key)) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (isDeniedAttribute(oAttr.key)) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// 일반 attribute는 sap.ui.core.CustomData와 동일하게
				// 동일 key가 여러 번 나오면 aggregation 순서상 마지막 값이 최종 적용된다.
				oPlan.attrs[oAttr.key] = oAttr.value;
			});

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return mPlans;
		}

		/**
		 * @u4a-doc
		 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
		 *
		 * Source flow:
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oDom, oPrevTargetState.
		 */
		function cleanupClasses(oDom, oPrevTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPrevTargetState.classes).forEach(function (sClassName) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oInfo = oPrevTargetState.classes[sClassName];

				// U4A가 실제로 추가한 class만 제거한다.
				// 기존 DOM에 이미 존재하던 class는 제거하지 않는다.
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oInfo && oInfo.added === true) {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oDom.classList.remove(sClassName);
				}
			});
		}

		/**
		 * @u4a-doc
		 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
		 *
		 * Source flow:
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oDom, oPrevTargetState.
		 */
		function cleanupStyles(oDom, oPrevTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPrevTargetState.styles).forEach(function (sProp) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oInfo = oPrevTargetState.styles[sProp];
				// @u4a-src Defines local state used by the following preview calculation.
				let sCurrentValue;
				// @u4a-src Defines local state used by the following preview calculation.
				let sCurrentPriority;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oInfo) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				sCurrentValue = oDom.style.getPropertyValue(sProp);
				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				sCurrentPriority = oDom.style.getPropertyPriority(sProp);

				// 현재 DOM 값이 마지막으로 U4A가 적용한 값과 같을 때만 원복한다.
				// 값이 다르면 이후 외부 로직이 변경한 것으로 판단하고 건드리지 않는다.
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (sCurrentValue !== oInfo.appliedValue || sCurrentPriority !== oInfo.appliedPriority) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oInfo.hadValue) {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oDom.style.setProperty(sProp, oInfo.oldValue, oInfo.oldPriority);
				// @u4a-src Handles the alternate branch for the condition directly above.
				} else {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oDom.style.removeProperty(sProp);
				}
			});
		}

		/**
		 * @u4a-doc
		 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oDom, oPrevTargetState.
		 */
		function cleanupAttrs(oDom, oPrevTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPrevTargetState.attrs).forEach(function (sAttr) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oInfo = oPrevTargetState.attrs[sAttr];
				// @u4a-src Defines local state used by the following preview calculation.
				let sCurrentValue;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oInfo) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				sCurrentValue = oDom.getAttribute(sAttr);

				// 현재 DOM 값이 마지막으로 U4A가 적용한 값과 같을 때만 원복한다.
				// 값이 다르면 이후 외부 로직이 변경한 것으로 판단하고 건드리지 않는다.
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (sCurrentValue !== oInfo.appliedValue) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oInfo.hadValue) {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oDom.setAttribute(sAttr, oInfo.oldValue);
				// @u4a-src Handles the alternate branch for the condition directly above.
				} else {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oDom.removeAttribute(sAttr);
				}
			});
		}

		/**
		 * @u4a-doc
		 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
		 *
		 * Source flow:
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oDom, oPrevTargetState.
		 */
		function cleanupTargetState(oDom, oPrevTargetState) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oDom || !oPrevTargetState) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			cleanupClasses(oDom, oPrevTargetState);
			cleanupStyles(oDom, oPrevTargetState);
			cleanupAttrs(oDom, oPrevTargetState);
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oDom, oPlan, oNextTargetState.
		 */
		function applyClasses(oDom, oPlan, oNextTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPlan.classes).forEach(function (sClassName) {
				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				const bHadClass = oDom.classList.contains(sClassName);

				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				oDom.classList.add(sClassName);

				oNextTargetState.classes[sClassName] = {
					// 기존에 없던 class만 U4A가 추가한 것으로 추적한다.
					added: !bHadClass
				};
			});
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oDom, oPlan, oNextTargetState.
		 */
		function applyStyles(oDom, oPlan, oNextTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPlan.styles).forEach(function (sProp) {
				// @u4a-src Defines local state used by the following preview calculation.
				const oStyle = oPlan.styles[sProp];
				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				let sOldValue = oDom.style.getPropertyValue(sProp);
				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				const sOldPriority = oDom.style.getPropertyPriority(sProp);
				// @u4a-src Defines local state used by the following preview calculation.
				let bHadValue = sOldValue !== "" || sOldPriority !== "";

				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				oDom.style.setProperty(sProp, oStyle.value, oStyle.priority);

				oNextTargetState.styles[sProp] = {
					hadValue: bHadValue,
					oldValue: sOldValue,
					oldPriority: sOldPriority,
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					appliedValue: oDom.style.getPropertyValue(sProp),
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					appliedPriority: oDom.style.getPropertyPriority(sProp)
				};
			});
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: oDom, oPlan, oNextTargetState.
		 */
		function applyAttrs(oDom, oPlan, oNextTargetState) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oPlan.attrs).forEach(function (sAttr) {
				// @u4a-src Defines local state used by the following preview calculation.
				let sOldValue = oDom.getAttribute(sAttr);
				// @u4a-src Defines local state used by the following preview calculation.
				let bHadValue = sOldValue !== null && typeof sOldValue !== "undefined";
				// @u4a-src Defines local state used by the following preview calculation.
				let sValue = oPlan.attrs[sAttr];

				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				oDom.setAttribute(sAttr, sValue);

				oNextTargetState.attrs[sAttr] = {
					hadValue: bHadValue,
					oldValue: sOldValue,
					appliedValue: oDom.getAttribute(sAttr)
				};
			});
		}

		/**
		 * @u4a-doc
		 * Function that constructs runtime controls, DOM, or data structures for the preview.
		 *
		 * Source flow:
		 * - Keeps design-time metadata and rendered UI5 state aligned.
		 * Parameters: oDom, oPlan.
		 */
		function createNextTargetState(oDom, oPlan) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return {
				dom: oDom,
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				targetDomRef: oPlan.targetDomRef,
				targetSelector: oPlan.targetSelector,
				classes: createEmptyMap(),
				styles: createEmptyMap(),
				attrs: createEmptyMap()
			};
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oDom, oPlan.
		 */
		function applyTargetPlan(oDom, oPlan) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oNextTargetState = createNextTargetState(oDom, oPlan);

			applyClasses(oDom, oPlan, oNextTargetState);
			applyStyles(oDom, oPlan, oNextTargetState);
			applyAttrs(oDom, oPlan, oNextTargetState);

			// @u4a-src Returns the computed preview value or exits the function at this point.
			return oNextTargetState;
		}

		/**
		 * @u4a-doc
		 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
		 *
		 * Source flow:
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oOwnerControl, oOwnerState, mPlans.
		 */
		function cleanupRemovedTargets(oOwnerControl, oOwnerState, mPlans) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(oOwnerState.targets).forEach(function (sTargetKey) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oPrevTargetState;
				// @u4a-src Defines local state used by the following preview calculation.
				let oCurrentDom;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (mPlans[sTargetKey]) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				oPrevTargetState = oOwnerState.targets[sTargetKey];

				// 이전 target이 더 이상 현재 CustomData 계획에 없으면
				// 이전에 U4A가 적용했던 값만 회수한다.
				oCurrentDom = getTargetDom(
					oOwnerControl,
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					oPrevTargetState.targetDomRef,
					oPrevTargetState.targetSelector
				);

				// 렌더링으로 DOM이 교체된 경우 이전 DOM 상태를 새 DOM에 적용하면 안 된다.
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oCurrentDom && oCurrentDom === oPrevTargetState.dom) {
					cleanupTargetState(oCurrentDom, oPrevTargetState);
				}

				delete oOwnerState.targets[sTargetKey];
			});
		}

		/**
		 * @u4a-doc
		 * Function that reconciles stored model state with the rendered DOM/control state.
		 *
		 * Source flow:
		 * - Validates target control/DOM references before writing attributes, styles, or classes.
		 * Parameters: oOwnerControl.
		 */
		function syncOwnerControlDom(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;
			// @u4a-src Defines local state used by the following preview calculation.
			let mPlans;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl || typeof oOwnerControl.getCustomData !== "function") {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			mPlans = collectPlans(oOwnerControl);

			cleanupRemovedTargets(oOwnerControl, oOwnerState, mPlans);

			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			Object.keys(mPlans).forEach(function (sTargetKey) {
				// @u4a-src Defines local state used by the following preview calculation.
				let oPlan = mPlans[sTargetKey];
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				let oDom = getTargetDom(oOwnerControl, oPlan.targetDomRef, oPlan.targetSelector);
				// @u4a-src Defines local state used by the following preview calculation.
				let oPrevTargetState = oOwnerState.targets[sTargetKey];

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oDom) {
					// 현재 DOM이 없다면 이전 DOM은 이미 제거된 것으로 판단한다.
					// 이후 onAfterRendering 시점에 다시 sync되어 신규 DOM에 반영된다.
					delete oOwnerState.targets[sTargetKey];
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// 렌더링으로 DOM이 교체된 경우 이전 DOM 상태를 새 DOM에 cleanup하지 않는다.
				// 이전 DOM은 이미 제거된 것이므로 신규 DOM에는 현재 계획만 새로 적용한다.
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oPrevTargetState && oPrevTargetState.dom === oDom) {
					cleanupTargetState(oDom, oPrevTargetState);
				}

				oOwnerState.targets[sTargetKey] = applyTargetPlan(oDom, oPlan);
			});
		}

		/**
		 * @u4a-doc
		 * Function that schedules deferred work, usually through requestAnimationFrame or timeout fallback.
		 *
		 * Source flow:
		 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
		 * Parameters: oOwnerControl.
		 */
		function requestSync(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oOwnerState.syncRequested) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState.syncRequested = true;

			// @u4a-src Schedules or wraps asynchronous preview work so callers can wait for completion.
			/**
			 * @u4a-doc
			 * Promise callback that coordinates asynchronous preview rendering or synchronization.
			 */
			Promise.resolve().then(function () {
				oOwnerState.syncRequested = false;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (isDestroyed(oOwnerControl)) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				syncOwnerControlDom(oOwnerControl);
			});
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function ensureOwnerControlDelegate(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;
			// @u4a-src Defines local state used by the following preview calculation.
			const oRenderDelegateOwnerControl = getRenderDelegateOwnerControl(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl) || isDestroyed(oRenderDelegateOwnerControl)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (
				oOwnerState.delegate &&
				oOwnerState.delegateOwnerControl === oRenderDelegateOwnerControl
			) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// 기존에 다른 Control에 delegate가 등록되어 있다면 먼저 제거한다.
			// 예: IconTabFilter가 다른 IconTabBar로 이동한 경우
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (
				oOwnerState.delegate &&
				oOwnerState.delegateOwnerControl &&
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				oOwnerState.delegateOwnerControl.removeEventDelegate
			) {
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				oOwnerState.delegateOwnerControl.removeEventDelegate(oOwnerState.delegate);
			}

			// CustomData가 추가된 부모 UI당 delegate는 하나만 등록한다.
			// 단, delegate 등록 대상은 "CustomData가 추가된 UI"가 아니라
			// 실제 렌더링 완료 시점을 받을 수 있는 가장 가까운 상위 Control이다.
			oOwnerState.delegateOwnerControl = oRenderDelegateOwnerControl;
			oOwnerState.delegate = {
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 */
				onAfterRendering: function () {
					requestSync(oOwnerControl);

					// IconTabBar/IconTabHeader 계열은 렌더링 직후 내부 DOM 보정이 추가로 수행될 수 있다.
					// 같은 tick 이후 한 번 더 sync하여 부모 렌더링에 의해 DOM이 교체되거나 보정된 경우도 보완한다.
					// @u4a-src Schedules preview work to run outside the current browser event frame.
					/**
					 * @u4a-doc
					 * Timer/frame callback used to defer preview work until the browser can update safely.
					 */
					setTimeout(function () {
						requestSync(oOwnerControl);
					}, 0);
				}
			};

			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			oRenderDelegateOwnerControl.addEventDelegate(oOwnerState.delegate);
		}

		/**
		 * @u4a-doc
		 * Function that removes OwnerControlDelegateIfUnused and cleans related preview state.
		 *
		 * Source flow:
		 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
		 * Parameters: oOwnerControl.
		 */
		function removeOwnerControlDelegateIfUnused(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = peekOwnerControlState(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerState || oOwnerState.refCount > 0 || !oOwnerState.delegate) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (
				oOwnerState.delegateOwnerControl &&
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				oOwnerState.delegateOwnerControl.removeEventDelegate
			) {
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				oOwnerState.delegateOwnerControl.removeEventDelegate(oOwnerState.delegate);
			}

			oOwnerState.delegateOwnerControl = null;
			oOwnerState.delegate = null;

			// WeakMap은 별도 delete가 필수는 아니지만, fallback 배열은 직접 정리한다.
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!mOwnerControlState) {
				deleteFallbackOwnerControlState(oOwnerControl);
			}
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function increaseOwnerControlRef(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (isDestroyed(oOwnerControl)) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			oOwnerState.refCount += 1;

			trackOwnerControl(oOwnerControl);
			ensureCoreUiUpdatedHandler();
			ensureOwnerControlDelegate(oOwnerControl);
		}

		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oOwnerControl.
		 */
		function decreaseOwnerControlRef(oOwnerControl) {
			// @u4a-src Defines local state used by the following preview calculation.
			let oOwnerState;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState = peekOwnerControlState(oOwnerControl);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oOwnerState) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			oOwnerState.refCount = Math.max(oOwnerState.refCount - 1, 0);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oOwnerState.refCount === 0) {
				untrackOwnerControl(oOwnerControl);
			}

			removeOwnerControlDelegateIfUnused(oOwnerControl);
		}

		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		const U4ACustomData = CustomData.extend("u4a.ui.core.CustomData", {
			metadata: {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				library: "u4a.ui.core",

				properties: {
					/**
					 * 부모 UI의 getDomRef(sSuffix)에 전달할 DOM suffix.
					 * 공백이면 부모 UI의 root DOM을 대상으로 한다.
					 */
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					targetDomRef: {
						type: "string",
						defaultValue: ""
					},

					/**
					 * targetDomRef로 얻은 DOM 하위에서 찾을 CSS selector.
					 * 공백이면 targetDomRef DOM 자체를 대상으로 한다.
					 */
					targetSelector: {
						type: "string",
						defaultValue: ""
					}
				}
			},

			/**
			 * UI5 기본 CustomData의 data-* 출력은 사용하지 않는다.
			 *
			 * 기존 sap.ui.core.CustomData가 필요한 경우:
			 * - data-test="..." 형태가 필요하면 sap.ui.core.CustomData를 사용한다.
			 *
			 * u4a.ui.core.CustomData의 역할:
			 * - class/style/title/data-u4a-xxx 같은 실제 DOM attribute를 직접 제어한다.
			 */
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 */
			_checkWriteToDom: function () {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return null;
			},

			/**
			 * 현재 CustomData를 DOM attribute 반영 대상으로 변환한다.
			 *
			 * key 비교 정책:
			 * - class/style 판단은 소문자 기준으로 수행한다.
			 * - 일반 attribute 적용 시에는 사용자가 입력한 key 문자열을 유지한다.
			 */
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 */
			_getU4aDomAttribute: function () {
				// @u4a-src Defines local state used by the following preview calculation.
				let sKey;
				// @u4a-src Defines local state used by the following preview calculation.
				let sKeyLower;
				// @u4a-src Defines local state used by the following preview calculation.
				let sValue;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!this.getWriteToDom()) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return null;
				}

				sKey = normalizeKey(this.getKey());

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!sKey) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return null;
				}

				sKeyLower = sKey.toLowerCase();
				sValue = valueToString(sKeyLower, this.getValue());

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (sValue === null) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return null;
				}

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return {
					key: sKey,
					keyLower: sKeyLower,
					value: sValue,
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					targetDomRef: normalizeText(this.getTargetDomRef && this.getTargetDomRef()),
					targetSelector: normalizeText(this.getTargetSelector && this.getTargetSelector())
				};
			},

			/**
			 * @u4a-doc
			 * Function that applies Key to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 */
			setKey: function () {
				// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
				let vReturn = CustomData.prototype.setKey.apply(this, arguments);

				requestSync(getOwnerControl(this));

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that applies Value to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 */
			setValue: function () {
				// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
				let vReturn = CustomData.prototype.setValue.apply(this, arguments);

				requestSync(getOwnerControl(this));

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that applies WriteToDom to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 */
			setWriteToDom: function () {
				// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
				let vReturn = CustomData.prototype.setWriteToDom.apply(this, arguments);

				requestSync(getOwnerControl(this));

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that applies TargetDomRef to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 * Parameters: sTargetDomRef.
			 */
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			/**
			 * @u4a-doc
			 * Object method implementation used by the preview helper or UI5 subclass.
			 */
			setTargetDomRef: function (sTargetDomRef) {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				let vReturn = this.setProperty("targetDomRef", sTargetDomRef, true);

				requestSync(getOwnerControl(this));

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that applies TargetSelector to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 * Parameters: sTargetSelector.
			 */
			setTargetSelector: function (sTargetSelector) {
				// @u4a-src Defines local state used by the following preview calculation.
				let vReturn = this.setProperty("targetSelector", sTargetSelector, true);

				requestSync(getOwnerControl(this));

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 */
			_requestU4aDomSync: function () {
				requestSync(getOwnerControl(this));
			},

			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Validates target control/DOM references before writing attributes, styles, or classes.
			 */
			_syncU4aDomNow: function () {
				syncOwnerControlDom(getOwnerControl(this));
			},

			/**
			 * CustomData가 부모 UI의 customData aggregation에 추가/제거될 때
			 * UI5 내부에서 parent가 변경된다.
			 *
			 * 이 확장 Control은 parent 변경 이후에 다음 처리를 수행한다.
			 * - 기존 부모 UI에 적용된 U4A DOM attribute 회수 요청
			 * - 신규 부모 UI의 렌더링 이후 DOM attribute 반영을 위한 delegate 연결
			 * - sap.m.IconTabFilter처럼 부모 Renderer에 의해 DOM이 생성되는 UI는
			 *   실제 렌더링 Control의 onAfterRendering 이후 다시 DOM attribute를 반영
			 *
			 * CustomData.prototype.setParent 호출을 먼저 수행한 뒤 후속 처리하므로,
			 * UI5의 기본 parent 설정 흐름은 유지된다.
			 */
			/**
			 * @u4a-doc
			 * Function that applies Parent to preview/UI5/workspace state.
			 *
			 * Source flow:
			 * - Keeps design-time metadata and rendered UI5 state aligned.
			 */
			setParent: function () {
				// @u4a-src Defines local state used by the following preview calculation.
				const oOldOwnerControl = this._u4aOwnerControl;
				// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
				let vReturn = CustomData.prototype.setParent.apply(this, arguments);
				// @u4a-src Defines local state used by the following preview calculation.
				const oNewOwnerControl = getOwnerControl(this);

				this._bindU4aOwnerControl(oNewOwnerControl);

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oOldOwnerControl && oOldOwnerControl !== oNewOwnerControl) {
					requestSync(oOldOwnerControl);
				}

				requestSync(oNewOwnerControl);

				// @u4a-src Returns the computed preview value or exits the function at this point.
				return vReturn;
			},

			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oOwnerControl.
			 */
			_bindU4aOwnerControl: function (oOwnerControl) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this._u4aOwnerControl === oOwnerControl) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this._u4aOwnerControl) {
					decreaseOwnerControlRef(this._u4aOwnerControl);
				}

				this._u4aOwnerControl = oOwnerControl || null;

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!this._u4aOwnerControl) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				increaseOwnerControlRef(this._u4aOwnerControl);
			},

			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 */
			exit: function () {
				// @u4a-src Defines local state used by the following preview calculation.
				const oOwnerControl = this._u4aOwnerControl;

				this._bindU4aOwnerControl(null);

				requestSync(oOwnerControl);
			}
		});

		// @u4a-src Returns the computed preview value or exits the function at this point.
		return U4ACustomData;
	});

}

//================================================================
//#region Preview mark CustomData helpers
//================================================================
// Marker state is stored with u4a.ui.core.CustomData(writeToDom=true).
// This keeps the rendered DOM attributes/classes in sync after UI5
// invalidation or rerender cycles.
/**
 * @u4a-doc
 * Finds an existing U4A marker CustomData entry on a UI control.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi, sKey, vValue.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function getPreviewMarkCustomData(oUi, sKey, vValue) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || typeof oUi.getCustomData !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return null;
	}

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	var aCustomData = oUi.getCustomData();

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!aCustomData || aCustomData.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return null;
	}

	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = aCustomData.length; i < l; i++) {
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		var oCustomData = aCustomData[i];

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oCustomData || typeof oCustomData.isA !== "function") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (oCustomData.isA("u4a.ui.core.CustomData") !== true) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof oCustomData.getKey !== "function" || oCustomData.getKey() !== sKey) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof vValue !== "undefined" && String(oCustomData.getValue()) !== String(vValue)) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oCustomData;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return null;
}

/**
 * @u4a-doc
 * Function that schedules deferred work, usually through requestAnimationFrame or timeout fallback.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 * Parameters: oCustomData.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function requestPreviewMarkCustomDataSync(oCustomData) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oCustomData) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oCustomData._syncU4aDomNow === "function") {
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		oCustomData._syncU4aDomNow();
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oCustomData._requestU4aDomSync === "function") {
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		oCustomData._requestU4aDomSync();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oCustomData.setValue === "function" && typeof oCustomData.getValue === "function") {
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		oCustomData.setValue(oCustomData.getValue());
	}
}

/**
 * @u4a-doc
 * Adds or updates marker CustomData for selectable/selected/context attributes.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oUi, sKey, vValue, bMatchValue.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function addPreviewMarkCustomData(oUi, sKey, vValue, bMatchValue) {
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	var oCustomData;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || typeof oUi.addCustomData !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return null;
	}

	// class처럼 동일 key를 여러 건 병합해서 사용하는 attribute는
	// 기존 class CustomData 값을 덮어쓰지 않도록 key + value 기준으로 찾는다.
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	oCustomData = getPreviewMarkCustomData(
		oUi,
		sKey,
		bMatchValue === true ? vValue : undefined
	);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oCustomData) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (String(oCustomData.getValue()) !== String(vValue)) {
			// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
			oCustomData.setValue(vValue);
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof oCustomData.getWriteToDom === "function" && oCustomData.getWriteToDom() !== true) {
			// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
			oCustomData.setWriteToDom(true);
		}

		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		requestPreviewMarkCustomDataSync(oCustomData);

		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oCustomData;
	}

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	oCustomData = new u4a.ui.core.CustomData({
		key: sKey,
		value: vValue,
		writeToDom: true
	});

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	oUi.addCustomData(oCustomData);

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	requestPreviewMarkCustomDataSync(oCustomData);

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oCustomData;
}

/**
 * @u4a-doc
 * Removes marker CustomData from a UI control when the marker is cleared.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: oUi, sKey, vValue.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function removePreviewMarkCustomData(oUi, sKey, vValue) {
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	var oCustomData;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || typeof oUi.removeCustomData !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	oCustomData = getPreviewMarkCustomData(oUi, sKey, vValue);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oCustomData) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		oUi.removeCustomData(oCustomData);
		// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
		oCustomData.destroy();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
}

/**
 * @u4a-doc
 * Clears normal selection marker CustomData from one UI control.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: oUi.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function clearPreviewMarkFromUi(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	removePreviewMarkCustomData(oUi, oWS.sMark.selectedAttr, oWS.sMark.selectedValue);
}

/**
 * @u4a-doc
 * Removes stale selection attributes from DOM nodes left behind by rerendering.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function cleanupPreviewMarkDomFallback() {
	// @u4a-src Defines local state used by the following preview calculation.
	var aSelectedDom;

	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		aSelectedDom = document.body.querySelectorAll("[" + oWS.sMark.selectedAttr + "='" + oWS.sMark.selectedValue + "']");
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var i = 0, l = aSelectedDom.length; i < l; i++) {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			aSelectedDom[i].removeAttribute(oWS.sMark.selectedAttr);
		}
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
}

/**
 * @u4a-doc
 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: oUi.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function clearPreviewContextMenuMarkFromUi(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	removePreviewMarkCustomData(oUi, oWS.sMark.contextAttr, oWS.sMark.selectedValue);
}

/**
 * @u4a-doc
 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function cleanupPreviewContextMenuMarkDomFallback() {
	// @u4a-src Defines local state used by the following preview calculation.
	var aContextDom;

	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		aContextDom = document.body.querySelectorAll("[" + oWS.sMark.contextAttr + "='" + oWS.sMark.selectedValue + "']");
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var i = 0, l = aContextDom.length; i < l; i++) {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			aContextDom[i].removeAttribute(oWS.sMark.contextAttr);
		}
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
}

/**
 * @u4a-doc
 * Stores the UI that opened the context menu and draws its context highlight layer.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi.
 */
function markPreviewContextMenuUi(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oContextUi) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		clearPreviewContextMenuMarkFromUi(oWS.sMark.oContextUi);
	}

	cleanupPreviewContextMenuMarkDomFallback();

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oContextUi = oUi;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bContextMenuOpen = true;
	updatePreviewContextLayer();
}

/**
 * @u4a-doc
 * Clears the context-menu highlight state and hides the context overlay layer.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
function removePreviewContextMenuMark() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oContextUi) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		clearPreviewContextMenuMarkFromUi(oWS.sMark.oContextUi);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		oWS.sMark.oContextUi = null;
	}

	cleanupPreviewContextMenuMarkDomFallback();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bContextMenuOpen = false;
	hidePreviewContextLayer();

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectedUi) {
		requestPreviewSelectionLayerUpdate();
	}
}

/**
 * @u4a-doc
 * Hooks menu close events so the context highlight is cleaned up reliably.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oMenu.
 */
function bindPreviewContextMenuMarkCleanup(oMenu) {
	// @u4a-src Defines local state used by the following preview calculation.
	var aCloseEvents = ["attachClosed", "attachAfterClose", "attachBeforeClose", "attachClose"];
	// @u4a-src Defines local state used by the following preview calculation.
	var fnOrgClose;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oMenu || oMenu._u4aContextMarkCleanupBound === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oMenu._u4aContextMarkCleanupBound = true;

	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = aCloseEvents.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof oMenu[aCloseEvents[i]] !== "function") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			oMenu[aCloseEvents[i]](removePreviewContextMenuMark);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oMenu.close !== "function" || oMenu._u4aContextMarkCloseWrapped === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	fnOrgClose = oMenu.close;
	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 */
	oMenu.close = function() {
		removePreviewContextMenuMark();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return fnOrgClose.apply(this, arguments);
	};
	oMenu._u4aContextMarkCloseWrapped = true;
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oMenu.
 */
function applyPreviewContextMenuStyleClass(oMenu) {
	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Validates target control/DOM references before writing attributes, styles, or classes.
	 */
	function applyMenuDomClass() {
		// @u4a-src Defines local state used by the following preview calculation.
		var oDom;
		// @u4a-src Defines local state used by the following preview calculation.
		var oCurrent;

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oMenu || typeof oMenu.getDomRef !== "function") {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}

		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		oDom = oMenu.getDomRef();

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oDom) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (oDom.classList) {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oDom.classList.add("u4a_ws_preview_context_menu");
		}

		oCurrent = oDom.parentElement;

		// @u4a-src Repeats the following block while the preview condition remains true.
		while (oCurrent && oCurrent !== document.body) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (
				oCurrent.classList &&
				(
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					oCurrent.classList.contains("sapUiPopup") ||
					oCurrent.getAttribute("data-sap-ui-popup")
				)
			) {
				// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
				oCurrent.classList.add("u4a_ws_preview_context_menu_popup");
			}

			oCurrent = oCurrent.parentElement;
		}
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oMenu) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oMenu.addStyleClass === "function") {
		oMenu.addStyleClass("u4a_ws_preview_context_menu");
	}

	applyMenuDomClass();
	// @u4a-src Schedules preview work to run outside the current browser event frame.
	window.setTimeout(applyMenuDomClass, 0);
}

//================================================================
//#region Preview selected UI layer helpers
//================================================================
// Draws a single highlight layer over the selected UI instead of styling the
// selected UI DOM directly. The layer is appended to body and positioned with
// getBoundingClientRect() + page scroll offsets, following the preview sample
// behavior without occupying layout space.
/**
 * @u4a-doc
 * Creates or returns the body-level overlay DOM used for normal selection.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function getPreviewSelectionLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oLayer = oWS.sMark.oSelectionLayer;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oLayer && oLayer.parentNode) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oLayer;
	}

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	oLayer = document.createElement("div");
	oLayer.id = "u4a_ws_selection_layer";
	oLayer.className = "u4a_ws_selection_layer";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("aria-hidden", "true");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("data-u4a-selection-layer", "X");

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	document.body.appendChild(oLayer);

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oSelectionLayer = oLayer;

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oLayer;
}

/**
 * @u4a-doc
 * Function that keeps the selected marker layer DOM on its base class.
 *
 * Source flow:
 * - The detached selection layer uses CSS variables for all runtime styling.
 * Parameters: oLayer.
 */
function syncPreviewSelectionLayerClass(oLayer) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oLayer || !oLayer.classList) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.classList.add("u4a_ws_selection_layer");
}

/**
 * @u4a-doc
 * Function that collects candidate DOM/control data for later processing.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function collectPreviewSelectionDomCandidates(oUi) {
	// @u4a-src Defines local state used by the following preview calculation.
	var aDoms = [];
	// @u4a-src Defines local state used by the following preview calculation.
	var sId;
	// @u4a-src Defines local state used by the following preview calculation.
	var aFound;

	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Validates target control/DOM references before writing attributes, styles, or classes.
	 * Parameters: oDom.
	 */
	function lf_addDom(oDom) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oDom || oDom.nodeType !== 1 || aDoms.indexOf(oDom) !== -1) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}

		aDoms.push(oDom);
	}

	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Validates target control/DOM references before writing attributes, styles, or classes.
	 * Parameters: sValue.
	 */
	function lf_escapeAttr(sValue) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return String(sValue).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
	}

	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Validates target control/DOM references before writing attributes, styles, or classes.
	 * Parameters: sAttrName, sValue.
	 */
	function lf_collectByAttr(sAttrName, sValue) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!sValue) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}

		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			aFound = document.querySelectorAll("[" + sAttrName + "=\"" + lf_escapeAttr(sValue) + "\"]");
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (var i = 0, l = aFound.length; i < l; i++) {
				lf_addDom(aFound[i]);
			}
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return aDoms;
	}

	sId = typeof oUi.getId === "function" ? oUi.getId() : "";

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sId) {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		lf_addDom(document.getElementById(sId));
		lf_collectByAttr("data-sap-ui", sId);
		lf_collectByAttr("data-sap-ui-render", sId);
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUi.getDomRef === "function") {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		lf_addDom(oUi.getDomRef());
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return aDoms;
}

function getPreviewSelectionDomRect(oDom) {
	if (!oDom || typeof oDom.getBoundingClientRect !== "function") {
		return null;
	}

	return oDom.getBoundingClientRect();
}

function isPreviewSelectionUsableRect(oRect) {
	return !!oRect && oRect.width > 0 && oRect.height > 0;
}

function getPreviewSelectionDomScore(oUi, oDom, oRect, iIndex) {
	var iScore = 0;
	var sId = typeof oUi?.getId === "function" ? oUi.getId() : "";
	var oUiDom = typeof oUi?.getDomRef === "function" ? oUi.getDomRef() : null;
	var oStyle;

	if (!isPreviewSelectionUsableRect(oRect)) {
		return -1;
	}

	if (oDom === oUiDom) {
		iScore += 4000;
	}

	if (sId && oDom.id === sId) {
		iScore += 3000;
	}

	if (
		sId &&
		(
			oDom.getAttribute("data-sap-ui") === sId ||
			oDom.getAttribute("data-sap-ui-render") === sId
		)
	) {
		iScore += 2500;
	}

	if (
		oDom.getAttribute(oWS.sMark.selectedAttr) === oWS.sMark.selectedValue ||
		oDom.getAttribute(oWS.sMark.selectableAttr) === oWS.sMark.selectedValue
	) {
		iScore += 1500;
	}

	try {
		oStyle = window.getComputedStyle ? window.getComputedStyle(oDom) : null;
	} catch (e) {
		oStyle = null;
	}

	if (oStyle && (oStyle.display === "none" || oStyle.visibility === "hidden")) {
		iScore -= 5000;
	}

	if (oRect.width <= 2 || oRect.height <= 2) {
		iScore -= 3000;
	}

	iScore += Math.min(oRect.width * oRect.height, 1000000) / 1000;

	return iScore - (iIndex / 1000);
}

/**
 * @u4a-doc
 * Function that reads or derives PreviewSelectionTargetDom without changing preview state.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function getPreviewSelectionTargetDom(oUi) {
	// @u4a-src Defines local state used by the following preview calculation.
	var aDoms = collectPreviewSelectionDomCandidates(oUi);
	// @u4a-src Defines local state used by the following preview calculation.
	var oFallbackDom = null;
	var oBestDom = null;
	var iBestScore = -1;

	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = aDoms.length; i < l; i++) {
		// @u4a-src Defines local state used by the following preview calculation.
		var oDom = aDoms[i];
		// @u4a-src Defines local state used by the following preview calculation.
		var oRect = getPreviewSelectionDomRect(oDom);
		var iScore;

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oDom || !oRect) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (isPreviewSelectionUsableRect(oRect)) {
			iScore = getPreviewSelectionDomScore(oUi, oDom, oRect, i);

			if (iScore > iBestScore) {
				iBestScore = iScore;
				oBestDom = oDom;
			}
		}

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oFallbackDom) {
			oFallbackDom = oDom;
		}
	}

	if (oBestDom) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oBestDom;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oFallbackDom;
}

/**
 * @u4a-doc
 * Function that reads or derives PreviewSelectionScrollRoot without changing preview state.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oDom.
 */
function getPreviewSelectionScrollRoot(oDom) {
	// @u4a-src Defines local state used by the following preview calculation.
	var oCurrent = oDom ? oDom.parentElement : null;
	// @u4a-src Defines local state used by the following preview calculation.
	var oStyle;
	// @u4a-src Defines local state used by the following preview calculation.
	var sOverflow;

	// @u4a-src Repeats the following block while the preview condition remains true.
	while (oCurrent && oCurrent !== document.body && oCurrent !== document.documentElement) {
		// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
		oStyle = window.getComputedStyle ? window.getComputedStyle(oCurrent) : null;
		sOverflow = oStyle ? [
			oStyle.overflow,
			oStyle.overflowX,
			oStyle.overflowY
		].join(" ") : "";

		// @u4a-src Checks a required condition before the following preview logic continues.
		if (/(auto|scroll|overlay)/.test(sOverflow) && (
			oCurrent.scrollHeight > oCurrent.clientHeight ||
			oCurrent.scrollWidth > oCurrent.clientWidth
		)) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return oCurrent;
		}

		oCurrent = oCurrent.parentElement;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return null;
}

/**
 * @u4a-doc
 * Function that reads or derives PreviewSelectionRootRect without changing preview state.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oRoot.
 */
function getPreviewSelectionRootRect(oRoot) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oRoot && typeof oRoot.getBoundingClientRect === "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oRoot.getBoundingClientRect();
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return {
		top: 0,
		left: 0,
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		right: window.innerWidth || document.documentElement.clientWidth || 0,
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		bottom: window.innerHeight || document.documentElement.clientHeight || 0
	};
}

/**
 * @u4a-doc
 * Function that returns a boolean decision used by preview guards.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oRect, oRootRect.
 */
function isPreviewSelectionRectIntersecting(oRect, oRootRect) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oRect || !oRootRect) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return false;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oRect.right > oRootRect.left &&
		oRect.left < oRootRect.right &&
		oRect.bottom > oRootRect.top &&
		oRect.top < oRootRect.bottom;
}

/**
 * @u4a-doc
 * Function that returns a boolean decision used by preview guards.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oTargetDom, oRect.
 */
function isPreviewSelectionTargetVisible(oTargetDom, oRect) {
	// @u4a-src Defines local state used by the following preview calculation.
	var oScrollRoot = getPreviewSelectionScrollRoot(oTargetDom);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!isPreviewSelectionRectIntersecting(oRect, getPreviewSelectionRootRect(null))) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return false;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oScrollRoot && !isPreviewSelectionRectIntersecting(oRect, getPreviewSelectionRootRect(oScrollRoot))) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return false;
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return true;
}

/**
 * @u4a-doc
 * Function that returns a boolean decision used by preview guards.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oTargetDom, oRect.
 */
function isPreviewSelectionPassiveTextUi(oUi) {
	var aTextUiTypes = [
		"sap.m.Title",
		"sap.m.Text",
		"sap.m.Label"
	];

	if (!oUi || typeof oUi.isA !== "function") {
		return false;
	}

	for (var i = 0, l = aTextUiTypes.length; i < l; i++) {
		if (oUi.isA(aTextUiTypes[i]) === true) {
			return true;
		}
	}

	return false;
}

function isPreviewSelectionPassiveTextDom(oTargetDom) {
	if (!oTargetDom || typeof oTargetDom.matches !== "function") {
		return false;
	}

	return oTargetDom.matches(".sapMTitle, .sapMText, .sapMLabel");
}

function hasPreviewSelectionInteractiveSemantics(oTargetDom) {
	var sInteractiveSelector = [
		"input",
		"textarea",
		"select",
		"button",
		"a[href]",
		"[role='button']",
		"[role='textbox']",
		"[role='checkbox']",
		"[role='radio']",
		"[role='switch']",
		"[role='option']",
		"[role='menuitem']",
		"[aria-haspopup]",
		".sapMToken",
		".sapMBtn",
		".sapMInputBase",
		".sapMCb",
		".sapMRb",
		".sapMSwt"
	].join(",");

	if (!oTargetDom) {
		return false;
	}

	try {
		if (typeof oTargetDom.matches === "function" && oTargetDom.matches(sInteractiveSelector)) {
			return true;
		}

		if (typeof oTargetDom.querySelector === "function" && oTargetDom.querySelector(sInteractiveSelector)) {
			return true;
		}
	} catch (e) {}

	return false;
}

function isPreviewSelectionCompactTextTarget(oTargetDom, oRect, oUi) {
	// @u4a-src Defines local state used by the following preview calculation.
	var sText;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oTargetDom || !oRect) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return false;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oRect.height > 28 || oRect.width > 260) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return false;
	}

	if (
		isPreviewSelectionPassiveTextUi(oUi) !== true &&
		isPreviewSelectionPassiveTextDom(oTargetDom) !== true
	) {
		return false;
	}

	if (hasPreviewSelectionInteractiveSemantics(oTargetDom) === true) {
		return false;
	}

	sText = typeof oTargetDom.innerText === "string" ? oTargetDom.innerText.trim() : "";

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!sText && typeof oTargetDom.textContent === "string") {
		sText = oTargetDom.textContent.trim();
	}

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sText !== "";
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function disconnectPreviewSelectionObservers() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectionResizeObserver) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
			oWS.sMark.oSelectionResizeObserver.disconnect();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectionIntersectionObserver) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
			oWS.sMark.oSelectionIntersectionObserver.disconnect();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}

	// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
	oWS.sMark.oSelectionResizeObserver = null;
	// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
	oWS.sMark.oSelectionIntersectionObserver = null;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oSelectionObservedDom = null;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bSelectionTargetIntersecting = true;
}

/**
 * @u4a-doc
 * Registers ResizeObserver and IntersectionObserver for the selected DOM target.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 * Parameters: oTargetDom.
 */
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function observePreviewSelectionTarget(oTargetDom) {
	// @u4a-src Defines local state used by the following preview calculation.
	var oScrollRoot;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oTargetDom || oWS.sMark.oSelectionObservedDom === oTargetDom) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	disconnectPreviewSelectionObservers();

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oSelectionObservedDom = oTargetDom;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bSelectionTargetIntersecting = true;
	oScrollRoot = getPreviewSelectionScrollRoot(oTargetDom);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof window.ResizeObserver === "function") {
		// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
		/**
		 * @u4a-doc
		 * Callback/function expression used by the surrounding preview workflow.
		 */
		oWS.sMark.oSelectionResizeObserver = new window.ResizeObserver(function() {
			requestPreviewSelectionLayerUpdate();
		});

		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
			oWS.sMark.oSelectionResizeObserver.observe(oTargetDom);

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oScrollRoot) {
				// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
				oWS.sMark.oSelectionResizeObserver.observe(oScrollRoot);
			// @u4a-src Handles the alternate branch for the condition directly above.
			} else if (document.documentElement) {
				// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
				oWS.sMark.oSelectionResizeObserver.observe(document.documentElement);
			}
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof window.IntersectionObserver === "function") {
		// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
		/**
		 * @u4a-doc
		 * Callback/function expression used by the surrounding preview workflow.
		 */
		oWS.sMark.oSelectionIntersectionObserver = new window.IntersectionObserver(function(aEntries) {
			// @u4a-src Defines local state used by the following preview calculation.
			var oEntry = aEntries && aEntries.length > 0 ? aEntries[aEntries.length - 1] : null;

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oEntry) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oEntry.isIntersecting === true && oEntry.intersectionRatio > 0) {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				oWS.sMark.bSelectionTargetIntersecting = true;
				requestPreviewSelectionLayerUpdate();
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			oWS.sMark.bSelectionTargetIntersecting = false;
			hidePreviewSelectionLayer();
		}, {
			root: oScrollRoot || null,
			threshold: 0
		});

		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
			oWS.sMark.oSelectionIntersectionObserver.observe(oTargetDom);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function hidePreviewSelectionLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oLayer = oWS.sMark.oSelectionLayer;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oLayer) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.removeAttribute("data-u4a-layer-visible");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.removeAttribute("data-u4a-layer-compact");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.left = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.top = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.width = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.height = "0px";
}

/**
 * @u4a-doc
 * Creates or returns the body-level overlay DOM used for context-menu highlighting.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function getPreviewContextLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oLayer = oWS.sMark.oContextLayer;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oLayer && oLayer.parentNode) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oLayer;
	}

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	oLayer = document.createElement("div");
	oLayer.id = "u4a_ws_context_layer";
	oLayer.className = "u4a_ws_context_layer";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("aria-hidden", "true");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("data-u4a-context-layer", "X");

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	document.body.appendChild(oLayer);

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oContextLayer = oLayer;

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return oLayer;
}

/**
 * @u4a-doc
 * Function that reconciles stored model state with the rendered DOM/control state.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oLayer.
 */
function syncPreviewContextLayerClass(oLayer) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oLayer || !oLayer.classList) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.classList.add("u4a_ws_context_layer");
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function hidePreviewContextLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oLayer = oWS.sMark.oContextLayer;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oLayer) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.removeAttribute("data-u4a-layer-visible");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.left = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.top = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.width = "0px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.height = "0px";
}

/**
 * @u4a-doc
 * Positions and styles the context-menu overlay over the UI that opened the menu.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 */
function updatePreviewContextLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oUi = oWS.sMark.oContextUi;
	// @u4a-src Defines local state used by the following preview calculation.
	var oTargetDom;
	// @u4a-src Defines local state used by the following preview calculation.
	var oRect;
	// @u4a-src Defines local state used by the following preview calculation.
	var oLayer;
	// @u4a-src Defines local state used by the following preview calculation.
	var oStyle;
	// @u4a-src Defines local state used by the following preview calculation.
	var iScrollTop;
	// @u4a-src Defines local state used by the following preview calculation.
	var iScrollLeft;

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.iContextLayerRaf = 0;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		hidePreviewContextLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oTargetDom = getPreviewSelectionTargetDom(oUi);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oTargetDom || typeof oTargetDom.getBoundingClientRect !== "function") {
		hidePreviewContextLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	oRect = oTargetDom.getBoundingClientRect();

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oRect.width <= 0 || oRect.height <= 0 || !isPreviewSelectionTargetVisible(oTargetDom, oRect)) {
		hidePreviewContextLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	iScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	iScrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
	oLayer = getPreviewContextLayer();
	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	oStyle = window.getComputedStyle ? window.getComputedStyle(oTargetDom) : null;

	syncPreviewContextLayerClass(oLayer);

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.left = (oRect.left + iScrollLeft) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.top = (oRect.top + iScrollTop) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.width = oRect.width + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.height = oRect.height + "px";

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oStyle) {
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oLayer.style.setProperty("--u4a-selection-layer-radius", oStyle.borderRadius || "var(--u4a-preview-selection-radius)");
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("data-u4a-layer-visible", "X");
}

/**
 * @u4a-doc
 * Function that schedules deferred work, usually through requestAnimationFrame or timeout fallback.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 */
function requestPreviewContextLayerUpdate() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.iContextLayerRaf) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof window.requestAnimationFrame === "function") {
		// @u4a-src Schedules preview work to run outside the current browser event frame.
		oWS.sMark.iContextLayerRaf = window.requestAnimationFrame(updatePreviewContextLayer);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Schedules preview work to run outside the current browser event frame.
	oWS.sMark.iContextLayerRaf = window.setTimeout(updatePreviewContextLayer, 0);
}

/**
 * @u4a-doc
 * Function that schedules deferred work, usually through requestAnimationFrame or timeout fallback.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 */
function requestPreviewMarkLayerUpdate() {
	requestPreviewSelectionLayerUpdate();
	requestPreviewContextLayerUpdate();
}

/**
 * @u4a-doc
 * Positions and styles the selection overlay over the selected UI DOM.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 */
function updatePreviewSelectionLayer() {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var oUi = oWS.sMark.oSelectedUi;
	// @u4a-src Defines local state used by the following preview calculation.
	var oTargetDom;
	// @u4a-src Defines local state used by the following preview calculation.
	var oRect;
	// @u4a-src Defines local state used by the following preview calculation.
	var oLayer;
	// @u4a-src Defines local state used by the following preview calculation.
	var oStyle;
	// @u4a-src Defines local state used by the following preview calculation.
	var iScrollTop;
	// @u4a-src Defines local state used by the following preview calculation.
	var iScrollLeft;
	// @u4a-src Defines local state used by the following preview calculation.
	var bCompactTextTarget;
	// @u4a-src Defines local state used by the following preview calculation.
	var iLayerOffset;

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.iSelectionLayerRaf = 0;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oTargetDom = getPreviewSelectionTargetDom(oUi);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oTargetDom || typeof oTargetDom.getBoundingClientRect !== "function") {
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	oRect = oTargetDom.getBoundingClientRect();

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oRect.width <= 0 || oRect.height <= 0) {
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	observePreviewSelectionTarget(oTargetDom);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		oWS.sMark.bSelectionTargetIntersecting === false &&
		!isPreviewSelectionTargetVisible(oTargetDom, oRect)
	) {
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!isPreviewSelectionTargetVisible(oTargetDom, oRect)) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		oWS.sMark.bSelectionTargetIntersecting = false;
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bSelectionTargetIntersecting = true;

	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	iScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	iScrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
	oLayer = getPreviewSelectionLayer();
	syncPreviewSelectionLayerClass(oLayer);
	// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
	oStyle = window.getComputedStyle ? window.getComputedStyle(oTargetDom) : null;
	bCompactTextTarget = isPreviewSelectionCompactTextTarget(oTargetDom, oRect, oUi);
	iLayerOffset = bCompactTextTarget ? 3 : 0;

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.left = (oRect.left + iScrollLeft - iLayerOffset) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.top = (oRect.top + iScrollTop - iLayerOffset) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.width = (oRect.width + (iLayerOffset * 2)) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.height = (oRect.height + (iLayerOffset * 2)) + "px";
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.style.setProperty(
		"--u4a-selection-layer-inset",
		Math.min(oRect.width, oRect.height) <= 12 ? "0px" : "var(--u4a-preview-selection-inset)"
	);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oStyle) {
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oLayer.style.setProperty("--u4a-selection-layer-radius", oStyle.borderRadius || "var(--u4a-preview-selection-radius)");
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (bCompactTextTarget) {
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oLayer.setAttribute("data-u4a-layer-compact", "X");
	// @u4a-src Handles the alternate branch for the condition directly above.
	} else {
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oLayer.removeAttribute("data-u4a-layer-compact");
	}

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oLayer.setAttribute("data-u4a-layer-visible", "X");
}

/**
 * @u4a-doc
 * Function that schedules deferred work, usually through requestAnimationFrame or timeout fallback.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Uses deferred or observer-driven updates so repeated UI changes collapse into one visual refresh.
 */
function requestPreviewSelectionLayerUpdate() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.iSelectionLayerRaf) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof window.requestAnimationFrame === "function") {
		// @u4a-src Schedules preview work to run outside the current browser event frame.
		oWS.sMark.iSelectionLayerRaf = window.requestAnimationFrame(updatePreviewSelectionLayer);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Schedules preview work to run outside the current browser event frame.
	oWS.sMark.iSelectionLayerRaf = window.setTimeout(updatePreviewSelectionLayer, 0);
}

/**
 * @u4a-doc
 * Registers global preview events that keep overlay layers aligned with UI changes.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function ensurePreviewSelectionLayerEvents() {
	// @u4a-src Defines local state used by the following preview calculation.
	var oCore;

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.bSelectionLayerEventBound === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	window.addEventListener("scroll", requestPreviewMarkLayerUpdate, true);

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (document && typeof document.addEventListener === "function") {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		document.addEventListener("scroll", requestPreviewMarkLayerUpdate, true);
	}

	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (sap && sap.ui && typeof sap.ui.getCore === "function") {
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			oCore = sap.ui.getCore();
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oCore && typeof oCore.attachUIUpdated === "function") {
				oCore.attachUIUpdated(requestPreviewMarkLayerUpdate);
			}
		}
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.bSelectionLayerEventBound = true;
}
//#endregion

//#endregion

//================================================================
//#region 🟦 미리보기 UI 선택건 표현.
//================================================================
//#endregion
//================================================================
//#region Preview selected UI mark
//================================================================
// Applies the selected marker to the current UI. Focus is only used as a
// keyboard/navigation aid; the visible state is drawn by the selection layer.
/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * Parameters: oMarkUi.
 */
oWS.sMark.fn_mark = function(oMarkUi) {

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oMarkUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return Promise.resolve();
	}

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectedUi && oWS.sMark.oSelectedUi !== oMarkUi) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		clearPreviewMarkFromUi(oWS.sMark.oSelectedUi);
	}

	// focus는 키보드 제어를 위한 보조 수단으로만 사용한다.
	// 실제 선택 상태는 data-u4a-selected attribute로 유지한다.
	// data-u4a-selected remains the selected-state source. The configurable
	// selection colors are applied through CSS variables on the detached layer.
	clearPreviewMarkFromUi(oMarkUi);
	cleanupPreviewMarkDomFallback();

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oWS.sMark.oSelectedUi = oMarkUi;
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	addPreviewMarkCustomData(oMarkUi, oWS.sMark.selectedAttr, oWS.sMark.selectedValue);
	ensurePreviewSelectionLayerEvents();
	updatePreviewSelectionLayer();

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return Promise.resolve();
};
//#endregion

//================================================================
//#region 🟦 미리보기 UI 선택건 표현 제거
//================================================================
//#endregion
//================================================================
//#region Preview selected UI mark cleanup
//================================================================
// Removes the current selected marker. The DOM fallback handles controls
// that were rerendered or destroyed before the normal CustomData cleanup.
/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 */
oWS.sMark.fn_removeMark = function() {

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oWS.sMark.oSelectedUi) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		clearPreviewMarkFromUi(oWS.sMark.oSelectedUi);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		oWS.sMark.oSelectedUi = null;
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return Promise.resolve();
	}

	cleanupPreviewMarkDomFallback();
	disconnectPreviewSelectionObservers();
	hidePreviewSelectionLayer();

	// @u4a-src Returns the computed preview value or exits the function at this point.
	return Promise.resolve();
};
//#endregion

/**
 * @u4a-doc
 * Adds or resets external CSS link elements inside the preview iframe.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: vLink, bReset.
 */
function setCSSLink(vLink, bReset) {
	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 * Parameters: sLink.
	 */
	function lf_createLink(sLink) {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		var oChild = document.createElement("link");
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oChild.setAttribute("rel", "stylesheet");
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oChild.setAttribute("type", "text/css");
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		oChild.setAttribute("href", sLink);
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oLink.appendChild(oChild);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Schedules preview work to run outside the current browser event frame.
			/**
			 * @u4a-doc
			 * Timer/frame callback used to defer preview work until the browser can update safely.
			 */
			setTimeout(() => {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.console.error("[U4A preview]=>" + e);
			}, 0);
		}
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oLink = document.getElementById("U4AStyleLink");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (bReset === true) {
		// @u4a-src Repeats the following block while the preview condition remains true.
		while (oLink.firstChild) {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oLink.removeChild(oLink.firstChild);
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof vLink === "string") {
		lf_createLink(vLink);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (jQuery.isArray(vLink) === true) {
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var i = 0, l = vLink.length; i < l; i++) {
			lf_createLink(vLink[i]);
		}
	}
}

/**
 * @u4a-doc
 * Writes inline CSS source into the preview document.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: sSource.
 */
function setCSSSource(sSource) {
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oStyle = document.getElementById("U4AStyle");
	oStyle.innerHTML = sSource;
}

/**
 * @u4a-doc
 * Applies application CSS links and inline CSS source to the preview document.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 */
function setPreviewCSS() {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_css = [];
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.DATA.APPDATA.T_CSLK.length !== 0) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _aCSLK = parent.oAPP.DATA.APPDATA.T_CSLK.filter(item => item?.INACTIVE !== "X");
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var i = 0, l = _aCSLK.length; i < l; i++) {
			lt_css.push(_aCSLK[i].URL);
		}
	}
	setCSSLink(lt_css, true);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_css = parent.oAPP.DATA.APPDATA.T_EDIT.find(a => a.OBJTY === "CS");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!ls_css || ls_css.DATA === "") {
		setCSSSource("");
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	setCSSSource(ls_css.DATA);
}

/**
 * @u4a-doc
 * Function that applies PrevPropVal to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: OBJID, UIATT, UIATV.
 */
function setPrevPropVal(OBJID, UIATT, UIATV) {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_propnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[OBJID], "1", UIATT, "_sMutator");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[OBJID][l_propnm](UIATV);
}

/**
 * @u4a-doc
 * Function that applies UiLoadLibraries to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: it_lib.
 */
function setUiLoadLibraries(it_lib) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof it_lib === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (it_lib.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = it_lib.length; i < l; i++) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.getCore().loadLibrary(it_lib[i]);
	}
}

/**
 * @u4a-doc
 * Function local helper used by the containing workflow.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: UIOBK.
 */
function lf_excepRequire(UIOBK) {
	// @u4a-src Branches by value so UI-specific preview behavior can stay grouped.
	switch (UIOBK) {
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO00455":
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: aVisibleTiles.
			 */
			sap.m.TileContainer.prototype._updateTileDimensionInfoAndPageSize = function(aVisibleTiles) {
				// @u4a-src Defines local state used by the following preview calculation.
				var l_dom = this.$("pager");
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!l_dom || !l_dom[0]) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				aVisibleTiles = aVisibleTiles || this._getVisibleTiles();
				this._oTileDimensionCalculator.calc(aVisibleTiles);
				this._calculatePageSize(aVisibleTiles);
			};
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 */
			sap.m.TileContainer.prototype._getContentDimension = function() {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!this.getDomRef()) {
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this.__beforeScrl) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return this.__beforeScrl;
					}
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Defines local state used by the following preview calculation.
				var oScroll = this.$("scrl");
				this.__beforeScrl = {
					width: oScroll.width(),
					height: oScroll.height() - 20,
					outerheight: oScroll.outerHeight() - 20,
					outerwidth: oScroll.outerWidth(),
				};
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return {
					width: oScroll.width(),
					height: oScroll.height() - 20,
					outerheight: oScroll.outerHeight() - 20,
					outerwidth: oScroll.outerWidth()
				};
			};
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 */
			sap.m.TileContainer.prototype._calculateDimension = function() {
				// @u4a-src Defines local state used by the following preview calculation.
				var oDomRef = this.$();
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oDomRef) {
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this.__before) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return {
							width: 0,
							height: 0,
							outerheight: 0,
							outerwidth: 0
						};
					}
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return {
					width: oDomRef.width(),
					height: oDomRef.height(),
					outerheight: oDomRef.outerHeight(),
					outerwidth: oDomRef.outerWidth()
				};
			};
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 */
			sap.m.TileContainer.prototype._resize = function() {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this._oDragSession) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Defines local state used by the following preview calculation.
				var l_dom = this.$("pager");
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!l_dom || !l_dom[0]) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Defines local state used by the following preview calculation.
				var l_dom = this.$("cnt");
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!l_dom || !l_dom[0]) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Schedules preview work to run outside the current browser event frame.
				/**
				 * @u4a-doc
				 * Timer/frame callback used to defer preview work until the browser can update safely.
				 */
				setTimeout(jQuery.proxy(function() {
					// @u4a-src Defines local state used by the following preview calculation.
					var l_dom = this.$("pager");
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!l_dom || !l_dom[0]) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					}
					// @u4a-src Defines local state used by the following preview calculation.
					var l_dom = this.$("cnt");
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!l_dom || !l_dom[0]) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					}
					// @u4a-src Defines local state used by the following preview calculation.
					var aVisibleTiles = this._getVisibleTiles(),
						iTilesCount = aVisibleTiles.length,
						iCurrentPageStartTileIndex = this._iCurrentTileStartIndex,
						oOldDim = this._oDim,
						iNewPage, iNewPageTileStartIndex, iNewPageTileEndIndex;
					this._oPagesInfo.reset();
					this._oDim = this._calculateDimension();
					this._updateTileDimensionInfoAndPageSize(aVisibleTiles);
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (oOldDim.width !== this._oDim.width || oOldDim.height !== this._oDim.height) {
						// @u4a-src Iterates through a collection and applies the same preview rule to each item.
						for (var i = 0; i < iTilesCount; i++) {
							// @u4a-src Checks a required condition before the following preview logic continues.
							if (aVisibleTiles[i]._rendered) {
								aVisibleTiles[i]._rendered = false;
								aVisibleTiles[i].$().remove();
							}
						}
						iNewPage = this._getPageNumberForTile(iCurrentPageStartTileIndex);
						iNewPageTileStartIndex = iNewPage * this._iMaxTiles;
						iNewPageTileEndIndex = iNewPageTileStartIndex + this._iMaxTiles - 1;
						this._renderTiles(aVisibleTiles, iNewPageTileStartIndex, iNewPageTileEndIndex);
					}
				}, this), 0);
			};
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oEvent.
			 */
			sap.m.TileContainer.prototype._onmove = function(oEvent) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this?.isDestroyed && this.isDestroyed() === true) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (document.selection && document.selection.clear) {
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					document.selection.clear();
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oEvent.isMarked("delayedMouseEvent")) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oEvent.targetTouches && oEvent.targetTouches.length > 1) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (typeof this._oTouchSession === "undefined") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!oEvent.targetTouches) {
					oEvent.targetTouches = [{
						pageX: oEvent.pageX,
						pageY: oEvent.pageY
					}];
				}
				// @u4a-src Defines local state used by the following preview calculation.
				var oTouchSession = this._oTouchSession;
				oTouchSession.fDiffX = oTouchSession.fStartX - oEvent.targetTouches[0].pageX;
				oTouchSession.fDiffY = oTouchSession.fStartY - oEvent.targetTouches[0].pageY;
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this._oDragSession) {
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (Math.abs(oTouchSession.fDiffX) > 5) {
						// @u4a-src Checks a required condition before the following preview logic continues.
						if (!this._oDragSession.bStarted) {
							this._oDragSession.bStarted = true;
							this._onDragStart(oEvent);
						// @u4a-src Handles the alternate branch for the condition directly above.
						} else {
							this._onDrag(oEvent);
						}
						this._bAvoidChildTapEvent = true;
					}
				// @u4a-src Handles the alternate branch for the condition directly above.
				} else if (oTouchSession) {
					// @u4a-src Defines local state used by the following preview calculation.
					var contentWidth = this._getContentDimension().outerwidth;
					// @u4a-src Defines local state used by the following preview calculation.
					var iNewLeft = -this._iScrollLeft - oTouchSession.fDiffX;
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (iNewLeft > this._iScrollGap) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					// @u4a-src Handles the alternate branch for the condition directly above.
					} else if (iNewLeft < -(((this._oPagesInfo.getCount() - 1) * contentWidth) + this._iScrollGap)) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					}
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this._bRtl) {
						iNewLeft = iNewLeft - contentWidth;
					}
					// @u4a-src Defines local state used by the following preview calculation.
					var aVisibleTiles = this._getVisibleTiles();
					// @u4a-src Defines local state used by the following preview calculation.
					var iDirection = oTouchSession.fDiffX > 0 ? 1 : -1;
					// @u4a-src Defines local state used by the following preview calculation.
					var iGoToPageStartTileIndex = this._iCurrentTileStartIndex + iDirection * this._iMaxTiles;
					// @u4a-src Defines local state used by the following preview calculation.
					var iGoToPageEndTileIndex = iGoToPageStartTileIndex + this._iMaxTiles - 1;
					this._renderTiles(aVisibleTiles, iGoToPageStartTileIndex, iGoToPageEndTileIndex);
					// @u4a-src Defines local state used by the following preview calculation.
					var l_dom = this.$("cnt");
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!l_dom || !l_dom[0]) {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					}
					this._applyTranslate(this.$("cnt"), iNewLeft, 0, false);
				}
			};
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO02014":
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO02082":
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/gantt/simple/ListLegendItem");
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO02220":
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/ui/vbm/AnalyticMap");
			sap.ui.vbm.AnalyticMap.DefaultABAPGeoJSONURL = sap.ui.resource("sap.ui.vbm", sap.ui.vbm.AnalyticMap.DefaultABAPGeoJSONURL);
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO01786":
			richTextEditorException();
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO01866":
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 */
			sap.suite.ui.commons.networkgraph.Graph.prototype._preprocessData = function() {
				this._bIsLayedOut = false;
				this._bImageLoaded = false;
				this.fireBeforeLayouting();
				// @u4a-src Defines local state used by the following preview calculation.
				var that = this;
				// @u4a-src Defines local state used by the following preview calculation.
				/**
				 * @u4a-doc
				 * Timer/frame callback used to defer preview work until the browser can update safely.
				 */
				var l_intv = setInterval(function() {
					// @u4a-src Defines local state used by the following preview calculation.
					var l_grp = that.$("divgroups");
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (l_grp && l_grp[0]) {
						clearInterval(l_intv);
						that._applyLayout().then(that._render.bind(that));
					}
				}, 100);
			};
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO01139":
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO01142":
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO02076":
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/ui/table/utils/TableUtils");
			/**
			 * @u4a-doc
			 * Function that returns a boolean decision used by preview guards.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oTable.
			 */
			sap.ui.table.utils.TableUtils.isVariableRowHeightEnabled = function(oTable) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return false;
			};
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case "UO00338":
			/**
			 * @u4a-doc
			 * Function that removes Aggregation and cleans related preview state.
			 *
			 * Source flow:
			 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
			 * Parameters: sAggregationName, vObject, bSuppressInvalidate.
			 */
			sap.m.Menu.prototype.removeAggregation = function(sAggregationName, vObject, bSuppressInvalidate) {
				// @u4a-src Defines local state used by the following preview calculation.
				var oItem = sap.ui.core.Control.prototype.removeAggregation.apply(this, arguments);
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (sAggregationName === "items" && oItem) {
					this._removeVisualItem(oItem);
				}
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return oItem;
			};
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		default:
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
	}
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: LIBNM.
 */
function excepSapui6Library(LIBNM) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (LIBNM.substr(0, 6) !== "sapui6") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	sap.ui.getCore().loadLibrary("sap.ui.commons");
}

/**
 * @u4a-doc
 * Function that applies FixedProp to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, it_ua018, it_ua032.
 */
function setFixedProp(UIOBK, it_ua018, it_ua032) {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_ua018 = it_ua018;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!lt_ua018) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		lt_ua018 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA018" && a.FLD05 === UIOBK);
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_ua018.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return "";
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_ua018.length, l_prop = "", l_sep = "", lv_doqu = ""; i < l; i++) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIOBK === lt_ua018[i].FLD05 && a.UIATT === lt_ua018[i].FLD02);
		lv_doqu = "";
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		lv_doqu = parent.oAPP.fn.setPropDoqu(ls_0023.UIADT);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lv_doqu === "" && lt_ua018[i].FLD04 === "") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_fnst = "";
		// @u4a-src Defines local state used by the following preview calculation.
		var l_fned = "";
		// @u4a-src Defines local state used by the following preview calculation.
		var ls_ua032 = it_ua032.find(a => a.FLD01 === lt_ua018[i].FLD05 && a.FLD03 === lt_ua018[i].FLD02 && a.FLD06 !== "X");
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof ls_ua032 !== "undefined") {
			l_fnst = ls_ua032.FLD07 + "(";
			l_fned = ")";
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_ua018[i].FLD06 === "X") {
			l_prop = l_prop + l_sep + lt_ua018[i].FLD02 + ":" + l_fnst + lv_doqu + jQuery.sap.uid() + lv_doqu + l_fned;
		// @u4a-src Handles the alternate branch for the condition directly above.
		} else {
			l_prop = l_prop + l_sep + lt_ua018[i].FLD02 + ":" + l_fnst + lv_doqu + lt_ua018[i].FLD04 + lv_doqu + l_fned;
		}
		l_sep = ",";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_prop;
}

/**
 * @u4a-doc
 * Function that applies FixedProp2 to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, T_0015, T_UA030.
 */
function setFixedProp2(UIOBK, T_0015, T_UA030) {
	// @u4a-src Defines local state used by the following preview calculation.
	var sep = "",
		ls_0015, l_prop = "";
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = T_UA030.length; i < l; i++) {
		ls_0015 = T_0015.find(a => a.UIASN === T_UA030[i].FLD01);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (ls_0015) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIASN === T_UA030[i].FLD01 && a.UIOBK === T_UA030[i].FLD02);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!ls_0023) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var l_doqu = parent.oAPP.fn.setPropDoqu(ls_0023.UIADT);
		// @u4a-src Defines local state used by the following preview calculation.
		var l_uiatv = T_UA030[i].FLD05;
		l_uiatv = l_uiatv.replace(/\\/g, '\\\\');
		l_uiatv = l_uiatv.replace(/\"/g, '\\\"');
		l_prop += sep + ls_0023.UIATT + ":" + l_doqu + l_uiatv + l_doqu;
		sep = ",";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_prop;
}

/**
 * @u4a-doc
 * Resolves a browser event target DOM node back to the nearest UI5 control.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oEvent.
 */
function getEventTargetUI(oEvent) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_ui, l_node = oEvent;
	// @u4a-src Defines local state used by the following preview calculation.
	var _OBJID = undefined;
	// @u4a-src Repeats the following block while the preview condition remains true.
	while (!l_ui) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		l_ui = sap.ui.getCore().byId(l_node.id);
		_OBJID = findUiObjectID(l_ui);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _OBJID !== "undefined") {
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		}
		l_ui = undefined;
		l_node = l_node.parentNode;
		_OBJID = undefined;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!l_node) {
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		}
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_ui;
}

/**
 * @u4a-doc
 * Function that applies UIProp to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, UILIB, T_0015, T_UA018, T_UA032, T_UA030.
 */
function setUIProp(UIOBK, UILIB, T_0015, T_UA018, T_UA032, T_UA030) {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_ua018t = T_UA018.filter(a => a.FLD05 === UIOBK);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_sep = "",
		l_prop = "",
		lv_doqu = "",
		l_setProp = "";
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_ua018t.length !== 0) {
		l_prop = setFixedProp(UIOBK, lt_ua018t, T_UA032);
	}
	l_sep = l_prop !== "" ? ',' : '';
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_ua030t = T_UA030.filter(a => a.FLD02 === UIOBK);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_ua030t.length !== 0) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_prop2 = setFixedProp2(UIOBK, T_0015, lt_ua030t);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof l_prop2 !== "undefined" && l_prop2 !== "") {
			l_prop = l_prop + l_sep + l_prop2;
			l_sep = ",";
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK === "UO99986") {
		l_prop += l_sep + "placeholder:\"ExcelUploader\"";
		l_sep = ",";
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK === "UO99992") {
		l_prop += l_sep + "placeholder:\"SelectOption\"";
		l_sep = ",";
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (T_0015.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return [l_prop, l_setProp];
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_meta;
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Defines local state used by the following preview calculation.
		var _oUi = getUIClassInstance(UILIB);
		l_meta = _oUi.getMetadata();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = T_0015.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_0015[i].UIASN === "DRAGABLE") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_0015[i].UIASN === "DROPABLE") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.fn.prevSkipProp(T_0015[i])) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_0015[i].UIATY !== "1" || T_0015[i].ISBND === "X") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_0015[i].UIASN === "STYLECLASS" && T_0015[i].UIATV !== "" && T_0015[i].UIATK.substr(0, 3) === "EXT") {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			l_setProp += "parent.oAPP.attr.prev." + T_0015[i].OBJID + ".addStyleClass(\"" + T_0015[i].UIATV + "\");";
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_uiatv = T_0015[i].UIATV;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_ua018t.length !== 0) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (lt_ua018t.findIndex(a => a.FLD05 === UIOBK && a.FLD02 === T_0015[i].UIATT) !== -1) {
				// @u4a-src Skips the remaining loop body for this item and moves to the next one.
				continue;
			}
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof l_meta !== "undefined") {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (T_0015[i].UIATK.indexOf("_1") === -1 && typeof l_meta.getProperty(T_0015[i].UIATT) === "undefined") {
				// @u4a-src Skips the remaining loop body for this item and moves to the next one.
				continue;
			}
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		l_uiatv = parent.oAPP.fn.prevParseOTRValue(T_0015[i]) || l_uiatv;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		lv_doqu = parent.oAPP.fn.setPropDoqu(T_0015[i].UIADT);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_0015[i].UIADT !== "string" && l_uiatv === "") {
			lv_doqu = "";
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (l_uiatv === "" && lv_doqu === "") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		l_uiatv = l_uiatv.replace(/\\/g, '\\\\');
		l_uiatv = l_uiatv.replace(/\"/g, '\\\"');
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		l_uiatv = parent.oAPP.fn.setHTMLContentProp(T_0015[i]) || l_uiatv;
		l_uiatv = l_uiatv.replace(/\r?\n|\r/g, "\\n");
		// @u4a-src Defines local state used by the following preview calculation.
		var l_fnst = "",
			l_fned = "";
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (T_UA032) {
			// @u4a-src Defines local state used by the following preview calculation.
			var ls_ua032 = T_UA032.find(a => a.FLD01 === UIOBK && a.FLD03 === T_0015[i].UIATT);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (ls_ua032 && ls_ua032.FLD07 !== "") {
				l_fnst = ls_ua032.FLD07 + "(";
				l_fned = ")";
			}
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (l_uiatv.indexOf("{") !== -1) {
			l_setProp = l_setProp + "setPrevPropVal('" + T_0015[i].OBJID + "','" + T_0015[i].UIATT + "'," + l_fnst + "\"" + l_uiatv + "\"" + l_fned + ");";
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		l_prop = l_prop + l_sep + T_0015[i].UIATT + ":" + l_fnst + lv_doqu + l_uiatv + lv_doqu + l_fned;
		l_sep = ",";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return [l_prop, l_setProp];
}

/**
 * @u4a-doc
 * Function that applies ChildUiException to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, OBJID, it_child, it_ua050, bIgnore.
 */
function setChildUiException(UIOBK, OBJID, it_child, it_ua050, bIgnore) {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_ua050 = [];
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof it_ua050 === "undefined") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		lt_ua050 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA050" && a.FLD01 === UIOBK && a.FLD08 !== "X");
	// @u4a-src Handles the alternate branch for the condition directly above.
	} else {
		lt_ua050 = it_ua050.filter(a => a.FLD01 === UIOBK && a.FLD08 !== "X");
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_ua050.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof it_child === "undefined" && bIgnore !== true) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_tree = parent.oAPP.fn.getTreeData(OBJID);
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var _script = "";
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_ua050.length, l_indx = 0; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (denyChildAggregation(UIOBK, lt_ua050[i].FLD03) === true) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		let _aChild = parent.oAPP.attr.prev[OBJID].getAggregation(lt_ua050[i].FLD03);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (Array.isArray(_aChild) === true && _aChild.length > 0) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			for (var j = 0, jl = _aChild.length; j < jl; j++) {
				// @u4a-src Defines local state used by the following preview calculation.
				let _oChild = _aChild[j];
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (_oChild.data("UA050") === true) {
					// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
					parent.oAPP.attr.prev[OBJID].removeAggregation(lt_ua050[i].FLD03, _oChild);
				}
			}
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (bIgnore === true) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof it_child !== "undefined") {
			l_indx = it_child.findIndex(a => a.UIATT === lt_ua050[i].FLD03);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (l_indx !== -1) {
				// @u4a-src Skips the remaining loop body for this item and moves to the next one.
				continue;
			}
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		l_indx = ls_tree.zTREE.findIndex(a => a.POBID === OBJID && a.UIATT === lt_ua050[i].FLD03);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (l_indx !== -1) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_ua050[i].FLD01 === "UO02273") {
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/ui/vbm/AnalyticMap");
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
	}
	eval(_script);
}

/**
 * @u4a-doc
 * Function that applies RichTextEditorException to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, OBJID.
 */
function setRichTextEditorException(UIOBK, OBJID) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK !== "UO01786") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[OBJID].addButtonGroup("table");
}

/**
 * @u4a-doc
 * Function that decides whether a special UI or aggregation path must be skipped.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: UIOBK.
 */
function skipUiTableRow(UIOBK) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK === "UO01131") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
}

/**
 * @u4a-doc
 * Function that decides whether a special UI or aggregation path must be skipped.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: PUIOK, UIATT.
 */
function skipUiMTreeItem(PUIOK, UIATT) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (PUIOK === "UO00467" && UIATT === "items") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
}

/**
 * @u4a-doc
 * Function that decides whether a special UI or aggregation path must be skipped.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: PUIOK, UIATT.
 */
function denyChildAggregation(PUIOK, UIATT) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.S_CODE.UW05.findIndex(a => a.FLD01 === PUIOK && a.FLD03 === UIATT && a.FLD04 !== "X") !== -1) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
}

/**
 * @u4a-doc
 * Function that decides whether a special UI or aggregation path must be skipped.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: POBID, UIATT.
 */
function skipSplitterLayoutData(POBID, UIATT) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIATT !== "layoutData") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_parent = parent.oAPP.fn.getTreeData(POBID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ls_parent.PUIOK !== "UO00998") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return true;
}

/**
 * @u4a-doc
 * Adds one UI object to the preview model and rendered UI tree.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: OBJID, UIOBK, UILIB, UIFND, POBID, PUIOK, UIATT, T_0015, T_UA018, T_UA032, T_UA030, T_UA026, T_UA050.
 */
function addUIObjPreView(OBJID, UIOBK, UILIB, UIFND, POBID, PUIOK, UIATT, T_0015, T_UA018, T_UA032, T_UA030, T_UA026, T_UA050) {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_0022 = parent.oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === UIOBK);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ls_0022 && ls_0022.TGLIB !== "" && ls_0022.UIFND.indexOf("U4A.") === -1 && ls_0022.UIFND.indexOf("SAPUI6.") === -1) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.getCore().loadLibrary(ls_0022.TGLIB);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_0015 = [];
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof T_0015 !== "undefined") {
		lt_0015 = T_0015;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_ua050 = T_UA050;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof lt_ua050 === "undefined") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		lt_ua050 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA050" && a.FLD08 !== "X");
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var _sTree = parent.oAPP.fn.crtStru0014();
	_sTree.UIOBK = UIOBK;
	_sTree.OBJID = OBJID;
	_sTree.POBID = POBID;
	_sTree.ISECP = ls_0022.ISECP;
	createUIInstance(_sTree, lt_0015);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (collectPopup(UILIB, OBJID) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	setRichTextEditorException(UIOBK, OBJID);
	setChildUiException(UIOBK, OBJID, undefined, lt_ua050);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sMutator");
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		console.log(e);
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.prevDrawExceptionUi(UIOBK, OBJID);
}
/**
 * @u4a-doc
 * Async function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: OBJID.
 */
async function selPreviewUI(OBJID) {
	// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
	await oWS.sMark.fn_mark(parent.oAPP.attr.prev[OBJID]);
}

/**
 * @u4a-doc
 * Function that reads or derives AggrInfo without changing preview state.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: OBJID.
 */
function getAggrInfo(OBJID) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof parent.oAPP.attr.prev[OBJID].__PARENT === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_meta = parent.oAPP.attr.prev[OBJID].__PARENT.getMetadata();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_meta) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_meta.getAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR);
}

/**
 * @u4a-doc
 * Function that removes UIDenyChildAggr and cleans related preview state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK.
 */
function removeUIDenyChildAggr(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (POBID === parent.oAPP.attr.prev[OBJID].__PARENT._OBJID && UIATT === parent.oAPP.attr.prev[OBJID]._EMBED_AGGR) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_aggr = getAggrInfo(OBJID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_aggr) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_parent = parent.oAPP.fn.getTreeData(parent.oAPP.attr.prev[OBJID].__PARENT._OBJID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ls_parent) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (denyChildAggregation(ls_parent.UIOBK, parent.oAPP.attr.prev[OBJID]._EMBED_AGGR) === true) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_aggr.multiple === true) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_remove = l_aggr._sRemoveMutator;
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].__PARENT[l_remove](parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				console.log(e);
			}
		}
	// @u4a-src Handles the alternate branch for the condition directly above.
	} else {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_agrnm = l_aggr._sMutator;
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].__PARENT[l_agrnm]();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[OBJID].__PARENT.setAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				console.log(e);
			}
		}
	}
}

/**
 * @u4a-doc
 * Function that repositions UI/control data inside a preview aggregation.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK, OBJID.
 */
function moveUIExcep(UIOBK, OBJID) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!parent.oAPP.attr.S_CODE.UW06) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var lt_UW06 = parent.oAPP.attr.S_CODE.UW06.filter(a => a.FLD01 === UIOBK && a.FLD04 !== "X");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_UW06.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_UW06.length; i < l; i++) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		var l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[OBJID].sId + lt_UW06[i].FLD03);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (l_ui) {
			// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
			l_ui.destroy();
		}
	}
}

/**
 * @u4a-doc
 * Moves a rendered preview UI to a new aggregation position.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: OBJID, UILIB, POBID, PUIOK, UIATT, indx, ISMLB, UIOBK, bSkipRemove.
 */
function moveUIObjPreView(OBJID, UILIB, POBID, PUIOK, UIATT, indx, ISMLB, UIOBK, bSkipRemove) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		removeUIDenyChildAggr(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (collectPopup(UILIB, OBJID) === true) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI._OBJID === OBJID) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_aggr = getAggrInfo(OBJID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_aggr && l_aggr.multiple === true && bSkipRemove !== true) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_remove = l_aggr._sRemoveMutator;
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].__PARENT[l_remove](parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				console.log(e);
			}
		}
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
	moveUIExcep(UIOBK, OBJID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ISMLB === "") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sMutator");
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[POBID].setAggregation(UIATT, parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				console.log(e);
			}
		}
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sInsertMutator");
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID], indx);
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[POBID].insertAggregation(UIATT, parent.oAPP.attr.prev[OBJID], indx);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			console.log(e);
		}
	}
}

/**
 * @u4a-doc
 * Function that releases preview UI instances, DOM, or UI5 resources.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: OBJID, POBID, UIOBK, PUIOK.
 */
function destroyUIPreView(OBJID, POBID, UIOBK, PUIOK) {
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
		parent.oAPP.attr.prev[OBJID].destroy();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		console.log("destroyUIPreView - " + OBJID);
	}
}

/**
 * @u4a-doc
 * Deletes one preview UI from its parent aggregation and design-time caches.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK.
 */
function delUIObjPreView(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI._OBJID === OBJID) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.UA015UI = null;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_param = ISMLB === "X" ? "_sRemoveMutator" : "_sMutator";
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, l_param);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ISMLB === "") {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[POBID][l_agrnm]();
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			freeUiDom(parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			// @u4a-src Starts a protected block so preview errors can be contained.
			try {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[POBID].setAggregation(UIATT);
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				freeUiDom(parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Handles an error raised by the protected preview block.
			} catch (e) {
				console.log(e);
			}
		}
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		freeUiDom(parent.oAPP.attr.prev[OBJID]);
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[POBID].removeAggregation(UIATT, parent.oAPP.attr.prev[OBJID]);
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			freeUiDom(parent.oAPP.attr.prev[OBJID]);
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			console.log(e);
		}
	}
}

/**
 * @u4a-doc
 * Function that releases preview UI instances, DOM, or UI5 resources.
 *
 * Source flow:
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi.
 */
function freeUiDom(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || !oUi.getDomRef) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var l_dom = oUi.getDomRef();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_dom) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		l_dom.remove();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
	freeUiDom(oUi);
}

/**
 * @u4a-doc
 * Function that removes AllTreeChild and cleans related preview state.
 *
 * Source flow:
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: is_tree.
 */
function removeAllTreeChild(is_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.zTREE.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_aggr = [];
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
		removeAllTreeChild(is_tree.zTREE[i]);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.zTREE[i].ISMLB !== "X") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_aggr.findIndex(a => a === is_tree.zTREE[i].UIATT) !== -1) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.zTREE[i].UIADT === "sap.ui.table.Row") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.zTREE[i].UIADT === "sap.m.PlanningCalendarView") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		lt_aggr.push(is_tree.zTREE[i].UIATT);
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof parent.oAPP.attr.prev[is_tree.OBJID]._pageStack !== "undefined") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._pageStack = [];
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_aggr.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (i = 0,
		l = lt_aggr.length; i < l; i++) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var l_remove = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[is_tree.OBJID], "3", lt_aggr[i], "_sRemoveAllMutator");
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[is_tree.OBJID].removeAllAggregation(lt_aggr[i]);
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[is_tree.OBJID][l_remove]();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}
}

/**
 * @u4a-doc
 * Function that rebuilds preview state after design data changes.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: is_tree, IT_UA015.
 */
function reconstructPrevUI(is_tree, IT_UA015) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.zTREE.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.zTREE[i].OBJID === "APP") {
			reconstructPrevUI(is_tree.zTREE[i], IT_UA015);
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_indx = getUiPosition(is_tree.zTREE[i], is_tree.zTREE, IT_UA015);
		moveUIObjPreView(is_tree.zTREE[i].OBJID, is_tree.zTREE[i].UILIB, is_tree.zTREE[i].POBID, is_tree.zTREE[i].PUIOK, is_tree.zTREE[i].UIATT, l_indx, is_tree.zTREE[i].ISMLB, is_tree.zTREE[i].UIOBK);
		reconstructPrevUI(is_tree.zTREE[i], IT_UA015);
	}
}

/**
 * @u4a-doc
 * Function that reads or derives UiPosition without changing preview state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: is_tree, it_tree, IT_UA015.
 */
function getUiPosition(is_tree, it_tree, IT_UA015) {
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var l_cnt = 0, i = 0, l = it_tree.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.OBJID === it_tree[i].OBJID) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return l_cnt;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.UIATT !== it_tree[i].UIATT) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (IT_UA015.findIndex(a => a.FLD01 === it_tree[i].UIFND && a.FLD03 !== "") !== -1) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		l_cnt += 1;
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_cnt;
}

/**
 * @u4a-doc
 * Rebuilds a portion of the preview tree after a design change.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: is_tree.
 */
async function refreshPreview(is_tree) {
	// @u4a-src Returns the computed preview value or exits the function at this point.
	/**
	 * @u4a-doc
	 * Promise callback that coordinates asynchronous preview rendering or synchronization.
	 */
	return new Promise(async (resolve) => {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.OBJID === "ROOT") {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			is_tree = parent.oAPP.fn.getTreeData("APP");
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI === parent.oAPP.attr.prev[is_tree.OBJID]) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			var ls_UA015 = parent.oAPP.attr.S_CODE.UA015.find(a => a.FLD01 === parent.oAPP.attr.UA015UI.__UIFND);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (parent.oAPP.attr.ui.prevRootPage.getContent().length === 0 && ls_UA015?.FLD03 === "") {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.ui.prevRootPage.addContent(parent.oAPP.attr.prev[is_tree.OBJID]);

				// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
				await _oPromise;

				// @u4a-src Defines local state used by the following preview calculation.
				var _aPromise = _oRender.renderingRichTextEditor(is_tree, true);

				// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
				await Promise.all(_aPromise);
			}
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return resolve();
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_ua015 = parent.oAPP.attr.S_CODE.UA015.find(a => a.CATCD === "UA015" && a.FLD01 === is_tree.UIFND);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!ls_ua015) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			var ls_parent = parent.oAPP.fn.getTreeData(is_tree.POBID);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!ls_parent) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return resolve();
			}
			// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
			await refreshPreview(ls_parent);
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return resolve();
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof parent.oAPP.attr.UA015UI?._OBJID !== "undefined" && parent.oAPP.attr.UA015UI !== null) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			var _sBefore = parent.oAPP.fn.getTreeData(parent.oAPP.attr?.UA015UI._OBJID);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof _sBefore !== "undefined") {
				// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
				parent.oAPP.attr?.UA015UI.destroy();
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.UA015UI = undefined;
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.fn.removeCollectPopup(_sBefore.OBJID);
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				createUIInstance(_sBefore, parent.oAPP.attr.prev[_sBefore.OBJID]._T_0015);
				redrawUIScript(_sBefore.zTREE);
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (_sBefore.OBJID !== "APP") {
					// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
					var _sParent = parent.oAPP.fn.getTreeData(_sBefore.POBID);
					// @u4a-src Defines local state used by the following preview calculation.
					var _aChild = _sParent.zTREE.filter(a => a.UIATK === _sBefore.UIATK);
					// @u4a-src Defines local state used by the following preview calculation.
					var _indx = _aChild.findIndex(item => item.OBJID === _sBefore.OBJID);
					moveUIObjPreView(_sBefore.OBJID, _sBefore.UILIB, _sBefore.POBID, _sBefore.PUIOK, _sBefore.UIATT, _indx, _sBefore.ISMLB, _sBefore.UIOBK, true);
				}
			}
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.ui.prevRootPage.removeAllContent();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
		// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
		parent.oAPP.attr.ui.prevRootPage.invalidate();
		// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
		await _oPromise;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.UA015UI = parent.oAPP.attr.prev[is_tree.OBJID];
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.UA015UI.__UIFND = is_tree.UIFND;
		prevClearDropEffect();
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _oTarget = _oRender.getTargetAfterRenderingUI(parent.oAPP.attr.UA015UI);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _oTarget?.setVisible === "function") {
			_oTarget.setVisible(true);
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var _oPromise = _oRender.setAfterRendering(_oTarget);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (_oTarget?.isA("sap.m.NavContainer") === true && _oTarget?._pageStack) {
			_oTarget._pageStack = [];
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _oExcepUI = parent.oAPP.attr.UA015UI;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (ls_ua015.FLD03 !== "" && ls_ua015.FLD04 === "") {
			_oExcepUI[ls_ua015.FLD03]();
		// @u4a-src Handles the alternate branch for the condition directly above.
		} else if (ls_ua015.FLD03 !== "" && ls_ua015.FLD04 === "X") {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			_oExcepUI[ls_ua015.FLD03](parent.oAPP.attr.ui.prevPopupArea);
		// @u4a-src Handles the alternate branch for the condition directly above.
		} else {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.ui.prevRootPage.addContent(_oExcepUI);
		}
		refreshPreviewExcep(_oExcepUI);
		// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
		await _oPromise;

		// @u4a-src Defines local state used by the following preview calculation.
		var _aPromise = _oRender.renderingRichTextEditor(is_tree, true);

		// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
		await Promise.all(_aPromise);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return resolve();
	});
}

/**
 * @u4a-doc
 * Function that rebuilds preview state after design data changes.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oExcepUi.
 */
function refreshPreviewExcep(oExcepUi) {
	// @u4a-src Branches by value so UI-specific preview behavior can stay grouped.
	switch (true) {
		// @u4a-src Handles one branch of the surrounding switch statement.
		case oExcepUi.isA("sap.ui.unified.Menu"):
			oExcepUi.bOpen = false;
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case oExcepUi.isA("sap.m.Menu"):
			// @u4a-src Defines local state used by the following preview calculation.
			var _oMenu = oExcepUi._getMenu();
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof _oMenu !== "undefined" && _oMenu !== null) {
				_oMenu.bOpen = false;
			}
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case oExcepUi.isA("sap.m.ActionSheet"):
			// @u4a-src Defines local state used by the following preview calculation.
			var _oParent = oExcepUi.getParent();
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof _oParent !== "undefined" && typeof _oParent?.setModal === "function") {
				_oParent.setModal(true);
				_oParent.setPlacement("Auto");
			}
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		// @u4a-src Handles one branch of the surrounding switch statement.
		case typeof oExcepUi._oPopover !== "undefined":
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oExcepUi._oPopover.setModal) {
				oExcepUi._oPopover.setModal(true);
			}
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
	}
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 */
function prevClearDropEffect() {
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_dom === null || l_dom.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	l_dom[0].setAttribute("style", "");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	l_dom[0].style.display = "none";
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 */
function closePopup() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.popup.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = parent.oAPP.attr.popup.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!parent.oAPP.attr.popup[i].getDomRef()) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.attr.UA015UI === parent.oAPP.attr.popup[i]) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.attr.popup[i].close) {
			// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
			parent.oAPP.attr.popup[i].close();
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.attr.popup[i]._onCancel) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.popup[i]._onCancel();
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
	}
}

/**
 * @u4a-doc
 * Function that collects candidate DOM/control data for later processing.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: UILIB, OBJID, IT_UA015.
 */
function collectPopup(UILIB, OBJID, IT_UA015) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.popup.findIndex(a => a === parent.oAPP.attr.prev[OBJID]) !== -1) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_UIFND = UILIB.toUpperCase();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (IT_UA015) {
		// @u4a-src Defines local state used by the following preview calculation.
		var ls_ua015 = IT_UA015.find(a => a.FLD01 === l_UIFND && a.FLD03 !== "X" && a.FLD03 !== "");
	// @u4a-src Handles the alternate branch for the condition directly above.
	} else {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_ua015 = parent.oAPP.DATA.LIB.T_9011.find(a => a.CATCD === "UA015" && a.FLD01 === l_UIFND && a.FLD03 !== "");
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!ls_ua015) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.popup.push(parent.oAPP.attr.prev[OBJID]);
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return true;
}

/**
 * @u4a-doc
 * Handles left-click selection inside the preview iframe and forwards OBJID selection to the parent.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oEvent.
 */
function setUIClickEvent(oEvent) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (event.button !== 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	event.preventDefault();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sap.ui.getCore().isLocked() === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.fn.fnWindowMenuClose) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.fnWindowMenuClose();
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var _oUi = getEventTargetUI(event.target);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _oUi === "undefined" || _oUi === null) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var _OBJID = findUiObjectID(_oUi);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _OBJID === "undefined" || _OBJID === null) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.setSelectTreeItem(_OBJID);
}

/**
 * @u4a-doc
 * Finds the design OBJID stored on a UI5 control or nested CustomData object.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: oUi.
 */
function findUiObjectID(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUi === "undefined" || oUi === null) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUi?._OBJID !== "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return oUi._OBJID;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUi?.data !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var _oData = oUi.data();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _oData === "undefined" || _oData === null) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var fld in _oData) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (fld === "OBJID" && typeof _oData[fld] !== "undefined" && _oData[fld] !== null) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return _oData[fld];
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var _OBJID = findUiObjectID(_oData[fld]);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _OBJID !== "undefined") {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return _OBJID;
		}
	}
}

function suppressPreviewContextMenuEvent(oEvent) {
	if (!oEvent) {
		return;
	}

	if (typeof oEvent.preventDefault === "function") {
		oEvent.preventDefault();
	}

	if (typeof oEvent.stopImmediatePropagation === "function") {
		oEvent.stopImmediatePropagation();
	}

	if (typeof oEvent.stopPropagation === "function") {
		oEvent.stopPropagation();
	}
}

function getPreviewContextMenuFiniteNumber(vValue) {
	if (typeof vValue === "number" && isFinite(vValue)) {
		return vValue;
	}
}

function getPreviewContextMenuScrollOffset() {
	return {
		left: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
		top: window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
	};
}

function getPreviewContextMenuOpenDom(oUi) {
	if (!oUi) {
		return;
	}

	var oTargetDom = getPreviewSelectionTargetDom(oUi);

	if (oTargetDom) {
		return oTargetDom;
	}

	if (typeof oUi?.getDomRef === "function") {
		return oUi.getDomRef();
	}
}

function getPreviewContextMenuOpenSnapshot(oEvent, oUi) {
	var oTargetDom = getPreviewContextMenuOpenDom(oUi);
	var oRect = oTargetDom && typeof oTargetDom.getBoundingClientRect === "function" ? oTargetDom.getBoundingClientRect() : null;
	var oScroll = getPreviewContextMenuScrollOffset();
	var iClientX = getPreviewContextMenuFiniteNumber(oEvent?.clientX);
	var iClientY = getPreviewContextMenuFiniteNumber(oEvent?.clientY);
	var iPageX = getPreviewContextMenuFiniteNumber(oEvent?.pageX);
	var iPageY = getPreviewContextMenuFiniteNumber(oEvent?.pageY);
	var oSnapshot = {
		clientX: iClientX,
		clientY: iClientY,
		pageX: iPageX,
		pageY: iPageY,
		screenX: getPreviewContextMenuFiniteNumber(oEvent?.screenX),
		screenY: getPreviewContextMenuFiniteNumber(oEvent?.screenY),
		offsetX: undefined,
		offsetY: undefined,
		ctrlKey: oEvent?.ctrlKey === true,
		shiftKey: oEvent?.shiftKey === true,
		altKey: oEvent?.altKey === true,
		metaKey: oEvent?.metaKey === true
	};

	if (typeof iClientX === "undefined" && typeof iPageX !== "undefined") {
		oSnapshot.clientX = iPageX - oScroll.left;
	}

	if (typeof iClientY === "undefined" && typeof iPageY !== "undefined") {
		oSnapshot.clientY = iPageY - oScroll.top;
	}

	if (
		oRect &&
		typeof oSnapshot.clientX !== "undefined" &&
		typeof oSnapshot.clientY !== "undefined"
	) {
		oSnapshot.offsetX = Math.max(0, Math.min(oSnapshot.clientX - oRect.left, Math.max(oRect.width - 1, 0)));
		oSnapshot.offsetY = Math.max(0, Math.min(oSnapshot.clientY - oRect.top, Math.max(oRect.height - 1, 0)));
	}

	return oSnapshot;
}

function waitPreviewContextMenuOpenFrame() {
	return new Promise(function(resolve) {
		if (typeof window.requestAnimationFrame !== "function") {
			window.setTimeout(resolve, 0);
			return;
		}

		window.requestAnimationFrame(function() {
			window.setTimeout(resolve, 0);
		});
	});
}

function getPreviewContextMenuOpenPoint(oSnapshot, oTargetDom) {
	var oRect = oTargetDom && typeof oTargetDom.getBoundingClientRect === "function" ? oTargetDom.getBoundingClientRect() : null;
	var oScroll = getPreviewContextMenuScrollOffset();
	var iClientX = oSnapshot?.clientX;
	var iClientY = oSnapshot?.clientY;
	var iScreenX;
	var iScreenY;

	if (oRect && oRect.width > 0 && oRect.height > 0) {
		if (typeof oSnapshot?.offsetX !== "undefined" && typeof oSnapshot?.offsetY !== "undefined") {
			iClientX = oRect.left + Math.max(0, Math.min(oSnapshot.offsetX, Math.max(oRect.width - 1, 0)));
			iClientY = oRect.top + Math.max(0, Math.min(oSnapshot.offsetY, Math.max(oRect.height - 1, 0)));
		} else {
			iClientX = oRect.left + Math.min(oRect.width / 2, 12);
			iClientY = oRect.top + Math.min(oRect.height / 2, 12);
		}
	}

	if (typeof iClientX === "undefined") {
		iClientX = 0;
	}

	if (typeof iClientY === "undefined") {
		iClientY = 0;
	}

	if (typeof oSnapshot?.screenX !== "undefined" && typeof oSnapshot?.clientX !== "undefined") {
		iScreenX = oSnapshot.screenX + (iClientX - oSnapshot.clientX);
	} else {
		iScreenX = iClientX;
	}

	if (typeof oSnapshot?.screenY !== "undefined" && typeof oSnapshot?.clientY !== "undefined") {
		iScreenY = oSnapshot.screenY + (iClientY - oSnapshot.clientY);
	} else {
		iScreenY = iClientY;
	}

	return {
		clientX: iClientX,
		clientY: iClientY,
		pageX: iClientX + oScroll.left,
		pageY: iClientY + oScroll.top,
		screenX: iScreenX,
		screenY: iScreenY
	};
}

function createPreviewContextMenuOpenEvent(oSnapshot, oTargetDom) {
	var oPoint = getPreviewContextMenuOpenPoint(oSnapshot, oTargetDom);
	var oOpenEvent;

	if (typeof jQuery === "function" && typeof jQuery.Event === "function") {
		oOpenEvent = jQuery.Event("contextmenu");
	} else {
		oOpenEvent = {};
	}

	oOpenEvent.type = "contextmenu";
	oOpenEvent.target = oTargetDom;
	oOpenEvent.currentTarget = oTargetDom;
	oOpenEvent.srcElement = oTargetDom;
	oOpenEvent.view = window;
	oOpenEvent.bubbles = true;
	oOpenEvent.cancelable = true;
	oOpenEvent.button = 2;
	oOpenEvent.buttons = 0;
	oOpenEvent.which = 3;
	oOpenEvent.clientX = oPoint.clientX;
	oOpenEvent.clientY = oPoint.clientY;
	oOpenEvent.pageX = oPoint.pageX;
	oOpenEvent.pageY = oPoint.pageY;
	oOpenEvent.screenX = oPoint.screenX;
	oOpenEvent.screenY = oPoint.screenY;
	oOpenEvent.ctrlKey = oSnapshot?.ctrlKey === true;
	oOpenEvent.shiftKey = oSnapshot?.shiftKey === true;
	oOpenEvent.altKey = oSnapshot?.altKey === true;
	oOpenEvent.metaKey = oSnapshot?.metaKey === true;

	if (typeof oOpenEvent.preventDefault !== "function") {
		oOpenEvent.preventDefault = function() {};
	}

	if (typeof oOpenEvent.stopPropagation !== "function") {
		oOpenEvent.stopPropagation = function() {};
	}

	if (typeof oOpenEvent.stopImmediatePropagation !== "function") {
		oOpenEvent.stopImmediatePropagation = function() {};
	}

	return oOpenEvent;
}
/**
 * @u4a-doc
 * Handles preview right-click, selects the target UI, marks it, and opens the design context menu.
 *
 * Source flow:
 * - Updates marker state only through CustomData or overlay DOMs, avoiding layout changes on selected controls.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oEvent.
 */
/**
 * @u4a-doc
 * Callback/function expression used by the surrounding preview workflow.
 */
async function setUiContextMenu(oEvent) {
	var iContextMenuOpenSeq = ++oWS.sMark.iContextMenuOpenSeq;
	var l_ui;
	var _OBJID;
	var oOpenSnapshot;
	var oOpenUi;
	var oOpenDom;
	var oOpenEvent;

	suppressPreviewContextMenuEvent(oEvent);

	u4aRootParent.setBusy("X");
	// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
	parent.oAPP.attr.ui.designMenu.close();
	// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
	parent.oAPP.attr.ui.oAttrMenu.close();
	removePreviewContextMenuMark();
	// @u4a-src Defines local state used by the following preview calculation.
	l_ui = getEventTargetUI(oEvent?.target);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof l_ui === "undefined") {
		u4aRootParent.setBusy("");
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	_OBJID = findUiObjectID(l_ui);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _OBJID === "undefined") {
		u4aRootParent.setBusy("");
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oOpenSnapshot = getPreviewContextMenuOpenSnapshot(oEvent, l_ui);

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.enableDesignContextMenu(parent.oAPP.attr.ui.oMenu, _OBJID);
	// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
	await parent.oAPP.fn.setSelectTreeItem(_OBJID);

	if (iContextMenuOpenSeq !== oWS.sMark.iContextMenuOpenSeq) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	await waitPreviewContextMenuOpenFrame();

	if (iContextMenuOpenSeq !== oWS.sMark.iContextMenuOpenSeq) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oOpenUi = parent.oAPP.attr.prev[_OBJID];

	if (!oOpenUi) {
		u4aRootParent.setBusy("");
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	oOpenDom = getPreviewContextMenuOpenDom(oOpenUi);

	if (!oOpenDom) {
		u4aRootParent.setBusy("");
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	markPreviewContextMenuUi(oOpenUi);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	bindPreviewContextMenuMarkCleanup(parent.oAPP.attr.ui.oMenu);

	oOpenEvent = createPreviewContextMenuOpenEvent(oOpenSnapshot, oOpenDom);

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	parent.oAPP.attr.ui.oMenu.openAsContextMenu(oOpenEvent, oOpenDom);
	applyPreviewContextMenuStyleClass(parent.oAPP.attr.ui.oMenu);
	u4aRootParent.setBusy("");

}

/**
 * @u4a-doc
 * Function that releases preview UI instances, DOM, or UI5 resources.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: is_tree.
 */
function destroyPreviewUi(is_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.zTREE.length !== 0) {
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
			destroyPreviewUi(is_tree.zTREE[i]);
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.OBJID === "ROOT") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
		parent.oAPP.attr.prev[is_tree.OBJID].destroy();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
}

/**
 * @u4a-doc
 * Function that releases preview UI instances, DOM, or UI5 resources.
 *
 * Source flow:
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: is_tree.
 */
function destroyPlanningCalendarRow(is_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.UIOBK !== "UO00397") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	var l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[is_tree.OBJID].sId + "-Head");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_ui) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
		l_ui.destroy();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[is_tree.OBJID].sId + "-CalRow");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_ui) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
		l_ui.destroy();
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
}

/**
 * @u4a-doc
 * Function that releases preview UI instances, DOM, or UI5 resources.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
function destroyPreviewUiOthers() {
	// @u4a-src Defines local state used by the following preview calculation.
	var ls_ui = sap.ui.core.Element.registry.all();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (jQuery.isEmptyObject(ls_ui)) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i in ls_ui) {
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
			ls_ui[i].destroy();
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {}
	}
}

/**
 * @u4a-doc
 * Function that removes PreviewPage and cleans related preview state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
function removePreviewPage() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!parent.oAPP.attr.ui._page1) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
	parent.oAPP.attr.ui._page1.destroy();
	// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
	parent.oAPP.attr.ui._hbox1.destroy();
	// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
	parent.oAPP.attr.ui.oMenu.destroy();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	destroyPreviewUi(parent.oAPP.attr.oModel.oData.zTREE[0]);
	destroyPreviewUiOthers();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	delete parent.oAPP.attr.ui._page1;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	delete parent.oAPP.attr.ui.prevRootPage;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	delete parent.oAPP.attr.ui._hbox1;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	delete parent.oAPP.attr.ui.prevPopupArea;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	delete parent.oAPP.attr.ui.oMenu;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.UA015UI = null;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev = {};
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.bfselUI = null;
	closePopup();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.popup = [];
}

/**
 * @u4a-doc
 * Applies the selected UI5 theme to the preview iframe.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: themeName.
 */
function setPreviewUiTheme(themeName) {
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	sap.ui.getCore().applyTheme(themeName);
}

/**
 * @u4a-doc
 * Function that reads or derives UI5ResourceRoot without changing preview state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 */
function getUI5LibraryBasePath(sUA025) {
	return String((sUA025.FLD04 || "") + (sUA025.FLD05 || "")).replace(/\\/g, "/").replace(/\/+$/, "");
}

function getUI5LibraryResourcePath(basePath, resourcePath, libraryPath) {
	const _resourceRootPath = resourcePath + "/" + libraryPath;

	if (basePath === _resourceRootPath || basePath.endsWith("/" + _resourceRootPath)) {
		return basePath;
	}

	if (basePath === resourcePath || basePath.endsWith("/" + resourcePath)) {
		return basePath + "/" + libraryPath;
	}

	return basePath + "/" + _resourceRootPath;
}

function getUI6UtilResourcePath(basePath) {
	let _basePath = basePath;
	const _sapui6LibraryPath = "/sapui6-resources/sapui6";
	const _sapui6ResourcePath = "/sapui6-resources";

	if (_basePath.endsWith(_sapui6LibraryPath)) {
		_basePath = _basePath.slice(0, -_sapui6LibraryPath.length);

	} else if (_basePath.endsWith(_sapui6ResourcePath)) {
		_basePath = _basePath.slice(0, -_sapui6ResourcePath.length);
	}

	if (/\/v\d+$/i.test(_basePath)) {
		return _basePath + "/util";
	}

	return _basePath + "/v1000/util";
}

function getUI5ResourceRoot() {

	// @u4a-src Defines local state used by the following preview calculation.
	const _resourceRoot = {};

	// @u4a-src Defines local state used by the following preview calculation.
	const _host = u4aRootParent.getHost();

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	const _aUA025 = parent.oAPP.attr.S_CODE.UA025;

	// @u4a-src Defines local state used by the following preview calculation.
	var sUA025 = _aUA025.find(a => a.FLD01 === "UI6_LIB" && a.FLD06 === "X");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sUA025) {

		// @u4a-src Defines local state used by the following preview calculation.
		let _basePath = getUI5LibraryBasePath(sUA025);

		_resourceRoot.sapui6 = getUI5LibraryResourcePath(_basePath, "sapui6-resources", "sapui6");
		_resourceRoot.util = getUI6UtilResourcePath(_basePath);

	}


	// @u4a-src Defines local state used by the following preview calculation.
	var sUA025 = _aUA025.find(a => a.FLD01 === "U4A_LIB" && a.FLD06 === "X");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sUA025) {

		// @u4a-src Defines local state used by the following preview calculation.
		let _basePath = getUI5LibraryBasePath(sUA025);

		_resourceRoot.u4a = getUI5LibraryResourcePath(_basePath, "resources", "u4a");

	}


	// @u4a-src Defines local state used by the following preview calculation.
	var sUA025 = _aUA025.find(a => a.FLD01 === "AM5CHART" && a.FLD06 === "X");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sUA025) {

		// @u4a-src Defines local state used by the following preview calculation.
		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.am5Chart = _basePath;

	}


	// @u4a-src Defines local state used by the following preview calculation.
	var sUA025 = _aUA025.find(a => a.FLD01 === "ZU4A_IMP" && a.FLD06 === "X");

	// @u4a-src Checks a required condition before the following preview logic continues.
	if (sUA025) {

		// @u4a-src Defines local state used by the following preview calculation.
		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.zu4a_imp = _basePath;

	}


	// @u4a-src Returns the computed preview value or exits the function at this point.
	return JSON.stringify(_resourceRoot);

}

/**
 * @u4a-doc
 * Creates and loads the UI5 bootstrap script for the preview runtime.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: fnCallback.
 */
function loadUi5BootstrapScript(fnCallback) {

	console.time("미리보기 UI5 로드 시간");

	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oExistScript = document.getElementById("sap-ui-bootstrap");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (oExistScript) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (window.sap && sap.ui && typeof sap.ui.getCore === "function") {
			fnCallback();
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		oExistScript.onload = fnCallback;
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}



	// @u4a-src Defines local state used by the following preview calculation.
	const _userInfo = u4aRootParent.getUserInfo();

	// @u4a-src Defines local state used by the following preview calculation.
	const oParam = new URLSearchParams();
	oParam.append("sap-user", _userInfo.ID);
	oParam.append("sap-password", _userInfo.PW);
	oParam.append("sap-client", _userInfo.CLIENT);
	oParam.append("sap-language", _userInfo.LANGU);


	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oScript = document.createElement("script");
	oScript.id = "sap-ui-bootstrap";

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	oScript.src = parent.oAPP.fn.getBootStrapUrl() + "?" + oParam.toString();


	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-language", "EN");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-preload", "async");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-compatversion", "edge");
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-theme", parent.oAPP.DATA.APPDATA.S_0010.UITHM);
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-libs", parent.oAPP.fn.getUi5Libraries(true));
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-noduplicateids", "true");

	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	oScript.setAttribute("data-sap-ui-resourceroots", getUI5ResourceRoot());

	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 */
	oScript.onload = function() {
		console.timeEnd("미리보기 UI5 로드 시간");
		fnCallback();
	};
	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 */
	oScript.onerror = function() {
		console.error("[U4A preview] UI5 bootstrap script load failed.");
	};
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	document.head.appendChild(oScript);
}



/**
 * @u4a-doc
 * Function that applies DNDEvent to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oUI.
 */
function setDNDEvent(oUI) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUI?._OBJID === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var _sTree = parent.oAPP.fn.getTreeData(oUI._OBJID);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _sTree === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_meta = oUI.getMetadata();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_meta || !l_meta.dnd) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	l_meta.dnd.draggable = true;
	l_meta.dnd.droppable = true;
	clearDropEffectUI(oUI);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof oUI.addEventDelegate !== "undefined") {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		oUI.addEventDelegate({
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oEvent.
			 */
			onAfterRendering: function(oEvent) {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				var l_dom = document.getElementById(oEvent.srcControl.sId + "-inner");
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (typeof l_dom === "undefined" || l_dom === null) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (l_dom.tagName !== "INPUT" && l_dom.tagName !== "TEXTAREA") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				l_dom.draggable = true;
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 */
				l_dom.ondragstart = function() {
					// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
					var l_ui = parent.oAPP.fn.getUiInstanceDOM(event.target, sap.ui.getCore());
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (typeof l_ui === "undefined") {
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return;
					}
					// @u4a-src Defines local state used by the following preview calculation.
					var l_area = "previewArea|";
					// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
					event.dataTransfer.setData("text/plain", l_area + l_ui._OBJID + "|" + parent.oAPP.attr.DnDRandKey);
					// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
					parent.oAPP.fn.designTreeDragStart(parent.oAPP.fn.getTreeData(l_ui._OBJID));
				};
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 */
				l_dom.ondragend = function() {
					// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
					parent.oAPP.fn.designDragEnd();
				};
			}
		});
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var oDrag = new sap.ui.core.dnd.DragInfo();
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	oDrag.attachDragStart(function(oEvent) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_area = "previewArea|";
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		event.dataTransfer.setData("text/plain", l_area + oEvent.mParameters.target._OBJID + "|" + parent.oAPP.attr.DnDRandKey);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.designTreeDragStart(parent.oAPP.fn.getTreeData(oEvent.mParameters.target._OBJID));
	});
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	oDrag.attachDragEnd(function(oEvent) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.designDragEnd();
	});
	oUI.addDragDropConfig(oDrag);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (parent.oAPP.attr.appInfo.IS_EDIT === "") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var oDrop = new sap.ui.core.dnd.DropInfo();
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	oDrop.attachDrop(function(oEvent) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.parent.setBusy("X");
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.designDragEnd();
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.oLTree1.__dropEffect = "";
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!oEvent?.mParameters?.droppedControl) {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.parent.setBusy("");
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.fn.UIDrop(oEvent, oEvent.mParameters.droppedControl._OBJID)) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.fn.designUIDropInsertPopup) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (parent.oAPP.fn.designUIDropInsertPopup(oEvent, oEvent.mParameters.droppedControl._OBJID) === true) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.parent.setBusy("");
	});
	oUI.addDragDropConfig(oDrop);
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropObjDateVal(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.length !== 8) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return sVal;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Year = l_val.substr(0, 4);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Month = parseInt(l_val.substr(4, 2)) - 1;
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Date = l_val.substr(6, 2);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Year) === true) {
		l_Year = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Month) === true) {
		l_Month = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Date) === true) {
		l_Date = 0;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_date = new Date(l_Year, l_Month, l_Date);
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_date;
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropObjTimeVal(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.length !== 6) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return sVal;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Hours = l_val.substr(0, 2);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Minutes = l_val.substr(2, 2);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Seconds = l_val.substr(4, 2);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Hours) === true) {
		l_Hours = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Minutes) === true) {
		l_Minutes = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Seconds) === true) {
		l_Seconds = 0;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_date = new Date("", "", "", l_Hours, l_Minutes, l_Seconds);
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_date;
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropObjDateTimeVal(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.length === 8) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_FullYear = l_val.substr(0, 4);
		// @u4a-src Defines local state used by the following preview calculation.
		var l_Month = parseInt(l_val.substr(4, 2)) - 1;
		// @u4a-src Defines local state used by the following preview calculation.
		var l_Date = l_val.substr(6, 2);
		// @u4a-src Defines local state used by the following preview calculation.
		var l_Hours = 0;
		// @u4a-src Defines local state used by the following preview calculation.
		var l_Minutes = 0;
		// @u4a-src Defines local state used by the following preview calculation.
		var l_Seconds = 0;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (isNaN(l_FullYear) === true) {
			l_FullYear = 0;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (isNaN(l_Month) === true) {
			l_Month = 0;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (isNaN(l_Date) === true) {
			l_Date = 0;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_date = new Date(l_FullYear, l_Month, l_Date, l_Hours, l_Minutes, l_Seconds);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return l_date;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.length !== 14) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return sVal;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_FullYear = l_val.substr(0, 4);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Month = parseInt(l_val.substr(4, 2)) - 1;
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Date = l_val.substr(6, 2);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Hours = l_val.substr(8, 2);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Minutes = l_val.substr(10, 2);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_Seconds = l_val.substr(12, 2);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_FullYear) === true) {
		l_FullYear = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Month) === true) {
		l_Month = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Date) === true) {
		l_Date = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Hours) === true) {
		l_Hours = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Minutes) === true) {
		l_Minutes = 0;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isNaN(l_Seconds) === true) {
		l_Seconds = 0;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_date = new Date(l_FullYear, l_Month, l_Date, l_Hours, l_Minutes, l_Seconds);
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_date;
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropStrConvArray(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val === "") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return [];
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_val.split(",");
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropFloatConvArray(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_split = l_val.split(","),
		l_len = lt_split.length;
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0; i < l_len; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_split[i] === "") {
			lt_split[i] = "0";
		}
		lt_split[i] = parseFloat(lt_split[i]);
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return lt_split;
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvPropIntConvArray(sVal) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_val = sVal;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_split = l_val.split(","),
		l_len = lt_split.length;
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0; i < l_len; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_split[i] === "") {
			lt_split[i] = "0";
		}
		lt_split[i] = parseInt(lt_split[i]);
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return lt_split;
}

/**
 * @u4a-doc
 * Function that converts serialized design-time values into runtime values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: sVal.
 */
function GF_ConvSap2jsIndex(sVal) {
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sVal - 1;
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: v.
 */
function GF_GanttFullScreenTimeLine(v) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.FullScreenTimeLineOptions) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.requireSync("sap/gantt/axistime/FullScreenStrategy");
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!v || v === "") {
		v = "Date";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sap.gantt.axistime.FullScreenTimeLineOptions[v];
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: v.
 */
function GF_GanttProportionTimeLine(v) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.ProportionTimeLineOptions) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.requireSync("sap/gantt/axistime/ProportionZoomStrategy");
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!v || v === "") {
		v = "Date";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sap.gantt.axistime.ProportionTimeLineOptions[v];
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: v.
 */
function GF_GanttStepwiseTimeLine(v) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.StepwiseTimeLineOptions) {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.requireSync("sap/gantt/axistime/StepwiseZoomStrategy");
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!v || v === "") {
		v = "Date";
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sap.gantt.axistime.StepwiseTimeLineOptions[v];
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 */
function GF_getRandomKey() {
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return parent.oAPP.fn.getRandomKey();
}

/**
 * @u4a-doc
 * Function that reads or derives IconList without changing preview state.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 */
function getIconList() {
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return sap.ui.core.IconPool.getIconNames();
}

/**
 * @u4a-doc
 * Function that applies PreviewZoom to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: fVal.
 */
function setPreviewZoom(fVal) {
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var l_tag = document.getElementsByTagName("html");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_tag || !l_tag[0]) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
	l_tag[0].style.zoom = String(fVal);
}

/**
 * @u4a-doc
 * Function that removes DropConfig and cleans related preview state.
 *
 * Source flow:
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 */
function removeDropConfig() {
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i in parent.oAPP.attr.prev) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (i === "ROOT") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!parent.oAPP.attr.prev[i].getDragDropConfig) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var lt_dnd = parent.oAPP.attr.prev[i].getDragDropConfig();
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_dnd.length === 0) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (var j = 0, l = lt_dnd.length; j < l; j++) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (lt_dnd[j].getMetadata()._sClassName === "sap.ui.core.dnd.DropInfo") {
				// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
				parent.oAPP.attr.prev[i].removeDragDropConfig(lt_dnd[j]);
			}
		}
	}
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: opt.
 */
function _get_skeleton_tag_info(opt) {
	// @u4a-src Defines local state used by the following preview calculation.
	var linkVal = "",
		lstyVal = "",
		oinp = null;
	// @u4a-src Defines local state used by the following preview calculation.
	const CT_ATTR = ["class", "style", "value", "checked", "selected", "title", "placeholder", "r"];

	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 * Parameters: d.
	 */
	function _getHtml(d) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!d || !d.tagName)
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return "";
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		var txt, ax, el = document.createElement("div");
		// @u4a-src Defines local state used by the following preview calculation.
		let _clone = d.cloneNode(false);
		// @u4a-src Defines local state used by the following preview calculation.
		let _href = _clone?.href || undefined;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _href !== "undefined") {
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			_clone.removeAttribute("id");
			_href = _href.replace(location.origin, "");
			_clone.href = _href;
		}
		// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
		el.appendChild(_clone);
		txt = el.innerHTML;
		el = null;
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return txt;
	}

	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Validates target control/DOM references before writing attributes, styles, or classes.
	 * Parameters: node.
	 */
	function _cleanAttributes(node) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (node.nodeType === Node.ELEMENT_NODE) {
			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			[...node.attributes].forEach(attr => {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (!CT_ATTR.includes(attr.name)) {
					// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
					node.removeAttribute(attr.name);
				}
			});
		}
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		node.childNodes.forEach(child => _cleanAttributes(child));
	}
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var oH = document.getElementsByTagName("head")[0];
	// @u4a-src Defines local state used by the following preview calculation.
	var oL = oH.getElementsByTagName("link");
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0; i < oL.length; i++) {
		linkVal = linkVal + _getHtml(oL[i]);
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0; i < 100; i++) {
		// @u4a-src Accesses browser DOM/window state used by the preview iframe.
		var Tagsty = document.getElementsByTagName("style")[i];
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof Tagsty === "undefined") {
			// @u4a-src Stops the current switch or loop branch after this preview case is handled.
			break;
		}
		lstyVal = lstyVal + Tagsty.innerHTML;
		Tagsty = null;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var T = [];
	T.push({
		NAME: "STYL_LINK",
		VALUE: linkVal
	});
	T.push({
		NAME: "STYL_CSS",
		VALUE: lstyVal
	});
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	let _oContent = document.getElementById("Content");
	// @u4a-src Defines local state used by the following preview calculation.
	let _oClone = _oContent.cloneNode(true);
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	let _aDom = _oClone.querySelectorAll('*');
	_cleanAttributes(_oClone);
	T.push({
		NAME: "CONTENT",
		VALUE: _oClone.innerHTML
	});
	T.push({
		NAME: "OPT_IS_WAIT",
		VALUE: opt.OPT_IS_WAIT
	});
	T.push({
		NAME: "OPT_USE_GLASS",
		VALUE: opt.OPT_USE_GLASS
	});
	T.push({
		NAME: "OPT_GLASS_DENSITY",
		VALUE: opt.OPT_GLASS_DENSITY
	});
	T.push({
		NAME: "THEME_NAME",
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		VALUE: sap.ui.getCore().getConfiguration().getTheme()
	});
	// @u4a-src Defines local state used by the following preview calculation.
	let _oThem = sap.ui.core.theming.Parameters.get();
	// @u4a-src Defines local state used by the following preview calculation.
	let _backgroundColor = _oThem?.["sapBackgroundColor"] || "";
	T.push({
		NAME: "BACKGROUND_COLOR",
		VALUE: _backgroundColor
	});
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return T;
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: UIOBK.
 */
// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
parent.oAPP.fn.exceptionRespGridLayout = function(UIOBK) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK !== "UO01008") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	/**
	 * @u4a-doc
	 * Function that participates in the design preview runtime workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 * Parameters: oRenderManager, oLayout.
	 */
	sap.ui.layout.form.FormLayoutRenderer.render = function(oRenderManager, oLayout) {
		// @u4a-src Defines local state used by the following preview calculation.
		var rm = oRenderManager;
		// @u4a-src Starts a protected block so preview errors can be contained.
		try {
			// @u4a-src Defines local state used by the following preview calculation.
			var oForm = oLayout.getParent();
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (oForm && oForm instanceof sap.ui.layout.form.Form) {
				this.renderForm(rm, oLayout, oForm);
			}
		// @u4a-src Handles an error raised by the protected preview block.
		} catch (e) {
			console.log(e);
		}
	};
};

/**
 * @u4a-doc
 * Creates a UI5 control instance for one design tree node and applies its attributes.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: is_tree, it_0015.
 */
function createUIInstance(is_tree, it_0015) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isSkip0014(is_tree) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_0022 = parent.oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === is_tree.UIOBK);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof ls_0022 === "undefined") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID] = new sap.ui.core.Element();
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!ls_embed) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	excepSapui6Library(ls_0022.LIBNM);
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.requireSync(ls_0022.LIBNM.replace(/\./g, "/"));
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID] = new sap.ui.core.Element();
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!ls_embed) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	lf_excepRequire(ls_0022.UIOBK);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.exceptionRespGridLayout(is_tree.UIOBK);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
	// @u4a-src Defines local state used by the following preview calculation.
	var l_class = getUIClassInstance(ls_0022.LIBNM);
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid(), setUIProperty(is_tree, lt_0015));
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid());
	}
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	addPreviewTabIndexCustomData(parent.oAPP.attr.prev[is_tree.OBJID]);
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		setUIPropertyDirectly(is_tree.OBJID, lt_0015);
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.setAggrBind(parent.oAPP.attr.prev[is_tree.OBJID]);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof parent.oAPP.attr.prev[is_tree.OBJID].data !== "undefined") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.OBJID].data("OBJID", is_tree.OBJID);
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	addUIObjPreViewUW04(parent.oAPP.attr.prev[is_tree.OBJID], is_tree.UIOBK);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	selectOption3Excep(parent.oAPP.attr.prev[is_tree.OBJID], is_tree.UIOBK);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	setDNDEvent(parent.oAPP.attr.prev[is_tree.OBJID]);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!ls_embed) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
}

//================================================================
//#region Preview selectable DOM registration
//================================================================
// Adds tabindex and data-u4a-selectable to rendered controls that expose
// customData. CSS uses the attribute to suppress UI5 focus indicators and
// JavaScript uses it to resolve click/context-menu selection targets.
/**
 * @u4a-doc
 * Function that adds PreviewTabIndexCustomData to a preview collection, DOM node, or UI5 aggregation.
 *
 * Source flow:
 * - Validates target control/DOM references before writing attributes, styles, or classes.
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oUi.
 */
// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
/**
 * @u4a-doc
 * Named helper function used by the preview runtime.
 */
function addPreviewTabIndexCustomData(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || typeof oUi.getMetadata !== "function" || typeof oUi.addCustomData !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Defines local state used by the following preview calculation.
	var oMetadata = oUi.getMetadata();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oMetadata || typeof oMetadata.getAllAggregations !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// @u4a-src Defines local state used by the following preview calculation.
	var mAggregations = oMetadata.getAllAggregations();
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!mAggregations || !mAggregations.customData) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}

	// 선택 가능 대상임을 DOM attribute로 표시한다.
	// 선택 효과 자체는 focus가 아니라 data-u4a-selected 상태를 기준으로 유지한다.
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	addPreviewMarkCustomData(oUi, "tabindex", oWS.sMark.tabIndexValue);
	// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
	addPreviewMarkCustomData(oUi, oWS.sMark.selectableAttr, oWS.sMark.selectedValue);

}
//#endregion

/**
 * @u4a-doc
 * Builds the preview root controls and renders the current design tree into the iframe.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 */
async function drawPreview() {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!jQuery.isEmptyObject(parent.oAPP.attr.prev)) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.DATA.APPDATA.T_0015 = parent.oAPP.fn.getAttrChangedData();
		// @u4a-src Iterates through a collection and applies the same preview rule to each item.
		for (let _s0015 of parent.oAPP.DATA.APPDATA.T_0015) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (typeof _s0015.SHCUT === "string" && _s0015.SHCUT !== "") {
				_s0015.SHCUT = JSON.parse(_s0015.SHCUT);
			}
		}
	}
	removePreviewPage();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof parent.oAPP.attr.ui.prevRootPage === "undefined") {
		/**
		 * @since   2026-06-12 01:36:51
		 * @version v3.6.4-3
		 * @author  PES
		 * @description
		 * 미리보기 화면이 출력될 Content 영역에 u4a.m.Preview 루트 컨트롤을 배치하고,
		 * 팝업 전용 영역을 루트 컨텐츠의 선두에 연결하여 일반 UI와 팝업 UI가
		 * 동일한 미리보기 렌더링 생명주기 안에서 구성되도록 초기화한다.
		 */
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		sap.ui.getCore().loadLibrary("sap.m");
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui._page1 = new u4a.m.Preview("u4a_prev_main_page");
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.prevRootPage = parent.oAPP.attr.ui._page1;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui._hbox1 = new sap.m.HBox("u4a_prev_pop_area");
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.prevPopupArea = parent.oAPP.attr.ui._hbox1;
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.prevRootPage.placeAt("Content");
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.prevRootPage.oParent.insertContent(parent.oAPP.attr.ui.prevPopupArea, 0);
		// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
		await _oPromise;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.ui.oMenu = parent.oAPP.fn.callDesignContextMenu.call(this);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.ui.oMenu.addStyleClass("sapUiSizeCompact");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.ui.oMenu.addStyleClass("u4a_ws_preview_context_menu");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev.ROOT = {};
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.prev.ROOT._T_0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === "ROOT");
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_theme = parent.oAPP.attr.prev.ROOT._T_0015.find(a => a.UIATK === "DH001021");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_theme && l_theme.UIATV !== "") {
		setPreviewUiTheme(l_theme.UIATV);
	}
	setPreviewCSS();
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	setUIScript(parent.oAPP.attr.oModel.oData.zTREE);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.UA015UI = parent.oAPP.attr.prev["APP"];
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.attr.UA015UI.__UIFND = "SAP.M.APP";

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
	// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
	await _oPromise;

}

/**
 * @u4a-doc
 * Function that reads or derives UIClassInstance without changing preview state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: UILIB.
 */
function getUIClassInstance(UILIB) {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_split = UILIB.split(".");
	// @u4a-src Defines local state used by the following preview calculation.
	var l_path = window[lt_split[0]];
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 1, l = lt_split.length; i < l; i++) {
		l_path = l_path[lt_split[i]];
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_path;
}

/**
 * @u4a-doc
 * Function that returns a boolean decision used by preview guards.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: is_tree.
 */
function isSkip0014(is_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.OBJID === "ROOT") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.UIOBK === "UO99997") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.UIOBK === "UO99998") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_tree.UIOBK === "UO99999") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return true;
	}
}

/**
 * @u4a-doc
 * Converts persisted design attribute values into runtime UI5 property values.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: is_attr.
 */
function parsePropertyValue(is_attr) {
	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 * Parameters: vVal.
	 */
	function lf_parseProp(vVal) {
		// @u4a-src Defines local state used by the following preview calculation.
		var l_val;
		// @u4a-src Branches by value so UI-specific preview behavior can stay grouped.
		switch (is_attr.UIADT.toUpperCase()) {
			// @u4a-src Handles one branch of the surrounding switch statement.
			case "BOOLEAN":
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (vVal === "true") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return true;
				}
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return false;
			// @u4a-src Handles one branch of the surrounding switch statement.
			case "INT":
			// @u4a-src Handles one branch of the surrounding switch statement.
			case "FLOAT":
				l_val = Number(vVal);
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (isNaN(l_val) === true) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return 0;
				}
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return l_val;
			// @u4a-src Handles one branch of the surrounding switch statement.
			default:
				l_val = vVal;
				// @u4a-src Defines local state used by the following preview calculation.
				var l_enum = registEnumType(is_attr.UIADT);
				// @u4a-src Defines local state used by the following preview calculation.
				var l_type = sap.ui.base.DataType.getType(is_attr.UIADT);
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (l_type && typeof l_type.isValid === "function" && l_type.isValid(l_val) === false) {
					l_val = undefined;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if ((!l_type || typeof l_type.isValid !== "function") && l_enum && typeof l_enum === "object" && Object.keys(l_enum).some(function(sKey) {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return l_enum[sKey] === l_val;
				}) === false) {
					l_val = undefined;
				}
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return l_val;
		}
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_UA032 = parent.oAPP.attr.S_CODE.UA032.find(a => a.FLD01 === is_attr.UIOBK && a.FLD03 === is_attr.UIATT);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (ls_UA032 && ls_UA032.FLD07 !== "") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return window[ls_UA032.FLD07](is_attr.UIATV);
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_UIATV = parent.oAPP.fn.prevParseOTRValue(is_attr) || is_attr.UIATV;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_attr.UIATK === "AT000011858") {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		l_UIATV = parent.oAPP.fn.setHTMLContentProp(is_attr) || "";
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_attr.ISMLB === "") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return lf_parseProp(l_UIATV);
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (is_attr.UIATV === "[]") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return [];
	}
	l_val = is_attr.UIATV;
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_split = l_val.split(",");
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_return = [];
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_split.length; i < l; i++) {
		lt_return.push(lf_parseProp(lt_split[i]));
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return lt_return;
}

/**
 * @u4a-doc
 * Function that applies FixedProperty to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: UIOBK.
 */
function setFixedProperty(UIOBK) {
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var lt_UA018 = parent.oAPP.attr.S_CODE.UA018.filter(a => a.FLD05 === UIOBK);
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_UA018.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	var l_prop = {};
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_UA018.length; i < l; i++) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var l_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIOBK === lt_UA018[i].FLD05 && a.UIATT === lt_UA018[i].FLD02);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!l_0023) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var ls_0015 = parent.oAPP.fn.crtStru0015();
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.moveCorresponding(l_0023, ls_0015);
		ls_0015.UIATV = lt_UA018[i].FLD04;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_UA018[i].FLD06 === "X") {
			ls_0015.UIATV = jQuery.sap.uid();
		}
		l_prop[lt_UA018[i].FLD02] = parsePropertyValue(ls_0015);
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_prop;
}

/**
 * @u4a-doc
 * Function that applies UIParent to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: is_tree, skipRoot.
 */
function setUIParent(is_tree, skipRoot) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (isSkip0014(is_tree) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!ls_embed) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (skipRoot) {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.ui.prevRootPage.addContent(parent.oAPP.attr.prev[is_tree.OBJID]);
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (collectPopup(is_tree.UIFND, is_tree.OBJID, parent.oAPP.attr.S_CODE.UA015) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	let _aUW03 = parent.oAPP.attr.S_CODE.UW03.filter(item => item.FLD01 === is_tree.UIOBK && item.FLD06 !== "X");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (_aUW03.length > 0) {
		// @u4a-src Defines local state used by the following preview calculation.
		let _sUW03 = _aUW03.find(item => item.FLD03 === is_tree.PUIOK && item.FLD05 === ls_embed.UIATT);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _sUW03 === "undefined") {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (denyChildAggregation(is_tree.PUIOK, ls_embed.UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (skipSplitterLayoutData(is_tree.POBID, is_tree.UIATT) === true) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	setRichTextEditorException(is_tree.UIOBK, is_tree.OBJID);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	setChildUiException(is_tree.UIOBK, is_tree.OBJID, is_tree.zTREE, parent.oAPP.attr.S_CODE.UA050);
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	const l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[is_tree.POBID], "3", ls_embed.UIATT, "_sMutator");
	// @u4a-src Starts a protected block so preview errors can be contained.
	try {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.attr.prev[is_tree.POBID][l_agrnm](parent.oAPP.attr.prev[is_tree.OBJID]);
	// @u4a-src Handles an error raised by the protected preview block.
	} catch (e) {
		console.log(e);
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.oAPP.fn.prevDrawExceptionUi(is_tree.UIOBK, is_tree.OBJID);
}

/**
 * @u4a-doc
 * Function that applies UIProperty to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: is_tree, it_0015.
 */
function setUIProperty(is_tree, it_0015) {
	// @u4a-src Defines local state used by the following preview calculation.
	var l_prop = setFixedProperty(is_tree.UIOBK) || {};
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_0015 = it_0015.filter(a => a.OBJID === is_tree.OBJID && a.UIATY === "1" && a.UIATV.indexOf("{") === -1 && a.ISBND === "");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_0015.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return l_prop;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_0015.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_0015[i].UIASN === "DRAGABLE") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_0015[i].UIASN === "DROPABLE") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_0015[i].UIASN === "STYLECLASS" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (is_tree.ISECP === "" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.fn.prevSkipProp(lt_0015[i]) === true) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (parent.oAPP.attr.S_CODE.UA018.findIndex(a => a.FLD02 === lt_0015[i].UIATT && a.FLD05 === lt_0015[i].UIOBK) !== -1) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		l_prop[lt_0015[i].UIATT] = parsePropertyValue(lt_0015[i]);
	}
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return l_prop;
}

/**
 * @u4a-doc
 * Function that applies UIPropertyDirectly to preview/UI5/workspace state.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: OBJID, it_0015.
 */
function setUIPropertyDirectly(OBJID, it_0015) {
	// @u4a-src Defines local state used by the following preview calculation.
	var lt_0015 = it_0015.filter(a => a.OBJID === OBJID && a.UIATY === "1" && a.UIATV !== "" && a.ISBND === "");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (lt_0015.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = lt_0015.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_0015[i].UIATV.indexOf("{") !== -1) {
			setPrevPropVal(OBJID, lt_0015[i].UIATT, parsePropertyValue(lt_0015[i]));
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (lt_0015[i].UIASN === "STYLECLASS" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.prev[OBJID].addStyleClass(lt_0015[i].UIATV);
		}
	}
}

/**
 * @u4a-doc
 * Recursively creates preview controls from the design tree.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: it_tree.
 */
function setUIScript(it_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (it_tree.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = it_tree.length; i < l; i++) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var _aT0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === it_tree[i].OBJID);
		createUIInstance(it_tree[i], _aT0015);
		setUIScript(it_tree[i].zTREE);
		setUIParent(it_tree[i]);
	}
}

/**
 * @u4a-doc
 * Function that adds UIObjPreViewUW04 to a preview collection, DOM node, or UI5 aggregation.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Keeps design-time metadata and rendered UI5 state aligned.
 * Parameters: oUi, UIOBK.
 */
function addUIObjPreViewUW04(oUi, UIOBK) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	var l_UW04 = parent.oAPP.attr.S_CODE.UW04.find(a => a.FLD01 === UIOBK && a.FLD10 !== "X");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_UW04) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	eval(l_UW04.FLD03 + l_UW04.FLD04 + l_UW04.FLD05 + l_UW04.FLD06 + l_UW04.FLD07 + l_UW04.FLD08 + l_UW04.FLD09);
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 */
function richTextEditorException() {
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	var l_dom = document.getElementById("U4A_HIDDEN_AREA");
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	sap.ui.requireSync("sap/ui/richtexteditor/RichTextEditor");
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!l_dom) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	var aHiddenNodes = Array.prototype.slice.call(l_dom.childNodes);
	for (var i = 0, l = aHiddenNodes.length; i < l; i++) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!aHiddenNodes[i]) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		var l_ui = sap.ui.getCore().byId(aHiddenNodes[i].id);
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!l_ui || !l_ui.getMetadata) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_meta = l_ui.getMetadata();
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!l_meta) {
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (l_meta._sClassName === "sap.ui.richtexteditor.RichTextEditor") {
			// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
			l_ui.destroy();
		}
	}
}

/**
 * @u4a-doc
 * Function that clears stale runtime state so markers, DOM, or caches do not leak.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * - Cleans both the UI5 object path and any DOM fallback state that can survive rerendering.
 * Parameters: oUi.
 */
function clearDropEffectUI(oUi) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || !oUi.addEventDelegate) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	oUi.addEventDelegate({
		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oEvent.
		 */
		ondragover: function(oEvent) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (document.activeElement && document.activeElement.blur) {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				document.activeElement.blur();
			}
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (l_dom === null || l_dom.length === 0) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
			// @u4a-src Defines local state used by the following preview calculation.
			let oDom = l_dom[0];
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oDom.classList.remove("u4aWsDisplayNone");
		},
		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oEvent.
		 */
		ondragleave: function(oEvent) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (document.activeElement && document.activeElement.blur) {
				// @u4a-src Accesses browser DOM/window state used by the preview iframe.
				document.activeElement.blur();
			}
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (l_dom === null || l_dom.length === 0) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
			// @u4a-src Defines local state used by the following preview calculation.
			let oDom = l_dom[0];
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oDom.classList.remove("u4aWsDisplayNone");
			// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
			oDom.classList.add("u4aWsDisplayNone");
		}
	});
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: oUi, UIOBK.
 */
function selectOption3Excep(oUi, UIOBK) {
	/**
	 * @u4a-doc
	 * Function local helper used by the containing workflow.
	 *
	 * Source flow:
	 * - Guards inputs first, then performs the smallest required preview-state change.
	 * Parameters: T_0015, oBtn, UIATK, fSetProp, vDefault.
	 */
	function lf_setProp(T_0015, oBtn, UIATK, fSetProp, vDefault) {
		// @u4a-src Defines local state used by the following preview calculation.
		var ls_0015 = T_0015.find(a => a.UIATK === UIATK && a.ISBND === "");
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!ls_0015) {
			oBtn[fSetProp](vDefault);
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (ls_0015.ISSPACE === "X") {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
		// @u4a-src Defines local state used by the following preview calculation.
		var l_prop = ls_0015.UIATV;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (ls_0015.UIADT === "boolean") {
			l_prop = false;
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (ls_0015.UIATV === "true") {
				l_prop = true;
			}
		}
		oBtn[fSetProp](l_prop);
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (UIOBK !== "UO99984") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (!oUi || !oUi.addEventDelegate) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
	oUi.addEventDelegate({
		/**
		 * @u4a-doc
		 * Function that participates in the design preview runtime workflow.
		 *
		 * Source flow:
		 * - Guards inputs first, then performs the smallest required preview-state change.
		 * Parameters: oEvent.
		 */
		onAfterRendering: function(oEvent) {
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!oEvent.srcControl) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
			oEvent.srcControl.addStyleClass("u4aSelOpt3");
			// @u4a-src Defines local state used by the following preview calculation.
			var l_ui = oEvent.srcControl.data("optButton");
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!l_ui) {
				// @u4a-src Creates an object instance required by the preview flow.
				l_ui = new sap.m.Button().addStyleClass("sapUiTinyMarginBegin");
				oEvent.srcControl.data("optButton", l_ui);
			}
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002539", "setType", "Default");
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002540", "setIcon", "sap-icon://display-more");
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002541", "setVisible", true);
			l_ui.setEnabled(oEvent.srcControl.getEditable() && oEvent.srcControl.getEnabled() || false);
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (l_ui.getDomRef()) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			var l_dom = document.createElement("div");
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			oEvent.srcControl.getDomRef().appendChild(l_dom);
			l_ui.placeAt(l_dom);
		}
	});
}

/**
 * @u4a-doc
 * Function that rebuilds preview state after design data changes.
 *
 * Source flow:
 * - Works against parent.oAPP preview registries and the iframe document.
 * Parameters: it_tree.
 */
function redrawUIScript(it_tree) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (it_tree.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (var i = 0, l = it_tree.length; i < l; i++) {
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		var l_ui = parent.oAPP.attr.prev[it_tree[i].OBJID];
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!l_ui || !l_ui.isDestroyed || !l_ui.isDestroyed()) {
			redrawUIScript(it_tree[i].zTREE);
			// @u4a-src Skips the remaining loop body for this item and moves to the next one.
			continue;
		}
		// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
		parent.oAPP.fn.removeCollectPopup(it_tree[i].OBJID);
		createUIInstance(it_tree[i], l_ui._T_0015);
		redrawUIScript(it_tree[i].zTREE);
		setUIParent(it_tree[i], true);
	}
}

/**
 * @u4a-doc
 * Function that participates in the design preview runtime workflow.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 * Parameters: uiadt.
 */
function registEnumType(uiadt) {
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof uiadt === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (uiadt.indexOf(".") === -1) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	let _aLib = uiadt.split('.');
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (_aLib.length === 0) {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Defines local state used by the following preview calculation.
	let _oEnum = window;
	// @u4a-src Iterates through a collection and applies the same preview rule to each item.
	for (let i = 0; i < _aLib.length; i++) {
		// @u4a-src Defines local state used by the following preview calculation.
		let _lib = _aLib[i];
		_oEnum = _oEnum[_lib] || undefined;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (typeof _oEnum === "undefined") {
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof _oEnum === "undefined") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return;
	}
	// @u4a-src Checks a required condition before the following preview logic continues.
	if (typeof sap === "undefined" || !sap.ui || !sap.ui.base || !sap.ui.base.DataType || typeof sap.ui.base.DataType.registerEnum !== "function") {
		// @u4a-src Returns the computed preview value or exits the function at this point.
		return _oEnum;
	}
	sap.ui.base.DataType.registerEnum(uiadt, _oEnum);
	// @u4a-src Returns the computed preview value or exits the function at this point.
	return _oEnum;
}


//================================================================
//#region 🟦 base url 설정
//================================================================	
/**
 * @u4a-doc
 * Function that applies BaseUrl to preview/UI5/workspace state.
 *
 * Source flow:
 * - Keeps design-time metadata and rendered UI5 state aligned.
 */
function setBaseUrl() {

    /**
     * @since   2026-06-04 18:18:01
     * @version v3.6.4-3
     * @author  pes
     * @description
     * iframe이 로드되는 시점에 base 태그가 존재하지 않아 
	 * 상대경로로 리소스를 참조하는 경우 문제가 발생하여 
	 * base 태그를 구성하는 로직을 추가함.
     */
    //base 태그 추가 (상대경로 문제 해결 위해)
    // @u4a-src Defines local state used by the following preview calculation.
    const sHost = u4aRootParent.getHost();

    // @u4a-src Accesses browser DOM/window state used by the preview iframe.
    const oBase = document.createElement("base");
    oBase.href = sHost.endsWith("/") ? sHost : sHost + "/";

    // @u4a-src Accesses browser DOM/window state used by the preview iframe.
    document.head.prepend(oBase);

}
//#endregion


//================================================================
//#region 🟦 미리보기 START Function.
//================================================================
//#endregion
/**
 * @u4a-doc
 * Bootstraps the preview runtime after base URL, UI5, and workspace hooks are ready.
 *
 * Source flow:
 * - Guards inputs first, then performs the smallest required preview-state change.
 */
function start() {

	// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
	parent.console.timeEnd("미리보기 FRAME 로드 시간");

	console.log("[U4A preview] 미리보기가 로드됐습니다.");

	
	//base url 설정
	setBaseUrl();


	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	(function() {
		// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
		const NativeRO = window.ResizeObserver;
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (!NativeRO)
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		// @u4a-src Observes geometry or visibility changes that affect the preview marker layer.
		window.ResizeObserver = class ResizeObserver extends NativeRO {
			constructor(callback) {
				// @u4a-src Defines local state used by the following preview calculation.
				let rafId = 0,
					lastEntries = null,
					lastObserver = null;
				/**
				 * @u4a-doc
				 * Callback/function expression used by the surrounding preview workflow.
				 */
				super((entries, observer) => {
					lastEntries = entries;
					lastObserver = observer;
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!rafId) {
						// @u4a-src Schedules preview work to run outside the current browser event frame.
						/**
						 * @u4a-doc
						 * Timer/frame callback used to defer preview work until the browser can update safely.
						 */
						rafId = requestAnimationFrame(() => {
							rafId = 0;
							// @u4a-src Starts a protected block so preview errors can be contained.
							try {
								callback(lastEntries, lastObserver);
							// @u4a-src Handles an error raised by the protected preview block.
							} catch (e) {
								// @u4a-src Schedules preview work to run outside the current browser event frame.
								/**
								 * @u4a-doc
								 * Timer/frame callback used to defer preview work until the browser can update safely.
								 */
								setTimeout(() => {
									throw e;
								});
							}
						});
					}
				});
			}
		};
	})();
	
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	/**
	 * @u4a-doc
	 * DOM event callback that receives browser events inside the preview iframe.
	 */
	window.addEventListener("mousedown", function(oEvent) {
		// @u4a-src Checks a required condition before the following preview logic continues.
		if (oEvent.button !== 0 && oEvent.button !== 1 && oEvent.button !== 2) {
			oEvent.preventDefault();
			// @u4a-src Returns the computed preview value or exits the function at this point.
			return;
		}
	});
	// @u4a-src Accesses browser DOM/window state used by the preview iframe.
	parent.document.getElementById("prevHTML").style.display = "";
	/**
	 * @u4a-doc
	 * Callback/function expression used by the surrounding preview workflow.
	 */
	loadUi5BootstrapScript(function() {
		// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
		/**
		 * @u4a-doc
		 * UI5 lifecycle callback that reacts after framework state or rendering changes.
		 */
		sap.ui.getCore().attachInit(async function() {

			console.time("미리보기 ATTACH INIT");

			definePreviewControl();

			// @u4a-src Reads or writes UI5 CustomData that mirrors design-time metadata into the DOM.
			defineU4ACustomData();

			/**
			 * @u4a-doc
			 * Callback/function expression used by the surrounding preview workflow.
			 */
			(function() {
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/ui/layout/ResponsiveFlowLayout");
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 */
				sap.ui.layout.ResponsiveFlowLayout.prototype.exit = function() {
					delete this._rows;
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this._IntervalCall) {
						clearTimeout(this._IntervalCall);
						this._IntervalCall = void 0
					}
					this._resizeHandlerComputeWidthsID && sap.ui.core.ResizeHandler.deregister(this._resizeHandlerComputeWidthsID);
					delete this._resizeHandlerComputeWidthsID;
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this.oRm) {
						// @u4a-src Calls a UI5 lifecycle or popup method that changes the rendered preview state.
						this.oRm.destroy();
						delete this.oRm
					}
					delete this._$DomRef;
					delete this._oDomRef;
					delete this._iRowCounter
				};
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/m/Carousel");
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 * Parameters: t, e.
				 */
				sap.m.Carousel.prototype._changePage = function(t, e) {
					this._adjustHUDVisibility(e);
					// @u4a-src Defines local state used by the following preview calculation.
					var i = this.getActivePage(),
						a = this.getPages();
					t && (i = a[t - 1] && a[t - 1].getId());
					// @u4a-src Defines local state used by the following preview calculation.
					var s = a[e - 1] && a[e - 1].getId();
					this.setAssociation("activePage", s, !0);
					// @u4a-src Defines local state used by the following preview calculation.
					var o = this._getPageIndicatorText(e);
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					sap.ui.Device.system.desktop || jQuery(document.activeElement).trigger("blur");
					this._oMobifyCarousel && this._oMobifyCarousel.getShouldFireEvent() && this.firePageChanged({
						oldActivePageId: i,
						newActivePageId: s,
						activePages: this._aAllActivePagesIndexes
					});
					/**
					 * @u4a-doc
					 * Callback/function expression used by the surrounding preview workflow.
					 */
					this._oMobifyCarousel.$items.each((function(t, e) {
						// @u4a-src Mutates DOM attributes, classes, styles, or nodes for preview-only behavior.
						e.className.indexOf("sapMCrslActive") <= -1 ? e.setAttribute("aria-selected", !1) : e.setAttribute("aria-selected", !0)
					}));
					this.$("slide-number").text(o)
				};
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/uxap/ObjectPageSubSection");
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 * Parameters: t.
				 */
				sap.uxap.ObjectPageSubSection.prototype._applyLayout = function(t) {
					// @u4a-src Defines local state used by the following preview calculation.
					var e, i = this._getGrid(),
						a = i.getAggregation("content"),
						s = this.getMode(),
						o = t.getSubSectionLayout(),
						r = this._calculateLayoutConfiguration(o, t),
						n = this.getBlocks(),
						u = n.concat(this.getMoreBlocks());
					this._oLayoutConfig = r;
					this._resetLayoutData(u);
					e = s === sap.uxap.ObjectPageSubSectionMode.Expanded ? u : n;
					this._assignLayoutData(e, r);
					// @u4a-src Starts a protected block so preview errors can be contained.
					try {
						// @u4a-src Iterates through a collection and applies the same preview rule to each item.
						/**
						 * @u4a-doc
						 * Collection callback that applies the preview rule to each item in the current list.
						 */
						e.forEach((function(t) {
							// @u4a-src Checks a required condition before the following preview logic continues.
							if (!0 !== t.isDestroyed()) {
								this._setBlockMode(t, s);
								(!a || a && a.indexOf(t) < 0) && i.addAggregation("content", t, !0)
							}
						}), this)
					// @u4a-src Handles an error raised by the protected preview block.
					} catch (t) {}
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return this
				};
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/ui/layout/form/SimpleForm");
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 * Parameters: t.
				 */
				sap.ui.layout.form.SimpleForm.prototype._suggestTitleId = function(t) {
					// @u4a-src Defines local state used by the following preview calculation.
					var e = this.getAggregation("form") || void 0;
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (void 0 !== e) {
						e._suggestTitleId(t);
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return this
					}
				};
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/f/GridContainer");
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 * Parameters: t.
				 */
				sap.f.GridContainer.prototype._applyItemAutoRows = function(t) {
					/**
					 * @u4a-doc
					 * Function that participates in the design preview runtime workflow.
					 *
					 * Source flow:
					 * - Guards inputs first, then performs the smallest required preview-state change.
					 * Parameters: t.
					 */
					function e(t) {
						// @u4a-src Defines local state used by the following preview calculation.
						var e = t.getLayoutData();
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return !e?.isA?.("sap.f.GridContainerItemLayoutData") || (!e || e.hasAutoHeight())
					}

					/**
					 * @u4a-doc
					 * Function that participates in the design preview runtime workflow.
					 *
					 * Source flow:
					 * - Guards inputs first, then performs the smallest required preview-state change.
					 * Parameters: t.
					 */
					function i(t) {
						// @u4a-src Defines local state used by the following preview calculation.
						var e = t.getLayoutData();
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return e?.isA?.("sap.f.GridContainerItemLayoutData") && e ? e.getActualRows() : 1
					}
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (this._isRenderingFinished && !this.getInlineBlockLayout() && e(t)) {
						// @u4a-src Defines local state used by the following preview calculation.
						var a = t.$(),
							s = this.getActiveLayoutSettings(),
							// @u4a-src Reads browser geometry so the detached marker layer can match the rendered UI.
							o = t.getDomRef() ? t.getDomRef().getBoundingClientRect().height : 0,
							r = s.calculateRowsForItem(Math.round(o));
						// @u4a-src Checks a required condition before the following preview logic continues.
						if (!r)
							// @u4a-src Returns the computed preview value or exits the function at this point.
							return;
						a.parent().css({
							"grid-row": "span " + Math.max(r, i(t))
						})
					}
				};
				/**
				 * @u4a-doc
				 * Function that participates in the design preview runtime workflow.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 */
				sap.f.GridContainer.prototype._enforceMaxColumns = function() {
					/**
					 * @u4a-doc
					 * Function that participates in the design preview runtime workflow.
					 *
					 * Source flow:
					 * - Guards inputs first, then performs the smallest required preview-state change.
					 * Parameters: t.
					 */
					function t(t) {
						// @u4a-src Defines local state used by the following preview calculation.
						var e = t.getLayoutData();
						// @u4a-src Returns the computed preview value or exits the function at this point.
						return e?.isA?.("sap.f.GridContainerItemLayoutData") && e ? e.getColumns() : 1
					}
					// @u4a-src Defines local state used by the following preview calculation.
					var e, i = this.getActiveLayoutSettings();
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (i) {
						e = i.getComputedColumnsCount(this.$().innerWidth());
						// @u4a-src Iterates through a collection and applies the same preview rule to each item.
						/**
						 * @u4a-doc
						 * Collection callback that applies the preview rule to each item in the current list.
						 */
						e && this.getItems().forEach((function(i) {
							i.$().parent().css("grid-column", "span " + Math.min(t(i), e))
						}))
					}
				};
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				sap.ui.requireSync("sap/f/GridContainerRenderer");
				/**
				 * @u4a-doc
				 * Function that reads or derives StylesForItemWrapper without changing preview state.
				 *
				 * Source flow:
				 * - Guards inputs first, then performs the smallest required preview-state change.
				 * Parameters: t, e.
				 */
				sap.f.GridContainerRenderer.getStylesForItemWrapper = function(t, e) {
					// @u4a-src Defines local state used by the following preview calculation.
					var i, a, s = new Map,
						o = ["sapFGridContainerItemWrapper"],
						r = t.getLayoutData();
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (r?.isA?.("sap.f.GridContainerItemLayoutData")) {
						i = r.getColumns();
						a = e.getActiveLayoutSettings().getColumns();
						i && a && (i = Math.min(i, a));
						i && s.set("grid-column", "span " + i);
						e.getInlineBlockLayout() ? s.set("grid-row", "span 1") : (r.getRows() || r.getMinRows()) && s.set("grid-row", "span " + r.getActualRows());
						r.hasAutoHeight() || o.push("sapFGridContainerItemFixedRows")
					}
					t.getVisible() || o.push("sapFGridContainerInvisiblePlaceholder");
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return {
						styles: s,
						classes: o
					}
				};
			})();
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/ui/core/IconPool");
			sap.ui.core.IconPool.registerFont({
				collectionName: "SAP-icons-TNT",
				fontFamily: "SAP-icons-TNT",
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				fontURI: sap.ui.require.toUrl("sap/tnt/themes/base/fonts"),
				lazy: !0
			});
			sap.ui.core.IconPool.registerFont({
				collectionName: "BusinessSuiteInAppSymbols",
				fontFamily: "BusinessSuiteInAppSymbols",
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				fontURI: sap.ui.require.toUrl("sap/ushell/themes/base/fonts"),
				lazy: !0
			});
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.requireSync("sap/m/IllustrationPool");
			sap.m.IllustrationPool.registerIllustrationSet({
				setFamily: "tnt",
				// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
				setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
			}, !1);


			// @u4a-src Iterates through a collection and applies the same preview rule to each item.
			/**
			 * @u4a-doc
			 * Collection callback that applies the preview rule to each item in the current list.
			 */
			parent.oAPP.attr.S_CODE.UA053.forEach((item) => {

				// @u4a-src Checks a required condition before the following preview logic continues.
				if (item.FLD04 === "X") {
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}

				sap.ui.core.IconPool.registerFont({
					collectionName: item.FLD01,
					fontFamily: item.FLD02,
					fontURI: item.FLD03,
					lazy: true
				});
			});

			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			/**
			 * @u4a-doc
			 * UI5 lifecycle callback that reacts after framework state or rendering changes.
			 */
			sap.ui.getCore().attachThemeChanged(function() {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (u4aRootParent.require(parent.oAPP.oDesign.pathInfo.bindPopupBroadCast)("IS-CHANNEL-CREATE") === false) {
					u4aRootParent.setBusy("");
				}
			});
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			/**
			 * @u4a-doc
			 * UI5 lifecycle callback that reacts after framework state or rendering changes.
			 */
			sap.ui.getCore().attachControlEvent(function(oEvent) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oEvent?.mParameters?.browserEvent?.type === "click") {
					event.stopPropagation();
					setUIClickEvent(oEvent.mParameters.browserEvent);
				}
			});
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oEvent.
			 */
			sap.ui.core.Icon.prototype.onclick = function(oEvent) {
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (typeof this._OBJID === "undefined") {
					oEvent.preventDefault();
					// @u4a-src Returns the computed preview value or exits the function at this point.
					return;
				}
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (this.hasListeners("press")) {
					oEvent.setMarked();
				}
				this.firePress({
					/* no parameters */ });
			};
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: oControl.
			 */
			sap.ui.core.UIArea.rerenderControl = function(oControl) {
				// @u4a-src Defines local state used by the following preview calculation.
				var oDomRef = null;
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oControl) {
					// @u4a-src Accesses browser DOM/window state used by the preview iframe.
					oDomRef = oControl.getDomRef();
					// @u4a-src Checks a required condition before the following preview logic continues.
					if (!oDomRef || sap.ui.core.RenderManager.isPreservedContent(oDomRef)) {
						// @u4a-src Accesses browser DOM/window state used by the preview iframe.
						oDomRef = (sap.ui.core.RenderManager.RenderPrefixes.Invisible + oControl.getId() ? window.document.getElementById(sap.ui.core.RenderManager.RenderPrefixes.Invisible + oControl.getId()) : null);
					}
				}
				// @u4a-src Defines local state used by the following preview calculation.
				var oParentDomRef = oDomRef && oDomRef.parentNode;
				// @u4a-src Checks a required condition before the following preview logic continues.
				if (oParentDomRef) {
					// @u4a-src Defines local state used by the following preview calculation.
					var uiArea = oControl.getUIArea();
					// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
					var rm = uiArea && uiArea.oCore ? uiArea.oCore.oRenderManager : sap.ui.getCore().createRenderManager();
					sap.ui.core.RenderManager.preserveContent(oDomRef, /* bPreserveRoot */
						true, /* bPreserveNodesWithId */
						false, oControl /* oControlBeforeRerender */
					);
					// @u4a-src Starts a protected block so preview errors can be contained.
					try {
						rm.render(oControl, oParentDomRef);
					// @u4a-src Handles an error raised by the protected preview block.
					} catch (e) {

						// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
						parent.oAPP.fn.designAreaLockUnlock();
						// @u4a-src Defines local state used by the following preview calculation.
						var l_e = e?.stack || e;
						// @u4a-src Checks a required condition before the following preview logic continues.
						if (typeof oControl?._OBJID !== "undefined") {
							l_e = `ERROR UI ID : ${oControl._OBJID}\n${l_e}`;
						}
						// @u4a-src Schedules preview work to run outside the current browser event frame.
						/**
						 * @u4a-doc
						 * Timer/frame callback used to defer preview work until the browser can update safely.
						 */
						setTimeout(() => {
							// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
							parent.console.error("[U4A preview]=>" + l_e);
							// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
							parent.parent.showCriticalErrorDialog(l_e);
						}, 0);
					}
				// @u4a-src Handles the alternate branch for the condition directly above.
				} else {
					// @u4a-src Defines local state used by the following preview calculation.
					var uiArea = oControl.getUIArea();
					uiArea && uiArea._onControlRendered(oControl);
				}
			};
			// @u4a-src Accesses browser DOM/window state used by the preview iframe.
			window._loaded = true;
			/**
			 * @u4a-doc
			 * Function that participates in the design preview runtime workflow.
			 *
			 * Source flow:
			 * - Guards inputs first, then performs the smallest required preview-state change.
			 * Parameters: url, callback, s.
			 */
			jQuery.u4aJSloadAsync = function(url, callback, s) {
				
				// @u4a-src Defines local state used by the following preview calculation.
				var a = s || false;

				/**
				 * @since   2026-06-04 11:04:32
				 * @version v3.6.4-3
				 * @author  pes
				 * @description
				 * jQuery.ajax() 대신 XMLHttpRequest를 사용하여 스크립트를 로드하도록 변경.
				 * 미리보기 html이 로컬로 변경됨에 따라 host 정보가 다른 경우
				 * jQuery.ajax()가 CORS 정책에 의해 동기 로드 처리가 안되는 문제가 발생하여 변경함.
				 */
				// jQuery.ajax({
				// 	'url': url,
				// 	'dataType': 'script',
				// 	'cache': false,
				// 	'async': a,
				// 	'success': callback || jQuery.noop
				// });
				
				// @u4a-src Defines local state used by the following preview calculation.
				const _xhr = new XMLHttpRequest();
				/**
				 * @u4a-doc
				 * Event/lifecycle handler assigned to a DOM or UI5 object for preview interaction.
				 */
				_xhr.onload = (param) => {

					eval(param.target.response);

				};
							
				_xhr.open("GET", url, a);
				_xhr.send();

			};
			// @u4a-src Hooks into UI5 module, core, lifecycle, or delegate APIs used by the preview runtime.
			sap.ui.getCore().loadLibrary("sap.m");
			attachPreviewSelectionEffectIpcEvent();
			applyPreviewSelectionEffectPersonalizationFromDb();
			/**
			 * @since   2026-06-10 19:24:17
			 * @version v3.6.4-3
			 * @author  pes
			 * @description
			 * 미리보기 아이프레임 부트 시 저장된 마커 표시 상태를 적용한다.
			 */
			applyPreviewMarkVisibility(getPreviewMarkVisiblePersonalization());
			// @u4a-src Waits for asynchronous UI5/preview work before continuing this flow.
			await drawPreview();

			console.timeEnd("미리보기 ATTACH INIT");

			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.console.timeEnd("미리보기 로드 시간");


			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			const _oRow = parent.oAPP.attr.ui.oLTree1.getRows()[0];
			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!_oRow?.getBindingContext) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}

			// @u4a-src Defines local state used by the following preview calculation.
			const _oCtxt = _oRow.getBindingContext();

			// @u4a-src Checks a required condition before the following preview logic continues.
			if (!_oCtxt) {
				// @u4a-src Returns the computed preview value or exits the function at this point.
				return;
			}
			// @u4a-src Reads or updates shared workspace/preview state used across the iframe boundary.
			parent.oAPP.attr.ui.oLTree1.fireCellClick({
				rowBindingContext: _oCtxt
			});


		});
	});

}
