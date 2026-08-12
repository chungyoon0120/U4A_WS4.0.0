# 01_request — BR23 미리보기 우클릭 "내 패턴" (UI5 Dialog 예외 + BUSY 미해제) + 개인화 팝업 UX 3건

> 재검수 사이클(2차). A = 최초 BR23(미리보기 M11 선로드) — 아래 본문. B~D = 이후 장군님 지적으로
> 개인화 팝업(`fnP13nDesignPopupOpen.js`)에 반영한 UX 수정 3건(문서 끝 "추가 변경" 절). 함께 검수 바람.

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

---

## 추가 변경 (개인화 팝업 UX 3건) — `www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js`

> A(위 BR23)와 별개로, 내 패턴 개인화 팝업 자체에 장군님 지적으로 반영한 3건. 파일은 모두 `fnP13nDesignPopupOpen.js`.

### B. 헤더 ↔ 툴바 색 경계 (공통 UX 수렴)
- 위치: `lf_ensureStyle` 스코프 스타일 — `.u4aP13nRegTool, .u4aP13nListTool`(좌측 등록/리스트 툴바), `.u4aP13nPrevTool`(미리보기 툴바), `.u4aP13nTreeTool`(우측 트리 툴바).
- 변경: 세 툴바의 `background: var(--surface-raised)` 제거 → **배경 없음(본문 톤) + 하단 경계선만**. 트리 툴바는 WS20 스킨(`.u4aWs20TreeToolbar`) 위에 팝업 스코프에서 `background: transparent` override(WS20 본체는 그대로 유지).
- 근거: 공통 규칙(`bootstrap-skin.css:297` 주석 "헤더=살짝 다른 톤 밴드 / 나머지=본문 톤"), 바인딩 팝업 `.u4aBindTool`(배경 없음+하단선)과 일치. 다크 테마에서 헤더 밴드(`--sl-surface-2` #26313d)와 툴바 면(`--surface-raised` #2a323a)이 거의 같아 헤더-툴바 경계가 사라지던 문제.
- 검수 포인트: (1) 헤더 제목 띠와 바로 밑 툴바가 명확히 구분되는가. (2) 공통 파일 미수정, 화면 스코프 override 인가. (3) WS20 본체 트리 툴바(surface-raised) 회귀 없는가. (4) 하드코딩 hex/`color-mix` 없이 의미 토큰만 쓰는가.

### C. 우측 디자인 트리 가상 스크롤
- 위치: `lf_renderTree`.
- 변경: 공통 `U4AUI.createTree`에 `virtual: true` 추가(WS20 트리와 동일). **트리 컨트롤러는 팝업당 1회만 생성**하고 데이터 갱신은 `collapseAll`+`expandToLevel(1)` 재렌더로 반영(기존엔 매 호출 `treeWrap.innerHTML=""` 후 재생성 → 가상 스크롤러가 스크롤 컨테이너에 휠/리사이즈 처리를 중복 부착할 위험).
- 근거: `.analy/16 §3.4.1`(대용량은 `createTree({virtual:true})`, 화면별 `.u4a-tree__row{height}` 재정의 금지). WS20 트리(`ws_html5_ws20_tree.js:486` `_ws20tree = createTree({virtual:true})`, 1회 생성 후 재렌더) 패턴. 공통 가상 모드는 내부 펼침맵으로 `collapseAll/expandToLevel/expandAll` 지원(`u4a-ui.js:1585~1607`), 스크롤 컨테이너=트리 el 부모(=`u4aP13nTreeWrap`, `overflow:auto`).
- 검수 포인트: (1) 트리가 보이는 행만 렌더(대용량 스크롤 부드러움), 끝단 떨림 없는가. (2) "모두 펼침/접기" 버튼·초기 1단계 펼침 정상인가. (3) 팝업 반복 오픈/대상 UI 변경 시 스크롤러 중복 부착(휠 다중 발화) 없는가. (4) 재빌드 시(`oUI={}`) 트리 참조 초기화로 옛 트리 재사용 안 하는가.

### D. 드래그 드롭 위치 — 팝업 위에서는 드롭 무효 (삽입 팝업 BR13 방식)
- 위치: `_setModalLook`, CSS `.u4aP13nDlg.u4aP13nDragThru`(제거).
- 변경: 드래그 중 팝업까지 클릭 통과(`u4aP13nDragThru` = `pointer-events:none`)시키던 것을 제거 → **백드롭만 토글, 팝업 자신은 드래그 중에도 클릭을 계속 막음**. 팝업이 가린 부분은 뒤 트리가 이벤트를 못 받아 드롭 무효, 팝업 밖 보이는 디자인 트리/미리보기에서만 드롭.
- 근거: 삽입 팝업 BR13 수정(`ws_html5_ws20_edit.js:1306~1314` `_setModalLook` — 백드롭만 토글, 다이얼로그 pointer-events 유지). 예전엔 팝업 안(리스트 위 등)에서 놓아도 뒤 트리에 잘못 드롭되던 버그.
- 검수 포인트: (1) 팝업 영역 안(리스트/미리보기 위)에 놓으면 드롭·놓기표시 모두 안 생기는가. (2) 팝업 밖 트리에 놓으면 정상 적용되는가. (3) `dragstart` 중 동기 `pointer-events:none` 로 인한 드래그 취소가 없는가(백드롭만 끄므로 무관, `setTimeout` 유지). (4) 드래그 종료·취소·ESC 후 백드롭 복원(모달 느낌)이 정상인가.

### 추가 변경 검증
- `node --check www/ws30/ws10_20/js/fnP13nDesignPopupOpen.js` 통과.
- B: `.u4aP13nRegTool/PrevTool` 에 `--surface-raised` 미존재, `.u4aP13nTreeTool` 에 `background: transparent` 확인. D: `u4aP13nDragThru` 잔여 참조 0(grep) 확인.
