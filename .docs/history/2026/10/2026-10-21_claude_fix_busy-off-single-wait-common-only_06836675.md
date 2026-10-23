# busy 끄기 기다림이 두 번 돌던 것을 하나로 — 1.2초 → 0.6초

- 작성 2026-10-21 · 세션 06836675 · type=fix
- 지시: 장군님 「setBusy("") 시 총 0.6 초만 걸려야되」
  → 「공통 함수만 쓸거면 공통 함수만 쓰던가 시발 혼재되어 있짢아」
  → 「parent.setBusy 이 함수를 고칠때 이번에 만든 공통 busy 함수만 호출 하는 로직 1개만 있으면 되는거 아니야??」
- 되돌릴 지점 = 커밋 `abdf59d6`

## 1. 무엇이 문제였나 (소스 확정)

공통 busy 창을 여닫는 길이 **두 갈래**였다.

| 길 | 어디 |
|---|---|
| ① 전역 `setBusy` | `resources/index.js` — 끄기 전에 0.6초 기다림(`_u4aBusyOffWhenSettled`) |
| ② 더미 busy 객체 | `ws_html5_shell.js` `fnCreateDummyBusy` 의 `open()`·`close()` → `parent.setDomBusy` → `U4ABusy` |

`parent.setBusy("")` 한 번에 ① 이 0.6초 기다린 뒤 끄기를 실행하고, 그 끄기가 ② 로 내려가
`U4ABusy.hide()` 에서 **또 0.6초**를 기다렸다. 합계 **1.2초**. WS20 은 `parent.setBusy("")` 만
62곳 쓰므로 WS20 전체가 이 경로였다.

게다가 끄기 한 번에 `close()` 가 두 곳(`setBusyDialog` · `utill.fn.setBusy`)에서 불려
`U4ABusy.hide()` 가 **두 번** 돌았다(기다림 3개 · MutationObserver 3개 동시).

## 2. 고친 내용

| # | 파일 | 무엇 |
|---|---|---|
| 1 | `theme/u4a-busy.js` | `hide(fnDone)` — 창이 **실제로 닫힌 뒤** `fnDone` 을 부른다. 기다리는 중 `show()` 가 와서 끄기를 버린 경우에는 부르지 않는다 |
| 2 | `resources/index.js` | `setDomBusy(bIsBusy, fnDone)` — `fnDone` 을 `U4ABusy.hide` 로 넘긴다. `U4ABusy` 가 없는 창에서도 뒷정리는 해 준다 |
| 3 | `resources/index.js` 전역 `setBusy("")` | `_u4aBusyOffWhenSettled` 대신 **`setDomBusy("", 콜백)` 하나**. 콜백에서 `setBusyDialog("")`·`utill.fn.setBusy("")` |
| 4 | `resources/index.js` 전역 `setBusy("X")` | 부수 작업(안쪽 함수) → 그 **뒤에** `setDomBusy("X")`. 공통 busy 를 부르는 자리를 한 곳으로 |
| 5 | `resources/index.js` 621·628 (`onNewWindow`) | `oWS.utill.fn.setBusy` 직접 호출 → **전역 `setBusy`** 로 |
| 6 | `resources/index.js` | `_u4aBusyOffWhenSettled`·`_u4aBusyWatchStart/End`·`_u4aIsBusySelf`·`_u4aCountOutside`·`_u4aObserveBody`·`_u4aIsDev`·상한/창 상수·`__u4aBusyGen` **전부 삭제**(317줄). 같은 것이 공통 busy 에 있다. `BUSY_DOM_ID` 는 `getBusy()` 가 쓰므로 남겼다 |
| 7 | `ws_html5_shell.js` 더미 busy | `open()`·`close()` 안의 `parent.setDomBusy` **두 줄 삭제**. 이제 busy 카드의 제목·문구와 열림 여부만 들고 있는다 |
| 8 | `ws_html5_ws20_attr.js` 3168 | 주석이 가리키던 자리를 지워진 함수 → `theme/u4a-busy.js U4ABusy.hide` 로 고침 |

## 3. ★왜 `setDomBusy("X")` 가 안쪽 함수 **뒤에** 와야 하나 (함정)

- `oWS.utill.fn.setBusy` 는 「이미 켜져 있으면 그만둔다」로 시작하고, 그 판단을 **`getBusy()`
  (= busy 창이 떠 있나)** 로 한다(2026-10-21 앞 작업에서 전역 변수를 없애고 DOM 기준으로 바꿨다).
- 그래서 **공통 busy 창을 먼저 띄우면** 그 판단에 걸려 부수 작업(마우스 막기 · 포커스 저장 ·
  창 닫기 버튼 비활성 · 작업표시줄 진행바)을 **전부 건너뛴다.** 첫 켜기부터 깨진다.
- 반대로 `setDomBusy("X")` 를 빼면 안 된다 — **기다리던 끄기를 버리는 것(세대 번호)** 이
  `U4ABusy.show()` 안에 있다. 안쪽 함수가 그만뒀을 때 이 줄까지 안 타면, 0.6초 기다리던 끄기가
  **방금 켠 busy 를 꺼 버린다.**
- 그래서 순서는 **안쪽 함수 → `setDomBusy("X")`** 로 고정이다. 한 묶음(동기) 안이라 화면 차이는 없다.

## 4. 영향 범위 (전수 조사)

- `oWS.utill.fn.setBusy` / `setBusyDialog` 를 부르는 곳 = **전역 `setBusy` 안 뿐**(repo 전체 grep).
  621·628 을 전역으로 바꿔서 그렇게 됐다.
- `oWS.utill.attr.oBusy` 를 쓰는 곳 = `index.js` 985·1087 과 `ws_main.js:1106` 대입뿐.
  더미의 `open()`·`close()` 를 밖에서 직접 부르는 곳은 없다.
- `parent.setDomBusy` 를 **직접** 부르는 곳(`Login.js` 약 40 · `ws_main.js` 3 ·
  `library-preload.js` · `ws10_20/index.js` · `views/vw_main/control.js`)은 **종전 그대로** 0.6초 한 번이다.
  이번 수정과 무관하고 건드리지 않았다.
- 끄기를 연달아 두 번 불러도 안전하다 — 두 번째 `hide` 는 창이 이미 닫혀 뒷정리만 한 번 더 한다
  (마우스·포커스·닫기 버튼·진행바 모두 같은 값을 다시 넣는 것이라 결과가 같다).

## 5. 아직 안 본 것 · 또 밟을 함정

- **앱에서 확인하지 않았다**(장군님이 직접 돌리신다). `node --check` 네 파일 통과만 했다.
  busy 는 TODO 에 테스트 항목으로 올리지 않는다(장군님 지시 2026-10-20 — 전용 도구로 보신다).
- **끄기 신호가 와도 busy 가 꺼져 있던 경우에도 0.6초를 기다린 뒤 뒷정리가 돈다.**
  `U4ABusy.hide` 는 창이 닫혀 있어도 기다림을 돌기 때문이다. 종전에도 그랬다(고치지 않았다).
- **버린 방법**: 「전역 `setBusy` 에서 `setDomBusy("X")` 를 먼저 부르고 안쪽 함수를 뒤에」 —
  3절의 이유로 부수 작업이 전부 죽는다. 버렸다.
- **버린 방법 2**: 「더미 busy 의 `open()` 은 남기고 `close()` 만 뺀다」 — 켜기/끄기가 서로 다른
  길을 타게 돼 나중에 또 헷갈린다. 둘 다 뺐다.
- **미리보기 iframe 안은 여전히 못 본다.** 공통 busy 의 MutationObserver 는 그 창의
  `document.body` 하나만 관찰하고, 미리보기는 별도 document 다.
