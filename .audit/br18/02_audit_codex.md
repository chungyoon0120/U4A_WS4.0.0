# 02_audit_codex — BR18 미리보기 위치 이동 팝업

## 판정

**수정필요**

잔존 UI5 `loadLibrary` 호출을 제거하고 HTML5 다이얼로그로 바꾼 방향과 1-based 입력을 0-based 콜백 값으로 변환하는 계산은 맞다. 다만 확정 작업 중 로컬 BUSY 계약이 누락됐고, 팝업 열기 실패가 성공처럼 처리되며, 공통 팝업 필수 배선과 원본 키보드 동작에도 편차가 있다.

## 지적

### 1. 확정 시 원본의 로컬 BUSY ON이 빠져 실제 이동 작업 동안 화면이 잠기지 않음

- 위치: `www/ws30/ws10_20/design/js/uiMovePosition.js:105`
- 문제: 원본은 확인 버튼에서 먼저 `parent.setBusy("X")`를 호출한 뒤 콜백을 실행한다(`_uiMovePosition_ui5_asis.js.bak:135-156`). 현행 `lf_ok`는 오히려 `lf_close()`로 단축키 잠금을 먼저 해제한 후 콜백을 호출하며 로컬 BUSY를 켜지 않는다. 콜백 대상 `contextMenuUiMove`는 바인딩 팝업 방송 `BUSY_ON`만 보내고(`callDesignContextMenu.js:430-438`), 로컬 `parent.setBusy("X")`는 켜지 않는다.
- 영향: `designRefershModel`, 미리보기 재생성·rerender, 트리 재선택이 끝나기 전에 사용자가 다시 조작할 수 있어 WP1의 연타 방지와 원본 동작이 깨진다.
- 근거: 원본 `_uiMovePosition_ui5_asis.js.bak:138-156`; `uiMovePosition.js:90-112`; `callDesignContextMenu.js:430-590`; `.claude/rules/code.md` busy/WP1 규칙.

### 2. `showModal()` 실패를 삼킨 뒤 정상 오픈처럼 BUSY를 해제함

- 위치: `www/ws30/ws10_20/design/js/uiMovePosition.js:135`
- 문제: `showModal()`이 실패해도 빈 `catch`로 삼키고 곧바로 단축키와 BUSY를 해제한다. 이 경우 팝업은 열리지 않았는데 DOM에는 다이얼로그가 남고 사용자는 실패 안내를 받지 못한다. 또한 61~134행의 생성·배선 과정에서 예외가 발생하면 142~143행 해제 자체에 도달하지 못해 BR18과 동일한 화면 잠금이 남는다.
- 영향: 실패 시 부분 DOM 정리, BUSY/단축키 해제, 오류 표면화가 한 종료 경로로 보장되지 않는다.
- 근거: `uiMovePosition.js:61-144`; `.claude/rules/code.md`의 모든 오류 종료 분기 BUSY OFF 및 조용한 catch 금지.

### 3. 공통 팝업 3종 세트 중 `makeDialogDraggable` 배선이 없음

- 위치: `www/ws30/ws10_20/design/js/uiMovePosition.js:128`
- 문제: 현행은 `makeDialogRecenter`와 `makeDialogResizable`만 호출한다. `.analy/16_공통_화면UX_표준.md §2.2`에는 전역 드래그 위임 설명이 있지만, 저장 직전 강제 규칙인 `.claude/rules/code.md`는 `<dialog>`마다 `makeDialogDraggable`·`makeDialogRecenter`·`makeDialogResizable` 3종을 함께 배선하도록 명시한다.
- 영향: 현재 전역 위임 존재 여부에 의존하며 요청서의 공통 3종 세트 수용 기준을 코드 자체로 충족하지 못한다.
- 근거: `uiMovePosition.js:128-132`; `.claude/rules/code.md:7`.

### 4. Enter 동작과 푸터 취소 메시지 키가 원본 1:1이 아님

- 위치: `www/ws30/ws10_20/design/js/uiMovePosition.js:125`
- 문제: 원본 Enter는 확인 버튼으로 포커스만 이동한다(`_uiMovePosition_ui5_asis.js.bak:109-117`). 현행은 Enter 즉시 `lf_ok()`를 실행해 이동을 확정한다. 또한 원본의 헤더 닫기와 푸터 닫기 툴팁은 모두 A39인데 현행 푸터는 A41이다(`uiMovePosition.js:67`, `82`). 자매 팝업과의 통일만으로 원본 SSOT 편차를 정당화할 수 없다.
- 영향: 숫자 입력 중 Enter 한 번으로 즉시 이동되는 새 동작이 생기며, 명시적 사용자 지시 없이 메시지 키도 변경됐다.
- 근거: 원본 `_uiMovePosition_ui5_asis.js.bak:57-70`, `109-117`, `161-174`; `.claude/rules/code.md` 원본 1:1·메시지 키 규칙.

## 확인된 정상 항목

- 기존 오류 원인인 `sap.ui.getCore().loadLibrary`와 `sap.m.*` 생성 코드는 현행 파일에서 제거됐다.
- 함수 시그니처는 유지됐다.
- `pos`와 `max`는 1..max로 방어되고, 확정 값은 `v - 1`로 0-based 변환되어 splice index로 전달된다.
- 숫자 입력과 range 슬라이더는 양방향 동기화되고 1..max로 클램프된다.
- 동일 위치 확정 시에도 콜백하는 동작은 원본에 충실하므로 유지가 맞다.
- `designMoveMark` 제거는 HTML5 자매 팝업과의 통일 근거는 있으나 원본의 위치 미리보기 기능을 제거하는 편차이므로 MP2·MP3에서 사용성 손실 여부를 확인해야 한다.
- 공통 클래스와 의미 색 토큰을 사용하며 hex 및 `color-mix`는 없다. 다만 `width:min(92vw,360px)`의 360px 상한은 고정 px 폭 0건 수용 기준과 문구상 충돌하므로 반응형 검증 시 함께 정리하는 편이 안전하다.
- 대상 파일은 `node --check`를 통과했다.

## 제안

1. 확인 시 원본처럼 로컬 BUSY와 단축키를 먼저 켜고 실제 이동 완료 Promise까지 직렬화한다. 성공은 기존 왕복, 오류는 명시적 정리 경로가 해제하게 한다.
2. 팝업 생성·공통 배선·`showModal()`을 하나의 오류 정리 경로로 감싸고 열림 성공을 확인한 뒤에만 초기 BUSY를 해제한다. 실패 시 부분 생성 DOM과 리스너를 정리하고 오류를 표면화한다.
3. `makeDialogDraggable(oDlg, oHeader)`를 나머지 두 함수와 함께 배선한다.
4. Enter는 확인 버튼 포커스 이동으로 복원하고 푸터 툴팁은 원본 A39로 맞춘다. 다르게 할 필요가 있으면 원본 편차로 명시 승인받는다.

## 실화면 검증 상태

`.works/미리보기위치이동/00_현황판.md`의 MP1~MP7이 모두 미테스트(`☐`)이므로 동적 동작은 아직 통과로 판정할 수 없다.
