# 01_request — BR18 미리보기 우클릭 "위치 이동" 팝업, UI5 잔존 호출로 예외·화면 잠금

## 검수 대상
- `www/ws30/ws10_20/design/js/uiMovePosition.js` — **전면 재작성**(원본 UI5 → HTML5 공통 팝업). 이 파일이 검수 핵심.
- 백업(원본 UI5 as-is): `www/ws30/ws10_20/design/js/_uiMovePosition_ui5_asis.js.bak`
- 호출부(미수정, 배선 확인용): `www/ws30/ws10_20/design/js/callDesignContextMenu.js` — `oAPP.fn.contextMenuUiMovePosition`(601~634), 메뉴 항목 선택 `attachItemSelected`(15~30), `contextMenuUiMove`(432~595)
- 모양·로직 기준(검증된 자매 팝업): `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` — `_moveUIPosition`(1555~1624)

## 증상 (BR18)
WS20 미리보기 영역에서 UI 우클릭 → "위치 이동" 선택 시
`TypeError: sap.ui.getCore(...).loadLibrary is not a function`(uiMovePosition.js:17) 예외.
위치 이동 팝업이 안 뜨고, 그 직전 켠 화면 잠금(BUSY)이 안 풀려 화면이 잠김.
(원본 스택: uiMovePosition.js:17 → callDesignContextMenu.js:631 → ws_html5_ws20_prev.js XHR 콜백)

## 원인 (원본 대비 조사 결과)
- 미리보기 우클릭 메뉴는 원본 UI5 `callDesignContextMenu.js`(HTML5가 미리보기용으로 지연 로드)를 탄다.
  "위치 이동"(M05) → `contextMenuUiMovePosition`(601) → `oAPP.fn.uiMovePosition`(getScript 로드).
- 그런데 `uiMovePosition.js`는 원본 UI5 그대로였다: 진입 즉시 `sap.ui.getCore().loadLibrary("sap.m")`(:17) 후
  `sap.m.Dialog`/`Grid`/`StepInput`/`Slider` 로 팝업 생성. **메인 창의 `sap` 은 실제 UI5 코어가 아니라
  호환용 스텁(byId/lock/applyTheme 수준)** 이라 `loadLibrary` 미존재 → 예외. 팝업 생성 전에 죽어 화면 잠금 잔존.
- 위/아래 이동(BR17)과 달리, "위치 이동"만 이 UI5 파일에 의존해 남아 있었다. UI5 의존 제거 때 이 파일 미정리.

## 변경 요약
- `uiMovePosition.js` **팝업 UI만** 공통 `.u4a-dialog` HTML5로 전면 교체. 트리 우클릭 위치이동 팝업(`_moveUIPosition`)과
  모양·동작 동일하게 통일(헤더 이동아이콘+제목+닫기 / 숫자입력 "/ N" + 슬라이더 / 확정 ✓·취소 ✗ / 드래그·리센터·리사이즈).
- **시그니처·콜백 계약 1:1 보존**: `uiMovePosition(is_parent, OBJID, pos, max, f_callBack, i_x, i_y)`.
  `pos`=현재 1-based 위치, `max`=형제 수. 확정 시 `f_callBack(대상 0-based index)` 호출 →
  호출부 `lf_callback`(602) → `contextMenuUiMove(undefined, pos)`(기존 HTML5 이동, `:489` `l_pos=pos`로 index 사용). **실제 이동 로직 미변경**.
- **BUSY 대칭 복원**: 메뉴 항목 선택 시 `callDesignContextMenu.js:17` `parent.setBusy("X")`로 켠 화면 잠금을,
  팝업이 완전히 뜬 직후 `parent.setBusy("")`로 해제(원본 `attachAfterOpen` `_bak:201`과 1:1). 이 한 줄을 빠뜨리면
  팝업 위에 화면 잠금 덮개가 남아 **팝업 클릭이 전부 막힘**(1차 수정 후 실측 재현·수정 완료).
- **designMoveMark 제거**: 원본은 슬라이더 이동 중 이동될 위치를 미리 강조(`designMoveMark`). 이 함수는
  `uiDesignArea.js:4831`에만 정의되고, 이를 로드하는 유일 지점은 `design/js/main.js:1934`인데 **`main.js`는 HTML5 런타임에 미로드**
  (prev.js:384·edit.js:900이 "main.js 미정의라 재구현" 명시) → `designMoveMark` 미존재. 호출 시 BR18과 동일 재크래시 위험이라 제거.
  자매 팝업 `_moveUIPosition`도 미사용(동일).
- 취소(헤더 X · 푸터 ✗ · ESC) 시 001 "Cancel operation" 안내 + `setShortcutLock(false)` 유지(원본 `lf_close`/`attachAfterOpen` 1:1).
- 원본 UI5 파일 자체는 백업(`_uiMovePosition_ui5_asis.js.bak`) 후 교체. 공통 자산(shell/bootstrap-skin/u4a-ui/tokens) 미접촉.

## 검수 포인트
1. **원인 정확성**: 미리보기 "위치 이동"이 `uiMovePosition` UI5 `loadLibrary` 미존재로 crash, 화면 잠금 잔존.
2. **BUSY 대칭(핵심)**: 메뉴가 켠 `parent.setBusy("X")`를 팝업 오픈 직후 `parent.setBusy("")`로 해제. 누락 시 덮개가 팝업 클릭을 먹음.
   showModal 실패해도(try) 해제 라인에 도달하는지.
3. **콜백 계약 일치**: 확정 시 `f_callBack`에 넘기는 값이 0-based 대상 index이고, `contextMenuUiMove(undefined,pos)`가 이를 index로 쓰는지(:489~496). 클램프 1..max.
4. **designMoveMark 제거 타당성**: `main.js` 미로드 → `uiDesignArea.js` 미로드 → `designMoveMark` 미존재 확인. 되살리면 재크래시. 자매 팝업도 미사용.
5. **원본 1:1**: 시그니처, 취소 001 안내, `setShortcutLock` 대칭, Enter→확정, 값 범위 클램프.
6. **공통 자산 소비/반응형**: `.u4a-dialog`/`.u4a-btn`/`.u4a-input` + `makeDialogRecenter`/`makeDialogResizable` + 헤더드래그 전역 위임.
   하드코딩 hex 없음(테마 토큰·`accent-color`만), `color-mix` 미사용. 고정 px 폭 없음(`min(92vw,360px)`).
7. **별창(바인딩 팝업) 덮개 왕복**: 확정 위임 후 `contextMenuUiMove`(:440 BUSY_ON) → 끝의 `updateBindPopupDesignData`(:592) →
   별창 `UPDATE_DESIGN_DATA` 수신 → 갱신 끝 `setBusy(false)`(bindPopup broadcastChannelBindPopup.js:318)로 **정상 경로 해제**(누수 없음, 소스 왕복 확인).
   예외 경로(`contextMenuUiMove` try/finally 부재) 잔여는 위/아래 이동과 공유하는 기존 공통함수 사안(BR17 범위)로 **별건**.
8. **메시지 키 편차(경미)**: 팝업 닫기/취소 툴팁이 자매 팝업과 통일(A41 사용). 원본 `.bak`은 닫기 A39. 툴팁 텍스트만 차이 — 이 통일이 적절한지 판단 요청.
9. **동일 위치 확정 시**: 원본과 동일하게 무조건 콜백(→ MOVE 되돌리기 1건 기록·no-op 이동). 자매 팝업만 `iTarget===iCur` 조기 return으로 최적화. 원본 충실 vs 최적화 중 어느 쪽이 맞는지 판단 요청.

## 근거
- 원본(as-is): `_uiMovePosition_ui5_asis.js.bak`(loadLibrary:17, 확정 성공경로 setBusy off 부재=원본 누수), `callDesignContextMenu.js:601-634`(호출·콜백 배선), `:17`(메뉴 BUSY on), `:432-595`(contextMenuUiMove 이동), `uiDesignArea.js:4831`(designMoveMark 원정의·미로드).
- 자매 기준: `ws_html5_ws20_edit.js:1555-1624`(_moveUIPosition).
- 별창 왕복: `Popups/bindPopup/wsDesignHandler/broadcastChannelBindPopup.js`(updateDesignData:241-318), `design/bindPopupHandler/broadcastChannelBindPopup.js`(updateBindPopupDesignData:584-), `js/ws_html5_ws20_dnd.js:762`(WS20측 방송).
- 규칙: `.claude/rules/code.md`(busy on→모든 종료분기 off 짝, 팝업 3종 세트=드래그·리센터·리사이즈), 원본 우선·임의창작 금지.
- 테스트 현황판: `.works/미리보기위치이동/00_현황판.md`(MP1~MP7).
