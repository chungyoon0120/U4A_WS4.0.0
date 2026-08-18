# 02_audit_agy — BR42 속성 초기화 시 Undo 복구 스텝 오류 검수

## 판정

**❌ 수정 필요 (P1 1건)**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 AutoGrowing 연동 이벤트 초기화 누락(P1) 팩트체크 및 Reset 실행 전후의 UX 상태/락 해제 안전성을 정밀 교차 검증한 결과입니다.

**[P1] AutoGrowing 연동 이벤트 초기화 누락 팩트체크 및 원인 규명 (에이전트 C, 코덱스 공통)**
- **결함 확정**: 원본(`design/js/uiAttributeArea.js:2189, 2192`)에서는 속성 Reset 루프 내에서 프로퍼티 값 변경 직후 `attrSetDropAbleException(_sAttr, false, true)` 및 `attrSetAutoGrowingException(_sAttr, false, true)` (3번째 인자 `bClear = true`)를 명시적으로 호출했습니다.
- **원인 분석**: 현행 HTML5(`ws_html5_ws20_attr.js:4508`)는 일반 입력 함수인 `fnWs20AttrChange`를 호출하면서 내부의 `attrChangeAutoGrowingProp`를 경유하게 됩니다. 이때 `attrSetAutoGrowingException(is_attr, false)`로만 호출되어 3번째 인자(`bClear`)가 전달되지 않아, 3584행의 `if (bClear !== true) continue;` 가드에 걸려 연동된 서버/클라이언트 이벤트 데이터(`ls_attr.UIATV`, `ls_attr.ADDSC`, `attrDelClientEvent`)가 초기화되지 않고 잔존하는 P1 결함이 발생합니다.
- **수정 방안**: `attrResetAttr` 함수 루프 내(4508행 직후)에 원본 2189/2192행과 같이 `attrSetDropAbleException(_sAttr, false, true)` 및 `attrSetAutoGrowingException(_sAttr, false, true)` 호출을 직접 복원해야 합니다.

**[P2] 'Show Changed Items' 필터 해제 및 Multi-tier Fail-safe 락 해제 완결성 (에이전트 D 증명)**
- **필터 상태 동기화**: 속성을 초기화하면 변경 플래그가 해제되므로, 'Show Changed Items' 필터가 켜져 있으면 화면이 빈 목록으로 바뀌는 UX 혼란을 방지하기 위해 필터를 해제(`sAttrFilt.press = false`)하고 버튼 UI 스타일(`.pressed`, `aria-pressed`)을 동기화하는 로직이 완벽하게 구현되어 있습니다.
- **Fail-safe 락 제어**: 확인 팝업(`parent.showMessage`) 콜백 내부에서 `parent.setBusy("X")`와 `setShortcutLock(true)`를 설정한 후, 다계층 `try-catch-finally` 구조를 통해 리셋 도중 예외가 발생하더라도 `finally` 블록에서 100% 안전하게 락이 해제(`parent.setBusy("")`, `setShortcutLock(false)`)되어 UI 영구 고착이 원천 차단되었음이 입증되었습니다.

*(참고: Undo 1회 적재 플래그(`bUndoPushed`) 및 빈 스택 방지(`continue`), `bSkipUndo=true`의 무결점 사이드이펙트 격리 자체는 1차 검수와 동일하게 완벽합니다.)*

---

## 2. 종합 평가

BR42의 Undo 1회 병합 및 빈 스냅샷 방어, 그리고 팝업/락 해제 Fail-safe 구조는 매우 훌륭하게 설계되어 있습니다. 
그러나 **AutoGrowing 프로퍼티 리셋 시 연동 이벤트(서버/클라이언트)를 함께 지워주는 원본 2192행 로직(`attrSetAutoGrowingException` with `bClear=true`)이 누락**되어 이벤트 데이터가 잔존하는 결함이 최종 확인되었습니다. 따라서 Codex의 지적을 100% 수용하여 **❌ 수정 필요 (P1 1건)** 판정으로 확정하며, `attrResetAttr` 내에 누락된 원본 예외처리 2줄을 복원하는 후속 조치를 권고합니다.
