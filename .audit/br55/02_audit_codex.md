# BR55 Codex 검수 결과

## 판정

**수정필요**

`chkExcepionAttr` 실패를 fail-closed로 바꾼 핵심 수정은 타당합니다. 그러나 `fnMultiFooterMsg` 실패 회수는 동기 throw만 처리하며, 실제 BrowserWindow 로드 실패와 이미 방송한 자식창 busy를 회수하지 못합니다. 오류가 있는 앱의 활성화는 막히지만 WS20 또는 자식창이 영구 잠길 수 있습니다.

## 지적

### 1. [P1] 오류 목록 창의 비동기 load 실패는 새 catch에 잡히지 않아 WS20 busy가 영구 잔존한다

- 위치: `www/ws30/ws10_20/js/ws_events.js:1554`~`1566`; `www/ws30/ws10_20/js/fnDialogPopupOpener.js:2819`~`2947`
- BR55는 `oAPP.fn.fnMultiFooterMsg(T_excep)`를 동기 `try/catch`로 감쌉니다. 하지만 `fnMultiFooterMsg`는 Promise를 반환하지 않고 `oBrowserWindow.loadURL(sLoadUrl)`도 await/catch하지 않습니다. `did-fail-load`, `render-process-gone`, load Promise rejection 처리도 없습니다.
- 정상 busy 해제는 오류창 내부 `Popups/errMsgPopup/index.js:281`~`282`가 본문 로드 완료 후 `SETBUSYLOCK` IPC를 보내는 데 의존합니다. 메인 frame 또는 내부 index 로드가 실패하면 이 신호가 오지 않습니다.
- 따라서 잘못된 URL, 파일 누락, renderer load 실패 같은 비동기 실패는 `WS20ACT-CHK02` catch에 도달하지 않고 `fnSetBusyLock("X")`가 유지됩니다. 사용자는 오류 목록도 보지 못하고 WS20도 다시 조작할 수 없습니다.
- 요청서가 고치려는 “오류 목록 표시 실패 시 busy 고착”의 대표적인 실패 수명주기가 그대로 남아 있으므로, 동기 호출 예외만 표면화한 것으로는 수용 기준을 충족하지 못합니다.

### 2. [P1] 동기 표시 실패를 잡아도 자식창 BUSY_ON을 되돌리지 않아 다른 창이 잠긴다

- 위치: `www/ws30/ws10_20/js/ws_events.js:1562`~`1566`; `www/ws30/ws10_20/js/fnDialogPopupOpener.js:2822`~`2826`; `www/ws30/ws10_20/js/broadcast/ws_fn_broad.js:42`~`45`
- `fnMultiFooterMsg`는 진입하자마자 본창 busy를 켜고 `oAPP.attr.oMainBroad.postMessage({PRCCD:"BUSY_ON"})`으로 모든 자식창도 잠급니다. 이후 BrowserWindow 생성·설정 중 동기 예외가 발생하면 BR55 catch로 돌아옵니다.
- catch는 `oAPP.common.fnSetBusyLock("")`만 호출합니다. 대응하는 `oMainBroad ... BUSY_OFF`가 없어 이미 BUSY_ON을 받은 바인딩·편집기 등 자식창은 계속 잠긴 상태로 남습니다.
- 화면 안내 실패까지 로깅하는 것은 좋지만 잠금 소유권 전체를 회수하지 못하므로 “busy/Lock 짝”이 완성되지 않았습니다. 오류 목록 opener가 켠 본창/자식창 busy를 하나의 idempotent cleanup에서 함께 내려야 합니다.

## 정상 확인 사항

- `chkExcepionAttr`가 미정의이거나 동기 throw하면 catch에서 본창 busy를 해제하고 즉시 return하므로 `/save_active_appdata#active`, `fnChildWindowShow(false)`, 활성 상태 갱신에 도달하지 않습니다.
- 점검 성공·오류 0건은 기존 활성화 경로로 진행합니다.
- 오류 N건이며 오류 목록 창이 정상 로드되면 기존처럼 busy를 유지한 채 return하고, 오류창의 로드 완료 IPC가 본창 busy를 해제합니다.
- `fnMultiFooterMsg` 자체가 호출 전에 미정의이거나 진입 즉시 throw하는 경우에는 CHK02 안내와 본창 busy 해제가 수행됩니다.
- 내부 예외 원문은 콘솔에만 남고 화면에는 추적 코드만 표시해 BR51에서 채택한 임시 패턴과 일치합니다. 정식 메시지 번호가 지정되면 메시지 함수로 교체해야 합니다.
- `fnChildWindowShow(false)`의 빈 catch는 점검 성공 후 경로이며 BR55의 검증 우회와 직접 연결되지는 않습니다.
- `node --check www/ws30/ws10_20/js/ws_events.js` 및 `git diff --check -- www/ws30/ws10_20/js/ws_events.js` 통과.

## 제안

1. `fnMultiFooterMsg`가 창 준비 완료/실패를 나타내는 Promise를 반환하도록 하고, `loadURL()` rejection과 `did-fail-load`, `render-process-gone`, 초기 `closed`를 한 번만 처리하는 cleanup을 두십시오.
2. cleanup은 본창 `fnSetBusyLock("")`와 `oMainBroad BUSY_OFF`, 생성된 BrowserWindow/IPC listener 정리를 함께 수행해야 합니다.
3. `ev_pressActivateBtn`은 이 Promise를 await하고, 정상 로드일 때만 오류창이 인수한 busy 해제 계약을 유지하십시오.
4. 테스트에는 `loadURL` reject, BrowserWindow 생성 직후 throw, ready 전 closed, 정상 오류 목록 로드 네 경로를 포함하십시오.

## 독립 재검수 취합 (2026-08-31)

사용자 요청에 따라 두 서브에이전트가 기존 지적을 반박하는 방향으로 오류창 수명주기와 Activate 전체 진입 경로를 각각 독립 검증했습니다.

- **P1 두 건 모두 유지:** `fnMultiFooterMsg`는 본창 busy와 자식창 `BUSY_ON`을 먼저 수행한 뒤 Electron 14의 Promise형 `loadURL()` 반환을 버리고, `did-fail-load`·`render-process-gone`·ready 전 `closed`를 처리하지 않습니다. 동기 throw도 CHK02가 본창 busy만 내리고 방송 잠금은 회수하지 않습니다.
- **실패 범위 보강:** 정상 해제는 외부 오류창의 `did-finish-load` 후 내부 iframe에 `index.html`을 넣고, 그 내부 `DOMContentLoaded`가 `setBusy(false)`와 `SETBUSYLOCK`을 보내는 데 의존합니다. 따라서 외부 main load뿐 아니라 내부 iframe load·렌더 초기화 실패도 동일한 본창/자식창 고착을 만듭니다.
- **추가 blocker 없음:** 정상 활성화, 오류 0건, 오류 N건의 정상 창 로드, 점검 throw, CTS 재호출, Ctrl+F3 경로에서는 별도 BR55 회귀가 발견되지 않았습니다. CTS는 기존 busy를 해제한 뒤 Activate를 새로 호출하며, 단축키도 같은 버튼 click 경로를 사용합니다.
- CHK01은 오류창 `BUSY_ON` 이전 단계이므로 현재 본창 busy 해제만으로 재시도가 가능하며 별도 자식창 cleanup이 필요하지 않습니다.

### 재검수 최종 판정

**수정필요 유지 — P1 2건(비동기 외부·내부 로드 실패 회수 부재, 동기 실패의 자식창 BUSY_OFF 누락).**
