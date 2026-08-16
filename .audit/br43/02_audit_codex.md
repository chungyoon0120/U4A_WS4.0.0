# BR43 Codex 검수 결과

## 판정

**수정 필요 (P1 1건)** — BR43의 정적 조건은 원본과 일치하지만, 검사 전에 열린 비동기 구간 때문에 cardinality와 Undo의 원자성이 깨질 수 있다.

## 필수 지적

### [P1] 개인화 조회 대기 중 재진입하면 선행 검증과 Undo가 무효화된다

- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:909`에서 `chkUiCardinality`를 한 번 검사한 뒤, `:928`에서 Undo 스냅샷을 먼저 push하고 `:931`에서 `_readAttrPreset(...)`을 `await`한다. BR43의 binding/cnt 재검사와 clamp는 이 대기 뒤인 `:944-952`에 있다.
- confirm 경로 `:1623-1629`는 삽입 팝업을 닫고 `_broadBusy(true)`를 호출하지만, `_broadBusy`(`:85-87`)는 자식창에만 `BUSY_ON`을 방송한다. 현재 WS20 자체의 Undo/편집 재진입을 막는 잠금이나 작업 세대 검사는 없다.
- 따라서 개인화 적용이 켜지고 프리셋 DB 조회가 지연된 동안 다음 순서가 가능하다.
  1. 자식이 없는 바인딩 aggregation에 `cnt=2`로 추가를 시작한다. cardinality 검사는 통과하고 삽입 전 스냅샷이 Undo 스택에 들어간다.
  2. `_readAttrPreset` 대기 중 Undo를 실행하거나, 같은 aggregation에 다른 경로로 자식을 추가/바인딩 상태를 변경한다.
  3. 조회가 완료되면 이전 호출이 계속 실행된다. 이미 자식이 생겼어도 cardinality를 다시 검사하지 않고 BR43는 `cnt=1`만 적용한 뒤 한 개를 더 생성할 수 있다. 먼저 소비된 Undo 스냅샷 때문에 재개된 삽입이 정상적으로 되돌아가지 않거나, 중간 편집까지 함께 복원될 수도 있다.
- 이는 지연 Promise와 허용된 UI 동작만으로 재현할 수 있으며, 바인딩 aggregation의 기존-child 금지 및 Undo 신뢰성을 깨뜨리므로 P1로 판정한다.
- 권고: `_readAttrPreset`을 Undo push보다 먼저 완료하고, 실제 변이 직전에 `chkUiCardinality`와 BR43 조건을 같은 상태에서 다시 평가한 후 Undo를 push한다. 더 안전하게는 `designAddUIObject` 전체 수명 동안 WS20 로컬 편집·Undo 재진입을 막는 idempotent 잠금 또는 작업 세대 검사를 둔다.

## 검수 결과

### 1. 원본 조건과 처리의 1:1 대응

- 현행 `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:944-953`은 부모 `prev[is_tree.OBJID]._T_0015`에서 `UIATK === is_0023.UIATK && UIATY === "3"`인 aggregation 값 행을 찾는다.
- 찾은 행이 `UIATV !== ""`, `ISBND === "X"`이고 정규화된 `cnt >= 2`일 때만 `cnt = 1`로 제한하고 메시지 키 `021`을 경고 타입으로 표시한다.
- 이는 원본 `www/ws30/ws10_20/design/js/uiDesignArea.js:5169-5176`의 조회 대상, 조건, 제한값 및 메시지 키와 일치한다. 원본의 단일 `&`는 이 비교식에서 boolean을 0/1로 강제하는 형태이고, 현행의 논리 `&&`는 의도된 boolean 판정을 보존하면서 단락 평가를 적용한다.

### 2. `chkUiCardinality`와의 분업 및 중복 안내 여부

- 현행 `chkUiCardinality`(`ws_html5_ws20_edit.js:851-866`)는 같은 aggregation 자식이 이미 존재하는 `idx !== -1` 상태를 처리한다.
  - `ISMLB === ""`: 022를 표시하고 전체 추가를 차단한다.
  - `ISMLB === "X"`이면서 값 있음+바인딩 상태: 021을 표시하고 전체 추가를 차단한다.
- `designAddUIObject`는 이 함수가 `true`이면 `ws_html5_ws20_edit.js:909`에서 즉시 반환하므로 BR43 구문까지 도달하지 않는다. 따라서 기존 자식이 있는 경로에서 021이 두 번 표시되지 않는다.
- 같은 aggregation 자식이 없는 `idx === -1` 경로에서는 선행 검사가 통과하고 BR43가 값 있음+바인딩+`cnt >= 2`만 1개로 제한한다. 원본의 두 단계 분업과 같다.

| 상태 | 결과 |
|---|---|
| 값 있음 + 바인딩 + 기존 자식 있음 | 선행 cardinality 검사에서 추가 전체 차단, 021 1회 |
| 값 있음 + 바인딩 + 기존 자식 없음 + cnt 2 이상 | BR43에서 cnt=1, 021 1회, 1개 생성 |
| 값 있음 + 바인딩 + 기존 자식 없음 + cnt 1 | 안내 없이 1개 생성 |
| 값 없음 또는 비바인딩 + 0:N | 요청 개수 생성 |
| 부모 prev 또는 `_T_0015` 없음 | BR43 검사 안전 통과 |

### 3. 실행 순서와 변경 경계

- `i_cnt`는 함수 진입 시 `parseInt` 후 양수가 아니면 1로 정규화되므로 반복문의 상한은 수치형 `cnt`다.
- BR43 구문은 생성 반복문 `ws_html5_ws20_edit.js:956` 직전에 있어 첫 `T_0014`, 자식 `prev._T_0015`, 트리 삽입 및 미리보기 생성보다 먼저 개수를 확정한다.
- 동기 실행만 보면 Undo 스냅샷은 모델 변경 전에 저장된다. 그러나 스냅샷과 생성 사이의 `await` 동안 로컬 재진입이 가능하므로 하나의 원자적 사용자 작업이라는 보장은 성립하지 않는다.

### 4. 안전성·메시지·범위

- `oAPP.attr.prev`, 대상 부모 및 `_T_0015` 부재를 가드하며, 정상 데이터 계약에서 `_T_0015`는 배열이므로 `.find` 조회가 유효하다. 조회부의 예외도 생성 전 catch되어 호출 전체를 깨뜨리지 않는다.
- 메시지는 기존 공통 조회 `_msgWs("021", ...)`와 `parent.showMessage(null, 10, "W", ...)`를 사용한다. 새 문구나 메시지 키를 추가하지 않았다.
- KEEP-UI5 원본 `uiDesignArea.js`에는 BR43 변경이 없고, BR44의 UW03/UW08/UW10 복원 범위도 이 변경에 포함되지 않았다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js`와 대상 diff whitespace 검사를 통과했다.

## 잔여 확인 사항

- 정적 조건과 동기 경로 자체는 원본과 일치한다. 수정 후에는 `_readAttrPreset`을 의도적으로 지연시킨 상태에서 대기 중 Undo 및 동일 aggregation 편집을 시도해, 재진입 차단 또는 변이 직전 재검증과 Undo 순서가 보장되는지 회귀 테스트해야 한다.
- 제품 소스는 수정하지 않았다.
