# ⋯(오버플로) 단추와 그 메뉴 줄에 data-act 식별값 추가

- 시각: 2026-10-28
- type: feat
- 요청: 자동 테스트 쪽 대화창 (`D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-28_overflow-data-act.md`)
- 근거 지시: 장군님 2026-10-19 「자동테스트 쪽 식별값 요청은 묻지 말고 바로 해주고 회신」
- 표준: `.analy/21_화면요소_식별값_표준.md`

## 왜

창이 좁으면 헤더·툴바가 ⋯ 로 접힌다. **접힌 단추는 그 요소에 직접 클릭을 보내 누를 수 있지만,
⋯ 메뉴를 열 때 새로 만들어지는 것은 메뉴를 열어야 생긴다.** T-CODE 칸이 그 경우다 —
⋯ 를 누를 이름이 없어 자동 테스트가 그 칸에 영원히 닿지 못했다.

실측(자동 테스트 쪽 · 2026-10-28 · 작은 화면): 티코드 실행 케이스 2건이
`SAP T-CODE 칸(#sapTcode)이 화면에 없습니다` 로 끝났다. 칸은 있었고, 접혀서 ⋯ 안에 있었다.

## 한 일 — 파일 9개, 15곳

### ⋯ 단추 자신 (`attachOverflow` 의 `act` 옵션에 값만 넘김)

| 자리 | data-act |
|---|---|
| 공통 헤더(WS10·WS20·WS30 머리) | `MORE_HEADER` |
| WS10 서브헤더(트랜잭션 단추줄) | `MORE_BAR` ★손으로 만든 단추라 직접 달았다 |
| WS20 속성 도구줄 | `MORE_ATTR` |
| USP 편집기 도구줄 | `MORE_USP_EDITOR` |
| 개인화 창 미리보기 도구줄 | `MORE_P13N_PREVIEW` |
| 바인딩 창 도구줄 | `MORE_BIND` |
| 찾기 창 — 액션 / 검색 | `MORE_FIND` · `MORE_FIND_SEARCH` |
| 스니펫 창 — 도구줄 / 목록 / 정보 | `MORE_SNIPPET_TOOLS` · `MORE_SNIPPET_LIST` · `MORE_SNIPPET_INFO` |
| 테마 만들기 창 도구줄 | `MORE_THEME_TOOLS` |
| 버전관리 창 diff 도구줄 | `MORE_VERSION_DIFF` |

★이름은 **이미 있던 세 개와 같은 모양(`MORE_*`)으로 맞췄다** — `MORE_TOOLBAR`(WS20 툴바) ·
`MORE_PREVIEW`(WS20 미리보기 머리) · `MORE_TREE`(WS20 트리). 요청서가 쓴 `HEADER_OVERFLOW` ·
`BAR_OVERFLOW` 는 보기일 뿐이라고 했고, 기존 세 개와 모양이 달라지므로 쓰지 않았다.
이로써 `attachOverflow` **호출 15곳 전부 + 손으로 만든 ⋯ 1 = 이름 16개**가 됐다(았서 3 + 이번 12 + 손제작 1).

★**처음 보고에 「18곳」이라 적은 것은 틀렸다.** `grep "attachOverflow("` 결과 18줄에 **주석 줄 셋**이 섞여 있었다
(`findFrame.js:350` · `monacoSnippetDesigner/Popup/js/index.js:1094` · `monacoThemeDesign/Popup/js/index.js:1630`).
자동 테스트 죽이 집어 다시 세어 바로잡았다 — **분 자리는 없다.**
→ 함정: **건수를 `grep` 줄 수로 세지 말 것.** 주석·정의 줄이 호출로 섞인다(`.claude/rules/code.md` 영향도 3번 항목).

### WS10 서브헤더 ⋯ 메뉴 **안의 줄** (`_showOverflowMenu`)

`{icon, text, action}` 만 넘기던 것에 **`act: cfg.act`** 를 더했다(보통 단추 · App 실행 분할 단추 둘 다).
공통 `_buildMenuEl` 이 `it.act` 를 그대로 `data-act` 로 달아 준다 — 즉 **접혀도 원래 단추와 같은 이름**이다.

## 안 건드린 것

- 공통 `theme/u4a-ui.js` 는 **한 줄도 고치지 않았다.** `act` 옵션(2026-10-13) 과,
  접힌 줄에 원래 단추의 `data-act` 를 복사하는 처리(2026-10-14) 가 **이미 있었다** — 값만 안 넘기고 있었다.
- 접는 기준·동작·모양은 그대로다. 값만 더했다.

## 또 밟을 함정

- ★**⋯ 메뉴 안에 「새로 만들어지는 것」은 그 메뉴를 열어야 DOM 에 생긴다.** 공통 헤더의 T-CODE 칸 ·
  줌 슬라이더 · 찾기 창 검색칸이 그렇다(`menuItem` 이 `{node}` 를 돌려주는 자리). 그래서 **⋯ 단추 자신에
  이름이 없으면 그 안쪽은 영원히 못 닿는다** — 새 툴바에 `attachOverflow` 를 붙일 때 `act` 를 빠뜨리지 말 것.
- ★`attachOverflow` 가 돌려주는 `{node}` 짜리 줄에는 공통이 `data-act` 를 안 붙인다(아이콘+글자 줄만 붙는다).
  그 안에 만드는 입력칸에는 **만드는 자리에서 직접** 달아야 한다(헤더 T-CODE 칸은 2026-10-14 에 그렇게 해 뒀다).

## 검증

- `node --check` 9개 파일 통과.
- 새 이름 13개가 `www` 안에서 각각 1곳뿐인지 확인(겹침 0).
- 실행 테스트는 장군님이 하신다.
