# 로그인 화면 뜰 때 간헐 Critical Error — `classList` of null

- 일시: 2026-10-27
- 유형: investigate (조사만 · 이번 턴에 고친 코드 없음)
- 보고: 장군님 (이전 버전 소스를 받아 테스트하는 분이 겪음)

## 증상

서버리스트에서 로그인 화면을 띄울 때 **간헐적으로** 오류 창이 뜬다.

```
[Critical Error]: Please contact the solution team.
[onError]: Uncaught TypeError: Cannot read properties of null (reading 'classList')
file:///D:/U4A/WS40/U4A_WS4.0.0/www/ws30/ws10_20/theme/u4a-ui.js, 1076:74
```

## 터지는 자리 (확정)

테스터가 받은 소스는 옛 버전이라 줄 번호가 우리 작업 폴더와 다르다.
git 이력에서 **1076행이 `classList` 를 읽는 버전**을 찾아 대조했다 —
`bf7c3e3b`(09-02) · `0b54143a`(09-09) · `1f8ee271`(09-11) · `dcb1d34a`(09-29) 네 버전 모두
1076행이 아래 한 줄이고, **`classList` 글자가 시작하는 열이 정확히 74** 다(실측).

```js
// _installGlobalSplitterReset() 안 — 스플릿바 드래그 종료 시 iframe 포인터 복구
document.addEventListener("mouseup", function () { document.body.classList.remove("u4a-dragging"); }, true);
```

## 원인

1. `_installGlobalSplitterReset()` 은 `u4a-ui.js` **파일 맨 아래 top-level 에서 바로 호출**된다.
   → 파일이 평가되는 순간 `document` 에 mouseup 리스너가 걸린다.
2. `Login/Login.html` 은 이 파일을 **`<head>` 에서** 로드한다(실측).
   → 리스너가 걸리는 시점에 `<body>` 는 아직 파싱 전 = **`document.body` 가 null**.
3. 바로 옆 mousedown·dblclick 핸들러는 `e.target.closest(".u4a-splitter__bar")` 로 한 번 거른다.
   body 가 없으면 그 요소도 없어 조기 return 된다 → 안전.
   **이 mouseup 만 아무 조건 없이 곧장 `document.body` 를 읽는다** → 여기만 터진다.
4. 간헐적인 까닭 = 사용자가 **마우스 버튼을 떼는 순간**이 로그인 화면의 `<head>` 파싱 구간과
   겹칠 때만 그 mouseup 이 body 없는 문서로 떨어진다. 빨리 떼면 안 나고 늦게 떼면 난다.

## 조치 (이미 되어 있음)

커밋 `12276690` (2026-10-26 18:40) 에서 **다른 일**(처리중 표시 헛쓰기 제거)을 하다가
이 자리에 `document.body` 없음 검사가 같이 들어갔다. `git blame` 으로 확인.

```js
document.addEventListener("mouseup", function () {
    if (!document.body) { return; }
    if (document.body.classList.contains("u4a-dragging")) {
        document.body.classList.remove("u4a-dragging");
    }
}, true);
```

→ **현재 최신 소스에는 이 오류가 없다.** 테스터는 최신을 받으면 된다.

## 같은 파일 다른 자리 점검

`u4a-ui.js` 안에서 `document.body.classList` 를 읽는 자리를 전부 봤다.
나머지(다이얼로그 헤더 드래그 2곳 · 다이얼로그 크기조절 2곳 · 스플릿바 mousedown 1곳)는
**모두 특정 요소를 `closest` 로 찾은 뒤라야 도달**하므로 body 가 없으면 갈 수 없다.
`initWindowFocusState` 는 `if (!document.body) { return; }` 가 이미 있다.
→ 현재 소스에 같은 사고가 날 자리는 남아 있지 않다.

## 또 밟을 함정

- **`<head>` 에서 로드되는 공통 스크립트가 거는 전역 리스너는 `document.body` 가 null 인 채로 깨어날 수 있다.**
  `document` 에 거는 리스너 안에서 `document.body` 를 쓸 때는 **반드시 없음 검사**를 먼저 한다.
  요소를 `closest` 로 거르는 핸들러는 자동으로 안전해지지만, **거르지 않고 바로 body 를 만지는 핸들러**가 위험하다.
- 받은 소스의 줄 번호를 못 믿을 때는 **그 행·열에 해당 글자가 오는 버전을 git 이력에서 찾아 맞춘다.**
  이번에는 `classList` 시작 열(74)까지 일치시켜 버전을 특정했다.
