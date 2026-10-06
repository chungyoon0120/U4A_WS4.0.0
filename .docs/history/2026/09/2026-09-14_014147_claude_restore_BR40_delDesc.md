# BR40 재발 재수정 — 삭제 UI 설명(T_DESC) 정리 함수 delDesc 본체 복원

## 요청
장군님: BR40 확인 → "잘되던 게 왜 안 되냐, 누가 건드렸냐" → "작업해놔라"(복원 지시).

## 조사 결과 (원인)
- BR40 = WS20 Design 에서 `Description` 적은 UI 를 삭제하면 그 설명이 `oAPP.DATA.APPDATA.T_DESC` 에 잔존하는 버그.
- 삭제 호출부(배선)는 `ws_html5_ws20_edit.js:878/898` 에 살아있으나, 정작 함수 본체 `oAPP.fn.delDesc` 가 현행 `ws_html5_ws20_attr.js` 에서 사라져 있었음. 호출부는 전부 `if (typeof oAPP.fn.delDesc === "function")` 가드라 본체 없으면 조용히 no-op → T_DESC 미삭제 = BR40 재발.
- git 이력 전수 확인: attr.js **모든 커밋에서 delDesc=0**(pickaxe `-S`/`-G` 도 등장 기록 0). 즉 본체가 **커밋에 한 번도 담긴 적 없음**. 로컬 working copy 편집분으로만 존재하다 병행 세션 revert 로 유실됐고, 커밋은 그 유실된 판을 담았음. 특정 "지운 커밋"은 없음.
- 2026-08-17 실화면 테스트(DD1~DD4) 통과는 당시 working copy 에 본체가 있었기 때문(그 뒤 유실).

## 변경 내용
- `oAPP.fn.delDesc` 본체를 원본 `uiAttributeArea.js:7871` 1:1 로 재이식(`findIndex`→`-1 return`→`splice`).
  - 현행 파일의 형제 함수(`getDesc`·`changeDescOBJID`)와 동일하게 `if (typeof oAPP.fn.delDesc !== "function")` 래퍼로 감쌈.
  - HTML5 스타일 가드 1줄 추가: `T_DESC` 미준비 시 `U4ALOG.warn("GUARD_EXIT", ...)` 로그 후 return(초기 로드 전 호출 대비).
- 삽입 위치: `Description 세팅` 함수와 `Description 검색`(getDesc) 사이(현행 1590 부근).

## 변경 파일
- 변경: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` — `oAPP.fn.delDesc` 본체 복원.
- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.20260914.br40restorebak`.
- 문서: `.works/디자인트리삭제/00_현황판.md` — DD1~DD4 재테스트 되살림.

## 변경 이유
배선만 있고 본체가 유실돼 삭제 시 설명이 계속 잔존. 원본 UI5 는 삭제 노드마다 delDesc 로 T_DESC 를 정리함(uiDesignArea.js:6651/4375). 원본 1:1 복원.

## 영향 범위
- WS20 Design UI 삭제(단건·멀티) 경로에서만 delDesc 호출 → T_DESC 정리. 다른 화면 영향 없음.
- 삭제 대상 OBJID 정확 일치 1건만 splice, 미발견 시 no-op(멱등) → 무관 UI 설명 오삭제 없음.

## 검증
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_attr.js` 통과(JS_OK). 복원 위치 grep 확인(1590 `oAPP.fn.delDesc = function`).
- 실화면(앱 재시작 후 F12 콘솔로 `oAPP.DATA.APPDATA.T_DESC` 조회): `.works/디자인트리삭제/00_현황판.md` DD1~DD4 로 장군님 테스트 대기(미검증).

## 참고 사항
- 재발 방지: 이번엔 **커밋에 반드시 포함**돼야 유실 안 됨. 지시 시 커밋 진행.
- 관련: `.audit/br40/`(검수 왕복 기록), 원본 `uiAttributeArea.js:7871`.
