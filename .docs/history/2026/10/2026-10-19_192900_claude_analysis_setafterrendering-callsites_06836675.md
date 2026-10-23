# 원본 `setAfterRendering` 호출처 전수 분석

> 2026-10-19 · 장군님 지시 「원본에 setAfterRendering 호출처를 분석부터」
> 원본 = `C:\Users\socce\Documents\Github\U4A_WS_DESIGN`(디자인 영역 상류) + `U4A_WS3.0.0`(그 밖)
> `_` 접두 폴더·`testFolder` 제외. 관련 TODO = 1B-2.

## 모듈 본체

`design/js/previewRender/setOnAfterRender.js`
- `setAfterRendering(oTarget)` (15행) — `onAfterRendering` 이 **한 번 불릴 때 resolve 되는 Promise**.
  - 대상이 `RichTextEditor` 면 `readyRecurring` 이벤트 + `finalizeRichTextEditorRendering` 까지 기다린다.
  - 그 밖은 `addEventDelegate` 로 `onAfterRendering` 한 번 받고 → `attachEventDialogAfterOpen`(dialog 면 afterOpen) → `awaitPreviewExcepionUI`(am5 chart 등 UI 안의 다른 라이브러리) 까지 기다린 뒤 resolve.
  - 대상이 `undefined` / `addEventDelegate` 없음 / `onAfterRendering` 없음 → **즉시 resolve**(안 기다림).
- `getTargetAfterRenderingUI(oTarget)` (92행) — 기다릴 대상 고르기.
  - `onAfterRendering` 이 없거나 `invalidate` 가 `ManagedObject.prototype.invalidate` 인 UI 는 **부모로 올라간다**(그 invalidate 는 부모를 다시 그리므로).
  - 안에 다른 UI 를 품는 것은 그 안쪽으로 바꾼다: `_oDialog`(BusyDialog) · `_oPopover`(QuickView) · `_getMenu()`(Menu) · `_getDialog()`(ViewSettingsDialog) · `_oControl`(ResponsivePopover) · `MenuItemBase` → 부모.

## 공통 꼴 — 모든 호출처가 이 순서다

```
1) let _oTarget = _oRender.getTargetAfterRenderingUI(oAPP.attr.prev[<부모 OBJID>]);
2) if (_oTarget.getDomRef())  _oPromise = _oRender.setAfterRendering(_oTarget);   // DOM 에 떠 있을 때만
3) <데이터 바꾸기>
4) _oTarget.invalidate()  또는  _oTarget.rerender()                               // 다시 그리게 시킨다
5) await _oPromise;                                                               // 다 그려질 때까지
6) await Promise.all(_aPromise);   // renderingRichTextEditor 의 Promise (있을 때만)
7) await oAPP.fn.designRefershModel();  →  setSelectTreeItem / selPreviewUI
```
★ **2번의 DOM 확인이 핵심** — 안 떠 있으면 `onAfterRendering` 이 안 오므로 등록 자체를 안 하고 기다리지도 않는다. 이걸 빼면 **영영 안 끝난다.**

## 호출처 22곳 (모듈 안쪽 재귀 4곳 별도)

| 파일 | 행 | 함수 | 기다리는 대상 | 다시 그리기 |
|---|---:|---|---|---|
| uiAttributeArea.js | 1886 | `attrChange` (속성값 변경) | 고른 UI 의 **부모** | `invalidate` |
| uiAttributeArea.js | 2284 | `attrResetAttr` (속성 초기화) | 고른 UI 의 **부모** | `invalidate` |
| uiAttributeArea.js | 6590 | `updateDOCAttrList` (async) | 속성 테이블 `oRTab1` | `oModel.refresh(true)` |
| uiAttributeArea.js | 7485 | `updateAttrList` | 속성 테이블 `oRTab1` | `oModel.refresh(true)` |
| uiDesignArea.js | 2879 | `designCopyUI` (복사, async) | 부모 | `rerender` |
| uiDesignArea.js | 3100 | `drop_cb` (끌어다 놓기) | 부모 | `rerender` |
| uiDesignArea.js | 3502 | `drop_cb` | 부모 | `rerender` |
| uiDesignArea.js | 3553 | `drop_cb` | drop 대상 | `rerender` |
| uiDesignArea.js | 4904 | `addMultiDelAfterRendering` (여러 개 삭제) | 여러 개 → `_aPromise` | `invalidate` |
| uiDesignArea.js | 5505 | `designAddUIObject` (UI 추가) | 추가될 자리 | `rerender` |
| uiDesignArea.js | 5803 | `designRefershModel` | 속성 테이블 `oRTab1` | `invalidate` |
| uiDesignArea.js | 6411 | `lf_paste_cb` (붙여넣기) | 부모 | `rerender` |
| uiDesignArea.js | 7051 | `lf_deleteTreeLine` (삭제) | 지운 것의 부모 | `rerender` |
| callDesignContextMenu.js | 574 | `contextMenuUiMove` (UI 이동) | 부모 | `rerender` |
| callDesignContextMenu.js | 951 | `lf_paste_cb` | 부모 | `rerender` |
| undoRedo.js | 2252 | `executeChangeAttr` (undo/redo 속성 복원) | 부모 → `_aPromise` | `invalidate` |
| undoRedo.js | 2493 | `attachOnAfterRendering` | 여러 개 모아 돌려줌 | 호출한 쪽에서 |
| preview/index.js | 3947 | `refreshPreview` | 미리보기 root page | (호출 전 변경) |
| preview/index.js | 3981 | `refreshPreview` | 미리보기 root page | `invalidate` |
| preview/index.js | 3994 | `refreshPreview` | `UA015UI` 대상 | — |
| preview/index.js | 5159 | `drawPreview` | 미리보기 root page | — |
| preview/index.js | 5177 | `drawPreview` | 미리보기 root page | — |

모듈 안쪽 재귀 = `setOnAfterRender.js` 260 · 277 · 318 / `renderingRichTextEditor.js` 89 (RichTextEditor·자식 UI 묶음용).
`uiPreviewArea.js` 1689 = **주석 처리돼 안 돈다.**

## WS3.0.0 에만 있는 것 (디자인 영역 밖)

`www/ws30/ws10_20/js/fnUiTempWizardPopupOpen.js` 3861 · 3920 — UI 템플릿 마법사. DESIGN 저장소에는 그 폴더가 없어 없다.

## WS4.0 현황 (대조)

| | 원본 | WS4.0 |
|---|---:|---:|
| 디자인 영역 사본(`design/`) | 22 | 그대로 있음 |
| 내 HTML5 파일 | — | **2곳뿐** — 끌어다 놓기(`ws_html5_ws20_dnd.js` 1671) · UI 이동(`ws_html5_ws20_edit.js` 152) |
| 속성값 변경 | `attrChange` 1886 | **없음** (`ws_html5_ws20_attr.js` 속성 변경 함수에 호출 0건) |
| 속성 초기화 | `attrResetAttr` 2284 | **없음** |

## 어디가 `async` 였나 (장군님 질문 2026-10-19)

`await` 는 JS 문법상 `async` 안에서만 쓸 수 있다. 원본은 **네 가지 방식**으로 해결한다.

| 방식 | 곳 |
|---|---|
| ① 함수 선언 자체가 `async function` | `attrChange`(속성값 변경) · `drop_cb`(끌어다 놓기) · `designAddUIObject`(UI 추가) · `designCopyUI`(복사) · `contextMenuUiMove`(UI 이동) · `lf_paste_cb`(붙여넣기, 2곳) · `executeChangeAttr`(undo/redo) · `updateDOCAttrList` · `refreshPreview` · `drawPreview` |
| ② 함수는 그대로 두고 안에서 `return new Promise(async (resolve) => {…})` | `updateAttrList`(7227) · `designRefershModel`(5783) · 미리보기 다시 그리기(preview/index.js 3939) |
| ③ 함수는 그대로 두고 **확인창 콜백이 `async function`** | `attrResetAttr`(속성 초기화, 2152) · `lf_deleteTreeLine`(삭제, 6943) |
| ④ 기다리지 않고 **Promise 만 모아 돌려준다** — 호출한 쪽이 `Promise.all` 로 기다림 | `addMultiDelAfterRendering` · `attachOnAfterRendering`(undo/redo) |

★ 그래서 WS4.0 에 붙일 때 **속성값 변경은 ①**(함수를 `async` 로), **속성 초기화는 ③**(확인창 콜백만 `async`)이 원본과 같은 꼴이다.

## ★ 또 밟을 함정

1. **`getDomRef()` 확인을 빼면 영영 안 끝난다** — 화면에 안 떠 있는 UI 는 `onAfterRendering` 이 안 온다. 원본은 모든 호출처에서 이걸 먼저 본다.
2. **대상을 고른 UI 자신으로 잡으면 안 된다** — `invalidate` 가 부모를 다시 그리는 UI 가 많아, 자기 자신에 걸면 신호가 안 온다. 반드시 `getTargetAfterRenderingUI` 로 올라간 것을 쓴다.
3. **`invalidate` / `rerender` 는 호출처마다 다르다** — 원본이 쓴 쪽을 그대로 써야 한다(`rerender` 는 즉시, `invalidate` 는 다음 그리기 묶음).
4. 속성값 변경 함수를 고치려면 **`async` 로 바꿔야** 하고, 그 함수를 부르는 곳이 WS4.0 에 여럿 있어 전수 확인이 먼저다.

---

# 【이어 씀 2026-10-20】 원본 22곳 ↔ WS4.0 전수 대조 — 적용 대상 4곳

> 장군님 지시 「속성값 뿐만 아니라 원본에서 사용했던 setAfterRendering 사용처대로 찾아서 적용해야 되는 내용이야」
> 이번에 **WS4.0 쪽을 실측**해 22곳 전부를 ① 이미 있음 ② 없음(적용 대상) ③ 해당 없음 으로 갈랐다.

## 먼저 확인한 것 — 원본 파일 중 WS4.0 에서 실제로 도는 것

| 원본 파일 | WS4.0 에서 | 근거 |
|---|---|---|
| `uiAttributeArea.js` | **미로드** | UI5 의존. `ws_html5_ws20_attr.js` 가 데이터 로직만 이식(파일 머리 주석) |
| `uiDesignArea.js` | **미로드** | 같음. `ws_html5_ws20_edit.js` · `_dnd.js` 가 대체 |
| `callDesignContextMenu.js` | 로드됨 | `ws_html5_ws20_prev.js:1826` getScript |
| `uiPreviewArea.js` | 로드됨 | `ws_html5_ws20_prev.js:1840` getScript (단 그 안 호출처는 **주석 처리**) |
| `undoRedo/undoRedo.js` | 로드됨 | `parent.require(oAPP.oDesign.pathInfo.undoRedo)` — `ws_common.js:2009` 등 |
| `preview/index.js` | 로드됨 | 미리보기 iframe 이 `index.html` 에서 `index.js` 를 붙여 `start()` |
| `previewRender/setOnAfterRender.js` | 로드됨 | 위 두 곳 + 내 파일이 `parent.require` |

## 내 파일에 이미 있는 기다림 — 공통 함수 2개

| 파일 | 공통 함수 | 호출처 |
|---|---|---|
| `js/ws_html5_ws20_dnd.js` | `_rerenderCore`(1667) | 1265 · 1333 · 1444 · 1457 · 1634 |
| `js/ws_html5_ws20_edit.js` | `_rerenderParentRTE`(135) | 476 · 1212 · 1688 |

둘 다 원본 공통 꼴 그대로다: `getTargetAfterRenderingUI` → `getDomRef()` 확인 → `setAfterRendering` 등록 → mid 작업 → `rerender()` → `await` → `renderingRichTextEditor` 묶음 `await`.

## 22곳 전수 대조표

| # | 원본 | 기능 | WS4.0 담당 | 상태 |
|---:|---|---|---|---|
| 1 | uiAttributeArea 1886 `attrChange` | 속성값 변경 | `fnWs20AttrChange`(attr.js 4088) | ❌ **없음** |
| 2 | uiAttributeArea 2284 `attrResetAttr` | 속성 초기화 | `attrResetAttr`(attr.js 4865) | ❌ **없음** (주석 4862 「UI5 전용…생략」) |
| 3 | uiAttributeArea 6590 `updateDOCAttrList` | 속성 표 다시 그리기 | 표가 HTML, `oRTab1` 은 **더미**(attr.js 7118) | 해당 없음 |
| 4 | uiAttributeArea 7485 `updateAttrList` | 속성 표 다시 그리기 | 같음 | 해당 없음 |
| 5 | uiDesignArea 2880 `designCopyUI` | 복사 | dnd 1634 | ✅ |
| 6 | uiDesignArea 3101 `drop_cb` | 끌어다 놓기(같은 부모 순서) | dnd 1333 | ✅ |
| 7 | uiDesignArea 3503 `drop_cb` | 끌어다 놓기(이전 부모) | dnd 1444 | ✅ |
| 8 | uiDesignArea 3554 `drop_cb` | 끌어다 놓기(새 부모) | dnd 1457 | ✅ |
| 9 | uiDesignArea 4886 `addMultiDelAfterRendering` | 여러 개 삭제 | `designTreeMultiDeleteItem`(edit 1067) | ❌ **없음** (`await`·`rerender` 0건) |
| 10 | uiDesignArea 5437 `designAddUIObject` | UI 추가 | edit 1688 | ✅ |
| 11 | uiDesignArea 5735 `designRefershModel` | 속성 표 | `oRTab1` 더미 | 해당 없음 |
| 12 | uiDesignArea 6344 `lf_paste_cb` | 붙여넣기 | dnd 1265 | ✅ |
| 13 | uiDesignArea 6984 `lf_deleteTreeLine` | 한 개 삭제 | `_deleteUI`(edit 907) | ❌ **없음** (동기 함수, `await` 0건) |
| 14 | callDesignContextMenu 589 `contextMenuUiMove` | UI 이동 | edit 1212 | ✅ |
| 15 | callDesignContextMenu 966 `lf_paste_cb` | 붙여넣기 | dnd 1265 (12번과 같은 함수) | ✅ |
| 16 | undoRedo 2232 `executeChangeAttr` | undo/redo 속성 복원 | 사본 그대로 + edit 476 | ✅ |
| 17 | undoRedo 2473 `attachOnAfterRendering` | undo/redo 묶음 | 사본 그대로 돈다 | ✅ |
| 18~22 | preview/index.js 3970·4004·4017·5264·5282 | 미리보기 다시 그리기 | 사본 그대로 돈다 | ✅ |

## 적용 대상 = 4곳

| 순 | 무엇 | WS4.0 자리 | 원본 `async` 방식 |
|---:|---|---|---|
| 1 | **속성값 변경** | `fnWs20AttrChange` (attr.js 4088) | ① 함수를 `async` |
| 2 | **속성 초기화** | `attrResetAttr` (attr.js 4865) | ③ 확인창 콜백만 `async` |
| 3 | **여러 개 삭제** | `designTreeMultiDeleteItem` (edit.js 1067) | ④ Promise 모아 `Promise.all` |
| 4 | **한 개 삭제** | `_deleteUI` (edit.js 907) | ③ 확인창 콜백만 `async` |

★ 2·4 는 확인창 콜백(`lf_do`)만 `async` 로 바꾸면 되므로 **그 함수를 부르는 곳에 영향이 없다**(콜백은 반환값을 안 쓴다).
★ 3 은 원본이 Promise 를 모아 돌려주는 꼴이라 `designTreeMultiDeleteItem` 자체는 동기로 둘 수 있다.
★ **1 만 호출처 영향이 있다** — `fnWs20AttrChange` 호출처 38곳. 그래서 1 이 가장 무겁고, 2·3·4 는 그 함수 안에서 끝난다.

## 아직 안 본 것

- `callDesignContextMenu.js` 가 getScript 로 로드되는데 그 안 `contextMenuUiMove` · `lf_paste_cb` 가 WS4.0 에서 **실제로 불리는지**는 확인하지 않았다(내 파일 edit 1212 · dnd 1265 가 담당한다는 주석만 봤다). 둘 다 돌면 중복인데, 그 판정은 안 했다.
- 적용 대상 4곳에 넣은 뒤의 앱 테스트는 하지 않았다(아직 안 넣었다).

---

# 【이어 씀 2026-10-20 (2)】 규칙을 세 곳에 못 박았다

> 장군님 지시 「미리보기에 생성 추가 삭제 등 변경하는 행위가 있으면 반드시 setAfterRendering 이
> 마지막에 반영된 이후에 busy 가 꺼져야 하는 게 핵심 … 앞으로도 이런 케이스가 있으면 반드시 추가 …
> 그게 어떤 AI 를 가지고 작업하든 마찬가지」
> 「WS20 의 꽃은 미리보기다 … 미리보기가 완전히 다 그려진 이후에 busy 를 꺼야 되는 게 목표」

## 넣은 자리 3곳

| 파일 | 무엇 |
|---|---|
| `.analy/05_디자인영역.md` §4-3 뒤 | 8종 표(소스 주석 원문 + 파일:줄) · 지켜야 하는 순서 7단계 · 또 밟을 함정 5개 |
| `CLAUDE.md` 최우선 규칙 | 한 덩어리 — 8종 이름과 「다 그려진 뒤 busy off」, 상세는 `.analy/05` §4-3 링크 |
| `.claude/rules/code.md` | 코드 저장 직전 체크 한 덩어리 (PreToolUse hook 이 `.js` 저장 전에 주입) |

★ `CLAUDE.md` 는 프로젝트 루트에 체크인돼 있어 **다른 AI 도구도 읽는다.** `.claude/rules/code.md` 는
Claude Code 전용이라 그것만으로는 모자라서 세 곳에 나눠 박았다.

## 용어 통일 (장군님 지시 — 지어낸 한글 금지)

미리보기를 바꾸는 호출 **8종은 함수 이름 그대로** 부른다. 한글 별명을 붙이지 않는다.
`previewUIsetProp` · `addUIObjPreView` · `prevRemoveUiObject` · `moveUIObjPreView` ·
`createUIInstance` · `reCreateUIObjInstance` · `destroyExcepChild` · `redrawUIScript`.
기다리는 쪽은 `setAfterRendering` · `getTargetAfterRenderingUI` · `renderingRichTextEditor`.

## 장군님 결정 2건 (2026-10-20)

1. **원본 모듈 `design/js/previewRender/setOnAfterRender.js` 는 손대지 않는다.**
   조합 함수가 필요하면 내 파일(`js/ws_html5_ws20_prev.js`)에 `oAPP.fn.` 으로 올린다.
2. 내가 「원본에 공통 구조가 없다」고 한 판정은 **틀렸다** — 원본은 이미 그 모듈로 공통화해 놨고
   (`_oRender = parent.require(oAPP.oDesign.pathInfo.setOnAfterRender)`), 호출처는 그 모듈 함수
   2개를 조합해 쓰는 것뿐이다. 모듈이 내주는 함수 4개 = 15 · 93 · 180 · 192행.

## 원본도 같은 코드를 15군데 복사해 놨다 (실측)

`getTargetAfterRenderingUI` 가 나오는 곳 = `uiDesignArea.js` 7 · `uiAttributeArea.js` 2 ·
`callDesignContextMenu.js` 2 · `undoRedo/undoRedo.js` 2 · `preview/index.js` 1
(+ `uiPreviewArea.js:1677` 은 주석 처리돼 안 돈다). **원본에 조합 함수는 없다.**
`uiDesignArea.js` 3088행과 3490행은 들여쓰기만 다르고 글자가 같다.

→ 그래서 빠뜨림의 원인은 「WS4.0 에 2벌이라서」가 아니라 **원본 15군데를 하나하나 옮기는 작업이었고
그중 4곳을 안 옮긴 것**이다.

## 아직 안 한 것

- 빠진 4곳(속성값 변경 · 속성 초기화 · 여러 개 삭제 · 한 개 삭제)에 **아직 코드를 넣지 않았다.**
- 조합 함수를 내 파일에 올리는 것도 **아직 안 했다**(장군님 승인 대기).

---

# 【이어 씀 2026-10-20 (3)】 ★핵심★ 규칙 확정 — 정식 기록

> 장군님 「나중에 이와 관련해서 질문할 거니까 잘 이력 남겨서 기록해놔. 핵심 내용이야」

## 요청 (장군님 말 그대로)

> 「미리보기에 생성 추가 삭제 등 **변경하는 행위가 있으면 반드시 `setOnAfterRender` 가 마지막에
> 반영이 된 이후에 busy 가 꺼져야** 하는 게 핵심이야. 그게 안 되어 있는 부분은 반드시 반영해야 되고
> 앞으로도 이런 케이스가 있을 경우는 반드시 추가가 되어야 하는 거야.
> **그게 어떤 AI 를 가지고 작업하든 마찬가지**라고.」
>
> 「**ws20 의 꽃은 미리보기**이고, 다른 영역에서 UI 를 추가하든 변경하든 속성값을 추가하든 변경하든
> 최종적으로는 미리보기에 반영되는 내용이고, **미리보기에 반영돼서 미리보기가 완전히 반영이 되어
> 다 그려진 이후에 busy 를 꺼야 되는 게 목표**다.」

## 변경 내용

규칙을 **세 곳**에 박았다. 코드는 아직 안 고쳤다.

| 파일 | 넣은 것 |
|---|---|
| `.analy/05_디자인영역.md` (§4-3 뒤) | 8종 표(소스 주석 원문 + 파일:줄) · 지켜야 하는 순서 7단계 · 또 밟을 함정 5개 · 원본 모듈 수정 금지 |
| `CLAUDE.md` (최우선 규칙) | 한 덩어리 — 「미리보기 바꿨으면 다 그려진 뒤 busy off」 + 8종 이름 + `.analy/05` §4-3 링크 |
| `.claude/rules/code.md` (코드 저장 직전) | 같은 규칙을 순서 형태로 — `.js` 저장 전에 hook 이 주입 |

## 변경 파일

- 변경: `.analy/05_디자인영역.md` · `CLAUDE.md` · `.claude/rules/code.md` · `.docs/TODO.md`(1B-2 행)
- 변경: 이 이력 파일 (이어 씀 (1)(2)(3))
- 추가·삭제: 없음

## 변경 이유 — 왜 세 곳인가

- `CLAUDE.md` = **프로젝트 루트에 체크인**돼 있어 Claude 아닌 다른 AI 도구도 읽는다. 「어떤 AI 로
  작업하든」이라는 장군님 조건을 만족하는 유일한 자리.
- `.claude/rules/code.md` = Claude Code 전용이지만 **`.js` 저장 직전에 강제로 보인다**(PreToolUse hook).
  읽고 잊는 것을 막는 자리.
- `.analy/05_디자인영역.md` = 이 프로젝트의 **UX·변환 SSOT**. 순서·함정 같은 상세는 여기 한 곳에만 둔다.

→ 한 곳에만 두면 그 한 곳을 안 읽는 경로가 생긴다. 그래서 **진입 지점 3개에 나눠 박고 상세는 한 곳**.

## 영향 범위

문서만 바꿨다. **실행 코드 변경 0.** 앱 동작은 그대로다.

## 검증

- 세 파일에 글이 들어갔는지 직접 읽어 확인(아래 참고 사항의 확인 명령).
- 코드를 안 고쳤으므로 `node --check` 대상 없음. 앱 테스트 없음.

## ★ 나중에 물으실 때 바로 답할 수 있게 — 핵심 사실 5개

1. **목표** = 「미리보기를 바꿨으면 `setAfterRendering` 으로 다 그려짐을 기다린 뒤 busy off」.
   busy 를 먼저 끄면 그 틈에 연타가 들어오고, 사용자는 다 안 그려진 화면을 조작한다.
2. **미리보기를 바꾸는 호출은 8종**이고 **9개 파일**에 흩어져 있다(이어 씀 (1) 의 표).
3. **원본은 조합 함수를 안 만들고 15군데에 같은 코드를 복사**해 놨다. 모듈
   (`design/js/previewRender/setOnAfterRender.js`)로 공통화한 것은 `setAfterRendering` ·
   `getTargetAfterRenderingUI` · `renderingRichTextEditor` · `previewThemeChanged` **4개 함수까지**다.
4. **WS4.0 에 빠진 곳은 4곳** — ①속성값 변경(`fnWs20AttrChange`) ②속성 초기화(`attrResetAttr`)
   ③여러 개 삭제(`designTreeMultiDeleteItem`) ④한 개 삭제(`_deleteUI`).
   ②③④ 는 **호출처 영향 0**, ①만 호출처 38곳에 걸린다.
5. **원본 모듈은 수정 금지**(장군님 2026-10-20). 조합이 필요하면 내 파일에서 그 모듈 함수를 부른다.

## 참고 사항 — 버린 방법 · 정정한 판정 · 아직 안 한 것

**버린 방법**
- 원본 모듈 `setOnAfterRender.js` 에 조합 함수를 추가하는 안 → **장군님 「원본 모듈은 놔둬」로 기각.**
- 조합 함수를 새 파일로 만드는 안 → 안 했다. 하게 되면 `js/ws_html5_ws20_prev.js` 에 `oAPP.fn.` 으로
  올린다(그 파일이 `_edit`·`_dnd` 보다 먼저 로드됨 — `js/library-preload.js` 187 · 191 · 197행).
- 디자인 tree 를 매번 다시 그리는 안 → **2026-10-19 에 장군님이 「넣지 말 것」으로 확정.**

**내가 틀렸다가 정정한 판정 (같은 실수 되풀이 말 것)**
- ❌ 「WS4.0 에 기다림 코드가 2벌이라서 빠뜨렸다」 → ⭕ **원본이 15군데에 복사해 놨고 그걸 하나하나
  옮기는 작업이었는데 4곳을 안 옮긴 것.** WS4.0 은 옮긴 것들을 2개 파일에서 함수로 묶어 원본보다
  중복이 적다(단 그 함수들은 파일 밖에서 못 불린다).
- ❌ 「공통 함수를 만드는 건 원본에 없는 구조」 → ⭕ **원본도 이미 모듈로 공통화해 놨다.**
  호출처가 그 모듈 함수 2개를 조합해 쓰는 것뿐이다.
- ❌ 지어낸 한글(「값 꽂기」·「인스턴스 생성」·「재생성」·「임시자식 정리」·「script 다시 그리기」)
  → ⭕ **함수 이름 그대로.** 장군님이 「이게 다 무슨 말인지 모르겠음」이라 하셨다.

**아직 안 한 것 / 안 정한 것**
- 빠진 4곳에 **코드를 아직 넣지 않았다**(장군님 승인 대기 = TODO 1B-2).
- ①속성값 변경은 **원작자 지시서**가 와 있고, 원본처럼 `attrChange` / `attrChangeProc` 두 함수로
  쪼갤지 / 지시서대로 합친 함수 하나에 기다림만 넣을지 **아직 안 정했다.**
- 조합 함수를 내 파일에 올릴지도 **아직 승인 안 받았다.**
- `callDesignContextMenu.js` 가 getScript 로 로드되는데 그 안 `contextMenuUiMove`·`lf_paste_cb` 가
  WS4.0 에서 **실제로 불리는지 확인하지 않았다**(내 파일 `_edit` 1212 · `_dnd` 1265 가 담당한다는
  주석만 봤다). 둘 다 돌면 중복인데 그 판정은 안 했다.
- 느린 PC 에서의 대기 시간 측정 안 함. 앱 테스트 안 함.

**확인 명령** (이 규칙이 세 곳에 있는지)
```bash
grep -n "다 그려진 뒤에 busy" CLAUDE.md .claude/rules/code.md ".analy/05_디자인영역.md"
```

---

# 【이어 씀 2026-10-20 (4)】 작업 대상 산출 — 6곳

> 장군님 지시 「그러면 이제 작업해야 할 부분을 산출해」
> ★이번에는 **원본 22곳 기준이 아니라 WS4.0 에서 미리보기를 바꾸는 호출이 있는 자리 전부**를 훑었다.
> 장군님 목표가 「미리보기를 바꾸는 행위가 있으면 반드시」이므로 원본에 없는 자리도 대상이 된다.

## 산출 방법 (실측)

1. 미리보기를 바꾸는 호출 이름을 **15개**로 넓혔다 — 앞서 적은 8종 + 이번에 찾은
   `delUIObjPreView` · `destroyUIPreView` · `setChildUiException` · `setRichTextEditorException` ·
   `setUIParent` · `refreshPreview` · `drawPreview`.
   ★**앞의 8종 목록은 불완전했다.** 삭제 경로(`_removeNodePreview`)가 8종에 없는 함수 3개를 쓰고 있었다.
2. 내 파일(`js/*.js`) 전체에서 그 15개를 부르는 줄을 뽑고(주석·`typeof` 가드 제외),
   **각 줄이 든 함수**와 그 함수에 기다림(`setAfterRendering` / `_rerenderCore` / `_rerenderParentRTE`)이
   있는지 짝지었다.
3. 「기다림 없음」으로 나온 것은 **부르는 쪽까지 올라가** 다시 확인했다(아래 「대상 아님」 참조).

## 파일별 건수 (실측)

| 파일 | 변경 호출 | 기다림 |
|---|---:|---:|
| `ws_html5_ws20_edit.js` | 65 | 8 |
| `ws_html5_ws20_dnd.js` | 38 | 14 |
| `ws_html5_ws20_prev.js` | 30 | 0 (전부 주석·가드 — 실제 호출 0) |
| `ws_html5_ws20_attr.js` | 18 | 0 (2건은 주석) |
| `fnAttrPresetSettingsOpen.js` | 8 | 0 |
| `fnSameAttrSyncPopupOpen.js` | 5 | 0 |
| `ws_html5_shell.js` · `ws_html5_ws20.js` · `ws_html5_ws20_wizard.js` | 2·2·1 | 0 (전부 주석) |

## ★ 작업 대상 6곳

| # | 자리 | 사용자 조작 | 바꾸는 호출 | 원본에 기다림 | 호출처 영향 |
|---:|---|---|---|---|---|
| 1 | `js/ws_html5_ws20_attr.js:4088` `fnWs20AttrChange` | 속성 값칸에 값 입력 | `previewUIsetProp` | **있음**(`attrChange` 1886) | **38곳** |
| 2 | `js/ws_html5_ws20_attr.js:4865` `attrResetAttr` | 속성 초기화 | 1번 경유 | **있음**(`attrResetAttr` 2284) | 0 |
| 3 | `js/ws_html5_ws20_edit.js:907` `_deleteUI` | 트리에서 UI 한 개 삭제 | `delUIObjPreView`·`destroyUIPreView`·`setChildUiException` | **있음**(`lf_deleteTreeLine` 6984) | 0 |
| 4 | `js/ws_html5_ws20_edit.js:1067` `designTreeMultiDeleteItem` | 체크박스로 여러 개 삭제 | 같음 | **있음**(`addMultiDelAfterRendering` 4886) | 0 |
| 5 | `js/fnAttrPresetSettingsOpen.js:54` `_preview` | 속성 별창에서 값 적용 | `previewUIsetProp` | **없음** | 0 |
| 6 | `js/fnSameAttrSyncPopupOpen.js:102` `_preview` | 동일 속성 적용 팝업에서 일괄 적용 | `previewUIsetProp` | **없음** | 0 |

- **1~4 = 원본에 있는데 WS4.0 에 안 옮긴 것.** 원본대로 넣으면 된다.
- **5~6 = 원본에도 없다.** 장군님 목표(「미리보기를 바꿨으면 반드시」)에 따르면 대상이지만,
  **원본 1:1 을 벗어난다** → 장군님 판단이 필요하다.
- **1 만 호출처 38곳에 걸린다.** 2~6 은 그 함수 안에서 끝난다.

## 대상 아님으로 판정한 것 (부르는 쪽이 이미 기다린다 — 근거)

| 자리 | 왜 아닌가 |
|---|---|
| `edit.js:266` `_prevCreateInstanceDeep` · `285` `_prevCreateSubtree` · `_applyAttrPreview`(375) | 되돌리기 본체가 435행에서 부르고 **476행 `_rerenderParentRTE`** 로 기다린다 |
| `edit.js:616` `_commitState` 안 `drawPreview` | `await w.drawPreview()` — `drawPreview` 자체가 `design/preview/index.js` 5264·5282 에서 `setAfterRendering` 으로 기다린다 |
| `edit.js:864` `_removeNodePreview` | 정의만. 부르는 쪽이 3·4번 → **거기서 처리하면 같이 해결** |
| `edit.js:166` `designSetActionIcon` | `drawPreview` 가 **주석에만** 있다 |
| `dnd.js:708` `prevRemoveUiObject` 정의 | 부르는 쪽(`_exit` 1289 등)에 기다림 있음 |
| `attr.js:3499` `fnWs20DesignTreeItemPress` (트리에서 UI 선택) | `redrawUIScript`(3555)는 동기지만 **그 뒤 3564행 `await oWin.refreshPreview(oNode)`** 가 있고 `refreshPreview` 는 `async`(`design/preview/index.js:3957`)로 안에서 `setAfterRendering` 한다 |

## 아직 안 본 것

- 5·6번 팝업이 **busy 를 켜는지** 확인하지 않았다. 안 켜면 기다림을 넣어도 busy 와 무관하다.
- `design/` 사본 안쪽(`callDesignContextMenu.js`·`undoRedo/undoRedo.js`·`preview/index.js`)은 원본 그대로
  돌고 기다림이 들어 있으므로 이번 산출에서 뺐다. 그 안에서 새로 빠진 자리가 있는지는 안 봤다.
- 코드는 **한 줄도 고치지 않았다.**

---

# 【이어 씀 2026-10-20 (5)】 ★최종★ 작업 대상 산출 — WS4.0 현재 기준 9곳

> 장군님 지시 「원본 대비해서 산출하는 게 아니라 어쩔 수 없이 **현재 ws4.0 에 되어 있는 기준**으로
> 산출해야 돼. 미리보기 렌더링 종료 감지 로직을 넣어야 할 부분을 산출하라고」
> ★ (4) 의 산출은 원본에 있나를 기준으로 갈랐다 → **이 (5) 가 최종이다.** 기준은 「WS4.0 에서
> 미리보기를 바꾸는데 렌더링 종료 감지가 없는 자리」 하나뿐. 원본에 있든 없든 전부 대상.

## 훑은 범위 (원본 폴더는 안 봤다 — WS4.0 만)

1. 내 파일 전체 `www/ws30/ws10_20/js/*.js`
2. **WS4.0 이 실제로 로드하는 사본 파일** — `getScript` / `parent.require` / iframe 을 grep 해 확정:
   `design/js/callBindPopup.js` · `callDAMISampleDownloadPopup.js` · `callDesignContextMenu.js` ·
   `callDesignLayoutChangePopup.js` · `callF4HelpPopup.js` · `changeAppPackagePopup.js` ·
   `createApplicationPopup.js` · `createEventPopup.js` · `uiPreviewArea.js` · `designCallWizardPopup.js` ·
   `design/undoRedo/undoRedo.js` · `design/bindPopupHandler/broadcastChannelBindPopup.js` ·
   `design/preview/index.js`
   → `uiAttributeArea.js` · `uiDesignArea.js` 는 **로드되지 않아 제외**(UI5 의존).
3. 미리보기를 바꾸는 호출 이름 **17개**로 훑었다 — 앞의 15개 + `previewUIaddStyleClass` · `prevStyleClassApply`.

## ★ 작업 대상 9곳

### 내 파일 (6)

| # | 사용자 조작 | 함수 · 자리 | 바꾸는 호출 |
|---:|---|---|---|
| 1 | 속성 값칸에 값 입력 | `fnWs20AttrChange` — `js/ws_html5_ws20_attr.js:4088` | `previewUIsetProp` |
| 2 | 속성 초기화 | `attrResetAttr` — `js/ws_html5_ws20_attr.js:4865` | 1번 경유 |
| 3 | 트리에서 UI 한 개 삭제 | `_deleteUI` — `js/ws_html5_ws20_edit.js:907` | `delUIObjPreView`·`destroyUIPreView`·`setChildUiException` |
| 4 | 체크박스로 여러 개 삭제 | `designTreeMultiDeleteItem` — `js/ws_html5_ws20_edit.js:1067` | 같음 |
| 5 | 속성 별창에서 값 적용 | `_preview` — `js/fnAttrPresetSettingsOpen.js:54` | `previewUIsetProp` |
| 6 | 동일 속성 적용 팝업에서 일괄 적용 | `_preview` — `js/fnSameAttrSyncPopupOpen.js:102` | `previewUIsetProp` |

### 사본 (3) — WS4.0 이 실제 로드하는 파일

| # | 사용자 조작 | 함수 · 자리 | 바꾸는 호출 |
|---:|---|---|---|
| 7 | UI 템플릿 마법사로 UI 생성 | `createUiLine` — `design/js/designCallWizardPopup.js:367` | `addUIObjPreView` |
| 8 | DAMI 샘플 내려받기 | `lf_createUIInstance`(749) · `lf_setUIScript`(1105) — `design/js/callDAMISampleDownloadPopup.js` | `createUIInstance` |
| 9 | 바인딩 팝업에서 값 바꿈 (**미확인**) | `updateAppData` — `design/bindPopupHandler/broadcastChannelBindPopup.js:248` | `previewUIsetProp` |

★ 9번은 **아직 WS20 과 배선이 안 됐을 수 있다** — `js/fnDialogPopupOpener.js:1024` 주석에
「updateAppData 등은 아직 WS20 디자인 앱과 안 맞음 → Stage6 에서 정합 배선」이라 적혀 있다.
**실제로 도는지 확인하지 않았다.**

## 감지가 이미 있어 대상 아님 (근거)

| 자리 | 왜 아닌가 |
|---|---|
| 끌어다 놓기 5경로 (`js/ws_html5_ws20_dnd.js` 1265·1333·1444·1457·1634) | `_rerenderCore` 로 감지 |
| UI 추가 · UI 이동 · 되돌리기 (`js/ws_html5_ws20_edit.js` 1688·1212·476) | `_rerenderParentRTE` 로 감지 |
| 트리에서 UI 선택 (`js/ws_html5_ws20_attr.js:3499`) | `redrawUIScript`(3555) 뒤 **3564행 `await oWin.refreshPreview()`** — `refreshPreview` 는 `async`(`design/preview/index.js:3957`)로 안에서 감지 |
| 되돌리기 전체 재생성 (`js/ws_html5_ws20_edit.js:616` `_commitState`) | `await w.drawPreview()` — `drawPreview` 가 `design/preview/index.js` 5264·5282 에서 감지 |
| 끌어다 놓기 중 aggregation 문자열 변경 (`previewSetStrAggr` — `js/ws_html5_ws20_dnd.js:1389`) | 같은 경로 1444행에서 감지 |
| 우클릭 메뉴 (`design/js/callDesignContextMenu.js`) | 그 파일 자체에 감지 2곳 |
| 되돌리기/다시하기 (`design/undoRedo/undoRedo.js`) | 그 파일 자체에 감지 3곳 |
| 미리보기 전체 그리기 (`design/preview/index.js`) | 그 파일 자체에 감지 5곳 |
| `prevRemoveUiObject` · `reCreateUIObjInstance` 정의 | 정의만. **사본 `design/js/uiPreviewArea.js:1662` 가 나중에 로드돼 내 `js/ws_html5_ws20_dnd.js:708` 정의를 덮는다**(getScript 가 preload 보다 나중). 어느 쪽이든 부르는 쪽에 감지가 있다 |
| 미리보기 처음 로드 (`loadPreviewFrame`) | WS4.0 은 `js/ws_html5_ws20_prev.js` 가 담당하며 거기 busy 관리가 따로 있다. **그 안을 끝까지 보지는 않았다** |

## 일 크기

| 구분 | 건수 | 호출처 영향 |
|---|---:|---|
| 호출처 영향 0 (그 함수 안에서 끝) | **8곳** (2~9) | 없음 |
| 호출처 38곳이 걸리는 것 | **1곳** (1번 속성값 변경) | `fnWs20AttrChange` 호출처 38곳 |

## 아직 안 한 것

- 코드는 **한 줄도 고치지 않았다.**
- 9번이 실제로 도는지 **확인 안 함**.
- 5~9 번 자리가 busy 를 켜는지 **확인 안 함** — 안 켜면 감지를 넣어도 busy 타이밍과는 무관하다.
- `js/ws_html5_ws20_prev.js` 안(변경 호출 30건, 전부 주석·가드로 판정)은 **그 판정만 했고 본문을 끝까지 읽지 않았다.**

---

# 【이어 씀 2026-10-20 (6)】 ★★★ 한 줄 규칙 — 프로세스의 「마지막 로직」 (장군님 지시)

> 「UI 관련된 내용을 **추가·변경·삭제** 시 각 프로세스에서 **가장 마지막에는 반드시 미리보기에 반영**하는
> 것이고, 미리보기에 반영이 된 이후에는 **미리보기 렌더링이 끝난 이후에 busy 가 꺼지는** 거야.
> **이 내용이 항상 각 프로세스의 마지막 로직이어야 되는 거야.**」

```
 … 데이터 바꾸기 …
 → ① 미리보기에 반영
 → ② 미리보기 렌더링 종료 감지 (setAfterRendering 로 await)
 → ③ busy off (parent.setBusy(""))
```

- ②를 빼고 ③을 먼저 하면 **다 안 그려진 화면에 조작이 열린다.**
- ①②③ 사이에 다른 로직을 끼우지 않는다.
- 이 문장을 **세 문서에 그대로 넣었다** — `CLAUDE.md` · `.claude/rules/code.md` ·
  `.analy/05_디자인영역.md` §4-3. (확인: 세 파일 모두 1건)

이 규칙이 (5) 에서 산출한 9곳의 **수용 기준**이다. 각 자리를 고쳤다고 하려면
그 프로세스의 끝이 ①②③ 순서로 되어 있어야 한다.

---

# 【이어 씀 2026-10-20 (7)】 정정 — 8번은 대상이 아니다. **최종 8곳**

> 장군님 질문 「8 ← 이 프로세스에서도 미리보기와 관련된 내용이 있어?」

## 틀린 것 — (5) 의 8번을 뺀다

`design/js/callDAMISampleDownloadPopup.js` 의 `lf_createUIInstance`(749) · `lf_setUIScript`(1105) 는
**미리보기를 건드리지 않는다.** 주석 「UI 생성 SCRIPT 구성」 그대로, 내려받을 샘플 파일에 들어갈
**JavaScript 글자를 이어 붙여 `return` 하는 함수**다 (`"var BUTTON1 = new sap.m.Button({...});"`).
미리보기 iframe 도, `oAPP.attr.prev` 도 만지지 않는다.

**왜 틀렸나: 함수 이름에 `createUIInstance` 가 들어 있다는 것만 보고 넣었다.**
grep 으로 이름을 잡은 뒤 **그 함수 본문을 읽지 않았다.**

★ **또 밟을 함정: 미리보기 변경 호출을 이름으로 찾은 뒤에는 반드시 그 함수 본문을 읽어
「정말 미리보기(iframe / `oAPP.attr.prev`)를 만지는가」를 확인한다.** 이름이 같아도
글자를 만들어 돌려주기만 하는 함수가 있다.

## 7번·9번은 확인했다 — 둘 다 대상 맞다

| # | 자리 | 근거 |
|---:|---|---|
| 7 | `design/js/designCallWizardPopup.js` `createUiLine`(367) | **453행에서 `oAPP.attr.ui.frame.contentWindow.addUIObjPreView(...)` 를 실제로 호출** |
| 9 | `design/bindPopupHandler/broadcastChannelBindPopup.js` `updateAppData`(248) | **308행 `oAPP.fn.previewUIsetProp(_s0015)` 실제 호출 + 350행 `parent.setBusy("", {})` 로 busy off** — 즉 ①은 있고 ②가 없는 채 ③을 한다 |

★ 9번은 진입부 `parent.setBusy("X")` 가 **주석 처리**돼 있다(258~259행).
켜는 쪽이 어디인지(바인딩 팝업이 방송으로 켜는지)는 **확인하지 않았다.**

## ★ 최종 작업 대상 8곳

| # | 사용자 조작 | 자리 |
|---:|---|---|
| 1 | 속성 값칸에 값 입력 | `js/ws_html5_ws20_attr.js:4088` `fnWs20AttrChange` |
| 2 | 속성 초기화 | `js/ws_html5_ws20_attr.js:4865` `attrResetAttr` |
| 3 | UI 한 개 삭제 | `js/ws_html5_ws20_edit.js:907` `_deleteUI` |
| 4 | 체크박스로 여러 개 삭제 | `js/ws_html5_ws20_edit.js:1067` `designTreeMultiDeleteItem` |
| 5 | 속성 별창에서 값 적용 | `js/fnAttrPresetSettingsOpen.js:54` `_preview` |
| 6 | 동일 속성 적용 팝업에서 일괄 적용 | `js/fnSameAttrSyncPopupOpen.js:102` `_preview` |
| 7 | UI 템플릿 마법사로 UI 생성 | `design/js/designCallWizardPopup.js:367` `createUiLine` |
| 8 | 바인딩 팝업에서 값 바꿈 | `design/bindPopupHandler/broadcastChannelBindPopup.js:248` `updateAppData` |

(옛 8번 = DAMI 샘플 내려받기 → **삭제**. 옛 9번이 새 8번이 됐다.)

---

# 【이어 씀 2026-10-20 (8)】 코드 작업 — 8곳 중 7곳 완료, ①만 남음

> 장군님 지시 「작업해라」 + 「미리보기 랜더링 완료 라는 내용으로 로그를 남겨라」
> + 「고칠 때는 호출처를 잘 보고 sync·async 로직 철저히 분석해서 넣어야 한다 — 그거 깨지면 작살난다」

## 만든 것 — 공통 감지 함수 2개 (`js/ws_html5_ws20_prev.js`)

| 이름 | 쓰는 곳 | 다시 그리기 |
|---|---|---|
| `oAPP.fn.fnWs20AwaitPrevRender(parentNode, midFn, sWhere)` | 부모 1개 | `rerender()` |
| `oAPP.fn.fnWs20AwaitPrevRenderMulti(aParentNodes, midFn, sWhere)` | 부모 여러 개 | **`invalidate()`** |

- 순서는 원본 호출처 15군데와 동일: `getTargetAfterRenderingUI` → `getDomRef()` 확인 →
  `setAfterRendering` 등록 → midFn(미리보기 반영) → `rerender()`/`invalidate()` → `await` →
  `renderingRichTextEditor` 묶음 `await`.
- **원본 모듈 `design/js/previewRender/setOnAfterRender.js` 는 한 줄도 안 고쳤다**(장군님 지시) — 부르기만 한다.
- ★두 개로 나눈 까닭: **원본이 자리마다 `rerender` 와 `invalidate` 를 달리 쓴다.**
  단건 삭제(원본 7069)·끌어다 놓기는 `rerender()`, 멀티 삭제(원본 4913)·속성 초기화(원본 2291)는 `invalidate()`.
  규칙(원본이 쓴 쪽을 그대로)대로 맞췄다.

## 로그 — 「미리보기 렌더링 완료」

```
[PREV] preview rendering done at=<자리> how=AWAITED 134ms 14:22:07.531
```
- 이 줄 **뒤**에 기존 busy 종료 로그(`[BUSY] on→off=…`)가 찍히면 순서가 맞은 것이다.
- 개발 모드에서만 찍는다(`parent.REMOTE.app.isPackaged === false`). 확인이 끝나면 `_logSettled` 블록만 지운다.
- `how` = `AWAITED`(기다렸다) / `NO_DOM`(대상이 화면에 없어 등록 안 함) / `NO_PARENT` / `NO_PREVIEW` / `NO_MODULE`.

## 넣은 7곳

| # | 자리 | 호출처 sync/async 처리 |
|---:|---|---|
| 2 | `js/ws_html5_ws20_attr.js:4958` 속성 초기화 | 확인창 콜백을 `async` 로. 확인창은 콜백 반환값을 안 쓴다(`resources/index.js` 의 `lf_cb`). 콜백 본문이 이미 `try/catch/finally` 라 예외도 잡히고 `finally` 에서 busy 가 풀린다 |
| 3 | `js/ws_html5_ws20_edit.js:952` UI 한 개 삭제 | `lf_do` 는 **동기로 남기고** 안쪽 `_lf_doAsync` 를 async 로 분리 + `.catch` 로 잠금 해제(`[W20E-003]`). 확인창 호출처 영향 0 |
| 4 | `js/ws_html5_ws20_edit.js:1166` 여러 개 삭제 | 같은 방식(`_lf_doMultiAsync` + `.catch` `[W20E-004]`). 감지 대상은 **살아남는 부모만** — 부모·조상이 체크됐으면 제외(원본 `deleteCheckedLine` 4756 대응) |
| 5 | `js/fnAttrPresetSettingsOpen.js:301` 속성 별창에서 값 적용 | `lf_apply` 가 **이미 async** 였다 — `await` 만 추가. `finally` 에서 busy off |
| 6 | `js/fnSameAttrSyncPopupOpen.js:476` 동일 속성 적용 팝업 | `lf_setSyncAttr` 를 `async` 로. 호출처는 확인 버튼 클릭 1곳(714) → `.catch` 로 받아 잠금 해제. 일괄 적용이라 `_preview` 가 반영한 OBJID 를 모아 부모 목록으로 한 번에 기다린다 |
| 7 | `js/ws_html5_ws20_wizard.js:243` UI 템플릿 마법사 | **사본을 안 고쳤다** — 생성 헬퍼(`createUiLine`)는 UI 한 줄마다 동기로 여러 번 불리고 상위가 반환값을 바로 써서 거기서는 못 기다린다 → 전부 끝난 뒤 `_wizFinish` 의 첫 `.then` 에서 한 번. Promise 체인이라 호출처 영향 0 |
| 8 | `design/bindPopupHandler/broadcastChannelBindPopup.js:353` 바인딩 팝업 방송 수신 | 그 함수가 **이미 `async`** 였다 — `sendBindPopupBusyOff()` 앞에 `await` 추가. 사본이지만 그 함수는 파일 안 `function` 이라 밖에서 감쌀 수 없어 직접 넣었다(`[BCBP-01]`) |

## ★ sync/async 검증 — 실제로 본 것

| 호출처 | 콜백 반환값을 쓰나 | 판정 |
|---|---|---|
| `js/ws_html5_shell.js:486` `fnConfirmBox` | `try { fnCallback(sAct); } catch` — **안 쓴다** | async 콜백 안전 |
| `theme/u4a-ui.js:2440` `U4AUI.confirm` | `try { fnCb(sAct); } catch` — **안 쓴다** | 안전 |
| `resources/index.js` `showMessage` 의 `lf_cb` | `try { fnCb(sAct); } catch` — **안 쓴다** | 안전 |
| `fnSameAttrSyncPopupOpen.js:714` 확인 버튼 | `function () { lf_setSyncAttr(); }` — 안 쓴다 | 안전(그래도 `.catch` 추가) |

★ **공통 함정: async 가 던지는 예외는 호출처의 `try/catch` 가 못 잡는다**(Promise 로 가므로).
그래서 바꾼 모든 자리에서 **스스로 잡고 잠금(busy·단축키)을 해제**하게 했다.

## 남은 1곳 — ① 속성값 입력 (`js/ws_html5_ws20_attr.js:4088` `fnWs20AttrChange`)

**안 건드렸다.** 이유: 호출처 **38곳**이고, 그중 `js/fnStyleClassPopupOpen.js:160` 은
`try { fnWs20AttrChange(...) } catch { 값 롤백 }` 구조다 — 이 함수를 `async` 로 바꾸면
**그 `catch` 가 예외를 못 잡아 값 롤백이 무력화된다.** 원본(`styleClassPopup.js:107`)에는 그 보호가 없다.
→ **장군님 결정이 필요하다**(원본처럼 두 함수로 쪼갤지 / 지시서대로 합친 함수에 기다림만 넣을지 /
   `fnStyleClassPopupOpen` 쪽 보호를 어떻게 할지).

①이 바인딩 걸기·풀기·속성 컨텍스트 메뉴 값 변경까지 **세 경로를 덮는다**(2026-10-20 (7) 확인).

## 검증

- 바꾼 7개 파일 전부 `node --check` 통과.
- **앱으로 테스트하지 않았다** — 장군님이 직접 돌려 `[PREV] preview rendering done` 뒤에
  `[BUSY] on→off=…` 가 오는지 확인하셔야 한다.
- 느린 PC 측정 안 함.

## ★ 또 밟을 함정

1. **원본이 `rerender` 를 쓴 자리에 `invalidate` 를 쓰면(또는 반대) 원본과 달라진다.** 헬퍼 2개를 자리에 맞게 골라야 한다.
2. **멀티 삭제 감지 대상에 「지워질 노드」를 넣으면 신호가 안 온다** — 그 노드가 사라지므로. 부모·조상 체크 여부를 봐야 한다.
3. **확인창 콜백을 async 로 바꿀 때는 반드시 스스로 예외를 잡아야 한다** — 호출처 `try/catch` 가 못 잡는다.

---

# 【이어 씀 2026-10-20 (9)】 ① 속성값 입력 — 원본처럼 두 함수로 쪼갰다

> 장군님 승인 「진행해」 + 「호출처 철저히 분석해서 사이드 이펙트 없게」
> + 「소스에 가정·추측 로직 금지」 + 「함수 이름으로만 판단 말고 실제 소스를 처음부터 끝까지 읽고 판단」

## 쪼갠 결과 (`js/ws_html5_ws20_attr.js`)

| 함수 | 성격 | 원본 대응 | 내용 |
|---|---|---|---|
| `oAPP.fn.fnWs20AttrChangeProc(sAttr, uityp)` (4099) | **동기** | `attrChangeProc`(1929) | 값 반영 본문. 반환 `{ ok, attr }` — `ok=false` 는 입력값 점검 실패(fail-closed), `attr` 은 모델의 실제 T_ATTR 줄 |
| `oAPP.fn.fnWs20AttrChange(...)` (4228) | **async** | `attrChange`(1781) | 앞 관문(가드·busy·undo·전용 예외처리) → Proc 호출 → **미리보기 렌더링 종료 감지** → 뒤 마무리 → `finally` 잠금 해제 |

감지는 원본 1872~1897 과 같은 자리·같은 방식(**`invalidate()`** → `await`)이라 Multi 쪼 헬퍼를 쓴다.
**호출처 이름은 한 곳도 안 바꿨다** — 전부 `fnWs20AttrChange` 를 그대로 부른다.

## ★ 사이드 이펙트 실측과 처리 — 재진입 가드

`fnWs20AttrChange` 가 async 가 되면서 `[BR34]` 재진입 가드(`_fnAttrChangeBusy`)가 **`await` 동안 계속 잠겨 있다.**
그래서 **연달아 두 번 부르는 자리는 두 번째가 무시돼 값이 누락된다.** 전수로 찾아 `await` 로 고쳤다.

| 함수 | 파일 | 호출 수 | 처리 |
|---|---|---:|---|
| `lf_appCallback`(207) | `js/fnBindPopupOpen.js` | 2 | `async` + `await` 2곳 |
| `lf_returnDOC`(275) | `js/fnBindPopupOpen.js` | 2 | `async` + `await` 2곳 |
| `attrAppF4Del` | `js/ws_html5_ws20_attr.js` | 2 | `async` + `await` 2곳 (원본도 async — `uiAttributeArea.js:2549` 가 `await` 로 부른다) |
| `attrSelOption2F4HelpIDDel` | `js/ws_html5_ws20_attr.js` | **3** | `async` + `await` 3곳 (갈래 2개 — 함수 전체를 읽어 확인) |
| `attrResetAttr` 안 루프 | `js/ws_html5_ws20_attr.js` | 루프 | 루프에서 `await` 로 하나씩 |

**루프 안 호출은 `attrResetAttr` 1곳뿐**(전수 측정). 그 밖에 근접 호출로 보였던 4쌍은
서로 다른 콜백(`onClear`/색 선택, `onChange`/`onEnter`)이거나 `return` 으로 갈라져 **연속이 아니다.**

## 호출처 `try/catch` 처리

**값 롤백 같은 복구를 하는 catch 는 `js/fnStyleClassPopupOpen.js` 1곳뿐**(전수 측정, 나머지는 `console.error`만).

```js
// 고친 뒤 — async 예외는 try/catch 로 못 잡으므로 .then/.catch 로
oAPP.fn.fnWs20AttrChange(oCtx.attr, "INPUT")
    .then(_after, function (e) { _rollback(e); _after(); });
```
뒤처리(`_renderAll`·스크롤 복원)도 커밋이 끝난 뒤로 옮겨 **원래 순서를 지켰다.**

`.catch` 를 더 붙인 자리: `fnWs20AttrChange` 안 예외처리 뒤 재진입(`[WS20ATTR-AWR02]`) ·
`attrAppF4Del` 호출처 · `attrSelOption2F4HelpIDDel` 호출처.

## ★ 값 반영은 `await` 앞이다 — 그래서 뒤 코드는 안 깨진다

`fnWs20AttrChange` 안의 `await` 는 **감지 1곳뿐**이고, 값 반영(`fnWs20AttrChangeProc`, 4332행)은 그 **앞**이다.
`async` 함수는 첫 `await` 까지 동기로 실행되므로, `await` 없이 불러도 **값은 이미 반영돼 있다.**
→ 호출처 뒤의 `designRefershModel()` · `updateBindPopupDesignData()` 는 반영된 값을 본다. 안 깨진다.

## ★ 내가 저지른 사고 2개 (되풀이 말 것)

1. **함수 선언을 읽지 않고 인자 이름을 가정**해 `function lf_appCallback(oRet)` 로 치환을 시도했다.
   실제는 `(param)` 이어서 `async` 가 안 붙고 `await` 만 들어가 **파일이 문법 오류 상태가 됐다.**
   → **고치기 전에 그 줄을 눈으로 읽는다.** 정규식 일괄 치환은 치환 건수를 세어 **예상과 맞는지 확인**한다.
2. `js/fnStyleClassPopupOpen.js` 에 **추측 방어**를 넣었다 —
   「혹시 동기 반환이면」 `if (!_oCommit || typeof _oCommit.then !== "function")`.
   `fnWs20AttrChange` 는 async 라 **항상 Promise 를 돌려주므로 절대 안 타는 죽은 코드**다. 장군님 지적받고 제거.
   → **소스에 가정·추측 로직을 넣지 않는다.**

## 아직 안 한 것

- **나머지 `try/catch` 호출처 5곳에 `.catch` 미추가** — `js/fnDumpWritePopupOpen.js:117` ·
  `js/fnImageCompressPopupOpen.js:180` · `js/fnInitPreScreenPopupOpen.js:87` ·
  `js/ws_html5_ws20_attr.js` 2곳. **기능은 안 깨진다**(값 반영이 await 앞) 다만 **예외가 조용히 사라진다.**
- `js/ws_html5_ws20_attr_ctxmenu.js` 2곳 · `js/fnEventShortcutRegOpen.js` 2곳 — `try` 없이 부른다 →
  예외 시 unhandled rejection. 역시 **미처리.**
- **앱 테스트 안 함.**
- 원본 `attrChange` 끝의 `await selPreviewUI(_sTree.OBJID)`(원본 1915) 가 WS4.0 이 자리에 **없다** —
  다시 그리면 미리보기 선택 표시가 지워지므로 원본은 다시 칠한다. **이번 범위가 아니라 손대지 않았다**(보고만).

## 검증

바꾼 9개 파일 전부 `node --check` 통과.

---

# 【이어 씀 2026-10-20 (10)】 예외 처리 — 한 곳에서 잡게 고쳤다

> 장군님 「예외 처리는 왜 안 하는 거야? 나름 크리티컬인데?」
> 내가 「기능은 안 깨지니 나중에」로 미뤘다. 변명 없다 — `async` 로 바꾼 것은 내 변경이고,
> 그 변경이 **기존 오류 기록 7곳을 무력화**시켰다.

## 먼저 정정 — 내가 틀리게 말한 것

「`.catch` 가 없으면 예외가 **조용히 사라진다**」 → **틀렸다.**
unhandled rejection 은 브라우저 콘솔에 자동 출력된다. 다만 **어느 자리·어느 속성인지 맥락이 없어**
AI 가 로그만 보고 원인을 짚을 수 없다 — 그래서 맥락 있는 로그가 필요한 것이지, 사라지는 게 아니다.

## 고친 방식 — 호출처 40곳이 아니라 함수 한 곳

실측: `fnWs20AttrChange` 는 본문이 `try { … } finally { … }` 이고 **`catch` 가 없었다**(원래부터).
동기였을 때는 호출처 `try/catch` 가 잡았는데, async 가 되면서 못 잡게 됐다.

→ **그 함수에 `catch` 를 하나 넣었다**(`js/ws_html5_ws20_attr.js:4376`).

```js
} catch (e) {
    _bAttrChangeOk = false;
    console.error("[WS20ATTR-ERR01] attr change failed - OBJID=… UIATK=… uityp=…:", …);
} finally { … }
return _bAttrChangeOk;
```

반환 규약: `true` = 값 반영까지 끝남 / `false` = 예외로 실패 /
`undefined` = 조기 종료(재진입 가드 · autoGrowing 확인창 · 전용 예외처리 모듈 · 입력값 점검 실패).

**이것으로 호출처 38곳 + 구 이름 별명(`oAPP.fn.attrChange`) 경로가 한 번에 해결된다** —
그 함수는 이제 **reject 하지 않는다**(`finally` 의 `_releaseAttrChangeLock` 도 안을 전부 `try/catch` 로
감싸고 마지막이 단순 대입이라 던질 수 없다 — 함수 본문을 읽어 확인).

## 값 롤백 — reject 대신 반환값으로

`js/fnStyleClassPopupOpen.js` 는 커밋 실패 시 값을 되돌린다. reject 가 더 이상 안 오므로
**`false` 를 보고** 되돌리게 바꿨다.

```js
oAPP.fn.fnWs20AttrChange(oCtx.attr, "INPUT").then(function (bOk) {
    if (bOk === false) { oCtx.attr.UIATV = sPrev; console.error("… rolled back to:", sPrev); }
    _after();
});
```
`undefined`(조기 종료)는 예외가 아니므로 되돌리지 않는다.

## 죽은 `.catch` 3곳 제거 (가정·추측 로직 금지)

함수가 reject 하지 않게 되자 내가 앞서 넣은 `.catch` 3곳이 **절대 안 타는 죽은 코드**가 됐다 → 제거.
(예외처리 뒤 재진입 · `attrAppF4Del` 호출처 · `attrSelOption2F4HelpIDDel` 호출처)

## 유지한 `.catch` 5곳 — 안 타는지 **읽어서** 판정

| 자리 | 유지 이유(읽은 근거) |
|---|---|
| `js/ws_html5_ws20_edit.js` `_lf_doAsync` · `_lf_doMultiAsync` | 본문이 `try` 없이 여러 함수를 부른다 → 던질 수 있다 |
| `js/fnSameAttrSyncPopupOpen.js` 확인 버튼 | `lf_setSyncAttr` 의 `try` **밖**에 `_onChangeValue()` · `_ensurePrev15` 루프 · `lf_close` · `_toast` 가 있다 → 던질 수 있다 |
| `js/fnBindPopupOpen.js` `lf_appCallback` · `lf_returnDOC` | 본문의 `try` 가 전체를 감싸지 않는다(첫 실행문이 `if (!_isEdit())`) → 던질 수 있다. **호출처가 함수를 변수에 담아 넘기므로 그 자리에 `.catch` 를 붙일 수 없어, 겉을 동기 래퍼로 두고 안쪽을 async 로 떼어냈다**(`_lf_appCallbackAsync` · `_lf_returnDOCAsync`) — 호출처 3곳 그대로 |

## 검증

- 바꾼 9개 파일 전부 `node --check` 통과.
- `fnWs20AttrChange` 뒤에 붙은 `.catch` 0건(죽은 코드 없음 — grep 확인).
- **앱 테스트 안 함.**
