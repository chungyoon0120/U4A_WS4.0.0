# BR53 Codex 검수 결과

## 판정

**수정필요**

미등록 서버이벤트에서 `setAttrFocus(UIATK, "E", {bKeepRow:true})`를 호출하고 값 칸의 `.u4a-combo`를 이동·포커스 대상으로 삼은 핵심 변경은 타당합니다. 그러나 스크롤 대기 구간에 콤보 생명주기를 보호하지 않아, 행이 교체된 뒤 폐기된 콤보가 body에 목록을 다시 여는 확정 경쟁 조건이 있습니다.

## 지적

### 1. [P2] 대기 중 행이 재렌더되면 폐기된 콤보가 body에 고아 목록을 연다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js:645`~`706`, `3198`~`3218`, `5671`~`5727`; `www/ws30/ws10_20/theme/u4a-ui.js:221`~`241`
- `getServerEventList(fnOk, false)`는 성공 콜백 `fnOk`에 들어가기 전에 `parent.setBusy("")`를 호출하고, 콜백 직후 디자인영역 잠금도 해제한 다음 Promise를 resolve합니다. BR53은 그 뒤 `_attrWaitScrollIdle()`에서 최소 3프레임을 더 기다립니다. 즉 이 대기 동안 현재 WS20은 다시 조작할 수 있습니다.
- 그 사이 사용자가 다른 UI를 선택하거나 속성 변경/필터 토글 등으로 `fnRenderWs20AttrRows()`가 실행되면, 기존 행과 `oCombo`는 DOM에서 제거됩니다. 하지만 공통 `createSelect`의 Promise 완료 처리 `_done`은 `oCombo.isConnected`나 요청 세대를 검사하지 않고 무조건 `_open()`을 호출합니다.
- `_open()`은 폐기된 `oCombo.getBoundingClientRect()`를 기준으로 새 `.u4a-combo__list`를 `document.body`에 붙입니다. 따라서 새 UI로 전환된 뒤에도 이전 이벤트 목록이 화면 모서리 등에 고아 팝오버로 열릴 수 있습니다. 목록 항목을 누르면 이전 `sAttr` 클로저를 대상으로 `_onPick`까지 실행할 수 있어, 단순 순간 깜박임보다 범위가 큽니다.
- 원본은 조회·이동 뒤 같은 동기 흐름에서 콤보를 열어 이러한 추가 재진입 창이 없습니다. BR53의 대기는 HTML5 적응상 필요하지만, 그 대기와 함께 앵커 생명주기 검증도 필요합니다.

## 정상 확인 사항

- 미등록 이벤트 성공 판정에서 `setAttrFocus` → 오류 문구 재설정 → 항목 갱신 → 대기 → `_open` 순서는 원본의 이동·포커스 후 펼치기 의미를 보존합니다.
- `bKeepRow:true`는 현재 콤보 DOM을 유지하면서 `aria-selected`를 단일 지정하고, `_attrSelUiatk`도 함께 보관하므로 이후 BR52 재렌더 복원과 정합합니다. 다른 UI 전환 시 `_updateAttrList`가 키를 지웁니다.
- 기존 2인자 호출은 `bKeepRow=false`로 종전 재렌더 경로를 그대로 탑니다.
- 값 칸 선택자는 `input`, `textarea`, `select`, `.u4a-combo`, `button`으로 한정되어 뒤쪽 아이콘 버튼 오선택을 막습니다. 현행 값 렌더러에서 한 값 칸에 서로 다른 주 값 컨트롤이 동시에 생성되는 경로는 확인되지 않았습니다.
- 등록 이벤트 또는 조회 실패 경로는 `bMoved=false`이므로 BR53 프레임 대기를 추가하지 않습니다. 서버 RETCD 실패·통신 오류에서 성공 콜백을 부르지 않아 BR24의 오판 방지도 유지됩니다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 및 `git diff --check` 통과.

## 비차단 참고

- `_attrWaitScrollIdle()`의 40은 wall-clock timeout이 아니라 rAF 실행 횟수이고 조건도 `iTick > 40`이라 실제 상한은 41프레임입니다. 다만 배포 BrowserWindow 설정 `www/settings/BrowserWindow/BrowserWindow-settings.json:12`가 `backgroundThrottling:false`이며 정상 로그인·Trial 창 생성도 이 설정을 복제합니다. 제품 환경에서 최소화 때문에 카운터가 고착된다는 기존 P2 지적은 독립 반박 검토 후 철회합니다. 일반 브라우저에서도 보통 가시성 복귀 시 rAF가 재개되므로 이식성/P3 수준 참고만 남깁니다.

## 제안

1. 공통 콤보의 비동기 완료 시점에 최소한 `oCombo.isConnected`와 현재 열기 세대를 확인하고, 폐기·교체된 앵커라면 `_open()`하지 않도록 하십시오. 가능하면 `onOpen`에 취소 결과를 반환하는 명시적 계약을 두십시오.
2. 이식 가능한 wall-clock 종료 보장까지 원한다면 스크롤 안정 관찰에 실제 시간 기반 timeout을 병행하고 완료 시 timeout/rAF를 정리하십시오.
3. BR53 경로에는 “미등록 이벤트 클릭 직후 다른 UI 선택/Show Changed Items 토글”과 “대기 중 행 재렌더” 회귀 테스트를 추가하십시오. body 직계 `.u4a-combo__list`가 남지 않고 이전 `sAttr` 변경도 발생하지 않아야 합니다.

## 독립 재검수 취합 (2026-08-21)

사용자 요청에 따라 두 서브에이전트가 기존 지적을 반박하는 방향으로 DOM 수명주기와 rAF 종료 계약을 각각 독립 검증했습니다.

- **P2-1 유지:** 조회 성공 콜백 후 디자인 잠금이 해제되고 smooth-scroll 안정 대기가 이어지는 동안 Show Changed Items가 실제 클릭 가능합니다. 이 핸들러는 행 전체를 동기 재렌더하여 기존 콤보를 detach합니다. 공통 `_done`은 생존 검증 없이 `_open()`하고, detached 콤보는 `closest("dialog")`가 null이라 목록을 body에 붙입니다. 목록 선택은 과거 `sAttr` 클로저의 `_onPick`까지 도달합니다. 따라서 이 지적은 이론적 경합이 아니라 정상 UI 조작으로 재현 가능한 P2입니다.
- **기존 P2-2 철회:** rAF가 hidden에서 throttle될 수 있다는 일반 웹 전제는 맞지만, 실제 MAIN BrowserWindow는 `backgroundThrottling:false`를 상속합니다. 현 제품에서 사용자 상호작용 가능한 상태의 지속 고착은 입증되지 않았습니다. 41프레임/시간 상한 문제는 비차단 참고로만 유지합니다.

### 재검수 최종 판정

**수정필요 유지 — P2 1건(대기 중 detached 콤보 재개방 및 stale 상태 변경 가능).**
