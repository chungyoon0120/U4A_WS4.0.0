# `file://` 로 뜨거나 받아 오던 자리 — 전수 조사와 수정 6곳

- 날짜: 2026-10-29
- 지시: 장군님 「이거 우선 파일 프로토콜 전수조사해서 먼저 작업한 이후에 해야할거 같은데 이거 군데군데 계속나오는데..」
- 고친 자리: **6곳**. 보류 1곳.

## 증상

USP 편집기에서 빨간 오류가 줄줄이.

```
Uncaught SecurityError: Failed to read a named property 'PATH' from 'Window':
Blocked a frame with origin "file://" from accessing a cross-origin frame.
index.html?PARAMS=…EDITPAGE1…:133
```

부모 창은 `u4a-ws://` 인데 그 안 iframe 만 `file://` 로 떠서, 부모의 값(`PATH` 등)을 못 읽는다.

## 내 전수 조사가 계속 샌 이유 — **변수를 거치면 grep 에 안 걸린다**

```js
var sEditorIndexPath = PATH.join(PATHINFO.USP_ROOT, "monaco", "index.html");  // 생경로
IFR.src = sEditorIndexPath + "?PARAMS=" + sQuery;                             // 여기만 보면 안 보인다
```

`grep ".src.*PATH.join"` 으로는 절대 안 잡힌다. 10-28·10-29 에 「워커 4곳 끝」·「Monaco 5곳」이라고
보고한 것이 **둘 다 틀렸던 것도 같은 이유**다.

### 제대로 하는 법 — 스크립트로 변수 출처까지 따라간다

스크래치패드 `scan_addr.py` 로 만들었다. 하는 일:
1. 주소 자리를 전부 뽑는다 — `.src=` · `loadURL(` · `loadFile(` · `new Worker(` · `await import(` · `window.open(`
2. 인자가 **변수면 그 변수에 값을 넣는 줄**을 같은 파일에서 찾는다
3. 그 줄에 `PATH.join` · `APPPATH` · `PATHINFO.` · `resourcesPath` · `getPath(` · `file:///` 가 있으면 걸린 것
4. `u4aToAppUrl` · `https:` · `data:` 로 시작하는 것은 뺀다

결과 **54건**. 그중 38건은 `await import(...)`(아래) 이고, 실제 문제는 아래 표다.

## 고친 6곳

| 자리 | 무엇 | 지금까지 |
|---|---|---|
| `js/usp/ws_html5_usp_editor.js:336` | **USP 편집기 iframe** | 생경로 → `file://` 로 떠서 **터짐** |
| `js/usp/ws_html5_usp.js:2385` | USP 첫 화면 그림(`intro.png`) | 생경로를 `img src` 에 |
| `ServerList_v2/ServerList.js:3951` `_toFileUrl` | **서버 목록 로고 · 정보 창** | `file:///` 직접 생성 |
| `ws10_20/Login/Login.js:139` `_toFileUrl` | **로그인 화면 로고** | `file:///` 직접 생성 |
| `js/ws_util.js:1143` | **아이콘 글꼴 루트**(UI5 IconPool) | `file:///` 직접 생성 |
| `Popups/bindPopup/index.js:204` `pathToFileUrl` | 바인딩 창 아이콘 글꼴 | `file:///` 직접 생성 |

전부 **`REMOTE.getGlobal("u4aToAppUrl")(…)`** 로 바꿨다. 공통 변환이 앱 폴더·앱 데이터 폴더를
알아서 가려 주므로, 아이콘 글꼴처럼 `userData` 아래인 것도 `u4a-ws://data/…` 로 나간다.

## 보류 1곳

`Popups/optionPopup-origin/common/iconFont.js:203` — 같은 `file:///` 생성.
그 파일은 `REMOTE` 에도 `oAPP` 에도 닿지 못하고(`global.OptionPopupUtil` 의 getter 만 쓴다),
폴더 이름이 `-origin` 이라 **지금 도는 코드인지부터 가려야 한다.** TODO 10-7.

## 고칠 것 없다고 판정한 것

- ~~**`await import(...)` 38건** — Node 의 모듈 로더가 처리하므로 OS 경로가 맞다.~~
  ★**2026-10-30 취소 — 이 판정이 틀렸다.** 화면(renderer) 안의 `import()` 는 Node 가 아니라
  **브라우저가 처리**한다 — `nodeIntegration` 이 켜져 있어도 같다. OS 경로를 넘기면
  Chromium 이 `file:///C:/…` 로 바꿔 읽는다. 설치본 Sources 탭에서 `send_action_assist.js` 가
  `file://` 아래 있는 것을 장군님이 보여 주셔 드러났다(`ws_fn_ipc.js:629`).
  「정상으로 떠서 맞다」는 근거도 틀렸다 — `webSecurity: false` 라 **틀려도 떠는 것**이었다.
  실측(2026-10-30, `scratchpad/scan_import.py`): 화면 안의 동적 `import()` **63건** 중
  **OS 경로 47건** · 상대경로 13건 · 못 가린 것 3건.
  고칠 수 있다는 근거: scheme 권한에 `standard: true` 가 있고(`ws_app_protocol.js:154`),
  첫 화면을 그리는 `ws30/ws10_20/index.js:52` 가 **이미 `u4aToAppUrl` 을 거쳐** 돌고 있다.
  ★★**그런데 고칠 이유는 없다**(2026-10-30, 장군님 「상관은 없는걸까? 굳이 커스텀 프로토콜로 안해도?」).
  커스텀 프로토콜로 바꾸는 목적은 **origin 이 달라서 막히는 것**을 푸는 것이고
  (10-28 장군님 지시 — 도움말 창의 Worker 가 막혔다), 그 대상은 **Worker · iframe ·
  BroadcastChannel · localStorage · `parent.` 접근** 다섯 가지다.
  동적 import 로 불러온 모듈은 **그중 어느 것도 아니다** — iframe 이 아니라 **같은 창에서** 돌고,
  전역(`oAPP`)에 그대로 닿는다(설치본에서 `send_action_assist.js` 가 돌고 콘솔 오류 0 — 실측).
  실측(2026-10-30): `import.meta` 쓰는 모듈 **0건** · ES module 안의 `new Worker` **0건** ·
  ES module 안에서 상대경로로 또 import·fetch 하는 것 **0건**. 그래서 체인도 없다.
  ★「나중에 보안을 켜면 47곳이 깨진다」는 제 말도 **근거가 없었다** — 보안을 켜게 된다는
  얘기를 들은 적이 없다(`BrowserWindow-settings.json:14` 에 `webSecurity: false` 가 전역 기본값이다).
  → TODO 에 올렸던 줄(4-14)을 **그날 바로 다시 빼었다.** 고칠 것 **0곳**.
- **도움말 창의 `webview.preload`**(`docMain.html:222`) — Electron 의 `webview.preload` 는
  **파일 경로를 요구한다.** `file://` 가 맞다.
- `intro.js:1319` — UI5 부트 주소. 10-29 에 「대상 아님(죽은 코드)」로 판정했다.
- `lf_toFileUrl`(`help/login/frame.html` · `extopen.js`) · `_fileUrl`(`attrPresetPopup/list` ·
  `pdfviewer` · `mimeRepository`) · `vw_main/control.js` — **이미 `toAppUrl` 을 거친다.**

## 또 밟을 함정

- **전수 조사를 변수 이름으로 하지 말 것.** `.src = 변수` 형태가 제일 흔하고 제일 안 걸린다.
  주소 자리를 먼저 뽑고 **변수의 대입 줄까지 따라가야** 한다(`scan_addr.py` 방식).
- **「OS 경로」와 「주소」를 한 변수에 섞지 말 것.** 파일이 있는지 보는 데는 OS 경로,
  `src`·`loadURL` 에 넣는 데는 주소다. USP 첫 화면 그림이 그 예다 —
  `FS.existsSync` 는 OS 경로로, `IMG.src` 는 주소로.
- `file://` iframe 은 **부모의 전역을 못 읽어** `SecurityError` 로 터진다. 그 오류가 보이면
  그 iframe 의 `src` 를 어떻게 만들었는지부터 본다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 6개 파일 통과, 전수 grep 으로 남은 것 확인.
  테스트 = TODO 1-14(USP 편집기) · 1-17(USP 그림) · 1-18(로고 2곳) · 1-19(정보 창) · 1-20(아이콘).
- 아이콘 글꼴은 `userData` 아래라 **어제 더한 `u4a-ws://data/` host 를 타는 첫 자리**다.
  그것까지 이번 테스트에서 함께 드러난다.

---

# 이어 쓴 것 — 2026-10-30 · 남은 두 가지를 가렸다

지시: 장군님 「그러면 우선 커스텀 프로토콜 관련 대응은 다 끝난건가?」 →
「어짜피 localStorage·indexedDB 이건 사용한 적이 없지 않나?」

## ① 서버 주소를 `path.join` 으로 만드는 자리 — **0건** (TODO 10-3 끝)

`scratchpad/joinsweep.py` 로 `www` 전체의 `PATH.join`·`path.join` **798건**의 첫 인자를
떼어내 종류별로 셌다. 첫 인자가 서버 주소(`https?:` · `SERVPATH` · `sServerPath` 계열)인 것 **0건.**

첫 인자 상위: `APPPATH` 194 · `__dirname` 65 · `designRootPath` 56 · `USERDATA` 52 ·
`POPUP_ROOT` 31 — 전부 OS 경로다. 2026-10-28 「U4A 워크스페이스 정보」 창에서 터졌던 그 병은
그때 고친 3곳이 마지막이었다.

## ② `localStorage`·`indexedDB` 는 origin 이 바뀌어도 **잃을 값이 0** — 제가 틀렸다

**제가 「origin 이 `file://` → `u4a-ws://app` 으로 바뀌어 저장값이 사라진다」고 보고했는데
그 말이 틀렸다.** 장군님이 되물으셔서 드러났다.

### 왜 영향이 없나

`www/intro.js:293`
```js
var SESSKEY = RANDOM.generate(40),
...
oWebPreferences.partition = SESSKEY;        // :312
```

**앱을 켤 때마다 40자 무작위 글자를 partition 으로 만든다.** `persist:` 접두가 없다.
Electron 에서 `persist:` 없는 partition 은 **메모리 session** 이라 앱을 끄면 통째로 사라진다
(이 프로젝트에서 2026-09-11 실측 — `Popups/dataMonitor/Popup/js/index.js:1744` 주석).

| | |
|---|---|
| 앱 한 번 켜 있는 동안, 창끼리 | **공유된다** — 모든 창이 같은 `SESSKEY` 를 받는다 |
| 앱을 껐다 켜면 | **빈 상태로 시작한다** — partition 이 새 무작위 글자다 |
| 그래서 origin 바뀜은 | **영향 0** — 어차피 매번 비어서 시작하므로 잃을 값이 없다 |

### 쓰는 자리 (코드는 쓴다 — 「켜 있는 동안 창끼리 주고받기」 용도)

| 자리 | 무엇 |
|---|---|
| `design/js/insertUIPopop.js:997` · `js/ws_html5_ws20_edit.js:1779`·`1782` | 「Apply Personalized Attributes」 체크 상태 (`U4A_APPLY_P13N_ATTR`) |
| `Popups/bindPopup/index.js:2097`·`2116` · `layoutCustomizing/layoutCustomizing.js:57`·`63` | 바인딩 팝업 레이아웃 |
| `Popups/ui5CssPopup_v2/main/views/control.js` · `detail/js/common.js` | UI5 Predefined Css 고른 목록 |
| `Popups/relese_notes/views/index.js:560` | 릴리즈 노트 창 테마 (`u4a-workspace-theme`) |
| `js/ws_util.js:182`·`392` (`indexedDB.open`) | — |

이 창들은 전부 `fnDialogPopupOpener.js` 계열로 열려 **같은 `SESSKEY` partition** 을 받는다.

## 또 밟을 함정

- **「origin 이 바뀌면 저장값이 사라진다」고 말하기 전에 `partition` 을 먼저 본다.**
  이 앱은 창을 만들 때마다 `partition` 에 무작위 글자를 넣는다 — `persist:` 가 없으면
  localStorage·indexedDB·쿠키가 **앱을 끌 때 통째로 사라진다.** 그래서 origin 이 무엇이든
  다음에 켤 때는 빈 상태다. **grep 으로 `localStorage` 가 몇 군데 나오는지 세는 것만으로는
  판정이 안 된다** — 그 창이 어느 session 에 있는지가 답이다.
- `partition` 을 `persist:` 로 바꾸면 **로그인·쿠키 정책까지 함께 바뀐다.** 앱 전체 정책이므로
  저장값을 남기고 싶다고 손대면 안 된다 — 남겨야 하는 값은 **파일**(`app.getPath("userData")`)에 적는다.
  dataMonitor 가 그 길을 택했다(`u4a-datamon-exclude.json`).

## 설치본 확인 — 2026-10-30 장군님이 빌드해 보셨다

**설치본에서 돈다.** 장군님이 패키징해 실행하셨고 메인 화면이 떴다.
메인 창은 `u4a-ws://app/ws30/ws10_20/index.html` 로 열리므로, 이것이 떴다는 것은
**`u4a-ws://app/` host 가 `app.asar` 안을 읽는다**는 뜻이다
(`_appRoot` = `app.getAppPath()` = 설치본에서는 `<설치 폴더>/resources/app.asar`). 관리자 개발툴 창도 떴다.

★앞서 제가 말한 「설치본에서 깨진다」는 **근거 없는 말이었다.** 확인한 적이 없었다.

### 그래도 아직 안 본 것

- **`u4a-ws://data/` host** (`userData` 아래 — 아이콘 글꼴·p13n 테마·화면 기록). asar 밖이라 길이 다르다.
- asar 안을 **FS 로 읽는** 자리 — `FS.readdirSync`·`FS.existsSync` 는 asar 를 읽을 수 있지만
  **쓰기는 못 한다.** USP 트리 아이콘 목록이 `FS.readdirSync(PATH.join(APP.getAppPath(), "svg"))` 를 쓴다.
