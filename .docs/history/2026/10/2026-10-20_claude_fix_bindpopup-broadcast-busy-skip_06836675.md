# UI 추가 때 busy 가 중간에 한 번 더 켜졌다 꺼지는 건 — 바인딩 팝업 방송이 원인

- 작성: 2026-10-20 · claude · fix
- 지시: 장군님 「UI 추가 팝업에서 어그리게이션 선택 → UI 추가할때 왜 중간에 busy가 한번 켜졌다가 꺼지는지 확인해」
  → 「공통 busy를 고칠게 아니고 호출처를 바꿔야지 않겠냐?」 → 「지금 공통 busy는 건들면 안되는거야」
  → 「반드시 호출처 영향도 먼저 깊게 조사부터 진행해」 → 「고쳐라」

## 무엇이 보였나

콘솔에서 `setBusy` 가 `"X" → "" → "X" → ""` 로 **두 쌍** 돌았다. `[zconsole] setBusy` 줄의 `callee` 를
펼쳐 호출 사슬을 확정했다(장군님이 펼쳐 주심).

| 쌍 | 누가 | 어디 |
|---|---|---|
| 1 | `fnWs20SelectUI`(추가된 UI 선택) | `js/ws_html5_ws20_attr.js:3614` ON / `:3663` OFF |
| 2 | `updateBindPopupDesignData`(바인딩 팝업 반영) | `design/bindPopupHandler/broadcastChannelBindPopup.js:612` ON / `:628` OFF |

사슬: `lf_confirm`(edit.js:2377) → `designAddUIObject`(edit.js:1739·1747·1752) →
`_selectNode`(edit.js:87) → `setSelectTreeItem`(prev.js:800) → `fnWs20SelectUI`(attr.js:3647→3663) /
`updateBindPopupDesignData`(dnd.js:803) → 방송모듈(612).

원본(UI5)도 같은 구조다 — 장군님이 WS3.0 을 돌려 확인: `designAddUIObject @ uiDesignArea.js:5764` →
`setSelectTreeItem @ uiDesignArea.js:2342`, 그리고 팝업 닫기 `lf_setGuideBusy @ index.js:1725`.
**UI 하나 추가에 busy 가 3번 껐다 켜진다.**

## 왜 1번 쌍은 못 없애나 (내가 틀렸다가 정정한 것)

처음에 「UI 추가 전체를 하나의 busy 로 감싸자」고 했다가 **철회**했다.
`js/ws_html5_ws20_tree.js:914~920` 에 CDP 실측 기록이 있다:

> 이식본이 `bSkipBusy` 로 안쪽 해제를 막아, **잠금이 걸린 채 미리보기 선택이 실행돼 선택 UI 로의
> 포커스 이동이 무시되고 → 화면 밖 UI 를 골라도 미리보기가 스크롤되지 않았다**
> (잠금 켜짐=스크롤 0·테두리 없음 / 꺼짐=정상 이동·테두리 표시).

원본도 「해제(2549~2557) → `selPreviewUI`(2565)」 순서다. **`selPreviewUI` 는 busy 가 꺼진 상태에서
돌아야 한다.** 그래서 감싸면 그 사고가 재발한다. 그 기록을 안 보고 제안했다가 정정했다.

## 영향도 조사 (고치기 전, 장군님 지시로 전수)

| 확인 | 결과 |
|---|---|
| `oAPP.fn.updateBindPopupDesignData` 정의 | **3곳** — `design/js/uiDesignArea.js:1283`(WS4.0 미로드) · `js/ws_html5_ws20_dnd.js:800`(실제 도는 것) · `Popups/bindPopup/wsDesignHandler/bindBroadcast.js:79`(별창 안, 무관) |
| 호출처 43곳 | 내 파일 24곳 + 지연 로드되는 사본 2개(`design/js/callDesignContextMenu.js` 2 · `design/undoRedo/undoRedo.js` 9 … 총 19) — **이 함수의 해제에 기대는 곳 0** |
| 자식창 `BUSY_ON` 방송 | 직접 3곳(attr 3617 / edit 733 / tree 909) + 헬퍼 `_broadBusy`·`_bindBusy`·`_broadChildBusy` — **전부 자기 짝 OFF 를 맞춘다** |
| 팝업이 **열려** 있을 때 | 이 함수는 busy 를 **안 끈다**(끝에 `sendPostMessage` 만). 팝업 응답 수신부(같은 파일 366~376)가 끈다 → 열린 경로는 안 건드림 |
| 안 열렸을 때 순효과 | `setBusy` ON/OFF 상쇄 + 단축키 잠금 ON/OFF 상쇄 + **자식창 `BUSY_OFF` 방송 1회**(위에 따라 덤) |

`design/js/uiDesignArea.js` 는 WS4.0 에서 로드되지 않는다(`js/ws_html5_ws20.js:879` 「getScript 호출 안 함」,
`js/ws_html5_ws20_prev.js:71` 「부팅에 추가하지 않는다」). `design/testFolder/` 도 로드 안 됨.

## 고친 것

`js/ws_html5_ws20_dnd.js:800` 한 곳. `IS-CHANNEL-CREATE`(방송모듈 `module.exports` 917~919, `true/false`
반환)로 물어 **채널이 없으면 `UPDATE-DESIGN-DATA` 를 안 보내고 돌아간다.** 27줄 추가 · 1줄 삭제,
`node --check` 통과. 공통 busy 도 원본 모듈도 안 건드렸다.

로그는 `U4ALOG.warn("GUARD_EXIT", …)` 를 **한 번만** 남긴다(`oAPP.attr.__ws20BindBroadSkipLogged`) —
UI 편집마다 불리는 자리라 매번 남기면 로그가 폭증한다(로그 양 규칙).

## ★ 또 밟을 함정

1. **`fnWs20SelectUI` 의 busy 해제를 막지 마라**(`bSkipBusy` 로도, 바깥 감싸기로도). 미리보기 선택
   포커스 이동이 무시돼 화면 밖 UI 를 골라도 미리보기가 안 움직인다. 원본도 「해제 → 선택표시」 순서다.
2. **`updateBindPopupDesignData` 는 정의가 3곳**이다. 내 파일 것은 `if (typeof … !== "function")` 가드
   안에 있어 **사본이 먼저 로드되면 안 쓰인다.** 지금은 사본이 로드 안 돼 내 것이 돌지만, 로드 구성이
   바뀌면 이 수정이 조용히 무력화된다 — 그때는 `callee` 로 어느 정의가 도는지부터 확인할 것.
3. **`[zconsole] setBusy` 줄의 `callee` 를 펼치면 호출 사슬이 그대로 나온다.** busy 가 어디서 켜지는지
   소스만으로 못 찾을 때 이게 제일 빠르다(이번에도 그걸로 확정했다).

## 미검증

- **앱으로 테스트 안 했다**(장군님이 직접 돌리신다). 확인할 것: UI 추가 팝업에서 UI 를 추가했을 때
  콘솔의 `setBusy` 가 **두 쌍 → 한 쌍**으로 줄었는지. 바인딩 팝업을 **열어 둔 채** 추가하면 팝업 트리에
  그대로 반영되는지(그 경로는 안 건드렸지만 확인 필요).
