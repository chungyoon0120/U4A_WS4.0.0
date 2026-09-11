# 드래그 텍스트 선택·복사 개선 (앱 검색 도움말 + 공통 테이블)

## 요청
장군님: WS10 앱 검색 도움말(`U4A 앱 검색 도움말`) 팝업에서 조회된 항목 텍스트를 마우스로 드래그해
블럭 잡아 복사하려는데 ① 마우스를 떼는 순간 블럭이 사라지고 라인 선택 표시만 남는다,
② 패키지별 앱 계층 구조 탭에서도 힘들다, ③ 글자에 정확히 조준해야만 간신히 되고 글자 옆 여백부터
드래그하면 아예 안 잡힌다 — 개선 요청. (진행 중 "클릭만 선택, 드래그는 선택 안 되게" 방식 채택 지시.)

## 변경 내용
세 갈래로 고침(모두 같은 작업의 후속 수정, 순서대로).

1. **재렌더가 블럭을 지우던 문제** — 행 클릭 선택 시 가상 스크롤이 보이는 행 DOM 을 통째로 다시
   그려(`refresh`→`_render`) 셀 text node 가 지워지며 브라우저 text selection 이 붕괴.
   - 공통 `makeVScroller` 에 경량 강조 토글 `markSel(k)` 추가(재렌더 없이 이미 그려진 행 `aria-selected`
     만 토글, `_render` 가 각 행에 `__vsKey` 스탬프). 공개 `setSel`(off-screen reveal)은 그대로 유지.
2. **드래그면 선택 스킵**(장군님 채택 방식) — 공통 `isTextDragSelecting()`(click 시점 `window.getSelection()`
     이 non-collapsed 면 true = 드래그) 추가. 각 행 click 핸들러 맨 앞에 가드 → 드래그로 블럭 잡은 채 뗀
     click 은 행 선택/트리 펼침을 건너뛰어 블럭 보존. plain click 은 mousedown 이 selection 을 collapse
     하므로 정상 선택.
3. **여백부터 드래그해도 잡히게** — 선택 허용 범위(`user-select:text`)를 `.u4a-table tbody td`(셀 하나)
     → `.u4a-table tbody`(행 전체)로 확대(shell.css §2.9). 전역 none 조상 체인 때문에 글자에만 조준돼야
     잡히던 것 해소. 트리 이름은 flex 배치라 라벨 옆이 flex free space(선택 시작 불가) → 트리 라벨에
     `flex:1 1 auto;min-width:0` 부여해 라벨이 셀 폭을 채우게(빈 공간 제거).

## 변경 파일
- 추가:
  - `.works/드래그복사/00_현황판.md` (테스트 체크리스트 DC1~DC8)
  - 백업: `theme/_u4a-ui.js.20260910.dragcopybak`, `js/_fnAppF4PopupOpen.js.20260910.dragcopybak`
- 변경:
  - `www/ws30/ws10_20/theme/u4a-ui.js` — `isTextDragSelecting()` 추가·export, `makeVScroller` 에 `markSel`+`__vsKey` 스탬프, 공통 `createTable`·`createTree` 행 클릭에 드래그 가드
  - `www/ws30/ws10_20/theme/shell.css` — §2.9 선택 허용 `.u4a-table tbody td` → `.u4a-table tbody`
  - `www/ws30/ws10_20/js/fnAppF4PopupOpen.js` — 탭1·탭2(트리) 행 클릭 드래그 가드 + `markSel`, 트리 라벨 `flex:1`
  - `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` — UI 삽입 팝업 목록 행 클릭 드래그 가드 + `markSel`
  - `www/ws30/ws10_20/js/fnCtsPopupOpen.js` — 요청(CTS) 선택 팝업 목록 행 클릭 드래그 가드
  - `.analy/16_공통_화면UX_표준.md` — §2.9 tbody 로 갱신
- 삭제: 없음

## 변경 이유
테이블 데이터 셀은 드래그로 선택·복사 가능해야 함(.analy/16 §2.9). 가상 스크롤의 클릭-재렌더가 블럭을
지우고, 선택 허용이 셀 단위로만 좁아 글자 조준을 강요하던 두 결함을 근본에서 제거. 장군님이 "드래그는
선택 표시 안 되게" 방식을 지정.

## 영향 범위
- 공통 `u4a-ui.js`(makeVScroller/createTable/createTree)·`shell.css` §2.9 변경 → **가상 스크롤을 쓰는 모든
  선택가능 데이터 테이블** 및 **모든 `.u4a-table` 데이터 행**에 파급(장군님 "공통 전체" 승인).
- 헤더(`thead th`)·네비게이션 트리(`.u4a-tree`)는 계속 `user-select:none` 유지 — 파급 안 됨.
- 드래그 가능 행(WS20 등 `draggable` 행)은 native DnD 가 우선이라 tbody:text 와 충돌 없음(소스 근거, 미실측).

## 검증
- `node --check` 통과: u4a-ui.js / fnAppF4PopupOpen.js / fnCtsPopupOpen.js / ws_html5_ws20_edit.js.
- shell.css·트리 CSS: **실행이 Electron 이라 실제 드래그·복사는 직접 확인 못 함(미검증)** — 소스 근거로 수정.
  단 선택 허용 범위를 넓히기만 한 변경이라 회귀 위험 낮음. 실제 확인은 현황판 DC1~DC8 로 장군님 테스트 대기.
- JS 방해 요소(전역 mousedown/selectstart preventDefault, dragstart) 없음을 grep 으로 확인 → 순수 CSS 문제로 판정.

## 참고 사항
- 이번 세션 3회 왕복(재렌더→드래그가드→여백). 앞 단계 `markSel` 은 남겨 뒀으나, 드래그 가드가 들어간 뒤엔
  plain click 시 재렌더 방지용(성능)으로만 의미. 두 방식 병존이 안전.
- 관련 메모리: `vscroller-click-refresh-wipes-text-selection`, `text-select-copy-policy`.
