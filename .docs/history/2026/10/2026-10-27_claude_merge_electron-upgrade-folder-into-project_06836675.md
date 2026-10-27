# 일렉트론 버전 올린 폴더의 수정분을 현재 프로젝트로 옮김

- 일시: 2026-10-27
- 유형: merge
- 지시: 장군님 「우리 커밋 이력을 보고 참고해서 영향 없는 소스는 해당 폴더꺼를 여기다 옮겨줘」

## 상황

장군님이 다른 대화창에서 일렉트론 버전을 올리며 생긴 문제를 고쳤다.
- 작업 폴더: `D:\workspace\u4a-ws4-elec-upgrade\U4A_WS4.0.0-elec-upgrade`
- 그 폴더는 **2026-10-27 14:00 경** 현재 프로젝트를 복사한 것 (장군님 확인).
- 그 폴더는 git 저장소지만 **커밋이 0개** 라 git 으로는 분기점을 못 잡는다.
- 장군님이 고친 파일 목록 112줄을 주셨다.

## 분기점

복사 시각(14:00)으로 분기점 = **`a7fd21d6` (2026-10-27 09:40)**.
교차 확인: 그 폴더의 `theme/u4a-ui.js` · `js/ws_fn_01.js` · `theme/shell.css`(목록에 없는 파일)이
우리 최신과 내용이 같다 → 분기점이 10-26 커밋 이후임이 맞다.

## 겹침 판정

분기점 이후 **우리가** 고친 소스 파일 5개 중, 장군님 목록과 겹치는 것은 **4개**다.

| 파일 | 우리가 넣은 것 | 업그레이드 폴더에 들어 있나 |
|---|---|---|
| `www/ws30/ws10_20/index.js` | 0.6초 타이머 폴백 주석 처리(노션 70) | 없음 |
| `js/ws_fn_02.js` | 뒤로가기 때 쇼컷링크 생성 창 안 닫기 | 없음 |
| `js/fnDialogPopupOpener.js` | 쇼컷링크 창 parent 제거·중복 실행 차단 | 없음(9 vs 10) |
| `Popups/ShortCutCreator/js/index.js` | 입력 검사 순차 처리(`_failAt`) | 없음 |

`Popups/ShortCutCreator/index.html` 도 우리가 고쳤지만 장군님 목록에 없어 그대로 둔다.

→ 그 폴더를 통째로 덮으면 **우리 오늘 오후 수정 4건이 전부 사라진다.**

## 조치

- 목록 112개 중 **겹치는 4개를 빼고 108개를 복사**했다(105개 덮어쓰기 + 3개 신규).
  신규 3개 = `electron/lib/net/ws_http_cookie.js` · `electron/lib/protocol/ws_app_protocol.js` ·
  `electron/lib/protocol/ws_renderer_dirname.js`.
- 복사로 **새로 생긴 문법 오류 0건**. (`node --check` 가 실패하는 5개는 복사 전에도 똑같이
  실패하던 것 — 브라우저에서 도는 파일을 node 로 검사해서 나는 것이고, 내용은 안 바뀌었다.)

## 겹친 4개에 업그레이드 쪽이 한 일 (아직 반영 안 함)

전부 **기계적 치환 3종**이고, 우리가 고친 줄과 한 줄도 겹치지 않는다.

1. `oBrowserWindow.loadURL(X)` → `oBrowserWindow.loadURL(REMOTE.getGlobal("u4aToAppUrl")(X))`
2. `oBrowserWindow.webContents.insertCSS(X)` → `REMOTE.getGlobal("u4aSetWindowCss")(oBrowserWindow, X)`
   (까닭 주석: 창을 만들자마자 넣으면 화면이 없어 깨진다 → 화면이 들어간 뒤에 넣는다)
3. `file:///` · `URL.pathToFileURL(...)` 로 만들던 주소 → `REMOTE.getGlobal("u4aToAppUrl")(...)`
   (까닭: 화면이 `u4a-ws://` 로 뜨면서 `file://` 모듈은 다른 origin 이라 import 가 막힌다)

실측 건수 — `fnDialogPopupOpener.js`: 주소 17곳 · 테마색 15곳.
업그레이드가 안 바꾼 4곳은 **전부 주석 줄**이라 빠뜨린 것은 없다.
우리 최신본의 건수(20 / 16)가 분기점과 같다 → 우리 수정은 이 치환 자리를 안 건드렸다.

## 또 밟을 함정

- **커밋이 없는 복사본 폴더는 git 으로 분기점을 못 잡는다.** 그럴 땐 ① 복사 시각을 묻고
  ② 목록에 없는 파일의 내용을 우리 커밋들과 해시로 맞춰 교차 확인한다.
- **덮어쓰기 전에 「분기 이후 우리가 고친 파일」과 교집합을 먼저 뽑는다.**
  이번엔 4개가 겹쳤고, 안 걸렀으면 하루치 작업이 조용히 사라졌다.

## package.json — 앱 이름은 되돌림 (장군님 지시 2026-10-27)

업그레이드 폴더에서 `name` 과 `appId` 가 둘 다 `com.u4a_ws3.app` → `com.u4a_ws4.elecup` 로
바뀌어 있었다. 그 폴더에서 따로 설치·시험하려고 바꾼 이름이므로 **원래 이름으로 되돌렸다**(2곳).

남긴 것(= 진짜 업그레이드 내용):

| 항목 | 전 | 후 |
|---|---|---|
| electron | ^14.2.9 | ^45.0.0 |
| better-sqlite3 | ^12.9.0 | ^13.0.3 |
| overrides.node-abi | 없음 | ^4.40.0 |

★`appId` 는 설치 경로·설정 저장 위치·자동 갱신 대상을 가르는 값이다. 바꾼 채로 배포하면
기존 사용자에게 **다른 프로그램으로 깔린다.** 다른 폴더에서 받아올 때 반드시 확인할 것.

## 겹친 4개에도 치환을 손으로 넣음 (장군님 지시 2026-10-27 「1 진행해」)

처리 순서는 **장군님이 겪는 차례**로 잡았다 — ① 메인 화면 뜨기 ② 창 닫기 ③ 별창 열기 ④ 쇼컷링크 창.

| 순서 | 파일 | 넣은 것 |
|:--:|---|---|
| ① | `www/ws30/ws10_20/index.js` | 화면 모듈 주소 1곳 + `REMOTE` 선언 |
| ② | `js/ws_fn_02.js` | 주소 1곳 |
| ③ | `js/fnDialogPopupOpener.js` | 주소 17곳 · 배경색 15곳 |
| ④ | `Popups/ShortCutCreator/js/index.js` | 로고 주소 1곳 |

### 확인한 것 (넣기 전)

- `ws_fn_02.js`(9회) · `fnDialogPopupOpener.js`(31회)는 **이미 `REMOTE` 를 쓰고 있어** 선언을 더 넣지 않는다.
  `index.js` 만 업그레이드와 똑같이 `let REMOTE = require('@electron/remote');` 를 추가했다.
- `index.js` 의 `let URL = require('url')` 은 **그 함수 안에서만** 쓰던 것이라(전 파일 검색 2줄) 같이 지웠다.
- 쇼컷링크 창의 배경색 넣는 줄은 **자기 창**(`oAPP.CURRWIN`)이고 업그레이드도 안 바꿨다 → 그대로 뒀다.

### 검증

- 치환 건수가 업그레이드 폴더와 **전부 일치**(주소 17/17 · 1/1 · 1/1 · 1/1, 배경색 15/15).
- `node --check` 4개 전부 통과.
- 업그레이드 파일과 줄 단위로 비교해, 남은 차이에 **일렉트론 관련 줄이 0건**임을 확인.
  = 일렉트론 변경은 빠짐없이 들어갔고, 남은 차이는 전부 우리 수정분이다.
- 우리 오늘 수정 4건(타이머 폴백 주석 · 중복 실행 차단 · 뒤로가기 예외 · 입력 검사 순차 처리) 전부 살아 있음.

### 또 밟을 함정

- **줄 머리만 보고 정규식을 쓰면 한 곳을 놓친다.** `const oLoad = oBrowserWindow.loadURL(...)` 처럼
  앞에 대입이 붙은 줄이 하나 있어 16/17 로 모자랐다.
  → 치환은 **반드시 건수를 세어 기준(업그레이드 폴더)과 맞춘다.**
- 주석 줄의 `loadURL`·`insertCSS` 는 바꾸지 않는다(주석 4곳). 건수를 셀 때도 주석을 빼고 센다.

## 켤 때 쏟아지던 `.js.map` 못 찾음 줄 없앰 (장군님 지시 2026-10-27)

`npm start` 로 켜면 아래 같은 줄이 한꺼번에 16줄 넘게 찍혔다.

```
[WARN] [main] DOM_MISS | file not found | /puppeteer-core.js.map
[WARN] [main] DOM_MISS | file not found | /Browser.js.map
...
```

### 왜 나왔나

- 찍는 자리 = `electron/lib/protocol/ws_app_protocol.js` 의 요청 처리 함수. 파일이 없으면 404 를 주며 한 줄 남긴다.
- 요청하는 쪽 = **개발자 도구**다. `puppeteer-core` 쪽 파일에 붙은 source map 주소를 보고 혼자 찾아본다.
  (`www/intro.js` 가 켤 때 `puppeteer-core` 를 미리 읽어 두므로 그 묶음이 통째로 걸린다.)
- 그 `.map` 파일들은 앱 안에 없다 → 전부 못 찾음. **앱 동작에는 아무 영향이 없다**(개발자 도구의 디버깅 편의용).
- no-build 로 켜면 개발자 도구가 자동으로 열리므로(`ws30/resources/index.js`) 켤 때마다 반복됐다.

### 조치

못 찾은 경로가 `.map` 으로 끝나면 **기록만 건너뛴다**. 404 를 주는 동작은 그대로다.
실제로 `.map` 파일이 있으면 지금처럼 그대로 내준다(프로젝트 안에 6개 있다).

### 또 밟을 함정

- **custom protocol 핸들러의 「파일 없음」 로그는 개발자 도구 요청까지 전부 받는다.**
  source map·favicon 처럼 **브라우저가 알아서 찾아보는 것**은 앱 결함이 아니므로 기록에서 뺀다.
  안 그러면 진짜 결함 줄이 그 속에 묻힌다(로그 양 표준 = `.works/DEV_STANDARD_로그.md`).

## 로그인 화면 로고 뒤에 네모 배경이 생긴 까닭 — `color-mix` (조사, 2026-10-27)

장군님 질문: 「원래 로고에 저런 배경 표시가 없었는데 일렉트론 업그레이드 때문이냐, CSS 로드가 잘못된 거냐」

**일렉트론 업그레이드 때문이 맞다. CSS 로드는 정상이다.**

- 로고 스타일은 `Login/css/login.css` 에 **원래부터** 둥근 배지로 적혀 있었다(마지막 변경 2026-09-08, 이번 커밋과 무관).
  ```css
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 0.0625rem solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: 0.625rem;
  ```
- `color-mix` 는 **Chromium 111 부터** 읽는다. 일렉트론 14 = **Chromium 93** 이라 그 두 줄이 통째로 무효가 됐고,
  그래서 배경도 테두리도 안 그려졌다 — 장군님이 보시던 모습이 그것이다.
- 일렉트론 45 는 Chromium 이 훨씬 높아 `color-mix` 를 읽는다 → **CSS 에 적힌 의도대로 이제야 그려진다.**

### 같은 일이 생길 자리 — 전수 22곳 / 11개 파일

| 파일 | 건수 |
|---|---:|
| `WS10/css/ws20.css` | 7 |
| `Login/css/login.css` | 4 |
| `theme/shell.css` · `Popups/mimeRepository/mime.css` | 각 2 |
| `ux-gallery.html` · `js/fnDumpWritePopupOpen.js` · `design/js/prevSetSkeletonScreen.js` · 옵션 팝업(옛 판) 2 · 내부 데이터 모니터 · 바인딩 팝업 | 각 1 |

로그인 화면 4건 = 로고 배경 1 · 로고 테두리 1 · 로그인 버튼 그림자 2.

### 또 밟을 함정

- **이 프로젝트는 「Chromium 93 이라 `color-mix` 를 못 쓴다」를 전제로 짜여 있다**
  (`.claude/rules/code.md` · `.analy/15` · `.analy/16`). 일렉트론 45 로 올라가면 그 전제가 깨진다.
  → **지금까지 「안 먹어서 안 보이던」 스타일이 한꺼번에 살아난다.** 화면이 달라 보이는 곳이 더 나오면 먼저 이걸 의심한다.
- 규칙 문서의 「`color-mix` 금지(Chromium 93)」 문구도 일렉트론 버전이 확정되면 같이 손봐야 한다. (아직 안 고침)

### 조치 — 로고 배지만 껐다 (장군님 지시 「원래대로」)

`Login/css/login.css` 의 로고 배경·테두리 **두 줄만 주석 처리**했다. 지우지 않고 까닭을 그 자리에 남겼다.
- `border-radius` 와 `padding` 은 건드리지 않았다 — 배경·테두리가 없으면 눈에 안 보이는 값이라 **원래 모습 그대로**다.
- 덮어쓰는 CSS 가 없음을 확인했다(`card-logo` 는 `www` 전체에서 이 한 곳뿐, 그리고 가장 나중에 로드된다).
- **로그인 버튼 그림자 2곳은 건드리지 않았다** — 장군님이 지적하지 않으셨다. 나머지 20곳도 그대로다.

## 문서 현행화 — Chromium 93 전제를 걷어냄 (장군님 지시 2026-10-27)

### 확인한 사실

- 설치된 것 = **Electron 45.0.0**(`node_modules/electron/dist/version` 실측).
- 그 Node ABI = **150**(`node-abi` 표에서 조회). 전에는 Electron 14 → ABI 89 였다.
- `color-mix` 가 **실제로 그려진다** — 로그인 화면 로고 배지가 Electron 45 에서 나타난 것이 그 증거다.

### 고친 문서 (7개 파일 · 19곳)

| 파일 | 고친 것 |
|---|---|
| `.claude/rules/code.md` | `color-mix` 금지 → **써도 된다**(하드코딩 hex 금지는 유지) |
| `.claude/agents/code-reviewer.md` | 같은 항목 |
| `.claude/skills/common-ux/SKILL.md` | `color-mix` 1곳 + 컨테이너 쿼리 1곳 + 함정 절 제목 1곳 |
| `.analy/15_공통_입력UX_가이드.md` | 라이트 테마 틴트(정적 hex 사유) 1곳 + 미확인 표시 2곳 |
| `.analy/16_공통_화면UX_표준.md` | 금지 표에서 `color-mix` 제거 + 드롭존 색 1곳 |
| `.analy/00_개요_및_컨버전전략.md` | 플랫폼 Electron 14 → **45** |
| `.analy/09_환경구축_런북.md` | 8곳 — 설치 버전 · `package.json` 예시(`overrides.node-abi` 추가 · better-sqlite3 13) · ABI 89 → **150** · 확인 명령 기대값 |

### 일부러 안 바꾼 것

- **`color-mix` 말고 Chromium 93 을 전제한 나머지 항목은 「이제 된다」고 쓰지 않았다.**
  실제로 재 보지 않았기 때문이다. 대신 **「Electron 45 에서는 다시 확인하지 않았다」** 표시만 달았다.
  - 컨테이너 쿼리 미지원 → 카드 뷰를 `ResizeObserver` 로 토글하는 것(코드도 그대로)
  - sticky 헤더가 스크롤바 폭만큼 어긋나던 렌더 버그
  - blur/change/click 처리 도중 동기 `focus()` 가 무시되던 것
  - Monaco `readOnly` 로 IME(한글) 조합 입력을 못 막던 것
- **`.works/` 안 옛 계획서 9개**에도 같은 문구가 남아 있지만 손대지 않았다. 끝난 작업의 계획서이고,
  현행 표준이 아니다(폐지된 폴더 — 2026-10-13 지시).
- **코드는 한 줄도 안 고쳤다.** `color-mix` 를 쓰던 22곳 중 로그인 로고 2줄만 장군님 지시로 껐고 나머지는 그대로다.

### 또 밟을 함정

- **엔진 버전이 올라가면 「엔진이 못 읽어서 조용히 무시되던 선언」이 한꺼번에 살아난다.**
  문서의 「못 쓴다」는 금지는 풀어도, **그 금지를 피하려고 짠 코드(정적 hex·`ResizeObserver` 등)는 그대로다.**
  문서만 고치고 코드를 안 고치면 둘이 어긋나므로, 문서에 **코드가 아직 옛 방식임을 같이 적었다.**
- **「이제 될 것이다」는 추측이다.** 실제로 재 본 것(`color-mix`)만 단정하고, 나머지는 미확인으로 남겼다.
