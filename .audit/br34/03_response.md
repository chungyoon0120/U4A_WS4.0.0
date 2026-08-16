# BR34 보완·해명 (03_response)

코덱스·안티 두 검수 모두 **수정필요(P2)**. 코덱스 3건 + 안티 4건(코덱스 3건 + 자체 1건).
각 지적을 원본(`uiAttributeArea.js`)·`.analy/15` §3.5·소스로 직접 재확인한 뒤 반영/반론을 정했다.

## 소스 재확인(사실 근거)
- **원본 검증 직후 open**: `design/js/uiAttributeArea.js:772-773`(change 진입 시 기존 메시지 close), `:826-833`
  (`attrChange` 완료 후 `_sAttr.valst !== undefined` 이면 `this._oValueStateMessage.open()`) — 오류가 남으면 **클릭 없이 즉시** 메시지를 연다.
- **`.analy/15` §3.5.4(★센스, 전 경로 동일)**: 검증 실패 시 **그 오류 필드에 자동 `focus()`**. 메시지는 `:focus-within` 일 때만
  뜨므로 포커스가 있어야 보인다. **함정 A** — 진행 중 change/blur '도중' 동기 `focus()` 는 Chromium 이 무시 → **다음 틱(`setTimeout 0`)**.
  **함정 B** — busy/모달이 떠 있으면 `focus()` 가 막힘 → busy 해제 후 다음 틱.
- **재렌더 사슬**: 값칸 `onChange` → `fnWs20AttrChange` → 검증(`valst/valtx` 설정) → `fnRenderWs20AttrRows()`(`ROWS.innerHTML=""` 로 입력 DOM 파기·재생성) → finally 에서 busy·단축키 해제.
- **바깥클릭 방어 대상**: 오류 팝오버는 포커스 불가한 `<span>`(`.u4a-field__msg`), 그리고 검증 메시지는 전역 `user-select:none`(데이터 표면만 text) — 드래그 선택 대상이 아니다.

## 지적 대응 표

| # | 지적(검수자) | 결정 | 반영 내용·위치 |
|---|---|---|---|
| F1 | 스크롤·리사이즈로 팝오버를 숨긴 뒤 **이미 포커스된 같은 칸을 재클릭**하면 `focus` 재발생 안 해 팝오버가 다시 안 뜸 (코덱스1·안티) | **반영** | 오류 값칸에 `click` 리스너 추가 → `_attrVsShow` 재호출(포커스 유지 상태 재표출). `ws_html5_ws20_attr.js` 값칸 오류 배선 |
| F2 | 팝오버 열린 채 행을 **재렌더(`ROWS.innerHTML=""`)** 하면 파기된 입력칸을 앵커로 둔 고아 팝오버 잔존 + `_attrVsField` 가 분리된 옛 DOM 참조 (코덱스2·안티) | **반영** | ① `fnRenderWs20AttrRows` 진입부에서 `ROWS.innerHTML=""` **직전** `_attrVsHide()` 명시 호출. ② `_attrVsHide` 가 `_attrVsField=null` 로 앵커참조 해제 |
| F3 | 원본은 검증 직후 오류 남으면 `_oValueStateMessage.open()` 즉시 호출인데 HTML5 는 재렌더만 하고 자동 포커스/표시 안 함 → 사용자가 다시 클릭해야 보임 (코덱스3·안티) | **반영** | `fnWs20AttrChange` 재렌더 직후 `_attrVsRefocus(sAttr.UIATK)` — 오류면 **다음 틱**(busy 해제=finally 뒤)에 그 오류 값칸을 찾아 `focus()` → focus 리스너가 팝오버를 연다. 원본 open + `.analy/15` §3.5.4(함정 A·B) 준수. 오류 없으면 예약 취소(직렬화) |
| F4 | 바깥클릭 방어(`mousedown` capture)에서 팝오버 내부 클릭 시 `preventDefault` 없음 → 텍스트 드래그 시 포커스 이탈로 blur 발동해 팝오버 닫힘 (안티 자체) | **반론(미반영)** | ① 팝오버는 **포커스 불가한 `<span>`** — Chromium 에서 비포커스 요소 `mousedown` 은 입력칸 포커스를 옮기지 않아 `blur` 가 발생하지 않는다(전제 불성립). ② 검증 메시지는 전역 `user-select:none` 이라 **드래그 선택 자체가 불가** → 재현 시나리오 없음. ③ 근거로 삼은 검증된 원본 패턴(`fnBindPopupOpen.js` `_bindVsShow`)도 `preventDefault` 없음 — 추가 시 오히려 참조 패턴과 어긋난다. → 원본에 없는 방어 신설이라 미반영. (해가 없는 한 줄이라 장군님 지시 시 방어적으로 추가 가능) |

## 반영 위치(수정 파일)
- `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
  - `_attrVsHide` — 숨김 시 `_attrVsField=null`(F2).
  - `_attrVsRefocus(sUiatk)` 신규 — 다음 틱 오류 값칸 자동 포커스(F3, `.analy/15` §3.5.4 함정 A·B).
  - 값칸 오류 배선 — `focus`+`click`+`blur`(F1).
  - `fnRenderWs20AttrRows` 진입부 `_attrVsHide()`(F2).
  - `fnWs20AttrChange` 재렌더 직후 `_attrVsRefocus(...)`(F3).

## 검증
- `node --check` 통과.
- 실화면 재검증은 장군님 테스트(`.works/ws20attrchange/00_현황판.md` BR34 그룹)로 확인 예정.

## 추가 수정 (장군님 실화면 지시 2026-08-14 — 검수 범위 밖, 실사용 결함)
- **증상**: 허용범위 밖 값(예 `months=400`)을 넣으면 기본값(1)로 되돌아가면서 오류 표시가 남는데,
  되돌아간 1이 **이미 유효한 값**이라 값을 그대로 두면(재입력해도 변화 없음) 재검증이 안 일어나
  **오류 표시가 안 풀리는 막다른 상태**가 됐다. (원본 `uiAttributeArea.js:1929-1944`도 동일 구조 — 원본 결함)
- **지시·결정**: 오류 시 기본값 복구 대신 **값칸을 비운다**(원본 1937행에 주석으로 남아있던 `UIATV=""` 방식으로 환원).
  비어 있는 동안 오류 표시(빨간 테두리+말풍선) 유지 → 사용자가 올바른 값을 넣으면 다음 변경 진입부
  `attrClearErrorField`+재검증으로 오류가 풀린다(막다른 상태 해소). 갑자기 칸이 비는 이유를 알 수 있게
  점검 오류 사유(`valtx`, 기존 점검 메시지)를 `parent.showMessage` 로 한 번 안내.
- **위치**: `fnWs20AttrChange` 검증 오류 분기 — `sAttr.UIATV = ""` + `parent.showMessage(null,10,"E",valtx)`.
  (새 메시지 문구 생성 없음 — 점검 모듈이 준 기존 메시지 재사용.)
- **주의(원본 대비)**: "오류 시 기본값 복구" → "값 비우기"로 **입력값 복구 정책이 원본과 달라진다**(장군님 지시).
  노션 BR34 본문의 "복구 동작 변경 금지" 문구와 상충하나, 장군님 실화면 지시가 우선.

## 잔여 참고(검수자 제기, 미반영·별도 실화면 확인 권고)
- 코덱스: 팝오버가 입력칸 아래 고정 좌표만 쓰고 뷰포트 하단 flip/clamp 없음 → 마지막 가시 행에서 문구가 화면 밖으로 잘리는지 실화면 확인 필요(근거로 든 바인딩 팝업 패턴도 동일이라 BR34 단독 회귀 아님).
- 코덱스: `z-index:40` 은 속성 패널 고정 헤더보다 위·공통 콤보/메뉴/모달보다 아래 — 동시 표시 상황의 레이어 우선순위 실화면 확인 권고.
