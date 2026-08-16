# BR36 UI 추가 팝업 BUSY ON 검수

## 판정

**통과**

재현 가능하거나 코드 계약으로 입증되는 필수 수정사항은 발견하지 못했다.

## 지적

없음.

## 상세 검수 결과

### 1. 원본 BUSY·단축키 순서

- `_showInsertPopup()`은 진입 직후 `parent.setBusy("X")`를 실행하고 이어 `setShortcutLock(true)`를 호출한다. 원본 트리 `+` press의 순서와 의미가 같다.
- 해제 헬퍼는 반대로 단축키 잠금을 먼저 풀고 `parent.setBusy("")`를 호출한다. 원본의 조기 종료 해제 순서와 같다.
- 두 ON 호출과 두 OFF 호출은 각각 try/catch로 격리되어 한쪽 오류가 다른 쪽 실행을 막지 않으며, 오류는 `console.error`로 표면화된다.

### 2. 두 사용자 진입점 커버리지와 중복 ON

- 트리 행 `+` 버튼은 `designUIAdd(node)`를 호출하고, HTML5 `designUIAdd`는 `_showInsertPopup(node)`로 위임한다.
- 우클릭 메뉴 M01도 `designUIAdd(node)`를 호출하므로 같은 오프너로 수렴한다.
- 현행 두 호출측에는 별도 `setBusy("X")`나 `setShortcutLock(true)`가 없다. 중앙 오프너에서 한 번 켜는 구현은 중복 ON 없이 두 경로를 함께 보장한다.
- KEEP-UI5 `designUIAdd`가 존재하는 환경에서도 HTML5 오프너는 `designInsertPopupHtml5`로 노출되어 원본 경로가 위임할 수 있다. boolean형 busy/lock 계약에서 중앙 오프너의 설정은 동일 상태를 재확인하며 카운터 중첩을 만들지 않는다.

### 3. 모든 동기 종료 경로의 짝

- `is_tree`가 없으면 ON 직후 `_releaseBusyLock()`을 실행하고 반환한다.
- 입력 가능한 aggregation이 없으면 메시지 280을 표시한 뒤 해제하고 반환한다.
- 팝업 구성 블록의 DOM 생성, 공통 컴포넌트 배선, 렌더, `show()` 과정에서 동기 예외가 발생하면 catch가 ESC 리스너·백드롭·다이얼로그를 정리하고 잠금을 해제한다.
- 정상 성공 경로는 다이얼로그와 백드롭을 body에 부착하고 `show()`, 최초 `lf_renderTable()`까지 마친 뒤 double-rAF에서 해제한다. 조작 가능한 화면이 실제 그려진 뒤 OFF한다는 WP1 목적에 맞는다.
- 각 분기는 상호 배타적이며 성공 경로의 예약 해제 외에 취소/확정 핸들러가 초기 오픈 잠금을 다시 해제하지 않아 정상 흐름에서 중복 OFF가 없다.

### 4. 팝업이 열린 뒤의 별도 작업 수명주기

- 초기 BUSY는 팝업이 렌더되면 끝난다. 이후 취소·X·ESC는 이미 해제된 상태에서 팝업만 닫는다.
- 확정은 팝업을 닫고 자식창 `_broadBusy(true)`를 별도 시작하며, `designAddUIObject()` resolve/reject 뒤 `_broadBusy(false)`로 정리한다. BR36의 초기 화면 busy와 다른 수명주기다.
- 행 더블클릭도 동일 `lf_confirm()`을 사용하므로 확정 경로가 중복되지 않는다.

### 5. 드래그 삽입 및 기타 경로 무영향

- 팝업 목록 행의 drag는 `_showInsertPopup()`을 재호출하지 않는다. drop은 D&D 모듈의 `designUIDropInsertPopup()`으로 이동해 `_bindBusy("BUSY_ON/OFF")` 수명주기를 사용한다.
- 기존 UI 이동·붙여넣기 역시 `_showInsertPopup()`을 통과하지 않으므로 BR36의 새 ON/OFF에 영향받지 않는다.
- drag 중에는 초기 오픈 busy가 이미 double-rAF에서 해제된 뒤이므로 팝업 밖 트리·미리보기 drop 상호작용을 막지 않는다.

### 6. 독립 서브에이전트 반박 재검수

- 독립 재검수도 재현 가능한 필수 결함을 찾지 못해 통과 판정에 동의했다.
- ON과 OFF의 busy·shortcut 호출이 각각 분리된 try/catch라 한 API의 부분 실패가 다른 API 설정·회수를 막지 않는 점을 재확인했다.
- `requestAnimationFrame` 자체가 미정의이거나 첫 예약 호출에서 동기 throw하면 구성 try의 catch가 정리한다. 첫 콜백 이후 두 번째 rAF만 비정상적으로 throw하거나 영구 미실행하는 경우는 네이티브 정상 계약에서 재현 근거가 없었다.
- KEEP-UI5 tree press가 먼저 ON한 뒤 HTML5 오프너가 다시 ON할 수 있으나 두 API는 참조 카운터가 아닌 boolean/idempotent 상태 설정이다. 동일 사용자 액션에서 single OFF가 잠금 고착이나 조기 해제를 만들지 않는다.
- `_getAggregations()`가 구성 try 바깥인 점도 공격적으로 확인했다. `LIB.T_0023`이 truthy non-array인 데이터 손상 상태에서는 `.filter()`가 throw하여 잠금이 남을 수 있으나, 정상 로드 계약은 배열이며 해당 손상을 만드는 현행 경로가 없어 필수 결함으로 승격하지 않았다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 원본 ON 순서 | 통과 | busy ON → shortcut lock ON |
| 원본 OFF 순서 | 통과 | shortcut unlock → busy OFF |
| 트리 `+` 경로 | 통과 | `designUIAdd` → `_showInsertPopup` |
| 우클릭 M01 경로 | 통과 | `designUIAdd` → `_showInsertPopup` |
| 호출측 이중 ON 방지 | 통과 | 두 HTML5 호출측에 별도 ON 없음 |
| 입력 누락 조기 종료 | 통과 | `_releaseBusyLock()` |
| aggregation 없음 종료 | 통과 | 메시지 후 `_releaseBusyLock()` |
| 구성 동기 예외 회수 | 통과 | catch cleanup + release |
| 정상 렌더 후 해제 | 통과 | DOM/render 후 double-rAF |
| 취소·확정 수명주기 분리 | 통과 | 초기 busy 종료 후 별도 처리 |
| drag 삽입 경로 무영향 | 통과 | D&D 전용 `_bindBusy` |
| 오류 표면화 | 통과 | 각 catch `console.error` |
| JavaScript 구문 검사 | 통과 | `node --check` |
| 독립 반박 재검수 | 통과 | 필수 지적 0건, 기존 판정 동의 |

## 잔여 참고

- double-rAF는 창이 백그라운드·최소화되는 특수 상황에서 브라우저 스케줄링에 따라 지연될 수 있다. 사용자가 현재 창에서 팝업을 여는 정상 경로에서는 프레임이 진행되며, 타임아웃을 추가하는 것은 요청 범위와 WP1의 타임아웃 금지 원칙에 어긋나므로 결함으로 판정하지 않았다.
- BUSY ON 이후 aggregation 계산은 구성 try 블록보다 앞에 있지만 `_getAggregations()`는 부재 라이브러리를 빈 배열로 정규화한다. 정상 메타데이터 계약에서 재현 가능한 throw 근거가 없어 필수 지적으로 올리지 않았다.

## 검증 범위

- `.audit/br36/01_request.md` 전체 검수 포인트
- 원본 `www/ws30/ws10_20/design/js/uiDesignArea.js:245-282`, `6569-6611`
- HTML5 `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1266-1661`, `1845-1880`, `1884-1917`
- 트리 진입 `www/ws30/ws10_20/js/ws_html5_ws20_tree.js:552-561`
- D&D `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:854-901`
- 프로젝트 규칙에 따라 언더바로 시작하는 폴더·백업 파일은 현행 근거에서 제외했다.
