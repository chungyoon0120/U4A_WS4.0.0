/**
 * @file scripts/indicator.js
 * @description indicator.html 의 모든 JavaScript 로직.
 *              HTML 은 구조/스타일만, 동작은 이 파일에서만 처리합니다.
 *
 * ── 상태 갱신 방식 ────────────────────────────────────────────────────────────
 *  구 방식: setInterval(updateUI, 500)  — store 폴링
 *  신 방식: ipcRenderer.on('indicator-update')  — IPC 이벤트 수신
 *
 *  control-panel/index.js 가 녹화 상태 변경 시 ipcRenderer.sendTo(wcId, ...) 로
 *  직접 이 창에 데이터를 전달합니다. store 를 거치지 않아 반응이 즉각적입니다.
 *
 *  타이머(recording) 는 수신한 startTime / pausedMs 를 기반으로
 *  requestAnimationFrame 으로 로컬에서 직접 렌더링합니다.
 *  → 폴링 없이 60fps 에 가까운 부드러운 타이머 표시 가능.
 */

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);

'use strict';

// [2026-10-30 장군님 지시] require·module 조작을 걷어내려고 상대경로 → __dirname 절대경로.
const MSG = require(PATH.join(__dirname, 'msg'));

const { ipcRenderer } = require('electron');

const params       = WSUTIL.QueryString.parse(location.href);
const theme        = params.theme        || 'dark';
const monitorIndex = parseInt(params.monitorIndex || '1', 10);
const USERINFO     = params.USERINFO     || {};
const browserKey   = params.browserKey   || '';

if (theme === 'light') document.body.classList.add('light');

const borderRing   = document.getElementById('borderRing');
const cornerBadge  = document.getElementById('cornerBadge');
const statusText   = document.getElementById('statusText');
const monitorBadge = document.getElementById('monitorBadge');
const timerText    = document.getElementById('timerText');

monitorBadge.textContent = `M${monitorIndex}`;

/** ms → HH:MM:SS */
function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map(n => String(n).padStart(2, '0')).join(':');
}

// ── 로컬 상태 (IPC 수신 시 갱신) ──────────────────────────────────────────────
const _local = {
  status         : 'idle',
  startTime      : null,
  pausedMs       : 0,
  elapsedSnapshot: null,
};

// ── RAF 타이머 (recording 상태에서만 실행) ────────────────────────────────────
let _rafId = null;

/**
 * recording 중 타이머를 requestAnimationFrame 으로 갱신합니다.
 * setInterval 없이 부드럽고 정확한 타이머 표시를 제공합니다.
 */
function _startRAF() {
  if (_rafId !== null) return; // 중복 시작 방지
  const tick = () => {
    if (_local.status !== 'recording') { _rafId = null; return; }
    timerText.textContent = fmtTime(Date.now() - _local.startTime - _local.pausedMs);
    _rafId = requestAnimationFrame(tick);
  };
  _rafId = requestAnimationFrame(tick);
}

/**
 * RAF 타이머를 중지합니다.
 */
function _stopRAF() {
  if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
}

// ── UI 적용 ───────────────────────────────────────────────────────────────────
/**
 * 수신한 상태 데이터를 UI에 반영합니다.
 *
 * @param {{
 *   status: 'idle'|'recording'|'paused',
 *   startTime: number|null,
 *   pausedMs: number,
 *   elapsedSnapshot: number|null
 * }} data
 */
function applyState(data) {
  Object.assign(_local, data);

  if (_local.status === 'recording') {
    borderRing.className  = 'border-ring recording';
    cornerBadge.className = 'corner-badge visible recording';
    statusText.textContent = MSG.M001;
    _startRAF(); // RAF 타이머 시작 (이미 실행 중이면 무시)

  } else if (_local.status === 'paused') {
    _stopRAF(); // RAF 타이머 중지
    borderRing.className  = 'border-ring paused';
    cornerBadge.className = 'corner-badge visible paused';
    statusText.textContent = MSG.M002;
    if (_local.elapsedSnapshot !== null) {
      timerText.textContent = fmtTime(_local.elapsedSnapshot);
    }

  } else {
    _stopRAF();
    borderRing.className  = 'border-ring';
    cornerBadge.className = 'corner-badge';
  }
}

// ── IPC 수신 ──────────────────────────────────────────────────────────────────
/**
 * control-panel/index.js 로부터 녹화 상태 변경 이벤트를 수신합니다.
 * ipcRenderer.sendTo(indicatorWcId, 'indicator-update', data) 로 발신됩니다.
 */
ipcRenderer.on('indicator-update', (_, data) => applyState(data));

// ── IPC 수신: 테마 변경 (setTheme() 브로드캐스트) ────────────────────────────
// indicator 는 transparent 창 — bgColor 는 항상 null 로 전달됩니다.
// setBackgroundColor() 를 호출하면 투명도가 깨지므로 호출하지 않습니다.
ipcRenderer.on('theme-change', (_, newTheme) => {
  document.body.classList.toggle('light', newTheme === 'light');
});
