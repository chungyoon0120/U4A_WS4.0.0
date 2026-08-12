# BR25 검수 요청 (01_request)

## 대상 이슈 (노션 이슈리포트 BR25)
- 화면: WS20 **바인딩 팝업** — 속성 패널 items(aggregation) 행의 바인딩 아이콘으로 여는 "Aggregation : items 바인딩 팝업"
- 현상: 부모 UI의 aggregation 에 바인딩이 있고 하위 UI 속성에도 바인딩이 있는 상태에서 **바인딩 해제** 버튼을 누르면, "모델을 변경하면 자식 오브젝트 프로퍼티에 지정한 바인딩이 초기화됩니다. 계속하시겠습니까?" 확인창이 뜨는데 **화면잠금(BUSY)이 유지돼 확인/취소 버튼을 누를 수 없다.**
- 계측 근거(노션): 확인 버튼 중앙 `document.elementFromPoint()` 결과가 버튼이 아니라 `dialog.u4a-dialog`. `#u4aWsBusyIndicator` open 유지. console/runtime 오류 없음.
- 기대: 확인창 버튼 조작 가능. 확인=하위 UI 유지 + 하위 속성/부모 aggregation 바인딩 해제, 취소=기존 유지, 모든 경로에서 BUSY·임시상태 정리.

## 검수 대상 파일·함수
- `www/ws30/ws10_20/js/fnBindPopupOpen.js`
  - `oAPP.fn.attrBindCallBackAggr` (aggregation 바인딩/해제 콜백)
  - 그 내부 공유 확인창 함수 `_confirm(fnYes)` — 이번 수정 지점

## 원본(as-is) 근거
- `www/ws30/ws10_20/design/js/uiAttributeArea.js` `attrBindCallBackAggr` (:4708~)
  - 함수 진입 시 `parent.setBusy("X")` (:4710) — 화면잠금 ON.
  - **하위 존재 시 unbind 확인창**: `parent.showMessage(sap,30,"I",l_msg,cb)` 직후 **`parent.setBusy("")` (:4753)** → return. 확인창을 띄운 뒤 잠금을 풀어 버튼이 눌리게 함.
  - **재바인딩 확인창**: 동일하게 `showMessage` 직후 **`parent.setBusy("")` (:4831)** → return.
  - 확인창 콜백 내부: 진입 시 `parent.setBusy("X")` 재잠금(:4728·4792), YES 아니면 `parent.setBusy("")` 후 return, YES면 해제 처리 수행.
  - 확인창 없는 경로(하위 없음 unbind :4760~ / 직접 bind :4837~)는 `setBusy("")` 없이 return → 후속(WS20 왕복)이 해제.
- 메시지 키: 122("모델 변경 시 자식 바인딩 초기화") + 123("계속?") — 원본과 동일 키 사용, 신규 문구 없음.

## 변경 요약 (원본 대비)
- 문제: HTML5 `attrBindCallBackAggr`(fnBindPopupOpen.js:1454~)는 진입 시 `_busy(true)`(=`parent.setBusy("X")`)로 잠그고, 공유 확인창 `_confirm`이 `U4AUI.confirm`으로 확인창만 띄운 뒤 **원본의 "확인창 직후 setBusy("")"(:4753·4831)에 해당하는 잠금 해제가 빠져** 있었다. 그래서 화면잠금이 켜진 채 확인창이 떠 `document.body`의 마우스 이벤트 차단(`pointerEvents="none"`, resources/index.js `setBusy`)이 확인창 버튼까지 먹어 클릭이 확인창 판으로 흡수됐다.
- 수정: 공유 확인창 함수 `_confirm`이 확인창을 띄운 **직후 `_busy(false)`** 를 호출하도록 1줄 추가(원본 :4753·4831 1:1). 확인창은 모달이라 뒷화면은 자동 차단되고, YES/NO 콜백은 기존대로 `_busy(true)`(재잠금 후 해제 작업)/`_busy(false)`(취소)로 짝을 맞춘다.
- `_confirm`은 하위 존재 unbind(:1476)·재바인딩(:1489) 두 경로가 공유 → 원본이 두 경로 모두 `setBusy("")` 하는 것을 한 곳(`_confirm` 말미)으로 1:1 반영.

## 검수 포인트
1. **원본 1:1 여부**: 확인창 직후 잠금 해제(`_busy(false)`)가 원본 `attrBindCallBackAggr`의 `setBusy("")`(:4753·4831)와 동작·시점이 같은가. 임의 추가/누락 없나.
2. **BUSY 짝(대칭)**: 진입 `_busy(true)`(:1455) 후 모든 종료 분기에서 해제가 맞물리는가 —
   - 하위존재 unbind: `_confirm`→띄운 뒤 `_busy(false)`, YES→`_busy(true)`재잠금→doUnbind→WS20 왕복 해제, NO→`_busy(false)`.
   - 하위없음 unbind(:1476 else)·직접 bind(:1493 else): `_busy(true)` 유지→WS20 왕복 해제(원본 동일).
   - 재바인딩: `_confirm`→`_busy(false)`, YES→재잠금→doBind→WS20 왕복, NO→`_busy(false)`.
   자기해제 금지·왕복 해제 규칙(code.md)에 어긋나지 않는가.
3. **정확성/회귀**: 확인창을 띄운 뒤 `_busy(false)`가 실행되는데, 직후 호출측 `lf_unbindBtnEvt`(:1425)가 `lf_close()`로 바인딩 팝업을 닫는다. 확인창(별도 모달)은 남아 조작 가능한가. YES 시 doUnbind(attrUnbindAggr→attrSetUnbindProp→attrChange→designBroadcastUpdate, attrUnbindTree)가 정상 수행되고 BUSY가 최종 해제되는가.
4. **공통 자산 미수정**: `resources/index.js`의 공통 `setBusy`·`U4AUI.confirm`은 손대지 않고 화면(팝업) 코드만 고쳤는가.
5. **삼킴 금지**: 조용한 catch·오류 억제 없이 처리됐는가(추가한 것은 `_busy(false)` 1줄 + 주석).

## 미해결/보고만
- 없음. (하위없음 unbind·직접 bind 경로가 `_busy(true)`를 유지한 채 WS20 왕복으로 해제되는 것은 원본과 동일한 설계라 손대지 않음.)
