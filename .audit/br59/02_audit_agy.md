# 02_audit_agy — BR59 컨텍스트 메뉴 UI 이동 시 미리보기 위치 어긋남 검수

## 판정

**✅ 통과 (Pass)**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과

본 검수는 서브에이전트 2기(Aggr Index Parity, Move Path & Lifecycle)를 선제적으로 투입하여, 컨텍스트 메뉴 UI 이동 시 동일 Aggregation 그룹 필터링 및 UA026 감산 산식의 1:1 정합성, 이동 경로 가드와 Undo/Busy 라이프사이클의 안전성을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

**[P1] Aggregation 인덱스 및 UA026 감산 공식 1:1 일치 증명 (에이전트 A 증명)**
- **그룹 내 위치 산출**: `_aggrPos(aSib, oNode)`는 동일한 aggregation(`UIATT`)에 속한 자식들만을 필터링하여 인덱스를 구하므로, 원본 `callDesignContextMenu.js`의 `l_indx1`(이동 전) 및 `l_indx2`(이동 후)와 1:1로 완벽히 일치합니다.
- **UA026 감산 공식**: `_aggrPrevIndex(aSib, oNode)`는 동일 그룹 내 앞쪽 형제 중 미리보기에 실제 추가되지 않는 UI(`CATCD === "UA026" && FLD02 !== "X"`) 개수만큼 인덱스를 차감(`iIdx -= 1`)하므로 원본 546~558행의 `l_cnt` 계산과 100% 동일합니다.
- **클로저 안전성**: `_aggrPrevIndex` 루프 내 `sUilib`는 원시 문자열로서 동기 `findIndex` 호출 내에서 즉시 평가되므로 비동기 지연이나 덮어쓰기 참조 오류가 발생하지 않습니다.

**[P3] 경계 조건 조기 탈출 및 음수 인덱스 원천 차단 증명 (에이전트 C 증명)**
- `_moveUI`의 경계 가드(`newIdx < 0 || newIdx >= aSib.length`)가 `_broadBusy(true)` 및 `fnWs20PushUndo()` 호출보다 앞선 라인(717행)에서 즉시 조기 반환(`return`)하므로, 단일 자식 상태이거나 첫 번째에서 Up, 마지막에서 Down 시도 시 불필요한 Undo 스냅샷 적재 및 Busy 락 진입이 원천 차단됩니다.
- `_aggrPrevIndex` 내부의 2단계 가드(`iPos < 0 => 0` 및 `iIdx < 0 => 0`)는 고아 노드나 메타데이터 예외 등 비정상 상황에서도 UI5 `insertAggregation`에 음수 인덱스가 전달되는 것을 완벽히 방어합니다.

**[P4] D&D 형제 경로와의 수학적 인덱스 산출 동등성 및 동기화 무결성 증명 (에이전트 D 증명)**
- `ws_html5_ws20_dnd.js`의 카운트 누적 방식과 `_aggrPrevIndex`의 감산 방식은 여집합 항등식($\text{pos} - \sum \text{UA026} = \sum \text{Non-UA026}$)에 의해 동일한 트리 상태에서 100% 동일한 미리보기 인덱스를 산출합니다.
- 배열 `splice` $\rightarrow$ Undo 스냅샷 $\rightarrow$ 트리 DOM 렌더 $\rightarrow$ UI5 Aggregation 삽입이 단일 스레드 이벤트 루프 내에서 완전 동기(Synchronous) 트랜잭션으로 완결되므로, 단축키나 연속 클릭으로 빠른 이동이 유입되더라도 레이스 컨디션이나 상태 드리프트(State Drift)가 발생하지 않습니다.

---

## 2. 종합 평가

BR59 이슈는 컨텍스트 메뉴를 통한 UI 이동 시 전체 자식 배열 인덱스가 미리보기에 전달되어 발생하던 렌더링 위치 왜곡 문제를, 원본 `callDesignContextMenu.js` 및 D&D 형제 경로와 100% 동일한 Aggregation 필터링/UA026 감산 로직으로 해결한 패치입니다.
경계 조건에서의 Undo 스택 보호, 수학적 인덱스 동등성, 연속 이동 시의 동기화 안정성까지 철저히 검증되었으므로 단 1건의 지적 없이 **✅ 통과(Pass)** 판정을 확정합니다.
