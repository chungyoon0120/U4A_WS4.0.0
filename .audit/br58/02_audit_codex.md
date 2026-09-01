# BR58 Codex 검수 결과

## 판정

**수정필요**

정상 구버전 서버의 세 도움말 문서 연결, 원본의 Electron 창 옵션·경로·제목, 버튼 DOM 전달, 로드 순서와 KO/EN 파일 구성은 확인되었습니다. 다만 실패 수명주기에서 WS20 전체 busy/단축키 잠금이 영구 잔류할 수 있는 P1 두 건이 있습니다. 따라서 실화면 정상 10건 통과만으로 완료 판정할 수 없습니다.

## 지적

### 1. [P1] `loadURL()`의 비동기 실패와 조기 창 종료가 해제 경로에 연결되지 않습니다

- 위치: `www/ws30/ws10_20/js/ws_html5_call_tooltips_popup.js:86-132`
- `BrowserWindow` 생성부터 `oWin.loadURL(l_path)` 호출까지를 동기 `try/catch`로 감쌌지만 Electron 14의 `BrowserWindow.loadURL()`은 Promise를 반환합니다. 내비게이션 실패는 Promise rejection/`did-fail-load`로 도착하므로 이 `catch`가 처리하지 못합니다.
- 잠금 해제는 `did-finish-load` 안(:107-118)과 동기 `catch` 안(:122-132)에만 있습니다. `did-fail-load`, `render-process-gone`, 로드 완료 전 `closed`에는 정리기가 없습니다. 파일이 `existsSync` 시점에는 존재해도 읽기 실패, 손상/내비게이션 중단, renderer 종료가 발생하면 숨은 창(`show:false`, `opacity:0`)과 WS20 busy가 남습니다.
- `did-finish-load` 내부도 `show`/`setBrowserOpacity`/`setParentCenterBounds` 중 하나가 throw하면 :118에 도달하지 못합니다. 즉 주석의 “창 생성/로드 실패 시 busy를 반드시 해제”와 요청서의 “모든 종료 분기 off”는 성립하지 않습니다.
- 원본에도 동일 취약점은 있지만, BR58은 실패 방어를 명시적 변경점·수용 기준으로 추가했습니다. 현재 구현은 그 방어를 달성하지 못합니다.

제안: 세대별 `once` 정리 함수를 만들고 `loadURL(...).catch`, `did-fail-load`, `render-process-gone`, `closed`, 성공 콜백의 `finally`를 모두 같은 정리기로 연결하십시오. 실패 시 창 파기와 잠금 해제를 멱등적으로 한 번만 수행해야 합니다.

### 2. [P1] 통합 도움말의 Promise 거부는 세 핸들러의 `try/catch`가 잡지 못합니다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_tree.js:409-420`, `ws_html5_ws20_attr.js:5359-5367`, `ws_html5_ws20_prev.js:1117-1128`
- 호출 대상 `fnU4AHelpDocuPopupOpener`는 `www/ws30/ws10_20/js/fnDialogPopupOpener.js:2061-2086`의 `async` 함수입니다. 내부 `parent.require(...)` 또는 `await oHelpDoc.Excute(...)`가 실패하면 rejected Promise가 반환되지만, 세 도움말 핸들러는 이를 `await`/`return`/`.catch`하지 않고 즉시 `return`합니다.
- 따라서 현재의 동기 `try/catch`는 Promise rejection을 처리하지 못하며, opener의 해제(:2077/:2084)에도 도달하지 않습니다. BR58이 핸들러 첫 줄에서 건 `parent.setBusy("X")`와 opener의 `fnSetBusyLock("X")`가 함께 남을 수 있습니다.

제안: 핸들러를 async로 직렬화해 opener를 `await`하고, opener 자체도 `try/finally`에서 lock을 회수하게 하십시오. 공용 opener 계약을 고치기 어렵다면 각 호출부가 rejection을 반드시 받아 오류 표시와 해제를 수행해야 합니다.

### 3. [P2] 패치가 있는데 opener가 없으면 트리·미리보기는 구버전 문서로 잘못 폴백합니다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_tree.js:410-416`, `ws_html5_ws20_prev.js:1120-1124`
- 두 곳은 `checkWLOList(...) === true && typeof opener === "function"`을 하나의 조건으로 묶었습니다. 패치 서버인데 opener 로드만 실패한 경우 조건이 false가 되어 `callTooltipsPopup`으로 진행합니다.
- 원본 계약은 패치 판정이 true이면 통합 도움말을 호출하고 종료하는 것입니다. 속성 영역은 opener 부재가 TypeError가 되어 오류로 표면화되는 반면 트리·미리보기만 다른 도움말을 보여 주므로 세 영역도 불일치합니다.

제안: 패치 판정과 함수 존재 검사를 분리하고, 패치 서버에서 opener가 없으면 `WS20HELP-11/31` 오류로 종료·해제하십시오.

### 4. [P2] 사용자 안내에 미등록 임의 문자열 `WS20HELP-02`를 직접 표시합니다

- 위치: `www/ws30/ws10_20/js/ws_html5_call_tooltips_popup.js:124-127`
- 추적용 콘솔 코드 자체는 유효하지만 `parent.showMessage(..., "WS20HELP-02")`는 사용자에게 임의 내부 코드를 그대로 표시합니다. `.claude/rules/code.md`의 “기존 원본 키 참조, 임의 문구·키 생성 금지” 규칙에 어긋납니다.
- 상세 예외는 이미 콘솔에 기록되므로, 사용자 메시지는 장군님이 지정한 기존 메시지 키를 메시지 함수로 조회해 표시해야 합니다.

### 5. [P1] 신규 preload 파일의 전송 실패가 도움말이 아니라 WS20 전체 로드를 중단시킵니다

- 위치: `www/ws30/ws10_20/js/library-preload.js:161-169,236-277`
- 요청서는 `getScript`를 상시 preload로 대체하고, 미로드 시 각 도움말 핸들러의 `WS20HELP-12/22/32`가 오류를 드러낸다고 설명합니다. 그러나 `loadLibrary`의 ajax `error` 콜백(:274-276)은 다음 index 재귀나 최종 callback을 호출하지 않습니다.
- 따라서 신규 `ws_html5_call_tooltips_popup.js`가 배포에서 누락되거나 404/읽기 실패하면, 그 뒤의 `ws_html5_ws20.js`, tree/data/attr/prev/edit 등 전체 로드가 중단됩니다. 각 도움말 핸들러 자체가 정의되지 않으므로 WS20HELP 미로드 코드도 실행될 수 없습니다.
- 선택적 도움말 폴백 하나가 WS20 전체 기동 실패로 확대되는 구조이며, 현재 신규 파일이 git 기준 untracked인 점까지 감안하면 릴리스 누락 검증이 필수입니다.

제안: 우선 신규 파일을 산출물 추적 대상으로 확정하고, optional 로더로 분리하거나 ajax error에서도 오류를 표면화한 뒤 필수 후속 로드를 계속하도록 계약을 정리하십시오.

### 6. [P2/기존 자산] EN 경로는 존재하지만 실제 영어 도움말 문서가 아닙니다

- 위치: `www/ws30/ws10_20/design/html/helper/EN/{designTooltip,attrTooltip,prevTooltip}/index.html`
- 세 EN 파일의 본문은 한국어입니다. `designTooltip`과 `prevTooltip`은 각각 KO 파일과 SHA-256까지 동일하고, `attrTooltip`도 “우측 상단의 Binding Popup”, “동일속성 프로퍼티” 등 한국어 본문입니다.
- BR58이 새로 만든 번역 결함은 아니고 원본 자산을 그대로 소비한 결과입니다. 다만 검수 포인트 H의 “한국어·영어 도움말 문서 6개 존재”는 파일 경로 존재만 확인한 표현이며, EN 사용자에게 영어 도움말이 제공된다는 의미로는 통과시킬 수 없습니다.

### 7. [P2] 성공 이벤트를 `on`으로 유지해 후속 navigation이 다른 작업의 잠금을 해제할 수 있습니다

- 위치: `www/ws30/ws10_20/js/ws_html5_call_tooltips_popup.js:107-120`
- 초기 로드 완료 처리인데 `once`가 아니라 `on("did-finish-load")`입니다. 도움말 창이 이후 reload/navigation을 수행하면 `_releaseLock()`이 다시 실행됩니다.
- busy/shortcut API는 작업 소유권이나 참조 카운트가 없는 전역 boolean 토글입니다. 첫 완료 뒤 다른 작업이 busy를 건 상태에서 도움말 창이 다시 load되면 그 작업의 잠금을 해제할 수 있습니다.

제안: 초기 성공 완료는 `once`와 멱등 정리기로 묶고, listener도 완료/실패/closed 시 제거하십시오.

## 확인된 정상 항목

- 원본 `design/js/callTooltipsPopup.js`는 팝업 UI를 `sap.m`으로 만들지 않습니다. UI5 직접 참조는 파일 없음 안내의 `showMessage(sap, ...)` 인자뿐이라는 요청서 판단이 맞습니다.
- 신규 파일은 원본 폴더 밖에 있고, 확인한 BR58 변경에서 원본 `design/js/callTooltipsPopup.js` 수정은 없습니다.
- `library-preload.js`에서 신규 파일이 tree/attr/prev보다 먼저 등록됐습니다. 단, preload의 HTTP error는 재귀를 이어가지 않으므로 “미로드 시 WS20HELP-12/22/32로 표면화”된다는 설명은 정확하지 않습니다. 신규 파일 자체가 전송 실패하면 후속 WS20 파일도 로드되지 않습니다.
- `_tbBtn`의 다른 등록 핸들러는 전달된 `this`를 소비하지 않아 `press.call(BTN)`의 직접 회귀는 찾지 못했습니다.
- `KO`, `EN` 아래 `designTooltip`, `attrTooltip`, `prevTooltip`의 `index.html` 경로 6개는 모두 존재합니다. 다만 EN 본문은 실제 영어 번역이 아닙니다. 그 외 언어는 원본과 같이 377 안내 후 종료하는 구조입니다.
- 5개 대상 JS의 `node --check`와 `git diff --check`가 통과했습니다.

## 권장 재검증

1. `loadURL` Promise reject, `did-fail-load`, renderer 종료, 로드 전 창 종료 각각에서 창·busy·shortcut이 한 번만 정리되는지 확인
2. 통합 도움말 `Excute()` reject 시 세 영역 모두 오류 표면화 후 잠금 해제되는지 확인
3. 패치=true/opener=undefined에서 구버전 도움말이 열리지 않고 구성 오류로 종료되는지 확인
4. 정상 구버전/현재 서버 및 overflow 메뉴 버튼 회귀 재확인
5. 신규 파일 누락/404에서도 후속 WS20 필수 모듈이 계속 로드되거나 명확히 기동 실패 처리되는지 확인
6. 도움말 창 reload/navigation 중 다른 작업 busy가 풀리지 않는지 확인

## 2차 독립 재검수 취합

2026-08-31 서브에이전트 3개를 각각 팝업 lifecycle, 통합 도움말 async 계약, 원본 parity/preload/다국어로 분리해 기존 지적을 적극 반박하도록 재검수했습니다. 세 검토 모두 기존 P1 2건과 P2 2건을 재입증했습니다. 여기에 preload 전송 실패의 전체 WS20 로드 중단(P1), 반복 `did-finish-load`의 타 작업 unlock(P2), EN 자산 실내용 불일치(P2/기존 자산)를 추가 확인했습니다. 제품 파일은 수정하지 않았습니다.
