# 10번↔20번 화면을 빠르게 오갈 때 앞 화면이 남는 것(구글시트 15번) — 원인 분석 + 수정

- 작성 2026-10-20 · 세션 06836675 · type=analysis
- 지시: 장군님 「구글 시트 15번이 좀 이해가 안되는데, 내용 부터 파악해바」 → 「분석 벌써 다 끝나고 나한테 질문하는거냐?」
- **코드는 한 줄도 고치지 않았다**(분석만)

## 1. 시트에 적힌 내용 (내장 브라우저로 직접 확인)

출처 = 구글시트 「이미지 및 로그 - No. 15」 탭.

> ※ WS10, WS20 화면으로 **빠르게 반복적으로 이동**하면 잔상이 나는 경우가 있음

캡처 3종: ①「10PAGE」 정상 ②「20PAGE 이동중 잔상 발생」(2장) — 20번 화면 아래쪽에
10번 화면 배경(`U4A` 글자·`SAP Certified` 로고)이 그대로 깔려 있다 ③「20PAGE 진입 완료」 정상.

## 2. 원인 — 전환 마무리가 「stale」이면 나간 화면을 숨기지 않는다

`www/ws30/ws10_20/js/ws10_html.js` `fnNavTo`(866행~)

화면 전환은 ①들어올 쪽에서 `u4aWsHidden` 제거 + 들어오기 애니메이션 ②나갈 쪽에 나가기 애니메이션
③애니메이션이 끝나면(`animationend`, 폴백 400ms) **나갈 쪽에 `u4aWsHidden` 을 붙여 감춘다** 순서다.

그 마무리(`_done`)에 세대(generation) 검사가 있다. **그 사이 새 전환이 시작됐으면**:

```js
if (oAPP.attr.ui._navGen !== gen) {
    oFrom.classList.remove(sOut);   // 나가기 애니메이션 클래스만 벗기고
    oTo.classList.remove(sIn);
    return;                          // ★ u4aWsHidden 을 "안 붙인다"
}
```

CSS 는 `WS10/css/ws20.css`:
- `.u4aWsHidden { display: none !important; }` — 이걸 붙여야만 사라진다.
- `.u4aWsNavOutFwd { animation: … .26s ease both; }` — `both` 라 끝나면 `opacity:0` 이 **유지**된다.

그래서 stale 분기에서 클래스를 벗기는 순간 **투명도가 1 로 돌아오고, 감추지는 않아 화면에 그대로 남는다.**

## 3. 왜 「빠르게 오갈 때만」 나나

- 20번 화면으로 갈 때는 미리보기까지 화면잠금이 유지된다.
- 그러나 **10번 화면으로 올 때는 도착 즉시 잠금을 푼다**
  (`js/ws_html5_shell.js` `fnOnMoveToPage` — `sPgNm !== "WS20"` 일 때 바로 해제).
  이때 전환 애니메이션(0.26초)은 **아직 돌고 있다.**
- 그 틈에 바로 다시 앱을 열면 새 전환이 시작되고, 앞 전환의 마무리가 stale 이 되어 위 분기를 탄다.
- 연타 가드(`oAPP.common.fnNaviLock` → `isNaviBusy`)는 **단축키만** 막는다
  (`js/ws_common.js` `fnShortCutExeAvaliableCheck`). 마우스 조작은 안 막는다.

## 4. 더 나빠지는 조건

`fnNavTo` 의 「나갈 페이지」 탐색은 **감춰지지 않은 페이지 중 마지막 하나**만 고른다.
위 사고로 감춰지지 않은 페이지가 둘이 되면, 그중 하나는 **다음 전환에서도 대상이 안 돼 계속 남는다.**

## 5. 고치는 안 (실행 안 함 — 지시 대기)

stale 분기에서도 **그 페이지가 지금 목적지가 아니면 감춘다.** 지금 목적지는 전환 시작 때 이미
`parent.setCurrPage(sToId)` 로 적어 두므로 그 값으로 가린다. 한 줄 추가로 끝난다.
새 전환의 목적지였던 경우(왕복)는 지금처럼 감추지 않아야 하므로 그 구분이 필요하다.

## 6. 또 밟을 함정

- **`animation … both` 를 쓴 클래스를 중간에 떼면 화면이 되살아난다.** 뗄 때는 감출지 여부를 같이 정해야 한다.
- 화면 전환 **애니메이션이 끝나기 전에 조작이 열린다**(10번 화면 도착 시 잠금 즉시 해제).
  전환 중 재진입을 전제로 코드를 짜야 한다.
- 연타 가드는 **단축키 전용**이다. 마우스 연타는 막지 않는다 — 「가드가 있으니 안전」이라고 넘기면 안 된다.

## 7. 아직 안 본 것

- 20번→30번, 30번→10번 등 **다른 조합**에서도 같은 일이 나는지는 보지 않았다(같은 함수를 지나므로 같을 것이나 미확인).
- **앱에서 재현하지 않았다**(장군님이 직접 돌리신다).

---

# [이어 씀 2026-10-20] 고쳤다 — 원본 UI5 와 같은 「줄 세우기」 방식

- 지시: 장군님 「sapui5에서 페이지 이동 할때 애니메이션을 참고해」 → 「css를 봐야겠지?」 → 「고쳐라」
- 고친 파일 = `www/ws30/ws10_20/js/ws10_html.js` `fnNavTo` 한 곳. CSS 는 안 고쳤다.

## 8. 원본 UI5 를 어떻게 하고 있나 (내장 브라우저로 소스·CSS 직접 확인)

`https://sapui5.hana.ondemand.com/resources/sap/m/NavContainer-dbg.js`

1. **겹침을 나중에 수습하지 않고 아예 만들지 않는다.**
```js
if (this._bNavigating) {
    Log.info("Cannot navigate to page … because another navigation is already in progress. "
           + "- navigation will be executed after the previous one");
    this._aQueue.push(jQuery.proxy(function () { this.to(vPageIdOrControl, …); }, this));
}
```
`_backTo` 에도 같은 가드. `_afterTransitionCallback` 에서 `this._bNavigating = false;` 뒤
`this._dequeueNavigation();` 로 꺼내 실행한다.

2. **끝낼 때 순서가 고정이다** — `_fadeInAnimationEnd`:
```js
oFromPage.addStyleClass("sapMNavItemHidden");                    // ★ 먼저 감춘다
oFromPage.removeStyleClass("sapMNavItemFading")
         .removeStyleClass("sapMNavItemTransparent");            // ★ 그 다음 뗀다
```

3. **CSS**(`sap/m/themes/sap_horizon/library.css`) — 감추기와 흐리기가 **별개 클래스**이고,
   흐리기는 `animation` 이 아니라 **`transition`** 이다. 그래서 클래스를 떼도 되살아나지 않는다.
```
.sapMNavItem{position:absolute;top:0;left:0;display:block;height:100%}
.sapMNavItem.sapMNavItemHidden{display:none}
.sapMNavItem.sapMNavItemTransparent{transition-property:opacity, transform;opacity:0}
.sapMNavItem.sapMNavItemOpaque{transition-property:opacity, transform;opacity:1;transform:translate3d(0,0,0)}
.sapMNavItem.sapMNavItemFading{transition-duration:.15s}
```

## 9. 실제로 고친 내용

| 무엇 | 전 | 후 |
|---|---|---|
| 전환 중에 새 전환이 오면 | 바로 시작(겹침) → 앞 전환 마무리가 stale 이 되어 나간 화면을 감추지 않음 | **`oAPP.attr.ui._navQueue` 에 줄 세움** → 앞 전환이 끝나면 꺼내 실행 |
| 세대(generation) 검사 | `_navGen` 으로 stale 판정 | **없앴다** — 겹침이 안 생기므로 죽은 코드가 된다 |
| 마무리 순서 | 감추기 → 클래스 떼기 (원래부터 UI5 와 같은 순서) | 그대로 유지(주석으로 까닭을 못 박음) |
| `animationend` | 아무 `animationend` 나 받음 | **`oEv.target !== oFrom` 이면 무시** |
| 마무리 중복 실행 | `animationend` + 400ms 폴백이 둘 다 돌 수 있었음 | `bDone` 으로 한 번만 + 폴백 `clearTimeout` |

★ `oEv.target` 검사를 넣은 까닭(추측 아님, 실측): `WS10/css/ws10.css` 의 큰 제목·설명 글자에
`animation: fadeInBlur … forwards` · `animation: fadeInUp … forwards` 가 걸려 있다. `animationend`
는 **부모로 번지므로(bubble)** 그 글자의 애니메이션이 끝나도 WS10 페이지에서 받힌다.
`breatheGlow` 는 `infinite` 라 끝나지 않으므로 해당 없다.

## 10. 버린 방법 (§5 의 안)

§5 에 적어 둔 **「stale 이어도 지금 목적지가 아니면 감춘다」** 는 안은 **쓰지 않았다.**
겹침을 그대로 두고 증상만 지우는 방식이라, 겹치는 동안 두 화면이 섞여 보이는 것은 그대로 남는다.
장군님이 「sapui5 를 참고해」 라고 하셨고, UI5 는 겹침 자체를 만들지 않으므로 그 방식으로 갔다.

## 11. 또 밟을 함정 (이어 씀)

- **줄을 세우는 로직을 넣을 때는 「줄에서 꺼내는 자리」를 모든 끝 갈래에 넣어야 한다.**
  실제로 한 번 빠뜨렸다 — 같은 페이지를 연달아 누르면 큐의 두 번째가 「나갈 페이지 없음」 갈래로
  빠지는데, 거기서 꺼내지 않으면 **그 뒤에 줄 선 전환이 영영 안 돌아 화면이 멈춘 것처럼 보인다.**
  (잡은 방법: 갈래를 하나씩 따라가며 `_navBusy` 가 풀리는 자리와 큐를 꺼내는 자리를 짝으로 맞췄다.)
- **`_navBusy` 가 true 로 남으면 화면 전환이 전부 죽는다.** 그래서 400ms 폴백(`setTimeout`)을 유지했다 —
  `prefers-reduced-motion: reduce` 에서는 CSS 가 `animation: none` 이라 `animationend` 가 **아예 안 온다.**
- **큐에서 꺼낼 때는 `oAPP.fn.fnNavTo` 로 불러야 한다**(함수 자신을 직접 부르면 안 된다).
  `js/fnDialogPopupOpener.js` 가 `oAPP.fn.fnNavTo` 를 **감싸서** 「WS10 으로 가면 바인딩 창을 닫는다」를
  붙여 두었다. 자신을 직접 부르면 줄에서 꺼낸 전환에서는 그 처리가 빠진다.

## 12. 테스트 결과 — 통과 (2026-10-20)

장군님이 직접 돌려 **2건 모두 통과**. 구글시트 15번을 「끝남」으로 닫았다.

| 코드 | 무엇을 봤나 | 결과 |
|---|---|---|
| 1C-1 | 첫 화면 ↔ 편집 화면을 쉬지 않고 5~6번 오간 뒤 지나간 화면이 깔려 보이는지 | ✅ 통과 |
| 1C-2 | 천천히 오갈 때 좌우로 밀리는 전환이 전과 같은지 | ✅ 통과 |

끝낸 것: `.docs/TODO.md` 1부-C 절 삭제 · 현황 숫자(구글시트 8/18, 남음 10) ·
`.docs/구글시트_오류목록.md` 15번 상태 「끝남」.

## 13. 아직 안 본 것

- 20번→30번 등 다른 조합은 눈으로 확인하지 않았다(같은 함수를 지난다).
- `prefers-reduced-motion: reduce` 를 켠 상태는 확인하지 않았다 — 그 경우 CSS 가 `animation: none`
  이라 400ms 폴백으로만 끝나므로 전환 하나가 0.4초로 고정된다(동작은 되지만 느리다).
