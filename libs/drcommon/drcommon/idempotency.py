"""Idempotency primitives.

Two layers, exactly as the brief demands:

* **Postgres is the durable authority.** ``operations`` carries a primary key on
  ``op_id``; a second attempt to apply the same effect loses the race on the
  unique constraint and is reported as a duplicate. This survives restarts,
  which is the whole point: Redis can be wiped and correctness must not depend
  on it.
* **Redis is the fast first-line check.** A cheap ``SET NX`` lets a consumer
  skip work that is obviously already done without touching Postgres, but it is
  never the thing standing between an order and a double effect.
"""
from __future__ import annotations

import asyncpg
import redis.asyncio as aioredis

OPERATIONS_DDL = """
CREATE TABLE IF NOT EXISTS operations (
    op_id       text PRIMARY KEY,
    order_id    uuid NOT NULL,
    kind        text NOT NULL,
    result      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operations_order_idx ON operations (order_id);
"""


async def claim_operation(
    conn: asyncpg.Connection, op_id: str, order_id: str, kind: str, result: dict | None = None,
) -> bool:
    """Claim an operation inside the caller's transaction.

    Returns ``True`` if this call won the claim (the effect should be applied),
    ``False`` if the op_id was already recorded (a duplicate; the caller must
    treat its work as a no-op). Run this in the SAME transaction as the state
    change so the dedup record and the effect commit or roll back together.
    """
    row = await conn.fetchrow(
        """
        INSERT INTO operations (op_id, order_id, kind, result)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (op_id) DO NOTHING
        RETURNING op_id
        """,
        op_id, order_id, kind, result or {},
    )
    return row is not None


async def operation_exists(conn: asyncpg.Connection, op_id: str) -> bool:
    return await conn.fetchval("SELECT 1 FROM operations WHERE op_id = $1", op_id) is not None


class RedisFirstLine:
    """Best-effort, non-authoritative dedup + rate limiting on Redis."""

    def __init__(self, client: aioredis.Redis) -> None:
        self.r = client

    async def is_done(self, key: str) -> bool:
        """Read-only check: has this op been marked done? Never writes.

        Pairs with :meth:`mark_done`, which is called only after the effect is
        durably committed, so a True here reliably means the work is finished and
        the caller can skip it. A wiped or down Redis returns False and the
        Postgres authority still catches the duplicate. Redis is never the thing
        standing between an order and a double effect.
        """
        try:
            return bool(await self.r.get(f"done:{key}"))
        except Exception:  # noqa: BLE001 - Redis is a cache, never load-bearing
            return False

    async def mark_done(self, key: str, ttl_seconds: int = 3600) -> None:
        """Record that an op's effect has been durably committed."""
        try:
            await self.r.set(f"done:{key}", "1", ex=ttl_seconds)
        except Exception:  # noqa: BLE001
            pass

    async def seen(self, key: str, ttl_seconds: int = 3600) -> bool:
        """Return True if ``key`` was seen before; otherwise record it (check-and-set)."""
        try:
            was_set = await self.r.set(f"seen:{key}", "1", nx=True, ex=ttl_seconds)
            return not bool(was_set)
        except Exception:  # noqa: BLE001 - Redis is a cache, never load-bearing
            return False

    async def allow(self, bucket: str, limit: int, window_seconds: int = 1) -> bool:
        """Fixed-window rate limit. Returns True if the call is within budget."""
        try:
            key = f"rl:{bucket}"
            count = await self.r.incr(key)
            if count == 1:
                await self.r.expire(key, window_seconds)
            return count <= limit
        except Exception:  # noqa: BLE001
            return True
