# .analy 문서 세트 — 무슨 내용인지 요약

> 조회 시각 2026-09-22. 근거 = `.analy/` 안 md 22개(백업 `_` 접두 1개·`_backup_20260723_msgowner/` 폴더는 제외) 직접 읽음.
> 각 문서의 제목·머리말·`##` 절 제목에서 뽑음. 추측 없음.

## 0. 한 줄 정의

`.analy` = **U4A Workspace v3.6.3(UI5 Electron 앱)을 영역별로 뜯어본 분석 문서 + UI5→HTML5 변환 표준(SSOT)** 모음.
목적은 두 가지 — ① 원본이 어떻게 돌아가는지 기록, ② 그걸 HTML5 로 다시 만들 때의 기준을 한 곳에 고정.

핵심 전제(00 문서 0절):
- **유지** = Electron·IPC·Node 모듈(fs/net/child_process/ws/regedit)·Worker·SAP XHR 통신·BrowserWindow·Registry·자동 업데이트 — 전부 그대로.
- **교체** = SAP UI5 로 그린 화면만 → HTML5 + CSS + vanilla JS.
- **제거** = UI 교체 뒤 `lib/ui5` bootstrap.
- ⚠ "fetch/WebSocket/localStorage 로 대체" 같은 제안은 **범위 밖**.

## 1. 문서별 내용 (번호 = 파일 앞 번호)

| # | 문서 | 주요 내용 |
|---|---|---|
| 00 | 개요_및_컨버전전략 | 변환 범위 정의(유지/교체/제거), 프로젝트 개요(약 8,140 파일), 부팅 흐름 요약, 보존해야 할 계약(`oAPP` namespace·`parent.*` chain·IPC 채널·메시지 클래스), **문서 색인**, UI5 control → HTML5 매핑 표 |
| 01 | 부팅_아키텍처 | Electron main → intro3.html → ServerList → Login → index.html 부팅 순서, 파일별 역할, 전역 객체 map, IPC 구조, path/설정 관리, 메시지 클래스, UI5 bootstrap 메커니즘 |
| 02 | 로그인_서버리스트 | 서버리스트 화면(Registry·Named Pipe·SAP landscape), 로그인 화면(인증·license·언어·trial), 서버 통신 모듈, session 유지, data model. **tree 의 기준 화면** |
| 03 | 메인프레임_WS10_WS20 | `oAPP` namespace 구조, 메인프레임 렌더링, 헤더 window menu, WS10 앱 검색, WS20 편집(Display/Change·Activate·Save), WS20 design 영역, 공통 util(ws_common/ws_util), Suggestion·Footer message |
| 04 | WS30_USP_코드에디터 | WS30 화면 구성, USP 페이지 UI5 control 목록, source tree, Monaco 통합, context menu, code pattern/snippet, 파일 열기·저장·rename |
| 05 | 디자인영역 | `design/` = WS20 비주얼 편집. UI design tree, attribute 패널, preview 렌더링, UI 추가·삽입, binding·event, undo/redo, `call*Popup.js` 목록. **preview 는 UI5 유지(KEEP-UI5)** 로 확정 |
| 06 | 팝업 | 팝업 35개 카탈로그, 생성 공통 메커니즘, opener 함수별 역할, 팝업별 렌더링 방식(UI5/HTML/Monaco), 교체 우선순위 |
| 07 | JS유틸_워커_IPC | Web Worker 3종, IPC handler, broadcast 채널, 설정·테마 모듈, IndexedDB util, 개발자도구 util, keybinding, UAI(AI Named Pipe), 범용 util |
| 08 | 라이브러리_플로팅메뉴_도움말_리소스 | 자동 업데이트·Support Package 체크, `lib/u4a`, `lib/ui5`·`lib/monaco` SDK 구성, floatingMenu(ABAP Editor), help 시스템, ext_api(NSIS/PS/VBS), settings, MSG 리소스, ADMIN 권한, icon/SVG/sound |
| 09 | 환경구축_런북 | 빈 폴더에서 `package.json` 작성 → `npm install` → native rebuild → 실행·검증까지. Windows x64 기준 |
| 10 | 이주_매니페스트 | 원본 → 새 폴더 이주 지도. 전 폴더를 COPY/TRANSFORM/SPLIT/EXCLUDE/KEEP-UI5 로 분류, 목표 구조, 단계별 순서, 지켜야 할 계약 |
| 11 | 컨버전_플레이북_처음시작 | **새 세션 진입점.** 3대 전략, 시작 즉시 깔 "기반 보정 4종"(전역 sap 위임 등), 단계별 구축 순서, 검증 방법(headless smoke + 실 로그인), WS20 변환 가이드, 프롬프트 템플릿 |
| 12 | 테마_컨버전_전략 | 기준 비주얼 = `sap_horizon`. 테마 5종(white/dark/purple/red/green, 기본 white), **토큰 계약**, 전환 메커니즘·API shim, 실행 사양, **7장 반응형 레이아웃(필수)** |
| 13 | AI_작업지시_가이드 | AI 에게 변환을 시킬 때의 지시 방법. 핵심 원칙 4가지, 0단계(토큰 값 확보), 재사용 지시문 템플릿, 가드레일, 흔한 실패와 방지 |
| 14 | UI5부트스트랩_제거_설계 | LOGIN → WS10 → WS20 순서로 UI5 bootstrap 걷어내는 설계. "override script" 전략, model shim(`ws_html5_shell.js`), 단계별 검증 gate, risk |
| 15 | 공통_입력UX_가이드 | 모든 `<input>` 공통 UX. clear(X) 버튼, number spinner 제거, ValueState(검증) 메시지, readonly 시각 구분, hover/focus, `valueHelpOnly`, 자동완성 |
| 16 | **공통_화면UX_표준** | 가장 큼(919줄). 모든 화면 상위 기준. Bootstrap 기반, 공통 자산 불변 원칙("고치지 말고 덧대라"), 모달/메시지박스, tree, splitter, i18n, table, footer, panel, 페이지 전환 애니메이션, 헤더 overflow(⋯) |
| 17 | 서버에러_메시지_현지화_전략 | 서버 ABAP 수정 불가 전제. 서버가 준 오류 텍스트 → 키 역매핑 → client 언어로 재렌더. 사례 = MIME CRUD |
| 18 | 원본소스_위치_SSOT | "원본 참고" 시 읽을 폴더 2곳(전체 / 디자인 영역+담당 팝업 5개), 원본이 **아닌** 곳 구분 |
| 19 | 예외처리_크리티컬오류_표준 | 예측 가능한 오류 = 안내 후 정상 return / 예측 불가 = 삼키지 말고 내부 오류 코드로 표면화. 오류 로깅 규칙, 코드 체계 |
| ※ | U4A_WS20_Design_Area_Guide | **원작자 제공 WS20 공식 흐름 스펙**(1,632줄). 진입·조회 흐름, preview iframe 구성, design tree 선택, UI 추가/이동/삭제, property 변경, binding, event, 저장 데이터 구성, AI 가 지킬 원칙 |
| ※ | U4A_WS20_AI_Prompt_Guide | 위 문서를 AI 에게 물릴 때 쓰는 프롬프트 원문 |

## 2. 문서를 어떤 순서로 보나 (문서 자체가 지정한 순서)

1. **11** 플레이북 — 새로 시작하면 여기부터.
2. **13** AI 작업지시 가이드 — 지시 방식·가드레일.
3. **16** 공통 화면 UX 표준 — 화면 작업이면 항상 같이.
4. 작업 영역 문서(01~08) + **12** 테마.
5. 입력칸이면 **15**, 팝업이면 **06**, WS20 디자인이면 **05 + U4A_WS20_Design_Area_Guide**.

## 3. 문서들이 공통으로 못 박은 규칙

- 설계 결정은 **문서 절 번호로 근거**를 댄다. 문서에 없으면 추측 금지 → 묻는다.
- 화면마다 새로 만들지 말고 **공통 자산 소비**(`shell.css`·`bootstrap-skin.css`·`u4a-ui.js`·`tokens.css`).
- 색은 의미 토큰만. **하드코딩 hex 금지.** 문구는 메시지 키.
- **고정 px 폭 금지** — 반응형 필수(12번 7장).
- `_` 로 시작하는 폴더/파일은 백업·구버전 → 현행으로 인용 금지.
