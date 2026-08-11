"""Async HTTP client for the SAP ADT REST API.

The :class:`AdtClient` wraps a single ``httpx.AsyncClient`` and handles the
cross-cutting concerns of talking to ADT:

* Basic or Bearer authentication.
* ``sap-client`` / ``sap-language`` query parameters on every request.
* CSRF token fetching + automatic refresh for non-GET requests (ADT requires
  ``x-csrf-token`` even for read-only POSTs such as data preview and
  where-used).
* Persistent cookies so the stateless ADT session is reused across calls.

A module-level singleton is exposed via :func:`get_client` so all tools share
one connection pool and one CSRF token.
"""

from __future__ import annotations

import asyncio
from typing import Mapping

import httpx

from .config import AdtConfig, load_config

# ADT endpoint used purely to obtain a CSRF token and verify connectivity.
_DISCOVERY_PATH = "/sap/bc/adt/discovery"


class AdtError(RuntimeError):
    """Raised for ADT-specific failures with a human-readable message."""


class AdtClient:
    """Thin async wrapper around the ADT REST API for one SAP system."""

    def __init__(self, config: AdtConfig) -> None:
        self._config = config
        self._client: httpx.AsyncClient | None = None
        self._csrf_token: str | None = None
        self._csrf_lock = asyncio.Lock()

    @property
    def config(self) -> AdtConfig:
        return self._config

    # -- lifecycle ---------------------------------------------------------

    def _build_client(self) -> httpx.AsyncClient:
        auth = None
        headers: dict[str, str] = {
            "User-Agent": "sap-adt-mcp-server/0.1",
        }
        if self._config.uses_bearer:
            headers["Authorization"] = f"Bearer {self._config.token}"
        else:
            auth = httpx.BasicAuth(self._config.user or "", self._config.password or "")

        return httpx.AsyncClient(
            base_url=self._config.host,
            auth=auth,
            headers=headers,
            verify=self._config.verify_ssl,
            timeout=self._config.timeout,
            follow_redirects=True,
        )

    async def _get_async_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = self._build_client()
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # -- helpers -----------------------------------------------------------

    def _common_params(self) -> dict[str, str]:
        params: dict[str, str] = {}
        if self._config.client:
            params["sap-client"] = self._config.client
        if self._config.language:
            params["sap-language"] = self._config.language
        return params

    async def _ensure_csrf(self) -> None:
        if self._csrf_token is not None:
            return
        async with self._csrf_lock:
            if self._csrf_token is not None:
                return
            client = await self._get_async_client()
            resp = await client.get(
                _DISCOVERY_PATH,
                headers={"x-csrf-token": "fetch", "Accept": "application/*"},
                params=self._common_params(),
            )
            resp.raise_for_status()
            token = resp.headers.get("x-csrf-token")
            if not token:
                raise AdtError(
                    "SAP did not return a CSRF token. The user may lack ADT "
                    "developer authorization, or the endpoint is not an ADT host."
                )
            self._csrf_token = token

    # -- core request ------------------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        *,
        accept: str | None = None,
        content: str | bytes | None = None,
        content_type: str | None = None,
        params: Mapping[str, str] | None = None,
    ) -> httpx.Response:
        """Issue an ADT request, handling CSRF + common params.

        Raises:
            httpx.HTTPStatusError: on a non-2xx response (after one CSRF retry).
            AdtError: when a CSRF token cannot be obtained.
        """
        client = await self._get_async_client()
        method = method.upper()

        req_params = self._common_params()
        if params:
            req_params.update(params)

        headers: dict[str, str] = {}
        if accept:
            headers["Accept"] = accept
        if content_type:
            headers["Content-Type"] = content_type

        if method != "GET":
            await self._ensure_csrf()
            headers["x-csrf-token"] = self._csrf_token or ""

        resp = await client.request(
            method, path, headers=headers, params=req_params, content=content
        )

        # ADT replies 403 with `x-csrf-token: Required` when the token expired.
        if (
            resp.status_code == 403
            and method != "GET"
            and "required" in resp.headers.get("x-csrf-token", "").lower()
        ):
            self._csrf_token = None
            await self._ensure_csrf()
            headers["x-csrf-token"] = self._csrf_token or ""
            resp = await client.request(
                method, path, headers=headers, params=req_params, content=content
            )

        resp.raise_for_status()
        return resp

    async def get_text(self, path: str, *, accept: str = "text/plain", **kw) -> str:
        resp = await self.request("GET", path, accept=accept, **kw)
        return resp.text

    async def get_xml(self, path: str, *, accept: str = "application/xml", **kw) -> str:
        resp = await self.request("GET", path, accept=accept, **kw)
        return resp.text


# -- module-level singleton ------------------------------------------------

_client_singleton: AdtClient | None = None


def get_client() -> AdtClient:
    """Return the shared AdtClient, constructing it from env on first use."""
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = AdtClient(load_config())
    return _client_singleton
