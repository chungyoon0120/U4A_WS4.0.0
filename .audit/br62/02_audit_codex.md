# BR62 Codex 검수 결과

## 판정

**수정필요**

A(이름 변경 선택 앵커)와 C(삭제 복원 선택 앵커)는 요청서의 원본 근거 및 현행 스냅샷 복원 규약과 맞습니다. 그러나 undo/redo 전체 동안 원본이 보장하는 메인 화면 잠금이 누락된 P1 경쟁이 있고, B·D 부분 복원에는 교차 부모 이동 제거 위치 오류와 실패를 폴백으로 전달하지 않는 P2 결함 2건이 있습니다.

## 지적

### 1. [P1] undo/redo 비동기 복원 중 메인 화면의 다른 편집이 허용되어 히스토리와 복원 데이터를 경합시킵니다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:580-615`
- 원본 `U4A_WS_DESIGN/design/undoRedo/undoRedo.js:141-169`는 실행 시작 즉시 `parent.setBusy("X")`, `setShortcutLock(true)`, 자식창 `BUSY_ON`을 모두 걸고 종료·조기종료에서 역순 해제합니다. 이는 같은 undo 버튼만이 아니라 디자인 화면의 모든 변경 진입을 막는 계약입니다.
- HTML5는 `_bHistBusy`로 추가 undo/redo 호출만 무시하고(:581-584), 자식창 BUSY만 방송합니다(:598-614). `parent.setBusy("X")`와 `setShortcutLock(true)`가 없어 메인 트리의 추가·삭제·속성변경·D&D는 계속 진입할 수 있습니다.
- `_restoreSnap`은 부모 RTE rerender와 선택 복원을 await합니다(:425-428, :509, :527). 이 대기 중 새 편집이 `fnWs20PushUndo()`를 호출하면 `_redoStack=[]`로 방금 구성 중인 redo 이력을 지우고(:539-545), 복원된 `zTREE/oAPP.attr.prev`를 다시 변경해 진행 중 부분 미리보기와 경합할 수 있습니다. 이는 단순 UI 깜빡임이 아니라 undo/redo 이력 소실과 데이터·미리보기 불일치로 이어지는 실제 P1 경로입니다.

제안: `_doApply` 시작에서 원본대로 메인 busy와 shortcut lock을 소유 표시와 함께 걸고, finally에서 자식 `BUSY_OFF`, shortcut unlock, 메인 busy 해제를 반드시 짝지으십시오. 확인창을 띄우기 전이 아니라 실제 복원 시작 시 잠그면 취소 경로의 짝도 단순해집니다.

### 2. [P2] 부모가 바뀐 이동의 undo/redo가 현재 미리보기 위치가 아니라 복원할 옛 위치에서 제거를 시도합니다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:403-413`
- `_restoreSnap`은 먼저 트리와 `oAPP.attr.prev[*]._T_0015`를 복원값으로 교체한 뒤(:453-470) `_applyPartialPreview(old=snapshot, new=복원 직전)`를 호출합니다. 따라서 `oOld[k]`는 **복원할 위치**, `oNew[k]`는 미리보기에 아직 붙어 있는 **현재 위치**입니다.
- 하지만 이동 처리부는 `var oN = oOld[k]`로 잡은 뒤 `prevRemoveUiObject(oN)`을 호출합니다(:406-407). `prevRemoveUiObject`는 전달받은 `POBID/PUIOK/UIATT`를 그대로 `delUIObjPreView`에 넘깁니다(`ws_html5_ws20_dnd.js:703-712`).
- 미리보기의 `delUIObjPreView`는 그 `POBID`의 aggregation mutator/removeAggregation을 호출합니다(`design/preview/index.js:3809-3841`). 부모 A에서 B로 이동한 뒤 undo하면 실제 UI는 아직 B에 있는데 코드가 복원값 A에서 제거하려 합니다. 일반 UI는 뒤의 `destroy()`가 실제 부모에서 자동 분리해 겉보기 정상일 수 있지만, 원본이 별도 제거를 둔 `sap.uxap.ObjectPageDynamicHeaderTitle.actions` 예외에서는 이전 부모의 stale 참조와 복원 위치의 새 인스턴스가 함께 남는 ghost/duplicate가 구체적으로 가능합니다.
- 원본 D&D undo는 현재 상태의 UI를 먼저 삭제한 뒤 저장해 둔 이전 상태를 삽입합니다(`U4A_WS_DESIGN/design/undoRedo/undoRedo.js:1661-1706, 1725-1743`). 즉 제거 인자는 현재 위치여야 합니다.

제안: 제거 단계에는 `oNew[k]`를 사용하고, 재생성·새 위치 삽입에는 `oOld[k]`를 사용하십시오. 같은 부모 내 순서 이동뿐 아니라 부모/aggregation 변경 양방향을 각각 검증해야 합니다.

### 3. [P2] 부분 갱신 실패가 throw되지 않아 약속한 전체 재생성 폴백이 실행되지 않습니다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:97-102, 238-260, 391-428`
- 요청서와 주석은 “부분 갱신 중 예외 발생 시 `drawPreview`로 안전 폴백”을 수용 기준으로 제시합니다. 실제 폴백은 `_applyPartialPreview`가 throw할 때만 실행됩니다(:508-518).
- 그러나 핵심 미리보기 호출은 `_prev()`가 예외·함수 부재를 모두 `false`로 삼키고, 호출자는 반환값을 검사하지 않습니다. 이동의 `prevRemoveUiObject`와 `reCreateUIObjInstance`도 각각 빈 catch로 삼킵니다(:407-408). `_rerenderParentRTE` 역시 내부 실패를 로그만 남기고 정상 반환합니다(:120-144).
- 따라서 제거 실패 후 생성/이동만 실행되거나, 생성 실패 후 부모 재렌더만 실행되어도 `_applyPartialPreview`는 `true`를 반환합니다. 전체 재생성 폴백은 오지 않고 데이터 트리와 미리보기만 어긋납니다. 속성 경로도 prev 부재·기본값 구성 실패·unbind/model bind/property 반영 실패를 return 또는 로그 후 계속합니다(:270-349).
- `drawPreview()`가 실제 호출되어 정상 완료하면 복원 데이터 기준으로 전면 재구축하므로 폴백 설계 자체는 유효합니다. 하지만 폴백 함수가 없거나 실행이 실패한 경우도 :514-518에서 경고만 남기고 상태 커밋·재선택을 계속하는 2차 fail-open이 있습니다. 이는 검수 포인트 P5·P12와 구현 설명을 직접 위반합니다.

제안: 부분 복원 전용 경로에서는 필수 함수 존재와 각 호출 성공을 확인하고 실패를 throw하십시오. 이미 일부 동작한 뒤라도 복원 데이터 기준 `drawPreview()`가 전면 재생성하므로 폴백할 수 있습니다. 단, 오류를 삼키는 기존 공용 `_prev`의 전체 계약을 바꾸기보다 BR62 부분 복원용 strict wrapper를 두는 편이 파급이 작습니다.

## 통과 확인

- A: `OBJID_bf`는 이력 적재 시 변경 전 이름이고, undo에서는 그 이름이 존재하며 redo에서는 저장된 선택 앵커로 폴백하므로 연속 rename에서도 방향별 선택 논리가 성립합니다. `UIATK` 미전달도 원본 이름 변경 처리와 맞습니다.
- C: 단건은 삭제 대상 자체를 기록하며, 다건의 `aChecked`는 트리 선행 순회 순서라 첫 대표가 화면 순서와 맞습니다. 삭제 방향에서 대상이 사라지면 `sSelParent` 폴백도 유지됩니다.
- 상·하위 추가/삭제는 `_ancestorIn`으로 최상위 한 건만 처리하고 `_prevCreateInstanceDeep`가 자식을 재귀 생성·부착하므로 기본 분담은 맞습니다.
- `_bHistBusy`와 자식창 BUSY는 추가 undo/redo와 자식창 조작만 막습니다. 메인 화면 전체 편집 잠금은 누락됐으므로 이 항목은 통과가 아닙니다.
- 검수 범위에서 원본 `design/` 파일 변경은 확인하지 않았고 제품 코드는 수정하지 않았습니다.

## 결론

**수정필요 — P1 1건, P2 2건.** 우선 원본의 메인 화면/단축키 잠금을 복원하고, 이동 제거 인자와 strict 실패 전파를 고쳐야 합니다. 실화면 BR62-1~9도 아직 미실시이므로 정적 결함 수정 뒤 복원 중 다른 편집 차단, 교차 부모 이동, 동일 부모 순서 이동, 부분 호출 강제 실패 폴백을 추가 검증해야 합니다.

## 2차 서브에이전트 재검수 취합

3개 독립 검수 결과를 반박 관점으로 다시 합쳤습니다.

- 이동 지적의 도달성은 확정됐지만 일반 UI는 `destroy()`가 자동 분리할 수 있고 저장 데이터 손상은 입증되지 않아 기존 P1을 **P2로 하향**했습니다. 다만 ObjectPage dynamic header actions 예외는 stale 참조가 남는 구체적 경로입니다.
- fail-open 지적은 생성·삭제·이동·속성·RTE 재렌더와 폴백 자체까지 재확인되어 **P2 유지**입니다. 성공한 `drawPreview()`는 안전망으로 유효하므로 “폴백 설계 오류”가 아니라 “실패가 폴백에 전달되지 않고 폴백 실패도 성공 처리됨”이 정확한 표현입니다.
- 신규 **P1**은 원본의 메인 busy/shortcut lock 누락입니다. `_bHistBusy`는 undo/redo 버튼 재진입만 막아 다른 편집이 비동기 복원 중 스택과 데이터를 변경하는 것을 차단하지 못합니다.
- A/C 및 기본 ancestor 분류에는 신규 반례가 없었습니다.
