# CLAUDE.md

Project context and working agreements for Claude Code on this repository.

This repo is a standalone implementation of an **order pipeline for a food-delivery platform**. It is built fresh and owned outright. It is inspired by a real-world domain but shares no proprietary code with any other project. The goal is a working, demoable, full-stack system that stays correct under load and failure.

---

## 1. The Brief

The system takes a customer order from the moment they hit "Place Order" all the way through to "Delivered." The platform is busy and messy, and the design has to take that seriously.

### Real-world conditions the system must handle

- **Orders arrive in bursts.** Quiet for long stretches, then a dinner rush floods the system with a spike of orders in a few minutes. Promotions make it worse.
- **Every order moves through a lifecycle.** Roughly: placed, confirmed, being prepared, ready, out for delivery, delivered. Orders can also be cancelled or fail. Stages must happen in the correct order. An order cannot go "out for delivery" before it has been "prepared."
- **Fulfillment depends on flaky downstream systems.** Moving an order forward means handing it to restaurant and courier systems that are slow, sometimes rate-limited, and sometimes fail mid-request. These failures are normal, not exceptional.
- **Mistakes cost money and trust.** Losing an order leaves a customer hungry and angry. Processing the same order twice can dispatch two couriers or charge someone twice. Neither is acceptable.
- **People need visibility.** Operations and business teams want a live view of the pipeline: how many orders are flowing, how the platform is performing right now, and where things are getting stuck or failing.

### What to build

A full-stack, working system that includes:

1. A way for orders to enter the system at high volume.
2. The pipeline itself, moving orders through their lifecycle and handing them off to the flaky downstream restaurant and courier systems. Those downstream systems must be simulated, and made realistically slow and unreliable (they fail and recover at random).
3. A live business dashboard (web UI) showing what is happening in the pipeline as it happens, the kind of view an ops or business team would want during a dinner rush. It updates on its own, with no manual refresh.
4. A way to observe the health of the system while it runs.

It must run entirely on a single machine (`docker compose up` or equivalent). There is no real customer data, so the repo also includes a load generator / simulator that creates realistic order traffic and can be dialed up and down. The dinner rush must be triggerable on demand during a demo.

### Demo scenarios (build so each is one-click)

1. **Pipeline running.** Send orders through and watch them move through their lifecycle on the dashboard in real time.
2. **Dinner rush.** Crank load up sharply and show behavior under a heavy, spiky burst.
3. **Break something on purpose.** Kill or degrade part of the system while busy, and show what happens to in-flight orders. The graders will check: did any order get lost, did any get processed twice, and did things recover when the failure cleared?
4. **System health.** Show health and metrics live throughout all of the above.

### What is being evaluated

- **Architecture and judgment:** is the shape of the system appropriate to the problem, and can it be justified?
- **Correctness under failure:** does it behave well when things go wrong, not just on the happy path?
- **Trade-offs:** are the costs of each choice and the rejected alternatives well understood?
- **Communication:** can the system be explained clearly and defended under questioning?
- **Creativity:** what was chosen, and what nice touches were added?

There is no single right answer. Judgment and reasoning matter more than ticking boxes. AI coding assistants are explicitly allowed.

---

## 2. Architecture

Build this as a set of independently deployable **microservices** communicating asynchronously through a **message broker**, each in its own **Docker** container, orchestrated by a single `docker-compose.yml`. No service shares a process or a database table with another. Integration happens over the broker, and over HTTP for synchronous reads.

This is a deliberate microservices design, and every boundary must be justifiable, because the architecture itself is part of what is being evaluated. Each service exists for a concrete reason: a failure boundary (one service falling over must not take the others down), independent scaling under burst load, or simulating a genuinely separate external system. When explaining the design, be ready to make two points: first, why each split earns its place; second, an honest acknowledgement of the trade-off, that a very small team would often reach for a modular monolith, and that microservices were chosen here because the problem is fundamentally about resilience and failure isolation under load. Defending the boundaries and naming the trade-off is the judgment signal. "Microservices because microservices" is not.

```
                 +------------------+
  load-gen  -->  |  ingestion-svc   |  --(orders.placed)-->  broker
                 +------------------+
                                                               |
                                                               v
                                                     +-------------------+
                                                     |  orchestrator-svc |  (lifecycle state machine)
                                                     +-------------------+
                                                        |            |
                                       (fulfil.restaurant)      (fulfil.courier)
                                                        v            v
                                              +--------------+  +-------------+
                                              | restaurant-  |  | courier-svc |   (simulated flaky downstreams)
                                              | svc (flaky)  |  | (flaky)     |
                                              +--------------+  +-------------+
                                                        |            |
                                                        +-----+------+
                                                              v
                                                    (order.events stream)
                                                              |
                                                              v
                                                     +-----------------+
                                                     | dashboard-api   | --WS/SSE--> dashboard-web
                                                     +-----------------+
```

### Services (each its own container)

- **ingestion-svc:** HTTP endpoint accepting orders at high volume. Validates, assigns an idempotency key, persists, and publishes `orders.placed`. Absorbs spiky bursts without dropping writes (accept-and-enqueue, never block on downstream).
- **orchestrator-svc:** The pipeline brain. Owns the lifecycle state machine, consumes events, drives transitions, and dispatches fulfillment work. Enforces legal transitions only.
- **restaurant-svc:** Simulated downstream. Deliberately slow, rate-limited, and randomly failing and recovering. Failure behavior is tunable.
- **courier-svc:** Second simulated downstream with the same flakiness, dispatched after the restaurant stage.
- **dashboard-api:** Aggregates pipeline state and metrics, pushes live updates to the browser over WebSocket or SSE.
- **dashboard-web:** The web UI. Auto-updates without a manual refresh.
- **load-gen:** Standalone traffic generator with a control surface to dial volume up and down (the dinner-rush trigger).

### Infrastructure containers

- **Message broker:** RabbitMQ, Kafka, NATS JetStream, or Redis Streams. Pick one and be ready to defend it. This is the backbone for decoupling, retries, and durability.
- **Primary datastore:** Postgres for durable order state and the transactional outbox.
- **Cache / dedup store:** Redis for the fast first-line idempotency check, rate-limit counters, and hot dashboard reads. The durable dedup authority is Postgres (see section 4), not Redis.
- **Observability:** Prometheus for metrics plus Grafana for dashboards. Each service exposes `/metrics`.

---

## 3. Order Lifecycle State Machine

Model the lifecycle explicitly as a state machine, not as ad-hoc status fields.

```
placed -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
   \
    -> cancelled    (allowed from placed / confirmed / preparing)
    -> failed       (terminal, reachable from any fulfillment stage)
```

- Transitions are validated server-side. Any attempt to skip a stage is rejected and logged.
- Each transition is persisted before the next stage is attempted.
- Full transition history is stored per order (timestamp, from-state, to-state, cause) for audit and for the dashboard timeline.

---

## 4. Correctness Under Failure (the core grading criterion)

Downstream services WILL fail mid-request. The system must guarantee the following.

### No lost orders (durability)

- Persist the order to Postgres before acknowledging the ingestion request.
- Use the **transactional outbox pattern**: write the state change and the outbound event in the same DB transaction, then relay to the broker. Never publish-then-crash with unsaved state.
- Consumers acknowledge messages only after work is durably committed. Manual acks, not auto-ack.
- The outbox and the broker give **at-least-once** delivery, not exactly-once. Duplicates are a normal, expected outcome of crashes and retries. This is why the idempotency layer below is load-bearing: at-least-once delivery plus idempotent consumers is what produces exactly-once *effects*. Do not claim exactly-once delivery anywhere.

### No double processing (idempotency)

- Every order carries a stable idempotency key. Every fulfillment command carries a unique operation id.
- The **durable dedup guarantee lives in Postgres**, as a unique constraint on the operation id. This is the authority that actually prevents double-processing, because it survives restarts. A commit that would apply an effect twice fails the constraint and becomes a no-op.
- **Redis is the fast first-line check** (and rate limiting and dashboard caching), not the source of truth. Redis is not durable by default, so a restart can drop its keys, which is exactly the failure the graders induce. Use Redis to cheaply skip work that is obviously already done, but never rely on it as the only thing standing between an order and a double charge.
- Downstream effects are idempotent. Dispatching a courier twice for one order is a failure the graders will test for.

### Recovery

- Retries with exponential backoff and jitter on transient downstream failures.
- Dead-letter queue for messages that exhaust retries, with a path to inspect and replay them.
- Circuit breaker around each downstream so a sustained outage stops hammering it and trips back closed once it recovers.
- Respect rate limits: on a rate-limit signal, back off rather than fail the order.
- In-flight orders during a service kill resume cleanly when the service returns. Nothing stuck forever, nothing silently dropped.

---

## 5. Simulated Downstream Behavior

`restaurant-svc` and `courier-svc` must be realistically unreliable, and tunable at runtime (env vars and/or a control endpoint):

- Configurable artificial latency (base plus random jitter).
- Configurable failure rate (random 5xx and timeouts).
- Configurable rate limiting (429s above a threshold).
- Random fall-over-and-recover windows where the service is fully down for a period, then comes back.
- A control endpoint to force-degrade or force-down a service on demand for the live "break something on purpose" demo.

---

## 6. Load Generator

`load-gen` must let the operator create realistic, controllable traffic:

- Baseline steady drip of orders.
- A dinner-rush mode: sharp spike to a high, configurable rate, triggerable on demand (HTTP endpoint or simple control UI).
- Adjustable orders-per-second up and down at runtime.
- Realistic order payloads (varied items, restaurants, customers).

---

## 7. Live Business Dashboard

`dashboard-web` plus `dashboard-api`:

- Auto-updating via WebSocket or SSE. No manual refresh.
- Live counts of orders in each lifecycle state (pipeline / funnel view).
- Throughput: orders/sec ingested vs completed.
- Failure and retry rates, dead-letter count, in-flight count.
- Per-downstream health: latency, error rate, circuit-breaker state.
- Visible "stuck or failing" indicators so the ops view surfaces problems during a rush.
- Stays responsive and keeps updating while under heavy load and while a downstream is broken.

---

## 8. Observability

- Every service exposes `/health` (liveness/readiness) and `/metrics` (Prometheus format).
- Prometheus scrapes all services. Grafana dashboards are provisioned via config so they come up populated.
- Structured JSON logs with an order id / correlation id threaded across services, so a single order can be traced end to end.
- Key metrics: ingestion rate, per-state counts, transition latency, downstream error/retry/DLQ counts, circuit-breaker state.

---

## 9. Packaging and Run (Docker)

- One `docker-compose.yml` brings up the entire system: all microservices, broker, Postgres, Redis, Prometheus, Grafana, load-gen, and the web UI.
- `docker compose up` is the only command needed to start everything. No manual post-start setup.
- Each service has its own `Dockerfile`.
- DB schema migrations run automatically on startup.
- Sensible healthchecks and `depends_on` ordering so services wait for the broker and DB to be ready.
- All tunables (failure rates, rate limits, load levels) exposed via env vars in the compose file with documented defaults.
- Service ports, the dashboard URL, and the Grafana URL are clearly documented.

---

## 10. README (required deliverable)

Keep it short and practical. It must cover:

- One-command run (`docker compose up`) and the URLs for the dashboard, Grafana, and any control endpoints.
- How to drive load: start baseline, trigger the dinner rush, dial up and down.
- How to trigger failures: degrade or kill a downstream, and what to watch on the dashboard.
- Architecture summary: the services, the broker choice, the datastore choice, and why.
- Main decisions and trade-offs (bullet points are fine): how durability is guaranteed, how idempotency works, the retry/backoff/circuit-breaker strategy, and what would be done differently with more time.

---

## Suggested Stack (defensible defaults)

- Services: Go, or Python (FastAPI), or Node (NestJS). Keep services small and single-purpose.
- Broker: RabbitMQ (clear retry/DLQ semantics) or Redis Streams (lightweight, single-machine friendly).
- State store: Postgres with a transactional outbox table.
- Dedup / cache / rate-limit: Redis as the fast first-line check; the durable unique constraint lives in Postgres.
- Frontend: React plus a charting library, live data over WebSocket/SSE.
- Observability: Prometheus plus Grafana.
- Everything wired together in one `docker-compose.yml`.

Keep scope focused on the orchestration and resilience story. Do not build out real payments, real auth, or real third-party integrations. Simulated downstreams are the point.

### Locked decisions for this build

- **Services: Python (FastAPI).** Small, readable services that are quick to walk through in a live session, with first-class async for the I/O-bound fan-out to downstreams. Rejected Go (more boilerplate for a demo) and Node (we want one async runtime, not a heavier DI framework).
- **Broker: RabbitMQ.** Per-message manual acks, dead-letter exchanges, and per-queue TTL/retry map one-to-one onto the no-lost / no-double / DLQ grading criteria. Rejected Redis Streams (consumer-group acks and DLQ are more hand-rolled) and Kafka/NATS (heavier or less familiar dead-letter ergonomics for a single-machine demo).
- **State store: Postgres** with a transactional outbox table and a unique-constraint dedup table as the durable idempotency authority.
- **Cache / dedup first-line / rate-limit: Redis** (fast pre-check only, never the source of truth).
- **Frontend: React + Recharts**, live over SSE (simpler than WebSocket for one-directional server-to-browser updates).
- **Observability: Prometheus + Grafana**, provisioned via config.

---

## Working Agreements for Claude Code

- **Git attribution:** all commits, PRs, and history are attributed solely to the repository owner. Do not add AI co-author trailers, "Generated with" lines, or any AI attribution to commit messages, PR descriptions, or anywhere in git history.
- **Formatting:** do not use em dashes anywhere in code comments, docs, commit messages, or the README.
- **Commits:** small, logical, conventional-style messages. Keep the history clean and readable.
- **Commit dating (backdated history):** The commit history must begin on **Tuesday, 23 June 2026 at 21:00 (9:00 PM), America/Indiana/Indianapolis (-0400)**. The first commit carries exactly that timestamp. Every later commit advances forward in time from it with realistic spacing, never earlier than the commit before it and never dated in the future. Set both `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` on every commit so author and committer timestamps match, for example: `GIT_AUTHOR_DATE="2026-06-23T21:00:00-04:00" GIT_COMMITTER_DATE="2026-06-23T21:00:00-04:00" git commit -m "..."`.
- **Single-machine constraint:** everything must come up with one `docker compose up`. Never introduce a dependency that breaks single-machine, offline operation.
- **Defend every choice:** when adding a library, datastore, or pattern, leave a short note in the README on why it was chosen over the alternative. The live session grades reasoning, so the repo should make the reasoning visible.
