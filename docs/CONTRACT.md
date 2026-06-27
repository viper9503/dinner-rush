# Integration Contract (locked)

This is the single source of truth for how the Dinner Rush services talk to each
other. Services are independently deployed and share no database tables; they
agree only on what is written here and in `libs/drcommon`.

## Ports

| Service        | Port | Notes                                  |
|----------------|------|----------------------------------------|
| ingestion-svc  | 8001 | POST /orders                           |
| orchestrator   | 8002 | read APIs, /downstreams, /admin        |
| restaurant-svc | 8003 | POST /fulfill, /control                 |
| courier-svc    | 8004 | POST /fulfill, /control                 |
| dashboard-api  | 8005 | /stream (SSE), /snapshot, control proxy |
| load-gen       | 8006 | /rush, /baseline, /control              |
| dashboard-web  | 8080 | static SPA                             |
| rabbitmq       | 5672 / 15672 (mgmt)                            |
| postgres       | 5432 |                                        |
| redis          | 6379 |                                        |
| prometheus     | 9090 |                                        |
| grafana        | 3000 |                                        |

## Databases (one per service, in a single Postgres instance)

`ingestion`, `orchestrator`, `restaurant`, `courier`. Created by
`infra/postgres/init`. Each service runs idempotent `CREATE TABLE IF NOT EXISTS`
migrations on boot. dashboard-api and load-gen have no database.

## Broker topology (RabbitMQ) - see `drcommon/broker.py`

Exchanges: `dinner.events` (topic), `dinner.work` (direct), `dinner.retry`
(direct), `dinner.dlx` (fanout).

Queues:
- `q.order.advance`  <- `dinner.work` [`order.advance`]   consumed by orchestrator
- `q.order.advance.retry` <- `dinner.retry` [`order.advance`], TTL bounce back to work
- `q.order.dlq`      <- `dinner.dlx`                        inspect / replay
- `q.orch.placed`    <- `dinner.events` [`order.placed`]   consumed by orchestrator
- `q.dashboard.events` <- `dinner.events` [`order.#`]      consumed by dashboard-api

## Message envelope (`drcommon.models.Envelope`)

```json
{ "event_id": "uuid", "type": "order.placed|order.transition|order.advance",
  "order_id": "uuid", "ts": "iso8601", "attempt": 1, "data": { } }
```

- `order.placed` data: `{customer_id, restaurant_id, items, total_cents, idempotency_key}`
- `order.transition` data: `{from, to, cause, attempt}`
- `order.advance` (command) data: `{from}` - the state the order must be in to act

## Operation id (idempotency hinge)

`op_id_for(order_id, from_state, to_state)` = `"{order_id}:{from}->{to}"`.
Deterministic per step, so redelivery yields the same id. Enforced by the
`operations` PK in orchestrator and the `dispatches` PK in each downstream.

## Lifecycle (drives which advance steps call a downstream)

`placed -> confirmed -> preparing -> ready -> out_for_delivery -> delivered`
plus `cancelled` / `failed`. Entering `preparing` calls restaurant-svc; entering
`out_for_delivery` calls courier-svc (see `STAGE_DOWNSTREAM`). All other steps are
internal think-time.

## HTTP surfaces

- ingestion `POST /orders` body `OrderRequest` -> `202 {order_id, idempotency_key, status}`.
  Duplicate idempotency_key -> `200` with the original order_id.
- downstream `POST /fulfill` body `FulfillRequest` -> `200 FulfillResult`
  (or 503 down / 429 rate-limited / 500 fail / 504 timeout). Idempotent on op_id.
- downstream `GET/POST /control`, `POST /control/down`, `POST /control/up`.
- orchestrator `GET /orders/{id}`, `GET /downstreams`, `GET /stats`,
  `POST /admin/replay-dlq`.
- dashboard-api `GET /snapshot`, `GET /stream` (SSE), and control-proxy POSTs:
  `/control/load/{rush|baseline|stop|rate}`, `/control/downstream/{restaurant|courier}/{down|up}`.

## Dashboard snapshot schema (dashboard-api -> web)

```json
{
  "ts": "iso8601",
  "states": {"placed": 0, "confirmed": 0, "preparing": 0, "ready": 0,
             "out_for_delivery": 0, "delivered": 0, "cancelled": 0, "failed": 0},
  "totals": {"ingested": 0, "delivered": 0, "failed": 0, "cancelled": 0, "in_flight": 0},
  "throughput": {"ingest_per_sec": 0.0, "deliver_per_sec": 0.0},
  "retries": {"broker_retries": 0, "dlq_depth": 0},
  "queues": {"advance": 0, "retry": 0, "dlq": 0},
  "downstreams": {
    "restaurant": {"breaker": "closed", "error_rate": 0.0, "avg_latency_ms": 0, "down": false},
    "courier":    {"breaker": "closed", "error_rate": 0.0, "avg_latency_ms": 0, "down": false}
  },
  "load": {"mode": "baseline", "target_rps": 3.0, "current_rps": 0.0, "sent": 0},
  "orchestrator_up": false
}
```
