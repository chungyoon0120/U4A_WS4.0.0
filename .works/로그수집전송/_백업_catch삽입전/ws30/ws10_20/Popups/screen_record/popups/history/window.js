'use strict';

/**
 * @file popups/history/window.js
 *
 * 크로스 프로세스 싱글턴 + 테마 실시간 연동 설계
 * ────────────────────────────────────────────────
 * - 창 ID를 store 에 저장 → 어느 프로세스에서든 닫기 가능
 * - panelSessionKey 를 query 로 전달 → history/index.js 가
 *   control-panel 과 동일한 themePreview 키를 폴링하여 실시간 테마 반영
 * - 창 열 때 settingsStore 에서 현재 저장된 테마를 읽어 초기 테마로 사용
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

const HISTORY_W    = 860;
const HISTORY_H    = 580;
const STORE_ID_KEY = '__history_win_id__';

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
    const pb  = parentWin.getBounds();
    const wb  = win.getBounds();
    const da  = screen.getDisplayNearestPoint({ x: pb.x, y: pb.y }).workArea;
    let x = pb.x + pb.width + 10;
    let y = pb.y;
    if (x + wb.width > da.x + da.width) x = pb.x - wb.width - 10;
    if (x < da.x) x = da.x + Math.round((da.width - wb.width) / 2);
    y = Math.max(da.y, Math.min(pb.y, da.y + da.height - wb.height));
    win.setPosition(x, y, false);
  } catch { win.center(); }
}

/**
 * 히스토리 팝업을 엽니다.
 *
 * @param {Object}            opts
 * @param {string}            opts.outputDir
 * @param {string}           [opts.newFilePath='']
 * @param {string}           [opts.theme='dark']          - 초기 테마 힌트 (settingsStore 우선)
 * @param {BrowserWindow}    [opts.parentWin=null]
 * @param {string}           [opts.panelSessionKey='']    - 컨트롤 패널 세션 키 (themePreview 폴링용)
 * @returns {Promise<void>}
 */
async function openHistoryWindow(opts = {}) {
  const {
    outputDir,
    newFilePath     = '',
    theme           = 'dark',
    parentWin       = null,
    panelSessionKey = '',
    USERINFO        = {},
    browserKey      = '',
  } = opts;

  const store         = remote.require(path.join(__dirname, '../../core/store'));
  const settingsStore = require(path.join(__dirname, '../../core/settings-store'));
  settingsStore.init(remote.app.getPath('userData'));

  const effectTheme = theme;

  // 이미 열려 있으면 이동 + 포커스
  const existing = _getWin(store);
  if (existing) {
    _alignToParent(existing, parentWin);
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }

  const sessionKey = `hist_${Date.now()}`;
  store.set(`${sessionKey}_outputDir`,   outputDir);
  store.set(`${sessionKey}_newFilePath`, newFilePath);

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width          : HISTORY_W,
      height         : HISTORY_H,
      show           : false,
      frame          : false,
      resizable      : true,
      minWidth       : 560,
      minHeight      : 400,
      backgroundColor: getThemeInfo(effectTheme, 'overlay').BGCOL,
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
    const oQueryParams = { theme: effectTheme, sessionKey: sessionKey, panelSessionKey: panelSessionKey, USERINFO: USERINFO, browserKey: browserKey };
    const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
    win.loadURL(sLoadUrl);

    // ── 팝업 실행 시 배경색 CSS 주입 ────────────────────────────────────────
    win.webContents.on('did-finish-load', () => {
      injectBgCss(win, effectTheme, 'overlay');
    });

    win.once('ready-to-show', () => {
      _alignToParent(win, parentWin);
      win.show();
    });

    win.on('closed', () => {
      store.del(STORE_ID_KEY);
      store.delByPrefix(sessionKey);
      resolve();
    });
  });
}

function forceCloseAllHistory() {
  const store = remote.require(path.join(__dirname, '../../core/store'));
  const win   = _getWin(store);
  if (win) { store.del(STORE_ID_KEY); win.close(); }
}

module.exports = { openHistoryWindow, forceCloseAllHistory };
