# 크리티컬 오류 때 로그 폴더 열기 — 패키징된 앱(exe)일 때만

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「패키지가 아닐경우는 로그 폴더 열지마라」
  (직전 지시 「크리티컬 오류 발생 시, 로그 폴더 열어주는 로직 어딨는지 확인좀 해줘」 의 후속)

## 고친 자리 — 자동으로 열리는 2곳만

| 파일 | 자리 | 무엇 |
|---|---|---|
| `www/ws30/ws10_20/js/ws_trycatch.js` | `showCriticalErrorDialog` | 오류창을 닫으면 폴더를 열던 것을 `APP.isPackaged === true` 일 때만 |
| `www/ws30/ws10_20/js/ws_html5_shell.js` | 메인 창 전역 `showCriticalErrorDialog` | 같음 (미리보기 iframe 이 `parent.parent` 로 부르는 쪽) |

두 자리 모두 `APP` = `REMOTE.app` 이라 `APP.isPackaged` 를 바로 쓸 수 있었다(확인함).
`APP.exit()` 로 앱을 끝내는 동작은 **그대로** 두었다 — 지시는 폴더 열기만이다.

건너뛸 때 로그를 남긴다(영어):
- `ws_trycatch.js` → `console.log("[WSERR-905] log folder open skipped | not packaged")`
  (이 파일의 오류코드 접두 = `WSERR`, 쓰인 번호 901~904 → **905** 를 새로 썼다)
- `ws_html5_shell.js` → `console.log("[Critical] log folder open skipped | not packaged")`
  (이 파일은 오류코드 접두가 없고 `[Critical]` 로 찍는 것이 기존 방식)

## 안 건드린 자리 — 사용자가 눌러서 여는 4곳

지시 범위를 **자동으로 열리는 것**으로 좁게 보았다. 눌러서 여는 것은 누른 대로 열리는 게 맞다고 판단했다.

| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/js/fnHmws.js` (2곳) | 첫 화면·작업화면 **메뉴 항목**으로 폴더 열기 |
| `www/ws30/ws10_20/Login/Login.js` (2곳) | 로그인 화면 오류 상자의 **「OpenLog」 버튼** |

→ **이 판단이 지시와 다르면 같이 막아야 한다.** 장군님 확인 대기.

## 검증

- `node --check` 두 파일 통과
- **실제로 크리티컬 오류를 내서 확인하지는 못했다** — 정상 조작으로 일부러 낼 방법이 없다.
  그래서 TODO 테스트 항목으로는 넣지 않았다(「조작으로 재현되는 것만 적는다」 규칙).
  다음에 개발 모드에서 크리티컬 오류가 나면 **탐색기 창이 안 떠야** 하고,
  터미널에 `log folder open skipped | not packaged` 가 찍혀야 한다.

## ★함정

`APP.isPackaged` 는 **패키징 여부**만 본다. 로그 파일 이름에는 개발 모드라도 `.dev` 가 안 붙고
사용자 데이터 폴더에만 `.dev` 가 붙는다(2026-10-27 실측) — 둘을 섞어 판단하지 말 것.
