# BR52 검수 요청서 — ATTRIBUTE 오류 항목으로 이동 시 상단 요약영역 접기·해당 행 선택 강조 누락

## 검수 대상

- 파일 1: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` — `oAPP.fn.setAttrFocus` (3220행~, 이번 수정 3244~3273행 부근)
- 파일 2: `www/ws30/ws10_20/WS10/css/ws20.css` — 속성 행 선택 강조 규칙 (1040~1043행 부근, `[aria-selected="true"]`)
- 기능: WS20 오른쪽 Attribute(속성) 영역에서 "오류/대상 속성으로 화면 이동"(Error Message Popup 줄 클릭, Find 팝업, 바인딩 팝업, 서버이벤트 콤보 미등록 판정 등 setAttrFocus 전 경로)
- 노션 이슈: BR52 (상태=접수)

## 배경 (버그 내용)

원본 `setAttrFocus`(U4A_WS_DESIGN `design/js/uiAttributeArea.js:8186~8360`)는 대상 속성으로 이동할 때
① 대상 행 선택 강조(`oRTab1.setSelectedItem`, 8279행)
② 상단 요약영역 접기(`attrHeaderExpanded(false)`, 8338행)
③ 부드러운 스크롤(`scrollIntoView({behavior:"smooth", block:"nearest", inline:"start"})`, 8346행) + rAF 비동기 포커스(8355행)
를 수행하는데, HTML5 이식본은 즉시 스크롤(`block:"nearest"`)+즉시 포커스만 하고 ①②가 빠져 있었다.

## 변경 요약 (원본 대비)

`setAttrFocus`의 "행 찾은 뒤" 블록에 원본 3요소를 이식. valst 설정·재렌더 등 앞부분은 무변경.

1. **행 선택 강조**: 기존 `aria-selected` 표시 전부 제거 후 대상 행에 `aria-selected="true"` 지정(단일 선택 — 원본 sap.m.Table 단일선택 의미). CSS는 트리 줄 선택과 같은 의미 토큰(`--ws20-sel-bg` = `--selected-bg`) 소비, hover 시에도 선택색 유지.
2. **상단 접기**: 기존 구현돼 있던 `_attrHeaderExpanded(false)`(3163행, 원본 attrHeaderExpanded 9522행의 HTML5 대응 — 스크롤 방식) 호출을 원본 위치대로 추가.
3. **부드러운 스크롤 + rAF 포커스**: 원본 8346·8355행 1:1 (`behavior:"smooth"` + `requestAnimationFrame` 안에서 focus).

각 단계는 개별 try/catch(포커스는 rAF 내부 try)로 감싸되 console 삼킴 없음(스크롤/선택 강조는 실패해도 치명 아님 — 기존 스타일 유지).

## 검수 포인트

1. **원본 1:1 순서**: 원본은 setSelectedItem(8279) → 셀/컨트롤 탐색 → attrHeaderExpanded(false)(8338) → smooth 스크롤(8346) → rAF focus(8355). 이식본은 [재렌더 → 선택 강조 → 접기 → smooth 스크롤 → rAF focus]. 원본과 달리 재렌더(fnRenderWs20AttrRows)가 선행하는데(HTML5 는 모델 refresh 대신 DOM 재렌더), 이 순서 차이가 문제를 만드는지.
2. **접기(_attrHeaderExpanded(false)) 후 스크롤 간섭**: 접기가 같은 스크롤 영역(ws20AttrScroller)의 scrollTop 을 옮기고, 직후 행 scrollIntoView(smooth) 가 다시 움직인다. 두 스크롤이 충돌해 최종 위치가 어긋날 여지(원본도 접기→스크롤 연속 수행이긴 함).
3. **선택 강조 잔존/정리**: 재렌더(fnRenderWs20AttrRows)가 행 DOM 을 새로 만들면 aria-selected 는 사라진다(선택이 렌더 세대에 한정). 원본 sap.m.Table 은 선택이 모델처럼 유지된다 — 이 차이가 실사용(오류 이동 직후 다른 조작)에서 어색함을 만드는지. 또 다른 UI 선택 시(_updateAttrList 재렌더) 자동 소거되는 동작이 원본 "다른 UI 이동 시 초기화"와 합치하는지.
4. **rAF 포커스와 BR34 재진입 방지 충돌**: focus 가 rAF 로 늦춰지면서 값칸 blur/change 타이밍과 겹칠 여지, BR34 의 `_fnAttrChangeBusy` 재진입 플래그·`_attrVsRefocus`(오류 말풍선 재포커스)와 포커스 경쟁이 생기는지. (setAttrFocus 는 fnWs20SelectUI 10단계, 서버이벤트 콤보 오류, Find 팝업 경로에서 호출.)
5. **공통 자산 소비**: 선택색이 하드코딩 없이 의미 토큰(`--ws20-sel-bg`→`--selected-bg`)만 쓰는지, 트리 선택 표시(aria-selected)와 일관인지. hex 하드코딩·color-mix 금지 준수.
6. **전 호출 경로 회귀**: setAttrFocus 호출처(오류 목록 창 줄 클릭 → setSelectTreeItem → fnWs20SelectUI 10단계 / 서버이벤트 콤보 미등록 / Find 팝업 등)에서 접기·선택 강조가 부작용을 일으키는 곳이 없는지 — 특히 "오류 아닌 일반 이동"(TYPE 미지정) 경로도 원본처럼 접기+강조가 수행되는 것이 맞는지(원본 8338 은 TYPE 무관 무조건 수행).

## 근거

- 원본: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiAttributeArea.js` — setAttrFocus 8186~8360 (선택 8279 / 접기 8338 / smooth 스크롤 8346 / rAF focus 8355), attrHeaderExpanded 9522.
- 노션 이슈 BR52 본문 (근거 라인 동일).
- 공통 표준: 선택 행 표시 = 공통 aria-selected + `--selected-bg` (트리 공통 컴포넌트와 동일 표시 — `.analy/16` 트리/선택 표준 결).
- node --check 통과(JS). CSS 는 스코프 클래스(`.u4aWs20AttrRow`) 한정 — 공통 파일 미수정.
