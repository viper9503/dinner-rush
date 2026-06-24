"""Simulated flaky downstream (restaurant-svc and courier-svc share this).

One implementation, two containers: restaurant-svc and courier-svc each import
:func:`create_downstream_app` with their own env prefix. The behavior is the
deliberately unreliable external system the brief asks for - slow, rate-limited,
randomly failing, and able to fall over and recover - all tunable at runtime via
``/control`` for the live "break something on purpose" demo.

Idempotency lives here too: the effect (recording a dispatch and bumping the
unique-dispatch counter) is claimed through a Postgres ``dispatches`` table keyed
by ``op_id``. A retried command for an op_id that already succeeded returns the
cached result with ``duplicate=true`` and applies no second effect, which is how
"dispatch a courier exactly once" survives at-least-once delivery.
"""
from __future__ import annotations

import asyncio
import random
import time
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass

from fastapi import Response
from starlette.requests import Request
from starlette.responses import JSONResponse

from .app import create_app
from .config import env_bool, env_float, env_int, postgres_dsn
from .db import Database
from .logging import get_logger, set_correlation_id
from .metrics import Counter, Gauge, Histogram
from .models import FulfillRequest, FulfillResult

DISPATCHES_DDL = """
CREATE TABLE IF NOT EXISTS dispatches (
    op_id      text PRIMARY KEY,
    order_id   uuid NOT NULL,
    stage      text NOT NULL,
    result     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
"""


@dataclass
class SimConfig:
    base_latency_ms: int
    jitter_ms: int
    failure_rate: float
    timeout_rate: float
    rate_limit_rps: int
    outage_prob: float
    outage_seconds: int
    timeout_sleep_seconds: float = 5.0
    forced_down: bool = False

    @classmethod
    def from_env(cls, prefix: str) -> "SimConfig":
        return cls(
            base_latency_ms=env_int(f"{prefix}_BASE_LATENCY_MS", 150),
            jitter_ms=env_int(f"{prefix}_JITTER_MS", 400),
            failure_rate=env_float(f"{prefix}_FAILURE_RATE", 0.1),
            timeout_rate=env_float(f"{prefix}_TIMEOUT_RATE", 0.03),
            rate_limit_rps=env_int(f"{prefix}_RATE_LIMIT_RPS", 25),
            outage_prob=env_float(f"{prefix}_OUTAGE_PROB", 0.0),
            outage_seconds=env_int(f"{prefix}_OUTAGE_SECONDS", 20),
            timeout_sleep_seconds=env_float(f"{prefix}_TIMEOUT_SLEEP_SECONDS", 5.0),
            forced_down=env_bool(f"{prefix}_FORCED_DOWN", False),
        )


def create_downstream_app(service_name: str, prefix: str, db_name: str):
    log = get_logger(service_name)
    cfg = SimConfig.from_env(prefix)
    db = Database(postgres_dsn(db_name))

    # Per-process metrics (each downstream is its own scrape target).
    m_requests = Counter("downstream_requests_total", "Fulfillment requests", ["result"])
    m_dispatched = Counter("downstream_dispatched_total", "Unique effects applied")
    m_latency = Histogram("downstream_latency_seconds", "Handler latency")
    g_up = Gauge("downstream_up", "1 when accepting traffic, 0 when down")

    state = {"auto_down_until": 0.0, "win_start": 0.0, "win_count": 0}

    def is_down() -> bool:
        return cfg.forced_down or time.monotonic() < state["auto_down_until"]

    def rate_limited() -> bool:
        now = time.monotonic()
        if now - state["win_start"] >= 1.0:
            state["win_start"] = now
            state["win_count"] = 0
        state["win_count"] += 1
        return state["win_count"] > cfg.rate_limit_rps

    async def outage_loop() -> None:
        # Periodically roll the dice to fall over for a while, then recover.
        while True:
            await asyncio.sleep(5)
            g_up.set(0 if is_down() else 1)
            if cfg.forced_down or is_down():
                continue
            if cfg.outage_prob > 0 and random.random() < cfg.outage_prob:
                state["auto_down_until"] = time.monotonic() + cfg.outage_seconds
                log.warning("%s entering simulated outage for %ds", service_name, cfg.outage_seconds)

    @asynccontextmanager
    async def lifespan(app):
        await db.connect()
        await db.migrate(DISPATCHES_DDL)
        g_up.set(1)
        task = asyncio.create_task(outage_loop(), name="outage-loop")
        log.info("%s ready", service_name)
        try:
            yield
        finally:
            task.cancel()
            await db.close()

    app = create_app(service_name, lifespan=lifespan, cors=True)

    @app.post("/fulfill")
    async def fulfill(req: FulfillRequest) -> Response:
        set_correlation_id(req.order_id)

        if is_down():
            m_requests.labels(result="down").inc()
            return JSONResponse({"error": "service unavailable"}, status_code=503)

        # Idempotent fast path first: a known-duplicate must return cached without
        # consuming a rate-limit token or re-running work.
        async with db.acquire() as conn:
            cached = await conn.fetchrow(
                "SELECT result FROM dispatches WHERE op_id = $1", req.op_id
            )
        if cached is not None:
            m_requests.labels(result="duplicate").inc()
            res = FulfillResult(
                op_id=req.op_id, order_id=req.order_id, stage=req.stage,
                status="ok", duplicate=True, detail=cached["result"],
            )
            return JSONResponse(res.model_dump())

        if rate_limited():
            m_requests.labels(result="rate_limited").inc()
            return JSONResponse(
                {"error": "rate limited"}, status_code=429, headers={"Retry-After": "1"}
            )

        # Simulate work time.
        with m_latency.time():
            delay = (cfg.base_latency_ms + random.uniform(0, cfg.jitter_ms)) / 1000.0
            await asyncio.sleep(delay)

            roll = random.random()
            if roll < cfg.failure_rate:
                m_requests.labels(result="error").inc()
                return JSONResponse({"error": "internal failure"}, status_code=500)
            if roll < cfg.failure_rate + cfg.timeout_rate:
                # Hang past the caller's timeout to exercise the real timeout path.
                await asyncio.sleep(cfg.timeout_sleep_seconds)
                m_requests.labels(result="timeout").inc()
                return JSONResponse({"error": "gateway timeout"}, status_code=504)

        # Claim the effect exactly once, even under concurrent same-op_id calls.
        detail = {"handled_by": service_name, "ms": round(delay * 1000, 1)}
        async with db.acquire() as conn:
            claimed = await conn.fetchrow(
                """
                INSERT INTO dispatches (op_id, order_id, stage, result)
                VALUES ($1, $2, $3, $4::jsonb)
                ON CONFLICT (op_id) DO NOTHING
                RETURNING op_id
                """,
                req.op_id, req.order_id, req.stage, detail,
            )
        duplicate = claimed is None
        if duplicate:
            m_requests.labels(result="duplicate").inc()
        else:
            m_dispatched.inc()
            m_requests.labels(result="ok").inc()
        res = FulfillResult(
            op_id=req.op_id, order_id=req.order_id, stage=req.stage,
            status="ok", duplicate=duplicate, detail=detail,
        )
        return JSONResponse(res.model_dump())

    @app.get("/control")
    async def get_control() -> dict:
        return {"service": service_name, "down": is_down(), "config": asdict(cfg)}

    @app.post("/control")
    async def set_control(request: Request) -> dict:
        body = await request.json()
        for key, value in body.items():
            if hasattr(cfg, key):
                setattr(cfg, key, value)
        log.warning("%s control updated: %s", service_name, body)
        return {"service": service_name, "down": is_down(), "config": asdict(cfg)}

    @app.post("/control/down")
    async def force_down() -> dict:
        cfg.forced_down = True
        g_up.set(0)
        log.warning("%s forced DOWN", service_name)
        return {"service": service_name, "down": True}

    @app.post("/control/up")
    async def force_up() -> dict:
        cfg.forced_down = False
        state["auto_down_until"] = 0.0
        g_up.set(1)
        log.warning("%s forced UP", service_name)
        return {"service": service_name, "down": False}

    @app.get("/stats")
    async def stats() -> dict:
        return {"service": service_name, "down": is_down(), "config": asdict(cfg)}

    return app
