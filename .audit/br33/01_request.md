# BR33 검수 요청 (01_request)

## 버그 내용 (노션 이슈 DB)

- **코드**: BR33 / 화면: UI 속성 영역(WS20 속성 패널) / 분류: 기능
- **현상**: 이벤트에 서버 이벤트를 설정한 뒤, 그 이벤트 ROW의 값 표시 영역을 더블클릭해도
  Controller Class의 해당 메소드로 이동(SAP GUI 호출)이 되지 않는다. (원본 WS3.0은 이동됨)
- **계측**: 더블클릭 대상 DOM = 서버이벤트 값 표시 `span.u4a-combo__text`(data-uiatk=AT000004967,
  data-uiaty=2, 값 EV_TEST1). dblclick 이벤트는 발생했으나 이동 함수·SAP GUI 실행 IPC는 확인 안 됨.
- **기대**: 서버 이벤트가 설정된 이벤트 ROW에서 **이벤트명 링크·서버이벤트 생성 아이콘·클라이언트 이벤트
  등록 아이콘을 제외한 영역**을 더블클릭하면 연결된 Controller Class 메소드로 이동(SAP GUI 호출).
  특정 이벤트 한정이 아니라 서버 이벤트를 설정할 수 있는 모든 이벤트 ROW에 동일 적용.

## 검수 대상

- **수정 파일**: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - 신규 `oAPP.fn.attrDblClickServerEvent(is_attr)` — 원본 이식(typeof 가드).
  - `oAPP.fn.fnRenderWs20AttrRows()` 진입부: 속성 목록 컨테이너(`#ws20AttrRows`)에 더블클릭
    위임 리스너 1회 배선(`ROWS.__bwpDblWired` 가드).
- **원본(as-is)**: `www/ws30/ws10_20/design/js/uiAttributeArea.js`
  - `attrDblclickEvent`(2956): 속성표 전체 더블클릭 → 행 attr 읽어 styleClass→bindField→serverEvent 순 분배.
  - `attrDblClickServerEvent`(3089~3105): `UIATY!=="2"` 또는 `UIATV===""` 또는 trial → EXIT,
    아니면 `oAPP.common.execControllerClass(is_attr.UIATV)`.
- **공용 함수(HTML5 기존)**: `oAPP.common.execControllerClass`(ws_common.js:2785),
  `oAPP.fn.fnOnCheckIsTrial`(ws_fn_03.js:698). 둘 다 이미 존재. Find 팝업(fnFindPopupOpen.js:180)이
  `APPCOMMON.execControllerClass(res.UIATV)`로 동일 호출.

## 변경 요약 (원본 대비)

1. **원인**: 원본은 속성표 전체에 더블클릭 하나를 걸어 서버이벤트행이면 `execControllerClass(UIATV)`로
   이동. HTML5는 styleClass=F4 아이콘, bindField=별도 경로로 처리되면서 **서버이벤트 이동 배선만 누락**.
   (ws_html5_ws20_attr.js에 이동 함수 호출이 하나도 없었음 — dblclick은 라이브러리명 복사용 1건뿐.)
2. **조치**: 원본 `attrDblClickServerEvent`를 1:1 이식(가드 조건·`execControllerClass(UIATV)` 그대로,
   `UIATV` null 안전만 추가). 값칸(`.u4aWs20AttrRowVal`) 안에서 발생한 더블클릭만 처리하도록 목록 전체에
   위임 배선 → 이벤트명 링크·아이콘 셀(생성/등록)은 다른 셀이라 자연 제외(기대 사양과 일치).
   행 attr은 렌더 시 `ROW.__attrData = sAttr`로 이미 보관됨(우클릭 메뉴와 동일 참조).

## 검수 포인트

1. **정확성**: 서버이벤트행 값칸 더블클릭 시 `execControllerClass(UIATV)`가 실제 호출되는가.
   값 없음/이벤트 아님/trial에서 정확히 EXIT하는가(원본 3092·3096·3099 1:1).
2. **원본 1:1**: 이식 함수의 가드·호출이 원본과 동일한가. 원본에 없는 UX(안내·busy·포커스 등)를
   임의로 추가하지 않았는가.
3. **제외 영역**: 이벤트명 링크(라벨 셀)·서버이벤트 생성 아이콘·클라이언트 이벤트 등록 아이콘(아이콘 셀)에서
   더블클릭해도 이동이 트리거되지 않는가(값칸 한정 위임이 이를 보장하는가).
4. **배선 안전**: 목록은 매 렌더마다 내부를 비우지만 컨테이너(`#ws20AttrRows`)는 재사용 →
   `__bwpDblWired` 가드로 리스너 중복 부착이 없는가. 더블클릭이 값칸(커스텀 드롭다운)에서 컨테이너까지
   정상 버블되는가(중간에서 전파 차단 없음).
5. **부작용**: 값칸 단일 클릭(서버이벤트 목록 열기, getServerEventList)과 충돌 없는가. 오류 삼킴 없이
   예외를 콘솔로 표면화하는가.

## 근거

- 원본 파일: `design/js/uiAttributeArea.js` 2956(dispatcher)·3089~3105(serverEvent 처리).
- 공용 함수: `ws_common.js`:2785(execControllerClass), `ws_fn_03.js`:698(fnOnCheckIsTrial),
  `fnFindPopupOpen.js`:180(동일 호출 선례).
- 프로젝트 규칙: 원본(as-is) 1:1, 임의 UX 추가 금지, 오류 삼킴 금지.
