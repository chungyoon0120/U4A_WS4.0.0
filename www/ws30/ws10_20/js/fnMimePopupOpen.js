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
        C_HOSTID = "U4AMIME";   // Monaco 호스트(iframe) 통신 채널 식별자

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

    // 파일 확장자 → Monaco 언어.
    function _langOf(sName) {
        var ext = String(sName || "").split(".").pop().toLowerCase();
        switch (ext) {
            case "js": return "javascript";
            case "json": return "json";
            case "html": case "htm": return "html";
            case "css": return "css";
            case "xml": return "xml";
            case "ts": return "typescript";
            default: return "plaintext";
        }
    }

    // 원본 fnCheckAllowedMimeTypes — 미리보기 가능 MIME 타입(그대로 보존).
    function _isAllowedMime(sMimetype) {
        var aAllowed = [
            "text/plain", "text/html", "text/css", "text/javascript", "application/x-javascript",
            "image/jpeg", "image/png", "image/gif", "image/bmp"
        ];
        for (var i = 0; i < aAllowed.length; i++) { if (aAllowed[i] === sMimetype) { return true; } }
        return false;
    }

    /************************************************************************
     * 모듈 상태 — 다이얼로그/iframe/트리는 1회 생성 후 재사용(원본 단일 인스턴스 대응).
     ************************************************************************/
    var oUI = null;                 // { dlg, frame, tree, treeBody, img, nodata, urlField, dateField, timeField, nameField, hostReady }
    var oState = { sAppId: "", sLazy: false, oSel: null, selKey: "", pendingText: null };
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
        if (!d || d.__u4ace !== true || d.hostId !== C_HOSTID) { return; }
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
        if (!oMyApp) {
            // 없으면 첫 라인 선택(원본 setSelectedIndex(0)) — 맨 위라 스크롤 불필요.
            if (aTreeRoots[0]) { oState.selKey = aTreeRoots[0].CHILD; oUI.tree.render(); }
            return;
        }
        // 조상 경로(PARENT 체인) 펼침.
        var byKey = {};
        aFlat.forEach(function (r) { byKey[r.CHILD] = r; });
        var cur = byKey[oMyApp.PARENT];
        while (cur) { oExpand[cur.CHILD] = true; cur = byKey[cur.PARENT]; }
        // 자신에 하위가 있으면 자신도 펼침.
        if (aFlat.some(function (r) { return r.PARENT === oMyApp.CHILD; })) { oExpand[oMyApp.CHILD] = true; }
        // ★ 최초 진입 시에만 내 APP 폴더로 reveal(원본 setFirstVisibleRow). 이후 클릭은 스크롤 안 함.
        oState.selKey = oMyApp.CHILD;
        oUI.tree.render();
        oUI.tree.scrollToKey(oMyApp.CHILD);   // reveal(+선택은 selKey→rowHook 으로 적용).
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

            // 설명(Description) — 우측 정렬 trailing 슬롯.
            slotTrailing: function (n) {
                if (_isDummy(n)) { return null; }
                var d = _el("span", "u4aMimeDesc");
                var t = _el("span", "u4aMimeDescText", (n && n.MDESC != null) ? n.MDESC : "");
                if (n && n.MDESC) { t.title = n.MDESC; }
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
                // 선택 강조는 노드 키 플래그로 유지(WS30 ISSEL 패턴) → 가상 재렌더(지연로드/펼침)에도
                //   스크롤 점프 없이 선택이 보존된다. (selectByKey 는 스크롤하므로 클릭 경로에서 안 씀)
                if (oState.selKey && _key(n) === oState.selKey) { oRow.setAttribute("aria-selected", "true"); }
                // 레벨/MyApp 별 색(원본 fnMimeTreeTableRowCssApply 의미 보존 — 의미 토큰).
                var z = n.ZLEVEL, my = n.MYAPP, myc = n.MYAPPCHILD, ty = n.TYPE;
                if (z === 1) { /* 시스템 루트 = 기본 */ }
                else if (z === 2) { oRow.classList.add("u4aMimeMuted"); }
                else if (my === "X") { oRow.classList.add("u4aMimeMyApp"); }
                else if (myc === "X") { /* 내 APP 하위 = 기본(또렷) */ }
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

        // 속성(URL/생성정보)은 노드에서 즉시 표시.
        lf_setProps({ URL: oNode.URL, ERDAT: oNode.ERDAT, ERZET: oNode.ERZET, ERNAM: oNode.ERNAM });

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

    // blob → 미리보기(원본 fnSetMimeObjectPreview).
    function lf_preview(oBlob) {
        if (!oBlob || oBlob.size === 0) { try { parent.setBusy(""); } catch (e) { } return; }

        var sMime = oBlob.type;
        if (!_isAllowedMime(sMime)) {
            try { parent.setBusy(""); } catch (e) { }
            lf_showPreview("none");   // 미리보기 불가 안내.
            return;
        }

        var reader = new FileReader();
        if (sMime.indexOf("image") === 0) {
            reader.onload = function (e) {
                lf_showPreview("image", e.target.result);
                try { parent.setBusy(""); } catch (e2) { }
            };
            reader.readAsDataURL(oBlob);
            return;
        }
        reader.onload = function (e) {
            lf_showPreview("text", { text: e.target.result, lang: _langOf(oState.oSel && oState.oSel.NTEXT) });
            try { parent.setBusy(""); } catch (e2) { }
        };
        reader.readAsText(oBlob, "UTF-8");
    }

    // 미리보기 표시 전환 — image | text | none.
    function lf_showPreview(sMode, oPayload) {
        if (!oUI) { return; }
        oUI.img.hidden = (sMode !== "image");
        oUI.frame.hidden = (sMode !== "text");
        oUI.nodata.hidden = (sMode !== "none");

        if (sMode === "image") {
            oUI.img.src = oPayload || "";
            return;
        }
        if (sMode === "text") {
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
        // none — 이미지 비우기.
        oUI.img.src = "";
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
        oUI.urlField.setValue(o.URL || "");
        oUI.dateField.setValue(_fmtDate(o.ERDAT));
        oUI.timeField.setValue(_fmtTime(o.ERZET));
        oUI.nameField.setValue(o.ERNAM || "");
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
        oRightPane.style.flex = "1 1 auto";
        oRightPane.style.minWidth = "260px";

        var oVSplit = _el("div", "u4a-splitter u4aMimeVSplit");

        // 속성 패널.
        var oPropPane = _el("div", "u4a-splitter__pane u4aMimePropPane");
        oPropPane.style.flex = "0 0 168px";
        oPropPane.style.minHeight = "120px";
        var oPropHdr = _el("div", "u4aMimePropHdr", _txt("/U4A/CL_WS_COMMON", "C17")); // Properties
        oPropPane.appendChild(oPropHdr);

        var oForm = _el("div", "u4aMimeForm");
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
        oPropPane.appendChild(oForm);

        var oBarV = _el("div", "u4a-splitter__bar");
        oBarV.setAttribute("role", "separator");

        // 미리보기 패널 — img / Monaco iframe / no-data.
        var oPrevPane = _el("div", "u4a-splitter__pane u4aMimePrevPane");
        oPrevPane.style.flex = "1 1 auto";
        oPrevPane.style.minHeight = "120px";

        var oImg = _el("img", "u4aMimeImg");
        oImg.hidden = true;
        oImg.alt = "";

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
        oPrevPane.appendChild(oFrame);
        oPrevPane.appendChild(oNoData);

        oVSplit.appendChild(oPropPane);
        oVSplit.appendChild(oBarV);
        oVSplit.appendChild(oPrevPane);
        oRightPane.appendChild(oVSplit);

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

        // 스플리터 드래그(인접쌍 합보존) — 가로 1 + 세로 1. (doc16 §4.3 최소구현)
        _bindSplit(oBarH, false);
        _bindSplit(oBarV, true);
        _bindSplitResizeClamp(oSplit, false);

        // 영속 리스너 — 다이얼로그 수명과 동일(1회 등록, 누적 없음).
        window.addEventListener("message", lf_onMessage);
        try { window.addEventListener("u4a-theme-changed", lf_onThemeChange); } catch (e) { }
        try { if (window.parent) { window.parent.addEventListener("u4a-theme-changed", lf_onThemeChange); } } catch (e) { }

        oUI = {
            dlg: oDlg, frame: oFrame, img: oImg, nodata: oNoData,
            tree: oTree, treeBody: oTreeBody,
            urlField: oUrlField, dateField: oDateField, timeField: oTimeField, nameField: oNameField,
            split: oSplit, hostReady: false
        };
    }

    /************************************************************************
     * 스플리터 드래그 — 인접 두 패널 사이에서만 합 보존(가로/세로 공통).
     ************************************************************************/
    function _paneMin(el, bV) {
        var v = parseFloat(bV ? (el.style.minHeight || "") : (el.style.minWidth || ""));
        return isFinite(v) && v > 0 ? v : 120;   // 폴백 120px.
    }
    function _bindSplit(oBar, bV) {
        var bDrag = false, iStart = 0, oA = null, oB = null, iAStart = 0, iBStart = 0;
        function lf_move(e) {
            if (!bDrag) { return; }
            var d = (bV ? e.clientY : e.clientX) - iStart;
            var a = iAStart + d, b = iBStart - d, am = _paneMin(oA, bV), bm = _paneMin(oB, bV);
            if (a < am) { b -= (am - a); a = am; }
            if (b < bm) { a -= (bm - b); b = bm; }
            if (a < am) { a = am; }
            oA.style.flex = "0 0 " + a + "px";
            oB.style.flex = "0 0 " + b + "px";
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
            iStart = bV ? e.clientY : e.clientX;
            var ra = oA.getBoundingClientRect(), rb = oB.getBoundingClientRect();
            iAStart = bV ? ra.height : ra.width;
            iBStart = bV ? rb.height : rb.width;
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
        oState.pendingText = null;
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
        if (document.getElementById("u4aMimeStyle")) { return; }
        var oStyle = document.createElement("style");
        oStyle.id = "u4aMimeStyle";
        oStyle.textContent = [
            // 다이얼로그 — 넉넉한 반응형 크기 + 세로 flex(바디가 늘어 푸터 하단 고정).
            ".u4aMimeDlg { width: min(94vw, 1080px); height: min(88vh, 720px); padding: 0; display: flex; flex-direction: column; }",
            ".u4aMimeDlg .u4a-dialog__header { cursor: move; user-select: none; }",
            ".u4aMimeHead span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
            ".u4aMimeBody { flex: 1 1 auto; min-height: 0; padding: 0; display: flex; }",
            ".u4aMimeSplit { flex: 1 1 auto; min-width: 0; min-height: 0; }",
            // 트리 패널 — 툴바 + 스크롤바디(가상스크롤 wrap). 설명 컬럼 폭 단일출처(WS30 --ws30-desc-w 동일 42%).
            ".u4aMimeTreePane { --u4aMime-desc-w: 42%; display: flex; flex-direction: column; background: var(--surface); overflow: hidden; }",
            ".u4aMimeTreeTool { flex: 0 0 auto; display: flex; gap: 0.25rem; padding: 0.25rem 0.375rem; border-bottom: 0.0625rem solid var(--line); }",
            ".u4aMimeToolBtn { color: var(--text); }",
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
            ".u4aMimeDescText { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 0.8125rem; }",
            ".u4aMimeMuted .u4a-tree__label { color: var(--text-muted); }",
            ".u4aMimeMyApp { background: var(--hover-bg); }",
            ".u4aMimeMyApp .u4a-tree__label { font-weight: 700; }",
            ".u4aMimeNoData { font-style: italic; }",
            ".u4aMimeNoData .u4a-tree__label { color: var(--text-muted); }",
            // 우측 — 속성/미리보기 세로 분할.
            ".u4aMimeRightPane { display: flex; overflow: hidden; }",
            ".u4aMimeVSplit { flex-direction: column; }",
            // 세로분할용 가로 바(geometry 만 변경, 색은 공통 토큰 상속).
            ".u4aMimeVSplit > .u4a-splitter__bar { flex: 0 0 11px; cursor: row-resize; border-left: 0; border-right: 0; border-top: 0.0625rem solid var(--line); border-bottom: 0.0625rem solid var(--line); }",
            ".u4aMimeVSplit > .u4a-splitter__bar::before { width: 36px; height: 5px; }",
            ".u4aMimeVSplit > .u4a-splitter__bar:hover::before { width: 50px; height: 5px; }",
            // 속성 패널.
            ".u4aMimePropPane { display: flex; flex-direction: column; background: var(--surface); overflow: auto; }",
            ".u4aMimePropHdr { flex: 0 0 auto; padding: 0.5rem 0.75rem; font-weight: 700; font-size: 0.875rem; color: var(--text); border-bottom: 0.0625rem solid var(--line); background: var(--surface-raised); }",
            ".u4aMimeForm { padding: 0.625rem 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }",
            ".u4aMimeFormRow { display: flex; align-items: center; gap: 0.625rem; }",
            ".u4aMimeLbl { flex: 0 0 5rem; font-size: 0.8125rem; font-weight: 700; color: var(--text); }",
            ".u4aMimeUrlBox { flex: 1 1 auto; min-width: 0; display: flex; gap: 0.375rem; align-items: center; }",
            ".u4aMimeUrlField { flex: 1 1 auto; min-width: 0; }",
            ".u4aMimeCopyBtn { flex: 0 0 auto; white-space: nowrap; }",
            ".u4aMimeCrBox { flex: 1 1 auto; min-width: 0; display: flex; gap: 0.375rem; }",
            ".u4aMimeCrField { flex: 1 1 0; min-width: 0; }",
            ".u4aMimeCrName { flex: 1.4 1 0; }",
            // 미리보기 패널.
            ".u4aMimePrevPane { display: flex; flex-direction: column; background: var(--app-bg); overflow: hidden; }",
            ".u4aMimeImg { max-width: 100%; max-height: 100%; margin: auto; object-fit: contain; }",
            ".u4aMimeFrame { flex: 1 1 auto; width: 100%; height: 100%; border: 0; display: block; background: var(--app-bg); }",
            ".u4aMimeFrame[hidden] { display: none; }",
            ".u4aMimeImg[hidden] { display: none; }",
            ".u4aMimeNoData2 { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.9375rem; }",
            ".u4aMimeNoData2[hidden] { display: none; }",
            // 드래그 중 커서.
            ".u4aMimeResizing, .u4aMimeResizing * { cursor: col-resize !important; user-select: none !important; }",
            ".u4aMimeFoot { display: flex; justify-content: flex-end; gap: 0.5rem; }"
        ].join("");
        document.head.appendChild(oStyle);
    }

})(window, $, oAPP);
