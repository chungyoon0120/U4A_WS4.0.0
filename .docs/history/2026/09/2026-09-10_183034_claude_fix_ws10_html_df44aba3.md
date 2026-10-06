# WS10 권한 잠금 되살리기 (DM1·DM2)

## 요청

장군님: "같은 방식으로 잘못 관리되는 데이터 더 있는지 전수 조사해" → 조사 결과 3건(DM1·DM2·DM3) 보고 → "고쳐" → DM1·DM2 수정. 이후 "DM3의 AI 연결 관련된 내용은 보류다" → DM3 는 손대지 않음.

## 변경 내용

WS10 화면이 권한을 **코드에 박아둔 값**으로 판단하던 것을, 원본과 동일하게 **서버가 준 값 / 원본 판정 함수**를 보도록 되돌렸다.

### 제거한 박아둔 값

`WS_STATE` 안의 두 줄을 삭제.

- `USERINFO: { IS_DEV: "D" }` — 항상 개발 권한 있음으로 판정되던 원인
- `IS_STAFF: true` — 항상 U4A R&D 로 판정되던 원인

### 신설한 판정 함수 2개 (파일 상단)

| 함수 | 근거 | 값이 없을 때 |
|---|---|---|
| `_isDevAuth()` | `oAPP.common.fnGetModelProperty("/USERINFO/USER_AUTH/IS_DEV") === "D"` | `false` (fail-closed) + `GUARD_EXIT` 로그 |
| `_isStaff()` | `oAPP.fn.fnIsStaff()` | `false` (fail-closed) + `GUARD_EXIT` 로그 |

### 적용한 4곳

| 자리 | 전 | 후 |
|---|---|---|
| `buildMenubar` 의 `staffOnly` 판정 (WS10·WS20·WS30 **공용**) | `WS_STATE.IS_STAFF` | `_isStaff()` |
| `_renderSubHeader` 의 `bDev` (개발 전용 버튼 노출) | `WS_STATE.USERINFO.IS_DEV === "D"` | `_isDevAuth()` |
| 단축키 `hit.dev` 판정 | `WS_STATE.USERINFO.IS_DEV !== "D"` | `!_isDevAuth()` |
| `_getWindowMenu()` — **신규** | 없음 | `WMENU10_01` · `WMENU10_02_01` 에 `disabled: !_isDevAuth()` 부여 |

마지막 항목이 원본 `fnWs10HeaderMenuEnableBinding`(원본 `ws_fn_01.js` 1091~1120) 의 재현이다. 원본이 막는 두 항목만 그대로 막는다.

## 변경 파일

- 추가: 없음
- 변경: `www/ws30/ws10_20/js/ws10_html.js` (백업 `js/_ws10_html.js.dm1dm2bak`)
- 삭제: 없음

문서:
- 변경: `.works/앱이름입력값기준/01_전수조사.md` (DM1·DM2 고침 완료 / DM3 보류 표시)
- 변경: `.works/앱이름입력값기준/00_현황판.md` (DA 그룹 6건 추가, 맨 위)

## 변경 이유

원본은 세 가지를 잠근다. HTML5 로 옮기며 **판단 근거를 코드에 박아 넣어 세 잠금이 전부 풀려 있었다.**

| 잠금 | 원본 근거 |
|---|---|
| 만들기·바꾸기·지우기·복사 버튼 **감추기** | 원본 `ws_fn_01.js` 1357~1370 (`visible` 바인딩) |
| `WMENU10_01`(App. Package Change) · `WMENU10_02_01`(App. Importing) **회색 처리** | 원본 `ws_fn_01.js` 1091~1120 (`enabled` 바인딩) |
| Test 메뉴 **감추기** | 원본 `ws_fn_01.js` 1321(WS10) · 2856(WS20) · `js/usp/ws_usp.js` 602(WS30) — 전부 `fnIsStaff()` |

판정에 필요한 값과 함수는 **HTML5 에도 이미 살아 있었다.** WS20 화면(`ws_html5_ws20.js` 489)과 USP 화면(`usp/ws_html5_usp.js` 2043)은 서버 값을 제대로 쓰고 있었고, `fnIsStaff` 도 정상 동작(`ws_fn_03.js` 279 + `ws_html5_shell.js` 338 래퍼). **WS10 만 안 쓰고 있었다.**

## 영향 범위

- **WS10** — 개발 전용 버튼 4개, 단축키 4개, 메뉴 항목 2개, Test 메뉴
- **WS20 · WS30** — Test 메뉴만 (메뉴바 빌더가 공용이라 함께 적용됨)
- 그 외 화면 영향 없음

주의: **개발 권한이 없는 아이디로 접속하면 WS10 의 버튼·메뉴가 실제로 사라지거나 회색이 된다.** 이것이 원본 동작이다.

## 검증

- `node --check` 통과
- 실행 순서 확인 — 모델 초기화(`ws_main.js` 1092)가 화면 그리기(`ws_main.js` 1148)보다 **먼저**. 판정 시점에 값이 준비되어 있다
- 회색 표시 스타일 존재 확인 — `theme/shell.css` 791 (`aria-disabled` 대상)
- 하위 메뉴도 같은 빌더(`_buildMenuEl`)를 쓰므로 `WMENU10_02_01` 에도 적용됨을 소스로 확인
- 원본 WS20 메뉴에는 `enabled` 잠금이 없음을 확인 → WS20 메뉴는 건드리지 않음
- **실화면 미검증.** 아이디를 바꿔 로그인해야 확인 가능 → 테스트 6건 `.works/앱이름입력값기준/00_현황판.md` DA 그룹

## 참고 사항

### 조사 중 내가 틀렸던 것 (다음 agent 가 반복하지 않도록)

- **주석만 보고 단정했다가 두 번 뒤집었다.** `IS_DEV` 를 "개발서버"라 했다가, 근거 없이 "개발자 권한"으로 바꿨다가, 다시 되돌렸다. **원본 주석이 자리마다 다르다** — 로그인 쪽(원본 `Login/Login.js` 1796)은 "개발서버 여부 개발서버 : D / (조회만 가능)", WS20 버튼 쪽(원본 `ws_fn_01.js` 3037·3106·3562)은 "개발자 권한이 없거나". **주석을 근거로 쓰지 말 것.**
- **`IS_DEV` 의 뜻은 아직 미확정.** 값을 만드는 로직은 서버(`/chk_u4a_authority`) 안에 있어 클라이언트 소스로는 확정 불가. 확인 방법 = ① 개발·운영 서버에 각각 붙어 로그인 직후 콘솔의 권한 응답값 비교 ② SAP 접속 도구 복구 후 서버 함수 확인. **뜻이 무엇이든 이번 수정 방식은 동일하다.**
- 로그인 차단 조건은 `IS_DEV` 가 **아니다.** `ISLICEN` 과 `DEV_KEY` 가 빈 값일 때만 차단한다(`Login/Login.js` 1201~1202).

### Test 메뉴와 SYSID

장군님이 "Test 메뉴는 SYSID 기준 아니냐"고 3회 확인 요청. **원본 두 폴더 전수 조사 결과 SYSID 기준은 없다.** `fnIsStaff` 정의는 1개뿐이고 접속 아이디만 본다. SYSID 를 보는 곳은 Test 메뉴 안의 **개발툴** 항목이 여는 개발자 도구 권한 점검(`www/ADMIN/DevToolsPermission/index.js` 161~) 이며, 이건 별개 잠금이다.

### 남은 것

- **DM3 (AI 연결 버튼) — 보류**(장군님 지시). 버튼은 화면에서 숨김 상태(`ws10_html.js` 의 `display:none` 한 줄). 다시 꺼낼 때 ① 실제 처리 미연결(`WIRED_EVENTS` 목록에 AI 처리 없음) ② 겉모습과 `/UAI/state` 가 따로 놈 ③ 원본의 busy·자식창 신호 누락 — 3가지를 함께 처리해야 한다.
- 실행에 쓰이지 않는 미리보기 파일 `www/ws30/ws10_20/WS10/WS10.js` 에 같은 박아둔 값(`IS_DEV:"D"` · `IS_STAFF:true`)이 남아 있다. **실행 경로가 아니라 손대지 않았다.**

### 같은 세션의 앞선 작업

이 세션 초반(2026-09-08)에 **앱 이름 검색칸 ↔ `/WS10/APPID` 묶임 복원**을 했다. 파일 5개 수정(`ws10_html.js` · `ws_html5_shell.js` · `fnAppCopyPopupOpen.js` · `fnHmws.js` · `fnDialogPopupOpener.js`), 백업 접미사 `.appidbindbak`, 테스트 8건(WA 그룹). **그 작업의 이력 파일은 남기지 못했다** — 그때 hook 이 걸리지 않았다. 내용은 `.works/앱이름입력값기준/01_전수조사.md` 에 정리되어 있다.

### 작업 중 사고

python 으로 파일을 고치면서 **줄바꿈이 CRLF → LF 로 통째로 바뀌는 사고**가 두 번 있었다. 매번 바이너리로 다시 CRLF 로 되돌렸다. 이 프로젝트 소스는 **CRLF** 다. python 텍스트 모드로 읽고 쓰면 반드시 되돌릴 것.
