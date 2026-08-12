# 04_audit_final — BR24 이벤트 콤보박스 누락 오판(P1/P2) 보완 검수 결과

## 판정

**통과 (Pass)**

---

## 1. 검수 개요 및 배경

- **대상 기능**: WS20 속성 패널의 서버 이벤트 콤보박스(`UIATY="2"`)
- **이전 지적 (코덱스)**:
  - **P1**: 서버 이벤트 목록 조회(`getServerEventList`) 실패 시 빈 목록이 반환됨에도 이를 성공으로 간주하여 기존 정상 이벤트를 "목록에 없음"으로 오판하고 빨간 테두리(오류)를 치는 문제가 있었음.
  - **P2**: 오류 표시 시 콤보박스의 테두리만 빨간색이어야 하는데, 글자색까지 빨간색으로 변하는 과도한 CSS 적용이 있었음.
- **수정 정책**: 
  - P1: 누락 검증 로직을 `Promise.then` 에서 분리하여 서버 호출 "성공 콜백(`fnOk`)" 내부로 이동. 실패 시에는 기존 상태 보존.
  - P2: `ws20.css`에서 `color: var(--error)` 규칙 제거.

---

## 2. 검수 포인트별 대조 검증 결과

| # | 검수 포인트 | 코드 위치 및 검증 내용 | 결과 |
|---|---|---|---|
| 1 | **P1 (조회 실패 오판 방지)** | [ws_html5_ws20_attr.js:4780-4813](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/js/ws_html5_ws20_attr.js#L4780-L4813)<br>누락 검증 및 오류 마킹 로직이 통신 성공 시에만 호출되는 `fnOk` 콜백 내부로 정확히 이동함. `getServerEventList(fnOk, false)` 형태로 호출되어 통신 실패, 세션 만료 등의 에러 상황에서는 `fnOk`가 실행되지 않아 기존 이벤트 상태가 안전하게 보존됨을 확인함. | **통과 (Pass)** |
| 2 | **P2 (과도한 텍스트 색상 제거)** | [ws20.css:1157-1160](file:///c:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/www/ws30/ws10_20/WS10/css/ws20.css#L1157-L1160)<br>`.u4aWs20AttrCombo.err .u4a-combo__text { color: var(--error); }` 속성이 완전히 삭제되었으며, `border-color: var(--error)` 로 테두리 렌더링에만 오류 스타일이 적용되도록 변경됨을 확인함. | **통과 (Pass)** |

---

## 3. 정적 구문 대조

- **P1 반영 후 (`ws_html5_ws20_attr.js`)**:
  ```javascript
  var fnOk = function (aDdlb) {
      aDdlb = aDdlb || [{ KEY: "", TEXT: "", DESC: "" }];
      // ... (T_DDLB 매핑 및 누락 판정 로직) ...
      if (!bHas && sAttr.UIATV) {
          aNew.unshift({ value: sAttr.UIATV, text: sAttr.UIATV });
          sAttr.valst = "Error"; sAttr.valtx = undefined;
          oCombo.classList.add("err");
      } else {
          if (sAttr.valst === "Error") { sAttr.valst = undefined; sAttr.valtx = undefined; }
          oCombo.classList.remove("err");
      }
      oCombo.setItems(aNew);
  };
  return oAPP.fn.getServerEventList(fnOk, false).catch(function (e) {
      console.error("[HTML5][WS20][attr] 서버이벤트 목록 조회 실패:", e && e.message);
  });
  ```
- **P2 반영 후 (`ws20.css`)**:
  ```css
  .u4aWs20AttrCombo.err,
  .u4aWs20AttrCombo.err:not(.is-disabled),
  .u4aWs20AttrCombo.err:focus-visible,
  .u4aWs20AttrCombo.err[data-open="true"] { border-color: var(--error); }
  ```

---

## 4. 종합 평가

코덱스가 지적했던 두 가지 핵심 결함(P1: 검증 시점 오판, P2: 과도한 CSS 마킹)이 정확하게 조치되었습니다. 로직이 원본의 의도(성공 경로에서만 누락 검증 수행 및 오류 표시는 테두리만 적용)와 완전히 일치하므로 최종 **통과(Pass)** 판정합니다.
