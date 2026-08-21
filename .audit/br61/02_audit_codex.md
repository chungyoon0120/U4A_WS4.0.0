# BR61 Codex 검수 결과

## 판정

**통과 (필수 수정 0건, T01 선행 의존 조건부)**

붙여넣기 불가 결과를 버리던 호출측 cancel callback이 원본과 같은 KIND 10/20 규칙으로 `RTMSG`를 표시하고, 순서변경형 `param === undefined` 경로의 269 메시지를 올바른 `/U4A/MSG_WS` 클래스에서 조회한다. 성공·선택·취소·잠금 해제 흐름에는 회귀가 없다.

## 검증 결과

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 후보 0 결과 전달 | 통과 | `aggrSelectPopup`은 후보가 없고 cancel callback이 있으면 `{RETCD:"E", RCODE:"02", RTMSG}`를 전달하고 자체 메시지는 띄우지 않는다(`ws_html5_ws20_dnd.js:477~485`). 원본 책임 분리와 일치한다. |
| 호출측 안내 복원 | 통과 | `fnWs20AddTreeData` cancel callback이 `RETCD === "E"`일 때 `RCODE === "02"`는 KIND 20, 그 외는 KIND 10으로 `sRes.RTMSG`를 표시한다(`1056~1069`). 원본 `callDesignContextMenu.js:1421~1439`와 동일하다. |
| 269 메시지 클래스 | 통과 | `param === undefined`는 `_msg("/U4A/MSG_WS", "269")`를 KIND 10으로 표시한다(`dnd.js:1023~1031`). 원본 `callDesignContextMenu.js:1107~1108`, `uiDesignArea.js:6244~6245`와 일치한다. |
| 선택 popup 취소 | 통과 | 닫기·X·ESC는 한 번만 실행되는 `_cancel`로 모여 `{RETCD:"E", RCODE:"01", RTMSG:/U4A/MSG_WS 001}`을 전달한다(`571~607`). 호출측은 KIND 10 취소 안내 후 정리한다. |
| RETCD 비오류 | 통과 | `RETCD !== "E"`면 메시지를 띄우지 않고 `_done()`만 수행해 원본 방어 조건을 보존한다. |
| 성공 경로 | 통과 | 후보 1개는 즉시 `retfunc`, 2개 이상은 선택 dialog, 확인은 선택된 T_0023으로 `retfunc`를 호출한다(`492~496`, `594~600`). |
| 정리 1회 | 통과 | dialog의 `bDone`과 붙여넣기 호출측 `_bDone`이 중복 취소·확정 및 BUSY_OFF 중복을 막는다(`dnd.js:571~600`, `edit.js:832~845`). |
| showMessage 예외 | 통과 | 안내 호출이 throw해도 catch에서 기록한 뒤 callback 바깥 `_done()`에 도달한다(`1064~1069`). |
| KIND 20 잠금 | 통과 | 원본처럼 `showMessage` 호출 후 정리를 수행한다. KIND 20 dialog는 modal top layer를 유지하고 작업 shortcut/자식창 busy는 정상 해제된다. |
| 적용 범위 | 통과 | tree/preview 붙여넣기와 개인화 pattern drop이 공통 core를 사용한다. cancel callback 없는 일반 D&D·insert popup은 기존 자체 안내를 유지한다. |
| 오류 표면화 | 통과 | `chkAggrRelation`의 001 및 002/003 조회 실패 catch가 `console.error`로 기록된다(`427~429`, `450~457`). RTMSG 부재 시 262 fallback도 남아 있다(`481`). |

## 메시지 클래스 전수 점검

- BR61 대상 269 이외의 `_wsc` 사용처 102, 103, 245, 246, 017, 106, 214를 원본과 대조했다. 모두 원본이 `ZMSG_WS_COMMON_001`에서 조회하므로 추가 클래스 오지정은 없다.
- dialog 취소 001과 후보 없음 fallback 262는 원본처럼 `/U4A/MSG_WS`를 사용한다.
- 구조체 `RTMSG`의 001/002/003은 T01이 `ZMSG_WS_COMMON_002`에서 구성하며 BR61은 내용을 가공하지 않고 표시한다.
- 신규 메시지 키나 하드코딩 문구는 추가하지 않았다.

## 회귀·경계 검토

- 같은 부모·같은 aggregation에서 후보가 0이면 원본처럼 `retfunc(undefined)`로 들어가 269 토스트 후 종료한다. Label→Label 현상의 의도된 안내다.
- 서로 다른 구조로 후보가 전혀 없으면 cancel callback에 RCODE 02와 구체적 RTMSG가 전달되어 KIND 20 알림창으로 표시된다.
- 선택 popup의 사용자 취소는 RCODE 01이므로 KIND 10이며 구조적 실패와 구분된다.
- `showMessage` callback을 기다리지 않고 `_done()`을 실행하지만 원본도 메시지 호출 직후 shortcut/busy를 해제한다. modal dialog가 입력을 계속 차단하므로 회귀가 아니다.
- `chkAggrRelation` 구조체와 RTMSG 생성은 T01 변경이다. 현재 저장소의 `design/js/uiDesignArea.js:1459~1529`는 여전히 배열 반환판이며 `ZMSG_WS_COMMON_002` 001/002/003 생성 구조체판을 로컬 원본에서 확인할 수 없다. 따라서 구조체판 자체를 “현행 원본과 1:1”이라고 BR61에서 독립 보증할 수 없으며, T01이 별도로 승인·유지된다는 전제에서만 BR61이 통과한다. T01이 철회되거나 배열 반환으로 돌아가면 BR61도 재검수가 필요하다.

## 독립 재검수 취합

두 서브에이전트가 메시지 계약과 lifecycle을 나눠 기존 통과 판정을 반박 검증했으며, 모두 **BR61 순증분의 필수 결함 0건, T01 유지 조건부 통과**로 결론 냈다.

- 메시지 검수는 후보 0의 RCODE 02, 선택 취소의 RCODE 01, 같은 부모·aggregation의 `undefined → 269` 경로를 원본 호출측과 재대조했다. BR61 경로에 `_wsc("269")` 잔존이 없고 RTMSG 부재 시 262 fallback도 확인했다.
- lifecycle 검수는 X·닫기·ESC의 `bDone` 단일화, 붙여넣기 `_bDone` latch, 패턴 drop 성공/취소 상호배타, `showMessage` throw 뒤 정리, KIND 20 modal 유지, cancel callback 없는 D&D/insert 및 wizard 무영향을 확인했다.
- 별개 선행 위험으로 `_aggrSelectDialog`가 같은 ID의 기존 dialog를 단순 제거해 기존 operation의 cancel callback을 호출하지 않는 구조가 있으나, 정상 busy/shortcut 경로에서 재진입이 차단되고 BR61 순증분이 만든 회귀가 아니므로 필수 지적에서 제외했다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` 통과
- 원본 cancel 책임 분리, 메시지 클래스, 전체 공통 core 소비처와 정리 callback 재검색 완료
- `_`로 시작하는 백업 파일·폴더는 현행 근거에서 제외

제품 소스는 수정하지 않았다.
