# 02_audit_agy — BR17 미리보기 우클릭 위/아래 이동

## 판정

**통과**

미리보기 영역에서 우클릭을 통해 UI를 위/아래로 이동할 때 발생하던 미정의 함수(`getTreeIndexOfChild`) 호출 크래시 및 이로 인한 화면 잠금(BUSY 미해제) 오류를 해결하기 위한 우회 위임 설계가 매우 적절하게 구현되었습니다. HTML5 환경에 정합하고 안전하게 동작함을 확인하여 통과로 판정합니다.

## 지적

없음.

## 검수 결과

| 검수 항목 | 결과 | 확인 근거 |
|---|---|---|
| **원인 분석 정확성** | 통과 | 원본 `callDesignContextMenu.js` 내의 `contextMenuUiMove`가 실행될 때, HTML5 환경에 로드되지 않는 `uiDesignArea.js`의 `getTreeIndexOfChild` 함수를 `undoRedo.js` 이력 저장 과정에서 호출하게 되어 TypeError가 발생하고, 그에 따라 예외 이후의 `BUSY_OFF` 코드가 실행되지 못해 영구 잠김이 발생했음을 정확히 규명했습니다. |
| **위임 자체완결성** | 통과 | `edit.js`의 `_moveUI` 함수가 순서 변경, 트리/미리보기 반영, 재선택, 변경 마크, 바인딩 팝업 갱신을 독자적으로 완수하며, HTML5의 단일 스냅샷 undo 스택(`fnWs20PushUndo`)을 사용하므로 트리와 미리보기 조작 간의 히스토리 관리 일관성이 보장됩니다. |
| **잠금(Busy) 대칭성** | 통과 | `edit.js`의 `_moveUI` 함수 내부에 `try/finally` 예외 처리 블록을 설계하여 내부 처리 중 동기 예외가 발생하더라도 `finally` 블록에서 `_broadBusy(false)` (BUSY_OFF)의 호출을 강제 보장했습니다. 또한 위임 경로에서는 원본 `contextMenuUiMove` 내의 `BUSY_ON`을 타지 않으므로 이중 잠금이나 누수가 없습니다. |
| **노드 참조 일관성** | 통과 | `prev.js` 내 위임 래퍼가 원본과 동일하게 `/lcmenu/OBJID`를 안전하게 취득하고, 라이브 트리 데이터(`getTreeData`)를 호출 인자로 바르게 변환하여 위임 함수로 전달합니다. |
| **예외 조건(pos/undo-redo) 보존** | 통과 | `prev.js` 1254-1264행에서 `pos`가 정의되었거나 인수 내에 `PRCCD === "UNDO_REDO"` 분기가 존재하는 경우(드래그앤드롭에 의한 특정 위치 이동이나 undo/redo 상황)에는 위임하지 않고 원본 `contextMenuUiMove` 로직으로 안전하게 회피시킵니다. |
| **멱등성 및 설치 안전성** | 통과 | 위임 함수가 중복 래핑되지 않도록 `__ws20MoveDelegate` 플래그 가드를 적용하였으며, 모듈 재진입 및 리로드 시점 등 3개 진입점에서 설치 로직을 유기적으로 배치하여 타이밍 이슈를 방지했습니다. |
| **비침습적 재정의 (Override)** | 통과 | 공통 이력 모듈이나 원본 callDesignContextMenu.js, uiDesignArea.js를 직접 수정하지 않고, HTML5 빌드의 호환 레이어인 `prev.js`와 `edit.js`만을 활용해 override 패턴으로 구현하여 패치 영향도를 안전하게 차단했습니다. |

## 제안

없음.
정적 Syntax 검사(`node --check`) 결과도 모두 정상적으로 통과되었습니다.
