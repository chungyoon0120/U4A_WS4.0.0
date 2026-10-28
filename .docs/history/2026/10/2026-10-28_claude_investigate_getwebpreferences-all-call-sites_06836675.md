# Electron 45 — `getWebPreferences()` 에서 값 받아 쓰는 자리 전수 (소스 위치)

- 작성: 2026-10-28 (claude, 세션 06836675)
- 지시: 장군님 「getWebPreferences() 여기서 값 받아서 참조하는 로직 전수 검사」 · 「항목별 소스 위치까지 다 링크 걸어」
- 범위: `www` + `electron` 전체. `_` 로 시작하는 것·`(deprecated)`·주석 제외.
- **합계 62줄 / 17파일** — 한 줄씩 눈으로 확인했다.

읽는 방식은 새 함수를 만들지 않고 **이 프로젝트가 이미 61곳에서 쓰는 것**을 그대로 쓴다:

- 자기 창 = `WSUTIL.QueryString.parse(location.href)`
- 남의 창 = `WSUTIL.QueryString.parse(oWin.getURL())` (선례: `ServerList.js:3588`)
- IPC 보낸 창 = `WSUTIL.QueryString.parse(events.sender.getURL())`

---

## ① 전제 — 여는 주소에 값을 채워야 하는 창 (1곳)

| 위치 | 무엇 |
|---|---|
| [index.js:91](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/editorPopup_v2/index.js:91) | 코드 편집기 창 — 쿼리 없음 |

`webPreferences` 에는 네 값(partition·browserkey·OBJTY·USERINFO)을 넣지만
**주소 쿼리에는 아무것도 안 넣는다.** 먼저 넣어야 ②④ 를 고칠 수 있다.

싣는 본보기 = [textSearchPopup/index.js:71](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/textSearchPopup/index.js:71)
— browserkey · sessionKey · OBJTY · USERINFO · SYSID 를 `QueryString.build` 로 싣는다.

### ★2026-10-28 정정 — 2곳이 아니라 1곳이다

처음엔 [fnDialogPopupOpener.js:1230](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnDialogPopupOpener.js:1230) 도 대상이라 했다. **아니다.**
그 자리는 Text 검색 팝업을 여는 함수 안인데, 그 함수는 **맨 위에서 `textSearchPopup/index.js` 를
부르고 [`return`](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnDialogPopupOpener.js:1178) 한다** — 그 아래는 **안 도는 죽은 코드**다.
그리고 실제로 도는 그 파일은 **이미 쿼리를 제대로 싣는다.**

→ 내가 안 본 것: `webPreferences` 를 넣는 줄은 봤지만 **그 위에 `return` 이 있는지 안 봤다.**
  **앞으로: 고칠 줄을 찾으면 그 줄이 도는 코드인지(위쪽 `return`·주석 여부)를 먼저 본다.**
---

## ② 자기 창 값 (16줄)

| 위치 | 무엇 |
|---|---|
| [helpViewer.js:73](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/help/u4a_helpdoc/viewer/u4a-ws30-help/helpViewer.js:73) | browserkey — 도움말 창을 부른 창의 키 |
| [index.js:17](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/designTreeUiSearchPopup/index.js:17) | browserkey |
| [index.js:16](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/editorPopup_v2/Popup/index.js:16) | 부르는 줄 |
| [index.js:17](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/editorPopup_v2/Popup/index.js:17) | browserkey |
| [index.js:18](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/editorPopup_v2/Popup/index.js:18) | USERINFO — 바로 뒤에서 SYSID·LANGU 를 쓴다(없으면 던진다) |
| [frame.js:37](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/u4aDocPopup/frame.js:37) | 부르는 줄 |
| [frame.js:38](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/u4aDocPopup/frame.js:38) | USERINFO |
| [frame.js:313](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:313) | browserkey |
| [broadcastChannelBindPopup.js:21](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/design/bindPopupHandler/broadcastChannelBindPopup.js:21) | browserkey — 값 없으면 쿼리에서 읽는 코드가 이미 있다 |
| [index.js:201](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/index.js:201) | 부르는 줄 |
| [index.js:202](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/index.js:202) | USERINFO |
| [ws_util.js:54](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_util.js:54) | 부르는 줄 |
| [ws_util.js:56](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_util.js:56) | USERINFO — 바로 아래에서 쿼리 값으로 덮어쓴다 |
| [ws_common.js:2798](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2798) | 부르는 줄 |
| [ws_common.js:2799](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2799) | browserkey — 「이미 열려 있는 팝업」 판정의 기준 |
| [ws_common.js:2883](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2883) | browserkey — 형제 창 모으기의 기준 |

---

## ③ IPC 를 보낸 창 값 (3줄)

| 위치 | 무엇 |
|---|---|
| [fnFindPopupOpen.js:243](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnFindPopupOpen.js:243) | 부르는 줄 (events.sender) |
| [fnFindPopupOpen.js:244](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnFindPopupOpen.js:244) | browserkey — Find 창에 답 보낼 채널 이름 |
| [fnFindPopupOpen.js:260](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/fnFindPopupOpen.js:260) | browserkey — 위와 같은 것(실패 때) |

---

## ④ 남의 창 값 (40줄) — 가장 크고 가장 조심할 묶음

★여기를 `location.href` 로 바꾸면 **틀린다.** 그 창의 `getURL()` 을 읽어야 한다.

| 위치 | 무엇 |
|---|---|
| [handle.js:60](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/floatingMenu/js/handle.js:60) | 부르는 줄 |
| [handle.js:62](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/floatingMenu/js/handle.js:62) | 떠다니는 메뉴 표식 — ★넣는 자리가 없다(기존 결함) |
| [helpViewer.js:104](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/help/u4a_helpdoc/viewer/u4a-ws30-help/helpViewer.js:104) | 부르는 줄 |
| [helpViewer.js:107](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/help/u4a_helpdoc/viewer/u4a-ws30-help/helpViewer.js:107) | OBJTY |
| [helpViewer.js:108](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/help/u4a_helpdoc/viewer/u4a-ws30-help/helpViewer.js:108) | browserkey |
| [index.js:2635](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/resources/index.js:2635) | 부르는 줄 |
| [index.js:2643](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/resources/index.js:2643) | OBJTY |
| [index.js:2648](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/resources/index.js:2648) | partition |
| [frame.js:339](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:339) | 부르는 줄 |
| [frame.js:340](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:340) | browserkey |
| [frame.js:341](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/Popups/ui5CssPopup_v2/main/frame.js:341) | OBJTY |
| [ws_fn_01.js:100](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_01.js:100) | 부르는 줄 |
| [ws_fn_01.js:101](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_01.js:101) | OBJTY — 예제 열기 창 찾기 |
| [ws_fn_05.js:32](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_05.js:32) | 부르는 줄 |
| [ws_fn_05.js:33](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_05.js:33) | browserkey |
| [ws_fn_05.js:41](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_05.js:41) | OBJTY |
| [ws_fn_05.js:46](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_05.js:46) | OBJTY — 메인 창인지 가린다 |
| [ws_common.js:2738](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2738) | 부르는 줄 |
| [ws_common.js:2739](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2739) | OBJTY |
| [ws_common.js:2813](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2813) | 부르는 줄 |
| [ws_common.js:2814](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2814) | browserkey |
| [ws_common.js:2815](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2815) | OBJTY |
| [ws_common.js:2905](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2905) | 부르는 줄 |
| [ws_common.js:2906](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2906) | OBJTY |
| [ws_common.js:2907](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_common.js:2907) | browserkey — ★뒤로가기 때 별창 닫기가 여기서 빈 목록을 받는다 |
| [ws_fn_02.js:1832](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:1832) | 부르는 줄 |
| [ws_fn_02.js:1840](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:1840) | partition |
| [ws_fn_02.js:1860](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:1860) | OBJTY |
| [ws_fn_02.js:1894](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:1894) | 부르는 줄 |
| [ws_fn_02.js:1902](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:1902) | partition |
| [ws_fn_02.js:2162](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:2162) | 부르는 줄 |
| [ws_fn_02.js:2163](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:2163) | OBJTY — 자식창 일괄 닫기 |
| [ws_fn_02.js:2267](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:2267) | 부르는 줄 |
| [ws_fn_02.js:2268](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_02.js:2268) | OBJTY — 자식창 보이기/숨기기 |
| [ws_fn_04.js:1026](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1026) | 부르는 줄 |
| [ws_fn_04.js:1028](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1028) | OBJTY |
| [ws_fn_04.js:1658](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1658) | 부르는 줄 |
| [ws_fn_04.js:1659](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1659) | OBJTY |
| [ws_fn_04.js:1660](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1660) | SYSID |
| [ws_fn_04.js:1661](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_fn_04.js:1661) | partition |

---

## ⑤ 메인 process (3줄) — 반드시 맨 마지막

| 위치 | 무엇 |
|---|---|
| [main.js:448](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/electron/main.js:448) | 없어진 함수를 다시 만들어 붙이는 자리 — 장군님: 걷어낼 대상 |
| [main.js:650](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/electron/main.js:650) | 그걸 쓰는 자리 |
| [main.js:651](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/electron/main.js:651) | 그걸 쓰는 자리 |

---

## 고칠 대상이 아닌 것

| 위치 | 까닭 |
|---|---|
| [intro.js:542](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/intro.js:542) | 서버리스트 창 — 브라우저 키는 **로그인할 때 채번**되므로 로그인 전엔 넣을 값이 없다 |
| [callAiInterfacePopup.js:75](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/design/testFolder/callAiInterfacePopup.js:75) | 테스트 폴더 — 현행 아니다 |
| [resources/index.js:676](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/resources/index.js:676) | `SYSID` 를 넣는 자리 — 같은 함수가 [쿼리에도 넣는다(:708)](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/resources/index.js:708). 짝이 맞는다 |

---

## ★조사 중 따로 나온 것 (Electron 과 무관한 기존 결함)

[handle.js:62](C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/floatingMenu/js/handle.js:62) 는 창마다 떠다니는 메뉴 표식을 찾는데,
**그 표식을 넣는 자리가 `www` 전체에 한 줄도 없다.**
그래서 그 함수는 **예전부터 창을 하나도 못 찾는다.** 장군님 지시를 받아야 고친다.

## ★조사 중 내가 틀렸던 것

처음엔 「주소에 값이 빠진 창 8곳」이라 했다. **2곳이다.**
기계로 훑을 때 `loadURL` 위 45줄만 봤는데, 어떤 창은 쿼리 만드는 코드가 61줄 위에 있었다.
→ **범위를 정해 놓고 기계로 훑은 수는 그 범위 밖을 놓친다. 반드시 눈으로 한 번 더 본다.**
