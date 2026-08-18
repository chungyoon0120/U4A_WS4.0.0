# BR47 검수 요청서 (01_request)

## 대상 이슈
- 코드: **BR47** / 화면: WS20 Design
- 현상: WS20 Design 화면의 **Design Tree(디자인 트리)에서 "팝업 유형" UI**(sap.m.Dialog, u4a.m.Dialog,
  sapui6.ui.commons.Dialog, sap.m.SelectDialog, sap.m.Popover, sap.m.P13nDialog, sap.m.ViewSettingsDialog,
  sap.m.ResponsivePopover 등) **라인을 마우스 우클릭하면, 우클릭 컨텍스트 메뉴가 표시된 직후 곧바로 닫힌다.**
  일부 팝업(sap.m.QuickView, sap.m.Menu, sap.ui.unified.Menu, sap.m.BusyDialog, sap.m.ColorPalettePopover,
  sap.ui.unified.ColorPickerPopover, sap.m.MessagePopover)은 정상 유지된다.
- 이슈 기대결과: **특정 UI만 예외 처리하지 말고, 공통적인 컨텍스트 메뉴 처리 흐름을 점검·보완**해
  모든 UI에서 메뉴가 유지되도록 할 것.

---

## 검수 대상 (파일 / 함수 / 라인)
| 파일 | 함수/위치 | 역할 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_html5_ws20_tree.js` | `rowHook` 내 `oRow.addEventListener("contextmenu", ...)` (약 588~603행) | **이번 수정 지점.** 디자인 트리 행 우클릭 핸들러 |
| (참조·원본) `www/ws30/ws10_20/design/js/uiDesignArea.js` | `oLTree1.attachBrowserEvent("contextmenu", ...)` 1003~1063행 | 원본(UI5) 우클릭 흐름의 정답(SSOT) |
| (참조) `www/ws30/ws10_20/js/ws_html5_ws20_prev.js` | `setSelectTreeItem` 786~804행 | 선택 함수(Promise 반환, `fnWs20SelectUI` 위임) |
| (참조) `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` | `fnWs20ShowTreeContextMenu` 1995행 / `_onOutside`·`_closeMenu` 1779~1786행 | 메뉴 생성·표시·바깥클릭 닫기 |
| (참조) `www/ws30/ws10_20/theme/u4a-ui.js` | `_installIframeBlurClose` 1742~1761행 | 미리보기(iframe) 포커스 시 열린 메뉴 닫는 전역 로직 |

---

## 원인 (근본 원인 확정)
1. 디자인 트리 우클릭 핸들러(`tree.js` 588~593행 원본상태)는
   `setSelectTreeItem(sObjid)`를 **await 하지 않고** 곧바로 `fnWs20ShowTreeContextMenu(...)`로 메뉴를 띄웠다.
2. 선택(`setSelectTreeItem` → `fnWs20SelectUI` → `refreshPreview`)이 **팝업 유형 UI면 미리보기에서 그 팝업을
   실제로 `.open()`** 한다(`design/preview/index.js:6502` refreshPreview → `:6616~6621` `_oExcepUI[FLD03]()`,
   UA015 예외 테이블). 열린 modal/포커스획득형 팝업이 iframe 내부로 initial focus를 옮긴다.
3. iframe이 포커스를 받으면 부모창 `blur` 발생 → `_installIframeBlurClose`(`u4a-ui.js:1742`)가
   `document.activeElement.tagName === "IFRAME"` 확인 후 **합성 mousedown 발사(→ `_onOutside`가 `_closeMenu`)
   + `.u4a-menu` 직접 remove**. 트리 컨텍스트 메뉴 클래스가 `"u4a-menu u4aWs20TreeCtxMenu"`(`edit.js:2001`)라
   방금 뜬 메뉴가 즉시 제거된다 → "표시 직후 닫힘".
4. 유지되는 팝업 중 Menu류는 `refreshPreviewExcep`(`index.js:6653~6664`)에서 `bOpen=false`로 **열지 않도록 억제**
   → 포커스 이동 없음 → 메뉴 유지. (이 대비가 원인 가설을 역으로 뒷받침.)

- **원본(UI5)은 이 문제를 이미 직렬화로 해결**하고 있었다: `uiDesignArea.js:1036` `await setSelectTreeItem(...)`로
  선택을 **완전히 끝낸 뒤** → `:1051~1055` `setTimeout(0)` 한 틱 대기 → `:1060` `openBy(...)`로 메뉴를 연다.
  원본 주석 1046~1056: *"busy off 처리 후 즉시 메뉴를 호출하게 되면 메뉴가 종료되는 문제가 존재하기에 예외 로직 추가."*
  **HTML5 변환이 이 [선택 await → 한 틱 → 메뉴] 순서를 빠뜨린 것이 회귀(regression) 원인.**

---

## 변경 요약 (원본 대비)
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_tree.js` — 디자인 트리 행 우클릭 핸들러 1곳.
- **변경 전**(비직렬화):
  ```js
  oRow.addEventListener("contextmenu", function (e) {
      e.preventDefault(); e.stopPropagation();
      _safeCall("setSelectTreeItem", [sObjid]);                 // await 없음
      if (oAPP.fn.fnWs20ShowTreeContextMenu) { oAPP.fn.fnWs20ShowTreeContextMenu(n, e.clientX, e.clientY); } // 즉시 메뉴
  });
  ```
- **변경 후**(원본 직렬화 1:1 복원):
  ```js
  oRow.addEventListener("contextmenu", async function (e) {
      e.preventDefault(); e.stopPropagation();
      var iX = e.clientX, iY = e.clientY;                       // 좌표 await 전 확보
      try { await _safeCall("setSelectTreeItem", [sObjid]); }   // ① 선택 완전히 끝날 때까지 대기
      catch (err) { console.warn("[HTML5][WS20][tree] ctx select 실패(메뉴는 계속 표시):", err && err.message); }
      await new Promise(function (res) { setTimeout(res, 0); }); // ② 한 틱 대기(원본 1051~1055)
      if (oAPP.fn.fnWs20ShowTreeContextMenu) { oAPP.fn.fnWs20ShowTreeContextMenu(n, iX, iY); } // ③ 그제서야 메뉴
  });
  ```
- **핵심**: 특정 팝업 UI를 예외로 빼는 게 아니라, **모든 UI 공통으로** 원본과 동일한
  `[선택 await → setTimeout(0) → 메뉴 오픈]` 순서로 되돌림. 선택이 팝업을 열어 포커스를 옮기고
  blur가 다 지나간 뒤에 메뉴를 열므로, 메뉴가 blur-close에 지워지지 않는다.
- `setSelectTreeItem`은 Promise 반환(`prev.js:797` `Promise.resolve(fnWs20SelectUI(...))`)이라 await 가능.
- 부수효과 없음: busy는 `fnWs20SelectUI`가 자체 관리(원본처럼 별도 setBusy 감쌈 불필요).
- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_tree.js.br47bak`. `node --check` 통과.

---

## 검수 포인트 (꼭 봐 달라)
1. **원본 1:1 여부**: 변경 후 순서가 원본 `uiDesignArea.js:1036/1051~1055/1060`의
   `[await 선택 → 한 틱 → 메뉴]`와 의미상 동일한가? 원본에 없는 동작(예외/추가 UX)을 넣지 않았는가?
2. **정확성**: `_safeCall`이 setSelectTreeItem의 Promise를 그대로 반환하는가(`tree.js:120` `return fn.apply`),
   그 Promise가 실제로 `refreshPreview`(팝업 open·포커스 이동)까지 끝난 뒤 resolve 되는가?
   (fnWs20SelectUI가 `await refreshPreview`인지 — `attr.js:3139` 부근)
3. **좌표 확보**: `e.clientX/clientY`를 await 이전에 지역변수로 캡처했는가(이벤트 객체 재사용/풀링 대비).
   await 이후 `e.*` 참조가 남아있지 않은가.
4. **노드 유효성**: await(선택→트리 재렌더 가능) 이후 `n`(노드)·`sObjid`로 메뉴를 구성해도
   메뉴 항목 enable 판정(`_buildItems`는 OBJID로 부모·형제 재조회)이 옳게 나오는가. `n`이 stale 되어도 안전한가.
5. **한 틱으로 충분한가**: 원본도 `setTimeout(0)` 한 번인데, blur→`_installIframeBlurClose`의
   `setTimeout(0)` 합성 mousedown이 우리가 메뉴를 열기 전에 모두 소진되는가(경합 여부).
   메뉴 오픈 후 새로운 blur가 다시 발생할 여지는 없는가(포커스는 이미 iframe에 안정적으로 있음).
6. **회귀 없음**: 팝업이 아닌 일반 UI(Button 등) 우클릭·ROOT/APP 라인 우클릭·연속 우클릭(직전 메뉴 `_closeMenu`)
   흐름이 그대로 동작하는가. 조용한 삼킴 없이 오류가 표면화되는가(catch에서 `console.warn`).

---

## 근거
- 원본(SSOT): `www/ws30/ws10_20/design/js/uiDesignArea.js:1003~1063` (특히 1036 await 선택 / 1046~1056 한 틱 대기 주석 / 1060 openBy).
- 규칙: `.claude/rules/code.md` — **비동기·화면전환은 WP1 방식(완료 콜백/await 후 후속 실행, 직렬화)**.
- 관련 메모리: `[[any-page-change-needs-animation]]` 계열의 직렬화 원칙, `nav-inflight-lock-fnNaviLock` 결.
