# BR26 검수 결과 반영·해명 (03_response)

두 검수(코덱스·안티)의 지적을 소스로 검증한 뒤 아래와 같이 반영/반론했다.

## 종합 판정

- **안티 1건 → 반영**: 여러 개(체크) 삭제 경로에도 `_purgePrevSubtree(n)` 배선.
- **코덱스 1건(P1) → 반론(별도 이슈로 보고)**: 이벤트·설명·바인딩·팝업 수집정보 정리는 BR26 이전부터 있던 별개·광범위 결손(최상위 노드도 미정리)으로 이 이슈 범위를 넘는다.

## 지적 통합 표

| # | 검수자 | 지적 | 판정 | 근거·조치 |
|---|---|---|---|---|
| 1 | 안티 | 여러 개(체크) 삭제 시 부모만 체크·자식 미체크면 자식 `prev` 캐시가 남아 같은 불일치 재발. `del` 재귀에도 `_purgePrevSubtree` 배선 필요 | **반영** | `ws_html5_ws20_edit.js` 체크 삭제 루프에서 `_removeNodePreview(n)` 직후 `_purgePrevSubtree(n)` 추가. 정상 조작(체크 해제 시 조상까지 해제 — `designTreeSelChkbox`:460~463)에선 하위도 chk=true라 개별 처리되어 no-op이나, 부모 삭제로 함께 사라지는 잔여 하위의 `prev`를 확실히 정리(단건 삭제와 동일 논리, 멱등·가드). |
| 2 | 코덱스 (P1) | 원본 `lf_deleteTreeLine`은 자식마다 `delUiClientEvent(T_CEVT)`·`delDesc(T_DESC)`·`designUnbindLine(_BIND_AGGR)`·`removeCollectPopup(oAPP.attr.popup)`도 정리하는데, `_purgePrevSubtree`는 `prev`+`UA015`만 지워 고아 데이터 잔존 | **반론(별도 이슈)** | 아래 [코덱스 P1 상세 해명] 참조. BR26 측정·보고 범위(`oAPP.attr.prev` 잔존)를 넘는 선재(先在) 결손이라 이 티켓에서 확장하지 않음(원본우선·"이상점은 보고만" 규칙). 별도 이슈 권고. |

## 코덱스 P1 상세 해명 (반론 근거)

코덱스 지적 자체는 사실이나, **BR26의 수정으로 새로 생긴 문제가 아니라 그 이전부터 있던 별개의 광범위 결손**이다.

1. **최상위 노드도 원래 정리 안 함(선재 결손)**: HTML5 WS20 단건 삭제 흐름(`ws_html5_ws20_edit.js` `_deleteUI`/`_removeNodePreview`)에는 `delUiClientEvent`·`delDesc`·`designUnbindLine`·`removeCollectPopup` **호출이 하나도 없다**(grep 확인, 호출 0). 즉 자식뿐 아니라 **삭제되는 최상위 노드 자신의** 이벤트·설명·바인딩·팝업 수집정보도 BR26 이전부터 정리되지 않았다. 코덱스도 제안 말미에 "최상위 노드에도 동일 정리가 필요"라고 적어 이것이 최상위까지 걸친 문제임을 인정한다.
2. **BR26의 측정·보고 범위**: 노션 BR26은 "부모 UI 삭제 후 하위 UI 정보가 `oAPP.attr.prev`에 잔존"이며, 계측도 `oAPP.attr.prev`와 그 안 `_T_0015`만 확인됐다(테스터: "BUSY·실제 삭제 처리 함수는 이번 계측에서 확인 안 됨 → 판정·원인에서 제외"). 변경한 버튼들은 `text` 프로퍼티(=`prev[OBJID]._T_0015` 행)만 가졌고, 이는 `prev[OBJID]` 키 삭제로 함께 제거된다. 보고·측정된 불일치는 이번 수정으로 완결.
3. **확장 비용·규칙**: 코덱스 제안대로 하려면 HTML5 WS20 코어에 없는 `delUiClientEvent`/`delDesc`/`designUnbindLine`을 신규 이식하고, 일관성을 위해 최상위 노드 정리까지 함께 손대야 한다 → 보고된 버그를 크게 넘는 개선 작업. 프로젝트 최우선 규칙("이상한 점·개선안이 보여도 코드에 반영하지 말고 보고만, 별도 지시 있을 때만")에 따라 **이 티켓에선 확장하지 않고 별도 이슈로 보고**한다.

> 별도 이슈 권고: "UI 삭제 시 T_CEVT·T_DESC·_BIND_AGGR·oAPP.attr.popup 고아 정리(최상위+하위, 단건+멀티) — 저장/복사/undo/재바인딩에서 고아 소비 방지". 이식 필요 함수 포함.

## 반영 위치 (코드)

- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - 신규 `_purgePrevSubtree(n)` — 하위 재귀 `prev`+`UA015` 정리(원본 `uiDesignArea.js:6634~6669` 재귀부 1:1).
  - 단건 삭제(`_deleteUI` YES 분기): `_removeNodePreview(oNode)` 직후 `_purgePrevSubtree(oNode)`.
  - **[03 반영]** 여러 개(체크) 삭제 루프: `_removeNodePreview(n)` 직후 `_purgePrevSubtree(n)`.
- `node --check` 통과. 백업 `_ws_html5_ws20_edit.js.br26bak`.

## 검수자 공통 통과 확인(재인용 아님, 요약)

- 중첩(3단 이상) 재귀 정리, 최상위/하위 책임 분리(이중 삭제·이중 destroy 없음), post-order(자식 먼저) 순서, undo 스냅샷·선택·변경표시·팝업 갱신 순서 불변, BUSY·단축키 잠금 대칭 불변 — 두 검수 모두 통과 판정.
