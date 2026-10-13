# `init_prc` 백엔드 분석 — `PERFORM` 뒤부터

> ★ **줄번호 기준 = SAP 실제 소스 줄번호(빈 줄 포함)** — 2026-10-13 전면 재확인·정정.
> (앞 판은 소스를 저장할 때 빈 줄을 지우고 번호를 다시 세어 전부 어긋나 있었다. 장군님 지적으로 바로잡음.
>  원인 = ADT 가 준 소스의 줄바꿈이 `
` 인데 PowerShell 이 ``·`
` 둘 다로 쪼개 줄이 2배가 됐고,
>  그걸 빈 줄 제거로 눌러서 번호가 밀렸다. 지금은 2배로 늘어난 줄을 되돌려 원본과 1:1 로 맞춘다.)
> 조사 시각 **2026-10-13** · 조회 시스템 = **UHA** (`https://uha.u4aide.com:10101`, client 800)
> SAP ADT 로 실제 소스·DDIC·메시지 테이블을 읽어 확인. **소스는 한 글자도 고치지 않았다.**
> **범위** = `/U4A/WS_ROOT` 의 `PERFORM INIT_PRC IN PROGRAM /U4A/WS000001` **이후만**.
> 앞단(SICF handler · 라우팅 · HTTP 관문)은 장군님 지시로 **제외**했다.
> 못 읽은 것은 8절에 **미확인**으로 따로 적었다.

---

## 0. 시작점

```abap
" /U4A/WS_ROOT 235행 (껍데기)
FORM INIT_PRC USING IO_SERVER TYPE REF TO IF_HTTP_SERVER
                    IO_HANDLE TYPE REF TO /U4A/CL_HTTP_SERVER_WBC.
  PERFORM INIT_PRC IN PROGRAM /U4A/WS000001 USING IO_SERVER IO_HANDLE.
ENDFORM.
```

→ **실제 로직 = `/U4A/WS000001` 의 `FORM INIT_PRC` (**245~525행**)**

| 넘겨받는 것 | 무엇 |
|---|---|
| `IO_SERVER` | `IF_HTTP_SERVER` — 요청 읽기 / 응답 쓰기 |
| `IO_HANDLE` | handler 인스턴스. **세션 목록 `AT_SESSIONS` 를 들고 있다** |

`IO_HANDLE->AT_SESSIONS` = `SORTED TABLE OF { APP_SID(STRING), APPID(C50) } WITH UNIQUE KEY APP_SID`
→ handler 인스턴스에 붙은 데이터라, **stateful 세션이 살아 있는 동안만** 유지된다.

### 쓰는 지역 변수 · 타입

| 이름 | type |
|---|---|
| `LS_APP_INFO` | `GTY_APP_INFO` (응답 본체) |
| `LS_APP_INFO_VMS` | `TY_APP_INFO_VMS` = `INCLUDE GTY_APP_INFO` + `S_APP_VMS TYPE /U4A/T_AVM_H` |
| `LV_APPID` | `/U4A/E_APPID` |
| `LV_APP_SID` | `STRING` |
| `LV_ISEDIT` | `C` |
| `LV_EXIT` | `STRING` |
| `LV_JSON` | `STRING` |
| `LV_CONTENT` | `XSTRING` |
| `LV_CLSID` | `SEOCLASSDF-CLSNAME` |

---

## 1. 받는 값 4개 (`FORM INIT_PRC` 앞머리(273~301행))

```abap
CHECK IO_SERVER IS BOUND.
GET_FORM_FIELD_CS( NAME = 'APPID'  ) → LV_APPID
GET_FORM_FIELD_CS( NAME = 'ISEDIT' ) → LV_ISEDIT
GET_FORM_FIELD_CS( NAME = 'SSID'   ) → LV_APP_SID
GET_FORM_FIELD_CS( NAME = 'EXIT'   ) → LV_EXIT
```

| 이름 | 쓰임 |
|---|---|
| `APPID` | 조회 대상. **아래 `TRANSLATE … TO UPPER CASE` 는 EXIT 분기 뒤에 있다** |
| `ISEDIT` | `'X'` = Change 모드로 열겠다 |
| `SSID` | 세션 키 (프론트가 `APPID + "_" + 랜덤키` 로 만든다) |
| `EXIT` | `'X'` = 조회가 아니라 세션 종료 처리 |

★ `GET_FORM_FIELD_CS` = **대소문자 구분**. 보내는 이름이 틀리면 값이 조용히 비어 들어온다.
★ `CHECK IO_SERVER IS BOUND` 가 실패하면 **아무 응답도 안 보내고** FORM 이 끝난다.
★ **`EXIT` 분기가 대문자 변환보다 먼저**다 → 세션 종료 때 소문자 APPID 를 보내면 `/U4A/T_AVM_H` 조회·세션 삭제가 그 소문자 값으로 돈다. 프론트가 대문자로 보내는지는 **미확인**.

---

## 2. `EXIT = 'X'` 분기 (303~343행) — 세션 끊기

```abap
IF LV_EXIT EQ 'X'.
  DELETE IO_HANDLE->AT_SESSIONS WHERE APP_SID = LV_APP_SID.
  IF IO_HANDLE->AT_SESSIONS[] IS INITIAL.
    IO_SERVER->SET_SESSION_STATEFUL( STATEFUL = CO_DISABLED
                                     PATH     = '/zu4a_wbc/u4a_ipcmain' ).
  ENDIF.
  /U4A/CL_VMS_API=>COLLECT_UNVERSION_DATA( IV_APPID = LV_APPID ).
  SELECT SINGLE TCLSID INTO @LV_CLSID
    FROM /U4A/T_AVM_H AS A WHERE TAPPID EQ @LV_APPID.
  IF SY-SUBRC EQ 0.
    /U4A/CL_VMS_API=>_REMOVE_TEMP_VER_APP( IV_APPID  = LV_APPID
                                           IV_CLSNAM = LV_CLSID ).
  ENDIF.
  EXIT.
ENDIF.
```

- `EXIT` 로 끝나므로 **응답 본문을 아예 안 만든다.**
  프론트는 빈 응답을 `{}` 로 바꿔 성공 콜백을 받는다 (`www/ws30/ws10_20/js/ws_common.js:4815`)
- 조건이 **`TAPPID`**(임시 버전 앱 ID) 다 → 지금 닫는 앱이 **임시 버전 앱일 때만** 5번이 돈다
- ★ `COLLECT_UNVERSION_DATA` 를 **`IMPORTING` 없이** 부른다 → `RV_SUBRC`·`EV_RTMSG` 를 안 받는다.
  **실패해도 응답·로그에 아무것도 안 남는다**
- ★ `_REMOVE_TEMP_VER_APP` 도 **`ET_RETURN`·`RV_SUBRC` 를 안 받는다** — 같은 문제

프론트 짝 = `oAPP.fn.fnKillUserSession` (`www/ws30/ws10_20/js/ws_fn_02.js:860~882`) — **WS20 → WS10 나갈 때**.

### 2-1. `COLLECT_UNVERSION_DATA` — ★ 화면 나가는 길목에 최대 60초 + DB 쓰기

| 순서 | 내용 |
|---|---|
| 1 | **CTS 수집 SELECT** — `E071` ⋈ `E070`(`TRFUNCTION='S'`) ⟕ `E07T` ⋈ `/U4A/T0010`(`SUBSTRING(OBJ_NAME,1,30) = CLSID`), 서브쿼리 4개(`/U4A/T_AVM_H`·`/U4A/T0013` 각 2번), `OBJFUNC NE 'D'`, `SUBSTRING(TRKORR,1,3) = SY-SYSID` |
| 2 | 수집 0건이면 `EV_RTMSG='No information collected.'` 로 **바로 return**(그 뒤 전부 안 돎) |
| 3 | `/U4A/CL_WB_COMMON=>APP_EXPORT_API( APPID )` → 앱 데이터 `XSTRING`. 실패면 return |
| 4 | `_GET_CTRL_CLAS_POOL( APPID )` → controller class 소스 전체를 `TT_ABAPS` 로 (2-3 참고). 비면 return |
| 5 | **`DO 60 TIMES. … WAIT UP TO 1 SECONDS. ENDDO.`** — `_READ_ENQ_STATUS` 가 Unlock 될 때까지 **최대 60초 블로킹** |
| 6 | 60초 지나도 잠겨 있으면 `EV_RTMSG` 에 `<사용자> is already processing.` 넣고 return |
| 7 | `_VERSION_LOCK_PRC( 'E' )` → `ENQUEUE_/U4A/EZ_APPVMS( APPID, VPOSN )`. `VPOSN` 비면 `'999999'` |
| 8 | `MAX(VPOSN)` from `/U4A/T_AVM_H`, `MAX(APPVR)` from `/U4A/T0013` |
| 9 | CTS 건마다: `TAPPID = __GET_APPID_BY_RND( )`, `TCLSID = __GET_CLAS_NAME_BY_UUID( )`, `RELKY = APPID + VPOSN` |
| 10 | **DB 쓰기** `EXPORT P1 = <앱데이터> TO DATABASE /U4A/T_AVM_D(00) ID RELKY` + `EXPORT P1 = <ABAP소스> TO DATABASE /U4A/T_AVM_D(01) ID RELKY` + **`COMMIT WORK`** (CTS 건마다 반복) |
| 11 | CTS 상태가 `'R'`(Released)면 그 `/U4A/T0013` 행에 `TRANF = ABAP_TRUE` |
| 12 | **DB 쓰기** `MODIFY /U4A/T_AVM_H FROM TABLE` · `MODIFY /U4A/T0013 FROM TABLE` + **`COMMIT WORK`** |
| 13 | `_VERSION_LOCK_PRC( 'D' )` → `DEQUEUE_/U4A/EZ_APPVMS` |

- 공통 통신 함수 timeout 기본값은 **600000ms(10분)** 이라 60초 대기로는 안 끊긴다 (`ws_common.js:4179`)
- `ajax_init_prc` 는 첫 줄에서 `parent.setBusy('X')` 를 켠다 → 그 시간 내내 조작이 막힌다
- `_READ_ENQ_STATUS` 도 `ENQUEUE_READ( GNAME='/U4A/T_AVM_H', GARG=APPID+VPOSN, **GUNAME=SPACE** )`
  → **사용자를 가리지 않는다**

### 2-2. 이름 만드는 두 메소드

| 메소드 | 만드는 것 | 방식 |
|---|---|---|
| `__GET_APPID_BY_RND` | 임시 앱 ID | `'YUX_'` + `GET_RANDOM_CHAR(16)`. 실패하면 `'TEMP_' + QF05_RANDOM_INTEGER`. `/U4A/T0010` 에 없을 때까지 **최대 100번** 재시도 |
| `__GET_CLAS_NAME_BY_UUID` | 임시 class 이름 | `'YCL_'` + `CL_SYSTEM_UUID=>CREATE_UUID_C26_STATIC( )`. 예외면 `'UA_TEMP_' + 랜덤수`. `SEOCLASSDF` 에 없을 때까지 **최대 100번** |

★ 100번 다 실패하면 **빈 값을 돌려준다** — 둘 다 그 경우를 따로 알리지 않는다.

### 2-3. `_GET_CTRL_CLAS_POOL` — controller class 소스를 긁어모으는 방식

1. `/U4A/T0010-CLSID` → `CL_OO_CLASSNAME_SERVICE=>GET_CLASSPOOL_NAME`
2. `SEOMETAREL` 로 구현한 interface 목록, `SEOCOMPO` ⋈ `SEOCOMPODF` 로 method 목록(`CMPTYPE='1'`)
   — 자기 class 는 `'99_CLAS'`, interface 쪽은 `'00_INFC'` 로 표시해 합치고 `CLSNAME`·`EDITORDER` 로 정렬
3. `GET_ALL_CLASS_INCLUDES` 로 include 목록
4. `READ REPORT <classpool> … STATE CO_ACTIVATE` 로 **활성판** 소스를 읽어
   - 패턴에 걸리면 method 별 `GET_METHOD_INCLUDE` → `READ REPORT` 로 본문을 끼워 넣고 `_SET_METHOD_COMMENT` 로 주석 머리를 붙인다
   - 아니면 include 를 그대로 끼워 넣는다
5. 맨 앞에 `__ASCII_ART_HEADER` 를 붙인다

### 2-4. `_REMOVE_TEMP_VER_APP` — 임시 버전 앱 지우기 3단계

| 단계 | 메소드 | 하는 일 |
|---|---|---|
| 1 | `__DEL_MIME_AREA` | `/ZU4A/public/application/<APPID>` MIME 폴더를 `IF_MR_API->DELETE`(자식 포함, **권한검사 off**, 대화창 off). **폴더가 없으면 조용히 성공으로 끝난다** |
| 2 | `__DEL_TEMP_CLSID` | `SEOCLASS` 에 있으면 `/U4A/CL_ETC_UTILITIES=>DEL_CLS_CVA` 로 class 삭제 |
| 3 | `__DEL_TEMP_APPDATA` | **아래 표의 DELETE 전부 + `COMMIT WORK`** |

`__DEL_TEMP_APPDATA` 가 지우는 것:

| 대상 | 방식 |
|---|---|
| `/U4A/T0011` 에서 `GUINR` 먼저 읽음 | **없으면 `CHECK` 에 걸려 아무것도 안 지우고 끝난다** |
| `/U4A/T0010` · `/U4A/T0011` · `/U4A/T0013` | `DELETE FROM … WHERE APPID EQ …` |
| `/U4A/T0014(OR)` · `/U4A/T0015(OA)` | `DELETE FROM DATABASE … ID <GUINR>` |
| `/U4A/T0028` 의 `BF`·`SV`·`H1`·`H2`·`LK`·`LJ` | `ID <APPID>` |
| `/U4A/T9014(PV)` · `/U4A/T9017(PR)` | `ID <APPID>` |
| `/U4A/T9019` 의 `HM`·`HJ`·`AV`·`EJ`·`EV`·`UC` · `/U4A/T9018(T1)` | `ID <APPID>` |
| 마지막 | `COMMIT WORK` |

★ **화면을 나가는 것만으로 앱 데이터가 통째로 지워지는 경로**다. 조건은 `/U4A/T_AVM_H-TAPPID` 일치 하나뿐이고, 결과는 호출측에서 **받지 않는다**.

---

## 3. 조회(기본) 분기 — 346~525행

```abap
TRANSLATE LV_APPID TO UPPER CASE.
LS_APP_INFO-APPID = LV_APPID.
PERFORM _GET_APP_INFO CHANGING LS_APP_INFO.              " ①
IF LS_APP_INFO-MSGTY EQ 'N'.                             " ②
  /U4A/CL_JSON_HANDLE=>SERIALIZE( DATA = LS_APP_INFO ) → LV_JSON
  PERFORM _RESPONSE_JSON IN PROGRAM /U4A/WS000001 USING LV_JSON IO_SERVER.
  EXIT.
ENDIF.
IF LV_APP_SID IS NOT INITIAL.                            " ③ 세션 등록
  READ TABLE IO_HANDLE->AT_SESSIONS … WITH TABLE KEY APP_SID = LV_APP_SID.
  IF SY-SUBRC NE 0.
    INSERT { APP_SID, APPID } INTO TABLE IO_HANDLE->AT_SESSIONS.
    IO_SERVER->SET_SESSION_STATEFUL( CO_ENABLED, PATH='/zu4a_wbc/u4a_ipcmain' ).
  ENDIF.
ENDIF.
PERFORM _SET_INIT_DATA USING LV_ISEDIT CHANGING LS_APP_INFO.   " ④
PERFORM _LOCK_APPLICATION CHANGING LS_APP_INFO.                " ⑤
PERFORM _RELEASE_APP_CTS CHANGING LS_APP_INFO.                 " ⑥
PERFORM _SET_INIT_CHK CHANGING LS_APP_INFO.                    " ⑦
… ⑧ 라이브러리 버전 SELECT (안 쓰임) → ⑨ 샘플 앱 → ⑩ 임시 버전 앱 → ⑪ 응답
```

| # | 하는 일 | 바뀌는 칸 |
|---|---|---|
| ① | `_GET_APP_INFO` — 앱이 있나 | 테이블 칸 전부 · `REQNO` · (없으면) `MSGTY` `MESSAGE` |
| ② | 없으면 **`_RESPONSE_JSON` 으로 보내고 종료** | — |
| ③ | `SSID` 있으면 세션 등록 + stateful on | `AT_SESSIONS` |
| ④ | `_SET_INIT_DATA` | `IS_EDIT` `MESSAGE` `SESTION_KEY` `IS_DEV` `DEV_KEY` |
| ⑤ | `_LOCK_APPLICATION` | `LCKFL` `IS_EDIT` `MSGTY` `MESSAGE` |
| ⑥ | `_RELEASE_APP_CTS` | `REQNO` (+ **DB UPDATE**) |
| ⑦ | `_SET_INIT_CHK` → `_CHK_SYNTX_CONTROLLER` | `ACTST` |
| ⑧ | `/U4A/T9011` 에서 라이브러리 버전 | ★ **읽고 아무데도 안 쓴다**(9절) |
| ⑨ | `/U4A/T_EX_ITEM` 에 그 `APPID` 가 있으면 | `ADMIN_APP = 'X'` |
| ⑩ | `/U4A/T_AVM_H` 의 **`TAPPID`** 가 그 `APPID` 면 | 응답 구조를 바꿔 **`S_APP_VMS` 를 덧붙임** |
| ⑪ | 응답 전송 | — |

### ★ 분기 사슬 — `IS_EDIT` 이 비면 뒤가 줄줄이 안 돈다

```
ISEDIT='X' 로 들어옴
   │
   ├ ④ CTS 상태가 L·O·N → IS_EDIT 비움 + 메시지 047
   │        └ ⑤ _LOCK_APPLICATION  : CHECK IS_EDIT='X' → 안 돎 (잠금 시도 안 함)
   │        └ ⑦ _CHK_SYNTX_...     : CHECK IS_EDIT='X' → 안 돎 (ACTST 는 테이블 값 그대로)
   │
   └ CTS 정상 → ⑤ 로 진행
            ├ 이미 잠김(RETCD=4) → IS_EDIT 비움 · MSGTY='E' · 메시지 152
            │        └ ⑦ 역시 안 돎
            └ 잠금 → LCKFL='X' · IS_EDIT='X' → ⑦ 에서 ACTST 판정
```

### 3-1. `_GET_APP_INFO` (8655행)

| 순서 | 내용 |
|---|---|
| 1 | `SELECT MAX( APPVR ) FROM /U4A/T0013 WHERE APPID EQ …` |
| 2 | `SELECT SINGLE * FROM /U4A/T0013 AS A INNER JOIN /U4A/T0010 AS B ON A~APPID = B~APPID WHERE A~APPID = … AND A~APPVR = <MAX>` → `INTO CORRESPONDING FIELDS OF CS_APP_INFO` |
| | **실패하면** `MSGTY='N'` · `MESSAGE` = 메시지 007 → `EXIT` |
| 3 | `SELECT SINGLE APPID POSIT LAYOI LAYDS GUINR FROM /U4A/T0011 WHERE APPID EQ …` |
| 4 | `SELECT APPVR REQNR FROM /U4A/T0013 WHERE APPID EQ … AND TRANF EQ SPACE` → `SORT DESCENDING BY APPVR` → 첫 건 `REQNR` → `REQNO` |
| | 4번이 0건이면 `CHECK` 에 걸려 `REQNO` 는 빈 값으로 남는다 |

★ 2번이 `INNER JOIN` 이라 **`/U4A/T0011` 행이 없어도 「앱 있음」** 으로 판정된다(3번은 그냥 실패).
그러면 `POSIT`·`LAYOI`·`LAYDS`·`GUINR` 가 빈 값으로 응답에 나간다.

### 3-2. `_SET_INIT_DATA` (8733행)

```abap
CS_APP_INFO-IS_EDIT = U_ISEDIT.
/U4A/CL_WB_COMMON=>GET_REQUEST_STATUS( I_REQNM = CS_APP_INFO-REQNO ) → L_STATUS
IF L_STATUS EQ 'L' OR L_STATUS EQ 'O' OR L_STATUS EQ 'N'.
  CLEAR CS_APP_INFO-IS_EDIT.
  MESSAGE E047(/U4A/MSG_WS) INTO CS_APP_INFO-MESSAGE.
ENDIF.
GET TIME STAMP FIELD L_TIME.
CS_APP_INFO-SESTION_KEY = APPID + L_TIME   (CONDENSE NO-GAPS)
PERFORM CHK_DEVELOPMENT_SERVER CHANGING CS_APP_INFO-IS_DEV.
IF /U4A/CL_WS_COMMON=>IS_S4HANA_SYSTEM( ) EQ ABAP_TRUE.
  CS_APP_INFO-DEV_KEY = 'S4HANA'.
ELSE.
  SELECT SINGLE ACCESSKEY INTO CS_APP_INFO-DEV_KEY FROM DEVACCESS WHERE UNAME EQ SY-UNAME.
ENDIF.
```

`GET_REQUEST_STATUS` 속:

1. `REQNO` 가 비면 **`'D'`(Modifiable) 로 간주하고 끝** → CTS 없는 앱은 Change 가 막히지 않는다
2. `SELECT SINGLE TRSTATUS STRKORR FROM E070 WHERE TRKORR = REQNO`
3. `TRSTATUS ≠ 'R'` → 그 값 그대로 반환
4. `'R'` 인데 `STRKORR`(상위 request)가 비면 → `'R'` 반환
5. `'R'` 이고 상위가 있으면 → **상위 request 의 `TRSTATUS`** 반환

★ 막는 상태는 `'L'`(Modifiable, Protected) · `'O'`(Release Started) · `'N'`(Released …) 세 개.
`'R'`(Released) 는 **막는 목록에 없다** — 상위 request 가 없으면 `'R'` 이 그대로 와서 Change 가 허용된다.

`IS_S4HANA_SYSTEM` = `SELECT SINGLE COMPONENT FROM CVERS WHERE COMPONENT LIKE 'S4%'` 가 있으면 참.

`CHK_DEVELOPMENT_SERVER` (13934행) — 지금 살아 있는 로직은 **이것뿐**(앞 판정들은 전부 주석):

1. `SELECT SINGLE * FROM T000 WHERE MANDT EQ SY-MANDT`
2. 기본 `IS_DEV = 'X'`(개발 서버 아님)
3. `CCNOCLIIND` 가 **빈 값 또는 `'1'`** 이면 `IS_DEV = 'D'`(개발 서버)

주석 이력: `CCCATEGORY`(Production/Test/…) 판정을 2024-04-19 에 뺐다.
사유 = 「어떤 고객사는 그 값이 1 인데도 일반 ABAP 프로그램을 만들고 고칠 수 있었다」

### 3-3. `_LOCK_APPLICATION` (8922행) — `IS_EDIT='X'` 일 때만

```abap
CHECK CS_APP_INFO-IS_EDIT EQ 'X'.
/U4A/CL_WB_COMMON=>LOCK_READ( I_APPID = APPID ) → E_RETCD, E_USER
IF L_RETCD EQ 4.
  FREE CS_APP_INFO-LCKFL. FREE CS_APP_INFO-IS_EDIT. CS_APP_INFO-MSGTY = 'E'.
  MESSAGE S152(/U4A/MSG_WS) WITH APPID L_USER INTO CS_APP_INFO-MESSAGE.
  EXIT.
ENDIF.
/U4A/CL_WB_COMMON=>LOCK_WORKBANCH( I_APPID = APPID ).
CS_APP_INFO-LCKFL = 'X'. CS_APP_INFO-IS_EDIT = 'X'.
```

| 메소드 | 속 |
|---|---|
| `LOCK_READ` | `ENQUEUE_READ( GNAME='/U4A/T0010', GARG=APPID, **GUNAME=SPACE** )` → lock 이 하나라도 있으면 `E_RETCD=4` + 그 `GUNAME` |
| `LOCK_WORKBANCH` | `ENQUEUE_/U4A/EZ_APPID( APPID )`, 예외 `FOREIGN_LOCK`·`SYSTEM_FAILURE` 를 **받아만 두고 아무것도 안 한다**(`##FM_SUBRC_OK`) |

★ `GUNAME = SPACE` → **사용자를 가리지 않는다. 자기가 잠근 것도 4 로 잡힌다.**
★ `LOCK_WORKBANCH` 실패를 안 보고 **무조건 `LCKFL='X'`·`IS_EDIT='X'`** 로 응답한다 — 앞의 `LOCK_READ` 가 걸러 주는 구조에 기대고 있다.

### 3-4. `_RELEASE_APP_CTS` (13358행) — ★ 조회인데 DB 를 고친다

```abap
CHECK CS_APP_INFO-PACKG NE '$TMP'.
SELECT SINGLE * INTO LS_0013 FROM /U4A/T0013
  WHERE APPID EQ … AND APPVR EQ ( SELECT MAX( APPVR ) FROM /U4A/T0013 WHERE APPID EQ … ).
CHECK SY-SUBRC EQ 0 AND LS_0013-REQNR IS NOT INITIAL AND LS_0013-TRANF IS INITIAL.
SELECT SINGLE TRSTATUS INTO LV_STAT FROM E070 WHERE TRKORR EQ LS_0013-REQNR.
CHECK LV_STAT NE 'D' AND LV_STAT NE 'L'.        "수정 가능 상태가 아닐 때만
UPDATE /U4A/T0013 SET TRANF='X' AEUSR=SY-UNAME AEDAT=SY-DATUM AETIM=SY-UZEIT
  WHERE APPID EQ … AND APPVR EQ ….
CHECK SY-SUBRC EQ 0.
COMMIT WORK AND WAIT.
CLEAR CS_APP_INFO-REQNO.
```

- 로컬 패키지(`$TMP`)면 아무것도 안 함
- **조회 호출인데 `/U4A/T0013` 을 UPDATE 하고 `COMMIT WORK AND WAIT` 한다.** init_prc 안에서 유일한 쓰기(조회 분기 기준)
- `_GET_APP_INFO` 가 `TRANF EQ SPACE` 기준으로 넣어 둔 `REQNO` 를 여기서 **비운다**

### 3-5. `_SET_INIT_CHK` → `_CHK_SYNTX_CONTROLLER` (8972·8984행) — `IS_EDIT='X'` 일 때만

`/U4A/CL_WS_COMMON=>CHECK_CLAS_ACTIVE_STATUS( APPID )`:

1. 값이 비면 `8`(Check Error)
2. `SELECT SINGLE CLSID FROM /U4A/T0010 WHERE ( APPID = @v OR CLSID = @v )` — 없으면 `8`
3. `SELECT COUNT(*) FROM DWINACTIV WHERE OBJECT IN ( CINC·CLSD·CPRI·CPRO·CPUB·METH·REPT ) AND OBJ_NAME IN ( <CLSID>, <CLSID 의 빈칸을 `=` 로 바꾼 값>+`*` )`
4. **0건 → `1`(Active)**, 있으면 `0`(Inactive)
5. 돌려받은 값이 `1` 이 아니면 `ACTST = 'I'`

★ `8`(Check Error)도 `1` 이 아니므로 **`ACTST='I'` 로 뭉개진다** — 「class 를 못 찾음」과 「Inactive」가 구분되지 않는다.
주석(v3.6.0-4 2026-03-25 SHHONG): 전에는 controller class 를 풀스캔해 느렸고, 지금은 Active/Inactive 상태만 본다.

### 3-6. ⑩ `S_APP_VMS` 붙이기 (477~502행)

```abap
SELECT SINGLE A~* INTO CORRESPONDING FIELDS OF @LS_APP_INFO_VMS-S_APP_VMS
  FROM /U4A/T_AVM_H AS A WHERE TAPPID EQ @LV_APPID.
IF SY-SUBRC EQ 0.
  MOVE-CORRESPONDING LS_APP_INFO TO LS_APP_INFO_VMS.
  SERIALIZE( DATA = LS_APP_INFO_VMS ) → LV_JSON
ELSE.
  SERIALIZE( DATA = LS_APP_INFO ) → LV_JSON
ENDIF.
```

조건이 **`TAPPID`**(임시 버전 앱 ID) 다 → **지금 연 앱이 임시 버전 앱일 때만** `S_APP_VMS` 가 붙는다.
프론트가 `S_APP_VMS` 있으면 Display 로 강제하는 것(`ws_html5_shell.js:938`)은 **「임시 버전 앱은 편집 못 하게」** 라는 뜻.

---

## 4. 응답 — 칸 전부와 실제 wire type

응답 구조 = `GTY_APP_INFO` (**96~138행**). ⑩에 걸리면 `TY_APP_INFO_VMS`(= 그것 + `S_APP_VMS`).

### 4-1. 테이블에서 그대로 오는 칸

| 출처 | 칸 | DDIC type |
|---|---|---|
| `/U4A/T0010` | `APPID` `APPNM` `APPTY` `CODPG` `ACTST` `PACKG` `CLSID` `LCKFL` `PGMID` `OBJTY` `AUTHG` `UITHM` `WITTY` | CHAR |
| `/U4A/T0010` | `LANGU` | LANG |
| `/U4A/T0010` | `APPVR` | **NUMC(6)** |
| `/U4A/T0013` | `REQNR` | CHAR |
| `/U4A/T0011` | `POSIT` | **NUMC(6)** |
| `/U4A/T0011` | `LAYOI` `LAYDS` `GUINR` | CHAR |
| `/U4A/S0001` INCLUDE | `ERUSR`(CHAR 12) `ERDAT`(**DATS**) `ERTIM`(**TIMS**) `AEUSR`(CHAR 40) `AEDAT`(**DATS**) `AETIM`(**TIMS**) | — |

### 4-2. 로직이 채우는 칸

| 칸 | type | 뜻 | 채우는 자리 |
|---|---|---|---|
| `IS_EDIT` | `C` | Change 모드로 열렸나 | ④ → ⑤가 덮어쓸 수 있음 |
| `IS_CHAG` | `C` | 변경값 존재 여부 | ★ **init_prc 는 안 건드린다** (항상 빈 값) |
| `IS_DEV` | `CCCORACTIV` | `'D'` 개발 서버 / `'X'` 아님 | ④ `CHK_DEVELOPMENT_SERVER` |
| `DEV_KEY` | `DEVACCESS-ACCESSKEY` | `'S4HANA'` 또는 개발자 키 | ④ |
| `REQNO` | `TRKORR` | CTS 번호 | ① / ⑥ 이 비울 수 있음 |
| `RETCD` | `C(1)` | 결과 코드 | ★ **init_prc 는 안 건드린다** |
| `RTMSG` | `STRING` | 결과 메시지 | ★ 같음 |
| `MSGTY` | `C(1)` | `'N'` 없는 앱 · `'E'` 잠금 오류 · 빈 값 정상 | ① · ⑤ |
| `MESSAGE` | `STRING` | 화면에 띄울 문장 | ① · ④ · ⑤ |
| `SESTION_KEY` | `C(60)` | `APPID` + timestamp | ④ |
| `ADMIN_APP` | `C` | `'X'` = ADMIN 만 제어 가능(샘플 앱) | ⑨ |
| `T_UI_DESC` | table of {`OBJID`,`TOOLB`} | UI 오브젝트 설명 | ★ **채우는 자리가 0건** → 항상 빈 배열 |
| `S_APP_VMS` | `/U4A/T_AVM_H` | `APPID` `VPOSN`(NUMC6) `CTSNO` `CTSTX` `PACKG` `TAPPID` `TCLSID` `CLSID` `ERDAT` `ERTIM` `ERUSR` | ⑩ — 임시 버전 앱일 때만 |

### 4-3. JSON 만드는 규칙 (`/U4A/CL_JSON_HANDLE=>SERIALIZE`)

init_prc 는 **인자를 `DATA` 하나만** 넘긴다 → 나머지 기본값:

| 인자 | 기본값 | 결과 |
|---|---|---|
| `COMPRESS` | `ABAP_FALSE` | **빈 칸도 빼지 않는다** → 모든 칸이 JSON 에 있다 |
| `PRETTY_NAME` | `PRETTY_MODE-NONE` | **칸 이름을 대문자 그대로** → 프론트의 `MSGTY`·`IS_EDIT` 와 맞는다 |
| `KEEP_NUMC` | 안 넘김(false) | NUMC 는 **앞 0 을 떼고** 보낸다 |
| `NAME` | 안 넘김 | 바깥을 감싸는 이름 없음 |

type 별 변환:

| ABAP type | JSON |
|---|---|
| `I` · `P` · `F` | 숫자. 빈 값은 `0` |
| **NUMC** | 빈 값은 `0`, 아니면 앞 0 을 떼고 **숫자** → `APPVR` `POSIT` `VPOSN` |
| `STRING` · `CHAR` | `"..."`. 빈 값은 `""` |
| `CHAR(1)` 이면서 type 이 `ABAP_BOOL`/`BOOLEAN`/`BOOLE_D` | `true`/`false` |
| 그 밖의 `CHAR(1)` | **문자열** → `IS_EDIT`·`MSGTY`·`ADMIN_APP`·`LCKFL`·`IS_CHAG`·`RETCD` 전부 여기 |
| **DATS · TIMS** | ★ **8-1 참고 — 못 가렸다** |

그 뒤 `SERIALIZE` 가 전체에서 `CR_LF`→`\r\n`, `NEWLINE`→`\n`, `TAB`→`\t` 치환.
`ESCAPE` 는 `\`→`\\`, `"`→`\"` **2개만** 바꾼다.

### 4-4. 응답을 보내는 방식이 **세 갈래**

| 갈래 | 언제 | header · 본문 |
|---|---|---|
| `_RESPONSE_JSON` (9195행) | **앱이 없을 때(`MSGTY='N'`)만** | `Content-Type: application/json; charset=utf-8` · `cache-control: no-cache` · **`Access-Control-Allow-Origin: *`** · `SET_STATUS 200 OK` · `SET_CDATA`(문자열) |
| `FORM INIT_PRC` 끝 직접 전송 (512~523행) | **정상 조회** | `Content-Type: application/json`(charset **없음**) · `cache-control: no-cache` · CORS header **없음** · `SCMS_STRING_TO_XSTRING` → `SET_DATA`(xstring) |
| 없음 | `EXIT='X'` | **본문 없음** |

★ 같은 endpoint 인데 성공·실패에서 보내는 방식이 다르다(charset 표기 · CORS header 유무 · 문자열/xstring).
Electron 안에서 이 때문에 생기는 문제는 **미확인**.

---

## 5. 프론트(WS4.0)와 짝 맞추기

### 5-1. 공통 함수 1개, 호출 11곳

`ajax_init_prc(oFormData, fn_callback, fn_fail)` = `www/ws30/ws10_20/js/ws_common.js:4117`
→ 첫 줄 `parent.setBusy('X')` → 공통 통신 함수로 `getServerPath() + '/init_prc'`(기본 POST)

| 부르는 곳 | 언제 | 보내는 값 |
|---|---|---|
| `js/ws_html5_shell.js:576` | WS10 App 생성 (현행) | `APPID` |
| `js/ws_events.js:90` | 같은 기능 **옛 UI5 판**(위가 `[OVERRIDE]`) | `APPID` |
| `js/ws_html5_shell.js:904` | WS20 열기 (현행) | `APPID` `ISEDIT` `SSID` |
| `js/ws_fn_02.js:147` | 같은 기능 옛 판 | `APPID` `ISEDIT` `SSID` |
| `js/ws_html5_ws20.js:1694` | WS20 Display→Change (현행) | `APPID` `ISEDIT='X'` |
| `js/ws_fn_02.js:1006` | 같은 기능 옛 판 | `APPID` `ISEDIT='X'` |
| `js/ws_fn_02.js:882` | WS20→WS10 세션 끊기 | `APPID` `SSID` `EXIT='X'` |
| `js/ws_fn_02.js:1231` | 앱 존재 여부만 확인 | `APPID` |
| `js/fnAppCopyPopupOpen.js:487` | 앱 복사 — 대상 이름이 비었나 | `APPID`(복사 대상) |
| `js/usp/ws_html5_usp.js:1874` | USP Display→Change (현행) | `APPID` `ISEDIT='X'` |
| `js/usp/ws_usp.js:7812` | 같은 기능 옛 판 | (미확인 — 옛 판) |

### 5-2. 응답을 읽는 방식

| 프론트 판정 | 자리 | 서버가 넣는 곳 |
|---|---|---|
| `MSGTY == "N"` → 「없는 앱」 | `ws_html5_shell.js:910` | ① |
| `MSGTY == ""` → 「이미 등록된 앱」(생성에서는 실패) | `ws_events.js:94` | 정상 조회 |
| `IS_EDIT === ""` (Change 로 들어왔는데 비었다) | `ws_html5_shell.js:921` | ④ CTS 또는 ⑤ 잠금 |
| `ADMIN_APP === "X"` + 본인 ADMIN 아님 → Display 강제 | `ws_html5_shell.js:933` | ⑨ |
| `S_APP_VMS` 있으면 → Display 강제 | `ws_html5_shell.js:938` | ⑩ |
| `APPTY === "U"` → USP 화면(WS30)으로 | `ws_html5_shell.js:942` | `/U4A/T0010-APPTY` |
| `MESSAGE` → 화면 아래 안내 문장 | `ws_html5_shell.js:915` 등 | 위 메시지들 |

### 5-3. 실제 메시지 문구 (`T100`, 언어 E)

| 번호 | 문구 | 언제 |
|---|---|---|
| 007 | `Application ID & does not exist.` | 없는 앱 (①) |
| 035 | `It is already registered application information.` | 앱 생성인데 이미 있음 (프론트 판정) |
| 047 | `Editing is not possible because CTS is in transit.` | CTS 전송중 (④) |
| 152 | `App &1 is locked by &2.` | 남이 잠금 (⑤) |
| 192 | `Fatal Error! Please contact your system administrator.` | 프론트 JSON parse 실패 |

---

## 6. 이 분기에서 서버가 **건드리는 DB**

| 분기 | 쓰기 |
|---|---|
| 조회 | `/U4A/T0013` UPDATE (`TRANF`·`AEUSR`·`AEDAT`·`AETIM`) + `COMMIT WORK AND WAIT` — ⑥ |
| `EXIT='X'` | `/U4A/T_AVM_H` MODIFY · `/U4A/T0013` MODIFY · `/U4A/T_AVM_D(00)(01)` EXPORT · `COMMIT WORK` 여러 번 — 2-1 |
| `EXIT='X'` + 임시 버전 앱 | `/U4A/T0010`·`/U4A/T0011`·`/U4A/T0013` **DELETE** + cluster 17건 DELETE + `COMMIT WORK` · MIME 폴더 삭제 · class 삭제 — 2-4 |

읽기만 하는 테이블: `/U4A/T0011` `/U4A/T9011` `/U4A/T_EX_ITEM` `E070` `E071` `E07T` `T000` `CVERS` `DEVACCESS` `DWINACTIV` `SEOCLASS` `SEOCLASSDF` `SEOCOMPO` `SEOCOMPODF` `SEOMETAREL`

---

## 7. ★ 눈에 띈 것 (보고만 · 아무것도 고치지 않았다)

| # | 무엇 | 자리 |
|---|---|---|
| 1 | **죽은 SELECT** — `/U4A/T9011` 에서 라이브러리 버전(`FLD07`)을 읽는데, 쓰던 자리(346~348행)가 주석 처리돼 **값을 아무데도 안 쓴다**. 요청마다 쓸데없는 조회 1건 | 450~456행 |
| 2 | 조회 호출인데 `/U4A/T0013` 을 **UPDATE + `COMMIT WORK AND WAIT`** 한다 | 13358행 |
| 3 | 화면 나가는 길목에 **최대 60초 대기 + 앱 데이터·ABAP 소스 내보내기 + DB 쓰기**가 들어 있다 | 2-1 |
| 4 | `COLLECT_UNVERSION_DATA` · `_REMOVE_TEMP_VER_APP` 를 **결과를 안 받고** 부른다 → 실패가 흔적 없이 사라진다 | 320행 · 334행 |
| 5 | 화면을 나가는 것만으로 **앱 데이터가 통째로 DELETE 되는 경로**가 있다(조건 = `TAPPID` 일치) | 2-4 |
| 6 | `LOCK_READ` 가 `GUNAME=SPACE` → **자기 잠금도 「남이 잠금」으로 잡힌다** | 6740행 |
| 7 | `LOCK_WORKBANCH` 실패를 안 보고 **무조건 「잠갔다·편집 가능」으로 응답**한다 | 8922행 |
| 8 | `CHECK_CLAS_ACTIVE_STATUS` 의 `8`(Check Error)이 `0`(Inactive)와 **같이 뭉개진다** | 8984행 |
| 9 | `_GET_APP_INFO` 가 `INNER JOIN` 이라 **`/U4A/T0011` 행이 없어도 「앱 있음」** 으로 보고 layout 칸을 빈 값으로 보낸다 | 8655행 |
| 10 | CTS 상태 `'R'`(Released) 는 막는 목록(`L`·`O`·`N`)에 **없다** — 상위 request 가 없으면 Change 가 허용된다 | 8733행 |
| 11 | `T_UI_DESC`·`IS_CHAG`·`RETCD`·`RTMSG` 는 응답 구조에 있는데 **init_prc 가 채우지 않는다** | 4-2 |
| 12 | 임시 이름 만들기(앱 ID · class 이름)가 100번 다 실패하면 **빈 값을 돌려주고 아무것도 알리지 않는다** | 2-2 |
| 13 | `EXIT` 분기가 **대문자 변환보다 먼저** 있다 — 소문자 `APPID` 로 들어오면 그 값으로 세션 삭제·`TAPPID` 조회가 돈다 | 303행 vs 346행 |
| 14 | 성공·실패의 응답 header 가 다르다(charset · CORS) | 4-4 |

---

## 8. ★ 못 가린 것 (미확인)

### 8-1. DATS · TIMS 가 JSON 에서 따옴표가 붙는지 **못 가렸다**

- `DUMP_TYPE` **메소드**는 `WHEN typekind_date OR typekind_time. MOVE data TO r_json.` — **따옴표 없이** 낸다.
  이 모양이면 `"ERTIM":091530`(앞 0) · `"AEDAT":00000000` 은 **JSON 문법 위반**이고 프론트 `JSON.parse` 가 터진다.
- 그런데 **실제로 쓰이는 것은 메소드가 아니라 같은 이름의 macro** 다 —
  `DUMP` 안에서 `dump_type data l_elem_descr r_json KEEP_NUMC.` 로 부른다(주석: 성능 때문에 macro 로 뒀다).
- macro 는 `/U4A/CL_JSON_HANDLE===========CCMAC` 에 있고(`REPOSRC` 조회로 **존재 확인**),
  **지금 도구로는 소스를 못 읽는다**:
  - `sap_adt_get_source` 는 URI 뒤에 `/source/<include>` 를 붙이는 구조라 `/includes/macros` 로 못 간다(`404`)
  - `/sap/bc/adt/programs/includes/…CCMAC` → `500` + `Resource PROGRAM … could not be successfully read.`
- **반대 근거**: 프론트 포맷터가 `s === "00000000"`(문자열)로 비교한다
  (`www/ws30/ws10_20/js/fnAppF4PopupOpen.js:110`, `:115`) → macro 는 따옴표를 붙일 가능성이 높다. 정황이고 소스 확인은 아니다.
- 실측 참고: `/U4A/T0010` **7020건 중 `AEDAT='00000000'` 인 행이 1187건** — 빈 날짜가 실제로 흔하다.
- **가리는 방법**: ① SE24/SE80 에서 그 class 의 Macros include 를 직접 열어 `DEFINE dump_type` 을 본다
  ② WS20 진입 때 실제 응답 본문을 한 번 캡처한다

### 8-2. 그 밖의 미확인

| # | 무엇 | 왜 못 가렸나 |
|---|---|---|
| 1 | 같은 사용자가 창 두 개로 같은 앱을 Change 로 열면 「남이 잠금」이 뜨는지 | 소스는 확인, 재현은 앱 실행 필요 |
| 2 | 60초 대기가 실제로 걸리는 빈도 | CTS 상황·앱 실행 필요 |
| 3 | 프론트가 `APPID` 를 늘 대문자로 보내는지(7절 13번 관련) | 호출 11곳 입력값 추적 안 했다 |
| 4 | 성공·실패 응답 header 차이가 문제를 일으키는지 | Electron 동작 확인 필요 |
| 5 | `/U4A/CL_WB_COMMON=>APP_EXPORT_API` 내부 | 읽지 않았다(EXIT 분기 안쪽 한 단계 더) |
| 6 | `/U4A/CL_ETC_UTILITIES=>DEL_CLS_CVA` 내부 | 읽지 않았다 |

---

## 9. 재현 명령

```powershell
$S = "C:\Users\socce\.claude\skills\yoon-sap-adt\yoon-sap-adt.ps1"

# 실제 로직 프로그램 (FORM INIT_PRC 245~525행)
& $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/programs/programs/%2fu4a%2fws000001"

# 하위 클래스
& $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/oo/classes/%2fu4a%2fcl_wb_common"
& $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/oo/classes/%2fu4a%2fcl_ws_common"
& $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/oo/classes/%2fu4a%2fcl_vms_api"
& $S call --as UHA sap_adt_get_source "object_uri=/sap/bc/adt/oo/classes/%2fu4a%2fcl_json_handle"
```

DDIC·메시지는 `sap_adt_data_preview` 에 `--file <json>` 으로 질의했다
(`dd03l` 로 칸 type, `t100` 으로 메시지 문구, `reposrc` 로 class include 목록, `/u4a/t0010` 으로 빈 날짜 건수).

### 도구 쪽 걸림돌 (★ 보고만)

| 무엇 | 증상 |
|---|---|
| `sap_adt_get_class_source` · `sap_adt_get_program_source` 가 namespace 객체에 안 된다 | 이름의 `/` 를 안 바꿔 `404`. `sap_adt_get_source` 에 `%2f` URI 를 주면 된다 |
| `sap_adt_get_package_contents` 가 안 된다 | `406 Not Acceptable` (`application/vnd.sap.as+xml` 요구) |
| `sap_adt_get_table_definition` 이 namespace 구조에 안 된다 | `404`. `dd03l` 직접 조회로 우회 |
| class 의 macro·local 정의 include 를 못 읽는다 | `include=` 가 `/source/<이름>` 만 붙여 `/includes/macros` 에 못 간다 (8-1) |
| Git Bash 로 부르면 `/U4A/WS` 같은 인자가 Windows 경로로 바뀐다 | PowerShell 로 부른다 |
