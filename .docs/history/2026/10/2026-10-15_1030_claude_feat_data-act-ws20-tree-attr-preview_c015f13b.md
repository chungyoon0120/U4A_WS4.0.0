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

## 뒤따라 — 설명 팝업의 번역 칸을 갈랐다

원어 칸과 번역 칸이 같은 값이어서 상대가 순서로 집어야 했다(둘 중 하나만 있을 때도 있어 조용히
엉뚱한 칸을 읽는다). 상대 요청대로 번역 칸만 `DESCPOP_TEXT_TRN` 으로 바꿨다. 원어 칸은 그대로.

## 기다리는 일 — 소문자 `close` 를 한 번에 올리기 (상대 신호 대기)

상대가 다시 세어 **WS20 밖에 소문자 `close` 가 16곳 + 앱 생성 창 X 1곳 + `theme/shell.css` 의
소문자 셀렉터 2줄** 이라고 알려 왔다. 하나만 먼저 올리면 규칙이 더 섞이므로 **한 번에** 올린다.
순서는 ① 상대가 소문자를 집는 자리(앱 검색 F4 창 · 서버 정보 창)를 대소문자 둘 다 받게 고친 뒤
신호 → ② 그때 우리가 전부 `CLOSE` 로. **신호가 오기 전에는 손대지 않는다.**

상대가 알려 준 16곳: `fnAppF4PopupOpen.js` · `fnAppCopyPopupOpen.js` · `fnCtsPopupOpen.js` ·
`fnDynListPopup.js` · `fnF4SearchHelpPopup.js` · `fnSelectBrowserPopupOpen.js` ·
`callDataSetFieldListPopop.js` · `changeAppPackagePopup.js` · `createApplicationPopup.js`(2) ·
`ws_common.js` · `ws_fn_04.js`(3) · `ws_html5_client_editor.js` · `frame.js`

## 장군님 지시 2026-10-15 — 앱 생성 창 X 를 대문자로 (상대의 「보류」보다 상위)

상대는 「16곳과 한 번에」 를 제안했지만 장군님이 **「1번은 동일하게 맞춰」** 라고 지시해 앱 생성 창의
머리 X 만 `CLOSE` 로 올렸다. **깨질 위험 없음을 확인했다** — 상대가 소문자로 집고 있다고 밝힌 곳은
앱 검색 F4 창과 서버 정보 창이고, 이 창은 그 목록에 없다. 이 파일 안에서 그 값을 셀렉터로 쓰는
코드도 없다(grep 확인). 푸터 닫기는 이미 `CLOSE` 여서 이제 한 창에 `CLOSE` 둘이다(옵션 창과 같은 모양).

나머지 16곳 + 공통 CSS 의 소문자 셀렉터는 **상대 신호를 기다린다**(위 절).

## 장군님 지시 2026-10-15 — 다른 창 파일이 섞인 커밋은 그대로 둔다

올리기 도구가 `git add -A` 라 다른 대화창이 작업 중이던 파일 9개가 내 커밋(1c3d92d4)에 함께 올라갔다.
장군님 지시 **「2번은 커밋 푸시 해놔」** = 되돌리지 않고 그대로 둔다. 이미 원격까지 올라간 상태였다.

★또 밟을 함정: 이 저장소는 **여러 대화창이 같은 작업 폴더에서 동시에** 고친다. 올리기 도구가 바뀐
것을 전부 담으므로, 내 커밋에 남의 작업이 섞이는 일은 **또 일어난다.** 섞였으면 되돌리지 말고
**장군님께 알리고 지시를 받는다**(되돌리면 남의 작업이 사라진다).

## 장군님 지시 2026-10-15 「지금 바꿔」 — 남은 소문자 닫기 14곳 + 공통 CSS 정리

대상 14곳(창 12개 파일 — 서버 정보 쪽 파일만 3곳): DataSet 필드목록 · 패키지 변경 · 복사 ·
앱 검색 도움말 · 전송요청 · 목록 · 값도움 검색 · 브라우저 선택 · 공통 창 · 서버 정보 등 3 ·
클라이언트 편집기 · 글자 찾기. 전부 **머리의 닫기 X 하나씩**이고 값만 `close` → `CLOSE`.

`theme/shell.css` 의 옛 소문자 셀렉터 2줄은 **가리킬 자리가 남지 않아 지웠다**(대문자 2줄만 남김).

### 바꾸기 전에 본 것 (이번엔 먼저 봤다)

- **우리 코드가 그 값을 셀렉터로 쓰는 자리 = 0건.** 공통 CSS 두 줄이 유일했다(전수 grep).
- **자동 테스트 쪽 코드도 직접 읽었다** — 닫기를 집는 자리 3곳(`ws10/app_search.py` ·
  `ws10/ws_info.py` · `ws20/layout.py`)이 **대문자·소문자 둘 다** 받게 적혀 있고,
  별창 쪽(`app/browser.py`)은 대문자만 본다. 나머지 창은 그쪽 대상이 아니다.
  → 그쪽이 쓰는 **다른 속성**(`data-action`)은 손대지 않았다.
- 바꾼 뒤 전수 재확인: 소문자 값·소문자 셀렉터 **0건**. 전 파일 `node --check` 통과.

### 왜 바꿨나 (통일성만이 아니다)

① 자동 테스트 쪽이 「둘 다 받기」 예외를 지울 수 있다 ② 새 창을 만들 때 옆 창을 베껴 소문자가
14곳까지 번졌으므로, 한쪽으로 정리하면 다음에 베껴도 맞다.
