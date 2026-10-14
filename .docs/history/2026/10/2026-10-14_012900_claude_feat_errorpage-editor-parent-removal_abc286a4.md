# 별창 parent 제거 17·18번 — 오류 페이지 에디터 창과 그 미리보기 창 (2026-10-14)

## 요청

장군님 지시 — 별창 parent 제거 남은 10곳(17~26번)을 하나씩. 그 첫 번째가 17번이다.

## 고친 것

| 번호 | 파일 | 무엇 |
|---|---|---|
| 1 | `Popups/errPageEditorPopup/errorPageEditorFrame.html` | 제목줄에 최소화·최대화 버튼 추가(원래 닫기만 있었다) |
| 2 | `Popups/errPageEditorPopup/errorPageEditorFrame.js` | 그 두 버튼 배선. 최대화 상태면 아이콘·tooltip 을 Restore 로 바꾼다 |
| 3 | `js/fnErrorPageEditorPopupOpen.js` | `parent` 지정을 뺐다. 이미 열렸는지 판정을 **OBJTY + browserkey** 로 바꾸고, 최소화 상태면 올린 뒤 포커스 |

8번 기술 문서 창·9번 소스 패턴 창과 같은 짝으로 맞췄다. `node --check` 통과.

## 검증

**아직 안 했다** — 장군님 테스트 대기(`.docs/TODO.md` 맨 위).

## ★ 또 밟을 함정

- **커스텀 제목줄 창에 parent 가 있으면 최소화한 뒤 다시 올릴 길이 없다.** 그래서 parent 를 뗀다.
- parent 를 떼면 `getChildWindows()` 로 못 찾으므로 **이미 열림 판정을 OBJTY + browserkey 로** 바꿔야 한다.
  OBJTY 만 보면 같은 로그인의 다른 메인 창이 띄운 같은 종류 창을 잘못 집는다.
- 쓰지 않게 된 지역 변수 선언 한 줄(`oCurrWin`)은 그대로 뒀다 — 동작과 무관.

---

# 18번 — 같은 창의 미리보기 창 (ERRPAGEPREV, 2026-10-14)

## 고친 것

`js/fnErrorPageEditorPopupOpen.js` 의 `fnIpcMain_ErrorPagePreview` 두 줄.

| 번호 | 무엇 | 왜 |
|---|---|---|
| 1 | `oBrowserOptions.parent = oCurrWin;` 주석 처리 | parent 를 두면 최소화한 뒤 작업표시줄에도 안 남아 다시 띄울 길이 없다 |
| 2 | 이미 열림 판정을 `WSUTIL.getCheckAlreadyOpenWindow` → `APPCOMMON.getCheckAlreadyOpenWindow2` | 앞의 것은 `getChildWindows()` 기반이라 parent 를 떼면 0개로 나온다. 이 창은 이미 열려 있으면 **닫고 다시 띄우는** 흐름이라, 못 찾으면 닫히지 않고 창이 겹겹이 쌓인다 |

`node --check` 통과.

## 17번과 달랐던 점 — 제목줄 버튼을 안 붙였다

이 창은 **사용자 HTML 을 그대로 그리는 창**이다(`errorPageEditorPreview.html` 은 `document.write(oInfo.HTML)` 한 줄뿐).
제목줄을 직접 그리지 않고 **OS 기본 창틀**을 쓰므로(`BrowserWindow-settings.json` 에 `frame` 설정이 없다 = 기본 true)
최소화·최대화·닫기 버튼이 이미 OS 쪽에 있다. 그래서 17번처럼 버튼을 새로 붙일 필요가 없었다.

## 확인한 것 — 위치 잡기는 parent 와 무관

`WSUTIL.setParentCenterBounds` 는 `REMOTE.getCurrentWindow()` 와 `global.CURRWIN` 으로 중앙을 잡는다.
`oBrowserOptions` 의 `parent` 는 읽지 않는다 → parent 를 떼도 메인 창 가운데 그대로 뜬다.

## 검증

**아직 안 했다** — 장군님 테스트 대기(`.docs/TODO.md` 맨 위).

## ★ 또 밟을 함정

- **이미 열림 판정이 「닫고 다시 띄우기」 흐름에 쓰이면, 못 찾는 것이 곧 창 중복이다.**
  focus 를 주는 흐름은 못 찾아도 창 하나만 더 열리지만, 이쪽은 누르는 만큼 쌓인다.
- **OS 기본 창틀 창은 parent 만 떼면 끝이다.** 제목줄을 직접 그리는 창(frameless)과 할 일이 다르다 —
  창을 고치기 전에 `frame` 설정과 그 창의 HTML 을 먼저 본다.
- 이 창은 `closable: false` 로 만들어 `did-finish-load` 에서 `true` 로 돌린다(원본 그대로).
  로드가 실패하면 `did-fail-load` 에서 `destroy()` 한다 — **닫기 불가 상태로 남지 않게 하는 장치이므로 지우지 말 것.**


---

# 이어 씀 — 2026-10-14 · 17번 통과 + 18번을 공통 헤더로 전환

## 17번 ✅ O

장군님 「17번 O」 — 최소화·최대화·중복 열기 전부 통과.

## 18번 — 장군님 지적 「18번은 공통 헤더가 아니네?」 → 공통 UX 지침대로 바꿨다

지적이 맞다. 미리보기 창은 OS 기본 창틀을 쓰고 있었고(원본 WS3.0 도 그랬다), WS4.0 의 다른 별창은
전부 공통 `.u4a-titlebar` 다. 장군님 지시 「공통ux 지침 대로 공통 헤더로 바꿔줘」 로 전환했다.

### 왜 헤더만 붙일 수 없었나 (핵심)

원본 `errorPageEditorPreview.html` 은 **창 문서에 `document.write(oInfo.HTML)`** 한 줄로 사용자
HTML 을 통째로 그린다. `document.write` 는 **문서를 통째로 덮으므로 헤더까지 지운다.**
그래서 에디터 창(17번)과 같은 **[공통 헤더 + 본문 iframe] 2단 구조**로 바꿨다.

### 고친 것

| 번호 | 파일 | 무엇 |
|---|---|---|
| 1 | `Popups/errPageEditorPopup/errorPageEditorPreview.html` | 전면 교체 — 공통 헤더(로고·제목·최소화·최대화·닫기) + 본문 iframe. 테마 boot 스크립트(§2.6), 본문 등장은 CSS opacity transition |
| 2 | `Popups/errPageEditorPopup/errorPageEditorPreviewBody.html` | **신규** — 사용자 HTML 을 그릴 빈 본문 문서 |
| 3 | `Popups/errPageEditorPopup/errorPageEditorPreview.js` | **신규** — 헤더 배선(최소화·최대화 아이콘 동기화·닫기), iframe 에 사용자 HTML write, 못 찾는 자리마다 `U4ALOG.warn("GUARD_EXIT", …)` |
| 4 | `js/fnErrorPageEditorPopupOpen.js` | 창 옵션 `titleBarStyle:'hidden'` + 배경 테마색, 쿼리에 THEME/BGCOL/TITLE, **`closable = true` 로 돌리던 줄 제거**, 이미 열려 있으면 공통 `U4AUI.closeWindow` 로 닫기 |

오류코드 접두 `EPEV` 를 `.works/DEV_STANDARD_오류처리.md` 사전에 등록했다. `node --check` 통과.

### 지침에서 따른 것 (`.analy/16`)

- §2.2 — 별창 타이틀바 선두는 **에디터류면 U4A 로고**(의미 아이콘은 알림·경고 창만).
- §2.6 — 네이티브 창 페이드 금지, 창 배경을 처음부터 테마색 + `show:false`, **iframe 에도 `?BGCOL=` 전달**(안 하면 iframe 만 흰 번쩍), 등장은 본문 CSS opacity transition.
- §2.6.1 — `closable` 은 창 수명 내내 **false**. 종전 코드는 로드 완료 때 `true` 로 돌렸는데 그러면 idle 에서 Alt+F4 가 먹는다(지침이 금지한 바로 그 버그).

### ★ 또 밟을 함정

- **`document.write` 로 그리는 창에는 헤더를 붙일 수 없다.** 본문을 iframe 으로 내려야 한다.
  본문 iframe 을 `about:blank` 로 두면 사용자 HTML 의 상대 경로(이미지·CSS)가 깨진다 →
  **같은 폴더의 빈 문서 파일**을 src 로 쓴다(기준 주소가 원본과 같아진다).
- **`closable:false` 창은 `close()` 가 무시된다.** 이 창은 「이미 열려 있으면 닫고 다시 띄우는」
  흐름이므로, 공통 `U4AUI.closeWindow` 를 안 쓰면 Preview 를 누르는 만큼 창이 쌓인다.
- 사용자 HTML 과 iframe 로드는 **어느 쪽이 먼저 올지 모른다**(느린 PC). 둘 다 보관해 두고
  나중에 온 쪽에서 그린다 — 시간으로 못 박지 않는다.


## 미리보기를 닫으면 에디터 창이 뒤로 깔리던 것 (2026-10-14)

장군님 「미리보기창 띄우고 닫기 누르면 왜 오류페이지 에디터 창이 뒤로 숨는거 같지?」 — 맞다.

- **원인**: 미리보기 창의 `closed` 처리가 `CURRWIN.focus()` 를 부른다. 그 `CURRWIN` 은
  파일 맨 위에서 잡은 **WS20 메인 창**이다(이 파일은 WS20 안에서 돈다). 원본에도 같은 줄이 있지만,
  원본은 **에디터 창의 parent 가 메인**이라 「자식은 늘 부모 위」 규칙으로 메인 위에 남았다.
  17번에서 parent 를 뗀 뒤로 그 보장이 사라져 메인이 앞으로 오며 에디터 창이 뒤로 깔렸다.
- **고친 것**: 닫힐 때 `getCheckAlreadyOpenWindow2("ERRPAGE")` 로 **그 미리보기를 띄운 에디터 창**을
  찾아 focus(최소화돼 있으면 restore 먼저). 못 찾으면 `U4ALOG.warn("GUARD_EXIT", …)` 를 남기고
  종전대로 메인에 준다. `node --check` 통과.

### ★ 또 밟을 함정

- **parent 를 뗀 창이 있는 화면에서 `focus()` 는 그대로 z-order 를 바꾼다.** 원본의 focus 호출은
  parent 보장을 믿고 쓰인 것이라, parent 제거 뒤에는 **「누구에게 focus 를 주는가」를 다시 봐야 한다.**
  같은 모양의 코드가 다른 창 열기 함수에도 있으니 그 창들을 손볼 때 함께 본다.


## 18번 ✅ O (2026-10-14)

장군님 「18번 테스트 통과」 — 공통 헤더(로고·제목·최소화·최대화·닫기) · 최소화 후 되살리기 ·
최대화/복원 · 닫기 · 중복 열기 안 쌓임 · **닫은 뒤 에디터 창이 앞에 남는 것**까지 전부 통과.
→ 오류 페이지 에디터 창(17번)과 그 미리보기 창(18번)은 **끝났다.**
