"""ingestion-svc - the front door.

Accepts orders at high volume and absorbs spiky bursts. The contract with the
caller is: once we return 2xx, the order is durable. We achieve that by writing
the order and its `order.placed` event in one transaction (the outbox) before
acknowledging; the relay publishes it asynchronously. We never block the request
on any downstream, so a dinner-rush spike is bounded only by Postgres write
throughput, not by how slow the restaurant or courier happens to be.

Idempotent accept: the caller's `idempotency_key` is a unique constraint, so a
retried POST returns the original order_id instead of creating a duplicate.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Response
from starlette.responses import JSONResponse

from drcommon import (
    EVENT_PLACED,
    EXCHANGE_EVENTS,
    OUTBOX_DDL,
    RK_PLACED,
    Broker,
    Database,
    OrderRequest,
    OutboxRelay,
    create_app,
    enqueue,
    get_logger,
    make_event,
    new_uuid,
    postgres_dsn,
    rabbitmq_url,
    set_correlation_id,
)
from drcommon.metrics import Counter

log = get_logger("ingestion")

INGEST_DDL = (
    """
CREATE TABLE IF NOT EXISTS orders (
    order_id        uuid PRIMARY KEY,
    idempotency_key text UNIQUE NOT NULL,
    customer_id     text NOT NULL,
    restaurant_id   text NOT NULL,
    items           jsonb NOT NULL,
    total_cents     int NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
"""
    + OUTBOX_DDL
)

m_orders = Counter("ingestion_orders_total", "Orders received", ["result"])


class Ingestion:
    def __init__(self) -> None:
        self.db = Database(postgres_dsn("ingestion"))
        self.broker = Broker(rabbitmq_url())
        self.relay: OutboxRelay | None = None

    async def start(self) -> None:
        await self.db.connect()
        await self.db.migrate(INGEST_DDL)
        await self.broker.connect()
        await self.broker.declare_topology()
        self.relay = OutboxRelay(self.db.pool, self.broker.publish_fn())
        self.relay.start()
        log.info("ingestion ready")

    async def stop(self) -> None:
        if self.relay:
            await self.relay.stop()
        await self.broker.close()
        await self.db.close()


ingestion = Ingestion()


@asynccontextmanager
async def lifespan(app):
    await ingestion.start()
    try:
        yield
    finally:
        await ingestion.stop()


app = create_app("ingestion-svc", lifespan=lifespan, cors=True)


@app.post("/orders")
async def place_order(req: OrderRequest) -> Response:
    idem = req.idempotency_key or new_uuid()
    order_id = new_uuid()
    set_correlation_id(order_id)
    total = req.total_cents()
    items = [i.model_dump() for i in req.items]

    async with ingestion.db.tx() as conn:
        inserted = await conn.fetchrow(
            """
            INSERT INTO orders
                (order_id, idempotency_key, customer_id, restaurant_id, items, total_cents)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING order_id
            """,
            order_id, idem, req.customer_id, req.restaurant_id, items, total,
        )
        if inserted is None:
            # Duplicate accept: return the original order_id, publish nothing.
            existing = await conn.fetchval(
                "SELECT order_id FROM orders WHERE idempotency_key = $1", idem
            )
            m_orders.labels(result="duplicate").inc()
            return JSONResponse(
                {"order_id": str(existing), "idempotency_key": idem, "status": "duplicate"},
                status_code=200,
            )

        ev = make_event(
            EVENT_PLACED, order_id,
            idempotency_key=idem, customer_id=req.customer_id,
            restaurant_id=req.restaurant_id, items=items, total_cents=total,
        )
        await enqueue(conn, EXCHANGE_EVENTS, RK_PLACED, ev)

    m_orders.labels(result="accepted").inc()
    return JSONResponse(
        {"order_id": order_id, "idempotency_key": idem, "status": "accepted"},
        status_code=202,
    )
