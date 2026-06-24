"""RabbitMQ topology and helpers (aio-pika).

The broker is the durable backbone for decoupling, retries, and dead-lettering.
Topology (declared idempotently by whichever service connects first):

    exchanges
      dinner.events  (topic)   domain facts: order.placed, order.transition
      dinner.work    (direct)  commands:     order.advance
      dinner.retry   (direct)  delayed redelivery staging
      dinner.dlx     (fanout)  parking lot for exhausted messages

    queues
      q.order.advance        <- dinner.work[order.advance]   (orchestrator)
      q.order.advance.retry  <- dinner.retry[order.advance]
                                TTL=RETRY_QUEUE_TTL_MS, dead-letters back to
                                dinner.work[order.advance]   (fixed-delay retry)
      q.order.dlq            <- dinner.dlx                    (inspect / replay)

Retry strategy is two-tier and deliberate: fast exponential backoff happens
in-process in the HTTP client; the broker tier is a fixed-delay bounce through
the retry queue, capped by BROKER_MAX_ATTEMPTS, after which a message parks in
the DLQ. Fixed delay at the broker tier avoids RabbitMQ's per-message-TTL
head-of-line blocking; the exponential character lives in the HTTP tier.

Messages are republished (not nack-requeued) for retry/DLQ so the new message is
publisher-confirmed before the original is acked: no message is lost in the gap.
"""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

import aio_pika
from aio_pika.abc import AbstractIncomingMessage

from .logging import get_logger
from .models import CMD_ADVANCE, Envelope

log = get_logger("drcommon.broker")

EXCHANGE_EVENTS = "dinner.events"
EXCHANGE_WORK = "dinner.work"
EXCHANGE_RETRY = "dinner.retry"
EXCHANGE_DLX = "dinner.dlx"

Q_ADVANCE = "q.order.advance"
Q_ADVANCE_RETRY = "q.order.advance.retry"
Q_DLQ = "q.order.dlq"

RK_ADVANCE = "order.advance"
RK_PLACED = "order.placed"
RK_TRANSITION = "order.transition"

Handler = Callable[[AbstractIncomingMessage], Awaitable[None]]


class Broker:
    def __init__(self, url: str, *, prefetch: int = 32, retry_ttl_ms: int = 5000) -> None:
        self._url = url
        self._prefetch = prefetch
        self._retry_ttl_ms = retry_ttl_ms
        self._conn: aio_pika.RobustConnection | None = None
        self._pub_channel: aio_pika.abc.AbstractChannel | None = None
        self._consume_channel: aio_pika.abc.AbstractChannel | None = None
        self._ex: dict[str, aio_pika.abc.AbstractExchange] = {}

    async def connect(self, *, attempts: int = 30, delay: float = 1.0) -> None:
        last: Exception | None = None
        for i in range(1, attempts + 1):
            try:
                self._conn = await aio_pika.connect_robust(self._url)
                # Confirm-select publisher channel: publish() awaits the broker ack.
                self._pub_channel = await self._conn.channel(publisher_confirms=True)
                self._consume_channel = await self._conn.channel()
                await self._consume_channel.set_qos(prefetch_count=self._prefetch)
                log.info("rabbitmq connected")
                return
            except Exception as exc:  # noqa: BLE001 - startup race
                last = exc
                log.warning("rabbitmq not ready (attempt %d/%d): %s", i, attempts, exc)
                await asyncio.sleep(delay)
        raise RuntimeError(f"could not connect to rabbitmq after {attempts} attempts: {last}")

    async def declare_topology(self) -> None:
        ch = self._pub_channel
        assert ch is not None, "connect() first"

        events = await ch.declare_exchange(EXCHANGE_EVENTS, aio_pika.ExchangeType.TOPIC, durable=True)
        work = await ch.declare_exchange(EXCHANGE_WORK, aio_pika.ExchangeType.DIRECT, durable=True)
        retry = await ch.declare_exchange(EXCHANGE_RETRY, aio_pika.ExchangeType.DIRECT, durable=True)
        dlx = await ch.declare_exchange(EXCHANGE_DLX, aio_pika.ExchangeType.FANOUT, durable=True)
        self._ex = {EXCHANGE_EVENTS: events, EXCHANGE_WORK: work, EXCHANGE_RETRY: retry, EXCHANGE_DLX: dlx}

        advance = await ch.declare_queue(Q_ADVANCE, durable=True)
        await advance.bind(work, routing_key=RK_ADVANCE)

        retry_q = await ch.declare_queue(
            Q_ADVANCE_RETRY,
            durable=True,
            arguments={
                "x-message-ttl": self._retry_ttl_ms,
                "x-dead-letter-exchange": EXCHANGE_WORK,
                "x-dead-letter-routing-key": RK_ADVANCE,
            },
        )
        await retry_q.bind(retry, routing_key=RK_ADVANCE)

        dlq = await ch.declare_queue(Q_DLQ, durable=True)
        await dlq.bind(dlx)
        log.info("topology declared")

    def _exchange(self, name: str) -> aio_pika.abc.AbstractExchange:
        ex = self._ex.get(name)
        if ex is None:
            raise RuntimeError(f"exchange {name} not declared; call declare_topology()")
        return ex

    async def publish(self, exchange: str, routing_key: str, body: bytes, headers: dict | None = None) -> None:
        msg = aio_pika.Message(
            body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            headers=headers or {},
            content_type="application/json",
        )
        await self._exchange(exchange).publish(msg, routing_key=routing_key)

    async def publish_envelope(
        self, exchange: str, routing_key: str, env: Envelope, headers: dict | None = None
    ) -> None:
        await self.publish(exchange, routing_key, env.to_bytes(), headers)

    def publish_fn(self) -> Callable[[str, str, bytes, dict], Awaitable[None]]:
        """Adapter for the outbox relay."""
        async def _fn(exchange: str, routing_key: str, body: bytes, headers: dict) -> None:
            await self.publish(exchange, routing_key, body, headers)
        return _fn

    # ---- consumer-side queues ----

    async def declare_work_queue(self) -> aio_pika.abc.AbstractQueue:
        ch = self._consume_channel
        assert ch is not None
        return await ch.declare_queue(Q_ADVANCE, durable=True)

    async def declare_event_queue(
        self,
        name: str,
        binding_keys: list[str],
        *,
        durable: bool = True,
        auto_delete: bool = False,
        arguments: dict | None = None,
    ) -> aio_pika.abc.AbstractQueue:
        """Declare a per-consumer queue bound to the events topic exchange.

        Defaults are durable (used by the orchestrator, where dropping a placed
        event would lose an order). A pure live-view consumer like the dashboard
        passes durable=False, auto_delete=True so its backlog cannot pile up
        while it is away - it only ever wants the live tail.
        """
        ch = self._consume_channel
        assert ch is not None
        q = await ch.declare_queue(
            name, durable=durable, auto_delete=auto_delete, arguments=arguments
        )
        for key in binding_keys:
            await q.bind(EXCHANGE_EVENTS, routing_key=key)
        return q

    async def consume(self, queue: aio_pika.abc.AbstractQueue, handler: Handler) -> None:
        await queue.consume(handler, no_ack=False)

    # ---- retry / dlq ----

    async def schedule_retry(self, env: Envelope) -> None:
        """Bounce a command through the retry queue for a delayed redelivery."""
        env.attempt += 1
        await self.publish_envelope(EXCHANGE_RETRY, RK_ADVANCE, env, headers={"x-retry": env.attempt})

    async def send_to_dlq(self, env: Envelope, reason: str) -> None:
        await self.publish_envelope(EXCHANGE_DLX, "", env, headers={"x-death-reason": reason})

    async def send_raw_to_dlq(self, body: bytes, reason: str) -> None:
        """Park an unparseable (poison) message body for inspection.

        Used when a message cannot even be decoded into an Envelope, so it can
        never be retried meaningfully. Parking it stops it hot-looping on the
        work queue while preserving it for a human to look at.
        """
        await self.publish(EXCHANGE_DLX, "", body, headers={"x-death-reason": reason, "x-poison": "1"})

    async def replay_dlq(self, limit: int = 100) -> int:
        """Move up to ``limit`` parked messages back onto the work queue.

        Messages that cannot be decoded (poison) are acked and dropped rather
        than re-queued, so a single bad body cannot wedge the replay loop.
        """
        ch = self._consume_channel
        assert ch is not None
        dlq = await ch.declare_queue(Q_DLQ, durable=True)
        moved = 0
        dropped = 0
        for _ in range(limit):
            msg = await dlq.get(no_ack=False, fail=False)
            if msg is None:
                break
            try:
                env = Envelope.from_bytes(msg.body)
            except Exception:  # noqa: BLE001 - poison body, cannot replay
                await msg.ack()
                dropped += 1
                continue
            env.attempt = 1
            await self.publish_envelope(EXCHANGE_WORK, RK_ADVANCE, env)
            await msg.ack()
            moved += 1
        if moved or dropped:
            log.info("replayed %d dlq messages (dropped %d poison)", moved, dropped)
        return moved

    async def dlq_depth(self) -> int:
        ch = self._consume_channel
        assert ch is not None
        dlq = await ch.declare_queue(Q_DLQ, durable=True, passive=True)
        return dlq.declaration_result.message_count

    async def seed_advance(self, env: Envelope) -> None:
        """Publish an advance command directly (used to kick off a new order)."""
        env.type = CMD_ADVANCE
        await self.publish_envelope(EXCHANGE_WORK, RK_ADVANCE, env)

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
