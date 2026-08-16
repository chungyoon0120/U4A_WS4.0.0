# BR41 검수 요청서 — UI 삭제 시 클라이언트 이벤트·HTML content(T_CEVT) 잔존 제거

## 버그 개요 (노션 이슈 리포트)
- **코드**: BR41 / **화면**: WS20 Design / **분류**: 기능
- **현상**: WS20 Design 영역에서 UI 이벤트에 클라이언트 이벤트 코드(JS)를 설정하거나
  sap.ui.core.HTML의 content에 내용을 입력한 뒤 그 UI를 삭제하면,
  Design Tree · 미리보기 · `_T_0015`에서는 정상 제거되나 `oAPP.DATA.APPDATA.T_CEVT`에 수집된
  클라이언트 이벤트 정보(OBJTY `"JS"`)와 HTML content 정보(OBJTY `"HM"`)가 제거되지 않고 남는다.
- 부모 UI를 삭제해 자식 UI가 함께 제거될 때, 부모뿐 아니라 **함께 지워진 자식 UI의 T_CEVT 정보도 잔존**.
- **기대 결과**: 삭제된 UI(및 함께 제거되는 모든 하위 UI) 기준으로 `T_CEVT`의
  클라이언트 JS 이벤트(`"JS"`)·HTML content(`"HM"`) 관련 라인 제거. 삭제 대상과 무관한 UI의 정보는 유지.

## 검수 대상 (파일·함수)
1. `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
   - `oAPP.fn.delUiClientEvent(is_tree)` **신규 이식** (354~377행, `_removeNodePreview` 정의 직전)
   - `_removeNodePreview(n)` (약 385행) — 삭제 노드 본인 정리부, `delete oAPP.attr.prev[n.OBJID]` **직전**에 `delUiClientEvent(n)` 호출 추가 (394행)
   - `_purgePrevSubtree(n)` (약 405행) — 하위 재귀 정리부, `delete oAPP.attr.prev[c.OBJID]` **직전**에 `delUiClientEvent(c)` 호출 추가 (414행)

## 변경 요약 (원본 대비)
- **원인**: 원본 UI5는 삭제 시 노드마다 `oAPP.fn.delUiClientEvent(is_tree)`를 호출해 `T_CEVT`를 정리한다
  (단건: `uiDesignArea.js:6648` `lf_deleteTreeLine`, 멀티: `uiDesignArea.js:4372` `lf_delSelLine`).
  HTML5 변환 시 `delUiClientEvent` 함수 자체가 `uiDesignArea.js`(UI5 전용, HTML5 미로드)에만 있고
  이식 누락됐으며 삭제 경로에서 호출도 없어 `T_CEVT`가 잔존.
  (참고: 복사용 `copyUiClientEvent`는 이미 `ws_html5_ws20_dnd.js:1397`에 이식돼 있음 — 같은 방식으로 삭제용 이식.)
- **수정**:
  - `delUiClientEvent` 함수를 원본 `uiDesignArea.js:2034` **1:1**로 HTML5 이식. 원본 처리 순서 그대로:
    1. `T_CEVT` 비었으면 return
    2. `oAPP.attr.prev[OBJID]._T_0015` 없으면 return
    3. `sap.ui.core.HTML`이면 `OBJID + "CONTENT"` · OBJTY `"HM"` 라인 `splice`
    4. `_T_0015`에서 이벤트 설정건(`UIATY === "2"`)마다 `OBJID + UIASN` · OBJTY `"JS"` 라인 `splice`
    - HTML5 스타일 방어가드(배열 여부·prev 존재)만 앞에 추가.
  - 삭제 경로 배선:
    - **단건 삭제** `_deleteUI`: 본인 = `_removeNodePreview(oNode)`에서 `delUiClientEvent(본인)`,
      하위 = `_purgePrevSubtree(oNode)` 재귀에서 `delUiClientEvent(자식)`.
    - **멀티(체크) 삭제** `designTreeMultiDeleteItem`: 체크 노드마다 `_removeNodePreview(n)` = `delUiClientEvent(본인)`,
      `_purgePrevSubtree(n)` = `delUiClientEvent(잔여 하위)`.
  - **★호출 순서**: `delUiClientEvent`는 `oAPP.attr.prev[OBJID]._T_0015`를 참조하므로,
    반드시 `delete oAPP.attr.prev[OBJID]` **이전에** 호출하도록 배치(원본도 6648 < 6663 순서).
- **범위 준수**: BR41 리포트는 `T_CEVT`(JS/HM)만 다룸. 원본 삭제 재귀엔 `designUnbindLine`·
  `removeCollectPopup`도 있으나 요청 밖 임의 확장 금지로 미포함(BR40의 `delDesc`는 이전 건에서 이미 배선됨).

## 검수 포인트 (꼭 봐달라)
1. **정확성 — 삭제 대상만 지우는가**: `delUiClientEvent`가 `OBJID + UIASN`(JS) / `OBJID + "CONTENT"`(HM) 정확 일치 라인만 `splice`. 다른 UI의 이벤트·content 오삭제 없는지.
2. **하위 재귀 커버리지**: 상위 삭제 시 함께 지워지는 하위 전부의 T_CEVT가 제거되는지. `_purgePrevSubtree`가 하위를 빠짐없이 재귀하는지.
3. **★호출 순서(prev 참조)**: `delUiClientEvent`가 `_T_0015`를 읽으므로 `delete oAPP.attr.prev[OBJID]` 이전에 불리는지. 순서가 뒤집히면 prev가 사라져 이벤트건을 못 찾아 잔존.
4. **원본 1:1**: 본문이 원본 `delUiClientEvent`와 동일한지(순서·조건·`splice`). `UIFND === "SAP.UI.CORE.HTML"` 판정, `UIATY === "2"` 필터, OBJTY `"JS"`/`"HM"` 매칭 동일한지. 임의 로직 추가 없는지.
5. **호출부 안전성 — 삭제 경로 전용인가**: `_removeNodePreview`·`_purgePrevSubtree`가 삭제 2경로에서만 호출되고 이동/추가/붙여넣기 등 비삭제 경로에서 쓰이지 않는지(오삭제 방지).
6. **중복 호출 무해성**: 멀티 삭제에서 체크 전파로 하위도 개별 처리될 때 이미 `prev[OBJID]`가 지워진 상태면 가드(`!oPrev` return)로 no-op인지.
7. **루프 클로저**: `for (var i …)` 안 `findIndex` 콜백이 `lt_evt[i]`를 참조 — 동기 호출이라 클로저 함정 없는지(지연 콜백 아님) 확인.
8. **가드**: `oAPP.DATA.APPDATA.T_CEVT` 미존재/미배열, `prev` 미존재 시 안전 종료.

## 근거
- 원본 파일:
  - `www/ws30/ws10_20/design/js/uiDesignArea.js:2034` (`delUiClientEvent` 정의)
  - `www/ws30/ws10_20/design/js/uiDesignArea.js:6648` (단건 삭제 재귀 `delUiClientEvent` 호출, 6663 `delete prev` 이전)
  - `www/ws30/ws10_20/design/js/uiDesignArea.js:4372` (멀티 삭제 재귀 `delUiClientEvent` 호출)
  - `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:1397` (`copyUiClientEvent` HTML5 이식 선례 — 동일 방식)
- 백업: `_ws_html5_ws20_edit.js.br41bak`
- 검증: `ws_html5_ws20_edit.js` `node --check` 통과.
