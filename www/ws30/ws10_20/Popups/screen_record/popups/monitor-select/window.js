'use strict';

/**
 * @file popups/monitor-select/window.js
 * @description 모니터 선택 팝업 창을 관리합니다.
 *
 * 창 크기를 모니터 수에 맞게 동적으로 계산합니다.
 *   - 모니터 1개: 300 × 220
 *   - 모니터 2개: 560 × 280
 *   - 모니터 3개+: 800 × 300 (max)
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

const { BrowserWindow, screen } = remote;
const { getThemeInfo, injectBgCss } = require('../../core/theme');

const CARD_W    = 240;
const CARD_GAP  = 14;
const PADDING_X = 28;
const HEADER_H  = 58;
const FOOTER_H  = 60;
const CARD_H    = 190;

/**
 * 모니터 수에 맞는 창 크기를 계산합니다.
 * @param {number} count
 * @returns {{ width: number, height: number }}
 */
function calcWindowSize(count) {
  const cols  = Math.min(count, 3);
  const width = Math.min(
    PADDING_X * 2 + CARD_W * cols + CARD_GAP * (cols - 1),
    900,
  );
  const height = HEADER_H + CARD_H + FOOTER_H + 16;
  return { width, height };
}

/**
 * 모니터 선택 팝업 창을 엽니다.
 *
 * @param {Object}            [opts={}]
 * @param {string}            [opts.theme='dark']
 * @param {BrowserWindow}     [opts.parentWindow]
 * @param {string}            [opts.sessionKey]
 * @returns {Promise<{display:Electron.Display, sourceId:string, sourceName:string}|null>}
 */
async function openMonitorSelectWindow(opts = {}) {
  const {
    theme        = 'dark',
    parentWindow = null,
    sessionKey   = `mon_${Date.now()}`,
    USERINFO     = {},
    browserKey   = '',
  } = opts;

  const store = remote.require(path.join(__dirname, '../../core/store'));
  store.set(sessionKey, undefined);

  const displayCount         = screen.getAllDisplays().length;
  const { width, height }    = calcWindowSize(displayCount);

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 600,
      height: 520,
      parent         : parentWindow || undefined,
      modal          : !!parentWindow,
      show           : false,
      frame          : false,
      resizable      : true,
      minWidth       : 300,
      minHeight      : 260,
      center         : true,
      backgroundColor: getThemeInfo(theme, 'overlay').BGCOL,
      webPreferences : {
        nodeIntegration  : true,
        contextIsolation : false,
        webSecurity      : false,
        backgroundThrottling : false,
      },
    });

    // URL에 QueryString 파라미터를 적용한다.
    const sUrlPath     = PATH.join(__dirname, 'index.html');
    const oQueryParams = { OBJTY: 'SCR_REC', theme: theme, sessionKey: sessionKey, USERINFO: USERINFO, browserKey: browserKey };
    const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
    win.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));

    // ── 팝업 실행 시 배경색 CSS 주입 ────────────────────────────────────────
    win.webContents.on('did-finish-load', () => {
      injectBgCss(win, theme, 'overlay');
    });

    win.once('ready-to-show', () => win.show());

    win.on('closed', () => {
      const selected = store.get(sessionKey, null);
      store.del(sessionKey);
      resolve(selected);
    });
  });
}

module.exports = { openMonitorSelectWindow };
