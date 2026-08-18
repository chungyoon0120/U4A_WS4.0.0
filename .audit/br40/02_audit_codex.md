# BR40 Codex 검수 결과

## 판정

**수정 필요 (P1 1건)** — 삭제 호출부는 추가됐지만 핵심 함수 `oAPP.fn.delDesc`가 현행 HTML5 속성 파일에 존재하지 않아, 호출이 모두 조용히 no-op 된다.

## 필수 지적

### [P1] 요청서에 명시된 `delDesc` 이식이 현행 파일에서 누락됐다

- 요청서는 `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 약 1400행, `getDesc` 직전에 `oAPP.fn.delDesc`를 신규 추가했다고 명시한다.
- 그러나 현행 파일은 `setDesc`가 `:1353-1398`에 끝난 뒤 곧바로 `getDesc`가 `:1400`부터 시작한다. 프로젝트 현행 파일 검색에서도 `oAPP.fn.delDesc = ...` 정의는 KEEP-UI5 원본 `design/js/uiAttributeArea.js:7783`에만 있고 HTML5 파일에는 없다.
- HTML5 preload는 `library-preload.js:174`, `:182`에서 `ws_html5_ws20_attr.js`와 `ws_html5_ws20_edit.js`를 로드하며, UI5 의존 `design/js/uiAttributeArea.js`는 HTML5 구현의 함수 공급원으로 로드되지 않는다. 따라서 정상 HTML5 실행에서 `oAPP.fn.delDesc`는 미정의다.
- 삭제 호출부 `ws_html5_ws20_edit.js:397`, `:417`은 모두 다음처럼 함수 존재 여부를 확인한다.
  ```js
  if (typeof oAPP.fn.delDesc === "function") { oAPP.fn.delDesc(...); }
  ```
  함수가 없으면 오류도 내지 않고 그대로 통과하므로 트리·미리보기·`prev`는 삭제되지만 `T_DESC`는 그대로 남는다. 즉 BR40의 최초 재현 현상이 해결되지 않는다.
- 우선순위는 삭제된 UI 설명이 저장 데이터에 잔존하고, 이후 같은 OBJID 재사용 또는 저장/재진입 시 잘못 연결될 수 있으므로 P1로 판정한다.
- 저장 빌더 `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:445-458`은 `T_DESC: oA.T_DESC`를 별도 필터 없이 payload에 직접 포함한다. 따라서 이 잔존은 세션 메모리에만 머물지 않고 실제 저장 데이터로 전송된다.
- 제안: 원본 `uiAttributeArea.js:7783-7795`의 `findIndex`/`-1 return`/`splice` 구현을 HTML5 속성 파일의 `setDesc`와 `getDesc` 사이에 실제로 복원하고, 요청대로 `T_DESC` 부재 가드만 추가한다. 이후 삭제 경로의 함수 존재 가드를 유지하더라도 정상 preload에서 함수가 반드시 정의되는지 확인한다.

## 나머지 구현 검수

### 1. 삭제 대상과 재귀 범위

- `_removeNodePreview(n)`의 `delDesc(n.OBJID)`는 삭제 노드 본인을 대상으로 하며 단건 삭제와 멀티 삭제가 공용으로 사용한다.
- `_purgePrevSubtree(n)`는 각 자식에 먼저 재귀한 뒤 해당 자식의 OBJID를 정리하므로, 부모 삭제로 함께 사라지는 모든 깊이의 하위 UI를 포함한다.
- 멀티 삭제는 자식부터 처리한다. 체크된 자식이 먼저 제거된 뒤 부모를 처리하고, 체크 전파가 불완전한 경우 부모의 남은 하위는 `_purgePrevSubtree`가 처리한다. `delDesc`가 원본처럼 `findIndex === -1`에서 반환하면 중복 호출도 무해하다.

### 2. 삭제 경로 한정 여부

- `_removeNodePreview` 호출은 단건 삭제 `:454`와 멀티 삭제 `:619`, `_purgePrevSubtree` 호출은 단건 `:456`과 멀티 `:623`에 한정된다.
- 이동·추가·붙여넣기 경로에서 이 두 정리 함수를 호출하는 근거는 없어 무관 UI 설명을 지우는 경로는 확인되지 않았다.

### 3. Undo/Redo

- 삭제 직전 `fnWs20PushUndo()`가 호출되며, 스냅샷은 `T_DESC` 전체를 복제한다(`ws_html5_ws20_edit.js:128-137`). 복원도 배열 참조를 유지한 채 `T_DESC`를 in-place 복구한다(`:172-178`).
- 따라서 `delDesc`가 실제 정의되면 삭제 후 Undo에서 본인과 하위 설명이 복원되고 Redo에서 다시 제거되는 구조는 정합하다.

### 4. 원본·정적 검사

- 원본 `design/js/uiAttributeArea.js:7783-7795`는 정확한 OBJID의 첫 행만 제거하고 미발견 시 반환한다. 현행 호출 인자도 이 계약에 맞는다.
- `node --check`는 두 HTML5 파일 모두 통과한다. 다만 구문 검사는 누락된 함수 정의를 검출하지 못하므로 기능 통과 근거가 될 수 없다.
- 제품 코드는 수정하지 않았다.

## 수정 후 필수 회귀 시나리오

1. 설명이 있는 단일 UI 삭제 후 해당 OBJID의 `T_DESC`가 0건이고 무관 UI 설명은 유지되는지 확인한다.
2. 3단계 이상 부모/자식 트리에서 부모 삭제 후 모든 하위 OBJID 설명이 제거되는지 확인한다.
3. 멀티 체크 삭제에서 부모·자식 중복 처리에도 예외 없이 전부 제거되는지 확인한다.
4. 삭제 → Undo → Redo에서 `T_DESC`가 트리와 함께 제거·복원·재제거되는지 확인한다.
5. `T_DESC` 자체가 없거나 대상 OBJID가 없을 때 안전하게 no-op 되는지 확인한다.

## 독립 재검수 취합

- 독립 서브에이전트가 현행 HTML5 전체 로드 목록과 동적 공급 가능성을 별도로 추적했으며, underscore 백업을 제외하면 `delDesc` 정의는 0건이고 KEEP-UI5 원본만 정의를 보유한다는 결론에 도달했다.
- 단건·멀티 배선, Undo/Redo `T_DESC` 스냅샷, 저장 payload 직접 포함도 각각 재확인했다. 함수 부재로 삭제 변이가 전혀 발생하지 않으므로 P1 유지에 동의했다.
