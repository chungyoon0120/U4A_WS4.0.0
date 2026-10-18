# WS30 헤더 · 세 단추 확인창 · ROOT 속성 창 5개에 자동 테스트 식별값(data-act)

- 날짜 2026-10-19 · 세션 c015f13b · type=feat
- 요청: 자동 테스트 쪽 대화창 3건 (`D:\workspace\u4a-ws4-mcp\.docs\request\` 의 2026-10-17 · 10-18 · 10-19 요청서)
- ★장군님 지시 2026-10-19 — **식별값 요청은 묻지 말고 바로 처리하고 그쪽에 회신**한다.

## 한 일

| 건 | 파일 | 무엇 |
|---|---|---|
| 1 | `ws_common.js` | WS30(USP) 헤더 — 창 핀 `PIN` · 창 숨기기 `WINSHOWHIDE` · T-CODE 칸 지우기 `TCODE_INPUT_CLEAR` |
| 2 | `resources/index.js` | 확인창 단추를 만드는 **공통 한 곳**에 `data-act = 그 단추가 콜백에 넘기는 값`(YES·NO·CANCEL·OK) |
| 3 | `fnCssJsLinkAddPopupOpen.js` | 창 뿌리 `CSSLINK_DLG`/`JSLINK_DLG`(열 때 갈라 단다) + 머리·도구줄·푸터 7곳 + **줄마다** `ROW_CHECK`·`ROW_URL`·`ROW_EXCLUDE` + 줄 번호 |
| 3 | `fnWebSecurityPopupOpen.js` | 창 뿌리 `WEBSEC_DLG` + 라디오 7개 + 외부 호스트 칸 + White List 툴바·머리·줄·푸터 |
| 3 | `fnDumpWritePopupOpen.js` · `fnInitPreScreenPopupOpen.js` | 창 뿌리 · 스위치 `TOGGLE` · `APPLY` · `CANCEL` · `CLOSE` (프리스크린은 `HELP` 까지) |

전 파일 `node --check` 통과. 모양·동작은 바꾸지 않았고 값만 더했다.

## 요청과 다르게 준 값 — 라디오 7개

상대는 `ACA_ANY`·`XFO_SAMEORIGIN` 같은 **자기들이 지어낸 이름**을 적으면서 「서버가 쓰는 코드가 있으면
그 코드를 그대로 주는 쪽이 더 좋다」고 했다. 소스를 보니 **그 칸 이름이 그대로 있다** —
`lf_setAca` 가 `M01`·`M02`·`M03` 을, `lf_setXfo` 가 `M01`~`M04` 를 세운다.
그래서 **`ACA_M01`~`ACA_M03` · `XFO_M01`~`XFO_M04`** 로 줬다. 표준 §2.2 「값은 코드가 이미 쓰는
고유 이름 그대로」 에도 맞는다.

## ★또 밟을 함정

- **UI5 컨트롤은 생성 시점에 속성을 못 붙인다** — 다시 그리면 사라진다. `addEventDelegate` 의
  `onAfterRendering` 에서 `getDomRef()` 로 DOM 을 잡아 붙인다(T-CODE 칸이 쓰던 그 방법).
  `SearchField` 의 지우기(✕)는 `getDomRef("reset")`.
- **CSS Link 창과 JS Link 창은 같은 창 하나를 돌려 쓴다.** class 가 완전히 같아 **머리 글자로만**
  구분됐다 — 열 때마다 창 뿌리의 값을 갈아 준다. 생성 시점에 한 번 달면 둘이 섞인다.
