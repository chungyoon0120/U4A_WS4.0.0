# init_prc 백엔드 전체 근거 (보관용)

> 2026-10-13. 조사 결론은 `.works/서버호출경로조사/00_현황판.md` 의 「끝난 경로」 절에 한 덩어리로 있다.
> 이 파일은 그 **긴 근거**를 보관한 것이다 — 원래 `.works` 폴더에 md 3개로 흩어져 있었고,
> 「문서가 산재돼 정신없다」(장군님 지시 2026-10-13) 로 작업 폴더에서 치워 여기로 옮겼다.

## 판정

**init_prc = 문제 없다.** 서버가 주는 모양 전부를 프론트가 가린다.



---

# [원래 파일] 03_init_prc_백엔드_분석.md

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


---

# [원래 파일] 05_init_prc_응답케이스_전체.md

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


---

# [원래 파일] 06_init_prc_예외발생가능자리.md

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


---

## 41~43번 상세 — 서버(SAP ABAP) 쪽이라 고치지 않은 것

> `init_prc`(앱 열기·창 닫기 때 서버에 처음 다녀오는 자리) 를 끝까지 읽은 결과다.
> **판정 = 문제 없음**(2026-10-13 닫음). 아래 3건은 터지지는 않지만 눈에 띈 것이고, **코드는 한 글자도 안 고쳤다.**

**41. 안내 문구가 어긋난다** — 서버에서 예외가 나면 「이 서버는 그 기능을 지원하지 않습니다」가 뜬다.
원래 「부르려는 기능이 서버에 없다」는 뜻인데, 기능은 있고 그 안에서 터진 경우에도 같은 문구가 뜬다.
그 서브루틴에 `TRY`·`CATCH` 가 0개라 예외가 바깥 공통 자리까지 올라가고, 거기 문구가 하나뿐이다.
처리 자체는 괜찮다(처리중 표시 풀림 · 기록 남음 · 오류창 정상). **문구만** 어긋난다.

**42. 창 닫을 때 최대 약 120초** — 버전 모으기·임시 앱 지우기 안에 기다리는 자리가 두 군데(각 최대 60초).
통신 제한이 600초라 끊기지는 않지만 그동안 처리중 표시가 켜져 있어 조작을 못 한다.
**더 나쁜 것**: 그 작업의 성공·실패를 받는 자리가 없어 실패해도 화면·기록에 아무것도 안 남는다.
→ **실제로 몇 초 걸리는지 재 보는 것은 앱 쪽에서 가능하다**(나가는 시각·돌아온 시각 기록).

**43. 고객 시스템 `Z` class 3개 의존** — 창 닫을 때 도는 코드가 class·method 이름을 글자로 적어 부르고,
그중 3곳이 U4A 소유가 아닌 고객 시스템 쪽 class 다. 없거나 inactive 면 창 닫을 때마다 오류창(41번 문구로).
UHA 는 3개 다 있고 active 이며 method·인자 이름까지 호출과 맞는 것을 확인했다.
→ 고객사 설치 점검 항목으로 쓰는 것이 맞다고 본다.
