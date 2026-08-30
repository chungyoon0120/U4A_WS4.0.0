# 02_audit_agy — BR54 ATTRIBUTE 값 변경 시 특정 속성 전용 예외처리(attrChangeException) 검수

## 판정

**❌ 수정 필요 — P1 1건, P2 1건**

---

## 1. 서브에이전트 2기 심층 팩트체크 결과 (2차 종합)

본 검수는 "한번 더 면밀히 분석" 지시에 따라 Codex의 리포트와 병행하여 실제 UW13 하위 모듈(`imageCompress.js`)의 HTML5 런타임 호환성, UI5 모델/컨트롤 의존성 크래시, 그리고 판정 인프라 손상 시의 fail-open 동작을 디버깅 레벨에서 극한으로 팩트체크한 결과입니다.

### [P1 결함] 실제 예외 모듈(imageCompress.js)이 UI5 전용 코드로 작성되어 HTML5 런타임에서 즉시 TypeError 크래시 (에이전트 D 증명)
- **위치**: `ws_html5_ws20_attr.js:3908~3915`, `design/attributesArea/imageCompress.js:40~185`
- **결함 내용**:
  1. UW13 예외 하위 모듈인 `imageCompress.js`는 `new sap.ui.model.json.JSONModel`, `sap.m.Panel`, `sap.f.GridList`, `dialogViewer(sap.m.Dialog)` 등 순수 UI5 컨트롤을 직접 생성하며, 적용 시 `oAPP.fn.attrChangeProc`를 호출합니다.
  2. 그러나 HTML5 본창(`ws_html5_shell.js`)은 UI5 라이브러리를 로드하지 않는 최소 스텁 환경이므로, `imageCompress.js:72`의 `JSONModel` 생성부터 즉시 `TypeError`가 발생합니다.
  3. 또한 `oAPP.fn.attrChangeProc` 함수도 HTML5에 존재하지 않아 커밋 경로가 붕괴됩니다.
- **영향**: 해당 속성 변경 시 이미지 압축 설정 팝업이 전혀 열리지 않고 reject 로그만 남긴 채 조용히 종료되어, **예외처리 기능 자체가 런타임에 완전히 불능(Dead Feature)** 상태가 됩니다.
- **수정 방안**: `imageCompress.js`를 HTML5 표준(Bootstrap/공통 `<dialog>`/u4a-ui 기반 및 `fnWs20AttrChange` 연동)으로 컨버전하거나, HTML5 전용 예외 핸들러로 이식해야 합니다.

### [P2 결함] 대상 판정 실패 시 fail-open 처리로 예외 대상 값이 일반 경로로 수집·저장될 위험 (에이전트 C 증명)
- **위치**: `ws_html5_ws20_attr.js:3890~3905`, `4018~4024`
- **결함 내용**: `_isAttrChangeException` 판정 중 throw가 발생하거나, 패치가 켜져 있는데 `S_CODE.UW13`이 미구성인 경우 `_sExcUW13 = null`로 축약되어 일반 값 변경 파이프라인(`setChangeFlag`, `attrChgAttrVal` 등)으로 fall-through(Fail-Open)됩니다.
- **영향**: 복합 JSON 포맷을 요구하는 특수 속성에 사용자의 단순 텍스트 입력이 일반 값으로 백엔드에 저장되어 데이터 오염 및 앱 크래시를 유발할 수 있습니다.
- **수정 방안**: 패치 활성 상태에서 판정 인프라 손상 또는 판정 함수 throw 시 즉시 처리를 중단하고 락을 해제하는 **Fail-Closed** 가드로 보완해야 합니다.

---

### [확인된 정상 범위]
1. `_isAttrChangeException`의 판정 로직(`UHAK901369` 패치 검사 $\rightarrow$ `UW13` 검색) 및 UNDO 직후의 호출 위치는 원본과 일치합니다.
2. 판정(동기)/실행(비동기) 분리 설계로 대상이 아닌 일반 속성(99.9%)에서는 20여 개 호출처의 동기 완료 계약을 안전하게 보존합니다.
3. 4개 분기 전수에서 `_releaseAttrChangeLock()`을 통한 4대 잠금(busy, 단축키, 자식창, 재진입) 해제 대칭성이 유지됩니다.

---

## 2. 종합 평가

BR54 이슈는 게이트웨이 레벨의 판정/실행 분리 및 락 대칭성 설계는 훌륭하나, **동적 로드 대상인 실제 예외 모듈(`imageCompress.js`)이 HTML5 런타임에서 UI5 컨트롤 부재로 즉시 TypeError 크래시를 일으키는 치명적 호환성 결함(P1)**과 **판정 실패 시 일반 경로로 저장되는 fail-open 결함(P2)**이 명확히 확인되었습니다.
`imageCompress`의 HTML5 컨버전 및 fail-closed 가드 보완을 권고하며 **❌ 수정 필요** 판정을 확정합니다.
