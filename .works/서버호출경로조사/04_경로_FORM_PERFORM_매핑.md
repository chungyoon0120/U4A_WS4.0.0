# 경로 이름 = 서브루틴(FORM) 이름 — 전체 매핑표

> ★ **줄번호 기준 = SAP 실제 소스 줄번호(빈 줄 포함)** — 2026-10-13 전면 재확인·정정.
> (앞 판은 소스를 저장할 때 빈 줄을 지우고 번호를 다시 세어 전부 어긋나 있었다. 장군님 지적으로 바로잡음)
> 조사 시각 **2026-10-12** · 재확인 **2026-10-13** · 조회 시스템 = **UHA** (`https://uha.u4aide.com:10101`, client 800)
> SAP ADT 로 실제 ABAP 소스를 읽어 확인. 추측 0건. **소스는 한 글자도 고치지 않았다.**

## 0. 확인된 규칙 (장군님 지적대로)

```
POST {host}/zu4a_wbc/u4a_ipcmain/<이름>
  → /U4A/CL_HTTP_SERVER_WBC  HANDLE_REQUEST
       ~path_info 첫 토막을 대문자로 → L_ROUTNM (CHAR 30)
  → PERFORM (L_ROUTNM) IN PROGRAM /U4A/WS_ROOT USING SERVER        ← 1차
  → PERFORM (L_ROUTNM) IN PROGRAM /U4A/WS_ROOT USING SERVER ME     ← 1차 실패 시 2차
  → /U4A/WS_ROOT 의 FORM <이름>  = 껍데기 한 줄
  → PERFORM <이름> IN PROGRAM /U4A/WS0000NN USING IO_SERVER        ← 실제 로직
```

- **경로 이름 = `/U4A/WS_ROOT` 의 `FORM` 이름** 그대로다 (대소문자 무관 — 서버가 대문자로 바꿈)
- `/U4A/WS_ROOT` 는 **라우팅만 한다** — `FORM` 73개가 모두 `PERFORM` 한 줄씩이고,
  실제 로직은 `/U4A/WS000001` ~ `/U4A/WS000012` 로 넘긴다
- `/U4A/WS_ROOT` 의 `FORM` = **73개**, 프론트(WS4.0)가 부르는 이름 = **69개**

---

## 1. 전체 매핑 — 경로 / WS_ROOT FORM / 실제 로직 프로그램

> `WS_ROOT 행` = `/U4A/WS_ROOT` 안에서 그 `PERFORM` 이 있는 줄 번호(빈 줄 제거 기준)
> `인자` = `IO_SERVER` 만이면 1, `IO_HANDLE`(handler 객체)까지 받으면 2

| 경로 이름 | → 실제 로직 프로그램 | PERFORM 하는 FORM 이름 | WS_ROOT FORM 행 | PERFORM 행 | 인자 | 비고 |
|---|---|---|---:|---:|:---:|---|
| `about_u4aide` | /U4A/WS000004 | ABOUT_U4AIDE | 246 | 248 | 1 |  |
| `app_copy` | /U4A/WS000002 | APP_COPY | 284 | 287 | 1 |  |
| `app_delte` | /U4A/WS000002 | APP_DELTE | 295 | 298 | 1 |  |
| `app_export_import` | /U4A/WS000005 | APP_EXPORT_IMPORT | 227 | 229 | 1 |  |
| `app_shortcutdown` | /U4A/WS000005 | APP_SHORTCUTDOWN | 218 | 220 | 1 |  |
| `chk_customer_license` | /U4A/WS000005 | CHK_CUSTOMER_LICENSE | 200 | 202 | 1 |  |
| `chk_manager` | /U4A/WS000006 | CHK_MANAGER | 155 | 157 | 1 |  |
| `chk_mlogin_of_gui` | /U4A/WS000006 | _CHK_MLOGIN_OF_GUI | 111 | 113 | 1 |  |
| `chk_u4a_authority` | /U4A/WS000005 | CHK_U4A_AUTHORITY | 236 | 238 | 1 |  |
| `chk_ws_syntx` | /U4A/WS000002 | CHK_WS_SYNTX | 307 | 311 | 1 |  |
| `chkconvexit` | /U4A/WS000001 | CHKCONVEXIT | 423 | 425 | 1 |  |
| `chkpackage` | /U4A/WS000001 | CHKPACKAGE | 559 | 561 | 1 |  |
| `compare_app_ctrl_abap` | /U4A/WS000007 | COMPARE_APP_CTRL_ABAP | 681 | 683 | 1 | IF FOUND |
| `control_class` | /U4A/WS000002 | CONTROL_CLASS | 358 | 360 | 1 |  |
| `create_temp_ver_app` | /U4A/WS000007 | CREATE_TEMP_VER_APP | 671 | 673 | 1 | IF FOUND |
| `createappdata` | /U4A/WS000001 | CREATEAPPDATA | 376 | 378 | 1 |  |
| `createeventmethod` | /U4A/WS000001 | CREATEEVENTMETHOD | 441 | 443 | 1 |  |
| `dev_browser_agent` | /U4A/WS0000012 | DEV_BROWSER_AGENT | 701 | 703 | 1 | IF FOUND |
| `dummycall` | /U4A/WS000002 | DUMMYCALL | 541 | 543 | 1 |  |
| `external_open` | /U4A/WS000002 | EXTERNAL_OPEN | 460 | 462 | 1 |  |
| `f4serverdata` | /U4A/WS000001 | F4SERVERDATA | 550 | 552 | 1 |  |
| `get_app_ver_list` | /U4A/WS000007 | GET_APP_VER_LIST | 661 | 663 | 1 | IF FOUND |
| `get_bind_fld_postion` | /U4A/WS000003 | GET_BIND_FLD_POSTION | 255 | 257 | 1 |  |
| `get_mime_children` | /U4A/WS000002 | GET_MIME_CHILDREN | 478 | 480 | 1 |  |
| `get_shortcut_appinfo` | /U4A/WS000005 | GET_SHORTCUT_APPINFO | 209 | 211 | 1 |  |
| `get_supported_theme` | /U4A/WS000007 | GET_SUPPORTED_THEME | 651 | 653 | 1 | IF FOUND |
| `get_ws_init_setup` | /U4A/WS000006 | GET_WS_INIT_SETUP | 604 | 606 | 1 |  |
| `get_ws_release_data` | /U4A/WS000006 | GET_WS_RELEASE_DATA | 164 | 166 | 1 |  |
| `getappdata` | /U4A/WS000001 | GETAPPDATA | 523 | 525 | 1 |  |
| `getapplhierarchydata` | /U4A/WS000002 | GETAPPLHIERARCHYDATA | 450 | 452 | 1 |  |
| `getappsearch` | /U4A/WS000001 | GETAPPSEARCH | 349 | 351 | 1 |  |
| `getbindattrdata` | /U4A/WS000001 | GETBINDATTRDATA | 404 | 406 | 1 |  |
| `getctsdata` | /U4A/WS000002 | GETCTSDATA | 505 | 507 | 1 |  |
| `getdatasetsearchlist` | /U4A/WS000011 | GETDATASETSEARCHLIST | 631 | 633 | 1 |  |
| `getdynlist` | /U4A/WS000003 | GETDYNLIST | 595 | 597 | 1 |  |
| `getlibdata` | /U4A/WS000001 | GETLIBDATA | 514 | 516 | 1 |  |
| `getlibnappdata` | /U4A/WS000001 | GETLIBNAPPDATA | 340 | 342 | 1 |  |
| `getlibsampleinfo` | /U4A/WS000004 | GETLIBSAMPLEINFO | 613 | 615 | 1 |  |
| `getmimeobj` | /U4A/WS000002 | GETMIMEOBJ | 496 | 498 | 1 |  |
| `getmimetree` | /U4A/WS000002 | GETMIMETREE | 469 | 471 | 1 |  |
| `getotrtext` | /U4A/WS000003 | GETOTRTEXT | 568 | 570 | 1 |  |
| `getotrtextsalias` | /U4A/WS000004 | GETOTRTEXTSALIAS | 622 | 624 | 1 |  |
| `getp13npreviewhtml` | /U4A/WS000007 | GETP13NPREVIEWHTML | 640 | 642 | 1 |  |
| `getprevhtml` | /U4A/WS000001 | GETPREVHTML | 532 | 534 | 1 |  |
| `getservereventlist` | /U4A/WS000001 | GETSERVEREVENTLIST | 432 | 434 | 1 |  |
| `getui5_pre_css` | /U4A/WS000008 | GETUI5_PRE_CSS | 120 | 122 | 1 |  |
| `getui5_pre_css_v2` | /U4A/WS000008 | GETUI5_PRE_CSS_V2 | 130 | 132 | 1 |  |
| `init_prc` | /U4A/WS000001 | INIT_PRC | 320 | 323 | 1 |  |
| `kill_session` | /U4A/WS000002 | KILL_SESSION | 413 | 416 | 2 |  |
| `logoff` | /U4A/WS000002 | LOGOFF | 395 | 397 | 1 |  |
| `package_change` | /U4A/WS000004 | PACKAGE_CHANGE | 577 | 579 | 1 |  |
| `ping_check` | /U4A/WS000006 | PING_CHECK | 146 | 148 | 1 |  |
| `release_data_upload` | /U4A/WS000006 | RELEASE_DATA_UPLOAD | 191 | 193 | 1 |  |
| `save_active_appdata` | /U4A/WS000001 | SAVE_ACTIVE_APPDATA | 367 | 369 | 1 |  |
| `set_mime_crud` | /U4A/WS000002 | SET_MIME_CRUD | 487 | 489 | 1 |  |
| `set_sys_noti_message` | /U4A/WS000007 | SET_SYS_NOTI_MESSAGE | 691 | 693 | 1 | IF FOUND |
| `u4a_app_doc` | /U4A/WS000003 | U4A_APP_DOC | 264 | 266 | 1 |  |
| `u4a_help_doc_ws30` | /U4A/WS000007 | U4A_HELP_DOC_WS30 | 53 | 54 | 1 |  |
| `ui_temp_wzd` | /U4A/WS000003 | UI_TEMP_WZD | 274 | 277 | 1 |  |
| `uiwhereuselist` | /U4A/WS000003 | UIWHEREUSELIST | 586 | 588 | 1 |  |
| `unlock_app` | /U4A/WS000001 | UNLOCK_APP | 386 | 388 | 1 |  |
| `update_check` | /U4A/WS000006 | UPDATE_CHECK | 182 | 184 | 1 |  |
| `usp_app_delete` | /U4A/WS000009 | USP_APP_DELETE | 60 | 61 | 1 |  |
| `usp_createappdata` | /U4A/WS000009 | USP_CREATEAPPDATA | 95 | 96 | 1 |  |
| `usp_get_file_data` | /U4A/WS000009 | USP_GET_FILE_DATA | 74 | 75 | 1 |  |
| `usp_get_object_line_data` | /U4A/WS000009 | USP_GET_OBJECT_CONTENT_DATA | 88 | 89 | 1 |  |
| `usp_init_prc` | /U4A/WS000009 | USP_INIT_PRC | 102 | 104 | 2 |  |
| `usp_page_del` | /U4A/WS000009 | USP_PAGE_DEL | 67 | 68 | 1 |  |
| `usp_save_active_appdata` | /U4A/WS000009 | USP_SAVE_ACTIVE_APPDATA | 81 | 82 | 1 |  |
| `wiz_sapgui_prg_scr_to_ui5` | /U4A/WS000007 | WIZ_SAPGUI_PRG_SCR_TO_UI5 | 139 | 140 | 1 |  |
| `ws_support_patch` | /U4A/WS000008 | WS_SUPPORT_PATCH | 45 | 46 | 1 |  |
| `ws_update_file_get` | /U4A/WS000006 | WS_UPDATE_FILE_GET | 173 | 175 | 1 |  |
| `wsloginchk` | /U4A/WS000001 | WSLOGINCHK | 331 | 333 | 1 |  |

---

## 2. WS_ROOT 를 **안 타는** 경로 3종 (이건 FORM 이름이 아니다)

| 경로 | 어디서 처리 | 어떻게 |
|---|---|---|
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/<이름>` | `/U4A/CL_HTTP_SERVER_WBC` 의 `U4A_CVT_WDR` 메소드 | URL 에 `u4a_cvt_wdr` 가 있으면 가로채서, `~path_info` **두 번째** 토막을 FORM 이름으로 `PERFORM (…) IN PROGRAM ('YYUAWDR1000')` (실제로 있는 프로그램 — `[UAWD] WS 3.0 Web Dynpro Conversion Root Service`, package `YYU4A_CVT_WDR`). 없으면 `u4a_status='UA0001'` + 메시지 396 |
| `/zu4a_wbc/u4a_ipcmain/icon_exp` | 같은 클래스의 `U4A_ICON_EXP` 메소드 | `PERFORM SET_HTML_FOR_ICON_EXP_RTN IN PROGRAM /U4A/SP400001 … IF FOUND` → HTML 반환 |
| `/zu4a_wbc/u4a_ipcmain/ui5_help` | 같은 클래스의 `UI5_HELP_EXP` 메소드 | `PERFORM SET_HTML_FOR_UI5_HELP_RTN IN PROGRAM /U4A/SP400001 … IF FOUND` → HTML 반환 |

※ `U4A_ICON_EXP` · `UI5_HELP_EXP` 메소드는 클래스에 **정의되어 있지만 `HANDLE_REQUEST` 에서 부르는 줄이 없다**(소스 확인). 즉 지금은 안 불린다.
프론트는 아이콘 내보내기를 `{host}/zu4a_acs/icon_exp`(**다른 서비스** `ZU4A_ACS`)로 부른다 — `www/ws30/ws10_20/js/fnDialogPopupOpener.js:2951`.

---

## 3. ★ 서버-프론트 어긋남 (보고만 · 아무것도 고치지 않았다)

### 3-1. 프론트가 부르는데 **서버에 FORM 이 없다** (2건)

| 경로 | 프론트 자리 | 결과 |
|---|---|---|
| `test_lee` | `www/ws30/ws10_20/js/ws_fn_01.js:2062` | `/U4A/WS_ROOT` 에 `FORM TEST_LEE` 없음 → 1차·2차 PERFORM 모두 실패 → 응답 header `u4a_status='UA0001'` + 메시지 298(이 서버는 그 기능을 지원하지 않습니다) |
| `ttt` | `www/ws30/ws10_20/js/ws_fn_test.js:72` | 같음 |

→ 둘 다 **눌리면 반드시 오류가 나는 경로**다. (프론트에서 실제로 눌릴 수 있는 자리인지는 **미확인**)

### 3-2. 서버에 FORM 은 있는데 **프론트가 안 부른다** (12건)

`about_u4aide` · `app_shortcutdown` · `chk_manager` · `control_class` · `createappdata` ·
`dev_browser_agent` · `get_ws_init_setup` · `getctsdata` · `getlibnappdata` ·
`release_data_upload` · `usp_createappdata` · `wiz_sapgui_prg_scr_to_ui5`

→ 변환이 안 된 기능인지, 원래 안 쓰는 것인지 **미확인**. WS3.0 원본 폴더를 봐야 가린다.

### 3-3. 서버 쪽에서 보이는 것

| # | 무엇 | 근거 |
|---|---|---|
| 1 | **프로그램 이름 오타** — `dev_browser_agent` 가 `'/U4A/WS0000012'` 를 가리킨다. 실제 프로그램은 `/U4A/WS000012` (`0` 하나 많다). ADT 로 목록 확인: `/U4A/WS000001`~`/U4A/WS000012` 만 존재 | `/U4A/WS_ROOT` 703행 |
| 2 | 1번의 **실제 동작은 미확인** — `IF FOUND` 가 붙어 있어 조용히 넘어갈지, 프로그램 로드 오류로 터질지는 돌려 봐야 안다. 프론트가 이 경로를 안 부르므로 지금 증상은 없다 |  |
| 3 | 경로와 **FORM 이름이 다른 자리 2곳** — `chk_mlogin_of_gui` → `_CHK_MLOGIN_OF_GUI`(앞에 밑줄), `usp_get_object_line_data` → `USP_GET_OBJECT_CONTENT_DATA` | `/U4A/WS_ROOT` 113행 · 89행 |
| 4 | **인자 2개를 받는 FORM 은 3개뿐** — `init_prc` · `kill_session` · `usp_init_prc`. 이 3개만 1차 PERFORM 이 실패하고 2차로 다시 불린다(요청마다 예외 1회) | `/U4A/WS_ROOT` 323행 · 416행 · 104행 |
| 5 | `IF FOUND` 가 붙은 FORM 7개는 **그 프로그램에 FORM 이 없어도 조용히 지나간다** — `get_supported_theme` · `get_app_ver_list` · `create_temp_ver_app` · `compare_app_ctrl_abap` · `set_sys_noti_message` · `dev_browser_agent` · (그리고 아이콘·도움말 HTML 2곳) | 642~703행 |
| 6 | 라우팅 이름은 **30자까지** (`L_ROUTNM` 이 `CHAR(30)`). 지금 가장 긴 이름 `wiz_sapgui_prg_scr_to_ui5`(25) · `usp_get_object_line_data`(24) 는 아직 여유 있다 | `/U4A/CL_HTTP_SERVER_WBC` |

---

## 4. 실제 로직 프로그램이 무엇을 담당하나 (경로 분포)

| 프로그램 | 담당하는 경로 수 | 주로 |
|---|:---:|---|
| /U4A/WS000001 | 17 | 앱 데이터 본체 (init_prc · getAppData · getLibData · 저장 · 로그인 점검 · F4) |
| /U4A/WS000002 | 15 | 앱 복사·삭제 · logoff · kill_session · MIME · CTS · 외부 열기 |
| /U4A/WS000009 | 7 | USP (소스 패턴) |
| /U4A/WS000007 | 7 | 버전 관리 · 개인화 미리보기 · 공지 · 도움말 문서 |
| /U4A/WS000006 | 7 | 업데이트 · 릴리즈 데이터 · ping |
| /U4A/WS000005 | 5 | 라이선스 · 권한 · 숏컷 · 가져오기/내보내기 |
| /U4A/WS000003 | 5 | 바인딩 위치 · 기술 문서 · UI 템플릿 · OTR · where-used |
| /U4A/WS000004 | 4 | 패키지 변경 · 샘플 정보 · OTR alias · about |
| /U4A/WS000008 | 3 | UI5 미리 정의 CSS · 패치 점검 |
| /U4A/WS000011 | 1 | DataSet 필드 목록 |
| /U4A/WS000012 | 1 | (dev_browser_agent — 위 오타로 연결 안 됨) |
| /U4A/WS000010 | 0 | **WS_ROOT 에서 부르는 자리가 없다** (다른 데서 쓰는지 미확인) |
| YYUAWDR1000 | 6 | WebDynpro 변환 (클래스가 따로 가로챔) |

---

## 5. 재현 명령

```powershell
# WS_ROOT 전체 (라우팅 표)
& "C:\Users\socce\.claude\skills\yoon-sap-adt\yoon-sap-adt.ps1" call --as UHA `
  sap_adt_get_source "object_uri=/sap/bc/adt/programs/programs/%2fu4a%2fws_root"

# 실제 로직 프로그램 (NN = 01~12)
& "...\yoon-sap-adt.ps1" call --as UHA `
  sap_adt_get_source "object_uri=/sap/bc/adt/programs/programs/%2fu4a%2fws0000NN"
```
