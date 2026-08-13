# BR32 검수 요청서

## 버그 요약 (이슈 리포트)
- **코드**: BR32 / 화면: UI 속성 영역
- **현상**: WS20 속성 화면에서 styleClass 프로퍼티의 값 입력 영역을 더블클릭해도 Edit 메뉴의 CSS Editor 팝업이 호출되지 않음.
- **기대**: styleClass 프로퍼티 ROW의 일반 영역(값 입력 DOM 포함, 링크·버튼·아이콘 제외)을 더블클릭하면 CSS Editor 팝업이 호출되어야 한다. 단, 바인딩 처리된 styleClass·값이 없는 경우는 제외.

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - 신규 함수: `oAPP.fn.attrDblClickStyleClass(is_attr)`
  - 수정: `oAPP.fn.fnRenderWs20AttrRows` 내부 값칸 더블클릭 위임 핸들러(`ROWS.__bwpDblWired`)
- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.br32bak`

## 변경 요약 (원본 대비)
BR33에서 값칸(`.u4aWs20AttrRowVal`) 더블클릭 위임 핸들러가 이미 있었으나 **서버이벤트 이동 갈래만** 배선돼 있었다. 원본 `attrDblclickEvent`(uiAttributeArea.js:2956)는 `styleClass → bindField → serverEvent` 순으로 분배하는데, HTML5에는 styleClass 갈래가 누락돼 있었다. BR32는 이 styleClass 갈래를 원본 순서대로 추가한다.

1. **`attrDblClickStyleClass` 신규(원본 uiAttributeArea.js:3007 1:1)**
   - 가드: `UIATY==="1"`(프로퍼티) / `UIASN==="STYLECLASS"` / `ISBND!=="X"`(비바인딩) / `UIATV` 존재. (원본 3010·3013·3016·3019)
   - 편집기 정보 `{ OBJID: OBJID+UIASN, OBJTY:"CS", OBJNM:"CSS" }` 구성 후 `fnEditorPopupOpener(oEditorInfo, UIATV)` 호출, `return true`. (원본 3022·3029·3032)
   - 원본과 동일하게 null 안전만 추가(`!is_attr`, `!is_attr.UIATV`).
2. **디스패처(값칸 더블클릭)에 styleClass 갈래 삽입(원본 순서)**
   - 진입 시 `fnSetBusyLock("X")`(원본 342 `parent.setBusy("X")`).
   - styleClass 매치 시 `return` — 화면잠금은 편집기 팝업(`fnEditorPopupOpen`, 진입 X·완료 시 해제)이 관리하므로 여기서 풀지 않음(원본은 매치 시 setBusy 유지).
   - 값칸 안 **F4 값도움 버튼(`.u4a-field__vh`)·값 지우기 버튼(`.u4a-field__clear`)** 은 자체 동작이므로 styleClass 갈래에서 제외(원본 기대: 링크·버튼·아이콘 제외).
   - styleClass가 아니면 기존대로 `attrDblClickServerEvent(oAttr)` 호출 후 말미에서 `fnSetBusyLock("")`(원본 attrDblclickEvent 말미 setBusy("")).

## 근거
- 원본 SSOT: `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - `attrDblclickEvent` 2956(진입 busy·분배 순서), `attrDblClickStyleClass` 3007, 배선 339(테이블 dblclick→busy X→분배).
- HTML5 편집기 opener: `fnDialogPopupOpener.js:3003 fnEditorPopupOpener` → `fnEditorPopupOpen.js`(진입 `fnSetBusyLock("X")`, 창 오픈/이미열림 분기서 `fnSetBusyLock("")`).
- 잠금 함수 일치: `oAPP.common.fnSetBusyLock`(ws_html5_shell.js:356)은 내부적으로 `parent.setBusy`만 호출 → 디스패처가 건 잠금과 편집기가 푸는 잠금이 동일.
- 값칸 구조: styleClass 값칸은 공통 입력칸(`createField`, u4a-ui.js). 입력칸(`.u4a-field__input`) + F4 복사 버튼(`.u4a-field__vh`) + 지우기 버튼(`.u4a-field__clear`).

## 검수 포인트
1. **원본 1:1 여부**: `attrDblClickStyleClass` 가드 4개·편집기 정보 구성·`return true`가 원본 3007~3035와 동일한가.
2. **정확성/화면잠금 대칭**: styleClass 매치 시 잠금 유지(편집기가 해제) / 그 외 경로·예외(catch)에서 잠금 해제 짝이 모두 있는가. 편집기 opener가 어떤 분기(정상 오픈/이미 열림)에서든 `fnSetBusyLock("")`로 해제하는가(누수 여부).
3. **제외 처리**: F4 복사 버튼·값 지우기 버튼 더블클릭이 CSS 편집기를 열지 않고 각자 기능만 하는가. 라벨 링크·바인딩/이벤트 아이콘 셀(값칸 밖)은 애초에 값칸 스코프에서 제외되는가.
4. **바인딩 제외**: styleClass가 바인딩(사슬) 처리된 경우(`ISBND==="X"`) 편집기가 안 열리는가.
5. **BR33 회귀 없음**: 서버이벤트(UIATY="2") 값칸 더블클릭 이동이 그대로 동작하는가(styleClass 갈래가 먼저 검사되지만 UIASN 불일치로 통과 후 serverEvent로 감).
6. **부작용**: 진입 시 매 값칸 더블클릭에 `fnSetBusyLock("X")`가 걸렸다 풀리는데(원본과 동일) 일반 프로퍼티/이벤트 값칸에서 화면 깜빡임·잠김 잔존이 없는가.

## 재현 절차(요약)
1. WS20에서 SELECTOPTION21 UI 선택 → 속성에서 styleClass에 `sapUiTinyMargin` 직접 입력.
2. styleClass 값칸을 더블클릭 → CSS Editor 팝업이 떠야 함.
3. 같은 줄의 F4 복사 아이콘/값 지우기 버튼 더블클릭 → 각자 기능만, CSS Editor 안 뜸.
4. styleClass에 바인딩(사슬) 건 경우 값칸 더블클릭 → CSS Editor 안 뜸.
