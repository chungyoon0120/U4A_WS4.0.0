# 프론트 응답 대응 조사 — 순서표 만들기 (면밀 재조사)

- 날짜 **2026-10-13** · 세션 `4f71feab` · type `investigate`
- 장군님 지시: 「1번 해」(순서표 작성) → **「다시 면밀히 조사해」**
- 산출물 = `.works/서버호출경로조사/07_프론트_응답대응_조사_순서표.md`
- **조사는 아직 시작하지 않았다. 코드는 한 글자도 안 고쳤다.** 정할 것 = `.docs/TODO.md` 46~49번

## 무엇을 만들었나

프론트에서 **서버 응답을 받아 쓰는 자리 148곳**을 전수로 뽑고 5군으로 나눴다.
조사 단위를 **「서버 경로」가 아니라 「응답을 받아 쓰는 자리」**로 바꾼 것이 핵심이다
(공통 함수로 한 겹 감싼 것이 있어, 서버를 부르는 줄은 1곳인데 응답을 받는 자리는 12곳인 경우가 있다).

| 군 | 뜻 | 서비스 | 자리 |
|---|---|---:|---:|
| 1군 | 콜백을 읽어 **응답 내용 사용 확인** | 29 | 77 |
| 2군 | 콜백에선 안 쓴다 — **읽어야 확정**(후보만 있음) | 32 | 59 |
| 3군 | 결과 코드만 본다 | 4 | 8 |
| 4군 | 응답을 안 쓴다 | 3 | 4 |
| — | **부르는 자리가 없다** | 2 | 0 |

## 처음에 틀렸던 것 — 원인 10가지를 찾아 고쳤다

**판정이 여러 번 흔들렸다.** 추측으로 고치다 더 나빠진 적도 있다(한 번은 X 가 55 → 111 로 늘었다).
한 자리를 끝까지 추적해 원인을 찾은 뒤에야 잡혔다.

| # | 원인 | 증상 | 고친 방법 |
|---|---|---|---|
| 1 | **콜백 본문이 창(80줄)보다 길면 성공 콜백을 아예 못 잘랐다** | 앱 데이터 읽기 등이 「응답 안 씀」. **가장 큰 원인** | 괄호가 닫힐 때까지 창을 넓힌다(최대 2000줄) + 끝까지 못 간 마지막 인자도 살린다 |
| 2 | **보조 판정 정규식에 backspace 글자가 박혀 있었다** | 보조 판정이 **한 번도 안 돌았다**. heredoc 으로 고치다 `\b` 가 진짜 backspace 로 들어갔다 | 그 글자 제거 후 정규식 재작성 |
| 3 | **주석에 적힌 함수 꼴을 실제 호출로 읽었다** | 공통 파일 주석의 `sendAjax(...)` 설명을 호출로 잡아 엉뚱한 인자를 읽었다 | 줄 끝 `//` · `/* */` 를 떼고 본다 |
| 4 | **자료 인자를 콜백으로 잘못 잡았다** | `oFormData`·`true`·`is_tab` 을 콜백으로 봤다 | 함수식 먼저, 없을 때만 이름 인자. 자료로 보이는 이름은 건너뛴다 |
| 5 | **같은 파일에 같은 이름 콜백이 여럿**(`lf_success`) | 엉뚱한 콜백을 읽었다 | 호출 자리를 품은 함수 본문 안에서만 찾고, 선언이 호출 뒤에 올 수도 있어 거리로 고른다 |
| 6 | **공통 함수로 한 겹 감싼 것** | 자리를 1곳으로 봤다 | 감싼 함수로 판정해 **그것을 부르는 자리들**을 실제 자리로 올린다 |
| 7 | **응답을 통째로 다른 함수에 넘긴다** | 「안 씀」으로 나왔다 | 넘기는 함수까지 따라가 판정 |
| 8 | **콜백을 `.bind(…)` 로 넘긴다** | 못 읽었다 | 기계로는 아직 못 읽는다 → **직접 읽어 확정** |
| 9 | **Worker 를 거친다** (`dummycall`) | 못 읽었다 | **직접 읽어 확정** |
| 10 | **중간 파일에 한글을 넣으면 깨진다** | 표가 엉망이 됐다 | 중간 파일엔 영문 토막만(`NOARG`·`UNUSED`·`NOCB`·`SCOPE`·`FWD`) |

## 직접 읽어 확정한 자리

| 자리 | 확정 내용 |
|---|---|
| `fnServerSession.js:16` (`dummycall`) | 경로만 Worker 에 넘기고 응답은 Worker 가 받아 돌려준다 → 조사 대상에 **Worker 파일 + 그 handler** 를 넣어야 한다 |
| `resources/index.js:1624` (`init_prc` 전역 감싼 함수) | 그 전역 함수를 부르는 자리가 **0건** = 죽은 길 |
| `usp/ws_html5_usp.js:2729` · `usp/ws_usp.js:4760` | 콜백을 `.bind(…)` 로 넘긴다 |
| `ws_html5_ws20_data.js:188` (`getAppData`) | `param.APPDATA.T_0014` 로 tree 를 만든다 |
| `ws_html5_shell.js:904` (`init_prc`) | 앱 정보 전체를 꺼내 WS20 진입 |
| `fnAppCopyPopupOpen.js:487` (`init_prc`) | 응답을 통째로 넘기고 그 함수는 존재 여부만 본다 → 3군 |
| `Popups/ui5CssPopup_v2/main/views/control.js:183·244·280` | 경로를 변수에 담아 다른 파일에서 쓴다 |

## 버린 방법 · 남은 한계

| 무엇 | 왜 |
|---|---|
| 「등급을 기계로 확정한다」 | 포기했다가 다시 했다. 원인을 추적하지 않고 정규식만 고치다 **더 나빠졌다**. 한 자리를 끝까지 추적한 뒤에야 잡혔다 |
| 2군의 「쓰는 칸」 | **확정이 아니라 후보**다. 그 함수 안에서 응답 칸으로 보이는 이름을 모은 것 — 응답이 아닌 다른 객체 칸일 수 있다 |
| 실패 콜백 넘겼나 | `sendAjax` 를 직접 부르는 자리만 셀 수 있다. 감싼 함수를 거치는 자리는 **미판별** |
| `.bind(…)` 로 넘긴 콜백 | 기계로 못 읽는다. 2자리는 직접 확인했지만 **다른 자리에 또 있을 수 있다** |

## 숫자 기준도 바로잡았다

64 = 서버 경로(첫 토막) / 69 = 서비스 종류(WebDynpro 하나가 아래 6가지로 갈라짐) / **148 = 조사 단위**.
그리고 **02번 문서의 절 소계 합이 70으로 적혀 있는데 69가 맞다**(대소문자 두 모양이 두 번 세어졌다) — 그 문서도 고쳐야 한다.

## 되풀이하지 말 것

- **판정이 흔들리면 정규식을 고치지 말고, 한 자리를 끝까지 추적해 원인을 찾는다.** 이번에 그걸 안 해서 네 번 헛손질했다
- **heredoc 으로 코드를 패치하지 않는다** — `\b` 가 backspace 로 박혀 판정이 한 번도 안 돌았다. 줄 번호 기준 패치 파일을 따로 만든다
- **중간 파일에 한글을 쓰지 않는다** — Windows 기본 글자표로 적혀 깨진다

---

## 이어서 (2026-10-13 11:20) — 문서 9개를 1개로 합침

- **왜**: 장군님 지시 「문서가 여러군데로 산재되어 있으면 이쪽 저쪽 보면서 하기에 정신이 없다」.
- **어떻게**: `.works/서버호출경로조사/00_현황판.md` 하나에 **경로 대장 69개(판정 칸) + 경로별 프론트 자리
  145곳 + 깨진 것 + 끝난 경로 근거 요약** 을 모았다. 01·02·04·07·08 은 내용을 합친 뒤 지웠고,
  init_prc 긴 근거 3개(03·05·06)는 `2026-10-13_112000_…init-prc-backend-full-evidence…md` 로 옮겼다.
- **되돌린 판정**: `unlock_app` 의 「Lock 해제 실패 시 화면이 안 넘어간다」를 결함이라고 보고했으나 **철회**.
  장군님 지적대로 **일부러 멈추는 것**이다 — 멈추기 직전 처리중 표시·이동 잠금을 풀고, 오류창 확인은
  `fnCriticalError` → `fn_logoff_success` = logoff 로 간다(`ws_common.js:4148`). 내가 그 확인 처리기를
  안 읽고 판정했다. 지금 **깨진 것 0건.**
- **아직 못 한 것**: 남은 경로 66개. 다음 = `getBindAttrData`(서버 소스 읽기 = SAP 접속 UHA 승인 필요).

---

## 1차 전수 조사 (2026-10-13 오후) — 서버부터 읽고 프론트와 대조

장군님 지시: *"서버 로직부터 파악하고 그거에 맞게 프론트 대응에 문제 없는지를 전체 경로 기준으로 전수 검사"*.

### 서버 쪽 (SAP UHA 에서 받아 로컬에 캐시)
- 받은 것: `/U4A/WS_ROOT` + `/U4A/WS000001`~`WS000012` + 참조되는 `P_0010`·`P_0020`·`P_CMM_SRTNS`·
  `P_CTRL_PROXY`·`SP200002`·`SP300003`·`SRS000001` + 핸들러 class `/U4A/CL_HTTP_SERVER_WBC`.
- 검증: `FORM INIT_PRC`=245 · `UNLOCK_APP`=10385 · `F4SERVERDATA`=3895 — 앞서 쓴 줄번호와 일치.
- `WS_ROOT` 은 **넘겨주기만** 한다. FORM 이름 = 서비스 이름 → **73개** 전부 짝을 잡았다.
- **핸들러(공통)**: 경로 첫 토막을 `L_ROUTNM(30)` 에 담아 `PERFORM (L_ROUTNM) IN PROGRAM /U4A/WS_ROOT`.
  실패하면 인자 2개로 재시도, 그래도 실패하면 `{"RETCD":"W","RTMSG":<298>}` + 헤더 `u4a_status: UA0001`.
  → 프론트 공통 호출 함수가 그 헤더를 보고 가로채고 **성공 콜백을 안 부른다**(`ws_common.js:4767~4799`).

### 틀렸다가 고친 것 (기록)
1. `PERFORM … IN PROGRAM` 이 **다음 줄**에 오는 경우를 한 줄 정규식으로 놓쳤다 → 문장 단위 파싱으로 고쳤다.
   (이 때문에 처음엔 「하위 FORM 을 못 찾음」이 23건 나왔다 → 고친 뒤 0건.)
2. 「서버가 오류 모양을 주나」를 **오류 macro 이름**으로만 찾아 0건이 나왔다. 대부분 macro 없이
   `RTCOD = 'E'` 를 직접 넣는다 → 코드 칸 대입·`MESSAGE … INTO` 까지 보게 고쳤다.
3. ADT 출력을 `Out-File` 로 받으면 **빈 줄이 한 줄씩 끼어든다**(이중 개행) → 홀수 줄만 남기고 앵커로 검증.

### 1차 결과 — 2차로 볼 자리 40곳 (판정 아님, 의심 자리)
- ㄱ 28곳: 서버가 오류 모양을 주는데 프론트 콜백이 **그 코드를 안 보고** 값을 읽는다.
- ㄴ 8곳: `test_lee`·`ttt`(시험용, FORM 없음) + `u4a_cvt_wdr/*` 6개(플러그인 `YYU4A_CVT_WDR`, UHA 에는 있음).
- ㄷ 6곳: `logoff`·`external_open` — 서버가 **응답 본문을 안 쓴다**(쿠키 삭제 / redirect).

### 덧붙여 눈에 띈 것 (보고만)
- `/U4A/WS_ROOT:703` — `PERFORM ('DEV_BROWSER_AGENT') IN PROGRAM ('/U4A/WS0000012')`. 프로그램 이름에
  **0 이 하나 많다**(`WS0000012`, 실제는 `WS000012`). `IF FOUND` 라 터지지는 않고 **조용히 아무 일도 안 한다.**
  프론트에서 부르는 자리는 없다.
- `ws000002` `FORM CONTROL_CLASS` (3155~3159) — **본문이 비어 있다.** 프론트에서 부르는 자리는 없다.
- `EXTERNAL_OPEN` 의 whitelist 점검이 `WHITELIST = LV_URL` (자기 자신)이라 **항상 통과**한다.

### 아직 안 한 것
ㄱ·ㄴ·ㄷ 40곳 하나씩 소스 읽어 판정. 첫 번째 = `f4serverdata`(6자리).

---

## 전수 조사 끝 (2026-10-13 오후) — 깨진 자리 0건

### 한 일
- 서버: `/U4A/WS_ROOT` 의 FORM 73개 = 서비스 73개. 하위 FORM 까지 따라가 응답·오류 모양을 전부 뽑았다.
- 프론트: 받는 자리 147곳. 공통 함수로 감싼 것은 부르는 쪽까지 올라가 실제 받는 자리로 셌다.
- 자리마다 ① 오류 코드를 보나 ② 없는 칸을 쓰나 ③ 배열 색인에 가드가 있나 를 봤다.

### 판정의 뿌리 (이게 핵심)
1. 서비스를 못 찾거나 서버가 터지면 핸들러가 공통으로 `{"RETCD":"W"}` + `u4a_status` 헤더 →
   `sendAjax` 가 가로채고 **성공 콜백을 안 부른다**(`ws_common.js:4767~4799`).
2. 응답 본문이 비면 `sendAjax` 가 `{}` 로 바꾼다(`ws_common.js:4816~4818`) → 칸 읽기는 안 터진다.
→ 그래서 **실제로 터지는 모양 = 응답을 배열로 색인·순회하는 자리**뿐. 147곳 중 4곳이었고
  넷 다 서버가 그 배열을 반드시 채우는 것을 서버 소스로 확인 → **깨진 자리 0건.**

### 눈으로 읽어 판정한 서비스 (20개)
init_prc · unlock_app · f4serverdata · chk_customer_license · chk_u4a_authority · chk_mlogin_of_gui ·
chk_ws_syntx · getappdata · usp_page_del · usp_save_active_appdata · usp_get_file_data ·
getdatasetsearchlist · getmimeobj · compare_app_ctrl_abap · u4a_app_doc · ws_support_patch ·
u4a_cvt_wdr/getwebdyncompdata · /getconvlogheader · /getconvlogdetail · getbindattrdata

### 보고만 (7건) — 현황판 표에 있다
서버 쪽 4건(프로그램 이름 오타 · 빈 FORM · whitelist 자기비교 · 하위 F4 HELP 없을 때 빈 응답) ·
프론트 3건(`debugger` 잔재 · 주소줄에 아이디·비밀번호 · 죽은 코드 1곳). 5·6번은 **원본에도 있다.**

### 중간에 틀렸다가 고친 것
- 「오류 코드를 안 보면 결함」이라는 기준으로 28자리를 의심했는데, 위 1·2번 공통 받침을 확인하고
  기준을 「배열 색인에 가드가 있나」로 바꿨다. 28자리 중 실제 위험은 0이었다.
- `\b` 를 heredoc 으로 쓰면 backspace 문자(0x08)가 되어 정규식이 조용히 죽는다 — **두 번째** 당했다.
  앞으로 정규식 패치는 heredoc 금지, Write 로 파일을 만들어 적용한다.

### 조사 범위 밖 (안 했다)
처리중 표시(busy)를 모든 끝에서 푸는지 **전수 감사**는 넣지 않았다 → TODO 10번의 일.

---

## 추가 (2026-10-13) — 「적절성」 기준 48경로 95자리 재판정

### 왜 또 했나
장군님 질문: 「백앤드 응답 데이터 기반으로 프론트에서 적절하게 다 대응하고 있다는 말이야?」
앞 조사의 판정은 **「터지지 않는다 + 오류를 오류로 받는다」**까지였다. 68경로 중 48경로는
줄 단위로 읽지 않고 **서버가 오류에 채우는 JSON field 이름 = 프론트가 읽는 field 이름** 이 같은지로
판정했다. 「적절한가」는 그보다 센 기준이고 전수로 보지 않았다 → 지시로 재판정.

### 기준 (먼저 못 박았다)
① 오류 갈래가 있나 ② 오류면 멈추나(return/throw/else) ③ 사람에게 알리나 ④ busy 를 푸나 ⑤ 원본과 같나.

### 방법
- `rejudge.py`(1판) → **잘못됨**. v8.tsv 의 줄 번호는 「경로 글자가 있는 줄」이라, 거기서 바로 뒤를 보면
  FormData 만드는 코드 안의 다른 `function` 을 콜백으로 잘못 잡는다(`save_active_appdata` 에서 드러났다 —
  실제 콜백은 74줄 뒤 `sendAjax` 에 있었다).
- `rejudge2.py`(2판) — 경로 줄 뒤에서 **실제 호출 문장**(`sendAjax`/`xhr.send`/`$.ajax`)을 먼저 찾고,
  그 호출의 성공 콜백을 괄호·중괄호 짝으로 잘라낸다. 이름만 적힌 콜백은 그 함수 본문을 찾아간다.
  95자리 중 51자리만 자동 판정 성공 → **78자리는 눈으로 읽었다**(`read78.txt` 3800줄).

### 결과
**변환 때문에 생긴 부적절 = 0건.** 걸린 것은 전부 원본 동일이거나 죽은 코드다.

원본 동일 5건: `uiWhereUseList`(오류 띄우고 빈 목록 바인딩) · `getOTRTextsAlias` 2자리(경고 뒤 `T_OTR` 를
`undefined` 로 덮어씀) · `design/js/main.js` `getLibData`(`ERROR="X"` 면 잠금이 안 풀림) ·
`moduleAppF4Popup.js` `getappsearch`(빈 목록 + 안내 없음) · `getP13nPreviewHTML` 2자리(화면 응답인데 실패 감시 없음).

죽은 코드 5건: `js/fnMimePopupOpen.js`(참조 0 — 지금은 `Popups/mimeRepository/mime.js`) ·
`js/ws_main copy.js`(참조 0) · `Popups/releaseNotePopup/js/main.js`·`main_latest.js`(지금 열리는 건
`Popups/relese_notes` — **앞서 보고한 `debugger` 3곳이 이 죽은 파일에 있었다**) ·
`ws_fn_01.js` `_testServerCall`(버튼 배선이 주석) · `ws_fn_test.js` `fnTest94`(잘못된 Url 호출 테스트 전용).

### 내가 틀렸던 것 (정정)
1. **「`sendAjax` 7번째 인자(실패 콜백)를 안 넘기면 busy 가 안 풀린다」 → 반만 맞다.**
   공통 `_onError`(`ws_common.js` 4911~5022)가 통신 오류 메시지(391+304) + `parent.setBusy('')` +
   전체 창 닫고 logoff 까지 한다. **메인 창은 풀린다.** 별창은 자기 busy 라 여전히 자기 실패 콜백이 필요하다.
   → 이 때문에 `js/usp/ws_usp.js:4787`·`ws_html5_usp.js:2739`(7번째 인자 없음)을 결함으로 적으려다 멈췄다.
2. 「칸」이라는 말을 지어내 썼다 → `field`(JSON field)로 전부 고쳤다(문서 44곳).
3. 알림 수단 감지 regex 가 `_toast`·`fnShowFloatingFooterMsg`·`fnRenderServerError` 를 몰라
   「사람에게 안 알린다」 오탐이 13건 났다. 눈으로 읽어 전부 해소.

### 안 한 것
- busy 전수 감사는 여전히 TODO 10번. A3(디자인 영역 잠금 안 풀림)·B1(미리보기 실패 감시 없음)은
  **원본 동일**이라 이 조사에서는 보고만 하고 고치지 않았다 — 고치려면 장군님 지시가 필요하다.

### 판정 철회 — A1 `uiWhereUseList` (2026-10-13, 장군님 지적)
장군님: 「오류 메시지 처리 이후에 화면에 빈값을 보여주기 위함 아니야?」 → **맞다. 철회.**
그 창은 열릴 때 `oModel.setData({busy:true, busyButton:true})`(callUiWhereUsePopup.js:105~106)로 자기
처리중 표시를 켜고 닫기 버튼까지 묶는다(`busy:"{/busy}"` — 창 6~7 · 머리말 26 · 닫기 버튼 40행).
콜백의 `setData({T_DATA:…, busy:false, busyButton:false}, true)` 가 **그것을 푸는 유일한 자리**다.
오류 뒤 `return` 하면 창이 처리중인 채로 굳고 닫히지도 않는다. 목록 비우기는 「보여줄 것 없음」 상태 만들기.

**내가 왜 틀렸나**: 콜백만 읽고 **창을 만드는 6~106행(busy 를 무엇에 묶었고 언제 켰는지)을 안 읽었다.**
`always.md` 0-2 의 「다 봤다 기준」에 **「busy·lock 을 어디서 켜고 어디서 푸는지」** 를 넣지 않은 것이 원인.
같은 구조인 A4(`moduleAppF4Popup`)도 「멈추지 않는다」 지적을 뺐고, A2 는 경고(W) 설계라 「계속 진행」을
빼고 `T_OTR` 를 `undefined` 로 덮는 것만 남겼다. → 남은 지적 4건(A2·A3·A4·B1), 전부 원본 동일.

### A4 도 죽은 코드 — 장군님 지적 (2026-10-13)
장군님: 「A4는 호출처도 없다」 → **맞다.** `js/moduleAppF4Popup.js` 를 로드하는 것은
`Popups/ShortCutCreator/js/frame.js` 하나뿐이고, 그 frame.js 를 로드하는 `frame.html` 은 **여는 곳이 없다**.
앱이 여는 쇼컷 생성 창은 `index.html`(`ws30/resources/pathInfo.js:97` SHORTCUTPOP)이고 거기서는
`js/index.js` + `js/fnAppF4PopupOpen.js` 를 쓴다(그 두 파일의 `getappsearch` 처리는 오류 분기·안내·busy 해제 다 있다).

**내가 왜 틀렸나**: 「그 파일을 참조하는 파일이 있다」까지만 보고 **그 참조하는 파일 자체가 로드되는지**를
안 봤다. 파일 하나 위까지만 올라가고 **엔트리(html·pathInfo)까지 안 올라갔다.**
→ 이번에 A2·A3·B1 은 엔트리까지 올라가 **전부 실제 로드됨**을 확인했다
(A2 `uiDesignArea`·`callDesignContextMenu` = getScript 지연 로드 / A3 `design/js/main.js` = library-preload /
B1 `callP13nDesignDataPopup` = getScript, `fnP13nDesignPopupOpen` = loadJs).
→ 남은 지적 **3건(A2·A3·B1)**, 전부 원본 동일.

### A3 정정 — live 는 내 파일이었다 (2026-10-13, 장군님 지적)
장군님: 「다른곳에서 푸는지 확인해봐야 알지 않겠냐? 당연히??」 → 추적 결과:

- `design/js/main.js` 의 `getLibData` 는 **죽은 코드**. 그것을 부르는 `setUIAreaEditable`(main.js:744)이
  `js/ws_html5_ws20_data.js:431` 에서 **재정의**되고, 로드 순서가 `design/js/main.js`(library-preload 136) →
  `ws_html5_ws20_data.js`(179) 라 내 것이 이긴다. `design/js/main` 을 getScript/loadJs 로 **다시 불러 덮는 자리도 없다**.
  (`designAreaLockUnlock` 도 `ws_html5_ws20_prev.js:763` 에서 재정의.)
- live 는 **내 파일** `js/ws_html5_ws20_attr.js:2286` 의 `_ws20GetLibData`. 거기서도 `ERROR="X"` 면
  메시지 281 을 띄우고 `return` → `fnDone` 이 안 불려 `fnLoadWs20TreeData` 가 안 돈다.
  busy 를 켠 자리는 `ws_fn_02.js:996`(`fnSetBusyLock("X")`, 「성공 시 setUIAreaEditable→fnLoadWs20TreeData 가
  busy 를 관리/해제」 주석 그대로) → **그 경로가 안 돌면 처리중 표시가 안 풀린다.**
- 원본도 같다: `fnSetAppChangeMode` 가 `sap.ui.getCore().lock()` 으로 잠그고, LIB 실패 경로에 unlock 이 없다.
  → **증상까지 원본 동일.** 그래서 「변환 탓 0건」은 유지.
- B1 도 같이 구분: live 는 내 파일 `fnP13nDesignPopupOpen.js:564`. UI5판 `callP13nDesignDataPopup.js:1041` 은
  같은 모양이나 HTML5 에서 그 경로가 도는지 **확인 안 했다**(M11 은 내 파일로 덮지만 1645행은 다른 메뉴 경로).

**내가 왜 틀렸나(3번째)**: 「다른 곳이 푸는지 확인 안 했다」를 **결과로 남기고 넘어갔다.**
확인할 수 있는 것은 확인해야 한다 — 추적하니 파일 자체가 죽은 코드였다.
`always.md` 0-2 의 「다 봤다 기준」에 **「그 함수가 재정의되는지 · 로드 순서」** 를 넣지 않은 것이 원인.

### 미확인 1건 해소 — UI5 디자인 영역 파일이 로드되지 않는다 (2026-10-13)
장군님 지적(「완벽히 안끝났잖아」) → 묻지 말고 확인했다.

- `design/js/main.js` 의 `oAPP.fn.main()`(미리보기 메인)이 **안 불린다**: 그것을 부르는
  `oAPP.fn.fnMoveToWs20`(ws_fn_02.js:660)이 `js/ws_html5_ws20.js:1592` 에서 재정의되고,
  내 것은 셸만 그린 뒤 `setUIAreaEditable` 로 간다(main() 호출 없음 — 그 파일 151행 주석과 일치).
- 그래서 `main()` 안의 `getScript("design/js/uiDesignArea")` · `uiAttributeArea` 가 안 돈다
  → **그 두 파일은 로드되지 않는다.** 결과: `uiDesignArea.js:6446`(getOTRTextsAlias) ·
  `uiAttributeArea.js:1093·1317`(getServerEventList) 자리는 **죽은 코드**.
  live 인 디자인 파일은 `callDesignContextMenu.js` · `uiPreviewArea.js`(둘 다 `ws_html5_ws20_prev.js` 가 요청).
- B1 의 UI5판 `callP13nDesignDataPopup.js:1041`: 요청 자리가 `callDesignContextMenu.js:1650`(내 파일이
  그 함수 자체를 `fnP13nDesignPopupOpen.js:1566` 에서 덮고, M11 메뉴는 **내 파일을 먼저 loadJs 한 뒤** 부른다)과
  `uiDesignArea.js:794`(죽은 파일) 뿐 → **실질적으로 안 돈다.** 내 파일 로드 실패 시에만 UI5판이 도는데
  그 경우는 오류 기록 + 단축키 잠금 해제 + busy 해제로 처리된다(callDesignContextMenu.js:226~238).

→ **미확인 0건.** 남은 지적 3건(A2 1자리 · A3 · B1) 전부 원본 동일, 전부 live 확인.

### 1번(getOTRTextsAlias) 영향 상향 — 「값이 지워진다」가 아니라 「터진다」 (2026-10-13)
장군님 질문(「1번 항목 설명해줘」)에 답하려고 `T_OTR` 의 **쓰는 쪽**을 처음 읽었다. 결과:

- 오류 응답에는 `T_OTR` 이 없다 → `oAPP.DATA.APPDATA.T_OTR = oRet.T_OTR` 로 **`undefined` 가 들어간다.**
- 그 값을 쓰는 `design/js/uiPreviewArea.js:1208` 은 `oAPP.DATA.APPDATA.T_OTR.length === 0` 을 **가드 없이** 읽는다
  → `undefined.length` **TypeError**. 호출자는 미리보기 iframe(`design/preview/index.js:3508 · 5366`)이고
  `uiPreviewArea.js` 는 live(`ws_html5_ws20_prev.js` 가 getScript).
- **원본도 같다**(`U4A_WS3.0.0 .../uiPreviewArea.js:1206` 가드 없음) → 「변환 탓 0건」은 유지.
- 내 파일 `ws_html5_ws20_dnd.js:1105` 는 `typeof` 가드로 덮지 않으므로 그 경로에선 안 터진다.

**내가 왜 틀렸나(4번째)**: 조사 기준을 **「콜백 안에서 터지나」로만** 잡았다. 응답 값이 **전역 저장소에 들어간 뒤
다른 함수가 가드 없이 쓰는 경우**를 기준에 넣지 않았다. 「다 봤다 기준」에 **「그 응답 값을 나중에 쓰는 곳」** 을
추가해야 한다. 그래서 문서의 결론 문구도 「받는 자리에서 깨지는 곳 0건」으로 범위를 명시해 고쳤다.

### 1번 영향 재정정(5번째) — 서버가 오류에도 `"T_OTR":[]` 를 준다 (2026-10-13)
장군님이 「서버 디버깅으로 눈으로 보겠다, 순서 알려줘」 하셔서 **서버 FORM 을 끝까지 읽었다.**
`/U4A/WS000004` `GETOTRTEXTSALIAS`(2919~3053):
- 오류 경로 2개(2949 ALIAS 미입력 · 3016 SOTR 조회 0건) **둘 다** `{"RETCD":"E","RTMSG":"…","T_OTR":[]}` 로
  **빈 배열을 같이 준다** → 프론트가 덮어도 `[]` 이고 `uiPreviewArea.js:1208` 의 `[].length === 0` 은 안전.
  → **앞 턴에 쓴 「오류면 터진다」는 틀렸다. 철회.**
- 남는 경로는 **응답 본문이 비는 것** 하나뿐: 2995행 `CHECK LT_TEXT IS NOT INITIAL.` 탈락(ALIAS 가 JSON 으로
  안 풀릴 때) → `_RESPONSE_JSON` 을 안 부르고 FORM 종료 → 본문 없음 → 공통 함수가 `{}` 로 바꿈 →
  `oRet.T_OTR` 가 `undefined` → 덮임 → 그 뒤 미리보기에서 TypeError.
- **미확인 1건(새로 생김)**: 응답을 안 보냈을 때 HTTP status 가 200 인지. 200 이면 성공 콜백이 돌아 터지고,
  아니면 `ws_common.js:4743` 이 공통 실패 처리로 보낸다. **이건 실행해 봐야 안다** → 장군님 디버깅 시험 항목.

**내가 왜 틀렸나**: 응답 **모양을 서버 소스로 확인하지 않고** 「오류면 그 field 가 없겠지」로 단정했다.
앞서 같은 조사에서 「서버 모양을 먼저 보고 프론트를 본다」를 원칙으로 세웠는데, 이 건에서 그걸 건너뛰었다.
