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

> 최종 산출 **2026-06-26** · 현행화 **2026-06-30** (오후 변환분 반영) · 상세 → **[변환 잔여 산출 보고서](.report/status/UI5_HTML5_변환잔여_산출보고서.md)**

WS10 / WS20 / WS30 전체 단위기능 전수 조사 기준 **잔여 ≈ 24건** (완전 미완 20 · 부분 4). *(UI 템플릿 마법사·USP 새 창 열기 = 전환 대상 제외 확정)*

| 축 | 완전 미완 | 부분 | 합계 |
|---|:---:|:---:|:---:|
| ① UI5 팝업 변환 (별도 UI5 코드 → HTML5) | 11 | 1 | **12** |
| ② 코어 미구현 (원본 로직 → 현행 코드 이식) | 9 | 3 | **12** |
| **합계** | **20** | **4** | **🎯 24** |

> ✅ **6/30 완료**: 별도창 **runtimeClassNavigator** · WS20 **트리 D&D**(이동/복사) · **F4 검색도움말 모듈** · **스켈레톤 팝업** · versionMng · docPopup · optionPopup HTML5화.

---

### 🔴 잔여 작업 — ① UI5 팝업 변환 (12)

**별창 팝업 미변환 (11)**

- [ ] `bindPopup` ⭐ — 데이터 바인딩 편집 *(최우선 · 유저 대면 핵심)*
- [ ] `findPopup` — UI 컨트롤 찾기
- [ ] `patternPopup` — 소스 패턴 관리
- [ ] `iconPrevPopup` — SAP 아이콘 미리보기
- [ ] `illustMsgPopup` — 일러스트 메시지 선택
- [ ] `releaseNotePopup` — 릴리즈 노트
- [ ] `ShortCutCreator` — 앱 바로가기 생성
- [ ] `ui5CssPopup_v2` — UI5 Predefined CSS
- [ ] `webDynConversionLog` — WebDynpro 변환 로그
- [ ] `monacoSnippetDesigner` — 스니펫 디자이너 *(쉘 레이아웃만)*
- [ ] `monacoThemeDesign` — 테마 디자이너 *(쉘 레이아웃만)*

**🚫 전환 대상 제외 확정** *(현행 미사용, 변환 안 함)*
- ~~`fnUiTempWizard` — UI 템플릿 마법사~~
- ~~`uspNewPopup` — USP 새 창 열기~~

**부분 변환 (1)**
- [ ] `mimeRepository` (별도창) — ✅뷰어·폴더생성 / ⬜ K4 삭제 · K5 업로드 · K6 다운로드

---

### 🔴 잔여 작업 — ② 코어 미구현 (12)

**WS20 디자인영역 (2완전 + 3부분)**
- [ ] OBJID 변경 *(현재 입력해도 값 원복)*
- [ ] UI Sample 팝업
- [ ] 〰️ 미리보기 우클릭 컨텍스트메뉴 *(부분 · 모듈 로드 의존)*
- [ ] 〰️ 미리보기 속성 실시간 반영 *(부분 · 모듈 로드 의존)*
- [ ] 〰️ 앱 헤더 Find UI 버튼 *(부분 · New Window·Back은 완료)*

  ✅ 트리 D&D 완료(`ws_html5_ws20_dnd.js`)

**WS30 USP — Monaco 우클릭 *클릭 동작* (4)** · *메뉴 표시는 완료*
- [ ] 패턴 삽입 (executeEdits)
- [ ] Theme Designer 호출
- [ ] Snippet Designer 호출
- [ ] Ctrl+우클릭 전체 패턴 팝업

**WS10 / 공통 셸 (3)**
- [ ] `setConnectionAI` 버튼 무동작 *(라이브 버그 · 한 줄 수정)*
- [ ] `fnOnInitP13nSettings` 빈 스텁
- [ ] UAI 커스텀이벤트 배선

---

### 🗺️ 착수 우선순위

1. **mimeRepository CRUD** (K4·K5·K6) — 뷰어 완성, 서버 패턴 존재
2. **USP Monaco 우클릭 클릭 동작 4종** — 메뉴 표시 완성, 핸들러 등록만
3. **WS20 OBJID 변경 + UI Sample** — 디자인 편집 잔여 결손
4. **bindPopup** → WS20 색상 / 아이콘 picker
5. **setConnectionAI 버그** — 한 줄 수정으로 즉시 해결

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
