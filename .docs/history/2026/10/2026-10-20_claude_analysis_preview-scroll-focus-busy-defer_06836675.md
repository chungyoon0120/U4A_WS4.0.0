# 좌측 UI tree 선택 시 미리보기 스크롤 이동이 안 되는 원인 분석

- 작성 2026-10-20 · 세션 06836675 · type=analysis
- 지시: 장군님 「이전에는 좌측 UI를 선택하면 미리보기에 표현 안되서 스크롤 밑에 있는 UI 일 경우는 미리보기 스크롤까지 이동해주는 로직이 있었던거 같은데 어떻게 된건지 분석해바」
- **코드는 한 줄도 고치지 않았다** (분석만, 수정 지시 대기)

## 1. 스크롤 이동 장치는 지금도 있다

`design/preview/index.js`

| 자리 | 내용 |
|---|---|
| 3676 `selPreviewUI(OBJID)` | `await oWS.sMark.fn_mark(parent.oAPP.attr.prev[OBJID])` 한 줄 |
| 3012 `oWS.sMark.fn_mark` | 3033 `oMarkUi.focus()` — 원본 주석(PES, 2026-07-01): 「미리보기 UI 선택 효과 적용 시 focus를 호출하여 선택한 UI의 DOM 위치로 스크롤 이동되도록 처리한다」 |

즉 **스크롤 이동 = `focus()` 하나에 전부 걸려 있다.** 지워진 코드는 없다.

## 2. 그 `focus()` 가 지금은 무시된다 — 원인은 2026-10-19 커밋 `783c0f5d`

### 체인 (전부 소스로 확인)

```
setBusy("X")  → oWS.utill.fn.setBusy("X")            (ws30/resources/index.js:925)
              → attr.oBusy.open()                   (더미, js/ws_html5_shell.js:242)
              → parent.setDomBusy("X")              (resources/index.js:1651)
              → U4ABusy.show()                      (theme/u4a-busy.js:104)
              → <dialog id="u4aWsBusyIndicator">.showModal()   ← top layer modal
```

`showModal()` 모달은 top layer 라 **문서 전체가 inert** 가 되고, inert 는 iframe 안
document 까지 전파된다. inert 안의 요소는 focusable 하지 않으므로 `focus()` 가 무시된다.
(CDP 실측 기록 = `js/ws_html5_ws20_tree.js:914~920` — 「잠금 켜짐=스크롤 0 그대로·테두리 없음 / 꺼짐=정상 이동·테두리 표시」)

### 순서가 뒤집힌 자리

`js/ws_html5_ws20_attr.js` `fnWs20SelectUI`

| 줄 | 하는 일 |
|---:|---|
| 3663 | `finally` 안 `parent.setBusy("")` — **끄라는 신호만** |
| 3672 | 10단계 `setAttrFocus` |
| 3676 | 11단계 `await oWin.selPreviewUI(OBJID)` → `focus()` ← **busy 가 아직 열려 있다** |

`setBusy("")` 가 바로 끄지 않는다. 2026-10-19 커밋 `783c0f5d` 에서 끄기를
`_u4aBusyOffWhenSettled`(`resources/index.js:1752`) 로 미루게 고쳤다 —
**MutationObserver 2 frame 무변경 + requestIdleCallback** 둘 다 돼야 닫는다(실측 12~134ms).
11단계는 같은 microtask 안에서 끝나므로 **100% busy 가 열린 상태**에서 돈다.

### 전후 비교

| | `setBusy("")` 동작 | 11단계 focus |
|---|---|---|
| 원본 UI5 (`U4A_WS3.0.0/www/ws30/resources/index.js:1544`) | 즉시 `oWS.utill.fn.setBusy("")` → close | 먹는다 → 스크롤 이동 |
| WS4.0 `783c0f5d` 이전 | 같음 (즉시) | 먹는다 |
| WS4.0 지금 | 2 frame + idle 뒤에 close | **안 먹는다 → 스크롤 안 움직임** |

원본 순서도 같다 — `U4A_WS_DESIGN/design/js/uiDesignArea.js` 2570 `parent.setBusy("")` →
2575 `setAttrFocus` → 2579 `await selPreviewUI`. **원본은 해제가 즉시라서 성립하던 순서다.**

## 3. 부차 요인 — busy 가 꺼질 때 이전 포커스를 되돌린다

busy off 경로 2곳이 `beforeActiveElement.focus()` 로 **busy 켜기 직전 포커스를 복원**한다.

- `oWS.utill.fn.setBusyDialog("")` — `resources/index.js:1048~1060`
- `oWS.utill.fn.setBusy("")` — `resources/index.js:963~971`

끄기가 미뤄지므로 이 복원이 11단계 `focus()` **뒤**에 일어난다 → 미리보기로 옮긴 포커스를 덮는다.
(스크롤 자체를 되돌리지는 않지만, 1번 원인이 고쳐지면 이것이 다음 걸림돌이 된다.)

## 4. 내가 넣어 둔 보정은 이 건을 못 막는다

`js/ws_html5_ws20_attr.js`

- 3213 `_alignPreviewToScreenTop` — 「고른 UI 가 보이는 영역보다 작으면 return」.
  장군님이 말씀하신 **낱개 UI(스크롤 밑에 있는 UI)에는 아무것도 안 한다.** 화면(Page) 전체를 고를 때만 동작.
- 3173 `_reassertPreviewSelection` — **테두리만** 다시 그려 달라고 요청한다. 스크롤은 건드리지 않는다.

## 5. 고치는 안 (실행 안 함 — 지시 대기)

**11단계를 busy 가 실제로 꺼진 뒤에 돌린다.** 공통 busy 는 안 건드린다(장군님 지시).
`fnWs20SelectUI` 안에서 `document.getElementById("u4aWsBusyIndicator").open === false` 가 될 때까지
rAF 로 짧게 기다린 뒤(상한 둠) 11단계를 실행 → 원본 순서(「해제된 뒤 미리보기 선택」)를 그대로 되살린다.

버린 안:
- 미리보기에 `scrollIntoView` 를 직접 넣기 → 원본에 없는 방식(임의 창작) + `focus()` 와 이중 동작.
- 공통 busy 에 「꺼짐 알림」 추가 → 공통 busy 수정 금지.
- `783c0f5d` 되돌리기 → busy 를 다 그려진 뒤에 끄는 것은 장군님 지시사항이다.

## 6. 또 밟을 함정

- **`setBusy("")` 는 끄라는 「신호」다. 그 줄 다음에 오는 코드는 busy 가 켜진 상태에서 돈다.**
  2026-10-19 이후 모든 「busy 끈 뒤에 하는 일」은 이 전제가 깨졌다 — 포커스·측정·스크롤처럼
  **inert 와 레이아웃에 걸리는 일**은 전부 같은 사고가 난다.
- busy = `<dialog>.showModal()` = top layer modal → **iframe 안까지 inert**. 메인 창 busy 가
  미리보기 iframe 안의 `focus()` 를 막는다.
- `oWS.utill.attr.oBusy` 는 `resources/index.js` 에 할당이 없다 — `js/ws_main.js:1106` 에서
  더미(`fnCreateDummyBusy`)를 넣는다. grep 으로 할당을 못 찾고 「busy 안 뜬다」고 오판하지 말 것.

## 7. 아직 안 본 것

- **앱에서 실측하지 않았다**(장군님이 직접 돌리신다). 위 판정은 전부 소스 + 2026-10-19 커밋 diff 근거.
- `setAttrFocus`(10단계)도 같은 inert 에 걸리는지는 보지 않았다 — 이 조사 범위 밖.

---

# (이어 씀) 2026-10-20 — 장군님 「고쳐라」 → 수정 완료

## 8. 고친 것 — 파일 1개 · 71줄 추가 · 1줄 교체

`www/ws30/ws10_20/js/ws_html5_ws20_attr.js`

| 자리 | 내용 |
|---|---|
| 1행 | 오류코드 주석 `다음 번호: 004` → `005` |
| `_waitBusyClosed()` 신규 | `parent.document` 의 busy `<dialog>` 가 **실제로 닫혔는지**(`open !== true`) rAF 로 지켜본다. 없거나 이미 닫혀 있으면 즉시 통과 |
| `fnWs20SelectUI` finally **직후** | `await _waitBusyClosed();` 한 줄 — 그 뒤가 10단계(`setAttrFocus`) · 11단계(`selPreviewUI`) |

- **공통 busy 는 한 글자도 안 건드렸다**(장군님 지시). 닫힘만 지켜본다.
- 대기를 11단계 앞이 아니라 **10단계 앞**에 둔 까닭: 원본은 `setBusy("")` → `setAttrFocus` →
  `selPreviewUI` 순서이고 **두 단계 모두 focus 를 쓴다**. 원본에서는 둘 다 busy 가 닫힌 뒤에 돌았다.
  (`setAttrFocus` 는 `UIATK` 가 없으면 즉시 return 하므로 좌측 tree 클릭 경로에서는 영향 0)
- 상한 `6000ms` — 공통 busy 자체 상한이 5000ms 라 그보다 길게 뒀다. 닿으면 `[W20A-004]` ERROR 를
  남기고 **그대로 진행**한다(멈추지 않는다).
- **rAF 와 setTimeout 둘 다**로 상한을 건다 — 뒤로가기로 WS20 화면이 숨으면 rAF 가 멈춘다.
  rAF 만 쓰면 Promise 가 영영 resolve 되지 않아 호출처가 멈춘다.

## 9. 영향도 — 전수 조사 결과

### `fnWs20SelectUI` 호출처 4곳 (전부 읽음)

| 자리 | 쓰는 법 | 판정 |
|---|---|---|
| `js/ws_html5_ws20_tree.js:924` 좌측 tree 행 클릭 | `await` | 이번 건의 본 경로 |
| `js/ws_html5_ws20_prev.js:800` `setSelectTreeItem` 위임 | `return Promise.resolve(...)` | 간접 호출처 전부가 이 길로 온다 |
| `js/ws_html5_ws20_prev.js:1917` 미리보기 UI 클릭 / 첫 진입 ROOT 선택 | `oP = ...` → `Promise.finally` | 아래 데드락 검토 참조 |
| `js/ws_html5_ws20_edit.js:85` 재선택 | `return Promise.resolve(...)` | 그대로 전달 |

`setSelectTreeItem` 간접 호출처 = `js/fnDialogPopupOpener.js:4058` · `js/ws_html5_ws20_dnd.js:1297` ·
`js/ws_html5_ws20_edit.js:87` · `js/ws_html5_ws20_wizard.js:263` · 사본 폴더(undoRedo · callDesignContextMenu ·
designCallWizardPopup · preview/index.js 4137·4396 · parseAiLibraryData). **즉 UI 추가·삭제·붙여넣기·
undo/redo·D&D·마법사·미리보기 클릭이 모두 이 함수를 지난다.**

**구조는 바뀌지 않는다** — `fnWs20SelectUI` 는 이미 `async` 였고 11단계에 `await` 가 있었다.
내 변경은 그 안의 대기 시간만 늘린다. `await` 하지 않는 호출처는 전에도 11단계를 기다리지 않았다.

### `bSkipBusy` — 실제로 넘기는 곳 0곳 (전수 확인)

그래서 **모든 호출이 안쪽에서 `setBusy("")` 신호를 보낸다** → 기다리면 반드시 닫힌다.
`bSkipBusy: true` 로 부르는 자리가 생기면 안쪽이 OFF 를 안 보내므로 6초 상한까지 간다 —
그런 호출처를 새로 만들면 이 대기도 같이 손봐야 한다.

### 데드락 검토 (첫 진입 경로)

`_ws20EngagePrevBusy()`(`prev.js`)가 `oAPP.common.fnSetBusyLock("X")` 로 busy 를 켜고,
`_ws20ReleasePrevBusy()` 가 끈다. 그 해제는 `fireCellClick` 의 `Promise.finally` =
**내 대기보다 뒤**다. 서로 기다리면 멈춘다.

→ **멈추지 않는다.** `fnSetBusyLock`(`js/ws_html5_shell.js:357`)은 깊이를 세지 않고 그냥
`parent.setBusy` 를 부르고, `fnWs20SelectUI` 안쪽 `finally` 의 `parent.setBusy("")` 신호 하나로
dialog 가 닫힌다(`setBusy` 는 깊이를 세지 않는다 — `resources/index.js:1859`). 확인하고 판정했다.

## 10. 또 밟을 함정 (이번에 새로 안 것)

- **`_u4aBusyOffWhenSettled` 는 대기 중에 busy 를 다시 켜면 끄기를 버린다**(`__u4aBusyGen`).
  내 대기 중에 다른 흐름이 `setBusy("X")` 를 하고 끄지 않으면 dialog 가 안 닫혀 **6초 상한까지 간다**.
  그때 `[W20A-004]` 가 콘솔에 남는다 — 그 줄이 보이면 「누가 busy 를 켜고 안 껐나」를 찾는 단서다.
- **`fnSetBusyLock` 은 깊이를 세지 않는다.** 「깊이 세는 busy」로 착각해 짝을 맞추려 들지 말 것.
- `oAPP.fn.setSelectTreeItem` 정의가 2곳(`design/js/uiDesignArea.js:2341` UI5판 /
  `js/ws_html5_ws20_prev.js:790` HTML5판)이고, 로드 순서(`js/library-preload.js` — `design/js/main.js`
  뒤에 내 파일들)상 **HTML5판이 이긴다**. 사본 쪽을 고쳐도 안 먹는다.

## 11. 아직 안 한 것

- **앱 테스트 안 했다**(장군님이 직접). 테스트 항목 = `.docs/TODO.md` 1B-4.
- 같은 inert 문제가 **사본 폴더의 다른 `selPreviewUI` 호출처**에도 있다 —
  `design/js/uiAttributeArea.js:1913`(속성 값 바꾼 뒤 미리보기 선택) · `design/js/uiDesignArea.js:2580`.
  **지시 범위가 아니라 손대지 않았다.** 고칠지는 장군님 결정 사항.
- 커밋하지 않았다.
