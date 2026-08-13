# 02_audit_codex — BR32 styleClass 더블클릭 CSS Editor 검수

## 판정

**수정필요**

## 지적

### 1. [P1] CSS Editor 스크립트 로드 실패 시 WS20 화면 잠금이 영구히 남는다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:5861-5888`, `www/ws30/ws10_20/js/fnDialogPopupOpener.js:3003-3030`, `www/ws30/ws10_20/js/library-preload.js:273-291`
- 더블클릭 위임은 먼저 `fnSetBusyLock("X")`를 호출하고, `attrDblClickStyleClass()`가 true를 반환하면 “편집기 팝업이 잠금을 관리한다”고 보고 즉시 return하여 자체 해제를 생략한다.
- `fnEditorPopupOpen`이 아직 로드되지 않은 최초 호출은 `fnEditorPopupOpener()`가 `oAPP.loadJs("fnEditorPopupOpen", callback)`에 위임한다. 그런데 `loadJs()`의 동기 AJAX에는 `success`만 있고 `error` 콜백이나 실패 throw가 없다.
- 파일 읽기·스크립트 평가가 실패하면 callback이 실행되지 않지만 `fnEditorPopupOpener()`는 실패를 반환하지 않고 정상 종료한다. 이어 `attrDblClickStyleClass()`는 true를 반환하고 위임 핸들러는 잠금을 풀지 않는다. 실제 편집기 창과 그 내부 `_finishOpen()`도 생성되지 않으므로 이후 해제 주체가 전혀 없다.
- 영향: 일시적 파일 접근 오류, 스크립트 평가 오류, 배포 누락이 발생한 최초 styleClass 더블클릭에서 WS20 전체가 busy 상태로 고착된다. 요청서 검수 포인트의 “그 외 경로·예외에서 잠금 해제 짝”을 충족하지 못한다.
- 제안: opener가 성공적으로 편집기 수명주기를 인수했는지 명시적으로 반환하거나 Promise로 표현하고, load/evaluation 실패 시 호출부가 `fnSetBusyLock("")`를 수행하도록 한다. 최소한 `loadJs`에 오류 콜백을 추가해 이 진입점에서 잠금과 자식창 busy를 함께 회수한다.

### 2. [P1] 신규 Editor 메인 문서 로드 실패는 editor frame 워치독 전에 발생해 동일하게 고착된다

- 위치: `www/ws30/ws10_20/js/fnEditorPopupOpen.js:28-154`, `www/ws30/ws10_20/Popups/editorPopup/editorFrame.js:116-127`, `www/ws30/ws10_20/Popups/editorPopup/editorFrame.js:431-447`
- 신규 `BrowserWindow`를 만든 뒤 호출하는 `loadURL()`에는 Promise `catch`나 `did-fail-load` 처리가 없다.
- 15초 워치독은 Editor 메인 문서가 로드되고 `if-editor-info`를 수신한 뒤 editor frame에서 설치된다. 따라서 메인 문서 자체의 로드 실패는 워치독의 보호 범위 밖이다.
- 이 경우 이미 설정한 WS20 lock과 자식창 `BUSY_ON` 방송이 회수되지 않는다. 창이 숨김 상태(`show:false`)로 남을 수 있으며, `closed` 처리도 IPC 제거·참조 해제·부모 focus만 수행하고 lock/BUSY_OFF를 정리하지 않는다.
- 제안: `loadURL().catch`, `did-fail-load`, 초기화 전 `closed`가 하나의 멱등 cleanup을 호출하게 하고, cleanup에서 부모 lock과 자식창 busy를 함께 해제한다.

## 확인 결과

### 원본 가드와 편집기 정보

- `attrDblClickStyleClass()`의 프로퍼티·`STYLECLASS`·비바인딩·값 존재 네 가드는 원본 `uiAttributeArea.js:3007-3019`와 같다.
- `{OBJID: OBJID + UIASN, OBJTY:"CS", OBJNM:"CSS"}` 구성과 `fnEditorPopupOpener(info, UIATV)` 호출, 성공 시 true 반환도 원본과 일치한다.
- 빈 문자열뿐 아니라 null/undefined도 제외하는 `!UIATV` 보완은 정상 styleClass 문자열을 축소하지 않는 안전한 방어다.

### 정상·이미 열린 편집기 잠금

- 편집기 함수가 이미 로드된 정상 신규 창은 opener가 다시 busy를 설정하고, editor frame이 완전히 준비되거나 워치독이 발화하면 `SETBUSYLOCK` IPC로 WS20 잠금을 해제한다.
- 이미 CSS Editor가 열려 있으면 검색값을 기존 창에 보내고 중앙 정렬한 뒤 `fnEditorPopupOpen()`이 부모 busy와 자식창 busy를 즉시 해제한다.
- `fnEditorPopupOpen()` 자체가 동기 throw하면 더블클릭 위임의 catch 뒤 말미 해제가 실행된다. 열린 창 생성 이후의 host 지연도 editor frame 워치독이 처리한다.
- 다만 위 P1처럼 스크립트 로드 callback 자체가 시작되지 않는 구간은 어느 해제 경로에도 포함되지 않는다.
- editor frame 워치독은 메인 문서 로드 이후에만 시작되므로, 신규 창의 `loadURL` 실패 역시 해당 해제 경로에 포함되지 않는다.

### 이벤트 범위와 제외 처리

- 이벤트는 재사용되는 `ROWS`에 한 번만 위임되어 매 렌더 중복 배선이 없다.
- `.u4aWs20AttrRowVal` 안에서만 행 데이터를 찾으므로 라벨 링크와 별도 아이콘 셀의 더블클릭은 진입하지 않는다.
- styleClass 값칸의 F4 버튼과 clear 버튼은 `.u4a-field__vh, .u4a-field__clear` 검사로 CSS Editor 갈래에서 제외된다. styleClass의 실제 값 컨트롤 구조에서 필요한 버튼 제외 범위를 충족한다.
- 바인딩된 styleClass와 값이 없는 styleClass는 false를 반환하고 말미 잠금 해제를 타므로 편집기가 열리지 않고 잠금도 남지 않는다.

### BR33 서버 이벤트 경로

- styleClass 갈래가 먼저 실행되지만 서버 이벤트는 `UIATY === "2"`라 즉시 통과한다. 기존 `attrDblClickServerEvent()` 호출과 마지막 잠금 해제가 유지된다.
- 일반 프로퍼티·빈 이벤트도 동일하게 말미에서 즉시 해제되므로 지속 잠금은 없다. busy 표시가 같은 이벤트 턴 안에서 켜졌다 꺼져 실질적인 화면 깜빡임을 만들 가능성은 낮다.

### 독립 서브에이전트 재검수 취합

- 독립 재검수도 최초 `loadJs`의 HTTP 실패 및 script converter/parsererror에서 success callback이 호출되지 않는 경로를 동일한 P1으로 확인했다.
- 추가로 신규 Editor 메인 문서의 `loadURL` 실패와 초기화 전 `closed`가 editor frame 워치독보다 앞서며, 공통 cleanup이 없다는 두 번째 잠금 고착 경로를 확인했다.
- 정상 신규 창, 이미 열린 창, styleClass 4개 가드, F4/clear 제외, 바인딩·빈값 제외, BR33 후속 라우팅, 리스너 1회 배선에서는 별도 회귀를 찾지 못했다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 원본 styleClass 가드 4개 | 통과 | 프로퍼티·의미명·바인딩·값 검사 |
| CSS Editor 정보·검색값 전달 | 통과 | `CS/CSS`, `OBJID+UIASN`, `UIATV` |
| 정상 신규 창 잠금 해제 | 통과 | editor frame `_finishOpen` |
| 이미 열린 창 잠금 해제 | 통과 | opener 즉시 해제 |
| 스크립트 로드 실패 잠금 회수 | 실패 | `loadJs` error 경로·인수 확인 없음 |
| Editor 메인 문서 로드 실패 회수 | 실패 | `loadURL` 실패 처리와 `did-fail-load` 없음 |
| 초기화 전 창 종료 회수 | 실패 | `closed`에서 lock/BUSY_OFF cleanup 없음 |
| F4·clear 더블클릭 제외 | 통과 | 값칸 버튼 selector |
| 라벨·아이콘 셀 제외 | 통과 | 값칸 스코프 위임 |
| 바인딩·빈값 styleClass 제외 | 통과 | false 반환 후 잠금 해제 |
| BR33 서버 이벤트 이동 보존 | 통과 | styleClass 가드 통과 후 기존 호출 |
| 이벤트 리스너 중복 방지 | 통과 | `__bwpDblWired` |
| JavaScript 구문 검사 | 통과 | `node --check` |

## 잔여 참고

- 원본 전체 디스패처에는 styleClass와 serverEvent 사이에 bindField 더블클릭 갈래가 있으나 요청서에 명시된 대로 HTML5에서 별도 미변환 상태다. BR32 회귀로 판정하지 않았다.

## 검증 범위

- `.audit/br32/01_request.md` 전 검수 포인트
- 원본 `design/js/uiAttributeArea.js`의 테이블 더블클릭 디스패처와 styleClass 처리
- HTML5 속성 행 DOM·위임 이벤트·CSS Editor opener·온디맨드 로더·BrowserWindow/editor frame 잠금 수명주기 정적 추적
- underscore로 시작하는 백업 파일은 프로젝트 규칙에 따라 현행 근거로 사용하지 않았다.
- 실제 Electron에서 CSS Editor 정상·중복·강제 로드 실패를 재현하는 UI 조작 테스트는 수행하지 않았다.
