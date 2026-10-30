# 「UI5 미리 정의된 CSS」의 「모두 선택 취소」 — 확인창 뒤 busy 를 끄는 길 추적

- 날짜: 2026-10-30
- 지시: 장군님 「하단의 "모두 선택 취소" 버튼을 클릭하면 … 메시지 박스가 띄워지는데, 이때는 현재
  ws4.0에서 열려 있는 모든 창에 broadcast로 busy를 키고 있던 상태임. 그러나 그 메시지 박스에서
  확인 또는 취소 버튼을 누르면 그 이후 프로세스를 수행한 이후에 broadcast로 busy를 끄는 로직이 없어서,
  메시지 박스에서 취소 눌러도 메인에 켜져있던 busy가 바로 꺼지지 않은것 같음. 원본 비교해서
  처리로직에 대한 조사를 해줘」
- **코드는 한 줄도 안 고쳤다.** 조사만 했다.

## 결론 — 끄는 로직은 **있다.** 원본과 **글자 하나 다르지 않다**

| 확인한 것 | 결과 |
|---|---|
| 취소를 눌렀을 때 끄는 코드 | **있다** — `setBusy(false)` (`control.js:1281`) |
| 확인을 눌렀을 때 끄는 코드 | **있다** — `setUnselectItemsAll()` 끝의 `setBusy(false)` (`control.js:1339`) |
| 그 `setBusy` 가 방송을 보내나 | **보낸다** — `broadToChild.postMessage({PRCCD:"BUSY_OFF"})` |
| 메인 WS20 이 그 방송을 받나 | **받는다** — `js/broadcast/ws_fn_broad.js:9` 가 같은 채널을 연다 |
| 원본(WS3.0.0)과 다른가 | **`setBusy` 함수는 diff 0.** `onUnselectAll`·`setUnselectItemsAll` 도 같다 |

## 흐름 — 버튼을 누른 뒤 무슨 일이 일어나나

`main/views/control.js` `oContr.fn.onUnselectAll` (1251행):

| 순서 | 코드 | 이 팝업 | 메인 WS20 · 형제창 |
|:---:|---|:---:|---|
| ① | `setBusy(true)` | on | **BUSY_ON 방송** |
| ② | `setBusy(false, { ISBROAD:true })` | **off** | 방송 안 함 → **켜진 채로 둔다** |
| ③ 확인창 닫힘 | `setBusy(true)` | on | BUSY_ON 방송 |
| ④-취소 | `setBusy(false)` | off | **BUSY_OFF 방송** |
| ④-확인 | `setUnselectItemsAll()` → 끝에 `setBusy(false)` | off | **BUSY_OFF 방송** |

②의 원본 주석이 「비지를 나만 끈다」다. **의도된 설계** — 확인창은 이 팝업 안에 뜨므로
이 창의 busy 만 풀어 버튼을 누를 수 있게 하고, **다른 창은 켜 둔 채로** 기다리게 한다.

`setBusy` 의 `ISBROAD` 옵션이 하는 일(`control.js:558`):

```js
if(typeof _ISBROAD === "undefined"){
    oParentAPP.broadToChild.postMessage({PRCCD:"BUSY_ON"});   // 또는 BUSY_OFF
}
```

→ **`ISBROAD` 를 주면 방송을 건너뛴다.** 주면 이 창만, 안 주면 모든 창.

## 주석 처리된 「메인 영역 Busy 끄기」 — 원본에도 주석이었다

`setUnselectItemsAll` 안에 두 곳이 주석으로 막혀 있다:

```js
// // 메인 영역 Busy 끄기
// parent.IPCRENDERER.send(`if-send-action-${...BROWSKEY}`, { ACTCD: "SETBUSYLOCK", ISBUSY: "" });
```

**원본(`U4A_WS3.0.0/.../main/views/control.js`)에도 똑같이 주석으로 있다.** 변환하며 막은 것이 아니다.
막혀 있어도 되는 까닭은 위 표대로 **`setBusy(false)` 의 방송이 같은 일을 하기 때문**이다
(방송 → `ws_fn_broad.js` → `parent.setBusy("")`).

## 원본과 다른 곳 — 딱 한 줄

| | 원본 | WS4.0 |
|---|---|---|
| 「지울 대상이 없을 때」 분기 | `setBusy(false)` 후 **아무 말 없이 return** | `setBusy(false)` 후 **경고창 1개 추가**(`M989`) |

주석에 까닭이 적혀 있다 — 「해제 확인 OK 후 대상이 없어 아무것도 안 하면 무반응 → 안내(2026-07-23)」.
busy 와는 무관하다.

## 끄기가 **즉시가 아니다** — 0.3초 기다린다

메인 WS20 이 `BUSY_OFF` 를 받으면 `parent.setBusy("")` → 전역 `setBusy`(`ws30/resources/index.js:1733`):

```js
// 걸리는 시간 = 조용함을 보는 창(theme/u4a-busy.js QUIET_WINDOW_MS) × 2 — 지금 0.3초.
setDomBusy("", function () { ... });
```

**끄라고 해도 0.3초를 기다린 뒤 꺼진다.** 이것은 2026-10-21 에 일부러 넣은 것이고
(그 전에는 같은 기다림을 두 번 타서 1.2초였다), 켜기 쪽에는 반대로
`U4ABusy.show()` 가 **「기다리던 끄기」를 버리는 장치**(세대 번호)가 있다.

★**「③의 켜기가 ④의 끄기를 버릴 수 있다」는 제 첫 판정은 틀렸다**(2026-10-30 정정).
`hide()` 본문을 안 읽고 주석만 보고 말했다. 끄기를 버리는 것은 **기다리는 중에 켜기가 올 때**뿐인데,
이 흐름은 켜기(①) → 켜기(③) → 끄기(④) 순서라 **버려질 끄기가 없다.**

### 그래서 진짜 의심 자리는 따로 있다 — 「화면이 계속 바뀜」

`theme/u4a-busy.js` `hide()` 의 판정(`_checkQuiet`, 460~512행):

1. 끄라는 신호 → 150ms 뒤에 화면이 바뀜는지 본다
2. **바띀으면 150ms 더 기다린다 — 바뀌는 동안 계속 되풀이한다(횟수 제한 없음)**
3. 조용해지면 `requestIdleCallback` 을 건다
4. 거기 도착하면 150ms 더 기다린 뒤 끔다(이때 변경은 안 본다)

→ **2번에서 계속 맴돌 수 있다.** WS20 메인 창은 미리보기가 있어 변경이 짆다.
5초를 넘기면 콘솔에 **한 번** 찍힌다(그래도 끄지 않는다 — 2026-10-22 장군님 결정):

```
[UBSY-005] BUSY_STILL_ON: DOM still changing after 5000ms - busy stays on until it settles (on purpose)
```

**그래서 확인할 것 = 재현했을 때 이 글자가 콘솔에 찍히는가.** 찍히면 원인이 확정된다.

## 그래서 아직 판정하지 못한 것

- **실제로 안 꺼지는지 확인하지 않았다.** 앱을 돌려 보지 않았고, 돌리는 것은 장군님이 하신다.
  코드만 보면 취소·확인 양쪽 다 끄는 길이 있다.
- 확인한다면 봐야 할 것: ③의 `BUSY_ON` 과 ④의 `BUSY_OFF` 가 **0.3초 안에 연달아** 들어올 때
  `U4ABusy` 의 세대 번호가 ④를 버리지 않는지. `theme/u4a-busy.js` 의 `QUIET_WINDOW_MS` 부근.
- ★이 조사 중 `theme/u4a-busy.js`·`u4a-busy.css` 가 **다른 창에서 수정 중**이었다(작업 트리에 변경).
  그쪽 작업이 이 구간을 건드리면 결과가 달라진다.

## 또 밟을 함정

- **`setBusy(false)` 를 봤다고 「전체가 꺼진다」가 아니다.** 두 번째 인자 `{ISBROAD:true}` 가 붙으면
  **이 창만** 꺼지고 방송을 안 한다. 인자까지 읽어야 한다.
- **주석 처리된 코드를 보고 「변환하다 빠뜨렸다」고 단정하지 말 것.** 원본부터 보면
  원본에도 주석인 경우가 있다(이번 건이 그랬다).
- **busy 가 「안 꺼진다」는 눈으로 판정할 수 없다.** 끄기에 0.3초 기다림이 있고 켜기에는
  기다리던 끄기를 버리는 장치가 있어, 짧은 구간에서는 눈과 실제가 어긋난다. 로그 순서로 본다.
