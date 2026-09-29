# 지침서 — WS4.0 : 삼킨 오류를 밖에서 보이게 한다 (읽는 판)

- 낸 날 : 2026-09-29
- 저장소 : `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0`
- **브랜치 : `bootstrap` 에서 새로 딴다.** `autofix-skill-test` 는 실험 브랜치라 쓰지 않는다
- 넘기는 판(영어) : [`ws40-work-order.md`](ws40-work-order.md)
- 짝 지침서 : [`tester-work-order.ko.md`](tester-work-order.ko.md) — §5 를 같이 본다

> 이 문서는 사람이 읽는 판이다. 둘은 같은 내용이며, 한쪽이 바뀌면 다른 쪽도 바꾼다.

---

## 1. 왜 이걸 시키나

테스터가 WS4.0 을 자동으로 두드리다 오류가 나면 사고 폴더를 만들고,
AI 가 그 폴더를 읽어 원인을 짚는다.

**목표는 파일 하나로 그게 되게 하는 것이다.** 지금은 파일 6개로 흩어져 있고, 그래도 분석이 멈춘다.

**테스터에는 판단해 주는 놈이 없다.** WS4.0 이 콘솔에 찍은 것과 크롬이 CDP 로 주는 것, 그 둘뿐이다.
해석해 주는 사람도 AI 도 없다. **안 찍힌 것은 영영 없는 것이다.**

### 분석이 스스로 "뭐가 없었다" 고 적은 것

실제로 돌린 분석 문서 둘이, **서로 다른 오류인데 같은 말로** 끝났다:

> "사고 폴더에도 실측에도 **앱 속성값 덤프**도 **UI5 스택**도 없었다"

둘 다 재현은 성공했고 **`Confidence: medium`** 에서 멈췄다 —
*"이 경로가 문제다"* 까지 가고 *"이 값이 나쁘다"* 를 못 짚었다.

### 왜 테스터가 아니라 WS4.0 이냐

**크롬은 콘솔 메시지에 스택을 안 실어 준다.** 실제 사고 원본으로 확인했다 —
`type · args · executionContextId · timestamp` 넷뿐이다.

**그래서 CDP 를 아무리 더 켜도, WS4.0 이 잡아서 글로 찍은 오류의 위치는 못 되살린다.**

되는 길은 이미 이 저장소 안에 있다 — `U4ALOG.caught` 가 `e.stack` 을 직접 뜯어
위치를 글에 박아 넣는다 (`ws_html5_logger.js:277 _crashSite`):

```
[참고] [창] [WS20] [T7XH] 잡고 넘어감 | l_class is not a constructor | thrown at design/preview/index.js:5076 createUIInstance()
```

**`U4ALOG.caught` 를 안 부르는 `catch` 는 밖에서 영영 안 보인다.**

---

## 2. 할 일 넷

| # | 무엇 | 어디 | 크기 |
|---|---|---|---|
| **A1** | `U4ALOG.caught` 없는 `catch` 에 넣기 | `www/**/*.js` | **755곳** |
| **A2** | 반복 억제를 끄는 **스위치** 달기 | `js/ws_html5_logger.js` | 작다 |
| **A3** | (확인 완료 — **안 고침**) | `js/ws_html5_logger.js:460` | — |
| **A4** | 속성값 버릴 때 뭘 버렸는지 기록 | `design/preview/index.js` | 2곳 |

**순서: A2 → A1(빈 것부터) → A4.**
A2 는 작고, **테스터 쪽 작업을 막고 있으므로** 먼저 한다.

---

## A1. `catch` 755곳

### 전수 조사 (2026-09-29)

| | 수 |
|---|---:|
| WS4.0 자기 코드의 `try/catch` | **3,607** |
| 이미 `U4ALOG.caught` 가 있는 것 | **2,813** |
| **없는 것** | **794** |
| − 압축 파일 (건드리면 안 됨) | −39 |
| **손볼 곳** | **755** |
| 그중 **완전히 빈 `catch {}`** | **41** |

프라미스 `.catch(function(e){…})` 는 대상이 아니고 세지도 않았다.

| 곳 | 수 |
|---|---:|
| `ws30/ws10_20/js` | **394** |
| `ws30/ws10_20/js/usp` | 59 |
| `js` | 36 |
| `Popups/dataMonitor/Popup/js` | 33 |
| `Popups/monacoThemeDesign/Popup/js` | 24 |
| `ServerList_v2` | 22 |
| `design/preview` | 22 |
| `Popups/monacoSnippetDesigner/Popup/js` | 22 |

### 목록은 직접 뽑는다

베껴 쓴 목록은 누가 파일을 고치는 순간 낡는다. **스캔 코드를 지침서에 통째로 넣어 놨다.**
돌리면 **파일 · 줄 · 그 자리의 변수 이름 · 원문**이 나온다.

**검산 숫자를 같이 박았다** — 이게 안 나오면 **규칙이 틀린 것이니 코드를 건드리기 전에
규칙부터 고치라**고 적었다:

```
total 3607 / have 2813 / minified(skip) 39 / TO FIX 755 / empty catch {} 41
```

### 넣을 것

```js
catch (e) {
    if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
    // …기존 코드 그대로…
}
```

**`catch` 맨 첫 줄에 한 줄.** 나머지는 손대지 않는다.

### ⚠ 사고 나기 쉬운 자리

1. **변수 이름이 제각각이다** — `e` 636 · `error` 57 · `err` 18 · `e2` 15 · `t` 15 ·
   `e3` 13 · `oError` 7 · `eSend` 6 · 그 밖.
   **`U4ALOG.caught(e)` 로 일괄 치환하면 `ReferenceError` 난다.**
2. **바인딩 없는 `catch {` 가 1곳** — `catch (e) {` 로 먼저 바꾼다.
3. **한 줄짜리 `catch` 가 많다** (`} catch (e) { return false; }`). 펴도 되지만
   **기존 문장 순서는 그대로**, 새 줄이 맨 앞.
4. **압축 파일 제외** — `jquery.min.js`(24) · `jquery-ui.min.js`(11) · `crypto-js.min.js`(4).
5. **제외 폴더** — `openui5_lib` · `node_modules` · `lib/` · `js/aceeditor` ·
   `lib/fontawesome` · `lib/monaco` · `_` 로 시작하는 것.
6. **백업 `.js` 금지.** 되돌리는 건 git 이 한다. `AGENTS.md:51` 의 백업 규칙은
   **이 작업엔 적용 안 한다** — 전에 685개가 쌓여서 지웠다.

### 나눠서 한다 — 755곳을 한 번에 하면 터진다

**한 세션에 안 끝난다.** 그걸 전제로 짜라고 적었다.

1. **빈 `catch {}` 41곳** (어디에 있든)
2. `ws30/ws10_20/js` (394) — 필요하면 파일 단위로 더 쪼갠다
3. `ws30/ws10_20/js/usp` (59)
4. `js` (36)
5. 나머지

### 🔴 진행 기록 파일을 두게 했다 — 다음 세션이 이어받게

시작 전에 저장소에 `.docs/A1-progress.md` 를 만들고, **배치마다 같이 커밋**하게 했다.

```markdown
# A1 진행 — catch 에 U4ALOG.caught 넣기

- 대상 총계 (스캔 결과) : 755곳 / 빈 catch 41곳
- 브랜치 : <브랜치>

| 폴더 | 대상 | 끝난 날 | 커밋 | 앱 확인 |
|---|---:|---|---|---|
| (빈 catch 41곳) | 41 | | | |
| www/ws30/ws10_20/js | 394 | | | |
| … | | | | |

## 막힌 것 / 손대지 않고 넘긴 것
- (파일:줄 — 왜)
```

**컨텍스트가 떨어진 세션은 이 파일을 정확히 남기고 끝내야 한다.**
다음 세션은 이걸 읽고 스캔을 다시 돌려 **안 끝난 첫 줄부터** 잇는다.
이게 없으면 **어디까지 했는지 알 방법이 없다.**

**일부러 건너뛴 것도 이유와 함께 적게** 했다 — 바로 다시 던지는 `catch`, 생성된 파일 같은 것.
안 적으면 다음 세션이 같은 조사를 또 한다.

### 한 폴더 끝날 때마다

```bash
node --check <고친 파일들>      # 1. 문법
git diff --stat                 # 2. 줄 추가만 있나
```

**3. 그리고 WS4.0 을 실제로 띄워서 화면 하나를 연다.**

`node --check` 는 **파일이 파싱되는 것만** 증명한다. **앱이 도는 것은 증명 못 한다** —
`catch` 를 잘못 펴서 중괄호가 어긋나면, 파싱은 되는데 **바깥 함수가 깨진다.**
**돌려 보는 것 말고는 잡을 방법이 없다.**

폴더당 최소 확인 — 앱이 뜨고, WS10 까지 가고, 앱 하나를 WS20 으로 열고,
**전에 없던 오류가 콘솔에 안 나면** 된다. 고친 폴더가 그 길에 없으면 해당 화면을 대신 만진다.

**4. 커밋하고, 같은 커밋에 `.docs/A1-progress.md` 를 갱신한다.**

**커밋 하나하나가 따로 되돌려져야 한다.**

---

## A2. 반복 억제를 끄는 스위치

**짝 작업이다. 테스터가 이 스위치를 부른다 — §5.**

### 지금 코드 — `ws_html5_logger.js:51-52`

```js
var CAUGHT_FIRST = 3;      // 처음 3번은 그대로 남긴다
var CAUGHT_EVERY = 500;    // 그 뒤로는 500번마다 한 번
```

`caught()` 는 **오류 글(`e.message`)을 열쇠로** 센다 (`:859-865`).
4번째부터는 **500번에 한 번**만 남는다.

### 문제 셋

1. **반복·간헐 오류가 로그에서 사라진다.** 테스터는 0.1초마다 두드린다.
   같은 오류가 3번을 금방 넘기고, 그 뒤로는 500번에 한 번 —
   정작 사고가 났을 때 로그에 자국이 없을 수 있다.
2. **열쇠가 글이라 서로 다른 자리가 한 통에 섞인다.**
   `Cannot read properties of undefined` 같은 흔한 글은 수십 군데에서 난다.
   **A 자리가 3번 쓰면 B 자리는 처음인데도 안 남는다.**
3. **`_oCaughtCount` 가 한 번도 안 비워진다** (`:50`, 초기화하는 곳 없음).
   한 번 3번을 넘긴 글은 그 세션 내내 눌린다.

### 만들 것

**평소 동작은 지금 그대로 두고**, 끄는 토글만 붙인다.

```js
U4ALOG.setCaughtThrottle(false)   // 끈다 — 전부 남긴다
U4ALOG.setCaughtThrottle(true)    // 켠다 — 기본값
```

- 로드 시점이 아니라 **아무 때나 콘솔·`Runtime.evaluate` 로 부를 수 있어야** 한다
- **끄면 `_oCaughtCount` 도 같이 비운다** — 이미 눌린 오류가 바로 다시 남게
- 운영 기본값은 안 바꾼다

**문제 3은 스위치와 별개로 고친다** — 화면 전환·앱 전환 때 `_oCaughtCount` 를 비운다.
안 비워지는 카운터는 로그 버그이자 누수다.

문제 2(글만으로 세는 것)는 **이번 지시 범위가 아니다.** 싸게 되면 하고 보고하라고 했다.

---

## A3. `_write` 의 등급 — 안 고친다

`ws_html5_logger.js:460` 에서 `참고` 는 `console.log` 로 나가, 테스터가 사고로 안 친다.

**그대로가 맞다.** 코드 주석의 판단이 옳다 — `caught` 에 걸리는 것 대부분이
*"일단 해 보고 안 되면 다른 길로"* 인 정상 흐름이라 `오류` 로 올리면 로그가 온통 빨개진다.

테스터는 **레벨을 안 가리고 전부** 담으므로 `참고` 여도 분석에는 다 들어온다.

**확인 완료 — 건드리지 말라고 적었다.**

---

## A4. 속성값을 버릴 때 뭘 버렸는지

분석이 두 번 지목한 **"앱 속성값 덤프"** 가 이것이다.

### A4-1. `design/preview/index.js:5076` — 정황이 없다

```js
var l_class = getUIClassInstance(ls_0022.LIBNM);
try {
    parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid(), setUIProperty(is_tree, lt_0015));
} catch (e) {
    if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); }
    parent.oAPP.attr.prev[is_tree.OBJID] = new l_class(jQuery.sap.uid());   // ← 속성 없이 다시 만든다
}
```

`caught` 는 있는데 **어느 객체·어느 클래스인지가 없다.**
`caught` 는 **둘째 인자 `sWhere`** 를 받는다 (`:849`):

```js
U4ALOG.caught(e, "createUIInstance OBJID=" + is_tree.OBJID + " LIBNM=" + ls_0022.LIBNM);
```

**실제 사고 1건이 정확히 여기서 났다** — `l_class is not a constructor`,
`preview/index.js:5079`. catch 안에서 다시 만들다 또 터진 것이다.

### A4-2. `design/preview/index.js:5209 parsePropertyValue` — 조용히 버린다

```js
case "INT":
case "FLOAT":
    l_val = Number(vVal);
    if (isNaN(l_val) === true) {
        return 0;               // ← 나쁜 값이 소리 없이 0 이 된다
    }
    return l_val;
default:
    …
    if (l_type && typeof l_type.isValid === "function" && l_type.isValid(l_val) === false) {
        l_val = undefined;      // ← 나쁜 값이 소리 없이 사라진다
    }
```

둘 다 아무 기록이 없다. 분석이 "어느 속성이 나빴나" 를 못 짚은 이유가 이것이다.

```js
if (typeof U4ALOG !== "undefined" && U4ALOG.warn) {
    U4ALOG.warn("속성값 버림",
                is_attr.OBJID + "." + is_attr.UIATT,
                is_attr.UIADT + " <- " + String(vVal).slice(0, 80) + " => 0");
}
```

**필드 이름은 내가 확인해서 넣었다 — 다시 뒤지지 말라고 적었다.**
`is_attr` 는 `T_0015` 행. 호출부 `:5285`(`ls_0015`) · `:5356`·`:5369`(`lt_0015[i]`).
`OBJID`·`UIATT`·`UIADT` 다 있다.

**확인할 것 둘**

- 이 함수는 **한 화면에 수백 번** 불린다. **값을 버리는 두 자리 안에서만** 남긴다
- **값 길이를 자른다** (`.slice(0, 80)`)

**고친 뒤 검증** — 앱 하나 열고 `속성값 버림` 줄을 센다. 몇 줄이면 정상,
**수백 줄이면 넣은 자리가 틀린 것.**

---

## 5. 테스터 쪽 짝 작업

A2 는 **누가 시험 중에 스위치를 꺼 줘야** 값어치가 있다. 그건 테스터 일이고 이미 지시했다:

```js
session.eval('typeof U4ALOG !== "undefined" && U4ALOG.setCaughtThrottle && U4ALOG.setCaughtThrottle(false)')
```

창에 붙은 직후 이렇게 부른다.

**그러니 스위치는 이렇게 불릴 수 있어야 한다** — `U4ALOG` 의 전역, 로거가 뜬 뒤 언제든,
여러 번 불러도 안전하게, 로거가 아직 없을 때 불려도 안 터지게.

**A2 가 들어가면 보고**해야 테스터 쪽을 켠다.

---

## 6. 작업 방식

1. **`bootstrap` 에서 딴다.** 시작 전 `git branch --show-current` · `git status --short` 확인
2. **오류 난 줄만 보고 고치지 않는다** — 앞뒤 사정과 사용처를 먼저
3. **백업 `.js` 금지**
4. **A1 은 줄 추가만.** 폴더 단위 커밋, 커밋 전 `node --check`
5. **압축 파일·남의 라이브러리 금지**
6. **A4 는 로그량을 반드시 재 본다**

---

## 7. 끝나면 보고할 것

- 브랜치 이름과 커밋 범위
- 실제 건수 — 몇 곳 고쳤나, 몇 파일 (755 / 41 과 비교)
- **A2 가 들어갔나, 정확한 호출 모양은** (테스터가 필요로 한다)
- `_oCaughtCount` 비우기를 넣었나, 어디서 비우나
- 이 지침서가 예측 못 한 것

---

## 8. 근거

| 사실 | 확인처 |
|---|---|
| 테스터는 `Runtime.enable` · `Page.enable` 만 켠다 | `u4a-ws-cdp-tester/lib/cdp-client.js:298,493,601,619` |
| 콘솔 줄엔 스택이 안 실려 온다 | 실제 사고 `raw.json` — 열쇠 4개 |
| 안 잡힌 오류는 스택 7칸이 다 온다 | 같은 파일 `exceptionDetails.stackTrace` |
| `thrown at …` 은 WS4.0 이 직접 만든다 | `ws_html5_logger.js:277 _crashSite` |
| 콘솔은 레벨 안 가리고 전부 담긴다 | `u4a-ws-cdp-tester/lib/ws/window-session.js:85` |
| 테스터가 페이지에서 JS 를 부를 수 있다 | `u4a-ws-cdp-tester/lib/cdp-client.js:603 evaluate` |
| 분석이 멈춘 이유 | 사고 폴더의 `analysis.md` 2개 |
| `catch` 수치 | `www` 전수 조사 (2026-09-29) |
| `is_attr` 필드 이름 | `index.js:5285`·`:5356`·`:5369` + `T_0015` 행 |
