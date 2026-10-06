# 앱 본체(main process)의 console 출력 — 로그 파일에 안 들어가는 것 전수 목록

> 조사 2026-09-14. **아직 아무것도 안 고쳤다.** 장군님 승인 뒤에 바꾼다.
> 대상 = `electron/` 폴더 안 `console.error` · `console.warn` **54곳 전부**

---

## 지금 정해 주실 것

| 무엇 | 내용 |
|---|---|
| **바꿀 것** | **48줄** → `WsMainLog.writeLog` 로 교체 |
| 그냥 둘 것 | **5줄** — 로그 장치가 실패한 것을 기록하는 자리. 또 불러 봐야 또 실패 |
| 대상 아님 | **1줄** — 앱 본체 파일 안에 있지만 실제로는 화면에서 도는 코드 |
| 위험 | 동작 안 바뀜. 출력이 터미널 → 로그 파일로 바뀔 뿐 |
| 되돌리기 | git |

**→ 48줄 바꿀까요?**

---

## 왜 이게 문제인가

화면(renderer)은 `console.error` 를 electron-log 로 **갈아끼워** 놨다
(`www/ws30/ws10_20/js/ws_log.js:153` — `Object.assign(CONSOLE, log.functions)`).

**앱 본체는 안 갈아끼웠다.** 설치한 앱에는 터미널이 없으므로
이 54줄은 **어디에도 안 남는다.** 하필 "로그 장치·텔레그램·크래시 보고서가
왜 실패했나" 를 알려 주는 줄들이다.

`WsMainLog.writeLog(등급, 글)` 은 electron-log 에 직접 넣는다
(`electron/lib/log/ws_main_log.js:92`). `[ETC] [main] ...` 모양으로 파일에 남는다.

**순환 참조 걱정 없음** — `main.js:56` 에서 `WsMainLog.install(app)` 을 **가장 먼저** 부르고,
크래시 보고서 쪽은 이미 함수 안에서 `require('./ws_main_log')` 를 늦게 부르고 있다.

---

## A. 바꿀 것 — 48줄

### A-1. 크래시 보고서 (`electron/lib/log/ws_crash_report.js`) 19줄

| 줄 | 지금 내용 |
|---|---|
| 89 | `[CRSH-001] crashReporter is unavailable - skipping.` |
| 114 | `[CRSH-002] could not start crashReporter.` |
| 202 | `[CRSH-003] could not create the running mark.` |
| 216 | `[CRSH-003] could not delete the running mark.` |
| 274 | `[CRSH-006] could not read the already-reported list.` |
| 298 | `[CRSH-007] could not write the already-reported list.` |
| 354 | `[CRSH-008] could not delete old dump files.` |
| 520 | `[CRSH-011] could not build the crash report.` |
| 560 | `[CRSH-004] could not read the previous run state.` |
| 596 | `[CRSH-005] could not check for dump files.` |
| 662 | `[CRSH-005] could not hand the crash record to the sender.` |
| 787 | `[CRSH-012] could not hand the renderer crash record to the sender.` |
| 800 | `[CRSH-013] could not build the report at the renderer crash site.` |
| 808 | `[CRSH-013] could not build the report at the renderer crash site.` |
| 845 | `[CRSH-015] could not look for a newly written dump.` |
| 885 | `[CRSH-016] could not log the fact that no dump appeared.` |
| 944 | `[CRSH-015] could not look for a newly written dump.` |
| 1026 | `[CRSH-009] could not wrap the exit function.` |
| 1033 | `[CRSH-010] could not hook the process exit point.` |

**★여기가 가장 중요하다.** 크래시 보고서가 안 만들어졌을 때
**왜 안 만들어졌는지** 를 알려 주는 줄이 전부 여기 있다. 지금은 통째로 사라진다.

### A-2. 텔레그램 (`electron/lib/log/ws_telegram.js`) 13줄

| 줄 | 지금 내용 |
|---|---|
| 55 | `[TGSD-001] telegram config file is missing - not sending.` |
| 65 | `[TGSD-002] could not read the telegram config file - not sending.` |
| 73 | `[TGSD-003] telegram config file has a bad shape - not sending.` |
| 204 | `[TGSD-004] daily send limit reached - not sending.` |
| 262 | `[TGSD-009] secret masking failed - not sending (fail-closed).` |
| 336 | `[TGSD-005] could not read the tail of the log file.` |
| 372 | `[TGSD-006] could not build the file to send.` |
| 393 | `[TGSD-007] could not read the file to send.` |
| 452 | `[TGSD-008] telegram rejected the upload. status: … / response: …` |
| 460 | `[TGSD-008] telegram upload timed out.` |
| 466 | `[TGSD-008] telegram upload failed.` |
| 550 | `[TGSD-005] could not determine the log file path.` |
| 607 | `[TGSD-001] could not open the renderer-side send channel.` |

> ⚠️ **452번 줄 주의** — 텔레그램이 돌려준 응답 본문을 300글자 남긴다.
> 지금은 터미널로만 가서 안 쌓이지만, 파일에 남기면 **쌓인다.**
> 응답 본문에 bot token 이 들어갈 일은 없어 보이나(**미확인**),
> 바꿀 때 **토큰 모양 글자를 가리는 처리를 같이 넣는 것**을 권한다.

### A-3. 오류 감시 설치 (`electron/lib/log/ws_error_hook.js`) 4줄

| 줄 | 지금 내용 |
|---|---|
| 317 | `[EHOK-001] webFrameMain is unavailable - skipping auto install of the error hook.` |
| 322 | `[EHOK-001] webFrameMain not found - skipping auto install of the error hook.` |
| 342 | `[EHOK-002] could not install the error hook - the window may have been closed.` |
| 346 | `[EHOK-002] could not install the error hook.` |

**이게 안 남으면** "그 화면에서 왜 오류가 하나도 안 잡혔나" 를 영영 모른다.

### A-4. 앱 본체 로그 장치 (`electron/lib/log/ws_main_log.js`) 5줄

| 줄 | 지금 내용 | 왜 바꿔도 되나 |
|---|---|---|
| 153 | `[MLOG-002] could not set the log file path - falling back to the default path.` | electron-log 는 살아 있다. 기본 경로에라도 남는다 |
| 177 | `[MLOG-006] could not determine the build time.` | 로그 장치와 무관 |
| 373 | `[MLOG-005] could not open the channel that receives renderer errors.` | 로그 장치와 무관. **이게 실패하면 화면 오류가 통째로 안 온다** |
| 424 | `[MLOG-007] could not update the last user action.` | 크래시 보고서의 「마지막 조작」이 틀어지는 자리 |
| 513 | `[MLOG-005] could not hand a renderer error to the sender.` | 로그 장치와 무관 |

### A-5. 덤프 분석 (`electron/lib/log/ws_crash_dump_read.js`) 3줄

| 줄 | 지금 내용 |
|---|---|
| 247 | `[CDMP-001] could not open the crash dump.` |
| 559 | `[CDMP-002] the dump parser itself threw.` |
| 566 | `[CDMP-003] could not close the dump file.` |

### A-6. 메시지 DB (`electron/lib/msg/`) 4줄

| 파일 | 줄 | 지금 내용 |
|---|---|---|
| `MessageDatabase.js` | 74 | `[MessageDatabase] getMessageClassRow error:` |
| `MessageDatabase.js` | 94 | `[MessageDatabase] findByText error:` |
| `MessageDatabase.js` | 111 | `[MessageDatabase] getParamTemplates error:` |
| `WsMsgClsService.js` | 68 | `[WsMsgClsService] DB open failed (LANGU: … , PATH: …)` |

두 파일 다 우리 코드다(앞머리에 남의 저작권 표시 없음, `better-sqlite3` 만 바깥 것).

---

## B. 그냥 둘 것 — 5줄

**전부 「로그 장치가 실패한 것을 기록하려는」 자리다.** 같은 것을 또 불러 봐야 또 실패한다.
특히 마지막 두 줄은 **앱이 죽기 직전 최후 방어**라, 여기서 또 터지면 앱이 그냥 죽는다.

| 파일 | 줄 | 지금 내용 | 이유 |
|---|---|---|---|
| `ws_main_log.js` | 131 | `[MLOG-001] electron-log failed to load` | **로그 장치 자체가 없다.** `writeLog` 도 터미널로 간다 |
| `ws_main_log.js` | 239 | `[MLOG-006] could not record display info.` | `writeLog` 를 감싼 catch |
| `ws_main_log.js` | 245 | `[MLOG-003] could not write the startup header.` | `writeLog` 를 감싼 catch |
| `ws_main_log.js` | 261 | `[MLOG-004] failed while recording an uncaught error.` | **최후 방어** — `writeLog` 를 감싼 catch |
| `ws_main_log.js` | 277 | `[MLOG-004] failed while recording an unhandled rejection.` | **최후 방어** — `writeLog` 를 감싼 catch |

---

## C. 대상 아님 — 1줄

| 파일 | 줄 | 이유 |
|---|---|---|
| `ws_error_hook.js` | 103 | 앱 본체 파일 안에 있지만 **화면에 집어넣는 글자 덩어리 안**이다. 실제로는 화면에서 돌고, 화면은 이미 로그 파일로 간다 |

---

## 덤으로 찾은 것 (고칠지 같이 정해 주십시오)

`electron/main.js:412` 가 `WsMainLog.writeLog('INFO', …)` 로 부른다.
`writeLog` 는 **한국어 등급 키**(`'알림'`/`'주의'`/`'오류'`/`'치명'`)를 받아 영어로 바꾸는 함수다.
`'INFO'` 를 넘기면 표에 없어 **그대로 통과**한다 — 결과 글자는 `[INFO]` 로 맞게 나오지만
**우연히 맞는 것**이다. `'알림'` 으로 바꾸면 다른 자리와 같아진다.
