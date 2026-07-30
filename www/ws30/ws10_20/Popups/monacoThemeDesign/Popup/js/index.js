/************************************************************************
 * monacoThemeDesign/Popup/js/index.js  (HTML5)
 * ----------------------------------------------------------------------
 *  Monaco 테마 디자이너 — 콘텐츠 로직. 원본 UI5(views/vw_main/view.js + control.js)의 기능을
 *  공통 자산(U4AUI.createField/createPanel/wireSplitter/confirm, .u4a-table/.u4a-busy/.u4a-toast)
 *  으로 1:1 이식. 원본 백업 = Popups/_backup_20260716_monacoThemeDesign_ui5.
 *
 *  [원본 대응]
 *   · 좌(PAGE1) : Language 콤보 + Monaco 라이브 프리뷰(EDITOR_FRAME1)
 *   · 우(PAGE2) : sap.m.Wizard 3 step + footer(Reset/Close) + finishButton(Save)
 *       - 위저드 UX = UI 템플릿 마법사와 100% 동일 자산(js/wizardNav.js, .u4aTplWiz__*) — 장군님 지시.
 *       - 원본 sap.m.WizardStep.validated 기본값 true(UI5 1.107) → 스텝 진행 게이트는
 *         stepActivate 의 checkThemeName 하나뿐(테마 미선택 시 discardProgress(STEP1)).
 *         템플릿 마법사 UX 는 Next 버튼 없이 avail(상태) 로 스텝을 여는 방식이므로
 *         "테마 선택 전 step2/3 미도달" = avail:[true, hasTheme, hasTheme] 로 동일하게 재현.
 *   · 색상 선택 : 원본 sap.ui.unified.ColorPickerPopover → 공통 HTML5 색상선택기 이식본
 *       (js/fnColorPickerPopover.js — WS20 속성 값도움과 동일 UX, #rrggbb 콜백)
 *   · Monaco 프리뷰(../monaco/) 는 원본 무수정 재사용 → 원본이 기대하는 전역
 *       (oAPP.views.VW_MAIN.attr.monacoVSPath/monacoLoaderPath, oAPP.WSUTIL) 을 그대로 노출.
 *
 *  [불변 계약]
 *   · 표준 테마 : APPPATH/lib/monaco/themes/*.json
 *   · 커스텀 테마: P13N_ROOT/monaco/theme/{SYSID}/{scopeCode}/list/{name}.json
 *   · 메시지는 전부 ZMSG_WS_COMMON_001 원본 키(001·005·056·315~342·946) — 신규 키 0개.
 ************************************************************************/

(function () {
    "use strict";

    /* ==================================================================
     * 1. Electron / Util 컨텍스트
     * ================================================================== */
    const REMOTE = require("@electron/remote"),
        PATH = REMOTE.require("path"),
        FS = REMOTE.require("fs"),
        APP = REMOTE.app,
        APPPATH = APP.getAppPath(),
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        WSERR = require(PATHINFO.WSTRYCATCH),
        IPCRENDERER = require("electron").ipcRenderer,
        IPCMAIN = REMOTE.require("electron").ipcMain,
        CURRWIN = REMOTE.getCurrentWindow();

    // 전역 오류 감시견(window.onerror + unhandledrejection) — 다른 팝업과 동일 표준(누락 보강 2026-07-30).
    const zconsole = WSERR(window, document, console);

    const oQueryParams = WSUTIL.QueryString.parse(location.href);
    const USERINFO = oQueryParams.USERINFO || {},
        LANGU = USERINFO.LANGU || "",
        SYSID = USERINFO.SYSID || "",
        BROWSKEY = oQueryParams.browserkey || "";

    /* ==================================================================
     * 2. 메시지 / 토스트 / busy / 오류
     * ================================================================== */
    // 워크스페이스 메시지(ZMSG_WS_COMMON_001) — 원본 oAPP.WSUTIL.getWsMsgClsTxt 동일.
    function wsMsg(sNo, sFallback) {
        try {
            const s = WSUTIL.getWsMsgClsTxt(LANGU, "ZMSG_WS_COMMON_001", sNo, "");
            if (s && s.trim()) { return s; }
        } catch (e) { console.error("[테마디자이너] 메시지 조회 실패:", sNo, e); }
        return sFallback || sNo;
    }

    // 메시지 클래스 텍스트(/U4A/CL_WS_COMMON 등) — 꾸밈정렬 라벨 C25(스니펫디자이너와 동일).
    const WSMSG = new WSUTIL.MessageClassText(SYSID, LANGU);
    function mcMsg(sCls, sNo, sFallback) {
        try { const s = WSMSG.fnGetMsgClsText(sCls, sNo); if (s && s.trim()) { return s; } }
        catch (e) { console.error("[테마디자이너] 메시지클래스 조회 실패:", sCls, sNo, e); }
        return sFallback || sNo;
    }

    // 공통 토스트(.u4a-toast) — 화면 정중앙·싱글톤·3초(원본 MessageToast center center).
    let _toastTimer = null;
    function _toast(sMsg) {
        if (!sMsg) { return; }
        // ★ 열린 <dialog>(busy/confirm top-layer) 위에 뜨도록 매 표시마다 host 재선택.
        const oHost = document.querySelector("dialog[open]") || document.body;
        let oT = document.getElementById("tdToast");
        if (!oT) {
            oT = document.createElement("div");
            oT.id = "tdToast";
            oT.className = "u4a-toast";
            oT.setAttribute("role", "alert");
        }
        if (oT.parentNode !== oHost) { oHost.appendChild(oT); }
        oT.textContent = sMsg;
        oT.setAttribute("data-show", "true");
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { try { oT.setAttribute("data-show", "false"); } catch (e) { } }, 3000);
    }

    // busy(top-layer <dialog>) — 원본 oAPP.fn.setBusy(화면 lock + closable 토글).
    let _bBusy = false;
    function fn_setBusy(bIsBusy) {
        _bBusy = !!bIsBusy;
        const oBusy = document.getElementById("tdBusy");
        if (!oBusy) { return; }
        try {
            if (bIsBusy) { if (!oBusy.open) { oBusy.showModal(); } }
            else { if (oBusy.open) { oBusy.close(); } }
        } catch (e) { console.error("[테마디자이너] busy 토글 오류:", e); }
    }

    // 자식창 일괄 busy 방송 수신 — 원본 frame.js _attachBroadCastEvent 이식.
    //   메인(WS)이 다른 별창(MIME/바인딩/문서/옵션/OTR 등 fnDialogPopupOpener 11곳)을 열 때
    //   `broadcast-to-child-window_{BROWSKEY}` 로 BUSY_ON 을 쏘면 떠 있는 모든 자식창이 함께 잠긴다.
    //   ★ 이 팝업은 수신 전용 — opener 는 BUSY_ON 을 쏘지 않는다(원본 index.js 에서 주석처리, 그대로 유지).
    let _oBroadToChild = null;
    function _attachBroadCastEvent() {
        try {
            _oBroadToChild = new BroadcastChannel("broadcast-to-child-window_" + BROWSKEY);
            _oBroadToChild.onmessage = function (oEvent) {
                const _PRCCD = (oEvent && oEvent.data && oEvent.data.PRCCD) || undefined;
                if (typeof _PRCCD === "undefined") { return; }

                // 프로세스에 따른 로직분기(원본 동일).
                switch (_PRCCD) {
                    case "BUSY_ON":
                        // BUSY ON을 요청받은경우.
                        fn_setBusy(true);
                        break;

                    case "BUSY_OFF":
                        // BUSY OFF를 요청 받은 경우.
                        fn_setBusy(false);
                        break;

                    default:
                        break;
                }
            };
        } catch (e) { console.error("[테마디자이너] BroadCast 배선 오류:", e); }
    }

    // 오류 모달(공통 U4AUI.confirm) — 원본 sap.m.MessageBox.error.
    function showErr(sMsg) {
        try { U4AUI.confirm({ type: "E", title: "", message: sMsg, buttons: [{ act: "OK", label: "OK", emphasized: true }] }); }
        catch (e) { console.error("[테마디자이너] 오류 모달 실패:", e, sMsg); }
    }

    // 실시간 워크스페이스 테마 변경 추종 — 원본 frame.js `if-p13n-themeChange-{SYSID}`
    //   (_onIpcMain_if_p13n_themeChange: insertCSS(BGCOL) + sap.ui.getCore().applyTheme).
    //   HTML5 는 UI5 applyTheme 대신 공통 U4ATheme.apply 로 대체(스니펫디자이너 선례 동일).
    //   원본 oAPP.fn.getThemeInfo 의 경로(p13n/theme_ws4/{SYSID}.json) = PATHINFO.THEME.
    function _getThemeInfo() {
        try {
            const sPath = PATH.join(PATHINFO.THEME, SYSID + ".json");
            if (!FS.existsSync(sPath)) { return null; }
            return JSON.parse(FS.readFileSync(sPath, "utf-8"));
        } catch (e) { console.error("[테마디자이너] 테마 정보 로드 오류:", e); return null; }
    }

    function _onThemeChange() {
        const oTheme = _getThemeInfo();
        if (!oTheme) { return; }
        try { CURRWIN.webContents.insertCSS("html, body { margin: 0px; height: 100%; background-color: " + oTheme.BGCOL + "; }"); } catch (e) { }
        try {
            if (window.U4ATheme && oTheme.THEME) {
                window.U4ATheme.apply(window.U4ATheme.normalize ? window.U4ATheme.normalize(oTheme.THEME) : oTheme.THEME);
            }
        } catch (e) { console.error("[테마디자이너] 테마 적용 오류:", e); }
    }

    const _THEME_CH = SYSID ? ("if-p13n-themeChange-" + SYSID) : "";

    /* ==================================================================
     * 3. 상수 (원본 control.js 그대로)
     * ================================================================== */
    // 언어 정보.
    const CT_LANGAGE = [
        { KEY: "javascript", TEXT: "javascript" },
        { KEY: "css", TEXT: "css" },
        { KEY: "html", TEXT: "html" }
    ];

    // DEFAULT 테마 색상(rules) — 이 목록에 있는 token 만 Rules 리스트로 노출.
    //   ★장군님 지시(실제 적용되는 것만): USP 에디터는 시맨틱 하이라이팅 OFF + 순수 monarch(js/css/html).
    //     실제 Monaco 로 전 토큰을 토크나이즈 검증 → "실제로 색이 먹는" 토큰만 남기고 나머지(미적용)는 제거.
    //   [제거된 미적용 25개 — 설정해도 안 바뀜 → SR 방지 위해 표에서 숨김]
    //     · 시맨틱(시맨틱하이라이팅 필요, 미활성): variable · variable.predefined · variable.parameter · constant
    //     · 타 언어 전용: string.sql · keyword.json · keyword.flow.scss · operator.scss/sql/swift · predefined.sql ·
    //                    meta.scss · tag.id.pug · tag.class.pug · delimiter.xml · metatag.xml · metatag.php ·
    //                    string.key.json · string.value.json · key
    //     · 마크다운: emphasis · strong
    //     · 기타: annotation(JS는 invalid 처리) · keyword.flow(monarch 미방출) · meta.tag(html은 metatag)
    //   (원본 control.js 전체 목록은 백업 _backup_20260716_monacoThemeDesign_ui5 에 보존.)
    const CT_DEFAILT_RULES = [
        { token: '', foreground: 'D4D4D4', background: '1E1E1E' },   // base(표에는 미노출, setRuleList가 '' skip)
        { token: 'invalid', foreground: 'f44747' },                  // 오류 코드 강조(구문 오류 시 적용)
        { token: 'comment', foreground: '608B4E' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'number.hex', foreground: '5BB498' },
        { token: 'regexp', foreground: 'B46695' },
        { token: 'type', foreground: '3DC9B0' },

        { token: 'delimiter', foreground: 'DCDCDC' },
        { token: 'delimiter.html', foreground: '808080' },

        { token: 'tag', foreground: '569CD6' },
        { token: 'metatag', foreground: 'DD6A6F' },
        { token: 'metatag.content.html', foreground: '9CDCFE' },
        { token: 'metatag.html', foreground: '569CD6' },

        { token: 'attribute.name', foreground: '9CDCFE' },
        { token: 'attribute.value', foreground: 'CE9178' },
        { token: 'attribute.value.number.css', foreground: 'B5CEA8' },
        { token: 'attribute.value.unit.css', foreground: 'B5CEA8' },
        { token: 'attribute.value.hex.css', foreground: 'D4D4D4' },

        { token: 'string', foreground: 'CE9178' },

        { token: 'keyword', foreground: '569CD6' }
    ];

    // DEFAULT 테마 색상(colors) — 이 목록에 있는 token 만 Colors 리스트로 노출.
    //   ★장군님 지시(실제 적용되는 것만): 표준 Monaco 색상키만 남긴다.
    //   [제거된 미적용 4개 — Monaco 비표준 키라 defineTheme 에서 무시됨(설정해도 안 먹음)]
    //     · editor.InactiveSelection    (표준=editor.inactiveSelectionBackground)
    //     · editor.IndentGuide1         (표준=editorIndentGuide.background1)
    //     · editor.ActiveIndentGuide1   (표준=editorIndentGuide.activeBackground1)
    //     · editor.SelectionHighlight   (표준=editor.selectionHighlightBackground)
    /* Colors 화이트리스트 — ★USP 에디터 옵션 기준으로 '실제 화면에 나타나는 것'만.
       원본 CT_DEFAULT_COLORS 6건 중 4건(editor.InactiveSelection / editor.IndentGuide1 /
       editor.ActiveIndentGuide1 / editor.SelectionHighlight)은 Monaco 에 존재하지 않는 색상 ID 라
       defineTheme 이 조용히 무시한다(실측: 해당 색이 CSS 로 방출조차 안 됨) → 제외.
       아래 7건은 Monaco 0.33.0 + USP 생성옵션 그대로 실측해 렌더 확인된 것만 남겼다.
         editor.background / editor.foreground        — 항상
         editor.selectionBackground                   — 드래그 선택
         editorCursor.foreground                      — 캐럿
         editorWhitespace.foreground                  — renderWhitespace 기본값('selection')에서 선택 시
         editorIndentGuide.background / .activeBackground — 들여쓰기 가이드(기본 on)
       ※ editor.lineHighlightBackground 는 54개 테마가 갖고 있으나 base(vs-dark) 상속
          editor.lineHighlightBorder 가 이겨 배경이 그려지지 않는다(실측 전 옵션값에서 미적용) → 제외.
       ※ 기본값은 Monaco vs-dark 실측치. */
    const CT_DEFAULT_COLORS = [
        { token: 'editor.background', color: '#1E1E1E' },
        { token: 'editor.foreground', color: '#D4D4D4' },
        { token: 'editor.selectionBackground', color: '#264F78' },
        { token: 'editorCursor.foreground', color: '#AEAFAD' },
        { token: 'editorWhitespace.foreground', color: '#E3E4E229' },
        { token: 'editorIndentGuide.background', color: '#E3E4E229' },
        { token: 'editorIndentGuide.activeBackground', color: '#E3E4E229' }
    ];

    // 폰트 스타일.
    const CT_FONT_STYLE = [
        { KEY: "", TEXT: "None" },
        { KEY: "F01", TEXT: "italic" },
        { KEY: "F02", TEXT: "bold" },
        { KEY: "F03", TEXT: "underline" }
    ];

    // TABLE VISIBLE ROW COUNT MAX값(원본 C_MAXROW) — HTML5 에선 "최대 7행 표시 후 스크롤".
    const C_MAXROW = 7;

    const C_LIGHT_THEME = wsMsg("333", "Light Theme");   // 333
    const C_DARK_THEME = wsMsg("334", "Dark Theme");     // 334
    const C_STANDARD_THEME = wsMsg("317", "Standard Theme"); // 317
    const C_CUSTOM_THEME = wsMsg("318", "Custom Theme");     // 318

    /* ==================================================================
     * 3.1 언어별 샘플 코드 (장군님 요청 — 원본엔 없던 추가)
     * ------------------------------------------------------------------
     *  좌측 미리보기 에디터에 기본 출력되는 예제. 우측 Rules 토큰/Colors 설정을 바꾸면 즉시
     *  눈으로 확인되도록 각 언어가 만들어내는 토큰(주석/키워드/문자열/숫자/16진수/정규식/변수/
     *  상수/타입/연산자/구분자/태그/속성명·값/색상값 등)을 최대한 빠짐없이 포함한다.
     *  ※ 원본 테마 디자이너는 빈 에디터 + 안내문구(340)만 있었다 → 이 샘플은 장군님 지시로 추가된 기능.
     * ================================================================== */
    const SAMPLES = {
        javascript: [
            "/**",
            " * 샘플: JavaScript 테마 색상 테스트 (블록 주석 / JSDoc)",
            " * @param {number} count 반복 횟수",
            " */",
            "// 한 줄 주석 — comment 토큰",
            "import { Router } from \"./router\";        // keyword, string",
            "",
            "const MAX_RETRY = 0xFF;                    // keyword, number.hex",
            "let ratio = 3.14, enabled = true, data = null;  // number, constant(true/null)",
            "const pattern = /^\\d{3}-\\w+$/gi;           // regexp",
            "",
            "class ThemeSample extends Router {          // keyword, type",
            "  constructor(name = \"default\") {          // string",
            "    super();",
            "    this.name = name;                       // key / 속성",
            "    this.items = [1, 2, 3];                 // number, delimiter",
            "  }",
            "",
            "  async load(url) {                         // keyword(async)",
            "    try {",
            "      const res = await fetch(url + \"?t=\" + Date.now());",
            "      if (!res.ok) throw new Error(\"실패!\"); // keyword.flow, string",
            "      return await res.json();",
            "    } catch (e) {",
            "      console.error(e);                     // variable",
            "      return { status: \"error\", code: 500 };// key, string, number",
            "    }",
            "  }",
            "}",
            "",
            "for (let i = 0; i < MAX_RETRY; i++) {       // keyword.flow, operator",
            "  // TODO: 반복 처리",
            "}",
            "export default ThemeSample;                 // keyword"
        ].join("\n"),

        css: [
            "/* 샘플: CSS 테마 색상 테스트 (comment) */",
            "@import url(\"base.css\");                    /* keyword, string */",
            "",
            ":root {",
            "  --primary: #3b82f6;                       /* attribute.name, hex */",
            "  --gap: 1.5rem;                            /* number, unit */",
            "}",
            "",
            ".card, #main > .item:hover {                /* 태그/클래스/아이디 선택자 */",
            "  color: rgba(255, 0, 0, 0.8);              /* attribute.name, number */",
            "  margin: 0 auto;",
            "  padding: 10px 1.5rem;                     /* number.css, unit.css */",
            "  background: #1e1e1e url(\"bg.png\") no-repeat;  /* hex, string */",
            "  border: 1px solid var(--primary) !important;   /* keyword !important */",
            "  transition: all 0.3s ease-in-out;",
            "}",
            "",
            "@media (max-width: 768px) {                 /* at-rule, number, unit */",
            "  .card { display: none; }                  /* keyword */",
            "}"
        ].join("\n"),

        html: [
            "<!DOCTYPE html>                             <!-- metatag -->",
            "<!-- 샘플: HTML 테마 색상 테스트 (comment) -->",
            "<html lang=\"ko\">                            <!-- tag, attribute.name/value -->",
            "<head>",
            "  <meta charset=\"utf-8\">",
            "  <title>테마 미리보기</title>",
            "  <style>",
            "    body { color: #333; margin: 0; }        /* 내장 CSS */",
            "  </style>",
            "</head>",
            "<body class=\"theme-sample\" data-id=\"42\">",
            "  <h1 id=\"title\">색상 테스트 &amp; 미리보기</h1>",
            "  <p>문단 텍스트 <a href=\"https://x.io\">링크</a></p>",
            "  <ul>",
            "    <li>항목 1</li>",
            "    <li>항목 2</li>",
            "  </ul>",
            "  <script>",
            "    const n = 10;                           // 내장 JS",
            "    console.log(n);",
            "  </script>",
            "</body>",
            "</html>"
        ].join("\n")
    };

    /* ==================================================================
     * 4. 상태(원본 oContr.oModel.oData / oContr.attr)
     * ================================================================== */
    const oData = {
        S_THEME: {
            LANGUAGE: "",           // 언어
            NAME: "",               // 테마명(파일명)
            THEME_SUBTX: "",        // 테마 dark / light text
            CUSTOM_NAME: "",        // 커스텀 테마명
            CUSTOM_NAME_EDIT: true  // 커스텀 테마명 입력 가능
        },
        T_FONT_STYLE: JSON.parse(JSON.stringify(CT_FONT_STYLE)),
        T_LANGAGE: [],
        T_THEME: [],    // 테마 DDLB [{KEY,TEXT,SUBTX,base,inherit,IS_STANDARD}]
        T_RULES: [],    // 선택 테마의 RULES
        T_COLORS: []    // 선택 테마의 COLORS
    };

    const oAttr = {
        themeChanged: false,     // standard theme 변경 flag
        monacoLibPath: "",
        monacoVSPath: "",
        monacoLoaderPath: "",
        standardThemePath: "",
        customThemePath: "",
        scopeCode: ""
    };

    // UI refs
    let oLanguField, oThemeField, oCustomNameField;
    let oNav = null, oPage = null;
    let oRulesTbody = null, oColorsTbody = null, oSubTxEl = null;
    let oBtnSave = null;

    /* ==================================================================
     * 5. 초기 데이터 구성 (원본 setInitData)
     * ================================================================== */
    function setInitData(sScopeCode) {

        oAttr.scopeCode = sScopeCode || "";

        // monaco editor 에디터 path.
        oAttr.monacoLibPath = PATH.join(APPPATH, "lib", "monaco");

        // monaco editor 폴더 경로.
        oAttr.monacoVSPath = PATH.join(oAttr.monacoLibPath, "vs");

        // monaco editor loader js 파일 경로.
        oAttr.monacoLoaderPath = PATH.join(oAttr.monacoVSPath, "loader.js");

        // standard 테마 경로.
        oAttr.standardThemePath = PATH.join(APPPATH, "lib", "monaco", "themes");

        // custom 테마 경로.
        //(p13n/monaco/theme/서버SID/호출처 SCOPE/list)
        oAttr.customThemePath = PATH.join(PATHINFO.P13N_ROOT, "monaco",
            "theme", SYSID, oAttr.scopeCode, "list");

        // ★ Monaco 프리뷰(../monaco/index.html + index.js)는 원본 무수정 재사용 →
        //   원본 UI5 팝업이 노출하던 전역 형태를 그대로 제공한다.
        //   (monaco/index.html: parent.oAPP.views.VW_MAIN.attr.monacoLoaderPath, parent.oAPP.WSUTIL
        //    monaco/index.js  : parent.oAPP.views.VW_MAIN.attr.monacoVSPath)
        window.oAPP = window.oAPP || {};
        window.oAPP.WSUTIL = WSUTIL;
        window.oAPP.views = { VW_MAIN: { attr: oAttr } };
    }

    /* ==================================================================
     * 6. 테마 목록 구성 (원본 getLanguageDDLBList / getThemeDDLBList)
     * ================================================================== */
    function getLanguageDDLBList() {
        const _aLangugage = [];
        for (let i = 0, l = CT_LANGAGE.length; i < l; i++) {
            const _sLanguage = CT_LANGAGE[i];
            _aLangugage.push({ KEY: _sLanguage.KEY, TEXT: _sLanguage.TEXT });
        }
        return _aLangugage;
    }

    // 해당 테마에서 편집 가능한 Rules 행이 하나라도 나오는지(화이트리스트 교집합).
    //   표준 테마 56개 중 Brilliance-Black 만 0건 — rules 366개가 전부 TextMate 스코프라
    //   monarch 토큰과 겹치는 게 meta.tag 하나뿐인데 그마저 미적용 토큰이다.
    //   선택해도 Rules 표가 비어 아무것도 못 하므로 목록에서 제외한다(장군님 지시).
    function _hasEditableRules(sThemeInfo) {
        const a = sThemeInfo && sThemeInfo.rules;
        if (!Array.isArray(a)) { return false; }
        for (let i = 0, l = a.length; i < l; i++) {
            const t = a[i] && a[i].token;
            if (!t) { continue; }
            if (CT_DEFAILT_RULES.some(function (o) { return o.token === t; })) { return true; }
        }
        return false;
    }

    // bSkipEmpty=true 면 Rules 0건 테마를 목록에서 제외(표준 테마에만 적용 —
    // 커스텀은 사용자가 저장한 자기 데이터라 임의로 숨기지 않는다).
    function getThemeDDLBList(themePath, bSkipEmpty) {
        const _aThemeList = [];

        // 해당 경로의 파일 및 폴더 항목 발췌.
        let _aFileList;
        try {
            _aFileList = FS.readdirSync(themePath);
        } catch (e) {
            return _aThemeList;
        }

        for (let i = 0, l = _aFileList.length; i < l; i++) {
            const _fileList = _aFileList[i];
            const _filePath = PATH.join(themePath, _fileList);

            let _oDirInfo;
            try {
                // 파일 or 폴더 정보 얻기.
                _oDirInfo = FS.statSync(_filePath);
            } catch (e) {
                continue;
            }

            // 파일 확인여부 function이 존재하지 않는다면 skip.
            if (typeof _oDirInfo?.isFile === "undefined") { continue; }

            // 파일이 아닌경우 skip.
            if (_oDirInfo.isFile() === false) { continue; }

            // 파일 정보 얻기.
            const _oFileInfo = PATH.parse(_filePath);
            if (typeof _oFileInfo === "undefined") { continue; }

            let _sThemeInfo;
            try {
                // 파일 읽기 → json 변환.
                const _themeJson = FS.readFileSync(PATH.join(themePath, _oFileInfo.base), "utf-8");
                _sThemeInfo = JSON.parse(_themeJson);
            } catch (error) {
                continue;
            }

            // 편집 가능한 Rules 가 0건인 테마는 목록에서 제외.
            if (bSkipEmpty === true && _hasEditableRules(_sThemeInfo) === false) { continue; }

            // theme sub text 정보 구성.
            const _SUBTX = setThemeSubText(_sThemeInfo?.base);

            _aThemeList.push({
                KEY: _oFileInfo.base,        // 실제 파일명(All-Hallows-Eve.json)
                TEXT: _oFileInfo.name,       // 확장자 없는 파일명(All-Hallows-Eve)
                SUBTX: _SUBTX,               // dark / light 테마
                base: _sThemeInfo?.base,     // BASE 테마 정보(vs, vs-dark)
                inherit: _sThemeInfo?.inherit
            });
        }

        return _aThemeList;
    }

    // theme sub text 정보 구성(원본 setThemeSubText).
    function setThemeSubText(base) {
        switch (base) {
            case "vs":
                return C_LIGHT_THEME;    // vs → Light 테마
            case "vs-dark":
                return C_DARK_THEME;     // vs-dark → Dark 테마
            default:
                break;
        }
        return undefined;
    }

    /* ==================================================================
     * 7. Monaco 프리뷰 통신 (원본 postMessage actcd 계약 — 불변)
     * ================================================================== */
    function _toPreview(oMsg) {
        try {
            const oFrame = document.querySelector(".EDITOR_FRAME1");
            if (!oFrame || !oFrame.contentWindow) { return; }
            oFrame.contentWindow.postMessage(oMsg);
        } catch (e) { console.error("[테마디자이너] 프리뷰 송신 오류:", e); }
    }

    // 에디터 준비 대기 — monaco/ 는 비동기 로드(require vs/editor.main 후 window.editor 생성).
    //   monaco/ 무수정 유지: 값 주입은 부모가 iframe.contentWindow.editor 로 직접(스니펫디자이너가
    //   getValue() 로 읽는 것과 동일한 동일출처 접근). ready 신호가 없으므로 짧게 폴링.
    function _ensureEditor(fnCb, iLeft) {
        const oFrame = document.querySelector(".EDITOR_FRAME1");
        let ed = null;
        try { ed = oFrame && oFrame.contentWindow && oFrame.contentWindow.editor; } catch (e) { ed = null; }
        if (ed) { try { fnCb(ed); } catch (e) { console.error("[테마디자이너] 에디터 콜백 오류:", e); } return; }
        const n = (typeof iLeft === "number") ? iLeft : 80;   // 80 × 80ms ≈ 6.4s
        if (n <= 0) { return; }
        setTimeout(function () { _ensureEditor(fnCb, n - 1); }, 80);
    }

    // 언어별 샘플 코드를 에디터에 출력(장군님 요청). 언어 선택/초기 로드 시 호출.
    function _applyLanguageSample(sLang) {
        const sCode = SAMPLES[sLang] || "";
        _ensureEditor(function (ed) {
            try { ed.setValue(sCode); } catch (e) { console.error("[테마디자이너] 샘플 주입 오류:", e); }
        });
    }

    /* ==================================================================
     * 7.1 공통 에디터 툴바(줌 · 꾸밈정렬) — 공통 모나코 에디터 필수 세트.
     *   monaco/ 무수정: 부모가 iframe 의 window.editor(Monaco) 내장 액션을 직접 호출.
     *   (스니펫 디자이너는 editorPopup/host 채널을 쓰지만, 이 팝업은 자체 monaco/ 프리뷰라 직접 호출.)
     * ================================================================== */
    let _fmtLabel = "";   // 꾸밈정렬 라벨(메시지클래스 C25) — _bindStaticTexts 에서 세팅
    const _MONACO_BASE_FONT = 14;   // monaco/index.js create 시 기본 폰트(줌% 계산 기준)

    // 에디터 액션 실행(내장 Monaco 액션) — 꾸밈정렬 등 줌 이외 액션용.
    function _edAction(sActionId) {
        _ensureEditor(function (ed) {
            try { const a = ed.getAction(sActionId); if (a) { a.run(); } }
            catch (e) { console.error("[테마디자이너] 에디터 액션 오류:", sActionId, e); }
        });
    }

    /* ---- 줌 : ★이 화면의 monaco/ 는 Monaco 내장 EditorZoom 이 아니라 자체 Ctrl+휠 핸들러가
         updateOptions({fontSize}) 로 폰트크기를 직접 바꾼다(monaco/index.js: currentFontSize 14, 10~50).
         따라서 editor.action.fontZoomIn/Out/Reset(EditorZoom)을 호출하면 Ctrl+휠로 바뀐 값이
         되돌아가지 않는다(=줌 초기화 무동작 버그). → 툴바도 그 핸들러를 그대로 구동한다:
         에디터 DOM 에 ctrlKey wheel 이벤트를 디스패치해 monaco/ 의 currentFontSize 와 항상 동기.
         (monaco/ 무수정 유지 + Ctrl+휠과 툴바가 단일 소스로 일치) ---- */
    const _ZOOM_MIN = 10, _ZOOM_MAX = 50;   // monaco/index.js 와 동일 클램프

    // nSteps > 0 = 확대, < 0 = 축소. monaco/ 핸들러가 1스텝당 1px 증감.
    function _zoomStep(nSteps) {
        _ensureEditor(function (ed) {
            try {
                const oFrame = document.querySelector(".EDITOR_FRAME1");
                const W = oFrame && oFrame.contentWindow;
                const oDom = ed.getDomNode();
                if (!W || !oDom) { return; }
                const iCnt = Math.abs(nSteps);
                const iDelta = (nSteps > 0) ? -1 : 1;   // deltaY<0 = 확대(monaco/ 핸들러 규약)
                for (let i = 0; i < iCnt; i++) {
                    oDom.dispatchEvent(new W.WheelEvent("wheel", {
                        ctrlKey: true, deltaY: iDelta, bubbles: true, cancelable: true
                    }));
                }
                _updateZoomLabel();
            } catch (e) { console.error("[테마디자이너] 줌 오류:", e); }
        });
    }

    // 줌 초기화 — 현재 폰트크기에서 기본(14)까지 필요한 스텝만큼 되돌린다.
    function _zoomReset() {
        _ensureEditor(function (ed) {
            try {
                const px = Math.round(_readFontSize(ed));
                const iDiff = px - _MONACO_BASE_FONT;
                if (iDiff !== 0) { _zoomStep(-iDiff); } else { _updateZoomLabel(); }
            } catch (e) { console.error("[테마디자이너] 줌 초기화 오류:", e); }
        });
    }

    // 현재 폰트 크기(px) 읽기 — iframe 의 monaco EditorOption 사용.
    function _readFontSize(ed) {
        try {
            const oFrame = document.querySelector(".EDITOR_FRAME1");
            const m = oFrame && oFrame.contentWindow && oFrame.contentWindow.monaco;
            if (m && m.editor && m.editor.EditorOption && ed.getOption) {
                return ed.getOption(m.editor.EditorOption.fontSize) || _MONACO_BASE_FONT;
            }
        } catch (e) { }
        return _MONACO_BASE_FONT;
    }

    // 줌% 라벨 갱신 — Ctrl+휠/버튼으로 fontSize 가 바뀌면 base(14) 대비 %.
    //   EditorOption enum 은 iframe 의 monaco 에 있으므로 그쪽에서 읽어 fontSize 조회.
    function _updateZoomLabel() {
        _ensureEditor(function (ed) {
            try {
                const pct = Math.round(_readFontSize(ed) / _MONACO_BASE_FONT * 100);
                const oBtn = document.getElementById("tdZoomBtn");
                if (oBtn) { const sp = oBtn.querySelector("span"); if (sp) { sp.textContent = pct + "%"; } oBtn.title = pct + "%"; }
            } catch (e) { }
        });
    }

    // 꾸밈정렬 지원 여부로 버튼 활성/비활성([format-btn-capability]). CSS 는 Monaco 미등록 → 비활성.
    //   1회 판정(현재 시점 스냅샷). 수렴은 _updateFormatCapSettled 가 담당.
    function _updateFormatCap() {
        let bSupported = false;
        try {
            const oFrame = document.querySelector(".EDITOR_FRAME1");
            const ed = oFrame && oFrame.contentWindow && oFrame.contentWindow.editor;
            const a = ed && ed.getAction("editor.action.formatDocument");
            bSupported = !!(a && (typeof a.isSupported !== "function" || a.isSupported()));
        } catch (e) { bSupported = false; }
        _setFormatCap(bSupported);
        return bSupported;
    }

    // 꾸밈정렬 버튼 표시 갱신(스니펫 디자이너 _setFormatCap 과 동일 역할).
    function _setFormatCap(bSupported) {
        const oBtn = document.getElementById("tdFormatBtn");
        if (!oBtn) { return; }
        oBtn.disabled = !bSupported;
        oBtn.title = _fmtLabel + (bSupported ? " (Shift + F1)" : " — N/A");
    }

    /* ★ 언어 반영은 비동기다 — 부모가 postMessage({actcd:"changeLanguage"}) 를 던진 직후 isSupported()
         를 읽으면 (a) 아직 이전 언어이거나 (b) 언어 첫 활성화(모드 setup)가 비동기라 포맷 provider 가
         미등록이라 일시 false 다. → "처음엔 안 뜨다 두번째부터 뜨는" 간헐 버그.
         공통 호스트(editorPopup/host/index.html _reportFmtCapSettled)와 동일하게, 지원으로 켜질 때까지
         몇 프레임 재판정해 수렴시킨다. 미지원 언어(css 등)는 상한까지만.
         그 사이 언어가 또 바뀌면(_fmtTk 증가) 이전 루프는 스스로 폐기 → 콤보 연타에도 마지막이 승리. */
    // 현재 에디터 모델의 실제 언어 id.
    function _curEditorLang() {
        try {
            const oFrame = document.querySelector(".EDITOR_FRAME1");
            const ed = oFrame && oFrame.contentWindow && oFrame.contentWindow.editor;
            const m = ed && ed.getModel();
            return (m && m.getLanguageId) ? m.getLanguageId() : "";
        } catch (e) { return ""; }
    }

    let _fmtTk = 0;
    function _updateFormatCapSettled(sLang) {
        _fmtTk++;
        const tk = _fmtTk;
        let iTry = 0;
        _ensureEditor(function () {
            (function loop() {
                if (tk !== _fmtTk) { return; }                  // 더 최근 언어변경 발생 → 폐기
                // ★언어가 아직 반영 전이면 판정 자체를 보류(이전 언어의 지원여부가 굳어버리는 것 방지).
                //   예: JS(지원) → CSS(미지원) 전환 시 0프레임에 판정하면 true 로 확정돼 버튼이 계속 활성.
                const bApplied = (!sLang || _curEditorLang() === sLang);
                if (!bApplied) { _setFormatCap(false); }                // 반영 전엔 비활성 유지
                else if (_updateFormatCap()) { return; }                // 지원 확정 → 종료
                if (iTry++ >= 10) { if (bApplied) { _updateFormatCap(); } return; }   // 상한 도달
                requestAnimationFrame(loop);
            })();
        });
    }

    // 에디터 준비 후 툴바 상태 동기 + fontSize 변경 구독(줌% 라벨).
    function _initEditorToolbar() {
        _ensureEditor(function (ed) {
            _updateZoomLabel();
            _updateFormatCapSettled(oData.S_THEME.LANGUAGE);
            try {
                // Ctrl+휠/버튼 줌 시 fontSize 변경 → 줌% 라벨 갱신(원본 monaco/index.js 도 fontSize 변경 감지).
                ed.onDidChangeConfiguration(function () { _updateZoomLabel(); });
                // 언어가 실제로 바뀐 시점에도 재판정(postMessage 반영 완료 시점의 진실).
                if (ed.onDidChangeModelLanguage) {
                    ed.onDidChangeModelLanguage(function () { _updateFormatCapSettled(_curEditorLang()); });
                }
            } catch (e) { }
            _bindEditorShortcuts(ed);
        });
    }

    /* ---- 공통 모나코 에디터 기본 단축키(editorPopup/host 와 동일 세트) ----
         Shift+F1 = 꾸밈정렬(editor.action.formatDocument)
         Ctrl+0   = 줌 초기화 → ★내장 fontZoomReset 이 아니라 _zoomReset() 호출.
                    이 화면의 monaco/ 는 updateOptions({fontSize}) 로 줌하므로
                    EditorZoom 계열(fontZoomReset)로는 되돌아가지 않는다(툴바 버그와 동일 원인).
         Ctrl+S   = 미배선 — 이 팝업의 저장은 에디터 내용 저장이 아니라 '테마 저장'이라 해당 없음.
         Ctrl+휠  = monaco/index.js 자체 핸들러가 이미 제공.
         (monaco/ 무수정 유지: 커맨드는 부모가 iframe 의 monaco KeyMod/KeyCode 로 등록) */
    let _bShortcutBound = false;
    function _bindEditorShortcuts(ed) {
        if (_bShortcutBound) { return; }
        try {
            const oFrame = document.querySelector(".EDITOR_FRAME1");
            const m = oFrame && oFrame.contentWindow && oFrame.contentWindow.monaco;
            if (!m || !m.KeyMod || !m.KeyCode || typeof ed.addCommand !== "function") { return; }

            // Shift+F1 — 꾸밈정렬
            ed.addCommand(m.KeyMod.Shift | m.KeyCode.F1, function () {
                _edAction("editor.action.formatDocument");
            });

            // Ctrl/⌘+0 — 줌 초기화(Monaco 버전별 enum 명 차이 대응)
            const _KEY_0 = (m.KeyCode.Digit0 != null) ? m.KeyCode.Digit0 : m.KeyCode.KEY_0;
            if (_KEY_0 != null) {
                ed.addCommand(m.KeyMod.CtrlCmd | _KEY_0, function () { _zoomReset(); });
            }

            _bShortcutBound = true;
        } catch (e) { console.error("[테마디자이너] 단축키 등록 오류:", e); }
    }

    // 에디터 테마 변경 처리(원본 changeEditorTheme).
    function changeEditorTheme() {
        // 테마 데이터 구성 처리.
        const _sData = setThemeData();
        if (!_sData) { return; }

        _sData.actcd = "changeTheme";

        // editor의 테마 데이터 구성.
        _sData.themeData = setEditorThemeData();

        _toPreview(_sData);
    }

    // 테마 데이터 구성 처리(원본 setThemeData).
    function setThemeData() {
        const _sData = {};

        const _sTheme = oData.T_THEME.find(item => item.KEY === oData.S_THEME.NAME);
        if (typeof _sTheme === "undefined") { return; }

        _sData.themeName = _sTheme.TEXT;

        // 영어, 숫자 - 이외의 문자 제거 처리.
        _sData.themeName = _sData.themeName.replace(/[^a-z0-9\-]/gi, "");

        // editor의 테마 데이터 구성.
        _sData.themeData = setEditorThemeData();

        return _sData;
    }

    // editor의 테마 데이터 구성(원본 setEditorThemeData).
    function setEditorThemeData() {
        if (oData.T_RULES.length === 0) { return; }
        if (oData.T_COLORS.length === 0) { return; }

        // 현재 선택한 테마의 라인 정보 얻기.
        const _sThemeInfo = oData.T_THEME.find(item => item.KEY === oData.S_THEME.NAME);
        if (typeof _sThemeInfo === "undefined") { return; }

        const _sTheme = {};
        _sTheme.base = _sThemeInfo.base;
        _sTheme.inherit = _sThemeInfo.inherit;
        _sTheme.rules = [];
        _sTheme.colors = {};

        // editor rules 정보 구성.
        for (let i = 0, l = oData.T_RULES.length; i < l; i++) {
            const _sRules = oData.T_RULES[i];
            const _sRuleList = {};

            _sRuleList.token = _sRules.token;

            // foreground 색상을 선택한 경우.
            if (typeof _sRules.FGROUND_COLOR !== "undefined") {
                _sRuleList.foreground = _sRules.FGROUND_COLOR + _sRules.FGROUND_OPACITY;
                _sRuleList.foreground = _sRuleList.foreground.replace(/#/, "");   // # 제거
            }

            // background 색상을 선택한 경우.
            if (typeof _sRules.BGROUND_COLOR !== "undefined") {
                _sRuleList.background = _sRules.BGROUND_COLOR + _sRules.BGROUND_OPACITY;
                _sRuleList.background = _sRuleList.background.replace(/#/, "");   // # 제거
            }

            const _sFontStyle = oData.T_FONT_STYLE.find(item => item.KEY === _sRules.fontStyle);
            if (typeof _sFontStyle !== "undefined") {
                // font style 구성 정보 매핑.
                _sRuleList.fontStyle = _sFontStyle.TEXT;
            }

            _sTheme.rules.push(_sRuleList);
        }

        // editor 색상 정보 구성.
        for (let i = 0, l = oData.T_COLORS.length; i < l; i++) {
            const _sColor = oData.T_COLORS[i];
            _sTheme.colors[_sColor.token] = _sColor.color + _sColor.COLOR_OPACITY;
        }

        return _sTheme;
    }

    /* ==================================================================
     * 8. 테마 상세 데이터 (원본 setThemeDetailData / setRuleList / setColorList)
     * ================================================================== */
    function setThemeDetailData() {
        if (oData.S_THEME.NAME === "") { return; }

        const _sThemeList = oData.T_THEME.find(item => item.KEY === oData.S_THEME.NAME);

        if (typeof _sThemeList !== "undefined") {
            oData.S_THEME.THEME_SUBTX = _sThemeList.SUBTX;
        }

        // default standard path.
        let _rootPath = oAttr.standardThemePath;

        // 선택한 테마가 custom theme인경우 custom 테마 path로 지정.
        if (_sThemeList.IS_STANDARD === false) {
            _rootPath = oAttr.customThemePath;

            // 커스텀 테마명 매핑.
            oData.S_THEME.CUSTOM_NAME = _sThemeList.TEXT;
            oData.S_THEME.CUSTOM_NAME_EDIT = false;
        }

        let _sThemeInfo;
        try {
            // 파일 읽기 → json 변환.
            const _themeJson = FS.readFileSync(PATH.join(_rootPath, oData.S_THEME.NAME), "utf-8");
            _sThemeInfo = JSON.parse(_themeJson);
        } catch (error) {
            // 339 Failed to load custom theme settings...
            showErr(wsMsg("339", "Failed to load custom theme settings."));
            fn_setBusy(false);
            return;
        }

        // rule 리스트 구성.
        setRuleList(_sThemeInfo);

        // color 리스트 구성.
        setColorList(_sThemeInfo);
    }

    // RULE LIST 구성 처리(원본 setRuleList).
    function setRuleList(sThemeInfo) {
        if (typeof sThemeInfo?.rules === "undefined") { return; }
        if (Array.isArray(sThemeInfo.rules) !== true) { return; }
        if (sThemeInfo.rules.length === 0) { return; }

        // json의 rules 항목을 기준으로 리스트 구성.
        for (let i = 0; i < sThemeInfo.rules.length; i++) {
            const _sRules = sThemeInfo.rules[i];

            if (_sRules.token === "") { continue; }

            // default rules에 존재하는건에 대해서만 리스트 구성.
            const _sDefault = CT_DEFAILT_RULES.find(items => items.token === _sRules.token);
            if (typeof _sDefault === "undefined") { continue; }

            const _sRuleList = {};

            _sRuleList.token = _sRules.token;
            _sRuleList.TOKEN_TX = _sRules.token;

            // 폰트 스타일.
            _sRuleList.fontStyle = _sRules?.fontStyle || "";

            // 폰트 스타일 DDLB 선택값.
            _sRuleList.FONT_STYLE = "";

            // foreground / background 버튼 DEFAULT 비활성 처리.
            _sRuleList.FGROUND_VISIBLE = false;
            _sRuleList.BGROUND_VISIBLE = false;

            // foreground 값이 존재하는경우.
            if (typeof _sRules.foreground !== "undefined") {
                _sRuleList.foreground = _sRules.foreground;
                _sRuleList.FGROUND_COLOR = _sRules.foreground;
                _sRuleList.FGROUND_OPACITY = "";

                // 색상코드가 #으로 시작되지 않는경우 # 추가.
                if (_sRuleList.FGROUND_COLOR.startsWith("#") === false) {
                    _sRuleList.FGROUND_COLOR = "#" + _sRuleList.FGROUND_COLOR;
                }

                // 색상코드가 #을 포함하여 7자리가 넘는경우(opacity값이 포함된경우).
                if (_sRuleList.FGROUND_COLOR.length > 7) {
                    _sRuleList.FGROUND_OPACITY = _sRuleList.FGROUND_COLOR.substr(7);
                    _sRuleList.FGROUND_COLOR = _sRuleList.FGROUND_COLOR.substr(0, 7);
                }

                _sRuleList.FGROUND_VISIBLE = true;
            }

            // background 값이 존재하는경우.
            if (typeof _sRules.background !== "undefined") {
                _sRuleList.background = _sRules.background;
                _sRuleList.BGROUND_COLOR = _sRules.background;
                _sRuleList.BGROUND_OPACITY = "";

                if (_sRuleList.BGROUND_COLOR.startsWith("#") === false) {
                    _sRuleList.BGROUND_COLOR = "#" + _sRuleList.BGROUND_COLOR;
                }

                if (_sRuleList.BGROUND_COLOR.length > 7) {
                    _sRuleList.BGROUND_OPACITY = _sRuleList.BGROUND_COLOR.substr(7);
                    _sRuleList.BGROUND_COLOR = _sRuleList.BGROUND_COLOR.substr(0, 7);
                }

                _sRuleList.BGROUND_VISIBLE = true;
            }

            oData.T_RULES.push(_sRuleList);
        }
    }

    // COLOR LIST 구성 처리(원본 setColorList).
    function setColorList(sThemeInfo) {
        if (typeof sThemeInfo?.colors === "undefined") { return; }

        // json의 color 항목을 기준으로 리스트 구성.
        for (const key in sThemeInfo.colors) {

            // default color에 존재하는건에 대해서만 리스트 구성.
            const _sDefault = CT_DEFAULT_COLORS.find(items => items.token === key);
            if (typeof _sDefault === "undefined") { continue; }

            const _sColorList = {};

            _sColorList.token = key;
            _sColorList.TOKEN_TX = key;
            _sColorList.color = sThemeInfo.colors[key];
            _sColorList.COLOR_OPACITY = "";

            if (_sColorList.color.startsWith("#") === false) {
                _sColorList.color = "#" + _sColorList.color;
            }

            if (_sColorList.color.length > 7) {
                _sColorList.COLOR_OPACITY = _sColorList.color.substr(7);
                _sColorList.color = _sColorList.color.substr(0, 7);
            }

            oData.T_COLORS.push(_sColorList);
        }
    }

    // 테마 데이터 초기화 처리(원본 resetThemeData).
    function resetThemeData(isAll) {
        // 테마를 변경하는 경우 standard theme 변경 flag 초기화.
        oAttr.themeChanged = false;

        if (isAll === true) {
            // 테마 선택건 초기화.
            oData.S_THEME.NAME = "";
        }

        // rules, color 리스트 초기화.
        oData.T_RULES = [];
        oData.T_COLORS = [];

        // theme dark, light text 초기화.
        oData.S_THEME.THEME_SUBTX = "";

        // 커스텀 테마명 입력필드 초기화.
        oData.S_THEME.CUSTOM_NAME = "";

        // default 커스텀 테마명 입력 가능.
        oData.S_THEME.CUSTOM_NAME_EDIT = true;

        // 오류 표현 필드 초기화.
        _setThemeVs(false);
        _setCustomNameVs(false, "");
    }

    /* ==================================================================
     * 9. 검증 (원본 checkThemeName / checkCustomThemeName)
     * ================================================================== */
    // 테마명 선택건 점검 — 오류면 true.
    function checkThemeName() {
        _setThemeVs(false);

        // 테마 정보 선택건 존재 여부 확인.
        if (oData.S_THEME.NAME === "") {
            // 335 Please select a theme.
            const _msg = wsMsg("335", "Please select a theme.");
            _setThemeVs(true);
            _toast(_msg);
            return true;
        }
        return undefined;
    }

    // 커스텀 테마명 입력건 확인 — 오류면 true.
    function checkCustomThemeName() {
        const _S_THEME = oData.S_THEME;

        // 오류 표현 필드 초기화.
        _setCustomNameVs(false, "");

        // 테마명을 입력하지 않은경우.
        if (_S_THEME.CUSTOM_NAME === "") {
            // 336 Please enter a theme name.
            const _msg = wsMsg("336", "Please enter a theme name.");
            _setCustomNameVs(true, _msg);
            _toast(_msg);
            return true;
        }

        const _oReg = new RegExp(/[^a-z0-9\-]/gi);

        // 허용 불가문자를 입력한 경우.
        if (_oReg.test(_S_THEME.CUSTOM_NAME) === true) {
            // 337 Only letters (A–Z, a–z), numbers, and hyphens (-) are allowed.
            const _msg = wsMsg("337", "Only letters (A-Z, a-z), numbers, and hyphens (-) are allowed.");
            _setCustomNameVs(true, _msg);
            _toast(_msg);
            return true;
        }

        const _CUSTOM_NAME = _S_THEME.CUSTOM_NAME.toLowerCase();

        // standard 테마명과 동일한 이름을 입력한 경우 오류 처리.
        if (oData.T_THEME.findIndex(item => item.TEXT.toLowerCase() === _CUSTOM_NAME && item.IS_STANDARD === true) !== -1) {
            // 338 You cannot use names of pre-defined standard themes.
            const _msg = wsMsg("338", "You cannot use names of pre-defined standard themes.");
            _setCustomNameVs(true, _msg);
            _toast(_msg);
            return true;
        }

        return undefined;
    }

    // 테마 콤보 value-state — 공통 createField(select)의 setValueState 는 no-op(15 §3.5.5) →
    //   화면 스코프로 콤보(.u4a-combo)에 data-vs 직접 토글(메시지는 토스트가 담당). 스니펫디자이너 선례.
    function _setThemeVs(bError) {
        const oCombo = oThemeField && oThemeField.el;
        if (!oCombo) { return; }
        if (bError) { oCombo.setAttribute("data-vs", "error"); } else { oCombo.removeAttribute("data-vs"); }
    }

    function _setCustomNameVs(bError, sMsg) {
        if (!oCustomNameField) { return; }
        try {
            if (bError) { oCustomNameField.setValueState("error", sMsg); }
            else { oCustomNameField.setValueState("none"); }
        } catch (e) { }
    }

    /* ==================================================================
     * 10. 이벤트 (원본 onChangeXxx / onSaveTheme / onResetThemeData)
     * ================================================================== */
    // 🔊 테마 ddlb 변경 이벤트(원본 onChangeTheme).
    function onChangeTheme(sValue) {

        oData.S_THEME.NAME = sValue || "";

        fn_setBusy(true);

        // 모델 바인딩 정보 초기화.
        resetThemeData();

        // 테마명이 존재하지 않는경우 exit.
        if (oData.S_THEME.NAME === "") {

            // 첫번째 step으로 이동 처리(discardProgress(STEP1) — avail 이 자동으로 [true,false,false]).
            _renderAll();
            U4ATplWiz.scrollToCard(oNav, 0);

            const _sData = {};
            _sData.actcd = "defaultTheme";
            _sData.themeName = "vs-dark";
            _toPreview(_sData);

            fn_setBusy(false);
            return;
        }

        // 테마 상세 데이터 구성.
        setThemeDetailData();

        _renderAll();

        // 에디터 테마 변경 처리.
        changeEditorTheme();

        fn_setBusy(false);
    }

    // 🔊 Langage 변경 이벤트(원본 onChangeLangage).
    function onChangeLangage(sValue) {
        fn_setBusy(true);

        oData.S_THEME.LANGUAGE = sValue || "";

        const _sData = {};
        _sData.actcd = "changeLanguage";
        _sData.language = oData.S_THEME.LANGUAGE;
        _toPreview(_sData);

        // 선택한 언어의 샘플 코드로 교체(장군님 요청 — 언어별 예제로 색상 테스트).
        _applyLanguageSample(oData.S_THEME.LANGUAGE);

        // 언어가 바뀌면 꾸밈정렬 지원 여부 재평가(JS/HTML 지원, CSS 미등록 → 비활성).
        //   ★즉시 판정 금지 — postMessage 반영이 비동기라 이전 언어 결과가 굳는다. 수렴 루프로.
        _updateFormatCapSettled(oData.S_THEME.LANGUAGE);

        fn_setBusy(false);
    }

    // 🔊 전경색 변경 이벤트(원본 onChangeForegroundColor).
    function onChangeForegroundColor(oBtn, _sRule) {
        if (typeof _sRule === "undefined") { return; }

        // 색상선택 팝업 호출(원본 callColorPopup — 취소 시 콜백 미호출 = undefined 반환과 동일).
        callColorPopup(oBtn, _sRule.FGROUND_COLOR, function (_color) {
            if (typeof _color === "undefined") { return; }

            // theme 변경함 flag 처리.
            oAttr.themeChanged = true;

            fn_setBusy(true);

            _sRule.FGROUND_COLOR = _color;
            _sRule.foreground = _color.replace(/#/, "");

            _renderRules();

            // 에디터 테마 변경 처리.
            changeEditorTheme();

            fn_setBusy(false);
        });
    }

    // 🔊 배경색 변경 이벤트(원본 onChangeBackgroundColor).
    function onChangeBackgroundColor(oBtn, _sRule) {
        if (typeof _sRule === "undefined") { return; }

        callColorPopup(oBtn, _sRule.BGROUND_COLOR, function (_color) {
            if (typeof _color === "undefined") { return; }

            oAttr.themeChanged = true;

            fn_setBusy(true);

            _sRule.BGROUND_COLOR = _color;
            _sRule.background = _color.replace(/#/, "");

            _renderRules();

            changeEditorTheme();

            fn_setBusy(false);
        });
    }

    // 🔊 색상 변경 이벤트(원본 onChangeColor).
    function onChangeColor(oBtn, _sColor) {
        if (typeof _sColor === "undefined") { return; }

        callColorPopup(oBtn, _sColor.color, function (_color) {
            if (typeof _color === "undefined") { return; }

            oAttr.themeChanged = true;

            fn_setBusy(true);

            _sColor.color = _color;

            _renderColors();

            changeEditorTheme();

            fn_setBusy(false);
        });
    }

    // 🔊 폰트 스타일 변경 이벤트(원본 onChangeFontStyle).
    function onChangeFontStyle(_sRule, sValue) {
        fn_setBusy(true);

        _sRule.fontStyle = sValue || "";

        // theme 변경함 flag 처리.
        oAttr.themeChanged = true;

        // 에디터 테마 변경 처리.
        changeEditorTheme();

        fn_setBusy(false);
    }

    // 색상 선택 팝업 호출(원본 callColorPopup → sap.ui.unified.ColorPickerPopover).
    //   공통 HTML5 색상선택기 이식본 소비(#rrggbb 콜백 = 원본 getParameter("hex") 동일).
    function callColorPopup(oAnchor, sColor, fnCb) {
        try {
            window.U4AColorPicker.open(oAnchor, sColor, fnCb);
        } catch (e) {
            console.error("[테마디자이너] 색상선택 팝업 오류:", e);
        }
    }

    // 🔊 테마 저장 이벤트(원본 onSaveTheme = Wizard complete/finishButton).
    async function onSaveTheme() {

        // 테마명 선택건 점검.
        if (checkThemeName() === true) {
            // 첫번째 step으로 이동 처리.
            _renderAll();
            U4ATplWiz.scrollToCard(oNav, 0);
            return;
        }

        // 커스텀 테마명 입력건 확인.
        if (checkCustomThemeName() === true) {
            // 세번째 step으로 이동 처리 + 포커스.
            U4ATplWiz.scrollToCard(oNav, 2);
            try { oCustomNameField.focus(); } catch (e) { }
            return;
        }

        // 329 Do you want to save the theme settings?
        const _conf = await new Promise(function (resolve) {
            U4AUI.confirm({
                type: "C",
                message: wsMsg("329", "Do you want to save the theme settings?"),
                onClose: function (a) { resolve(a); }
            });
        });

        if (_conf !== "YES") { return; }

        fn_setBusy(true);

        // 커스텀 테마 저장 경로의 폴더가 생성 됐는지 여부 확인.
        if (FS.existsSync(oAttr.customThemePath) === false) {
            try {
                FS.mkdirSync(oAttr.customThemePath, { recursive: true });
            } catch (error) {
                // 342 Failed to create theme save path...
                //   순서 = 원본 control.js 동일(오류 표시 → busy off).
                console.error("[테마디자이너] 테마 저장 경로 생성 오류:", error);
                showErr(wsMsg("342", "Failed to create theme save path."));
                fn_setBusy(false);
                return;
            }
        }

        // 테마 데이터 구성 처리.
        const _sData = setEditorThemeData();

        // 파일명 구성.
        const _fileName = oData.S_THEME.CUSTOM_NAME + ".json";

        try {
            // 파일 저장 처리.
            FS.writeFileSync(PATH.join(oAttr.customThemePath, _fileName), JSON.stringify(_sData, "", 2));
        } catch (error) {
            // 330 Failed to save the theme settings...
            //   순서 = 원본 control.js 동일(오류 표시 → busy off).
            console.error("[테마디자이너] 테마 저장 오류:", error);
            showErr(wsMsg("330", "Failed to save the theme settings."));
            fn_setBusy(false);
            return;
        }

        // 해당 테마가 기존 테마 ddlb 리스트에 존재하는지 확인.
        let _sThemeInfo = oData.T_THEME.find(items => items.KEY === _fileName);

        // 존재하지 않는경우 신규 추가 처리.
        if (typeof _sThemeInfo === "undefined") {
            _sThemeInfo = {};
            oData.T_THEME.push(_sThemeInfo);
        }

        _sThemeInfo.KEY = _fileName;
        _sThemeInfo.TEXT = oData.S_THEME.CUSTOM_NAME;
        _sThemeInfo.base = _sData.base;
        _sThemeInfo.inherit = _sData.inherit;

        // theme sub text 정보 구성.
        _sThemeInfo.SUBTX = setThemeSubText(_sThemeInfo.base);
        _sThemeInfo.IS_STANDARD = false;

        // 테마 변경함 flag 초기화.
        oAttr.themeChanged = false;

        // 커스텀 테마명 입력 필드 잠금 처리.
        oData.S_THEME.CUSTOM_NAME_EDIT = false;

        // 테마명 ddlb 선택건 변경 처리.
        oData.S_THEME.NAME = _fileName;

        _renderAll();

        // 331 Theme settings have been saved.
        _toast(wsMsg("331", "Theme settings have been saved."));

        fn_setBusy(false);
    }

    // 🔊 테마 초기화 기능(원본 onResetThemeData).
    function onResetThemeData() {
        fn_setBusy(true);

        // 테마 데이터 초기화 처리.
        resetThemeData(true);

        // 첫번째 step으로 이동 처리.
        _renderAll();
        U4ATplWiz.scrollToCard(oNav, 0);

        // 332 Theme settings have been reset.
        _toast(wsMsg("332", "Theme settings have been reset."));

        fn_setBusy(false);
    }

    // 🔊 테마 팝업 종료 이벤트(원본 onCloseThemeEditorPopup — parent.CURRWIN.close()).
    function onCloseThemeEditorPopup() {
        if (_bBusy) { return; }   // busy 중 닫기 차단
        try { U4AUI.closeWindow(CURRWIN); } catch (e) { console.error("[테마디자이너] 닫기 오류:", e); }
    }

    /* ==================================================================
     * 11. 초기 모델 바인딩 (원본 fnInitModelBinding)
     * ================================================================== */
    function fnInitModelBinding() {

        // 언어 DDLB 리스트 구성.
        oData.T_LANGAGE = getLanguageDDLBList();

        // stadard 테마 리스트 구성.
        const _aStandardThemeList = getThemeDDLBList(oAttr.standardThemePath, true);

        // custom 테마 리스트 구성.
        const _aCustomThemeList = getThemeDDLBList(oAttr.customThemePath);

        // stadard 테마 정보 ddlb 리스트 구성.
        for (let i = 0, l = _aStandardThemeList.length; i < l; i++) {
            const _s = _aStandardThemeList[i];
            oData.T_THEME.push({
                KEY: _s.KEY, TEXT: _s.TEXT, SUBTX: _s.SUBTX,
                base: _s.base, inherit: _s.inherit, IS_STANDARD: true
            });
        }

        // 커스텀 테마 정보 ddlb 리스트 구성.
        for (let i = 0, l = _aCustomThemeList.length; i < l; i++) {
            const _s = _aCustomThemeList[i];
            oData.T_THEME.push({
                KEY: _s.KEY, TEXT: _s.TEXT, SUBTX: _s.SUBTX,
                base: _s.base, inherit: _s.inherit, IS_STANDARD: false
            });
        }

        // DEFAULT LANGUAGE 설정.
        oData.S_THEME.LANGUAGE = oData.T_LANGAGE[0].KEY;
    }

    /* ==================================================================
     * 12. 렌더 (원본 UI5 모델 바인딩 → 수동 렌더)
     * ================================================================== */
    // 테마 콤보 항목 — 원본 ComboBox sorter(IS_STANDARD 그룹: Standard Theme / Custom Theme).
    //   공통 createSelect 의 group 지원 소비. 빈 항목("")은 원본 ComboBox 의 "미선택" 상태 재현.
    function _themeItems() {
        // ★순서 = 원본 ComboBox sorter Sorter("IS_STANDARD", false)=오름차순 → false(커스텀)가 먼저,
        //   true(표준)가 뒤. 즉 저장한 커스텀 테마가 목록 상단, 표준 테마가 하단(원본 동일).
        //   (빈 항목은 원본에 없으므로 넣지 않는다 — 초기 미선택은 value="" 로 콤보가 빈칸 표시.)
        const a = [];
        oData.T_THEME.forEach(function (t) {
            if (t.IS_STANDARD !== true) { a.push({ value: t.KEY, text: t.TEXT, group: C_CUSTOM_THEME }); }
        });
        oData.T_THEME.forEach(function (t) {
            if (t.IS_STANDARD === true) { a.push({ value: t.KEY, text: t.TEXT, group: C_STANDARD_THEME }); }
        });
        return a;
    }

    // 색상 칩(원본 화면 동일 — 색을 면으로 채운 사각 스와치).
    //   ★ 글리프를 색으로 칠하던 방식은 명도가 배경과 비슷하면 사라지고(#1E1E1E) 밝은 색은 전부
    //     흰색으로 뭉개져(#D4D4D4/#CE9178) 식별 불가 → 원본대로 면(스와치)으로 표시한다.
    //   색상값 자체는 데이터(사용자 테마 색)이므로 인라인 style 로 칠한다(의미 토큰 대상 아님).
    //   opacity(8자리 hex #RRGGBBAA)도 그대로 반영 → 뒤 체커보드가 비쳐 투명도가 보인다.
    function _colorSwatch(sColor, sOpacity, fnClick) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "u4a-btn u4aTdSwatch";
        // 2겹: 바깥=체커보드(투명도 배경), 안=실제 색. ★색을 체커보드와 같은 요소에 칠하면
        //   background-image(체커) 가 background-color(색) 위에 그려져 오히려 얼룩진다.
        const oChip = document.createElement("span");
        oChip.className = "u4aTdSwatch__chip";
        const oFill = document.createElement("span");
        oFill.className = "u4aTdSwatch__fill";
        const sFull = (sColor || "") + (sOpacity || "");
        oFill.style.backgroundColor = sFull;
        oChip.appendChild(oFill);
        b.appendChild(oChip);
        b.setAttribute("data-tip", sFull);
        b.addEventListener("click", function () { fnClick(b); });
        return b;
    }

    // 키워드 셀 — 최대 2줄까지 개행 허용, 넘치면 말줄임(장군님 지시). 잘릴 때만 공통 툴팁(§2.9a).
    function _keyCell(sText) {
        const td = document.createElement("td");
        td.className = "u4aTdKeyCell";
        const sp = document.createElement("span");
        sp.className = "u4aTdKey";
        sp.textContent = sText;
        sp.setAttribute("data-tip", sText);
        sp.setAttribute("data-tip-trunc", "");
        td.appendChild(sp);
        return td;
    }

    function _nodataRow(iCols) {
        const tr = document.createElement("tr");
        tr.className = "u4a-table__nodata";
        const td = document.createElement("td");
        td.colSpan = iCols;
        td.textContent = wsMsg("946", "No data");
        tr.appendChild(td);
        return tr;
    }

    // Rules 테이블(원본 TABLE1: Keyword | Foreground Color | Background Color | Font Style).
    function _renderRules() {
        if (!oRulesTbody) { return; }
        oRulesTbody.innerHTML = "";

        if (oData.T_RULES.length === 0) { oRulesTbody.appendChild(_nodataRow(4)); return; }

        // 지브라(data-odd) 미사용 — 회색 겹침이 얼룩져 보인다는 장군님 지적 반영(원본도 무지브라).
        oData.T_RULES.forEach(function (r) {
            const tr = document.createElement("tr");

            // Keyword
            tr.appendChild(_keyCell(r.TOKEN_TX));

            // Foreground Color (visible = FGROUND_VISIBLE)
            const tdF = document.createElement("td");
            tdF.className = "u4aTdColorCell";
            if (r.FGROUND_VISIBLE === true) {
                tdF.appendChild(_colorSwatch(r.FGROUND_COLOR, r.FGROUND_OPACITY, function (b) { onChangeForegroundColor(b, r); }));
            }
            tr.appendChild(tdF);

            // Background Color (visible = BGROUND_VISIBLE)
            const tdB = document.createElement("td");
            tdB.className = "u4aTdColorCell";
            if (r.BGROUND_VISIBLE === true) {
                tdB.appendChild(_colorSwatch(r.BGROUND_COLOR, r.BGROUND_OPACITY, function (b) { onChangeBackgroundColor(b, r); }));
            }
            tr.appendChild(tdB);

            // Font Style (원본 sap.m.Select width 100%, selectedKey={fontStyle})
            //   ★ 원본 sap.m.Select 는 forceSelection=true(기본) — selectedKey 가 항목 KEY(""/F01/F02/F03)와
            //     안 맞으면(테마 json 이 "bold"/"italic" 실제값을 넣는 32개 테마) 첫 항목(None)으로 강제 선택하고
            //     모델도 그 값으로 갱신한다(UI5 1.107 원전 확인). 공통 콤보는 미매칭 시 빈칸을 내므로,
            //     여기서 동일하게 정규화해 원본과 같은 "None" 표시 + 모델 갱신을 재현한다.
            const tdS = document.createElement("td");
            const _bValidFs = oData.T_FONT_STYLE.some(function (f) { return f.KEY === r.fontStyle; });
            if (!_bValidFs) { r.fontStyle = ""; }   // forceSelection: 미매칭 → 첫 항목(None)으로 모델 갱신
            const oSel = U4AUI.createField({
                type: "select",
                items: oData.T_FONT_STYLE.map(function (f) { return { value: f.KEY, text: f.TEXT }; }),
                value: r.fontStyle,
                onChange: function (v) { onChangeFontStyle(r, v); }
            });
            tdS.appendChild(oSel.el);
            tr.appendChild(tdS);

            oRulesTbody.appendChild(tr);
        });
    }

    // Colors 테이블(원본 TABLE2: Keyword | Color).
    function _renderColors() {
        if (!oColorsTbody) { return; }
        oColorsTbody.innerHTML = "";

        if (oData.T_COLORS.length === 0) { oColorsTbody.appendChild(_nodataRow(2)); return; }

        oData.T_COLORS.forEach(function (c) {
            const tr = document.createElement("tr");

            tr.appendChild(_keyCell(c.TOKEN_TX));

            const tdC = document.createElement("td");
            tdC.className = "u4aTdColorCell";
            tdC.appendChild(_colorSwatch(c.color, c.COLOR_OPACITY, function (b) { onChangeColor(b, c); }));
            tr.appendChild(tdC);

            oColorsTbody.appendChild(tr);
        });
    }

    // 전체 재렌더(원본 oModel.refresh 대응).
    function _renderAll() {
        // 테마 콤보 / 커스텀명 / 서브텍스트 동기화.
        try { oThemeField.setItems(_themeItems()); } catch (e) { }
        try { oThemeField.setValue(oData.S_THEME.NAME); } catch (e) { }
        try { oCustomNameField.setValue(oData.S_THEME.CUSTOM_NAME); } catch (e) { }
        // 원본 Input enabled:"{/S_THEME/CUSTOM_NAME_EDIT}" = 비활성(disabled). readOnly 아님(15 §입력칸 구분).
        try { oCustomNameField.input.disabled = (oData.S_THEME.CUSTOM_NAME_EDIT === false); } catch (e) { }
        if (oSubTxEl) { oSubTxEl.textContent = oData.S_THEME.THEME_SUBTX || ""; }

        _renderRules();
        _renderColors();

        // 위저드 스텝(avail/current) + 카드 노출 + Save 버튼 + 하단 여백.
        U4ATplWiz.syncNav(oNav);
        U4ATplWiz.gateCards(oNav);
        if (oBtnSave) { oBtnSave.hidden = (oData.S_THEME.NAME === ""); }
        U4ATplWiz.updateScrollPad(oPage);
    }

    /* ==================================================================
     * 13. UI 빌드
     * ================================================================== */
    // 위저드 스텝 디스크립터 provider(원본 3 WizardStep).
    //   avail : step1=항상 / step2·step3=테마 선택됨(원본 checkThemeName 게이트와 동일 효과).
    function _wizProvider() {
        const bTheme = oData.S_THEME.NAME !== "";
        const a = [
            { label: wsMsg("316", "Choose theme"), avail: true, current: false, scroll: function () { U4ATplWiz.scrollToCard(oNav, 0); } },
            { label: wsMsg("319", "Setting theme properties"), avail: bTheme, current: false, scroll: function () { U4ATplWiz.scrollToCard(oNav, 1); } },
            { label: wsMsg("327", "Custom Theme Name"), avail: bTheme, current: false, scroll: function () { U4ATplWiz.scrollToCard(oNav, 2); } }
        ];
        U4ATplWiz.markCurrent(a);
        return a;
    }

    // 테이블(공통 .u4a-table-wrap + .u4a-table). 최대 C_MAXROW(7)행 표시 후 스크롤.
    //   ★ `--boxed`(테두리+radius+surface) 미부착 — 이 테이블은 이미 액자인 위저드 스텝 카드 안에
    //     들어가므로 붙이면 테두리가 이중으로 겹쳐 답답해진다(장군님 지적). 액자 역할은 카드가 한다.
    function _buildTable(aCols, sTblClass) {
        const oWrap = document.createElement("div");
        oWrap.className = "u4a-table-wrap u4aTdTblWrap";

        const oTbl = document.createElement("table");
        oTbl.className = "u4a-table " + (sTblClass || "");

        const oThead = document.createElement("thead");
        const oTrH = document.createElement("tr");
        aCols.forEach(function (c) {
            const th = document.createElement("th");
            th.textContent = c.label;
            if (c.cls) { th.className = c.cls; }
            oTrH.appendChild(th);
        });
        oThead.appendChild(oTrH);
        oTbl.appendChild(oThead);

        const oTbody = document.createElement("tbody");
        oTbl.appendChild(oTbody);
        oWrap.appendChild(oTbl);

        return { wrap: oWrap, tbody: oTbody };
    }

    function _buildLeft() {
        // Language 라벨 + 콤보(원본 HBOX1: Label(001) + ComboBox).
        const oLbl = document.getElementById("tdLanguLabel");
        if (oLbl) { oLbl.textContent = wsMsg("001", "Language"); }

        oLanguField = U4AUI.createField({
            type: "select",
            items: oData.T_LANGAGE.map(function (l) { return { value: l.KEY, text: l.TEXT }; }),
            value: oData.S_THEME.LANGUAGE,
            onChange: onChangeLangage
        });
        document.getElementById("tdLanguHost").appendChild(oLanguField.el);

        // 꾸밈정렬 라벨(C25) 세팅.
        _fmtLabel = mcMsg("/U4A/CL_WS_COMMON", "C25", "Pretty Print");
        const oFmtTxt = document.getElementById("tdFormatText");
        if (oFmtTxt) { oFmtTxt.textContent = _fmtLabel; }

        // 공통 에디터 툴바(줌−/줌%/줌+/꾸밈정렬) 버튼 배선 — Monaco 내장 액션 직접 호출.
        const _byId = function (id) { return document.getElementById(id); };
        // 줌 = monaco/ 자체 Ctrl+휠 핸들러 구동(EditorZoom 아님 — 위 _zoomStep 주석 참조).
        if (_byId("tdZoomOut")) { _byId("tdZoomOut").addEventListener("click", function () { _zoomStep(-1); }); }
        if (_byId("tdZoomBtn")) { _byId("tdZoomBtn").addEventListener("click", _zoomReset); }
        if (_byId("tdZoomIn")) { _byId("tdZoomIn").addEventListener("click", function () { _zoomStep(1); }); }
        if (_byId("tdFormatBtn")) { _byId("tdFormatBtn").addEventListener("click", function () { _edAction("editor.action.formatDocument"); }); }

        // 툴바 반응형 오버플로(⋯) — 공통 attachOverflow(§11). btnClass 는 화면 툴바 버튼과 동일(평면).
        try { U4AUI.attachOverflow(document.getElementById("tdEdTools"), { noOvfAutoMargin: true, btnClass: "u4a-btn u4aTdFlat u4aTdOvfBtn" }); }
        catch (e) { console.error("[테마디자이너] 에디터 툴바 오버플로 배선 오류:", e); }

        // Monaco 프리뷰 iframe — oAPP 전역 노출(setInitData) 이후에 src 주입(레이스 방지).
        const oFrame = document.getElementById("tdPreview");
        if (oFrame) { oFrame.src = "../monaco/index.html"; }

        // 에디터 준비되면 툴바 상태 초기화(줌% + 꾸밈정렬 capability + fontSize 구독).
        _initEditorToolbar();
    }

    function _buildWizard() {
        oPage = document.getElementById("tdPage");
        const oWiz = document.getElementById("tdWiz");

        // 진행 내비게이터(스티키) — UI 템플릿 마법사와 동일 자산.
        oNav = U4ATplWiz.buildNav(_wizProvider);
        oWiz.appendChild(oNav.els.nav);

        // 스텝 카드 컨테이너.
        const oSteps = document.createElement("div");
        oSteps.className = "u4aTplWiz__steps";
        oWiz.appendChild(oSteps);

        /* ---- Step 1 : 테마 선택(원본 WIZARDSTEP1 = Label(005) + ComboBox + Text(SUBTX)) ---- */
        const oB1 = U4ATplWiz.makeCard(oNav, 0, oSteps);
        const oRow1 = document.createElement("div");
        oRow1.className = "u4aTdRow";

        const oThLbl = document.createElement("label");
        oThLbl.className = "u4aTdRow__label";
        oThLbl.setAttribute("data-required", "true");
        oThLbl.textContent = wsMsg("005", "Theme");
        oRow1.appendChild(oThLbl);

        oThemeField = U4AUI.createField({
            type: "select",
            items: _themeItems(),
            value: "",
            onChange: onChangeTheme
        });
        oThemeField.el.classList.add("u4aTdThemeCombo");
        oRow1.appendChild(oThemeField.el);

        oSubTxEl = document.createElement("span");
        oSubTxEl.className = "u4aTdSubTx";
        oRow1.appendChild(oSubTxEl);

        oB1.appendChild(oRow1);

        /* ---- Step 2 : 테마 속성 설정(원본 WIZARDSTEP2 = PANEL1(Rules) + PANEL2(Colors)) ---- */
        const oB2 = U4ATplWiz.makeCard(oNav, 1, oSteps);

        // PANEL1 : Rules(320)
        const oPanel1 = U4AUI.createPanel({ title: wsMsg("320", "Rules") });
        const oTbl1 = _buildTable([
            { label: wsMsg("321", "Keyword") },
            { label: wsMsg("322", "Foreground Color"), cls: "u4aTdColorCell" },
            { label: wsMsg("323", "Background Color"), cls: "u4aTdColorCell" },
            { label: wsMsg("324", "Font Style"), cls: "u4aTdFsCell" }
        ], "u4aTdRulesTbl");
        oRulesTbody = oTbl1.tbody;
        oPanel1.body.appendChild(oTbl1.wrap);
        oPanel1.el.classList.add("u4aTdPanel");
        oB2.appendChild(oPanel1.el);

        // PANEL2 : Colors(325)
        const oPanel2 = U4AUI.createPanel({ title: wsMsg("325", "Colors") });
        const oTbl2 = _buildTable([
            { label: wsMsg("321", "Keyword") },
            { label: wsMsg("326", "Color"), cls: "u4aTdColorCell" }
        ], "u4aTdColorsTbl");
        oColorsTbody = oTbl2.tbody;
        oPanel2.body.appendChild(oTbl2.wrap);
        oPanel2.el.classList.add("u4aTdPanel");
        oB2.appendChild(oPanel2.el);

        /* ---- Step 3 : 커스텀 테마명(원본 WIZARDSTEP3 = Label(327) + Input) ---- */
        const oB3 = U4ATplWiz.makeCard(oNav, 2, oSteps);
        const oRow3 = document.createElement("div");
        oRow3.className = "u4aTdRow";

        const oCnLbl = document.createElement("label");
        oCnLbl.className = "u4aTdRow__label";
        oCnLbl.setAttribute("data-required", "true");
        oCnLbl.textContent = wsMsg("327", "Custom Theme Name");
        oRow3.appendChild(oCnLbl);

        oCustomNameField = U4AUI.createField({
            type: "text",
            clear: true,
            onInput: function () { oData.S_THEME.CUSTOM_NAME = oCustomNameField.getValue() || ""; },
            onChange: function () { oData.S_THEME.CUSTOM_NAME = oCustomNameField.getValue() || ""; }
        });
        oCustomNameField.el.classList.add("u4aTdCustomName");
        oRow3.appendChild(oCustomNameField.el);

        oB3.appendChild(oRow3);

        // 스크롤스파이 + 하단 가상여백.
        U4ATplWiz.attachSpy(oPage, document.getElementById("tdPad"));
    }

    function _buildFooter() {
        oBtnSave = document.getElementById("tdBtnSave");
        const oBtnReset = document.getElementById("tdBtnReset");
        const oBtnClose = document.getElementById("tdBtnClose");

        document.getElementById("tdBtnSaveText").textContent = wsMsg("315", "Save");    // 315(Wizard finishButtonText)
        document.getElementById("tdBtnResetText").textContent = wsMsg("328", "Reset");  // 328
        document.getElementById("tdBtnCloseText").textContent = wsMsg("056", "Close");  // 056

        oBtnSave.addEventListener("click", onSaveTheme);
        oBtnReset.addEventListener("click", onResetThemeData);
        oBtnClose.addEventListener("click", onCloseThemeEditorPopup);

        // 원본 tooltip 동일.
        oBtnSave.title = wsMsg("315", "Save");
        oBtnReset.title = wsMsg("328", "Reset");
        oBtnClose.title = wsMsg("056", "Close");
    }

    function _bindTitlebar() {
        // 로고
        const oLogo = document.getElementById("tdLogo");
        if (oLogo) {
            try { oLogo.src = encodeURI("file:///" + PATH.join(APPPATH, "img", "logo.png").replaceAll("\\", "/")); } catch (e) { }
        }
        // 제목(341)
        const oTitle = document.getElementById("tdTitle");
        if (oTitle) { oTitle.textContent = wsMsg("341", document.title || "Code Editor Theme Designer"); }

        // 닫기
        const oClose = document.getElementById("tdWinClose");
        if (oClose) { oClose.addEventListener("click", onCloseThemeEditorPopup); }

        // 최대화 토글 + 아이콘 동기.
        const oMax = document.getElementById("tdWinMax");
        if (oMax) {
            const _syncMaxIcon = function () {
                try {
                    const oI = oMax.querySelector("i");
                    if (oI) { oI.className = CURRWIN.isMaximized() ? "fa-solid fa-window-restore" : "fa-solid fa-window-maximize"; }
                } catch (e) { }
            };
            oMax.addEventListener("click", function () {
                try { if (CURRWIN.isMaximized()) { CURRWIN.unmaximize(); } else { CURRWIN.maximize(); } } catch (e) { }
            });
            try { CURRWIN.on("maximize", _syncMaxIcon); CURRWIN.on("unmaximize", _syncMaxIcon); } catch (e) { }
            _syncMaxIcon();
        }
    }

    function initUIBuild(sScopeCode) {
        U4ATplWiz.ensureStyle();

        // 초기 데이터 구성(경로 + monaco 전역 노출).
        setInitData(sScopeCode);

        // 팝업 초기 모델 바인딩 데이터 구성.
        fnInitModelBinding();

        _bindTitlebar();
        _buildLeft();
        _buildWizard();
        _buildFooter();

        // 좌|우 스플리터(공통) — 원본 SPLITTER1.
        try { U4AUI.wireSplitter(document.getElementById("tdSplit"), { axis: "x" }); }
        catch (e) { console.error("[테마디자이너] 스플리터 배선 오류:", e); }

        _renderAll();

        // 초기 언어(기본 javascript)의 샘플 코드 출력(장군님 요청). 에디터 로드 완료를 폴링 대기.
        _applyLanguageSample(oData.S_THEME.LANGUAGE);
    }

    /* ==================================================================
     * 14. 라이프사이클
     * ================================================================== */
    // opener 초기 데이터(원본 if_p13nMonacoEditor 계약) — scopeCode 가 커스텀 테마 경로를 정하므로
    //   이 데이터를 받은 뒤 UI 를 빌드한다.
    let _bInit = false;
    IPCRENDERER.on("if_p13nMonacoEditor", function (event, oOptionData) {
        if (_bInit) { return; }
        _bInit = true;
        let sScope = "";
        try { sScope = (oOptionData && oOptionData.sEditorSettings && oOptionData.sEditorSettings.scopeCode) || ""; }
        catch (e) { sScope = ""; }

        try {
            initUIBuild(sScope);
        } catch (e) {
            console.error("[테마디자이너] 초기화 오류:", e);
        }

        // SYSID 테마 변경 IPC 등록(원본 frame.js _attachIpcEvents).
        if (_THEME_CH) {
            try { IPCMAIN.on(_THEME_CH, _onThemeChange); }
            catch (e) { console.error("[테마디자이너] 테마 IPC 등록 오류:", e); }
        }

        // 준비 완료 → 창 노출(플래시 방지: opener show:false 로 열림).
        requestAnimationFrame(function () {
            try { CURRWIN.show(); } catch (e) { }
            document.body.classList.add("u4a-visible");
            fn_setBusy(false);
        });
    });

    // BroadCast Event 걸기 — 원본 frame.js 는 window load 에서 UI 빌드보다 먼저 건다(동일 순서).
    //   (js/index.js 는 body 끝에서 로드 → 이 시점에 #tdBusy 존재. DOMContentLoaded 는 이후 발화.)
    document.addEventListener("DOMContentLoaded", _attachBroadCastEvent);

    // SYSID 테마 변경 IPC 해제(원본 frame.js _detachIpcEvents — pagehide once) + 방송 채널 종료.
    window.addEventListener("pagehide", function () {
        if (_THEME_CH) { try { IPCMAIN.removeListener(_THEME_CH, _onThemeChange); } catch (e) { } }
        if (_oBroadToChild) { try { _oBroadToChild.close(); } catch (e) { } _oBroadToChild = null; }
    }, { once: true });

    // busy 중 닫기 차단(원본 window.onbeforeunload).
    window.onbeforeunload = function () {
        if (_bBusy) { return false; }
    };

})();
