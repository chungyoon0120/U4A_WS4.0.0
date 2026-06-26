# U4A Workspace 4.0

SAP UI5 기반 U4A Workspace를 **HTML5 + 바닐라 JS**로 컨버전하는 Electron 데스크톱 앱.
백엔드(Electron/IPC/Node)는 유지하고, 화면 렌더링 레이어만 UI5 → HTML5로 교체한다.

> 변환 표준의 단일 출처(SSOT)는 [`.analy/`](.analy/) 문서 세트다. 화면·UI 작업 전 반드시 `.analy/13_AI_작업지시_가이드.md`와 `.analy/16_공통_화면UX_표준.md`를 먼저 읽는다.

---

## 📑 목차

- [UI5 → HTML5 변환 진행 현황](#ui5--html5-변환-진행-현황)

---

## UI5 → HTML5 변환 진행 현황

> 최종 산출: **2026-06-26** · 상세: **[변환 잔여 산출 보고서](UI5_HTML5_변환잔여_산출보고서.md)**

WS10 / WS20 / WS30 전체 단위기능을 전수 조사한 잔여 작업 현황. 잔여는 **두 축**으로 나뉜다.

| 축 | 의미 | 잔여 |
|---|---|:---:|
| **① UI5 팝업 변환** | 별도 UI5 코드 → HTML5 재작성 | **18** |
| **② 코어 미구현** | 원본 로직 → 현행 HTML5 코드에 이식 | **20** |
| **합계** | | **≈ 38** |

### ① UI5 팝업 변환 (18)

| 분류 | 개수 | 항목 |
|---|:---:|---|
| 미변환 별창 팝업 | 15 | bindPopup⭐, findPopup, iconPrevPopup, illustMsgPopup, patternPopup, runtimeClassNavigator, docPopup, uspNewPopup, releaseNotePopup, ShortCutCreator, ui5CssPopup(_v2), webDynConversionLog, monacoSnippetDesigner, monacoThemeDesign, versionManagement |
| 미변환 + 현행 미배선 ⚠️ | 2 | fnUiTempWizard, fnWebSecurity *(현행에 살아있어야 하는지 확인 필요)* |
| 부분 변환 | 1 | optionPopup → optionS(Server/Theme/CDN/LanguTrans) 잔존 |

### ② 코어 미구현 (20)

| 영역 | 개수 | 핵심 항목 |
|---|:---:|---|
| **WS20 디자인영역** | 9 | 트리 D&D(드래그/종료/Drop), 미리보기 우클릭 메뉴, **미리보기 속성 실시간 반영**, **OBJID 변경**(현재 값 원복), 앱 헤더 액션, UI Sample, 트리선택→속성 폴백 |
| **WS30 USP** | 7 | 트리 우클릭 K4 Delete · K5 Download · K6 Test Service · K7 Rename · K8/K9 Up·Down · K10 Move Position *(원본 핸들러 존재 → 이식만)* |
| **WS10 / 셸** | 3 | setConnectionAI 버튼 무동작(라이브 버그), fnOnInitP13nSettings 빈 스텁, UAI 커스텀이벤트 배선 |
| **MIME Repository** | 1 | CRUD 4동작(폴더 생성/삭제·Import 업로드·다운로드) — 뷰어는 완료 |

### 🗺️ 착수 우선순위

1. **WS30 트리 CRUD (K4~K10)** — 원본 로직 그대로 존재, 이식만 → 가성비 최고
2. **WS20 D&D + OBJID 변경 + 미리보기 속성 실시간 반영** — 디자인 편집의 핵심 결손
3. **bindPopup** → WS20 F4 / 색상 / 아이콘 picker
4. **setConnectionAI 버그** — 한 줄 수정으로 즉시 해결

상세 표·판정 근거·완료 항목은 **[변환 잔여 산출 보고서](UI5_HTML5_변환잔여_산출보고서.md)** 참조.
