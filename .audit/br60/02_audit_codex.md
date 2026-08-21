# BR60 Codex 검수 결과

## 판정

**수정필요**

맞바꿈과 취소 안내는 원본과 정합하지만, 저장 잠금의 두 핵심 경로가 미리보기 완료 전에 해제됩니다. 재배치 경로는 지연된 두 번째 해제까지 남겨 다른 작업의 잠금을 해제할 수 있습니다.

## 지적

### 1. [P1] 재배치 성공 분기에서 `load` 대기를 등록하고도 즉시 잠금을 해제함

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20.js:1087`~`1119`
- iframe이 있으면 `1108`~`1113`에서 `load` 콜백을 등록하고, 콜백 안에서 `_unlock()`을 호출합니다. 그러나 같은 `_bReparented` 분기 끝의 `1119`가 조건 없이 `_unlock()`을 다시 호출합니다.
- 따라서 저장 직후 잠금이 즉시 풀려 BR60의 “미리보기 재로드 완료까지 화면·단축키 잠금” 요구와 WP1 직렬화를 충족하지 못합니다. `1119`의 주석은 “재부착 없음”이라고 적혀 있지만 실제 위치는 `_bReparented === true` 블록 안입니다.
- 이후 iframe `load`가 발생하면 콜백이 `_unlock()`을 두 번째 호출합니다. `parent.setBusy`와 `setShortcutLock`은 소유권/참조 카운트가 없는 boolean 상태이므로, 첫 해제 뒤 사용자가 시작한 다른 작업이 잠금을 걸었더라도 늦은 두 번째 해제가 그 잠금까지 풀 수 있습니다. BR49가 막으려던 재진입 경쟁을 다시 열 수 있는 P1입니다.
- iframe 부재와 대기 배선 예외 경로도 `1114`/`1115`에서 한 번, `1119`에서 다시 한 번 해제합니다.

### 2. [P1] 순서 무변경의 명시 재로드도 비동기 완료 전에 잠금을 해제함

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20.js:1125`~`1128`
- `fnWs20LoadPreview()`는 완료를 반환하는 동기 재그리기가 아닙니다. `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:1631` 이후 모듈 확보 콜백을 사용하고, 원본 `www/ws30/ws10_20/design/js/uiPreviewArea.js:150`~`169`도 `drawPreview().then(...)`으로 완료를 비동기 통지합니다.
- 그런데 호출 직후 `1128`에서 `_unlock()`하여 단축키를 즉시 풀고 화면 busy도 해제합니다.
- `fnWs20LoadPreview`는 `ws_html5_ws20_prev.js:1621`, `1641`에서 `_ws20EngagePrevBusy()`를 호출합니다. 이는 `fnSetBusyLock("X")`을 사용하고, HTML5 구현 `ws_html5_shell.js:356`~`363`은 같은 `parent.setBusy`를 조작합니다. 따라서 `1128`의 `_unlock()`은 미리보기 로더가 방금 인수한 busy까지 즉시 꺼버립니다.
- 이 경로도 미리보기 구성 완료 전에 사용자 입력이 가능해져 저장 연타·트리 조작과 `drawPreview`가 겹칠 수 있으므로 P1입니다.

### 3. [P2] BR60 핵심 잠금 API 실패를 빈 catch로 삼켜 기능이 조용히 무효화됨

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20.js:1064`~`1068`
- 화면 잠금과 단축키 잠금은 이번 이슈의 필수 기능인데 ON/OFF 모두 빈 catch입니다. 호출 실패 시 저장은 그대로 진행되고 오류 코드나 사용자 안내가 없습니다.
- `.claude/rules/code.md`의 “오류 삼킴·조용한 catch 금지”와 충돌합니다. 최소한 추적 가능한 오류 코드를 로깅하고, ON 실패 시 무잠금 저장을 계속 허용할지 명시해야 합니다.
- 함수의 런타임 존재 자체는 정상입니다. `library-preload.js:162`에서 셸 파일을, `174`에서 속성 파일을 적재하며 `ws_html5_ws20_attr.js:312`~`316`이 `setShortcutLock`을 정의합니다.

## 정상 확인 사항

- 카드 배열의 두 인덱스를 직접 교환하는 `1035`~`1037`은 원본 `callDesignLayoutChangePopup.js:299`~`307`의 POSIT 교환 후 정렬과 세 카드의 모든 상호 이동에서 결과가 같습니다.
- X 버튼·하단 닫기·ESC는 `_close()`로 MSG_WS 001을 표시하고 저장 성공만 `_close(true)`로 생략하여 원본 `lf_close`와 정합합니다.
- `parent.showMessage(null, 10, "I", s001)`의 `null`은 HTML5 메시지 구현이 UI5 인자를 무시하므로 안전하며 KIND 10 토스트 계약도 맞습니다.
- 확인창 동안 busy를 걸지 않고 YES 이후에만 거는 결과 상태는 원본의 `lf_save` 바깥 `setBusy("")`와 콜백 내 재잠금 결과와 실질적으로 같습니다.
- `setDesignLayout`의 BR49 재부착 사실 보존은 유지됩니다.
- `node --check www/ws30/ws10_20/js/ws_html5_ws20.js` 통과.
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20.js` 통과.

## 제안

1. `_unlock()`을 idempotent completion 함수로 만들고 각 저장 실행에 세대 토큰을 부여해 해당 실행이 소유한 잠금만 한 번 해제하십시오.
2. 재배치+iframe 경로에서는 `1119`의 즉시 해제를 제거하고 실제 미리보기 self-draw 완료 신호 뒤 해제하십시오. 단순 iframe `load`는 문서 로드 시점일 뿐 내부 `drawPreview` 완료와 동치가 아닙니다.
3. 순서 무변경 경로에서는 `fnWs20LoadPreview`가 완료 Promise를 반환하도록 계약을 보강하고 이를 await/finally한 뒤 해제하십시오.
4. 완료 신호 미도달 안전장치는 오래된 작업이 후속 작업의 잠금을 해제하지 않도록 세대별 소유권을 확인해야 합니다.

## 독립 재검수 취합 (2026-08-21)

사용자 요청에 따라 두 독립 서브에이전트가 재배치 경로와 무변경 재로드 경로를 각각 반박 관점으로 검증했습니다. 결론은 **P1 2건과 P2 1건 모두 유지**입니다.

### 재배치 경로

- `1119`의 즉시 `_unlock()`과 `1111`의 지연 `_unlock()`이 같은 정상 실행에서 모두 도달한다는 점이 재확인됐습니다.
- 잠금 구현은 참조 카운트나 소유권이 없는 단일 전역 상태입니다. `setShortcutLock`은 `ws_html5_ws20_attr.js:313`~`315`에서 boolean을 직접 대입하고, busy도 `parent.setBusy("X"/"")`를 직접 호출합니다. 따라서 지연된 두 번째 OFF가 후속 작업의 ON을 해제할 수 있습니다.
- 더 중요한 보강 근거로, iframe `load`는 실제 미리보기 완료 신호가 아닙니다. `www/ws30/ws10_20/design/preview/index.js:9936`에서 `_loaded=true`를 먼저 설정한 뒤 `9996`에서 `await drawPreview()`하고, 이후 `10015`에서 ROOT 선택을 시작합니다. 브라우저 `load` 이벤트는 async 초기화 함수의 이 await 완료를 기다리는 계약이 없습니다.
- 따라서 `1119`만 삭제해도 `load` 시점의 `_unlock()` 및 `__ws20PrevReloading=false`가 self-draw/ROOT 복원보다 먼저 실행될 수 있습니다. BR49 재진입 경쟁을 완전히 막으려면 preview 내부의 실제 성공·실패 완료 신호가 필요합니다.
- 반대로 load 미발생·로드 실패 때는 영구 잠금 위험이 있으므로, 완료 신호에는 실패 회수와 세대별 watchdog이 함께 필요합니다.

### 순서 무변경 재로드 경로

- `fnWs20LoadPreview()` 진입 후 `__ws20PrevBooting=true`와 `_ws20EngagePrevBusy()`는 동기 실행됩니다. 이어 `_ws20EngagePrevBusy`가 `fnSetBusyLock("X")`, 최종적으로 같은 `parent.setBusy("X")`를 호출합니다.
- 호출부 `1128`의 `_unlock()`은 이 내부 busy를 즉시 OFF로 덮습니다. 실제 완료는 원본 `loadPreviewFrame`의 `drawPreview().then(...)`과 `ws_html5_ws20_prev.js:1468`~`1471`의 선택 Promise `finally` 이후입니다.
- `_bPrevBusyOn`은 즉시 해제와 무관하게 true로 남으므로, 실제 완료 때 `_ws20ReleasePrevBusy()`가 다시 `parent.setBusy("")`를 호출합니다. 그 사이 다른 작업이 건 busy를 끌 수 있다는 두 번째 소유권 경합도 재입증됐습니다.

### 재검수 최종 판정

**수정필요 유지 — P1 2건, P2 1건.** 단순히 `1119` 한 줄만 삭제하는 수정으로는 부족하며, 두 재로드 경로 모두 실제 preview 완료/실패를 반환하는 단일 Promise 또는 메시지 계약과 세대별 once-unlock이 필요합니다.
