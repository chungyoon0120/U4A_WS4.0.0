# BR38 Design Tree → Preview 선택 스크롤 검수

## 판정

**통과**

정적 코드, 원본 동작 계약 및 현행 WS20 레이아웃 기준으로 재현 가능한 필수 수정사항은 발견하지 못했다.

## 지적

없음.

## 상세 검수 결과

### 1. 누락 기능 복원과 호출 경로

- 현행 선택 흐름은 `ws_html5_ws20_attr.js:3236-3243`에서 Preview iframe의 `selPreviewUI(OBJID)`를 호출하고, `design/preview/index.js:5995-5998`이 해당 UI5 인스턴스를 `oWS.sMark.fn_mark`에 전달한다.
- `fn_mark`는 기존에 선택 CustomData와 선택 레이어만 갱신하고 반환했으며, 선택 DOM을 표시 범위로 이동시키는 처리가 없었다.
- 추가된 `index.js:4847-4857`은 기존 선택 표시가 설정된 뒤 렌더링된 UI의 DOM을 구해 `scrollIntoView`를 호출한다. Design Tree → Preview 방향의 누락 지점에 직접 배치되어 우회 상태를 만들지 않는다.
- `selPreviewUI`와 `fn_mark`의 함수 시그니처 및 Promise 반환 계약은 바뀌지 않았다. `.analy/05_디자인영역.md`가 요구하는 Tree↔Preview 동기화와 iframe 통신 인터페이스 보존에 부합한다.

### 2. 스크롤 조건의 정확성

- `scrollIntoView({ block:"nearest", inline:"nearest" })`는 대상이 각 스크롤 컨테이너의 표시 범위 안에 있으면 이동량이 0이므로 현재 위치를 유지한다.
- 대상이 위·아래 또는 좌·우 표시 범위 밖에 있으면 가장 가까운 가장자리까지만 이동한다. 항상 상단 정렬하는 boolean `true` 방식보다 이슈의 “밖일 때만 이동” 조건에 정확히 맞는다.
- 원본 속성 영역 `design/js/uiAttributeArea.js:8302-8303`도 기존 `scrollIntoView(true)` 대신 `block:"nearest"` 패턴을 사용한다. 프로젝트 내 원본 동작 방식과 일치한다.

### 3. 선택 상태 전이와 타이밍

| 상태 | 예상 결과 | 검수 결과 |
|---|---|---|
| 화면 밖 UI를 Tree에서 선택 | Preview 내부가 해당 UI까지 이동 | 통과 |
| 이미 보이는 UI 선택/재선택 | 기존 스크롤 위치 유지 | 통과 |
| Preview에서 보이는 UI 직접 선택 | 불필요한 점프 없음 | 통과 |
| DOM 미렌더·삭제 상태 | 스크롤 호출 없이 종료 | 통과 |
| 연속 선택 | 예약 순서대로 처리되어 최종 선택 위치로 수렴 | 통과 |

- `setTimeout(..., 0)`은 선택 CustomData와 레이어 갱신 뒤 스크롤 측정을 다음 task로 미룬다. 동기 마킹을 방해하지 않으며 일반 사용자 이벤트에서 예약 순서는 FIFO다.
- 콜백 실행 전에 `getDomRef()`를 다시 호출하므로 그 사이 재렌더된 경우 최신 DOM을 얻는다. UI가 제거되거나 미렌더 상태면 null 가드로 안전 종료한다.
- `fn_mark`가 falsey UI를 받는 기존 조기 반환 경로에는 타이머가 생성되지 않는다.

### 4. iframe 바깥 스크롤 전파 반박 검증

- CSSOM View의 `scrollIntoView` 알고리즘은 원칙적으로 안쪽부터 바깥쪽까지 대상의 조상 스크롤 박스를 순회한다. Chromium 구현에도 iframe에서 부모 frame으로 전파하는 경로가 존재한다. 따라서 API 일반론으로 “항상 iframe 내부에만 한정된다”고 단정하면 안 된다.
- 그러나 결함 판정은 현행 레이아웃에서 실제 이동 가능한 부모 스크롤 박스가 있는지를 함께 봐야 한다. WS20은 다음과 같이 부모 방향 스크롤을 구조적으로 막는다.
  - `WS10/css/ws10.css:12-16`: WS10 루트가 `height:100vh; overflow:hidden`.
  - `WS10/css/ws20.css:22-24`: 앱 영역이 `overflow:hidden`.
  - `ws20.css:195-200`: 3분할 영역이 `overflow:hidden`.
  - `ws20.css:205-207`: 각 패널이 `overflow:hidden`.
  - `ws20.css:1364-1367`: Preview panel body가 `overflow:hidden`.
  - `ws_html5_ws20_prev.js:970-980` 및 `ws20.css:1351-1360`: iframe wrapper가 100% 크기이고 `overflow:hidden`.
- `overflow:hidden` 요소도 프로그램으로 스크롤될 수 있으므로 속성만으로 부모 이동을 부정할 수는 없다. 결정적인 근거는 현재 기하다. wrapper와 iframe이 Preview body를 폭·높이 100%로 정확히 채우고, flex 조상들이 `min-height:0`으로 가용 영역 안에 수축하므로 iframe 요소 자체가 각 부모 scrollport 안에 이미 완전히 들어와 있다. `nearest`가 iframe 경계를 넘어 부모 단계까지 계산하더라도 필요한 이동량은 0이다.
- 따라서 Preview 내부의 실제 UI 스크롤 컨테이너와 iframe viewport는 움직이지만, 현행 WS20 셸·Tree·Attribute 패널은 이동하지 않는다. “메인 화면 전체가 덜컥거린다”는 P1은 현재 구조에서 재현되지 않는다.
- 이 결론은 API가 본질적으로 iframe 경계에 갇힌다는 뜻이 아니다. 향후 WS20 상위 레이아웃을 스크롤 가능하게 바꾸면 회귀할 수 있으므로 실화면 검증 및 구조 변경 시 재검토가 필요하다.

참고 표준·구현 근거:

- [W3C CSSOM View Module — scrollIntoView](https://www.w3.org/TR/cssom-view-1/#dom-element-scrollintoview)
- [Chromium scroll_into_view_util.cc](https://chromium.googlesource.com/chromium/src/third_party/+/96119100e5da49d2272838031187f113b0d231cd/blink/renderer/core/scroll/scroll_into_view_util.cc)

### 5. 오류 처리

- `oMarkUi`, `getDomRef`, 반환 DOM 및 `scrollIntoView`를 각각 가드한다.
- DOM 접근 또는 스크롤 호출 중 예외는 타이머 콜백의 `try/catch`에서 격리되고 부모 콘솔에 오류를 기록한다. 선택 처리 Promise를 reject시켜 전체 Tree 선택 흐름을 깨지 않는다.
- 단순 미렌더 상태는 정상적인 가드 종료이며 예외를 인위적으로 만들지 않는다.

## 수용 기준

| 검사항목 | 결과 | 근거 |
|---|---|---|
| Tree → Preview 화면 밖 선택 이동 | 통과 | `fn_mark` 종료 전 대상 DOM `scrollIntoView` 예약 |
| 화면 안 선택 시 위치 유지 | 통과 | `block/inline:"nearest"` |
| 원본 동작 및 프로젝트 패턴 정합 | 통과 | `uiAttributeArea.js:8302-8303`의 nearest 방식 |
| 반대 방향 선택 부작용 없음 | 통과 | 보이는 대상은 이동량 0 |
| iframe 통신 계약 보존 | 통과 | 함수명·인자·Promise 반환 불변 |
| 현행 부모 WS20 스크롤 점프 방지 | 통과 | 상위 루트·앱·분할·패널·wrapper가 `overflow:hidden` |
| DOM 부재 안전성 | 통과 | 객체·함수·DOM 가드 |
| 예외 표면화 | 통과 | 부모 콘솔 error 기록 |
| JavaScript 구문 | 통과 | `node --check design/preview/index.js` |

## 보수적 잔여 확인

정적 검수상 필수 결함은 없다. 다음 항목은 실제 렌더링 환경에서 최종 확인을 권고한다.

1. Preview 최상위 문서 스크롤과 Panel/List/Table 같은 중첩 스크롤 컨테이너 각각에서 화면 밖 위·아래 UI 선택.
2. iframe이 WS20 셸의 표시 범위 안에 있는 상태에서 바깥 Tree·Attribute 패널 및 최상위 문서의 스크롤 좌표가 유지되는지 확인.
3. 선택 직후 UI5 재렌더가 발생하는 컨트롤과 `getDomRef()`가 늦게 생기는 예외 컨트롤에서 이동 여부 확인.
4. 빠르게 여러 Tree 행을 선택했을 때 마지막 선택 UI가 최종 표시되는지 확인.
5. 향후 상위 WS20 컨테이너가 `overflow:auto/scroll`로 변경되면 제한된 스크롤 컨테이너 직접 제어 또는 지원 환경에서 `container:"nearest"` 도입을 재검토.

## 독립 서브에이전트 재검수

기존 Codex 통과와 다른 검수자의 P1을 모두 반박하도록 독립 재검수를 수행했으며, 결론은 **Codex 통과 유지**다.

- iframe 경계를 넘는 알고리즘과 `overflow:hidden`의 programmatic scroll 가능성은 인정되지만, 현재 100% wrapper/iframe 기하에서는 부모 조상의 `nearest` 이동량이 0이라는 결론이 재확인됐다.
- 중첩 Preview 스크롤 컨테이너를 모두 최소 이동시키는 것은 깊은 UI를 보이게 하는 요구에 부합한다. 첫 컨테이너의 `scrollTop`만 직접 조정하면 더 바깥의 중첩 컨테이너를 놓칠 수 있다.
- 스크롤 대상이 raw `getDomRef()`인 점은 선택 레이어의 `getPreviewSelectionTargetDom()`보다 방어 범위가 좁지만, 현행 UI5 렌더 Control 계약에서 실제 실패하는 UI를 특정하지 못해 필수 결함으로 판정하지 않았다.
- 타이머는 A→B 선택 순서대로 FIFO 실행되어 최종 B로 수렴한다. `fn_mark(A)` 직후 같은 task에서 `fn_removeMark()`가 실행되면 A의 예약 스크롤이 남는 이론적 stale 위험은 있으나, 현행 사용자·호출 경로에서 해당 순서를 재현하지 못했다.
- `fn_mark`의 Promise가 실제 스크롤 전에 resolve되는 점도 현재 호출자가 스크롤 완료를 소비하지 않으므로 계약 위반은 아니다.

## 검증 범위

- `.audit/br38/01_request.md`
- `.analy/05_디자인영역.md`의 Tree↔Preview 동기화 및 Preview iframe 계약
- `www/ws30/ws10_20/design/preview/index.js:4812-4860`, `:5995-5998`
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:3162-3243`
- `www/ws30/ws10_20/design/js/uiAttributeArea.js:8302-8303`
- `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:950-987`
- `www/ws30/ws10_20/WS10/css/ws10.css:12-16`
- `www/ws30/ws10_20/WS10/css/ws20.css:22-24`, `:195-218`, `:1351-1367`
- 프로젝트 규칙에 따라 이름이 `_`로 시작하는 폴더와 파일은 현행 근거에서 제외했다.
