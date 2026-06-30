# Web Security 팝업 HTML5 최종 검증

- 대상 케이스: `web-security-popup`
- 최종 판단일: 2026-06-30
- 코드 수정 여부: Codex 수정 없음
- 검증 기준:
  - `01_codex-audit.md`
  - `02_claude-response.md`
  - `03_codex-recheck.md`
  - 현행 `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`

## 최종 결론

이 케이스는 감사 프로세스상 완료로 판단한다.

Claude 답변과 실제 조치 내용을 대조한 결과, 수정된 항목은 기존 동작을 크게 흔들지 않는 방어 정규화와 주석 정정에 한정되어 있다. Codex 재검토 기준으로 치명적인 잔여 결함은 발견되지 않았다.

## 완료 판단 근거

### 반영 완료

- XFO가 M03이 아닐 때 저장 시 `WHIT`을 빈 배열로 정규화
- dialog 캐시/재사용 관련 주석을 공통 `.u4a-dialog` close 후 DOM 제거 정책에 맞게 정정

### 수정 제외 수용

- ACA M03의 External Host URL은 원본/사용자 확인 기준으로 필수 검증을 추가하지 않음
- XFO M03 White List 부분행 저장 지적은 Codex의 최초 코드 해석 오류로 폐기
- 기본값과 동일 저장 시 `setAppChange("X")` 호출은 자매 팝업과 같은 전역 정책으로 보고 단독 수정하지 않음
- dialog 크기 `min(94vw, 640px)` / `min(88vh, 660px)`는 반응형 clamp로 수용

## 검증 결과

- `node --check www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`: 통과
- 정적 리뷰:
  - XFO M03일 때 White List는 SID/SRC가 모두 채워진 행만 보존
  - XFO M03이 아닐 때 `WHIT: []` 정규화 정상
  - close 후 재오픈 시 공통 정책상 dialog가 재생성되는 흐름과 주석이 일치
  - 공통 자산 수정 없음

## 잔여 권고

실제 실행 환경에서는 아래 수동 확인을 권장한다.

1. Web Security 팝업 열기/닫기/재오픈
2. XFO M03 White List Add/Delete/Save
3. XFO를 M03 외 값으로 저장했을 때 `WHIT`이 비워지는지 확인
4. 편집/조회 모드에서 Save/Delete 버튼 노출 여부 확인

위 항목은 정적 검토에서 구조상 문제를 찾지 못했으나, 실제 WS20 데이터와 UI 상태가 얽히는 동작이므로 사용자 환경 확인이 가장 확실하다.

## 이관 판단

감사 보고, Claude 답변, Codex 재검토, 최종 검증 기록이 모두 작성되었으므로 `.audit/history/web-security-popup/`로 이관한다.
