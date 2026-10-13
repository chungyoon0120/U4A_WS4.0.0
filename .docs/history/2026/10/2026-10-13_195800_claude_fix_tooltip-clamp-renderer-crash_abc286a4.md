# 공통 tooltip 이 아주 긴 글에서 renderer 를 죽이던 것 — 글자 수 상한 (2026-10-13)

## 무엇이 문제였나

UI 개인화 목록의 한 줄에 **마우스를 올리기만 해도 그 창이 죽었다.** JS 예외도 메모리 고갈도 아니었다
(죽기 직전 heap 48MB / 한도 3,586MB · 오류 0건).

원인은 **공통 커스텀 tooltip**(`www/ws30/ws10_20/theme/u4a-ui.js` 의 `initTooltip`)이다.
문서 전역 `mouseover` 위임이 공통 표의 칸에 닿으면
① `title` 을 `data-tip`·`aria-label` 로 복사 ② `title` 이 없으면 **칸의 `textContent` 를 통째로** `data-tip` 으로 넣음
③ 350ms 뒤 그 글자를 tooltip 요소에 넣고 `offsetWidth/offsetHeight` 를 잰다.

tooltip 상자는 `max-width: 24rem` + `white-space: normal` + `overflow-wrap: anywhere` 라
**866,250 글자의 줄바꿈 위치를 전부 계산**해야 한다 → 거기서 renderer 가 죽는다.

원본(UI5, WS3.0)은 native `title` 을 그대로 둔다. **브라우저가 알아서 앞부분만 잘라 보여 주므로** 비용이 없다
— 그래서 WS3.0 쪽 자료는 **2,065,934 글자(더 길다)** 인데도 멀쩡했다.

## CDP 실측 (같은 창에서 연달아, 2026-10-13 19:4x)

| 조작 | 결과 |
|---|---|
| 코드로 팝업 열기 | 46ms, 5줄, heap 48MB |
| 코드로 연필(편집) 클릭 — 마우스 없음 | 20ms, 안 죽음. `textarea` 에 866,250 글자 |
| **진짜 마우스로** 뒤로가기 클릭 | **10.6초 멈춤**, 안 죽음, heap 48MB |
| **진짜 마우스로** 그 줄에 hover | **1초 안에 사망** |

→ 죽이는 것은 hover 하나다. 연필·뒤로가기는 **느릴 뿐**이다.
장군님이 「연필 → 뒤로가기」에서 죽으신 것도, 뒤로가기 뒤 목록이 다시 그려진 자리에 커서가 얹혀 tooltip 이 돈 것으로 설명된다.

## 고친 것

`u4a-ui.js` `initTooltip` 안에 `TIP_MAX_CHARS = 1000` 과 `_clampTip()` 을 두고 **세 곳**에 적용:
`_show` 의 tooltip 글자 · `_promote` 의 `data-tip`/`aria-label` · `_autoCellTip` 의 `data-tip`.
넘치면 앞 1000자 + `…`. 잘린 사실은 `U4ALOG.warn("TEXT_CLAMP", …)` 로 **세션당 한 번만** 남긴다
(hover 마다 쌓이면 로그가 터진다). 사건 이름 `TEXT_CLAMP` 는 `.works/DEV_STANDARD_로그.md` 표에 한 줄 추가했다.

※ 「공통 자산 직접 수정 금지」 규칙이 있으나, 이번 건은 화면별 스타일이 아니라 **공통 기능 자체의 결함**이라
장군님 승인(「진행해라」)을 받고 공통에서 고쳤다.

## 아직 안 한 것 / 버린 가설

- **테스트 통과** — 장군님 확인 2026-10-13 「이제 앱이 크래시 나진 않네」. 긴 줄에 마우스를 올려도 안 죽는다.
- 연필·뒤로가기의 **느림 자체는 그대로** 남아 있다(뒤로가기 10.6초). busy 양보는 그 뒤 전 버튼에 넣었다(다른 이력).
- 버린 가설: ① 메모리 고갈 — heap 48MB 로 반증 ② 글자 길이 자체 — WS3.0 이 2.4배 긴 글로도 멀쩡해 반증
  ③ 표가 폭을 재느라 — `table-layout: fixed` 라 반증 ④ hover 때 layout 이 바뀌어서 — 배경색만 바뀌어 반증
  ⑤ 글자가 `td` 에 직접 들어가서(원본은 `span`) — 내 추정이었고 확인 못 했다. 실측으로 ①~④ 를 지우고 tooltip 으로 좁혔다.

## 따로 나온 것 (보고만)

앱 본체 로그 파일이 **설치된 exe 와 no-build 가 같은 파일**(`%APPDATA%\com.u4a_ws3.app\logs\U4A_WS_<날짜>.log`)을 쓴다.
나중에 켠 쪽이 새로 쓰기 시작해 **먼저 켠 쪽 기록이 사라진다** — 이번에 renderer 사망 기록(`RENDERER_GONE`)을 못 봤다.
