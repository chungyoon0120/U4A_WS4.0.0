# 03_response — BR16 보완/반론 (코덱스·안티 종합)

두 검수 모두 판정 **수정필요**. 핵심 지적이 겹친다. 지적별로 처리한다.

| # | 지적 | 검수자 | 처리 | 반영/사유 |
|---|---|---|---|---|
| 1 | 방송 `BUSY_ON` 준비·송신(옵션 복제·메시지 조회·require·송신)이 `try` **밖**이라, 이 구간 예외 시 `catch`에 도달 못 해 로컬 BUSY·단축키 잠금 잔류 | 코덱스1·안티1 | **반영** | `uiDesignArea.js` `designUIDelete`: `try{` 시작을 방송 `BUSY_ON` 블록 **앞으로** 이동. 이제 옵션 구성·require·송신 예외도 `catch`가 방송 `BUSY_OFF`+단축키 해제+`parent.setBusy("")` 로 정리 |
| 2 | 성공 왕복 `oAPP.fn.updateBindPopupDesignData()` 가 `async` 인데 `await` 없이 호출 → 송신부 예외가 `catch` 우회 | 코덱스2·안티2 | **부분 반영** | 호출부에 `await` 추가(`uiDesignArea.js`). 이로써 `oAPP.fn.updateBindPopupDesignData`(1263) 자체(require·동기 송신)에서 나는 예외는 `catch` 로 전파됨 |
| 3 | 공통 방송 모듈에서 `case "UPDATE-DESIGN-DATA"` 가 비동기 함수를 `return`/`await` 없이 호출(`broadcastChannelBindPopup.js:895-898`), 또 그 함수(584-645)에 내부 `try/catch` 없음 → 원격 데이터 구성 실패 시 잠금 잔류 | 코덱스2(연계)·안티3 | **반론(미반영)** | 이 함수·분기는 **바인딩 팝업 방송 공통 모듈**로 20곳 넘는 흐름이 공유(불변계약). 여기를 고치면 삭제 외 전 흐름에 영향 → BR16 범위를 넘어섬. **원본 1:1·"이상하면 보고만"·"공통 함부로 수정 금지" 원칙**에 따라 미반영. 해당하는 상황(바인딩 팝업 열린 채 삭제 성공 왕복 중 원격 데이터 구성 실패)은 정상 조작으로 거의 도달 불가. 필요 시 별도 항목으로 장군님 지시 있을 때 반영 |

## 반영한 수정 위치
- `www/ws30/ws10_20/design/js/uiDesignArea.js` — `oAPP.fn.designUIDelete` 확인 콜백:
  - `try{` 범위를 방송 `BUSY_ON` 준비·송신까지 포함하도록 앞으로 확장(지적1).
  - 성공 왕복 호출에 `await` 추가(지적2).
- `node --check` 통과.
- 원본 로컬 `setBusy` 순서(확인창 전 off / 콜백 on / 취소 off)와 취소분기·조기반환 방어는 그대로 유지.

## 보류 항목(장군님 결정 필요)
- **지적3**: `broadcastChannelBindPopup.js` 의 `UPDATE-DESIGN-DATA` 분기를 `return updateBindPopupDesignData(oData);` 로 바꾸고, `updateBindPopupDesignData`(584) 내부에 `try/catch` 로 실패 시 `BUSY_OFF`+단축키 해제+`setBusy("")` 보장.
  - 효과: 바인딩 팝업이 열린 상태에서 삭제 성공 왕복 중 원격 데이터 구성 실패 시에도 잠금이 안 남게 됨.
  - 위험: 공통 방송 모듈·공유 함수 변경 → 삭제 외 흐름(속성변경·붙여넣기·이동 등) 전반에 영향 가능. **원본에 없던 동작 추가**라 별도 지시가 있어야 반영.

## 실화면 검증
- `.works/미리보기삭제BUSY/00_현황판.md` BW1~BW4 아직 미테스트 → 동적 통과 판정 전.
- **최종(04)은 실테스트 통과 + (필요 시) 지적3 결정 후** 작성.
