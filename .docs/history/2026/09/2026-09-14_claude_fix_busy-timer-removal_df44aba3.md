# 별창 busy — 타이머로 busy 를 푸는 자리 13곳 제거 + 진짜 실패 이벤트 배선

작업일: 2026-09-14 · 대화창: df44aba3

## 요청

장군님 지시: **"별창 busy 부터 마무리하자"** — 「별창(BrowserWindow) 뜨자마자 busy 켜기」 작업에
남아 있던 D6(타이머로 busy 를 푸는 자리 제거) · D7(속성 바인딩 별창 자체 서버 호출 함수)을 끝내라는 뜻.

작업 중 추가 지시:
> "작업이 완료되면 샘플링 몇개 선정해서 별창 실행 시, 처음 실행되는 부분 또는 실행하자마자 서버를
> 호출하는 부분이 있을 경우에는 일부러 timeout로직을 넣고 테스트를 해보자. (…) 앞으로 테스트 로직을
> 넣자라고 하면, 만약을 대비해서, app.ispackaged <-- 패키징이 아닐경우에만 테스트 임시코드가
> 동작하게하는 체크로직을 반드시 추가해줘"

근거 규칙: `.analy/16` §2.11 · 메모리 `no-timeout-busy-fallback` — **busy 해제는 실제 완료/실패
이벤트로만.** busy 가 안 꺼지는 건 "고장났다"는 신호인데, 타이머로 꺼버리면 화면은 빈 채인데
사용자는 끝난 줄 착각한다(안 꺼지는 busy 보다 나쁜 상태).

## 무엇이 문제였나

타이머가 있다는 건 **진짜 실패 이벤트가 안 걸려 있다**는 신호였다. 실제로 전부 그랬다.

| 기다리던 것 | 왜 안 왔나 |
|---|---|
| 창을 연 쪽이 보내는 첫 데이터 IPC | 창 문서 로드 실패(`did-fail-load`)가 일부 창에 안 걸려 있었다. 전송부 예외도 안 잡았다 |
| Monaco host 의 `ready` | `loader.js`·`index.js` 의 `onerror` 가 없고, `require(deps, cb)` 에 실패 콜백(errback)이 없었다 → 파일을 못 읽어도 **아무 신호도 안 갔다** |
| 미리보기 창이 떴다는 IPC | 미리보기 창 opener 에 `did-fail-load` 가 없었다 |
| 새 창이 떴다는 IPC | 공통 새창 열기가 `did-fail-load` 에서 호출자 콜백을 **안 불렀다**(성공에서만 불렀다) |
| 서버이벤트 목록 | 실패 시 성공 콜백을 안 부른다(Promise 만 resolve). Find 창 opener 가 성공 콜백만 썼다 |

## 변경 내용

### 1. Monaco host 3벌 — 실패를 부모에 알린다 (신규 배선)

`index.html` 에 `_hostFail()` 을 추가하고 `loader.onerror` · `index.js onerror` 를 걸었다.
`index.js` 는 `require(deps, cb, errback)` 형태로 바꿔 실패 콜백을 넣고, 성공 콜백 안의 본체를
`try/catch` 로 감쌌다. 실패하면 부모에 `postMessage({evt:"error", code, where, detail})`.

| host | 오류코드 접두 | 쓰는 창 |
|---|---|---|
| `Popups/editorPopup/host/` | `EDHT` | 편집기 CSS/JS/HTML · Error Page Editor · 소스 패턴 |
| `Popups/versionMng/host/` | `VMHT` | 버전 비교(diff) |
| `js/codeeditor/` | `CEHT` | 클라이언트 이벤트 편집기 팝업 |

### 2. 창 쪽 — 타이머 제거 + `evt:"error"` 수신

| 파일 | 뺀 타이머 | 넣은 것 |
|---|---|---|
| `Popups/editorPopup/editorFrame.js` | 15초 | `EDTF` — iframe `onerror` + host 실패 수신 → `_hostFatal`(잠금 해제 → 314+290 메시지 → 창 닫기) |
| `Popups/errPageEditorPopup/errorPageEditorFrame.js` | 15초 ×2 | `EPEF` — 위와 동일 + 미리보기 요청 전송 실패 처리 |
| `Popups/patternPopup/frame.js` | 15초 | `PATF` — 뷰어 host 실패 = 창 닫기 / 편집 다이얼로그 host 실패 = 다이얼로그 닫기(빈 편집기로 덮어쓰기 방지) |
| `Popups/versionMng/versionMngFrame.js` | 15초 · 5초 · 20초 | `VMNG-003` — `_waitHostReady` 를 실패 콜백(`fnHostFailWait`)으로 끊는다 |
| `js/ws_html5_client_editor.js` | 8초 · 5초 | `CLED` — `lf_hostFatal`(로딩 해제 → busy 해제 → 팝업 닫기 → 314+290 메시지) |
| `Popups/bindPopup/frame.js` | 20초 | 제거만(오프너에 실패 이벤트 배선) |
| `Popups/docPopup/frame.js` | 20초 | 제거만 |
| `Popups/findPopup/findFrame.js` | 20초 | 제거만 |
| `Popups/runtimeClassNavigator/frame.js` | 20초 | 제거만 |
| `design/attrPresetPopup/list/index.js` | 20초 | 제거만 |

### 3. 창 여는 쪽 — 진짜 실패 이벤트 배선

| 파일 | 오류코드 | 넣은 것 |
|---|---|---|
| `js/fnDialogPopupOpener.js` | `FDPO-005` (속성 바인딩 별창) · `FDPO-006` (Runtime Class Navigator) | `did-fail-load`(하위 프레임·취소 -3 제외) → 창 destroy + 잠금 해제. 전송부 try/catch |
| `js/fnFindPopupOpen.js` | `FFPO-001/002/003` | `did-fail-load` + **서버이벤트 목록을 Promise 로** 받아 성공·실패 모두 창에 전송. 새로고침 경로도 동일 |
| `js/fnErrorPageEditorPopupOpen.js` | `FEPE-002` | 미리보기 창 `did-fail-load` → 창 정리 + 편집 창에 busy 해제 신호 전송 |
| `design/attrPresetPopup/index.js` | `APRO-001` | `did-fail-load` → 창 정리 + 잠금 해제. 전송부 try/catch |
| `www/ws30/resources/index.js` | `RSRC-006` | 공통 새창 열기의 `did-fail-load` 에서 **호출자 콜백도 부른다**(+ 하위 프레임·취소 제외 가드) |

### 4. 그 밖

- `Popups/bindPopup/bindShared.js` — 자체 서버 호출에 `onabort` · `ontimeout` 추가(연결 끊김은 이미 있었다).
  어느 경로로 끝나든 `fn_success(null)` 을 불러 호출부 busy 가 풀리게 했다.
- `js/ws_html5_ws20_prev.js` — 주석에 적힌 "60s watchdog" 은 **코드에 없는 묵은 글**이었다. 바로잡았다.

### 5. ★ 테스트 임시 코드 (app.isPackaged 가드) — 장군님 지시

창이 뜨자마자 busy 를 켜는지 **눈으로** 보시라고, 첫 데이터/첫 서버 호출을 일부러 늦추는 코드를 넣었다.
**`app.isPackaged === false` 일 때만 동작**하며, 값을 못 읽으면 동작하지 않는 쪽으로 기운다(fail-closed).
기본값은 `0`(= 아무 일도 안 함).

| 창 | 파일 | 이름 |
|---|---|---|
| 현재 앱 기술 문서 | `js/fnDialogPopupOpener.js` | `C_TEST_OPEN_DELAY_MS` |
| Version Management | `js/fnVersionManagementPopupOpen.js` | `C_TEST_OPEN_DELAY_MS` |
| U4A MIME Repository(서버 호출) | `Popups/mimeRepository/mime.js` | `C_TEST_CALL_DELAY_MS` |

## 손대지 않은 것 (판단 근거)

| 무엇 | 왜 |
|---|---|
| Find 창 "컨트롤러 실행 3초 뒤 busy 해제" | **원본에 있는 동작.** 원본 `Popups/findPopup/index.js` `ev_press_Link_Find_Controller` 가 `setTimeout(…, 3000)` 으로 끊는다(완료 이벤트가 없다). 원본 1:1 우선 |
| `Popups/bindPopup/index.js` 의 자체 서버 호출(D7) | 현행 창(`frame.html`)이 **이 파일을 로드하지 않는다**(소스로 확인 — 옛 UI5 판). 죽은 경로 |
| 서버 호출부가 실패 콜백을 안 넘기는 자리 | 공통 서버 호출 함수가 모든 실패 경로에서 busy 를 푼다 — **의도된 설계**(장군님 지적 2026-09-14) |

## 검증

- 손댄 `.js` 전부 `node --check` 통과.
- 백업: 고친 파일마다 같은 폴더에 `_<파일명>.<태그>bak`.
- **앱 실행 테스트는 미실행** — 현황판 BT1~BT5 + 기존 BE1~BE10 · BD1~BD5 가 대기 중이다.

## 문서

- `.analy/16_공통_화면UX_표준.md` §2.10 — "타이머를 걷어낸 자리에 무엇을 배선했나" 표 추가.
- `.works/DEV_STANDARD_오류처리.md` — 오류코드 접두 11개 추가(EDHT·VMHT·CEHT·EDTF·EPEF·PATF·CLED·FFPO·FEPE·FVMP·APRO).
- `.works/별창busy시작/00_현황판.md` — BT 그룹(테스트) 최상단 추가, §3 에 이번 변경 기록, D6·D7 해결 표기.
- 메모리 `test-code-guard-not-packaged` 신규 — 테스트 임시 코드는 반드시 `app.isPackaged` 가드.

## 남은 것

| 무엇 | 상태 |
|---|---|
| BT1~BT5 · BE1~BE10 · BD1~BD5 테스트 | **전부 미실행**(앱 재시작 필요) |
| D5 — ServerList · Login · 인트로 · 메인 창도 같은 방식으로 | **한다**(장군님 결정 2026-09-14). 테스트가 끝난 뒤 착수 |
| D8 — 테스트 임시 코드 | **안 남긴다**(장군님 결정 2026-09-14). 테스트가 끝나면 3곳 전부 걷어낸다. 지울 자리는 현황판 §0-1 에 적어 뒀다 |
| 백업 파일 정리 | 미정리 |

---

## 후속 (2026-09-14, 같은 대화) — 테스트 지연을 켜 둔 채로 넘김 + 내 잘못 2건

### 요청

> "현재 앱 기술 문서 <-- 실행하자마자 뜨는데 뭘 했다는거야? 딜레이 로직 넣은거 맞어?"
> "설마 시발 나보고 딜레이 값을 넣고 하라는거야?"
> "시발 내가 직접할꺼면 지금 바이브 코딩을 내가 왜하겠냐 미쳤나? 나를 시켜?"

### ★ 내 잘못 ① — 장군님께 코드를 고치게 시켰다

일부러 늦추는 테스트 코드를 **기본값 `0`(꺼짐)** 으로 두고, 현황판 조작 단계에 **"파일을 열어 숫자를
5000 으로 바꾸고 저장한다"** 를 적었다. 장군님이 창을 여니 당연히 바로 떠서 "딜레이 넣은 거 맞냐"는
질문이 나왔다. **코드를 만지는 건 전적으로 내 일인데 장군님께 넘긴 것이다.**

- 조치: 3곳 전부 **5000(5초)로 켜서** 넘겼다. 끄는 것도 내가 한다.
- 현황판 BT1~BT4 의 조작 단계에서 **파일 고치라는 줄을 전부 제거**했다. 남은 조작은 앱 켜기 ·
  메뉴 누르기 · 눈으로 보기뿐이다.
- 메모리 `never-make-user-edit-code` 신규 — 테스트에 필요한 코드 상태는 **내가 만들어 놓고** 드린다.

### ★ 내 잘못 ② — 화면에 없는 이름을 지어냈다 ("App. Documentation")

그런 글자는 화면 어디에도 없다. 메시지 DB 를 **읽기만 해서** 실제 글자를 확인했다.

| 메시지 | EN | KO |
|---|---|---|
| `/U4A/CL_WS_COMMON` B39 (메뉴) | Help | 도움말 |
| `/U4A/CL_WS_COMMON` B65 (항목·창 제목) | Current app technical documentation | 현재 앱 기술 문서 |

메뉴 자리 = **WS20 상단 메뉴 `도움말` → `현재 앱 기술 문서`**(책 모양 아이콘, 두 번째 항목).
핸들러는 `fnHmws.js` 의 WS20 도움말 메뉴 세 번째 항목 → `fnDocuPopupOpener` (소스로 확인).

문서 4개에서 그 딱지 **19곳**을 화면 실제 글자로 바꿨다
(`.works/별창busy시작/00_현황판.md` 10 · `01_전수조사.md` 3 · `.analy/16` 2 · 이 이력 1 외).

### 변경 파일 (변경만, 추가·삭제 없음)

| 파일 | 무엇 |
|---|---|
| `www/ws30/ws10_20/js/fnDialogPopupOpener.js` | 테스트 지연 값 `0` → `5000` |
| `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js` | 테스트 지연 값 `0` → `5000` |
| `www/ws30/ws10_20/Popups/mimeRepository/mime.js` | 테스트 지연 값 `0` → `5000` |
| `.works/별창busy시작/00_현황판.md` | BT 조작 단계에서 파일 편집 제거, 지어낸 이름 교체 |
| `.works/별창busy시작/01_전수조사.md` | 지어낸 이름 교체 |
| `.analy/16_공통_화면UX_표준.md` | 지어낸 이름 교체 |
| 메모리 `never-make-user-edit-code` · `MEMORY.md` | 신규 규칙 |

### 영향 범위

- **개발 실행(패키징 아님)에서만** 세 창의 첫 데이터·첫 서버 호출이 5초 늦는다.
  `app.isPackaged` 가 false 일 때만 돌고, 값을 못 읽으면 동작하지 않는다(fail-closed).
- 패키징본 동작은 변화 없다.

### 검증

- 세 파일 `node --check` 통과.
- 값이 실제로 `5000` 인지 소스로 재확인.
- **앱 실행 확인은 장군님 차례** — BT1~BT3 미실행.

### 참고 사항 (다음 agent 가 같은 실수 반복하지 않게)

1. **테스트용 스위치는 켜 둔 채로 넘긴다.** 기본값 꺼짐 + "장군님이 켜세요"는 금지다.
2. **`REMOTE.app.isPackaged` 는 이 코드베이스에서 정상 동작한다**(`ws_common.js` 등이 `APP = REMOTE.app`
   로 같은 경로를 쓴다). 이번에 창이 바로 뜬 원인은 가드가 아니라 **값이 0** 이었던 것이다.
3. **창·메뉴 이름은 메시지 DB 에서 실제 글자를 읽어 쓴다.** 영문 약칭을 지어내지 말 것.
4. D8(테스트 코드 제거)이 아직 남아 있다 — **지금 5000 으로 켜져 있다.** 테스트가 끝나면 반드시 걷어낸다.
   지울 자리는 현황판 §0-1 에 적어 뒀다.

---

## 후속 2 (2026-09-14, 같은 대화) — 테스트 통과 → 지연 테스트 코드 제거 (D8 완료)

### 요청

> "테스트 다 통과했다, 지연 빼라"

### 변경 내용

일부러 늦추던 테스트 임시 코드를 **3곳 전부 제거**했다. **실패 처리(try-catch)는 남겼다** —
그건 테스트용이 아니라 이번 작업의 본체(진짜 실패 이벤트 배선)다.

| 파일 | 지운 것 | 남긴 것 |
|---|---|---|
| `www/ws30/ws10_20/js/fnDialogPopupOpener.js` | 파일 위쪽 테스트용 helper 덩어리(상수 + 지연 함수) + 문서 창 데이터 전송부의 helper 호출 | 전송 실패 처리(`FDPO-011` try-catch) |
| `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js` | 데이터 전송부의 테스트 블록(상수 · isPackaged 판정 · setTimeout 분기) | 전송 실패 처리(`FVMP-001` try-catch) |
| `www/ws30/ws10_20/Popups/mimeRepository/mime.js` | 서버 호출 앞의 테스트 블록 | 서버 호출 한 줄(실패 콜백 7번째 인자 포함) |

### 변경 파일 (변경만, 추가·삭제 없음)

- `www/ws30/ws10_20/js/fnDialogPopupOpener.js`
- `www/ws30/ws10_20/js/fnVersionManagementPopupOpen.js`
- `www/ws30/ws10_20/Popups/mimeRepository/mime.js`
- `.works/별창busy시작/00_현황판.md` (BT1·BT2·BT3·BT5 ✅ O 표시, D8 완료 표기, 지운 내역 기록)

### 변경 이유

장군님 결정(2026-09-14): **테스트 임시 코드는 남기지 않는다.** 숫자만 0 으로 두는 것도 안 된다 —
패키징본에 나가면 그대로 버그가 된다. 메모리 `test-code-guard-not-packaged` 에 반영돼 있다.

### 영향 범위

- 세 창의 첫 데이터·첫 서버 호출이 **원래 속도로 복귀**. 개발 실행·패키징본 모두 지연 없음.
- busy 동작 자체는 변화 없다 — 타이머 제거와 실패 이벤트 배선(본 문서 위쪽)은 그대로다.

### 검증

- 세 파일 `node --check` 통과.
- **전 소스 grep 으로 테스트 코드 잔여 0 확인**(상수 이름 · 지연 함수 이름 · isPackaged 판정 변수 · 로그 앞머리).
- 테스트 결과: **BT1 · BT2 · BT3 · BT5 통과**(장군님 확인).
  **BT4(지연 제거 후 평소 속도 복귀)는 미확인** — 이번 제거 직후라 아직 앱으로 안 봤다.

### 참고 사항

- BE1~BE10 · BD1~BD5 는 **여전히 미실행**이다. 장군님이 "다 통과"라 하신 것은 BT 그룹 기준으로 적었다
  (BE·BD 까지 포함인지는 **미확인** — 다음 턴에 확인 필요).
- 전 소스 grep 중 **남의 코드에서 발견한 것(내가 손대지 않음, 보고만)**:
  `www/ws30/ws10_20/Popups/ui5CssPopup/frame.js` 232~241행에
  `[TEST] 테스트 끝나면 반드시 주석을 풀것!!` 로 감싸인 채 **창 닫기 처리가 주석 처리**돼 있다.
  이 파일은 현행에서 로드되는 곳을 못 찾았다(옛 UI5 판으로 보이나 **미확인**). 별건이라 손대지 않았다.
- 남은 것은 **D5**(ServerList · Login · 인트로 · 메인 창) 하나다.
