---
description: 지정한 노션 워크스페이스에 글을 기록하거나 새 페이지/DB 를 만든다 (notion-multi MCP 사용)
argument-hint: <워크스페이스명> <페이지명 또는 새 페이지 제목> <내용/동작>
allowed-tools: mcp__notion-multi__list_workspaces, mcp__notion-multi__search_pages, mcp__notion-multi__append_text, mcp__notion-multi__create_page, mcp__notion-multi__create_database
---

사용자 입력: `$ARGUMENTS`

위 입력에서 **① 워크스페이스명 ② 대상 페이지명(또는 새 페이지 제목) ③ 할 일(내용/동작)** 을 파악해,
`notion-multi` MCP 도구로 노션에 기록한다. 열쇠(토큰)·한글 처리·HTTP 통신은 모두 MCP 서버가 내부에서
처리하므로, **임시 파일을 만들거나 curl 을 직접 쓰지 않는다.**

## 도구 (전부 `mcp__notion-multi__` 접두)
읽기·검색·생성·수정을 한 서버가 다 한다. **DB(표) 작업은 아래 전용 도구를 쓰고, search_pages 로 헤매지 말 것.**
- `list_workspaces` — 워크스페이스 목록 + 기본 페이지/이슈 DB 의 **page_id·database_id** 반환. (여기 나온 id 를 바로 쓰고 다시 검색하지 말 것)
- `search_pages` — `{workspace, query?}` → `id | 종류 | 제목`. (제목으로 페이지 찾기용)
- `query_database` — `{workspace, database_id, match_text?}` → DB 행들 `page_id | 속성=값 ...`. 특정 행(예: BR20)은 `match_text` 로 추림.
- `get_page` — `{workspace, page_id}` → 그 페이지/행의 **속성 + 본문(각 줄 앞 block_id)**. 읽기·수정 전 필수.
- `append_text` — `{workspace, page_id, text}` → 페이지에 문단 추가.
- `update_page_properties` — `{workspace, page_id, properties}` → 행/페이지의 속성 값 수정(상태·제목 등).
- `update_block_text` — `{workspace, block_id, text}` → 본문 한 줄(문단·제목 등) 통째 교체.
- `create_page` — `{workspace, title, parent_page_id?, text?}` → 새 페이지.
- `create_database` — `{workspace, parent_page_id, title, properties?}` → 새 DB.

## 절차
1. **워크스페이스 확인 + id 확보.** 먼저 `list_workspaces` 를 부른다. "이슈 리포트 DB" 같은 등록된 대상은 여기서
   나온 `database_id`·`page_id` 를 **그대로 쓴다**(다시 검색 금지).
2. **동작 판별.**
   - **DB 행 읽기/수정** ("~DB의 BR20 읽고 수정" 등): `query_database {database_id, match_text:"BR20"}` 로 그 행의
     `page_id` 를 잡고 → `get_page {page_id}` 로 속성·본문(block_id)을 읽는다 → 무엇을 어떻게 바꿀지 **사용자에게 확인** 후
     속성은 `update_page_properties`, 본문 줄은 `update_block_text` 로 고친다.
   - **페이지에 글 추가**: `search_pages` 로 page_id 찾고 → `append_text`.
   - **새 페이지/DB**: `create_page` / `create_database`(부모는 list_workspaces 나 search_pages 로).
   - 애매하면 되묻는다.
3. **쓰기 전 확인.** 되돌리기 어려운 바깥 작업이므로, **무엇을 바꾸는지 한 줄로 알리고 사용자 확인 후** 실행한다.
4. **판정.** 도구 결과에 `[HTTP 200] ... 성공` 이면 성공, `isError`/`[HTTP 4xx]` 면 실패(사유 표시).

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
