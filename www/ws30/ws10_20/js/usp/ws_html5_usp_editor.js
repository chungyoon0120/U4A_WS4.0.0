/************************************************************************
 * ws_html5_usp_editor.js  (HTML5)  — WS30 USP Monaco 에디터(스플릿 2개·읽기 경로)
 * ----------------------------------------------------------------------
 * 구 fnGetUspPageWs30 의 Monaco 이중 에디터(Splitter + EDITOR_FRAME1/2)를 HTML5
 *  호스트(#uspEditorHost)에 재현. Monaco iframe 자체(js/usp/monaco/*)는 보존(표 A).
 *
 *  [에디터 2개 — 스플릿]  (구 sap.ui.layout.Splitter "uspCodeeditorSplit")
 *   · 좌(EDITOR_FRAME1 / EDITPAGE1) : 초기 0px(숨김). 분할바 드래그로 넓힘.
 *   · 우(EDITOR_FRAME2 EDITOR_MAIN / EDITPAGE2) : 메인 에디터.
 *   · 분할바 더블클릭 → 좌측 0px 초기화(구 _fnDoubleClickSplitbar).
 *   · 두 iframe 모두 같은 파일(getSelectedUspLineData().CONTENT)을 읽어 표시(분할 편집뷰).
 *
 *  [busy] (구 _fnLineSelectCb 의 iEditorLoadCnt=2)
 *   · 두 에디터가 "모두" 로드(EDITOR_LOAD)되면 busy 해제. (1개라도 미로드면 유지)
 *   · 안전판: 워치독(미로드 시 강제 해제) — 단, EDITOR_LOAD 가 정상 동작하면 즉시 해제됨.
 *
 *  [통신 플러밍 재사용 — 원본 ws_usp*.js 정의, UI5 무관]
 *   onFrameLoadUspEditor(FRAME1→port1 / FRAME2→port2) · USP_EDITOR_CHANNEL(본 모듈 생성) ·
 *   getSelectedUspLineData(=oAPP.usp.oSelectRowData) · #IF_USP_EDITOR 커스텀 이벤트 DOM.
 *
 *  ※ 과거 busy 멈춤 버그: monaco/index.js:691 의 parent.sap...getTheme() 가 sap 스텁에
 *    getTheme 미존재로 TypeError → editor.create 직후 throw → EDITOR_LOAD 디스패치 누락.
 *    ws_html5_shell.js 의 sap 스텁 getConfiguration().getTheme() 추가로 해결(이 모듈 아님).
 ************************************************************************/

(function (window, $, oAPP) {
    "use strict";

    oAPP.fn = oAPP.fn || {};
    oAPP.usp = oAPP.usp || {};
    oAPP.usphtml = oAPP.usphtml || {};
    oAPP.attr = oAPP.attr || {};

    var APPCOMMON = oAPP.common;
    var PATH, PATHINFO, FS;
    try {
        PATH = parent.PATH;
        FS = parent.FS;
        PATHINFO = parent.require(PATH.join(parent.APPPATH, "ws30", "resources", "pathInfo.js"));
    } catch (e) {
        console.error("[HTML5][WS30] editor PATHINFO load error:", e);
    }

    // 라벨/아이콘 헬퍼 — 셸 모듈(ws_html5_usp.js)이 노출한 단일 출처 사용.
    function _msg(s) { return (oAPP.usphtml._msg ? oAPP.usphtml._msg(s) : s); }
    function _wsMsg(s) { return (oAPP.usphtml._wsMsg ? oAPP.usphtml._wsMsg(s) : s); }
    function _fa(s, b) { return (oAPP.usphtml._fa ? oAPP.usphtml._fa(s, b) : '<i class="fa-solid fa-' + s + '"></i>'); }
    function _esc(s) { return (oAPP.usphtml._esc ? oAPP.usphtml._esc(s) : String(s == null ? "" : s)); }
    function _model(p) { try { var v = APPCOMMON.fnGetModelProperty(p); return v == null ? null : v; } catch (e) { return null; } }

    // 본 호스트가 만드는 에디터 iframe 수 (구 이중 에디터 = 2)
    var EDITOR_COUNT = 2;

    /* ====================================================================
     * (헤더 툴바) 핸들러 — 구 ws_usp.js 이식. iframe(.EDITOR_FRAME1/2) 직접 제어 = UI5 무관.
     * ==================================================================== */

    // Pretty Print (구 ev_codeeditorPrettyPrint) — 두 에디터 모두 formatDocument
    function _prettyPrint() {
        ["EDITOR_FRAME1", "EDITOR_FRAME2"].forEach(function (cls) {
            try {
                var ifr = document.querySelector("." + cls);
                if (ifr && ifr.contentWindow && ifr.contentWindow.editor) {
                    ifr.contentWindow.editor.getAction("editor.action.formatDocument").run();
                }
            } catch (e) { console.error("[HTML5][WS30] prettyPrint error:", e); }
        });
    }

    // 기본 폰트 크기 (구 ev_codeeditorDefaultFontSize) — 두 에디터 setDefaultFontSize
    function _defaultFont() {
        ["EDITOR_FRAME1", "EDITOR_FRAME2"].forEach(function (cls) {
            try {
                var ifr = document.querySelector("." + cls);
                if (ifr && ifr.contentWindow && ifr.contentWindow.editor && ifr.contentWindow.editor.setDefaultFontSize) {
                    ifr.contentWindow.editor.setDefaultFontSize();
                }
            } catch (e) { console.error("[HTML5][WS30] defaultFont error:", e); }
        });
    }

    // 전체화면 토글 (구 ev_codeeditorFullscreen) — 좌측 트리/리사이저 숨김 + 속성패널 접기
    function _fullscreen(bFull) {
        oAPP.attr.uspFullscreen = !!bFull;
        var oTree = document.getElementById("ws30TreePane");
        var oRes = document.getElementById("ws30Resizer");
        if (oTree) { oTree.style.display = bFull ? "none" : ""; }
        if (oRes) { oRes.style.display = bFull ? "none" : ""; }
        var oPanel = document.getElementById("uspPanel");
        if (oPanel) {
            oPanel.setAttribute("data-collapsed", bFull ? "X" : "");
            var oHead = oPanel.querySelector(".u4aWs30PanelHead");
            if (oHead) {
                oHead.setAttribute("aria-expanded", bFull ? "false" : "true");
                var oTw = oHead.querySelector(".u4aWs30PanelTwisty");
                if (oTw) { oTw.innerHTML = _fa(bFull ? "chevron-right" : "chevron-down"); }
            }
        }
    }

    // 분할 방향 변경 (구 ev_codeeditorSplitOrientationChange) — 가로↔세로 토글 + 좌측 0px 초기화
    function _splitOrientation() {
        var oSplit = document.querySelector("#uspEditorHost .u4aWs30EditorSplit");
        if (!oSplit) { return; }
        oSplit.classList.toggle("is-vertical");
        var oLeft = oSplit.querySelector(".u4aWs30EditorPaneLeft");
        if (oLeft) { oLeft.style.flex = "0 0 0px"; } // 구 oSplitterLayoutData.setSize("0px")
    }

    /* ====================================================================
     * (헤더 툴바) Monaco 테마 — 구 ComboBox + _oEditorThemeChange/_onEditorThemeSelectClick.
     *   목록=WSUTIL.MONACO_EDITOR.getThemeList(), 저장=P13N select_theme.json(FS),
     *   적용=sendEditorPostMessageAll({actcd:'applyTheme'}). (Monaco 자체 테마 = 셸 토큰과 별개)
     * ==================================================================== */

    function _themeList() {
        try {
            var WSUTIL = parent.require(PATHINFO.WSUTIL);
            return (WSUTIL && WSUTIL.MONACO_EDITOR && WSUTIL.MONACO_EDITOR.getThemeList()) || [];
        } catch (e) { console.error("[HTML5][WS30] getThemeList error:", e); return []; }
    }

    function _selectedTheme() {
        try {
            var o = oAPP.usp.getLastSelectedEditorTheme && oAPP.usp.getLastSelectedEditorTheme();
            if (o && o.themeName) { return o.themeName; }
        } catch (e) { }
        return _model("/WS30/USP_EDITOR/sSelectedTheme") || "";
    }

    function _themeP13nDir() {
        try { return PATH.join(PATHINFO.P13N_ROOT, "monaco", "theme", parent.getUserInfo().SYSID, "usp_main"); }
        catch (e) { return ""; }
    }

    // 테마 선택 변경 (구 _oEditorThemeChange) — 개인화 저장 + 전체 에디터 applyTheme
    function _onThemeChange(sThemeName) {
        if (!sThemeName) { return; }
        var oThemeInfo = { themeName: sThemeName };

        var sDir = _themeP13nDir();
        if (sDir && FS) {
            try {
                if (FS.existsSync(sDir) === false) { FS.mkdirSync(sDir, { recursive: true }); }
                FS.writeFileSync(PATH.join(sDir, "select_theme.json"), JSON.stringify(oThemeInfo), "utf-8");
            } catch (error) {
                console.error("[HTML5][WS30] 테마 개인화 저장 오류:", error);
            }
        }

        try { APPCOMMON.fnSetModelProperty("/WS30/USP_EDITOR/sSelectedTheme", sThemeName); } catch (e) { }
        try { oAPP.usp.sendEditorPostMessageAll({ actcd: "applyTheme", oThemeInfo: oThemeInfo }); } catch (e) { }
    }

    // 테마 그룹 라벨 (구 Sorter: standard=317 / custom=318)
    function _themeGroupLabel(sGroup) {
        if (sGroup === "standard") { return _wsMsg("317"); }
        if (sGroup === "custom") { return _wsMsg("318"); }
        return sGroup || "";
    }

    // busy 해제 — 두 에디터가 모두 로드되면(또는 워치독) 1회만.
    function _releaseBusy() {
        if (oAPP.attr.uspEditorBusyWatch) {
            clearTimeout(oAPP.attr.uspEditorBusyWatch);
            delete oAPP.attr.uspEditorBusyWatch;
        }
        try { oAPP.common.fnSetBusyLock(""); } catch (e) { }
        // 에디터 로드 후 iframe 이 적용/세팅한 테마로 콤보 표시 동기화 (구 ComboBox 모델 바인딩 대체)
        try {
            var oCombo = document.querySelector("#uspEditorHost .u4aWs30EditorThemeSel");
            if (oCombo) { oCombo.value = _selectedTheme(); }
        } catch (e) { }
    }

    // 부모↔iframe 커스텀 이벤트 DOM(#IF_USP_EDITOR) 보장 + EDITOR_LOAD/CONTENT_SYNC 리스너(1회).
    function _ensureCustomEvtDom() {
        var oDom = document.getElementById("IF_USP_EDITOR");
        if (oDom) { return oDom; }

        oDom = document.createElement("div");
        oDom.id = "IF_USP_EDITOR";
        oDom.style.display = "none";
        document.body.appendChild(oDom);

        oDom.addEventListener("IF_USP_EDITOR", function (oEvent) {
            var oData = (oEvent && oEvent.data) || {};
            switch (oData.ACTCD) {
                case "EDITOR_LOAD":
                    // 구 iEditorLoadCnt: 두 에디터 모두 로드 완료 시에만 busy 해제.
                    if (typeof oAPP.attr.uspEditorLoadCnt !== "number") { oAPP.attr.uspEditorLoadCnt = 0; }
                    oAPP.attr.uspEditorLoadCnt -= 1;
                    if (oAPP.attr.uspEditorLoadCnt > 0) { return; }
                    _releaseBusy();
                    return;

                case "CONTENT_SYNC":
                    // 편집 내용 → 모델 동기화 (1차 읽기에서는 보류 — Change 모드 단계)
                    return;

                default:
                    return;
            }
        });

        return oDom;
    }

    // Monaco iframe 1개 생성 (sPageId: EDITPAGE1/EDITPAGE2, sFrameCls: EDITOR_FRAME1/EDITOR_FRAME2[ EDITOR_MAIN])
    function _buildOneFrame(sPageId, sFrameCls) {
        var sEditorIndexPath = PATH.join(PATHINFO.USP_ROOT, "monaco", "index.html");
        var sQuery = encodeURIComponent(JSON.stringify({ PAGEID: sPageId }));

        var IFR = document.createElement("iframe");
        IFR.className = "MONACO_EDITOR " + sFrameCls;   // onFrameLoadUspEditor 가 클래스로 포트 분기
        IFR.src = sEditorIndexPath + "?PARAMS=" + sQuery;
        IFR.setAttribute("frameborder", "0");
        IFR.addEventListener("load", function (e) {
            try { if (typeof oAPP.fn.onFrameLoadUspEditor === "function") { oAPP.fn.onFrameLoadUspEditor(e); } }
            catch (err) { console.error("[HTML5][WS30] onFrameLoadUspEditor error:", err); }
        });
        return IFR;
    }

    // 좌측 분할바 드래그 리사이즈 + 더블클릭 0px 초기화 (구 Splitter + _fnDoubleClickSplitbar).
    //   가로/세로 방향 모두 대응(.is-vertical → clientY/높이). flex-basis 는 주축 크기라 공용.
    function _bindEditorSplit(oBar, oLeft, oSplit) {
        var bDrag = false, iStart = 0, iStartW = 0;
        function _vert() { return oSplit.classList.contains("is-vertical"); }
        function lf_move(e) {
            if (!bDrag) { return; }
            var bV = _vert();
            var iDelta = (bV ? e.clientY : e.clientX) - iStart;
            var iW = iStartW + iDelta;
            var iMax = (bV ? oSplit.clientHeight : oSplit.clientWidth) - 80; // 메인 에디터 최소 확보
            if (iW < 0) { iW = 0; }
            if (iW > iMax) { iW = iMax; }
            oLeft.style.flex = "0 0 " + iW + "px";
        }
        function lf_up() {
            bDrag = false;
            document.body.classList.remove("u4aWs20ResizingCursor");
            document.removeEventListener("mousemove", lf_move);
            document.removeEventListener("mouseup", lf_up);
        }
        oBar.addEventListener("mousedown", function (e) {
            bDrag = true;
            var r = oLeft.getBoundingClientRect();
            iStart = _vert() ? e.clientY : e.clientX;
            iStartW = _vert() ? r.height : r.width;
            document.body.classList.add("u4aWs20ResizingCursor");
            document.addEventListener("mousemove", lf_move);
            document.addEventListener("mouseup", lf_up);
            e.preventDefault();
        });
        // 더블클릭 → 좌측 0px (구 _fnDoubleClickSplitbar)
        oBar.addEventListener("dblclick", function () { oLeft.style.flex = "0 0 0px"; });
    }

    /* ====================================================================
     * (헤더 툴바 빌더) 구 fnGetUspPageWs30 의 customHeader(OverflowToolbar):
     *   파일명 | (spacer) | 테마콤보 · 기본폰트 · 분할방향 · 전체화면 · Pretty Print
     * ==================================================================== */

    // 툴바 아이콘 버튼 1개 (.u4a-tx-btn 공통 컴포넌트)
    function _tbBtn(oCfg) {
        var B = document.createElement("button");
        B.type = "button";
        if (oCfg.id) { B.id = oCfg.id; }
        B.className = "u4a-tx-btn";
        B.title = oCfg.tooltip || "";
        if (oCfg.disabled) { B.disabled = true; }
        B.innerHTML = _fa(oCfg.fa);
        B.addEventListener("click", function () {
            if (B.disabled) { return; }
            try { oCfg.press(B); } catch (e) { console.error("[HTML5][WS30] editor toolbar:", oCfg.id, e); }
        });
        return B;
    }

    function _buildEditorToolbar() {

        var TB = document.createElement("div");
        TB.className = "u4aWs30EditorToolbar";

        var oData = _model("/WS30/USPDATA") || {};
        var oApp = _model("/WS30/APP") || {};
        var bEdit = (oApp.IS_EDIT === "X");
        var bFolder = (oData.ISFLD === "X");
        var bRoot = (oData.PUJKY === "" || oData.PUJKY == null);

        // 파일명 (구 sap.m.Title {/WS30/USPDATA/OBDEC})
        var TITLE = document.createElement("span");
        TITLE.className = "u4aWs30EditorTitle";
        TITLE.textContent = oData.OBDEC || "";
        TITLE.title = oData.OBDEC || "";
        TB.appendChild(TITLE);

        var SPC = document.createElement("span");
        SPC.className = "u4aWs30EditorTbSpacer";
        TB.appendChild(SPC);

        // 테마 콤보 (구 ComboBox aThemeList, groupName standard/custom) — U4AUI.createSelect(그룹 확장)
        try {
            if (window.U4AUI && U4AUI.createSelect) {
                var aTheme = _themeList();
                var aItems = aTheme.map(function (t) {
                    return { value: t.name, text: t.name, group: _themeGroupLabel(t.groupName) };
                });
                var sSel = _selectedTheme();
                var oCombo = U4AUI.createSelect(aItems, sSel, _onThemeChange);
                oCombo.classList.add("u4aWs30EditorThemeSel");
                TB.appendChild(oCombo);
            }
        } catch (e) { console.error("[HTML5][WS30] theme combo build error:", e); }

        // 기본 폰트 크기 (구 editorDefaultFontBtn) — 폴더면 비활성
        TB.appendChild(_tbBtn({
            id: "ws30_editorDefaultFontBtn", fa: "text-height",
            tooltip: _wsMsg("311"), disabled: bFolder, press: _defaultFont
        }));

        // 분할 방향 변경 (구 sap-icon://rotate, C22) — 폴더면 비활성
        TB.appendChild(_tbBtn({
            id: "ws30_editorSplitBtn", fa: "table-columns",
            tooltip: _msg("C22"), disabled: bFolder, press: _splitOrientation
        }));

        // 전체화면 토글 (구 ToggleButton full-screen/exit-full-screen, C23)
        var bFull = !!oAPP.attr.uspFullscreen;
        var FBTN = document.createElement("button");
        FBTN.type = "button";
        FBTN.id = "ws30_editorFullscreenBtn";
        FBTN.className = "u4a-tx-btn";
        FBTN.setAttribute("aria-pressed", bFull ? "true" : "false");
        FBTN.title = _msg("C23");
        FBTN.innerHTML = _fa(bFull ? "compress" : "expand");
        FBTN.addEventListener("click", function () {
            var bNext = !(oAPP.attr.uspFullscreen);
            _fullscreen(bNext);
            FBTN.setAttribute("aria-pressed", bNext ? "true" : "false");
            FBTN.innerHTML = _fa(bNext ? "compress" : "expand");
            FBTN.title = bNext ? _wsMsg("370") : _wsMsg("369");
        });
        TB.appendChild(FBTN);

        // Pretty Print (구 ws30_codeeditor_prettyBtn, C25 + Shift+F1) — Change모드 && 비루트 && 파일
        TB.appendChild(_tbBtn({
            id: "ws30_codeeditor_prettyBtn", fa: "indent",
            tooltip: _msg("C25") + " (Shift+F1)",
            disabled: !(bEdit && !bRoot && !bFolder),
            press: _prettyPrint
        }));

        return TB;
    }

    /************************************************************************
     * [PUBLIC] 선택 파일을 스플릿 에디터(2개)에 표시 (읽기) — 셸 _fnLineSelectCb 가 호출.
     ************************************************************************/
    oAPP.usphtml.editorLoadSelected = function (oRowData) {

        var oHost = document.getElementById("uspEditorHost");
        if (!oHost || !PATHINFO || !PATH) {
            _releaseBusy();
            return;
        }

        _ensureCustomEvtDom();

        // 통신 채널 (재)생성 — 원본은 선택마다 delete 후 new MessageChannel()
        try { delete oAPP.usp.USP_EDITOR_CHANNEL; } catch (e) { }
        oAPP.usp.USP_EDITOR_CHANNEL = new MessageChannel();

        // 두 에디터 로드 카운터 (구 iEditorLoadCnt = 2)
        oAPP.attr.uspEditorLoadCnt = EDITOR_COUNT;

        // 기존 내용 제거 후 [헤더 툴바 + 스플릿] 재구성 (원본 destroy+clone 패턴)
        oHost.innerHTML = "";

        // 헤더 툴바 (파일명 + 테마콤보 + 기본폰트/분할/전체화면/Pretty)
        oHost.appendChild(_buildEditorToolbar());

        var SPLIT = document.createElement("div");
        SPLIT.className = "u4aWs30EditorSplit";

        // 좌측 에디터(초기 0px 숨김) — 구 EDITPAGE1 / EDITOR_FRAME1
        var LEFT = document.createElement("div");
        LEFT.className = "u4aWs30EditorPane u4aWs30EditorPaneLeft";
        LEFT.style.flex = "0 0 0px";
        LEFT.appendChild(_buildOneFrame("EDITPAGE1", "EDITOR_FRAME1"));
        SPLIT.appendChild(LEFT);

        // 분할바 (드래그/더블클릭)
        var BAR = document.createElement("div");
        BAR.className = "u4aWs30EditorSplitBar";
        SPLIT.appendChild(BAR);

        // 우측(메인) 에디터 — 구 EDITPAGE2 / EDITOR_FRAME2 EDITOR_MAIN
        var RIGHT = document.createElement("div");
        RIGHT.className = "u4aWs30EditorPane u4aWs30EditorPaneRight";
        RIGHT.style.flex = "1 1 auto";
        RIGHT.appendChild(_buildOneFrame("EDITPAGE2", "EDITOR_FRAME2 EDITOR_MAIN"));
        SPLIT.appendChild(RIGHT);

        oHost.appendChild(SPLIT);

        _bindEditorSplit(BAR, LEFT, SPLIT);

        // 워치독 — 어떤 이유로 EDITOR_LOAD 가 안 와도 busy 가 영구히 안 남게(정상 시 EDITOR_LOAD 가 먼저 해제).
        if (oAPP.attr.uspEditorBusyWatch) { clearTimeout(oAPP.attr.uspEditorBusyWatch); }
        oAPP.attr.uspEditorBusyWatch = setTimeout(function () {
            console.warn("[HTML5][WS30] editor load watchdog — busy 강제 해제(EDITOR_LOAD 누락)");
            oAPP.attr.uspEditorLoadCnt = 0;
            _releaseBusy();
        }, 7000);
    };

    /************************************************************************
     * [PUBLIC] 에디터 비우기 — 폴더/루트(문서 페이지) 등 파일 아닌 경우.
     ************************************************************************/
    oAPP.usphtml.editorClear = function () {
        var oHost = document.getElementById("uspEditorHost");
        if (oHost) { oHost.innerHTML = ""; }
        oAPP.attr.uspEditorLoadCnt = 0;
    };

})(window, jQuery, oAPP);
