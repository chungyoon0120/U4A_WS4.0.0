# 앱 복사 창 — 패키지 돋보기를 누르면 Critical Error (구글시트 8번) · 원인 조사

- 날짜 2026-10-15 · 세션 06836675 · type=invest · **코드는 한 줄도 안 고쳤다**
- 증상(장군님 화면): 앱 복사 창 > 패키지 칸 돋보기 →
  `[onError]: Uncaught TypeError: sap.ui.getCore(...).loadLibrary is not a function , 336:20`

## 원인 (소스로 확인)

1. 돋보기 = `oAPP.events.ev_packageSchpEvt` (`js/fnAppCopyPopupOpen.js:519`)
   → `oAPP.fn.fnPackgSchpPopupOpener` (`js/fnDialogPopupOpener.js:460`).
2. 그 함수가 **아직 변환 안 된 UI5 파일** `design/js/callF4HelpPopup.js` 를 받아서 실행한다.
3. 그 파일 **336줄** = `sap.ui.getCore().loadLibrary("sap.m")` — 오류의 `336:20` 과 같은 자리.
4. 메인 창의 `sap` 은 UI5 가 아니라 **호환 스텁**(`js/ws_html5_shell.js:45~`)이고,
   그 `getCore()` 가 주는 객체에는 `byId / lock / unlock / isLocked / applyTheme / setModel /
   getModel / setLanguage / attachInit / getConfiguration` 뿐 — **`loadLibrary` 가 없다** → TypeError.

## 이미 있는 올바른 길

- HTML5 공통 F4 창 = `js/fnF4SearchHelpPopup.js` 의 `oAPP.fn.fnF4SearchHelpOpen({shlpname, onPick})`.
- **패키지 변경 창(`design/js/changeAppPackagePopup.js:630~`)은 이미 그 길을 쓰고 있고**,
  주석에 「`fnPackgSchpPopupOpener` 는 UI5 `callF4HelpPopup.js` 를 로드해 HTML5 에서 크래시하므로 미사용」
  이라고 적혀 있다. 같은 백엔드(`/f4serverData`)라 결과 행의 `DEVCLASS` / `CTEXT` 도 그대로다.
- `fnPackgSchpPopupOpener` 를 **실제로 쓰는 곳은 앱 복사 창 한 곳뿐**(grep 전수).

## 같이 본 것 (아직 안 고침 — 보고만)

- 앱 복사 쪽 콜백이 `oResult.DEVCLASS` 를 **바로** 읽는다(`fnAppCopyPopupOpen.js:526`).
  취소로 빈 값이 오면 터진다. 패키지 변경 창 콜백은 `if (!param) return;` 가드가 있다.

## 또 밟을 함정

- **메인 창에서 `design/js/*` UI5 파일을 지연 로드해 부르면 같은 식으로 죽는다.**
  메인 창 `sap` 은 스텁이라 `loadLibrary` 같은 UI5 전용 함수가 없다.
  → 옛 UI5 F4 경로를 부르는 자리는 전부 `fnF4SearchHelpOpen` 으로 가야 한다.

---

## 고침 — 2026-10-15 (장군님 지시 「바꿔」)

- `js/fnDialogPopupOpener.js` `fnPackgSchpPopupOpener`:
  `$.getScript("design/js/callF4HelpPopup.js")` + UI5 팝업 호출 → **`oAPP.fn.fnF4SearchHelpOpen({shlpname:"DEVCLASS", onPick:cb})`**.
  미로드면 `oAPP.loadJs("fnF4SearchHelpPopup", …)` 로 받은 뒤 연다.
  로드 실패 시 `U4ALOG.warn("GUARD_EXIT", …)` + 화면에 `[FDPO-007]` + 기존 키 950(Value help is not available) — fail-closed.
- `js/fnAppCopyPopupOpen.js` 패키지 콜백: `if (!oResult) { warn; return; }` 가드 추가(취소 시 터지던 자리).
- 오류코드: 파일 머리 사전에 005·006(이미 본문에서 쓰이고 있었으나 사전에 빠져 있었다)을 채우고 **007** 을 새로 썼다. 다음 번호 008.
- `node --check` 두 파일 통과. **앱으로는 안 돌려 봤다 — 장군님 테스트 대기.**

### 버린 방법

- 앱 복사 창에서 공통 F4 를 직접 부르는 방법 → 쓰지 않았다. 패키지 F4 진입점이 `fnPackgSchpPopupOpener`
  하나이고 그 함수를 쓰는 곳이 앱 복사 창뿐이라, 진입점 자체를 고치는 쪽이 같은 함정을 남기지 않는다.

## 검색 도움말 창의 글자가 영어로 나오는 건 — 소스는 원본과 같다 (2026-10-15)

- 검색 조건 라벨 = 서버가 준 `SCRTEXT_M`, 결과 컬럼 머리 = `SCRTEXT_S`. **원본과 같은 값**을 쓴다.
- 서버에 보내는 것도 원본과 같다(`trgubun` / `_SHLPNAME` / `_SHLPSUB`). 언어는 **접속 세션의 로그온 언어**가 정한다 — 원본도 WS4.0 도 언어를 따로 보내지 않는다.
- **아직 안 본 것**: 원본 WS3.0 을 같은 접속 언어로 열었을 때 실제로 어떻게 나오는지.
  장군님이 「원본이랑 똑같다」고 하셨다가 **「잘못 봤다」로 정정**하셨다. 그러니 **판정 보류**다 —
  소스상 차이가 없다는 것까지만 확인됐다. 캡처 당시 접속 언어는 화면 아래 상태줄 기준 `EN`.

## 테스트 통과 — 2026-10-15 (장군님 「잘된다 수정 완료」)

구글 시트 8번 **끝남**. 목록에서 지웠다(고칠 것 16 → 15건).
검색 도움말 창 글자 언어 건은 장군님이 **「잘못 봤다」로 정정** — 따로 볼 것 없음.
