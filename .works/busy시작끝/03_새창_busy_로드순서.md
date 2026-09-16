# 새창 — busy 가 리소스 로드보다 먼저 켜지는가

> 조사 2026-09-15, 소스로만 확인. **코드는 안 고쳤다.** 시간은 재지 않았다(아래 「미확인」).

## 1. 정해 주실 것

| 물음 | 선택지 |
|---|---|
| 창을 **언제 보여줄지** | **✅ 지금대로 (장군님 결정 2026-09-15).** 리소스 로드 중에는 창을 숨겨 두고, 내부적으로 busy 를 먼저 켠 뒤 `show()` 한다. 창이 보이는 순간 이미 busy 가 돌고 있다. 지금 코드가 이미 이 순서다(아래 §3 ④ → ⑤). |
| busy 공통을 **따로 떼어 맨 앞에 로드**할지 | **✅ 옮긴다 (장군님 지시 2026-09-15)** — 「busy도 하나의 ui인데 따로 관리할 이유는 없잖아 … 화면 처음 실행할때 가장 먼저 리소스가 로드가 되어야해」. 세부 물음과 계획 = [05_busy_theme이동_계획.md](05_busy_theme이동_계획.md) |
| 부모 창 busy 를 **언제 끌지** | **✅ 지금대로 — 새창 HTML 로드 완료(`did-finish-load`) 때 끈다 (장군님 결정 2026-09-15).** 코드 변경 없음. §4 의 2번 틈은 알고 둔 것 |

## 2. 장군님 질문에 대한 답

**busy 는 공통 UX 가 맞다.** `.analy/16` §2.10 에 「자체 busy 금지, 무조건 공통 `parent.setBusy`」로 정해져 있다.

**하지만 따로 떨어진 JS 파일은 없다.** `www/` 전체에서 이름에 busy 가 들어간 JS·CSS·HTML 파일은 0개다(백업 제외).

| 조각 | 들어 있는 곳 |
|---|---|
| busy 켜고 끄는 함수 `setDomBusy` | `resources/index.js`(90KB, 2,625줄) 안. 창 관리·세션·서버 정보 등과 한 파일 |
| busy 모양 CSS | `ws10_20/css/frame.css` 안(597~718줄). 색은 테마 토큰(`--accent`·`--line`·`--text` 등)에 기댄다 |
| busy `<dialog>` | `ws10_20/index.html` 113줄. `<body>` 안, `<head>` 스크립트가 다 끝난 뒤에 생긴다 |

`setDomBusy` 는 그 파일 안의 다른 함수에 기대지 않는다(`document` 와 로그 함수 존재 확인만). 따로 떼어낼 수 있는 구조다.

## 3. 지금 새창이 뜨는 순서 (로그인 후 새창)

| 순서 | 어느 창 | 하는 일 | 사용자에게 보이는 것 |
|---|---|---|---|
| ① | 부모 | `onNewWindow` → 부모 창 busy 켬 → 새창을 **숨긴 채(`show:false`)** 만들고 HTML 로드 시작 (`resources/index.js` 572~677줄) | 부모 창 busy |
| ② | 새창 | `<head>` 순서대로 로드: CSS 12개 → `jquery.min.js` 96KB → `theme-api.js` 12KB → `u4a-ui.js` 206KB → **`resources/index.js` 90KB(여기서 비로소 busy 함수가 생김)** → `<body>` 의 busy `<dialog>` → `ws10_20/index.js` | 부모 창 busy (새창은 숨김) |
| ③ | 부모 | 새창 `did-finish-load` → **부모 busy 끔** → 메타 정보 전송 (709~736줄) | **아무 busy 없음 ← 틈** |
| ④ | 새창 | 메타 수신 맨 위에서 `setDomBusy("X")` (`ws10_20/index.js` 103줄). 창은 아직 숨김 | **틈 계속** |
| ⑤ | 새창 | `library-preload.js` 를 `<script>` 로 붙여 로드 → 로드되면 `show()` (`library-preload.js` 334줄) | 새창이 busy 켠 채로 나타남 |
| ⑥ | 새창 | 스크립트 목록 로드·실행 → 첫 화면 그리기 → 끝에서 busy 끔 | 새창 busy |

## 4. 장군님 지적이 맞는 부분

1. **busy 함수가 무거운 파일들 뒤에 있다.** ②에서 약 400KB 의 스크립트가 끝나야 busy 를 켤 수 있다. 느린 PC 에서 이 로드가 길어지면 busy 를 켤 수 있는 시점 자체가 늦어진다.
2. **③~⑤ 사이에는 어느 창에도 busy 가 없다.** 부모는 ③에서 busy 를 이미 껐고, 새창은 ⑤까지 숨겨져 있다. 이 사이에 부모 창을 클릭할 수 있고, 화면에는 아무 표시가 없다. `library-preload.js` 로드가 느리면 이 틈이 길어진다.
3. 지금 새창 busy 가 잘 보이는 것은, ②~④ 동안 **창을 숨겨 둬서** 가려져 있기 때문이다. busy 가 먼저 떠서가 아니다.

## 5. 미확인

- ③~⑤ 틈이 실제로 몇 ms 인지. 재지 않았다.
- ⑥에서 스크립트를 한꺼번에 동기로 실행하는 동안 busy 스피너가 계속 도는지, 멈춰 보이는지.
- 별창 팝업 HTML 들도 같은 순서 문제가 있는지. 이번에는 로그인 후 새창만 봤다.
- 로그인 전 첫 창(`vw_main/control.js` 에서 `show()`)의 순서.

## 6. 네트워크 트레이스에 잡히나 (장군님 질문 2026-09-15)

| 불러오는 방식 | 예 | DevTools Network 에 | 근거 |
|---|---|---|---|
| `<head>` 의 `<link>` · `<script src>` | `theme/u4a-busy.css`·`u4a-busy.js`, `jquery.min.js`, `u4a-ui.js`, `resources/index.js` | **잡힌다** — 브라우저가 직접 받는 요청이라 `file://` 주소로 Type 이 stylesheet / script 로 나온다 | Chromium 동작 |
| JS 로 붙인 `<script>` | `library-preload.js` (`ws10_20/index.js` 85~87줄) | **잡힌다** (script) | 같은 이유 |
| `library-preload.js` 가 읽는 스크립트 목록 | `ws_main.js` · `ws10_html.js` 등 | **잡힌다 — 단 Type 이 script 가 아니라 xhr** | `library-preload.js` 257줄 `loadLibrary` 가 `$.ajax({async:false, dataType:"text"})` 로 글자를 받아 `eval` 한다 |
| Node `require()` | `ws_trycatch.js` (`resources/index.js` 1494줄) 등 | **안 잡힌다** — 파일을 직접 읽는 것이라 요청이 아니다 | Node 동작 |

주의 (미확인):
- DevTools 는 **열려 있는 동안의 요청만** 기록한다. 개발 모드 새창은 `loadURL` 바로 뒤에 DevTools 를 연다(`resources/index.js` 681줄) — 그 사이에 이미 끝난 `<head>` 요청이 목록에 남는지는 **앱으로 확인 안 했다.** 확실히 보려면 DevTools 를 연 채 그 창을 새로고침해야 한다.
- 앱 자체 로그(`ws_html5_logger.js`·`resources/index.js`)에는 리소스 로드 순서·시간을 남기는 코드가 **없다**(`PerformanceObserver`·`getEntriesByType` 등 검색 0건).
