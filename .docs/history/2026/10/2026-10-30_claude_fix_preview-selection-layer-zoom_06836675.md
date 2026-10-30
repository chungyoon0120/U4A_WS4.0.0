# WS20 미리보기 — 줌을 바꾸면 **선택 표시가 어긋나던 것**

- 날짜: 2026-10-30
- 지시: 장군님 「좌측 UI 트리에서 UI 선택하면 해당 UI를 가운데 미리보기 영역에 선택 표시해주는게 있는데
  그게 미리보기 영역 상단에 줌 변경하는 슬라이더를 이용해서 확대 축소를 하면 **선택 표시가 어긋나는 부분**
  수정좀 해줘」
- 고친 파일: `www/ws30/ws10_20/design/preview/index.js` **하나**

## 원인 — 좌표에 zoom 이 **두 번** 곱해진다

| | 무엇 |
|---|---|
| 줌 슬라이더 | `setPreviewZoom(값)` → 미리보기 문서의 `<html>` 에 **`style.zoom`** 을 건다 |
| 선택 표시 | `<body>` 에 붙인 오버레이 `<div>` 를 `getBoundingClientRect()` + 스크롤 값으로 위치시킨다 |

`getBoundingClientRect()` 는 **zoom 이 이미 곱해진** 화면 좌표를 돌려준다.
그런데 오버레이도 같은 zoom 안에 있어, `style.left` 에 넣은 값에 zoom 이 **한 번 더** 곱해진다.

### 실측 (내장 브라우저 Chromium 152, 격리 iframe)

요소를 `left:100px` 에 두고 rect 를 그대로 `style.left` 에 넣었을 때 실제로 그려진 자리:

| zoom | rect.left | 오버레이가 그려진 자리 | 어긋남 |
|---:|---:|---:|---|
| 1 | 100 | 100 | 없음 |
| 2 | 200 | **400** | 2배 |
| 0.5 | 50 | **25** | 절반 |

→ 확대도 축소도 어긋난다. 장군님 증상과 일치한다.

## 고친 것

### ① 좌표를 zoom 으로 나눈다

새 헬퍼 `getPreviewZoomFactor()` 를 두고, 레이어 두 곳에서 쓴다.

| 함수 | 무엇을 그리나 |
|---|---|
| `updatePreviewSelectionLayer` | 트리에서 고른 UI 의 **선택 표시** |
| `updatePreviewContextLayer` | 우클릭 메뉴를 연 UI 의 **강조 표시** |

식: `left = (rect.left + scrollLeft) / zoom` (top·width·height 도 같은 꼴).
**zoom 이 1 이면 나누기 1 이라 전과 한 글자도 다르지 않다** — 회귀 위험이 없다.

작은 글자 UI 에 붙는 여백(`iLayerOffset` 3px)은 **나누지 않았다** — 미리보기 내용과 같이 커지는 것이 맞다.

### 실측 검산 (같은 방법, 7가지)

zoom 1 / 1(스크롤 200·300) / 2 / 0.5 / 1.3 / 0.1 / 2(스크롤 0) — **전부 정확히 일치**했다.

### ② 줌을 바꾸면 **다시 그린다**

`setPreviewZoom` 끝에서 `requestPreviewMarkLayerUpdate()` 를 부른다.
안 부르면 좌표식을 고쳐도 **옛 자리에 그대로 남는다.**

왜 기존 이벤트로는 안 되나 — 실측으로 확인했다.

| 무엇 | zoom 변경 때 |
|---|---|
| `scroll` | 안 난다 |
| `sap.ui.getCore().attachUIUpdated` | 안 난다 |
| 고른 요소의 `ResizeObserver` | **0회** (확대·축소 둘 다) |
| `document.documentElement` 의 `ResizeObserver` | 확대 **0회** / 축소 1회 — **믿을 수 없다** |

게다가 고른 UI 가 스크롤되는 상자 안에 있으면 `documentElement` 는 아예 보지도 않는다.

## 안 건드린 것

- `design/_preview/index.js` — `_` 로 시작하는 폴더는 탐색 제외(구버전)다.
- 슬라이더 쪽(`js/ws_html5_ws20_prev.js` · `design/js/uiPreviewArea.js`)은 손대지 않았다.
  둘 다 `setPreviewZoom` 을 부르므로 이번 수정이 그대로 적용된다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 통과.
- 실측은 **Chromium 152**(내장 브라우저)에서 했다. WS4.0 은 Electron 45 = **Chromium 156** 이다.
  `zoom` 이 표준화된 128 이후라 동작은 같지만, 156 에서 직접 재지는 않았다.
- 테스트 = TODO 의 `ZM1`.

## 또 밟을 함정

- **`style.zoom` 을 쓰는 화면에서 `getBoundingClientRect()` 값을 그대로 `style.left` 에 넣으면 안 된다.**
  그 값은 이미 zoom 이 곱해져 있다. 같은 zoom 안에 있는 요소에 넣으려면 **zoom 으로 나눈다.**
- **`style.zoom` 변경은 `resize` 도 `scroll` 도 내지 않는다.** 위치를 다시 잡아야 하는 것이 있으면
  **zoom 을 바꾸는 그 자리에서 직접** 불러야 한다. `ResizeObserver` 에 기대면 확대에서 조용히 깨진다.

---

# 후속 (같은 날) — **아직 어긋났다.** 좌표만이 아니라 **판정 기준**도 줌에 흔들렸다

- 지시: 장군님 「선택 표시가 확대 축소할때 **조금 아직도 어긋나는** 부분이 있어..
  **원본은 잘되어 있으니 원본도 참고**해서 다시 확인해줘」

## ★원본을 먼저 봤다 — **원본 코드를 가져오는 것은 답이 아니다**

원본(`U4A_WS_DESIGN/design/preview/index.js`)과 이 구역을 통째로 diff 했다.

| | 원본 | WS4.0 |
|---|---|---|
| 선택 표시 방식 | **오버레이 `<div>`** (`oSelectionLayer`) | 같다 |
| 좌표 식 | `(rect.left + scrollLeft) + "px"` | 같았다(이번에 고침) |
| zoom 보정 | **없다** | 없었다 |
| `setPreviewZoom` | `html.style.zoom = 값` | 같다 |

**원본에도 zoom 보정이 한 줄도 없다.** 그런데 원본에서는 잘 된다.

까닭은 **Chromium 버전**이다. 원본 WS3.0 = Electron 14(**Chromium 93**), WS4.0 = Electron 45(**Chromium 156**).
Chromium 128 에서 `zoom` 이 표준화되면서 `getBoundingClientRect()` 가 **zoom 을 반영한 값**을 돌려주도록 바뀌었다.
93 에서는 반영하지 않았으므로 보정 없이도 맞았다.
→ **원본을 그대로 옮기면 지금 깨진 그대로다.** 보정은 WS4.0 에서 새로 필요한 것이다.

## 아직 어긋나던 진짜 까닭 — **절대 픽셀 임계값 네 곳**

앞 작업에서 **좌표만** 보정했다. 그런데 이 코드는 rect 의 **절대 크기로 판정하는 자리**가 더 있었다.

| 자리 | 기준값 | zoom 이 걸리면 |
|---|---|---|
| 어느 DOM 에 표시할지 고르는 **점수** | `width <= 2 \|\| height <= 2` → -3000 | 축소하면 걸려 **다른 요소가 뽑힌다** |
| 〃 | 넓이(`width * height`) 가산 | 확대하면 커져 **순위가 바뀐다** |
| 작은 글자 UI 인가(여백 3px) | `height > 28 \|\| width > 260` | 확대하면 안 걸려 **여백이 사라진다** |
| 테두리 안쪽 여백 | `Math.min(width, height) <= 12` | 축소하면 걸려 **모양이 바뀐다** |

점수가 바뀌면 **아예 다른 요소에 표시**된다 — 이것이 「조금 어긋남」의 가장 큰 몫이다.

## 고친 방법 — rect 를 만드는 자리에서 **한 번만** 나눈다

`getPreviewSelectionDomRect()` 가 **zoom 1배 기준 사본**을 돌려주도록 바꿨다(`scalePreviewRectToCss`).
그러면 **판정도 배치도 전부 같은 기준**이 된다.

- 두 레이어 함수가 `getBoundingClientRect()` 를 직접 부르던 것도 이 함수로 바꿨다.
- 스크롤 상자 rect(`getPreviewSelectionRootRect`)도 같은 기준으로 맞췄다.
  (`window.innerWidth/innerHeight` 는 **이미 CSS 픽셀**이라 그대로 둔다.)
- 배치 식: rect 는 이미 나눠졌으므로 **스크롤만** 나눈다 — `oRect.left + iScrollLeft / fZoom`.
  (전 식 `(rect + scroll) / zoom` 과 수학적으로 같다.)
- 여백 3px(`iLayerOffset`)도 CSS 픽셀이라 그대로 더하고 뺀다.

## 실측 검산 (내장 브라우저 Chromium 152, 격리 iframe)

실제 구조에 맞춰 **body margin 8px + 내부 스크롤 상자 + 문서 스크롤**을 둔 뒤,
zoom 1 / 1(스크롤) / 2 / 0.5 / 1.3 / 2(여백 3px) / 0.5(여백 3px) / 0.1 — **8가지 전부 위치·크기 오차 0**.

## 검증 — **통과** (2026-10-30)

장군님이 `ZM1` 을 눌러 보고 「잘된다」고 알려 주셨다. 확대·축소해도 선택 표시가 그 UI 에 붙어 있다.
`node --check` 통과. TODO 의 🧪 테스트 항목 절은 이 한 줄뿐이었으므로 목차와 함께 지웠다.

※ 실측은 Chromium 152(내장 브라우저)에서 했고 앱은 **156** 이다 — 앱에서 통과했으므로 동작이 같음이 확인됐다.

## 또 밟을 함정

- **zoom 을 쓰는 화면에서는 좌표만 고쳐서는 안 된다.** rect 의 **크기로 분기하는 코드**(임계값 비교,
  넓이 점수)가 있으면 그것도 같이 흔들린다. → **rect 를 만드는 자리에서 한 번 나눠** 통일한다.
- **「원본은 잘 되는데 왜 여기만 안 되나」가 늘 코드 차이는 아니다.** 이번처럼 **Chromium 버전이 바뀌어
  같은 코드가 다르게 도는** 경우가 있다. 원본과 diff 를 떠서 **같다는 것**부터 확인한다.
