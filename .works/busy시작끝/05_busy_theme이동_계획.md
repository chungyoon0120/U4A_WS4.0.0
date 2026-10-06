# busy 를 공통 화면 리소스(`theme/`) 전용 파일로 — 제안

> 장군님 지시 2026-09-15
> ① 「busy도 하나의 ui인데 따로 관리할 이유는 없잖아 … 화면 처음 실행할때 가장 먼저 리소스가 로드가 되어야해」
> ② 「전용파일로 빼고 스스로 만들어서 붙이고 css는 다른거 영향 안가는 방향으로 니가 판단해서 다시 나한테 제안해」
> **2026-09-15 코드 반영 완료 · 앱 확인 전.** 테스트 = [00_현황판.md](00_현황판.md) 맨 위 UB 그룹. 결과 기록 = §6.

## 1. 정해 주실 것

| 물음 | 결정 |
|---|---|
| 아래 §2 제안대로 진행할지 | **✅ 진행 (장군님 2026-09-15)** — 메인 창 먼저 |
| 오류코드 접두 `UBSY` 사전 등록 | **✅ 등록 (장군님 2026-09-15)** |
| busy 파일이 안 불러와졌을 때 | **✅ 오류코드 로그만 (장군님 2026-09-15)** — 처음엔 앱 종료로 답하셨다가 「없을 수가 없고 테스트할 때 바로 발견된다」로 로그만으로 바꾸심 |
| 2단계 — `shell.css` 공통 busy 화면들 합치기 | **✅ 이번 작업 테스트 통과 뒤 따로 조사·제안 (장군님 2026-09-15)** |
| **CDP 자동검증 실행** | **장군님이 「CDP로 실행」 지시하실 때만.** 그 전에는 실행하지 않는다(2026-09-15 지시). §2-4 6번 전·후 대조도 지시 후에 한다 |

> ⚠️ 2026-09-15 — 지시 없이 CDP 로 앱을 재기동·자동로그인했다(코드 수정 전 스타일 값을 뽑으려던 것). 스타일 값은 **안 뽑았다.** 그 앱은 로그인된 채 떠 있다. 임시 스크립트 `.works/auto-test/_busy-style-capture.js` 를 만들어 두었다(실행 안 함).

결정된 것: 「theme 폴더로 옮긴다」 = busy 를 `theme/` 안으로 (폴더 자체는 그대로) · 전용 파일 · 화면 요소는 JS 가 스스로 만들어 붙임 · CSS 는 다른 화면에 영향 없게.

## 2. 제안

### 2-1. 새 파일

| 파일 | 담는 것 |
|---|---|
| `theme/u4a-busy.css` | 메인 창 busy 모양 (지금 `css/frame.css` 에 있는 것) |
| `theme/u4a-busy.js` | busy 켜기·끄기 + 화면 요소 만들기 (지금 `resources/index.js` 의 `setDomBusy`) |

- 전역 이름 = `U4ABusy` (`show()` / `hide()`). (계획 때 적었던 `isOpen()` 은 부르는 곳이 없어 만들지 않았다 — 2026-09-15 구현 시)
  - `U4AUI` 아래에 넣지 않는 이유: `u4a-ui.js` 3294줄이 `global.U4AUI = U4AUI` 로 **새 객체를 통째로 대입**한다. 먼저 로드된 busy 가 그 아래 있으면 지워진다.
  - 이름 규칙은 기존 `U4AUI`(u4a-ui.js)·`U4ATheme`(theme-api.js)와 맞췄다.
- 오류코드 접두 = `UBSY` (코드·사전 어디에도 없음 확인).

### 2-2. 화면 요소를 스스로 만들어 붙이는 방식

- **처음 `show()` 가 불릴 때** `<dialog>` 와 그 안의 카드·스피너·제목·문구를 만들어 `<body>` 에 붙인다. 두 번째부터는 만든 것을 다시 쓴다.
- **로드되자마자 만들지 않는 이유:** `<head>` 에서 로드되는 순간에는 `<body>` 가 아직 없어 붙일 곳이 없다. busy 를 켜는 호출은 전부 `<body>` 가 생긴 뒤에 온다(새창 = 메타 정보 수신 때, 로그인 전 첫 창 = `vw_main/control.js` 의 `show()` 앞).
- **id·class 이름은 지금과 똑같이 만든다** (`u4aWsBusyIndicator` · `u4aWsBusyTitle` · `u4aWsBusyText` 등). 그래서 아래 코드는 **안 고친다.**
  - busy 카드에 제목·문구 넣는 곳 — `js/ws_html5_shell.js` 238~245줄
  - 로그인 남은 초 표시 — `Login/Login.js` 802·826줄 (이 코드는 `setDomBusy('X')` 뒤에 돌아서 요소가 이미 있다)
  - 로그의 busy 상태 확인 — `js/ws_html5_logger.js` 616줄 (busy 를 한 번도 안 켰으면 요소가 없음 = 「busy 아님」으로 읽힌다. 뜻이 같다)
- `<body>` 가 없는데 불리면 → `[UBSY-001]` 로그 남기고 busy 안 켬. 다른 방법으로 우회하지 않는다.
- ESC 로 안 닫히게 막기, `showModal()` 실패 시 처리 — **지금 `setDomBusy` 동작 그대로** 옮긴다.
- 로그 함수(`U4ALOG`)는 이 파일보다 늦게 로드된다 → 부르는 시점에 있으면 쓰고, 없으면 `console.error` 로 남긴다.

### 2-3. 기존 코드에서 바뀌는 곳 (메인 창)

| 파일 | 바뀌는 것 |
|---|---|
| `ws10_20/index.html` | `<meta>` 바로 뒤에 `u4a-busy.css` · `u4a-busy.js` 로드 추가 (jQuery 보다 앞) · 113~119줄 `<dialog>` 삭제 |
| `resources/index.js` | `setDomBusy` **이름은 그대로**(`parent.setDomBusy` 부르는 곳 전부 안 고침). 안에서 `U4ABusy.show()/hide()` 만 부른다. `U4ABusy` 가 없으면 `RSRC` 오류코드 (§1 세 번째 물음에 따라 로그만 / 앱 종료) |
| `ws10_20/css/frame.css` | busy 규칙 삭제 — 597~718줄, 21~27줄(`#u4aWsBusyIndicator`·`.u4aWsBusyIndicator`), 48~50줄(`#u4aWsBusyIndicator>.sapUiLocalBusyIndicatorFade`: 매칭되는 자식 요소가 없어 모양 변화 0) |

- 모든 파일 **고치기 전 `_` 백업**, 저장 후 `node --check`.
- `setBusy`·`oWS.utill.fn.setBusy`(닫기 버튼 막기·작업표시줄 표시)·`ws_html5_shell.js` 는 **안 건드린다.** 지금처럼 `setDomBusy` 를 거쳐 새 파일을 부르게 된다.

### 2-4. CSS 가 다른 화면에 영향 안 가게 — 판단 근거

1. **선택자는 전부 busy 전용 이름으로 시작한다.** `*` · `html` · `body` · 맨 `dialog` · `:root` 는 쓰지 않는다. 색 변수는 **쓰기만 하고 정의하지 않는다.** → 이 파일이 busy 밖의 요소를 건드릴 방법이 없다.
2. **애니메이션 이름도 지금 이름 그대로**(`u4aWsSpin` · `u4aWsSpinRev` · `u4aWsBusyGlow` · `u4aWsBusyCardIn`). 이 이름은 `frame.css` 에만 있고 거기서 지우므로 겹침 0. `shell.css` 의 공통 busy 애니메이션(`u4a-spin` · `u4a-busy-glow` 등)과 이름이 다르다.
3. **메인 창에서 busy 이름을 건드리는 CSS 는 `frame.css` 하나뿐이다.** 메인 창이 로드하는 나머지 CSS 10개를 확인했다: `shell.css` 는 주석만, `ws10_20.css` 는 다른 이름(`u4aWsBusyDialog`, UI5 잔재). `frame.css` 에서 지우면 busy 모양의 출처가 새 파일 하나가 된다.
4. **맨 앞에 로드해도 모양이 안 바뀐다.** 색 변수(`var(--accent)` 등)는 CSS 파일 순서와 상관없이 화면을 그릴 때 값을 찾는다. 뒤에 로드되는 CSS 중 busy 이름을 쓰는 것이 없으니 덮어써질 일도 없다.
5. **반대로 busy 가 다른 CSS 에서 받는 영향은 지금과 같다(변화 없음):** `shell.css` 의 전체 `box-sizing`·스크롤바, `dialog::backdrop` 투명, `frame.css` 의 전체 탭 강조 끔.
6. **옮기기 전·후 대조 검증:** busy `<dialog>` · 카드 · 스피너 · 제목 · 문구의 계산된 스타일 값을 앱 자동검증(CDP)으로 뽑아 **전·후 값이 같은지** 비교한다. 다르면 장군님께 드리기 전에 고친다.

### 2-5. 같이 고칠 문서

- `.analy/16` §0.1 busy 칸(지금 「—」) · §2.10 설명 → 새 파일로
- `.analy/12` §6.1 파일 트리에 `u4a-busy.css` · `u4a-busy.js` 추가
- 오류코드 사전 `UBSY` (§1 두 번째 물음에 따라)

### 2-6. 착수 후 테스트 (항목은 착수 때 현황판에 올린다)

- 로그인 후 새창 — 창이 뜨는 순간 busy 가 돌고 있는지 (이전 통과 항목 재확인)
- 로그인 — 로그인 버튼 누른 뒤 busy 와 남은 초 표시
- 모달 팝업 위에서 busy 가 팝업보다 위에 보이는지
- busy 모양(카드·스피너 색)이 옮기기 전과 같은지

## 3. 이번 범위에서 빼는 것 — 공통 busy 가 사실 두 벌이다

**`theme/shell.css` 970~1089줄에 공통 busy 가 이미 하나 더 있다** (`.u4a-busy` — `<div>` + `data-busy` 토글).
앞서 04 문서에 「busy 는 theme 폴더에 없다」고 적은 것은 **틀렸다**(정정함).

| | 메인 창 busy (이번 대상) | `shell.css` 공통 busy |
|---|---|---|
| 모양 요소 | `<dialog>` + `showModal()` (모달 팝업 위에 뜸) | `<div>` 오버레이 |
| 쓰는 곳 | 메인 창(로그인·WS10·WS20·USP 등 창 안 화면 전부) | 서버리스트, 별창 팝업 frame 약 20개(bindPopup·docPopup·editorPopup·errMsgPopup·findPopup·mimeRepository·patternPopup·versionMng 등), 속성 기본값 팝업, 로그인 스피너 모양 |
| 색 | `frame.css` 규칙 (`--accent` · `--line`) | `bootstrap-skin.css` 495~502줄이 다른 변수(`--sl-surface` · `--u4a-accent`)로 덮는다 |

- 두 디자인은 주석상 「동일 디자인」이지만 **색 변수가 달라 실제 색이 다를 수 있다(미확인).** 합치면 그 화면들 모양이 바뀔 수 있어 **이번에는 안 건드린다.** → §1 네 번째 물음.
- `extopen` · `findPopup` · `ui5CssPopup` 등이 자체로 가진 `u4aWsBusyIndicator` 사본도 그대로 둔다.

## 4. 판단 기록 — 공통 JS 에 넣기 vs 전용 파일 (2026-09-15, 장군님 전용 파일로 결정)

### 4-1. 실측

| 항목 | 크기 |
|---|---|
| 옮길 busy JS(`setDomBusy`) | **1.6KB** |
| 옮길 busy CSS(`frame.css` busy 부분) | **4.9KB** |
| `u4a-ui.js` | 206KB (2026-09-01 백업 190KB → 지금 206KB, 열흘 새 +16KB) |
| `shell.css` | 92KB |
| `tokens.css` | 5.7KB, `:root` 변수 정의만 |

### 4-2. 비교

| | 공통 JS·CSS 에 넣기 | busy 전용 파일 |
|---|---|---|
| 맨 앞에 두려면 | 206KB·92KB 를 통째로 맨 앞으로 | 6.5KB 만 맨 앞 |
| CSS 덮어쓰기 위험 | `shell.css` 를 맨 앞으로 옮기면 옛 CSS·Bootstrap 이 공통 모양을 이긴다 → 35개 화면 영향 | `shell.css` 자리 그대로 → 없음 |
| busy 가 기대는 것 | `u4a-ui.js` 전체 로드 | 색 변수만 |
| 추가 비용 | HTML 순서 변경은 어차피 필요 | HTML 마다 태그 2줄 |

### 4-3. 확장성

1. 파일을 「언제 필요한가」로 나누는 것이 표준 방식이다(처음 그리기에 꼭 필요한 것만 먼저 싣는 critical CSS 와 같은 원칙).
2. 공통 부품 파일은 계속 커진다. 전용 파일은 크기가 그대로라 「가장 먼저」가 계속 지켜진다.

약점: HTML 에 태그를 빠뜨릴 수 있다 → `resources/index.js` 의 `setDomBusy` 가 `U4ABusy` 없음을 오류코드로 남긴다(§2-3). 공통 파일(`u4a-ui.js`)은 건드리지 않는다.

## 5. 공통 리소스를 쓰는 HTML 35개 — 지금 몇 번째로 로드하나 (2단계 참고용)

`<link>`·`<script>` 태그 순서 기준.

| 상태 | HTML |
|---|---|
| 이미 맨 앞 (22개) | `help/login/frame.html`, `extopen.html`, `ux-gallery.html`, OTRF4HelpPopup(frame·index), aboutU4APopup(frame·index), bindPopup, docPopup, editorPopup, errMsgPopup(frame·index), errPageEditorPopup, findPopup, fontStyleWizard, iconPrevPopup, illustMsgPopup, mimeRepository, patternPopup, runtimeClassNavigator, ui5CssPopup_v2/main, versionMng |
| 글꼴 아이콘·Bootstrap CSS 뒤 (8개) | `ServerList_v2/ServerList.html`, `Login/Login.html`, `WS10/WS10.html`, ShortCutCreator, dataMonitor, monacoSnippetDesigner, monacoThemeDesign, optionPopup/optionM |
| 글꼴 아이콘 CSS 뒤 (2개) | textSearchPopup, winShowHidePopup |
| 파비콘 `data:` 뒤 (1개) | `design/attrPresetPopup/list/index.html` |
| **옛 CSS 5개 뒤 (1개)** | **`ws10_20/index.html` (메인 창)** |
| 태그 없음 (1개) | `ui5CssPopup_v2/detail/frame.html` (검색에 걸렸지만 태그 없음 — 미확인) |

## 6. 구현 결과 (2026-09-15)

| 파일 | 한 일 | 백업 |
|---|---|---|
| `www/ws30/ws10_20/theme/u4a-busy.css` | **신규** — `frame.css` busy 규칙 20개를 순서·값 그대로 옮김 | — |
| `www/ws30/ws10_20/theme/u4a-busy.js` | **신규** — `U4ABusy.show()/hide()`. 처음 켤 때 `<dialog>` 를 만들어 `<body>` 에 붙임. 오류코드 `UBSY-001~003` | — |
| `www/ws30/ws10_20/index.html` | `<meta>` 바로 뒤에 두 파일 로드(다른 CSS·JS·jQuery 보다 앞) · `<body>` 의 busy `<dialog>` 삭제 | `_index.html.busythemebak` |
| `www/ws30/resources/index.js` | `setDomBusy` 이름 유지, 본체는 `U4ABusy` 로 넘김. `U4ABusy` 없으면 `RSRC-008` 로그만(창마다 1번) | `_index.js.busythemebak` |
| `www/ws30/ws10_20/css/frame.css` | busy 규칙 삭제(21개 — 20개는 옮김, 1개는 매칭 요소 없는 UI5 잔재) | `_frame.css.busythemebak` |
| `.analy/16` §0.1 표 · §2.10 / `.analy/12` §6.1 / `.works/DEV_STANDARD_오류처리.md` 접두 사전 `UBSY` | 문서 현행화 | — |

### 소스 대조 (CDP 아님)

- `node --check` 통과: `resources/index.js`, `theme/u4a-busy.js`.
- CSS: 백업의 busy 규칙 21개 중 매칭 없는 1개를 뺀 20개가 새 파일과 **순서·내용 일치**(공백 정규화 비교). `frame.css` 에 남은 busy 규칙 0.
- busy 화면을 id 로 찾는 메인 창 코드 전수 확인: 제목·문구 넣기(`ws_html5_shell.js`)·로그(`ws_html5_logger.js`)는 없으면 건너뜀, 로그인 남은 초(`Login.js`)는 `setDomBusy('X')` 뒤에 실행, 토스트 자리 고르기(`resources/index.js` 213줄)는 id 비교만, `resources/index.js` 74줄은 `<head>` 로드 시점이라 **예전에도 못 찾았고** 담은 값(`oBusyDom`)을 읽는 곳이 없다 → 동작 변화 없음.
- 앱으로 본 것은 없다. CDP 전·후 계산 스타일 대조는 **장군님 지시 시** 한다.
