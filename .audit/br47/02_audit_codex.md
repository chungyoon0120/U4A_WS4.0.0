# BR47 Codex 검수 결과

## 판정

**통과 (필수 수정 0건)**

BR47의 우클릭 처리 변경은 원본 UI5의 핵심 순서인 `선택 완료 대기 → 이벤트 루프 한 틱 대기 → 메뉴 표시`를 복원하며, 팝업 UI 선택 과정에서 발생하는 iframe 포커스 이동과 전역 메뉴 닫기 처리가 끝난 뒤 메뉴를 생성한다.

## 검증 결과

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 원본 동작 1:1 | 통과 | 원본 `design/js/uiDesignArea.js:1003~1063`의 `await setSelectTreeItem` 및 `setTimeout(0)` 이후 `openBy` 순서를 현행 `ws_html5_ws20_tree.js:589~605`가 동일하게 보존한다. |
| Promise 전파 | 통과 | `_safeCall`은 호출 반환값을 그대로 반환한다. `setSelectTreeItem`은 `Promise.resolve(fnWs20SelectUI(...))`를 반환하고(`ws_html5_ws20_prev.js:786~800`), `fnWs20SelectUI`는 `fnWs20DesignTreeItemPress`와 최종 미리보기 선택 표시까지 기다린 뒤 resolve한다(`ws_html5_ws20_attr.js:3180~3259`). |
| 팝업 open 대기 | 통과 | `fnWs20DesignTreeItemPress`가 iframe의 `refreshPreview`를 await하며(`ws_html5_ws20_attr.js:3077~3158`), `refreshPreview`는 팝업 open 및 후속 렌더 완료 흐름을 포함한다(`design/preview/index.js:6502~6647`). |
| blur-close와의 순서 | 통과 | 팝업 포커스 이동으로 예약된 `_installIframeBlurClose`의 0ms 작업 뒤에, 선택 await를 마친 우클릭 핸들러가 별도의 0ms 작업을 예약한다. FIFO task 순서상 기존 메뉴 정리가 먼저 끝나고 새 메뉴가 이후 생성된다. 이는 원본의 명시적 한 틱 대기와 같다. |
| 좌표 안정성 | 통과 | `clientX/clientY`를 첫 await 전에 숫자로 복사하므로 비동기 경계 뒤 이벤트 객체를 재사용하지 않는다. |
| 재렌더 후 노드 안정성 | 통과 | 보관하는 `n`은 제거되는 행 DOM이 아니라 트리 모델 객체다. 메뉴 enable 계산 시 부모와 형제는 OBJID로 현재 모델에서 다시 조회하므로 행 재렌더로 stale DOM을 참조하지 않는다(`ws_html5_ws20_edit.js:1948~1993`). |
| 연속 입력/회귀 | 통과 | 선택 중 호스트 `setBusy("X")`가 body 포인터 입력을 즉시 차단하고(`www/ws30/resources/index.js:873~890`), WS20의 `<dialog id="u4aWsBusyIndicator">`를 modal top layer로 연다(`ws10_20/index.html:109~113`, `www/ws30/resources/index.js:1506~1535`). 일반 UI, ROOT/APP도 같은 공통 순서로 처리되며 메뉴 enable 규칙 및 액션에는 변경이 없다. |
| 실패 회수 | 통과 | 선택 Promise reject는 경고 후 한 틱 뒤 메뉴를 계속 표시한다. busy/shortcut 회수는 `fnWs20SelectUI`의 `finally`가 담당하므로 호출부가 별도 잠금을 중복 관리하지 않는다. |

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_tree.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_prev.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_tree.js` 통과

## 보수적 반박 검토

- 빠른 연속 우클릭으로 오래된 핸들러가 뒤늦게 메뉴를 여는 가능성을 검토했으나, 정상 사용자 경로에서는 호스트 `setBusy`가 body 포인터 입력을 즉시 차단하고 modal busy dialog를 열어 후속 포인터 이벤트를 차단한다.
- 선택 중 트리 재렌더로 우클릭 대상 행은 교체될 수 있으나, 메뉴 API에 전달되는 값은 DOM이 아니며 현재 모델을 재조회하므로 메뉴 상태 계산이 깨지지 않는다.
- `_safeCall` 내부의 동기 예외는 자체적으로 삼켜져 외부 `catch` 로그가 남지 않을 수 있으나, 메뉴 계속 표시라는 BR47 복구 계약에는 영향을 주지 않으며 이번 변경으로 생긴 회귀도 아니다.
- `refreshPreview`의 기존 `new Promise(async executor)` 구조는 executor 내부의 예상 밖 예외가 외부 Promise를 pending으로 남길 수 있는 비차단 위험이 있다. 다만 BR47 이전부터 존재하고 원본 선택 경로도 공유하며, 정상 팝업 메서드에서 재현 근거가 없어 BR47 결함으로 판정하지 않았다.

## 독립 재검수 취합

서브에이전트가 기존 통과 판정을 반박하는 방향으로 동일 호출 경로를 독립 추적했다. Promise 종단, popup after-render, iframe blur timer 선예약, busy/shortcut 회수, 모델 노드 재조회 및 일반 UI 회귀를 다시 확인했으며 **재현 가능한 필수 결함 0건, 통과 유지**로 결론 내렸다.

## 잔여 실환경 확인 권고

자동 정적 검증만으로 실제 Electron 포커스 전이를 완전히 재현할 수는 없다. 팝업형 UI와 비팝업형 UI 각각에서 우클릭 메뉴가 유지되는지, 메뉴 좌표와 enable 상태가 맞는지를 실화면에서 1회 확인하면 충분하다.

제품 소스는 수정하지 않았다.
