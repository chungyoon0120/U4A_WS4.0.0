# BR42 Codex 검수 결과

## 판정

**수정 필요 — P1 1건**

BR42가 추가한 `fnWs20PushUndo()` 1회와 개별 `bSkipUndo=true` 방식은 Reset 전체를 하나의 Undo 스텝으로 묶는 목적에는 맞다. 그러나 Reset의 기존 HTML5 변경 경로가 원본의 AutoGrowing 종속 이벤트 초기화를 보존하지 않아, Reset 결과와 그 Undo/Redo 대상 데이터가 원본과 달라지는 결함이 확인됐다.

## 지적

### [P1] AutoGrowing Reset이 연동 서버/클라이언트 이벤트를 초기화하지 않는다

- 현행 Reset은 각 프로퍼티 값을 기본값으로 먼저 바꾼 뒤 `fnWs20AttrChange(_sAttr, uityp, true)`를 호출한다 (`www/ws30/ws10_20/js/ws_html5_ws20_attr.js:4494~4508`).
- `fnWs20AttrChange`는 일반 사용자 입력용 `attrChangeAutoGrowingProp` 게이트를 통과한다 (`ws_html5_ws20_attr.js:3738~3745`). AutoGrowing 값이 `true`가 아니면 이 게이트는 `attrSetAutoGrowingException(is_attr, false)`만 호출한다 (`ws_html5_ws20_attr.js:3635~3640`). 세 번째 인자 `bClear=true`가 없으므로 연동 이벤트의 `UIATV/ADDSC`, 클라이언트 이벤트 및 변경 데이터는 지우지 않고 편집 잠금만 해제한다.
- 원본 Reset은 값 반영 직후 반드시 `attrSetAutoGrowingException(_sAttr, false, true)`를 호출한다 (`design/js/uiAttributeArea.js:2192`, 실제 원본 `C:/Users/socce/Documents/Github/U4A_WS3.0.0/.../uiAttributeArea.js:2183~2192`). 따라서 AutoGrowing 관련 이벤트 값과 클라이언트 이벤트를 Reset에 포함해 초기화한다.

재현 조건:

1. `sap.ui.table.Table`, `sap.m.Table` 또는 `sap.m.List`에서 AutoGrowing과 그에 연동된 서버/클라이언트 이벤트를 설정한다.
2. AutoGrowing의 현재값이 기본값과 다른 상태에서 Reset을 실행한다.
3. AutoGrowing 프로퍼티는 기본값으로 돌아가지만 관련 이벤트 등록 데이터가 남는다. 원본은 이 데이터를 함께 지운다.

신규 UI에서 AutoGrowing을 `true`로 바꾸는 정상 흐름은 기존 이벤트를 먼저 지우므로, 서버 메타데이터의 기본값이 `false`인 환경에서는 새 조작만으로 이 공존 상태를 만들기 어렵다. 그러나 AutoGrowing의 `DEFVL`은 런타임 서버 `T_0023` 데이터이며 저장소만으로 고정할 수 없고, 현행 데이터 로드 경로는 이미 저장되거나 이관된 `AutoGrowing + 연동 이벤트` 조합을 정규화하지 않는다. 따라서 기존 앱을 열어 Reset하는 정상 제품 경로에서 재현 가능하며 원본이 Reset마다 `bClear=true`를 강제한 불변식을 생략할 근거가 되지 않는다.

영향:

- Reset 완료 데이터가 원본과 달라 저장 payload에 연동 이벤트가 잔존할 수 있다.
- BR42의 그룹 스냅샷은 `T_CEVT`까지 보존하므로(`ws_html5_ws20_edit.js:133~141`) 올바르게 초기화만 수행하면 Undo/Redo로 함께 복원할 수 있다. 현재는 삭제 변이가 일어나지 않아 Undo/Redo도 잔존 이벤트를 그대로 유지한다.

권고:

- Reset 전용 호출에서는 일반 입력용 AutoGrowing 확인 게이트를 건너뛰고, 원본과 같이 값 반영 후 `attrSetAutoGrowingException(_sAttr, false, true)`를 명시적으로 수행한다.
- 이 추가 변이는 현재의 단일 `fnWs20PushUndo()` 뒤, 각 `fnWs20AttrChange(..., true)`와 같은 Reset 트랜잭션 안에서 수행해야 한다.

## BR42 Undo 변경 자체 검증

| 항목 | 결과 |
|---|---|
| 첫 실제 변경 직전 스냅샷 1회 | 통과 |
| 변경 대상 0건일 때 빈 Undo 방지 | 통과 |
| 개별 변경의 추가 Undo 억제 | 통과 |
| Undo 한 번으로 `_T_0015` 전체 복원 | 통과 |
| Redo 스냅샷 생성 및 재적용 | 통과 |
| 바인딩 속성·비프로퍼티 제외 | 통과 |
| 원본 Reset 부수효과 전체 보존 | **실패 — AutoGrowing 연동 이벤트 초기화 누락** |

## 독립 재검수 취합

서브에이전트가 기존 P1을 반박하는 방향으로 실제 WS3 원본, 현행 Reset, AutoGrowing 예외 함수와 데이터 로드 경로를 독립 추적했다. 현행 함수에는 이벤트 `UIATV/ADDSC`, `_T_0015`, `T_CEVT`를 제거하는 `bClear=true` 구현이 존재하지만 Reset 호출만 이를 전달하지 않는 사실과 기존 저장·이관 데이터 재현 경로를 재확인했다. 결론은 **FAIL 유지**이며, 신규 UI 생성 경로만 좁게 한정하면 우선순위를 P2로 낮출 여지는 있으나 저장 데이터 및 실행 이벤트 잔존까지 포함한 제품 영향 기준으로 P1을 유지한다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과

제품 소스는 수정하지 않았다.
