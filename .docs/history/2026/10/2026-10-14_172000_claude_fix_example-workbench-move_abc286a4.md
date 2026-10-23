# 예제 열기 창의 「Workbench Move」 가 아무 일도 안 하던 것

- 날짜: 2026-10-14
- 장군님 지적 두 번: ① 버튼이 안 먹는다 ② **「원본 똑바로 안 쳐다볼래? 뒤로 나올 때 다시 예제창이 나오는 내용이 있어」**

## 전체 흐름 (이번에 처음부터 끝까지 봤다)

| 단계 | 어디 | 무슨 일 |
|---|---|---|
| 1 | `ws_events.js` `ev_AppExam` | 예제 창 생성 — `parent`=메인, `modal`=true, `closable`=false, OBJTY="EXAMPLE" |
| 2 | `extopen.js` | 창 안 샘플 페이지의 메시지 수신 → `if-exam-move` 전송 → MODE "B" 면 **자기 창 `hide()`** |
| 3 | `ws_fn_ipc.js` → `ws_fn_03.js` `fnExamMoveToPageWs20` | 앱 ID 를 입력칸에 넣고 조회 발화 + `isExam = "X"` |
| 4 | `ws_fn_01.js` `_checkExamPopup` | **WS10 도착 시** 자식 창에서 OBJTY="EXAMPLE" 을 찾아 **`show()`** + 플래그 삭제 |

## 죽어 있던 자리 — **두 곳**

1. **3단계** — `sap.ui.getCore().byId("AppNmInput"/"displayBtn")`. WS4.0 의 전역 `sap` 은 `byId`→null 스텁이라
   첫 가드에서 조용히 빠져나갔다.
   → 선례 2곳(`fnAppCopyPopupOpen` `_evalServerScript` · `fnAppF4PopupOpen` `_doDisplay`)과 같은 식으로
   `document.getElementById("AppNmInput")` + `oAPP.events.ev_AppDisplay()` 로 바꿨다.
   값 넣을 때 `ws10html.setAppId` 로 모델도 갱신(원본 setValue = 바인딩).
   ★원본 가드는 `!입력칸 && !버튼`(둘 다 없어야 중단)이라 하나만 없으면 터진다 → 선례대로 `||` 로 바꿨다.
2. **4단계** — `_checkExamPopup()` 호출부가 **UI5 NavContainer 의 `afterNavigate`** 안에 있었다.
   WS4.0 은 그 UI5 렌더 경로를 안 타므로(`fnOnInitRendering` 이 HTML5 렌더로 분기) **영영 안 불렸다.**
   → `_checkExamPopup` 을 `oAPP.fn.fnCheckExamPopup` 으로 내보내고,
   `ws10_html.js` `fnNavTo` 의 **전환 완료 지점 두 곳**(초기 분기 · 애니메이션 완료)에서 WS10 도착 시 부른다.

## 확인한 것

- 숨김 = `hide()` / 되살림 = `show()`. 창은 살아 있으므로 그대로 복원된다.
- 조회 발화부(`ev_AppDisplay`)는 **입력칸 값을 DOM 에서 직접 읽는다** → 값 넣고 바로 불러도 된다.
- 예제 창은 **닫기 예외 목록**에 있어 뒤로가기·모드전환 때는 안 닫힌다(의도).
  메인 창이 죽는 자리 4곳은 `fnChildWindowClose("X")` 로 **예외 무시 + `destroy()`** 라
  숨겨진 상태여도 같이 없어진다(`closable=false` 도 무시됨). 찾는 기준이 브라우저키라 parent 와 무관.

## ★ 또 밟을 함정

- **플래그를 세우는 코드를 고쳤으면 「누가 그 플래그를 읽는가」를 끝까지 찾는다.**
  읽는 쪽이 죽어 있으면 세우는 쪽만 고쳐도 아무 일도 안 일어난다. 이번이 정확히 그 사고였다.
- **원본의 UI5 이벤트(`afterNavigate` 등) 안에 있던 일은 WS4.0 에서 통째로 죽어 있다.**
  원본에서 그 이벤트 안을 반드시 열어 보고, WS4.0 의 대응 지점(여기서는 `fnNavTo`)에 옮긴다.
- 기능 하나를 고칠 때 **열기 → 쓰는 중 → 되돌아올 때 → 닫기** 네 자리를 먼저 찾는다.

## 테스트

장군님 2026-10-14 통과 — 버튼 누르면 예제 창이 사라지고 앱이 편집 화면으로 열린다 O ·
뒤로 나오면 예제 창이 다시 나타난다 O.
