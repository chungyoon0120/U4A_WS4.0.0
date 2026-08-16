# 02_audit_agy — BR41 UI 삭제 시 클라이언트 이벤트·HTML content(T_CEVT) 잔존 제거

## 판정

**통과**

UI 삭제 시 `T_CEVT` 내부의 수집 정보(JS 클라이언트 이벤트, HTML Content)가 지워지지 않고 잔존하던 문제를 해결하기 위해, 원본 `delUiClientEvent` 기능을 완벽하게 이식하고 단건 및 멀티 삭제의 모든 하위 트리 재귀 경로에 대칭성을 갖추어 정상 배선하였음을 확인했습니다.

## 지적

없음.

## 검수 결과

| 검수 항목 | 결과 | 확인 근거 |
|---|---|---|
| **원인 및 이식 정확성** | 통과 | 원본 `uiDesignArea.js:2034` 에 정의된 `delUiClientEvent` 함수를 HTML5 빌드 규격에 맞는 방어가드를 포함해 1:1로 정확하게 이식했습니다. HTML content(`"HM"`) 및 클라이언트 이벤트(`"JS"`) 수집건의 키 식별 및 `splice` 인덱스 처리가 완벽히 정합합니다. |
| **삭제 경로 배선 범위** | 통과 | 단건 삭제(`_deleteUI` -> `_removeNodePreview` / `_purgePrevSubtree`) 및 멀티 삭제(`designTreeMultiDeleteItem` -> `_removeNodePreview` / `_purgePrevSubtree`)의 삭제 본체와 하위 트리 재귀 순회 경로 전체에 `delUiClientEvent`가 빠짐없이 배선되어, 삭제된 부모 UI와 함께 유실되는 자식 UI들의 `T_CEVT` 정보도 누수 없이 전량 청소됩니다. |
| **호출 순서의 타당성** | 통과 | `delUiClientEvent`가 삭제되는 UI의 기존 속성(`prev[OBJID]._T_0015`) 정보를 조회해야 하므로, `delete oAPP.attr.prev[OBJID]`를 수행하여 메모리를 해제하기 **직전에** 선호출되도록 논리 순서(원본 6648 < 6663)를 바르게 구성했습니다. |
| **중복 호출 안전성 (no-op)** | 통과 | 멀티 삭제 시 하위 노드가 개별 삭제 과정에서 먼저 지워진 경우, 상위 부모 노드 처리 단계의 재귀 청소에서 중복으로 `delUiClientEvent`를 마주하더라도 `prev[OBJID]`의 존재 여부를 가드로 사전에 검증(`if (!oPrev) return;`)하므로, 크래시나 에러 없이 멱등적(no-op)으로 안전하게 처리됩니다. |
| **무관한 데이터 보호** | 통과 | 삭제 대상 UI의 고유한 `OBJID` 및 그와 결합된 식별키를 명시 매칭하여 `T_CEVT`에서 지우므로, 삭제되지 않고 남아있는 타 UI 엘리먼트들의 수집 데이터가 오삭제되는 부작용이 없습니다. |
| **동기 루프 및 스코프 안전성** | 통과 | `for` 루프 내부의 `findIndex` 검색 콜백이 `lt_evt[i]` 등의 루프 변수를 참조하지만, 동기식 함수로 즉시 평가되므로 자바스크립트의 지연 평가 클로저 버그(Closure Trap)가 발생하지 않고 정합하게 동작합니다. |
| **Fail-safe 대책** | 통과 | 삭제 배선 호출 구문 전체를 개별 `try-catch` 블록으로 감싸 두어, 메모리 정리 도중 예외가 나더라도 메인 디자인 영역의 노드 트리 삭제 트랜잭션 및 미리보기 갱신 등의 라이프사이클이 멈추거나 꼬이지 않도록 견고하게 방어되었습니다. |

## 제안 (잠재 결함 리스크 해소를 위한 제안)

1. **중복 데이터 존재 시 고아 데이터 방치 리스크 (원본 상속)**:
   - **현상**: `T_CEVT`는 구조상 `OBJID`와 `OBJTY`가 고유해야 하나, 모종의 오류나 중복 이벤트 생성 버그로 인해 `T_CEVT` 배열 내에 동일 키(`sKey`, `"JS"`)를 가진 중복 데이터가 쌓여있을 경우, `findIndex`는 가장 먼저 검색되는 **최초 1건**만 splice하고 루프가 종료되어 나머지 중복건은 영구적으로 `T_CEVT`에 남게 되는 한계(원본 한계 상속)가 있습니다.
   - **대안**: 더욱 견고한 정리를 위해 `findIndex` 루프 대신 `Array.prototype.filter`를 활용해 대상을 완전히 제거해주는 리팩토링을 향후 검토해볼 수 있습니다.
     ```javascript
     // 예시
     A.T_CEVT = A.T_CEVT.filter(function (a) {
         return !(a.OBJID === sKey && a.OBJTY === "JS");
     });
     ```

2. **호출부 예외 로깅 보완 (디버깅 편의)**:
   - **현상**: `ws_html5_ws20_edit.js` 394행 및 414행의 `delUiClientEvent` 호출부는 `try { ... } catch (e) { }` 형태로 예외를 완전히 삼키고 있습니다. 이로 인해 혹시 모를 내부 TypeError 발생 시 원인을 파악하기 어렵습니다.
   - **대안**: 프로젝트 규칙 `code.md` (오류 삼킴·조용한 catch 금지)에 부합하도록, 에러 발생 시 최소한의 디버깅 로깅(`console.error("[HTML5][delUiClientEvent] cleanup error:", e);`)을 추가하는 편을 권장합니다.

3. **호환성 오버라이드 리스크 차단**:
   - **현상**: 만약 `uiDesignArea.js`(UI5 전용 원본)가 런타임에 뒤늦게 병합 로드될 경우, 그 내부의 구버전 `delUiClientEvent` 함수가 HTML5 런타임의 안전한 덮어쓰기 버전(`oAPP.fn.delUiClientEvent`)을 오버라이딩하여 복원한 방어가드가 무력화될 취약점이 있습니다.
   - **대안**: 현재 HTML5 빌드 구조상 `uiDesignArea.js`는 메인 호스트에 완전히 미로드되므로 실재적인 영향은 없으나, 향후 병합 빌드 정책 등이 추가될 경우를 대비해 `prev.js` 오버라이드 가드 등과 유사한 형태의 로드 게이트 관리가 권장됩니다.
