# busy indicator 를 Sparkle 로 교체 (공통 busy)

- 2026-10-29 · claude · feat · 세션 c015f13b
- 지시: 장군님 → 「멋있는 로그인 페이지」 세션 → 이 세션으로 전달.
  지침서 = `D:/workspace/yoon-history-test/test2/handoff/ws4-busy-sparkle/GUIDE.md`
  시안 = 6안 05 Sparkle (`busy_indicator6.html` 의 `id: "spark"`)

## 바꾼 것

| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/theme/u4a-busy.css` | 중앙 카드 모양을 Sparkle 로 교체 (로고 mask + 지나가는 빛줄기 + 별빛 3개 + 테두리 도는 빛) |
| `www/ws30/ws10_20/theme/u4a-busy.js` | 카드 마크업에 `<i>` 1개 + `<b>` 3개 추가 (`_create()` 의 innerHTML 한 군데) |

**켜고 끄는 로직은 한 줄도 안 건드렸다.** `show()` · `hide()` · 조용함 판정 · 세대 번호 전부 그대로.

## 테마 — 어떻게 붙였나

- 다크/화이트 = `html[data-sl-theme="dark"]` **하나로만** 가른다. 이 속성은 `theme-api.js` 의
  `_applySkin()` 이 테마를 바꿀 때마다 documentElement 에 다시 쓴다
  → **busy 가 떠 있는 중에 테마를 바꿔도 CSS 가 바로 따라간다. JS 를 한 줄도 안 넣었다.**
- 기본(선택자 없음) = **밝은 테마**. 테마 11종 중 10종이 밝은 테마이고 기본값도 `horizon_white` 라,
  다크를 기본으로 두면 속성이 없는 화면에서 어둡게 나온다.
- 카드 배경·테두리·그림자·글자색은 **종전대로 테마 의미 토큰**(`--popover-bg` · `--line` ·
  `--popover-shadow` · `--text` · `--text-muted`) → 테마별 하드코딩이 0 이고 11종이 저절로 맞는다.
- 로고 색만 시안이 정한 두 값(`--busy-accent: #c705f7` · `--busy-accent-2: #ff7af5`)을
  `.u4aWsBusyCard` 안에 둔다. 테마별로 다르게 주지 않았다 — WS 로고 색이라 어느 테마에서나 같아야 한다.

## 시안과 일부러 다르게 한 것 (실측 근거)

1. **밝은 테마의 `--busy-dim` = 72% → 100%(진하게).**
   흰 카드 위에서 72% 로 깔면 로고가 연분홍으로 바래 「로고가 또렷이 보이는지」(지침서 3-2) 를 못 맞췄다.
2. **카드 배경을 시안의 반투명(`rgba(255,255,255,.92)` + blur) 이 아니라 테마 토큰으로 두었다.**
   테마 11종을 하드코딩 없이 맞추기 위해서다. 그래서 `backdrop-filter` 는 안 넣었다.
3. **문구 뒤 점 세 개(`...`) 애니메이션은 안 넣었다.** 시안의 글자는 고정된 「처리 중」 이지만
   우리 카드의 문구는 `setBusy("X",{TITLE,DESC})` 가 넣는 **진짜 문장**이라 뒤에 점이 붙으면 어색하다.
4. 카드 폭은 종전 값(`min-width:300px` · `max-width:440px`) 유지 — 긴 문구의 줄바꿈이 전과 같게.

## 또 밟을 함정

- **공통 busy 는 두 종류다.** 이번에 바꾼 것은 한쪽뿐이다.
  - (A) `#u4aWsBusyIndicator` + `.u4aWsBusyCard` — `u4a-busy.js` 가 만든다. CSS = `theme/u4a-busy.css`. **← 바꿨다**
  - (B) `.u4a-busy` + `.u4a-busy__card` + `.u4a-busy__spinner` — 창마다 HTML 에 직접 박혀 있고
    그 창의 `_setBusy` 가 `data-busy` 를 토글한다. CSS = `theme/shell.css` 972~1095. **← 아직 옛 모양**
    대상 = 별창 18곳 + 서버리스트(로그인 화면) + attrPresetPopup. 지금도 살아 있다.
- **(B) 를 CSS 만으로는 Sparkle 로 못 바꾼다.** `.u4a-busy__spinner` 는 **빈 div** 다.
  로고에 `mask` 를 걸면 그 mask 가 `::before`·`::after` 까지 잘라내 별이 사라진다 →
  로고용 1개 + 별 3개 = **자식 요소 4개가 반드시 있어야** 한다. 즉 창마다 HTML 을 고쳐야 한다.
- **`u4a-busy.css` 는 `index.html` 에서 가장 먼저 로드된다.** 그래서 이 파일에 `.u4a-busy__*` 를 적어도
  **나중에 로드되는 `shell.css` 가 덮어쓴다.** (B) 를 고치려면 `shell.css` 를 고쳐야 한다.
  (2026-09-15 주석의 「뒤에 로드되는 CSS 중 busy 이름을 쓰는 것이 없다」 는 (A) 에 대해서만 맞다.)
- **옛 UI5 busy 마크업이 남은 창 3곳** — `extopen.html` · `Popups/findPopup/frame.html` ·
  `Popups/ui5CssPopup/frame.html` 은 HTML 에 `<div id="u4aWsBusyIndicator" class="... sapUiLocalBusyIndicator...">`
  가 박혀 있다. `u4a-busy.js` 의 `_create()` 는 **id 로 먼저 찾으므로 그 div 를 그대로 쓴다**
  → 카드가 없어 Sparkle 이 안 보인다. 이번 작업 범위 밖이라 그대로 뒀다.
- **확인용 미리보기는 `file://` 로는 화면을 못 찍는다.** 브라우저 창 도구가 local file 탭에서는
  동작하지 않는다 → 임시 static server(`python -m http.server`) 를 띄워 찍고 바로 껐다. 앱은 안 띄웠다.

## 못 한 것

- **앱에서의 실제 확인.** 실행은 장군님이 하신다 — 테마 CSS 를 그대로 가져다 만든 미리보기로만 확인했다.
- (B) 교체 — 영향도(파일 20여 개 + 공통 자산 `shell.css`)가 커서 지시를 받고 하기로 했다.

---

## 후속 (2026-10-29) — 아이콘 목록 창 · 이미지 아이콘 창은 새 모양이 안 나왔다

장군님 지적: 「이미지 아이콘 별창 팝업은 공통 busy 안쓰나봐? 지금 바뀐걸로 안나오고 이전게 나오네?」 — 맞다.

### 원인 (소스 확인)

두 창은 `theme/u4a-busy.css` · `u4a-busy.js` 를 **로드하고 쓴다**. 그런데
- `index.html` 에 옛 `.u4a-busy` 마크업이 **`data-busy="true"` 로 켜진 채** 박혀 있었고,
- 그 창의 busy 를 **켜는 호출이 어디에도 없었다**. 호출은 끄기 하나뿐 —
  `iconPrevPopup`: `index.js:255` · `runtime.js:89` 둘 다 `setShellBusy(false)`.
  `illustMsgPopup`: 자식 frame 이 `parent.setBusy("")` 로 끄기만.

→ 창이 떠서 UI5 를 읽는 **그 내내 보이는 것은 HTML 에 박힌 옛 동그라미**였고,
   공통 busy(Sparkle)는 그 첫 로딩에서 한 번도 뜨지 않았다. `_applyShellBusy`/`setBusy` 는
   **끌 때 처음 불려서** 옛 표시를 꺼 주는 역할만 했다.

### 고친 것

| 파일 | 무엇 |
|---|---|
| `Popups/iconPrevPopup/index.html` | `#iconpBusy` → `data-busy="false"`(공통이 없을 때만 쓰는 대비용) |
| `Popups/iconPrevPopup/index.js` | `_applyShellBusy` 정의 바로 뒤에 `oAPP.fn._applyShellBusy();` 한 줄 — 뜨자마자 공통 busy 를 켠다 |
| `Popups/illustMsgPopup/index.html` | `#illustpBusy` → `data-busy="false"` |
| `Popups/illustMsgPopup/index.js` | `setShellBusy` 별칭 뒤에 `setBusy(true);` 한 줄 |

켜고 끄는 **로직·시점은 그대로다** — 끄기는 전과 같이 UI5 부팅 완료에서만 일어난다.
`node --check` 두 파일 통과.

### 안 고친 것

`Popups/ui5CssPopup_v2/main/frame.html` — 같은 `data-busy="true"` 패턴이지만 **공통 busy 를 아예 안 쓴다**
(`u4a-busy.css`/`.js` 로드 없음). 별창 전체 `.u4a-busy` → Sparkle 교체(= `shell.css` 공통 자산 + 창 HTML 약 20개)와
같은 덩어리라 따로 지시를 기다린다.

### 또 밟을 함정

- **`index.html` 에 busy 를 켜진 채 박아 두면** 공통 busy 를 쓰는 창이어도 **첫 로딩은 옛 모양으로 보인다.**
  켜는 자리를 JS 로 옮기지 않으면 모양을 바꿔도 그 창에서는 안 바뀐다.
- **「그 창이 공통 busy 를 쓰나」를 `u4a-busy.js` 로드 여부로만 판정하면 틀린다.** 켜는 호출이 있는지까지 봐야 한다.
  내가 앞서 이 창을 「별창 = 옛 busy」로 뭉뚱그린 것이 그 때문이다.
- 두 창은 **닫으면 파괴하지 않고 숨겨 두고 다시 쓴다**(SYSID당 1개 상주 뷰어). 그래서 **앱을 켜고 처음 열 때만**
  로딩이 보인다 — 두 번째부터 로딩이 안 보인다고 결함으로 보지 말 것. 테스트도 그 전제로 써야 한다.

---

## 후속 (2026-10-29) — 카드 테두리 빛 두께 1.5px → 3px

장군님 지적(시안 화면): 「테두리 두께가 4면이 각각 다 달라, 상단 하단은 좋은데 좌측 우측은 얇아 보여」
→ 시안에서 3px 로 확인 후 「딱좋다」.

- `theme/u4a-busy.css` `.u4aWsBusyCard::before` 의 `padding: 1.5px` → `padding: 3px` (한 줄).
- 까닭: 두께가 소수(1.5px)면 카드가 가운데 정렬로 **반 픽셀 자리**(예: left 125.5px)에 놓일 때
  브라우저가 픽셀에 맞추면서 **좌우만 1px 로 줄어든다.** 위아래는 영향을 안 받아 네 면이 달라 보인다.
- **함정**: 테두리·구분선 두께는 **정수 px** 로 둔다. 소수 두께는 요소가 놓이는 자리에 따라
  면마다 다르게 보이고, 「CSS 는 맞는데 화면만 이상한」 모양이 된다.

## 그때 겹친 사고 — TODO 1부가 다른 창의 덮어쓰기로 날아갔다

내가 올린 처리중 표시 테스트 6칸(1-1~1-6)이 **다른 대화창이 1부를 다시 쓰면서 통째로 사라졌다.**
MIME 리포지토리 1칸만 남아 있었다. 다시 1-2~1-8 로 넣었다.

- **함정**: `.docs/TODO.md` 는 여러 창이 같이 고친다. **절을 통째로 바꾸는 치환(`replace`)을 쓰면
  그 사이에 남이 넣은 줄을 지운다.** 줄을 **끼워 넣는 방식**(앵커 줄을 찾아 그 뒤에 삽입)으로 쓰고,
  쓰기 직전에 그 절을 다시 읽어 지금 무엇이 있는지 확인한다.


---

## 눌러 볼 것 (TODO 에 두지 않는다 — 장군님 지시 2026-10-29)

「todo에는 반드시 busy 관련된 내용은 넣지마」. 그래서 이 표는 여기에만 둔다.

| 번호 | 무엇을 보나 | 조작 | O/X |
|---:|---|---|:--:|
| **1-1** | 처리중 표시(busy)가 **새 모양**으로 뜨나 — 로고 위로 빛줄기가 지나고 별빛이 튑니다 | ① 아무 앱이나 열고 저장한다 ② 처리중 표시를 본다 | ☐ |

---

## 장군님 지시 (2026-10-29) — **busy 관련 내용은 TODO 에 넣지 않는다. 절대.**

TODO 에서 busy 줄을 전부 뺐다. **없어지면 안 되는 내용이라 여기에 옮겨 둔다.**

| 옛 번호 | 내용 | 상태 |
|---|---|---|
| 4-12 | 별창 18곳과 로그인 화면의 처리중 표시도 Sparkle 로 바꿀까 — 지금은 그 창들만 옛 동그라미. 바꾸려면 `shell.css` 1곳 + 창 HTML 20곳(빈 칸에 로고·별 자리를 넣어야 해서 CSS 만으로는 안 된다) | **지시 대기.** 착수 전 창 목록을 표로 보고할 것 |
| 5-1 | 오류 페이지 에디터 「SAVE」 에 busy 를 걸까 | **보류**(장군님 2026-10-15 「나중에 정하자, 지금은 그대로 두어」). 코드 손대지 않음 |
| 5-2 | `setBusy` · `setDomBusy` 를 하나로 합칠까 (호출처 43곳 = 로그인 34 · 메인 시작 3 · 창 뜨는 쪽 6) | **보류**(장군님 2026-10-21 「우선 보류」). 합치는 것 자체는 맞다(뒤가 앞의 일부). 걸리는 것 = 로그인 화면 포커스 — 포커스 찾는 코드가 iframe 안을 못 봐서 합치면 로그인 실패 후 커서가 비밀번호 칸으로 안 돌아갈 수 있다. 조사 = `2026-10-21_claude_analysis_setbusy-setdombusy-merge-impact_06836675.md` |

함정: **busy 는 TODO 의 소재가 아니다.** 눌러 볼 것·정할 것이 생겨도 TODO 에 쓰지 말고 이력에 쓰고 채팅으로 묻는다.

---

## 후속 — 애니메이션을 transform 으로 옮김 (2026-10-30)

「멋있는 로그인 페이지」 세션이 장군님 확정(「넣어」)과 함께 보낸 요청. 장군님 말씀 =
「busy 키는건 좋은데 왜 애니메이션이 무거운 프로그램 돌때 끈키냐」.

### 원인
| 무엇 | 종전 | 왜 멈추나 |
|---|---|---|
| 카드 테두리 빛 | `@property --u4aWsEdgeAngle` 각도 애니메이션 | 각도 값이 바뀔 때마다 main thread 가 conic-gradient 를 다시 그린다. 무거운 동기 작업이 main thread 를 붙잡으면 그 사이 한 프레임도 안 그려진다 |
| 로고 광택 | `background-position` 애니메이션 | 같은 이유 |
| 별빛 | `transform` | 멈추지 않았다(그대로 둠) |

transform·opacity 만 compositor 에서 돈다. 요청자 실측(헤드리스 크롬, 3초 붙잡는 동안
첫·끝 프레임 차이) = 각도 방식 7px vs transform 방식 1,413px.

### 고친 것 (2파일)
| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/theme/u4a-busy.js` | `_create()` 마크업에 요소 2개 추가 — `<span class="u4aWsBusyEdge"><i></i></span>` (카드 첫 자녀) · 로고 `<i>` 안에 `<s></s>` |
| `www/ws30/ws10_20/theme/u4a-busy.css` | `@property` 블록·`::before` 규칙 삭제 → `.u4aWsBusyEdge`(테두리 mask) + `.u4aWsBusyEdge i`(640px conic 판, `rotate` 3s) / 로고 `i` = mask 고정 + `background: var(--busy-dim)` + `position:relative; overflow:hidden` / 새 `.u4aWsSpinner i s` = 115deg 그라데이션 판, `translateX(-66.667%)→0` 1.9s / `b` 에 `will-change:transform` / 전역 방어 선택자에 `s` 추가(`text-decoration:none` — `<s>` 는 기본이 취소선) / `prefers-reduced-motion` 대상 교체 |

겉모습·두께(3px)·테마 변수·켜고 끄는 로직은 한 줄도 안 바꿨다. 외부 CDN 0.

### 안 한 것
- **busy 켠 뒤 한 프레임 쉬게 하라(요청 5번)** — 호출처를 안 고쳤다. 공통 `fnYieldToPaint` 가
  이미 있고, 어디에 넣을지는 호출처 전수 영향도부터 봐야 한다. 지시 받고 착수한다.
- `shell.css` 쪽 `.u4a-busy`(별창 18곳·로그인 화면)는 아직 옛 동그라미 — 교체 지시 대기.

### 함정
- **마크업은 `u4a-busy.js` `_create()` 한 곳에서만 만든다**(www 전체 grep 확인). CSS 를
  마크업 바꾸는 쪽으로 고치면 그 한 곳만 같이 고치면 된다 — 창 HTML 에는 이 카드가 없다.
- **`<s>` 는 기본 취소선**이다. 빈 요소라 글자는 없지만 방어 규칙에 `text-decoration:none` 을 넣어 둔다.
- **conic 판 크기 640px 는 카드 대각선보다 커야** 한다. 카드가 지금(`max-width:440px`)보다
  커지면 판도 키운다 — 안 키우면 모서리에서 빛이 끊긴다.
- 로컬 테스트 페이지를 browser pane 으로 띄워 눈으로 보려 했으나, **file:// 는 그 pane 에서
  screenshot·DOM 조작이 안 된다**(static snapshot 으로만 뜬다). 눈 확인은 앱에서 해야 한다.
