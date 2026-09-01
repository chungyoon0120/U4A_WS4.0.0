# 02_audit_agy — BR58 도움말(Tooltips) 팝업 구버전 서버 폴백 이식 검수

## 판정

**❌ 수정 필요 — P1 2건, P2 2건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 `loadURL` 비동기 Rejection 및 `did-fail-load` 시 Busy 락 고착, 통합 도움말 `async` 미대기에 따른 잠금 잔류, 패치 서버에서의 오폴백, 그리고 임의 코드 화면 노출 규칙을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P1-1 결함] `loadURL()`의 비동기 Rejection 및 조기 창 종료 시 메인 창 Busy 락 영구 고착 (에이전트 C 증명)
- **위치**: `ws_html5_call_tooltips_popup.js:86~133`
- **결함 내용**:
  1. `oWin.loadURL(l_path)`는 비동기 Promise를 반환하므로 로드 실패 시 동기 `try/catch` 블록으로 잡히지 않습니다.
  2. 현재 `_releaseLock()`은 `did-finish-load`와 동기 `catch` 블록에만 존재하며, `did-fail-load`, `render-process-gone`, 로드 완료 전 `closed` 이벤트에 대한 해제 리스너가 누락되었습니다.
- **영향**: 파일 I/O 실패, 내비게이션 오류, 또는 로딩 중 창 닫힘 시 `_releaseLock()`이 영영 호출되지 않아 **메인 창의 Busy 오버레이와 단축키 잠금이 영구 고착(Hang)**됩니다.
- **수정 방안**: 멱등적(Idempotent) 단일 자원 정리/해제 함수(`cleanup`)를 정의하여 `did-finish-load`, `loadURL().catch()`, `did-fail-load`, `closed` 등 모든 종료/실패 라이프사이클에서 1회 반드시 락이 해제되도록 보강해야 합니다.

### [P1-2 결함] 통합 도움말(`fnU4AHelpDocuPopupOpener`)의 비동기 Rejection 미처리로 인한 Busy 잔존 (에이전트 C 증명)
- **위치**: `ws_html5_ws20_tree.js:409~420`, `ws_html5_ws20_attr.js:5359~5367`, `ws_html5_ws20_prev.js:1117~1128`
- **결함 내용**: `fnU4AHelpDocuPopupOpener`는 `async` 함수인데, 3개 영역 핸들러가 이를 `await`나 `.catch()` 없이 동기 `try/catch`로만 감싸고 있습니다. 내부에서 Promise Rejection이 발생하면 동기 `try`를 그대로 통과하여 Unhandled Rejection으로 빠집니다.
- **영향**: 핸들러 진입 시 걸린 `parent.setBusy("X")`가 풀리지 않고 **메인 창 Busy가 영구 잔류**합니다.
- **수정 방안**: 3개 핸들러에서 `fnU4AHelpDocuPopupOpener`를 `await`하거나 `.catch()`를 연결하여 비동기 실패 시에도 `parent.setBusy("")`가 확실히 호출되도록 보완해야 합니다.

### [P2-1 결함] 패치 서버 환경에서 opener 미로드 시 잘못된 구버전 도움말 폴백 (에이전트 D 증명)
- **위치**: `ws_html5_ws20_tree.js:410~416`, `ws_html5_ws20_prev.js:1120~1124`
- **결함 내용**: `checkWLOList(...) === true && typeof opener === "function"`로 단일 조건 결합되어 있어, 패치 서버인데 opener 로드만 실패한 경우 `if` 문을 빠져나와 구버전 `callTooltipsPopup`으로 잘못 폴백됩니다.
- **수정 방안**: 패치 서버 판정(`checkWLOList === true`) 시 구버전 경로로 빠지지 않도록 분리하고, opener 미로드 시 에러 로깅(`WS20HELP-11/31`) 및 busy 해제 후 조기 리턴해야 합니다.

### [P2-2 결함] 사용자 화면에 미등록 임의 코드 `WS20HELP-02` 직접 노출 (에이전트 D 증명)
- **위치**: `ws_html5_call_tooltips_popup.js:126`
- **결함 내용**: `parent.showMessage(null, 10, "E", "WS20HELP-02")`를 통해 사용자 화면 토스트에 임의의 내부 추적 코드가 그대로 노출됩니다 (`.claude/rules/code.md` 임의 문구/키 생성 금지 위반).
- **수정 방안**: 화면 토스트 호출을 제거하거나 공통 메시지 키를 조회하여 배선해야 합니다.

---

### [확인된 정상 범위]
1. 원본 `callTooltipsPopup.js`가 UI5 컨트롤 비의존적 구조임이 확인되었습니다.
2. 정상 구버전 서버에서의 3개 영역 창 옵션, 다국어 경로, 센터링 및 페이드인은 원본과 일치합니다.
3. `_tbBtn`의 `press.call(BTN)` 변경은 다른 버튼들에 부작용이 없습니다.

---

## 2. 종합 평가

BR58 이슈는 정상 경로의 구버전 도움말 폴백 배선은 잘 이루어졌으나, **`loadURL` 비동기 실패 시 메인 창 Busy 영구 고착(P1-1)**, **통합 도움말 `async` Rejection 미대기로 인한 Busy 잔존(P1-2)**, **패치 서버에서의 오폴백(P2-1)**, **임의 코드 화면 노출(P2-2)**의 4건의 결함이 명확히 확인되었습니다.
해당 항목들을 보완하는 수정을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
