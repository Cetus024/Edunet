from __future__ import annotations

import asyncio
import secrets
import time
from dataclasses import dataclass


class InvalidSessionToken(Exception):
    pass


class SessionLimitReached(Exception):
    pass


@dataclass(frozen=True, slots=True)
class SessionGrant:
    token: str
    expires_at: float
    client_ip: str
    origin: str


class SessionRegistry:
    def __init__(self, ttl_seconds: int, max_connections_per_ip: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_connections_per_ip = max_connections_per_ip
        self._grants: dict[str, SessionGrant] = {}
        self._active_by_ip: dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def create(self, client_ip: str, origin: str) -> SessionGrant:
        async with self._lock:
            self._remove_expired_locked()
            token = secrets.token_urlsafe(32)
            grant = SessionGrant(
                token=token,
                expires_at=time.time() + self._ttl_seconds,
                client_ip=client_ip,
                origin=origin,
            )
            self._grants[token] = grant
            return grant

    async def consume(self, token: str, client_ip: str, origin: str) -> SessionGrant:
        async with self._lock:
            self._remove_expired_locked()
            grant = self._grants.pop(token, None)
            if (
                grant is None
                or grant.expires_at <= time.time()
                or grant.client_ip != client_ip
                or grant.origin != origin
            ):
                raise InvalidSessionToken

            active = self._active_by_ip.get(client_ip, 0)
            if active >= self._max_connections_per_ip:
                raise SessionLimitReached
            self._active_by_ip[client_ip] = active + 1
            return grant

    async def release(self, client_ip: str) -> None:
        async with self._lock:
            active = self._active_by_ip.get(client_ip, 0)
            if active <= 1:
                self._active_by_ip.pop(client_ip, None)
            else:
                self._active_by_ip[client_ip] = active - 1

    def _remove_expired_locked(self) -> None:
        now = time.time()
        expired = [token for token, grant in self._grants.items() if grant.expires_at <= now]
        for token in expired:
            self._grants.pop(token, None)

