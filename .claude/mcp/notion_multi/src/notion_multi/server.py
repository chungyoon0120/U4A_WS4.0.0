# -*- coding: utf-8 -*-
"""
notion-multi MCP 서버 (공식 MCP SDK / FastMCP, uv 가상환경 실행)

여러 노션 워크스페이스를 이름으로 골라, 그 워크스페이스의 열쇠(토큰)로
페이지 검색 / 내용 추가 / 페이지 생성 / DB 생성을 수행한다.

- 열쇠 저장소(git 밖): ~/.claude/secrets/notion_workspaces.json  +  *.token
  각 항목: { "<워크스페이스명>": { "token_file": "xxx.token", ... } }
  환경변수 NOTION_SECRETS_DIR 로 위치 변경 가능.
- 토큰 값은 로그·응답에 절대 노출하지 않는다.
- HTTP 는 표준 라이브러리(urllib)로 처리(추가 의존성 없음).
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional

from mcp.server.fastmcp import FastMCP

SECRETS_DIR = os.environ.get(
    "NOTION_SECRETS_DIR",
    os.path.join(os.path.expanduser("~"), ".claude", "secrets"),
)
REGISTRY_PATH = os.path.join(SECRETS_DIR, "notion_workspaces.json")
NOTION_VERSION = "2022-06-28"
NOTION_BASE = "https://api.notion.com/v1"

mcp = FastMCP("notion-multi")


# =====================================================================
# 열쇠(토큰) 로딩
# =====================================================================
def load_registry() -> dict:
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def get_token(workspace: str) -> str:
    """워크스페이스명 -> 토큰 문자열. 없으면 예외."""
    reg = load_registry()
    if workspace not in reg:
        names = ", ".join(reg.keys())
        raise ValueError(f"워크스페이스 '{workspace}' 없음. 등록된 것: {names}")
    tf = reg[workspace]["token_file"]
    with open(os.path.join(SECRETS_DIR, tf), "r", encoding="utf-8") as f:
        return f.read().strip()


# =====================================================================
# 노션 API 호출 (urllib, 표준 라이브러리)
# =====================================================================
def notion_request(method: str, path: str, token: str, body: Optional[dict] = None):
    url = NOTION_BASE + path
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw}
        return e.code, parsed


def title_of(obj: dict) -> str:
    """검색 결과 객체에서 제목 텍스트 뽑기."""
    props = obj.get("properties", {}) or {}
    for _, v in props.items():
        if isinstance(v, dict) and v.get("type") == "title":
            return "".join(t.get("plain_text", "") for t in v.get("title", []))
    if obj.get("object") == "database":
        return "".join(t.get("plain_text", "") for t in obj.get("title", []))
    return ""


def paragraph_block(text: str) -> dict:
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]},
    }


# =====================================================================
# 도구 (FastMCP)
# =====================================================================
@mcp.tool()
def list_workspaces() -> str:
    """등록된 노션 워크스페이스 목록을 반환한다. 인자 없음."""
    reg = load_registry()
    lines = []
    for name, meta in reg.items():
        dp = meta.get("default_page_title", "")
        lines.append(f"- {name}" + (f"  (기본 페이지: {dp})" if dp else ""))
    return "등록된 워크스페이스:\n" + "\n".join(lines)


@mcp.tool()
def search_pages(workspace: str, query: Optional[str] = None) -> str:
    """해당 워크스페이스에서 접근 가능한 페이지/DB 를 검색해 'id | 종류 | 제목' 목록으로 반환한다.

    workspace: 워크스페이스명
    query: 제목 검색어(선택). 없으면 전체.
    """
    token = get_token(workspace)
    body: dict = {"page_size": 100}
    if query:
        body["query"] = query
    status, data = notion_request("POST", "/search", token, body)
    if status != 200:
        return f"[HTTP {status}] 검색 실패: {json.dumps(data, ensure_ascii=False)}"
    rows = [f"{o.get('id')} | {o.get('object')} | {title_of(o)}" for o in data.get("results", [])]
    return "\n".join(rows) if rows else "결과 없음"


@mcp.tool()
def append_text(workspace: str, page_id: str, text: str) -> str:
    """지정한 페이지(page_id) 안에 한 문단(text)을 추가한다.

    workspace: 워크스페이스명
    page_id: 대상 페이지 id
    text: 추가할 내용
    """
    token = get_token(workspace)
    body = {"children": [paragraph_block(text)]}
    status, data = notion_request("PATCH", f"/blocks/{page_id}/children", token, body)
    if status != 200:
        return f"[HTTP {status}] 추가 실패: {json.dumps(data, ensure_ascii=False)}"
    return f"[HTTP 200] 내용 추가 성공 (page_id={page_id})"


@mcp.tool()
def create_page(
    workspace: str,
    title: str,
    parent_page_id: Optional[str] = None,
    text: Optional[str] = None,
) -> str:
    """새 페이지를 만든다. parent_page_id 를 주면 그 페이지 하위에, 없으면 워크스페이스 최상위에 만든다.

    workspace: 워크스페이스명
    title: 새 페이지 제목
    parent_page_id: 부모 페이지 id(선택)
    text: 본문 한 문단(선택)
    """
    token = get_token(workspace)
    if parent_page_id:
        parent = {"type": "page_id", "page_id": parent_page_id}
    else:
        parent = {"type": "workspace", "workspace": True}

    body: dict = {
        "parent": parent,
        "properties": {"title": {"title": [{"type": "text", "text": {"content": title}}]}},
    }
    if text:
        body["children"] = [paragraph_block(text)]

    status, data = notion_request("POST", "/pages", token, body)
    if status != 200:
        return f"[HTTP {status}] 페이지 생성 실패: {json.dumps(data, ensure_ascii=False)}"
    return f"[HTTP 200] 페이지 생성 성공\nid={data.get('id')}\nurl={data.get('url')}"


@mcp.tool()
def create_database(
    workspace: str,
    parent_page_id: str,
    title: str,
    properties: Optional[dict] = None,
) -> str:
    """지정한 부모 페이지(parent_page_id) 하위에 데이터베이스를 만든다.
    properties 를 주지 않으면 이름/상태/날짜 기본 골격으로 만든다.

    workspace: 워크스페이스명
    parent_page_id: 부모 페이지 id
    title: DB 제목
    properties: 노션 DB 속성 정의(선택)
    """
    token = get_token(workspace)
    if not properties:
        properties = {
            "이름": {"title": {}},
            "상태": {
                "select": {
                    "options": [
                        {"name": "할일", "color": "red"},
                        {"name": "진행중", "color": "yellow"},
                        {"name": "완료", "color": "green"},
                    ]
                }
            },
            "날짜": {"date": {}},
        }

    body = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": title}}],
        "properties": properties,
    }
    status, data = notion_request("POST", "/databases", token, body)
    if status != 200:
        return f"[HTTP {status}] DB 생성 실패: {json.dumps(data, ensure_ascii=False)}"
    return f"[HTTP 200] DB 생성 성공\nid={data.get('id')}\nurl={data.get('url')}"


def main():
    mcp.run()


if __name__ == "__main__":
    main()
