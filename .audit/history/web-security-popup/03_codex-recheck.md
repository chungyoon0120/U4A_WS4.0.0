# Web Security 팝업 HTML5 조치 재검토

- 재검토 대상:
  - `.audit/active/web-security-popup/01_codex-audit.md`
  - `.audit/active/web-security-popup/02_claude-response.md`
  - `www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`
- 코드 수정 여부: Codex 수정 없음
- 검증 관점: Claude 반박 타당성, 실제 조치 반영 여부, 잔여 리스크

## 결론

Claude 답변과 실제 diff를 확인한 결과, 현재 상태는 수용 가능하다.

Codex 최초 감사 중 P1-b(XFO M03 White List 부분행 저장)는 코드 해석 오류였다. 현행 필터는 `SID !== "" && SRC !== ""`인 행만 보존하므로 SID/SRC 중 한쪽만 입력된 부분행은 저장되지 않는다. 이 항목은 폐기한다.

실제 수정은 낮은 우선순위 권장 2건만 반영되었다.

- XFO가 M03이 아닐 때 저장 시 `WHIT`을 빈 배열로 정규화
- dialog 캐시/재사용 관련 주석을 공통 close 정책에 맞게 정정

## 항목별 재판단

### P1-a. ACA M03 EUL 빈값 검증 없음

- Claude 판단: 사실은 맞지만 원본/명세 확인 전 신규 검증 추가 금지
- 추가 답변: 사용자 확인 및 현행 근거 기준으로 EUL은 필수 아님, 원본에 필수 체크 없음으로 종결
- Codex 재판단: 수용
- 결론: 수정 불필요

근거:

- 현행 원본 보존 주석에 EUL required 검증이 없다.
- 자매 CSS/JS Link 팝업은 required 검증이 명시적으로 포팅되어 있으나 Web Security에는 없다.
- Claude 답변에 사용자 확인 완료로 기록되어 있다.

### P1-b. XFO M03 White List 부분행 저장

- Claude 판단: Codex 코드 해석 오류, 부분행은 저장되지 않음
- Codex 재판단: Claude 반박 수용
- 결론: 최초 감사 항목 폐기

확인 결과:

```js
aWhit = aWhit.filter(function (r) {
  return (r.SID || "") !== "" && (r.SRC || "") !== "";
});
```

위 조건은 SID/SRC가 모두 채워진 행만 보존한다. 따라서 SID만 있거나 SRC만 있는 행은 저장되지 않는다.

### P2-a. 기본값과 동일 저장 시 `setAppChange("X")` 무조건 호출

- Claude 판단: 자매 CSS/JS Link 팝업과 같은 전역 정책, 단독 수정 불필요
- Codex 재판단: 수용
- 결론: 이번 케이스에서는 수정 불필요

잔여 메모:

- 기본값과 동일 저장 시 앱 변경 플래그가 켜질 수 있는 것은 맞다.
- 다만 자매 팝업과 동일 정책이므로 Web Security만 바꾸면 정책 불일치가 생긴다.
- 이 이슈는 필요 시 별도 전역 정책 감사로 분리하는 것이 맞다.

### P2-b. XFO가 M03이 아닌데 WHIT 데이터가 남는 경로

- Claude 판단: 동의, 저장 시 방어 정규화 권장
- 조치 확인:
  - `lf_doSave()`에서 `oState.xfo.M03 !== "X"`인 경우 `aWhit = []` 처리 추가
- Codex 재판단: 조치 적정
- 결론: 완료

### P3-a. dialog 캐시 주석 부정확

- Claude 판단: 동의, 주석 정정 권장
- 조치 확인:
  - "단일 캐시", "1회 생성 후 재사용", "캐시 재사용" 표현이 공통 close 후 재생성 정책에 맞게 수정됨
- Codex 재판단: 조치 적정
- 결론: 완료

### P3-b. 고정 px

- Claude 판단: `min(94vw, 640px)` / `min(88vh, 660px)`는 반응형 clamp이며 수정 불필요
- Codex 재판단: 수용
- 결론: 이번 케이스에서는 수정 불필요

## 검증 결과

- `node --check www/ws30/ws10_20/js/fnWebSecurityPopupOpen.js`: 통과
- 정적 리뷰:
  - XFO M03일 때 White List 부분행 제거 정상
  - XFO M03이 아닐 때 저장 시 `WHIT: []` 정규화 정상
  - dialog close 후 재생성 정책 주석 정정 완료
  - 공통 자산 수정 없음

## 최종 판단

현재 조치 상태는 수용 가능하다.

다만 실제 화면 동작은 사용자 환경에서 아래 항목을 확인하면 좋다.

1. Web Security 팝업 열기/닫기 후 재오픈 시 상태가 현재 `S_WSO` 기준으로 다시 로드되는지
2. XFO M03에서 White List 부분 입력 행이 저장 시 제거되는지
3. XFO를 M03 외 값으로 저장하면 `S_WSO.WHIT`이 빈 배열로 정규화되는지
4. Save/Delete/Close 버튼이 편집 모드와 조회 모드에서 의도대로 보이는지

위 확인까지 완료되면 이 케이스는 `04_final-verification.md` 작성 후 `history`로 이관 가능하다.
