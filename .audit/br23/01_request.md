# 01_request — BR23 미리보기 우클릭 "내 패턴" UI5 Dialog 예외 및 BUSY 미해제

## 검수 대상 (파일·함수)
- `www/ws30/ws10_20/design/js/callDesignContextMenu.js`
  - `contextMenuItemPress` case "M11"(207행~) — **분기 본문 교체**: 옛 UI5 함수 즉시 호출 → HTML5 내 패턴 모듈 선로드 후 호출.
- (참고·무수정) 같은 파일 `oAPP.fn.contextMenuP13nDesignPopup`(1533행~) — 옛 UI5판. `callP13nDesignDataPopup("C", ls_tree)` 호출.
- (참고·무수정) `www/ws30/ws10_20/design/js/callP13nDesignDataPopup.js`
  - `callP13nDesignDataPopup`(18행~): 49행 `new sap.m.Dialog(...)` — 예외 발생원(KEEP-UI5, 손대지 않음).
- (참고·기준) `www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js`
  - `oAPP.fn.contextMenuP13nDesignPopup`(1509행~) — HTML5 오버라이드판. 노드 미전달 시 `/lcmenu/OBJID` 폴백(1530행), 모든 종료 경로에서 `_unlock()`+`_busy(false)`.
  - `oAPP.fn.callP13nDesignDataPopup`(1498행) → `fnP13nDesignPopupOpen` 라우팅. `oAPP.fn.fnP13nDesignPopupOpen`(1450행).
- (참고·기준) `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - `_openMyPattern`(1711~1719행) + M11 아이템 `fn: _openMyPattern`(1766행) — Design Tree 쪽 동일 진입(모듈 로드 여부 확인 후 로드→호출). 미리보기를 이 방식에 맞춤.

## 창(window) 구조 (근거)
- 미리보기(design)는 별도 iframe(`#prevHTML`, UI5 유지)이지만, 컨텍스트 메뉴 함수(`callDesignContextMenu`)와 내 패턴 팝업(`contextMenuP13nDesignPopup`) **정의는 모두 호스트 창의 단일 `oAPP`에 존재**한다.
  - `callDesignContextMenu.js`: 호스트에서 `oAPP.fn.getScript(...)`로 로드(`ws_html5_ws20_prev.js:1339`, `uiDesignArea.js:993`) → 호스트 `oAPP.fn`에 정의.
  - `fnP13nDesignPopupOpen.js`: 호스트에서 `oAPP.loadJs("fnP13nDesignPopupOpen", …)`(경로 `./js/`)로 온디맨드 로드 → 같은 호스트 `oAPP.fn.contextMenuP13nDesignPopup`를 HTML5판으로 **덮어씀**.
- 따라서 미리보기 M11에서 `fnP13nDesignPopupOpen.js`를 먼저 로드하면, 그 뒤 `oAPP.fn.contextMenuP13nDesignPopup()` 호출이 HTML5판으로 정상 라우팅된다(로드 순서=나중이 승자).

## 버그 원인 (노션 BR23)
- 증상: 미리보기 영역 UI 오브젝트 우클릭 → "내 패턴" 선택 → `Uncaught TypeError: sap.m.Dialog is not a constructor`(`callP13nDesignDataPopup.js:49:25`). 내 패턴 개인화 팝업 안 열림, 별도 BrowserWindow 미생성, WS20 BUSY "X" 유지, 단축키 잠금 true 유지 → 이후 화면 조작 불가.
- 원인: 미리보기 컨텍스트 메뉴 M11이 HTML5 모듈 로더를 거치지 않고 옛 UI5 `contextMenuP13nDesignPopup()`을 직접 호출. 미로드 상태면 이 UI5판이 실행 → `callP13nDesignDataPopup("C", ls_tree)` → 49행 `new sap.m.Dialog(...)`. HTML5 실행 환경엔 `sap.m.Dialog` 생성자가 없어 예외. 팝업 생성 단계에서 중단되어 정상 종료 정리(잠금해제·BUSY 해제)에 도달 못 함 → 진입 시 걸어둔 BUSY·단축키 잠금이 잔류.
- 경로 불일치: Design Tree M11은 `_openMyPattern`으로 HTML5 모듈 로드 여부를 확인하고 미로드면 먼저 로드 후 호출(정상). 미리보기 M11만 이 선로드 단계를 우회.

## 변경 요약 (원본 대비)
- `callDesignContextMenu.js` case "M11" 분기를 다음으로 교체:
  1. `oAPP.fn.fnP13nDesignPopupOpen` 함수 존재 여부로 **HTML5 모듈 로드 여부** 판정(Design Tree `_openMyPattern`과 동일 판정 기준).
  2. 로드돼 있으면 즉시 `run()`(= `oAPP.fn.contextMenuP13nDesignPopup()` 호출).
  3. 미로드면 `oAPP.loadJs("fnP13nDesignPopupOpen", run)`로 로드 후 호출(로드가 UI5판을 HTML5판으로 덮음).
  4. HTML5판은 노드 미전달 시 `/lcmenu/OBJID` 폴백이므로 **인자 없이** 호출(원본 미리보기 경로 그대로).
  5. `run()` 내부 예외, `loadJs` 예외, 로드 실패(함수 미정의) **모든 종료 경로에서** `setShortcutLock(false)`+`parent.setBusy("")`로 진입 시 걸어둔 잠금·BUSY 해제.
- 정상 오픈 시 BUSY 해제는 HTML5판 `contextMenuP13nDesignPopup`→`fnP13nDesignPopupOpen`(팝업 렌더 완료 후)이 담당(Design Tree M11과 동일 검증 경로, 자기해제 아님).
- KEEP-UI5 대상 `callP13nDesignDataPopup.js`(49행 `sap.m.Dialog`) 원본은 **손대지 않음**. HTML5 호스트 연결 지점(`callDesignContextMenu.js` M11)에서만 진입 경로를 바꿈.
- 새 문구·메시지 키 추가 없음(모듈이 기존 키·경로 사용).

## 검수 포인트
1. **예외 제거**: 수정 후 경로에서 `new sap.m.Dialog`(=옛 UI5 `callP13nDesignDataPopup`) 호출이 발생하지 않아 `sap.m.Dialog is not a constructor`가 재발하지 않는가. (선로드가 UI5판을 HTML5판으로 덮는지)
2. **OBJID 전달**: HTML5판이 `/lcmenu/OBJID` 폴백(1530행)으로 우클릭한 UI(PAGE5 등)를 정확히 잡아 팝업 제목/대상에 반영하는가.
3. **잠금·BUSY 해제**: 정상 오픈·취소·오류·모듈 로드 실패·폴더 생성 실패·다른 화면 개인화중(382)·조기 종료 어떤 경로에서도 BUSY와 단축키 잠금이 잔류하지 않는가.
   - 진입 시 잠금/BUSY는 메뉴 선택(`attachItemSelected` 17~20행)이 걸었고, 해제는 HTML5판 내부 종료 경로 + M11 분기의 예외/로드실패 처리가 담당.
4. **정상 해제 시점(WP1)**: 정상 오픈 시 BUSY가 팝업 렌더 완료 후 해제되는가(중간 조기 해제로 연타 틈이 생기지 않는가). 자기해제가 아니라 모듈 왕복이 해제하는가.
5. **Design Tree 일치**: 미리보기와 Design Tree(M11)의 내 패턴 동작(팝업·대상·해제)이 동일한가.
6. **원본 무수정 override**: `callP13nDesignDataPopup.js`(KEEP-UI5)를 직접 고치지 않고 연결 지점만 바꿨는가.
7. **반복 호출 안정성**: 같은 메뉴를 반복 선택해도 팝업·이벤트가 중복/누적 생성되지 않는가(`typeof` 판정으로 재로드 방지, 동기 로드).
8. **이중 해제 없음**: 로드 성공(run 실행) 시 하단 로드실패 분기가 타지 않는가(함수 정의 후 `!== "function"` 거짓).

## 근거
- 노션 이슈 리포트 BR23 (코드=BR23, 화면=미리보기): 오류 `Uncaught TypeError: sap.m.Dialog is not a constructor` @ `callP13nDesignDataPopup.js:49:25`. 원인=미리보기 M11이 로더 우회, 권장 수정=Design Tree와 동일 HTML5 진입 함수 사용·미로드면 선로드·모든 종료 경로 BUSY/잠금 해제·PAGE5(/lcmenu/OBJID) 정확 전달.
- Design Tree 기준: `ws_html5_ws20_edit.js` `_openMyPattern`(1711~1719), M11 아이템(1766).
- HTML5 모듈: `fnP13nDesignPopupOpen.js` `contextMenuP13nDesignPopup`(1509, `/lcmenu/OBJID` 폴백 1530), `callP13nDesignDataPopup` 오버라이드(1498), `fnP13nDesignPopupOpen`(1450).
- 미리보기 분기: `callDesignContextMenu.js` case "M11"(207~238), 메뉴 선택 시 잠금/BUSY 세팅(17~20).
- 백업: `www/ws30/ws10_20/design/js/_callDesignContextMenu.js.br23bak`.
- `node --check` 통과.
