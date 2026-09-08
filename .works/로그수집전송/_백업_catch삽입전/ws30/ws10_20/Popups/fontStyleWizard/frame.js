/****************************************************************************
 * Font Style Wizard (HTML5 frameless) — "Living Controls" (Claude redesign)
 * --------------------------------------------------------------------------
 * Original: server rendered pure client CSS font/text style generator
 *           (/U4A/T0026 · ZHTML_PTN011). No server save / callback / IPC data.
 * Idea    : 각 옵션 칩이 자기 효과를 스스로 렌더(serif=serif, 900=굵게,
 *           italic=기울임, uppercase=UPPERCASE, line-through=취소선). 정렬=아이콘.
 *           좌 대형 라이브 스페시멘 + 실시간 CSS, 우 인스펙터.
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

// ws_trycatch — 오류 표면화(삼키기 금지)
var zconsole = WSERR(window, document, console);

var oToastTimer = null,
    bBusy = false,
    bOpenDone = false,
    oBroad = null,
    oCustomFields = {};

var SAMPLE_TEXT = [
    "하단 버튼 클릭해서 생성된 스타일이 여기 텍스트에 반영됩니다.",
    "Test sample",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz",
    "가나다라마바사아자차카타파하 1234567890"
].join("\n");

// 칩에 자기 스타일을 입혀 "자기시연"할 CSS 속성들(값을 그 칩에 직접 적용)
var DEMO_CSS = { fontFamily: 1, fontWeight: 1, fontStyle: 1, fontVariant: 1, textDecoration: 1, textTransform: 1 };

// 정렬 값 → 아이콘
var ALIGN_ICONS = { left: "fa-align-left", right: "fa-align-right", center: "fa-align-center", justify: "fa-align-justify" };

/* 원본 T0026/ZHTML_PTN011 속성·값·기본선택 1:1 보존. def=기본, custom=자유입력, target:"inline"=span/img 대상, control="align"=아이콘 */
var aGroups = [
    {
        title: "Font", icon: "fa-font",
        rows: [
            { prop: "font-family", key: "fontFamily", css: "fontFamily", def: "serif", custom: true, labels: { tahoma: "Tahoma" }, values: ["serif", "sans-serif", "cursive", "fantasy", "monospace", "돋움", "굴림", "tahoma", "Verdana", "custom"] },
            { prop: "font-style", key: "fontStyle", css: "fontStyle", def: "normal", values: ["normal", "italic", "oblique"] },
            { prop: "font-variant", key: "fontVariant", css: "fontVariant", def: "normal", values: ["normal", "small-caps"] },
            { prop: "font-weight", key: "fontWeight", css: "fontWeight", def: "normal", values: ["normal", "bold", "bolder", "lighter", "100", "200", "500", "600", "900"] },
            { prop: "font-size", key: "fontSize", css: "fontSize", def: "medium", custom: true, values: ["medium", "small", "large", "smaller", "larger", "9px", "10px", "11px", "12px", "13px", "14px", "15px", "16px", "17px", "18px", "custom"] }
        ]
    },
    {
        title: "Text", icon: "fa-align-left",
        rows: [
            { prop: "line-height", key: "lineHeight", css: "lineHeight", def: "100%", custom: true, values: ["100%", "200%", "80%", "2em", "1em", "0.8em", "custom"] },
            { prop: "word-spacing", key: "wordSpacing", css: "wordSpacing", def: "normal", values: ["normal", "1ex", "1.5ex", "2ex", "5ex"] },
            { prop: "letter-spacing", key: "letterSpacing", css: "letterSpacing", def: "normal", values: ["normal", "0.1ex", "0.3ex", "0.75ex", "1ex"] },
            { prop: "text-decoration", key: "textDecoration", css: "textDecoration", def: "none", multi: true, values: ["none", "underline", "overline", "line-through", "blink"] },
            { prop: "text-transform", key: "textTransform", css: "textTransform", def: "none", values: ["none", "capitalize", "uppercase", "lowercase"] },
            { prop: "text-align", key: "textAlign", css: "textAlign", def: "left", control: "align", values: ["left", "right", "center", "justify"] },
            { prop: "text-indent", key: "textIndent", css: "textIndent", def: "0ex", values: ["0ex", "1ex", "2ex", "5ex", "10ex", "10%", "20%"] },
            { prop: "vertical-align", key: "verticalAlign", css: "verticalAlign", def: "baseline", target: "inline", demoInline: true, values: ["baseline", "sub", "super", "top", "text-top", "middle", "bottom", "text-bottom"] }
        ]
    }
];

// 캡션(shorthand) 요약에 노출할 키
var CAPTION_KEYS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "textAlign", "verticalAlign"];

var oState = {};
var oRowByKey = {};

function _err(sText, e) { console.error(sText, e); }

// 다중선택(multi) 속성의 초기 배열 — "none"/빈값은 빈 배열
function _multiInit(sDef) { return (!sDef || sDef === "none") ? [] : sDef.split(/\s+/); }

function _msg(sCls, sCode, p1) {
    if (!WSMSG) { return ""; }
    try { return WSMSG.fnGetMsgClsText(sCls, sCode, p1 || "", "", "", "") || ""; }
    catch (e) { _err("[HTML5][fontStyleWizard] message lookup failed", e); return ""; }
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

function _eachRow(fn) {
    aGroups.forEach(function (oGroup) { oGroup.rows.forEach(fn); });
}

function _setBusy(bOn, oOpt) {
    bBusy = !!bOn;
    var oEl = document.getElementById("fwxBusy");
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
    var oRoot = document.getElementById("fwxRoot");
    if (oRoot) { oRoot.classList.add("is-ready"); }
}

function _toast(sText) {
    if (!sText) { return; }
    var oEl = document.getElementById("fwxToast");
    if (!oEl) {
        oEl = document.createElement("div");
        oEl.id = "fwxToast";
        oEl.className = "u4a-toast";
        oEl.setAttribute("role", "alert");
        document.body.appendChild(oEl);
    }
    oEl.textContent = sText;
    oEl.dataset.show = "true";
    try { clearTimeout(oToastTimer); } catch (e) { _err("[HTML5][fontStyleWizard] toast timer clear failed", e); }
    oToastTimer = setTimeout(function () { oEl.dataset.show = "false"; }, 3000);
}

function _initState() {
    _eachRow(function (oRow) {
        oRowByKey[oRow.key] = oRow;
        oState[oRow.key] = oRow.multi ? _multiInit(oRow.def) : oRow.def;
    });
}

function _valueOf(sKey) {
    var oRow = oRowByKey[sKey];
    if (oRow && oRow.multi) {
        var aSel = oState[sKey];
        return (Array.isArray(aSel) && aSel.length) ? aSel.join(" ") : "none";
    }
    if (oState[sKey] !== "custom") { return oState[sKey]; }
    var oField = oCustomFields[sKey];
    return oField ? (oField.getValue() || "") : "";
}

function _applyPreview() {
    var oSample = document.getElementById("fwxSample"),
        oSpan = document.getElementById("fwxInlineSample"),
        oImg = document.getElementById("fwxImgSample");

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

/* 원본 writeStyleSource() 포맷 1:1 (p.sample 블록 + 샘플 조각) */
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
        "</style>",
        "",
        "",
        '<p class="sample">',
        "Hello hi ",
        "</p>"
    ].join("\n");
}

function _renderCaption() {
    var oCap = document.getElementById("fwxCaption");
    if (!oCap) { return; }
    oCap.innerHTML = "";
    CAPTION_KEYS.forEach(function (sKey, i) {
        if (i > 0) {
            var oSep = document.createElement("span");
            oSep.className = "fwx-caption__sep";
            oSep.textContent = "·";
            oCap.appendChild(oSep);
        }
        var oB = document.createElement("b");
        oB.textContent = _valueOf(sKey) || "—";
        oCap.appendChild(oB);
    });
}

function _updateSource() {
    var oSrc = document.getElementById("fwxSource");
    if (oSrc) { oSrc.textContent = _buildStyleSource(); }
}

function _update() {
    _applyPreview();
    _updateSource();
    _renderCaption();
}

// 어떤 값이 '켜짐'인지 판정 — 다중이면 배열 포함(none=배열 빔), 단일이면 값 일치
function _isPressed(oRow, sValue) {
    if (oRow && oRow.multi) {
        var aSel = Array.isArray(oState[oRow.key]) ? oState[oRow.key] : [];
        return (sValue === "none") ? (aSel.length === 0) : (aSel.indexOf(sValue) >= 0);
    }
    return sValue === oState[oRow.key];
}

function _syncField(sKey) {
    var oField = document.querySelector('[data-fwx-row="' + sKey + '"]');
    if (!oField) { return; }
    var oRow = oRowByKey[sKey];
    Array.prototype.forEach.call(oField.querySelectorAll("[data-value]"), function (oBtn) {
        oBtn.setAttribute("aria-pressed", _isPressed(oRow, oBtn.dataset.value) ? "true" : "false");
    });
    var oVal = oField.querySelector(".fwx-field__val");
    if (oVal) { oVal.textContent = _valueOf(sKey); }
}

function _select(oRow, sValue) {
    if (oRow.multi) {
        var aSel = Array.isArray(oState[oRow.key]) ? oState[oRow.key].slice() : [];
        if (sValue === "none") {
            aSel = [];                       // none = 전체 해제
        } else {
            var iAt = aSel.indexOf(sValue);
            if (iAt >= 0) { aSel.splice(iAt, 1); } else { aSel.push(sValue); }  // 토글
        }
        oState[oRow.key] = aSel;
    } else {
        oState[oRow.key] = sValue;
    }
    _syncField(oRow.key);
    _update();
}

function _reset() {
    _eachRow(function (oRow) {
        oState[oRow.key] = oRow.multi ? _multiInit(oRow.def) : oRow.def;
        var oField = oCustomFields[oRow.key];
        if (oField && oField.setValue) {
            try { oField.setValue(""); } catch (e) { _err("[HTML5][fontStyleWizard] custom reset failed", e); }
        }
        _syncField(oRow.key);
    });
    var oSample = document.getElementById("fwxSample");
    if (oSample) { oSample.textContent = SAMPLE_TEXT; }
    _update();
}

function _chipLabel(oRow, sValue) {
    if (sValue === "custom") { return "custom:"; }
    return (oRow.labels && oRow.labels[sValue]) ? oRow.labels[sValue] : sValue;
}

function _makeChip(oRow, sValue) {
    var oBtn = document.createElement("button");
    oBtn.type = "button";
    // 다중선택 속성(none 제외)은 체크박스형 칩 → 여러 개 동시 선택 가능함이 시각적으로 드러남
    oBtn.className = (oRow.multi && sValue !== "none") ? "fwx-chip fwx-chip--multi" : "fwx-chip";
    oBtn.dataset.value = sValue;
    oBtn.setAttribute("aria-pressed", _isPressed(oRow, sValue) ? "true" : "false");
    oBtn.textContent = _chipLabel(oRow, sValue);
    // 자기시연: 이 칩에 자기 값을 직접 스타일로 입힌다(custom 제외)
    if (DEMO_CSS[oRow.css] && sValue !== "custom") {
        try { oBtn.style[oRow.css] = sValue; } catch (e) { _err("[HTML5][fontStyleWizard] chip demo style failed", e); }
    }
    oBtn.addEventListener("click", function () { _select(oRow, sValue); });
    return oBtn;
}

function _makeIconBtn(oRow, sValue) {
    var oBtn = document.createElement("button");
    oBtn.type = "button";
    oBtn.className = "fwx-iconbtn";
    oBtn.dataset.value = sValue;
    oBtn.title = sValue;
    oBtn.setAttribute("aria-label", oRow.prop + " " + sValue);
    oBtn.setAttribute("aria-pressed", sValue === oRow.def ? "true" : "false");
    var oI = document.createElement("i");
    oI.className = "fa-solid " + (ALIGN_ICONS[sValue] || "fa-align-left");
    oI.setAttribute("aria-hidden", "true");
    oBtn.appendChild(oI);
    oBtn.addEventListener("click", function () { _select(oRow, sValue); });
    return oBtn;
}

function _buildField(oRow) {
    var oField = document.createElement("div");
    oField.className = "fwx-field";
    oField.dataset.fwxRow = oRow.key;

    var oTop = document.createElement("div");
    oTop.className = "fwx-field__top";
    var oProp = document.createElement("span");
    oProp.className = "fwx-field__prop";
    oProp.textContent = oRow.prop;
    oProp.setAttribute("data-tip", oRow.prop);
    oProp.setAttribute("data-tip-trunc", "");
    var oVal = document.createElement("span");
    oVal.className = "fwx-field__val";
    oVal.textContent = _valueOf(oRow.key);
    oTop.appendChild(oProp);
    oTop.appendChild(oVal);
    oField.appendChild(oTop);

    var oCtl = document.createElement("div");
    oCtl.className = "fwx-field__ctl";
    oRow.values.forEach(function (sValue) {
        oCtl.appendChild(oRow.control === "align" ? _makeIconBtn(oRow, sValue) : _makeChip(oRow, sValue));
        if (sValue === "custom") {
            var oHost = document.createElement("span");
            oHost.className = "fwx-custom";
            if (window.U4AUI && U4AUI.createField) {
                var oFieldCtl = U4AUI.createField({
                    clear: true,
                    placeholder: oRow.prop,
                    onInput: function () { if (oState[oRow.key] === "custom") { _update(); } },
                    onEnter: function () { _select(oRow, "custom"); },
                    onClear: function () { if (oState[oRow.key] === "custom") { _update(); } }
                });
                oCustomFields[oRow.key] = oFieldCtl;
                oHost.appendChild(oFieldCtl.el);
            } else {
                console.warn("[HTML5][fontStyleWizard] U4AUI.createField unavailable");
            }
            oCtl.appendChild(oHost);
        }
    });
    oField.appendChild(oCtl);

    // 컨텍스트 데모 — 블록 <p> 엔 안 먹는 속성(vertical-align)을 그 컨트롤 바로 아래 인라인 샘플로 시연
    if (oRow.demoInline) {
        var oDemo = document.createElement("div");
        oDemo.className = "fwx-vademo";
        oDemo.setAttribute("aria-label", oRow.prop + " preview");
        oDemo.appendChild(document.createTextNode("Ag "));
        var oInSpan = document.createElement("span");
        oInSpan.className = "sample";
        oInSpan.id = "fwxInlineSample";
        oInSpan.textContent = "Sample";
        oDemo.appendChild(oInSpan);
        oDemo.appendChild(document.createTextNode(" "));
        var oInImg = document.createElement("i");
        oInImg.className = "fa-regular fa-image fwx-imgsample";
        oInImg.id = "fwxImgSample";
        oInImg.setAttribute("role", "img");
        oInImg.setAttribute("aria-label", "image");
        oDemo.appendChild(oInImg);
        oDemo.appendChild(document.createTextNode(" Ag"));
        oField.appendChild(oDemo);
    }

    return oField;
}

function _buildGroups() {
    var oRoot = document.getElementById("fwxGroups");
    if (!oRoot) { return; }
    oRoot.innerHTML = "";
    aGroups.forEach(function (oGroup) {
        var oGroupEl = document.createElement("section");
        oGroupEl.className = "fwx-group";

        var oHead = document.createElement("div");
        oHead.className = "fwx-group__head";
        var oIcon = document.createElement("i");
        oIcon.className = "fa-solid " + (oGroup.icon || "fa-sliders");
        oIcon.setAttribute("aria-hidden", "true");
        var oName = document.createElement("span");
        oName.textContent = oGroup.title;
        oHead.appendChild(oIcon);
        oHead.appendChild(oName);
        oGroupEl.appendChild(oHead);

        oGroup.rows.forEach(function (oRow) { oGroupEl.appendChild(_buildField(oRow)); });
        oRoot.appendChild(oGroupEl);
    });
}

function _copySource() {
    var sText = _buildStyleSource(),
        bOk = false,
        oSrc = document.getElementById("fwxSource");
    try {
        if (CLIPBOARD && CLIPBOARD.writeText) { CLIPBOARD.writeText(sText); bOk = true; }
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
    try { if (window.U4ATheme) { U4ATheme.apply(oTheme.THEME); } }
    catch (e2) { _err("[HTML5][fontStyleWizard] theme apply failed", e2); }
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
    var oBtn = document.querySelector('#fwxTitlebar [data-action="max"] i');
    if (!oBtn) { return; }
    try {
        oBtn.className = CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize";
    } catch (e) { _err("[HTML5][fontStyleWizard] maximize icon sync failed", e); }
}

function _initChrome() {
    var oLogo = document.getElementById("fwxLogo");
    if (oLogo) {
        try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); }
        catch (e) { _err("[HTML5][fontStyleWizard] logo path failed", e); }
    }

    var oTitle = document.getElementById("fwxTitle");
    if (oTitle) {
        var sTitle = "";
        try { sTitle = document.title || CURRWIN.getTitle() || ""; }
        catch (e2) { _err("[HTML5][fontStyleWizard] title read failed", e2); }
        oTitle.textContent = sTitle || _msg("/U4A/CL_WS_COMMON", "B57") || "Font Style Wizard";
    }

    var oMin = document.querySelector('#fwxTitlebar [data-action="min"]');
    if (oMin) {
        oMin.addEventListener("click", function () {
            try { CURRWIN.minimize(); } catch (e) { _err("[HTML5][fontStyleWizard] minimize failed", e); }
        });
    }

    var oMax = document.querySelector('#fwxTitlebar [data-action="max"]');
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

    var oClose = document.querySelector('#fwxTitlebar [data-action="close"]');
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

    var oReset = document.getElementById("fwxResetBtn");
    if (oReset) { oReset.addEventListener("click", _reset); }

    var oCopy = document.getElementById("fwxCopyBtn");
    if (oCopy) { oCopy.addEventListener("click", _copySource); }

    try {
        if (window.U4AUI && U4AUI.initWindowFocusState) { U4AUI.initWindowFocusState(); }
        if (window.U4AUI && U4AUI.initTooltip) { U4AUI.initTooltip(); }
    } catch (e3) { _err("[HTML5][fontStyleWizard] common UX init failed", e3); }
}

window.addEventListener("load", function () {
    try { CURRWIN.setMenu(null); } catch (e) { _err("[HTML5][fontStyleWizard] menu clear failed", e); }

    _setBusy(true);
    _initState();
    _initChrome();
    _initBroadcast();
    _buildGroups();
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
};
