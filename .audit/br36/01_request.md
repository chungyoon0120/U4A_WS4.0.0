# BR36 검수 요청서

## 이슈
- 코드: **BR36** / 화면: WS20 Design Tree / 분류: 기능
- 현상: **UI 추가 팝업 호출 시 작업 시작 시점의 BUSY ON 처리 누락**.
  - Design Tree 행의 "+"(UI 추가) 아이콘 클릭 경로, 우클릭 컨텍스트 메뉴 "Insert Element" 경로 **둘 다** 해당.
  - 현재는 팝업 표시 이후 **BUSY 종료(OFF) 호출만** 존재 → 작업 시작 → BUSY ON → 팝업 생성·렌더 완료 → BUSY OFF 라는 공통 BUSY 흐름이 성립하지 않음(켜기·끄기가 한 쌍으로 관리되지 않음).
- 기대: 두 경로 모두 사용자 액션 시작 시 BUSY ON + 입력 차단 → 팝업 생성·렌더 → 조작 가능 상태 → BUSY OFF + 차단 해제. 두 경로는 동일 팝업이므로 동일 BUSY 기준.

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- 함수: `_showInsertPopup(is_tree)` (UI 추가 팝업 오프너, 구 `callUIInsertPopup` 대응)
- 진입 경로(참고, 이번 수정 대상 아님):
  - 트리 "+" 아이콘 클릭: `www/ws30/ws10_20/js/ws_html5_ws20_tree.js:560` → `designUIAdd`
  - 우클릭 메뉴 "Insert Element"(M01): `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:1858` → `designUIAdd`
  - 두 경로 모두 `oAPP.fn.designUIAdd` → `_showInsertPopup` 으로 수렴.

## 변경 요약 (원본 대비)
- **한 곳(팝업 오프너 `_showInsertPopup` 진입부)에서 BUSY ON + 단축키잠금 ON을 추가**했다.
  - 추가 위치: `_releaseBusyLock` 정의 직후, `if (!is_tree)` 조기 종료 판정 **바로 앞**.
  - 순서: `parent.setBusy("X")` → `oAPP.fn.setShortcutLock(true)` (원본 press 순서와 동일).
  - 각 호출은 `try/catch` + 오류 시 `console.error` 표면화(조용한 삼킴 금지 규칙 준수).
- 기존의 모든 종료 분기가 이미 `_releaseBusyLock()`(setShortcutLock(false)+setBusy(""))로 끄고 있어, **켜기 1회 : 끄기 N분기**가 짝을 이룸:
  - `!is_tree` → 즉시 해제·return
  - 입력 가능한 Aggregation 없음(280) → 해제·return
  - **성공**(팝업 구성 완료) → 팝업 렌더 완료 후 `requestAnimationFrame` 2틱 뒤 해제(연타 방지, WP1)
  - 구성 중 예외 → 함수 끝 catch 에서 해제
- 원본에 없는 UX·요소·문구·동작은 추가하지 않음. 메시지 키/신규 문구 생성 없음.

### 추가된 코드(핵심)
```js
// [BR36] 사용자 액션 시작 시점 BUSY ON — 원본 트리 "+" press가 designUIAdd 호출 전에
//   setBusy("X")+setShortcutLock(true) 을 켰으나 HTML5 두 진입 경로가 이를 빠뜨렸다.
try { parent.setBusy("X"); }
catch (e) { console.error("[HTML5][WS20] insert setBusy:", e && e.message ? e.message : e); }
try { if (typeof oAPP.fn.setShortcutLock === "function") { oAPP.fn.setShortcutLock(true); } }
catch (e) { console.error("[HTML5][WS20] insert setShortcutLock:", e && e.message ? e.message : e); }
if (!is_tree) { _releaseBusyLock(); return; }
```

## 검수 포인트
1. **정확성/짝맞춤**: 켜기(setBusy("X")+setShortcutLock(true)) 1회에 대해 **모든 종료 분기**에서 `_releaseBusyLock()`가 정확히 짝을 맞춰 해제되는가(누수·이중해제 없음). 특히 성공 경로의 double-rAF 해제 타이밍(렌더 완료 후 OFF)이 WP1과 합치하는가.
2. **원본 1:1 여부**: 원본 트리 "+" press(`design/js/uiDesignArea.js:264·267`)의 `setBusy("X")`→`setShortcutLock(true)` 순서·의미와 동일한가. 원본 `designUIAdd`의 `!is_tree` 해제 분기(uiDesignArea.js:6572~6580)와 정합한가.
3. **양 경로 커버리지**: 트리 "+" 아이콘 클릭·우클릭 "Insert Element" 두 경로가 모두 `_showInsertPopup`으로 수렴하므로 진입부 1곳 추가로 둘 다 커버되는가(경로별 별도 추가가 필요/중복은 아닌가).
4. **드래그·기타 진입**: `callUIInsertPopup|...` 드롭(드래그) 삽입 등 다른 진입은 이 팝업 오프너를 타지 않으므로 영향/회귀 없는가.
5. **이중 ON 위험**: 현재 두 호출측(트리 클릭·컨텍스트 메뉴 M01)이 BUSY ON을 하지 않는 것이 맞는지(=진입부 ON이 이중이 아닌지) 재확인.
6. **오류 표면화**: try/catch + console.error 가 규칙(조용한 삼킴 금지)에 맞는가.

## 근거
- 원본 SSOT:
  - 트리 "+" press: `www/ws30/ws10_20/design/js/uiDesignArea.js:262~282` (`parent.setBusy("X")` → `setShortcutLock(true)` → binding context 가드 → `designUIAdd`).
  - `designUIAdd` 해제 분기: `www/ws30/ws10_20/design/js/uiDesignArea.js:6570~6611`.
  - 삽입 팝업 원본: `www/ws30/ws10_20/design/js/insertUIPopop.js` (`callUIInsertPopup`).
- 프로젝트 규칙: `.claude/rules/code.md`(busy 켜기 시 모든 종료 분기 OFF 짝, 비동기·화면전환 WP1 — 렌더 완료 후 OFF), 원본 1:1·임의창작 금지(`CLAUDE.md`).
- 참고 메모리: UI5 암묵동작 명시 재현, busy off는 호출측+타임아웃금지.

## 비고
- 이번 수정은 이미 HEAD 커밋 `741fcf4d`에 포함되어 있음(커밋 제목 라벨은 "BR28~35"이나 파일에는 BR36 반영됨 — 라벨 불일치는 별도 인지사항, 코드는 정상).
- 원본 백업: `www/ws30/ws10_20/js/_ws_html5_ws20_edit.js.br36bak`.
