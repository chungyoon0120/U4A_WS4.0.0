# 모든 창 닫기가 공통 busy 창까지 닫던 것 — 제외

- 때: 2026-10-23
- 누가: Claude (세션 06836675) · 지시 = 장군님(「여기서 전체 dialog를 닫아버리니까 busy가 꺼진줄 알지」 → 「빼라」)
- 고친 파일: `www/ws30/ws10_20/js/ws_html5_shell.js` (`oAPP.fn.fnCloseAllDialog`)

## 무엇이 문제였나

테스트 도구가 「WS20 → WS10 이동 때 **busy 가 꺼진 뒤에** DOM 변경이 감지된다」고 잡아냈다.
공통 busy 는 DOM 변경이 조용해질 때까지 기다려서 끄므로, 그럴 수 없는 일이었다.

## 원인 (소스로 확인)

`js/ws_html5_shell.js` 의 `fnCloseAllDialog` 가 **열린 `<dialog>` 를 예외 없이 전부 닫았다.**
공통 busy 도 `<dialog>` + `showModal()`(`theme/u4a-busy.js` 216행 `oDlg.id = BUSY_ID`)이라 같이 닫혔다.

실제 순서 (`js/ws_fn_02.js` `fnMoveToWs10`):

| 줄 | 하는 일 |
|---|---|
| 618 | `fnCloseAllWs20Dialogs()` → 2454행 `fnCloseAllDialog()` → **busy 창이 여기서 닫힌다** |
| 622 | `removeContent()` — WS20 DOM 초기화 |
| 631 | `fnOnMoveToPage("WS10")` → `ws_html5_shell.js` 1100행에서 **끄라는 신호** |

busy 창은 흐름 **맨 앞**에서 사라지고, 그 뒤 WS20 DOM 초기화·페이지 전환이 전부 조작 가능한
상태로 돌았다. 끄라는 신호가 올 때는 **닫을 창이 이미 없었다.**

### 같은 document 라서 잡힌다 (확인한 것)

`ws30/ws10_20/index.html` 73행이 `../resources/index.js` 를 **직접 싣는다** — iframe 이 아니다.
그래서 `parent` 가 자기 자신이고, `parent.setBusy` 가 만든 busy `<dialog>` 는
`fnCloseAllDialog` 의 `document.querySelectorAll("dialog[open]")` 에 **그대로 잡혔다.**

## 고친 것

`fnCloseAllDialog` 에서 `id === "u4aWsBusyIndicator"` 인 `<dialog>` 를 **건너뛴다.**
건너뛴 경우에만 로그 한 줄(`DONE / fnCloseAllDialog / kept ... open`).
`node --check` 통과.

호출처 2곳 모두 읽었다 — 둘 다 반환값을 쓰지 않고, busy 를 닫을 의도가 아니다.

- `js/ws_fn_02.js:2454` (`fnCloseAllWs20Dialogs` 안)
- `js/usp/ws_html5_usp.js:449` (`_doBackToWs10` 안)

## 원본은 어떻게 돼 있나

**원본도 제외 목록을 둔다.** `js/ws_fn_02.js` 2036행 `_closeAllDialogs()` 의
`EXCLUDE_DIALOG_NAMES = ["APPF4"]` — 특정 창은 닫지 않는다.
즉 이 수정은 원본 설계와 같은 결이다(임의 창작이 아니다).

## ★또 밟을 함정

1. **공통 busy 는 `<dialog>` 다.** `dialog[open]` 를 쓸어 담는 코드를 새로 쓰면 busy 가 같이 걸린다.
   → 반드시 `id === "u4aWsBusyIndicator"` 를 제외한다.
   이미 그렇게 해 둔 곳: `resources/index.js` 218행(토스트 붙일 자리 고르기),
   `js/ws_fn_03.js` 389행(`dialog[open]:not(.u4aWsBusyIndicator)`).
2. **우리 개발 모드 busy 로그로는 이 사고를 못 본다.** 그 로그는 「끄라는 신호」 기준이고,
   감시를 끄기 직전에 disconnect 하므로 **창이 남의 손에 닫힌 것은 보이지 않는다.**
   그래서 로그만 보고 「공통은 정상」이라고 네 번이나 잘못 판정했다.
3. `ws10_20` 은 **iframe 이 아니다.** `parent` 가 자기 자신이라, parent 로 켠 busy 도 자기 document 에 있다.
   「parent 에 있으니 안 잡힌다」고 넘기면 틀린다.

## 버린 판정들 (내가 틀린 것)

끝까지 읽지 않고 판정을 네 번 바꿨다. 무엇을 안 보고 말했는지:

| 판정 | 왜 틀렸나 |
|---|---|
| ① `ws_html5_shell.js:1100` 이 문제 | 공통 busy 의 조용함 판정 로직을 안 봤다 |
| ② 화면 전환 애니메이션 0.26초 동안 조용해서 일찍 끈다 | 로그의 `quiet=453ms`·`rounds=2` 와 안 맞는다 |
| ③ 공통도 정상 · 로그도 정상 | `rounds=2`(한 번 더 돌았다) 의 뜻을 안 따졌다 |
| ④ `pointerEvents` 가 범인 | 장군님 지적 — 그건 마우스 막기일 뿐이다 |

**못 본 것은 `fnMoveToWs10` 618행이었다.** 「별창·확인창 닫기」로만 보고 넘겼다.

## 아직 확인 못 한 것

- 장군님 테스트 대기: TODO 0-1 ~ 0-3.
- 특히 **busy 가 끝내 안 꺼지는 경우가 없는지**(fail-closed 라 안 꺼지면 화면이 멈춘 것처럼 보인다).
  종전에는 이 자리에서 창을 닫아 버려 그 문제가 가려져 있었을 수 있다.
