# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
SSRF (Server-Side Request Forgery) protection with DNS pinning.

Validates URLs and resolved IPs to prevent requests to internal/private networks.
Uses DNS pinning (pre-resolved IP → transport binding) to prevent DNS rebinding,
and manual redirect handling to validate each hop independently.
"""
import asyncio
import ipaddress
import logging
import math
import socket
from typing import Any
from urllib.parse import urljoin, urlparse

import anyio
import anyio.abc
from anyio.streams.tls import TLSStream

import httpcore
import httpx
import ssl as ssl_module

from src.config import settings

logger = logging.getLogger(__name__)

_BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
}
_BLOCKED_HOSTNAME_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
)

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}
MAX_REDIRECTS = 5


class SSRFError(Exception):
    """Raised when a URL is blocked by SSRF protection."""


def _is_private_ip(ip_str: str) -> bool:
    """Check if an IP address is private, reserved, loopback, or link-local."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # Unparseable → block

    if isinstance(addr, ipaddress.IPv4Address):
        return (
            addr.is_private
            or addr.is_reserved
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_multicast
            or addr in ipaddress.IPv4Network("0.0.0.0/8")
            or addr in ipaddress.IPv4Network("100.64.0.0/10")
        )

    # IPv6
    if isinstance(addr, ipaddress.IPv6Address):
        # Check IPv4-mapped IPv6 (::ffff:x.x.x.x)
        if addr.ipv4_mapped:
            return _is_private_ip(str(addr.ipv4_mapped))
        return (
            addr.is_private
            or addr.is_reserved
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_multicast
        )

    return True  # Unknown type → block


def _check_hostname(hostname: str) -> None:
    """Validate hostname against blocklist."""
    lower = hostname.lower().strip(".")
    if lower in _BLOCKED_HOSTNAMES:
        raise SSRFError(f"Blocked hostname: {hostname}")
    for suffix in _BLOCKED_HOSTNAME_SUFFIXES:
        if lower.endswith(suffix):
            raise SSRFError(f"Blocked hostname: {hostname}")


def _check_ip(ip_str: str) -> None:
    """Validate an IP address is not private/reserved."""
    if _is_private_ip(ip_str):
        raise SSRFError(f"Blocked private/reserved IP: {ip_str}")


def _effective_timeout(timeout: float | None) -> float:
    """Convert optional timeout to a value safe for anyio.fail_after."""
    return timeout if timeout is not None else math.inf


class _AnyIOStream(httpcore.AsyncNetworkStream):
    """Wraps an anyio ByteStream as an httpcore AsyncNetworkStream."""

    def __init__(self, stream: anyio.abc.ByteStream) -> None:
        self._stream = stream

    async def read(self, max_bytes: int, timeout: float | None = None) -> bytes:
        with anyio.fail_after(_effective_timeout(timeout)):
            try:
                return await self._stream.receive(max_bytes)
            except anyio.EndOfStream:
                return b""

    async def write(self, buffer: bytes, timeout: float | None = None) -> None:
        with anyio.fail_after(_effective_timeout(timeout)):
            await self._stream.send(buffer)

    async def aclose(self) -> None:
        await self._stream.aclose()

    async def start_tls(
        self,
        ssl_context: ssl_module.SSLContext,
        server_hostname: str | None = None,
        timeout: float | None = None,
    ) -> "httpcore.AsyncNetworkStream":
        with anyio.fail_after(_effective_timeout(timeout)):
            tls = await TLSStream.wrap(
                self._stream,
                ssl_context=ssl_context,
                hostname=server_hostname,
                standard_compatible=False,
            )
            return _AnyIOStream(tls)


class _PinnedNetworkBackend(httpcore.AsyncNetworkBackend):
    """Network backend that routes TCP connections through pre-resolved IPs.

    This prevents DNS rebinding (TOCTOU) attacks by ensuring the actual
    TCP connection goes to the IP address we validated, not a potentially
    different address from a second DNS lookup.
    """

    def __init__(self, address_map: dict[str, str]) -> None:
        self._address_map = address_map

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Any = None,
    ) -> httpcore.AsyncNetworkStream:
        target = self._address_map.get(host, host)
        with anyio.fail_after(_effective_timeout(timeout)):
            stream = await anyio.connect_tcp(target, port, local_host=local_address)
            return _AnyIOStream(stream)


def validate_url(url: str) -> str:
    """Validate a URL for SSRF safety (synchronous, no DNS resolution).

    Checks protocol, hostname blocklist, and IP literals.
    For full validation including DNS, use validate_url_async().

    Args:
        url (str): The URL to validate.

    Returns:
        str: The validated URL (unchanged) if it passes all checks.

    Raises:
        SSRFError: If the URL uses a blocked protocol, has a blocked hostname,
            or resolves to a private/reserved IP literal.
    """
    if not settings.SSRF_PROTECTION_ENABLED:
        return url

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"Blocked protocol: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("Missing hostname in URL")

    _check_hostname(hostname)

    try:
        ipaddress.ip_address(hostname)
        _check_ip(hostname)
    except ValueError:
        pass  # Not an IP literal, DNS will be checked in validate_url_async

    return url


async def validate_url_async(url: str) -> str:
    """Validate a URL for SSRF safety with async DNS resolution.

    Checks protocol, hostname blocklist, resolved IP addresses.
    DNS resolution runs in a thread pool to avoid blocking the event loop.

    Args:
        url (str): The URL to validate.

    Returns:
        str: The validated URL (unchanged) if it passes all checks.

    Raises:
        SSRFError: If the URL uses a blocked protocol, has a blocked hostname,
            resolves to a private/reserved IP, or DNS resolution fails.
    """
    if not settings.SSRF_PROTECTION_ENABLED:
        return url

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"Blocked protocol: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("Missing hostname in URL")

    _check_hostname(hostname)

    try:
        ipaddress.ip_address(hostname)
        _check_ip(hostname)
        return url
    except ValueError:
        pass  # Not an IP literal, continue to DNS resolution

    loop = asyncio.get_running_loop()
    try:
        addrinfos = await loop.run_in_executor(
            None,
            lambda: socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM),
        )
    except socket.gaierror:
        raise SSRFError(f"DNS resolution failed for: {hostname}")

    if not addrinfos:
        raise SSRFError(f"DNS resolution returned no results for: {hostname}")

    for _family, _type, _proto, _canonname, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        _check_ip(ip_str)

    return url


async def _resolve_and_pin(hostname: str) -> dict[str, str]:
    """Resolve hostname, validate all IPs, return {hostname: pinned_ip} map.

    Raises SSRFError if DNS fails or any resolved IP is private/reserved.
    """
    loop = asyncio.get_running_loop()
    try:
        addrinfos = await loop.run_in_executor(
            None,
            lambda: socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM),
        )
    except socket.gaierror:
        raise SSRFError(f"DNS resolution failed for: {hostname}")

    if not addrinfos:
        raise SSRFError(f"DNS resolution returned no results for: {hostname}")

    seen: set[str] = set()
    valid_ips: list[str] = []
    for _family, _type, _proto, _canonname, sockaddr in addrinfos:
        ip_str = sockaddr[0]
        _check_ip(ip_str)
        if ip_str not in seen:
            seen.add(ip_str)
            valid_ips.append(ip_str)

    if not valid_ips:
        raise SSRFError(f"No valid public IPs for: {hostname}")

    return {hostname: valid_ips[0]}


def _create_pinned_transport(address_map: dict[str, str]) -> httpx.AsyncHTTPTransport:
    """Create an httpx transport pinned to pre-resolved IP addresses.

    The transport's connection pool uses a custom network backend that
    connects to the pinned IP, while TLS SNI and certificate validation
    still use the original hostname.
    """
    transport = httpx.AsyncHTTPTransport()
    transport._pool = httpcore.AsyncConnectionPool(  # type: ignore[attr-defined]
        network_backend=_PinnedNetworkBackend(address_map),
    )
    return transport


async def fetch_with_ssrf_guard(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    max_redirects: int = MAX_REDIRECTS,
    timeout: float = 30.0,
) -> httpx.Response:
    """Fetch URL with SSRF protection, DNS pinning, and manual redirect handling.

    For each hop (including redirects):
      1. Validates protocol, hostname blocklist, IP literals
      2. Resolves DNS and validates all resolved IPs
      3. Pins transport to the validated IP (prevents DNS rebinding)
      4. Makes the request through the pinned connection

    Prevents DNS rebinding, redirect-based SSRF, redirect loops,
    and excessive redirects.

    Args:
        url (str): The URL to fetch.
        headers (dict[str, str] | None): Optional HTTP headers to include
            in the request.
        max_redirects (int): Maximum number of redirects to follow.
        timeout (float): Request timeout in seconds.

    Returns:
        httpx.Response: The HTTP response from the final (non-redirect) hop.

    Raises:
        SSRFError: If any hop in the redirect chain fails SSRF validation,
            a redirect loop is detected, or the redirect limit is exceeded.
    """
    if not settings.SSRF_PROTECTION_ENABLED:
        async with httpx.AsyncClient(timeout=timeout, headers=headers or {}) as client:
            return await client.get(url)

    visited: set[str] = set()
    current_url = url
    redirect_count = 0

    while True:
        parsed = urlparse(current_url)

        if parsed.scheme not in ("http", "https"):
            raise SSRFError(f"Blocked protocol: {parsed.scheme}")

        hostname = parsed.hostname
        if not hostname:
            raise SSRFError("Missing hostname in URL")

        _check_hostname(hostname)

        try:
            ipaddress.ip_address(hostname)
            _check_ip(hostname)
            # IP literal: pin to itself
            address_map = {hostname: hostname}
        except ValueError:
            # Hostname: resolve DNS and pin
            address_map = await _resolve_and_pin(hostname)

        transport = _create_pinned_transport(address_map)

        async with httpx.AsyncClient(
            transport=transport,
            follow_redirects=False,
            timeout=timeout,
            headers=headers or {},
        ) as client:
            response = await client.get(current_url)

        if response.status_code not in _REDIRECT_STATUSES:
            return response

        location = response.headers.get("location")
        if not location:
            raise SSRFError(
                f"Redirect missing Location header ({response.status_code})"
            )

        redirect_count += 1
        if redirect_count > max_redirects:
            raise SSRFError(f"Too many redirects (limit: {max_redirects})")

        next_url = urljoin(current_url, location)

        if next_url in visited:
            raise SSRFError("Redirect loop detected")

        visited.add(next_url)
        current_url = next_url
