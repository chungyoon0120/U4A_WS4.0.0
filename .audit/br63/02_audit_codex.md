# BR63 Codex 검수 결과

## 판정

**수정필요**

C1(`setAdditialListData()` 제거)은 원본과 정확히 일치하며 BR63의 값 초기화 원인을 제거합니다. 다만 C2(`setAdditBindButtonEnable(true)`)는 원본에서 그보다 먼저 완료되는 `await moveDesignPage()`를 함께 복원하지 않은 채 실행돼, 동일속성 처리 화면/전환 중 잠가 둔 추가속성 바인딩 버튼을 조기에 다시 활성화하는 P1 경쟁이 생깁니다.

## 지적

### 1. [P1] C2가 원본의 화면 복귀 완료보다 먼저 실행되어 동기화 중 중첩 바인딩을 허용합니다

- 위치: `www/ws30/ws10_20/Popups/bindPopup/wsDesignHandler/bindBroadcast.js:114-135`
- 원본 `U4A_WS_DESIGN/Popups/bindPopup/wsDesignHandler/broadcastChannelBindPopup.js:277-282`는 `await oAPP.attr.oDesign.fn.moveDesignPage()`가 끝난 **뒤** `setAdditBindButtonEnable(true)`를 호출합니다. 즉 버튼 재활성은 디자인 트리 복귀/동일속성 화면 teardown 완료 뒤라는 순서 계약입니다.
- HTML5 `_fnRebuild`에는 `moveDesignPage()`가 없고, C2가 즉시 버튼을 활성화한 뒤 같은 콜백의 finally에서 busy까지 끕니다(:120, :133-135).
- 실제 도달 경로가 있습니다. 동일속성 일괄 적용은 `designArea.js:735-750`에서 각 `attrSetBindProp`을 호출하고, 공용 `attrChange`가 `bindWrite.js:182-193`에서 `designBroadcastUpdate()`를 rAF로 예약합니다. 이어 호출부는 `designArea.js:765-772`에서 260ms 슬라이드인 `await moveDesignPage()`를 기다립니다. 이 사이 WS20 왕복 `UPDATE_DESIGN_DATA`가 돌아오면 `_fnRebuild`가 C2와 busy-off를 먼저 수행할 수 있습니다.
- 동일속성 화면 진입 시 `syncBindScreen.js:233-238`이 버튼을 명시적으로 비활성화하고 `bSyncEqualityScreenActive=true`로 둡니다. 하지만 C2는 이 플래그를 확인하지 않습니다. 우측 버튼 클릭 핸들러(`additInfoArea.js:125-140`)와 `onMultiAdditionalBind`에도 동기화 화면 활성 가드가 없어, 화면 전환/일괄 적용 continuation이 아직 진행 중인 동안 두 번째 추가속성 바인딩을 시작할 수 있습니다.
- 그 결과 전역 busy가 조기에 풀리고 같은 T_0014/T_0015/MAIN staging 값을 대상으로 중첩 쓰기·추가 방송이 가능해집니다. 이는 단순 버튼 표시 문제가 아니라 원본이 보장한 직렬화와 잠금 순서를 깨는 데이터 변경 경쟁입니다.

제안: 원본처럼 UPDATE_DESIGN_DATA 처리에서 `moveDesignPage()` 완료를 await한 뒤 버튼 활성·busy 해제를 수행하십시오. 중복 복귀 호출을 피해야 한다면 최소한 `bSyncEqualityScreenActive===true`, 진행 중 transition, `bSyncDialogLock` 상태에서는 C2를 실행하지 말고 해당 화면의 정상 teardown 완료부만 활성화 소유자가 되게 하십시오. 버튼 핸들러에도 방어 가드를 두는 편이 안전합니다.

보수적인 BR63 최소 수정으로는 **C1만 유지하고 C2를 제거**하는 방안이 가장 작습니다. HTML5에서 addit 버튼을 끄는 주 경로는 동일속성 화면 진입(`syncBindScreen.js:233`)이고, 성공·뒤로가기 teardown은 이미 각각 `await moveDesignPage()` 뒤 버튼을 다시 켭니다(`designArea.js:765-772`, `syncBindScreen.js:348-359`). 따라서 C2는 일반 UPDATE 경로에서 실익이 거의 없고, 동기화 중에는 정상 복귀부의 소유권을 침범합니다. 원본의 `moveDesignPage()`까지 복원하려면 모든 UPDATE가 화면을 강제로 복귀시키는 원본 UX와 HTML5의 중복 transition을 함께 재검증해야 합니다.

## 확인된 정상 항목

- 외부 원본 `broadcastChannelBindPopup.js:268-289,306-307`에서 `clearSelectAdditBind`, `setAdditialListData`, 추가속성 모델 refresh는 실제 주석이며, `setAdditLayout`, `moveDesignPage`, `setAdditBindButtonEnable(true)`, `setDesignTreeData`는 실행 코드입니다. 요청서의 원인 진단은 맞습니다.
- C1은 타당합니다. `additInfoArea.js:214-258`의 `setAdditialListData()`가 MAIN 8행을 새 객체로 바꾸면서 일반값을 `""`, P07/P08을 `"false"`로 되돌립니다. 방송 경로에서 이를 제거하면 기존 MAIN row 객체와 값이 유지됩니다.
- 입력값은 DOM에만 있지 않습니다. 입력/선택 컨트롤은 row 객체의 `val`을 갱신하고, 검증·직렬화도 `_rows(oA.MAIN)`을 읽습니다(`additInfoArea.js:380,510,541,555-560,700`). 따라서 C1 방식으로 유지한 값은 다음 바인딩에도 사용됩니다.
- 팝업 내부 디자인 트리 드롭 경로 `designArea.js:935-948`은 원본 `uiModule/designTree.js:1398-1420`처럼 선택/레이아웃/트리/MAIN 목록을 초기화하며 이번 변경과 분리돼 있습니다.
- 조회모드에서는 `frame.js:239-242`가 전달값과 무관하게 addit 버튼을 비활성화하므로 C2가 조회모드를 깨지는 않습니다. 문제는 편집모드의 동기화 진행 상태입니다.
- `ERROR-ADDIT-DATA`와 `DESIGN-TREE-SELECT-OBJID` 수신부는 MAIN 목록을 재생성하지 않습니다. BR63 경로에서 추가로 확인된 값 초기화 호출은 없습니다.
- `_fnRebuild`의 catch는 오류를 콘솔에 표면화하고 finally에서 WS20 BUSY_OFF와 로컬 busy-off를 수행합니다. C2가 throw해도 영구 busy는 남지 않지만 뒤의 `setDesignTreeData()`가 건너뛰는 부분 재구성은 발생할 수 있습니다.
- `bindBroadcast.js`의 `node --check` 및 전체 `git diff --check`가 통과했습니다. 대상 제품 파일은 현재 HEAD와 동일해 별도 worktree diff가 없습니다.

## 재검증 권고

1. 동일속성 화면에서 일괄 적용 → UPDATE_DESIGN_DATA 왕복을 빠르게 반환시켜, 260ms 복귀 애니메이션 완료 전 addit 버튼이 활성화되지 않는지 확인
2. 위 구간에서 버튼 연타가 두 번째 `onMultiAdditionalBind`/UPDATE 방송을 만들지 않는지 확인
3. 일반 WS20 속성행 D&D 뒤 ALPHA 등 MAIN 값이 유지되고 다음 바인딩에 같은 MPROP가 적용되는지 확인
4. 팝업 내부 디자인 트리 드롭은 기존대로 MAIN 값이 초기화되는지 확인
5. 조회모드·동일속성 취소·성공·비모달 팝업 닫기 각각에서 버튼/기어/busy가 원래 상태로 복원되는지 확인

## 2차 독립 재검수 취합

2026-09-01 서브에이전트 3개를 방송/화면전환 경쟁, MAIN 값 지속성, 원본 parity·busy 축으로 나눠 기존 판정을 적극 반박하도록 재검수했습니다.

- 세 검토 모두 C2 P1 경쟁을 재입증했습니다. `designBroadcastUpdate` 송신 1-rAF + 응답 + 수신 2-rAF는 260ms 전환보다 먼저 끝날 수 있고, 그동안 우측 pane과 버튼은 보이며 클릭 가능합니다.
- `setAdditLayout("")`은 중앙하단 영역만 비우므로 우측 버튼을 숨기지 않습니다. busy도 수신 finally에서 함께 내려가 실제 입력이 가능합니다.
- MAIN 값은 `oAPP.attr.additRows`의 row 객체에 저장되고 콤보·P06 change·검증·직렬화·멀티적용이 같은 저장소를 소비합니다. C1 후 값이 DOM에만 남는다는 반론은 성립하지 않았습니다.
- `ERROR-ADDIT-DATA`, `DESIGN-TREE-SELECT-OBJID`는 MAIN을 초기화하지 않습니다. 모델 필드 전환 때 새 후보에 없는 P05만 비우는 것은 원본의 Reference Field 정합성 처리이며 P06(ALPHA), P07/P08은 유지됩니다.
- 근접 UPDATE 여러 건이 각자 double-rAF와 BUSY_OFF를 예약해 앞 이벤트가 뒤 이벤트 busy를 풀 수 있는 세대 관리 부재도 확인했으나, BR63 이전 구조이므로 이번 필수 결함에는 포함하지 않고 별도 P2 구조 위험으로 남깁니다.

결론은 **수정필요/P1 유지**입니다. 제품 파일은 수정하지 않았습니다.
