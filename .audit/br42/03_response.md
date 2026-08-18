# BR42 검수 결과 반영·해명 (03)

## 취합 판정
두 검수(코덱스·안티) **모두 동일한 P1 1건**: 원본 Reset 루프는 각 값 변경 직후 `attrSetDropAbleException(_sAttr, false, true)` + `attrSetAutoGrowingException(_sAttr, false, true)`(3번째 인자 `bClear=true`)로 **연동 이벤트(DnDDrop/서버·클라이언트) 데이터까지 초기화**하는데, 현행 HTML5 Reset은 이 두 줄이 빠져 이벤트 데이터가 남는다는 것.

BR42가 추가한 Undo 병합(첫 변경 직전 스냅샷 1회 + 각 변경 `bSkipUndo=true` + 빈 스냅샷 방지) **자체는 양측 통과·무결점**.

## 지적별 표

| # | 지적 | 검수자 | 처리 | 근거 |
|---|---|---|---|---|
| P1 | Reset 루프에 `attrSetDropAbleException(,false,true)`·`attrSetAutoGrowingException(,false,true)` 누락 → autoGrowing/dropAble 연동 이벤트 데이터 잔존 | 코덱스·안티 (동일) | **반영(원본 2줄 복원, 완료)** | 원본 `uiAttributeArea.js:2222·2225` |
| — | Undo 1회 병합·빈 스냅샷 방지·`bSkipUndo` 사이드이펙트 격리 | 코덱스·안티 | 통과(변경 없음) | — |
| — | 'Show Changed Items' 필터 해제 동기화·팝업/락 Fail-safe 해제 | 안티 P2(무결 확인) | 통과(변경 없음) | — |

## 반영 내용
`attrResetAttr` 초기화 루프에서 각 값 변경(`fnWs20AttrChange(_sAttr, uityp, true)`) **직후** 원본과 동일 순서·인자로 두 예외처리를 복원 (`ws_html5_ws20_attr.js:4511~4517`):
```
oAPP.fn.attrSetDropAbleException(_sAttr, false, true);   //원본 2222
oAPP.fn.attrSetAutoGrowingException(_sAttr, false, true); //원본 2225
```
- 존재 가드(`typeof === "function"`) + 실패 시 `console.error` 표면화(code.md 규칙 합치).
- 원본 순서(값 변경 → dropAble → autoGrowing)·인자(`false, true`) 1:1.

## 되돌리기(Undo) 무결성 재검증 — BR42 핵심 불변식 유지 확인
검수가 우려한 "예외처리가 되돌리기 스냅샷을 또 쌓아 Undo 여러 번이 되는 문제"는 없음:
- `attrSetAutoGrowingException`(3537~3608)·`attrSetDropAbleException`(4217~) 본체는 **내부에서 `fnWs20PushUndo`를 호출하지 않는다**(데이터·스타일 조작만: `attrChgAttrVal`·`attrDelClientEvent`·`attrSetLineStyle`). → BR42의 단일 스냅샷 유지.
- BR42 스냅샷은 첫 변경 "직전"에 `_T_0015` 전체를 저장한다. 연동 이벤트 초기화는 그 스냅샷 이후에 일어나므로, **Undo 한 번에 프로퍼티 + 연동 이벤트가 함께 이전 상태로 복원**된다(코덱스 리포트 28행도 `T_CEVT` 보존으로 함께 복원됨을 확인).

## 반론
없음. 두 검수 지적이 원본과 정확히 일치하여 전량 반영.

## 검증
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과.
- 원본 파일 무수정(내 파일 = 원본 폴더 밖 `js/ws_html5_ws20_attr.js`).

## 비고
P1 복원 2줄은 검수 진행 중 병행 세션이 원본 1:1로 이미 반영해 둔 상태였고(4511~4517, `[BR42 복원]` 주석), 본 03에서 원본 대조·순서·인자·되돌리기 무결성을 재검증해 **정확함을 확정**했다. 추가 코드 수정 없음.
