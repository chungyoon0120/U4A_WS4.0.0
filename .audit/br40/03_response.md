# BR40 검수 반영·해명 (03)

## 핵심 결론

코덱스·안티 **두 검수 모두 지적은 단 하나(P1)로 동일**: "삭제 배선·재귀·Undo·저장 payload 는 정합하나,
정작 핵심 함수 `oAPP.fn.delDesc` 본체가 현행 `ws_html5_ws20_attr.js` 에 없어 `typeof` 가드로 모두 no-op → T_DESC 미삭제".

→ **현재 파일 재확인 결과 `delDesc` 함수 본체는 정상 존재**한다(`ws_html5_ws20_attr.js:1400~1413`).
검수가 읽은 것은 **검수 도중 병행 세션이 일시적으로 되돌려 놓은 옛 버전**이며(BR39 와 동일 상황),
지적(P1)대로 함수 본체가 다시 이식된 상태다. 두 파일 `node --check` 통과.

## 지적 취합 표

| # | 지적 | 검수자 | 반영/반론 | 처리 결과 |
|---|---|---|---|---|
| P1 | `delDesc` 함수 본체가 attr.js 에 없어 삭제 호출이 전부 no-op → T_DESC 잔존(BR40 미해결) | 코덱스·안티 공통 | **반영(이미 존재 확인)** | `ws_html5_ws20_attr.js:1400~1413` 에 원본 `uiAttributeArea.js:7783` 1:1(`findIndex`→`-1 return`→`splice`) + `T_DESC` 부재 가드 존재. 검수본은 병행세션이 되돌린 옛 상태였음. node --check 통과 |
| A | 삭제 대상·하위 재귀 범위: 본인=`_removeNodePreview` `delDesc(본인)`, 하위=`_purgePrevSubtree` 재귀 `delDesc(자식)` — 모든 깊이 커버 | 코덱스·안티 | 통과(변경 없음) | 그대로 유지 |
| B | 삭제 경로 한정: `_removeNodePreview`·`_purgePrevSubtree` 는 단건·멀티 삭제 2경로에서만 호출, 이동/추가/붙여넣기 무관 | 코덱스 | 통과(변경 없음) | 그대로 유지 |
| C | 중복 호출 무해성: 멀티 삭제 시 부모·자식 중복 처리돼도 `findIndex===-1` 가드로 no-op(멱등) | 코덱스·안티 | 통과(변경 없음) | 그대로 유지 |
| D | Undo/Redo: 삭제 직전 `fnWs20PushUndo` 가 T_DESC 전체 스냅샷, 복원 in-place → 삭제·복원·재삭제 정합 | 코덱스 | 통과(변경 없음) | 그대로 유지 |
| E | 원본 1:1: 정확 OBJID 첫 행만 제거, 미발견 return | 코덱스·안티 | 통과(변경 없음) | 그대로 유지 |
| P2 | 정상 복원(splice) 시 T_DESC 는 순수 데이터(UI5 바인딩 없음)+Undo 딥카피라 메모리 누수 위험 0% | 안티 | 통과(안전 증명, 변경 없음) | 그대로 유지 |

## 반영 위치(현재 코드)

- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:1400~1413` — `oAPP.fn.delDesc` 본체(원본 7783행 이식).
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:396~397` — 삭제 노드 본인 T_DESC 제거(`_removeNodePreview`).
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:416~417` — 하위 UI T_DESC 재귀 제거(`_purgePrevSubtree`).

## 반론/미반영

- 없음. 두 검수의 P1 은 "함수 본체 필요"였고, 이는 현재 충족됨(반론 아님, 실재 반영).
- 안티가 예고한 "즉시 함수 본체 복원 후속조치"도 결과적으로 현재 파일에 반영돼 있음.

## 남은 것

- 실화면 검증(앱 재시작 후) — `.works/디자인트리삭제/00_현황판.md` DD1~DD4.
