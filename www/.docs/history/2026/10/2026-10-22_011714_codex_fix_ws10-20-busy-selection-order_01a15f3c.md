# WS20 선택 DOM 변경과 Busy 종료 순서 정비

## 요청
- fnWs20SelectUI의 기존 finally Busy 종료 이후 미리보기 선택으로 DOM이 바뀌는 순서를 바로잡는다.
- 미리보기 선택 → Busy 종료 → 실제 닫힘 대기 → attribute 입력 focus 순서를 유지한다.
- drop_cb 마지막의 designDragEnd를 setSelectTreeItem보다 먼저 수행한다.
- 다른 개발자가 수정 이유와 패턴을 이해하도록 주석, 백업, 이력을 남긴다.

## 변경 내용
- fnWs20SelectUI 정상 경로: tree/attribute 갱신 → 바인딩 선택 → await selPreviewUI → 화면 위치 보정/테두리 보정 요청 → BUSY_OFF 방송/shortcut 해제/parent.setBusy("") → await _waitBusyClosed → setAttrFocus.
- 기존 finally를 제거하고 함수 내부 _endSelectionBusy로 기존 해제 묶음을 공유한다. 새 전역 등록은 없다.
- 대상 미발견은 정리 후 return, 예상 밖 예외는 정리/영문 오류 로그 후 원래 예외를 다시 throw한다. 미리보기 예외의 기존 warn 후 진행 방식과 bSkipBusy 가드를 유지한다.
- _waitBusyClosed 설명과 상한 로그를 실제 용도인 attribute focus 대기로 정비한다. 미리보기는 마지막이라는 인접 주석도 정정한다.
- drop_cb의 마지막 정상 이동 경로: await designRefershModel → designDragEnd → await setSelectTreeItem → 기존 변경 표시/완료 안내/바인딩 갱신.
- 변경 주석에 2026-10-22 Codex와 원인, 순서를 유지해야 하는 이유를 기록한다.

## 변경 파일
### 변경
- www/ws30/ws10_20/js/ws_html5_ws20_attr.js
- www/ws30/ws10_20/js/ws_html5_ws20_dnd.js
### 추가
- www/ws30/ws10_20/js/_backup_20261022011714_busy-selection/ws_html5_ws20_attr.js (수정 직전 원문)
- www/ws30/ws10_20/js/_backup_20261022011714_busy-selection/ws_html5_ws20_dnd.js (수정 직전 원문)
- 본 작업 이력 파일
### 삭제
- 없음

## 변경 이유
- 기존에는 Busy 종료/닫힘 대기/attribute focus 이후 selPreviewUI가 실행되어 선택 표시 DOM 변경이 Busy 종료 뒤에 발생했다.
- 미리보기 선택을 Busy 종료 앞으로 옮기고 attribute focus는 실제 닫힘 뒤에 유지해야 modal inert 상태로 인한 focus 무시를 피한다.
- designDragEnd는 tree의 drag 허용 상태와 잔상 스타일, 미리보기 잔상을 정리한다. setSelectTreeItem이 Busy를 종료하기 전에 이 DOM 변경을 수행해야 한다.
- finally를 단순 삭제하면 대상 미발견/예외에서 Busy가 남으므로 해당 종료 갈래의 해제 책임을 명시적으로 보존했다.

## 영향 범위
- fnWs20SelectUI 직접 호출(tree 및 preview fallback), setSelectTreeItem wrapper, 편집 _selectNode를 경유하는 선택 동작에 새 순서가 적용된다.
- setSelectTreeItem은 선택 함수의 Promise를 반환하므로 await 호출자는 focus까지 완료 후 계속 진행한다.
- 현재 js 범위에서 bSkipBusy 실제 전달은 발견되지 않았으나 옵션 계약은 유지한다.
- DnD는 요청된 drop_cb 마지막 이동 경로만 변경한다. 다른 이동/복사, 모델/Undo, 서버 저장, 공통 Busy 및 preview 내부 구현은 변경하지 않는다.

## 검증
- node --check: 두 변경 JS 모두 통과.
- 실제 fnWs20SelectUI를 추출한 Node vm 격리 테스트 7개 통과: 정상, 대상 미발견, attribute 갱신 예외, preview 예외, preview 미로드, bSkipBusy, 빈 OBJID.
- 지연 Promise로 preview 완료 전 Busy OFF 없음, Busy 닫힘 대기 완료 전 focus 없음 확인.
- 정상 호출 순서: on → preview → previewDone → align → reassert → off → wait → closed → focus.
- 대상 미발견/attribute 예외에서 Busy 종료 1회, bSkipBusy/빈 OBJID에서 내부 Busy 종료 없음 확인.
- DnD 마지막 designDragEnd → await setSelectTreeItem 순서 정적 검사 통과.
- 실행 중 Electron/CDP 실제 DOM/입력 focus/drag 동작은 미검증. 격리 테스트 결과를 실제 화면 검증으로 간주하지 않는다.
- 실제 화면 후속 확인: tree UI 선택, 화면 밖 UI 선택 스크롤, UIATK 지정 입력 focus, DnD 이동 후 잔상 제거 및 Busy 종료 시점.

## 참고 사항
- www/README.md는 없음. www/.docs/CURRENT.md는 제목만 있는 빈 현황이며 이전 완료/진행 상태 정보가 없었다. 변경하지 않았다.
- 상위 AGENTS.md, www/.docs/README.md, 상위 .analy 개요/작업 가이드/디자인 영역/공통 UX/테마 관련 규칙, .works 로그/오류 처리 규칙 및 Busy 관련 이전 이력을 참고했다.
- 기존 원본 순서 설명과 이번 요청이 다르므로 이번 사용자 지시를 적용하고 현재 소스 주석에 변경일과 이유를 기록했다.
- 소스 수정 전에 _ 접두 백업 폴더에 두 파일을 보존했다. 현재 www Git은 대상 소스를 미추적으로 표시하므로 HEAD diff 대신 백업과 비교했다. 커밋/푸시 없음.
- pes-work-checklist 조회는 전용 Notion 토큰 미등록으로 실패했다. 외부 쓰기/토큰 등록 없음.
- 기존 _reassertPreviewSelection은 requestAnimationFrame 후속 작업을 예약하며 완료 Promise가 없다. 이번 작업은 선택 호출과 보정 요청을 Busy 종료 앞으로 옮겼지만 모든 지연 DOM 변경 종료까지 보장하는 변경은 아니다. 실제 화면에서 별도 확인 필요.
- 현재 preview fn_mark는 Busy 중에도 scrollIntoView(nearest)로 위치 이동하고 선택 표시를 갱신한다. focus 차단 시 실제 스크롤/표시 동작은 runtime 회귀 확인 대상이다.
- 기존 _waitBusyClosed 6초 상한 후 진행 정책은 유지했다. 상한 발생 시 focus 성공을 보장하지 않는다.
