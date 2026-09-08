'use strict';

/**
 * @file popups/settings/window.js
 *
 * 크로스 프로세스 싱글턴 — store 에 창 ID 저장 방식 사용.
 * (모듈 레벨 _win 은 렌더러마다 독립적이므로 사용하지 않음)
 */

'use strict';

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);


const path   = require('path');
const remote = require('@electron/remote');

const { BrowserWindow } = remote;
const { getThemeInfo, injectBgCss } = require('../../core/theme');

const SETTINGS_W   = 400;
const SETTINGS_H   = 480;
const STORE_ID_KEY = '__settings_win_id__';

function _getWin(store) {
  const id = store.get(STORE_ID_KEY, null);
  if (!id) return null;
  const win = BrowserWindow.fromId(id);
  if (!win || win.isDestroyed()) { store.del(STORE_ID_KEY); return null; }
  return win;
}

function _alignToParent(win, parentWin) {
  if (!parentWin || parentWin.isDestroyed()) { win.center(); return; }
  try {
    const { screen } = remote;
    const pb = parentWin.getBounds();
    const wb = win.getBounds();
    const da = screen.getDisplayNearestPoint({ x: pb.x, y: pb.y }).workArea;
    let x = pb.x + pb.width + 10;
    let y = pb.y;
    if (x + wb.width > da.x + da.width) x = pb.x - wb.width - 10;
    if (x < da.x) x = da.x + Math.round((da.width - wb.width) / 2);
    y = Math.max(da.y, Math.min(pb.y, da.y + da.height - wb.height));
    win.setPosition(x, y, false);
  } catch { win.center(); }
}

async function openSettingsWindow(opts = {}) {
  const { sessionKey = '', theme = 'dark', parentWin = null, USERINFO = {}, browserKey = '' } = opts;
  const store = remote.require(path.join(__dirname, '../../core/store'));

  const existing = _getWin(store);
  if (existing) {
    _alignToParent(existing, parentWin);
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width          : SETTINGS_W,
      height         : SETTINGS_H,
      show           : false,
      frame          : false,
      resizable      : true,
      backgroundColor: getThemeInfo(theme, 'panel').BGCOL,
      webPreferences : {
        nodeIntegration  : true,
        contextIsolation : false,
        webSecurity      : false,
        backgroundThrottling : false,
      },
    });

    store.set(STORE_ID_KEY, win.id);

    // URL에 QueryString 파라미터를 적용한다.
    const sUrlPath     = PATH.join(__dirname, 'index.html');
    const oQueryParams = { theme: theme, sessionKey: sessionKey, USERINFO: USERINFO, browserKey: browserKey };
    const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
    win.loadURL(sLoadUrl);

    // ── 팝업 실행 시 배경색 CSS 주입 ────────────────────────────────────────
    win.webContents.on('did-finish-load', () => {
      injectBgCss(win, theme, 'panel');
    });

    win.once('ready-to-show', () => {
      _alignToParent(win, parentWin);
      win.show();
    });

    win.on('closed', () => {
      store.del(STORE_ID_KEY);
      resolve();
    });
  });
}

function closeSettingsWindow() {
  const store = remote.require(path.join(__dirname, '../../core/store'));
  const win   = _getWin(store);
  if (win) { store.del(STORE_ID_KEY); win.close(); }
}

function isSettingsOpen() {
  const store = remote.require(path.join(__dirname, '../../core/store'));
  return _getWin(store) !== null;
}

module.exports = { openSettingsWindow, closeSettingsWindow, isSettingsOpen };
