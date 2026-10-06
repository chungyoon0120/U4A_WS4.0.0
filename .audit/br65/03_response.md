# BR65 검수 결과 반영·해명 (03)

## 판정 요약

| 검수자 | 판정 |
|---|---|
| 코덱스 | **통과** (P3 비차단 참고 1건 — 도달 근거 없음으로 P2→P3 하향) |
| 안티 | **❌ 수정 필요** (P2 1건) |

두 검수의 지적은 **동일한 1건**이다(등급만 다름). → **반영함.**

## 지적 취합

| # | 지적 | 검수자 | 처리 | 근거 |
|---|---|---|---|---|
| 1 | `_confirmAsync` 가 `U4AUI.confirm` 의 **동기 폴백**(`<dialog>` 미지원 / `showModal()` 예외 → `window.confirm`)에서 순서가 역전된다. `onClose` 가 confirm **반환 전에** 동기 실행되므로 `onClose 재-ON → resolve → confirm 반환 → 표시직후 OFF` 가 되어, **확인(YES) 시 별창 잠금이 풀린 채** `attrSetBindProp` + WS20 왕복이 진행된다 | 코덱스(P3) · 안티(P2) | **반영** | 아래 §반영 1 |

### 반영 1 — `_confirmAsync` 순서 강제

**지적은 코드상 사실임을 직접 확인했다.**
- `theme/u4a-ui.js:2304~2311` — `document.createElement("dialog")` 가 실패하거나 `showModal` 이 함수가 아니면
  `window.confirm(sMsg)` 후 `_done(...)` 을 **반환 전에 동기 호출**하고 `return` 한다.
- `theme/u4a-ui.js:2355~2356` — `document.body.appendChild(oDlg); oDlg.showModal();` 이 throw 하면
  catch 에서 `_close(window.confirm(...))` 를 역시 **반환 전에 동기 실행**한다.

**수정**: `www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js:322~352` `_confirmAsync`
- `bReturned`(confirm 호출이 반환됐는지) / `bClosed`(이미 닫혔는지) / `sRet`(판정) 3개 지역변수 도입.
- `onClose` 는 판정만 적어 두고, **아직 반환 전이면 아무것도 하지 않고 종료**한다.
- confirm 호출이 반환된 직후 `bReturned = true` → 원본 순서대로 **① 표시직후 로컬 OFF** 실행 →
  이미 닫혀 있었으면(**동기 폴백**) 그 자리에서 **② 로컬 ON + resolve**(`_closeStep`).
- 정상 `<dialog>` 경로는 `bReturned` 가 이미 true 이므로 `onClose` 에서 곧바로 `_closeStep()` — **기존 동작 그대로**.

→ 어느 경로든 **표시직후 OFF → 닫힘 후 ON → resolve** 순서가 보장된다(원본 `index.js:6990→6976` / `7064→7051` 와 동일).
취소 시 전체 해제(`setBusyWS20Interaction(false, {})`)는 `_confirmAsync` 반환 뒤 호출부에서 그대로 실행된다.

**등급 판단**: 코덱스의 "현행 Electron 14.2.9(Chromium 93)에서 `<dialog>.showModal()` 은 지원되므로 정상 경로에선 도달 안 함"은
사실이다(`package.json:21` `"electron": "^14.2.9"` 확인). 그럼에도 반영한 이유는
① 수정 비용이 지역변수 3개 + 분기 1개로 극히 작고,
② 프로젝트 규칙 `.claude/rules/code.md` 의 **"busy: on 걸면 모든 종료 분기에서 off 짝 필수"** 는 도달 확률과 무관한 상위 규칙이며,
③ 이건 원본에 없는 UX 추가가 아니라 **원본 순서를 어떤 경로에서도 지키게 하는 방어**라 임의창작 금지에 저촉되지 않기 때문이다.

## 반론 / 보류

없음. 두 검수의 유일한 지적을 그대로 반영했다.

## 검수자가 확인해 준 정상 항목 (요청서 검수포인트 대조)

| 검수포인트 | 결과 |
|---|---|
| 1. 원본 1:1 (`sOption` 유/무 구분) | 정상 — 인자 없음=방송 안 함, `{}`=BUSY_OFF 방송. 뒤바뀜 없음(양쪽 확인) |
| 2. 종료 분기 off 짝 | 정상 — 취소 2갈래 전체 OFF / YES 는 왕복 위임 / 예외는 드롭 리스너 catch 회수 |
| 3. BUSY_ON 2회 · OFF 1회 | 정상 — WS20 수신부는 횟수를 세지 않는 단순 잠금이라 1회로 해제 |
| 4. 취소 시 데이터 무변경 | 정상 — 해제/트리/쓰기 함수보다 앞에서 `return` |
| 5. 확인창 클릭 가능성 | 정상 — 네이티브 모달은 뒤 화면을 스스로 막으므로 별창 덮개만 꺼도 뒤 조작 안 열림 |
| 6. 짧은 깜빡임 | 정상 — 재-ON 과 전체 OFF 가 같은 처리 묶음 안이라 중간에 화면이 다시 그려지지 않음 |
| 7. `_confirmAdditApply` 와의 중복 | 합치지 않는 판단이 타당(다른 파일의 지역 함수 + 진입 BUSY 소유 방식이 다름) — 코덱스 |
| 8. 회귀(최초 바인딩 / YES 경로) | 정상 — 미변경 |

## ★ 별건 보고 (이번 범위 밖 — 지시 대기)

**`designArea/designArea.js:800` `_confirmAdditApply(sMsg, sBusyDesc)` 에 동일 구조의 순서 역전이 남아 있다.**
- 같은 모양이다: `onClose` 안에서 `setBusy(true, {ISBROAD:true})` → 함수 밖 `if (sBusyDesc) { oAPP.fn.setBusy(false, {ISBROAD:true}); }`.
  동기 폴백에선 마찬가지로 ON 뒤에 OFF 가 실행돼 확인(YES) 처리 중 별창 잠금이 풀린다.
- 사용처: 추가속성 적용(단건) 재적용 확인창 등.
- **고치지 않았다.** BR65 범위 밖이고, 그 코드는 다른 이슈 검수를 이미 통과한 구역이라 임의 변경 시 회귀 위험이 있다.
  고칠지 여부는 장군님 지시를 기다린다. (도달 조건은 BR65 와 동일하게 현행 런타임에선 성립하지 않음)

## 검증

- `node --check www/ws30/ws10_20/Popups/bindPopup/designArea/bindWrite.js` 통과
- 실화면 테스트 = `.works/bindpopup/00_현황판.md` 그룹 **BR65** (앱 재시작 후 진행)

---

## ★ 추가 지시 반영 — `window.confirm` / `window.alert` 전면 금지 (장군님 지시 2026-09-02)

검수 지적을 보고받으신 장군님이 **브라우저 기본 대화상자 사용 자체를 금지**하셨다.
→ BR65 지적의 뿌리였던 `U4AUI.confirm` 의 `window.confirm` fallback 을 **제거**했고, 같은 성격의 코드를 **전수 조사해 함께 정리**했다.

### 정리 원칙
확인창은 **공통 `U4AUI.confirm` / `fnConfirmBox` 만** 쓴다.
공통이 미로드거나 `<dialog>.showModal()` 이 실패하면 **fallback 을 만들지 않고**
`접두-번호` 오류코드로 `console.error` 표면화 + **fail-closed**(진행하지 않음 = NO/CANCEL)로 종료한다.

### 처리 완료 (8파일 · 11곳)

| 파일 | 곳 | 오류코드 |
|---|---|---|
| `theme/u4a-ui.js` `confirm` | 2 (`<dialog>` 미지원 / `showModal` 예외) | `U4AUI-001` `U4AUI-002` |
| `ws30/resources/index.js` | 3 (토스트 실패 / `<dialog>` 미지원 / `showModal` 예외) | `RSRC-001~003` |
| `js/ws_html5_shell.js` `fnConfirmBox` | 1 | `SHEL-001` |
| `js/usp/ws_html5_usp.js` 되돌아가기 확인 | 1 | `USP-001` |
| `js/ws_events.js` | 2 (Activate 확인 / 페이지 뒤로가기 확인) | `WSEV-018` `WSEV-019` |
| `js/ws_html5_ws20_edit.js` 삭제 확인 | 3 (되돌리기·다시하기 / 단건 / 다건) | `W20E-001~003` |
| `Popups/mimeRepository/frame.js` | 1 | `MIMF-001` (콜백 예외 `MIMF-002`) |
| `Popups/versionMng/versionMngFrame.js` | 2 (오류안내 `alert` / 임시 App 생성 확인) | `VMNG-001` `VMNG-002`ㅤ|

- 새 접두 7개를 `.works/DEV_STANDARD_오류처리.md` 접두 사전에 등록.
- `.claude/rules/code.md` 에 금지 규칙 1줄 추가(재발 방지).
- 전 파일 `node --check` 통과.

### 미처리 — 성격이 달라 지시 대기

| 위치 | 내용 | 왜 안 고쳤나 |
|---|---|---|
| `intro.js:662` | 설치 초기화 실패 `alert` | 부팅 화면이라 `u4a-ui.js` 가 로드되지 않는다(`intro3.html` script 목록 확인). 대체 수단이 없어 그냥 지우면 실패를 사용자가 못 본다 |
| `js/usp/monaco/index.js:1116` · `Popups/versionManagement/Popup/monaco/index.js:373` | 우클릭 메뉴 `alert('🧠 선택한 코드:')` | 개발 중 남은 확인용 코드로 보인다. 기능인지 잔재인지 판단 필요 |
| `js/usp/monaco/index.js:1249` · `Popups/versionManagement/Popup/monaco/index.js:506` | 드롭 파일 확장자 안내 `alert` | 사용자 안내라 대체(토스트 등)가 필요 — 원본 대응 확인 후 진행해야 함 |
| `Popups/ui5CssPopup_v2/detail/index.html:165` · `others/M1/frame.js:97` · `others/M2/frame.js:96` · `others/tmp/ui5_ver/frame.js:45` | `sap` 미로드 시 `alert("bootstrap 로드 오류!!")` | 부팅 실패 알림. 그 화면에 공통 컴포넌트가 로드되는지 확인 후 진행 |
| `js/download.js:117` | Safari 팝업차단 시 `confirm` | **외부 라이브러리**(download.js). Electron Chromium 이라 도달 불가 |
| `ADMIN/DevToolsPermission/index.js:25` | `alert(sRETURN.RTMSG)` | **주석 블록(`/* 사용 예시 */`) 안** — 실행 코드 아님 |

### BR65 방어 코드는 유지
공통에서 fallback 이 사라져 `onClose` 가 반환 전에 동기 호출되는 경로는 이제 없다.
그래도 `_confirmAsync` 의 순서 강제(반환 여부 플래그)는 **그대로 유지**한다 —
정상 경로 동작은 동일하고, 두 검수가 함께 요구한 순서 보장이기 때문. 주석에 사유를 남겼다.
