/**
 * @file popups/drawing/text-input/index.js
 * @description 텍스트 메모 팝업 렌더러 — Rich Text Editor
 *
 * ── RTE 기본 원칙 ────────────────────────────────────────────────────────────
 *
 *  execCommand 동작 규칙
 *    · 텍스트 선택 범위가 있을 때 → 선택된 텍스트에 서식 적용
 *    · 커서만 있을 때 (collapsed) → 이후 입력되는 텍스트에 서식 적용
 *    → 두 경우 모두 동일한 코드로 처리. isCollapsed 여부로 분기하지 않는다.
 *
 *  execCommand 호출 전제 조건
 *    1. editor.focus() 가 먼저 호출되어야 한다.
 *    2. 원하는 cursor/selection 이 에디터 안에 있어야 한다.
 *    → _restoreAndFocus() 가 두 조건을 동시에 보장한다.
 *
 *  툴바 요소별 focus 관리 전략
 *    · fmt-btn (굵기/기울기/취소선)
 *        mousedown → preventDefault → 에디터 focus 이탈 자체를 막음
 *        → selection 저장/복원 불필요
 *
 *    · 커스텀 드롭다운 (폰트/크기)
 *        trigger mousedown → preventDefault + _saveSelection
 *        option  mousedown → preventDefault
 *        option  click     → _restoreAndFocus + execCommand
 *
 *    · 컬러 패널
 *        trigger mousedown → preventDefault + _saveSelection
 *        panel   mousedown → preventDefault (customColorPicker 제외)
 *        확인 click        → _restoreAndFocus + foreColor
 *
 * ── 폰트 크기 적용 방식 (_applyFontSize) ────────────────────────────────────
 *  execCommand('fontSize') 로 커서 위치(collapsed)에 적용하면 Chromium이 새 요소를
 *  만들지 않고 커서가 속한 기존 <font> 부모 요소에 size="7" 을 추가합니다.
 *  → 이전에 작성한 텍스트까지 크기가 바뀌는 버그 발생.
 *
 *  해결:
 *  · collapsed (커서만) : insertHTML 로 styled span 삽입 후 커서를 span 안에 위치
 *                          → 기존 내용 전혀 건드리지 않음
 *  · non-collapsed (선택) : execCommand('fontSize', '7') + style.fontSize 교체
 *                            → 선택 범위에만 적용되므로 안전
 *  · 에디터 비었을 때     : innerHTML 초기화로 이전 포맷 컨텍스트 제거
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
const MSG    = require(PATH.join(__dirname, 'msg'));
const remote = require('@electron/remote');

// ── URL 파라미터 ─────────────────────────────────────────────────────────────
const params     = WSUTIL.QueryString.parse(location.href);
const theme      = params.theme      || 'dark';
const USERINFO   = params.USERINFO   || {};
const browserKey = params.browserKey || '';

// 테마에 따른 기본 글자 색상 (외부에서 initColor 를 주지 않는다)
const initColor = theme === 'light' ? '#000000' : '#FFFFFF';

if (theme === 'light') document.body.classList.add('light');

// ── DOM refs ─────────────────────────────────────────────────────────────────
const editor             = document.getElementById('editor');
const btnBold            = document.getElementById('btnBold');
const btnItalic          = document.getElementById('btnItalic');
const btnStrike          = document.getElementById('btnStrike');
const btnUnderline       = document.getElementById('btnUnderline');
const cselFontTrigger    = document.getElementById('cselFontTrigger');
const cselFontValue      = document.getElementById('cselFontValue');
const listFont           = document.getElementById('listFont');
const cselSizeTrigger    = document.getElementById('cselSizeTrigger');
const cselSizeValue      = document.getElementById('cselSizeValue');
const listSize           = document.getElementById('listSize');
const colorTrigger       = document.getElementById('colorTrigger');
const colorTriggerBar    = document.getElementById('colorTriggerBar');
const colorPanel         = document.getElementById('colorPanel');
const colorGrid          = document.getElementById('colorGrid');
const customColorPicker  = document.getElementById('customColorPicker');
const customColorPreview = document.getElementById('customColorPreview');
const previewBox         = document.getElementById('previewBox');
const previewHex         = document.getElementById('previewHex');
const btnApplyColor      = document.getElementById('btnApplyColor');
const btnClose           = document.getElementById('btnClose');

const win = remote.getCurrentWindow();

// ── 정적 텍스트 초기화 ────────────────────────────────────────────────────────
function _initTexts() {
  document.getElementById('headerTitle').textContent      = MSG.M001;
  editor.setAttribute('data-placeholder',                   MSG.M002);
  cselFontTrigger.title                                   = MSG.M003;
  cselSizeTrigger.title                                   = MSG.M004;
  btnBold.title                                           = MSG.M005;
  btnItalic.title                                         = MSG.M006;
  btnStrike.title                                         = MSG.M007;
  btnUnderline.title                                      = MSG.M007U;
  colorTrigger.title                                      = MSG.M008;
  btnApplyColor.textContent                               = MSG.M009;
  btnClose.title                                          = MSG.M010;
  document.getElementById('panelLabelPreset').textContent = MSG.M011;
  document.getElementById('customLabel').textContent      = MSG.M012;
  document.getElementById('previewLabel').textContent     = MSG.M013;
}

// ── 색상 상태 ─────────────────────────────────────────────────────────────────
var _appliedColor = initColor;
var _pendingColor = initColor;

// execCommand('insertHTML') 실행 중 input 이벤트 핸들러가 재귀 execCommand 를 호출하는
// 것을 막기 위한 플래그입니다. _applyFontSize 의 insertHTML 구간에서만 true 가 됩니다.
var _applyingFormat = false;

// 폰트 패밀리 적용 시퀀스 중(_restoreAndFocus → execCommand('fontName')) 발화되는
// selectionchange 가 _syncFontDropdowns 를 통해 드롭다운을 이전 값으로 덮어쓰는 것을
// 막기 위한 플래그입니다. 폰트 option click 핸들러 구간에서만 true 가 됩니다.
var _applyingFont = false;

// ── selection 저장/복원 ───────────────────────────────────────────────────────
/** @type {Range|null} */
var _savedRange = null;

/**
 * 현재 에디터 selection 의 range 를 저장합니다.
 * mousedown 시점(focus 이탈 전)에 호출합니다.
 */
function _saveSelection() {
  var sel = window.getSelection();
  _savedRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
}

/**
 * 에디터에 focus 를 준 뒤 저장된 range 를 복원합니다.
 *
 * editor.focus() 를 항상 먼저 실행하므로 이후 execCommand 가
 * 에디터 안에서 동작하는 것이 보장됩니다.
 * savedRange 가 없으면 focus 만 하고 리턴합니다 (커서는 에디터 마지막 위치).
 */
function _restoreAndFocus() {
  editor.focus();
  if (!_savedRange) return;
  var sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(_savedRange);
}

// ── 서식 버튼: mousedown preventDefault 로 focus 이탈 차단 ───────────────────
document.querySelectorAll('.fmt-btn').forEach(function (el) {
  el.addEventListener('mousedown', function (e) { e.preventDefault(); });
});

// ── 서식 버튼 click ───────────────────────────────────────────────────────────
/**
 * fmt-btn 은 focus 가 에디터에 있는 상태에서 클릭되므로
 * editor.focus() + execCommand 직접 호출이 가능합니다.
 */
btnBold.addEventListener('click', function () {
  editor.focus();
  document.execCommand('bold', false, null);
  _syncToolbarState();
});

btnItalic.addEventListener('click', function () {
  editor.focus();
  document.execCommand('italic', false, null);
  _syncToolbarState();
});

btnStrike.addEventListener('click', function () {
  editor.focus();
  document.execCommand('strikeThrough', false, null);
  _syncToolbarState();
});

btnUnderline.addEventListener('click', function () {
  editor.focus();
  document.execCommand('underline', false, null);
  _syncToolbarState();
});

// ── 커스텀 드롭다운 공통 유틸 ─────────────────────────────────────────────────
/**
 * 드롭다운 목록을 트리거 아래에 fixed 포지션으로 배치합니다.
 */
function _positionList(trigger, list) {
  var rect  = trigger.getBoundingClientRect();
  var listW = list.offsetWidth || 130;
  var left  = rect.left;
  var top   = rect.bottom + 2;

  if (left + listW > window.innerWidth - 4) left = window.innerWidth - listW - 4;

  list.style.left = left + 'px';
  list.style.top  = top  + 'px';
}

function _closeAllLists() {
  listFont.classList.remove('visible');
  listSize.classList.remove('visible');
  cselFontTrigger.classList.remove('open');
  cselSizeTrigger.classList.remove('open');
}

// ── 폰트 패밀리 드롭다운 ──────────────────────────────────────────────────────
cselFontTrigger.addEventListener('mousedown', function (e) {
  e.preventDefault();
  _saveSelection();
});

cselFontTrigger.addEventListener('click', function () {
  var isOpen = listFont.classList.contains('visible');
  _closeAllLists();
  _closePanel();
  if (!isOpen) {
    _positionList(cselFontTrigger, listFont);
    listFont.classList.add('visible');
    cselFontTrigger.classList.add('open');
  }
});

listFont.querySelectorAll('.csel-option').forEach(function (opt) {
  opt.addEventListener('mousedown', function (e) { e.preventDefault(); });
  opt.addEventListener('click', function () {
    // 선택 표시 갱신
    listFont.querySelectorAll('.csel-option').forEach(function (o) { o.classList.remove('selected'); });
    opt.classList.add('selected');
    cselFontValue.textContent = opt.textContent;

    // _restoreAndFocus() 가 selectionchange 를 발화시키면 _syncFontDropdowns 가
    // execCommand 호출 전에 실행되어 드롭다운을 이전 값으로 되돌립니다.
    // 플래그로 이 구간의 _syncFontDropdowns 를 억제합니다.
    _applyingFont = true;
    _restoreAndFocus();
    _applyFont(opt.dataset.value);
    _applyingFont = false;

    _closeAllLists();
  });
});

// ── 폰트 크기 드롭다운 ────────────────────────────────────────────────────────
cselSizeTrigger.addEventListener('mousedown', function (e) {
  e.preventDefault();
  _saveSelection();
});

cselSizeTrigger.addEventListener('click', function () {
  var isOpen = listSize.classList.contains('visible');
  _closeAllLists();
  _closePanel();
  if (!isOpen) {
    _positionList(cselSizeTrigger, listSize);
    listSize.classList.add('visible');
    cselSizeTrigger.classList.add('open');
  }
});

// ── 폰트 크기 적용 ────────────────────────────────────────────────────────────
/**
 * 폰트 크기를 안전하게 적용합니다.
 *
 * collapsed(커서만): insertHTML 로 크기 지정 span 을 삽입하고 커서를 span 안에 배치.
 *   → execCommand('fontSize') 는 기존 부모 font 요소를 변경하므로 사용하지 않음.
 * non-collapsed(선택): execCommand('fontSize', '7') + style 교체.
 *   → 선택 범위에만 적용되므로 기존 내용에 영향 없음.
 *
 * @param {string} px - 적용할 폰트 크기 (숫자 문자열, 단위 px)
 */

/**
 * 에디터를 초기화하고 지정한 서식(color + sizePx + font)을 한 번에 적용합니다.
 *
 * _applyFontSize → _applyFont 를 순서대로 호출하면 _applyFont 의 빈 에디터 판정이
 * _applyFontSize 가 삽입한 \u200B span 을 삭제하고 CSS 기본 크기(14px)로 덮어쓰는
 * 구조적 문제가 발생합니다. 이 함수는 세 속성을 단일 insertHTML 로 처리하여 해당
 * 문제를 원천 차단합니다.
 *
 * 사용 시점:
 *   · 팝업 최초 실행 (init)
 *   · 사용자가 텍스트 전체 삭제 (input 핸들러)
 *
 * @param {{ sizePx: number, font: string, color: string }} fmt
 */
function _resetEditorFormat(fmt) {
  editor.innerHTML = '';
  editor.focus();

  // insertHTML 에는 유효한 Range 가 필요합니다.
  // editor.focus() 만으로는 빈 contenteditable 에 Range 가 생성되지 않으므로 직접 생성합니다.
  var r0 = document.createRange();
  r0.setStart(editor, 0);
  r0.collapse(true);
  var s0 = window.getSelection();
  s0.removeAllRanges();
  s0.addRange(r0);

  var elId = '_rst_' + Date.now();
  _applyingFormat = true;
  document.execCommand('insertHTML', false,
    '<span id="' + elId + '"'
    + ' style="font-size:' + fmt.sizePx + 'px;'
    + ' color:' + fmt.color + ';'
    + ' font-family:' + fmt.font + ';"'
    + '>\u200B</span>');
  _applyingFormat = false;

  var el = editor.querySelector('[id="' + elId + '"]');
  if (el) {
    el.removeAttribute('id');
    var r1 = document.createRange();
    r1.setStart(el.firstChild, el.firstChild.length);
    r1.collapse(true);
    var s1 = window.getSelection();
    s1.removeAllRanges();
    s1.addRange(r1);
  }
}

function _applyFontSize(px) {
  // 에디터가 비어있으면 이전 포맷 컨텍스트를 완전히 제거
  if (!editor.textContent.replace(/\u200B/g, '').trim()) {
    editor.innerHTML = '';
    editor.focus();
    // innerHTML = '' 로 DOM 노드가 모두 제거되어 기존 _savedRange 가 무효화됩니다.
    // editor.focus() 만으로는 Range 가 생성되지 않아 rangeCount === 0 이 되므로
    // 빈 에디터의 시작점에 커서를 직접 생성합니다.
    var emptyRange = document.createRange();
    emptyRange.setStart(editor, 0);
    emptyRange.collapse(true);
    var emptySel = window.getSelection();
    emptySel.removeAllRanges();
    emptySel.addRange(emptyRange);
  }

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  if (sel.isCollapsed) {
    // ── 커서 위치의 현재 서식 읽기 ───────────────────────────────────────────
    // insertHTML 로 삽입된 span 은 기존 <font face> 밖에 배치될 수 있으므로
    // 현재 font-family 도 명시적으로 포함시킵니다.
    var node2     = sel.anchorNode;
    var anchorEl2 = (node2 && node2.nodeType === Node.TEXT_NODE) ? node2.parentElement : node2;

    var currentColor = document.queryCommandValue('foreColor') || _appliedColor;
    var currentFont  = '';
    var cur2 = (anchorEl2 && editor.contains(anchorEl2) && anchorEl2 !== editor) ? anchorEl2 : null;
    while (cur2 && cur2 !== editor) {
      if (cur2.tagName === 'FONT' && cur2.getAttribute('face')) {
        currentFont = cur2.getAttribute('face');
        break;
      }
      if (cur2.style && cur2.style.fontFamily) {
        currentFont = cur2.style.fontFamily;
        break;
      }
      cur2 = cur2.parentElement;
    }

    var spanId = '_fs_' + Date.now();
    var spanStyle = 'font-size:' + px + 'px; color:' + currentColor + ';'
      + (currentFont ? ' font-family:' + currentFont + ';' : '');

    // insertHTML 은 동기적으로 input 이벤트를 발화합니다.
    // input 핸들러가 빈 에디터 판정으로 innerHTML 을 초기화하거나 execCommand 를
    // 재귀 호출하는 것을 막기 위해 플래그를 세웁니다.
    _applyingFormat = true;
    document.execCommand('insertHTML', false,
      '<span id="' + spanId + '" style="' + spanStyle + '">\u200B</span>');
    _applyingFormat = false;

    var span = editor.querySelector('span[id="' + spanId + '"]');
    if (span) {
      span.removeAttribute('id');
      // 커서를 span 내부 텍스트 끝에 위치시킴 → 이후 입력이 이 span 안으로 흐름
      var r = document.createRange();
      r.setStart(span.firstChild, span.firstChild.length);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  } else {
    // ── 텍스트 선택된 경우: 선택 범위에만 적용 ──────────────────────────────
    document.execCommand('fontSize', false, '7');
    editor.querySelectorAll('font[size="7"]').forEach(function (el) {
      el.removeAttribute('size');
      el.style.fontSize = px + 'px';
    });
  }
}

/**
 * 폰트 패밀리를 안전하게 적용합니다.
 *
 * execCommand('fontName') 은 collapsed 커서에서 "pending format" 만 설정합니다.
 * 커서가 기존 <font face> 또는 <span> 안에 있으면 이후 입력 문자가 부모 요소
 * 폰트를 상속하여 pending format 이 무시됩니다 (_applyFontSize 와 동일한 문제).
 *
 * · collapsed (커서만) : insertHTML 로 <font face> 요소 삽입 후 커서를 내부에 위치
 *                        → 기존 부모 컨텍스트에서 완전히 분리됨
 * · non-collapsed (선택) : execCommand('fontName') 으로 선택 범위에만 적용
 *
 * @param {string} fontName - 적용할 폰트 패밀리 이름
 */
function _applyFont(fontName) {
  // 에디터가 비어있으면 _applyFontSize 와 동일하게 컨텍스트를 초기화
  if (!editor.textContent.replace(/\u200B/g, '').trim()) {
    editor.innerHTML = '';
    editor.focus();
    var emptyRange = document.createRange();
    emptyRange.setStart(editor, 0);
    emptyRange.collapse(true);
    var emptySel = window.getSelection();
    emptySel.removeAllRanges();
    emptySel.addRange(emptyRange);
  }

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  if (sel.isCollapsed) {
    // ── 커서만 있는 경우: insertHTML 로 <font face> 삽입 후 커서를 내부에 위치 ──
    // ── 커서 위치의 현재 서식 읽기 ───────────────────────────────────────────
    // insertHTML 로 삽입된 요소는 Chromium 의 DOM 정규화에 의해 기존
    // <span style="font-size"> 밖에 배치될 수 있습니다.
    // font-size 와 color 를 명시적으로 포함시켜 서식 손실을 방지합니다.
    var node         = sel.anchorNode;
    var anchorEl     = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
    var currentColor = document.queryCommandValue('foreColor') || _appliedColor;
    var currentSize  = (anchorEl && editor.contains(anchorEl))
      ? window.getComputedStyle(anchorEl).fontSize   // "20px" 형식
      : '';

    var fId = '_ff_' + Date.now();
    var inlineStyle = 'color:' + currentColor + ';'
      + (currentSize ? 'font-size:' + currentSize + ';' : '');

    _applyingFormat = true;
    document.execCommand('insertHTML', false,
      '<font face="' + fontName + '" id="' + fId + '" style="' + inlineStyle + '">\u200B</font>');
    _applyingFormat = false;

    var fontEl = editor.querySelector('[id="' + fId + '"]');
    if (fontEl) {
      fontEl.removeAttribute('id');
      var r = document.createRange();
      r.setStart(fontEl.firstChild, fontEl.firstChild.length);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  } else {
    // ── 텍스트 선택된 경우: 선택 범위에만 적용 ──────────────────────────────
    document.execCommand('fontName', false, fontName);
  }
}


listSize.querySelectorAll('.csel-option').forEach(function (opt) {
  opt.addEventListener('mousedown', function (e) { e.preventDefault(); });
  opt.addEventListener('click', function () {
    var px = opt.dataset.value;

    // 선택 표시 갱신
    listSize.querySelectorAll('.csel-option').forEach(function (o) { o.classList.remove('selected'); });
    opt.classList.add('selected');
    cselSizeValue.textContent = px;

    _restoreAndFocus();
    _applyFontSize(px);
    _closeAllLists();
  });
});

// ── 컬러 패널 프리셋 팔레트 ───────────────────────────────────────────────────
var PRESET_COLORS = [
  '#000000','#434343','#666666','#999999','#B7B7B7','#D9D9D9','#EFEFEF','#FFFFFF',
  '#FF0000','#FF4500','#FF9900','#FFD700','#FFFF00','#9ACD32','#32CD32','#00C000',
  '#00CED1','#00BFFF','#1E90FF','#4169E1','#0000CD','#6A0DAD','#8B008B','#C71585',
  '#FF1493','#FF69B4','#FF6347','#CD853F','#8B4513','#556B2F','#2E8B57','#008080',
];

function _updatePreview(hex) {
  _pendingColor               = hex;
  previewBox.style.background = hex;
  previewHex.textContent      = hex.toUpperCase();
}

function _updateApplied(hex) {
  _appliedColor                    = hex;
  colorTriggerBar.style.background = hex;
}

function _buildColorGrid() {
  PRESET_COLORS.forEach(function (hex) {
    var sw          = document.createElement('div');
    sw.className    = 'color-swatch';
    sw.style.background = hex;
    sw.dataset.color    = hex;
    sw.title            = hex.toUpperCase();

    sw.addEventListener('mousedown', function (e) { e.preventDefault(); });
    sw.addEventListener('click', function () {
      colorGrid.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
      sw.classList.add('selected');
      customColorPicker.value             = hex;
      customColorPreview.style.background = hex;
      _updatePreview(hex);
    });

    colorGrid.appendChild(sw);
  });
}

// ── 컬러 패널 열기/닫기 ───────────────────────────────────────────────────────
function _openPanel() {
  var rect   = colorTrigger.getBoundingClientRect();
  var panelW = 210;
  var left   = rect.left;
  var top    = rect.bottom + 4;

  if (left + panelW > window.innerWidth - 4) left = window.innerWidth - panelW - 4;

  colorPanel.style.left = left + 'px';
  colorPanel.style.top  = top  + 'px';
  colorPanel.classList.add('visible');
  colorTrigger.classList.add('panel-open');

  _updatePreview(_appliedColor);
  customColorPicker.value             = _appliedColor;
  customColorPreview.style.background = _appliedColor;
}

function _closePanel() {
  colorPanel.classList.remove('visible');
  colorTrigger.classList.remove('panel-open');
}

colorTrigger.addEventListener('mousedown', function (e) {
  e.preventDefault();
  _saveSelection();
});

colorTrigger.addEventListener('click', function () {
  _closeAllLists();
  if (colorPanel.classList.contains('visible')) {
    _closePanel();
  } else {
    _openPanel();
  }
});

// 패널 내부 mousedown 전파 차단 (customColorPicker 제외)
colorPanel.addEventListener('mousedown', function (e) {
  if (e.target === customColorPicker) return;
  e.preventDefault();
});

// ── 커스텀 컬러 피커 ──────────────────────────────────────────────────────────
customColorPicker.addEventListener('input', function () {
  customColorPreview.style.background = customColorPicker.value;
  colorGrid.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
  _updatePreview(customColorPicker.value);
});

customColorPicker.addEventListener('change', function () {
  customColorPreview.style.background = customColorPicker.value;
  _updatePreview(customColorPicker.value);
});

// ── [확인]: focus 복원 후 foreColor 적용 ──────────────────────────────────────
btnApplyColor.addEventListener('click', function () {
  var color = _pendingColor;
  _restoreAndFocus();
  document.execCommand('foreColor', false, color);
  _updateApplied(color);
  _closePanel();
});

// ── 외부 클릭 시 모든 패널/드롭다운 닫기 ─────────────────────────────────────
document.addEventListener('mousedown', function (e) {
  var inFont  = cselFontTrigger.contains(e.target) || listFont.contains(e.target);
  var inSize  = cselSizeTrigger.contains(e.target) || listSize.contains(e.target);
  var inColor = colorPanel.contains(e.target)      || colorTrigger.contains(e.target);

  if (!inFont && !inSize) _closeAllLists();
  if (!inColor && colorPanel.classList.contains('visible')) _closePanel();
});

// ── 툴바 상태 동기화 ──────────────────────────────────────────────────────────
/**
 * 커서/선택 위치의 폰트 패밀리·크기를 읽어 드롭다운 UI 에 반영합니다.
 *
 * 호출 시점: _syncToolbarState() 내부 → selectionchange 경로를 통해
 *   마우스 클릭 이동, 방향키 이동, 드롭다운 적용 후 모두 자동 갱신됩니다.
 *
 * 읽기 전략
 *   · 폰트 패밀리 : DOM 직접 탐색 (<font face> / style.fontFamily) → queryCommandValue 보완
 *   · 폰트 크기   : getComputedStyle(el).fontSize (px 파싱) — 목록에 없는 크기도 숫자로 표시
 */
function _syncFontDropdowns() {
  // 폰트 적용 시퀀스 중에는 실행하지 않습니다.
  // (_restoreAndFocus → execCommand 사이에 selectionchange 가 발화되어
  //  드롭다운을 이전 값으로 덮어쓰는 것을 방지합니다.)
  if (_applyingFont) return;

  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  // 커서가 속한 DOM 노드 — 텍스트 노드이면 부모 엘리먼트로 올라감
  var node = sel.anchorNode;
  var el   = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
  if (!el || !editor.contains(el)) return;

  // ── 폰트 패밀리 ─────────────────────────────────────────────────────────
  // queryCommandValue('fontName') 은 Chromium/Electron 에서 커서가 <font> 조상 안에
  // 있어도 빈 문자열을 반환하는 경우가 있으므로 DOM 직접 탐색을 우선합니다.
  //
  // execCommand('fontName') 은 DOM 에 <font face="..."> 요소를 생성하므로
  // anchorNode 에서 editor 까지 올라가며 face 속성 또는 style.fontFamily 를 읽습니다.
  var detectedFont = '';
  var cur = el;
  while (cur && cur !== editor && cur !== document.body) {
    if (cur.tagName === 'FONT' && cur.getAttribute('face')) {
      detectedFont = cur.getAttribute('face').replace(/['"]/g, '').trim();
      break;
    }
    if (cur.style && cur.style.fontFamily) {
      detectedFont = cur.style.fontFamily.replace(/['"]/g, '').trim();
      break;
    }
    cur = cur.parentElement;
  }
  // DOM 탐색 실패 시 queryCommandValue 로 보완 (collapsed 커서 pending 포맷 대응)
  if (!detectedFont) {
    detectedFont = (document.queryCommandValue('fontName') || '').replace(/['"]/g, '').trim();
  }

  var normFont = detectedFont.toLowerCase();
  if (normFont) {
    listFont.querySelectorAll('.csel-option').forEach(function (opt) {
      var optNorm = (opt.dataset.value || '').toLowerCase();
      if (optNorm === normFont) {
        opt.classList.add('selected');
        cselFontValue.textContent = opt.textContent;
      } else {
        opt.classList.remove('selected');
      }
    });
  }

  // ── 폰트 크기 ───────────────────────────────────────────────────────────
  // getComputedStyle 은 상속 포함 실제 렌더 크기를 "14px" 형식으로 반환
  var computed = window.getComputedStyle(el).fontSize;
  var pxNum    = computed ? Math.round(parseFloat(computed)) : 0;

  if (pxNum > 0) {
    var sizeMatched = false;
    listSize.querySelectorAll('.csel-option').forEach(function (opt) {
      var match = parseInt(opt.dataset.value, 10) === pxNum;
      opt.classList.toggle('selected', match);
      if (match) {
        cselSizeValue.textContent = opt.dataset.value;
        sizeMatched = true;
      }
    });
    // 목록에 없는 크기도 숫자로 표시 (selected 항목은 없는 상태)
    if (!sizeMatched) cselSizeValue.textContent = String(pxNum);
  }
}

/**
 * 커서/선택 위치의 서식 상태를 툴바 버튼 active 에 반영합니다.
 * 폰트 패밀리·크기 드롭다운도 함께 동기화합니다.
 */
function _syncToolbarState() {
  btnBold.classList.toggle('active',      document.queryCommandState('bold'));
  btnItalic.classList.toggle('active',    document.queryCommandState('italic'));
  btnStrike.classList.toggle('active',    document.queryCommandState('strikeThrough'));
  btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
  _syncFontDropdowns();
}

document.addEventListener('selectionchange', function () {
  if (document.activeElement === editor || editor.contains(document.activeElement)) {
    _syncToolbarState();
  }
});

// ── 닫기 ─────────────────────────────────────────────────────────────────────
btnClose.addEventListener('click', function () { win.close(); });

// ── 툴바 색상 강제 적용 ───────────────────────────────────────────────────────
/**
 * 툴바가 소스 오브 트루스 — 커서가 어디에 있든 현재 설정된 색상으로 입력됩니다.
 *
 * 표준 RTE 는 커서 위치의 기존 서식을 따르지만 이 메모 팝업은
 * 툴바에 설정된 색상이 항상 우선합니다.
 *
 * 선택 범위(non-collapsed)일 때는 적용하지 않습니다.
 * 사용자가 기존 텍스트를 선택 중이므로 개별 서식 적용을 방해하면 안 됩니다.
 */
function _applyToolbarColorAtCursor() {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
  document.execCommand('foreColor', false, _appliedColor);
}

// 마우스 클릭으로 커서 이동 시
editor.addEventListener('mouseup', function () {
  _applyToolbarColorAtCursor();
});

// 키보드 방향키/Home/End 로 커서 이동 시
editor.addEventListener('keyup', function (e) {
  var NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
  if (NAV_KEYS.indexOf(e.key) !== -1) {
    _applyToolbarColorAtCursor();
  }
});

// 에디터 내용이 모두 지워졌을 때 포맷 컨텍스트 초기화
editor.addEventListener('input', function () {
  // insertHTML 등 포맷 적용 중에는 실행하지 않습니다.
  // (insertHTML 이 동기적으로 input 을 발화하고, 핸들러 내 execCommand 가
  //  재귀 호출로 Chromium 에 의해 차단되는 것을 방지합니다.)
  if (_applyingFormat) return;

  var text = editor.textContent.replace(/​/g, '').trim();
  if (!text) {
    // 텍스트 전체 삭제 시 팝업 최초 실행 시점의 서식으로 복원합니다.
    _resetEditorFormat(_initFormat);
  }
});

// ── 초기화 ──────────────────────────────────────────────────────────────────
_initTexts();
_buildColorGrid();
_updateApplied(initColor);
customColorPreview.style.background = initColor;

// 팝업 최초 실행 시점의 서식을 저장합니다.
// 텍스트 전체 삭제 시 이 값으로 복원하여 항상 동일한 초기 상태로 돌아갑니다.
var _initSizeEl = listSize.querySelector('.csel-option.selected');
var _initFontEl = listFont.querySelector('.csel-option.selected');
var _initFormat = {
  sizePx : _initSizeEl ? parseInt(_initSizeEl.dataset.value, 10) : 28,
  font   : _initFontEl ? _initFontEl.dataset.value : 'Malgun Gothic',
  color  : initColor
};

// 에디터 초기 서식 적용 — _resetEditorFormat 으로 단일 insertHTML 처리
editor.focus();
document.execCommand('foreColor', false, _initFormat.color); // pending format fallback
_resetEditorFormat(_initFormat);
