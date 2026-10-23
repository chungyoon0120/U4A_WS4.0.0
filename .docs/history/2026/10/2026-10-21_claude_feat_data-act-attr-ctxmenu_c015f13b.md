# WS20 속성 줄 오른쪽 클릭 메뉴에 data-act 식별값 추가

- 시각: 2026-10-21
- type: feat
- 요청: 자동 테스트 쪽 대화창 (요청서 `D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-20_attr-ctxmenu-data-act.md`)
- 근거 지시: 장군님 2026-10-19 「자동테스트 쪽 식별값 요청은 묻지 말고 바로 해주고 회신」
- 표준: `.analy/21_화면요소_식별값_표준.md`

## 왜

그쪽이 이 메뉴를 집을 수 있는 것이 `class` 와 화면 글자 둘뿐이었다.
화면 글자는 서버 메시지(A42~A45 · 805 · 627)라 **접속 언어가 바뀌면 깨진다**(그쪽은 한국어·영어 둘 다로 접속).
`class` 는 화면을 고치면 깨진다. 그래서 임시로 Font Awesome 아이콘 class 로 집고 있었다.

## 한 일 — `www/ws30/ws10_20/js/ws_html5_ws20_attr_ctxmenu.js` 한 파일

메뉴 정의 표(`_defItems`)에 `ACT` 칸을 더하고, 그리는 자리(`_openMenu`)에서 그 값을 그대로 붙였다.
줄마다 복붙하지 않고 표 한 칸으로 끝냈다.

| 자리 | data-act |
|---|---|
| 메뉴 뿌리 `div.u4a-menu` | `ATTR_CTXMENU` |
| M00 머리(UIATT · 꺼져 있음) | `ATTR_MENU_HEAD` |
| M01 대기 표시 on/off | `ATTR_MENU_WAIT` |
| M02 바인딩 해제 | `ATTR_MENU_UNBIND` |
| M03 동일 속성 동기화 | `ATTR_MENU_SYNC` |
| M04 클라이언트 이벤트 해제 | `ATTR_MENU_CEVT_DEL` |
| M05 단축키 등록 | `ATTR_MENU_SHORTCUT` |
| M06 UI 속성 개인화 | `ATTR_MENU_PRESET` |

`ACT` 가 없는 항목이 생기면 `U4ALOG.warn("GUARD_EXIT", …)` 로 한 번 남기고 속성은 두지 않는다.

## 안 한 것 · 함정

- **동작·모양은 한 줄도 바꾸지 않았다.** 값만 더했다.
- 이름이 기존과 겹치는지 전수 확인 — `www/` 전체에서 `ATTR_MENU_`·`ATTR_CTXMENU` 는 이 파일 외 0건.
- M05 는 WLO 패치(UHAK901289) 서버에서만 목록에 들어간다 — 그 서버가 아니면 `ATTR_MENU_SHORTCUT` 이 아예 안 그려진다(결함이 아니다).
- M03(동일 속성 동기화) 별창 안 식별값은 그쪽이 **쓰지 않기로** 했다. M06(개인화 목록) 창은 따로 요청서가 온다.
- ★**메뉴는 열 때마다 새로 만들어 `document.body` 에 붙이고 닫으면 지운다.** 닫힌 동안에는 DOM 에 없다 — 먼저 줄을 오른쪽 클릭해야 집힌다.
- AT03(바인딩 아이콘) 셀은 원본대로 메뉴를 아예 띄우지 않는다.

## 검증

- `node --check` 통과.
- 실행 테스트는 장군님이 하신다(앱 실행은 내가 하지 않는다).
