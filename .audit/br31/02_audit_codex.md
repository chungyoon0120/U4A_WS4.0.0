# 02_audit_codex — BR31 dropAble·DnDDrop 연동 검수

## 판정

**통과**

## 지적

없음.

## 확인 결과

### 원본 동작 이식

- `attrSetDropAbleException()`은 원본 `design/js/uiAttributeArea.js:3388-3492`의 핵심 판정을 동일하게 유지한다. 기본은 DnDDrop 입력 불가이며, dropAble 값이 문자열 `"true"`이거나 값이 존재하는 바인딩 상태(`ISBND === "X"`)일 때만 입력 가능하다.
- dropAble 라인의 `comboval` 동기화, `UIASN === "DNDDROP"` 의미명 검색, `edit` 갱신, 비활성 전환 시 `UIATV`·`ADDSC` 초기화, 클라이언트 JS 삭제, `_T_0015` 재수집, 라인 스타일 갱신 순서가 원본과 대응한다.
- 특정 OBJID·UIATK·컨트롤 클래스에 고정하지 않고 현재 UI의 `T_ATTR`에서 `DROPABLE`·`DNDDROP` 의미명으로 찾는다. 둘 중 하나가 없는 UI는 조기 반환하므로 대상 밖 UI에 부작용이 없다.

### HTML5 호출 순서의 정합성

- `fnWs20AttrChange()`는 Undo 스냅샷을 먼저 적재한 뒤 dropAble 자체를 `attrChgAttrVal()`로 수집하고 스타일을 계산한 다음 BR31 부수효과를 호출한다. 따라서 원본 내부의 dropAble 재수집을 생략한 것은 이중 수집을 피하는 정당한 차이다.
- BR31 훅 뒤의 공통 경로가 `fnRenderWs20AttrRows()`와 `updateBindPopupDesignData()`를 수행하므로 `bModelRefresh=false`는 화면·별창 반영을 누락하지 않는다.
- 훅은 상위 `try/finally` 안에 있고 자체 `try/catch`도 있어, 예외가 나더라도 단축키·부모 busy·자식창 busy 해제가 유지된다.

### 이벤트 초기화와 표시

- dropAble을 false로 바꾸면 DnDDrop의 `UIATV`와 `ADDSC`를 먼저 비우고 `attrDelClientEvent(ls_drop, "JS")`가 `T_CEVT`의 정확한 `OBJID + UIASN`/`OBJTY` 행을 삭제한다.
- 이어지는 `attrChgAttrVal(ls_drop, "DDLB")`는 서버 이벤트가 비고 클라이언트 JS도 없는 이벤트 행을 `prev[OBJID]._T_0015`에서 제거하며 `SHCUT`도 초기화한다.
- 후속 전체 행 재렌더는 빈 표시값과 갱신된 스타일을 사용한다. DnDDrop의 `edit=false`는 콤보의 `bDisabled` 계산에 반영되고, 서버 이벤트 목록 `onOpen`도 배선되지 않아 입력과 목록 열기가 모두 차단된다.
- 공통 커스텀 셀렉트도 열기 요청 단계에서 `aria-disabled`를 검사하므로 비활성 DnDDrop은 마우스 클릭뿐 아니라 키보드 조작으로도 목록을 열 수 없다. 네이티브 폴백 역시 `disabled`가 적용된다.

### UI 재선택·저장 후 재진입

- `_updateAttrList()`는 저장 데이터를 현재 `T_ATTR`에 옮긴 뒤 마지막에 무인자 `attrSetDropAbleException()`을 호출한다. 따라서 dropAble=false로 저장된 UI를 다시 선택해도 DnDDrop이 잠긴다.
- 렌더 경로는 `bClear`를 전달하지 않으므로 UI 선택만으로 저장 데이터를 임의 삭제하지 않는다. 이는 원본의 “렌더 시 잠금만, 실제 dropAble 변경 시 초기화” 계약과 같다.

### Undo/Redo

- `fnWs20PushUndo()`의 스냅샷은 모든 `prev[*]._T_0015`뿐 아니라 `APPDATA.T_CEVT` 전체를 변경 전에 깊은 복사한다.
- 복원은 `_T_0015`와 `T_CEVT`를 모두 되돌린 뒤 미리보기를 재구성하고 UI를 재선택한다. 재선택 과정의 무인자 예외처리가 복원된 dropAble 값에 맞춰 DnDDrop 잠금도 다시 계산한다.
- 따라서 dropAble=false 변경으로 삭제된 서버 이벤트 행과 클라이언트 이벤트 소스는 한 번의 Undo로 함께 복원되며, 별도 Undo 이력을 추가하지 않은 판단이 타당하다.

### 독립 서브에이전트 재검수 취합

- 기존 통과 판정을 적극 반박하도록 독립 검수를 수행했으나 재현 가능한 추가 결함은 발견되지 않았고 통과 판정에 동의했다.
- 값 검증·기본값 보정 이후 BR31 훅이 실행되므로 원시 입력값이 아니라 최종 확정된 dropAble 값으로 잠금과 초기화를 계산한다는 점을 재확인했다.
- Undo 스냅샷이 BR31 부수효과 전에 `prev._T_0015`와 `T_CEVT`를 함께 보존하고, 복원 후 drawPreview와 UI 재선택을 수행하는 전체 순서도 교차 확인했다.
- 동일 `UIASN` 중복은 원본도 `find()`로 첫 행을 사용하고 메타데이터상 중복 근거가 없다. 내부 함수 예외를 삼켜 부분 초기화될 이론적 가능성도 핵심 배열·함수가 이미 훼손된 비정상 상태에 한정되어 BR31 회귀로 판정하지 않았다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 원본 값 판정·초기화 순서 | 통과 | `attrSetDropAbleException` 대응 |
| dropAble=false 서버 이벤트 제거 | 통과 | `UIATV=""` 후 `_T_0015` splice |
| 클라이언트 이벤트 제거 | 통과 | `T_CEVT` JS 행 삭제 |
| DnDDrop 표시값 초기화 | 통과 | 전체 속성 행 재렌더 |
| DnDDrop 입력·목록 열기 차단 | 통과 | 마우스·키보드·네이티브 폴백 차단 |
| UI 재선택 시 잠금 재계산 | 통과 | `_updateAttrList` 무인자 호출 |
| 모든 해당 UI에 공통 적용 | 통과 | `UIASN` 의미명 기준 |
| 한쪽 속성만 존재하는 UI 안전성 | 통과 | 단계별 조기 반환 |
| Undo 서버·클라이언트 이벤트 복원 | 통과 | `_T_0015` + `T_CEVT` 스냅샷 |
| Busy·단축키·자식창 잠금 대칭 | 통과 | 상위 `finally` 유지 |
| JavaScript 구문 검사 | 통과 | `node --check` |

## 잔여 참고

- 초기화 내부의 `attrDelClientEvent`·`attrChgAttrVal`·`attrSetLineStyle`는 각각 예외를 삼킨다. 현재 함수 존재와 데이터 전제는 확인되어 정상 경로에는 문제가 없지만, 장래 내부 계약이 바뀌면 부분 초기화를 조용히 허용할 수 있으므로 진단 로그를 남기는 편이 유지보수에는 유리하다. 판정을 낮출 현재 결함은 아니다.
- 요청서에 BR31 밖으로 기록된 autoGrowing 미이식 내용은 현재 작업 트리에서 BR29 구현이 함께 들어와 있어 더 이상 동일 상태가 아니다. BR31 판정에는 포함하지 않았다.

## 검증 범위

- `.audit/br31/01_request.md` 전 검수 포인트
- 원본 `design/js/uiAttributeArea.js`의 변경 게이트·`attrSetDropAbleException`·렌더 호출
- HTML5 `fnWs20AttrChange`, `attrChgAttrVal`, `attrDelClientEvent`, 속성 행 렌더, Undo/Redo 스냅샷·복원 경로 정적 추적
- underscore로 시작하는 백업 파일은 프로젝트 규칙에 따라 현행 근거로 사용하지 않았다.
- 실제 UI에서 서버·클라이언트 이벤트를 등록한 뒤 false 전환·Undo하는 조작 테스트는 수행하지 않았다.
