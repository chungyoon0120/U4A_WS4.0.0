



// helpViewer.js
// U4A WS3.0 Help Viewer (Function Style)
// 오류코드 접두: HLPV / 다음 번호: 005

const remote = require("@electron/remote");
const { BrowserWindow, app } = remote.require("electron");
const path = require('path');
const fs = require('fs');
// [2026-10-28 장군님 지시] 창에 실린 값을 주소 쿼리에서 읽는 공통(WSUTIL.QueryString.parseWindow)을 쓴다.
const PATHINFO = require(path.join(app.getAppPath(), "ws30", "resources", "pathInfo.js"));
const WSUTIL = require(PATHINFO.WSUTIL);


/************************************************************************
 * ★ [2026-10-15, 장군님 지시] 이 창을 「호출한 창」 가운데로 옮긴다.
 ************************************************************************
 *  창을 새로 만들 때도, 이미 열려 있는 창을 다시 부를 때도 같은 함수를 쓴다.
 *  공통 setParentCenterBounds 를 안 쓰는 까닭 — 이 파일은 `www/help/` 아래라 WS 화면
 *  공통 자산을 확실히 집을 수 없다. 이미 require 한 remote 만으로 끝낸다.
 ************************************************************************/
function _centerOnOpener(oWin) {

   try {

      if (!oWin || oWin.isDestroyed()) { return; }

      const oOpener = remote.getCurrentWindow();

      if (!oOpener || oOpener.isDestroyed()) {
         if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
            U4ALOG.warn("GUARD_EXIT", "opener window", "help document window stays at the screen center");
         }
         return;
      }

      const oBase = oOpener.getBounds(),
            oSelf = oWin.getBounds(),
            oArea = remote.require("electron").screen.getDisplayMatching(oBase).workArea;

      let iX = Math.round(oBase.x + (oBase.width - oSelf.width) / 2),
          iY = Math.round(oBase.y + (oBase.height - oSelf.height) / 2);

      // 화면(작업 영역) 밖으로 나가지 않게 가둔다.
      iX = Math.min(Math.max(iX, oArea.x), oArea.x + oArea.width - oSelf.width);
      iY = Math.min(Math.max(iY, oArea.y), oArea.y + oArea.height - oSelf.height);

      oWin.setBounds({ x: iX, y: iY, width: oSelf.width, height: oSelf.height });

   } catch (e) {
      console.error("[HLPV-001] centering the help document window failed:", e && e.message, e);
      if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
   }

} // end of _centerOnOpener


/************************************************************************
 * ★ [2026-10-15, 장군님 지시] 호출한 창이 가진 browserkey 를 읽는다.
 ************************************************************************
 *  종전에는 `parent.getBrowserKey()` 로 읽으려 했으나 **늘 빈 값**이었다.
 *  아래 openHelpViewer 안의 `parent` 는 `options.parent` 를 꺼낸 지역 변수(기본값 undefined)라
 *  화면(renderer)의 전역 `parent` 를 가린다 — 부르는 쪽(main.js)도 parent 를 안 넘긴다.
 *  그래서 공통 getSiblingWindows 와 **같은 방법**으로 창 자신에게서 직접 읽는다.
 ************************************************************************/
function _getOpenerBrowserKey() {

   try {

      const oOpener = remote.getCurrentWindow();
      if (!oOpener || oOpener.isDestroyed()) { return ""; }

      return WSUTIL.QueryString.parseWindow(oOpener).browserkey || "";

   } catch (e) {
      console.error("[HLPV-002] reading browserkey of the opener window failed:", e && e.message, e);
      if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
      return "";
   }

} // end of _getOpenerBrowserKey


/************************************************************************
 * ★ [2026-10-15, 장군님 지시] 이미 열려 있는 도움말 문서 창을 찾는다.
 ************************************************************************
 *  다른 별창과 같은 방식(ws10_20/js/fnDialogPopupOpener.js 의 「이미 열린 창이 있으면
 *  새로 띄우지 말고 포커스만」 분기)이다. 찾는 열쇠도 공통과 같은 OBJTY + browserkey.
 ************************************************************************/
function _findOpenedHelpWindow(sBrowsKey) {

   try {

      if (!sBrowsKey) { return null; }

      const aAll = BrowserWindow.getAllWindows();

      for (let i = 0; i < aAll.length; i++) {

         const oWin = aAll[i];
         if (!oWin || oWin.isDestroyed()) { continue; }

         let oPref = null;
         try { oPref = WSUTIL.QueryString.parseWindow(oWin); }
         catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } continue; }

         if (!oPref || oPref.OBJTY !== "U4AHELP") { continue; }
         if (oPref.browserkey !== sBrowsKey) { continue; }

         return oWin;

      }

   } catch (e) {
      console.error("[HLPV-003] searching for the already opened help document window failed:", e && e.message, e);
      if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
   }

   return null;

} // end of _findOpenedHelpWindow


function openHelpViewer(options = {}) {

   const {
      width = 1300,
      height = 900,
      helpSiteRoot,
      parent = undefined,
   } = options;

   let helpWindow = null;

   // ★ [2026-10-15, TODO 56] 이 창을 「별창」으로 세게 할 browserkey.
   //   못 읽으면 식별값이 반쪽이 돼 **숨기기·뒤로가기 닫기에서 조용히 빠지므로** 흔적을 남긴다.
   const _sBrowsKey = _getOpenerBrowserKey();

   if (!_sBrowsKey && typeof U4ALOG !== "undefined" && U4ALOG.warn) {
      U4ALOG.warn("GUARD_EXIT", "browserkey in the opener window url",
         "help document window is left out of the sibling window list - it will not hide behind dialogs or close on back");
   }

   /************************************************************************
    * ★ [2026-10-15, 장군님 지시] 이미 열려 있으면 **새 창을 만들지 않는다.**
    ************************************************************************
    *  종전에는 누를 때마다 창을 새로 만들어, 이미 떠 있는 창은 그 자리에 그대로 있었다.
    *  다른 별창과 같이 ① 최소화돼 있으면 되살리고 ② 숨어 있으면 보이고
    *  ③ 호출한 창 가운데로 다시 놓고 ④ 포커스를 준다.
    *
    *  ★`load-finish` 를 한 번 보내 주는 까닭 — 부르는 쪽(help/u4a_helpdoc/main.js 의
    *   openHelpDocViewer)이 이 이벤트를 기다렸다가 busy 를 푸다. 창을 새로 안 만들면
    *   그 이벤트가 영영 안 와서 **busy 가 안 풀린다.**
    ************************************************************************/
   const oOpened = _findOpenedHelpWindow(_sBrowsKey);

   if (oOpened) {

      try { if (oOpened.isMinimized()) { oOpened.restore(); } }
      catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

      try { if (!oOpened.isVisible()) { oOpened.show(); } }
      catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

      _centerOnOpener(oOpened);

      try { oOpened.focus(); }
      catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }

      if (typeof U4ALOG !== "undefined" && U4ALOG.info) {
         U4ALOG.info("끝남", "U4AHELP", "already opened help document window was focused and re-centered");
      }

      setTimeout(function () {
         try { oOpened.emit("load-finish"); }
         catch (e) {
            console.error("[HLPV-004] notifying the opener that the help document window is ready failed:", e && e.message, e);
            if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
         }
      }, 0);

      return oOpened;

   }

   //Helper viewer html path
   let indexPath = path.join(__dirname, 'docMain.html');

   if (!fs.existsSync(indexPath)) {
      throw new Error("[U4A HelpViewer] index.html not found: " + indexPath);
   }

   helpWindow = new BrowserWindow({
      width,
      height,
      title: 'U4A WS3.0 Help',
      parent: parent || undefined,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      minWidth: 800,      // 최소 너비
      minHeight: 600,     // 최소 높이
      show: false,
      frame: false,          // ⭐ 기본 타이틀바 제거
      webPreferences: {
         contextIsolation: false,
         nodeIntegration: true,
         webviewTag: true,
         webSecurity: false,
         // ★ [2026-10-15, 장군님 지시 TODO 56] 별창 식별값 2개 — 이 둘이 **다 있어야** 별창으로 센다.
         //   공통 getSiblingWindows(ws30/ws10_20/js/ws_common.js)가 OBJTY 없는 창 · browserkey 가
         //   다른 창을 건너뛰므로, 종전에는 이 창이 별창 목록에서 통째로 빠져 있었다.
         //   그래서 메시지 팝업·확인창이 떠도 안 숨고 뒤로가기 일괄 닫기에도 안 잡혔다.
         OBJTY: "U4AHELP",
         browserkey: _sBrowsKey,
      }
   });

   // ★ 뜨는 자리 = 「호출한 창」 가운데. **두 번 부른다** — 만든 직후와, 보이기 직전.
   //   이 창은 `show:false` 로 만들고 **창 안(docMain.html 433)에서 `show()`** 하므로,
   //   열기가 끝난 뒤에 옮기면 이미 보인 뒤라 늦다. `ready-to-show` 는 `show()` 보다 먼저 온다.
   _centerOnOpener(helpWindow);
   helpWindow.once("ready-to-show", function () { _centerOnOpener(helpWindow); });

   const remoteMain = require('@electron/remote');
   // 2026-10-27 Electron 45: remote.require 는 npm 모듈을 못 찾는다 — 앱 본체 require 로 부른다.
   remoteMain.getGlobal("mainRequire")('@electron/remote/main').enable(helpWindow.webContents);

   // if(!app.isPackaged){
   //    helpWindow.webContents.openDevTools({ mode: 'detach' });
   // }


   const _options = {
            ...options, 
            isdev: !app.isPackaged,
   };
   //    helpSiteRoot      //도큐멘트 mkdosc 빌드 root 폴더 경로
   //    version = '',     // 문서 버전 번호
   //    theme = 'dark',   // "dark" : "light",
   //    startMenuId = '', // 초기 보여줄 메뉴 ID
   //    languages:"en", //ko, en

   // 2026-10-27 Electron 45: loadFile 을 쓰지 않는다. custom protocol 주소로 바꿔 loadURL 로 연다.
   helpWindow.loadURL(
      remote.getGlobal("u4aToAppUrl")(
         toFilePath(indexPath),
         {
            query: {
               options: encodeURIComponent(JSON.stringify(_options)),
               // [2026-10-28 장군님 지시] 창을 찾는 두 값을 주소에도 싣는다 —
               //   Electron 45 에서 webPreferences 는 되읽을 수 없다.
               OBJTY: "U4AHELP",
               browserkey: _sBrowsKey
            }
         }
      )
   );


   helpWindow.on('closed', () => {
      helpWindow = null;

      if(!app.isPackaged){
         remote.getCurrentWindow().close();
      }

   });

   return helpWindow;
}


function toFilePath(filePath) {
  // file:// 제거
  let cleanPath = filePath.replace(/^file:[\/\\]+/i, '');
  // 백슬래시 → 슬래시
  cleanPath = cleanPath.replace(/\\/g, '/');
  // Windows 드라이브 문자 앞 슬래시 제거 (예: /D:/... → D:/...)
  cleanPath = cleanPath.replace(/^\/([a-zA-Z]:)/, '$1');
  return cleanPath;

}

// function resolveSitePath(sitePath) {

//    if (sitePath) {
//       return path.resolve(sitePath);
//    }

//    // 1️⃣ 실행 위치 기준
//    const runtimePath = path.join(process.cwd(), 'site');
//    if (fs.existsSync(runtimePath)) {
//       return runtimePath;
//    }

//    // 2️⃣ 패키징된 Electron 기준
//    const appPath = path.join(app.getAppPath(), 'site');
//    if (fs.existsSync(appPath)) {
//       return appPath;
//    }

//    throw new Error('[U4A HelpViewer] site folder not found.');
// }

module.exports = openHelpViewer;