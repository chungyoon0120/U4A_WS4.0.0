# 02_audit_agy — BR65 바인딩 팝업: aggregation 바인딩 확인 팝업 취소 시 BUSY 미해제 검수

## 판정

**❌ 수정 필요 — P2 1건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 보수적으로 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 `U4AUI.confirm`의 동기 fallback(`window.confirm` 및 `showModal()` throw) 시 Busy ON/OFF 실행 순서 역전 가능성, Electron 14 환경의 다이얼로그 라이프사이클 및 헬퍼 방어 전략을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P2 결함] `U4AUI.confirm` 동기 Fallback 경로에서 Busy ON/OFF 실행 순서 역전으로 YES 처리 중 팝업 잠금 해제 (에이전트 C/D 증명)
- **위치**: `bindWrite.js:322~339`, `theme/u4a-ui.js:2303~2310, 2355~2356`
- **결함 내용**:
  1. `_confirmAsync`는 `U4AUI.confirm`의 `onClose`에서 `setBusyWS20Interaction(true)`를 호출하고, `U4AUI.confirm` 반환 직후에 `setBusyWS20Interaction(false)`를 호출합니다.
  2. 네이티브 비동기 `<dialog>` 경로에서는 정상적으로 `표시 직후 로컬 OFF → 사용자 클릭 → 닫힘 직후 로컬 ON` 순서로 동작합니다.
  3. 그러나 공통 `U4AUI.confirm`이 명시적으로 지원하는 **동기 Fallback 경로(`<dialog>` 미지원 또는 `showModal()` 예외 발생 시 `window.confirm`)에서는 `confirm()` 함수가 반환되기 전에 `onClose`가 동기적으로 먼저 실행**됩니다.
  4. 그 결과 실행 순서가 `onClose 진입(로컬 ON) → resolve("OK") → confirm() 반환 → setBusyWS20Interaction(false)(로컬 OFF)`로 완전히 역전됩니다.
- **영향**: 사용자가 [확인(YES)]을 누른 경우, 후속 `attrSetBindProp` 및 WS20 데이터 동기화 왕복이 진행되는 동안 **바인딩 팝업의 로컬 Busy 오버레이가 풀려 사용자의 중복 조작/D&D가 유입되는 UI 레이스 컨디션**이 발생합니다.
- **수정 방안**: `_confirmAsync` 내부에 플래그(`bReturned`)를 두어 동기 fallback 여부와 무관하게 **"표시 직후 로컬 OFF → 닫힘 직후 로컬 ON → resolve"** 순서가 100% 엄격하게 보장되도록 방어 로직을 보완해야 합니다.

---

### [확인된 정상 범위]
1. 네이티브 `<dialog>.showModal()` 정상 경로에서 3단계 Busy 관리(팝업만 OFF $\rightarrow$ 팝업만 ON $\rightarrow$ 취소 시 전체 OFF)의 순서와 인자 시맨틱(`sOption` 유/무)은 원본과 완벽히 일치하며 취소 시 Busy 고착을 완벽히 해결합니다.
2. 취소 시 조기 `return`으로 기존 aggregation 바인딩 및 하위 속성 바인딩이 100% 무손실 보존됩니다.
3. 네이티브 `showModal()`의 백드롭 및 `#bwpBusy` CSS `pointer-events: none`은 정상 동작합니다.

---

## 2. 종합 평가

BR65 이슈는 네이티브 모달 경로에서의 취소 시 Busy 고착 버그 해결 및 원본 1:1 복원은 매우 훌륭하나, **공통 `U4AUI.confirm`이 지원하는 동기 Fallback 경로에서 Busy ON/OFF 순서가 뒤집혀 YES 처리 중 바인딩 팝업의 잠금이 풀리는 P2 결함**이 확인되었습니다.
동기/비동기 Fallback 무관 순서 보장 방어 패턴 적용을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
