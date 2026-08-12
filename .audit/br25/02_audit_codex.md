# 02_audit_codex — BR25 Aggregation 바인딩 해제 확인창 BUSY 검수

## 판정

**통과**

## 지적

없음.

## 검수 결과

### 1. 원본과 같은 시점에 BUSY가 해제된다

- `www/ws30/ws10_20/js/fnBindPopupOpen.js:1454`의 `attrBindCallBackAggr()`는 진입 즉시 `_busy(true)`를 호출한다.
- 공유 `_confirm()`은 `U4AUI.confirm()` 또는 메시지 폴백으로 확인창을 생성한 직후 `_busy(false)`를 실행한다(`1460-1470`).
- 이는 원본 `www/ws30/ws10_20/design/js/uiAttributeArea.js:4753`, `4831`의 `showMessage(...)` 직후 `parent.setBusy("")`와 동작 및 시점이 일치한다.
- 하위 UI가 있는 unbind와 기존 바인딩을 교체하는 bind가 동일 `_confirm()`을 사용하므로 원본의 두 해제 지점이 모두 반영된다.

### 2. 확인창은 바인딩 팝업 종료와 독립적으로 유지된다

- `U4AUI.confirm()`은 새 `<dialog>`를 `document.body`에 붙이고 `showModal()`로 연다(`www/ws30/ws10_20/theme/u4a-ui.js:2208-2278`).
- 이후 호출측 `lf_unbindBtnEvt()`가 실행하는 `lf_close()`는 `oUI.dlg`인 바인딩 팝업만 닫는다(`fnBindPopupOpen.js:548-550`, `1425-1430`).
- 확인창은 별도 DOM이므로 함께 닫히거나 제거되지 않는다. BUSY 해제 후에도 모달 top-layer가 뒷화면 입력을 차단하므로 버튼은 조작 가능하면서 배경은 보호된다.

### 3. YES/NO와 확인창 없는 경로의 BUSY 대칭이 유지된다

- YES: 확인창 콜백이 `_busy(true)`로 다시 잠근 뒤 `fnYes()`를 실행한다.
  - unbind는 `attrUnbindAggr → attrSetUnbindProp → fnWs20AttrChange`와 `attrUnbindTree`를 수행한다.
  - bind 교체는 기존 aggregation을 해제한 뒤 `attrSetBindProp → fnWs20AttrChange`와 `attrUnbindTree`를 수행한다.
  - `fnWs20AttrChange()`는 시작 시 BUSY/단축키/자식창 BUSY를 켜고 `finally`에서 모두 해제한다(`www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3324-3457`).
- NO·ESC: 공통 confirm이 `NO`로 닫히고 콜백이 `_busy(false)`를 수행한다. 데이터 변경 함수는 호출되지 않아 기존 바인딩과 하위 UI가 유지된다.
- 하위가 없는 unbind와 신규 직접 bind는 확인창을 거치지 않아 진입 BUSY를 유지한 채 공통 속성 변경 왕복이 최종 해제한다. 원본의 자기해제 금지 흐름과 같다.

### 4. 데이터 처리와 공통 자산 경계에 회귀가 없다

- YES unbind는 하위 UI 객체를 삭제하지 않고, 하위 바인딩 수집정보와 부모 aggregation 바인딩을 해제한 뒤 Tree/TreeTable 예외 속성도 정리한다.
- 추가 변경은 `_confirm()` 끝의 `_busy(false)`와 설명 주석뿐이다. `resources/index.js`의 공통 `setBusy`, `theme/u4a-ui.js`의 공통 confirm, KEEP-UI5 원본은 수정되지 않았다.
- 신규 catch나 오류 억제는 추가되지 않았다.
- 메시지는 원본과 동일한 122·123 키를 사용한다.

## 분기별 점검

| 경로 | 확인창 직전 | 확인창 표시 후 | 선택 후 | 최종 상태 |
|---|---|---|---|---|
| 하위 존재 unbind / YES | BUSY ON | BUSY OFF | BUSY 재ON 후 해제 처리 | 공통 변경 `finally`에서 OFF |
| 하위 존재 unbind / NO·ESC | BUSY ON | BUSY OFF | 데이터 변경 없음 | OFF 유지 |
| 기존 aggregation 재bind / YES | BUSY ON | BUSY OFF | BUSY 재ON 후 unbind+bind | 공통 변경 `finally`에서 OFF |
| 기존 aggregation 재bind / NO·ESC | BUSY ON | BUSY OFF | 데이터 변경 없음 | OFF 유지 |
| 하위 없는 unbind | BUSY ON | 확인창 없음 | 즉시 unbind 왕복 | 공통 변경 `finally`에서 OFF |
| 신규 직접 bind | BUSY ON | 확인창 없음 | 즉시 bind 왕복 | 공통 변경 `finally`에서 OFF |

## 수용 기준 점검

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 원본 `setBusy("")` 시점 1:1 | 통과 | confirm 생성 직후 해제 |
| 하위 존재 unbind 확인/취소 | 통과 | 조작 가능, YES만 데이터 변경 |
| 재바인딩 확인/취소 | 통과 | 동일 공유 confirm 경로 |
| 확인창 없는 왕복 경로 | 통과 | 공통 `fnWs20AttrChange.finally`가 해제 |
| 바인딩 팝업 종료 후 confirm 유지 | 통과 | 서로 다른 dialog DOM |
| 공통 자산·KEEP-UI5 무수정 | 통과 | 화면 코드 한 곳만 변경 |
| 메시지 키 보존 | 통과 | 122 + 123 |
| 오류 삼킴 추가 없음 | 통과 | 신규 catch 없음 |
| JavaScript 구문 검사 | 통과 | `node --check fnBindPopupOpen.js` |

## 잔여 참고

- 공통 `U4AUI.confirm`은 `<dialog>` 미지원 또는 `showModal()` 실패 시 동기 `window.confirm()` 폴백을 제공한다. 그 극단적 폴백에서는 YES 콜백이 `_confirm()` 반환 전에 실행되어, 뒤따르는 `_busy(false)`가 콜백의 재잠금을 다시 끌 수 있다. 현재 Electron Chromium 환경은 `<dialog>.showModal()`을 지원하므로 BR25 재현 경로에는 해당하지 않아 결함으로 판정하지 않았다. 구형/비표준 런타임까지 지원 범위에 포함한다면 `_confirm`의 동기 콜백 가능성을 별도로 정규화하는 것이 안전하다.
- 검증은 활성 소스와 호출 계약에 대한 정적 분석이며 실제 UI 클릭 및 서버 연동 테스트는 수행하지 않았다.

