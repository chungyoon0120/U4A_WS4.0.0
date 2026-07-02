# U4A Workspace — UI5 → HTML5 전환 잔여 팝업 보고

> 작성일 2026-07-01 · 대상: 브라우저 별도창(BrowserWindow) 팝업 및 관련 기능 중 미전환 항목

## 1. 개요

WS10/WS20/WS30 전체 화면 기능을 HTML5로 전환 중이며, 현재 **전체 잔여 24건**(팝업 12 · 화면 코어 12)입니다.
아래는 그중 **별도창/팝업 계열 미전환 항목**을 실제 **메뉴 이름 기준**으로 정리한 것입니다.

## 2. 잔여 팝업 목록 (메뉴명 기준)

| # | 기능 | 실제 메뉴 위치 / 호출 경로 | 상태 |
|:--:|---|---|---|
| 1 | **데이터 바인딩** | WS20 디자인 > 속성 패널 > 바인딩 아이콘 | 미전환 |
| 2 | **Find (UI 컨트롤 찾기)** | WS20 디자인 > 찾기 (Ctrl+F) | 미전환 |
| 3 | **Source Pattern (소스 패턴)** | WS20 상단 메뉴 > Utilities > **Source Pattern** | 미전환 |
| 4 | **Icon List (아이콘 목록)** | WS20 상단 메뉴 > Utilities > **Icons > Icon List** | 미전환 |
| 5 | **Image Icons (일러스트 메시지)** | WS20 상단 메뉴 > Utilities > **Icons > Image Icons** | 미전환 |
| 6 | **Release Note (릴리즈 노트)** | 상단 메뉴 > Help > **Release Note** | HTML 테마로 변경 작업 중 |
| 7 | **App Shortcut (앱 바로가기 생성)** | 앱 바로가기 파일 생성 | 미전환 |
| 8 | **UI5 Predefined CSS** | WS20 상단 메뉴 > Theme > **UI5 Predefined CSS** | 미전환 |
| 9 | **WebDynpro Conversion Log** | WebDynpro → U4A 변환 로그 | 미전환 |
| 10 | **Snippet Designer (스니펫 디자이너)** | WS30 소스 에디터 > 우클릭 > Code Editor Designer > **Snippet Designer** | 미전환 |
| 11 | **Theme Designer (색상 테마 디자이너)** | WS30 소스 에디터 > 우클릭 > Code Editor Designer > **Theme Designer** | 미전환 |
| 12 | **소스 패턴 전체 팝업** | WS30 소스 에디터 > **Ctrl+우클릭** | 미전환(메뉴 표시만 완료) |

> **전환 대상 제외 확정**: 「UI Template Wizard(UI 템플릿 마법사)」·「USP 새 창 열기」는 현행 미사용으로 전환하지 않습니다.

> 참고 — 중복 정리: 「UI 컨트롤 찾기」와 「Find UI」는 동일 기능(#2), 「스니펫 디자이너」와 「Snippet Designer」도 동일 기능(#10)입니다.

## 3. 비고

- **#6 Release Note**: 기능 자체는 있으며, 현재 신규 HTML 테마 디자인에 맞춰 개편 작업 진행 중.
- **#11 UI Template Wizard / (USP 새 창 열기)**: 원본 UI5 파일은 있으나 현행 화면에서 호출되는 경로가 없어, **해당 기능을 유지할지 여부 결정 후** 전환 예정.
- **#10·#12·#13 (에디터 우클릭 계열)**: 우클릭 메뉴 표시는 완료, 각 항목 실행 동작만 남음.
- 위 팝업 외 화면 코어(WS20 속성 편집 일부 · WS30 에디터 · WS10 공통) 잔여 12건은 별도 상세 보고서 참조.

---
*상세 근거: `.report/status/UI5_HTML5_변환잔여_산출보고서.md` · 일자별 진척: `.report/daily/`*
