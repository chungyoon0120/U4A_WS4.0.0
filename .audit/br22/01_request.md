# 01_request — BR22 미리보기 우클릭 "UI 사용위치" UI5 Dialog 예외 및 BUSY 미해제

## 검수 대상 (파일·함수)
- `www/ws30/ws10_20/design/js/callDesignContextMenu.js`
  - `oAPP.fn.contextMenuUiWhereUse` (1470행~) — **본문 전면 교체**: 옛 UI5 팝업 호출 제거 → 안내 메시지만 표시.
  - (무수정·참고) M08 분기 `contextMenuItemPress` case "M08"(203~205행) → `contextMenuUiWhereUse()` 호출.
- (참고·무수정) `www/ws30/ws10_20/design/js/callUiWhereUsePopup.js`
  - `callUiWhereUsePopup`(4행~): 6행 `new sap.m.Dialog(...)` — 예외 발생원(KEEP-UI5, 손대지 않음).
- (참고·기준) `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - `_whereUseNotice()`(1696~1703행) + M08 아이템 `fn: _whereUseNotice`(1765행) — Design Tree 쪽 동일 정책(안내 메시지만). 미리보기를 여기에 맞춤.

## 버그 원인 (노션 BR22)
- 증상: 미리보기 영역 UI 오브젝트 우클릭 → "UI 사용위치" → 확인창 Yes → `TypeError: sap.m.Dialog is not a constructor` (Critical Error). UI 사용위치 팝업 안 열림, `/uiWhereUseList` 요청 없음, WS20 BUSY "X" 유지, 단축키 잠금 true 유지 → 이후 화면 조작 불가.
- 원인: 미리보기 "UI 사용위치" 경로가 옛 UI5 구현 `callUiWhereUsePopup.js` 를 로드 → 시작 시 `new sap.m.Dialog(...)` 실행하는데 HTML5 WS20 실행 환경엔 `sap.m.Dialog` 생성자가 없어 예외. 예외가 팝업 생성 단계에서 나므로 `afterOpen` 이후의 서버 조회·정상 종료 정리(잠금해제·BUSY 해제)에 도달 못 함 → 진입 시 걸어둔 BUSY·단축키 잠금이 잔류.
- 정책 불일치: Design Tree 의 동일 "UI 사용위치"(M08)는 전수 조회 서버 부하 때문에 조회 팝업 호출 없이 안내 메시지만 표시하도록 이미 차단(`ws_html5_ws20_edit.js` `_whereUseNotice`). 미리보기 컨텍스트 메뉴만 옛 UI5 팝업을 계속 호출해 이 정책을 우회.

## 변경 요약 (원본 대비)
- `callDesignContextMenu.js` 의 `contextMenuUiWhereUse` 본문을 다음으로 교체:
  1. 진입 시 `setShortcutLock(false)` + `parent.setBusy("")` 로 잠금·BUSY 즉시 원복(잔류 금지).
  2. `parent.getUserInfo().LANGU` 로 KO/EN 판별.
  3. `parent.showMessage(sap, 10, "W", <안내문구>)` 로 **안내 메시지만** 표시.
  4. 옛 확인창(123)·`callUiWhereUsePopup` 로드/호출·`/uiWhereUseList` 요청 **전부 제거**.
- 안내 문구는 Design Tree `_whereUseNotice` 와 **동일한 KO/EN 하드코딩**(정책·문구 일치). 원본 A59 는 메뉴 라벨 전용 키라 본문 문구 키가 없음 → 메시지 클래스 키화 필요 항목으로 보고.
- KEEP-UI5 대상인 `callUiWhereUsePopup.js` 원본은 **손대지 않음**. HTML5 호스트 연결 지점(`callDesignContextMenu.js`)에서만 차단.

## 검수 포인트
1. **예외 제거**: 수정 후 경로에 `new sap.m.Dialog`(=`callUiWhereUsePopup`) 호출이 전혀 없어 `sap.m.Dialog is not a constructor` 가 재발하지 않는가.
2. **서버요청 차단**: `/uiWhereUseList` 요청이 발생하지 않는가(팝업 미호출로 원천 차단).
3. **잠금·BUSY 해제**: 확인/취소/예외 어떤 경로에서도 BUSY 와 단축키 잠금이 잔류하지 않는가. (진입 시 `setShortcutLock(false)`+`setBusy("")`, 이후 서버/비동기 없음)
4. **정책 일치**: 미리보기와 Design Tree(M08)가 동일하게 "안내 메시지만" 표시하는가. 문구(KO/EN)가 동일한가.
5. **원본 무수정 override**: `callUiWhereUsePopup.js`(KEEP-UI5)를 직접 고치지 않고 연결 지점만 바꿨는가.
6. **반복 호출 안정성**: 같은 메뉴를 반복 선택해도 이벤트·상태가 중복/누적되지 않는가(동기 단발 경로).
7. **문구 하드코딩 처리**: KO/EN 하드코딩이 Design Tree 와 동일 근거(A59 본문 키 부재)인가, 메시지 키화 보고 대상으로 남았는가.

## 근거
- 노션 이슈 리포트 BR22 (코드=BR22, 화면=미리보기): 오류 `TypeError: sap.m.Dialog is not a constructor` @ `callUiWhereUsePopup.js:6:20` via `callDesignContextMenu.js:1524`. 권장 수정=Design Tree 와 동일 안내 메시지·팝업/서버요청 없음·모든 종료 경로 잠금해제.
- Design Tree 기준: `ws_html5_ws20_edit.js` `_whereUseNotice`(1696~1703), M08 아이템(1765).
- 미리보기 분기: `callDesignContextMenu.js` case "M08"(204), 교체 대상 `contextMenuUiWhereUse`(1470~).
- 백업: `www/ws30/ws10_20/design/js/_callDesignContextMenu.js.br22bak`.
- `node --check` 통과.
