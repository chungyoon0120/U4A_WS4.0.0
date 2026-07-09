/****************************************************************************
 * Font Style Wizard (HTML5 frameless) — live canvas + property deck
 * Original: /U4A/T0026 · ZHTML_PTN011 pure client CSS generator.
 ****************************************************************************/

var REMOTE = require("@electron/remote"),
    IPCMAIN = REMOTE.require("electron").ipcMain,
    IPCRENDERER = require("electron").ipcRenderer,
    PATH = REMOTE.require("path"),
    APP = REMOTE.app,
    APPPATH = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL = require(PATHINFO.WSUTIL),
    WSERR = require(PATHINFO.WSTRYCATCH),
    CLIPBOARD = REMOTE.require("electron").clipboard,
    FS = REMOTE.require("fs"),
    USERDATA = APP.getPath("userData"),
    CURRWIN = REMOTE.getCurrentWindow();

var oQueryParams = WSUTIL.QueryString.parse(location.href);

var USERINFO = oQueryParams.USERINFO || {},
    SESSKEY = oQueryParams.sessionKey,
    BROWSKEY = oQueryParams.browserkey,
    BGCOL = oQueryParams.BGCOL,
    SYSID = USERINFO.SYSID,
    LANGU = USERINFO.LANGU,
    WSMSG = (SYSID && LANGU) ? new WSUTIL.MessageClassText(SYSID, LANGU) : null;

var zconsole = WSERR(window, document, console);

var bBusy = false,
    bOpenDone = false,
    oBroad = null,
    oToastTimer = null,
    sActivePane = "font",
    oState = {},
    oCustomFields = {};

var SAMPLE_TEXT = [
    "하단 버튼 클릭해서 생성된 스타일이 여기 텍스트에 반영됩니다.",
    "Test sample",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz",
    "가나다라마바사아자차카타파하 1234567890"
].join("\n");

var DECKS = [
    {
        key: "font",
        label: "Font",
        icon: "fa-font",
        rows: [
            { prop: "font-family", key: "fontFamily", css: "fontFamily", def: "serif", custom: true, labels: { tahoma: "Tahoma" }, values: ["serif", "sans-serif", "cursive", "fantasy", "monospace", "돋움", "굴림", "tahoma", "Verdana", "custom"] },
            { prop: "font-style", key: "fontStyle", css: "fontStyle", def: "normal", values: ["normal", "italic", "oblique"] },
            { prop: "font-variant", key: "fontVariant", css: "fontVariant", def: "normal", values: ["normal", "small-caps"] },
            { prop: "font-weight", key: "fontWeight", css: "fontWeight", def: "normal", values: ["normal", "bold", "bolder", "lighter", "100", "200", "500", "600", "900"] },
            { prop: "font-size", key: "fontSize", css: "fontSize", def: "medium", custom: true, values: ["medium", "small", "large", "smaller", "larger", "9px", "10px", "11px", "12px", "13px", "14px", "15px", "16px", "17px", "18px", "custom"] }
        ]
    },
    {
        key: "text",
        label: "Text",
        icon: "fa-align-left",
        rows: [
            { prop: "line-height", key: "lineHeight", css: "lineHeight", def: "100%", custom: true, values: ["100%", "200%", "80%", "2em", "1em", "0.8em", "custom"] },
            { prop: "word-spacing", key: "wordSpacing", css: "wordSpacing", def: "normal", values: ["normal", "1ex", "1.5ex", "2ex", "5ex"] },
            { prop: "letter-spacing", key: "letterSpacing", css: "letterSpacing", def: "normal", values: ["normal", "0.1ex", "0.3ex", "0.75ex", "1ex"] },
            { prop: "text-decoration", key: "textDecoration", css: "textDecoration", def: "none", values: ["none", "underline", "overline", "line-through", "blink"] },
            { prop: "text-transform", key: "textTransform", css: "textTransform", def: "none", values: ["none", "capitalize", "uppercase", "lowercase"] },
            { prop: "text-align", key: "textAlign", css: "textAlign", def: "left", values: ["left", "right", "center", "justify"] },
            { prop: "text-indent", key: "textIndent", css: "textIndent", def: "0ex", values: ["0ex", "1ex", "2ex", "5ex", "10ex", "10%", "20%"] }
        ]
    },
    {
        key: "inline",
        label: "Inline",
        icon: "fa-text-height",
        rows: [
            { prop: "vertical-align", key: "verticalAlign", css: "verticalAlign", def: "baseline", target: "inline", values: ["baseline", "sub", "super", "top", "text-top", "middle", "bottom", "text-bottom"] }
        ]
    },
    {
        key: "source",
        label: "Source",
        icon: "fa-code",
        source: true
    }
];

var STATUS_KEYS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "verticalAlign"];

function _err(sText, e) {
    console.error(sText, e);
}

function _msg(sCls, sCode, p1) {
    if (!WSMSG) { return ""; }
    try {
        return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", "") || "";
    } catch (e) {
        _err("[HTML5][fontStyleWizard] message lookup failed", e);
        return "";
    }
}

function _eachRow(fn) {
    DECKS.forEach(function (oDeck) {
        (oDeck.rows || []).forEach(fn);
    });
}

function _rowByKey(sKey) {
    var oFound = null;
    _eachRow(function (oRow) {
        if (oRow.key === sKey) { oFound = oRow; }
    });
    return oFound;
}

function _initState() {
    _eachRow(function (oRow) {
        oState[oRow.key] = oRow.def;
    });
}

function _valueOf(sKey) {
    if (oState[sKey] !== "custom") { return oState[sKey]; }
    var oField = oCustomFields[sKey];
    return oField ? (oField.getValue() || "") : "";
}

function _displayValue(oRow, sValue) {
    if (sValue === "custom") { return "custom:"; }
    return oRow.labels && oRow.labels[sValue] ? oRow.labels[sValue] : sValue;
}

function _getThemeInfo() {
    if (!SYSID) { return null; }
    try {
        var sPath = PATH.join(USERDATA, "p13n", "theme_ws4", SYSID + ".json");
        if (!FS.existsSync(sPath)) { return null; }
        return JSON.parse(FS.readFileSync(sPath, "utf-8"));
    } catch (e) {
        _err("[HTML5][fontStyleWizard] theme info read failed", e);
        return null;
    }
}

function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("fw2Busy");
    if (oEl) { oEl.setAttribute("data-busy", bBusy ? "true" : "false"); }
    try { CURRWIN.closable = false; } catch (e) { _err("[HTML5][fontStyleWizard] set closable failed", e); }
    if (oBroad && !(oOpt && oOpt.ISBROAD)) {
        try { oBroad.postMessage({ PRCCD: bBusy ? "BUSY_ON" : "BUSY_OFF" }); }
        catch (e2) { _err("[HTML5][fontStyleWizard] busy broadcast failed", e2); }
    }
}

function _finishOpen() {
    if (bOpenDone) { return; }
    bOpenDone = true;
    try { IPCRENDERER.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); }
    catch (e) { _err("[HTML5][fontStyleWizard] busy unlock send failed", e); }
    _setBusy(false);
    var oRoot = document.getElementById("fw2Root");
    if (oRoot) { oRoot.classList.add("is-ready"); }
}

function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("fw2Toast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "fw2Toast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { _err("[HTML5][fontStyleWizard] toast timer clear failed", e); }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

function _applyPreview() {
    var oSample = document.getElementById("fw2Sample"),
        oSpan = document.getElementById("fw2InlineSample"),
        oImg = document.getElementById("fw2ImgSample");

    if (oSample && !oSample.textContent) { oSample.textContent = SAMPLE_TEXT; }

    _eachRow(function (oRow) {
        var sVal = _valueOf(oRow.key);
        if (oRow.target === "inline") {
            if (oSpan) { oSpan.style[oRow.css] = sVal; }
            if (oImg) { oImg.style[oRow.css] = sVal; }
            return;
        }
        if (oSample) { oSample.style[oRow.css] = sVal; }
    });
}

function _buildStyleSource() {
    return [
        '<style type="text/css">',
        "p.sample {",
        "\tfont-family: " + _valueOf("fontFamily") + ";",
        "\tfont-style: " + _valueOf("fontStyle") + ";",
        "\tfont-variant: " + _valueOf("fontVariant") + ";",
        "\tfont-weight: " + _valueOf("fontWeight") + ";",
        "\tfont-size: " + _valueOf("fontSize") + ";",
        "\tline-height: " + _valueOf("lineHeight") + ";",
        "\tword-spacing: " + _valueOf("wordSpacing") + ";",
        "\tletter-spacing: " + _valueOf("letterSpacing") + ";",
        "\ttext-decoration: " + _valueOf("textDecoration") + ";",
        "\ttext-transform: " + _valueOf("textTransform") + ";",
        "\ttext-align: " + _valueOf("textAlign") + ";",
        "\ttext-indent: " + _valueOf("textIndent") + ";",
        "}",
        "img.sample { vertical-align: " + _valueOf("verticalAlign") + "; }",
        "span.sample { vertical-align: " + _valueOf("verticalAlign") + "; font-size: smaller; text-transform: capitalize; }",
        "</style>",
        "",
        "",
        '<p class="sample">',
        "Hello hi ",
        "</p>"
    ].join("\n");
}

function _renderStatus() {
    var oWrap = document.getElementById("fw2Status");
    if (!oWrap) { return; }
    oWrap.innerHTML = "";
    STATUS_KEYS.forEach(function (sKey) {
        var oRow = _rowByKey(sKey),
            sVal = _valueOf(sKey);
        if (!oRow || !sVal) { return; }
        var oItem = document.createElement("span");
        oItem.className = "fw2-status__item";
        var oName = document.createElement("span");
        oName.textContent = oRow.prop;
        var oValue = document.createElement("b");
        oValue.textContent = sVal;
        oItem.appendChild(oName);
        oItem.appendChild(oValue);
        oWrap.appendChild(oItem);
    });
}

function _updateSourceNode() {
    var oSrc = document.getElementById("fw2SourceCode");
    if (oSrc) { oSrc.textContent = _buildStyleSource(); }
}

function _update() {
    _applyPreview();
    _updateSourceNode();
    _syncCurrentLabels();
    _renderStatus();
}

function _syncRow(sKey) {
    var oCard = document.querySelector('[data-fw2-row="' + sKey + '"]');
    if (!oCard) { return; }
    Array.prototype.forEach.call(oCard.querySelectorAll(".fw2-value"), function (oBtn) {
        oBtn.setAttribute("aria-pressed", oBtn.dataset.value === oState[sKey] ? "true" : "false");
    });
    var oCurrent = oCard.querySelector(".fw2-prop__current");
    if (oCurrent) { oCurrent.textContent = _valueOf(sKey); }
}

function _syncCurrentLabels() {
    _eachRow(function (oRow) {
        var oCard = document.querySelector('[data-fw2-row="' + oRow.key + '"]');
        if (!oCard) { return; }
        var oCurrent = oCard.querySelector(".fw2-prop__current");
        if (oCurrent) { oCurrent.textContent = _valueOf(oRow.key); }
    });
}

function _select(oRow, sValue) {
    oState[oRow.key] = sValue;
    _syncRow(oRow.key);
    _update();
}

function _reset() {
    _eachRow(function (oRow) {
        oState[oRow.key] = oRow.def;
        var oField = oCustomFields[oRow.key];
        if (oField && oField.setValue) {
            try { oField.setValue(""); } catch (e) { _err("[HTML5][fontStyleWizard] custom reset failed", e); }
        }
        _syncRow(oRow.key);
    });
    var oSample = document.getElementById("fw2Sample");
    if (oSample) { oSample.textContent = SAMPLE_TEXT; }
    _update();
}

function _makeValueButton(oRow, sValue) {
    var oBtn = document.createElement("button");
    oBtn.type = "button";
    oBtn.className = "fw2-value";
    oBtn.dataset.value = sValue;
    oBtn.setAttribute("aria-pressed", sValue === oRow.def ? "true" : "false");
    oBtn.textContent = _displayValue(oRow, sValue);
    oBtn.addEventListener("click", function () { _select(oRow, sValue); });
    return oBtn;
}

function _makeCustomField(oRow) {
    var oHost = document.createElement("div");
    oHost.className = "fw2-custom";
    if (window.U4AUI && U4AUI.createField) {
        var oField = U4AUI.createField({
            clear: true,
            placeholder: oRow.prop,
            onInput: function () {
                if (oState[oRow.key] === "custom") { _update(); }
            },
            onEnter: function () {
                _select(oRow, "custom");
            },
            onClear: function () {
                if (oState[oRow.key] === "custom") { _update(); }
            }
        });
        oCustomFields[oRow.key] = oField;
        oHost.appendChild(oField.el);
    } else {
        console.warn("[HTML5][fontStyleWizard] U4AUI.createField unavailable");
    }
    return oHost;
}

function _makePropertyCard(oRow) {
    var oCard = document.createElement("article");
    oCard.className = "fw2-prop";
    oCard.dataset.fw2Row = oRow.key;

    var oHead = document.createElement("div");
    oHead.className = "fw2-prop__head";
    var oName = document.createElement("h2");
    oName.textContent = oRow.prop;
    oName.setAttribute("data-tip", oRow.prop);
    oName.setAttribute("data-tip-trunc", "");
    var oCurrent = document.createElement("span");
    oCurrent.className = "fw2-prop__current";
    oCurrent.textContent = _valueOf(oRow.key);
    oHead.appendChild(oName);
    oHead.appendChild(oCurrent);
    oCard.appendChild(oHead);

    var oValues = document.createElement("div");
    oValues.className = "fw2-values";
    oRow.values.forEach(function (sValue) {
        oValues.appendChild(_makeValueButton(oRow, sValue));
        if (sValue === "custom") { oValues.appendChild(_makeCustomField(oRow)); }
    });
    oCard.appendChild(oValues);
    return oCard;
}

function _renderTabs() {
    var oTabs = document.getElementById("fw2Tabs");
    if (!oTabs) { return; }
    oTabs.innerHTML = "";
    DECKS.forEach(function (oDeck) {
        var oBtn = document.createElement("button");
        oBtn.type = "button";
        oBtn.className = "fw2-tab";
        oBtn.id = "fw2Tab_" + oDeck.key;
        oBtn.dataset.pane = oDeck.key;
        oBtn.setAttribute("role", "tab");
        oBtn.setAttribute("aria-selected", oDeck.key === sActivePane ? "true" : "false");
        oBtn.innerHTML = '<i class="fa-solid ' + oDeck.icon + '" aria-hidden="true"></i><span>' + oDeck.label + "</span>";
        oBtn.addEventListener("click", function () {
            sActivePane = oDeck.key;
            _renderTabs();
            _renderTray();
        });
        oTabs.appendChild(oBtn);
    });
}

function _renderSourcePane(oRoot) {
    var oShell = document.createElement("section");
    oShell.className = "fw2-source";
    var oCode = document.createElement("pre");
    oCode.className = "fw2-source__code u4a-selectable";
    oCode.id = "fw2SourceCode";
    oCode.tabIndex = 0;
    oCode.textContent = _buildStyleSource();
    oShell.appendChild(oCode);
    oRoot.appendChild(oShell);
}

function _renderTray() {
    var oTray = document.getElementById("fw2Tray");
    if (!oTray) { return; }
    oTray.innerHTML = "";
    var oDeck = DECKS.filter(function (oItem) { return oItem.key === sActivePane; })[0] || DECKS[0];
    oTray.dataset.pane = oDeck.key;
    if (oDeck.source) {
        _renderSourcePane(oTray);
        return;
    }
    var oScroller = document.createElement("div");
    oScroller.className = "fw2-props";
    (oDeck.rows || []).forEach(function (oRow) {
        oScroller.appendChild(_makePropertyCard(oRow));
    });
    oTray.appendChild(oScroller);
    try { if (window.U4AUI && U4AUI.initTooltip) { U4AUI.initTooltip(); } }
    catch (e) { _err("[HTML5][fontStyleWizard] tooltip init failed", e); }
}

function _copySource() {
    var sText = _buildStyleSource(),
        bOk = false,
        oSrc = document.getElementById("fw2SourceCode");
    try {
        if (CLIPBOARD && CLIPBOARD.writeText) {
            CLIPBOARD.writeText(sText);
            bOk = true;
        }
    } catch (e) { _err("[HTML5][fontStyleWizard] clipboard write failed", e); }
    if (!bOk && oSrc) {
        try {
            var oSel = window.getSelection();
            var oRange = document.createRange();
            oRange.selectNodeContents(oSrc);
            oSel.removeAllRanges();
            oSel.addRange(oRange);
            bOk = document.execCommand("copy");
            oSel.removeAllRanges();
        } catch (e2) { _err("[HTML5][fontStyleWizard] execCommand copy failed", e2); }
    }
    if (bOk) { _toast(_msg("/U4A/MSG_WS", "316") || "Copied"); }
}

function _onThemeChange() {
    var oTheme = _getThemeInfo();
    if (!oTheme || !oTheme.THEME) { return; }
    try {
        if (oTheme.BGCOL) {
            CURRWIN.webContents.insertCSS("html,body{margin:0;height:100%;background-color:" + oTheme.BGCOL + ";}");
            BGCOL = oTheme.BGCOL;
        }
    } catch (e) { _err("[HTML5][fontStyleWizard] theme background apply failed", e); }
    try {
        if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); }
    } catch (e2) { _err("[HTML5][fontStyleWizard] theme apply failed", e2); }
}

function _initBroadcast() {
    try {
        oBroad = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
        oBroad.onmessage = function (oEvent) {
            var sPrc = oEvent && oEvent.data && oEvent.data.PRCCD;
            if (sPrc === "BUSY_ON") { _setBusy(true, { ISBROAD: true }); }
            else if (sPrc === "BUSY_OFF") { _setBusy(false, { ISBROAD: true }); }
        };
    } catch (e) { _err("[HTML5][fontStyleWizard] broadcast init failed", e); }
}

function _keepSession() {
    try { IPCRENDERER.send("if-session-time", SESSKEY); }
    catch (e) { _err("[HTML5][fontStyleWizard] keep session failed", e); }
}

function _syncMaxIcon() {
    var oBtn = document.querySelector('#fw2Titlebar [data-action="max"] i');
    if (!oBtn) { return; }
    try {
        oBtn.className = CURRWIN.isMaximized() ? "fa-regular fa-window-restore" : "fa-regular fa-square";
    } catch (e) { _err("[HTML5][fontStyleWizard] maximize icon sync failed", e); }
}

function _initChrome() {
    var oLogo = document.getElementById("fw2Logo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); }
        catch (e) { _err("[HTML5][fontStyleWizard] logo path failed", e); }
    }

    var oTitle = document.getElementById("fw2Title");
    if (oTitle) {
        var sTitle = _msg("/U4A/CL_WS_COMMON", "B57") || "";
        try { sTitle = sTitle || document.title || CURRWIN.getTitle() || ""; }
        catch (e2) { _err("[HTML5][fontStyleWizard] title read failed", e2); }
        oTitle.textContent = sTitle || "Font Style Wizard";
        try { document.title = oTitle.textContent; } catch (e3) { _err("[HTML5][fontStyleWizard] document title set failed", e3); }
    }

    var oMin = document.querySelector('#fw2Titlebar [data-action="min"]');
    if (oMin) {
        oMin.addEventListener("click", function () {
            try { CURRWIN.minimize(); } catch (e) { _err("[HTML5][fontStyleWizard] minimize failed", e); }
        });
    }

    var oMax = document.querySelector('#fw2Titlebar [data-action="max"]');
    if (oMax) {
        oMax.addEventListener("click", function () {
            try {
                if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); }
                else { CURRWIN.maximize(); }
                _syncMaxIcon();
            } catch (e) { _err("[HTML5][fontStyleWizard] maximize toggle failed", e); }
        });
        try {
            CURRWIN.on("maximize", _syncMaxIcon);
            CURRWIN.on("unmaximize", _syncMaxIcon);
        } catch (e2) { _err("[HTML5][fontStyleWizard] maximize listener failed", e2); }
    }

    var oClose = document.querySelector('#fw2Titlebar [data-action="close"]');
    if (oClose) {
        oClose.addEventListener("click", function () {
            if (bBusy) { return; }
            if (window.U4AUI && U4AUI.closeWindow) { U4AUI.closeWindow(CURRWIN); }
            else {
                try { CURRWIN.setClosable(true); CURRWIN.close(); }
                catch (e) { _err("[HTML5][fontStyleWizard] close failed", e); }
            }
        });
    }

    var oReset = document.getElementById("fw2ResetBtn");
    if (oReset) { oReset.addEventListener("click", _reset); }

    var oCopy = document.getElementById("fw2CopyBtn");
    if (oCopy) { oCopy.addEventListener("click", _copySource); }

    try {
        if (window.U4AUI && U4AUI.initWindowFocusState) { U4AUI.initWindowFocusState(); }
        if (window.U4AUI && U4AUI.initTooltip) { U4AUI.initTooltip(); }
    } catch (e4) { _err("[HTML5][fontStyleWizard] common UX init failed", e4); }
}

window.addEventListener("load", function () {
    try { CURRWIN.setMenu(null); } catch (e) { _err("[HTML5][fontStyleWizard] menu clear failed", e); }

    _setBusy(true);
    _initState();
    _initChrome();
    _initBroadcast();
    _renderTabs();
    _renderTray();
    _update();

    try { IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChange); }
    catch (e2) { _err("[HTML5][fontStyleWizard] theme listener failed", e2); }

    window.addEventListener("click", _keepSession);
    window.addEventListener("keyup", _keepSession);
    _keepSession();

    try { CURRWIN.show(); } catch (e3) { _err("[HTML5][fontStyleWizard] show failed", e3); }
    _finishOpen();
});

window.onbeforeunload = function () {
    if (bBusy) { return false; }
    window.removeEventListener("click", _keepSession);
    window.removeEventListener("keyup", _keepSession);
    try { IPCMAIN.removeListener("if-p13n-themeChange-" + SYSID, _onThemeChange); }
    catch (e) { _err("[HTML5][fontStyleWizard] theme listener cleanup failed", e); }
    try {
        CURRWIN.removeListener("maximize", _syncMaxIcon);
        CURRWIN.removeListener("unmaximize", _syncMaxIcon);
    } catch (e2) { _err("[HTML5][fontStyleWizard] window listener cleanup failed", e2); }
    try {
        if (oBroad) { oBroad.close(); }
    } catch (e3) { _err("[HTML5][fontStyleWizard] broadcast cleanup failed", e3); }
};
