# BR41 Codex 검수 결과

## 판정

**통과**

삭제 UI와 그 하위 UI의 클라이언트 이벤트(`JS`)·HTML content(`HM`)를 `T_CEVT`에서 제거하는 구현이 원본 조건과 일치하며, 단건·멀티 삭제 경로 모두에 `prev` 삭제 전에 배선되어 있다. 무관한 UI 레코드를 삭제하는 경로는 확인되지 않았다.

## 지적

없음.

## 검수 상세

### 1. 삭제 대상 키 정확성 — 통과

- 구현: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:361~375`
- 원본: `www/ws30/ws10_20/design/js/uiDesignArea.js:2043~2071`

HTML content는 `is_tree.OBJID + "CONTENT"`이면서 `OBJTY === "HM"`인 한 행만 찾고, JS 이벤트는 `_T_0015`의 `UIATY === "2"` 항목별로 `is_tree.OBJID + UIASN`이면서 `OBJTY === "JS"`인 행만 찾는다. 두 경우 모두 완전 일치 비교이므로 `HTML1` 삭제가 `HTML10` 레코드를 지우는 식의 접두 오삭제가 없다. OBJID가 같더라도 OBJTY가 다른 레코드도 유지된다.

### 2. 하위 재귀 커버리지 — 통과

- 구현: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:408~420`
- 단건 진입: 같은 파일 `454~456`
- 멀티 진입: 같은 파일 `613~626`

`_purgePrevSubtree`는 각 자식에 대해 먼저 재귀 호출하고 그 자식의 이벤트를 제거하는 후위 순회다. 따라서 자식·손자 깊이에 제한 없이 하위 전체를 처리한다. 단건 삭제에서는 본인을 `_removeNodePreview`가, 남은 하위를 `_purgePrevSubtree`가 담당한다. 멀티 삭제에서는 체크된 자식을 먼저 개별 제거하고, 체크 전파가 불완전한 경우 부모 아래 남은 하위를 `_purgePrevSubtree`가 보완한다.

### 3. `prev` 참조 순서 — 통과

- 본인: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:394~395`
- 하위: 같은 파일 `414~415`

두 경로 모두 `delUiClientEvent` 호출이 명시적인 `delete oAPP.attr.prev[OBJID]`보다 앞선다. 따라서 함수가 `_T_0015`를 읽을 때 `prev` 엔트리가 유지된다. 미리보기 `destroyUIPreView`는 현행 `design/preview/index.js:6252~6261`에서 UI 인스턴스의 `destroy()`만 호출하고 `parent.oAPP.attr.prev` 엔트리를 삭제하지 않으므로 이 순서를 깨지 않는다.

### 4. 원본 1:1 조건 — 통과

- HTML 판정: `UIFND === "SAP.UI.CORE.HTML"`
- HM 키/타입: `OBJID + "CONTENT"`, `OBJTY === "HM"`
- 이벤트 필터: `UIATY === "2"`
- JS 키/타입: `OBJID + UIASN`, `OBJTY === "JS"`
- 삭제 방식: `findIndex` 후 인덱스가 존재할 때 `splice(index, 1)`

원본 `uiDesignArea.js:2034~2074`의 처리 순서와 조건을 유지한다. HTML5에서 필요한 배열·객체 존재 가드만 추가됐고 삭제 범위를 넓히는 임의 조건은 없다.

### 5. 삭제 경로 전용성 — 통과

`_removeNodePreview` 호출은 단건 삭제 `_deleteUI`와 멀티 삭제 `designTreeMultiDeleteItem`에만 있고, `_purgePrevSubtree`도 같은 두 삭제 경로에서만 호출된다. 이동·추가·복사·붙여넣기 경로에서 호출되지 않는다.

### 6. 중복 호출 무해성 — 통과

멀티 삭제에서 선행 처리로 `prev[OBJID]`가 이미 제거됐으면 `oPrev` 가드(`edit.js:358~359`)에서 즉시 반환한다. 첫 호출이 이미 대상 `T_CEVT`를 제거한 상태에서 다시 호출돼도 `findIndex === -1`이면 건너뛰므로 중복 삭제로 다른 행이 당겨져 오삭제되지 않는다.

### 7. 루프 클로저 — 통과

루프에서 먼저 현재 항목의 키를 지역 변수 `sKey`로 계산한 뒤 동기식 `Array.prototype.findIndex` 콜백이 이를 참조한다(`edit.js:370~374`). 비동기 예약이 없으므로 `var i`의 최종값을 뒤늦게 참조하는 클로저 문제는 없다.

### 8. 결손 가드 — 통과

`is_tree`, `oAPP.DATA.APPDATA`, `T_CEVT` 배열, `prev[OBJID]`, `_T_0015` 배열을 순서대로 검사한다(`edit.js:356~359`). `T_CEVT` 미존재·비배열, `prev` 미존재, 빈 속성 배열에서 예외 없이 종료한다.

## 실행 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- 현행 파일에서 `delUiClientEvent` 함수 본문을 직접 추출하여 Node VM으로 실행:
  - 대상 HTML의 `CONTENT|HM` 제거 확인
  - 대상 UI의 복수 `UIASN|JS` 제거 확인
  - 비슷한 OBJID(`HTML10CONTENT`), 다른 UI, 동일 키·다른 OBJTY 유지 확인
  - 동일 대상 재호출, `prev` 결손, `T_CEVT` 비배열 시 무예외 확인
- 결과: `BR41 extracted-function tests: PASS`

## 검수 한계

실제 Electron WS20 화면에서 단건·멀티 삭제를 조작하는 회귀시험은 수행하지 않았다. 다만 핵심 삭제 함수는 실제 소스 본문을 추출해 실행 검증했고, 두 삭제 호출 그래프와 재귀·호출 순서는 정적으로 확인했다.

---

## 2026-08-14 독립 재검수 취합

사용자 요청에 따라 3개 서브에이전트가 서로 다른 관점으로 독립 재검수했고, Codex 본 검토와 교차 취합했다.

### 재검수 결론

**통과 유지 — 새 차단 결함 없음**

| 검토 축 | 독립 결과 | 핵심 확인 |
|---|---|---|
| 데이터·경계값 | 통과 | 정확한 HM/JS만 삭제, 유사 OBJID·다른 OBJTY 보존, 결손 가드와 동기 클로저 안전 |
| 삭제 호출 그래프 | 통과 | 단건·멀티 후위순회, 역순 splice, 체크/미체크 하위 보완, prev 삭제 전 호출, 비삭제 경로 오호출 없음 |
| 원본 동등성·실행 검증 | 통과 | 원본/현행 의미 동등, 무작위 500상태 비교 및 전체 모듈 단건·멀티 VM 시험 PASS |

### 추가 실행 검증

- 원본 `uiDesignArea.js` 함수와 현행 이식 함수를 직접 추출하여 무작위 500개 상태 비교: **PASS**
- 유사 OBJID·접미 키·다른 OBJTY 보존 경계시험: **PASS**
- 현행 모듈 전체 VM 로드 후 단건 부모 + 2단계 자손 삭제: **PASS**
- 현행 모듈 전체 VM 로드 후 멀티 bottom-up 삭제: **PASS**
- `node --check`: **PASS**

### 비차단 관찰사항

1. 동일 `(OBJID, OBJTY)`의 중복 `T_CEVT` 행이 이미 존재하면 원본과 현행 모두 `findIndex + splice` 1회로 최초 한 행만 삭제한다. 정상 편집기는 해당 키를 upsert하여 중복을 만들지 않으므로 현재 데이터 계약에서는 재현되지 않는다.
2. `HM` 행이 존재하더라도 `prev._T_0015`가 결손·빈 배열이면 원본과 현행 모두 선행 반환한다. 정상 HTML 저장은 content 속성행을 함께 갱신하고, 로더도 HM 존재 여부와 content 속성행을 정합화하므로 정상 흐름의 실패 근거는 없다.
3. 호출부 `catch`가 삭제 예외를 조용히 삼킨 뒤 `prev` 삭제를 계속하므로 비정상 객체나 예외성 getter 상황의 진단성은 낮다. 현행 함수가 일반 결손 상태를 모두 가드하고 있어 BR41 정상 데이터 범위의 기능 결함으로 판정하지 않았다.

실제 Electron 화면 조작은 이번 재검수에서도 수행하지 않았다. 대신 독립 정적 분석 3회와 실제 소스 기반 VM 검증으로 기존 판정을 보강했다.
