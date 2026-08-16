# BR35 UI 추가 callback UA040 허용 부모 점검 검수

## 판정

**수정필요**

정상 preload에서는 UA040 검사가 동작하지만, 후행 D&D 모듈 로드 실패로 부분 초기화된 실제 경로에서 검사가 fail-open으로 우회된다.

## 지적

### 1. [P1] UA040 헬퍼가 로드되지 않으면 `typeof` 가드가 제한 검사를 건너뛰고 금지 UI를 추가한다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:873-879`, `www/ws30/ws10_20/js/library-preload.js:182-190`, `229-269`, `297-309`, `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:330-339`
- `designAddUIObject()`는 `designChkHiddenAreaUi`가 함수일 때만 UA040을 검사한다. 함수가 없으면 오류나 차단 없이 바로 Undo 적재와 UI 생성을 시작한다.
- preload 순서상 edit 파일이 먼저 로드되어 UI 추가 팝업과 `designAddUIObject()`가 정의되고, 헬퍼는 다음 D&D 파일에서 정의된다. D&D 파일 HTTP 로드가 실패하면 loader의 `error`는 로그만 남기고 재귀·throw·실패 반환을 하지 않는다.
- `fnWindowOnInitLoad()`는 동기 `loadLibrary()`가 반환한 직후 성공 여부와 관계없이 `fnWsStart()`를 호출한다. 따라서 D&D가 빠진 부분 초기화 상태에서도 트리의 `+` 버튼과 edit 모듈의 UI 추가 팝업은 동작할 수 있다.
- 이 상태에서 SessionWorker/PressTrigger를 비허용 부모에 확정하면 `typeof` 조건이 false여서 UA040을 건너뛰고 `_T_0015`, Design Tree, Preview에 반영한다. BR35이 복구하려던 원래 결함이 그대로 재발한다.
- 원본 `uiDesignArea.js:5063`은 헬퍼를 무조건 호출하므로 헬퍼 부재 시 mutation 전에 throw하여 fail-closed한다. 현 가드는 원본보다 데이터 무결성을 약화한다.
- 제안: 헬퍼 부재도 명시적 오류와 함께 즉시 return하여 fail-closed하거나, UA040 헬퍼를 edit보다 먼저 로드되는 필수 모듈로 이동하고 preload 성공 확인 후에만 WS를 시작한다.

## 상세 검수 결과

### 2. 원본 검증 순서와 인자

- HTML5 `designAddUIObject()`는 카디널리티 점검 후 UA039 `designChkUnique()`를 실행하고, 이어 UA040 `designChkHiddenAreaUi(is_0022.UIOBK, is_tree.UIOBK)`를 호출한다.
- 추가 UI의 `UIOBK`와 대상 부모의 `UIOBK`를 전달하는 인자 의미가 원본 `uiDesignArea.js:5063`과 같다.
- UA040 실패 시 `true`를 받아 즉시 return하며, 원본과 동일하게 후속 추가 처리를 실행하지 않는다.

### 3. 헬퍼 판정과 메시지

- 현행 `designChkHiddenAreaUi()`는 `T_9011`에서 `CATCD === "UA040"`, `FLD01 === UIOBK`, `FLD07 !== "X"`인 첫 행을 찾는다.
- 대상 행의 허용 부모 `FLD04`와 실제 부모 `PUIOK`가 다를 때 메시지 131에 `FLD03`, `FLD06`을 전달하고 `true`를 반환한다. 원본 `uiDesignArea.js:1591-1606`과 동일하다.
- 허용 부모이거나 UA040 대상이 아니면 반환값 없이 통과한다. 신규 문구·메시지 키·데이터 소스는 없다.

### 4. 차단의 원자성과 Undo

- UA040 점검은 `fnWs20PushUndo()`보다 앞에 있다. 실패 시 `crtStru0014()`, `crtStru0015()`, `oAPP.attr.prev`, 부모 `zTREE`, Preview API, 트리 재렌더, 변경 플래그, 바인딩 팝업 방송에 도달하지 않는다.
- 따라서 잘못된 부모에 대한 실패 시도는 Undo 스택에도 남지 않고 `_T_0015`·Design Tree·Preview에 부분 노드나 유령 데이터도 만들지 않는다.
- 다건 추가에서도 검증은 반복문 전에 한 번 수행되므로 첫 노드가 만들어진 뒤 차단되는 부분 반영 경로가 없다.

### 5. D&D 경로와 동작 일치

- D&D/붙여넣기 공용 `fnWs20AddTreeData()`도 UA039 다음에 동일 `designChkHiddenAreaUi(child.UIOBK, parent.UIOBK)`를 실행한다.
- UI 삽입 팝업에서 드래그한 신규 UI 경로는 aggregation 선택 뒤 최종적으로 `designAddUIObject()`를 호출하므로 BR35 검증을 동일하게 거친다.
- 기존 UI 이동 경로 역시 대상 부모가 확정된 뒤 같은 헬퍼로 UA040을 검사한다. 세 진입점 모두 허용 부모 판정이 일치한다.

### 6. busy·잠금과 로드 순서

- 팝업 confirm은 먼저 팝업을 닫고 `_broadBusy(true)`를 수행한 뒤 `Promise.resolve(designAddUIObject(...)).catch(...).then(_broadBusy(false))`로 감싼다. UA040 조기 return은 정상 resolve되므로 BUSY_OFF가 실행된다.
- D&D 신규 삽입은 `await designAddUIObject()` 뒤 `_bindBusy("BUSY_OFF")`와 `designDragEnd()`를 수행하므로 조기 return에도 정리된다.
- 두 파일이 모두 정상 로드되면 동기·순차 preload 때문에 UI 조작 시점에 헬퍼가 준비된다.
- 그러나 D&D HTTP 실패 시 loader가 중단된 채 `fnWsStart()`는 계속 실행되므로, `typeof` 가드는 비정상 부분 로드에서 보호가 아니라 UA040 제한을 우회시키는 fail-open이 된다.

### 7. 독립 서브에이전트 반박 재검수

- 독립 재검수도 D&D 모듈 HTTP 실패 경로를 동일한 P1으로 확정하여 기존 통과 판정을 뒤집었다.
- edit 모듈만으로 트리 `+` 버튼과 UI 추가 팝업·확정 함수가 존재하고, D&D 부재 시 붙여넣기는 명시적으로 취소되지만 팝업 추가는 취소되지 않는 비대칭을 확인했다.
- D&D 스크립트가 헬퍼 정의 전에 평가 예외를 내는 경우에도 loader가 예외를 로그로 격리하고 다음 로드를 진행하므로 동일 우회가 가능하다.
- 정상 헬퍼 존재 시의 인자·순서·Undo 원자성·busy 대칭에는 추가 결함을 찾지 못했다.

### 8. 범위 검토

- UW03 특정 부모·aggregation 규칙은 UI 추가 팝업의 `_getUIs()`에서 `_checkUW03()`로 후보를 필터링한다. BR35의 UA040 대상과 별도 규칙이며 이번 한 줄 변경이 기존 필터를 건드리지 않는다.
- KEEP-UI5 원본 `uiDesignArea.js`와 메시지 DB, 공통 자산은 수정되지 않았다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 원본 UA040 인자·순서 | 통과 | child `UIOBK`, parent `UIOBK`; UA039 다음 |
| 허용 부모 성공 | 통과 | `FLD04 === PUIOK`이면 통과 |
| 비허용 부모 차단 | 통과 | 메시지 131 후 `true`·즉시 return |
| Undo 이전 차단 | 통과 | `fnWs20PushUndo()` 앞 |
| 트리·데이터·Preview 부분 반영 방지 | 통과 | 모든 mutation 전 return |
| 다건 추가 원자성 | 통과 | 반복문 이전 1회 검증 |
| D&D·붙여넣기 경로 일치 | 통과 | 동일 헬퍼·동일 child/parent 인자 |
| 팝업 confirm BUSY_OFF | 통과 | Promise `.then` 정리 |
| D&D BUSY_OFF·drag 정리 | 통과 | await 후 공통 정리 |
| 헬퍼 부재 시 fail-closed | 실패 | `typeof` false면 UA040 검사 생략 |
| D&D 로드 실패 후 WS 시작 차단 | 실패 | loader 오류 뒤 `fnWsStart()` 계속 호출 |
| 메시지 키·데이터원 보존 | 통과 | 기존 131·UA040 사용 |
| 원본·공통 파일 무수정 | 통과 | 대상 edit 파일만 변경 |
| JavaScript 구문 검사 | 통과 | `node --check` |

## 잔여 참고

- `designChkHiddenAreaUi()`는 `T_9011.find()`의 첫 UA040 행을 사용하며 원본도 동일하다. 동일 `FLD01`에 서로 다른 활성 허용 부모 행이 여러 개 존재한다면 단일 부모만 허용되지만, 이는 기존 메타데이터 불변식과 원본 계약이므로 BR35 회귀로 판정하지 않았다.
- 실제 메시지 131 치환문과 SessionWorker/PressTrigger의 허용·비허용 부모 조합은 실환경 메타데이터로 최종 조작 검증하는 것이 적절하다.

## 검증 범위

- `.audit/br35/01_request.md` 전체 검수 포인트
- 원본 `www/ws30/ws10_20/design/js/uiDesignArea.js:1591-1606`, `5009-5090`
- HTML5 `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:799-877`, `879-948`, `1544-1558`
- HTML5 `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:330-339`, `810-900`, `974-998`
- preload `www/ws30/ws10_20/js/library-preload.js:158-196`, `231-270`
- 프로젝트 규칙에 따라 언더바로 시작하는 폴더·백업 파일은 현행 근거에서 제외했다.
