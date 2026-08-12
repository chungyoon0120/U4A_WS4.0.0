# 02_audit_codex — BR19 UI 추가 팝업 BUSY 미해제

## 판정

**수정필요**

원본의 `!is_tree`, Aggregation 없음, 정상 `afterOpen` 해제 의도를 HTML5 경로에 복원한 방향은 맞다. 그러나 정상 열림의 해제 시점이 WP1의 “화면 렌더 완료 후”를 보장하지 않고, 팝업 구성 중 오류에서는 해제 코드에 도달하지 못한다.

## 지적

### 1. 단일 `requestAnimationFrame`은 페인트 완료 후가 아니라 페인트 직전에 실행됨

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1558`
- 문제: `requestAnimationFrame` 콜백은 다음 화면 갱신의 페인트 전에 실행된다. 따라서 현재 코드는 `lf_renderTable()`의 DOM 변경이 실제 화면에 그려지기 전에 `_releaseBusyLock()`을 호출할 수 있으며, 주석과 요청서의 “화면에 반영된 다음 프레임에 해제”를 보장하지 않는다. 또한 포커스는 별도의 `setTimeout(..., 0)`으로 예약되어 있어 1558행의 해제가 포커스 완료 뒤라는 순서도 보장되지 않는다.
- 근거: `ws_html5_ws20_edit.js:1551-1558`; `.claude/rules/code.md`의 “화면 렌더·데이터 구성·전환이 완전히 끝난 뒤 busy off” 및 완료 콜백/Promise 원칙; 원본 `insertUIPopop.js:58-68`의 `attachAfterOpen`.
- 영향: 빠른 재입력 가능 시점이 실제 팝업 열림 완료보다 앞당겨져 WP1이 방지하려는 연타·상태 꼬임이 재발할 수 있다.

### 2. 팝업 구성 예외 경로는 BUSY/단축키 해제를 보장하지 않으며 해제 실패도 조용히 삼킴

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1192`
- 문제: `_releaseBusyLock()`은 명시된 두 조기 반환과 1558행 예약 콜백에서만 호출된다. Aggregation 확인을 통과한 뒤 다이얼로그 생성, 공통 UI 배선, DOM append, `lf_renderTable()` 중 예외가 발생하면 해제 예약에 도달하지 못해 우클릭 진입에서 켠 BUSY와 단축키 잠금이 남는다. 더불어 새 헬퍼의 두 `catch`가 오류를 아무 기록 없이 삼켜 실제 해제 실패도 은폐한다.
- 근거: `callDesignContextMenu.js:15-26`; `ws_html5_ws20_edit.js:1192-1194`, `1205-1558`; `.claude/rules/code.md`의 “busy on이면 오류를 포함한 모든 종료 분기 off” 및 “오류 삼킴·조용한 catch 금지”.
- 영향: BR19의 원래 증상과 동일한 영구 BUSY가 오류 상황에서 남으며 원인 로그도 확보할 수 없다.

## 확인된 정상 항목

- `ws_html5_ws20_edit.js:1196`: `!is_tree`에서 단축키와 로컬 BUSY를 해제하며 원본 `uiDesignArea.js:6570-6580`과 대응한다.
- `ws_html5_ws20_edit.js:1197-1203`: Aggregation 없음 경고 후 해제하며 원본 `insertUIPopop.js:17-26`과 대응한다.
- `callDesignContextMenu.js:15-26`, `386-395`: 미리보기 우클릭 진입의 로컬 BUSY/단축키 잠금과 `_showInsertPopup` 수렴을 확인했다.
- `ws_html5_ws20_tree.js:555-561`: 트리 `+` 경로는 별도 BUSY ON 없이 같은 `designUIAdd`로 수렴한다. 현재 `setBusy`가 깊이 카운터가 아닌 상태값이므로 정상적인 사용자 클릭 흐름에서 OFF 호출 자체는 멱등적으로 동작한다.
- 확정 처리의 `_broadBusy`는 자식창 방송 계약이고 이번 `_releaseBusyLock`은 우클릭 진입의 로컬 `parent.setBusy` 해제이므로 역할이 구분된다.
- 대상 파일은 `node --check`를 통과했다.

## 제안

1. 팝업 열림 완료를 명시적으로 알리는 Promise/콜백을 두고, DOM 부착·테이블 렌더·초기 포커스·첫 페인트 완료 후 한 곳에서 해제한다. 페인트 경계만 최소 보장할 경우 단일 rAF가 아니라 이 프로젝트에서 사용하는 완료 신호 또는 검증된 이중 rAF 패턴을 적용한다.
2. Aggregation 확인 이후의 팝업 구성 전체를 오류 정리 경로로 보호하고, 성공 시에만 정상 열림 완료 해제를 예약한다. 오류 시 생성한 backdrop/dialog/listener도 함께 정리한다.
3. `_releaseBusyLock`의 조용한 `catch`를 제거하거나 오류 코드와 함께 표면화한다.
4. BR19-1~4 실화면 테스트에 더해 `lf_renderTable` 또는 공통 다이얼로그 배선 실패를 강제로 발생시켜 BUSY·단축키·부분 생성 DOM이 모두 정리되는지 확인한다.

## 실화면 검증 상태

`.works/UI추가팝업/00_현황판.md`의 BR19-1~4가 모두 미테스트(`☐`)이므로 동적 동작은 아직 통과로 판정할 수 없다.
