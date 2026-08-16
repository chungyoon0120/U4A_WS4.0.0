# BR40 검수 요청서 — UI 삭제 시 설명정보(T_DESC) 잔존 제거

## 버그 개요 (노션 이슈 리포트)
- **코드**: BR40 / **화면**: WS20 Design / **분류**: 기능
- **현상**: WS20 Design 영역에서 UI의 Description 영역에 설명글을 등록한 뒤 그 UI를 삭제하면,
  삭제된 UI(및 함께 제거되는 하위 UI)의 설명 정보가 `oAPP.DATA.APPDATA.T_DESC`에서 제거되지 않고 남는다.
- Design Tree · `_T_0015` · 미리보기에서는 정상 삭제되나 `T_DESC`만 동기화 안 됨.
- 단건 삭제(BUTTON6 개별 삭제)에서도 동일 재현 → 하위 UI 포함 삭제에만 한정된 현상 아님.
- **기대 결과**: 삭제된 UI의 OBJID와 일치하는 `T_DESC` 라인 제거. 상위 삭제로 하위가 함께 제거되면
  하위 전부의 설명도 제거. 삭제 대상과 무관한 다른 UI의 설명은 유지.

## 검수 대상 (파일·함수)
1. `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
   - `oAPP.fn.delDesc` **신규 추가** (약 1400행 부근, `getDesc` 정의 직전)
2. `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
   - `_removeNodePreview(n)` (약 351행) — 삭제 노드 본인 정리부에 `delDesc(n.OBJID)` 호출 추가
   - `_purgePrevSubtree(n)` (약 372행) — 하위 재귀 정리부에 `delDesc(c.OBJID)` 호출 추가

## 변경 요약 (원본 대비)
- **원인**: 원본 UI5는 삭제 시 노드마다 `oAPP.fn.delDesc(OBJID)`를 호출해 `T_DESC`를 정리한다
  (단건: `uiDesignArea.js:6651` `lf_deleteTreeLine`, 멀티: `uiDesignArea.js:4375` `lf_delSelLine`).
  HTML5 변환 시 `delDesc` 함수 자체가 이식 누락됐고, 삭제 경로에서 호출도 없어 `T_DESC`가 잔존.
- **수정**:
  - `delDesc` 함수를 원본 `uiAttributeArea.js:7783` 1:1로 이식(대상 없으면 return, 있으면 `splice`).
    HTML5 스타일에 맞춰 앞에 `T_DESC` 존재 가드만 추가(`changeDescOBJID`와 동일 패턴).
  - 삭제 경로 배선:
    - **단건 삭제** `_deleteUI`: 본인 = `_removeNodePreview(oNode)`에서 `delDesc(본인)`,
      하위 = `_purgePrevSubtree(oNode)` 재귀에서 `delDesc(자식)`.
    - **멀티(체크) 삭제** `designTreeMultiDeleteItem`: 체크 노드마다 `_removeNodePreview(n)` = `delDesc(본인)`,
      `_purgePrevSubtree(n)` = `delDesc(잔여 하위)`.
- **범위 준수**: BR40 리포트는 `T_DESC`만 다룸. 원본 삭제 재귀엔 `delUiClientEvent`·`designUnbindLine`·
  `removeCollectPopup`도 있으나, 본 수정에서는 **T_DESC(`delDesc`)만** 추가(요청 밖 임의 확장 금지).

## 검수 포인트 (꼭 봐달라)
1. **정확성 — 삭제 대상만 지우는가**: `delDesc`는 `OBJID` 정확 일치 라인 1건만 `splice`. 다른 UI 설명 오삭제 없는지.
2. **하위 재귀 커버리지**: 상위 삭제 시 하위 전부의 설명이 지워지는지. `_purgePrevSubtree`가 하위를 빠짐없이 재귀하는지.
3. **호출부 안전성 — 삭제 경로 전용인가**: `_removeNodePreview`·`_purgePrevSubtree`가 **삭제 2경로에서만** 호출되고
   이동/추가/붙여넣기 등 비삭제 경로에서 쓰이지 않는지(오삭제 방지). (grep 결과: 351/372 정의, 416·418 단건, 581·585 멀티 — 삭제 전용)
4. **원본 1:1**: `delDesc` 본문이 원본과 동일한지(대상 없으면 return, `findIndex`/`splice`). 임의 로직 추가 없는지.
5. **중복 호출 무해성**: 멀티 삭제에서 체크 전파로 하위도 개별 처리될 때 `delDesc`가 두 번 불릴 수 있으나,
   `findIndex === -1` 가드로 no-op인지.
6. **가드**: `oAPP.DATA.APPDATA.T_DESC` 미존재 시 안전 종료(초기 로드 전 호출 대비).

## 근거
- 원본 파일:
  - `www/ws30/ws10_20/design/js/uiAttributeArea.js:7783` (`delDesc` 정의)
  - `www/ws30/ws10_20/design/js/uiDesignArea.js:6651` (단건 삭제 재귀 `delDesc` 호출)
  - `www/ws30/ws10_20/design/js/uiDesignArea.js:4375` (멀티 삭제 재귀 `delDesc` 호출)
- 백업: `_ws_html5_ws20_attr.js.br40bak`, `_ws_html5_ws20_edit.js.br40bak`
- 검증: 두 파일 `node --check` 통과.
