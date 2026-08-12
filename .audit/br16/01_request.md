# 01_request — BR16 미리보기 우클릭 삭제 시 화면 잠금(BUSY) 미해제

## 검수 대상
- `www/ws30/ws10_20/design/js/callDesignContextMenu.js` — `oAPP.fn.contextMenuDeleteUI`
- `www/ws30/ws10_20/design/js/uiDesignArea.js` — `oAPP.fn.designUIDelete` (확인창 콜백)

## 증상 (BR16)
WS20 미리보기에서 우클릭 → **삭제** 선택 → "정말 오브젝트를 삭제하시겠습니까?" 확인창이 뜨는데,
그 순간 화면 잠금(BUSY 인디케이터)이 확인창을 덮어 확인·취소 버튼을 못 눌러 먹통.

## 원인 (원본 대비 조사 결과)
- 로컬 화면잠금 `parent.setBusy` 는 원본 UI5 그대로: 확인창 직전 off(6677), 확인 콜백서 on(6686). 정상.
- 문제는 **HTML5 변환 때 덧붙인 "다른 창(바인딩 팝업)용 잠금 방송" `bindPopupBroadCast("BUSY_ON")`** 을
  확인창 호출 **전**(`contextMenuDeleteUI` 410)에서 켠 것. 이 방송이 비동기로 뒤늦게 창 잠금표시
  (`#u4aWsBusyIndicator`)를 다시 켜 확인창을 덮음. 확인창 대기 구간엔 짝이 되는 BUSY_OFF가 없음.
- 원본 UI5에는 확인창 앞에서 방송 잠금을 켜는 로직이 없었음(방송은 HTML5 추가분).

## 변경 요약
- `callDesignContextMenu.js`: 확인창 호출 **전**의 방송 `BUSY_ON` 제거.
- `uiDesignArea.js`: 방송 `BUSY_ON` 을 확인 콜백 안 **삭제 확정(YES) 이후 구간**으로 이동
  (로컬 `parent.setBusy("X")` 와 같은 성격의 실제 작업 구간에서만 잠금).
  - 취소분기(6706 부근)는 기존 방송 `BUSY_OFF` 유지(방어).
  - 성공분기는 WS20 왕복 `updateBindPopupDesignData` 가 방송 해제.
  - 삭제 작업 전체를 `try/catch` 로 감싸 오류 시에도 방송 `BUSY_OFF` + 단축키 해제 + `parent.setBusy("")` 보장.

## 검수 포인트
1. **원본 1:1 여부**: 로컬 `setBusy` 순서(6677 off / 6686 on / 취소 off)를 건드리지 않았는지.
2. **busy on/off 짝**: 방송 BUSY_ON 이 취소·성공·오류·정보없음(조기반환) 모든 종료 분기에서 해제되는지.
3. **비동기 순서**: 확인창 대기 중 방송 잠금이 다시 켜져 확인창을 덮는 회귀가 없는지.
4. **자기해제 금지**: 성공 경로는 자기해제하지 않고 WS20 왕복으로 해제하는지(규칙 준수).

## 근거
- 원본(as-is): 두 파일의 백업 `_callDesignContextMenu.js.br16bak`, `_uiDesignArea.js.br16bak` (같은 폴더).
- 프로젝트 규칙 `.claude/rules/code.md`(busy on→모든 종료분기 off 짝), `.analy/06_팝업.md`(확인창/모달).
- 테스트 현황판: `.works/미리보기삭제BUSY/00_현황판.md` (BW1~BW4).
