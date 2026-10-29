# 아직 파일 프로토콜(`file://`)을 보는 자리 — 전수 조사

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「커스텀 프로토콜로 전환된 이 시점에 아직도 파일 프로토콜을 바라보는 부분이 상당수 있다.
  E11 이 테스트에도 영향이 있어 — 도움말 문서 실행하면 워커를 실행하는데 아직도 파일 프로토콜로 실행하는
  바람에 오류가 발생돼서 실행이 안 된다. 전수 검사해서 커스텀 프로토콜로 전환하는 작업부터 하자」

## 무엇이 문제인가

창은 `u4a-ws://` 로 뜨는데, 그 안에서 `file://` 을 가리키면 **origin 이 다르다.**
origin 이 다르면 막히는 것: **Worker · iframe · BroadcastChannel · localStorage · `parent.` 접근**.
(이미지·글꼴은 `webSecurity` 설정에 따라 보이기도 한다 — 그래서 로고는 보이는데 워커는 막힌다.)

## 찾은 방법 (다음에도 이 순서로)

1. `file:///` · `` `file:// `` 문자열을 만드는 자리
2. `new Worker(` · `new SharedWorker(`
3. `loadFile(`
4. `.src =` 에 `PATH.join(...)` 결과를 넣는 자리
5. `fetch(` · `xhr.open` 에 파일 경로
6. HTML 안에 `src="file` · `href="file`
7. 찾은 자리마다 **그 함수가 실제로 불리는지**(지난번 교훈)

## 대상 7곳

| 번호 | 자리 | 무엇 |
|:---:|---|---|
| F1 | `help/u4a_helpdoc/main.js:487` | `new Worker(PATH.join(...))` — **E11 이 여기서 막힌다** |
| F2 | `floatingMenu/js/handle.js:126` | `loadURL("file://…/floatingMenu/index.html")` — **창 자체** |
| F3 | `intro.js:1319` | 탑재 UI5 라이브러리 `resourceUrl` |
| F4 | `ws30/ws10_20/js/ws_util.js:1140` | 아이콘 글꼴 `fontURI` |
| F5 | `ws30/ws10_20/Login/Login.js:141`(쓰는 곳 :360) | 로고 그림 |
| F6 | `ServerList_v2/ServerList.js:3953`(쓰는 곳 :1834 로고 · **:3562 정보 창 iframe**) | |
| F7 | `ws30/ws10_20/Popups/bindPopup/index.js:210`(쓰는 곳 :254) | 파일 경로를 주소로 |

## 대상이 아닌 것

| 자리 | 까닭 |
|---|---|
| `Popups/optionPopup-origin/common/iconFont.js:203` | **아무도 안 부른다**(폴더 밖 참조 0건) |
| `www/js/aceeditor/**` | **남의 라이브러리** — 한 글자도 안 고친다(규칙) |
| `ws_html5_ws20_prev.js:30` | 주석 |
| `electron/lib/protocol/ws_app_protocol.js:313·318` | 받는 쪽(`file:` 를 알아보고 변환하는 코드) |

## 이미 올바른 자리 (참고)

`help/login/frame.html:95` · `ws30/ws10_20/extopen.js:45` · `design/attrPresetPopup/list/index.js:90`
— 함수 이름은 `toFileUrl`·`_fileUrl` 이지만 **속은 `u4aToAppUrl` 이다.** 이름만 보고 판단하면 틀린다.

## ★함정

- **이름이 `toFileUrl` 이라고 `file://` 을 만드는 게 아니다.** 반드시 함수 **속**을 본다.
- **이미지가 보인다고 괜찮은 게 아니다** — 같은 `file://` 이라도 워커·iframe 은 막힌다.

---

# 【다시 함】 2026-10-28 — 앞의 7곳은 틀렸다. 전수로 다시 했다

- 지적: 장군님 「파일 프로토콜로 되어있는 부분 소스 전수 검사 한거야? 별창 팝업 내부 소스까지?」

## 앞 조사가 왜 모자랐나

**패턴 몇 개만 grep 했다.** 빠진 것:
1. **경로와 사용이 두 줄로 나뉜 것** — E11 의 워커가 바로 그랬다(485행 경로 · 487행 `new Worker`)
2. **`await import(생경로)`** — `.analy/20` 에 이미 적혀 있는 함정인데 안 봤다
3. `importScripts` · `window.open` · `new URL`

## 다시 한 방법 (이게 전수다)

**「주소를 여는 자리」를 값과 무관하게 전부 뽑고**, 인자가 변수면 **선언된 줄까지 따라가** 가렸다.

- 자리 = `new Worker(` · `new SharedWorker(` · `importScripts(` · `loadURL(` · `loadFile(` ·
  `await import(` · `window.open(`
- 제외 = `node_modules` · `aceeditor`(남의 라이브러리) · `_` 로 시작 · `(deprecated)` ·
  `optionPopup-origin`(아무도 안 부름)

**결과: 주소를 여는 자리 124건** · 그중 `u4aToAppUrl` 확인됨 53 · 상대 경로라 안전 7 ·
**확인 필요 62**(그중 `"./control.js"` 류 상대 경로 리터럴 약 8을 빼면 **약 54**)

## 묶음

| 묶음 | 건수 | 자리 |
|---|---:|---|
| **W** 워커 | 4 | `help/u4a_helpdoc/main.js:487`(★E11) · `lib/ws/electron-updater-sap.js:132` · `lib/ws/SupportPackageChecker/index.js:528` · `Popups/iconPrevPopup/runtime.js:1915` |
| **L** 창 열기 | 3 | `floatingMenu/js/handle.js:128` · `u4a-intro/themes/seasons/index.js:116` · `Popups/relese_notes/index.js:207` |
| **I** 동적 import | 약 47 | `design/js/uiAttributeArea.js` 8곳 · `design/js/main.js` · `design/attrContextMenu/**` · `Popups/bindPopup/**` · `Popups/findPopup/**` · `Popups/ui5CssPopup_v2/**` · `js/ipc/ws_fn_ipc.js` 등 |
| **U** `file://` 직접 | 5 | `floatingMenu/js/handle.js:126` · `intro.js:1319` · `ws_util.js:1140` · `Login/Login.js:141` · `ServerList_v2/ServerList.js:3953` · `Popups/bindPopup/index.js:210` |

## ★아직 못 가린 것 (판정 안 함)

**I(동적 import)가 지금 실제로 막히는지 확인하지 못했다.**
`.analy/20` 은 「막힌다」고 적지만, **지금 WS20 과 별창들이 정상으로 뜬다** — design 영역이 그 import 를
수십 곳 쓰는데도 화면이 뜨므로, **일부(또는 전부)는 안 막히는 것으로 보인다.**
까닭 후보: renderer 가 `nodeIntegration: true` 라 `import()` 가 Node 쪽으로 처리될 수 있다.
→ **확인 전에는 I 를 일괄로 바꾸지 않는다.** 한 곳만 바꿔 테스트하고 결과로 정한다.

반대로 **W(워커)는 장군님이 실측으로 막히는 것을 확인**하셨다(E11).

## ★함정

- **「주소를 만드는 줄」만 찾으면 놓친다.** 경로를 만드는 줄과 쓰는 줄이 떨어져 있다.
- **이름이 `toFileUrl` 이라고 `file://` 을 만드는 게 아니다** — 속이 `u4aToAppUrl` 인 것이 3곳.
- **앱이 도는 것이 「다 괜찮다」는 뜻이 아니다** — 워커만 막히고 화면은 떴다.

---

# 【고침】 W · L 수정 + I 판정 (장군님 지시 「1,2 고쳐라」)

## W — 워커 4곳 (고침)

전부 `new Worker(REMOTE.getGlobal("u4aToAppUrl")(경로))` 로 바꿨다. `node --check` 통과.

| 자리 | 그 워커가 하는 일 |
|---|---|
| `www/help/u4a_helpdoc/main.js:487` | 도움말 문서 내려받기 ★E11 이 막혔던 자리 |
| `www/lib/ws/electron-updater-sap.js:132` | 업데이트 확인 |
| `www/lib/ws/SupportPackageChecker/index.js:528` | 서포트 패키지 확인 |
| `www/ws30/ws10_20/Popups/iconPrevPopup/runtime.js:1915` | 아이콘 즐겨찾기 저장 |

`lib/ws/` 두 파일은 **우리 코드**다 — 파일 앞머리에 저작권 표시가 없고 주석이 한국어다
(남의 라이브러리 금지 규칙에 걸리지 않는 것을 먼저 확인했다).

`iconPrevPopup/runtime.js` 는 `node --check` 가 실패하는데, **내 수정 전에도 똑같이 실패**한다
(`require = parent.require` 재선언 때문). 같은 폴더의 다른 파일과 비교해 확인했다. 브라우저에서는 정상이다.

## L — 창 열기 (고침 1곳, 2곳은 이미 올바름)

- 고친 것: `www/floatingMenu/js/handle.js:126` — 이 창만 `file://` 로 떴다.
- **이미 올바른 것 2곳**: `u4a-intro/themes/seasons/index.js:116` · `Popups/relese_notes/index.js:207`.
  `u4aToAppUrl` 을 **여러 줄에 걸쳐** 쓰고 있어 한 줄 검사가 못 잡았다. 앞 조사에서 3곳이라 적은 것은 틀렸다.
- **테스트할 수 없다** — 떠다니는 메뉴를 **켜는 자리가 지금 없다**(`floatMenu.open` 을 부르는 곳 0건).
  TODO 1-19(떠다니는 메뉴 표식 넣는 자리 없음)와 같은 건이다.

## I — 동적 import: **고칠 것 없음** (앞의 「확인 못 했다」를 정정한다)

### 판정 근거 (실측)

`www/ws30/ws10_20/js/fnDialogPopupOpener.js:3990` 이 **UI5 Predefined Css 창을 여는 바로 그 자리**에서
생경로로 `await import` 를 한다.

```js
let sUrlPath = parent.getPath("UI5CSSPOP_V2_CONTROL");   // = PATH.join(...) 생 Windows 경로
let oCSS = await import(sUrlPath);
```

- 대상 파일 `Popups/ui5CssPopup_v2/control.js` 는 **실제로 있다**.
- 그 창은 **E3~E7 에서 장군님이 열어 정상 동작을 확인**하셨다.
→ 그러므로 **생경로 `await import` 는 지금 막히지 않는다.**

### 51곳 중 상당수는 애초에 죽은 코드다

`design/js/` 쪽 13곳(`uiAttributeArea.js` 9 · `main.js` 1 · `uiDesignArea.js` 1 · `callAttrContextMenu.js` 2)은
**UI5 의존이라 HTML5 에서 로드되지 않는다.** 근거 = `js/ws_html5_ws20_attr.js:189` 주석
「★원본은 uiAttributeArea.js 에서 정의했으나 그 파일은 UI5 의존이라 HTML5 미로드」.

### 버린 방법 — 죽은 코드를 고쳤다가 되돌렸다

시험 대상으로 `Popups/versionManagement/Popup/frame.js:352` 를 골라 고쳤다가 **되돌렸다**(`git checkout`).
버전 관리 창의 실제 본문은 `Popups/versionMng/versionMngFrame.html` 이고
(`js/fnVersionManagementPopupOpen.js:113` 이 그것을 `loadURL` 한다),
`versionManagement/` 는 **UI5 원본 쪽이라 안 돈다**. `js/fnHmws.js:898` 주석에 그렇게 적혀 있다.

### 아직 모르는 것

**메인 화면(`ws30/ws10_20/index.js`)이 2026-10-27 에 왜 멈췄는지**는 이 판정으로 설명되지 않는다.
그 파일 주석은 「file:// 생경로 import 가 막혀서」라고 적지만, 위 실측과 어긋난다.
눈에 보이는 차이는 **그 자리만 슬래시 경로**(`WS10_20_ROOT + "/views/..."`)이고 나머지는 `PATH.join`
(역슬래시)이라는 것뿐이다. **확인하지 않았으므로 원인으로 적지 않는다.**
지금 그 자리는 `u4aToAppUrl` 로 되어 있어 **돌고 있으니 건드리지 않는다.**

## ★함정 (추가)

- **폴더 이름이 비슷한 두 벌이 있다** — `versionManagement`(UI5 원본) / `versionMng`(HTML5 실물),
  `optionPopup-origin` / `optionPopup`. 고치기 전에 **`loadURL` 로 실제로 열리는 쪽**을 확인한다.
- **`design/js/*.js` 는 HTML5 에서 안 돈다.** 거기서 grep 으로 잡힌 것은 대개 죽은 코드다.
  같은 로직이 `js/ws_html5_ws20_*.js` 에 다시 쓰여 있다.
- **「막힌다」고 문서에 적혀 있어도 실측을 먼저 본다.** `.analy/20` 함정 1 은 지금 상태와 맞지 않는다.
- **커스텀 프로토콜은 앱 폴더 밖 파일을 거부한다**(`electron/lib/protocol/ws_app_protocol.js:159`, 403).
  그러므로 U(`file:///`) 를 고칠 때는 자리마다 **앱 안/밖**을 먼저 가려야 한다. 밖이면 다른 방법이 필요하다.

---

# 【고침 2】 도움말 문서 창 preload (2026-10-29 · 장군님 지시 「한줄 고쳐라」)

## 증상

도움말 문서 창 콘솔: `Only "file:" protocol is supported in "preload" attribute.`
문서 자체는 잘 뜬다(워커 수정으로 내려받기는 통과 = 테스트 F1 ✅).

## 원인

`www/help/u4a_helpdoc/viewer/u4a-ws30-help/docMain.html:201`

```js
this.webview.preload = './preload.js';
```

창이 `u4a-ws://` 로 뜨니 이 상대 경로가 `u4a-ws://app/help/.../preload.js` 로 풀린다.
**Electron 은 `<webview preload>` 에 `file:` 주소만 받는다.**
(같은 파일 `:171` 의 `preload="./preload.js"` 는 **주석 안**이라 안 돈다.)

## 고친 것

`window.__dirname` 으로 그 html 의 폴더를 얻어 `file:///` 주소로 만든다.
`window.__dirname` 은 custom protocol 로 떠도 되살아난다 —
`electron/lib/protocol/ws_renderer_dirname.js` 가 **모든 session 에 preload 로** 건다.

```js
const sHelpDir = window.__dirname;

if (!sHelpDir) {
    console.warn('[HDOC] HDOC-001 | window.__dirname is empty | webview preload not attached - ...');
} else {
    const sPreloadPath = this.path.join(sHelpDir, 'preload.js');
    this.webview.preload = encodeURI('file:///' + sPreloadPath.replace(/\/g, '/'));
}
```

- `this.path` 는 같은 함수 `:188` 에서 이미 준비된다.
- `encodeURI` 를 거치는 이유 = 경로에 한글·공백이 있으면 그대로는 URL 이 깨진다.
- 오류코드 접두 `HDOC` 를 새로 만들었다(겹치는 접두 없음을 확인). 파일 맨 위에 선언을 넣었다.

## 무엇이 되살아나나

`preload.js` 는 도움말 문서 쪽에서 창으로 보내는 통로다. 조작은 **문서 안에서**:

| 조작 | 하는 일 |
|---|---|
| `Ctrl` + 마우스 휠 | 확대 · 축소 |
| `Ctrl` + `0` | 100% 로 되돌림 |
| 마우스 뒤로 · 앞으로 버튼 | 앞뒤 이동 |
| 문서 테마 바꾸기 | 창 테마도 따라감 |

## ★별개로 발견한 것 (안 고쳤다 — 지시 대기)

`docMain.html:412` 가 **`u4aAPI.setGoBack(...)`** 을 부르는데, `preload.js` 에는
`setZoom` · `setTheme` · `setBack` · `setForward` 넷뿐이고 **`setGoBack` 이 없다.**
그래서 문서 안에서 `ESC` 를 누르면 그 줄에서 터진다. preload 가 아예 안 걸려 있던 동안에는
`u4aAPI` 자체가 없어 묻혀 있던 결함이다. **이번 수정으로 드러난다.**
고치는 법은 둘 — ① `preload.js` 에 `setGoBack` 을 더한다 ② 그 줄을 `setBack` 으로 바꾼다.

## ★함정 (추가)

- **`<webview preload>` 는 `u4a-ws://` 를 못 받는다.** 창 자체(`src`)는 custom protocol 로 돼도
  preload 만은 `file:` 이어야 한다. 앞으로 webview 를 쓰는 창을 만들 때 똑같이 걸린다.
- **`window.__dirname` 은 쓸 수 있다** — custom protocol 창에서도 되살아난다. 다만 Node 쪽
  `__dirname` 과 헷갈리지 않게 `window.` 를 붙여 쓴다.
- python 으로 소스를 고칠 때 **정규식 안 역슬래시가 깨진다.** 이번에도 `/\/g` 가 `/\/g` 로 들어가
  한 번 더 고쳤다. 역슬래시는 `chr(92)` 로 만들어 붙인다.

## 테스트 결과 (장군님 실측 2026-10-29)

| 코드 | 무엇 | 결과 |
|---|---|---|
| F1 | 도움말 문서 내려받기 (워커) | ✅ 통과 |
| F3 | 도움말 문서 안에서 `Ctrl`+휠 확대·축소 (preload) | ✅ 통과 |
| E11 | 도움말 창을 두 번 열면 그 창이 앞으로 옴 (주소 쿼리) | ✅ 통과 |

→ **워커 수정과 preload 수정이 둘 다 실제로 먹는 것을 확인했다.**
남은 것 = F2(아이콘 즐겨찾기 워커) · E12(예제 열기·AI 창).

---

# 【F2 실패】 iframe 이 만든 Worker 에는 Node 가 안 붙는다 (2026-10-29)

## 증상

아이콘 목록 창에서 즐겨찾기 별을 누르면:
`Uncaught ReferenceError: require is not defined` @ `u4a-ws://app/ws30/ws10_20/js/workers/u4aWsFavIconWorker.js 4:14`

## 원인 (확정)

Electron 공식 문서 — `nodeIntegrationInWorker` 는 **「Only workers created by a frame that itself
has access to Node.js」**. 즉 **워커를 만든 frame 자신이 Node 를 쓸 수 있어야** 적용된다
(main frame, 또는 `nodeIntegrationInSubFrames` 가 켜진 sub-frame).

- 아이콘 목록 창의 본문은 `Popups/iconPrevPopup/index.html:90` 의 **`<iframe id="ws_frame">` 안**에서 돈다.
- 그 증거가 `Popups/iconPrevPopup/runtime.js:17` 의 `require = parent.require` —
  **자기 frame 에 `require` 가 없어 부모 것을 빌려 쓴다.**
- `nodeIntegrationInSubFrames` 는 **이 프로젝트 어디에도 없다**(= 꺼짐).
- 창 설정(`settings/BrowserWindow/BrowserWindow-settings.json`)에는 `nodeIntegration` ·
  `nodeIntegrationInWorker` 가 둘 다 true 지만, **sub-frame 에는 적용되지 않는다.**
- scheme 등록 옵션(`registerSchemesAsPrivileged`)에는 Node 관련 항목이 **없다** — 그쪽으로는 못 푼다.

**제 수정 때문이 아니다.** 전에는 워커가 아예 안 만들어져 묻혀 있었고, custom protocol 로 바꿔
워커가 만들어지기 시작하면서 드러났다.

## 내가 잘못 단정한 것

「F1(도움말 내려받기)이 통과했으니 custom protocol 워커에서 `require` 가 된다」고 적었다.
**틀렸다** — 이미 받아 둔 문서면 그 워커를 타지 않는다. 통과가 워커 통과를 증명하지 않는다.

## 고칠 선택지 (장군님 결정 대기)

| 안 | 내용 | 평 |
|:--:|---|---|
| ① | 워커를 **창 본체(iframe 바깥)에서 만들고** iframe 은 저장만 부탁 | 원본 동작 그대로. 배선 조금 늘어남. **제 안** |
| ② | 워커를 없애고 그 자리에서 바로 저장 | 워커가 하는 일 = 거르기 + 파일 하나 쓰기(37줄). 원본과 달라짐 |
| ③ | `nodeIntegrationInSubFrames: true` | **권하지 않음** — 그 iframe 은 서버가 준 화면이라 서버 코드에 파일시스템을 주는 꼴 |

## 아직 안 본 것

나머지 워커 3곳(도움말 내려받기 · 업데이트 확인 · 서포트 패키지 확인)이 **iframe 안에서 만들어지는지**
가리지 않았다. 전부 `require("fs")` 를 쓰므로 같은 문제일 수 있다.

## ★함정

- **`nodeIntegrationInWorker: true` 가 창 설정에 있어도 iframe 안에서는 안 먹는다.**
  새 창에 Worker 를 붙일 때는 **그 코드가 main frame 에서 도는지** 먼저 본다.
- 판별법: 그 파일이 `require = parent.require` 처럼 **부모에게서 Node 를 빌려 쓰면 sub-frame 이다.**

## 【보강】 다른 워커와 무엇이 다른가 — 전수 비교 (장군님 질문 2026-10-29)

`new Worker(` 자리 전수(제외: `_` 시작 · `node_modules` · `.min.` · `lib/monaco` · `aceeditor`):

| 워커 | 만드는 자리 | 주소 방식 | `require` 수 | 어느 frame | 지금 |
|---|---|---|:--:|---|:--:|
| 서버 세션 | `js/fnServerSession.js:24` | 상대 경로 | 0 | 메인 창 | ✅ |
| 클라이언트 세션 | `js/ws_fn_03.js:34` | 상대 경로 | 0 | 메인 창 | ✅ |
| 도움말 문서 내려받기 | `help/u4a_helpdoc/main.js:489` | `u4aToAppUrl` | 2 | 메인 창 (`js/fnDialogPopupOpener.js:2399` 가 부름) | ✅ |
| 업데이트 확인 | `lib/ws/electron-updater-sap.js:133` | `u4aToAppUrl` | 2 | 로그인 화면 (`Login/Login.js:41`) | ✅ |
| 서포트 패키지 확인 | `lib/ws/SupportPackageChecker/index.js:529` | `u4aToAppUrl` | 7 | 로그인 화면 (`Login/Login.js:1947`) | ✅ |
| **아이콘 즐겨찾기** | `Popups/iconPrevPopup/runtime.js:1916` | `u4aToAppUrl` | 1 | **iframe 안** (`iconPrevPopup/index.html:90`) | **❌** |

**다른 점은 두 가지뿐이다.**
1. 세션 워커 둘은 `require` 를 **아예 안 쓴다** — Node 가 필요 없으니 어디서 만들어도 된다.
2. Node 를 쓰는 나머지 넷 중 **아이콘 즐겨찾기만 iframe 안에서 만든다.** 나머지 셋은 창 본체(main frame)다.

→ **고칠 방향 확정: 나머지와 같게 창 본체에서 만든다**(앞의 ① 안).
   `runtime.js`(iframe) 는 저장을 부탁만 하고, 워커 생성·파일 쓰기는 `index.js`(창 본체)가 한다.

**곁다리로 확인된 것**: 상대 경로로 만드는 워커 2곳(`fnServerSession.js:24` · `ws_fn_03.js:34`)은
**고칠 필요가 없다.** 상대 경로는 창 주소(`u4a-ws://`) 기준으로 풀려 저절로 맞는다.

## 【정정 3】 원인은 custom protocol 이 아니라 **Electron 45 의 breaking change** 다 (2026-10-29)

장군님 질문 — 「이전 버전에서는 잘되다가 버전 올리니까 문제되는데 왜그런지 조사해바」.
**장군님 말씀이 맞다.** 공식 문서에 그대로 있다.

### 공식 근거

Electron 공식 Breaking Changes, **45.0** 절 —
「Behavior Changed: workers created by subframes need `nodeIntegrationInSubFrames` for Node.js integration」

> With `nodeIntegrationInWorker: true`, a `Worker` created from an `<iframe>` in the same process
> as the main frame **used to get Node.js integration**.
> Workers now only get Node.js integration **when the frame that creates them has it**,
> or any frame when `nodeIntegrationInSubFrames` is enabled.

Electron **44.3.0 · 43.7.0 · 42.11.3** 에도 backport 됐다.

출처: https://www.electronjs.org/docs/latest/breaking-changes

### 그래서

- **이전(Electron 14)**: 아이콘 창의 iframe 자신에게 Node 가 없어도, **메인 frame 과 같은 프로세스**에
  있으면 그 iframe 이 만든 Worker 에 Node 가 붙었다 → 즐겨찾기 저장이 됐다.
- **지금(Electron 45)**: **워커를 만든 frame 자신이** Node 를 가져야 한다 → iframe 이 만든 워커는 Node 없음.
- 공식 문구 그대로 **「Workers created by the main frame are unaffected」** — 그래서 나머지 워커 5곳은 멀쩡하다.

### 앞 글 정정

앞에서 이 건을 「custom protocol 때문」·「원래 구조 문제」라고 적었는데 **둘 다 정확하지 않다.**
custom protocol 과는 **무관**하고, 그 구조는 **Electron 44 까지는 정상으로 돌던 구조**다.
`u4a-ws://` 로 바꾼 것이 드러나게 한 것도 아니다 — **Electron 45 로 올린 것이 원인**이다.

### 고치는 길 (공식이 주는 두 가지)

| 안 | 내용 | 평 |
|:--:|---|---|
| ① | 워커를 **창 본체(main frame)에서 만든다** | 공식 문구 「the frame that creates them has it」 그대로. **제 안** |
| ③ | `nodeIntegrationInSubFrames: true` | 공식이 인정하는 길이지만, 그 iframe 은 **서버가 준 화면**이라 서버 코드에 파일시스템을 주는 꼴 |

→ **①** 로 간다. 결론은 앞과 같지만 **근거가 공식 문서로 확정**됐다.

### ★함정 (고쳐 적음)

- **Electron 45 부터 iframe 이 만든 Worker 에는 Node 가 없다.** 44 까지는 있었다.
  앞으로 iframe 안에서 `new Worker` 를 쓸 일이 있으면 **창 본체에서 만들어 넘긴다.**
- 이 규칙은 42.11.3 · 43.7.0 · 44.3.0 에도 backport 됐으므로 **버전을 낮춰도 피할 수 없다.**

### 「같은 프로세스」는 origin 이야기가 아니다 (장군님 질문 2026-10-29)

공식 문구의 **"in the same process as the main frame"** 은 **Chromium 렌더러 프로세스**를 말한다.
`origin`(= `scheme://host:port`)과 다른 개념이고, **origin 이 달라도 같은 프로세스에 들어갈 수 있다.**

이 창에서 실제로 그렇다:

| | 값 |
|---|---|
| 창 본체 origin | `u4a-ws://app` |
| iframe origin | **서버 주소** — `index.html:92` 의 form 이 `action = <서버>/getP13nPreviewHTML`, `target="u4aForm"`(= iframe 이름)로 submit |
| 둘 관계 | **cross-origin** |
| 그런데도 `contentDocument` 를 직접 만진다(`index.js:566`) | 창 설정에 **`webSecurity: false`** 가 있어 same-origin policy 가 꺼져 있다 |

→ **origin 은 원래부터 달랐다.** 그런데도 Electron 44 까지는 워커에 Node 가 붙었다 —
   조건이 origin 이 아니라 **프로세스**였기 때문이다.

**실무적 함의**: origin 기준이 아니므로 **워커 주소를 어떻게 바꿔도 풀리지 않는다.**
`file://` 로 줘도, `blob:` 으로 줘도 마찬가지다. **워커를 만드는 frame 자신이 Node 를 가져야** 한다.
→ ① (창 본체에서 만들기) 가 유일하게 맞는 길이다.

### `nodeIntegrationInSubFrames` 는 없어지지 않았다 (장군님 질문 2026-10-29)

Electron 45 타입 정의에 그대로 있다(`node_modules/electron/electron.d.ts:20367`).
우리가 **안 켜고 있을 뿐**이다(프로젝트 전체에 이 이름이 0건).

공식 설명 원문:
> **Experimental option** for enabling Node.js support in sub-frames such as iframes and child windows.
> **All your preloads will load for every iframe**, you can use `process.isMainFrame` to determine
> if you are in the main frame or not.

45 의 breaking change 문구도 이 옵션을 **탈출구로 명시**한다 —
「Workers now only get Node.js integration when the frame that creates them has it,
**or any frame when `nodeIntegrationInSubFrames` is enabled**」.

즉 **켜면 풀린다.** 다만 딸려오는 것:

1. **그 창의 모든 iframe 에 Node 가 생긴다.** 아이콘 창의 iframe 은 **서버가 준 화면**이다
   (`index.html:92` 의 form 이 서버로 submit). 서버가 보낸 스크립트도 `require` 를 쓸 수 있게 된다.
2. **모든 preload 가 모든 iframe 에서 로드된다**(공식 설명). 이 프로젝트는
   `electron/lib/protocol/ws_renderer_dirname.js` 를 **모든 session 에 frame preload** 로 걸어 두었으므로,
   서버가 준 iframe 에서도 그것이 돌게 된다.
3. 옵션은 `webPreferences` 라 **그 창에만** 적용된다(다른 창에는 영향 없음).

**그래도 ① (워커를 창 본체에서 만들기) 를 권한다** — 보안 경계를 넓히지 않고,
나머지 워커 5곳과 **같은 방식**이 되기 때문이다. 다만 ③ 도 유효한 길이라는 점은 분명히 해 둔다.

### 「옵션이 정말 안 켜져 있나」 재확인 + 그런데도 iframe 에서 `require` 가 되는 까닭 (2026-10-29)

**재확인**: 확장자 제한 없이 프로젝트 전체를 뒤졌다(`node_modules`·`.git` 만 제외).
`nodeIntegrationInSubFrames` 는 **소스 0건**. 나오는 곳은 이 이력 문서와
`dist/win-unpacked/U4A Workspace.exe`(Electron 바이너리 자체)뿐이다. → **안 켜져 있다.**

**그런데 왜 iframe 안 `runtime.js` 에서는 `require` 가 지금도 되나?**

```js
// Popups/iconPrevPopup/runtime.js:17
const require = parent.require,
```

**그 iframe 자신에게 Node 가 있는 게 아니다.** `parent`(창 본체)의 `require` 객체를
**빌려 오는 것**이다. 창 설정에 `webSecurity: false` 가 있어 cross-origin 인 부모에도 접근이 된다.

**Worker 는 그 빌리기가 불가능하다.** Worker 는 별도 스레드라 `parent` 도 `window` 도 없다.
그래서 Electron 이 그 Worker 에 Node 를 직접 붙여 줘야 하는데, 45 부터 **만든 frame 자신이
Node 를 가져야** 붙는다. iframe 은 빌려 쓸 뿐 자기 Node 가 없으니 → 워커에 Node 없음.

→ **「iframe 에서 require 가 되니 워커에서도 되겠지」가 성립하지 않는다.** 둘은 다른 길이다.

### 「워커는 iframe 과 상관없지 않나」 — 근거를 주석이 아니라 코드로 (장군님 지적 2026-10-29)

앞에서 `runtime.js` 가 iframe 안에서 돈다는 근거로 **주석**을 댔다. 약한 근거였다. **코드로 확정한다.**

`Popups/iconPrevPopup/index.js:563~606`:
```js
let oWs_frame = document.getElementById("ws_frame"),
    oContWindow = oWs_frame.contentWindow,      // ← iframe 의 window
    ...
let sJsData = FS.readFileSync(sRuntimeJsPath, "utf-8");
oContWindow["___u4a_ws_eval___"](sJsData);      // ← iframe 의 window 안에서 eval
```

→ `runtime.js` 는 **파일을 읽어 iframe 의 window 안에서 eval** 된다. 그래서 `runtime.js:1916` 의
`new Worker(...)` 는 **iframe 이 만든 워커**다.

**Worker 가 별도 스레드인 것은 맞다** — DOM 도 `parent` 도 없다. 그러나 **Node 가 붙느냐는
「누가 만들었나」로 정해진다.** Electron 45 문구가 `the frame that creates them` 이고,
웹 표준에서도 Worker 는 자기를 만든 문서의 settings object(origin · base URL · CSP)를 물려받는다.
**스레드가 분리된 것**과 **설정을 어디서 받는가**는 별개다.

→ 같은 `new Worker(...)` 한 줄이라도 **창 본체에서 부르면 Node 가 붙고, iframe 에서 부르면 안 붙는다.**
   그래서 ① (창 본체로 옮기기) 가 성립한다.

### 「워커 옵션은 `nodeIntegrationInWorker` 아니냐」 (장군님 지적 2026-10-29)

맞다. 그리고 **그 옵션은 이 창에 켜져 있다**(`settings/BrowserWindow/BrowserWindow-settings.json`).
문제는 그것이 아니라 **Electron 45 가 조건을 하나 더 붙인 것**이다.

공식 문구는 그 옵션을 **전제**로 쓰여 있다:
> **With `nodeIntegrationInWorker: true`**, a Worker created from an `<iframe>` … **used to get** Node.js integration.
> Workers **now only** get Node.js integration **when the frame that creates them has it**,
> or any frame when `nodeIntegrationInSubFrames` is enabled.

| 조건 | 이 창 |
|---|:--:|
| `nodeIntegrationInWorker: true` | ✅ 켜짐 |
| 워커를 만든 frame 이 Node 를 가짐 (main frame 이거나 `nodeIntegrationInSubFrames`) | ❌ iframe 이 만들었고 그 옵션은 꺼짐 |

**44 까지는 위 한 줄로 충분했고, 45 부터는 아래가 같이 있어야 한다.**
그래서 고치는 길은 ① 아래 조건을 만족시키기(창 본체에서 만들기) 또는
③ `nodeIntegrationInSubFrames` 켜기, 둘뿐이다.

## 【고침】 아이콘 목록 창에 `nodeIntegrationInSubFrames` 를 켰다 (장군님 지시 2026-10-29)

장군님 지적 — 「그러면 `nodeIntegrationInSubFrames` 이거만 키면 된다는 말 아니냐?」
**맞다.** 공식 문구가 그 옵션을 탈출구로 명시한다.

### 내가 ① 을 민 근거가 약했다

「서버가 준 화면에 Node 를 준다」고 반대했는데, **그 iframe 은 이미 우리 코드(`runtime.js:17`)가
`parent.require` 로 Node 를 쓰고 있고**, 창 자체가 `webSecurity: false` 다. 경계는 이미 열려 있었다.
반대 근거로 삼을 만한 차이가 아니었다.

### 고친 것

`www/ws30/ws10_20/js/fnDialogPopupOpener.js` — 아이콘 목록 창(Icon List) 옵션에 한 줄 추가.

```js
oBrowserOptions.webPreferences.nodeIntegrationInWorker = true;
oBrowserOptions.webPreferences.nodeIntegrationInSubFrames = true;   // ← 추가
```

- **이 창에만** 켰다. 공통 설정(`settings/BrowserWindow/BrowserWindow-settings.json`)은 안 건드렸다.
- 같은 파일에 `nodeIntegrationInWorker` 가 **2곳**이라 그냥 치환하면 둘 다 바뀐다.
  `:2119` = Icon List(메시지 번호 047) · `:2291` = Image Icons(067). **047 블록인지 확인하고** 넣었다.
  Image Icons 창은 워커를 쓰지 않으므로(워커 전수 목록에 없음) 대상이 아니다.
- `node --check` 통과.

### 딸려오는 것

공식 설명대로 **그 창의 모든 preload 가 iframe 에서도 로드**된다. 이 프로젝트에서는
`electron/lib/protocol/ws_renderer_dirname.js`(창 경로 되살리기)가 그 iframe 에서도 돌아
`window.__dirname` 을 넣게 된다. 서버 UI5 는 그 값을 보지 않으므로 동작에 영향은 없다.

### ★함정

- 이 파일처럼 **같은 설정 블록이 창마다 복사돼 있는 곳**은, 치환 전에 **건수를 세고**
  **어느 창인지 제목(메시지 번호)으로 가린** 뒤에 넣는다. 2건이 나와 한 번 멈췄다.

## 【실패】 `nodeIntegrationInSubFrames` 를 켰더니 그 창이 아예 안 뜬다 (2026-10-29)

### 증상

아이콘 목록 창이 뜨지 않는다. 콘솔:

```
Uncaught ModuleError: Failed to resolve dependencies of 'sap/ui/core/Core.js'
 -> 'sap/ui/thirdparty/URI.js': Cannot find module './punycode'
Require stack:
- internal/electron/js2c/renderer_init
  at Module._resolveFilename (node:internal/modules/cjs/loader:1571:15)
...
Uncaught TypeError: sap.ui.getCore is not a function        @ getP13nPreviewHTML
[iconPrevPopup] server UI5 load failed → ... watchdog-timeout
```

### 원인 (확정)

스택에 **`node:internal/modules/cjs/loader`** 가 찍혔다 = **Node 의 모듈 로더가 돌았다.**

iframe 에 Node 를 켜니 **그 안에 `require` 가 생겼다.** 서버가 주는 UI5 의
`sap/ui/thirdparty/URI.js` 는 **UMD** 라 「`require` 가 있으면 CommonJS 로」 동작한다.
브라우저에는 없던 `require` 가 생기는 바람에 CommonJS 길로 꺾였고,
`require('./punycode')` 를 Node 에게 물어 실패 → UI5 부팅 전체가 깨졌다.

`URI.js` 는 **서버가 주는 파일**이라 우리가 고칠 수 없다(로컬에 없음).

### 판정

**③(`nodeIntegrationInSubFrames` 켜기)은 쓸 수 없는 길이다.**
내가 「딸려오는 것은 preload 하나뿐」이라고 적은 것은 **틀렸다.** 더 큰 것이 있었다 —
**그 iframe 안의 UMD 라이브러리가 전부 CommonJS 로 꺾인다.**

→ **① (워커를 창 본체에서 만들고 iframe 은 저장만 부탁) 이 유일한 길이다.**
   처음에 ① 을 권한 결론은 맞았지만, 근거를 「서버 화면에 Node 를 주면 위험」이라고 **잘못 댔다.**
   진짜 이유는 **서버 UI5 가 Node 의 `require` 를 보면 깨진다**는 것이다.

### ★함정 (크다)

- **서버 UI5(또는 다른 UMD 라이브러리)를 담은 iframe 에는 절대 Node 를 켜지 말 것.**
  UMD 는 `typeof require !== "undefined"` 를 보고 CommonJS 로 꺾인다. 브라우저용 경로가 통째로 죽는다.
- 같은 이유로 **창 본체에 `nodeIntegration: true` 를 켜 둔 채 UI5 를 직접 로드하면** 같은 일이 난다.
  이 프로젝트가 UI5 를 iframe 에 가둬 둔 까닭이 여기에 있을 수 있다.

### 해결 방안 — 원본이 쓰던 「UI5 와 Node 의 require 충돌 방지」 (장군님 지적 2026-10-29)

장군님 — 「이거 node 하고 ui5 하고 require 때문에 충돌나는거야.. 그거 해결 방안있어」. **있다.**

원본 `U4A_WS3.0.0/www/ServerList_v2/ServerList.js:189~209`, 주석 제목이 그대로
**「⚡ UI5와 Electron Node의 충돌 방지 로직」** 이다:

```js
if (typeof module === 'object' && typeof require === 'function') {
    window.__node = { require: window.require, module: window.module, exports: window.exports };
    window.require = undefined;
    window.module  = undefined;
    window.exports = undefined;
}
```

**UI5 부트 전에 셋을 치워 둔다.** UI5 는 `require` 를 못 보니 브라우저(AMD) 길로 간다.
되돌리는 쪽은 우리 `ws30/ws10_20/index.js:19 _restoreNodeGlobals()` 에 **이미 있다** —
치우는 쪽만 WS4.0 에서 빠져 있었다(주석에 「UI5 미사용 시 no-op, 호환 위해 유지」).

### 우리 경우에 어떻게 넣나

그 iframe 은 **서버가 준 HTML** 이라 안에 스크립트를 못 넣는다. **preload 가 유일한 자리**다 —
페이지 스크립트보다 먼저 돌고, `nodeIntegrationInSubFrames` 를 켜면 iframe 에서도 돈다.
main frame 까지 치우면 `index.js` 가 깨지므로 **`process.isMainFrame` 으로 가른다**
(공식 설명이 그 용도를 명시한다: 「you can use `process.isMainFrame` to determine…」).

1. 작은 preload 파일 — `if (!process.isMainFrame) { 셋을 치운다 }`
2. 아이콘 목록 창 옵션에 그 preload 를 건다(이 창에만; 공통 설정에는 preload 가 없다)
3. 워커에는 Node 가 그대로 붙는다 — Electron 은 frame 의 **설정**을 보지 `window.require` 를 보지 않는다

**3번은 실측으로만 확인된다.** 안 되면 ①(워커를 창 본체로 옮기기)로 간다.

★ 되돌릴 필요 없다. 방금 넣은 `nodeIntegrationInSubFrames` 는 그대로 두고 preload 를 더한다.

## 【고침 2】 UI5 와 Node 의 `require` 충돌 — 치웠다가 되살린다 (장군님 지시 2026-10-29)

장군님 — 「`window.require` 를 다른 변수에 임시로 담아 놓고 지웠다가 부트스트랩 로드하면
다시 살리는 방식 말이야」 · 「원본에도 있는 내용이야」. **그대로 넣었다.**

### 원본 확인

원본에서 이 패턴을 쓰는 곳은 **3곳**이다(전수):
`ServerList_v2/ServerList.js` · `ws30/ws10_20/design/attrPresetPopup/list/index.js` · `ws30/ws10_20/index.js`.
**아이콘 목록 창에는 없다** — Electron 14 에서는 iframe 에 Node 가 없어 필요가 없었다.
그래서 **패턴은 원본 것 그대로** 쓰되, 자리는 우리 사정에 맞춘다.

### 치우는 쪽 — `electron/lib/protocol/ws_renderer_dirname.js` 끝에 추가

새 파일을 만들지 않았다(장군님 지시). 이 preload 는 **이미 모든 session 에 frame preload 로** 걸려 있다.

```js
if (process.isMainFrame) { return; }                 // 창 본체는 건드리지 않는다
if (typeof window.require !== 'function') { return; } // Node 없는 frame 은 그대로 통과

window.__node = { require: window.require, module: window.module, exports: window.exports };
window.require = undefined;
window.module  = undefined;
window.exports = undefined;
```

- `process.isMainFrame` 으로 가르는 것은 공식이 그 용도로 안내하는 방법이다.
- 다른 창은 `nodeIntegrationInSubFrames` 가 꺼져 있어 `window.require` 가 없다 → 가드에서 빠져나간다.
  **지금 켜진 창은 아이콘 목록 하나뿐**이라 영향 범위가 그 창의 iframe 하나다.

### 되살리는 쪽 — `Popups/iconPrevPopup/index.js` 의 `onFrameLoadSuccess`

서버 UI5 가 부팅을 마치면 `CALLBACKFUNC` 로 이 함수를 불러 준다. **거기서 되돌린다.**
`sap` 존재 확인 직후, `bBootOk = true` 앞에 넣었다.

```js
if (oContWindow.__node) {
    oContWindow.require = oContWindow.__node.require;
    oContWindow.module  = oContWindow.__node.module;
    oContWindow.exports = oContWindow.__node.exports;
    delete oContWindow.__node;
} else {
    U4ALOG.warn("GUARD_EXIT", "__node in the iframe", "...worker may fail with require is not defined");
}
```

### 순서 (중요)

`onFrameLoadSuccess` 안에서 **되살리기 → … → `runtime.js` eval(맨 끝 `___u4a_ws_eval___`)** 이다.
`runtime.js` 가 워커를 만드는 것은 그 뒤이므로 순서가 맞다.

두 파일 모두 `node --check` 통과.

### 아직 확인 못 한 것

**`window.require` 를 지워도 워커에 Node 가 붙는가.** Electron 은 frame 의 **설정**(`nodeIntegrationInWorker`
+ `nodeIntegrationInSubFrames`)을 보지 `window` 객체의 상태를 보지 않으므로 붙어야 하지만,
**실측으로만 확정된다.** 안 되면 ①(워커를 창 본체로 옮기기)로 간다.

## 【통과】 아이콘 즐겨찾기 — 창도 뜨고 저장도 된다 (장군님 실측 2026-10-29)

`nodeIntegrationInSubFrames` + preload 에서 `require` 치우기 + UI5 부팅 뒤 되살리기 — **세 개가 맞물려 통과.**
테스트 F1(도움말 문서) · F2(즐겨찾기) · F3(문서 확대축소) **전부 통과**, 묶음 종료.

**한 줄 요약 — 앞으로 iframe 안에서 Worker 를 쓸 때:**
1. 그 창에 `nodeIntegrationInSubFrames: true` (Electron 45 부터 필요)
2. 그러면 iframe 에 `require` 가 생겨 **서버 UI5(UMD)가 CommonJS 로 꺾인다** → preload 에서 치운다
3. UI5 부팅이 끝나면 **되살린다** (안 되살리면 그 iframe 코드가 Node 를 못 쓴다)

---

# 【고침】 이미지 아이콘 창 — UI5 부트스트랩을 언제나 접속 서버에서 (장군님 지시 2026-10-29)

## 왜 어떤 서버에 접속해도 같았나

`www/intro.js` 의 `_setUI5BootStrapUrl()` 이 **개발 모드면** 설정의 고정 주소로 덮어쓴다:

```js
if (APP.isPackaged === false) {
    oSettings.UI5.resourceUrl = oSettings.UI5.testResource;   // ws_settings.json 의 고정 주소
}
```
`testResource` = `https://u000.u4aide.com:10001/public/lib/_org_files/sapui5-rt-1.107.1/resources/sap-ui-core.js`

그리고 `Popups/illustMsgPopup/index.js` 가 **패키지일 때만** 서버 UI5 로 바꾸고 있었다:
```js
oAPP.UI5LIB_WSSRC = oSetting_UI5.resourceUrl;          // 개발 = 고정 주소
if (oAPP.APP.isPackaged) { oAPP.UI5LIB_WSSRC = oAPP.UI5LIB_SSRC; }
```
→ **개발 모드에서는 어느 서버로 로그인하든 `u000.u4aide.com` 의 UI5** 를 받아 왔다.

## 고친 것

`Popups/illustMsgPopup/index.js` — 조건을 없애고 **언제나** 접속 서버 것을 쓴다.
```js
oAPP.UI5LIB_SSRC  = oAPP.attr.sServerHost + oAPP.attr.sServerLibPath;   // ('/zu4a_imp/' 임시로직 유지)
oAPP.UI5LIB_WSSRC = oAPP.UI5LIB_SSRC;
```
- 죽은 줄이 된 `oSettings`·`oSetting_UI5`·`resourceUrl` 대입을 **같이 지웠다**(안 타는 분기 금지).
- `frame.html` 의 「★패키지에서만★」 주석도 **현행화**했다(이제 언제나 서버).
- 영향 범위 = `UI5LIB_WSSRC` 를 쓰는 곳 **한 곳**(`frame.html:66`). `selectSAP.html` 은 원래부터 서버(`UI5LIB_SSRC`).
- `node --check` 통과.

## ★함정

- **옛 선례**: 한때 뷰어를 서버 UI5 로 바꿨다가 `sap` 이 안 떠 **바깥 프레임까지 백지**가 됐다
  (200 으로 엉뚱한 응답이 오면 `onerror` 도 안 떠 오류창조차 없었다).
  그 뒤 들어온 **서버 UI5 로드 실패 처리**(`index.js` 119행 묶음, onerror + `sap` 없음 검사)가 지금은 받아 준다.
  **접속 서버에 UI5 가 없으면 백지 대신 오류 안내 후 닫힌다.** 이 안전장치를 빼면 그 사고가 되살아난다.
- `intro.js` 의 개발/패키지 분리(`_setUI5BootStrapUrl`)는 **그대로 남겼다.** 다른 화면들은 아직 그 값을 쓴다
  (`js/fnDialogPopupOpener.js:4466` · `design/testFolder/AiInterface/index.js:97`). 이번 지시 범위는 이미지 아이콘 창이다.

**G1 통과**(장군님 실측 2026-10-29) — 이미지 아이콘 창이 접속 서버의 UI5 로 정상 동작.
개발 모드에서도 접속 서버를 보게 한 수정이 먹는다.

**남은 의문(확인 전)**: UHA 처럼 `LIBPATH` 가 `/zu4a_imp/` 로 시작하지 않는 서버에서는
임시로직이 **접속 서버 호스트를 안 붙이고 그 값을 주소로 그대로** 쓴다(4곳 동일).
`getMetadata().LIBPATH` 값을 보면 확정된다. 원본 로직이라 손대지 않았다.

## 【결정】 인트로 창은 손대지 않는다 (장군님 2026-10-29)

「인트로 내용을 바꾸면 안 되고.. 근데 지금 다시 실행해보면 투명하게 잘 나와」
→ **고치지 않는다.** TODO 에서 뺐다.

조사해 둔 사실만 남긴다(다시 보일 때 참고):
- 인트로 창(`www/u4a-intro/themes/seasons/index.js`) 옵션에 **`backgroundColor` 가 주석 처리**돼 있다
  (`// "backgroundColor": '#00000000'`). 창은 `transparent: true`, 화면은 `background: transparent !important`
  (네 계절 전부)이므로 **창에 색이 없으면 Electron 기본 흰색이 깔린다.**
- 터미널의 `GetGpuDriverOverlayInfo: Failed to retrieve video device` 는
  `electron/main.js:103 app.disableHardwareAcceleration()` 탓(**2026-06-12 최초 커밋부터** 있던 줄).
  가속이 꺼져 있으면 투명 창이 소프트웨어로 합성된다.
- 간헐적으로 보였다가 지금은 안 보인다 → **타이밍·GPU 상태를 탄다.**

### 【정정 2026-10-29】 원인은 **dock 된 DevTools** 였다 — 위 추정은 틀렸다

장군님 실측 — 「개발자도구가 dock 되면 그렇게 보이는건가본데?」 → 「undock 하니까 괜찮은거 같고」.

dock 된 DevTools 는 페이지와 **같은 OS 창 안에서 함께 그려진다.** 그 상태에서는 Chromium 이
창을 투명하게 합성하지 못해 불투명 바탕이 깔린다. **앱 결함이 아니다 — 고칠 것이 없다.**
설치본에는 DevTools 가 없으므로 고객사에서는 생기지 않는다.

**위에 적은 「창에 색이 없으면 Electron 기본 흰색이 깔린다」는 틀린 추정이다.**
그것이 원인이라면 undock 상태에서도 흰색이어야 한다. `transparent: true` 면
`backgroundColor` 가 없어도 Electron 이 투명하게 처리한다.

**또 밟을 함정**: 투명 창(`transparent: true`)의 색이 이상해 보이면
**DevTools 가 dock 돼 있는지부터 본다.** 창 옵션과 CSS 만 보고 판정하면 또 틀린다.
확인하려면 DevTools 를 undock(또는 닫고)하고 다시 본다.
해당 창: 인트로(`www/u4a-intro/themes/seasons/index.js`) · 메인 인트로(`electron/main.js` `createWindow`).
둘 다 `transparent: true` · `frame: false` 다.

★곁다리: `www/u4a-intro/themes/christmas/index.js` 는 **빈 파일(0줄)** 이다.
  `IntroRuntime._decideThemeGroup()` 이 **12월이면 christmas 를 고른다** — 그대로 두면 12월에 인트로가 깨진다.
  이번 지시 범위 밖이라 보고만 한다.

---

## 2026-10-29 재확인 — U-1 (`intro.js:1319`) 은 「주소만 바꾸면 되는 자리」가 아니다

장군님 「u-1이 대상 맞는지 다시 확인해」. 의심이 맞았다. 내가 U 6곳을 한 묶음으로 올린 것이 잘못이다.

### 읽은 것 (「다 봤다 기준」 대조)

| 확인한 것 | 결과 |
|---|---|
| `_setUI5BootStrapUrl` 본문 (intro.js 1312~1345) | `PATH.join(process.resourcesPath, UI5.localResource)` → `file:///…` → `oSettings.UI5.resourceUrl` |
| `resourceUrl` 에 **값을 넣는 곳 전수** | `intro.js:1322`(로컬 `file:///`) · `intro.js:1342`(**`APP.isPackaged === false` 면 `testResource` 로 덮음**) — 두 곳뿐 |
| `resourceUrl` 을 **읽는 곳 전수** | **14곳** — 전부 `oScript.setAttribute("src", oSetting_UI5.resourceUrl)` (별창들의 UI5 bootstrap) |
| `localResource` 값 (`www/settings/ws_settings.json:14`) | `node_modules/U4A/WS/lib/ui5/v11071/resources/sap-ui-core.js` |
| `testResource` 값 (같은 파일 13행) | `https://u000.u4aide.com:10001/…/sap-ui-core.js` |
| 패키징 설정 (`package.json` build) | `asar: true` · `extraResources` 로 `node_modules/U4A` → `resources/node_modules/U4A` |
| 프로토콜 허용 범위 (`ws_app_protocol.js:156~162`) | `_appRoot = app.getAppPath()` 밖이면 **403**. 패키징본의 `getAppPath()` = `resources/app.asar` |
| 스킴 권한 (같은 파일 105~116) | `standard` · `secure` · `bypassCSP` 등 |
| 그 14개 창의 `webSecurity` | 대부분 기본값(켜짐). `webSecurity:false` 는 `fnDialogPopupOpener.js` 2곳 · `bindPopup/utils/callTooltipsPopup.js` 1곳뿐 |
| `node_modules/U4A` 실제 존재 | **이 PC 에 없다.** `package.json` `dependencies` 에도 없다(npm 이 설치하는 것이 아니다) |

### 판정

1. **개발 모드에서는 이 자리가 아예 안 탄다** — `intro.js:1342` 가 `resourceUrl` 을 인터넷 UI5 주소로 덮는다.
   → **장군님이 no-build 로 확인할 수 없는 자리다**(exe 전용 = 「미확인」으로 둘 항목).
2. **패키징본에서만 `file:///` 가 쓰이고, 거기서는 `u4a-ws://` 로 바꿀 수 없다** —
   가리키는 파일이 `resources/node_modules/U4A/…` = **asar 밖·앱 root 밖**이라 핸들러가 403 으로 막는다.
3. 게다가 그 폴더가 지금 **이 PC 에 없어** 빌드해도 그 파일이 안 들어간다. 패키징본에서 그 14개 창의
   UI5 bootstrap 이 실제로 무엇을 받는지는 **exe 로 확인하지 않았다 — 미검증.**

→ 그래서 U-1 은 U-2~U-6 과 같은 「주소 문자열 고치기」가 아니고, **구조를 정하는 일**이다.
   선택지와 내 안(①: 그 창들도 접속 서버 UI5 를 보게 한다)은 `.docs/TODO.md` 의 ★U-1 절에 적었다.
   근거: 이미지 아이콘 창을 같은 방식으로 고쳐 통과했다(테스트 G1, 2026-10-29).

### 또 밟을 함정

- `oSettings.UI5.resourceUrl` 은 **개발 모드와 패키징본에서 서로 다른 값**이다(CDN / 로컬 파일).
  개발 모드에서 멀쩡하다고 패키징본도 멀쩡한 것이 아니다 — 이 변수를 건드릴 때는 **두 모드를 따로** 본다.
- `process.resourcesPath` 는 `app.getAppPath()`(= `resources/app.asar`)의 **부모**다. 커스텀 프로토콜로
  바꿀 수 있는 것은 `getAppPath()` 아래뿐이다.

---

## 2026-10-29 (2) — U-1 은 **대상이 아니다**. 장군님 지적이 맞았다

장군님 「U-1은 이제 안쓰는거 아니야? 이전 원본 ws3.0에서 사용했던.. 거기는 UI5로 만들어졌기 때문에」 → **맞다.**

`oSettings.UI5.resourceUrl` 을 **읽는 곳 16곳을 하나씩** 확인했다(앞 절에서는 건수만 세고 생사를 안 봤다 — 내 잘못).

| 자리 | 생사 | 근거 |
|---|---|---|
| `ui5CssPopup_v2/control.js:55` | **살아 있고 이미 처리됨** | 2026-09-08 장군님 지시 주석(48~54행): 「패키지에 로컬 UI5 를 더 이상 싣지 않기 때문(node_modules/U4A 없음)」 → `APP.isPackaged` 면 서버 UI5. 개발 모드는 `resourceUrl`(=CDN) 유지가 **일부러 나눠 둔 설계** |
| `fnDialogPopupOpener.js:4466` | **살아 있음** | `oAPP.fn.fnAppShortCutDownPopupOpener`(쇼컷링크 생성 창). 값이 `config: S_config`(4539행)로 그 창에 넘어가고, 용도는 **바깥 브라우저(Chrome·Edge)** 용이라 `u4a-ws://` 로 바꿀 자리가 아니다 |
| `releaseNotePopup/js/main.js:30` · `main_latest.js:30` | **조건부 — 미확인** | `fnReleaseNotePopupOpener` 가 `checkWLOList("C","UHAK901369")` 면 V2(`relese_notes`)로 빠진다. 서버에 그 항목이 없으면 옛 창이 뜬다 |
| `findPopup/index.js` · `bindPopup/index.js` · `u4aDocPopup/index.js` · `uspNewPopup/index.js` · `errPageEditorPopup/errorPageEditor.js` | 죽음 | 그 `index.html`(옛 UI5 쪽)을 여는 곳이 `www` 어디에도 없다. `pathInfo.js` 는 새 HTML5 프레임(`findFrame.html`·`frame.html`·`errorPageEditorFrame.html`)을 가리킨다 |
| `optionPopup/optionS.html` · `optionPopup-origin/optionS.html` | 죽음 | 살아 있는 `optionM.html` 은 새 `js/optionMain.js` 만 로드한다(옛 `js/index.js` 가 `optionS.html` 을 iframe 에 넣던 길은 끊겼다) |
| `versionManagement/Popup/frame.js` | 죽음 | `pathInfo` VERMNG = `versionMng`(HTML5). `versionManagement` 는 UI5 원본 |
| `webDynConversionLog/Popup/frame.js` · `editorPopup_v2/Popup/frame.js` | 죽음 | `pathInfo` 에 없다 |
| `design/testFolder/AiInterface/index.js:97` | 죽음 | 화면에서 숨김 처리(`ws10_html.js`) |
| `floatingMenu/frame.html:48` · `ABAP.html:20` | 죽음 | 그 창을 켜는 자리가 없다(이 문서 L 항목) |

→ **U-1 은 U 묶음(주소를 `u4a-ws://` 로 바꿀 자리)에서 뺀다.** 남는 것은 쇼컷링크 창의 설정값을
   접속 서버 UI5 로 바꿀지 하나뿐이고, 그것은 **주소 방식 문제가 아니라 결정 사항**이라 TODO ★U-1 절에 옮겼다.

### 내가 틀렸던 것

- 앞 절에서 「읽는 곳 14곳」이라고 **건수만** 세고 **그 14곳이 지금 도는 코드인지 보지 않았다.**
  「소스에 있다 ≠ 지금 돈다」를 또 어겼다. 이 프로젝트는 옛 UI5 창과 새 HTML5 창이
  **같은 폴더 안에 짝으로** 남아 있어(`index.html`/`index.js` = 옛 · `*Frame.html`/`*Frame.js` = 새),
  **`pathInfo.js` 에 등록된 쪽이 사는 쪽**이다. 생사 판정은 거기서 시작한다.

---

## 2026-10-29 (3) — 화면 녹화 창: 렌더러의 상대경로 `require` 가 깨진다 (조사만, 아직 안 고침)

장군님 발견 — 「화면 선택」 창에서 `Uncaught Error: Cannot find module './msg'`,
`Require stack: internal/electron/js2c/renderer_init`. 추정(「커스텀 프로토콜 때문인 것 같다」)이 **맞다.**

- 창 주소 = `u4a-ws://app/ws30/ws10_20/Popups/screen_record/popups/monitor-select/index.html?…`
  (`monitor-select/window.js:101` 이 `u4aToAppUrl` 로 띄운다. `nodeIntegration:true`·`contextIsolation:false`).
- 렌더러의 `<script src>` 로 들어온 코드는 모듈이 아니라 **기준 폴더가 없다.** `file://` 때는 Electron 이
  문서 주소로 기준을 잡아 줘서 `./msg` 가 풀렸다. `u4a-ws://` 에서는 못 잡아 `renderer_init` 이 기준이 된다.
- `msg` 는 **폴더**이고 그 안에 `index.js` 가 있다.
- 이미 있는 preload(`electron/lib/protocol/ws_renderer_dirname.js`, 모든 세션에 `registerPreloadScript`)가
  `window.__dirname` 을 되살려 두었으므로, **`require(__dirname + '/msg')` 같은 절대경로로 바꾸면 된다.**
  preload 는 `__dirname` 만 되살린다 — `require` 의 기준 폴더는 되살리지 못한다(그래서 자리마다 고쳐야 한다).

### 고칠 자리 (렌더러 7개 파일 8줄)

`popups/` 아래 `control-panel/index.js:21` · `drawing/index.js:30`(`./text-input/window`)·`:31` ·
`drawing/text-input/index.js:55` · `history/index.js:20` · `indicator/index.js:28` ·
`monitor-select/index.js:29` · `settings/index.js:23` — 전부 각 폴더 `index.html` 이 `<script src="./index.js">` 로 읽는다(확인함).
`window.js` 쪽의 상대 `require`(`../../core/theme` 등)는 **Node 가 파일 경로로 푸는 자리라 문제 없다.**

### 같은 종류가 화면 녹화 밖에도 있다 (보고만)

- `bindPopup/frame.js:200` · `bindPopup/index.js` 3곳 — `parent.require("./utils/…")`.
  `frame.js` 는 살아 있는 창이다. 남의 라이브러리(ace·monaco) 안의 상대 `require` 는 자체 모듈 시스템이라 해당 없다.
