"""orchestrator-svc - the pipeline brain.

Owns the authoritative lifecycle state machine. Consumes `order.placed` (seed)
and `order.advance` (drive one step) commands, calls the flaky downstreams for
the fulfillment stages, and persists every transition. Correctness rests on three
things working together:

* the advance command names the state it expects (`data.from`); if the order has
  already moved past it, the command is a no-op (handles duplicate delivery);
* every step's effect is claimed under a deterministic `op_id` unique constraint,
  so a delivery that races or replays after a crash cannot double-apply;
* the state change, the emitted events, and the next advance command all commit
  in one transaction via the outbox, so we never publish with unsaved state.

Two retry tiers: the HTTP client retries fast in-process; if that is exhausted (or
the breaker is open) the command is bounced through the broker retry queue, up to
BROKER_MAX_ATTEMPTS, after which it parks in the DLQ for inspect/replay.
"""
from __future__ import annotations

import asyncio
import random
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from aio_pika.abc import AbstractIncomingMessage
from fastapi import HTTPException

from drcommon import (
    EVENT_TRANSITION,
    EXCHANGE_EVENTS,
    EXCHANGE_WORK,
    OPERATIONS_DDL,
    OUTBOX_DDL,
    RK_ADVANCE,
    RK_TRANSITION,
    STAGE_DOWNSTREAM,
    BreakerOpen,
    Broker,
    Database,
    Envelope,
    FulfillRequest,
    OutboxRelay,
    PermanentError,
    RedisFirstLine,
    ResilientClient,
    State,
    TransientExhausted,
    claim_operation,
    create_app,
    enqueue,
    env_float,
    env_int,
    env_str,
    get_logger,
    is_terminal,
    make_event,
    next_happy_state,
    op_id_for,
    operation_exists,
    postgres_dsn,
    rabbitmq_url,
    redis_url,
    set_correlation_id,
)
from drcommon.metrics import Counter, Gauge

log = get_logger("orchestrator")

ORCH_DDL = (
    """
CREATE TABLE IF NOT EXISTS orders (
    order_id       uuid PRIMARY KEY,
    state          text NOT NULL,
    idempotency_key text,
    customer_id    text,
    restaurant_id  text,
    items          jsonb NOT NULL DEFAULT '[]'::jsonb,
    total_cents    int NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_state_idx ON orders (state);

CREATE TABLE IF NOT EXISTS transitions (
    id         bigserial PRIMARY KEY,
    order_id   uuid NOT NULL,
    from_state text,
    to_state   text NOT NULL,
    cause      text,
    attempt    int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transitions_order_idx ON transitions (order_id, id);
"""
    + OPERATIONS_DDL
    + OUTBOX_DDL
)

# ---- tunables ----
BROKER_MAX_ATTEMPTS = env_int("BROKER_MAX_ATTEMPTS", 6)
RETRY_TTL_MS = env_int("RETRY_QUEUE_TTL_MS", 5000)
PREFETCH = env_int("ORCH_PREFETCH", 64)
COOK_SECONDS = env_float("COOK_SECONDS", 2.0)
DRIVE_SECONDS = env_float("DELIVERY_DRIVE_SECONDS", 2.0)
CANCEL_RATE = env_float("CANCEL_RATE", 0.0)
# How often to try draining DLQ-parked orders back onto the pipeline once the
# downstreams report healthy again (automatic recovery after a forced outage).
DLQ_REPLAY_INTERVAL_SECONDS = env_float("DLQ_REPLAY_INTERVAL_SECONDS", 15.0)

# Think-time (seconds) for the internal stages that do not call a downstream.
THINK_TIME: dict[State, float] = {
    State.READY: COOK_SECONDS,
    State.DELIVERED: DRIVE_SECONDS,
}

# ---- metrics ----
m_transitions = Counter("orchestrator_transitions_total", "Transitions applied", ["to"])
m_advance = Counter("orchestrator_advance_total", "Advance commands processed", ["result"])
m_retries = Counter("orchestrator_broker_retries_total", "Commands bounced to retry queue")
m_dlq = Counter("orchestrator_dlq_total", "Commands parked in the DLQ")
m_downstream = Counter("orchestrator_downstream_calls_total", "Downstream calls", ["name", "result"])
g_inflight = Gauge("orchestrator_inflight", "Advance commands currently in handlers")


class Orchestrator:
    def __init__(self) -> None:
        self.db = Database(postgres_dsn("orchestrator"))
        self.broker = Broker(rabbitmq_url(), prefetch=PREFETCH, retry_ttl_ms=RETRY_TTL_MS)
        self.relay: OutboxRelay | None = None
        self.redis: aioredis.Redis | None = None
        self.first_line: RedisFirstLine | None = None
        self.clients: dict[str, ResilientClient] = {}
        self.probe: httpx.AsyncClient | None = None
        self._drain_task: asyncio.Task | None = None

    async def start(self) -> None:
        await self.db.connect()
        await self.db.migrate(ORCH_DDL)
        await self.broker.connect()
        await self.broker.declare_topology()
        self.relay = OutboxRelay(self.db.pool, self.broker.publish_fn())
        self.relay.start()
        self.redis = aioredis.from_url(redis_url(), decode_responses=True)
        self.first_line = RedisFirstLine(self.redis)

        timeout = env_float("DOWNSTREAM_TIMEOUT_SECONDS", 3.0)
        common = dict(
            timeout=timeout,
            max_retries=env_int("HTTP_MAX_RETRIES", 3),
            backoff_base=env_float("HTTP_BACKOFF_BASE_SECONDS", 0.2),
            backoff_max=env_float("HTTP_BACKOFF_MAX_SECONDS", 2.0),
            fail_threshold=env_int("CIRCUIT_FAIL_THRESHOLD", 5),
            open_seconds=env_float("CIRCUIT_OPEN_SECONDS", 10.0),
        )
        self.clients = {
            "restaurant": ResilientClient(
                base_url=env_str("RESTAURANT_URL", "http://restaurant:8003"),
                name="restaurant", **common),
            "courier": ResilientClient(
                base_url=env_str("COURIER_URL", "http://courier:8004"),
                name="courier", **common),
        }

        self.probe = httpx.AsyncClient(timeout=2.0)

        placed_q = await self.broker.declare_event_queue("q.orch.placed", ["order.placed"])
        advance_q = await self.broker.declare_work_queue()
        await self.broker.consume(placed_q, self.on_placed)
        await self.broker.consume(advance_q, self.on_advance)
        self._drain_task = asyncio.create_task(self._dlq_drain_loop(), name="dlq-drain")
        log.info("orchestrator ready")

    async def stop(self) -> None:
        if self._drain_task:
            self._drain_task.cancel()
        if self.relay:
            await self.relay.stop()
        for c in self.clients.values():
            await c.aclose()
        if self.probe:
            await self.probe.aclose()
        await self.broker.close()
        await self.db.close()
        if self.redis:
            await self.redis.aclose()

    # ---- seed: a new order entered the system ----

    async def on_placed(self, message: AbstractIncomingMessage) -> None:
        try:
            env = Envelope.from_bytes(message.body)
        except Exception as exc:  # noqa: BLE001 - unparseable poison body
            log.warning("unparseable placed message -> DLQ: %s", exc)
            await self.broker.send_raw_to_dlq(message.body, f"placed parse error: {exc}")
            await message.ack()
            return
        try:
            set_correlation_id(env.order_id)
            d = env.data
            async with self.db.tx() as conn:
                inserted = await conn.fetchrow(
                    """
                    INSERT INTO orders
                        (order_id, state, idempotency_key, customer_id, restaurant_id, items, total_cents)
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                    ON CONFLICT (order_id) DO NOTHING
                    RETURNING order_id
                    """,
                    env.order_id, State.PLACED.value, d.get("idempotency_key"),
                    d.get("customer_id"), d.get("restaurant_id"),
                    d.get("items", []), int(d.get("total_cents", 0)),
                )
                if inserted is not None:
                    # Seed the first advance through the outbox so it is durable
                    # with the insert.
                    seed = make_event("order.advance", env.order_id, **{"from": State.PLACED.value})
                    await enqueue(conn, EXCHANGE_WORK, RK_ADVANCE, seed)
            await message.ack()
        except Exception as exc:  # noqa: BLE001 - likely a transient DB blip
            # Bounded: requeue once, then park in the DLQ instead of hot-looping.
            if message.redelivered:
                log.warning("placed failed again -> DLQ: %s", exc)
                await self.broker.send_to_dlq(env, f"placed failed: {exc}")
                await message.ack()
            else:
                log.warning("placed failed, requeueing once: %s", exc)
                await message.nack(requeue=True)

    # ---- drive one lifecycle step forward ----

    async def on_advance(self, message: AbstractIncomingMessage) -> None:
        g_inflight.inc()
        env: Envelope | None = None
        try:
            env = Envelope.from_bytes(message.body)
            set_correlation_id(env.order_id)
            await self._advance(env, message)
        except Exception as exc:  # noqa: BLE001 - never drop or hot-loop a message
            log.exception("advance failed: %s", exc)
            await self._fault(env, message, f"advance error: {exc}")
        finally:
            g_inflight.dec()

    async def _fault(self, env: Envelope | None, message: AbstractIncomingMessage, reason: str) -> None:
        """Bounded fault handling: a poison body goes straight to the DLQ; an
        otherwise-failed command takes the capped broker-retry path (which parks
        it in the DLQ after BROKER_MAX_ATTEMPTS). Never an uncapped requeue."""
        try:
            if env is None:
                await self.broker.send_raw_to_dlq(message.body, reason)
                await message.ack()
            else:
                await self._retry_or_dlq(env, message, reason)
        except Exception:  # noqa: BLE001 - last resort, avoid a hot-loop
            try:
                await message.nack(requeue=False)
            except Exception:  # noqa: BLE001
                pass

    async def _advance(self, env: Envelope, message: AbstractIncomingMessage) -> None:
        order_id = env.order_id
        from_state = State(env.data["from"])

        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state, customer_id, restaurant_id FROM orders WHERE order_id = $1", order_id
            )
        if row is None:
            # Order not created yet (relay lag); retry shortly.
            await self._retry_or_dlq(env, message, "order not found yet")
            return

        current = State(row["state"])
        if current != from_state or is_terminal(current):
            # Stale or duplicate advance: the order already moved on.
            m_advance.labels(result="stale").inc()
            await message.ack()
            return

        # Optional simulated customer cancellation from an early stage.
        if CANCEL_RATE > 0 and current in (State.PLACED, State.CONFIRMED, State.PREPARING):
            if random.random() < CANCEL_RATE:
                applied = await self._cancel(order_id, current, env.attempt)
                m_advance.labels(result="cancelled" if applied else "dedup").inc()
                await message.ack()
                return

        target = next_happy_state(current)
        if target is None:
            m_advance.labels(result="terminal").inc()
            await message.ack()
            return

        op_id = op_id_for(order_id, current, target)

        # Fast first-line skip: Redis says done AND Postgres confirms -> skip the
        # downstream call and the transaction entirely. Redis is only ever an
        # optimization here; the Postgres operations PK remains the authority.
        if self.first_line is not None and await self.first_line.is_done(op_id):
            async with self.db.acquire() as conn:
                if await operation_exists(conn, op_id):
                    m_advance.labels(result="dedup").inc()
                    await message.ack()
                    return

        # Stage that needs a flaky downstream call?
        downstream = STAGE_DOWNSTREAM.get(target)
        detail: dict = {}
        if downstream is not None:
            ok = await self._call_downstream(downstream, order_id, op_id, target, row, env, message)
            if ok is None:
                return  # _call_downstream already acked (retry/dlq/fail)
            detail = ok
        else:
            think = THINK_TIME.get(target, 0.0)
            if think > 0:
                await asyncio.sleep(think)

        applied = await self._commit_transition(order_id, current, target, op_id, detail, env.attempt)
        if applied:
            m_transitions.labels(to=target.value).inc()
            m_advance.labels(result="ok").inc()
            if self.first_line is not None:
                await self.first_line.mark_done(op_id)
        else:
            # A concurrent delivery already applied this exact step; do not
            # double-count it as a transition.
            m_advance.labels(result="dedup").inc()
        await message.ack()

    async def _call_downstream(
        self, name, order_id, op_id, target, row, env, message,
    ) -> dict | None:
        client = self.clients[name]
        req = FulfillRequest(
            order_id=order_id, op_id=op_id, stage=target.value,
            customer_id=row["customer_id"], restaurant_id=row["restaurant_id"],
        )
        try:
            result = await client.post_json("/fulfill", req.model_dump())
            m_downstream.labels(name=name, result="ok").inc()
            return result.get("detail", {})
        except (BreakerOpen, TransientExhausted) as exc:
            m_downstream.labels(name=name, result="transient").inc()
            await self._retry_or_dlq(env, message, f"{name}: {exc}")
            return None
        except PermanentError as exc:
            m_downstream.labels(name=name, result="permanent").inc()
            await self._fail_order(order_id, State(row["state"]), f"{name} permanent: {exc}", env.attempt)
            m_advance.labels(result="failed").inc()
            await message.ack()
            return None

    async def _commit_transition(self, order_id, current, target, op_id, detail, attempt) -> bool:
        """Apply the step in one transaction. Returns True if this call applied
        it, False if a concurrent delivery already had (a dedup no-op)."""
        async with self.db.tx() as conn:
            claimed = await claim_operation(
                conn, op_id, order_id, kind=f"enter:{target.value}", result=detail
            )
            if not claimed:
                # Another delivery already applied this exact step: no-op.
                return False
            updated = await conn.execute(
                "UPDATE orders SET state = $2, updated_at = now() WHERE order_id = $1 AND state = $3",
                order_id, target.value, current.value,
            )
            if updated.endswith(" 0"):
                # State moved underneath us; abort so the operation claim rolls back.
                raise RuntimeError(f"state race on {order_id}: expected {current.value}")
            await conn.execute(
                "INSERT INTO transitions (order_id, from_state, to_state, cause, attempt) "
                "VALUES ($1, $2, $3, $4, $5)",
                order_id, current.value, target.value, "advance", attempt,
            )
            ev = make_event(
                EVENT_TRANSITION, order_id,
                **{"from": current.value, "to": target.value, "cause": "advance", "attempt": attempt},
            )
            await enqueue(conn, EXCHANGE_EVENTS, RK_TRANSITION, ev)
            if not is_terminal(target):
                nxt = make_event("order.advance", order_id, **{"from": target.value})
                await enqueue(conn, EXCHANGE_WORK, RK_ADVANCE, nxt)
        return True

    async def _cancel(self, order_id: str, current: State, attempt: int) -> bool:
        """Cancel from an early stage. Returns True if applied, False if a
        concurrent delivery already moved the order on (no phantom transition)."""
        op_id = op_id_for(order_id, current, State.CANCELLED)
        async with self.db.tx() as conn:
            if not await claim_operation(conn, op_id, order_id, kind="cancel"):
                return False
            updated = await conn.execute(
                "UPDATE orders SET state=$2, updated_at=now() WHERE order_id=$1 AND state=$3",
                order_id, State.CANCELLED.value, current.value,
            )
            if updated.endswith(" 0"):
                # The order advanced underneath us; abort so we do not record a
                # cancelled transition that diverges from the real state.
                raise RuntimeError(f"state race on cancel {order_id}: expected {current.value}")
            await conn.execute(
                "INSERT INTO transitions (order_id, from_state, to_state, cause, attempt) "
                "VALUES ($1,$2,$3,$4,$5)",
                order_id, current.value, State.CANCELLED.value, "customer_cancelled", attempt,
            )
            ev = make_event(
                EVENT_TRANSITION, order_id,
                **{"from": current.value, "to": State.CANCELLED.value,
                   "cause": "customer_cancelled", "attempt": attempt},
            )
            await enqueue(conn, EXCHANGE_EVENTS, RK_TRANSITION, ev)
        m_transitions.labels(to=State.CANCELLED.value).inc()
        return True

    async def _fail_order(self, order_id: str, current: State, reason: str, attempt: int) -> bool:
        op_id = op_id_for(order_id, current, State.FAILED)
        async with self.db.tx() as conn:
            if not await claim_operation(conn, op_id, order_id, kind="fail"):
                return False
            updated = await conn.execute(
                "UPDATE orders SET state=$2, updated_at=now() WHERE order_id=$1 AND state=$3",
                order_id, State.FAILED.value, current.value,
            )
            if updated.endswith(" 0"):
                # The order moved on; abort rather than record a phantom failure.
                raise RuntimeError(f"state race on fail {order_id}: expected {current.value}")
            await conn.execute(
                "INSERT INTO transitions (order_id, from_state, to_state, cause, attempt) "
                "VALUES ($1,$2,$3,$4,$5)",
                order_id, current.value, State.FAILED.value, reason, attempt,
            )
            ev = make_event(
                EVENT_TRANSITION, order_id,
                **{"from": current.value, "to": State.FAILED.value, "cause": reason, "attempt": attempt},
            )
            await enqueue(conn, EXCHANGE_EVENTS, RK_TRANSITION, ev)
        m_transitions.labels(to=State.FAILED.value).inc()
        return True

    async def _retry_or_dlq(self, env: Envelope, message: AbstractIncomingMessage, reason: str) -> None:
        if env.attempt >= BROKER_MAX_ATTEMPTS:
            await self.broker.send_to_dlq(env, reason)
            m_dlq.inc()
            log.warning("order %s parked in DLQ: %s", env.order_id, reason)
        else:
            await self.broker.schedule_retry(env)  # increments attempt
            m_retries.inc()
        await message.ack()

    # ---- automatic recovery: drain the DLQ once downstreams are healthy ----

    async def _downstreams_healthy(self) -> bool:
        """True only if every downstream reports it is accepting traffic.

        Gating DLQ replay on this means a long forced outage parks orders, and
        the moment the operator brings the downstream back the next drain tick
        resumes them. Replaying generates the traffic that re-probes the circuit
        breaker, so the breaker closes on its own without a deadlock.
        """
        if self.probe is None:
            return False
        for client in self.clients.values():
            try:
                r = await self.probe.get(f"{client.base_url}/control")
                if r.status_code >= 300 or bool(r.json().get("down", False)):
                    return False
            except Exception:  # noqa: BLE001 - treat unreachable as unhealthy
                return False
        return True

    async def _dlq_drain_loop(self) -> None:
        while True:
            await asyncio.sleep(DLQ_REPLAY_INTERVAL_SECONDS)
            try:
                if await self.broker.dlq_depth() == 0:
                    continue
                if await self._downstreams_healthy():
                    moved = await self.broker.replay_dlq(500)
                    if moved:
                        log.info("auto-replayed %d orders from DLQ after recovery", moved)
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                log.warning("dlq drain error: %s", exc)


orch = Orchestrator()


@asynccontextmanager
async def lifespan(app):
    await orch.start()
    try:
        yield
    finally:
        await orch.stop()


app = create_app("orchestrator-svc", lifespan=lifespan, cors=True)


@app.get("/orders/{order_id}")
async def get_order(order_id: str) -> dict:
    async with orch.db.acquire() as conn:
        order = await conn.fetchrow("SELECT * FROM orders WHERE order_id = $1", order_id)
        if order is None:
            raise HTTPException(status_code=404, detail="order not found")
        trans = await conn.fetch(
            "SELECT from_state, to_state, cause, attempt, created_at "
            "FROM transitions WHERE order_id = $1 ORDER BY id",
            order_id,
        )
    return {
        "order": {k: order[k] for k in order.keys()},
        "transitions": [dict(t) for t in trans],
    }


@app.get("/stats")
async def stats() -> dict:
    async with orch.db.acquire() as conn:
        rows = await conn.fetch("SELECT state, count(*) AS n FROM orders GROUP BY state")
    return {r["state"]: r["n"] for r in rows}


@app.get("/downstreams")
async def downstreams() -> dict:
    return {name: client.health() for name, client in orch.clients.items()}


@app.post("/admin/replay-dlq")
async def replay_dlq(limit: int = 100) -> dict:
    moved = await orch.broker.replay_dlq(limit)
    return {"replayed": moved}
