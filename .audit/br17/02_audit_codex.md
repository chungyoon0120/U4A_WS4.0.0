# 02_audit_codex — BR17 미리보기 우클릭 위/아래 이동

## 판정

**통과**

## 지적

없음.

## 검수 결과

| 검수 항목 | 결과 | 확인 근거 |
|---|---|---|
| 원인 정확성 | 통과 | `design/js/callDesignContextMenu.js:438-456`에서 BUSY_ON 뒤 구 undo 이력을 저장하고, `design/undoRedo/undoRedo.js:1245`가 HTML5 런타임에 미로드된 `getTreeIndexOfChild`를 호출한다. 정의는 `design/js/uiDesignArea.js:1928`에만 있다. |
| 위임 자체완결 | 통과 | `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:545-576`의 `_moveUI`가 스냅샷 undo 저장, 형제 순서 변경, 트리 갱신, 미리보기 반영, 재선택, 변경 표시, 바인딩 팝업 반영을 수행하고 `fnWs20MoveUI`로 노출된다. |
| BUSY 대칭 | 통과 | `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:554-571`에서 BUSY_ON 이후 본문 전체가 `try/finally`로 감싸져 동기 예외에도 BUSY_OFF가 실행된다. 위임 분기는 원본 `contextMenuUiMove`를 호출하지 않아 원본 BUSY_ON과 중복되지 않는다. |
| 노드 소스 동일 | 통과 | `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:1259-1262`가 원본과 같은 `/lcmenu/OBJID`를 읽고 `getTreeData`의 라이브 노드를 전달한다. |
| pos/undo-redo 통과 | 통과 | `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:1254-1264`에서 `pos`가 정의됐거나 인자 중 `PRCCD === "UNDO_REDO"`가 있으면 원본 함수를 `apply`로 호출한다. |
| 멱등/설치 시점 | 통과 | `__ws20MoveDelegate` 가드가 중복 래핑을 막고, 모듈 재진입·기존 로드·스크립트 로드 콜백의 세 경로에서 설치한다 (`ws_html5_ws20_prev.js:1216, 1250-1268, 1270-1285`). |
| 원본 무수정 | 통과 | BR17 diff는 HTML5 대상 두 파일에만 존재하며 원본 `callDesignContextMenu.js`, `undoRedo.js`, `uiDesignArea.js`에는 BR17 변경이 없다. |
| 경계/편집 가드 | 통과 | `ws_html5_ws20_edit.js:545-553`에서 노드·편집모드·부모·현재 인덱스·상하 경계를 BUSY_ON 전에 검사한다. |

## 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_prev.js` 통과
- 원본 호출 경로 및 BR17 diff 정적 대조 완료
- 실제 UI 조작에 의한 BR17-1~4 런타임 검증은 수행하지 않음

## 제안

없음.
