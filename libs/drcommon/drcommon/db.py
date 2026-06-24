"""Async Postgres access via a single asyncpg pool per service.

Each service owns its own database (no shared tables), so this module is just a
thin, defensive wrapper: connect with retry because Postgres may still be coming
up under ``docker compose up``, run idempotent migrations on boot, and expose a
transaction helper.
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from .logging import get_logger

log = get_logger("drcommon.db")


class Database:
    def __init__(self, dsn: str, *, min_size: int = 2, max_size: int = 10) -> None:
        self._dsn = dsn
        self._min_size = min_size
        self._max_size = max_size
        self.pool: asyncpg.Pool | None = None

    async def connect(self, *, attempts: int = 30, delay: float = 1.0) -> None:
        last: Exception | None = None
        for i in range(1, attempts + 1):
            try:
                self.pool = await asyncpg.create_pool(
                    self._dsn, min_size=self._min_size, max_size=self._max_size,
                    command_timeout=30,
                )
                # asyncpg encodes/decodes jsonb as text by default; register json.
                async with self.pool.acquire() as conn:
                    await _register_json(conn)
                log.info("postgres connected")
                return
            except asyncpg.InvalidCatalogNameError as exc:
                # The database does not exist. This happens with a stale pgdata
                # volume that skipped the one-time init script. Create it and
                # retry rather than crash-looping, so `docker compose up` is
                # robust to a leftover volume.
                last = exc
                try:
                    await self._ensure_database()
                except Exception as create_exc:  # noqa: BLE001
                    last = create_exc
                    log.warning("could not create database: %s", create_exc)
                await asyncio.sleep(delay)
            except Exception as exc:  # noqa: BLE001 - startup race, retry broadly
                last = exc
                log.warning("postgres not ready (attempt %d/%d): %s", i, attempts, exc)
                await asyncio.sleep(delay)
        raise RuntimeError(f"could not connect to postgres after {attempts} attempts: {last}")

    async def _ensure_database(self) -> None:
        """Create this service's database if it is missing, via the maintenance db."""
        base, _, dbname = self._dsn.rpartition("/")
        admin_dsn = f"{base}/postgres"
        conn = await asyncpg.connect(admin_dsn)
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", dbname
            )
            if not exists:
                # dbname is from our own config (no user input); quote defensively.
                await conn.execute(f'CREATE DATABASE "{dbname}"')
                log.warning("created missing database %s", dbname)
        finally:
            await conn.close()

    async def migrate(self, ddl: str) -> None:
        assert self.pool is not None, "connect() first"
        async with self.pool.acquire() as conn:
            await conn.execute(ddl)
        log.info("migrations applied")

    @asynccontextmanager
    async def tx(self) -> AsyncIterator[asyncpg.Connection]:
        """Acquire a connection and run inside a transaction."""
        assert self.pool is not None, "connect() first"
        async with self.pool.acquire() as conn:
            await _register_json(conn)
            async with conn.transaction():
                yield conn

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        assert self.pool is not None, "connect() first"
        async with self.pool.acquire() as conn:
            await _register_json(conn)
            yield conn

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()


async def _register_json(conn: asyncpg.Connection) -> None:
    import json

    for typ in ("json", "jsonb"):
        await conn.set_type_codec(
            typ, encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
