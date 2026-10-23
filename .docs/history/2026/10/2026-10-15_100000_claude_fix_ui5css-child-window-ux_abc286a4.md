# UI5 Predefined CSS 창이 띄우는 하위 창 — 자리 재배치 · 최소화 단추 · 부모와 함께 닫힘 (TODO 46)

- 날짜: 2026-10-15
- 종류: fix
- 세션: abc286a4
- 지시:
  1. 「두 창도 호출한 창 가운데로 맞춰줘」
  2. 「최소화가 없네」 → 「최소화 넣고, 호출한 창이 죽으면 같이 죽어야되 무슨말인지 알겠어?」

## 1. 대상 창 (별창이 또 띄우는 창 = 46번 범위)

UI5 Predefined CSS 창(신 버전 `ui5CssPopup_v2`)이 띄우는 하위 창 2종.

| 여는 함수 | 화면 조작 | 페이지 |
|---|---|---|
| `openNewBrowserMenu`(main/views/control.js 794) | 왼쪽 목록 선택 → 오른쪽 아래 아이콘 단추(`sap-icon://popup-window`) | `detail/frame.html` (win=X) |
| `openNewBrowserOthers`(같은 파일 952) | 왼쪽 `Other CSS Guides` 항목 클릭 | `others/M1~M4/index.html` + `others/winChrome.js` |

46번 조사에서 나온 나머지 11곳은 **파일만 `Popups` 아래 있을 뿐 메인 화면이 여는 창**(49번 영역)이거나
죽은 코드(`versionManagement/index.js` — `fnVersionManagementPopupOpen.js` 로 대체됨)·테스트 폴더였다.
바인딩 창 안 설명 풍선은 자리는 맞지만 **「이미 열림」 처리 자체가 없어** 46번 대상이 아니다(별개 사안으로 보고만).

## 2. 한 일

### (1) 다시 부를 때 자리 — 「모니터 한가운데」 → 「호출한 창 가운데」

`main/views/control.js` 813 · 976(두 함수의 「이미 열림」 분기).

```js
try { parent.WSUTIL.setParentCenterBounds(REMOTE, oCheckIsOpen.WIN); }
catch (e) { if (typeof U4ALOG !== "undefined" && U4ALOG.caught) { U4ALOG.caught(e); } }
oCheckIsOpen.WIN.focus();
```

종전 `oContr.fn.moveToParentWin`(764~789)은 **부모 창이 있는 모니터의 한가운데**로 옮겨서,
창을 화면 구석에 두고 쓰면 하위 창만 복판으로 튀었다. TODO 49 에서 맞춘 공통 규칙
(`WSUTIL.setParentCenterBounds` = **호출한 창 가운데**)으로 통일.
→ **`moveToParentWin` 은 정의만 남고 호출처 0.** 지시 범위 밖이라 **지우지 않았다**(장군님께 물어봄).

### (2) 최소화 단추 추가

- `detail/frame.html` — 제목줄에 `dtlWinMin` 단추(아이콘 `fa-window-minimize`, `data-action="minimize"`) + `CURRWIN.minimize()` 배선.
- `others/winChrome.js` — 주입하는 제목줄에 같은 단추를 최대화 왼쪽에 추가 + 배선.
- 주석(두 파일 머리말 · `others/M1~M4/index.html` 35줄)도 「minimize 제외」 → 「최소화 포함」으로 현행화.

★`detail/frame.html` 머리말에는 「minimize 버튼 제외(**장군님 지시**)」라고 적혀 있었으나
`.docs/history` 어디에도 그 지시 근거가 없다. 2026-10-15 지시로 **넣는 쪽이 최신**.
창 옵션에 `minimizable` 을 끈 곳은 없었으므로(**단추만 없었다**) 배선만으로 동작한다.

### (3) 부모가 닫히면 하위 창도 닫힘

`main/frame.js` — `_closeChildWindows()` 추가 + `window.addEventListener("beforeunload", …)` 로 등록.
`CURRWIN.getChildWindows()` 를 돌며 공통 `U4AUI.closeWindow`(= `setClosable(true)` + `close()`).

- **왜 공통 함수인가**: 하위 창은 `closable:false` 로 열려 raw `close()` 가 **조용히 무시**된다
  ([[childwin-bulkclose-needs-closewindow]]). 같은 파일(`control.js` 1735)의 「자식창 전체 닫기」 버튼도 같은 처리를 한다.
- **왜 `beforeunload` 인가**: 닫기 단추 · WS20 모드 전환 일괄 닫기 · 앱 종료 **어느 경로든 unload 를 지난다.**
  창마다 닫는 자리를 찾아 넣으면 한 곳을 빠뜨린다.
- 로그: 닫은 뒤 `U4ALOG.info("WIN_CLOSE", "child windows closed with opener", "닫은수/전체수")`.

구문 검사: `main/frame.js` · `others/winChrome.js` `node --check` 통과,
`detail/frame.html` 은 inline script 를 뽑아 `new Function` 으로 검사 통과.

## 3. 또 밟을 함정

1. **`closable:false` 별창은 `close()` 가 안 먹는다.** 일괄 닫기·부모와 함께 닫기 전부
   `U4AUI.closeWindow`(setClosable 먼저)로 가야 한다. 안 그러면 **아무 일도 안 일어나는데 오류도 없다.**
2. **최소화 단추를 뺀 창은 「안 닫히는 유령 창」이 되기 쉽다.** 최소화해 두면 화면에 안 보이므로,
   부모를 닫았을 때 같이 닫히지 않으면 작업표시줄에만 남아 사용자가 못 찾는다. 둘은 같이 봐야 한다.
3. **`moveToParentWin`(모니터 한가운데) 와 `setParentCenterBounds`(호출한 창 가운데) 는 다른 함수다.**
   공통 규칙은 후자. 새 창을 만들 때 전자를 복사해 쓰면 49번 때 고친 것이 또 깨진다.

## 4. 아직 안 한 것 · 미검증

- 테스트는 장군님 확인 대기(TODO 46-1 · 46-2 · 46-3).
- **최소화가 Windows 에서 실제로 내려가는지는 미검증** — 이 창들은 `parent` 가 붙은 소유 창이라
  `minimize()` 동작을 소스만으로는 단정할 수 없다. 46-2 로 확인한다.
- `moveToParentWin` 죽은 함수(호출처 0)를 지울지 **장군님 결정 대기.**
- 구버전 UI5 Predefined CSS 창(`ui5CssPopup`)의 하위 창은 이번 범위가 아니다(그 창은 하위 창을 띄우지 않음).

---

## 5. 후속 (같은 턴) — parent 제거 (장군님 지시 「최소화를 추가했으면 parent는 제거해야지」)

최소화 단추만 넣고 `parent` 를 그대로 두면 **최소화한 창을 되살릴 길이 없다**
(작업표시줄에 안 남고 제목줄도 없다). `.analy/20` 전략1 · 필수 항목 5번이 이미 못 박아 둔 규칙인데
이번에 **내가 빠뜨렸고 장군님이 잡아 주셨다.**

### 바꾼 것

| 파일 | 한 일 |
|---|---|
| `main/views/control.js` 858·1018 | `parent: CURRWIN` **제거**(두 하위 창) |
| `main/views/control.js` 721·1730·1812 | `getChildWindows()` → `oParentAPP.fn.getOpenedChildWindows()` (이미 열림 판정 · 자식창 전체 닫기 · 자식창 focus) |
| `main/views/control.js` 818·989 | 「이미 열림」 분기에 **최소화면 먼저 `restore()`** 추가 |
| `main/frame.js` | `oAPP.fn.getOpenedChildWindows()` 신규 — 전체 창에서 ① browserkey 가 같고 ② OBJTY 가 그 browserkey 로 시작하는 창. `_closeChildWindows` 도 이걸 쓴다 |

### 왜 browserkey + OBJTY prefix 인가

- 공통 `getSiblingWindows`(ws_common.js)는 **메인 창의 형제 별창 전부**를 돌려준다 — 여기선
  「이 창이 띄운 것만」 골라야 하므로 쓸 수 없다.
- 이 창의 하위 창 OBJTY = **BROWSKEY + 메뉴 KEY**. 다른 별창은 전부 고정 이름(`UI5CSSPOP_V2` 등)을
  쓰므로(실측: `webPreferences.OBJTY` 대입 전수) prefix 가 겹치지 않는다.
- browserkey 가 없으면 `U4ALOG.warn("GUARD_EXIT", …)` 로 남기고 빈 배열 — 그때 무엇이 안 되는지도 적었다.

### 같이 확인한 것 (parent 를 빼면 깨질 수 있는 자리)

- `WSUTIL.setParentCenterBounds` 는 **`REMOTE.getCurrentWindow()`** 를 기준으로 쓴다 — `getParentWindow()`
  를 안 쓰므로 자리 재배치는 영향 없다(소스 확인).
- 이 팝업 어디에도 `oBrowserOptions.parent` 를 **읽는 코드가 없다**(grep 0건).
- WS20 뒤로가기 일괄 닫기·busy 중 숨기기는 공통 `getSiblingWindows`(browserkey) 기반이라
  parent 와 무관하게 그대로 동작한다.
- **바뀌는 것**: 하위 창이 더 이상 UI5 Predefined CSS 창 **위에 항상 떠 있지 않다**(뒤로 갈 수 있다).
  이건 parent 제거의 대가로 `.analy/20` 에서 이미 받아들인 설계다.

### 또 밟을 함정 (추가)

4. **제목줄에 최소화를 넣으면 그 창의 `parent` 는 반드시 빼야 한다.** 둘은 한 쌍이다.
   그리고 parent 를 빼면 `getChildWindows()` 를 쓰는 **모든** 자리가 조용히 빈 배열이 된다 —
   이 팝업은 4곳(이미 열림 판정 · 전체 닫기 · focus · 부모와 함께 닫기)이었다. 하나만 고치면 나머지가 죽는다.
5. **parent 를 뺀 창은 최소화된 상태로 남아 있을 수 있다.** 다시 부를 때 `restore()` 를 먼저 하지 않으면
   자리만 바꾸고 화면에는 아무 일도 안 일어난다(사용자는 「안 열린다」고 본다).

## 6. 테스트 결과

- **2026-10-15 장군님 「46-1 ~ 46-4 테스트 완료」** — 네 가지 전부 통과.
  46-1 다시 부를 때 호출한 창 가운데 · 46-2 최소화 단추(작업표시줄에서 되살리기까지) ·
  46-3 부모 닫으면 하위 창도 같이 닫힘(최소화해 둔 것까지) · 46-4 최소화한 창을 메뉴로 다시 부르면 되살아남.
- **최소화가 Windows 에서 실제로 되는지 미검증이었던 것이 이로써 확인**됐다(parent 를 뺀 덕).
- 46번은 이로써 종료. TODO 에서 46 줄을 지웠다.

## 7. 아직 남은 것

- `oContr.fn.moveToParentWin`(main/views/control.js) — 호출처 0 이지만 **장군님 지시로 남긴다**
  (2026-10-15 「나중에 쓸일이 있을수 있으니 지우지마」). 다음에 읽는 사람이 죽은 코드로 보고 지우지
  않도록 **함수 머리말에 그 결정을 적어 뒀다**(기준이 다른 함수라는 설명도 함께).
- 커밋은 지시 대기.
