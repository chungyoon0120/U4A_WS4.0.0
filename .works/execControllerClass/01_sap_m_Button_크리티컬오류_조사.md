# WS30 「컨트롤러(클래스 빌더)」 클릭 시 sap.m.Button 크리티컬 스크립트 오류 — 원인 조사

> 2026-09-17 · 장군님 요청: 「WS30 화면에서 컨트롤러 버튼 클릭하면 어떤 케이스에서 sap.m.Button 내용이 언급된 크리티컬 스크립트 오류 — 재현이 안 됨. 가능성 있는 소스 깊게 분석」
> 조사 때는 소스만 읽었다. **→ 2026-09-17 장군님 지시(「오류창도 만들어줘」·「콘솔에 찍히는 비밀번호는 당연히 가려라」)로 §1 의 1·2 를 고쳤다.** 테스트 = [00_현황판.md](00_현황판.md) CE1~CE4 · 앱 실행 없음.

---

## 1. 정해 주실 것

| 물음 | 제 생각 |
|---|---|
| ~~아래 §2 의 변환 안 된 UI5 오류 창을 HTML5 공통 확인창으로 바꿀까~~ **✅ 고침(2026-09-17)** | **바꾼다.** 원본과 같은 내용(제목 「VBS 실행 오류」 · 오류 원문 · 「아래의 점검사항을 확인하세요.」 · 「점검사항」 버튼 · 닫기 버튼)을 공통 `.u4a-dialog` 로 옮긴다. 로그(영어)·오류코드 같이 넣는다 |
| ~~§4-1 SAP 비밀번호가 콘솔(=로그 파일)에 찍힌다 — 원본도 같다. 뺄까~~ **✅ 고침(2026-09-17) — 찍는 사본의 10번째 값만 `******`** | **뺀다(비밀번호 자리만 가림).** 로그 규칙(비밀번호 금지) 위반이고, 포장본은 콘솔이 로그 파일로 간다 |
| §4-2 오류 출력이 여러 조각으로 오면 창·SAP GUI 실행이 여러 번 될 수 있다 — 원본도 같다 | 이번엔 **보고만** — 실제로 여러 번 오는지 **미확인** |

---

## 2. 원인 (소스 근거)

### 2-1. 불리는 순서

| # | 자리 | 하는 일 |
|---|---|---|
| 1 | `www/ws30/ws10_20/js/usp/ws_html5_usp.js:583` `_uspControllerClass` | 「컨트롤러(클래스 빌더)」 버튼 → `oAPP.common.execControllerClass(null, null, null, oAppInfo)` |
| 2 | `www/ws30/ws10_20/js/ws_common.js:2816` `execControllerClass` | 대기 일러스트 창 열기 → 서버 `chk_mlogin_of_gui` 호출 → 성공 시 `fnSapGuiMultiLoginCheckThen` |
| 3 | `www/ws30/ws10_20/js/ws_fn_04.js:68` `fnSapGuiMultiLoginCheckThen` | **1차 VBS**(`newSESSTION.vbs`, 이미 열린 SAP GUI 세션에 붙기) 를 `cscript.exe` 로 실행 (138줄) |
| 4 | 같은 파일 145~161줄 — 1차 VBS 가 **stderr 로 뭔가 쓰면** | 마지막 `:` 뒤에 `\|` 가 **없으면** → **2차 VBS**(`sapgui_ws.vbs`, SAP Logon 띄워 새로 로그인) 실행 (202줄) |
| 5 | 같은 파일 208~236줄 — 2차 VBS 가 **stderr 로 뭔가 쓰면(어떤 내용이든)** | `_openControllerErrorDialog(oPARAM)` 호출 |
| 6 | 같은 파일 **394~485줄** `_openControllerErrorDialog` | **`new sap.m.Dialog({ buttons: [ new sap.m.Button({...}) ...` — UI5 코드 그대로(변환 안 됨)** |

### 2-2. 왜 「sap.m.Button」 이라고 나오나

- HTML5 메인 창에는 UI5 가 없다. 대신 `www/ws30/ws10_20/js/ws_html5_shell.js:45~107` 이 **안전 스텁 `window.sap`** 을 만든다. 스텁의 `sap.m` 에는 `MessageToast`·`MessageBox`·몇몇 enum 만 있고 **`Dialog`·`Button` 은 없다.**
- `new sap.m.Dialog({ buttons: [new sap.m.Button({...})] })` 를 JavaScript 는 이렇게 처리한다: ① `sap.m.Dialog` 값을 읽는다(→ `undefined`, 아직 안 터짐) ② **인자(객체)를 먼저 만든다** → 그 안의 `new sap.m.Button(...)` 에서 `sap.m.Button` 이 `undefined` → **`TypeError: sap.m.Button is not a constructor`** 로 터진다. `sap.m.Dialog` 보다 **Button 이 먼저 터진다** — 장군님이 보신 문구와 맞다.
- 이 코드는 **VBS 가 만든 자식 프로세스의 stderr 콜백 안**에서 돈다 → 잡는 `try` 가 없어 전역 오류로 올라가 크리티컬 오류 창이 뜬다.

### 2-3. 원본과 비교

- `U4A_WS3.0.0/www/ws30/ws10_20/js/ws_fn_04.js` 60~250줄과 현행 60~250줄은 **한 글자도 다르지 않다**(diff 0). 오류 창 함수도 원본 395줄에 같은 UI5 코드로 있다.
- 원본은 UI5 가 살아 있어 **「VBS 실행 오류」 창이 정상으로 뜬다.** 현행은 UI5 를 걷어냈는데 이 함수만 **변환에서 빠졌다.** → 원본이면 오류 창, 현행이면 크리티컬 오류.

---

## 3. 왜 가끔만 나고 다시 하면 안 나나

**2차 VBS(`sapgui_ws.vbs`)가 실패할 때만** 이 길을 탄다. 평소(이미 SAP GUI 세션이 열려 있음)에는 1차 VBS 가 성공해서 여기까지 안 온다.

2차 VBS 가 stderr 를 쓰는 경우 (`%APPDATA%\com.u4a_ws3.app\ext_api\vbs\sapgui_ws.vbs` 읽음 — **WS4.0 개발 실행이 이 사본을 쓰는지는 미확인**):

| 경우 | VBS 자리 | 문구 |
|---|---|---|
| 새로 로그인 실패 | 537·559줄 | `E02` Login failed!! |
| 로그인 뒤에도 세션을 못 찾음 | 550줄 | `E03` Login session not found. |
| 그 밖의 반환값 | 564줄 | `E99` An unknown error has occurred. |
| 허용 세션 수 초과 | 572줄 | `E01` The maximum number of sessions has been reached. |
| VBScript 실행 중 오류(예: SAP GUI 객체를 아직 못 얻음) | — | cscript 가 쓰는 런타임 오류 문장 |

**시간에 따라 갈리는 자리가 있다** — 2차 VBS 는 SAP Logon 을 띄운 뒤 창 활성화를 **150ms × 최대 100번(약 15초)** 만 기다리고 로그인·세션 연결로 넘어간다(515~522줄). SAP Logon 이 늦게 뜨면 세션 연결이 실패해 `E03`/`E02` 로 떨어질 수 있다.
그리고 **첫 시도에서 SAP GUI 가 결국 떠 버리면, 다시 누를 때는 1차 VBS 가 기존 세션에 붙어 성공**한다 → 두 번째엔 재현이 안 된다. 장군님 증상과 맞는 흐름이다(**앱으로 확인은 안 함**).

재현해 볼 수 있는 조건(추정 — **미확인**):
- SAP GUI(SAP Logon)를 완전히 끈 상태에서 버튼을 누르고, SAP Logon 이 늦게 뜨거나 로그인이 실패하는 경우
- 해당 사용자 세션이 이미 최대 개수만큼 열려 있는 경우

---

## 4. 같이 찾은 것 (보고만 — 원본도 같음)

### 4-1. SAP 비밀번호가 콘솔에 찍힌다
- `ws_fn_04.js:163~200` — 2차 VBS 인자 배열 `aParam` 에 `oUserInfo.PW`(173줄)가 들어 있고, 그 배열을 통째로 `console.log("PARAM: " + JSON.stringify(aParam))`(197·200줄).
- 포장본은 렌더러 콘솔이 로그 파일로 들어간다(오늘 WS3 로그 `U4A_WS_2026_9_17.log` 에 렌더러 `[info]` 줄이 찍힌 것으로 확인).
- 원본 173·200줄도 같다.

### 4-2. stderr 가 여러 조각으로 오면
- `vbs.stderr.on("data", ...)` 는 출력이 나뉘면 **여러 번** 불린다. 1차 쪽이면 2차 VBS 가 여러 번 실행되고, 2차 쪽이면 오류 창이 여러 번 열릴 수 있다. 실제로 나뉘어 오는지 **미확인**.

---

## 5. 로그로 확인 못 한 이유

- 장군님 PC 의 로그 폴더 `%APPDATA%\com.u4a_ws3.app\logs` 는 **WS3 포장본(3.6.4)** 로그다. 9/16·9/17 로그에 `sap.m.Button` 문구 **0건**.
- WS4.0 개발 실행은 로그 파일을 남기지 않아 **이번 발생 시점의 흔적이 없다.** 그래서 위 결론은 **소스 근거**이고, 장군님이 보신 오류가 이 자리에서 났다는 **실측 증거는 없다.**
- 이 버튼 흐름에서 `sap.m.Button` 을 만드는 코드는 §2 의 한 곳뿐이다(`ws_fn_04.js` 전체 검색 — 나머지 `sap.` 은 주석).
