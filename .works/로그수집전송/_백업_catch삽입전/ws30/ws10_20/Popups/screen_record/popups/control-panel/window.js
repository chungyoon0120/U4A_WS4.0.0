/**
 * @file windows/control-panel-window.js
 * @description 녹화 전체 플로우를 총괄합니다.
 *
 *  Flow
 *  ────
 *  1. 파일명을 타임스탬프로 자동 생성
 *  2. 모니터가 2개 이상이면 선택 팝업 표시
 *  3. 선택한 모니터 상단에 인디케이터 창 생성
 *  4. 컨트롤 패널 창 생성
 *  5. 녹화 완료 시 히스토리 팝업 표시 후 Promise resolve
 *
 *  close() 지원
 *  ────────────
 *  - open() 호출 시 세션을 _sessions Map에 등록
 *  - forceCloseAll() 호출 시 진행 중인 모든 세션을 강제 종료
 */

'use strict';

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL),
    IPCRENDERER = require('electron').ipcRenderer;


const path   = require('path');
const remote = require('@electron/remote');

const { BrowserWindow, screen, app } = remote;
const { openMonitorSelectWindow }      = require('../monitor-select/window');
const { createIndicatorWindow }        = require('../indicator/window');
const { openHistoryWindow, forceCloseAllHistory }   = require('../history/window');
const { closeSettingsWindow }                        = require('../settings/window');
const { closeDrawingWindow }                         = require('../drawing/window');
const settingsStore = remote.require(path.join(__dirname, '../../core/settings-store'));
const { getThemeInfo, injectBgCss } = require('../../core/theme');

const PANEL_W = 360;
const PANEL_H = 480;

// 설정·히스토리 창 ID 저장 키 (각 window.js 의 STORE_ID_KEY 와 동기화)
const STORE_KEY_SETTINGS = '__settings_win_id__';
const STORE_KEY_HISTORY  = '__history_win_id__';

/**
 * 현재 활성 세션 레지스트리.
 * key   : sessionKey (string)
 * value : { panelWin, indicatorWin, settle }
 *
 * @type {Map<string, {panelWin: BrowserWindow, indicatorWin: BrowserWindow, settle: Function}>}
 */
const _sessions = new Map();

/**
 * 현재 시각 기반으로 파일명을 자동 생성합니다.
 * @returns {string} 예: recording_20250503_143022.webm
 */
function generateFileName() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `recording_${date}_${time}.webm`;
}

/**
 * 현재 진행 중인 모든 녹화 세션을 강제 종료합니다.
 * screenRecord.close() 에서 호출됩니다.
 *
 * - 녹화 중이든 대기 중이든 관계없이 패널·인디케이터 창을 닫고
 *   각 세션의 Promise를 null로 resolve합니다.
 * - 히스토리 창도 함께 닫습니다.
 */
function forceCloseAll() {
  // 세션 복사 후 순회 (settle 내부에서 _sessions.delete 가 호출되므로)
  const sessions = [..._sessions.values()];
  sessions.forEach(({ settle }) => settle(null, true));

  // 열려 있는 히스토리 창도 모두 닫기
  forceCloseAllHistory();
}

/**
 * 화면 녹화 컨트롤 패널을 엽니다.
 *
 * ── 창 생명주기 요약 ─────────────────────────────────────────────────────────
 *  요구사항 1: 모니터 2개 이상 → 모니터 선택 팝업을 부모 창의 모달로 표시
 *  요구사항 2: 모니터 선택 완료 → 녹화 컨트롤 팝업 표시
 *  요구사항 3: 녹화 컨트롤 종료 → 설정/히스토리 팝업 자동 종료 (settle 내부)
 *  요구사항 4: 메인 브라우저(부모 창) 종료 → 녹화 컨트롤 자동 종료
 *             parentWin 미전달 시 remote.getCurrentWindow() 로 자동 감지
 *  요구사항 5: 녹화 컨트롤 종료 → 인디케이터/드로잉 팝업 자동 종료 (settle 내부)
 *
 * @param {Object}             [opts={}]
 * @param {string}             [opts.outputDir]      - 저장 디렉터리 (기본값: 시스템 Videos 폴더)
 * @param {string}             [opts.theme='dark']   - 'dark' | 'light'
 * @param {BrowserWindow|null} [opts.parentWin]      - 부모 창.
 *   · 전달하면 해당 창이 닫힐 때 모든 녹화 관련 팝업이 함께 종료됩니다.
 *   · 전달하지 않으면 remote.getCurrentWindow() 로 자동 감지합니다.
 *   · null 을 명시적으로 전달하면 부모-자식 연결을 비활성화합니다.
 * @param {Object}             [opts.recordOptions]  - 추가 녹화 옵션
 * @param {number}             [opts.recordOptions.frameRate=30]
 * @param {number}             [opts.recordOptions.videoBitsPerSecond=2500000]
 * @param {number}             [opts.recordOptions.timeslice=1000]
 *
 * @returns {Promise<RecordingResult|null>}
 */
async function open(opts = {}) {
  // ── 싱글턴 가드: 이미 실행 중이면 기존 창을 포커스하고 메시지 표시 ──────────
  if (_sessions.size > 0) {
    const existing = [..._sessions.values()][0];
    if (existing.panelWin && !existing.panelWin.isDestroyed()) {
      existing.panelWin.focus();
    }
    remote.dialog.showMessageBox({
      type   : 'info',
      title  : '화면 녹화',
      message: '이미 녹화가 진행 중입니다.',
      detail : '현재 실행 중인 녹화를 먼저 종료해 주세요.',
      buttons: ['확인'],
    });
    return null;
  }

  // 영구 설정 로드 — opts로 받은 값이 없으면 저장된 설정을 기본값으로 사용
  // ※ opts 구조 분해보다 반드시 먼저 선언해야 TDZ 오류가 발생하지 않습니다.
  settingsStore.init(app.getPath('userData'));

  // 설정 파일이 없으면 전달받은 파라미터를 포함해 초기 설정으로 저장합니다.
  // 이후 모든 팝업이 load() 로 일관되게 동일한 값을 읽을 수 있습니다.
  if (!settingsStore.hasSettings()) {
    settingsStore.save({
      ...settingsStore.DEFAULTS,
      ...(opts.theme     ? { theme     : opts.theme     } : {}),
      ...(opts.outputDir ? { outputDir : opts.outputDir } : {}),
    });
  }

  const saved = settingsStore.load();

  const resolvedTheme = saved.theme || 'dark';
  const {
    outputDir     = saved.outputDir || app.getPath('videos'),
    recordOptions = {},
    USERINFO      = {},
    browserKey    = '',
  } = opts;
  const theme = resolvedTheme;

  // ── parentWin 결정 ──────────────────────────────────────────────────────
  let parentWin;
  if (Object.prototype.hasOwnProperty.call(opts, 'parentWin')) {
    parentWin = opts.parentWin;
  } else {
    try { parentWin = remote.getCurrentWindow() || null; }
    catch { parentWin = null; }
  }

  // 부모 창이 닫힐 때 녹화 관련 팝업 전체 종료
  // open() 은 부모 렌더러에서 호출되므로 window 가 곧 부모 창입니다.
  window.addEventListener('pagehide', () => forceCloseAll(), { once: true });

  // recordOptions도 영구 설정값을 기본으로 병합
  const mergedRecordOptions = {
    frameRate          : saved.frameRate,
    videoBitsPerSecond : saved.videoBitsPerSecond,
    videoFormat        : saved.videoFormat,
    ...recordOptions,
  };

  const fileName   = generateFileName();
  const store      = remote.require(path.join(__dirname, '../../core/store'));
  const sessionKey = `vrec_${Date.now()}`;
  const displays   = screen.getAllDisplays();

  // ── Step 1: 모니터 선택 ─────────────────────────
  let selectedDisplay;
  let selectedSourceId;

  if (displays.length === 1) {
    selectedDisplay  = displays[0];
    const sources    = await remote.desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });
    selectedSourceId = sources[0]?.id || null;
  } else {
    const monSelKey = `${sessionKey}_monsel`;
    const selection = await openMonitorSelectWindow({
      theme,
      parentWindow : remote.getCurrentWindow(),
      sessionKey   : monSelKey,
      USERINFO     : USERINFO,
      browserKey   : browserKey,
    });
    if (!selection) return null;

    selectedDisplay  = selection.display;
    selectedSourceId = selection.sourceId;
  }

  if (!selectedSourceId) throw new Error('[screen_record] 화면 소스를 찾을 수 없습니다.');

  // 모니터 번호 계산 (1-based, 주 모니터 기준 정렬)
  const primaryId      = screen.getPrimaryDisplay().id;
  const sortedDisplays = [...displays].sort((a, b) => {
    if (a.id === primaryId) return -1;
    if (b.id === primaryId) return 1;
    return a.bounds.x - b.bounds.x;
  });
  const monitorIndex = sortedDisplays.findIndex(d => d.id === selectedDisplay.id) + 1;

  // ── Step 2: store 세션 초기화 ───────────────────
  store.set(`${sessionKey}_config`,          { outputDir, fileName, theme, display: selectedDisplay, sourceId: selectedSourceId, recordOptions: mergedRecordOptions, monitorIndex });
  store.set(`${sessionKey}_status`,          'idle');
  store.set(`${sessionKey}_startTime`,       null);
  store.set(`${sessionKey}_pausedMs`,        0);
  store.set(`${sessionKey}_elapsedSnapshot`, null);
  store.set(`${sessionKey}_result`,          undefined);

  // ── Step 3: 인디케이터 창 생성 ──────────────────
  const indicatorWin = createIndicatorWindow({ display: selectedDisplay, sessionKey, theme, monitorIndex, USERINFO: USERINFO, browserKey: browserKey });


  function _setBusy(bIsBusy){
    if(bIsBusy === true){        
      IPCRENDERER.send(`if-send-action-${browserKey}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "X" }); 
      IPCRENDERER.send(`if-send-action-${browserKey}`, { ACTCD: "BROAD_BUSY", PRCCD: "BUSY_ON" });  
      return;
    }    
    IPCRENDERER.send(`if-send-action-${browserKey}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });
    IPCRENDERER.send(`if-send-action-${browserKey}`, { ACTCD: "BROAD_BUSY", PRCCD: "BUSY_OFF" });  
  }

  // ── Step 4: 컨트롤 패널 창 생성 ─────────────────
  return new Promise((resolve) => {
    let _settled = false;

    /**
     * 세션을 정리하고 Promise를 resolve합니다.
     *
     * @param {RecordingResult|null} result
     * @param {boolean} [forced=false] - forceCloseAll() 에 의한 강제 종료 여부.
     *   true 이면 히스토리 팝업을 표시하지 않습니다.
     */
    const settle = async (result, forced = false) => {
      if (_settled) return;
      _settled = true;

      // IPC 리스너 정리 (settle이 먼저 호출된 경우 중복 발화 방지)
      remote.ipcMain.removeListener(`rec-done-${sessionKey}`, _onRecDone);

      _sessions.delete(sessionKey);

      if (!indicatorWin.isDestroyed()) indicatorWin.close();
      if (!panelWin.isDestroyed())     panelWin.close();

      store.delByPrefix(sessionKey);

      // 패널이 닫힐 때 항상 관련 팝업 전체 닫기
      // (녹화 히스토리, 설정, 드로잉)
      forceCloseAllHistory();
      try { closeSettingsWindow(); } catch {}
      try { closeDrawingWindow();  } catch {}

      // 정상 완료(녹화 완료) 시에만 히스토리 다시 열기
      if (result && !forced) {
        await openHistoryWindow({
          outputDir      : outputDir,
          newFilePath    : result.filePath,
          theme,
          parentWin,
          panelSessionKey: sessionKey,
          USERINFO       : USERINFO,
          browserKey     : browserKey,
        });
      }

      resolve(result);
    };

    const { bounds } = selectedDisplay;

    const panelWin = new BrowserWindow({
      x              : bounds.x + Math.round((bounds.width  - PANEL_W) / 2),
      y              : bounds.y + Math.round((bounds.height - PANEL_H) / 2),
      width          : PANEL_W,
      height         : PANEL_H,
      show           : false,   // ready-to-show 이후 표시 — 흰 화면 깜빡임 방지
      frame          : false,
      skipTaskbar    : false,
      resizable      : true,
      minWidth       : 320,
      minHeight      : 400,
      backgroundColor: getThemeInfo(theme, 'panel').BGCOL,
      webPreferences : {
        nodeIntegration       : true,
        contextIsolation      : false,
        webSecurity           : false,
        backgroundThrottling  : false,
      },
    });

    // 세션 레지스트리에 등록
    _sessions.set(sessionKey, { panelWin, indicatorWin, settle });

    // alwaysOnTop 은 옵션 대신 메소드로 설정 (Electron 옵션 버그 우회)
    panelWin.setAlwaysOnTop(true, 'screen-saver');

    // ── Store: 창 ID 저장 ────────────────────────────────────────────────────
    store.set(`${sessionKey}_indicatorWinId`,  indicatorWin.id);
    store.set(`${sessionKey}_panelWinId`,      panelWin.id);
    store.set(`${sessionKey}_indicatorWcId`,   indicatorWin.webContents.id);
    store.set(`${sessionKey}_panelWcId`,       panelWin.webContents.id);

    // URL에 QueryString 파라미터를 적용한다.
    const sUrlPath_panel     = PATH.join(__dirname, 'index.html');
    const oQueryParams_panel = { OBJTY: 'SCR_REC', theme: theme, sessionKey: sessionKey, USERINFO: USERINFO, browserKey: browserKey };
    const sLoadUrl_panel     = WSUTIL.QueryString.build(sUrlPath_panel, oQueryParams_panel);
    panelWin.loadURL(sLoadUrl_panel);

    // ── 팝업 실행 시 배경색 CSS 주입 ────────────────────────────────────────
    // did-finish-load: 페이지가 완전히 로드된 직후 실행됩니다.
    // indicator / drawing 은 transparent 창이므로 주입하지 않습니다.
    panelWin.webContents.on('did-finish-load', () => {
      injectBgCss(panelWin, theme, 'panel');
    });

    panelWin.once('ready-to-show', () => {
      panelWin.show();
      panelWin.setAlwaysOnTop(true, 'screen-saver');

      const storePanelBounds = () => {
        const pb = panelWin.getBounds();
        store.set(`${sessionKey}_panelBounds`, {
          x     : pb.x      - bounds.x,
          y     : pb.y      - bounds.y,
          width : pb.width,
          height: pb.height,
        });
      };
      storePanelBounds();

      _setBusy(false);
    });

    // 창 이동·리사이즈 시 상대좌표 실시간 갱신
    panelWin.on('move',   () => {
      const pb = panelWin.getBounds();
      store.set(`${sessionKey}_panelBounds`, {
        x: pb.x - bounds.x, y: pb.y - bounds.y,
        width: pb.width, height: pb.height,
      });
    });
    panelWin.on('resize', () => {
      const pb = panelWin.getBounds();
      store.set(`${sessionKey}_panelBounds`, {
        x: pb.x - bounds.x, y: pb.y - bounds.y,
        width: pb.width, height: pb.height,
      });
    });

    const _onRecDone = (_, raw) => {
      const result = raw ? { ...raw, fileName, display: selectedDisplay } : null;
      settle(result);
    };
    remote.ipcMain.on(`rec-done-${sessionKey}`, _onRecDone);

    panelWin.on('closed', () => settle(null));
  });
}

/**
 * 현재 화면 녹화 컨트롤 패널이 열려 있는지 여부를 반환합니다.
 *
 * getAllWindows() 로 전체 창을 순회하며 URL 쿼리스트링의
 * OBJTY 값이 'SCR_REC' 인 창이 하나라도 있으면 true 를 반환합니다.
 * 호출 스코프에 관계없이 항상 실제 창 존재 여부를 반환합니다.
 *
 * @returns {boolean}
 */
function isOpen() {
  return BrowserWindow.getAllWindows().some(w => {
    if (w.isDestroyed()) return false;
    try {
      const url    = new URL(w.webContents.getURL());
      return url.searchParams.get('OBJTY') === 'SCR_REC';
    } catch {
      return false;
    }
  });
}

/**
 * 현재 열려 있는 모든 screen_record 팝업의 테마를 즉시 변경합니다.
 *
 * ── 처리 순서 ────────────────────────────────────────────────────────────────
 *   ① 창 타입별 'theme-change' IPC 전송 (bgColor 포함)
 *      → 각 renderer 가 body.classList 토글 + setBackgroundColor() 실행
 *   ② setBackgroundColor() 직접 호출 (window.js 프로세스 측)
 *   ③ insertCSS 배경색 재주입 (injectBgCss)
 *   ④ 세션 store config.theme 갱신
 *
 * ── transparent 창 처리 ──────────────────────────────────────────────────────
 *   indicator / drawing 은 transparent 창이므로 bgColor=null 로 전송합니다.
 *   renderer 에서 bgColor 가 null 이면 setBackgroundColor() 를 호출하지 않습니다.
 *
 * @param {'dark'|'light'} theme
 */
function setTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;

  const store     = remote.require(path.join(__dirname, '../../core/store'));
  const panelBg   = getThemeInfo(theme, 'panel').BGCOL;
  const overlayBg = getThemeInfo(theme, 'overlay').BGCOL;

  // ── 헬퍼: 단일 창에 테마 전체 적용 ──────────────────────────────────────
  // IPC(bgColor 포함) + setBackgroundColor + insertCSS 를 한 번에 처리합니다.
  function _applyToWin(win, bgColor, variant) {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('theme-change', theme, bgColor);
    win.setBackgroundColor(bgColor);
    injectBgCss(win, theme, variant);
  }

  // ── ① 컨트롤 패널 (panel) ────────────────────────────────────────────────
  for (const [sessionKey] of _sessions) {
    const panelId = store.get(`${sessionKey}_panelWinId`, null);
    if (panelId) _applyToWin(BrowserWindow.fromId(panelId), panelBg, 'panel');

    // indicator: transparent — IPC만 전송, setBackgroundColor 생략
    const indId = store.get(`${sessionKey}_indicatorWinId`, null);
    if (indId) {
      const iw = BrowserWindow.fromId(indId);
      if (iw && !iw.isDestroyed()) iw.webContents.send('theme-change', theme, null);
    }
  }

  // ── ② 설정 팝업 (panel) ──────────────────────────────────────────────────
  const settingsId = store.get(STORE_KEY_SETTINGS, null);
  if (settingsId) _applyToWin(BrowserWindow.fromId(settingsId), panelBg, 'panel');

  // ── ③ 히스토리 팝업 (overlay) ────────────────────────────────────────────
  const historyId = store.get(STORE_KEY_HISTORY, null);
  if (historyId) _applyToWin(BrowserWindow.fromId(historyId), overlayBg, 'overlay');

  // ── ④ drawing: transparent — IPC만 전송, setBackgroundColor 생략 ─────────
  const drawingId = store.get('__drawing_win_id__', null);
  if (drawingId) {
    const dw = BrowserWindow.fromId(drawingId);
    if (dw && !dw.isDestroyed()) dw.webContents.send('theme-change', theme, null);
  }

  // ── ⑤ 세션 config 갱신 ───────────────────────────────────────────────────
  for (const [sessionKey] of _sessions) {
    const cfg = store.get(`${sessionKey}_config`, {});
    store.set(`${sessionKey}_config`, { ...cfg, theme });
  }
}

module.exports = { open, forceCloseAll, isOpen, setTheme };
