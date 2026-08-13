# BR33 서버 이벤트 값칸 더블클릭 이동 검수

## 판정

**통과**

재현 가능하거나 코드 계약으로 입증되는 필수 수정사항은 발견하지 못했다.

## 지적

없음.

## 상세 검수 결과

### 1. 원본 분기와 호출 계약

- HTML5 `attrDblClickServerEvent()`의 이벤트 여부(`UIATY === "2"`), 값 존재, trial 여부 가드는 원본 `design/js/uiAttributeArea.js:3089-3105`의 세 조건과 동일하다.
- 유효한 서버 이벤트는 `oAPP.common.execControllerClass(is_attr.UIATV)`로 전달된다. 공용 함수는 메소드명을 `METHNM`에 구성하고 SAP GUI 실행 준비 IPC 및 멀티 로그인 점검을 수행한다.
- `!is_attr` 및 null/undefined 값 방어와 `fnOnCheckIsTrial` 존재 확인은 정상 입력 범위를 줄이지 않는다. 원본에 없는 안내·포커스 변경도 추가되지 않았다.

### 2. DOM 위임과 제외 영역

- 리스너는 재사용 컨테이너 `#ws20AttrRows`에 배선되고, `ROWS.__bwpDblWired`로 한 번만 등록된다. 내부 행을 비우고 다시 그려도 중복 리스너가 생기지 않는다.
- 대상은 `ev.target.closest(".u4aWs20AttrRowVal")`로 값 셀 내부에 한정된다. 라벨 셀과 두 아이콘 셀은 형제 요소이므로 이벤트명 링크, 서버 이벤트 생성 아이콘, 클라이언트 이벤트 등록 아이콘의 더블클릭은 이동 경로에 진입하지 않는다.
- 현재 행의 `ROW.__attrData`는 렌더마다 해당 `sAttr`로 다시 지정되므로 재렌더 뒤 오래된 행 데이터가 사용되지 않는다.

### 3. 커스텀 콤보와 이벤트 전달

- 서버 이벤트 값은 `U4AUI.createSelect()`의 `.u4a-combo__text`를 포함한 값 셀 안에 렌더된다. 콤보의 click 핸들러는 전파를 차단하지 않으므로 dblclick이 목록 컨테이너까지 버블된다.
- 첫 click의 `onOpen`은 서버 이벤트 목록을 비동기로 갱신한다. 공통 셀렉트는 `data-loading` 동안 재클릭 요청을 무시해 중복 조회·중복 목록 생성을 막지만 dblclick 전파 자체는 막지 않는다.
- 단일 click의 목록 열기와 dblclick의 Controller 이동은 원본에서도 ComboBox click과 테이블 dblclick이 공존한 구조이며, BR33이 단일 click 변경 로직을 침범하지 않는다.

### 4. 잠금과 예외 경로

- 위임 진입에서 원본과 같이 busy lock을 켜고, 서버 이벤트 처리·trial 조기 종료·비이벤트·빈값 및 동기 예외 경로 모두 말미에서 해제한다.
- `execControllerClass()`의 동기 호출 실패는 catch에서 콘솔에 표면화되고 잠금이 해제된다. 내부 비동기 멀티 로그인 실패는 공용 함수 자체 catch가 SAP GUI 대기 표시를 닫고 메시지를 처리한다.
- BR32 styleClass 선행 분기는 별도 팝업 수명주기로 잠금을 넘기는 기존 동작이며, `UIATY === "2"`인 BR33 서버 이벤트 행과 겹치지 않는다.

### 5. 독립 서브에이전트 반박 재검수

- 독립 검수도 재현 가능한 BR33 필수 결함을 찾지 못해 통과 판정에 동의했다.
- 가장 강하게 의심한 순서는 커스텀 콤보의 첫 click이 비동기 `onOpen` 조회를 시작하고, dblclick 이동이 실행된 뒤 조회 완료 시 목록이 늦게 열리는 경우다. 그러나 원본도 ComboBox click의 비동기 조회·open과 테이블 dblclick 이동을 의도적으로 공존시키며, 원본 주석도 dblclick 보존 목적을 명시한다. HTML5는 로딩 중 두 번째 click 요청만 무시하고 dblclick 전파는 막지 않아 계약상 동일하다.
- 포털 목록은 `body` 또는 `dialog`에 붙지만 dblclick 당시 target은 기존 콤보 값 셀이며, BR33 경로 자체는 재렌더를 유발하지 않아 행이나 콤보가 분리되는 경로가 없다.
- `ROW.__attrData`는 매 렌더 현재 `sAttr`로 재지정되고, BR32는 `UIATY="1"`의 `STYLECLASS`만 인수하므로 `UIATY="2"`인 서버 이벤트와 교차하지 않는다.
- 비동기 `execControllerClass` 실패는 공용 함수가 SAP GUI 대기 표시를 닫고 메시지를 처리한다. 호출 전 동기 예외는 위임 catch에서 표면화된 뒤 WS20 잠금이 해제된다.

## 수용 기준 점검

| 검수 항목 | 결과 | 근거 |
|---|---|---|
| 서버 이벤트 메소드 이동 호출 | 통과 | `execControllerClass(UIATV)` 직접 호출 |
| 비이벤트·빈값·trial 제외 | 통과 | 원본 3개 가드 보존 |
| 원본에 없는 UX 추가 여부 | 통과 | 안내·포커스·별도 동작 없음 |
| 라벨·이벤트명 링크 제외 | 통과 | 값 셀 한정 위임 |
| 서버/클라이언트 아이콘 제외 | 통과 | 아이콘 셀은 값 셀의 형제 |
| 렌더 반복 시 중복 배선 방지 | 통과 | `ROWS.__bwpDblWired` |
| 커스텀 콤보 dblclick 버블 | 통과 | click/dblclick 전파 차단 없음 |
| 단일 click 목록 열기 보존 | 통과 | 기존 `onOpen` 경로 유지 |
| 예외 표면화와 잠금 회수 | 통과 | catch의 `console.error` 후 공통 unlock |
| JavaScript 구문 검사 | 통과 | `node --check` |
| 독립 반박 재검수 | 통과 | 필수 지적 0건, 기존 판정 동의 |

## 잔여 참고

- 실제 SAP GUI 이동 완료 여부는 서버 연결·멀티 로그인 상태·IPC 수신 환경에 의존하므로 정적 검수에서는 `execControllerClass(UIATV)` 진입과 그 공용 함수의 전달 계약까지 확인했다. 실환경에서는 서버 이벤트 값칸, 빈값, trial, 세 제외 영역과 느린 `onOpen` 완료 후 목록 열림 UX를 각각 조작 검증하는 것이 적절하다.
- 원본 디스패처의 bindField 더블클릭 분기는 요청서에 명시된 별도 미변환 범위이므로 BR33 결함으로 판정하지 않았다.

## 검증 범위

- `.audit/br33/01_request.md` 전체 검수 포인트
- 원본 `www/ws30/ws10_20/design/js/uiAttributeArea.js:338-347`, `2956-3105`
- HTML5 `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:5801-5884`, `5193-5299`, `5990-6054`
- 공통 `www/ws30/ws10_20/theme/u4a-ui.js:44-253`, `www/ws30/ws10_20/js/ws_common.js:2785-2831`, `www/ws30/ws10_20/js/ws_fn_03.js:698-715`
- 프로젝트 규칙에 따라 언더바로 시작하는 폴더·백업 파일은 현행 근거에서 제외했다.
