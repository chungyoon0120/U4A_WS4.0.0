# Jodit (vendored)

- **Version**: 4.12.32
- **License**: MIT (see `LICENSE.txt`)
- **Build**: `es2018` (Chromium 93 / Electron 14 안전 — `color-mix()`/`:has()`/`oklch()` 미사용, JS는 ES2018)
- **Source**: https://cdn.jsdelivr.net/npm/jodit@4.12.32/es2018/jodit.min.{js,css}
- **Files**: `jodit.min.js`, `jodit.min.css` (외부 폰트/이미지 의존 없음 — 아이콘=인라인 data URI)

## 용도
WS20 도움말 > **현재 앱 기술 문서**(docPopup) 의 WYSIWYG 리치텍스트 에디터.
원본 UI5 RichTextEditor(TinyMCE) 대체. (Monaco=소스편집이라 문서 WYSIWYG 에 안 맞아 Jodit 채택.)

## 로딩 (Electron nodeIntegration)
webpack UMD 라 `<script>` 태그로는 `module.exports` 로 빠진다 → 소비처(`Popups/docPopup/frame.js`)가
`require(PATH.join(APPPATH,"lib","jodit","jodit.min.js")).Jodit` 로 로드. CSS 만 `<link>`.

## 테마
`theme: 'u4a'` → 컨테이너에 `.jodit_theme_u4a` 클래스. 그 클래스에서 Jodit 의 `--jd-*` CSS 변수를
공통 의미 토큰(`var(--app-bg/--surface/--text/--divider/--accent/...)`)에 매핑(`docPopup/frame.css`).
→ `data-theme` 캐스케이드로 테마 5종/라이트·다크 자동 추종(JS 재init 불필요).

## 업그레이드 시
같은 es2018 빌드의 `jodit.min.js`/`jodit.min.css` 만 교체. 새 버전이 추가한 `--jd-*` 변수가 있으면
`frame.css` 의 `.jodit_theme_u4a` 매핑 보강. CSS 가 `color-mix()`/`:has()` 도입했는지 Chromium93 호환 재확인.
