# 01_request — BR22 미리보기 우클릭 "UI 사용위치" UI5 Dialog 예외 및 BUSY 미해제

## 검수 대상 (파일·함수)
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - `oAPP.fn.fnWs20WhereUseNotice`(1746행~) — **신규 공용 함수**(구 지역함수 `_whereUseNotice` 를 노출). KO/EN 안내 메시지만 표시.
  - `_buildItems` M08 아이템(1821행) — `fn: oAPP.fn.fnWs20WhereUseNotice()` 호출로 변경.
- `www/ws30/ws10_20/design/js/callDesignContextMenu.js`
  - `oAPP.fn.contextMenuUiWhereUse`(1470행~) — **본문 전면 교체**: 옛 UI5 팝업 호출 제거 → 잠금·BUSY 즉시 원복 후 공용 `fnWs20WhereUseNotice()` 호출.
  - (무수정·참고) M08 분기 `contextMenuItemPress` case "M08"(204행) → `contextMenuUiWhereUse()`.
- (참고·무수정) `www/ws30/ws10_20/design/js/callUiWhereUsePopup.js`
  - `callUiWhereUsePopup`(4행~): 6행 `new sap.m.Dialog(...)` — 예외 발생원(KEEP-UI5, 손대지 않음).

## 버그 원인 (노션 BR22)
- 증상: 미리보기 영역 UI 오브젝트 우클릭 → "UI 사용위치" → 확인창 Yes → `TypeError: sap.m.Dialog is not a constructor` (Critical Error). 팝업 안 열림, `/uiWhereUseList` 요청 없음, WS20 BUSY "X" 유지, 단축키 잠금 true 유지 → 이후 화면 조작 불가.
- 원인: 미리보기 "UI 사용위치" 경로가 옛 UI5 구현 `callUiWhereUsePopup.js` 를 로드 → 시작 시 `new sap.m.Dialog(...)` 실행하는데 HTML5 실행 환경엔 생성자가 없어 예외. 예외가 팝업 생성 단계에서 나므로 `afterOpen` 이후의 서버 조회·종료 정리(잠금·BUSY 해제)에 도달 못 함 → 진입 시 걸어둔 BUSY·단축키 잠금 잔류.
- 정책 배경: 이 기능은 전체 앱 전수 조회라 서버 부하가 커서, 좌측 트리 M08 은 이미 조회 없이 안내 메시지만 표시하도록 차단돼 있음. 미리보기만 옛 UI5 팝업을 계속 호출해 이 정책을 우회.

## 변경 요약 (원본 대비)
1. **공용화**: 좌측 트리 M08 의 안내 처리(구 지역함수 `_whereUseNotice`)를 `oAPP.fn.fnWs20WhereUseNotice` 로 노출. 트리 M08 도 이 공용 함수를 호출하도록 변경.
   - 공용 함수 본문은 원본 동작 유지: `getUserInfo().LANGU` 로 KO/EN 판별 → `parent.showMessage(null, 10, "W", <문구>)` 안내만.
2. **미리보기 연결 교체**: `contextMenuUiWhereUse` 본문을 다음으로 교체.
   - 진입 시 `setShortcutLock(false)` + `parent.setBusy("")` 로 잠금·BUSY 즉시 원복(잔류 금지).
   - `typeof oAPP.fn.fnWs20WhereUseNotice === "function"` 가드 후 **공용 안내 호출**.
   - 옛 확인창(123)·`callUiWhereUsePopup` 로드/호출·`/uiWhereUseList` 요청 **전부 제거**.
3. **문구 단일화**: 미리보기에 있던 KO/EN 문구 하드코딩 **복붙 제거**. 문구·동작은 트리 공용 함수 한 곳에서만 관리(현재 문구 출현 파일 1곳 = `ws_html5_ws20_edit.js`).
4. KEEP-UI5 대상 `callUiWhereUsePopup.js` 원본은 **손대지 않음**. HTML5 호스트 연결 지점에서만 차단.

## 검수 포인트
1. **동일 기능 = 동일 함수**: 트리 M08 과 미리보기 M08 이 실제로 **같은 공용 함수(`fnWs20WhereUseNotice`)** 를 호출하는가. 문구·동작이 한 곳에서만 관리되는가(복붙 잔재 없는가).
2. **예외 제거**: 수정 후 경로에 `callUiWhereUsePopup`/`new sap.m.Dialog` 실제 호출이 없어 `sap.m.Dialog is not a constructor` 가 재발하지 않는가(주석 참조만 남았는가).
3. **서버요청 차단**: `/uiWhereUseList` 요청이 발생하지 않는가(팝업 미호출로 원천 차단).
4. **잠금·BUSY 해제**: 확인/취소/예외 어떤 경로에서도 BUSY·단축키 잠금이 잔류하지 않는가. 미리보기 진입 시 원복(`setShortcutLock(false)`+`setBusy("")`) 후 비동기/서버 없음.
5. **공용 함수 존재 의존성**: 미리보기에서 `fnWs20WhereUseNotice` 미로드 시(가드 false) 조용히 아무 것도 안 하는 게 맞는가, 아니면 존재 보장(edit.js 로드 순서)로 항상 호출되는가.
6. **첫 인자 `null` 타당성**: 공용 함수가 `parent.showMessage(null, ...)` 로 트리·미리보기 양쪽 컨텍스트에서 안전히 안내를 띄우는가.
7. **원본 무수정 override**: `callUiWhereUsePopup.js`(KEEP-UI5)를 직접 고치지 않고 연결 지점만 바꿨는가.
8. **반복 호출 안정성**: 같은 메뉴를 반복 선택해도 이벤트·상태가 중복/누적되지 않는가(동기 단발).

## 근거
- 노션 이슈 리포트 BR22 (코드=BR22, 화면=미리보기): 오류 `TypeError: sap.m.Dialog is not a constructor` @ `callUiWhereUsePopup.js:6` via `callDesignContextMenu.js`. 권장 수정=트리와 동일 안내·팝업/서버요청 없음·모든 종료 경로 잠금해제.
- 트리 기준(공용화 출처): `ws_html5_ws20_edit.js` `fnWs20WhereUseNotice`(구 `_whereUseNotice`), M08 아이템.
- 미리보기 분기: `callDesignContextMenu.js` case "M08", 교체 대상 `contextMenuUiWhereUse`.
- 백업: `www/ws30/ws10_20/design/js/_callDesignContextMenu.js.br22bak`.
- `node --check` 두 파일 통과.

## 비고 (검수 시 유의)
- 앞선 1차 수정이 다른 BR 작업의 파일 덮어쓰기로 유실된 이력 있음(백업본에는 있었으나 활성 파일에서 사라짐). 재검수 시 **활성 파일에 실제 반영돼 있는지** 먼저 확인 요망.
