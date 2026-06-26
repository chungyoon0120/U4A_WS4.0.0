/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : fnMimePopupOpen.js
 * - file Desc : U4A MIME Repository Dialog Popup  (HTML5 — 뷰어 코어)
 * ----------------------------------------------------------------------
 * [컨버전 메모]
 *  원본: sap.m.Dialog(draggable/resizable, 100%×100%)
 *        + customHeader Toolbar(picture 아이콘 + "U4A MIME Repository"(C26) + 닫기)
 *        + content: sap.ui.layout.Splitter
 *            [ sap.ui.table.TreeTable(mimeTree, Object Name/Description, 컨텍스트메뉴 6종)
 *            | Splitter(Vertical)[ Panel(Properties: URL/URL Copy/Create) | Page(미리보기) ] ]
 *        데이터: GET /getmimetree?APPID → 평면배열(CHILD/PARENT) → fnSetTreeJson 계층화.
 *        파일 선택 → POST /getmimeobj(blob) → 이미지(DataURL)/텍스트(CodeEditor) 미리보기.
 *        속도개선(WLO UHAK901016): 자식보유 노드에 DUMMY_CHILD 더미 → 펼칠 때
 *        POST /get_mime_children 로 지연 로드.
 *
 *  HTML5(이번 단위 = 뷰어 코어):
 *   · 트리   → **공통 가상스크롤 트리 `U4AUI.createTree({virtual:true})`**(WS30 USP 와 동일 자산).
 *              평면→계층은 원본 fnSetTreeJson 과 동일 알고리즘을 로컬(_buildTree)로 수행.
 *              MyApp 강조·레벨별 색은 rowHook + 의미 토큰. 지연 로드(WLO) onToggle 로 보존.
 *   · 다이얼로그 → native <dialog class="u4a-dialog">(헤더48/푸터48/드래그/리사이즈 = 공통).
 *   · 스플리터 → 공통 `.u4a-splitter*`(좌:트리 | 우:[속성/미리보기 세로분할]). 드래그/재클램프 = 화면 최소구현(doc16 §4).
 *   · 미리보기 → 이미지는 <img>, 텍스트/코드는 **범용 Monaco 호스트(js/codeeditor)** 읽기전용 임베드(.analy 00 §6).
 *   · 속성   → 공통 `U4AUI.createField`(readonly) + URL Copy.
 *
 *  ★ 보존 로직(원본 그대로):
 *    · /getmimetree(APPID) 로드 + WLO 더미자식 + MyApp 플래그/펼침/포커스 + "MIME 폴더 없음"(196) 안내
 *    · 파일 선택 시 로그인유지 체크 → /getmimeobj(blob) → 허용 MIME 타입만 미리보기
 *    · 지연 로드(/get_mime_children) + 오류분기(E001/E002/기타) 콘솔/사운드/메시지
 *    · URL Copy(303 토스트), 펼치기/접기(서브트리)
 *  ★ 이번 단위 보류(다음 단위): 컨텍스트메뉴 CRUD(폴더생성/삭제/Import 업로드/다운로드).
 *
 *  ★ UI5 의존부 치환:
 *    · sap.ui.table.TreeTable        → U4AUI.createTree(virtual)
 *    · sap.ui.codeeditor.CodeEditor  → 범용 Monaco 호스트 iframe(postMessage)
 *    · sap.m.Dialog/Splitter/Form    → <dialog>.u4a-dialog / .u4a-splitter / createField
 *    · JSONModel 바인딩              → 로컬 상태(aTreeRoots/oState) + 직접 DOM/iframe 동기
 *    · sap.ui.core.theming.Parameters→ 의미 토큰(CSS) — 하드코딩/테마파라미터 없음
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    var APPCOMMON = oAPP.common;

    var REMOTE = parent.REMOTE,
        CURRWIN = (REMOTE && REMOTE.getCurrentWindow) ? REMOTE.getCurrentWindow() : null;

    var C_DLG_ID = "u4aWsMimeDlg",
        C_HOSTID = "U4AMIME",      // Monaco 호스트(iframe) 통신 채널 식별자
        C_PDFHOST = "U4AMIMEPDF";  // pdf.js 호스트(iframe) 통신 채널 식별자

    // ── 로컬 헬퍼(자기완결 — 다른 HTML5 팝업과 동일 컨벤션) ────────────────
    function _fa(s) { return '<i class="fa-solid fa-' + s + '"></i>'; }
    function _txt(sCls, sCode, p1, p2, p3, p4) {
        try { return APPCOMMON.fnGetMsgClsText(sCls, sCode, p1 || "", p2 || "", p3 || "", p4 || ""); }
        catch (e) { return ""; }
    }
    function _wsTxt(sCode, p1) {
        // Workspace 다국어(언어=Workspace LANGU) — 지연 로드 오류/더미 노드 텍스트용.
        try {
            var L = (parent.getUserInfo && parent.getUserInfo().LANGU) || "";
            return parent.WSUTIL.getWsMsgClsTxt(L, "ZMSG_WS_COMMON_001", sCode, p1 || "");
        } catch (e) { return ""; }
    }
    function _el(sTag, sClass, sText) {
        var o = document.createElement(sTag);
        if (sClass) { o.className = sClass; }
        if (typeof sText !== "undefined") { o.textContent = sText; }
        return o;
    }

    // 현재 진입한 APP 정보(원본: /WS20/APP, WS30 진입이면 /WS30/APP 우선). 모델 변형 없이 읽기만.
    function _appInfo() {
        var o = null;
        try { o = APPCOMMON.fnGetModelProperty("/WS20/APP"); } catch (e) { }
        try { var w3 = APPCOMMON.fnGetModelProperty("/WS30/APP"); if (w3 && w3.APPID) { o = w3; } } catch (e) { }
        return o || {};
    }

    // 셸 테마(다크/라이트)에 맞춘 Monaco 빌트인 테마 — body 배경 휘도로 판정(토큰 비결합, client_editor 동일).
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

    // Monaco 언어 결정 — 확장자 우선(가장 신뢰), 없으면 MIME 보조. (구문 하이라이트용. 미지정=plaintext)
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

    // 오디오/비디오 판별 — MIME 우선, 없으면 확장자(서버가 octet-stream 줘도 인식). Chromium 네이티브 재생.
    function _mediaKind(sName, sMime) {
        var m = String(sMime || "").toLowerCase();
        if (m.indexOf("audio/") === 0) { return "audio"; }
        if (m.indexOf("video/") === 0) { return "video"; }
        var ext = String(sName || "").split(".").pop().toLowerCase();
        if (/^(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/.test(ext)) { return "audio"; }
        if (/^(mp4|m4v|webm|ogv|mov)$/.test(ext)) { return "video"; }
        return "";
    }

    // 명백한 바이너리(텍스트로 못 보는 것) MIME — 미디어/폰트/압축/실행/오피스 등. (PDF·이미지·미디어는 별도 처리)
    //   octet-stream/미지정은 제외 → 텍스트로 시도 후 휴리스틱(_looksBinary)으로 판별(.py/.txt 등 서버가 octet-stream 줘도 표시).
    function _isBinaryMime(m) {
        m = String(m || "").toLowerCase();
        if (/^(audio|video|font|model)\//.test(m)) { return true; }
        return /^application\/(zip|x-zip|gzip|x-gzip|x-bzip2|x-7z|x-rar|x-tar|x-msdownload|x-shockwave-flash|java-archive|wasm|vnd\.|x-iso|x-apple|x-dosexec)/.test(m);
    }

    // 텍스트 디코드 결과가 바이너리인지 휴리스틱 — NUL 또는 치환문자(U+FFFD) 다수면 바이너리로 간주.
    function _looksBinary(s) {
        if (s == null) { return true; }
        var n = Math.min(s.length, 4096), bad = 0;
        for (var i = 0; i < n; i++) {
            var c = s.charCodeAt(i);
            if (c === 0) { return true; }                 // NUL → 확정 바이너리
            if (c === 0xFFFD) { bad++; }                  // 디코드 실패 치환문자
        }
        return n > 0 && (bad / n) > 0.1;                  // 10% 초과면 바이너리
    }

    /************************************************************************
     * 모듈 상태 — 다이얼로그/iframe/트리는 1회 생성 후 재사용(원본 단일 인스턴스 대응).
     ************************************************************************/
    var oUI = null;                 // { dlg, frame, tree, treeBody, img, nodata, urlField, dateField, timeField, nameField, hostReady }
    var oState = { sAppId: "", sLazy: false, oSel: null, selKey: "", pendingText: null, pendingPdf: null };
    var aTreeRoots = [];            // createTree roots(계층화된 마임 트리)
    var oExpand = {};               // 펼침 맵(key=노드 CHILD) — 가상 트리 외부 펼침 단일출처
    var iWatch = null;              // Monaco 최초 로드 busy 워치독

    // busy/Lock — 원본 fnSetBusyLock 그대로.
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
        // PDF 호스트(pdf.js) — ready 시 대기 중인 PDF 전송.
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
            // 호스트 준비 전 선택된 텍스트가 있으면 지금 반영.
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
     * 평면(CHILD/PARENT) 배열 → 계층(MIMETREE children) 변환.
     *   원본 oAPP.fn.fnSetTreeJson(model,"WS20.MIMETREE","CHILD","PARENT","MIMETREE") 과
     *   동일 알고리즘을 모델 비결합 순수 JS 로 수행(반환 = 루트 배열).
     ************************************************************************/
    function _buildTree(aFlat) {
        if (!Array.isArray(aFlat) || aFlat.length === 0) { return []; }
        var n = JSON.parse(JSON.stringify(aFlat));   // 원본 불변(깊은 복사) — 원본도 동일.
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

    /************************************************************************
     * Mime Tree 데이터에 My APP 하위 표시 플래그(MYAPPCHILD) 지정 — 원본 재귀 보존.
     ************************************************************************/
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

        var sPath = parent.getServerPath() + "/getmimetree?APPID=" + oState.sAppId;

        // function sendAjax(sPath, oFormData, fn_success, bIsBusy, bIsAsync, meth, fn_error, bIsBlob)
        sendAjax(sPath, null, lf_success, null, true, "GET");

        function lf_success(oResult) {

            if (!oResult || oResult.RETCD === "E") {
                console.log([
                    "[PATH]: www/ws30/ws10_20/js/fnMimePopupOpen.js",
                    "=> lf_loadTree => lf_success",
                    "[LOG]: Mime Data Not Found"
                ].join("\r\n"));
                try { parent.setSoundMsg("02"); } catch (e) { }       // sap sound(error)
                try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { } // 작업표시줄 깜빡임
                lf_busy(false);
                return;
            }

            var aFlat = oResult.MIMETREE || [];

            // 속도개선(WLO UHAK901016): 자식보유 노드(ZLEVEL 3, 내 APPID 제외)에 DUMMY_CHILD 더미를
            //   붙여 "펼침 아이콘" 활성화(펼칠 때 지연 로드).
            oState.sLazy = false;
            try { oState.sLazy = (APPCOMMON.checkWLOList("C", "UHAK901016") === true); } catch (e) { oState.sLazy = false; }
            if (oState.sLazy) {
                var aHasChild = aFlat.filter(function (e) { return e && e.ISECD === "X"; });
                for (var i = 0; i < aHasChild.length; i++) {
                    var oHas = aHasChild[i];
                    if (oHas.ZLEVEL !== 3) { continue; }
                    if (oHas.NTEXT === oState.sAppId) { continue; }
                    aFlat.push({ PARENT: oHas.CHILD, CHILD: "DUMMY_CHILD", NTEXT: _wsTxt("312") }); // No data Found.
                }
            }

            // My APP 하위 플래그 → 계층화.
            aFlat = _markMyAppChild(aFlat);
            aTreeRoots = _buildTree(aFlat);

            // 펼침 맵 초기화 — 1레벨(루트) 펼침.
            oExpand = {};
            for (var r = 0; r < aTreeRoots.length; r++) { oExpand[aTreeRoots[r].CHILD] = true; }

            oUI.tree.render();

            // 현재 APP 폴더로 펼침/포커스(원본 fnSetMimeTreeExpandMyApp).
            lf_expandMyApp(aFlat);

            // 현재 application 폴더가 없는 경우 안내(원본 196).
            if (aFlat.findIndex(function (a) { return a.MYAPP === "X"; }) === -1) {
                try { parent.setSoundMsg("02"); } catch (e) { }
                var sMsg = _txt("/U4A/CL_WS_COMMON", "D00") + " " + _txt("/U4A/CL_WS_COMMON", "A30"); // Current MIME Folder
                sMsg = _txt("/U4A/MSG_WS", "196", sMsg); // &1 does not exist.
                try { parent.showMessage(null, 10, "E", sMsg); } catch (e) { }
            }

            lf_busy(false);
        }
    }

    /************************************************************************
     * My APP 폴더(MYAPP=='X') 의 조상 경로 펼침 + 선택/스크롤 (원본 fnSetMimeTreeExpandMyApp 대응).
     ************************************************************************/
    function lf_expandMyApp(aFlat) {
        var oMyApp = aFlat.find(function (r) { return r && r.MYAPP === "X"; });
        oState.myAppKey = oMyApp ? oMyApp.CHILD : "";
        oState.myAppPath = [];   // 조상(+자신) 펼침 키 — MyApp 버튼이 재사용.
        if (oUI && oUI.myAppBtn) { oUI.myAppBtn.hidden = !oState.myAppKey; }   // 앱 폴더 있을 때만 버튼 표시.
        if (!oMyApp) {
            // 없으면 첫 라인 선택(원본 setSelectedIndex(0)) — 맨 위라 스크롤 불필요.
            if (aTreeRoots[0]) { oState.selKey = aTreeRoots[0].CHILD; oUI.tree.render(); }
            return;
        }
        // 조상 경로(PARENT 체인) + 자신(하위 있으면) 펼침 키 수집.
        var byKey = {};
        aFlat.forEach(function (r) { byKey[r.CHILD] = r; });
        var cur = byKey[oMyApp.PARENT];
        while (cur) { oState.myAppPath.push(cur.CHILD); cur = byKey[cur.PARENT]; }
        if (aFlat.some(function (r) { return r.PARENT === oMyApp.CHILD; })) { oState.myAppPath.push(oMyApp.CHILD); }
        // ★ 최초 진입 시 내 APP 폴더로 reveal(원본 setFirstVisibleRow). (이후엔 MyApp 버튼으로 이동)
        lf_gotoMyApp();
    }

    /************************************************************************
     * MyApp 버튼/최초진입 — 현재 어플리케이션 MIME 폴더로 펼침+선택+스크롤 이동.
     ************************************************************************/
    function lf_gotoMyApp() {
        if (!oState.myAppKey) { return; }   // 현재 앱 MIME 폴더가 없으면 무시(196 안내는 로드시 1회).
        (oState.myAppPath || []).forEach(function (k) { oExpand[k] = true; });
        oState.selKey = oState.myAppKey;
        oUI.tree.render();
        oUI.tree.scrollToKey(oState.myAppKey);   // 화면에 보이게(scroll) + 선택은 selKey→rowHook.
    }

    /************************************************************************
     * 지연 로드 — 펼침 시 DUMMY_CHILD 가 있으면 자식 마임을 서버에서 구해 교체.
     *   (원본 _onMimeTreeToggleOpenState / _getMimeChildData 1:1)
     ************************************************************************/
    function _getMimeChildData(oSelNode) {
        return new Promise(function (resolve) {
            var sPath = parent.getServerPath() + "/get_mime_children",
                oFormData = new FormData();
            oFormData.append("MIME_DATA", JSON.stringify(oSelNode));
            sendAjax(sPath, oFormData, function (oResult) { resolve(oResult); },
                null, null, "POST", function () { resolve({ RETCD: "E" }); });
        });
    }
    function lf_lazyExpand(oNode) {
        return new Promise(function (resolve) {
            var aChild = oNode.MIMETREE || [];
            var bHasDummy = aChild.some(function (e) { return e && e.CHILD === "DUMMY_CHILD"; });
            if (!bHasDummy) { resolve(false); return; }   // 이미 로드됨.

            lf_busy(true);
            _getMimeChildData(oNode).then(function (oRes) {

                if (!oRes || oRes.RETCD === "E") {
                    var sRetMsg, aLog = ["[PATH]: www/ws30/ws10_20/js/fnMimePopupOpen.js", "=> lf_lazyExpand"];
                    switch (oRes && oRes.STCOD) {
                        case "E001": sRetMsg = _wsTxt("313"); aLog.push("=> 파라미터 필수 누락"); break;
                        case "E002": sRetMsg = _wsTxt("313"); aLog.push("=> 서버 마임 정보 구성 오류"); break;
                        default: sRetMsg = _wsTxt("314"); aLog.push("=> 알 수 없는 오류"); break;
                    }
                    console.error(aLog.join("\r\n"));
                    sRetMsg = sRetMsg + "\n\n" + _wsTxt("228"); // 문제 지속 시 U4A 솔루션팀 문의
                    try { parent.setSoundMsg("02"); } catch (e) { }
                    try { if (CURRWIN) { CURRWIN.flashFrame(true); } } catch (e) { }
                    try { parent.showMessage(null, 20, "E", sRetMsg); } catch (e) { }
                    lf_busy(false);
                    resolve(false);
                    return;
                }

                // 자식 계층 구성 — 선택 노드(부모키 제거) + 자식들을 평면화 후 계층화하여 children 추출.
                var aChildData = (oRes.T_MIME_CHILD || []).slice();
                var oCopy = JSON.parse(JSON.stringify(oNode));
                oCopy.PARENT = "";
                aChildData.push(oCopy);
                var aRoots = _buildTree(aChildData);
                var oRoot = aRoots[0];
                oNode.MIMETREE = (oRoot && oRoot.MIMETREE) ? oRoot.MIMETREE : [];

                // 자식이 없으면 "데이터 없음" 더미 표시(원본 동일).
                if (oNode.MIMETREE.length === 0) {
                    oNode.MIMETREE.push({ PARENT: oNode.CHILD, CHILD: "DUMMY_CHILD", NTEXT: _wsTxt("312") });
                }

                oUI.tree.render();
                lf_busy(false);
                resolve(true);
            });
        });
    }

    /************************************************************************
     * 공통 트리(가상스크롤) 생성 — U4AUI.createTree({virtual:true}).
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

            // 펼침 상태는 화면(oExpand)이 단일 출처.
            isExpanded: function (n) {
                var k = _key(n);
                return oExpand[k] === true;
            },
            onToggle: function (n, bOpen) {
                oExpand[_key(n)] = !!bOpen;
                // 지연 로드(WLO) — 펼칠 때 더미가 있으면 서버에서 자식 가져옴.
                if (bOpen && oState.sLazy) {
                    var aChild = (n && n.MIMETREE) || [];
                    if (aChild.some(function (e) { return e && e.CHILD === "DUMMY_CHILD"; })) {
                        lf_lazyExpand(n);
                    }
                }
            },

            // 설명(Description) — 우측 정렬 trailing 슬롯. 말줄임 시 화면 전용 툴팁(data-mimetip).
            slotTrailing: function (n) {
                if (_isDummy(n)) { return null; }
                var d = _el("span", "u4aMimeDesc");
                var t = _el("span", "u4aMimeDescText", (n && n.MDESC != null) ? n.MDESC : "");
                if (n && n.MDESC) { t.setAttribute("data-mimetip", n.MDESC); }
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
                // 이름 말줄임 시 화면 전용 툴팁(data-mimetip) — 공통 툴팁은 body 에 붙어 모달(top-layer) 뒤에 깔림.
                var oLbl = oRow.querySelector(".u4a-tree__label");
                if (oLbl && n.NTEXT != null) { oLbl.setAttribute("data-mimetip", String(n.NTEXT)); }
                // 선택 강조는 노드 키 플래그로 유지(WS30 ISSEL 패턴) → 가상 재렌더(지연로드/펼침)에도
                //   스크롤 점프 없이 선택이 보존된다. (selectByKey 는 스크롤하므로 클릭 경로에서 안 씀)
                if (oState.selKey && _key(n) === oState.selKey) { oRow.setAttribute("aria-selected", "true"); }
                // 레벨/MyApp 별 행 색 — 원본 fnMimeTreeTableRowCssApply 1:1(순서/loose 비교 동일).
                //   ZLEVEL1=또렷 / ZLEVEL2=흐림 / MYAPP=또렷+선택틴트bg / MYAPPCHILD=또렷 / 그외 폴더=흐림 / 그외 파일=또렷.
                var z = n.ZLEVEL, my = n.MYAPP, myc = n.MYAPPCHILD, ty = n.TYPE;
                if (z == 1) { /* 시스템 루트 = 또렷(기본) */ }
                else if (z == 2) { oRow.classList.add("u4aMimeMuted"); }
                else if (my === "X") { oRow.classList.add("u4aMimeMyApp"); }
                else if (myc === "X") { /* 내 APP 하위 = 또렷(기본) */ }
                else if (ty === "F") { oRow.classList.add("u4aMimeMuted"); }
            }
        });

        oTree.el.classList.add("u4aMimeTree");   // CSS 스코프(WS30 u4aWs30Tree 와 동일 컬럼정렬 이식).
        return oTree;
    }

    // 선택된 트리 노드(상태에서 보관) — 툴바 펼치기/접기가 사용.
    function lf_selNode() {
        try {
            var oRow = oUI.treeBody.querySelector('.u4a-tree__row[aria-selected="true"]');
            if (oRow && oRow.__mimeNode) { return oRow.__mimeNode; }
        } catch (e) { }
        return oState.oSel;
    }

    /************************************************************************
     * 트리 행 선택 → 속성 채우기 + 미리보기(원본 ev_MimeTreeTableRowSelect).
     ************************************************************************/
    // 클릭한 행에 선택 강조를 직접 적용(스크롤 점프 없음). 다른 행 해제.
    function lf_markSelectedRow(oRow) {
        if (!oUI || !oUI.treeBody) { return; }
        var aSel = oUI.treeBody.querySelectorAll('.u4a-tree__row[aria-selected="true"]');
        for (var i = 0; i < aSel.length; i++) { if (aSel[i] !== oRow) { aSel[i].removeAttribute("aria-selected"); } }
        if (oRow) { oRow.setAttribute("aria-selected", "true"); }
    }

    function lf_onRowSelect(oNode, oRow) {

        oState.oSel = oNode;
        oState.selKey = _key(oNode);

        // 선택 강조 — 이미 보이는 클릭 행에 직접 적용(★스크롤 이동 금지, WS30 동일).
        lf_markSelectedRow(oRow);

        // 속성/미리보기 초기화.
        lf_setProps({});
        lf_showPreview("none");

        // 폴더면 종료(미리보기 없음).
        if (!oNode || oNode.TYPE === "F") { return; }

        // 속성(파일명/URL/생성정보)은 노드에서 즉시 표시.
        lf_setProps({ NAME: oNode.NTEXT, URL: oNode.URL, ERDAT: oNode.ERDAT, ERZET: oNode.ERZET, ERNAM: oNode.ERNAM });

        // 로그인 유지 확인 → 마임 오브젝트(blob) → 미리보기.
        var fnGet = function () { lf_getMimeObject(oNode.URL, lf_preview); };
        try {
            if (APPCOMMON.sendAjaxLoginChk) {
                APPCOMMON.sendAjaxLoginChk(function (oReturn) {
                    if (!oReturn || oReturn.RETCD !== "S") { try { parent.setBusy(""); } catch (e) { } return; }
                    fnGet();
                });
            } else { fnGet(); }
        } catch (e) { fnGet(); }
    }

    // POST /getmimeobj → blob (원본 fnGetMimeObject).
    function lf_getMimeObject(sUrl, fnSuccess) {
        var sPath = parent.getServerPath() + "/getmimeobj",
            oFormData = new FormData();
        oFormData.append("URL", sUrl);
        try { parent.setBusy("X"); } catch (e) { }
        // sendAjax(path, form, success, busy, async, meth, error, blob)
        sendAjax(sPath, oFormData, fnSuccess, null, null, "POST", null, "X");
    }

    // blob → 미리보기. ★MIME 기반 분기★ (구 화이트리스트 폐기 — Monaco 로 텍스트 계열 전부 표시).
    //   이미지=img / PDF=내장뷰어 iframe / 텍스트(또는 미지정+휴리스트 통과)=Monaco / 그 외 바이너리=불가.
    function lf_preview(oBlob) {
        if (!oBlob || oBlob.size === 0) { try { parent.setBusy(""); } catch (e) { } return; }

        var sMime = String(oBlob.type || "").toLowerCase();
        var sName = (oState.oSel && oState.oSel.NTEXT) || "";

        // 1) 이미지 — objectURL(base64 비용 회피, 디코드 off-main-thread).
        if (sMime.indexOf("image/") === 0) {
            lf_showPreview("image", URL.createObjectURL(oBlob));
            try { parent.setBusy(""); } catch (e2) { }
            return;
        }

        // 1.5) 오디오/비디오 — Chromium 네이티브 재생(objectURL).
        var sMedia = _mediaKind(sName, sMime);
        if (sMedia === "audio" || sMedia === "video") {
            lf_showPreview(sMedia, URL.createObjectURL(oBlob));
            try { parent.setBusy(""); } catch (e2) { }
            return;
        }

        // 2) PDF — Chromium 내장 PDF 뷰어(plugins:true 필요). ★blob: URL 은 PDF 뷰어가 iframe 에서 렌더하지 않음★
        //   (Electron 알려진 제약 — file://·http 는 되지만 blob 은 가로채지 않아 빈 화면). → 임시파일로 써서 file:// 로 로드.
        if (sMime === "application/pdf" || /\.pdf$/i.test(sName)) {
            lf_showPdf(oBlob);
            return;
        }

        // 3) 명백한 바이너리(미디어/폰트/압축/오피스 등) → 미리보기 불가.
        if (_isBinaryMime(sMime)) {
            lf_showPreview("none");
            try { parent.setBusy(""); } catch (e2) { }
            return;
        }

        // 4) 그 외 = 텍스트로 시도(text/* 및 json/py/sql/yaml… + octet-stream/미지정). 디코드 후 바이너리면 불가.
        var reader = new FileReader();
        reader.onload = function (e) {
            var sText = e.target.result;
            if (_looksBinary(sText)) {
                lf_showPreview("none");
            } else {
                lf_showPreview("text", { text: sText, lang: _langOf(sName, sMime) });
            }
            try { parent.setBusy(""); } catch (e2) { }
        };
        reader.onerror = function () { lf_showPreview("none"); try { parent.setBusy(""); } catch (e2) { } };
        reader.readAsText(oBlob, "UTF-8");
    }

    // PDF 호스트(iframe) URL — pdf.js 호스트(plugins 무관, 자체 렌더). 최초 PDF 선택 시 1회 로드(지연).
    function lf_pdfHostUrl() {
        var oQ = encodeURIComponent(JSON.stringify({ HOSTID: C_PDFHOST, THEME: _editorTheme() }));
        var sSrc;
        try {
            var _PATH = parent.PATH;
            var _PI = parent.require(_PATH.join(parent.APPPATH, "ws30", "resources", "pathInfo.js"));
            sSrc = _PATH.join(_PI.JS_ROOT, "pdfviewer", "index.html");
        } catch (e) {
            sSrc = "./js/pdfviewer/index.html";
        }
        return sSrc + "?PARAMS=" + oQ;
    }
    // PDF 호스트로 데이터(ArrayBuffer) 전송(transfer).
    function lf_pdfPost(ab) {
        try {
            if (oUI && oUI.pdf && oUI.pdf.contentWindow) {
                oUI.pdf.contentWindow.postMessage({ __u4apdf: true, hostId: C_PDFHOST, cmd: "open", data: ab }, "*", [ab]);
            }
        } catch (e) { console.error("[HTML5][MIME] pdf post error:", e); }
    }

    // PDF 미리보기 — blob → ArrayBuffer → pdf.js 호스트로 전송(자체 렌더). Chromium plugins 불필요.
    function lf_showPdf(oBlob) {
        oBlob.arrayBuffer().then(function (ab) {
            lf_showPreview("pdf");
            if (!oUI.pdf.getAttribute("src")) { oUI.pdf.src = lf_pdfHostUrl(); }   // 최초 1회 호스트 로드
            if (oUI.pdfReady) { lf_pdfPost(ab); }
            else { oState.pendingPdf = ab; }   // ready 메시지에서 전송
            try { parent.setBusy(""); } catch (e) { }
        }).catch(function () {
            lf_showPreview("none");
            try { parent.setBusy(""); } catch (e) { }
        });
    }

    // 미리보기 표시 전환 — image | audio | video | pdf | text | none.
    function lf_showPreview(sMode, oPayload) {
        if (!oUI) { return; }

        // 이전 objectURL 해제(이미지/오디오/비디오 공용 단일 슬롯).
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
        // 미디어는 전환 시 정지 + src 해제(소리/재생 잔존 방지).
        if (!bAudio) { try { oUI.audio.pause(); } catch (e) { } oUI.audio.removeAttribute("src"); }
        if (!bVideo) { try { oUI.video.pause(); } catch (e) { } oUI.video.removeAttribute("src"); }
        // PDF 호스트(iframe)는 재사용(언로드 X) — PDF 가 아닌 모드면 메모리 해제 위해 clear 명령만.
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
            return;   // src(호스트)는 lf_showPdf 에서 1회 로드, 데이터는 postMessage 로 전송.
        }
        if (bText) {
            if (oUI.hostReady) {
                lf_toHost({ cmd: "setLanguage", language: oPayload.lang });
                lf_toHost({ cmd: "setReadOnly", readOnly: true });
                lf_toHost({ cmd: "setValue", value: oPayload.text });
                lf_toHost({ cmd: "layout" });   // 숨김→표시 전환 시 0크기로 생성됐을 수 있어 레이아웃 보정.
            } else {
                oState.pendingText = oPayload;   // ready 시 반영.
            }
            return;
        }
        // none — 미리보기 불가 안내만.
    }

    /************************************************************************
     * 속성 패널 값 세팅 — URL / Create(date·time·name). 날짜/시간 포맷 원본 보존.
     ************************************************************************/
    function _fmtDate(v) {
        if (!v) { return ""; }
        return v.substring(0, 4) + "-" + v.substring(4, 6) + "-" + v.substring(6, 8);
    }
    function _fmtTime(v) {
        if (!v) { return ""; }
        return v.substring(0, 2) + ":" + v.substring(2, 4) + ":" + v.substring(4, 6);
    }
    function lf_setProps(o) {
        if (!oUI) { return; }
        oUI.fileField.setValue(o.NAME || "");
        oUI.fileField.input.setAttribute("data-mimetip", o.NAME || "");   // 말줄임 시 화면 전용 툴팁
        oUI.urlField.setValue(o.URL || "");
        oUI.urlField.input.setAttribute("data-mimetip", o.URL || "");
        oUI.dateField.setValue(_fmtDate(o.ERDAT));
        oUI.timeField.setValue(_fmtTime(o.ERZET));
        oUI.nameField.setValue(o.ERNAM || "");
        oUI.nameField.input.setAttribute("data-mimetip", o.ERNAM || "");
    }

    /************************************************************************
     * URL Copy (원본 ev_pressMimeUrlCopy) — 입력값 선택 → execCommand copy → 토스트(303).
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
            // 폴백 — 임시 textarea.
            try {
                var ta = document.createElement("textarea");
                ta.value = sVal; document.body.appendChild(ta); ta.select();
                document.execCommand("copy"); document.body.removeChild(ta);
            } catch (e2) { }
        }
        try { parent.showMessage(null, 10, "S", _txt("/U4A/MSG_WS", "303")); } catch (e) { } // Clipboard Copy Success!
    }

    /************************************************************************
     * 펼치기/접기(서브트리) — 원본 fnCommonMimeTreeTableExpand / Collapse.
     *   ★ 펼침 단일출처가 외부 맵(oExpand)이므로(가상 트리 isExpanded 위임), createTree 내부
     *     _expanded 를 만지는 expandAll/expandSubtree/setExpanded 헬퍼는 무시된다 → oExpand 직접 조작.
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
    function _hasKids(n) { return !!(n && Array.isArray(n.MIMETREE) && n.MIMETREE.length > 0); }
    function lf_expandSel() {
        var n = lf_selNode();
        if (!n) { return; }
        if (n.ZLEVEL === 1 || n.ZLEVEL === 2) {
            // 전체 펼침(로드된 노드 한정 — 원본 expandToLevel(99) 동일 의미).
            _walkNodes(aTreeRoots, function (x) { if (_hasKids(x)) { oExpand[x.CHILD] = true; } });
        } else {
            // 서브트리 펼침(자신+자손 폴더).
            (function rec(x) {
                if (_hasKids(x)) { oExpand[x.CHILD] = true; x.MIMETREE.forEach(rec); }
            })(n);
        }
        oUI.tree.render();
    }
    function lf_collapseSel() {
        var n = lf_selNode();
        if (!n) { return; }
        oExpand[n.CHILD] = false;
        oUI.tree.render();
    }

    /************************************************************************
     * 화면 전용 툴팁 — [data-mimetip] 요소에 hover 시(가로 말줄임된 경우만) 다이얼로그 안에 띄움.
     *   공통 .u4a-tooltip 은 document.body 에 붙어 showModal(top-layer) 다이얼로그 뒤에 깔려 안 보임.
     *   → 툴팁 엘리먼트를 다이얼로그(top-layer) 안에 두어 위로 뜨게 한다. (공통 미수정, 스코프 덧대기)
     ************************************************************************/
    function lf_initTip(oDlg, oScrollEl) {
        var oTip = _el("div", "u4aMimeTip");
        oTip.setAttribute("aria-hidden", "true");
        oDlg.appendChild(oTip);

        function hide() { oTip.classList.remove("u4aMimeTipShow"); }
        function _pos(x, y) {
            var w = oTip.offsetWidth, h = oTip.offsetHeight;
            var nx = Math.min(x + 14, window.innerWidth - w - 8);
            var ny = Math.min(y + 18, window.innerHeight - h - 8);
            oTip.style.left = Math.max(8, nx) + "px";
            oTip.style.top = Math.max(8, ny) + "px";
        }
        oDlg.addEventListener("mouseover", function (e) {
            var el = e.target.closest("[data-mimetip]");
            if (!el) { hide(); return; }
            var s = el.getAttribute("data-mimetip");
            // 가로 말줄임된 경우에만(잘리지 않았으면 툴팁 불필요).
            if (!s || el.scrollWidth <= el.clientWidth + 1) { hide(); return; }
            oTip.textContent = s;
            oTip.classList.add("u4aMimeTipShow");
            _pos(e.clientX, e.clientY);
        });
        oDlg.addEventListener("mousemove", function (e) {
            if (!oTip.classList.contains("u4aMimeTipShow")) { return; }
            if (!e.target.closest("[data-mimetip]")) { hide(); return; }
            _pos(e.clientX, e.clientY);
        });
        oDlg.addEventListener("mouseleave", hide);
        if (oScrollEl) { oScrollEl.addEventListener("scroll", hide, true); }
    }

    /************************************************************************
     * 다이얼로그 + 트리/미리보기/속성 1회 생성(이후 재사용).
     ************************************************************************/
    function lf_build() {

        lf_ensureStyle();

        var oDlg = document.createElement("dialog");
        oDlg.id = C_DLG_ID;
        oDlg.className = "u4a-dialog u4aMimeDlg";

        // ── 헤더(48px) — picture 아이콘 + 제목(C26) + 닫기(X) ──
        var oHeader = _el("div", "u4a-dialog__header u4aMimeHead");
        oHeader.innerHTML = _fa("image") + "<span></span>";
        oHeader.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "C26"); // U4A MIME Repository
        var oXBtn = _el("button", "u4a-btn-icon");
        oXBtn.type = "button";
        oXBtn.innerHTML = _fa("xmark");
        oXBtn.title = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oXBtn.addEventListener("click", function () { lf_close(); });
        oHeader.appendChild(oXBtn);
        oDlg.appendChild(oHeader);

        // ── 바디 — 가로 스플리터 [트리 | (속성/미리보기 세로분할)] ──
        var oBody = _el("div", "u4a-dialog__body u4aMimeBody");
        var oSplit = _el("div", "u4a-splitter u4aMimeSplit");

        // 좌: 트리 패널.
        var oTreePane = _el("div", "u4a-splitter__pane u4aMimeTreePane");
        oTreePane.style.flex = "0 1 42%";
        oTreePane.style.minWidth = "260px";

        var oTreeTool = _el("div", "u4aMimeTreeTool");
        var oExpBtn = _el("button", "u4a-btn-icon u4aMimeToolBtn");
        oExpBtn.type = "button"; oExpBtn.innerHTML = _fa("angles-down");
        oExpBtn.title = _txt("/U4A/CL_WS_COMMON", "C27"); // Expand Subtree
        oExpBtn.addEventListener("click", lf_expandSel);
        var oColBtn = _el("button", "u4a-btn-icon u4aMimeToolBtn");
        oColBtn.type = "button"; oColBtn.innerHTML = _fa("angles-up");
        oColBtn.title = _txt("/U4A/CL_WS_COMMON", "C28"); // Collapse Subtree
        oColBtn.addEventListener("click", lf_collapseSel);
        oTreeTool.appendChild(oExpBtn);
        oTreeTool.appendChild(oColBtn);
        // 우측 정렬용 스페이서 + MyApp(현재 앱 MIME 폴더로 스크롤 이동) 버튼 — ★아이콘+텍스트 라벨★.
        //   (아이콘만 두면 무슨 버튼인지 모름. 공통 title 툴팁은 모달 top-layer 뒤에 깔려 안 보임 → 라벨 노출.)
        oTreeTool.appendChild(_el("span", "u4aMimeToolSpacer"));
        var oMyAppBtn = _el("button", "u4a-btn u4aMimeMyAppBtn");
        oMyAppBtn.type = "button";
        oMyAppBtn.innerHTML = _fa("location-crosshairs") + "<span></span>";
        oMyAppBtn.querySelector("span").textContent =
            _txt("/U4A/CL_WS_COMMON", "D00") + " " + _txt("/U4A/CL_WS_COMMON", "A30"); // Current MIME Folder
        oMyAppBtn.hidden = true;   // 현재 앱 MIME 폴더가 확인되면 표시.
        oMyAppBtn.addEventListener("click", lf_gotoMyApp);
        oTreeTool.appendChild(oMyAppBtn);
        oTreePane.appendChild(oTreeTool);

        // 스크롤 컨테이너(가상스크롤 wrap) — sticky 컬럼헤더 + 트리.
        var oTreeBody = _el("div", "u4aMimeTreeBody");
        var oColHead = _el("div", "u4aMimeTreeColHead");
        oColHead.appendChild(_el("span", "u4aMimeColName", _txt("/U4A/CL_WS_COMMON", "A50")));  // Object Name
        oColHead.appendChild(_el("span", "u4aMimeColDesc", _txt("/U4A/CL_WS_COMMON", "A35")));  // Description
        oTreeBody.appendChild(oColHead);

        var oTree = lf_buildTreeCmp();
        oTreeBody.appendChild(oTree.el);
        oTreePane.appendChild(oTreeBody);

        var oBarH = _el("div", "u4a-splitter__bar");
        oBarH.setAttribute("role", "separator");

        // 우: 속성/미리보기 세로 분할.
        var oRightPane = _el("div", "u4a-splitter__pane u4aMimeRightPane");
        // 기저(basis)=0 — auto 면 내용물(미리보기) 크기로 기저가 잡혀 라인 선택 시 바가 혼자 움직인다.
        //   0 으로 두면 grow 로 잔여만 채우고 내용 크기와 무관 → 바 위치 고정.
        oRightPane.style.flex = "1 1 0%";
        oRightPane.style.minWidth = "260px";

        // ── 속성: 공통 접이식 패널(U4AUI.createPanel) — USP 우측과 동일(세로 스플릿바 없음, 접으면 미리보기 확장) ──
        var oPanel = U4AUI.createPanel({ title: _txt("/U4A/CL_WS_COMMON", "C17") }); // Properties
        oPanel.el.classList.add("u4aMimePropPanel");

        var oForm = _el("div", "u4aMimeForm");

        // File Name 행 — 현재 선택 파일명(사용자 요청, 원본엔 없던 표시).
        var oFnRow = _el("div", "u4aMimeFormRow");
        oFnRow.appendChild(_el("label", "u4aMimeLbl", _txt("/U4A/CL_WS_COMMON", "C35"))); // File Name
        var oFnBox = _el("div", "u4aMimeUrlBox");
        var oFileField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeUrlField" });
        oFnBox.appendChild(oFileField.el);
        oFnRow.appendChild(oFnBox);
        oForm.appendChild(oFnRow);

        // URL 행 — 라벨 + 입력(readonly) + URL Copy.
        var oUrlRow = _el("div", "u4aMimeFormRow");
        oUrlRow.appendChild(_el("label", "u4aMimeLbl", _txt("/U4A/CL_WS_COMMON", "C18"))); // URL
        var oUrlBox = _el("div", "u4aMimeUrlBox");
        var oUrlField = U4AUI.createField({ type: "text", value: "", readOnly: true, className: "u4aMimeUrlField" });
        oUrlBox.appendChild(oUrlField.el);
        var oCopyBtn = _el("button", "u4a-btn u4aMimeCopyBtn");
        oCopyBtn.type = "button";
        oCopyBtn.innerHTML = _fa("copy") + "<span></span>";
        oCopyBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "C21"); // URL Copy
        oCopyBtn.addEventListener("click", lf_urlCopy);
        oUrlBox.appendChild(oCopyBtn);
        oUrlRow.appendChild(oUrlBox);
        oForm.appendChild(oUrlRow);

        // Create 행 — 라벨 + [date][time][name].
        var oCrRow = _el("div", "u4aMimeFormRow");
        oCrRow.appendChild(_el("label", "u4aMimeLbl", _txt("/U4A/CL_WS_COMMON", "A01"))); // Create
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

        // ── 미리보기 영역(하단, 잔여 채움) — img / PDF iframe / Monaco iframe / no-data ──
        var oPrevPane = _el("div", "u4aMimePrevPane");

        var oImg = _el("img", "u4aMimeImg");
        oImg.hidden = true;
        oImg.alt = "";

        // PDF — pdf.js 호스트(iframe). src 는 최초 PDF 선택 시 1회 지연 로드(lf_showPdf).
        var oPdf = document.createElement("iframe");
        oPdf.className = "u4aMimePdf";
        oPdf.setAttribute("frameborder", "0");
        oPdf.hidden = true;

        // 오디오/비디오 — Chromium 네이티브 재생.
        var oAudio = document.createElement("audio");
        oAudio.className = "u4aMimeAudio"; oAudio.controls = true; oAudio.preload = "metadata"; oAudio.hidden = true;
        var oVideo = document.createElement("video");
        oVideo.className = "u4aMimeVideo"; oVideo.controls = true; oVideo.preload = "metadata"; oVideo.hidden = true;

        var oFrame = document.createElement("iframe");
        oFrame.className = "u4aMimeFrame";
        oFrame.setAttribute("frameborder", "0");
        oFrame.hidden = true;
        var oQuery = encodeURIComponent(JSON.stringify({
            HOSTID: C_HOSTID, LANG: "plaintext", THEME: _editorTheme(), READONLY: true
        }));
        var sHostSrc;
        try {
            var _PATH = parent.PATH;
            var _PATHINFO = parent.require(_PATH.join(parent.APPPATH, "ws30", "resources", "pathInfo.js"));
            sHostSrc = _PATH.join(_PATHINFO.JS_ROOT, "codeeditor", "index.html");
        } catch (e) {
            sHostSrc = "./js/codeeditor/index.html";
        }
        oFrame.src = sHostSrc + "?PARAMS=" + oQuery;

        var oNoData = _el("div", "u4aMimeNoData2");
        oNoData.appendChild(_el("span", null, _txt("/U4A/MSG_WS", "313"))); // This file can't be previewed.

        oPrevPane.appendChild(oImg);
        oPrevPane.appendChild(oPdf);
        oPrevPane.appendChild(oAudio);
        oPrevPane.appendChild(oVideo);
        oPrevPane.appendChild(oFrame);
        oPrevPane.appendChild(oNoData);

        // 우측 = 패널(상단, 자연 높이/접힘) + 미리보기(하단, 잔여). 세로 스플릿바 없음(USP 우측 패턴).
        oRightPane.appendChild(oPanel.el);
        oRightPane.appendChild(oPrevPane);

        oSplit.appendChild(oTreePane);
        oSplit.appendChild(oBarH);
        oSplit.appendChild(oRightPane);
        oBody.appendChild(oSplit);
        oDlg.appendChild(oBody);

        // ── 푸터(48px) — Close(Reject) ──
        var oFoot = _el("div", "u4a-dialog__footer u4aMimeFoot");
        var oCloseBtn = _el("button", "u4a-btn u4a-btn--negative u4aMimeCloseBtn");
        oCloseBtn.type = "button";
        oCloseBtn.innerHTML = _fa("xmark") + "<span></span>";
        oCloseBtn.querySelector("span").textContent = _txt("/U4A/CL_WS_COMMON", "A39"); // Close
        oCloseBtn.addEventListener("click", function () { lf_close(); });
        oFoot.appendChild(oCloseBtn);
        oDlg.appendChild(oFoot);

        // ESC → 닫기. (busy 중에는 무시 — 원본 escapeHandler)
        oDlg.addEventListener("cancel", function (e) {
            e.preventDefault();
            var bBusy = false;
            try { bBusy = (parent.getBusy && parent.getBusy() === "X"); } catch (e2) { }
            if (!bBusy) { lf_close(); }
        });

        // 헤더 드래그 / 더블클릭 리센터 / 우하단 grip 리사이즈 — 전 팝업 공통.
        if (window.U4AUI && U4AUI.makeDialogRecenter) { U4AUI.makeDialogRecenter(oDlg, oHeader); }
        if (window.U4AUI && U4AUI.makeDialogResizable) { U4AUI.makeDialogResizable(oDlg, { minW: 640, minH: 420 }); }

        document.body.appendChild(oDlg);

        // 화면 전용 툴팁(다이얼로그 안=top-layer) — 공통 툴팁(body)이 모달 뒤에 깔리는 문제 회피.
        lf_initTip(oDlg, oTreeBody);

        // 스플리터 드래그 — 가로 1개(트리|우측)뿐. 좌측만 px, 우측 grow 유지(리사이즈 자동 충전).
        _bindSplit(oBarH);
        _bindSplitResizeClamp(oSplit);

        // 영속 리스너 — 다이얼로그 수명과 동일(1회 등록, 누적 없음).
        window.addEventListener("message", lf_onMessage);
        try { window.addEventListener("u4a-theme-changed", lf_onThemeChange); } catch (e) { }
        try { if (window.parent) { window.parent.addEventListener("u4a-theme-changed", lf_onThemeChange); } } catch (e) { }

        oUI = {
            dlg: oDlg, frame: oFrame, img: oImg, pdf: oPdf, audio: oAudio, video: oVideo, nodata: oNoData,
            tree: oTree, treeBody: oTreeBody, panel: oPanel, myAppBtn: oMyAppBtn,
            fileField: oFileField, urlField: oUrlField, dateField: oDateField, timeField: oTimeField, nameField: oNameField,
            split: oSplit, hostReady: false
        };
    }

    /************************************************************************
     * 스플리터 드래그(가로 1개: 트리|우측) — ★좌측(트리)만 px 로 고정, 우측은 grow(1 1 0%) 유지.
     *   (doc16 §4.3 "마지막 유연 패널 보호") → 모달 리사이즈 시 우측이 자동으로 잔여를 채워 빈 공간이 안 생긴다.
     *   (양쪽을 둘 다 0 0 px 로 고정하면 모달을 키워도 우측이 안 늘어나 우측에 빈 띠가 생겼다.)
     ************************************************************************/
    function _paneMin(el) {
        var v = parseFloat(el.style.minWidth || "");
        return isFinite(v) && v > 0 ? v : 120;   // 폴백 120px.
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
            var maxA = oSplit.clientWidth - _barsW(oSplit) - _paneMin(oB);   // 우측 최소폭 보호
            if (a < am) { a = am; }
            if (a > maxA) { a = maxA; }
            oA.style.flex = "0 0 " + a + "px";   // 우측(oB)은 건드리지 않음 → grow 로 잔여 자동 채움
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
    // 창 리사이즈 재클램프(가로 분할만 — px 고정 패널이 줄어든 창을 넘지 않게). 1회 바인딩.
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
            aPanes.forEach(function (p) { if (_px(p) != null) { aFixed.push(p); } else { iFlexMin += _paneMin(p, false); } });
            var iFixedW = 0; aFixed.forEach(function (p) { iFixedW += _px(p); });
            var iNeed = (iFixedW + iBars + iFlexMin) - iAvail;
            if (iNeed <= 0) { return; }
            aFixed.slice().sort(function (a, b) { return _px(b) - _px(a); }).forEach(function (p) {
                if (iNeed <= 0) { return; }
                var iCur = _px(p), iMin = _paneMin(p, false);
                var iCut = Math.min(Math.max(0, iCur - iMin), iNeed);
                if (iCut > 0) { p.style.flex = "0 0 " + (iCur - iCut) + "px"; iNeed -= iCut; }
            });
        });
    }

    // 팝업 닫기 — 숨김(재사용). busy 해제.
    function lf_close() {
        try { clearTimeout(iWatch); } catch (e) { }
        lf_busy(false);
        try { parent.setBusy(""); } catch (e) { }
        try { if (oUI && oUI.dlg && oUI.dlg.open) { oUI.dlg.close(); } } catch (e) { }
    }

    /************************************************************************
     * 공개 진입점 — MIME Repository 팝업 열기(원본 oAPP.fn.fnMimePopupOpen).
     ************************************************************************/
    oAPP.fn.fnMimePopupOpen = function () {

        // 푸터 메시지가 있을 경우 닫기(원본 동일).
        try { APPCOMMON.fnHideFloatingFooterMsg(); } catch (e) { }

        // 열 때마다 최신 스타일 보장(다이얼로그 캐시 재사용 시에도 CSS 갱신 반영).
        lf_ensureStyle();

        // 최초 1회 생성(DOM 에서 사라졌으면 재생성).
        if (!oUI || !document.body.contains(oUI.dlg)) {
            oUI = null;
            lf_build();
        }

        // 초기화 — 속성/미리보기 비우기.
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

        if (!oUI.dlg.open) { try { oUI.dlg.showModal(); } catch (e) { } }

        // 열린 뒤(레이아웃 확정) 트리 데이터 로드.
        lf_loadTree();

    }; // end of oAPP.fn.fnMimePopupOpen

    /************************************************************************
     * 공통 스타일 1회 주입(테마 토큰 소비 — 하드코딩 색 없음).
     ************************************************************************/
    function lf_ensureStyle() {
        var sCss = [
            // 다이얼로그 — 넉넉한 반응형 크기 + 세로 flex(바디가 늘어 푸터 하단 고정).
            ".u4aMimeDlg { width: min(94vw, 1240px); height: min(90vh, 800px); padding: 0; display: flex; flex-direction: column; }",
            ".u4aMimeDlg .u4a-dialog__header { cursor: move; user-select: none; }",
            ".u4aMimeHead span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
            ".u4aMimeBody { flex: 1 1 auto; min-width: 0; min-height: 0; padding: 0; display: flex; }",
            ".u4aMimeSplit { flex: 1 1 auto; width: 100%; min-width: 0; min-height: 0; }",
            // 트리 패널 — 툴바 + 스크롤바디(가상스크롤 wrap). 설명 컬럼 폭 단일출처(WS30 --ws30-desc-w 동일 42%).
            ".u4aMimeTreePane { --u4aMime-desc-w: 42%; display: flex; flex-direction: column; background: var(--surface); overflow: hidden; }",
            ".u4aMimeTreeTool { flex: 0 0 auto; display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.375rem; border-bottom: 0.0625rem solid var(--line); }",
            ".u4aMimeToolBtn { color: var(--text); }",
            ".u4aMimeToolSpacer { flex: 1 1 auto; }",
            ".u4aMimeMyAppBtn { flex: 0 1 auto; min-width: 0; height: 1.75rem; padding: 0 0.625rem; white-space: nowrap; }",
            ".u4aMimeMyAppBtn span { overflow: hidden; text-overflow: ellipsis; }",
            ".u4aMimeMyAppBtn[hidden] { display: none; }",
            ".u4aMimeTreeBody { flex: 1 1 auto; min-height: 0; overflow: hidden auto; position: relative; }",
            // sticky 컬럼 헤더 — 행과 동일 폭 컨텍스트(padding-left 0.375rem = 행과 동일) → 설명컬럼 정렬 일치(WS30 이식).
            ".u4aMimeTreeColHead { position: sticky; top: 0; z-index: 2; box-sizing: border-box; display: flex; align-items: stretch; height: 2.25rem; padding-left: 0.375rem; background: var(--surface-raised); border-bottom: 0.0625rem solid var(--line); font-size: 0.8125rem; font-weight: 700; color: var(--text); }",
            ".u4aMimeColName { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; padding-left: 0.5rem; }",
            ".u4aMimeColDesc { flex: 0 0 var(--u4aMime-desc-w); min-width: 0; box-sizing: border-box; display: flex; align-items: center; padding-left: 0.5rem; border-left: 0.0625rem solid var(--line); }",
            // 트리 — 행을 패널 폭에 맞춰 설명 컬럼 항상 보이게(공통 max-content 무력화).
            ".u4aMimeTree.u4a-tree { width: auto; min-width: 100%; padding-top: 0; }",
            // ★ data-u4a-tree-split(space-between) 무력화 + 라벨이 남는 폭 채움 → 토글/아이콘/라벨이 흩어지지 않고
            //   설명은 고정폭 우측 컬럼이 된다(WS30 핵심). 이게 빠지면 라벨/설명이 가로로 흩뿌려진다.
            ".u4aMimeTree .u4a-tree__row[data-u4a-tree-split] { justify-content: flex-start; }",
            ".u4aMimeRow { padding-right: 0; }",
            ".u4aMimeRow .u4a-tree__label { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
            // ★ 들여쓰기를 행 padding-left → 토글 margin-left 로 이동: 행 content-box 폭을 깊이와 무관하게
            //   일정하게 유지해야 설명 컬럼(flex-basis %)/구분선이 컬럼헤더와 정렬 일치(WS30 핵심).
            ".u4aMimeTree .u4a-tree__row { padding-left: 0.375rem; }",
            ".u4aMimeTree .u4a-tree__toggle { margin-left: calc(var(--u4a-tree-depth, 0) * var(--u4a-tree-indent-step, 1rem)); }",
            // 설명 셀(고정폭 우측 컬럼) + 텍스트(클램프).
            ".u4aMimeDesc { flex: 0 0 var(--u4aMime-desc-w); min-width: 0; box-sizing: border-box; align-self: stretch; display: flex; align-items: center; padding-left: 0.5rem; border-left: 0.0625rem solid var(--line); }",
            // 행별 상태 색 — 원본 fnMimeTreeTableRowCssApply 1:1. 이름(.u4a-tree__label)+설명(.u4aMimeDescText) 동일색.
            //   sapTextColor→--text(기본), sapContent_DisabledTextColor→--text-muted, sapUiTableRowSelectionBG(@.6)→--selected-bg.
            ".u4aMimeDescText { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-size: 0.8125rem; }",
            // 흐림(원본 sapContent_DisabledTextColor) = --disabled-text(--text-muted 보다 더 옅음, 테마 자동추종).
            ".u4aMimeMuted .u4a-tree__label, .u4aMimeMuted .u4aMimeDescText { color: var(--disabled-text); }",
            ".u4aMimeMyApp { background: var(--selected-bg); }",
            ".u4aMimeNoData .u4a-tree__label { color: var(--disabled-text); font-style: italic; }",
            // 선택 행은 공통 선택 텍스트색이 레벨색을 이기게(이름/설명 모두) — explicit 색이라 inherit 안 되므로 명시.
            ".u4aMimeTree .u4a-tree__row[aria-selected=\"true\"] .u4a-tree__label, .u4aMimeTree .u4a-tree__row[aria-selected=\"true\"] .u4aMimeDescText { color: var(--selected-text); }",
            // 우측 = 속성 패널(상단) + 미리보기(하단), 세로 스플릿바 없음(USP 우측 패턴). 여백(padding)+카드 간격(gap).
            ".u4aMimeRightPane { min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; overflow: hidden; background: var(--app-bg); }",
            // 속성 = 공통 둥근 카드 패널(.u4a-panel 의 border/border-radius 그대로 소비 — 평평 override 금지).
            //   자연 높이(접으면 헤더만), 폼이 길면 패널 본문만 스크롤.
            ".u4aMimePropPanel { flex: 0 0 auto; }",
            ".u4aMimePropPanel .u4a-panel__body { padding: 0.625rem 0.75rem; max-height: 40vh; overflow: auto; }",
            ".u4aMimeForm { display: flex; flex-direction: column; gap: 0.5rem; }",
            ".u4aMimeFormRow { display: flex; align-items: center; gap: 0.625rem; }",
            ".u4aMimeLbl { flex: 0 0 5rem; font-size: 0.8125rem; font-weight: 700; color: var(--text); }",
            ".u4aMimeUrlBox { flex: 1 1 auto; min-width: 0; display: flex; gap: 0.375rem; align-items: center; }",
            ".u4aMimeUrlField { flex: 1 1 auto; min-width: 0; }",
            ".u4aMimeCopyBtn { flex: 0 0 auto; white-space: nowrap; }",
            ".u4aMimeCrBox { flex: 1 1 auto; min-width: 0; display: flex; gap: 0.375rem; }",
            ".u4aMimeCrField { flex: 1 1 0; min-width: 0; }",
            ".u4aMimeCrName { flex: 1.4 1 0; }",
            // 미리보기 = 둥근 카드(패널과 동일 컨셉), 잔여 채움.
            ".u4aMimePrevPane { flex: 1 1 0; min-height: 0; min-width: 0; display: flex; flex-direction: column; background: var(--surface); border: 0.0625rem solid var(--line); border-radius: var(--radius); overflow: hidden; }",
            ".u4aMimeImg { max-width: 100%; max-height: 100%; margin: auto; object-fit: contain; }",
            ".u4aMimeFrame { flex: 1 1 auto; width: 100%; height: 100%; border: 0; display: block; background: var(--app-bg); }",
            ".u4aMimeFrame[hidden] { display: none; }",
            ".u4aMimePdf { flex: 1 1 auto; width: 100%; height: 100%; border: 0; display: block; background: var(--app-bg); }",
            ".u4aMimePdf[hidden] { display: none; }",
            // 오디오/비디오 — 네이티브 컨트롤. 오디오=가운데 가로 배치, 비디오=영역에 맞춰 contain.
            ".u4aMimeAudio { width: min(90%, 32rem); margin: auto; }",
            ".u4aMimeAudio[hidden] { display: none; }",
            ".u4aMimeVideo { max-width: 100%; max-height: 100%; margin: auto; background: #000; }",
            ".u4aMimeVideo[hidden] { display: none; }",
            ".u4aMimeImg[hidden] { display: none; }",
            ".u4aMimeNoData2 { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.9375rem; }",
            ".u4aMimeNoData2[hidden] { display: none; }",
            // 드래그 중 커서.
            ".u4aMimeResizing, .u4aMimeResizing * { cursor: col-resize !important; user-select: none !important; }",
            ".u4aMimeFoot { display: flex; justify-content: flex-end; gap: 0.5rem; }",
            // 화면 전용 툴팁(다이얼로그 안=top-layer 라 모달 위로 뜸). 색=의미 토큰.
            ".u4aMimeTip { position: fixed; z-index: 10; max-width: 28rem; padding: 0.25rem 0.5rem; border: 0.0625rem solid var(--line); border-radius: var(--radius, 0.375rem); background: var(--surface-raised); color: var(--text); font-size: 0.75rem; line-height: 1.4; box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,.25); pointer-events: none; white-space: normal; word-break: break-all; opacity: 0; visibility: hidden; transition: opacity 0.1s linear; }",
            ".u4aMimeTip.u4aMimeTipShow { opacity: 1; visibility: visible; }"
        ].join("");
        // 항상 최신 CSS 로 갱신 — 스타일을 1회만 주입하고 캐시하면, CSS 를 바꿔도 옛 규칙이 DOM 에
        //   남아 새 규칙이 안 먹는다(개발 반복/팝업 재사용 시). 있으면 내용만 교체.
        var oStyle = document.getElementById("u4aMimeStyle");
        if (!oStyle) { oStyle = document.createElement("style"); oStyle.id = "u4aMimeStyle"; document.head.appendChild(oStyle); }
        oStyle.textContent = sCss;
    }

})(window, $, oAPP);
