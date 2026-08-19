# BR49 Codex 검수 결과

## 판정

**수정 필요 — P1 1건, P2 1건**

BR49는 정상 1회 저장에서는 이전 iframe에 대한 중복 draw를 차단하고, 재로드 전에 UI 참조 5종을 제거해 새 문서의 `removePreviewPage()` destroy도 회피한다. 그러나 재부착 여부가 후속 스플리터 배선 성공과 결합되어 예외 시 `false`로 소실되고, 새 iframe self-draw 완료를 직렬화하지 않아 반복 저장으로 파괴 경쟁이 다시 열릴 수 있다. 기존 통과 판정은 독립 재검수 결과 철회한다.

## 지적

### [P1] 실제 iframe 재부착 후 예외가 `false`로 축약되어 중복 draw 경쟁이 재도입된다

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20.js:935~958`, `963~968`, `1051~1077`
- `_ws20ArrangeSplit`은 모든 자식을 제거하고 세 패널을 재부착한 뒤 `U4AUI.wireSplitter()`를 호출하며, `true`는 이 호출까지 성공한 뒤에만 반환한다.
- `wireSplitter()`가 예외를 던지면 iframe은 이미 분리·재부착됐지만 `setDesignLayout()`은 이를 잡고 `false`를 반환한다.
- `_doSave()`는 `false` 분기로 들어가 UI 참조 5종 정리도 건너뛰고 `fnWs20LoadPreview()`를 즉시 호출한다. BR49가 막으려던 재로드와 명시적 `drawPreview()` 경쟁이 그대로 부활한다.
- 재현: 레이아웃 변경 저장 직전 `U4AUI.wireSplitter = function () { throw new Error("x"); };`로 두면 DOM 순서는 이미 바뀌지만 `_bReparented === false`가 되어 명시적 preview load가 실행된다.

**제안:** DOM 재부착 사실을 후속 배선 성공과 분리한다. 재부착 직후 상태를 확정하고 `wireSplitter` 오류는 별도로 회수하되, 호출자에는 재부착 사실을 보존해야 한다.

### [P2] self-draw 완료 전 반복 저장이 두 번째 `drawPreview()`를 병렬 실행할 수 있다

- 위치: `www/ws30/ws10_20/design/preview/index.js:9820`, `9880`; `www/ws30/ws10_20/js/ws_html5_ws20.js:1060~1079`, `1141~1148`; `www/ws30/ws10_20/design/js/uiPreviewArea.js:150~169`
- 새 iframe은 초기 `await drawPreview()`보다 먼저 `window._loaded = true`를 공개한다.
- 재배치 저장은 별도 loading/generation 상태나 busy를 설정하지 않고 팝업을 즉시 닫으며, 레이아웃 메뉴 재진입에도 preview booting 가드가 없다.
- 사용자가 self-draw 중 팝업을 다시 열어 동일 순서로 저장하면 `_bReparented === false`이고, `loadPreviewFrame()`은 `_loaded === true`를 보고 두 번째 `drawPreview()`를 실행한다.
- 두 호출은 같은 `parent.oAPP.attr.ui`를 대상으로 `removePreviewPage()`와 재생성을 병렬 수행하므로 최초 장애와 같은 파괴 경쟁을 다시 만들 수 있다.

**제안:** reparent 직전에 generation/loading 상태를 설정하고 새 iframe의 `drawPreview + ROOT 선택` 완료 신호에서 해제한다. 그동안 재저장과 외부 `drawPreview()`를 차단하거나 단일 Promise로 직렬화해야 한다.

## 확인된 정상 범위

| 검사항목 | 결과 | 근거 |
|---|---|---|
| 기본 반환 분기 | 통과 | 패널 맵 부재와 동일 순서는 `false`, 일반 재구성 완료는 `true`다(`ws_html5_ws20.js:921~958`). |
| 저장 순서 정규화 | 통과 | 정확한 세 SID를 모두 포함할 때만 저장 순서를 채택한다(`903~914`). |
| iframe self-heal | 통과 | 새 문서는 `await drawPreview()` 후 첫 트리 행으로 `fireCellClick`을 호출해 ROOT 선택까지 수행한다(`design/preview/index.js:9868~9907`). |
| 옛 UI 참조 정리 | 통과 | 정상 `true` 분기는 원본 패턴대로 5종 참조를 먼저 삭제하여 새 문서 `removePreviewPage()`의 destroy를 조기 차단한다(`ws_html5_ws20.js:1060~1074`). |
| 다른 호출부 | 통과 | data/main/초기 split의 `setDesignLayout()` 호출은 반환값을 사용하지 않는다. |

## 실패 회수·busy 재검토

- `_bReparented === true`는 DOM 재부착일 뿐 resource load, UI5 bootstrap, `drawPreview()` 성공과 동치가 아니다.
- 재배치 분기는 `fnWs20LoadPreview()`의 busy 진입·동기 예외 회수를 타지 않는다.
- 초기 `await drawPreview()` 실패에는 해당 위치의 자동 재시도나 완료 통지가 없다.
- `ws_html5_ws20_prev.js:1611~1613`의 60초 watchdog 설명은 주석뿐이고 실제 timeout 구현이 확인되지 않았다.
- iframe 제거·재삽입 시 새 browsing context/navigation이 생기는 전제는 HTML 표준과 정합하지만 초기화 성공까지 보장하지 않는다.

## 정적 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20.js` 통과
- `git diff --check -- www/ws30/ws10_20/js/ws_html5_ws20.js` 통과
- 전체 `setDesignLayout` 호출처와 preview 초기화/파괴 경로 재검색 완료
- `_`로 시작하는 백업·구버전 폴더는 근거에서 제외

## 독립 재검수 취합

두 서브에이전트가 기존 통과 결론을 반박하는 방향으로 독립 추적했다. 한 검수는 reparent 뒤 `wireSplitter` 예외가 `false`로 바뀌는 확정 흐름을 P1로 판정했고, 다른 검수는 `_loaded` 공개와 self-draw 완료 사이의 반복 저장 경쟁 및 ready/error/busy 계약 부재를 P2로 판정했다. 양쪽 모두 정상 1회 self-heal, 5종 참조 정리, ROOT 재선택과 타 호출처 무영향에는 동의했다.

제품 소스는 수정하지 않았다.
