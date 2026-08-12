# 02_audit_codex — BR16 미리보기 우클릭 삭제 BUSY

## 판정

**수정필요**

확인창 전에 있던 방송 `BUSY_ON`을 제거하고 삭제 확정 뒤로 옮긴 방향, 로컬 `parent.setBusy` 순서, 취소 분기는 요청 내용과 일치한다. 다만 오류 경로 두 곳이 현재 `catch`의 보호를 받지 않아 “모든 종료 분기에서 BUSY OFF” 수용 기준을 충족하지 못한다.

## 지적

### 1. `BUSY_ON` 준비·송신이 `try` 밖이라 이 구간의 예외는 잠금을 해제하지 못함

- 위치: `www/ws30/ws10_20/design/js/uiDesignArea.js:6711`
- 문제: 확인 콜백 진입 직후 `parent.setBusy("X")`와 단축키 잠금이 이미 켜진 상태인데, `_sOption` 복제·메시지 조회·`parent.require(...)("BUSY_ON")`은 `try`가 시작되는 6718행보다 앞에 있다. 이 중 하나라도 예외를 던지면 6812행의 `catch`에 도달하지 않아 로컬 BUSY와 단축키 잠금이 남는다. 요청서의 “삭제 작업 전체를 try/catch로 감싸 오류 시 보장” 및 `.claude/rules/code.md`의 “on 걸면 모든 종료 분기 off”와 불일치한다.
- 근거: `uiDesignArea.js:6686`, `6689`, `6711-6718`, `6812-6818`; `.claude/rules/code.md` busy 규칙.

### 2. 성공 왕복 호출을 `await`하지 않아 비동기 실패가 현재 `catch`를 우회함

- 위치: `www/ws30/ws10_20/design/js/uiDesignArea.js:6810`
- 문제: `oAPP.fn.updateBindPopupDesignData()`는 `async` 함수(`uiDesignArea.js:1263`)인데 `await` 없이 호출된다. 또한 내부 방송 모듈의 `UPDATE-DESIGN-DATA` 분기는 비동기 `updateBindPopupDesignData`를 호출만 하고 반환/대기하지 않는다(`design/bindPopupHandler/broadcastChannelBindPopup.js:895-898`). 따라서 `parent.require` 또는 데이터 구성·송신에서 발생한 실패가 거부된 Promise가 되어도 6812행의 `catch`가 처리하지 못하며, 팝업의 `BUSY_OFF` 왕복도 시작/완료되지 않아 방송·로컬 BUSY와 단축키 잠금이 남을 수 있다.
- 근거: `uiDesignArea.js:1263-1268`, `6810-6818`; `design/bindPopupHandler/broadcastChannelBindPopup.js:584-645`, `895-898`; `.claude/rules/code.md`의 비동기 완료 후 후속 처리 및 busy 짝 규칙.

## 확인된 정상 항목

- `callDesignContextMenu.js:401-412`: 확인창 호출 전 방송 `BUSY_ON` 제거됨. 확인창 대기 중 방송이 다시 켜지는 직접 회귀는 없음.
- `uiDesignArea.js:6677`, `6686`, `6700`: 원본 로컬 `setBusy` 순서(off → 확인 콜백 on → 취소 off) 보존.
- `uiDesignArea.js:6692-6704`: 취소 판정을 먼저 수행하므로 취소 시 방송 `BUSY_ON`이 발생하지 않음. 기존 방어적 `BUSY_OFF`도 유지.
- `uiDesignArea.js:6619-6629`: 정보 없음 조기 반환은 방송 OFF·단축키 해제·로컬 BUSY OFF를 수행.
- `uiDesignArea.js:6810`: 정상 성공 경로는 자체 `BUSY_OFF`를 추가하지 않고 WS20↔바인딩 팝업 왕복 해제 계약을 유지.
- 두 대상 JS 파일 모두 `node --check` 통과.

## 제안

1. 6711행의 BUSY 옵션 구성과 `BUSY_ON` 송신부터 삭제 작업 끝까지 동일한 `try` 안에 넣는다.
2. `updateBindPopupDesignData` 호출 체인이 Promise를 반환하도록 `uiDesignArea.js:1263`과 방송 모듈 `UPDATE-DESIGN-DATA` 분기를 연결하고, 삭제 경로에서는 `await`하여 실패가 현재 정리 로직으로 전파되게 한다. 성공 시 BUSY 해제는 기존처럼 팝업 왕복이 담당해야 한다.
3. 수정 후 BW1~BW4 실화면 검증과 함께 BUSY 송신/데이터 구성/송신 실패를 강제로 발생시켜 방송 BUSY·로컬 BUSY·단축키가 모두 해제되는지 확인한다.

## 실화면 검증 상태

`.works/미리보기삭제BUSY/00_현황판.md`의 BW1~BW4가 모두 미테스트(`☐`)이므로 동적 동작은 아직 통과로 판정할 수 없다.
