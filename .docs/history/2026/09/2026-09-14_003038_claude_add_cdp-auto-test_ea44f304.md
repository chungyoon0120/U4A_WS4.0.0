# 자동 시험 도구 — 메모리·DOM 계측 추가 + notion log tail 자르는 방향 뒤집기

## 요청

`DESKTOP-RSEN8LA` 에서 `busy stuck on for 302125ms` 알림이 왔고, 장군님이 물으셨다:
"동일한 동작을 계속 실행하는데 점점 느려진다는건 어딘가 메모리 누수가 있는거 아닐까?"

내가 「재면 확정된다」고 두 가지를 제안했고 장군님이 **"1,2를 먼저 진행해"** 하셨다.

1. 반복 시험에 메모리 계측 넣기
2. notion log tail 이 뒤를 자르는 결함 고치기

## 변경 내용

### 1) 창마다 메모리·DOM 개수를 잰다

`lib/cdp-client.js` `openSession` 에 **`getMemoryStats()`** 추가. CDP 두 가지를 부른다:

| CDP | 얻는 값 |
|---|---|
| `Runtime.getHeapUsage` | `heapUsed` · `heapTotal` |
| `Memory.getDOMCounters` | `documents` · `nodes` · `jsEventListeners` |

둘 중 하나가 실패해도 나머지는 살린다. 실패 사유는 `heapError` / `domError` 로 담아
로그에 그대로 찍는다(조용히 넘기지 않는다).

`edit-back-loop.js`:
- `--memEvery <횟수>` 신설. **기본 1000바퀴**, `0` 이면 아예 안 잰다. `--help` 에도 넣음
- 창마다 **첫 바퀴에 한 번** 재서 기준(`memFirst`)을 잡고, 그 뒤 `MEM_EVERY` 바퀴마다 잰다
- `_memLine()` 이 **처음 잰 값과의 증감**을 같이 찍는다 → 우상향이 눈에 바로 들어온다
- 계측이 터져도 시험은 계속 간다(try/catch, 실패 시 ERROR 한 줄)

로그 모양:

```
[win1] cycle 550 memory: heap 20.5MB (+6.9MB) documents 5 (+0) nodes 1332 (+396) listeners 134 (+0)
```

**창별로 따로** 찍히므로 한 창에만 쌓이는지 바로 보인다(이번 사고가 `[win2]` 한 창만이었다).

### 2) notion log tail — 뒤를 남기고 앞을 자른다

`lib/notify-notion.js` `_codeBlock` 이 `slice(0, BLOCK_LIMIT)` 라 **뒤를 잘랐다.**
log tail 은 터지기 직전인 **뒤**가 중요한데 거꾸로였다.

실제 피해: 2026-09-12 busy stuck 기록의 log tail 이
`[win2] cycle 414240: WS20 -` 에서 끊겨 **그 사고 분석이 막혔다.**

이제 넘치면 앞을 자르고 맨 위에 한 줄 남긴다:
`... (앞부분 N자 잘림 - 전체는 log-tail.log 참고)`

## 변경 파일

- 추가: `.docs/history/2026/09/2026-09-14_003038_claude_add_cdp-auto-test_ea44f304.md` (이 파일)
- 변경:
  - `test/cdp-auto-test/lib/cdp-client.js` — `getMemoryStats()` 추가·노출
  - `test/cdp-auto-test/edit-back-loop.js` — `MEM_EVERY` · `_mb` · `_memLine` · 루프 머리 계측 · `--help`
  - `test/cdp-auto-test/lib/notify-notion.js` — `_codeBlock` 자르는 방향 반전
- 삭제: 없음

## 변경 이유

"점점 느려진다"도 "메모리 누수다"도 **아직 근거가 없었다.** 추측으로 다투는 대신
숫자를 남기게 했다. 특히 `jsEventListeners` 와 `documents` 는 화면 전환에서 새는 것을
가장 잘 잡는 값이다.

## 영향 범위

`test/cdp-auto-test/` 안으로 한정. 앱 소스(`www/`)는 건드리지 않았다.

계측은 1000바퀴에 한 번(약 100초마다) CDP 왕복 2번을 더 한다 — 시험 속도에 사실상 영향 없다.
`--memEvery 0` 으로 끌 수 있다.

## 검증

장군님 PC(`YOON`)의 켜 둔 앱에 붙여 **실제로 돌렸다.**

**75초 / 650바퀴 실측** (`--memEvery 50 --keepGoing`):

```
cycle   1  heap 13.6MB          nodes  936   listeners 134  documents 5
cycle 150  heap 15.7MB (+2.1)   nodes 1332   listeners 134  documents 5
cycle 350  heap 16.7MB (+3.2)   nodes 1440   listeners 134  documents 5
cycle 550  heap 20.5MB (+6.9)   nodes 1332   listeners 134  documents 5
cycle 650  heap 19.5MB (+6.0)   nodes 1233   listeners 134  documents 5
```

| 값 | 결과 |
|---|---|
| heap | **우상향** 13.6 → 19.5MB (75초에 약 6MB) |
| nodes | 780~1440 사이 **오르내림** (화면 전환에 따른 정상 출렁임으로 보인다) |
| listeners | **134 고정** — 안 샌다 |
| documents | **5 고정** — 안 샌다 |

**미검증 / 단정하지 못하는 것**:
- **heap 증가가 누수인지 GC 지연인지 아직 모른다.** 중간에 20.5 → 16.1MB 로 떨어지는 구간이
  있어 회수는 되고 있다. **길게(수만 바퀴) 돌려 평평해지는지 봐야 갈린다.**
- 이 75초 동안 화면은 계속 WS10 이었다(`WS10 -> enter edit` 만 찍힘). **WS10↔WS20 전환이
  실제로 일어난 상태에서의 값이 아니다.** 전환이 도는 상태로 다시 재야 한다.
- **notion log tail 반전은 눈으로 못 봤다.** 실제 사고가 나야 확인된다. 코드만 고쳤다.
- 창이 하나뿐이라 **여러 창일 때 창별로 갈리는지**는 확인 못 했다.

## 참고 사항

- `Memory.getDOMCounters` 는 그 renderer **전체**(iframe 포함)를 센다. 한 창만 열어도
  `documents 5` 가 나온 이유다. 창=renderer 가 1:1 인지는 확인 안 했다
- `performance.memory` 로도 heap 을 읽을 수 있지만 값이 반올림돼 온다.
  `Runtime.getHeapUsage` 가 정확해서 그쪽을 썼다
- **아직 안 한 일**
  1. dist·zip 다시 말기 — 현장 PC 에 이 계측을 넣으려면 필요하다
  2. `DESKTOP-RSEN8LA` 의 `logs\run_DESKTOP-RSEN8LA_*.log` 와
     `incident_20260912_215359_busy_stuck_on\` 받기 — 이미 잡힌 그 고장을 푸는 유일한 길
  3. 전환이 실제로 도는 상태로 길게 재기
