# 즐겨찾기 아이콘 팝업 — 아이콘 이름 복사가 안 되는 원인 조사 (코드 변경 없음)

- 시각: 2026-09-14 01:49:57
- agent: claude
- type: docs (조사·재현만. **소스 변경 0건**)
- 화면: `www/ws30/ws10_20/design/favIconPopup` + `www/ws30/ws10_20/js/fnFavIconPopupOpen.js`

## 요청
장군님: "즐겨찾기 팝업에 아이콘값 클립보드 복사가 왜 안되냐" (스크린샷 = 아이콘 즐겨찾기 항목 창, 타일 우상단 복사 버튼).

## 변경 내용
**소스는 한 줄도 고치지 않았다.** 원인 규명과 재현 실측만 했다.

1. 호출 경로를 원본(`U4A_WS_DESIGN/design/favIconPopup/index.js`, `design/js/callFavIconPopup.js`)과 1:1 대조 — 자식 iframe → 부모 dialog 로 custom event 전송 → 부모가 `parent.setClipBoardTextCopy(ICON_SRC)` 호출. **원본과 동일, 경로에 결함 없음.**
2. 복사 담당 함수 `setClipBoardTextCopy`(`www/ws30/resources/index.js`)도 원본(WS3.0.0)과 **동일**. 임시 `<textarea>` 를 `document.body` 에 붙이고 `select()` → `document.execCommand('copy')`.
3. 앱과 같은 런타임(Electron 14.2.9 / Chromium 93)으로 **격리 하네스를 만들어 재현**. 하네스는 `_cliptest/` 에 임시 생성 후 **삭제 완료**(프로젝트에 남기지 않음). 서버는 기존 `.claude/launch.json` 의 static 항목 사용, 사용 후 중지.

### 재현 실측 결과
| 조건 | execCommand 반환 | selection 길이 | 실제 clipboard |
|---|---|---|---|
| 같은 window, 비모달 `show()` | true | 18 | `sap-icon://account` ✅ |
| 같은 window, **모달 `showModal()`** | **true** | **0** | **안 바뀜** ❌ |
| dialog 가 **다른 document**(iframe) 에 있을 때 | true | 18 | 정상 ✅ |

### 원인
- 셸과 WS20 이 **같은 window**(`ws30/ws10_20/index.html` 하나로 합쳐짐)다.
- 즐겨찾기 팝업은 HTML5 변환 때 UI5 `sap.m.ResponsivePopover` → native `<dialog>` + `showModal()` 로 바뀌었다.
- 모달이 열리면 **그 document 의 dialog 바깥이 전부 inert** → `document.body` 에 붙인 임시 `textarea` 가 inert → `select()` 가 selection 을 못 만듦 → 복사되는 내용이 없음.
- **`execCommand('copy')` 는 실패해도 `true` 를 돌려준다.** 코드가 반환값을 안 보므로 실패를 모르고, "복사되었습니다" 토스트까지 정상으로 뜬다 → 사용자에게는 "됐다는데 붙여넣기가 안 됨" 으로 보인다.
- 원본(UI5)에서 안 터진 이유: popover 는 native 모달이 아니라 inert 가 안 걸린다.

## 변경 파일
- 추가: `.docs/history/2026/09/2026-09-14_014957_claude_docs_favIconPopup_57920b4c.md` (이 문서)
- 변경: **없음**
- 삭제: **없음** (조사용 임시 폴더 `_cliptest/` 는 생성 후 삭제)

### ※ stop hook 이 지적한 파일에 대하여
hook 이 "최근 이력보다 뒤에 손댄 파일" 로 아래를 나열했으나, **이번 세션에서 내가 고친 파일이 아니다.** 이전 세션들의 미커밋 변경분이며, 이 세션은 읽기(cat/grep/diff)만 했다. 기록 누락은 그 작업들 쪽 문제이므로 여기서 내용을 지어내 채우지 않는다.
`www/settings/ws_settings.json`, `Popups/bindPopup/bindShared.js`, `Popups/bindPopup/frame.js`, `Popups/docPopup/frame.js`, `Popups/findPopup/findFrame.js`, `Popups/runtimeClassNavigator/frame.js`, `design/attrPresetPopup/index.js`, `design/attrPresetPopup/list/index.js`, `js/fnDialogPopupOpener.js`, `js/fnFindPopupOpen.js`, `js/ws_html5_ws20_prev.js`

## 변경 이유
원본 우선·임의창작 금지 규칙에 따라 **원인 보고까지만** 하고, 수정은 장군님 지시를 받고 진행한다.

## 영향 범위 (조사 결과)
- ❌ 즐겨찾기 아이콘 팝업의 이름 복사 — 모달 안이라 실패 (지금 문제)
- ✅ 속성 영역 값 복사(`design/js/uiAttributeArea.js`) — 모달 없이 호출되므로 정상
- ✅ OTR 값도움 복사(`Popups/OTRF4HelpPopup/index.js` 자체 구현) — 별도 창이고 그 창에 `showModal` 이 없음
- ⚠ 앞으로 **모달 `<dialog>` 안에서 복사를 호출하는 화면은 전부 같은 방식으로 조용히 실패**한다.

## 검증
- Electron 14.2.9 / Chromium 93 실행해 위 표대로 실측(clipboard 실제 내용까지 확인). 앱 자체를 띄워 확인한 것은 아니고, 동일 구조 하네스로 재현했다 — **실 앱에서의 재확인은 미완**.
- 앱 로그에는 이 경로의 흔적이 없다(복사 경로에 로그가 한 줄도 없음). 고칠 때 로그를 같이 넣어야 한다.

## 참고 사항 (고칠 때)
- 해법은 이미 이 프로젝트 안에 있다 — 토스트가 같은 top-layer 문제를 겪어, **가장 위에 열린 모달 `<dialog>` 안에 붙이는 방식**으로 해결돼 있다(`www/ws30/resources/index.js` 토스트 코드). 임시 `textarea` 도 같은 host 선택 로직을 쓰면 된다. 모달이 없으면 지금처럼 body.
- 함께 넣을 것: `execCommand` 반환값 + selection 길이 확인 → 실패면 오류코드 로그(영어) 남기고, **실패 시 "복사됨" 토스트를 띄우지 않는다.**
- 부수 발견: `www/ws30/ws10_20/design/favIconPopup/index.js` 의 복사 핸들러가 상류 원본(`U4A_WS_DESIGN`)에서는 `oEvent.preventDefault()` 로 고쳐졌는데 작업 폴더 사본은 전역 `event` 를 쓰는 옛 형태다. Chromium 에서는 동작하므로 이번 증상의 원인은 **아니다**. 정리할 때 같이 맞추면 된다.

---

## 후속 (2026-09-14 02:0x) — "다른 별창은 되는데 왜 여기만?" 전수 조사

장군님 지적: 다른 별창에도 복사 로직이 많은데 왜 여기만 안 되나, 잘 되는 것을 따라해라.

### 프로젝트 안 복사 방식은 3가지였다 (grep 전수, 남의 library 제외)

| 방식 | 쓰는 곳 | 모달 열린 상태에서 |
|---|---|---|
| **A. Electron `clipboard` 모듈** (`REMOTE.clipboard.writeText` / `REMOTE.require('electron').clipboard`) | 패턴 창(`Popups/patternPopup/frame.js`), 글꼴 마법사(`Popups/fontStyleWizard/frame.js`), 이미지 아이콘 창(`Popups/illustMsgPopup/JS/selectSAP.js`), USP URL 복사(`js/usp/ws_html5_usp.js`) | **정상** — DOM/inert 와 무관 |
| **B. textarea + execCommand + 성공여부 확인 + `navigator.clipboard` fallback** | 에디터(`js/ws_html5_client_editor.js`, `Popups/editorPopup/editorFrame.js`), 런타임 클래스 창(`Popups/runtimeClassNavigator/frame.js`), 속성 영역(`js/ws_html5_ws20_attr.js`) | 실패해도 fallback 이 받는다 |
| **C. textarea + execCommand 만, 반환값 안 봄, fallback 없음** | 셸 공통 `setClipBoardTextCopy`(`www/ws30/resources/index.js`) ← **즐겨찾기 팝업이 이걸 쓴다** | **조용히 실패** |

즉 "여기만 안 되는" 이유 = 즐겨찾기 팝업만 **C(원본 그대로의 공통 함수)** 를 native 모달 안에서 부르기 때문. 별창들은 애초에 A/B 를 쓴다.

### 추가 실측 (Electron 14.2.9, 모달 `showModal()` 열어 둔 채 같은 document 에서)
| 방식 | 결과 |
|---|---|
| `require('electron').clipboard.writeText()` | **성공** (읽어서 확인) |
| textarea + `execCommand('copy')` | `execCommand` 는 `true` 인데 selection 길이 0, clipboard 안 바뀜 → **조용히 실패** |

메인 window 는 `nodeIntegration: true` / `contextIsolation: false`(`electron/main.js:299~301`) 라 renderer 에서 `require('electron').clipboard` 를 바로 쓸 수 있다. 셸 window 는 이미 `@electron/remote` 를 `require` 하고 있다(`www/ws30/resources/index.js:31`).

### 그래서 고칠 방향 (지시 대기)
셸 공통 `setClipBoardTextCopy` 를 **A 방식 우선 + 기존 textarea 방식 fallback** 으로 바꾼다. 그러면 즐겨찾기 팝업뿐 아니라 **같은 공통 함수를 쓰는 모든 자리**(속성 영역 값 복사, 아이콘 목록 등)가 한 번에 안전해진다. 실패 시 오류코드 로그(영어)를 남기고, 실패했으면 "복사됨" 토스트를 띄우지 않는다. 아직 **코드 변경 없음**.

---

## 후속 2 (2026-09-14 02:2x) — 수정 적용 (type: fix)

장군님 지시 "진행해" — 위 방향대로 고쳤다.

### 변경 내용
1. **`www/ws30/resources/index.js`** — 공통 `setClipBoardTextCopy`
   - **Electron `clipboard` 모듈 우선**(`require("electron").clipboard.writeText`) — DOM inert 와 무관.
   - 실패 시 **fallback = 원본 방식**(임시 `<textarea>` + `execCommand('copy')`). 단 `execCommand` 반환값만 믿지 않고 **selection length > 0** 까지 봐야 성공으로 친다(`execCommand` 는 실패해도 true 를 준다).
   - **반환값 = 성공 여부(true/false)** 추가. 콜백에도 성공 여부를 넘긴다(기존 호출자 4곳 모두 콜백을 안 쓴다 — grep 확인).
   - 실패 시 `[RSRC-007]` console.error + `U4ALOG.warn("GUARD_EXIT", "clipboard write", ...)`. 파일 상단 다음 번호 007 → 008.
   - 임시 textarea 는 실패·예외 경로에서도 반드시 제거(실측: body 에 0개 남음).
2. **`www/ws30/ws10_20/js/fnFavIconPopupOpen.js`** — 즐겨찾기 팝업의 복사 처리
   - 복사가 **실제로 성공했을 때만** "복사되었습니다" 안내를 띄운다. 실패면 `[FFIP-001]` + 로그만 남기고 안내 안 띄움.
   - 파일 상단에 오류코드 접두 주석(`FFIP`) 추가.
3. **`.works/DEV_STANDARD_오류처리.md`** — 접두 사전에 `FFIP` 한 줄 등록.
4. **`.works/클립보드복사/00_현황판.md`** — 신규. 맨 위에 테스트 5건(CP1~CP5).

### 변경 파일
- 변경: `www/ws30/resources/index.js`, `www/ws30/ws10_20/js/fnFavIconPopupOpen.js`, `.works/DEV_STANDARD_오류처리.md`
- 추가: `.works/클립보드복사/00_현황판.md`, 백업 `www/ws30/resources/_index.js.20260914.clipboard.bak`, `www/ws30/ws10_20/js/_fnFavIconPopupOpen.js.20260914.clipboard.bak`
- 삭제: 없음 (검증용 임시 폴더는 생성 후 삭제)

### 검증 (실측 — 실제 소스에서 함수를 그대로 뽑아 Electron 14.2.9 / Chromium 93 에서 실행)
| 경우 | 반환 | clipboard |
|---|---|---|
| 모달 없음 | true | `sap-icon://account` ✅ |
| **모달 `showModal()` 열림** | **true** | **`sap-icon://favorite`** ✅ (수정 전에는 안 바뀜) |
| 문자열 아닌 인자 | false | — |
| 콜백에 성공 여부 전달 | true | ✅ |
| Electron clipboard 불가 + 모달 없음 (fallback) | true | `FALLBACK_TEXT` ✅ |
| Electron clipboard 불가 + 모달 열림 | **false** | 복사 안 됨 — 실패를 정직하게 반환 ✅ |
| 임시 textarea 잔여 | body 에 0개 | ✅ |

`node --check` 두 파일 통과.

### 아직 안 한 것 (숨기지 않고 적는다)
- **실 앱을 띄워 손으로 눌러 본 확인은 미완.** 테스트 표 = `.works/클립보드복사/00_현황판.md` CP1~CP5.
- 복사 **실패 전용 메시지 키가 없어** 실패 시 화면 안내를 못 한다(콘솔 오류코드 + 로그만). 메시지 DB 직접 등록 금지 규칙에 따라 장군님께 요청만 한다.
- `js/ws_html5_ws20_attr.js` 자체 복사의 fallback 도 `execCommand` 결과를 안 보고 성공 처리한다. 모달 안에서 쓰지 않아 증상이 없어 **이번엔 손대지 않았다**(요청 밖 변경 금지).
- `design/js/callIconListPopup.js`(아이콘 목록 팝업)도 공통 함수를 쓰지만 HTML5 미변환 상태라 실제 화면에서 도달하지 않는다 — 테스트 항목에 넣지 않았다.

### 후속 3 — 테스트 범위 축소 (소스 근거)
`setClipBoardTextCopy` 의 live 호출자를 다시 전수 확인한 결과, **이번 변경이 닿는 화면은 즐겨찾기 아이콘 팝업 한 곳뿐**이다.
- WS20 속성 줄 복사 버튼·UI5 라이브러리명 복사 → HTML5 속성 영역(`js/ws_html5_ws20_attr.js`)이 **자기 복사 코드**를 쓴다(공통 함수 미사용).
- 공통 함수를 부르는 `design/js/uiAttributeArea.js` 의 `attrCopyText` 는 UI5 시절 경로라 화면에서 도달하지 않는다.
→ 현황판 테스트를 **5건 → 3건(CP1~CP3)** 으로 줄였다. CP4·CP5(속성 값 복사·라이브러리명 복사)는 변경이 닿지 않아 **삭제**.

---

## 후속 4 (2026-09-14) — 즐겨찾기 창 검색이 "복사한 값"으로 안 걸리던 것 수정 (type: fix)

장군님 지적: "원본에 없는 건 알겠는데, 최소 검색 기능을 넣을거면 클립보드 복사한 값도 검색이 되어야 하지 않냐."

### 무엇이 문제였나
- 복사 버튼이 복사하는 값 = `ICON_SRC`(`sap-icon://account`)
- 검색 필터는 `ICON_NAME`(`account`) **만** 비교 → 복사한 값을 붙여넣으면 **0건**
- 같은 앱의 **아이콘 뷰어**(`Popups/iconPrevPopup/runtime.js`) 검색은 `KEYWORD_STRING` 또는 `ICON_SRC` 를 Contains 로 본다 — 앱 안에서 기준이 서로 달랐다.
- 참고: 이 창의 검색칸은 **원본(UI5)에 없다**(우리가 추가). 그래서 판단 기준을 아이콘 뷰어에 맞췄다.

### 변경 내용
- `www/ws30/ws10_20/design/favIconPopup/index.js`
  - 타일의 검색용 캐시를 `ICON_NAME` → **`ICON_NAME + " " + ICON_SRC`**(소문자)로 바꾸고, 필터가 그것을 본다.
- `www/ws30/ws10_20/js/fnFavIconPopupOpen.js`
  - 목록을 만들 때 `ICON_SRC` 없는 항목 수를 세어 있으면 로그 1줄(`GUARD_EXIT`, 영어). 그 항목은 검색·복사·선택이 전부 안 되므로 즐겨찾기 파일 손상 감지용. iframe 쪽은 log 라이브러리를 안 싣고 있어(앱 시작 비용) 부모에서 남긴다.

### 변경 파일
- 변경: `www/ws30/ws10_20/design/favIconPopup/index.js`, `www/ws30/ws10_20/js/fnFavIconPopupOpen.js`, `.works/클립보드복사/00_현황판.md`
- 추가: 백업 `www/ws30/ws10_20/design/favIconPopup/_index.js.20260914.search.bak`

### 검증 (실측 — 실제 소스의 필터·캐시 코드를 그대로 뽑아 Electron 14.2.9 에서 실행, 타일 4개)
| 검색어 | 보인 건수 | 카운트 | 결과없음 |
|---|---|---|---|
| `sap-icon://account` (복사한 값) | 1 | `1 / 4` | - |
| `account` (이름) | 1 | `1 / 4` | - |
| `SAP-ICON://BELL` (대문자) | 1 | `1 / 4` | - |
| `address` (일부) | 2 | `2 / 4` | - |
| `zzzz` | 0 | `0 / 4` | 표시됨 |
| 빈칸 | 4 | `4` | - |

`node --check` 두 파일 통과. 현황판 테스트 CP4(복사한 값 붙여넣어 검색) 추가 — 총 4건.

### 아직 안 한 것
- **실 앱 확인 미완**(테스트 표로 넘김).
- 즐겨찾기 데이터의 낱말 목록(`KEYWORD_STRING`)은 **아직 검색 대상이 아니다.** 아이콘 뷰어는 그것으로도 찾는다 — 기준을 완전히 맞추려면 추가 지시 필요. 이번엔 장군님이 말씀하신 "복사한 값" 까지만 했다(요청 밖 확대 금지).
