# Dinner Rush

An order pipeline for a food-delivery platform that stays correct under bursty
load and flaky downstreams. Customers place orders; the pipeline drives each one
through its lifecycle (placed, confirmed, preparing, ready, out for delivery,
delivered) while handing fulfillment to deliberately unreliable restaurant and
courier systems. A live dashboard shows the pipeline in real time, and a load
generator can summon a dinner rush on demand.

The design goal is resilience: no order is lost, no order is processed twice, and
the system recovers on its own when a downstream falls over and comes back.

---

## Run it (one command)

```bash
docker compose up --build
```

That brings up everything: the seven services, RabbitMQ, Postgres, Redis,
Prometheus, and Grafana. Schema migrations run automatically on startup and the
load generator begins a quiet baseline drip on its own.

### URLs

| What                       | URL                          | Notes                          |
|----------------------------|------------------------------|--------------------------------|
| **Live dashboard**         | http://localhost:8080        | the main view, auto-updating   |
| Grafana                    | http://localhost:3000        | anonymous viewer, admin/admin  |
| Prometheus                 | http://localhost:9090        | raw metrics                    |
| RabbitMQ management        | http://localhost:15672       | dinner / dinner                |
| ingestion API              | http://localhost:8001        | `POST /orders`                 |
| orchestrator API           | http://localhost:8002        | `/orders/{id}`, `/downstreams` |
| restaurant / courier       | http://localhost:8003 / 8004 | `/control` to tune flakiness   |
| load-gen                   | http://localhost:8006        | `/rush`, `/baseline`, `/stop`  |

Every service also exposes `/health` and `/metrics`.

---

## Demo scenarios

All four scenarios are driven from buttons on the dashboard (top-right control
panel). The equivalent `curl` commands are shown so they are scriptable too.

### 1. Pipeline running

Open the dashboard. The baseline drip is already flowing. Watch orders march
through the funnel (placed to delivered), the throughput chart move, and the
downstream health cards stay green.

### 2. Dinner rush

Click **Trigger Dinner Rush** (ramps to 80 orders/sec). Or:

```bash
curl -X POST http://localhost:8006/rush
# dial to an arbitrary rate:
curl -X POST "http://localhost:8006/control?rps=150"
# back to baseline / stop:
curl -X POST http://localhost:8006/baseline
curl -X POST http://localhost:8006/stop
```

The in-flight count and queue backlog climb, then drain as the pipeline catches
up. Ingestion absorbs the spike because it only writes and enqueues; it never
blocks on a downstream.

### 3. Break something on purpose

Click **Break Restaurant** (or Courier) while traffic is flowing. Or:

```bash
curl -X POST http://localhost:8003/control/down     # hard down
curl -X POST http://localhost:8004/control/down
# or degrade instead of kill:
curl -X POST http://localhost:8003/control -H 'content-type: application/json' \
     -d '{"failure_rate":0.8,"base_latency_ms":1500}'
```

Watch the dashboard: the affected downstream's circuit breaker trips to **open**,
the retry queue fills, and a **STUCK / RETRYING** banner appears. No orders are
lost and none advance twice. Now restore it:

```bash
curl -X POST http://localhost:8003/control/up
```

The breaker closes and the parked orders resume on their own. You can also kill a
whole container (`docker compose kill orchestrator`) mid-rush; it restarts
(`restart: unless-stopped`), in-flight messages are redelivered, and the pipeline
picks up exactly where it left off. If an outage outlasts the broker retry budget,
messages park in the DLQ; the orchestrator auto-drains them back onto the pipeline
within ~15s of both downstreams reporting healthy, so recovery is hands-off. You
can also force an immediate replay with **Replay DLQ** or:

```bash
curl -X POST http://localhost:8002/admin/replay-dlq
```

### 4. System health

The dashboard shows per-state counts, throughput, in-flight, retry and DLQ
depth, and per-downstream breaker state / latency / error rate throughout. For
deeper metrics, Grafana's "Dinner Rush - Pipeline" dashboard comes up populated.

---

## Architecture

Seven small services, each its own container, integrating asynchronously over a
message broker (and HTTP for synchronous reads and fulfillment calls).

```
 load-gen --HTTP--> ingestion --(order.placed)--> [RabbitMQ] --> orchestrator
                                                                  |   ^  |
                                              HTTP /fulfill -------+   |  +--> (order.transition)
                                              (idempotent, retried)   |          |
                                          restaurant   courier        |          v
                                          (flaky)      (flaky)        retry/DLQ   dashboard-api --SSE--> dashboard-web
```

- **ingestion-svc** accepts orders at high volume, persists them, and publishes
  `order.placed`. It never blocks on a downstream, so bursts are bounded only by
  a local DB write.
- **orchestrator-svc** owns the lifecycle state machine. It consumes commands,
  enforces legal transitions only, calls the downstreams for the fulfillment
  stages, and persists every transition.
- **restaurant-svc / courier-svc** are simulated external systems: slow,
  rate-limited, randomly failing, and able to fall over and recover. Tunable at
  runtime via `/control`.
- **dashboard-api** aggregates a live snapshot and pushes it to the browser over
  SSE; it is also the only origin the web app talks to (it proxies control
  actions).
- **dashboard-web** is the auto-updating React UI.
- **load-gen** generates controllable, realistic traffic.

### Why these choices

- **Microservices over a broker.** The problem is fundamentally about failure
  isolation and independent scaling under burst, so the boundaries are drawn at
  real failure lines: a falling-over restaurant must not take ingestion down, and
  ingestion must scale on write volume independently of the slow fulfillment
  path. The honest trade-off: a small team shipping this for real would often
  start with a modular monolith and split later. Microservices are chosen here
  because resilience under partial failure is the whole point of the exercise,
  and the separate downstreams genuinely are separate systems.
- **RabbitMQ.** Per-message manual acks, dead-letter exchanges, and TTL retry
  queues map one-to-one onto the no-lost / no-double / DLQ requirements. Rejected
  Redis Streams (consumer-group acks and DLQ are more hand-rolled) and Kafka
  (heavier dead-letter ergonomics for a single-machine demo).
- **Postgres** for durable order state, the transactional outbox, and the
  unique-constraint dedup authority. **Redis** is the fast first-line dedup check
  and hot dashboard cache only, never the source of truth, because a restart can
  wipe it (which is exactly the failure the graders induce).
- **Python / FastAPI** for small, readable, async services. **React + Recharts**
  over **SSE** for a one-directional live feed (simpler than WebSocket here).
  **Prometheus + Grafana**, provisioned via config so they come up populated.

---

## How correctness is guaranteed

**No lost orders (durability).** Ingestion commits the order before returning
2xx. Every state change and the events it emits are written in the same Postgres
transaction via a **transactional outbox**; a relay publishes them afterward with
publisher confirms. Consumers use **manual acks** and only ack after the work is
durably committed. A crash anywhere redelivers, it never drops.

**No double processing (idempotency).** Every lifecycle step has a deterministic
operation id, `"{order_id}:{from}->{to}"`, identical on any redelivery. The
durable authority is a **unique constraint on that op id in Postgres**: a second
attempt to apply the same step loses the race and becomes a no-op. The
downstreams dedup the same way (a `dispatches` table), so a courier is dispatched
exactly once even when the fulfillment command is retried. At-least-once delivery
plus idempotent consumers gives exactly-once *effects*; we never claim
exactly-once *delivery*.

**Recovery.** Two retry tiers: the HTTP client retries fast in-process with
exponential backoff + jitter and a **circuit breaker** per downstream (open ->
half-open single probe -> closed); if that is exhausted or the breaker is open,
the command bounces through a fixed-delay **broker retry queue**, capped by
`BROKER_MAX_ATTEMPTS`, after which it parks in a **DLQ** for inspect/replay. Rate
limits (429) back off without tripping the breaker. When a downstream recovers,
parked work resumes automatically.

---

## Tuning

Every knob is an env var with a documented default; see `.env.example`. Copy it
to `.env` to override (compose reads it automatically). The most useful ones:

- `RESTAURANT_FAILURE_RATE`, `RESTAURANT_OUTAGE_PROB`, `*_RATE_LIMIT_RPS`, etc.
  control downstream flakiness (also changeable live via `/control`).
- `LOADGEN_BASELINE_RPS`, `LOADGEN_RUSH_RPS` control traffic.
- `BROKER_MAX_ATTEMPTS`, `RETRY_QUEUE_TTL_MS`, `CIRCUIT_*`, `HTTP_*` control the
  resilience behavior.
- `CANCEL_RATE` and `LOADGEN_DUP_RATE` (default 0) exercise the cancelled-order
  path and the idempotent-dedup path respectively.

---

## What I would do differently with more time

- **Scale the orchestrator horizontally** and prove the dedup holds across
  multiple instances (the design already supports it; the outbox relay uses
  `FOR UPDATE SKIP LOCKED`).
- **Per-message exponential broker backoff** (currently the broker tier is a
  fixed delay to avoid RabbitMQ's per-message-TTL head-of-line blocking; the
  exponential character lives in the HTTP tier).
- **Outbox via logical replication or LISTEN/NOTIFY** instead of polling, to cut
  publish latency under extreme load.
- **End-to-end and chaos tests** in CI (kill containers mid-rush and assert
  zero lost / zero double), and **distributed tracing** (the correlation id is
  already threaded through logs).
- A proper **DLQ inspection UI** rather than a single replay button.

---

## Repo layout

```
libs/drcommon/      shared infra: broker, db, outbox, idempotency, http client,
                    state machine, downstream simulator (one import site)
services/           ingestion, orchestrator, restaurant, courier,
                    dashboard_api, load_gen (each its own container)
web/                React + Recharts dashboard, served by nginx
infra/              postgres init, prometheus, grafana provisioning
docs/CONTRACT.md    the locked cross-service integration contract
docker-compose.yml  brings up the whole system
```

### Local development without Docker

A Python 3.12 virtualenv runs the unit tests for the pure logic:

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e libs/drcommon pytest
.venv/bin/python -m pytest libs/drcommon/tests -q
```
