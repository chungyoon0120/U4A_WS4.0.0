"""Parsers for the various XML payloads returned by the ADT REST API.

ADT responses use many namespaces (adtcore, dataPreview, chkrun, atcfinding,
...). To stay robust against namespace/prefix variation across SAP releases we
match on *local* element/attribute names rather than fully-qualified names.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any


def _local(tag: str) -> str:
    """Strip the ``{namespace}`` prefix from an element/attribute tag."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _attrs(elem: ET.Element) -> dict[str, str]:
    """Return element attributes keyed by their local (un-namespaced) name."""
    return {_local(k): v for k, v in elem.attrib.items()}


def _iter_local(root: ET.Element, localname: str):
    for elem in root.iter():
        if _local(elem.tag) == localname:
            yield elem


def _child_text_map(elem: ET.Element) -> dict[str, str]:
    return {_local(c.tag): (c.text or "") for c in elem}


def parse_error_message(body: str) -> str | None:
    """Extract the human-readable message from an ADT error XML payload."""
    if not body:
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None
    for elem in root.iter():
        if _local(elem.tag) in ("message", "localizedMessage") and elem.text:
            return elem.text.strip()
    return None


def parse_search_results(xml: str) -> list[dict[str, str]]:
    """Parse ``repository/informationsystem/search`` object references."""
    root = ET.fromstring(xml)
    results: list[dict[str, str]] = []
    for ref in _iter_local(root, "objectReference"):
        a = _attrs(ref)
        results.append(
            {
                "name": a.get("name", ""),
                "type": a.get("type", ""),
                "uri": a.get("uri", ""),
                "package": a.get("packageName", ""),
                "description": a.get("description", ""),
            }
        )
    return results


def parse_node_structure(xml: str) -> list[dict[str, str]]:
    """Parse ``repository/nodestructure`` (package / node contents)."""
    root = ET.fromstring(xml)
    nodes: list[dict[str, str]] = []
    for node in _iter_local(root, "SEU_ADT_REPOSITORY_OBJ_NODE"):
        c = _child_text_map(node)
        nodes.append(
            {
                "name": c.get("OBJECT_NAME", ""),
                "type": c.get("OBJECT_TYPE", ""),
                "uri": c.get("OBJECT_URI", ""),
                "description": c.get("DESCRIPTION", ""),
                "expandable": c.get("EXPANDABLE", "").strip().upper() in ("X", "TRUE"),
            }
        )
    return nodes


def parse_data_preview(xml: str) -> dict[str, Any]:
    """Parse ``datapreview/freestyle`` results into row-oriented data.

    Returns a dict with keys: ``total_rows`` (int), ``columns`` (list of column
    names) and ``rows`` (list of dicts mapping column name -> value).
    """
    root = ET.fromstring(xml)

    total_rows = 0
    for elem in _iter_local(root, "totalRows"):
        try:
            total_rows = int((elem.text or "0").strip())
        except ValueError:
            total_rows = 0
        break

    columns: list[dict[str, Any]] = []
    for col in _iter_local(root, "columns"):
        meta: dict[str, str] = {}
        data: list[str] = []
        for child in col:
            ln = _local(child.tag)
            if ln == "metadata":
                meta = _attrs(child)
            elif ln == "dataSet":
                data = [
                    (d.text or "") for d in child if _local(d.tag) == "data"
                ]
        columns.append({"name": meta.get("name", "?"), "data": data})

    col_names = [c["name"] for c in columns]
    n = max((len(c["data"]) for c in columns), default=0)
    rows: list[dict[str, Any]] = []
    for i in range(n):
        rows.append(
            {c["name"]: (c["data"][i] if i < len(c["data"]) else None) for c in columns}
        )

    return {"total_rows": total_rows, "columns": col_names, "rows": rows}


def parse_check_messages(xml: str) -> list[dict[str, str]]:
    """Parse ``checkruns`` (syntax check) messages."""
    root = ET.fromstring(xml)
    messages: list[dict[str, str]] = []
    for msg in _iter_local(root, "checkMessage"):
        a = _attrs(msg)
        messages.append(
            {
                "type": a.get("type", ""),
                "text": a.get("shortText", ""),
                "uri": a.get("uri", ""),
                "category": a.get("category", ""),
            }
        )
    return messages


def parse_usage_references(xml: str) -> list[dict[str, str]]:
    """Parse ``usageReferences`` (where-used) results."""
    root = ET.fromstring(xml)
    refs: list[dict[str, str]] = []
    for obj in _iter_local(root, "referencedObject"):
        # The describing ADT object reference sits in a child element.
        adt = None
        for child in obj:
            if _local(child.tag) in ("adtObject", "objectReference"):
                adt = _attrs(child)
                break
        a = adt or _attrs(obj)
        refs.append(
            {
                "name": a.get("name", ""),
                "type": a.get("type", ""),
                "uri": a.get("uri", ""),
                "description": a.get("description", a.get("parentUri", "")),
            }
        )
    return refs


def parse_atc_findings(xml: str) -> list[dict[str, str]]:
    """Parse an ATC worklist into a flat list of findings."""
    root = ET.fromstring(xml)
    findings: list[dict[str, str]] = []
    for finding in _iter_local(root, "finding"):
        a = _attrs(finding)
        findings.append(
            {
                "priority": a.get("priority", ""),
                "check": a.get("checkTitle", ""),
                "message": a.get("messageTitle", ""),
                "uri": a.get("uri", a.get("location", "")),
            }
        )
    return findings
