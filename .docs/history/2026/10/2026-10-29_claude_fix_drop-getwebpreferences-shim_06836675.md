# Electron 45 — `getWebPreferences()` 되살리기 장치를 걷어냄 (⑤)

- 일시: 2026-10-29
- 지시: 장군님 「5번 진행해라」
- 앞 작업: `2026-10-28_claude_fix_browserkey-from-url-query_06836675.md` (②③④)

## 무엇을 했나

Electron 45 에서 `webContents.getWebPreferences()` 가 없어져, 2026-10-28 에 임시로
`getLastWebPreferences()` 를 그 이름으로 되살려 붙여 두었다(`electron/main.js`).
그 장치를 **걷어냈다.** 그러려면 아직 그 함수를 부르는 곳을 먼저 정리해야 했다.

## 영향도 — 부르는 곳 전수 (주석 제외, `dist`·`node_modules`·`_` 제외)

| 자리 | 무엇을 읽나 | 도나 | 처리 |
|---|---|:--:|---|
| `electron/main.js` 정의·호출 | 되살리기 장치 | — | **걷어냄** |
| `electron/main.js` `_readPref` | 남의 창 설정(크래시 추적) | ✅ | `getWebPreferences` 분기 제거 — `getLastWebPreferences` 폴백이 이미 있었다 |
| `www/ws30/resources/index.js:2635` | 남의 창 `OBJTY` | ✅ | `WSUTIL.QueryString.parseWindow(oWebCon)` 로 |
| `www/ws30/ws10_20/js/ws_util.js:54` | 자기 창 `USERINFO` | ✅ | **그 줄을 걷어냄** — 바로 아래 ①주소 쿼리 ②부모 `getUserInfo()` 두 갈래가 이미 받는다 |
| `design/bindPopupHandler/broadcastChannelBindPopup.js:21` | 자기 창 `browserkey` | ✅ | **그 줄을 걷어냄** — 바로 아래 주소 쿼리 갈래가 이미 있었다 |
| `Popups/designTreeUiSearchPopup/index.js:17` | 자기 창 `browserkey` | ❌ | **그대로 둠**(아래 참고) |
| `Popups/u4aDocPopup/frame.js:37` | 자기 창 `USERINFO` | ❌ | **그대로 둠** |
| `www/floatingMenu/js/handle.js:60` | 남의 창 표식 | ❌ | **그대로 둠** |

## 안 도는 3곳을 왜 그대로 뒀나

- `designTreeUiSearchPopup` — 여는 곳이 `fnDialogPopupOpener.js:1387` **주석 한 줄**뿐.
- `u4aDocPopup` — `PATHINFO.U4ADOCU` 를 쓰는 곳 **0건**.
- `floatingMenu` — `floatMenu.open` 을 부르는 곳 **0건**(TODO 1-19 와 같은 건).

**한 번 고쳤다가 되돌렸다.** `WSUTIL.QueryString.parseWindow(...)` 로 바꿨는데,
두 파일 모두 **그 줄에서 `WSUTIL` 이 아직 선언되지 않았다**(`u4aDocPopup` 은 9줄 뒤에 `require`,
`designTreeUiSearchPopup` 은 아예 없음). 그대로 뒀으면 창을 되살릴 때 바로 터졌다.
게다가 `USERINFO` 는 **객체**라 주소 쿼리에서 읽으려면 파싱까지 필요하다.

→ **되살릴 때 여는 쪽(주소에 값 싣기)과 함께 고치는 것이 맞다.** `main.js` 주석에 그 세 곳을 적어 뒀다.

## ★함정

- **고칠 줄에서 그 모듈을 쓸 수 있는지 먼저 본다.** 파일 위쪽 `const` 묶음은 **선언 순서**가 있다 —
  뒤에서 `require` 하는 것을 앞 줄에서 쓰면 터진다. 이번에 두 파일에서 그 실수를 했다.
- **「안 도는 코드」 판정은 여는 곳을 직접 보고 한다.** 앞 이력에 「안 도는 것은 `editorPopup_v2` 하나뿐」이라
  적었는데 **틀렸다** — `designTreeUiSearchPopup`·`u4aDocPopup` 도 안 돈다.

## 확인 전

테스트 H1(앱·별창 전반) · H2(바인딩 창). `node --check` 는 바꾼 4개 파일 전부 통과.
