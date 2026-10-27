/************************************************************************
 * monacoSnippetDesigner/index.js  (HTML5)  — Monaco 스니펫 디자이너 별창 opener
 * ----------------------------------------------------------------------
 *  구 UI5(sap-ui-bootstrap + Popup/frame.html) 버전을 frameless HTML5 별창으로 재구성.
 *   · 창 크롬(타이틀바/최대·닫기/blur/boot-bg)은 공통 표준(.u4a-titlebar) 소비 → Popup/index.html.
 *   · 스니펫 코드 에디터는 공통 Monaco 호스트(js/codeeditor) 재사용(비결합 postMessage).
 *   · 데이터/방송 계약은 불변(.analy 04 §10.4): P13N list.json+{_key} FS I/O, 저장·삭제 시
 *     IPC if-browser-interconnection / MONACO_SNIPPET_CHANGE 방송(→ 전 USP 편집기 스니펫 갱신).
 *
 *  진입: oAPP.fn.openMonacoSnippetDesigner(oPARAM) → fnDialogPopupOpener.js →
 *        parent.require(...index.js)(parent.REMOTE, oAPP, oPARAM)  (원본 계약 유지)
 ************************************************************************/

const
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey(),
    USERINFO = parent.getUserInfo();

const WSUTIL = parent.WSUTIL;

module.exports = function (REMOTE, oAPP, oPARAM) {

    let CURRWIN = REMOTE.getCurrentWindow();

    // 팝업 고유 이름(중복 오픈 방지 키) — 원본 유지.
    let sPopupName = "MONACO_SNIPPET_CREATOR";

    // [!! 전체 떠있는 브라우저 기준 !!]
    // 기존 팝업이 열렸으면 새창 대신 해당 창에 포커스 + 부모 중앙 재배치.
    let oResult = oAPP.common.getCheckAlreadyOpenWindow2(sPopupName);
    if (oResult.ISOPEN) {
        try {
            let oWindow = oResult.WINDOW;
            // Minimize 된 상태면 먼저 Restore 한다 - parent 가 없어 작업표시줄에 남아 있을 수 있다.
            try { if (oWindow.isMinimized()) { oWindow.restore(); } }
            catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
            WSUTIL.setParentCenterBounds(REMOTE, oWindow);
            oWindow.show();
            WSUTIL.setParentCenterBounds(REMOTE, oWindow);
        } catch (e) {
            console.error("[monacoSnippetDesigner] focus existing window error:", e);
        }
        return;
    }

    // theme 정보(창 배경/타이틀바 boot-bg 플래시 방지 + Monaco 빌트인 테마 매핑용).
    let oThemeInfo = parent.getThemeInfo() || {};

    // Browser Options
    const
        sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));

    oBrowserOptions.title = WSUTIL.getWsMsgClsTxt(USERINFO.LANGU, "ZMSG_WS_COMMON_001", "343"); // Code Editor Snippet Designer
    oBrowserOptions.autoHideMenuBar = true;
    // 2026-10-12 장군님 지시 (최소화 버튼 추가 + parent 제거) - parent 를 지정하지 않는다.
    //   제목줄을 직접 그리는 창에서 parent 를 두면 Minimize 뒤 Restore 할 길이 없어진다.
    //   되돌리려면 oBrowserOptions.parent = CURRWIN; 한 줄을 다시 넣으면 된다.
    //   뒤로가기 일괄 닫기·busy 중 숨기기는 browserkey 를 비교하는 getSiblingWindows 가 맡는다.
    oBrowserOptions.modal = false;             // 비모달 — 부모 계속 사용(parent 지정으로 항상 위).
    oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;   // 흰색 플래시 방지(즉시 불투명)

    oBrowserOptions.width = 1000;
    oBrowserOptions.height = 680;
    oBrowserOptions.minWidth = 720;
    oBrowserOptions.minHeight = 480;

    // frameless 표준 — 네이티브 프레임/닫기 제거, 공통 .u4a-titlebar 로 대체.
    //   ★ opacity(네이티브)는 쓰지 않는다 — 복원 로직이 없어 창이 안 보이는 함정. show:false 로만 제어.
    oBrowserOptions.frame = false;
    oBrowserOptions.show = false;
    oBrowserOptions.closable = false;          // OS 닫기 차단 → U4AUI.closeWindow 로만 닫음.
    oBrowserOptions.minimizable = false;
    oBrowserOptions.maximizable = true;        // 타이틀바 최대화 버튼 동작.

    oBrowserOptions.webPreferences.partition = SESSKEY;
    oBrowserOptions.webPreferences.browserkey = BROWSKEY;
    oBrowserOptions.webPreferences.OBJTY = sPopupName;
    oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

    // 브라우저 오픈
    let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

    // 자식창에서 @electron/remote 사용 가능하도록 enable(프레임리스 별창 표준).
    try { parent.REMOTEMAIN.enable(oBrowserWindow.webContents); } catch (e) { console.error("[monacoSnippetDesigner] remote enable error:", e); }

    // 첫 페인트 배경(테마색) — 흰 플래시 방지.
    const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;
    // 2026-10-27 Electron 45: 창을 만들자마자 넣으면 화면이 없어 깨진다 — 화면이 들어간 뒤에 넣는다.
    parent.REMOTE.getGlobal("u4aSetWindowCss")(oBrowserWindow, sWebConBodyCss);
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

    let sPopupPath = PATH.join(__dirname, "Popup", "index.html");
    const sLoadUrl = WSUTIL.QueryString.build(sPopupPath, oQueryParams);

    oBrowserWindow.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));

    // no build 시 개발자 툴(필요할 때만 수동으로 켠다).
    // if (!REMOTE.app.isPackaged) { oBrowserWindow.webContents.openDevTools(); }

    oBrowserWindow.once("ready-to-show", () => {
        try { WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    });

    // 로드 완료 → 초기 데이터 push(자식이 받고 UI 빌드 + 스스로 show).
    oBrowserWindow.webContents.on("did-finish-load", function () {
        try {
            oBrowserWindow.webContents.send("if-data", {
                oThemeInfo: oThemeInfo,               // 테마 정보(Monaco 빌트인 테마 매핑)
                scopeCode: (oPARAM && oPARAM.scopeCode) || ""   // 호출처 scope
            });
            WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow);
        } catch (e) {
            console.error("[monacoSnippetDesigner] if-data send error:", e);
        }
    });

    oBrowserWindow.on("closed", () => {
        oBrowserWindow = null;
        try { CURRWIN.focus(); } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    });

    // 메인 로드 실패 시 창 정리(타이틀바 미표시 → 사용자가 못 닫는 상황 방지).
    oBrowserWindow.webContents.on("did-fail-load", (event, errCode, errDesc, validatedURL, isMainFrame) => {
        if (!isMainFrame || errCode === -3) { return; }
        console.error("[monacoSnippetDesigner] main load failed:", errCode, errDesc);
        try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } } catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
    });

};
