# BR46 검수 요청서 — UI 추가 팝업 경로 RichTextEditor 미리보기 재렌더·완료대기 복원

## 검수 대상
- **파일**: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- **함수**: `oAPP.fn.designAddUIObject` (UI 추가 팝업 확정 시 삽입 본처리) + 신규 헬퍼 `_renderMod`, `_rerenderParentRTE`
- **기능**: "UI Object Select(UI 추가)" 팝업으로 UI를 추가할 때, 삽입 후 부모 미리보기 재렌더 + RichTextEditor 렌더 완료 대기

## 변경 요약 (원본 대비)
- **증상**: RichTextEditor 계열 UI(또는 그 부모)를 UI 추가 팝업으로 넣으면 미리보기가 즉시 정상 렌더되지 않을 수 있었다. 같은 UI를 **끌어놓기(드래그드롭)**로 넣으면 정상 → 경로 간 동작 불일치.
- **원인**: 원본 `uiDesignArea.js designAddUIObject`는 삽입 완료 후(트리·모델 갱신 전)에 부모 미리보기 재렌더 + RichTextEditor 렌더 완료 대기를 수행한다. 끌어놓기 경로(`ws_html5_ws20_dnd.js`의 `_rerenderCore`)에는 이 배선이 있으나, **UI 추가 팝업 확정 경로(`designAddUIObject`)에는 통째로 누락**돼 있었다.
- **수정**:
  1. `_renderMod()` 추가 — onAfterRendering 모듈 로드(`parent.require(oAPP.oDesign.pathInfo.setOnAfterRender)`). 끌어놓기 경로 `_renderMod`와 동일.
  2. `_rerenderParentRTE(parentNode)` 추가 — 대상/리스너 등록(`getTargetAfterRenderingUI` → `getDomRef` → `setAfterRendering`) → `renderingRichTextEditor(parentNode)` → 대상 있으면 `rerender()` + `await` → `await Promise.all(RTE)`. 끌어놓기 경로 `_rerenderCore` 구조와 1:1.
  3. `designAddUIObject`의 삽입 반복 루프 종료 후, `_refreshTree()` 호출 **직전**에 `await _rerenderParentRTE(is_tree)` 호출.
- **가드**: 미리보기 iframe(`oAPP.attr.ui.frame.contentWindow`) 미로드 시 조용히 건너뜀(트리만 갱신) — 기존 `_prev` 가드와 동일. 모듈 미로드 시에도 조용히 skip.

## 검수 포인트
1. **원본 1:1 여부**: 원본 `designAddUIObject`가 삽입 후 수행하는 재렌더/대기(대상·리스너 등록 5405~5423 + RTE 재렌더·완료대기 5651~5666)와 순서·의미가 일치하는가. 특히 `_oTarget`을 `is_tree`(부모) 기준으로 잡는 점(원본 5410 = `prev[is_tree.OBJID]`).
2. **형제 경로 일치**: 끌어놓기 경로 `_rerenderCore`(dnd.js)와 재렌더 처리가 동등한가(재렌더 대상·await 순서). 팝업/드롭 두 경로 결과가 같아지는가.
3. **삽입 위치 정확성**: 반복 생성 루프가 완전히 끝난 뒤(모든 자식이 preview에 반영된 뒤), `_refreshTree()`·`_selectNode()`·`_markChanged()` **이전**에 재렌더가 오는가. 다건 추가(cnt≥2) 시 마지막 상태 기준으로 1회만 재렌더되는가.
4. **가드·오류 처리**: 미리보기 미로드/모듈 부재 시 트리만 갱신하고 넘어가는가(끌어놓기와 동일). 조용한 catch 없이 `console.error`로 표면화하는가(code.md 규칙).
5. **부작용 없음**: `await` 추가로 인한 재진입 창(추가 대기 중 편집 끼어듦) 여지. BR43/BR44에서 삽입 원자성을 위해 push~삽입 사이 await를 없앤 바 있는데, 이 재렌더 await는 **삽입 루프 종료 후·트리 갱신 직전**이라 삽입 자체는 이미 끝난 상태다 — 원본도 동일 위치에서 await하므로 원본 계약과 일치하는지 확인.
6. **KEEP-UI5 준수**: 미리보기는 KEEP-UI5. 원본 미리보기/`uiDesignArea.js` 파일 무수정(참조 전용), 변경은 원본 폴더 밖 `js/ws_html5_ws20_edit.js`에만.

## 근거
- **원본**: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiDesignArea.js` `designAddUIObject`
  - 대상/리스너 등록: 5405~5423 (`setOnAfterRender` 로드, `getTargetAfterRenderingUI(prev[is_tree.OBJID])`, `getDomRef`, `setAfterRendering`)
  - 삽입 후 RTE 재렌더·완료대기: 5651~5666 (`renderingRichTextEditor(is_tree)`, `rerender()`, `await _oPromise`, `await Promise.all`)
- **형제(정상) 경로**: `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` `_rerenderCore`(1568~1579), `_renderMod`(771), `_req`(183)
- **노션 이슈**: BR46 (UI 추가 팝업 원본 대비 전수 감사 2026-08-14 확정), 화면=WS20 Design
- **백업**: `www/ws30/ws10_20/js/_ws_html5_ws20_edit.js.br46bak`
