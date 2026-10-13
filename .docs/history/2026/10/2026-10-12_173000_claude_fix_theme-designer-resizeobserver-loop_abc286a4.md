# 테마 디자이너 창 최대화 시 ResizeObserver loop limit exceeded

- 날짜 **2026-10-12** · 세션 `abc286a4` · type `fix`
- 장군님 제보 + 캡처: 테마 디자이너 창을 최대화하니 크리티컬 오류창.
  「ws3.0 → ws4.0 초반에 많이 나왔던 오류」 → **맞다. 같은 종류다.**
- 테스트 = `.works/별창팝업/07_테마디자이너_최대화_오류.md` (TD1~TD4)

## 원인

`Popups/monacoThemeDesign/Popup/js/wizardNav.js` 의 ResizeObserver 콜백 2곳이
**콜백 안에서 동기로 레이아웃을 바꾼다** → 같은 delivery 사이클에 재발화 → loop limit 초과.

| 자리 | 콜백이 하는 일 |
|---|---|
| `_wzNavResize(nav)` (관측 대상 = `oNav`) | `classList.remove("is-collapsed")` → `scrollWidth/clientWidth` 읽기 → `classList.toggle` → `_renderMiniCollapsed` 로 DOM 재생성 |
| `_updateScrollPad(oPage)` (관측 대상 = `oPage`·`oContent`) | `oPage.__pad.style.height` 를 바로 바꾼다 |

창 최대화는 폭 변화가 커서 재발화가 한계를 넘기 쉽다.

## 해결 — 원인 제거 (오류 삼키기 아님)

콜백 본문을 `requestAnimationFrame` 으로 **다음 프레임에 1회 코얼레싱**. 재진입 가드(`__roRaf`/`__padRaf`) 동반.
delivery 사이클 밖에서 레이아웃이 바뀌므로 루프가 성립하지 않는다.

**근거**: `.analy/16 §3.4.2`(ResizeObserver 를 계속 붙여둬야 하면 rAF 로 미룬다) ·
공통 `attachOverflow` 의 `_scheduleReflow` 와 같은 방식 ·
메모리 `resizeobserver-loop-defer-with-raf` / `resizeobserver-loop-benign-guard`.

★**onError 에서 이 오류를 삼키는 가드는 절대 금지**(장군님 지적 2026-07-10) — 넣지 않았다.

## 검증

- `node --check` 통과.
- 실제 동작은 **장군님 테스트 대기**(TD1~TD4).

## 같은 결함이 남아 있는 곳 — 손대지 않았다 (지시 대기)

| 파일 | 자리 |
|---|---|
| **`js/fnUiTempWizardPopupOpen.js`** (UI 템플릿 마법사) 454·872 | 테마 디자이너와 **글자까지 같은 코드**(이 자산을 복사해 간 쪽). **똑같이 터진다** |
| `js/fnP13nDesignPopupOpen.js` 692 | 콜백에서 `lf_clampSplit()` 로 폭을 바로 바꾼다 |
| `js/ws10_html.js` 1288 | 콜백에서 `_reflowSubHeader()` 를 바로 돈다 |

`js/fnStyleClassPopupOpen.js` 430 은 **이미 가드가 있다**(bRoPending) — 대상 아님.

## 이 오류가 되풀이되는 까닭 (기록)

같은 패턴이 변환물 여러 곳에 **복사돼 퍼져 있다.** 한 곳을 고쳐도 복사본이 남아 다시 터진다.
공통 위저드 자산을 쓰는 창을 만들 때 **RO 콜백은 무조건 rAF 로 감싼다**를 지키는 수밖에 없다.
