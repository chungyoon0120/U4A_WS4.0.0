# BR28 검수 요청 (01_request)

## 대상 버그(노션 이슈 리포트 DB)
- 코드: **BR28** / 화면: **UI 속성 바인딩 팝업**(작은 인앱 팝업 `dialog#u4aBindDlg`)
- 현상: WS20 ATTRIBUTE 영역에서 Property 또는 Aggregation에 바인딩을 설정한 뒤,
  **같은 라인의 바인딩 호출 버튼을 다시 눌러 팝업을 재오픈**하면 기존 바인딩 경로·필드 정보는 정상 복원되나,
  **왼쪽 바인딩 필드 목록이 기존 바인딩 필드 위치로 스크롤 이동하지 않는다**(사용자가 직접 탐색해야 함).
  Property·Aggregation 모두 동일.

## 검수 대상(파일·함수)
- `www/ws30/ws10_20/js/fnBindPopupOpen.js`
  - `lf_setSelectTree(l_path)` — 재오픈 시 기존 바인딩(또는 N건 path) 라인 펼침·선택·스크롤.
  - `lf_loadData(bRefresh)` — 로드 진입부(직전 예약 스크롤 취소 배선 추가).

## 변경 요약 (원본 대비)
- **원본(as-is) 근거**: `www/ws30/ws10_20/design/js/callBindPopup.js`의 `lf_setSelectTreeItem`
  (506~617행) — 이전 바인딩 경로(`L_UIATV = is_attr.UIATV`, `ISBND==="X"`; 없으면 N건 aggregation path)를
  따라 트리를 펼치며 대상 라인을 찾아 **`setSelectedIndex` + `setFirstVisibleRow`(그 줄로 목록 이동)** 한다.
- **HTML5 결손**: `lf_setSelectTree`는 `selectByKey(L_UIATV, true)`만 호출했다. 공통 트리
  `u4a-ui.js`의 `selectByKey`는 주석대로 **비가상 트리에선 스크롤을 하지 않는다**(가상 모드에서만
  `scrollToKey` 경유). 또한 바인딩된 프로퍼티(F)면 그 직후 `lf_selRow`가 추가속성 패널을 펼쳐
  트리가 재배치되어, 설령 스크롤됐어도 위치가 흐트러진다. 결과적으로 원본 `setFirstVisibleRow`가
  화면에 확정되지 않았다.
- **수정**: `lf_setSelectTree`에서 선택 직후, **레이아웃 확정 뒤(requestAnimationFrame)**
  `oUI.tree.scrollToKey(L_UIATV)`를 한 번 더 호출해 대상 라인으로 목록을 확정 이동한다.
  `scrollToKey`는 가상(윈도 재계산)·비가상(scrollIntoView) 모두 대응(공통 컴포넌트가 이미 노출).
  겹치는 로드 대비 `lf_loadData` 진입 시 직전 예약 rAF를 먼저 취소(WP1 직렬화).

## 검수 포인트(봐 주세요)
1. **원본 1:1 동작 여부**: 재오픈 시 "기존 바인딩 필드로 목록 이동"이 원본
   `lf_setSelectTreeItem`(`setFirstVisibleRow`) 의도와 일치하는가. 원본에 없는 UX를 더하진 않았는가.
2. **공통 자산 무수정**: `u4a-ui.js`(공통 트리)를 건드리지 않고 화면 스코프에서만 처리했는가.
   `scrollToKey` 소비가 올바른가(가상/비가상 양쪽).
3. **rAF 수명주기**: 예약한 스크롤 rAF가 재로드/새로고침/닫기와 겹칠 때 누수·엉뚱한 스크롤을
   유발하지 않는가(`lf_loadData` 진입 취소 + `lf_setSelectTree` 재예약 전 취소로 충분한가).
   닫힘 후 rAF 발화 시 안전한가.
4. **선택·강조 회귀**: 기존 `selectByKey(L_UIATV, true)` + `lf_selRow` 흐름(선택 강조,
   추가속성 패널 표시, 우측 참조필드 구성)이 그대로 유지되는가.
5. **N건(aggregation) path**: `L_UIATV`가 `is_attr.UIATV`가 아니라 `l_path`(N건 바인딩)에서
   올 때도 스크롤 대상 키가 목록에 존재해 정상 이동하는가.
6. **BR27(가상 스크롤) 회귀 없음**: 최초 오픈(미바인딩) 시 첫 행 유지 등 기존 거동에 부작용이 없는가.

## 근거
- 원본: `www/ws30/ws10_20/design/js/callBindPopup.js:506~617`(`lf_setSelectTreeItem`,
  `setSelectedIndex`/`setFirstVisibleRow`), `:591~597`.
- 공통 트리: `www/ws30/ws10_20/theme/u4a-ui.js` `selectByKey`(비가상 스크롤 미수행 주석),
  `scrollToKey`(가상/비가상 분기).
- 관련: 직전 커밋 BR27(`fnBindPopupOpen.js` `virtual:true`) — 이 목록이 가상 스크롤로 전환됨.
