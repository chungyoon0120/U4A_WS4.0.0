/**
 * @file popups/drawing/index.js
 * @description 드로잉 오버레이 — 펜/도형 도구 + 텍스트 박스
 *
 * ── 텍스트 박스 아키텍처 ────────────────────────────────────────────────────
 *  • 텍스트 입력    : text-input 팝업 창 (독립 BrowserWindow)
 *  • 오브젝트 모드  : 선택·이동·리사이즈·회전 (클릭 선택, 드래그 이동)
 *  • 텍스트 수정    : 더블클릭 또는 Enter/F2 → text-input 팝업 재오픈
 *
 * ── 포커스 정책 ──────────────────────────────────────────────────────────────
 *  • drawWin 은 항상 focusable:false 고정 — OS 포커스를 절대 가져오지 않습니다.
 *  • 텍스트 입력은 독립 팝업이 OS 포커스를 처리합니다.
 *  • 컨트롤 패널과의 포커스 충돌이 구조적으로 발생하지 않습니다.
 */

const
    REMOTE   = require('@electron/remote'),
    APP      = REMOTE.app,
    PATH     = require('path'),
    APPPATH  = APP.getAppPath(),
    PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
    WSUTIL   = require(PATHINFO.WSUTIL);

'use strict';

const path            = require('path');
const remote          = require('@electron/remote');
const { ipcRenderer } = require('electron');
const store           = remote.require(path.join(__dirname, '../../core/store'));
// [2026-10-30 장군님 지시] require·module 조작을 걷어내려고 상대경로 → __dirname 절대경로.
const textInputModule = require(path.join(__dirname, 'text-input', 'window'));
// [2026-10-30 장군님 지시] require·module 조작을 걷어내려고 상대경로 → __dirname 절대경로.
const MSG             = require(path.join(__dirname, 'msg'));

const params     = WSUTIL.QueryString.parse(location.href);
const theme      = params.theme      || 'dark';
const sessionKey = params.sessionKey || '';
const USERINFO   = params.USERINFO   || {};
const browserKey = params.browserKey || '';

if (theme === 'light') document.body.classList.add('light');

// ── Canvas ────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('drawCanvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  tmp.getContext('2d').drawImage(canvas, 0, 0);
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  ctx.drawImage(tmp, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── 공유 상태 ─────────────────────────────────────────────────────────────────
const _state = {
  tool    : 'pen',
  color   : '#FF3B30',
  size    : 4,
  opacity : 1.0,
  fontSize: 24,
  drawing : false,
  startX:0, startY:0, lastX:0, lastY:0,
  snapshot: null,
};

const MAX_HISTORY = 30;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const btnPen          = document.getElementById('btnPen');
const btnLine         = document.getElementById('btnLine');
const btnRect         = document.getElementById('btnRect');
const btnCircle       = document.getElementById('btnCircle');
const btnEraser       = document.getElementById('btnEraser');
const btnText         = document.getElementById('btnText');
const textObjectLayer = document.getElementById('textObjectLayer');
const tboxPreview     = document.getElementById('tboxPreview');
const rangeSize       = document.getElementById('rangeSize');
const sizeDot         = document.getElementById('sizeDot');
const rangeOpacity    = document.getElementById('rangeOpacity');
const btnUndo         = document.getElementById('btnUndo');
const btnClear        = document.getElementById('btnClear');
const btnCloseDraw    = document.getElementById('btnCloseDraw');
const colorPicker     = document.getElementById('colorPicker');

// ── 메시지 초기화 ──────────────────────────────────────────────────────────────
/**
 * 공통 메시지 상수(MSG)를 DOM 요소에 주입합니다.
 * 하드코딩 텍스트를 제거하고 MSG 파일을 단일 진실 공급원으로 사용합니다.
 */
function _initMessages() {
  btnPen.title       = MSG.M001;
  btnLine.title      = MSG.M002;
  btnRect.title      = MSG.M003;
  btnCircle.title    = MSG.M004;
  btnEraser.title    = MSG.M005;
  btnText.title      = MSG.M006;
  document.getElementById('rangeSize').title    = MSG.M007;
  document.getElementById('rangeOpacity').title = MSG.M016;
  btnUndo.title      = MSG.M017;
  btnClear.title     = MSG.M018;
  btnCloseDraw.title = MSG.M019;

  // 투명도 레이블 (화면에 직접 표시되는 텍스트)
  document.getElementById('opacityLbl').textContent = MSG.M015;

  // 색상 팔레트 툴팁
  const swatchTitles = [MSG.M008, MSG.M009, MSG.M010, MSG.M011, MSG.M012, MSG.M013];
  document.querySelectorAll('.color-swatch').forEach((el, i) => {
    if (swatchTitles[i]) el.title = swatchTitles[i];
  });
  const colorPickerWrap = document.querySelector('.color-picker-wrap');
  if (colorPickerWrap) colorPickerWrap.title = MSG.M014;
}
_initMessages();


const { screen, BrowserWindow: BW } = remote;
const drawWin = remote.getCurrentWindow();

// ── 패널 포커스 보장 ──────────────────────────────────────────────────────────
/**
 * 비텍스트 도구 사용 시 컨트롤 패널 포커스를 보장합니다.
 *
 * drawWin 은 항상 focusable:false 이므로 캔버스 클릭이 포커스를 가져오지 않습니다.
 * 단축키 IPC 포워딩은 컨트롤 패널이 포커스를 갖고 있어야 동작합니다.
 */
function _ensurePanelFocus() {
  if (!sessionKey) return;
  const panelWinId = store.get(`${sessionKey}_panelWinId`, null);
  if (!panelWinId) return;
  const panelWin = BW.fromId(panelWinId);
  if (!panelWin || panelWin.isDestroyed()) return;
  if (!panelWin.isFocused()) panelWin.focus();
}

// ── Canvas 스타일 / 히스토리 ──────────────────────────────────────────────────
function applyStyle() {
  ctx.strokeStyle = _state.tool === 'eraser' ? 'rgba(0,0,0,1)' : _state.color;
  ctx.lineWidth   = _state.tool === 'eraser' ? _state.size * 3  : _state.size;
  ctx.globalAlpha = _state.tool === 'eraser' ? 1                : _state.opacity;
  ctx.globalCompositeOperation = _state.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}

/** 캔버스 상태를 통합 히스토리에 저장합니다. (드로잉 도구 사용 전 호출) */
function saveHistory() {
  _actionLog.push({ type: 'canvas', data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
  if (_actionLog.length > MAX_HISTORY) _actionLog.shift();
}

/** 텍스트 박스 생성을 통합 히스토리에 저장합니다. */
function _saveTboxAction(id) {
  _actionLog.push({ type: 'tbox', id });
  if (_actionLog.length > MAX_HISTORY) _actionLog.shift();
}

// ── 도구 선택 ─────────────────────────────────────────────────────────────────
const TOOL_BTNS = { pen:btnPen, line:btnLine, rect:btnRect, circle:btnCircle, eraser:btnEraser, text:btnText };

function selectTool(tool) {
  if (_state.tool === 'text' && tool !== 'text') {
    // 메모 팝업은 드로잉 도구와 독립적으로 동작하므로 닫지 않음
    _tboxDeselectAll();
    textObjectLayer.style.pointerEvents = 'none';   // 펜/도형 모드: 이벤트 차단
  }
  if (tool === 'text' && _state.tool !== 'text') {
    textObjectLayer.style.pointerEvents = '';        // 텍스트 모드: 이벤트 복원
  }
  _state.tool = tool;
  Object.entries(TOOL_BTNS).forEach(([t, btn]) => btn.classList.toggle('active', t === tool));
  document.body.classList.toggle('eraser',    tool === 'eraser');
  document.body.classList.toggle('text-mode', tool === 'text');
}

/**
 * 색상을 선택합니다.
 * 다음 텍스트 생성에 적용됩니다.
 * @param {string} color
 */
function selectColor(color) {
  _state.color = color;
  document.querySelectorAll('.color-swatch').forEach(el =>
    el.classList.toggle('active', el.dataset.color === color));
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

// ── 컨트롤 패널 Pass-Through ──────────────────────────────────────────────────
function isInPanelBounds(cx, cy) {
  if (!sessionKey) return false;
  const b = store.get(`${sessionKey}_panelBounds`, null);
  if (!b) return false;
  return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
}

let _isPassThrough = false;
let _pollTimer     = null;

function _startPollExit() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => {
    const pt     = screen.getCursorScreenPoint();
    const storeM = remote.require(path.join(__dirname, '../../core/store'));
    const cfg    = storeM.get(`${sessionKey}_config`, {});
    if (!cfg.display) return;
    const rx = pt.x - cfg.display.bounds.x;
    const ry = pt.y - cfg.display.bounds.y;
    if (!isInPanelBounds(rx, ry)) {
      _isPassThrough = false;
      drawWin.setIgnoreMouseEvents(false);
      clearInterval(_pollTimer); _pollTimer = null;
    }
  }, 80);
}

document.addEventListener('mousemove', (e) => {
  if (_isPassThrough) return;
  if (!isInPanelBounds(e.clientX, e.clientY)) return;
  _isPassThrough = true;
  drawWin.setIgnoreMouseEvents(true);
  if (_state.drawing) { _state.drawing = false; _state.snapshot = null; ctx.beginPath(); }
  _startPollExit();
});

// ── 캔버스 마우스 이벤트 ─────────────────────────────────────────────────────
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (_isPassThrough)  return;
  if (_state.tool === 'text') return; // 텍스트 모드는 document.mousedown 에서 처리

  // 비텍스트 도구: 외부 앱 클릭 등으로 패널이 포커스를 잃었을 경우 복원
  _ensurePanelFocus();

  const { x, y } = getPos(e);
  saveHistory(); applyStyle();
  _state.drawing = true;
  _state.startX = x; _state.startY = y; _state.lastX = x; _state.lastY = y;

  if (['line','rect','circle'].includes(_state.tool)) {
    _state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  if (_state.tool === 'pen' || _state.tool === 'eraser') { ctx.beginPath(); ctx.moveTo(x, y); }
});

canvas.addEventListener('mousemove', (e) => {
  if (!_state.drawing || _isPassThrough) return;
  const { x, y } = getPos(e);
  applyStyle();
  switch (_state.tool) {
    case 'pen': case 'eraser':
      ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); break;
    case 'line':
      ctx.putImageData(_state.snapshot, 0, 0); ctx.beginPath();
      ctx.moveTo(_state.startX, _state.startY); ctx.lineTo(x, y); ctx.stroke(); break;
    case 'rect':
      ctx.putImageData(_state.snapshot, 0, 0); ctx.beginPath();
      ctx.strokeRect(_state.startX, _state.startY, x - _state.startX, y - _state.startY); break;
    case 'circle': {
      ctx.putImageData(_state.snapshot, 0, 0);
      const rx = Math.abs(x - _state.startX) / 2, ry = Math.abs(y - _state.startY) / 2;
      const cx = _state.startX + (x - _state.startX) / 2, cy = _state.startY + (y - _state.startY) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); break;
    }
  }
  _state.lastX = x; _state.lastY = y;
});

['mouseup','mouseleave'].forEach(ev => {
  canvas.addEventListener(ev, () => {
    if (!_state.drawing) return;
    _state.drawing = false; _state.snapshot = null; ctx.beginPath();
  });
});

// ── 슬라이더·팔레트 ─────────────────────────────────────────────────────────
rangeSize.addEventListener('input', () => {
  _state.size = parseInt(rangeSize.value, 10);
  const sz = Math.max(4, Math.min(20, _state.size));
  sizeDot.style.width = sz + 'px'; sizeDot.style.height = sz + 'px';
});
rangeOpacity.addEventListener('input', () => { _state.opacity = parseInt(rangeOpacity.value, 10) / 100; });
document.querySelectorAll('.color-swatch').forEach(el => {
  el.addEventListener('click', () => selectColor(el.dataset.color));
});
colorPicker.addEventListener('input', () => {
  document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('active'));
  selectColor(colorPicker.value);
});

// ── 도구 버튼 ─────────────────────────────────────────────────────────────────
btnPen.addEventListener('click',    () => selectTool('pen'));
btnLine.addEventListener('click',   () => selectTool('line'));
btnRect.addEventListener('click',   () => selectTool('rect'));
btnCircle.addEventListener('click', () => selectTool('circle'));
btnEraser.addEventListener('click', () => selectTool('eraser'));
btnText.addEventListener('click',   () => selectTool('text'));

// ── Undo / Clear ──────────────────────────────────────────────────────────────
btnUndo.addEventListener('click', () => {
  if (_actionLog.length === 0) return;
  const last = _actionLog.pop();
  if (last.type === 'canvas') {
    ctx.putImageData(last.data, 0, 0);
  } else if (last.type === 'tbox') {
    const obj = _getTbox(last.id);
    if (obj) {
      obj.el.remove();
      _tboxes.splice(_tboxes.indexOf(obj), 1);
      if (_selectedId === last.id) _selectedId = null;
    }
  }
});

btnClear.addEventListener('click', () => {
  _cancelTextInput();
  _tboxes.forEach(obj => obj.el.remove());
  _tboxes.length = 0; _actionLog.length = 0;
  _selectedId = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// ── 드로잉 종료 ───────────────────────────────────────────────────────────────
function closeDraw() {
  _cancelTextInput();
  rasterizeAllTexts();
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  if (_isPassThrough) { _isPassThrough = false; drawWin.setIgnoreMouseEvents(false); }
  if (sessionKey) {
    const panelWcId = store.get(`${sessionKey}_panelWcId`, null);
    if (panelWcId) {
      const wc = remote.webContents.fromId(panelWcId);
      if (wc && !wc.isDestroyed()) wc.send('drawing-closed');
    }
  }
  window.close();
}
btnCloseDraw.addEventListener('click', closeDraw);

// ══════════════════════════════════════════════════════════════════════════════
// PPT 스타일 텍스트 박스
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 텍스트 박스 오브젝트 배열
 * @type {Array<{id,x,y,w,h,rotation,autoFit,minH,text,fontSize,color,opacity,resizeDir,resizeAnchor,el}>}
 */
const _tboxes    = [];

/**
 * 통합 액션 히스토리. canvas 드로잉과 텍스트 박스 생성을 하나의 스택으로 관리합니다.
 * @type {Array<{type:'canvas',data:ImageData}|{type:'tbox',id:string}>}
 */
const _actionLog = [];

let _selectedId   = null;  // 현재 선택된 박스 ID
let _pendingEditId = null; // text-input 팝업에서 재편집 중인 박스 ID
let _pendingGeom   = null; // text-input 팝업에서 신규 생성 대기 중인 좌표/크기
let _textInputWin  = null; // 현재 열려 있는 text-input BrowserWindow 참조

// ── 유틸 ──────────────────────────────────────────────────────────────────────

/** ID로 텍스트 박스 오브젝트를 반환합니다. */
function _getTbox(id) { return _tboxes.find(t => t.id === id); }

/**
 * 스크린 델타(dx, dy)를 박스 로컬 좌표로 변환합니다. (회전 역변환)
 */
function _toLocal(dx, dy, rotation) {
  const rad = -rotation * Math.PI / 180;
  return {
    lx: dx * Math.cos(rad) - dy * Math.sin(rad),
    ly: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * 리사이즈 핸들의 앵커 포인트를 스크린 좌표로 반환합니다.
 * @param {string} dir
 * @param {object} obj
 * @returns {{ x, y }}
 */
function _getAnchorScreen(dir, obj) {
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  const hw = obj.w / 2, hh = obj.h / 2;
  const L = {
    se:{ ax:-hw, ay:-hh }, nw:{ ax: hw, ay: hh },
    ne:{ ax:-hw, ay: hh }, sw:{ ax: hw, ay:-hh },
    e :{ ax:-hw, ay:  0 }, w :{ ax: hw, ay:  0 },
    s :{ ax:  0, ay:-hh }, n :{ ax:  0, ay: hh },
  }[dir];
  const rad = obj.rotation * Math.PI / 180;
  return {
    x: cx + L.ax * Math.cos(rad) - L.ay * Math.sin(rad),
    y: cy + L.ax * Math.sin(rad) + L.ay * Math.cos(rad),
  };
}

/**
 * 리사이즈 후 새 중심 계산을 위한 로컬 반벡터를 반환합니다.
 */
function _getHalfLocal(dir, nw, nh) {
  const hw = nw / 2, hh = nh / 2;
  return {
    se:{ hx: hw, hy: hh }, nw:{ hx:-hw, hy:-hh },
    ne:{ hx: hw, hy:-hh }, sw:{ hx:-hw, hy: hh },
    e :{ hx: hw, hy:  0 }, w :{ hx:-hw, hy:  0 },
    s :{ hx:  0, hy: hh }, n :{ hx:  0, hy:-hh },
  }[dir];
}

/**
 * 핸들 방향과 회전각에 따라 CSS resize cursor 를 반환합니다.
 */
function _getResizeCursor(dir, rotation) {
  const BASE  = { nw:225, n:270, ne:315, w:180, e:0, sw:135, s:90, se:45 };
  const NAMES = ['e','se','s','sw','w','nw','n','ne'];
  const angle = ((BASE[dir] + rotation) % 360 + 360) % 360;
  return NAMES[Math.round(angle / 45) % 8] + '-resize';
}

/**
 * 박스의 8개 리사이즈 핸들 커서를 현재 회전각에 맞게 일괄 업데이트합니다.
 */
function _tboxUpdateCursors(id) {
  const obj = _getTbox(id);
  if (!obj) return;
  ['nw','n','ne','w','e','sw','s','se'].forEach(dir => {
    const h = obj.el.querySelector(`.tbox-handle[data-dir="${dir}"]`);
    if (h) h.style.cursor = _getResizeCursor(dir, obj.rotation);
  });
}

// ── 선택 모드 ─────────────────────────────────────────────────────────────────

/** 모든 박스의 선택을 해제합니다. */
function _tboxDeselectAll() {
  if (_selectedId) {
    const obj = _getTbox(_selectedId);
    if (obj) obj.el.classList.remove('selected');
    _selectedId = null;
  }
}

/** 박스를 선택합니다. */
function _tboxSelect(id) {
  if (_selectedId && _selectedId !== id) {
    const prev = _getTbox(_selectedId);
    if (prev) prev.el.classList.remove('selected');
  }
  const obj = _getTbox(id);
  if (!obj) return;
  obj.el.classList.add('selected');
  _selectedId = id;
}

// ── text-input 팝업 연동 ──────────────────────────────────────────────────────

/**
 * 텍스트 메모 팝업을 엽니다.
 * 이미 열려 있으면 닫고 새로 엽니다.
 *
 * 메모 팝업은 드로잉 캔버스와 IPC 연동 없이 독립적으로 동작합니다.
 * 팝업이 닫히면 'closed' 이벤트에서 대기 상태(_pendingGeom, _pendingEditId)를
 * 자동으로 초기화하여 T 도구 재진입 시 guard 조건에 걸리지 않도록 보장합니다.
 *
 * @param {object} opts
 * @param {number} [opts.anchorX] - 팝업을 붙일 뷰포트 X 좌표 (미전달 시 모니터 중앙)
 * @param {number} [opts.anchorY] - 팝업을 붙일 뷰포트 Y 좌표
 */
function _openTextInputPopup({ anchorX, anchorY } = {}) {
  if (_textInputWin && !_textInputWin.isDestroyed()) _textInputWin.close();

  _textInputWin = textInputModule.openTextInputWindow({
    theme,
    sessionKey,
    anchorX,
    anchorY,
  });

  // 팝업 닫힘 시 대기 상태 자동 초기화
  _textInputWin.once('closed', function () {
    _textInputWin  = null;
    _pendingEditId = null;
    _pendingGeom   = null;
  });
}

/**
 * text-input 팝업을 닫고 대기 상태를 초기화합니다.
 * 도구 전환, 드로잉 종료 등 외부 강제 취소 시 호출합니다.
 */
function _cancelTextInput() {
  if (_textInputWin && !_textInputWin.isDestroyed()) _textInputWin.close();
  _textInputWin  = null;
  _pendingEditId = null;
  _pendingGeom   = null;
}

/**
 * 텍스트 박스의 표시 텍스트를 갱신합니다.
 * @param {object} obj
 */
function _renderTboxText(obj) {
  const content = obj.el.querySelector('.tbox-content');
  if (!content) return;
  content.style.fontSize = obj.fontSize + 'px';
  content.style.color    = obj.color;
  content.style.opacity  = String(obj.opacity);
  content.textContent    = obj.text;
}

/**
 * 기존 텍스트 박스를 재편집합니다.
 * text-input 팝업을 기존 텍스트로 초기화해서 엽니다.
 *
 * @param {string} id
 */
function _tboxEnterEdit(id) {
  const obj = _getTbox(id);
  if (!obj) return;
  if (_pendingEditId || _pendingGeom) return; // 팝업이 이미 열려 있으면 무시
  _tboxSelect(id);
  _pendingEditId = id;
  _openTextInputPopup({ anchorX: obj.x, anchorY: obj.y });
}

/**
 * 선택된(또는 지정된) 박스를 삭제합니다.
 * @param {string} [id]
 */
function _tboxDelete(id) {
  const targetId = id || _selectedId;
  if (!targetId) return;
  const obj = _getTbox(targetId);
  if (!obj) return;
  obj.el.remove();
  _tboxes.splice(_tboxes.indexOf(obj), 1);
  if (_selectedId === targetId) _selectedId = null;
}

// ── AutoFit ───────────────────────────────────────────────────────────────────

/**
 * 텍스트 내용에 맞게 박스 높이를 자동 조정합니다.
 *
 * 임시 측정 요소를 생성해 줄 바꿈·word-wrap 이 반영된 실제 높이를 계산합니다.
 * 호출 빈도가 낮아(텍스트 확인 시, 리사이즈 완료 시) 싱글스레드 부담이 없습니다.
 *
 * @param {string} id
 */
function _tboxAutoFit(id) {
  const obj = _getTbox(id);
  if (!obj || !obj.autoFit || !obj.text) return;

  // 임시 측정 요소: 실제 CSS 와 동일한 조건으로 높이를 측정
  const tmp = document.createElement('div');
  tmp.style.cssText = [
    'position:fixed', 'visibility:hidden', 'pointer-events:none',
    `width:${obj.w}px`, 'padding:5px 8px',
    `font-size:${obj.fontSize}px`, 'font-weight:700',
    "font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif",
    'line-height:1.5', 'white-space:pre-wrap', 'word-break:break-word',
  ].join(';');
  tmp.textContent = obj.text;
  document.body.appendChild(tmp);
  const measuredH = tmp.scrollHeight + 10;
  document.body.removeChild(tmp);

  const newH = Math.max(obj.minH, measuredH);
  if (Math.abs(newH - obj.h) < 1) return;

  // 앵커 기준 위치 재계산 (기존 anchor 방식 유지)
  const dir    = obj.resizeDir    || 's';
  const anchor = obj.resizeAnchor || _getAnchorScreen(dir, obj);

  const { hx, hy } = _getHalfLocal(dir, obj.w, newH);
  const rad = obj.rotation * Math.PI / 180;
  const ncx = anchor.x + hx * Math.cos(rad) - hy * Math.sin(rad);
  const ncy = anchor.y + hx * Math.sin(rad) + hy * Math.cos(rad);

  obj.x = ncx - obj.w / 2;
  obj.y = ncy - newH / 2;
  obj.h = newH;
  obj.el.style.left   = obj.x + 'px';
  obj.el.style.top    = obj.y + 'px';
  obj.el.style.height = newH + 'px';

  obj.resizeDir    = null;
  obj.resizeAnchor = null;
}

// ── 생성 ──────────────────────────────────────────────────────────────────────

/**
 * 텍스트 박스를 생성하고 오브젝트 모드(선택 상태)로 배치합니다.
 * text-input 팝업에서 확인된 텍스트를 받아 즉시 생성합니다.
 *
 * @param {{ x, y, w, h, text }} geomAndText
 * @returns {object}
 */
function _tboxCreate({ x, y, w, h, text, color: explicitColor }) {
  const id       = `tbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const fontSize = _state.fontSize;
  const color    = explicitColor || _state.color;
  const opacity  = _state.opacity;

  /* ── 래퍼 ─────────────────────────────────── */
  const el = document.createElement('div');
  el.className   = 'tbox';
  el.id          = id;
  el.dataset.id  = id;
  el.style.left      = x + 'px';
  el.style.top       = y + 'px';
  el.style.width     = w + 'px';
  el.style.height    = h + 'px';
  el.style.transform = 'rotate(0deg)';

  /* ── 텍스트 본문 ───────────────────────────── */
  const body = document.createElement('div');
  body.className = 'tbox-body';

  const content = document.createElement('div');
  content.className = 'tbox-content';
  content.style.fontSize = fontSize + 'px';
  content.style.color    = color;
  content.style.opacity  = String(opacity);

  body.appendChild(content);
  el.appendChild(body);

  /* ── 선택 프레임 + 핸들 ────────────────────── */
  const frame = document.createElement('div');
  frame.className = 'tbox-selection';

  const stem = document.createElement('div');
  stem.className = 'tbox-rotate-stem';
  frame.appendChild(stem);

  ['nw','n','ne','w','e','sw','s','se','rotate'].forEach(dir => {
    const handle = document.createElement('div');
    handle.className   = 'tbox-handle';
    handle.dataset.dir = dir;
    frame.appendChild(handle);
  });

  el.appendChild(frame);
  _tboxAttachEvents(el, id, frame);
  textObjectLayer.appendChild(el);

  const obj = {
    id, x, y, w, h,
    rotation    : 0,
    autoFit     : true,
    minH        : h,
    text,
    fontSize, color, opacity,
    resizeDir   : null,
    resizeAnchor: null,
    el,
  };
  _tboxes.push(obj);

  _renderTboxText(obj);
  _tboxAutoFit(id);
  _tboxSelect(id);
  _saveTboxAction(id);

  return obj;
}

// ── 이벤트 연결 ───────────────────────────────────────────────────────────────

/**
 * 텍스트 박스에 필요한 모든 이벤트를 연결합니다.
 * - 클릭: 선택 + 이동 드래그 시작
 * - 더블클릭: 재편집 팝업 열기
 * - 핸들: 리사이즈 또는 회전 시작
 */
function _tboxAttachEvents(el, id, frame) {
  /* ── 클릭: 선택 + 이동 드래그 준비 ───────── */
  el.addEventListener('mousedown', (e) => {
    if (!document.body.classList.contains('text-mode')) return;
    if (e.target.dataset && e.target.dataset.dir) return; // 핸들 별도 처리
    e.stopPropagation();

    _tboxSelect(id);

    _move.active  = true;
    _move.id      = id;
    _move.startMX = e.clientX;
    _move.startMY = e.clientY;
    const obj = _getTbox(id);
    _move.origX = obj.x;
    _move.origY = obj.y;
  });

  /* ── 더블클릭: 재편집 팝업 열기 ────────────── */
  el.addEventListener('dblclick', (e) => {
    if (!document.body.classList.contains('text-mode')) return;
    if (e.target.dataset && e.target.dataset.dir) return;
    e.stopPropagation();
    _tboxEnterEdit(id);
  });

  /* ── 핸들 이벤트 ─────────────────────────── */
  frame.querySelectorAll('.tbox-handle').forEach(handle => {
    const dir = handle.dataset.dir;
    if (dir === 'rotate') {
      handle.addEventListener('mousedown', (e) => _onRotateStart(e, id));
    } else {
      handle.addEventListener('mousedown', (e) => _onResizeStart(e, id, dir));
    }
  });
}

// ── 이동 드래그 ───────────────────────────────────────────────────────────────
const _move = { active:false, id:null, startMX:0, startMY:0, origX:0, origY:0 };

// ── 리사이즈 ──────────────────────────────────────────────────────────────────
const _resize = { active:false, id:'', dir:'', anchorSX:0, anchorSY:0, origW:0, origH:0 };

/**
 * 리사이즈 핸들 mousedown 을 처리합니다.
 * 앵커(반대편 꼭짓점/중점)를 고정하고 mousemove 에서 크기·위치를 재계산합니다.
 */
function _onResizeStart(e, id, dir) {
  if (!document.body.classList.contains('text-mode')) return;
  e.stopPropagation(); e.preventDefault();
  const obj = _getTbox(id);
  if (!obj) return;

  const anchor     = _getAnchorScreen(dir, obj);
  _resize.active   = true;
  _resize.id       = id;
  _resize.dir      = dir;
  _resize.anchorSX = anchor.x;
  _resize.anchorSY = anchor.y;
  _resize.origW    = obj.w;
  _resize.origH    = obj.h;
  document.body.style.cursor = _getResizeCursor(dir, obj.rotation);
}

// ── 회전 ──────────────────────────────────────────────────────────────────────
const _rotate = { active:false, id:'', cx:0, cy:0, startAngle:0, origRotation:0 };

/**
 * 회전 핸들 mousedown 을 처리합니다.
 * shift: 15° 단위 스냅
 */
function _onRotateStart(e, id) {
  if (!document.body.classList.contains('text-mode')) return;
  e.stopPropagation(); e.preventDefault();
  const obj = _getTbox(id);
  if (!obj) return;
  const cx = obj.x + obj.w / 2;
  const cy = obj.y + obj.h / 2;
  _rotate.active       = true;
  _rotate.id           = id;
  _rotate.cx           = cx;  _rotate.cy          = cy;
  _rotate.startAngle   = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  _rotate.origRotation = obj.rotation;
  document.body.style.cursor = 'grabbing';
}

// ── 드래그 생성 ───────────────────────────────────────────────────────────────
const _create = { active:false, startX:0, startY:0 };

/**
 * 텍스트 모드에서 캔버스 mousedown 을 처리합니다.
 * 팝업이 이미 열려 있으면 무시합니다.
 */
function _onCanvasMousedownText(e) {
  if (_pendingEditId || _pendingGeom) return; // 팝업 열려있으면 무시
  _tboxDeselectAll();

  _create.active = true;
  _create.startX = e.clientX;
  _create.startY = e.clientY;

  tboxPreview.style.left   = e.clientX + 'px';
  tboxPreview.style.top    = e.clientY + 'px';
  tboxPreview.style.width  = '0px';
  tboxPreview.style.height = '0px';
  tboxPreview.classList.add('active');
}

// ── 텍스트 모드 — document 레벨 mousedown ────────────────────────────────────
/**
 * canvas.mousedown 대신 document 레벨에서 텍스트 클릭을 처리합니다.
 *
 * canvas.mousedown 에서 처리하면 _isPassThrough 상태나 canvas hit-test 엣지케이스에
 * 취약합니다. document 레벨은 창이 이벤트를 수신하는 한 항상 동작합니다.
 * tbox / 툴바 클릭은 별도 핸들러가 처리하므로 여기서 제외합니다.
 */
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0)         return;
  if (_isPassThrough)         return;
  if (_state.tool !== 'text') return;
  // tbox 또는 툴바 내부 클릭은 각자 핸들러에서 처리
  if (e.target.closest('#textObjectLayer .tbox, #toolbar')) return;
  _onCanvasMousedownText(e);
});

// ── 단일 document 드래그 핸들러 ───────────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
  /* ── 이동 ─────────────────────────────── */
  if (_move.active) {
    const dx = e.clientX - _move.startMX;
    const dy = e.clientY - _move.startMY;
    const nx = _move.origX + (e.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx);
    const ny = _move.origY + (e.shiftKey && Math.abs(dx) > Math.abs(dy) ? 0 : dy);
    const obj = _getTbox(_move.id);
    if (obj) {
      obj.x = nx; obj.y = ny;
      obj.el.style.left = nx + 'px'; obj.el.style.top = ny + 'px';
    }
    return;
  }

  /* ── 리사이즈 ──────────────────────────────────────────────────────────── */
  if (_resize.active) {
    const { id, dir, anchorSX, anchorSY, origW, origH } = _resize;
    const obj = _getTbox(id);
    if (!obj) return;

    const { lx, ly } = _toLocal(e.clientX - anchorSX, e.clientY - anchorSY, obj.rotation);

    let nw = origW, nh = origH;
    if      (dir === 'se') { nw = Math.max(60, lx);   nh = Math.max(32, ly);  }
    else if (dir === 'nw') { nw = Math.max(60, -lx);  nh = Math.max(32, -ly); }
    else if (dir === 'ne') { nw = Math.max(60, lx);   nh = Math.max(32, -ly); }
    else if (dir === 'sw') { nw = Math.max(60, -lx);  nh = Math.max(32, ly);  }
    else if (dir === 'e')  { nw = Math.max(60, lx);                            }
    else if (dir === 'w')  { nw = Math.max(60, -lx);                           }
    else if (dir === 's')  {                            nh = Math.max(32, ly);  }
    else if (dir === 'n')  {                            nh = Math.max(32, -ly); }

    if (e.shiftKey && dir.length === 2) nh = nw / (origW / origH);

    if (dir.includes('s') || dir.includes('n')) {
      obj.minH    = nh;
      obj.autoFit = true;
    }

    const { hx, hy } = _getHalfLocal(dir, nw, nh);
    const rad = obj.rotation * Math.PI / 180;
    const ncx = anchorSX + hx * Math.cos(rad) - hy * Math.sin(rad);
    const ncy = anchorSY + hx * Math.sin(rad) + hy * Math.cos(rad);

    obj.x = ncx - nw / 2;
    obj.y = ncy - nh / 2;
    obj.w = nw;
    obj.h = nh;
    obj.el.style.left   = obj.x + 'px';
    obj.el.style.top    = obj.y + 'px';
    obj.el.style.width  = nw  + 'px';
    obj.el.style.height = nh  + 'px';
    return;
  }

  /* ── 회전 ─────────────────────────────── */
  if (_rotate.active) {
    const { id, cx, cy, startAngle, origRotation } = _rotate;
    const obj = _getTbox(id);
    if (!obj) return;
    const curAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    let delta      = curAngle - startAngle;
    if (e.shiftKey) delta = Math.round(delta / 15) * 15;
    obj.rotation           = origRotation + delta;
    obj.el.style.transform = `rotate(${obj.rotation}deg)`;
    _tboxUpdateCursors(id);
    return;
  }

  /* ── 드래그 생성 미리보기 ──────────────── */
  if (_create.active) {
    const x = Math.min(e.clientX, _create.startX);
    const y = Math.min(e.clientY, _create.startY);
    const w = Math.abs(e.clientX - _create.startX);
    const h = Math.abs(e.clientY - _create.startY);
    tboxPreview.style.left   = x + 'px'; tboxPreview.style.top    = y + 'px';
    tboxPreview.style.width  = w + 'px'; tboxPreview.style.height = h + 'px';
  }
});

document.addEventListener('mouseup', (e) => {
  if (_move.active) {
    const mObj = _getTbox(_move.id);
    if (mObj) mObj.resizeAnchor = null;
    _move.active = false;
    document.body.style.cursor = '';
  }
  if (_resize.active) {
    const resizedId = _resize.id;
    const rObj      = _getTbox(resizedId);
    if (rObj) {
      rObj.resizeAnchor = { x: _resize.anchorSX, y: _resize.anchorSY };
      rObj.resizeDir    = _resize.dir;
    }
    _resize.active = false;
    document.body.style.cursor = '';
    _tboxAutoFit(resizedId);
  }
  if (_rotate.active) {
    const roObj = _getTbox(_rotate.id);
    if (roObj) roObj.resizeAnchor = null;
    _rotate.active = false;
    document.body.style.cursor = '';
  }

  /* ── 드래그 생성 완료: 위치/크기 저장 후 text-input 팝업 열기 ──── */
  if (_create.active) {
    _create.active = false;
    tboxPreview.classList.remove('active');

    const dragW    = Math.abs(e.clientX - _create.startX);
    const dragH    = Math.abs(e.clientY - _create.startY);
    const MIN_DRAG = 12;

    let geom;
    if (dragW >= MIN_DRAG && dragH >= MIN_DRAG) {
      // 드래그로 크기 지정
      geom = {
        x: Math.min(e.clientX, _create.startX),
        y: Math.min(e.clientY, _create.startY),
        w: dragW, h: Math.max(36, dragH),
      };
    } else {
      // 클릭: 기본 크기
      const dw = Math.max(160, _state.fontSize * 8);
      const dh = Math.ceil(_state.fontSize * 1.5) + 10;
      geom = {
        x: Math.min(_create.startX, window.innerWidth  - dw - 10),
        y: Math.min(_create.startY, window.innerHeight - dh - 10),
        w: dw, h: dh,
      };
    }

    // 위치/크기를 저장하고 메모 팝업을 엽니다.
    // 팝업 닫힘 시 'closed' 이벤트에서 _pendingGeom 이 초기화됩니다.
    _pendingGeom = geom;
    _openTextInputPopup({ anchorX: geom.x, anchorY: geom.y });
  }
});

// ── 래스터라이즈 ──────────────────────────────────────────────────────────────
/**
 * 모든 텍스트 박스를 canvas 에 래스터라이즈합니다.
 * 드로잉 종료 또는 전체 지우기 시 호출됩니다.
 */
function rasterizeAllTexts() {
  if (_tboxes.length === 0) return;

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  ctx.save();
  _tboxes.forEach(obj => {
    if (!obj.text.trim()) return;

    const cx  = (obj.x + obj.w / 2) * scaleX;
    const cy  = (obj.y + obj.h / 2) * scaleY;
    const rad = obj.rotation * Math.PI / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.translate(-(obj.w * scaleX) / 2, -(obj.h * scaleY) / 2);

    ctx.globalAlpha              = obj.opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle    = obj.color;
    ctx.font         = `bold ${obj.fontSize * scaleX}px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif`;
    ctx.textBaseline = 'top';

    const lines = obj.text.split('\n');
    const lineH = obj.fontSize * scaleX * 1.5;
    const padX  = 8 * scaleX;
    const padY  = 5 * scaleY;

    lines.forEach((line, i) => {
      ctx.fillText(line, padX, padY + i * lineH);
    });

    ctx.restore();
  });
  ctx.restore();

  _tboxes.forEach(obj => obj.el.remove());
  _tboxes.length = 0;
  _selectedId    = null;
}

// ── 전역 단축키 ───────────────────────────────────────────────────────────────
/**
 * ┌──────────┬───────────────────────────────────────────────────────────────┐
 * │ 키       │ 동작                                                          │
 * ├──────────┼───────────────────────────────────────────────────────────────┤
 * │ P/L/R/C/E/T │ 도구 전환                                                 │
 * │ Ctrl+Z   │ 실행 취소                                                     │
 * │ Esc      │ [텍스트 모드] 선택 해제 / 없으면 드로잉 종료                 │
 * │          │ [기타 모드] 드로잉 종료                                       │
 * │ Enter/F2 │ [텍스트 모드] 선택된 tbox 재편집 팝업 열기                   │
 * │ Delete   │ [텍스트 모드] 선택된 tbox 삭제                               │
 * └──────────┴───────────────────────────────────────────────────────────────┘
 *
 * drawWin 은 항상 focusable:false 이므로 native keydown 이 도달하지 않습니다.
 * 컨트롤 패널이 포커스를 유지하면서 keydown 을 'drawing-keydown' IPC 로 전달합니다.
 */
const DRAWING_SHORTCUT_MAP = {
  p : { label: '펜',      handler: () => selectTool('pen') },
  l : { label: '직선',    handler: () => selectTool('line') },
  r : { label: '사각형',  handler: () => selectTool('rect') },
  c : { label: '원',      handler: () => selectTool('circle') },
  e : { label: '지우개',  handler: () => selectTool('eraser') },
  t : { label: '텍스트',  handler: () => selectTool('text') },
};

/**
 * 단축키 처리 로직.
 * native keydown 및 IPC 'drawing-keydown' 양쪽에서 호출됩니다.
 */
function _handleShortcut({ key, ctrlKey, metaKey, isComposing, preventDefault }) {
  if (isComposing) return;

  // Ctrl/Meta+Z: 실행 취소
  if ((ctrlKey || metaKey) && key.toLowerCase() === 'z') {
    preventDefault();
    btnUndo.click();
    return;
  }

  const keyNorm = key.length === 1 ? key.toLowerCase() : key;

  // 텍스트 모드 오브젝트 단축키
  if (_state.tool === 'text') {
    switch (keyNorm) {
      case 'Escape':
        if (_selectedId) { _tboxDeselectAll(); }
        else             { closeDraw(); }        // 선택 없음 → 드로잉 종료
        preventDefault();
        return;
      case 'Enter':
      case 'F2':
        if (_selectedId) { _tboxEnterEdit(_selectedId); preventDefault(); }
        return;
      case 'Delete':
      case 'Backspace':
        if (_selectedId) { _tboxDelete(); preventDefault(); }
        return;
      // 그 외 키(P/L/R/C/E/T 등): 아래 도구 전환 맵으로 fall-through
    }
  }

  // 일반 드로잉 단축키
  const shortcut = DRAWING_SHORTCUT_MAP[keyNorm];
  if (!shortcut) return;
  preventDefault();
  shortcut.handler();
}

// native keydown (drawWin.focus() 상태 시 — 실제로는 발생하지 않음, 방어 코드)
document.addEventListener('keydown', (e) => {
  _handleShortcut({
    key           : e.key,
    ctrlKey       : e.ctrlKey,
    metaKey       : e.metaKey,
    isComposing   : e.isComposing,
    preventDefault: () => e.preventDefault(),
  });
});

// ── 메모 팝업 위치 추적 (클릭 위치로 이동) ────────────────────────────────────
/**
 * 메모 팝업이 열려 있을 때 캔버스를 클릭하면 팝업이 그 위치 근처로 이동합니다.
 * 드래그(5px 이상 이동)는 이동 트리거로 처리하지 않습니다.
 *
 * POPUP_W / POPUP_H 는 text-input/window.js 의 값과 일치해야 합니다.
 */
var _memoClickStart = null;

canvas.addEventListener('mousedown', function (e) {
  if (!_textInputWin || _textInputWin.isDestroyed()) return;
  if (_state.tool !== 'text') return; // 텍스트 도구일 때만 팝업 위치 추적
  _memoClickStart = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mouseup', function (e) {
  if (!_memoClickStart) return;
  const start = _memoClickStart;
  _memoClickStart = null;

  if (!_textInputWin || _textInputWin.isDestroyed()) return;

  // 드래그였으면 이동하지 않음
  if (Math.abs(e.clientX - start.x) > 5 || Math.abs(e.clientY - start.y) > 5) return;

  _moveMemoPopupNear(e.clientX, e.clientY);
});

/**
 * 메모 팝업을 뷰포트 좌표 (vx, vy) 근처로 이동합니다.
 * 화면 밖으로 나가지 않도록 클램핑합니다.
 * @param {number} vx - 드로잉 창 기준 X (= 디스플레이 상대 X)
 * @param {number} vy - 드로잉 창 기준 Y
 */
function _moveMemoPopupNear(vx, vy) {
  const cfg = sessionKey ? store.get(`${sessionKey}_config`, {}) : {};
  const db  = (cfg.display && cfg.display.bounds)
    ? cfg.display.bounds
    : remote.screen.getPrimaryDisplay().bounds;

  const POPUP_W = 500;
  const POPUP_H = 400;
  const OFFSET  = 16;

  const sx = db.x + vx;
  const sy = db.y + vy;

  let wx = sx + OFFSET;
  let wy = sy + OFFSET;

  // 오른쪽/아래쪽 넘침 → 반전
  if (wx + POPUP_W > db.x + db.width  - OFFSET) wx = sx - POPUP_W - OFFSET;
  if (wy + POPUP_H > db.y + db.height - OFFSET) wy = sy - POPUP_H - OFFSET;

  // 최종 클램핑
  wx = Math.max(db.x + OFFSET, Math.min(wx, db.x + db.width  - POPUP_W - OFFSET));
  wy = Math.max(db.y + OFFSET, Math.min(wy, db.y + db.height - POPUP_H - OFFSET));

  _textInputWin.setPosition(Math.round(wx), Math.round(wy));
}

// ── drawWin 종료 시 text-input 팝업 정리 ─────────────────────────────────────
/**
 * drawWin 이 어떤 경로로 닫히든(버튼 클릭, 녹화 중지, 부모 창 종료 등)
 * text-input 팝업이 반드시 함께 닫히도록 보장합니다.
 *
 * closeDraw() 는 명시적 버튼 클릭 경로만 처리합니다.
 * 외부에서 win.close() 가 호출되는 경로(closeDrawingWindow() 등)는
 * beforeunload 에서만 처리됩니다.
 */
window.addEventListener('beforeunload', () => {
  _cancelTextInput();
});

// ── IPC 수신 ──────────────────────────────────────────────────────────────────

// 테마 변경 브로드캐스트
ipcRenderer.on('theme-change', (_, newTheme) => {
  document.body.classList.toggle('light', newTheme === 'light');
});

// 컨트롤 패널 keydown 포워딩 수신
ipcRenderer.on('drawing-keydown', (_, keyInfo) => {
  _handleShortcut({ ...keyInfo, isComposing: false, preventDefault: () => {} });
});

// ── 툴바 드래그 ───────────────────────────────────────────────────────────────
{
  const toolbar = document.getElementById('toolbar');
  let _drag = false, _ox = 0, _oy = 0;

  function initToolbarPos() {
    if (toolbar.style.transform === 'none') return;
    const rect = toolbar.getBoundingClientRect();
    toolbar.style.left = rect.left + 'px'; toolbar.style.top = rect.top + 'px';
    toolbar.style.transform = 'none';
  }

  toolbar.addEventListener('mousedown', (e) => {
    if (e.target !== toolbar &&
        e.target.closest('.tool-btn, .btn-close-drawing, input, .color-swatch, .color-picker-wrap')) return;
    initToolbarPos();
    _drag = true;
    _ox   = e.clientX - parseInt(toolbar.style.left, 10);
    _oy   = e.clientY - parseInt(toolbar.style.top,  10);
    toolbar.classList.add('dragging');
    e.preventDefault(); e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!_drag) return;
    toolbar.style.left = Math.max(0, Math.min(window.innerWidth  - toolbar.offsetWidth,  e.clientX - _ox)) + 'px';
    toolbar.style.top  = Math.max(0, Math.min(window.innerHeight - toolbar.offsetHeight, e.clientY - _oy)) + 'px';
    e.stopPropagation();
  });

  document.addEventListener('mouseup', () => { if (!_drag) return; _drag = false; toolbar.classList.remove('dragging'); });
}
