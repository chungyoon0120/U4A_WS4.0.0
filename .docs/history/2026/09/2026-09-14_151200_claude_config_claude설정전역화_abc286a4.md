# Claude 설정 전역화 — skills·MCP 실체를 yoon-agent-kit 한 벌로, 프로젝트엔 설정만

작업일: 2026-09-14 · 대화창: abc286a4

## 요청

장군님 지시: **"현재 프로젝트에 설정된 skills, mcp 관리를 `D:\workspace\infocg\groupware` 이것처럼
하려고 한다. 실제 리소스는 전역 폴더에 있고 나머지는 설정 파일만 해당 전역 경로 바라보게 하면 되잖아?
우선 작업부터 진행하지 말고 검토부터 해줘"**

이어서 결정 4건을 받고(아래 「결정된 것」), **"미커밋 10건 커밋하고 착수해"** 로 실행.

## groupware 가 쓰던 방식 (실측)

| 위치 | 내용 |
|---|---|
| `C:\Users\socce\AppData\Local\yoon-agent-kit\` | 실체 한 벌 — `skills\`(32) · `mcp\` · `hooks\claude\SessionStart` · `runtime\node22.22.0`·`python310` |
| `C:\Users\socce\.claude\skills\*` | 전부 **Junction** → kit |
| `C:\Users\socce\.claude\settings.json` | SessionStart hook 이 kit 의 `run.cmd` 호출 |
| 프로젝트 | `.mcp.json` 몇 줄 + `.claude\settings.json`(hook) + 프로젝트 전용 skill 만 |

핵심: **프로젝트 폴더에 junction 을 두는 게 아니라 `~/.claude/skills` 에만 걸어** 모든 프로젝트가
전역에서 발견하게 한다. 프로젝트엔 설정 파일만 남는다.

kit 에 `installer\configure.py` 가 있고 agent별 경로표·install·remove 를 다 갖고 있으나,
이번엔 **끊어진 junction 수습과 token 합치기**가 섞여 있어 손으로 했다.

## 착수 전 실측 (문제 규모)

`.claude` 486MB · git 추적 5,812파일 · `.git` 202MB

| 항목 | 용량 | 파일수 |
|---|---|---|
| `skills\download\` | 163.7MB | 6 |
| `skills\agy-agent\` | 81.9MB | 4 |
| `skills\codex-agent\` | 81.9MB | 3 |
| `skills\yoon-notion\` | 22MB | 44 |
| `mcp\sap_adt_mcp` | 47.3MB | 2,259 |
| `mcp\notion_multi` | 44.9MB | 1,995 |
| `mcp\u4a_ws4_mcp` | 44.4MB | 1,982 |

같은 `node.exe`(85,804,032byte, 해시 `bae898add4643fcf`)가 **4벌** = 343MB. kit `runtime` 것과도 동일.

### 착수 전에 이미 고장나 있던 것 5가지

1. `.mcp.json` 이 `{}` (9/9 21:42 수정) → 이 프로젝트에 등록된 MCP server **0개**
2. `settings.local.json` 의 `enabledMcpjsonServers` 2개가 없는 서버를 가리킴
3. `.claude\agents\code-reviewer.md` 가 `u4a-ws4-mcp` tool 3개를 쓰도록 적혀 있으나 서버가 없어 불가
4. `~\.claude\skills\yoon-notion` 이 **끊어진 junction** — 가리키던
   `AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\yoon-notion-skill\...` 가 없음
5. `.claude\commands\yoon-notion.md` 가 폐기된 `notion-multi` MCP tool 5개를 가리킴

## 결정된 것 (장군님)

| 항목 | 결정 |
|---|---|
| `sap-adt` MCP | 전역 kit 으로 |
| `notion_multi` MCP | 안 씀 — 삭제. `yoon-notion` skill 로 대체 |
| `u4a-ws4-mcp` MCP | 살림. **이 프로젝트 전용**으로만 등록 |
| `u4a_ws4_mcp` 실체 | **프로젝트 안 유지** |
| git 히스토리 202MB | **지금은 안 건드림** — `.gitignore`·`git rm --cached`·rewrite 전부 보류 |
| Q1 `ws4.0.env` | **프로젝트 것이 최신** → kit 에 덮어씀 |
| Q2 `sap-adt` `.env` | 「복사해라」 → 작업 중 **이미 전역에 같은 내용이 있음**을 확인, 복사 안 하고 그걸 가리킴 |
| Q3 `commands\yoon-notion.md` | 파일째 삭제 |

## 변경 내용

### 프로젝트 (`U4A_WS4.0.0`)

- 미커밋 10건 + 백업 8건 + 계획서 커밋 (`b769bc0c`) — 검은 화면·새 창 미표시 수정분
- `.claude\skills\download\` 삭제 (순수 중복 사본)
- `.claude\skills\agy-agent\`·`codex-agent\` → kit 으로 **이동**
- `.claude\skills\yoon-notion\` 삭제 (token 을 kit 으로 합친 뒤)
- `.claude\mcp\notion_multi\` 삭제
- `.claude\mcp\sap_adt_mcp\` → kit 으로 **복사 후 삭제** (`.venv` 는 안 옮기고 kit 에서 재생성)
- `.claude\mcp\u4a_ws4_mcp\` **유지** — `pyproject.toml` 만 `mcp<2` 로 박음
- `.claude\commands\yoon-notion.md` 삭제
- `.claude\commands\yoon-audit.md` — 실행 파일 경로 3줄을 전역으로
- `.mcp.json` 재작성 — `u4a-ws4-mcp` 1개
- `.claude\settings.local.json` — 죽은 실행 경로 2줄·없는 서버 참조 제거

### 전역

- `C:\Users\socce\.claude\skills\` — `agy-agent`·`codex-agent` junction 신규,
  `yoon-notion` junction 을 kit 으로 다시 걸음
- `C:\Users\socce\.claude.json` — user scope `mcpServers` 에 `sap-adt` 등록 (`claude mcp add --scope user`)
- kit `skills\yoon-notion\env\` — `me.env`·`u4a.env`·`.default` 가져옴, `ws4.0.env` 프로젝트 것으로 덮어씀
- kit `skills\yoon-notion\SKILL.md` — 전역 경로를 첫 번째 후보로 추가
- kit `mcp\sap_adt_mcp\` 신규 — `pyproject.toml` 에 `mcp<2`, `uv sync`

## 변경 파일

- 추가:
  - `.works/claude설정전역화/00_현황판.md` (계획서 → 현황판)
  - `C:\Users\socce\AppData\Local\yoon-agent-kit\mcp\sap_adt_mcp\` (신규, `.venv` 는 `uv sync` 로 생성)
  - `C:\Users\socce\AppData\Local\yoon-agent-kit\skills\agy-agent\`·`codex-agent\` (이동해 옴)
  - kit `skills\yoon-notion\env\{me.env, u4a.env, .default}`
  - 백업: kit `skills\yoon-notion\env\_ws4.0.env.20260914.bak` · `_SKILL.md.20260914.bak` ·
    kit `mcp\sap_adt_mcp\_pyproject.toml.20260914.bak` ·
    `.claude\mcp\u4a_ws4_mcp\_pyproject.toml.20260914.bak`
  - `C:\Users\socce\Documents\_backup\U4A_claude_20260914\` (486.1MB / 6,322파일 + 설정 4개)
- 변경:
  - `.mcp.json` · `.claude\settings.local.json` · `.claude\commands\yoon-audit.md`
  - `.claude\mcp\u4a_ws4_mcp\pyproject.toml`
  - `C:\Users\socce\.claude.json` (user scope mcpServers)
  - kit `skills\yoon-notion\SKILL.md` · `env\ws4.0.env`
  - kit `mcp\sap_adt_mcp\pyproject.toml` · `uv.lock`
- 삭제:
  - `.claude\skills\download\` · `agy-agent\` · `codex-agent\` · `yoon-notion\`
  - `.claude\mcp\notion_multi\` · `sap_adt_mcp\`
  - `.claude\commands\yoon-notion.md`

## 변경 이유

같은 실체가 프로젝트마다 사본으로 복제돼 있었다. `node.exe` 4벌·`.venv` 3벌이 전부 git 에
커밋돼 `.git` 이 202MB 가 됐다. 실체를 kit 한 벌로 모으고 프로젝트엔 설정만 남기면,
새 프로젝트에서도 같은 skill·MCP 가 그대로 잡히고 저장소가 가벼워진다.

## 영향 범위

- **`.claude` 486MB → 44.5MB.** 남은 44.4MB 는 `u4a_ws4_mcp` (프로젝트 유지 결정). 그걸 빼면 0.1MB
- MCP server: 0개 → **2개** (`sap-adt` 전역 · `u4a-ws4-mcp` 이 프로젝트)
- skill: 전역 `agy-agent`·`codex-agent`·`yoon-notion` + 프로젝트 `common-ux`·`notion-log`
- **git 에 삭제 3,810건이 잡혀 있다.** 커밋은 지시 대기 (「git 안 건드림」 결정)
- kit 은 494.2MB 가 됐다 (다른 프로젝트도 이걸 공유)

## 검증

| 무엇 | 방법 | 결과 |
|---|---|---|
| `yoon-notion` | kit 경로에서 `connect list` + `check --as u4a` | 연결 3개 다 나옴, **실제 노션 접속 OK** |
| `agy-agent`·`codex-agent` | 전역 junction 경로로 `node.exe --version` + `--check` + 실제 `--prompt` 호출 | v22.22.0, 구문 OK, **codex 가 "OK" 응답** |
| 검수 명령 경로 | 고친 전역 경로로 이슈 리포트 DB schema 조회 | 스키마 나옴 |
| `sap-adt` | `claude mcp list` | 1차 ✘ → 원인 수정 후 **✔ Connected** |
| `u4a-ws4-mcp` | `claude mcp list` + `_analy_dir()` 호출 | **✔ Connected**, `.analy` 22건 |
| tool 이름 대조 | `code-reviewer.md` 3개 vs 서버 `@mcp.tool(name=...)` | 3개 다 일치 |
| 용량 | 실측 | 486MB → 44.5MB |

**아직 안 한 검증:** Claude Code 를 껐다 켠 뒤 skill 목록·MCP 가 실제 세션에서 잡히는지는
**미확인**. 장군님 테스트 항목 GL1~GL9 로 현황판에 올려 뒀다.

## 참고 사항 — 다음 agent 가 알아야 할 것

### 1. `sap-adt` 는 원래부터 깨져 있었다 (내가 깬 게 아님)

코드는 `mcp` 1.x 용(`from mcp.server.fastmcp import FastMCP`)인데 사본 `.venv` 에 **2.1.1** 이 깔려
있었다. 백업본에도 2.1.1 이었다. `pyproject.toml` 이 `mcp>=1.2.0` 로만 적혀 2.x 를 끌어온 것.

| 위치 | mcp | 상태 |
|---|---|---|
| `D:\workspace\sap_adt_mcp_server_py` | 1.27.2 | 정상 (9/10 에 실제로 돌던 것) |
| `.claude\mcp\u4a_ws4_mcp` | 1.28.0 | 정상 |
| `.claude\mcp\sap_adt_mcp` (사본) | **2.1.1** | 깨짐 |

**라이브러리는 한 글자도 안 고치고** `mcp>=1.2.0,<2` 로 버전을 맞춰 해결(1.30.0 설치).
`u4a_ws4_mcp` 에도 같은 지뢰가 있어 `pyproject.toml` 만 `<2` 로 박았다.
**`.venv`·`uv.lock` 은 안 건드렸다** — 지금 도는 1.28.0 을 깨뜨리지 않기 위해서다.
나중에 누가 `uv sync` 하면 그때 1.x 안에서 다시 잡힌다.

### 2. 접속 정보는 복사하지 않았다 (지시와 다름 — 보고함)

Q2 답은 「복사해라」였으나, 작업 중 `C:\Users\socce\.claude\secrets\sap_adt.env` 가
**D: 원본 `.env` 와 해시가 같고**(`EF013DFFBE8C`) 다른 프로젝트 2곳이 이미 그걸 쓰는 것을 확인했다.
복사하면 접속 정보 사본만 하나 더 늘어서, **있는 것을 가리키게** 했다. 장군님께 보고 완료.
참고: `sap_adt_U4A.env` 만 내용이 다르다(`B7F87B9C25EA`). 지금 등록은 기본 `sap_adt.env` 를 쓴다.

### 3. 떠돌이 프로세스가 파일을 잡고 있었다

9/9 세션이 남긴 MCP server 프로세스가 **5일째 살아 있어** 삭제가 막혔다.
이 프로젝트 것 **139개**(notion-multi 68 + u4a/sap 71) 정리했다.
**다른 프로젝트 것 16개는 안 건드렸다** — `D:\workspace\u4a_ws4_mcp` ·
`D:\workspace\sap_adt_mcp_server_py` · `infocg\timeoff` · `infocg_customers`.
→ 앞으로 `.claude\mcp` 를 지우다 막히면 **먼저 프로세스를 보라.**

### 4. `yoon-notion` 은 사본이 3곳이었고 합치는 방향이 갈렸다

**코드는 kit 이 최신, token 은 프로젝트가 최신**이었다.

| 파일 | kit | 프로젝트 | 쓴 것 |
|---|---|---|---|
| `SKILL.md` | 9/7 14,289 | 9/2 13,098 | kit |
| `notion_cli.py` | 9/7 54,278 | 9/2 49,745 | kit |
| `env\ws4.0.env` | 9/7 238 | **9/2 244** | 프로젝트 |
| `env\me.env`·`u4a.env`·`.default` | 없음 | 있음 | 프로젝트 |

세 번째 사본(앱 캐시 폴더)은 **폴더 자체가 없었고**, `~\.claude\skills` junction 이 거기를 가리키고
있었다. kit 으로 다시 걸었다.

### 5. kit SKILL.md 를 한 줄 고쳤다 (프로젝트 사본을 지워서 생긴 구멍)

kit `skills\yoon-notion\SKILL.md` 가 실행 파일을 "프로젝트 루트 기준 상대경로"로만 안내했다.
프로젝트 사본을 지운 뒤엔 그 안내로는 못 찾는다. **전역 경로를 첫 번째 후보로** 넣었다
(`_SKILL.md.20260914.bak` 백업 있음). `allowed-tools` 에도 전역 경로를 추가했다.

### 6. 아직 안 한 것 / 남은 것

| # | 남은 것 | 왜 |
|---|---|---|
| 1 | git 삭제 3,810건 미커밋 | 「git 안 건드림」 결정. 지시 대기 |
| 2 | `.git` 202MB 그대로 | rewrite 보류 |
| 3 | `u4a_ws4_mcp\.venv` 1,982파일이 계속 git 추적 | 같은 결정 |
| 4 | kit 안에 `node.exe` 3벌(257MB) | SKILL.md 가 **자기 폴더 것**을 쓰라고 명시 — 남의 도구라 안 고침 |
| 5 | `D:\workspace\sap_adt_mcp_server_py`(6/8 구버전) 그대로 | 지우라는 지시 없음 |
| 6 | 다른 프로젝트 2곳의 `sap_adt_mcp` 사본 | 현황판 D2 로 장군님 결정 대기 |
| 7 | `.claude\_skills_backup\`(4파일, 0MB) | 현황판 D4 로 결정 대기 |

### 7. 되돌리는 법

`C:\Users\socce\Documents\_backup\U4A_claude_20260914\` 에 `.claude` 통째(486.1MB/6,322파일)와
설정 4개(`_.claude.json` · `_global_settings.json` · `_.mcp.json` · `_settings.local.json`)가 있다.
프로젝트 안 삭제분은 커밋 `b769bc0c` 시점의 git 으로도 복구된다(아직 커밋 안 했으므로
`git checkout -- .claude` 로 되돌아온다).

## 관련 문서

- 현황판·테스트 항목(GL1~GL9)·결정 대기(D1~D4): `.works/claude설정전역화/00_현황판.md`

---

## 이어서 — `sap-adt` 등록이 지워져 다시 등록 (2026-09-14, 같은 대화)

장군님 신고: **"sap-adt 가 제거됐다고 안 되던데?"**

### 조사

| 확인한 것 | 상태 |
|---|---|
| kit `yoon-agent-kit\mcp\sap_adt_mcp` 실체 | **멀쩡** — `.venv` 있음, `pyproject.toml` 의 `mcp>=1.2.0,<2` 핀 유지, 설치된 `mcp` 1.30.0, 기동 시험 traceback 없음 |
| `C:\Users\socce\.claude.json` user scope `mcpServers` | **`sap-adt` 없음.** `ui5-mcp-server` 하나만 들어 있었다 |

**즉, 실체가 아니라 등록이 날아간 것이다.**

원인 추정: 이 작업 뒤에 돈 다른 세션이 같은 파일의 `mcpServers` 를 다시 쓰면서 덮어썼다.
그 세션 커밋 2건(`9d4063f1` "remove notion_multi/sap_adt_mcp MCP venvs" ·
`7e044f71` "add claude/codex skills, update settings/hooks")이 그 사이에 들어와 있고,
지금 그 자리에 `ui5-mcp-server` 가 등록돼 있다. **덮어쓴 주체를 직접 확인하지는 못했다 — 미확인.**

### 처리

`claude mcp add sap-adt --scope user -e SAP_ADT_ENV_FILE=... -- uv run --project <kit 경로> sap-adt-mcp`
로 재등록. 서버 실체·핀·`.venv` 는 그대로 두고 등록만 되살렸다.

### 검증

`claude mcp list` → **3개 다 ✔ Connected**
- `sap-adt` (전역)
- `u4a-ws4-mcp` (이 프로젝트)
- `ui5-mcp-server` (전역, 다른 세션이 넣은 것)

**미검증:** 이 세션에는 `sap-adt` tool 이 아직 안 올라와 있다(MCP 는 세션 시작 때만 붙는다).
실제 tool 호출 확인은 **Claude Code 재시작 후** 해야 한다.

### 다음 agent 가 알아야 할 것

1. **`~\.claude.json` 을 손으로 고치지 마라.** Claude Code 가 계속 쓰는 파일이라 덮어쓰인다.
   `claude mcp add --scope user` 를 써라 — 그쪽은 기존 항목에 합치고 통째로 갈아끼우지 않는다.
   (그런데 이번에 그 방식으로 넣은 것도 날아갔다 → 다른 세션이 파일을 통째로 다시 썼을 가능성.
   **여러 세션을 동시에 돌리면 이 파일이 서로 덮어쓴다는 것을 전제로 움직여라.**)
2. **MCP 가 "없다"고 나오면 실체보다 등록부터 봐라.** 이번엔 실체는 멀쩡했다.
3. `ui5-mcp-server` 가 **전역과 프로젝트 `.mcp.json` 두 곳에 중복 등록**돼 있다.
   프로젝트 쪽은 `settings.local.json` 의 `enabledMcpjsonServers` 에 없어서 놀고 있다.
   다른 세션이 넣은 것이라 **안 건드렸다.** 현황판에 결정 대기로 올렸다.

---

## 마감 — 장군님 테스트 전 항목 통과 (2026-09-14, 같은 대화)

장군님 확인: **"다 잘된다"**

Claude Code 를 껐다 켠 뒤 확인한 결과, 현황판 테스트 9건(GL1~GL9) **전부 ✅ O**.
위 「검증」 절에 **미확인**으로 남겨 뒀던 「재시작 뒤 실제 세션에서 잡히는지」가 이것으로 해소됐다.

통과 항목 중 이 작업의 목적을 직접 증명하는 것:

| 항목 | 무엇을 증명했나 |
|---|---|
| GL1 · GL9 | 전역 junction 으로 옮긴 skill 이 **이 프로젝트에서도, 다른 프로젝트(`groupware`)에서도** 잡힌다 |
| GL2 | 프로젝트 전속 skill 2개는 그대로 남아 있다 |
| GL3 · GL4 | 옮긴 외부 CLI 호출이 전역 경로로 실제 동작한다 |
| GL5 · GL6 | token 합치기와 검수 명령 경로 수정이 맞았다 |
| GL7 · GL8 | MCP 2개가 실제 세션에서 붙어 도구가 돈다 |

### 문서 정리

- 통과한 그룹을 `.works/claude설정전역화/00_히스토리.md` 로 **그룹째** 옮겼다
  (개별 통과마다 옮기지 않는다 — 문서 규칙).
- 해결된 `sap-adt` 재등록 건도 같이 히스토리로 옮겼다.
- 현황판에는 **「정해 주실 것」만** 남겼다.
- `.docs/CURRENT.md` 는 건드리지 않았다 — 다른 세션이 그 사이 규칙을
  「프로그램(화면) 작업만 적는다, 도구 일은 적지 않는다」로 바꿨고, 도구 쪽은 이미 링크 한 줄로
  걸려 있다.

### 아직 안 한 것

`.works/claude설정전역화/00_현황판.md` 의 「정해 주실 것」 5건. 그중 **git 커밋**이 제일 급하다 —
이 작업으로 지운 사본들이 삭제로 잡힌 채 남아 있다. 커밋은 **지시가 있을 때만** 한다.
