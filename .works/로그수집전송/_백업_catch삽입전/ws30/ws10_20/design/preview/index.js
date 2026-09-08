/**
 * @since   2026-08-19 14:44:39
 * @version vNAN-NAN
 * @author  pes
 * @description
 * 미리보기 영역에서 오류가 발생하는 경우 공통 오류 처리 모듈을 통해 오류 메시지를 처리 하도록 로직 보완.
 */
parent.require(parent.PATHINFO.WSTRYCATCH)(window, document, console);

/**
 * UI5 controls rendered in the design preview iframe are synchronized with
 * the parent workspace, while selection and context markers stay isolated
 * from the controls' own DOM and layout.
 */
var oU4A = {};
oU4A.taskPromiseStack = [];
let G_CRITCAL_ERROR = "";

var oWS = {};
var u4a = {};
//#region Preview selection/context mark configuration
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
/**
 * @since   2026-07-09 14:11:08
 * @version vNAN-NAN
 * @author  pes
 * @description
 * 미리보기에서 선택된 UI의 스타일 클래스 또는 인라인 스타일 변경을 감지하기 위한 MutationObserver 상태를 추가한다.
 */
oWS.sMark.oSelectionMutationObserver = null;
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
//#region Preview selection style personalization
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
 * Returns persisted selection style settings when a personalization source is available.
 */
function getPreviewSelectionPersonalization() {
	var oPers = null;
	try {
		oPers =
			window._u4aPreviewSelectionPersonalization ||
			parent?.oAPP?.attr?.previewSelectionPersonalization ||
			parent?.oAPP?.attr?.oPreviewSelectionPersonalization ||
			parent?.oAPP?.DATA?.APPDATA?.PREVIEW_SELECTION_PERSONALIZATION ||
			null;
	} catch (e) {
		oPers = null;
	}
	if (!oPers || typeof oPers !== "object") {
		return null;
	}
	return oPers;
}

/**
 * Merges the global default selection style with optional personalization values.
 */
function getPreviewSelectionStyleConfig(oPers) {
	var oConfig = {};
	var oDefault = oWS.sMark.selectionStyleDefault || {};
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

/**
 * Normalizes pixel-like values for CSS variables.
 */
function normalizePreviewSelectionCssLength(vValue, vDefault) {
	var vTarget = typeof vValue === "undefined" || vValue === null || vValue === "" ? vDefault : vValue;
	if (typeof vTarget === "number" && isFinite(vTarget)) {
		return vTarget + "px";
	}
	return String(vTarget);
}

/**
 * Normalizes opacity values to the 0-1 CSS alpha range.
 */
function normalizePreviewSelectionOpacity(vValue, vDefault) {
	var fValue = parseFloat(vValue);
	if (isNaN(fValue)) {
		fValue = parseFloat(vDefault);
	}
	if (isNaN(fValue)) {
		fValue = 1;
	}
	return Math.max(0, Math.min(1, fValue));
}

/**
 * Converts a CSS color plus alpha into a CSS color value where possible.
 */
function buildPreviewSelectionColor(sColor, vOpacity) {
	var sValue = typeof sColor === "string" && sColor !== "" ? sColor.trim() : "#0078ff";
	var fOpacity = normalizePreviewSelectionOpacity(vOpacity, 1);
	var aMatch;
	var aParts;
	var iR;
	var iG;
	var iB;
	if (sValue.charAt(0) === "#") {
		if (sValue.length === 4) {
			iR = parseInt(sValue.charAt(1) + sValue.charAt(1), 16);
			iG = parseInt(sValue.charAt(2) + sValue.charAt(2), 16);
			iB = parseInt(sValue.charAt(3) + sValue.charAt(3), 16);
			if (isNaN(iR) || isNaN(iG) || isNaN(iB)) {
				return sValue;
			}
			return "rgba(" + iR + ", " + iG + ", " + iB + ", " + fOpacity + ")";
		}
		if (sValue.length === 7) {
			iR = parseInt(sValue.substr(1, 2), 16);
			iG = parseInt(sValue.substr(3, 2), 16);
			iB = parseInt(sValue.substr(5, 2), 16);
			if (isNaN(iR) || isNaN(iG) || isNaN(iB)) {
				return sValue;
			}
			return "rgba(" + iR + ", " + iG + ", " + iB + ", " + fOpacity + ")";
		}
	}

	aMatch = sValue.match(/^rgba?\(([^)]+)\)$/i);
	if (aMatch) {
		aParts = aMatch[1].split(",");
		if (aParts.length >= 3) {
			return "rgba(" + aParts[0].trim() + ", " + aParts[1].trim() + ", " + aParts[2].trim() + ", " + fOpacity + ")";
		}
	}
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
 * Applies selection style settings to preview CSS variables.
 */
function applyPreviewSelectionPersonalization() {
	var oPers = getPreviewSelectionPersonalization();
	var oConfig = getPreviewSelectionStyleConfig(oPers);
	var oRootStyle = document.documentElement.style;
	var sBorderColor = buildPreviewSelectionColor(oConfig.borderColor, oConfig.borderOpacity);
	var sFillColor = buildPreviewSelectionColor(oConfig.fillColor, oConfig.fillOpacity);
	oRootStyle.setProperty("--u4a-preview-selection-border-color", sBorderColor);
	oRootStyle.setProperty("--u4a-preview-selection-width", normalizePreviewSelectionCssLength(oConfig.borderWidth, 2));
	oRootStyle.setProperty("--u4a-preview-selection-border-style", oConfig.borderStyle || "solid");
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


window.oncontextmenu = function(oEvent) {
	setUiContextMenu(oEvent);
	return false;
};

/**
 * @since   2026-08-19 14:44:39
 * @version vNAN-NAN
 * @author  pes
 * @description
 * 미리보기 영역에서 오류가 발생하는 경우 공통 오류 처리 모듈을 통해 오류 메시지를 처리 하도록 로직 보완.
 * 기존 window.onerror 처리를 주석 처리하여 테스트 중 우선 경로를 공통 처리 모듈으로 바꿨다.
 */
// window.onerror = function(e, t, n, a, o) {
// 	if (G_CRITCAL_ERROR === "X") {
// 		parent.oAPP.fn.designAreaLockUnlock();
// 		return;
// 	}
// 	
// 	setTimeout(() => {
// 		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e);
// 	}, 0);
// 	G_CRITCAL_ERROR = "X";
// 	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
// 	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");
// 	if (typeof e !== "undefined" && e !== "") {
// 		l_msg = l_msg + " \n " + " \n " + e + " \n ";
// 	}
// 	parent.parent.showCriticalErrorDialog(l_msg);
// 	parent.oAPP.fn.designAreaLockUnlock();
// };
// /**
//  * Promise rejection boundary for async preview code.
//  * Converts unhandled rejections into the same critical-error flow as synchronous errors.
//  */
/**
 * @since   2026-08-19 14:44:39
 * @version vNAN-NAN
 * @author  pes
 * @description
 * 미리보기 영역에서 오류가 발생하는 경우 공통 오류 처리 모듈을 통해 오류 메시지를 처리 하도록 로직 보완.
 * 기존 unhandledrejection 처리를 주석 처리하여 공통 처리 모듈 호출을 우선한다.
 */
// window.addEventListener("unhandledrejection", function(e) {
// 	if (G_CRITCAL_ERROR === "X") {
// 		parent.oAPP.fn.designAreaLockUnlock();
// 		return;
// 	}
// 	
// 	setTimeout(() => {
// 		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e.reason.stack);
// 	}, 0);
// 	G_CRITCAL_ERROR = "X";
// 	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
// 	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");
// 	if (typeof e.reason !== "undefined" && e.reason !== "") {
// 		l_msg = l_msg + " \n " + " \n " + e.reason.toString() + " \n ";
// 	}
// 	parent.parent.showCriticalErrorDialog(l_msg);
// 	parent.oAPP.fn.designAreaLockUnlock();
// });
/**
 * Drag-end bridge from the preview iframe to the Electron parent window.
 * The parent process uses this IPC signal to finish design drag/drop cleanup.
 */
window.ondragend = () => {
	parent.parent.IPCRENDERER.send("if-dragEnd");
};
/**
 * Defines the lightweight u4a.m.Preview container control used as the preview root.
 */
function definePreviewControl() {
	if (typeof sap === "undefined" || !sap.ui || typeof sap.ui.define !== "function") {
		return;
	}
	if (typeof u4a !== "undefined" && u4a.m && u4a.m.Preview) {
		return;
	}
	
	sap.ui.define("u4a.m.Preview", ["sap/ui/core/Control"], function(Control) {
		"use strict";
		var oPreview = Control.extend("u4a.m.Preview", {
			metadata: {
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
			
			renderer: function(oRm, oPreview) {
				oRm.openStart("div", oPreview);
				oRm.style("width", "100%");
				oRm.style("height", "100%");
				oRm.class("u4aMPreview");
				oRm.openEnd();
				var aContents = oPreview.getContent(),
					iContLength = aContents.length;
				if (iContLength > 0) {
					for (var i = 0; i < iContLength; i++) {
						var oCont = aContents[i];
						oRm.renderControl(oCont);
					}
				}
				oRm.close("div");
			}
		});
		return oPreview;
	});
}
/**
 * Defines the U4A CustomData shim that writes safe attributes/classes/styles to target DOM nodes.
 */
function defineU4ACustomData() {
	sap.ui.define("u4a.ui.core.CustomData", [
		"sap/ui/core/CustomData",
		"sap/ui/core/Control"
	
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
		const mOwnerControlState = typeof WeakMap === "function" ? new WeakMap() : null;
		const aOwnerControlStateFallback = [];
		const aTrackedOwnerControls = [];
		let bCoreUiUpdatedHandlerAttached = false;

		/**
 * Creates a prototype-free map object for class/style/attribute tracking.
 */
		function createEmptyMap() {
			return Object.create(null);
		}

		/**
 * Returns the UI5 control that owns a CustomData instance.
 */
		function getOwnerControl(oCustomData) {
			if (!oCustomData || typeof oCustomData.getParent !== "function") {
				return null;
			}
			return oCustomData.getParent();
		}

		
		function trackOwnerControl(oOwnerControl) {
			if (!oOwnerControl || aTrackedOwnerControls.indexOf(oOwnerControl) !== -1) {
				return;
			}

			aTrackedOwnerControls.push(oOwnerControl);
		}

		
		function untrackOwnerControl(oOwnerControl) {
			const iIndex = aTrackedOwnerControls.indexOf(oOwnerControl);
			if (iIndex === -1) {
				return;
			}

			aTrackedOwnerControls.splice(iIndex, 1);
		}

		/**
 * Synchronizes all tracked controls whose DOM may have been rerendered.
 */
		function syncTrackedOwnerControls() {
			let oOwnerControl;
			let oOwnerState;
			for (let i = aTrackedOwnerControls.length - 1; i >= 0; i--) {
				oOwnerControl = aTrackedOwnerControls[i];
				oOwnerState = peekOwnerControlState(oOwnerControl);
				if (isDestroyed(oOwnerControl) || !oOwnerState || oOwnerState.refCount === 0) {
					aTrackedOwnerControls.splice(i, 1);
					continue;
				}

				syncOwnerControlDom(oOwnerControl);
			}
		}

		/**
 * Registers one UIUpdated hook so CustomData DOM attributes are restored after UI5 rerendering.
 */
		function ensureCoreUiUpdatedHandler() {
			let oCore;
			if (bCoreUiUpdatedHandlerAttached === true) {
				return;
			}
			if (typeof sap === "undefined" || !sap.ui || typeof sap.ui.getCore !== "function") {
				return;
			}
			oCore = sap.ui.getCore();
			if (!oCore || typeof oCore.attachUIUpdated !== "function") {
				return;
			}

			
			oCore.attachUIUpdated(function () {
				syncTrackedOwnerControls();
			});

			bCoreUiUpdatedHandlerAttached = true;
		}

		/**
 * Finds the nearest control that can receive after-rendering delegates for DOM sync.
 */
		function getRenderDelegateOwnerControl(oOwnerControl) {
			let oCurrent = oOwnerControl;

			/**
			 * CustomData가 추가된 부모 UI와 실제 렌더링 완료 이벤트를 받을 UI가
			 * 항상 같지는 않다.
			 *
			 * sap.m.IconTabFilter는 IconTabBar/IconTabHeader 쪽 renderer에 의해
			 * DOM이 생성/교체될 수 있으므로, 가장 가까운 상위 sap.ui.core.Control의
			 * onAfterRendering 이후 다시 sync해야 한다.
			 */
			while (oCurrent) {
				if (oCurrent instanceof Control && typeof oCurrent.addEventDelegate === "function") {
					return oCurrent;
				}
				if (typeof oCurrent.getParent !== "function") {
					break;
				}

				oCurrent = oCurrent.getParent();
			}
			return null;
		}

		
		function isDestroyed(oOwnerControl) {
			if (!oOwnerControl) {
				return true;
			}

			// UI5 ManagedObject 계열은 destroy 이후 bIsDestroyed가 true가 된다.
			// 일부 내부 흐름에서는 _bIsBeingDestroyed가 먼저 설정될 수 있으므로 같이 방어한다.
			return oOwnerControl.bIsDestroyed === true || oOwnerControl._bIsBeingDestroyed === true;
		}

		
		function normalizeKey(sKey) {
			if (typeof sKey !== "string") {
				return "";
			}
			return sKey.trim();
		}

		
		function normalizeText(sValue) {
			if (typeof sValue !== "string") {
				return "";
			}
			return sValue.trim();
		}

		
		function camelToKebab(sName) {
			
			return sName.replace(/[A-Z]/g, function (sChar) {
				return "-" + sChar.toLowerCase();
			});
		}

		
		function valueToString(sKeyLower, vValue) {
			if (typeof vValue === "function") {
				return null;
			}
			if (vValue === null || typeof vValue === "undefined") {
				return "";
			}

			// class 값이 배열이면 class list로 처리한다.
			if (sKeyLower === "class" && Array.isArray(vValue)) {
				return vValue.join(" ");
			}

			// style 값이 object면 CSS 문자열로 변환한다.
			// 예: { color: "red", marginLeft: "1rem" }
			// -> color:red;margin-left:1rem;
			if (sKeyLower === "style" && typeof vValue === "object" && !Array.isArray(vValue)) {
				
				return Object.keys(vValue).map(function (sProp) {
					return camelToKebab(sProp) + ":" + vValue[sProp];
				}).join(";");
			}
			if (typeof vValue === "object") {
				return JSON.stringify(vValue);
			}
			return String(vValue);
		}

		
		function isDeniedAttribute(sKey) {
			const sLowerKey = sKey.toLowerCase();

			// DOM 안정성상 id 변경은 막는다.
			if (sLowerKey === "id") {
				return true;
			}

			// onclick, onmouseover 같은 inline event attribute는 차단한다.
			if (/^on/i.test(sKey)) {
				return true;
			}
			return false;
		}

		
		function isValidAttributeName(sKey) {
			return /^[a-zA-Z_][a-zA-Z0-9_\-:.]*$/.test(sKey);
		}

		
		function createOwnerControlState() {
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

		
		function findFallbackOwnerControlState(oOwnerControl) {
			let i;
			for (i = 0; i < aOwnerControlStateFallback.length; i++) {
				if (aOwnerControlStateFallback[i].ownerControl === oOwnerControl) {
					return aOwnerControlStateFallback[i].state;
				}
			}
			return null;
		}

		
		function getOwnerControlState(oOwnerControl) {
			let oState;
			if (mOwnerControlState) {
				oState = mOwnerControlState.get(oOwnerControl);
				if (!oState) {
					oState = createOwnerControlState();
					mOwnerControlState.set(oOwnerControl, oState);
				}
				return oState;
			}

			// WeakMap이 없는 구형 환경 fallback.
			// 부모 UI 객체에 내부 property를 직접 남기지 않기 위해 별도 배열로 관리한다.
			oState = findFallbackOwnerControlState(oOwnerControl);
			if (!oState) {
				oState = createOwnerControlState();

				aOwnerControlStateFallback.push({
					ownerControl: oOwnerControl,
					state: oState
				});
			}
			return oState;
		}

		
		function peekOwnerControlState(oOwnerControl) {
			if (!oOwnerControl) {
				return null;
			}
			if (mOwnerControlState) {
				return mOwnerControlState.get(oOwnerControl) || null;
			}
			return findFallbackOwnerControlState(oOwnerControl);
		}

		
		function deleteFallbackOwnerControlState(oOwnerControl) {
			let i;
			if (mOwnerControlState || !oOwnerControl) {
				return;
			}
			for (i = aOwnerControlStateFallback.length - 1; i >= 0; i--) {
				if (aOwnerControlStateFallback[i].ownerControl === oOwnerControl) {
					aOwnerControlStateFallback.splice(i, 1);
					return;
				}
			}
		}

		
		function getTargetKey(sTargetDomRef, sTargetSelector) {
			return normalizeText(sTargetDomRef) + "||" + normalizeText(sTargetSelector);
		}

		
		function addDomCandidate(aDoms, oDom) {
			if (!oDom || typeof oDom.nodeType !== "number" || oDom.nodeType !== 1) {
				return;
			}
			if (aDoms.indexOf(oDom) !== -1) {
				return;
			}

			aDoms.push(oDom);
		}

		
		function escapeCssAttributeValue(sValue) {
			return String(sValue).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
		}

		
		function collectDomCandidatesByAttribute(aDoms, sAttrName, sAttrValue) {
			let aFound;
			let i;
			if (!sAttrValue) {
				return;
			}
			try {
				aFound = document.querySelectorAll("[" + sAttrName + "=\"" + escapeCssAttributeValue(sAttrValue) + "\"]");
				for (i = 0; i < aFound.length; i++) {
					addDomCandidate(aDoms, aFound[i]);
				}
			} catch (e) {}
		}

		
		function getDefaultTargetDomCandidates(oOwnerControl) {
			let aDoms = [];
			let sId;
			if (isDestroyed(oOwnerControl)) {
				return aDoms;
			}

			sId = typeof oOwnerControl.getId === "function" ? oOwnerControl.getId() : "";
			if (sId) {
				addDomCandidate(aDoms, document.getElementById(sId));
				collectDomCandidatesByAttribute(aDoms, "data-sap-ui", sId);
				collectDomCandidatesByAttribute(aDoms, "data-sap-ui-render", sId);
			}
			if (aDoms.length === 0 && typeof oOwnerControl.getDomRef === "function") {
				addDomCandidate(aDoms, oOwnerControl.getDomRef());
			}
			return aDoms;
		}

		
		function getTargetDom(oOwnerControl, sTargetDomRef, sTargetSelector) {
			let aDomCandidates;
			let oBaseDom;
			let i;
			const sDomRef = normalizeText(sTargetDomRef);
			const sSelector = normalizeText(sTargetSelector);
			if (!sDomRef) {
				aDomCandidates = getDefaultTargetDomCandidates(oOwnerControl);
				if (aDomCandidates.length > 0) {
					oBaseDom = aDomCandidates[0];
					if (!sSelector) {
						return oBaseDom;
					}
					for (i = 0; i < aDomCandidates.length; i++) {
						try {
							oBaseDom = aDomCandidates[i].querySelector(sSelector);
							if (oBaseDom) {
								return oBaseDom;
							}
						} catch (e) {
							return null;
						}
					}
				}
			}
			if (isDestroyed(oOwnerControl) || typeof oOwnerControl.getDomRef !== "function") {
				return null;
			}

			// targetDomRef가 있으면 UI5의 getDomRef(sSuffix)를 우선 사용한다.
			// 공백이면 부모 UI의 root DOM을 대상으로 한다.
			oBaseDom = sDomRef ? oOwnerControl.getDomRef(sDomRef) : oOwnerControl.getDomRef();
			if (!oBaseDom) {
				return null;
			}
			if (!sSelector) {
				return oBaseDom;
			}
			try {
				return oBaseDom.querySelector(sSelector);
			} catch (e) {
				// 잘못된 CSS selector는 DOM 반영 대상 없음으로 처리한다.
				return null;
			}
		}

		
		function splitClassNames(sValue) {
			const mClasses = createEmptyMap();
			if (!sValue) {
				return mClasses;
			}
			
			sValue.split(/\s+/).forEach(function (sClassName) {
				if (!sClassName) {
					return;
				}

				mClasses[sClassName] = true;
			});
			return mClasses;
		}

		
		function parseStyle(sValue) {
			const mStyles = createEmptyMap();
			let oTemp;
			let i;
			let sProp;
			if (!sValue) {
				return mStyles;
			}
			oTemp = document.createElement("div");
			oTemp.style.cssText = sValue;
			for (i = 0; i < oTemp.style.length; i++) {
				sProp = oTemp.style[i];

				mStyles[sProp] = {
					value: oTemp.style.getPropertyValue(sProp),
					priority: oTemp.style.getPropertyPriority(sProp)
				};
			}
			return mStyles;
		}

		
		function createTargetPlan(oAttr) {
			return {
				targetDomRef: oAttr.targetDomRef,
				targetSelector: oAttr.targetSelector,
				classes: createEmptyMap(),
				styles: createEmptyMap(),
				attrs: createEmptyMap()
			};
		}

		
		function collectPlans(oOwnerControl) {
			let mPlans = createEmptyMap();
			if (isDestroyed(oOwnerControl) || typeof oOwnerControl.getCustomData !== "function") {
				return mPlans;
			}
			
			oOwnerControl.getCustomData().forEach(function (oCustomData) {
				let oAttr;
				let sTargetKey;
				let oPlan;
				let mClass;
				let mStyle;
				if (!oCustomData || typeof oCustomData._getU4aDomAttribute !== "function") {
					return;
				}
				oAttr = oCustomData._getU4aDomAttribute();
				if (!oAttr) {
					return;
				}
				sTargetKey = getTargetKey(oAttr.targetDomRef, oAttr.targetSelector);
				oPlan = mPlans[sTargetKey];
				if (!oPlan) {
					oPlan = createTargetPlan(oAttr);
					mPlans[sTargetKey] = oPlan;
				}
				if (oAttr.keyLower === "class") {
					mClass = splitClassNames(oAttr.value);
					
					Object.keys(mClass).forEach(function (sClassName) {
						// class는 다중 CustomData 값을 병합한다.
						oPlan.classes[sClassName] = true;
					});
					return;
				}
				if (oAttr.keyLower === "style") {
					mStyle = parseStyle(oAttr.value);
					
					Object.keys(mStyle).forEach(function (sProp) {
						// 동일 CSS property는 뒤쪽 CustomData 값이 최종 우선한다.
						oPlan.styles[sProp] = mStyle[sProp];
					});
					return;
				}
				if (!isValidAttributeName(oAttr.key)) {
					return;
				}
				if (isDeniedAttribute(oAttr.key)) {
					return;
				}

				// 일반 attribute는 sap.ui.core.CustomData와 동일하게
				// 동일 key가 여러 번 나오면 aggregation 순서상 마지막 값이 최종 적용된다.
				oPlan.attrs[oAttr.key] = oAttr.value;
			});
			return mPlans;
		}

		
		function cleanupClasses(oDom, oPrevTargetState) {
			
			Object.keys(oPrevTargetState.classes).forEach(function (sClassName) {
				let oInfo = oPrevTargetState.classes[sClassName];

				// U4A가 실제로 추가한 class만 제거한다.
				// 기존 DOM에 이미 존재하던 class는 제거하지 않는다.
				if (oInfo && oInfo.added === true) {
					oDom.classList.remove(sClassName);
				}
			});
		}

		
		function cleanupStyles(oDom, oPrevTargetState) {
			
			Object.keys(oPrevTargetState.styles).forEach(function (sProp) {
				let oInfo = oPrevTargetState.styles[sProp];
				let sCurrentValue;
				let sCurrentPriority;
				if (!oInfo) {
					return;
				}
				sCurrentValue = oDom.style.getPropertyValue(sProp);
				sCurrentPriority = oDom.style.getPropertyPriority(sProp);

				// 현재 DOM 값이 마지막으로 U4A가 적용한 값과 같을 때만 원복한다.
				// 값이 다르면 이후 외부 로직이 변경한 것으로 판단하고 건드리지 않는다.
				if (sCurrentValue !== oInfo.appliedValue || sCurrentPriority !== oInfo.appliedPriority) {
					return;
				}
				if (oInfo.hadValue) {
					oDom.style.setProperty(sProp, oInfo.oldValue, oInfo.oldPriority);
				} else {
					oDom.style.removeProperty(sProp);
				}
			});
		}

		
		function cleanupAttrs(oDom, oPrevTargetState) {
			
			Object.keys(oPrevTargetState.attrs).forEach(function (sAttr) {
				let oInfo = oPrevTargetState.attrs[sAttr];
				let sCurrentValue;
				if (!oInfo) {
					return;
				}

				sCurrentValue = oDom.getAttribute(sAttr);

				// 현재 DOM 값이 마지막으로 U4A가 적용한 값과 같을 때만 원복한다.
				// 값이 다르면 이후 외부 로직이 변경한 것으로 판단하고 건드리지 않는다.
				if (sCurrentValue !== oInfo.appliedValue) {
					return;
				}
				if (oInfo.hadValue) {
					oDom.setAttribute(sAttr, oInfo.oldValue);
				} else {
					oDom.removeAttribute(sAttr);
				}
			});
		}

		
		function cleanupTargetState(oDom, oPrevTargetState) {
			if (!oDom || !oPrevTargetState) {
				return;
			}

			cleanupClasses(oDom, oPrevTargetState);
			cleanupStyles(oDom, oPrevTargetState);
			cleanupAttrs(oDom, oPrevTargetState);
		}

		
		function applyClasses(oDom, oPlan, oNextTargetState) {
			
			Object.keys(oPlan.classes).forEach(function (sClassName) {
				const bHadClass = oDom.classList.contains(sClassName);
				oDom.classList.add(sClassName);

				oNextTargetState.classes[sClassName] = {
					// 기존에 없던 class만 U4A가 추가한 것으로 추적한다.
					added: !bHadClass
				};
			});
		}

		
		function applyStyles(oDom, oPlan, oNextTargetState) {
			
			Object.keys(oPlan.styles).forEach(function (sProp) {
				const oStyle = oPlan.styles[sProp];
				let sOldValue = oDom.style.getPropertyValue(sProp);
				const sOldPriority = oDom.style.getPropertyPriority(sProp);
				let bHadValue = sOldValue !== "" || sOldPriority !== "";
				oDom.style.setProperty(sProp, oStyle.value, oStyle.priority);

				oNextTargetState.styles[sProp] = {
					hadValue: bHadValue,
					oldValue: sOldValue,
					oldPriority: sOldPriority,
					appliedValue: oDom.style.getPropertyValue(sProp),
					appliedPriority: oDom.style.getPropertyPriority(sProp)
				};
			});
		}

		
		function applyAttrs(oDom, oPlan, oNextTargetState) {
			
			Object.keys(oPlan.attrs).forEach(function (sAttr) {
				let sOldValue = oDom.getAttribute(sAttr);
				let bHadValue = sOldValue !== null && typeof sOldValue !== "undefined";
				let sValue = oPlan.attrs[sAttr];
				oDom.setAttribute(sAttr, sValue);

				oNextTargetState.attrs[sAttr] = {
					hadValue: bHadValue,
					oldValue: sOldValue,
					appliedValue: oDom.getAttribute(sAttr)
				};
			});
		}

		
		function createNextTargetState(oDom, oPlan) {
			return {
				dom: oDom,
				targetDomRef: oPlan.targetDomRef,
				targetSelector: oPlan.targetSelector,
				classes: createEmptyMap(),
				styles: createEmptyMap(),
				attrs: createEmptyMap()
			};
		}

		
		function applyTargetPlan(oDom, oPlan) {
			let oNextTargetState = createNextTargetState(oDom, oPlan);

			applyClasses(oDom, oPlan, oNextTargetState);
			applyStyles(oDom, oPlan, oNextTargetState);
			applyAttrs(oDom, oPlan, oNextTargetState);
			return oNextTargetState;
		}

		
		function cleanupRemovedTargets(oOwnerControl, oOwnerState, mPlans) {
			
			Object.keys(oOwnerState.targets).forEach(function (sTargetKey) {
				let oPrevTargetState;
				let oCurrentDom;
				if (mPlans[sTargetKey]) {
					return;
				}

				oPrevTargetState = oOwnerState.targets[sTargetKey];

				// 이전 target이 더 이상 현재 CustomData 계획에 없으면
				// 이전에 U4A가 적용했던 값만 회수한다.
				oCurrentDom = getTargetDom(
					oOwnerControl,
					oPrevTargetState.targetDomRef,
					oPrevTargetState.targetSelector
				);

				// 렌더링으로 DOM이 교체된 경우 이전 DOM 상태를 새 DOM에 적용하면 안 된다.
				if (oCurrentDom && oCurrentDom === oPrevTargetState.dom) {
					cleanupTargetState(oCurrentDom, oPrevTargetState);
				}

				delete oOwnerState.targets[sTargetKey];
			});
		}

		
		function syncOwnerControlDom(oOwnerControl) {
			let oOwnerState;
			let mPlans;
			if (isDestroyed(oOwnerControl)) {
				return;
			}
			if (!oOwnerControl || typeof oOwnerControl.getCustomData !== "function") {
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			mPlans = collectPlans(oOwnerControl);

			cleanupRemovedTargets(oOwnerControl, oOwnerState, mPlans);
			
			Object.keys(mPlans).forEach(function (sTargetKey) {
				let oPlan = mPlans[sTargetKey];
				let oDom = getTargetDom(oOwnerControl, oPlan.targetDomRef, oPlan.targetSelector);
				let oPrevTargetState = oOwnerState.targets[sTargetKey];
				if (!oDom) {
					// 현재 DOM이 없다면 이전 DOM은 이미 제거된 것으로 판단한다.
					// 이후 onAfterRendering 시점에 다시 sync되어 신규 DOM에 반영된다.
					delete oOwnerState.targets[sTargetKey];
					return;
				}

				// 렌더링으로 DOM이 교체된 경우 이전 DOM 상태를 새 DOM에 cleanup하지 않는다.
				// 이전 DOM은 이미 제거된 것이므로 신규 DOM에는 현재 계획만 새로 적용한다.
				if (oPrevTargetState && oPrevTargetState.dom === oDom) {
					cleanupTargetState(oDom, oPrevTargetState);
				}

				oOwnerState.targets[sTargetKey] = applyTargetPlan(oDom, oPlan);
			});
		}

		
		function requestSync(oOwnerControl) {
			let oOwnerState;
			if (isDestroyed(oOwnerControl)) {
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			if (oOwnerState.syncRequested) {
				return;
			}

			oOwnerState.syncRequested = true;
			
			Promise.resolve().then(function () {
				oOwnerState.syncRequested = false;
				if (isDestroyed(oOwnerControl)) {
					return;
				}

				syncOwnerControlDom(oOwnerControl);
			});
		}

		
		function ensureOwnerControlDelegate(oOwnerControl) {
			let oOwnerState;
			const oRenderDelegateOwnerControl = getRenderDelegateOwnerControl(oOwnerControl);
			if (isDestroyed(oOwnerControl) || isDestroyed(oRenderDelegateOwnerControl)) {
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			if (
				oOwnerState.delegate &&
				oOwnerState.delegateOwnerControl === oRenderDelegateOwnerControl
			) {
				return;
			}

			// 기존에 다른 Control에 delegate가 등록되어 있다면 먼저 제거한다.
			// 예: IconTabFilter가 다른 IconTabBar로 이동한 경우
			if (
				oOwnerState.delegate &&
				oOwnerState.delegateOwnerControl &&
				oOwnerState.delegateOwnerControl.removeEventDelegate
			) {
				oOwnerState.delegateOwnerControl.removeEventDelegate(oOwnerState.delegate);
			}

			// CustomData가 추가된 부모 UI당 delegate는 하나만 등록한다.
			// 단, delegate 등록 대상은 "CustomData가 추가된 UI"가 아니라
			// 실제 렌더링 완료 시점을 받을 수 있는 가장 가까운 상위 Control이다.
			oOwnerState.delegateOwnerControl = oRenderDelegateOwnerControl;
			oOwnerState.delegate = {
				
				onAfterRendering: function () {
					requestSync(oOwnerControl);

					// IconTabBar/IconTabHeader 계열은 렌더링 직후 내부 DOM 보정이 추가로 수행될 수 있다.
					// 같은 tick 이후 한 번 더 sync하여 부모 렌더링에 의해 DOM이 교체되거나 보정된 경우도 보완한다.
					
					setTimeout(function () {
						requestSync(oOwnerControl);
					}, 0);
				}
			};
			oRenderDelegateOwnerControl.addEventDelegate(oOwnerState.delegate);
		}

		
		function removeOwnerControlDelegateIfUnused(oOwnerControl) {
			let oOwnerState;
			if (!oOwnerControl) {
				return;
			}

			oOwnerState = peekOwnerControlState(oOwnerControl);
			if (!oOwnerState || oOwnerState.refCount > 0 || !oOwnerState.delegate) {
				return;
			}
			if (
				oOwnerState.delegateOwnerControl &&
				oOwnerState.delegateOwnerControl.removeEventDelegate
			) {
				oOwnerState.delegateOwnerControl.removeEventDelegate(oOwnerState.delegate);
			}

			oOwnerState.delegateOwnerControl = null;
			oOwnerState.delegate = null;

			// WeakMap은 별도 delete가 필수는 아니지만, fallback 배열은 직접 정리한다.
			if (!mOwnerControlState) {
				deleteFallbackOwnerControlState(oOwnerControl);
			}
		}

		
		function increaseOwnerControlRef(oOwnerControl) {
			let oOwnerState;
			if (isDestroyed(oOwnerControl)) {
				return;
			}

			oOwnerState = getOwnerControlState(oOwnerControl);
			oOwnerState.refCount += 1;

			trackOwnerControl(oOwnerControl);
			ensureCoreUiUpdatedHandler();
			ensureOwnerControlDelegate(oOwnerControl);
		}

		
		function decreaseOwnerControlRef(oOwnerControl) {
			let oOwnerState;
			if (!oOwnerControl) {
				return;
			}

			oOwnerState = peekOwnerControlState(oOwnerControl);
			if (!oOwnerState) {
				return;
			}

			oOwnerState.refCount = Math.max(oOwnerState.refCount - 1, 0);
			if (oOwnerState.refCount === 0) {
				untrackOwnerControl(oOwnerControl);
			}

			removeOwnerControlDelegateIfUnused(oOwnerControl);
		}
		const U4ACustomData = CustomData.extend("u4a.ui.core.CustomData", {
			metadata: {
				library: "u4a.ui.core",

				properties: {
					/**
					 * 부모 UI의 getDomRef(sSuffix)에 전달할 DOM suffix.
					 * 공백이면 부모 UI의 root DOM을 대상으로 한다.
					 */
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
			
			_checkWriteToDom: function () {
				return null;
			},

			/**
			 * 현재 CustomData를 DOM attribute 반영 대상으로 변환한다.
			 *
			 * key 비교 정책:
			 * - class/style 판단은 소문자 기준으로 수행한다.
			 * - 일반 attribute 적용 시에는 사용자가 입력한 key 문자열을 유지한다.
			 */
			
			_getU4aDomAttribute: function () {
				let sKey;
				let sKeyLower;
				let sValue;
				if (!this.getWriteToDom()) {
					return null;
				}

				sKey = normalizeKey(this.getKey());
				if (!sKey) {
					return null;
				}

				sKeyLower = sKey.toLowerCase();
				sValue = valueToString(sKeyLower, this.getValue());
				if (sValue === null) {
					return null;
				}
				return {
					key: sKey,
					keyLower: sKeyLower,
					value: sValue,
					targetDomRef: normalizeText(this.getTargetDomRef && this.getTargetDomRef()),
					targetSelector: normalizeText(this.getTargetSelector && this.getTargetSelector())
				};
			},

			
			setKey: function () {
				let vReturn = CustomData.prototype.setKey.apply(this, arguments);

				requestSync(getOwnerControl(this));
				return vReturn;
			},

			
			setValue: function () {
				let vReturn = CustomData.prototype.setValue.apply(this, arguments);

				requestSync(getOwnerControl(this));
				return vReturn;
			},

			
			setWriteToDom: function () {
				let vReturn = CustomData.prototype.setWriteToDom.apply(this, arguments);

				requestSync(getOwnerControl(this));
				return vReturn;
			},

			
			
			setTargetDomRef: function (sTargetDomRef) {
				let vReturn = this.setProperty("targetDomRef", sTargetDomRef, true);

				requestSync(getOwnerControl(this));
				return vReturn;
			},

			
			setTargetSelector: function (sTargetSelector) {
				let vReturn = this.setProperty("targetSelector", sTargetSelector, true);

				requestSync(getOwnerControl(this));
				return vReturn;
			},

			
			_requestU4aDomSync: function () {
				requestSync(getOwnerControl(this));
			},

			
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
			
			setParent: function () {
				const oOldOwnerControl = this._u4aOwnerControl;
				let vReturn = CustomData.prototype.setParent.apply(this, arguments);
				const oNewOwnerControl = getOwnerControl(this);

				this._bindU4aOwnerControl(oNewOwnerControl);
				if (oOldOwnerControl && oOldOwnerControl !== oNewOwnerControl) {
					requestSync(oOldOwnerControl);
				}

				requestSync(oNewOwnerControl);
				return vReturn;
			},

			
			_bindU4aOwnerControl: function (oOwnerControl) {
				if (this._u4aOwnerControl === oOwnerControl) {
					return;
				}
				if (this._u4aOwnerControl) {
					decreaseOwnerControlRef(this._u4aOwnerControl);
				}

				this._u4aOwnerControl = oOwnerControl || null;
				if (!this._u4aOwnerControl) {
					return;
				}

				increaseOwnerControlRef(this._u4aOwnerControl);
			},

			
			exit: function () {
				const oOwnerControl = this._u4aOwnerControl;

				this._bindU4aOwnerControl(null);

				requestSync(oOwnerControl);
			}
		});
		return U4ACustomData;
	});

}
//#region Preview mark CustomData helpers
// Marker state is stored with u4a.ui.core.CustomData(writeToDom=true).
// This keeps the rendered DOM attributes/classes in sync after UI5
// invalidation or rerender cycles.
/**
 * Finds an existing U4A marker CustomData entry on a UI control.
 */

function getPreviewMarkCustomData(oUi, sKey, vValue) {
	if (!oUi || typeof oUi.getCustomData !== "function") {
		return null;
	}
	var aCustomData = oUi.getCustomData();
	if (!aCustomData || aCustomData.length === 0) {
		return null;
	}
	for (var i = 0, l = aCustomData.length; i < l; i++) {
		var oCustomData = aCustomData[i];
		if (!oCustomData || typeof oCustomData.isA !== "function") {
			continue;
		}
		if (oCustomData.isA("u4a.ui.core.CustomData") !== true) {
			continue;
		}
		if (typeof oCustomData.getKey !== "function" || oCustomData.getKey() !== sKey) {
			continue;
		}
		if (typeof vValue !== "undefined" && String(oCustomData.getValue()) !== String(vValue)) {
			continue;
		}
		return oCustomData;
	}
	return null;
}



function requestPreviewMarkCustomDataSync(oCustomData) {
	if (!oCustomData) {
		return;
	}
	if (typeof oCustomData._syncU4aDomNow === "function") {
		oCustomData._syncU4aDomNow();
	}
	if (typeof oCustomData._requestU4aDomSync === "function") {
		oCustomData._requestU4aDomSync();
		return;
	}
	if (typeof oCustomData.setValue === "function" && typeof oCustomData.getValue === "function") {
		oCustomData.setValue(oCustomData.getValue());
	}
}

/**
 * Adds or updates marker CustomData for selectable/selected/context attributes.
 */

function addPreviewMarkCustomData(oUi, sKey, vValue, bMatchValue) {
	var oCustomData;
	if (!oUi || typeof oUi.addCustomData !== "function") {
		return null;
	}

	// class처럼 동일 key를 여러 건 병합해서 사용하는 attribute는
	// 기존 class CustomData 값을 덮어쓰지 않도록 key + value 기준으로 찾는다.
	oCustomData = getPreviewMarkCustomData(
		oUi,
		sKey,
		bMatchValue === true ? vValue : undefined
	);
	if (oCustomData) {
		if (String(oCustomData.getValue()) !== String(vValue)) {
			oCustomData.setValue(vValue);
		}
		if (typeof oCustomData.getWriteToDom === "function" && oCustomData.getWriteToDom() !== true) {
			oCustomData.setWriteToDom(true);
		}
		requestPreviewMarkCustomDataSync(oCustomData);
		return oCustomData;
	}
	oCustomData = new u4a.ui.core.CustomData({
		key: sKey,
		value: vValue,
		writeToDom: true
	});
	oUi.addCustomData(oCustomData);
	requestPreviewMarkCustomDataSync(oCustomData);
	return oCustomData;
}

/**
 * Removes marker CustomData from a UI control when the marker is cleared.
 */

function removePreviewMarkCustomData(oUi, sKey, vValue) {
	var oCustomData;
	if (!oUi || typeof oUi.removeCustomData !== "function") {
		return;
	}
	oCustomData = getPreviewMarkCustomData(oUi, sKey, vValue);
	if (!oCustomData) {
		return;
	}
	try {
		oUi.removeCustomData(oCustomData);
		oCustomData.destroy();
	} catch (e) {}
}

/**
 * Clears normal selection marker CustomData from one UI control.
 */

function clearPreviewMarkFromUi(oUi) {
	if (!oUi) {
		return;
	}
	removePreviewMarkCustomData(oUi, oWS.sMark.selectedAttr, oWS.sMark.selectedValue);
}

/**
 * Removes stale selection attributes from DOM nodes left behind by rerendering.
 */

function cleanupPreviewMarkDomFallback() {
	var aSelectedDom;
	try {
		aSelectedDom = document.body.querySelectorAll("[" + oWS.sMark.selectedAttr + "='" + oWS.sMark.selectedValue + "']");
		for (var i = 0, l = aSelectedDom.length; i < l; i++) {
			aSelectedDom[i].removeAttribute(oWS.sMark.selectedAttr);
		}
	} catch (e) {}
}



function clearPreviewContextMenuMarkFromUi(oUi) {
	if (!oUi) {
		return;
	}
	removePreviewMarkCustomData(oUi, oWS.sMark.contextAttr, oWS.sMark.selectedValue);
}



function cleanupPreviewContextMenuMarkDomFallback() {
	var aContextDom;
	try {
		aContextDom = document.body.querySelectorAll("[" + oWS.sMark.contextAttr + "='" + oWS.sMark.selectedValue + "']");
		for (var i = 0, l = aContextDom.length; i < l; i++) {
			aContextDom[i].removeAttribute(oWS.sMark.contextAttr);
		}
	} catch (e) {}
}

/**
 * Stores the UI that opened the context menu and draws its context highlight layer.
 */
function markPreviewContextMenuUi(oUi) {
	if (!oUi) {
		return;
	}
	if (oWS.sMark.oContextUi) {
		clearPreviewContextMenuMarkFromUi(oWS.sMark.oContextUi);
	}

	cleanupPreviewContextMenuMarkDomFallback();
	oWS.sMark.oContextUi = oUi;
	oWS.sMark.bContextMenuOpen = true;
	updatePreviewContextLayer();
}

/**
 * Clears the context-menu highlight state and hides the context overlay layer.
 */
function removePreviewContextMenuMark() {
	if (oWS.sMark.oContextUi) {
		clearPreviewContextMenuMarkFromUi(oWS.sMark.oContextUi);
		oWS.sMark.oContextUi = null;
	}

	cleanupPreviewContextMenuMarkDomFallback();
	oWS.sMark.bContextMenuOpen = false;
	hidePreviewContextLayer();
	if (oWS.sMark.oSelectedUi) {
		requestPreviewSelectionLayerUpdate();
	}
}

/**
 * Hooks menu close events so the context highlight is cleaned up reliably.
 */
function bindPreviewContextMenuMarkCleanup(oMenu) {
	var aCloseEvents = ["attachClosed", "attachAfterClose", "attachBeforeClose", "attachClose"];
	var fnOrgClose;
	if (!oMenu || oMenu._u4aContextMarkCleanupBound === true) {
		return;
	}

	oMenu._u4aContextMarkCleanupBound = true;
	for (var i = 0, l = aCloseEvents.length; i < l; i++) {
		if (typeof oMenu[aCloseEvents[i]] !== "function") {
			continue;
		}
		try {
			oMenu[aCloseEvents[i]](removePreviewContextMenuMark);
		} catch (e) {}
	}
	if (typeof oMenu.close !== "function" || oMenu._u4aContextMarkCloseWrapped === true) {
		return;
	}

	fnOrgClose = oMenu.close;
	
	oMenu.close = function() {
		removePreviewContextMenuMark();
		return fnOrgClose.apply(this, arguments);
	};
	oMenu._u4aContextMarkCloseWrapped = true;
}


function applyPreviewContextMenuStyleClass(oMenu) {
	
	function applyMenuDomClass() {
		var oDom;
		var oCurrent;
		if (!oMenu || typeof oMenu.getDomRef !== "function") {
			return;
		}
		oDom = oMenu.getDomRef();
		if (!oDom) {
			return;
		}
		if (oDom.classList) {
			oDom.classList.add("u4a_ws_preview_context_menu");
		}

		oCurrent = oDom.parentElement;
		while (oCurrent && oCurrent !== document.body) {
			if (
				oCurrent.classList &&
				(
					oCurrent.classList.contains("sapUiPopup") ||
					oCurrent.getAttribute("data-sap-ui-popup")
				)
			) {
				oCurrent.classList.add("u4a_ws_preview_context_menu_popup");
			}

			oCurrent = oCurrent.parentElement;
		}
	}
	if (!oMenu) {
		return;
	}
	if (typeof oMenu.addStyleClass === "function") {
		oMenu.addStyleClass("u4a_ws_preview_context_menu");
	}

	applyMenuDomClass();
	window.setTimeout(applyMenuDomClass, 0);
}
//#region Preview selected UI layer helpers
// Draws a single highlight layer over the selected UI instead of styling the
// selected UI DOM directly. The layer is appended to body and positioned with
// getBoundingClientRect() + page scroll offsets, following the preview sample
// behavior without occupying layout space.
/**
 * Creates or returns the body-level overlay DOM used for normal selection.
 */
function getPreviewSelectionLayer() {
	var oLayer = oWS.sMark.oSelectionLayer;
	if (oLayer && oLayer.parentNode) {
		return oLayer;
	}
	oLayer = document.createElement("div");
	oLayer.id = "u4a_ws_selection_layer";
	oLayer.className = "u4a_ws_selection_layer";
	oLayer.setAttribute("aria-hidden", "true");
	oLayer.setAttribute("data-u4a-selection-layer", "X");
	document.body.appendChild(oLayer);
	oWS.sMark.oSelectionLayer = oLayer;
	return oLayer;
}


function syncPreviewSelectionLayerClass(oLayer) {
	if (!oLayer || !oLayer.classList) {
		return;
	}
	oLayer.classList.add("u4a_ws_selection_layer");
}



function collectPreviewSelectionDomCandidates(oUi) {
	var aDoms = [];
	var sId;
	var aFound;

	
	function lf_addDom(oDom) {
		if (!oDom || oDom.nodeType !== 1 || aDoms.indexOf(oDom) !== -1) {
			return;
		}

		aDoms.push(oDom);
	}

	
	function lf_escapeAttr(sValue) {
		return String(sValue).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
	}

	
	function lf_collectByAttr(sAttrName, sValue) {
		if (!sValue) {
			return;
		}
		try {
			aFound = document.querySelectorAll("[" + sAttrName + "=\"" + lf_escapeAttr(sValue) + "\"]");
			for (var i = 0, l = aFound.length; i < l; i++) {
				lf_addDom(aFound[i]);
			}
		} catch (e) {}
	}
	if (!oUi) {
		return aDoms;
	}

	sId = typeof oUi.getId === "function" ? oUi.getId() : "";
	if (sId) {
		lf_addDom(document.getElementById(sId));
		lf_collectByAttr("data-sap-ui", sId);
		lf_collectByAttr("data-sap-ui-render", sId);
	}
	if (typeof oUi.getDomRef === "function") {
		lf_addDom(oUi.getDomRef());
	}
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



function getPreviewSelectionTargetDom(oUi) {
	var aDoms = collectPreviewSelectionDomCandidates(oUi);
	var oFallbackDom = null;
	var oBestDom = null;
	var iBestScore = -1;
	for (var i = 0, l = aDoms.length; i < l; i++) {
		var oDom = aDoms[i];
		var oRect = getPreviewSelectionDomRect(oDom);
		var iScore;
		if (!oDom || !oRect) {
			continue;
		}
		if (isPreviewSelectionUsableRect(oRect)) {
			iScore = getPreviewSelectionDomScore(oUi, oDom, oRect, i);

			if (iScore > iBestScore) {
				iBestScore = iScore;
				oBestDom = oDom;
			}
		}
		if (!oFallbackDom) {
			oFallbackDom = oDom;
		}
	}

	if (oBestDom) {
		return oBestDom;
	}
	return oFallbackDom;
}


function getPreviewSelectionScrollRoot(oDom) {
	var oCurrent = oDom ? oDom.parentElement : null;
	var oStyle;
	var sOverflow;
	while (oCurrent && oCurrent !== document.body && oCurrent !== document.documentElement) {
		oStyle = window.getComputedStyle ? window.getComputedStyle(oCurrent) : null;
		sOverflow = oStyle ? [
			oStyle.overflow,
			oStyle.overflowX,
			oStyle.overflowY
		].join(" ") : "";
		if (/(auto|scroll|overlay)/.test(sOverflow) && (
			oCurrent.scrollHeight > oCurrent.clientHeight ||
			oCurrent.scrollWidth > oCurrent.clientWidth
		)) {
			return oCurrent;
		}

		oCurrent = oCurrent.parentElement;
	}
	return null;
}


function getPreviewSelectionRootRect(oRoot) {
	if (oRoot && typeof oRoot.getBoundingClientRect === "function") {
		return oRoot.getBoundingClientRect();
	}
	return {
		top: 0,
		left: 0,
		right: window.innerWidth || document.documentElement.clientWidth || 0,
		bottom: window.innerHeight || document.documentElement.clientHeight || 0
	};
}


function isPreviewSelectionRectIntersecting(oRect, oRootRect) {
	if (!oRect || !oRootRect) {
		return false;
	}
	return oRect.right > oRootRect.left &&
		oRect.left < oRootRect.right &&
		oRect.bottom > oRootRect.top &&
		oRect.top < oRootRect.bottom;
}


function isPreviewSelectionTargetVisible(oTargetDom, oRect) {
	var oScrollRoot = getPreviewSelectionScrollRoot(oTargetDom);
	if (!isPreviewSelectionRectIntersecting(oRect, getPreviewSelectionRootRect(null))) {
		return false;
	}
	if (oScrollRoot && !isPreviewSelectionRectIntersecting(oRect, getPreviewSelectionRootRect(oScrollRoot))) {
		return false;
	}
	return true;
}


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
	var sText;
	if (!oTargetDom || !oRect) {
		return false;
	}
	if (oRect.height > 28 || oRect.width > 260) {
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
	if (!sText && typeof oTargetDom.textContent === "string") {
		sText = oTargetDom.textContent.trim();
	}
	return sText !== "";
}


function disconnectPreviewSelectionObservers() {
	if (oWS.sMark.oSelectionResizeObserver) {
		try {
			oWS.sMark.oSelectionResizeObserver.disconnect();
		} catch (e) {}
	}
	if (oWS.sMark.oSelectionIntersectionObserver) {
		try {
			oWS.sMark.oSelectionIntersectionObserver.disconnect();
		} catch (e) {}
	}

	/**
	 * @since   2026-07-09 14:11:08
	 * @version vNAN-NAN
	 * @author  pes
	 * @description
	 * 선택 대상이 변경되거나 선택 표시가 제거될 때 스타일 클래스 변경 감시용 MutationObserver도 함께 정리한다.
	 */
	if (oWS.sMark.oSelectionMutationObserver) {
		try {
			oWS.sMark.oSelectionMutationObserver.disconnect();
		} catch (e) {}
	}
	oWS.sMark.oSelectionResizeObserver = null;
	oWS.sMark.oSelectionMutationObserver = null;
	oWS.sMark.oSelectionIntersectionObserver = null;
	oWS.sMark.oSelectionObservedDom = null;
	oWS.sMark.bSelectionTargetIntersecting = true;
}

/**
 * Registers ResizeObserver, MutationObserver, and IntersectionObserver for the selected DOM target.
 */

/**
 * @since   2026-07-09 14:11:08
 * @version vNAN-NAN
 * @author  pes
 * @description
 * 선택 DOM과 UI root DOM을 함께 확인할 수 있도록 선택 UI 객체를 전달받아 스타일 변경 감시 범위를 확장한다.
 */
function observePreviewSelectionTarget(oTargetDom, oUi) {
	var oScrollRoot;
	var oUiDom;
	if (!oTargetDom || oWS.sMark.oSelectionObservedDom === oTargetDom) {
		return;
	}

	disconnectPreviewSelectionObservers();
	oWS.sMark.oSelectionObservedDom = oTargetDom;
	oWS.sMark.bSelectionTargetIntersecting = true;
	oScrollRoot = getPreviewSelectionScrollRoot(oTargetDom);
	oUiDom = typeof oUi?.getDomRef === "function" ? oUi.getDomRef() : null;
	if (typeof window.ResizeObserver === "function") {
		
		oWS.sMark.oSelectionResizeObserver = new window.ResizeObserver(function() {
			requestPreviewSelectionLayerUpdate();
		});
		try {
			oWS.sMark.oSelectionResizeObserver.observe(oTargetDom);
			if (oScrollRoot) {
				oWS.sMark.oSelectionResizeObserver.observe(oScrollRoot);
			} else if (document.documentElement) {
				oWS.sMark.oSelectionResizeObserver.observe(document.documentElement);
			}
		} catch (e) {}
	}

	/**
	 * @since   2026-07-09 14:11:08
	 * @version vNAN-NAN
	 * @author  pes
	 * @description
	 * addStyleClass 등으로 class/style 속성이 변경되어 margin 위치가 달라지는 경우 선택 레이어를 다시 계산한다.
	 */
	if (typeof window.MutationObserver === "function") {
		
		oWS.sMark.oSelectionMutationObserver = new window.MutationObserver(function() {
			requestPreviewSelectionLayerUpdate();
		});
		try {
			oWS.sMark.oSelectionMutationObserver.observe(oTargetDom, {
				attributes: true,
				attributeFilter: ["class", "style"]
			});
			if (oUiDom && oUiDom !== oTargetDom && oUiDom.nodeType === 1) {
				oWS.sMark.oSelectionMutationObserver.observe(oUiDom, {
					attributes: true,
					attributeFilter: ["class", "style"]
				});
			}
		} catch (e) {}
	}
	if (typeof window.IntersectionObserver === "function") {
		
		oWS.sMark.oSelectionIntersectionObserver = new window.IntersectionObserver(function(aEntries) {
			var oEntry = aEntries && aEntries.length > 0 ? aEntries[aEntries.length - 1] : null;
			if (!oEntry) {
				return;
			}
			if (oEntry.isIntersecting === true && oEntry.intersectionRatio > 0) {
				oWS.sMark.bSelectionTargetIntersecting = true;
				requestPreviewSelectionLayerUpdate();
				return;
			}
			oWS.sMark.bSelectionTargetIntersecting = false;
			hidePreviewSelectionLayer();
		}, {
			root: oScrollRoot || null,
			threshold: 0
		});
		try {
			oWS.sMark.oSelectionIntersectionObserver.observe(oTargetDom);
		} catch (e) {}
	}
}


function hidePreviewSelectionLayer() {
	var oLayer = oWS.sMark.oSelectionLayer;
	if (!oLayer) {
		return;
	}
	oLayer.removeAttribute("data-u4a-layer-visible");
	oLayer.removeAttribute("data-u4a-layer-compact");
	oLayer.style.left = "0px";
	oLayer.style.top = "0px";
	oLayer.style.width = "0px";
	oLayer.style.height = "0px";
}

/**
 * Creates or returns the body-level overlay DOM used for context-menu highlighting.
 */
function getPreviewContextLayer() {
	var oLayer = oWS.sMark.oContextLayer;
	if (oLayer && oLayer.parentNode) {
		return oLayer;
	}
	oLayer = document.createElement("div");
	oLayer.id = "u4a_ws_context_layer";
	oLayer.className = "u4a_ws_context_layer";
	oLayer.setAttribute("aria-hidden", "true");
	oLayer.setAttribute("data-u4a-context-layer", "X");
	document.body.appendChild(oLayer);
	oWS.sMark.oContextLayer = oLayer;
	return oLayer;
}


function syncPreviewContextLayerClass(oLayer) {
	if (!oLayer || !oLayer.classList) {
		return;
	}
	oLayer.classList.add("u4a_ws_context_layer");
}


function hidePreviewContextLayer() {
	var oLayer = oWS.sMark.oContextLayer;
	if (!oLayer) {
		return;
	}
	oLayer.removeAttribute("data-u4a-layer-visible");
	oLayer.style.left = "0px";
	oLayer.style.top = "0px";
	oLayer.style.width = "0px";
	oLayer.style.height = "0px";
}

/**
 * Positions and styles the context-menu overlay over the UI that opened the menu.
 */
function updatePreviewContextLayer() {
	var oUi = oWS.sMark.oContextUi;
	var oTargetDom;
	var oRect;
	var oLayer;
	var oStyle;
	var iScrollTop;
	var iScrollLeft;
	oWS.sMark.iContextLayerRaf = 0;
	if (!oUi) {
		hidePreviewContextLayer();
		return;
	}

	oTargetDom = getPreviewSelectionTargetDom(oUi);
	if (!oTargetDom || typeof oTargetDom.getBoundingClientRect !== "function") {
		hidePreviewContextLayer();
		return;
	}
	oRect = oTargetDom.getBoundingClientRect();
	if (oRect.width <= 0 || oRect.height <= 0 || !isPreviewSelectionTargetVisible(oTargetDom, oRect)) {
		hidePreviewContextLayer();
		return;
	}
	iScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
	iScrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
	oLayer = getPreviewContextLayer();
	oStyle = window.getComputedStyle ? window.getComputedStyle(oTargetDom) : null;

	syncPreviewContextLayerClass(oLayer);
	oLayer.style.left = (oRect.left + iScrollLeft) + "px";
	oLayer.style.top = (oRect.top + iScrollTop) + "px";
	oLayer.style.width = oRect.width + "px";
	oLayer.style.height = oRect.height + "px";
	if (oStyle) {
		oLayer.style.setProperty("--u4a-selection-layer-radius", oStyle.borderRadius || "var(--u4a-preview-selection-radius)");
	}
	oLayer.setAttribute("data-u4a-layer-visible", "X");
}


function requestPreviewContextLayerUpdate() {
	if (oWS.sMark.iContextLayerRaf) {
		return;
	}
	if (typeof window.requestAnimationFrame === "function") {
		oWS.sMark.iContextLayerRaf = window.requestAnimationFrame(updatePreviewContextLayer);
		return;
	}
	oWS.sMark.iContextLayerRaf = window.setTimeout(updatePreviewContextLayer, 0);
}


function requestPreviewMarkLayerUpdate() {
	requestPreviewSelectionLayerUpdate();
	requestPreviewContextLayerUpdate();
}

/**
 * Positions and styles the selection overlay over the selected UI DOM.
 */
function updatePreviewSelectionLayer() {
	var oUi = oWS.sMark.oSelectedUi;
	var oTargetDom;
	var oRect;
	var oLayer;
	var oStyle;
	var iScrollTop;
	var iScrollLeft;
	var bCompactTextTarget;
	var iLayerOffset;
	oWS.sMark.iSelectionLayerRaf = 0;
	if (!oUi) {
		hidePreviewSelectionLayer();
		return;
	}

	oTargetDom = getPreviewSelectionTargetDom(oUi);
	if (!oTargetDom || typeof oTargetDom.getBoundingClientRect !== "function") {
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		return;
	}
	oRect = oTargetDom.getBoundingClientRect();
	if (oRect.width <= 0 || oRect.height <= 0) {
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		return;
	}

	/**
	 * @since   2026-07-09 14:11:08
	 * @version vNAN-NAN
	 * @author  pes
	 * @description
	 * 선택 대상 DOM뿐 아니라 UI root DOM의 스타일 클래스 변경까지 감시할 수 있도록 선택 UI 객체를 함께 전달한다.
	 */
	observePreviewSelectionTarget(oTargetDom, oUi);
	if (
		oWS.sMark.bSelectionTargetIntersecting === false &&
		!isPreviewSelectionTargetVisible(oTargetDom, oRect)
	) {
		hidePreviewSelectionLayer();
		return;
	}
	if (!isPreviewSelectionTargetVisible(oTargetDom, oRect)) {
		oWS.sMark.bSelectionTargetIntersecting = false;
		hidePreviewSelectionLayer();
		return;
	}
	oWS.sMark.bSelectionTargetIntersecting = true;
	iScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
	iScrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
	oLayer = getPreviewSelectionLayer();
	syncPreviewSelectionLayerClass(oLayer);
	oStyle = window.getComputedStyle ? window.getComputedStyle(oTargetDom) : null;
	bCompactTextTarget = isPreviewSelectionCompactTextTarget(oTargetDom, oRect, oUi);
	iLayerOffset = bCompactTextTarget ? 3 : 0;
	oLayer.style.left = (oRect.left + iScrollLeft - iLayerOffset) + "px";
	oLayer.style.top = (oRect.top + iScrollTop - iLayerOffset) + "px";
	oLayer.style.width = (oRect.width + (iLayerOffset * 2)) + "px";
	oLayer.style.height = (oRect.height + (iLayerOffset * 2)) + "px";
	oLayer.style.setProperty(
		"--u4a-selection-layer-inset",
		Math.min(oRect.width, oRect.height) <= 12 ? "0px" : "var(--u4a-preview-selection-inset)"
	);
	if (oStyle) {
		oLayer.style.setProperty("--u4a-selection-layer-radius", oStyle.borderRadius || "var(--u4a-preview-selection-radius)");
	}
	if (bCompactTextTarget) {
		oLayer.setAttribute("data-u4a-layer-compact", "X");
	} else {
		oLayer.removeAttribute("data-u4a-layer-compact");
	}
	oLayer.setAttribute("data-u4a-layer-visible", "X");
}


function requestPreviewSelectionLayerUpdate() {
	if (oWS.sMark.iSelectionLayerRaf) {
		return;
	}
	if (typeof window.requestAnimationFrame === "function") {
		oWS.sMark.iSelectionLayerRaf = window.requestAnimationFrame(updatePreviewSelectionLayer);
		return;
	}
	oWS.sMark.iSelectionLayerRaf = window.setTimeout(updatePreviewSelectionLayer, 0);
}

/**
 * Registers global preview events that keep overlay layers aligned with UI changes.
 */
function ensurePreviewSelectionLayerEvents() {
	var oCore;
	if (oWS.sMark.bSelectionLayerEventBound === true) {
		return;
	}
	window.addEventListener("scroll", requestPreviewMarkLayerUpdate, true);
	if (document && typeof document.addEventListener === "function") {
		document.addEventListener("scroll", requestPreviewMarkLayerUpdate, true);
	}
	try {
		if (sap && sap.ui && typeof sap.ui.getCore === "function") {
			oCore = sap.ui.getCore();
			if (oCore && typeof oCore.attachUIUpdated === "function") {
				oCore.attachUIUpdated(requestPreviewMarkLayerUpdate);
			}
		}
	} catch (e) {}
	oWS.sMark.bSelectionLayerEventBound = true;
}
//#endregion

//#endregion
//#region Preview selected UI mark
// Applies the selected marker to the current UI. Focus is only used as a
// keyboard/navigation aid; the visible state is drawn by the selection layer.

oWS.sMark.fn_mark = function(oMarkUi) {
	if (!oMarkUi) {
		return Promise.resolve();
	}
	if (oWS.sMark.oSelectedUi && oWS.sMark.oSelectedUi !== oMarkUi) {
		clearPreviewMarkFromUi(oWS.sMark.oSelectedUi);
	}
	clearPreviewMarkFromUi(oMarkUi);
	cleanupPreviewMarkDomFallback();
	oWS.sMark.oSelectedUi = oMarkUi;
	addPreviewMarkCustomData(oMarkUi, oWS.sMark.selectedAttr, oWS.sMark.selectedValue);

	/**
	 * @since   2026-07-01 01:18:45
	 * @version vNAN-NAN
	 * @author  PES
	 * @description
	 * 미리보기 UI 선택 효과 적용 시 focus를 호출하여 선택한 UI의 DOM 위치로 스크롤 이동되도록 처리한다.
	 */
	if (typeof oMarkUi.focus === "function") {
		try {
			oMarkUi.focus();
		} catch (e) {}
	}

	ensurePreviewSelectionLayerEvents();
	updatePreviewSelectionLayer();
	return Promise.resolve();
};
//#endregion
//#region Preview selected UI mark cleanup
// Removes the current selected marker. The DOM fallback handles controls
// that were rerendered or destroyed before the normal CustomData cleanup.

oWS.sMark.fn_removeMark = function() {
	if (oWS.sMark.oSelectedUi) {
		clearPreviewMarkFromUi(oWS.sMark.oSelectedUi);
		oWS.sMark.oSelectedUi = null;
		disconnectPreviewSelectionObservers();
		hidePreviewSelectionLayer();
		return Promise.resolve();
	}

	cleanupPreviewMarkDomFallback();
	disconnectPreviewSelectionObservers();
	hidePreviewSelectionLayer();
	return Promise.resolve();
};
//#endregion

/**
 * Adds or resets external CSS link elements inside the preview iframe.
 */
function setCSSLink(vLink, bReset) {
	
	function lf_createLink(sLink) {
		var oChild = document.createElement("link");
		oChild.setAttribute("rel", "stylesheet");
		oChild.setAttribute("type", "text/css");
		oChild.setAttribute("href", sLink);
		try {
			oLink.appendChild(oChild);
		} catch (e) {
			
			setTimeout(() => {
				parent.console.error("[U4A preview]=>" + e);
			}, 0);
		}
		return;
	}
	var oLink = document.getElementById("U4AStyleLink");
	if (bReset === true) {
		while (oLink.firstChild) {
			oLink.removeChild(oLink.firstChild);
		}
	}
	if (typeof vLink === "string") {
		lf_createLink(vLink);
		return;
	}
	if (jQuery.isArray(vLink) === true) {
		for (var i = 0, l = vLink.length; i < l; i++) {
			lf_createLink(vLink[i]);
		}
	}
}

/**
 * Writes inline CSS source into the preview document.
 */
function setCSSSource(sSource) {
	var oStyle = document.getElementById("U4AStyle");
	oStyle.innerHTML = sSource;
}

/**
 * Applies application CSS links and inline CSS source to the preview document.
 */
function setPreviewCSS() {
	var lt_css = [];
	if (parent.oAPP.DATA.APPDATA.T_CSLK.length !== 0) {
		var _aCSLK = parent.oAPP.DATA.APPDATA.T_CSLK.filter(item => item?.INACTIVE !== "X");
		for (var i = 0, l = _aCSLK.length; i < l; i++) {
			lt_css.push(_aCSLK[i].URL);
		}
	}
	setCSSLink(lt_css, true);
	var ls_css = parent.oAPP.DATA.APPDATA.T_EDIT.find(a => a.OBJTY === "CS");
	if (!ls_css || ls_css.DATA === "") {
		setCSSSource("");
		return;
	}
	setCSSSource(ls_css.DATA);
}


function setPrevPropVal(OBJID, UIATT, UIATV) {
	var l_propnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[OBJID], "1", UIATT, "_sMutator");
	parent.oAPP.attr.prev[OBJID][l_propnm](UIATV);
}


function setUiLoadLibraries(it_lib) {
	if (typeof it_lib === "undefined") {
		return;
	}
	if (it_lib.length === 0) {
		return;
	}
	for (var i = 0, l = it_lib.length; i < l; i++) {
		sap.ui.getCore().loadLibrary(it_lib[i]);
	}
}


function lf_excepRequire(UIOBK) {
	switch (UIOBK) {
		case "UO00455":
			
			sap.m.TileContainer.prototype._updateTileDimensionInfoAndPageSize = function(aVisibleTiles) {
				var l_dom = this.$("pager");
				if (!l_dom || !l_dom[0]) {
					return;
				}
				aVisibleTiles = aVisibleTiles || this._getVisibleTiles();
				this._oTileDimensionCalculator.calc(aVisibleTiles);
				this._calculatePageSize(aVisibleTiles);
			};
			
			sap.m.TileContainer.prototype._getContentDimension = function() {
				if (!this.getDomRef()) {
					if (this.__beforeScrl) {
						return this.__beforeScrl;
					}
					return;
				}
				var oScroll = this.$("scrl");
				this.__beforeScrl = {
					width: oScroll.width(),
					height: oScroll.height() - 20,
					outerheight: oScroll.outerHeight() - 20,
					outerwidth: oScroll.outerWidth(),
				};
				return {
					width: oScroll.width(),
					height: oScroll.height() - 20,
					outerheight: oScroll.outerHeight() - 20,
					outerwidth: oScroll.outerWidth()
				};
			};
			
			sap.m.TileContainer.prototype._calculateDimension = function() {
				var oDomRef = this.$();
				if (!oDomRef) {
					if (this.__before) {
						return {
							width: 0,
							height: 0,
							outerheight: 0,
							outerwidth: 0
						};
					}
					return;
				}
				return {
					width: oDomRef.width(),
					height: oDomRef.height(),
					outerheight: oDomRef.outerHeight(),
					outerwidth: oDomRef.outerWidth()
				};
			};
			
			sap.m.TileContainer.prototype._resize = function() {
				if (this._oDragSession) {
					return;
				}
				var l_dom = this.$("pager");
				if (!l_dom || !l_dom[0]) {
					return;
				}
				var l_dom = this.$("cnt");
				if (!l_dom || !l_dom[0]) {
					return;
				}
				
				setTimeout(jQuery.proxy(function() {
					var l_dom = this.$("pager");
					if (!l_dom || !l_dom[0]) {
						return;
					}
					var l_dom = this.$("cnt");
					if (!l_dom || !l_dom[0]) {
						return;
					}
					var aVisibleTiles = this._getVisibleTiles(),
						iTilesCount = aVisibleTiles.length,
						iCurrentPageStartTileIndex = this._iCurrentTileStartIndex,
						oOldDim = this._oDim,
						iNewPage, iNewPageTileStartIndex, iNewPageTileEndIndex;
					this._oPagesInfo.reset();
					this._oDim = this._calculateDimension();
					this._updateTileDimensionInfoAndPageSize(aVisibleTiles);
					if (oOldDim.width !== this._oDim.width || oOldDim.height !== this._oDim.height) {
						for (var i = 0; i < iTilesCount; i++) {
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
			
			sap.m.TileContainer.prototype._onmove = function(oEvent) {
				if (this?.isDestroyed && this.isDestroyed() === true) {
					return;
				}
				if (document.selection && document.selection.clear) {
					document.selection.clear();
				}
				if (oEvent.isMarked("delayedMouseEvent")) {
					return;
				}
				if (oEvent.targetTouches && oEvent.targetTouches.length > 1) {
					return;
				}
				if (typeof this._oTouchSession === "undefined") {
					return;
				}
				if (!oEvent.targetTouches) {
					oEvent.targetTouches = [{
						pageX: oEvent.pageX,
						pageY: oEvent.pageY
					}];
				}
				var oTouchSession = this._oTouchSession;
				oTouchSession.fDiffX = oTouchSession.fStartX - oEvent.targetTouches[0].pageX;
				oTouchSession.fDiffY = oTouchSession.fStartY - oEvent.targetTouches[0].pageY;
				if (this._oDragSession) {
					if (Math.abs(oTouchSession.fDiffX) > 5) {
						if (!this._oDragSession.bStarted) {
							this._oDragSession.bStarted = true;
							this._onDragStart(oEvent);
						} else {
							this._onDrag(oEvent);
						}
						this._bAvoidChildTapEvent = true;
					}
				} else if (oTouchSession) {
					var contentWidth = this._getContentDimension().outerwidth;
					var iNewLeft = -this._iScrollLeft - oTouchSession.fDiffX;
					if (iNewLeft > this._iScrollGap) {
						return;
					} else if (iNewLeft < -(((this._oPagesInfo.getCount() - 1) * contentWidth) + this._iScrollGap)) {
						return;
					}
					if (this._bRtl) {
						iNewLeft = iNewLeft - contentWidth;
					}
					var aVisibleTiles = this._getVisibleTiles();
					var iDirection = oTouchSession.fDiffX > 0 ? 1 : -1;
					var iGoToPageStartTileIndex = this._iCurrentTileStartIndex + iDirection * this._iMaxTiles;
					var iGoToPageEndTileIndex = iGoToPageStartTileIndex + this._iMaxTiles - 1;
					this._renderTiles(aVisibleTiles, iGoToPageStartTileIndex, iGoToPageEndTileIndex);
					var l_dom = this.$("cnt");
					if (!l_dom || !l_dom[0]) {
						return;
					}
					this._applyTranslate(this.$("cnt"), iNewLeft, 0, false);
				}
			};
		case "UO02014":
		case "UO02082":
			sap.ui.requireSync("sap/gantt/simple/ListLegendItem");
			break;
		case "UO02220":
			sap.ui.requireSync("sap/ui/vbm/AnalyticMap");
			sap.ui.vbm.AnalyticMap.DefaultABAPGeoJSONURL = sap.ui.resource("sap.ui.vbm", sap.ui.vbm.AnalyticMap.DefaultABAPGeoJSONURL);
			break;
		case "UO01786":
			richTextEditorException();
			break;
		case "UO01866":
			
			sap.suite.ui.commons.networkgraph.Graph.prototype._preprocessData = function() {
				this._bIsLayedOut = false;
				this._bImageLoaded = false;
				this.fireBeforeLayouting();
				var that = this;
				
				var l_intv = setInterval(function() {
					var l_grp = that.$("divgroups");
					if (l_grp && l_grp[0]) {
						clearInterval(l_intv);
						that._applyLayout().then(that._render.bind(that));
					}
				}, 100);
			};
			break;
		case "UO01139":
		case "UO01142":
		case "UO02076":
			sap.ui.requireSync("sap/ui/table/utils/TableUtils");
			
			sap.ui.table.utils.TableUtils.isVariableRowHeightEnabled = function(oTable) {
				return false;
			};
			break;
		case "UO00338":
			
			sap.m.Menu.prototype.removeAggregation = function(sAggregationName, vObject, bSuppressInvalidate) {
				var oItem = sap.ui.core.Control.prototype.removeAggregation.apply(this, arguments);
				if (sAggregationName === "items" && oItem) {
					this._removeVisualItem(oItem);
				}
				return oItem;
			};
			break;
		default:
			break;
	}
}


function excepSapui6Library(LIBNM) {
	if (LIBNM.substr(0, 6) !== "sapui6") {
		return;
	}
	sap.ui.getCore().loadLibrary("sap.ui.commons");
}


function setFixedProp(UIOBK, it_ua018, it_ua032) {
	var lt_ua018 = it_ua018;
	if (!lt_ua018) {
		lt_ua018 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA018" && a.FLD05 === UIOBK);
	}
	if (lt_ua018.length === 0) {
		return "";
	}
	for (var i = 0, l = lt_ua018.length, l_prop = "", l_sep = "", lv_doqu = ""; i < l; i++) {
		var ls_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIOBK === lt_ua018[i].FLD05 && a.UIATT === lt_ua018[i].FLD02);
		lv_doqu = "";
		lv_doqu = parent.oAPP.fn.setPropDoqu(ls_0023.UIADT);
		if (lv_doqu === "" && lt_ua018[i].FLD04 === "") {
			continue;
		}
		var l_fnst = "";
		var l_fned = "";
		var ls_ua032 = it_ua032.find(a => a.FLD01 === lt_ua018[i].FLD05 && a.FLD03 === lt_ua018[i].FLD02 && a.FLD06 !== "X");
		if (typeof ls_ua032 !== "undefined") {
			l_fnst = ls_ua032.FLD07 + "(";
			l_fned = ")";
		}
		if (lt_ua018[i].FLD06 === "X") {
			l_prop = l_prop + l_sep + lt_ua018[i].FLD02 + ":" + l_fnst + lv_doqu + jQuery.sap.uid() + lv_doqu + l_fned;
		} else {
			l_prop = l_prop + l_sep + lt_ua018[i].FLD02 + ":" + l_fnst + lv_doqu + lt_ua018[i].FLD04 + lv_doqu + l_fned;
		}
		l_sep = ",";
	}
	return l_prop;
}


function setFixedProp2(UIOBK, T_0015, T_UA030) {
	var sep = "",
		ls_0015, l_prop = "";
	for (var i = 0, l = T_UA030.length; i < l; i++) {
		ls_0015 = T_0015.find(a => a.UIASN === T_UA030[i].FLD01);
		if (ls_0015) {
			continue;
		}
		var ls_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIASN === T_UA030[i].FLD01 && a.UIOBK === T_UA030[i].FLD02);
		if (!ls_0023) {
			continue;
		}
		var l_doqu = parent.oAPP.fn.setPropDoqu(ls_0023.UIADT);
		var l_uiatv = T_UA030[i].FLD05;
		l_uiatv = l_uiatv.replace(/\\/g, '\\\\');
		l_uiatv = l_uiatv.replace(/\"/g, '\\\"');
		l_prop += sep + ls_0023.UIATT + ":" + l_doqu + l_uiatv + l_doqu;
		sep = ",";
	}
	return l_prop;
}

/**
 * Resolves a browser event target DOM node back to the nearest UI5 control.
 */
function getEventTargetUI(oEvent) {
	var l_ui, l_node = oEvent;
	var _OBJID = undefined;
	while (!l_ui) {
		l_ui = sap.ui.getCore().byId(l_node.id);
		_OBJID = findUiObjectID(l_ui);
		if (typeof _OBJID !== "undefined") {
			break;
		}
		l_ui = undefined;
		l_node = l_node.parentNode;
		_OBJID = undefined;
		if (!l_node) {
			break;
		}
	}
	return l_ui;
}


function setUIProp(UIOBK, UILIB, T_0015, T_UA018, T_UA032, T_UA030) {
	var lt_ua018t = T_UA018.filter(a => a.FLD05 === UIOBK);
	var l_sep = "",
		l_prop = "",
		lv_doqu = "",
		l_setProp = "";
	if (lt_ua018t.length !== 0) {
		l_prop = setFixedProp(UIOBK, lt_ua018t, T_UA032);
	}
	l_sep = l_prop !== "" ? ',' : '';
	var lt_ua030t = T_UA030.filter(a => a.FLD02 === UIOBK);
	if (lt_ua030t.length !== 0) {
		var l_prop2 = setFixedProp2(UIOBK, T_0015, lt_ua030t);
		if (typeof l_prop2 !== "undefined" && l_prop2 !== "") {
			l_prop = l_prop + l_sep + l_prop2;
			l_sep = ",";
		}
	}
	if (UIOBK === "UO99986") {
		l_prop += l_sep + "placeholder:\"ExcelUploader\"";
		l_sep = ",";
	}
	if (UIOBK === "UO99992") {
		l_prop += l_sep + "placeholder:\"SelectOption\"";
		l_sep = ",";
	}
	if (T_0015.length === 0) {
		return [l_prop, l_setProp];
	}
	var l_meta;
	try {
		var _oUi = getUIClassInstance(UILIB);
		l_meta = _oUi.getMetadata();
	} catch (e) {}
	for (var i = 0, l = T_0015.length; i < l; i++) {
		if (T_0015[i].UIASN === "DRAGABLE") {
			continue;
		}
		if (T_0015[i].UIASN === "DROPABLE") {
			continue;
		}
		if (parent.oAPP.fn.prevSkipProp(T_0015[i])) {
			continue;
		}
		if (T_0015[i].UIATY !== "1" || T_0015[i].ISBND === "X") {
			continue;
		}
		if (T_0015[i].UIASN === "STYLECLASS" && T_0015[i].UIATV !== "" && T_0015[i].UIATK.substr(0, 3) === "EXT") {
			l_setProp += "parent.oAPP.attr.prev." + T_0015[i].OBJID + ".addStyleClass(\"" + T_0015[i].UIATV + "\");";
			continue;
		}
		var l_uiatv = T_0015[i].UIATV;
		if (lt_ua018t.length !== 0) {
			if (lt_ua018t.findIndex(a => a.FLD05 === UIOBK && a.FLD02 === T_0015[i].UIATT) !== -1) {
				continue;
			}
		}
		if (typeof l_meta !== "undefined") {
			if (T_0015[i].UIATK.indexOf("_1") === -1 && typeof l_meta.getProperty(T_0015[i].UIATT) === "undefined") {
				continue;
			}
		}
		l_uiatv = parent.oAPP.fn.prevParseOTRValue(T_0015[i]) || l_uiatv;
		lv_doqu = parent.oAPP.fn.setPropDoqu(T_0015[i].UIADT);
		if (T_0015[i].UIADT !== "string" && l_uiatv === "") {
			lv_doqu = "";
		}
		if (l_uiatv === "" && lv_doqu === "") {
			continue;
		}
		l_uiatv = l_uiatv.replace(/\\/g, '\\\\');
		l_uiatv = l_uiatv.replace(/\"/g, '\\\"');
		l_uiatv = parent.oAPP.fn.setHTMLContentProp(T_0015[i]) || l_uiatv;
		l_uiatv = l_uiatv.replace(/\r?\n|\r/g, "\\n");
		var l_fnst = "",
			l_fned = "";
		if (T_UA032) {
			var ls_ua032 = T_UA032.find(a => a.FLD01 === UIOBK && a.FLD03 === T_0015[i].UIATT);
			if (ls_ua032 && ls_ua032.FLD07 !== "") {
				l_fnst = ls_ua032.FLD07 + "(";
				l_fned = ")";
			}
		}
		if (l_uiatv.indexOf("{") !== -1) {
			l_setProp = l_setProp + "setPrevPropVal('" + T_0015[i].OBJID + "','" + T_0015[i].UIATT + "'," + l_fnst + "\"" + l_uiatv + "\"" + l_fned + ");";
			continue;
		}
		l_prop = l_prop + l_sep + T_0015[i].UIATT + ":" + l_fnst + lv_doqu + l_uiatv + lv_doqu + l_fned;
		l_sep = ",";
	}
	return [l_prop, l_setProp];
}


function setChildUiException(UIOBK, OBJID, it_child, it_ua050, bIgnore) {
	var lt_ua050 = [];
	if (typeof it_ua050 === "undefined") {
		lt_ua050 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA050" && a.FLD01 === UIOBK && a.FLD08 !== "X");
	} else {
		lt_ua050 = it_ua050.filter(a => a.FLD01 === UIOBK && a.FLD08 !== "X");
	}
	if (lt_ua050.length === 0) {
		return;
	}
	if (typeof it_child === "undefined" && bIgnore !== true) {
		var ls_tree = parent.oAPP.fn.getTreeData(OBJID);
	}
	var _script = "";
	for (var i = 0, l = lt_ua050.length, l_indx = 0; i < l; i++) {
		if (denyChildAggregation(UIOBK, lt_ua050[i].FLD03) === true) {
			continue;
		}
		let _aChild = parent.oAPP.attr.prev[OBJID].getAggregation(lt_ua050[i].FLD03);
		if (Array.isArray(_aChild) === true && _aChild.length > 0) {
			for (var j = 0, jl = _aChild.length; j < jl; j++) {
				let _oChild = _aChild[j];
				if (_oChild.data("UA050") === true) {
					parent.oAPP.attr.prev[OBJID].removeAggregation(lt_ua050[i].FLD03, _oChild);
				}
			}
		}
		if (bIgnore === true) {
			_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
			continue;
		}
		if (typeof it_child !== "undefined") {
			l_indx = it_child.findIndex(a => a.UIATT === lt_ua050[i].FLD03);
			if (l_indx !== -1) {
				continue;
			}
			_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
			continue;
		}
		l_indx = ls_tree.zTREE.findIndex(a => a.POBID === OBJID && a.UIATT === lt_ua050[i].FLD03);
		if (l_indx !== -1) {
			continue;
		}
		if (lt_ua050[i].FLD01 === "UO02273") {
			sap.ui.requireSync("sap/ui/vbm/AnalyticMap");
		}
		_script += "parent.oAPP.attr.prev[OBJID]." + lt_ua050[i].FLD05 + lt_ua050[i].FLD06 + lt_ua050[i].FLD07;
	}
	eval(_script);
}


function setRichTextEditorException(UIOBK, OBJID) {
	if (UIOBK !== "UO01786") {
		return;
	}
	parent.oAPP.attr.prev[OBJID].addButtonGroup("table");
}


function skipUiTableRow(UIOBK) {
	if (UIOBK === "UO01131") {
		return true;
	}
}


function skipUiMTreeItem(PUIOK, UIATT) {
	if (PUIOK === "UO00467" && UIATT === "items") {
		return true;
	}
}


function denyChildAggregation(PUIOK, UIATT) {
	if (parent.oAPP.attr.S_CODE.UW05.findIndex(a => a.FLD01 === PUIOK && a.FLD03 === UIATT && a.FLD04 !== "X") !== -1) {
		return true;
	}
}


function skipSplitterLayoutData(POBID, UIATT) {
	if (UIATT !== "layoutData") {
		return;
	}
	var ls_parent = parent.oAPP.fn.getTreeData(POBID);
	if (ls_parent.PUIOK !== "UO00998") {
		return;
	}
	return true;
}

/**
 * Adds one UI object to the preview model and rendered UI tree.
 */
function addUIObjPreView(OBJID, UIOBK, UILIB, UIFND, POBID, PUIOK, UIATT, T_0015, T_UA018, T_UA032, T_UA030, T_UA026, T_UA050) {
	var ls_0022 = parent.oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === UIOBK);
	if (ls_0022 && ls_0022.TGLIB !== "" && ls_0022.UIFND.indexOf("U4A.") === -1 && ls_0022.UIFND.indexOf("SAPUI6.") === -1) {
		try {
			sap.ui.getCore().loadLibrary(ls_0022.TGLIB);
		} catch (e) {}
	}
	var lt_0015 = [];
	if (typeof T_0015 !== "undefined") {
		lt_0015 = T_0015;
	}
	var lt_ua050 = T_UA050;
	if (typeof lt_ua050 === "undefined") {
		lt_ua050 = parent.oAPP.DATA.LIB.T_9011.filter(a => a.CATCD === "UA050" && a.FLD08 !== "X");
	}
	var _sTree = parent.oAPP.fn.crtStru0014();
	_sTree.UIOBK = UIOBK;
	_sTree.OBJID = OBJID;
	_sTree.POBID = POBID;
	_sTree.ISECP = ls_0022.ISECP;
	createUIInstance(_sTree, lt_0015);
	if (collectPopup(UILIB, OBJID) === true) {
		return;
	}
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		return;
	}
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		return;
	}
	setRichTextEditorException(UIOBK, OBJID);
	setChildUiException(UIOBK, OBJID, undefined, lt_ua050);
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sMutator");
	try {
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
	} catch (e) {
		console.log(e);
	}
	parent.oAPP.fn.prevDrawExceptionUi(UIOBK, OBJID);
}

async function selPreviewUI(OBJID) {
	await oWS.sMark.fn_mark(parent.oAPP.attr.prev[OBJID]);
}


function getAggrInfo(OBJID) {
	if (typeof parent.oAPP.attr.prev[OBJID].__PARENT === "undefined") {
		return;
	}
	var l_meta = parent.oAPP.attr.prev[OBJID].__PARENT.getMetadata();
	if (!l_meta) {
		return;
	}
	return l_meta.getAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR);
}


function removeUIDenyChildAggr(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK) {
	if (POBID === parent.oAPP.attr.prev[OBJID].__PARENT._OBJID && UIATT === parent.oAPP.attr.prev[OBJID]._EMBED_AGGR) {
		return;
	}
	var l_aggr = getAggrInfo(OBJID);
	if (!l_aggr) {
		return;
	}
	var ls_parent = parent.oAPP.fn.getTreeData(parent.oAPP.attr.prev[OBJID].__PARENT._OBJID);
	if (ls_parent) {
		if (denyChildAggregation(ls_parent.UIOBK, parent.oAPP.attr.prev[OBJID]._EMBED_AGGR) === true) {
			return;
		}
	}
	if (l_aggr.multiple === true) {
		var l_remove = l_aggr._sRemoveMutator;
		try {
			parent.oAPP.attr.prev[OBJID].__PARENT[l_remove](parent.oAPP.attr.prev[OBJID]);
			parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
		} catch (e) {
			try {
				parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
			} catch (e) {
				console.log(e);
			}
		}
	} else {
		var l_agrnm = l_aggr._sMutator;
		try {
			parent.oAPP.attr.prev[OBJID].__PARENT[l_agrnm]();
		} catch (e) {
			try {
				parent.oAPP.attr.prev[OBJID].__PARENT.setAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR);
			} catch (e) {
				console.log(e);
			}
		}
	}
}


function moveUIExcep(UIOBK, OBJID) {
	if (!parent.oAPP.attr.S_CODE.UW06) {
		return;
	}
	var lt_UW06 = parent.oAPP.attr.S_CODE.UW06.filter(a => a.FLD01 === UIOBK && a.FLD04 !== "X");
	if (lt_UW06.length === 0) {
		return;
	}
	for (var i = 0, l = lt_UW06.length; i < l; i++) {
		var l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[OBJID].sId + lt_UW06[i].FLD03);
		if (l_ui) {
			l_ui.destroy();
		}
	}
}

/**
 * Moves a rendered preview UI to a new aggregation position.
 */
function moveUIObjPreView(OBJID, UILIB, POBID, PUIOK, UIATT, indx, ISMLB, UIOBK, bSkipRemove) {
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		removeUIDenyChildAggr(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK);
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		return;
	}
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		return;
	}
	if (collectPopup(UILIB, OBJID) === true) {
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		return;
	}
	if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI._OBJID === OBJID) {
		parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
		parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
		return;
	}
	var l_aggr = getAggrInfo(OBJID);
	if (l_aggr && l_aggr.multiple === true && bSkipRemove !== true) {
		var l_remove = l_aggr._sRemoveMutator;
		try {
			parent.oAPP.attr.prev[OBJID].__PARENT[l_remove](parent.oAPP.attr.prev[OBJID]);
			parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
		} catch (e) {
			try {
				parent.oAPP.attr.prev[OBJID].__PARENT.removeAggregation(parent.oAPP.attr.prev[OBJID]._EMBED_AGGR, parent.oAPP.attr.prev[OBJID]);
			} catch (e) {
				console.log(e);
			}
		}
	}
	parent.oAPP.attr.prev[OBJID]._EMBED_AGGR = UIATT;
	parent.oAPP.attr.prev[OBJID].__PARENT = parent.oAPP.attr.prev[POBID];
	moveUIExcep(UIOBK, OBJID);
	if (ISMLB === "") {
		var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sMutator");
		try {
			parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
		} catch (e) {
			try {
				parent.oAPP.attr.prev[POBID].setAggregation(UIATT, parent.oAPP.attr.prev[OBJID]);
			} catch (e) {
				console.log(e);
			}
		}
		return;
	}
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, "_sInsertMutator");
	try {
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID], indx);
	} catch (e) {
		try {
			parent.oAPP.attr.prev[POBID].insertAggregation(UIATT, parent.oAPP.attr.prev[OBJID], indx);
		} catch (e) {
			console.log(e);
		}
	}
}


function destroyUIPreView(OBJID, POBID, UIOBK, PUIOK) {
	try {
		parent.oAPP.attr.prev[OBJID].destroy();
	} catch (e) {
		console.log("destroyUIPreView - " + OBJID);
	}
}

/**
 * Deletes one preview UI from its parent aggregation and design-time caches.
 */
function delUIObjPreView(OBJID, POBID, PUIOK, UIATT, ISMLB, UIOBK) {
	if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI._OBJID === OBJID) {
		parent.oAPP.attr.UA015UI = null;
	}
	if (skipSplitterLayoutData(POBID, UIATT) === true) {
		return;
	}
	if (denyChildAggregation(PUIOK, UIATT) === true) {
		return;
	}
	var l_param = ISMLB === "X" ? "_sRemoveMutator" : "_sMutator";
	var l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[POBID], "3", UIATT, l_param);
	if (ISMLB === "") {
		try {
			parent.oAPP.attr.prev[POBID][l_agrnm]();
			freeUiDom(parent.oAPP.attr.prev[OBJID]);
		} catch (e) {
			try {
				parent.oAPP.attr.prev[POBID].setAggregation(UIATT);
				freeUiDom(parent.oAPP.attr.prev[OBJID]);
			} catch (e) {
				console.log(e);
			}
		}
		return;
	}
	try {
		parent.oAPP.attr.prev[POBID][l_agrnm](parent.oAPP.attr.prev[OBJID]);
		freeUiDom(parent.oAPP.attr.prev[OBJID]);
	} catch (e) {
		try {
			parent.oAPP.attr.prev[POBID].removeAggregation(UIATT, parent.oAPP.attr.prev[OBJID]);
			freeUiDom(parent.oAPP.attr.prev[OBJID]);
		} catch (e) {
			console.log(e);
		}
	}
}


function freeUiDom(oUi) {
	if (!oUi || !oUi.getDomRef) {
		return;
	}
	var l_dom = oUi.getDomRef();
	if (!l_dom) {
		return;
	}
	try {
		l_dom.remove();
	} catch (e) {}
	freeUiDom(oUi);
}


function removeAllTreeChild(is_tree) {
	if (is_tree.zTREE.length === 0) {
		return;
	}
	var lt_aggr = [];
	for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
		removeAllTreeChild(is_tree.zTREE[i]);
		if (is_tree.zTREE[i].ISMLB !== "X") {
			continue;
		}
		if (lt_aggr.findIndex(a => a === is_tree.zTREE[i].UIATT) !== -1) {
			continue;
		}
		if (is_tree.zTREE[i].UIADT === "sap.ui.table.Row") {
			continue;
		}
		if (is_tree.zTREE[i].UIADT === "sap.m.PlanningCalendarView") {
			continue;
		}
		lt_aggr.push(is_tree.zTREE[i].UIATT);
	}
	if (typeof parent.oAPP.attr.prev[is_tree.OBJID]._pageStack !== "undefined") {
		parent.oAPP.attr.prev[is_tree.OBJID]._pageStack = [];
	}
	if (lt_aggr.length === 0) {
		return;
	}
	for (i = 0,
		l = lt_aggr.length; i < l; i++) {
		var l_remove = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[is_tree.OBJID], "3", lt_aggr[i], "_sRemoveAllMutator");
		try {
			parent.oAPP.attr.prev[is_tree.OBJID].removeAllAggregation(lt_aggr[i]);
			parent.oAPP.attr.prev[is_tree.OBJID][l_remove]();
		} catch (e) {}
	}
}


function reconstructPrevUI(is_tree, IT_UA015) {
	if (is_tree.zTREE.length === 0) {
		return;
	}
	for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
		if (is_tree.zTREE[i].OBJID === "APP") {
			reconstructPrevUI(is_tree.zTREE[i], IT_UA015);
			continue;
		}
		var l_indx = getUiPosition(is_tree.zTREE[i], is_tree.zTREE, IT_UA015);
		moveUIObjPreView(is_tree.zTREE[i].OBJID, is_tree.zTREE[i].UILIB, is_tree.zTREE[i].POBID, is_tree.zTREE[i].PUIOK, is_tree.zTREE[i].UIATT, l_indx, is_tree.zTREE[i].ISMLB, is_tree.zTREE[i].UIOBK);
		reconstructPrevUI(is_tree.zTREE[i], IT_UA015);
	}
}


function getUiPosition(is_tree, it_tree, IT_UA015) {
	for (var l_cnt = 0, i = 0, l = it_tree.length; i < l; i++) {
		if (is_tree.OBJID === it_tree[i].OBJID) {
			return l_cnt;
		}
		if (is_tree.UIATT !== it_tree[i].UIATT) {
			continue;
		}
		if (IT_UA015.findIndex(a => a.FLD01 === it_tree[i].UIFND && a.FLD03 !== "") !== -1) {
			continue;
		}
		l_cnt += 1;
	}
	return l_cnt;
}

/**
 * Rebuilds a portion of the preview tree after a design change.
 */
async function refreshPreview(is_tree) {
	
	return new Promise(async (resolve) => {
		if (is_tree.OBJID === "ROOT") {
			is_tree = parent.oAPP.fn.getTreeData("APP");
		}
		if (parent.oAPP.attr.UA015UI && parent.oAPP.attr.UA015UI === parent.oAPP.attr.prev[is_tree.OBJID]) {
			var ls_UA015 = parent.oAPP.attr.S_CODE.UA015.find(a => a.FLD01 === parent.oAPP.attr.UA015UI.__UIFND);
			if (parent.oAPP.attr.ui.prevRootPage.getContent().length === 0 && ls_UA015?.FLD03 === "") {
				var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
				var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
				parent.oAPP.attr.ui.prevRootPage.addContent(parent.oAPP.attr.prev[is_tree.OBJID]);
				await _oPromise;
				var _aPromise = _oRender.renderingRichTextEditor(is_tree, true);
				await Promise.all(_aPromise);
			}
			return resolve();
		}
		var ls_ua015 = parent.oAPP.attr.S_CODE.UA015.find(a => a.CATCD === "UA015" && a.FLD01 === is_tree.UIFND);
		if (!ls_ua015) {
			var ls_parent = parent.oAPP.fn.getTreeData(is_tree.POBID);
			if (!ls_parent) {
				return resolve();
			}
			await refreshPreview(ls_parent);
			return resolve();
		}
		if (typeof parent.oAPP.attr.UA015UI?._OBJID !== "undefined" && parent.oAPP.attr.UA015UI !== null) {
			var _sBefore = parent.oAPP.fn.getTreeData(parent.oAPP.attr?.UA015UI._OBJID);
			if (typeof _sBefore !== "undefined") {
				parent.oAPP.attr?.UA015UI.destroy();
				parent.oAPP.attr.UA015UI = undefined;
				parent.oAPP.fn.removeCollectPopup(_sBefore.OBJID);
				createUIInstance(_sBefore, parent.oAPP.attr.prev[_sBefore.OBJID]._T_0015);
				redrawUIScript(_sBefore.zTREE);
				if (_sBefore.OBJID !== "APP") {
					var _sParent = parent.oAPP.fn.getTreeData(_sBefore.POBID);
					var _aChild = _sParent.zTREE.filter(a => a.UIATK === _sBefore.UIATK);
					var _indx = _aChild.findIndex(item => item.OBJID === _sBefore.OBJID);
					moveUIObjPreView(_sBefore.OBJID, _sBefore.UILIB, _sBefore.POBID, _sBefore.PUIOK, _sBefore.UIATT, _indx, _sBefore.ISMLB, _sBefore.UIOBK, true);
				}
			}
		}
		var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
		var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
		try {
			parent.oAPP.attr.ui.prevRootPage.removeAllContent();
		} catch (e) {}
		parent.oAPP.attr.ui.prevRootPage.invalidate();
		await _oPromise;
		parent.oAPP.attr.UA015UI = parent.oAPP.attr.prev[is_tree.OBJID];
		parent.oAPP.attr.UA015UI.__UIFND = is_tree.UIFND;
		prevClearDropEffect();
		var _oTarget = _oRender.getTargetAfterRenderingUI(parent.oAPP.attr.UA015UI);
		if (typeof _oTarget?.setVisible === "function") {
			_oTarget.setVisible(true);
		}
		var _oPromise = _oRender.setAfterRendering(_oTarget);
		if (_oTarget?.isA("sap.m.NavContainer") === true && _oTarget?._pageStack) {
			_oTarget._pageStack = [];
		}
		var _oExcepUI = parent.oAPP.attr.UA015UI;
		if (ls_ua015.FLD03 !== "" && ls_ua015.FLD04 === "") {
			_oExcepUI[ls_ua015.FLD03]();
		} else if (ls_ua015.FLD03 !== "" && ls_ua015.FLD04 === "X") {
			_oExcepUI[ls_ua015.FLD03](parent.oAPP.attr.ui.prevPopupArea);
		} else {
			parent.oAPP.attr.ui.prevRootPage.addContent(_oExcepUI);
		}
		refreshPreviewExcep(_oExcepUI);
		await _oPromise;
		var _aPromise = _oRender.renderingRichTextEditor(is_tree, true);
		await Promise.all(_aPromise);
		return resolve();
	});
}


function refreshPreviewExcep(oExcepUi) {
	switch (true) {
		case oExcepUi.isA("sap.ui.unified.Menu"):
			oExcepUi.bOpen = false;
			break;
		case oExcepUi.isA("sap.m.Menu"):
			var _oMenu = oExcepUi._getMenu();
			if (typeof _oMenu !== "undefined" && _oMenu !== null) {
				_oMenu.bOpen = false;
			}
			break;
		case oExcepUi.isA("sap.m.ActionSheet"):
			var _oParent = oExcepUi.getParent();
			if (typeof _oParent !== "undefined" && typeof _oParent?.setModal === "function") {
				_oParent.setModal(true);
				_oParent.setPlacement("Auto");
			}
			break;
		case typeof oExcepUi._oPopover !== "undefined":
			if (oExcepUi._oPopover.setModal) {
				oExcepUi._oPopover.setModal(true);
			}
			break;
	}
}


function prevClearDropEffect() {
	var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
	if (l_dom === null || l_dom.length === 0) {
		return;
	}
	l_dom[0].setAttribute("style", "");
	l_dom[0].style.display = "none";
}


function closePopup() {
	if (parent.oAPP.attr.popup.length === 0) {
		return;
	}
	for (var i = 0, l = parent.oAPP.attr.popup.length; i < l; i++) {
		if (!parent.oAPP.attr.popup[i].getDomRef()) {
			continue;
		}
		if (parent.oAPP.attr.UA015UI === parent.oAPP.attr.popup[i]) {
			continue;
		}
		if (parent.oAPP.attr.popup[i].close) {
			parent.oAPP.attr.popup[i].close();
			continue;
		}
		if (parent.oAPP.attr.popup[i]._onCancel) {
			parent.oAPP.attr.popup[i]._onCancel();
			continue;
		}
	}
}


function collectPopup(UILIB, OBJID, IT_UA015) {
	if (parent.oAPP.attr.popup.findIndex(a => a === parent.oAPP.attr.prev[OBJID]) !== -1) {
		return true;
	}
	var l_UIFND = UILIB.toUpperCase();
	if (IT_UA015) {
		var ls_ua015 = IT_UA015.find(a => a.FLD01 === l_UIFND && a.FLD03 !== "X" && a.FLD03 !== "");
	} else {
		var ls_ua015 = parent.oAPP.DATA.LIB.T_9011.find(a => a.CATCD === "UA015" && a.FLD01 === l_UIFND && a.FLD03 !== "");
	}
	if (!ls_ua015) {
		return;
	}
	parent.oAPP.attr.popup.push(parent.oAPP.attr.prev[OBJID]);
	return true;
}

/**
 * Handles left-click selection inside the preview iframe and forwards OBJID selection to the parent.
 */
function setUIClickEvent(oEvent) {
	if (event.button !== 0) {
		return;
	}
	event.preventDefault();
	if (sap.ui.getCore().isLocked() === true) {
		return;
	}
	if (parent.oAPP.fn.fnWindowMenuClose) {
		parent.oAPP.fn.fnWindowMenuClose();
	}
	var _oUi = getEventTargetUI(event.target);
	if (typeof _oUi === "undefined" || _oUi === null) {
		return;
	}
	var _OBJID = findUiObjectID(_oUi);
	if (typeof _OBJID === "undefined" || _OBJID === null) {
		return;
	}
	parent.oAPP.fn.setSelectTreeItem(_OBJID);
}

/**
 * Finds the design OBJID stored on a UI5 control or nested CustomData object.
 */
function findUiObjectID(oUi) {
	if (typeof oUi === "undefined" || oUi === null) {
		return;
	}
	if (typeof oUi?._OBJID !== "undefined") {
		return oUi._OBJID;
	}
	if (typeof oUi?.data !== "function") {
		return;
	}
	var _oData = oUi.data();
	if (typeof _oData === "undefined" || _oData === null) {
		return;
	}
	for (var fld in _oData) {
		if (fld === "OBJID" && typeof _oData[fld] !== "undefined" && _oData[fld] !== null) {
			return _oData[fld];
		}
		var _OBJID = findUiObjectID(_oData[fld]);
		if (typeof _OBJID !== "undefined") {
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
 * Handles preview right-click, selects the target UI, marks it, and opens the design context menu.
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
	parent.oAPP.attr.ui.designMenu.close();
	parent.oAPP.attr.ui.oAttrMenu.close();
	removePreviewContextMenuMark();
	l_ui = getEventTargetUI(oEvent?.target);
	if (typeof l_ui === "undefined") {
		u4aRootParent.setBusy("");
		return;
	}
	_OBJID = findUiObjectID(l_ui);
	if (typeof _OBJID === "undefined") {
		u4aRootParent.setBusy("");
		return;
	}

	oOpenSnapshot = getPreviewContextMenuOpenSnapshot(oEvent, l_ui);
	parent.oAPP.fn.enableDesignContextMenu(parent.oAPP.attr.ui.oMenu, _OBJID);
	await parent.oAPP.fn.setSelectTreeItem(_OBJID);

	if (iContextMenuOpenSeq !== oWS.sMark.iContextMenuOpenSeq) {
		return;
	}

	await waitPreviewContextMenuOpenFrame();

	if (iContextMenuOpenSeq !== oWS.sMark.iContextMenuOpenSeq) {
		return;
	}

	oOpenUi = parent.oAPP.attr.prev[_OBJID];

	if (!oOpenUi) {
		u4aRootParent.setBusy("");
		return;
	}

	oOpenDom = getPreviewContextMenuOpenDom(oOpenUi);

	if (!oOpenDom) {
		u4aRootParent.setBusy("");
		return;
	}
	markPreviewContextMenuUi(oOpenUi);
	bindPreviewContextMenuMarkCleanup(parent.oAPP.attr.ui.oMenu);

	oOpenEvent = createPreviewContextMenuOpenEvent(oOpenSnapshot, oOpenDom);
	parent.oAPP.attr.ui.oMenu.openAsContextMenu(oOpenEvent, oOpenDom);
	applyPreviewContextMenuStyleClass(parent.oAPP.attr.ui.oMenu);
	u4aRootParent.setBusy("");

}


function destroyPreviewUi(is_tree) {
	if (is_tree.zTREE.length !== 0) {
		for (var i = 0, l = is_tree.zTREE.length; i < l; i++) {
			destroyPreviewUi(is_tree.zTREE[i]);
		}
	}
	if (is_tree.OBJID === "ROOT") {
		return;
	}
	try {
		parent.oAPP.attr.prev[is_tree.OBJID].destroy();
	} catch (e) {}
}


function destroyPlanningCalendarRow(is_tree) {
	if (is_tree.UIOBK !== "UO00397") {
		return;
	}
	var l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[is_tree.OBJID].sId + "-Head");
	if (!l_ui) {
		return;
	}
	try {
		l_ui.destroy();
	} catch (e) {}
	l_ui = sap.ui.getCore().byId(parent.oAPP.attr.prev[is_tree.OBJID].sId + "-CalRow");
	if (!l_ui) {
		return;
	}
	try {
		l_ui.destroy();
	} catch (e) {}
}


function destroyPreviewUiOthers() {
	var ls_ui = sap.ui.core.Element.registry.all();
	if (jQuery.isEmptyObject(ls_ui)) {
		return;
	}
	for (var i in ls_ui) {
		try {
			ls_ui[i].destroy();
		} catch (e) {}
	}
}


function removePreviewPage() {
	if (!parent.oAPP.attr.ui._page1) {
		return;
	}
	parent.oAPP.attr.ui._page1.destroy();
	parent.oAPP.attr.ui._hbox1.destroy();
	parent.oAPP.attr.ui.oMenu.destroy();
	destroyPreviewUi(parent.oAPP.attr.oModel.oData.zTREE[0]);
	destroyPreviewUiOthers();
	delete parent.oAPP.attr.ui._page1;
	delete parent.oAPP.attr.ui.prevRootPage;
	delete parent.oAPP.attr.ui._hbox1;
	delete parent.oAPP.attr.ui.prevPopupArea;
	delete parent.oAPP.attr.ui.oMenu;
	parent.oAPP.attr.UA015UI = null;
	parent.oAPP.attr.prev = {};
	parent.oAPP.attr.bfselUI = null;
	closePopup();
	parent.oAPP.attr.popup = [];
}

/**
 * Applies the selected UI5 theme to the preview iframe.
 */
function setPreviewUiTheme(themeName) {
	sap.ui.getCore().applyTheme(themeName);
}


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
	const _resourceRoot = {};
	const _host = u4aRootParent.getHost();
	const _aUA025 = parent.oAPP.attr.S_CODE.UA025;
	var sUA025 = _aUA025.find(a => a.FLD01 === "UI6_LIB" && a.FLD06 === "X");
	if (sUA025) {
		let _basePath = getUI5LibraryBasePath(sUA025);

		_resourceRoot.sapui6 = getUI5LibraryResourcePath(_basePath, "sapui6-resources", "sapui6");
		_resourceRoot.util = getUI6UtilResourcePath(_basePath);

	}
	var sUA025 = _aUA025.find(a => a.FLD01 === "U4A_LIB" && a.FLD06 === "X");
	if (sUA025) {
		let _basePath = getUI5LibraryBasePath(sUA025);

		_resourceRoot.u4a = getUI5LibraryResourcePath(_basePath, "resources", "u4a");

	}
	var sUA025 = _aUA025.find(a => a.FLD01 === "AM5CHART" && a.FLD06 === "X");
	if (sUA025) {
		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.am5Chart = _basePath;

	}
	var sUA025 = _aUA025.find(a => a.FLD01 === "ZU4A_IMP" && a.FLD06 === "X");
	if (sUA025) {
		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.zu4a_imp = _basePath;

	}
	return JSON.stringify(_resourceRoot);

}

/**
 * Creates and loads the UI5 bootstrap script for the preview runtime.
 */
function loadUi5BootstrapScript(fnCallback) {
	var oExistScript = document.getElementById("sap-ui-bootstrap");
	if (oExistScript) {
		if (window.sap && sap.ui && typeof sap.ui.getCore === "function") {
			fnCallback();
			return;
		}
		oExistScript.onload = fnCallback;
		return;
	}
	const _userInfo = u4aRootParent.getUserInfo();
	const oParam = new URLSearchParams();
	oParam.append("sap-user", _userInfo.ID);
	oParam.append("sap-password", _userInfo.PW);
	oParam.append("sap-client", _userInfo.CLIENT);
	oParam.append("sap-language", _userInfo.LANGU);
	var oScript = document.createElement("script");
	oScript.id = "sap-ui-bootstrap";
	oScript.src = parent.oAPP.fn.getBootStrapUrl() + "?" + oParam.toString();
	oScript.setAttribute("data-sap-ui-language", "EN");
	oScript.setAttribute("data-sap-ui-preload", "async");
	oScript.setAttribute("data-sap-ui-compatversion", "edge");
	oScript.setAttribute("data-sap-ui-theme", parent.oAPP.DATA.APPDATA.S_0010.UITHM);
	oScript.setAttribute("data-sap-ui-libs", parent.oAPP.fn.getUi5Libraries(true));
	oScript.setAttribute("data-sap-ui-noduplicateids", "true");
	oScript.setAttribute("data-sap-ui-resourceroots", getUI5ResourceRoot());

	
	oScript.onload = function() {
		fnCallback();
	};
	
	oScript.onerror = function() {
		console.error("[U4A preview] UI5 bootstrap script load failed.");
	};
	document.head.appendChild(oScript);
}




function setDNDEvent(oUI) {
	if (typeof oUI?._OBJID === "undefined") {
		return;
	}
	var _sTree = parent.oAPP.fn.getTreeData(oUI._OBJID);
	if (typeof _sTree === "undefined") {
		return;
	}
	var l_meta = oUI.getMetadata();
	if (!l_meta || !l_meta.dnd) {
		return;
	}
	l_meta.dnd.draggable = true;
	l_meta.dnd.droppable = true;
	clearDropEffectUI(oUI);
	if (typeof oUI.addEventDelegate !== "undefined") {
		oUI.addEventDelegate({
			
			onAfterRendering: function(oEvent) {
				var l_dom = document.getElementById(oEvent.srcControl.sId + "-inner");
				if (typeof l_dom === "undefined" || l_dom === null) {
					return;
				}
				if (l_dom.tagName !== "INPUT" && l_dom.tagName !== "TEXTAREA") {
					return;
				}
				l_dom.draggable = true;
				
				l_dom.ondragstart = function() {
					var l_ui = parent.oAPP.fn.getUiInstanceDOM(event.target, sap.ui.getCore());
					if (typeof l_ui === "undefined") {
						return;
					}
					var l_area = "previewArea|";
					event.dataTransfer.setData("text/plain", l_area + l_ui._OBJID + "|" + parent.oAPP.attr.DnDRandKey);
					parent.oAPP.fn.designTreeDragStart(parent.oAPP.fn.getTreeData(l_ui._OBJID));
				};
				
				l_dom.ondragend = function() {
					parent.oAPP.fn.designDragEnd();
				};
			}
		});
	}
	var oDrag = new sap.ui.core.dnd.DragInfo();
	
	oDrag.attachDragStart(function(oEvent) {
		var l_area = "previewArea|";
		event.dataTransfer.setData("text/plain", l_area + oEvent.mParameters.target._OBJID + "|" + parent.oAPP.attr.DnDRandKey);
		parent.oAPP.fn.designTreeDragStart(parent.oAPP.fn.getTreeData(oEvent.mParameters.target._OBJID));
	});
	
	oDrag.attachDragEnd(function(oEvent) {
		parent.oAPP.fn.designDragEnd();
	});
	oUI.addDragDropConfig(oDrag);
	if (parent.oAPP.attr.appInfo.IS_EDIT === "") {
		return;
	}
	var oDrop = new sap.ui.core.dnd.DropInfo();
	
	oDrop.attachDrop(function(oEvent) {
		parent.parent.setBusy("X");
		parent.oAPP.fn.designDragEnd();
		parent.oAPP.attr.ui.oLTree1.__dropEffect = "";
		if (!oEvent?.mParameters?.droppedControl) {
			parent.parent.setBusy("");
			return;
		}
		if (parent.oAPP.fn.UIDrop(oEvent, oEvent.mParameters.droppedControl._OBJID)) {
			return;
		}
		if (parent.oAPP.fn.designUIDropInsertPopup) {
			if (parent.oAPP.fn.designUIDropInsertPopup(oEvent, oEvent.mParameters.droppedControl._OBJID) === true) {
				return;
			}
		}
		parent.parent.setBusy("");
	});
	oUI.addDragDropConfig(oDrop);
}


function GF_ConvPropObjDateVal(sVal) {
	var l_val = sVal;
	if (l_val.length !== 8) {
		return sVal;
	}
	var l_Year = l_val.substr(0, 4);
	var l_Month = parseInt(l_val.substr(4, 2)) - 1;
	var l_Date = l_val.substr(6, 2);
	if (isNaN(l_Year) === true) {
		l_Year = 0;
	}
	if (isNaN(l_Month) === true) {
		l_Month = 0;
	}
	if (isNaN(l_Date) === true) {
		l_Date = 0;
	}
	var l_date = new Date(l_Year, l_Month, l_Date);
	return l_date;
}


function GF_ConvPropObjTimeVal(sVal) {
	var l_val = sVal;
	if (l_val.length !== 6) {
		return sVal;
	}
	var l_Hours = l_val.substr(0, 2);
	var l_Minutes = l_val.substr(2, 2);
	var l_Seconds = l_val.substr(4, 2);
	if (isNaN(l_Hours) === true) {
		l_Hours = 0;
	}
	if (isNaN(l_Minutes) === true) {
		l_Minutes = 0;
	}
	if (isNaN(l_Seconds) === true) {
		l_Seconds = 0;
	}
	var l_date = new Date("", "", "", l_Hours, l_Minutes, l_Seconds);
	return l_date;
}


function GF_ConvPropObjDateTimeVal(sVal) {
	var l_val = sVal;
	if (l_val.length === 8) {
		var l_FullYear = l_val.substr(0, 4);
		var l_Month = parseInt(l_val.substr(4, 2)) - 1;
		var l_Date = l_val.substr(6, 2);
		var l_Hours = 0;
		var l_Minutes = 0;
		var l_Seconds = 0;
		if (isNaN(l_FullYear) === true) {
			l_FullYear = 0;
		}
		if (isNaN(l_Month) === true) {
			l_Month = 0;
		}
		if (isNaN(l_Date) === true) {
			l_Date = 0;
		}
		var l_date = new Date(l_FullYear, l_Month, l_Date, l_Hours, l_Minutes, l_Seconds);
		return l_date;
	}
	if (l_val.length !== 14) {
		return sVal;
	}
	var l_FullYear = l_val.substr(0, 4);
	var l_Month = parseInt(l_val.substr(4, 2)) - 1;
	var l_Date = l_val.substr(6, 2);
	var l_Hours = l_val.substr(8, 2);
	var l_Minutes = l_val.substr(10, 2);
	var l_Seconds = l_val.substr(12, 2);
	if (isNaN(l_FullYear) === true) {
		l_FullYear = 0;
	}
	if (isNaN(l_Month) === true) {
		l_Month = 0;
	}
	if (isNaN(l_Date) === true) {
		l_Date = 0;
	}
	if (isNaN(l_Hours) === true) {
		l_Hours = 0;
	}
	if (isNaN(l_Minutes) === true) {
		l_Minutes = 0;
	}
	if (isNaN(l_Seconds) === true) {
		l_Seconds = 0;
	}
	var l_date = new Date(l_FullYear, l_Month, l_Date, l_Hours, l_Minutes, l_Seconds);
	return l_date;
}


function GF_ConvPropStrConvArray(sVal) {
	var l_val = sVal;
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	if (l_val === "") {
		return [];
	}
	return l_val.split(",");
}


function GF_ConvPropFloatConvArray(sVal) {
	var l_val = sVal;
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	var lt_split = l_val.split(","),
		l_len = lt_split.length;
	for (var i = 0; i < l_len; i++) {
		if (lt_split[i] === "") {
			lt_split[i] = "0";
		}
		lt_split[i] = parseFloat(lt_split[i]);
	}
	return lt_split;
}


function GF_ConvPropIntConvArray(sVal) {
	var l_val = sVal;
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	var lt_split = l_val.split(","),
		l_len = lt_split.length;
	for (var i = 0; i < l_len; i++) {
		if (lt_split[i] === "") {
			lt_split[i] = "0";
		}
		lt_split[i] = parseInt(lt_split[i]);
	}
	return lt_split;
}


function GF_ConvSap2jsIndex(sVal) {
	return sVal - 1;
}


function GF_GanttFullScreenTimeLine(v) {
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.FullScreenTimeLineOptions) {
		sap.ui.requireSync("sap/gantt/axistime/FullScreenStrategy");
	}
	if (!v || v === "") {
		v = "Date";
	}
	return sap.gantt.axistime.FullScreenTimeLineOptions[v];
}


function GF_GanttProportionTimeLine(v) {
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.ProportionTimeLineOptions) {
		sap.ui.requireSync("sap/gantt/axistime/ProportionZoomStrategy");
	}
	if (!v || v === "") {
		v = "Date";
	}
	return sap.gantt.axistime.ProportionTimeLineOptions[v];
}


function GF_GanttStepwiseTimeLine(v) {
	if (!sap.gantt || !sap.gantt.axistime || !sap.gantt.axistime.StepwiseTimeLineOptions) {
		sap.ui.requireSync("sap/gantt/axistime/StepwiseZoomStrategy");
	}
	if (!v || v === "") {
		v = "Date";
	}
	return sap.gantt.axistime.StepwiseTimeLineOptions[v];
}


function GF_getRandomKey() {
	return parent.oAPP.fn.getRandomKey();
}


function getIconList() {
	return sap.ui.core.IconPool.getIconNames();
}


function setPreviewZoom(fVal) {
	var l_tag = document.getElementsByTagName("html");
	if (!l_tag || !l_tag[0]) {
		return;
	}
	l_tag[0].style.zoom = String(fVal);
}


function removeDropConfig() {
	for (var i in parent.oAPP.attr.prev) {
		if (i === "ROOT") {
			continue;
		}
		if (!parent.oAPP.attr.prev[i].getDragDropConfig) {
			continue;
		}
		var lt_dnd = parent.oAPP.attr.prev[i].getDragDropConfig();
		if (lt_dnd.length === 0) {
			continue;
		}
		for (var j = 0, l = lt_dnd.length; j < l; j++) {
			if (lt_dnd[j].getMetadata()._sClassName === "sap.ui.core.dnd.DropInfo") {
				parent.oAPP.attr.prev[i].removeDragDropConfig(lt_dnd[j]);
			}
		}
	}
}


function _get_skeleton_tag_info(opt) {
	var linkVal = "",
		lstyVal = "",
		oinp = null;
	const CT_ATTR = ["class", "style", "value", "checked", "selected", "title", "placeholder", "r"];

	
	function _getHtml(d) {
		if (!d || !d.tagName)
			return "";
		var txt, ax, el = document.createElement("div");
		let _clone = d.cloneNode(false);
		let _href = _clone?.href || undefined;
		if (typeof _href !== "undefined") {
			_clone.removeAttribute("id");
			_href = _href.replace(location.origin, "");
			_clone.href = _href;
		}
		el.appendChild(_clone);
		txt = el.innerHTML;
		el = null;
		return txt;
	}

	
	function _cleanAttributes(node) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			
			[...node.attributes].forEach(attr => {
				if (!CT_ATTR.includes(attr.name)) {
					node.removeAttribute(attr.name);
				}
			});
		}
		node.childNodes.forEach(child => _cleanAttributes(child));
	}
	var oH = document.getElementsByTagName("head")[0];
	var oL = oH.getElementsByTagName("link");
	for (var i = 0; i < oL.length; i++) {
		linkVal = linkVal + _getHtml(oL[i]);
	}
	for (var i = 0; i < 100; i++) {
		var Tagsty = document.getElementsByTagName("style")[i];
		if (typeof Tagsty === "undefined") {
			break;
		}
		lstyVal = lstyVal + Tagsty.innerHTML;
		Tagsty = null;
	}
	var T = [];
	T.push({
		NAME: "STYL_LINK",
		VALUE: linkVal
	});
	T.push({
		NAME: "STYL_CSS",
		VALUE: lstyVal
	});
	let _oContent = document.getElementById("Content");
	let _oClone = _oContent.cloneNode(true);
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
		VALUE: sap.ui.getCore().getConfiguration().getTheme()
	});
	let _oThem = sap.ui.core.theming.Parameters.get();
	let _backgroundColor = _oThem?.["sapBackgroundColor"] || "";
	T.push({
		NAME: "BACKGROUND_COLOR",
		VALUE: _backgroundColor
	});
	return T;
}


parent.oAPP.fn.exceptionRespGridLayout = function(UIOBK) {
	if (UIOBK !== "UO01008") {
		return;
	}
	
	sap.ui.layout.form.FormLayoutRenderer.render = function(oRenderManager, oLayout) {
		var rm = oRenderManager;
		try {
			var oForm = oLayout.getParent();
			if (oForm && oForm instanceof sap.ui.layout.form.Form) {
				this.renderForm(rm, oLayout, oForm);
			}
		} catch (e) {
			console.log(e);
		}
	};
};

/**
 * Creates a UI5 control instance for one design tree node and applies its attributes.
 */
function createUIInstance(is_tree, it_0015) {
	if (isSkip0014(is_tree) === true) {
		return;
	}
	var ls_0022 = parent.oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === is_tree.UIOBK);
	if (typeof ls_0022 === "undefined") {
		parent.oAPP.attr.prev[is_tree.OBJID] = new sap.ui.core.Element();
		var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
		parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
		parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
		parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
		parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
		var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
		if (!ls_embed) {
			return;
		}
		parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
		parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
		parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
		return;
	}
	excepSapui6Library(ls_0022.LIBNM);
	try {
		sap.ui.requireSync(ls_0022.LIBNM.replace(/\./g, "/"));
	} catch (e) {
		parent.oAPP.attr.prev[is_tree.OBJID] = new sap.ui.core.Element();
		var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
		parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
		parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
		parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
		parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
		var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
		if (!ls_embed) {
			return;
		}
		parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
		parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
		parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
		return;
	}
	lf_excepRequire(ls_0022.UIOBK);
	parent.oAPP.fn.exceptionRespGridLayout(is_tree.UIOBK);
	var lt_0015 = it_0015 || parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === is_tree.OBJID);
	var l_class = getUIClassInstance(ls_0022.LIBNM);
	try {
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid(), setUIProperty(is_tree, lt_0015));
	} catch (e) {
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid());
	}
	addPreviewTabIndexCustomData(parent.oAPP.attr.prev[is_tree.OBJID]);
	try {
		setUIPropertyDirectly(is_tree.OBJID, lt_0015);
	} catch (e) {}
	parent.oAPP.attr.prev[is_tree.OBJID]._T_0015 = lt_0015;
	parent.oAPP.attr.prev[is_tree.OBJID]._MODEL = {};
	parent.oAPP.fn.setAggrBind(parent.oAPP.attr.prev[is_tree.OBJID]);
	parent.oAPP.attr.prev[is_tree.OBJID]._BIND_AGGR = {};
	parent.oAPP.attr.prev[is_tree.OBJID]._OBJID = is_tree.OBJID;
	if (typeof parent.oAPP.attr.prev[is_tree.OBJID].data !== "undefined") {
		parent.oAPP.attr.prev[is_tree.OBJID].data("OBJID", is_tree.OBJID);
	}
	addUIObjPreViewUW04(parent.oAPP.attr.prev[is_tree.OBJID], is_tree.UIOBK);
	selectOption3Excep(parent.oAPP.attr.prev[is_tree.OBJID], is_tree.UIOBK);
	setDNDEvent(parent.oAPP.attr.prev[is_tree.OBJID]);
	var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
	if (!ls_embed) {
		return;
	}
	parent.oAPP.attr.prev[is_tree.OBJID].__PARENT = parent.oAPP.attr.prev[is_tree.POBID];
	parent.oAPP.attr.prev[is_tree.OBJID]._EMBED_AGGR = ls_embed.UIATT;
	parent.oAPP.fn.setModelBind(parent.oAPP.attr.prev[is_tree.OBJID]);
}
//#region Preview selectable DOM registration
// Adds tabindex and data-u4a-selectable to rendered controls that expose
// customData. CSS uses the attribute to suppress UI5 focus indicators and
// JavaScript uses it to resolve click/context-menu selection targets.


function addPreviewTabIndexCustomData(oUi) {
	if (!oUi || typeof oUi.getMetadata !== "function" || typeof oUi.addCustomData !== "function") {
		return;
	}
	var oMetadata = oUi.getMetadata();
	if (!oMetadata || typeof oMetadata.getAllAggregations !== "function") {
		return;
	}
	var mAggregations = oMetadata.getAllAggregations();
	if (!mAggregations || !mAggregations.customData) {
		return;
	}
	addPreviewMarkCustomData(oUi, "tabindex", oWS.sMark.tabIndexValue);
	addPreviewMarkCustomData(oUi, oWS.sMark.selectableAttr, oWS.sMark.selectedValue);

}
//#endregion

/**
 * Builds the preview root controls and renders the current design tree into the iframe.
 */
async function drawPreview() {
	if (!jQuery.isEmptyObject(parent.oAPP.attr.prev)) {
		parent.oAPP.DATA.APPDATA.T_0015 = parent.oAPP.fn.getAttrChangedData();
		for (let _s0015 of parent.oAPP.DATA.APPDATA.T_0015) {
			if (typeof _s0015.SHCUT === "string" && _s0015.SHCUT !== "") {
				_s0015.SHCUT = JSON.parse(_s0015.SHCUT);
			}
		}
	}
	removePreviewPage();
	var _oRender = u4aRootParent.require(parent.oAPP.oDesign.pathInfo.setOnAfterRender);
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
		sap.ui.getCore().loadLibrary("sap.m");
		parent.oAPP.attr.ui._page1 = new u4a.m.Preview("u4a_prev_main_page");
		parent.oAPP.attr.ui.prevRootPage = parent.oAPP.attr.ui._page1;
		parent.oAPP.attr.ui._hbox1 = new sap.m.HBox("u4a_prev_pop_area");
		parent.oAPP.attr.ui.prevPopupArea = parent.oAPP.attr.ui._hbox1;
		var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
		parent.oAPP.attr.ui.prevRootPage.placeAt("Content");
		parent.oAPP.attr.ui.prevRootPage.oParent.insertContent(parent.oAPP.attr.ui.prevPopupArea, 0);
		await _oPromise;
	}
	parent.oAPP.attr.ui.oMenu = parent.oAPP.fn.callDesignContextMenu.call(this);
	parent.oAPP.attr.ui.oMenu.addStyleClass("sapUiSizeCompact");
	parent.oAPP.attr.ui.oMenu.addStyleClass("u4a_ws_preview_context_menu");
	parent.oAPP.attr.prev.ROOT = {};
	parent.oAPP.attr.prev.ROOT._T_0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === "ROOT");
	var l_theme = parent.oAPP.attr.prev.ROOT._T_0015.find(a => a.UIATK === "DH001021");
	if (l_theme && l_theme.UIATV !== "") {
		setPreviewUiTheme(l_theme.UIATV);
	}
	setPreviewCSS();
	setUIScript(parent.oAPP.attr.oModel.oData.zTREE);
	parent.oAPP.attr.UA015UI = parent.oAPP.attr.prev["APP"];
	parent.oAPP.attr.UA015UI.__UIFND = "SAP.M.APP";
	var _oPromise = _oRender.setAfterRendering(parent.oAPP.attr.ui.prevRootPage);
	await _oPromise;

}


function getUIClassInstance(UILIB) {
	var lt_split = UILIB.split(".");
	var l_path = window[lt_split[0]];
	for (var i = 1, l = lt_split.length; i < l; i++) {
		l_path = l_path[lt_split[i]];
	}
	return l_path;
}


function isSkip0014(is_tree) {
	if (is_tree.OBJID === "ROOT") {
		return true;
	}
	if (is_tree.UIOBK === "UO99997") {
		return true;
	}
	if (is_tree.UIOBK === "UO99998") {
		return true;
	}
	if (is_tree.UIOBK === "UO99999") {
		return true;
	}
}

/**
 * Converts persisted design attribute values into runtime UI5 property values.
 */
function parsePropertyValue(is_attr) {
	
	function lf_parseProp(vVal) {
		var l_val;
		switch (is_attr.UIADT.toUpperCase()) {
			case "BOOLEAN":
				if (vVal === "true") {
					return true;
				}
				return false;
			case "INT":
			case "FLOAT":
				l_val = Number(vVal);
				if (isNaN(l_val) === true) {
					return 0;
				}
				return l_val;
			default:
				l_val = vVal;
				var l_enum = registEnumType(is_attr.UIADT);
				var l_type = sap.ui.base.DataType.getType(is_attr.UIADT);
				if (l_type && typeof l_type.isValid === "function" && l_type.isValid(l_val) === false) {
					l_val = undefined;
				}
				if ((!l_type || typeof l_type.isValid !== "function") && l_enum && typeof l_enum === "object" && Object.keys(l_enum).some(function(sKey) {
					return l_enum[sKey] === l_val;
				}) === false) {
					l_val = undefined;
				}
				return l_val;
		}
	}
	var ls_UA032 = parent.oAPP.attr.S_CODE.UA032.find(a => a.FLD01 === is_attr.UIOBK && a.FLD03 === is_attr.UIATT);
	if (ls_UA032 && ls_UA032.FLD07 !== "") {
		return window[ls_UA032.FLD07](is_attr.UIATV);
	}
	var l_UIATV = parent.oAPP.fn.prevParseOTRValue(is_attr) || is_attr.UIATV;
	if (is_attr.UIATK === "AT000011858") {
		l_UIATV = parent.oAPP.fn.setHTMLContentProp(is_attr) || "";
	}
	if (is_attr.ISMLB === "") {
		return lf_parseProp(l_UIATV);
	}
	if (is_attr.UIATV === "[]") {
		return [];
	}
	l_val = is_attr.UIATV;
	if (l_val.substr(0, 1) === "[" && l_val.substr(l_val.length - 1, 1) === "]") {
		l_val = l_val.substr(1, l_val.length - 2);
	}
	var lt_split = l_val.split(",");
	var lt_return = [];
	for (var i = 0, l = lt_split.length; i < l; i++) {
		lt_return.push(lf_parseProp(lt_split[i]));
	}
	return lt_return;
}


function setFixedProperty(UIOBK) {
	var lt_UA018 = parent.oAPP.attr.S_CODE.UA018.filter(a => a.FLD05 === UIOBK);
	if (lt_UA018.length === 0) {
		return;
	}
	var l_prop = {};
	for (var i = 0, l = lt_UA018.length; i < l; i++) {
		var l_0023 = parent.oAPP.DATA.LIB.T_0023.find(a => a.UIOBK === lt_UA018[i].FLD05 && a.UIATT === lt_UA018[i].FLD02);
		if (!l_0023) {
			continue;
		}
		var ls_0015 = parent.oAPP.fn.crtStru0015();
		parent.oAPP.fn.moveCorresponding(l_0023, ls_0015);
		ls_0015.UIATV = lt_UA018[i].FLD04;
		if (lt_UA018[i].FLD06 === "X") {
			ls_0015.UIATV = jQuery.sap.uid();
		}
		l_prop[lt_UA018[i].FLD02] = parsePropertyValue(ls_0015);
	}
	return l_prop;
}


function setUIParent(is_tree, skipRoot) {
	if (isSkip0014(is_tree) === true) {
		return;
	}
	var ls_embed = parent.oAPP.attr.prev[is_tree.OBJID]._T_0015.find(a => a.OBJID === is_tree.OBJID && a.UIATY === "6");
	if (!ls_embed) {
		if (skipRoot) {
			return;
		}
		parent.oAPP.attr.ui.prevRootPage.addContent(parent.oAPP.attr.prev[is_tree.OBJID]);
		return;
	}
	if (collectPopup(is_tree.UIFND, is_tree.OBJID, parent.oAPP.attr.S_CODE.UA015) === true) {
		return;
	}
	let _aUW03 = parent.oAPP.attr.S_CODE.UW03.filter(item => item.FLD01 === is_tree.UIOBK && item.FLD06 !== "X");
	if (_aUW03.length > 0) {
		let _sUW03 = _aUW03.find(item => item.FLD03 === is_tree.PUIOK && item.FLD05 === ls_embed.UIATT);
		if (typeof _sUW03 === "undefined") {
			return;
		}
	}
	if (denyChildAggregation(is_tree.PUIOK, ls_embed.UIATT) === true) {
		return;
	}
	if (skipSplitterLayoutData(is_tree.POBID, is_tree.UIATT) === true) {
		return;
	}
	setRichTextEditorException(is_tree.UIOBK, is_tree.OBJID);
	setChildUiException(is_tree.UIOBK, is_tree.OBJID, is_tree.zTREE, parent.oAPP.attr.S_CODE.UA050);
	const l_agrnm = parent.oAPP.fn.getUIAttrFuncName(parent.oAPP.attr.prev[is_tree.POBID], "3", ls_embed.UIATT, "_sMutator");
	try {
		parent.oAPP.attr.prev[is_tree.POBID][l_agrnm](parent.oAPP.attr.prev[is_tree.OBJID]);
	} catch (e) {
		console.log(e);
	}
	parent.oAPP.fn.prevDrawExceptionUi(is_tree.UIOBK, is_tree.OBJID);
}


function setUIProperty(is_tree, it_0015) {
	var l_prop = setFixedProperty(is_tree.UIOBK) || {};
	var lt_0015 = it_0015.filter(a => a.OBJID === is_tree.OBJID && a.UIATY === "1" && a.UIATV.indexOf("{") === -1 && a.ISBND === "");
	if (lt_0015.length === 0) {
		return l_prop;
	}
	for (var i = 0, l = lt_0015.length; i < l; i++) {
		if (lt_0015[i].UIASN === "DRAGABLE") {
			continue;
		}
		if (lt_0015[i].UIASN === "DROPABLE") {
			continue;
		}
		if (lt_0015[i].UIASN === "STYLECLASS" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			continue;
		}
		if (is_tree.ISECP === "" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			continue;
		}
		if (parent.oAPP.fn.prevSkipProp(lt_0015[i]) === true) {
			continue;
		}
		if (parent.oAPP.attr.S_CODE.UA018.findIndex(a => a.FLD02 === lt_0015[i].UIATT && a.FLD05 === lt_0015[i].UIOBK) !== -1) {
			continue;
		}
		l_prop[lt_0015[i].UIATT] = parsePropertyValue(lt_0015[i]);
	}
	return l_prop;
}


function setUIPropertyDirectly(OBJID, it_0015) {
	var lt_0015 = it_0015.filter(a => a.OBJID === OBJID && a.UIATY === "1" && a.UIATV !== "" && a.ISBND === "");
	if (lt_0015.length === 0) {
		return;
	}
	for (var i = 0, l = lt_0015.length; i < l; i++) {
		if (lt_0015[i].UIATV.indexOf("{") !== -1) {
			setPrevPropVal(OBJID, lt_0015[i].UIATT, parsePropertyValue(lt_0015[i]));
			continue;
		}
		if (lt_0015[i].UIASN === "STYLECLASS" && lt_0015[i].UIATK.substr(0, 3) === "EXT") {
			parent.oAPP.attr.prev[OBJID].addStyleClass(lt_0015[i].UIATV);
		}
	}
}

/**
 * Recursively creates preview controls from the design tree.
 */
function setUIScript(it_tree) {
	if (it_tree.length === 0) {
		return;
	}
	for (var i = 0, l = it_tree.length; i < l; i++) {
		var _aT0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === it_tree[i].OBJID);
		createUIInstance(it_tree[i], _aT0015);
		setUIScript(it_tree[i].zTREE);
		setUIParent(it_tree[i]);
	}
}


function addUIObjPreViewUW04(oUi, UIOBK) {
	if (!oUi) {
		return;
	}
	var l_UW04 = parent.oAPP.attr.S_CODE.UW04.find(a => a.FLD01 === UIOBK && a.FLD10 !== "X");
	if (!l_UW04) {
		return;
	}
	eval(l_UW04.FLD03 + l_UW04.FLD04 + l_UW04.FLD05 + l_UW04.FLD06 + l_UW04.FLD07 + l_UW04.FLD08 + l_UW04.FLD09);
}


function richTextEditorException() {
	var l_dom = document.getElementById("U4A_HIDDEN_AREA");
	sap.ui.requireSync("sap/ui/richtexteditor/RichTextEditor");
	if (!l_dom) {
		return;
	}
	var aHiddenNodes = Array.prototype.slice.call(l_dom.childNodes);
	for (var i = 0, l = aHiddenNodes.length; i < l; i++) {
		if (!aHiddenNodes[i]) {
			continue;
		}
		var l_ui = sap.ui.getCore().byId(aHiddenNodes[i].id);
		if (!l_ui || !l_ui.getMetadata) {
			continue;
		}
		var l_meta = l_ui.getMetadata();
		if (!l_meta) {
			continue;
		}
		if (l_meta._sClassName === "sap.ui.richtexteditor.RichTextEditor") {
			l_ui.destroy();
		}
	}
}


function clearDropEffectUI(oUi) {
	if (!oUi || !oUi.addEventDelegate) {
		return;
	}
	oUi.addEventDelegate({
		
		ondragover: function(oEvent) {
			if (document.activeElement && document.activeElement.blur) {
				document.activeElement.blur();
			}
			var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
			if (l_dom === null || l_dom.length === 0) {
				return;
			}
			let oDom = l_dom[0];
			oDom.classList.remove("u4aWsDisplayNone");
		},
		
		ondragleave: function(oEvent) {
			if (document.activeElement && document.activeElement.blur) {
				document.activeElement.blur();
			}
			var l_dom = document.getElementsByClassName("sapUiDnDIndicator");
			if (l_dom === null || l_dom.length === 0) {
				return;
			}
			let oDom = l_dom[0];
			oDom.classList.remove("u4aWsDisplayNone");
			oDom.classList.add("u4aWsDisplayNone");
		}
	});
}


function selectOption3Excep(oUi, UIOBK) {
	
	function lf_setProp(T_0015, oBtn, UIATK, fSetProp, vDefault) {
		var ls_0015 = T_0015.find(a => a.UIATK === UIATK && a.ISBND === "");
		if (!ls_0015) {
			oBtn[fSetProp](vDefault);
			return;
		}
		if (ls_0015.ISSPACE === "X") {
			return;
		}
		var l_prop = ls_0015.UIATV;
		if (ls_0015.UIADT === "boolean") {
			l_prop = false;
			if (ls_0015.UIATV === "true") {
				l_prop = true;
			}
		}
		oBtn[fSetProp](l_prop);
	}
	if (UIOBK !== "UO99984") {
		return;
	}
	if (!oUi || !oUi.addEventDelegate) {
		return;
	}
	oUi.addEventDelegate({
		
		onAfterRendering: function(oEvent) {
			if (!oEvent.srcControl) {
				return;
			}
			oEvent.srcControl.addStyleClass("u4aSelOpt3");
			var l_ui = oEvent.srcControl.data("optButton");
			if (!l_ui) {
				l_ui = new sap.m.Button().addStyleClass("sapUiTinyMarginBegin");
				oEvent.srcControl.data("optButton", l_ui);
			}
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002539", "setType", "Default");
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002540", "setIcon", "sap-icon://display-more");
			lf_setProp(oEvent.srcControl._T_0015, l_ui, "EXT00002541", "setVisible", true);
			l_ui.setEnabled(oEvent.srcControl.getEditable() && oEvent.srcControl.getEnabled() || false);
			if (l_ui.getDomRef()) {
				return;
			}
			var l_dom = document.createElement("div");
			oEvent.srcControl.getDomRef().appendChild(l_dom);
			l_ui.placeAt(l_dom);
		}
	});
}


function redrawUIScript(it_tree) {
	if (it_tree.length === 0) {
		return;
	}
	for (var i = 0, l = it_tree.length; i < l; i++) {
		var l_ui = parent.oAPP.attr.prev[it_tree[i].OBJID];
		if (!l_ui || !l_ui.isDestroyed || !l_ui.isDestroyed()) {
			redrawUIScript(it_tree[i].zTREE);
			continue;
		}
		parent.oAPP.fn.removeCollectPopup(it_tree[i].OBJID);
		createUIInstance(it_tree[i], l_ui._T_0015);
		redrawUIScript(it_tree[i].zTREE);
		setUIParent(it_tree[i], true);
	}
}


function registEnumType(uiadt) {
	if (typeof uiadt === "undefined") {
		return;
	}
	if (uiadt.indexOf(".") === -1) {
		return;
	}
	let _aLib = uiadt.split('.');
	if (_aLib.length === 0) {
		return;
	}
	let _oEnum = window;
	for (let i = 0; i < _aLib.length; i++) {
		let _lib = _aLib[i];
		_oEnum = _oEnum[_lib] || undefined;
		if (typeof _oEnum === "undefined") {
			return;
		}
	}
	if (typeof _oEnum === "undefined") {
		return;
	}
	if (typeof sap === "undefined" || !sap.ui || !sap.ui.base || !sap.ui.base.DataType || typeof sap.ui.base.DataType.registerEnum !== "function") {
		return _oEnum;
	}
	sap.ui.base.DataType.registerEnum(uiadt, _oEnum);
	return _oEnum;
}
//#region 🟦 base url 설정
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
    // Fix the preview iframe's relative-path base URL.
    const sHost = u4aRootParent.getHost();
    const oBase = document.createElement("base");
    oBase.href = sHost.endsWith("/") ? sHost : sHost + "/";
    document.head.prepend(oBase);

}
//#endregion
/**
 * Bootstraps the preview runtime after base URL, UI5, and workspace hooks are ready.
 */
function start() {
	setBaseUrl();


	
	(function() {
		const NativeRO = window.ResizeObserver;
		if (!NativeRO)
			return;
		window.ResizeObserver = class ResizeObserver extends NativeRO {
			constructor(callback) {
				let rafId = 0,
					lastEntries = null,
					lastObserver = null;
				
				super((entries, observer) => {
					lastEntries = entries;
					lastObserver = observer;
					if (!rafId) {
						
						rafId = requestAnimationFrame(() => {
							rafId = 0;
							try {
								callback(lastEntries, lastObserver);
							} catch (e) {
								
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
	
	window.addEventListener("mousedown", function(oEvent) {
		if (oEvent.button !== 0 && oEvent.button !== 1 && oEvent.button !== 2) {
			oEvent.preventDefault();
			return;
		}
	});
	parent.document.getElementById("prevHTML").style.display = "";
	
	loadUi5BootstrapScript(function() {
		
		sap.ui.getCore().attachInit(async function() {

			definePreviewControl();
			defineU4ACustomData();

			
			(function() {
				sap.ui.requireSync("sap/ui/layout/ResponsiveFlowLayout");
				
				sap.ui.layout.ResponsiveFlowLayout.prototype.exit = function() {
					delete this._rows;
					if (this._IntervalCall) {
						clearTimeout(this._IntervalCall);
						this._IntervalCall = void 0
					}
					this._resizeHandlerComputeWidthsID && sap.ui.core.ResizeHandler.deregister(this._resizeHandlerComputeWidthsID);
					delete this._resizeHandlerComputeWidthsID;
					if (this.oRm) {
						this.oRm.destroy();
						delete this.oRm
					}
					delete this._$DomRef;
					delete this._oDomRef;
					delete this._iRowCounter
				};
				sap.ui.requireSync("sap/m/Carousel");
				
				sap.m.Carousel.prototype._changePage = function(t, e) {
					this._adjustHUDVisibility(e);
					var i = this.getActivePage(),
						a = this.getPages();
					t && (i = a[t - 1] && a[t - 1].getId());
					var s = a[e - 1] && a[e - 1].getId();
					this.setAssociation("activePage", s, !0);
					var o = this._getPageIndicatorText(e);
					sap.ui.Device.system.desktop || jQuery(document.activeElement).trigger("blur");
					this._oMobifyCarousel && this._oMobifyCarousel.getShouldFireEvent() && this.firePageChanged({
						oldActivePageId: i,
						newActivePageId: s,
						activePages: this._aAllActivePagesIndexes
					});
					
					this._oMobifyCarousel.$items.each((function(t, e) {
						e.className.indexOf("sapMCrslActive") <= -1 ? e.setAttribute("aria-selected", !1) : e.setAttribute("aria-selected", !0)
					}));
					this.$("slide-number").text(o)
				};
				sap.ui.requireSync("sap/uxap/ObjectPageSubSection");
				
				sap.uxap.ObjectPageSubSection.prototype._applyLayout = function(t) {
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
					try {
						
						e.forEach((function(t) {
							if (!0 !== t.isDestroyed()) {
								this._setBlockMode(t, s);
								(!a || a && a.indexOf(t) < 0) && i.addAggregation("content", t, !0)
							}
						}), this)
					} catch (t) {}
					return this
				};
				sap.ui.requireSync("sap/ui/layout/form/SimpleForm");
				
				sap.ui.layout.form.SimpleForm.prototype._suggestTitleId = function(t) {
					var e = this.getAggregation("form") || void 0;
					if (void 0 !== e) {
						e._suggestTitleId(t);
						return this
					}
				};
				sap.ui.requireSync("sap/f/GridContainer");
				
				sap.f.GridContainer.prototype._applyItemAutoRows = function(t) {
					
					function e(t) {
						var e = t.getLayoutData();
						return !e?.isA?.("sap.f.GridContainerItemLayoutData") || (!e || e.hasAutoHeight())
					}

					
					function i(t) {
						var e = t.getLayoutData();
						return e?.isA?.("sap.f.GridContainerItemLayoutData") && e ? e.getActualRows() : 1
					}
					if (this._isRenderingFinished && !this.getInlineBlockLayout() && e(t)) {
						var a = t.$(),
							s = this.getActiveLayoutSettings(),
							o = t.getDomRef() ? t.getDomRef().getBoundingClientRect().height : 0,
							r = s.calculateRowsForItem(Math.round(o));
						if (!r)
							return;
						a.parent().css({
							"grid-row": "span " + Math.max(r, i(t))
						})
					}
				};
				
				sap.f.GridContainer.prototype._enforceMaxColumns = function() {
					
					function t(t) {
						var e = t.getLayoutData();
						return e?.isA?.("sap.f.GridContainerItemLayoutData") && e ? e.getColumns() : 1
					}
					var e, i = this.getActiveLayoutSettings();
					if (i) {
						e = i.getComputedColumnsCount(this.$().innerWidth());
						
						e && this.getItems().forEach((function(i) {
							i.$().parent().css("grid-column", "span " + Math.min(t(i), e))
						}))
					}
				};
				sap.ui.requireSync("sap/f/GridContainerRenderer");
				
				sap.f.GridContainerRenderer.getStylesForItemWrapper = function(t, e) {
					var i, a, s = new Map,
						o = ["sapFGridContainerItemWrapper"],
						r = t.getLayoutData();
					if (r?.isA?.("sap.f.GridContainerItemLayoutData")) {
						i = r.getColumns();
						a = e.getActiveLayoutSettings().getColumns();
						i && a && (i = Math.min(i, a));
						i && s.set("grid-column", "span " + i);
						e.getInlineBlockLayout() ? s.set("grid-row", "span 1") : (r.getRows() || r.getMinRows()) && s.set("grid-row", "span " + r.getActualRows());
						r.hasAutoHeight() || o.push("sapFGridContainerItemFixedRows")
					}
					t.getVisible() || o.push("sapFGridContainerInvisiblePlaceholder");
					return {
						styles: s,
						classes: o
					}
				};
			})();
			sap.ui.requireSync("sap/ui/core/IconPool");
			sap.ui.core.IconPool.registerFont({
				collectionName: "SAP-icons-TNT",
				fontFamily: "SAP-icons-TNT",
				fontURI: sap.ui.require.toUrl("sap/tnt/themes/base/fonts"),
				lazy: !0
			});
			sap.ui.core.IconPool.registerFont({
				collectionName: "BusinessSuiteInAppSymbols",
				fontFamily: "BusinessSuiteInAppSymbols",
				fontURI: sap.ui.require.toUrl("sap/ushell/themes/base/fonts"),
				lazy: !0
			});
			sap.ui.requireSync("sap/m/IllustrationPool");
			sap.m.IllustrationPool.registerIllustrationSet({
				setFamily: "tnt",
				setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
			}, !1);
			
			parent.oAPP.attr.S_CODE.UA053.forEach((item) => {
				if (item.FLD04 === "X") {
					return;
				}

				sap.ui.core.IconPool.registerFont({
					collectionName: item.FLD01,
					fontFamily: item.FLD02,
					fontURI: item.FLD03,
					lazy: true
				});
			});
			
			sap.ui.getCore().attachThemeChanged(function() {
				if (u4aRootParent.require(parent.oAPP.oDesign.pathInfo.bindPopupBroadCast)("IS-CHANNEL-CREATE") === false) {
					u4aRootParent.setBusy("");
				}
			});
			
			sap.ui.getCore().attachControlEvent(function(oEvent) {
				if (oEvent?.mParameters?.browserEvent?.type === "click") {
					event.stopPropagation();
					setUIClickEvent(oEvent.mParameters.browserEvent);
				}
			});
			
			sap.ui.core.Icon.prototype.onclick = function(oEvent) {
				if (typeof this._OBJID === "undefined") {
					oEvent.preventDefault();
					return;
				}
				if (this.hasListeners("press")) {
					oEvent.setMarked();
				}
				this.firePress({
					/* no parameters */ });
			};
			
			sap.ui.core.UIArea.rerenderControl = function(oControl) {
				var oDomRef = null;
				if (oControl) {
					oDomRef = oControl.getDomRef();
					if (!oDomRef || sap.ui.core.RenderManager.isPreservedContent(oDomRef)) {
						oDomRef = (sap.ui.core.RenderManager.RenderPrefixes.Invisible + oControl.getId() ? window.document.getElementById(sap.ui.core.RenderManager.RenderPrefixes.Invisible + oControl.getId()) : null);
					}
				}
				var oParentDomRef = oDomRef && oDomRef.parentNode;
				if (oParentDomRef) {
					var uiArea = oControl.getUIArea();
					var rm = uiArea && uiArea.oCore ? uiArea.oCore.oRenderManager : sap.ui.getCore().createRenderManager();
					sap.ui.core.RenderManager.preserveContent(oDomRef, /* bPreserveRoot */
						true, /* bPreserveNodesWithId */
						false, oControl /* oControlBeforeRerender */
					);
					
					/**
					 * @since   2026-08-19 14:44:39
					 * @version vNAN-NAN
					 * @author  pes
					 * @description
					 * 미리보기 영역에서 오류가 발생하는 경우 공통 오류 처리 모듈을 통해 오류 메시지를 처리 하도록 로직 보완.
					 * 렌더 예외 시 기존 직접 처리 블록을 주석 처리하고 공통 처리로 위임되도록 유지한다.
					 */
					// try {
					// 	rm.render(oControl, oParentDomRef);
					// } catch (e) {
					// 	parent.oAPP.fn.designAreaLockUnlock();
					// 	var l_e = e?.stack || e;
					// 	if (typeof oControl?._OBJID !== "undefined") {
					// 		l_e = `ERROR UI ID : ${oControl._OBJID}\n${l_e}`;
					// 	}
						
					// 	setTimeout(() => {
					// 		parent.console.error("[U4A preview]=>" + l_e);
					//		parent.parent.showCriticalErrorDialog(l_e);
					// 	}, 0);
					// }
					
					rm.render(oControl, oParentDomRef);

				} else {
					var uiArea = oControl.getUIArea();
					uiArea && uiArea._onControlRendered(oControl);
				}
			};
			window._loaded = true;
			
			jQuery.u4aJSloadAsync = function(url, callback, s) {
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
				const _xhr = new XMLHttpRequest();
				
				_xhr.onload = (param) => {

					eval(param.target.response);

				};
							
				_xhr.open("GET", url, a);
				_xhr.send();

			};
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
			await drawPreview();
			const _oRow = parent.oAPP.attr.ui.oLTree1.getRows()[0];
			if (!_oRow?.getBindingContext) {
				return;
			}
			const _oCtxt = _oRow.getBindingContext();
			if (!_oCtxt) {
				return;
			}
			parent.oAPP.attr.ui.oLTree1.fireCellClick({
				rowBindingContext: _oCtxt
			});


		});
	});

}
