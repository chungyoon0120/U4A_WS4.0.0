# BR21 검수 요청 (01_request)

## 검수 대상
- 파일1: `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - 신규 노출: `oAPP.fn.fnWs20PasteUI = _pasteUI;` (기존 트리 붙여넣기 함수 `_pasteUI`를 외부에서 부를 수 있게 공개)
- 파일2: `www/ws30/ws10_20/js/ws_html5_ws20_prev.js`
  - 함수: `lf_installPreviewMoveDelegate()` 안에 미리보기 우클릭 "붙여넣기" 위임(`_wrappedPaste`) 추가
  - 진입 배선: 원본 `oAPP.fn.contextMenuUiPaste`를 로드 후 감싼다(멱등, `__ws20PasteDelegate` 가드)
- 관련(수정 안 함, 근거용):
  - 크래시 원인 원본: `www/ws30/ws10_20/design/js/callDesignContextMenu.js:1389` (`oAPP.fn.aggrSelectPopupOpener(...)` 무가드 호출)
  - 미정의 함수 정의처: `www/ws30/ws10_20/design/tools/opner.js:15` (원본 `main()` 실행 시에만 동적 import → HTML5 부팅 경로엔 미로드)
  - 공통 붙여넣기 코어: `www/ws30/ws10_20/js/ws_html5_ws20_dnd.js:974` (`fnWs20AddTreeData`)
  - 트리 붙여넣기 메뉴(같은 코어 소비, SSOT): `ws_html5_ws20_edit.js:1764` (`M07` `_pasteUI(oNode)`), 활성조건 `edit.js:1740`(`en.paste = bHasCopy`, ROOT는 전부 비활성 `edit.js:1733`)
  - 선행 동일유형: BR20(복사 위임 `prev.js:1270`), BR17(위/아래 이동 위임 `prev.js:1244`)

## 증상 (BR21, 화면: 미리보기)
WS20 미리보기 영역에서 UI를 복사한 뒤, 미리보기 UI 위 우클릭 → 컨텍스트 메뉴 "붙여넣기" 선택 시
`TypeError: oAPP.fn.aggrSelectPopupOpener is not a function` 발생 → 미리보기 전역 오류 처리에서 Critical 오류로 전환.
붙여넣기가 수행되지 않고(Tree/Preview에 신규 UI 미추가), Aggregation 선택 이전 단계에서 중단.

## 원인
미리보기 우클릭 메뉴는 원본 UI5 모듈(`callDesignContextMenu.js`)을 그대로 로드해 쓴다.
그 붙여넣기(`contextMenuUiPaste`)는 대상 Aggregation 선택을 위해 `aggrSelectPopupOpener()`를 무가드로 부른다.
이 함수는 원본 `main()`이 실행될 때 `opner.js`에서 동적 import되는데, HTML5 WS20 부팅은 원본 `main()`을
실행하지 않고 미리보기 모듈만 별도 초기화하므로 미정의 상태 → 호출 즉시 예외.
(다음 단계 `designAddTreeData`도 같은 이유로 미정의라, opner.js만 끼워 넣어도 다음 예외가 이어질 상태.)

## 변경 요약 (원본 1:1 통합 — 트리와 동일 경로로 위임)
붙여넣기도 트리가 이미 쓰는 HTML5 공통 붙여넣기 코어(`fnWs20AddTreeData`) 경로로 통합한다.
KEEP-UI5 경계인 미리보기 원본 파일은 손대지 않고, HTML5 호스트에서 로드된 뒤 함수를 감싸 위임한다.

| # | 파일:위치 | 내용 |
|---|---|---|
| 1 | `edit.js` `_pasteUI` 정의 직후 | `oAPP.fn.fnWs20PasteUI = _pasteUI;` — 트리 붙여넣기 함수 공개(복사=`fnWs20CopyUI`와 동일 패턴) |
| 2 | `prev.js` `lf_installPreviewMoveDelegate` | 원본 `contextMenuUiPaste`를 `_wrappedPaste`로 감쌈. 메뉴 대상 OBJID를 `/lcmenu/OBJID`에서 얻어 `getTreeData`로 노드 조회 후 `fnWs20PasteUI(ls_node)` 호출 |
| 3 | 동상 `_wrappedPaste` 가드 | 대상이 `ROOT`/`APP`이거나 노드 조회 실패면 원본으로 폴백(원본의 깔끔한 EXIT 분기로 무동작 — 원본 `callDesignContextMenu.js:1344` ROOT EXIT와 동일) |

- 잠금(BUSY/단축키): `fnWs20PasteUI`(=`_pasteUI`)가 진입 시 `_broadBusy(true)`+`setShortcutLock(true)`, 완료 콜백 `_done`에서 짝 해제. Aggregation 선택 취소·검증 실패·예외·정상완료 모두 `_done`으로 수렴(`edit.js:658`).
- 비동기(붙여넣기는 Aggregation 선택 콜백 대기)라, 위임부에서 **동기 finally로 잠금을 풀지 않는다**(BR20 복사 위임과 다른 점 — 조기 해제 방지). 잠금 해제는 코어가 완료 시점에 수행.

## 검수 포인트
1. **정확성(크래시 제거)**: 미리보기 붙여넣기가 더는 `aggrSelectPopupOpener`/`designAddTreeData`(원본 미정의)를 타지 않고 `fnWs20AddTreeData` 코어로만 가는가. 원본 함수는 `ROOT`/`APP`/노드부재 폴백에서만 호출되며 그 경로는 예외 없이 EXIT하는가.
2. **잠금 짝맞춤**: 위임 경로에서 BUSY_ON(자식창 방송)/단축키잠금이 성공·취소·검증실패·예외 전 분기에서 정확히 1회 해제되는가(자체 finally 이중해제/조기해제 없는가). 예외 전 BUSY_ON 미해제(노션 "영향" 우려) 재발 없는가.
3. **원본 1:1 범위**: 붙여넣기 대상이 ROOT면 원본은 무동작 EXIT였다 → 위임도 무동작인가(공통 코어로 넘겨 루트에 붙는 부작용 없는가). 트리 M07 활성조건(ROOT 비활성)과 일치하는가.
4. **트리 경로 회귀 없음**: `_pasteUI`를 `fnWs20PasteUI`로 공개만 했을 뿐 트리 M07(`edit.js:1764`)이 부르는 `_pasteUI` 자체 동작은 불변인가(동일 함수 참조).
5. **멱등/로드 타이밍**: `callDesignContextMenu` 로드 전/후 어느 쪽으로 들어와도 위임이 1회만 설치되는가(`__ws20PasteDelegate` 가드). BR20 복사·BR17 이동 위임과 동일 설치 지점.
6. **복사 정책 일치**: 붙여넣기가 소비하는 복사본 형식(_T_0015/_CEVT/_DESC)이 트리 복사(BR20 `fnWs20CopyUI`)와 미리보기 복사 양쪽에서 동일하게 채워지는가(경로 간 형식 불일치로 재귀복사/속성 누락 없는가).

## 근거
- 크래시 원본: `callDesignContextMenu.js:1389`, 미정의 함수 정의처 `design/tools/opner.js:15`
- 공통 코어(SSOT): `ws_html5_ws20_dnd.js:974` `fnWs20AddTreeData`, 트리 붙여넣기 `edit.js:640` `_pasteUI`
- 규칙: `.claude/rules/code.md`(busy 종료분기 off 짝·WP1 비동기 완료 후 해제), 원본 1:1·임의창작 금지(CLAUDE.md)
- 노션 이슈DB BR21 "권장 수정 방향"(미리보기 붙여넣기를 `fnWs20AddTreeData` 경로로 통합, KEEP-UI5 `preview/index.js` 직접수정 금지·호스트 연결부에서 위임)
