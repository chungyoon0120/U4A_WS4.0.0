# BR19 검수 요청 (01_request)

## 검수 대상
- 파일: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
- 함수: `_showInsertPopup(is_tree)` (UI 추가 팝업 = "UI Object Select" 다이얼로그 생성기)
- 배선 진입점: `oAPP.fn.designUIAdd` / `oAPP.fn.designInsertPopupHtml5`(= `_showInsertPopup`)
- 관련(수정 안 함, 근거용):
  - 켜는 쪽: `www/ws30/ws10_20/design/js/callDesignContextMenu.js:17` (우클릭 메뉴 `attachItemSelected` 진입 시 `parent.setBusy("X")` + `:20` `setShortcutLock(true)`)
  - 원본 SSOT: `www/ws30/ws10_20/design/js/insertUIPopop.js`(`callUIInsertPopup`), `www/ws30/ws10_20/design/js/uiDesignArea.js:6570`(`designUIAdd`)

## 증상 (BR19, 화면: 미리보기)
WS20 미리보기 영역에서 UI 위 우클릭 → 컨텍스트 메뉴 "오브젝트 삽입"(UI 추가) 선택 시,
UI 추가 팝업이 정상적으로 열리고 content DOM까지 구성되나 **로딩표시(BUSY)가 해제되지 않아 팝업을 조작할 수 없음**(먹통). JS 예외는 없음.
노션 계측: setBusy ON 3회 / OFF 2회 → 1건 미해제, getBusy()="X".

## 원인
우클릭 컨텍스트 메뉴는 `attachItemSelected` 진입 시 **모든 메뉴 공통으로 BUSY ON + 단축키잠금**을 건다.
각 메뉴 분기가 자기 종료 시점에 해제 짝을 맞춰야 한다(복사=`callDesignContextMenu.js:692·710`에서 해제).
그러나 "UI 추가" 분기의 실제 팝업 오프너인 HTML5 `_showInsertPopup`에는 **BUSY/잠금 해제가 전혀 없었다**.
원본 UI5는 `insertUIPopop.js`가 팝업 열림 이벤트(`attachAfterOpen`)와 조기 종료에서 해제한다.

## 변경 요약 (원본 1:1 이식, 3개 종료 분기 해제 추가)
`_showInsertPopup` 상단에 로컬 헬퍼 `_releaseBusyLock()` 신설(단축키잠금 해제 + `parent.setBusy("")`), 아래 3곳에서 호출:

| # | 위치(현재 라인) | 종료 분기 | 원본 대응 |
|---|---|---|---|
| 1 | `edit.js:1196` `if (!is_tree)` | 트리 정보 없어 못 엶 | `uiDesignArea.js:6575·6577` (원본 designUIAdd `!is_tree`) |
| 2 | `edit.js:1201` `if (!aAgg.length)` | 넣을 Aggregation 없어 못 엶(280 경고 후) | `insertUIPopop.js:22·24` |
| 3 | `edit.js:1558` 팝업 `show()`+`lf_renderTable()` 후 | 정상 열림 완료 | `insertUIPopop.js:59-68` (`attachAfterOpen` 안 `setShortcutLock(false)`+`setBusy("")`) |

- #3은 `requestAnimationFrame`으로 **렌더가 화면에 반영된 다음 프레임**에 해제(WP1: 렌더 끝난 뒤 해제, 끄는 순간 연타로 상태 꼬임 방지). 원본 afterOpen이 열림 완료 후 발화하는 타이밍을 HTML5에서 재현.

## 검수 포인트
1. **정확성/짝맞춤**: BUSY를 켜는 곳은 우클릭 메뉴(`callDesignContextMenu.js:17`) 1회. `_showInsertPopup`의 모든 종료 경로(트리없음/Agg없음/정상열림)에서 정확히 1회 해제되어 짝이 맞는가. 해제 누락·이중 해제 없는가.
2. **`setBusy` 의미론**: `resources/index.js:1539`→`oWS.utill.fn.setBusy`(`index.js:869`)는 깊이 카운터가 아니라 단순 상태값("X"=on, ""=off, on중복은 무시). `setBusy("")` 1회로 완전 해제됨이 맞는가. (계측의 "depth"는 테스터 훅 표기)
3. **회귀(트리 ＋ 경로)**: 트리 ＋버튼(`ws_html5_ws20_tree.js:560` `designUIAdd([n])`)은 BUSY를 켜지 않고 진입 → `_releaseBusyLock()`의 `setBusy("")`가 무해한가(멀쩡히 열린 다른 상태를 끄지 않는가). 두 경로 모두 `_showInsertPopup`으로 수렴함 확인.
4. **타이밍(WP1)**: #3의 rAF 해제가 팝업 렌더/포커스보다 먼저 BUSY를 끄지 않는가. `lf_renderTable()`은 동기 완료 후 rAF 예약이라 순서 OK인지.
5. **원본 1:1**: 원본에 없는 UX/동작을 추가하지 않았는가(해제 3분기만, 팝업 구조/흐름 불변).
6. **확정/취소 경로 무영향**: 확정(`lf_confirm`)의 바인딩 별창 잠금 방송(`_broadBusy`)과 이번 로컬 BUSY 해제가 서로 간섭하지 않는가(별개 계약).

## 근거
- 원본 SSOT: `insertUIPopop.js:22·24·59-68`, `uiDesignArea.js:6570-6580`
- 규칙: `.claude/rules/code.md`(busy 종료 분기 off 짝 필수, WP1 방식)
