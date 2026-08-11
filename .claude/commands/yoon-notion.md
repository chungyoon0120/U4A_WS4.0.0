---
description: 지정한 노션 워크스페이스에 글을 기록하거나 새 페이지/DB 를 만든다 (notion-multi MCP 사용)
argument-hint: <워크스페이스명> <페이지명 또는 새 페이지 제목> <내용/동작>
allowed-tools: mcp__notion-multi__list_workspaces, mcp__notion-multi__search_pages, mcp__notion-multi__append_text, mcp__notion-multi__create_page, mcp__notion-multi__create_database
---

사용자 입력: `$ARGUMENTS`

위 입력에서 **① 워크스페이스명 ② 대상 페이지명(또는 새 페이지 제목) ③ 할 일(내용/동작)** 을 파악해,
`notion-multi` MCP 도구로 노션에 기록한다. 열쇠(토큰)·한글 처리·HTTP 통신은 모두 MCP 서버가 내부에서
처리하므로, **임시 파일을 만들거나 curl 을 직접 쓰지 않는다.**

## 도구
- `mcp__notion-multi__list_workspaces` — 등록된 워크스페이스 목록. 인자 없음.
- `mcp__notion-multi__search_pages` — `{workspace, query?}` → `id | 종류 | 제목` 목록.
- `mcp__notion-multi__append_text` — `{workspace, page_id, text}` → 페이지에 문단 추가.
- `mcp__notion-multi__create_page` — `{workspace, title, parent_page_id?, text?}` → 새 페이지.
- `mcp__notion-multi__create_database` — `{workspace, parent_page_id, title, properties?}` → 새 DB.

## 절차
1. **워크스페이스명 확인.** 입력에 없거나 애매하면 `list_workspaces` 로 목록을 보여주고 되묻는다.
2. **동작 판별.**
   - "~ 페이지 만들어/생성해" → `create_page`.
   - "~ DB/데이터베이스 만들어" → 먼저 부모 페이지를 `search_pages` 로 찾아 `create_database`.
   - 그 외 "~ 에 ~ 작성/기록/추가/업데이트" → `search_pages` 로 대상 page_id 를 찾아 `append_text`.
   - 애매하면 되묻는다.
3. **대상 찾기.** 기존 페이지/부모 페이지가 필요하면 `search_pages {workspace, query:"<제목>"}` 로 page_id 를
   확정한다. 제목이 여러 개면 목록을 보여주고 고르게 한다.
4. **실행.** 해당 도구를 호출한다. 도구 결과 텍스트에 `[HTTP 200] ... 성공` 이면 성공, `isError` 면 실패다.

## 확인 & 보고
- 추가/생성 뒤 필요하면 `search_pages` 로 다시 조회해 반영을 확인한다.
- **워크스페이스 · 대상 · 한 일 · 주소(url) · 성공/실패**만 간단히 보고한다. 토큰은 절대 노출 금지.

## 실패 대응
- 워크스페이스명 없음 → 도구가 등록된 이름 목록을 반환하므로 그대로 보여주고 되묻는다.
- 페이지 못 찾음 → `search_pages` 결과 목록 제시 또는 URL/ID 요청.
- HTTP 401/403/404 → 그 열쇠 연동에 대상이 **공유 안 됨**. 노션에서 대상 페이지 ⋯ → 연결 추가 필요(사용자 조작).

## 워크스페이스 추가 (사용자가 이름+토큰 줄 때)
MCP 도구에는 열쇠 등록 기능이 없다. 다음은 수작업으로 처리한다.
1. 토큰을 `~/.claude/secrets/<이름>.token` 에 저장.
2. `~/.claude/secrets/notion_workspaces.json` 에 `{"<이름>":{"token_file":"<이름>.token", ...}}` 항목 추가
   (python, Windows 경로, `ensure_ascii=False`).
3. 토큰 값은 채팅/커밋에 남기지 말고 유효성 결과만 보고. 등록 후 `list_workspaces` 로 확인.
