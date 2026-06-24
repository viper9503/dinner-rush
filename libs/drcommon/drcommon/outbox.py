"""Transactional outbox.

A service writes its state change and the row(s) it wants to publish in the SAME
database transaction. A background relay then moves committed-but-unpublished
rows onto the broker and stamps them published. This is what removes the
publish-then-crash hole: the event cannot exist without the state change, and
the state change cannot be acknowledged upstream without the event eventually
going out. Delivery is at-least-once (a crash between publish and stamp re-sends
the row), which is exactly why every consumer is idempotent.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable

import asyncpg

from .logging import get_logger
from .models import Envelope

log = get_logger("drcommon.outbox")

OUTBOX_DDL = """
CREATE TABLE IF NOT EXISTS outbox (
    id           bigserial PRIMARY KEY,
    exchange     text NOT NULL,
    routing_key  text NOT NULL,
    payload      jsonb NOT NULL,
    headers      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
    ON outbox (id) WHERE published_at IS NULL;
"""

# A publish function: (exchange, routing_key, body, headers) -> awaitable.
PublishFn = Callable[[str, str, bytes, dict], Awaitable[None]]


async def enqueue(
    conn: asyncpg.Connection,
    exchange: str,
    routing_key: str,
    envelope: Envelope,
    headers: dict | None = None,
) -> None:
    """Append an outbound message to the outbox within the caller's transaction."""
    await conn.execute(
        """
        INSERT INTO outbox (exchange, routing_key, payload, headers)
        VALUES ($1, $2, $3::jsonb, $4::jsonb)
        """,
        exchange, routing_key, envelope.model_dump(), headers or {},
    )


class OutboxRelay:
    """Polls the outbox and relays committed rows to the broker."""

    def __init__(
        self,
        pool: asyncpg.Pool,
        publish: PublishFn,
        *,
        batch_size: int = 128,
        poll_interval: float = 0.1,
    ) -> None:
        self._pool = pool
        self._publish = publish
        self._batch = batch_size
        self._interval = poll_interval
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="outbox-relay")

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            await asyncio.gather(self._task, return_exceptions=True)

    async def _run(self) -> None:
        log.info("outbox relay started")
        while not self._stop.is_set():
            try:
                moved = await self._drain_once()
            except Exception as exc:  # noqa: BLE001 - keep the relay alive
                log.warning("outbox relay error: %s", exc)
                moved = 0
            # If we emptied a full batch there may be more waiting; loop hot.
            if moved < self._batch:
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=self._interval)
                except asyncio.TimeoutError:
                    pass

    async def _drain_once(self) -> int:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                rows = await conn.fetch(
                    """
                    SELECT id, exchange, routing_key, payload, headers
                    FROM outbox
                    WHERE published_at IS NULL
                    ORDER BY id
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED
                    """,
                    self._batch,
                )
                if not rows:
                    return 0
                published_ids: list[int] = []
                for row in rows:
                    payload = row["payload"]
                    headers = row["headers"]
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    if isinstance(headers, str):
                        headers = json.loads(headers)
                    body = json.dumps(payload).encode("utf-8")
                    await self._publish(row["exchange"], row["routing_key"], body, headers or {})
                    published_ids.append(row["id"])
                await conn.execute(
                    "UPDATE outbox SET published_at = now() WHERE id = ANY($1::bigint[])",
                    published_ids,
                )
                return len(published_ids)
