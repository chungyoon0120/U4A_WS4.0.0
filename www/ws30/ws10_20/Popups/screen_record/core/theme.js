'use strict';

/**
 * @file core/theme.js
 * @description 테마 색상 정의 및 BrowserWindow 배경색 CSS 주입 유틸리티.
 *
 * ── 설계 원칙 ────────────────────────────────────────────────────────────────
 *   모든 녹화 팝업의 테마 배경색은 이 파일에서 중앙 관리합니다.
 *   새 테마나 팝업 타입이 추가되면 THEME_COLORS 만 수정하면 됩니다.
 *
 * ── 팝업 타입별 배경색 ────────────────────────────────────────────────────────
 *   panel   : 컨트롤 패널, 설정 팝업
 *   overlay : 모니터 선택, 히스토리 팝업
 *   (indicator, drawing 은 transparent 창 — CSS 주입 불필요)
 *
 * ── 사용 패턴 ────────────────────────────────────────────────────────────────
 *   // 팝업 실행 시 (did-finish-load 이후)
 *   win.webContents.on('did-finish-load', () => injectBgCss(win, theme, 'panel'));
 *
 *   // 테마 변경 시 (이미 로드된 창)
 *   injectBgCss(win, newTheme, 'panel');
 */

// ── 색상 정의 ─────────────────────────────────────────────────────────────────
/**
 * 테마 × 팝업 타입 배경색 매핑.
 *
 * 확장 시 아래 구조에 variant 또는 theme 을 추가하세요.
 *
 * @type {Record<string, Record<string, string>>}
 */
const THEME_COLORS = {
  dark: {
    panel  : '#1d232a',  // 컨트롤 패널, 설정 팝업
    overlay: '#13131F',  // 모니터 선택, 히스토리 팝업
  },
  light: {
    panel  : '#eaecee',
    overlay: '#F0F0F8',
  },
};

// ── 공개 API ──────────────────────────────────────────────────────────────────
/**
 * 테마 정보 객체를 반환합니다.
 *
 * @param {'dark'|'light'}        theme
 * @param {'panel'|'overlay'}    [variant='panel']
 * @returns {{ theme: string, BGCOL: string }}
 *
 * @example
 *   const oThemeInfo = getThemeInfo('dark', 'panel');
 *   console.log(oThemeInfo.BGCOL); // '#1d232a'
 */
function getThemeInfo(theme, variant = 'panel') {
  const palette = THEME_COLORS[theme] || THEME_COLORS.dark;
  return {
    theme,
    BGCOL: palette[variant] || palette.panel,
  };
}

/**
 * BrowserWindow의 webContents에 배경색 CSS를 주입합니다.
 *
 * ─ 호출 타이밍 ──────────────────────────────────────────────────────────────
 *   · 팝업 실행 시 : win.webContents.on('did-finish-load', ...) 콜백 내부
 *   · 테마 변경 시 : setTheme() 내부에서 각 창에 직접 호출
 *
 * ─ 주입 제외 대상 ────────────────────────────────────────────────────────────
 *   · indicator  : transparent 창 (backgroundColor: '#00000000')
 *   · drawing    : transparent 창 (backgroundColor: '#00000000')
 *   위 두 창에는 배경색 CSS 주입 시 투명도가 깨지므로 호출하지 않습니다.
 *
 * @param {Electron.BrowserWindow}  win
 * @param {'dark'|'light'}          theme
 * @param {'panel'|'overlay'}      [variant='panel']
 */
function injectBgCss(win, theme, variant = 'panel') {
  if (!win || win.isDestroyed()) return;

  const oThemeInfo = getThemeInfo(theme, variant);
  const sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeInfo.BGCOL}; }`;

  win.webContents.insertCSS(sWebConBodyCss).catch(err => {
    console.warn('[theme] insertCSS failed (winId:', win.id, '):', err && err.message);
  });
}

module.exports = { THEME_COLORS, getThemeInfo, injectBgCss };
