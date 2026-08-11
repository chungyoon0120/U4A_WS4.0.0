# u4a-ws4-mcp

U4A WS4.0 의 UX·화면·UI5→HTML5 **컨버전/UX 표준 문서(`.analy/` 세트)** 를
AI에게 **온디맨드로** 제공하는 MCP 서버.

문서 내용을 도구 호출 시점에 디스크에서 직접 읽으므로, `.analy` 문서를 수정해도
**세션 재시작(`/clear`·새 대화) 없이** 항상 최신이 반영된다. (CLAUDE.md 에 표준을
박아두면 고칠 때마다 리로드가 필요한 문제를 없앤다.)

## 제공 도구

| 도구 | 용도 |
|---|---|
| `analy_index` | 표준 문서 카탈로그(번호·제목·파일·라우팅 키워드) + 필수 우선 읽기(00/13/16) 안내. **작업 시작 시 가장 먼저 호출.** |
| `analy_get_doc` | 문서 한 건(또는 특정 절)을 조회. `ref`(번호/파일명/부분문자열), `section`, `max_chars`. |
| `analy_search` | 전체 문서 키워드 검색 → 매치 위치(문서·절·라인)와 스니펫. 토큰 절약. |

모두 읽기 전용(read-only). 이름이 `_` 로 시작하는 문서는 목록에서 제외한다
(CLAUDE.md 소스 탐색 규칙과 동일 — 백업/구버전/실험 파일 제외).

## 문서 위치 설정

- 기본값: `C:\Users\socce\Documents\Github\CHUNGYOON0120\U4A_WS4.0.0\.analy`
- 환경변수 `U4A_WS4_ANALY_DIR` 로 덮어쓸 수 있다.

## 실행

```bash
uv run u4a-ws4-mcp          # stdio MCP 서버 실행
```

## Claude Code 연결 (.mcp.json)

대상 프로젝트 루트의 `.mcp.json` 의 `mcpServers` 안에 [`mcp.config.json`](mcp.config.json)
의 `u4a-ws4-mcp` 블록을 복사해 넣는다(그 파일의 `_comment` 키는 빼도 됨).

```json
{
  "mcpServers": {
    "u4a-ws4-mcp": {
      "command": "uv",
      "args": ["run", "--project", "D:/workspace/u4a_ws4_mcp", "u4a-ws4-mcp"],
      "env": {
        "U4A_WS4_ANALY_DIR": "C:/Users/socce/Documents/Github/CHUNGYOON0120/U4A_WS4.0.0/.analy"
      }
    }
  }
}
```

연결(+ Claude Code 재시작) 후 새 세션에서 도구가 인식된다. 이후 `.analy` 문서는
자유롭게 수정해도 재연결/재시작 없이 항상 최신 내용이 서빙된다.

## 다른 PC에서 사용

이식 시 신경 쓸 경로는 둘뿐이다.

1. **이 MCP 서버 위치** — `args` 의 `--project` 경로. 다른 PC 에서도 동일하게
   `D:/workspace/u4a_ws4_mcp` 로 클론하면 그대로 쓸 수 있다(경로가 다르면 그 한 줄만 수정).
   클론 후 한 번 `uv sync` 로 의존성을 설치한다.
2. **`.analy` 문서 위치** — `env.U4A_WS4_ANALY_DIR`. 서버는 다음 순서로 자동 해석한다:
   1) `U4A_WS4_ANALY_DIR`(존재할 때) → 2) 현재 작업 디렉터리의 `./.analy`
   (Claude Code 가 프로젝트 루트에서 서버를 띄우면 `env` 없이도 자동 인식) → 3) 내장 기본값.
   - **가장 이식성 높은 방법**: `.mcp.json` 을 `.analy` 가 있는 프로젝트 루트에 두고
     `env` 줄을 **아예 빼면**, 위 2) 규칙으로 그 프로젝트의 `./.analy` 를 자동으로 잡는다
     (PC 마다 경로 수정 불필요).
   - 자동 인식이 안 되는 환경이면 `env.U4A_WS4_ANALY_DIR` 에 그 PC 의 `.analy` 절대경로만
     한 줄 지정하면 된다. (env 가 그 PC 에 없으면 자동으로 2)/3) 으로 폴백한다.

요약: **MCP 서버를 `D:/workspace/u4a_ws4_mcp` 로 클론 → `uv sync` → 프로젝트 `.mcp.json`
에 블록 붙여넣기(가능하면 `env` 생략)** 하면 바로 동작한다.

## 개발

```bash
uv sync                                    # 의존성 설치(.venv 생성)
uv run python -m py_compile src/u4a_ws4_mcp/server.py   # 구문 검사
```
