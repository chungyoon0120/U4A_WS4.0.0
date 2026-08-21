# BR60 검수 요청서 (01_request)

## 대상 이슈
- 코드: **BR60** / 화면: **디자인 레이아웃 변경 팝업** (WS20 Design → 좌측 레일 "Split Position Change" → 팝업)
- 내용: 원본(UI5) 대비 **동작 4건이 다름**. 특정 건만 땜질하지 말고 원본 흐름대로 복원할 것.
  1. 타일 끌어 옮기기 방식이 다름(원본=자리 맞바꿈 / 변환본=밀어넣기)
  2. 닫기·취소로 닫을 때 취소 안내가 안 뜸
  3. 저장하는 동안 화면 잠금(로딩 표시)이 없음
  4. 저장이 도는 동안 단축키 잠금이 없음
- 이슈 비고: 버튼 강조색 차이는 HTML 공통 버튼 표준에 맞춘 의도적 적응(결함 아님).
  반복 저장 시 Critical Error(BR49)는 별건이며 이미 처리됨.

---

## 검수 대상 (파일 / 함수 / 라인)
| 파일 | 함수/위치 | 역할 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_html5_ws20.js` | `oAPP.fn.fnWs20OpenLayoutPopup` (983행~) | **이번 수정 지점.** 레이아웃 변경 팝업 전체 |
| 〃 | 카드 `drop` 핸들러 1027~1039행 | (1) 맞바꿈으로 교체 |
| 〃 | `_close(bSkip)` 1045~1053행 | (2) 취소 안내 |
| 〃 | `_doSave()` 내 잠금/`_unlock` 1059~1130행 | (3)(4) 화면잠금·단축키잠금 |
| (참조·원본 SSOT) `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\callDesignLayoutChangePopup.js` | `lf_drop` 281~310 / `lf_close` 167~179 / `lf_save` 237~276 / `lf_after` 185~208 / `lf_frame` 214~231 | 원본(UI5) 정답 |
| (참조·원본) 〃 `design\js\uiPreviewArea.js` | `loadPreviewFrame` 351행~ | 원본 미리보기 재로드(※ 이 함수 안에는 잠금 해제 없음 — 확인함) |
| (참조) `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` | `oAPP.fn.setShortcutLock` 313행 | HTML5 단축키 잠금 구현 |
| (참조) `www/ws30/ws10_20/js/ws_html5_shell.js` | `parent.setBusy` 경유 화면잠금 | HTML5 화면 잠금(로딩 표시) |

- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20.js.br60bak`
- `node --check ws_html5_ws20.js` 통과.
- **원본 폴더 무수정**(수정은 전부 원본 폴더 밖 `js/ws_html5_ws20.js` 한 파일).

---

## 변경 요약 (원본 대비)

### (1) 끌어 옮기기 = 밀어넣기 → **자리 맞바꿈**
원본 `lf_drop` 299~303행은 끌던 타일의 위치값과 놓인 타일의 위치값을 **서로 교환**한 뒤 위치값으로 정렬한다.
→ 결과는 **두 타일 자리만 맞바뀌고 사이에 낀 타일은 그대로**.

```js
// 원본 lf_drop (callDesignLayoutChangePopup.js 291~307)
var l_drag_index = oDlg.indexOfContent(l_tile);                       // 끌던 타일 순번
var l_drop_index = oDlg.indexOfContent(oEvent.mParameters.droppedControl); // 놓인 타일 순번
oMdl.setProperty("POSIT", l_drop_index, l_drag_ctxt);   // 끌던 타일 ← 놓인 자리
oMdl.setProperty("POSIT", l_drag_index, l_drop_ctxt);   // 놓인 타일 ← 끌던 자리
lf_sort(oDlg);                                          // POSIT 기준 재정렬
```

- **변경 전**(밀어넣기):
  ```js
  var iFrom = aWork.indexOf(_dragSid), iTo = aWork.indexOf(sid);
  aWork.splice(iFrom, 1);
  aWork.splice(iTo, 0, _dragSid);
  ```
- **변경 후**(맞바꿈, `ws_html5_ws20.js` 1035~1037행):
  ```js
  var iFrom = aWork.indexOf(_dragSid), iTo = aWork.indexOf(sid);
  if (iFrom === -1 || iTo === -1) { return; }
  var sTmp = aWork[iFrom]; aWork[iFrom] = aWork[iTo]; aWork[iTo] = sTmp;   // 맞바꿈(swap)
  ```
- 검증 예: `[트리·미리보기·속성]`에서 트리를 속성 위로 끌기 → 원본/변경후 = `[속성·미리보기·트리]`.
  (이웃끼리 옮기면 두 방식 결과가 같아 그동안 티가 안 났음.)

### (2) 닫기·취소 시 **취소 안내** (원본 `lf_close`)
원본 167~179행: `lf_close(oDlg, bSkip)` — `bSkip` 이 참이면 닫기만, 아니면 `MSG_WS 001`(Cancel operation)을
`parent.showMessage(sap, 10, "I", ...)` 로 띄운다. 저장 완료 경로(`lf_after` 205행)만 `lf_close(oDialog, true)`로
안내를 생략한다.

- **변경 후**(1045~1053행): `_close(bSkip)` 로 인자 추가.
  ```js
  function _close(bSkip) {
      try { DLG.close(); } catch (e) { } DLG.remove();
      if (bSkip) { return; }
      var s001 = ""; try { s001 = oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "001"); } catch (e) { }
      try { if (parent.showMessage) { parent.showMessage(null, 10, "I", s001); } } catch (e) { }
  }
  ```
- 호출부: 우상단 X·하단 닫기 버튼(`data-act="close"`) → `_close()` / ESC(`cancel` 이벤트) → `_close()` /
  저장 성공 종료 → `_close(true)`(1130행).
- 메시지 키는 **원본에 있는 001 그대로**(새 문구·새 키 생성 없음).

### (3)(4) 저장 중 **화면 잠금 + 단축키 잠금** (원본 `lf_save`)
원본 242~272행: 확인창 콜백에서 `parent.setBusy("X")`(244) → 아니오면 `setBusy("")` 후 return(247) →
예면 `oAPP.fn.setShortcutLock(true)`(253) → 정렬 → 영역 제거 → `lf_after` → `lf_frame` → `loadPreviewFrame`.

- **변경 후**: `_doSave()` 진입부에서 둘 다 걸고(1064~1065행), 해제는 `_unlock()` 한 곳으로 대칭 처리(1066~1069행).
  ```js
  try { if (parent.setBusy) { parent.setBusy("X"); } } catch (e) { }
  try { if (oAPP.fn.setShortcutLock) { oAPP.fn.setShortcutLock(true); } } catch (e) { }
  function _unlock() {
      try { if (oAPP.fn.setShortcutLock) { oAPP.fn.setShortcutLock(false); } } catch (e) { }
      try { if (parent.setBusy) { parent.setBusy(""); } } catch (e) { }
  }
  ```
- **해제 시점(WP1 직렬화)** — 종료 분기 전부에 짝을 붙였다:
  | 경로 | 조건 | 해제 시점 |
  |---|---|---|
  | 재배치됨 + 미리보기 iframe 있음 | `setDesignLayout()===true` | **iframe `load` 이벤트**(재로드 완료) 후 `_unlock()` (1111행) |
  | 재배치됨 + iframe 없음 | 〃 | 즉시 `_unlock()` (1114행) |
  | 재배치됨 + 대기 배선 중 예외 | 〃 | `catch` 에서 `_unlock()` (1115행) — 잠금 고착 방지 |
  | 재배치 안 됨(순서 그대로) | `false` | 즉시 `_unlock()` (1119행) |
  | 순서 그대로 + 앞선 재로드 진행 중 | BR49-P2 분기 | 즉시 `_unlock()` (1124행) |
  | 순서 그대로 + 명시 재로드 | else 분기 | 재로드 호출 후 `_unlock()` (1128행) |
- 팝업 자체는 원본과 같이 저장 직후 닫히고(`_close(true)`), **화면 잠금만 미리보기가 다 뜰 때까지 유지**한다
  (원본 `lf_after` 205행에서 팝업 destroy → `lf_frame` 에서 재로드하는 순서와 같은 결).

---

## 검수 포인트 (꼭 봐 달라)

1. **★잠금 고착 위험(최우선)**: 재배치 경로에서 화면 잠금 해제를 **미리보기 iframe 의 `load` 이벤트**에 걸었다.
   3분할 컨테이너 재구성으로 iframe 이 떼였다 붙을 때 `load` 가 **반드시** 다시 발생하는가?
   발생하지 않는 경우(예: 재부착이 생략되는 조건, 이미 로드 완료 후 재부착 없이 끝나는 조건)가 있으면
   화면이 잠긴 채 고착된다. (같은 리스너 방식이 BR49 에서 이미 쓰이고 실화면 BR49-1~3 통과했지만,
   그때는 표시값 해제용이라 실패해도 화면이 안 잠겼다 — 이번엔 실패 시 화면이 잠긴다.)
   · 이중 안전장치(시간제한 해제 등)를 두는 게 맞는지, 아니면 원본에 없으니 두면 안 되는지 판단 바람.
   (원본은 `loadPreviewFrame` 안에 잠금 해제가 없음 — 원본이 **어디서** 잠금을 푸는지는 **미확인**.
   원본이 안 푸는 지점이 있다면 원본 자체 결함일 수 있으니 그 판단도 함께.)

2. **원본 1:1 (맞바꿈)**: 변경된 맞바꿈이 원본 `lf_drop` 의 위치값 교환 + 위치값 정렬과 **모든 조합에서** 동일한
   결과를 내는가? 3장 기준 6가지 끌기 조합을 다 따져 확인 바람.
   (원본은 위치값을 바꾸고 다시 정렬, 내 구현은 배열 자리를 직접 교환 — 결과 동치인가?)

3. **취소 안내 호출 형태**: 원본은 `parent.showMessage(sap, 10, "I", 001)`. 내 구현은 첫 인자에 `null` 을 넘긴다
   (HTML5 대체 구현에서 UI5 객체 미사용). 이 화면의 다른 안내 호출과 형태가 일치하는가?
   안내가 실제로 뜨는가(모드 10 = 안내 경로가 맞는가)?

4. **저장 확인창 전후 잠금 차이(원본과 다른 점 — 판단 요청)**:
   원본은 저장 버튼 누름 즉시 `setBusy("X")`(133행) → 확인창 → **확인창이 떠 있는 동안** `setBusy("")`(274행) 로
   푼 뒤, 예를 누르면 콜백에서 다시 `setBusy("X")`(244행). 내 구현은 **확인창 단계엔 잠금을 걸지 않고**
   "예" 이후에만 건다. 결과(확인창 동안 잠금 없음 / 예 이후 잠금)는 같지만 경로가 다르다.
   원본 1:1 로 맞춰야 하는지, 지금이 맞는지 판단 바람.

5. **잠금 짝(누수) 전수**: `_doSave` 의 **모든** 종료 분기에서 `_unlock()` 이 정확히 한 번 도는가?
   중복 해제(두 번 호출)로 다른 곳이 건 잠금까지 푸는 경우는 없는가?
   (특히 `catch (e) { _unlock(); }` 와 그 안쪽 `else { _unlock(); }` 가 겹칠 여지)

6. **단축키 잠금 함수 실재**: `oAPP.fn.setShortcutLock` 이 이 화면 런타임에 **실제로 정의돼 있는가**
   (파일에 있음 ≠ 로드됨 — BR34 교훈). 없으면 조용히 건너뛰게 돼 (4)번이 무효가 된다.
   `typeof` 가드가 fail-open 인 게 맞는지(BR35 는 fail-closed 로 갔음).

7. **BR49 회귀 없음**: 이번에 넣은 `_unlock()` 들이 BR49 의 재로드 겹침 방지 처리
   (`__ws20PrevReloading` 표시, 명시 재로드 생략 분기)와 충돌하지 않는가?
   반복 저장(열기→바꾸기→저장 5회 이상)에서 오류가 다시 나지 않는가?

8. **조용한 삼킴 금지 규칙**: 잠금 걸기/풀기를 `try{}catch(e){}` 로 감쌌다(빈 catch).
   `.claude/rules/code.md` 의 "오류 삼킴 금지"에 걸리는가? 걸린다면 어느 수준까지 표면화해야 하는가.

---

## 참고 — 이번 범위 밖에서 발견(반영 안 함, 보고만)
- 원본 팝업은 `new sap.m.Dialog({draggable:true})`(원본 23행)로 **창을 끌어 옮길 수 있다**.
  현재 HTML5 변환본에는 헤더 드래그·헤더 더블클릭 중앙복귀·우하단 크기조절이 **하나도 안 붙어 있다**
  (`ws_html5_ws20.js` 에 `makeDialogDraggable`/`makeDialogRecenter`/`makeDialogResizable` 호출 0건).
  이슈에 없는 항목이라 **임의로 추가하지 않았다.** 별건 등록 여부는 장군님 판단 요청.

---

## 근거
- 원본(SSOT): `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\callDesignLayoutChangePopup.js`
  (디자인 영역이므로 원본 위치 ②. `.analy/18_원본소스_위치_SSOT.md`)
  · `lf_drop` 281~310 (맞바꿈) · `lf_close` 167~179 (취소 안내 001·bSkip)
  · `lf_save` 242~272 (확인창 → 화면잠금 244 → 단축키잠금 253) · `lf_after` 205 (저장 종료는 안내 생략)
- 규칙: `.claude/rules/code.md` — 원본 1:1 / busy 켰으면 모든 종료 분기에서 짝 해제 /
  **WP1 방식**(로딩 표시는 화면 렌더가 완전히 끝난 뒤에 끔) / 메시지는 원본 키 참조.
- 관련 이슈: BR49(같은 팝업의 반복 저장 오류, 별건·처리 완료) — `.audit/br49/`.
