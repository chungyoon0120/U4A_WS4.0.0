# BR65 Codex 검수 결과

## 판정

**통과**

현행 지원 런타임의 native `<dialog>.showModal()` 경로에서 BR65의 호출 위치와 `sOption` 유무는 원본과 일치하며, 재현된 취소 BUSY 잔류를 해소합니다. 2차 반박 검수 결과, 앞서 P2로 잡은 동기 fallback 순서 역전은 코드상 사실이지만 고정된 Electron 14.2.9 정상 환경에서는 도달하지 않아 릴리스 차단 결함이 아닌 비차단 방어 권고로 하향합니다.

## 비차단 참고

### 1. [P3/방어] `<dialog>` 동기 fallback에서는 onClose 재-ON 뒤의 로컬 OFF가 다시 실행됩니다

- 위치: `www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js:322-339`
- `_confirmAsync`는 `U4AUI.confirm()`의 `onClose`에서 `setBusyWS20Interaction(true)`를 호출하고(:329-333), `U4AUI.confirm()`이 반환한 뒤 `setBusyWS20Interaction(false)`를 호출합니다(:336-338). native modal 경로에서는 후자의 OFF가 창을 처음 표시한 시점에 실행되고, 나중에 사용자가 닫을 때 onClose의 ON이 실행되므로 원본 순서와 맞습니다.
- 그러나 공통 `U4AUI.confirm`은 `<dialog>`/`showModal` 미지원 시 `window.confirm()`을 호출하고 `_done()`을 **반환 전에 동기 실행**합니다(`theme/u4a-ui.js:2303-2310`). `showModal()`이 throw한 경로도 catch에서 `_close()`→`_done()`을 동기 실행합니다(:2355-2356).
- 이 경우 실제 순서는 `onClose → setBusyWS20Interaction(true) → resolve → U4AUI.confirm 반환 → setBusyWS20Interaction(false)`입니다. Promise continuation은 그 뒤 microtask에서 실행되므로, NO는 :358/:370의 전체 OFF로 끝나지만 YES는 로컬 busy가 꺼진 상태로 `attrUnbindAggr/attrSetBindProp` 및 WS20 왕복을 시작합니다.
- 이 분기가 실행된다면 WS20은 기존 BUSY_ON 방송으로 잠기지만 바인딩 별창의 오버레이와 닫기 버튼은 풀려 성공 왕복 전 다음 조작이 가능해집니다.
- 다만 제품 의존성은 `package.json:21` 및 lockfile에서 Electron 14.2.9로 고정되어 있고, 해당 Chromium은 `HTMLDialogElement.showModal()`을 지원합니다. 공통 구현도 매번 새 dialog를 생성하여(:2304-2306) 활성 document body에 append한 직후 한 번만 `showModal()`하므로(:2355), 미지원 분기나 이미 열린 non-modal 요소의 `InvalidStateError`가 정상 제품 경로에서 성립하지 않습니다. DOM 훼손·monkeypatch 같은 비정상 환경 외의 구체적 도달 근거가 없어 P2는 과대평가였습니다.

제안: `_confirmAsync`가 confirm 콜백의 동기/비동기 여부와 무관하게 “표시 직후 로컬 OFF → 닫힘 후 로컬 ON → Promise 완료” 순서를 보장하도록 상태를 분리하십시오. 예를 들어 confirm 호출이 반환되기 전에 들어온 onClose 결과는 임시 저장하고, 반환 후 로컬 OFF를 먼저 수행한 다음 재-ON과 resolve를 실행하면 됩니다. 공통 `U4AUI.confirm` 자체를 변경하면 다른 호출부 파급이 있으므로 BR65 helper 안에서 국소 처리하는 편이 안전합니다.

## 통과 확인

- 원본의 두 확인 갈래(해제 확인·재바인딩 확인) 모두 `팝업만 OFF(인자 없음) → onClose 팝업만 ON(인자 없음) → 취소 전체 OFF({})` 순서와 인자가 정상 native 경로에서 1:1입니다.
- 취소 return은 `attrUnbindAggr`, `attrUnbindTree`, `attrSetBindProp`보다 앞이므로 기존 aggregation 및 하위 바인딩 데이터는 변경되지 않습니다.
- 드롭 진입의 `setBusy(true)`와 `setBusyWS20Interaction(true,{DESC})`가 BUSY_ON을 두 번 보내더라도 WS20 수신부는 참조 횟수를 세지 않는 단순 boolean 잠금이며, `{}`를 동반한 BUSY_OFF 한 번으로 해제됩니다.
- native `showModal()`은 배경을 자동 inert 처리하므로 확인창 표시 직후 별창 busy만 꺼도 뒤 화면 조작은 열리지 않습니다.
- onClose ON과 취소 OFF는 같은 이벤트 task 및 Promise microtask 안에서 이어져 정상 경로에는 중간 paint가 없어 실질적인 busy 깜빡임 가능성이 낮습니다.
- `_confirmAdditApply`는 다른 파일의 지역 함수이고 진입 BUSY 소유 방식도 달라, 이번 범위에서 억지로 합치지 않는 판단이 타당합니다.
- 확인창이 없는 최초 바인딩 경로는 변경되지 않았고, native YES 경로는 성공 후 `attrSetBindProp → designBroadcastUpdate → UPDATE_DESIGN_DATA` 왕복이 기존 해제를 소유합니다.
- `node --check www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js` 통과를 재확인했습니다. 제품 파일은 수정하지 않았습니다.

## 결론

**통과.** 주 재현인 native dialog 취소 경로의 수정은 정확합니다. 동기 fallback 순서 보강은 향후 지원 런타임 확대를 대비한 P3 방어 개선이며 BR65 완료를 막지 않습니다. 실화면 테스트는 아직 미실시입니다.

## 2차 서브에이전트 재검수 취합

3개 독립 검수로 fallback 도달성, BUSY 소유권, 데이터·호출 순서를 반박 검증했습니다.

- fallback 순서 역전 자체는 세 검수 모두 재현했지만, 현행 Electron 14.2.9의 새 native dialog 경로에서는 정상 도달하지 않아 **P2→P3 비차단 참고**로 하향했습니다.
- native 취소/YES의 로컬 busy 및 방송 인자, BUSY_ON 2회/단일 OFF의 boolean 수신, 모달 background 차단, 취소 데이터 무변경은 모두 정상입니다.
- 취소 뒤 `setRefFieldList`·추가정보 refresh·rerender가 계속되는 것은 원본도 동일합니다. 최초 바인딩과 재바인딩 YES의 unbind/tree/bind/model 순서도 원본과 일치합니다.
- WS20 채널 미생성·송신 실패·무응답 때 성공 왕복 BUSY가 남을 수 있는 위험과 전역 BUSY의 owner/refcount 부재는 확인했으나 BR65가 만든 회귀가 아닌 선행 통신 구조 위험으로 분리했습니다.
