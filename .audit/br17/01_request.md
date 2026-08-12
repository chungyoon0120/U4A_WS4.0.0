# 01_request — BR17 미리보기 우클릭 "위/아래" 이동 시 미정의 함수 예외·화면 잠금

## 검수 대상
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js` — `_moveUI`(트리·미리보기 공용 위/아래 이동), `oAPP.fn.fnWs20MoveUI`(노출)
- `www/ws30/ws10_20/js/ws_html5_ws20_prev.js` — `lf_installPreviewMoveDelegate`(미리보기 컨텍스트메뉴 로드 후 위임 설치)

## 증상 (BR17)
WS20 미리보기 영역에서 우클릭 → "위"/"아래"(UI 위/아래 이동) 선택 시
`TypeError: oAPP.fn.getTreeIndexOfChild is not a function` 예외. 이동이 안 되고, 그 직전 켠
화면 잠금(BUSY)이 안 풀려 화면이 잠기며 [Critical Error] 표시. Design Tree(왼쪽) 우클릭의 같은 "위/아래"는 정상.

## 원인 (원본 대비 조사 결과)
- 미리보기 우클릭 메뉴는 원본 UI5 `design/js/callDesignContextMenu.js`(HTML5가 미리보기용으로 지연 로드)의
  `oAPP.fn.contextMenuUiMove`(430~)를 탄다. `:438` 방송 BUSY_ON 후 `:456`
  `undoRedo.saveActionHistoryData("MOVE", ls_tree)` 호출 → `design/undoRedo/undoRedo.js:1245`가
  `oAPP.fn.getTreeIndexOfChild(oParam.OBJID)` 를 부름. 이 함수 정의는 원본 `design/js/uiDesignArea.js:1928`에만
  있고 HTML5 런타임엔 미로드 → 예외. 이동(splice) 전에 죽고, 짝 BUSY_OFF에 도달 못 해 잠김.
- 트리 경로는 `ws_html5_ws20_edit.js:545 _moveUI`(→ `fnWs20PushUndo` 스냅샷 되돌리기)로 정상. `getTreeIndexOfChild` 미사용.
- HTML5는 옛 액션-히스토리 undo(undoRedo.js)를 스냅샷 단일스택(`fnWs20PushUndo`)으로 대체함. 미리보기 위/아래만 옛 경로에 잔존.

## 변경 요약
- `edit.js`: 트리가 쓰는 `_moveUI`를 `oAPP.fn.fnWs20MoveUI = _moveUI;`로 노출. `_moveUI`의 BUSY on 이후를 `try/finally`로 감싸 예외에도 BUSY_OFF 보장.
- `prev.js`: 미리보기 컨텍스트메뉴 스크립트 로드 후 `lf_installPreviewMoveDelegate()`로 `oAPP.fn.contextMenuUiMove`를 감싼다(래퍼).
  - 위/아래(`sign "-"/"+"` · `pos` 미지정 · `UNDO_REDO` 아님)만 `fnWs20MoveUI(getTreeData("/lcmenu/OBJID"), sign)`로 위임.
  - 대상위치 이동(`pos` 지정)·undo/redo 재적용 호출은 원래 함수로 통과(동작 불변).
  - `__ws20MoveDelegate` 가드로 멱등. 설치 진입점 3곳(모듈 이미로드 조기반환 / callDesignContextMenu 이미정의 분기 / getScript 콜백).
- 원본 파일(`callDesignContextMenu.js`·`undoRedo.js`·`uiDesignArea.js`)은 손대지 않고 로드 후 감싸는 override 패턴.

## 검수 포인트
1. **원인 정확성**: 미리보기 위/아래가 contextMenuUiMove→undoRedo.saveActionHistoryData→getTreeIndexOfChild(미정의)로 crash, BUSY_OFF 미도달.
2. **위임 자체완결**: `_moveUI`가 이동+스냅샷undo+미리보기반영(moveUIObjPreView)+바인딩팝업반영+BUSY 짝을 자체 완결.
3. **BUSY 대칭**: 위임 경로가 원본 `:438` 방송 BUSY_ON을 안 타므로 누수/이중 없음. 예외 시에도 해제(try/finally).
4. **노드 소스 동일**: `/lcmenu/OBJID`가 원본 `:442`와 동일 대상, getTreeData는 라이브 노드 반환.
5. **pos/undo_redo 미차단**: 그 경로는 원본으로 통과되어 기존 동작 유지.
6. **멱등/설치 타이밍**: 가드·3진입점·재로드 재설치.
7. **원본 무수정 override**: 원본 파일·공통 자산 미접촉.
8. **경계/편집가드**: `_moveUI`의 맨위/맨아래 no-op·편집모드 가드가 미리보기서도 타당.

## 근거
- 원본(as-is): `design/js/callDesignContextMenu.js:430-456`, `design/undoRedo/undoRedo.js:1245`, `design/js/uiDesignArea.js:1928`(getTreeIndexOfChild 원정의, 미로드).
- 규칙 `.claude/rules/code.md`(busy on→모든 종료분기 off 짝), 되돌리기 단일 스냅샷 스택 원칙(별도 스택 이원화 금지).
- 테스트 현황판: `.works/미리보기컨텍스트메뉴/00_현황판.md` (BR17-1~4).
