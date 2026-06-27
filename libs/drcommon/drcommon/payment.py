"""payment-svc - simulated Stripe-style payment downstream.

Modeled on Stripe's PaymentIntents API so the integration looks like the real
thing while staying fully simulated, offline, and single-machine. Two properties
matter for the pipeline:

* **Idempotency keys.** The caller passes an ``Idempotency-Key`` header (the
  orchestrator uses the order's deterministic op_id). A replay of the same key
  returns the recorded outcome and never charges twice - this is exactly the
  mechanism that makes "no double charge" hold under at-least-once retries.
* **Declines are terminal, not transient.** A declined card returns 402 (a
  permanent 4xx), which the orchestrator treats as a business failure and moves
  the order to ``failed`` - distinct from a transient 5xx/timeout that should be
  retried. This is what finally exercises the failed-order path for real.

Flakiness (latency, transient errors, rate limiting, outages) is the shared
``FlakyCore`` used by the POS downstreams, with an added decline rate.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from starlette.requests import Request
from starlette.responses import JSONResponse

from .app import create_app
from .config import postgres_dsn
from .db import Database
from .downstream import FlakyCore, SimConfig, add_control_routes
from .logging import get_logger, set_correlation_id
from .metrics import Counter, Gauge, Histogram
from .models import new_uuid

CHARGES_DDL = """
CREATE TABLE IF NOT EXISTS charges (
    idempotency_key   text PRIMARY KEY,
    order_id          text,
    amount_cents      int NOT NULL,
    currency          text NOT NULL,
    status            text NOT NULL,
    payment_intent_id text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);
"""


def _intent_response(rec: dict, *, duplicate: bool) -> JSONResponse:
    pi_id = rec["payment_intent_id"]
    amount = rec["amount_cents"]
    currency = rec["currency"]
    if rec["status"] == "succeeded":
        body = {
            "id": pi_id, "object": "payment_intent", "amount": amount,
            "currency": currency, "status": "succeeded", "duplicate": duplicate,
        }
        return JSONResponse(body, status_code=200)
    # Declined card: a definitive 4xx the orchestrator will treat as terminal.
    body = {
        "id": pi_id, "object": "payment_intent", "amount": amount, "currency": currency,
        "status": "requires_payment_method", "duplicate": duplicate,
        "last_payment_error": {"code": "card_declined", "message": "Your card was declined."},
    }
    return JSONResponse(body, status_code=402)


def create_payment_app(service_name: str = "payment-svc", prefix: str = "PAYMENT",
                       db_name: str = "payment"):
    log = get_logger(service_name)
    core = FlakyCore(service_name, SimConfig.from_env(prefix))
    db = Database(postgres_dsn(db_name))

    m_requests = Counter("payment_requests_total", "Payment intents", ["result"])
    m_charged = Counter("payment_charged_total", "Unique successful charges")
    m_declined = Counter("payment_declined_total", "Cards declined")
    m_latency = Histogram("payment_latency_seconds", "Handler latency")
    g_up = Gauge("payment_up", "1 when accepting traffic, 0 when down")

    @asynccontextmanager
    async def lifespan(app):
        await db.connect()
        await db.migrate(CHARGES_DDL)
        g_up.set(1)
        task = asyncio.create_task(core.run_outage_loop(g_up, log), name="outage-loop")
        log.info("%s ready", service_name)
        try:
            yield
        finally:
            task.cancel()
            await db.close()

    app = create_app(service_name, lifespan=lifespan, cors=True)

    async def _fetch(key: str):
        async with db.acquire() as conn:
            return await conn.fetchrow("SELECT * FROM charges WHERE idempotency_key = $1", key)

    @app.post("/v1/payment_intents")
    async def create_payment_intent(request: Request) -> JSONResponse:
        body = await request.json()
        order_id = str(body.get("order_id") or body.get("metadata", {}).get("order_id") or "unknown")
        amount = int(body.get("amount", 0))
        currency = body.get("currency", "usd")
        key = request.headers.get("Idempotency-Key") or body.get("idempotency_key") or body.get("op_id")
        set_correlation_id(order_id)

        if not key:
            return JSONResponse({"error": {"message": "Idempotency-Key required"}}, status_code=400)

        if core.is_down():
            m_requests.labels(result="down").inc()
            return JSONResponse({"error": {"message": "payment provider unavailable"}}, status_code=503)

        # Idempotent replay: return the recorded outcome, never charge twice.
        cached = await _fetch(key)
        if cached is not None:
            m_requests.labels(result="duplicate").inc()
            return _intent_response(dict(cached), duplicate=True)

        if core.rate_limited():
            m_requests.labels(result="rate_limited").inc()
            return JSONResponse(
                {"error": {"message": "rate limited"}}, status_code=429, headers={"Retry-After": "1"}
            )

        with m_latency.time():
            await core.latency()
            outcome = core.roll()
            if outcome == "error":
                m_requests.labels(result="error").inc()
                return JSONResponse({"error": {"message": "processor error"}}, status_code=502)
            if outcome == "timeout":
                await asyncio.sleep(core.cfg.timeout_sleep_seconds)
                m_requests.labels(result="timeout").inc()
                return JSONResponse({"error": {"message": "gateway timeout"}}, status_code=504)

        status = "declined" if outcome == "decline" else "succeeded"
        pi_id = "pi_" + new_uuid().replace("-", "")[:24]

        # Claim the terminal outcome exactly once per idempotency key. If a
        # concurrent request with the same key won, return its recorded outcome.
        async with db.acquire() as conn:
            claimed = await conn.fetchrow(
                """
                INSERT INTO charges (idempotency_key, order_id, amount_cents, currency, status, payment_intent_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING idempotency_key
                """,
                key, order_id, amount, currency, status, pi_id,
            )
        if claimed is None:
            cached = await _fetch(key)
            m_requests.labels(result="duplicate").inc()
            return _intent_response(dict(cached), duplicate=True)

        if status == "succeeded":
            m_charged.inc()
            m_requests.labels(result="ok").inc()
        else:
            m_declined.inc()
            m_requests.labels(result="declined").inc()
        rec = {"payment_intent_id": pi_id, "amount_cents": amount, "currency": currency, "status": status}
        return _intent_response(rec, duplicate=False)

    add_control_routes(app, service_name, core, g_up, log)
    return app
