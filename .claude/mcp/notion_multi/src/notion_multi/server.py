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
    if obj.get("object") == "database":
        return "".join(t.get("plain_text", "") for t in obj.get("title", []))
    props = obj.get("properties", {}) or {}
    for _, v in props.items():
        if isinstance(v, dict) and v.get("type") == "title":
            return "".join(t.get("plain_text", "") for t in v.get("title", []))
    return ""


def paragraph_block(text: str) -> dict:
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]},
    }


def render_rich_text(rt) -> str:
    return "".join(t.get("plain_text", "") for t in (rt or []))


def render_property(v: dict) -> str:
    """노션 속성 하나를 사람이 읽을 문자열로."""
    t = v.get("type")
    if t == "title":
        return render_rich_text(v.get("title"))
    if t == "rich_text":
        return render_rich_text(v.get("rich_text"))
    if t == "select":
        s = v.get("select")
        return s.get("name", "") if s else ""
    if t == "status":
        s = v.get("status")
        return s.get("name", "") if s else ""
    if t == "multi_select":
        return ", ".join(o.get("name", "") for o in v.get("multi_select", []))
    if t == "number":
        n = v.get("number")
        return "" if n is None else str(n)
    if t == "checkbox":
        return "예" if v.get("checkbox") else "아니오"
    if t == "date":
        d = v.get("date")
        if not d:
            return ""
        return d.get("start", "") + (("~" + d["end"]) if d.get("end") else "")
    if t == "url":
        return v.get("url") or ""
    if t == "email":
        return v.get("email") or ""
    if t == "phone_number":
        return v.get("phone_number") or ""
    if t == "people":
        return ", ".join(p.get("name", "") for p in v.get("people", []))
    if t == "formula":
        f = v.get("formula", {}) or {}
        return str(f.get(f.get("type"), ""))
    if t == "rollup":
        r = v.get("rollup", {}) or {}
        return str(r.get(r.get("type"), ""))
    return f"({t})"


def render_block(b: dict) -> str:
    """블록 하나를 'block_id | (종류) 텍스트' 로. 편집 대상 지정에 block_id 사용."""
    bid = b.get("id", "")
    bt = b.get("type", "")
    payload = b.get(bt, {}) if isinstance(b.get(bt), dict) else {}
    txt = render_rich_text(payload.get("rich_text")) if isinstance(payload, dict) else ""
    return f"{bid} | ({bt}) {txt}"


# =====================================================================
# 도구 (FastMCP)
# =====================================================================
@mcp.tool()
def list_workspaces() -> str:
    """등록된 노션 워크스페이스 목록과, 미리 등록된 기본 페이지/이슈 DB 의 id 를 반환한다. 인자 없음.

    여기서 나온 database_id 는 query_database 에 바로 쓸 수 있다(다시 검색하지 말 것).
    """
    reg = load_registry()
    lines = []
    for name, meta in reg.items():
        lines.append(f"- {name}")
        if meta.get("default_page_id") or meta.get("default_page_title"):
            lines.append(
                f"    기본 페이지: {meta.get('default_page_title','')} "
                f"(page_id={meta.get('default_page_id','')})"
            )
        if meta.get("issue_db_id") or meta.get("issue_db_title"):
            lines.append(
                f"    이슈 DB: {meta.get('issue_db_title','')} "
                f"(database_id={meta.get('issue_db_id','')})"
            )
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


@mcp.tool()
def query_database(
    workspace: str,
    database_id: str,
    match_text: Optional[str] = None,
    page_size: int = 100,
) -> str:
    """DB(표) 안의 행 목록을 반환한다. 각 행은 'page_id | 속성=값 · 속성=값 ...' 형태.

    특정 행(예: 'BR20')을 찾을 때 match_text 에 그 값을 주면, 값이 포함된 행만 추린다.
    반환된 page_id 를 get_page 로 읽거나 update_page_properties 로 고칠 수 있다.

    workspace: 워크스페이스명
    database_id: 대상 DB id (list_workspaces 의 database_id 사용)
    match_text: 이 문자열이 든 행만 추림(선택)
    page_size: 한 번에 가져올 행 수(기본 100, 최대 100)
    """
    token = get_token(workspace)
    rows = []
    cursor = None
    while True:
        body: dict = {"page_size": min(max(page_size, 1), 100)}
        if cursor:
            body["start_cursor"] = cursor
        status, data = notion_request(
            "POST", f"/databases/{database_id}/query", token, body
        )
        if status != 200:
            return f"[HTTP {status}] DB 조회 실패: {json.dumps(data, ensure_ascii=False)}"
        for pg in data.get("results", []):
            pid = pg.get("id")
            props = pg.get("properties", {}) or {}
            parts = []
            for name, v in props.items():
                txt = render_property(v)
                if txt:
                    parts.append(f"{name}={txt}")
            line = f"{pid} | " + " · ".join(parts)
            if match_text is None or match_text.lower() in line.lower():
                rows.append(line)
        if data.get("has_more") and match_text is not None:
            cursor = data.get("next_cursor")
        else:
            break
    return "\n".join(rows) if rows else "행 없음"


@mcp.tool()
def get_page(workspace: str, page_id: str) -> str:
    """페이지(또는 DB 행)의 속성과 본문(블록)을 읽어 반환한다.
    본문 각 줄 앞의 block_id 는 update_block_text 로 그 줄을 고칠 때 쓴다.

    workspace: 워크스페이스명
    page_id: 대상 페이지/행 id
    """
    token = get_token(workspace)
    out = []

    status, page = notion_request("GET", f"/pages/{page_id}", token)
    if status == 200:
        props = page.get("properties", {}) or {}
        if props:
            out.append("[속성]")
            for name, v in props.items():
                out.append(f"- {name}: {render_property(v)}")
    else:
        out.append(f"[HTTP {status}] 속성 조회 실패: {json.dumps(page, ensure_ascii=False)}")

    out.append("[본문]")
    cursor = None
    while True:
        path = f"/blocks/{page_id}/children?page_size=100"
        if cursor:
            path += f"&start_cursor={cursor}"
        st, data = notion_request("GET", path, token)
        if st != 200:
            out.append(f"[HTTP {st}] 본문 조회 실패: {json.dumps(data, ensure_ascii=False)}")
            break
        for b in data.get("results", []):
            out.append(render_block(b))
        if data.get("has_more"):
            cursor = data.get("next_cursor")
        else:
            break
    return "\n".join(out)


def wrap_property_value(prop_type: str, value):
    """속성 타입에 맞게 원시 값(문자열/숫자/불리언/리스트)을 노션 갱신 형식으로 감싼다.
    이미 dict(노션 형식)면 그대로 반환. 알 수 없는 타입은 그대로 둔다.
    """
    if isinstance(value, dict):
        return value  # 이미 노션 형식으로 넘긴 경우 그대로 사용.

    if prop_type in ("title", "rich_text"):
        return {prop_type: [{"type": "text", "text": {"content": str(value)}}]}
    if prop_type == "select":
        return {"select": {"name": str(value)}}
    if prop_type == "status":
        return {"status": {"name": str(value)}}
    if prop_type == "multi_select":
        names = value if isinstance(value, list) else [
            s.strip() for s in str(value).split(",") if s.strip()
        ]
        return {"multi_select": [{"name": str(n)} for n in names]}
    if prop_type == "number":
        try:
            return {"number": float(value)}
        except (TypeError, ValueError):
            return {"number": None}
    if prop_type == "checkbox":
        return {"checkbox": bool(value) if isinstance(value, bool) else str(value).lower() in ("x", "true", "1", "yes", "y")}
    if prop_type in ("url", "email", "phone_number"):
        return {prop_type: str(value)}
    if prop_type == "date":
        return {"date": {"start": str(value)}}
    # 알 수 없는 타입: 값을 그대로 넘겨 노션이 판정하게 둔다(원시값이면 실패할 수 있음).
    return value


@mcp.tool()
def update_page_properties(workspace: str, page_id: str, properties: dict) -> str:
    """페이지(또는 DB 행)의 속성을 수정한다.

    ★ 값은 두 가지로 줄 수 있다:
      (1) 그냥 값만 — 권장. 속성의 실제 타입(status/select/title/number/checkbox 등)을
          서버가 자동으로 읽어 맞는 형식으로 감싼다. 타입을 몰라도 된다.
          예) {"상태": "수정완료"}   {"이름": "새 제목"}   {"진행률": 80}
              여러 선택(multi_select): {"태그": ["a","b"]} 또는 {"태그": "a, b"}
      (2) 노션 원형 형식(dict) — 그대로 전달한다(하위호환).
          예) {"상태": {"status": {"name": "수정완료"}}}
              {"이름": {"title": [{"type":"text","text":{"content":"새 제목"}}]}}

    ※ "상태" 처럼 워크플로 칸은 대개 status 타입이라 {"select":...} 가 아니라 {"status":...} 이어야
      하는데, (1) 방식을 쓰면 서버가 알아서 처리하므로 신경 쓸 필요 없다.

    workspace: 워크스페이스명
    page_id: 대상 페이지/행 id
    properties: 갱신할 속성(dict) — 값은 원시값 또는 노션 형식.
    """
    token = get_token(workspace)

    # 원시값(비-dict)이 하나라도 있으면 실제 속성 타입을 읽어 자동 변환.
    need_schema = any(not isinstance(v, dict) for v in properties.values())
    schema_types = {}
    if need_schema:
        st, page = notion_request("GET", f"/pages/{page_id}", token)
        if st != 200:
            return f"[HTTP {st}] 속성 타입 조회 실패(자동 변환용): {json.dumps(page, ensure_ascii=False)}"
        for name, v in (page.get("properties", {}) or {}).items():
            schema_types[name] = v.get("type")

    body_props = {}
    unknown = []
    for name, value in properties.items():
        if isinstance(value, dict):
            body_props[name] = value
            continue
        ptype = schema_types.get(name)
        if not ptype:
            unknown.append(name)
            body_props[name] = value  # 타입 못 찾음 — 원시값 그대로(노션이 판정/거부).
            continue
        body_props[name] = wrap_property_value(ptype, value)

    status, data = notion_request(
        "PATCH", f"/pages/{page_id}", token, {"properties": body_props}
    )
    if status != 200:
        hint = ""
        if unknown:
            hint = f" (경고: 속성 {unknown} 은 대상 페이지에 없어 타입 자동변환 못 함 — 속성명을 확인)"
        return f"[HTTP {status}] 속성 수정 실패: {json.dumps(data, ensure_ascii=False)}{hint}"
    return f"[HTTP 200] 속성 수정 성공 (page_id={page_id})"


@mcp.tool()
def create_database_row(
    workspace: str,
    database_id: str,
    properties: dict,
    text: Optional[str] = None,
) -> str:
    """DB(표)에 새 행(page)을 하나 만든다. properties 는 '속성명: 값' 맵.

    ★ 값 주는 법(update_page_properties 와 동일):
      (1) 그냥 값만 — 권장. DB 스키마의 실제 속성 타입(title/status/select/number/date 등)을
          서버가 읽어 맞는 형식으로 자동 변환한다. 타입을 몰라도 된다.
          예) {"코드": "BR43", "분류": "기능", "상태": "접수", "화면": "WS20 Design",
               "내용": "..."}
      (2) 노션 원형 형식(dict) — 그대로 전달(하위호환).

    ※ title 속성은 이름이 'title' 이 아닐 수 있다(이 이슈 DB는 '내용'이 title). DB 스키마의
      실제 title 속성명으로 값을 주면 서버가 title 로 감싼다.
    ※ text 를 주면 본문 첫 문단으로 함께 추가한다(상세 설명 등).

    workspace: 워크스페이스명
    database_id: 대상 DB id (list_workspaces 의 database_id 사용)
    properties: {속성명: 값} — 원시값 또는 노션 형식
    text: 본문 한 문단(선택)
    """
    token = get_token(workspace)

    # DB 스키마에서 속성 타입 읽기(원시값 자동 변환용).
    st, db = notion_request("GET", f"/databases/{database_id}", token)
    if st != 200:
        return f"[HTTP {st}] DB 스키마 조회 실패: {json.dumps(db, ensure_ascii=False)}"
    schema = db.get("properties", {}) or {}
    schema_types = {name: v.get("type") for name, v in schema.items()}

    body_props = {}
    unknown = []
    for name, value in properties.items():
        if isinstance(value, dict):
            body_props[name] = value
            continue
        ptype = schema_types.get(name)
        if not ptype:
            unknown.append(name)
            body_props[name] = value  # 타입 못 찾음 — 원시값 그대로(노션이 판정/거부).
            continue
        body_props[name] = wrap_property_value(ptype, value)

    body: dict = {
        "parent": {"type": "database_id", "database_id": database_id},
        "properties": body_props,
    }
    if text:
        body["children"] = [paragraph_block(text)]

    status, data = notion_request("POST", "/pages", token, body)
    if status != 200:
        hint = ""
        if unknown:
            hint = f" (경고: 속성 {unknown} 은 DB 스키마에 없음 — 속성명 확인)"
        return f"[HTTP {status}] 행 생성 실패: {json.dumps(data, ensure_ascii=False)}{hint}"
    return f"[HTTP 200] 행 생성 성공\nid={data.get('id')}\nurl={data.get('url')}"


@mcp.tool()
def update_block_text(workspace: str, block_id: str, text: str) -> str:
    """텍스트 블록(문단·제목·목록·할일 등)의 내용을 text 로 통째로 교체한다.
    block_id 는 get_page 본문에서 얻는다.

    workspace: 워크스페이스명
    block_id: 대상 블록 id
    text: 새 내용
    """
    token = get_token(workspace)
    st, b = notion_request("GET", f"/blocks/{block_id}", token)
    if st != 200:
        return f"[HTTP {st}] 블록 조회 실패: {json.dumps(b, ensure_ascii=False)}"
    bt = b.get("type")
    body = {bt: {"rich_text": [{"type": "text", "text": {"content": text}}]}}
    status, data = notion_request("PATCH", f"/blocks/{block_id}", token, body)
    if status != 200:
        return f"[HTTP {status}] 블록 수정 실패: {json.dumps(data, ensure_ascii=False)}"
    return f"[HTTP 200] 블록 수정 성공 (block_id={block_id})"


def main():
    mcp.run()


if __name__ == "__main__":
    main()
