"""Configuration loading for the SAP ADT MCP server.

All configuration comes from environment variables (see .env.example). The
config is read lazily when the ADT client is first constructed so that simply
importing the server (e.g. for ``--help``) never fails on a missing variable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Project root = two levels up from this file (src/sap_adt_mcp/config.py).
_PROJECT_ROOT = Path(__file__).resolve().parents[2]

_env_loaded = False


class ConfigError(RuntimeError):
    """Raised when the SAP connection is not configured correctly."""


def load_env_files() -> list[str]:
    """Load connection settings from .env / .env.example into the environment.

    Searched in this precedence order (highest first); already-set process
    environment variables always win, so secrets exported in the shell or set
    by the MCP client are never overwritten:

        1. ``$SAP_ADT_ENV_FILE`` (explicit override, if set)
        2. ``./.env``                / ``<project>/.env``
        3. ``./.env.example``        / ``<project>/.env.example``

    Each existing file is loaded with ``override=False`` so the first value
    found for a key wins. Idempotent — only runs once per process.

    Returns:
        list[str]: absolute paths of the env files that were actually loaded.
    """
    global _env_loaded
    if _env_loaded:
        return []
    _env_loaded = True

    cwd = Path.cwd()
    candidates: list[Path] = []

    explicit = os.environ.get("SAP_ADT_ENV_FILE")
    if explicit:
        candidates.append(Path(explicit))

    for name in (".env", ".env.example"):
        candidates.append(cwd / name)
        candidates.append(_PROJECT_ROOT / name)

    loaded: list[str] = []
    seen: set[Path] = set()
    for path in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            continue
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved.is_file():
            load_dotenv(resolved, override=False)
            loaded.append(str(resolved))
    return loaded


def _get(*names: str, default: str | None = None) -> str | None:
    """Return the first non-empty environment variable among ``names``."""
    for name in names:
        value = os.environ.get(name)
        if value is not None and value.strip() != "":
            return value.strip()
    return default


def _get_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class AdtConfig:
    """Resolved connection settings for a single SAP system."""

    host: str
    client: str | None
    language: str
    user: str | None
    password: str | None
    token: str | None
    verify_ssl: bool
    timeout: float
    atc_variant: str

    @property
    def uses_bearer(self) -> bool:
        return bool(self.token)


def load_config() -> AdtConfig:
    """Read and validate configuration from the environment.

    Raises:
        ConfigError: if the host or a usable authentication method is missing.
    """
    load_env_files()

    host = _get("SAP_ADT_HOST", "SAP_HOST")
    if not host:
        raise ConfigError(
            "Missing SAP host. Set SAP_ADT_HOST to the system base URL, "
            "e.g. https://my-sap-host.corp.com:44300"
        )
    host = host.rstrip("/")

    token = _get("SAP_ADT_TOKEN")
    user = _get("SAP_ADT_USER", "SAP_USER")
    password = _get("SAP_ADT_PASSWORD", "SAP_PASSWORD")

    if not token and not (user and password):
        raise ConfigError(
            "Missing credentials. Provide either SAP_ADT_TOKEN (Bearer) or "
            "both SAP_ADT_USER and SAP_ADT_PASSWORD (Basic auth)."
        )

    try:
        timeout = float(_get("SAP_ADT_TIMEOUT", default="60"))
    except ValueError:
        timeout = 60.0

    return AdtConfig(
        host=host,
        client=_get("SAP_ADT_CLIENT", "SAP_CLIENT"),
        language=_get("SAP_ADT_LANGUAGE", "SAP_LANGUAGE", default="EN"),
        user=user,
        password=password,
        token=token,
        verify_ssl=_get_bool("SAP_ADT_VERIFY_SSL", True),
        timeout=timeout,
        atc_variant=_get("SAP_ADT_ATC_VARIANT", default="DEFAULT"),
    )
