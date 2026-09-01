# 02_audit_agy — BR63 바인딩 팝업: D&D 바인딩 후 추가속성 설정값 초기화 검수

## 판정

**❌ 수정 필요 — P1 1건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 보수적으로 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 `UPDATE_DESIGN_DATA` 수신 시 원본의 `await moveDesignPage()` 순서 계약 누락, 동일속성 동기화 화면(`bSyncEqualityScreenActive`) 진행 중 버튼 조기 활성화 및 조기 Busy 해제 레이스 컨디션을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P1 결함] `moveDesignPage()` 누락으로 동일속성 화면 진행 중 버튼 조기 활성화 및 조기 Busy 해제 레이스 컨디션 (에이전트 C/D 증명)
- **위치**: `bindBroadcast.js:114~137`, `broadcastChannelBindPopup.js:278~282`
- **결함 내용**:
  1. 원본 `broadcastChannelBindPopup.js:278~282`는 `updateDesignData` 수신 시 반드시 **`await oAPP.attr.oDesign.fn.moveDesignPage()`를 먼저 수행**하여 동일속성 화면(`PG_SYNC`)을 teardown하고 메인 디자인 트리(`PG_MAIN`)로 완전히 복귀한 **뒤**에 `setAdditBindButtonEnable(true)`를 호출하는 엄격한 순서 계약을 가집니다.
  2. 그러나 HTML5 `bindBroadcast.js`의 `_fnRebuild`에는 `moveDesignPage()` 호출이 누락되어 있어, 동일속성 일괄 적용(`designArea.js:735~772`) 중 260ms 복귀 애니메이션이 완료되기 전에 WS20 방송이 도달하면 **동일속성 활성 상태(`bSyncEqualityScreenActive === true`)에서 C2가 우측 바인딩 버튼을 조기 활성화하고 `finally`에서 로컬/전역 Busy를 조기 해제**합니다.
  3. `additInfoArea.js`의 버튼 핸들러(`onMultiAdditionalBind`)에는 동일속성 가드가 없어, 화면 전환/일괄 적용 continuation이 끝나지 않은 상태에서 사용자가 버튼을 클릭하여 중첩 쓰기 및 추가 방송이 유입되는 **데이터 변경 경쟁(Data Race)**이 발생합니다.
- **수정 방안**: `bindBroadcast.js`의 `_fnRebuild`를 `async` 함수로 정의하고 원본과 동일하게 `if (typeof oAPP.fn.moveDesignPage === "function") { await oAPP.fn.moveDesignPage(); }`를 선행 실행한 뒤 버튼 활성화 및 Busy 해제를 수행하도록 순서 계약을 복원해야 합니다.

---

### [확인된 정상 범위]
1. 원본 `broadcastChannelBindPopup.js` 269, 289, 307행이 실제 주석 처리되어 있으며, C1(`setAdditialListData()` 제거)은 원본 1:1 일치 및 D&D 후 속성값 보존(연속 바인딩)에 100% 무결합니다.
2. 우측 MAIN 속성값(Conversion Routine 등)은 DOM뿐만 아니라 `oA.MAIN.data` 인메모리 모델에 안전하게 상주합니다.
3. 팝업 내부 드롭 경로(`designArea.js:941~948`)는 원본 설계대로 초기화 로직을 유지하도록 올바르게 분리되어 있습니다.

---

## 2. 종합 평가

BR63 이슈는 C1의 추가속성 리셋 버그 원인 규명 및 제거는 완벽하지만, **C2 복원 과정에서 원본의 선행 순서 계약인 `await moveDesignPage()`가 누락되어 동일속성 화면 진행 중 조기 버튼 활성화 및 조기 Busy 해제를 유발하는 P1 레이스 컨디션**이 확인되었습니다.
`moveDesignPage()` 선행 await 복원을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
