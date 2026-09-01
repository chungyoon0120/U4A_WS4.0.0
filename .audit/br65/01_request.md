# BR65 검수 요청 (01)

## 이슈 요약 (노션 이슈 리포트 DB, 코드=BR65 / 화면=바인딩 팝업 / 작성자=PES)
바인딩 팝업(대형 별창)에서 **이미 바인딩된 aggregation** 행에 좌측 바인딩 필드 리스트의 테이블 항목을 끌어놓으면
"하위 바인딩이 초기화된다"는 확인 팝업(메시지 181+182)이 뜬다.
이 확인 팝업에서 **취소**를 누르면 바인딩 처리는 중단되지만 **Main(WS20)과 Binding Popup 의 BUSY 가 해제되지 않아
이후 화면을 조작할 수 없다.**

- 재현: ① 바인딩 팝업 열기 → ② 기존 테이블 모델이 바인딩된 aggregation 항목 선택 → ③ 바인딩 필드 리스트의 `GT_LIST`
  테이블 항목 드래그 → ④ `LIST1` 의 `items` aggregation 에 드롭 → ⑤ 확인 메시지 표시
  (`Change the model, the binding that exists in the child is initialized. Do you want to continue?`) → ⑥ 취소 선택
  → ⑦ 확인 팝업은 닫히지만 Main·Binding Popup BUSY 가 계속 표시됨.
- 이슈 본문의 확인 결과: 취소 후 `attrBindCallBackAggr` Promise 가 resolve 되고 후속 `setRefFieldList` 까지 실행됐지만
  `setBusy(false)` / `setBusyWS20Interaction(false)` 호출이 확인되지 않음. 동기 예외·Promise reject·네트워크 실패 없음.
- 기대 결과(이슈 본문): 취소 시 ⓐ 바인딩 변경 중단 ⓑ 기존 aggregation 바인딩·하위 속성 바인딩 유지
  ⓒ 확인 팝업이 닫힌 뒤 Main·Binding Popup BUSY 모두 해제 ⓓ 즉시 다음 조작 가능.

## 검수 대상 (파일 · 함수)
- `www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js` — **이번 수정 파일**
  - `_confirmAsync(sMsg)` (파일-지역 helper, 322행 부근)
  - `oAPP.fn.attrBindCallBackAggr(bIsbind, is_tree, is_attr)` (349행 부근) — unbind 취소 분기 / 재바인딩 취소 분기
- (읽기만, 미변경) `www/ws30/ws10_20/Popups/bindPopup/designArea/designArea.js`
  - `_wireDesignDrop` 의 `drop` 리스너(1036~1063행) — 진입 시 `setBusy(true)` + `setBusyWS20Interaction(true,{DESC:220})`
  - `_onDesignDrop(ev)`(956~985행), `_setBindAttribute(is_drag, is_drop)`(881~904행, `case "3"` → `await attrBindCallBackAggr`)
- (읽기만, 미변경) `www/ws30/ws10_20/Popups/bindPopup/frame.js` — `_setBusy` / `oAPP.fn.setBusy` / `oAPP.fn.setBusyWS20Interaction`(259~317행)

### 실행 대상 확정 근거 (중요)
`Popups/bindPopup/` 아래에 **동명 함수가 4곳**에 있어 대상 확정이 먼저 필요했다.
- 별창 진입점 = `ws30/resources/pathInfo.js:82` `BINDPOPUP = Popups/bindPopup/frame.html`
- `frame.html` 이 로드하는 script 는 `frame.js`, `bindShared.js`, `utils/showMessagePopover.js`, `modelFieldArea/*`,
  `designArea/bindData.js`, `designArea/bindWrite.js`, `designArea/designArea.js`, `synchronizionArea/*`,
  `additInfoArea/*`, `layoutCustomizing/*`, `wsDesignHandler/bindBroadcast.js` (grep 확인)
- 따라서 `Popups/bindPopup/index.js` · `Popups/bindPopup/uiModule/designTree.js` 는 **현행 미로드**(index.html 계열, 변환 전 잔존).
  `Popups/_backup_bindPopup_20260708/` 은 `_` 접두 = 탐색 제외.
- 로드된 파일 전체에서 `attrBindCallBackAggr` 호출부는 **`designArea/designArea.js:900` 1곳뿐**(bIsbind=true).

## 변경 요약 (원본 대비)
원본(as-is) `attrBindCallBackAggr` 은 확인 팝업 앞뒤로 **BUSY 를 3단계로 직접 다룬다.**

| 시점 | 원본 호출 | 효과 |
|---|---|---|
| 확인 팝업 띄운 직후 | `setBusyWS20Interaction(false)` (sOption 없음) | **이 팝업 BUSY 만** OFF. WS20·다른 팝업은 유지(방송 안 함) |
| 확인 팝업 onClose 진입 | `setBusyWS20Interaction(true)` (sOption 없음) | **이 팝업 BUSY 만** 다시 ON |
| 판정이 `!== "OK"`(취소) | `setBusyWS20Interaction(false, {})` (sOption `{}`) | **WS20 + 팝업 전부** OFF 후 `return` |

HTML5 이식본 `bindWrite.js` 는 이 3단계가 **통째로 빠져 있었다.** 해당 함수 머리 주석에
`★ WS20 busy 핸드셰이크(setBusyWS20Interaction)는 P6 — 로컬은 동기라 생략.` 이라고 **미이식임이 명시**돼 있었다.
그 결과 취소 시 아무도 BUSY 를 끄지 않았다 —
드롭 리스너는 성공 경로를 가정해 자기해제를 하지 않고(`_setBindAttribute` 가 `case "3"` 에서 항상 `true` 반환),
정상 성공 경로의 해제 주체인 `attrSetBindProp` → WS20 왕복은 취소 시 아예 발생하지 않기 때문이다.

이번 수정은 원본 3단계를 **그 자리에 1:1 복원**한 것이며, 그 외 로직(판정·바인딩 처리·후속 호출 순서)은 손대지 않았다.

- `_confirmAsync` onClose 첫 줄에 `oAPP.fn.setBusyWS20Interaction(true);` 추가 (원본 6976 · 7051)
- `_confirmAsync` 의 `U4AUI.confirm({...})` 호출 **직후**에 `oAPP.fn.setBusyWS20Interaction(false);` 추가 (원본 6990 · 7064)
- unbind 취소 분기 `if (_p1 !== "OK")` 에 `oAPP.fn.setBusyWS20Interaction(false, {});` 추가 (원본 6999)
- 재바인딩 취소 분기 `if (_p2 !== "OK")` 에 `oAPP.fn.setBusyWS20Interaction(false, {});` 추가 (원본 7075)
- 머리 주석의 "P6 생략" 문구를 복원 사실로 교체

### 원본에 없는 것을 넣지 않았음
- 드롭 핸들러(`_onDesignDrop` / `_setBindAttribute`)의 반환값 계약은 **바꾸지 않았다.**
  원본도 `await _setBindAttribute(...)` 의 반환을 보지 않고 취소 여부와 무관하게 후속
  `setRefFieldList()` · `_refreshAdditBindInfo()` · 재렌더를 실행한다
  (원본 `uiModule/designTree.js:1320~1341`). 취소 시 그 후속이 **BUSY 해제 뒤에** 도는 것도 원본과 동일.
- 토스트·안내 문구·새 메시지 키를 추가하지 않았다(원본에 없음).

## 검수 포인트
1. **원본 1:1 여부**: 추가한 3단계의 **호출 위치·인자 형태**가 원본과 같은가.
   특히 `setBusyWS20Interaction(false)`(sOption 없음, 방송 안 함) 와 `setBusyWS20Interaction(false, {})`(sOption `{}`, BUSY_OFF 방송)
   의 **구분이 뒤바뀌지 않았는가.** 뒤바뀌면 확인 팝업이 떠 있는 동안 WS20 BUSY 가 조기 해제된다.
2. **BUSY on/off 짝**: 드롭 진입에서 켠 BUSY 가 `attrBindCallBackAggr` 의 **모든 종료 분기**에서 해제되는가.
   - 취소 2갈래 → 이번에 추가한 전체 OFF
   - 확인(YES) → `attrSetBindProp` → WS20 왕복이 해제(자기해제 금지 규칙)
   - `oAPP.attr.prev[is_attr.OBJID]` 미존재 등 예외 → 드롭 리스너 `catch` 의 `setBusyWS20Interaction(false, {})` 로 회수되는가
3. **해제 신호 도달**: 별창 → WS20 의 BUSY_OFF 가 `wsDesignHandler/broadcastChannelBindPopup.js` 에서
   횟수 세기 없이 1회로 해제되는가(진입 시 `setBusy(true)` + `setBusyWS20Interaction(true,{DESC})` 로 BUSY_ON 이 2번 나가는데,
   OFF 는 1번만 보낸다). 확인한 바로는 `sendDesignAreaBusyOff`(666행)가 단순 전달이라 1회면 충분하나 재확인 요청.
4. **취소 시 데이터 무변경**: 취소 분기가 `attrUnbindAggr` / `attrUnbindTree` / `attrSetBindProp` 앞에서 `return` 하므로
   기존 aggregation 바인딩과 하위 속성 바인딩이 그대로 남는가(기대 결과 ⓑ).
5. **확인 팝업 클릭 가능성**: 확인 팝업 표시 직후 팝업 BUSY 를 끄는 처리가, 로딩 덮개가 확인 팝업을 가려
   버튼이 안 눌리는 문제(작은 바인딩 팝업의 BR25 와 동종)를 유발하지 않는가 / 반대로 끄는 바람에
   확인 팝업 뒤 화면이 조작 가능해지지 않는가(`U4AUI.confirm` 이 `showModal()` 이면 뒤 화면은 자동 차단).
6. **짧은 BUSY 깜빡임**: 취소 시 onClose 의 재-ON → 곧바로 전체 OFF 로 로딩 표시가 순간 켜졌다 꺼진다.
   페인트가 끼어들어 화면이 번쩍이지 않는가(원본도 동일 순서이나 HTML5 는 덮개가 서서히 나타나는 처리가 있어 확인 필요).
7. **중복 구현 여부**: 같은 별창의 `designArea.js:800` `_confirmAdditApply(sMsg, sBusyDesc)` 가 이미 동일 패턴을 갖고 있다.
   그 헬퍼는 `designArea.js` 파일-지역 함수라 `bindWrite.js` 에서 호출할 수 없어 `_confirmAsync` 에 직접 넣었다.
   - 미세 차이: `_confirmAdditApply` 의 onClose 재-ON 은 `setBusy(true,{ISBROAD:true})`,
     이번 것은 원본대로 `setBusyWS20Interaction(true)`. 두 경로 모두 최종적으로 `_setBusy(true,{ISBROAD:true})` 를 타지만
     후자는 `oAPP.attr.isBusyWS20` 도 갱신한다. **원본과 같은 쪽은 후자**로 판단했는데 맞는지 확인 요청.
   - 두 헬퍼를 하나로 합치는 게 나은지 의견 요청(합치는 것은 별도 지시 전까지 하지 않음).
8. **회귀**: 확인 팝업이 뜨지 않는 경로(처음 바인딩, 즉 `is_attr.UIATV === ""` 또는 `ISBND !== "X"`)와
   확인(YES) 경로의 BUSY 동작이 이번 변경 전과 같은가.

## 근거
- 원본(as-is, 상류 = `U4A_WS_DESIGN`, 읽기 전용):
  - `Popups/bindPopup/index.js:6950` `oAPP.fn.attrBindCallBackAggr` — BUSY 3단계 원문
    (unbind 갈래 **6976 / 6990 / 6999**, 재바인딩 갈래 **7051 / 7064 / 7075**)
  - `Popups/bindPopup/uiModule/designTree.js:1189` `onDropBindField` — 드롭 진입 BUSY(1232) 와 중단 분기 OFF(1251/1268/1290/1309),
    `_setBindAttribute`(890) `case "3"` → `await attrBindCallBackAggr`(925), 취소 여부와 무관한 후속(1320~1341)
- 프로젝트 규칙: `.claude/rules/code.md` — "busy: on 걸면 모든 종료 분기(early return/취소/에러)에서 off 짝 필수.
  성공은 WS20 왕복이 해제(자기해제 금지)"
- 선례: 작은(메인 창 안) 바인딩 팝업의 같은 함수 `www/ws30/ws10_20/js/fnBindPopupOpen.js:1583` 는
  BR25 에서 이미 취소 시 해제를 넣어 둔 상태(이번 별창 건과 동종 결함, 별창만 미이식이었음)
- `.analy`: 신규 UX 없음 — 원본 BUSY 시퀀스 이식만이라 별도 UX 표준 적용 대상 아님
- 검증: `node --check designArea/bindWrite.js` 통과. 실화면 테스트는 미실시(앱 재시작 필요).
