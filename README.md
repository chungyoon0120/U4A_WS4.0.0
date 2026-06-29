# U4A Workspace 4.0

SAP UI5 기반 U4A Workspace를 **HTML5 + 바닐라 JS**로 컨버전하는 Electron 데스크톱 앱.
백엔드(Electron/IPC/Node)는 유지하고, 화면 렌더링 레이어만 UI5 → HTML5로 교체한다.

> 변환 표준의 단일 출처(SSOT)는 [`.analy/`](.analy/) 문서 세트다. 화면·UI 작업 전 반드시 `.analy/13_AI_작업지시_가이드.md`와 `.analy/16_공통_화면UX_표준.md`를 먼저 읽는다.

---

## 📑 목차

- [UI5 → HTML5 변환 진행 현황](#ui5--html5-변환-진행-현황)

---

## UI5 → HTML5 변환 진행 현황

> 최종 산출: **2026-06-26** · 현행화: **2026-06-29** (전 영역 재산출) · 상세: **[변환 잔여 산출 보고서](UI5_HTML5_변환잔여_산출보고서.md)**

WS10 / WS20 / WS30 전체 단위기능을 전수 조사한 잔여 작업 현황. 잔여는 **두 축**으로 나뉜다.

| 축 | 의미 | 완전 미완 | 부분 | 합계 |
|---|---|:---:|:---:|:---:|
| **① UI5 팝업 변환** | 별도 UI5 코드 → HTML5 재작성 | 16 | 2 | **18** |
| **② 코어 미구현** | 원본 로직 → 현행 HTML5 코드에 이식 | 12 | 3 | **15** |
| **합계** | | **28** | **5** | **≈ 33** |

> ✅ **6/26 이후 완료**: WS30 트리 우클릭 K5 Download·K6 Test Service(K1~K10 전부 완료) · USP Save·Activate·모드전환 이식 · USP Monaco 우클릭 메뉴 표시 · WS20 트리선택→속성 · 신규 속성 팝업 DumpWrite·InitPreScreen.

### ① UI5 팝업 변환 (18)

| 분류 | 개수 | 항목 |
|---|:---:|---|
| 미변환 별창 팝업 | 15 | bindPopup⭐, findPopup, iconPrevPopup, illustMsgPopup, patternPopup, runtimeClassNavigator, docPopup, uspNewPopup, releaseNotePopup, ShortCutCreator, ui5CssPopup_v2, webDynConversionLog, monacoSnippetDesigner, monacoThemeDesign, versionManagement |
| 미변환 + 현행 미배선 ⚠️ | 1 | fnUiTempWizard *(현행에 살아있어야 하는지 확인 필요)* |
| 부분 변환 | 2 | **mimeRepository**(별도창, 뷰어+폴더생성 완료 / K4 삭제·K5 업로드·K6 다운로드 미구현) · optionPopup(optionS 미배선) |

### ② 코어 미구현 (15)

| 영역 | 개수 | 핵심 항목 |
|---|:---:|---|
| **WS20 디자인영역** | 5+3부분 | 완전: 트리 D&D(드래그/종료/Drop), **OBJID 변경**(값 원복), UI Sample / 부분: 미리보기 우클릭 메뉴·속성 실시간반영·앱헤더 Find버튼 |
| **WS30 USP** | 4 | Monaco 에디터 우클릭 *클릭 동작*(패턴 삽입·Theme/Snippet Designer 호출·Ctrl+우클릭 전체팝업) — 메뉴 표시는 완료 |
| **WS10 / 셸** | 3 | setConnectionAI 버튼 무동작(라이브 버그), fnOnInitP13nSettings 빈 스텁, UAI 커스텀이벤트 배선 |

### 🗺️ 착수 우선순위

1. **mimeRepository CRUD** (K4 삭제·K5 업로드·K6 다운로드) — 뷰어 완성, 서버 패턴 존재
2. **USP Monaco 우클릭 클릭 동작 4종** — 메뉴 표시 완성, 핸들러 등록만
3. **WS20 트리 D&D + OBJID 변경** — 디자인 편집의 핵심 결손
4. **bindPopup** → WS20 F4 / 색상 / 아이콘 picker
5. **setConnectionAI 버그** — 한 줄 수정으로 즉시 해결

상세 표·판정 근거·완료 항목은 **[변환 잔여 산출 보고서](UI5_HTML5_변환잔여_산출보고서.md)** 참조.
