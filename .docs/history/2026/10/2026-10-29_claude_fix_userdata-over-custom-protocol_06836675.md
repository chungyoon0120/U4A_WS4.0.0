# N4 — 앱 데이터 폴더(`userData`)의 파일을 `u4a-ws://` 가 못 읽던 것

- 날짜: 2026-10-29
- 지시: 장군님 「비디오 녹화에서, 녹화 중지후 저장된 목록 팝업 조회 시 이런 오류 발생」 →
  「앱 데이터 부분 읽을때 문제인거 같은데?」 → 「진행해」
- 고친 자리: `electron/lib/protocol/ws_app_protocol.js` — host 를 둘로 나눴다

## 증상

녹화 기록 창(「녹화 히스토리」)에서 영상이 전부 **404**.

```
Failed to load resource: the server responded with a status of 404 (Not Found)
  recording_20261029_141329.webm
  recording_20260602_143810.webm
  %ED%95%A8%E3%84%B4%EB%8C%80….webm      ← 한글 이름 파일
```

파일은 실제로 있다 — `C:\Users\socce\AppData\Roaming\com.u4a_ws3.app.dev\screen_record\video\`.

## 원인 — 장군님 짐작이 맞았다

녹화 영상은 **앱 데이터 폴더**(`app.getPath('userData')`)에 저장된다. 그런데 `u4a-ws://` 는
**앱 폴더(`app.getAppPath()`) 하나만** 뿌리로 알고 있었다.

`toAppUrl` 이 `path.relative(앱폴더, 영상경로)` 를 하니 `../../../../` 가 붙고,
브라우저가 그 `..` 를 접어 버려 엉뚱한 자리를 찾았다. `node` 로 그대로 재현했다.

```
path.relative       : ../../../../AppData/Roaming/com.u4a_ws3.app.dev/screen_record/video/recording_20260602_143810.webm
toAppUrl 이 만든 주소 : u4a-ws://app/../../../../AppData/Roaming/.../recording_20260602_143810.webm
브라우저 정규화 후    : u4a-ws://app/AppData/Roaming/.../recording_20260602_143810.webm
핸들러가 찾는 파일    : <프로젝트폴더>\AppData\Roaming\...\recording_20260602_143810.webm   ← 없음 → 404
```

★ 403(뿌리 밖 차단)이 아니라 **404** 가 난 것이 혼란의 원인이었다. `..` 가 접히면서
경로가 뿌리 **안**으로 들어와 버려 차단에 안 걸리고, 그냥 없는 파일이 됐다.

## 고친 방법 — host 를 둘로 나눈다

| 주소 | 뿌리 |
|---|---|
| `u4a-ws://app/…` | `app.getAppPath()` (지금 그대로) |
| **`u4a-ws://data/…`** | **`app.getPath('userData')`** (새로 더함) |

뿌리를 **가르는** 것이 핵심이다. 한 host 로 두 폴더를 다루면 `..` 가 섞인 주소가 또 생긴다.

고친 것(한 파일):
1. `HOST_DATA = 'data'` 상수 추가 · `_dataRoot` 변수 추가
2. `_isUnder(뿌리, 경로)` 공통 함수 — `_serve` 의 빠져나가기 검사와 `toAppUrl` 의 뿌리 판별이
   같은 일을 하므로 한 곳에 뒀다(복붙 금지 규칙)
3. `_getRootByHost(host)` — host 로 뿌리를 고른다. 모르는 host 면 404(전과 같음)
4. `install` 에서 `_dataRoot = oApp.getPath('userData')`
5. `toAppUrl` 이 절대 경로를 받으면 **어느 뿌리 아래인지 먼저 가린다**
6. **두 뿌리 어디에도 없으면 경고 로그 + 입력 그대로 반환** — 전에는 `..` 주소를 조용히 만들었다

## 영향도

`toAppUrl` 호출처는 **113곳**(정의·주석 10줄 제외, `www` + `electron` 전체).
전수를 하나씩 읽는 대신 **코드로 안전을 보장**했다 — 새로 넣은 분기는
**`..` 가 생기는 경우(= 앱 폴더 밖)에만** 탄다.

| 넘기는 경로 | 지금 | 고친 뒤 |
|---|---|---|
| 앱 폴더 안 (대다수 — 창 html · 로고 · 워커 · 소리) | 정상 | **똑같다** (코드 경로 동일) |
| 앱 데이터 폴더 (녹화 영상 · p13n · 패턴 · 아이콘) | **404 로 조용히 깨짐** | 열린다 |
| 두 뿌리 밖 | `..` 주소를 조용히 만듦 | **경고 로그** + 입력 그대로 |

→ **나빠질 자리가 없다.** 밖 경로를 넘기던 자리는 지금 전부 이미 깨져 있다.
어느 자리가 밖인지는 앱을 돌리면 `GUARD_EXIT | toAppUrl path is outside both roots` 로 전부 찍힌다 —
전수 조사보다 정확하다.

## 실측 — electron 없이 진짜 모듈을 불러 돌렸다

`Module._load` 로 `electron` 만 가짜를 끼우고 `install()` 까지 실제로 불렀다.

| 넘긴 것 | 결과 |
|---|---|
| 앱 폴더 (창 html) | `u4a-ws://app/www/ws30/ws10_20/index.html` |
| 앱 폴더 (로고) | `u4a-ws://app/www/img/logo.png` |
| 앱 데이터 (녹화 영상) | `u4a-ws://data/screen_record/video/recording_20260602_143810.webm` |
| 앱 데이터 (한글 이름) | `u4a-ws://data/screen_record/video/%ED%95%A8%EC%88%98%20…webm` |
| 앱 데이터 (p13n) | `u4a-ws://data/p13n/theme_ws4/UHA.json` |
| `D:\somewhere\else\file.txt` | 경고 로그 + 입력 그대로 |
| 상대 경로 · 이미 주소 · `https` · 쿼리 붙은 주소 | 전과 같음 |

시험 파일 = 스크래치패드 `prot_test.js`(프로젝트에 안 넣는다).

## 또 밟을 함정

- **앱이 실행 중에 만드는 파일은 앱 폴더가 아니라 앱 데이터 폴더에 쌓인다.**
  `pathInfo.js` 기준 그 아래인 것: `P13N_ROOT` · `USERDATA_PATTERN_ROOT` · `CONF_ROOT` ·
  `USERDATA_PATT_FILES` · `CLIPBOARD` · `DEF_PATT` · `CUST_PATT` · `U4AICON_ROOT`.
  여기에 녹화 영상(`userData/screen_record/video`)이 더 있다.
- **`..` 가 섞인 주소는 403 이 아니라 404 로 나타난다.** 브라우저가 `..` 를 접어 경로를
  뿌리 안으로 되돌려 놓기 때문이다. 404 를 보고 「파일이 없다」로 단정하지 말 것 —
  **주소가 어떻게 만들어졌는지**부터 본다.
- 새 폴더를 뿌리로 더해야 하면 `HOST_DATA` 를 더한 것과 같은 방식으로 **host 를 하나 더** 만든다.
  뿌리 하나에 여러 폴더를 밀어 넣지 않는다.

## 미검증

- **앱으로 돌려 보지 않았다.** `node --check` 와 위 실측만 했다. 테스트 = TODO 의 N4-1 · N4-2 · N4-3.
- **설치본(packaged)에서는 뿌리 값이 다르다** — `getAppPath()` 가 `resources/app.asar` 가 된다.
  `userData` 쪽은 그대로다. 설치본 확인은 안 했다(개발 모드에서만 테스트하는 규칙).
- 앱 데이터 폴더 경로를 넘기는 자리가 녹화 말고 **어디에 더 있는지는 아직 모른다.**
  고의로 전수를 돌리지 않고 경고 로그로 드러나게 했다.
