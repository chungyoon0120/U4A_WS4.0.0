/************************************************************************
 * dataMonitor/index.js  (HTML5) — 내부 데이터 모니터 별창 opener
 * ----------------------------------------------------------------------
 *  테스트 메뉴 > 데이터 모니터. 화면을 조작할 때마다 내부 오브젝트에서 무엇이
 *  바뀌었는지 보여주는 개발자 전용 창(관리자 전용 메뉴 안에 있음).
 *
 *  창 만드는 방식은 별도 창 표준(.analy/16 §2.6 · §2.6.1)과 기존 별창
 *  (monacoThemeDesign)을 그대로 따른다 — 흰 번쩍 방지, 네이티브 닫기 차단,
 *  공통 타이틀바.
 *
 *  진입: oAPP.fn.fnDataMonitorOpen() → js/ws_html5_datamon.js →
 *        parent.require(...index.js)(parent.REMOTE, oAPP)
 *
 *  부모와 주고받기: BroadcastChannel "u4a-datamon_<브라우저키>" 하나로 양방향
 *        (기존 별창들이 쓰는 방식과 동일 — Popups/bindPopup/frame.js:431 참고)
 *
 *  오류코드 접두: DMOP / 다음 번호: 004
 ************************************************************************/

const
    PATH = require("path"),
    SESSKEY = parent.getSessionKey(),
    BROWSKEY = parent.getBrowserKey();

const WSUTIL = parent.WSUTIL;

module.exports = function (REMOTE, oAPP) {

    //창을 여는 동안 조작을 막는다(공통 busy).
    oAPP.common.fnSetBusyLock("X");

    const CURRWIN = REMOTE.getCurrentWindow();

    //중복 오픈 방지 키.
    const sPopupName = "dataMonitor";

    //이미 열려 있으면 새로 만들지 말고 그 창에 포커스만 준다.
    const oResult = WSUTIL.getCheckAlreadyOpenWindow(sPopupName);
    if (oResult.ISOPEN) {
        try {
            const oWindow = oResult.WINDOW;
            WSUTIL.setParentCenterBounds(REMOTE, oWindow);
            oWindow.show();
        } catch (e) {
            console.error("[DMOP-001] focus on the open data monitor window failed:", e);
        }
        oAPP.common.fnSetBusyLock("");
        return;
    }

    //테마 정보 — 창이 뜰 때 흰 번쩍이 안 나도록 처음부터 테마색으로 칠한다.
    const oThemeInfo = parent.getThemeInfo() || {};

    const
        sSettingsJsonPath = parent.getPath("BROWSERSETTINGS"),
        oDefaultOption = parent.require(sSettingsJsonPath),
        oBrowserOptions = JSON.parse(JSON.stringify(oDefaultOption.browserWindow));

    oBrowserOptions.title = "데이터 모니터";
    oBrowserOptions.autoHideMenuBar = true;
    oBrowserOptions.parent = CURRWIN;
    oBrowserOptions.modal = false;                       //조작하면서 봐야 하므로 비모달.
    oBrowserOptions.backgroundColor = oThemeInfo.BGCOL;  //흰 번쩍 방지.

    oBrowserOptions.width = 900;
    oBrowserOptions.height = 680;
    oBrowserOptions.minWidth = 520;
    oBrowserOptions.minHeight = 360;

    //창틀 없는 표준 — 네이티브 프레임/닫기 제거, 공통 타이틀바로 대체.
    oBrowserOptions.frame = false;
    oBrowserOptions.show = false;
    oBrowserOptions.closable = false;                    //OS 닫기 차단 → 공통 닫기로만.
    oBrowserOptions.minimizable = false;
    oBrowserOptions.maximizable = true;

    oBrowserOptions.webPreferences.partition = SESSKEY;
    oBrowserOptions.webPreferences.browserkey = BROWSKEY;
    oBrowserOptions.webPreferences.OBJTY = sPopupName;
    oBrowserOptions.webPreferences.USERINFO = parent.process.USERINFO;

    let oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);

    //자식창에서 창 조작(최대화·닫기)을 하려면 필요하다.
    try { parent.REMOTEMAIN.enable(oBrowserWindow.webContents); }
    catch (e) { console.error("[DMOP-002] enabling remote for the child window failed:", e); }

    //첫 페인트 배경 — 흰 번쩍 방지.
    try {
        oBrowserWindow.webContents.insertCSS(
            "html, body { margin: 0px; height: 100%; background-color: " + oThemeInfo.BGCOL + "; }");
    } catch (e) { console.error("[DMOP-003] first-paint background set failed:", e); }

    oBrowserWindow.setMenu(null);

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
    oBrowserWindow.loadURL(WSUTIL.QueryString.build(sPopupPath, oQueryParams));

    oBrowserWindow.once("ready-to-show", () => {
        try { WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow); }
        catch (e) { console.error("[DMOP-001] window position set failed:", e); }
    });

    //화면이 다 뜬 뒤에 잠금 해제(WP1 — 준비가 끝난 다음에 푼다).
    oBrowserWindow.webContents.on("did-finish-load", function () {
        try { WSUTIL.setParentCenterBounds(REMOTE, oBrowserWindow); }
        catch (e) { console.error("[DMOP-001] window position set failed:", e); }
        oAPP.common.fnSetBusyLock("");
    });

    oBrowserWindow.on("closed", () => {
        oBrowserWindow = null;
        try { CURRWIN.focus(); }
        catch (e) { console.error("[DMOP-001] parent window focus failed:", e); }
    });

    //메인 로드 실패 — 타이틀바가 안 떠 사용자가 못 닫는 상황을 막고 잠금도 푼다.
    oBrowserWindow.webContents.on("did-fail-load", (event, errCode, errDesc, validatedURL, isMainFrame) => {
        if (!isMainFrame || errCode === -3) { return; }
        console.error("[DMOP-002] data monitor screen load failed:", errCode, errDesc);
        try { if (oBrowserWindow && !oBrowserWindow.isDestroyed()) { oBrowserWindow.destroy(); } }
        catch (e) { console.error("[DMOP-002] cleanup of the failed window failed:", e); }
        oAPP.common.fnSetBusyLock("");
    });

};
