# 01_request — BR35 검수 요청

## 버그 요약 (노션 이슈 BR35, 화면=Design Tree)
"UI 추가 callback의 UA040 허용 부모 점검 누락".
원본(WS3.0)은 공통코드 **UA040** 에 등록된 UI(예: `u4a.util.SessionWorker`, `u4a.util.PressTrigger`)를
Design Tree 에 추가할 때 **지정된 허용 부모(sap.m.App)** 밑에만 넣을 수 있게 막는 예외 로직이 있다.
WS4.0 의 **UI 추가 팝업 → 추가 확정 callback** 에는 이 검사가 빠져, `SessionWorker` 가
`sap.m.Page` 의 content aggregation 에도 추가되어 `_T_0015`·Design Tree·Preview 에 반영된다.

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- 함수: `oAPP.fn.designAddUIObject` (UI 추가 팝업 confirm → 추가 확정 콜백)
- 추가한 검사 1줄(약 853행) + 사용 헬퍼 `oAPP.fn.designChkHiddenAreaUi`(`ws_html5_ws20_dnd.js:331`, 기존)

## 변경 요약 (원본 대비)
- `designAddUIObject` 의 선행 검증 사슬에서 **UA040 허용부모 점검이 누락**돼 있었다.
  원본 `uiDesignArea.js:5063` 은 UA039 중복점검(5049) → **UA040 hidden-area 점검(5063)** → UW03 특정부모(5079)
  순으로 검사한다. HTML5 이식본은 카디널리티(847) + UA039(852, BR14 로 복원)만 있고 **UA040 이 빠졌다**.
- 수정: UA039 점검(852) 바로 뒤, `fnWs20PushUndo()`(854) **이전**에 아래 한 줄 추가 —
  ```js
  if (typeof oAPP.fn.designChkHiddenAreaUi === "function"
      && oAPP.fn.designChkHiddenAreaUi(is_0022.UIOBK, is_tree.UIOBK) === true) { return; }
  ```
  - 허용 부모가 아니면 헬퍼 내부에서 원본 메시지 **131**(`Target API and UI &1 can only target Location &2`) 토스트 후 `true` 반환 → 추가 차단.
  - 차단은 **undo push·트리/미리보기/데이터 변경 이전**에 일어남(기대결과의 "변경하지 않음" 충족).
- 헬퍼 `designChkHiddenAreaUi` 는 이미 존재(원본 1591행 1:1, `T_9011` CATCD=UA040, `FLD01`=대상 UIOBK,
  `FLD04`=허용 부모 PUIOK, `FLD07!=="X"`). 신규 함수·문구·데이터원 없음.

## 검수 포인트 (봐달라는 것)
1. **원본 1:1**: 삽입 확정 경로(`designAddUIObject`)의 UA040 점검이 원본 `uiDesignArea.js:5063` 과 인자·순서·차단효과 동일한가.
   (인자 `is_0022.UIOBK`=추가 UI, `is_tree.UIOBK`=대상 부모. 원본과 동일.)
2. **경로 일치**: 마우스 끌어놓기 경로(`ws_html5_ws20_dnd.js:982`)의 UA040 점검과 동일 헬퍼·동일 판정을 쓰는가(두 경로 동작 일치).
3. **차단 위치**: 점검 실패 시 `fnWs20PushUndo()`·`crtStru0014`·`_prev(...)` **이전**에 return 하여
   `_T_0015`·Design Tree·Preview 가 전혀 바뀌지 않는가(부분 반영/유령 노드 없음).
4. **busy/잠금 대칭**: 조기 return 이 팝업 confirm 의 잠금 해제를 깨지 않는가.
   호출부(`ws_html5_ws20_edit.js:1521~1524`)가 `_broadBusy(true)` 후
   `Promise.resolve(designAddUIObject(...)).catch(...).then(_broadBusy(false))` 로 감싸므로
   조기 return(값 미반환=resolve)에도 `.then` 에서 자식창 잠금(BUSY_OFF)이 해제됨. 기존 카디널리티/UA039 조기 return 과 동일 처리.
5. **메시지**: 131 은 원본 키. 새 문구·키 생성 없음. 메시지 DB 무수정.
6. **원본 KEEP-UI5 무수정**: `uiDesignArea.js`(참조 원본)는 건드리지 않음.
7. **범위**: BR35 = UA040 만. UW03(특정부모, 원본 5079)은 **팝업 목록 생성 시 이미 필터**(`_checkUW03`, edit.js:831)돼
   SessionWorker/PressTrigger 범위 밖이라 이번 변경에서 제외(스코프 유지).

## 근거
- 원본: `www/ws30/ws10_20/design/js/uiDesignArea.js`
  - `designAddUIObject` UA040 점검: 5062~5074 (사이에 UA039 5049, UW03 5079)
  - `designChkHiddenAreaUi` 정의: 1591~1606 (T_9011 UA040, FLD04!==PUIOK → 메시지 131 → true)
- HTML5 기존 배선: `ws_html5_ws20_dnd.js` — 헬퍼 331, D&D 경로 사용 982
- `.analy/05_디자인영역.md` (Design Tree UI 추가·검증 규칙)
