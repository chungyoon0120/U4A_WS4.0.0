# 02_audit_codex — BR28 기존 바인딩 필드 위치 스크롤 검수

## 판정

**수정필요**

## 지적

### 1. [해소 확인] N건 aggregation의 기존 경로 이동이 활성 조건과 분리됐다

- 위치: `www/ws30/ws10_20/js/fnBindPopupOpen.js:867-923`, `1050-1078`
- 1차 검수 도중에는 `nd && nd.enable === true` 안에 `selectByKey()`, `lf_selRow()`, BR28의 예약 `scrollToKey()`가 모두 묶인 작업 트리를 확인했다.
- 그러나 N건 aggregation에서 `L_UIATV`로 사용하는 `l_path`는 “이번 속성에 새로 바인딩 가능한 행”이 아니라 이미 존재하는 부모 aggregation 바인딩 위치를 보여주기 위한 경로다. `CARDI === "T"`이고 TABLE 노드가 `l_path` 계열이면 `lf_setBindEnable()`의 908~911행은 자식 탐색 후 `continue`하며 그 TABLE 자체에 `enable = true`를 설정하지 않는다.
- 당시에는 `l_path`가 그 TABLE 경로와 정확히 일치하는 정상 시나리오에서도 BR28 위치 이동이 실행되지 않는 결함이었다.
- 원본 `design/js/callBindPopup.js:579-597`은 N건 `l_path` 행을 펼치고, `L_UIATV === CHILD`이면 활성 여부와 무관하게 `setSelectedIndex()`와 `setFirstVisibleRow()`를 실행한다. 현재 조건은 원본 1:1 동작을 축소한다.
- 재검수 중 최신 소스는 `L_UIATV !== ""`이면 먼저 `selectByKey()`와 BR28 rAF를 수행하고, 실제 적용 선택·추가속성 구성인 `lf_selRow()`만 `nd.enable === true`로 제한하도록 되돌아왔다. “위치 안내”와 “적용 가능한 선택”이 분리되어 N건 원본 동작이 복원됐다.
- 결론: 이 항목은 최신 작업 트리에서는 해소됐으며 열린 지적으로 계산하지 않는다.

### 2. [P2] 로드 직렬화가 rAF만 취소하여 늦게 도착한 이전 응답의 재예약을 막지 못한다

- 위치: `www/ws30/ws10_20/js/fnBindPopupOpen.js:746-815`, `1073-1077`
- `lf_loadData()` 진입 시 기존 `_selScrollRaf`를 취소하지만 진행 중인 `sendAjax()` 요청을 식별하거나 폐기하는 세대 토큰은 없다.
- 로드 A 뒤 로드 B가 시작되면 B 진입 시점에는 A의 응답과 rAF가 아직 없을 수 있다. B가 먼저 완료한 뒤 A가 늦게 완료하면 A 콜백이 공유 상태를 다시 렌더하고 새 rAF를 예약하므로, 진입부 취소만으로는 주석의 “WP1 직렬화”가 성립하지 않는다.
- 이는 BR28만의 스크롤 문제보다 기존 비동기 데이터 경합까지 포함하는 선재 위험이지만, 요청서의 “재로드/새로고침이 겹칠 때 엉뚱한 스크롤 방지” 수용 기준에는 미달한다.
- 제안: 요청 세대 번호를 증가시키고 콜백에서 최신 세대가 아니면 즉시 반환하거나, 가능하면 이전 요청 자체를 abort한다. 최소한 BR28 주석과 검수 근거를 실제 보장 범위인 “이미 예약된 rAF 취소”로 한정한다.

### 3. [P1] 미바인딩 속성으로 재오픈하면 이전 가상 스크롤 위치가 그대로 남는다

- 위치: `www/ws30/ws10_20/js/fnBindPopupOpen.js:1012-1020`, `1050-1075`, `www/ws30/ws10_20/theme/u4a-ui.js:1595-1623`, `2224-2232`
- 렌더 전 `selectByKey(null, false)`는 선택 키와 행 강조만 지우며 스크롤 컨테이너의 `scrollTop`은 건드리지 않는다.
- 공통 트리 `render()`는 가상 모드에서 `_renderVirtual(true)`를 호출하고, 이는 `setRows(..., true)`로 기존 위치를 의도적으로 보존한다. 새 행 수가 짧을 때 최대값으로 클램프할 뿐 맨 위로 초기화하지 않는다.
- 미바인딩 속성은 `L_UIATV`가 비어 후속 `scrollToKey()`도 예약되지 않는다. 따라서 이전에 깊은 필드까지 내린 뒤 닫고 미바인딩 속성으로 열면 과거 위치에서 시작한다.
- 영향: 선택 강조는 없어도 새 세션이 과거 탐색 위치를 이어받아 최초 진입 문맥이 잘못된다. BR27 선택 초기화만으로 해결되지 않는다.
- 제안: 새 팝업 세션 또는 미바인딩 데이터 렌더에서 화면 소유 스크롤 컨테이너를 명시적으로 맨 위로 초기화한다. 공통 렌더의 기본 keep-scroll 계약은 유지한다.

## 확인 결과

### 직접 바인딩 경로

- 유효하고 활성인 기존 `UIATV`는 `selectByKey(L_UIATV, true)`로 가상 윈도를 먼저 reveal하고 `lf_selRow()`로 강조·추가속성·참조필드를 복원한다.
- 그 뒤 예약된 `scrollToKey()`는 동기적으로 이어지는 `lf_setAdditLayout(true)`까지 반영된 다음 프레임에 실행되므로, Property 추가속성 패널로 트리 폭이 재배치된 뒤 위치를 다시 확정하는 순서는 타당하다.
- `scrollToKey()`는 가상 모드에서는 평탄 인덱스로 `scrollTop`을 계산하고, 비가상에서는 `scrollIntoView({block:"center"})`를 사용한다. 공통 파일 추가 수정 없이 공개 API를 올바르게 소비한다.

### rAF 닫기 수명주기

- 닫기 함수는 dialog만 닫고 예약 rAF와 진행 중인 AJAX 요청을 취소·무효화하지 않는다. 예약 rAF는 숨은 재사용 DOM의 `scrollTop`을 바꿀 수 있다.
- 닫힌 뒤 늦게 도착한 응답도 공유 `oS.TREE/zTREE`, 트리, 추가속성, busy를 갱신하고 새 rAF를 예약할 수 있다. 다음 재오픈 진입부는 그 순간 존재하는 rAF만 취소하며 이후 도착하는 구요청은 막지 못한다.
- 종료 시 rAF 취소와 요청 세대 무효화를 함께 수행해야 세션 수명주기가 닫힘 경계에서 끝난다. 이는 지적 2의 강화 근거다.

### 독립 서브에이전트 재검수 취합

- 독립 검수는 최초 작업 트리의 N건 `enable` 과잉 게이팅, 미바인딩 `scrollTop` 보존, AJAX/rAF 경합을 모두 재현했다.
- 이후 작업 트리가 변경되어 N건 위치 이동은 `enable` 조건 밖으로 복원된 것을 부모 검수자가 최신 소스에서 재확인했다. 따라서 해당 항목만 해소 처리했다.
- `render → _renderVirtual(true) → setRows(..., true)` 호출 사슬과 요청 세대 검사 부재는 최신 소스에도 그대로여서 나머지 P1/P2는 유지한다.
- 활성 Property와 일반 Aggregation은 선택→필요 시 추가속성 구성→다음 프레임 재스크롤 순서가 타당하다.

### BR27 상호작용

- 렌더 전 `selectByKey(null, false)` 초기화와, 존재하지 않거나 비활성인 키를 가상 선택 상태에 저장하지 않는 보완은 BR27 유령 선택을 막는다.
- 그러나 `enable` 검사를 BR28의 위치 안내까지 같은 조건으로 묶어 N건 경로 탐색을 차단한 것이 본 P1이다. 두 요구를 분리해야 한다.
- 미바인딩 최초 오픈은 `L_UIATV`가 비어 예약 rAF가 생기지 않으므로 첫 행 선택 회귀는 없다. 다만 기존 `scrollTop` 자체는 초기화되지 않아 안티 검수의 별도 지적처럼 과거 위치가 남을 수 있다.

## 수용 기준 점검

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 직접 Property 기존 바인딩 위치 이동 | 통과 | 유효·활성 노드 기준 |
| 원본 `setFirstVisibleRow` 의도 재현 | 통과 | N건 위치 이동이 활성 조건과 분리됨 |
| 공통 자산 무수정·공개 API 소비 | 통과 | `scrollToKey` 화면 스코프 호출 |
| 추가속성 레이아웃 뒤 위치 확정 | 통과 | rAF 순서 타당 |
| 이미 예약된 rAF 재로드 시 취소 | 통과 | `_selScrollRaf` 취소 |
| 겹친 비동기 로드 전체 직렬화 | 실패 | 늦은 이전 응답 차단 없음 |
| 닫힘 후 rAF·응답 무효화 | 실패 | 숨은 DOM 갱신 및 구응답 재예약 가능 |
| 선택·강조·추가속성 회귀 방지 | 통과 | 활성 직접 바인딩 기준 |
| N건 aggregation path 이동 | 통과 | 최신 소스에서 위치 안내 분리 |
| 최초 미바인딩 오픈 위치 초기화 | 실패 | 이전 `scrollTop` 잔존 확정 |
| JavaScript 구문 검사 | 통과 | `node --check` |

## 검증 범위

- `.audit/br28/01_request.md`의 원본 parity, 공통 API, rAF 수명주기, N건 path, BR27 상호작용 전 항목
- 원본 `design/js/callBindPopup.js:506-617`의 경로 탐색·선택·`setFirstVisibleRow` 흐름
- HTML5 `lf_loadData` 성공·빈값·오류·중첩 호출, `lf_setBindEnable`, `lf_setSelectTree`, 팝업 닫기 경로 정적 추적
- 공통 `createTree.selectByKey`·`scrollToKey`의 가상/비가상 분기 확인
- 안티 감사 결과의 미바인딩 재오픈 `scrollTop` 잔존 지적을 코드 경로와 교차 확인
- 실제 SAP 데이터 기반 Property·Aggregation 재오픈 UI 조작 테스트는 수행하지 않았다.
