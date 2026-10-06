# 02_audit_agy — BR64 바인딩 팝업: 잘못된 Conversion Routine 이 D&D 바인딩에 적용됨 검수

## 판정

**✅ 통과 (Pass)**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과

본 검수는 서브에이전트 2기(SSOT Parity & Validation Criteria, Pipeline & Busy Symmetry)를 선제적으로 투입하여, 원본 `U4A_WS_DESIGN/Popups/bindPopup/index.js:8380~8413`의 `checkAdditData` 1:1 일치성, D&D 경로와 적용 버튼 경로의 `oAPP.attr.additRows` 스토어 및 `_error` 플래그 공유 무결성, 드롭 차단 파이프라인 전수 추적, 146번 토스트 안내, 그리고 `setBusyWS20Interaction(false, {})` 해제 대칭성을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

**[P1] 원본 1:1 일치성 및 적용 버튼 경로와의 기준 통일 증명 (에이전트 A 증명)**
- **원본 1:1 완벽 일치**: `additInfoArea.js:725~745`에 신규 정의된 `oAPP.fn.checkAdditData`는 원본 `index.js:8380~8413`의 검증 로직(`_error === true` 필터링), 반환 구조체(`{RETCD, RTMSG, T_ERMSG}`), 오류 메시지 번호(`ZMSG_WS_COMMON_001:146` "바인딩 추가속성 정보에 오류건이 존재합니다.")와 1:1로 완벽히 일치합니다.
- **스토어 및 플래그 공유 일치**: D&D 경로(`checkAdditData`)와 적용 버튼 경로(`chkAdditBindData`)는 동일한 인메모리 배열 `oAPP.attr.additRows`(`_rows(oA.MAIN)`)를 참조하며, `convChangeInput:448`에서 세팅/해제되는 `_error` 플래그를 100% 동일하게 공유하여 유효성 검사 기준이 완전히 일관되게 동작합니다.

**[P2] 드롭 차단 파이프라인, Busy 락 대칭성 및 무회귀 증명 (에이전트 B 증명)**
- **사전문턱 완벽 차단**: 드래그 시작(`modelFieldArea.js:277~281`) 시 `checkAdditData()` 호출로 페이로드에 `RETCD: "E"`가 적재되며, 드롭 수신부(`designArea.js:965~966`)에서 `_checkDragData` 판독 즉시 `_setBindAttribute` 실행 전에 완벽히 차단됩니다.
- **토스트 안내 및 Busy 대칭 해제**: 차단 시점(Line 966)에서 `RTMSG`(146번 문구) 토스트가 정상 출력되고, `setBusyWS20Interaction(false, {})`가 직접 호출되어 진입 시 켠 로컬 및 WS20 메인 Busy 락이 100% 대칭 해제됩니다.
- **정상 드래그 100% 무회귀**: 오류가 없는 정상 드래그(`_error === true` 0건) 시 `{RETCD: ""}`가 반환되어 기존 바인딩이 100% 정상 작동하며, WS20 디자인 트리 드롭(`prc002`) 등 타 드래그 경로에 어떠한 부작용도 없습니다.

---

## 2. 종합 평가

BR64 이슈는 HTML5 변환 과정에서 미정의 상태로 비워져 있던 원본의 `checkAdditData` 함수를 정확한 스토어 매핑과 1:1 사양으로 완벽하게 복원하여, 유효하지 않은 추가속성이 D&D로 바인딩되던 결함을 깔끔하게 차단한 고품질 패치입니다.
원본 1:1 일치, 적용 버튼 경로와의 검증 기준 통일, 드롭 차단 및 토스트 안내, Busy 락 대칭성까지 단 1건의 결함 없이 **✅ 통과(Pass)** 판정을 확정합니다.
