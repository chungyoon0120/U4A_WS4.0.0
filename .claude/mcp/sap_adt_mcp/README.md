# SAP ADT MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes **SAP ABAP Development Tools (ADT)** over its REST API as tools for LLM agents (Claude Desktop, Claude Code, etc.).

This server is **read-only / inspection only** — it never modifies, locks, activates, or transports repository objects.

## Features (tools)

| Tool | Description |
| --- | --- |
| `sap_adt_check_connection` | Verify host/auth connectivity (call this first when debugging). |
| `sap_adt_search_objects` | Quick-search the ABAP repository by name (returns ADT URIs). |
| `sap_adt_get_source` | Fetch ABAP source for any object by its ADT URI. |
| `sap_adt_get_program_source` | Fetch a program/report source by name. |
| `sap_adt_get_class_source` | Fetch a global class source by name (with section/include). |
| `sap_adt_get_function_source` | Fetch a function module source by group + name. |
| `sap_adt_get_cds_source` | Fetch a CDS view DDL source by name. |
| `sap_adt_get_table_definition` | Fetch DDIC table/structure definition XML. |
| `sap_adt_get_package_contents` | List objects/sub-nodes inside a development package. |
| `sap_adt_data_preview` | Run a read-only ABAP SQL `SELECT` and return rows. |
| `sap_adt_syntax_check` | Run the ABAP syntax checker on an object. |
| `sap_adt_where_used` | Where-used list for an object. |
| `sap_adt_run_atc` | Run ABAP Test Cockpit (ATC) static checks and return findings. |

## Requirements

- Python 3.10+
- A SAP system with the **ADT services activated** in transaction `SICF` under
  `/sap/bc/adt`, and a user with ADT developer authorization.

## Setup

```bash
# from the project root
uv sync
# or, with pip:
#   python -m venv .venv && .venv\Scripts\activate
#   pip install -e .
```

## Configuration

Copy `.env.example` to `.env` and fill in your system. The server reads these
environment variables:

| Variable | Required | Description |
| --- | --- | --- |
| `SAP_ADT_HOST` | ✅ | Base URL incl. scheme + port, e.g. `https://host.corp.com:44300` |
| `SAP_ADT_CLIENT` | usually | SAP client/mandant, e.g. `100` |
| `SAP_ADT_LANGUAGE` |  | Logon language (default `EN`) |
| `SAP_ADT_USER` | Basic | Username (Basic auth) |
| `SAP_ADT_PASSWORD` | Basic | Password (Basic auth) |
| `SAP_ADT_TOKEN` | OAuth | Bearer token — takes precedence over Basic if set |
| `SAP_ADT_VERIFY_SSL` |  | `false` to skip TLS verification (dev only). Default `true` |
| `SAP_ADT_TIMEOUT` |  | Request timeout in seconds (default `60`) |
| `SAP_ADT_ATC_VARIANT` |  | Default ATC check variant (default `DEFAULT`) |

## Running

```bash
# stdio transport (for MCP clients)
uv run sap-adt-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "sap-adt": {
      "command": "uv",
      "args": ["--directory", "D:\\workspace\\sap_adt_mcp_server_py", "run", "sap-adt-mcp"],
      "env": {
        "SAP_ADT_HOST": "https://my-sap-host.corp.com:44300",
        "SAP_ADT_CLIENT": "100",
        "SAP_ADT_USER": "DEVELOPER",
        "SAP_ADT_PASSWORD": "changeme",
        "SAP_ADT_VERIFY_SSL": "false"
      }
    }
  }
}
```

### MCP Inspector (manual testing)

```bash
npx @modelcontextprotocol/inspector uv run sap-adt-mcp
```

## How it works

- Authenticates with Basic auth or a Bearer token.
- Adds `sap-client` / `sap-language` to every request.
- Fetches and refreshes the ADT **CSRF token** automatically (required even for
  read-only `POST` endpoints such as data preview, where-used and ATC).
- Reuses cookies so the ADT session is shared across calls.

## Security notes

- Store credentials outside source control (`.env` is git-ignored).
- Disabling `SAP_ADT_VERIFY_SSL` is for trusted dev systems only.
- All tools are read-only; the data preview backend rejects anything but `SELECT`.

## Limitations

- ATC requires ATC to be configured in the target system and a valid check
  variant; otherwise `sap_adt_run_atc` returns an actionable error.
- Source retrieval helpers cover the common object types; use
  `sap_adt_get_source` with a URI from `sap_adt_search_objects` for anything else.
