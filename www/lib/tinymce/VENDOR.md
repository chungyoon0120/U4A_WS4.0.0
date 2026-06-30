# TinyMCE (vendored, self-hosted)

- **Version**: 6.8.6 (6-latest)
- **License**: MIT (see `license.txt`) — ★v7+ 는 GPLv2+ 라 독점 배포에 부적합 → **6.x 최신(MIT)** 고정
- **Source**: npm `tinymce@6.8.6` (https://registry.npmjs.org/tinymce/-/tinymce-6.8.6.tgz)
- **용도**: WS20 도움말 > **현재 앱 기술 문서**(docPopup) WYSIWYG. 원본 UI5 RichTextEditor(=TinyMCE4) 대체.

## Chromium 93 (Electron 14) 안전성
- oxide/oxide-dark 스킨 `skin.min.css` 의 `:has()` 는 **파일브라우저 디렉터리 트리 전용**(미사용 기능) — 우리 사용범위(툴바/메뉴/다이얼로그/편집영역)엔 영향 없음.
- content(편집영역) CSS·핵심 스킨에 `color-mix()`/`oklch()`/`@container` 없음.

## 트림(용량 8.3MB → 2.3MB)
- 제거: 비-min 중복(`*.js`/`*.css` 원본), 문서(CHANGELOG/README/bower/composer/notices/d.ts/tinymce.js), 레거시 스킨(`skins/ui/tinymce-5*`, `skins/content/tinymce-5*`, `document`, `writer`).
- 유지: `tinymce.min.js`, `license.txt`, `package.json`, `icons/default`, `models/dom`, `themes/silver`, `skins/ui/oxide(+dark)`, `skins/content/default(+dark)`, `plugins/*`(.min).
- ★**함정**: `find ! -name "*.min.js" -delete` 로 비-min 을 지우면 **런타임에 별도 .js 를 지연 로드하는 플러그인이 깨진다**.
  - `plugins/help` → `js/i18n/keynav/<lang>.js`(비-min) 로드 → ERR_FILE_NOT_FOUND → unhandledrejection → Critical Error. **help/emoticons 플러그인 폴더 제거 + config 에서 미사용**.
  - 다른 사용 플러그인(advlist/lists/link/image/table/code/charmap/searchreplace/visualblocks/fullscreen/autolink)은 `plugin.min.js` 외 런타임 리소스 없음(안전). 플러그인 추가 시 `plugins/<name>/` 에 비-min .js 리소스 있는지 확인.

## 로딩 (Electron nodeIntegration)
- `Popups/docPopup/frame.html` 가 `<script src=".../lib/tinymce/tinymce.min.js">` 로 로드.
- TinyMCE 는 `window.tinymce` 를 **항상 전역 세팅**(UMD 분기와 무관)하고, 스킨/플러그인 **baseURL 은 이 script 의 src 로 자동감지**(file://). → 별도 baseURL 설정 불필요. (로드 동안 `module`/`exports` 잠시 숨김 = 방어용, index.html jQuery 패턴.)

## 테마
- oxide 스킨은 색이 하드코딩(--변수 매핑 불가) → `frame.js` 가 배경 휘도로 **light=oxide / dark=oxide-dark** 스킨 선택, 편집영역(iframe)은 `content_style` 로 공통 토큰값(`--surface/--text/--accent/--divider`) 주입. **테마 변경 시 재init**(스킨 스왑·본문색 갱신, 내용/선택 보존).
- purple/red/green 액센트까지 완벽 일치는 oxide 한계 — 필요시 `.tox` 버튼/툴바 색 스코프 오버라이드로 보강.

## 업그레이드 시
6.x 범위 내 최신 `tinymce@6.x` 재트림. **v7+ 는 GPL 이라 금지**(독점 배포). 새 스킨 CSS 가 `color-mix()`/`:has()`(핵심 경로)를 도입했는지 Chromium93 재확인.
