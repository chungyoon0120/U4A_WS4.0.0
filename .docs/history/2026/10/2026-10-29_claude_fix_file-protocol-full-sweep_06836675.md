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

- **`await import(...)` 38건** — Node 의 모듈 로더가 처리하므로 OS 경로가 맞다.
  10-28 에 UI5 Predefined Css 창으로 실측 확인했다(그 창이 생경로 `await import` 를 쓰는데 정상으로 떴다).
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
