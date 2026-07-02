# U4A Workspace — UI5 → HTML5 변환 잔여 산출 보고서

> **조사일** 2026-06-26 · **현행화** 2026-06-30 (오후 변환분 반영) · **대상** WS10 / WS20 / WS30 전체 화면 단위기능
> **방법** 현행 소스 전수 분석 (`_` 백업폴더 제외) + 호출경로 1:1 추적(iframe src·pathInfo까지) + 미구현 스텁 전수 발굴

---

## 📊 한눈에 보기 (대시보드)

| 구분 | 완전 미완 | 부분 | 합계 |
|---|:---:|:---:|:---:|
| **① UI5 팝업 변환** (별도 UI5 코드 → HTML5) | 11 | 1 | **12** |
| **② 코어 미구현** (원본 로직 → 현행 코드 이식) | 9 | 3 | **12** |
| **합계 (단위기능)** | **20** | **4** | **≈ 24** |

```
①  UI5 팝업 변환 ████████████░░░░░░  12
②  코어 미구현   ████████████░░░░░░  12
```

> ※「UI 템플릿 마법사」·「USP 새 창 열기」는 현행 미사용으로 **전환 대상 제외 확정**(잔여에서 제외).

> **6/30 완료**: 별도창 **runtimeClassNavigator**(런타임 클래스 탐색) · WS20 **트리 D&D**(이동/복사, `ws_html5_ws20_dnd.js`) · **F4 검색도움말 제네릭 모듈**(Code Page·Authorization Group) · **스켈레톤 화면 설정 팝업** · **versionMng·docPopup·optionPopup** HTML5화.
> **6/29 완료**: WS30 K1~K10 전부 · USP Save·Activate·모드전환 · Monaco 우클릭 메뉴 표시 · 속성 팝업 DumpWrite·InitPreScreen.
> **세분화**: MIME → 별도창(mimeRepository) 전환(뷰어+폴더생성 완료, K4~K6 CRUD 미구현) · USP Monaco 우클릭 **클릭 동작 4종**(표시는 됨, 클릭 미구현).

> **두 축의 차이**
> - **① 변환**: `Popups/` 폴더 등에 *별도 UI5 코드*가 살아있어, 그 UI를 HTML5로 다시 그려야 함.
> - **② 미구현**: 현행 HTML5 파일에 *함수 골격·호출부는 있으나* 본문이 비어 `console.warn`만 출력(이 코드베이스의 미구현 표식 컨벤션). 원본 로직을 이식하면 됨.

---

## ✅ 판정 기준 (신뢰도 노트)

| 원칙 | 내용 |
|---|---|
| **"구 파일 sap 잔존" ≠ 미변환** | 구 `fn*PopupOpen.js`·`design/*`는 **HTML5 빌드에서 로드 안 되는 죽은 코드**일 수 있음 (`ws_html5_ws20_attr.js` 주석 명시). |
| **판정은 "현행 호출 대상"으로** | `ws_html5_*` / `ws_events*` / `fnHmws.js`가 *실제로 무엇을 호출*하는지로 판정. iframe `src`까지 추적. |
| **`console.warn` = 미구현 표식** | 실제 런타임 예외는 `console.error`. warn 호출부 대부분이 "아직 구현 안 된 기능". |
| **대표 정정 사례** | `fnClientEditorPopupOpen`(UI5)은 죽은 코드, 현행은 `ws_html5_client_editor.js`(HTML5) 호출 → **완료**. 구 파일만 보고 미변환으로 오판했던 것을 교정함. |

---

# ① UI5 팝업 변환 대상

## 1-A. 미변환 별창 팝업 (11) — 현행에서 실제로 열림

| # | 팝업 | 기능 | 진입(현행) | 규모 |
|:--:|---|---|---|:--:|
| 1 | **bindPopup** | 데이터 바인딩 편집 ⭐최우선 | `ev_pressBindPopupBtn` / 속성 바인딩 아이콘 | 大 |
| 2 | **findPopup** | UI 컨트롤 찾기 | `ev_pressFindBtn` | 中 |
| 3 | iconPrevPopup | SAP 아이콘 미리보기 | `fnWS20WMENU20_04_01` | 大 |
| 4 | illustMsgPopup | 일러스트 메시지 선택 | `fnWS20WMENU20_04_02` | 中 |
| 5 | patternPopup | 소스 패턴 관리 | `fnWS20WMENU20_05` | 中 |
| 6 | releaseNotePopup | 릴리즈 노트 | `fnHmws.js:621` | 中 |
| 7 | ShortCutCreator | 앱 바로가기 생성 | `fnHmws.js:703` | 中 |
| 8 | ui5CssPopup_v2 | UI5 Predefined CSS | `fnHmws.js:746/750` (WLO 분기) | 中 |
| 9 | webDynConversionLog | WebDynpro 변환 로그 | 모듈 require | 中 |
| 10 | monacoSnippetDesigner | 스니펫 디자이너 | 모듈 require | 中* |
| 11 | monacoThemeDesign | 테마 디자이너 | 모듈 require | 中* |

> `*` Monaco 2종은 **에디터는 유지, UI5 쉘 레이아웃만** 교체하면 되어 비교적 수월.
> ✅ 완료 전환: **runtimeClassNavigator · docPopup · versionMng · optionPopup** — §완료 참고.

## 1-B. 전환 대상 제외 확정 (2) — 🚫 변환 안 함

| 팝업 | 기능 | 사유 |
|---|---|---|
| fnUiTempWizardPopupOpen | UI 템플릿 마법사 | 현행 미사용(죽은 `design/*`에서만 호출) → **제외 확정** |
| uspNewPopup | 선택 USP를 새 창으로 열기 | `fnUspNewWindow` 정의만·호출부 0, 현행 미사용 → **제외 확정** |

> 2026-07-01 결정: 두 기능은 현행 화면에서 사용되지 않아 전환하지 않으며, **잔여 집계에서 제외**한다.
> (참고: uspNewPopup ≠ USP 신규 생성 — 신규 생성은 K3 Create `fnCreateUspNodePopup`로 완료.)

## 1-C. 부분 변환 (1)

| 팝업 | 완료 | 잔여 |
|---|---|---|
| **mimeRepository** (별도창 신규) | 뷰어(트리+Monaco+pdf.js+속성+URL복사) · K3 폴더 생성 | **K4 삭제 · K5 Import 업로드 · K6 다운로드** ("준비중" 토스트) |

> MIME은 인앱 `<dialog>`(롤백용 `fnMimePopupOpen.js`)에서 **별도창 BrowserWindow**(`fnMimeWindowOpener` → `Popups/mimeRepository/`)로 전환됨.
> ✅ ~~optionPopup~~ — **완료** (`pathInfo.js` WSOPTS=`optionM.html` HTML5 + `optionMain.js` Bootstrap 재작성, sap 0. 구 `optionS.html`·UI5 js는 죽은 코드. 언어/CDN 탭은 원본도 미완성이라 골격만).

---

# ② 코어 미구현 (현행 코드 내 스텁)

## 2-A. WS20 디자인영역 — 2 완전 + 3 부분

**완전 미완 (2)**

| # | 미구현 기능 | 위치 | 현재 상태 |
|:--:|---|---|---|
| 1 | **OBJID 변경** | `ws20_attr.js:3498` | 입력해도 **값 원복**되어 변경 불가 |
| 2 | UI Sample 팝업 | `ws20_attr.js:3460` | warn만, 버튼 display:none |

**부분 (3) — 조건부 동작(모듈 로드 의존)**

| # | 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 3 | 미리보기 우클릭 컨텍스트메뉴 | `ws20_prev.js:1216` | `callDesignContextMenu` 지연로드 배선됨, 미로드 시 warn 폴백 |
| 4 | 미리보기 속성 실시간 반영(previewUIsetProp) | `ws20_attr.js:3108` | `uiPreviewArea.js`에 정의, 미리보기 모듈 로드 시 활성 |
| 5 | 앱 헤더 Find UI 버튼 | `ws20.js:697` | New Window·Back은 배선 완료, Find 버튼만 미배선 |

> ✅ **완료 전환**: **트리 D&D**(이동/복사, 신규 `ws_html5_ws20_dnd.js` — `prev.js` 스텁 대체) · 트리선택→속성(`fnWs20SelectUI`) · **F4 검색도움말 제네릭 모듈**(Code Page·Auth Group) · 속성 팝업 DumpWrite·InitPreScreen.
> **팝업 의존(별도·①에서 해결)**: 나머지 F4 Value Help, 색상/아이콘 picker, 바인딩, Attr Help 팝업.

## 2-B. WS30 USP — 4 (Monaco 에디터 우클릭 *클릭 동작*)

| # | 미구현 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 1 | 패턴 삽입(executeEdits) | `usp_editor_ctxmenu.js` `_dispatch` | 메뉴 표시 O, 클릭 시 `console.warn` (uspEditorCtxAction 미등록) |
| 2 | Theme Designer 호출 (우클릭) | 〃 | 〃 (Test 메뉴 경로는 동작) |
| 3 | Snippet Designer 호출 (우클릭) | 〃 | 〃 (Test 메뉴 경로는 동작) |
| 4 | Ctrl+우클릭 전체 패턴 팝업 | `usp_editor_ctxmenu.js:298` | `console.warn` (fnSourcePatternPopupOpener 미배선) |

> ✅ **완료 (트리 우클릭 K1~K10 전부)**: K4 Delete · K5 Download · K6 Test Service · K7 Rename · K8/K9 Up·Down · K10 Move Position. + Save·Activate·모드전환 이식. + **Monaco 우클릭 메뉴 HTML5 표시**(`ws_html5_usp_editor_ctxmenu.js`, .u4a-menu 캐스케이딩).
> 잔여는 그 메뉴의 **항목 클릭 동작 4종**뿐.

## 2-C. WS10 / 공통 셸 — 3

| # | 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 1 | **AI 연결 버튼 (setConnectionAI)** | `ws10_html.js:928` | **무동작 (라이브 버그)** — `_invoke`가 `WIRED_EVENTS`/`oAPP.events`만 봄. 실핸들러 `oAPP.fn.setConnectionAI`(ws_fn_05.js:144) 미연결 → 버튼 토글만 됨 |
| 2 | `fnOnInitP13nSettings` (개인화 초기화) | `ws_html5_shell.js:368` | 빈 스텁 |
| 3 | UAI 커스텀이벤트 배선 (WS20/WS30) | `ws_html5_shell.js:934/968` | 추후 변환 (parent.UAI 미구현) |

> *(MIME CRUD는 별도창 전환으로 §1-C mimeRepository 부분 항목에 통합됨)*

---

# 🗺️ 권장 착수 로드맵

| 순위 | 작업 | 근거 |
|:--:|---|---|
| **1** | **mimeRepository CRUD** (K4 삭제·K5 업로드·K6 다운로드) | 뷰어 완성, 서버 `/set_mime_crud` 패턴 존재 → 이식 |
| **2** | **USP Monaco 우클릭 클릭 동작 4종** | 메뉴 표시 완성, `uspEditorCtxAction` 등록만 하면 됨 |
| **3** | WS20 **OBJID 변경 + UI Sample** | 디자인 편집 잔여 결손 |
| **4** | **bindPopup** → WS20 색상 / 아이콘 picker | 가장 중요한 유저 대면 팝업 + 연쇄 해결 |
| **5** | **setConnectionAI 버그** | 한 줄 수정으로 즉시 해결 |
| **6** | 나머지 별창 팝업 (Monaco Designer 2종은 쉘 레이아웃만) | |

---

# 📁 참고 — 변환/구현 완료 (작업 불요)

- **별도창 팝업 완료 (10)**: OTRF4HelpPopup · editorPopup · errPageEditorPopup · errMsgPopup · textSearchPopup · winShowHidePopup · versionMng · docPopup · optionPopup · **runtimeClassNavigator**
- **원래 순수 HTML (변환 대상 아님)**: aboutU4APopup · importExportPopup · screen_record · relese_notes · ui5CssPopup(v1) · designTreeUiSearchPopup
- **인앱 Dialog/속성 팝업 완료**: fnAppCopy · fnAppF4 · fnCts · fnSelectBrowser · fnCssJsLinkAdd · fnClientEditor · fnWebSecurity · fnDumpWrite(DH001091) · fnInitPreScreen(DH001106) · **fnF4SearchHelp**(Code Page·Auth Group) · **스켈레톤 화면 설정** · mimeRepository 뷰어
- **WS10**: 헤더(줌/핀/창숨김/텍스트검색/최대화·F11/메뉴바 오버플로) · 상단 메뉴 디스패치 · 트랜잭션(Display/Change/Save/Activate) — 전면 완료
- **WS20**: 텍스트/콤보/체크박스/이벤트/Aggregation 편집기 · 트리 렌더·컨텍스트(M01~M11)·선택→속성·**D&D(이동/복사)** · Insert/Delete/Move/Copy/Undo·Redo · 미리보기 줌(슬라이더)/전체화면
- **WS30**: 트리(가상스크롤·아이콘·펼침/접힘·선택) · Monaco 2분할 · Save/Activate/모드전환 · Properties · **트리 우클릭 K1~K10 전부** · Monaco 우클릭 메뉴 표시

---

*제외 항목: `_` 백업/구버전 폴더 · deprecated 팝업(editorPopup_v2 · u4aDocPopup) · 외부 SAP URL 로드 팝업 · 디자인 preview iframe(KEEP-UI5 정책)*
