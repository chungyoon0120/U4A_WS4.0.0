# BR46 Codex 검수 결과

## 판정

**수정 필요 — P1 1건, P2 1건**

기본 재렌더 대상과 완료 대기 순서는 대체로 맞지만, 현재 WS20을 잠그지 않은 채 timeout/cancel 없는 RTE 이벤트를 기다려 재진입·영구 pending이 가능하다. 또한 원본은 삽입 전에 after-render listener를 등록하지만 현행은 모든 preview 변이 뒤에 등록해 원본의 선등록 안전성을 잃었다.

## 지적

### [P1] 무잠금 post-mutation 대기에서 대상 파괴 시 작업과 BUSY_OFF가 영구 pending될 수 있다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:82~87`, `1155~1168`, `1788~1794`; `design/js/previewRender/setOnAfterRender.js:15~76`, `243~328`
- 삽입 루프 종료 시 `zTREE`, `prev`, preview aggregation은 이미 변경됐지만 tree refresh·선택·change flag는 `_rerenderParentRTE()` 완료 뒤다.
- confirm은 dialog를 닫은 뒤 `_broadBusy(true)`만 실행한다. 이 함수는 단일 BroadcastChannel에 송신할 뿐이며 송신 객체 자신은 자기 메시지를 받지 않으므로 현재 WS20의 local busy/shortcut을 걸지 않는다. 팝업 open 때의 local busy도 표시 완료 시 이미 해제된다.
- `setAfterRendering()`과 `renderingRichTextEditor()`의 Promise는 reject/timeout/cancel 없이 `onAfterRendering` 또는 RTE `readyRecurring` 이벤트가 와야 resolve된다.
- 재현 경로: 이미 렌더된 RTE를 포함한 부모에 popup으로 자식을 추가하고, `readyRecurring` 대기 중 현재 트리에서 그 부모를 삭제한다. 대상 컨트롤 파괴로 이벤트가 오지 않으면 `designAddUIObject`가 영구 pending되고 wrapper의 `_broadBusy(false)`도 실행되지 않는다. Undo·재삽입은 완료 뒤 continuation이 사라진 `lastObjid`를 선택하는 stale continuation을 만들 수 있다.
- 항상 데이터 불일치가 난다고 단정할 수는 없지만, 정상 사용자 입력으로 중간 상태 재진입과 이벤트 소실에 따른 고착이 가능하다는 점은 확정적이다.

**제안:** confirm부터 rerender, tree refresh, selection, change flag 완료까지 현재 WS20 local busy/shortcut 또는 insertion generation lock을 유지하고 `finally`에서 해제한다. Promise에는 bounded timeout/cancel 및 await 뒤 target/generation 재검증이 필요하다.

### [P2] 원본의 삽입 전 listener 선등록 순서를 보존하지 않았다

- 위치: 현행 `ws_html5_ws20_edit.js:108~124`, `1125~1164`; 원본 `design/js/uiDesignArea.js:5179~5197`, `5424~5440`
- 원본은 삽입 루프 전에 부모 target·DOM을 구하고 `setAfterRendering()` listener를 먼저 등록한 뒤 preview aggregation을 변경한다. 삽입 후에는 RTE Promise 수집, 명시 rerender, 선등록 Promise await 순서다.
- 현행은 모든 `createUIInstance`, `moveUIObjPreView`, `destroyExcepChild`가 끝난 뒤 helper에 들어가 target 탐색과 listener 등록을 시작한다.
- preview mutator가 부모 aggregation을 변경하고 invalidate/render를 예약할 수 있으므로, UI5 렌더가 listener 등록보다 먼저 진행되면 원본이 포착하던 after-render를 놓친다. 보통 렌더가 다음 tick이라 빈도는 낮지만 “원본 1:1”은 아니며 선등록 경쟁 방지 보장이 제거됐다.

**제안:** helper를 prepare/complete 단계로 나눠 삽입 전에 target과 after-render Promise를 준비하고, 삽입 후 RTE 수집·명시 rerender·await를 수행한다.

## 최초 보고서 P2 철회

최초 보고서의 “`Promise.all(aRte)` reject를 빈 catch가 은폐한다”는 지적은 철회한다. 현재 `setAfterRendering()`과 하위 대기 함수는 resolve만 사용하고 reject를 전달하지 않는다. 내부 실패의 실제 형태는 catch 도달이 아니라 Promise 영구 pending 또는 별도 unhandled rejection이므로, 빈 catch 자체를 재현 결함으로 볼 수 없다. 형제 D&D의 동일 catch도 이 결론과 일치한다.

## 확인된 정상 범위

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 부모 기준 | 통과 | `prev[parentNode.OBJID]`를 사용해 원본 `is_tree` 기준과 일치한다. |
| 완료 순서 | 통과 | listener가 준비된 뒤에는 RTE 수집 → parent rerender → parent Promise → RTE Promise 순서다. |
| 호출 위치/횟수 | 통과 | 다건 삽입 전체와 임시 자식 정리 뒤, tree refresh 전에 부모 기준 1회 호출한다. |
| 미로드 가드 | 통과 | frame/contentWindow, module, target 또는 DOM 부재 시 안전한 no-op이다. |
| D&D 신규 삽입 | 통과 | UI 추가 popup에서 끌어놓는 신규 UI도 동일 `designAddUIObject`를 await한다. 기존 이동/복사는 자체 helper를 유지한다. |
| KEEP-UI5 경계 | 통과 | 변경은 HTML5 edit 모듈이며 `design/` 참조 파일은 수정하지 않았다. |

## 독립 재검수 취합

두 서브에이전트가 각각 잠금/재진입과 Promise 계약을 독립 추적했다. 양쪽 모두 local WS20 무잠금, 이벤트 기반 Promise의 timeout 부재, 대상 파괴 시 pending 및 BUSY_OFF 미회수 가능성을 확인했다. Promise reject 은폐 주장은 코드 계약상 성립하지 않는다고 일치해 철회했으며, 별도 검수에서 원본의 삽입 전 listener 등록과 현행 후등록 차이를 확인했다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- 전체 `designAddUIObject` 호출처, BroadcastChannel 수신, RTE Promise 종단 재검색 완료
- `_`로 시작하는 백업 파일·폴더는 근거에서 제외

제품 소스는 수정하지 않았다.
