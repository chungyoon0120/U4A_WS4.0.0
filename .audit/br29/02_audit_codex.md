# 02_audit_codex — BR29 autoGrowing 확인·이벤트 잠금 검수

## 판정

**통과**

## 지적

없음.

## 확인 결과

### 원본 분기와 이벤트 매핑

- `attrChangeAutoGrowingProp()`은 원본의 세 autoGrowing 키(`EXT00001347/1348/1349`)만 처리하고 바인딩 상태는 제외한다.
- `UIATV !== "true"`에서는 이벤트 잠금만 해제한 뒤 정규 변경 경로를 계속 타고, `UIATV === "true"`에서만 메시지 283 확인창을 열고 호출부 후속 처리를 중단한다.
- 대상 이벤트 키는 원본과 동일하다: `sap.ui.table.Table` 1종(`AT000013085`), `sap.m.Table` 4종(`AT000005916~5919`), `sap.m.List` 4종(`AT000003866~3869`).
- `attrSetAutoGrowingException()`은 true일 때 대상 이벤트의 `edit`, `icon1_visb`, `icon2_visb`를 모두 false로 만들고, 초기화 요청이면 서버 값·클라이언트 소스타입·클라이언트 JS·수집 행을 원본 순서대로 제거한다.

### 확인·취소·재진입

- true 선택 시 최초 `fnWs20AttrChange()`는 Undo 적재와 일반 수집 전에 확인 게이트에서 반환한다. `finally`가 부모 busy, 단축키, 자식창 busy를 모두 해제한다.
- 확인 콜백은 `fnWs20AttrChange(is_attr, "DDLB", true, true)`로 재진입한다. 네 번째 인자가 autoGrowing 게이트를 확실히 건너뛰고 세 번째 인자가 두 번째 Undo 적재를 막으므로 확인창 무한 재호출과 중복 이력이 없다.
- 취소는 원본처럼 `UIATV/comboval`을 문자열 `"false"`로 복귀시키고 이벤트 입력을 다시 허용한 뒤 동일 정규 변경 경로로 화면과 수집 데이터를 확정한다.
- 확인은 이벤트 초기화·잠금을 먼저 수행한 뒤 autoGrowing 값을 수집한다. 같은 동기 작업 안에서 끝난 후 전체 속성 행을 다시 그리므로 사용자가 중간 상태를 조작할 틈이 없다.

### Undo/Redo 정합

- 확인 콜백의 `fnWs20PushUndo()`는 이벤트 삭제와 `_T_0015` 변경 전에 실행된다. 콤보 행 객체의 `UIATV`는 이미 true지만, 실제 스냅샷 원천인 `prev[*]._T_0015`와 `APPDATA.T_CEVT`는 아직 변경 전 상태다.
- 스냅샷은 `_T_0015`와 `T_CEVT`를 모두 깊은 복사한다. 복원은 두 저장소를 되돌리고 미리보기 재구성·UI 재선택을 수행하므로 autoGrowing 값, 서버 이벤트, 클라이언트 이벤트, 입력 잠금이 한 번의 Undo/Redo로 함께 이동한다.
- 취소 경로도 스냅샷 1회·재진입 시 skip 구조라 중복 이력은 없다. 이전 영속값이 빈값이었다면 원본의 강제 false 확정을 하나의 변경으로 되돌릴 수 있다.

### 화면 잠금과 아이콘

- `edit=false`는 DDLB의 `bDisabled` 계산으로 전달되어 커스텀 셀렉트의 클릭·키보드 열기와 네이티브 폴백을 차단한다.
- `icon1_visb/icon2_visb=false`이면 `_buildIconCell()`이 버튼 자체를 생성하지 않아 서버 이벤트 생성 및 클라이언트 이벤트 편집 진입점이 사라진다.
- `_updateAttrList()` 끝의 무인자 호출은 현재 `uiinfo.UIOBK`로 autoGrowing 행을 찾아 저장 후 재선택·재오픈에서도 잠금과 아이콘 숨김을 재계산한다. 이 경로는 `bClear`가 없어 데이터를 재삭제하지 않는다.

### Busy·후속 반영

- 최초 게이트의 early return은 `fnWs20AttrChange()`의 `finally`를 통과한다.
- 확인·취소 콜백의 재진입도 자체 `try/finally`로 busy·단축키·자식창 잠금을 회수한다. 콜백 외곽 예외 처리도 동일 세 잠금을 방어적으로 해제한다.
- `designRefershModel()`의 현 HTML5 구현은 동기 트리 렌더 후 즉시 resolve하는 Promise이므로, 콜백에서 await하지 않은 차이가 현재 작업 트리에서 순서·잠금 회귀를 만들지는 않는다.
- `updateBindPopupDesignData()`는 재진입한 공통 변경 경로에서 이미 호출되므로 원본 후속 방송도 보존된다.

### 독립 서브에이전트 재검수 취합

- 기존 통과 판정을 적극 반박하는 조건으로 독립 재검수를 수행했으나 재현 가능한 결함은 발견되지 않았고 통과 판정에 동의했다.
- 콜백 시점에 화면의 `T_ATTR` 행은 이미 true지만 스냅샷 원천인 `prev._T_0015`와 `T_CEVT`는 변경 전이라는 점을 별도로 재확인했다.
- 취소 시 Undo 적재가 무의미한 이력인지 검토했으나, 원본도 취소를 명시적 `"false"` 변경으로 수집하며 이전값이 빈값·상속값이면 실제 변경이다. 따라서 일률적인 no-op 이력으로 판정할 수 없다.
- `ACTCD`가 확인 팝업 전에 제거되는 흐름도 추적했으나, Undo 생략 액션코드의 실제 소비처와 autoGrowing 직접 변경이 연결되는 재현 경로는 발견되지 않았다.
- `designRefershModel()`의 Promise를 await하지 않아 비동기 rejection을 동기 `try/catch`가 포착하지 못하는 점은 유지보수 위험으로 동의했지만, BR29의 속성 렌더·미리보기·바인딩 팝업 반영은 앞선 공통 변경 경로에서 이미 수행되어 현행 기능 결함으로는 판정하지 않았다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 원본 대상 키·분기 일치 | 통과 | 3종 autoGrowing 및 9개 이벤트 키 |
| 메시지 283 사용 | 통과 | 기존 메시지 클래스 직접 조회 |
| true 선택 확인창 호출 | 통과 | 이벤트 유무와 무관하게 호출 |
| 확인 시 서버·클라 이벤트 초기화 | 통과 | `UIATV/ADDSC/T_CEVT/_T_0015` 정리 |
| 대상 이벤트 입력·아이콘 잠금 | 통과 | `edit/icon1_visb/icon2_visb=false` |
| 취소 시 false 복귀·잠금 해제 | 통과 | 원본 분기 대응 |
| 재진입 확인창 무한루프 방지 | 통과 | `bSkipAutoGrow=true` |
| Undo 중복 적재 방지 | 통과 | 콜백 1회 push + 재진입 skip |
| Undo 서버·클라 이벤트 복원 | 통과 | `_T_0015` + `T_CEVT` 스냅샷 |
| UI 재선택 시 잠금 유지 | 통과 | 무인자 예외처리 호출 |
| Busy·단축키·자식창 잠금 대칭 | 통과 | 모든 경로 `finally`/방어 해제 |
| 원본 KEEP-UI5 무수정 | 통과 | 대상 diff 없음 |
| JavaScript 구문 검사 | 통과 | `node --check` |

## 잔여 참고

- 확인 콜백에서 `designRefershModel()` 반환 Promise를 await하지 않는다. 현재 HTML5 구현은 즉시 resolve하므로 결함은 아니지만, 향후 실제 비동기 작업이나 rejection이 생기면 현재 동기 `try/catch`로 잡히지 않고 원본의 await 계약과 어긋날 수 있다. 가능하면 Promise 완료·실패를 명시적으로 연결하는 편이 유지보수에 안전하다.
- 이벤트 초기화 내부의 개별 `try/catch`는 비정상 런타임에서 부분 초기화를 허용할 수 있다. 정상 데이터·함수 계약에서는 재현되지 않고 원본도 트랜잭션 롤백은 제공하지 않아 판정을 낮추지 않았다.

## 검증 범위

- `.audit/br29/01_request.md`의 원본 parity, 확인/취소, 재진입, Undo, 화면 잠금, 메시지 전 항목
- 원본 `design/js/uiAttributeArea.js`의 `attrChange`, `attrChangeAutoGrowingProp`, `attrSetAutoGrowingException`
- HTML5 속성 변경·이벤트 수집·클라이언트 이벤트·렌더러·Undo/Redo·디자인 재렌더 경로 정적 추적
- underscore로 시작하는 백업 파일은 프로젝트 규칙에 따라 현행 근거로 사용하지 않았다.
- 실제 SAP 화면에서 세 UI 유형별 확인/취소·Undo 조작 테스트는 수행하지 않았다.
