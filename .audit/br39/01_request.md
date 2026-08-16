# BR39 검수 요청 — UI Object ID 변경 시 오류 표시 잔존 + 미리보기 컨트롤 OBJID 동기화

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - `oAPP.fn.attrChnageOBJID` (OBJID 변경 연쇄) — 미리보기 컨트롤 CustomData 동기화 추가
  - `_renderAttrHeader` (속성 헤더/입력영역 재렌더) — OBJID 입력필드 오류표시 동기화 추가
- 화면: WS20 Design 화면, Attribute 영역의 **UI Object ID** 입력필드(`#ws20AttrObjIdInp`)
- 원본(SSOT): `www/ws30/ws10_20/design/js/uiAttributeArea.js` `attrChnageOBJID`(4138행~)

## 버그 내용 (이슈 리포트 BR39)
1. **오류 표시 잔존**: UI Object ID에 허용되지 않는 값(예: `123`) 입력 → 검증 오류(빨간 테두리) 표시. 이 상태에서 Design Tree의 **다른 UI를 선택**하면 Attribute 영역은 새 UI 정보로 바뀌지만, **이전 UI의 빨간 오류 테두리가 새 UI의 입력필드에 그대로 남아 있음.**
2. **정상 변경 시 OBJID 정보 불일치**: UI Object ID를 허용되는 값으로 정상 변경하면 `oAPP.attr.prev[대상].._OBJID`, `_T_0015`, Design Tree에는 변경값이 반영되지만, `oAPP.attr.prev[대상].data("OBJID")`(미리보기 컨트롤의 식별용 CustomData)에는 반영되지 않고 옛 값이 유지됨. (WS3.0에서도 동일 발생했던 결함. 리포트에서 함께 갱신 지시.)

## 변경 요약 (원본 대비)

### ① 오류 표시 잔존 (Problem 1) — `_renderAttrHeader` (약 4979행)
- **원인**: 속성 골격(`_buildAttrSkeleton`)은 `.u4aWs20AttrWrap`가 이미 있으면 그대로 반환(4492~4493행) → UI Object ID 입력필드(`#ws20AttrObjIdInp`)는 **최초 1회만 생성되고 이후 재사용**. `_renderAttrHeader`는 값/title/readOnly/disabled만 갱신하고 오류표시(`.err` 클래스)는 손대지 않음 → 다른 UI 선택해도 빨간 테두리 잔존.
- **원본 근거**: 원본 UI5는 입력필드 valueState가 `/uiinfo/OBJID_stat`에 바인딩돼 있어 UI 전환(모델 /uiinfo 교체) 시 자동으로 초기화됨. HTML5는 양방향 바인딩이 없으므로 명시 재현 필요(암묵동작 명시 재현).
- **수정**: `_renderAttrHeader`에서 현재 `uiinfo.OBJID_stat`에 맞춰 `.err` 클래스를 켜고/끔.
  - `OBJID_stat === "Error"` → `INP.classList.add("err")` + title = `OBJID_stxt`
  - 그 외 → `INP.classList.remove("err")` (새 UI는 OBJID_stat 없음 → 오류표시 제거)
  - 잘못 입력했던 UI로 되돌아오면(그 uiinfo의 OBJID_stat=Error) 다시 표시됨.

### ② 미리보기 컨트롤 OBJID 동기화 (Problem 2) — `attrChnageOBJID` (약 1562행)
- **원인**: `oAPP.attr.prev[OBJID]`는 미리보기(UI5) 컨트롤 인스턴스(`fnBindPopupOpen.js:24` 주석). 생성 시 `.data("OBJID", OBJID)`로 식별자를 심음(`design/preview/index.js:8427`). 변경 연쇄에서 `._OBJID`만 갱신하고 `.data("OBJID")`는 방치.
- **영향**: 미리보기 클릭 → 트리 식별이 `.data("OBJID")`를 읽음(`design/js/uiDesignArea.js:4993`). 옛 값으로 남아 이름 변경 후 미리보기↔트리 식별이 어긋남.
- **수정**: `oAPP.attr.prev[sNew]._OBJID = sNew;` 직후에 `oAPP.attr.prev[sNew].data("OBJID", sNew)` 추가(있는 경우만, `typeof ... .data === "function"` 가드).
- **원본 대비**: 원본(UI5 WS3.0/WS4.0)도 `.data("OBJID")` 미갱신 결함 보유. **리포트의 "함께 갱신되어야 한다" 지시에 따른 보완**(임의창작 아님).

## 검수 포인트
1. **정확성 — Problem 1**: `_renderAttrHeader`의 `.err` 동기화가 (a) 오류 UI→다른 UI 선택 시 빨간 테두리 제거, (b) 오류 UI로 복귀 시 다시 표시, (c) 정상 UI 간 이동 시 오작동 없음을 모두 만족하는가. `_fail`(직접 add)/`_clearErr`(직접 remove) 경로와 충돌·중복 없는가.
2. **정확성 — Problem 2**: `.data("OBJID")` 갱신이 미리보기 컨트롤(prev[OBJID])에 정확히 걸리는가. ROOT/APP 등 `.data`가 없는 항목에서 가드가 안전한가(오류 삼킴 아니라 `console.error` 표면화). 변경 연쇄 순서(prev 이관 → _OBJID → data → delete[old])가 원본 흐름을 깨지 않는가.
3. **원본 1:1 여부**: Problem 1은 원본 value 상태 바인딩의 명시 재현으로 충실한가. Problem 2가 리포트 지시 범위(정상 변경 시 OBJID 정보 전체 동기화) 내인가.
4. **부작용**: OBJID_stat 기반 표시가 다른 오류 경로(빈값 014/숫자시작 091/특수문자 278/중복 069)의 `_fail` 표시와 대칭인가. busy·BUSY_ON/OFF 짝에 영향 없는가(이번 변경은 표시/데이터 갱신만, busy 로직 미변경).
5. **공통 자산·하드코딩**: `.err`는 이 화면 전용 방식(`WS10/css/ws20.css`), 하드코딩 색·신규 메시지 키 없음 확인.

## 근거
- 원본: `design/js/uiAttributeArea.js` `attrChnageOBJID` 4138~4372행 (특히 4302~4340행 연쇄, valueState↔OBJID_stat 바인딩)
- 미리보기 식별자 심기: `design/preview/index.js:8427` `.data("OBJID", is_tree.OBJID)`
- 미리보기→트리 식별 읽기: `design/js/uiDesignArea.js:4993` `_oChild.data("OBJID")`
- prev=미리보기 인스턴스 근거: `js/fnBindPopupOpen.js:24` 주석
- `.analy` 15 §3.5(입력 valueState), 암묵동작 명시 재현 원칙
