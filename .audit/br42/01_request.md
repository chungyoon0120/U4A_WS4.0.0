# BR42 검수 요청서

## 이슈 요약
- **화면**: WS20 Design > Attribute(속성) 영역
- **현상**: 속성 초기화(Reset) 버튼으로 여러 프로퍼티(text·type·width·icon 등)를 한꺼번에 기본값으로 되돌린 뒤, **되돌리기(Undo)를 하면 한 번에 복원되지 않고 프로퍼티가 한 건씩 순차 복원**됨.
- **기대(WS3.0 동일)**: Reset은 되돌리기 **한 작업 단위**로 관리되어, Reset 직후 Undo 한 번에 초기화된 모든 프로퍼티가 함께 복원되어야 함.

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_attr.js`
- 함수: `oAPP.fn.attrResetAttr` (약 4431행~)
- 관련: `oAPP.fn.fnWs20AttrChange`(3712행, `bSkipUndo` 인자), `oAPP.fn.fnWs20PushUndo`(edit.js:237)
- 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_attr.js.br42bak`

## 원인
`attrResetAttr`의 초기화 루프가 각 프로퍼티마다 `fnWs20AttrChange(_sAttr, uityp)`를 호출했고, `fnWs20AttrChange`는 `bSkipUndo`가 true가 아니면 매 호출마다 `fnWs20PushUndo()`로 되돌리기 스냅샷을 1건씩 쌓는다. 따라서 Reset으로 N개 프로퍼티를 바꾸면 스냅샷이 N개 쌓여 **Undo를 N번 해야** 원상복귀됐다.

## 변경 요약 (원본 대비)
원본(as-is) `design/js/uiAttributeArea.js` `attrResetAttr`(2138행)는:
1. `getResetAttrParam()`으로 초기화 대상을 수집하고, **대상이 1건 이상일 때만**
2. `saveActionHistoryData("RESET_ATTR", _aResetAttr)`로 **Reset 전체를 되돌리기 한 스텝으로 1회만** 적재한 뒤,
3. 루프에서 각 변경은 `attrChangeProc(_sAttr, "", true)`(개별 undo 미적재)로 처리한다.

이 계약을 HTML5에 이식:
- 초기화 루프에서 **첫 실제 변경 직전에 `fnWs20PushUndo()`를 1회만** 호출(스냅샷 = 그 시점 `_T_0015` 전체 = Reset 직전 상태).
- 실제 변경 대상이 하나도 없으면 push하지 않음(빈 undo 방지 — 원본 `length > 0` 대응).
- 루프의 각 변경은 `fnWs20AttrChange(_sAttr, uityp, true)`(`bSkipUndo=true`)로 개별 스냅샷 생략.
- 함수 상단 설명 주석의 옛 서술("undo는 fnWs20AttrChange가 변경건마다 자체 기록")을 BR42 반영 내용으로 정정.

이 "PushUndo 1회 + 각 변경 bSkipUndo=true" 패턴은 같은 파일 `attrSelOption2F4HelpIDDel`(3990·4015행)에서 이미 검증된 방식과 동일하다.

## 검수 포인트
1. **정확성**: Reset 후 Undo 한 번에 초기화된 모든 프로퍼티가 함께 복원되는가(스냅샷 1회 시점이 Reset 직전 전체 상태인가).
2. **원본 1:1**: 원본 `RESET_ATTR` 1스텝 계약과 일치하는가. 실제 변경 0건일 때 undo를 안 쌓는 것이 원본 `if(_aResetAttr.length > 0)`와 대응하는가.
3. **부작용 없음**: `bSkipUndo=true` 전달이 `fnWs20AttrChange`의 다른 처리(값 수집·변경표시·헤더 상태·재렌더·자식창 busy)에 영향을 주지 않는가(undo push만 건너뜀).
4. **되돌리기 스택 규칙**: WS20 단일 스냅샷 스택(`fnWs20PushUndo`) 규칙에 부합하는가(별도 스택 신설 없음).
5. **Reset 대상 제외 유지**: 서버 이벤트(press 등 바인딩·이벤트 항목)는 Reset 대상에서 제외되어 그대로 유지되는가(기존 필터 `UIATY==="1" && ISBND!=="X"` 불변).

## 근거
- 원본: `C:\Users\socce\Documents\Github\U4A_WS_DESIGN\design\js\uiAttributeArea.js` `attrResetAttr`(2138행), undo 적재 2168~2173행.
- 현행 패턴 선례: `ws_html5_ws20_attr.js` `attrSelOption2F4HelpIDDel`(3970~4024행), `fnWs20AttrChange` `bSkipUndo` 처리(3760~3765행).
- 메모리: WS20 undo 단일 스냅샷 스택 규칙.
