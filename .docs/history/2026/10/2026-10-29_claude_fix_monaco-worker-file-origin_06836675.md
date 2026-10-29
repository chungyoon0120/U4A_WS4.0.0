# Monaco 편집기의 worker 가 `file:///` 로 나가서 막히던 것 — 호스트 6곳

- 날짜: 2026-10-29
- 지시: 장군님이 Network 화면을 주심 → 「워커 전수 검사 안했어?」 → 「진행해」
- 고친 자리: **6곳** (아래 표)

## 증상

소스 패턴 창을 열면 `workerMain.js` 가 **`(canceled)`**.
장군님이 Headers 를 열어 주셔서 주소가 드러났다.

```
Request URL: file:///C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/lib/monaco/vs/base/worker/workerMain.js
```

창은 `u4a-ws://app/ws30/ws10_20/Popups/patternPopup/frame.html` 인데
worker 만 `file:///` 로 나갔다 → **origin 이 달라 막힌다.**

## 원인

호스트들이 Monaco 의 `vs` 경로를 **Windows OS 경로**로 만들었다.

```js
const MONACO_VS_ROOT_PATH = PATH.join(APPPATH, "lib", "monaco", "vs");   // C:\…\www\lib\monaco\vs
```

Monaco 는 이 값을 기준으로 worker 주소를 만든다. OS 경로를 주면 `file:///C:/…` 가 된다.
모듈(`loader.js` · `editor.main.js`)은 200 으로 떴지만 **worker 는 origin 검사가 더 엄격해** 막혔다.

Monaco 내부(`editor.main.js`)는 worker 주소가 `http:`·`https:`·`file:` 로 시작하고 origin 이 다르면
blob 으로 감싸려 하는데, 그 blob 을 만들려면 그 파일을 fetch 해야 한다 —
`u4a-ws://` 창에서 `file:///` 는 fetch 할 수 없다.

## 고친 방법 — 창 주소 기준 절대 경로

```js
const MONACO_VS_ROOT_PATH = new URL("/lib/monaco/vs", location.href).href;
const MONACO_LOADER_PATH  = MONACO_VS_ROOT_PATH + "/loader.js";
```

`u4a-ws://app/` = `www` 폴더이므로 `/lib/monaco/vs` → `u4a-ws://app/lib/monaco/vs`.
**창과 같은 origin** 이라 worker 가 그대로 뜬다.

`REMOTE`·`toAppUrl` 을 거치지 않는 이유 — 이 호스트들은 iframe 이라 `require` 가 없고
부모 창의 전역(`PATH`·`APPPATH`)을 빌려 쓴다. 부모에 `REMOTE` 가 있는지는 확인되지 않았고,
`location` 기준이면 **부모에 의존하지 않고 깊이와도 무관**하다.

`PATH.join` 대신 문자열 더하기를 쓴 이유 — `PATH.join` 은 `u4a-ws://` 의 `//` 를 `/` 로 접어 주소를 망친다.

## 고친 6곳

| 파일 | 창 |
|---|---|
| `js/codeeditor/index.html` | 공통 호스트 — 소스 패턴 · CSS/JS/HTML 편집기 · MIME |
| `js/usp/monaco/index.html` | USP 편집기 |
| `Popups/editorPopup/host/index.html` | 글 편집기 별창 |
| `Popups/versionManagement/Popup/monaco/index.html` | 버전관리 |
| `Popups/versionMng/host/index.html` | 버전관리(옛 판) |
| `Popups/monacoThemeDesign/Popup/js/index.js` | 테마 디자이너 |

## 전수 조사를 두 번 틀렸다

1. **10-28 「워커 4곳 ✅ 끝」이 틀렸다** — `new Worker(` 만 보고 끝냈다.
   그중에도 상대경로 2곳이 남아 있었다(TODO 10-6). Monaco 는 `new Worker(` 로 안 걸린다.
2. **「Monaco 호스트 5곳」도 틀렸다** — `MONACO_VS_ROOT_PATH` 라는 **이름**만 찾아서
   이름이 다른 테마 디자이너(`oAttr.monacoVSPath`)를 빠뜨렸다.
   `loader.js` 를 싣는 자리로 다시 훑어서 찾았다.

**찾는 법(이름이 아니라 하는 일로)**: `grep -rn "loader\.js" www`
— Monaco 를 쓰는 창은 반드시 loader 를 싣는다. 변수 이름은 창마다 다르다.

## 영향도

`MONACO_LIB_PATH`(= `lib/monaco`)는 **그대로 뒀다.** `usp/monaco/index.js:169` 가 그 값으로
**스니펫 폴더를 파일로 읽는다** — 거기는 OS 경로가 맞다. 바꾼 것은 `vs` 경로 하나뿐이다.

`editorPopup/host` · `versionMng/host` 에서는 `APPPATH` 가 이제 안 쓰이지만 선언은 그대로 뒀다
(지시 범위 밖이고 지워도 얻는 것이 없다).

## 또 밟을 함정

- **`vs` 경로는 주소다. `lib/monaco` 경로는 파일 경로다.** 둘을 같은 것으로 보면 또 깨진다.
- **worker 는 모듈보다 origin 검사가 엄격하다.** 모듈이 200 으로 떴다고 안심하면 안 된다.
- `u4a-ws://` 주소에 `PATH.join` 을 쓰면 `//` 가 접힌다. 주소는 문자열로 잇는다.
- 새 Monaco 창을 만들 때는 **위 두 줄을 그대로** 쓴다. OS 경로를 넣지 않는다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 와 전수 grep 만 했다.
  테스트 = TODO 1-12(소스 패턴) · 1-13(CSS/JS/HTML 편집기) · 1-14(USP) · 1-15(버전관리) · 1-16(테마 디자이너).
- `location.origin` 이 `u4a-ws://app` 으로 나오는지는 **앱에서만 확인된다.**
  scheme 이 `standard: true` 로 등록돼 있으므로 그렇게 나와야 한다(`ws_app_protocol.js:154`).
  아니라면 위 5개 테스트가 전부 실패하므로 바로 드러난다.
