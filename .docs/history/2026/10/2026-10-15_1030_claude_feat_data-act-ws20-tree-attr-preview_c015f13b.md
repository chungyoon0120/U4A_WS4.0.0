# WS20 트리·UI 오브젝트 속성·미리보기·화면 안 창에 자동 테스트 식별값(data-act)

- 날짜: 2026-10-15
- 요청: 자동 테스트 쪽 대화창 요청서 `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-15_ws20-tree-attr-preview-data-act.md` (64자리 + 규칙 2)
- 근거 표준: `.analy/21_화면요소_식별값_표준.md`

## 한 일

| 묶음 | 파일 | 무엇 |
|---|---|---|
| 1 | `ws_html5_ws20_tree.js` | 트리 도구줄 만드는 함수에 한 줄(`oCfg.act`) + 단추 11개(`TREE_*`) + 줄 체크박스 `TREECHK` |
| 2 | `ws_html5_ws20_attr.js` | **표에 없는 UIATK 폴백** = `PROP_<UIATT>`(대소문자 그대로) + 값 칸 셀렉터에 `select` 추가 + 머리·도구줄·설명 팝업 15곳 |
| 3 | `ws_html5_ws20.js` · `ws_html5_ws20_prev.js` | 미리보기 헤더 6곳(`PREV_RESET`·`PREV_ZOOM`·`PREV_FULLSCREEN`·`PREV_FULLSCREEN_INPUT`·`PREV_HELP`·`PREV_LOCK`) |
| 4-1 | `ws_html5_ws20_edit.js` · `ws_html5_ws20.js` · `design/js/uiMovePosition.js` | 소문자 → 대문자(`CANCEL`·`OK`·`CLOSE`·`DEFAULT`·`SAVE`) |
| 4-2 | `ws_html5_ws20_edit.js` | 「오브젝트 삽입」 창 안 9곳 + **목록 줄에 `data-uiobk`** |
| 4-3 | `ws_html5_ws20_dnd.js` | Aggregation List 창 4곳 |
| 5 | `ws_html5_ws20.js` · `usp/ws_html5_usp.js` | 앱 헤더 3곳 + **WS30(USP)에도 같은 값**(`APPHDR_BACK`·`APPHDR_NEWWIN`) |
| 6 | `ws_html5_ws20.js` | `APPHDR_APPID` + 모드·상태에 `data-state`(EDIT/DISPLAY · ACTIVE/INACTIVE) |

전 파일 `node --check` 통과.

## ★또 밟을 함정 — 값을 바꿨으면 그 값을 찾는 코드도 같이 바꿔야 한다

`data-act` 는 **우리 코드가 셀렉터로도 쓰고 있었다.** 소문자를 대문자로 바꾸면서 다음을 같이 고쳤다
— 안 고치면 **단추가 조용히 안 먹는다**(문법 오류도 안 난다).

- `ws_html5_ws20_edit.js` — 삽입 창 Confirm 찾기, 취소 단추 전체 찾기 / UI 위치 이동 창 확인·취소·Enter 포커스 / UI 미리보기 팝오버 닫기
- `ws_html5_ws20.js` — 분할 위치 창은 **값으로 분기**한다(`if (sAct === "close")` …) → 비교 글자까지 대문자로
- `design/js/uiMovePosition.js` — 같은 창이 **경로 둘**이다(미리보기 우클릭 = 이 파일 / 트리 우클릭 = `ws_html5_ws20_edit.js`). 한쪽만 바꾸면 두 창의 값이 달라진다.
- **`theme/shell.css`** — 닫기·취소 아이콘의 hover 빨강이 `[data-act="close"]`·`[data-act="cancel"]` 로 **CSS 에** 걸려 있었다. 대문자 셀렉터를 같은 규칙에 **추가**했다(안 하면 값만 바꿔도 **모양이 바뀐다**). 공통 CSS 를 건드린 유일한 자리이며, 기존 줄은 그대로 두고 두 줄만 더했다.

## 보고만 — 요청 밖이라 손대지 않은 것

- `design/js/createApplicationPopup.js` 의 앱 생성 창 닫기 X 가 아직 **소문자 `close`** 다. 요청 목록에 없어 두었다. 「같은 일에는 같은 값」 기준으로는 `CLOSE` 가 맞다 — 상대에게 알리고 지시를 받는다.
- 설명 팝업의 입력칸은 **원어·번역 두 개**라 `DESCPOP_TEXT` 가 한 창에 둘이다(요청은 값 하나). 보이는 것 하나를 집는 그쪽 방식이면 첫 번째가 걸린다.
