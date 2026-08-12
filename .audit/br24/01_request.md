# BR24 검수 요청 (01_request)

## 대상 이슈 (노션 이슈리포트 BR24)
- 화면: WS20 **UI 속성 영역**(우측 Attribute) — 서버 이벤트(Event) 항목
- 이슈1: **대기모드(WAIT) 상태 아이콘 누락** — 이벤트 항목 우클릭 메뉴 "대기모드 켜기/끄기"로 값(`ISWIT`)은 정상 바뀌나, 화면에 상태 아이콘이 안 떠 ON/OFF 구분 불가.
- 이슈2: **등록된 서버이벤트 미존재 시 오류 표시 누락** — 이벤트 DDLB(드롭다운)를 펼치면 `getServerEventList` 로 목록 조회. 현재 등록값이 그 목록에 없어도 오류 표시가 없음.

## 검수 대상 파일·함수
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - `fnRenderWs20AttrRows` 내부 라벨 셀 빌더 (이슈1 아이콘 렌더 추가)
  - `_buildValueControl` 내부 이벤트 DDLB `onOpen` 콜백 + 콤보 렌더 경로 + `_onPick` (이슈2 검증·오류표시)
- `www/ws30/ws10_20/WS10/css/ws20.css`
  - `.u4aWs20AttrLblIcon` (이름 앞 종류 아이콘 여백/색)
  - `.u4aWs20AttrCombo.err` (콤보 빨간 오류 테두리)

## 원본(as-is) 근거
- `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - 라벨 = `sap.m.ObjectStatus({text:"{UIATT}", icon:"{UIATT_ICON}", active:true})` (:667) — **모든 속성 행**의 이름 앞에 종류 아이콘.
  - 이벤트 케이스 `attrSetLineStyle`: `UIATT_ICON="sap-icon://border"`, `ISWIT==="X"`면 `"sap-icon://complete"` 로 교체.
  - DDLB open/F4 핸들러(:1110–1113, :1317–1320): `if(UIATV!=="" && 목록에 없음){ setAttrFocus(UIATK,"E"); }` — **문구 없이** `valueState=Error`(빨간 테두리)만.
- 컨텍스트 메뉴 토글: `ws_html5_ws20_attr_ctxmenu.js` `_waitOnOff` → `ISWIT` "X"↔"" → `fnWs20AttrChange`.
- `.analy` 문서(03 §7.15)는 서버이벤트 **생성** 흐름만 규정. 대기모드 아이콘·미존재 검증은 문서에 없음 → **원본 소스가 SSOT**.

## 변경 요약 (원본 대비)
### 이슈1 — 아이콘 렌더 (누락분 복원)
- 값 토글(`ISWIT`)·아이콘 값 계산(`UIATT_ICON`)·재렌더는 이미 정상. **누락은 "라벨에 아이콘 그리는 코드" 자체**였음(HTML5 이식 때 텍스트만 그림).
- 라벨 셀에 `UIATT_ICON` 존재 시 아이콘(`_iconHtml`) 1개를 이름 앞에 추가. sap-icon→FontAwesome 매핑(`_ICON_FA`)은 이미 존재(property=슬라이더 / event=네모·대기끔=체크 / aggregation=마름모)했음 — 원저자가 아이콘 표시를 의도했던 정황.
- **적용 범위 주의**: 원본 ObjectStatus 처럼 **모든 속성 행**(프로퍼티/이벤트/집합)에 종류 아이콘이 뜬다(이벤트만 X). 이벤트만 조건부로 다는 것이 오히려 원본에 없는 창작이라 판단해 원본대로 전 행 적용함. ROOT Document 속성은 원본과 동일하게 아이콘 없음(`attrSetLineStyle` early return).

### 이슈2 — 미존재 서버이벤트 오류표시 (원본 setAttrFocus "E" 대응)
- 기존 코드는 주석("원본은 오류표시 — 여기선 값 유지")과 함께 **검증을 의도적으로 뺀** 상태였음.
- `onOpen` 조회 후, 등록값이 목록에 없으면(`!bHas && UIATV`): 값을 선두에 끼워 표시 유지 + `valst="Error"`(문구 없음, 원본과 동일) + 그 콤보에 `err` 클래스. 유효하면 오류 해제.
- **원본은 `setAttrFocus` 내부에서 전체 재렌더**하나, HTML5의 재렌더는 방금 연 드롭다운을 파괴하므로 재렌더 대신 **해당 콤보에 직접 오류표시만** 건다(결과는 원본과 동일: 빨간 테두리 + 목록 열림).
- 콤보 렌더 경로에도 `valst==="Error"` → `err` 클래스 배선(텍스트 입력칸 기존 `.err` 처리와 1:1). 값 새로 선택 시(`_onPick`) 이 라인 오류 해제.

## 검수 포인트
1. **원본 1:1 여부**: 이슈2에서 문구를 새로 만들지 않고 원본대로 "빨간 테두리만" 준 것이 맞는가. (BR24 본문의 `"… does not exist in the control event method."` 문구는 저장소 전체 grep에 없음 → 서버 응답으로 추정, 화면 코드는 원본도 문구 없음.)
2. **이슈1 적용 범위**: 이름 앞 종류 아이콘을 **전 속성 행**에 표시한 것이 과한가/원본대로인가. (원본 ObjectStatus 는 전 행 표시.)
3. **정확성**: `onOpen` 에서 `valst` 설정이 모델의 실제 `T_ATTR` 줄에 반영되는지(콤보 재렌더 시 빨간표시 유지), 값 선택 후 해제가 프로퍼티 DDLB 검증(`checkPropertyValue`)과 충돌 없는지.
4. **공통 자산 미수정**: `.u4a-combo` 공통은 안 건드리고 화면 스코프(`.u4aWs20AttrCombo.err`)로만 override 했는가. 하드코딩 hex/color-mix 없음(`var(--error)`, `var(--text-muted)` 사용).
5. **오류표시 해제 대칭**: 오류 설정(onOpen)·유지(렌더)·해제(_onPick·유효값 재오픈) 경로가 빠짐없이 짝을 이루는가.

## 미해결/보고만
- 집합(Aggregation) 0:1/0:N 라벨 아이콘이 `_ICON_FA` 에서 둘 다 마름모로 매핑됨(원본은 color-fill vs dimension 다른 아이콘). **기존 매핑**이며 BR24 범위 아님 → 손대지 않음(보고만).
