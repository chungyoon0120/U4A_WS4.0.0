# N1 — busy·모달 팝업이 떠 있으면 창 헤더를 끌어도 창이 안 움직이던 것

- 날짜: 2026-10-29
- 지시: 장군님 「너 우선 N1 좀 해결하고 있어라」
- 고친 자리: `www/ws30/ws10_20/css/ws10_20.css` 1~5행 — **한 줄 삭제**(`-webkit-app-region: no-drag`)

## 증상

메인 창에 공통 busy(처리중 표시)나 모달 팝업이 떠 있는 동안 창 맨 위 띠(`.u4a-titlebar`)를
끌어도 창이 움직이지 않는다. Electron 14 에서는 움직였고, **45 로 올린 뒤** 생겼다(장군님 2026-10-28).

## 원인

**Chromium 152 부터 `app-region`(= `-webkit-app-region`) 이 상속되는 속성으로 바뀌었다.**
Chromium commit `9100cdc8` / CSSWG issue 13101. Electron 45 = Chromium 156, Electron 14 = Chromium 93.
밖에서 확인한 근거: WebView2 가 같은 변경을 받아 같은 사고를 겪었다
(<https://github.com/MicrosoftEdge/WebView2Feedback/issues/5696>) — v151 까지 정상, v152 부터 깨짐.

메인 창 문서(`ws30/ws10_20/index.html`)의 CSS 는 `html, body, .u4aWsContent { -webkit-app-region: no-drag }`
를 걸고 있었다. 상속이 생기면서 **그 문서의 모든 요소가 `no-drag` 를 물려받았다.**

드래그 영역은 문서 순서대로 `drag` 는 더하고 `no-drag` 는 빼면서 쌓인다. 그런데
화면 전체를 덮는 요소가 **헤더보다 뒤**에 있다 —

- 공통 busy = `theme/u4a-busy.js` 가 `document.body` **끝에 붙이는 `<dialog>`** + `showModal()`
  (`inset:0; width:100vw; height:100vh`). top layer 라 문서 순서상 맨 마지막.
- 모달 팝업 = 같은 `<dialog>` + `showModal()`. 그 `::backdrop` 이 화면 전체를 덮고,
  pseudo-element 는 원래 요소에서 값을 물려받는다.

→ 헤더 몫이 통째로 깎였다. busy 를 끄면 `dialog:not([open]) { display:none }` 이라 수집에서 빠지고,
그래서 **busy·팝업이 없을 때는 멀쩡했다.** 증상이 「떠 있을 때만」인 것이 이 판정의 확증이다.

## 왜 한 줄 삭제가 맞는가 (영향도)

`ws10_20.css` 를 로드하는 문서는 `ws30/ws10_20/index.html` **하나뿐**이다(`ws10_html.js` 쪽은 주석).
그 문서의 app-region 선언 전수와 판정:

| 자리 | 지금 | 빼면 | 필요한가 |
|---|---|---|---|
| `html, body, .u4aWsContent` no-drag (ws10_20.css:5) | 문서 전체가 물려받아 헤더를 깎는다 | 전부 초기값 `none` → 수집 안 됨 | **아니오** |
| `.u4a-titlebar` drag (shell.css:145) | 헤더 더하기 | 그대로 | 예 |
| `.u4aWsBrowserDraggable` drag !important (ws10_20.css:408 · view.js:31 · ws_fn_01.js:216) | WS10 헤더 Bar 더하기 | 그대로 | 예 |
| `.u4a-titlebar__logo` · `.u4a-winbtn` (shell.css) · `.sapMBtn`/`.sapMSlt` (ws10_20.css:412) · `.u4a-sap-logo` (ws10.css:150) no-drag | 헤더 안 구멍 | 그대로 | 예 |
| `.u4aFrameHeader` drag · `.u4aFrameWinBtns` no-drag (frame.css:517·545) | 미사용(주석에 명시) | 그대로 | — |

- **옛 동작과 같다**: 상속이 없던 Chromium 93 에서 이 선언은 `html`·`body` 자기 사각형만 뺐고,
  그 자리는 문서 맨 앞 = 아직 빈 영역이라 **효과가 0** 이었다. 그래서 빼도 달라지는 것이 없다.
- 헤더 안에서 눌러야 하는 것들은 **저마다 `no-drag` 를 직접** 달고 있다(위 표). 조상인 헤더가 `drag`
  라서 `body` 의 값은 애초에 거기까지 오지 않는다 — 이 선언과 무관하다.
- **`www` 전체에서 `html`·`body` 에 no-drag 를 건 곳은 이 한 곳**이다. 별창들은 작은 요소에만
  걸어 두어 같은 증상이 없다(별창의 busy `<dialog>` 는 물려받을 값이 없어 `none` 이 된다).

## 버린 방법

- **busy `<dialog>` 에 `-webkit-app-region: none` 을 달기** — 팝업·`::backdrop`·앞으로 만들 전체화면
  요소마다 같은 줄을 복붙해야 한다. 뿌리(`body` 선언)를 그대로 두는 것이라 버렸다.
- **`_kickHostDragRegion`(1px 리사이즈→원복)을 busy 켤 때마다 부르기** — stale 이 원인이 아니므로
  고쳐지지 않고, 창이 매번 떨린다.

## 또 밟을 함정

- **`html`·`body`·`*` 에 `-webkit-app-region` 을 걸지 말 것.** Chromium 152+ 는 상속하므로
  그 문서의 전체화면 요소가 창 드래그를 통째로 죽인다.
- 반대쪽 함정(아직 증상 보고 없음, **고치지 않았다**): `drag` 를 건 요소의 **자식이 그 요소 밖으로
  넘쳐 그려지면**(헤더 안에서 아래로 펼쳐지는 메뉴 등) 그 자식도 `drag` 를 물려받아 **그 자리가
  눌리지 않고 창이 끌린다.** WebView2 쪽에서 보고된 증상이다. 지금 확인한 바로는 이 앱의 설명 풍선·
  확인창은 `document.body` 에 붙으므로(`u4a-ui.js:862`·`:2604`) 헤더의 자식이 아니라 해당 없다.
- Electron 에 `ELECTRON_DEBUG_DRAGGABLE_REGIONS` 환경변수가 있다(PR #53633, 패키징 안 한 앱에서만).
  드래그 영역을 화면에 덮어 보여 준다 — 다음에 같은 종류로 헤매면 이것부터 켠다.

## 미검증

- **앱으로 확인하지 않았다.** 테스트는 TODO 의 N1-1(모달 팝업) · N1-2(처리중 표시) ·
  N1-3(되돌아감 — 헤더 단추·로고)이다.
- 드래그 영역을 쌓는 순서가 「문서 순서대로 더하기/빼기」라는 것은 Electron 소스
  (`DraggableRegionsToSkRegion`)와 여러 프로젝트 보고로 교차 확인했으나, **이 앱에서 직접 재어
  보지는 않았다.** 다만 「busy 가 떠 있을 때만 깨진다」는 증상이 이 모형과만 맞는다.
