# T01 검수 요청서 — 끌어놓기(드롭)로 바인딩된 집계에 자식 추가 시 안내 메시지 복원

> 장군님 특별 지시(2026-08-20): UI 추가 팝업 목록의 UI를 **트리 노드로 끌어놓기**로 자식을 추가하려 할 때,
> 대상이 **바인딩(값 지정)된 집계인데 이미 자식이 1개 있는** 경우, 팝업 추가(B2)와 **같은 계열의 안내**가 뜨게
> 할 수 있는지 원본·현행을 깊게 대조하고, 가능하면 영향도까지 분석. 이 문서 = 그 결과 + 검수 요청서.

## 결론: **가능하며, 원본(WS_DESIGN 최신)이 이미 그렇게 재작성돼 있었다.** 이식본이 옛 버전이라 누락된 것.

## 검수 대상 (내 파일 = 원본 폴더 밖)
- `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js`
  - `oAPP.fn.chkAggrRelation` (약 415~) — **배열 반환 → 구조체 `{RETCD, RTMSG, T_SEL}` 반환판으로 재작성**
  - `oAPP.fn.aggrSelectPopup` (약 446~) — 후보를 `.T_SEL` 로 받고, 후보 0 일 때 하드코딩 262 대신 `.RTMSG` 표시
- `www/ws30/ws10_20/js/ws_html5_ws20_wizard.js` (약 119~) — 트리 추가 사전점검을 `.RETCD/.RTMSG` 소비로 갱신

## 배경 / 근본 원인 (깊은 대조)
- **끌어놓기 경로 흐름:** 트리 drop → `designUIDropInsertPopup`(dnd.js) → **`aggrSelectPopup`** 이 대상 노드에서 넣을
  수 있는 집계를 **`chkAggrRelation` 으로 산출** → 후보 1개면 자동선택 → `designAddUIObject` → (카디널리티 점검).
- **누락 지점:** 이식본 `chkAggrRelation`(옛 배열판)은 **"바인딩(_MODEL) 걸린 집계에 자식이 이미 있으면" 후보에서
  조용히 제외**(dnd.js 옛 427~428)했다. 그래서 그 자리는 후보 0 → 옛 하드코딩 **262("이동 가능한 aggregation 없음")**
  만 뜨거나 아무 안내도 못 받고, **팝업 추가(B2)에서 뜨는 바인딩 안내가 끌어놓기에선 안 떴다.**
- **실측(CDP, 살아있는 앱):** VBOX2.items = 바인딩(GT_T100)+자식(BUTTON2) 상태. 이식본
  `chkAggrRelation(VBOX,유효자식)` → `[]`(빈 배열, 조용히 제외). 반면 `chkUiCardinality(VBOX2,items,X)` → `true`
  (카디널리티 점검은 막지만, 끌어놓기는 그 점검까지 **가기도 전에** 후보 단계에서 빠짐).

## 원본 대조 (WS20 원본 = WS_DESIGN, 최신)
- 원본 `chkAggrRelation` 은 **재작성됨**(옛 배열판 `uiDesignArea.js:1524~1594` 주석 처리, **새 구조체판 1596~1680**):
  - 반환 `{RETCD, RTMSG, T_SEL}`.
  - 바인딩(_MODEL) 걸린 집계에 자식이 이미 있으면 **제외 + `_isModelBind=true`**(1650).
  - 후보가 0 이면: 바인딩 제외 때문이면 **RTMSG=`ZMSG_WS_COMMON_002/002`**("추가 및 이동 가능한 Aggregation
    항목에 바인딩이 설정되어 있어 UI를 2건 이상 추가할 수 없습니다."), 원천 부재면 **003**, 집계정의 자체가 없으면 **001**.
- 원본 호출부도 함께 갱신: `aggrSelectPopup.js:32~79`(→ `.T_SEL`, 후보0 시 `.RTMSG` 표시), 트리 추가 사전점검
  `designChkSelLine`(uiDesignArea.js:1474~1482, → `.RETCD==="E"` 면 `.RTMSG`).
- ★즉 **끌어놓기용 안내는 팝업(B2, `000` 집계명 포함)과 문구 코드가 다르다**: 끌어놓기는 후보 단계라
  특정 집계명이 없어 **`002`(집계명 없는 문구)**를 쓴다. (원본 설계 그대로.)

## 변경 요약 (원본 재작성판 1:1 이식)
1. `chkAggrRelation` → 구조체 반환판(원본 1596~1680 1:1). `_isModelBind` 추적, 001/002/003 메시지.
2. `aggrSelectPopup` → `_sAggrRes.T_SEL` 사용, 후보 0 시 `_sAggrRes.RTMSG` 표시(미조회 시 262 폴백).
3. wizard 트리 추가 사전점검 → `_aggrRes.RETCD==="E"` 면 `_aggrRes.RTMSG`(미조회 시 280 폴백).

## 영향도 분석
- **반환 계약 변경(배열 → 구조체)**. 내 파일의 `chkAggrRelation` 호출부는 **정확히 2곳**뿐(grep 전수):
  `dnd.js aggrSelectPopup`, `wizard.js 사전점검` — **둘 다 이번에 새 구조 소비로 갱신**. 다른 호출부 0.
- 두 파일 모두 **내 파일**(`js/ws_html5_*`), 원본 폴더 무수정.
- **동작 변화(끌어놓기 한정):** ① 바인딩+자식 자리만 남는 노드에 드롭 → 이제 **바인딩 안내(002)**가 뜸(종전=262/무안내).
  ② 넣을 집계가 원천적으로 없는 노드 → **003**(종전=262). ③ wizard 사전점검 실패 문구도 280 → RTMSG(001/002/003).
  모두 **원본 최신 동작과 일치**(원본이 262/280 을 주석 처리하고 RTMSG로 대체).
- **정상(후보 있음) 경로 무변화:** `.T_SEL` 에 후보가 있으면 종전과 동일(1개 자동/2+ 선택 팝업).
- **메시지 키 001/002/003** = 로컬 메시지 DB(KO·EN) 등록 확인.
- **클로버 위험 검토:** 원본 `chkAggrRelation`(uiDesignArea.js)이 지연로드로 내 정의를 덮더라도 **그 버전도 구조체판**이라
  내 호출부(구조체 소비)와 호환 → 무해. (현행 실측: 런타임 `chkAggrRelation` = 이식본 버전.)
- `node --check` dnd.js·wizard.js 통과.

## 검수 포인트
1. **정확성:** `chkAggrRelation` 구조체판이 원본 1596~1680 과 로직 1:1인가(_isModelBind 조건·001/002/003 분기·자식존재 zTREE 기준).
2. **계약 일관성:** `.T_SEL`/`.RETCD`/`.RTMSG` 를 두 호출부가 올바르게 소비하는가. 폴백(262/280)이 미조회 시에만 쓰이는가.
3. **원본 1:1:** 끌어놓기=002, 팝업=000 의 문구 코드 분리가 원본 설계와 같은가(임의 통일 금지).
4. **회귀:** 후보가 있는 정상 드롭/이동, 순서변경(같은 부모 UIATK), 취소 콜백 경로가 종전과 동일한가.
5. **누락 호출부:** chkAggrRelation 다른 소비처가 정말 없는지(내 파일 전수).

## 근거
- 원본(읽기전용, WS20=WS_DESIGN): `design/js/uiDesignArea.js` 1596~1680(chkAggrRelation 재작성)·1474~1482(사전점검)·
  `design/js/aggrSelectPopup.js` 32~79.
- 이식본: `ws_html5_ws20_dnd.js`(chkAggrRelation·aggrSelectPopup)·`ws_html5_ws20_wizard.js`.
- 실측: CDP 로 VBOX2 바인딩+자식 상태·후보 산출·카디널리티 반환 확인.
- `node --check` 통과.
