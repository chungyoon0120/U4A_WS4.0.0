# `/zu4a_wbc` 로 시작하는 경로 — 전체

> 조사 시각 **2026-10-12** · 전부 소스에서 직접 확인(추측 0건)
> 범위 = 작업 폴더 `U4A_WS4.0.0` 안 실행되는 소스 (`_` 로 시작하는 폴더·파일, `node_modules`, 외부 라이브러리 제외)

## 서비스는 2개뿐

| 서비스 경로 | 만드는 자리 | 지금 쓰나 |
|---|---|---|
| `/zu4a_wbc/u4a_ipcmain` | `www/ws30/resources/index.js:404` — `getServerPath()` 기본값 | **쓴다** (아래 전부) |
| `/zu4a_wbc/u4a_dynpro` | `www/ws30/resources/index.js:407` — `getServerPath(true)` | **안 쓴다** — `getServerPath(true)` 로 부르는 자리가 소스에 0건 |

→ 즉 `/zu4a_wbc` 로 나가는 실제 경로는 **전부 `/zu4a_wbc/u4a_ipcmain/<이름>`** 이다.

---

## 전체 목록 — `/zu4a_wbc/u4a_ipcmain/…` (**69개**)

> 세는 기준(장군님 지시 2026-10-12): **대소문자는 구분하지 않는다 — 같은 경로로 본다.**
> 그래서 `INIT_PRC` 와 `init_prc` 는 **1개**로 센다 (소스에는 두 모양이 다 있다).

### 로그인 · 세션 · 권한 (9)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/wsloginchk` | `www/ws30/ws10_20/Login/Login.js:865` |
| `/zu4a_wbc/u4a_ipcmain/chk_u4a_authority` | `Login/Login.js:1165` |
| `/zu4a_wbc/u4a_ipcmain/chk_customer_license` | `Login/Login.js:1248` |
| `/zu4a_wbc/u4a_ipcmain/chk_mlogin_of_gui` | `js/ws_fn_04.js:31` |
| `/zu4a_wbc/u4a_ipcmain/logoff` | `js/ws_events.js:1217`, `:2699` |
| `/zu4a_wbc/u4a_ipcmain/kill_session` | `js/ws_common.js:4090`, `js/ws_main.js:403`, `js/ws_main copy.js:247` |
| `/zu4a_wbc/u4a_ipcmain/dummycall` | `js/fnServerSession.js:16` (10분마다 Worker 가 POST) |
| `/zu4a_wbc/u4a_ipcmain/ping_check` | `js/ws_common.js:2635` |
| `/zu4a_wbc/u4a_ipcmain/set_sys_noti_message` | `js/ws_common.js:32` |

### 앱 데이터 (12)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/INIT_PRC` | `www/ws30/resources/index.js:586` |
| `/zu4a_wbc/u4a_ipcmain/init_prc` | `js/ws_common.js:4121` |
| `/zu4a_wbc/u4a_ipcmain/getAppData` | `design/js/main.js:435`, `js/ws_html5_ws20_data.js:188` |
| `/zu4a_wbc/u4a_ipcmain/getLibData` | `design/js/main.js:653`, `js/ws_html5_ws20_attr.js:2286` |
| `/zu4a_wbc/u4a_ipcmain/getLibSampleInfo` | `design/js/uiAttributeArea.js:9519`, `js/ws_html5_ws20_attr.js:5121` |
| `/zu4a_wbc/u4a_ipcmain/save_active_appdata` | `js/ws_events.js:1802`, `:2198` |
| `/zu4a_wbc/u4a_ipcmain/unlock_app` | `js/ws_common.js:5069` |
| `/zu4a_wbc/u4a_ipcmain/app_copy` | `js/fnAppCopyPopupOpen.js:270` |
| `/zu4a_wbc/u4a_ipcmain/app_delte` | `js/ws_events.js:313` (서버 쪽 이름 오타 그대로) |
| `/zu4a_wbc/u4a_ipcmain/package_change` | `design/js/changeAppPackagePopup.js:439`, `:530` |
| `/zu4a_wbc/u4a_ipcmain/chkPackage` | `design/js/createApplicationPopup.js:940`, `design/createApplication/conversionWebdynpro/main/control.js:613` |
| `/zu4a_wbc/u4a_ipcmain/chk_ws_syntx` | `js/ws_events.js:1415` |

### 속성 · 바인딩 · 이벤트 (9)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/getBindAttrData` | `Popups/bindPopup/index.js:8095`, `Popups/bindPopup/modelFieldArea/modelFieldArea.js:385`, `design/js/callBindPopup.js:260`, `js/fnBindPopupOpen.js:781`, `js/ws_fn_03.js:349` |
| `/zu4a_wbc/u4a_ipcmain/chkConvExit` | `Popups/bindPopup/additInfoArea/additInfoArea.js:427`, `Popups/bindPopup/index.js:5315`, `design/js/callBindPopup.js:934`, `js/fnBindPopupOpen.js:1490` |
| `/zu4a_wbc/u4a_ipcmain/get_bind_fld_postion` | `design/js/uiAttributeArea.js:3105` |
| `/zu4a_wbc/u4a_ipcmain/getServerEventList` | `design/js/uiAttributeArea.js:7147`, `js/ws_html5_ws20_attr.js:660` |
| `/zu4a_wbc/u4a_ipcmain/createEventMethod` | `design/js/createEventPopup.js:292` |
| `/zu4a_wbc/u4a_ipcmain/getDynList` | `design/js/callDynListPopup.js:103`, `js/fnDynListPopup.js:186` |
| `/zu4a_wbc/u4a_ipcmain/uiWhereUseList` | `design/js/callUiWhereUsePopup.js:116` |
| `/zu4a_wbc/u4a_ipcmain/getDataSetSearchList` | `design/js/callDataSetFieldListPopop.js:101` |
| `/zu4a_wbc/u4a_ipcmain/ui_temp_wzd` | `design/js/designCallWizardPopup.js:73`, `js/fnUiTempWizardPopupOpen.js:1172`, `js/ws_html5_ws20_wizard.js:65` |

### 값 도움(F4) · OTR · 앱 검색 (6)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/f4serverData` | `Popups/OTRF4HelpPopup/index.js:473`, `:534`, `design/js/callF4HelpPopup.js:219`, `:300`, `js/fnF4SearchHelpPopup.js:274`, `:307` |
| `/zu4a_wbc/u4a_ipcmain/getOTRText` | `design/js/uiPreviewArea.js:1265` |
| `/zu4a_wbc/u4a_ipcmain/getOTRTextsAlias` | `design/js/callDesignContextMenu.js:1070`, `design/js/uiDesignArea.js:6446`, `js/ws_html5_ws20_dnd.js:1103` |
| `/zu4a_wbc/u4a_ipcmain/getappsearch` | `js/fnAppF4PopupOpen.js:692`, `js/moduleAppF4Popup.js:933` |
| `/zu4a_wbc/u4a_ipcmain/getapplhierarchydata` | `js/fnAppF4PopupOpen.js:1082`, `js/moduleAppF4Popup.js:760` |
| `/zu4a_wbc/u4a_ipcmain/get_supported_theme` | `Popups/iconPrevPopup/runtime.js:915` |

### MIME 리포지토리 (4)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/getmimetree` | `Popups/mimeRepository/mime.js:353`, `js/fnMimePopupOpen.js:246` |
| `/zu4a_wbc/u4a_ipcmain/get_mime_children` | `Popups/mimeRepository/mime.js:465`, `js/fnMimePopupOpen.js:346` |
| `/zu4a_wbc/u4a_ipcmain/getmimeobj` | `Popups/mimeRepository/mime.js:670`, `js/fnMimePopupOpen.js:535` |
| `/zu4a_wbc/u4a_ipcmain/set_mime_crud` | `Popups/mimeRepository/mime.js:1152`, `:1300`, `:1574` |

### USP (소스 패턴) (6)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/usp_init_prc` | `js/usp/ws_html5_usp.js:2642`, `js/ws_fn_02.js:735` |
| `/zu4a_wbc/u4a_ipcmain/usp_get_file_data` | `js/usp/ws_html5_usp.js:1658`, `js/usp/ws_usp.js:4268` |
| `/zu4a_wbc/u4a_ipcmain/usp_get_object_line_data` | `js/usp/ws_html5_usp.js:2729`, `js/usp/ws_usp.js:4760` |
| `/zu4a_wbc/u4a_ipcmain/usp_save_active_appdata` | `js/usp/ws_html5_usp.js:748`, `js/usp/ws_usp.js:7130` |
| `/zu4a_wbc/u4a_ipcmain/usp_page_del` | `js/usp/ws_html5_usp.js:1171`, `js/usp/ws_usp.js:3729` |
| `/zu4a_wbc/u4a_ipcmain/usp_app_delete` | `js/ws_events.js:393` |

### 버전 관리 (3)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/get_app_ver_list` | `Popups/versionManagement/Popup/views/vw_main/control.js:439`, `Popups/versionMng/versionMngFrame.js:252` |
| `/zu4a_wbc/u4a_ipcmain/compare_app_ctrl_abap` | `Popups/versionManagement/.../control.js:419`, `Popups/versionMng/versionMngFrame.js:618` |
| `/zu4a_wbc/u4a_ipcmain/create_temp_ver_app` | `Popups/versionManagement/.../control.js:882`, `Popups/versionMng/versionMngFrame.js:819` |

### WebDynpro 변환 (6)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/convWebdynUI` | `design/createApplication/conversionWebdynpro/main/control.js:521` |
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/getWebDynCompData` | 같은 파일 `:640` |
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/checkAppData` | 같은 파일 `:723` |
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/createAppData` | 같은 파일 `:792` |
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/getConvLogHeader` | `Popups/webDynConversionLog/Popup/views/vw_main/control.js:575` |
| `/zu4a_wbc/u4a_ipcmain/u4a_cvt_wdr/getConvLogDetail` | 같은 파일 `:447` |

### 미리보기 · CSS · 아이콘 (4)

| 경로 | 쓰는 곳 | 비고 |
|---|---|---|
| `/zu4a_wbc/u4a_ipcmain/getP13nPreviewHTML` | `design/js/callP13nDesignDataPopup.js:1041`, `js/fnP13nDesignPopupOpen.js:564`, `Popups/iconPrevPopup/index.js:421` | form POST — 서버가 HTML 을 그려 준다 |
| `/zu4a_wbc/u4a_ipcmain/getui5_pre_css` | `Popups/ui5CssPopup/frame.js:185` | form POST |
| `/zu4a_wbc/u4a_ipcmain/getui5_pre_css_v2` | `Popups/ui5CssPopup_v2/control.js:68` (쓰는 곳 `main/views/control.js:183`, `:244`, `:280`) | iframe + fetch |
| `/zu4a_wbc/u4a_ipcmain/getPrevHTML` | `design/js/uiPreviewArea.js:244`, `:315` | **죽은 코드** — 주석 처리됨. 현행 미리보기는 로컬 파일을 iframe 으로 띄운다 |

### 문서 · 릴리즈 · 가져오기/내보내기 (5)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/u4a_app_doc` | `Popups/docPopup/frame.js:765` (호출 `:568`, `:624`) |
| `/zu4a_wbc/u4a_ipcmain/app_export_import` | `Popups/importExportPopup/js/index.js:113`, `:272` |
| `/zu4a_wbc/u4a_ipcmain/GET_WS_RELEASE_DATA` | `Popups/releaseNotePopup/js/main.js:72`, `Popups/relese_notes/views/index.js:430` |
| `/zu4a_wbc/u4a_ipcmain/U4A_HELP_DOC_WS30` | `www/help/u4a_helpdoc/main.js:168` |
| `/zu4a_wbc/u4a_ipcmain/GET_SHORTCUT_APPINFO` | `Popups/ShortCutCreator/js/frame.js:12`, `js/index.js:1373` |

### 업데이트 · 패치 (3)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/update_check` | `www/lib/ws/electron-updater-sap.js:67`, `www/ws30/ws10_20/Login/Login.js:42` |
| `/zu4a_wbc/u4a_ipcmain/ws_update_file_get` | `www/lib/ws/electron-updater-sap.js:68` |
| `/zu4a_wbc/u4a_ipcmain/WS_SUPPORT_PATCH` | `www/lib/ws/SupportPackageChecker/index.js:187` |

### 외부 열기 (1)

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/external_open?ws-platform=3.0&URL=…` | `js/fnDialogPopupOpener.js:2954`, `:3217`, `js/ws_events.js:889` |

### 시험용으로 보이는 이름 (2) — ★ 보고만, 손대지 않았다

| 경로 | 쓰는 곳 |
|---|---|
| `/zu4a_wbc/u4a_ipcmain/test_lee` | `js/ws_fn_01.js:2062` |
| `/zu4a_wbc/u4a_ipcmain/ttt` | `js/ws_fn_test.js:72` |

---

## 참고 — `/zu4a_wbc` 가 **아닌** 서비스 (같이 찾았지만 요청 범위 밖)

| 경로 | 쓰는 곳 | 무엇 |
|---|---|---|
| `{host}/zu4a/{appid}?sap-language=..&sap-client=..` | `js/ws_fn_02.js:1562`, `:1616` | 만든 앱 실행 (브라우저로 띄움) |
| `{host}/zu4a_imp/ui5multipreview?ws-platform=3.0&applid=..` | `js/ws_fn_02.js:1565` | 멀티 미리보기 |
| `{host}/zu4a_acs/icon_exp` | `js/fnDialogPopupOpener.js:2951` | 아이콘 내보내기 |
| `{host}/zu4a_rnd/GET_WS_RELEASE_DATA` | `Popups/relese_notes/views/index.js:433` | 개발모드일 때만 쓰는 릴리즈 노트 주소 |

---

## 어떻게 뽑았나 (재현)

1. 서비스 경로를 만드는 자리는 한 곳 — `www/ws30/resources/index.js:401` `getServerPath()`
   = `getServerHost()` + `/zu4a_wbc/u4a_ipcmain` (인자 `true` 면 `/zu4a_wbc/u4a_dynpro`)
2. 별창(팝업)에 넘어가는 이름(`servNm` · `SERVPATH` · `sServerPath` · `SERVER_PATH` ·
   `serverPath` · `SHOST`)의 출처를 전부 따라가 **모두 `parent.getServerPath()`** 임을 확인
   (`js/fnDialogPopupOpener.js:235`, `:872`, `:1499`, `:2379`, `:2611`, `:2950`, `:3476`,
   `:4008`, `:4162` · `js/fnVersionManagementPopupOpen.js:132` · `js/ws_fn_05.js:439` ·
   `Popups/versionManagement/index.js:111` · `Popups/webDynConversionLog/index.js:41`)
3. 그 이름들 뒤에 `+ "/…"` 로 붙는 문자열을 전부 긁어 위 목록을 만들었다
4. `/zu4a_wbc` 를 소스에 직접 적어 둔 자리도 따로 확인(10곳) — 위 목록에 포함됨

```bash
# 직접 적어 둔 /zu4a_wbc 자리
grep -rn --include="*.js" -oE "/zu4a_wbc/[A-Za-z0-9_/]*" www electron | grep -v node_modules
```
