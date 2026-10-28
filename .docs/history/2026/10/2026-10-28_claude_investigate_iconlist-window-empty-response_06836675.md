# 아이콘 목록 창이 빈 화면 — 서버에 파일이 없는 것이었다 (앱 결함 아님)

- 작성: 2026-10-28 (claude, 세션 06836675)
- 발단: 장군님 「fnIconListPopupOpener ← 이거 안쓰는거 아니야?」 → 임시로 그 길을 밟게 만들어 테스트

## 결론

`http://<서버>/ZU4A_IMP/tools/ui5icons/` 아래 파일이 **그 교육 서버에 없다**(장군님 확인).
서버는 200 OK + **Content-Length: 0** + `Content-Type: text/html` 을 줌.
Chromium 은 JavaScript 자리에 `text/html` 이 오면 실행을 거부한다(nosniff).
→ **앱 쪽에 고칠 것이 없다.** Electron 45 와도 무관.

## 틀렸던 판정 (두 번)

1. 「주소의 아이디·비번이 새 로그인을 일으켜 세션을 죽인다」 → 빼도 증상 동일. 틀림
2. 「경로 대소문자(ZU4A_IMP vs zu4a_imp) 때문」 → manifest.json 도 대문자인데 200. 틀림

둘 다 **응답 헤더를 끝까지 안 보고** 낸 판정이다.

## ★함정 — 다음에 같은 오류를 보면

`Refused to execute script ... MIME type ('text/html')` 를 보면
**「로그인 화면 HTML 이 왔다」고 단정하지 말 것.** 순서는 이것이다:

1. **Response headers 의 `Content-Length`** — `0` 이면 빈 응답이지 로그인 화면이 아니다
2. **`Saploginstatus`** 유무 — 없으면 인증 문제가 아니다
3. Request `Cookie` 유무
4. 그래도 모르겠으면 **브라우저 주소창에 그 주소를 그대로 쳐 본다** — 앱 없이 서버만 가른다

이번에 이 순서를 안 지켜 판정을 두 번 바꿨고 시간을 썼다.

## 지금 소스에 남아 있는 것

| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/js/fnDialogPopupOpener.js` `fnIconListPopupOpener` | 주소에서 `sap-user`·`sap-password`·`sap-language` 제거 — **이대로 확정**(장군님 결정 2026-10-28 「주소에서 뻐 아이디·비번·언어는 그대로 둔다」). 빈 응답과 무관했고, 파일이 있는 서버에서는 이 상태로 아이콘이 정상 표시된다(장군님 확인). |
