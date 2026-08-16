# BR37 검수 요청 — UI 추가 팝업 Generated Cnt 표시 조건

## 검수 대상
- **화면/기능**: WS20 디자인 트리 "UI 추가" 팝업(UI Object Select - Page)의 **Generated Cnt**(생성 개수) 행 표시 여부.
- **파일(수정)**: `www/ws30/ws10_20/WS10/css/ws20.css` (656행 부근, `.u4aWs20InsRow[hidden]` 규칙 1줄 추가)
- **관련(무수정, 참고)**: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - `1323`: Generated Cnt 행 초기 마크업(`class="u4aWs20InsRow u4aWs20InsCntRow" hidden`)
  - `1570~1573` `lf_onAgg`: 집계 변경 시 `oCntRow.hidden = oSelAgg.ISMLB !== "X"`
- **원본(as-is)**: `www/ws30/ws10_20/design/js/insertUIPopop.js`
  - `361`: `oFrmElem2 = new sap.ui.layout.form.FormElement({visible:false});` (Generated Cnt 초기 숨김)
  - `151~187` DDLB change: 빈값 선택 → `setVisible(false)`, `ISMLB==="X"` 일 때만 `setVisible(true)`

## 현상(버그)
UI 추가 팝업에서 집계 이름(Aggregation Name)을 **안 골랐거나 공백/단일(ISMLB="")** 을 골라도 Generated Cnt 행이 계속 표시됨.
(기대: ISMLB="X" 다건 집계일 때만 표시. 미선택·공백·단일=숨김.)

## 원인
표시 판단 로직(`lf_onAgg`의 `oCntRow.hidden` 토글)은 원본과 동일하게 이미 맞음.
그러나 Generated Cnt 행은 `class="u4aWs20InsRow u4aWs20InsCntRow"` 로 `.u4aWs20InsRow` 를 함께 가지며,
`ws20.css:656 .u4aWs20InsRow { display: flex; }` 가 브라우저 기본 `[hidden]{display:none}` 을 **우선순위로 이겨**,
`hidden` 속성을 걸어도 항상 `display:flex` 로 표시됐다.
(메모리 `bootstrap-dflex-important-defeats-display-toggle` / `attachoverflow-needs-hidden-override` 와 동일 패턴 — 클래스 display 규칙이 `[hidden]` 무력화.)

## 변경 요약
`ws20.css` 에 스코프 override 1줄 추가:
```css
.u4aWs20InsRow[hidden] { display: none; }
```
→ `hidden` 속성이 다시 실제 숨김으로 작동. 이로써 원본 의도(초기 숨김 → 다건 집계일 때만 표시)가 복원된다.
JS 로직은 이미 원본 1:1이라 **손대지 않음**.

## 검수 포인트
1. **원본 1:1**: 원본은 Generated Cnt 를 초기 `visible:false`, `ISMLB==="X"` 에서만 `setVisible(true)`. 현행(초기 `hidden` + `hidden = ISMLB!=="X"` 토글)이 이 조건과 결과적으로 동일한지.
2. **정확성**: 미선택("")·공백·단일(ISMLB="")=숨김, 다건(ISMLB="X")=표시, 집계를 다건→미선택 되돌릴 때 다시 숨김 되는지(`lf_onAgg` 매 변경 재계산).
3. **부작용 없음**: `.u4aWs20InsRow[hidden]` 은 `hidden` 속성이 붙은 행에만 적용 → 다른 폼 행(집계·UI 오브젝트·개인화 체크)엔 hidden 이 없어 영향 없음. 반응형(≤36rem)의 `.u4aWs20InsRow{flex-direction:column}` 과도 무충돌인지.
4. **공통 자산 규칙**: `ws20.css` 는 WS20 화면 전용 CSS(공통 shell/bootstrap-skin/tokens 아님) → 화면 스코프 수정이 규칙 위반 아님 확인.
5. **하드코딩/토큰**: 색·px 하드코딩 없음(구조 규칙 1줄), color-mix 없음.

## 근거
- 원본: `design/js/insertUIPopop.js:361` (초기 숨김), `:166~168` (빈값 숨김), `:177~182` (ISMLB="X"만 표시)
- 현행 로직: `ws_html5_ws20_edit.js:1572`
- 표시 무력화 원인: `ws20.css:656`
- 패턴 근거: 메모리 `bootstrap-dflex-important-defeats-display-toggle`, `attachoverflow-needs-hidden-override`
