# BR38 검수 요청 (01_request)

## 버그 내용 (노션 이슈 BR38)

- **현상**: WS20 Design 영역에서 **Design Tree의 UI를 선택**하면 미리보기(Preview)에서도 그 UI가 선택
  처리되지만, 선택한 UI가 **미리보기의 현재 표시 범위를 벗어난 경우** 그 위치로 **스크롤이 이동하지 않는다.**
  (테스트: Design Tree에서 BUTTON115 선택 → Tree·UI Attribute 영역 선택정보는 BUTTON115로 바뀌었으나
  미리보기 스크롤은 그 위치로 안 내려감.)
- **반대 방향(미리보기 → Design Tree)**: 미리보기에서 UI를 클릭하면 대응 Tree 라인을 선택하고, 그 라인이
  표시 범위 밖이면 스크롤 이동한다. 이 방향은 `setSelectTreeItem → desginSetFirstVisibleRow`로 이미 동작.
- **기대 결과**: 선택 UI가 미리보기 표시 범위 밖이면 그 위치가 보이도록 스크롤 이동, **이미 보이면 기존
  위치 유지.**

## 검수 대상

- **파일**: `www/ws30/ws10_20/design/preview/index.js`
- **함수**: `oWS.sMark.fn_mark(oMarkUi)` (미리보기 UI 선택 표시 함수)
- **호출 경로**: `ws_html5_ws20_attr.js` `fnWs20SelectUI`(= setSelectTreeItem 11단계, 마지막)
  → 미리보기 iframe `selPreviewUI(OBJID)` → `oWS.sMark.fn_mark(...)`

## 변경 요약 (원본 대비)

- **원인**: HTML5 변환본 `fn_mark`는 선택 강조(CustomData)·선택 테두리(선택 레이어)까지만 처리하고,
  **선택한 UI의 화면요소를 미리보기 화면 안으로 스크롤 이동시키는 처리가 빠져 있었다.**
- **수정**: `fn_mark` 끝(선택 레이어 갱신 뒤, `return` 앞)에 선택 UI 스크롤 이동을 복원.
  ```js
  setTimeout(function () {
      try {
          var _oDom = (oMarkUi && typeof oMarkUi.getDomRef === "function") ? oMarkUi.getDomRef() : null;
          if (_oDom && typeof _oDom.scrollIntoView === "function") {
              _oDom.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
      } catch (e) {
          parent.console && parent.console.error("[HTML5][WS20][prev] fn_mark 선택 UI 스크롤 이동 오류:", e && e.message);
      }
  }, 0);
  ```
  - **`block:"nearest"`** = 이미 보이면 유지, 표시 범위 밖일 때만 이동(기대 결과 그대로).
  - `setTimeout(…,0)` = 선택 레이어/렌더가 자리 잡은 뒤 이동(원본 `fn_mark`도 setTimeout 뒤 스크롤).
- **백업**: `www/ws30/ws10_20/design/preview/_index.js.br38bak`

## 검수 포인트

1. **정확성**: Design Tree → 미리보기 방향에서 화면 밖 UI 선택 시 스크롤이 그 위치로 이동하는가.
   이미 보이는 UI 재선택 시 스크롤이 튀지 않고 유지되는가(`block:"nearest"` 의미 확인).
2. **원본 1:1 / 임의창작 여부**: 스크롤 방식으로 "밖일 때만 이동"을 택함. 근거 3종 —
   (a) 이슈 기대결과에 "표시 범위 안이면 기존 위치 유지" 명시,
   (b) 반대 방향(미리보기→트리)도 "밖일 때만 이동",
   (c) 원본 속성영역 `uiAttributeArea.js:8303` 이 `scrollIntoView({ block:"nearest", ... })` 사용.
   → 원본에 이미 있는 방식인지, 임의 추가는 아닌지 확인.
   (참고: `_`백업 폴더 옛 미리보기 `_preview/index.js:111`은 `scrollIntoView(true)`=항상 맨위정렬이나,
   `_`폴더는 현행 근거에서 제외 규칙이라 위 3종 근거를 따름.)
3. **부작용**: 미리보기가 iframe 안이라 스크롤 이동이 iframe 내부에만 미치는가(바깥 WS20 레이아웃
   흔들림 없음). 미리보기에서 직접 클릭(반대 방향) 시에도 이미 보이는 위치라 `block:"nearest"`로
   불필요 스크롤이 없는가.
4. **오류 처리**: DOM 미확보/예외를 삼키지 않고 `console.error`로 표면화(오류 삼킴 금지) 했는가.
   `getDomRef`·`scrollIntoView` 존재 가드가 적절한가.

## 근거

- 원본 미리보기 선택 스크롤: `fn_mark` 의 선택 UI `scrollIntoView` (미리보기 화면 안으로 이동).
- 원본 "밖일 때만 이동" 패턴: `design/js/uiAttributeArea.js:8303`
  `scrollIntoView({ behavior:"smooth", block:"nearest", inline:"start" })`.
- 반대 방향 스크롤 흐름: `setSelectTreeItem → desginSetFirstVisibleRow`(표시 범위 밖일 때만 조정).
- 호출 경로: `ws_html5_ws20_attr.js:3229` `fnWs20SelectUI` → `selPreviewUI(OBJID)` →
  `design/preview/index.js:5976 selPreviewUI` → `oWS.sMark.fn_mark`.
