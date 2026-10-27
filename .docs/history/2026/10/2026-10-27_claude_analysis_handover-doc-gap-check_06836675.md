# 인수인계 지침서와 현재 프로젝트 대조 (분석만 — 고친 것 없음)

- 일시: 2026-10-27
- 유형: analysis
- 지시: 장군님 「이 문서를 읽고 현재 프로젝트에 적용해야 할 내용이 어떤 건지 분석 좀 해줘」
- 읽은 문서: `D:\workspace\u4a-ws4-elec-upgrade\.docs\인수인계_지침서_원본이관.md` (506줄, 전문)

## A. 아직 안 된 것 — 1건

| 무엇 | 지금 | 있어야 할 값 | 근거 |
|---|---|---|---|
| `electron/main.js:209` dev deep link id | `u4a-ws-dev-elecup` | **`u4a-ws-dev`** | 지침서 1-3 「옮기지 말아야 할 줄」 |

사본에서 **기존 WS4.0 과 같이 띄우려고 붙인 임시 이름**이다. `main.js` 를 통째로 복사하면서 딸려 들어왔다.
`package.json` 의 `name`·`appId` 두 곳은 장군님 지시로 이미 되돌렸는데, **이 한 곳만 남았다.**

## B. 이미 들어와 있는 것 — 실측으로 확인

지침서 8장 「확인 방법」의 숫자를 `www` + `electron` 기준으로 재어 **사본과 전부 일치**함을 확인했다.

| 세는 것 | 우리 | 사본 | 지침서 기대 |
|---|---:|---:|---:|
| `u4aToAppUrl` | 110줄 / 81파일 | 110 / 81 | 110 / 81 |
| `u4aSetWindowCss` | 61줄 / 44파일 | 61 / 44 | 61 / 44 |
| `getGlobal("mainRequire")` | 16줄 / 14파일 | 16 / 14 | 15 / 13 (www 만 셌을 때) |
| 괄호가 두 번 오는 깨진 모양 | 0 | 0 | 0 |

- **파일별 건수를 사본과 하나하나 비교해 차이 0** 임을 확인했다(내가 손으로 옮긴 4개 포함).
- `main.js` 핵심 배선 전부 있음 — `global.mainRequire`(96) · `registerScheme()`(139) ·
  `install`(512) → `installRendererDirname`(515) → `installAll`(523) · `redefineGetWebPreferences`(362·635).
- 설치본: electron **45.0.0** · better-sqlite3 **13.0.3** · node-abi **4.40.0** · @electron/remote **2.1.3**.
- **줄끝 문제 없음** — 작업트리 CRLF, 저장소 LF, `core.autocrlf=true`, `.gitattributes` 있음.
  (지침서 1-1 이 걱정한 LF 유입은 안 일어났다. 사본도 지금은 CRLF 다.)

### 숫자가 어긋나 보였던 두 가지 — 둘 다 문제 아님

- `.loadFile(` 이 1건 나온다 → `www/help/_u4a_helpdoc/...` 로 **`_` 로 시작하는 폴더**(조사 제외 대상)이고 사본도 같다.
- `file:///` 이 20건 나온다 → 지침서의 「6건」은 **리소스 코드 자리만** 센 것. 남의 라이브러리·`_` 폴더·주석·설정 파일을 빼면 맞고, 사본과 건수가 같다.

## C. 우리 규칙 문서에 아직 없는 개발 표준 — 넣어야 다른 AI 가 지킨다

지침서 3·4장은 **앞으로 코드를 쓸 때의 표준**인데, 지금 `.claude/rules/code.md` · `.analy/16` 어디에도 없다.

1. **창을 띄울 때** — `loadFile()` 금지, `loadURL(REMOTE.getGlobal("u4aToAppUrl")(경로))`. 둘째 인자 `{query:{…}}` 를 빠뜨리면 값이 `undefined` 로 뜬다.
2. **새 창에 CSS 를 넣을 때** — `webContents.insertCSS` 직접 호출 금지, `REMOTE.getGlobal("u4aSetWindowCss")(창, css)`. (이미 떠 있는 자기 창은 그대로 둔다.)
3. **npm 모듈** — `REMOTE.require('<npm 모듈>')` 금지, `REMOTE.getGlobal("mainRequire")('<npm 모듈>')`. 내장 모듈은 그대로.
4. **서버 호출** — `xhr.withCredentials = true`. **Worker 안에는 안 따라가므로 워커마다 따로** 넣는다.
5. **`file://` 를 바꾸는 경계** — 페이지·iframe·동적 `import()` 주소만 바꾼다. 그림·소리·폰트 같은 리소스는 그대로 둔다.
6. **지우면 한꺼번에 깨지는 것 3가지** — `__dirname` 을 되돌려 주는 preload(화면 101자리) · `redefineGetWebPreferences`(30여 곳) · `alwaysOnTop` 을 메소드로 부르는 모양(30여 자리).
7. **조사 범위에서 빼는 것** — `www/floatingMenu/` **폴더 전체**(장군님 2026-10-27) · `_` 로 시작하는 폴더.

## D. 장군님이 하실 것 — TODO 로 옮길 후보

- **http 서버 로그인 테스트** — 쿠키를 앱이 직접 들고 다니는 코드는 넣었지만 **한 번도 안 돌려 봤다**(지침서 5장·7-1). https 는 WS20 까지 확인됨.
- **고객사에 Windows 7·8.1 PC 가 있는가** — 답에 따라 포장 방침이 갈린다. Electron 23 부터 Windows 10 이상만 된다(지침서 7-2).

## E. 남은 코드 일감 — 보고만 (지시 없이 손대지 않음)

| 무엇 | 지침서 |
|---|---|
| 안 고친 채 남은 같은 모양 3곳 + `design/` 의 `await import(OS 경로)` 자리들 | 7-4 |
| 이름이 거짓이 된 함수 5종(`_toFileUrl` 등 — 이제 `u4a-ws://` 를 돌려준다) | 7-5 |
| 포장(build) 점검 — `electron-updater`·`puppeteer-core` 호환, `extraResources` 가 없는 폴더를 가리킴 | 7-7 |
| `main.js` 의 Chromium 스위치 재검토(끄면 `file:///` 리소스 6자리가 먼저 깨진다) | 7-8 |
| 이슈 이력을 노션에 등록 | 7-9 |

## 또 밟을 함정

- **다른 폴더에서 소스를 받아올 때는 「옮기면 안 되는 줄」을 먼저 찾는다.** 이번에 앱 이름 2곳은
  장군님이 짚어 주셔서 되돌렸지만, **같은 성격의 임시 값이 `main.js` 에 하나 더 숨어 있었다.**
  → 받아온 쪽 문서에 「안 옮길 것」 목록이 있으면 **그 목록부터 전수로 대조**한다.
- **확인용 숫자는 범위를 같이 적어야 쓸모 있다.** 지침서의 110·61 은 `www`+`electron` 합산인데
  본문에는 「`www` 안에서만 센다」고 적혀 있어, 그대로 세면 모자란 것처럼 보인다.
