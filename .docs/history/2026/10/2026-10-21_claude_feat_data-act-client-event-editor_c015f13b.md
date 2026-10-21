# 클라이언트 JS 이벤트 편집 창에 자동 테스트 식별값(data-act)

- 날짜 2026-10-21 · 세션 c015f13b · type=feat
- 요청: 자동 테스트 쪽 대화창 (`D:\workspace\u4a-ws4-mcp\.docs\request\2026-10-21_client-event-editor-data-act.md`)
- 장군님 지시 2026-10-19 — 식별값 요청은 묻지 말고 바로 처리하고 그쪽에 회신한다.

## 한 일 (`ws_html5_client_editor.js` 한 파일)

창 뿌리 `CLIENT_EDITOR_DLG` · 소스 칸(Monaco 호스트) `CEVT_SRC` · 꾸밈정렬 `CEVT_PRETTY` ·
줌 `CEVT_ZOOM_OUT`·`CEVT_ZOOM`·`CEVT_ZOOM_IN` · 복사 `CEVT_COPY` · **저장 `SAVE`** ·
지우기 `CEVT_DELETE` · 푸터 닫기 `CLOSE`(머리와 같은 값). 요청서 값 그대로.

`node --check` 통과. 모양·동작은 바꾸지 않았다.

## 소스 칸에 값을 넣고 읽는 길 (상대에게 알려 준 것)

그 칸은 Monaco 호스트를 띄운 iframe 이다.

- **넣기** = 그 iframe 에 메시지를 보낸다 — `{ __u4ace: true, hostId: <HOSTID>, cmd: "setValue", value: "..." }`.
  다른 명령: `format` · `focus` · `setReadOnly` · `setLanguage` · `setTheme` · `fontZoomIn/Out/Reset`.
  `__u4ace` 와 `hostId` 가 없으면 호스트가 무시한다.
- **읽기** = 호스트 창의 `editor.getValue()`. 저장 단추도 그 길로 읽는다.
- 값을 넣으면 호스트가 `applied` 를 돌려주고, 처음 뜰 때 `ready` 를 보낸다 — **그 뒤에 넣어야** 한다.

## 아직 안 본 것

같은 아이콘이 다른 속성 줄에서 띄우는 **HTML Source 편집 창**에 식별값이 있는지는 **안 봤다.**
그쪽이 따로 요청하기로 했다.
