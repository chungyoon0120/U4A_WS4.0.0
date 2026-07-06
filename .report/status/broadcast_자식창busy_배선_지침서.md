# WS20 자식창 busy 브로드캐스트 배선 — 인계 지침서

> 작성: 2026-07-06 세션 / 대상: 다른 세션에서 이어받을 담당(사람 또는 AI)
> 관련 개인메모리: `bindpopup-busy-broadcast-skip`, `broadcast-busy-pair`, `sendajax-busy-off-caller`

---

## 1. 이게 뭔가 (한 줄)

디자인 화면에서 **속성/구조를 바꿀 때, 열려있는 다른 브라우저 창(앱 멀티 미리보기 등)에
"잠깐 busy(잠금)" 신호를 보내는 것**. 원본이 모든 디자인 변경마다 하던 동작인데
HTML5 변환에서 일부가 빠져 있었고, 이번 세션에 채워 넣음.

## 2. 메커니즘 (원본 = HTML5 동일)

- 채널: `oAPP.attr.oMainBroad = new BroadcastChannel("broadcast-to-child-window_" + browserKey)`
  - 생성/수신부: `www/ws30/ws10_20/js/broadcast/ws_fn_broad.js`
  - 수신 시: `BUSY_ON → parent.setBusy("X")`, `BUSY_OFF → parent.setBusy("")` (열린 자식창 전부)
- 원본은 `bindPopupBroadCast("BUSY_ON"/"BUSY_OFF")` 호출 → 내부 `sendBindPopupBusyOn/Off` 가
  `oMainBroad.postMessage({PRCCD:"BUSY_ON"})`로 전체 자식창에 뿌림
  (원본 모듈: `www/ws30/ws10_20/design/bindPopupHandler/broadcastChannelBindPopup.js` 839·814행).
  ★ 이 모듈은 HTML5에서도 동작함(`dnd.js`가 `_req("bindPopupBroadCast")`로 사용 중).
- 자식창에 가는 메시지는 **DESC 없는 plain BUSY_ON/OFF**(DESC/_sOption 은 바인딩팝업 채널 전용).

## 3. 이번 세션에 배선한 것 (완료)

| 파일 | 위치 | 내용 |
|---|---|---|
| `js/ws_html5_ws20_attr.js` | 헬퍼 `_broadChildBusy(bOn)` 신설(~110행) | oMainBroad ON/OFF 공통 |
| 〃 | `fnWs20AttrChange` 시작/finally | 값편집·DDLB·체크박스·F4·App·이벤트생성·초기화 **전부 자동 커버**(다 이걸 거침) |
| 〃 | `attrChnageOBJID` 시작 + 모든 종료(_fail·동일이름·성공·early guard) | OBJID 변경(이건 fnWs20AttrChange 안 거침) |
| `js/ws_html5_ws20_edit.js` | 헬퍼 `_broadBusy(bOn)` 신설(~75행) | oMainBroad ON/OFF 공통(edit.js용) |
| 〃 | `fnWs20ExecHistory._doApply` | undo/redo(실제 복원부만, try/finally) |
| 〃 | `_deleteUI` / `designTreeMultiDeleteItem` / `_moveUI` / `_pasteUI` / `_moveUIPosition` | 삭제·이동·붙여넣기·위치이동, 각 변경부 앞뒤 |
| 〃 | 삽입 팝업 `lf_confirm` | 삽입(Promise 체인 — async 완료 후 OFF) |
| `js/fnBindPopupOpen.js` | 주석만 정정 | "skip"→"공통 fnWs20AttrChange 담당" |

**이미 커버돼 있던 것(건드리지 않음):**
- **D&D 삽입/이동/복사** → `dnd.js` 의 `_bindBusy`(=`bindPopupBroadCast` 모듈)가 이미 처리.
- **UI 선택** → `fnWs20SelectUI`(attr.js 3131·3174행)가 기존부터 oMainBroad 사용.

## 4. 남은 것 / 검토 필요 (다른 세션)

1. **클라이언트 JS 이벤트 저장 콜백**(`attrClientEventPopup` 의 `lf_cb`, attr.js ~3586행):
   `fnWs20AttrChange` 안 거치고 브로드캐스트 없음. 다만 client JS 는 런타임 동작이라 미리보기 창이
   반응 안 할 수 있음 → 원본이 여기서 BUSY_ON 하는지 확인 후 필요시 배선.
2. **원본 19곳 전수 대조**: 원본 `uiAttributeArea.js`/`uiDesignArea.js` 의 `bindPopupBroadCast("BUSY_ON")`
   (약 19곳)을 grep 해서, HTML5에서 그 함수가 변환됐는데 위 공통경로를 안 거치는 게 더 있는지 최종 확인.
   (현재까지 확인된 주요 변경은 다 커버.)

## 4-1. ★ 팝업별 broadcast 연결 확인 (다른 세션에서 할 일)

WS20 속성/디자인을 바꾸는 **각 팝업의 Apply/콜백이 자식창 broadcast 로 연결되는지** 하나씩 확인.
판정 기준: **그 팝업의 적용 콜백이 `fnWs20AttrChange` 를 거치면 자동으로 broadcast 됨(✅).**
안 거치고 데이터를 직접 만지면(예: T_* 배열 직접 수정) broadcast 누락 → 배선 필요(🔴).
확인 후 아래 표의 `확인` 칸을 채운다.

| 팝업(파일) | 적용 경로(추정) | fnWs20AttrChange 경유? | 확인 |
|---|---|---|---|
| App F4 (`fnAppF4PopupOpen`) | `attrAppf4Popup` 콜백 | ✅ (이번 세션 확인) | ☑ |
| SearchHelp F4 (`fnF4SearchHelpPopup`) | `attrSelOption2F4HelpID` 콜백 | ✅ | ☑ |
| 동적 리스트 (`fnDynListPopup`) | `attrSelOption2F4HelpReturnFIeld` 콜백 | ✅ | ☑ |
| AppID 삭제 (icon2) | `attrAppF4Del` | ✅ | ☑ |
| 컬러 피커 (`fnColorPickerPopover`) | 값도움 f4 콜백 | ⬜ 확인 | ⬜ |
| CSS/JS Link Add (`fnCssJsLinkAddPopupOpen`) | Apply → T_CSLK/T_JSLK | ⬜ 확인 | ⬜ |
| Web Security (`fnWebSecurityPopupOpen`) | Apply → S_WSO | ⬜ 확인 | ⬜ |
| Enable Dump Write (`fnDumpWritePopupOpen`) | Apply=fnWs20AttrChange(추정) | ⬜ 확인 | ⬜ |
| Init Pre-screen (`fnInitPreScreenPopupOpen`) | Apply → attrChangeProc? | ⬜ 확인 | ⬜ |
| 바인딩 팝업 (`fnBindPopupOpen`) | attrBindCallBackProp/Aggr | ⬜ 확인 | ⬜ |
| 동일 속성 동기화 (`fnSameAttrSyncPopupOpen`) | fnWs20AttrChange bSkipUndo(추정) | ⬜ 확인 | ⬜ |
| 내 패턴/UI 개인화 (`fnP13nDesignPopupOpen`) | ? | ⬜ 확인 | ⬜ |
| UI Attribute 개인화 항목 (`fnAttrPresetSettingsOpen`) | SQLite 저장(디자인 변경 아님?) | ⬜ 확인 | ⬜ |
| 클라이언트 JS 이벤트 에디터 (`attrClientEventPopup` lf_cb) | 직접 T_CEVT + ADDSC | 🔴 미경유(§4-1) | ⬜ |
| 스켈레톤 화면 (`prevSetSkeletonScreen`) | T_SKLE | ⬜ 확인 | ⬜ |

> 확인 방법: 각 팝업 파일에서 적용/저장 콜백을 찾아 `fnWs20AttrChange` 호출 여부 grep.
> - **경유하면** → 이미 broadcast 됨(추가 작업 없음).
> - **직접 데이터 수정이면** → 원본 그 팝업 콜백이 `bindPopupBroadCast("BUSY_ON")` 하는지 대조 후,
>   하면 콜백 앞뒤에 `oAPP.attr.oMainBroad.postMessage({PRCCD:"BUSY_ON"/"BUSY_OFF"})` 배선(§6 패턴, §5 함정 준수).
> - 팝업 열기 자체가 무거운 종류(에디터/다이얼로그류)는 opener 가 이미 broadcast 함(`fnEditorPopupOpen`·
>   `fnDialogPopupOpener`·`fnFindPopupOpen`·`fnErrorPageEditorPopupOpen` 확인됨) — 중복 배선 주의(§5 중첩).

## 5. ★ 주의/함정 (반드시 숙지)

- **`parent.setBusy` 는 플래그(카운터 아님)**: "X"/"" 로 on/off. 그래서 브로드캐스트가 **중첩**되면
  (ON→ON→OFF→OFF) 안쪽 OFF 에서 자식창이 **조기 해제**됨. 단 이건 기존 로컬 busy 패턴과 동일 →
  **새 버그 아님**. 그래도 **새로 감쌀 땐 이미 브로드캐스트하는 경로(D&D `_bindBusy`)와 중첩되는지 확인**.
  - 실례: `designAddUIObject` 는 D&D 드롭 + 삽입팝업 양쪽에서 호출 → 함수 자체를 감싸면 D&D 중첩.
    그래서 **삽입팝업 `lf_confirm` 에서만** 감쌌음.
- **짝 맞추기(stuck 방지)**: BUSY_ON 뒤에 **모든 종료 경로**에 BUSY_OFF 가 있어야 함.
  early return / 에러 return 지점 누락 시 자식창이 **영구 잠금**됨. try/finally 권장.
- **async 주의**: 변경이 async(await)면 BUSY_OFF 를 완료 후에 쏴야 함(삽입 = Promise 체인으로 처리).
  동기 변경은 ON→OFF 가 한 틱이라 자식창 깜빡임 거의 없음.
- 새 파일에서 헬퍼(`_broadChildBusy`/`_broadBusy`)는 **모듈 스코프 전용** — 다른 파일에선 접근 불가.
  다른 파일은 인라인 `oAPP.attr.oMainBroad && oAPP.attr.oMainBroad.postMessage({PRCCD:...})` 로.

## 6. 배선 패턴 (복붙용)

동기 변경(삭제/이동 등): 실제 변경부 앞뒤에
```js
_broadBusy(true);            // ← fnWs20PushUndo() 직전(가드/early-return 다 통과한 뒤)
oAPP.fn.fnWs20PushUndo();
// ...변경(splice 등)...
_refreshTree(); _selectNode(...); _markChanged();
_broadBusy(false);          // ← 마지막 변경 라인 뒤
```
async 변경(삽입 등):
```js
_broadBusy(true);
Promise.resolve(oAPP.fn.designAddUIObject(...))
  .catch(function(e){ console.error(...); })
  .then(function(){ _broadBusy(false); });
```

## 7. 검증 방법

1. 앱 **완전 재시작**(Electron — 새로고침 X).
2. 헤더 **"앱 멀티 미리보기"** 로 자식창을 하나 띄운다.
3. 디자인 화면에서 **속성변경 / OBJID변경 / undo·redo / 삭제 / 이동 / 붙여넣기 / 삽입** 수행.
4. 그 순간 **자식창(미리보기)이 잠깐 busy(잠금)** 되는지 확인.
5. 코드 검증은 `node --check <파일>` 로 문법만(실동작은 위 수동 테스트). 프리뷰 하니스는 불안정하니 사용 금지.
