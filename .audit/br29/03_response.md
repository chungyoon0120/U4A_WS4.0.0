# 03_response — BR29 검수 결과 반영·해명

## 요지
코덱스·안티 **두 검수 모두 "통과"**, **필수 지적 0건**. 공통 잔여 참고 1건(확인 콜백에서
`designRefershModel()` 완료를 기다리지 않음)은 **원본 1:1(원본은 await)에 더 부합**하고 저위험이라 **반영**.

## 지적 통합 표

| # | 검수 항목 | 검수자 | 판정 | 처리 |
|---|---|---|---|---|
| 1 | 원본 대상 키·분기 일치(3종 autoGrowing / 9개 이벤트 키) | 코덱스·안티 | 통과 | — |
| 2 | 메시지 283 사용(기존 메시지 클래스 조회) | 코덱스 | 통과 | — |
| 3 | true 선택 시 확인창 호출(이벤트 유무 무관) | 코덱스·안티 | 통과 | — |
| 4 | 확인 시 서버·클라 이벤트 초기화(UIATV/ADDSC/T_CEVT/_T_0015) | 코덱스·안티 | 통과 | — |
| 5 | 대상 이벤트 입력·아이콘 잠금(edit/icon1_visb/icon2_visb=false) | 코덱스·안티 | 통과 | — |
| 6 | 취소 시 false 복귀·잠금 해제 | 코덱스·안티 | 통과 | — |
| 7 | 재진입 확인창 무한루프 방지(bSkipAutoGrow) | 코덱스·안티 | 통과 | — |
| 8 | Undo 중복 적재 방지 + 단일 스냅샷 복원(_T_0015+T_CEVT) | 코덱스·안티 | 통과 | — |
| 9 | UI 재선택·재오픈 시 잠금 유지(무인자 예외처리 호출) | 코덱스 | 통과 | — |
| 10 | BUSY·단축키·자식창 잠금 대칭(early return/정상/예외 전 경로) | 코덱스·안티 | 통과 | — |
| 11 | 원본 KEEP-UI5 무수정 | 코덱스·안티 | 통과 | — |
| 12 | 구문 검사(node --check) | 코덱스 | 통과 | — |
| 13 | 확인 콜백에서 `designRefershModel()` Promise 미await(향후 rejection 미포착·원본 await 계약과 어긋남) | 코덱스·안티(잔여참고, 결함 아님) | **반영** | 콜백을 `async` 로 바꾸고 `await oAPP.fn.designRefershModel()` — 완료 대기 + rejection 을 콜백 try/catch 로 표면화. 원본(uiAttributeArea.js:3166·3183 `await designRefershModel()`)과 동일 계약. |

## 반영 내역
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - 확인 팝업 콜백 시그니처 `function (param)` → `async function (param)`.
  - `oAPP.fn.designRefershModel();` → `await oAPP.fn.designRefershModel();` (콜백 try 안 → rejection 포착).
- 검사: `node --check` 통과. 기존 BR29 이식분(신규 함수 2종 + 게이트) 전부 온전(grep 확인).
- KEEP-UI5 원본(`uiAttributeArea.js`) 무수정 유지.

## 반론/미반영
- 없음. 두 검수 모두 필수 지적 0건, 유일한 잔여 참고는 상기 반영.

## 잔여 참고(반영 후)
- 코덱스가 덧붙인 "이벤트 초기화 내부 개별 try/catch 가 비정상 런타임에서 부분 초기화를 허용"은
  **원본도 트랜잭션 롤백을 제공하지 않고**, 정상 데이터·함수 계약에선 재현되지 않아 판정을 낮추지 않음(양측 동의). 미반영.
- 두 검수 모두 정적 분석 기준. 실제 앱 화면 클릭 테스트는 미수행 → 장군님 실화면 테스트 대기.

## 테스트 시나리오
- `.works/속성autoGrowing연동/00_현황판.md` (BR29-1~6). 실화면 대기.

## 결론
- 반영 1건(await) 완료. 그 외 코드 변경 없음.
