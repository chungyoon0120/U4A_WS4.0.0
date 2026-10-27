/**
 * @file popups/drawing/text-input/window.js
 * @description 텍스트 메모 팝업 창 생성/관리
 *
 * 녹화 중 메모를 작성할 수 있는 떠 있는 Rich Text Editor 창입니다.
 * 드로잉 캔버스와 IPC 연동 없이 독립적으로 동작합니다.
 *
 * ── 사용 흐름 ────────────────────────────────────────────────────────────────
 *  1. openTextInputWindow({ theme, sessionKey, anchorX, anchorY, initColor })
 *  2. 사용자가 RTE 에서 메모 작성
 *  3. [닫기] 버튼 클릭 → 팝업 닫힘
 *  4. 호출부에서 'closed' 이벤트로 상태 정리 (_pendingGeom, _pendingEditId 초기화)
 *
 * ── 공통 팝업 패턴 ───────────────────────────────────────────────────────────
 *  · backgroundColor  : getThemeInfo 로 로드 전 배경 깜빡임 방지
 *  · show: false      : ready-to-show 이후 표시 (레이아웃 완료 시점)
 *  · injectBgCss      : did-finish-load 에서 테마 배경색 CSS 주입
 *  · backgroundThrottling: false : 창 비활성화 시 렌더 지연 방지
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

const { BrowserWindow }             = remote;
const { getThemeInfo, injectBgCss } = require('../../../core/theme');

/** 팝업 기본 크기 */
const POPUP_W = 500;
const POPUP_H = 400;

/**
 * 텍스트 메모 팝업을 앵커 위치 근처에 엽니다.
 *
 * @param {object} params
 * @param {string} [params.theme]      - 'dark' | 'light'
 * @param {string} [params.sessionKey] - 세션 키 (모니터 bounds 조회용)
 * @param {number} [params.anchorX]    - 팝업을 붙일 뷰포트 X 좌표 (미전달 시 모니터 중앙)
 * @param {number} [params.anchorY]    - 팝업을 붙일 뷰포트 Y 좌표
 * @param {string} [params.initColor]  - RTE 초기 글자 색상 (hex, 기본 #FFFFFF)
 * @returns {BrowserWindow}
 */
function openTextInputWindow(params) {
  const opts = params || {};
  const theme      = opts.theme      || 'dark';
  const sessionKey = opts.sessionKey || '';
  const initColor  = opts.initColor  || '#FFFFFF';
  const anchorX    = opts.anchorX;
  const anchorY    = opts.anchorY;
  const USERINFO   = opts.USERINFO   || {};
  const browserKey = opts.browserKey || '';

  const store = remote.require(path.join(__dirname, '../../../core/store'));
  const cfg   = sessionKey ? store.get(sessionKey + '_config', {}) : {};
  const db    = (cfg.display && cfg.display.bounds)
    ? cfg.display.bounds
    : remote.screen.getPrimaryDisplay().bounds;

  // ── 팝업 위치 결정 ─────────────────────────────────────────────────────────
  // anchorX/Y 가 있으면 앵커 아래-오른쪽에 배치, 화면 밖 넘침을 방지합니다.
  // 없으면 모니터 중앙에 배치합니다.
  const OFFSET = 12;
  var wx, wy;

  if (anchorX !== undefined && anchorY !== undefined) {
    var sx = db.x + anchorX;
    var sy = db.y + anchorY;

    // 기본: 앵커 아래-오른쪽
    wx = sx + OFFSET;
    wy = sy + OFFSET;

    // 오른쪽 넘침 → 왼쪽으로 반전
    if (wx + POPUP_W > db.x + db.width  - OFFSET) wx = sx - POPUP_W - OFFSET;
    // 아래쪽 넘침 → 위쪽으로 반전
    if (wy + POPUP_H > db.y + db.height - OFFSET) wy = sy - POPUP_H - OFFSET;

    // 최종 경계 클램핑 (모니터 범위 이탈 방지)
    wx = Math.max(db.x + OFFSET, Math.min(wx, db.x + db.width  - POPUP_W - OFFSET));
    wy = Math.max(db.y + OFFSET, Math.min(wy, db.y + db.height - POPUP_H - OFFSET));
  } else {
    // 앵커 없음 → 모니터 중앙
    wx = db.x + Math.round((db.width  - POPUP_W) / 2);
    wy = db.y + Math.round((db.height - POPUP_H) / 2);
  }

  // ── BrowserWindow 생성 ────────────────────────────────────────────────────
  var win = new BrowserWindow({
    x              : wx,
    y              : wy,
    width          : POPUP_W,
    height         : POPUP_H,
    minWidth       : 400,
    show           : false,                              // ready-to-show 에서 표시
    frame          : false,
    transparent    : false,
    resizable      : true,                               // 메모는 크기 조정 허용
    movable        : true,
    skipTaskbar    : true,
    backgroundColor: getThemeInfo(theme, 'panel').BGCOL, // 로드 전 배경색 깜빡임 방지
    webPreferences : {
      nodeIntegration      : true,
      contextIsolation     : false,
      webSecurity          : false,
      backgroundThrottling : false,
    },
  });

  // 드로잉 창(pop-up-menu)보다 높은 레벨로 설정해 항상 위에 표시
  win.setAlwaysOnTop(true, 'screen-saver');

  // URL에 QueryString 파라미터를 적용한다.
  const sUrlPath     = PATH.join(__dirname, 'index.html');
  const oQueryParams = { theme: theme, USERINFO: USERINFO, browserKey: browserKey };
  const sLoadUrl     = WSUTIL.QueryString.build(sUrlPath, oQueryParams);
  win.loadURL(REMOTE.getGlobal("u4aToAppUrl")(sLoadUrl));

  // ── 테마 배경색 CSS 주입 ──────────────────────────────────────────────────
  win.webContents.on('did-finish-load', function () {
    injectBgCss(win, theme, 'panel');
  });

  // ── 레이아웃 완료 후 표시 ─────────────────────────────────────────────────
  win.once('ready-to-show', function () {
    win.show();
  });

  return win;
}

module.exports = { openTextInputWindow: openTextInputWindow };
