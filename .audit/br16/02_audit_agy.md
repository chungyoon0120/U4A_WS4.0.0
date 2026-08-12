# 02_audit_agy — BR16 미리보기 우클릭 삭제 BUSY

## 판정

**수정필요**

확인창 대기 상태에서 잠금 방송이 떠 화면을 덮는 현상을 없애기 위해 확인창 이전의 잠금 방송을 제거하고 삭제 확정(YES) 콜백 이후로 이동시킨 설계는 원본과의 1:1 준수 및 의도된 동작 방향에 부합합니다.
그러나 오류 발생 시 로컬/방송 잠금을 강제 해제하도록 구현된 예외 처리 흐름에서 일부 코드가 `try` 블록 밖에 위치하고, 비동기 호출 처리가 정상적으로 대기/전파되지 않아 예외 상황 발생 시 화면이 영구히 잠길 위험이 존재하므로 보완이 필요합니다.

## 지적

### 1. `BUSY_ON` 방송 호출 및 옵션 객체 복제 구간이 `try` 블록 밖에 위치하여 예외 시 잠금 잔류 위험

- **위치**: `www/ws30/ws10_20/design/js/uiDesignArea.js:6711-6714`
- **문제**: YES 콜백 진입 직후 `parent.setBusy("X")`와 단축키 잠금이 설정된 상태에서 `TY_BUSY_OPTION` 파라미터 구성 및 `parent.require`를 사용한 방송 송신이 수행됩니다. 이 코드가 `try` 블록(6718행 시작) 밖에 작성되어 있어, 이 과정에서 예외가 발생할 경우(예: `parent.WSUTIL` 또는 `parent.require` 등 정의 오류) 6812행의 `catch` 블록으로 진입하지 못해 로컬 Busy와 단축키 락이 풀리지 않는 먹통 상태가 됩니다.
- **근거**: `uiDesignArea.js:6686`, `6689`, `6711-6718`, `6812-6820`; 프로젝트 규칙 `code.md` (busy on 걸면 모든 종료 분기에서 off 짝 필수).

### 2. 비동기 갱신 함수(`updateBindPopupDesignData`) 호출 시 `await` 누락으로 인한 예외 우회

- **위치**: `www/ws30/ws10_20/design/js/uiDesignArea.js:6810`
- **문제**: `oAPP.fn.updateBindPopupDesignData`는 `async` 함수이지만 호출 시 `await` 키워드 없이 단독으로 호출되고 있습니다. 이로 인해 갱신 로직 실행 중 발생하는 비동기 오류가 `try/catch` 블록 내에서 포착되지 않고 `Unhandled Promise Rejection`이 되어, 오류가 나더라도 `catch` 정리 로직(6812행)이 작동하지 않고 잠금이 해제되지 않을 수 있습니다.
- **근거**: `uiDesignArea.js:6810-6820`; 프로젝트 규칙 `code.md` (비동기 완료 후 후속 처리 및 예외 표면화).

### 3. 방송 모듈의 비동기 호출 대기 누락 및 비동기 함수 내부 예외 처리 부재

- **위치**: `www/ws30/ws10_20/design/bindPopupHandler/broadcastChannelBindPopup.js:895-898` 및 `584-645`
- **문제**:
  1. `broadcastChannelBindPopup.js` 모듈 exports 함수 내에서 `case "UPDATE-DESIGN-DATA"` 처리 시 `updateBindPopupDesignData(oData)` 함수를 호출한 뒤 `await` 하거나 반환하지 않고 즉시 `break` 처리됩니다. 이로 인해 호출부(`uiDesignArea.js`)에서 `await` 하더라도 갱신 작업의 실제 완료 시점을 대기하거나 예외를 수신할 수 없습니다.
  2. 비동기 함수인 `updateBindPopupDesignData` 내부(584-645행)에 `try/catch` 예외 처리가 전혀 구현되어 있지 않습니다. 내부 연산인 `setBindPopupDesignAppData()`나 `setBindPopupDragAppData()` 등에서 런타임 에러가 발생할 경우, 이미 켜진 `parent.setBusy("X")`와 단축키 락(`oAPP.fn.setShortcutLock(true)`)이 해제되지 못하고 영구 락이 발생하게 됩니다.
- **근거**: `broadcastChannelBindPopup.js:584-645`, `895-898`; 프로젝트 규칙 `code.md`.

## 확인된 정상 항목

- **확인창 대기 중 덮임 방지**: `callDesignContextMenu.js:404-419`에서 확인창 호출 전 잠금 방송(`BUSY_ON`)을 제거함으로써 삭제 의사 확인 대기 중에 화면 잠금 창이 대화 상자를 덮어버리는 직접 회귀 현상이 정상 방지되었습니다.
- **원본 로컬 락 순서 유지**: `uiDesignArea.js:6677`, `6686`, `6700` 에서 기존 로컬 `setBusy` 호출의 대칭성 및 순서가 원본 UI5 동작과 동일하게 정상 보존되었습니다.
- **취소 분기 잠금 해제**: `uiDesignArea.js:6692-6704`에서 취소(YES가 아님) 시 기존 잠금 방송 `BUSY_OFF` 송신과 함께 로컬/단축키 잠금이 올바르게 해제됩니다.
- **조기 반환 예외 처리**: `uiDesignArea.js:6619-6630`에서 `is_tree_param` 부재 시 단축키 및 로컬 잠금을 안전하게 해제하고 조기 반환하도록 방어 코드가 올바르게 작성되었습니다.
- **성공 경로 잠금 위임**: 성공 시 자체적으로 `BUSY_OFF`를 중복 호출하지 않고, 성공 복귀 시 바인딩 팝업과의 왕복 계약에 따라 해제를 위임하는 설계가 유지되었습니다.

## 제안

1. **`uiDesignArea.js` 내 예외 처리 범위 확장**:
   - `oEvent === "YES"` 분기 내에서 로컬/방송 잠금 설정이 시작되는 시점 또는 그 직후부터 전체 삭제 과정이 정리되도록 `try` 블록의 시작 지점을 6711행 위로 조정합니다.
   - `oAPP.fn.updateBindPopupDesignData()` 호출 시 `await` 키워드를 명시하여 비동기 실행 흐름을 잡아내도록 보완합니다.

2. **`broadcastChannelBindPopup.js` 비동기 동기화 및 예외 처리 보강**:
   - `UPDATE-DESIGN-DATA` 케이스에서 비동기 함수의 Promise를 반환하도록 `return updateBindPopupDesignData(oData);` 로 수정합니다.
   - `updateBindPopupDesignData` 함수 내부에 `try/catch` 블록을 작성하여 내부 처리 중 오류가 발생하더라도 `BUSY_OFF`와 단축키 해제 및 `parent.setBusy("")`가 보장되도록 뒷정리 코드를 마련합니다.
