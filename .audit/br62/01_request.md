# BR62 검수 요청 (01) — 되돌리기/다시하기 원본 불일치 3건

노션 이슈: **BR62** / 화면 = WS20 Design / 분류 = 기능
제목: 되돌리기(Undo)·다시하기(Redo)가 원본과 다르게 동작 — 복원 후 선택 대상 오류 및 미리보기 전체 재생성

---

## 1. 검수 대상 (파일·함수)

| 파일 | 함수/위치 | 결함 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` | `attrChnageOBJID` — 1732~1743행 (되돌리기 이력 적재) | A |
| `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` | 단건 삭제 `_deleteUI` — 774~778행 / 체크 다건 삭제 — 937~939행 | C |
| `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` | **신규** `_flatTree`(209) `_ancestorIn`(215) `_capturePrevScroll`(221) `_restorePrevScroll`(229) `_prevCreateInstanceDeep`(238) `_prevCreateSubtree`(255) `_applyPartialPreview`(355) | B·D |
| `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` | `_restoreSnap` — 434·436(복원 직전 상태 캡처), 501~518(부분 갱신 + 폴백) | B·D |

원본 미수정: `design/` 아래 원본 사본은 **한 줄도 건드리지 않음**. 전부 `js/ws_html5_*.js` 내 변경.
`node --check` 통과. 백업 = `_ws_html5_ws20_edit.js.br62pdbak`.

---

## 2. 변경 요약 (원본 대비)

### [A] 이름 변경을 되돌리면 선택이 부모로 튀던 문제
- **현상**: `BUTTON3` → `BUTTON9` 로 이름 변경 후 되돌리기 → 이름은 복원되나 트리 선택 표시가 부모(`PAGE1`)로 이동, 오른쪽 속성 영역도 부모 것으로 바뀜.
- **원인**: `attrChnageOBJID` 가 되돌리기 이력을 적재하는 시점에 `uiinfo.OBJID` 는 이미 **새 이름**. 스냅샷의 선택 앵커(`s.sel`)가 `BUTTON9` 가 되는데, 되돌린 트리엔 그 이름이 없어 부모 폴백으로 떨어짐.
- **수정**: 이력 적재 시 **변경 전 이름**(`ls_uiinfo.OBJID_bf`)을 대상으로 넘김. `UIATK` 는 주지 않음 — 원본 `CL_CHANGE_OBJID.executeHistory`(undoRedo.js 1405~1550)에 `setSelectTreeItem` 자체가 없어 속성 줄로 이동하는 동작이 원본에 없기 때문.
- **양방향 근거**: 되돌리기=옛 이름이 복원 트리에 존재 → 그 UI 선택. 다시하기=옛 이름이 없어 기존 폴백(`s.sel`=새 이름)이 걸려 **같은 UI** 선택.

### [C] 삭제를 되돌려도 되살아난 UI 가 선택되지 않던 문제
- **현상**: 딴 줄(`CALENDAR1`)을 선택해 둔 채 다른 UI(`BUTTON3`) 줄의 휴지통 버튼으로 삭제 → 되돌리기 → 되살아났으나 선택은 `CALENDAR1` 에 그대로.
  (트리 줄의 휴지통 버튼은 그 줄을 선택하지 않음 — `ws_html5_ws20_tree.js` 571행에서 `stopPropagation` 후 삭제 호출.)
- **원본 계약**: 삭제 이력은 `ACTCD="INSERT"` 로 저장되고(undoRedo.js 770), 되돌릴 때 `CL_INSERT_UI.executeHistory` 가 `setSelectTreeItem(_sInsertData.S_DESIGN.OBJID)`(543)로 **되살린 UI** 를 선택.
- **수정**: 단건 삭제는 지우는 노드 OBJID, 체크 다건 삭제는 **체크된 것 중 첫 번째** OBJID 를 되돌리기 이력에 기록(원본 추가 처리도 대표 1건만 선택).
- **다시하기(재삭제)**: 그 UI 가 트리에 없어 기존 폴백(선택 유지 → 그게 삭제 대상이면 부모)이 걸려 원본 `CL_DELETE_UI`(949~971, 1012)와 동일.

### [B·D] 되돌릴 때 미리보기를 통째로 다시 그리던 문제 ★이번 핵심
- **현상**: 되돌리기 1회마다 미리보기 전체가 지워졌다 다시 그려짐 → 깜빡임, 보던 스크롤 위치·현재 페이지 유실, UI 많을수록 느려짐.
- **원본 사실(전수 확인)**: `undoRedo.js` **전체에 `drawPreview`(전체 재생성) 호출 0건**. 액션별 부분 함수만 사용.
  - 삽입 되돌리기(=삭제) : `delUIObjPreView` + `destroyUIPreView` (1046·1098)
  - 삭제 되돌리기(=삽입) : `createUIInstance`(573) + 자식 재귀 `createUIInstance`+`setUIParent`(655·661) + `moveUIObjPreView`(619)
  - 끌어놓기 : 위 delete + insert 조합 (1706·1737 / 1864·1901)
  - 속성 : `previewUIsetProp` 단건(2204)
  - 이름 변경 : 미리보기 인스턴스 **키만 rename**(1452~1493), 파괴·재생성 없음
  - 마무리 : `CL_COMMON.invalidateUiObject`(2662~2684, 내부 `rerender()`)로 **영향받은 부모만** 다시 그림 + `attachOnAfterRendering`(2436) 완료 대기
- **수정**: 스냅샷 방식에는 "무엇이 바뀌었는지" 목록이 없으므로, **복원 직전 트리(new) ↔ 복원값 트리(old)** 와 각 `_T_0015` 를 비교해 바뀐 노드만 분류(지움/되살림/이동/속성)한 뒤 위 원본 부분 함수로 반영하고, 마지막에 영향받은 **부모만** 다시 그림(`_rerenderParentRTE`).
- **안전 폴백**: 아래 경우 예외를 던져 **기존 전체 재생성(`drawPreview`)** 으로 되돌아감 → 최소한 종전 수준은 항상 보장.
  - `ROOT`/`APP` 이 바뀐 되돌리기(ROOT 속성=테마는 원본도 `setPreviewUiTheme` 전용 처리)
  - 바뀐 노드 40개 초과(광범위 변경)
  - 부분 갱신 중 예외 발생
  - 폴백 시엔 **되돌리기 직전 스크롤 위치를 복원**(BR62-9 대응).
- 트리 변화가 없고 클라이언트 이벤트/설명만 바뀐 경우엔 미리보기를 아예 건드리지 않음.

---

## 3. 검수 포인트 (꼭 봐 주세요)

| # | 항목 |
|---|---|
| P1 | **[B·D] 부분 갱신 분류 정확성** — `_applyPartialPreview`(355) 의 지움/되살림/이동/속성 분류가 실제 편집 종류(추가·삭제·이동·붙여넣기·마법사·개인화 적용·속성변경·이름변경·끌어놓기)를 빠짐없이 덮는가. 잘못 분류돼 미리보기와 데이터가 어긋나는 조합이 있는가. |
| P2 | **[B·D] 이중 부착/누락** — `_prevCreateSubtree`(255)는 최상위만 `moveUIObjPreView`, 자식은 `setUIParent`(원본 655·661 대응). 이 분담이 원본과 맞는가. 되살린 서브트리가 부모의 **같은 aggregation 안 제자리 index**(`_aggrPrevIndex`)로 들어가는가. |
| P3 | **[B·D] 상위/하위 중복 처리** — `_ancestorIn`(215) 로 "상위가 통째로 재구성되면 하위 스킵" 처리. 부모와 자식이 동시에 바뀐 되돌리기에서 이중 생성·이중 삭제·미반영이 없는가. |
| P4 | **[B·D] 이름 변경 경로** — 원본은 인스턴스 키만 rename 하는데, 여기선 옛 이름 지우기 + 새(옛) 이름 되살리기로 처리됨(키가 달라 지움/되살림 두 집합에 각각 잡힘). 결과가 원본과 같은가, 아니면 그 UI 만 불필요하게 다시 그려지는가(원본은 다시 그리지 않음). |
| P5 | **[B·D] 폴백 안전성** — ROOT/APP·40개 초과·예외 세 조건이 실제로 위험 구간을 다 막는가. 폴백이 **부분 갱신을 일부 수행한 뒤** 걸리면 그 중간 상태 위에 전체 재생성이 얹혀도 안전한가(가장 걱정되는 지점). |
| P6 | **[B·D] 부모만 다시 그리기 순서** — 부모별 `_rerenderParentRTE` 를 순차 `await`. 원본은 `invalidateUiObject` 일괄 후 `Promise.all` 대기. 순서 차이로 생기는 문제(글자편집기 렌더 경쟁 등)가 있는가. |
| P7 | **[A] 이름 변경 이력 대상** — `OBJID_bf` 가 적재 시점에 정말 옛 이름인가. 연속 2회 변경 후 되돌리기 2회에서 각 시점 옛 이름으로 정확히 복원되는가. `UIATK` 미전달이 원본(속성 줄 이동 없음)과 맞는가. |
| P8 | **[C] 다건 삭제 대표 1건** — 체크 다건 삭제에서 첫 번째 OBJID 만 기록하는 것이 원본 계약(대표 1건 선택)과 정합한가. `aChecked` 순서가 트리 표시 순서와 같은가. |
| P9 | **[C] 삭제 대체 앵커 유지** — `_restoreSnap` 의 부모 대체 앵커(`sSelParent`) 로직이 그대로 살아 있는가(다시하기=재삭제 시 부모 선택에 필요). |
| P10 | **되돌리기 중 재진입·화면잠금** — 부분 갱신이 `await` 를 포함하므로 진행 중 또 되돌리기를 눌렀을 때의 차단(`_bHistBusy`)과 자식창 잠금 짝(BUSY_ON/OFF)이 그대로 유효한가. |
| P11 | **원본 무수정 원칙** — `design/` 아래 원본 사본을 건드리지 않았는가. 미리보기 부분 함수 호출이 전부 iframe 창구(`_prev`)·기존 이식본(`prevRemoveUiObject`/`reCreateUIObjInstance`, dnd.js 703·716)을 통하는가. |
| P12 | **조용한 오류 삼킴** — 부분 갱신 경로의 `try/catch` 가 규칙(`code.md`: 오류 표면화)에 어긋나게 삼키는 곳이 있는가. |

---

## 4. 근거

- **원본 SSOT**: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\undoRedo\undoRedo.js`
  - `CL_INSERT_UI` 317(save 357 / ACTCD "DELETE" 385 / executeHistory 429 / insertUiObject 557 / createPreviewUI 655·661 / moveUIObjPreView 619 / 선택 543)
  - `CL_DELETE_UI` 675(save 744 / ACTCD "INSERT" 770 / executeHistory 819 / deleteUiObject 1033 / delUIObjPreView 1046 / destroyUIPreView 1098 / 선택 1012, 대체앵커 949~971)
  - `CL_MOVE_UI` 1219(executeHistory 1268 → `contextMenuUiMove` 위임 1330)
  - `CL_CHANGE_OBJID` 1343(executeHistory 1405~1550 — 키 rename 1452~1493, **setSelectTreeItem 없음**)
  - `CL_DRAG_DROP` 1561(executeHistory 1626 / 선택 1758·1924)
  - `CL_CHANGE_ATTR` 1942(executeChangeAttr 2105 / previewUIsetProp 2204 / 선택 2278 — **유일하게 UIATK 동반**)
  - `CL_COMMON` attachOnAfterRendering 2436 / invalidateUiObject 2662(내부 `rerender()`)
  - **파일 전체 `drawPreview` 호출 0건**
- `design/js/uiDesignArea.js` setSelectTreeItem 2326 / designRefershModel 5698
- `design/preview/index.js` (미리보기 KEEP) createUIInstance 8391 / setUIParent 8870 / moveUIObjPreView 6219 / delUIObjPreView 6355 / destroyUIPreView 6336 / redrawUIScript 9299 / refreshPreview 6586
- HTML5 기존 이식본: `ws_html5_ws20_dnd.js` prevRemoveUiObject 703 / reCreateUIObjInstance 716
- 노션 BR62 본문 5-A / 5-C / 5-B·D 절 (재현 절차·기대 결과·원인 분석)

---

## 5. 검수 시 참고

- **미리보기 영역은 원본 UI5 그대로(KEEP)** — 되돌리기에서 부르는 미리보기 함수는 전부 원본 함수다. 따라서 "원본 undoRedo 가 부르는 순서·인자와 같은가"가 판정 기준.
- 실화면 검증(BR62-1~9)은 아직 미실시. 이 검수는 **소스 기준**으로 봐 주시면 된다.
- B·D 는 노션 이슈에서 (가)작은 개선 / (나)원본 이식 두 안 중 **장군님이 (나) 원본대로를 지시**해 이식한 것이다. 다만 스냅샷 자료구조 자체는 유지하고, 복원 시 비교로 변경분을 산출하는 방식이다(원본은 액션별 변경분을 처음부터 기록). 이 구조 차이에서 오는 빈틈이 있는지 특히 봐 주시길.
