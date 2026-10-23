# 오류 페이지 에디터 — SAVE 를 누르면 미리보기 창에도 바로 반영 (TODO 45)

- 날짜: 2026-10-15
- 종류: feat (원본에 없는 신규 기능)
- 세션: 574ddaed
- 지시: 「45번 — 미리보기 창이 열려 있을 때만 갱신하는 쪽으로 해」
  (그 앞에 범위를 여쭌 질문 = 「미리보기 창이 열려 있을 때만 바꿔 줄까, 닫혀 있으면 새로 띄울까」)

## 1. 왜 필요했나

종전에는 미리보기가 **「Preview」 아이콘을 누를 때만** 갱신됐다.
에디터에서 고치고 SAVE 를 눌러도 떠 있는 미리보기 창은 옛 HTML 그대로였다.
원본(UI5)에도 없던 동작이므로 **범위를 먼저 결정받고** 착수했다.

## 2. 흐름 — 고치기 전에 전부 확인한 것

| 자리 | 파일 | 하는 일 |
|---|---|---|
| SAVE 누름 | `Popups/errPageEditorPopup/errorPageEditorFrame.js` `_save()` 222 | `if-ErrorPageEditor-Save` 로 `{BROWSKEY, SAVEDATA:{HTML,IS_USE}}` 보냄 + 저장 토스트 |
| 저장 받음 | `js/fnErrorPageEditorPopupOpen.js` `fnIpcMain_ErrorPageEditorSave` 229 | `oAPP.DATA.APPDATA.S_ERHTML` 에 넣고 변경 플래그 + WS20 헤더 갱신 |
| Preview 누름 | 같은 창 `_preview()` 241 | busy 켜고 `if-ErrorPage-Preview` 보냄 |
| 미리보기 창 열기 | `fnIpcMain_ErrorPagePreview` 281 | **이미 열려 있으면 닫고 새로 띄운다** → `did-finish-load` 에서 `if-Error-Page-prev` 로 HTML 전달 |
| 미리보기 창 그리기 | `errorPageEditorPreview.js` 130 | `IPCRENDERER.on("if-Error-Page-prev")` → 본문 iframe 에 `document.write` |

**판단 근거 2개 (소스 확인)**
1. 미리보기 창의 `if-Error-Page-prev` 수신부는 `once` 가 아니라 **상시 `on`** → 같은 신호를 다시 보내면 다시 그린다.
   `_renderHtml()` 은 쓴 뒤 `sPendingHtml = null` 만 하고 `bFrameReady` 는 true 로 남으므로 2회차도 그려진다.
2. 미리보기 창을 찾는 공통 함수 `getCheckAlreadyOpenWindow2`(`js/ws_common.js` 2734)는
   **OBJTY + browserkey** 로 찾고 `{ISOPEN, WINDOW}` 를 준다. `fnIpcMain_ErrorPageEditorSave` 는
   메인 창 쪽이라 이 함수를 바로 쓸 수 있다.

## 3. 한 일

`js/fnErrorPageEditorPopupOpen.js` `fnIpcMain_ErrorPageEditorSave` 끝에 32줄 추가.

```js
const oPrevWin = APPCOMMON.getCheckAlreadyOpenWindow2("ERRPAGEPREV");
if (oPrevWin.ISOPEN && oPrevWin.WINDOW && !oPrevWin.WINDOW.isDestroyed()) {
    oPrevWin.WINDOW.webContents.send("if-Error-Page-prev", oSaveData);
    U4ALOG.info("끝남", "ERRPAGEPREV", "saved HTML sent to the open error page preview window");
}
```

- 닫혀 있으면 **아무것도 안 한다**(장군님 결정). 정상 흐름이라 로그도 남기지 않는다.
- catch 는 `[FEPE-003]` 로 표면화 + `U4ALOG.caught`. 파일 머리에 `// 오류코드 접두: FEPE / 다음 번호: 004` 한 줄 추가.
- `node --check` 통과.

### 왜 거기에 넣었나 (버린 방법)

- **버림 ①: 에디터 창 `_save()` 에서 미리보기로 직접 보내기** — 에디터 창(renderer)에서 창 목록을 찾는
  코드를 또 만들어야 하고, 저장 신호가 이미 `SAVEDATA` 를 들고 메인으로 가고 있다. 길이 두 개가 된다.
- **버림 ②: `_save()` 가 `_preview()` 를 같이 부르기** — Preview 경로는 **열린 창을 닫고 새로 띄우는**
  쪽이라 SAVE 마다 창이 닫히고 다시 뜬다. 장군님 결정(열려 있을 때만 갱신)과 반대.
- **고른 것: 저장 받는 쪽 한 곳.** 고칠 자리 1곳, 새 IPC 채널 0개.

## 4. 또 밟을 함정

1. **Preview 버튼 경로와 SAVE 경로는 창 처리가 정반대다.** `fnIpcMain_ErrorPagePreview` 는
   이미 열린 미리보기 창을 **닫고 새로 띄운다**(창이 겹겹이 쌓이는 것을 막기 위해, 2026-10-14).
   SAVE 쪽에 그 함수를 재사용하면 저장할 때마다 창이 닫히고 다시 뜬다. **두 경로를 합치지 말 것.**
2. **`if-Error-Page-prev` 는 미리보기 창의 `did-finish-load` 뒤에만 받을 사람이 있다.**
   창이 뜨는 도중에 보내면 조용히 사라진다. 지금은 Preview 를 누르면 미리보기가 뜰 때까지
   에디터가 busy 라 SAVE 를 누를 수 없어 문제가 안 된다 — **그 busy 를 없애면 이 구멍이 열린다.**
3. 미리보기 창 찾기는 **OBJTY `ERRPAGEPREV` + browserkey** 다. OBJTY 문자열을 바꾸면 조용히 못 찾는다.

## 5. 아직 안 한 것 · 미검증

- ~~앱으로 확인한 것이 없다~~ → **2026-10-15 장군님 「45-1 · 45-2 테스트 완료」 — 둘 다 통과.**
  45-1 미리보기를 열어 둔 채 저장하면 그 창이 바뀐다(창이 닫히거나 다시 뜨지 않는다) ·
  45-2 미리보기가 닫혀 있으면 새로 뜨지 않는다. **45번 종료**, TODO 에서 지웠다.
- **SAVE 에 busy 를 걸지 않았다.** 추가한 것은 `webContents.send` 한 줄(서버 왕복·창 생성 없음)이고,
  완료 신호가 없어 busy 를 켜면 풀 자리가 없다. 다만 `_save()` 자체에 busy 가 없는 것은
  **종전부터 그랬다** — busy 표준(시작에 켜고 끝에서만 끔)에 맞출지는
  **장군님 결정으로 보류**(2026-10-15 「나중에 정하자, 지금은 그대로 두어」 = TODO 53). 코드는 손대지 않았다.
- 미리보기 창이 **최소화된 상태**에서 SAVE 를 누르면 내용은 갱신되지만 창을 올려 주지는 않는다
  (지시 범위 밖이라 `restore()`·`focus()` 를 넣지 않았다). 필요하면 지시 대기.
- 커밋은 지시 대기.
