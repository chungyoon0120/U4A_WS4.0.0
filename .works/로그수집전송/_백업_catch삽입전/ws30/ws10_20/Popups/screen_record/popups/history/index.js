/**
 * @file popups/history/index.js
 * @description 녹화 히스토리 — 리스트 레이아웃 버전
 *   - 썸네일(160×90) + 파일명 + 날짜 + 크기 + 경로 + 재생 버튼
 *   - <video> 태그로 hover 시 미리보기 재생
 *   - fs.watch 자동 갱신 + 수동 새로고침
 *   - 설정 팝업 themePreview 폴링 (panelSessionKey 사용)
 */

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);

'use strict';

const MSG = require('./msg');

const fs     = require('fs');
const path   = require('path');
const remote = require('@electron/remote');
const { ipcRenderer }   = require('electron');
const { shell } = remote;
const { pathToFileURL } = require('url');

// 공통 UI 메시지 모듈 (electron dialog 대체)
const { MessageBox } = require(path.join(__dirname, '../shared/ui-message'));

const params          = WSUTIL.QueryString.parse(location.href);
const theme           = params.theme           || 'dark';
const sessionKey      = params.sessionKey      || '';
const panelSessionKey = params.panelSessionKey || '';
const USERINFO        = params.USERINFO        || {};
const browserKey      = params.browserKey      || '';

if (theme === 'light') document.body.classList.add('light');

const store     = remote.require(path.join(__dirname, '../../core/store'));
const outputDir = store.get(`${sessionKey}_outputDir`,   '');
const newFile   = store.get(`${sessionKey}_newFilePath`, '');

// ── DOM ───────────────────────────────────────────────────────────────────────
const titlebarDir = document.getElementById('titlebarDir');
const summaryBar  = document.getElementById('summaryBar');
const sumCount    = document.getElementById('sumCount');
const sumSize     = document.getElementById('sumSize');
const watchBadge  = document.getElementById('watchBadge');
const watchText   = document.getElementById('watchText');
const loadingScr  = document.getElementById('loadingScreen');
const emptyScr    = document.getElementById('emptyScreen');
const listEl      = document.getElementById('list');
const btnRefresh  = document.getElementById('btnRefresh');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnCloseWin = document.getElementById('btnCloseWin');
const btnClose    = document.getElementById('btnClose');


// ── HTML 정적 텍스트 초기화 ───────────────────────────────────────────────────
/**
 * HTML에 하드코딩된 정적 텍스트를 MSG로 초기화합니다.
 */
function _initTexts() {
  document.title = MSG.M020;
  document.getElementById('titleLbl').textContent        = MSG.M020;
  document.getElementById('btnOpenFolderLbl').textContent= MSG.M021;
  document.getElementById('btnRefreshLbl').textContent   = MSG.M022;
  document.getElementById('sumWord').textContent         = MSG.M023;
  document.getElementById('sumUnit').textContent         = MSG.M024;
  document.getElementById('sumTotalWord').textContent    = MSG.M025;
  document.getElementById('watchText').textContent       = MSG.M026;
  document.getElementById('loadingText').textContent     = MSG.M027;
  document.getElementById('emptyText').textContent       = MSG.M028;
  document.getElementById('btnClose').textContent        = MSG.M029;
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function fmtSize(b) {
  if (b < 1024)       return `${b} B`;
  if (b < 1024*1024)  return `${(b/1024).toFixed(1)} KB`;
  return `${(b/(1024*1024)).toFixed(1)} MB`;
}
function fmtDate(d) {
  return d.toLocaleString('ko-KR', {
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit',
  });
}
function fmtDuration(s) {
  if (!isFinite(s) || s <= 0) return null;
  const t = Math.round(s);
  const h = Math.floor(t/3600), m = Math.floor((t%3600)/60), r = t%60;
  return h
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

// ── 파일 스캔 ──────────────────────────────────────────────────────────────────
function scanFiles() {
  try {
    if (!fs.existsSync(outputDir)) return [];
    return fs.readdirSync(outputDir)
      .filter(f => /\.(webm|mp4|mkv|avi|mov)$/i.test(f))
      .map(f => {
        const fp = path.join(outputDir, f);
        const st = fs.statSync(fp);
        return { filePath: fp, fileName: f, size: st.size, mtime: st.mtime };
      })
      .filter(info => info.size > 0)  // 0바이트 파일 제외 (비정상 종료 파일 → Range 요청 에러 방지)
      .sort((a, b) => b.mtime - a.mtime);
  } catch { return []; }
}

// ── 리스트 아이템 생성 ─────────────────────────────────────────────────────────
/**
 * @param {{ filePath, fileName, size, mtime }} info
 * @param {boolean} isNew
 * @returns {HTMLElement}
 */
function createItem(info, isNew) {
  const { filePath, fileName, size, mtime } = info;
  const fileUrl = pathToFileURL(filePath).href;

  const item = document.createElement('div');
  item.className = `list-item${isNew ? ' is-new' : ''}`;

  item.innerHTML = `
    ${isNew ? '<div class="new-badge">NEW</div>' : ''}

    <!-- 썸네일 -->
    <div class="thumb-wrap">
      <video class="thumb-video" src="${fileUrl}" preload="metadata" muted playsinline loop></video>
      <div class="thumb-overlay">
        <div class="play-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
    </div>

    <!-- 정보 -->
    <div class="info">
      <div class="info-name" title="${fileName}">${fileName}</div>

      <div class="info-row">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span class="info-label">${MSG.M001} :</span>
        <span>${fmtDate(mtime)}</span>
        <div class="info-sep"></div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span class="info-label">${MSG.M002} :</span>
        <span>${fmtSize(size)}</span>
        <span class="dur-text"></span>
      </div>

      <div class="info-path" title="${filePath}">${filePath}</div>

      <div class="info-actions">
        <button class="btn-play" data-path="${filePath}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          ${MSG.M004}
        </button>
        <button class="btn-reveal" data-path="${filePath}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          ${MSG.M005}
        </button>
        <button class="btn-delete" data-path="${filePath}" data-name="${fileName}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          ${MSG.M006}
        </button>
      </div>
    </div>`;

  // ── video 이벤트 ──────────────────────────────────────────────────────────
  const video = item.querySelector('.thumb-video');
  const durEl  = item.querySelector('.dur-text');

  video.addEventListener('loadedmetadata', () => {
    video.currentTime = isFinite(video.duration) && video.duration > 0
      ? Math.min(video.duration * 0.1, 2.0)
      : 0;
    const dur = fmtDuration(video.duration);
    if (dur && durEl) {
      durEl.innerHTML = `<div class="info-sep"></div>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span class="info-label">${MSG.M003} :</span>
        <span>${dur}</span>`;
    }
  });

  item.addEventListener('mouseenter', () => video.play().catch(() => {}));
  item.addEventListener('mouseleave', () => {
    video.pause();
    if (isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(video.duration * 0.1, 2.0);
    }
  });

  // ── 버튼 이벤트 ───────────────────────────────────────────────────────────
  item.querySelector('.btn-play').addEventListener('click', (e) => {
    e.stopPropagation();
    shell.openPath(e.currentTarget.dataset.path);
  });
  item.querySelector('.btn-reveal').addEventListener('click', (e) => {
    e.stopPropagation();
    shell.showItemInFolder(e.currentTarget.dataset.path);
  });
  item.querySelector('.btn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteFile(e.currentTarget.dataset.path, e.currentTarget.dataset.name, item);
  });

  return item;
}

// ── 목록 렌더링 ───────────────────────────────────────────────────────────────
/**
 * listEl 을 비우기 전에 기존 <video> 요소의 src를 명시 해제합니다.
 * Chromium은 DOM에서 제거된 video 요소라도 내부 네트워크 큐에 남아
 * 미디어 소스를 재시도하두로, 파일명 변경/삭제 후 ERR_FILE_NOT_FOUND가
 * 반복 출력되는 문제를 방지합니다.
 */
function _clearVideoSources() {
  listEl.querySelectorAll('video').forEach(v => {
    v.pause();
    v.src   = '';
    v.load();
  });
}

function renderList() {
  titlebarDir.textContent = outputDir;
  titlebarDir.title       = outputDir;

  const files = scanFiles();

  loadingScr.classList.remove('visible');

  if (files.length === 0) {
    _clearVideoSources();
    listEl.innerHTML = '';
    summaryBar.style.display = 'none';
    emptyScr.classList.add('visible');
    return;
  }

  emptyScr.classList.remove('visible');
  summaryBar.style.display = 'flex';
  sumCount.textContent = files.length;
  sumSize.textContent  = fmtSize(files.reduce((s, f) => s + f.size, 0));

  _clearVideoSources();
  listEl.innerHTML = '';
  const normNew = newFile.replace(/\\/g, '/').toLowerCase();
  files.forEach(info => {
    const isNew = normNew && info.filePath.replace(/\\/g, '/').toLowerCase() === normNew;
    listEl.appendChild(createItem(info, isNew));
  });
}

// ── 파일 삭제 ────────────────────────────────────────────────────────────────

/**
 * 파일 삭제를 처리합니다.
 *
 * 녹화 중인 파일 삭제 시도 처리:
 *   - panelSessionKey 로 현재 녹화 상태와 파일 경로를 확인
 *   - 녹화 중인 파일이면 경고 메시지를 표시하고 삭제 차단
 *   - Windows 파일 잠금(EBUSY) 오류도 동일하게 처리
 *
 * @param {string}      filePath  - 삭제할 파일 전체 경로
 * @param {string}      fileName  - 파일명 (메시지용)
 * @param {HTMLElement} itemEl    - 목록에서 제거할 DOM 요소
 */
async function deleteFile(filePath, fileName, itemEl) {
  // ── 녹화 중인 파일인지 확인 ──────────────────────────────────────────────
  if (panelSessionKey) {
    const status     = store.get(`${panelSessionKey}_status`, 'idle');
    const cfg        = store.get(`${panelSessionKey}_config`, {});
    const recPath     = cfg.outputDir && cfg.fileName
      ? path.join(cfg.outputDir, cfg.fileName)
      : null;
    const isRecording = (status === 'recording' || status === 'paused');
    // split/join 으로 경로 구분자 통일 (정규식 이스케이프 이슈 우회)
    const normRec  = recPath  ? recPath.split('\\').join('/').split('/').join('/').toLowerCase() : null;
    const normFile = filePath.split('\\').join('/').split('/').join('/').toLowerCase();
    const isSameFile = normRec && normRec === normFile;

    if (isRecording && isSameFile) {
      await MessageBox.alert(MSG.M008, { title: MSG.M007, detail: MSG.M020, type: 'warning' });
      return;
    }
  }

  // ── 삭제 확인 다이얼로그 ──────────────────────────────────────────────────
  const confirmed = await MessageBox.confirm(`"${fileName}" ${MSG.M011}`, {
    title      : MSG.M010,
    detail     : MSG.M012,
    type       : 'question',
    cancelLabel: MSG.M017,
    okLabel    : MSG.M006,
  });

  if (!confirmed) return;

  // ── 실제 삭제 ─────────────────────────────────────────────────────────────
  try {
    fs.unlinkSync(filePath);
    // DOM에서 즉시 제거
    itemEl.style.transition = 'opacity 0.25s, transform 0.25s';
    itemEl.style.opacity    = '0';
    itemEl.style.transform  = 'translateX(20px)';
    setTimeout(() => {
      itemEl.remove();
      // 목록이 비었으면 emptyScreen 표시
      if (listEl.children.length === 0) {
        summaryBar.style.display = 'none';
        emptyScr.classList.add('visible');
      } else {
        // 요약 카운트 갱신
        const files = scanFiles();
        sumCount.textContent = files.length;
        sumSize.textContent  = fmtSize(files.reduce((s, f) => s + f.size, 0));
      }
    }, 260);
  } catch (err) {
    // EBUSY: 파일이 다른 프로세스에서 사용 중 (e.g. 동영상 플레이어)
    const msg = err.code === 'EBUSY'
      ? MSG.M013
      : (MSG.M014 + ': ' + err.message);
    await MessageBox.alert(msg, { title: MSG.M015, type: 'error' });
  }
}

// ── 새로고침 ──────────────────────────────────────────────────────────────────
let _pending = false;
function refresh(spin = false) {
  if (_pending) return;
  _pending = true;
  if (spin) btnRefresh.classList.add('refreshing');
  setTimeout(() => {
    renderList();
    _pending = false;
    btnRefresh.classList.remove('refreshing');
  }, spin ? 300 : 800);
}

// ── fs.watch ──────────────────────────────────────────────────────────────────
let _watcher = null, _debounce = null;
function startWatching() {
  if (!outputDir || !fs.existsSync(outputDir)) {
    watchBadge.classList.add('error');
    watchText.textContent = MSG.M018;
    return;
  }
  try {
    _watcher = fs.watch(outputDir, { persistent: false }, (_, fn) => {
      if (fn && !/\.(webm|mp4|mkv|avi|mov)$/i.test(fn)) return;
      clearTimeout(_debounce);
      _debounce = setTimeout(() => refresh(false), 1200);
    });
    _watcher.on('error', () => {
      watchBadge.classList.add('error');
      watchText.textContent = MSG.M019;
      stopWatching();
    });
  } catch {
    watchBadge.classList.add('error');
    watchText.textContent = MSG.M018;
  }
}
function stopWatching() {
  clearTimeout(_debounce);
  if (_watcher) { _watcher.close(); _watcher = null; }
}

// ── 테마 실시간 폴링 ──────────────────────────────────────────────────────────
let _appliedTheme  = theme;
let _themeTimer    = null;
if (panelSessionKey) {
  _themeTimer = setInterval(() => {
    const pt = store.get(`${panelSessionKey}_themePreview`, null);
    if (pt !== null && pt !== _appliedTheme) {
      _appliedTheme = pt;
      document.body.classList.toggle('light', pt === 'light');
    }
  }, 400);
}

// ── IPC 수신: 테마 변경 (setTheme() 브로드캐스트) ────────────────────────────
// 폴링과 이중화. 녹화 중 포함 즉시 반영됩니다.
ipcRenderer.on('theme-change', (_, newTheme, bgColor) => {
  _appliedTheme = newTheme;
  document.body.classList.toggle('light', newTheme === 'light');
  if (bgColor) remote.getCurrentWindow().setBackgroundColor(bgColor);
});

// ── 이벤트 ───────────────────────────────────────────────────────────────────
btnRefresh.addEventListener('click',    () => refresh(true));
btnOpenFolder.addEventListener('click', () => shell.openPath(outputDir));
btnCloseWin.addEventListener('click',   () => window.close());
btnClose.addEventListener('click',      () => window.close());
document.addEventListener('keydown', e => { if (e.key === 'Escape') window.close(); });
window.addEventListener('beforeunload', () => {
  stopWatching();
  if (_themeTimer) { clearInterval(_themeTimer); _themeTimer = null; }
});

// ── 시작 ──────────────────────────────────────────────────────────────────────
_initTexts();
renderList();
startWatching();
