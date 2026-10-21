# WS20 별창 둘 + 개인화 목록 창에 data-act 식별값 추가

- 시각: 2026-10-22
- type: feat
- 요청: 자동 테스트 쪽 대화창 (요청서 2건)
  - `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-20_ws20-separate-windows-data-act.md`
  - `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-20_tree-p13n-window-data-act.md`
- 근거 지시: 장군님 2026-10-19 「자동테스트 쪽 식별값 요청은 묻지 말고 바로 해주고 회신」
- 표준: `.analy/21_화면요소_식별값_표준.md`

## 한 일 — 파일 3개

### ① 창 보이기/숨기기 창 — `Popups/winShowHidePopup/index.js` (가장 급한 것)

| 자리 | data-act |
|---|---|
| 타이틀바 닫기 X | `CLOSE` |
| 투명도 슬라이더 | `WINHIDE_OPACITY` |
| 프리셋 단추 20/40/60/80/100 | `WINHIDE_PRESET` + `data-opacity="<값>"` |

★이 창을 열면 본 창이 `setIgnoreMouseEvents(true)` + 반투명이 된다. 닫을 길이 없으면 그 상태로 남아
사람이 쓰기 어려워진다 — 그래서 자동 테스트 쪽이 이 단추를 아예 안 누르고 기다리고 있었다.

### ② 텍스트 검색 창 — `Popups/textSearchPopup/Popup/frame.js`

| 자리 | data-act |
|---|---|
| 창 뿌리 | `TXTSRCH_DLG` |
| 찾을 글자 칸 | `TXTSRCH_INPUT` |
| 찾은 수("활성 / 전체") | `TXTSRCH_COUNT` |
| 이전 ▲ · 다음 ▼ | `TXTSRCH_PREV` · `TXTSRCH_NEXT` |
| 닫기 ✕ | `CLOSE` (원래 있었다) |

`_btn()` 이 아이콘만 받던 것을 **이름도 받게** 고쳐 한 자리에서 붙인다(줄마다 복붙 안 함).

★**요청서가 가리킨 파일이 틀렸다.** 요청서는 UI5 뷰(`Popup/views/vw_main/view.js`)를 가리켰는데,
실제로 뜨는 것은 `Popup/index.js` 가 iframe 에 넣는 **`frame.html` + `frame.js`**(이미 HTML5 로 변환된 쪽)다.
`views/vw_main/` 은 변환 전 UI5 잔재로 **로드되지 않는다.**

★요청서의 `TXTSRCH_FIND`·`TXTSRCH_ROW` 는 **그 창에 없다** — 글자를 치는 동안 바로 찾고(`input` 이벤트),
결과는 줄 목록이 아니라 숫자("3 / 12") 한 개다. 그래서 찾기 단추도 결과 줄도 만들지 않았다(없는 것을 만들면 창작).

### ③ 개인화 목록 창 — `js/fnP13nDesignPopupOpen.js`

| 자리 | data-act |
|---|---|
| 창 뿌리 `<dialog>` | `P13NLIST_DLG` |
| 머리 닫기 X | `CLOSE` |
| 머리 전체화면 토글 | `P13N_FULLSCREEN` |
| 푸터 닫기 | `CANCEL` |
| 목록 갱신 | `P13N_REFRESH` |
| 목록 줄 | `P13N_ROW` + `data-row="<fileName>"` |
| 줄 안 편집 · 삭제 | `P13N_ROW_EDIT` · `P13N_ROW_DEL` |
| 등록 페이지 뒤로 · 저장 · 삭제 | `P13N_BACK` · `SAVE` · `P13N_DELETE` |
| Description 입력칸 | `P13N_DESC` |

★`data-row` 값은 **그 줄의 `fileName`** 으로 넣었다 — 설명(Description)은 비어 있을 수 있어 키가 못 된다.
(코드가 줄을 고를 때 쓰는 값도 `fileName` 이다. 원래 있던 `data-file` 은 그대로 남겼다.)

## ★모양이 하나 바뀐다 (장군님께 보고한 것)

`theme/shell.css` 에 **`.u4a-btn-icon[data-act="CLOSE"]:hover { color: 빨강 }`** 규칙이 있다
(2026-10-15 에 전 다이얼로그 통일로 만든 것). 개인화 목록 창의 **머리 닫기 X** 가 그 class 를 쓰므로,
`CLOSE` 를 붙인 뒤부터 **마우스를 올리면 빨개진다**(전에는 기본색).
다른 두 창은 영향 없다 — 창 보이기/숨기기 닫기는 다른 class(이미 빨강), 텍스트 검색 닫기는 전부터 `CLOSE` 였다.
→ 공통 규칙이 뜻하는 모양과 같아지는 방향이라 그대로 뒀다. 되돌리려면 그 한 줄의 값만 다른 이름으로 바꾸면 된다.

## 안 한 것

- **UI 찾기 창(`designTreeUiSearchPopup/`) — 손대지 않았다.** 그 창을 띄우는 함수
  (`fnDialogPopupOpener.js` 의 `fnDesignTreeFindUiPopupOpen`)가 **전체 주석 처리**돼 있어 화면에서 갈 수 없다.
  ★`APPHDR_FINDUI` 단추가 실제로 부르는 것은 `fnFindPopupOpener` → **`Popups/findPopup/`** 이다.
  요청서의 자리 이름(검색 칸·찾은 수·위/아래·찾은 줄)이 그 창 구조와 안 맞아 이름을 지어내지 않고 되물었다.
- 바인딩 창 — 사장님이 후순위로 정하셔서 요청이 안 왔다.

## 또 밟을 함정

- ★**어느 파일이 실제로 뜨는지 먼저 확인한다.** `textSearchPopup` 은 폴더 안에 UI5 잔재와 HTML5 변환본이
  같이 있고, 뜨는 것은 변환본이다. `designTreeUiSearchPopup` 은 폴더가 살아 있지만 opener 가 주석이라 죽었다.
  **폴더가 있다 ≠ 그 창이 뜬다.**
- ★`data-act="CLOSE"`·`"CANCEL"` 을 `.u4a-btn-icon` 에 붙이면 **hover 색이 빨강으로 바뀐다**(shell.css 372행).
  값만 더하는 작업이라도 이 두 이름은 모양을 건드린다.

## 검증

- `node --check` 3개 파일 통과.
- 새 이름 16개가 `www` 안에서 각각 1곳뿐인지 확인(겹침 0).
- `_btn()` 인자를 늘렸으므로 그 파일 안 호출 3곳 전부 고쳤는지 확인.
- 실행 테스트는 장군님이 하신다.
