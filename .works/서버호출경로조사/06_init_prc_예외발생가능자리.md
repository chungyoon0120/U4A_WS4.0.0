# `init_prc` — **중간에 터질 수 있는 자리** 전수 조사

> 조사 시각 **2026-10-13** · 조회 시스템 = **UHA** (`https://uha.u4aide.com:10101`, client 800)
> ★ 줄번호 = **SAP 실제 소스 줄번호**(빈 줄 포함). 보정 방법 = 05번 문서 6절.
> **소스는 한 글자도 고치지 않았다.**

---

## 0. 결론 먼저 — **2026-10-13 재조사로 결론이 바뀜**

> 장군님 지시: **「`CALL FUNCTION` 을 `EXCEPTIONS` 없이 부르는 자리는 빼고 다시 확인해라」**
> → 그 2건을 빼고 처음부터 다시 훑었다. **그러고 남는 것은 「이름을 글자로 적어 부르는 자리」 5곳뿐이고,
> UHA 에서는 5곳 전부 대상이 실제로 있고 method 이름·인자 이름까지 맞는 것을 조회로 확인했다.**

| 경로 | 터질 자리가 있나 |
|---|---|
| **앱 열기(정상)** | **없다.** 이름을 글자로 적어 부르는 자리 2곳이 전부이고, 둘 다 대상이 SAP 표준에 **있다**(조회 확인) |
| **창 닫기(세션 종료)** | **UHA 에서는 없다.** 이름을 글자로 적어 부르는 자리 3곳이고, 대상 class·method·인자 이름이 **전부 맞는다**(조회 확인). **대상이 없는 시스템에서만** 터진다 |

★ 터지는 것과 별개로 남는 것: **창 닫기 한 번에 서버가 최대 약 120초 머문다**(3절).

### 0-1. 빠진 2건 (장군님 지시로 제외) + 제가 틀렸던 것

| 자리 | 제가 앞서 적은 것 | 틀린 점 |
|---|---|---|
| `/U4A/WS000001` **515행** `CALL FUNCTION 'SCMS_STRING_TO_XSTRING'` (`EXCEPTIONS` 절 없음) | 「터지면 `CATCH CX_ROOT` 로도 안 잡히는 dump → HTTP 500」 | **틀렸다.** 그 function module 은 `MESSAGE … RAISING failed` 로 끝낸다. ABAP 규칙상 **부르는 쪽이 그 출구를 안 받으면 예외가 아니라 그냥 메시지로 처리된다** → dump 가 아니다 |
| `/U4A/CL_WB_COMMON` **1231행** `CALL FUNCTION '/U4A/GET_CLAS_INST' STARTING NEW TASK` (`EXCEPTIONS` 절 없음) | 「작업 프로세스 모자라면 dump」 | 장군님 지시로 제외. 같은 규칙이 걸리는 자리다 |

## 1. 「다 봤다」 기준 — 무엇을 끝까지 읽었나

판정 전에 아래를 전부 읽었다. 하나라도 안 읽었으면 판정을 쓰지 않는다는 규칙에 따라 기록한다.

| 대상 | 줄 | 읽었나 |
|---|---|:---:|
| `/U4A/WS000001` `FORM INIT_PRC` 본문 전체 | 245~525 | ✅ |
| `_GET_APP_INFO` | 8655~8726 | ✅ |
| `_SET_INIT_DATA` | 8733~8915 | ✅ |
| `_LOCK_APPLICATION` | 8922~8965 | ✅ |
| `_SET_INIT_CHK` → `_CHK_SYNTX_CONTROLLER` | 8972~8977 / 8984~9043 | ✅ |
| `_RESPONSE_JSON` | 9195~9224 | ✅ |
| `_RELEASE_APP_CTS` | 13358~13415 | ✅ |
| `CHK_DEVELOPMENT_SERVER` | 13934~14110 | ✅ |
| `/U4A/CL_VMS_API` `COLLECT_UNVERSION_DATA` | 275~479 | ✅ |
| `/U4A/CL_VMS_API` `_GET_CTRL_CLAS_POOL` | 1480~1715 | ✅ |
| `/U4A/CL_VMS_API` `_READ_ENQ_STATUS` · `_VERSION_LOCK_PRC` | 1966~2016 / 2338~2387 | ✅ |
| `/U4A/CL_VMS_API` `_REMOVE_TEMP_VER_APP` + 삭제 3종 | 2055~2088 / 2669~2832 | ✅ |
| `/U4A/CL_VMS_API` `__GET_APPID_BY_RND` · `__GET_CLAS_NAME_BY_UUID` | 2835~2950 | ✅ |
| `/U4A/CL_WB_COMMON` `APP_EXPORT_API` | 1163~1388 | ✅ |
| `/U4A/CL_WB_COMMON` `GET_REQUEST_STATUS` · `LOCK_READ` · `LOCK_WORKBANCH` | 5939~5987 / 6740~6794 | ✅ |
| `/U4A/CL_WB_COMMON` `_GET_APP_MIME_RTN` · `_ASYN_REF_CLAS_RTN` | 11993~12028 / 11567~11582 | ✅ |
| `/U4A/CL_WS_COMMON` `CHECK_CLAS_ACTIVE_STATUS` · `IS_S4HANA_SYSTEM` | 137~218 / 1866~ | ✅ |
| `/U4A/CL_JSON_HANDLE` `SERIALIZE` 선언 + 구현 | 59~68 / 575~602 | ✅ |
| `SCMS_STRING_TO_XSTRING` 인터페이스 + 본문 | `LSCMS_CONVU12` | ✅ |
| 위 전부의 **선언부 `RAISING` 절** | — | ✅ 전부 **없음** |

→ 호출하는 U4A method 중 **`RAISING` 절을 가진 것은 하나도 없다.** 그래서 터질 수 있는 건
**ABAP runtime 이 스스로 던지는 것**과 **예외 절 없이 부른 function module** 둘뿐이다.

---

## 2. `CALL FUNCTION` 건을 빼고 남는 것 — **이름을 글자로 적어 부르는 자리 5곳**

ABAP 에서 **이름을 글자로 적어 부르면**(`('SET_DATA')` 처럼) 그 이름이 없을 때 **잡히는 예외**가 난다.
`/U4A/WS000001` `FORM INIT_PRC`(245~525) 안에는 `TRY`·`CATCH` 가 **0개**라, 그 예외는 그대로 바깥
handler 의 `CATCH CX_ROOT` 까지 올라가 **「이 서버는 그 기능을 지원하지 않습니다」 오류창**이 뜬다.

| # | 자리 | 무엇을 글자로 적나 | UHA 조회 결과 |
|---|---|---|---|
| 1 | `/U4A/WS000001` **521행** `CALL METHOD IO_SERVER->RESPONSE->('SET_DATA')` | `SET_DATA` | **있다** — `IF_HTTP_RESPONSE` 의 method 로 `SEOCOMPO` 에 등록돼 있다 ✅ |
| 2 | `/U4A/WS000001` **9218행** `CALL METHOD IO_SERVER->RESPONSE->('SET_CDATA')` | `SET_CDATA` | **있다** — 같은 방법으로 확인 ✅ |
| 3 | `/U4A/CL_WB_COMMON` **1219행** `CREATE OBJECT LO_REP TYPE ('ZCL_U4A_TEMP_REPOSITORY')` | class `ZCL_U4A_TEMP_REPOSITORY` | **있다 · active**(`SEOCLASSDF` `STATE=1`). `CONSTRUCTOR` 에 **인자가 없다** → 인자 없이 만드는 이 호출이 맞다 ✅ |
| 4 | `/U4A/CL_WB_COMMON` **1344행** `CALL METHOD LO_REP->('SET_APPDAT')` | method `SET_APPDAT` | **있다.** 인자 이름이 `IV_DATA` 하나인데 **1346행이 넘기는 이름과 같다** ✅ |
| 5 | `/U4A/CL_WB_COMMON` **1348행** `CALL METHOD ('ZCL_U4A_TRANSFORM_GENERAL')=>TRANSFORM_OBJECT_TO_RAWSTRING` | class `ZCL_U4A_TRANSFORM_GENERAL` | **있다 · active.** 인자 `IO_OBJECT`·받는 값 `RV_XSTRING`·실패 출구 4개(`TRANSFORMATION_FAILED`·`PARAMETER_INVALID_RANGE`·`BUFFER_OVERFLOW`·`COMPRESSION_ERROR`)가 **1349~1358행과 전부 일치** ✅ |

→ **5곳 전부 UHA 에서는 터지지 않는다.**
→ 다만 **3·4·5 는 `Z` 네임스페이스**다. U4A 솔루션 소유가 아니라 **고객 시스템 쪽**에 있어야 하는 것들이라,
  그게 없거나 inactive 인 시스템에서는 **창 닫을 때마다 오류창**이 뜬다. (경로: `/U4A/WS000001` 320행 →
  `/U4A/CL_VMS_API` 336행 → `/U4A/CL_WB_COMMON` 1219·1344·1348행)

### 2-1. 그 밖에 의심해서 끝까지 확인한 것 — **전부 안 터진다**

| 자리 | 의심한 것 | 확인 결과 |
|---|---|---|
| `/U4A/CL_WB_COMMON` **1328행** `LS_DATA-U4AVR = LS_DATA-U4AVR+0(LV_OFF)` | 길이를 변수로 잘라 **범위 넘침** | `LV_OFF` 는 **같은 칸에서 찾은 위치**(1326행 `FIND`)라 늘 그 칸보다 작다. 안 터진다 |
| `/U4A/CL_VMS_API` **1529~1531행** `SY-TFILL = STRLEN( … ) - 2.` 뒤 `LV_METHD+0(SY-TFILL)` | system 변수에 직접 써 넣고 그걸 길이로 쓴다 | 1526행에서 **비어 있지 않은지 먼저 확인**하고, 들어오는 값은 class pool 이름이라 늘 10자 넘는다. 안 터진다. **쓰는 방식은 위태롭다** |
| `/U4A/CL_VMS_API` **2370 · 2720 · 2829행** `MESSAGE ID SY-MSGID …` | `INTO` 없이 메시지를 쏘는 것처럼 보임 | **다음 줄에 `INTO EV_RTMSG` 가 있다**(여러 줄 문장). 안 터진다 |
| `/U4A/WS000001` **450행** `SELECT SINGLE FLD07 INTO L_VER` | 서로 다른 타입끼리 넣어 **변환 오류** | 주는 쪽 `CHAR(100)` · 받는 쪽 `CHAR(10)`(조회 확인) → **잘릴 뿐** 예외가 아니다. 그리고 `L_VER` 는 **이후 안 쓰인다** |
| `/U4A/WS000001` **8784·8788행** 세션 key 만들기 | 칸이 짧아 넘침 | 받는 칸 `C(60)`, 넣는 값은 최대 45자 → 남는다 |
| `/U4A/WS000001` **391행** 세션 목록에 넣기 | 같은 key 두 번 넣는 예외 | **386행에서 이미 있는지 먼저 확인**한다 |
| `/U4A/CL_VMS_API` **428·444행** 버전 번호 +1 | 숫자 아닌 값에 셈하기 | 두 칸 모두 `NUMC(6)`(조회 확인) → 셈이 된다 |
| `/U4A/CL_VMS_API` **2935행** 임시 class 이름 만들기 | 칸이 짧아 넘침 | 받는 칸 `CHAR(30)`, 만드는 값이 `3+1+26 = 30` → **딱 맞는다** |
| `/U4A/CL_VMS_API` **296행** 안 쓰이는 field-symbol 선언 | 값 없는 채로 쓰면 예외 | 그 method 안에서 **한 번도 안 쓰인다**. 선언만 남은 것 |
| 부르는 method 전부의 선언 | `RAISING` 절 | **하나도 없다**(1절 목록 전체 확인) |

## 3. 터지는 것과 별개로 — **창 닫기 한 번에 최대 약 120초**

| 자리 | 얼마나 기다리나 |
|---|---|
| `/U4A/CL_WB_COMMON` **1237행** `WAIT UNTIL … UP TO 60 SECONDS` — 다른 작업 프로세스에서 class→XML 변환이 끝날 때까지 | **최대 60초** |
| `/U4A/CL_VMS_API` **372~388행** `DO 60 TIMES` 안에서 `WAIT UP TO 1 SECONDS` — 잠금이 풀릴 때까지 | **최대 60초** |

프론트 통신 제한 시간이 600초라 끊기지는 않지만, 그 동안 **처리중 표시가 계속 켜져 있다.**
그리고 init_prc 는 이 결과를 **안 받는다**(320행에 받는 자리 없음) → **실패해도 아무 데도 안 남는다.**

---

## 4. 눈에 띈 것 (보고만 · 아무것도 고치지 않았다)

| # | 무엇 | 자리 |
|---|---|---|
| 1 | **이름을 글자로 적어 부르는 자리 5곳에 `TRY` 가 없다.** UHA 에선 대상이 다 있어 안 터지지만, 없는 시스템에서는 바로 오류창 | `/U4A/WS000001` 521·9218행 · `/U4A/CL_WB_COMMON` 1219·1344·1348행 |
| 2 | 그 중 3개가 **`Z` 네임스페이스 대상**이라 고객 시스템에 그 class 가 있어야 한다 | `/U4A/CL_WB_COMMON` 1219·1348행 |
| 3 | **창 닫기 한 번에 최대 약 120초** 머물고, 그 결과를 **아무도 받지 않는다** | 3절 |
| 4 | **system 변수(`SY-TFILL`)에 직접 값을 써 넣고** 그걸 글자 자르는 길이로 쓴다. 평시 안 터지지만 위태롭다 | `/U4A/CL_VMS_API` 1529~1531행 |
| 5 | 쓰이지 않는 field-symbol 선언이 남아 있다 | `/U4A/CL_VMS_API` 296행 |
| 6 | 값을 받아 쓰지 않는 **죽은 `SELECT`** 가 있다(`L_VER`) | `/U4A/WS000001` 450행 |

## 5. 미확인

| # | 무엇 | 왜 못 가렸나 |
|---|---|---|
| 1 | 비동기 결과를 받는 자리가 **부른 것과 다른 function module 이름**을 적고 있다 — `/U4A/GET_CLAS_INST` 로 부르고 `/U4A/GET_CLAS_INS_RES` 로 받는다(둘은 별개 function module, 조회 확인). 실제로 결과가 들어오는지는 소스만으로 못 가린다. 단 그 자리는 `TRY`/`CATCH` 로 감싸 있고, 실패하면 코드 `2` 로 끝나며 init_prc 가 그 결과를 안 받으므로 **프론트까지 올라오지 않는다** | 돌려 봐야 안다 |
| ~~2~~ | ~~정상 응답 JSON 의 날짜·시각 칸에 따옴표가 붙는지~~ → **2026-10-13 해결. 따옴표가 붙는다**(05번 문서 5절) |

---

## 6. 재현 명령

05번 문서 6절과 같다(줄번호 보정 필수). 추가로 쓴 조회:

```powershell
$S = "C:\Users\socce\.claude\skills\yoon-sap-adt\yoon-sap-adt.ps1"

# 1) function module 의 실패 출구 확인
'{"params":{"query":"SELECT FUNCNAME, PARAMETER, PARAMTYPE FROM FUPARAREF WHERE FUNCNAME = ''SCMS_STRING_TO_XSTRING''","max_rows":40}}' |
  Set-Content "$env:TEMP\q.json" -Encoding utf8
& $S call --as UHA sap_adt_data_preview --file "$env:TEMP\q.json"

# 2) 글자로 적어 부르는 class 두 개가 있는지 · active 인지
'{"params":{"query":"SELECT CLSNAME, STATE FROM SEOCLASSDF WHERE CLSNAME IN ( ''ZCL_U4A_TEMP_REPOSITORY'', ''ZCL_U4A_TRANSFORM_GENERAL'' )","max_rows":20}}' |
  Set-Content "$env:TEMP\q.json" -Encoding utf8
& $S call --as UHA sap_adt_data_preview --file "$env:TEMP\q.json"

# 3) 글자로 적어 부르는 method 이름이 실제로 있는지
'{"params":{"query":"SELECT CLSNAME, CMPNAME, CMPTYPE FROM SEOCOMPO WHERE CLSNAME IN ( ''IF_HTTP_RESPONSE'', ''ZCL_U4A_TEMP_REPOSITORY'', ''ZCL_U4A_TRANSFORM_GENERAL'' )","max_rows":60}}' |
  Set-Content "$env:TEMP\q.json" -Encoding utf8
& $S call --as UHA sap_adt_data_preview --file "$env:TEMP\q.json"

# 4) 그 method 의 인자 이름이 호출과 맞는지
'{"params":{"query":"SELECT CLSNAME, CMPNAME, SCONAME, PARDECLTYP FROM SEOSUBCODF WHERE CLSNAME IN ( ''ZCL_U4A_TEMP_REPOSITORY'', ''ZCL_U4A_TRANSFORM_GENERAL'' )","max_rows":60}}' |
  Set-Content "$env:TEMP\q.json" -Encoding utf8
& $S call --as UHA sap_adt_data_preview --file "$env:TEMP\q.json"

# 5) 넣고 받는 칸 타입이 달라 변환 오류가 날 수 있는지
'{"params":{"query":"SELECT TABNAME, FIELDNAME, DATATYPE, LENG FROM DD03L WHERE TABNAME IN ( ''/U4A/T9011'', ''/U4A/T_EX_ITEM'', ''/U4A/T_AVM_H'', ''/U4A/T0013'' ) AND FIELDNAME IN ( ''FLD07'', ''U4VER'', ''VPOSN'', ''TAPPID'', ''TCLSID'', ''APPVR'' )","max_rows":30}}' |
  Set-Content "$env:TEMP\q.json" -Encoding utf8
& $S call --as UHA sap_adt_data_preview --file "$env:TEMP\q.json"
```

★ `sap_adt_data_preview` 는 **조건을 `OR` 로 겹겹이 묶으면 거부한다**(`"INTO" is invalid here`).
`IN ( … )` 로 풀어 쓴다.
