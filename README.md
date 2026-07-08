# U4A Workspace 4.0

SAP UI5 기반 U4A Workspace를 **HTML5 + 바닐라 JS**로 컨버전하는 Electron 데스크톱 앱.
백엔드(Electron/IPC/Node)는 유지하고, 화면 렌더링 레이어만 UI5 → HTML5로 교체한다.

> 변환 표준의 단일 출처(SSOT)는 [`.analy/`](.analy/) 문서 세트다. 화면·UI 작업 전 반드시 `.analy/13_AI_작업지시_가이드.md`와 `.analy/16_공통_화면UX_표준.md`를 먼저 읽는다.

---

## 📑 목차

- [UI5 → HTML5 변환 진행 현황](#ui5--html5-변환-진행-현황)
- [📊 리포트(.report)](.report/) — 잔여 산출 스냅샷 + 일자별 데일리 로그

---

## UI5 → HTML5 변환 진행 현황

> 최종 산출 **2026-06-26** · 전면 재검증 **2026-07-08** · 상세 → **[변환 잔여 산출 보고서](.report/status/UI5_HTML5_변환잔여_산출보고서.md)**

WS10 / WS20 / WS30 전체 단위기능 전수 조사 기준 **잔여 ≈ 21건** (완전 미완 18 · 부분 3, 그중 🚧 변환 중 1). *(USP 새 창 열기·WS10 셸 3건 = 제외)*

| 축 | 완전 미완 | 부분/진행 | 합계 |
|---|:---:|:---:|:---:|
| ① UI5 팝업 변환 (별도 UI5 코드 → HTML5) | 7 | 1 🚧 | **8** |
| ② WS20 코어 (속성 편집기·미리보기 스텁) | 7 | 2 | **9** |
| ② WS30 USP (Monaco 우클릭 클릭 동작) | 4 | 0 | **4** |
| **합계** | **18** | **3** | **🎯 21** |

> 🔎 **7/8 재검증 정정**: ✅ 완료 확인(잔여↓) — `patternPopup`·**UI Sample**·**앱 헤더 Find 버튼**. 🆕 잔여 명세화(잔여↑) — 속성 F4/Attr Help/팝업버튼/아이콘동작/M05 · 미리보기 영역 D&D · 미리보기 도움말.
> ✅ **7/1~7/6 완료**: iconPrevPopup · illustMsgPopup · Find(Ctrl+F) · 속성 데이터 바인딩 · 키보드 단축키 리스트 · OBJID 변경 · 속성 우클릭 컨텍스트 메뉴(M01~M06) · 동일 속성 동기화 · UI Attribute 개인화.
> ✅ **6/30 완료**: runtimeClassNavigator · 트리 D&D · F4 검색도움말 모듈 · 스켈레톤 팝업 · versionMng · docPopup · optionPopup.

---

### 🔴 잔여 작업 — ① UI5 팝업 변환 (8)

**별창 팝업 미변환 (7)**

- [ ] `bindPopup` ⭐ — 툴바 데이터 바인딩(대형 별창) *(속성 아이콘 바인딩은 완료)*
- [ ] `releaseNotePopup` — 릴리즈 노트 *(라이선스 미보유 시 UI5)*
- [ ] `ShortCutCreator` — 앱 바로가기 생성 *(현재 오프너 주석·토스트 대체)*
- [ ] `ui5CssPopup_v2` — UI5 Predefined CSS *(현재 오프너 주석·토스트 대체)*
- [ ] `webDynConversionLog` — WebDynpro 변환 로그
- [ ] `monacoSnippetDesigner` — 스니펫 디자이너 *(쉘 레이아웃만)*
- [ ] `monacoThemeDesign` — 테마 디자이너 *(쉘 레이아웃만)*

**🚧 변환 작업 중 (1)**
- [ ] `fnUiTempWizard` — **UI 템플릿 마법사** *(WS20 디자인 트리 툴바 모니터 아이콘 버튼 · 인앱 마법사)* — HTML5 재작성 진행 중, **Stage 1 완료 · 2~4 미완**

**🚫 전환 대상 제외 확정** *(현행 미사용, 변환 안 함)*
- ~~`uspNewPopup` — USP 새 창 열기~~

  ✅ `patternPopup` 완료 (7/8 재검증) — 오프너 활성·HTML5 렌더
  ✅ `mimeRepository` 완료 — 뷰어 + K3 폴더생성·K4 삭제·K5 업로드·K6 다운로드 전부 구현

---

### 🔴 잔여 작업 — ② WS20 코어 (9)

**속성 편집기 팝업/동작 (5 완전미완)** — `console.warn "[W4+ 예정]"`
- [ ] F4 Value Help (`attrCallValueHelp`) — `attr.js:4648`
- [ ] Attribute Help (`callTooltipsPopup`) — `attr.js:4421`
- [ ] 팝업 호출형 속성 버튼 — `attr.js:4816`
- [ ] 속성 아이콘 동작 — `attr.js:4932`
- [ ] M05 속성 컨텍스트 단축키 등록(별창) — `attr_ctxmenu.js:245`

**미리보기 (2 완전미완 + 2 부분)**
- [ ] 미리보기 **영역** D&D — `prev.js:810/815/820` *(트리 D&D와 별개)*
- [ ] 미리보기 도움말 팝업 — `prev.js:1141`
- [ ] 〰️ 미리보기 우클릭 컨텍스트메뉴 *(부분 · 원본 UI5 모듈 위임)*
- [ ] 〰️ previewUIsetProp 실시간 반영 *(부분 · 원본 UI5 모듈 위임)*

  ✅ **UI Sample 팝업**·**앱 헤더 Find 버튼**·OBJID 변경·속성 우클릭 M01~M04·M06·동일속성동기화 M03·개인화 M06·트리 D&D 완료

---

### 🔴 잔여 작업 — ② WS30 USP (4)

**Monaco 우클릭 *클릭 동작* (4)** · *메뉴 표시는 완료*
- [ ] 패턴 삽입 (executeEdits)
- [ ] Theme Designer 호출 *(Test 메뉴 경로는 동작)*
- [ ] Snippet Designer 호출 *(Test 메뉴 경로는 동작)*
- [ ] Ctrl+우클릭 전체 패턴 팝업

> 🚫 **WS10 셸 3건 제외**: setConnectionAI(AI 미공개) · fnOnInitP13nSettings(개인화 초기화) · UAI 배선 — 잔여 아님

---

### 🗺️ 착수 우선순위

1. **UI 템플릿 마법사** Stage 2~4 완성 — 이미 착수, 마무리가 가장 가까움
2. **USP Monaco 우클릭 클릭 동작 4종** — 메뉴 표시 완성, 핸들러 등록만
3. **WS20 속성 F4 Value Help + Attr Help** — 속성 편집 핵심 잔여
4. **bindPopup**(툴바 대형 별창) → 색상 / 아이콘 picker
5. 미리보기 영역 D&D + 나머지 별창 팝업(releaseNote·ShortCut·ui5Css_v2·webDynLog·Monaco Designer 2종)

---

<details>
<summary>✅ <b>완료 항목</b> (펼치기) — 6/26 이후 + 누적</summary>

**🆕 6/30 완료**
- [x] 별도창 **runtimeClassNavigator**(런타임 클래스 탐색) HTML5화
- [x] WS20 **트리 D&D**(이동/복사) — 신규 `ws_html5_ws20_dnd.js`
- [x] **F4 검색도움말 제네릭 모듈**(Code Page · Authorization Group)
- [x] **스켈레톤 화면 설정 팝업** HTML5화
- [x] 별도창 **versionMng · docPopup · optionPopup** HTML5화

**6/29 완료**
- [x] WS30 트리 우클릭 **K1~K10 전부** (K5 Download · K6 Test Service 추가)
- [x] USP **Save · Activate · 모드전환** 이식 · **Monaco 우클릭 메뉴 표시**
- [x] WS20 **트리선택 → 속성** · 신규 속성 팝업 **DumpWrite** · **InitPreScreen**

**별도창 팝업 완료 (10)**
- [x] OTRF4HelpPopup · editorPopup · errPageEditorPopup · errMsgPopup · textSearchPopup · winShowHidePopup · **versionMng** · **docPopup** · **optionPopup** · **runtimeClassNavigator**

**인앱/속성 팝업 + 원래 순수 HTML (누적)**
- [x] fnAppCopy · fnAppF4 · fnCts · fnSelectBrowser · fnCssJsLinkAdd · fnClientEditor · fnWebSecurity · fnDumpWrite · fnInitPreScreen
- [x] (순수 HTML) aboutU4APopup · importExportPopup · screen_record · relese_notes · ui5CssPopup(v1) · designTreeUiSearchPopup

**화면 (누적)**
- [x] **WS10** — 헤더(줌·핀·창숨김·텍스트검색·최대화·F11·메뉴바 오버플로) · 메뉴 디스패치 · 트랜잭션(Display/Change/Save/Activate)
- [x] **WS20** — 텍스트/콤보/체크박스/이벤트/Aggregation 편집기 · 트리 렌더·컨텍스트(M01~M11) · Insert/Delete/Move/Copy/Undo·Redo · 미리보기 줌·전체화면
- [x] **WS30** — 트리(가상스크롤·아이콘·펼침/접힘·선택) · Monaco 2분할 · Properties · 트리 우클릭 K1~K10

</details>

> 상세 표·판정 근거는 **[변환 잔여 산출 보고서](.report/status/UI5_HTML5_변환잔여_산출보고서.md)** 참조.
