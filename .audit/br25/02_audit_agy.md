# 02_audit_agy — BR25 바인딩 팝업 Aggregation 해제 confirmation 잠금 해제 검수 결과

## 판정

**통과 (Pass)**

---

## 1. 검수 개요 및 배경

- **대상 기능**: WS20 바인딩 팝업(Aggregation : items 바인딩 팝업)의 Aggregation 바인딩/해제 콜백 (`attrBindCallBackAggr`)
- **원본 버그**: 하위 UI 속성에 바인딩이 존재하는 상태에서 Aggregation 바인딩 해제(또는 재바인딩) 클릭 시 "자식 오브젝트 바인딩 초기화" confirmation 팝업이 표시되지만, 팝업 오픈 전 진입부에서 가동한 화면 잠금(`_busy(true)`)을 해제하지 않아 확인창을 포함한 전체 화면에 BUSY 마스크가 덮여 확인/취소 버튼을 클릭할 수 없었던 현상.
- **수정 정책**: 원본 `uiAttributeArea.js:4753, 4831`과 동일하게 확인창(`U4AUI.confirm`)을 생성해 호출한 직후 `_busy(false)`를 실행하여 화면 잠금을 해제. 확인창은 모달 다이얼로그이므로 뒤쪽 화면만 차단되고 확인창 버튼 클릭이 가능해짐.

---

## 2. 검수 포인트별 심층 대조 분석

| # | 검수 포인트 | 코드 위치 및 검증 내용 | 결과 |
|---|---|---|---|
| 1 | **원본 1:1 동작/시점 대칭성** | [fnBindPopupOpen.js:1460-1470](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnBindPopupOpen.js#L1460-L1470)<br>확인창 띄운 직후 `_busy(false)` 호출 ➔ 원본 `uiAttributeArea.js:4753, 4831`의 `showMessage` 직후 `parent.setBusy("")`와 호출 시점 및 동작이 1:1 완벽 일치함. | **통과 (Pass)** |
| 2 | **BUSY 대칭성 및 수명주기** | [fnBindPopupOpen.js:1464-1469](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnBindPopupOpen.js#L1464-L1469)<br>- 진입 시 `_busy(true)`<br>- confirmation 오픈 직후 `_busy(false)` (버튼 조작 허용)<br>- YES 클릭 시 `_busy(true)` (해제 작업 재잠금) ➔ `doUnbind` ➔ `attrSetUnbindProp` ➔ `fnWs20AttrChange` `finally`에서 최종 `_busy(false)` 해제.<br>- NO 클릭 시 `_busy(false)` (취소 정리).<br>모든 분기에서 잠금 짝이 대칭으로 정렬됨. | **통과 (Pass)** |
| 3 | **조작성 및 후속 로직 안정성** | 확인창 팝업이 `U4AUI.confirm` 모달 다이얼로그로 렌더링되므로 `_busy(false)`에 의해 BUSY 마스크가 걷히면 팝업의 YES/NO 버튼이 정상 포커스 및 클릭 가능함. YES 시 `doUnbind` 및 `doBind` 후속 동작 정상 수행됨. | **통과 (Pass)** |
| 4 | **공통 자산 미수정 스코프 안전성** | `resources/index.js`나 `U4AUI.confirm` 등 공통 UI 모듈은 단 1줄도 수정하지 않고, `fnBindPopupOpen.js` 내부 `_confirm` 함수 스코프 내에서만 처리하여 안전함. | **통과 (Pass)** |
| 5 | **구문 및 예외 삼킴 검증** | `node --check` 구문 검사 통과. 조용한 catch나 에러 삼킴 없이 원본 짝에 맞게 `_busy(false)` 1줄이 적절히 배치됨. | **통과 (Pass)** |

---

## 3. 정적 구문 대조

- **수정 코드 (`fnBindPopupOpen.js:1460-1470`)**:
  ```javascript
  function _confirm(fnYes) {
    var l_msg = _mw("122") + _mw("123");
    if (window.U4AUI && U4AUI.confirm) {
      U4AUI.confirm({ type: "C", message: l_msg, onClose: function (act) { if (act === "YES") { _busy(true); fnYes(); } else { _busy(false); } } });
    } else { _msg(30, "I", l_msg, function (p) { if (p === "YES") { _busy(true); fnYes(); } else { _busy(false); } }); }
    // [BR25] 확인창을 띄운 직후 화면잠금 해제 — 원본 attrBindCallBackAggr(uiAttributeArea.js:4753·4831) 1:1
    _busy(false);
  }
  ```

---

## 4. 종합 평가

`br25` 관련 바인딩 팝업 Aggregation 해제 confirmation 확인창 BUSY 미해제 건은 원본의 잠금 해제 시점을 정확히 이식하여 버그를 완벽히 해결하였으며, 잠금 짝 대칭성 및 공통 모듈 미수정 원칙을 철저히 준수하므로 최종 **통과(Pass)** 판정합니다.
