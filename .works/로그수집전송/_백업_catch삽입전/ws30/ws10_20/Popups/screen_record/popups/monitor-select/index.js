/**
 * @file popups/monitor-select/index.js
 * @description monitor-select/index.html 의 모든 JavaScript 로직.
 *
 * ── 렌더링 기준 변경 (getSources → getAllDisplays) ──────────────────────────
 *  구 방식: desktopCapturer.getSources() 기준으로 카드 생성
 *           → Thunderbolt/USB-C 등 Chromium 미인식 모니터 누락
 *
 *  현재 방식: screen.getAllDisplays() 기준으로 카드 생성
 *           → 모든 연결 모니터를 항상 표시
 *           → getSources 매칭 실패 시 "녹화 불가" 안내 카드로 표시
 *
 * ── sourceId 매칭 전략 ────────────────────────────────────────────────────
 *  1순위: src.display_id === String(display.id)  (정확한 매칭)
 *  2순위: display_id 정보 없는 환경 + 개수 동일 → 인덱스 매칭
 *  미매칭: null 반환 → 비활성(녹화 불가) 카드
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

const path   = require('path');
const remote = require('@electron/remote');

const params     = WSUTIL.QueryString.parse(location.href);
const theme      = params.theme      || 'dark';
const sessionKey = params.sessionKey || '';
const USERINFO   = params.USERINFO   || {};
const browserKey = params.browserKey || '';

if (theme === 'light') document.body.classList.add('light');

const store = remote.require(path.join(__dirname, '../../core/store'));
const { screen, desktopCapturer } = remote;

// ── DOM ───────────────────────────────────────────────────────────────────────
const loadingEl  = document.getElementById('loading');
const gridEl     = document.getElementById('grid');
const btnX       = document.getElementById('btnX');
const btnCancel  = document.getElementById('btnCancel');
const btnConfirm = document.getElementById('btnConfirm');


// ── HTML 정적 텍스트 초기화 ───────────────────────────────────────────────────
/**
 * HTML에 하드코딩된 정적 텍스트를 MSG로 초기화합니다.
 */
function _initTexts() {
  document.title = MSG.M004;
  document.getElementById('titleLbl').textContent    = MSG.M004;
  document.getElementById('subtitleLbl').textContent = MSG.M005;
  document.getElementById('loadingText').textContent = MSG.M006;
  document.getElementById('btnConfirmLbl').textContent = MSG.M007;
  document.getElementById('btnCancel').textContent   = MSG.M008;
}

// ── 상태 ──────────────────────────────────────────────────────────────────────
let _sources        = [];   // desktopCapturer.getSources() 결과
let _displays       = [];   // screen.getAllDisplays() 결과
let _selectedDispIdx = -1;  // 선택된 display 인덱스 (_displays 기준)

// ── 데이터 로드 ────────────────────────────────────────────────────────────────
/**
 * 디스플레이 목록과 캡처 소스를 로드합니다.
 * getAllDisplays() 기준으로 카드를 렌더링하고,
 * getSources()는 sourceId 매핑 용도로만 사용합니다.
 */
async function loadDisplays() {
  try {
    _displays = screen.getAllDisplays();
    _sources  = await desktopCapturer.getSources({
      types        : ['screen'],
      thumbnailSize: { width: 480, height: 270 },
    });
    renderGrid();
  } catch (err) {
    loadingEl.innerHTML = `<span style="color:var(--danger);font-size:12px">${MSG.M001}: ${err.message}</span>`;
  }
}

/**
 * 디스플레이에 매칭되는 캡처 소스를 반환합니다.
 *
 * 매칭 전략:
 *  1순위: src.display_id === String(display.id)  — Electron이 id를 제공하는 환경
 *  2순위: display_id 정보가 없는 환경에서 개수가 같을 때만 인덱스로 매칭
 *  미매칭: null 반환 (녹화 불가 카드로 표시)
 *
 * @param {Electron.Display} display
 * @param {number}           displayIdx - _displays 내 인덱스
 * @returns {DesktopCapturerSource|null}
 */
function findSourceForDisplay(display, displayIdx) {
  // 1순위: display_id 정확 매칭
  const byId = _sources.find(
    s => s.display_id && String(s.display_id) === String(display.id)
  );
  if (byId) return byId;

  // 2순위: 어떤 소스도 display_id 를 제공하지 않는 환경 (구형 Electron 등)
  //        개수가 동일할 때만 인덱스 매칭 — 개수 불일치 시 오매칭 방지
  const hasAnyDisplayId = _sources.some(s => s.display_id);
  if (!hasAnyDisplayId && _displays.length === _sources.length) {
    return _sources[displayIdx] || null;
  }

  return null;
}

/**
 * 모니터 카드 목록을 렌더링합니다.
 * screen.getAllDisplays() 기준으로 순회하여 모든 모니터를 표시합니다.
 * sourceId 매칭 실패 시 녹화 불가 카드를 생성합니다.
 */
function renderGrid() {
  loadingEl.style.display = 'none';
  gridEl.style.display    = 'grid';
  gridEl.innerHTML        = '';

  const primaryDisplay = screen.getPrimaryDisplay();

  _displays.forEach((display, idx) => {
    const src        = findSourceForDisplay(display, idx);
    const isPrimary  = display.id === primaryDisplay.id;
    const isSupported = !!src;
    const thumbUrl   = src?.thumbnail?.toDataURL();
    const res        = `${display.bounds.width} × ${display.bounds.height}`;
    const label      = `${MSG.M002} ${idx + 1}`;

    const card = document.createElement('div');
    card.className   = 'mon-card' + (isSupported ? '' : ' unsupported');
    card.dataset.idx = idx;

    card.innerHTML = `
      <div class="check-mark">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="thumb">
        ${isSupported && thumbUrl && thumbUrl !== 'data:image/png;base64,'
          ? `<img src="${thumbUrl}" alt="thumb">`
          : `<div class="thumb-ph">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                 <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
               </svg>
             </div>`
        }
        ${!isSupported ? `
          <div class="unsupported-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            <span>${MSG.M009}</span>
          </div>` : ''
        }
      </div>
      <div class="mon-info">
        <div class="mon-name">${label}</div>
        <div class="mon-meta">
          <span class="badge badge-num">#${idx + 1}</span>
          <span class="mon-res">${res}</span>
          ${isPrimary  ? `<span class="badge badge-primary">${MSG.M003}</span>` : ''}
        </div>
      </div>`;

    // 지원 카드만 클릭 이벤트 등록
    if (isSupported) {
      card.addEventListener('click',    () => selectCard(idx));
      card.addEventListener('dblclick', () => { selectCard(idx); confirmSelect(); });
    }

    gridEl.appendChild(card);
  });

  // 주 모니터를 기본 선택 (지원되는 경우), 아니면 첫 번째 지원 모니터 선택
  const primaryIdx    = _displays.findIndex(d => d.id === primaryDisplay.id);
  const primarySrc    = primaryIdx >= 0 ? findSourceForDisplay(_displays[primaryIdx], primaryIdx) : null;
  const defaultIdx    = primarySrc
    ? primaryIdx
    : _displays.findIndex((d, i) => !!findSourceForDisplay(d, i));

  if (defaultIdx >= 0) selectCard(defaultIdx);
}

/**
 * 카드를 선택합니다.
 * @param {number} displayIdx - _displays 기준 인덱스
 */
function selectCard(displayIdx) {
  _selectedDispIdx = displayIdx;
  document.querySelectorAll('.mon-card').forEach((c, i) =>
    c.classList.toggle('selected', i === displayIdx));
  btnConfirm.disabled = false;
}

/**
 * 선택을 확정하고 창을 닫습니다.
 */
function confirmSelect() {
  if (_selectedDispIdx < 0) return;

  const display = _displays[_selectedDispIdx];
  const src     = findSourceForDisplay(display, _selectedDispIdx);
  if (!src) return; // 비활성 카드는 클릭 자체가 막혀 있어 정상 경로에서 도달 불가

  store.set(sessionKey, { display, sourceId: src.id, sourceName: src.name });
  window.close();
}

/**
 * 취소하고 창을 닫습니다.
 */
function cancel() {
  store.set(sessionKey, null);
  window.close();
}

// ── 이벤트 ───────────────────────────────────────────────────────────────────
btnX.addEventListener('click',       cancel);
btnCancel.addEventListener('click',  cancel);
btnConfirm.addEventListener('click', confirmSelect);

document.addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmSelect();
  if (e.key === 'Escape') cancel();
});

// ── 시작 ──────────────────────────────────────────────────────────────────────
_initTexts();
loadDisplays();
