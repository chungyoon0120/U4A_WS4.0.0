# BR39 OBJID 오류 표시 및 Preview CustomData 동기화 재검수

## 판정

**통과**

독립 서브에이전트 반박 검수와 원본 재대조 결과, 최초 P2 판정을 철회한다. 재현 가능한 필수 수정사항은 발견하지 못했다.

## 지적

없음.

## 최초 P2 철회 근거

최초 검수에서는 요청서의 “오류 UI로 복귀 시 다시 표시”를 수용 기준으로 보고, UI별 `OBJID_stat/stxt` 보존이 없다는 점을 P2로 판정했다. 그러나 이는 원본과 오류 상태의 실제 수명을 재대조하면 기능 결함이 아니다.

- HTML5 `_setUIInfo()`(`ws_html5_ws20_attr.js:2302-2367`)는 UI 선택마다 `uiinfo={}`를 새로 구성한다.
- 원본 UI5 `setUIInfo()`(`design/js/uiAttributeArea.js:7462-7524`)도 선택마다 `ls_uiinfo={}`를 새로 만들며 `OBJID_stat/stxt`를 보존하지 않는다.
- 원본 Input의 valueState binding은 새 `/uiinfo`에 오류 상태가 없으면 자동으로 None 상태가 된다. 즉 A에서 잘못 입력 → B 선택 → A 재선택 시 오류가 다시 나타나는 것은 원본 계약이 아니다.
- 잘못 입력한 OBJID는 Tree에 커밋되지 않았으므로 A를 다시 선택하면 저장된 정상 OBJID가 새 편집 버퍼에 들어오는 것이 자연스럽다.
- 이슈의 본래 결함은 HTML5가 Input DOM을 재사용하면서 이전 `.err` 클래스만 새 UI로 유출한 것이다. BR39은 현재 `uiinfo`를 기준으로 이를 제거해 원본 binding 결과를 명시적으로 재현한다.

따라서 요청서 검수 포인트 1(b)와 코드 주석의 “오류인 UI로 돌아오면 다시 표시”는 원본보다 넓은 부정확한 설명이다. 기능 수정이 아니라 요청서·주석 정정 권고 사항이다.

## 상세 검수 결과

### 1. 오류 표시 잔존 해결

- `_renderAttrHeader()`는 재사용 Input의 value와 title을 현재 `uiinfo.OBJID`로 먼저 바꾼다.
- 현재 상태가 Error이면 `.err`와 `OBJID_stxt`를 적용하고, 그 외에는 `.err`를 제거한다.
- 따라서 오류 A → 정상 B 전환에서 A의 테두리와 오류 title이 B로 전파되지 않는다.
- 같은 현재 `uiinfo`가 Error 상태인 채 헤더만 다시 렌더되면 오류 표시가 재적용된다. `_fail()`의 직접 add 및 `_clearErr()`의 remove와 결과가 대칭이다.
- 빈값 014, 숫자 시작 091, 특수문자 278, 중복 069가 모두 동일한 `OBJID_stat="Error"` 경로를 사용하므로 오류 유형별 누락이 없다.

### 2. Preview 컨트롤 CustomData 갱신

- rename 순서는 `_T_0015` OBJID 변경 → `prev[old]`를 `prev[new]`로 이관 → `_OBJID` 변경 → `.data("OBJID", new)` → old key 삭제다.
- Preview 생성 시 저장되는 CustomData와 Preview→Tree 선택에서 읽는 식별자를 같은 값으로 갱신하므로 정상 rename 직후의 불일치를 해결한다.
- ROOT/APP는 `edit01=false`로 입력 변경 자체가 막힌다. `.data`가 없는 불완전 객체도 `typeof ...data === "function"` 가드로 안전 종료한다.
- UI5 `ManagedObject.data`의 정상 동기 setter 경로에서는 같은 인스턴스가 정합하게 갱신된다. setter 예외는 콘솔에 표면화된다.

### 3. Undo/Redo 정합

- 현행 HTML5는 legacy `CL_CHANGE_OBJID`가 아니라 `ws_html5_ws20_edit.js`의 snapshot Undo/Redo를 사용한다.
- snapshot은 zTREE와 OBJID key별 `_T_0015`를 저장한다. restore는 이전 Tree와 `_T_0015` key를 복원하고 snapshot에 없는 신규 key의 `_T_0015`를 비운다.
- 이어지는 `drawPreview()`가 Preview를 전면 재생성하며, 각 새 UI 인스턴스에 복원된 Tree OBJID로 `.data("OBJID", OBJID)`를 다시 설정한다.
- 따라서 rename → Undo → Redo에서도 `_OBJID`, prev key, `_T_0015` 및 CustomData가 현재 Tree 이름으로 다시 수렴한다.

### 4. 연쇄 및 부작용

- Tree 노드와 자식 POBID, Client Event, Description, 현재 T_ATTR, Binding Popup 및 모델 refresh 순서는 기존 흐름을 유지한다.
- Busy, child broadcast, shortcut lock, Undo 적재 및 change flag 시점은 BR39에서 바뀌지 않았다.
- 신규 CSS, 색상, 메시지 키 또는 공통 자산 변경이 없다. 기존 WS20 `.err` 스타일을 소비한다.
- 관련 JavaScript 구문 검사를 통과했다.

## 수용 기준

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 오류 UI → 다른 UI에서 stale 테두리 제거 | 통과 | 현재 non-Error `uiinfo`로 `.err` 제거 |
| 현재 Error 상태의 헤더 재렌더 | 통과 | `OBJID_stat/stxt`로 오류 재적용 |
| A→B→A에서 저장된 정상 상태 표시 | 통과 | 원본과 동일하게 선택마다 새 `uiinfo` 구성 |
| 정상 UI 간 이동 | 통과 | value/title/class를 현재 UI로 동기화 |
| 정상 rename의 `_OBJID` 동기화 | 통과 | 동일 prev 인스턴스에 새 ID 설정 |
| 정상 rename의 CustomData 동기화 | 통과 | `.data("OBJID", new)` |
| ROOT/APP·함수 부재 가드 | 통과 | 편집 차단 및 typeof 검사 |
| Undo/Redo 후 CustomData 정합 | 통과 | snapshot 복원 후 Preview 전면 재생성 |
| Busy·공통 자산·토큰 무영향 | 통과 | 관련 로직과 자산 미변경 |

## 보수적 잔여 위험

- `.data("OBJID", new)`가 비정상적으로 throw하면 로그 후 rename 연쇄가 계속되어 CustomData만 이전 값일 수 있다. 그러나 선택 중인 정상 UI5 인스턴스의 동기 setter가 rename 도중 실패하는 현행 재현 경로는 찾지 못해 필수 결함으로 승격하지 않았다.
- 요청서와 `_renderAttrHeader`의 BR39 주석 중 “오류 UI로 돌아오면 다시 표시” 표현은 원본과 다르므로 후속 문서·주석 정리를 권고한다. 제품 동작 변경은 필요하지 않다.

## 검증 범위

- `.audit/br39/01_request.md`
- `.analy/15_공통_입력UX_가이드.md` §3.5
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:1430-1605`, `:2302-2367`, `:4872-4934`
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:115-244`
- `www/ws30/ws10_20/design/js/uiAttributeArea.js:4138-4372`, `:7462-7524`
- `www/ws30/ws10_20/design/preview/index.js`의 UI 생성 시 CustomData 설정
- `www/ws30/ws10_20/design/js/uiDesignArea.js`의 Preview→Tree OBJID 읽기
- 프로젝트 규칙에 따라 이름이 `_`로 시작하는 폴더와 파일은 현행 근거에서 제외했다.
