#!/usr/bin/env python3
"""yoon-notion - Notion API CLI driven by an env/ folder of named connections.

This folder is self-contained - copy it into any project's
.claude/skills/ and it works as is.

Layout, all relative to this script:
    notion_cli.py       this file
    env/<name>.env      one Notion connection, e.g. env/work.env
    env/.default        optional; holds the name used when none is given
    tests/              offline checks

Each .env file:
    NOTION_TOKEN=ntn_xxxxxxxxxxxx
    DESCRIPTION=회사 워크스페이스
    ROOT_PAGE=https://www.notion.so/...      # optional convenience anchor

Every command takes `--as <name>` to pick a connection. A NOTION_TOKEN in the
real process environment overrides the folder.

Standard library only - no pip install required.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = "https://api.notion.com"
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")
# This folder is self-contained: the script, its env/ folder and its tests travel
# together, so paths are resolved relative to the script rather than to a project.
SCRIPT_DIR = Path(__file__).resolve().parent
ENV_DIR = Path(os.environ.get("YOON_NOTION_ENV_DIR") or (SCRIPT_DIR / "env"))
DEFAULT_MARKER = ENV_DIR / ".default"
NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
QUOTES = ("\"", "'")


class NotionError(Exception):
    """Anything the user should see as a clean one-line failure."""


# --------------------------------------------------------------------------
# env/ folder = the connection list
# --------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def cli_hint() -> str:
    """How to invoke this tool from the current working directory.

    Prefers the launcher, which finds a Python on its own; falls back to
    naming this script directly if the launcher is missing.
    """
    here = Path(__file__).resolve()
    launcher = here.with_name("yoon-notion.cmd" if os.name == "nt" else "yoon-notion.sh")
    target = launcher if launcher.exists() else here
    try:
        shown = target.relative_to(Path.cwd()).as_posix()
    except ValueError:
        shown = target.as_posix()
    return shown if target == launcher else f"python {shown}"


def check_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        raise NotionError("connection name is required")
    if not NAME_RE.match(name):
        raise NotionError(
            f"invalid name '{name}': use letters, digits, dot, dash, underscore only"
        )
    return name


def env_path(name: str) -> Path:
    return ENV_DIR / f"{check_name(name)}.env"


def parse_env_file(path: Path) -> dict:
    """Minimal dotenv reader: KEY=VALUE, # comments, optional surrounding quotes."""
    values: dict[str, str] = {}
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.lower().startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            raise NotionError(f"{path.name}:{lineno} expected KEY=VALUE, got: {raw!r}")
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in QUOTES:
            value = value[1:-1]
        values[key.strip().upper()] = value
    return values


ENV_KEY_ORDER = [
    "NOTION_TOKEN", "DESCRIPTION", "ROOT_PAGE",
    "WORKSPACE", "BOT", "ADDED_AT", "VERIFIED_AT",
]


def write_env_file(path: Path, values: dict) -> None:
    ENV_DIR.mkdir(parents=True, exist_ok=True)
    lines = [f"# yoon-notion connection: {path.stem}"]
    for key in ENV_KEY_ORDER:
        if values.get(key):
            lines.append(f"{key}={values[key]}")
    for key in sorted(values):
        if key not in ENV_KEY_ORDER and values[key]:
            lines.append(f"{key}={values[key]}")
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    tmp.replace(path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def list_connections() -> dict[str, dict]:
    if not ENV_DIR.is_dir():
        return {}
    out: dict[str, dict] = {}
    for path in sorted(ENV_DIR.glob("*.env")):
        try:
            out[path.stem] = parse_env_file(path)
        except (OSError, NotionError) as exc:
            out[path.stem] = {"_ERROR": str(exc)}
    return out


def get_default_name() -> str | None:
    if DEFAULT_MARKER.is_file():
        return DEFAULT_MARKER.read_text(encoding="utf-8").strip() or None
    return None


def set_default_name(name: str | None) -> None:
    ENV_DIR.mkdir(parents=True, exist_ok=True)
    if name is None:
        if DEFAULT_MARKER.exists():
            DEFAULT_MARKER.unlink()
    else:
        DEFAULT_MARKER.write_text(check_name(name) + "\n", encoding="utf-8")


def resolve_token(name: str | None) -> tuple[str, str]:
    """Return (connection name, token) for the requested connection."""
    ambient = os.environ.get("NOTION_TOKEN") or os.environ.get("YOON_NOTION_TOKEN")
    if ambient and not name:
        return "$NOTION_TOKEN", ambient

    connections = list_connections()
    if not connections:
        raise NotionError(
            f"no connections in {ENV_DIR}. "
            f"create one with:  {cli_hint()} connect add <name> <ntn_secret>"
        )
    key = name or get_default_name()
    if not key:
        if len(connections) == 1:
            key = next(iter(connections))
        else:
            raise NotionError(
                "several connections exist and no default is set. pass a name or run: "
                f"connect use <name>   (have: {', '.join(connections)})"
            )
    if key not in connections:
        raise NotionError(
            f"no connection named '{key}'. available: {', '.join(connections) or '(none)'}"
        )
    values = connections[key]
    if "_ERROR" in values:
        raise NotionError(f"connection '{key}' is unreadable: {values['_ERROR']}")
    token = values.get("NOTION_TOKEN", "").strip()
    if not token:
        raise NotionError(f"connection '{key}' has no NOTION_TOKEN in {env_path(key)}")
    return key, token


# --------------------------------------------------------------------------
# http
# --------------------------------------------------------------------------

def api(method: str, path: str, token: str, body=None, query=None) -> dict:
    url = f"{API_ROOT}{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query)
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(detail)
            msg = parsed.get("message", detail)
            code = parsed.get("code", "")
        except json.JSONDecodeError:
            msg, code = detail, ""
        hint = ""
        if exc.code in (403, 404):
            hint = "  (share the page with the integration: Notion page > ... > Connections)"
        raise NotionError(f"HTTP {exc.code} {code}: {msg}{hint}") from None
    except urllib.error.URLError as exc:
        raise NotionError(f"network error: {exc.reason}") from None
    return json.loads(raw) if raw else {}


def paginate(method: str, path: str, token: str, body=None, query=None, limit=None) -> list:
    results: list = []
    cursor = None
    while True:
        remaining = 100 if limit is None else max(1, min(100, limit - len(results)))
        if method == "POST":
            payload = dict(body or {})
            payload["page_size"] = remaining
            if cursor:
                payload["start_cursor"] = cursor
            resp = api(method, path, token, body=payload)
        else:
            q = dict(query or {})
            q["page_size"] = remaining
            if cursor:
                q["start_cursor"] = cursor
            resp = api(method, path, token, query=q)
        results.extend(resp.get("results", []))
        cursor = resp.get("next_cursor")
        if not resp.get("has_more") or not cursor:
            break
        if limit is not None and len(results) >= limit:
            break
    return results[:limit] if limit else results


# --------------------------------------------------------------------------
# ids
# --------------------------------------------------------------------------

HEX32_RE = re.compile(r"[0-9a-fA-F]{32}")


def norm_id(value: str) -> str:
    """Accept a bare id, a dashed uuid, or any notion.so URL."""
    if not value:
        raise NotionError("missing id")
    raw = value.strip().split("?")[0].split("#")[0]
    compact = raw.replace("-", "")
    if re.fullmatch(r"[0-9a-fA-F]{32}", compact):
        found = compact
    else:
        matches = HEX32_RE.findall(compact)
        if not matches:
            raise NotionError(f"could not find a Notion id in: {value}")
        found = matches[-1]
    h = found.lower()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"


# --------------------------------------------------------------------------
# markdown -> notion blocks
# --------------------------------------------------------------------------

MAX_TEXT = 2000
MAX_CHILDREN = 100

NOTION_LANGS = {
    "abap", "arduino", "bash", "basic", "c", "c#", "c++", "clojure", "coffeescript",
    "css", "dart", "diff", "docker", "elixir", "elm", "erlang", "flow", "fortran",
    "f#", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "html", "java",
    "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript",
    "lua", "makefile", "markdown", "markup", "matlab", "mermaid", "nix",
    "objective-c", "ocaml", "pascal", "perl", "php", "plain text", "powershell",
    "prolog", "protobuf", "python", "r", "reason", "ruby", "rust", "sass", "scala",
    "scheme", "scss", "shell", "sql", "swift", "typescript", "vb.net", "verilog",
    "vhdl", "visual basic", "webassembly", "xml", "yaml",
}

LANG_ALIASES = {
    "js": "javascript", "jsx": "javascript", "ts": "typescript", "tsx": "typescript",
    "py": "python", "rb": "ruby", "sh": "shell", "zsh": "shell", "ps1": "powershell",
    "pwsh": "powershell", "yml": "yaml", "md": "markdown", "cs": "c#", "cpp": "c++",
    "golang": "go", "dockerfile": "docker", "text": "plain text", "txt": "plain text",
    "": "plain text",
}

NESTABLE = {
    "paragraph", "bulleted_list_item", "numbered_list_item",
    "to_do", "toggle", "quote", "callout",
}

FENCE_RE = re.compile(r"^```\s*([\w+#.-]*)\s*$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
TODO_RE = re.compile(r"^[-*+]\s+\[([ xX])\]\s*(.*)$")
BULLET_RE = re.compile(r"^[-*+]\s+(.*)$")
NUMBER_RE = re.compile(r"^\d+[.)]\s+(.*)$")
QUOTE_RE = re.compile(r"^>\s?(.*)$")
DIVIDER_RE = re.compile(r"^(-{3,}|\*{3,}|_{3,})$")
TABLE_SEP_RE = re.compile(r"^\s*\|[\s:|-]+\|\s*$")

INLINE_RE = re.compile(
    r"(?P<code>`[^`]+`)"
    r"|(?P<link>\[[^\]]*\]\([^)\s]+\))"
    r"|(?P<bold>\*\*[^*]+\*\*)"
    r"|(?P<strike>~~[^~]+~~)"
    r"|(?P<italic>\*[^*\s][^*]*\*|_[^_\s][^_]*_)"
)
LINK_RE = re.compile(r"^\[([^\]]*)\]\(([^)\s]+)\)$")


def normalize_lang(lang: str) -> str:
    key = (lang or "").strip().lower()
    key = LANG_ALIASES.get(key, key)
    return key if key in NOTION_LANGS else "plain text"


def rich_text(content: str, link: str | None = None, annotations: dict | None = None) -> dict:
    item = {"type": "text", "text": {"content": content}}
    if link:
        item["text"]["link"] = {"url": link}
    if annotations:
        item["annotations"] = annotations
    return item


def split_long(items: list[dict]) -> list[dict]:
    """Notion rejects a single rich-text run longer than 2000 chars."""
    out: list[dict] = []
    for item in items:
        content = item["text"]["content"]
        if len(content) <= MAX_TEXT:
            out.append(item)
            continue
        for start in range(0, len(content), MAX_TEXT):
            clone = json.loads(json.dumps(item))
            clone["text"]["content"] = content[start:start + MAX_TEXT]
            out.append(clone)
    return out


def parse_inline(text: str) -> list[dict]:
    out: list[dict] = []
    pos = 0
    for match in INLINE_RE.finditer(text):
        if match.start() > pos:
            out.append(rich_text(text[pos:match.start()]))
        kind, raw = match.lastgroup, match.group()
        if kind == "code":
            out.append(rich_text(raw[1:-1], annotations={"code": True}))
        elif kind == "link":
            label, url = LINK_RE.match(raw).groups()
            out.append(rich_text(label or url, link=url))
        elif kind == "bold":
            out.append(rich_text(raw[2:-2], annotations={"bold": True}))
        elif kind == "strike":
            out.append(rich_text(raw[2:-2], annotations={"strikethrough": True}))
        else:
            out.append(rich_text(raw[1:-1], annotations={"italic": True}))
        pos = match.end()
    if pos < len(text):
        out.append(rich_text(text[pos:]))
    return split_long(out or [rich_text("")])


def line_to_block(text: str) -> dict:
    if DIVIDER_RE.match(text):
        return {"object": "block", "type": "divider", "divider": {}}
    match = HEADING_RE.match(text)
    if match:
        key = f"heading_{min(len(match.group(1)), 3)}"
        return {"object": "block", "type": key, key: {"rich_text": parse_inline(match.group(2))}}
    match = TODO_RE.match(text)
    if match:
        return {"object": "block", "type": "to_do", "to_do": {
            "rich_text": parse_inline(match.group(2)),
            "checked": match.group(1).lower() == "x",
        }}
    match = BULLET_RE.match(text)
    if match:
        return {"object": "block", "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": parse_inline(match.group(1))}}
    match = NUMBER_RE.match(text)
    if match:
        return {"object": "block", "type": "numbered_list_item",
                "numbered_list_item": {"rich_text": parse_inline(match.group(1))}}
    match = QUOTE_RE.match(text)
    if match:
        return {"object": "block", "type": "quote", "quote": {"rich_text": parse_inline(match.group(1))}}
    return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": parse_inline(text)}}


def parse_table(lines: list[str], index: int) -> tuple[dict, int]:
    def cells(line: str) -> list[str]:
        return [c.strip() for c in line.strip().strip("|").split("|")]

    rows = [cells(lines[index])]
    index += 2  # header + separator
    while index < len(lines) and lines[index].strip().startswith("|"):
        rows.append(cells(lines[index]))
        index += 1
    width = max(len(row) for row in rows)
    children = [
        {"object": "block", "type": "table_row",
         "table_row": {"cells": [parse_inline(c) for c in row + [""] * (width - len(row))]}}
        for row in rows
    ]
    block = {"object": "block", "type": "table", "table": {
        "table_width": width, "has_column_header": True, "children": children,
    }}
    return block, index


def prune_children(blocks: list[dict]) -> None:
    for block in blocks:
        payload = block.get(block["type"], {})
        children = payload.get("children")
        if isinstance(children, list):
            if children:
                prune_children(children)
            else:
                payload.pop("children")


def nest(entries: list[tuple[int, dict]]) -> list[dict]:
    root: list[dict] = []
    stack: list[tuple[int, list]] = [(-1, root)]
    for indent, block in entries:
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        stack[-1][1].append(block)
        btype = block["type"]
        if btype in NESTABLE:
            block[btype].setdefault("children", [])
            stack.append((indent, block[btype]["children"]))
    prune_children(root)
    return root


def md_to_blocks(markdown: str) -> list[dict]:
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    entries: list[tuple[int, dict]] = []
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        indent = (len(raw) - len(raw.lstrip(" \t"))) // 2
        if not stripped:
            i += 1
            continue
        fence = FENCE_RE.match(stripped)
        if fence:
            body: list[str] = []
            i += 1
            while i < len(lines) and not FENCE_RE.match(lines[i].strip()):
                body.append(lines[i])
                i += 1
            i += 1
            entries.append((indent, {"object": "block", "type": "code", "code": {
                "language": normalize_lang(fence.group(1)),
                "rich_text": split_long([rich_text("\n".join(body))]),
            }}))
            continue
        if stripped.startswith("|") and i + 1 < len(lines) and TABLE_SEP_RE.match(lines[i + 1]):
            block, i = parse_table(lines, i)
            entries.append((indent, block))
            continue
        entries.append((indent, line_to_block(stripped)))
        i += 1
    return nest(entries)


# --------------------------------------------------------------------------
# notion blocks -> markdown
# --------------------------------------------------------------------------

def rt_to_md(runs: list | None) -> str:
    out = []
    for run in runs or []:
        text = run.get("plain_text", "")
        ann = run.get("annotations", {})
        if ann.get("code"):
            text = f"`{text}`"
        if ann.get("bold"):
            text = f"**{text}**"
        if ann.get("italic"):
            text = f"*{text}*"
        if ann.get("strikethrough"):
            text = f"~~{text}~~"
        href = run.get("href")
        if href:
            text = f"[{text}]({href})"
        out.append(text)
    return "".join(out)


SIMPLE_PREFIX = {
    "paragraph": "", "heading_1": "# ", "heading_2": "## ", "heading_3": "### ",
    "bulleted_list_item": "- ", "numbered_list_item": "1. ", "quote": "> ",
    "toggle": "- ", "callout": "> ",
}


def block_to_md(block: dict, token: str, depth: int, expand: bool) -> list[str]:
    btype = block.get("type", "")
    payload = block.get(btype, {}) or {}
    pad = "  " * depth
    lines: list[str] = []

    if btype == "divider":
        lines.append(f"{pad}---")
    elif btype == "code":
        lang = payload.get("language", "plain text")
        lines.append(f"{pad}```{'' if lang == 'plain text' else lang}")
        lines.extend(f"{pad}{ln}" for ln in rt_to_md(payload.get("rich_text")).split("\n"))
        lines.append(f"{pad}```")
    elif btype == "to_do":
        mark = "x" if payload.get("checked") else " "
        lines.append(f"{pad}- [{mark}] {rt_to_md(payload.get('rich_text'))}")
    elif btype == "table":
        pass  # rows come through as children
    elif btype == "table_row":
        cells = [rt_to_md(c) for c in payload.get("cells", [])]
        lines.append(f"{pad}| " + " | ".join(cells) + " |")
    elif btype in ("image", "video", "file", "pdf", "embed", "bookmark"):
        src = payload.get("external", {}).get("url") or payload.get("file", {}).get("url") or payload.get("url", "")
        lines.append(f"{pad}[{btype}] {src}")
    elif btype in ("child_page", "child_database"):
        lines.append(f"{pad}[{btype}] {payload.get('title', '')}  (id: {block.get('id')})")
    elif btype in SIMPLE_PREFIX:
        lines.append(f"{pad}{SIMPLE_PREFIX[btype]}{rt_to_md(payload.get('rich_text'))}".rstrip())
    else:
        lines.append(f"{pad}[{btype}] {rt_to_md(payload.get('rich_text'))}".rstrip())

    if block.get("has_children") and expand and btype not in ("child_page", "child_database"):
        child_depth = depth if btype in ("table", "table_row") else depth + 1
        children = paginate("GET", f"/v1/blocks/{block['id']}/children", token)
        for child in children:
            lines.extend(block_to_md(child, token, child_depth, expand))
    return lines


def blocks_to_md(blocks: list[dict], token: str, expand: bool = True) -> str:
    lines: list[str] = []
    for block in blocks:
        lines.extend(block_to_md(block, token, 0, expand))
    return "\n".join(lines)


# --------------------------------------------------------------------------
# page / database properties
# --------------------------------------------------------------------------

def page_title(obj: dict) -> str:
    if obj.get("object") == "database":
        return rt_to_md(obj.get("title", [])) or "(untitled)"
    for prop in (obj.get("properties") or {}).values():
        if prop.get("type") == "title":
            return rt_to_md(prop.get("title")) or "(untitled)"
    return "(untitled)"


def prop_to_text(prop: dict) -> str:
    ptype = prop.get("type", "")
    value = prop.get(ptype)
    if value is None:
        return ""
    if ptype in ("title", "rich_text"):
        return rt_to_md(value)
    if ptype in ("number", "url", "email", "phone_number", "created_time", "last_edited_time"):
        return str(value)
    if ptype == "checkbox":
        return "true" if value else "false"
    if ptype in ("select", "status"):
        return value.get("name", "")
    if ptype == "multi_select":
        return ", ".join(v.get("name", "") for v in value)
    if ptype == "date":
        start, end = value.get("start", ""), value.get("end")
        return f"{start}..{end}" if end else start
    if ptype in ("people", "created_by", "last_edited_by"):
        items = value if isinstance(value, list) else [value]
        return ", ".join(v.get("name") or v.get("id", "") for v in items)
    if ptype == "files":
        return ", ".join(
            f.get("external", {}).get("url") or f.get("file", {}).get("url", "") for f in value
        )
    if ptype == "relation":
        return ", ".join(v.get("id", "") for v in value)
    if ptype == "formula":
        return str(value.get(value.get("type"), ""))
    if ptype == "rollup":
        inner = value.get(value.get("type"))
        return json.dumps(inner, ensure_ascii=False) if isinstance(inner, (list, dict)) else str(inner)
    if ptype == "unique_id":
        prefix = value.get("prefix") or ""
        return f"{prefix}{value.get('number')}"
    return json.dumps(value, ensure_ascii=False)


def coerce_property(spec: dict, value: str) -> dict:
    ptype = spec["type"]
    csv = [v.strip() for v in value.split(",") if v.strip()]
    if ptype == "title":
        return {"title": parse_inline(value)}
    if ptype == "rich_text":
        return {"rich_text": parse_inline(value)}
    if ptype == "number":
        return {"number": None if value == "" else float(value)}
    if ptype == "checkbox":
        return {"checkbox": value.lower() in ("1", "true", "yes", "y", "on", "checked")}
    if ptype in ("select", "status"):
        return {ptype: {"name": value} if value else None}
    if ptype == "multi_select":
        return {"multi_select": [{"name": v} for v in csv]}
    if ptype == "date":
        if not value:
            return {"date": None}
        parts = [p.strip() for p in value.split("..")]
        date = {"start": parts[0]}
        if len(parts) > 1 and parts[1]:
            date["end"] = parts[1]
        return {"date": date}
    if ptype in ("url", "email", "phone_number"):
        return {ptype: value or None}
    if ptype == "people":
        return {"people": [{"object": "user", "id": norm_id(v)} for v in csv]}
    if ptype == "relation":
        return {"relation": [{"id": norm_id(v)} for v in csv]}
    if ptype == "files":
        return {"files": [{"type": "external", "name": v[:100], "external": {"url": v}} for v in csv]}
    raise NotionError(
        f"property type '{ptype}' cannot be written by this CLI (it may be computed). "
        "Use the `raw` subcommand if you need it."
    )


def build_properties(schema: dict, pairs: list[str]) -> dict:
    props: dict = {}
    for pair in pairs or []:
        if "=" not in pair:
            raise NotionError(f"bad --prop '{pair}', expected Name=value")
        name, value = pair.split("=", 1)
        name = name.strip()
        if name not in schema:
            raise NotionError(
                f"property '{name}' is not in the database. available: {', '.join(schema)}"
            )
        props[name] = coerce_property(schema[name], value.strip())
    return props


def title_prop_name(schema: dict) -> str:
    for name, spec in schema.items():
        if spec.get("type") == "title":
            return name
    raise NotionError("database has no title property")


# --------------------------------------------------------------------------
# write helpers
# --------------------------------------------------------------------------

def chunked(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def append_blocks(token: str, parent_id: str, blocks: list[dict]) -> int:
    """Append blocks, recursing into children so nesting depth is unlimited."""
    written = 0
    for chunk in chunked(blocks, MAX_CHILDREN):
        deferred: list[list | None] = []
        for block in chunk:
            payload = block.get(block["type"], {})
            # a table must carry its rows in the same request
            deferred.append(None if block["type"] == "table" else payload.pop("children", None))
        resp = api("PATCH", f"/v1/blocks/{parent_id}/children", token, body={"children": chunk})
        created = resp.get("results", [])
        written += len(created)
        for made, children in zip(created, deferred):
            if children:
                written += append_blocks(token, made["id"], children)
    return written


def retrieve_target(token: str, obj_id: str) -> tuple[str, dict]:
    """Return ('database'|'page', object) for an id that may be either."""
    try:
        return "database", api("GET", f"/v1/databases/{obj_id}", token)
    except NotionError:
        return "page", api("GET", f"/v1/pages/{obj_id}", token)


def read_content(args) -> str:
    if getattr(args, "content_file", None):
        if args.content_file == "-":
            return sys.stdin.read()
        return Path(args.content_file).read_text(encoding="utf-8")
    return getattr(args, "content", None) or ""


def emit(args, data, text_lines: list[str]) -> None:
    if getattr(args, "json", False):
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print("\n".join(text_lines))


def display_width(text: str) -> int:
    """Terminal columns a string occupies; CJK glyphs take two."""
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in text)


def ellipsize(text: str, limit: int) -> str:
    if display_width(text) <= limit:
        return text
    out, width = "", 0
    for ch in text:
        step = 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
        if width + step > limit - 1:
            break
        out, width = out + ch, width + step
    return out + "…"


def render_table(headers: list[str], rows: list[list[str]]) -> list[str]:
    widths = [display_width(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], display_width(cell))

    def line(cells: list[str]) -> str:
        padded = [c + " " * (widths[i] - display_width(c)) for i, c in enumerate(cells)]
        return "  ".join(padded).rstrip()

    return [line(headers), line(["-" * w for w in widths])] + [line(r) for r in rows]


def describe_props(obj: dict) -> list[str]:
    lines = []
    for name, prop in (obj.get("properties") or {}).items():
        value = prop_to_text(prop)
        if value:
            lines.append(f"  - {name} ({prop.get('type')}): {value}")
    return lines


# --------------------------------------------------------------------------
# connection commands
# --------------------------------------------------------------------------

def cmd_connect_add(args) -> None:
    name = check_name(args.name)
    path = env_path(name)
    if path.exists() and not args.force:
        raise NotionError(f"connection '{name}' already exists ({path}). use --force to overwrite")
    token = args.token.strip()
    me = api("GET", "/v1/users/me", token)
    values = {
        "NOTION_TOKEN": token,
        "DESCRIPTION": args.desc or "",
        "ROOT_PAGE": args.root or "",
        "BOT": me.get("name") or "",
        "WORKSPACE": (me.get("bot") or {}).get("workspace_name") or "",
        "ADDED_AT": now_iso(),
        "VERIFIED_AT": now_iso(),
    }
    write_env_file(path, values)
    if args.default or get_default_name() is None:
        set_default_name(name)
    print(f"saved connection '{name}' -> {path}")
    print(f"  token     (저장됨, 검증 완료)")
    print(f"  workspace {values['WORKSPACE'] or '(unknown)'}")
    print(f"  bot       {values['BOT'] or '(unknown)'}")
    print(f"  default   {get_default_name() == name}")


def cmd_connect_list(args) -> None:
    connections = list_connections()
    default = get_default_name()
    if args.json:
        payload = {
            "env_dir": str(ENV_DIR),
            "default": default,
            "connections": {
                # the token itself is never part of the listing
                name: {k: v for k, v in values.items() if k != "NOTION_TOKEN"}
                for name, values in connections.items()
            },
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    if not connections:
        print(f"등록된 노션이 없습니다  ({ENV_DIR})")
        print(f"추가:  {cli_hint()} connect add <이름> <ntn_토큰>")
        return

    headers = ["기본", "이름", "설명", "워크스페이스", "봇", "확인일"]
    rows: list[list[str]] = []
    broken: list[tuple[str, str]] = []
    for name, values in connections.items():
        marker = "*" if name == default else ""
        if "_ERROR" in values:
            broken.append((name, values["_ERROR"]))
            rows.append([marker, name, "(읽기 실패)", "-", "-", "-"])
            continue
        rows.append([
            marker,
            name,                                          # never truncated
            values.get("DESCRIPTION") or "-",              # never truncated
            ellipsize(values.get("WORKSPACE") or "-", 40),
            ellipsize(values.get("BOT") or "-", 20),
            (values.get("VERIFIED_AT") or "-")[:10],
        ])

    print(f"등록된 노션 {len(connections)}개  ({ENV_DIR})")
    print()
    for line in render_table(headers, rows):
        print(line)
    print()
    print("* = 이름을 생략했을 때 쓰는 기본 연결")
    if broken:
        print()
        print("읽지 못한 파일:")
        for name, message in broken:
            print(f"  - {name}.env: {message}")


def cmd_connect_show(args) -> None:
    name = check_name(args.name)
    path = env_path(name)
    if not path.exists():
        raise NotionError(f"no connection named '{name}' ({path})")
    values = parse_env_file(path)
    print(f"{name}  ({path})")
    for key, value in values.items():
        # the token value is never printed - only whether one is stored
        print(f"  {key:<12} {'(저장됨)' if key == 'NOTION_TOKEN' else value}")
    print(f"  {'DEFAULT':<12} {get_default_name() == name}")


def cmd_connect_remove(args) -> None:
    name = check_name(args.name)
    path = env_path(name)
    if not path.exists():
        raise NotionError(f"no connection named '{name}' ({path})")
    path.unlink()
    if get_default_name() == name:
        remaining = list(list_connections())
        set_default_name(remaining[0] if len(remaining) == 1 else None)
    print(f"removed connection '{name}' ({path})")


def cmd_connect_use(args) -> None:
    name = check_name(args.name)
    if not env_path(name).exists():
        raise NotionError(f"no connection named '{name}'. available: {', '.join(list_connections())}")
    set_default_name(name)
    print(f"default connection is now '{name}'")


def cmd_connect_verify(args) -> None:
    names = list(list_connections()) if args.all or not args.name else [check_name(args.name)]
    if not names:
        raise NotionError(f"no connections in {ENV_DIR}")
    failures = 0
    for name in names:
        path = env_path(name)
        try:
            values = parse_env_file(path)
            me = api("GET", "/v1/users/me", values.get("NOTION_TOKEN", ""))
        except NotionError as exc:
            failures += 1
            print(f"FAIL {name}: {exc}")
            continue
        values["BOT"] = me.get("name") or values.get("BOT", "")
        values["WORKSPACE"] = (me.get("bot") or {}).get("workspace_name") or values.get("WORKSPACE", "")
        values["VERIFIED_AT"] = now_iso()
        write_env_file(path, values)
        print(f"OK   {name}: bot={values['BOT'] or '?'} workspace={values['WORKSPACE'] or '?'}")
    if failures:
        raise NotionError(f"{failures} of {len(names)} connection(s) failed")


# --------------------------------------------------------------------------
# notion commands
# --------------------------------------------------------------------------

def cmd_whoami(args) -> None:
    name, token = resolve_token(args.conn)
    me = api("GET", "/v1/users/me", token)
    emit(args, me, [
        f"connection: {name}",
        f"bot:        {me.get('name') or '(unnamed)'}",
        f"workspace:  {(me.get('bot') or {}).get('workspace_name') or '(unknown)'}",
        f"id:         {me.get('id')}",
    ])


def cmd_search(args) -> None:
    _, token = resolve_token(args.conn)
    body: dict = {}
    if args.query:
        body["query"] = args.query
    if args.type:
        body["filter"] = {"property": "object", "value": args.type}
    if args.sort:
        body["sort"] = {"direction": args.sort, "timestamp": "last_edited_time"}
    results = paginate("POST", "/v1/search", token, body=body, limit=args.limit)
    lines = [f"{len(results)} result(s)"]
    for item in results:
        lines.append(
            f"- [{item.get('object')}] {page_title(item)}\n"
            f"    id:  {item.get('id')}\n"
            f"    url: {item.get('url', '')}"
        )
    emit(args, results, lines)


def cmd_page_get(args) -> None:
    _, token = resolve_token(args.conn)
    obj_id = norm_id(args.page)
    kind, obj = retrieve_target(token, obj_id)
    lines = [
        f"[{kind}] {page_title(obj)}",
        f"id:  {obj.get('id')}",
        f"url: {obj.get('url', '')}",
    ]
    props = describe_props(obj)
    if props:
        lines.append("properties:")
        lines.extend(props)
    body = None
    if not args.no_content and kind == "page":
        blocks = paginate("GET", f"/v1/blocks/{obj_id}/children", token, limit=args.limit)
        body = blocks
        lines.append("--- content ---")
        lines.append(blocks_to_md(blocks, token, expand=not args.flat))
    emit(args, {"object": obj, "blocks": body}, lines)


def cmd_page_create(args) -> None:
    conn, token = resolve_token(args.conn)
    parent_id = norm_id(args.parent)
    kind, parent = retrieve_target(token, parent_id)
    if kind == "database":
        schema = parent.get("properties", {})
        props = build_properties(schema, args.prop)
        if args.title:
            props[title_prop_name(schema)] = {"title": parse_inline(args.title)}
        payload = {"parent": {"database_id": parent_id}, "properties": props}
    else:
        payload = {
            "parent": {"page_id": parent_id},
            "properties": {"title": {"title": parse_inline(args.title or "Untitled")}},
        }
        if args.prop:
            raise NotionError("--prop only applies when the parent is a database")
    page = api("POST", "/v1/pages", token, body=payload)
    written = 0
    content = read_content(args)
    if content.strip():
        written = append_blocks(token, page["id"], md_to_blocks(content))
    emit(args, page, [
        f"[{conn}] created page: {page_title(page)}",
        f"id:  {page.get('id')}",
        f"url: {page.get('url', '')}",
        f"blocks written: {written}",
    ])


def cmd_page_update(args) -> None:
    conn, token = resolve_token(args.conn)
    page_id = norm_id(args.page)
    page = api("GET", f"/v1/pages/{page_id}", token)
    payload: dict = {}
    schema = {name: {"type": prop.get("type")} for name, prop in (page.get("properties") or {}).items()}
    props = build_properties(schema, args.prop)
    if args.title:
        props[title_prop_name(schema)] = {"title": parse_inline(args.title)}
    if props:
        payload["properties"] = props
    if args.archive:
        payload["archived"] = True
    if args.restore:
        payload["archived"] = False
    if not payload:
        raise NotionError("nothing to update: pass --title, --prop, --archive or --restore")
    updated = api("PATCH", f"/v1/pages/{page_id}", token, body=payload)
    emit(args, updated, [
        f"[{conn}] updated page: {page_title(updated)}",
        f"id:  {updated.get('id')}",
        f"url: {updated.get('url', '')}",
        f"archived: {updated.get('archived')}",
    ])


def cmd_append(args) -> None:
    conn, token = resolve_token(args.conn)
    target = norm_id(args.target)
    content = read_content(args)
    if not content.strip():
        raise NotionError("no content: pass --content TEXT or --content-file PATH (- for stdin)")
    written = append_blocks(token, target, md_to_blocks(content))
    print(f"[{conn}] appended {written} block(s) to {target}")


def cmd_blocks(args) -> None:
    _, token = resolve_token(args.conn)
    target = norm_id(args.target)
    blocks = paginate("GET", f"/v1/blocks/{target}/children", token, limit=args.limit)
    lines = [f"{len(blocks)} child block(s) of {target}"]
    for block in blocks:
        btype = block.get("type", "")
        payload = block.get(btype) or {}
        # child_page / child_database carry their name in `title`, not rich_text
        text = payload.get("title") or rt_to_md(payload.get("rich_text")) or ""
        kids = " (+children)" if block.get("has_children") else ""
        lines.append(f"- {block.get('id')}  [{btype}]{kids}  {text[:120]}")
    emit(args, blocks, lines)


def cmd_block_replace(args) -> None:
    conn, token = resolve_token(args.conn)
    block_id = norm_id(args.block)
    block = api("GET", f"/v1/blocks/{block_id}", token)
    btype = block.get("type")
    if "rich_text" not in (block.get(btype) or {}):
        raise NotionError(f"block type '{btype}' has no editable text; delete and re-append instead")
    body = {btype: {"rich_text": parse_inline(read_content(args) or args.text or "")}}
    updated = api("PATCH", f"/v1/blocks/{block_id}", token, body=body)
    emit(args, updated, [f"[{conn}] updated block {block_id} [{btype}]"])


def cmd_block_delete(args) -> None:
    conn, token = resolve_token(args.conn)
    block_id = norm_id(args.block)
    api("DELETE", f"/v1/blocks/{block_id}", token)
    print(f"[{conn}] deleted block {block_id}")


def cmd_db_get(args) -> None:
    _, token = resolve_token(args.conn)
    db_id = norm_id(args.database)
    db = api("GET", f"/v1/databases/{db_id}", token)
    lines = [
        f"[database] {page_title(db)}",
        f"id:  {db.get('id')}",
        f"url: {db.get('url', '')}",
        "schema:",
    ]
    for name, spec in (db.get("properties") or {}).items():
        detail = ""
        options = (spec.get(spec.get("type")) or {}).get("options")
        if options:
            detail = "  options: " + ", ".join(o.get("name", "") for o in options)
        lines.append(f"  - {name} ({spec.get('type')}){detail}")
    emit(args, db, lines)


def cmd_db_query(args) -> None:
    _, token = resolve_token(args.conn)
    db_id = norm_id(args.database)
    body: dict = {}
    if args.filter:
        body["filter"] = json.loads(args.filter)
    if args.sorts:
        body["sorts"] = json.loads(args.sorts)
    rows = paginate("POST", f"/v1/databases/{db_id}/query", token, body=body, limit=args.limit)
    lines = [f"{len(rows)} row(s)"]
    for row in rows:
        lines.append(f"- {page_title(row)}   (id: {row.get('id')})")
        for name, prop in (row.get("properties") or {}).items():
            if prop.get("type") == "title":
                continue
            value = prop_to_text(prop)
            if value:
                lines.append(f"    {name}: {value}")
    emit(args, rows, lines)


def cmd_comment(args) -> None:
    conn, token = resolve_token(args.conn)
    body = {
        "parent": {"page_id": norm_id(args.page)},
        "rich_text": parse_inline(read_content(args) or args.text or ""),
    }
    created = api("POST", "/v1/comments", token, body=body)
    emit(args, created, [f"[{conn}] comment posted: {created.get('id')}"])


def cmd_raw(args) -> None:
    _, token = resolve_token(args.conn)
    body = None
    if args.body_file:
        raw = sys.stdin.read() if args.body_file == "-" else Path(args.body_file).read_text(encoding="utf-8")
        body = json.loads(raw)
    elif args.body:
        body = json.loads(args.body)
    path = args.path if args.path.startswith("/") else "/" + args.path
    resp = api(args.method.upper(), path, token, body=body)
    print(json.dumps(resp, ensure_ascii=False, indent=2))


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--as", dest="conn", metavar="NAME",
                        help="connection name from the env/ folder")
    common.add_argument("--json", action="store_true", help="print the raw API JSON")

    content = argparse.ArgumentParser(add_help=False)
    content.add_argument("--content", help="markdown body")
    content.add_argument("--content-file", metavar="PATH",
                         help="read the markdown body from a file ('-' for stdin)")

    parser = argparse.ArgumentParser(
        prog="notion_cli.py",
        description="Notion API CLI driven by named connections in the env/ folder.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # --- connections
    conn = sub.add_parser("connect", help="manage the env/ connection list").add_subparsers(
        dest="subcmd", required=True)

    p = conn.add_parser("add", help="save a token as env/<name>.env (verifies it first)")
    p.add_argument("name")
    p.add_argument("token")
    p.add_argument("--desc", help="human description")
    p.add_argument("--root", help="optional root page URL/id for this workspace")
    p.add_argument("--default", action="store_true", help="make this the default connection")
    p.add_argument("--force", action="store_true", help="overwrite an existing connection")
    p.set_defaults(func=cmd_connect_add)

    p = conn.add_parser("list", help="list connections")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_connect_list)

    p = conn.add_parser("show", help="show one connection")
    p.add_argument("name")
    p.set_defaults(func=cmd_connect_show)

    p = conn.add_parser("remove", help="delete env/<name>.env")
    p.add_argument("name")
    p.set_defaults(func=cmd_connect_remove)

    p = conn.add_parser("use", help="set the default connection")
    p.add_argument("name")
    p.set_defaults(func=cmd_connect_use)

    p = conn.add_parser("verify", help="check tokens against the Notion API")
    p.add_argument("name", nargs="?")
    p.add_argument("--all", action="store_true")
    p.set_defaults(func=cmd_connect_verify)

    # --- notion
    p = sub.add_parser("whoami", parents=[common], help="show which bot/workspace a connection maps to")
    p.set_defaults(func=cmd_whoami)

    p = sub.add_parser("search", parents=[common], help="search pages and databases")
    p.add_argument("query", nargs="?", default="")
    p.add_argument("--type", choices=["page", "database"])
    p.add_argument("--sort", choices=["ascending", "descending"])
    p.add_argument("--limit", type=int, default=20)
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("get", parents=[common], help="read a page or database (id or URL)")
    p.add_argument("page")
    p.add_argument("--no-content", action="store_true", help="properties only")
    p.add_argument("--flat", action="store_true", help="do not expand nested blocks")
    p.add_argument("--limit", type=int, default=None)
    p.set_defaults(func=cmd_page_get)

    p = sub.add_parser("create", parents=[common, content], help="create a page under a page or database")
    p.add_argument("--parent", required=True, help="parent page or database (id or URL)")
    p.add_argument("--title")
    p.add_argument("--prop", action="append", default=[], metavar="NAME=VALUE",
                   help="database property, repeatable")
    p.set_defaults(func=cmd_page_create)

    p = sub.add_parser("update", parents=[common], help="update page title, properties or archive state")
    p.add_argument("page")
    p.add_argument("--title")
    p.add_argument("--prop", action="append", default=[], metavar="NAME=VALUE")
    p.add_argument("--archive", action="store_true")
    p.add_argument("--restore", action="store_true")
    p.set_defaults(func=cmd_page_update)

    p = sub.add_parser("append", parents=[common, content], help="append markdown to a page or block")
    p.add_argument("target", help="page or block id/URL")
    p.set_defaults(func=cmd_append)

    p = sub.add_parser("blocks", parents=[common], help="list child blocks with their ids")
    p.add_argument("target")
    p.add_argument("--limit", type=int, default=None)
    p.set_defaults(func=cmd_blocks)

    p = sub.add_parser("replace", parents=[common, content], help="replace the text of one block")
    p.add_argument("block")
    p.add_argument("--text")
    p.set_defaults(func=cmd_block_replace)

    p = sub.add_parser("delete", parents=[common], help="delete (archive) one block")
    p.add_argument("block")
    p.set_defaults(func=cmd_block_delete)

    p = sub.add_parser("db", parents=[common], help="show a database schema")
    p.add_argument("database")
    p.set_defaults(func=cmd_db_get)

    p = sub.add_parser("query", parents=[common], help="query a database")
    p.add_argument("database")
    p.add_argument("--filter", help="Notion filter object as JSON")
    p.add_argument("--sorts", help="Notion sorts array as JSON")
    p.add_argument("--limit", type=int, default=25)
    p.set_defaults(func=cmd_db_query)

    p = sub.add_parser("comment", parents=[common, content], help="post a comment on a page")
    p.add_argument("page")
    p.add_argument("--text")
    p.set_defaults(func=cmd_comment)

    p = sub.add_parser("raw", parents=[common], help="call any Notion endpoint directly")
    p.add_argument("method")
    p.add_argument("path", help="e.g. /v1/users")
    p.add_argument("--body", help="request body as JSON")
    p.add_argument("--body-file", help="request body from a file ('-' for stdin)")
    p.set_defaults(func=cmd_raw)

    return parser


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, OSError):
            pass
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
    except NotionError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON argument: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
