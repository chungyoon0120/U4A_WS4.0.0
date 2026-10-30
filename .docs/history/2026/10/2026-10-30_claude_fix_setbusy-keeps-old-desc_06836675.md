# setBusy("X") 를 인자 없이 켜면 앞서 넣은 DESC 가 그대로 남던 것

- 날짜 : 2026-10-30
- 지시 : 장군님 「setBusy 다시 setBusy("X") 이렇게만 하면 파라미터 안던진거잖아? 그러면 메시지도 날라가게 해줘」
- 파일 : `www/ws30/resources/index.js`

## 증상

```js
setBusy("X", { DESC: "저장중입니다" });   // 카드에 글이 뜬다
...
setBusy("X");                             // 인자 없이 다시 켠다 → 옛 글이 그대로 남아 있다
```

## 원인 (소스로 확인)

전역 `setBusy` 의 켜기 분기:

```js
if (typeof oOptions === "object") {
    oWS.utill.fn.setBusyDialog(bIsBusy, oOptions);   // 여기선 TITLE/DESC 를 다시 써서 덮는다
} else {
    oWS.utill.fn.setBusy(bIsBusy);                   // ← 문제는 이 길
}
```

`oWS.utill.fn.setBusy` 는 **맨 위가 「이미 켜져 있으면 그만둔다」**(`getBusy() === "X"` → `return`)다.
글 비우기(`oBusy.setTitle("")` · `setText("")`)는 그 **아래**에 있어서 통째로 건너뛴다.
그래서 이미 busy 가 떠 있는 상태에서 인자 없이 다시 켜면 **옛 글이 남는다**.

그 early return 자체는 옳다 — 주석대로 마우스 막기·포커스·닫기 버튼·진행바는 이미 걸려 있다.
**빠진 것은 글 비우기뿐**이다.

## 고친 것 — 한 파일, 세 자리

| 자리 | 무엇 |
|---|---|
| `oWS.utill.fn.clearBusyText` **신규** | busy 카드의 제목·문구를 비우는 공통 함수(더미 busy 객체 `oWS.utill.attr.oBusy` 를 쓴다) |
| `oWS.utill.fn.setBusy` 안 | 같은 일을 하던 두 줄을 그 공통 함수 호출로 바꿨다(복붙 금지) |
| 전역 `setBusy` 의 else 가지 | `oWS.utill.fn.setBusy(bIsBusy)` **앞에서** `clearBusyText()` 를 먼저 부른다 |

## 영향도

- `oWS.utill.fn.setBusy` 를 부르는 곳 = 전역 `setBusy` 안 **2곳뿐**(`www` 전수).
- `setBusy("X", { … })`(object) 길은 **한 줄도 안 바뀌었다** — 종전대로 `setBusyDialog` 가 글을 덮는다.
- 끄기(`setBusy("")`)도 안 바뀌었다 — `setBusyDialog("")` 가 이미 비운다.
- `clearBusyText` 는 여러 번 불러도 같은 결과다(멱등).

## 확인한 것 / 못 한 것

| | |
|---|---|
| ✅ 문법 | `node --check` 통과 |
| ✅ 호출처 전수 | 위 영향도 표 |
| ❌ 앱에서 눈으로 재현 | **일부러 재현하기 어렵다.** DESC 를 넣어 켜는 자리는 실질 2곳 — ① `ws_common.js` 의 **서버 호출이 오래 걸릴 때** 뜨는 안내 글(타이머) ② `ws_fn_05.js` 의 AI 설치 확인(그 버튼은 `ws10_html.js` 에서 **숨김** 처리돼 있다). ①은 서버가 느려야 뜬다 |

## 또 밟을 함정

- **「이미 켜져 있으면 그만둔다」로 시작하는 함수에 뒤늦게 일을 더하지 말 것.** 그 일은 early return
  위로 올리거나 **부르는 쪽에서** 해야 한다. 여기서는 글 비우기가 return 아래에 있어 조용히 건너뛰었다.
- busy 카드의 제목·문구 자리(`#u4aWsBusyTitle` · `#u4aWsBusyText`)는 **공용**이다. 켤 때 비우지 않으면
  **앞 작업의 글이 다음 작업에 보인다.**
