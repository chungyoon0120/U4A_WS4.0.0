/**
 * @file popups/control-panel/index.js
 * @description control-panel.html 의 모든 JavaScript 로직.
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
 * control-panel.html
 * window manager 들은 직접 require() — remote.require() 사용 금지
 * ─────────────────────────────────────────────────────────────────────────── */
'use strict';

const MSG = require('./msg');

const path   = require('path');
const fs     = require('fs');
const remote = require('@electron/remote');
const { ipcRenderer }            = require('electron');
const { app, shell } = remote;

// 공통 UI 메시지 모듈 (electron dialog 대체)
const { MessageBox } = require(path.join(__dirname, '../shared/ui-message'));

// store: main 프로세스 단일 인스턴스 (remote.require)
const store = remote.require(path.join(__dirname, '../../core/store'));
const { getThemeInfo } = require(path.join(__dirname, '../../core/theme'));

// window managers — 직접 require (내부에서 @electron/remote 사용)
const { openHistoryWindow, forceCloseAllHistory }       = require(path.join(__dirname, '../history/window'));
const { openSettingsWindow, closeSettingsWindow, isSettingsOpen } = require(path.join(__dirname, '../settings/window'));
const { openDrawingWindow, closeDrawingWindow, isDrawingOpen } = require(path.join(__dirname, '../drawing/window'));

// 설정 store — 직접 require (순수 Node.js)
const settingsStore = require(path.join(__dirname, '../../core/settings-store'));

// 녹화 엔진 — 직접 require (MediaRecorder, renderer 전용)
const { createRecorder } = require(path.join(__dirname, '../../recorder'));

// ── 초기화 ────────────────────────────────────────────────────────────────────
const params     = WSUTIL.QueryString.parse(location.href);
const theme      = params.theme      || 'dark';
const sessionKey = params.sessionKey || '';
const USERINFO   = params.USERINFO   || {};
const browserKey = params.browserKey || '';

if (theme === 'light') document.body.classList.add('light');

settingsStore.init(app.getPath('userData'));

// ── config ────────────────────────────────────────────────────────────────────
const cfg = store.get(`${sessionKey}_config`, {});
let _outputDir     = cfg.outputDir     || app.getPath('videos');
let _fileName      = cfg.fileName      || `recording_${Date.now()}.webm`;
let _display       = cfg.display       || null;
let _sourceId      = cfg.sourceId      || null;
let _recordOptions = cfg.recordOptions || {};
let _outputPath    = path.join(_outputDir, _fileName);

// ── DOM refs ──────────────────────────────────────────────────────────────────
const statusStrip   = document.getElementById('statusStrip');
const statusLbl     = document.getElementById('statusLbl');
const timerEl       = document.getElementById('timer');
const displayLbl    = document.getElementById('displayLabel');
const pathText      = document.getElementById('pathText');
const btnRecord     = document.getElementById('btnRecord');
const btnRecordLbl  = document.getElementById('btnRecordLbl');
const btnPause      = document.getElementById('btnPause');
const pauseIcon     = document.getElementById('pauseIcon');
const btnMic        = document.getElementById('btnMic');        // 마이크 토글 버튼
const btnMicLbl     = document.getElementById('btnMicLbl');     // 마이크 버튼 텍스트
const micStatusRow  = document.getElementById('micStatusRow');  // 마이크 상태 표시 행
const micStatusLbl  = document.getElementById('micStatusLbl');  // 마이크 상태 텍스트
const btnHistory    = document.getElementById('btnHistory');
const btnOpenDir    = document.getElementById('btnOpenDir');
const btnPlayLast   = document.getElementById('btnPlayLast');
const btnDrawing    = document.getElementById('btnDrawing');
const btnSettings   = document.getElementById('btnSettings');
const btnMin        = document.getElementById('btnMin');
const btnClose      = document.getElementById('btnClose');
const savingOverlay = document.getElementById('savingOverlay');

// ── 초기 표시 ─────────────────────────────────────────────────────────────────
if (_display?.bounds) {
  const monIdx  = cfg.monitorIndex || 1;
  const chip    = document.getElementById('monitorChip');
  if (chip) chip.textContent = `M${monIdx}`;
  displayLbl.textContent = `${_display.bounds.width} × ${_display.bounds.height}`;
}
pathText.textContent = _outputPath;
pathText.title       = _outputPath;

// ── 상태 ──────────────────────────────────────────────────────────────────────
let _status       = 'idle';
let _timerRaf     = null;
let _micOn        = false;    // 마이크 현재 활성화 여부 (UI 로컬 상태)
let _micAvailable = false;    // 마이크 하드웨어 연결 여부 (enumerateDevices 기반)
const recorder = createRecorder();

/** 녹화 중 파일 삭제 감지용 watchFile 폴링 타이머 */
let _fileWatcher = null;

/** 녹화 중 마이크 장치 연결 감지용 폴링 타이머 (setTimeout 재귀) */
let _micCheckTimer = null;

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60]
    .map(n => String(n).padStart(2,'0')).join(':');
}

function syncStore(elapsedSnapshot = null) {
  store.set(`${sessionKey}_status`,          recorder.getStatus());
  store.set(`${sessionKey}_startTime`,       recorder.getStartTime());
  store.set(`${sessionKey}_pausedMs`,        recorder.getPausedMs());
  store.set(`${sessionKey}_elapsedSnapshot`, elapsedSnapshot);
}

/**
 * 인디케이터 창에 녹화 상태를 IPC 로 직접 전달합니다.
 * @param {'idle'|'recording'|'paused'} status
 * @param {number|null} [elapsedSnapshot=null]
 */
function _sendToIndicator(status, elapsedSnapshot = null) {
  const wcId = store.get(`${sessionKey}_indicatorWcId`, null);
  if (!wcId) return;
  const wc = remote.webContents.fromId(wcId);
  if (!wc || wc.isDestroyed()) return;
  wc.send('indicator-update', {
    status,
    startTime      : recorder.getStartTime(),
    pausedMs       : recorder.getPausedMs(),
    elapsedSnapshot,
  });
}

function startTimerLoop() {
  const tick = () => {
    const s = recorder.getStatus();
    if (s === 'recording' || s === 'paused') {
      timerEl.textContent = fmtTime(recorder.getElapsedMs());
      _timerRaf = requestAnimationFrame(tick);
    }
  };
  _timerRaf = requestAnimationFrame(tick);
}

function stopTimerLoop() {
  if (_timerRaf !== null) { cancelAnimationFrame(_timerRaf); _timerRaf = null; }
}

// ── 마이크 UI 동기화 ─────────────────────────────────────────────────────────

/**
 * 마이크 버튼의 전체 상태를 _micAvailable + _status + _micOn 을 종합해서 결정합니다.
 *
 * 상태 우선순위:
 *   1. 장치 미연결 (_micAvailable=false) → 항상 disabled, 취소선 아이콘
 *   2. 장치 연결됨 + 녹화 중이 아님       → disabled, 일반 아이콘
 *   3. 장치 연결됨 + 녹화 중 + OFF        → enabled, 일반 아이콘
 *   4. 장치 연결됨 + 녹화 중 + ON         → enabled, 펄스 아이콘
 */
function _refreshMicButton() {
  // ① 장치 미연결: 항상 disabled + 취소선 아이콘
  if (!_micAvailable) {
    btnMic.disabled = true;
    btnMic.classList.remove('mic-on');
    btnMic.classList.add('mic-unavailable');
    btnMicLbl.textContent = MSG.M016;
    btnMic.title = MSG.M017;
    // 상단 상태 표시: 미연결
    micStatusRow.className = 'mic-status-disconnected';
    micStatusLbl.textContent = MSG.M016;
    return;
  }

  // 장치 연결됨: 취소선 아이콘 제거
  btnMic.classList.remove('mic-unavailable');

  const canUse = (_status === 'recording' || _status === 'paused');
  btnMic.disabled = !canUse;

  if (_micOn) {
    // ④ 녹화 중 + ON
    btnMic.classList.add('mic-on');
    btnMicLbl.textContent = MSG.M018;
    btnMic.title = MSG.M019;
  } else {
    // ② 대기 중 또는 ③ 녹화 중 + OFF
    btnMic.classList.remove('mic-on');
    btnMicLbl.textContent = MSG.M020;
    btnMic.title = canUse ? MSG.M021 : MSG.M015;
  }

  // 상단 상태 표시: 연결됨
  micStatusRow.className = 'mic-status-connected';
  micStatusLbl.textContent = MSG.M022;
}

/**
 * 마이크 ON/OFF 상태를 업데이트하고 버튼 UI를 갱신합니다.
 * @param {boolean} isOn
 */
function _syncMicUI(isOn) {
  _micOn = isOn;
  _refreshMicButton();
}

/**
 * 마이크 버튼을 강제로 OFF 상태로 초기화합니다.
 * 녹화 종료 시 호출합니다. (disabled 처리는 _refreshMicButton 에서 일괄 처리)
 */
function _resetMicUI() {
  _syncMicUI(false);
}

/**
 * 마이크 하드웨어 연결 여부를 확인하고 버튼 상태를 갱신합니다.
 * - 페이지 로드 시 1회 호출
 * - devicechange 이벤트 발생 시 재호출 (핫플러그 대응)
 *
 * 녹화 중 마이크가 빠진 경우: 조용히 자동 OFF 처리 (팝업 없음)
 */
async function checkMicAvailable() {
  try {
    const devices   = await navigator.mediaDevices.enumerateDevices();
    const available = devices.some(d => d.kind === 'audioinput');

    // 변화 없으면 불필요한 UI 갱신 생략
    if (_micAvailable === available) return;

    _micAvailable = available;

    // 녹화 중 마이크가 빠진 경우: 조용히 자동 OFF (팝업 없음)
    if (!available && _micOn) {
      recorder.disableAudio();
      _micOn = false;
    }

    _refreshMicButton();
  } catch {
    // enumerateDevices 실패 시 미연결로 간주
    _micAvailable = false;
    _refreshMicButton();
  }
}

// 마이크 장치 핫플러그 감지 (연결/해제 시 자동 업데이트)
navigator.mediaDevices.addEventListener('devicechange', checkMicAvailable);

/**
 * 마이크 장치 폴링을 시작합니다. (앱 시작 시 1회 호출, 이후 상시 동작)
 *
 * setTimeout 재귀 패턴을 사용합니다.
 * - setInterval 과 달리 이전 checkMicAvailable() 호출이 완전히 끝난 뒤
 *   다음 호출을 예약하므로, 느린 PC 에서도 호출이 절대 겹치지 않습니다.
 * - checkMicAvailable() 내부에 상태 변화 가드가 있어
 *   장치 상태가 그대로면 UI 갱신 없이 즉시 리턴합니다.
 * - 녹화 중/대기 중 구분 없이 1초 간격으로 동작하여 일관된 반응속도 보장.
 */
function startMicWatch() {
  stopMicWatch(); // 혹시 이전 타이머가 남아있으면 정리

  const schedule = async () => {
    await checkMicAvailable();

    // 완료 후 1000ms 뒤 다음 호출 예약 (호출 겹침 원천 차단)
    _micCheckTimer = setTimeout(schedule, 1000);
  };

  _micCheckTimer = setTimeout(schedule, 1000);
}

/**
 * 마이크 장치 폴링을 중단합니다.
 */
function stopMicWatch() {
  if (_micCheckTimer !== null) {
    clearTimeout(_micCheckTimer);
    _micCheckTimer = null;
  }
}


// ── HTML 정적 텍스트 초기화 ───────────────────────────────────────────────────
/**
 * HTML에 하드코딩된 정적 텍스트를 MSG로 초기화합니다.
 * 페이지 로드 시 1회 실행합니다.
 */
function _initTexts() {
  document.getElementById('titleLbl').textContent      = MSG.M045;
  document.getElementById('btnHistoryLbl').textContent = MSG.M009;
  document.getElementById('btnOpenDirLbl').textContent = MSG.M046;
  document.getElementById('btnPlayLastLbl').textContent= MSG.M011;
  document.getElementById('btnDrawingLbl').textContent = MSG.M014;
  document.getElementById('btnSettingsLbl').textContent= MSG.M012;
  document.getElementById('savingText').textContent    = MSG.M047;
}

// ── UI 상태 업데이트 ──────────────────────────────────────────────────────────
/**
 * 현재 녹화 상태에 맞게 모든 UI를 업데이트합니다.
 *
 * 마이크 버튼 활성화 규칙:
 *   - idle / stopping : disabled (녹화 전/후)
 *   - recording / paused : enabled (녹화 중에만 ON/OFF 토글 가능)
 *
 * @param {'idle'|'recording'|'paused'|'stopping'} status
 */
function setUIStatus(status) {
  _status = status;

  const MAP = {
    idle     : { strip:'',          lbl:MSG.M001,    rec:MSG.M005,   stop:false, pauseEn:false },
    recording: { strip:'recording', lbl:MSG.M002,        rec:'■ ' + MSG.M006, stop:true,  pauseEn:true  },
    paused   : { strip:'paused',    lbl:MSG.M003,     rec:'■ ' + MSG.M006, stop:true,  pauseEn:true  },
    stopping : { strip:'',          lbl:MSG.M004, rec:MSG.M004,  stop:true,  pauseEn:false },
  };
  const cfg = MAP[status] || MAP.idle;

  statusStrip.className    = `status-strip ${cfg.strip}`;
  statusLbl.textContent    = cfg.lbl;
  btnRecordLbl.textContent = cfg.rec;
  btnRecord.classList.toggle('stop-mode', cfg.stop);
  btnRecord.disabled = (status === 'stopping');
  btnPause.disabled  = !cfg.pauseEn;

  // 일시정지 버튼 아이콘 전환
  if (status === 'paused') {
    btnPause.classList.add('resume-mode');
    btnPause.title = MSG.M007;
    pauseIcon.innerHTML = '<polygon points="6,3 20,12 6,21"/>';
  } else {
    btnPause.classList.remove('resume-mode');
    btnPause.title = MSG.M008;
    pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
  }

  // ─ 버튼 활성화 기준 ───────────────────────────────────────────────────────
  const isIdle     = (status === 'idle');
  const isRecoding = (status === 'recording' || status === 'paused');

  // 히스토리: idle 에서만
  btnHistory.disabled = !isIdle;
  btnHistory.title    = isIdle ? MSG.M009 : MSG.M010;

  // 최근 파일 재생: idle 에서만
  btnPlayLast.disabled = !isIdle;
  btnPlayLast.title    = isIdle ? MSG.M011 : MSG.M010;

  // 설정: idle 에서만
  btnSettings.disabled = !isIdle;
  btnSettings.title    = isIdle ? MSG.M012 : MSG.M013;

  // 드로잉: 녹화 중/일시정지에서만
  const canDraw = isRecoding;
  btnDrawing.disabled = !canDraw;
  btnDrawing.title    = canDraw ? MSG.M014 : MSG.M015;

  // 마이크: _refreshMicButton()이 _micAvailable + _status + _micOn 을 종합 판단
  // 녹화가 끝나는 방향(idle/stopping)이면 _micOn 상태를 먼저 해제
  if (!isRecoding && _micOn) _micOn = false;
  _refreshMicButton();

  // 저장 폴더 열기: 항상 활성
  btnOpenDir.disabled = false;

  // 녹화 종료 시 열려있는 드로잉 창 자동 닫기
  if (!canDraw && isDrawingOpen()) {
    closeDrawingWindow();
    btnDrawing.classList.remove('drawing-on');
  }
}

// ── 녹화 파일 삭제 감지 ─────────────────────────────────────────────────────
/**
 * 녹화 중인 파일을 300ms 간격으로 폴링하여 삭제 여부를 감지합니다.
 * @param {string} filePath - 감시할 파일 경로
 */
function startFileWatch(filePath) {
  stopFileWatch();

  let existed = false;
  setTimeout(() => {
    existed = fs.existsSync(filePath);
    _fileWatcher = setInterval(() => {
      const exists = fs.existsSync(filePath);
      if (existed && !exists) {
        stopFileWatch();
        onRecordingFileDeleted();
      }
      existed = exists;
    }, 300);
  }, 500);
}

/**
 * 파일 감시 타이머를 해제합니다.
 */
function stopFileWatch() {
  if (_fileWatcher !== null) {
    clearInterval(_fileWatcher);
    _fileWatcher = null;
  }
}

/**
 * 녹화 중인 파일이 삭제된 것을 감지했을 때 호출됩니다.
 */
async function onRecordingFileDeleted() {
  if (_status !== 'recording' && _status !== 'paused') return;

  stopTimerLoop();

  if (isDrawingOpen()) {
    closeDrawingWindow();
    btnDrawing.classList.remove('drawing-on');
  }

  try { await recorder.stop(); } catch {}

  store.set(`${sessionKey}_status`, 'idle');
  setUIStatus('idle');
  _resetMicUI();
  savingOverlay.classList.remove('visible');
  timerEl.textContent = '00:00:00';
  _sendToIndicator('idle');

  MessageBox.alert(MSG.M025, { title: MSG.M024, detail: MSG.M026, type: 'warning' });
}

// ── 녹화 제어 ─────────────────────────────────────────────────────────────────
async function startRecording() {
  if (_status !== 'idle') return;

  forceCloseAllHistory();
  try { closeSettingsWindow(); } catch {}
  try { closeDrawingWindow();  } catch {}

  if (!_sourceId) {
    MessageBox.alert(MSG.M029, { title: MSG.M028, type: 'error' });
    return;
  }
  try {
    setUIStatus('recording');
    await recorder.start({ sourceId:_sourceId, outputPath:_outputPath, display:_display, options:_recordOptions });
    syncStore();
    startTimerLoop();
    startFileWatch(_outputPath);
    _sendToIndicator('recording');
  } catch (err) {
    setUIStatus('idle');
    MessageBox.alert(err.message, { title: MSG.M030, type: 'error' });
  }
}

async function stopRecording() {
  if (_status !== 'recording' && _status !== 'paused') return;

  stopFileWatch();

  // 마이크가 켜져 있으면 먼저 비활성화
  if (_micOn) {
    recorder.disableAudio();
    _syncMicUI(false);
  }

  if (isDrawingOpen()) {
    closeDrawingWindow();
    btnDrawing.classList.remove('drawing-on');
  }

  setUIStatus('stopping');
  stopTimerLoop();
  savingOverlay.classList.add('visible');
  _sendToIndicator('idle');

  try {
    const result = await recorder.stop();
    store.set(`${sessionKey}_status`, 'idle');
    if (result) {
      store.set(`${sessionKey}_result`, result);
      store.set(`${sessionKey}_status`, 'completed');
      ipcRenderer.send(`rec-done-${sessionKey}`, result);
    }
  } catch (err) {
    savingOverlay.classList.remove('visible');
    setUIStatus('idle');
    MessageBox.alert(err.message, { title: MSG.M031, type: 'error' });
  }
}

function togglePause() {
  if (_status === 'recording') {
    recorder.pause();
    setUIStatus('paused');
    syncStore(recorder.getElapsedMs());
    _sendToIndicator('paused', recorder.getElapsedMs());
  } else if (_status === 'paused') {
    recorder.resume();
    setUIStatus('recording');
    syncStore(null);
    _sendToIndicator('recording');
  }
}

// ── 마이크 토글 ───────────────────────────────────────────────────────────────
/**
 * 마이크를 ON/OFF 토글합니다.
 * 녹화 중(recording|paused) 상태에서만 동작합니다.
 *
 * enableAudio() 최초 호출 시 브라우저가 마이크 권한 대화상자를 표시합니다.
 * 권한 거부 시 오류 메시지를 표시하고 버튼을 원래 상태로 복원합니다.
 */
async function onMicToggle() {
  if (_status !== 'recording' && _status !== 'paused') return;

  if (_micOn) {
    // ── 마이크 OFF ─────────────────────────────────────────────────────────
    recorder.disableAudio();
    _syncMicUI(false);
    return;
  }

  // ── 마이크 ON ─────────────────────────────────────────────────────────────
  // 버튼 일시 비활성화 (권한 요청 중 중복 클릭 방지)
  btnMic.disabled = true;
  btnMicLbl.textContent = MSG.M023;

  const { ok, reason } = await recorder.enableAudio();

  btnMic.disabled = false;

  if (!ok) {
    // 권한 거부 또는 오류: UI 복원 후 사용자에게 알림
    _syncMicUI(false);
    btnMic.title = MSG.M021;
    MessageBox.alert(MSG.M038, { title: MSG.M037, detail: reason || MSG.M039, type: 'warning' });
    return;
  }

  _syncMicUI(true);
}

// ── 액션 버튼 ─────────────────────────────────────────────────────────────────
async function onHistory() {
  try { await openHistoryWindow({ outputDir: _outputDir, theme: _appliedTheme, parentWin: remote.getCurrentWindow(), panelSessionKey: sessionKey, USERINFO: USERINFO, browserKey: browserKey }); }
  catch (err) { console.error(err); }
}

function onOpenDir() {
  try {
    if (!fs.existsSync(_outputDir)) fs.mkdirSync(_outputDir, { recursive: true });
    shell.openPath(_outputDir);
  } catch (err) {
    MessageBox.alert(err.message, { title: MSG.M032, type: 'error' });
  }
}

function onPlayLast() {
  try {
    if (!fs.existsSync(_outputDir)) {
      MessageBox.alert(MSG.M033, { title: MSG.M011, type: 'info' });
      return;
    }
    const files = fs.readdirSync(_outputDir)
      .filter(f => /\.(webm|mp4|mkv|avi|mov)$/i.test(f))
      .map(f => ({ name:f, mtime:fs.statSync(path.join(_outputDir,f)).mtimeMs }))
      .sort((a,b) => b.mtime - a.mtime);
    if (!files.length) {
      MessageBox.alert(MSG.M034, { title: MSG.M011, type: 'info' });
      return;
    }
    shell.openPath(path.join(_outputDir, files[0].name));
  } catch (err) {
    MessageBox.alert(err.message, { title: MSG.M035, type: 'error' });
  }
}

/**
 * [화면 드로잉] 녹화 중인 모니터에 드로잉 오버레이를 토글합니다.
 */
function onDrawing() {
  if (isDrawingOpen()) {
    closeDrawingWindow();
    btnDrawing.classList.remove('drawing-on');
    btnDrawing.title = MSG.M014;
  } else {
    openDrawingWindow({ display: _display, sessionKey, theme: _appliedTheme, USERINFO: USERINFO, browserKey: browserKey });
    btnDrawing.classList.add('drawing-on');
    btnDrawing.title = MSG.M036;
  }
}

async function onSettings() {
  try {
    await openSettingsWindow({ sessionKey, theme: _appliedTheme, parentWin: remote.getCurrentWindow(), USERINFO: USERINFO, browserKey: browserKey });
    if (_status === 'idle') {
      const updated = store.get(`${sessionKey}_config`, {});
      if (updated?.outputDir !== undefined) {
        _outputDir     = updated.outputDir || app.getPath('videos');
        _recordOptions = updated.recordOptions || _recordOptions;
        _outputPath    = path.join(_outputDir, _fileName);
        pathText.textContent = _outputPath;
        pathText.title       = _outputPath;
      }
    }
  } catch (err) { console.error(err); }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────────
btnRecord.addEventListener('click', () => {
  if (_status === 'idle') startRecording();
  else if (_status === 'recording' || _status === 'paused') stopRecording();
});
btnPause.addEventListener('click',    togglePause);
btnMic.addEventListener('click',      onMicToggle);   // 마이크 토글

// 마이크 상태 표시줄 클릭 → Windows 소리 설정 바로 이동 (연결/미연결 무관)
micStatusRow.addEventListener('click', () => {
  shell.openExternal('ms-settings:sound');
});
btnHistory.addEventListener('click',  onHistory);
btnOpenDir.addEventListener('click',  onOpenDir);
btnPlayLast.addEventListener('click', onPlayLast);
btnDrawing.addEventListener('click',  onDrawing);
btnSettings.addEventListener('click', onSettings);

btnMin.addEventListener('click',   () => remote.getCurrentWindow().minimize());
btnClose.addEventListener('click', async () => {
  if (_status === 'recording' || _status === 'paused') {
    const confirmed = await MessageBox.confirm(MSG.M041, {
      title      : MSG.M040,
      detail     : MSG.M042,
      type       : 'question',
      cancelLabel: MSG.M043,
      okLabel    : MSG.M044,
    });
    if (!confirmed) return;
    if (isDrawingOpen()) closeDrawingWindow();
    if (_micOn) recorder.disableAudio();
    if (recorder.getStatus() !== 'idle') recorder.stop().catch(() => {});
    remote.getCurrentWindow().close();
    return;
  }
  remote.getCurrentWindow().close();
});

// ── IPC 수신: 드로잉 창 직접 종료 감지 ──────────────────────────────────────
ipcRenderer.on('drawing-closed', () => {
  btnDrawing.classList.remove('drawing-on');
  if (_status === 'recording' || _status === 'paused') {
    btnDrawing.title = MSG.M014;
  }
});

// ── IPC 수신: 드로잉 창에서 F9 단축키 → 녹화 종료 ────────────────────────────
// ── 테마 미리보기 폴링 (400ms) ────────────────────────────────────────────────
let _appliedTheme = theme;

// ── IPC 수신: 테마 변경 (setTheme() 브로드캐스트) ────────────────────────────
// setTheme() 은 녹화 중 포함 언제든 호출 가능합니다.
// _appliedTheme 을 갱신해 이후 열리는 자식 팝업(히스토리·설정·드로잉)도 새 테마로 열립니다.
// bgColor 는 setTheme() 이 창 타입별로 계산해 전달합니다.
ipcRenderer.on('theme-change', (_, newTheme, bgColor) => {
  _appliedTheme = newTheme;
  document.body.classList.toggle('light', newTheme === 'light');
  if (bgColor) remote.getCurrentWindow().setBackgroundColor(bgColor);
});

// ── 테마 미리보기 폴링 (400ms) — 하위 호환 유지 ──────────────────────────────
// 설정 팝업 개인화 기능이 복원될 경우를 대비해 폴링은 유지합니다.
// idle 가드를 제거해 녹화 중에도 store 경유 변경을 반영합니다.
setInterval(() => {
  if (!sessionKey) return;
  const previewTheme = store.get(`${sessionKey}_themePreview`, null);
  if (previewTheme && previewTheme !== _appliedTheme) {
    _appliedTheme = previewTheme;
    document.body.classList.toggle('light', previewTheme === 'light');
    remote.getCurrentWindow().setBackgroundColor(getThemeInfo(previewTheme, 'panel').BGCOL);
  }
}, 400);

// ── 초기화 ───────────────────────────────────────────────────────────────────
_initTexts();
setUIStatus('idle');
syncStore();

// 마이크 장치 상시 폴링 시작 (대기 중/녹화 중 구분 없이 1초 간격, 앱 종료까지 유지)
startMicWatch();

// ── 단축키 ────────────────────────────────────────────────────────────────────
/**
 * 전역 키보드 단축키를 처리합니다.
 *
 * | 키 | 동작          | 활성 상태              |
 * |----|--------------|------------------------|
 * | F8 | 녹화 시작     | idle 상태일 때만 동작   |
 * | F9 | 녹화 종료     | recording / paused 때  |
 *
 * 향후 단축키 추가 시 SHORTCUT_MAP 에 항목만 등록하면 됩니다.
 *
 * @example
 *   SHORTCUT_MAP['F10'] = { label: '일시정지', handler: togglePause, states: ['recording'] };
 */
const SHORTCUT_MAP = {
  F8: {
    label   : '녹화 시작',
    handler : startRecording,
    states  : ['idle'],          // 이 상태일 때만 실행
  },
  F9: {
    label   : '녹화 종료',
    handler : stopRecording,
    states  : ['recording', 'paused'],
  },
};

window.addEventListener('keydown', (e) => {
  // ── 패널 자체 단축키 처리 ────────────────────────────────────────────────────
  const shortcut = SHORTCUT_MAP[e.key];
  if (shortcut) {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      if (shortcut.states.includes(_status)) {
        e.preventDefault();
        shortcut.handler();
        return; // 패널 단축키는 드로잉 창으로 전달하지 않음
      }
    }
  }

  // ── 드로잉 창 단축키 IPC 포워딩 ─────────────────────────────────────────────
  // 드로잉 창은 focusable:false 이므로 OS 포커스가 없어 native keydown 이 도달하지 않습니다.
  // 컨트롤 패널이 포커스를 유지하므로 여기서 키를 받아 드로잉 창으로 전달합니다.
  // IME 조합 중(isComposing)에는 전달하지 않습니다.
  if (!isDrawingOpen() || e.isComposing) return;
  const drawingWcId = store.get('__drawing_wc_id__', null);
  if (!drawingWcId) return;
  const drawingWc = remote.webContents.fromId(drawingWcId);
  if (!drawingWc || drawingWc.isDestroyed()) return;
  drawingWc.send('drawing-keydown', {
    key     : e.key,
    ctrlKey : e.ctrlKey,
    metaKey : e.metaKey,
    shiftKey: e.shiftKey,
  });
});

// ── 패널 포커스 감지: drawing 창에서 z-order 재확보 타이밍 판단에 사용 ────────
// 패널이 이동/클릭으로 포커스를 받으면 store 에 플래그를 저장합니다.
// drawing/index.js 가 텍스트 모드 클릭 시 이 플래그를 확인해 _forceRaisePanelOnTop 호출 여부를 결정합니다.

