# 창 제목줄 로고가 안 뜨던 것 — 주소를 만드는 괄호가 한 칸 밀려 있었다 (4곳)

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「공통 헤더의 로고이미지는 왜 안나오는거냐?」 → 「1번부터 진행해라」(TODO 1-20)
- 증상: 「UI5 Predefined Css」 창 제목줄 왼쪽에 **깨진 그림 아이콘**

## 원인

```js
REMOTE.getGlobal("u4aToAppUrl")(PATH.join)(APPPATH, "img", "logo.png")
                                ^^^^^^^^^ 함수 자체를 넘긴다
```

괄호가 한 칸 밀려 **`PATH.join` 함수 자체**를 `toAppUrl` 에 넘긴다.
`toAppUrl`(`electron/lib/protocol/ws_app_protocol.js:299`)은 **문자열이 아니면 빈 글자를 돌려준다.**
그 빈 글자를 다시 함수처럼 부르니 TypeError → `try/catch` 가 삼킨다 →
`src` 가 아예 안 들어가 **깨진 그림 아이콘**만 남는다.

## 고친 자리 — 4곳

| 파일 | 창 |
|---|---|
| `Popups/patternPopup/frame.js:1127` | 소스 패턴 창 |
| `Popups/ui5CssPopup_v2/main/frame.js:256` | UI5 Predefined Css 창 |
| `Popups/ui5CssPopup_v2/detail/frame.html:32` | 그 창의 미리보기 |
| `Popups/ui5CssPopup_v2/others/winChrome.js:94` | 그 창의 하위 창 |

올바른 27곳과 **같은 모양**으로 맞췄다:

```js
oLogo.src = REMOTE.getGlobal("u4aToAppUrl")(PATH.join(APPPATH, "img", "logo.png"));
```

★`encodeURI(...)` 와 `.replace(/\/g, "/")` 도 **같이 뺐다.**
 `toAppUrl` 이 **역슬래시를 `/` 로 바꾸고 각 조각을 `encodeURIComponent` 로 인코딩**한다(:351·:357 실측).
 바깥에서 `encodeURI` 를 또 걸면 **이미 인코딩된 `%` 가 `%25` 로 다시 인코딩**돼,
 경로에 한글·공백이 있는 PC 에서 깨진다. 올바른 27곳에는 둘 다 없다.

미리보기 쪽(`detail/frame.html:32`)은 **오류를 삼키는 빈 catch** 였다 → 같은 파일 다른 자리와 같은 모양으로 로그를 넣었다.

## 검증

- 틀린 모양이 남았는지 전수 확인 → **0건**
- `node --check` 통과(js 3개 · html 1개는 대상 아님)
- 테스트 항목 E7 로 올렸다

## ★함정 — 이 사고의 진짜 원인은 복붙이다

제목줄을 만드는 코드가 **41개 파일에 복사**돼 있고(로고까지 넣는 것 31개), 공통 생성기가 **없다.**
그래서 4곳이 틀리게 복사됐고 `try/catch` 에 묻혀 **아무도 몰랐다.**
→ 장군님 지시로 **복붙 금지 규칙**을 `.claude/rules/code.md` 에 못 박았다(2026-10-28).
→ 41곳을 공통으로 묶는 것은 **TODO 1-21** 로 올렸다(결정 대기).

★`try/catch` + 빈 블록은 이런 오타를 **영영 숨긴다.** 잡았으면 반드시 로그를 남긴다.

## 검증 결과 — 통과 (2026-10-28)

장군님이 눌러 확인하셨다. **E7 통과** — 「UI5 Predefined Css」 창과 소스 패턴 창의 제목줄에 로고가 뜬다.
