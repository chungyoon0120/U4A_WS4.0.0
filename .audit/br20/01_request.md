# 01_request — BR20 미리보기 우클릭 "복사" 예외로 미동작

## 검수 대상 (파일·함수)
- `www/ws30/ws10_20/js/ws_html5_ws20_edit.js`
  - `_copyUI(oNode)` (기존) → **노출 추가** `oAPP.fn.fnWs20CopyUI = _copyUI;`
- `www/ws30/ws10_20/js/ws_html5_ws20_prev.js`
  - `lf_installPreviewMoveDelegate()` 안에 **복사 위임 블록 추가**: 원본 `oAPP.fn.contextMenuUiCopy` 를 감싸 트리 복사(`fnWs20CopyUI`)로 위임 + tail 정리(잠금해제) 보장.
- (참고·무수정) 원본 미리보기 스크립트 `www/ws30/ws10_20/design/js/callDesignContextMenu.js` — `contextMenuUiCopy`(638행), `lf_setTreeItemAttr`(641~676), 메뉴선택 tail(708~710행), 메뉴선택시 BUSY_ON/단축키잠금(17·20행).

## 버그 원인 (노션 BR20)
- 증상: WS20 미리보기 영역에서 우클릭 → "복사" 선택 시 예외로 복사 미완료 + [Critical Error] 팝업.
- 원인: 원본 `contextMenuUiCopy` → `lf_setTreeItemAttr` 가 **HTML5 에 정의되지 않은 `oAPP.fn.getUiClientEvent`** 를 호출(`callDesignContextMenu.js:660`) → `TypeError` → 이후 로직(복사 저장·tail 잠금해제) 미도달.
- BUSY 는 이 건에서 잠기지 않음(노션 계측: `getBusy()` 빈 값). 단축키잠금(setShortcutLock(true), 17·20행)만 tail 미도달로 해제 못 할 위험.
- BR17(미리보기 위/아래 이동이 `getTreeIndexOfChild` 미정의로 죽음)과 **동일 유형** — 원본 미리보기 컨텍스트 메뉴가 HTML5 미로드 함수를 호출.

## 변경 요약 (원본 대비)
1. **edit.js**: 트리 컨텍스트 메뉴가 이미 쓰는 정상 복사 함수 `_copyUI` 를 `oAPP.fn.fnWs20CopyUI` 로 노출(로직 변경 없음).
   - `_copyUI` 는 원본 `lf_setTreeItemAttr` 와 **동일 형식**으로 속성(`_T_0015`)·클라이언트이벤트(`_CEVT`=T_CEVT 원행)·설명(`_DESC`)을 동봉하고 `setCopyData(COPY_AREA,...)` 로 복사버퍼에 저장. ROOT/APP 가드 포함.
2. **prev.js**: 미리보기 모듈 로드 후 설치되는 위임 설치 함수에 복사 위임 추가.
   - `contextMenuUiCopy` 를 감싸(`__ws20CopyDelegate` 가드, 멱등), 우클릭 라인 OBJID(`/lcmenu/OBJID`)로 `getTreeData` → `fnWs20CopyUI(node)` 위임.
   - `node` 없으면 원본 함수로 fallback.
   - **tail 정리**: 원본 708~710행과 동일하게 `setShortcutLock(false)` + `parent.setBusy("")` 를 `finally` 로 보장(예외에도 잠금 잔존 없음 — BR20 의 tail 미도달 원천 차단).
   - 원본 `callDesignContextMenu.js` 는 **손대지 않음**(override 패턴).

## 검수 포인트
1. **원인 정확성**: `getUiClientEvent` 미정의가 예외 지점이 맞는가(660행). tail 미도달로 인한 미완료가 맞는가.
2. **위임 자체완결성**: `fnWs20CopyUI(_copyUI)` 가 원본 `lf_setTreeItemAttr` 가 하던 3종 동봉(_T_0015·_CEVT·_DESC)을 **동일 형식**으로 수행하는가. 붙여넣기(공통 `designAddTreeData`/`_applyP13nPattern`)가 이 형식을 그대로 소비하는가.
3. **잠금 대칭성**: 메뉴 선택 시 켜진 화면잠금(setBusy)·단축키잠금(setShortcutLock)이 위임 경로에서 **반드시 해제**되는가(finally). 이중 잠금/누수 없는가. (원본은 tail 에서만 해제 → 예외 시 미도달이었음)
4. **노드 참조 일관성**: 위임 래퍼가 원본과 동일하게 `/lcmenu/OBJID` → `getTreeData` 로 라이브 트리 노드를 취득하는가.
5. **fallback 보존**: `fnWs20CopyUI`/노드 없을 때 원본 `contextMenuUiCopy` 로 안전 회피하는가.
6. **멱등/설치 시점**: `__ws20CopyDelegate` 가드로 중복 래핑 없는가. 이동 위임과 같은 3진입점(+재진입 early-return)에서 함께 설치되는가.
7. **원본 무수정 override**: `callDesignContextMenu.js` 등 원본을 직접 고치지 않고 prev.js/edit.js 만으로 처리했는가.
8. **ROOT/APP 가드**: 문서/앱 루트 복사 시 원본처럼 아무 것도 복사 안 하고 잠금만 해제되는가.

## 근거
- 노션 이슈 리포트 BR20 (코드=BR20, 화면=미리보기): 오류 `TypeError: oAPP.fn.getUiClientEvent is not a function` @ `callDesignContextMenu.js:662`(호출 660), `contextMenuUiCopy`(:703 setCopyData 직전), 계측 2026-08-11 19:20.
- 원본 tail: `callDesignContextMenu.js:708~710` (`setShortcutLock(false)`, `parent.setBusy("")`), 메뉴선택 BUSY_ON/잠금: `:17`, `:20`.
- 선행 동일유형: BR17(미리보기 위/아래 이동 위임) — `.audit/br17/`.
- `node --check` 두 파일 통과.
