var oU4A = {};
oU4A.taskPromiseStack = [];
let G_CRITCAL_ERROR = "";

var oWS = {};
var u4a = {};
oWS.sMark = {};
oWS.sMark.clsnm = "u4a_ws_prev_mark";

window.u4aRootParent = parent.parent;

window.oncontextmenu = function(oEvent) {
	setUiContextMenu(oEvent)
};
window.onerror = function(e, t, n, a, o) {
	if (G_CRITCAL_ERROR === "X") {

		parent.oAPP.fn.designAreaLockUnlock();
		return;
	}
	setTimeout(() => {
		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e);
	}, 0);
	G_CRITCAL_ERROR = "X";
	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");

	if (typeof e !== "undefined" && e !== "") {
		l_msg = l_msg + " \n " + " \n " + e + " \n ";
	}
	parent.parent.showCriticalErrorDialog(l_msg);

	parent.oAPP.fn.designAreaLockUnlock();
};
window.addEventListener("unhandledrejection", function(e) {
	if (G_CRITCAL_ERROR === "X") {

		parent.oAPP.fn.designAreaLockUnlock();
		return;
	}
	setTimeout(() => {
		parent.console.error("[U4A preview]=>" + parent.oAPP.attr.APPID + "\n" + e.reason.stack);
	}, 0);
	G_CRITCAL_ERROR = "X";
	let l_msg = parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "192", "", "", "", "");
	l_msg = l_msg + " \n " + parent.oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "304", "", "", "", "");

	if (typeof e.reason !== "undefined" && e.reason !== "") {
		l_msg = l_msg + " \n " + " \n " + e.reason.toString() + " \n ";
	}
	parent.parent.showCriticalErrorDialog(l_msg);

	parent.oAPP.fn.designAreaLockUnlock();
});
window.ondragend = () => {
	parent.parent.IPCRENDERER.send("if-dragEnd");
};

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
oWS.sMark.fn_mark = function(oMarkUi) {
	return new Promise((resolve) => {
		if (typeof oMarkUi?.getDomRef === "undefined") {
			return resolve();
		}
		var _oDom = oMarkUi.getDomRef();
		if (typeof _oDom === "undefined" || _oDom === null) {
			return resolve();
		}
		_oDom.classList.add("u4a_ws_prev_mark");
		setTimeout(() => {
			_oDom.scrollIntoView(true);
			resolve();
		}, 0);
	});
};
oWS.sMark.fn_removeMark = function() {
	var l_dom = document.body.getElementsByClassName("u4a_ws_prev_mark");
	if (!l_dom || l_dom.length === 0) {
		return;
	}
	for (var i = 0, l = l_dom.length; i < l; i++) {
		if (!l_dom[i] || !l_dom[i].classList) {
			continue;
		}
		l_dom[i].classList.remove("u4a_ws_prev_mark");
	}
};

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

function setCSSSource(sSource) {
	var oStyle = document.getElementById("U4AStyle");
	oStyle.innerHTML = sSource;
}

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
				var _aPromise = _oRender.renderingRichTextEditor(is_tree);
				await _oPromise;
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
		var _aPromise = _oRender.renderingRichTextEditor(is_tree);
		await _oPromise;
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
async function setUiContextMenu(oEvent) {
	u4aRootParent.setBusy("X");
	parent.oAPP.attr.ui.designMenu.close();
	parent.oAPP.attr.ui.oAttrMenu.close();
	var l_ui = getEventTargetUI(oEvent.target);
	if (typeof l_ui === "undefined") {
		u4aRootParent.setBusy("");
		return;
	}
	var _OBJID = findUiObjectID(l_ui);
	if (typeof _OBJID === "undefined") {
		u4aRootParent.setBusy("");
		return;
	}
	if (typeof oEvent?.preventDefault === "function") {
		oEvent.preventDefault();
	}
	if (typeof oEvent?.stopImmediatePropagation === "function") {
		oEvent.stopImmediatePropagation();
	}
	if (typeof oEvent?.stopPropagation === "function") {
		oEvent.stopPropagation();
	}
	parent.oAPP.fn.enableDesignContextMenu(parent.oAPP.attr.ui.oMenu, _OBJID);
	await parent.oAPP.fn.setSelectTreeItem(_OBJID);
	await new Promise((res) => {
		setTimeout(() => {
			res();
		}, 0);
	});
	parent.oAPP.attr.ui.oMenu.openBy(l_ui);
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

function setPreviewUiTheme(themeName) {
	sap.ui.getCore().applyTheme(themeName);
}

function getUI5ResourceRoot() {

	const _resourceRoot = {};

	const _host = u4aRootParent.getHost();

	const _aUA025 = parent.oAPP.attr.S_CODE.UA025;

	var sUA025 = _aUA025.find(a => a.FLD01 === "UI6_LIB" && a.FLD06 === "X");

	if (sUA025) {

		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.sapui6 = _basePath + "/sapui6-resources/sapui6";
		_resourceRoot.util = _basePath + "/v1000/util";

	}


	var sUA025 = _aUA025.find(a => a.FLD01 === "U4A_LIB" && a.FLD06 === "X");

	if (sUA025) {

		let _basePath = sUA025.FLD04 + sUA025.FLD05;

		_resourceRoot.u4a = _basePath + "/resources/u4a";

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

function loadUi5BootstrapScript(fnCallback) {

	console.time("미리보기 UI5 로드 시간");

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
		console.timeEnd("미리보기 UI5 로드 시간");
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
	var l_dom = document.body.querySelector(".u4a_ws_prev_mark");
	if (l_dom && l_dom.classList) {
		l_dom.classList.remove("u4a_ws_prev_mark");
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
	if (l_dom && l_dom.classList) {
		l_dom.classList.add("u4a_ws_prev_mark");
	}
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

// 실측(서버 소스 확인): u4a.charts.am.SingleDonutChart 의 init() 자신이
//   if(typeof window.AmCharts === "undefined") jQuery.u4aJSloadAsync(".../amcharts.js", cb);
//   if(typeof window.AmCharts.AmPieChart === "undefined") jQuery.u4aJSloadAsync(".../pie.js", cb2);
// 로 벤더 스크립트 로드를 "그 자리에서" 트리거하고 콜백을 기다리지 않은 채 바로 다음 줄에서
// AmCharts.AmPieChart 를 참조 — u4aJSloadAsync 가 CORS 로 막혀 콜백이 영영 안 오면
// (jQuery.u4aJSloadAsync 자체 수정으로 해결) 여기서 크래시. init() 은 new l_class() 호출
// "그 순간"에 실행되므로, 생성 전에는 로드가 트리거조차 안 돼 있다 — 그래서 먼저 생성을
// 시도(=트리거)하고, 실패하면 이제 실제로 트리거된 로드가 끝날 때까지 기다렸다가 재시도한다.
function _waitForAmChartsReady() {
	if (typeof AmCharts !== "undefined") {
		return Promise.resolve();
	}
	return new Promise(function (resolve) {
		var iWaited = 0;
		var iTick = setInterval(function () {
			if (typeof AmCharts !== "undefined") {
				clearInterval(iTick);
				resolve();
				return;
			}
			iWaited += 50;
			if (iWaited % 3000 === 0) {
				console.warn("[U4A preview] AmCharts 전역 대기 중(" + (iWaited / 1000) + "s) — 벤더 스크립트 로딩 지연/실패 의심.");
			}
		}, 50);
	});
}

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
	/* ===== [임시 진단] AmCharts 크래시 원인 확정용 — 확인 후 제거 예정. ===== */
	if (ls_0022.LIBNM.indexOf("u4a.charts.am") === 0) {
		console.warn("[U4A preview][DIAG] " + ls_0022.LIBNM + " 생성 직전 상태 — "
			+ "l_class=" + typeof l_class
			+ ", AmCharts=" + typeof (typeof AmCharts !== "undefined" ? AmCharts : undefined)
			+ ", u4a=" + typeof window.u4a
			+ ", u4a.charts=" + typeof (window.u4a && window.u4a.charts)
			+ ", u4a.charts.am=" + typeof (window.u4a && window.u4a.charts && window.u4a.charts.am)
			+ ", u4a.charts.am.AmCharts=" + typeof (window.u4a && window.u4a.charts && window.u4a.charts.am && window.u4a.charts.am.AmCharts));
	}
	/* ===== [임시 진단] 끝 ===== */
	try {
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid(), setUIProperty(is_tree, lt_0015));
	} catch (e) {
		parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid());
	}
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
	parent.oAPP.attr.prev.ROOT = {};
	parent.oAPP.attr.prev.ROOT._T_0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === "ROOT");
	var l_theme = parent.oAPP.attr.prev.ROOT._T_0015.find(a => a.UIATK === "DH001021");
	if (l_theme && l_theme.UIATV !== "") {
		setPreviewUiTheme(l_theme.UIATV);
	}
	setPreviewCSS();
	await setUIScript(parent.oAPP.attr.oModel.oData.zTREE);
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
				registEnumType(is_attr.UIADT);
				var l_type = sap.ui.base.DataType.getType(is_attr.UIADT);
				if (l_type.isValid(l_val) === false) {
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

async function setUIScript(it_tree) {
	if (it_tree.length === 0) {
		return;
	}
	for (var i = 0, l = it_tree.length; i < l; i++) {
		// createUIInstance 자체는 동기 유지(addUIObjPreView 등 다른 호출부가 반환 직후
		// parent.oAPP.attr.prev[OBJID] 가 이미 채워져 있다고 가정 — async 로 바꾸면 그 호출부들이
		// 깨진다). u4a.charts.am 계열의 init() 은 new l_class() 실행 "그 순간" AmCharts 벤더
		// 스크립트 로드를 트리거하므로, 생성 전에는 기다릴 대상이 없다 — 먼저 생성을 시도하고,
		// (기존 원본 코드에도 있던 "속성 없이 재시도" catch 마저 실패하면) 방금 트리거된 로드가
		// 실제로 끝날 때까지 기다렸다가 한 번 더 시도한다(스탠드인 대체 아님 — 진짜로 다시 만듦).
		var _aT0015 = parent.oAPP.DATA.APPDATA.T_0015.filter(a => a.OBJID === it_tree[i].OBJID);
		try {
			createUIInstance(it_tree[i], _aT0015);
		} catch (e) {
			var ls_0022 = parent.oAPP.DATA.LIB.T_0022.find(a => a.UIOBK === it_tree[i].UIOBK);
			if (!ls_0022 || !ls_0022.LIBNM || ls_0022.LIBNM.indexOf("u4a.charts.am") !== 0) {
				throw e;
			}
			console.warn("[U4A preview] " + ls_0022.LIBNM + " 최초 생성 실패(벤더 스크립트 로딩 중) — 로딩 완료 대기 후 재시도:", e && e.message);
			await _waitForAmChartsReady();
			createUIInstance(it_tree[i], _aT0015);
		}
		await setUIScript(it_tree[i].zTREE);
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
	if (!l_dom) {
		return;
	}
	if (l_dom.childNodes.length === 0) {
		sap.ui.requireSync("sap/ui/richtexteditor/RichTextEditor");
		new sap.ui.richtexteditor.RichTextEditor().placeAt("U4A_HIDDEN_AREA");
		return;
	}
	for (var i = 0, l = l_dom.childNodes.length; i < l; i++) {
		if (!l_dom.childNodes[i]) {
			continue;
		}
		var l_ui = sap.ui.getCore().byId(l_dom.childNodes[i].id);
		if (!l_ui || !l_ui.getMetadata) {
			continue;
		}
		var l_meta = l_ui.getMetadata();
		if (!l_meta) {
			continue;
		}
		if (l_meta._sClassName === "sap.ui.richtexteditor.RichTextEditor") {
			return;
		}
	}
	sap.ui.requireSync("sap/ui/richtexteditor/RichTextEditor");
	new sap.ui.richtexteditor.RichTextEditor().placeAt("U4A_HIDDEN_AREA");
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
	sap.ui.base.DataType.registerEnum(uiadt, _oEnum);
}


//================================================================
//#region 🟦 미리보기 START Function.
//================================================================
//#endregion
function start() {

	parent.console.timeEnd("미리보기 FRAME 로드 시간");

	console.log("[U4A preview] 미리보기가 로드됐습니다.");

    //테스트!!!!!!!!!!
    //base 태그 추가 (상대경로 문제 해결 위해)
    const sHost = u4aRootParent.getHost();

    const oBase = document.createElement("base");
    oBase.href = sHost.endsWith("/") ? sHost : sHost + "/";

    document.head.prepend(oBase);
    //테스트!!!!!!!!!!

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

			console.time("미리보기 ATTACH INIT");

			definePreviewControl();

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

				if (item.FLD01 === "ICON" && item.FLD03 !== "" && item.FLD04 !== "") {
					sap.ui.core.IconPool.registerFont({
						collectionName: item.FLD01,
						fontFamily: item.FLD02,
						fontURI: item.FLD03,
						lazy: true
					});
				}
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
					try {
						rm.render(oControl, oParentDomRef);
					} catch (e) {

						parent.oAPP.fn.designAreaLockUnlock();
						var l_e = e?.stack || e;
						if (typeof oControl?._OBJID !== "undefined") {
							l_e = `ERROR UI ID : ${oControl._OBJID}\n${l_e}`;
						}
						setTimeout(() => {
							parent.console.error("[U4A preview]=>" + l_e);
							parent.parent.showCriticalErrorDialog(l_e);
						}, 0);
					}
				} else {
					var uiArea = oControl.getUIArea();
					uiArea && uiArea._onControlRendered(oControl);
				}
			};
			window._loaded = true;
			jQuery.u4aJSloadAsync = function(url, callback, s) {
				// 원본은 jQuery.ajax(dataType:'script') 로 XHR 기반 스크립트 로드. 이 iframe 은
				// HTML5/Electron 구조상 로컬 file:// 로 로드되므로, 루트상대경로(예: u4a.charts.am
				// SingleDonutChart.init() 의 "/zu4a_imp/tools/amchart/.../amcharts.js")로 SAP
				// 서버 리소스를 요청하면 file://→https:// 크로스오리진 XHR 이 되어 CORS 로 막힌다
				// (정적 .js 서버라 CORS 헤더가 없음) → window.AmCharts 가 끝내 생기지 않아
				// 'Cannot read properties of undefined (reading AmPieChart)' 로 크래시.
				// <script src> 태그는 CORS 제약 없는 리소스 로드라 이 경로가 안전하다.
				var sUrl = url;
				if (sUrl.indexOf("://") === -1) {
					var sHost = "";
					try { sHost = u4aRootParent.getHost(); } catch (e) { }
					if (sHost) {
						sUrl = sHost.replace(/\/+$/, "") + (sUrl.charAt(0) === "/" ? sUrl : "/" + sUrl);
					}
				}
				var oScript = document.createElement("script");
				oScript.src = sUrl + (sUrl.indexOf("?") === -1 ? "?" : "&") + "_ts=" + new Date().getTime();
				oScript.onload = function () {
					if (typeof callback === "function") { callback(); }
				};
				oScript.onerror = function () {
					console.error("[U4A preview] u4aJSloadAsync 스크립트 로드 실패:", sUrl);
					if (typeof callback === "function") { callback(); }
				};
				document.head.appendChild(oScript);
			};
			sap.ui.getCore().loadLibrary("sap.m");
			await drawPreview();

			console.timeEnd("미리보기 ATTACH INIT");

			parent.console.timeEnd("미리보기 로드 시간");


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