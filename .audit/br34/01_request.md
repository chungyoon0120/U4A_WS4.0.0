# BR34 검수 요청 (01_request)

## 버그 개요 (노션 이슈 리포트 DB)
- 코드: **BR34** / 화면: UI 속성 영역(WS20 ATTRIBUTE) / 분류: UX
- 내용: **ATTRIBUTE 입력필드 오류 발생 시 오류 메시지 Popover 미표시**
- 증상: 점검 오류가 나면 입력필드에 빨간 테두리(오류 상태)는 정상 표시되나, 오류 입력필드를 클릭해도
  하단에 오류 메시지 Popover가 뜨지 않음. 현재는 오류 문구를 브라우저 툴팁(title)으로만 확인 가능.
- 기대(노션): 오류 상태+오류 메시지가 설정된 입력필드를 클릭하면 필드 하단에 오류 메시지 Popover 표시.
  빨간 테두리·툴팁·Popover가 **동일한 오류 메시지**를 표시(동기화). 입력값 복구 정책은 변경 대상 아님.
- 재현(노션): CALENDAR1 / months 프로퍼티에 점검 오류값(예 400) 입력·확정 → 값이 기본값(1)로 복구 +
  빨간 테두리 적용 → 그 입력필드 클릭 → Popover 미표시.

## 검수 대상 (파일 · 함수)
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - 신규 헬퍼: `_attrVsEl` / `_attrVsShow(oInputEl, sTxt)` / `_attrVsHide()` — `_buildValueControl` 직전 모듈 스코프에 추가.
  - `_buildValueControl(sAttr)` 의 텍스트 입력(`inp_visb`) 오류 분기(기존 `sAttr.valst === "Error"` 처리 줄):
    빨간 테두리(`err`)+툴팁에 더해 입력칸에 focus→표시 / blur→숨김 리스너 추가.

## 변경 요약 (원본 대비)
- **원본(SSOT)**: `design/js/uiAttributeArea.js:736` — 값 입력필드 `sap.m.Input({ ..., valueState:"{valst}",
  valueStateText:"{valtx}" })`. 변경 이벤트(attachChange) 종료 시 오류가 남아 있으면(`_sAttr.valst !== undefined`)
  `this._oValueStateMessage.open()`(831~833행)로 valueStateMessage Popover를 연다. 또한 sap.m.Input은
  valueState=Error일 때 포커스 시 valueStateMessage를 기본 표시한다.
- **기존 HTML5(변경 전)**: 값 입력필드(`createField`)는 오류 시 `.err` 클래스(빨간 테두리)+`title`(툴팁)만 부여.
  오류 메시지 Popover(`.u4a-field__msg` 상당)를 만들지 않아, 클릭해도 문구가 뜨지 않았음(드롭다운 칸은 별도 처리로 오류표시 존재).
- **변경 후**: 원본 valueStateMessage를 HTML5로 재현.
  - 값 입력칸이 스크롤되는 속성 목록(`.u4aWs20AttrRows`) 안이라, 필드 안 인라인 메시지는 셀에서 잘림 →
    이미 검증된 바인딩 팝업 방식(`fnBindPopupOpen.js` `_bindVsShow`, 별창 `additInfoArea` `_bwpVsShow`)과
    동일하게 **문서 최상단(body) `position:fixed` 팝오버**로 입력칸 바로 아래 부착. 싱글톤 1개 재사용.
  - **포커스(클릭) 시 표시 / blur·스크롤·리사이즈·바깥클릭 시 숨김.**
  - 문구는 빨간 테두리·툴팁과 동일한 `sAttr.valtx`(= 점검 오류 메시지 `checkPropertyValue` RTMSG, 3593~3594행) 사용 → 동기화 충족.
  - 색·아이콘·테두리는 공통 `.u4a-field__msg` 소비(신규 스타일·공통 자산 수정 없음). z-index/줄바꿈만 인라인 지정.

## 검수 포인트 (봐달라는 항목)
1. **원본 1:1 여부**: 원본 valueState/valueStateText + `_oValueStateMessage.open()` 의미를 HTML5로 옳게 옮겼는가.
   원본에 없는 UX(자동 애니메이션·상시 표시 등)를 임의 추가하지 않았는가.
2. **정확성**: 오류 입력칸 클릭 시 팝오버가 실제로 뜨는가. `valtx` 가 비어있을 때(가드 `!sTxt`) 빈 팝오버가 안 뜨는가.
   빨간 테두리·툴팁·팝오버 문구가 **동일**한가(모두 `valtx`).
3. **입력값 복구 정책 불변**: 이번 변경이 기존 "오류 시 기본값 복구" 동작을 건드리지 않았는가(노션 명시 요구).
4. **누수/직렬화**: 재렌더로 입력 DOM이 재생성돼도 팝오버(싱글톤)가 중복 생성·이벤트 다중 바인딩 없이 동작하는가
   (`_attrVsBound` 1회 바인딩). 다른 UI 선택/스크롤 시 팝오버가 남지 않는가(scroll/mousedown/resize/blur 숨김).
5. **공통 자산 소비**: 공통(`shell.css`/`u4a-ui.js` 등) 직접 수정 없이 화면 스코프로만 처리했는가. 하드코딩 hex/color-mix 없음.
6. **드롭다운 칸 범위**: 본 수정은 텍스트 입력(`inp_visb`) 대상. 드롭다운(콤보)은 기존 오류표시(테두리+펼침목록 최상단 문구)를
   유지 — BR34 재현(텍스트 입력)과 분리한 판단이 타당한가(과잉 확장 아님 확인).

## 근거
- 원본 SSOT: `www/ws30/ws10_20/design/js/uiAttributeArea.js:736`(값 입력필드 valueState 바인딩), `:772-773`·`:831-833`(valueStateMessage close/open).
- 오류 메시지 소스: `ws_html5_ws20_attr.js:3588-3594`(`checkPropertyValue` RETCD="E" → `valst="Error"`, `valtx=RTMSG`), 재렌더 `:3658`.
- 재사용 패턴(검증됨): `www/ws30/ws10_20/js/fnBindPopupOpen.js` `_bindVsShow`(1304~1342), 별창 `Popups/bindPopup/additInfoArea/additInfoArea.js` `_bwpVsShow`.
- 공통 밸류스테이트 표준: `.analy/15_공통_입력UX_가이드.md` §3.5(ValueState → `data-vs="error"` + `.u4a-field__msg`), `.analy/16` 공통 입력칸.
- 팝오버 스타일 SSOT: `theme/shell.css:1381`(`.u4a-field__msg`), 셀 클리핑 대응 근거 `Popups/bindPopup/frame.css:450-460`.
