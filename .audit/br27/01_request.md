# 01_request — BR27 검수 요청 (바인딩 필드 목록 가상 스크롤 미적용)

## 검수 대상

- **버그**: BR27 — WS20 속성(ATTRIBUTE) 영역에서 UI 속성 바인딩 호출 시 뜨는 **데이터 바인딩/바인딩 해제 인앱 팝업**(`dialog#u4aBindDlg`)의 **필드 목록**에 가상 스크롤 미적용 → 화면 밖 행까지 DOM 렌더, 데이터 많으면 표시·스크롤 성능 저하.
- **화면/기능**: 속성 아이콘 데이터 바인딩 인앱 팝업(`callBindPopup` 계열). ★ 대형 별창 `bindPopup`(`fnBindWindowPopupOpener`)·툴바 바인딩 팝업(BR6)과는 **다른 기능**.
- **변경 파일·함수**:
  - `www/ws30/ws10_20/js/fnBindPopupOpen.js`
    - `lf_renderTree()` — 필드 목록 트리 생성(`U4AUI.makeColumnTree` 호출)
    - `lf_selRow()` — 라인 선택(선택 불가 행 처리)
  - `www/ws30/ws10_20/theme/u4a-ui.js` (공통 트리 컴포넌트)
    - `createTree()` 내부 `selectByKey()` — 선택 강조 적용

## 변경 요약 (원본 대비)

원본 UI5는 이 팝업 필드 목록을 `sap.ui.table.TreeTable`로 그렸고, 이 컴포넌트는 **본래 보이는 행만 렌더(가상)**한다. HTML5 변환 시 공통 `makeColumnTree`를 **비가상**으로 소비해 전 행을 DOM에 그리면서 원본의 가상 성질이 유실됐다. → 공통 컴포넌트가 이미 지원하는 가상 모드를 켜 원본 동작으로 복원.

1. **`fnBindPopupOpen.js` `lf_renderTree` — `virtual: true` 추가**
   - `makeColumnTree(oUI.treeHost, { virtual: true, columns:[…3열…], … })`. USP/MIME 트리와 동일한 가상 경로 소비. 행높이·세로/가로 격자선은 공통이 실측(`--u4a-vsrowh`)해 처리.

2. **`u4a-ui.js` `createTree().selectByKey` — 가상 모드 선택 강조 영속 보완**
   - 기존 `selectByKey`는 현재 DOM(보이는 행)에만 `aria-selected`를 적용하고 윈도잉 스크롤러(`_vs`)에는 반영하지 않아, **가상 모드에서 선택 행이 화면 밖으로 나갔다 돌아오면(행 재생성) 강조가 소실**된다.
   - 보완: `if (bVirtual && _vs) { _vs.setSel(sKey==null?null:sKey); }` 한 줄 추가. 윈도잉 재생성 시 `buildRow`의 `getSelKey` 비교로 강조 재적용(2157행). **비가상/스크롤러 미생성 시 무영향**(가드).

3. **`fnBindPopupOpen.js` `lf_selRow` — 선택 불가 행 클릭 시 선택 해제 통일**
   - 기존: 선택 불가(`enable !== true`) 행 클릭 시 `oUI.tree.el.querySelectorAll('[aria-selected=true]')` 로 **보이는 행만** 해제 → 가상에선 화면 밖 이전 선택이 스크롤러에 남아 되돌아오면 강조가 되살아남.
   - 변경: `oUI.tree.selectByKey(null, false)` 로 통일 → 스크롤러 선택 키까지 해제(비가상은 기존과 동일하게 보이는 행 강조만 해제).

## 검수 포인트 (꼭 봐달라는 항목)

1. **정확성 — 선택 강조 영속**: 가상 모드에서 (a) 팝업 열 때 이전 바인딩 라인 자동 선택·reveal(`lf_setSelectTree` → `selectByKey(L_UIATV, true)`), (b) 사용자가 행 클릭 선택(`lf_selRow` → `selectByKey(n.CHILD, false)`), (c) 선택 행을 화면 밖으로 스크롤 후 복귀 시 강조 유지 — 세 경우 모두 정상인가.
2. **정확성 — 선택 불가 행 클릭**: 선택 불가 행 클릭 시 이전 선택(화면 밖 포함)이 완전히 해제되는가. `selectByKey(null, false)`가 `findRow(null)`→미스매치→전 보이는 행 해제 + `_vs.setSel(null)` 로 의도대로 동작하는가.
3. **공통 컴포넌트 영향 범위(회귀)**: `selectByKey`에 추가한 `_vs.setSel` 가드가 **다른 소비처에 회귀를 유발하지 않는가**.
   - 비가상: WS20 디자인 트리 / ServerList / P13n / patternPopup(3열 비가상) / 이 팝업의 추가속성 평면표 → `bVirtual` false 로 미진입 확인.
   - 가상: USP·MIME 트리 → 이들은 선택 강조를 화면 소유(rowHook/ISSEL)로도 관리. `selectByKey` 호출 시 `_vs.setSel` 가 **같은 키**를 반영하므로 충돌 없는지(중복/스테일 `aria-selected` 없는지).
4. **원본 1:1 여부**: 가상 스크롤 도입이 "임의 UX 추가"가 아니라 **원본 `sap.ui.table.TreeTable` 가상 성질의 복원**임이 타당한가. 목록 3열(오브젝트명/유형/설명)·계층 펼침·상태색·툴팁·추가속성 패널 동작은 변경 없이 그대로인가.
5. **가상 모드 트리 동작**: `expandToLevel(99999)`(전체 펼침), `selectByKey`(reveal 스크롤), `rerender(false)`가 가상 경로에서 정상인가. 행높이 실측(`--u4a-vsrowh`)·세로 격자선(host 스크롤 레이어)이 3열 고정폭에서 어긋나지 않는가.
6. **공통 자산 수정 정당성**: 공통(`u4a-ui.js`) 직접 수정 원칙 위반 여부. CSS 색·모양이 아닌 **트리 기능 동작 확장**이고, 과거 가상 관련 옵션(scrollContainer·virtual+가변컬럼·isExpanded passthrough)도 같은 자리에서 확장해 온 SSOT 지점이라는 판단이 타당한가.

## 근거

- **원본**: `www/ws30/ws10_20/design/js/callBindPopup.js`(원본 UI5, `sap.m.Dialog` + `sap.ui.table.TreeTable`). 필드 목록 = TreeTable(가상 렌더).
- **공통 표준**: `.analy/16` §3.4.1/§3.4.2 — 다열 그리드 트리테이블 = `U4AUI.makeColumnTree` SSOT. `virtual` 옵션·`--u4a-vsrowh` 행높이 실측은 공통 컴포넌트 소관.
- **공통 코드 근거**:
  - `makeColumnTree` 가상 배선: `u4a-ui.js` 2484(`bVirtual`), 2500(`u4aColTree--virtual` 클래스), 2637~2638(`virtual`/`scrollContainer:host`).
  - 가상 렌더·선택 재적용: `_renderVirtual`/`makeVScroller` `buildRow` 2155~2159(`getSelKey===selKey`→`aria-selected`), `setSel` 2225.
  - 행높이 실측: `shell.css` `.u4a-tree__row{height:var(--u4a-vsrowh,auto)}` 448, `.u4aColTree--virtual .u4aColTreeBody` 가로 격자선 601, `.u4aColTree{overflow:auto;height:100%}` 553.
- **검증**: `node --check` 두 파일 통과. 실제 화면(가상 윈도잉·선택 영속) 동작 확인은 앱 재시작 후 장군님 테스트 예정(테스트 시나리오는 분기 3에서 작성).
- **백업**: `_fnBindPopupOpen.js.br27bak`, `_u4a-ui.js.br27bak`.

## 참고
- BR6(툴바 바인딩 팝업 결과 리스트)과 **다른 팝업**. BR27은 ATTRIBUTE 영역 인앱 팝업 필드 목록 대상.
- 관련 메모리: `bind-popup-html5`, `table-unify-makecolumntree-virtual`, `coltree-ncolumn-and-frozen-action`.
