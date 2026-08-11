#!/usr/bin/env python3
"""MCP server for SAP ABAP Development Tools (ADT).

Exposes read-only / inspection capabilities of the ADT REST API as MCP tools:
object search, source retrieval (programs, classes, function modules, CDS),
package browsing, ABAP SQL data preview, syntax check, where-used analysis and
ATC (ABAP Test Cockpit) runs. No object-modifying operations are provided.

Connection settings are read from environment variables (see .env.example).
"""

from __future__ import annotations

import json
from enum import Enum
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field

from .client import AdtError, get_client
from .config import ConfigError
from . import parsing

mcp = FastMCP("sap_adt_mcp")

# Namespaces / content types used in request bodies.
_NS_ATC = "http://www.sap.com/adt/atc"
_NS_CORE = "http://www.sap.com/adt/core"
_NS_CHKRUN = "http://www.sap.com/adt/checkrun"
_NS_USAGE = "http://www.sap.com/adt/ris/usageReferences"


# --------------------------------------------------------------------------
# Shared models & helpers
# --------------------------------------------------------------------------


class ResponseFormat(str, Enum):
    """Output format for tool responses."""

    MARKDOWN = "markdown"
    JSON = "json"


class _Base(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        extra="forbid",
    )


def _handle_error(e: Exception) -> str:
    """Convert any client/HTTP error into an actionable message string."""
    if isinstance(e, ConfigError):
        return (
            f"Error: SAP connection is not configured. {e}\n"
            "Set the SAP_ADT_* environment variables (see .env.example)."
        )
    if isinstance(e, AdtError):
        return f"Error: {e}"
    if isinstance(e, httpx.HTTPStatusError):
        status = e.response.status_code
        detail = parsing.parse_error_message(e.response.text) or ""
        detail = f" {detail}" if detail else ""
        if status == 401:
            return (
                "Error: Authentication failed (401). Check SAP_ADT_USER / "
                "SAP_ADT_PASSWORD or SAP_ADT_TOKEN and the SAP client."
                + detail
            )
        if status == 403:
            return (
                "Error: Authorization denied (403). The user lacks ADT "
                "developer authorization for this object." + detail
            )
        if status == 404:
            return (
                "Error: Object not found (404). Verify the name/URI exists in "
                "this system." + detail
            )
        if status == 405:
            return "Error: Operation not supported on this object (405)." + detail
        return f"Error: ADT request failed with status {status}.{detail}"
    if isinstance(e, httpx.ConnectError):
        return (
            "Error: Could not connect to the SAP host. Check SAP_ADT_HOST, the "
            "port, VPN/network access and SAP_ADT_VERIFY_SSL."
        )
    if isinstance(e, httpx.TimeoutException):
        return "Error: Request timed out. The system may be busy; try again."
    return f"Error: Unexpected {type(e).__name__}: {e}"


def _source_uri(object_uri: str, include: Optional[str] = None) -> str:
    """Build the ``/source/<include>`` path from a bare object URI."""
    base = object_uri.rstrip("/")
    return f"{base}/source/{include or 'main'}"


# --------------------------------------------------------------------------
# Tool: connection check
# --------------------------------------------------------------------------


@mcp.tool(
    name="sap_adt_check_connection",
    annotations={
        "title": "Check SAP ADT Connection",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_check_connection() -> str:
    """Verify connectivity and authentication against the configured SAP system.

    Calls the ADT discovery endpoint. Use this first when other tools report
    auth/connection errors to confirm the environment is set up correctly.

    Returns:
        str: A short status line including the resolved host and client on
        success, or an "Error: ..." message describing what to fix.
    """
    try:
        client = get_client()
        await client.request("GET", "/sap/bc/adt/discovery", accept="application/*")
        cfg = client.config
        auth = "Bearer token" if cfg.uses_bearer else f"Basic ({cfg.user})"
        return (
            "Connected to SAP ADT.\n"
            f"- Host: {cfg.host}\n"
            f"- Client: {cfg.client or '(default)'}\n"
            f"- Language: {cfg.language}\n"
            f"- Auth: {auth}"
        )
    except Exception as e:  # noqa: BLE001 - converted to message
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: object search
# --------------------------------------------------------------------------


class SearchInput(_Base):
    query: str = Field(
        ...,
        description="Search string matched against object names, e.g. 'CL_HTTP*', "
        "'ZMY_PROG', 'scarr'. A trailing '*' acts as a wildcard.",
        min_length=1,
        max_length=120,
    )
    max_results: int = Field(
        default=25,
        description="Maximum number of objects to return (1-200).",
        ge=1,
        le=200,
    )
    object_type: Optional[str] = Field(
        default=None,
        description="Optional ADT type filter, e.g. 'CLAS/OC' (class), 'PROG/P' "
        "(program), 'TABL/DT' (table), 'DEVC/K' (package), 'FUGR/F' (function group).",
        max_length=20,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable list or 'json' for structured data.",
    )


@mcp.tool(
    name="sap_adt_search_objects",
    annotations={
        "title": "Search SAP Repository Objects",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_search_objects(params: SearchInput) -> str:
    """Search the ABAP repository for objects by name (quick search).

    This is the primary discovery tool. Each result includes the object's ADT
    ``uri`` which other tools (sap_adt_get_source, sap_adt_where_used,
    sap_adt_run_atc, sap_adt_syntax_check) consume directly.

    Args:
        params (SearchInput): query, max_results, optional object_type filter
            and response_format.

    Returns:
        str: Markdown or JSON. Each item has: name, type, uri, package,
        description. Returns "No objects found ..." when empty.
    """
    try:
        client = get_client()
        q = params.query
        request_params = {"operation": "quickSearch", "query": q, "maxResults": str(params.max_results)}
        if params.object_type:
            request_params["objectType"] = params.object_type
        xml = await client.get_xml(
            "/sap/bc/adt/repository/informationsystem/search",
            params=request_params,
        )
        results = parsing.parse_search_results(xml)
        if not results:
            return f"No objects found matching '{params.query}'."

        if params.response_format == ResponseFormat.JSON:
            return json.dumps({"count": len(results), "objects": results}, indent=2)

        lines = [f"# Search results for '{params.query}' ({len(results)})", ""]
        for r in results:
            lines.append(f"## {r['name']}  ({r['type']})")
            if r["description"]:
                lines.append(f"- {r['description']}")
            if r["package"]:
                lines.append(f"- Package: {r['package']}")
            lines.append(f"- URI: `{r['uri']}`")
            lines.append("")
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tools: source retrieval
# --------------------------------------------------------------------------


class GetSourceByUriInput(_Base):
    object_uri: str = Field(
        ...,
        description="ADT object URI from a search result, e.g. "
        "'/sap/bc/adt/oo/classes/cl_http_client' or "
        "'/sap/bc/adt/programs/programs/zmy_report'. Do NOT append '/source/main'.",
        min_length=4,
        max_length=400,
    )
    include: Optional[str] = Field(
        default=None,
        description="Source include to fetch. Defaults to 'main'. For classes also "
        "useful: 'definitions', 'implementations', 'macros', 'testclasses'.",
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_source",
    annotations={
        "title": "Get ABAP Source by URI",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_source(params: GetSourceByUriInput) -> str:
    """Fetch the ABAP source code for any source-bearing object by its ADT URI.

    Generic counterpart to the typed get_*_source tools. Pass the ``uri`` exactly
    as returned by sap_adt_search_objects; the tool appends '/source/<include>'.

    Args:
        params (GetSourceByUriInput): object_uri and optional include.

    Returns:
        str: Plain ABAP source text, or an "Error: ..." message.
    """
    try:
        client = get_client()
        return await client.get_text(_source_uri(params.object_uri, params.include))
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


class GetProgramInput(_Base):
    name: str = Field(
        ...,
        description="Program/report name, e.g. 'ZMY_REPORT' or 'RSPARAM'.",
        min_length=1,
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_program_source",
    annotations={
        "title": "Get ABAP Program Source",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_program_source(params: GetProgramInput) -> str:
    """Fetch the source code of an ABAP program / report by name.

    Args:
        params (GetProgramInput): name of the program.

    Returns:
        str: Plain ABAP source text, or an "Error: ..." message.
    """
    try:
        client = get_client()
        name = params.name.lower()
        return await client.get_text(f"/sap/bc/adt/programs/programs/{name}/source/main")
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


class GetClassInput(_Base):
    name: str = Field(
        ...,
        description="Global class name, e.g. 'CL_HTTP_CLIENT' or 'ZCL_MY_CLASS'.",
        min_length=1,
        max_length=40,
    )
    include: Optional[str] = Field(
        default=None,
        description="Class section to fetch. Default 'main' (the whole class). "
        "Others: 'definitions', 'implementations', 'macros', 'testclasses'.",
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_class_source",
    annotations={
        "title": "Get ABAP Class Source",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_class_source(params: GetClassInput) -> str:
    """Fetch the source code of a global ABAP class (OO) by name.

    Args:
        params (GetClassInput): class name and optional include/section.

    Returns:
        str: Plain ABAP source text, or an "Error: ..." message.
    """
    try:
        client = get_client()
        name = params.name.lower()
        include = params.include or "main"
        return await client.get_text(f"/sap/bc/adt/oo/classes/{name}/source/{include}")
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


class GetFunctionInput(_Base):
    group: str = Field(
        ...,
        description="Function group that owns the module, e.g. 'STRING_UTILITIES'.",
        min_length=1,
        max_length=40,
    )
    name: str = Field(
        ...,
        description="Function module name, e.g. 'STRING_SPLIT_AT_POSITION'.",
        min_length=1,
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_function_source",
    annotations={
        "title": "Get Function Module Source",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_function_source(params: GetFunctionInput) -> str:
    """Fetch the source code of a function module by its function group and name.

    Args:
        params (GetFunctionInput): function group and module name.

    Returns:
        str: Plain ABAP source text, or an "Error: ..." message.
    """
    try:
        client = get_client()
        group = params.group.lower()
        name = params.name.lower()
        return await client.get_text(
            f"/sap/bc/adt/functions/groups/{group}/fmodules/{name}/source/main"
        )
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


class GetCdsInput(_Base):
    name: str = Field(
        ...,
        description="CDS DDL source / view name, e.g. 'I_BUSINESSPARTNER' or "
        "'ZCDS_MY_VIEW'.",
        min_length=1,
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_cds_source",
    annotations={
        "title": "Get CDS View Source",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_cds_source(params: GetCdsInput) -> str:
    """Fetch the DDL source of a Core Data Services (CDS) view by name.

    Args:
        params (GetCdsInput): CDS DDL source name.

    Returns:
        str: Plain DDL source text, or an "Error: ..." message.
    """
    try:
        client = get_client()
        name = params.name.lower()
        return await client.get_text(
            f"/sap/bc/adt/ddic/ddl/sources/{name}/source/main"
        )
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


class GetTableInput(_Base):
    name: str = Field(
        ...,
        description="DDIC database table or structure name, e.g. 'SCARR', 'MARA'.",
        min_length=1,
        max_length=40,
    )


@mcp.tool(
    name="sap_adt_get_table_definition",
    annotations={
        "title": "Get DDIC Table Definition",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_table_definition(params: GetTableInput) -> str:
    """Fetch the Data Dictionary (DDIC) definition XML of a table or structure.

    Tables have no ABAP source; the ADT metadata XML describes fields, keys,
    data elements and the delivery class.

    Args:
        params (GetTableInput): table/structure name.

    Returns:
        str: The raw ADT table definition XML, or an "Error: ..." message.
    """
    try:
        client = get_client()
        name = params.name.lower()
        return await client.get_xml(f"/sap/bc/adt/ddic/tables/{name}")
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: package / node contents
# --------------------------------------------------------------------------


class PackageContentsInput(_Base):
    package: str = Field(
        ...,
        description="Development package (Paket) name, e.g. '$TMP', 'ZMY_PKG', "
        "'SABAPDEMOS'.",
        min_length=1,
        max_length=60,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable tree or 'json' for structured data.",
    )


@mcp.tool(
    name="sap_adt_get_package_contents",
    annotations={
        "title": "List Package Contents",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_get_package_contents(params: PackageContentsInput) -> str:
    """List the objects and sub-nodes directly contained in a development package.

    Use this to browse the repository tree. Nodes marked expandable=true are
    sub-folders/sub-packages that can be explored further.

    Args:
        params (PackageContentsInput): package name and response_format.

    Returns:
        str: Markdown or JSON list of nodes (name, type, uri, description,
        expandable), or an "Error: ..." message.
    """
    try:
        client = get_client()
        resp = await client.request(
            "POST",
            "/sap/bc/adt/repository/nodestructure",
            accept="application/xml",
            params={
                "parent_name": params.package.upper(),
                "parent_type": "DEVC/K",
                "withShortDescriptions": "true",
            },
        )
        nodes = parsing.parse_node_structure(resp.text)
        if not nodes:
            return f"Package '{params.package}' is empty or was not found."

        if params.response_format == ResponseFormat.JSON:
            return json.dumps({"package": params.package, "count": len(nodes), "nodes": nodes}, indent=2)

        lines = [f"# Contents of package '{params.package}' ({len(nodes)})", ""]
        for n in nodes:
            marker = " [expandable]" if n["expandable"] else ""
            desc = f" — {n['description']}" if n["description"] else ""
            lines.append(f"- **{n['name']}** ({n['type']}){marker}{desc}")
            if n["uri"]:
                lines.append(f"  - URI: `{n['uri']}`")
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: ABAP SQL data preview
# --------------------------------------------------------------------------


class DataPreviewInput(_Base):
    query: str = Field(
        ...,
        description="An ABAP SQL SELECT statement (Open SQL), e.g. "
        "'SELECT carrid, connid FROM spfli WHERE carrid = ''LH'''. "
        "Read-only: only SELECT is supported by the ADT data preview.",
        min_length=6,
        max_length=4000,
    )
    max_rows: int = Field(
        default=100,
        description="Maximum number of rows to return (1-1000).",
        ge=1,
        le=1000,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a table or 'json' for structured rows.",
    )


@mcp.tool(
    name="sap_adt_data_preview",
    annotations={
        "title": "Preview ABAP SQL Query Data",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_data_preview(params: DataPreviewInput) -> str:
    """Run a read-only ABAP SQL SELECT and return the result rows (Data Preview).

    Equivalent to the ADT "Data Preview" / SQL console. Only SELECT statements
    are accepted by the backend. Useful for inspecting table/CDS contents.

    Args:
        params (DataPreviewInput): SELECT query, max_rows and response_format.

    Returns:
        str: Markdown table or JSON ({total_rows, columns, rows}), or an
        "Error: ..." message (e.g. on invalid SQL syntax).
    """
    try:
        client = get_client()
        resp = await client.request(
            "POST",
            "/sap/bc/adt/datapreview/freestyle",
            accept="application/vnd.sap.adt.datapreview.table.v1+xml",
            content=params.query,
            content_type="text/plain",
            params={"rowNumber": str(params.max_rows)},
        )
        data = parsing.parse_data_preview(resp.text)
        rows = data["rows"]
        cols = data["columns"]

        if params.response_format == ResponseFormat.JSON:
            return json.dumps(data, indent=2, ensure_ascii=False)

        if not rows:
            return f"Query returned 0 rows (total reported: {data['total_rows']})."

        lines = [
            f"# Data preview ({len(rows)} rows, total {data['total_rows']})",
            "",
            "| " + " | ".join(cols) + " |",
            "| " + " | ".join("---" for _ in cols) + " |",
        ]
        for row in rows:
            lines.append(
                "| " + " | ".join(str(row.get(c, "") or "") for c in cols) + " |"
            )
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: syntax check
# --------------------------------------------------------------------------


class SyntaxCheckInput(_Base):
    object_uri: str = Field(
        ...,
        description="ADT object URI to check (from search), e.g. "
        "'/sap/bc/adt/programs/programs/zmy_report' or "
        "'/sap/bc/adt/oo/classes/zcl_my_class'. '/source/main' is appended "
        "automatically.",
        min_length=4,
        max_length=400,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable report or 'json' for structured messages.",
    )


@mcp.tool(
    name="sap_adt_syntax_check",
    annotations={
        "title": "Run ABAP Syntax Check",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_syntax_check(params: SyntaxCheckInput) -> str:
    """Run the ABAP syntax checker against the active version of an object.

    Args:
        params (SyntaxCheckInput): object_uri and response_format.

    Returns:
        str: Markdown/JSON list of messages (type E/W/I, text, uri). Reports
        "No syntax errors" when clean, or an "Error: ..." message.
    """
    try:
        client = get_client()
        source_uri = _source_uri(params.object_uri)
        body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<chkrun:checkObjectList xmlns:chkrun="{_NS_CHKRUN}" '
            f'xmlns:adtcore="{_NS_CORE}">'
            f'<chkrun:checkObject adtcore:uri="{source_uri}" '
            'chkrun:version="active"/>'
            "</chkrun:checkObjectList>"
        )
        resp = await client.request(
            "POST",
            "/sap/bc/adt/checkruns",
            accept="application/xml",
            content=body,
            content_type="application/xml",
            params={"reporters": "abapCheckRun"},
        )
        messages = parsing.parse_check_messages(resp.text)
        errors = [m for m in messages if m["type"].upper().startswith("E")]

        if params.response_format == ResponseFormat.JSON:
            return json.dumps(
                {"error_count": len(errors), "messages": messages}, indent=2
            )

        if not messages:
            return f"No syntax errors found for `{params.object_uri}`."
        lines = [f"# Syntax check: `{params.object_uri}`", ""]
        for m in messages:
            lines.append(f"- **{m['type'] or '?'}**: {m['text']}")
        lines.append("")
        lines.append(f"_{len(errors)} error(s), {len(messages)} message(s) total._")
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: where-used
# --------------------------------------------------------------------------


class WhereUsedInput(_Base):
    object_uri: str = Field(
        ...,
        description="ADT object URI to analyse (from search), e.g. "
        "'/sap/bc/adt/oo/classes/cl_http_client'.",
        min_length=4,
        max_length=400,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable list or 'json' for structured data.",
    )


@mcp.tool(
    name="sap_adt_where_used",
    annotations={
        "title": "Where-Used List",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,
    },
)
async def sap_adt_where_used(params: WhereUsedInput) -> str:
    """Find objects that reference (use) the given object (where-used list).

    Args:
        params (WhereUsedInput): object_uri and response_format.

    Returns:
        str: Markdown/JSON list of referencing objects (name, type, uri), or
        an "Error: ..." message.
    """
    try:
        client = get_client()
        body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<usagereferences:usageReferenceRequest xmlns:usagereferences="{_NS_USAGE}" '
            f'xmlns:adtcore="{_NS_CORE}">'
            "<usagereferences:affectedObjects/>"
            "</usagereferences:usageReferenceRequest>"
        )
        resp = await client.request(
            "POST",
            "/sap/bc/adt/repository/informationsystem/usageReferences",
            accept="application/xml",
            content=body,
            content_type="application/xml",
            params={"uri": params.object_uri},
        )
        refs = parsing.parse_usage_references(resp.text)
        if not refs:
            return f"No usages found for `{params.object_uri}`."

        if params.response_format == ResponseFormat.JSON:
            return json.dumps({"count": len(refs), "references": refs}, indent=2)

        lines = [f"# Where-used: `{params.object_uri}` ({len(refs)})", ""]
        for r in refs:
            desc = f" — {r['description']}" if r["description"] else ""
            lines.append(f"- **{r['name']}** ({r['type']}){desc}")
            if r["uri"]:
                lines.append(f"  - URI: `{r['uri']}`")
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Tool: ATC run
# --------------------------------------------------------------------------


class AtcRunInput(_Base):
    object_uri: str = Field(
        ...,
        description="ADT object URI to check with ATC (from search), e.g. a class, "
        "program or package URI.",
        min_length=4,
        max_length=400,
    )
    check_variant: Optional[str] = Field(
        default=None,
        description="ATC check variant name. Defaults to SAP_ADT_ATC_VARIANT "
        "(env, typically 'DEFAULT').",
        max_length=40,
    )
    max_results: int = Field(
        default=100,
        description="Maximum number of ATC findings to return (1-1000).",
        ge=1,
        le=1000,
    )
    response_format: ResponseFormat = Field(
        default=ResponseFormat.MARKDOWN,
        description="'markdown' for a readable report or 'json' for structured findings.",
    )


@mcp.tool(
    name="sap_adt_run_atc",
    annotations={
        "title": "Run ABAP Test Cockpit (ATC)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def sap_adt_run_atc(params: AtcRunInput) -> str:
    """Run ABAP Test Cockpit (ATC) static checks on an object and return findings.

    Performs the full ADT ATC flow: create a worklist for the check variant,
    trigger a run scoped to the object, then read the resulting findings. Does
    not modify any repository object.

    Args:
        params (AtcRunInput): object_uri, optional check_variant, max_results
            and response_format.

    Returns:
        str: Markdown/JSON list of findings (priority, check, message, uri).
        "No ATC findings" when clean, or an "Error: ..." message. Note: ATC must
        be configured in the system and the check variant must exist.
    """
    try:
        client = get_client()
        variant = params.check_variant or client.config.atc_variant

        # 1) Create a worklist for the given check variant; body is the new id.
        worklist_resp = await client.request(
            "POST",
            "/sap/bc/adt/atc/worklists",
            accept="text/plain",
            params={"checkVariant": variant},
        )
        worklist_id = worklist_resp.text.strip()
        if not worklist_id:
            return (
                "Error: ATC did not return a worklist id. Verify the check "
                f"variant '{variant}' exists (set SAP_ADT_ATC_VARIANT or pass "
                "check_variant)."
            )

        # 2) Trigger the run scoped to the requested object.
        run_body = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<atc:run xmlns:atc="{_NS_ATC}" maximumVerdicts="{params.max_results}">'
            f'<objectSets xmlns:adtcore="{_NS_CORE}">'
            '<objectSet kind="inclusive">'
            "<adtcore:objectReferences>"
            f'<adtcore:objectReference adtcore:uri="{params.object_uri}"/>'
            "</adtcore:objectReferences>"
            "</objectSet>"
            "</objectSets>"
            "</atc:run>"
        )
        await client.request(
            "POST",
            "/sap/bc/adt/atc/runs",
            accept="application/xml",
            content=run_body,
            content_type="application/xml",
            params={"worklistId": worklist_id},
        )

        # 3) Read the worklist findings.
        result_resp = await client.request(
            "GET",
            f"/sap/bc/adt/atc/worklists/{worklist_id}",
            accept="application/xml",
            params={"includeExemptedFindings": "false"},
        )
        findings = parsing.parse_atc_findings(result_resp.text)

        if params.response_format == ResponseFormat.JSON:
            return json.dumps(
                {"variant": variant, "count": len(findings), "findings": findings},
                indent=2,
            )

        if not findings:
            return f"No ATC findings for `{params.object_uri}` (variant '{variant}')."
        lines = [
            f"# ATC findings: `{params.object_uri}` ({len(findings)}, variant '{variant}')",
            "",
        ]
        for f in findings:
            prio = f["priority"] or "?"
            lines.append(f"- **Prio {prio}** [{f['check']}] {f['message']}")
            if f["uri"]:
                lines.append(f"  - {f['uri']}")
        return "\n".join(lines)
    except Exception as e:  # noqa: BLE001
        return _handle_error(e)


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------


def main() -> None:
    """Run the MCP server over stdio transport."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
