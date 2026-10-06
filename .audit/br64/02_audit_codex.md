# BR64 Codex 검수 결과

## 판정

**수정필요**

`checkAdditData` 복원은 확정된 오류 상태의 WS20 메인 속성 드롭을 차단합니다. 그러나 비동기 Conversion 검증의 pending 상태를 판정하지 않아 같은 드래그 동작으로 검증 전 invalid MPROP가 통과할 수 있고, BR64가 활성화한 payload 오류가 MAIN 추가속성을 적용하지 않는 별창 내부 디자인트리 D&D까지 막는 회귀가 있습니다.

## 지적

### 1. [P1] Conversion 검증 pending 상태가 없어 blur와 같은 드래그 동작에서 invalid MPROP가 검증 전에 통과할 수 있습니다

- 위치: `www/ws30/ws10_20/Popups/bindPopup/additInfoArea/additInfoArea.js:94-102, 441-475, 735-744`; `modelFieldArea/modelFieldArea.js:262-282`
- P06을 타이핑하면 `onInput`이 즉시 `clearConvError()`를 호출하여 `_error=false`로 만듭니다. 실제 값 반영과 서버 존재 검증은 입력칸 `change`/blur 뒤 `convChangeInput()`에서 비동기로 시작합니다.
- 사용자가 invalid routine을 입력한 직후 좌측 모델 행을 누르고 드래그하면, 그 mousedown으로 P06이 blur되어 검증과 local busy가 시작되지만 같은 native drag gesture의 `dragstart`가 계속 발생할 수 있습니다. 코드에는 진행 중 drag를 취소하는 연결이 없습니다.
- `checkAdditData()`는 pending/검증 세대 없이 현재 `_error===true`만 동기 판독합니다. 응답 전에는 false이므로 invalid 문자열을 `MPROP`에 직렬화한 payload가 `RETCD=""`로 WS20에 전달되고, 수신부도 Conversion을 재검증하지 않습니다.
- 적용 버튼은 busy overlay 동안 클릭할 수 없지만 이미 시작된 native D&D의 취소는 코드로 보장되지 않으므로 “적용 버튼과 D&D가 같은 안전 기준”도 이 시간창에서는 성립하지 않습니다. invalid 추가속성이 실제 바인딩 데이터에 기록될 수 있어 P1로 분류합니다.

제안: P06 입력에 pending 및 요청 세대를 기록하고 `checkAdditData`와 적용 경로가 pending도 차단하도록 하십시오. 응답은 캡처한 값/세대가 최신 입력과 일치할 때만 `_error`를 갱신해야 합니다. 이 경로는 실화면에서 빠른 입력→즉시 드래그로 재현 확인이 필요합니다.

### 2. [P2] 우측 MAIN 추가속성을 적용하지 않는 별창 내부 디자인트리 D&D까지 오류로 차단합니다

- 위치: `www/ws30/ws10_20/Popups/bindPopup/designArea/designArea.js:189-198, 964-978`
- 원본 별창 내부 `U4A_WS_DESIGN/Popups/bindPopup/uiModule/designTree.js:838-883`의 `_checkDragData`는 payload `RETCD/T_ERMSG`를 읽지 않습니다. 이어 원본 :1315-1317은 디자인트리 드롭에서 `IF_DATA.MPROP=""`로 비워 우측 MAIN 추가속성을 적용하지 않습니다.
- HTML5는 :196에서 BR64가 만든 `o.RETCD==="E"`를 먼저 오류로 반환하고 :966에서 종료하므로, :975-976의 MPROP 폐기 및 정상 바인딩까지 도달하지 못합니다.
- 즉 현재 우측 Conversion 오류는 별창 내부 디자인트리 바인딩 결과와 무관한데도 모든 내부 D&D를 막습니다. 이 검사는 이전부터 코드에 있었지만 `checkAdditData`가 미정의여서 dormant였고, BR64 함수 정의가 직접 활성화한 회귀입니다.

제안: 실제 이슈 대상인 WS20 메인 ATTRIBUTE 수신부의 payload 오류 차단은 유지하고, 별창 내부 디자인트리 `_checkDragData`에서는 원본처럼 payload `RETCD`로 막지 말고 MPROP를 폐기한 뒤 정상 처리하십시오.

## 검증 결과

- 원본 `checkAdditData`는 `T_MPROP`에서 `_error===true` 행만 모으고, 없으면 `RETCD=""`, 있으면 `RETCD="E"`, 메시지 146과 `ITMCD/ERMSG` 목록을 반환합니다(`U4A_WS_DESIGN/Popups/bindPopup/index.js:8394-8425`). HTML5 :735-745는 대응 스토어만 `oAPP.attr.additRows`로 바꾼 동일 로직입니다.
- `oA.MAIN.store="additRows"`와 `_rows(oA.MAIN)`가 적용 버튼 검증 및 drag payload 직렬화와 같은 배열을 가리킵니다(`additInfoArea.js:30-36, 567-600`, `modelFieldArea.js:270-279`).
- Conversion Routine 서버 오류는 그 행에 `_error=true`, `_error_msg`를 기록하고 정상 입력·clear 시 같은 행의 오류를 해제합니다(`additInfoArea.js:441-475`). 따라서 적용 버튼과 D&D가 같은 상태 플래그를 소비합니다.
- 오류가 없거나 추가속성 배열이 비어 있으면 `_aErr.length===0`으로 정상 통과합니다. 모든 `_error` 행을 검사하는 것은 원본과 같고, 특정 P06만 임의로 하드코딩하지 않았습니다.
- 실제 WS20 메인 속성 드롭은 payload를 파싱한 뒤 `l_json.RETCD==="E"`이면 `ERROR-ADDIT-DATA`를 반송하고 `attrSetBindProp` 전에 종료합니다(`ws_html5_ws20_attr.js:6291-6314`). 기존 프로퍼티 바인딩과 MPROP는 변경되지 않습니다.
- 반송된 `T_ERMSG`는 별창에서 추가속성 행 오류 팝오버로 표시되고 로컬 busy를 해제합니다(`bindBroadcast.js:164-192`). WS20 본창도 오류 분기에서 `parent.setBusy("")`를 실행합니다.
- 별창 내부 디자인트리의 payload 차단은 원본과 달라 위 P2 회귀로 분리했습니다.
- `checkAdditData`의 현행 로드 경로 호출부는 `modelFieldArea.js:277-279` 한 곳입니다. 작업폴더 monolith의 동명 호출은 현행 `frame.html` 로드 대상이 아니며, `_` 폴더는 근거에서 제외했습니다.
- 우측에 남은 오류가 다른 필드 D&D도 막는 것은 원본이 전체 `T_MPROP` 오류를 검사하는 계약이며, 적용 버튼과 같은 스테이징 데이터의 불완전한 MPROP가 전파되는 것을 막으므로 과잉 차단이 아닙니다.
- `node --check www/ws30/ws10_20/Popups/bindPopup/additInfoArea/additInfoArea.js` 통과를 재확인했습니다. 제품 및 원본 파일은 수정하지 않았습니다.

## 결론

**수정필요 — P1 1건, P2 1건.** 실화면 테스트는 아직 미실시입니다.

## 2차 서브에이전트 재검수 취합

3개 독립 검수로 메인 드롭, 오류 상태 생명주기, 원본 내부/외부 수신부를 반박 검증했습니다.

- 확정된 `_error=true` 상태의 WS20 메인 드롭 차단·기존값 보존·오류 반송·양쪽 busy 해제는 재확인되어 정상입니다.
- pending 검증을 표현하지 않는 시간창은 빠른 입력→다른 행 dragstart에서 invalid MPROP가 통과할 수 있는 P1로 추가했습니다. busy overlay가 이미 시작된 native drag를 취소한다는 코드 보장은 없습니다.
- 기존 보고서가 “원본보다 안전한 추가 차단”으로 본 내부 designArea 동작은 오판이었습니다. 내부 D&D는 MAIN MPROP를 버리므로 오류와 무관하며, BR64가 dormant 차단을 활성화한 P2 회귀입니다.
- `additRows` 배열 계약 훼손 시 dragstart의 빈 catch가 fail-open하는 점과 통신 인프라 장애 시 busy 잔류는 정상 상태의 BR64 고유 결함으로 분류하지 않았습니다.
