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
