/************************************************************************
 * monacoThemeDesign/index.js  (HTML5)  — Monaco 테마 디자이너 별창 opener
 * ----------------------------------------------------------------------
 *  구 UI5(sap-ui-bootstrap + Popup/frame.html + views/vw_main) 버전을 frameless HTML5
 *  별창으로 재구성. 원본 백업 = Popups/_backup_20260716_monacoThemeDesign_ui5.
 *   · 창 크롬(타이틀바/최대·닫기/blur/boot-bg)은 공통 표준(.u4a-titlebar) 소비 → Popup/index.html.
 *   · Monaco 라이브 프리뷰(monaco/)는 원본 그대로 유지(순수 Monaco, UI5 아님) — Popup/js/index.js
 *     가 원본과 동일한 전역(oAPP.views.VW_MAIN.attr.monacoVSPath/monacoLoaderPath, oAPP.WSUTIL)을
 *     노출해 monaco/ 를 무수정으로 재사용한다.
 *
 *  진입: oAPP.fn.openMonacoThemeDesigner(oPARAM) → fnDialogPopupOpener.js →
 *        parent.require(...index.js)(parent.REMOTE, oAPP, oPARAM)  (원본 계약 유지)
 ************************************************************************/

const
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey(),
    USERINFO = parent.getUserInfo();

const WSUTIL = parent.WSUTIL;

module.exports = function (REMOTE, oAPP, sEditorSettings) {

    // busy 키고 Lock 걸기 (원본 index.js 동일)
    oAPP.common.fnSetBusyLock("X");

    const CURRWIN = REMOTE.getCurrentWindow();

    // 팝업 고유 이름(중복 오픈 방지 키) — 원본 유지.
    const sPopupName = "monacoThemeDesign";

    // 기존 팝업이 열렸을 경우 새창 띄우지 말고 해당 윈도우에 포커스를 준다(원본 동일).
    const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
    if (oResult.ISOPEN) {
        try {
            const oWindow = oResult.WINDOW;
            WSUTIL.setParentCenterBounds(REMOTE, oWindow);
            // frameless 는 show:false 로 열리므로 재포커스 시 show 보장(원본 UI5 는 opacity 로 처리).
            oWindow.show();
            WSUTIL.setParentCenterBounds(REMOTE, oWindow);
        } catch (e) {
            console.error("[HTML5][테마디자이너] 기존 창 포커스 오류:", e);
        }
        // busy 끄고 Lock 풀기
        oAPP.common.fnSetBusyLock("");
        return;
    }

    // theme 정보(창 배경/타이틀바 boot-bg 플래시 방지용).
    const oThemeInfo = parent.getThemeInfo() || {};

    // Browser Options
    const
        sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));

    // 341  monaco Theme Designer (원본 동일 키)
    oBrowserOptions.title = WSUTIL.getWsMsgClsTxt(USERINFO.LANGU, "ZMSG_WS_COMMON_001", "341");
    oBrowserOptions.autoHideMenuBar = true;
    oBrowserOptions.parent = CURRWIN;
    oBrowserOptions.modal = false;                          // 원본 동일(비모달)
    oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;     // 흰색 플래시 방지(즉시 불투명)

    // 좌(프리뷰) | 우(위저드) 2분할 — 원본 SplitterLayoutData minSize 300+300 이 들어갈 최소폭 확보.
    oBrowserOptions.width = 1100;
    oBrowserOptions.height = 720;
    oBrowserOptions.minWidth = 760;
    oBrowserOptions.minHeight = 520;

    // frameless 표준 — 네이티브 프레임/닫기 제거, 공통 .u4a-titlebar 로 대체.
    //   ★ opacity(네이티브)는 쓰지 않는다 — 복원 로직이 없어 창이 안 보이는 함정(원본 opacity:0 제거).
    oBrowserOptions.frame = false;
    oBrowserOptions.show = false;
    oBrowserOptions.closable = false;                       // OS 닫기 차단 → U4AUI.closeWindow 로만 닫음.
    oBrowserOptions.minimizable = false;
    oBrowserOptions.maximizable = true;

    oBrowserOptions.webPreferences.partition = SESSKEY;
    oBrowserOptions.webPreferences.browserkey = BROWSKEY;
    oBrowserOptions.webPreferences.OBJTY = sPopupName;
    oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

    // 브라우저 오픈
    let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

    // 자식창에서 @electron/remote 사용 가능하도록 enable(프레임리스 별창 표준).
    try { parent.REMOTEMAIN.enable(oBrowserWindow.webContents); }
    catch (e) { console.error("[HTML5][테마디자이너] remote enable 오류:", e); }

    // 첫 페인트 배경(테마색) — 흰 플래시 방지.
    const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
    oBrowserWindow.webContents.insertCSS(sWebConBodyCss);
    oBrowserWindow.setMenu(null);

    // 콘텐츠 URL + 쿼리(테마/타이틀/키) — index.html 인라인 스크립트가 첫 페인트 전에 소비.
    const oQueryParams = {
        browserkey: oBrowserOptions.webPreferences.browserkey,
        sessionKey: oBrowserOptions.webPreferences.partition,
        OBJTY: sPopupName,
        USERINFO: parent.process.USERINFO,
        BGCOL: oThemeInfo.BGCOL,
        THEME: oThemeInfo.THEME,
        TITLE: oBrowserOptions.title
    };

    const sPopupPath = PATH.join(__dirname, "Popup", "index.html");
    const sLoadUrl = WSUTIL.QueryString.build(sPopupPath, oQueryParams);

    oBrowserWindow.loadURL(sLoadUrl);

    oBrowserWindow.once("ready-to-show", () => {
        try { WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow); } catch (e) { }
    });

    // 로드 완료 → 초기 데이터 push(자식이 받고 UI 빌드 + 스스로 show). 원본 if_p13nMonacoEditor 계약 유지.
    oBrowserWindow.webContents.on("did-finish-load", function () {
        try {
            oBrowserWindow.webContents.send("if_p13nMonacoEditor", {
                oThemeInfo: oThemeInfo,                  // 테마 정보
                sEditorSettings: sEditorSettings         // 호출처 파라메터(scopeCode) — 원본 동일 필드명
            });
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        } catch (e) {
            console.error("[HTML5][테마디자이너] if_p13nMonacoEditor 전송 오류:", e);
        }
        // busy 끄고 Lock 풀기 (원본 did-finish-load 동일 위치)
        oAPP.common.fnSetBusyLock("");
    });

    oBrowserWindow.on("closed", () => {
        oBrowserWindow = null;
        try { CURRWIN.focus(); } catch (e) { }
    });

    // 메인 로드 실패 시 창 정리(타이틀바 미표시 → 사용자가 못 닫는 상황 방지) + busy 해제.
    oBrowserWindow.webContents.on("did-fail-load", (event, errCode, errDesc, validatedURL, isMainFrame) => {
        if (!isMainFrame || errCode === -3) { return; }
        console.error("[HTML5][테마디자이너] 메인 로드 실패:", errCode, errDesc);
        try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } } catch (e) { }
        oAPP.common.fnSetBusyLock("");
    });

};
