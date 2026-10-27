'use strict';

/**
 * @file windows/indicator-window.js
 * @description 녹화 상태를 표시하는 상단 중앙 뱃지 창을 생성합니다.
 *
 * 동작
 * ─────
 * - 대상 모니터 상단 중앙에 뱃지 크기(340×60)의 작은 투명 창
 * - click-through: 마우스 이벤트를 아래 창으로 완전 통과
 * - 녹화 중 : "● REC  M{n}  00:00:00"
 * - 일시정지 : "● PAUSE …" (노란 점)
 * - idle    : 뱃지 숨김
 *
 * 변경 이력 메모
 * ─────────────
 * 과거에는 모니터 전체 크기의 투명 오버레이였으나(상단 Pill → 테두리 하이라이트),
 * 테두리 기능 폐기 후에는 상단 중앙 뱃지만 사용했습니다. 전체 화면 투명 레이어가
 * 녹화 중 재합성되어 화면 떨림을 유발하고 cross-DPI 위치 계산이 불안정했기에,
 * 뱃지 크기의 작은 창으로 전환했습니다. (전체 테두리 기능은 되살리지 않음)
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

/**
 * Border Indicator 창을 생성하고 반환합니다.
 *
 * @param {Object}            params
 * @param {Electron.Display}  params.display       - 인디케이터를 표시할 디스플레이
 * @param {string}            params.sessionKey    - store 세션 키
 * @param {number}           [params.monitorIndex] - 몇 번 모니터인지 (1-based)
 * @param {string}           [params.theme='dark']
 * @returns {BrowserWindow}
 */
function createIndicatorWindow(params = {}) {
  const { display, sessionKey, monitorIndex = 1, theme = 'dark', USERINFO = {}, browserKey = '' } = params;
  const { bounds } = display;

  // ── 뱃지 크기/위치 계산 ──────────────────────────────────────────────────────
  // 과거: 모니터 전체 크기의 투명 오버레이 → 상단 중앙 뱃지 1개만 표시.
  //       전체 화면 투명 레이어가 녹화 중 매 프레임 재합성되어 화면 떨림을 유발하고,
  //       배율이 다른 모니터(cross-DPI)에서 위치 계산이 주 모니터 구성에 따라 어긋남.
  // 현재: 뱃지 크기의 작은 창만 대상 모니터 상단 중앙에 배치.
  //       전체 화면 재합성이 사라져 떨림이 제거되고, 작은 창이라 DPI 오차 영향이 미미.
  // ⚠️ "모니터 전체 빨간 테두리" 기능은 폐기됨 — 되살리려면 전체 화면 창을 별도로 둘 것.
  const BADGE_W = 340;  // 뱃지(내용 크기) + 좌우 그림자 여유
  const BADGE_H = 60;   // 뱃지 높이 + 하단 그림자 여유
  const bx = Math.round(bounds.x + (bounds.width - BADGE_W) / 2); // 대상 모니터 상단 중앙 X
  const by = bounds.y;                                            // 대상 모니터 최상단 Y

  const win = new BrowserWindow({
    x              : bx,
    y              : by,
    width          : BADGE_W,
    height         : BADGE_H,
    frame          : false,
    transparent    : true,
    skipTaskbar    : true,
    focusable      : false,
    resizable      : false,
    movable        : false,
    backgroundColor: '#00000000',
    webPreferences : {
      nodeIntegration      : true,
      contextIsolation     : false,
      webSecurity          : false,
      backgroundThrottling : false,  // drawing window 포커스 시 렌더링 멈춤 방지
    },
  });

  // 녹화 영상에서 인디케이터 창을 제외 (OS 레벨 캡처 보호)
  win.setContentProtection(true);

  // 마우스 이벤트 완전 무시 (forward 없음)
  // forward: true 를 사용하면 OS가 인디케이터 커서와 아래 창 커서를 동시에
  // 평가하면서 빠르게 교체 → 마우스 커서 떨림 현상 발생.
  // 인디케이터는 마우스 이벤트가 전혀 필요 없으므로 forward 없이 설정.
  win.setIgnoreMouseEvents(true);

  // screen-saver 레벨: 최상위
  win.setAlwaysOnTop(true, 'screen-saver');

  // alwaysOnTop 은 옵션 대신 메소드로 설정 (Electron 옵션 버그 우회)

  // IPC sendTo 용 webContents.id 를 store 에 저장
  // control-panel/index.js 가 ipcRenderer.sendTo(wcId, 'indicator-update') 로 상태를 직접 전달합니다.
  // BrowserWindow.id(win.id) 와 webContents.id 는 다른 값임에 주의합니다.
  const store = remote.require(path.join(__dirname, '../../core/store'));
  store.set(`${sessionKey}_indicatorWcId`, win.webContents.id);

  // URL에 QueryString 파라미터를 적용한다.
  const sUrlPath     = PATH.join(__dirname, 'index.html');
  const oQueryParams = { theme: theme, sessionKey: sessionKey, monitorIndex: String(monitorIndex), USERINFO: USERINFO, browserKey: browserKey };
  const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
  win.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));

  // ── DPI 환산 재적용 (모니터별 다른 배율 대응) ─────────────────────────────────
  // 생성자 x/y/width/height 는 창이 처음 뜨는 모니터(주 모니터)의 scaleFactor 로
  // 환산되어, 배율이 다른 대상 모니터로 이동 시 위치가 어긋날 수 있습니다.
  // setBounds 는 대상 디스플레이의 scaleFactor 로 정확히 환산하므로 한 번 더 적용합니다.
  win.webContents.once('did-finish-load', () => {
    if (win.isDestroyed()) return;
    win.setBounds({ x: bx, y: by, width: BADGE_W, height: BADGE_H });
  });

  // ── 배경색 CSS 주입 생략 ───────────────────────────────────────────────────
  // indicator 는 transparent: true / backgroundColor: '#00000000' 창입니다.
  // injectBgCss() 로 배경색을 주입하면 투명도가 깨지므로 주입하지 않습니다.

  return win;
}

module.exports = { createIndicatorWindow };
