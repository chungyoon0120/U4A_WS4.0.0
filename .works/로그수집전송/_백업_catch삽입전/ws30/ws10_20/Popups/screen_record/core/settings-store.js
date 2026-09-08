'use strict';

/**
 * @file core/settings-store.js
 * @description screen_record 모듈 영구 설정 저장소.
 *
 * ── 저장 경로 ──────────────────────────────────────────────────────────────
 *   {userData}/settings/screen_record/settings.json
 *   디렉터리가 없으면 init() 시점에 재귀적으로 생성합니다.
 *
 * ── 정합성 보장 ────────────────────────────────────────────────────────────
 *   load() 호출 시 아래 경우 모두 기본값으로 자동 복구합니다.
 *     · 파일이 없거나 읽기 실패
 *     · 파일 내용이 유효한 JSON이 아님
 *     · 파싱 결과가 객체가 아님 (배열, null, 원시값 등)
 *     · 알려진 필드의 타입/값 범위가 올바르지 않음
 *
 * ── 멱등성 ────────────────────────────────────────────────────────────────
 *   init()은 동일 경로로 여러 번 호출해도 안전합니다.
 *
 * ── 사용 예시 ─────────────────────────────────────────────────────────────
 * @example
 *   // remote.require 방식 (메인 프로세스 단일 인스턴스)
 *   const settingsStore = remote.require(path.join(__dirname, '../../core/settings-store'));
 *   settingsStore.init(remote.app.getPath('userData'));
 *
 *   const s = settingsStore.load();
 *   // → { outputDir, frameRate, videoBitsPerSecond, videoFormat, theme }
 *
 *   settingsStore.save({ ...s, frameRate: 60 });
 *   settingsStore.reset();  // 모든 값 기본값으로 초기화
 */

const fs   = require('fs');
const path = require('path');

// ── 기본값 ────────────────────────────────────────────────────────────────────
/**
 * 모든 설정의 기본값.
 * 새 필드 추가 시 반드시 여기에도 기본값을 선언해야
 * _validateSettings()의 타입 검사가 올바르게 동작합니다.
 *
 * @type {{
 *   outputDir          : string,
 *   frameRate          : number,
 *   videoBitsPerSecond : number,
 *   videoFormat        : 'webm-vp9'|'webm-vp8'|'webm-h264',
 *   theme              : 'dark'|'light',
 * }}
 */
const DEFAULTS = {
  outputDir          : '',           // 빈 문자열 = 시스템 Videos 폴더
  frameRate          : 30,
  videoBitsPerSecond : 2500000,
  videoFormat        : 'webm-h264',  // 'webm-vp9' | 'webm-vp8' | 'webm-h264'
  theme              : 'dark',       // 'dark' | 'light'
};

// 허용된 enum 값 목록 — 새 포맷/테마 추가 시 여기만 수정
const VALID_VIDEO_FORMATS = ['webm-vp9', 'webm-vp8', 'webm-h264'];
const VALID_THEMES        = ['dark', 'light'];

// ── 내부 상태 ─────────────────────────────────────────────────────────────────
/** 설정 파일 절대 경로. init() 호출 전에는 null. */
let _filePath = null;

// ── 내부 유틸 ─────────────────────────────────────────────────────────────────
/**
 * 설정 파일이 위치할 디렉터리를 재귀적으로 생성합니다.
 * 이미 존재하면 아무 일도 하지 않습니다.
 *
 * @param {string} dir - 생성할 디렉터리 경로
 */
function _ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('[settings-store] 디렉터리 생성 실패:', dir, err);
  }
}

/**
 * 파싱된 설정 객체의 정합성을 검사합니다.
 *
 * ─ 검사 항목 ────────────────────────────────────────────────────────────────
 *   · 객체 여부 (배열·null·원시값 모두 거부)
 *   · 각 알려진 필드가 존재할 경우 타입/값 범위 검사
 *
 * 미래에 필드가 추가되면 checks 배열에 항목을 추가하세요.
 *
 * @param {unknown} obj - 검사 대상
 * @returns {boolean}   정합성 OK이면 true
 */
function _validateSettings(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

  const checks = [
    // outputDir: 문자열
    () => !('outputDir'          in obj) || typeof obj.outputDir === 'string',
    // frameRate: 양의 유한수
    () => !('frameRate'          in obj) || (typeof obj.frameRate === 'number' && obj.frameRate > 0 && Number.isFinite(obj.frameRate)),
    // videoBitsPerSecond: 양의 유한수
    () => !('videoBitsPerSecond' in obj) || (typeof obj.videoBitsPerSecond === 'number' && obj.videoBitsPerSecond > 0 && Number.isFinite(obj.videoBitsPerSecond)),
    // videoFormat: 허용된 enum 값
    () => !('videoFormat'        in obj) || VALID_VIDEO_FORMATS.includes(obj.videoFormat),
    // theme: 허용된 enum 값
    () => !('theme'              in obj) || VALID_THEMES.includes(obj.theme),
  ];

  return checks.every(fn => {
    try { return fn(); } catch { return false; }
  });
}

/**
 * 설정 파일을 기본값으로 덮어씁니다.
 * load() 내에서 정합성 오류 감지 시 자동 호출됩니다.
 */
function _repairToDefaults() {
  if (!_filePath) return;
  try {
    _ensureDir(path.dirname(_filePath));
    fs.writeFileSync(_filePath, JSON.stringify(DEFAULTS, null, 2), 'utf8');
    console.info('[settings-store] 설정 파일을 기본값으로 복구했습니다.');
  } catch (err) {
    console.error('[settings-store] 기본값 복구 실패:', err);
  }
}

// ── 공개 API ──────────────────────────────────────────────────────────────────
/**
 * 설정 파일 경로를 초기화합니다.
 *
 * - 저장 경로: {userDataPath}/settings/screen_record/settings.json
 * - 디렉터리가 없으면 재귀적으로 생성합니다.
 * - 동일 경로로 여러 번 호출해도 안전합니다 (멱등성 보장).
 *
 * @param {string} userDataPath - app.getPath('userData') 반환값
 */
function init(userDataPath) {
  if (_filePath) return; // 이미 초기화됨

  const dir = path.join(userDataPath, 'settings', 'screen_record');
  _ensureDir(dir);
  _filePath = path.join(dir, 'settings.json');
}

/**
 * 설정 파일을 읽어 반환합니다.
 *
 * ─ 정합성 실패 시 자동 복구 ─────────────────────────────────────────────────
 *   아래 상황 모두 기본값으로 복구 후 DEFAULTS를 반환합니다.
 *     · 파일 미존재     → 복구 없이 DEFAULTS 반환 (첫 실행 정상 케이스)
 *     · 파일 읽기 오류  → 파일을 기본값으로 덮어쓰고 DEFAULTS 반환
 *     · JSON 파싱 오류  → 파일을 기본값으로 덮어쓰고 DEFAULTS 반환
 *     · 정합성 검사 실패 → 파일을 기본값으로 덮어쓰고 DEFAULTS 반환
 *
 * @returns {typeof DEFAULTS}
 */
function load() {
  if (!_filePath) return { ...DEFAULTS };

  // ① 파일 존재 여부 확인 (첫 실행: 정상 케이스이므로 복구 없이 DEFAULTS 반환)
  if (!fs.existsSync(_filePath)) return { ...DEFAULTS };

  // ② 파일 읽기
  let raw;
  try {
    raw = fs.readFileSync(_filePath, 'utf8');
  } catch (err) {
    console.error('[settings-store] 파일 읽기 실패, 기본값으로 복구합니다:', err);
    _repairToDefaults();
    return { ...DEFAULTS };
  }

  // ③ JSON 파싱 — 빈 파일, 깨진 JSON 등 모두 대응
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[settings-store] JSON 파싱 실패, 기본값으로 복구합니다. 파일 내용:', raw.slice(0, 120));
    _repairToDefaults();
    return { ...DEFAULTS };
  }

  // ④ 정합성 검사 — 타입·enum 범위 오류 시 복구
  if (!_validateSettings(parsed)) {
    console.warn('[settings-store] 설정 정합성 오류, 기본값으로 복구합니다:', JSON.stringify(parsed));
    _repairToDefaults();
    return { ...DEFAULTS };
  }

  // DEFAULTS로 누락 필드를 채운 뒤 반환
  return { ...DEFAULTS, ...parsed };
}

/**
 * 설정을 파일에 저장합니다.
 *
 * - DEFAULTS와 병합하여 저장하므로 누락 필드가 발생하지 않습니다.
 * - save() 직전에도 디렉터리 존재를 보장합니다.
 *   (디렉터리가 외부에서 삭제된 경우에도 정상 동작)
 *
 * @param {Partial<typeof DEFAULTS>} settings
 */
function save(settings) {
  if (!_filePath) return;
  try {
    _ensureDir(path.dirname(_filePath));
    const merged = { ...DEFAULTS, ...settings };
    fs.writeFileSync(_filePath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error('[settings-store] save error:', err);
  }
}

/**
 * 설정 파일을 기본값으로 완전 초기화합니다.
 * 설정 팝업의 "기본값으로 초기화" 버튼에서 호출합니다.
 */
function reset() {
  if (!_filePath) return;
  try {
    _ensureDir(path.dirname(_filePath));
    fs.writeFileSync(_filePath, JSON.stringify(DEFAULTS, null, 2), 'utf8');
  } catch (err) {
    console.error('[settings-store] reset error:', err);
  }
}

/**
 * 설정 파일이 실제로 존재하는지 여부를 반환합니다.
 *
 * - open() 호출 시 테마 우선순위 결정에 사용됩니다.
 *   · true  → 사용자가 저장한 설정이 있음 → 저장된 테마 우선
 *   · false → 첫 실행 등 저장된 설정 없음 → open() 파라미터 테마 우선
 *
 * @returns {boolean}
 */
function hasSettings() {
  return _filePath ? fs.existsSync(_filePath) : false;
}

module.exports = { init, load, save, reset, hasSettings, DEFAULTS };
