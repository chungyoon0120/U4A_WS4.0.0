/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : mimeRepository/mime.js
 * - file Desc : U4A MIME Repository 본문 (별도 BrowserWindow 판).
 * ----------------------------------------------------------------------
 *  인앱 .u4a-dialog 판(www/ws30/ws10_20/js/fnMimePopupOpen.js)의 트리/속성/미리보기/
 *  지연로드/컨텍스트메뉴/스플리터 로직을 1:1 이식. 차이점은 단 둘:
 *   ① 다이얼로그(showModal) 래퍼 제거 → 창(#mimeRoot)을 채우는 일반 레이아웃(창 타이틀바=frame.js).
 *   ② parent.*(WS20 런타임) 의존 → 창 자체 shim(frame.js 의 oAPP) + 자체 sendAjax.
 *  진입 = window.fnMimeStart() (frame.js 가 if-mime-info 수신 후 호출).
 ************************************************************************/

(function (window, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;
    var REMOTE = oAPP.REMOTE,
        CURRWIN = oAPP.CURRWIN;

    var U4AUI = window.U4AUI;

    var C_HOSTID = "U4AMIME",      // Monaco 호스트(iframe) 통신 채널 식별자
        C_PDFHOST = "U4AMIMEPDF";  // pdf.js 호스트(iframe) 통신 채널 식별자

    /************************************************************************
     * 서버 전송(원본 WS20 전역 sendAjax 대체) — FormData/GET, withCredentials.
     *   서명: sendAjax(sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob)
     *   bIsBlob === "X" → 응답을 Blob 으로(미리보기 getmimeobj). 그 외 → JSON 파싱.
     ************************************************************************/
    function sendAjax(sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob) {
        var xhr = new XMLHttpRequest();
        var sMeth = (meth || "POST").toString().toUpperCase();
        var bBlob = (bIsBlob === "X" || bIsBlob === true);
        xhr.withCredentials = true;
        try { xhr.open(sMeth, sPath, true); } catch (e) { if (typeof fn_error === "function") { fn_error(e); } return; }
        if (bBlob) { xhr.responseType = "blob"; }
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) { return; }
            if (xhr.status === 200 || xhr.status === 201) {
                try {
                    if (bBlob) { fn_success(xhr.response); }
                    else { fn_success(JSON.parse(xhr.response)); }
                } catch (e) {
                    console.error("[HTML5][MIME] 응답 파싱 오류:", e && e.message);
                    if (typeof fn_error === "function") { fn_error(e); }
                }
            } else {
                if (typeof fn_error === "function") { fn_error(xhr); }
            }
        };
        try { xhr.send(oFormData || null); } catch (e) { if (typeof fn_error === "function") { fn_error(e); } }
    }

    // ── 로컬 헬퍼 ─────────────────────────────────────────────────
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    function _wsTxt(sCode, p1) {
        try {
            var L = oAPP.attr.LANGU || "";
            return oAPP.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, p1 || "");
        } catch (e) { return ""; }
    }
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }
    function _fileUrl(p) { return "file:///" + encodeURI(String(p).replace(/\\/g, "/")); }

    // 현재 진입한 APP 정보 — opener 가 if-mime-info 로 전달(parent.getAppInfo()).
    function _appInfo() { return oAPP.attr.oAppInfo || {}; }

    // 셸 테마(다크/라이트)에 맞춘 Monaco 빌트인 테마 — body 배경 휘도로 판정.
    function _editorTheme() {
        try {
            var c = getComputedStyle(document.body).backgroundColor || "";
            var m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!m) { return "vs-dark"; }
            var lum = 0.299 * (+m[1]) + 0.587 * (+m[2]) + 0.114 * (+m[3]);
            return lum < 128 ? "vs-dark" : "vs";
        } catch (e) { return "vs-dark"; }
    }
    function _monacoThemeOf(sName) { return (typeof sName === "string" && /dark$/i.test(sName)) ? "vs-dark" : "vs"; }

    // Monaco 언어 결정 — 확장자 우선, 없으면 MIME 보조.
    function _langOf(sName, sMime) {
        var ext = String(sName || "").split(".").pop().toLowerCase();
        var M = {
            js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
            ts: "typescript", tsx: "typescript", json: "json", json5: "json",
            html: "html", htm: "html", xhtml: "html", vue: "html", svg: "xml", xml: "xml", xsl: "xml", wsdl: "xml",
            css: "css", scss: "scss", less: "less",
            py: "python", rb: "ruby", php: "php", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
            cs: "csharp", go: "go", rs: "rust", kt: "kotlin", swift: "swift", scala: "scala", dart: "dart", lua: "lua",
            sql: "sql", sh: "shell", bash: "shell", zsh: "shell", bat: "bat", cmd: "bat", ps1: "powershell",
            yaml: "yaml", yml: "yaml", toml: "ini", ini: "ini", conf: "ini", properties: "ini", env: "ini",
            md: "markdown", markdown: "markdown", txt: "plaintext", log: "plaintext", csv: "plaintext", tsv: "plaintext",
            dockerfile: "dockerfile", makefile: "makefile", abap: "abap", r: "r", pl: "perl", graphql: "graphql", gql: "graphql"
        };
        if (M[ext]) { return M[ext]; }
        var m = String(sMime || "").toLowerCase();
        if (/json/.test(m)) { return "json"; }
        if (/javascript|ecmascript/.test(m)) { return "javascript"; }
        if (/html/.test(m)) { return "html"; }
        if (/(^|\/)css/.test(m)) { return "css"; }
        if (/xml/.test(m)) { return "xml"; }
        return "plaintext";
    }

    function _mediaKind(sName, sMime) {
        var m = String(sMime || "").toLowerCase();
        if (m.indexOf("audio/") === 0) { return "audio"; }
        if (m.indexOf("video/") === 0) { return "video"; }
        var ext = String(sName || "").split(".").pop().toLowerCase();
        if (/^(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/.test(ext)) { return "audio"; }
        if (/^(mp4|m4v|webm|ogv|mov)$/.test(ext)) { return "video"; }
        return "";
    }

    // 비디오 Content-Type 보정(iframe 미디어문서 렌더 판정용) — 서버 타입이 video/* 면 그대로, 아니면 확장자로.
    function _videoMime(sName, sMime) {
        var m = String(sMime || "").toLowerCase();
        if (m.indexOf("video/") === 0) { return m; }
        var ext = String(sName || "").split(".").pop().toLowerCase();
        var map = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime" };
        return map[ext] || "video/mp4";
    }

    function _isBinaryMime(m) {
        m = String(m || "").toLowerCase();
        if (/^(audio|video|font|model)\//.test(m)) { return true; }
        return /^application\/(zip|x-zip|gzip|x-gzip|x-bzip2|x-7z|x-rar|x-tar|x-msdownload|x-shockwave-flash|java-archive|wasm|vnd\.|x-iso|x-apple|x-dosexec)/.test(m);
    }

    function _looksBinary(s) {
        if (s == null) { return true; }
        var n = Math.min(s.length, 4096), bad = 0;
        for (var i = 0; i < n; i++) {
            var c = s.charCodeAt(i);
            if (c === 0) { return true; }
            if (c === 0xFFFD) { bad++; }
        }
        return n > 0 && (bad / n) > 0.1;
    }

    /************************************************************************
     * 모듈 상태.
     ************************************************************************/
    var oUI = null;
    var oState = { sAppId: "", sLazy: false, oSel: null, selKey: "", pendingText: null, pendingPdf: null };
    var aTreeRoots = [];
    var oExpand = {};
    var iWatch = null;

    // busy/Lock — 원본 fnSetBusyLock 그대로(창 자체 오버레이).
    function lf_busy(b) { try { oAPP.common.fnSetBusyLock(b ? "X" : ""); } catch (e) { } }

    /* ── Monaco 호스트(iframe) 통신 ───────────────────────────────────── */
    function lf_toHost(oMsg) {
        try {
            oMsg = oMsg || {};
            oMsg.__u4ace = true;
            oMsg.hostId = C_HOSTID;
            if (oUI && oUI.frame && oUI.frame.contentWindow) { oUI.frame.contentWindow.postMessage(oMsg, "*"); }
        } catch (e) { }
    }
    function lf_onMessage(oEvent) {
        var d = oEvent && oEvent.data;
        if (!d) { return; }
        if (d.__u4apdf === true && d.hostId === C_PDFHOST) {
            if (d.evt === "ready") {
                if (oUI) { oUI.pdfReady = true; }
                if (oState.pendingPdf != null) { var ab = oState.pendingPdf; oState.pendingPdf = null; lf_pdfPost(ab); }
            }
            return;
        }
        if (d.__u4ace !== true || d.hostId !== C_HOSTID) { return; }
        if (d.evt === "ready") {
            if (oUI) { oUI.hostReady = true; }
            if (oState.pendingText != null) {
                var p = oState.pendingText; oState.pendingText = null;
                lf_toHost({ cmd: "setLanguage", language: p.lang });
                lf_toHost({ cmd: "setReadOnly", readOnly: true });
                lf_toHost({ cmd: "setValue", value: p.text });
                lf_toHost({ cmd: "layout" });
            }
            return;
        }
    }
    function lf_onThemeChange(oEvt) {
        var sName = (oEvt && oEvt.detail && oEvt.detail.name) || "";
        lf_toHost({ cmd: "setTheme", theme: _monacoThemeOf(sName) });
    }

    /************************************************************************
     * 평면(CHILD/PARENT) 배열 → 계층(MIMETREE children) 변환(원본 fnSetTreeJson 동일).
     ************************************************************************/
    function _buildTree(aFlat) {
        if (!Array.isArray(aFlat) || aFlat.length === 0) { return []; }
        var n = JSON.parse(JSON.stringify(aFlat));
        var a = [], c = {};
        for (var o = 0, f = n.length; o < f; o++) {
            var e = n[o], h = e.CHILD, u = e.PARENT || 0;
            c[h] = c[h] || [];
            e.MIMETREE = c[h];
            if (u !== 0) { c[u] = c[u] || []; c[u].push(e); }
            else { a.push(e); }
        }
        return a;
    }

    function _markMyAppChild(aFlat) {
        var oMyApp = aFlat.find(function (r) { return r && r.MYAPP === "X"; });
        if (!oMyApp) { return aFlat; }
        (function rec(sChildKey) {
            var aChildren = aFlat.filter(function (r) { return r.PARENT === sChildKey; });
            for (var i = 0; i < aChildren.length; i++) {
                aChildren[i].MYAPPCHILD = "X";
                rec(aChildren[i].CHILD);
            }
        })(oMyApp.CHILD);
        return aFlat;
    }

    /************************************************************************
     * Mime Tree 데이터 로드 — GET /getmimetree?APPID (원본 fnGetMimeTreeData 1:1).
     ************************************************************************/
    function lf_loadTree() {

        lf_busy(true);

        var oApp = _appInfo();
        oState.sAppId = oApp.APPID || "";

        var sPath = oAPP.fn.getServerPath() + "/getmimetree?APPID=" + oState.sAppId;

        sendAjax(sPath, null, lf_success, null, true, "GET");

        function lf_success(oResult) {

            if (!oResult || oResult.RETCD === "E") {
                console.log([
                    "[PATH]: www/ws30/ws10_20/Popups/mimeRepository/mime.js",
                    "=> lf_loadTree => lf_success",
                    "[LOG]: Mime Data Not Found"
                ].join("\r\n"));
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
                lf_busy(false);
                return;
            }

            var aFlat = oResult.MIMETREE || [];

            oState.sLazy = false;
            try { oState.sLazy = (oAPP.fn.checkWLOList() === true); } catch (e) { oState.sLazy = false; }
            if (oState.sLazy) {
                var aHasChild = aFlat.filter(function (e) { return e && e.ISECD === "X"; });
                for (var i = 0; i < aHasChild.length; i++) {
                    var oHas = aHasChild[i];
                    if (oHas.ZLEVEL !== 3) { continue; }
                    if (oHas.NTEXT === oState.sAppId) { continue; }
                    aFlat.push({ PARENT: oHas.CHILD, CHILD: "DUMMY_CHILD", NTEXT: _wsTxt("312") });
                }
            }

            aFlat = _markMyAppChild(aFlat);
            aTreeRoots = _buildTree(aFlat);

            oExpand = {};
            for (var r = 0; r < aTreeRoots.length; r++) { oExpand[aTreeRoots[r].CHILD] = true; }

            oUI.tree.render();

            lf_expandMyApp(aFlat);

            if (aFlat.findIndex(function (a) { return a.MYAPP === "X"; }) === -1) {
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                var sMsg = _txt("/U4A/CL_WS_COMMON", "D00") + " " + _txt("/U4A/CL_WS_COMMON", "A30");
                sMsg = _txt("/U4A/MSG_WS", "196", sMsg);
                try { oAPP.fn.showMessage(null, 10, "E", sMsg); } catch (e) { }
            }

            lf_busy(false);
        }
    }

    /************************************************************************
     * My APP 폴더 조상 경로 펼침 + 선택/스크롤.
     ************************************************************************/
    function lf_expandMyApp(aFlat) {
        var oMyApp = aFlat.find(function (r) { return r && r.MYAPP === "X"; });
        oState.myAppKey = oMyApp ? oMyApp.CHILD : "";
        oState.myAppPath = [];
        if (oUI && oUI.myAppBtn) { oUI.myAppBtn.hidden = !oState.myAppKey; }
        if (!oMyApp) {
            if (aTreeRoots[0]) { oState.selKey = aTreeRoots[0].CHILD; oUI.tree.render(); lf_autoSelect(aTreeRoots[0].CHILD); }
            return;
        }
        var byKey = {};
        aFlat.forEach(function (r) { byKey[r.CHILD] = r; });
        var cur = byKey[oMyApp.PARENT];
        while (cur) { oState.myAppPath.push(cur.CHILD); cur = byKey[cur.PARENT]; }
        if (aFlat.some(function (r) { return r.PARENT === oMyApp.CHILD; })) { oState.myAppPath.push(oMyApp.CHILD); }
        lf_gotoMyApp();
    }

    // 트리 데이터(aTreeRoots)에서 key 로 노드 찾기(자동 선택 시 속성 채우기용).
    function _findNodeByKey(sKey) {
        var oFound = null;
        _walkNodes(aTreeRoots, function (n) { if (!oFound && n && _key(n) === sKey) { oFound = n; } });
        return oFound;
    }

    // 자동 선택된 노드(선택표시 + selKey)에 대해 우측 속성을 채운다(클릭과 동일 효과, oRow 없으면 selKey 강조 유지).
    function lf_autoSelect(sKey) {
        var oNode = _findNodeByKey(sKey);
        if (!oNode) { return; }
        var oRow = null;
        try { oRow = oUI.treeBody.querySelector('.u4a-tree__row[aria-selected="true"]'); } catch (e) { }
        lf_onRowSelect(oNode, oRow);
    }

    function lf_gotoMyApp() {
        if (!oState.myAppKey) { return; }
        (oState.myAppPath || []).forEach(function (k) { oExpand[k] = true; });
        oState.selKey = oState.myAppKey;
        oUI.tree.render();
        oUI.tree.scrollToKey(oState.myAppKey);
        lf_autoSelect(oState.myAppKey);   // 우측 속성까지 자동 출력
    }

    /************************************************************************
     * 지연 로드 — DUMMY_CHILD 가 있으면 자식 마임을 서버에서 구해 교체.
     ************************************************************************/
    function _getMimeChildData(oSelNode) {
        return new Promise(function (resolve) {
            var sPath = oAPP.fn.getServerPath() + "/get_mime_children",
                oFormData = new FormData();
            oFormData.append("MIME_DATA", JSON.stringify(oSelNode));
            sendAjax(sPath, oFormData, function (oResult) { resolve(oResult); },
                null, null, "POST", function () { resolve({ RETCD: "E" }); });
        });
    }
    function _buildChildrenFromResult(oNode, oRes) {
        if (!oRes || oRes.RETCD === "E") { return false; }
        var aChildData = (oRes.T_MIME_CHILD || []).slice();
        var oCopy = JSON.parse(JSON.stringify(oNode));
        oCopy.PARENT = "";
        aChildData.push(oCopy);
        var aRoots = _buildTree(aChildData);
        var oRoot = aRoots[0];
        oNode.MIMETREE = (oRoot && oRoot.MIMETREE) ? oRoot.MIMETREE : [];
        if (oNode.MIMETREE.length === 0) {
            oNode.MIMETREE.push({ PARENT: oNode.CHILD, CHILD: "DUMMY_CHILD", NTEXT: _wsTxt("312") });
        }
        return true;
    }
    function lf_lazyExpand(oNode) {
        return new Promise(function (resolve) {
            var aChild = oNode.MIMETREE || [];
            var bHasDummy = aChild.some(function (e) { return e && e.CHILD === "DUMMY_CHILD"; });
            if (!bHasDummy) { resolve(false); return; }

            lf_busy(true);
            _getMimeChildData(oNode).then(function (oRes) {

                if (!oRes || oRes.RETCD === "E") {
                    var sRetMsg, aLog = ["[PATH]: www/ws30/ws10_20/Popups/mimeRepository/mime.js", "=> lf_lazyExpand"];
                    switch (oRes && oRes.STCOD) {
                        case "E001": sRetMsg = _wsTxt("313"); aLog.push("=> 파라미터 필수 누락"); break;
                        case "E002": sRetMsg = _wsTxt("313"); aLog.push("=> 서버 마임 정보 구성 오류"); break;
                        default: sRetMsg = _wsTxt("314"); aLog.push("=> 알 수 없는 오류"); break;
                    }
                    console.error(aLog.join("\r\n"));
                    sRetMsg = sRetMsg + "\n\n" + _wsTxt("228");
                    try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                    try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
                    try { oAPP.fn.showMessage(null, 20, "E", sRetMsg); } catch (e) { }
                    lf_busy(false);
                    resolve(false);
                    return;
                }

                _buildChildrenFromResult(oNode, oRes);

                oUI.tree.render();
                lf_busy(false);
                resolve(true);
            });
        });
    }

    /************************************************************************
     * 공통 트리(가상스크롤) 생성.
     ************************************************************************/
    function _key(n) { return (n && n.CHILD != null) ? String(n.CHILD) : ""; }
    function _isDummy(n) { return n && n.CHILD === "DUMMY_CHILD"; }

    function lf_buildTreeCmp() {

        var oTree = U4AUI.createTree({
            virtual: true,

            roots: function () { return aTreeRoots; },
            children: function (n) { return (n && Array.isArray(n.MIMETREE)) ? n.MIMETREE : []; },
            key: _key,
            label: function (n) { return (n && n.NTEXT != null) ? n.NTEXT : ""; },
            tip: function (n) { return (n && n.NTEXT != null) ? String(n.NTEXT) : ""; },
            hasChildren: function (n) { return !!(n && Array.isArray(n.MIMETREE) && n.MIMETREE.length > 0); },

            // 폴더 아이콘 — 항상 fa-folder 만 렌더(서버리스트 동일). 열림 전환(\f07c)·앰버색·선택 액센트는
            //   공통 표준 CSS(shell.css .u4a-tree__icon .fa-folder)가 aria-expanded/selected 로 처리.
            icon: function (n) {
                if (_isDummy(n) || !_isFolder(n)) { return ""; }
                return _fa("folder");
            },

            isExpanded: function (n) {
                var k = _key(n);
                return oExpand[k] === true;
            },
            onToggle: function (n, bOpen) {
                oExpand[_key(n)] = !!bOpen;
                if (bOpen && oState.sLazy) {
                    var aChild = (n && n.MIMETREE) || [];
                    if (aChild.some(function (e) { return e && e.CHILD === "DUMMY_CHILD"; })) {
                        lf_lazyExpand(n);
                    }
                }
            },

            slotTrailing: function (n) {
                if (_isDummy(n)) { return null; }
                var d = _el("span", "u4aMimeDesc");
                var t = _el("span", "u4aMimeDescText", (n && n.MDESC != null) ? n.MDESC : "");
                // 설명 말줄임 시 공통 테마 툴팁(initTooltip) — data-tip + data-tip-trunc(잘렸을 때만).
                if (n && n.MDESC) { t.setAttribute("data-tip", n.MDESC); t.setAttribute("data-tip-trunc", ""); }
                d.appendChild(t);
                return d;
            },

            onSelect: function (n, oRow) {
                if (_isDummy(n)) { return; }
                lf_onRowSelect(n, oRow);
            },

            rowHook: function (oRow, n) {
                oRow.classList.add("u4aMimeRow");
                if (_isDummy(n)) {
                    oRow.classList.add("u4aMimeNoData");
                    oRow.setAttribute("aria-disabled", "true");
                    return;
                }
                oRow.__mimeNode = n;
                // 이름 말줄임 툴팁은 공통 createTree(tip) 가 행에 data-tip + data-tip-trunc-sel 로 이미 처리(중복 배선 금지).
                if (oState.selKey && _key(n) === oState.selKey) { oRow.setAttribute("aria-selected", "true"); }
                var z = n.ZLEVEL, my = n.MYAPP, myc = n.MYAPPCHILD, ty = n.TYPE;
                if (z == 1) { /* 시스템 루트 = 또렷(기본) */ }
                else if (z == 2) { oRow.classList.add("u4aMimeMuted"); }
                else if (my === "X") { oRow.classList.add("u4aMimeMyApp"); }   // 행 전체 solid accent 강조(mime.css)
                else if (myc === "X") { /* 내 APP 하위 = 또렷(기본) */ }
                else if (ty === "F") { oRow.classList.add("u4aMimeMuted"); }
            }
        });

        oTree.el.classList.add("u4aMimeTree");
        return oTree;
    }

    function lf_selNode() {
        try {
            var oRow = oUI.treeBody.querySelector('.u4a-tree__row[aria-selected="true"]');
            if (oRow && oRow.__mimeNode) { return oRow.__mimeNode; }
        } catch (e) { }
        return oState.oSel;
    }

    /************************************************************************
     * 트리 행 선택 → 속성 채우기 + 미리보기.
     ************************************************************************/
    function lf_markSelectedRow(oRow) {
        if (!oUI || !oUI.treeBody) { return; }
        var aSel = oUI.treeBody.querySelectorAll('.u4a-tree__row[aria-selected="true"]');
        for (var i = 0; i < aSel.length; i++) { if (aSel[i] !== oRow) { aSel[i].removeAttribute("aria-selected"); } }
        if (oRow) { oRow.setAttribute("aria-selected", "true"); }
    }

    // 폴더 판별 — 원본: TYPE=='F'(폴더) 또는 FOLDER=='X'.
    function _isFolder(n) { return !!(n && (n.TYPE === "F" || n.FOLDER === "X")); }

    function lf_onRowSelect(oNode, oRow) {

        oState.oSel = oNode;
        oState.selKey = _key(oNode);

        // 클릭 경로는 oRow 직접 강조. 자동선택(oRow 없음)은 selKey+rowHook 가 강조하므로 건드리지 않음.
        if (oRow) { lf_markSelectedRow(oRow); }

        lf_setProps({});
        lf_showPreview("none");

        if (!oNode) { return; }

        // 유형(Type=A51) 표시 — 폴더(D45)/파일(B79). 폴더/파일 공통.
        var bFolder = _isFolder(oNode);
        var sType = bFolder ? _txt("/U4A/CL_WS_COMMON", "D45") : _txt("/U4A/CL_WS_COMMON", "B79"); // Folder / File

        if (bFolder) {
            // 폴더 — 유형/이름/URL(폴더 경로)/생성정보. 미리보기는 없음(폴더).
            lf_setProps({ TYPE: sType, NAME: oNode.NTEXT, URL: oNode.URL, ERDAT: oNode.ERDAT, ERZET: oNode.ERZET, ERNAM: oNode.ERNAM });
            return;
        }

        // 파일 — 유형/이름/URL/생성 + 미리보기.
        lf_setProps({ TYPE: sType, NAME: oNode.NTEXT, URL: oNode.URL, ERDAT: oNode.ERDAT, ERZET: oNode.ERZET, ERNAM: oNode.ERNAM });

        var fnGet = function () { lf_getMimeObject(oNode.URL, lf_preview); };
        try {
            if (oAPP.fn.sendAjaxLoginChk) {
                oAPP.fn.sendAjaxLoginChk(function (oReturn) {
                    if (!oReturn || oReturn.RETCD !== "S") { try { oAPP.fn.setBusy(""); } catch (e) { } return; }
                    fnGet();
                });
            } else { fnGet(); }
        } catch (e) { fnGet(); }
    }

    // POST /getmimeobj → blob (원본 fnGetMimeObject).
    function lf_getMimeObject(sUrl, fnSuccess) {
        var sPath = oAPP.fn.getServerPath() + "/getmimeobj",
            oFormData = new FormData();
        oFormData.append("URL", sUrl);
        try { oAPP.fn.setBusy("X"); } catch (e) { }
        sendAjax(sPath, oFormData, fnSuccess, null, null, "POST", null, "X");
    }

    // blob → 미리보기. ★MIME 기반 분기★.
    function lf_preview(oBlob) {
        if (!oBlob || oBlob.size === 0) { try { oAPP.fn.setBusy(""); } catch (e) { } return; }

        var sMime = String(oBlob.type || "").toLowerCase();
        var sName = (oState.oSel && oState.oSel.NTEXT) || "";

        if (sMime.indexOf("image/") === 0) {
            lf_showPreview("image", URL.createObjectURL(oBlob));
            try { oAPP.fn.setBusy(""); } catch (e2) { }
            return;
        }

        var sMedia = _mediaKind(sName, sMime);
        if (sMedia === "video") {
            // iframe(미디어 문서)는 blob 의 Content-Type 으로 렌더를 판정하므로 video/* 로 보정
            // (서버가 octet-stream 으로 줄 때 대비). 타입이 이미 맞으면 그대로(불필요 복사 방지).
            var sVType = _videoMime(sName, sMime);
            var oVBlob = (String(oBlob.type).toLowerCase() === sVType) ? oBlob : new Blob([oBlob], { type: sVType });
            lf_showPreview("video", URL.createObjectURL(oVBlob));
            try { oAPP.fn.setBusy(""); } catch (e2) { }
            return;
        }
        if (sMedia === "audio") {
            lf_showPreview("audio", URL.createObjectURL(oBlob));
            try { oAPP.fn.setBusy(""); } catch (e2) { }
            return;
        }

        if (sMime === "application/pdf" || /\.pdf$/i.test(sName)) {
            lf_showPdf(oBlob);
            return;
        }

        if (_isBinaryMime(sMime)) {
            lf_showPreview("none");
            try { oAPP.fn.setBusy(""); } catch (e2) { }
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            var sText = e.target.result;
            if (_looksBinary(sText)) {
                lf_showPreview("none");
            } else {
                lf_showPreview("text", { text: sText, lang: _langOf(sName, sMime) });
            }
            try { oAPP.fn.setBusy(""); } catch (e2) { }
        };
        reader.onerror = function () { lf_showPreview("none"); try { oAPP.fn.setBusy(""); } catch (e2) { } };
        reader.readAsText(oBlob, "UTF-8");
    }

    // PDF 호스트(iframe) URL — pdf.js 호스트(자체 렌더). 절대경로 → file:// URL.
    function lf_pdfHostUrl() {
        var oQ = encodeURIComponent(JSON.stringify({ HOSTID: C_PDFHOST, THEME: _editorTheme() }));
        var sSrc;
        try { sSrc = _fileUrl(oAPP.PATH.join(oAPP.PATHINFO.JS_ROOT, "pdfviewer", "index.html")); }
        catch (e) { sSrc = "../../js/pdfviewer/index.html"; }
        return sSrc + "?PARAMS=" + oQ;
    }
    function lf_pdfPost(ab) {
        try {
            if (oUI && oUI.pdf && oUI.pdf.contentWindow) {
                oUI.pdf.contentWindow.postMessage({ __u4apdf: true, hostId: C_PDFHOST, cmd: "open", data: ab }, "*", [ab]);
            }
        } catch (e) { console.error("[HTML5][MIME] pdf post error:", e); }
    }

    function lf_showPdf(oBlob) {
        oBlob.arrayBuffer().then(function (ab) {
            lf_showPreview("pdf");
            if (!oUI.pdf.getAttribute("src")) { oUI.pdf.src = lf_pdfHostUrl(); }
            if (oUI.pdfReady) { lf_pdfPost(ab); }
            else { oState.pendingPdf = ab; }
            try { oAPP.fn.setBusy(""); } catch (e) { }
        }).catch(function () {
            lf_showPreview("none");
            try { oAPP.fn.setBusy(""); } catch (e) { }
        });
    }

    // 미리보기 표시 전환 — image | audio | video | pdf | text | none.
    function lf_showPreview(sMode, oPayload) {
        if (!oUI) { return; }

        if (oUI._objUrl) { try { URL.revokeObjectURL(oUI._objUrl); } catch (e) { } oUI._objUrl = null; }

        var bImg = sMode === "image", bAudio = sMode === "audio", bVideo = sMode === "video",
            bPdf = sMode === "pdf", bText = sMode === "text";
        oUI.img.hidden = !bImg;
        oUI.audio.hidden = !bAudio;
        oUI.video.hidden = !bVideo;
        oUI.pdf.hidden = !bPdf;
        oUI.frame.hidden = !bText;
        oUI.nodata.hidden = !(sMode === "none");

        if (!bImg) { oUI.img.src = ""; }
        if (!bAudio) { try { oUI.audio.pause(); } catch (e) { } oUI.audio.removeAttribute("src"); }
        if (!bVideo) { try { if (oUI.video.getAttribute("src")) { oUI.video.src = "about:blank"; } } catch (e) { } } // iframe 언로드(재생 정지)
        if (!bPdf && oUI.pdf && oUI.pdf.contentWindow && oUI.pdfReady) {
            try { oUI.pdf.contentWindow.postMessage({ __u4apdf: true, hostId: C_PDFHOST, cmd: "clear" }, "*"); } catch (e) { }
        }

        if (bImg) {
            oUI._objUrl = (oPayload && oPayload.indexOf("blob:") === 0) ? oPayload : null;
            oUI.img.src = oPayload || "";
            return;
        }
        if (bAudio) {
            oUI._objUrl = (oPayload && oPayload.indexOf("blob:") === 0) ? oPayload : null;
            oUI.audio.src = oPayload || "";
            return;
        }
        if (bVideo) {
            oUI._objUrl = (oPayload && oPayload.indexOf("blob:") === 0) ? oPayload : null;
            oUI.video.src = oPayload || "";
            return;
        }
        if (bPdf) {
            return;
        }
        if (bText) {
            if (oUI.hostReady) {
                lf_toHost({ cmd: "setLanguage", language: oPayload.lang });
                lf_toHost({ cmd: "setReadOnly", readOnly: true });
                lf_toHost({ cmd: "setValue", value: oPayload.text });
                lf_toHost({ cmd: "layout" });
            } else {
                oState.pendingText = oPayload;
            }
            return;
        }
    }

    /************************************************************************
     * 속성 패널 값 세팅.
     ************************************************************************/
    function _fmtDate(v) {
        if (!v) { return ""; }
        return v.substring(0, 4) + "-" + v.substring(4, 6) + "-" + v.substring(6, 8);
    }
    function _fmtTime(v) {
        if (!v) { return ""; }
        return v.substring(0, 2) + ":" + v.substring(2, 4) + ":" + v.substring(4, 6);
    }
    // 입력칸 말줄임 시 공통 테마 툴팁(initTooltip) — data-tip + data-tip-trunc(잘렸을 때만).
    function _setFieldTip(oField, sVal) {
        if (oField && oField.input) { oField.input.setAttribute("data-tip", sVal || ""); oField.input.setAttribute("data-tip-trunc", ""); }
    }
    function lf_setProps(o) {
        if (!oUI) { return; }
        if (oUI.typeField) { oUI.typeField.setValue(o.TYPE || ""); }   // 유형(폴더/파일)
        oUI.fileField.setValue(o.NAME || "");
        _setFieldTip(oUI.fileField, o.NAME);
        oUI.urlField.setValue(o.URL || "");
        _setFieldTip(oUI.urlField, o.URL);
        oUI.dateField.setValue(_fmtDate(o.ERDAT));
        oUI.timeField.setValue(_fmtTime(o.ERZET));
        oUI.nameField.setValue(o.ERNAM || "");
        _setFieldTip(oUI.nameField, o.ERNAM);
    }

    /************************************************************************
     * URL Copy.
     ************************************************************************/
    function lf_urlCopy() {
        var sVal = oUI.urlField.getValue();
        if (!sVal) { return; }
        try {
            var oInput = oUI.urlField.input;
            oInput.removeAttribute("readonly");
            oInput.select();
            document.execCommand("copy");
            try { oInput.setSelectionRange(0, 0); } catch (e) { }
            oInput.setAttribute("readonly", "readonly");
        } catch (e) {
            try {
                var ta = document.createElement("textarea");
                ta.value = sVal; document.body.appendChild(ta); ta.select();
                document.execCommand("copy"); document.body.removeChild(ta);
            } catch (e2) { }
        }
        try { oAPP.fn.showMessage(null, 10, "S", _txt("/U4A/MSG_WS", "303")); } catch (e) { }
    }

    /************************************************************************
     * 펼치기/접기(서브트리).
     ************************************************************************/
    function _walkNodes(aNodes, fn) {
        if (!Array.isArray(aNodes)) { return; }
        for (var i = 0; i < aNodes.length; i++) {
            var n = aNodes[i];
            if (!n) { continue; }
            fn(n);
            _walkNodes(n.MIMETREE, fn);
        }
    }
    function _hasRealKids(n) {
        return !!(n && Array.isArray(n.MIMETREE) && n.MIMETREE.some(function (c) { return c && c.CHILD !== "DUMMY_CHILD"; }));
    }
    function _hasDummy(n) { return !!(n && Array.isArray(n.MIMETREE) && n.MIMETREE.some(function (e) { return e && e.CHILD === "DUMMY_CHILD"; })); }

    function lf_expandSel() {
        var n = lf_selNode();
        if (!n) { return; }
        if (n.ZLEVEL === 1 || n.ZLEVEL === 2) {
            _walkNodes(aTreeRoots, function (x) { if (_hasRealKids(x)) { oExpand[x.CHILD] = true; } });
            oUI.tree.render();
            return;
        }
        lf_expandSubtreeLazy(n);
    }

    function lf_expandSubtreeLazy(oNode) {
        if (!oNode) { return; }
        lf_busy(true);
        var iPending = 0;
        function _done() { if (iPending === 0) { oUI.tree.render(); lf_busy(false); } }
        function step(n) {
            if (!n || n.CHILD === "DUMMY_CHILD") { return; }
            if (oState.sLazy && _hasDummy(n)) {
                iPending++;
                _getMimeChildData(n).then(function (oRes) {
                    if (_buildChildrenFromResult(n, oRes) && _hasRealKids(n)) {
                        oExpand[n.CHILD] = true;
                        n.MIMETREE.forEach(step);
                    }
                    iPending--; _done();
                });
                return;
            }
            if (_hasRealKids(n)) {
                oExpand[n.CHILD] = true;
                n.MIMETREE.forEach(step);
            }
        }
        step(oNode);
        _done();
    }
    function lf_collapseSel() {
        var n = lf_selNode();
        if (!n) { return; }
        oExpand[n.CHILD] = false;
        oUI.tree.render();
    }

    /************************************************************************
     * 우클릭 컨텍스트 메뉴 — 별도창이라 top-layer 꼼수 불필요(document.body 에 append).
     ************************************************************************/
    function _isEdit() { var o = _appInfo(); return !!(o && o.IS_EDIT === "X"); }

    function _mimeMenuDef() {
        return [
            // ★ 펼치기/접기(K1/K2) — 대량 서버 호출 우려로 우선 숨김(VISIBLE:false). 재활성화 = true 로.
            { KEY: "K1", TXT: _txt("/U4A/CL_WS_COMMON", "C27"), FA: "angles-down", ISSTART: false, VISIBLE: false, ENABLED: true },
            { KEY: "K2", TXT: _txt("/U4A/CL_WS_COMMON", "C28"), FA: "angles-up", ISSTART: false, VISIBLE: false, ENABLED: true },
            { KEY: "K3", TXT: _txt("/U4A/CL_WS_COMMON", "C29"), FA: "folder-plus", ISSTART: true, VISIBLE: true, ENABLED: true },
            { KEY: "K4", TXT: _txt("/U4A/CL_WS_COMMON", "C30"), FA: "trash", ISSTART: false, VISIBLE: true, ENABLED: true },
            { KEY: "K5", TXT: _txt("/U4A/CL_WS_COMMON", "C31"), FA: "file-import", ISSTART: false, VISIBLE: true, ENABLED: true },
            { KEY: "K6", TXT: _txt("/U4A/CL_WS_COMMON", "C32"), FA: "download", ISSTART: false, VISIBLE: true, ENABLED: true }
        ];
    }

    function _applyMimeMenu(a, n) {
        function E(k, b) { for (var i = 0; i < a.length; i++) { if (a[i].KEY === k) { a[i].ENABLED = b; return; } } }
        function V(k, b) { for (var i = 0; i < a.length; i++) { if (a[i].KEY === k) { a[i].VISIBLE = b; return; } } }
        var my = n.MYAPP, myc = n.MYAPPCHILD, ty = n.TYPE;
        if (_isEdit()) {
            if (my === "X") { E("K4", false); E("K6", false); return; }
            if (myc === "X") {
                if (ty === "F") { E("K6", false); return; }
                V("K1", false); V("K2", false); E("K3", false); E("K5", false); return;
            }
            if (ty === "F") { E("K3", false); E("K4", false); E("K5", false); E("K6", false); return; }
            V("K1", false); V("K2", false); E("K3", false); E("K4", false); E("K5", false); return;
        }
        if (ty === "F") { V("K1", false); V("K2", false); E("K3", false); E("K4", false); E("K5", false); E("K6", false); return; }
        V("K1", false); V("K2", false); E("K3", false); E("K4", false); E("K5", false); E("K6", true);
    }

    var _ctxEl = null;
    function _closeMimeMenu() {
        if (_ctxEl && _ctxEl.parentNode) { _ctxEl.parentNode.removeChild(_ctxEl); }
        _ctxEl = null;
        document.removeEventListener("mousedown", _onCtxDown, true);
        document.removeEventListener("keydown", _onCtxKey, true);
        window.removeEventListener("scroll", _closeMimeMenu, true);
        window.removeEventListener("resize", _closeMimeMenu, true);
    }
    function _onCtxDown(ev) { if (_ctxEl && !_ctxEl.contains(ev.target)) { _closeMimeMenu(); } }
    function _onCtxKey(ev) { if (ev.key === "Escape") { _closeMimeMenu(); } }

    function _openMimeMenu(iX, iY, n) {
        _closeMimeMenu();
        var a = _mimeMenuDef();
        _applyMimeMenu(a, n);

        var oWrap = _el("div", "u4a-menu");
        oWrap.setAttribute("role", "menu");
        var bAny = false;
        a.forEach(function (mi) {
            if (!mi.VISIBLE) { return; }
            if (mi.ISSTART && bAny) { oWrap.appendChild(_el("div", "u4a-menu__sep")); }
            var oItem = _el("div", "u4a-menu__item");
            oItem.setAttribute("role", "menuitem");
            if (mi.ENABLED === false) { oItem.setAttribute("aria-disabled", "true"); }
            oItem.innerHTML = _fa(mi.FA) + '<span class="u4a-menu__item-text"></span>';
            oItem.querySelector(".u4a-menu__item-text").textContent = mi.TXT;
            if (mi.ENABLED !== false) {
                oItem.addEventListener("click", function () { _closeMimeMenu(); _ctxDispatch(mi.KEY, n); });
            }
            oWrap.appendChild(oItem);
            bAny = true;
        });
        if (!bAny) { return; }

        oWrap.style.visibility = "hidden";
        document.body.appendChild(oWrap);
        var iW = oWrap.offsetWidth, iH = oWrap.offsetHeight, iVw = window.innerWidth, iVh = window.innerHeight;
        var iLeft = (iX + iW + 4 <= iVw) ? iX : (iX - iW); if (iLeft < 4) { iLeft = 4; }
        var iTop = (iY + iH + 4 <= iVh) ? iY : (iY - iH); if (iTop < 4) { iTop = 4; }
        if (iTop + iH + 4 > iVh) { iTop = Math.max(4, iVh - iH - 4); }
        oWrap.style.left = iLeft + "px";
        oWrap.style.top = iTop + "px";
        oWrap.style.visibility = "";
        _ctxEl = oWrap;

        document.addEventListener("mousedown", _onCtxDown, true);
        document.addEventListener("keydown", _onCtxKey, true);
        window.addEventListener("scroll", _closeMimeMenu, true);
        window.addEventListener("resize", _closeMimeMenu, true);
    }

    function _ctxDispatch(sKey, n) {
        try {
            if (sKey === "K1") { lf_expandSel(); return; }
            if (sKey === "K2") { lf_collapseSel(); return; }
            if (sKey === "K3") { lf_openCreateFolder(n); return; }   // 폴더 생성
            if (sKey === "K4") { lf_deleteObject(n); return; }       // 오브젝트 삭제
            if (sKey === "K5") { lf_openImport(n); return; }         // 마임 오브젝트 가져오기
            if (sKey === "K6") { lf_downloadObject(n); return; }     // 마임 오브젝트 다운로드
        } catch (e) { console.error("[HTML5][MIME] 컨텍스트 메뉴 오류:", sKey, e); }
    }

    /************************************************************************
     * 폴더 생성(K3) — 원본 fnMimeTreeCreateFolder + ev_createMimeFolderEvent +
     *   fnMimeFolderCreateSuccess 1:1 이식. 공통 .u4a-dialog(showModal, 창 top-layer) + createField.
     *   검증=폴더명 필수(MSG_WS 050). 서버: POST /set_mime_crud
     *     { MIMEINFO: {TRCOD:"C", OBJTYPE:"FOLD", FLDNM, FLDPATH(=부모 URL), DESC, DEVPKG, REQNO, CONTENT:"", CLSID} }
     *   성공 시 반환 노드(oResult.MIMETREE)를 부모 하위에 추가 + 펼침/선택(원본 fnMimeFolderCreateSuccess).
     ************************************************************************/
    var oCrUI = null;

    function lf_openCreateFolder(oNode) {
        if (!oNode) { return; }
        lf_closeCreateFolder();                 // 혹시 떠있던 이전 팝업 정리
        lf_buildCreateFolder(oNode);            // ★ 매번 새로 생성(재사용 안 함 → 재오픈 안 되던 버그 제거)
        try { oCrUI.dlg.showModal(); } catch (e) { console.error("[HTML5][MIME] 폴더생성 showModal:", e); }
        setTimeout(function () { try { if (oCrUI) { oCrUI.nameField.focus(); } } catch (e) { } }, 0);
    }

    function lf_buildCreateFolder(oNode) {

        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aMimeCrDlg";

        // 헤더 — add-folder 아이콘 + "[U4A] MIME Folder Create"(A30+A01) + 닫기(X).
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("folder-plus") + "<span></span>";
        oHeader.querySelector("span").textContent =
            "[U4A] " + _txt("/U4A/CL_WS_COMMON", "A30") + " " + _txt("/U4A/CL_WS_COMMON", "A01");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.innerHTML = _fa("xmark");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39");
        oX.addEventListener("click", lf_closeCreateFolder);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 바디 — 공통 폼(라벨 상단). Folder Name(필수, D01) + Description(A35).
        var oBody = _el("div", "u4a-dialog__body u4aMimeCrBody");
        var oForm = _el("div", "u4a-form");

        var oR1 = _el("div", "u4a-form__row");
        oR1.appendChild(_el("label", "u4a-label u4a-label--required", _txt("/U4A/CL_WS_COMMON", "D01"))); // Folder Name
        var oNameField = U4AUI.createField({ type: "text", value: "", clear: true, onEnter: function () { lf_confirmCreateFolder(); } });
        oR1.appendChild(oNameField.el);
        oForm.appendChild(oR1);

        var oR2 = _el("div", "u4a-form__row");
        oR2.appendChild(_el("label", "u4a-label", _txt("/U4A/CL_WS_COMMON", "A35"))); // Description
        var oDescField = U4AUI.createField({ type: "text", value: "", clear: true, onEnter: function () { lf_confirmCreateFolder(); } });
        oR2.appendChild(oDescField.el);
        oForm.appendChild(oR2);

        oBody.appendChild(oForm);
        oDlg.appendChild(oBody);

        // 푸터 — Create(강조/파랑) + Cancel(negative/빨강) (원본 Emphasized/Reject).
        var oFoot = _el("div", "u4a-dialog__footer");
        // ★ 원본(sap.m.Dialog accept/decline) = 아이콘 전용(텍스트 없음). CTS 팝업과 동일 — title 툴팁만.
        var oCreateBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oCreateBtn.type = "button";
        oCreateBtn.innerHTML = _fa("check");
        oCreateBtn.title = _txt("/U4A/CL_WS_COMMON", "A01"); // Create
        oCreateBtn.addEventListener("click", lf_confirmCreateFolder);
        var oCancelBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCancelBtn.type = "button";
        oCancelBtn.innerHTML = _fa("xmark");
        oCancelBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCancelBtn.addEventListener("click", lf_closeCreateFolder);
        oFoot.appendChild(oCreateBtn);
        oFoot.appendChild(oCancelBtn);
        oDlg.appendChild(oFoot);

        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closeCreateFolder(); });

        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 360, minH: 200 }); }

        document.body.appendChild(oDlg);

        oCrUI = { dlg: oDlg, nameField: oNameField, descField: oDescField, createBtn: oCreateBtn, target: oNode };
    }

    function lf_closeCreateFolder() {
        if (!oCrUI) { return; }
        try { if (oCrUI.dlg.open) { oCrUI.dlg.close(); } } catch (e) { }
        try { oCrUI.dlg.remove(); } catch (e) { }   // DOM 에서 제거(다음 오픈은 새로 생성)
        oCrUI = null;
    }

    function lf_confirmCreateFolder() {
        if (!oCrUI || !oCrUI.target) { return; }

        var sName = oCrUI.nameField.getValue() || "";

        // 검증 — 폴더명 필수(원본: FLDNM=="" → valueState Error + MSG_WS 050).
        if (sName === "") {
            var sTxt = _txt("/U4A/CL_WS_COMMON", "D01");        // Folder Name
            sTxt = _txt("/U4A/MSG_WS", "050", sTxt);            // & is required.
            oCrUI.nameField.setValueState("error", sTxt);
            try { oCrUI.nameField.focus(); } catch (e) { }
            return;
        }
        oCrUI.nameField.setValueState("none", "");

        var oNode = oCrUI.target;
        var oApp = _appInfo();
        var sDesc = oCrUI.descField.getValue() || "";

        // 생성 호출(원본 lf_createMimeFolder) — sReqNo 주면 그 운송요청으로 재시도(CTS 선택 후).
        function _doCreate(sReqNo) {

            var oCrFldInfo = {
                TRCOD: "C",                 // C: 생성
                OBJTYPE: "FOLD",            // FOLD: 폴더
                FLDNM: sName,               // 폴더명
                FLDPATH: oNode.URL,         // 부모 폴더 경로
                DESC: sDesc,
                DEVPKG: oApp.PACKG,         // 개발 패키지
                REQNO: (sReqNo == null) ? (oApp.REQNO || "") : sReqNo, // Request/Task
                CONTENT: "",                // 파일 컨텐츠(폴더는 빈값)
                CLSID: oApp.CLSID
            };

            lf_busy(true);
            if (oCrUI.createBtn) { oCrUI.createBtn.disabled = true; }

            var sPath = oAPP.fn.getServerPath() + "/set_mime_crud",
                oFormData = new FormData();
            oFormData.append("MIMEINFO", JSON.stringify(oCrFldInfo));

            sendAjax(sPath, oFormData, lf_crSuccess, null, null, "POST", lf_crError);
        }

        // 전송요청(CTS) 필요 시 — 공통 CTS 팝업으로 TR 선택 후 그 TRKORR 로 재생성(원본 lf_createMimeCts 1:1).
        function lf_createMimeCts() {
            try {
                oAPP.fn.fnCtsPopupOpener(function (oResult) {
                    if (oResult && oResult.TRKORR) { _doCreate(oResult.TRKORR); }
                });
            } catch (e) { console.error("[HTML5][MIME] CTS open:", e); }
        }

        function lf_crSuccess(oResult) {
            lf_busy(false);
            if (oCrUI && oCrUI.createBtn) { oCrUI.createBtn.disabled = false; }

            if (!oResult || oResult.RETCD === "E") {
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }

                // 서버 예외 → 클라 언어 출력(공통 단일 헬퍼, .analy/17 전략 — 역현지화/SCRIPT 파싱).
                //   onCts: 전송요청(CTS) 팝업. SCRIPT 는 헬퍼가 파싱(eval 없음)해 needCts 판정.
                oAPP.fn.fnRenderServerError(oResult, { onCts: function () { lf_createMimeCts(); } });
                return;
            }

            // 성공 — 반환 폴더 노드를 부모 하위에 추가 + 펼침/선택(원본 fnMimeFolderCreateSuccess).
            lf_insertCreatedFolder(oNode, oResult.MIMETREE);
            lf_closeCreateFolder();
        }

        function lf_crError() {
            lf_busy(false);
            if (oCrUI && oCrUI.createBtn) { oCrUI.createBtn.disabled = false; }
            try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
            try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
            try { oAPP.fn.showMessage(null, 20, "E", _wsTxt("314")); } catch (e) { }
        }

        _doCreate();   // 최초 시도(앱 기본 REQNO)
    }

    /************************************************************************
     * CTS(이관요청) 선택 공통 팝업 재사용 — 공통 모듈(fnCtsPopupOpen.js)에 별도창 의존성 주입.
     *   기본 모듈은 parent.*(WS20)에 묶여 있으므로, 별도창은 자기 컨텍스트(oAPP.fn.* / 자체 sendAjax)를 주입.
     *   showMessage 확인질문(콜백형)은 별도창에 확인 다이얼로그가 없어 즉시 'YES'(선택 진행)로 처리.
     ************************************************************************/
    oAPP.fn.fnCtsPopupOpener = function (fnCallback) {
        if (typeof oAPP.fn.fnCtsPopupOpen !== "function") {
            console.error("[HTML5][MIME] CTS 모듈 미로드(fnCtsPopupOpen.js)");
            return;
        }
        oAPP.fn.fnCtsPopupOpen(fnCallback, {
            getServerPath: function () { return oAPP.fn.getServerPath(); },
            getUserInfo: function () { return oAPP.fn.getUserInfo(); },
            setBusy: function (s) { return oAPP.fn.setBusy(s); },
            showMessage: function (a, b, sType, sMsg, fnCb) {
                // 확인질문(콜백형) → 공통 U4AUI.confirm(예/아니오). 제목은 메시지키로 현지화(B86 Information).
                if (typeof fnCb === "function") {
                    var sTitle = "";
                    try { sTitle = oAPP.common.fnGetMsgClsText("/U4A/CL_WS_COMMON", "B86"); } catch (e) { }
                    U4AUI.confirm({ type: sType || "I", title: sTitle, message: sMsg, onClose: function (sAct) { try { fnCb(sAct); } catch (e) { } } });
                    return;
                }
                oAPP.fn.showMessage(a, b, sType, sMsg);   // 단순 알림 → 토스트
            },
            sendAjax: sendAjax
        });
    };

    // 생성된 폴더를 트리에 반영(원본 fnMimeFolderCreateSuccess).
    // 생성된 자식(폴더 1개 또는 파일 N개)을 부모 하위에 추가 + 펼침/선택(원본 fnMimeFolderCreateSuccess/파일 동일).
    function lf_insertCreatedFolder(oParent, oNewOrArr) {
        if (!oParent) { return; }
        oExpand[oParent.CHILD] = true;   // 부모 펼침

        // 미로드(더미) 폴더면 서버 재조회로 자식 전체 정합 — 더미/신규 공존 혼란 방지.
        if (oState.sLazy && _hasDummy(oParent)) {
            lf_lazyExpand(oParent);
            return;
        }

        if (!Array.isArray(oParent.MIMETREE)) { oParent.MIMETREE = []; }
        var aNew = Array.isArray(oNewOrArr) ? oNewOrArr : (oNewOrArr ? [oNewOrArr] : []);
        var sLastKey = "";
        aNew.forEach(function (n) {
            if (n) { oParent.MIMETREE.push(n); if (n.CHILD != null) { sLastKey = String(n.CHILD); } }
        });
        if (sLastKey) { oState.selKey = sLastKey; }
        oUI.tree.render();
        try { if (sLastKey) { oUI.tree.scrollToKey(sLastKey); } } catch (e) { }
    }

    /************************************************************************
     * 오브젝트 삭제(K4) — 원본 fnMimeTreeDeleteObject/Callback/fnMimeDeleteSuccess 1:1.
     *   확인(MSG_WS 003) → POST /set_mime_crud {TRCOD:"D", OBJTYPE:FOLDER|FILE, FLDNM, FLDPATH(URL), DESC, DEVPKG, REQNO}
     *   → 성공 시 트리에서 해당 노드 제거 + 속성/미리보기 비움.
     ************************************************************************/
    function lf_deleteObject(oNode) {
        if (!oNode) { return; }
        // 질문(003, 메시지키) + "어떤 오브젝트인지"(유형 D45/B79 메시지키 + 이름=선택 데이터) 함께 표시.
        //   문구는 키만 사용, 이름은 사용자 데이터 echo(임의 메시지 생성 아님).
        var sType = _isFolder(oNode) ? _txt("/U4A/CL_WS_COMMON", "D45") : _txt("/U4A/CL_WS_COMMON", "B79"); // Folder / File
        var sMsg = _txt("/U4A/MSG_WS", "003") + "\n\n" + sType + " : " + (oNode.NTEXT || ""); // Do you really want to delete the object?
        oAPP.fn.showMessage(null, 30, "I", sMsg, function (sAct) {
            if (sAct !== "YES") { return; }
            _doDeleteObject(oNode);
        });
    }

    function _doDeleteObject(oNode, sReqNo) {
        var oApp = _appInfo();
        var oDel = {
            TRCOD: "D",                                       // D: 삭제
            OBJTYPE: _isFolder(oNode) ? "FOLDER" : "FILE",    // 폴더/파일
            FLDNM: oNode.NTEXT,                               // 이름
            FLDPATH: oNode.URL,                               // 경로
            DESC: oNode.MDESC,                                // 설명
            DEVPKG: oApp.PACKG,                               // 개발 패키지
            REQNO: (sReqNo == null) ? (oApp.REQNO || "") : sReqNo  // Request/Task(CTS 선택 후 재시도 시 그 TR)
        };

        // 삭제도 운송요청(CTS) 선행검사를 거친다(서버 SET_MIME_CRUD: C/D 분기 前 공통 CTS 체크).
        //   → 운송요청 필요(E205/E073/E162/E305 + lf_createMimeCts) 시 공통 CTS 팝업 후 그 TR 로 재삭제.
        function lf_delCts() {
            try {
                oAPP.fn.fnCtsPopupOpener(function (oRes) {
                    if (oRes && oRes.TRKORR) { _doDeleteObject(oNode, oRes.TRKORR); }
                });
            } catch (e) { console.error("[HTML5][MIME] CTS open(delete):", e); }
        }

        lf_busy(true);
        var sPath = oAPP.fn.getServerPath() + "/set_mime_crud",
            oFormData = new FormData();
        oFormData.append("MIMEINFO", JSON.stringify(oDel));

        sendAjax(sPath, oFormData, function (oResult) {
            lf_busy(false);
            if (!oResult || oResult.RETCD === "E") {
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
                oAPP.fn.fnRenderServerError(oResult, { onCts: lf_delCts });
                return;
            }
            lf_removeNodeFromTree(oNode);
        }, null, null, "POST", function () {
            lf_busy(false);
            try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
            try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
            oAPP.fn.fnRenderServerError(null, {});
        });
    }

    // 삭제 성공 → aTreeRoots 에서 해당 노드를 부모 배열에서 제거 + 선택/속성 초기화(원본 fnMimeDeleteSuccess).
    function lf_removeNodeFromTree(oNode) {
        var sKey = _key(oNode);
        (function rec(aNodes) {
            if (!Array.isArray(aNodes)) { return false; }
            for (var i = 0; i < aNodes.length; i++) {
                if (aNodes[i] === oNode || _key(aNodes[i]) === sKey) { aNodes.splice(i, 1); return true; }
                if (rec(aNodes[i].MIMETREE)) { return true; }
            }
            return false;
        })(aTreeRoots);

        oState.oSel = null;
        oState.selKey = "";
        lf_setProps({});
        lf_showPreview("none");
        oUI.tree.render();
    }

    /************************************************************************
     * 마임 오브젝트 가져오기(K5) — 원본 fnMimeTreeAttachFiles + ev_attachMimeDlgSaveEvent 1:1.
     *   파일 다중 첨부(파일명+설명) → multipart FormData(FILE×N: 3번째 인자 "name|desc", MIMEINFO {TRCOD:"C",OBJTYPE:"FILE",FLDPATH,DEVPKG,REQNO})
     *   → POST /set_mime_crud → 반환 노드(들)을 부모 하위에 추가.
     ************************************************************************/
    var oImpUI = null;

    function lf_openImport(oNode) {
        if (!oNode) { return; }
        lf_closeImport();
        lf_buildImport(oNode);
        try { oImpUI.dlg.showModal(); } catch (e) { console.error("[HTML5][MIME] import showModal:", e); }
    }

    function lf_closeImport() {
        if (!oImpUI) { return; }
        try { if (oImpUI.dlg.open) { oImpUI.dlg.close(); } } catch (e) { }
        try { oImpUI.dlg.remove(); } catch (e) { }
        oImpUI = null;
    }

    function lf_buildImport(oNode) {

        var oDlg = document.createElement("dialog");
        oDlg.className = "u4a-dialog u4aMimeImpDlg";

        // 헤더 — attachment 아이콘 + "[U4A] MIME File Attach"(C33) + 닫기 X.
        var oHeader = _el("div", "u4a-dialog__header");
        oHeader.innerHTML = _fa("paperclip") + "<span></span>";
        oHeader.querySelector("span").textContent = "[U4A] " + _txt("/U4A/CL_WS_COMMON", "C33");
        var oX = _el("button", "u4a-btn-icon");
        oX.type = "button"; oX.innerHTML = _fa("xmark");
        oX.title = _txt("/U4A/CL_WS_COMMON", "A39");
        oX.addEventListener("click", lf_closeImport);
        oHeader.appendChild(oX);
        oDlg.appendChild(oHeader);

        // 바디 — 파일 선택 버튼 + 첨부 파일 목록(파일명/설명/제거).
        var oBody = _el("div", "u4a-dialog__body u4aMimeImpBody");

        var oBar = _el("div", "u4aMimeImpBar");
        var oPick = _el("button", "u4a-btn u4a-btn--emphasized u4aMimeImpPick");
        oPick.type = "button";
        oPick.innerHTML = _fa("folder-open") + "<span></span>";
        oPick.querySelector("span").textContent = _wsTxt("518"); // 파일 선택(File Selection)
        var oFileInput = document.createElement("input");
        oFileInput.type = "file"; oFileInput.multiple = true; oFileInput.style.display = "none";
        oFileInput.addEventListener("change", function () {
            _addImportFiles(oFileInput.files);
            oFileInput.value = "";
        });
        oPick.addEventListener("click", function () { oFileInput.click(); });
        oBar.appendChild(oPick);
        oBar.appendChild(oFileInput);
        oBody.appendChild(oBar);

        // 목록 테이블(공통 .u4a-table) — 파일명(C35) / 설명(A35) / 제거.
        var oTbWrap = _el("div", "u4a-table-wrap u4a-table-wrap--boxed u4aMimeImpTbWrap");
        var oTb = _el("table", "u4a-table u4aMimeImpTb");
        var oThead = _el("thead");
        var oHr = _el("tr");
        oHr.appendChild(_el("th", null, _txt("/U4A/CL_WS_COMMON", "C35"))); // File Name
        oHr.appendChild(_el("th", "u4aMimeImpSizeCol", _wsTxt("736"))); // File Size(파일크기)
        oHr.appendChild(_el("th", "u4aMimeImpDescCol", _txt("/U4A/CL_WS_COMMON", "A35"))); // Description(폭 미지정 — 파일이름과 남는 폭 균등 분배)
        oHr.appendChild(_el("th", "u4aMimeImpDelCol", ""));
        oThead.appendChild(oHr);
        oTb.appendChild(oThead);
        var oTbody = _el("tbody");
        oTb.appendChild(oTbody);
        oTbWrap.appendChild(oTb);
        oBody.appendChild(oTbWrap);

        // 빈 목록 = 드래그&드롭 가이드(아이콘 + 269 "파일을 여기에 놓아주세요"). 목록 박스 안 중앙 오버레이.
        //   드롭 이벤트가 통과하도록 pointer-events:none(CSS). 파일 있으면 lf_renderImpList 가 숨김.
        var oEmpty = _el("div", "u4aMimeImpEmpty");
        oEmpty.innerHTML = '<i class="fa-solid fa-cloud-arrow-up u4aMimeImpEmptyIcon"></i><span></span>';
        oEmpty.querySelector("span").textContent = _wsTxt("269"); // 파일을 여기에 놓아주세요 (Drop the File)
        oTbWrap.appendChild(oEmpty);   // 테이블 박스 안에 표시(사용자가 인지하는 빈 영역)

        oDlg.appendChild(oBody);

        // 푸터 — Save(A64) / Cancel(A41) (원본 text+icon).
        var oFoot = _el("div", "u4a-dialog__footer");
        var oSaveBtn = _el("button", "u4a-btn u4a-btn--emphasized");
        oSaveBtn.type = "button";
        oSaveBtn.innerHTML = _fa("check") + "<span></span>";
        oSaveBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A64"); // Save
        oSaveBtn.addEventListener("click", lf_confirmImport);
        var oCancelBtn = _el("button", "u4a-btn u4a-btn--negative");
        oCancelBtn.type = "button";
        oCancelBtn.innerHTML = _fa("xmark") + "<span></span>";
        oCancelBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A41"); // Cancel
        oCancelBtn.addEventListener("click", lf_closeImport);
        oFoot.appendChild(oSaveBtn);
        oFoot.appendChild(oCancelBtn);
        oDlg.appendChild(oFoot);

        oDlg.addEventListener("cancel", function (e) { e.preventDefault(); lf_closeImport(); });
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 420, minH: 300 }); }

        document.body.appendChild(oDlg);

        oImpUI = { dlg: oDlg, tbody: oTbody, empty: oEmpty, saveBtn: oSaveBtn, target: oNode, files: [] };
        lf_bindImportDrop(oDlg, oTbWrap);   // OS 파일 드래그&드롭 → 목록 추가(파일 선택 버튼과 동일)
        lf_renderImpList();
    }

    // 가져오기 팝업 파일 드롭 — 다이얼로그 전체가 드롭영역, 목록 테이블에 하이라이트. 파일 선택과 동일 처리.
    //   ★ 드롭 시 브라우저 기본동작(파일로 창 네비게이션) 방지 위해 dragover/drop 모두 preventDefault.
    function lf_bindImportDrop(oZone, oHi) {
        function _stop(e) { e.preventDefault(); e.stopPropagation(); }
        ["dragenter", "dragover"].forEach(function (t) {
            oZone.addEventListener(t, function (e) {
                _stop(e);
                try { if (e.dataTransfer) { e.dataTransfer.dropEffect = "copy"; } } catch (x) { }
                if (oHi) { oHi.classList.add("u4aMimeImpDrag"); }
            });
        });
        ["dragleave", "dragend"].forEach(function (t) {
            oZone.addEventListener(t, function (e) { _stop(e); if (oHi) { oHi.classList.remove("u4aMimeImpDrag"); } });
        });
        oZone.addEventListener("drop", function (e) {
            _stop(e);
            if (oHi) { oHi.classList.remove("u4aMimeImpDrag"); }
            if (!oImpUI) { return; }
            _addImportFiles((e.dataTransfer && e.dataTransfer.files) ? e.dataTransfer.files : null);
        });
    }

    // 파일 목록 추가(파일 선택·드롭 공통). ★0KB(빈) 파일은 서버 PUT 거부되므로 클라에서 첨부 차단 + 안내.
    function _addImportFiles(fs) {
        if (!oImpUI || !fs || !fs.length) { return; }
        var C_NAME_MAX = 60;   // 파일명(확장자 포함) 최대 길이 — 초과 시 첨부 불가
        var aZero = [], aLong = [];
        for (var i = 0; i < fs.length; i++) {
            var f = fs[i];
            if (!f) { continue; }
            if (!(f.size > 0)) { aZero.push(f.name); continue; }                    // 0KB → 제외
            if (String(f.name).length > C_NAME_MAX) { aLong.push(f.name); continue; } // 60자 초과 → 제외
            oImpUI.files.push({ file: f, desc: "" });
        }
        lf_renderImpList();

        // 제외 사유별 안내(키 문구 + 파일명 데이터).
        //   가져오기 팝업=showModal(top-layer) → 정보 토스트는 가림 → "W"(박스)로 노출(.analy/16 §2.10).
        var aMsg = [];
        if (aZero.length) {
            // 0KB(빈) 파일 첨부 불가 — 969, 미동기화 시 140("업로드 파일 크기를 확인하세요") 폴백.
            aMsg.push((_wsTxt("969") || _txt("/U4A/MSG_WS", "140")) + "\n" + aZero.join("\n"));
        }
        if (aLong.length) {
            // 파일명 60자 초과 첨부 불가 — 신규 970, 미동기화 시 339("업로드한 파일에 문제가 있습니다") 폴백.
            aMsg.push((_wsTxt("970") || _txt("/U4A/MSG_WS", "339")) + "\n" + aLong.join("\n"));
        }
        if (aMsg.length) {
            oAPP.fn.showMessage(null, 20, "W", aMsg.join("\n\n"));
        }
    }

    // 파일 크기 표기(B/KB/MB/GB).
    function _fmtSize(n) {
        n = Number(n) || 0;
        if (n < 1024) { return n + " B"; }
        if (n < 1048576) { return (n / 1024).toFixed(1) + " KB"; }
        if (n < 1073741824) { return (n / 1048576).toFixed(1) + " MB"; }
        return (n / 1073741824).toFixed(1) + " GB";
    }

    function lf_renderImpList() {
        if (!oImpUI) { return; }
        var oTbody = oImpUI.tbody;
        oTbody.innerHTML = "";
        oImpUI.empty.hidden = oImpUI.files.length > 0;
        oImpUI.files.forEach(function (oF, iIdx) {
            var oTr = _el("tr");
            if (iIdx % 2 === 1) { oTr.setAttribute("data-odd", "true"); }
            var oTdName = _el("td", null, oF.file.name);
            oTdName.title = oF.file.name;
            var oTdSize = _el("td", "u4aMimeImpSizeCol", _fmtSize(oF.file.size));
            var oTdDesc = _el("td", "u4aMimeImpDescCol");
            var oDescInput = U4AUI.createField({ type: "text", value: oF.desc || "", clear: true, className: "u4aMimeImpDesc" });
            oDescInput.input.addEventListener("input", function () { oF.desc = oDescInput.getValue(); });
            oTdDesc.appendChild(oDescInput.el);
            var oTdDel = _el("td", "u4aMimeImpDelCol");
            var oDel = _el("button", "u4a-btn-icon");
            oDel.type = "button"; oDel.innerHTML = _fa("trash"); oDel.title = _txt("/U4A/CL_WS_COMMON", "C30"); // Delete
            oDel.addEventListener("click", function () { oImpUI.files.splice(iIdx, 1); lf_renderImpList(); });
            oTdDel.appendChild(oDel);
            oTr.appendChild(oTdName); oTr.appendChild(oTdSize); oTr.appendChild(oTdDesc); oTr.appendChild(oTdDel);
            oTbody.appendChild(oTr);
        });
    }

    function lf_confirmImport() {
        if (!oImpUI || !oImpUI.target) { return; }
        if (!oImpUI.files.length) {   // 첨부 없이 저장 → 안내(신규 968 "첨부된 파일이 없습니다.", 미동기화 시 639 폴백)
            // ★ 가져오기 팝업이 showModal(top-layer)이라 정보 토스트는 모달 뒤에 가림 → "W"(박스)로 띄워 모달 위 노출.
            oAPP.fn.showMessage(null, 20, "W", _wsTxt("968") || _wsTxt("639"));
            return;
        }

        var oNode = oImpUI.target;
        var oApp = _appInfo();

        function _doImport(sReqNo) {
            var oCrInfo = {
                TRCOD: "C",                 // C: 생성
                OBJTYPE: "FILE",            // 파일
                FLDPATH: oNode.URL,         // 부모 폴더 경로
                DEVPKG: oApp.PACKG,
                REQNO: (sReqNo == null) ? (oApp.REQNO || "") : sReqNo
            };

            lf_busy(true);
            if (oImpUI.saveBtn) { oImpUI.saveBtn.disabled = true; }

            var sPath = oAPP.fn.getServerPath() + "/set_mime_crud",
                oFormData = new FormData();
            // 파일별: 3번째 인자(filename)에 "name|desc" 인코딩(원본 동일).
            oImpUI.files.forEach(function (oF) {
                oFormData.append("FILE", oF.file, oF.file.name + "|" + (oF.desc || ""));
            });
            oFormData.append("MIMEINFO", JSON.stringify(oCrInfo));

            sendAjax(sPath, oFormData, lf_impSuccess, null, null, "POST", lf_impError);
        }

        function lf_createMimeCts() {
            try {
                oAPP.fn.fnCtsPopupOpener(function (oResult) {
                    if (oResult && oResult.TRKORR) { _doImport(oResult.TRKORR); }
                });
            } catch (e) { console.error("[HTML5][MIME] CTS open:", e); }
        }

        function lf_impSuccess(oResult) {
            lf_busy(false);
            if (oImpUI && oImpUI.saveBtn) { oImpUI.saveBtn.disabled = false; }
            if (!oResult || oResult.RETCD === "E") {
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
                oAPP.fn.fnRenderServerError(oResult, { onCts: function () { lf_createMimeCts(); } });
                return;
            }

            // ★ 부분 성공 감지 — 서버는 PUT 실패 파일을 RETCD=S 인 채 조용히 skip(MIMETREE 에서 누락).
            //   보낸 파일명 중 서버 반환(MIMETREE)에 없는 것 = 등록 실패 → 사용자에게 알림(빈 파일/권한 등).
            var aRet = Array.isArray(oResult.MIMETREE) ? oResult.MIMETREE : (oResult.MIMETREE ? [oResult.MIMETREE] : []);
            var aSent = (oImpUI && oImpUI.files) ? oImpUI.files.map(function (f) { return f.file.name; }) : [];
            function _present(sName) {
                return aRet.some(function (n) {
                    if (!n) { return false; }
                    if (n.NTEXT === sName) { return true; }
                    var u = String(n.URL || "");
                    return u === sName || u.slice(-(sName.length + 1)) === ("/" + sName);
                });
            }
            var aFailed = aSent.filter(function (s) { return !_present(s); });

            lf_insertCreatedFolder(oNode, oResult.MIMETREE);   // 반환(성공) 파일 노드(배열) 부모에 추가
            lf_closeImport();

            // 일부 등록 실패 시 — 키(323 "처리 실패") + 실패 파일명(데이터)을 줄바꿈으로.
            if (aFailed.length) {
                try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
                oAPP.fn.showMessage(null, 20, "W", _txt("/U4A/MSG_WS", "323") + "\n\n" + aFailed.join("\n"));
            }
        }

        function lf_impError(arg) {
            lf_busy(false);
            if (oImpUI && oImpUI.saveBtn) { oImpUI.saveBtn.disabled = false; }
            try { oAPP.fn.setSoundMsg("02"); } catch (e) { }
            try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
            // HTTP 413(Request Entity Too Large) = 업로드 파일이 서버(nginx/ICF) 허용 용량 초과. 응답이
            //   우리 JSON 이 아니라 nginx HTML 이라 fnRenderServerError 가 "알 수 없는 오류" 로 떨어짐
            //   → 상태코드로 직접 판정해 용량 초과 안내.
            //   문구: 신규 키 ZMSG_WS_COMMON_001 967("업로드 파일 크기가 너무 큽니다.") 등록 후 그 문구,
            //   미등록(미동기화) 시 기존 /U4A/MSG_WS 140("업로드 파일 크기를 확인하세요.")로 폴백(빈 메시지 방지).
            if (arg && typeof arg.status === "number" && arg.status === 413) {
                oAPP.fn.showMessage(null, 20, "E", _wsTxt("967") || _txt("/U4A/MSG_WS", "140"));
                return;
            }
            oAPP.fn.fnRenderServerError(null, {});
        }

        _doImport();
    }

    /************************************************************************
     * 마임 오브젝트 다운로드(K6) — 원본 fnMimeTreeFileDown + fnFileDown 1:1 이식.
     *   파일만(폴더 비활성) → 로그인유지 체크 → /getmimeobj blob → 폴더선택 다이얼로그 →
     *   FS.writeFile(폴더\파일명) → 저장 폴더에서 파일 보이기(showItemInFolder). 폴더경로 기억.
     ************************************************************************/
    function lf_downloadObject(oNode) {
        if (!oNode || _isFolder(oNode)) { return; }   // 파일만(폴더는 K6 비활성)

        var fnGet = function () {
            lf_getMimeObject(oNode.URL, function (oBlob) {   // lf_getMimeObject 가 busy("X") 처리
                try { oAPP.fn.setBusy(""); } catch (e) { }
                if (!oBlob || oBlob.size <= 0) { return; }   // 원본 동일(빈 오브젝트는 무동작)
                _saveBlobToDisk(oNode.NTEXT, oBlob);
            });
        };

        // 로그인 유지 체크 후 다운로드(원본/미리보기 경로 동일 패턴).
        try {
            if (oAPP.fn.sendAjaxLoginChk) {
                oAPP.fn.sendAjaxLoginChk(function (oReturn) {
                    if (!oReturn || oReturn.RETCD !== "S") { try { oAPP.fn.setBusy(""); } catch (e) { } return; }
                    fnGet();
                });
            } else { fnGet(); }
        } catch (e) { fnGet(); }
    }

    // blob → 디스크 저장(원본 fnFileDown). 폴더 선택 다이얼로그 + FS.writeFile + 폴더에서 보이기.
    function _saveBlobToDisk(sFileName, oBlob) {
        var REMOTE = oAPP.REMOTE, FS = oAPP.FS, PATH = oAPP.PATH;
        var DIALOG = REMOTE.dialog || REMOTE.require("electron").dialog;
        var SHELL = REMOTE.require("electron").shell;
        var B = (typeof Buffer !== "undefined") ? Buffer : REMOTE.require("buffer").Buffer;

        var sDefault = oAPP.attr._filedownFolderPath || "";
        if (!sDefault) { try { sDefault = oAPP.APP.getPath("downloads"); } catch (e) { sDefault = ""; } }

        var sTitle = (_txt("/U4A/CL_WS_COMMON", "B79") + " " + _txt("/U4A/CL_WS_COMMON", "B78")).trim(); // File Download

        var p;
        try {
            p = DIALOG.showOpenDialog(oAPP.CURRWIN, {
                title: sTitle, defaultPath: sDefault, properties: ["openDirectory", "dontAddToRecent"]
            });
        } catch (e) { console.error("[HTML5][MIME] download dialog:", e); return; }

        Promise.resolve(p).then(function (oPaths) {
            if (!oPaths || oPaths.canceled || !oPaths.filePaths || !oPaths.filePaths.length) { return; }
            var sFolder = oPaths.filePaths[0];
            var sFilePath = PATH.join(sFolder, sFileName);
            oAPP.attr._filedownFolderPath = sFolder;   // 다음 다운로드 기본 경로로 기억(원본 동일)

            var reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    var buf = B.from(ev.target.result);
                    FS.writeFile(sFilePath, buf, {}, function (err) {
                        if (err) { console.error("[HTML5][MIME] download write:", err); return; }
                        try { SHELL.showItemInFolder(sFilePath); } catch (e) { }   // 저장 폴더에서 파일 보이기
                    });
                } catch (e) { console.error("[HTML5][MIME] download buffer:", e); }
            };
            reader.onerror = function () { console.error("[HTML5][MIME] download read 실패"); };
            reader.readAsArrayBuffer(oBlob);
        }).catch(function (e) { console.error("[HTML5][MIME] download:", e); });
    }

    /************************************************************************
     * 트리/미리보기/속성 1회 생성(창 채움) — 원본 lf_build 에서 다이얼로그 래퍼만 제거.
     ************************************************************************/
    function lf_build() {

        var oRoot = document.getElementById("mimeRoot");
        oRoot.innerHTML = "";

        var oSplit = _el("div", "u4a-splitter u4aMimeSplit");

        // 좌: 트리 패널.
        var oTreePane = _el("div", "u4a-splitter__pane u4aMimeTreePane");
        oTreePane.style.flex = "0 1 42%";
        oTreePane.style.minWidth = "260px";

        var oTreeTool = _el("div", "u4aMimeTreeTool");
        var oExpBtn = _el("button", "u4a-btn-icon u4aMimeToolBtn");
        oExpBtn.type = "button"; oExpBtn.innerHTML = _fa("angles-down");
        oExpBtn.title = _txt("/U4A/CL_WS_COMMON", "C27");
        oExpBtn.addEventListener("click", lf_expandSel);
        var oColBtn = _el("button", "u4a-btn-icon u4aMimeToolBtn");
        oColBtn.type = "button"; oColBtn.innerHTML = _fa("angles-up");
        oColBtn.title = _txt("/U4A/CL_WS_COMMON", "C28");
        oColBtn.addEventListener("click", lf_collapseSel);
        // ★ 전체 펼침/접힘 버튼 — 대량 서버 호출 우려로 우선 숨김(재활성화 = 두 줄 제거).
        oExpBtn.style.display = "none";
        oColBtn.style.display = "none";
        oTreeTool.appendChild(oExpBtn);
        oTreeTool.appendChild(oColBtn);
        oTreeTool.appendChild(_el("span", "u4aMimeToolSpacer"));
        var oMyAppBtn = _el("button", "u4a-btn u4aMimeMyAppBtn");
        oMyAppBtn.type = "button";
        oMyAppBtn.innerHTML = _fa("location-crosshairs") + "<span></span>";
        oMyAppBtn.querySelector("span").textContent =
            _txt("/U4A/CL_WS_COMMON", "D00") + " " + _txt("/U4A/CL_WS_COMMON", "A30");
        oMyAppBtn.hidden = true;
        oMyAppBtn.addEventListener("click", lf_gotoMyApp);
        oTreeTool.appendChild(oMyAppBtn);
        oTreePane.appendChild(oTreeTool);

        var oTreeBody = _el("div", "u4aMimeTreeBody");
        var oColHead = _el("div", "u4aMimeTreeColHead");
        oColHead.appendChild(_el("span", "u4aMimeColName", _txt("/U4A/CL_WS_COMMON", "A50")));
        oColHead.appendChild(_el("span", "u4aMimeColDesc", _txt("/U4A/CL_WS_COMMON", "A35")));
        oTreeBody.appendChild(oColHead);

        var oTree = lf_buildTreeCmp();
        oTreeBody.appendChild(oTree.el);
        oTreePane.appendChild(oTreeBody);

        oTreeBody.addEventListener("contextmenu", function (ev) {
            var oRow = (ev.target && ev.target.closest) ? ev.target.closest(".u4aMimeRow") : null;
            ev.preventDefault();
            if (!oRow) { _closeMimeMenu(); return; }
            var n = oRow.__mimeNode;
            if (!n) { _closeMimeMenu(); return; }
            lf_onRowSelect(n, oRow);
            _openMimeMenu(ev.clientX, ev.clientY, n);
        });

        var oBarH = _el("div", "u4a-splitter__bar");
        oBarH.setAttribute("role", "separator");

        // 우: 속성 패널(상단) + 미리보기(하단).
        var oRightPane = _el("div", "u4a-splitter__pane u4aMimeRightPane");
        oRightPane.style.flex = "1 1 0%";
        oRightPane.style.minWidth = "260px";

        var oPanel = U4AUI.createPanel({ title: _txt("/U4A/CL_WS_COMMON", "C17") });
        oPanel.el.classList.add("u4aMimePropPanel");

        // ── 속성 폼 = 공통 반응형 폼(.u4a-form / .u4a-form__row, 라벨 상단). 패널이 좁아도
        //    입력 영역이 행 전체폭을 차지해 잘리지 않음(원본 ResponsiveGridLayout 대응). ──
        var oForm = _el("div", "u4a-form u4aMimePropForm");

        // 유형(Type=A51) — 폴더(D45)/파일(B79) 표시.
        var oTyRow = _el("div", "u4a-form__row");
        oTyRow.appendChild(_el("label", "u4a-label", _txt("/U4A/CL_WS_COMMON", "A51")));
        var oTypeField = U4AUI.createField({ type: "text", value: "", readOnly: true });
        oTyRow.appendChild(oTypeField.el);
        oForm.appendChild(oTyRow);

        // 파일 이름(C35)
        var oFnRow = _el("div", "u4a-form__row");
        oFnRow.appendChild(_el("label", "u4a-label", _txt("/U4A/CL_WS_COMMON", "C35")));
        var oFileField = U4AUI.createField({ type: "text", value: "", readOnly: true });
        oFnRow.appendChild(oFileField.el);
        oForm.appendChild(oFnRow);

        // URL(C18) — 입력 + URL 복사 버튼(한 줄, 좁으면 줄바꿈).
        var oUrlRow = _el("div", "u4a-form__row");
        oUrlRow.appendChild(_el("label", "u4a-label", _txt("/U4A/CL_WS_COMMON", "C18")));
        var oUrlBox = _el("div", "u4aMimeUrlBox");
        var oUrlField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeUrlField" });
        oUrlBox.appendChild(oUrlField.el);
        var oCopyBtn = _el("button", "u4a-btn u4aMimeCopyBtn");
        oCopyBtn.type = "button";
        oCopyBtn.innerHTML = _fa("copy") + "<span></span>";
        oCopyBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "C21");
        oCopyBtn.addEventListener("click", lf_urlCopy);
        oUrlBox.appendChild(oCopyBtn);
        oUrlRow.appendChild(oUrlBox);
        oForm.appendChild(oUrlRow);

        // 생성(A01) — 날짜/시간/사용자(한 줄, 좁으면 줄바꿈).
        var oCrRow = _el("div", "u4a-form__row");
        oCrRow.appendChild(_el("label", "u4a-label", _txt("/U4A/CL_WS_COMMON", "A01")));
        var oCrBox = _el("div", "u4aMimeCrBox");
        var oDateField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeCrField" });
        var oTimeField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeCrField" });
        var oNameField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeCrField u4aMimeCrName" });
        oCrBox.appendChild(oDateField.el);
        oCrBox.appendChild(oTimeField.el);
        oCrBox.appendChild(oNameField.el);
        oCrRow.appendChild(oCrBox);
        oForm.appendChild(oCrRow);

        oPanel.body.appendChild(oForm);

        var oPrevPane = _el("div", "u4aMimePrevPane");

        var oImg = _el("img", "u4aMimeImg");
        oImg.hidden = true;
        oImg.alt = "";

        var oPdf = document.createElement("iframe");
        oPdf.className = "u4aMimePdf";
        oPdf.setAttribute("frameborder", "0");
        oPdf.hidden = true;

        var oAudio = document.createElement("audio");
        oAudio.className = "u4aMimeAudio"; oAudio.controls = true; oAudio.preload = "metadata"; oAudio.hidden = true;
        // ★ 비디오는 <video> 직접 렌더 대신 iframe(미디어 문서)로 격리한다.
        //   <video controls> 의 네이티브 미디어컨트롤(shadow DOM) 내부 ResizeObserver 가 표시 즉시
        //   "loop limit exceeded" 를 내는데(브라우저 내부 거동, CSS 박스 고정으로도 회피 불가),
        //   iframe 안에서 미디어 문서로 렌더하면 그 RO 는 ws_trycatch 가 없는 iframe 창에서만 돌고
        //   부모 창으로 전파되지 않는다(오류를 삼키는 게 아니라, 브라우저 내부 렌더를 격리 — PDF/Monaco 동일).
        var oVideo = document.createElement("iframe");
        oVideo.className = "u4aMimeVideo"; oVideo.setAttribute("frameborder", "0"); oVideo.hidden = true;

        var oFrame = document.createElement("iframe");
        oFrame.className = "u4aMimeFrame";
        oFrame.setAttribute("frameborder", "0");
        oFrame.hidden = true;
        var oQuery = encodeURIComponent(JSON.stringify({
            HOSTID: C_HOSTID, LANG: "plaintext", THEME: _editorTheme(), READONLY: true
        }));
        var sHostSrc;
        try { sHostSrc = _fileUrl(oAPP.PATH.join(oAPP.PATHINFO.JS_ROOT, "codeeditor", "index.html")); }
        catch (e) { sHostSrc = "../../js/codeeditor/index.html"; }
        oFrame.src = sHostSrc + "?PARAMS=" + oQuery;

        var oNoData = _el("div", "u4aMimeNoData2");
        oNoData.appendChild(_el("span", null, _txt("/U4A/MSG_WS", "313")));

        oPrevPane.appendChild(oImg);
        oPrevPane.appendChild(oPdf);
        oPrevPane.appendChild(oAudio);
        oPrevPane.appendChild(oVideo);
        oPrevPane.appendChild(oFrame);
        oPrevPane.appendChild(oNoData);

        oRightPane.appendChild(oPanel.el);
        oRightPane.appendChild(oPrevPane);

        oSplit.appendChild(oTreePane);
        oSplit.appendChild(oBarH);
        oSplit.appendChild(oRightPane);
        oRoot.appendChild(oSplit);

        // 툴팁은 공통 initTooltip(u4a-ui.js)이 [data-tip] 으로 전역 처리 — 화면 전용 툴팁 불필요(별도창=top-layer 무관).

        _bindSplit(oBarH);
        _bindSplitResizeClamp(oSplit);

        window.addEventListener("message", lf_onMessage);
        try { window.addEventListener("u4a-theme-changed", lf_onThemeChange); } catch (e) { }

        oUI = {
            frame: oFrame, img: oImg, pdf: oPdf, audio: oAudio, video: oVideo, nodata: oNoData,
            tree: oTree, treeBody: oTreeBody, panel: oPanel, myAppBtn: oMyAppBtn,
            typeField: oTypeField, fileField: oFileField, urlField: oUrlField, dateField: oDateField, timeField: oTimeField, nameField: oNameField,
            split: oSplit, hostReady: false
        };
    }

    /************************************************************************
     * 스플리터 드래그(가로 1개: 트리|우측) — 좌측 px, 우측 grow 유지(doc16 §4.3).
     ************************************************************************/
    function _paneMin(el) {
        var v = parseFloat(el.style.minWidth || "");
        return isFinite(v) && v > 0 ? v : 120;
    }
    function _barsW(oSplit) {
        var w = 0;
        Array.prototype.slice.call(oSplit.children).forEach(function (c) {
            if (c.classList.contains("u4a-splitter__bar")) { w += c.getBoundingClientRect().width; }
        });
        return w;
    }
    function _bindSplit(oBar) {
        var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0;
        function lf_move(e) {
            if (!bDrag) { return; }
            var oSplit = oBar.parentNode;
            var a = iAStart + (e.clientX - iStart);
            var am = _paneMin(oA);
            var maxA = oSplit.clientWidth - _barsW(oSplit) - _paneMin(oB);
            if (a < am) { a = am; }
            if (a > maxA) { a = maxA; }
            oA.style.flex = "0 0 " + a + "px";
        }
        function lf_up() {
            bDrag = false;
            document.body.classList.remove("u4aMimeResizing");
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", function (e) {
            oA = oBar.previousElementSibling; oB = oBar.nextElementSibling;
            if (!oA || !oB) { return; }
            bDrag = true;
            iStart = e.clientX;
            iAStart = oA.getBoundingClientRect().width;
            document.body.classList.add("u4aMimeResizing");
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault();
        });
    }
    var _bMimeClampBound = false;
    function _bindSplitResizeClamp(oSplit) {
        if (_bMimeClampBound) { return; }
        _bMimeClampBound = true;
        window.addEventListener("resize", function () {
            var oS = oUI && oUI.split;
            if (!oS) { return; }
            var iAvail = oS.getBoundingClientRect().width;
            if (!iAvail) { return; }
            var aPanes = Array.prototype.slice.call(oS.children).filter(function (c) { return c.classList.contains("u4a-splitter__pane"); });
            var iBars = 0;
            Array.prototype.slice.call(oS.children).forEach(function (c) { if (c.classList.contains("u4a-splitter__bar")) { iBars += c.getBoundingClientRect().width; } });
            function _px(p) { var m = (p.style.flex || "").match(/(\d+(?:\.\d+)?)px/); return m ? parseFloat(m[1]) : null; }
            var aFixed = [], iFlexMin = 0;
            aPanes.forEach(function (p) { if (_px(p) != null) { aFixed.push(p); } else { iFlexMin += _paneMin(p); } });
            var iFixedW = 0; aFixed.forEach(function (p) { iFixedW += _px(p); });
            var iNeed = (iFixedW + iBars + iFlexMin) - iAvail;
            if (iNeed <= 0) { return; }
            aFixed.slice().sort(function (a, b) { return _px(b) - _px(a); }).forEach(function (p) {
                if (iNeed <= 0) { return; }
                var iCur = _px(p), iMin = _paneMin(p);
                var iCut = Math.min(Math.max(0, iCur - iMin), iNeed);
                if (iCut > 0) { p.style.flex = "0 0 " + (iCur - iCut) + "px"; iNeed -= iCut; }
            });
        });
    }

    /************************************************************************
     * 공개 진입점 — frame.js 가 if-mime-info 수신 후 호출.
     ************************************************************************/
    window.fnMimeStart = function () {

        try { oAPP.fn.fnHideFloatingFooterMsg(); } catch (e) { }

        if (!oUI || !document.getElementById("mimeRoot").contains(oUI.split)) {
            oUI = null;
            lf_build();
        }

        aTreeRoots = [];
        oExpand = {};
        oState.oSel = null;
        oState.selKey = "";
        oState.myAppKey = "";
        oState.myAppPath = [];
        oState.pendingText = null;
        oState.pendingPdf = null;
        if (oUI.myAppBtn) { oUI.myAppBtn.hidden = true; }
        lf_setProps({});
        lf_showPreview("none");
        oUI.tree.render();

        lf_loadTree();

    }; // end of window.fnMimeStart

})(window, window.oAPP);
