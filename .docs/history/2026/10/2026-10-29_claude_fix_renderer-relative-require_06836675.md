# N3 — 화면 녹화 창들이 `require('./msg')` 에서 터지던 것

- 날짜: 2026-10-29
- 지시: 장군님 「화면 녹화 프로그램에서, 혹시 require등을 상대경로로 사용해서 문제된거 같은데 확인좀 해줘.. 커스텀 프로토콜 때문인거 같아서」 → 「해바 우선」
- 고친 자리: `electron/lib/protocol/ws_renderer_dirname.js` — **2줄 추가**(`module.filename` · `module.paths`)

## 증상

화면 녹화 창이 `Cannot find module './msg'` 로 터진다.
`Require stack` 이 `internal/electron/js2c/renderer_init` 를 가리켰다.

터지는 자리 = **8줄 / 7개 파일**. 전부 `www/ws30/ws10_20/Popups/screen_record/popups/` 아래다.

| 파일 | 줄 |
|---|---|
| `control-panel/index.js` | 21 |
| `drawing/index.js` | 30 · 31 |
| `drawing/text-input/index.js` | 55 |
| `history/index.js` | 20 |
| `indicator/index.js` | 28 |
| `monitor-select/index.js` | 29 |
| `settings/index.js` | 23 |

## 원인

Electron 의 `lib/renderer/init.ts` 는 **주소가 `file:` 일 때만** 렌더러에 4개를 넣어 준다.

```
global.__filename = path.normalize(decodeURIComponent(pathname));
global.__dirname  = path.dirname(global.__filename);
global.module.filename = global.__filename;
global.module.paths    = Module._nodeModulePaths(global.__dirname);
```

다른 주소는 `else` 로 가서 `__filename` 에
`<resources>/electron.asar/renderer/init.js` 라는 **가짜 경로**를 넣는다.

2026-10-27 에 custom protocol(`u4a-ws://`) 로 바꾸면서 이 파일을 만들었는데,
**앞의 두 개만 넣고 뒤의 두 개를 빠뜨렸다.** 그래서 `require('./msg')` 가 그 가짜 경로를
기준으로 삼아 `electron.asar/renderer/` 안에서 `msg` 를 찾다가 못 찾았다.

## 왜 어떤 곳은 멀쩡했나 — 장군님 「이전에 테스트 할때는 잘 됐었는데」 가 맞았다

**로드 방식에 따라 갈린다.** 둘 다 맞는 말이었다.

| 로드 방식 | 상대경로 require | 왜 |
|---|:---:|---|
| `require(절대경로)` 로 불린 모듈 **안** | **잘 된다** | Node 가 **그 파일의 filename** 기준으로 푼다. 주소 체계와 무관 |
| HTML 의 `<script src>` 로 실린 파일 | **터진다** | 기준이 `global.module.filename` 인데 그게 가짜 경로였다 |

- 멀쩡한 쪽 실례: `dev_browser` — `js/ws_fn_02.js:1499` 가 `parent.require(절대경로)` 로 부르고,
  그 안의 `require("./common/index.js")` 는 지금도 돈다.
- 터진 쪽 실례: `control-panel/index.html:449` `<script src="./index.js">` → 그 `index.js:21`.

`file://` 때는 **두 경우 다** 됐다. 그래서 전에 보신 것이 어느 쪽이든 「잘 됐다」가 사실이다.

## 버린 방법

### `<base href>` — 안 된다 (장군님 제안, 소스로 확인 후 반박)

장군님 「html태그에 base href인가 … 방법이 있던걸로 기억하는데」.
Electron 의 `lib/renderer/init.ts` 를 열어 확인했다 — **`document.baseURI` 도 `<base href>` 도
그 코드에서 전혀 읽지 않는다.** 보는 것은 `window.location`(`protocol` · `pathname` · `host`)뿐이다.
`<base href>` 는 HTML 리소스(`<script src>` · `<img>` · CSS `url()`)에만 먹고, Node 의 `require` 와는
다른 체계라 닿지 않는다.

### `require` 자체를 감싸기 — 더 나은 길이 나와서 안 했다

처음에는 preload 에서 `window.require` 를 감싸, 상대경로면 `window.__dirname` 기준 절대경로로
바꿔 원래 require 에 넘기려 했다. 장군님께 승인까지 받았으나(「해」) 중단됐고, 다시 보니
**Electron 이 `file:` 때 하던 그 세팅을 그대로 채우는 것**이 더 간단하고 부작용이 없다.
감싸기는 새 코드를 만드는 것이고, 이쪽은 Electron 과 **똑같은 값**을 넣는 것이다.

### 8줄을 `PATH.join(__dirname, "msg")` 로 고치기 — 안 했다

고칠 수는 있지만 앞으로 같은 줄이 생길 때마다 되풀이한다.
복붙 금지 규칙(`.claude/rules/code.md`)과도 어긋난다.

## 실측 — `module.filename` 이 상대경로 require 의 기준인지 직접 확인

추측으로 쓰지 않으려고 `node` 로 돌려 봤다.

```
1) module.filename before = …/reqtest/run.js
2) require('./msg') failed as expected = MODULE_NOT_FOUND
3) after fixing module.filename, require('./msg') = MSG_FROM_SUB
```

`module.filename` 을 `sub/whatever.js` 로 바꾼 뒤 `require('./msg')` 가 `sub/msg.js` 를 정확히 찾았다.

## 영향도 — 읽는 코드 0곳

`module.filename` · `module.paths` 를 **읽거나 쓰는 코드가 `www` · `electron` 전체에 0곳**이다
(2026-10-29 전수 grep). 지금 그 자리에는 Electron 이 넣은 쓸모없는 가짜 경로가 들어 있고
아무도 보지 않는다. 그래서 바꿔도 깨질 자리가 없다.

## 또 밟을 함정

- **`u4a-ws://` 로 뜨는 창에서 `<script src>` 로 실린 파일은 Node 의 「나」를 모른다.**
  Electron 이 `file:` 에만 넣어 주는 값이 4개라는 것을 기억할 것 — `__filename` · `__dirname` 만
  채우면 **절반만 고친 것**이다. `require('./…')` 는 `module.filename` 을, `require('이름')` 은
  `module.paths` 를 본다.
- **같은 파일 아래쪽 블록이 sub-frame 에서 `window.module = undefined` 를 한다**(UI5 UMD 충돌 방지).
  객체 자체는 `window.__node.module` 에 보관되므로 여기서 넣은 `filename` 값도 함께 살아 있다.
  되살리는 쪽은 `www/ws30/ws10_20/index.js` 의 `_restoreNodeGlobals()`.
- **`window.module` 이 preload 시점에 없을 수 있는지는 아직 확인하지 않았다.** 그래서
  없을 때는 `[PDIR] PDIR-003` 경고를 남기고 그냥 지나간다. 테스트에서 그 줄이 보이면 그쪽부터 본다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 만 통과했다. 테스트 = TODO 의 N3-1 · N3-2 · N3-3.
- preload 는 **모든 창**에 들어가므로 다른 창 회귀 확인이 필요하다 — TODO 의 H1 이 그 역할이다.

## 참고

- Electron `lib/renderer/init.ts` — <https://raw.githubusercontent.com/electron/electron/main/lib/renderer/init.ts>
- electron-serve README — custom protocol 에서 상대경로 require 가 깨지는 것과 권하는 우회
  (<https://cdn.jsdelivr.net/npm/electron-serve@3.0.1/readme.md>)
