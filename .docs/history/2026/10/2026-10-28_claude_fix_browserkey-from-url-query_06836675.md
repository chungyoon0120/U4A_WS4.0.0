# 별창의 브라우저 키가 undefined 도었던 것 — 주소 쿼리에서 읽도록 바꿈

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「일렉트론 버전 올리면서 getWebPreferences() 가 없어져 브라우저 키를 구하지 못해서 여기저기 문제다 … 반드시 location.href 에서 querystring 으로 브라우저키를 추출하는 로직으로 바꿔야돼」
- 찾은 사람: **장군님**(중단점을 걸어 직접 값을 보셨다)

## 증상

별창(예제 열기 · 아이콘 목록 · 속성 도움말)이 뜨고 내용도 보이는데
**처리중 표시(파란 점 3개)만 영영 안 꺼진다.** 별창 Console 에는 오류가 없다.

## 원인

`extopen.js` 는 자기 처리중 표시를 **자기가 끄지 않는다.**
끄는 길은 하나뿐이다 — 메인 창이 BroadcastChannel 로 BUSY_OFF 를 방송해 줘야 한다.

그 방송을 요청하는 IPC 채널 이름이 `if-send-action-<BROWSKEY>` 인데,
`BROWSKEY` 를 `CURRWIN.webContents.getWebPreferences().browserkey` 로 읽고 있었다.
**Electron 45 에서 그 값이 안 온다** → 채널 이름이 `if-send-action-undefined` 가 돼
메인 창은 아무것도 받지 않고, 방송도 안 나가고, **오류도 안 난다.**

메인 창 쪽은 멀줦했다 — `parent.getBrowserKey()` 로 읽고, 그 값은 **서버리스트가
로그인할 때 채번해 보내 준 것**을 `index.js` 가 받아 둔 것이다. 그래서 한쪽만 어긋나 있었다.

## 고친 자리 — `www/ws30/ws10_20/extopen.js` 한 파일, 세 자리

창을 여는 `fnExternalOpen` 이 **이미 같은 값을 주소 쿼리로 넣어 주고 있었다**
(`browserkey` · `sessionKey` · `OBJTY` · `TITLE` · `THEME` · `BGCOL`). 거기서 읽도록 바꿨다.

| 자리 | 전 | 후 |
|---|---|---|
| 브라우저 키 | `getWebPreferences().browserkey` | `getWinParam("browserkey")` |
| 창 종류 | `getWebPreferences().OBJTY` | `getWinParam("OBJTY")` |
| 부모·자식 메시지 수신부 | `oWebPref.browserkey` | 위에서 읽은 `BROWSKEY` 재사용 |

★**읽는 방식은 이 프로젝트의 기존 표준을 그대로 쓴다** — `WSUTIL.QueryString.parse(location.href)`.
처음엔 `getWinParam` 이라는 새 함수를 만들었다가 장군님 지적으로 걷어냈다 —
**같은 방식을 이미 61곳이 쓰고 있었다.** 새 함수를 만들지 말 것.
값이 비면 `console.warn("[extopen] GUARD_EXIT | browserkey not in window url ...")` 를 한 번 남긴다.

## 검증

- `node --check` 통과
- **장군님이 눌러 확인 — 처리중 표시가 정상으로 꺼진다**(2026-10-28)
- 같은 파일을 아이콘 목록 창과 예제 열기 창이 함께 쓴다 → 둘 다 낙는다

## ★함정

1. **`webContents.getWebPreferences()` 는 Electron 45 에서 쓰면 안 된다.**
   메서드 자체는 `electron/main.js` 에서 다시 만들어 붙였으므로 **던지지 않는다** —
   그래서 더 위험하다. 값만 조용히 비어 있고 오류도 안 난다.
2. 브라우저 키는 **서버리스트가 로그인 때 채번**해 주는 값이라
   `electron/main.js` 가 대신 채울 수 없다. 거기서 고칠 생각을 하지 말 것.
3. 창 사이 통신이 끈겼는데 **어느 Console 에도 오류가 없으면** 채널 이름에 들어가는
   값이 비었는지부터 본다.

## 전수 조사 (2026-10-28, 장군님 지시) — `www` + `electron` 전체

`_` 로 시작하는 폴더·파일과 `(deprecated)` 제외. 주석 제외.
**남은 호출 자리 = 29곳** (`extopen.js` 3곳은 이번에 고쳐서 제외).

### A. 자기 창의 browserkey — `location.search` 로 바꾸면 된다 (5곳)

| 파일:줄 | 무엇을 꺼내나 | 안 되면 무엇이 고장나나 |
|---|---|---|
| `www/help/u4a_helpdoc/viewer/u4a-ws30-help/helpViewer.js:73` | browserkey | 도움말 창을 부른 창을 못 찾는다 |
| `www/ws30/ws10_20/js/ws_common.js:2798` | browserkey | 「이미 열려 있는 팝업」 판정이 깨진다 |
| `www/ws30/ws10_20/js/ws_common.js:2883` | browserkey | 형제 창 목록이 빈다 → **뒤로가기 때 별창이 안 닫힌다** |
| `www/ws30/ws10_20/Popups/designTreeUiSearchPopup/index.js:17` | browserkey | 그 팝업의 IPC 가 안 간다 |
| `www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:313` | browserkey | 자식창 모음이 빈다 |

### B. 남의 창의 값 — 그 창의 `webContents.getURL()` 에서 읽어야 한다 (15곳)

가장 많고 가장 조심할 묶음이다. 단순히 `location.search` 로 바꾸면 **틀린다.**

| 파일:줄 | 꺼내는 값 |
|---|---|
| `www/floatingMenu/js/handle.js:60` | floatingMenu 표식 |
| `www/help/.../helpViewer.js:104` | OBJTY + browserkey |
| `www/ws30/resources/index.js:2635` | OBJTY + partition |
| `www/ws30/ws10_20/js/ws_common.js:2738` | OBJTY |
| `www/ws30/ws10_20/js/ws_common.js:2813` | browserkey + OBJTY |
| `www/ws30/ws10_20/js/ws_common.js:2905` | OBJTY + browserkey |
| `www/ws30/ws10_20/js/ws_fn_01.js:100` | OBJTY |
| `www/ws30/ws10_20/js/ws_fn_02.js:1832` | partition |
| `www/ws30/ws10_20/js/ws_fn_02.js:1894` | partition |
| `www/ws30/ws10_20/js/ws_fn_02.js:2162` | OBJTY |
| `www/ws30/ws10_20/js/ws_fn_02.js:2267` | OBJTY |
| `www/ws30/ws10_20/js/ws_fn_04.js:1026` | OBJTY |
| `www/ws30/ws10_20/js/ws_fn_04.js:1658` | OBJTY + SYSID + partition |
| `www/ws30/ws10_20/js/ws_fn_05.js:32` | browserkey |
| `www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:339` | browserkey + OBJTY |

★**아직 안 봤다**: 모든 별창이 `OBJTY` · `browserkey` · `partition` 을
**주소 쿼리에 넣고 열리는지** 확인하지 않았다. 이걸 먼저 봐야 B 를 고칠 수 있다.

### C. IPC 를 보낸 창 — `events.sender.getURL()` (2곳)

`www/ws30/ws10_20/js/fnFindPopupOpen.js:243` · `:260` — browserkey.
안 되면 Find 창의 새로고침 답이 안 돌아가 **처리중 표시가 안 꺼진다.**

### D. 고칠 필요 없거나 이미 대비된 것 (5곳)

| 파일:줄 | 까닭 |
|---|---|
| `design/bindPopupHandler/broadcastChannelBindPopup.js:21` | 값이 비면 쿼리에서 읽는 코드가 **이미 있다** |
| `www/ws30/ws10_20/js/ws_util.js:54` | USERINFO — 바로 아래에서 쿼리 값으로 덮어쓴다 |
| `www/ws30/ws10_20/index.js:201` | USERINFO |
| `www/ws30/ws10_20/Popups/editorPopup_v2/Popup/index.js:16` | browserkey + USERINFO |
| `www/ws30/ws10_20/Popups/u4aDocPopup/frame.js:37` | USERINFO |

★ USERINFO 가 정말 안 오는지는 **따로 확인해야 한다** — 안 오면 그 창들의
언어·시스템 정보가 비어 메시지가 안 나온다.

### E. 메인 process (2곳)

| 파일:줄 | 무엇 |
|---|---|
| `electron/main.js:448` | 없어진 함수를 **다시 만들어 붙이는 자리** — 장군님: 걷어낼 대상 |
| `electron/main.js:650` | 그걸 쓰는 자리 |

## 앞으로 할 것

1. **별창을 여는 자리가 쿼리에 무엇을 넣는지 먼저 전수로 본다.**
   `extopen` 계열은 넣고 있다(browserkey·sessionKey·OBJTY·TITLE·THEME·BGCOL).
   다른 별창은 확인 안 했다. **안 넣는 창이 있으면 거기부터 넣어야 한다.**
2. 그다음 A → C → B 순서로. **새 함수를 만들지 않고** 기존 표준만 쓴다 —
   자기 창 = `WSUTIL.QueryString.parse(location.href)`,
   남의 창 = `WSUTIL.QueryString.parse(oWin.getURL())` (`ServerList.js:3588` 등에 선례 있음).
3. E 는 A·B·C 가 다 끝난 뒤에 걷어낸다 — 먼저 빌면 전부 멈춘다.

## ★최종 전수 결과 (2026-10-28, 눈으로 한 줄씩 확인 완료)

지시: 장군님 「getWebPreferences() 여기서 값 받아서 참조하는 로직 전수 검사」

**부르는 줄 30 + 그 값을 참조하는 줄 32 = 62줄 / 17파일.** 기계 집계와 눈 확인이 일치한다.

### 꺼내는 값 (6종)

`browserkey` · `OBJTY` · `partition`(주소 쿼리에선 `sessionKey`) · `USERINFO` · `SYSID` · 떠다니는 메뉴 표식

### 분류

| 구분 | 줄 | 고치는 방법 |
|---|---:|---|
| 자기 창 값 | 16 | `WSUTIL.QueryString.parse(location.href)` |
| IPC 를 보낸 창 값 | 3 | `WSUTIL.QueryString.parse(events.sender.getURL())` |
| 남의 창 값 | 40 | `WSUTIL.QueryString.parse(oWin.getURL())` |
| 메인 process | 3 | 맨 마지막에 걷어낸다 |

파일별로는 공통 창 처리 묶음 11줄, 창 열기·닫기 담당 9줄, 테마·창 목록 담당 6줄이 가장 많다.

### 전제 — 주소에 값을 채워야 하는 창 = **2곳**뿐

창을 여는 자리 58곳 중 창 종류를 정해 여는 창은 거의 다 주소 쿼리에 값을 넣고 있다.
안 넣는 것은 둘뿐이다.

| 창 | 파일:줄 |
|---|---|
| 속성 도움말의 작은 투명 창 | `www/ws30/ws10_20/js/fnDialogPopupOpener.js:1230` |
| 코드 편집기 창 | `www/ws30/ws10_20/Popups/editorPopup_v2/index.js:91` |

(`design/testFolder/callAiInterfacePopup.js:75` 도 안 넣지만 **테스트 폴더**라 현행 아니다.)

### 고칠 대상이 아닌 것

- `www/intro.js:542` (서버리스트 창) — 주소에 키·세션이 없지만 **원래 그 값이 없다.**
  브라우저 키는 서버리스트에서 **로그인할 때 채번**된다 — 로그인 전엔 넣을 값이 없다.
- `SYSID` — 넣는 자리(`resources/index.js:676`)와 읽는 자리가 **같은 창**이고,
  그 창은 주소 쿼리에도 `SYSID` 를 넣는다(`:708`). 짝이 맞는다.

### ★조사 중 따로 나온 것 (Electron 45 와 무관한 기존 결함)

`www/floatingMenu/js/handle.js:62` 는 창마다 **떠다니는 메뉴 표식**을 찾는데,
그 표식을 **넣는 자리가 `www` 전체에 한 줄도 없다.**
그래서 그 함수는 **예전부터 창을 하나도 못 찾는다.** 장군님 지시를 받아야 고친다.

### ★조사 중 내가 틀렸던 것

처음엔 「주소에 값이 빠진 창이 8곳」이라 보고했다. **틀렸다 — 2곳이다.**
기계로 훑을 때 **`loadURL` 위 45줄만** 봤는데, 어떤 창은 쿼리 만드는 코드가
**61줄 위**에 있었다. 범위를 200줄로 넓히고 눈으로 확인해 바로잡았다.
→ **범위를 정해 놓고 기계로 훑은 수는 그 범위 밖을 놓친다. 반드시 눈으로 한 번 더 본다.**

## 앞으로 할 것

1. **① 전제 = 2곳**(속성 도움말 작은 창 · 코드 편집기 창)에 주소 쿼리를 넣는다.
2. 그다음 자기 창 16줄 → IPC 보낸 창 3줄 → 남의 창 40줄.
   **새 함수를 만들지 않고** 기존 표준만 쓴다(위 분류 표의 「고치는 방법」 칸).
3. 메인 process 3줄은 **맨 마지막** — 먼저 빼면 전부 멈춘다.

---

# 【이어 씀】 2026-10-28 — ① 코드 편집기 창의 여는 주소에 값 싣기

- 지시: 장군님 「고쳐라」 (TODO ① 착수)

## ①의 대상은 2곳이 아니라 1곳이었다 (정정)

앞서 ①을 「창 2곳」이라 적었다. **1곳이다.**
`fnDialogPopupOpener.js:1230` 은 Text 검색 팝업을 여는 함수 안이지만,
그 함수는 **맨 위(:1178)에서 `textSearchPopup/index.js` 를 부르고 `return` 한다** — 아래는 죽은 코드다.
그리고 실제로 도는 그 파일은 **이미 쿼리를 제대로 싣고 있다.**

★내가 안 본 것: `webPreferences` 를 넣는 줄은 봤지만 **그 위에 `return` 이 있는지 안 봤다.**
★앞으로: 고칠 줄을 찾으면 **그 줄이 도는 코드인지**(위쪽 `return`·주석 여부)를 먼저 본다.

## 고친 자리 — 파일 1개

`www/ws30/ws10_20/Popups/editorPopup_v2/index.js` (코드 편집기 창을 여는 쪽)

`loadURL` 앞에 쿼리를 만들어 싣는다. 값 5개 = `browserkey` · `sessionKey` · `OBJTY` · `USERINFO` · `SYSID`.
본보기는 **이미 잘 도는** `Popups/textSearchPopup/index.js:71` — 새 함수를 만들지 않고 그 모양 그대로 썼다.
`browserkey` 가 비면 `U4ALOG.warn("GUARD_EXIT", ...)` 한 줄을 남긴다(같은 폴더 다른 모듈들과 같은 패턴).

## 검증

- `node --check` 통과
- **화면에서 확인할 수 있는 변화는 아직 0이다** — 받는 쪽(`editorPopup_v2/Popup/index.js:16~18`)이
  여전히 `getWebPreferences()` 를 보고 있다. ②(자기 창 값 읽기)의 그 3줄을 바꿔야 비로소 동작이 바뀐다.
  그래서 **테스트 항목으로 올리지 않았다.**

## ★함정

- ①은 **단독으로는 효과가 0**이다. 창 하나를 살리려면 **①(싣기) + ②(읽기)를 한 덩어리로** 해야 한다.
  아이콘 목록 창(2026-10-28 통과)도 그렇게 한 번에 해서 통과했다.

---

# 【이어 씀】 2026-10-28 — ①의 고칠 자리는 결국 **0곳**이었다 (내 조사가 두 번 틀렸다)

- 지시: 장군님 「진행해」 (②로 넘어가는 중 발견)

## 무엇이 틀렸나

①의 대상이라던 두 자리가 **둘 다 안 도는 코드**였다.

| 자리 | 왜 안 도나 |
|---|---|
| `fnDialogPopupOpener.js:1230` | 그 함수가 **맨 위(:1178)에서 `return`** 한다 |
| `Popups/editorPopup_v2/index.js:91` | **부르는 곳이 전부 주석 처리**돼 있다 (`fnDialogPopupOpener.js:3495~3508`) — 주석 아닌 호출 **0건** |

그리고 **실제로 도는** 코드 편집기 창은 `www/ws30/ws10_20/js/fnEditorPopupOpen.js` 이고,
그 파일은 **이미 쿼리를 싣고 있다**(:130 `QueryString.build`). → ①은 **고칠 것이 없다.**

## 내가 고쳐 놓은 것 (되돌릴지 지시 대기)

안 도는 폴더에 손을 댔다. 동작에는 영향이 없다(아무도 안 부른다). `node --check` 는 둘 다 통과.

- `Popups/editorPopup_v2/index.js` — 여는 주소에 쿼리 5개 싣기
- `Popups/editorPopup_v2/Popup/index.js` — `getWebPreferences()` 대신 주소 쿼리에서 읽기 + 테마 SYSID

## ②의 나머지 파일은 전부 불린다 (이번엔 확인했다)

`helpViewer.js` · `designTreeUiSearchPopup` · `u4aDocPopup` · `ui5CssPopup_v2` ·
`broadcastChannelBindPopup.js` — 전부 `require` 또는 `pathInfo.js` 경로 등록이 있다.
**안 도는 것은 `editorPopup_v2` 한 덩어리뿐이다.**

## ★함정 — 되풀이하지 말 것

**「`getWebPreferences()` 를 쓰는 줄」을 찾는 것만으로는 고칠 자리가 정해지지 않는다.**
그 줄이 **실제로 도는지**를 먼저 봐야 한다. 안 도는 경우가 두 가지였다:

1. 같은 함수 **위쪽에 `return`** 이 있다
2. **부르는 곳이 주석 처리**돼 있다 (파일·폴더째 안 쓰임)

→ 앞으로 전수 조사는 **① 그 줄이 있는 파일이 불리는가**(require·loadJs·pathInfo 등록)
  **② 그 줄 위에 `return` 이 없는가** 를 확인한 뒤에 「대상」이라고 적는다.

---

# 【이어 씀】 2026-10-28 — ②를 뜯어 보니 16줄 중 6줄만 실제 대상이다

- 지시: 장군님 「1 그냥 둬라 / 2는 내용이 뭐냐」
- ①에서 고친 `editorPopup_v2` 2개 파일은 **그냥 두기로 결정**(장군님 2026-10-28). 안 도는 폴더라 동작 영향 0.

## ② 16줄을 한 줄씩 다시 본 결과

| 자리 | 읽는 값 | 그 창 주소에 그 값이 있나 | 판정 |
|---|---|---|---|
| `js/ws_common.js:2798·2799·2883` | browserkey | **있다** (메인 화면 주소에 실린다) | **대상** |
| `ws30/ws10_20/index.js:201·202` | USERINFO | **없다** | **대상 + 전제 필요** |
| `Popups/ui5CssPopup_v2/main/frame.js:313` | browserkey | **미확인** — 여는 자리를 못 찾았다 | 미정 |
| `js/ws_util.js:54·56` | USERINFO | — | **이미 바로 아래에서 쿼리 값으로 덮어쓴다** |
| `design/bindPopupHandler/broadcastChannelBindPopup.js:21` | browserkey | — | **이미 쿼리 fallback 이 있다** |
| `Popups/editorPopup_v2/Popup/index.js:16·17·18` | — | — | **안 도는 코드**(부르는 곳 주석) |
| `Popups/designTreeUiSearchPopup/index.js:17` | — | — | **안 돈다** — 여는 함수가 `fnDialogPopupOpener.js:1380~` 에서 통째로 주석 |
| `Popups/u4aDocPopup/frame.js:37·38` | — | — | **안 돈다** — `U4ADOCU` 경로를 쓰는 곳이 `pathInfo.js` 등록 말고 **0건** |
| `help/…/helpViewer.js:73` | browserkey | — | **②가 아니라 ④** — `oOpener.webContents` 를 읽는다(남의 창). 분류 오류 |

## 메인 화면 주소에 실리는 값 (실측)

`ServerList_v2/ServerList.js:3108` · `intro.js:335` · `ws30/resources/index.js:717` 세 곳이 메인 화면을 연다.
싣는 값 = `browserkey` · `sessionKey` · `OBJTY`("MAIN") · `SYSID` · `THEME` · `BGCOL`.
**`USERINFO` 는 없다** — 그래서 `ws30/ws10_20/index.js:202` 는 여는 쪽 3곳을 먼저 손봐야 한다.

## ★이 전수 조사의 구멍 — 다른 창도 반드시 이것부터

처음 만든 62줄 목록은 **「`getWebPreferences()` 를 쓰는 줄」만 모은 것**이고,
**그 줄이 실제로 도는지**는 보지 않았다. 그래서 지금까지 **8줄(4곳)** 이 안 도는 코드로 드러났다.

**안 도는 유형 3가지 (전부 실제로 나왔다)**
1. 같은 함수 **위쪽에 `return`** 이 있다 (Text 검색 팝업)
2. **부르는 곳이 주석 처리**돼 있다 (코드 편집기 창 · 트리 UI 검색 창)
3. **경로만 `pathInfo.js` 에 등록**돼 있고 그 키를 쓰는 곳이 0건이다 (기술 문서 창)

→ **③④⑤ 도 고치기 전에 같은 검문을 먼저 돌려야 한다.**
  ★`pathInfo.js` 에 경로가 있다 ≠ 그 창을 쓴다. 이것으로 「불린다」고 판정하면 또 틀린다
  (나는 2026-10-28 이 턴에서 실제로 그렇게 판정했고 바로 뒤집혔다).

---

# 【이어 씀】 2026-10-28 — ③④⑤ 도 자리마다 소스 링크를 걸고 「도는 코드인가」를 미리 걸렀다

- 지시: 장군님 「소스 위치 링크 각 항목별로 걸어라」

## 한 일

TODO 의 ②③④⑤ 를 **소항목(②-1 … ⑤-2)으로 펼치고 자리마다 소스 링크**를 걸었다.
각 자리가 **어느 함수 안인지** 찾고, **그 함수를 부르는 곳이 있는지** 세어 「도는 코드」만 남겼다.

## ④ 에서 새로 걸러낸 안 도는 코드 (3줄)

`www/ws30/resources/index.js:2635·2643·2648` — 그 자리가 든 함수 `getSameBrowsers`(:2614) 는
**정의만 있고 부르는 곳이 0건**이다. → ④ 대상에서 뺐다.

## 확인한 함수 15개의 호출 건수 (정의 포함)

도는 것 = `gfn_close`(7) · `_findOpenedHelpWindow`(3) · `getOpenedChildWindows`(6) ·
`_checkExamPopup`(3) · `_focusOnAIBrowser`(3) · `getCheckAlreadyOpenWindow`(42) ·
`getSiblingWindows`(4) · `fnGetSameBrowsers`(6) · `fnGetSameBrowsersAll`(2) ·
`fnChildWindowClose`(22) · `fnIsBlockingDialogOpen`(9) · `fnSetFocusServerList`(5) ·
`closeAllCurrWinDependentPopups`(4) · `fnIpcMain_Find_Data_Refresh`(4)
안 도는 것 = `getSameBrowsers`(1 = 정의뿐)

## ★함정

- `getCheckAlreadyOpenWindow`(ws_common.js:2738~2815) 한 함수 안에 **②(자기 창)와 ④(남의 창)가 섞여 있다.**
  고칠 때 자기 창은 `location.href`, 남의 창은 `oWin.getURL()` 로 **서로 다르게** 읽어야 한다.
- ④-13(`floatingMenu/js/handle.js:60`)은 표식을 **넣는 자리가 아예 없어** 고쳐도 안 된다 — TODO 1-19 결정이 먼저다.

---

# 【이어 씀】 2026-10-28 — ②-1 · ②-2 를 고쳤다 (④-1·④-2 와 한 쌍이라 같이)

- 지시: 장군님 「②-1, ②-2 진행」

## 쪼개서는 고칠 수 없었다 (내 분류 오류)

TODO 에서 ②(자기 창)와 ④(남의 창)로 나눠 적었지만, **같은 함수 안의 한 쌍**이었다.

| 함수 | 자기 창 | 남의 창 |
|---|---|---|
| `getCheckAlreadyOpenWindow2` (ws_common.js) | ②-1 | ④-1 로 적었던 자리 |
| `getSiblingWindows` (ws_common.js) | ②-2 | ④-2 로 적었던 자리 |

자기 키만 주소에서 읽으면 비교가 `"키" !== undefined` 가 되어 **전부 건너뛴다** —
지금과 똑같이 하나도 못 찾는다. 그래서 **쌍으로** 고쳤다.

## 고친 자리 — `www/ws30/ws10_20/js/ws_common.js` 한 파일

둘 다 `getWebPreferences()` 대신 **그 창의 주소 쿼리**를 본다.

```js
parent.WSUTIL.QueryString.parse(oWin.webContents.getURL())
```

★`location.href` 를 쓰지 않았다 — 이 파일은 `parent.REMOTE` 를 쓰는 **iframe 안**에서 돌아서
`location.href` 는 iframe 자신의 주소다. 창 주소는 `webContents.getURL()` 로 읽는다.
남의 창을 읽는 선례(`ServerList.js:3588`)와 같은 방식이라 자기 창·남의 창이 한 모양이 된다.

`browserkey` 가 비면 `U4ALOG.warn("값이 없어 그만둠", …)` 을 남긴다(기존 로그 문구의 대상 이름만 고쳤다).

## 영향도 (고치기 전 전수)

- `getCheckAlreadyOpenWindow2` 를 부르는 곳 = **24곳**. `getSiblingWindows` = **2곳**
  (`ws_fn_02.js:2142` 자식창 일괄 닫기 · `:2245`). **반환값 형태가 안 바뀌므로 호출처는 손대지 않았다.**
- **창을 여는 48곳 전부가 주소에 `OBJTY` 를 싣는지 확인했다.** 안 싣는 곳 6개는:
  - `ws_util.js` — 주석 안 예제다(창을 여는 코드가 아니다)
  - 화면 녹화 창 5개 — `webPreferences` 에도 `OBJTY`·`browserkey` 를 **안 넣는다**
    → 지금도 형제로 안 잡히므로 **이 수정으로 달라지는 것이 없다**(퇴보 없음)
- `node --check` 통과

## 아직 안 고친 같은 파일의 자리

`ws_common.js:2738` — 자식 창의 `OBJTY` 만 읽는 순수 ④ 자리다(자기 키 비교가 없다). ④ 지시 때 고친다.

## ★함정

- **ws_common.js 는 iframe 안에서 돈다.** 창에 실린 값을 `location.href` 로 읽으면 안 된다.
  `REMOTE.getCurrentWindow().webContents.getURL()` 을 쓴다.
- 자기 키와 남의 키를 **다른 방법으로 읽으면 비교가 영영 안 맞는다.** 둘을 반드시 같이 바꾼다.

## 검증 결과 — 통과 (2026-10-28)

장군님이 눌러 확인하셨다.

| 코드 | 무엇을 봤나 | 결과 |
|---|---|---|
| E1 | 같은 별창을 두 번 열면 새 창이 안 뜨고 이미 뜬 창이 앞으로 온다 | **통과** |
| E2 | WS20 에서 첫 화면으로 돌아가면 열어 둔 별창이 같이 닫힌다 | **통과** |

→ `getCheckAlreadyOpenWindow2` 와 `getSiblingWindows` 두 함수가 주소 쿼리로 제대로 돈다.
   「뒤로가기 때 별창이 안 닫히던 것」이 이것으로 낫는다.

---

# 【이어 씀】 2026-10-28 — ②-3(CSS 팝업) 호출처 조사

- 지시: 장군님 「②-3 어디서 호출하는건지 호출처좀 먼저 조사해」

## ②-3 도 ④-12 와 같은 함수 안의 한 쌍이다

자리 = `Popups/ui5CssPopup_v2/main/frame.js:313` · 함수 = `oAPP.fn.getOpenedChildWindows`(:308~353)
자기 창 키(:313)와 남의 창 값(:339~341)을 **같은 함수에서 비교**한다 → ②-1·②-2 와 똑같이 **쌍으로** 고쳐야 한다.

## 부르는 곳 — 4곳 (전수)

| 자리 | 함수 | 무엇을 할 때 |
|---|---|---|
| `main/frame.js:364` | `_closeChildWindows` | **이 창이 닫힐 때** 자식 창을 같이 닫는다 |
| `main/views/control.js:721` | (자식창 띄우기 안) | **「이미 열림」 판정** |
| `main/views/control.js:1735` | `clearAllChildWindow` | **자식창 전체 닫기** |
| `main/views/control.js:1817` | `setFocusChildWindow` | 자식 창에 포커스 주기 |

자식 창 = **미리보기 새창 · Other CSS 가이드 창**.
반환값은 `BrowserWindow` 배열 — 형태가 안 바뀌므로 **호출처 4곳은 손댈 필요가 없다.**

## 전제 확인 — 자식 창 주소에 값이 실린다

`main/views/control.js:898` · `:1057` 두 자리에서 자식 창을 열고, 둘 다
`browserkey` · `sessionKey` · `OBJTY`(= `sChildKey`) · `USERINFO` 를 **주소 쿼리에 싣는다.**
→ 읽는 쪽만 바꾸면 된다. **전제 작업이 없다.**

## 판정 기준에 쓰는 규칙 (고칠 때 깨지 말 것)

이 함수는 자식 창을 이렇게 가린다:
1. `browserkey` 가 이 창과 같다
2. `OBJTY` 가 **그 `browserkey` 로 시작한다** (`indexOf(sBrowsKey) !== 0` 이면 버린다)

★2번은 이 창의 자식만 골라내는 장치다(자식 OBJTY = `BROWSKEY` + 메뉴 KEY).
  주소에서 읽어도 **이 두 조건을 그대로** 두어야 한다.

## 고쳤다 (같은 턴, 장군님 「쌍으로 고쳐라」)

`Popups/ui5CssPopup_v2/main/frame.js` 한 파일 · `getOpenedChildWindows` 안 두 자리.

| 무엇 | 종전 | 바뀜 |
|---|---|---|
| 자기 창 키 | `CURRWIN.webContents.getWebPreferences().browserkey` (try/catch) | **파일 31행에 이미 있던 `oQueryParams.browserkey`** |
| 남의 창 값 | `oWin.webContents.getWebPreferences()` | `WSUTIL.QueryString.parse(oWin.webContents.getURL())` |

★이 파일은 **창의 최상위 문서**이고(iframe 이 아니다 — `index.js` 가 iframe 쪽이다)
  31행에서 **이미 `WSUTIL.QueryString.parse(location.href)` 를 해 두고 있었다.**
  그래서 자기 창 키는 **새로 파싱하지 않고 그것을 썼다**(try/catch 도 필요 없어져 지웠다).
가리는 기준 두 개(① browserkey 가 같다 ② OBJTY 가 그 browserkey 로 시작한다)는 **그대로 두었다.**

- `node --check` 통과 · 이 파일에 `getWebPreferences()` 호출 **0건**(주석 1줄만 설명용)
- 테스트 항목 E3 · E4 · E5 를 TODO 에 올렸다

---

# 【이어 씀】 2026-10-28 — UI5 Predefined Css 창의 미리보기만 아직 `file://` 로 뜨고 있었다

- 지시: 장군님 「frame.html 로드하는데 아직도 파일 프로토콜로 로드하는 게 있나봐 지금 커스텀 프로토콜로 변경했잖아」
- 근거: 장군님이 보여 주신 Network 탭 — Request URL 이 `file:///C:/…/ui5CssPopup_v2/detail/frame.html?browskey=…&mid=M1`

## 원인 — 한 자리

`Popups/ui5CssPopup_v2/main/views/control.js:643`

```js
oPrevFrame.src = `${C_DETAIL_HTML_PATH}?browskey=…&mid=…`;   // ← 파일 경로를 그대로 넣었다
```

`C_DETAIL_HTML_PATH`(:51) 는 `PATH.join(...)` 으로 만든 **OS 파일 경로**다.
그것을 `iframe.src` 에 그대로 넣으면 브라우저가 `file://` 로 연다.

**같은 페이지를 별창으로 여는 자리(:912 · :1073)는 `u4aToAppUrl` 을 거쳐 `u4a-ws://` 로 뜬다.**
즉 **인팝업 미리보기(iframe) 한 자리만** 빠져 있었다.

## 왜 문제인가

창은 `u4a-ws://`, 그 안 iframe 만 `file://` → **서로 다른 origin**.
`others/M1/index.js:97` · `M2/index.js:99` 가 `browskey + mid` 로 **BroadcastChannel** 을 만드는데,
BroadcastChannel 은 **origin 별로 갈린다** — 다른 origin 이면 서로 안 들린다.
★다만 **화면에서 무엇이 안 되는지는 제가 눈으로 확인하지 않았다**(미확인).

## 고친 자리

```js
let sPrevUrl = `${C_DETAIL_HTML_PATH}?browskey=…&mid=…`;
oPrevFrame.src = parent.REMOTE.getGlobal("u4aToAppUrl")(sPrevUrl);
```

`toAppUrl`(`electron/lib/protocol/ws_app_protocol.js:294`)은 `_getTail` 로 **쿼리를 보존**한다 — 확인했다.
`others/M1·M2` 의 `oIframe.src = "frame.html?…"` 는 **상대 경로**라 이 수정으로 같이 `u4a-ws://` 가 된다.

- ES 모듈이라 `.mjs` 로 복사해 `node --check` 통과

## ★같이 발견한 것 (고치지 않았다 — 지시 대기)

`Popups/ui5CssPopup_v2/main/frame.js:256` — 로고 주소를 만드는 **괄호가 잘못돼 있다.**

```js
REMOTE.getGlobal("u4aToAppUrl")(PATH.join)(APPPATH, "img", "logo.png")
```

`u4aToAppUrl` 에 **함수 `PATH.join` 자체**를 넘기고 그 반환값을 다시 호출한다.
맞는 모양은 `u4aToAppUrl(PATH.join(APPPATH, "img", "logo.png"))` 다.
`try/catch` 로 감싸여 있어 **조용히 실패**한다 → 그 창의 로고가 안 뜬다.

## ★함정

- **`iframe.src` 에 `PATH.join(...)` 결과를 넣으면 `file://` 로 뜬다.** 창(`loadURL`)만 고치면 안 된다.
- 같은 페이지라도 **별창으로 열 때와 iframe 으로 넣을 때가 다른 코드**다. 한쪽만 고치면 반쪽이다.
- BroadcastChannel·localStorage·`parent.` 접근은 전부 **origin 이 같아야** 통한다.

## 검증 결과 — 통과 (2026-10-28) · ②-3(CSS 팝업) · ④-12 · 미리보기 프로토콜

장군님이 눌러 확인하셨다.

| 코드 | 무엇을 봤나 | 결과 |
|---|---|---|
| E3 | 같은 하위 창을 두 번 열면 새 창이 안 뜨고 그 창이 앞으로 온다 | **통과** |
| E4 | 하위 창 전체 닫기가 동작한다 | **통과** |
| E5 | 그 창을 닫으면 하위 창도 같이 닫힌다 | **통과** |
| E6 | 미리보기가 커스텀 프로토콜(`u4a-ws://`)로 뜬다 | **통과** |

→ `getOpenedChildWindows` 가 주소 쿼리로 제대로 돈다. 미리보기 iframe 의 origin 도 창과 같아졌다.

---

# 【이어 씀】 2026-10-28 — ②-3(메인 화면 사용자 정보) · ② 전체 끝

- 지시: 장군님 「1번 하고 끝나면 2번 진행하자」(TODO ②-3)

## 내 앞선 판정이 틀렸다 — 여는 쪽은 고칠 필요가 없었다

TODO 에 「여는 쪽 3곳에 USERINFO 를 먼저 넣어야」라고 적었다. **아니다.**

받는 자리(`ws30/ws10_20/index.js:201`) **바로 28줄 위(:173)** 에서
**같은 값을 메타 정보로 이미 받고 있었다** — `oMetadata.USERINFO`.
새 창을 띄우는 `ws30/resources/index.js:766` 이 `oMetadata.USERINFO = parent.getUserInfo()` 로
**둘 다 보내고 있었다**(창 설정 칸 + 메타 정보 IPC).

→ **창 설정 칸을 볼 필요가 없다.** 받은 것을 그대로 쓰면 된다.

★내가 안 본 것: **고칠 줄의 위쪽**. 자리만 보고 그 앞에서 무엇을 이미 받는지 안 읽었다.
★앞으로: 「이 값을 어디서 가져오나」를 고치기 전에 **같은 값이 이미 그 함수 안에 있는지** 위부터 읽는다.

## 고친 자리 — `www/ws30/ws10_20/index.js:197~207`

```js
const CURRWIN = REMOTE.getCurrentWindow();   // 아래 setTitle 에서 쓰므로 남김

if (oMetadata.USERINFO) {
    setProcessEnvUserInfo(oMetadata.USERINFO);
}
```

`WEBCON` · `WEBPREF` · `USERINFO` 세 변수는 이 자리에서만 쓰여서 **같이 뺐다**(전수 확인).

## ★동작이 하나 달라진다 (일부러)

종전에는 `webPreferences.USERINFO` 를 **「새 Workspace 창 열기」로 띄운 창만** 받았다
(`intro.js` · `ServerList_v2/ServerList.js` 가 여는 **첫 메인 창은 그 값을 안 넣는다** — 실측).
이제는 메타 정보로 받으므로 **첫 메인 창에서도 `process.USERINFO` 가 채워진다.**

`setProcessEnvUserInfo`(`ws30/resources/index.js:2676`)는 `process.USERINFO` 를 넣고
그 시스템·언어로 **메시지 글 꺼내는 함수**(`fnGetMsgClsText`)를 만든다.
즉 **첫 메인 창의 메시지 문구가 제대로 나오게 되는 쪽**이다 — 그래서 테스트 항목 E8 을 올렸다.

## ② 전체 끝 (2026-10-28)

| 자리 | 결과 |
|---|---|
| ②-1 `ws_common.js` 「이미 열려 있음」 판정 | ✅ 통과(E1) |
| ②-2 `ws_common.js` 형제 창 모으기 | ✅ 통과(E2) |
| ②-3(옛 번호) CSS 팝업 | ✅ 통과(E3~E5) |
| ②-3 메인 화면 사용자 정보 | 이번 수정 · 테스트 E8 |
| 나머지 8줄 | **안 도는 코드**라 대상 아님 |

`node --check` 통과 · 이 파일에 `getWebPreferences()` 호출 **0건**.

## ②-3 검증 결과 — 통과 (2026-10-28)

장군님 확인: 「새창 열어도 잘 된다」 → **E8 통과. ② 전체 완료.**

★E8 의 진짜 확인 포인트는 **「새 Workspace 창 열기」가 터지지 않는 것**이었다.
 그 창을 띄우는 `ws30/resources/index.js:676` 이 `process.USERINFO.SYSID` 를 읽으므로,
 그 값이 비면 **거기서 TypeError 로 터진다**(노션 오류 70 과 같은 증상).

★내가 테스트 항목을 **「별창을 하나 열어 글자가 정상인지」** 라고 모호하게 썼다 — 장군님이
 「무슨 별창?」 이라고 물으셔야 했다. **고친 코드가 실제로 쓰이는 화면 조작 하나**를 집어서 써야 한다.

---

# 【이어 씀】 2026-10-28 — ③(IPC 를 보낸 창 값) · 공통 함수 `QueryString.ofWindow` 신설

- 지시: 장군님 「getWebPreferences() 이거 작업부터 해야되」(③④⑤ 를 1-21 보다 먼저)

## 공통으로 뺐다 (복붙 금지 규칙 적용)

같은 일(**그 창에 실린 값을 주소 쿼리에서 읽기**)을 ③ 에서 2번, ④ 에서 30줄 넘게 한다.
그래서 장군님 지시(「공통적인 부분은 WSUTIL 같은 공통에다가 만들어서 처리를 해야지」)대로
**`WSUTIL.QueryString.ofWindow(창 또는 webContents)`** 를 새로 만들었다(`js/ws_util.js`).

- `BrowserWindow` 도 `webContents` 도 받는다(`oTarget.webContents` 가 있으면 그걸 쓴다)
- `getURL()` 이 없거나 던지면 **빈 객체**를 돌려준다(부르는 쪽이 `.browserkey` 로 바로 읽어도 안 터진다)
- 주석에 **왜 `location.href` 를 쓰면 안 되는지**를 적었다 — iframe 안에서는 창 주소가 아니다

★④ 를 할 때 이 함수를 쓴다. 창마다 복사하지 않는다.

## 고친 자리 — `js/fnFindPopupOpen.js` 2곳

`fnIpcMain_Find_Data_Refresh`(:235~) 안에서 **IPC 를 보낸 창의 키**를 구하던 자리.

| 종전 | 바뀜 |
|---|---|
| `events.sender.getWebPreferences().browserkey` | `parent.WSUTIL.QueryString.ofWindow(oSender).browserkey` |
| (catch 안) 같은 코드 | 같은 공통 함수 |

키가 비면 `U4ALOG.warn("값이 없어 그만둠", …)` 을 남긴다 — 채널 이름이 `undefined--…` 가 되면
Find 창이 못 받아 **처리중 표시가 영영 안 꺼지기** 때문이다.

## 전제·영향도 (고치기 전 확인)

- Find 창을 여는 쪽(`:113`)이 주소에 `browserkey` 를 **싣는다** ✅
- Find 창 **안**(`Popups/findPopup/findFrame.js:42~46`)은 **이미 주소 쿼리에서 읽고 있다** ✅
  → 보내는 쪽은 멀쩡했고 **받는 쪽만** 없어진 함수를 보고 있었다. 이 수정으로 왕복이 완성된다.
- 이 파일의 `BROWSKEY`(:62)는 **`fnFindPopupOpen` 안의 지역 상수**라 핸들러에서 쓸 수 없다 —
  그래서 보낸 창의 주소를 읽는 것이 맞다(`parent.getBrowserKey()` 는 장군님이 걷어낼 대상이라 하셨다).
- `node --check` 통과(ws_util.js · fnFindPopupOpen.js) · 이 파일에 `getWebPreferences()` 호출 **0건**

## ★함정

- IPC 핸들러 안에서 **창을 여는 함수의 지역 변수**(`BROWSKEY`)를 쓸 수 없다. 보낸 창에서 직접 읽어야 한다.
- 왕복(보내기 → 받기)은 **양쪽을 다 봐야** 한다. 한쪽만 고치면 채널 이름이 어긋나 조용히 안 받는다.

---

# 【이어 씀】 2026-10-28 — ④(남의 창 값) 11줄 · 공통 함수 이름 `parseWindow` 로 확정

- 지시: 장군님 「getWebPreferences() 이거 작업부터 해야되」

## 공통 함수 이름을 바꿨다

`QueryString.ofWindow` → **`QueryString.parseWindow`**.
기존 `build(url, params)` · `parse(url)` 과 **동사로 시작하는 한 쌍**이 되게 맞췄다.
(장군님은 「없는 함수를 부르는 줄 알았다」고 하셨다 — **새로 만든 함수는 만들 때 먼저 알린다.**)

## 고친 자리 — 6파일 11줄

| 파일 | 자리 | 무엇을 보나 |
|---|---|---|
| `js/ws_fn_02.js` | 1832 · 1894 · 2162 · 2267 | 같은 브라우저 창 모으기 · 자식창 일괄 닫기 · 보이기/숨기기 |
| `js/ws_fn_04.js` | 1026 · 1658 | 서버리스트 포커스 · 딸린 팝업 전부 닫기 |
| `js/ws_fn_01.js` | 100 | 예제 열기 창 찾기 |
| `js/ws_fn_05.js` | 32 | AI 창 포커스 |
| `js/ws_common.js` | 2738 | 자식 창의 OBJTY |
| `help/…/helpViewer.js` | 73 · 104 · 244 | 도움말 창 — **여는 주소에 값 싣기까지** |

전부 `WSUTIL.QueryString.parseWindow(창 또는 webContents)` 로 바꿨다.

## ★함정 1 — `partition` 은 주소에 **`sessionKey`** 라는 다른 이름으로 실린다

```
webPreferences.partition   ↔  쿼리 sessionKey      ← 이름이 다르다!
webPreferences.browserkey  ↔  쿼리 browserkey
webPreferences.OBJTY       ↔  쿼리 OBJTY
webPreferences.SYSID       ↔  쿼리 SYSID
```

그냥 치환하면 `partition` 이 **조용히 undefined** 가 된다. 읽는 자리 2곳(`ws_fn_02.js:1842` · `:1906`,
`ws_fn_04.js:1663`)을 `sessionKey` 로 같이 고쳤다. **`resources/index.js:2648` 은 안 도는 코드라 그대로.**

## ★함정 2 — 도움말 창은 주소에 값을 **안 싣고 있었다**

`helpViewer.js:244` 가 `u4aToAppUrl(…, { query: { options } })` 로 **`options` 만** 실었다.
`webPreferences` 에만 `OBJTY`·`browserkey` 를 넣고 있어서, 읽는 쪽만 고치면 **그 창을 영영 못 찾는다.**
→ 같은 파일에서 **여는 쪽 쿼리에 `OBJTY`·`browserkey` 를 추가**했다.
★이 파일은 **도움말 창 안이 아니라 창을 여는 쪽(메인 창)에서 돈다** — `new BrowserWindow`(:193)가 여기 있다.
  그래서 `_getOpenerBrowserKey`(:73)의 `getCurrentWindow()` 는 **메인 창**이고, 그 주소엔 키가 실려 있다.

## ★함정 3 — 파일마다 `WSUTIL` 을 가져오는 방법이 다르다

- `ws_fn_02` · `ws_fn_01` · `ws_fn_05` · `ws_common` = `parent.WSUTIL`
- `ws_fn_04` = 자기 파일 안 상수 `WSUTIL`(:20) — **그것을 쓰도록 맞췄다**
- `helpViewer.js` = **아예 없었다** → `app.getAppPath()` 로 `pathInfo.js` 를 거쳐 새로 들여왔다

## 손대지 않은 자리 (까닭)

| 자리 | 까닭 |
|---|---|
| `floatingMenu/js/handle.js:60` | 찾는 표식을 **넣는 자리가 없다** — TODO 1-19 결정 대기 |
| `ws30/resources/index.js:2635` | **안 도는 코드**(`getSameBrowsers` 를 부르는 곳 0건) |
| `design/bindPopupHandler/broadcastChannelBindPopup.js:21` | `?.` 로 방어돼 있고 **쿼리 fallback 이 이미 있다** |
| `Popups/designTreeUiSearchPopup/index.js:17` · `Popups/u4aDocPopup/frame.js:37` | **안 도는 창** |
| `js/ws_util.js:54` · `electron/main.js:448·650·651` | ⑤ 에서 함께 다룬다 |

## ⑤ 를 하기 전에 반드시 — 아직 터질 수 있는 자리 2곳

`electron/main.js:448` 이 없어진 함수를 **되살려 붙이고** 있어서 지금은 아무 데서도 안 터진다.
그것을 걷어내면 **아래 두 곳이 TypeError 로 터진다** — ⑤ 착수 때 같이 고쳐야 한다.

1. `js/ws_util.js:54` — `WEBCON.getWebPreferences()` (방어 없음)
2. `floatingMenu/js/handle.js:60` — **도는 코드다**(1-19 와 별개로 터짐 방지는 필요)

## 검증

- `node --check` 7파일 통과
- ④ 대상 자리에 `getWebPreferences()` 호출 **0건**
