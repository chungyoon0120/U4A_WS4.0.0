# WS20 미리보기가 UI5 부트스트랩에서 로그인 세션을 죽이던 것 — 아이디·비번 쿼리 두 줄 막음

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「우선 주석 막어줘」
  (앞선 보고 「미리보기 부트스트랩 주소에서 아이디·비번 두 개를 뺍니다」 에 대한 승인)

## 증상

로그인은 성공. WS20 작업화면에 들어가면 미리보기가 안 그려지고 Console 에:

```
A syntax error occurred while evaluating 'sap/ui/layout/library-preload.js'
Failed to execute 'sap/ui/layout/ResponsiveFlowLayout.js': Unexpected token '<'
```

## 원인 (Network 탭 실측으로 확정)

| 요청 | 결과 |
|---|---|
| `sap-ui-core.js?sap-user=…&sap-password=…&sap-client=800&sap-language=KO` | 200 · `application/x-javascript` · **성공** |
| `sap/ui/layout/library-preload.js` (쿼리 없음) | 200 · **`text/html`** · `Saploginstatus: Logon` → **로그인 화면 HTML** |

성공한 요청의 **Request `Cookie` 에 `MYSAPSSO2` 와 `SAP_SESSIONID_U4A_800` 이 둘 다 실려 있었다.**
즉 **쿠키는 정상으로 실린다.**

그런데 그 응답의 `Set-Cookie` 는 `sap-usercontext` 하나뿐 — **새 세션 쿠키가 안 온다.**
그 다음 요청이 받은 로그인 화면 응답은 `MYSAPSSO2=0` · `sap-ssolist=0` · `SAP_SESSIONID_U4A_000=0`
을 **`expires=Tue, 01-Jan-1980`** 으로 보낸다 = **쿠키 삭제 지시.**

→ 주소에 아이디·비번을 달고 요청하면 SAP 이 **새로 로그인**을 한다.
   새 로그인이 기존 세션을 밀어내는데 새 세션 쿠키는 안 받으니, 바로 다음 요청부터 세션이 없다.
   지워진 쿠키 이름이 쓰던 `800` 이 아니라 **`000`** 인 것이 세션이 다른 자리로 옮겨 간 흔적이다.

## 고친 자리 — 한 곳, 두 줄

`www/ws30/ws10_20/design/preview/index.js` `loadUi5BootstrapScript` 안

```js
// oParam.append("sap-user", _userInfo.ID);
// oParam.append("sap-password", _userInfo.PW);
oParam.append("sap-client", _userInfo.CLIENT);     // 그대로 둠
oParam.append("sap-language", _userInfo.LANGU);    // 그대로 둠
```

`sap-client` · `sap-language` 는 설정값일 뿐 **새 로그인을 일으키지 않아** 그대로 두었다.

★**원본에도 이 두 줄이 있다** — `U4A_WS_DESIGN` 의 `design/preview/index.js` 4608~4609행.
  원본과 달라지는 변경이라 장군님 지시를 받고 막았다.

부수 효과: **비밀번호가 주소창·DevTools·로그에 그대로 찍히던 것**도 같이 없어진다.

## 검증

- `node --check` 통과
- **눌러 보지 않았다** — TODO 테스트 항목 5 로 올렸다

## 버린 방법 · 틀렸던 판정 (되풀이하지 말 것)

판정이 **세 번 바뀌었다.** 전부 「끝까지 보기 전에 판정을 쓴」 탓이다.

1. **「iframe 이라서 cross-site 라 쿠키가 안 실린다」** → 틀림.
   미리보기 iframe 은 로컬 `u4a-ws://…/preview/index.html` 을 로드하고 `sandbox` 도 없어
   부모와 **같은 origin·같은 session** 이다. 장군님 지적(「부모에서 쿠키가 있으면 iframe 도 자동 적용돼야지」)이 맞았다.
2. **「UI5 내부 요청이 `withCredentials` 를 안 켜서 쿠키를 안 보낸다」** → 틀림.
   Request 헤더에 쿠키가 실려 있는 것을 실측으로 확인했다.
3. **「`sap/ui/layout` 묶음 파일 하나만의 문제다」** → 틀림.
   응답 헤더를 안 보고 Network 탭 아이콘 색과 Console 순서만으로 뒤집었다.

**다음에 같은 증상이면 이것부터 본다** — `Unexpected token '<'` 가 보이면
**그 요청의 Response headers 에서 `Content-Type` 과 `Saploginstatus`, `Set-Cookie` 의 `expires`** 를 먼저 읽는다.
아이콘 색·Console 순서로는 아무것도 가려지지 않는다.

## ★함정

- SAP 은 인증 실패를 **401 이 아니라 200 + 로그인 화면 HTML** 로 준다. 상태 코드만 보면 성공으로 보인다.
- `expires` 가 과거 날짜인 `Set-Cookie` 는 **쿠키 삭제 지시**다. 「쿠키가 저절로 만료됐다」가 아니다.
- 쿠키 이름의 꼬리가 클라이언트 번호다(`SAP_SESSIONID_U4A_800` vs `_000`). 번호가 다르면 다른 세션이다.
- `webRequest` 의 `onHeadersReceived` 와 `onBeforeSendHeaders` 는 **session 당 하나만** 걸린다.
  새로 걸면 기존 것을 밀어낸다 — 지금 `electron/main.js` 와 `www/ServerList_v2/ServerList.js` 가
  `onHeadersReceived` 를, `electron/lib/net/ws_http_cookie.js` 가 `onBeforeSendHeaders` 를 쓰고 있다.

## 아직 안 한 것

- **실제로 되는지 미확인** (테스트 항목 5)
- 이 수정으로 안 되면 다음 길 = **메인 process 에서 그 서버 host 로 나가는 요청에 `Cookie` 헤더를 직접 붙이기**
  (http 용으로 이미 만들어 둔 `ws_http_cookie.js` 구조를 https 로 넓히는 것). 아직 손대지 않았다.

---

# 【이어 씀】 2026-10-28 — 아이디·비번은 원인이 아니었다 · 메인 process 에서 Cookie 를 붙이는 것으로 바꿈

- 지시: 장군님 「우선 고쳐바」

## 앞 수정은 원인이 아니었다

아이디·비번 두 줄을 막았는데 **증상 동일**. 다만 **쿠키만으로 부트스트랩이 받아진다는 것**은 확인됐다
(오류창 스택에 `sap-ui-core.js` 가 실행 중으로 나온다). 그 두 줄은 **막은 채로 두었다** — 장군님 결정 2026-10-28 「아이디 패스워드는 막아야 함」 다라 이대로 확정.

## 진짜 원인 — 요청 종류에 따라 쿠키가 실리고 안 실린다

터진 자리를 소스에서 찾았다: `design/preview/index.js:5816`

```js
sap.ui.requireSync("sap/ui/layout/ResponsiveFlowLayout");
```

`requireSync` 는 UI5 의 **동기 XHR** 이다.

| 무엇으로 받나 | Cookie | 결과 |
|---|---|---|
| `<script>` 태그 (`sap-ui-core.js`) | 자동으로 실림 | 200 · `application/x-javascript` |
| UI5 내부 XHR (`requireSync` · `library-preload`) | **cross-origin 이라 `withCredentials` 가 꺼져 있으면 안 실림** | 200 · `text/html` · 로그인 화면 |

UI5 는 남의 라이브러리라 `withCredentials` 를 켤 수 없다.

## 고친 자리 — 파일 1개

`electron/lib/net/ws_http_cookie.js` (http 서버용으로 2026-10-27 에 만든 모듈을 https 까지 넓힘)

1. `SCHEME_HTTPS` 상수 추가
2. `_getHttpHost` → **`_getCookieHost`** 로 이름 바꾸고 https 도 받아들이게 함
   (부르는 곳 = 이 파일 안 2곳뿐, 전수 확인. `module.exports` 에 없다)
3. 대상 주소 `['http://*/*']` → **`['http://*/*', 'https://*/*']`**
4. `kept` · `attached` 로그를 **host 마다 한 번만** (https 를 보면 요청이 수백 건 — 요청마다 남기면 로그가 쏟아진다)

동작: 응답의 `Set-Cookie` 를 host 별로 거둬 두었다가, 그 host 로 나가는 요청에 `Cookie` 헤더로 붙인다.
**이미 붙어 있으면 덮지 않고 없는 것만** 더하므로 중복되지 않는다.
webRequest 는 화면 밖(메인 process)이라 **cross-origin 규칙을 타지 않는다.**

## 영향도 (고치기 전 전수 조사)

- `onBeforeSendHeaders` 를 쓰는 곳 = **이 파일 1곳뿐**
- `onHeadersReceived` 를 쓰는 곳 = `electron/main.js:372` · `www/ServerList_v2/ServerList.js:3248` — **안 건드렸다**
- ★**이 두 자리는 session 당 하나만 걸린다.** 새로 걸면 기존 것을 밀어낸다 →
  그래서 새 자리를 만들지 않고 **기존 파일을 넓히는 방식**으로 갔다

## 검증

- `node --check` 통과
- 옛 함수 이름이 호출부에 남아 있지 않은 것 확인(주석 1곳만 설명용으로 남김)
- **눌러 보지 않았다** — TODO 테스트 항목 5

## 판정이 또 바뀐 것에 대해

이번까지 **네 번** 바뀌었다. 매번 같은 원인이다 — **실패한 요청의 Request `Cookie` 헤더를 끝까지 안 봤다.**
성공한 요청(`sap-ui-core.js`)의 쿠키만 보고 「쿠키는 실린다」를 전체로 단정했다.

**다음에 같은 증상이면 순서는 이것이다:**
1. 실패한 요청의 **Response `Content-Type`** 과 **`Saploginstatus`** (SAP 은 401 이 아니라 200 + 로그인 HTML 을 준다)
2. 실패한 요청의 **Request `Cookie`** ← 성공한 요청 말고 **실패한 쪽**
3. 그 응답의 **`Set-Cookie` 의 `expires`** (과거 날짜 = 삭제 지시)

## 아직 안 한 것 · 못 정한 것

- 실제로 되는지 **미확인**
- ~~아이디·번 두 줄을 되돌릴지~~ → **막은 채로 확정** (장군님 결정 2026-10-28 「아이디 패스워드는 막아야 함」). 원본과 달라지는 변경이지만 밀추리를 주소·DevTools·로기에 남기지 않는 만큼 재가지리는 것이 우선하다
- 이 수정으로도 안 되면 다음은 **실패한 요청의 Request `Cookie` 를 직접 보는 것** — 그걸 아직 못 봤다
