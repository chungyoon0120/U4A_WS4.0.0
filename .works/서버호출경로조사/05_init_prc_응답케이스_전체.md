# `init_prc` — 백엔드가 프론트로 응답을 주는 **모든 케이스**

> 조사 시각 **2026-10-13** · 조회 시스템 = **UHA** (`https://uha.u4aide.com:10101`, client 800)
> ★ **줄번호 기준 = SAP 실제 소스 줄번호(빈 줄 포함).**
> 대상 = `/U4A/WS000001` `FORM INIT_PRC` (**245~525행**) 과 그 안에서 부르는 것 전부.
> **소스는 한 글자도 고치지 않았다.**

---

## 0. 한눈에 — 실제 응답 케이스 **5가지** (+ 죽은 분기 1 · 프레임워크 1)

`FORM INIT_PRC` 를 벗어나는 자리는 소스상 **딱 3곳**이다(`CHECK` 1 + `EXIT` 2) + 끝까지 간 1곳.
여기에 FORM 밖에서 나는 2가지(예외 · runtime dump)를 더해 **전부 6가지**다.

| # | 케이스 | 어디서 | HTTP | 본문 | 프론트가 어떻게 받나 |
|---|---|---|:---:|---|---|
| ~~R1~~ | `IO_SERVER` 가 안 묶임 | 273행 `CHECK IO_SERVER IS BOUND.` 실패 | — | — | ★ **도달 불가 = 죽은 분기** (1-0절) |
| **R2** | 세션 종료(`EXIT='X'`) 정상 | 341행 `EXIT.` | 200 | **아무것도 안 씀** | 빈 응답 → `{}` 로 바꿔 **성공 콜백** |
| **R3** | 앱이 없음(`MSGTY='N'`) | 364행 `SERIALIZE` → 371행 `_RESPONSE_JSON` → 373행 `EXIT.` | 200 | `GTY_APP_INFO` JSON (`MSGTY:"N"`) | 성공 콜백 → 「없는 앱」 메시지 |
| **R4** | 정상 조회 — 일반 앱 | 496행 `SERIALIZE(LS_APP_INFO)` → 512~523행 | 200 | `GTY_APP_INFO` JSON | 성공 콜백 → WS20 진입 |
| **R5** | 정상 조회 — **임시 버전 앱** | 488행 `SERIALIZE(LS_APP_INFO_VMS)` → 512~523행 | 200 | `GTY_APP_INFO` + **`S_APP_VMS`** JSON | 성공 콜백 → **Display 강제** |
| **R6** | 로직이 터짐(ABAP 예외) | FORM 밖(handler 의 `CATCH CX_ROOT`) | 200 | `{"RETCD":"W","RTMSG":"<메시지 298>"}` + header **`u4a_status: UA0001`** | **실패** 처리 → 오류창 |
| (R7) | 잡을 수 없는 runtime dump | ICF 프레임워크 | **500** | SAP 오류 페이지(HTML) + header `sap-err-id` | **실패** 처리 → 전체 로그오프 |

★ **R1·R2 는 본문이 아예 없다.** 그래도 프론트는 성공으로 본다 —
`www/ws30/ws10_20/js/ws_common.js:4815` 가 `oReturn === "" → JSON.stringify({})` 로 바꾼다.

---

## 1. 각 케이스 상세

### ~~R1~~ — `IO_SERVER` 가 안 묶임 (273행) → ★ **도달 불가 (죽은 분기)**

#### 1-0. 도달 불가 확정 (2026-10-13, 장군님 지적 → 소스로 확인)

| 확인한 것 | 결과 |
|---|---|
| `/U4A/WS000001` 의 `FORM INIT_PRC` 를 부르는 자리 | `/U4A/WS_ROOT` **323행 단 한 곳**. `/U4A/WS000001`~`/U4A/WS000012` 와 `/U4A/WS_ROOT` 전부 훑어 `PERFORM INIT_PRC` 는 **1건** |
| 그 한 곳이 넘기는 값 | `USING IO_SERVER` — `/U4A/WS_ROOT` 의 `FORM INIT_PRC`(320행) 가 handler 에서 받은 그 값 |
| handler 가 넘기는 값 | `PERFORM … USING SERVER ME` 의 `SERVER` = `IF_HTTP_EXTENSION~HANDLE_REQUEST` 의 importing 인자 → **ICF 프레임워크가 채워 준다** |

→ **`IO_SERVER` 가 안 묶인 채로 들어올 경로가 없다.** 이 분기는 **실행되지 않는다.**
→ 아래 내용은 「만약 탔다면」 기록으로만 남긴다. 테스트 대상도, 조치 대상도 아니다.

#### (참고) 만약 탔다면 어떻게 되나

```abap
273:  CHECK IO_SERVER IS BOUND.
```

- 실패하면 **그 줄에서 FORM 이 끝난다.** 응답 header·본문을 하나도 안 쓴다
- ICF 가 기본 `200 OK` + 빈 본문으로 내보낸다
- 프론트는 **성공**으로 받고 `{}` 를 콜백에 넘긴다

#### ★ 정정 (2026-10-13, 장군님 지적) — 프론트에 **체크 로직이 3겹** 있다

앞 판에 「아무 메시지 없이 그냥 진행」이라고 적었는데, **소스를 다시 보니 막는 자리가 있다.**
빈 값(`{}`)이 들어가도 **크래시 없이 빈 WS20 화면에서 멈춘다.**

| 겹 | 자리 | 하는 일 |
|---|---|---|
| 1 | `www/ws30/resources/index.js:478~482` | `setAppInfo` 가 **빈 객체면 그 자리에서 return** — 게다가 그 앞(470~472행)에서 기존 앱 정보를 **삭제**한다 → 이후 `getAppInfo()` 는 `undefined` |
| 2 | `www/ws30/ws10_20/js/ws_html5_ws20_data.js:174~176` | WS20 트리 로드가 `servNm`·`APPID` 없으면 **서버를 아예 안 부르고 return** + `console.warn` 남김. busy 를 켜기 **전**이라 busy 가 남지도 않는다 |
| 3 | `www/ws30/ws10_20/js/ws_html5_ws20_data.js:197~199` | 그래도 서버를 불렀는데 응답에 앱 구조가 없으면 **빈 트리 유지** + `console.warn` |

→ **장군님 말씀이 맞습니다.** 빈 값이 그대로 흘러 들어가 깨지는 구조가 아닙니다.

#### 그래도 남는 것 (소스 확인)

| 무엇 | 자리 |
|---|---|
| 화면은 **빈 WS20 으로 전환된다** — 전환을 막는 가드는 없고, 사용자에게 보이는 안내 메시지도 없다. 흔적은 `console.warn` 한 줄뿐 | `ws_html5_shell.js:980~999` (전환) · `ws_html5_ws20_data.js:175` (warn) |
| **최근 앱 목록에 빈 항목이 들어갈 수 있다** — `fnOnSaveAppSuggestion(oAppInfo.APPID)` 가 `undefined` 로 불리는데 그 함수에 `sAppID` 가 비었는지 보는 가드가 **없다** | 호출 `ws_html5_shell.js:992` · 함수 `ws_fn_02.js:316` |



### R2 — 세션 종료 (303~343행)

```abap
303:  IF LV_EXIT EQ 'X'.
305:    DELETE IO_HANDLE->AT_SESSIONS WHERE APP_SID = LV_APP_SID.
307:    IF IO_HANDLE->AT_SESSIONS[] IS INITIAL.
309:      CALL METHOD IO_SERVER->SET_SESSION_STATEFUL
             STATEFUL = CO_DISABLED  PATH = '/zu4a_wbc/u4a_ipcmain'
314:    ENDIF.
320:    CALL METHOD /U4A/CL_VMS_API=>COLLECT_UNVERSION_DATA
322:      EXPORTING IV_APPID = LV_APPID.           "★ IMPORTING 없음
327:    SELECT SINGLE TCLSID INTO @LV_CLSID
329:      FROM /U4A/T_AVM_H AS A WHERE TAPPID EQ @LV_APPID.
331:    IF SY-SUBRC EQ 0.
334:      CALL METHOD /U4A/CL_VMS_API=>_REMOVE_TEMP_VER_APP
336:        EXPORTING IV_APPID = LV_APPID  IV_CLSNAM = LV_CLSID.   "★ 결과 안 받음
339:    ENDIF.
341:    EXIT.
343:  ENDIF.
```

- **응답을 쓰는 줄이 하나도 없다** → 빈 본문

#### ★ 정정 (2026-10-13, 장군님 지적) — 여기는 **빈 본문이 설계대로**다

호출측 콜백이 **인자를 아예 받지 않는다.** 응답 내용을 쓰지 않고, 앱 정보를 제 손으로 다시 읽는다.

| 호출측 | 콜백 | 앱 정보를 어디서 읽나 |
|---|---|---|
| `ws_fn_02.js:540` (WS20 → WS10) | `function lf_success()` — **인자 없음** | `parent.getAppInfo()` 로 다시 읽음 (`:544`) |
| `js/usp/ws_html5_usp.js:384` (WS30 → WS10) | `async function lf_success()` — **인자 없음** | 모델 `/WS30/APP` 에서 다시 읽음 (`:394`) |

→ 빈 본문이어도 뒤 로직이 쓰는 값은 전부 프론트가 이미 들고 있는 것이다. **문제 없다.**

#### 그래도 남는 것

- **버전 수집·임시 앱 삭제가 실패했는지 프론트가 알 방법이 없다** — 응답 본문이 없는 것과 별개로,
  서버가 320행·334행에서 **결과를 받지 않고** 부른다. 실패가 어디에도 안 남는다
- 이 분기에서 서버가 하는 일: 세션 목록에서 제거 · stateful off ·
  버전 수집(최대 60초 대기 + DB 쓰기) · 임시 버전 앱이면 **앱 데이터 통째 삭제**
- 프론트 짝 = `www/ws30/ws10_20/js/ws_fn_02.js:882` (WS20 → WS10 나갈 때)

### R3 — 앱이 없음 (355~375행)

```abap
351:  PERFORM _GET_APP_INFO CHANGING LS_APP_INFO.
355:  IF LS_APP_INFO-MSGTY EQ 'N'.
364:    CALL METHOD /U4A/CL_JSON_HANDLE=>SERIALIZE
366:      EXPORTING DATA = LS_APP_INFO  RECEIVING R_JSON = LV_JSON.
371:    PERFORM _RESPONSE_JSON IN PROGRAM /U4A/WS000001 USING LV_JSON IO_SERVER.
373:    EXIT.
375:  ENDIF.
```

`MSGTY='N'` 은 `_GET_APP_INFO`(8655행) 가 넣는다 —
`/U4A/T0013` ⋈ `/U4A/T0010` 조회가 0건이면 `MSGTY='N'` + 메시지 007(`Application ID & does not exist.`).

보내는 모양 = `_RESPONSE_JSON` (9195~9224행):

| 줄 | 내용 |
|---|---|
| 9202~9203 | `Content-Type: application/json; charset=utf-8` |
| 9205~9206 | `cache-control: no-cache` |
| 9208~9209 | **`Access-Control-Allow-Origin: *`** |
| 9212~9213 | `SET_STATUS( CODE='200' REASON='OK' )` |
| 9218~9220 | `SET_CDATA( DATA = <JSON 문자열> )` |

### R4 / R5 — 정상 조회 (477~523행)

```abap
477:  SELECT SINGLE A~*
479:    INTO CORRESPONDING FIELDS OF @LS_APP_INFO_VMS-S_APP_VMS
481:    FROM /U4A/T_AVM_H AS A
482:    WHERE TAPPID EQ @LV_APPID.            "★ APPID 아니라 TAPPID
483:  IF SY-SUBRC EQ 0.
484:    MOVE-CORRESPONDING LS_APP_INFO TO LS_APP_INFO_VMS.
488:    SERIALIZE( DATA = LS_APP_INFO_VMS ) → LV_JSON     " R5
494:  ELSE.
496:    SERIALIZE( DATA = LS_APP_INFO )     → LV_JSON     " R4
502:  ENDIF.
512:  IO_SERVER->RESPONSE->SET_CONTENT_TYPE( CONTENT_TYPE = 'application/json' ).
513:  IO_SERVER->RESPONSE->SET_HEADER_FIELD( NAME = 'cache-control' VALUE = 'no-cache' ).
515:  CALL FUNCTION 'SCMS_STRING_TO_XSTRING' … → LV_CONTENT
521:  CALL METHOD IO_SERVER->RESPONSE->('SET_DATA') EXPORTING DATA = LV_CONTENT.
525: ENDFORM.
```

**R4 와 R5 의 차이는 데이터 모양 하나뿐**이다 — `S_APP_VMS` 가 붙는지.
붙는 조건은 **그 앱이 임시 버전 앱(`TAPPID`)일 때**. 프론트는 그게 있으면 Display 로 강제한다
(`www/ws30/ws10_20/js/ws_html5_shell.js:938`).

### R6 — 로직이 터짐 (FORM 밖)

`FORM INIT_PRC` 안에는 `TRY`·`CATCH` 가 **하나도 없다.** 그래서 안에서 잡을 수 있는 예외가 나면
그대로 바깥(handler)으로 올라가고, 거기 `CATCH CX_ROOT` 가 받아 아래를 보낸다:

| 무엇 | 값 |
|---|---|
| 응답 header | **`u4a_status: UA0001`** |
| 본문 | `{"RETCD":"W","RTMSG":"<메시지 298>"}` |
| 메시지 298 실제 문구 | `This server does not support this function - please contact the U4A team.` |

#### ★ 정정 (2026-10-13, 장군님 지적) — 프론트 공통 처리가 **끝까지 돈다**

앞 판에 R6 을 「남은 실제 문제」로 적었는데, **공통 통신 함수에 완결된 처리가 있다.** 소스로 확인:

| 순서 | 하는 일 | 자리 |
|---|---|---|
| 1 | 응답 header 를 보고 오류로 판정 | `www/ws30/ws10_20/js/ws_common.js:4767` |
| 2 | **busy 해제** (두 번 호출 — 일반 busy + 앱 생성용 busy) | `:4776`·`:4779` |
| 3 | 통신 실패 로그 남김 | `:4772` |
| 4 | 본문 `JSON.parse` → 실패하면 치명 오류창(메시지 192) | `:4783`·`:4793` |
| 5 | **오류창 띄움** — 서버가 준 결과코드·문구 그대로 | `:4798` → `ws_common.js:3131` → `resources/index.js:160` |

5번이 끝까지 도는 것도 확인했다:

| 걱정했던 것 | 실제 |
|---|---|
| 그 호출이 `sap` 전역을 그대로 넘긴다 → UI5 없는 화면에서 터지지 않나 | **안 터진다.** `ws_html5_shell.js:45`·`:82` 가 `window.sap` 안전 스텁을 만들어 둔다. 게다가 메시지 함수는 **첫 인자를 아예 무시**한다(`resources/index.js:188` 주석·`oUI5` 미사용 확인) |
| 결과코드 `W` 가 받아들여지나 | **받아들여진다.** 경고 아이콘이 배정돼 있다(`resources/index.js:241`) |
| 창 종류 `20` | 1버튼(OK) 모달 — 정상 분기 (`resources/index.js:300`) |

→ **장군님 말씀이 맞습니다. R6 은 공통 로직이 제대로 받아 처리합니다** (busy 해제 + 로그 + 오류창).

#### 그래도 남는 것 — **문구 하나**

보여 주는 문구가 「이 서버는 그 기능을 지원하지 않습니다 — U4A 팀에 문의」 다.
이 자리는 **「경로를 못 찾음」용 안내**인데, **init_prc 로직이 중간에 터진 경우에도 같은 문구가 뜬다.**
처리 자체는 정상이고, **안내 문구만 원인과 어긋난다.**
(그 FORM 안에 `TRY`·`CATCH` 가 0개라 예외가 그 공통 자리까지 올라간다 — 245~525행)

예외가 날 만한 자리(소스 확인):

| 자리 | 줄 | 왜 |
|---|---|---|
| `_RELEASE_APP_CTS` 의 `UPDATE` + `COMMIT WORK AND WAIT` | 13358행 | DB 오류 |
| `COLLECT_UNVERSION_DATA` 의 `EXPORT TO DATABASE` · `MODIFY` · `COMMIT WORK` | 275행(클래스) | DB 오류 |
| `__DEL_TEMP_APPDATA` 의 `DELETE` 다발 + `COMMIT WORK` | 2729행(클래스) | DB 오류 |
| `SCMS_STRING_TO_XSTRING` | 515행 | 변환 실패 |

### R7 — 잡을 수 없는 runtime dump

`CATCH CX_ROOT` 로도 못 잡는 것(예: 일부 DB 인터페이스 오류)은 ICF 가 **HTTP 500** + 자기 오류 페이지로 내보낸다.
프론트는 **status 가 200·201 이 아니면** 통신 오류 갈래로 간다 (`ws_common.js:4741`).
또 응답 header 에 `sap-err-id` 가 있으면 **같은 세션 창을 전부 닫고 Session Timeout 팝업**을 띄운다
(`ws_common.js:4750~4763`). `sap-err-id` 는 U4A 소스가 넣는 곳이 **없다**(읽은 클래스 4개 전부 검색, 0건)
→ SAP 프레임워크가 넣는 것으로 보이나 **미확인**.

---

## 2. 프론트가 응답을 가려내는 순서 (공통 통신 함수)

`www/ws30/ws10_20/js/ws_common.js` 의 성공 핸들러 — **위에서부터** 이 순서로 걸러낸다.

| 순서 | 조건 | 줄 | 하는 일 | 걸리는 케이스 |
|---:|---|---|---|---|
| 1 | status 가 200·201 이 아니면 | 4741 | 통신 오류 갈래 | **R7** |
| 2 | header `sap-err-id` 있으면 | 4750 | 같은 세션 창 전부 닫고 Session Timeout 팝업 | **R7** |
| 3 | header `u4a_status` 있으면 | 4767 | 본문을 parse 해 오류창(`RETCD`·`RTMSG`) | **R6** |
| 4 | `responseType === 'blob'` | 4801 | 파일 받기 성공 | (init_prc 해당 없음) |
| 5 | 본문이 `""` 이면 `{}` 로 바꿈 | 4815 | — | **R1 · R2** |
| 6 | `JSON.parse` 실패 | 4820 | 치명 오류창 + 창 닫기(메시지 192) | (R3~R5 에서 JSON 이 깨지면) |
| 7 | `RETCD === "Z"` | 4834 | 치명 오류 → 로그오프 | init_prc 는 `RETCD` 를 **안 채운다** → 안 걸림 |
| 8 | `TYPE === "E"` | 4853 | 로그인 만료 → 로그아웃 | init_prc 응답에 `TYPE` 칸이 **없다** → 안 걸림 |
| 9 | 그 밖 | — | 성공 콜백 호출 | **R1 · R2 · R3 · R4 · R5** |

★ 6번이 중요하다 — R3·R4·R5 의 JSON 에 날짜·시각 칸이 들어가는데,
그 칸에 따옴표가 붙는지 **아직 못 가렸다**(03번 문서 8-1절). 안 붙으면 여기서 터진다.

---

## 3. 케이스별 「프론트가 결국 무엇을 하나」

| 케이스 | 프론트 최종 동작 | 근거 |
|---|---|---|
| ~~R1~~ | **도달 불가 — 실행되지 않는다**(1-0절). (만약 탔다면 프론트 체크 3겹이 막아 빈 WS20 에서 멈춤) | `resources/index.js:478` · `ws_html5_ws20_data.js:174`·`:197` |
| R2 | 성공 콜백 → WS10 으로 화면 전환 | `ws_fn_02.js:882` 의 콜백 |
| R3 | 화면 아래에 메시지 007(`Application ID & does not exist.`) + 창 깜빡임 | `ws_html5_shell.js:910~918` |
| R4 | `setAppInfo` → WS20 진입. `ADMIN_APP='X'` + 본인이 ADMIN 아니면 Display 강제 | `ws_html5_shell.js:933` |
| R5 | **Display 강제**(`IS_EDIT` 를 프론트가 비운다) | `ws_html5_shell.js:938` |
| R6 | **busy 해제 + 로그 + 오류창**(서버가 준 결과코드·문구 그대로). 처리는 정상, **문구만** 「기능 미지원」으로 어긋남 | `ws_common.js:4767~4798` |
| R7 | 같은 세션 창 전부 닫고 Session Timeout 팝업 | `ws_common.js:4750~4763` |

`APPTY === "U"` 면 R4·R5 모두 WS20 대신 **WS30(USP) 화면**으로 간다 (`ws_html5_shell.js:942`).

---

## 4. ★ 눈에 띈 것 (보고만 · 아무것도 고치지 않았다)

| # | 무엇 | 자리 |
|---|---|---|
| 1 | **R1 은 도달 불가(죽은 분기)** — 조치 대상 아님. 본문 없는 응답은 **R2 하나뿐이고 그것도 설계대로 정상**(호출측 콜백이 인자를 안 받는다) | 273행(죽은 분기) / 341행 · `ws_fn_02.js:540` · `usp/ws_html5_usp.js:384` |
| 2 | **세션 종료가 성공·실패를 전혀 안 알린다** — 버전 수집·임시 앱 삭제 둘 다 결과를 안 받고, 응답 본문도 없다 | 320행 · 334행 |
| 3 | 로직이 터지면 공통 로직이 **정상적으로 받아 처리하지만**(busy 해제·로그·오류창), **화면 문구가 「기능 미지원」** 이라 원인과 어긋난다 | R6 |
| 4 | `FORM INIT_PRC` 안에 `TRY`·`CATCH` 가 **0개** — 모든 예외가 바깥으로 올라가 3번 증상이 된다 | 245~525행 |
| 5 | 성공·실패의 응답 header 가 다르다 — 앱 없음(R3)만 `charset=utf-8` 과 `Access-Control-Allow-Origin: *` 를 붙이고, 정상(R4·R5)은 안 붙인다 | 9202~9209행 vs 512~513행 |
| 6 | 정상(R4·R5)은 `SET_DATA`(xstring), 앱 없음(R3)은 `SET_CDATA`(문자열) — 보내는 방법도 다르다 | 521행 vs 9218행 |
| 7 | 프론트가 보는 `RETCD`·`TYPE` 칸을 init_prc 는 **안 채운다** → 7·8번 필터는 init_prc 에서 죽은 분기다 | `ws_common.js:4834`·`:4853` |

---

## 5. 미확인

> ★ **1번은 2026-10-13 해결됐다**(장군님 지적 — 「보내는 쪽 프론트 로직을 보라」). 5-1절 참고.

| # | 무엇 | 왜 못 가렸나 |
|---|---|---|
| ~~1~~ | ~~R3~~R5 JSON 의 날짜·시각 칸에 따옴표가 붙는지~~ | **해결 — 붙는다.** 5-1절 |

## 5-1. 해결됨 — 날짜·시각 칸에 **따옴표가 붙는다** (2026-10-13)

앞 판에서는 「JSON 을 만드는 macro 를 못 읽으니 못 가린다」로 남겨 뒀다.
**못 읽은 것은 맞지만, 안 봐도 되는 길이 있었다** — 같은 JSON 만드는 자리를 쓰는 **다른 endpoint 의
원본(as-is) 프론트 코드**를 보면 된다. 장군님이 「보내는 쪽 프론트 로직」을 보라고 하셔서 찾았다.

| 단계 | 확인한 것 | 자리 |
|---|---|---|
| 1 | 릴리즈 노트 endpoint 가 내려보내는 구조에 **`ERDAT`(DATS 8) · `ERTIM`(TIMS 6)** 이 들어 있다 | `/U4A/WS000006` 139~140행 · 타입은 `DD03L` 조회로 확인 |
| 2 | 그 구조를 **`init_prc` 와 똑같은 JSON 만드는 자리**로 만든다 (`__SERIALIZE` macro = `/U4A/CL_JSON_HANDLE=>SERIALIZE`) | `/U4A/WS000006` 207·269행 · macro 정의 22~32행 (`/U4A/WS000001` 205~215행과 글자까지 같다) |
| 3 | 보내는 방법도 **`init_prc` 와 같은 자리**다 | `/U4A/WS000006` 210·272행 → `/U4A/WS000001` 9195행 |
| 4 | **원본(as-is) 프론트가 그 값을 글자로 다룬다** — `sLine.ERDAT.substr(0, 4)` · `sLine.ERTIM.substr(0, 2)` | 원본 폴더 `www/ws30/ws10_20/Popups/releaseNotePopup/js/main.js` 275~280행 (읽기 전용) |
| 5 | 다른 화면도 같다 — `_sDETAIL.ERDAT.substr(0, 4)` 등 | 원본 폴더 `www/ws30/ws10_20/Popups/webDynConversionLog/Popup/views/vw_main/control.js` 514·516·658행 |

→ 따옴표가 안 붙으면 `JSON.parse` 가 그 값을 **숫자**로 만들고, 숫자에는 `substr` 가 없어
   **그 자리에서 터진다.** 릴리즈 노트·WebDynpro 변환 기록은 **지금 돌아가는 기능**이다.
→ 그러므로 **그 macro 는 날짜·시각에 따옴표를 붙인다.** `init_prc` 의 날짜·시각 4칸도 **글자로 온다.**
→ 참고: class 안의 **method** 판(`/U4A/CL_JSON_HANDLE` 346~347행)은 따옴표를 안 붙인다.
   하지만 **그 method 를 부르는 줄은 주석 처리돼 있고**(205·266행) 살아 있는 것은 macro 다 — 서로 다르다.

### 덧붙여 — 보내는 쪽(프론트 → 서버)도 글자다

| 확인한 것 | 자리 |
|---|---|
| 프론트가 서버로 보내는 앱 정보 구조에 `ERDAT`·`ERTIM`·`AEDAT`·`AETIM` 이 **빈 글자**로 들어 있다 | 사본 폴더 `www/ws30/ws10_20/design/js/main.js` 137~140행 |
| 그 구조를 `JSON.stringify` 로 만들어 보낸다 → JS 글자는 **항상 따옴표가 붙는다** | `www/ws30/ws10_20/js/ws_events.js` 1418행 |
| 서버가 그것을 **DATS·TIMS 칸이 든 구조**로 받아 읽는다 | `/U4A/WS000002` 1613~1625행 (`GTY_SAVE_APPDATA` 안 `TU4A0010` = `/U4A/T0010`) |


| 3 | `sap-err-id` 를 누가 넣는지 | 읽은 U4A 클래스 4개에 없음(0건). SAP 프레임워크로 보이나 확인 안 했다 |
| 4 | R7 이 실제로 어떤 모양으로 오는지 | 재현해 봐야 안다 |

---

## 6. 재현 명령 · 줄번호 맞추는 방법

```powershell
$S = "C:\Users\socce\.claude\skills\yoon-sap-adt\yoon-sap-adt.ps1"
$out = & $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/programs/programs/%2fu4a%2fws000001"
$out | Set-Content "$env:TEMP\dup.txt" -Encoding utf8

# ★ 반드시 이 보정을 거친다 —
#   ADT 가 준 소스의 줄바꿈이 CRLF 인데 PowerShell 이 CR·LF 둘 다로 쪼개 줄이 2배가 된다.
#   짝수 번째(0,2,4…)만 남기면 SAP 실제 줄번호와 1:1 로 맞는다.
$L = Get-Content "$env:TEMP\dup.txt"
$fix = @(); for($i=0;$i -lt $L.Count;$i+=2){ $fix += $L[$i] }
$fix | Set-Content "$env:TEMP\ws1.src" -Encoding utf8

# 검증: FORM INIT_PRC 가 245행으로 나와야 한다
(Get-Content "$env:TEMP\ws1.src" | Select-String "FORM INIT_PRC").LineNumber
```

**빈 줄을 지우고 번호를 세면 안 된다** — 앞 판에서 그렇게 해서 모든 줄번호가 어긋났다(2026-10-13 정정).
