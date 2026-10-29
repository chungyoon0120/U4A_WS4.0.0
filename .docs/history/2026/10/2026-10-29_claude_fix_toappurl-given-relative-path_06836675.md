# 오류 페이지 에디터 미리보기 창이 404 — `u4aToAppUrl` 에 **상대경로**를 넘겼다

- 날짜: 2026-10-29
- 지시: 장군님 「오류 페이지 에디터 미리보기 창 확인해바 오류 나니깐」 (Console · Network 화면과 함께)
- 고친 자리: `www/ws30/ws10_20/Popups/errPageEditorPopup/errorPageEditorPreview.js:182`

## 장군님이 보여 주신 것 (확정 근거)

```
Request URL : u4a-ws://app/errorPageEditorPreviewBody.html?BGCOL=%23161d26
Status Code : 404 Not Found
```

실제 파일은 `www/ws30/ws10_20/Popups/errPageEditorPopup/errorPageEditorPreviewBody.html` 이다.
요청은 **`www/` 바로 아래**를 찾고 있었다.

## 원인

```js
var sSrc = "errorPageEditorPreviewBody.html";          // 상대경로
oFrame.src = REMOTE.getGlobal("u4aToAppUrl")(sSrc);    // ← 여기
```

`toAppUrl` 은 **상대경로를 받으면 앱 뿌리(`www/`) 기준**으로 만든다
(`ws_app_protocol.js:394` 「④ 상대 경로면 앱 폴더 기준」). 그래서 폴더 깊이가 통째로 사라졌다.

**상대경로는 애초에 감쌀 필요가 없다.** iframe 이 자기 문서 기준으로 풀어 주므로
그냥 넣으면 맞는 자리를 가리킨다.

### 언제 들어왔나

커밋 `f40db53e` [2026-10-27 19:25] 「일렉트론 45 업그레이드 수정분 반영 — 112개 + 겹친 4개 수동 병합」.
**OS 경로와 상대경로를 가리지 않고 한꺼번에 `u4aToAppUrl` 로 감쌌다.**
같은 커밋에서 괄호 오타 2곳(`getGlobal("u4aToAppUrl")(p.replace)(…)`)도 나왔다 — 같은 성격의 사고다.

## 전수 조사 — 같은 병은 이 1곳뿐

`u4aToAppUrl` 호출 전부(`www` + `electron`)의 **첫 인자를 떼어내고**, 변수면 위 40줄에서
그 대입을 찾아 OS 경로인지 상대경로인지 가렸다. 스크립트 = `scratchpad/toappurl.py` (일회용).

| 자리 | 넘기는 값 | 판정 |
|---|---|---|
| **`errorPageEditorPreview.js:182`** | `"errorPageEditorPreviewBody.html"` | **상대경로 — 404** ❌ |
| `floatingMenu/js/handle.js:128` | `` `${_DIRNAME}/floatingMenu/index.html` `` — `_DIRNAME` = www 까지의 절대 경로 | OS 경로 ✅ |
| `ui5CssPopup_v2/main/views/control.js:649` | `C_DETAIL_HTML_PATH` = `PATH.join(__dirname, "..", "detail", "frame.html")` | OS 경로 ✅ |
| `js/fnFavIconPopupOpen.js:231` | `sSrc` = `PATH.join(designRootPath, "favIconPopup", "index.html")` | OS 경로 ✅ |

나머지는 전부 `PATHINFO.*` · `PATH.join(APPPATH, …)` · `WSUTIL.QueryString.build(OS경로, …)` 였다.

## 고친 방법

`u4aToAppUrl` 을 빼고 상대경로를 그대로 넣는다. 왜 그런지 주석으로 남겼다.

## ★판별 기준 (다음에 또 만날 때)

| 넘기는 값 | `u4aToAppUrl` |
|---|---|
| OS 경로 (`PATH.join(APPPATH, …)` · `PATHINFO.*` · `__dirname` · `app.getPath(…)`) | **쓴다** |
| 그 화면 기준 상대경로 (`"./x.html"` · `"../../js/x.js"` · `"x.html"`) | **쓰지 않는다** — 그대로 넣는다 |
| 이미 주소 (`http:` · `data:` · `u4a-ws:`) | 쓰나 마나 — 그대로 돌려준다 |

## 또 밟을 함정

- **일괄 치환으로 주소를 감쌀 때는 「OS 경로인지」를 한 줄씩 본다.** 상대경로까지 감싸면
  폴더 깊이가 통째로 사라져 404 가 되는데, **화면은 그냥 빈 칸으로 보여** 원인이 안 보인다.
- `toAppUrl` 은 상대경로를 거부하지 않는다 — **조용히 앱 뿌리 기준으로 만든다.**
  그래서 로그에도 안 남고 Network 탭의 Request URL 을 봐야 드러난다.
- 404 가 Console 에 **두 줄** 찍힌다(리소스 로드 실패 + iframe). 같은 한 건이다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 통과. 테스트 = TODO 1-2.
