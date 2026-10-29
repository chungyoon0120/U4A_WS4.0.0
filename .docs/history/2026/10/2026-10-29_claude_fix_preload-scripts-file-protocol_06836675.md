# 앱이 시작할 때 읽는 라이브러리 4개가 아직 `file://` 였다

- 날짜: 2026-10-29
- 지시: 장군님 「이런 외부 라이브러리들도 아직도 파일 프로토콜이야」 (Network 탭 화면과 함께)
- 고친 자리: `www/ws30/ws10_20/js/library-preload.js` — `aPreloadScripts` 의 **앞 4개 항목**

## 장군님이 보여 주신 것 (확정 근거)

```
창 주소     : u4a-ws://app/ws30/ws10_20/index.html?browserkey=…
Request URL : file:///C:/Users/socce/…/U4A_WS4.0.0/www/js/shortcut.js
Status Code : 200 OK
Accept      : text/plain, */*; q=0.01        ← <script src> 가 아니라 jQuery 로 가져온 표시
```

## 어디서 그러고 있었나

`library-preload.js` 가 앱 시작 때 읽을 스크립트 **50개**를 배열로 갖고 있고,
`oAPP.loadLibrary` 가 `$.ajax({dataType:"text"})` 로 읽어 `eval` 한다.

| 항목 | 주소 모양 | 결과 |
|---|---|---|
| 46개 | `"./js/ws_common.js"` 같은 **상대경로** | 창 주소 기준 → `u4a-ws://` ✅ |
| **4개** | `PATH.join(APPPATH, "js/shortcut.js")` · `parent.getPath("JQUERYUI")` | **OS 경로 → `file://`** ❌ |

네 개는 `jquery-ui.min.js` · `shortcut.js` · `download.js` · `dateformat.js` 로,
전부 `www/js/` 에 있다. 나머지 46개는 `www/ws30/ws10_20/js/` 라 깊이가 다르다.
**그 깊이 차이 때문에** 누군가 OS 경로로 바꿔 놓은 것으로 보인다 —
주석에 `// URL: "../js/shortcut.js"` 가 남아 있는데 그 경로는 `www/ws30/js/` 를 가리켜 **틀렸다.**

## 영향도 (고치기 전에 뽑았다)

| 자리 | 그 값을 쓰는 곳 |
|---|---|
| `aPreloadScripts` 배열 | `oAPP.loadLibrary` **한 곳**(`library-preload.js:341`) |
| `pathInfo.js` 의 `JQUERYUI` | `library-preload.js:41` **한 곳** |
| `pathInfo.js` 의 `JQUERYUICSS` | **아무 데서도 안 쓴다** |
| `pathInfo.js` 의 `COMMONCSS` | `_ServerList_ui5.js` 뿐 — `_` 로 시작하는 파일이라 **탐색 제외 대상**(현행 아님) |

## 고친 방법

네 줄을 **이 화면 기준 상대경로**로 바꿨다.

```js
URL: "../../js/jquery-ui.min.js",
URL: "../../js/shortcut.js",
URL: "../../js/download.js",
URL: "../../js/dateformat.js",
```

`library-preload.js` 는 `www/ws30/ws10_20/` 화면에서 돌므로 `../../js/` = `www/js/` 다.
**같은 화면의 `index.html:45` 가 이미 `<script src="../../js/jquery.min.js">` 로 그 폴더를 부르고 있다** —
확인된 선례라 깊이를 짐작하지 않았다.

`pathInfo.js` 의 `JQUERYUI` 항목은 **그대로 뒀다.** 그 파일은 Node(FS)용 OS 경로 사전이고,
화면 주소와는 쓰임이 다르다. 그 원칙을 코드 주석으로 적어 뒀다.

## 곁다리로 드러난 것 (고치지 않았다)

**이 네 라이브러리는 로드만 되고 아무도 쓰지 않는다.**

| 라이브러리 | 실제 호출 |
|---|---|
| `shortcut.js` | `shortcut.add` / `shortcut.remove` **0건** |
| `dateformat.js` | `dateFormat(` **0건** |
| `download.js` | **0건** |
| `jquery-ui.min.js` | 유일한 자리(`fnShowMultiFooterMsg.js:72` 의 `.resizable()`)가 **주석 처리** |

지우면 시작이 빨라지지만 **원본에 있던 것을 빼는 일**이라 지시를 받았다.
→ **장군님 결정 2026-10-29: 빼지 않는다.** 네 개 모두 시작 목록에 그대로 둔다. 이 건은 끝났다.

## 또 밟을 함정

- **전수 조사에서 `$.ajax` 의 `url:` 을 빼먹지 말 것.** 주소가 들어가는 모양은
  ① 대입(`.src =`) ② HTML 문자열 조립(`'<img src="' + x`) ③ CSS `url(…)`
  ④ `setAttribute` ⑤ **`$.ajax`/`fetch` 의 `url`** 다섯 가지다. 앞 세 차례 조사가 ⑤를 통째로 놓쳤다.
- **Network 탭의 `Accept` 헤더가 단서다.** `text/plain, */*; q=0.01` 이면 `<script src>` 가 아니라
  jQuery 가 가져온 것이다. 그러면 소스에서 `<script` 를 찾아도 안 나온다.
- **경로 깊이가 다른 파일이 한 배열에 섞여 있으면** 누군가 OS 경로로 바꿔 놓기 쉽다.
  고치기 전에 그 화면의 **다른 상대경로 선례**를 먼저 찾는다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 통과. 테스트 = TODO 1-3.
- 이 네 개가 못 읽히면 `loadLibrary` 의 `error` 콜백이 `console.error("load failed: …")` 를 찍는다.
  그래서 테스트가 Console 확인이다.
