# 01_request — BR29 autoGrowing 초기화 확인 팝업·이벤트 잠금 누락

## 버그 요지 (노션 이슈 DB, 코드 BR29 / 화면: UI 속성 영역)
원본(WS3.0)에서는 `sap.ui.table.Table` 의 `autoGrowing` 프로퍼티를 `true` 로 바꾸면
**이벤트 등록 여부와 무관하게** "이전에 설정한 서버/클라이언트 이벤트가 초기화됩니다. 진행하시겠습니까?"
확인 팝업(메시지 283)이 뜨고, **확인** 시 `firstVisibleRowChanged` 에 등록된 서버/클라이언트 이벤트를
모두 초기화한 뒤 그 항목을 **입력 불가(잠금/숨김)** 로 만든다.

현행 WS4.0(WS20)에서는 `autoGrowing=true` 로 바꿔도 **① 확인 팝업 미호출 ② 등록 이벤트(EV_TEST1) 유지
③ 이벤트 항목 계속 입력 가능** 상태로 남는다(오류·예외는 없음, BUSY 는 정상 해제).

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - (신규) `oAPP.fn.attrSetAutoGrowingException(is_attr, bModelRefresh, bClear)`
  - (신규) `oAPP.fn.attrChangeAutoGrowingProp(is_attr)`
  - (수정) `oAPP.fn.fnWs20AttrChange(sAttr, uityp, bSkipUndo, bSkipAutoGrow)` — 4번째 인자 추가 + 진입부 게이트
- 원본(as-is, KEEP-UI5, 무수정): `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - `attrChangeAutoGrowingProp` (3115행), `attrSetAutoGrowingException` (3237행), 호출부 `attrChange` (1785행)

## 변경 요약 (원본 대비)
1. **원인**: 원본 `attrChange` 안의 autoGrowing 예외처리(`attrChangeAutoGrowingProp`)가 HTML5
   `fnWs20AttrChange` 로 이식될 때 **통째로 누락**. 로드 시 잠금 함수 `attrSetAutoGrowingException` 는
   `_safeCall(...)` 로 호출만 되고 **본체가 미정의**라 조용히 skip → 재오픈 시에도 잠금 안 걸림.
2. **`attrSetAutoGrowingException` 이식(원본 3237행 1:1)**:
   - autoGrowing KEY 별 점검대상 이벤트 매핑 그대로: Table→`firstVisibleRowChanged`(AT000013085),
     sap.m.Table→4종, sap.m.List→4종.
   - autoGrowing=true → 대상 이벤트 `edit=false` + 서버/클라 이벤트 아이콘 `icon1_visb/icon2_visb=false`.
   - `bClear=true` → 대상 이벤트 값/소스타입 초기화(`UIATV=""`, `ADDSC=""`) + `attrDelClientEvent(,"JS")`
     + `attrChgAttrVal(,"DDLB")` + `attrSetLineStyle`.
   - 인자 없이 호출 시 현재 UI(`uiinfo.UIOBK`) 기준 autoGrowing attr 자동 검색(원본 3239 switch 동일).
   - **차이(HTML5 대응)**: 원본 `oModel.refresh()` → `fnRenderWs20AttrRows()`. 원본 per-line undo
     (`saveActionHistoryData`)는 **미이식** — HTML5 는 스냅샷 스택(`fnWs20PushUndo`)으로 통일했고
     호출부가 변경 직전 1회 적재하므로 여기서 중복 적재하지 않음.
3. **`attrChangeAutoGrowingProp` 이식(원본 3115행 1:1)**:
   - autoGrowing 프로퍼티(Table/m.Table/m.List)만 처리, 바인딩건(`ISBND="X"`) exit.
   - `UIATV !== "true"`: 대상 이벤트 잠금 해제만 하고 **falsy 반환** → 호출부가 값(false 등) 반영·재렌더·undo
     정규 흐름 계속(원본 3128 동일).
   - `UIATV === "true"`: 확인 팝업 `showMessage(null, 30, "I", 메시지283, cb)` 호출 후 **true 반환**(하위 skip).
     콜백에서 스냅샷 1회 → (취소=autoGrowing false 복귀+이벤트 잠금해제 / 확인=이벤트 초기화+잠금) →
     `fnWs20AttrChange(is_attr,"DDLB",true,true)` 재진입으로 값 반영·재렌더·자식창 반영, 이어서
     `designRefershModel()`.
4. **`fnWs20AttrChange` 게이트**: 진입부(오류필드 초기화 직후, undo push 전)에
   `bSkipAutoGrow !== true && attrChangeAutoGrowingProp(sAttr) === true` 면 `return`
   (기존 try/finally 가 BUSY·단축키·자식창 잠금 원복 — 원본 `attrChange` 1787~1792 대응).
   - 4번째 인자 `bSkipAutoGrow`: 확인 콜백이 값 반영 위해 재진입할 때 **팝업 무한 재호출 방지**용.

## 검수 포인트 (봐 달라는 것)
1. **원본 1:1 정확성**: `attrSetAutoGrowingException` / `attrChangeAutoGrowingProp` 의 분기·이벤트 KEY
   매핑·초기화 대상이 원본 `uiAttributeArea.js`(3115·3237행)와 동일한가.
2. **재진입 무한루프 없음**: 확인 콜백의 `fnWs20AttrChange(...,true,true)` 재진입이 `bSkipAutoGrow` 로
   게이트를 확실히 건너뛰는가(팝업 재호출 0회).
3. **BUSY·단축키·자식창 잠금 짝**: ① 게이트 early return 경로(팝업 뜨기 전) ② 확인/취소 콜백 정상 경로
   ③ 콜백 예외 경로 — 모든 종료 분기에서 BUSY/단축키/자식창 잠금이 원복되는가.
4. **undo 정합**: autoGrowing=true 확인 시 값 변경 + 이벤트 초기화가 **스냅샷 1회**로 묶여 한 번에
   되돌려지는가(중복 적재/누락 없음). 취소·autoGrowing=false 경로의 undo 도 정상인가.
5. **화면 반영**: 잠금(`edit=false`)·아이콘 숨김(`icon1_visb/icon2_visb=false`)이 렌더러
   (`fnRenderWs20AttrRows`/`_buildValueControl`/`_buildIconCell`)에 실제로 반영돼 입력·아이콘 클릭이
   막히는가. 재오픈(로드 경로 `_safeCall("attrSetAutoGrowingException")`)에서도 잠금 유지되는가.
6. **원본 무수정**: `uiAttributeArea.js`(KEEP-UI5) 는 손대지 않았는가.
7. **메시지**: 확인 팝업 키 283 은 **원본이 쓰는 키 그대로** 배선했는가(임의 문구·키 생성/메시지 DB 수정 없음).

## 근거
- 원본 SSOT: `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - `attrChange` 1764행(호출부 1785행), `attrChangeAutoGrowingProp` 3115행, `attrSetAutoGrowingException` 3237행.
- `.analy/05_디자인영역.md` (속성 영역 예외처리·메시지 키 원칙), `.analy/03_메인프레임_WS10_WS20.md`.
- 노션 이슈 리포트 DB 코드 BR29(현상·재현·기대결과·DOM 처리 흐름).
- 검사: `node --check ws_html5_ws20_attr.js` 통과.

## 백업
- `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.br29bak` (수정 전 원본).
