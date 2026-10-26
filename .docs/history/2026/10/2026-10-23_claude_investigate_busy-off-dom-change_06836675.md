# busy 꺼진 뒤 DOM 변경 — UI 선택 흐름 실측

- 작성: 2026-10-23 · 세션 06836675
- 지시: 장군님 「다시 UI 선택 테스트부터 해바」 / 「아니 busy가 꺼진 시점에 dom 변경 여부만 보라고」 / 「클릭은 좀 반복적으로 하고」

## 무엇을 봤나

WS20 디자인 트리 줄 클릭(= UI 선택) 흐름에서, 공통 busy `<dialog>`(`u4aWsBusyIndicator`) 의
`open` 이 사라진 **그 시점 이후** DOM 변경이 있는지만 본다. 다른 것은 보지 않는다.

측정 방법(CDP 주입, 앱 소스 변경 없음):
1. busy 에 `MutationObserver`(`attributeFilter: ["open"]`) 를 건다.
2. `open` 이 사라지면 그 순간부터 `document.body` 를 500ms 감시한다. busy 안쪽 변경은 센다/제외.
3. **감시가 끝난 뒤에** 다음 클릭을 한다.

## 결과

| 회수 | 클릭 대상 | busy 닫힘 후 DOM 변경 |
|---|---|---|
| 20 | ROOT · APP · PAGE · VBOX1 · SINGLEPLANNINGCALENDAR2 · TEXT1 순환 | **0 건 (20/20)** |

단독 클릭 6회(줄마다 1회)도 전부 0 건.

## 함정 — 또 밟지 말 것

**반복 클릭을 할 때 「클릭 루프」와 「감시 창」을 따로 돌리면 결과가 거짓이 된다.**
루프가 busy 닫힘을 자기 방식(`MutationObserver` + rAF)으로 알아 기준 시각이 감시 쪽과 어긋나고,
**다음 클릭이 앞 회의 감시 창 안에 들어간다.** 그러면 그 클릭이 만드는 정상 DOM 변경이
「busy 꺼진 뒤 변경」으로 찍힌다. 실제로 이 오염 때문에 `+222ms` 를 결함이라고 잘못 보고했다.
→ **한 회가 끝난 뒤에 다음 클릭**을 하게 한 묶음으로 짜야 한다.

## 버린 판정 (틀렸던 것)

- 「UI 선택도 busy 뒤에 DOM 을 바꾼다」 → **틀렸다.** 호출 계측 결과 속성 패널 그리기는
  클릭 후 15ms, busy 켜진 상태에서 끝난다.
  실측 시각: click 0ms(busy off) → `fnWs20SelectUI` 진입 12ms(on) → `fnWs20DesignTreeItemPress` 13ms
  → 패널 15ms(on) → busy OPEN 알림 24ms → press 종료 25ms → busy CLOSE 344ms → select 종료 363ms.
- 「단독 선택일 때 마크 로직이 돈다」 → 재현을 위해 내가 `setChangeFlag` 를 부른 것이지
  UI 선택 흐름과 무관하다. 거뒀다.

## 남은 진짜 건 (이번 조사 밖)

UI 추가(`designAddUIObject` → `_markChanged`, `js/ws_html5_ws20_edit.js:68`)는
busy 창이 닫힌 뒤에 앱 머리줄을 바꾼다. 스택 확보됨. 게다가 `_markChanged` 안에서
`setChangeFlag()`(69행) 와 `fnUpdateWs20AppHeader()`(71행) 로 **같은 갱신을 두 번** 한다.
→ 수정 여부는 장군님 지시 대기.

---

# 후속 — UI 추가 실측 (2026-10-23)

지시: 장군님 「UI 추가도 실측해」 / 「D:\workspace\u4a-ws4-mcp 소스 참고해서 현재 PAGE 밑에 버튼을 추가하는 걸로 테스트해라」

## 조작 (MCP `ws20/tree.py` insert 순서 그대로)

PAGE 줄의 오브젝트 삽입(`INSOBJ`) → 삽입 창 → aggregation 콤보에서 `content` →
검색칸에 `Button` → 목록에서 `sap.m.Button`(UO00249) 줄 → Confirm.

## 결과 — busy 가 꺼진 뒤에 DOM 이 바뀐다 (장군님 관찰이 맞다)

| 항목 | 실측값 |
|---|---|
| busy 토글 | 켜짐 16ms → 꺼짐 7709ms (한 번뿐) |
| busy 꺼진 뒤 DOM 변경 | **20건**, +17ms ~ +31ms |
| 바뀌는 것 | 앱 머리줄 앱 이름·모드·상태 글자, 창 제목 |

호출 스택(전건 동일):
```
designAddUIObject (js/ws_html5_ws20_edit.js:1748)
  → _markChanged (js/ws_html5_ws20_edit.js:69 / :71)
    → fnUpdateWs20AppHeader (js/ws_html5_ws20.js:1075·1081·1083·1099·1103·1112)
```

소스 순서(1754~1755행)와 일치한다:
```
await _selectNode(lastObjid)   → fnWs20SelectUI → busy off → await _waitBusyClosed()
_markChanged()                 ← 여기서 DOM 을 바꾼다
```

## 같은 갱신을 두 번 한다 (실측 확인)

`_markChanged` 안에서 완전히 같은 6개 자리를 두 벌 쓴다.
- 69행 `setChangeFlag()` → 그 안에서 `fnUpdateWs20AppHeader()` (`js/ws_html5_ws20_attr.js:321`)
- 71행 `fnUpdateWs20AppHeader()` 직접

## 아직 안 한 것

- 고치지 않았다 — 장군님 지시 대기.
- 이 실측으로 **PAGE 밑에 `sap.m.Button` 하나가 추가된 상태**다. 저장은 하지 않았다.
  되돌릴지는 장군님 지시 대기.

---

# 재측정 — 감시 옵션 전부 켜고 전건 확보 (2026-10-23)

지시: 장군님 「mutation 옵션을 전부 켜고 감시하라고」 · 「다시 해라 내가 디버깅 걸어놓고 있었다」

앞 측정에서 「20건 중 12건만 스택을 잡았고 8건은 미확인」이라고 보고했다. **감시 범위가 좁아서였다.**
`classList` · `style.setProperty` · `hidden=` · `className=` 등을 감싸지 않았다.

## 고친 측정 방법

- MutationObserver 옵션 전부: `childList` · `subtree` · `attributes` · `attributeOldValue` ·
  `characterData` · `characterDataOldValue`, 대상도 `document.documentElement` 로 올림.
- 감싼 길을 넓힘: `replaceChild` · `setAttributeNS` · `toggleAttribute` · `insertAdjacent*` ·
  `replaceChildren` · `append/prepend/before/after/replaceWith` · `DOMTokenList`(classList) 4종 ·
  `CSSStyleDeclaration.setProperty/removeProperty` · `className=` · `hidden=` · `title=` ·
  `value=` · `disabled=` · `nodeValue=` · `innerText=` · `outerHTML=`.
- MutationRecord 를 **한 건씩** 기록해 호출 스택 목록과 대조.

## 결과 — `_markChanged` 밖은 하나도 없다

| 항목 | 값 |
|---|---|
| busy | 켜짐 13ms → 꺼짐 660ms |
| busy 꺼진 뒤 DOM 변경 호출 | **74건** (+16ms ~ +31ms) |
| 실제로 값이 바뀐 것(MutationRecord) | 16건 |
| 뿌리 | **전건** `designAddUIObject (js/ws_html5_ws20_edit.js:1748)` → `_markChanged` |

갈래 둘, 둘 다 `_markChanged` 안이고 하는 일이 같다:

```
_markChanged 69행  setChangeFlag() (js/ws_html5_ws20_attr.js:321)
                     → fnUpdateWs20AppHeader (js/ws_html5_ws20.js)
                        ├ 1075·1081·1083·1099·1103·1112 : 머리줄 글자·data-state·창 제목  6건
                        └ 1119 : fnUpdateWs20Toolbar (541행) → 공통 툴바 폭 재계산
                                 (theme/u4a-ui.js _measure 746 / _apply 783 / reflow 793)
                                 → 버튼 hidden  31건
_markChanged 71행  fnUpdateWs20AppHeader() 직접 → 위와 똑같은 37건을 한 번 더
```

37건 × 2벌 = 74건. **같은 일을 두 번 한다.**

실제로 값이 바뀐 16건: 머리줄 모드·상태의 `data-state`, 그리고 툴바 버튼 3개
(`addEventBtn` · `runtimeBtn` · `bindPopupBtn`)의 `hidden`. 나머지 `hidden` 은 같은 값을 다시 써서
MutationRecord 가 생기지 않았다.

## 새로 알아낸 것 (앞 기록에 없던 것)

`fnUpdateWs20AppHeader` 는 머리줄 글자만 바꾸는 함수가 아니다 — **끝(1119행)에서
`fnUpdateWs20Toolbar` 를 불러 공통 툴바의 폭을 다시 재고 버튼을 숨기거나 꺼낸다.**
그래서 busy 가 꺼진 뒤에 **레이아웃 재계산**까지 일어난다.

## 함정 — 또 밟지 말 것

**「MutationObserver 가 센 건수」와 「감싼 함수로 잡은 건수」가 다르면 감시 범위가 좁은 것이다.**
`setAttribute` 만 감싸면 `hidden = true` · `classList.add` · `style.setProperty` 는 전부 빠진다.
MutationRecord 는 값이 **실제로 바뀐 것만** 세므로, 같은 값을 다시 쓴 호출은 호출 쪽에만 잡힌다.
두 목록을 반드시 대조한다.

---

# setChangeFlag 전수 검사 (2026-10-23)

지시: 장군님 `/goal setChangeFlag 전수 검사` (그 전 「넌 잘 빼먹는 새끼고 끝까지 안보는 새끼니깐」)

## 다 봤다 기준

① `www` 전체의 모든 출현 줄(정의+호출) ② 각 파일이 실제로 로드·설치되는지
③ 호출 뒤에 머리줄 갱신이 붙는지 ④ 정의가 몇 개이고 어느 것이 이기는지 ⑤ 간접 호출.

## ① 정의는 2곳 — 그중 **설치되는 것은 1곳**

| 위치 | 하는 일 | 설치되나 |
|---|---|---|
| `design/js/main.js:875` (사본) | 플래그 3줄만 (`appInfo.IS_CHAG="X"` + `setAppInfo`) | **안 된다** |
| `js/ws_html5_ws20_attr.js:309` (내 것) | 플래그 + 모델값 + `fnUpdateWs20AppHeader` | **된다** |

**사본이 설치되지 않는 근거 (2중 확인)**
1. 사본 정의는 `design/js/main.js:4` 의 `oAPP.fn.main = function(){` **안**(들여쓰기 4칸)이다.
   파일은 `js/library-preload.js:136` 으로 로드되지만, **`oAPP.fn.main()` 이 불려야** 안쪽 정의가 생긴다.
   그걸 부르는 유일한 자리 `js/ws_fn_02.js:692`(`fnMoveToWs20` 안)는
   **`js/ws_html5_ws20.js:1883` 의 같은 이름 override 로 대체**됐고, 내 override 는 `main()` 을 부르지 않는다.
   덧붙여 원본 쪽 670행은 `sap.ui.getCore().byId("WS20_MAIN")` 이 없으면 바로 return 한다.
2. **실측 호출 스택**이 `Object.oAPP.fn.setChangeFlag (js/ws_html5_ws20_attr.js:321)` 을 가리켰다.

→ 내 것이 `if (typeof oAPP.fn.setChangeFlag !== "function")` 가드 안에 있어도, 사본이 없으니 설치된다.
★**함정**: 로드 순서는 `ws_fn_02.js`(92) → `design/js/main.js`(136) → `ws_html5_ws20_attr.js`(183).
 만약 누군가 `oAPP.fn.main()` 을 다시 부르게 되면 **사본이 내 것을 덮어써** 머리줄 갱신이 조용히 사라진다.

## ② 호출처 — 실제로 도는 것 33곳

| 곳 | 수 |
|---|---|
| `js/` | 10 |
| `design/js/` | 18 |
| `design/undoRedo/undoRedo.js` | 4 |
| `design/bindPopupHandler/broadcastChannelBindPopup.js` | 1 |

**안 도는 것**: `design/testFolder/undoRedo.js`·`testAI.js` 4곳(등록 경로는 `design/undoRedo/undoRedo.js` —
`js/ws_html5_ws20_prev.js:179` 에서 지정) · `design/_broadcastChannelBindPopup.js` 1곳(`_` 접두) ·
`design/UAI/` 2곳(AI 삽입 때 `uiDesignArea.js:598` 이 `require` 로만 로드 — 평상시 미로드).

## ③ 간접 호출 0건

문자열(`"setChangeFlag"`)·배열 접근 형태 없음. 전부 직접 호출.

## ④ 중복 3곳 — 판정 유지

`setChangeFlag` 가 안에서 머리줄을 갱신하므로, 그 뒤에 또 부르는 아래 3곳이 중복이다.

| 위치 | 중복 내용 |
|---|---|
| `js/ws_html5_ws20_edit.js:70·71` | 모델값 쓰기 + 머리줄 갱신 |
| `js/ws_html5_ws20_attr.js:4222·4223` | 같음 |
| `js/ws_html5_ws20_attr.js:5450·5451` | 같음 |

`js/ws_html5_ws20_edit.js:619`(`_commitState`)는 `setChangeFlag` 를 안 쓰고 직접 쓰므로 중복 아님.
또 그 자리는 선택(busy off) **앞**이라 busy 켜진 동안 끝난다 — undo/redo 는 이 건과 무관.

## 앞 보고에서 틀렸던 것

- 「호출처 28곳」 → **33곳**. `js/`·`design/js/` 만 보고 「전수」라고 했다.
- 「중복 1곳」 → **3곳**.

---

# setChangeFlag 전수 검사 — 2차 (정정) 2026-10-23

지시: 장군님 `/goal setChangeFlag 전수 검사 다시해`

1차에서 **줄 수를 세기만 하고 51줄 전체를 눈으로 분류하지 않았다.** 그래서 호출 수가 틀렸다.

## 51줄 전체 분류 (`www` 전체, `.js`+`.html`)

| 종류 | 줄 수 |
|---|---|
| 정의 | 2 (`design/js/main.js:875` · `js/ws_html5_ws20_attr.js:309`) |
| 가드 | 1 (`attr.js:308` `if (typeof … !== "function")`) |
| **주석** | **10** (`prevSetSkeletonScreen.js` 25·125 · `uiAttributeArea.js` 201 · `fnAttrPresetSettingsOpen.js` 20 · `attr.js` 4180·4214·4219·4225 · `dnd.js` 25 · `edit.js` 12) |
| 호출 | 38 |

## 실제로 도는 호출 = **31곳** (1차 보고 33곳은 틀림)

| 곳 | 수 |
|---|---|
| `js/` | 10 |
| `design/js/` | **16** (1차에 18 로 셌다 — 2개가 주석) |
| `design/undoRedo/undoRedo.js` | 4 |
| `design/bindPopupHandler/broadcastChannelBindPopup.js` | 1 |

**안 도는 7곳**: `design/testFolder/` 4(`undoRedo.js` 3 · `testAI.js` 1 — 등록 경로 아님) ·
`design/UAI/` 2(AI 삽입 때만 `require`) · `design/bindPopupHandler/_broadcastChannelBindPopup.js` 1(`_` 접두).

`.html` 인라인 0건 · 별창(`Popups/`) 0건 · 간접 호출(문자열·배열 접근) 0건.

## 설치되는 정의 확정 — 3중 확인

`js/library-preload.js` 는 **`async: false` 동기 순차 로드**(263·307행)라 순서가 보장된다.

```
15번째  js/ws_fn_02.js            ← oAPP.fn.fnMoveToWs20 (안에서 oAPP.fn.main() 호출)
26번째  design/js/main.js         ← setChangeFlag 사본이 oAPP.fn.main 함수 "안"에 있다
30번째  js/ws_html5_shell.js
33번째  js/ws_html5_ws20.js       ← fnMoveToWs20 를 override (main() 을 부르지 않는다)
36번째  js/ws_html5_ws20_attr.js  ← 가드 통과 → 내 setChangeFlag 설치
```

① 사본 정의는 `oAPP.fn.main` 안이고, 그 함수를 부르는 유일한 자리가 33번째 override 로 대체됐다.
② 원본 쪽 그 자리는 `sap.ui.getCore().byId("WS20_MAIN")` 이 없으면 바로 return 한다.
③ 실측 호출 스택이 `js/ws_html5_ws20_attr.js:321` 을 가리켰다.

★**함정**: 누군가 `oAPP.fn.main()` 을 다시 부르게 하면 사본이 **가드 없이** 내 것을 덮어써
 머리줄 갱신이 조용히 사라진다(사본은 플래그 3줄뿐).

## 중복 3곳 — 판정 유지

`js/ws_html5_ws20_edit.js` 70·71 · `js/ws_html5_ws20_attr.js` 4222·4223 · 5450·5451.

## 1차에서 틀렸던 것

- 실제 호출 「33곳」 → **31곳**. 주석 2줄을 호출로 셌다.
- 1차에 「51줄 중 나머지는 주석일 것」이라고 **세지 않고 넘겼다** — 그래서 틀렸다.

---

# 중복 3곳 제거 (2026-10-26)

지시: 장군님 「1번만해」 — 앞서 보고한 세 안(① 중복 3곳 삭제 ② 머리줄 갱신 분리 ③ 사본 덮어쓰기 가드)
중 **①만** 수행. ②③ 은 손대지 않았다.

## 지운 것 — 6줄 → 주석 3줄

| 파일 | 지운 줄 | 내용 |
|---|---|---|
| `js/ws_html5_ws20_edit.js` | 70·71 | `APPCOMMON.fnSetModelProperty("/WS20/APP/IS_CHAG","X")` + `fnUpdateWs20AppHeader()` |
| `js/ws_html5_ws20_attr.js` | 4221~4223 | 같음 (주석 1줄 포함) |
| `js/ws_html5_ws20_attr.js` | 5449~5451 | 같음 (주석 1줄 포함) |

지운 자리마다 `//[2026-10-26] … setChangeFlag 안에서 같은 함수에 같은 값을 이미 쓴다(중복). 장군님 지시.` 를 남겼다.

## 영향도 0 의 근거 (지우기 전 확인)

1. **같은 함수다.** `APPCOMMON` = `oAPP.common` (`js/ws_html5_ws20_edit.js:23`).
   `js/ws_common.js:11` 이 `oAPP.common = {}` 로 만들고, `js/ws_html5_shell.js:21` 은
   `oAPP.common || (...)` 로 **기존 객체를 유지**한다 → edit.js(로드 191번째)가 잡는 참조는 그 객체 그대로.
   `fnSetModelProperty` 는 `ws_common.js:372` 정의 → `ws_html5_shell.js:263` 이 **같은 객체 위에 덮어쓴다**.
   즉 `APPCOMMON.fnSetModelProperty` 와 `setChangeFlag` 안의 `oAPP.common.fnSetModelProperty` 는 **동일 함수**.
2. **같은 값이다.** 그 함수 본문은 `oAPP.attr.oModel.setProperty(sModelPath, oModelData)` 한 줄.
   두 자리 모두 `"/WS20/APP/IS_CHAG"` 에 `"X"`.
3. **앞에서 이미 끝난다.** `setChangeFlag`(`js/ws_html5_ws20_attr.js:309`) 안의 319·321 행이
   모델값 쓰기 + `fnUpdateWs20AppHeader()` 를 이미 한다.
4. **가드를 통과한다.** `js/ws_html5_ws20_edit.js:69` 의 `typeof === "function"` 검사 →
   `attr.js`(183번째)가 `edit.js`(191번째)보다 먼저 로드되므로 설치 상태가 보장된다.

## 검증

`node --check` 두 파일 통과. 지운 자리 눈으로 확인.
**앱으로 돌려 본 테스트는 안 했다** — 장군님이 돌려 보셔야 한다.

## 또 밟을 함정

- **이 제거는 ③(가드)과 엮여 있다.** 만약 누군가 `oAPP.fn.main()` 을 다시 부르게 되면
  `design/js/main.js:875` 의 사본 정의가 **가드 없이** 내 `setChangeFlag` 를 덮어쓴다.
  사본은 플래그 3줄만 있고 머리줄을 갱신하지 않는다 → 지금 지운 줄들이 **머리줄을 그려 주던 유일한 보험**이었다.
  즉 이제 그 경로가 생기면 **「변경됨」 표시가 조용히 안 뜬다.** ③ 은 아직 안 넣었다.
- `js/ws_html5_ws20_attr.js:4213~4214` 의 주석은 **사실과 다르다** —
  「setChangeFlag 본체는 design/js/main.js 가 먼저 정의하므로 여기서 헤더/상태 갱신을 직접 호출해야 한다」
  고 적혀 있는데, ① 사본은 `oAPP.fn.main` 안에 갇혀 설치되지 않고 ② 이번에 그 직접 호출을 지웠다.
  **고치지 않았다**(지시 범위 밖) — 장군님 결정 대기.

## 안 한 것

- ② 머리줄 갱신과 툴바 갱신 분리 (호출처 31곳 영향)
- ③ 사본 덮어쓰기 가드
- 실측으로 PAGE 밑에 넣은 `sap.m.Button` 2개 되돌리기 (저장 안 함)
- 커밋 (지시 없음)

---

# 영향도 분석 — 머리줄 갱신과 툴바 갱신 분리 (2026-10-26)

지시: 장군님 「지금 무조건 바꾸는거보단 영향도를 반드시 최우선으로 고려해야된다」
→ 코드는 **한 줄도 고치지 않았다.** 분석만 했다. 규칙에도 못 박았다(`.claude/rules/code.md`).

## 다 봤다 기준

① 머리줄 함수 본문 전체 ② 툴바 함수 본문 전체 — **각각이 어떤 값을 읽는지**
③ `setChangeFlag` 를 부르는 31곳이 그 값들을 **쓰는지**
④ 머리줄 함수를 부르는 곳 전수 ⑤ 툴바 함수를 부르는 곳 전수 ⑥ 첫 렌더 순서(가드 통과 여부)
→ **전부 봤다.**

## ① 두 함수가 읽는 값 (소스 확인)

| 함수 | 읽는 값 | `IS_CHAG` 를 보나 |
|---|---|---|
| `fnUpdateWs20AppHeader` (`js/ws_html5_ws20.js:1054`) | `APPID` · `IS_EDIT` · `ACTST` · **`IS_CHAG`** | **본다** (상태 칸 1091~1105행) |
| `fnUpdateWs20Toolbar` (`js/ws_html5_ws20.js:478`) | `IS_EDIT` · `S_APP_VMS` · `ADMIN_APP` · `IS_DEV` · `ISADM` | **안 본다** (`ACTST` 도 안 본다) |

→ **변경 플래그가 세워져도 툴바 버튼 표시는 하나도 달라질 수 없다.** 그런데 매번 다시 잰다.

## ② 31곳이 툴바가 읽는 값을 쓰는가 → **0곳**

`IS_EDIT` 를 쓰는 자리 = `js/ws_fn_02.js:201·206` · `js/ws_html5_shell.js:966·971` ·
`js/ws_html5_ws20_data.js:296·501` · `design/js/main.js:522·762` (+ WS30/USP 쪽, 이 건과 무관).
**31곳과 파일조차 겹치지 않는다.**
`S_APP_VMS` · `ADMIN_APP` 은 **쓰는 자리가 아예 없다**(읽기만).

## ③ 머리줄 함수를 부르는 곳 — 12곳, 그중 툴바가 필요한 것 4곳

| 자리 | 무엇이 바뀌나 | 툴바 필요 |
|---|---|---|
| `js/ws_html5_ws20.js:1813` 재진입(셸 이미 있음) | 모드가 바뀌어 들어올 수 있다 | **필요** |
| `js/ws_html5_ws20.js:1854` 셸 첫 렌더 | 툴바 DOM 이 방금 생겼다 | **필요** |
| `js/ws_html5_ws20.js:2016` Change 모드 전환 | `IS_EDIT` → "X" | **필요** |
| `js/ws_html5_ws20.js:2105` Display 모드 전환 | `IS_EDIT` → "" | **필요** |
| `js/ws_events.js:2022` 저장 | `IS_CHAG` 만 | 불필요 |
| `js/ws_events.js:2410` Activate | `ACTST` 만 | 불필요 |
| `js/ws_html5_ws20_attr.js:321` 변경 플래그 안 | `IS_CHAG` 만 | 불필요 |
| `js/ws_html5_ws20_edit.js:618` undo/redo 복원 | `IS_CHAG` 만 | 불필요 |
| `js/fnCssJsLinkAddPopupOpen.js:130` · `js/fnEditorPopupOpen.js:230` · `js/fnErrorPageEditorPopupOpen.js:253` · `js/fnWebSecurityPopupOpen.js:91` | `IS_CHAG` 만 | 불필요 |

## ④ 툴바 함수를 부르는 곳 — **머리줄 함수 안 1곳뿐**(`js/ws_html5_ws20.js:1119`)

다른 자리에서는 아무도 부르지 않는다. 그래서 그 한 줄을 빼면 **툴바가 영영 갱신되지 않는다** —
반드시 위 4곳에 넣어 줘야 한다.

## ⑤ 결론 — 고칠 자리는 31곳이 아니라 **5곳**

- 빼기 1곳: `js/ws_html5_ws20.js:1119` (머리줄 함수 끝의 툴바 호출)
- 넣기 4곳: `1813` · `1854` · `2016` · `2105` — 머리줄 호출 **바로 뒤**에 툴바 호출 1줄
- **`setChangeFlag` 를 부르는 31곳은 한 줄도 안 건드린다.**
- 머리줄 갱신은 **떼어내지 않는다** — 상태 칸이 `IS_CHAG` 를 보므로 31곳 전부 필요하다.

★**앞 보고 정정**: 내가 「31곳을 가려야 한다」고 말한 것은 틀렸다. 31곳은 대상이 아니다.
그때 나는 **두 함수가 각각 어떤 값을 읽는지 대조하지 않고** 호출처 수만 보고 말했다.

## ⑥ 남는 위험 2가지

1. **첫 렌더 순서** — `1854` 는 `oWS20.appendChild(MAIN)` 다음이고 툴바 DOM 은 MAIN 안에 이미 있다.
   툴바 함수의 가드(`#ws20TxToolbar` 없으면 return)를 지금도 통과하므로 순서를 바꾸지 않으면 그대로다.
   **머리줄 호출 앞에 툴바 호출을 두면 안 된다**(그 자리는 아직 DOM 이 없을 수 있다).
2. **앞으로 머리줄 함수를 부르는 새 자리**가 모드까지 바꾸는 경우, 툴바를 같이 불러야 함을 모를 수 있다.
   → 머리줄 함수 머리말에 「모드를 바꾼 자리는 툴바도 직접 부른다」를 주석으로 못 박는다.

## ⑦ 고치기 전에 적어 두는 테스트 항목

| 코드 | 동작 | 조작·확인 포인트 | O/X |
|---|---|---|---|
| CF1 | 모드 전환 시 툴바 버튼 | ① 앱을 Display 로 연다 ② 「Change」 를 누른다 ③ Save·Activate·Syntax Check·Add Event Method 가 **나타나는지** ④ 다시 「Display」 → **사라지는지** | ☐ |
| CF2 | 첫 진입 툴바 | ① 앱을 새로 연다 ② 툴바 버튼이 모드에 맞게 보이는지 ③ 창을 좁혀 「⋯」 에 들어가는지 | ☐ |
| CF3 | 재진입 툴바 | ① 앱을 연다 ② 뒤로 나간다 ③ 같은 앱을 다시 연다 ④ 버튼이 맞게 보이는지 | ☐ |
| CF4 | UI 추가 후 깜빡임 | ① UI 를 추가한다 ② 처리중 표시가 꺼진 뒤 툴바 버튼 3개가 **깜빡이지 않는지** ③ 오른쪽 위가 「변경됨」 으로 바뀌는지 | ☐ |
| CF5 | 저장·Activate | ① 저장한다 → 상태 칸이 바뀌는지 ② Activate → Active 로 바뀌는지 ③ 그때 툴바가 흔들리지 않는지 | ☐ |

## 안 한 것

- **코드 수정 — 안 했다.** 장군님 승인 대기.
- 31곳 각각의 본문 정독 — **필요 없다고 판정했다**(툴바가 읽는 값을 쓰는 자리가 0곳이므로).
  이 판정이 틀렸다면 ②를 다시 본다.

---

# 수정 — 툴바 갱신을 앱 헤더 갱신에서 분리 (2026-10-26)

지시: 장군님 「고쳐바」 (위 영향도 분석을 보고한 뒤)

## 고친 것 — `js/ws_html5_ws20.js` 한 파일, 5곳

| | 자리 | 내용 |
|---|---|---|
| 빼기 | 헤더 함수 끝 (고치기 전 1118·1119) | `fnUpdateWs20Toolbar()` 호출 + 그 주석 → **왜 안 부르는지 적은 주석 3줄로 교체** |
| 넣기 | 544~562 | 공통 함수 `_refreshWs20Toolbar()` 신설 (try/catch + `U4ALOG.caught`) |
| 넣기 | 1835 | 재진입(셸 이미 있음) — `return` **앞**에 넣었다 |
| 넣기 | 1878 | 셸 첫 렌더 |
| 넣기 | 2042 | Change 모드 전환 |
| 넣기 | 2133 | Display 모드 전환 |

4곳 모두 **헤더 호출 바로 다음 줄**이다(앞에 두면 그 시점에 툴바 DOM 이 없을 수 있다).

## 왜 공통 함수로 뺐나

같은 `try/catch` 묶음이 4곳에 되풀이되므로 `.claude/rules/code.md` 의
「같은 catch 가 되풀이되면 작은 함수 하나로 뺀다」를 따랐다. 호출 쪽은 한 줄이 된다.

## 검증

- `node --check js/ws_html5_ws20.js` 통과.
- 5곳 전부 눈으로 다시 확인(들여쓰기·`return` 앞 위치 포함).
- **앱으로 돌려 본 테스트는 안 했다** — 장군님이 돌리신다. 테스트 항목 CF1~CF5 = 위 영향도 분석 절.

## 또 밟을 함정

- **앞으로 `fnUpdateWs20AppHeader` 를 부르는 자리를 새로 만들 때**, 그 자리가 모드(`IS_EDIT`)나
  버전관리(`S_APP_VMS`)·권한(`ADMIN_APP`)을 바꾸는 자리라면 **`_refreshWs20Toolbar()` 를 같이 불러야 한다.**
  헤더 함수 끝에 그 내용을 주석으로 못 박아 두었다(고친 뒤 1137~1139).
- **툴바 함수를 부르는 자리는 이제 `_refreshWs20Toolbar()` 하나뿐이다.** 다른 데서 직접 부르지 말 것.

## 안 한 것

- 커밋 (지시 없음)
- 변경 플래그 함수의 **머리줄 갱신** — 떼지 않았다. 상태 칸이 `IS_CHAG` 를 보므로 그대로 필요하다.
- 사본 덮어쓰기 가드 · 실측으로 넣은 Button 2개 되돌리기 (둘 다 TODO 2부에 있다)

## 함정 하나 더 — 이번에 내가 밟았다 (도구 쪽)

TODO 번호를 다시 매기려고 **bash heredoc 안에 node 스크립트를 쓰면서 정규식을 문자열로 조립**했다.
`"^\| 3-" + n + " \|"` 이 heredoc 을 지나며 백슬래시가 하나 줄어 `^| 3-23 |` 이 됐고,
**파이프가 OR 로 해석돼 `^`(문서 맨 앞)에 매칭**되었다. 그래서 치환 문자열 23개가 문서 1행에 쏟아졌다.
→ **heredoc 으로 정규식을 넘기지 않는다.** 스크립트는 Write 도구로 파일에 쓰고, 되도록
`indexOf` · `slice` 같은 문자열 다루기로 푼다. 복구는 git 되돌리기 대신 1행만 잘라 고쳤다
(그 파일에는 아직 커밋 안 한 다른 변경이 있었다).
---

# TODO 재배치 — 테스트를 1부로 (2026-10-26)

지시: 장군님 「테스트할건 항상 todo 맨 상단에 배치해」

이번에 고친 것의 테스트를 **3부에 넣어** 지적받았다. 규칙(`document.md`)에 이미
「테스트할 그룹은 TODO 맨 위」가 있었는데 지키지 않았다.

## 바꾼 것

부 순서를 **고정**했다 — **1부 테스트 · 2부 제가 할 일(노션) · 3부 정해 주실 것 · 4부 직접 하실 것.**
각 줄의 뒷번호는 그대로 두고 부 번호만 바꿨다(테스트 28줄 · 노션 1줄 · 결정 18줄).
오류 현황표는 노션 절 바로 위로 내렸다(그 숫자가 노션 건수라서).

`.claude/rules/document.md` 에 이 순서를 못 박았다. 깃에 들어가므로 다른 PC 의 AI 도 읽는다.

## 또 밟을 함정

- **TODO 의 부 번호는 「위에서부터 세는 자리」**다. 절을 옮기면 **그 아래 번호가 전부 밀린다** —
  옮긴 뒤 반드시 번호 전체를 다시 뽑아 **중복·빠짐이 없는지 눈으로 확인**한다.
  이번에도 1차 시도에서 번호가 중복됐다(3-1~3-6 이 두 벌).
- 부 번호를 **순환**으로 바꿀 때(3→1, 1→2, 2→3) 문서 전체에 한꺼번에 치환하면 서로 덮어쓴다.
  **블록을 먼저 자르고 블록 안에서만** 바꾼다.

---

# 처리중 표시가 연타 중에 안 꺼진 원인 — CDP 실측으로 확정·수정 (2026-10-26)

지시: 장군님 「니가 지금 cdp를 붙여서 확인해보던지」 → 「내가 클릭해볼테니까 넌 감시 하고 있으라고」 → 「1」

## 현상 (장군님 재현)

모드 변경 버튼 클릭 → 처리중 표시 켜짐 → **클릭을 연달아 하는 동안 안 꺼짐** → **멈추니 꺼짐.**

## 실측 방법

떠 있는 앱에 CDP(9222) 로 붙어 `#Main` 창에 감시 코드를 주입했다. **클릭은 장군님이 직접** 하셨다.
처리중 표시의 `open` 속성을 기준으로 켜짐~꺼짐 구간만 `document.body` 전체를 감시
(childList·attributes·attributeOldValue·characterData·subtree) — 끄기 판정과 같은 범위.

## 실측 결과 — 5708ms 구간 219건이 **딱 두 가지의 되풀이**

```
body        @class     : u4aWsMainBody -> u4aWsMainBody   (같은 값)
div.u4a-tooltip @data-show : false     -> false           (같은 값)
```

구간 4개: 1357ms/12건 · 2345ms/114건 · 375ms/5건 · **5708ms/219건.**
마지막 기록이 `body @style : pointer-events: none -> (빈값)` = 마우스 막기 해제 = 그때 꺼졌다.

## 호출 스택 (두 번째 주입으로 확보)

```
classList.remove "u4a-dragging"  < HTMLDocument.<anonymous> (theme/u4a-ui.js:1203)
classList.toggle "u4a-window-blurred,false" < _set (theme/u4a-ui.js:1527) < _resync (1538)
```

## ★어느 쓰기가 기록을 내는가 — 이 Chromium 에서 직접 쟀다

| 쓰기 | MutationRecord |
|---|---:|
| `classList.remove(없는 클래스)` | **1건 — 난다** |
| `classList.toggle(없는 클래스, false)` | **0건 — 안 난다** |
| `className = 같은 값` | 1 |
| `dataset = 같은 값` | **1건 — 난다** |
| `setAttribute(같은 값)` | 1 |

→ **범인은 2자리다. 3자리가 아니다.** `u4a-ui.js:1527`(창 흐림 표시)는 `toggle` 이라 기록이 안 나므로
무죄다. 내가 앞 보고에서 「세 자리」라고 한 것을 이 실측으로 정정했다.
★교훈: **「값이 안 바뀌는 쓰기가 기록을 내는가」는 API 마다 다르다.** 재 보지 않고 묶어서 단정하면 틀린다.

## 왜 모달인데 핸들러가 도나

처리중 표시는 `<dialog>` + `showModal()` 이라 **버튼 활성화**는 막지만,
**마우스 이벤트가 document 까지 전달되는 것은 막지 않는다.**
두 자리는 모두 **document 레벨 마우스 핸들러**(`mouseup` 캡처 / `mouseout`)여서 그대로 돈다.

## 고친 것 — `theme/u4a-ui.js` 2자리

| 자리 | 고친 내용 |
|---|---|
| `_hide()` (설명 풍선 숨기기) | `oTip.dataset.show !== "false"` 일 때만 쓴다 |
| document `mouseup` 캡처 핸들러 | `classList.contains("u4a-dragging")` 일 때만 제거한다 |

`node --check` 통과. 고친 두 자리 눈으로 확인.
`u4a-dragging` 을 제거하는 자리는 `www` 전체에 7곳이지만, **마우스를 뗄 때마다 무조건 도는 것은 이 1곳**뿐이다
(나머지는 실제로 끌었을 때만 돈다). 설명 풍선 숨기기를 부르는 곳은 1곳이다.

## 또 밟을 함정

- **`classList.remove` 는 없는 클래스에도 class 속성을 다시 쓴다**(Chromium 93 실측) → MutationRecord 가 난다.
  처리중 표시가 켜져 있는 동안 도는 코드에서 **무조건 remove 를 부르면 끄기가 영영 미뤄진다.**
  `toggle(cls, false)` 는 기록이 안 나므로 그 자리에는 안전하다.
- **`dataset`·`setAttribute`·`className` 은 같은 값을 써도 기록이 난다.** 되풀이되는 자리에서는 반드시 값 비교를 먼저.
- 끄기 판정은 `document.body` 전체를 보므로, **사용자 입력으로 생기는 무해한 쓰기도 전부 세어진다.**
  앞으로 document 레벨 입력 핸들러를 새로 만들 때 이 점을 본다.
- bash heredoc 안에서 node 정규식을 조립하지 말 것(백슬래시가 줄어 파이프가 OR 로 해석됨 — 이번에 TODO 1행이 깨졌다).

## 안 한 것

- 앱으로 돌려 본 확인 — **장군님이 앱을 다시 켜셔야** 코드가 반영된다.
- 끄기 판정 쪽은 한 줄도 안 건드렸다(「다 그려진 뒤에 끈다」 규칙 유지).
- 커밋 (지시 없음)

## 테스트 통과 (2026-10-26)

장군님 확인: 「이제 잘 된다」 — 앱을 다시 켠 뒤 모드 변경 버튼을 누르고 **처리중 표시가 뜬 동안
연달아 클릭해도 꺼진다.** TODO 1-6 통과 표시.
장군님 추가 확인(2026-10-26): **1-1(모드 전환 시 툴바 버튼) · 1-2(첫 진입) · 1-3(재진입) 통과.**
→ 툴바 갱신을 앱 헤더에서 떼어낸 수정이 정상 동작한다. 남은 것은 1-4(UI 추가 후 깜빡임) · 1-5(저장·Activate).

## 테스트 글귀 정정 (2026-10-26)

장군님 질문 「1-4 3번 내용에 오른쪽 위가 어딘지?」 → **내가 틀리게 적었다.**
CDP 로 실제 위치를 재서 확인(창 1340px 기준):

```
←(left=10)  YLCY_TEST2141(51)  편집(170)  비활성(206)
```

앱 머리줄은 **화면 왼쪽 위**다 — 뒤로가기 화살표 오른쪽에 「앱 이름 · 모드 · 상태」가 나란히 있다.
화면 글자는 **「편집」**(모드, 값 EDIT) · **「비활성」**(상태, 값 INACTIVE)이고, 「변경됨」 이라는 글자는 화면에 없다.
→ TODO 1-4 · 1-5 를 고쳤다.

★함정: **테스트 항목에 화면 위치·글자를 적을 때 소스나 실측으로 확인하지 않고 쓰면 장군님이 못 찾는다.**
머리줄 글자는 메시지 DB 에서 오므로 소스에는 번호(A02·A05·B66·B67)만 있다 — **화면에서 재야 실제 글자를 안다.**

## 묶음 전건 통과 — 종료 (2026-10-26)

장군님 확인: **1-4(UI 추가 후 툴바 깜빡임) · 1-5(저장·Activate) 통과.**
→ 이번 묶음 **1-1 ~ 1-6 전부 통과**. TODO 에서 그 절을 지우고 1부 번호를 다시 매겼다(1-7~1-29 → 1-1~1-23).

### 이 작업으로 끝난 것 (커밋 전)

| 파일 | 고친 것 |
|---|---|
| `js/ws_html5_ws20_edit.js` · `js/ws_html5_ws20_attr.js` | 변경 flag 뒤 중복 2줄 × 3곳 제거 |
| `js/ws_html5_ws20.js` | 툴바 갱신을 앱 헤더 갱신에서 분리 — 빼기 1 · 넣기 4 · 공통 함수 1 |
| `theme/u4a-ui.js` | 값이 안 바뀌는 쓰기 2자리에 조건 추가(처리중 표시가 안 꺼지던 원인) |
| `.claude/rules/code.md` | 「고치기 전 영향도부터」 규칙 |
| `.claude/rules/document.md` | 「TODO 1부 = 테스트」 규칙 |

**아직 안 한 것**: 커밋 · 실측으로 PAGE 밑에 넣은 `sap.m.Button` 2개 되돌리기(TODO 3부) ·
사본 덮어쓰기 가드(TODO 3부) · 끄기 판정에서 「옛값과 같으면 안 센다」(미결정).
장군님 결정(2026-10-26): 실측으로 PAGE 밑에 넣은 `sap.m.Button` 2개는 **되돌리지 않고 놔둔다.**
→ TODO 그 항목 삭제.
