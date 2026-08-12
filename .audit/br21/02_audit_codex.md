# 02_audit_codex — BR21 미리보기 우클릭 붙여넣기

## 판정

**수정필요**

## 지적

### 1. `APP` 붙여넣기가 원본 크래시 경로로 폴백됨

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_prev.js:1325-1330`
- 문제: 래퍼는 `ROOT`와 `APP`을 함께 `_origPaste`로 넘긴다. 그러나 원본의 무동작 종료 대상은 `ROOT`뿐이다 (`design/js/callDesignContextMenu.js:1342-1357`). 원본 메뉴 활성화 로직도 편집 상태의 `APP`에서 붙여넣기를 명시적으로 허용한다 (`callDesignContextMenu.js:258-274`). 따라서 `APP`에서 붙여넣기를 선택하면 원본이 `APP` 노드를 읽은 뒤 `aggrSelectPopupOpener`를 호출하여 BR21의 동일 예외가 재발한다 (`callDesignContextMenu.js:1359-1391`). HTML5 트리 메뉴 역시 `APP`의 붙여넣기를 활성화한다 (`ws_html5_ws20_edit.js:1785-1789`).
- 영향: 정상 지원 범위인 `APP` 대상 미리보기 붙여넣기가 여전히 실패하며 Critical 오류/잠금 잔류 위험이 남는다. 요청서의 “APP은 원본 EXIT” 근거도 실제 소스와 불일치한다.
- 근거: 원본 `enableDesignContextMenu`와 `contextMenuUiPaste`, HTML5 트리 `_buildItems` 모두 `APP` 붙여넣기를 허용한다.
- 제안: 원본 폴백은 `ROOT`에만 제한하고, 유효한 `APP` 노드는 다른 일반 대상과 동일하게 `fnWs20PasteUI`로 위임한다. 노드 조회 실패도 원본에는 안전한 EXIT가 없으므로 별도 잠금 해제 후 종료해야 한다.

### 2. 미리보기 진입의 로컬 BUSY/단축키 잠금 수명주기가 공통 코어와 맞지 않음

- 위치: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js:654-689`, `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:446-474, 549-604`
- 문제: 미리보기 원본 메뉴 선택기는 함수 호출 전에 `parent.setBusy("X")`와 `setShortcutLock(true)`를 켠다 (`design/js/callDesignContextMenu.js:15-26`). 하지만 `_pasteUI`의 `_done`은 단축키와 자식창 방송만 해제하고 `parent.setBusy("")`는 해제하지 않는다 (`edit.js:670-675`). 그 결과 aggregation 후보가 0개인 취소/검증 종료 또는 후보가 1개인 자동선택 경로에서는 로컬 BUSY가 끝까지 남는다. 반대로 후보가 2개 이상이면 `_aggrSelectDialog`가 팝업을 연 직후 `parent.setBusy("")`와 `setShortcutLock(false)`를 실행하고 (`dnd.js:602-604`), 확인 시 다시 잠그지 않은 채 비동기 `_fetchP13nOtr`/`_applyP13nPattern`을 수행한다. 요청서의 “잠금은 완료 콜백까지 유지되고 전 분기에서 정확히 1회 해제”와 다르다.
- 영향: 대상 aggregation 수에 따라 화면이 영구 BUSY가 되거나, 실제 붙여넣기 작업 도중 로컬 조작과 단축키가 조기에 허용되어 재진입/상태 경합이 가능하다.
- 근거: 공통 `aggrSelectPopup`은 D&D 호출자의 잠금 계약을 전제로 팝업 표시 시 자체 해제한다. 미리보기 메뉴가 선행 설정한 로컬 잠금과 `_pasteUI`의 방송 잠금 계약은 동일하지 않다.
- 제안: 미리보기 위임 경로가 소유한 `parent.setBusy`까지 모든 종료 분기에서 해제하도록 하되, aggregation 선택 팝업 확인 후 실제 비동기 붙여넣기 구간에는 로컬 BUSY/단축키를 다시 설정하고 완료 후 해제하도록 잠금 소유권을 한 곳으로 정리한다. `_done`은 중복 호출에도 안전하도록 1회 가드를 두는 편이 안전하다.

## 확인 결과

| 검수 항목 | 결과 | 비고 |
|---|---|---|
| 일반 UI 크래시 우회 | 통과 | 유효한 일반 노드는 `fnWs20PasteUI`로 위임되어 원본 미정의 함수 호출을 피한다. |
| ROOT 원본 범위 보존 | 통과 | ROOT는 원본의 BUSY/단축키 해제 EXIT로 통과한다. |
| APP 원본 범위 보존 | 실패 | APP은 붙여넣기 허용 대상인데 원본 크래시 경로로 잘못 폴백한다. |
| 잠금 대칭/비동기 완료 | 실패 | aggregation 후보 수에 따라 로컬 BUSY 잔류 또는 조기 해제가 발생한다. |
| 트리 경로 회귀 | 통과 | `fnWs20PasteUI = _pasteUI` 공개만 추가되어 트리 M07의 직접 `_pasteUI` 호출 자체는 유지된다. |
| 멱등/로드 타이밍 | 통과 | `__ws20PasteDelegate` 가드와 기존 세 설치 진입점으로 중복 래핑을 막는다. |
| 복사 형식 호환 | 통과 | BR20의 `_copyUI`가 `_T_0015`, `_CEVT`, `_DESC`를 재귀 동봉하고 `_pasteUI`가 동일 복사 버퍼의 `DATA`를 공통 코어에 전달한다. |

## 검증

- `node --check www/ws30/ws10_20/js/ws_html5_ws20_edit.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_prev.js` 통과
- `node --check www/ws30/ws10_20/js/ws_html5_ws20_dnd.js` 통과
- 원본 메뉴 활성화/호출 경로, HTML5 래퍼, 공통 aggregation 선택 및 붙여넣기 코어 정적 추적 완료
- 실제 UI 조작 테스트는 수행하지 않음

## 제안

위 2건을 반영한 뒤 최소한 다음 분기를 각각 실화면 재검증해야 한다.

1. 일반 UI와 `APP` 대상 붙여넣기
2. aggregation 후보 0개, 1개, 2개 이상
3. 2개 이상 팝업의 확인, X/취소, ESC
4. 성공·취소·검증 실패·예외 후 로컬 BUSY, 자식창 BUSY, 단축키 잠금이 모두 해제되는지
