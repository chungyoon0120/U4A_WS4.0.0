# BR26 검수 요청서 — 부모 UI 삭제 후 하위 UI가 oAPP.attr.prev에 잔존

## 검수 대상

- **파일**: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- **함수**:
  - 신규 `_purgePrevSubtree(n)` — 삭제 노드의 하위 UI를 `oAPP.attr.prev`에서 자식부터 재귀 제거.
  - 기존 `_deleteUI(oNode)` 내부 확인(YES) 분기 `lf_do` — `_removeNodePreview(oNode)` 직후 `_purgePrevSubtree(oNode)` 호출 추가.
- **기능**: WS20 Design Tree 단건 삭제(우클릭 컨텍스트 메뉴 "삭제") 시 내부 상태 저장소 정리.
- **백업**: `www/ws30/ws10_20/js/_ws_html5_ws20_edit.js.br26bak`

## 버그(현상)

Design Tree에서 자식(Button 3개)이 있는 부모(HBOX3)를 삭제하면:
- 화면 트리·미리보기: HBOX3, BUTTON1~3 **모두 제거됨(정상)**.
- 그러나 내부 상태 저장소 `oAPP.attr.prev`: 삭제한 **부모 HBOX3만 제거**되고 **자식 BUTTON1~3 객체(및 각 `_T_0015`)가 잔존** → 화면 상태와 내부 UI 정보 불일치.

재현: PAGE 아래 HBox 3개 추가 → HBOX3 아래 Button 3개 추가 → 각 Button text 변경 → HBOX3 삭제 → 콘솔에서 `oAPP.attr.prev` 조회 시 BUTTON1~3 잔존.

## 원인

- 화면/미리보기 정리는 부모 미리보기 인스턴스의 `.destroy()`가 자식 컨트롤까지 재귀 파괴하여 정상 제거됨(`design/preview/index.js:6241 destroyUIPreView`).
- 반면 내부 저장소 정리(`ws_html5_ws20_edit.js` `_removeNodePreview`)는 **삭제 최상위 노드 하나만** `delete oAPP.attr.prev[n.OBJID]` 하고 하위는 지우지 않았음.
- 원본 UI5 `designUIDelete`(`design/js/uiDesignArea.js:6617`)는 내부 `lf_deleteTreeLine`(:6634)이 **자식 먼저 재귀**(:6639~6645) 후 각 노드마다 `delete oAPP.attr.prev[OBJID]`(:6663) + 미리보기 예외(UA015) 정리(:6666~6669)를 수행 → 하위까지 전부 제거함. HTML5가 이 재귀부를 누락한 것.

## 변경 요약 (원본 대비)

1. **`_purgePrevSubtree(n)` 신규**: `n.zTREE`를 자식부터 재귀로 순회하며 각 자식의 `oAPP.attr.prev[OBJID]` 삭제 + `oAPP.attr.UA015UI._OBJID`가 그 자식이면 `UA015UI` 삭제. 원본 `lf_deleteTreeLine` 재귀부(:6634~6669) 1:1.
2. **`lf_do`(단건 삭제 YES 분기)에 호출 배선**: `_removeNodePreview(oNode)`(최상위 미리보기 제거 + `prev[oNode]` 삭제) 직후 `_purgePrevSubtree(oNode)`로 하위 재귀 정리. 최상위는 `_removeNodePreview`가 이미 제거하므로 자식만 재귀.

## 검수 포인트

1. **정확성**: 부모 단건 삭제 후 `oAPP.attr.prev`에 자식 OBJID·`_T_0015`가 남지 않는가(중첩 3단 이상 포함). 최상위 노드가 이중 삭제로 문제되지 않는가(`_removeNodePreview`가 이미 처리).
2. **원본 1:1**: 원본 `designUIDelete`의 `lf_deleteTreeLine` 재귀부(자식 먼저 → `delete prev` → UA015 정리)와 동작 일치하는가. HTML5 미로드 함수(`delUiClientEvent`/`delDesc`/`designUnbindLine`/`removeCollectPopup`)는 원본에도 있으나 HTML5 미이식분 — 이번 범위(내부 저장소 잔존)에는 무관, 임의 추가하지 않음이 맞는가.
3. **멀티(체크) 삭제 경로 불변**: 여러 개 체크 삭제(`lf_delSelLine` 이식분, :526~)는 체크된 노드별로 이미 `_removeNodePreview` 호출 → 자식 각각 정리됨. 부분 체크(부모 체크·자식 해제) 시 원본도 자식 prev를 남기는 동작까지 동일하게 유지(이번 재귀는 단건 경로에만 배선). 이 판단이 맞는가.
4. **부작용 없음**: undo 스냅샷(`fnWs20PushUndo`)·트리 갱신·선택·변경표시·바인딩 팝업 반영 순서 불변, BUSY/단축키 잠금 회수 대칭 불변.

## 근거

- 원본: `www/ws30/ws10_20/design/js/uiDesignArea.js:6617`(designUIDelete), `:6634~6669`(lf_deleteTreeLine 재귀부), `:6663`(delete oAPP.attr.prev), `:6666~6669`(UA015 정리).
- 원본 미리보기: `www/ws30/ws10_20/design/preview/index.js:6241`(destroyUIPreView = `.destroy()` 재귀 파괴), `:6260`(delUIObjPreView).
- 프로젝트 규칙: 원본(as-is) 1:1, 원본에 없는 UX 추가 금지.
