"""Offline checks for notion_cli pure logic.

No network, no touching the real env/ folder.
Run:  python .claude/skills/yoon-notion/tests/test_notion_cli.py
"""
import contextlib
import io
import os
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # .claude/skills/yoon-notion
TMP = Path(tempfile.mkdtemp(prefix="yoon-notion-test-"))
os.environ["YOON_NOTION_ENV_DIR"] = str(TMP / "env")  # never touch the real env/
os.environ.pop("NOTION_TOKEN", None)
os.environ.pop("YOON_NOTION_TOKEN", None)
sys.path.insert(0, str(ROOT))

import notion_cli as nc  # noqa: E402

fails: list[str] = []


def check(label, got, want):
    if got != want:
        fails.append(f"{label}\n   got:  {got!r}\n   want: {want!r}")


def expect_error(label, fn):
    try:
        fn()
    except nc.NotionError:
        return
    fails.append(f"{label}: expected NotionError, none raised")


# --- id normalization ------------------------------------------------------
check("id: bare hex",
      nc.norm_id("2f0a1b2c3d4e5f60718293a4b5c6d7e8"),
      "2f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8")
check("id: dashed passthrough",
      nc.norm_id("2f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8"),
      "2f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8")
check("id: notion url with slug + query",
      nc.norm_id("https://www.notion.so/team/Weekly-Notes-2f0a1b2c3d4e5f60718293a4b5c6d7e8?pvs=4"),
      "2f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8")
expect_error("id: url without an id", lambda: nc.norm_id("https://www.notion.so/no-id-here"))

# --- inline rich text ------------------------------------------------------
runs = nc.parse_inline("plain **bold** and *it* and `co` and [lnk](https://x.dev) end")
check("inline: run count", len(runs), 9)
check("inline: bold", (runs[1]["text"]["content"], runs[1]["annotations"]), ("bold", {"bold": True}))
check("inline: code", (runs[5]["text"]["content"], runs[5]["annotations"]), ("co", {"code": True}))
check("inline: link", (runs[7]["text"]["content"], runs[7]["text"]["link"]),
      ("lnk", {"url": "https://x.dev"}))
check("inline: 2000-char split", len(nc.parse_inline("x" * 4500)), 3)

# --- markdown -> blocks ----------------------------------------------------
md = """# Title

Body text.

- one
  - nested
- [x] done task
- [ ] open task

1. first
2. second

> quoted

---

```py
print("hi")
```

| a | b |
| - | - |
| 1 | 2 |
"""
blocks = nc.md_to_blocks(md)
check("md: top-level types", [b["type"] for b in blocks], [
    "heading_1", "paragraph", "bulleted_list_item", "to_do", "to_do",
    "numbered_list_item", "numbered_list_item", "quote", "divider", "code", "table",
])
check("md: nesting under bullet",
      [c["type"] for c in blocks[2]["bulleted_list_item"]["children"]],
      ["bulleted_list_item"])
check("md: nested text",
      blocks[2]["bulleted_list_item"]["children"][0]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
      "nested")
check("md: to_do checked", blocks[3]["to_do"]["checked"], True)
check("md: to_do unchecked", blocks[4]["to_do"]["checked"], False)
check("md: empty children key pruned", "children" in blocks[1]["paragraph"], False)
check("md: code language alias", blocks[9]["code"]["language"], "python")
check("md: code body", blocks[9]["code"]["rich_text"][0]["text"]["content"], 'print("hi")')
check("md: table width", blocks[10]["table"]["table_width"], 2)
check("md: table rows", len(blocks[10]["table"]["children"]), 2)
check("md: unknown lang falls back",
      nc.md_to_blocks("```wat\nx\n```")[0]["code"]["language"], "plain text")
check("md: heading depth clamped to 3", nc.md_to_blocks("##### deep")[0]["type"], "heading_3")

# --- blocks -> markdown ----------------------------------------------------
api_blocks = [
    {"id": "1", "type": "heading_2", "has_children": False,
     "heading_2": {"rich_text": [{"plain_text": "Head", "annotations": {}}]}},
    {"id": "2", "type": "to_do", "has_children": False,
     "to_do": {"checked": True,
               "rich_text": [{"plain_text": "done", "annotations": {"bold": True}}]}},
    {"id": "3", "type": "paragraph", "has_children": False,
     "paragraph": {"rich_text": [{"plain_text": "see", "annotations": {},
                                  "href": "https://x.dev"}]}},
]
check("blocks->md", nc.blocks_to_md(api_blocks, "tok", expand=False),
      "## Head\n- [x] **done**\n[see](https://x.dev)")

# --- properties ------------------------------------------------------------
schema = {
    "Name": {"type": "title"}, "Count": {"type": "number"},
    "Done": {"type": "checkbox"}, "Tags": {"type": "multi_select"},
    "When": {"type": "date"}, "Stage": {"type": "select"},
}
props = nc.build_properties(schema, [
    "Name=Hello", "Count=3.5", "Done=yes", "Tags=a, b",
    "When=2026-01-01..2026-01-05", "Stage=Todo",
])
check("prop: number", props["Count"], {"number": 3.5})
check("prop: checkbox", props["Done"], {"checkbox": True})
check("prop: multi_select", props["Tags"], {"multi_select": [{"name": "a"}, {"name": "b"}]})
check("prop: date range", props["When"], {"date": {"start": "2026-01-01", "end": "2026-01-05"}})
check("prop: select", props["Stage"], {"select": {"name": "Todo"}})
check("prop: title text", props["Name"]["title"][0]["text"]["content"], "Hello")
check("prop: title prop lookup", nc.title_prop_name(schema), "Name")
expect_error("prop: unknown property", lambda: nc.build_properties(schema, ["Nope=1"]))
expect_error("prop: computed type rejected",
             lambda: nc.coerce_property({"type": "formula"}, "x"))
check("prop read: formula",
      nc.prop_to_text({"type": "formula", "formula": {"type": "string", "string": "ok"}}), "ok")
check("prop read: multi_select",
      nc.prop_to_text({"type": "multi_select", "multi_select": [{"name": "x"}, {"name": "y"}]}),
      "x, y")

# --- table rendering -------------------------------------------------------
check("table: ascii width", nc.display_width("work"), 4)
check("table: cjk counts double", nc.display_width("회사"), 4)
check("table: mixed width", nc.display_width("윤의 개인 노션"), 14)
check("table: ellipsize keeps short text", nc.ellipsize("Acme", 10), "Acme")
check("table: ellipsize cuts on width not length", nc.ellipsize("회사 워크스페이스", 8), "회사 워…")
check("table: ellipsized width fits", nc.display_width(nc.ellipsize("회사 워크스페이스", 8)) <= 8, True)

table = nc.render_table(
    ["기본", "이름", "워크스페이스"],
    [["*", "personal", "윤의 개인 노션"], ["", "work", "Acme"]],
)
check("table: row count", len(table), 4)
check("table: header", table[0], "기본  이름      워크스페이스")
check("table: rule spans the widest line",
      nc.display_width(table[1]), max(nc.display_width(line) for line in table))
check("table: lines carry no trailing spaces",
      [line for line in table if line != line.rstrip()], [])
check("table: cjk row aligns", table[2], "*     personal  윤의 개인 노션")
check("table: ascii row padded to cjk column", table[3], "      work      Acme")
check("table: no rows still renders header + rule",
      nc.render_table(["a", "bb"], []), ["a  bb", "-  --"])

# --- env folder store ------------------------------------------------------
expect_error("store: empty env dir", lambda: nc.resolve_token(None))

nc.write_env_file(nc.env_path("work"),
                  {"NOTION_TOKEN": "ntn_worktoken1234567", "DESCRIPTION": "회사"})
nc.write_env_file(nc.env_path("personal"), {"NOTION_TOKEN": "ntn_personaltoken999"})
check("store: list", sorted(nc.list_connections()), ["personal", "work"])
check("store: named resolve", nc.resolve_token("work")[1], "ntn_worktoken1234567")
expect_error("store: two connections, no default", lambda: nc.resolve_token(None))
nc.set_default_name("personal")
check("store: default resolve", nc.resolve_token(None), ("personal", "ntn_personaltoken999"))
check("store: korean round-trip",
      nc.parse_env_file(nc.env_path("work"))["DESCRIPTION"], "회사")

# --- listing must never print the token -----------------------------------
def run_list(as_json):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        nc.cmd_connect_list(types.SimpleNamespace(json=as_json))
    return buf.getvalue()


listing = run_list(False)
check("list: shows the connection name", "work" in listing, True)
check("list: shows the description in full", "회사" in listing, True)
check("list: hides the token", "ntn_worktoken1234567" in listing, False)
check("list: hides even a token fragment", "ntn_" in listing, False)

listing_json = run_list(True)
check("list --json: hides the token", "ntn_" in listing_json, False)
check("list --json: drops the NOTION_TOKEN key", "NOTION_TOKEN" in listing_json, False)
check("list --json: keeps the description", "회사" in listing_json, True)
expect_error("store: unknown name", lambda: nc.resolve_token("nope"))

nc.env_path("quoted").write_text(
    "# comment\nexport NOTION_TOKEN=\"ntn_quoted_value\"\nDESCRIPTION='has = sign'\n",
    encoding="utf-8")
parsed = nc.parse_env_file(nc.env_path("quoted"))
check("store: quoted token", parsed["NOTION_TOKEN"], "ntn_quoted_value")
check("store: value keeps inner =", parsed["DESCRIPTION"], "has = sign")
expect_error("store: path traversal name", lambda: nc.env_path("../evil"))
expect_error("store: empty name", lambda: nc.check_name("  "))

# --- report ----------------------------------------------------------------
if fails:
    print(f"FAILED {len(fails)} check(s):\n")
    for f in fails:
        print(" - " + f)
    sys.exit(1)
print("ALL OFFLINE CHECKS PASSED")
