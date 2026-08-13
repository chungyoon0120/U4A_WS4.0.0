# BR32 검수 결과 반영·해명 (03)

두 검수(코덱스·안티) 모두 **수정필요**. 핵심 지적은 "편집기 여는 경로에서 화면잠금 고착(deadlock)". 취합·처리 결과는 아래 표.

## 지적 취합 표

| # | 지적 | 검수자 | 처리 | 근거·조치 |
|---|---|---|---|---|
| P1-1 | CSS 편집기 스크립트(`fnEditorPopupOpen`) 최초 로드 실패 시, 디스패처가 진입에 건 `fnSetBusyLock("X")`를 풀 주체가 없어 WS20 화면 영구 잠김. `loadJs`에 오류 콜백/실패 반환이 없어 콜백 흐름이 끊김. | 코덱스·안티 | **반영** | 디스패처에서 **진입 선-잠금(`fnSetBusyLock("X")`)과 말미 해제를 제거**. 편집기 여는 함수 `fnEditorPopupOpen`(fnEditorPopupOpen.js:31)이 **진입 즉시 스스로 `fnSetBusyLock("X")`**를 걸고 자기 수명주기(정상 오픈 `_finishOpen`/이미 열림 즉시 해제/감시타이머)로 해제하므로, 디스패처의 선-잠금은 중복이자 고착 원인. 제거하면 로드 실패해도 애초에 잠근 것이 없어 고착 불가. styleClass 매치 시 `return`은 유지(잠금은 편집기 함수가 관리). `ws_html5_ws20_attr.js` 값칸 더블클릭 위임. |
| P1-2 | 신규 편집기 창의 문서 `loadURL()` 실패·초기화 전 `closed`는 editor frame 감시타이머(15초) 설치 이전에 발생 → 편집기가 스스로 건 잠금과 자식창 `BUSY_ON`이 회수되지 않음. | 코덱스 | **반론(별도 이슈)** | 이 잠금은 **편집기 여는 공통 함수(`fnEditorPopupOpen`)가 스스로 건 잠금**이며 BR32가 건 것이 아니다. Edit 메뉴의 CSS 편집기(`fnHmws.js:147 fnHmws20_30_10`)·JS 편집기(`fnHmws20_30_20`)도 **동일하게 `fnSetBusyLock("X")` 후 `fnEditorPopupOpener`에 위임**하므로, 이 창-수명주기 결함은 이미 배포 중인 모든 편집기 호출에 **선재·공통**이다. 고치려면 공통 편집기 opener/`editorFrame`의 창 실패 정리(`loadURL().catch`·`did-fail-load`·초기화 전 `closed` → 멱등 cleanup)를 손봐야 하는데, 이는 CSS/JS/테마/스니펫 편집기 전체에 영향을 주는 **BR32(스타일클래스 더블클릭 배선) 범위 밖**의 광범위 변경이다. 별도 이슈로 공통 편집기 창 정리를 하드닝 권고. (선례: BR26/BR28 선재·광범위 결손도 별도 이슈로 분리.) |

## 검수가 통과로 확인한 항목(변경 없음)

두 검수 모두 다음은 정합/통과로 확인. 조치 없음.

- `attrDblClickStyleClass` 4가드(프로퍼티·STYLECLASS·비바인딩·값존재)와 편집기 정보(`OBJID+UIASN`, `CS`, `CSS`)·검색값(`UIATV`) 전달·`return true`가 원본 `uiAttributeArea.js:3007~3035`와 1:1. `!UIATV` 보완은 안전.
- 정상 신규 창·이미 열린 창 잠금 해제(편집기 자기 수명주기)는 정상.
- F4 값도움(복사 아이콘)·값 지우기 버튼 제외(`.u4a-field__vh, .u4a-field__clear`), 라벨 링크·별도 아이콘 셀 제외(값칸 스코프) 정상.
- 바인딩·빈값 styleClass 제외 정상.
- BR33 서버이벤트 값칸 더블클릭 이동 보존(styleClass 가드 통과 후 기존 호출) 정상.
- 리스너 1회 배선(`__bwpDblWired`) 정상. `node --check` 통과.

## P1-1 반영 후 동작 요약

- styleClass 값칸 더블클릭 → `attrDblClickStyleClass` 가드 통과 → `fnEditorPopupOpener` → `fnEditorPopupOpen`이 진입 즉시 화면잠금·창 오픈·완료 시 해제. 디스패처는 잠금을 건드리지 않음.
- 편집기 스크립트가 아직 없어 `loadJs` 로 불러오다 실패해도, **BR32가 잠근 것이 없으므로 화면 고착 없음**(로드 성공 시에만 편집기가 스스로 잠금).
- 서버이벤트·일반 값칸 더블클릭은 잠금을 걸지 않던 기존(BR33) 동작 그대로.

## 잔여 참고
- 원본 디스패처의 bindField(서버 위치조회) 더블클릭 갈래는 요청서대로 HTML5 미변환. BR32 회귀 아님.
- P1-2(공통 편집기 창 실패 정리)는 별도 이슈 권고. 승인 시 CSS/JS/테마/스니펫 공통으로 하드닝.
