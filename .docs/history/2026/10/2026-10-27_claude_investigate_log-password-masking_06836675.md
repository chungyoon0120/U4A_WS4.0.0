# 로그에 SAP 비밀번호가 남는지 조사 (컨트롤러 클래스 실행)

- 날짜: 2026-10-27
- 세션: 06836675
- 지시: 장군님 「컨트롤러 클래스 실행 공통 함수에서 로그를 남길때 비밀번호가 노출되는 부분이 있어
  이부분은 로그를 남길때는 마스킹 처리해줘」 (로그 토막 첨부 — `[VBS 실행 파라미터]` 줄에 평문 비밀번호)

## 판정 — WS4.0 은 이미 가려져 있다. 고칠 것이 없다

**소스를 고치지 않았다.** 장군님 지시였지만 원인이 WS4.0 이 아니었다(`always.md` 0-3).

## 다 봤다 기준과 결과

| 본 것 | 결과 |
|---|---|
| `[VBS 실행 파라미터]` 문자열 전수 (`www` 전체) | **1곳뿐** — `www/ws30/ws10_20/js/ws_fn_04.js:338` |
| 그 자리 앞의 마스킹 | **있다** — `aLogParam = aParam.slice(); aLogParam[9] = "******"` (2026-09-17 넣음) |
| 1차 VBS(`newSESSTION.vbs`) 의 `aParam` | 비밀번호가 **아예 없다**(SYSTEMID·CLIENT·ID·APPID…), 찍지도 않는다 |
| 2차 VBS(`sapgui_ws.vbs`) 의 `aParam` | index 9 = `oUserInfo.PW` — 로그용 사본만 가린다. VBS 에 넘기는 값은 그대로(기능 동일) |
| 공통 함수 `oAPP.common.execControllerClass` (`ws_common.js:2939`) | 로그를 **한 줄도 안 남긴다** |
| `[VBS 실행 오류]` 로그 | 경로 + VBS stderr 뿐 — 비밀번호 없음 |
| `SPAWN` | `require("child_process").spawn` 그대로 — 인자를 로그로 남기지 않는다 |
| 로그 호출에 `PW`·`PASSWORD` 가 같이 든 줄 (`www`·`electron`) | 없다 |
| `sap-password=` 가 든 URL 을 만드는 자리 (아이콘 목록·즐겨찾기 아이콘·WebDynpro 변환 기록 등) | 만들기만 하고 **로그로 찍는 자리는 없다** |
| `electron/lib/log/ws_telegram.js:292` | 텔레그램 알림은 `password|passwd|pwd|token|secret` 을 따로 가린다 |

## 그러면 장군님이 보신 평문은 어디서 났나 — **설치된 WS3.0 포장본**이다

| 근거 | 값 |
|---|---|
| 로그 폴더 | `AppData\Roaming\com.u4a_ws3.app\logs` |
| WS4.0 이 쓰는 폴더 | `com.u4a_ws3.app.dev` — `electron/main.js:32` `app.isPackaged ? appName : appName + ".dev"` |
| 평문이 남은 가장 최근 로그 | `U4A_WS_2026_10_12.log` (가린 날 2026-09-17 **이후**) |
| 그 로그가 누구인지 | 같은 파일에 `…\Programs\com.u4a_ws3.app\resources\app.asar\www\ServerList_v2\ServerList.html` — **포장본(app.asar)** |
| 같은 로그의 WS4.0 표식(`CLICK`·`GUARD_EXIT`·`NAV`) | **0건** |
| `com.u4a_ws3.app.dev\logs` 에 `PARAM: [` 줄 | **없다** — WS4.0 에서 컨트롤러 클래스를 아직 안 돌려 봤다 |

→ **WS3.0 원본 폴더는 읽기 전용이라 내가 못 고친다.** 그쪽을 고치려면 WS3.0 담당 쪽에 따로 넣어야 한다.

## 또 밟을 함정

1. **`package.json` 의 `name` 이 `com.u4a_ws3.app` 이다** — WS4.0 인데 이름이 WS3.0 이다.
   그래서 로그 폴더만 보고 「WS4.0 로그」라고 믿으면 틀린다. **`.dev` 가 붙었는지**로 가른다.
   더 확실한 가름 = 로그 안에 `resources\app.asar` 경로가 있으면 포장본, 구조화된 로그 줄(`CLICK`·`NAV`·`GUARD_EXIT`)이
   있으면 WS4.0.
2. **「고쳐 뒀다」 ≠ 「확인됐다」.** 가린 코드는 2026-09-17 에 들어갔는데 테스트 항목 CE1 이 아직 ☐ 다
   (`.works/execControllerClass/00_현황판.md`). 노션 65번도 같은 모양이었다(배선은 돼 있고 테스트만 안 됨).
   **번호를 받으면 먼저 지금 소스에 들어가 있는지부터 본다.**
3. **`grep` 을 프로젝트 루트(`.`)에 돌리면 2분을 넘긴다** — `node_modules` 와 `www/js/aceeditor`·`www/lib` 때문이다.
   Grep 도구(ripgrep)를 쓰거나 폴더를 좁힌다.

## 같이 한 것 — 노션 오류 2건 반영

| No. | 제목 | 처리 |
|---|---|---|
| 43 | Application 복사 — 복사 팝업의 패키지 돋보기에서 오류 팝업 | 장군님 테스트 완료 → 노션 「확인 구분」=수정완료 |
| 45 | Application Package 변경 — 삭제 확인 팝업 닫은 뒤 앱 이름이 남아 있음 | 장군님 테스트 완료 → 노션 「확인 구분」=수정완료 |

| 56 | 새 Workspace 창 열기 — 새창열기로 서버에 다녀오는 동안 처리중 표시가 안 뜸 | 장군님 테스트 완료 → 노션 「확인 구분」=수정완료 |

`.docs/노션_오류목록.md` 세 줄에 ✅, TODO 현황표 **66 → 63**(노션 끝남 3 → 6).

## 미결

- 가림이 실제로 먹는지 **실측 안 됐다** → TODO 🧪 테스트 항목에 1건 올렸다.
- WS3.0 포장본의 평문 로그는 **그대로 남아 있다** — 고칠지, 어디에 요청할지 장군님 결정 대기.
