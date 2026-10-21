# WS20 단축키 8종이 먹통이던 것 — 화면 버튼과 같은 핸들러로 배선 (구글시트 3번)

- 작성 2026-10-21 · 세션 06836675 · type=fix
- 지시: 장군님 「3번에 해당하는 내용부터 작업하자 … 단축키 동작이 일부 안되는게 있다는 내용이야 확인해바」 → 「고쳐」
- 되돌릴 지점 = 커밋 `7f5a30cc`

## 1. 증상과 원인 (소스 확정)

구글시트 3번 「단축키 안됨」(최선호). 단축키 목록 화면에는 보이는데 눌러도 아무 일이 없었다.

원인 = 그 8종의 `fn` 이 **원본(UI5) 코드 그대로**다. UI5 버튼을 `sap.ui.getCore().byId(...)` 로 찾아
`firePress()` 하는데, HTML5 변환으로 UI5 를 뺐으므로 `byId` 는 늘 `null` 을 돌려준다.
바로 다음 줄의 `if (!버튼 || !getEnabled() || !getVisible()) { return; }` 에 걸려 **조용히 빠져나갔다.**

★**터지지 않는다** — `window.sap` 이 스텁으로 있어(`ws_html5_shell.js` 45~109) `byId` 가 `null` 을 돌려줄 뿐이다.
그래서 오류 로그조차 없었고, 장군님 눈에는 「눌러도 아무 일이 없다」로만 보였다.

예 = `ws_common.js` 1300~1303 (Ctrl+F2).

## 2. 전수 조사 결과

WS20 단축키 **23개**(`ws_common.js` 1212~2072 `aShortCutWS20`).

| 갈래 | 건수 | 어느 것 |
|---|---:|---|
| UI5 버튼을 찾는 것 | 10 | 아래 3 + 7 |
| ↳ 2026년 변환 때 이미 고쳐 둔 것 | 3 | F3 · Ctrl+Shift+F12 · Ctrl+F |
| ↳ **빠뜨린 것** | 7 | Ctrl+F2 · Ctrl+F12 · Ctrl+F5 · Shift+F1 · F9 · Ctrl+Shift+F10 · F12 |
| UI5 와 무관(원래 도는 것) | 13 | F11 · Ctrl+F1 · Ctrl+F3 · Ctrl+F4 · Ctrl+S · Ctrl+Z · Ctrl+X · Ctrl+Shift+F11 등 |

★**F8 은 목록에 두 벌 있다** — 1555(먼저 고쳐 둔 HTML5 판) + 1662(옛 UI5 판).
`setShortCut` 이 목록을 그대로 돌며 `oShortcut.add` 하므로 둘 다 등록된다.
어느 쪽이 이기는지 `oShortcut` 구현(전역 `shortcut`)을 못 찾아 **확인하지 못했다.**
그래서 **F8 도 덮어** 두 벌 모두 같은 동작이 되게 했다 — 어느 쪽이 등록되든 결과가 같다. 그래서 합계 8종.

(Ctrl+Z/Ctrl+Shift+Z, Ctrl+X/Ctrl+Shift+X 도 1966/1967, 2018/2019 로 붙어 있으나
 Ctrl+Shift+* 쪽은 이미 덮여 있어 같은 문제가 없다.)

## 3. 고친 내용 — `www/ws30/ws10_20/js/ws_html5_ws20.js` 한 파일

이미 도는 6종과 **똑같은 방식**: 화면 버튼과 같은 핸들러를 직접 부른다.

| 단축키 | 화면 버튼(DOM id) | 부르는 것 |
|---|---|---|
| Ctrl+F2 | syntaxCheckBtn | `ev_pressSyntaxCheckBtn` |
| Ctrl+F12 | controllerBtn | `ev_pressControllerBtn` |
| Ctrl+F5 | ws20_multiPrevBtn | `ev_pressMultiPrevBtn` |
| Shift+F1 | addEventBtn | `ev_pressAddEventBtn` |
| F9 | runtimeBtn | `ev_pressRuntimeBtn` |
| F8 | ws20_appExecMenuBtn | `ev_pressAppExecBtn` |
| Ctrl+Shift+F10 | iconViewerBtn **또는** iconListBtn | 메뉴면 `fnWS20WMENU20_04_01`, 평버튼이면 `ev_pressIconListBtn` |
| F12 | ws20_appExecMenuBtn | `ev_pressAppExecBtnByBrowser("DEV_BROWSER")` |

새로 둔 함수 3개 + 공통 2개:
- `_ws20BtnReady(id)` — 원본 `getEnabled()`/`getVisible()` 를 DOM 상태로 1:1(`disabled` / `display:none`).
- `_ws20ScPrepare()` — 메뉴 닫기 + `fnShortCutExeAvaliableCheck()`(기존 6종과 같은 앞머리).
- `_ws20ToolbarSc(id, ev, key)` — 위 둘 + 그 버튼의 핸들러 호출.
- `_ws20IconList()` — 아이콘 뷰어 메뉴 / 평버튼 두 모양 분기(원본 `oIconList` 분기 그대로).
- `_ws20ExecDevBrowser()` — 실행 메뉴 항목에서 `DEV_BROWSER` 를 찾아 활성일 때만 실행.

## 4. 확인한 것 (추측 아님)

- 툴바 버튼의 **DOM id = 정의한 id 그대로** — `_txBtn` 이 `BTN.id = oCfg.id`, 메뉴 버튼은
  `_txMenuBtn` → `ws10_html.js` `_buildMenuButton` 776행 `btn.id = cfg.id`.
- 숨김은 `fnUpdateWs20Toolbar` 가 `style.display = "none"` 으로 한다(517~534) → `_ws20BtnReady` 판정과 일치.
- `_buildAppExecMenuItems`(238)와 새 함수들이 **같은 IIFE**(31~2015) 안이라 접근된다.
- `DEV_BROWSER` 는 패키징(운영)본에서 `disabled: true` 가 된다(253행) → F12 도 거기서는 그만둔다(원본과 같음).

## 5. 안 한 것 · 또 밟을 함정

- **앱에서 확인하지 않았다**(장군님이 직접 돌리신다). `node --check` 통과. 테스트 = TODO 3A-1 ~ 3A-8.
- **WS10·WS30 목록은 손대지 않았다.** 같은 모양의 UI5 잔재가 거기에도 있는지는 **안 봤다**
  — 이번 지시는 WS20 화면의 단축키였다.
- **버튼이 숨겨져 있으면 로그를 남기지 않는다.** 모드별 숨김(조회 모드에서 구문 검사 버튼 없음 등)은
  정상 상황이라, 로그를 남기면 평소에 소음만 된다. 원본도 조용히 return 했다.
- ★**함정: `sap` 스텁이 있어 UI5 잔재가 안 터진다.** 그래서 「UI5 를 쓰는 옛 코드」는 오류로 드러나지 않고
  **조용히 아무 일도 안 하는 모양**으로 남는다. 변환 누락을 찾을 때 오류 로그만 보면 못 찾는다 —
  `sap.ui.getCore().byId` 를 grep 해야 한다.
