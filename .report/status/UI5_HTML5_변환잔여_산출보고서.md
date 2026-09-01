# U4A Workspace — UI5 → HTML5 변환 잔여 산출 보고서

> **조사일** 2026-06-26 · **전면 재검증** 2026-07-08 (소스 3축 병렬 재검증) · **대상** WS10 / WS20 / WS30 전체 화면 단위기능
> **방법** 현행 소스 전수 분석 (`_` 백업폴더 제외) + 호출경로 1:1 추적(iframe src·pathInfo까지) + `console.warn` 미변환 표식 전수 발굴

---

## 📊 한눈에 보기 (대시보드)

| 구분 | 완전 미완 | 부분/진행 | 합계 |
|---|:---:|:---:|:---:|
| **① UI5 팝업 변환** (별도 UI5 코드 → HTML5) | 7 | 1 🚧 | **8** |
| **② WS20 코어** (속성 편집기·미리보기 스텁) | 8 | 2 | **10** |
| **② WS30 USP** (Monaco 우클릭 클릭 동작) | 4 | 0 | **4** |
| **합계 (단위기능)** | **19** | **3** | **≈ 22** |

```
①  UI5 팝업 변환   ███████░░░░░░░░░░░  8  (별창 7 + 🚧 변환중 1)
②  WS20 코어       ██████████░░░░░░░░ 10  (완전 8 + 부분 2)
②  WS30 USP Monaco ████░░░░░░░░░░░░░░  4
```

> ※ **2026-07-08 재검증으로 판정 변경**:
> - ✅ **완료로 정정**(잔여 감소): `patternPopup`(별창) · **UI Sample 팝업**(WS20) · **앱 헤더 Find 버튼**(WS20).
> - 🆕 **잔여 명세화**(그동안 "팝업 의존"으로 뭉뚱그렸던 것 세분): WS20 속성 편집기 팝업/동작 5종 · 미리보기 영역 D&D · 미리보기 도움말 팝업.

> ※ WS10 셸 3건(setConnectionAI·개인화 초기화·UAI 배선)은 AI 미공개 테스트/내부 초기화라 **잔여 제외**.
> ※「USP 새 창 열기(uspNewPopup)」는 현행 미사용으로 **전환 대상 제외 확정**.

> **두 축의 차이**
> - **① 변환**: `Popups/` 폴더에 *별도 UI5 코드*가 살아있어, 그 UI를 HTML5로 다시 그려야 함.
> - **② 미구현**: 현행 HTML5 파일에 *함수 골격·호출부는 있으나* 본문이 비어 `console.warn`(미변환/W3+·W4+ 예정 표식)만 출력. 원본 로직 이식 필요.

---

## ✅ 판정 기준 (신뢰도 노트)

| 원칙 | 내용 |
|---|---|
| **팝업 "완료"는 내부 렌더로 판정** | 오프너 배선이 아니라 **팝업 내부가 `.u4a-`/`U4AUI`/native dialog** 인지로 판정. frame 셸만 HTML이어도 콘텐츠 js가 `sap.m.` 위젯이면 미변환. |
| **"구 파일 sap 잔존" ≠ 미변환** | 구 `fn*PopupOpen.js`·`design/*`는 **HTML5 빌드에서 로드 안 되는 죽은 코드**일 수 있음. `pathInfo.js` 실제 진입 매핑을 먼저 확인. |
| **주석의 sap ≠ 실렌더** | "원본 sap.m.Table 걷어내고…" 같은 이식 메모는 렌더가 아님. grep 시 주석/문자열 키를 걸러낼 것. |
| **`console.warn` 구분** | 미변환 표식 = "미변환/미구현/다음 단계/W3+·W4+ 예정" 문구 붙은 warn. 그 외(모듈 미로드·서버 미로그인·try/catch)는 **방어 가드**로 잔여 아님. |

---

# ① UI5 팝업 변환 대상

## 1-A. 미변환 별창 팝업 (7) — 현행에서 실제로 열림

| # | 팝업 | 기능 | 진입(현행) | sap/u4a | 비고 |
|:--:|---|---|---|:--:|---|
| 1 | **bindPopup** | 데이터 바인딩(툴바 대형 별창) ⭐최우선 | `ws_events_01.js:273` → `fnDialogPopupOpener.js:660` | 374/31 | 오프너 활성 |
| 2 | releaseNotePopup | 릴리즈 노트 | `fnDialogPopupOpener.js:3115` | 27/0 | 라이선스 미보유 시 이 UI5 팝업 |
| 3 | ShortCutCreator | 앱 바로가기 생성 | `fnDialogPopupOpener.js:3610` | 104/0 | 현재 오프너 주석·토스트 대체 |
| 4 | ui5CssPopup_v2 | UI5 Predefined CSS | `fnHmws.js:756` | 146/0 | 현재 오프너 주석·토스트 대체 |
| 5 | webDynConversionLog | WebDynpro 변환 로그 | 모듈 require | 62/0 | |
| 6 | monacoSnippetDesigner | 스니펫 디자이너 | `fnDialogPopupOpener.js:3954` | 94/0 | 에디터 유지·쉘만* |
| 7 | monacoThemeDesign | 테마 디자이너 | `fnDialogPopupOpener.js:3967` | 86/1 | 에디터 유지·쉘만* |

> `*` Monaco 2종은 **에디터는 유지, UI5 쉘 레이아웃만** 교체.
> ✅ **완료 전환(재검증)**: **patternPopup**(오프너 활성·u4a 35/sap 2주석) · iconPrevPopup · illustMsgPopup(둘 다 창크롬 HTML5, 콘텐츠 KEEP-UI5) · findPopup · runtimeClassNavigator · docPopup · versionMng · optionPopup.
> ⚠️ releaseNotePopup은 WLO 라이선스 보유 시 V2(`relese_notes`, 순수 HTML)로 분기하나, **미보유 시 UI5 팝업**이 떠 잔여로 집계.

## 1-A-2. 🚧 변환 작업 중 (1)

| # | 팝업 | 기능 | 진입(현행) | 상태 |
|:--:|---|---|---|---|
| 8 | **fnUiTempWizard** | UI 템플릿 마법사 | WS20 디자인 트리 툴바 **모니터 아이콘 버튼**(`ws_html5_ws20_tree.js:329` → `oAPP.fn.designCallWizardPopup`) | Stage 1 완료 · 2~4 미완 |

> 신규 `js/ws_html5_ws20_wizard.js`(298줄) + `js/fnUiTempWizardPopupOpen.js`(1731줄, u4a 46/U4AUI 9, sap 실렌더 0)로 HTML5 재작성 중. 원본은 순수 UI5 `sap.m.Dialog`+`Wizard`(별창 아님, 인앱 마법사). **부분 변환 진행 상태** — WZD4(Web Dynpro)는 "준비중" 게이트.

## 1-B. 전환 대상 제외 확정 (1) — 🚫 변환 안 함

| 팝업 | 기능 | 사유 |
|---|---|---|
| uspNewPopup | 선택 USP를 새 창으로 열기 | `fnUspNewWindow` 정의만·호출부 0, 현행 미사용 → **제외** |

> (참고: uspNewPopup ≠ USP 신규 생성 — 신규 생성은 K3 Create `fnCreateUspNodePopup`로 완료.)

---

# ② 코어 미구현 (현행 HTML5 코드 내 스텁)

## 2-A. WS20 속성 편집기 팝업/동작 (6 완전미완)

| # | 미구현 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 1 | F4 Value Help (`attrCallValueHelp`) | `ws_html5_ws20_attr.js:4648` | `console.warn "[W4+ 예정]"` |
| 2 | Attribute Help (`callTooltipsPopup`) | `ws_html5_ws20_attr.js:4421` | `console.warn "[W4+ 예정]"` |
| 3 | 팝업 호출형 속성 버튼 | `ws_html5_ws20_attr.js:4816` | `console.warn "[W4+ 예정]"` |
| 4 | 속성 아이콘 동작 | `ws_html5_ws20_attr.js:4932` | `console.warn "[W4+ 예정]"` |
| 5 | M05 속성 컨텍스트 단축키 등록(별창) | `ws_html5_ws20_attr_ctxmenu.js:245` | `console.warn "[W4+ 예정]"` + `_todoToast` |
| 6 | **이미지 압축 설정 창** — 파일 올리기 2종·목록 올리기의 `imageCompressSettings` 값 칸을 누르면 켜기/끄기+품질 조절 창이 떠야 함 | 원본 `design/attributesArea/imageCompress.js`(옛 화면틀 의존) → BR54로 호출 갈래는 이식됨(`ws_html5_ws20_attr.js` 값 변경 처리) | **창 자체 미변환** — 호출되면 열리지 않고 오류만 남음 |

> ⚠️ 6번은 **2026-08-31 서버 조회로 대상 3건이 실제 등록돼 있음을 확인**(파일 올리기 2종 + 목록 올리기). 그 속성 줄이 화면에 뜨는 순간 바로 드러난다.
> 적용 시 값 저장 경로도 HTML5 값 변경 처리에 연결해야 한다(원본은 옛 값 반영 함수를 부름).

## 2-B. WS20 미리보기 (2 완전미완 + 2 부분)

| # | 미구현 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 6 | 미리보기 **영역** D&D (`designTreeDragStart`/`designDragEnd`/`UIDrop`) | `ws_html5_ws20_prev.js:810/815/820` | `console.warn "(W3+ 예정)"` — **트리 D&D(완료)와 별개** |
| 7 | 미리보기 도움말 팝업 | `ws_html5_ws20_prev.js:1141` | `console.warn`(UI5 의존) |
| 8 | 〰️ 미리보기 우클릭 컨텍스트메뉴 | `ws_html5_ws20_prev.js:1244` | **부분** — 지연로드 배선됨, 원본 UI5 design 모듈(iframe)에 위임 |
| 9 | 〰️ previewUIsetProp 실시간 반영 | `ws_html5_ws20_attr.js:3404` | **부분** — 배선 완료, 실제 setter는 원본 `uiPreviewArea.js`(UI5 모듈) |

> 기타 소품: `setSelectTreeItem`(`ws_html5_ws20_tree.js:765`, "W4 예정") — 트리 선택 헬퍼, 별도 카운트 제외.
> ✅ **완료 전환(재검증)**: **UI Sample 팝업**(`attr.js:4074` 실구현) · **앱 헤더 Find 버튼**(`ws20.js:755`) · **OBJID 변경** · 속성 우클릭 M01~M04·M06 · 동일 속성 동기화 M03 · UI Attribute 개인화 M06 · **트리 D&D**(`ws_html5_ws20_dnd.js`) · 트리선택→속성 · DumpWrite·InitPreScreen · F4 검색도움말 제네릭 모듈.

## 2-C. WS30 USP — 4 (Monaco 에디터 우클릭 *클릭 동작*)

| # | 미구현 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 1 | 패턴 삽입(executeEdits) | `ws_html5_usp_editor_ctxmenu.js:270` `_dispatch` | 메뉴 표시 O, 클릭 시 `console.warn` (uspEditorCtxAction 미등록) |
| 2 | Theme Designer 호출 (우클릭) | 〃 | 〃 (Test 메뉴 경로는 동작) |
| 3 | Snippet Designer 호출 (우클릭) | 〃 | 〃 (Test 메뉴 경로는 동작) |
| 4 | Ctrl+우클릭 전체 패턴 팝업 | `ws_html5_usp_editor_ctxmenu.js:299` | `console.warn` (fnSourcePatternPopupOpener 미배선) |

> ✅ **완료**: 트리 우클릭 K1~K10 전부 · Save(`fnSaveUspWs30`)·Activate(`fnActivateUspWs30`)·모드전환 · Monaco 우클릭 메뉴 **HTML5 표시**(`.u4a-menu` 캐스케이딩). 잔여는 그 메뉴의 **항목 클릭 동작 4종**뿐.

## 2-D. WS10 / 공통 셸 — 🚫 잔여 제외 (3)

> AI 미공개 테스트/내부 초기화라 **잔여 집계에서 제외**(2026-07-06 결정).
> - setConnectionAI 버튼(`ws10_html.js:934`) — 클릭→`_invoke` 하나 `WIRED_EVENTS` 미포함, 실핸들러 `oAPP.fn.setConnectionAI`(`ws_fn_05.js:144`)로 라우팅 안 함
> - fnOnInitP13nSettings(`ws_html5_shell.js:368`) — 개인화 초기화 빈 스텁
> - UAI 커스텀이벤트 배선(`ws_html5_shell.js:934/968`) — `parent.UAI` 미구현, try/catch 가드

---

# 🗺️ 권장 착수 로드맵

| 순위 | 작업 | 근거 |
|:--:|---|---|
| **1** | **UI 템플릿 마법사** Stage 2~4 완성 | 이미 착수·진행 중, 마무리가 가장 가까움 |
| **2** | **USP Monaco 우클릭 클릭 동작 4종** | 메뉴 표시 완성, `uspEditorCtxAction` 등록만 |
| **3** | WS20 **속성 F4 Value Help + Attr Help** | 속성 편집 핵심 잔여 |
| **4** | **bindPopup**(툴바 대형 별창) → 색상/아이콘 picker | 유저 대면 최중요 팝업 |
| **5** | 미리보기 **영역 D&D** + 우클릭/실시간 반영 모듈 | 미리보기 상호작용 완성 |
| **6** | 나머지 별창 팝업 (releaseNote·ShortCut·ui5Css_v2·webDynLog·Monaco Designer 2종) | |

---

# 📁 참고 — 변환/구현 완료 (작업 불요)

- **별도창 팝업 완료 (11)**: OTRF4HelpPopup · editorPopup · errPageEditorPopup · errMsgPopup · textSearchPopup · winShowHidePopup · versionMng · docPopup · optionPopup · runtimeClassNavigator · **patternPopup** · **iconPrevPopup·illustMsgPopup**(창크롬 HTML5·콘텐츠 KEEP-UI5) · **findPopup**
- **원래 순수 HTML (변환 대상 아님)**: aboutU4APopup · importExportPopup · screen_record · relese_notes(releaseNote V2) · ui5CssPopup(v1) · designTreeUiSearchPopup
- **인앱 Dialog/속성 팝업 완료**: fnAppCopy · fnAppF4 · fnCts · fnSelectBrowser · fnCssJsLinkAdd · fnClientEditor · fnWebSecurity · fnDumpWrite(DH001091) · fnInitPreScreen(DH001106) · fnF4SearchHelp(Code Page·Auth Group) · 스켈레톤 화면 설정 · mimeRepository(뷰어+K3~K6 CRUD 전부) · 속성 아이콘 바인딩(callBindPopup 인앱) · 키보드 단축키 리스트 · **UI Sample**
- **WS10**: 헤더(줌/핀/창숨김/텍스트검색/최대화·F11/메뉴바 오버플로) · 상단 메뉴 디스패치 · 트랜잭션(Display/Change/Save/Activate) — 전면 완료
- **WS20**: 텍스트/콤보/체크박스/이벤트/Aggregation 편집기 · 트리 렌더·컨텍스트(M01~M06·M11)·선택→속성·**D&D(이동/복사)** · Insert/Delete/Move/Copy/Undo·Redo · 미리보기 줌(슬라이더)/전체화면 · **OBJID 변경** · **Find 버튼** · **UI Sample**
- **WS30**: 트리(가상스크롤·아이콘·펼침/접힘·선택) · Monaco 2분할 · Save/Activate/모드전환 · Properties · **트리 우클릭 K1~K10 전부** · Monaco 우클릭 메뉴 표시

---

*제외 항목: `_` 백업/구버전 폴더 · deprecated 팝업(editorPopup_v2 · u4aDocPopup) · 외부 SAP URL 로드 팝업 · 디자인 preview iframe(KEEP-UI5 정책) · uspNewPopup(미사용) · WS10 셸 3건(AI/내부초기화)*
