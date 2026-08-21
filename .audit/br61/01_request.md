# BR61 검수 요청서 — Design Tree 붙여넣기 불가 대상에서 안내 메시지 누락 및 오표시

> 노션 이슈 BR61 (화면=WS20 Design, 분류=UX, 작성자=PES)
> 현상 ① `sap.ui.table.Column` → `sap.m.Page` 붙여넣기: UI 생성 안 됨 + **안내 메시지 전혀 없음**
> 현상 ② `sap.m.Label` → 다른 `sap.m.Label` 붙여넣기: UI 생성 안 됨 + **붙여넣기와 무관한 "Drop the File" 메시지 표시**
> 기대: WS3.0 처럼 거부 사유를 안내("이동 가능한 aggregation이 존재하지 않습니다." / "붙여넣을 수 있는 aggregation이 없습니다.")

---

## 검수 대상 (내 파일 = 원본 폴더 밖)

- `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js`
  - `oAPP.fn.fnWs20AddTreeData` (1008~) — 붙여넣기/패턴 드롭 공통 코어
    - **1027~1031** : 후보 aggregation 없음(`param === undefined`) 분기의 **메시지 클래스 정정**
    - **1056~1070** : `aggrSelectPopup` 의 **취소 콜백에서 사유 안내 복원**(원본 호출측 동작 이식)
  - `oAPP.fn.chkAggrRelation` (420~) — **427·455** 안내 문구 조회 실패를 조용히 삼키던 `catch {}` 2곳 표면화

- 백업(되돌리기용): `www/ws30/ws10_20/js/_ws_html5_ws20_dnd.js.br61bak`

> ★선행 검수 T01 과 **같은 파일**을 만진다. T01(=`chkAggrRelation` 구조체 반환판 이식)은 아직 검수 중이며,
> BR61 은 그 위에 얹힌 수정이다. T01 이 없으면 BR61 ①의 사유 문구(`RTMSG`) 자체가 생성되지 않는다.
> **BR61 만의 순증분 = 위 3개 지점**이며, `diff _ws_html5_ws20_dnd.js.br61bak ws_html5_ws20_dnd.js` 로 그 4-hunk 만 나온다.

---

## 근본 원인 (원본 대조로 확정)

### 원인 A — 안내가 통째로 사라짐 (현상 ①)

`aggrSelectPopup`(원본 `design/js/aggrSelectPopup.js` 44~90)은 **후보 aggregation 이 0건**일 때 두 갈래로 갈린다.

- `cancelFunc` **미지정** → 자기가 직접 `parent.showMessage(sap, 10, "I", _sAggrRes.RTMSG)` (원본 79행)
- `cancelFunc` **지정** → 메시지를 띄우지 **않고** `cancelFunc({RETCD:"E", RCODE:"02", RTMSG})` 호출 후 return (원본 56~72행)
  → **안내 책임이 호출측으로 넘어간다.**

원본 붙여넣기 경로는 `cancelFunc` 를 지정하는 쪽이고, **호출측이 받은 결과를 반드시 화면에 띄운다**:

```
contextMenuUiPaste (callDesignContextMenu.js 1406~1432)
  → aggrSelectPopupOpener (design/tools/opner.js 15~57)   ← cancelFunc 로 sRes 를 resolve
  → .then(sRes) : sRes.RETCD === "E" 이면
        _KIND = 10                      // 기본 = 토스트
        if (sRes.RCODE === "02") _KIND = 20;   // 후보 자체가 없음 = 확인창(MessageBox)
        parent.showMessage(sap, _KIND, "I", sRes.RTMSG);
        setShortcutLock(false); parent.setBusy("");
```

패턴 드롭 경로(`designP13nUIData`, uiDesignArea.js 5996~6017)도 **글자 하나까지 동일한 블록**이다.

**이식본은 이 호출측 블록이 통째로 빠져 있었다.** `fnWs20AddTreeData` 가 `aggrSelectPopup` 에
`function () { _done(); }` 를 `cancelFunc` 로 넘기고 있어서, ⓐ `aggrSelectPopup` 자체 안내는 억제되고
ⓑ 받은 `sRes`(사유 문구 포함)는 **버려지고** 잠금 해제만 하고 끝났다 → **화면에 아무것도 안 뜸**.

### 원인 B — 무관한 "Drop the File" 표시 (현상 ②)

`sap.m.Label` → 형제 `sap.m.Label` 은 부모와 aggregation 이 같아 `aggrSelectPopup` 이
`retfunc(undefined, ...)` 로 되돌린다(원본 38~41행, "순서 변경" 경로). 원본은 그 뒤
`lf_aggrPopup_cb(param=undefined)`(uiDesignArea.js 6465~6481)에서

```
//269  붙여넣기가 가능한 aggregation이 존재하지 않습니다.
parent.showMessage(sap, 10, "I", oAPP.common.fnGetMsgClsText("/U4A/MSG_WS", "269", ...));
```

를 띄운다. **이식본은 같은 번호를 다른 메시지 묶음에서 꺼냈다** — `_wsc("269")`(=`ZMSG_WS_COMMON_001` 269).

로컬 메시지 DB 실조회 결과(번호는 같고 문구가 전혀 다름):

| 묶음 | 번호 | 문구(KO) |
|---|---|---|
| `/U4A/MSG_WS` | 269 | 붙여넣을 수 있는 aggregation이 없습니다. |
| `ZMSG_WS_COMMON_001` | 269 | 파일을 여기에 놓아주세요 ← **오표시된 것** |
| `/U4A/MSG_WS` | 262 | 이동 가능한 aggregation이 존재하지 않습니다. |
| `ZMSG_WS_COMMON_002` | 001 / 002 / 003 | &1 UI의 Aggregation 항목이 존재하지 않습니다. / …바인딩이 설정되어 있어 UI를 2건 이상 추가할 수 없습니다. / 추가 및 이동 가능한 Aggregation이 존재하지 않습니다. |

---

## 변경 요약 (원본 1:1)

| # | 위치 | 변경 | 원본 근거 |
|---|---|---|---|
| 1 | dnd.js 1031 | `_toast("I", _wsc("269"))` → `_toast("I", _msg("/U4A/MSG_WS", "269"))` | uiDesignArea.js 6469 (`fnGetMsgClsText("/U4A/MSG_WS","269")`) |
| 2 | dnd.js 1056~1070 | `cancelFunc` 를 `function () { _done(); }` → `function (sRes) { … }` 로 바꿔, `RETCD==="E"` 이면 `RCODE==="02"→KIND 20(확인창)`, 그 외 `KIND 10(토스트)` 로 `sRes.RTMSG` 표시 후 `_done()` | callDesignContextMenu.js 1407~1427, uiDesignArea.js 5997~6017 (두 호출측 블록 동일) |
| 3 | dnd.js 427·455 | 안내 문구 조회 `catch (e) { }` (빈 catch) → `console.error(...)` 표면화 | 프로젝트 규칙 `code.md`("오류 삼킴·조용한 catch 금지"). 원본은 try/catch 자체가 없음 |

수정 후 `node --check ws_html5_ws20_dnd.js` 통과.

---

## 영향도

- **적용 경로 = 2곳**(둘 다 `fnWs20AddTreeData` 를 공통 코어로 쓴다). 원본도 이 두 경로가 동일 블록을 갖고 있어 1:1이다.
  - 트리 우클릭 **붙여넣기**(`ws_html5_ws20_edit.js` `_pasteUI` → `oAPP.fn.fnWs20PasteUI`), 미리보기 우클릭 붙여넣기(prev.js 위임)
  - **내 패턴(UI 개인화) 끌어놓기**(`applyP13nPatternDrop`)
- **영향 없는 경로(회귀 없음)** — `aggrSelectPopup` 을 `cancelFunc` **없이** 부르는 곳은 종전 그대로
  (`aggrSelectPopup` 자체가 안내를 띄우는 원본 79행 경로): 트리 D&D `drop_cb`(866), 삽입 팝업 `lf_setChild`(929).
  `ws_html5_ws20_wizard.js`(140)는 자체 `cancelFunc` 로 이미 `RTMSG` 를 소비 중 → 무변경.
- **성공 경로 무변화**: 후보가 1건이면 자동 선택, 2건 이상이면 선택 팝업 — 종전과 동일.
- **잠금 해제**: 안내를 띄운 뒤 기존 `_done()` 를 그대로 호출하므로 단축키 잠금 해제 + 자식창 잠금 해제 짝이 유지된다
  (원본도 메시지 → `setShortcutLock(false)` → `setBusy("")` 순서). 새 잠금은 추가하지 않았다.
- **메시지 키 신규 생성 0** — 전부 이미 등록된 키(`/U4A/MSG_WS` 269, `ZMSG_WS_COMMON_002` 001/002/003) 배선만.
  메시지 DB 파일은 건드리지 않았다.
- **원본 폴더 무수정** — 수정 파일은 `js/ws_html5_ws20_dnd.js` 하나.

---

## 검수 포인트

1. **원본 1:1**: 취소 콜백에서 `RCODE "02" → 확인창(KIND 20)` / 그 외 → 토스트(KIND 10) 매핑이
   원본 두 호출측 블록(callDesignContextMenu.js 1409~1420, uiDesignArea.js 5999~6010)과 정확히 같은가.
   특히 `RETCD !== "E"` 인 경우(순서 변경 등)에 **아무 메시지도 띄우지 않는 것**이 원본과 맞는가.
2. **메시지 클래스**: 269 를 `/U4A/MSG_WS` 로 되돌린 것이 맞는가. 이 파일 안에 **같은 유형의 클래스 오지정이 더 없는지**
   (`_wsc` vs `_msg` 혼용 전수 점검). 특히 원본이 `fnGetMsgClsText("/U4A/MSG_WS", …)` 를 쓰는 자리에
   `_wsc`(=`ZMSG_WS_COMMON_001`)를 쓴 곳이 남아 있는지.
3. **잠금(busy·단축키) 대칭**: 새로 생긴 안내 분기에서도 `_done()` 가 정확히 1회만 실행되는가.
   `showMessage` 가 예외를 던져도 `_done()` 에 도달하는가(현재 try/catch 로 감쌈).
4. **확인창(KIND 20) 적정성**: HTML5 `showMessage` 의 KIND 20 = 버튼 1개 알림창(`ws30/resources/index.js` 293~).
   붙여넣기 실패 시 확인창이 뜨는 동안 잠금이 걸린 채 남지 않는가(안내 → `_done()` 순서라 문제 없다고 판단, 재확인 요망).
5. **회귀**: 후보 1건 자동선택 / 2건 이상 선택 팝업 / 선택 팝업에서 취소(ESC) / 순서 변경(같은 부모·같은 aggregation)
   4가지가 종전과 동일하게 동작하는가. 특히 **순서 변경 경로가 "붙여넣을 수 있는 aggregation이 없습니다."로 끝나는 것이
   정말 원본 동작인지** (원본 `lf_aggrPopup_cb` 는 실제로 그렇게 끝난다 — 확인 요망).
6. **T01 의존**: 현상 ①의 문구는 T01 로 들어온 `chkAggrRelation` 구조체 반환판이 실어준다.
   T01 이 검수에서 뒤집히면 BR61 ①도 함께 재검토가 필요한지 판단.

---

## 근거

- **원본(읽기 전용, WS20 디자인 영역 = `U4A_WS_DESIGN`)**
  - `design/js/aggrSelectPopup.js` 32~90 — 후보 0 시 `cancelFunc` 유무에 따른 두 갈래
  - `design/tools/opner.js` 15~57 — `aggrSelectPopupOpener`(취소 결과를 그대로 resolve)
  - `design/js/callDesignContextMenu.js` 1406~1432 — 붙여넣기 호출측 안내 블록(KIND 10/20 분기)
  - `design/js/uiDesignArea.js` 5996~6017 — 패턴 드롭 호출측 안내 블록(동일)
  - `design/js/uiDesignArea.js` 6462~6481 — `lf_aggrPopup_cb`, `param === undefined` 시 `/U4A/MSG_WS` 269
  - `design/js/uiDesignArea.js` 1596~1680 — `chkAggrRelation`(001/002/003 문구 생성)
- **메시지 DB 실조회**: `www/MSG/WS_COMMON/KO/MESSAGE_CLASS.db` (`MESSAGE_CLASS_TEXTS`) — 위 표 참조
- **HTML5 메시지 표시**: `www/ws30/resources/index.js` 159~ (`showMessage`, KIND 10=토스트 / 20=버튼1개 알림창)
- `node --check` 통과
