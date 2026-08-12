# 02_audit_agy — BR21 미리보기 우클릭 붙여넣기 검수 결과

## 판정

**수정필요 (Modify)**

---

## 지적 및 분석

### 1. `APP` 대상 미리보기 붙여넣기 선택 시 원본 크래시 경로로 잘못 폴백됨
- **위치**: [ws_html5_ws20_prev.js:1327](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_prev.js#L1327)
- **문제**: 미리보기 우클릭 메뉴의 붙여넣기 위임 래퍼(`_wrappedPaste`)에서 대상 OBJID가 `ROOT`이거나 `APP`인 경우에 원본 `_origPaste.apply(this, arguments)`로 폴백하도록 구현되어 있습니다. 
  그러나 원본 `callDesignContextMenu.js` 1346행의 안전 종료 분기는 오직 `l_OBJID === "ROOT"`인 경우에만 적용됩니다. `APP` 노드에 대한 종료 분기는 존재하지 않기 때문에, `APP`에서 우클릭 붙여넣기를 선택하면 원본 로직이 그대로 실행되어 1391행의 `aggrSelectPopupOpener`를 무가드로 호출하게 됩니다.
  미리보기 부팅 경로에서는 `opner.js`가 동적 import 되지 않으므로 `aggrSelectPopupOpener` 함수가 미정의 상태이고, 호출 즉시 `TypeError` 예외와 함께 크래시가 발생합니다.
- **영향**: 미리보기 및 트리 메뉴 모두에서 정상 지원 범위인 `APP` 대상 붙여넣기 기능이 크래시로 인해 실패하며, 예외 발생 이후의 잠금 해제 흐름을 타지 못해 화면 잠금이 잔류할 수 있습니다.
- **제안**: 원본 폴백 대상을 `ROOT`로 엄격히 제한하고, `APP` 노드는 일반 노드와 동일하게 공통 붙여넣기 코어인 `fnWs20PasteUI(ls_node)`로 정상 위임하도록 수정해야 합니다.

### 2. 노드 조회 실패 시 안전한 잠금 해제 없이 원본 폴백하여 크래시 유발
- **위치**: [ws_html5_ws20_prev.js:1329](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_prev.js#L1329)
- **문제**: 미리보기 우클릭 발생 시 로컬 트리 데이터를 조회하는 `ls_node` 획득에 실패할 경우, 래퍼는 단순히 원본 `_origPaste`로 넘깁니다. 
  하지만 원본 `contextMenuUiPaste` 역시 내부에서 `getTreeData`를 수행하고 결과가 없어도 별도의 가드 없이 `aggrSelectPopupOpener`를 호출하므로 동일하게 미정의 함수 호출 오류(TypeError)로 죽게 됩니다.
  메뉴 선택 직후에 이미 `parent.setBusy("X")`와 단축키 잠금이 걸린 상태에서 예외가 발생하므로, 잠금 해제 단계에 도달하지 못하고 화면이 먹통이 됩니다.
- **영향**: 예외 상황에서 복구 불가능한 영구 화면 잠금과 크래시 발생.
- **제안**: `ls_node`를 찾지 못하는 예외 상황에서는 원본으로 던지지 말고, `parent.setBusy("")`와 `setShortcutLock(false)`를 호출하여 즉시 잠금을 원복한 뒤 안전하게 조기 종료(EXIT)하도록 보완해야 합니다.

### 3. 미리보기 진입 시점의 로컬 잠금(BUSY 및 단축키) 해제 수명주기 불일치
- **위치**: 
  - [ws_html5_ws20_edit.js:672-675](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_edit.js#L672-L675) (`_pasteUI` 내부 `_done` 콜백)
  - [ws_html5_ws20_dnd.js:465-467, 602-604, 990](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_dnd.js#L465)
- **문제**: 미리보기 메뉴 선택기(`callDesignContextMenu.js`)는 동작 시작 시 `parent.setBusy("X")`와 `oAPP.fn.setShortcutLock(true)`를 활성화합니다. 하지만 위임된 공통 완료 콜백(`_done`)은 자식창 방송 잠금(`_broadBusy`) 및 `setShortcutLock` 해제만 수행할 뿐 `parent.setBusy("")`를 호출하여 로컬 잠금을 푸는 기능이 누락되어 있습니다. 이로 인해 다음 시나리오별 잠금 오류가 발생합니다.
  - **시나리오 A (Aggregation 후보 0개 - 이동 불가)**: `aggrSelectPopup` 내부 `cancelFunc`가 호출될 때 `dnd.js:456-462` 분기는 cancelFunc(`_done`)만 수행하고 리턴하므로 `parent.setBusy("")`가 불리지 않아 로컬 BUSY가 무한히 잔류합니다.
  - **시나리오 B (Aggregation 후보 1개 - 자동 선택)**: 비동기 작업 완료 후 `_done()`이 호출되어 자식창 잠금은 풀리나 `parent.setBusy("")`는 불리지 않아 로컬 BUSY가 잔류합니다.
  - **시나리오 C (Aggregation 후보 2개 이상 - 팝업)**: `_aggrSelectDialog`가 팝업될 때 팝업 조작을 위해 즉시 `parent.setBusy("")`와 `setShortcutLock(false)`를 해제합니다. 그러나 사용자가 팝업에서 대상을 확정하여 비동기 데이터 작업 구간(`_fetchP13nOtr` -> `_applyP13nPattern`)이 진행되는 도중에는 잠금이 풀려 있어 사용자의 조기 입력으로 인한 경합이 가능하며, 최종 완료 후 `_done()`이 불려도 `parent.setBusy("")`가 해제되지 않습니다.
- **영향**: 후보 개수와 관계없이 붙여넣기 완료/취소 시 화면이 영구히 로컬 BUSY로 굳거나, 실제 비동기 복사 진행 중에 화면 조작이 가능해져 비정상 경합이 발생할 수 있습니다.
- **제안**:
  1. `edit.js`의 `_pasteUI` 내부 `_done` 콜백이 중복 실행 방지 가드를 가지도록 하고, `_done` 안에서 `parent.setBusy("")`를 해제하는 처리를 명시적으로 추가합니다.
  2. `dnd.js`의 `fnWs20AddTreeData`에서 `aggrSelectPopup` 콜백(실제 비동기 작업 구간)에 진입하는 시점에 `_bindBusy("BUSY_ON")`, `setShortcutLock(true)`, `parent.setBusy("X")`를 다시 세팅해주어야 비동기 구간의 조작을 막을 수 있습니다.
     - *참고*: 만약 공통 `dnd.js` 파일이 수정 대상에서 제외되어 직접 수정할 수 없다면, `edit.js` 또는 `prev.js` 측의 위임/래핑 함수 단에서 `fnWs20PasteUI`를 감싸 `parent.setBusy`의 생명주기를 가로채거나 관리할 수 있는 구조를 마련해야 합니다. 단, 근본적인 해결을 위해 `dnd.js` 공통 코어의 비동기 진입 시점 잠금 보완이 권장됩니다.

---

## 검증 내역 요약 (Static Analysis)

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 검증 완료
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_prev.js` 검증 완료
- `design/js/callDesignContextMenu.js` 원본의 메뉴 실행 흐름 및 잠금 설정 구간 정적 분석 완료
- `js/ws_html5_ws20_dnd.js` 내의 `fnWs20AddTreeData`와 `aggrSelectPopup` 내부의 잠금 수명주기 대칭성 검토 완료
