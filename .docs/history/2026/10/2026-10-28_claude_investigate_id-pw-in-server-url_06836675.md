# 서버 주소에 아이디·비번을 붙이는 곳 — www · electron 전수 조사

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「소스를 전수 검사해서 서버 url호출 시 id,pw 넣는 부분이 또 있는지 확인해줘」
  (WS20 미리보기 건에서 `design/preview/index.js` 두 줄을 막은 뒤 같은 것이 더 있는지)

## 조사 범위·방법

- 범위 = `www` 전체 + `electron` 전체
- 제외 = `node_modules` · `_` 로 시작하는 폴더·파일 · `.min.js` · 남의 라이브러리
  (aceeditor · monaco · openui5 · sapui · jquery · bootstrap · snippets)
- 찾은 패턴 4가지
  ① `sap-user` / `sap-password` / `sap_user` / `sap_password`
  ② `.PW` 를 쓰는 곳 전부 (19곳) — 한 줄씩 읽어 분류
  ③ `j_username` / `j_password` / `Authorization: Basic` / `btoa(` → **0건**
  ④ 다른 이름(`password=` `passwd=` `pwd=`)을 주소에 붙이는 것 → **0건**

## ★ URL 쿼리에 비번이 붙는 곳 — 항상 (배포본 포함)

| 파일 | 줄 | 무엇 |
|---|---|---|
| `www/ws30/ws10_20/design/js/callDAMISampleDownloadPopup.js` | 1639~1640 | DAMI 샘플 내려받기 — 앱 실행 주소 (`l_page.goto`) |
| `www/ws30/ws10_20/design/js/callFavIconPopup.js` | 532 | 만든 문자열을 451행(글꼴 `.woff2`) · 592행(테마 `library.css`) 주소 뒤에 붙임 |
| `www/ws30/ws10_20/js/fnDialogPopupOpener.js` | 3160 | 아이콘 목록 창 주소 |

## URL 쿼리에 붙지만 개발 모드(no-build)에서만

| 파일 | 줄 | 조건 |
|---|---|---|
| `www/ws30/ws10_20/Popups/webDynConversionLog/Popup/views/vw_main/control.js` | 450 · 578 | `REMOTE.app.isPackaged === false` |
| `www/lib/ws/SupportPackageChecker/index.js` | 215~216 | `!REMOTE.app.isPackaged` (FormData body) |

## 주소가 아닌 것 — 참고

- **form POST body** (주소창·DevTools 주소에 안 찍힘)
  - `design/js/callP13nDesignDataPopup.js:1051·1054`
  - `js/fnP13nDesignPopupOpen.js:583~584`
  - `Login/Login.js:870~871` (로그인 그 자체)
- **바깥 프로그램 실행 인자**
  - PowerShell = `help/u4a_helpdoc/main.js:939` · `lib/ws/electron-updater-sap.js:411`
  - VBS(SAP GUI 실행) = `js/ws_fn_04.js:308`
  - ※ 그 ps1 안에서 주소에 붙는지는 **안 봤다**

## ★소스에 실제 아이디·비번이 글자로 박힌 곳

| 파일 | 줄 | 상태 |
|---|---|---|
| `www/lib/ws/electron-updater-sap.js` | 8 · 63 | 주석 |
| `www/ws30/ws10_20/Popups/ShortCutCreator/js/frame.js` | 10 | 주석 |
| `www/ws30/ws10_20/design/testFolder/AiInterface/frame.html` | 18 | **주석 아님** — iframe src 에 그대로 (testFolder) |

## 이미 막아 둔 곳 (참고)

- `design/preview/index.js:4639~4640` — 2026-10-28 장군님 결정으로 주석 처리
- `js/fnFavIconPopupOpen.js:329·388` · `js/workers/u4aWsServerSessionWorker.js:35~36` ·
  `Popups/importExportPopup/js/index.js:126·283~284` · `Popups/releaseNotePopup/js/main.js:252~253`
  · `main_latest.js:300~301` · `design/js/uiPreviewArea.js:254·257·318~319`
  · `js/fnDialogPopupOpener.js:3584~3585` — 전부 주석, 쿠키로 인증

## 아직 안 한 것 · 못 정한 것

- **아무것도 고치지 않았다** (조사만)
- PowerShell 스크립트(`.ps1`) 안에서 주소에 붙는지 **안 봤다**
- 위 3곳(항상 붙는 것)을 뺄지는 **장군님 결정 대기** —
  뺐을 때 그 화면이 쿠키만으로 서버를 받아 오는지는 눌러 봐야 안다
  (WS20 미리보기는 뺀 뒤에도 쿠키만으로 받아졌다)

## ★함정

- `sap-user` / `sap-password` 만 grep 하면 **놓친다.** `.PW` 를 쓰는 곳을 전부 뽑아
  **한 줄씩 읽어** form POST · 바깥 프로그램 인자 · 주소를 갈라야 한다.
- 건수만 세면(`grep -c`) **주석과 설명 줄이 섞인다.** 19곳 중 살아 있는 주소는 3곳뿐이었다.
- `isPackaged` 조건이 붙은 것이 2곳 있다 — 「배포본에는 안 찍힌다」가 되므로 같은 급으로 묶으면 틀린다.
