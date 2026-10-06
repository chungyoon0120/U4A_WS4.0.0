# INCIDENT.md 로 코덱스가 오류를 재현하는지 시험 — WS4.0 에 넣은 것 (로그 한 줄)

## 같은 주제의 이력 (세 프로젝트에 나눠 남김 — 머리 부분은 셋이 같다)

- **주제** : INCIDENT.md 로 코덱스가 오류를 재현하는지 시험 (`incident-codex-repro-test`)
- **한 줄** : 테스트 프로그램이 WS4.0 오류를 잡아 `INCIDENT.md` 를 만든다 → 코덱스가 그 문서만 보고 WS4.0 을 띄워 같은 오류를 낸다 → 못 내면 문서 · 전송 메시지 · 재현 도구 · WS4.0 로그를 보완해 다시 한다
- **기간** : 2026-10-01 20:20 시작 ~ 2026-10-02 11:09 현재 진행 중 (이 PC `YOON` 한 대 · Claude 세션 `d8c595b8`)
- **전체 내용이 있는 곳(원본)** : `D:\workspace\u4a-ws-cdp-tester\.works\u4a-ws-cdp-tester\13_INCIDENT_코덱스_재현시험\index.md`
- **세 이력** — 각자 자기 프로젝트에서 고친 것만 적는다
  | 프로젝트 | 무엇을 고쳤나 | 이력 파일 |
  |---|---|---|
  | 테스트 프로그램 `u4a-ws-cdp-tester` | 명령줄 시작 · `INCIDENT.md` 보강 · 기록 시점 버그 | `D:\workspace\u4a-ws-cdp-tester\.docs\history\2026\10\2026-10-02_110937_claude_mixed_incident-codex-repro-test_d8c595b8.md` |
  | 데몬 `ws4-auto-fix-daemon` | 재현 도구 `ws4-measure.bat`(`measure.py` · `cdp.py`) | `D:\workspace\ws4-auto-fix-daemon\.docs\history\2026\10\2026-10-02_110937_claude_fix_incident-codex-repro-test_d8c595b8.md` |
  | WS4.0 `U4A_WS4.0.0` | 로그 한 줄(세션 유지 호출 실패의 HTTP 상태) | `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0\.docs\history\2026\10\2026-10-02_110937_claude_add_incident-codex-repro-test_d8c595b8.md` **(이 파일)** |

★이 이력은 **테스트 프로그램 창의 Claude 세션(`d8c595b8`)** 이 남겼다. WS4.0 창의 세션이 아니다.
이 프로젝트의 `CURRENT.md` · `TODO.md` 는 WS4.0 창이 고치고 있어 **건드리지 않았다.**

---

## 요청

장군님 2026-10-01 :

- 「ws4.0 소스는 절대 건들지 않는걸로 강력히 명심하고, 고칠 수 잇는건 로그 남기는 것 뿐이다」
- 「기존 로직은 건들지 않는다」 · 「고치는건 나중에 코덱스의 결과를 바탕으로 개발자가 고치는거다」
- (로그 추가를 여쭌 뒤) 「고치고 진행해 멈추지마」

## 변경 내용

세션 유지 호출(`/dummycall` — 로그인 때 한 번 + 10분마다)이 실패했을 때 **왜 실패했는지(HTTP 상태)를 로그로 남긴다.** 동작은 그대로다.

- `u4aWsServerSessionWorker.js` — 실패를 알리는 `postMessage` 에 `HTTP_STATUS` · `HTTP_STATUS_TEXT` 두 값을 더 실어 보낸다. 이 값으로 갈라지는 동작은 없다
- `fnServerSession.js` — 기존 `console.error(oData.RTMSG)` 바로 뒤에 `U4ALOG.warn("SERVER_SESSION", "keep-alive /dummycall failed …", "RETCD=…, HTTP status=…, RTMSG=…")` 한 줄. `try/catch` 로 감싸 로그 때문에 흐름이 바뀌지 않게 했다

## 변경 파일

**변경**
- `www/ws30/ws10_20/js/workers/u4aWsServerSessionWorker.js` (+4)
- `www/ws30/ws10_20/js/fnServerSession.js` (+10)

**추가 · 삭제** : 없음 (이 이력 파일만 추가)

**커밋** : 안 함 (브랜치 `bootstrap`). 이 저장소에는 WS4.0 창의 다른 미커밋 변경이 있다(`ws_usp.js` · `ws_fn_04.js` · `ws_html5_logger.js` · `ws_trycatch.js` · `design/preview/index.js` 등) — **이 세션이 고친 것은 위 두 파일뿐**이다

## 변경 이유

전체 앱을 돌리던 중 앱 `YYCV_0000000756` 에서 `connection fail!` 이 났다. 코덱스가 `INCIDENT.md` 의 걸음을 그대로 따라 했지만 다시 나지 않았다.
콘솔에 남은 것은 `connection fail!` 한 줄뿐이라 **서버가 뭐라고 답했는지 어디에도 없었다.** 원인도 재현 조건도 짚을 수 없었다.

## 영향 범위

- 세션 유지 호출이 **실패했을 때만** 로그 한 줄이 더 찍힌다. 성공할 때는 아무것도 안 바뀐다
- 실패 뒤의 동작(다른 창 닫기 · 세션 종료 팝업)은 그대로
- 테스트 프로그램이 이 줄을 모아 `INCIDENT.md` 의 「오류가 난 순간 WS4.0 이 찍은 줄」 에 보여 준다

## 검증

- 로그를 넣은 뒤 같은 현상이 다시 났을 때 `HTTP status=500` 이 찍힌 것을 확인(로그인 뒤 1200초 시점의 세션 유지 호출)
- 이 줄이 든 `INCIDENT.md` 를 받은 코덱스가 「재현 대상 아님 — 걸음과 무관(서버)」 으로 스스로 판단(2026-10-02 05:34 `k01`)
- **미검증** : 설치본(빌드)에서의 동작 — 노빌드로만 돌렸다

## 참고 사항

- **되돌린 것** : `www/ServerList_v2/ServerList.js` 에 `oAPP.CLAUDE_TEST` 한 줄을 임시로 넣었다가 **원래대로 돌려놓음**(체크섬 확인). 장군님이 「`electron.exe` 로 띄워도 고친 소스가 반영되는지」 를 서버 목록 화면에서 직접 눈으로 보시려던 것 — 반영되는 것을 확인하심
- 자동 모드에서 WS4.0 소스 편집이 한 번 막혔다(공유 자원 수정) → 장군님 허락 뒤 편집
- **이 시험에서 WS4.0 에 대해 알게 된 것 — 고치지 않았다** (목적이 아님 · 적어만 둔다)
  - 노빌드로 돌린 이날 Electron 크래시 리포트도 WS4.0 메인 로그도 새로 생기지 않았다
  - 시험에서 재현된 오류 23건(치명 오류 6 · 화면 멈춤 4 · 콘솔 오류 13)의 목록 : 테스트 프로그램 쪽 `13_INCIDENT_코덱스_재현시험\보고서.md` 2절. **고치는 것은 개발자가 코덱스 결과를 보고 한다**
