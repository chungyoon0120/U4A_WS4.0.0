# BR59 Codex 검수 결과

## 판정

**통과 (필수 수정 0건)**

BR59는 컨텍스트 메뉴 이동 시 preview에 전달하던 전체 형제 index를 원본과 같은 aggregation 내부 index로 교정한다. 같은 그룹 앞쪽의 UA026 항목만 차감하고 그룹 내 위치가 실제로 바뀐 경우에만 preview를 이동하므로, 서로 다른 aggregation 자식이 섞인 부모에서도 tree와 UI5 aggregation 순서가 정합한다.

## 검증 결과

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 그룹 위치 산식 | 통과 | `_aggrPos`는 부모 형제 중 `UIATT`가 대상과 같은 항목만 필터한 뒤 OBJID 위치를 구한다(`ws_html5_ws20_edit.js:674~679`). 원본 `callDesignContextMenu.js:500~503`, `538~541`과 동일하다. |
| UA026 차감 | 통과 | 이동 후 그룹 위치를 초기 index로 삼고, 그 앞의 같은 그룹 형제 중 `T_9011`의 `CATCD === "UA026"`, `FLD02 !== "X"`, `FLD01 === UILIB`인 항목마다 1씩 차감한다(`edit.js:680~701`). 원본 `callDesignContextMenu.js:546~558`과 일치한다. |
| 미리보기 호출 가드 | 통과 | 이동 전·후 `_aggrPos`가 다를 때만 `moveUIObjPreView`를 호출한다(`edit.js:718`, `731~734`, `1938`, `1948~1951`). 다른 aggregation 형제만 지나친 이동은 UI5 aggregation 내부 순서가 바뀌지 않으므로 preview no-op이 맞다. |
| tree 이동 의미 | 통과 | tree는 기존처럼 전체 `zTREE` 배열에서 splice한다. 원본도 전체 형제 위치를 이동한 뒤 별도로 같은 aggregation 위치를 계산하므로 의미가 같다. |
| Up/Down 경로 | 통과 | tree 메뉴는 `_moveUI`를 직접 호출하고, preview 우클릭은 `fnWs20MoveUI`로 위임된다(`edit.js:2121~2122`, `ws_html5_ws20_prev.js:1254~1263`). 양쪽이 동일 보정 산식을 공유한다. |
| Move Position 경로 | 통과 | HTML5 popup은 1-based 입력을 0-based로 변환해 공용 `fnWs20MoveUIToIndex`를 호출한다(`edit.js:1985~2024`). preview 원본 popup도 callback의 0-based `pos`를 같은 함수로 위임한다(`ws_html5_ws20_prev.js:1264~1273`). |
| preview index 소비 | 통과 | `moveUIObjPreView`는 전달받은 index를 대상 aggregation의 insert mutator 또는 `insertAggregation(UIATT, control, index)`에 그대로 사용한다(`design/preview/index.js:6224~6235`). 따라서 그룹 기준 보정이 필요한 원인이 확인된다. |
| T_9011 미로드 | 통과 | 조회 실패 시 UA026 목록만 빈 배열로 대체된다. 최소한 전체 형제 index로 회귀하지 않고 같은 그룹 index는 유지한다. |
| 기존 후처리 | 통과 | Undo push, 전체 배열 splice, tree refresh, 선택, change flag, binding popup update, `_broadBusy`의 try/finally 짝이 그대로 유지된다. |
| 클로저 안전성 | 통과 | `sUilib`는 각 반복에서 설정되고 `findIndex`가 같은 반복 안에서 동기 실행되므로 `var` 캡처로 인한 후행 값 참조가 없다. |

## 경계 사례 검토

- 같은 aggregation 형제가 `A1, A2, A3`이고 다른 그룹 노드가 사이에 섞여 있어도, A2를 전체 배열에서 이동한 뒤 필터된 A 그룹 위치만 preview에 전달한다.
- 이동 대상 앞에 UA026 형제가 여러 개면 각각 1씩 차감하며 0 미만은 방어적으로 0으로 고정한다. 정상 원본 산식에서도 결과는 음수가 되지 않는다.
- 인접한 다른 그룹 노드 하나만 통과하면 tree 전체 순서는 바뀌지만 `iAggrBefore === iAggrAfter`라 preview를 건드리지 않는다. 이는 preview가 aggregation별로 자식을 소유하는 UI5 구조와 일치한다.
- 단일 aggregation, 첫/마지막 위치, 동일 위치 Move Position은 각각 기존 결과를 유지하며 동일 위치는 Undo와 재렌더를 만들지 않는다.
- 대상 자신이 UA026인 경우에도 원본처럼 “대상 앞의 UA026”만 차감하며 대상 자체는 차감하지 않는다.

## 보수적 반박 검토

- `UIATK`가 아닌 `UIATT`로 그룹을 구분하는 점을 검토했으나 원본 `contextMenuUiMove`가 동일하게 `UIATT`를 사용하고, preview mutator도 `UIATT` aggregation 이름을 소비하므로 1:1이다.
- 전체 배열 target index를 그룹 index로 직접 해석하는 오류 가능성을 검토했으나, 함수는 먼저 전체 배열 splice를 완료한 뒤 결과 배열을 다시 필터하므로 이동 방향과 거리에 관계없이 최종 그룹 위치를 계산한다.
- preview 위임의 `pos` 단위를 확인했다. 원본 위치 popup은 현재 위치를 1-based로 표시하지만 callback에는 대상 0-based index를 전달하며, HTML5 자체 popup도 확정 시 `v - 1`을 전달한다.
- helper 내부 `T_9011` 손상 시 UA026 차감이 생략되는 것은 강건성 저하일 수 있으나 라이브러리 정상 계약에서는 배열이고, 손상 상태에서도 BR59의 핵심인 aggregation 기준 위치는 유지된다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_prev.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- 원본 이동 산식, preview 소비처, tree/preview 메뉴 위임 및 위치 popup callback 재검색 완료
- `_`로 시작하는 백업 파일·폴더는 근거에서 제외

## 독립 재검수 취합

두 서브에이전트가 기존 통과 판정을 반박하는 방향으로 공식과 호출 경로를 분리해 재검수했으며, 모두 **재현 가능한 BR59 결함 0건, 통과 유지**로 결론 냈다.

- 공식 검수는 이종 aggregation 한 칸 통과, 동종 형제 통과, 장거리 이동, 복수 UA026, 이동 대상 자체가 UA026인 경우를 대조했다. 모든 경우 최종 그룹 위치와 앞선 UA026 차감이 원본 산식과 같았다.
- 경로 검수는 Tree/Preview Up·Down과 양쪽 Move Position의 0-based 위임을 확인했다. Undo/Redo는 `PRCCD=UNDO_REDO`일 때 원본으로 통과하고 원본 자체가 같은 aggregation 산식을 사용한다.
- `denyChildAggregation`, `skipSplitterLayoutData`, `collectPopup`은 preview 소비처에서 index 사용 전에 반환하며, 단일 aggregation도 index를 사용하지 않으므로 보정으로 인한 예외 UI 회귀가 없다.
- preview 미로드 시 `_prev`가 no-op이어도 tree 모델은 이미 최종 순서이며, 이후 전체 preview redraw가 tree를 기준으로 재구성한다.
- `_selectNode` Promise 미대기와 `_prev` 내부 예외 회수는 선행 설계지만 BR59가 추가하거나 악화한 결함은 아니다.

제품 소스는 수정하지 않았다.
