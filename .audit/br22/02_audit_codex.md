# 02_audit_codex — BR22 미리보기 UI 사용위치 검수

## 판정

**통과**

## 지적

없음.

## 검수 결과

### 1. 트리와 미리보기가 동일한 공용 함수를 호출한다

- 공용 안내 함수는 `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1751-1759`의 `oAPP.fn.fnWs20WhereUseNotice` 한 곳에 정의되어 있다.
- 트리 M08은 같은 파일 `1820`행에서 이 함수를 호출한다.
- 미리보기 M08은 `www/ws30/ws10_20/design/js/callDesignContextMenu.js:1517-1520`에서 동일한 함수를 호출한다.
- 미리보기 iframe도 메뉴를 `parent.oAPP.fn.callDesignContextMenu.call(this)`로 생성하므로(`design/preview/index.js:8539`), 두 진입점은 부모 `oAPP`의 같은 함수 객체를 공유한다.

### 2. UI5 Dialog 예외와 서버 요청 경로가 제거됐다

- 미리보기 M08 분기는 `contextMenuUiWhereUse()`만 호출한다(`callDesignContextMenu.js:203-205`).
- 변경된 함수에는 `getScript("design/js/callUiWhereUsePopup")`, `callUiWhereUsePopup()`, 확인창 또는 서버 호출이 없다.
- 따라서 KEEP-UI5 `callUiWhereUsePopup.js`의 `new sap.m.Dialog(...)` 및 `/uiWhereUseList` 요청으로 진입할 실행 경로가 없다.
- `callUiWhereUsePopup.js` 자체는 변경되지 않아 KEEP-UI5 경계도 유지됐다.

### 3. BUSY와 단축키 잠금은 안내 호출 전에 동기 해제된다

- 미리보기 메뉴 선택기는 먼저 `parent.setBusy("X")`와 `setShortcutLock(true)`를 설정한다(`callDesignContextMenu.js:15-20`).
- M08 처리 함수는 즉시 `setShortcutLock(false)`와 `parent.setBusy("")`를 실행한 뒤 안내 함수를 호출한다(`1509-1520`).
- 안내 함수는 서버·비동기 작업 없이 `parent.showMessage(null, 10, "W", ...)`만 호출하며 내부에서 예외를 흡수한다. 안내 표시가 실패해도 이미 잠금이 회수된 상태다.
- 확인/취소 분기가 제거되어 종료 경로별 잠금 누락 가능성이 없고, 반복 호출 시 등록되는 이벤트나 누적 상태도 없다.

### 4. 공용 함수 로드 순서와 `null` 인자는 유효하다

- `www/ws30/ws10_20/js/library-preload.js:162-182`에서 WS20 HTML5 파일을 순차 등록하고 `ws_html5_ws20_edit.js`까지 초기 프리로드한다.
- `oAPP.loadLibrary()`는 `async:false`로 파일을 순서대로 평가하므로 정상 WS20 기동에서 M08 사용 시 공용 함수가 존재한다.
- `parent.showMessage`의 HTML5 구현은 첫 번째 UI5 인자를 무시하고 공통 토스트를 렌더한다(`www/ws30/resources/index.js:159-193`). 다른 HTML5 호출도 `null`을 사용하므로 양쪽 컨텍스트에서 안전하다.

## 수용 기준 점검

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 트리·미리보기 동일 함수 사용 | 통과 | 부모 `oAPP.fn.fnWs20WhereUseNotice` 공유 |
| 안내 문구·동작 단일 관리 | 통과 | 실행 가능한 안내 정의 1곳 |
| `sap.m.Dialog` 예외 제거 | 통과 | 옛 팝업 호출 경로 제거 |
| `/uiWhereUseList` 요청 차단 | 통과 | 서버 호출 모듈 미호출 |
| BUSY·단축키 잠금 회수 | 통과 | 공용 안내 전에 동기 해제 |
| 미로드 의존성 | 통과 | 초기 동기 프리로드 순서로 존재 보장 |
| `showMessage(null, ...)` 안전성 | 통과 | HTML5 메시지 구현이 UI5 인자를 무시 |
| KEEP-UI5 파일 무수정 | 통과 | 연결 지점만 변경 |
| 반복 호출 안정성 | 통과 | 동기 단발, 이벤트·상태 누적 없음 |
| JavaScript 구문 검사 | 통과 | 두 변경 파일 `node --check` 통과 |

## 잔여 참고

- 안내 본문은 KO/EN 하드코딩으로 `.analy/05_디자인영역.md` 13.3의 메시지 키 원칙과는 다르다. 다만 BR22에서 새로 추가한 문구가 아니라 기존 트리 정책 문구를 한 곳으로 공용화한 것이고, 대응 메시지 키가 없다는 사실이 요청서에 명시되어 있어 이번 BR22의 회귀·차단 결함으로 판정하지 않았다. 메시지 키가 마련되면 별도 정비가 바람직하다.
- 검증은 활성 소스·프리로드 계약·호출 흐름에 대한 정적 분석이며 실제 UI 클릭 테스트는 수행하지 않았다.

