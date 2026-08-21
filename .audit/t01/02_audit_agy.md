# 02_audit_agy — T01 끌어놓기(드롭)로 바인딩된 집계에 자식 추가 시 안내 메시지 복원

## 판정

**수정필요 (보완 대기)**

최신 원본 `chkAggrRelation` 구조체 반환 사양 이식 및 DnD/Wizard 두 호출처로의 구조 소비 배선은 완벽하고, Busy/락 해제 메커니즘도 대칭을 맞추어 훌륭하게 설계되었습니다.
그러나, 서브에이전트와의 교차 분석 및 정밀 팩트체크를 거친 결과 **런타임 시 특정 조건에서 예외(TypeError)를 유발하거나 락이 해제되지 않고 영구 프리징(Lock Leak)을 일으킬 수 있는 결함들**이 추가로 진단되어 최종 수정을 요구합니다.

---

## 지적 및 보완요구 사항

### 1. [P1 - 치명결함] `_aggrSelectDialog` 확정(`_confirm`) 시의 예외로 인한 영구 락 누수(Lock Leak) 취약점
- **현행**: `dnd.js` 내 다중 후보군 선택 다이얼로그의 확정 함수 `_confirm()`
  ```javascript
  function _confirm() {
      if (bDone) { return; }
      bDone = true;
      var ls_0023 = oAPP.DATA.LIB.T_0023.find(function (a) { return a.UIATK === sSelKey; });
      _cleanup();
      retfunc(ls_0023, i_drag, i_drop);
  }
  ```
- **결함**: `retfunc` (DnD 드롭 콜백 또는 Wizard 콜백) 호출을 감싸는 `try-catch` 또는 `try-finally` 블록이 존재하지 않습니다. 만약 `retfunc` 내부에서 비동기/동기 예기치 못한 런타임 크래시가 발생하고, 그것이 콜백 내부에서 온전히 catch되지 않으면, 호출 스택을 따라 예외가 터지며 `BUSY_OFF` 처리에 도달하지 못한 채 **화면이 영구적으로 잠겨(Lock Leak) 앱 조작이 불가능**해집니다.
- **수정안**: `retfunc` 호출 시 에러가 나더라도 무조건 Busy 및 단축키 락을 해제할 수 있도록 `try/finally` 안전망을 보강해야 합니다.
  ```javascript
  try {
      retfunc(ls_0023, i_drag, i_drop);
  } finally {
      // 필요 시 안전 장치 해제
  }
  ```

### 2. [P2 - 안정성] `chkAggrRelation` 내 Javascript Null / TypeError 유발 취약점 보완
함수 내에서 원천 데이터 및 속성을 조회할 때 방어가드가 미흡하여 런타임 `TypeError` 크래시를 발생시키고 드롭 동작 전체를 중단시킬 위험이 있습니다. 아래 3곳의 가드 보강을 요구합니다.

- **`oAPP.attr.prev` 참조 누수 방어** ([ws_html5_ws20_dnd.js:433](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_dnd.js#L433))
  - **현행**: `var _sModel = (oAPP.attr.prev[tOBJID] && oAPP.attr.prev[tOBJID]._MODEL) ? oAPP.attr.prev[tOBJID]._MODEL : {};`
  - **결함**: `oAPP.attr.prev` 객체 자체가 `undefined`일 때 `prev[tOBJID]` 참조 시점에서 즉시 TypeError 크래시가 발생합니다.
  - **수정안**: `var _sModel = (oAPP.attr && oAPP.attr.prev && oAPP.attr.prev[tOBJID] && oAPP.attr.prev[tOBJID]._MODEL) ? oAPP.attr.prev[tOBJID]._MODEL : {};`
- **라이브러리 DB 배열 (`T_0023` 등) 부재 가드** ([ws_html5_ws20_dnd.js:423, 432](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_dnd.js#L423))
  - **현행**: `oAPP.DATA.LIB.T_0023.filter(...)` 및 `oAPP.DATA.LIB.T_0027.filter(...)`
  - **결함**: 라이브러리 테이블 데이터 로딩 누락 시 `.filter()`가 존재하지 않아 크래시가 발생합니다.
  - **수정안**: `(oAPP.DATA.LIB.T_0023 || []).filter(...)` 및 `(oAPP.DATA.LIB.T_0027 || []).filter(...)` 형식으로 폴백 배열 가드를 구성해야 합니다.
- **`UIADT` 속성 Null 방어** ([ws_html5_ws20_dnd.js:437](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_dnd.js#L437))
  - **현행**: `_s0023.UIADT.toUpperCase()`
  - **결함**: 메타데이터 정의 오류 등으로 `UIADT` 값이 비어있을 경우, `toUpperCase()` 호출 시 즉시 크래시가 발생합니다.
  - **수정안**: `(_s0023.UIADT || "").toUpperCase()` 로 Null 방어를 보강해야 합니다.

### 3. [P3 - 사용성] 메시지 클래스 조회 실패 시 빈 토스트/안내 노출 위험 보완
- **현행**: `chkAggrRelation` 내부의 `try-catch` 블록(428행, 452행)에서 예외를 정상 catch하여 잠금 고착은 막아주나, `_sRes.RTMSG`가 빈 문자열(`""`) 상태로 리턴됩니다.
- **결함**: 화면에 사유가 비어있는 안내 팝업이나 토스트가 발생하여 조용히 취소된 것처럼 느껴지는 사용성 결함이 있습니다.
- **수정안**: `catch` 블록 내에서 `_sRes.RTMSG`에 최소한의 대체 텍스트(예: `"이동 가능한 aggregation이 존재하지 않습니다(001)"`, `"추가 불가: 바인딩 설정 제한(002)"` 등)를 하드코딩으로 세팅해주는 폴백 처리를 보강해야 합니다.

---

## 긍정적 검증 요소 (양호)

1. **레거시 하위 호환성 (배열 `.length` 참조 방어)**:
   - `chkAggrRelation` 이 구조체형 반환으로 바뀌었으나, 최종 `_fin()` 단계에서 반환값에 직접 `.length = _sRes.T_SEL.length` 프로퍼티를 동적으로 주입하여 리턴하므로, 기존 레거시 함수나 타 모듈에서 반환된 객체의 `.length`를 직접 읽는 구조(Array 취급 계약)에서도 에러를 내지 않고 정합하게 호환됩니다.
2. **사전점검 폴백 강건성**:
   - `wizard.js` 등에서 `_aggrRes.RTMSG || _mw("280")` 처럼 메시지 미조회 시 280 및 262 번 코드로 안전하게 3항 폴백이 되어 있어 무문구 오인 현상을 한층 방어하고 있습니다.
3. **트리 렌더링 오버헤드 0%**:
   - `t01` 관련 연산은 가볍고 임시 로컬 변수 상에서 즉시 소멸되므로, `parseTree2Tab`이나 `InsertAggregation` 등 대규모 트리 재렌더링의 성능(Reflow/Overhead)에는 영향을 주지 않습니다.

## 제안

- 상기 P1, P2, P3 등급의 안정성 취약점 보완(특히 `_confirm` 내부 `retfunc`에 대한 안전망 및 DnD Null check)을 반영한 뒤 다시 검수를 요청해주시기 바랍니다.
