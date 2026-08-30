# 02_audit_agy — BR53 미등록 서버이벤트 콤보 오류 시 해당 행 이동·포커스 검수

## 판정

**❌ 수정 필요 — P2 2건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 비동기 스크롤 대기 중 DOM 분리 시 콤보 팝오버 생명주기, 이전 `sAttr` 오염 위험성, 그리고 W3C rAF 스펙 기반의 창 최소화/비활성화 시 Promise Pending 지속 여부를 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P2-1 결함] 대기 중 DOM 분리(detached element) 시 body에 고아 팝오버 오픈 및 이전 `sAttr` 데이터 오염 (에이전트 C 증명)
- **위치**: `ws_html5_ws20_attr.js:5671~5727`, `theme/u4a-ui.js:221~241`
- **결함 내용**: `_attrWaitScrollIdle()` 또는 비동기 통신 대기 구간 동안 사용자가 다른 트리 노드를 클릭하여 `fnRenderWs20AttrRows()`가 실행되면, 이전 행의 `oCombo`는 DOM에서 제거(`oCombo.isConnected === false`)됩니다. 그러나 `createSelect`의 `_done` 및 `_open`에는 `isConnected` 가드가 없어, 분리된 `oCombo`를 기준으로 `document.body`에 `.u4a-combo__list`를 띄웁니다.
- **영향**: 뷰포트 좌상단(`0, 0`)에 고아 드롭다운 목록이 뜬금없이 나타나며, 사용자가 이 목록을 클릭하면 이전 노드의 `sAttr` 클로저에 값을 써서 **이전 노드의 모델 데이터 오염 및 예기치 않은 속성 변경 이벤트가 발생**합니다.
- **수정 방안**: `theme/u4a-ui.js`(`_done`, `_open`, `_select`) 및 `ws_html5_ws20_attr.js`(`onOpen` 체인)에 `if (!oCombo || !oCombo.isConnected) { return; }` 가드를 추가해야 합니다.

### [P2-2 결함] `_attrWaitScrollIdle`의 "최대 40프레임"은 rAF 안에서만 증가하여 창 숨김/최소화 시 무기한 Pending 가능 (에이전트 D 증명)
- **위치**: `ws_html5_ws20_attr.js:3204~3218`
- **결함 내용**: W3C / Blink 렌더링 엔진 스펙상 창 최소화나 백그라운드 탭 전환(`document.hidden === true`) 시 rAF 큐 처리는 전면 중단(0Hz)됩니다. 따라서 `iTick` 카운터가 증가하지 못해 `iTick > 40` 탈출 조건이 영원히 발동하지 않습니다.
- **영향**: Promise가 무기한 pending 상태로 남아 `oCombo.dataset.loading="true"`에 고착되며, 창 복원 시 뒤늦은 실행으로 1번 고아 팝오버 경쟁을 가속화합니다.
- **수정 방안**: rAF 프레임 관찰과 함께 실제 경과 시간(Wall-clock time) 기반의 `setTimeout(finish, 500)` 타이머를 병행 배치(Dual-Guard)하여 어떤 환경에서도 결정론적으로 Promise가 settle되도록 보강해야 합니다.

---

### [확인된 정상 범위]
1. 미등록 이벤트 판정 시 `setAttrFocus` 호출 $\rightarrow$ 안내문구 재설정 $\rightarrow$ 스크롤 안정화 $\rightarrow$ 콤보 목록 오픈의 기본 시퀀스는 원본 `uiAttributeArea.js:1091~1133`과 완벽히 일치합니다.
2. `bKeepRow: true`는 DOM 분리를 방지하는 필수 조치이며 기존 호출처(`fnWs20SelectUI` 등)에 사이드 이펙트가 없습니다.
3. `.u4aWs20AttrRowVal .u4a-combo` 선택자 교정으로 DDLB 콤보 div 요소에 대한 스크롤 및 포커스가 정상 수행됩니다.

---

## 2. 종합 평가

BR53 이슈는 미등록 서버이벤트의 이동·포커스 및 DDLB 선택자 교정이라는 핵심 목적을 훌륭하게 달성하였으나, **비동기 대기 중 노드 전환 시 고아 팝오버가 떠서 이전 데이터를 오염시키는 결함(P2-1)**과 **rAF 중단 시 무기한 Pending 위험(P2-2)**이 명확히 확인되었습니다.
두 결함을 방어하는 `isConnected` 가드 및 `setTimeout` 듀얼 가드 보완을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
