# 02_audit_agy — BR52 ATTRIBUTE 오류 항목으로 이동 시 상단 요약영역 접기·해당 행 선택 강조 검수

## 판정

**❌ 수정 필요 — P2 3건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 재렌더 시 선택 상태 영속성, 공통 화면 UX 표준 기반 테마 텍스트 대비율, 그리고 원본 `setAttrFocus`의 I/W value-state 분기 처리를 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P2-1 결함] 선택 상태가 DOM에만 있어 속성 재렌더 시 즉시 소실 (에이전트 C 증명)
- **위치**: `ws_html5_ws20_attr.js:3252~3256`, `6224~6288`
- **결함 내용**: `setAttrFocus`는 DOM 요소에만 `aria-selected="true"`를 직접 지정할 뿐 `oAPP.attr` 상태에 선택 키(`UIATK`)를 보관하지 않습니다.
- **영향**: 속성 값 변경(`fnWs20AttrChange`)이나 필터 전환 등으로 `fnRenderWs20AttrRows()`가 재실행되면 `ROWS.innerHTML = ""`로 인해 기존 선택 강조가 완전히 소실됩니다 (`.analy/16_공통_화면UX_표준.md:347` 렌더 세대 간 선택 상태 유지 규약 위반).
- **수정 방안**: 선택된 `UIATK`를 `oAPP.attr._sSelectedUiatk` 등에 보관하고, `fnRenderWs20AttrRows()` 행 생성 루프에서 해당 키와 일치하는 행에 `aria-selected="true"`를 자동 복원하도록 개선해야 합니다.

### [P2-2 결함] 공통 선택 규약(color, 굵기, accent inset) 누락으로 특정 테마 가독성 파탄 (에이전트 D 증명)
- **위치**: `ws20.css:1040~1043`
- **결함 내용**: `.u4aWs20AttrRow[aria-selected="true"]`에 `background: var(--ws20-sel-bg)`만 정의되어 있고 `color: var(--selected-text)`, `font-weight: 600`, `box-shadow: inset 0.1875rem 0 0 0 var(--accent)` 3대 공통 규약이 누락되었습니다.
- **영향**: 진한 채도/명도의 선택 배경을 사용하는 테마(`horizon_95` 1.21:1, `horizon_mac` 3.88:1, `horizon_suse` 3.65:1)에서 기본 검은색 텍스트가 짙은 배경에 묻혀 **심각한 가독성 저하 및 텍스트 뭉개짐**이 발생합니다.
- **수정 방안**: `.analy/16` §3.7 및 `theme/shell.css` 표준에 맞추어 `color: var(--selected-text)`, `font-weight: 600`, `box-shadow: inset 0.1875rem 0 0 0 var(--accent)`를 추가해야 합니다.

### [P2-3 결함] 원본의 Information/Warning value-state 분기 누락 (에이전트 C 증명)
- **위치**: `ws_html5_ws20_attr.js:3238~3242`
- **결함 내용**: 원본 `uiAttributeArea.js:8203~8224`에는 `case "I": valst = "Information"`, `case "W": valst = "Warning"` 분기가 존재하나, 현행 코드는 `E`와 `S`만 처리하고 `I`/`W`는 `default: break;`로 누락되어 있습니다.
- **수정 방안**: 원본과 동일하게 `case "I"`와 `case "W"` 매핑을 복원해야 합니다.

---

### [확인된 정상 범위]
1. 대상 행 강조 → 헤더 접기(`_attrHeaderExpanded(false)`) → smooth scroll → rAF focus 실행 시퀀스는 원본과 일치합니다.
2. 상단 접기의 동기 `scrollTop` 보정과 행 `scrollIntoView` 간의 스크롤 충돌은 없습니다.
3. TYPE 미지정 일반 이동 경로에서도 상단 접기/포커스가 정상 수행됩니다.

---

## 2. 종합 평가

BR52 이슈는 상단 접기 및 스크롤/포커스 기본 흐름은 훌륭하게 복원되었으나, **재렌더 시 선택 상태 소실(P2-1), 공통 선택 CSS 규약 누락에 따른 테마 대비 저하(P2-2), I/W value-state 분기 누락(P2-3)**의 3건의 P2 결함이 명확히 확인되었습니다.
해당 항목들을 보완하는 수정을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
