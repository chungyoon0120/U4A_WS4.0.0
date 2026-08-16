# BR44 Codex 검수 결과

## 판정

**수정 필요 (P1 1건)** — UW03·UW08·UW10의 정적 이식은 원본과 일치하지만, 검사와 실제 삽입 사이의 비동기 재진입 창 때문에 검증된 대상이 더 이상 유효하지 않은 상태에서 삽입이 재개될 수 있다.

## 필수 지적

### [P1] 세 검사가 프리셋 조회 `await` 전에만 실행되어 대상 삭제 후 고아 삽입이 가능하다

- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:942-957`에서 UW03·UW08·UW10을 모두 통과한 뒤, `:965`의 `_readAttrPreset(...)`을 `await`한다. 실제 Undo push와 트리 삽입은 각각 `:967`, `:1025` 이후다.
- 호출측 `:1662-1668`은 팝업을 닫은 뒤 `_broadBusy(true)`만 호출한다. `_broadBusy`(`:85-87`)는 `BroadcastChannel.postMessage`로 다른 컨텍스트에 BUSY를 방송할 뿐이고 송신 객체 자신은 그 메시지를 수신하지 않으므로, 현재 WS20의 삭제·Undo·다른 편집을 잠그지 않는다. 팝업을 열 때 걸었던 로컬 busy/shortcut도 팝업 렌더 후 이미 해제된다.
- 개인화 적용과 프리셋 파일이 있는 상태에서 조회 Promise를 지연시키고, 대기 중 대상 `is_tree`를 삭제하면 다음 문제가 발생한다.
  1. UW03·UW08·UW10은 삭제 전 대상에 대해 이미 통과한다.
  2. 삭제는 실제 트리와 `prev[대상 OBJID]`를 제거하지만, 대기 중 함수는 `is_tree` 객체 참조를 계속 보유한다.
  3. 조회 완료 후 함수는 대상이 여전히 현행 트리에 존재하는지 재검증하지 않고 Undo를 push한 뒤, 분리된 `is_tree.zTREE`에 새 노드를 넣고 새 `prev[자식]` 및 미리보기 인스턴스를 만든다.
  4. 화면 트리에는 자식이 없지만 내부 `prev`/미리보기에 고아 데이터가 남는다. 저장 시 `T_0014`는 현행 트리만 평탄화하는 반면 `getAttrChangedData`는 `for ... in oAPP.attr.prev` 전체를 순회하므로, 트리에 대응 행이 없는 고아 `T_0015`가 실제 payload에 포함된다.
- 대상 삭제 대신 대기 중 metadata/state 또는 동일 aggregation 상태가 바뀌는 경우에도 최초 허용 판정의 유효성을 보장할 재검증이나 작업 세대 검사가 없다. 이는 정상 UI 동작과 지연 Promise만으로 재현 가능하므로 P1로 판정한다.
- 권고: 프리셋 조회가 끝난 뒤 실제 변이 직전에 대상 OBJID가 현재 트리의 동일 객체인지 확인하고, cardinality·UA039·UA040·UW03·UW08·UW10 및 BR43 조건을 한 번 더 검증한 다음 Undo를 push한다. 또는 `designAddUIObject` 전체 수명 동안 WS20 로컬 편집/Undo를 idempotent하게 잠근다.

## 세부 검수

### 1. 원본 순서·조건·파라미터

- 현행 순서는 `designChkFixedParentUI` → `checkDenyChildAggr` → `checkAllowChildAggr`로, 원본 `www/ws30/ws10_20/design/js/uiDesignArea.js:5079`, `:5110`, `:5142`와 같다.
- UW03 호출은 `(추가 UI UIOBK, 부모 UIOBK, aggregation UIATT)`이고, UW08 객체는 `{UIOBK: 부모, UIATT: aggregation, CHILD_UIOBK: 추가 UI}`, UW10 객체는 `{PUIOK: 부모, UIATT: aggregation, UIOBK: 추가 UI}`다. 원본 및 정상 D&D 검증 입력과 일치한다.
- UW03가 `true`이면 helper 내부 306 안내 뒤 즉시 반환한다. UW08이 `true`이거나 UW10이 `true`가 아니면 214 안내 뒤 반환한다. 각 분기는 다음 검사를 실행하지 않아 중복 토스트가 없다.

### 2. 메시지 치환

- `_wsc214`는 `GLANGU`, `ZMSG_WS_COMMON_001`, `214`, `is_0022.UIOBJ`, `is_tree.OBJID`, `is_0023.UIATT` 순으로 전달해 원본 삽입 경로와 같다.
- 마지막 빈 문자열은 `getWsMsgClsTxt(..., p4)`의 네 번째 치환 자리이며 214의 &1~&3 결과에 영향을 주지 않는다.
- UW03의 306은 `designChkFixedParentUI`가 공통 메시지 조회로 자체 표시한다. 새 메시지 키나 DB 변경은 없다.

### 3. fail-closed 및 거부 경로

- `designChkFixedParentUI` 미정의 시 오류를 기록하고 반환하므로 금지 조합을 통과시키지 않는다.
- `checkDenyChildAggr`와 `checkAllowChildAggr`는 같은 파일 `:809-841`에서 조건부 정의되며 정상 로드 계약에서는 호출 가능하다. UW08/UW10 설정이 없으면 각각 `false`/`true`로 처리하는 원본 helper 계약도 보존한다.
- 동기 거부는 프리셋 조회, Undo push, 트리·`prev`·미리보기 변경보다 먼저 끝나며 호출측 Promise `.then`이 자식창 BUSY를 해제한다.

### 4. 경로·범위·정적 검사

- UI 추가 팝업 경로는 D&D 경로와 같은 세 종류의 검증을 갖는다. D&D는 이미 자체 검증 흐름을 사용하므로 한 번의 팝업 confirm에서 이중 실행되지 않는다.
- KEEP-UI5 `uiDesignArea.js`와 메시지 DB에는 BR44 변경이 없다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 및 대상 diff whitespace 검사를 통과했다.
- 제품 코드는 수정하지 않았다.

## 수정 후 필수 회귀 시나리오

1. UW03 거부, UW08 거부, UW10 비허용 각각에서 정확한 메시지 1회·생성 0·Undo 증가 0을 확인한다.
2. 세 검사 허용 조합에서는 정상 생성과 Undo 1회를 확인한다.
3. 프리셋 조회를 지연시키고 대기 중 대상 삭제·Undo·동일 aggregation 편집을 시도해, 로컬 재진입이 차단되거나 완료 후 재검증에서 안전하게 취소되는지 확인한다.

## 독립 재검수 취합

- 독립 서브에이전트도 `_broadBusy`가 현재 WS20을 잠그지 않는 점, 삭제 후 `is_tree`가 분리 객체로 남는 점, `T_0014`와 `T_0015`의 서로 다른 저장 수집 범위를 각각 재확인했다.
- 정적 BR44 이식은 통과하되, 정상 개인화 기능에서 저장 payload 불일치가 발생할 수 있으므로 P1 유지에 동의했다.
