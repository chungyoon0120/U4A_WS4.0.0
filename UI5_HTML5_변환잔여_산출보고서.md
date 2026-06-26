# U4A Workspace — UI5 → HTML5 변환 잔여 산출 보고서

> **조사일** 2026-06-26 · **현행화** 2026-06-26 (재조사: 6개 완료 반영) · **대상** WS10 / WS20 / WS30 전체 화면 단위기능
> **방법** 현행 소스 전수 분석 (`_` 백업폴더 제외) + 호출경로 1:1 추적 + 미구현 스텁 전수 발굴

---

## 📊 한눈에 보기 (대시보드)

| 구분 | 잔여 | 변동 |
|---|:---:|:---:|
| **① UI5 팝업 변환** (별도 UI5 코드 → HTML5) | **17** | ▼1 |
| **② 코어 미구현** (원본 로직 → 현행 코드 이식) | **15** | ▼5 |
| **합계 (단위기능)** | **≈ 32** | ▼6 |

```
①  UI5 팝업 변환 █████████████████░  17
②  코어 미구현   ███████████████░░░  15
```

> **최근 완료 (6)**: WS30 트리 우클릭 K4 Delete · K7 Rename · K8 Up · K9 Down · K10 Move Position · 팝업 fnWebSecurity(변환+배선).

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

## 1-A. 미변환 별창 팝업 (15) — 현행에서 실제로 열림

| # | 팝업 | 기능 | 진입(현행) | 규모 |
|:--:|---|---|---|:--:|
| 1 | **bindPopup** | 데이터 바인딩 편집 ⭐최우선 | `ev_pressBindPopupBtn` / 속성 바인딩 아이콘 | 大 |
| 2 | **findPopup** | UI 컨트롤 찾기 | `ev_pressFindBtn` | 中 |
| 3 | iconPrevPopup | SAP 아이콘 미리보기 | `fnWS20WMENU20_04_01` | 大 |
| 4 | illustMsgPopup | 일러스트 메시지 선택 | `fnWS20WMENU20_04_02` | 中 |
| 5 | patternPopup | 소스 패턴 관리 | `fnWS20WMENU20_05` | 中 |
| 6 | runtimeClassNavigator | 런타임 클래스 탐색 | `ev_pressRuntimeBtn` | 中 |
| 7 | docPopup | Technical Document | `fnHmws.js:1157` | 中 |
| 8 | uspNewPopup | USP 신규 파일/폴더 | WS30 트리 | 中 |
| 9 | releaseNotePopup | 릴리즈 노트 | `fnHmws.js:621` | 中 |
| 10 | ShortCutCreator | 앱 바로가기 생성 | `fnHmws.js:703` | 中 |
| 11 | ui5CssPopup(_v2) | UI5 Predefined CSS | `fnHmws.js:746/750` (WLO 분기) | 中 |
| 12 | webDynConversionLog | WebDynpro 변환 로그 | 모듈 require | 中 |
| 13 | monacoSnippetDesigner | 스니펫 디자이너 | 모듈 require | 中* |
| 14 | monacoThemeDesign | 테마 디자이너 | 모듈 require | 中* |
| 15 | versionManagement | 소스 버전 관리 (diff) | 모듈 require | 中* |

> `*` Monaco 3종은 **에디터는 유지, UI5 쉘 레이아웃만** 교체하면 되어 비교적 수월.

## 1-B. 미변환 + 현행 미배선 (1) — ⚠️ 확인 필요

| 팝업 | 기능 | 상태 |
|---|---|---|
| fnUiTempWizardPopupOpen | UI 템플릿 마법사 | 순수 UI5. 호출처가 **죽은 `design/*`에만** 존재 → 현행 메뉴에서 안 열림 |

> 변환 전, **이 기능이 현행에 살아있어야 하는지** 사용자 확인 필요 (변환 + 신규 배선 둘 다 필요).
> ✅ ~~fnWebSecurityPopupOpen~~ — **완료** (native `<dialog>` 변환 + 속성패널 DH001026에서 정상 배선).

## 1-C. 부분 변환 (1)

| 팝업 | 완료 | 잔여 |
|---|---|---|
| optionPopup | optionM (Master) | **optionS** = Server 정보 / Theme / CDN / LanguTrans 설정 (UI5 잔존) |

---

# ② 코어 미구현 (현행 코드 내 스텁)

## 2-A. WS20 디자인영역 — 9 (팝업 무관, 원본 로직 이식)

| # | 미구현 기능 | 위치 | 현재 상태 |
|:--:|---|---|---|
| 1~3 | **트리 D&D** (드래그시작 / 종료 / Drop) | `ws20_prev.js:808~` | warn만, drop 무시 (W3+) |
| 4 | 미리보기 우클릭 컨텍스트메뉴 | `ws20_prev.js:828` | warn만 |
| 5 | **미리보기 속성 실시간 반영** | `ws20_attr.js:3103` | 속성 변경→미리보기 즉시반영 빠짐 (W2) |
| 6 | 앱 헤더 액션 버튼 | `ws20.js:626` | 핸들러 미연결 (W2) |
| 7 | **OBJID 변경** | `ws20_attr.js:3497` | 입력해도 **값 원복**되어 변경 불가 |
| 8 | UI Sample 팝업 | `ws20_attr.js:3458` | warn만 |
| 9 | 트리 선택→속성 폴백 | `ws20_tree.js:706` | else 분기 warn (W4) |

> **팝업 의존(중복·①에서 해결)**: F4 Value Help, 색상/아이콘 picker, 바인딩, Attr Help 팝업, My Pattern p13n.

## 2-B. WS30 USP — 2 (트리 우클릭, 잔여)

| 키 | 기능 | 상태 |
|:--:|---|---|
| K5 | Download | **미완** — `uspCtxAction["K5"]` 미등록, `fnOnDownloadUspFiles` 부재 |
| K6 | Test Service | **미완** — `uspCtxAction["K6"]` 미등록, `fnTestServiceWs30` 부재 |

> ✅ **완료 (5)**: K4 Delete · K7 Rename · K8 Up · K9 Down · K10 Move Position — `uspCtxAction` 등록 + 실 핸들러(`ws_html5_usp.js`) 구현 완료.
> K5/K6는 메뉴에 보이나(VISIBLE:true) 클릭 시 `console.warn`만 → 사용자 가시적 무동작.
> **Monaco 우클릭 패턴/스니펫은 미구현 아님** (보존 iframe에 존재).

## 2-C. WS10 / 공통 셸 — 3

| # | 기능 | 위치 | 상태 |
|:--:|---|---|---|
| 1 | **AI 연결 버튼 (setConnectionAI)** | `ws10_html.js:950` | **무동작 (라이브 버그)** — `_invoke`가 실핸들러 `oAPP.fn.setConnectionAI`를 못 찾음. 버튼 토글만 됨 |
| 2 | `fnOnInitP13nSettings` (개인화 초기화) | `ws_html5_shell.js:368` | 빈 스텁 |
| 3 | UAI 커스텀이벤트 배선 (WS20/WS30) | `ws_html5_shell.js:1005/971` | 추후 변환 |

## 2-D. MIME Repository — 1 (CRUD 4동작)

> 뷰어(트리+Monaco+속성)는 **변환 완료**. 폴더 생성/삭제 · Import 업로드 · 다운로드만 미구현 (변환축 아닌 기능 잔여).

---

# 🗺️ 권장 착수 로드맵

| 순위 | 작업 | 근거 |
|:--:|---|---|
| **1** | WS30 트리 **K5 Download · K6 Test Service** (2) | K4~K10 중 마지막 2개, 동일 패턴으로 이식 |
| **2** | WS20 **D&D + OBJID 변경 + 미리보기 속성 실시간반영** | 디자인 편집의 핵심 결손 |
| **3** | **bindPopup** → WS20 F4 / 색상 / 아이콘 picker | 가장 중요한 유저 대면 팝업 + 연쇄 해결 |
| **4** | **setConnectionAI 버그** | 한 줄 수정으로 즉시 해결 |
| **5** | 나머지 팝업 (Monaco 3종은 쉘 레이아웃만) | |

---

# 📁 참고 — 변환/구현 완료 (작업 불요)

- **팝업 완료**: OTRF4HelpPopup · editorPopup · errMsgPopup · errPageEditorPopup · textSearchPopup · winShowHidePopup · fnAppCopy · fnAppF4 · fnCts · fnSelectBrowser · fnCssJsLinkAdd · **fnClientEditor** · **fnWebSecurity** · MIME 뷰어
- **WS10**: 헤더(줌/핀/창숨김/텍스트검색/최대화·F11) · 상단 메뉴 디스패치 · 트랜잭션(Display/Change/Save/Activate) — 전면 완료
- **WS20**: 텍스트/콤보/체크박스/이벤트/Aggregation 편집기 · 트리 렌더·컨텍스트(M01~M11) · Insert/Delete/Move/Copy/Undo·Redo · 미리보기 줌(슬라이더)/전체화면
- **WS30**: 트리(가상스크롤·아이콘·펼침/접힘·선택) · Monaco 2분할 · Save/Activate/모드전환 · Properties · K1/K2/K3(Create) · **K4(Delete)·K7(Rename)·K8/K9(Up/Down)·K10(Move Position)**

---

*제외 항목: `_` 백업/구버전 폴더 · deprecated 팝업(editorPopup_v2 · u4aDocPopup) · 외부 SAP URL 로드 팝업 · 디자인 preview iframe(KEEP-UI5 정책)*
