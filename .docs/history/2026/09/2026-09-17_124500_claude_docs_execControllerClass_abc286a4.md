# WS30 컨트롤러(클래스 빌더) 클릭 시 sap.m.Button 크리티컬 오류 — 원인 조사

## 요청

장군님: 「긴급 수정을 먼저 해야됨. 재현이 잘 안되는 오류 — WS30 화면에서 컨트롤러 버튼 클릭하면 갑자기 어떤 케이스에서 sap.m.Button 내용이 언급된 크리티컬 스크립트 오류가 발생했는데 다시 해볼라고 하니까 재현이 안 됨. 가능성이 있는 소스 확인 및 조사, 소스 레벨 깊게 분석」

## 변경 내용

코드 안 고침. 조사 결과 문서만.
- 원인 후보(소스 근거): `www/ws30/ws10_20/js/ws_fn_04.js` 394~485줄 `_openControllerErrorDialog` 가 **UI5 그대로**(`new sap.m.Dialog` / `new sap.m.Button`). HTML5 메인 창의 안전 스텁 `sap.m` 에는 Dialog·Button 이 없어 인자 평가 중 `sap.m.Button is not a constructor` 로 터진다.
- 이 함수는 **2차 VBS(sapgui_ws.vbs)가 stderr 를 쓸 때만** 불린다 → SAP GUI 세션이 없어 새로 로그인하다 실패(E02/E03/E99/E01·런타임 오류)할 때만. 다시 누르면 1차 VBS 가 기존 세션에 붙어 성공 → 재현 안 됨.
- 원본 60~250줄과 현행 diff 0 — 원본은 UI5 가 있어 「VBS 실행 오류」 창이 정상으로 뜬다. 변환에서 이 함수만 빠짐.
- 같이 찾음(원본 동일, 보고만): 2차 VBS 인자에 SAP 비밀번호가 들어간 채 console.log(173·200줄) · stderr 여러 조각 시 중복 실행 가능성(미확인).

## 변경 파일

- 추가: `.works/execControllerClass/01_sap_m_Button_크리티컬오류_조사.md` · 이 이력
- 변경·삭제: 없음

## 변경 이유

장군님 조사 요청.

## 영향 범위

없음(문서만).

## 검증

- 소스 읽기: `ws_html5_usp.js` · `ws_common.js` · `ws_fn_04.js` · `ws_html5_shell.js` · 원본 `ws_fn_04.js` · VBS 2개(`%APPDATA%\com.u4a_ws3.app\ext_api\vbs\` — WS4.0 개발 실행이 이 사본을 쓰는지는 미확인)
- 로그: WS3 포장본 로그(9/16·9/17)에 `sap.m.Button` 0건. WS4.0 개발 실행 로그 파일 없음 → **실측 증거 없음, 소스 근거만**
- 앱 실행 없음

## 참고 사항

- 수정은 장군님 지시 뒤에만.

---

## 후속 1 — 오류 창 HTML5 변환 · 콘솔 비밀번호 가림 (2026-09-17)

### 요청

장군님: 「로그엔 없어 오류창도 만들어줘」 · 「콘솔에 찍히는 비밀번호는 당연히 가려라」

### 변경 내용

- `www/ws30/ws10_20/js/ws_fn_04.js`
  - `_openControllerErrorDialog`: UI5 `sap.m.Dialog`/`sap.m.Button` → 공통 `.u4a-dialog`. 원본 내용 그대로(헤더 아이콘+「VBS 실행 오류」(227) / 오류 원문 + 「아래의 점검사항을 확인하세요.」(250) / 「점검사항」(249) 버튼 → `_showControllerErrorHelpPopup` · 닫기 X). 공통 3종(드래그·리센터·리사이즈) · ESC 닫기. 같은 창이 이미 있으면 닫고 새로 연다(stderr 조각 대비).
  - 창을 못 만들면 `[WFN4-001]` 콘솔 + `U4ALOG.caught` + `parent.showMessage` 로 표면화(fallback 창 안 만듦). 「점검사항」 실패 = `[WFN4-002]`.
  - 2차 VBS 파라미터 콘솔 출력: 찍는 사본의 10번째 값(`oUserInfo.PW`)만 `******`. VBS 에 넘기는 값은 그대로.
  - 파일 머리에 `// 오류코드 접두: WFN4 / 다음 번호: 003`.
- 원본과 다른 점(의도): 헤더 빨간 상태색 없음(.analy/16 §2.5) · 고정 500px 대신 `min(31.25rem, 90vw)` · 창 여러 개 쌓임 대신 하나로.

### 변경 파일

- 변경: `www/ws30/ws10_20/js/ws_fn_04.js` · `.works/DEV_STANDARD_오류처리.md`(접두 `WFN4` 등록) · `.works/execControllerClass/01_sap_m_Button_크리티컬오류_조사.md` · `.works/00_지금할것.md`
- 추가: `www/ws30/ws10_20/js/_ws_fn_04.js.vbserrdlgbak`(백업) · `.works/execControllerClass/00_현황판.md`(CE1~CE4)
- 삭제: 없음

### 검증

- `node --check` 통과 · 줄끝 CRLF 유지 확인 · 파일 안 `new sap` 0건
- **미실행**: 앱 확인 — 장군님(CE1~CE4). CE2 의 실패 재현 조작은 추정(미확인)

### 참고 사항

- Edit 도구가 원래 있던 줄끝 공백 2곳(파일 머리 주석 줄 · `aConsoleMsg` 줄)을 지웠다 — 동작 영향 없음.
- 로그: 2차 VBS 실패 원문은 원래 있던 `console.error("[VBS 실행 오류] ...")` 가 남긴다(포장본 로그 파일로 감).

---

## 후속 2 — 오류 케이스 테스트 방법 (2026-09-17)

- 장군님: 「오류 케이스를 어떻게 테스트를 해야하는지 알려줘」
- 소스 확인: 2차 VBS(`sapgui_ws.vbs`)는 SAP Logon 경로를 레지스트리 `HKCU\SOFTWARE\U4A\WS\GUIPath` (기본값)에서 읽어 실행(215·504·508줄) → 없는 경로면 실행 실패 → stderr → 오류 창. 이 값은 앱 시작 때 `ServerList.js` 689~695줄이 다시 써 넣어 앱 재시작으로 원복.
- 제약: 구 서버(네임스페이스 미적용)는 `asis_sapgui_ws.vbs` 가 다른 레지스트리(HKCR SapFront)를 읽어 이 방법이 안 먹음. 테스트 서버가 어느 쪽인지 미확인.
- 개발 실행(`%APPDATA%\com.u4a_ws3.app.dev\ext_api\vbs`)과 포장본 VBS 4개는 같은 파일(cmp).
- 변경: `.works/execControllerClass/00_현황판.md`(CE2 조작을 레지스트리 방법으로 교체, CE5 되돌리기 추가) · `.works/00_지금할것.md`
- 레지스트리는 내가 바꾸지 않았다(읽기만).

## 후속 3 — 오류 창 폭 · 한글 깨짐 · 「점검사항」 영어 (2026-09-17)

**Q (장군님):** 오류 메시지 한글 깨짐 보완 로직이 원본에 있었나 / 오류 창 가로가 너무 길다(두 번째 캡처 크기가 좋다) / 「점검사항」 이 한글로 접속했는데 왜 영어로 뜨나

**A:** 조사만 함, 코드 변경 없음 → `.works/execControllerClass/02_오류창_폭_한글깨짐_점검사항언어_조사.md`
- 한글 깨짐: 원본에 보완 코드 없음(`spawn` 인코딩 옵션·`iconv`·`TextDecoder` 없음, stderr 를 UTF-8 `toString()`). 원인 추정 = cscript CP949 출력을 UTF-8 로 읽음.
- 폭: 원본 `contentWidth: "500px"` 고정인데 변환 때 min-width 만 둬서 늘어남 — 변환 실수.
- 영어: 도움말 경로가 `globalLanguage`(ws_settings.json, 이 PC = EN)를 씀. 창 글자는 로그인 언어 우선이라 한글. 원본도 같음.
- 세 가지 모두 수정 여부는 장군님 결정 대기.

## 후속 4 — 1·3번 고침, 2번 방법 설명 (2026-09-17)

**Q (장군님):** 「1,3은 그렇게 하고, 2번은 어떻게 고친다는거야?」 (앞서 「정해주실것에 번호붙여서 물어봐」 — 메모리 정정)

**A:**
- 1번: `ws_fn_04.js` 오류 창 스타일 `min-width` → `width: min(31.25rem, 90vw)` (원본 contentWidth 500px). 백업 `_ws_fn_04.js.widthhelplangubak`.
- 3번: `_showControllerErrorHelpPopup` 도움말 언어 = `parent.process.USERINFO.LANGU` 우선, 없으면 `WS_LANGU`. 폴더 없을 때 영어 경고 로그 2곳.
- `node --check` 통과. 테스트 CE6·CE7 추가.
- 2번: 방법 가(cscript `//U` + utf-16le) / 방법 나(OEMCP 코드페이지 표) 설명, cscript 단독 시험 필요 → `02_…조사.md` §5. 결정 대기.

## 후속 5 — 2번(한글 깨짐) 시험 후 고침 (2026-09-18)

**Q (장군님):** 「근데 그걸 vbs 스크립트 파일을 안고쳐도 수정 가능한거야?」 → 「1,2 둘 다 그렇게 해」

**A:**
- 답: 스크립트 안 고쳐도 된다 — 오류 줄은 cscript 가 찍고, 깨지는 곳은 앱이 UTF-8 로 읽는 자리.
- 시험(scratchpad, cscript 단독): 옵션 없음 = euc-kr 로 풀면 한글 정상 / `//U` = stderr 0바이트 → 방법 가 탈락.
- 방법 나로 고침: `ws_fn_04.js` 에 레지스트리 OEMCP → TextDecoder 이름 표, stderr 두 곳 교체, 실패 시 utf-8 + 경고 로그, 예외 `[WFN4-003]`. 백업 `_ws_fn_04.js.stderrcpbak`. `node --check` 통과, CRLF 유지.
- 앱 레지스트리 라이브러리로 OEMCP 읽기 + 디코드 확인: `OEMCP=949 -> euc-kr`, 글자 정상.
- 테스트 CE8 추가.
