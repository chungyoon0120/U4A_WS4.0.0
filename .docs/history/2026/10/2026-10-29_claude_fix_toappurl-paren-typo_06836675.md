# 바인딩 팝업이 `is not a function` 으로 터지던 것 — 치환 때 생긴 괄호 오타

- 날짜: 2026-10-29
- 지시: 장군님이 오류 화면을 주심 → 「머하나 고치면 시발 죄다 영향도 제일 높게 해놧네 시발 잘된것도 좃같이 해놨네」
- 고친 자리: 2곳 — `Popups/bindPopup/designArea/designArea.js:1153` · `Popups/patternPopup/frame.js:163`

## 증상

바인딩 팝업을 열면 빨간 오류 창.

```
[onError]: Uncaught TypeError: oAPP.REMOTE.getGlobal(...)(...) is not a function
u4a-ws://app/ws30/ws10_20/Popups/bindPopup/designArea/designArea.js, 1153:118
```

## 원인 — **멀쩡하던 코드를 치환하면서 괄호를 틀리게 옮겼다**

2026-10-27 Electron 45 치환(커밋 `f40db53e`)에서 `file:///` 만들던 자리를 `toAppUrl` 로 바꿨는데,
괄호 자리를 잘못 옮겼다.

```js
// 틀린 것 — toAppUrl 에 **함수 p.replace 자체**를 넘기고, 그 결과(문자열)를 또 호출한다
getGlobal("u4aToAppUrl")(p.replace)(/\\/g, "/")

// 맞는 것
getGlobal("u4aToAppUrl")(p.replace(/\\/g, "/"))
```

`toAppUrl` 은 문자열을 돌려주는데 그것을 함수처럼 부르니 `is not a function`.

## 같은 오타가 더 있었다 — 같은 커밋에서 **`PATH.join` 에도** 똑같이 했다

```js
oLogo.src = encodeURI(REMOTE.getGlobal("u4aToAppUrl")(PATH.join)(APPPATH, "img", "logo.png")...)
```

이쪽은 **2026-10-28 에 이미 고쳐졌다.** `.claude/rules/code.md` 의 「실측 사고(2026-10-28) —
창 제목줄 코드가 41개 파일에 복사돼 있었고 그중 4곳이 괄호를 틀리게 복사해 그 창들만 로고가 안 떴다」가
바로 이 건이다. **`try/catch` 에 묻혀 조용히 깨져 있었다.**

이번에 남아 있던 것은 `.replace` 변형 2곳이었다.

## 전수 확인 — 지금 0건

```
grep -rnE 'getGlobal\("[^"]+"\)\([^)]*\)\(' www electron   → 0건
```

`getGlobal(…)` 의 결과를 **두 번 호출하는** 모양이 `www` · `electron` 전체에 더는 없다.

## 영향도

괄호 자리만 옮겼다. 넘기는 값도 돌려받는 값도 그대로다. `node --check` 두 파일 통과.

| 자리 | 지금까지 | 고친 뒤 |
|---|---|---|
| `designArea.js:1153` | 바인딩 팝업 트리에 그림 있는 줄이 나오면 **터짐** | 정상 |
| `patternPopup/frame.js:163` | 같은 오타 — 그림 있는 줄에서 **터짐** (아직 안 겪음) | 정상 |

## 또 밟을 함정

- **치환으로 코드를 바꿀 때 괄호가 밖으로 밀려난다.** `f(a.replace(/x/g,"y"))` 를
  `g(f)(a.replace)(/x/g,"y")` 처럼 만들기 쉽다. **치환 뒤 그 줄을 눈으로 읽는다.**
- **`try/catch` 안에 있으면 조용히 깨진다** — 로고가 그 예였다. 터진 자리를 못 찾으면
  `catch` 에 걸려 묻힌 것은 아닌지 본다.
- 이런 오타를 찾는 검사: `grep -rnE 'getGlobal\("[^"]+"\)\([^)]*\)\('`
  — **「함수를 부른 결과를 또 부르는」 모양**은 거의 언제나 오타다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 와 전수 grep 만 했다. 테스트 = TODO 1-10 · 1-11.
