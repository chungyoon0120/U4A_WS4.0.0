---
name: common-ux
description: U4A WS4.0 공통 화면 UX 표준(.analy/16 SSOT) 안내. **사용자가 "공통 UX", "공통 화면 UX", "공통 UX 참고/기준", "common-ux" 처럼 공통 UX 표준을 참고하라고 명시적으로 요청할 때만 실행한다.** 일반적인 화면/UI 작업이라는 이유만으로 자동 실행하지 말 것. 실행되면 화면·모달/팝업·트리·테이블·입력칸·스플릿바·토스트·푸터·패널·페이지전환 등 화면 요소를 공통 자산(shell.css·bootstrap-skin·u4a-ui.js·tokens.css)으로 소비하도록 표준을 안내한다.
---

# 공통 UX 표준 (U4A WS4.0)

화면 요소를 만들거나 고치기 전에 이 스킬을 따른다. **단일 출처(SSOT)는 `.analy/16_공통_화면UX_표준.md`**,
입력칸은 `.analy/15`, 팝업은 `.analy/06`, 테마는 `.analy/12`.

## 0. 시작 전 (필수)

1. `mcp__u4a-ws4-mcp__analy_index` 로 봐야 할 문서를 파악하고, `analy_get_doc`(ref='16')로 공통 표준을 읽는다.
   작업 대상 기능 문서(§CLAUDE.md 매핑)도 함께 끝까지 읽는다.
2. **한 번에 작업 단위 하나.** 문서의 `AI 컨버전 실행 사양` 절 하나씩, 산출물 트리에 명시된 파일만 만지고,
   모든 결정은 **절 번호로 근거**를 댄다. 문서에 없으면 추측 말고 **사용자에게 묻는다.**
3. `_`(언더바)로 시작하는 폴더/파일은 백업·구버전이므로 현행으로 인용하지 않는다.

## 1. 공통 자산 불변 원칙 — "고치지 말고 덧대라" (§16 0.5, 최우선)

- 공통 파일(`shell.css` / `bootstrap-skin.css` / `u4a-ui.js` / `tokens.css`)을 **직접 수정하지 않는다.**
  화면 고유 요구는 그 화면 스코프에서 **override**로 덧댄다. 공통 승격이 필요하면 사용자에게 먼저 묻는다.
- 모양/동작은 화면마다 새로 만들지 말고 **공통 컴포넌트를 소비**한다.
- 색은 `theme/tokens.css`의 **의미 토큰만**. 하드코딩 hex 금지. `color-mix` 금지(Chromium 93)→ 솔리드 rgba.
- 문구는 **메시지 키**(SQLite)만. 임의 메시지 생성 금지 — 필요 키는 수집해 보고.
- **고정 px 폭 금지 = 반응형**(§12 7장). 반응형 기준은 뷰포트가 아니라 컨테이너 폭(ResizeObserver).

## 2. 화면 요소 → 소비할 공통 자산 (컨닝시트, §16 0.1)

공통 자산 위치: `www/ws30/ws10_20/theme/{shell.css, bootstrap-skin.css, tokens.css, u4a-ui.js}`

| 화면 요소 | 소비할 공통 자산 | 근거 |
|---|---|---|
| 모달/팝업 | `.u4a-dialog` (헤더/푸터 48px, 드래그·리사이즈, grip, 닫기X 위임, 포커스링) | §16 2 |
| 확인/메시지 | `U4AUI.confirm` (2버튼 이하 아이콘만) | §16 2.1.1·2.7 |
| 토스트 | `.u4a-toast` — **화면 정중앙 싱글톤 3초** (화면별/하단 금지) | §16 2.4 |
| 진행/대기 | `fnIllustMsgDialogOpen` (네이티브 dialog+IPC) | §16 2.3 |
| 별도 창 | frameless + `.u4a-titlebar` + boot-bg 플래시 방지 + blur + `U4AUI.closeWindow` | §16 2.6 |
| 트리 | `U4AUI.createTree` + `.u4a-tree__*` | §16 3 |
| 사이드 네비 | `.u4a-navlist` (계층 없는 카테고리) | §16 3.7 |
| 스플릿바 | `.u4a-splitter*` (더블클릭=최초위치, resize 재클램프) | §16 4 |
| 테이블 | `.u4a-table` (sticky/zebra/선택 + 카드 반응형 + compact) | §16 6 |
| 푸터 | `U4AUI.footer*` + `.u4a-footer` (단일, 닫기X 위임) | §16 7 |
| 패널 | `U4AUI.createPanel` + `.u4a-panel*` | §16 8 |
| 페이지 전환 | `fnNavTo` + `.u4aWsNav*` (슬라이드 0.26s±32px, 즉시스왑 금지) | §16 9 |
| 입력칸 | `createField` (clear/suggest/F4/value-state/readonly) | §15 |
| 콤보 | `.u4a-combo` (input과 표면 동일, hover는 shell 글로벌만) | §15 |
| 밀도 | `.u4a-compact` (컨테이너 스코프) | §16 |
| 오버레이/레이어 | `showMessage`/`showModal`만. 손수 z-index 금지. 모달 위=top-layer | §16 2.10 |
| 툴팁 | 공통 툴팁 `data-tip`(잘릴 때 `data-tip-trunc`). 네이티브 title 금지 | §16 2.9a |

## 2.1 테이블 상세 (§16 6 + 흩어진 규칙 통합)

> ⛔ **필수 선행 조건**: 테이블 관련 작업(목록/그리드/트리테이블을 새로 만들거나 고치는 모든 작업)을 시작하기 전에
> **반드시 `.analy/16_공통_화면UX_표준.md`의 §6(테이블)을 먼저 끝까지 읽는다.**
> (`mcp__u4a-ws4-mcp__analy_get_doc`(ref='16', section='6') 또는 파일 직접 열람.)
> 아래 요약은 진입점일 뿐이며, 실제 결정 근거는 항상 16번 문서의 해당 절 번호로 댄다. 문서에 없으면 추측 말고 사용자에게 묻는다.

목록/그리드는 화면마다 표 스타일·정렬·필터·행높이를 새로 만들지 않고 **공통 `.u4a-table`를 소비**한다.

### 마크업 · 래퍼 (§16 6.1)
- 구조: `.u4a-table-wrap > table.u4a-table` (둘 다 `shell.css`).
- **팝업/다이얼로그 안 = 액자형 `.u4a-table-wrap--boxed`** (overflow:auto+border+radius+surface+flex). AppF4·Insert·CSS/JS Link 팝업 모두 이 한 클래스로 동일 외형. 화면 CSS에서 border/radius/background 직접 칠하지 말 것(어긋남).
- **풀페이지 보더리스(ServerList)** 는 `--boxed` 미부착(테두리 없음, 세로 스크롤만).
- 상태: 헤더 sticky, zebra=행 `data-odd="true"`, 선택=`aria-selected="true"`(좌측 accent 바), 포커스 링.
- **데이터 0건 = 공통 `.u4a-table__nodata` 행(colspan 전체·중앙·muted) 필수**, 메시지 키 **946**. 대시("—")·공란 금지.

### 행높이 · 밀도 (단일 출처)
- 행높이는 **공통 고정값**(`--control-h`/`--row-h`, 폴백 2.5rem=40px). 새 테이블에 height/padding으로 행높이 직접 건드리지 말 것 — 표마다 달라진다.
- ⚠️ **단독 `.u4a-table--compact` 금지**(혼자 좁아져 이질감). 영역 전체를 좁히려면 컨테이너에 **`.u4a-compact`**(버튼/입력/행이 함께 축소).
- **셀 말줄임 자동 툴팁**: `td`·`.u4a-th__label`은 가로로 잘리면 공통 `initTooltip`이 `data-tip`+`data-tip-trunc` 자동 부여. per-cell title 달지 말 것.

### 카드(반응형) 뷰 — 옵트인
- `.u4a-table-wrap[data-view="card"]`. **컨테이너쿼리 미지원(Ch93)** → 화면 JS가 `ResizeObserver`로 `data-view` 토글.
- ⚠️ **사용자/원본 별도 언급 없이는 적용 금지**. 기본 `data-view="table"`(가로 스크롤). 특히 인라인 편집 그리드(입력칸/스위치/체크박스)엔 넣지 말 것.

### 컬럼 헤더 정렬/필터 메뉴 — 서버리스트 기준 (§16 6.2)
- 정렬/필터 가능한 `th`에 `.u4a-th--menu` + `.u4a-th__inner`(`.u4a-th__label` + `.u4a-th__ind`). ⚠️ **idle 헤더엔 아이콘 없음** — 걸린 컬럼에만 JS가 표시자(화살표/funnel) 부착.
- 클릭 → 공통 `U4AUI.openColumnMenu(col, th, ctl, opts)`(u4a-ui.js). 화면은 컨트롤러 `ctl{getFilter,setFilter,getSort,setSort,rerender}` + `opts{container, labels}`만 제공.
- 메뉴 순서: **필터 input → 오름/내림 정렬(재클릭 해제) → 필터 초기화**. 필터=contains·대소문자무시·여러 컬럼 AND·Enter/blur. 정렬=단일 `localeCompare({numeric:true})`.
- **원본 배열 보존 + 뷰만 파생**(비파괴). 헤더는 매 rerender 재구성.
- 메시지 키: 정렬 `ZMSG_WS_COMMON_001` 810/811, 필터값 A68, 초기화 A69.
- showModal 다이얼로그 안이면 메뉴를 **top-layer(다이얼로그) 안에 append**(밖이면 모달에 가림).
- **전체 해제 버튼**(권장): 툴바에 `filter-circle-xmark` 아이콘, 걸린 게 없으면 `:disabled`, 툴팁 A69 재사용. 범위=클라이언트 뷰 파생만 리셋(서버 쿼리 유지). ⚠️ 툴바 아이콘 버튼은 화면별로 줄이지 말 것(공통 `.u4a-btn-icon` 2rem).

### 트리 테이블(TreeTable) 컬럼 정렬/필터 — 트리 의미로 변형 (§16 6.2.1)
- **정렬=형제 노드끼리만**(각 부모의 자식 배열 재정렬, 계층·깊이 유지). 비파괴.
- **필터=경로 유지 contains**: 노드 매칭=검색박스 AND 컬럼필터, 최상위 컨테이너는 항상 통과, 자손 매칭 시 조상 경로 표시(트리 끊김 방지). 매칭 0이면 공통 no-data.
- 필터 변경/재조회 시 매칭 경로 자동 펼침.

### 다열 트리-테이블 컬럼 정렬 (createTree, 반복 실수 7대)
SSOT 레퍼런스 = USP `usp.css`(.u4aWs30Tree*) / MIME `mime.css`(.u4aMimeTree*). 새로 그리지 말고 복사:
1. **컬럼헤더 padding-left = `calc(행패딩 + 1px)`** — 공통 ul 좌측 1px 패딩(선택바) 보정. 빼먹으면 세로구분선 어긋남.
2. **들여쓰기 = 토글 `margin-left`**(`--u4a-tree-depth`), 행 padding-left 아님.
3. **우측 컬럼 2개↑ = slotTrailing 래퍼 `display:contents`**(셀을 행의 직계 flex 자식으로).
4. **`.u4aXxxTree.u4a-tree { min-height: 0 }`** — sticky 헤더 형제일 때 초과스크롤 방지.
5. **행 `padding-right:0`**(공통 0.5rem 덮기) + `data-u4a-tree-split` 무력화 + 라벨 `flex:1 1 0;min-width:0` + 우측 셀 `flex:0 0 <w>;border-left`.
6. **우측 컬럼 2개↑ = 헤더에도 `gap:0.375rem`**(공통 행 gap과 일치).
7. **★컬럼헤더는 스크롤 컨테이너 "안"에 `position:sticky;top:0`** — 절대 스크롤러 바깥 형제로 두지 말 것. 밖에 두면 세로 스크롤바 뜰 때 바디만 줄어 어긋남.

### 자주 물리는 함정 (Chromium 93 / 렌더)
- ⚠️ **sticky 헤더 어긋남**(Ch93): 세로 스크롤바 뜨면 sticky thead가 바디와 스크롤바 폭만큼 어긋남. 정적 페이지로 재현 불가 → 엔진 버전부터 의심. 회피=div flex 그리드(헤더를 스크롤 컨테이너 안 sticky), `<table>`이면 `table-layout:fixed`인지부터 확인.
- ⚠️ **sticky 헤더 hover 반투명 함정**: `th:hover{background:var(--hover-bg)}` 단독이면 뒤 데이터 비쳐 글자 겹침 → `background:linear-gradient(var(--hover-bg),var(--hover-bg)),var(--surface)`(불투명 위 틴트).
- ⚠️ **"셀 옆 점(dot)" 방어**: Bootstrap 등 로드로 셀에 `::before/::after` 글리프가 붙을 수 있음 → 새 테이블 CSS에 `td::before,td::after{content:none!important}` + 체크박스 `margin:0`.

### 대용량 → 가상 스크롤
- 공통 `U4AUI.makeVScroller(oWrap, oTbody, opt)`(u4a-ui.js). 트리는 `U4AUI.createTree({virtual:true})`.
- 핵심: 측정 행높이 **정수 반올림 + `--u4a-vsrowh`로 데이터 행 높이 강제**(안 하면 끝단 떨림). `overscrollBehavior:contain` + `overflowAnchor:none` + 휠 완전 점유(경계 바운스 차단). 화면별 `.u4a-tree__row{height}` 재정의 금지.

## 2.2 트리 상세 (§16 3)

> ⛔ **필수 선행 조건**: 트리 관련 작업(트리/트리테이블/사이드 네비를 새로 만들거나 고치는 모든 작업)을 시작하기 전에
> **반드시 `.analy/16_공통_화면UX_표준.md`의 §3(트리)을 먼저 끝까지 읽는다.**
> (`mcp__u4a-ws4-mcp__analy_get_doc`(ref='16', section='3') 또는 파일 직접 열람.)
> 아래 요약은 진입점일 뿐이며, 실제 결정 근거는 항상 16번 문서의 해당 절 번호로 댄다. 문서에 없으면 추측 말고 사용자에게 묻는다.

트리는 화면마다 새로 렌더하지 않고 **공통 `U4AUI.createTree` + `.u4a-tree__*`**를 소비한다.

- **단일 출처**(§3.1): `U4AUI.createTree`(u4a-ui.js) + `.u4a-tree__*`(shell.css). 들여쓰기=`--u4a-tree-depth`. WS20 자체 렌더 잔존은 예외.
- **코어 UX**(§3.2): 선택=좌측 accent 바(비선택 dim 금지), 토글, 포커스 링. 색은 의미 토큰만.
- **가상 스크롤**(§3.4.1): 수만 노드는 `createTree({virtual:true})`(flat+windowed). 측정 행높이 정수 반올림 + `--u4a-vsrowh` 강제(끝단 떨림 방지), 화면별 `.u4a-tree__row{height}` 재정의 금지.
- **다열 트리-테이블**(§3.4.1 + §2.1의 "다열 트리-테이블 7대"): 컬럼/세로구분선 정렬은 USP/MIME 패턴 그대로 복사. 헤더는 스크롤 컨테이너 "안"에 `position:sticky;top:0`.
- **컬럼 리사이즈 트리테이블**(§3.4.2): 리사이즈/가로 스크롤 필요한 3열 트리테이블은 공통 `U4AUI.makeColumnTree(host, cfg)` 소비(화면은 데이터 매핑만). 컬럼 폭=고정(px/rem, `%` 금지), 리사이즈는 "가이드 라인 + 놓을 때 적용"으로 공통 `U4AUI.attachColumnResize` 소비(그립 로직 복붙 금지). 상세는 §3.4.2를 읽고 따른다.
- **사이드 네비**(§3.7): 계층 없는 카테고리 선택은 트리 대신 `.u4a-navlist`.

## 3. CSS 고치기 전 (필수 — cascade 확인)

공통 컴포넌트는 `shell.css`(구조/기본)와 `bootstrap-skin.css`(색·그림자·테두리) **두 곳**에 정의되고,
**bootstrap-skin이 나중에 로드돼 override** 한다. 색/box-shadow/border를 shell.css에서만 고치면 무효(변화 0).
- 바꾸기 전, 그 셀렉터·속성을 `theme/*.css` **전체에서 grep**해 로드 순서로 실제 먹는 값(보통 bootstrap-skin)을 찾아 거기서 고친다.
- `--sl-elev`·`--popover-shadow` 같은 공유 토큰을 직접 키우면 전체 영향 → 특정 컴포넌트만 바꿀 땐 그 셀렉터에 직접 지정.
- 외부 CSS 변경은 Electron 캐시로 미반영 가능 → **앱 재시작**이 반영(새로고침 안내 금지).

## 4. 자주 하는 실수 (가드레일)

- 스크립트 오류 삼키기/조용한 catch/stopPropagation 금지 — 실패는 `console.error`로 드러낸다.
- busy는 실제 이벤트로만 해제(타임아웃 눈속임 금지). 별도창은 BUSY_ON↔BUSY_OFF 짝 필수.
- 요청·원본에 없는 UX 임의 추가 금지. "통일"은 언급 속성만이 아니라 공통 컴포넌트로 전체 수렴.
- 현상 지적/궁금을 "고쳐달라"로 단정하지 말고 되묻는다. 비논리적이면 맹목 수행 말고 역제안.
- 검증은 프리뷰가 아니라 **소스 + `node --check`**로. 테스트는 사용자가 앱 재시작으로.

## 5. 완료 보고 (§16 0.1.2 + CLAUDE.md 3)

- 기능 인벤토리(기존 동작 → 구현 위치 → 검증, 누락 0)
- 각 단계 수용 기준 통과/실패 표
- §16 0 TL;DR + 컨닝시트 준수 확인, §12 6.6 체크리스트(A~J)
- 문서와 어긋났거나 추측한 부분 목록

> 공통 UX를 새로 정하거나 바꿨으면 개인 메모리 + `.analy/16` 문서 **둘 다** 갱신한다.
