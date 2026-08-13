# BR31 검수 요청 (01_request)

## 대상 이슈 (노션 이슈리포트 BR31)
- 화면: WS20 **UI 속성 영역**(우측 Attribute)
- 대상 속성: `dropAble`(끌어다 놓기 허용) / 대상 이벤트: `DnDDrop`(놓았을 때)
- 현상: **dropAble=false 인데도 DnDDrop 이벤트를 설정할 수 있음**. dropAble=true 에서 DnDDrop 에 서버이벤트(EV_TEST1)를 등록한 뒤 dropAble 을 false 로 바꿔도, 등록 이벤트·표시값·입력 가능 상태가 그대로 유지됨(초기화·잠금 미적용).
- 기대: dropAble=true 일 때만 DnDDrop 설정 가능. dropAble 을 false 로 바꾸면 DnDDrop 의 서버/클라이언트 이벤트가 **초기화**되고 입력이 **잠겨야** 한다. 특정 UI 가 아니라 dropAble+DnDDrop 을 함께 가진 **모든 UI** 에 동일 적용.
- 재현 계측(노션): 함수 흐름 `_select → _onPick → fnWs20AttrChange → attrChgAttrVal → attrSetLineStyle → updateBindPopupDesignData`, `attrDelClientEvent` 호출 **0회**(초기화 미수행 근거).

## 검수 대상 파일·함수
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js` (원본 백업: `_ws_html5_ws20_attr.js.br31bak`)
  - **신규 이식** `oAPP.fn.attrSetDropAbleException(is_attr, bModelRefresh, bClear)` — dropAble 값에 따른 DnDDrop `edit` 잠금 + (dropAble 끔) 등록 이벤트 초기화.
  - `oAPP.fn.fnWs20AttrChange` — dropAble 라인 수집(`attrChgAttrVal`)+스타일(`attrSetLineStyle`) 직후에 위 예외처리 호출 훅 추가(`sAttr.UIASN === "DROPABLE"` 일 때 `attrSetDropAbleException(sAttr, false, true)`).
  - `_updateAttrList` 끝의 기존 `_safeCall("attrSetDropAbleException", [])`(2802행) — 함수가 정의되면서 렌더 시 DnDDrop 잠금이 동작(무인자 = 잠금만, 초기화 없음).

## 원본(as-is) 근거
- `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - `attrSetDropAbleException`(3388~3492행): `l_edit=false` 기본 → `UIATV==="true"` 또는 (`UIATV!==""` && `ISBND==="X"`)면 `l_edit=true`. `ls_drop = T_ATTR.find(UIASN==="DNDDROP")`, `ls_drop.edit = l_edit`. `bClear===true && l_edit===false` 이면 `ls_drop.UIATV=""`·`ADDSC=""`·`attrDelClientEvent(ls_drop,"JS")`·`attrChgAttrVal(ls_drop,"DDLB")`(→ _T_0015 라인 제거)·`attrSetLineStyle(ls_drop)`.
  - `attrChangeDropAbleProp`(3207행): dropAble 변경건이면 `attrSetDropAbleException(is_attr,true,true)` 호출 후 `return true`(하위 skip). `attrChange`(1798행)가 이를 호출.
  - 렌더 경로(7391행): `attrSetDropAbleException()` 무인자 호출 — 그릴 때 현재 dropAble 값으로 DnDDrop 잠금.
  - 판단 기준이 `UIASN`(DROPABLE/DNDDROP) **의미명** → 특정 OBJID/UIATK 아님 → 모든 해당 UI 공통 적용(BR31 요구와 일치).
- `.analy` 문서: dropAble↔DnDDrop 연동은 문서에 규정 없음 → **원본 소스가 SSOT**.

## 변경 요약 (원본 대비)
- 현행 HTML5 는 `attrSetDropAbleException` **정의 자체가 없어** 렌더 호출(2802행)이 `_safeCall` 로 조용히 건너뛰어졌고, 변경 시 연동 훅도 없었음 → dropAble 을 꺼도 DnDDrop 이 잠기지 않고 이벤트도 유지됨.
- 원본 함수를 이식하되 HTML5 환경에 맞춰 아래만 다르게 함(주석 명시):
  1. **UI5 전용 `undoRedo.saveActionHistoryData` 생략** — 변경 경로 `fnWs20AttrChange` 가 이미 `fnWs20PushUndo` 로 _T_0015 스냅샷을 1회 적재하므로 DnDDrop 초기화도 함께 되돌려짐(이중 undo 방지).
  2. **원본이 dropAble 라인 자체를 `attrChangeProc` 로 재수집하던 부분 생략** — `fnWs20AttrChange` 가 dropAble 라인 수집을 이미 마친 뒤 이 함수를 부름(이중 수집 방지). 따라서 이 함수는 **DnDDrop 부수효과만** 담당.
  3. **UI5 `oModel.refresh()` → HTML5 `fnRenderWs20AttrRows()`**. 단 두 소비처(변경=`fnWs20AttrChange`, 렌더=`_updateAttrList`)가 재렌더/바인딩팝업 반영을 이미 담당하므로 `bModelRefresh=false` 로 넘겨 데이터/`edit` 만 갱신.
- 렌더 측 잠금 표현은 **기존 코드가 이미 `edit` 를 존중** → 별도 CSS/렌더 변경 없음: 콤보 `bDisabled = !bEnabled || (sAttr.edit !== true)`(4744행), 서버이벤트 목록 열기(onOpen)는 `!bDisabled` 일 때만 배선(4782행), 비활성 콤보 처리(4826행).

## 검수 포인트
1. **원본 1:1 여부**: `attrSetDropAbleException` 본문이 원본(3388~3492) 로직과 값 판정·초기화 순서가 동일한가. HTML5 차이 3가지(undo/재수집/refresh)가 정당한 생략인가, 누락은 없는가.
2. **초기화 정확성**: dropAble 을 끄면 `ls_drop.UIATV=""` → `attrChgAttrVal(ls_drop,"DDLB")` 가 _T_0015 에서 DnDDrop 라인을 실제 제거하는지(1843~1864행: 이벤트 & 값 빈칸 & 클라이언트이벤트 없음 → splice). 속성 패널 표시값도 사라지는지.
3. **잠금 표현**: dropAble=false 에서 DnDDrop 콤보가 비활성(입력·목록 열기 불가)되는지. 렌더 경로(2802행)로 **UI 선택 시점**에도 잠금이 적용되는지(저장돼 재진입한 경우 포함).
4. **범위**: 특정 UI(BUTTON1/HBOX1) 한정이 아니라 `UIASN` 의미명으로 판단해 dropAble+DnDDrop 가진 모든 UI 에 적용되는지. 둘 중 하나만 있는 UI 에서 부작용(오작동/에러) 없는지(each early-return).
5. **undo 연동**: dropAble 을 끄고(→DnDDrop 초기화) Undo 하면 DnDDrop 이벤트가 스냅샷 복원으로 되살아나는지(별도 undo 미추가가 안전한지).
6. **busy/종료 대칭**: 훅이 `fnWs20AttrChange` 의 try 안에 있어 예외 시에도 finally 의 busy off/자식창 잠금 해제가 유지되는지(훅 자체도 try/catch 로 감싸 상위 흐름 비차단).

## 미해결/보고만 (BR31 밖)
- 같은 자리(2799행)의 **autoGrowing** 잠금 함수(`attrSetAutoGrowingException`)도 현행 HTML5 에 **정의가 없어** 동일하게 건너뛰어짐(자동증가 속성↔관련 이벤트 잠금 미적용 가능성). BR31 범위가 아니라 손대지 않음 — 별건 판단 필요.
