# 지침서 2 — WS4.0 : 스택·메시지·조용한 줄을 콘솔까지 내보낸다 (읽는 판)

- 낸 날 : 2026-09-30
- 저장소 : `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0`
- **브랜치 : `bootstrap` 에서 새로 딴다** (지난 작업 `dcb1d34a` 가 들어 있다). `autofix-skill-test` 는 절대 아님 (실험 브랜치)
- 넘기는 판(영어) : [`ws40-work-order-2.md`](ws40-work-order-2.md) — 내용 같음. 둘을 같이 고치거나 둘 다 안 고친다
- 지난 지침서 : [`ws40-work-order.md`](ws40-work-order.md) — **끝남, `dcb1d34a`.** 그 보고가 A8 의 바탕이다
- 짝 지침서 : [`tester-work-order-2.md`](tester-work-order-2.md) — T11(↔ A6), T13(↔ A8)
- 이 파일의 내력 : 2026-09-30 INCIDENT 고리 창 **둘이** 따로 쓴 것을 하나로 합쳤다.
  A5~A7 은 첫 창, A8~A9 는 둘째 창 (테스터가 **exe** 를 돈다는 걸 찾은 쪽)

---

## 1. 왜 이 지침서가 있나

테스터 프로그램이 WS4.0 을 자동으로 몰고, 실패마다 `INCIDENT.md` 한 장을 쓰고, AI 에이전트가
그 한 장만 읽고 원인을 찾는다.

실제 사고 둘을 돌렸다. 두 번 다 분석은 **호출 경로를 제대로 따라갔고 증상 은폐를 거부했다** —
그리고 두 번 다 **같은 이유로 `Confidence: medium`** 에서 멈췄다:

> *"incident 에 해당 호출부의 **stack 이 없어** 실제로 `ws_usp.js:51` 에서 터졌는지는 실측하지 못했습니다."*

> *"가장 중요한 누락은 … 예외 직전의 호출 정보입니다. 추가로 필요했던 내용: **전체 JavaScript stack trace** …"*

**서로 다른 사고 둘이 같은 걸 요구 → 힌트가 아니라 결정이다.**

| 회차 | 오류 | 문서에 들어온 것 |
|---|---|---|
| 1 | `[onError]: Uncaught TypeError: n is not a function` (`klay.js:1:122893`) | 글 + `주소, 줄:칸`. 보인 한 칸은 `ws_trycatch.js:158` — 핸들러의 `console.trace` 자리지 터진 자리가 아니다 |
| 2 | `[FUTURE FATAL] One or more parameters could not be found. - sap.ui.core.theming.Parameters` | 글뿐 — *"exception 객체 없음 · 이벤트에 stackTrace 없음"* |

### 테스터는 설치된 exe 를 돈다 — 무엇이 닿는지가 여기서 갈린다

두 문서의 경로가 모두 `C:\Users\socce\AppData\Local\Programs\com.u4a_ws3.app\resources\app.asar\…`
아래다. **테스터는 개발 모드가 아니라 빌드본을 몬다.**

exe 에서 `ws_log.js` 는 `console.*` 를 electron-log 로 바꿔 끼우고, 진짜 콘솔로는 **`error` 이상만**
내보낸다 (`:104`, `:150-155`). 나머지는 로그 파일에만 간다. 지난 보고에 미확인으로 남겨 둔 것
(`.works/ws40-work-order/00_현황판.md`: *"테스터가 exe 를 돌리는지 개발 모드를 돌리는지 미확인"*) —
**exe 다.**

---

## 2. 할 일

| # | 무엇 | 어디 | 크기 |
|---|---|---|---|
| **A5** | `_reportError` 가 이미 받은 스택을 찍는다 | `js/ws_trycatch.js:44` | **한 줄** |
| **A6** | 크리티컬 표지 줄에 메시지를 싣는다 | `js/ws_trycatch.js:158`, `:186` | **각 한 줄** |
| **A8** | exe 에서 `참고`·`주의`·`info` 줄이 콘솔에 나오게 하는 스위치 | `js/ws_log.js:104` + `U4ALOG` | 작다 — 테스터 T13 과 짝 |
| **A7** | 분석이 짐작해야 했던 몇 군데 경계에 진입 로그 | 몇 자리 | 작다 — **A8 이 있어야 보인다** |
| **A9** | **보고만** — UI5 로그 줄(`[FUTURE FATAL]`)엔 스택이 없다 | 읽고 재기만, 고치지 않음 | 조사 |

**순서: A5 → A6 → A8 → A7 → A9.** A5 가 두 번 요구된 것이다. A7 을 A8 뒤에 두는 이유:
exe 에서는 A8 없이 A7 줄이 테스터에 아예 안 닿는다.

---

## A5. 스택을 콘솔에 찍는다

### 코드 — `www/ws30/ws10_20/js/ws_trycatch.js:40-45`

```js
function _reportError(sKind, sMessage, sStack) {

    // 1) 로그는 언제나 남긴다 (첫 1건 제한과 무관)
    try {
        console.error(sMessage);          // ← sStack 을 안 찍는다
    } catch (e) { … }
    …
    IPC.send('u4a-log:send-error', { …, stack: sStack || '', … });   // ← 스택은 여기로만 간다 (:83)
}
```

부르는 쪽 둘이 **이미 스택을 넘긴다** — `onError` 는 `:152`(`errorObj.stack`),
`onunhandledrejection` 은 `:180`(`event.reason.stack`). 테스터는 콘솔만 읽고, IPC 는 못 본다.

`onunhandledrejection` 은 **우연히** 된다 — `:170` 에서 메시지 안에 스택을 직접 붙이므로 그런 사고는
스택이 통째로 온다:

```
[error] [onunhandledrejection]: TypeError: l_class is not a constructor
    at createUIInstance (…/design/preview/index.js:5079:42)
    at setUIScript      (…/design/preview/index.js:5387:3)   ×4
    at drawPreview      (…/design/preview/index.js:5172:2)
```

`onError` 는 아니다 (`:146` 의 `sMessage` 가 `` `[onError]: ${message}\n${url}, ${line}:${col}` `` 뿐).
그래서 그 사고엔 **한 칸 — 핸들러 자신** 만 오고, 분석은 그걸 옳게 거절했다:

> *"`ws_trycatch.js:158` 은 오류를 발생시킨 자리가 아니라 전역 오류를 받아 fatal dialog 를 띄운 자리입니다."*

### 바꿀 것

```js
var sOut = sMessage;
if (sStack && sMessage.indexOf(sStack) === -1) {
    sOut = sMessage + "\n" + sStack;
}
console.error(sOut);
```

- 어떤 자리는 `sStack` 이 `''` 다 — 그때는 예전 출력 그대로
- `indexOf` 검사로 `onunhandledrejection` 이 스택을 두 번 찍지 않는다
- `sStack` 이 길 수 있다. 이 파일이나 `ws_html5_logger.js` 에 길이 제한 관례가 있으면 따르고,
  없으면 자르고 몇 자로 잘랐는지 적는다
- 받은 걸 그대로 찍는다 — 스택을 다시 짜거나 다듬지 않는다
- IPC · 오류창 · `APP.exit()` 는 그대로

**테스터는 안 고쳐도 된다**: 이미 글 안에서 스택 칸을 꺼낸다 (테스터 커밋 `794e7fb`). exe 에서도
`error` 등급 줄은 콘솔에 닿는다.

**범위**: `_reportError` 는 이 핸들러를 거는 모든 창이 같이 쓴다 (`ws_trycatch` 를 부르는 파일 13개,
미리보기 iframe 포함 — 1회차 오류는 메인 창이 아니라 실행 컨텍스트 563 에서 왔다). 한 군데로 전부 된다.

---

## A6. 크리티컬 표지 줄에 메시지를 싣는다

### 코드 — `ws_trycatch.js:158`, `:186`

```js
console.trace(`[onError]: `);                 // :158
console.trace(`[onunhandledrejection]: `);    // :186
```

테스터가 *"앱이 곧 치명 오류창을 띄우고 끝난다"* 를 알아보는 표지다. **글이 없다.**
(electron-log 는 `console.trace` 를 바꿔 끼우지 않아서, exe 에서도 이 줄은 원래 콘솔로 나간다 —
그래서 테스터가 본다.)

실제 사고 폴더에 남은 메시지 전부가:

```
[onError]:
```

진짜 글은 76ms 뒤 **다른** 콘솔 줄에 있었고, 테스터가 찾아서 이어 붙여야 했다
(`incident_20260923_123342_613/raw.json`). 순서가 어긋나면 사고가 빈 채로 기록된다.

### 바꿀 것

```js
console.trace(`[onError]: ${sErrMsg}`);
console.trace(`[onunhandledrejection]: ${sErrorMsg}`);
```

두 변수 모두 그 자리에서 이미 쓸 수 있다.

**왜 테스터가 아니라 여기서:** 테스터는 옛 WS4.0 빌드도 견뎌야 해서 빈 경우를 이미 이어 붙인다
(테스터 커밋 `0be028a`). 하지만 이건 돌아가는 길이 아니라 **문제를 없앤다.**

⚠ **표지가 여전히 맞는지 확인한다.** 테스터는 `console.trace` 줄의 고정 글자로 크리티컬을 알아본다.
`[onError]: ` 뒤에 붙이면 그 글자는 그대로지만 — **확인하고, 줄이 이제 어떻게 생겼는지 보고한다.**
테스터 쪽이 자기 규칙과 맞춰 본다.

---

## A8. exe 에서 `참고`·`주의`·`info` 줄이 콘솔에 나오게 한다

### 사실 — 2026-09-30 소스로 읽음

```js
// www/ws30/ws10_20/js/ws_log.js
log.transports.console.level  = 'error';          // :104
…
if (APP && APP.isPackaged) {
    Object.assign(CONSOLE, log.functions);          // :150-155 — exe 에서만
}
```

이미 한 일에 이게 뜻하는 것:

| 줄 | 등급 | exe 에서 테스터에 닿나 |
|---|---|---|
| `U4ALOG.caught` — `잡고 넘어감 \| … \| thrown at 파일:줄 함수()` | `참고` → `console.log` | **안 닿는다** |
| 지난번 `PROP_COERCE`(A4)·`THROTTLE`(A2) 줄 | `참고` | **안 닿는다** |
| `catch` 안의 `console.warn` (1차 지침서 스캔 122곳) | warn | **안 닿는다** |
| 아래 A7 의 진입 로그 (`U4ALOG.info`) | info | **안 닿는다** |
| `console.error(…, e)` — 지난번 339곳 | error | 닿는다 |

**이미 있는 `U4ALOG.caught` 2,813곳이 exe 에서는 테스터에 안 보인다.** 테스터는 붙자마자 반복 억제를
끄는데(T6, `26269ba`), exe 에서는 효과가 안 보인다 — 풀어 준 줄들이 콘솔로 안 나온다.

### 만들 것

**운영 기본값은 그대로.** A2 와 같은 모양의 스위치:

```js
U4ALOG.setConsoleLevel("silly")    // 전부 파일과 함께 콘솔에도 낸다
U4ALOG.setConsoleLevel("error")    // 지금 기본값으로
```

- electron-log 의 `transports.console.level` 을 실행 중에 바꾼다. `Runtime.evaluate` 로 언제든 부를 수
  있고, 두 번 불러도 되고, 로거가 없을 때 불러도 무해해야 한다
- **미리보기 iframe 에도 먹어야 한다** — 1회차 오류가 거기서 났다. iframe 이 electron-log 나 콘솔을
  따로 가지면 스위치가 거기까지 닿게 하거나, **컨텍스트마다 불러야 한다고 보고한다**
- 개발 모드에서는 아무 일도 안 한다 (콘솔이 원래 것) — 코드 주석에 적는다
- **파일** 출력은 건드리지 않는다

### 왜 테스터가 아니라 WS4.0 인가

- **테스터가 로그 파일을 읽는다** (`%APPDATA%\<앱>\logs\U4A_WS_<날짜>.log`) — WS4.0 은 안 고쳐도 되지만,
  컨텍스트 번호 없는 두 번째 흐름을 시각으로 맞춰 합쳐야 한다. 이 줄들엔 테스터 T8(어느 프레임 줄인지)이 안 먹는다
- **테스터가 `eval` 로 electron-log 등급을 직접 바꾼다** — 밖에서 WS4.0 속을 건드린다. 로그 구조가 바뀌는 날 소리 없이 깨진다

로거가 가진 스위치면 이 줄들이 테스터가 이미 읽는 콘솔 흐름에 컨텍스트 번호와 함께 들어온다.

### 양을 본다

스위치를 켰을 때·껐을 때 WS20 앱 한 번 열기의 콘솔 줄 수를 보고한다 — 테스터 통은 20,000줄 (T5).
**정확한 호출 모양을 보고한다** — 테스터가 쓴다 (T13).

---

## A7. 분석이 짐작해야 했던 경계에 진입 로그

두 분석 모두 **소스를 읽어서** 호출 경로를 다시 그렸고, 둘 다 그게 실제로 돌았는지는 확인 못 했다고 했다:

> *"`fnCreateWs30()`가 해당 사고에서 실행됐다는 runtime trace"* — 모자란 것으로 적음

> *"오류가 `drawPreview()` 중인지 `refreshPreview()` 중인지에 대한 구분"* — 모자란 것으로 적음

A5 는 던지는 오류에만 먹는다. 앱이 오류를 잡았거나 라이브러리가 던지지 않고 불평만 찍는 경우엔
**안 된다** — 시험한 두 사고가 바로 그랬다.

### 바꿀 것

미리보기/WS30 길이 지나는 **몇 안 되는 경계**에 진입 로그:

```js
U4ALOG.info("<무엇>", "<대상>", "<결과>");
```

| 경계 | 왜 |
|---|---|
| `fnWs30Creator()` / `fnCreateWs30()` | 2회차가 돌기나 했는지 물었다 |
| `design/preview/index.js` 의 `refreshPreview()`·`drawPreview()` | 1회차가 둘 중 어느 쪽이었는지 물었다 |
| `createUIInstance()` — 객체 id 와 UI5 클래스와 함께 | 1회차가 *"누가 무엇으로 불렀나"* 를 물었다 |

- **진입만, 이 경계에서만.** 루프 안에 넣지 않는다. `createUIInstance` 는 트리 노드마다 한 번 돈다 —
  실제 앱으로 양을 보고 남길지 정한다
- 분석이 달라고 한 식별자(`OBJID`, UI5 클래스 이름)를 잘라서 넣는다
- `info` 는 테스터가 사고로 올리지 않는다 — 맞다, 이건 실패가 아니라 발자국이다
- ⚠ **exe 에서는 A8 을 켜야만 이 줄이 테스터에 닿는다.** A8 을 먼저 한다
- 커밋 전에 WS20 앱 하나로 **양을 잰다.** 화면당 몇 줄을 넘으면 빼고 그렇다고 적는다

⚠ 테스터가 따로 사고 순간 상태 스냅샷(`tester-work-order-2.md` T9)으로 선택된 노드 속성을 읽는다.
**`createUIInstance` 것을 만들기 전에 무엇을 남길지 먼저 보고한다** — 같은 값을 양쪽이 두 번 적지 않게.

---

## A9. 보고만 — UI5 로그 줄에는 스택이 없다

2회차 줄:

```
[2026-09-29 21:46:31.820] [error] 2026-09-29 21:46:31.819600 [FUTURE FATAL] One or more parameters could not be found. - sap.ui.core.theming.Parameters
```

**예외가 아니다.** `onError` 가 못 보니 A5 로는 안 된다. UI5 자기 로거가 `console.error`(exe 에선
electron-log)로 쓴 것이고, 그 이벤트엔 **stackTrace 가 아예 없었다.** 분석엔 `Parameters.get()` 을
*누가 불렀는지*가 필요했다 — 후보는 `fnCreateWs30()` 을 거친 `ws_usp.js:51`, 확정 못 함.
(A7 의 `fnCreateWs30` 진입 로그가 일부를 답한다.)

**아무것도 고치지 않는다. 알아내서 보고만:**

1. 지금 `[FUTURE FATAL]` 을 찍는 게 무엇인가 (`sap.base.Log` / `jQuery.sap.log` /
   `library-preload.js:140-145` 의 shim?), 로그 리스너를 이미 어디서 거는가
2. `fatal`/`error` 리스너 하나로 그 줄에 `new Error().stack` 을 붙일 수 있는가 — 제안 전에
   **WS20 앱 한 번 열기에 그런 줄이 몇 줄 나오는지 잰다**
3. 2회차 같은 경우 *누가 불렀는지* 알려 줄 다른 방법

---

## 3. 일하는 법

1. **`bootstrap` 에서 딴다.** 먼저 `git branch --show-current` 와 깨끗한 `git status --short`
2. **항목 하나에 커밋 하나**, 따로 되돌릴 수 있게
3. **백업 `.js` 는 만들지 않는다.** `AGENTS.md:51` 의 백업 규칙은 이 일엔 해당 없다 — 전에 685개가 쌓였다
4. **`ws_html5_logger.js` 안의 `catch` 는 절대 고치지 않는다** — 로거가 로거를 부르면 무한 재귀
5. **A5·A6·A8 은 빌드한 exe 에서도 확인한다** — 개발 모드만으론 안 된다. 둘의 차이가 이 지침서 이유의 절반이다
6. **A7 은 실제 앱으로 양을 재고** 커밋한다
7. 끝나면 **로그오프**로 앱을 내린다 — 지난번엔 `YLCY_TEST2142` 편집 모드로 떠 있었고, 서버 편집 잠금이 다음 실행을 막는다

## 4. 확인

| | 확인 |
|---|---|
| **A5** | 안 잡힌 오류를 낸다 (`setTimeout(() => { null.x; })`). 콘솔 줄에 글 **과** 스택 — 개발 모드와 exe 둘 다 |
| **A5** | `Promise.reject(new Error("p"))` 는 스택이 **한 번만** |
| **A5** | `sStack` 이 빈 자리는 예전과 똑같이 찍힌다 |
| **A5** | ⚠ UI5 서버에서 받은 스크립트(`https://…/openui5_lib/…`) 안에서 터졌을 때 `errorObj` 가 `null` 이 아니었는지 보고 — 1회차가 그 경우. `null` 이면 그렇다고 적고 돌아가는 길을 만들지 않는다 |
| **A6** | `[onError]:` 줄에 오류 글이 들어 있고, 테스터가 맞추는 글자는 그대로다 |
| **A8** | exe 에서: 켜면 `잡고 넘어감 … thrown at …` 줄이 DevTools 에 나온다, 끄면 멈춘다. 미리보기 iframe 컨텍스트에서 한 번 더 |
| **A7** | WS20 앱 하나를 열고 새 줄 수를 센다. 수백이 아니라 몇 줄 |

## 5. 보고할 것

- 브랜치와 커밋 범위
- **A5** — 실제 콘솔 줄 전후 (exe), `errorObj` 답
- **A6** — 새 표지 줄의 정확한 글 (테스터가 여기에 맞춘다)
- **A8** — 정확한 호출 모양, iframe 까지 한 번에 먹는지, 켰을 때·껐을 때 줄 수
- **A7** — 넣은 경계와 화면당 잰 줄 수
- **A9** — 알아낸 것, 파일:줄과 함께
- 여기 적힌 것 중 틀린 것

## 6. 근거

| 사실 | 확인한 곳 |
|---|---|
| `_reportError` 는 메시지만 찍는다 | `ws_trycatch.js:40-45` |
| 부르는 쪽 둘이 이미 스택을 넘긴다 | `ws_trycatch.js:152`, `:180` |
| `onunhandledrejection` 은 글 안에 스택을 넣는다 | `ws_trycatch.js:170` |
| 표지 줄에 글이 없다 | `ws_trycatch.js:158`, `:186` |
| 콘솔 등급 `error`, 콘솔 바꿔치기는 exe 에서만 | `ws_log.js:104,150-155` |
| 테스터는 exe 를 돈다 | 두 회차 문서 — 경로가 `AppData\Local\Programs\com.u4a_ws3.app\resources\app.asar` 아래 |
| 1회차는 실행 컨텍스트 563 에서 왔다 | 1회차 문서, raw 이벤트 |
| 2회차 콘솔 이벤트엔 stackTrace 가 없었다 | 2회차 문서: *"이벤트에 stackTrace 없음"* |
| `[onError]:` 만 남은 사고 | `incident_20260923_123342_613/raw.json` |
| 거부 경로로 온 7칸 스택 | `incident_20260923_053441_411/raw.json` |
| 테스터는 글에서 스택을 꺼내고, 빈 크리티컬을 잇고, 반복 억제를 끈다 | 테스터 커밋 `794e7fb`, `0be028a`, `26269ba` |
| 분석이 `ws_trycatch.js:158` 을 거절 | 1회차 답 1절 |
| 스택이 막힌 이유로 두 번 나옴 | 1회차 답 5절, 2회차 답 5–6절 |
| exe 구멍을 WS4.0 쪽이 먼저 짚었다 | `.works/ws40-work-order/00_현황판.md` |
