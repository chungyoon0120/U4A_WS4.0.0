'use strict';

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);


/**
 * @file popups/drawing/window.js
 *
 * 크로스 프로세스 싱글턴 — store 에 창 ID 저장 방식 사용.
 *
 * ── globalShortcut 없음 ───────────────────────────────────────────────────────
 * F8/F9 등 녹화 관련 전역 단축키는 control-panel/window.js 에서 관리합니다.
 * 컨트롤 패널이 살아있는 동안 항상 동작해야 하므로, 드로잉 창 생명주기와 무관하게
 * 패널 레벨에서 등록·해제합니다.
 */

const path   = require('path');
const remote = require('@electron/remote');

const { BrowserWindow } = remote;

const STORE_ID_KEY = '__drawing_win_id__';

/** @param {object} store */
function _getWin(store) {
  const id = store.get(STORE_ID_KEY, null);
  if (!id) return null;
  const win = BrowserWindow.fromId(id);
  if (!win || win.isDestroyed()) { store.del(STORE_ID_KEY); return null; }
  return win;
}

/**
 * 드로잉 오버레이 창을 엽니다.
 *
 * @param {object} params
 * @param {object} params.display    - Electron Display 객체 (bounds 포함)
 * @param {string} params.sessionKey - 세션 키
 * @param {string} [params.theme]    - 'dark' | 'light'
 * @returns {BrowserWindow}
 */
function openDrawingWindow(params = {}) {
  const { display, sessionKey, theme = 'dark', USERINFO = {}, browserKey = '' } = params;
  const store = remote.require(path.join(__dirname, '../../core/store'));

  // 이미 열려 있으면 그대로 반환
  const existing = _getWin(store);
  if (existing) return existing;

  const { bounds } = display;

  const win = new BrowserWindow({
    x              : bounds.x,
    y              : bounds.y,
    width          : bounds.width,
    height         : bounds.height,
    frame          : false,
    transparent    : true,
    skipTaskbar    : true,
    resizable      : false,
    movable        : false,
    focusable      : false,
                             // Electron 14 에서 뒤에 있는 앱에 활성화 이벤트가 전달되어
                             // 다른 객체가 선택되는 버그가 발생합니다.
                             // 마우스 이벤트(드로잉)와 포커스는 별개입니다:
                             // setIgnoreMouseEvents(false) 로 마우스 수신은 보장됩니다.
    backgroundColor: '#00000000',
    webPreferences : {
      nodeIntegration  : true,
      contextIsolation : false,
      webSecurity      : false,
    },
  });

  // 드로잉 창은 컨트롤 패널(screen-saver)보다 낮은 레벨로 설정
  win.setAlwaysOnTop(true, 'pop-up-menu');

  // store 에 창 ID / webContents ID 저장
  store.set(STORE_ID_KEY,                win.id);
  store.set('__drawing_wc_id__',         win.webContents.id);
  store.set('__drawing_win_id_compat__', win.id); // 하위 호환

  // URL에 QueryString 파라미터를 적용한다.
  const sUrlPath     = PATH.join(__dirname, 'index.html');
  const oQueryParams = { theme: theme, sessionKey: sessionKey, USERINFO: USERINFO, browserKey: browserKey };
  const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
  win.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));

  // ── 배경색 CSS 주입 생략 ───────────────────────────────────────────────────
  // drawing 은 transparent: true / backgroundColor: '#00000000' 창입니다.
  // injectBgCss() 로 배경색을 주입하면 투명도가 깨지므로 주입하지 않습니다.

  // Electron 14 호환: transparent 창은 alpha=0 영역의 마우스 이벤트가
  // OS hit-test에서 통과되는 경우가 있으므로 ignore 상태를 명시적으로 해제합니다.
  // ready-to-show가 지연/누락되는 환경도 있어 즉시 1회, 로드 후 1회 재적용합니다.
  win.setIgnoreMouseEvents(false);
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    // ── DPI 환산 재적용 (모니터별 다른 배율 대응) ─────────────────────────────
    // 생성자 width/height 는 창이 처음 뜨는 모니터(주 모니터)의 scaleFactor 로
    // 환산되어, 배율이 다른 대상 모니터로 이동 시 물리 크기/위치가 어긋납니다.
    // setBounds 는 사각형이 놓이는 대상 디스플레이의 scaleFactor 로 정확히
    // 환산하므로, 여기서 한 번 더 명시 적용하여 모니터 전체를 덮도록 보정합니다.
    // (캔버스는 렌더러의 window 'resize' 핸들러가 자동으로 재적합합니다.)
    win.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
    win.setIgnoreMouseEvents(false);
  });

  // 드로잉 창 생성 직후 패널/인디케이터 Z-Order 재선언
  if (sessionKey) {
    const panelId = store.get(`${sessionKey}_panelWinId`, null);
    if (panelId) {
      const pw = BrowserWindow.fromId(panelId);
      if (pw && !pw.isDestroyed()) {
        pw.focus(); // 드로잉 창 생성 후 패널에 포커스 반환
      }
    }
    const indId = store.get(`${sessionKey}_indicatorWinId`, null);
    if (indId) { const iw = BrowserWindow.fromId(indId); if (iw && !iw.isDestroyed()) iw.moveTop(); }
  }

  win.on('closed', () => {
    store.del(STORE_ID_KEY);
    store.del('__drawing_wc_id__');
  });

  return win;
}

/**
 * 드로잉 창을 강제로 닫습니다. (어느 프로세스에서든 호출 가능)
 */
function closeDrawingWindow() {
  const store = remote.require(path.join(__dirname, '../../core/store'));
  const win   = _getWin(store);
  if (!win) return;
  store.del(STORE_ID_KEY);
  win.close();
}

/**
 * 드로잉 창이 현재 열려 있는지 반환합니다.
 */
function isDrawingOpen() {
  const store = remote.require(path.join(__dirname, '../../core/store'));
  return _getWin(store) !== null;
}

module.exports = { openDrawingWindow, closeDrawingWindow, isDrawingOpen };
