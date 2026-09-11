# 자동 시험 도구 — exe 폐지 · 배포 꾸러미(zip) · 소켓 되돌림 · PC 이름 기록

## 요청

장군님, 한 대화 안에서 이어진 요청들:

1. "exe 하지말고 지금처럼 bat 파일로 해"
2. "화면 캡쳐는 실패했네? 안되는건가?"
3. "야 왜 패키지json에 의존성 왜 없어진거야? ws ?"
4. "실행하자마자 오류 난다고" / "다른 pc에서"
5. "cdp 인데 웹소켓으로 디버깅 포트로 붙어서 화면을 찾아야 하는데 웹소켓 라이브러리 조차 오류인데
   화면을 볼수나 있겠냐? 그럼 로그도 잘못됐잖아"
6. "그러면 run 폴더에서 스타트 누르면 알아서 설치되는거냐?" → "install.bat 하나 만들면 되잖아"
7. "dist로 말아주고, zip으로도 같이 말아줘"
8. "readme에 사용법도 적어논거야?" → "항상 뭐 하나 바뀌면 현행화좀 해"
9. "로그를 남길때, 컴퓨터 이름까지 남겨줘 어떤 pc에서 발생된건지도 좀 알고 싶어.. process.COMPUTERNAME 인가?"

## 변경 내용

### 1) exe 굽기 폐지 — bat 로만 간다

`make-exe.js` · `_exebuild/` · `dist/u4a-autotest.exe` · `run/0-start-standalone.bat` 전부 제거.
굽는 도구 `postject` 도 제거(`npm uninstall postject`).

여러 파일을 하나로 합치는 과정에서 namespace 이름이 사라져 **실행 중에만** 터지는
`ReferenceError: notion is not defined` 가 났었다. 합치는 과정 자체가 없어져 구조적으로 사라졌다.

죽은 코드도 같이 제거 — `require('node:sea').isSea()` 로 exe 여부를 보고 경로를 고르던 갈래
(`edit-back-loop.js` LOG_DIR, `env/index.js` ENV_DIR). 이제 `__dirname` 만 쓴다.

`make-dist.js` 에서 `--withModules` 와 `npm run dist:full` 도 제거(받을 꾸러미가 0개라 무의미).

### 2) 화면 캡처 실패 — 사진을 다 찍기 전에 연결을 끊고 있었다

기록에 순서가 그대로 남아 있었다:

```
18.278  [win1] 콘솔오류 발견 → 증거 담기 시작(사진 찍는 중)
18.396  [win1] 종료.        ← 연결 끊음  ★사진 아직 안 찍힘
18.398  screenshot-failed.txt "WebSocket error"
18.398  telegram 사진 실패 — 보낼 그림이 없다
```

`fireIncident` 가 `saveIncident` 를 **기다리지 않고** 시작해 놓고, 반복 루프의 `finally` 가
바로 `session.close()` 를 불러 진행 중이던 `Page.captureScreenshot` 요청이 끊겼다.

- `edit-back-loop.js` : `incidentSavePromise` 를 새로 두고, `finally` 에서 `session.close()` **전에**
  그것을 await 한다
- `lib/incident.js` : 화면 찍기에만 **10초 제한**을 따로 뒀다(`SHOT_TIMEOUT_MS`, `_withTimeout`).
  요청 제한이 5분이라, 창이 굳으면 증거 담기가 5분간 붙잡혀 프로그램이 안 끝나기 때문

### 3) `ws` 꾸러미 되돌림 — 다른 PC 에서 시작하자마자 죽던 원인

2026-09-09 에 `ws` 를 걷어내고 노드 내장 WebSocket 만 쓰게 바꿨었다(package.json 의
`dependencies` 도 그때 같이 지웠다). **내장 WebSocket 은 노드 v22 부터 들어 있다.**
노드가 낮은 PC 에서는 창마다 `globalThis.WebSocket is not a constructor` 를 뱉고
마지막에 "WS10 화면이 하나도 없다" 로 끝나 **진짜 원인이 안 보였다.**

`lib/cdp-client.js` 에 `_pickWsMaker()` 를 두어 갈래를 셋으로 나눴다:

| 순서 | 무엇 | 비고 |
|---|---|---|
| ① | `require('ws')` | 있으면 이것. 이 파일이 원래 쓰던 on/off/once 모양이라 껍데기 없이 그대로 반환 |
| ② | `globalThis.WebSocket` | 없을 때. addEventListener 방식이라 얇은 껍데기를 씌운다 |
| ③ | 둘 다 없음 | `CDP-001` 로 던진다 — 노드 올리거나 `npm install ws` 하라고 안내 |

`describeSocketMaker()` 를 새로 내보내고, `edit-back-loop.js` · `probe.js` **맨 처음**에 불러
못 붙으면 창을 찾으러 가지 않고 그 이유만 말하고 끝낸다.

### 4) 「WS10 화면이 하나도 없다」 — 거짓말하던 로그를 고침

창에 못 붙으면 그 창이 무슨 화면인지 알 방법이 없는데도 화면 탓으로 돌리고 있었다.
`edit-back-loop.js` 창 훑는 자리에 `aFailed` 를 두어, 못 붙은 창은 **이름·창번호·사유**를
찍고 "창 N개에 붙지 못했다 — 무슨 화면인지 알 수조차 없다" 를 **화면 탓 문구보다 먼저** 낸다.
하나도 못 붙었으면 거기서 끝낸다.

### 5) `run/install.bat` — 필요하면 알아서 깐다

전에는 `5-setup.bat` 이 노드 있나만 보고 "받을 것 없음"이라 말했다(노드 낮은 PC 에선 거짓말).

`5-setup.bat` → **`install.bat`** 으로 이름 바꾸고 내용 교체:
노드 확인 → **붙을 수단이 있나 확인** → 없으면 `npm install ws` 실행 → 결과 확인.
인터넷이 없어 실패하면 "연결하고 다시 하거나 노드를 v22 이상으로" 안내하고 끝낸다.

`1-start.bat` 은 실패 시 "install.bat 을 한 번 돌리라" 안내를 붙였다.

### 6) dist + zip

`make-dist.js` 에 `_makeZip()` 추가. 윈도우에 원래 있는 `Compress-Archive` 를 쓴다(바깥 꾸러미 안 씀).
`cdp-auto-test_YYYYMMDD_HHmm.zip` (`--noSecrets` 면 `_nosecrets` 붙음).

**`logs` 는 묶음에서 뺀다.** 탐색기 등이 사고 폴더를 붙잡고 있으면 지우기가 EPERM 으로 막히는데,
그러면 **지난 시험의 묵은 사고 기록이 그대로 묶여 남에게 건네진다**(실제로 한 번 들어갔다).
지우기에 기대지 말고 아예 제외했다. 받는 쪽은 처음 돌릴 때 스스로 만든다.

### 7) PC 이름을 기록에 남김

`process.COMPUTERNAME` 은 **undefined** 다. `process.env.COMPUTERNAME` 이 맞다.

`lib/machine.js` 신규 — `process.env.COMPUTERNAME` → 없으면 `os.hostname()`.
`{pc, user, node, os}` 를 한 번만 읽어 캐시한다.

| 어디 | 무엇이 남나 |
|---|---|
| 로그 파일 이름 | `run_YOON_20260911_105618.log` |
| 로그 첫 줄 | `host=YOON user=socce node=v24.13.0 os=Windows_NT 10.0.26200` |
| `SUMMARY.md` | `- **host** : YOON (user socce)` |
| telegram | 맨 윗줄 `host : YOON (user socce)` |
| notion | DB `PC` 칸 + 본문 host 줄 |

노션 오류 기록 DB(`3d6a2d4a-ab9f-81bf-8eea-c1820636a24c`)에 **`PC` 칸(rich_text) 신설**,
`env/config.json` · `config.sample.json` 의 `notion.properties.pc = "PC"` 추가.

### 8) README 현행화

README 가 2026-09-08 상태로 남아 있었다. **"텔레그램 등 외부 알림 — 로그 파일로만 남긴다"**
라고 적혀 있었는데 그때 이미 telegram·notion 알림이 다 들어가 있었다. 통째로 다시 썼다.
증거 폴더 파일 이름도 옛것(`요약.md`·`최근기록.log`·`원문.json`)이라 실제 이름
(`SUMMARY.md`·`log-tail.log`·`raw.json`·`screenshot.png`)으로 맞췄다.

## 변경 파일

- 추가:
  - `test/cdp-auto-test/lib/machine.js`
  - `test/cdp-auto-test/run/install.bat` (`5-setup.bat` 대체)
  - `.docs/history/2026/09/2026-09-11_105737_claude_mixed_cdp-auto-test_ea44f304.md` (이 파일)
- 변경:
  - `test/cdp-auto-test/edit-back-loop.js` — SEA 갈래 제거 · 소켓 점검 · `aFailed` · `incidentSavePromise`
  - `test/cdp-auto-test/probe.js` — 소켓 점검
  - `test/cdp-auto-test/lib/cdp-client.js` — `_pickWsMaker` · `describeSocketMaker`
  - `test/cdp-auto-test/lib/incident.js` — 화면 찍기 10초 제한 · SUMMARY 에 host
  - `test/cdp-auto-test/lib/logger.js` — 파일 이름에 PC · 첫 줄 host
  - `test/cdp-auto-test/lib/notify-telegram.js` — host 줄
  - `test/cdp-auto-test/lib/notify-notion.js` — PC 칸 · 본문 host 줄
  - `test/cdp-auto-test/make-dist.js` — exe 제거 · `--withModules` 제거 · `_makeZip` · HOWTO 글
  - `test/cdp-auto-test/package.json` — `dist:full` 제거
  - `test/cdp-auto-test/env/config.json` · `config.sample.json` — `properties.pc`
  - `test/cdp-auto-test/run/1-start.bat` — 실패 시 install.bat 안내
  - `test/cdp-auto-test/README.md` — 전면 현행화
  - `.gitignore` — `_exe빌드/` 줄 제거
- 삭제:
  - `test/cdp-auto-test/make-exe.js`
  - `test/cdp-auto-test/_exebuild/`
  - `test/cdp-auto-test/run/0-start-standalone.bat`
  - `node_modules/postject`

## 변경 이유

- exe 는 합치는 과정에서만 생기는 결함(이름 소실)을 계속 낳았고, 장군님이 bat 로 가자고 하셨다
- 화면 그림이 첨부돼야 telegram 알림이 쓸모가 있는데, race 때문에 매번 빠졌다
- `ws` 를 뺀 판단이 **다른 PC 를 못 본 판단**이었다. 이 PC 에서는 앱 프로젝트 쪽
  `U4A_WS4.0.0/node_modules/ws` 를 주워 쓰고 있어서 멀쩡했고, 그것만 들고 나간 PC 에서만 터졌다
- 로그가 원인을 화면 탓으로 돌리면 장군님이 엉뚱하게 화면을 옮겨 놓고 다시 돌리게 된다

## 영향 범위

`test/cdp-auto-test/` 안으로 한정. 앱 소스(`www/`)는 건드리지 않았다.
노션은 오류 기록 DB 에 `PC` 칸 하나가 늘었다(기존 줄은 비어 있음, 새 줄부터 채워짐).

## 검증

앱을 실제로 켜 두고 확인한 것:

| 확인 | 결과 |
|---|---|
| 화면 캡처 race — 고치기 전(안 기다리고 닫음) | 사진 **없음** "CDP connection closed" |
| 화면 캡처 race — 고친 뒤(다 담고 닫음) | 사진 **있음, 733,128 바이트** ✅ |
| 소켓 없을 때 시작 | `cannot start - no way to attach to a window` + `CDP-001` 안내 ✅ |
| 프로젝트 밖(다른 PC 흉내)에서 `install.bat` — 노드 v22+ | `-> built-in WebSocket: OK` / 받을 것 없음 ✅ |
| 같은 자리, 붙을 수단 없게 만들고 `install.bat` | `npm install ws` → `added 1 package` → `[OK] Installed` ✅ |
| 깐 뒤 앱 붙기 | `창에 붙는 수단: ws 꾸러미` → 창 찾고 화면 읽음 ✅ |
| zip 풀어서 `install.bat` · `logs` 자동 생성 | 둘 다 정상, 묵은 사고 기록 안 들어감 ✅ |
| PC 이름 — 로그 파일명·첫 줄·SUMMARY·telegram | 전부 `YOON` ✅ |
| PC 이름 — 노션 | 실제 한 건 보내 `PC = YOON` 확인 ✅ |

**확인 못 한 것**:
- zip 을 푼 뒤 앱에 붙는 것까지는 못 봤다 — 그 시점에 앱이 꺼져 있었다.
  (같은 dist 폴더로는 붙는 것을 확인했으므로 zip 이 원인일 가능성은 낮지만, **직접 보지는 않았다**)
- 노드가 실제로 v22 미만인 PC 에서는 돌려 보지 못했다. 내장 WebSocket 을 지워서 흉내만 냈다.

## 참고 사항

- **`process.COMPUTERNAME` 은 없다.** `process.env.COMPUTERNAME` 이다. 다음에 또 헷갈리지 말 것
- `npm uninstall <꾸러미>` 는 다른 의존성을 건드리지 않는다(의심돼서 따로 시험해 확인함).
  `ws` 가 package.json 에서 사라진 것은 2026-09-09 작업 때 내가 지운 것이다
- **이 PC 는 `ws` 를 `U4A_WS4.0.0/node_modules` 에서 주워 쓴다.** 그래서 여기서 시험하면
  내장 WebSocket 갈래가 안 돌아간다. **반드시 프로젝트 밖으로 복사해서** 시험할 것
- Bash 도구의 heredoc 안에서 JS 템플릿 문자열에 `\\n` 을 쓰면 실제 줄바꿈으로 바뀌어 문법오류가 난다.
  여러 줄 문자열은 배열 + `join` 으로 만들거나 Edit 도구를 쓸 것 (이번에 두 번 당했다)
- 장군님 지시 기억에 추가: **"항상 뭐 하나 바뀌면 현행화좀 해"**
  (`memory/keep-docs-current-with-every-change.md`)
