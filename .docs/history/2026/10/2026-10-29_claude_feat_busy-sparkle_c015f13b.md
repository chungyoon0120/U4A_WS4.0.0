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
