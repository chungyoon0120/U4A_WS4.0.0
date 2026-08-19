# BR59 검수 요청 (01)

## 이슈 요약 (노션 이슈 리포트 DB, 코드=BR59)
WS20 Design 화면에서 **미리보기(Preview) 우클릭 메뉴의 Up / Down / Move Position**(또는 디자인 트리 우클릭 이동 메뉴)으로 UI 위치를 바꾸면, **디자인 트리에서는 정상 이동**하지만 **미리보기에서는 다른 자리로 이동**해 트리와 미리보기의 표시 순서가 어긋난다.

- 재현: 한 부모(예 `TABLE1`) 아래에 서로 다른 aggregation(그룹) 자식이 섞여 있을 때(rows·toolbar·columns·title 등), `columns` 그룹의 `COLUMN2`를 Up 하면 트리는 첫 Column 위치로 가는데 미리보기는 세 번째 Column 위치로 삽입됨.
- 원인(이슈 본문): 미리보기 이동 함수 `moveUIObjPreView` 에 넘기는 위치(Position) 값을 **같은 그룹(aggregation) 자식만** 기준으로 계산하지 않고, **부모 밑 전체 자식(다른 그룹 섞임) 순서**로 계산해서 발생.
- 기대결과(이슈 본문): 미리보기 이동 Position 은 **이동 대상과 같은 그룹의 자식만 필터링한 순서** 기준이어야 하며, 특정 UI/특정 그룹 예외처리가 아니라 **컨텍스트 메뉴 공통 이동**에 동일 기준이 적용돼야 한다.
- 참고: **끌어놓기(Drag & Drop) 경로는 정상**(이미 같은 그룹 기준으로 계산). 컨텍스트 메뉴 이동 경로만 결함.

## 검수 대상 (파일 · 함수)
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` (HTML5 이식 파일, 원본 폴더 밖)
  - 신규 헬퍼 `_aggrPos(aSib, oNode)` / `_aggrPrevIndex(aSib, oNode)`
  - `_moveUI(oNode, sDir)` — 컨텍스트 메뉴 **Up / Down** 이동 (미리보기 우클릭 위/아래도 이 경로로 위임: `oAPP.fn.fnWs20MoveUI`)
  - `oAPP.fn.fnWs20MoveUIToIndex(oNode, iTarget)` — **Move Position**(위치 이동 팝업) 확정 이동

## 변경 요약 (원본 대비)
기존 두 이동 경로는 미리보기에 넘기는 위치로 **부모 전체 자식 배열의 인덱스**(`_moveUI` 의 `newIdx`, `fnWs20MoveUIToIndex` 의 `iTarget`)를 그대로 전달했다. 미리보기 `moveUIObjPreView` 는 이 값을 `insertAggregation(그룹, UI, index)` 의 index 로 써서 **그룹 내 위치**로 삽입하므로, 다른 그룹 자식까지 포함된 전체 인덱스를 넘기면 잘못된 자리에 꽂힌다.

원본(as-is) `design/js/callDesignContextMenu.js` 의 `contextMenuUiMove` 는 미리보기 위치를 다음으로 계산한다:
1. 같은 그룹(`UIATT` 동일) 자식만 필터 → 그 목록 안에서의 이동 대상 위치(`l_indx2`)
2. 그 앞쪽 형제 중 **부모에 실제로 안 붙는 UI(UA026)** 개수만큼 index 감산(`l_cnt`)
3. **이동 전 그룹 내 위치(`l_indx1`)와 이동 후(`l_indx2`)가 다를 때만** 미리보기 이동 호출

이 세 가지를 HTML5 두 경로에 1:1 반영:
- `_aggrPos` = 같은 그룹 자식 목록 안에서의 위치(원본 `l_indx1`/`l_indx2`).
- `_aggrPrevIndex` = 그 위치에서 UA026 형제 수만큼 뺀 미리보기 삽입 index(원본 `l_cnt`).
- 두 경로 모두 이동 전 `_aggrPos`(before) 기록 → 이동 후 `_aggrPos`(after) 와 **다를 때만** `moveUIObjPreView` 호출, 넘기는 index 는 전체 인덱스 대신 `_aggrPrevIndex`.
- **트리 이동(전체 배열 splice) 자체는 원본대로 유지**(트리는 전체 자식 순서로 표시). 미리보기에 넘기는 index 계산만 그룹 기준으로 교정.

## 검수 포인트
1. **정확성**: `_aggrPrevIndex` 가 원본 `l_cnt` 산식(같은 그룹 위치 − 앞쪽 UA026 수)과 정확히 일치하는가. UA026 판정(`T_9011` 의 `CATCD==="UA026" && FLD02!=="X"`, `FLD01===UILIB`)이 원본 `callDesignContextMenu.js` 534~543 과 동일한가.
2. **가드 동등성**: `iAggrBefore !== iAggrAfter` 일 때만 미리보기 이동하는 것이 원본 `l_indx1 !== l_indx2` 가드와 동작이 같은가. 그룹을 넘지 않고 다른 그룹 형제만 지나친 이동에서 미리보기를 건드리지 않는 게 맞는가(원본 계약).
3. **원본 1:1**: 트리 splice(전체 배열)는 그대로 두고 미리보기 index 만 그룹 기준으로 바꾼 게 원본과 어긋나지 않는가. 원본에 없는 UX·동작을 임의 추가하지 않았는가.
4. **양 경로 커버리지**: 미리보기 우클릭 Up/Down(위임), 트리 우클릭 Up/Down, 미리보기·트리 Move Position 확정까지 모두 교정되는가(이슈 참고사항의 "트리 우클릭에서도 동일 현상" 포함).
5. **부작용/안전**: `T_9011` 미로드 시 try/catch 로 UA026 제외 없이(빈 배열) 진행 — 그룹 기준 index 자체는 유지되는가. busy on/off 짝(`_broadBusy`)·Undo 스냅샷·선택·변경플래그·바인딩 팝업 반영은 기존과 동일하게 유지되는가.
6. **클로저 함정**: `_aggrPrevIndex` 의 for 루프 내 `findIndex` 콜백이 참조하는 `sUilib` 를 매 반복 지역변수로 캡처했는가(for var 클로저 오참조 없음).

## 근거
- 원본(as-is, 상류 = `U4A_WS_DESIGN`):
  - `design/js/callDesignContextMenu.js` `contextMenuUiMove` — 컨텍스트 메뉴 이동의 미리보기 index 산식(같은 그룹 필터 `l_indx1`/`l_indx2`, UA026 감산 `l_cnt`, `l_indx1!==l_indx2` 가드, `moveUIObjPreView` 호출).
  - `design/js/uiDesignArea.js` — 끌어놓기/추가 경로의 동일 산식(같은 그룹 필터 + UA026 제외 카운트).
  - `design/preview/index.js` `moveUIObjPreView` — 넘긴 index 를 `insertAggregation(UIATT, control, index)` 로 그룹 내 위치에 삽입.
- `.analy`: WS20 디자인 영역 트리↔미리보기 동기화(그룹/aggregation 기준 위치). 별도 신규 UX 없음(원본 산식 이식).
