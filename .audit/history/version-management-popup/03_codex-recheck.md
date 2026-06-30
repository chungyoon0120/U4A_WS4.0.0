# Version Management 별도창 조치 재검토

- 재검토 대상:
  - `.audit/active/version-management-popup/02_claude-response.md`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.html`
  - `www/ws30/ws10_20/Popups/versionMng/versionMngFrame.css`
- 재검토 관점: Claude 답변과 실제 변경 내용의 일치 여부, 기존 감사 항목 조치 여부, 신규 리스크 여부
- 코드 수정 여부: 없음

## 결론

Claude가 수정 대상으로 제시한 3건은 코드 기준으로 모두 반영되어 있다.

다만 Claude 답변의 "versionMng 전용 파일 1개만 수정"이라는 실행 결과 설명은 실제 diff와 다르다. 실제 변경 파일은 `versionMngFrame.js`, `versionMngFrame.html`, `versionMngFrame.css` 3개다.

HTML/CSS 변경은 Busy 오버레이를 공통 `.u4a-busy` 구조로 바꾸는 내용이며, 현재 확인 범위에서는 즉시 결함으로 볼 만한 문제는 발견하지 못했다. 단, 최초 감사에서 합의된 3건 외 변경이므로 최종 기록에는 "추가 변경 있음"으로 남기는 것이 맞다.

## 항목별 재판단

### P1. Target 라디오 미추가

- Claude 판단: 이의 있음, 수정 불필요
- Codex 재판단: Claude 반박 수용
- 확인 결과:
  - 현행 `versionMngFrame.js` 기준 Target 라디오는 `oLblT.appendChild(oRdT); oLblT.appendChild(oSpT);`로 정상 append된다.
  - `oCmpBox.appendChild(oLblT)`도 존재한다.
- 결론: 최초 감사의 P1은 현행 코드 기준 폐기한다.

### P2. 최초 IF 데이터 미수신 시 busy/본문 고착

- Claude 판단: 부분 동의, watchdog 추가 권장
- 조치 확인:
  - `iOpenWatch` 타이머가 추가되었다.
  - `load` 후 20초 내 `if-vermng-info`가 오지 않으면 `_fatal("E", ...)`로 안내 후 창 닫기 흐름을 탄다.
  - 정상 오픈 시 `_finishOpen()`에서 `clearTimeout(iOpenWatch)`가 수행된다.
- 결론: 조치 적정.
- 잔여 리스크:
  - 실제 미수신 상황은 강제 재현이 필요하다.

### P2. BroadcastChannel 미close

- Claude 판단: 동의, 수정 권장
- 조치 확인:
  - `onbeforeunload`의 `if (bBusy) { return false; }` 가드 이후 `oBroad.onmessage = null`, `oBroad.close()`, `oBroad = null` 처리가 추가되었다.
  - busy 중 닫기 취소 경로에서는 채널을 닫지 않으므로 순서가 적절하다.
- 결론: 조치 적정.

### P3. 재비교 시 이전 diff 잔상

- Claude 판단: 동의, 수정 권장
- 조치 확인:
  - `_onCompare()`에서 `_setBusy(true)` 직후 `vmDiffHostWrap`의 `u4aVmHostShown` class를 제거한다.
  - 새 비교 데이터 전송 후 기존 로직에서 다시 `u4aVmHostShown`을 추가한다.
- 결론: 조치 적정.

### P3. Yes/No/OK 하드코딩

- Claude 판단: 전역 정책 이슈, versionMng 단독 수정 불필요
- Codex 재판단: 수용
- 결론: 이번 케이스에서는 수정 대상 제외가 타당하다.

### P3. CSS 고정 rem 폭

- Claude 판단: 원본 테이블 폭 이식 + 가로 스크롤 설계, 수정 불필요
- Codex 재판단: 수용
- 결론: 이번 케이스에서는 수정 대상 제외가 타당하다.

## 추가 확인: Busy 공통화 변경

Claude 답변의 최종 실행 결과에는 `versionMngFrame.js`만 수정했다고 적혀 있지만, 실제 diff에는 아래 변경도 포함되어 있다.

- `versionMngFrame.html`: 기존 `#vmBusy hidden` + 전용 spinner 구조를 공통 `.u4a-busy` 구조로 변경
- `versionMngFrame.css`: 전용 busy overlay/spinner 스타일 제거
- `versionMngFrame.js`: `_setBusy()`가 `hidden` 대신 `data-busy`와 `.u4a-busy__label`을 제어

확인 결과:

- 공통 `.u4a-busy` 스타일은 `www/ws30/ws10_20/theme/shell.css`에 존재한다.
- `data-busy="true"`일 때 표시되고, 기본 상태에서는 opacity/visibility/pointer-events로 숨겨진다.
- `versionMngFrame.html`은 `shell.css`를 로드하므로 공통 busy 구조 사용 자체는 가능하다.
- `ServerList_v2`에서도 유사하게 `document.body.style.pointerEvents`와 `.u4a-busy[data-busy]`를 함께 사용한다.

재판단:

- 즉시 수정이 필요한 신규 결함은 발견하지 못했다.
- 다만 이 변경은 최초 감사의 3개 권장 조치에는 없던 범위이므로, Claude 보고서의 수정 파일 목록은 부정확하다.
- 최종 완료 전 실제 화면에서 busy 표시/해제, 클릭 차단, 창 닫기 차단을 한 번 확인해야 한다.

## 검증 결과

- `node --check www/ws30/ws10_20/Popups/versionMng/versionMngFrame.js`: 통과
- 정적 코드 리뷰:
  - Target 라디오 DOM append 정상
  - watchdog 정상 수신 시 clear 처리 존재
  - BroadcastChannel close 순서 적정
  - 재비교 시 host shown class remove/add 순서 적정
  - 공통 busy CSS 참조 존재

## 최종 판단

현재 조치 상태는 조건부 수용 가능하다.

최종 완료 처리 전 사용자 환경에서 아래 4가지를 실제로 확인하면 된다.

1. Version Management 창 정상 오픈 후 목록 표시
2. Base/Target 선택 후 비교 실행
3. 다른 버전으로 재비교 시 이전 diff 잔상 미노출
4. busy 중 입력/닫기 차단 및 busy 해제 후 조작 정상

위 동작 확인까지 완료되면 이 케이스는 `.audit/history/version-management-popup/`로 이관해도 된다.
