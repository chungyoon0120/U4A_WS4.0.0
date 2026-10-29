# USP 트리 SVG 아이콘 — 커스텀 프로토콜 없이도 뜨는 까닭 · `<img src>` 전수 조사

- 날짜: 2026-10-29
- 지시: 장군님 「USP에 좌측 트리에 아이콘들이 svg 아이콘으로 되어있는데 이건 커스텀 프로토콜로 안해도 나오네?」
- 조사 대상: `www` 전체에서 **HTML 문자열을 조립해 이미지 주소를 넣는 자리**

## 장군님이 보여 주신 Network 탭 (확정 근거)

```
Request URL : file:///C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/svg/folder.svg
Status Code : 200 OK
Content-Type: image/svg+xml
```

## 왜 뜨나

| 단계 | 일어나는 일 |
|---|---|
| ① | `ws_html5_usp_tree.js` 의 `_iconSrc()` 가 `C:\…\www\svg\folder.svg` (Windows 생경로)를 돌려준다 |
| ② | Chromium 이 드라이브 문자를 알아보고 **`file:///C:/…/www/svg/folder.svg`** 로 정규화한다 |
| ③ | 메인 창이 **`webSecurity: false`** (`www/settings/BrowserWindow/BrowserWindow-settings.json:14`) 라 `u4a-ws://` 페이지에서 `file://` 이미지를 불러오는 것이 막히지 않는다 |
| ④ | 200 OK — 보인다 |

## ★ 내가 틀렸던 판정 (같은 함정을 또 밟지 않게)

처음에 「`c:` 가 URL scheme 으로 해석된다」고 답했다. **틀렸다.**

- node 의 `new URL()` 로 흉내 내서 판정했는데, **node 의 URL 파서는 Windows 드라이브 문자를 모른다.**
  Chromium 은 안다 — `C:\…` 를 `file:///C:/…` 로 바꾼다.
- **창의 `webSecurity` 설정을 안 보고** 말했다. 그것이 되고 안 되고를 가르는 값이었다.

**교훈: 브라우저의 URL 해석을 node 로 흉내 내서 판정하지 않는다.** Network 탭의 Request URL 이 답이다.

## 전수 조사 — 방법을 바꿨다

앞선 두 차례 전수 조사가 이 자리를 놓쳤다. 까닭:

- 1차는 `.src = ` · `loadURL(` · `new Worker(` 같은 **대입 패턴**으로 찾았다 →
  `'<img src="' + src + '">'` 는 **문자열 조립**이라 안 걸린다.
- 2차는 `file://` 이라는 **글자**와 `_toFileUrl` 이라는 **이름**으로 찾았다 →
  이 자리는 둘 다 없이 **생경로를 그대로** 넣는다.

이번에는 `<img … src=` · `url(` · `background-image` · `setAttribute("src"/"href")` · `poster=` 를
**문자열 조립(`+` 또는 `${}`)이 있는 줄**에서 뽑고, 나온 57줄의 **변수 출처를 한 줄씩 따라갔다.**
스크립트 = `scratchpad/imgsweep.py` (일회용).

## 결과 — 생경로를 넣는 자리는 **하나뿐**

| 자리 | 지금 |
|---|---|
| **`js/usp/ws_html5_usp_tree.js:103`** | **생경로 그대로** ❌ |
| `js/ws_html5_ws20_tree.js:628` (WS20 트리) | `u4aToAppUrl` ✅ |
| `js/fnP13nDesignPopupOpen.js:1183` | `u4aToAppUrl` ✅ |
| `js/ws_html5_ws20_edit.js:1965` · `2295` | `u4aToAppUrl` ✅ |
| `js/ws10_html.js:1023` (로고) | `u4aToAppUrl` ✅ |
| `Login/Login.js:387` (로고) | `u4aToAppUrl` ✅ |
| `Popups/optionPopup/js/optionMain.js:382` (로고) | `u4aToAppUrl` ✅ |
| `Popups/bindPopup/designArea/designArea.js:1158` | `u4aToAppUrl` ✅ |
| `Popups/patternPopup/frame.js:167` | `u4aToAppUrl` ✅ |
| `js/usp/ws_html5_usp_editor_ctxmenu.js:81` | **서버가 주는 `ICON` 값** — 미확인 |

`ServerList.js:3799` · `Login.js:1611`·`1648` · `design/js/main.js:307` · `ws_html5_ws20_prev.js:203` 은
`new URL(…, window.location.href)` 라 **창 주소 기준**으로 풀린다 — 안전.

## 왜 그냥 두면 안 되나 (고치지 않았다 — 지시 대기)

지금은 `webSecurity: false` 덕에 뜬다. 다만

1. **설치본에서 경로가 달라진다** — `app.getAppPath()` 가 `…\resources\app.asar` 가 된다.
   `file://` 로 asar 안을 읽을 수 있는지는 **확인 안 했다.**
2. `webSecurity` 를 켜면 그 순간 전부 막힌다.
3. **`onerror="this.style.display='none'"`** 이라 깨져도 **조용히 숨는다** — 아무도 모른다.

## 또 밟을 함정

- **`<img>` 는 cross-origin 이 막히지 않는 태그다.** 그래서 `file://` 이미지가 custom protocol
  페이지에서 떠도 「경계가 멀쩡하다」는 뜻이 아니다. 같은 경로를 `fetch` · `new Worker` · `<iframe>` 로
  쓰면 그 자리는 막힌다.
- **전수 조사에서 「대입 패턴」만 찾으면 HTML 문자열 조립을 통째로 놓친다.**
  주소가 들어가는 모양은 ① 대입(`.src =`) ② 문자열 조립(`'<img src="' + x`) ③ CSS `url(…)`
  ④ `setAttribute` 네 가지다. 넷을 다 훑어야 「전수」다.
- `onerror` 로 숨기는 자리는 **실패가 로그에도 안 남는다.** 새로 만들 때는 `onerror` 에
  `U4ALOG.warn` 을 같이 넣는다.

## 미검증

- 설치본(`app.asar`)에서 `file:///…/app.asar/www/svg/folder.svg` 가 읽히는지 **확인 안 했다.**
- `ws_html5_usp_editor_ctxmenu.js:81` 의 `ICON` 은 서버가 주는 값이라 **어떤 모양인지 못 봤다.**
  앱을 돌려 실제 값을 봐야 한다.

---

# 이어서 — 고쳤다 (같은 날, 장군님 「고쳐」)

고친 자리 = `www/ws30/ws10_20/js/usp/ws_html5_usp_tree.js`

## 무엇을 했나

`_svgFolder` 는 **두 가지로 쓰이고 있었다.**

| 쓰임 | 필요한 모양 |
|---|---|
| `FS.readdirSync(_svgFolder)` | **OS 경로** (`C:\…\www\svg`) |
| `_svgFolder + "/folder.svg"` → `<img src>` | **화면 주소** (`u4a-ws://app/svg/folder.svg`) |

그래서 **변수를 둘로 갈랐다.** `_svgFolder` 는 OS 경로 그대로 두고,
`_svgUrlRoot` 를 새로 두어 `_ensureSvgList()` 안에서 **한 번만** `u4aToAppUrl` 로 바꾼다.
파일 이름은 `_svgUrl(sFile)` 이 `encodeURIComponent` 로 인코딩해 붙인다.

### 왜 파일마다 `u4aToAppUrl` 을 부르지 않았나

`REMOTE.getGlobal` 은 **동기 IPC** 다. 트리 줄마다 부르면 노드 수만큼 왕복한다.
뿌리 폴더는 하나로 고정이므로 1회면 된다. 느린 PC 를 생각하면 이쪽이 맞다.
(WS20 트리는 노드마다 경로가 달라 매번 부르는 것이 맞다 — 거기는 그대로 뒀다.)

### 왜 `toAppUrl` 에 폴더 경로를 넘겨도 되나

`toAppUrl` 은 뿌리로부터의 상대 경로를 만들어 **조각마다 `encodeURIComponent`** 를 건다
(`ws_app_protocol.js:447`). 폴더를 넘기면 `u4a-ws://app/svg` 가 나온다.
그 뒤에 붙이는 파일 이름은 **폴더에서 읽은 것**(`FS.readdirSync`)이라 무엇이 들어 있을지
모르므로 `_svgUrl` 이 따로 인코딩한다.

### 로그

- `u4aToAppUrl` 호출이 터지면 `console.error("[WS30] svg url root convert error:", e)`
- 결과가 비면 `U4ALOG.warn("GUARD_EXIT", "u4aToAppUrl for svg folder", "USP tree icons are hidden")`
  — 아이콘이 안 보이는 까닭을 로그만 보고 알 수 있게.

## 건드리지 않은 것 (보고만)

1. **`onerror="this.style.display='none'"` 는 그대로 뒀다.** 실패해도 로그가 안 남는다.
   `<img>` 인라인 핸들러에 로그를 넣으면 HTML 문자열이 지저분해진다. 별도 지시가 필요하다.
2. **`u4aToAppUrl` 을 부르는 한 줄이 여러 파일에 복사돼 있다** —
   `ws_html5_ws20_tree.js:627` · `fnP13nDesignPopupOpen.js:107` · `ws_html5_ws20_edit.js` ·
   `bindPopup/designArea.js` · `patternPopup/frame.js` 등. 전부
   「`http:`/`data:` 면 그대로, 아니면 `u4aToAppUrl`」 **같은 판단**이다.
   공통(`WSUTIL`)으로 뺄 자리지만 **도는 코드 여러 곳을 건드리는 영향도 작업**이라 지시를 받아야 한다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 통과. 테스트 = TODO 1-1 · 1-2.
- 설치본(`app.asar`)에서 `u4a-ws://app/svg/…` 가 읽히는지는 여전히 **확인 안 했다.**
  다만 창·화면 파일이 모두 같은 프로토콜로 떠 있으므로 아이콘만 다를 까닭은 없다.
