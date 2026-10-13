# UI 개인화 팝업 — busy 가 안 보이던 것 + 느린 원인

- 날짜 **2026-10-13** · 세션 `abc286a4` · type `fix`
- 장군님 지시: 「데이터 양이 많아서 느린 거까진 알겠는데, 최소한 busy 라도 걸어줘야
  사용자가 무거운 작업을 하는구나 느낄 거 아니냐」 + 「setTimeout 0 으로 한 번 비동기로
  강제로 돌린 이후에 무거운 로직을 넣는 수법을 쓴다. 이걸 공통 async/await 방식으로」
- 진행 문서 = `.works/별창팝업/08_UI개인화_느림_검수.md` (테스트 ☐ 2 대기)

## 느린 진짜 원인 (코드 아님 — 자료)

`%APPDATA%\com.u4a_ws3.app.dev\p13n\U4A_UI_PATTERN\UHA\header.json` = **1.77 MB** (5건).
그중 **1건의 Description 이 866,250 글자**(채팅 글이 붙여넣어진 채 저장됨).
같은 5건의 운영 profile 파일은 1,180 바이트 — 1,500배.

목록 칸은 `white-space: nowrap` + 말줄임(`shell.css` `.u4a-table tbody td`)이라
브라우저가 **866,250 글자를 한 줄로 전부 재서** 말줄임 위치를 구한다. 그 줄의 tooltip 에도 같은 글이 들어간다.
→ `lf_renderList()` 가 도는 모든 자리에서 이 비용이 다시 난다.

**개인화는 사용자 영역이라 자료를 건드리지 않는다**(장군님 판단). 길이 제한도 원본에 없어 넣지 않았다.

## busy 가 아예 안 보였던 까닭

`setBusy("X")` → 무거운 동기 로직 → `setBusy("")` 가 **한 호흡(task) 안에서** 끝나면
브라우저는 중간에 한 번도 paint 하지 않는다. 「짧아서 안 보임」이 아니라 「그려질 기회가 없음」.

## 고친 것

| 자리 | 무엇 |
|---|---|
| `js/ws_html5_shell.js` | 공통 `oAPP.common.fnYieldToPaint()` 신규 — Promise 를 돌려주므로 `await` 로 쓴다 |
| `js/ws_html5_ws20_tree.js` (UI 개인화 목록 버튼) | busy ON → `await fnYieldToPaint()` → 무거운 로직. loadJs 실패 분기에 busy OFF 추가(없어서 영영 잠길 수 있었다) |
| `js/fnP13nDesignPopupOpen.js` (목록 줄 click) | busy ON → `await fnYieldToPaint()` → `lf_rowSelect` |

### 왜 `setTimeout(0)` 만 쓰지 않았나 (장군님 예시와 다른 점 — 보고)

`setTimeout(0)` 의 timer task 는 **paint 보다 먼저 실행될 수 있다**(rendering opportunity 전에 task 가 돌면).
그래서 `requestAnimationFrame` 콜백(= paint 직전) **안에서** `setTimeout(0)` 을 걸었다 →
그 frame 이 실제로 그려진 뒤에 이어진다. 장군님 수법의 의도를 그대로 유지하면서 보장만 더했다.
`requestAnimationFrame` 이 없으면 `setTimeout(0)` 단독으로 degrade.

### `lf_rowSelect` 를 async 로 바꾸지 않은 까닭

`lf_saveP13nData` / `lf_refresh` / `lf_back` 이 `lf_setHeadLineSelect` → `lf_rowSelect` 를 부른 **뒤**
busy 를 끄거나 메시지를 띄운다. `lf_rowSelect` 를 async 로 만들면 그 순서가 깨져(busy 가 먼저 꺼짐)
무거운 구간이 busy 없이 돌게 된다. → **click 핸들러만 async** 로 했다.

## 같이 찾은 결함 3개 — 안 고쳤다 (TODO 47)

원본(UI5) `U4A_WS_DESIGN/design/js/callP13nDesignDataPopup.js` 와 대조한 결과:

| 결함 | HTML5 (지금) | 원본(UI5) |
|---|---|---|
| 줄 선택 시 목록 전체 재생성 | `lf_rowSelect` 가 `lf_renderList()` 호출 | `highlight` 속성만 바꿨다(`lf_rowSelectionChange` 2124행) |
| 재생성마다 줄마다 메시지 2건 재조회 | `_cl("B38")`·`_cl("A03")` → `REMOTE.getGlobal('WsMsgCls').getRow` = @electron/remote 동기 IPC + SQLite, 줄수×2 | 0건 |
| 갱신·뒤로가기는 목록을 2번 그린다 | `lf_setModelData("R")` + `lf_setHeadLineSelect`→`lf_rowSelect` | 1번 |

`lf_setPrevExtIcon` 이 미리보기 주입마다 icon font·illustration set 을 다시 등록하는 것은
**원본도 동일**(`lf_setP13nPrevHTML` 738행) → 손대지 않았다.

## 아직 안 한 것

- 같은 busy 를 걸 나머지 4곳: 연필(편집)·갱신·뒤로가기·저장 → 지시 대기(TODO 46)
- 별창(Popups)은 각자 `oAPP` 이라 `fnYieldToPaint` 가 없다. 필요해지면 그 창 공통에 같은 함수를 둔다.
- `node --check` 3개 통과. **실행 검증은 안 했다**(앱 실행은 장군님이 직접).


---

## 이어서 2026-10-13 — 줄 선택 느림을 원본 기준으로 고침 (장군님 지시)

장군님 캡처: tree 에 BUTTON 4개뿐인 **내용 거의 없는 줄**을 눌러도 busy 가 한참 돌았다.
→ **자료 크기 탓이 아니라 내 로직 탓.** 줄을 고를 때 `lf_rowSelect` 가 `lf_renderList()` 로
**목록 전체를 다시 그려서**, 어느 줄을 눌러도 맨 아래 866,250 글자짜리 줄이 매번 같이 다시 만들어졌다.
장군님: 「당연히 … 로직 또 좃같이 짰구만.. 원본 기준으로 고쳐라」

### 고친 내용 (`js/fnP13nDesignPopupOpen.js`)

| 무엇 | 전 | 후(원본 기준) |
|---|---|---|
| 줄 선택 | `lf_renderList()` 로 전체 재생성 | `lf_markSelectedRow()` — `aria-selected` 만 옮긴다. 원본 `lf_resetMarkLine` + `oModel.setProperty("highlight","Information",ctx)` 와 1:1 |
| 선택 해제 경로 | 같음 | 같은 함수로 |
| 편집·삭제 tooltip | 줄마다 메시지 DB 조회(줄수×2, @electron/remote 동기 IPC + SQLite) | 루프 밖에서 **1회** |
| 갱신·뒤로가기 | 목록 2번 그림 | **1번**(위 변경의 결과 — 따로 손대지 않았다) |

`lf_renderList()` 호출은 이제 **`lf_setModelData("R")` 한 곳뿐**이다(열기·갱신·저장·삭제 = 목록 내용이 바뀔 때만).

### 버린 가설 (틀렸던 판정 — 기록으로 남긴다)

1. **「busy 카드의 0.22초 등장 애니메이션 때문에 안 보인다」** — 틀렸다. 0.22초는 사람이 못 느낀다.
   장군님 지적으로 정정. 내가 틀린 까닭: 크래시(창 죽음)가 **먼저 일어난 사건**이라는 것을 고려하지
   않고 CSS 만 보고 판정했다. 창이 죽으면 그 창은 아무것도 못 그리니 busy 가 안 보이는 것은 **결과**다.
2. **「긴 설명 1건이 있는 줄만 느릴 것」** — 틀렸다. 전체 재생성이라 **모든 줄이 똑같이 느렸다.**
3. rAF 호출 순서 의심(장군님) — 순서는 맞았다(busy 켜기 → rAF → 무거운 로직). 소스로 확인.

### 아직 못 푼 것

- **크래시 원인 미확정.** 오늘 로그 파일이 안 생겼고 stack 을 못 받았다.
  줄 선택이 가벼워졌으니 다시 나는지부터 본다.
- 연필(편집)·갱신·뒤로가기·저장 버튼의 busy 양보 — 지시 대기.
- **실행 검증 안 함**(앱 실행은 장군님이 직접). `node --check` 통과.
