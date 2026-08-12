# 02_audit_codex — BR23 미리보기 내 패턴 및 개인화 팝업 UX 재검수

## 판정

**통과**

## 지적

없음.

## A. 미리보기 M11 HTML5 모듈 선로드

- `www/ws30/ws10_20/design/js/callDesignContextMenu.js:207-238`은 `fnP13nDesignPopupOpen` 존재 여부로 HTML5 모듈 로드를 판정한다.
- 미로드 상태에서는 동기 `oAPP.loadJs("fnP13nDesignPopupOpen", run)`으로 모듈을 먼저 평가한다. 모듈이 `contextMenuP13nDesignPopup`과 `callP13nDesignDataPopup`을 HTML5 구현으로 덮어쓴 뒤 성공 콜백에서 `run()`을 실행하므로, 최초 진입에서도 KEEP-UI5의 `new sap.m.Dialog(...)` 경로로 들어가지 않는다.
- 로드 후에는 모듈 표식으로 재로드를 막아 반복 호출 시 스크립트·이벤트가 중복되지 않는다.

### 대상 OBJID와 잠금 회수

- 미리보기 컨텍스트 메뉴는 `/lcmenu`를 부모 모델에도 기록한다(`callDesignContextMenu.js:274-358`).
- 인자 없이 호출된 HTML5 함수는 `/lcmenu/OBJID`를 읽고 `getTreeData()`로 최신 노드를 확보한다(`www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js:1530-1541`). PAGE5 같은 실제 우클릭 대상이 제목과 등록 대상에 반영된다.
- 정상 경로는 팝업 모듈이 렌더·미리보기 준비 후 BUSY를 해제한다. M11 분기는 정상 실행 중간에 별도 해제하지 않는다.
- 실행 예외는 `run()` catch가, 로더 예외와 콜백 미실행은 로드 후 함수 존재 사후검사가 각각 단축키 잠금과 BUSY를 해제한다.
- 모듈 내부 ROOT/노드 없음, 폴더 생성 실패, 다른 화면 개인화 잠금(382), 취소·닫기 경로도 `_unlock()`과 `_busy(false)` 쌍을 가진다.
- 로드 성공 시 함수 존재 검사가 참이므로 하단 실패 분기는 실행되지 않아 이중 해제가 없다.

## B. 헤더와 툴바 색 경계

- 등록·리스트·미리보기 툴바에서 `background: var(--surface-raised)`가 제거됐고, 트리 툴바는 팝업 스코프 `.u4aP13nTreeTool`에서만 `background: transparent`로 덮어쓴다(`fnP13nDesignPopupOpen.js:1610`, `1641-1644`).
- WS20 본체 `.u4aWs20TreeToolbar` 규칙은 수정되지 않아 본 화면 배경에는 영향이 없다.
- 하단선은 `var(--ws20-sep)`를 사용하고 `.u4aP13nDlg`가 `--ws20-sep: var(--divider)`를 자체 매핑한다(`1575-1582`). 다이얼로그가 `body` 직속이어도 토큰이 유효하다.
- 변경 범위에 hex·`color-mix` 추가가 없고 의미 토큰만 소비한다.

## C. 우측 디자인 트리 가상 스크롤

- `lf_renderTree()`는 `oUI.tree`가 없을 때만 `U4AUI.createTree({ virtual:true, ... })`를 만들고 이후 같은 컨트롤러를 재사용한다(`1075-1124`).
- 트리 엘리먼트를 래퍼에 붙인 뒤 `collapseAll()`과 `expandToLevel(1)`이 재렌더하므로 가상 스크롤러가 실제 스크롤 부모를 정상 확보한다.
- `roots`와 `children` 콜백은 매 렌더마다 최신 `oS.zTREE`를 읽는다. 대상 변경 후에도 이전 데이터에 고정되지 않는다.
- 공통 렌더러는 펼친 노드만 평탄화하고 `makeVScroller`로 가시 영역만 DOM에 만든다. 전체 펼침·접기·1단계 펼침도 내부 맵 갱신 후 가상 재렌더한다.
- 팝업 DOM은 닫은 뒤 재사용되어 같은 래퍼에 스크롤러가 중복 생성되지 않는다. DOM 재빌드 시에는 `lf_build()`의 `oUI = {}`로 옛 트리 참조를 재사용하지 않는다.
- 화면별 트리 행 높이 재정의는 추가되지 않았다.

## D. 팝업 위 드롭 무효화

- `_setModalLook(false)`는 가짜 백드롭만 숨기고 다이얼로그의 `pointer-events`는 유지한다(`1203-1212`).
- `u4aP13nDragThru` 참조가 제거돼 드래그 중에도 팝업 영역이 포인터 적중 대상이다. 팝업 뒤 트리·미리보기는 가려진 영역에서 `dragover/drop`을 받지 않는다.
- 팝업 밖에서는 백드롭이 사라져 보이는 디자인 트리·미리보기가 정상 드롭 이벤트를 받을 수 있다.
- 전환은 `dragstart` 이후 `setTimeout`으로 수행돼 드래그 시작을 취소하지 않는다. `dragend`는 백드롭 복원과 `designDragEnd()` 정리를 수행한다(`1215-1218`).

## 수용 기준 점검

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 최초 미리보기 M11 UI5 예외 차단 | 통과 | HTML5 모듈 선로드 후 오버라이드 호출 |
| 우클릭 OBJID 전달 | 통과 | `/lcmenu/OBJID` 폴백 + `getTreeData()` |
| 정상·취소·오류·로드 실패 잠금 회수 | 통과 | 호출부와 모듈 내부 종료 경로 확인 |
| 정상 BUSY 해제 시점 | 통과 | 모듈 렌더/미리보기 완료 경로가 소유 |
| Design Tree M11과 진입 방식 일치 | 통과 | 동일 모듈 표식·동기 로더·HTML5 함수 사용 |
| KEEP-UI5 파일 무수정 | 통과 | 호스트 연결점만 변경 |
| 반복 호출·이중 해제 방지 | 통과 | 로드 표식 및 성공 후 실패분기 배제 |
| 툴바 경계·토큰·스코프 | 통과 | 팝업 전용 override, 자체 토큰 매핑 |
| 가상 트리·펼침/접기·컨트롤러 재사용 | 통과 | 공통 `createTree` 계약과 일치 |
| 팝업 내부 드롭 차단·외부 드롭 허용 | 통과 | 백드롭만 토글, 다이얼로그 적중 유지 |
| JavaScript 구문 검사 | 통과 | 변경 JS 두 파일 `node --check` 통과 |

## 검증 범위

- `.audit/br23/01_request.md` 재검수 2차의 A~D 전체
- `.analy/00`, `12`, `13`, `16`, `05`의 디자인영역·공통 UX·테마·가상 트리 기준
- 활성 소스 diff, 로더 계약, 부모/iframe 객체 경계, 공통 `createTree`·`makeVScroller` 정적 추적
- 실제 대용량 데이터 스크롤과 마우스 드롭 실화면 테스트는 수행하지 않았다.

