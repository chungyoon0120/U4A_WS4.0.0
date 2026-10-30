/**
 * @file popups/settings/index.js
 * @description settings.html 의 모든 JavaScript 로직.
 *              HTML 은 구조/스타일만, 동작은 이 파일에서만 처리합니다.
 */

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);

/* ─────────────────────────────────────────────────────────────────────────────
 * settings.html 스크립트
 *
 * ⚠️ 창 닫기 시 반드시 window.close() 사용.
 *    remote.getCurrentWindow().close() 는 remote 미활성화 환경에서 실패할 수 있음.
 * ─────────────────────────────────────────────────────────────────────────────*/
'use strict';

// [2026-10-30 장군님 지시] require·module 조작을 걷어내려고 상대경로 → __dirname 절대경로.
const MSG = require(PATH.join(__dirname, 'msg'));

// ── 모듈 ──────────────────────────────────────────────────────────────────────
const path   = require('path');
const remote = require('@electron/remote');
const { ipcRenderer } = require('electron');

// app 을 remote 에서 안전하게 추출
const remoteApp    = remote.app;

// 공통 UI 메시지 모듈 (electron dialog / 자체 toast 대체)
const { MessageToast, MessageBox } = require(path.join(__dirname, '../shared/ui-message'));

// store: main 프로세스 단일 인스턴스 (remote.require)
const store = remote.require(path.join(__dirname, '../../core/store'));

// settingsStore: main 프로세스 단일 인스턴스 (remote.require)
// ※ 반드시 DOM refs 선언보다 먼저 init() 해야 이하 _earlyTheme 로드가 가능합니다.
const settingsStore = remote.require(path.join(__dirname, '../../core/settings-store'));
const { getThemeInfo } = require(path.join(__dirname, '../../core/theme'));
settingsStore.init(remoteApp.getPath('userData'));

// ── 파라미터 ──────────────────────────────────────────────────────────────────
const params     = WSUTIL.QueryString.parse(location.href);
const initTheme  = params.theme      || 'dark';  // 호출부 전달 테마 (폴백용)
const sessionKey = params.sessionKey || '';
const USERINFO   = params.USERINFO   || {};
const browserKey = params.browserKey || '';

// ── 조기 테마 적용 (플래시 방지) ──────────────────────────────────────────────
// 우선순위: 저장된 설정 > 호출부 전달값(initTheme) > 'dark'
// settingsStore.init() 이 위에서 완료됐으므로 즉시 load() 가능합니다.
// open() 최초 실행 시 이미 저장된 상태이므로 load()는 항상 올바른 값을 반환합니다.
const _earlyTheme = settingsStore.load().theme || initTheme || 'dark';
if (_earlyTheme === 'light') document.body.classList.add('light');

// ── DOM refs ──────────────────────────────────────────────────────────────────
const selFps      = document.getElementById('selFps');
const selBitrate  = document.getElementById('selBitrate');
const btnReset    = document.getElementById('btnReset');
const btnCancel   = document.getElementById('btnCancel');
const btnSave     = document.getElementById('btnSave');
const btnX        = document.getElementById('btnX');
const qualityHint = document.getElementById('qualityHint');

// ── 내부 상태 ─────────────────────────────────────────────────────────────────
let _theme     = _earlyTheme;  // 현재 세팅 창에서 선택된 테마
let _initTheme = _earlyTheme;  // 로드 시점 테마 (취소 시 원복용)
let _format      = 'webm-h264';
let _isRecording = false;       // 현재 녹화 중 여부 (품질 변경 잠금용)


// ── HTML 정적 텍스트 초기화 ───────────────────────────────────────────────────
/**
 * HTML에 하드코딩된 정적 텍스트를 MSG로 초기화합니다.
 */
function _initTexts() {
  document.title = MSG.M010;
  document.getElementById('titleLbl').textContent        = MSG.M010;
  document.getElementById('themeTitleLbl').textContent   = MSG.M011;
  document.getElementById('qualityTitleLbl').textContent = MSG.M012;
  document.getElementById('fpsLbl').textContent          = MSG.M013;
  document.getElementById('bitrateLbl').textContent      = MSG.M018;
  document.getElementById('formatTitleLbl').textContent  = MSG.M024;
  document.getElementById('fmtDescVP9').innerHTML        = MSG.M025 + '<br>' + MSG.M026;
  document.getElementById('fmtDescVP8').innerHTML        = MSG.M027 + '<br>' + MSG.M028;
  document.getElementById('fmtDescH264').innerHTML       = MSG.M029 + '<br>' + MSG.M030;
  document.getElementById('fmtHint').textContent         = MSG.M031;
  document.getElementById('btnSaveLbl').textContent      = MSG.M008;
  document.getElementById('btnCancel').textContent       = MSG.M007;
  document.getElementById('btnReset').textContent        = MSG.M002;
  document.querySelector('#btnX').setAttribute('title', MSG.M009);

  // select 옵션 텍스트
  const fpsOpts = selFps.options;
  fpsOpts[0].text = '15 fps — ' + MSG.M014;
  fpsOpts[1].text = '24 fps — ' + MSG.M015;
  fpsOpts[2].text = '30 fps — ' + MSG.M016;
  fpsOpts[3].text = '60 fps — ' + MSG.M017;

  const brOpts = selBitrate.options;
  brOpts[0].text = '1 Mbps — ' + MSG.M019;
  brOpts[1].text = '2.5 Mbps — ' + MSG.M020;
  brOpts[2].text = '5 Mbps — ' + MSG.M021;
  brOpts[3].text = '8 Mbps — ' + MSG.M022;
}

// ── 초기 로드 ─────────────────────────────────────────────────────────────────
/**
 * 설정 값을 폼에 반영합니다.
 *
 * 우선순위:
 *   테마    : 저장된 설정 > 현재 세션 config > 'dark'
 *   품질/포맷: 저장된 설정 > 현재 세션 recordOptions
 *
 * 저장된 값이 있으면 반드시 저장된 값을 사용합니다.
 */
function loadToForm() {
  const sessCfg = sessionKey ? (store.get(`${sessionKey}_config`, null) || {}) : {};
  const saved   = settingsStore.load();
  const ro      = sessCfg.recordOptions || {};

  // 녹화 상태 확인
  _isRecording = sessionKey
    ? ['recording', 'paused'].includes(store.get(`${sessionKey}_status`, 'idle'))
    : false;

  // ① 테마 — 저장된 값 우선, 없으면 세션 config, 최종 폴백 'dark'
  // open() 최초 실행 시 이미 저장된 상태이므로 load()는 항상 올바른 값을 반환합니다.
  const currentTheme = saved.theme || sessCfg.theme || 'dark';
  _initTheme = currentTheme;
  setTheme(currentTheme);

  // ② 프레임레이트·비트레이트 — 저장된 값 우선, 없으면 세션 recordOptions
  selFps.value     = String(saved.frameRate          ?? ro.frameRate          ?? 30);
  selBitrate.value = String(saved.videoBitsPerSecond ?? ro.videoBitsPerSecond ?? 2500000);

  // 녹화 중이면 품질 변경 비활성화
  if (!_isRecording) {
    qualityHint.textContent = '';
  } else {
    selFps.disabled     = true;
    selBitrate.disabled = true;
    qualityHint.textContent = '⚠ ' + MSG.M001;
    qualityHint.style.color = 'var(--danger)';
  }

  // ③ 포맷 — 저장된 값 우선, 없으면 세션 recordOptions
  setFormat(saved.videoFormat ?? ro.videoFormat ?? 'webm-h264');
}

/**
 * 테마 세그먼트 활성화 + 설정 창 자신에게 즉시 적용 + store에 미리보기 신호 전송
 *
 * @param {string} t - 'dark' | 'light'
 */
function setTheme(t) {
  _theme = t || 'dark';

  // 세그먼트 버튼 활성화
  document.querySelectorAll('.seg-btn').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === _theme));

  // 설정 창 자신에게 즉시 테마 적용
  document.body.classList.toggle('light', _theme === 'light');
  remote.getCurrentWindow().setBackgroundColor(getThemeInfo(_theme, 'panel').BGCOL);

  // idle 상태에서만 컨트롤 패널에 실시간 미리보기 신호 전송
  if (!_isRecording && sessionKey) {
    store.set(`${sessionKey}_themePreview`, _theme);
  }
}

/** 포맷 카드 활성화 */
function setFormat(f) {
  _format = f || 'webm-h264';
  document.querySelectorAll('.fmt-card').forEach(el =>
    el.classList.toggle('active', el.dataset.format === _format));
}

// ── 저장 ──────────────────────────────────────────────────────────────────────
/**
 * 설정을 영구 파일에 저장하고 현재 세션 config를 업데이트합니다.
 *
 * - 테마         : 선택된 값을 영구 저장 + 세션 config에도 반영
 * - 품질/포맷    : 영구 파일 저장 + idle 상태면 현재 세션에도 즉시 반영
 */
function saveSettings() {
  const fps     = parseInt(selFps.value, 10);
  const bitrate = parseInt(selBitrate.value, 10);

  const s = {
    theme              : _theme,
    frameRate          : fps,
    videoBitsPerSecond : bitrate,
    videoFormat        : _format,
  };

  // ① 영구 파일 저장 (outputDir 은 건드리지 않음)
  const existing = settingsStore.load();
  settingsStore.save({ ...existing, ...s });

  // ② 현재 세션 config 업데이트
  if (sessionKey) {
    const status = store.get(`${sessionKey}_status`, 'idle');
    const cfg    = store.get(`${sessionKey}_config`, {});
    const updatedCfg = { ...cfg, theme: _theme };

    // 품질/포맷은 idle 상태일 때만 현재 세션에 즉시 반영
    if (status === 'idle') {
      updatedCfg.recordOptions = {
        ...(cfg.recordOptions || {}),
        frameRate          : fps,
        videoBitsPerSecond : bitrate,
        videoFormat        : _format,
      };
    }

    store.set(`${sessionKey}_config`, updatedCfg);

    // 컨트롤 패널에 변경 알림 (configVersion 증가)
    store.set(`${sessionKey}_configVersion`,
      (store.get(`${sessionKey}_configVersion`, 0) + 1));

    // 저장 완료 후 themePreview 신호 정리
    store.set(`${sessionKey}_themePreview`, null);
  }

  MessageToast.show('✓ ' + MSG.M005, { type: 'success' });
  setTimeout(() => window.close(), 700);
}

// ── 이벤트 ───────────────────────────────────────────────────────────────────

// 테마 세그먼트 클릭
document.querySelectorAll('.seg-btn').forEach(el =>
  el.addEventListener('click', () => setTheme(el.dataset.theme)));

// 포맷 카드 클릭
document.querySelectorAll('.fmt-card').forEach(el =>
  el.addEventListener('click', () => setFormat(el.dataset.format)));

// 기본값 초기화
btnReset.addEventListener('click', async () => {
  const confirmed = await MessageBox.confirm(MSG.M003, {
    title      : MSG.M002,
    type       : 'question',
    cancelLabel: MSG.M007,
    okLabel    : MSG.M004,
  });
  if (!confirmed) return;
  settingsStore.reset();
  loadToForm();
  MessageToast.show('✓ ' + MSG.M006, { type: 'success' });
});

// 저장 버튼
btnSave.addEventListener('click', saveSettings);

// 취소 / 닫기
function cancelAndClose() {
  // 취소 시 themePreview를 원래 테마로 원복
  if (!_isRecording && sessionKey) {
    store.set(`${sessionKey}_themePreview`, _initTheme);
  }
  window.close();
}

btnCancel.addEventListener('click', cancelAndClose);
btnX.addEventListener('click',      cancelAndClose);

// 키보드 단축키
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cancelAndClose();
  if (e.key === 'Enter' && !e.target.matches('select')) saveSettings();
});

// ── IPC 수신: 테마 변경 (setTheme() 브로드캐스트) ────────────────────────────
// 설정 팝업이 열려 있는 동안 솔루션 프로그램 테마가 바뀌면 즉시 반영합니다.
ipcRenderer.on('theme-change', (_, newTheme, bgColor) => {
  document.body.classList.toggle('light', newTheme === 'light');
  if (bgColor) remote.getCurrentWindow().setBackgroundColor(bgColor);
});

// ── 시작 ──────────────────────────────────────────────────────────────────────
_initTexts();
loadToForm();
