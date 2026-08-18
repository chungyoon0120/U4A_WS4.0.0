# BR49 Codex 검수 결과

## 판정

**통과 (필수 수정 0건)**

레이아웃 순서 변경 시 분할 컨테이너 재구성으로 미리보기 iframe이 이미 다시 로드되는데, 직후 기존 iframe 컨텍스트의 `drawPreview()`를 중복 호출하던 경쟁을 정확히 제거했다. 순서가 바뀌지 않은 경우에는 기존의 명시적 미리보기 갱신을 유지하므로 기능 누락도 없다.

## 검증 결과

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 장애 원인 정합성 | 통과 | 기존 `_doSave`는 `setDesignLayout()` 직후 `fnWs20LoadPreview()`를 호출했다. 순서 변경 시 `_ws20ArrangeSplit`이 `SPLIT`의 모든 자식을 제거·재부착하므로 미리보기 iframe의 문서 재로드와, 아직 살아 있는 이전 `contentWindow.drawPreview()` 호출이 겹칠 수 있었다. 기존 빠른 경로는 Promise reject를 회수하지 않고(`design/js/uiPreviewArea.js:150~169`), `drawPreview`는 즉시 기존 UI5 객체를 파괴한다(`design/preview/index.js:8461~8475`, `7280~7294`). 보고된 `destroyAggregation` 계열 Critical Error와 일치한다. |
| 재로드 self-heal | 통과 | 새 iframe 문서의 초기화는 UI5 준비 후 `await drawPreview()`를 실행하고(`design/preview/index.js:9868~9880`), 완료 뒤 트리 첫 행의 binding context로 `fireCellClick`을 호출해 ROOT 선택까지 복원한다(`9888~9907`). 따라서 재배치 분기에서 외부 중복 호출을 제거해도 미리보기 구성과 선택 복원이 빠지지 않는다. |
| 재배치 판정 | 통과 | 패널 맵이 없으면 `false`, DOM의 현재 패널 SID 순서와 저장 순서가 같으면 `false`, 전체 자식을 제거하고 패널을 다시 붙인 뒤에만 `true`를 반환한다(`ws_html5_ws20.js:921~958`). 저장 순서는 정확한 3개 SID만 채택하고 아니면 기본값으로 정규화하므로(`903~914`) 일부 패널만 붙이고 `true`가 되는 정상 데이터 경로도 없다. |
| 변경/무변경 분기 | 통과 | `_doSave`는 `setDesignLayout()`의 반환을 받아 재배치된 경우 명시적 로드를 생략하고, `false`인 경우에만 `fnWs20LoadPreview()`를 호출한다(`1042~1063`). 순서 무변경 저장은 iframe을 건드리지 않으므로 기존 `_loaded` 빠른 갱신 경로를 그대로 사용한다. |
| 다른 호출부 | 통과 | `ws_html5_ws20_data.js:543~547`와 원본 호환 경로 `design/js/main.js:813~826`, `1913~1937`은 `setDesignLayout()` 반환값을 사용하지 않는다. 반환값 추가로 제어 흐름이 바뀌지 않는다. 초기 `_buildWs20Split` 호출도 반환값을 무시한다(`ws_html5_ws20.js:880~887`). |
| busy/잠금 회수 | 통과 | 재배치 분기는 `fnWs20LoadPreview()` 자체를 호출하지 않으므로 그 함수의 `_ws20EngagePrevBusy`도 새로 걸지 않아 잔류 잠금이 생기지 않는다. iframe 초기화가 ROOT `fireCellClick`까지 자립적으로 수행하고, 공통 선택 스텁은 Promise 종단에서 `_ws20ReleasePrevBusy()`를 멱등 호출한다(`ws_html5_ws20_prev.js:1452~1469`, `1482~1496`). 무변경 분기는 종전 busy/watchdog 흐름을 그대로 탄다. |
| 변경 범위 | 통과 | 실제 제품 변경은 `ws_html5_ws20.js`의 반환 계약과 `_doSave` 조건 분기뿐이다. 레이아웃 데이터 형식, 팝업 UI, 메시지, 저장 순서 및 공통 스플리터 동작은 변경하지 않았다. |

## 보수적 반박 검토

- `true`가 실제 iframe 재로드 없이 반환될 가능성을 검토했다. 정상 순서는 항상 세 패널을 모두 포함하며, 변경 분기는 컨테이너를 완전히 비운 뒤 미리보기 패널을 포함한 전 패널을 재부착한다. 따라서 순서가 하나만 달라도 iframe을 포함한 preview 패널이 반드시 분리·재부착된다.
- `false`가 미리보기 갱신을 누락할 가능성을 검토했다. 패널 맵 부재나 적용 예외도 `false`로 귀결되어 오히려 기존 명시적 로드를 시도하며, 순서 동일 경로도 종전과 같은 `fnWs20LoadPreview()`를 호출한다.
- 재배치 후 별도 busy가 새로 걸리지 않는 점을 검토했다. 이번 분기의 목적은 기존 컨텍스트에 진입하는 외부 로더 자체를 제거하는 것이며, 제거된 호출이 걸었을 busy도 함께 사라져 고착은 없다. 다만 실제 Electron에서 재로드 중 입력 차단이 제품 요구인지 여부는 BR49의 장애 수정 범위를 넘어서는 UX 정책 항목이다.
- `loadPreviewFrame()` 빠른 경로에 reject `catch`가 없는 선행 취약점은 남아 있다. BR49는 그 경로를 재배치 직후 호출하지 않게 해 보고된 경쟁을 차단하며, 일반적인 무변경 갱신의 독립 실패 처리 강화는 별도 개선 범위다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20.js` 통과
- 변경 diff와 전체 `setDesignLayout` 호출처 재검색 완료
- `_`로 시작하는 백업·구버전 폴더는 근거에서 제외

## 잔여 실환경 확인 권고

Electron 실화면에서 `기본 순서 → 변경 저장 → 다시 변경 저장`을 빠르게 반복하여 Critical Error가 재발하지 않는지, 각 저장 뒤 미리보기와 ROOT 선택이 복원되는지만 1회 확인하면 충분하다. 정적 호출망에서 필수 수정 사항은 발견하지 못했다.

제품 소스는 수정하지 않았다.
