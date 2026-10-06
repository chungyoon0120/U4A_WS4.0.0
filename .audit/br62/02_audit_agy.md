# 02_audit_agy — BR62 되돌리기(Undo)·다시하기(Redo) 원본 불일치 및 미리보기 부분 갱신 심층 검수

## 판정

**수정필요 (보완 대기)**

이름 변경(A) 및 삭제(C) 시의 되돌리기 선택 앵커 보존과 스냅샷 차분 기반의 미리보기 부분 갱신(B, D) 메커니즘은 원본의 철학과 동작 계약을 매우 정교하게 모사하고 있습니다.
그러나, 매우 보수적이고 엄격한 2차 교차 검증을 수행한 결과, **이동 되돌리기 시의 인스턴스 떼어내기 인자 오지정으로 인한 참조 누수/중복 생성 버그와, 예외 삼킴으로 인한 안전 폴백 무력화 등 2건의 치명적 결함(P1) 및 스크롤 복원 타이밍 결함(P2)이 확인되어 수정을 요구**합니다.

---

## 지적 및 보완요구 사항

### 1. [P1 - 치명결함] 이동(Move) 되돌리기 시 `prevRemoveUiObject` 인자 오지정으로 인한 중복 부착/참조 누수
- **발견 위치**: `ws_html5_ws20_edit.js` (406~407행)
  ```javascript
  for (k in setMove) {
      if (_ancestorIn(oOld, k, setMove) || _ancestorIn(oOld, k, setAdd)) { continue; }
      var oN = oOld[k];
      try { if (oAPP.oDesign && oAPP.oDesign.fn && typeof oAPP.oDesign.fn.prevRemoveUiObject === "function") { await oAPP.oDesign.fn.prevRemoveUiObject(oN); } } catch (e) { }
      ...
  ```
- **결함 내용**:
  - `prevRemoveUiObject`는 내부적으로 `delUIObjPreView`를 호출하여 부모의 집계(Aggregation)로부터 대상 UI를 분리(떼어내기)합니다.
  - 현재 미리보기 화면(DOM) 상에서 대상 UI는 **되돌리기 직전 위치인 현재 부모(`oNew[k].POBID`)**에 붙어 있습니다.
  - 그러나 현재 코드는 `prevRemoveUiObject`에 복원할 **과거 상태인 `oN` (`oOld[k]`)**을 넘기고 있습니다. 이로 인해 함수는 UI가 존재하지도 않는 '과거의 부모'에서 떼어내기를 시도하게 되어, **현재 부모(`oNew[k]`)에서는 UI가 분리되지 않고 그대로 남아있게 됩니다.**
  - 직후 `moveUIObjPreView`를 통해 과거 부모에 UI를 다시 부착하게 되면, UI5 내부에서 부모 중복 할당 에러(`already has a parent`)가 터지거나 화면상에 동일 UI가 2벌로 중복 렌더링(고아 노드 발생)되는 심각한 상태 불일치가 발생합니다.
- **수정 요구**:
  - 미리보기에서 떼어낼 때는 반드시 **현재 실제로 부착되어 있는 위치 기준(`oNew[k]`)**을 전달해야 합니다.
  ```javascript
  // 수정 전: await oAPP.oDesign.fn.prevRemoveUiObject(oN);
  // 수정 후:
  await oAPP.oDesign.fn.prevRemoveUiObject(oNew[k]);
  ```

---

### 2. [P1 - 치명결함] `_applyPartialPreview` 내부 예외 삼킴으로 인한 안전 폴백(Fallback) 무력화
- **발견 위치**: `ws_html5_ws20_edit.js`
  - `_applyAttrPreview` 내부 (303~307행, 328~331행, 336~339행, 345~349행)
  - `_applyPartialPreview` 내부 `setMove` 영역 (407~408행)
- **결함 내용**:
  - 설계 사양(P5)상 "부분 갱신 중 한 곳이라도 오류가 발생하면 예외를 던져 상위 `_restoreSnap`에서 `drawPreview()`(전체 재생성)로 안전 폴백"하도록 되어 있습니다.
  - 그러나 실제 구현에서는 개별 호출(`previewUIsetProp`, `setModelBind`, `attrUnbindProp`, `prevRemoveUiObject`, `reCreateUIObjInstance` 등)이 `try-catch`로 에러를 콘솔에만 찍거나 빈 블록으로 조용히 삼켜버립니다.
  - 이로 인해 미리보기 DOM이나 프로퍼티 반영 도중 예외가 발생해 화면이 절반만 갱신된 깨진 상태가 되더라도, `_applyPartialPreview`는 정상 완료(`return true;`)로 끝나며 **상위의 `drawPreview()` 전체 재생성 폴백이 전혀 작동하지 않는 치명적인 무결성 파괴**가 일어납니다.
- **수정 요구**:
  - 부분 갱신 중 실패가 발생하면 즉시 전체 재생성 폴백이 가동되도록, `catch (e)` 블록에서 에러를 삼키지 말고 `throw e;`로 상위에 재전파해야 합니다.

---

### 3. [P2 - 안정성] 전체 재생성 폴백 시 비동기 DOM 렌더링 미고려로 인한 스크롤 복원 무효화 위험
- **발견 위치**: `ws_html5_ws20_edit.js` (517~519행)
  ```javascript
  if (w && typeof w.drawPreview === "function") { await w.drawPreview(); }
  _restorePrevScroll(_prevScroll);
  ```
- **결함 내용**:
  - `drawPreview()`가 비동기 완료되더라도, 브라우저가 실제 DOM 트리를 그리고 레이아웃 높이를 확정하는 페인팅 작업은 다음 이벤트 루프 틱에서 완료됩니다.
  - `await drawPreview()` 직후 동기적으로 `_restorePrevScroll`(`scrollTo`)을 호출하면, iframe 문서의 높이가 아직 0이거나 충분히 늘어나지 않은 상태여서 스크롤 명령이 무시되고 화면 최상단으로 튕기는 현상이 발생할 수 있습니다.
- **수정 요구**:
  - UI5 렌더링 틱이 완료된 후 스크롤이 복원될 수 있도록 `setTimeout(..., 0)` 또는 `requestAnimationFrame` 형태의 타이밍 보정을 권장합니다.

---

## 검수 항목별 상세 평가

| # | 항목 | 판정 | 확인 근거 |
|---|---|---|---|
| P1 | **부분 갱신 분류 정확성** | 통과 | `oNew`와 `oOld`의 차분 비교를 통해 `setRemove`, `setAdd`, `setMove`, `setAttr` 4개 집합으로 분류하는 로직이 모든 편집 종류를 빈틈없이 포함합니다. `_aggrPos`를 통한 그룹 내 인덱스 변이 감지도 정확합니다. |
| P2 | **이중 부착/누락 방지** | 통과 | 최상위 노드만 `moveUIObjPreView`로 제자리 인덱스(`_aggrPrevIndex`)에 부착하고, 하위 자식 노드는 재귀 생성 후 `setUIParent`로만 부모에 연결하여 원본 `createPreviewUI`(655~661)와 동일하게 이중 부착을 방지합니다. |
| P3 | **상위/하위 중복 처리** | 통과 | `_ancestorIn`을 통해 상위 노드가 재구성될 때 하위 노드의 중복 처리를 안전하게 스킵합니다. 부모 이동(`setMove`) 시 `reCreateUIObjInstance`가 최신 `prev` 데이터로 자식까지 일괄 생성하므로 누락이 없습니다. |
| P4 | **이름 변경(Rename) 경로** | 참고 | 원본은 인스턴스 키만 rename 처리하나, 현재 diff 방식 특성상 `setRemove`(옛이름) + `setAdd`(새이름)로 인식되어 서브트리가 파괴 후 재생성되는 오버헤드가 발생합니다. 기능적 복원은 정상이나 화면 깜빡임이 있을 수 있습니다. |
| P5 | **폴백 안전성** | **수정필요** | ROOT/APP 변경 및 40개 초과 시의 throw 처리는 안전하나, 지적 2번(예외 삼킴)으로 인해 부분 갱신 도중 실패 시의 폴백이 무력화되어 있습니다. |
| P6 | **부모 렌더링 순서** | 통과 | 영향받은 부모별로 `await _rerenderParentRTE(oPar)`를 순차 수행하여 RichTextEditor 등 비동기 렌더링 컨트롤 간의 경쟁 상태(Race Condition)를 안전하게 방지합니다. |
| P7 | **이름 변경 이력 앵커** | 통과 | `attrChnageOBJID`에서 되돌리기 이력 적재 시 `ls_uiinfo.OBJID_bf`(옛 이름)를 넘겨, 되돌리기 시에는 옛 이름 UI가, 다시하기 시에는 새 이름 UI가 정확히 선택되도록 양방향 앵커가 완벽히 구성되었습니다. |
| P8/P9 | **삭제 되돌리기 앵커** | 통과 | 지운 노드의 OBJID를 기록하여 삭제 되돌리기 시 되살아난 노드가 선택되도록 원본 `CL_INSERT_UI`(543) 계약을 완벽히 모사했습니다. 다건 삭제의 첫 번째 대표 노드 지정 및 재삭제 시 부모 대체 앵커(`sSelParent`) 폴백도 정합합니다. |
| P10 | **되돌리기 중 재진입/잠금** | 통과 | `_bHistBusy` 플래그를 통한 재진입 방지와 `try/finally` 내 `_broadBusy` 해제가 완벽한 짝을 이루고 있어 비동기 대기 중 락 누수가 없습니다. |
| P11 | **원본 무수정 원칙** | 통과 | `design/` 하위 원본 사본은 전혀 건드리지 않고, 모든 미리보기 제어는 iframe 인터페이스(`_prev`) 및 기존 이식 함수를 통해 안전하게 수행됩니다. |
| P12 | **조용한 오류 삼킴** | **수정필요** | 지적 2번과 동일. `_applyAttrPreview`와 `_applyPartialPreview` 내부의 `try/catch`가 에러를 삼켜 폴백을 방해하므로 `throw` 전파 수정이 필요합니다. |

---

## 종합 결론 및 제안

1. `setMove` 루프의 `prevRemoveUiObject` 인자를 `oOld[k]`에서 **현재 위치인 `oNew[k]`**로 변경하십시오.
2. `_applyAttrPreview` 및 `_applyPartialPreview` 내부의 `try/catch`에서 에러를 삼키지 말고 `throw e;`로 상위에 재전파하여, 부분 갱신 실패 시 `drawPreview()` 전체 재생성 폴백이 온전히 가동되도록 수정하십시오.
3. 전체 재생성 폴백 시의 `_restorePrevScroll` 호출 타이밍을 비동기 렌더링 완료 후로 보정하십시오.
4. 해당 수정 완료 후 실화면 테스트(BR62-1~9)를 진행하여 주시기 바랍니다.
