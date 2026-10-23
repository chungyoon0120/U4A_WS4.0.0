# 자동 테스트(MCP) 가 집는 식별자를 data-act 하나로 통일 + WS20·WS10 미비 자리 전부 달기

- 시각: 2026-10-13 15:30
- 종류: feat
- 세션: c015f13b
- 지시: 장군님 「요청한대로 진행해」 → 정정 「mcp 도구가 식별하기 위한 식별자 이름만 통일이야」 → 「진행해」

## 무엇을 했나

| # | 파일 | 무엇 |
|---|---|---|
| 1 | `js/ws_html5_ws20.js` | WS20 상단 메뉴 16줄 + 툴바 Icon Viewer 2줄에 `act` · 툴바 ⋯ `MORE_TOOLBAR` · 미리보기 패널 머리 ⋯ `MORE_PREVIEW` · 세로 띠 `SIDETOGGLE`/`SPLITPOS`/`SYSINFO` · 실행 split `RUN`(+빌더가 `RUN_MENU`) · 브라우저 목록 `BROWSER_`+key |
| 2 | `js/ws_html5_ws20_tree.js` | 트리 툴바 ⋯ `MORE_TREE` · 트리 줄 `INSOBJ`/`DELOBJ`/`TREENAME` |
| 3 | `theme/u4a-ui.js` | `attachOverflow` 에 `act` 옵션 추가(.analy/21 §2.3 「이름을 받는 옵션」). 안 주면 전과 동일 |
| 4 | `js/ws10_html.js` | WS10 메뉴 8줄에 `act`(WS20 과 같은 값) · `APP_EXEC_BROWSERS`·`_getAppExecBrowsers` 에 `BROWSER_`+key · T-CODE 지우기에 `sapTcode_CLEAR` |
| 5 | `js/ws_html5_ws20_attr.js` | `ATTR_ACT_BY_UIATK` 표(32줄) + `_tagAttrAct()` — 행을 만드는 한 곳에서 값 칸·지우기·찾기에 붙인다 |
| 6 | `js/fnSelectBrowserPopupOpen.js` | 브라우저 줄에 `BROWSER_`+이름 (`data-browser` 는 그대로) |
| 7 | `js/fnAppCopyPopupOpen.js` · `js/fnAppF4PopupOpen.js` · `design/js/createApplicationPopup.js` · `Login/Login.js` | 기존 `data-field`·`data-clear` 를 **그대로 두고** `data-act`(지우기는 `_CLEAR`)를 하나 더 |
| 8 | `.analy/21_화면요소_식별값_표준.md` | 2.0 절 추가 — 「밖에서 집는 이름은 `data-act` 하나」 |

## 왜 (장군님 말씀)

「나중에 다른 AI 가 우리 WS4.0 을 CDP 로 제어하고 싶어서 어떤 식별자로 구분하면 되냐고 물었을 때
항목마다 다 설명해 줘야 한다」 — 밖에서 알아야 할 규칙이 하나여야 한다. 지금은 `data-act` ·
`data-menu-item` · `data-uiatk` · `data-uiaty` · `data-ctx-key` 로 다섯이었다.

## 범위를 어디서 잘랐나 (장군님 정정 2026-10-13)

처음 나는 **표준 전체를 바꾸는 일**로 알아듣고 장군님께 「표준을 고칠까요」를 물었다. 장군님 정정:
「지금 그려진 div 에 모든 속성을 하나로 통일하자는 말은 아니다 — MCP 도구가 식별하기 위한
식별자 이름만 통일이다.」 그래서 실제 작업은 이렇게 잘랐다.

- 바꾼 것 = **밖(MCP·CDP)이 집는 이름**뿐 → `data-act` 로 모았다.
- 그대로 둔 것 = `class` · `id` · WS4.0 이 **안에서 쓰는** `data-uiatk`·`data-uiaty`·`data-ctx-key`·
  `data-browser`·`data-row`·`data-tab`·`data-value` · 화면 동작·모양·순서.
- 기존 `data-field`·`data-clear` 도 **지우지 않았다** — `data-act` 를 하나 더 단 것이다.

## 고르지 않은 길 · 손대지 않은 것

- 옵션 창의 색 조절 칸(`data-field="BORDER_R"` 등 16곳) — **손대지 않았다.** 그 창의 자기 코드가
  `querySelector('[data-field=…]')` 로 쓰고 있어 MCP 식별자가 아니다.
- 속성 창 번호↔이름 표에서 뒤 14개(CSS Link Add · JS Link Add · Web Security Settings ·
  Enable Dump Write · Use init pre-screen event · Router/Skeleton/Mobile Zoom 사용 여부 ·
  Session stateful type · Wait Type · Touch style · Shortcut Icon URL · Body Background Color)는
  **앱 정보 구조에 짝이 없다.** 요청자가 실측으로 제안한 이름을 그대로 썼다 — 내가 지은 것이 아니다.
  앞 18개는 앱 정보 구조의 칸 이름 그대로다.
- WS10 의 `WMENU10_01`(App. Package Change) · `WMENU10_04_01`(U4A Shortcut create)은 WS20 에 짝이
  없어 요청자가 값을 몰랐다. 핸들러가 여는 창으로 정했고 요청자에게 알렸다.
- 묶음 메뉴 줄(「추가 정보」·「내보내기」 등)은 요청자가 「묶음이니 없어도 된다」고 해 그대로 뒀다.
  단 아이콘 목록 묶음은 WS20·WS10 양쪽에 같은 값을 넣어 짝을 맞췄다.

## 아직 확인 못 한 것

- **앱으로 돌려 본 것이 없다.** `node --check` 만 통과했다. 테스트 WD1~WD5 = `.works/WS20식별값/00_현황판.md`
- 속성 창은 ROOT 가 아닌 UI 속성 줄에는 이름이 붙지 않는다(표에 없는 번호). 그 경우 로그를 한 번만 남긴다.
