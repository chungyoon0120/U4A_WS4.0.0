# BR49 검수 요청 (01)

## 이슈
- **코드**: BR49  **화면**: 디자인 레이아웃 변경 팝업 (WS20 Design)
- **현상**: WS20 디자인 화면 좌측 상단 "레이아웃 변경" 버튼으로 팝업을 열어 미리보기/패널 위치를 바꾸고 **저장을 반복**하면, 간헐적으로 팝업 종료 후 `[Critical Error] TypeError: Right-hand side of 'instanceof' is not an object` 가 뜨고 미리보기가 복구되지 않는다.
- 한 번 변경 시 항상은 아니며 **변경·저장 반복** 중 발생. 오류 스택: `closestTo → destroyAggregation → destroy → exit`(UI5 제거 경로).

## 검수 대상 (파일·함수)
- `www/ws30/ws10_20/js/ws_html5_ws20.js` (**내 파일 — 원본 폴더 밖**)
  - `_ws20ArrangeSplit(SPLIT, aOrder)` (약 920행) — 3분할 컨테이너를 저장 순서대로 재배치.
  - `oAPP.fn.setDesignLayout()` (약 960행) — 위 함수 호출 래퍼.
  - `oAPP.fn.fnWs20OpenLayoutPopup` 내부 `_save()`/`_doSave()` (약 1034~1050행) — 저장 확인 후 순서 적용 + 미리보기 재로드.
- **참고(원본, 무수정)**: `design/js/uiPreviewArea.js` `loadPreviewFrame`(139행), `design/preview/index.js` `drawPreview`(8461행)·`removePreviewPage`(7280행)·초기화 `await drawPreview()`(9880행).

## 원인 (소스 확인)
1. `_doSave()`(1046~1050행)는 저장 시 ① `setDesignLayout()` → ② `fnWs20LoadPreview()` 를 **연달아** 호출한다.
2. ① `_ws20ArrangeSplit` 은 순서가 바뀌면 분할 컨테이너를 **비우고 다시 채운다**(934~947행). 미리보기 iframe(`#prevHTML`)이 떼였다 붙으며 **다시 로드**된다 — 원본 개발자 주석 924~925행이 "re-parent(=재로드)"라고 명시.
3. iframe 재로드는 `preview/index.js` 초기화의 `await drawPreview()`(9880행)로 미리보기를 **스스로 재구성**한다(초기 로드와 동일 경로, 이어서 ROOT 셀 재선택까지).
4. 그런데 ②가 곧바로 다시 그리려 하면, `loadPreviewFrame` 의 in-place 빠른 경로(`_loaded===true`, 155행)가 **허물어지는 옛 미리보기 컨텍스트**에서 `drawPreview → removePreviewPage`(8474행) → `_page1/_hbox1/oMenu.destroy()`(7287~7291행)를 돌린다. 재로드로 무효화된 컨텍스트에서 UI5 `destroyAggregation` 의 `instanceof` 우측이 객체가 아니게 되어 **reject**.
5. `loadPreviewFrame` 은 `drawPreview().then()` 만 있고 **catch 가 없어**(155~169행) Uncaught (in promise) → 전역 처리기가 Critical Error 표시. 재로드 self-heal 과 동기 재-draw 의 **경쟁**이라 간헐적이다.

## 원본(UI5)은 왜 안 터지나 — 원본 소스 확인
원본 레이아웃 변경 팝업 `WS_DESIGN/design/js/callDesignLayoutChangePopup.js` 저장 경로:
- `lf_frame`(213~231행)이 **레이아웃 재정의 완료 이벤트(`UIUpdated`) 이후**에 실행되며,
  - 219~225행: 미리보기 UI 참조(`prevRootPage`·`_page1`·`prevPopupArea`·`_hbox1`·`oMenu`)를 **먼저 delete**,
  - 228행: `loadPreviewFrame(true)`(전체 reset 재로드) 호출.
- 참조를 먼저 지우므로 `removePreviewPage` 의 `!_page1` 가드가 조기 return → **destroy 를 아예 안 돌린다.** 그래서 원본은 형변환 오류가 없다.
→ **이 현상은 원본 버그가 아니라, HTML5 변환에서 원본의 안전장치 두 가지(①재렌더 완료 후 실행 ②재-draw 전 참조 먼저 제거)를 누락해 생긴 변환 결함.**

## 변경 요약 (원본 대비)
원본(design) 파일은 **한 줄도 수정하지 않음**. 내 파일 `ws_html5_ws20.js` 만 수정:
1. `_ws20ArrangeSplit` — 실제로 재배치(패널 재부착=iframe 재로드)했으면 `true`, 순서 동일로 생략했으면 `false` 반환.
2. `setDesignLayout` — 위 반환값을 그대로 반환(다른 호출부는 반환 무시 → 무영향).
3. `_doSave()`:
   - 재배치됨(`true`): **★원본 `lf_frame`(219~225행) 재현 — 미리보기 UI 참조 5종을 먼저 delete** → 재로드의 초기 `removePreviewPage` 가 조기 return(destroy 건너뜀). 그리고 **중복 `fnWs20LoadPreview()` 호출 제거**(재로드가 self-heal; 부르면 재로드 직전 옛 컨텍스트에 `_page1` 을 다시 세워 재로드 초기화가 그걸 destroy → 크래시 재현).
   - 재배치 안됨(`false`, 순서 무변경, iframe 재로드 없음): 예전처럼 명시 재로드로 미리보기 갱신(안정 컨텍스트라 destroy 정상).

→ **핵심은 참조 먼저 제거(원본 계약)로 "무효화된 옛 컨텍스트에서 destroy"를 원천 차단**하는 것. 중복 호출 제거는 재로드 초기화가 destroy 를 다시 살리지 않도록 하는 보조.

## 검수 포인트
1. **원인 정합**: 크래시가 정말 "iframe 재로드 self-heal + 동기 재-draw 중복"의 경쟁인지. 재로드가 초기화 경로(`index.js:9880 await drawPreview`)로 미리보기를 완전히 재구성하는지(중복 호출 제거해도 미리보기·ROOT 선택이 복원되는지).
2. **재배치 판정 정확성**: `_ws20ArrangeSplit` 이 (a) 패널 없음(922행) (b) 순서 동일(932행)엔 `false`, 실제 재구성 후에만 `true` 를 반환하는지. 순서가 실제 바뀐 저장에서 항상 iframe 재부착이 일어나는지(부분 이동에도 컨테이너 전체 비움 → preview 포함 재부착).
3. **다른 호출부 무영향**: `setDesignLayout` 의 다른 호출부(`ws_html5_ws20_data.js:547` 초기 트리 로드, `design/js/main.js:823·1930`)는 반환값을 쓰지 않으므로 동작 불변인지.
4. **순서 무변경 저장 경로**: `false` 분기에서 in-place 재로드(`loadPreviewFrame` 빠른 경로)가 재부착 없이 안전하게 미리보기를 갱신하는지(속성 변경 시 상시 쓰는 경로와 동일).
5. **busy/잠금**: 중복 호출 제거로 busy 잔류·조기 해제 문제가 없는지(재배치 분기는 fnWs20LoadPreview 를 안 부르므로 그쪽 busy 를 걸지 않음 — self-heal 재로드의 초기화가 ROOT 셀 재선택으로 정리).
6. **원본 1:1 / 공통 자산**: 원본에 없는 UX·요소 추가 없음, 공통 자산 무수정 확인.

## 근거
- 원본 처리 경로·주석: `design/js/uiPreviewArea.js`(139·155행), `design/preview/index.js`(7280·8461·8474·9880행), 내 파일 주석 924~925행("re-parent=재로드").
- 노션 BR49(이슈 리포트 DB): 상세 내용·재현 절차·오류 스택·소스 처리 경로.
