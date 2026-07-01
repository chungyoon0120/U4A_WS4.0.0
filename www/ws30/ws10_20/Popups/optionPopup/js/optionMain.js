/**************************************************************************
 * optionMain.js  (HTML5 / Bootstrap)
 * ------------------------------------------------------------------------
 * 시스템 > 옵션 창(BrowserWindow). 원본 optionS.html(UI5 sap.tnt.ToolPage) 걷어내고
 * ServerList 와 동일한 Bootstrap 스택(bootstrap + tokens/shell + bootstrap-bridge/skin)
 * 으로 마스터-디테일 옵션 UI 를 그린다.
 *   · 구조: 헤더(옵션) + 좌측 섹션 list-group(SECTIONS=확장 지점) + 우측 콘텐츠 + 푸터(Apply/Close)
 *   · 테마 섹션: Bootstrap card 그리드(원본 ThemeSetting). 언어/CDN 은 원본도 미완성 → 골격만.
 *   · 적용: ${USERDATA}/p13n/theme_ws4/${SYSID}.json 기록 + IPC if-p13n-themeChange-${SYSID}
 *           (메인 창이 받아 적용·영속). 창 미리보기: U4ATheme.apply (취소 시 원복).
 **************************************************************************/
(function () {
    "use strict";

    var REMOTE = require('@electron/remote');
    var IPC = require('electron').ipcRenderer;
    var IPCMAIN = REMOTE.require('electron').ipcMain;   // 전 창 공통 브로드캐스트(if-p13n-themeChange) 수신용
    var FS = REMOTE.require('fs');
    var PATH = REMOTE.require('path');
    var APP = REMOTE.app;
    var USERDATA = APP.getPath("userData");
    var APPPATH = APP.getAppPath();
    var CURRWIN = REMOTE.getCurrentWindow();

    var PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));
    var WSUTIL = require(PATHINFO.WSUTIL);

    var oQuery = {};
    try { oQuery = WSUTIL.QueryString.parse(location.href) || {}; } catch (e) { }
    var USERINFO = oQuery.USERINFO || {};
    var LANGU = USERINFO.LANGU || "";
    var SYSID = USERINFO.SYSID || "";
    var BROWSKEY = oQuery.browserkey || "";   // 메인에 busy 해제 신호 보낼 키

    // 창 준비 완료 — opener 가 opacity:0/show:false 로 만들었으니 보이게 하고, 메인 busy 해제.
    //   (원본 optionS.html: CURRWIN.show() + if-send-action-<BROWSKEY> SETBUSYLOCK ISBUSY:"")
    var _bReadySent = false;
    var _bEscBound = false;
    function _ready() {
        if (_bReadySent) { return; }
        _bReadySent = true;
        try { CURRWIN.setOpacity(1.0); } catch (e) { }
        try { CURRWIN.show(); } catch (e) { }
        try { if (BROWSKEY) { IPC.send("if-send-action-" + BROWSKEY, { ACTCD: "SETBUSYLOCK", ISBUSY: "" }); } } catch (e) { }
        // ★형제 창 busy 해제(누락 버그 수정): opener(fnWsOptionsPopupOpener)가 oMainBroad 로 BUSY_ON 을
        //   broadcast 해 docPopup 등 형제 창을 전부 잠갔다. SETBUSYLOCK 은 "메인" busy 만 풀 뿐 형제창은
        //   안 푼다 → 여기서 BUSY_OFF 도 broadcast 해야 형제창이 풀린다(안 하면 형제창 영구 busy+닫기차단).
        //   BROAD_BUSY 액션 = 메인이 oMainBroad 로 중계(extopen/importExport 와 동일 패턴).
        try { if (BROWSKEY) { IPC.send("if-send-action-" + BROWSKEY, { ACTCD: "BROAD_BUSY", PRCCD: "BUSY_OFF" }); } } catch (e) { }
    }

    var WSMSG = null;
    try { WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU); } catch (e) { }
    function _txt(sCls, sCode) {
        try { return (WSMSG && WSMSG.fnGetMsgClsText(sCls, sCode, "", "", "", "")) || ""; } catch (e) { return ""; }
    }
    var _fa = function (s) { return '<i class="fa-solid fa-' + s + '"></i>'; };
    function _toFileUrl(sPath) { return encodeURI("file:///" + String(sPath).replace(/\\/g, "/")); }

    // 공통 스플리터 드래그(16번 §4.3) — 바 양옆 인접 두 패널만 재분배. 사이드바(고정 패널)를 px 로
    //   바꾸고 콘텐츠(마지막 1 1 auto)가 잔여를 채운다. 마지막 패널 최소폭 보호 + 창 축소 재클램프.
    //   ⚠️ _build() 가 (DOMContentLoaded 폴백 + IPC) 두 번 돌며 innerHTML 을 다시 그려 바 요소가
    //   새로 생긴다. 그래서 mousedown 은 "매 빌드마다 현재 바"에 재배선하고(_dragState 갱신),
    //   document/window 리스너만 1회 바인딩한다(중복/스테일 리스너 방지).
    var _SPLIT_MIN = 120; // §4.3 min-width 폴백
    var _dragState = { active: false, startX: 0, startW: 0, pane: null, bar: null, split: null };
    var _splitDocBound = false;
    function _splitMaxW() {
        if (!_dragState.split || !_dragState.bar) { return 0; }
        return _dragState.split.getBoundingClientRect().width - _dragState.bar.offsetWidth - _SPLIT_MIN;
    }
    function _attachSplitterDrag(oBar, oPane, oSplit) {
        if (!oBar || !oPane || !oSplit) { return; }
        // 매 빌드 최신 요소로 갱신 (리스너는 _dragState 를 통해 항상 현재 바/패널 참조)
        _dragState.pane = oPane; _dragState.bar = oBar; _dragState.split = oSplit;
        oBar.addEventListener("mousedown", function (e) {
            _dragState.active = true;
            _dragState.startX = e.clientX;
            _dragState.startW = oPane.getBoundingClientRect().width;
            document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
            e.preventDefault();
        });
        if (_splitDocBound) { return; }
        _splitDocBound = true;
        document.addEventListener("mousemove", function (e) {
            if (!_dragState.active) { return; }
            var w = _dragState.startW + (e.clientX - _dragState.startX), iMax = _splitMaxW();
            if (w < _SPLIT_MIN) { w = _SPLIT_MIN; }
            if (iMax > _SPLIT_MIN && w > iMax) { w = iMax; }
            _dragState.pane.style.flex = "0 0 " + w + "px";
        });
        document.addEventListener("mouseup", function () {
            if (!_dragState.active) { return; }
            _dragState.active = false; document.body.style.cursor = ""; document.body.style.userSelect = "";
        });
        window.addEventListener("resize", function () {
            if (!_dragState.pane) { return; }
            var iMax = _splitMaxW(), w = _dragState.pane.getBoundingClientRect().width;
            if (iMax > _SPLIT_MIN && w > iMax) { _dragState.pane.style.flex = "0 0 " + iMax + "px"; }
        });
    }

    var IF_DATA = null;
    var sCurTheme = "horizon_white";
    var sOrigTheme = "horizon_white";

    var THEMES = [
        { key: "horizon_white",  text: "Horizon White",  accent: "#1c93f2", bg: "#ffffff" },
        { key: "horizon_dark",   text: "Horizon Dark",   accent: "#1c93f2", bg: "#1c2228" },
        { key: "horizon_purple", text: "Horizon Purple", accent: "#7f77dd", bg: "#faf8ff" },
        { key: "horizon_red",    text: "Horizon Red",    accent: "#e24b4a", bg: "#fff7f7" },
        { key: "horizon_green",  text: "Horizon Green",  accent: "#639922", bg: "#f4fcf4" },
        { key: "horizon_xp",     text: "Windows XP",     accent: "#0a5fdb", bg: "#ece9d8" },
        { key: "horizon_95",     text: "Windows 95",     accent: "#000080", bg: "#c0c0c0" },
        { key: "horizon_7",      text: "Windows 7",      accent: "#0078d7", bg: "#f0f0f0" },
        { key: "horizon_signature", text: "SAP Signature", accent: "#3a6ea5", bg: "#eef2f7" }
    ];

    // 확장 지점 — 한 줄 추가하면 좌측 list-group + 우측 render 자동.
    var SECTIONS = [
        { code: "theme", icon: "palette", labelKey: "B01", render: _renderTheme }
        // { code: "langu", icon: "language", labelKey: "...", render: _renderLangu },
        // { code: "cdn",   icon: "server",   labelKey: "...", render: _renderCdn }
    ];

    function _norm(s) {
        try { return (window.U4ATheme && window.U4ATheme.normalize) ? window.U4ATheme.normalize(s) : s; }
        catch (e) { return s; }
    }
    function _applyTheme(sKey) {
        try { if (window.U4ATheme) { window.U4ATheme.apply(sKey); } } catch (e) { }
        // 첫 페인트용 --boot-bg(BGCOL) 해제 → 이후 body 배경이 활성 테마 --app-bg 를 따라
        //   미리보기(테마 클릭)마다 갱신된다. (테마 CSS 는 did-finish-load 시점에 이미 로드됨)
        try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }
        sCurTheme = sKey;
    }

    // 테마 스와치 프리뷰 등 Bootstrap 으로 표현 안 되는 소량 스타일만 주입(색은 카드별 대표색).
    function _ensureStyle() {
        if (document.getElementById("u4aOptStyle")) { return; }
        var s = document.createElement("style");
        s.id = "u4aOptStyle";
        s.textContent = `
        /* 좌우 구분 — 사이드바(좌)=살짝 가라앉은 페이지색(--app-bg), 콘텐츠(우)/컨테이너=표면색(--surface).
           바는 공통 스킨 그대로(콘텐츠와 같은 면이라 흰 줄 안 튀고, 사이드바와는 톤 대비로 구분). */
        #optSplit { background: var(--surface); }
        /* padding-left = 사이드바 좌측 여백 — 항목(선택 하이라이트/좌측바)이 창 왼쪽 가장자리에
           딱 붙지 않게 띄운다(2026-06-22 사용자 요청). */
        #optNav { background: var(--app-bg); padding: 0.375rem 0 0.375rem 1px; }
        /* 좌측 메뉴 = 리스트 행 디자인 — 앱 트리/메뉴와 동일 토큰(hover/선택 강조 + 선택 시 accent 좌측바·굵게,
           아이콘 색). bootstrap list-group 기본 카드/보더 스타일은 덮어쓴다. */
        #optNav .list-group-item {
            border: 0; border-radius: 0; background: transparent;
            /* 행 높이 = WS20/USP 트리 행(40px)과 동일 → 선택 좌측바(box-shadow inset 3px)의 "높이"도 동일.
               (전엔 항목이 ~36px 라 트리보다 바가 짧아 두께/마진이 달라 보였다 — 2026-06-22 사용자 지적) */
            min-height: 2.5rem; padding: 0 0.875rem;
            color: var(--text); font: inherit; text-align: left; cursor: pointer;
            transition: background-color var(--motion) linear;
        }
        #optNav .list-group-item > i { flex: 0 0 auto; width: 1.1rem; text-align: center; color: var(--icon-muted); }
        #optNav .list-group-item:hover { background: var(--hover-bg); }
        #optNav .list-group-item:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: -0.125rem; }
        #optNav .list-group-item.active {
            background: var(--selected-bg); color: var(--selected-text);
            font-weight: 600; box-shadow: inset 0.1875rem 0 0 0 var(--accent);
        }
        #optNav .list-group-item.active > i { color: var(--accent); }
        /* 콘텐츠 = 헤더(제목 고정) + 본문(스크롤) 세로 스택 */
        #optCont { background: var(--surface); display: flex; flex-direction: column; min-height: 0; }
        /* 페이지 제목 헤더 — 앱 공통 패널 헤더(surface-raised + 하단 보더) 패턴으로 본문과 구분 */
        .u4aOptSecHdr { flex: 0 0 auto; display: flex; align-items: center; gap: 0.5rem;
            padding: 0.625rem 1rem; font-weight: 600; color: var(--text);
            background: var(--surface-raised); border-bottom: 0.0625rem solid var(--line); }
        .u4aOptSecHdr i { color: var(--accent); }
        .u4aOptSecBody { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 1rem; }
        /* 컨테이너(패널) 폭 기준 자동 reflow — 좁아지면 열 줄고 결국 1열로 쌓임(뷰포트 무관).
           min(11rem,100%) 로 패널이 11rem 보다 좁아도 카드가 넘치지 않게 한다(Chromium93 min() OK). */
        .u4aOptGrid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(11rem, 100%), 1fr)); align-content: start; }
        /* overflow:hidden → 카드 둥근 모서리가 상단 컬러 바(.u4aOptPrev/.bar)의 사각 모서리를
           깔끔히 클립(삐져나옴 방지). 선택/hover 의 box-shadow 링은 보더박스 바깥이라 안 잘림. */
        .u4aOptCard { cursor: pointer; overflow: hidden; transition: box-shadow .12s linear, border-color .12s linear; }
        /* hover 와 선택을 같은 계열로 단계화(점프 방지): 둘 다 accent 테두리 + 같은 옅은 후광을
           공유하고, "선택"만 안쪽에 솔리드 accent 링을 더한다(미리보기 → 확정). */
        .u4aOptCard:hover { border-color: var(--accent) !important;
            box-shadow: 0 0 0 0.25rem var(--selected-bg); }
        .u4aOptCard.selected { border-color: var(--accent) !important;
            box-shadow: 0 0 0 0.125rem var(--accent), 0 0 0 0.25rem var(--selected-bg); }
        .u4aOptCard .chk { color: var(--accent) !important; }
        .u4aOptPrev { position: relative; height: 3rem; border-bottom: 0.0625rem solid var(--bs-border-color, var(--line)); }
        .u4aOptPrev .bar { position: absolute; left: 0; right: 0; top: 0; height: 0.875rem; }
        .u4aOptPrev .dot { position: absolute; right: 0.5rem; bottom: 0.5rem; width: 0.875rem; height: 0.875rem; border-radius: 50%; }
        `;
        document.head.appendChild(s);
    }

    /* ── 섹션: 테마 (Bootstrap card 그리드) ── */
    function _renderTheme(el) {
        var html =
            // 페이지 제목 = 헤더(본문과 보더로 구분). 사이드바 항목명과 동일 라벨(B01).
            '<div class="u4aOptSecHdr">' + _fa("palette") +
            '<span>' + (_txt("/U4A/CL_WS_COMMON", "B01") || "Theme") + '</span></div>' +
            // 뷰포트 기준 Bootstrap col-* 대신 컨테이너 폭 기준 auto-fill 그리드 → 패널이 좁아지면
            //   자동으로 열 수가 줄어 1열까지 쌓인다(스플리터 드래그/창 리사이즈에 진짜 반응형).
            //   Chromium 93 은 컨테이너 쿼리 미지원이라 min()+auto-fill 로 처리.
            '<div class="u4aOptSecBody"><div class="u4aOptGrid">';
        for (var i = 0; i < THEMES.length; i++) {
            var t = THEMES[i];
            html +=
                '<div class="card u4aOptCard" data-key="' + t.key + '" title="' + t.text + '">' +
                  '<div class="u4aOptPrev" style="background:' + t.bg + ';">' +
                    '<div class="bar" style="background:' + t.accent + ';"></div>' +
                    '<div class="dot" style="background:' + t.accent + ';"></div>' +
                  '</div>' +
                  '<div class="card-body p-2 d-flex justify-content-between align-items-center">' +
                    '<span class="small text-truncate">' + t.text + '</span><span class="chk text-primary ms-1 flex-shrink-0"></span>' +
                  '</div>' +
                '</div>';
        }
        html += '</div></div>';   // close .u4aOptGrid + .u4aOptSecBody
        el.innerHTML = html;
        el.querySelectorAll(".u4aOptCard").forEach(function (c) {
            c.addEventListener("click", function () { _applyTheme(c.getAttribute("data-key")); _markSel(c.getAttribute("data-key")); });
        });
        _markSel(sCurTheme);
    }
    function _markSel(sKey) {
        document.querySelectorAll(".u4aOptCard").forEach(function (c) {
            var b = c.getAttribute("data-key") === sKey;
            c.classList.toggle("selected", b);
            var ck = c.querySelector(".chk");
            if (ck) { ck.innerHTML = b ? _fa("check") : ""; }
        });
    }

    function _selectSection(sCode) {
        var oCont = document.getElementById("optCont");
        var sec = null;
        for (var i = 0; i < SECTIONS.length; i++) { if (SECTIONS[i].code === sCode) { sec = SECTIONS[i]; break; } }
        if (!sec || !oCont) { return; }
        document.querySelectorAll("[data-code]").forEach(function (n) {
            n.classList.toggle("active", n.getAttribute("data-code") === sCode);
        });
        try { sec.render(oCont); } catch (e) { oCont.innerHTML = ""; }
    }

    function _close(bRevert) {
        if (bRevert) { _applyTheme(sOrigTheme); }
        try { CURRWIN.setClosable && CURRWIN.setClosable(true); } catch (e) { }
        try { CURRWIN.close(); } catch (e) { try { CURRWIN.destroy(); } catch (e2) { } }
    }

    // 공통 토스트(shell.css .u4a-toast — ServerList 와 동일 패턴, bootstrap-skin 이 색 입힘)
    var _iToastTimer = null;
    function _toast(sMsg) {
        if (!sMsg) { return; }
        var oToast = document.getElementById("u4aOptToast");
        if (!oToast) {
            oToast = document.createElement("div");
            oToast.id = "u4aOptToast";
            oToast.className = "u4a-toast";
            oToast.setAttribute("role", "alert");
            document.body.appendChild(oToast);
        }
        oToast.textContent = sMsg;
        oToast.dataset.show = "true";
        clearTimeout(_iToastTimer);
        _iToastTimer = setTimeout(function () { oToast.dataset.show = "false"; }, 3000);
    }

    function _apply() {
        var sKey = sCurTheme;
        var sBg = "";
        try { sBg = WSUTIL.getThemeBackgroundColor ? WSUTIL.getThemeBackgroundColor(sKey) : ""; } catch (e) { }
        if (!sBg) { try { sBg = getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim(); } catch (e) { } }
        var sData = { THEME: sKey, BGCOL: sBg || "" };
        try {
            var sDir = PATH.join(USERDATA, "p13n", "theme_ws4");
            try { FS.mkdirSync(sDir, { recursive: true }); } catch (e2) { }
            FS.writeFileSync(PATH.join(sDir, SYSID + ".json"), JSON.stringify(sData), "utf-8");
        } catch (e) { }
        try { IPC.send("if-p13n-themeChange-" + SYSID, sData); } catch (e) { }

        // ★ 열려 있는 모든 창의 "네이티브 BrowserWindow 배경색"도 새 테마 배경으로 일괄 적용한다.
        //   내용(DOM) 재테마는 각 창의 if-p13n-themeChange 핸들러가 하지만, 네이티브 창 배경은
        //   창 생성 시 고정(opener 의 backgroundColor)이라 안 바꾸면 화면 이동 중 옛 배경(흰색)이 샌다.
        //   → 그 테마로 "처음 실행한 창"과 동일한 네이티브 배경 상태가 되도록 전 창을 맞춘다.
        //   (대부분의 별도 팝업 핸들러는 setBackgroundColor 를 안 하므로 여기서 중앙 처리.)
        if (sData.BGCOL) {
            try {
                REMOTE.BrowserWindow.getAllWindows().forEach(function (w) {
                    try { if (w && !w.isDestroyed() && w.setBackgroundColor) { w.setBackgroundColor(sData.BGCOL); } } catch (e2) { }
                });
            } catch (e) { }
        }

        // 적용 후 origin 갱신 → 이후 Close 가 방금 적용한 테마를 되돌리지 않게.
        sOrigTheme = sKey;
        // ★ 적용만 하고 창은 닫지 않는다. 저장 완료 메시지(원본 ThemeSetting 과 동일: MSG_WS 330
        //    "&1 has been saved", &1 = B52(Options))만 토스트로 표시.
        var sB52 = _txt("/U4A/CL_WS_COMMON", "B52") || "Options";
        var sMsg = "";
        try { sMsg = (WSMSG && WSMSG.fnGetMsgClsText("/U4A/MSG_WS", "330", sB52, "", "", "")) || ""; } catch (e) { }
        _toast(sMsg || sB52);
    }

    function _build() {
        _ensureStyle();
        var root = document.getElementById("optRoot") || document.body;

        var sNav = "";
        SECTIONS.forEach(function (sec) {
            sNav +=
                '<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" data-code="' + sec.code + '">' +
                _fa(sec.icon) + '<span>' + (_txt("/U4A/CL_WS_COMMON", sec.labelKey) || sec.code) + '</span></button>';
        });

        var sTitle = _txt("/U4A/CL_WS_COMMON", "B52") || "Options";
        var sLogo = "";
        try { sLogo = _toFileUrl(PATHINFO.WS_LOGO); } catch (e) { }

        root.innerHTML =
            '<div class="d-flex flex-column" style="height:100vh">' +
              // 창 크롬 — 공통 .u4a-titlebar (ServerList 와 동일: 로고+제목+min/max/close,
              //   shell.css 가 -webkit-app-region:drag 로 창 이동 처리). frameless 창의 헤더.
              '<header class="u4a-titlebar">' +
                '<img class="u4a-titlebar__logo" src="' + sLogo + '" alt="U4A" onerror="this.style.visibility=\'hidden\'">' +
                '<span class="u4a-titlebar__title">' + sTitle + '</span>' +
                '<div class="u4a-titlebar__spacer"></div>' +
                '<button type="button" class="u4a-winbtn" id="optWinMin" title="Minimize">' + _fa("window-minimize") + '</button>' +
                '<button type="button" class="u4a-winbtn" id="optWinMax" title="Maximize">' + _fa("window-maximize") + '</button>' +
                '<button type="button" class="u4a-winbtn u4a-winbtn--close" id="optWinClose" title="' + (_txt("/U4A/CL_WS_COMMON", "A39") || "Close") + '">' + _fa("xmark") + '</button>' +
              '</header>' +
              // 마스터-디테일 — 공통 스플리터(16번 §4: shell.css .u4a-splitter* 골격+그립 소비).
              //   사이드바=고정 basis 패널, 콘텐츠=잔여(1 1 auto) 마지막 패널, 가운데 공통 그립 바.
              '<div class="u4a-splitter flex-grow-1" id="optSplit">' +
                '<div class="u4a-splitter__pane list-group list-group-flush" id="optNav" style="flex:0 0 13rem">' + sNav + '</div>' +
                '<div class="u4a-splitter__bar" id="optSplitBar" role="separator" aria-orientation="vertical"></div>' +
                '<div class="u4a-splitter__pane" id="optCont" style="flex:1 1 auto"></div>' +
              '</div>' +
              // 푸터 — 공통 .modal-footer(48px·토큰 보더, bootstrap-skin 단일출처) + 프로젝트 버튼.
              //   다른 모든 팝업과 동일: 강조=u4a-btn--emphasized / 닫기=u4a-btn--negative(Reject 느낌)
              '<div class="modal-footer">' +
                '<button type="button" class="u4a-btn u4a-btn--emphasized" id="optApply" title="' + (_txt("/U4A/CL_WS_COMMON", "C63") || "Apply") + '">' + _fa("check") + '</button>' +
                '<button type="button" class="u4a-btn u4a-btn--negative" id="optClose" title="' + (_txt("/U4A/CL_WS_COMMON", "A39") || "Close") + '">' + _fa("xmark") + '</button>' +
              '</div>' +
            '</div>';

        // 창 제어 버튼 (frameless — 공통 .u4a-winbtn)
        document.getElementById("optWinMin").addEventListener("click", function () { try { CURRWIN.minimize(); } catch (e) { } });
        document.getElementById("optWinMax").addEventListener("click", function () {
            try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
        });
        document.getElementById("optWinClose").addEventListener("click", function () { _close(true); });

        // 공통 스플리터 드래그 배선(사이드바 폭 조절)
        _attachSplitterDrag(document.getElementById("optSplitBar"), document.getElementById("optNav"), document.getElementById("optSplit"));

        root.querySelectorAll("[data-code]").forEach(function (n) {
            n.addEventListener("click", function () { _selectSection(n.getAttribute("data-code")); });
        });
        document.getElementById("optApply").addEventListener("click", _apply);
        document.getElementById("optClose").addEventListener("click", function () { _close(true); });

        // Esc = 취소(닫기) — 팝업 공통 UX. event.repeat 가드(키 꾹 누름 중복발화 방지).
        if (!_bEscBound) {
            _bEscBound = true;
            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape" && !e.repeat) { _close(true); }
            });
        }

        _selectSection(SECTIONS[0] && SECTIONS[0].code);

        // UI 준비 완료 → 창 표시 + 메인 busy 해제 (안 하면 메인이 계속 busy 스피너)
        _ready();
    }

    IPC.on('if-ws-options-info', function (event, data) {
        IF_DATA = data || {};
        var sTheme = _norm((IF_DATA.THEME_INFO && IF_DATA.THEME_INFO.THEME) ||
            (window.U4ATheme && window.U4ATheme.current && window.U4ATheme.current()) || "horizon_white");
        if (THEMES.map(function (t) { return t.key; }).indexOf(sTheme) === -1) { sTheme = "horizon_white"; }
        sOrigTheme = sTheme;
        _applyTheme(sTheme);
        _build();
    });

    /* 다른 창(같은 SYSID)이 테마를 "적용"하면 그 브로드캐스트(if-p13n-themeChange-<SYSID>, _apply 가 send)를
       받아 이 옵션 팝업도 실시간 반영한다. ★ 구 optionS.html(ThemeSetting.js)엔 있던 구독이 신버전
       optionMain.js 에 누락돼, 한 창에서 적용해도 다른 창의 옵션 팝업은 안 바뀌던 원인. 같은 SYSID 채널을
       ipcMain(remote)으로 구독 → 메인 창들과 동일하게 수신. sOrigTheme 도 갱신해 Close 가 되돌리지 않게. */
    function _onThemeChangeFromOther(event, oData) {
        try {
            var sKey = _norm((oData && oData.THEME) || "");
            if (!sKey || THEMES.map(function (t) { return t.key; }).indexOf(sKey) === -1) { return; }
            if (window.U4ATheme) { window.U4ATheme.apply(sKey); }
            try { document.documentElement.style.removeProperty("--boot-bg"); } catch (e) { }
            sCurTheme = sKey;
            sOrigTheme = sKey;   // 다른 창이 "적용"한 게 새 기준 → 이 팝업 Close 가 옛 테마로 되돌리지 않게
            _markSel(sKey);      // 선택 카드 체크 갱신(카드 렌더 전이면 no-op)
        } catch (e) { }
    }
    try { if (SYSID) { IPCMAIN.on("if-p13n-themeChange-" + SYSID, _onThemeChangeFromOther); } } catch (e) { }
    // 창 닫힐 때 리스너 해제 — remote ipcMain 리스너를 안 떼면 창 파괴 후 브로드캐스트 시 메인에서 죽은
    //   콜백 호출로 오류. beforeunload 가 _close/네이티브 X 등 모든 닫힘 경로를 덮는다.
    window.addEventListener("beforeunload", function () {
        try { if (SYSID) { IPCMAIN.off("if-p13n-themeChange-" + SYSID, _onThemeChangeFromOther); } } catch (e) { }
    });

    document.addEventListener("DOMContentLoaded", function () {
        if (!document.getElementById("optCont")) {
            sOrigTheme = _norm((window.U4ATheme && window.U4ATheme.current && window.U4ATheme.current()) || "horizon_white");
            sCurTheme = sOrigTheme;
            _build();
        }
    });

})();
