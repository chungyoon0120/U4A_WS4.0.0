# 02_audit_codex — BR26 단건 삭제 후 하위 prev 잔존 검수

## 판정

**수정필요**

## 지적

### 1. [P1] 하위 노드의 다른 활성 저장소가 그대로 남아 삭제 상태가 여전히 불완전하다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:350-359`, `390-394`
- 신규 `_purgePrevSubtree()`는 하위 노드마다 `oAPP.attr.prev[OBJID]`와 `UA015UI`만 제거한다.
- 그러나 원본의 동일 재귀 단위 `lf_deleteTreeLine()`은 각 하위 노드에 대해 다음을 모두 수행한다(`www/ws30/ws10_20/design/js/uiDesignArea.js:6634-6669`).
  1. `delUiClientEvent(is_tree)` — `APPDATA.T_CEVT` 정리
  2. `delDesc(OBJID)` — `APPDATA.T_DESC` 정리
  3. `designUnbindLine(is_tree)` — 부모 `_BIND_AGGR` 등 binding 수집정보 정리
  4. `removeCollectPopup(OBJID)` — `oAPP.attr.popup` 정리
  5. preview destroy, `prev` 및 UA015 정리
- 이 저장소들은 죽은 캐시가 아니다. `T_CEVT`와 `T_DESC`는 복사·저장 및 undo 스냅샷에서 계속 읽히고, `_BIND_AGGR`는 이후 bind/unbind 부모 관계 계산에 사용되며, `oAPP.attr.popup`은 preview/popup 재구성에 사용된다.
- 활성 HTML5 초기 로드에는 `uiDesignArea.js`·`uiAttributeArea.js`가 포함되지 않으므로 원본 삭제 함수가 우연히 대신 실행된다고 볼 수도 없다. `removeCollectPopup`만 `ws_html5_ws20_prev.js`에 이식돼 있지만 단건 삭제가 호출하지 않는다.
- 영향: BR26 수정 후 `prev` 조회는 깨끗해 보여도, 삭제된 자식의 이벤트·설명·부모 바인딩 참조·popup 참조가 남는다. 이후 저장, 재바인딩, 복사/undo 또는 preview 갱신에서 삭제된 OBJID가 다시 소비될 수 있어 Tree↔Preview↔수집정보 동기화가 완성되지 않는다.
- 제안: 단건 subtree 순회에서 `prev`를 삭제하기 **전에** 원본 순서대로 각 노드의 Client Event, Description, binding 및 popup 수집정보를 정리한다. HTML5에서 함수가 없는 항목은 현재 데이터 구조에 맞는 명시적 helper로 이식하고, 조용한 optional-call로 누락을 숨기지 않는다. 최상위 노드에도 동일 정리가 필요하다.

## 검수 결과

### 1. 중첩 하위 UI가 깊이 제한 없이 정리된다

- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:350-359`의 `_purgePrevSubtree(n)`은 각 `zTREE` 자식에 대해 자신을 먼저 재귀 호출한 뒤 해당 자식의 `oAPP.attr.prev[c.OBJID]`를 삭제한다.
- 따라서 자식·손자·그 이하 모든 깊이의 OBJID와 그 객체가 보유한 `_T_0015`가 함께 제거된다.
- `zTREE`가 없거나 빈 leaf는 재귀에서 안전하게 반환하고, 호출 부모가 그 leaf의 `prev` 키를 삭제한다.

### 2. 최상위와 하위의 책임이 중복되지 않는다

- 단건 삭제 YES 경로는 먼저 `_removeNodePreview(oNode)`를 호출한다(`390-393`). 이 함수가 미리보기 제거·destroy와 최상위 `prev[oNode.OBJID]` 삭제를 담당한다.
- 이어지는 `_purgePrevSubtree(oNode)`는 `oNode` 자체가 아니라 자식부터 처리한다. 최상위를 다시 삭제하거나 미리보기 destroy를 중복 호출하지 않는다.
- 자식 미리보기 컨트롤은 preview `destroyUIPreView()`가 부모 UI5 컨트롤의 `destroy()`를 호출할 때 재귀 파괴된다. 추가 함수는 화면 객체를 다시 파괴하지 않고 누락됐던 내부 레지스트리만 정리한다.

### 3. 원본 단건 삭제의 재귀 의미와 일치한다

- 원본 `www/ws30/ws10_20/design/js/uiDesignArea.js:6634-6669`는 하위를 먼저 순회한 뒤 각 노드의 `oAPP.attr.prev[OBJID]`와 일치하는 `UA015UI`를 제거한다.
- HTML5 구현도 하위부터 `prev`를 삭제하고 하위 노드가 `UA015UI._OBJID`와 같으면 `UA015UI`를 제거한다.
- 최상위 UA015 정리는 기존 `_removeNodePreview()`가 호출하는 preview `delUIObjPreView()`에 이미 존재한다. BR26 추가분은 기존 최상위 처리와 하위 누락을 분리한다.
- 다만 원본의 동일 재귀 단위가 함께 제거하는 Client Event·Description·binding·popup 수집정보는 현재 구현에서 정리되지 않는다. 이는 위 P1 지적 때문에 원본 1:1 통과로 볼 수 없다.

### 4. 멀티 삭제 의미는 변경되지 않는다

- `_purgePrevSubtree()` 호출은 단건 `_deleteUI()`에만 추가됐다.
- 멀티 삭제는 기존처럼 트리를 bottom-up 순회하면서 `chk === true`인 노드에만 `_removeNodePreview()`를 적용한다(`526-572`).
- 따라서 체크 상태에 따른 원본 `lf_delSelLine`의 선택적 삭제 의미를 BR26이 바꾸지 않는다.

### 5. 삭제 후속 처리와 잠금 대칭이 보존된다

- undo 스냅샷은 삭제 및 purge 전에 생성되어 삭제 전 `zTREE`와 각 `prev._T_0015`를 보관한다.
- 이후 순서는 미리보기 제거 → 하위 `prev` purge → 부모 `zTREE` splice → 트리 렌더 → 부모 선택 → 변경 표시 → 바인딩 팝업 갱신으로 유지된다.
- 취소·부모 노드 가드 경로는 purge에 진입하지 않는다. 성공 및 모든 조기 종료의 `_broadBusy(false)`와 `_unlock()` 흐름도 변경되지 않았다.
- purge의 `delete`는 멱등적이며 가드가 있어 이미 없는 키에서도 예외를 만들지 않는다.

## 수용 기준 점검

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 직계 자식 `prev` 제거 | 통과 | 자식별 delete |
| 3단 이상 중첩 제거 | 통과 | 깊이 제한 없는 재귀 |
| 자식 `_T_0015` 잔존 방지 | 통과 | 소유 객체 키 자체 제거 |
| 최상위 이중 삭제·destroy 방지 | 통과 | 최상위/하위 책임 분리 |
| UA015 하위 예외 정리 | 통과 | OBJID 일치 시 제거 |
| 원본 자식 우선 순서 | 통과 | post-order 재귀 |
| 하위 Client Event·Description 정리 | 실패 | `T_CEVT`·`T_DESC` 고아 데이터 잔존 |
| 하위 binding·popup 수집정보 정리 | 실패 | `_BIND_AGGR`·`oAPP.attr.popup` 정리 호출 없음 |
| 멀티 삭제 불변 | 통과 | 단건 경로에만 배선 |
| Undo·선택·변경표시·팝업 갱신 순서 | 통과 | 기존 순서 유지 |
| BUSY·단축키 대칭 | 통과 | 변경 없음 |
| JavaScript 구문 검사 | 통과 | `node --check ws_html5_ws20_edit.js` |

## 검증 범위

- `.audit/br26/01_request.md`의 단건 삭제 내부 저장소 정리 범위
- `.analy/05_디자인영역.md`의 Tree↔Preview↔`oAPP.attr.prev` 동기화 원칙
- 원본 단건·멀티 삭제 및 preview destroy 경로와 활성 HTML5 구현 정적 대조
- 실제 UI에서 중첩 트리를 생성·삭제한 런타임 테스트는 수행하지 않았다.
